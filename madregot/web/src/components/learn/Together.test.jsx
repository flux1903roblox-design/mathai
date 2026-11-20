// One number keypad (the student lens): the typed last step of "פותרים יחד" uses the lesson's own keypad (ui.jsx Keypad,
// the phone's keyboard stays closed, as in a lesson and a challenge), and no typed maths answer anywhere opens the
// phone's decimal pad, which on an iPhone has no minus and no fraction bar: −5 or 3/4 could not be typed.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import Together from './Together.jsx';

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
