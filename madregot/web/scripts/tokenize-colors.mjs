#!/usr/bin/env node
// One-off codemod (STUDENT-2 §3): replace the colour literals in the loaded stylesheets with tokens from tokens.css,
// so the dark theme can be a swap of token values. Run once and commit its output; scripts/check-colors.mjs keeps it so.
//
//   node scripts/tokenize-colors.mjs                  dry run: prints what it would change and what it could not map
//   node scripts/tokenize-colors.mjs --write          rewrites app.css, v4.css, canon.css and motion.css
//   node scripts/tokenize-colors.mjs --report FILE    also writes the full report to FILE
//
// Rules, in order (the first that answers wins):
//   1. hand decisions for one selector (DECL, BY_SELECTOR);
//   2. colours that stay on purpose get a "colour-ok: <reason>" comment on their line (illustration wood, the
//      notebook page, masks, shades and shadows that sit on a coloured fill and read the same in both themes);
//   3. white: background → --surface (--paper on the page selectors), color → --on-brand, borders, rings and
//      strokes → --paper, SVG fills → --surface; white drawn on a coloured fill (ON_COLOUR) → --on-brand;
//      translucent white → color-mix() of that token with transparent (the same pixels);
//   4. a literal equal to a token's value → that token; the spec's near-identical literals → their token (MERGE).
// Anything else is reported as "could not map" and left as it is (the lint then fails until a person decides).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const STYLES = path.resolve(here, '../src/styles');
const FILES = ['app.css', 'v4.css', 'canon.css', 'motion.css'];

export const LITERAL = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\([^)]*\)/g;

// ---------------------------------------------------------------- the decisions
// page selectors: their white is the page (--paper), not a card (--surface)
const PAGE = new Set(['html', 'body', '.learn', '.page-hero', '.screen-bar', '.tabbar', '.learn-top', '.lesson-foot', '.lesson', '.lesson-head', '.done-screen', '.chat-dock']);
// white here is drawn on a coloured fill (a banner, a stop, a coloured card, an illustration): it stays white in dark
const ON_COLOUR = ['.unit-bar i', '.node-card .btn-primary', '.btn-on-color', '.sc-stroke-w', '.wb-road-dash', '.wb-blocks', '.mp-bal-w line', '.wb-window', '.climb-tread', '.climb-num', '.node-burst i', '.week-day.on .week-dot svg'];
// translucent white over the page or a card (a frosted bar, a veil); every other translucent white sits on a coloured fill
const VEIL = { '.learn-top': '--paper', '.t-head': '--paper', '.combo-pop': '--paper', '.page-remove': '--surface', '.bl-why': '--surface' };

