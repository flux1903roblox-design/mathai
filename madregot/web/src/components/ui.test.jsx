// The shared pieces of STUDENT-15, rendered to HTML: the Button's busy and done states (A1), Segmented and Progress on
// Base UI with the app's existing classes (B3, B8). Interaction (Tab stops, arrows in right-to-left) is in
// e2e/ui-kit.spec.js; here, what each one puts in the page.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Button, Segmented, Progress, Choices, Choice } from './ui.jsx';

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
  it('a locked card is announced as unavailable and marked, the others are plain radios', () => {
    const out = html(
      <Choices value="sky" labelledBy="h" locked={['gold']} className="wardrobe-grid">
        <Choice value="sky" className="wardrobe-opt">כחול</Choice>
        <Choice value="gold" locked className="wardrobe-opt is-locked" describedBy="why-gold">זהב</Choice>
      </Choices>,
    );
    expect(out).toMatch(/role="radiogroup" aria-labelledby="h"/);
    const [sky, gold] = [...out.matchAll(/<span[^>]*role="radio"[^>]*>/g)].map((m) => m[0]);
    expect(sky).toContain('aria-checked="true"');
    expect(sky).not.toContain('aria-disabled');
    expect(gold).toContain('aria-disabled="true"');
    expect(gold).toContain('data-locked="true"');
    expect(gold).toContain('aria-describedby="why-gold"');
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
