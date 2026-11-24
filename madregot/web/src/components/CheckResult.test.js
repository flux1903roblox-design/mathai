// The notebook check under WITHHOLD (ai spec AI-3): the tutor never says whether the final answer is right while the
// exercise is still open, so the result says where that answer is checked, and the line that states it has no mark.
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CheckResult, { WITHHELD_LINE } from './CheckResult.jsx';

const steps = [
  { text: '$2x + 4 = 10$', ok: true, comment: '' },
  { text: '$2x = 6$', ok: false, comment: 'בדקו את החיסור.' },
  { text: '$x = 3$', ok: null, comment: 'לא אמור להופיע' },
];

describe('CheckResult', () => {
  it('a withheld check: the box line instead of a verdict, and a neutral, labelled mark with no comment on the final line', () => {
    const out = renderToStaticMarkup(h(CheckResult, { r: { readable: true, steps, final: 'unknown', withheld: true, summary: 'כמעט.' } }));
    expect(WITHHELD_LINE).toBe('את התשובה הסופית כותבים בתיבה, ושם היא נבדקת.');
    expect(out).toContain(WITHHELD_LINE);
    expect(out).not.toContain('לא ברור מה התשובה הסופית.');
    expect(out).toContain('class="open"');
    expect(out).toContain('aria-label="השורה עם התשובה הסופית נבדקת בתיבה"');
    expect(out).toContain('lucide-circle-dashed');
    expect(out).not.toContain('לא אמור להופיע');
    // the other lines keep their marks and comments
    expect(out).toContain('aria-label="שורה נכונה"');
    expect(out).toContain('aria-label="שורה עם טעות"');
    expect(out).toContain('בדקו את החיסור.');
  });
  it('an ordinary check still gives its verdict', () => {
    const out = renderToStaticMarkup(h(CheckResult, { r: { readable: true, steps: steps.slice(0, 2), final: 'wrong', summary: '' } }));
    expect(out).toContain('יש טעות בדרך.');
    expect(out).not.toContain(WITHHELD_LINE);
    expect(out).not.toContain('class="open"');
  });
});

// FOLLOWUP-26: a page that could not be read shows the summary (a care reply's too) as a RichText, which is a <div>: it
// may not sit inside a <p>. The assistant's photo check shows the same component, in its own words.
describe('CheckResult when the page could not be read', () => {
  /** Every <p>…</p> of the markup holds no <div>. */
  const divInP = (html) => [...html.matchAll(/<p[\s>][\s\S]*?<\/p>/g)].some((m) => m[0].includes('<div'));
  it('no <div> inside a <p>, with care and without; the summary goes through RichText', () => {
    for (const care of [false, true]) {
      const out = renderToStaticMarkup(h(CheckResult, { r: { readable: false, care, steps: [], final: 'unknown', summary: 'צלמו שוב, ו־$x = 3$ ייראה טוב יותר.' } }));
      expect(divInP(out), out).toBe(false);
      expect(out).toContain('class="check-unreadable"');
      expect(out).toMatch(/<div class="md"/); // the summary is a RichText (its maths drawn), not plain text
      if (care) expect(out).not.toContain('קשה לקרוא'); else expect(out).toContain('קשה לקרוא את הכתב. ');
    }
  });
  it('the assistant\'s words: its title, "hard to read the picture", and its verdict line', async () => {
    const { FINAL } = await import('./CheckResult.jsx');
    const words = { title: 'בדיקת העוזר', unreadable: 'קשה לקרוא את התמונה.', finals: { ...FINAL, correct: 'התשובה הסופית נכונה.' } };
    const hard = renderToStaticMarkup(h(CheckResult, { r: { readable: false, care: false, steps: [], final: 'unknown', summary: 'נסו באור טוב.' }, ...words }));
    expect(hard).toContain('בדיקת העוזר');
    expect(hard).toContain('קשה לקרוא את התמונה. ');
    expect(divInP(hard)).toBe(false);
    const right = renderToStaticMarkup(h(CheckResult, { r: { readable: true, steps: steps.slice(0, 1), final: 'correct', summary: '' }, ...words }));
    expect(right).toContain('התשובה הסופית נכונה.');
    expect(right).toContain('aria-label="שורה נכונה"');
  });
});
