// Every stair's teaching content is checked mathematically, not only for shape:
// worked examples step by step, guided problems, interactive goals, the diagnostic models and their
// misconception predictions. A stair added to the registry is covered without writing new tests.
import { describe, it, expect } from 'vitest';
import { CONTENT } from './content/index';
import type { DiscoverStep, DiagModel, StairContent } from './types';
import { evaluate, same, seeded } from './expr';
import { discriminating, diagnose } from './misconceptions';
import { ALL_SKILLS } from './skills';
// @ts-ignore: plain JS
import { manipCorrect, manipSolution } from '@/content/manip.js';
// @ts-ignore: plain JS
import { TOPIC } from '@/content/index.js';
// @ts-ignore: plain JS
import { T } from '@/content/util.js';

const stairs = Object.values(CONTENT) as StairContent[];
const DRAWS = 400;

function checkSteps(steps: DiscoverStep[], where: string) {
  steps.forEach((s, i) => {
    const at = `${where} step ${i + 1}`;
    expect(s.text, at).toBeTruthy();
    if (s.kind === 'predict') {
      expect(s.choices.length, at).toBeGreaterThanOrEqual(2);
      expect(s.answer, at).toBeGreaterThanOrEqual(0);
      expect(s.answer, at).toBeLessThan(s.choices.length);
      expect(new Set(s.choices).size, `${at}: duplicate choices`).toBe(s.choices.length);
      expect(s.why, at).toBeTruthy();
    }
    if (s.kind === 'explore') {
      const it = { form: 'manip', manip: s.manip, answer: s.answer };
      // the goal is a state the object can reach, and reaching it counts as right
      expect(manipCorrect(it, manipSolution(it)), `${at}: goal not reachable`).toBe(true);
      // the starting state is not already the answer (the student has to move something)
      if (s.manip.kind === 'numberline') {
        const m = s.manip as unknown as { min: number; max: number; start: number };
        expect(s.answer as number, at).toBeGreaterThanOrEqual(m.min);
        expect(s.answer as number, at).toBeLessThanOrEqual(m.max);
        expect(m.start, `${at}: starts on the answer`).not.toBe(s.answer);
        // the expression shown is the movement asked for
        if (s.display && /^[-+0-9 ()]+$/.test(s.display)) expect(same(evaluate(s.display), s.answer as number), `${at}: ${s.display}`).toBe(true);
      }
      // a point goal must be on the drawn grid: the tool clamps every move to it, so a goal off the grid can never be reached
      if (s.manip.kind === 'plot') {
        const r = ((s.manip as { range?: number }).range) || 6;
        const [x, y] = s.answer as [number, number];
        expect(Math.abs(x) <= r && Math.abs(y) <= r, `${at}: goal (${x}, ${y}) is off the ${r}-grid`).toBe(true);
      }
      expect(s.hint, at).toBeTruthy();
      expect(s.success, at).toBeTruthy();
    }
    if (s.kind === 'rule') expect(s.why, at).toBeTruthy();
  });
}

function checkModel(model: DiagModel<any>, c: StairContent, name: string) {
  const rnd = seeded(c.level * 1000 + c.topic.length);
  const fired: Record<string, number> = {};
  for (let i = 0; i < DRAWS; i += 1) {
    const p = model.params(rnd);
    const ans = model.answer(p);
    const at = `${c.skill} ${name} ${JSON.stringify(p)}`;
    expect(Number.isFinite(ans), at).toBe(true);
    expect(model.text(p), at).toBeTruthy();
    expect(model.hint(p), at).toBeTruthy();
    const sol = model.solution(p);
    expect(sol.length, at).toBeGreaterThan(0);
    // the worked solution ends at the same answer the checker accepts
    expect(sol.join(' ').includes(String(T(ans))) || sol.join(' ').includes(String(ans)), `${at}: solution does not reach ${ans}`).toBe(true);
    Object.entries(model.bugs).forEach(([id, f]) => {
      const v = f(p);
      if (v != null && Number.isFinite(v) && !same(v, ans)) fired[id] = (fired[id] || 0) + 1;
    });
  }
  // every misconception in the model shows on a fair share of questions (otherwise it can never be diagnosed)
  Object.keys(model.bugs).forEach((id) => expect(fired[id] || 0, `${c.skill} ${name}: bug ${id} never shows`).toBeGreaterThan(DRAWS * 0.04));
  // every pair of misconceptions can be told apart by some question
  const ids = Object.keys(model.bugs);
  ids.forEach((x, i) => ids.slice(i + 1).forEach((y) => {
    const p = discriminating(model, [x, y], seeded(7), 2000);
    expect(p, `${c.skill} ${name}: ${x} and ${y} cannot be told apart`).not.toBeNull();
  }));
}