// exact values of tokens (the semantic token wins when several share a value)
const EXACT = {
  '#14161a': '--ink', '#565b66': '--ink-2', '#6b7280': '--ink-3', '#f4f6f9': '--ground', '#e4e7ec': '--rule',
  '#cdd2da': '--rule-strong', '#d5dae2': '--rule-press', '#1a5cf5': '--brand', '#1246c4': '--brand-d', '#eaf1ff': '--brand-tint',
  '#a9c3ff': '--brand-line', '#a84f00': '--streak-ink', '#cfdcff': '--marker-strong', '#f5f8ff': '--p-50', '#5b8cff': '--p-400',
  '#1651db': '--p-600', '#e9ecf1': '--track', '#d3d8e0': '--track-edge', '#eceef2': '--disabled-bg', '#dfe2e8': '--disabled-lip',
  '#bfe9c9': '--good-line', '#f6c3cd': '--bad-line', '#5c3d00': '--on-gold-ink', '#ffe38a': '--gold-line', '#8fdcab': '--good-mid',
  '#f28aa2': '--bad-mid', '#b45300': '--streak-d', 'rgba(20,22,26,0.45)': '--scrim',
};
// near-identical literals merged into one token (STUDENT-2 §2 "Replaces", plus the few the table did not list)
const MERGE = {
  '--brand-line': ['#b3d1ff', '#c3d7f4', '#cadfff', '#c9d9ff', '#d2e4ff', '#a9c7f5', '#b8d0f4', '#c4d4ec', '#c6daf7'],
  '--good-line': ['#b4e8c8', '#9fdcb7', '#c8f0d7'],
  '--bad-line': ['#ffc9d5', '#ffb3c4', '#f2c6d0', '#ffb3c3', '#f2b3c1'],
  '--on-gold-ink': ['#7a4e00', '#4a3200'],
  '--ink-3': ['#9aa1ac', '#b7bdc7', '#a3adbc'],
  '--track': ['#e3e8ef'],
  '--track-edge': ['#c6ced9', '#d9dee6'],
  '--rule-strong': ['#c9cfd9'],
  '--rule': ['#e4e8ee'],
  '--brand-d': ['#00398f'],
  '--brand-tint': ['#ecf4ff'],
  '--gold-line': ['#f1d27a'],
  '--gold-d': ['#c48f00'],
  '--good-mid': ['#7fd4a4'],
  '--bad': ['#d9304f'],
  '--ch-violet-ink': ['#336dc4'],
  '--scrim': ['rgba(22,25,29,0.42)'],
};
// one selector, one property: the whole value (where a literal-by-literal answer would read wrong)
const DECL = {
  '.nl-cold|stop-color': 'var(--ch-sky-tint)',
  '.nl-warm|stop-color': 'var(--streak-tint)',
  '.hub-plan .hub-card-icon|background': 'color-mix(in srgb, var(--ch-petrol) 14%, var(--surface))',
  '.hub-plan .hub-card-icon|color': 'var(--ch-petrol-d)',
  '.plan-head|background': 'color-mix(in srgb, var(--ch-petrol) 12%, var(--surface))',
};
// one selector: a literal → a replacement
const BY_SELECTOR = {
  '.btn:disabled': { '#6b7280': 'var(--disabled-ink)', '#8a8ca0': 'var(--disabled-ink)' },
  '.stat-good': { '#000000': 'var(--on-good)' },
  '.stat-gold': { '#000000': 'var(--on-gold)' },
  '.learn': { '#f8fbff': 'color-mix(in srgb, var(--brand-tint) 50%, var(--paper))' },
  '.t-code': { '#ffffff@border-color': 'var(--surface)' },
  '.node-open': { '#ffffff@--open-line': 'var(--surface)' },
  // white text on an ink chip is the page colour (the inverse of ink in both themes), not the on-brand white
  '.ex-num': { '#ffffff@color': 'var(--paper)' },
  '.t-tab.on': { '#ffffff@color': 'var(--paper)' },
  '.page-num': { '#ffffff@color': 'var(--paper)' },
  '.t-list li': { 'rgba(22,25,29,0.08)': 'var(--rule)' },
};
// colours that stay, with the reason written on their line
const KEEP = [
  { test: (l) => ['#7d4f1f', '#b07636', '#c98a43', '#b77b3d', '#fff3b0'].includes(l), why: 'illustration' },
  { test: (l, c) => /^\.nb-|^:root$/.test(c.selector) && ['#1c2f7a', '#c9d8ee', '#e48a9b', '#eef3fb'].includes(l), why: 'the notebook page stays light' },
  { test: (l, c) => /mask/.test(c.prop), why: 'mask, not a colour' },
  { test: (l) => ['#ffd34d', '#5fd476'].includes(l), why: 'the lit top of a coloured bar, the same in both themes' },
  { test: (l) => /^rgba\(0,0,0,/.test(l), why: 'a shade (black at low alpha), the same in both themes' },
  { test: (l, c) => l === '#000000' && /color-mix/.test(c.value), why: 'a shade (black at low alpha), the same in both themes' },
  { test: (l, c) => /^rgba\((36,45,58|22,25,29|20,22,26),/.test(l) && !/backdrop/.test(c.selector) && !/^border/.test(c.prop), why: 'shadow' },
];

// ---------------------------------------------------------------- parsing
export function normalise(lit) {
  const s = lit.toLowerCase().replace(/\s+/g, '');
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3 || h.length === 4) return '#' + [...h].map((c) => c + c).join('').slice(0, 6) + (h.length === 4 ? h[3] + h[3] : '');
    return s;
  }
  const m = s.match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/);
  if (!m) return s;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if (a === 1) return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
  return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
}

