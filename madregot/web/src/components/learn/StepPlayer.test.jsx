// A wrong guess gets two short lines, not a paragraph (PRODUCT2-41, the council's painful moment #3): what the guess
// missed and why, in one short line, and the rest behind "עוד", a button with aria-expanded. Every predict step of every
// stair is checked: its first line fits two lines on a 320px phone. Rendered to HTML, as missFeedback.test.jsx does.
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadAllContent } from '@/learn/content/index.ts';
import { mathPlain } from '@/components/MathText.jsx';
import { leadOf, LEAD_MAX } from '@/components/MoreText.jsx';
import { WrongGuess } from './StepPlayer.jsx';

let C;
beforeAll(async () => { C = await loadAllContent(); });
const text = (h) => h.replace(/<[^>]+>/g, '');

describe('the wrong-guess sheet', () => {
  it('shows one short line and keeps the rest behind "עוד", closed', () => {
    const step = C['signed:2'].discover.find((s) => s.kind === 'predict' && s.wrongWhy && Object.values(s.wrongWhy).some((w) => mathPlain(w).length > LEAD_MAX.sheet));
    expect(step, 'a predict step with a long wrong-guess line').toBeTruthy();
    const chosen = Number(Object.keys(step.wrongWhy).find((k) => mathPlain(step.wrongWhy[k]).length > LEAD_MAX.sheet));
    const out = renderToStaticMarkup(<WrongGuess step={step} chosen={chosen} />);
    const lead = text(out.match(/<span class="more-lead">([\s\S]*?)<\/span><span id=/)[1]);
    expect(lead.length).toBeLessThanOrEqual(LEAD_MAX.sheet + 1);
    expect(out).toMatch(/<span id="[^"]+" class="more-rest" hidden="">/);
    expect(out).toMatch(/<button type="button" class="link-btn more-btn"[^>]* aria-expanded="false" aria-controls="[^"]+">עוד<\/button>/);
    // nothing is lost: the rest holds the end of the guess's line and the explanation itself
    const rest = out.slice(out.indexOf('class="more-rest"'), out.indexOf('<button'));
    expect(text(rest.replace(/^[^>]*>/, '')).trim().length).toBeGreaterThan(20);
  });

  it('every wrong guess of every stair starts with a line that fits two lines on a 320px phone', () => {
    let n = 0;
    for (const [skill, c] of Object.entries(C)) {
      for (const st of c?.discover || []) {
        if (st.kind !== 'predict') continue;
        for (const k of Object.keys(st.wrongWhy || { x: 1 })) {
          const { lead } = leadOf(`${st.wrongWhy?.[k] || ''} ${st.why}`.trim(), LEAD_MAX.sheet);
          expect(mathPlain(lead).length, `${skill}: ${lead}`).toBeLessThanOrEqual(LEAD_MAX.sheet + 1);
          n += 1;
        }
      }
    }
    expect(n).toBeGreaterThan(300);
  });
});
