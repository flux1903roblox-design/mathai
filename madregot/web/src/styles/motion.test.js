// Motion follows the owner's ux-motion rules (.claude/skills/ux-motion/SKILL.md) in every stylesheet: durations on the
// motion tokens, no linear easing but for loops, nothing reversible moved by @keyframes, sheets that close faster than
// they open, reduced motion everywhere and 44px hit areas (scripts/check-motion.mjs, also `npm run lint:motion`).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findMotionProblems, styleFiles, tokenTimes, rules, ALLOW, TARGETS, PRESS } from '../../scripts/check-motion.mjs';

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
    for (const [file, sel, h, w] of TARGETS) expect(Math.min(h, w ?? Infinity), `${file} ${sel}`).toBeLessThan(44);
  });

  it('the tokens: closing is quicker than opening, the keypad is the quickest press, and leaving eases in', () => {
    const t = tokenTimes();
    expect(t['--duration-tap']).toBeLessThan(t['--duration-micro']);
    expect(t['--duration-micro']).toBeLessThanOrEqual(100);
    expect(t['--duration-quick']).toBeLessThanOrEqual(150);
    expect(t['--duration-slow']).toBeLessThanOrEqual(400);
    // a press: 100 to 150ms for a button sinking onto its lip, 80 to 150ms for a squash (principles 1 and 8)
    expect(t['--duration-press']).toBeGreaterThanOrEqual(100);
    expect(t['--duration-press']).toBeLessThanOrEqual(150);
    expect(t['--duration-squash']).toBeGreaterThanOrEqual(80);
    expect(t['--duration-squash']).toBeLessThanOrEqual(150);
    expect(t['--duration-tap']).toBeLessThan(t['--duration-press']);
    expect(read('tokens.css')).toMatch(/--ease-in: cubic-bezier\(0\.7, 0, 0\.84, 0\);/);
    // moving from one place on screen to another (a switch's knob): the skill's ease-in-out
    expect(read('tokens.css')).toMatch(/--ease-in-out: cubic-bezier\(0\.65, 0, 0\.35, 1\);/);
  });

  it('a sheet opens in 400ms ease-out and closes in 150ms ease-in, and its backdrop goes with it (principle 18)', () => {
    const app = read('app.css');
    expect(app).toMatch(/\.sheet \{[^}]*transition: transform var\(--duration-slow\) var\(--ease-smooth-out\)/);
    expect(app).toMatch(/\.sheet\[data-ending-style\] \{[^}]*transition-duration: var\(--duration-quick\); transition-timing-function: var\(--ease-in\);/);
    expect(read('lazy/sheetDialog.css')).toMatch(/\.sheet-backdrop\[data-ending-style\] \{ transition-duration: var\(--duration-quick\); transition-timing-function: var\(--ease-in\); \}/);
    // follow-through (principle 4): the content lags the sheet by 40ms on the way in, and goes with it on the way out
    const sheet = read('lazy/sheetDialog.css');
    expect(sheet).toMatch(/\.sheet-body, \.sheet-foot \{ transition: translate var\(--duration-slow\) var\(--ease-smooth-out\) var\(--duration-stagger\); \}/);
    expect(sheet).toContain('.sheet[data-starting-style] > .sheet-body, .sheet[data-starting-style] > .sheet-foot { translate: 0 var(--distance-medium); }');
    expect(sheet).toContain('.sheet[data-ending-style] > .sheet-body, .sheet[data-ending-style] > .sheet-foot { transition: none; }');
  });

  it('the keypad and the check button answer a tap at once: no keyframes, a press of 60 to 80ms (principle 20)', () => {
    const app = read('app.css');
    expect(app).toMatch(/\.keypad \.key \{[^}]*transition: transform var\(--duration-tap\) var\(--ease-out\), box-shadow var\(--duration-tap\) var\(--ease-out\);/);
    expect(app).toMatch(/\.btn \{[^}]*transition: transform var\(--duration-press\) var\(--ease-out\)/);
    // the check button and the feedback's button take the keypad's speed, not a button's
    expect(read('canon.css')).toMatch(/\.check-btn, \.fb-actions \.btn \{ transition-duration: var\(--duration-tap\); \}/);
    // the press is a transition (retargets at once); a keyframe would replay on every tap
    const pressed = rules().filter((r) => /\.(key|keypad|check-btn|btn)(?![\w-])/.test(r.selector) && /(?<![-\w])animation\s*:\s*(?!none)/.test(r.body));
    expect(pressed.map((r) => `${r.file}:${r.line} ${r.selector}`)).toEqual([]);
  });

  it('one press: a tile, a stop and a switch\'s knob squash by the tokens, from their bottom edge; text never takes the full squash (principles 1, 8)', () => {
    const app = read('app.css'); const canon = read('canon.css'); const tokens = read('tokens.css');
    expect(tokens).toMatch(/--squash: 1\.04 0\.96;/);
    expect(tokens).toMatch(/--squash-soft: 1\.02 0\.98;/);
    // under reduced motion a press only sinks
    expect(tokens).toMatch(/prefers-reduced-motion: reduce\) \{\s*:root \{ --squash: none; --squash-soft: none; --squash-knob: none; \}/);
    expect(app).toMatch(/\.lesson \.choice:active:not\(:disabled\) \{ translate: 0 4px; scale: var\(--squash-soft\);/);
    // the lesson's choices are motion buttons: their press is the CSS one, not a whileTap scale of their own
    expect(read('../screens/Lesson.jsx')).not.toMatch(/whileTap/);
    expect(app).toMatch(/\.ob-opt:active \{ transform: translateY\(4px\); scale: var\(--squash-soft\);/);
    expect(canon).toMatch(/\.node:active \{ transform: translateY\(var\(--lip\)\); scale: var\(--squash\);/);
    expect(canon).toMatch(/\.ls-choice:active:not\(:disabled\) \{ transform: translateY\(4px\); scale: var\(--squash-soft\);/);
    expect(canon).toMatch(/input\[role="switch"\]:active:not\(:disabled\)::after \{ scale: var\(--squash-knob\); \}/);
    // every press in the app moves in a press token (the lint): none left on --duration-micro
    const micro = rules().filter((r) => /transition/.test(r.body) && /--duration-micro/.test(r.body));
    expect(micro.map((r) => `${r.file}:${r.line} ${r.selector}`)).toEqual([]);
    expect(PRESS).toEqual(['--duration-tap', '--duration-press', '--duration-squash']);
  });

  it('catches each rule on a made-up stylesheet, and lets the right things pass', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'motion-'));
    mkdirSync(path.join(dir, 'lazy'));
    writeFileSync(path.join(dir, 'tokens.css'), [
      ':root { --duration-quick: 150ms; --duration-slow: 400ms; }',
      '@media (prefers-reduced-motion: reduce) { :root { --squash: none; --squash-soft: none; --squash-knob: none; } *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }',
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
      '.lip { transition: transform var(--duration-press) var(--ease-out); }',
      '.lip:active { transform: translateY(4px); }', // fine: sinks in a press token
      '.snap:active:not(:disabled) { transform: translateY(2px); }', // 8: moves with no press transition
      '.tile { transition: transform var(--duration-squash) ease-out, scale var(--duration-squash) ease-out; }',
      '.tile:active { scale: var(--squash); }', // 1: the full squash on a tile with text
      '.node { transition: transform var(--duration-squash) ease-out, scale var(--duration-squash) ease-out; }',
      '.node:active { scale: 0.9; }', // 1: a number of its own
      '.lm .tile:active { transform: translateY(2px) scale(0.98); }', // 1: a scale in the transform (its transition is .tile's)
      '.combo-pop { position: fixed; inset: 0; z-index: 40; }', // 16: the combo moment as a layer over the lesson
      '.lesson-meter .combo-pop { position: absolute; top: 50%; }', // fine: a pill in the bar's box
      '.bare { transition: opacity var(--duration-quick) ease; }', // 5: the bare ease
      '.unset { transition: opacity var(--duration-quick); }', // 5: no easing at all
      '.knob { transition: inset-inline-start var(--duration-quick) var(--ease-in-out); }', // fine
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
      '#8 a.css:18 .snap:active:not(:disabled)',
      '#1 a.css:20 .tile:active',
      '#1 a.css:22 .node:active',
      '#1 a.css:23 .lm .tile:active',
      '#16 a.css:24 .combo-pop',
      '#16 a.css:24 .combo-pop',
      '#5 a.css:26 .bare',
      '#5 a.css:27 .unset',
    ].sort());
    expect(stale).toEqual(['ALLOW a.css .nothing', 'TARGETS a.css .gone']);
  });

  it('the combo moment is a pill in the bar\'s box, not a layer over the lesson (principles 16, 17)', () => {
    const lesson = read('lazy/lesson.css');
    expect(lesson).toMatch(/\.lesson-meter \{ position: relative; flex: 1;/);
    expect(lesson).toMatch(/\.combo-pop \{\s*position: absolute;/);
    expect(lesson).not.toMatch(/backdrop-filter/);
  });

  it('a list arriving comes in one item after another, 40ms apart, all started within 300ms (principle 3)', () => {
    const canon = read('canon.css'); const t = tokenTimes();
    expect(canon).toMatch(/\.cascade > \* \{ animation: cascade-in var\(--duration-fast\) var\(--ease-smooth-out\) both; \}/);
    expect(canon).toMatch(/\.cascade > :nth-child\(n \+ 7\) \{ animation-delay: calc\(6 \* var\(--duration-stagger\)\); \}/);
    expect(t['--duration-stagger']).toBeGreaterThanOrEqual(30);
    expect(t['--duration-stagger']).toBeLessThanOrEqual(60);
    expect(6 * t['--duration-stagger']).toBeLessThan(300);
    expect(canon).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.cascade > \* \{ animation: none; \} \}/);
    // where lists arrive: the quests, the profile's numbers, a stair's five stages, a unit unfolded on the map, the
    // teacher's lists
    const screen = (f) => readFileSync(path.join(here, '../screens', f), 'utf8');
    expect(screen('Quests.jsx')).toContain('<ul className="quest-list cascade">');
    expect(screen('Me.jsx')).toContain('<div className="profile-stats cascade">');
    expect(screen('Journey.jsx')).toContain('<ol className="journey-stages cascade"');
    expect(screen('Learn.jsx')).toContain("<ol className={clsx('path', unfolded && 'cascade')}");
    for (const f of ['teacher/TomorrowTab.jsx', 'teacher/WorkTab.jsx', 'teacher/HelpTab.jsx', 'teacher/Library.jsx']) expect(screen(f), f).toMatch(/className="[^"]*\bcascade\b/);
  });

  it('a wait shows at once, and past 400ms a bar runs under it (principle 16)', () => {
    const canon = read('canon.css');
    expect(canon).toMatch(/\.loading-bar \{[^}]*opacity: 0; animation: loading-show var\(--duration-fast\) var\(--ease-out\) var\(--duration-slow\) forwards; \}/);
    expect(tokenTimes()['--duration-slow']).toBe(400);
    expect(readFileSync(path.join(here, '../components/Screen.jsx'), 'utf8')).toMatch(/<span className="loading-bar" aria-hidden="true"><i \/><\/span>/);
  });

  it('wants the global reduced-motion rule in tokens.css', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'motion-'));
    writeFileSync(path.join(dir, 'tokens.css'), ':root { --duration-quick: 150ms; }\n');
    const { bad } = findMotionProblems(styleFiles(dir), dir, { allow: [], targets: [] });
    expect(bad.map((b) => `#${b.rule} ${b.file}`)).toEqual(['#20 tokens.css', '#20 tokens.css', '#20 tokens.css', '#20 tokens.css']);
    expect(bad.map((b) => b.text).join('\n')).toMatch(/--squash is not none under reduced motion/);
  });
});