// Every declaration with its property, the selector of its rule and the offsets of its value.
export function declarations(css) {
  const out = []; const stack = []; let start = 0; let paren = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = (e < 0 ? css.length : e + 2) - 1; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1; i = j; continue; }
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (paren === 0 && c === '{') { stack.push(stripComments(css.slice(start, i)).trim().replace(/\s+/g, ' ')); start = i + 1; }
    else if (paren === 0 && (c === ';' || c === '}')) {
      const text = css.slice(start, i);
      const colon = colonOf(text);
      const rule = [...stack].reverse().find((s) => !s.startsWith('@'));
      if (rule !== undefined && colon >= 0) {
        const prop = stripComments(text.slice(0, colon)).trim().toLowerCase();
        if (prop && !prop.startsWith('@')) out.push({ prop, selector: rule, at: stack.filter((s) => s.startsWith('@')), vStart: start + colon + 1, vEnd: i, value: text.slice(colon + 1) });
      }
      if (c === '}') stack.pop();
      start = i + 1;
    }
  }
  return out;
}
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }
function colonOf(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); if (e < 0) return -1; i = e + 1; continue; }
    if (text[i] === ':') return i;
  }
  return -1;
}

// ---------------------------------------------------------------- mapping
const lastCompound = (sel) => sel.split(',').map((p) => p.trim().split(/\s+|>|\+|~/).filter(Boolean).pop().replace(/::?[\w-]+(\([^)]*\))?/g, ''));
const isPage = (sel) => lastCompound(sel).every((c) => PAGE.has(c));
const TEXT = /^(color|-webkit-text-fill-color|caret-color|--btn-ink|--tone-on|--fb-ink|--box-ink)$/;
const BG = /^(background|background-color|background-image|--btn-bg|--fb-bg|--fb-foot|--box-tint|--b-face|--face-c|--tone)$/;
const LINE = /^(border|border-[\w-]+|outline|outline-color|box-shadow|--btn-line|--btn-lip|--box-line|--fb-line|--edge|--b-rim|column-rule)$/;
const v = (t) => `var(${t})`;
const GLOBAL = new Set([...fs.readFileSync(path.join(STYLES, 'tokens.css'), 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

function whiteToken(c) {
  if (ON_COLOUR.includes(c.selector)) return '--on-brand';
  if (TEXT.test(c.prop)) return '--on-brand';
  if (BG.test(c.prop)) return isPage(c.selector) ? '--paper' : '--surface';
  if (LINE.test(c.prop) || c.prop === 'stroke' || c.prop === 'filter' || c.prop === 'text-shadow') return '--paper';
  if (c.prop === 'fill' || c.prop === 'stop-color') return '--surface';
  return null;
}

/** → { to } a replacement, { keep } a reason, or null (could not map) */
export function decide(lit, c) {
  const n = normalise(lit);
  const own = BY_SELECTOR[c.selector];
  if (own && own[`${n}@${c.prop}`]) return { to: own[`${n}@${c.prop}`], rule: 'selector' };
  if (own && own[n]) return { to: own[n], rule: 'selector' };
  for (const k of KEEP) if (k.test(n, c)) return { keep: k.why };
  if (n === '#ffffff') { const t = whiteToken(c); return t ? { to: v(t), rule: 'white' } : null; }
  const a = n.match(/^rgba\(255,255,255,([\d.]+)\)$/);
  if (a) {
    if (Number(a[1]) === 0) return { to: 'transparent', rule: 'white' };
    const t = VEIL[c.selector] || '--on-brand';
    return { to: `color-mix(in srgb, var(${t}) ${Math.round(Number(a[1]) * 100)}%, transparent)`, rule: 'white' };
  }
  if (EXACT[n]) return { to: v(EXACT[n]), rule: 'exact' };
  for (const [t, list] of Object.entries(MERGE)) if (list.includes(n)) return { to: v(t), rule: 'merge' };
  return null;
}

export function tokenize(css, file) {
  const edits = []; const keepLines = new Map(); const unmapped = []; const changes = [];
  const lineOf = (off) => css.slice(0, off).split('\n').length;
  for (const d of declarations(css)) {
    const key = `${d.selector}|${d.prop}`;
    if (DECL[key] && LITERAL.test(d.value)) {
      LITERAL.lastIndex = 0;
      const lead = d.value.match(/^\s*/)[0];
      edits.push({ from: d.vStart, to: d.vEnd, text: lead + DECL[key] });
      changes.push({ file, line: lineOf(d.vStart), selector: d.selector, prop: d.prop, from: d.value.trim(), to: DECL[key], rule: 'declaration' });
      continue;
    }
    LITERAL.lastIndex = 0;
    for (const m of d.value.matchAll(LITERAL)) {
      const off = d.vStart + m.index;
      const ctx = { ...d, file };
      // a literal as the fallback of var(--token, #lit): a token of tokens.css is always defined, so its fallback goes;
      // the fallback of a local variable (--c-tint is set only under a .ch-* class) is mapped like any other literal
      const before = d.value.slice(0, m.index);
      const fb = before.match(/var\((--[\w-]+)\s*,\s*$/);
      if (fb && GLOBAL.has(fb[1]) && d.value[m.index + m[0].length] === ')') {
        const cut = before.match(/\s*,\s*$/)[0].length;
        edits.push({ from: off - cut, to: off + m[0].length, text: '' });
        changes.push({ file, line: lineOf(off), selector: d.selector, prop: d.prop, from: m[0], to: '(fallback removed)', rule: 'fallback' });
        continue;
      }
      // a line that already says why its colour stays (colour-ok) was decided by a person: leave it
      const lineText = css.slice(css.lastIndexOf('\n', off) + 1, css.indexOf('\n', off) < 0 ? css.length : css.indexOf('\n', off));
      if (lineText.includes('colour-ok:')) continue;
      const r = decide(m[0], ctx);
      if (!r) { unmapped.push({ file, line: lineOf(off), selector: d.selector, prop: d.prop, literal: m[0] }); continue; }
      if (r.keep) { keepLines.set(lineOf(off), r.keep); changes.push({ file, line: lineOf(off), selector: d.selector, prop: d.prop, from: m[0], to: `kept: colour-ok: ${r.keep}`, rule: 'keep' }); continue; }
      edits.push({ from: off, to: off + m[0].length, text: r.to });
      changes.push({ file, line: lineOf(off), selector: d.selector, prop: d.prop, from: m[0], to: r.to, rule: r.rule });
    }
  }
  // literals outside any declaration (a comment, for instance) are left alone; the lint ignores comments too
  let out = css;
  for (const e of edits.sort((x, y) => y.from - x.from)) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  const lines = out.split('\n');
  for (const [ln, why] of keepLines) if (!lines[ln - 1].includes('colour-ok:')) lines[ln - 1] += ` /* colour-ok: ${why} */`;
  return { css: lines.join('\n'), changes, unmapped };
}

// ---------------------------------------------------------------- run
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write');
  const ri = process.argv.indexOf('--report');
  const report = [];
  let total = 0; let missed = 0;
  for (const f of FILES) {
    const p = path.join(STYLES, f);
    const { css, changes, unmapped } = tokenize(fs.readFileSync(p, 'utf8'), f);
    total += changes.length; missed += unmapped.length;
    report.push(`## ${f}: ${changes.length} changed or kept, ${unmapped.length} could not map`);
    for (const u of unmapped) report.push(`  COULD NOT MAP ${f}:${u.line}  ${u.selector} { ${u.prop}: ${u.literal} }`);
    for (const c of changes) report.push(`  ${c.rule.padEnd(11)} ${f}:${c.line}  ${c.selector} { ${c.prop} }  ${c.from} -> ${c.to}`);
    if (write) fs.writeFileSync(p, css);
  }
  const text = report.join('\n') + `\n\n${total} literals handled, ${missed} could not map${write ? '' : ' (dry run: nothing written)'}\n`;
  if (ri > 0) fs.writeFileSync(process.argv[ri + 1], text);
  process.stdout.write(text.split('\n').filter((l) => !/^\s{2}(white|exact|merge|keep|selector|declaration|fallback)/.test(l)).join('\n'));
}
