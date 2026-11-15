// Type follows the reader's settings (COUNCIL2-8): no font size in px and no line height with a unit in src/styles,
// except the listed ones (scripts/check-units.mjs, also `npm run lint:units`).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findUnitProblems, styleFiles, ALLOW } from '../../scripts/check-units.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);

describe('font sizes in rem, line heights unitless', () => {
  it('finds no px font size and no line height with a unit, and every listed exception is still needed', () => {
    const { bad, stale } = findUnitProblems();
    expect(bad.map((b) => `${b.file}:${b.line} ${b.selector} { ${b.property}: ${b.value} }`)).toEqual([]);
    expect(stale).toEqual([]);
  });

  it('reads every stylesheet, the screens\' own sheets included', () => {
    const names = styleFiles().map((f) => path.relative(here, f));
    for (const f of ['tokens.css', 'canon.css', 'app.css', 'report.css', 'lazy/teacher.css', 'lazy/parents.css', 'lazy/figure.css']) expect(names).toContain(f);
  });

  it('keeps the default look: the type scale is the old px over 16, and body text is 17px on 26px lines', () => {
    const tokens = readFileSync(path.join(here, 'tokens.css'), 'utf8');
    const val = (name) => tokens.match(new RegExp(`--${name}:\\s*([^;]+);`))[1].trim();
    const px = { 't-xs': 14, 't-sm': 15, 't-base': 17, 't-md': 19, 't-lg': 22, 't-xl': 28, 't-2xl': 34 };
    for (const [k, v] of Object.entries(px)) expect(parseFloat(val(k)) * 16, k).toBe(v);
    // each line-height token times its own size gives the old px line height (to the 1/64 px a browser lays out in)
    const lh = { xs: [20, 14], sm: [22, 15], base: [26, 17], md: [28, 19], lg: [30, 22], xl: [36, 28], '2xl': [42, 34] };
    for (const [k, [line, size]] of Object.entries(lh)) {
      const got = Number(val(`lh-${k}`)) * size;
      expect(got, `--lh-${k}`).toBeGreaterThanOrEqual(line);
      expect(got - line, `--lh-${k}`).toBeLessThan(1 / 64);
    }
  });

  it('every exception says why', () => {
    for (const [file, sel, prop, why] of ALLOW) expect(why, `${file} ${sel} ${prop}`).toMatch(/\w{4,}/);
  });

  it('catches a px font size, a px or rem line height and a px type token, and lets an exception and print pt pass', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'units-'));
    mkdirSync(path.join(dir, 'lazy'));
    writeFileSync(path.join(dir, 'a.css'), [
      ':root { --t-sm: 15px; --lh-sm: 22px; --t-md: 1.1875rem; --lh-md: 1.4737; }',
      '.a { font-size: 15px; line-height: 1.4667; }',
      '.b { font-size: 0.9375rem; line-height: 22px; }',
      '@media (min-width: 600px) { .c { font: 700 18px/1.2 var(--font-ui); } }',
      '.d { font-size: var(--t-sm); line-height: 1.375rem; }',
      '/* .e { font-size: 12px } in a comment */',
      '.svg-label { font-size: 14px; }',
      '@media print { .sheet h1 { font-size: 15pt; } }',
      '.f { font-size: clamp(1.25rem, 3dvh, 1.5rem); line-height: 1.2; }',
    ].join('\n'));
    writeFileSync(path.join(dir, 'lazy', 'b.css'), '.g { font-size: 1.0625rem; line-height: var(--lh-md); }\n.h { font-size: 13px; }\n');
    const allow = [['a.css', '.svg-label', 'font-size', 'a label inside an SVG figure'], ['a.css', '.gone', 'font-size', 'nothing uses this']];
    const { bad, stale } = findUnitProblems(styleFiles(dir), dir, allow);
    expect(bad.map((b) => `${b.file}:${b.line} ${b.selector} ${b.property}`)).toEqual([
      'a.css:1 :root --t-sm', 'a.css:1 :root --lh-sm',
      'a.css:2 .a font-size', 'a.css:3 .b line-height', 'a.css:4 .c font', 'a.css:5 .d line-height',
      'lazy/b.css:2 .h font-size',
    ]);
    expect(stale).toEqual(['a.css .gone font-size']);
  });
});
