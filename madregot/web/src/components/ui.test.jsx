// The shared pieces of STUDENT-15, rendered to HTML: the Button's busy and done states (A1), Segmented and Progress on
// Base UI with the app's existing classes (B3, B8). Interaction (Tab stops, arrows in right-to-left) is in
// e2e/ui-kit.spec.js; here, what each one puts in the page.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Button, Segmented, Progress, Choices, Choice, Keypad, typeInto } from './ui.jsx';
import { parseNum } from '@/content/util.js';

const html = (el) => renderToStaticMarkup(<DirectionProvider direction="rtl">{el}</DirectionProvider>);

describe('Button states (A1)', () => {
  it('idle: the words, no busy or disabled marks', () => {
    const out = html(<Button>להפעיל</Button>);
    expect(out).toBe('<button type="button" class="btn btn-primary">להפעיל</button>');
  });

  it('busy: aria-busy and aria-disabled (it keeps its focus), a spinner beside the same words', () => {
    const out = html(<Button state="busy">להפעיל</Button>);
    expect(out).toMatch(/^<button type="button" class="btn btn-primary is-busy" aria-busy="true" aria-disabled="true">/);
    expect(out).toContain('<span class="btn-spin" aria-hidden="true"></span>להפעיל');
    expect(out).not.toMatch(/\sdisabled=""/);
  });

  it('done: a check and the done words, still held', () => {
    const out = html(<Button state="done" doneText="התזכורת פועלת">להפעיל</Button>);
    expect(out).toMatch(/class="btn btn-primary is-done" aria-disabled="true"/);
    expect(out).toMatch(/<svg[^>]*class="lucide lucide-check btn-check"[^>]*aria-hidden="true"/);
    expect(out).toContain('התזכורת פועלת');
    expect(out).not.toContain('להפעיל');
    expect(out).not.toContain('aria-busy');
  });
});

describe('Segmented (B3)', () => {
  it('a radio group of the existing .segmented / .seg buttons; the chosen one is .on and the only Tab stop', () => {
    const out = html(<Segmented value="light" options={[['system', 'כמו במכשיר'], ['light', 'בהיר'], ['dark', 'כהה']]} labelledBy="look-title" describedBy="look-hint" />);
    expect(out).toMatch(/^<div role="radiogroup" aria-labelledby="look-title" aria-describedby="look-hint"[^>]*class="segmented"/);
    const radios = [...out.matchAll(/<button[^>]*role="radio"[^>]*>([^<]*)<\/button>/g)];
    expect(radios.map((m) => m[1])).toEqual(['כמו במכשיר', 'בהיר', 'כהה']);
    for (const [tag, text] of radios) {
      expect(tag).toMatch(/class="seg( on)?"/);
      expect(tag.includes('class="seg on"')).toBe(text === 'בהיר');
      expect(tag.includes('aria-checked="true"')).toBe(text === 'בהיר');
    }
  });

  it('busy: every option says it is unavailable; a disabled option is disabled', () => {
    const out = html(<Segmented value={true} busy options={[[true, 'פועלת'], { value: false, label: 'כבויה', disabled: true }]} labelledBy="x" />);
    const radios = [...out.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((m) => m[0]);
    expect(radios).toHaveLength(2);
    for (const r of radios) expect(r).toContain('aria-disabled="true"');
    expect(radios[1]).toMatch(/\sdisabled=""/);
  });
});

describe('Choices (B4)', () => {
  it('one radio group of plain radios: the chosen card is checked, none is disabled (the wardrobe holds what is owned)', () => {
    const out = html(
      <Choices value="sky" labelledBy="h" className="wardrobe-grid">
        <Choice value="sky" className="wardrobe-opt">כחול</Choice>
        <Choice value="gold" className="wardrobe-opt">זהב</Choice>
      </Choices>,
    );
    expect(out).toMatch(/role="radiogroup" aria-labelledby="h"/);
    const [sky, gold] = [...out.matchAll(/<span[^>]*role="radio"[^>]*>/g)].map((m) => m[0]);
    expect(sky).toContain('aria-checked="true"');
    expect(gold).toContain('aria-checked="false"');
    for (const r of [sky, gold]) expect(r).not.toContain('aria-disabled');
  });
});

describe('Progress (B8)', () => {
  it('role=progressbar with its value and words, drawn with the .bar track and the screen\'s fill', () => {
    const out = html(<Progress className="cg-progress" trackClassName="cg-track" fillClassName="cg-fill" value={23} max={60} labelledBy="cg-h" valueText="23 מתוך 60 צעדים" />);
    expect(out).toMatch(/role="progressbar"/);
    expect(out).toMatch(/aria-valuenow="23"/);
    expect(out).toMatch(/aria-valuemax="60"/);
    expect(out).toMatch(/aria-valuetext="23 מתוך 60 צעדים"/);
    expect(out).toMatch(/aria-labelledby="cg-h"/);
    expect(out).toMatch(/class="bar cg-track"/);
    expect(out).toMatch(/class="cg-fill"/);
  });
});

// PRODUCT2-10: a mixed number can be typed on the phone keypad. An answer that is one number gets a space key ("רווח")
// beside the point; it types a space only after a whole number, so 5, רווח, 1, /, 3 is "5 1/3", which the lesson
// reads as 16/3. Other answers (two fields, a point) keep the keypad as it was.
describe('Keypad: a whole number and a fraction (PRODUCT2-10)', () => {
  it('an answer that is one number has the space key, named for a screen reader by the word it shows', () => {
    const out = html(<Keypad onKey={() => {}} mixed />);
    expect(out).toMatch(/<button type="button" data-k="space" class="key key-space" aria-label="רווח, בין השלם לשבר">רווח<\/button>/);
    // the 0 then shares its row with the point and the space
    expect(out).toMatch(/data-k="d0" class="key key-wide"/);
    expect((out.match(/<button /g) || []).length).toBe(15);
  });
  it('without it (a point, a line, two fields) the keypad is as it was', () => {
    const out = html(<Keypad onKey={() => {}} />);
    expect(out).not.toContain('key-space');
    expect(out).toMatch(/data-k="d0" class="key key-wide3"/);
    expect(html(<Keypad onKey={() => {}} onNext={() => {}} />)).toMatch(/data-k="d0" class="key key-wide"/);
  });
  it('types "5 1/3", which reads as 16/3; a space only after a whole number, and only one', () => {
    const typed = (keys) => keys.reduce((v, k) => typeInto(v, k), '');
    expect(typed(['5', ' ', '1', '/', '3'])).toBe('5 1/3');
    expect(parseNum(typed(['5', ' ', '1', '/', '3']))).toBeCloseTo(16 / 3, 12);
    expect(typed(['-', '2', ' ', '3', '/', '4'])).toBe('-2 3/4');
    expect(parseNum('-2 3/4')).toBe(-2.75);
    expect(typed([' ', '5'])).toBe('5'); // not at the start
    expect(typed(['5', ' ', ' ', '1'])).toBe('5 1'); // not twice
    expect(typed(['0', '.', '5', ' '])).toBe('0.5'); // not after a decimal
    expect(typed(['5', ' ', '1', '/', '3', 'del', 'del', 'del', 'del'])).toBe('5');
    expect(typed(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])).toBe('123456789'); // nine characters at most
  });
});
