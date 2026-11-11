// Colour tokens everywhere (STUDENT-2 §1-§3): the stylesheets and components name tokens, not colours, so the dark
// theme can be a swap of token values. The lint (scripts/check-colors.mjs, also `npm run lint:colors`) runs here.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findColourLiterals, colourFiles } from '../../scripts/check-colors.mjs';
import { tokenize, decide } from '../../scripts/tokenize-colors.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => readFileSync(path.join(here, f), 'utf8');

describe('colour lint', () => {
  it('finds no colour literal outside tokens.css unless its line says colour-ok', () => {
    const bad = findColourLiterals();
    expect(bad.map((b) => `${b.file}:${b.line} ${b.text}`)).toEqual([]);
  });

  it('reads the loaded stylesheets and every component', () => {
    const names = colourFiles().map((f) => path.basename(f));
    for (const f of ['app.css', 'v4.css', 'canon.css', 'motion.css', 'Mascot.jsx', 'LineBuilder.jsx', 'Learn.jsx', 'wardrobe.css', 'teacher.css', 'figure.css']) expect(names).toContain(f);
    expect(names).not.toContain('tokens.css');
  });

  it('catches a literal, and lets a marked line, a comment and an HTML entity pass', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'colours-'));
    mkdirSync(path.join(dir, 'styles'));
    writeFileSync(path.join(dir, 'styles', 'a.css'), [
      '.a { color: #fff; }',
      '.b { background: rgba(0, 0, 0, 0.1); }',
      '.c { fill: #b07636; } /* colour-ok: illustration */',
      '/* the old blue was #1a5cf5 */',
      '.d { color: var(--ink); }',
    ].join('\n'));
    writeFileSync(path.join(dir, 'b.jsx'), 'const a = <i fill="#123456" />;\nconst b = "&#8203;";\n');
    const bad = findColourLiterals(colourFiles(dir), dir);
    expect(bad.map((b) => `${b.file}:${b.line}`)).toEqual(['styles/a.css:1', 'styles/a.css:2', 'b.jsx:1']);
  });
});

