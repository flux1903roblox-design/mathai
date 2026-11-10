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
