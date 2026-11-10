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
    for (const f of ['app.css', 'v4.css', 'canon.css', 'motion.css', 'Mascot.jsx', 'LineBuilder.jsx', 'Learn.jsx']) expect(names).toContain(f);
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

  it('left no white literal in canon.css (65 at 5618298)', () => {
    expect(read('canon.css').match(/#fff\b|#ffffff/gi) || []).toEqual([]);
  });
});

describe('tokens (STUDENT-2 §2, light values)', () => {
  const css = read('tokens.css');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
  const value = (name) => root.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim().toLowerCase();
  it.each([
    ['paper', '#ffffff'], ['surface', '#ffffff'], ['ground', '#f4f6f9'], ['ink', '#14161a'], ['ink-2', '#565b66'], ['ink-3', '#6b7280'],
    ['control-line', '#8a919e'], ['track', '#e9ecf1'], ['track-edge', '#d3d8e0'],
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
