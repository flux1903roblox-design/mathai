// The student council's review found two continuations with practice and no teaching: ח׳'s angles between parallel lines
// (angles:4, unit 8.3: angles written with x, the converse, a helper line through a point between the lines) and
// Pythagoras in two steps (pyth:4). Each now has a rule card in stage A and worked examples in stage B. ז׳ learns angles:4
// in September to November, months before its equations, so the angles steps show only where the continuation's
// questions are drawn (content/learner.js grade8Kinds): never to a learner known to be in ז׳, always to one in ח׳ or of
// no known grade. Pythagoras' two steps are drawn in every grade, and so is their teaching.
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
// @ts-ignore: react-dom has no type declarations here
import { renderToStaticMarkup } from 'react-dom/server';
import { contentOf, loadAllContent } from './content/index';
import type { DiscoverStep, FigSpec, StairContent, WorkedExample } from './types';
// @ts-ignore: plain JS
import { setLearnerGrade, GRADE8_TEACHING } from '@/content/learner.js';
// @ts-ignore: plain JS
import { useApp } from '@/lib/store.js';
// @ts-ignore: plain JS
import Figure from '@/components/Figure.jsx';
// @ts-ignore: plain JS
import { geoClashes } from '@/components/geoLayout.js';

const CONTENT = await loadAllContent();
afterEach(() => setLearnerGrade(null));

type Grade = '7' | '8' | null;
/** What a learner of this grade is shown of a stair's stages A and B. */
function seen(skill: string, grade: Grade) {
  setLearnerGrade(grade);
  try { const c = contentOf(skill)!; return { discover: c.discover, examples: c.examples }; } finally { setLearnerGrade(null); }
}
/** Every drawing of some steps and worked examples: the step's, the problem's and each example step's. */
const figsOf = (steps: DiscoverStep[], examples: WorkedExample[]) => [
  ...steps.map((s) => (s as { fig?: FigSpec }).fig), ...examples.flatMap((ex) => [ex.fig, ...ex.steps.map((s) => s.fig)]),
].filter(Boolean) as FigSpec[];

describe('angles:4, ח׳\'s continuation: shown to ח׳ and to an unknown grade, never to ז׳', () => {
  const z = seen('angles:4', '7');
  const h = seen('angles:4', '8');
  const more = { discover: h.discover.slice(z.discover.length), examples: h.examples.slice(z.examples.length) };

  it('ח׳ sees the stair\'s own steps first, then a rule card and worked examples of the continuation', () => {
    expect(h.discover.slice(0, z.discover.length)).toEqual(z.discover);
    expect(h.examples.slice(0, z.examples.length)).toEqual(z.examples);
    expect(more.discover.length).toBeGreaterThanOrEqual(1);
    expect(more.discover.every((s) => s.kind === 'rule')).toBe(true);
    expect(more.examples.length).toBeGreaterThanOrEqual(1);
    // what they teach: an equation from angles written with x, the converse, and the helper line through E
    const rules = more.discover.map((s) => `${s.text} ${'display' in s ? s.display || '' : ''}`).join(' ');
    expect(rules).toMatch(/\$x\$/);
    expect(rules).toMatch(/להפך/);
    expect(rules).toMatch(/ישר עזר/);
    expect(more.examples.some((ex) => /\dx [+-] \d+/.test(ex.problem) && ex.vars?.x != null)).toBe(true);
    expect(more.examples.some((ex) => /\$E\$/.test(ex.problem) && ex.steps.some((s) => /ישר עזר/.test(s.action)))).toBe(true);
  });

  it('a ז׳ learner never sees them, in stage A, in stage B or in the count of either', () => {
    const shown = new Set<unknown>([...z.discover, ...z.examples]);
    expect([...more.discover, ...more.examples].filter((s) => shown.has(s))).toEqual([]);
    expect(JSON.stringify(z)).not.toMatch(/ישר עזר|בכיתה ח׳/);
    // the stage's length is what the stair page counts and what the screen walks (screens/Journey.jsx, Teach.jsx)
    expect(z.discover.length).toBeLessThan(h.discover.length);
    expect(z.examples.length).toBeLessThan(h.examples.length);
  });

  it('a learner of no known grade (a guest, a teacher with no class grade, a test) sees them, as ח׳ does', () => {
    const n = seen('angles:4', null);
    expect(n.discover).toBe(h.discover);
    expect(n.examples).toBe(h.examples);
  });

  it('follows the profile: the store sets the grade, and the same stair object answers for the new grade', () => {
    const c = contentOf('angles:4')!;
    const was = useApp.getState().profile;
    try {
      useApp.setState({ profile: { ...(was || {}), role: 'student', grade: '7' } });
      expect(c.discover).toBe(z.discover);
      expect(c.examples).toBe(z.examples);
      useApp.setState({ profile: { ...(was || {}), role: 'student', grade: '8' } });
      expect(c.discover).toBe(h.discover);
      expect(c.examples).toBe(h.examples);
    } finally { useApp.setState({ profile: was }); }
  });

  it('gives a screen the same arrays on every read, so nothing renders again for nothing', () => {
    expect(seen('angles:4', '8').discover).toBe(h.discover);
    expect(seen('angles:4', '7').examples).toBe(z.examples);
  });

  it('only the stairs content/learner.js GRADE8_TEACHING lists change with the grade (e2e/teach-all.spec.js walks them as ח׳)', () => {
    const differ = (Object.values(CONTENT) as StairContent[]).map((c) => c.skill)
      .filter((s) => { const a = seen(s, '7'); const b = seen(s, '8'); return a.discover !== b.discover || a.examples !== b.examples; });
    expect(differ).toEqual([...GRADE8_TEACHING]);
  });

  it('draws the continuation readably: every drawing renders, and no label sits on another, on a line or off the edge', () => {
    const figs = figsOf(more.discover, more.examples);
    expect(figs.length).toBeGreaterThanOrEqual(more.discover.length + more.examples.length);
    for (const f of figs) {
      expect(renderToStaticMarkup(createElement(Figure, { fig: f })), f.type).not.toMatch(/NaN|undefined|Infinity/);
      if (f.type === 'geo') expect(geoClashes(f), (f as { label?: string }).label).toEqual([]);
    }
  });
});

