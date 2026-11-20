// The JS side of the ux-motion rules (.claude/skills/ux-motion/SKILL.md): the presets in lib/motion.js and the screens
// that move most often. The CSS side is src/styles/motion.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { DUR, EASE, enter, leave, swap, cascade } from './motion.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('motion presets', () => {
  it('leaving eases in, the same curve as --ease-in in tokens.css (principle 5)', () => {
    expect(EASE.in).toEqual([0.7, 0, 0.84, 0]);
    expect(src('styles/tokens.css')).toMatch(/--ease-in: cubic-bezier\(0\.7, 0, 0\.84, 0\);/);
    expect(leave()).toEqual({ duration: DUR.quick, delay: 0, ease: EASE.in });
    expect(enter().ease).toBe(EASE.out);
  });

  it('a swap: the new one comes in ease-out, the old one goes in half the time, ease-in (principles 18 and 20)', () => {
    const s = swap();
    expect(s.initial).toEqual({ opacity: 0, x: -28 });
    expect(s.animate).toMatchObject({ opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE.out } });
    expect(s.exit).toMatchObject({ opacity: 0, x: 28, transition: { duration: 0.1, ease: EASE.in } });
    // with AnimatePresence mode="wait" the next exercise is whole on screen in out + in: under 400ms (principle 16)
    expect(Math.round((s.exit.transition.duration + s.animate.transition.duration) * 1000)).toBeLessThanOrEqual(300);
    const t = swap(24, 0.22);
    expect(t.exit.transition.duration).toBeCloseTo(0.11, 5);
    expect(t.initial.x).toBe(-24);
  });

  it('a cascade: 30 to 60ms apart, and the rest together after the first six (principle 3)', () => {
    expect(cascade(0)).toBe(0);
    expect(cascade(1) - cascade(0)).toBeGreaterThanOrEqual(0.03);
    expect(cascade(1) - cascade(0)).toBeLessThanOrEqual(0.06);
    expect(cascade(6)).toBe(cascade(20));
    expect(cascade(20)).toBeLessThanOrEqual(0.3);
  });
});

describe('the screens that move most often', () => {
  it('a screen that has its own leave(to) takes the motion preset under another name: the hint bar\'s exit called the lesson\'s way out, navigate(0.08), and reloaded the page', () => {
    const lesson = src('screens/Lesson.jsx');
    expect(lesson).toMatch(/import \{[^}]*\bleave as exit\b[^}]*\} from '@\/lib\/motion\.js';/);
    expect(lesson).toMatch(/className="hint-bar"[^>]*exit=\{\{ opacity: 0, transition: exit\(DUR\.micro\) \}\}/);
    // and no file both imports the preset as leave and declares a leave of its own
    const files = readdirSync(new URL('../', import.meta.url), { recursive: true }).filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f));
    const clash = files.filter((f) => {
      const code = src(f);
      return /import \{[^}]*\bleave\b(?! as)[^}]*\} from '@\/lib\/motion\.js'/.test(code) && /(const|let|function)\s+leave\b/.test(code);
    });
    expect(clash).toEqual([]);
  });

  it('a lesson swaps its exercise with swap(): the old one leaves quicker than the new one comes', () => {
    const lesson = src('screens/Lesson.jsx');
    expect(lesson).toMatch(/const slide = swap\(\);/);
    expect(lesson).not.toMatch(/exit: \{ opacity: 0, x: 28 \}, transition: enter\(0\.2\)/);
  });

  it('a teaching step swaps the same way', () => {
    const player = src('components/learn/StepPlayer.jsx');
    expect(player).toMatch(/\{\.\.\.swap\(24, 0\.22\)\}/);
    expect(player).not.toMatch(/exit=\{\{ opacity: 0, x: 24 \}\} transition=\{enter\(0\.22\)\}/);
  });

  it('the profile\'s medals pop in 50ms apart and the rest together after six (there are ten and more)', () => {
    const ach = src('components/Achievements.jsx');
    expect(ach).toMatch(/delay=\{0\.1 \+ cascade\(k, 0\.05\)\}/);
    expect(ach).not.toMatch(/delay=\{0\.1 \+ k \* 0\.05\}/);
  });

  it('the quests tab fills its three bars in 400ms, 40ms apart (it was 700ms, 120ms apart: over a second)', () => {
    const quests = src('screens/Quests.jsx');
    expect(quests).toMatch(/transition=\{\{ duration: DUR\.slow, delay: 0\.15 \+ cascade\(i\), ease: EASE\.out \}\}/);
    expect(quests).not.toMatch(/i \* 0\.12/);
    expect(0.15 + cascade(2) + DUR.slow).toBeLessThan(0.7);
  });
});
