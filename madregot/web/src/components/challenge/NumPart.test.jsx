// A challenge's number part with π after its slot (stage 2, MEASURE-1 item 4): the slot is drawn as □π, a screen reader
// is told what to type, the answer line writes 25π, and the whole value typed as a decimal is right in another form,
// not a miss. The part here is a fixture: no challenge asks with π yet.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NumPart from './NumPart.jsx';
import ErrorPart from './ErrorPart.jsx';
import { NumFields } from './common.jsx';
import { piValueTyped, answerTexOf, numCheck } from '@/learn/challenges/grade.ts';

const part = { type: 'num', prompt: 'מה שטח עיגול שרדיוסו $5$ ס״מ? כתבו בעזרת $\\pi$.', answer: 25, check: '5^2', unit: 'סמ״ר', after: '\\pi', solution: ['$5^2 = 25$'] };

describe('a challenge number part with π after the slot', () => {
  it('draws π after the slot, left to right, with the unit after both, and names the slot for a screen reader', () => {
    const html = renderToStaticMarkup(<NumPart part={part} onDone={() => {}} last />);
    expect(html).toContain('class="ch-field-math" dir="ltr"');
    expect(html).toMatch(/<input[^>]*aria-label="התשובה, המספר שלפני פאי"/);
    expect(html).toContain('ch-after');
    // π comes after the input inside the left-to-right group, and the unit after the group
    const slot = html.indexOf('id="ch-slot-v"'); const pi = html.indexOf('ch-after'); const unit = html.indexOf('סמ״ר</span>');
    expect(slot).toBeGreaterThan(0);
    expect(pi).toBeGreaterThan(slot);
    expect(unit).toBeGreaterThan(pi);
  });

  it('a part without after is drawn as before: no π, the plain name', () => {
    const html = renderToStaticMarkup(<NumPart part={{ ...part, after: undefined }} onDone={() => {}} last />);
    expect(html).not.toContain('ch-after');
    expect(html).toMatch(/<input[^>]*aria-label="התשובה"/);
  });

  it('the error part\'s fix takes after too', () => {
    const err = { type: 'error', prompt: 'מה הטעות?', lines: ['$\\pi \\cdot 5 = 5\\pi$', '$S = 10\\pi$'], wrong: 1, why: 'השטח הוא $\\pi r^2$.', fix: { prompt: 'מה השטח הנכון?', answer: 25, check: '25', after: '\\pi' } };
    // the fix is drawn once the wrong line is found; the fields are what it draws there
    const html = renderToStaticMarkup(<NumFields fields={[{ name: 'v', label: err.fix.prompt, after: err.fix.after }]} values={{}} onChange={() => {}} />);
    expect(html).toContain('ch-after');
    expect(html).toMatch(/aria-label="מה השטח הנכון\?, המספר שלפני פאי"/);
    expect(renderToStaticMarkup(<ErrorPart part={err} onDone={() => {}} last />)).toContain('איזו שורה שגויה?');
  });

  it('writes the answer with π, and reads the whole value as right in another form', () => {
    expect(answerTexOf(25, '\\pi')).toBe('25\\pi');
    expect(answerTexOf(25)).toBe('25');
    expect(numCheck(25, '25')).toEqual({ u: 25, ok: true });
    expect(numCheck(25, '78.5')?.ok).toBe(false);
    expect(piValueTyped(25, '\\pi', 78.5)).toBe(true);
    expect(piValueTyped(25, '\\pi', 78.54)).toBe(true);
    expect(piValueTyped(25, '\\pi', 26)).toBe(false);
    expect(piValueTyped(25, '\\pi', 25)).toBe(false);
    expect(piValueTyped(25, undefined, 78.5)).toBe(false);
  });

  it('a note under the fields, when given, is a status line', () => {
    const html = renderToStaticMarkup(<NumFields fields={[{ name: 'v', label: 'התשובה', after: '\\pi' }]} values={{}} onChange={() => {}} note="נכון בקירוב. כאן כותבים רק את המספר שלפני $\pi$." />);
    expect(html).toMatch(/<p class="answer-partial ch-note" role="status">/);
  });
});