describe('the content registry', () => {
  it('has only real stairs, each once', () => {
    stairs.forEach((c) => {
      expect(ALL_SKILLS).toContain(c.skill);
      expect(c.skill).toBe(`${c.topic}:${c.level}`);
      expect(c.title).toBe(TOPIC[c.topic].levels[c.level - 1].title);
    });
  });
  it('does not repeat one template across stairs', () => {
    const ideas = stairs.map((c) => c.idea);
    expect(new Set(ideas).size).toBe(ideas.length);
    const whys = stairs.map((c) => c.why.join(' '));
    expect(new Set(whys).size).toBe(whys.length);
  });
});

describe.each(stairs.map((c) => [c.skill, c] as const))('stair %s', (_id, c) => {
  it('has a complete journey', () => {
    expect(c.objectives.length).toBeGreaterThanOrEqual(2);
    expect(c.idea).toBeTruthy();
    expect(c.why.length).toBeGreaterThanOrEqual(1);
    expect(c.alt.length).toBeGreaterThanOrEqual(1);
    expect(c.discover.length).toBeGreaterThanOrEqual(4);
    expect(c.discover.some((s) => s.kind === 'predict')).toBe(true);
    expect(c.discover.some((s) => s.kind === 'rule')).toBe(true);
    expect(c.examples.length).toBeGreaterThanOrEqual(2);
    expect(c.together.length).toBeGreaterThanOrEqual(1);
    expect(c.misconceptions.length).toBeGreaterThanOrEqual(2);
  });

  it('teaches with steps that are valid and reachable', () => {
    checkSteps(c.discover, 'discover');
    c.misconceptions.forEach((m) => { expect(m.remedy.length, m.id).toBeGreaterThan(0); checkSteps(m.remedy, `remedy ${m.id}`); });
  });

  it('works its examples correctly, step by step', () => {
    c.examples.forEach((ex, k) => {
      expect(same(evaluate(ex.check), ex.answer), `example ${k + 1}: ${ex.check} ≠ ${ex.answer}`).toBe(true);
      expect(ex.steps.length, `example ${k + 1}`).toBeGreaterThanOrEqual(2);
      ex.steps.forEach((s, i) => {
        const at = `example ${k + 1} step ${i + 1}`;
        expect(s.action, at).toBeTruthy(); expect(s.why, at).toBeTruthy(); expect(s.result, at).toBeTruthy();
        if (s.value) expect(same(evaluate(s.value), ex.answer), `${at}: ${s.value} ≠ ${ex.answer}`).toBe(true);
        if (s.calc) expect(same(evaluate(s.calc.expr), s.calc.value), `${at}: ${s.calc.expr} ≠ ${s.calc.value}`).toBe(true);
      });
    });
  });

  it('solves together with one right move per step and growing hints', () => {
    c.together.forEach((g, k) => {
      g.steps.forEach((s, i) => {
        const at = `together ${k + 1} step ${i + 1}`;
        expect(s.choices.filter((x) => x.ok).length, at).toBe(1);
        expect(s.choices.length, at).toBeGreaterThanOrEqual(2);
        s.choices.forEach((x) => expect(x.feedback, at).toBeTruthy());
        expect(s.hints[0] && s.hints[1] && s.hints[0] !== s.hints[1], at).toBeTruthy();
      });
      expect(same(evaluate(g.final.check), g.final.answer), `together ${k + 1}: ${g.final.check} ≠ ${g.final.answer}`).toBe(true);
    });
  });

  it('diagnoses with a model whose predictions are real, reachable and distinguishable', () => {
    checkModel(c.diag, c, 'diag');
    if (c.transfer) checkModel(c.transfer, c, 'transfer');
  });

  it('explains every misconception its models can find', () => {
    const explained = new Set(c.misconceptions.map((m) => m.id));
    [c.diag, c.transfer].filter(Boolean).forEach((model) => Object.keys(model!.bugs).forEach((id) => expect(explained.has(id), `bug ${id} has no explanation`).toBe(true)));
    // and the board can name it
    c.misconceptions.forEach((m) => expect((TOPIC[c.topic].cats as Record<string, string>)[m.id], `cats.${m.id} missing in the topic`).toBeTruthy());
  });

  it('diagnoses its own predictions back', () => {
    const rnd = seeded(99);
    for (let i = 0; i < 100; i += 1) {
      const p = c.diag.params(rnd);
      Object.entries(c.diag.bugs).forEach(([id, f]) => {
        const v = f(p);
        if (v == null || same(v, c.diag.answer(p))) return;
        const d = diagnose(c.diag, p, v);
        expect(d.kind).toBe('misconception');
        if (d.kind === 'misconception') expect(d.candidates.map((x) => x.id)).toContain(id);
      });
    }
  });
});
