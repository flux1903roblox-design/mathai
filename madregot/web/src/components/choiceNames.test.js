// A choice whose text is maths gets its accessible name from mathPlain (StepPlayer, Together, the challenge parts): the
// maths said as plain words. A TeX command it does not know would be read out by name ("lvert -9 rvert",
// "sphericalangle BOC") in place of the bars or the angle sign. Every choice, line and prompt a student can pick or hear
// in the teaching (understand, the remedies, solving together) and in the challenges is checked: no command name of its
// TeX is left as a word in its spoken name.
import { describe, it, expect } from 'vitest';
import { loadAllContent } from '@/learn/content/index.ts';
import { CHALLENGES } from '@/learn/challenges/index.ts';
import { mathPlain, texText } from '@/components/MathText.jsx';

/** The command names of a text's TeX that its spoken name still says. */
function leftOver(text) {
  const said = mathPlain(text);
  const cmds = [...String(text).matchAll(/\\([a-zA-Z]+)/g)].map((m) => m[1]);
  return [...new Set(cmds.filter((c) => new RegExp(`(^|[^a-zA-Z])${c}([^a-zA-Z]|$)`).test(said)))];
}
/** Every string with maths in an object (a challenge part's choices, lines, steps and prompts). */
const strings = (x) => (typeof x === 'string' ? (x.includes('$') ? [x] : []) : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === 'object' ? Object.values(x).flatMap(strings) : []);
const textOf = (c) => (typeof c === 'string' ? c : c?.text || '');

describe('spoken names of maths say no TeX command', () => {
  it('the absolute value and the class\'s angle sign are said in words', () => {
    expect(texText('\\lvert -9 \\rvert')).toBe('הערך המוחלט של -9');
    expect(mathPlain('6 גדול יותר, ו־$\\lvert -9 \\rvert$ גדול יותר')).toBe('6 גדול יותר, ו־הערך המוחלט של -9 גדול יותר');
    expect(texText('\\sphericalangle BOC = 42^\\circ')).toBe('זווית BOC = 42°');
    expect(texText('\\angle A + \\angle B')).toBe('זווית A + זווית B');
  });
  it('every choice in the teaching and every line of a challenge', async () => {
    const C = await loadAllContent();
    const bad = [];
    const visit = (where, s) => { const left = leftOver(s); if (left.length) bad.push(`${where}: ${left.join(', ')} in "${mathPlain(s).slice(0, 80)}"`); };
    for (const [skill, c] of Object.entries(C) ) {
      const steps = [...(c.discover || []), ...(c.misconceptions || []).flatMap((m) => m.remedy || [])];
      steps.forEach((st, i) => (st.choices || []).forEach((ch) => visit(`${skill} step ${i + 1}`, textOf(ch))));
      (c.together || []).forEach((t, i) => (t.steps || []).forEach((st) => (st.choices || []).forEach((ch) => visit(`${skill} together ${i + 1}`, textOf(ch)))));
    }
    for (const t of CHALLENGES) strings(t.parts).forEach((s) => visit(t.id, s));
    expect(bad).toEqual([]);
  });
});