describe('pyth:4 teaches Pythagoras in two steps', () => {
  /** The example of a triangle split by its height: AB, BD and DC given, AC asked. */
  const twoStep = (examples: WorkedExample[]) => examples.find((ex) => /AB = \d+/.test(ex.problem) && /BD = \d+/.test(ex.problem) && /DC = \d+/.test(ex.problem) && /AC/.test(ex.problem));

  it('has a worked example that finds the common side in one right triangle, then uses it in the other', () => {
    const ex = twoStep(contentOf('pyth:4')!.examples);
    expect(ex, 'the two-step example').toBeTruthy();
    const [ab, bd, dc] = ['AB', 'BD', 'DC'].map((s) => Number(new RegExp(`${s} = (\\d+)`).exec(ex!.problem)![1]));
    const ad = Math.sqrt(ab ** 2 - bd ** 2);
    expect(ex!.answer).toBeCloseTo(Math.sqrt(ad ** 2 + dc ** 2), 9);
    // step 1 finds AD in ABD; a later step puts it into AC² in ADC
    const at = ex!.steps.findIndex((s) => new RegExp(`AD = (\\\\sqrt\\{\\d+\\} = )?${ad}$`).test(s.result));
    expect(at, 'a step finds AD').toBeGreaterThanOrEqual(0);
    expect(ex!.steps.slice(at + 1).some((s) => s.result.startsWith(`AC^2 = ${ad}^2 + ${dc}^2`))).toBe(true);
    // its drawing marks AC '?' and writes AD once it is found
    const label = (f: FigSpec | undefined, a: string, b: string) => ((f as { segs?: { a: string; b: string; label?: string }[] })?.segs || []).find((s) => s.a === a && s.b === b)?.label;
    expect(label(ex!.fig, 'A', 'C')).toBe('?');
    expect(label(ex!.fig, 'A', 'D')).toBeUndefined();
    expect(label(ex!.steps[at].fig, 'A', 'D')).toBe(String(ad));
  });

  it('states the two steps in a rule card in stage A', () => {
    expect(contentOf('pyth:4')!.discover.some((s) => s.kind === 'rule' && /שני שלבים/.test(s.text) && /שלב 1/.test(s.text) && /שלב 2/.test(s.text))).toBe(true);
  });

  it('teaches them in every grade, as practice draws them in every grade', () => {
    for (const grade of ['7', '8', null] as Grade[]) expect(twoStep(seen('pyth:4', grade).examples), String(grade)).toBeTruthy();
  });
});
