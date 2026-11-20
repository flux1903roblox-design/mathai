// Motion follows the owner's ux-motion rules (.claude/skills/ux-motion/SKILL.md) in every stylesheet: durations on the
// motion tokens, no linear easing but for loops, nothing reversible moved by @keyframes, sheets that close faster than
// they open, reduced motion everywhere and 44px hit areas (scripts/check-motion.mjs, also `npm run lint:motion`).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findMotionProblems, styleFiles, tokenTimes, rules, ALLOW, TARGETS } from '../../scripts/check-motion.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => readFileSync(path.join(here, f), 'utf8');

describe('motion lint (ux-motion)', () => {
  it('finds nothing to fix in the stylesheets, and every listed exception is still needed', () => {
    const { bad, stale } = findMotionProblems();
    expect(bad.map((b) => `#${b.rule} ${b.file}:${b.line} ${b.selector} ${b.text}`)).toEqual([]);
    expect(stale).toEqual([]);
  });

  it('reads every stylesheet, the screens\' own sheets included', () => {
    const names = styleFiles().map((f) => path.relative(here, f));
    for (const f of ['tokens.css', 'app.css', 'canon.css', 'motion.css', 'lazy/sheetDialog.css', 'lazy/celebrate.css', 'lazy/lesson.css']) expect(names).toContain(f);
  });

  it('every exception says why, and a long animation is a moment, a loop or a pace set in code', () => {
    for (const [file, sel, why] of ALLOW) expect(why, `${file} ${sel}`).toMatch(/^(once|a loop|paced)/);
    for (const [file, sel, h] of TARGETS) expect(h, `${file} ${sel}`).toBeLessThan(44);
  });

  it('the tokens: closing is quicker than opening, the keypad is the quickest press, and leaving eases in', () => {
    const t = tokenTimes();
    expect(t['--duration-tap']).toBeLessThan(t['--duration-micro']);
    expect(t['--duration-micro']).toBeLessThanOrEqual(100);
    expect(t['--duration-quick']).toBeLessThanOrEqual(150);
    expect(t['--duration-slow']).toBeLessThanOrEqual(400);
    expect(read('tokens.css')).toMatch(/--ease-in: cubic-bezier\(0\.7, 0, 0\.84, 0\);/);
  });

  it('a sheet opens in 400ms ease-out and closes in 150ms ease-in, and its backdrop goes with it (principle 18)', () => {
    const app = read('app.css');
    expect(app).toMatch(/\.sheet \{[^}]*transition: transform var\(--duration-slow\) var\(--ease-smooth-out\)/);
    expect(app).toMatch(/\.sheet\[data-ending-style\] \{[^}]*transition-duration: var\(--duration-quick\); transition-timing-function: var\(--ease-in\);/);
    expect(read('lazy/sheetDialog.css')).toMatch(/\.sheet-backdrop\[data-ending-style\] \{ transition-duration: var\(--duration-quick\); transition-timing-function: var\(--ease-in\); \}/);
  });

  it('the keypad and the check button answer a tap at once: no keyframes, a press of 60 to 80ms (principle 20)', () => {
    const app = read('app.css');
    expect(app).toMatch(/\.keypad \.key \{[^}]*transition: transform var\(--duration-tap\) var\(--ease-out\), box-shadow var\(--duration-tap\) var\(--ease-out\);/);
    expect(app).toMatch(/\.btn \{[^}]*transition: transform var\(--duration-micro\) var\(--ease-out\)/);
    // the press is a transition (retargets at once); a keyframe would replay on every tap
    const pressed = rules().filter((r) => /\.(key|keypad|check-btn|btn)(?![\w-])/.test(r.selector) && /(?<![-\w])animation\s*:\s*(?!none)/.test(r.body));
    expect(pressed.map((r) => `${r.file}:${r.line} ${r.selector}`)).toEqual([]);
  });

  it('catches each rule on a made-up stylesheet, and lets the right things pass', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'motion-'));
    mkdirSync(path.join(dir, 'lazy'));
    writeFileSync(path.join(dir, 'tokens.css'), [
      ':root { --duration-quick: 150ms; --duration-slow: 400ms; }',
      '@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }',
    ].join('\n'));
    writeFileSync(path.join(dir, 'a.css'), [
      '.press { transition: transform 80ms ease-out; }', // 8: a number typed in place
      '.ok { transition: opacity var(--duration-quick) var(--ease-out), width var(--duration-fast, 160ms) ease-out; }',
      '.fade { transition: opacity var(--duration-quick) linear; }', // 5
      '.spin { animation: spin var(--duration-slow) linear infinite; }', // a loop: fine
      '.menu.open { animation: pop var(--duration-quick) ease-out; }', // 17 (and 20: pop moves)
      '.sheet { transition: transform var(--duration-slow) ease-out; }',
      '.sheet[data-starting-style] { transform: translateY(24px); }',
      '.sheet[data-ending-style] { transition-duration: var(--duration-slow); }', // 18: as slow as opening, no ease-in
      '.hop { animation: pop 0.9s ease-out; }', // 8 (not listed) and 20
      '@keyframes pop { from { transform: scale(0.5); } }',
      '@keyframes spin { to { transform: rotate(1turn); } }',
      '@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }',
      '.tiny { width: 32px; height: 32px; }', // 12: listed, no hit area
      '.padded { width: 40px; height: 40px; position: relative; }',
      '.padded::after { content: ""; position: absolute; inset: -2px; }',
    ].join('\n'));
    const targets = [['a.css', '.tiny', 32, 32], ['a.css', '.padded', 40, 40], ['a.css', '.gone', 30, 30]];
    const { bad, stale } = findMotionProblems(styleFiles(dir), dir, { allow: [['a.css', '.nothing', 'once: gone']], targets });
    expect(bad.map((b) => `#${b.rule} ${b.file}:${b.line} ${b.selector}`).sort()).toEqual([
      '#12 a.css:13 .tiny',
      '#17 a.css:5 .menu.open',
      '#18 a.css:8 .sheet[data-ending-style]',
      '#18 a.css:8 .sheet[data-ending-style]',
      '#20 a.css:5 .menu.open',
      '#20 a.css:9 .hop',
      '#5 a.css:3 .fade',
      '#8 a.css:1 .press',
      '#8 a.css:9 .hop',
    ].sort());
    expect(stale).toEqual(['ALLOW a.css .nothing', 'TARGETS a.css .gone']);
  });

  it('wants the global reduced-motion rule in tokens.css', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'motion-'));
    writeFileSync(path.join(dir, 'tokens.css'), ':root { --duration-quick: 150ms; }\n');
    const { bad } = findMotionProblems(styleFiles(dir), dir, { allow: [], targets: [] });
    expect(bad.map((b) => `#${b.rule} ${b.file}`)).toEqual(['#20 tokens.css']);
  });
});