describe('the token codemod', () => {
  it('maps white by what it paints and where', () => {
    const at = (selector, prop, value = '#fff') => decide('#fff', { selector, prop, value })?.to;
    expect(at('.card', 'background')).toBe('var(--surface)');
    expect(at('.learn-top', 'background')).toBe('var(--paper)');
    expect(at('html, body', 'background')).toBe('var(--paper)');
    expect(at('.btn-primary', '--btn-ink')).toBe('var(--on-brand)');
    expect(at('.avatar-initial', 'box-shadow')).toBe('var(--paper)');
    expect(at('.unit-bar i', 'background')).toBe('var(--on-brand)'); // on the coloured banner
    expect(at('.ex-num', 'color')).toBe('var(--paper)');            // on an ink chip
    expect(decide('rgba(255, 255, 255, 0.35)', { selector: '.unit-guide', prop: 'border', value: '' }).to).toBe('color-mix(in srgb, var(--on-brand) 35%, transparent)');
    expect(decide('#b3d1ff', { selector: '.seg.on', prop: 'border-color', value: '' }).to).toBe('var(--brand-line)');
    expect(decide('#7d4f1f', { selector: '.sc-ink', prop: 'stroke', value: '' }).keep).toBe('illustration');
  });

  it('has nothing left to change in the committed stylesheets (it was run once and its output kept)', () => {
    for (const f of ['app.css', 'v4.css', 'canon.css', 'motion.css']) {
      const css = read(f);
      const r = tokenize(css, f);
      expect(r.unmapped, f).toEqual([]);
      expect(r.css === css, `${f} would still change`).toBe(true);
    }
  });

  it('left no white literal in canon.css (65 at 5618298), except the marked light exceptions (notebook page, QR code)', () => {
    const whites = read('canon.css').split('\n').filter((l) => /#fff\b|#ffffff/i.test(l));
    expect(whites.filter((l) => !l.includes('colour-ok:'))).toEqual([]);
    expect(whites.length).toBeLessThanOrEqual(2);
  });
});

describe('tokens (STUDENT-2 §2, light values)', () => {
  const css = read('tokens.css');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
  const value = (name) => root.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim().toLowerCase();
  it.each([
    ['paper', '#ffffff'], ['surface', '#ffffff'], ['ground', '#f4f6f9'], ['ink', '#14161a'], ['ink-2', '#565b66'], ['ink-3', '#6b7280'],
    ['control-line', '#848b98'] /* the spec's #8a919e is 2.93:1 on --ground, under 3:1 */, ['track', '#e9ecf1'], ['track-edge', '#d3d8e0'],
    ['disabled-bg', '#eceef2'], ['disabled-ink', '#6b7280'], ['disabled-lip', '#dfe2e8'],
    ['brand', '#1a5cf5'], ['brand-lip', '#1246c4'], ['brand-d', '#1246c4'], ['brand-tint', '#eaf1ff'], ['brand-line', '#a9c3ff'],
    ['good-ink', '#157a41'], ['good-tint', '#e3f8e7'], ['good-line', '#bfe9c9'],
    ['bad-ink', '#b3203a'], ['bad-tint', '#fde8ec'], ['bad-line', '#f6c3cd'],
    ['gold-ink', '#8a5c00'], ['gold-tint', '#fff6d6'], ['on-gold-ink', '#5c3d00'],
    ['streak-ink', '#a84f00'], ['streak-tint', '#fff1e3'], ['on-brand', '#ffffff'], ['scrim', 'rgba(20, 22, 26, 0.45)'],
  ])('--%s is %s', (name, light) => expect(value(name)).toBe(light));
  it('keeps the lift shadow', () => expect(value('shadow-lift')).toMatch(/^0 2px 6px/));
});

describe('the dead dark files are gone (STUDENT-2 §1)', () => {
  it.each(['theme-dark.css', 'dark.gen.css', '../../scripts/theme-dark.cjs'])('%s', (f) => expect(existsSync(path.join(here, f))).toBe(false));
  it('main.jsx loads only the live stylesheets', () => {
    const main = readFileSync(path.join(here, '../main.jsx'), 'utf8');
    expect(main).not.toMatch(/theme-dark|dark\.gen/);
  });
});

describe('the dark theme (STUDENT-2 §4, §8)', () => {
  const dark = read('dark.css');
  const tokens = read('tokens.css');
  const lightRoot = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('\n}', tokens.indexOf(':root {')));
  // the declarations of the first rule with this selector after `from`, as written between its braces
  const body = (selector, from = 0) => {
    const at = dark.indexOf(`${selector} {`, from);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    const open = dark.indexOf('{', at);
    return dark.slice(open + 1, dark.indexOf('}', open)).trim();
  };
  const decls = (text) => Object.fromEntries([...text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const followPhone = body(':root:not([data-theme="light"])', dark.indexOf('@media (prefers-color-scheme: dark)'));
  const chosen = body(':root[data-theme="dark"]', dark.indexOf('\n:root[data-theme="dark"]'));
  const print = body(':root:not([data-theme]), :root[data-theme]', dark.indexOf('@media print'));
  const light = decls(lightRoot);
  const darkTokens = decls(followPhone);
  // colours that are the same in both themes, on purpose: white on the fills, the fills themselves (a unit keeps its
  // identity, buttons stay brand blue), the meaning colours' fills and lips, and Madi
  const SAME = /^--(on-brand|on-glow|brand|glow|ai|p-400|p-600|good|good-d|on-good|bad|bad-d|on-bad|streak|streak-d|on-streak|gold|gold-d|on-gold|on-gold-ink|madi-[\w-]+|ch-(sky|petrol|violet|fuchsia|cobalt)(-d)?)$/;

  it('follows the phone and the explicit "כהה" with byte-identical bodies', () => {
    expect(followPhone.length).toBeGreaterThan(500);
    expect(chosen).toBe(followPhone);
    expect(followPhone).toMatch(/color-scheme: dark;/);
  });

  it('gives every colour token of the light theme a dark value, or keeps it the same on purpose', () => {
    const colourTokens = Object.entries(light).filter(([, v]) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v)).map(([k]) => k);
    expect(colourTokens.length).toBeGreaterThan(60);
    const missing = colourTokens.filter((k) => !(k in darkTokens) && !SAME.test(k));
    expect(missing).toEqual([]);
  });

  it('defines no dark token the light theme lacks (a typo would do nothing)', () => {
    expect(Object.keys(darkTokens).filter((k) => !(k in light))).toEqual([]);
  });

  it('prints with the light values, for every token the dark theme changes', () => {
    const p = decls(print);
    expect(Object.keys(p).sort()).toEqual(Object.keys(darkTokens).sort());
    for (const k of Object.keys(p)) expect(p[k], k).toBe(light[k]);
    expect(print).toMatch(/color-scheme: light;/);
    // last in the file, so it wins over the two dark blocks
    expect(dark.lastIndexOf('@media print')).toBeGreaterThan(dark.indexOf('\n:root[data-theme="dark"]'));
  });

  it('the stops: no ring in light, a 2px ring in their -ink in dark', () => {
    expect(light['--stop-ring']).toBe('0px');
    expect(darkTokens['--stop-ring']).toBe('2px');
    const canon = read('canon.css');
    expect(canon).toMatch(/\.node-current, \.node-done \{ box-shadow: 0 0 0 var\(--stop-ring\) var\(--c-ink/);
  });

  it('is imported last, after canon.css', () => {
    const main = readFileSync(path.join(here, '../main.jsx'), 'utf8');
    const imports = [...main.matchAll(/import '\.\/styles\/([\w.]+)'/g)].map((m) => m[1]);
    expect(imports.at(-1)).toBe('dark.css');
  });

  it('keeps the notebook page and the QR code light, with their own light tokens', () => {
    const canon = read('canon.css');
    const rule = canon.slice(canon.indexOf('.nb-page, .handoff-qr {'), canon.indexOf('}', canon.indexOf('.nb-page, .handoff-qr {')));
    expect(rule).toMatch(/color-scheme: light;/);
    expect(rule).toMatch(/--surface: #ffffff;/);
  });

  it('index.html: no fixed theme, a bar colour for each scheme, and the boot script before the app', () => {
    const html = readFileSync(path.join(here, '../../index.html'), 'utf8');
    expect(html).not.toMatch(/data-theme=/);
    expect(html).toMatch(/<meta name="theme-color" content="#ffffff" media="\(prefers-color-scheme: light\)" \/>/);
    expect(html).toMatch(/<meta name="theme-color" content="#0f1115" media="\(prefers-color-scheme: dark\)" \/>/);
    expect(html).toMatch(/<meta name="madregot-store-key" content="%VITE_STORE_KEY%" \/>/);
    expect(html.indexOf('theme-boot.js')).toBeGreaterThan(0);
    expect(html.indexOf('theme-boot.js')).toBeLessThan(html.indexOf('type="module"'));
    expect(html).not.toMatch(/<script>(?!<)/); // no inline script (the CSP forbids one)
  });
});
