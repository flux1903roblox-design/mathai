#!/usr/bin/env node
// Type follows the reader's settings (COUNCIL2-8): a font size in src/styles is in rem (1rem = 16px at the default
// text size, so the default look is the same) or relative to its parent (em, %), never in px; a line height is unitless,
// so it grows with its own font size. A browser's or phone's larger text then reaches every screen.
// Exceptions are listed here by stylesheet and selector, each with its reason; an entry nothing uses any more fails too.
// Run: npm run lint:units (units.test.js runs it with the unit tests).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STYLES = path.resolve(here, '../src/styles');

// Labels drawn inside an SVG figure. Their px are the figure's own units: they grow and shrink with the drawing (and
// with the browser's zoom), and a label that grew with the text size alone would cover the lines and points it names.
const SVG_LABELS = {
  'app.css': [
    '.fg-angle.target', '.fg-pt-label', '.fg-side.target', '.fg-tick', '.mp-bal-box text', '.mp-dline .mp-num',
    '.mp-dline-pill text', '.mp-fbar-whole .mp-num', '.mp-ghost-pin text', '.mp-ghost-pt text', '.mp-hint text', '.mp-hint text.big',
    '.mp-num', '.mp-tile text', '.np-pin text',
  ],
  'canon.css': ['.geo .fg-pt-label'],
  'lazy/figure.css': [
    '.fg-angle', '.fg-axis-name', '.fg-fbar-label', '.fg-grid-label', '.fg-math', '.fg-nl-jump-label', '.fg-nl-mark-label', '.fg-nl-num',
    '.fg-side', '.fg-sq-text', '.fg-word', '.fig-bar-level-num', '.fig-bar-num', '.fig-bar.gone .fig-bar-num', '.fig-cd-meet-num',
    '.fig-cd-quad', '.fig-cd-rr-num', '.fig-cd-tag', '.fig-cd-word', '.fig-cd-word.fig-var', '.fig-mc-io text', '.fig-mc-rule', '.fig-nl-move',
    '.fig-nl-name', '.fig-nl-num', '.fig-nl-num.on', '.fig-th-num', '.fig-th-read', '.fig-thermo.two .fg-word', '.fig-thermo.two .fig-th-num',
    '.fig-thermo.two .fig-th-read', '.geo .fg-angle', '.geo .fg-angle.target', '.geo .fg-side', '.geo .fg-side.target',
  ],
  'lazy/shared.css': [
    '.manip-numberline.cut .mp-num, .manip-pins.cut .mp-num', '.mp-angle-label', '.mp-area-len', '.mp-area-len.var', '.mp-area-val',
    '.mp-axis-name', '.mp-bar-value', '.mp-bar-value.movable', '.mp-dline-name', '.mp-fbar-mark-label', '.mp-ghost-num', '.mp-jump',
    '.mp-pt-label', '.mp-step-label', '.mp-tile text.unit',
  ],
};

/** [file, selector, property, reason] the lint lets through. */
export const ALLOW = [
  ...Object.entries(SVG_LABELS).flatMap(([file, sels]) => sels.map((s) => [file, s, 'font-size', 'a label inside an SVG figure, in the figure\'s units'])),
  // a backup code or a restore code shown whole on one line: the size comes from the screen's width (the px is the
  // page's side margins); the rem cap still follows the text size
  ['lazy/durable.css', '.backup-code-body > .backup-code', 'font-size', 'a code sized to fit the width'],
  ['lazy/durable.css', '.restore-input', 'font-size', 'a code sized to fit the width'],
  // the line height every element inherits: 26px at the default text size whatever the element's font size, as the
  // design was drawn; in rem it still grows with the reader's text size
  ['tokens.css', 'body', 'line-height', 'the inherited line height'],
  ['canon.css', 'body', 'line-height', 'the inherited line height'],
];

// blank out /* comments */, keeping the length so positions and line numbers stay true
const blankComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/** Every stylesheet under src/styles (the screens' own sheets in lazy/ included). */
export function styleFiles(dir = STYLES) {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.css')) out.push(p); } };
  walk(dir);
  return out.sort();
}

const PX = /\d(?:px)\b/;
const LENGTH = /\d(?:px|rem|em|%|pt|vh|vw|dvh|ch|ex)\b/;

/**
 * Every font size in px and every line height with a unit: [{ file, line, selector, property, value }], and the
 * allow-list entries nothing matched (stale).
 */
export function findUnitProblems(files = styleFiles(), root = STYLES, allow = ALLOW) {
  const bad = []; const used = new Set();
  const allowed = (file, sel, prop) => { const i = allow.findIndex(([f, s, p]) => f === file && s === sel && p === prop); if (i >= 0) used.add(i); return i >= 0; };
  for (const abs of files) {
    const file = path.relative(root, abs).split(path.sep).join('/');
    const code = blankComments(fs.readFileSync(abs, 'utf8'));
    const lineAt = (i) => code.slice(0, i).split('\n').length;
    // tokens: the type scale is in rem, its line heights unitless
    for (const m of code.matchAll(/--((?:t|fs)-[\w-]+)\s*:\s*([^;]+);/g)) if (PX.test(m[2])) bad.push({ file, line: lineAt(m.index), selector: ':root', property: `--${m[1]}`, value: m[2].trim() });
    for (const m of code.matchAll(/--(lh-[\w-]+)\s*:\s*([^;]+);/g)) if (LENGTH.test(m[2])) bad.push({ file, line: lineAt(m.index), selector: ':root', property: `--${m[1]}`, value: m[2].trim() });
    // innermost blocks: a rule's selector and its declarations (a rule inside @media is found on its own)
    for (const b of code.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      let sel = b[1]; if (sel.includes(';')) sel = sel.slice(sel.lastIndexOf(';') + 1);
      sel = sel.trim().replace(/\s+/g, ' ');
      const at = b.index + b[1].length + 1;
      for (const d of b[2].matchAll(/(?<![-\w])(font-size|font|line-height)\s*:\s*([^;]+)/g)) {
        const [, prop, value] = d;
        const wrong = prop === 'line-height' ? LENGTH.test(value) : PX.test(value);
        if (!wrong) continue;
        // print sheets are measured in pt, and an @page box has no reader's setting to follow
        if (sel.startsWith('@page') || /^@bottom|^@top/.test(sel)) continue;
        if (allowed(file, sel, prop === 'font' ? 'font-size' : prop)) continue;
        bad.push({ file, line: lineAt(at + d.index), selector: sel, property: prop, value: value.trim() });
      }
    }
  }
  const stale = allow.filter((_, i) => !used.has(i)).map(([f, s, p]) => `${f} ${s} ${p}`);
  return { bad, stale };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { bad, stale } = findUnitProblems();
  for (const b of bad) console.error(`${b.file}:${b.line}  ${b.selector} { ${b.property}: ${b.value} }`);
  for (const s of stale) console.error(`allow-list entry with nothing to allow: ${s}`);
  if (bad.length || stale.length) {
    console.error(`\nA font size in px does not follow the reader's text size: use rem (px / 16). A line height takes no unit (px / the font size). An exception goes in ALLOW in scripts/check-units.mjs, with its reason.`);
    process.exit(1);
  }
  console.log(`units: every font size follows the text size and every line height is unitless (${styleFiles().length} stylesheets, ${ALLOW.length} listed exceptions)`);
}
