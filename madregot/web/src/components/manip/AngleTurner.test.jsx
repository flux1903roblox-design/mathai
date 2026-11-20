// The angle tool's whole-angle mode (CLASSROOM-10, the bisector): a fixed ∢AOB and a ray OC turning inside it in 5°
// steps. Rendered to HTML here: a slider with its name, range and value in words, the readout ∢AOC + ∢COB, the step
// buttons' names, and in a check no size at all. Dragging, the arrow keys and reduced motion run in the browser
// (e2e/manip.spec.js).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AngleTurner from './AngleTurner.jsx';
import { manipCorrect, manipSolution, manipWrong, manipPlain, manipText } from '@/content/manip.js';

const html = (props) => renderToStaticMarkup(<AngleTurner onChange={() => {}} {...props} />);
const m = { kind: 'angle', whole: 110, start: 30 };

describe('the angle tool with a whole angle', () => {
  it('is a slider over ∢AOC from 5° to the whole angle less 5°, named and read in words', () => {
    const out = html({ m, value: 30, answer: 55 });
    expect(out).toContain('role="slider"');
    expect(out).toContain('aria-label="הקרן OC בתוך הזווית AOB"');
    expect(out).toContain('aria-valuemin="5"');
    expect(out).toContain('aria-valuemax="105"');
    expect(out).toContain('aria-valuenow="30"');
    expect(out).toContain('aria-valuetext="הזווית AOC 30 מעלות, הזווית COB 80 מעלות"');
    expect(out).toContain('tabindex="0"');
  });
  it('reads ∢AOC + ∢COB = the two parts = the whole, and names A, O, B and C', () => {
    const out = html({ m, value: 30, answer: 55 }).replace(/<!-- -->/g, '');
    expect(out).toContain('∢AOC + ∢COB');
    expect(out).toMatch(/= <span class="ang-right">30°<\/span> \+ <span class="ang-left">80°<\/span> = 110°/);
    ['A', 'B', 'C', 'O'].forEach((k) => expect(out).toContain(`class="mp-pt-label">${k}</text>`));
  });
  it('has two step buttons of 5° with their own names, the smaller off at 5°', () => {
    const at5 = html({ m, value: 5, answer: 55 });
    expect(at5).toContain('aria-label="להקטין את הזווית AOC ב־5 מעלות"');
    expect(at5).toContain('aria-label="להגדיל את הזווית AOC ב־5 מעלות"');
    expect(at5).toMatch(/aria-label="להקטין את הזווית AOC ב־5 מעלות"[^>]*disabled=""|disabled=""[^>]*aria-label="להקטין את הזווית AOC ב־5 מעלות"/);
    expect(html({ m, value: 105, answer: 55 })).toMatch(/aria-label="להגדיל את הזווית AOC ב־5 מעלות"[^>]*disabled=""|disabled=""[^>]*aria-label="להגדיל את הזווית AOC ב־5 מעלות"/);
  });
  it('in a check says no size, until the answer is shown', () => {
    const out = html({ m, value: 30, answer: 55, test: true });
    expect(out).not.toContain('30°');
    expect(out).not.toContain('80°');
    expect(out).toContain('aria-valuetext="הזווית AOC"');
    expect(html({ m, value: 30, answer: 55, test: true, reveal: true })).toContain('30°');
  });
  it('locked, it leaves the tab order', () => {
    expect(html({ m, value: 55, answer: 55, locked: true, good: true })).toContain('tabindex="-1"');
  });
  it('the line mode is as it was: the right angle measured, the left one asked', () => {
    const out = html({ m: { kind: 'angle', target: 70, start: 90 }, value: 90, answer: 110 });
    expect(out).toContain('aria-label="הזווית הימנית"');
    expect(out).toContain('aria-valuemax="175"');
    expect(out).not.toContain('∢AOC');
  });
  it('is checked, solved and missed by the same rules: the value is ∢AOC', () => {
    const it = { form: 'manip', manip: m, answer: 55 };
    expect(manipCorrect(it, manipSolution(it))).toBe(true);
    expect(manipCorrect(it, m.start)).toBe(false);
    const wrong = manipWrong(it);
    expect(manipCorrect(it, wrong)).toBe(false);
    expect(wrong).toBeLessThanOrEqual(105);
    expect(manipText(it)).toBe('55°');
    expect(manipPlain(it)).toContain('זווית AOB של 110°');
  });
});
