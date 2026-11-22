// One number keypad (the student lens): the typed last step of "פותרים יחד" uses the lesson's own keypad (ui.jsx Keypad,
// the phone's keyboard stays closed, as in a lesson and a challenge), and no typed maths answer anywhere opens the
// phone's decimal pad, which on an iPhone has no minus and no fraction bar: −5 or 3/4 could not be typed.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import Together, { figAt } from './Together.jsx';

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const jsx = (dir = SRC) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return jsx(p);
  return /\.(jsx|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
});

// a problem with no steps left: the typed last step is on screen at once
const problem = { problem: 'כמה זה $-5 + 5$?', steps: [], final: { prompt: 'מה התשובה?', answer: 0, hints: ['חשבו את המרחק מאפס.'] } };

describe('one number keypad', () => {
  it('the last step of solving together is typed with the lesson\'s keypad, the phone keyboard closed', () => {
    const out = renderToStaticMarkup(<Together problem={problem} n={1} of={2} />);
    const input = out.match(/<input[^>]*class="input tg-input[^"]*"[^>]*>/)?.[0];
    expect(input, 'the answer field').toBeTruthy();
    expect(input).toMatch(/inputMode="none"|inputmode="none"/);
    expect(out).toMatch(/<div class="keypad" dir="ltr">/);
    // the same keys as a lesson: the minus and the fraction bar are there
    expect(out).toMatch(/data-k="minus"/);
    expect(out).toMatch(/data-k="frac"/);
  });

  it('no typed maths answer opens the decimal pad (an iPhone\'s has no minus)', () => {
    const decimal = jsx().filter((f) => /inputMode="decimal"/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
    expect(decimal).toEqual([]);
  });
});

// SK-STUDENT-1, round 3: a step solved together may draw the figure again with what it found (the three jumps of −5 that
// make 3 · (−5)), as a worked example's step does; it shows only once that step is solved, and the latest one stays.
describe('the drawing of solving together', () => {
  const line = (to) => ({ type: 'numline', from: -17, to: 2, jumps: [{ from: 0, to, label: String(to) }] });
  const two = { problem: 'נפתור יחד.', display: '9 - 3 \\cdot (-5)', fig: line(-1),
    steps: [{ prompt: 'א', choices: [], hints: ['', ''], done: 'א', fig: line(-15) }, { prompt: 'ב', choices: [], hints: ['', ''], done: 'ב' }],
    final: { prompt: 'כמה זה?', answer: 24, check: '24', hints: ['', ''] } };
  it('shows the problem\'s drawing, then a solved step\'s, which stays while later steps bring none', () => {
    expect(figAt(two, 0)).toBe(two.fig);
    expect(figAt(two, 1)).toBe(two.steps[0].fig);
    expect(figAt(two, 2)).toBe(two.steps[0].fig);
    expect(figAt({ ...two, fig: undefined }, 0)).toBeUndefined();
  });
  it('a step\'s drawing is not on screen before that step is solved', () => {
    const out = renderToStaticMarkup(<Together problem={{ ...two, fig: undefined }} n={1} of={2} />);
    expect(out).not.toMatch(/class="lm-fig"/);
    expect(renderToStaticMarkup(<Together problem={two} n={1} of={2} />)).toMatch(/class="lm-fig"/);
  });
});
