// The challenge track (CURRICULUM-6): every task is checked mathematically and for its wording, every topic has at least
// one claim, one error or proof and one literacy task (stage 1's 36 were three each; later stages add their own, the data
// and probability units three each, the classroom lane signed:c4 (CLASSROOM-4), signed:c5 (CLASSROOM-5) and expr:c4
// (CLASSROOM-6), curriculum stage 4's geometry units three each (transf:c1-c3, congr:c1-c3, sim:c1-c3, GEOM-7), so the
// count is computed), and the grading rules (two tries, XP, the order check, the counterexample check) are pinned.
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import type { ChallengePart, ChallengeTask } from './types';
import { CHALLENGES as META_LIST, challengeById, challengesAfter, challengesOf } from './challenges/index';
// the tasks with their parts (the registry keeps only their meta for the first load)
import { CHALLENGE_TASKS as CHALLENGES, taskById } from './challenges/all';
// @ts-ignore: plain JS
import { taskMeta } from '../../scripts/gen-content-meta.mjs';
import { challengeXP, scoredParts, numCheck, exampleHolds, domainValues, firstOutOfPlace, shuffledOrder, moveStep } from './challenges/grade';
import { ALL_SKILLS, TOPIC_ORDER, parseSkill } from './skills';
import { evaluate, same } from './expr';
import { contentOf, loadAllContent } from './content/index';
// @ts-ignore: plain JS
import { PROOFS, PROOF, LETTER_SETS, proofIn } from '@/content/proofs.js';

// every topic's teaching content, loaded once (the durable lane's split, DURABLE-11: topics load on demand)
await loadAllContent();

type Claim = Extract<ChallengePart, { type: 'claim' }>;
type Order = Extract<ChallengePart, { type: 'order' }>;

/** Every piece of text a task shows (titles, stories, prompts, choices, lines, steps, reasons, rubrics, samples). */
function texts(t: ChallengeTask): string[] {
  const out = [t.title, t.story || ''];
  t.parts.forEach((p) => {
    out.push(p.prompt);
    if (p.type === 'num') out.push(...p.solution);
    if (p.type === 'mc') p.choices.forEach((c) => out.push(c.text, c.feedback));
    if (p.type === 'claim') { out.push(p.claim, p.why); if (p.example) out.push(p.example.ask, p.example.hint, ...p.example.slots.map((s) => s.label)); }
    if (p.type === 'order') p.steps.forEach((s) => out.push(s.text, ...(s.reason?.choices || [])));
    if (p.type === 'error') out.push(...p.lines, p.why, p.fix.prompt);
    if (p.type === 'explain') out.push(...p.rubric, p.sample);
  });
  return out.filter(Boolean);
}
const tex = (s: string) => (s.match(/\$([^$]+)\$/g) || []).map((m) => m.slice(1, -1));
const outsideTex = (s: string) => s.replace(/\$[^$]+\$/g, ' ');

// A unit whose stairs are still landing in this build round (stage5.md FUNC-7): its tasks come after its last stair,
// so until then it may have fewer than one of each kind. Empty when every unit is whole: the functions unit (func) has
// its four stairs and its three tasks, so every topic now has all three kinds.
const PENDING_CHALLENGES = new Set<string>([]);

describe('the challenge tasks', () => {
  it('the first load knows each task without its story and parts (meta.gen.ts): the same tasks, in the same order', () => {
    expect(META_LIST.map((t) => t.id)).toEqual(CHALLENGES.map((t) => t.id));
    for (const t of CHALLENGES) expect(challengeById(t.id)).toEqual({ id: t.id, topic: t.topic, after: t.after, kind: t.kind, title: t.title, minutes: t.minutes, ...(t.misc ? { misc: t.misc } : {}) });
    expect(META_LIST.some((t) => 'parts' in t || 'story' in t)).toBe(false);
    // the meta is what the generator writes of each whole task, in the same order (scripts/gen-content-meta.mjs taskMeta)
    expect(META_LIST).toEqual(CHALLENGES.map(taskMeta));
    expect(challengeById('congr:c2')).toEqual(taskMeta(taskById('congr:c2')));
    expect(challengeById('nope')).toBeNull();
    for (const t of META_LIST) expect(Object.keys(t).filter((k) => ['story', 'fig', 'parts'].includes(k)), t.id).toEqual([]);
    expect(taskById('func:c2')?.parts.length).toBeGreaterThan(0);
    expect(taskById('prob:c2')?.parts).toHaveLength(2);
    expect(taskById('nope')).toBeNull();
  });
  it('every topic of TOPIC_ORDER has its tasks, the bridge included, numbered c1, c2, … and in topic order', () => {
    console.log(`${CHALLENGES.length} challenge tasks:\n${TOPIC_ORDER.map((tp) => `  ${tp}: ${challengesOf(tp).map((t) => `${t.id} ${t.kind} after ${t.after}`).join(' · ')}`).join('\n')}`);
    // the count is the topics' tasks, every one of them in a topic of TOPIC_ORDER
    expect(CHALLENGES).toHaveLength(TOPIC_ORDER.reduce((n, tp) => n + challengesOf(tp).length, 0));
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(42);
    TOPIC_ORDER.forEach((tp) => {
      const ids = challengesOf(tp).map((t) => t.id);
      if (!PENDING_CHALLENGES.has(tp)) expect(ids.length, tp).toBeGreaterThanOrEqual(3);
      expect(ids, tp).toEqual(ids.map((_, i) => `${tp}:c${i + 1}`));
    });
    PENDING_CHALLENGES.forEach((tp) => expect(TOPIC_ORDER, `${tp}: a pending unit is a real one`).toContain(tp));
    // curriculum stage 3 (DATA-7): data's three and probability's three
    expect(challengesOf('data').map((t) => [t.id, t.kind, t.after])).toEqual([['data:c1', 'literacy', 'data:3'], ['data:c2', 'claim', 'data:2'], ['data:c3', 'error', 'data:4']]);
    // DATA-7: a claim with no "לכל" (two plain sentences), Danny's unordered pairs, the Ministry's rain table
    expect(challengesOf('prob').map((t) => [t.id, t.kind, t.after])).toEqual([['prob:c1', 'claim', 'prob:1'], ['prob:c2', 'error', 'prob:3'], ['prob:c3', 'literacy', 'prob:2']]);
    // the classroom lane (CLASSROOM-4, -5): signed:c4 and signed:c5, the second task of a kind its topic already has
    expect(challengesOf('signed').map((t) => t.id)).toEqual(['signed:c1', 'signed:c2', 'signed:c3', 'signed:c4', 'signed:c5']);
    expect(challengesAfter('signed:7').map((t) => t.id)).toEqual(['signed:c5']);
    // stage 2 (MEASURE-7): its four units have three tasks each, a claim, an error and a real-world task
    for (const tp of ['area', 'solid', 'circle', 'space'] as const) expect(challengesOf(tp).map((t) => t.id), tp).toEqual([`${tp}:c1`, `${tp}:c2`, `${tp}:c3`]);
    // curriculum stage 4 (GEOM-7): the transformations, congruence and similarity have three each
    expect(challengesOf('transf').map((t) => [t.id, t.kind, t.after])).toEqual([['transf:c1', 'claim', 'transf:3'], ['transf:c2', 'error', 'transf:3'], ['transf:c3', 'literacy', 'transf:4']]);
    expect(challengesOf('congr').map((t) => t.id)).toEqual(['congr:c1', 'congr:c2', 'congr:c3']);
    expect(challengesOf('sim').map((t) => [t.id, t.kind, t.after])).toEqual([['sim:c1', 'claim', 'sim:2'], ['sim:c2', 'proof', 'sim:1'], ['sim:c3', 'literacy', 'sim:4']]);
    expect(TOPIC_ORDER).toContain('frac');
    expect(CHALLENGES.map((t) => t.topic)).toEqual(TOPIC_ORDER.flatMap((tp) => challengesOf(tp).map(() => tp)));
    expect(challengeById('pct:c1')?.after).toBe('pct:2');
    expect(challengeById('nope')).toBeNull();
    expect(challengesAfter('ratio:2').map((t) => t.id)).toEqual(['ratio:c1']);
    expect(challengesAfter('expr:4').map((t) => t.id)).toEqual(['expr:c1', 'expr:c2']);
    expect(challengesAfter('expr:3').map((t) => t.id)).toEqual(['expr:c4']);
    // stage 2 (MEASURE-7): the claim after area:5, CLASSROOM-13's error after area:2, the deck after area:4
    expect(['area:c1', 'area:c2', 'area:c3'].map((id) => [challengeById(id)?.kind, challengeById(id)?.after])).toEqual([['claim', 'area:5'], ['error', 'area:2'], ['literacy', 'area:4']]);
    // and boxes and prisms: the half box after solid:2, the three faces after solid:1, the litre carton after solid:2
    expect(['solid:c1', 'solid:c2', 'solid:c3'].map((id) => [challengeById(id)?.kind, challengeById(id)?.after])).toEqual([['claim', 'solid:2'], ['error', 'solid:1'], ['literacy', 'solid:2']]);
    expect(challengeById('solid:c2')!.misc).toBe('three-faces');
    expect((taskById('solid:c3')!.parts[0] as { answer: number }).answer).toBe(40);
    // and the circle: the doubled radius after circle:2, the slant as the height after circle:4, the honey jars after
    // circle:3; every part "with π" (and circle:c2's fix) asks the number before π
    expect(['circle:c1', 'circle:c2', 'circle:c3'].map((id) => [challengeById(id)?.kind, challengeById(id)?.after])).toEqual([['claim', 'circle:2'], ['error', 'circle:4'], ['literacy', 'circle:3']]);
    expect(challengeById('circle:c2')!.misc).toBe('slant-as-height');
    const err = taskById('circle:c2')!.parts[0] as { fix: { answer: number; after?: string } };
    expect([err.fix.answer, err.fix.after]).toEqual([100, '\\pi']);
    for (const id of ['circle:c1', 'circle:c3']) {
      const nums = taskById(id)!.parts.filter((p) => p.type === 'num') as { prompt: string; answer: number; after?: string }[];
      expect(nums.length, id).toBe(2);
      nums.forEach((p) => { expect(p.after, `${id}: ${p.prompt}`).toBe('\\pi'); expect(p.prompt).toContain('\\pi'); expect(Number.isInteger(p.answer)).toBe(true); });
    }
    // and Pythagoras in space: the box's diagonal against its faces' after space:1, the radius as the section's width
    // after space:2, the ant on the box after space:1 (its unfolded walk 10 against 8.4 through the air)
    expect(['space:c1', 'space:c2', 'space:c3'].map((id) => [challengeById(id)?.kind, challengeById(id)?.after])).toEqual([['claim', 'space:1'], ['error', 'space:2'], ['literacy', 'space:1']]);
    expect(challengeById('space:c2')!.misc).toBe('r-for-d');
    expect((taskById('space:c2')!.parts[0] as { fix: { answer: number } }).fix.answer).toBe(20);
    const ant = taskById('space:c3')!;
    expect(ant.parts.filter((p) => p.type === 'num').map((p) => (p as { answer: number }).answer)).toEqual([8.4, 10]);
    // MEASURE-7: the box's net (a netfig), its front face and lid shaded, and the straight way across them, 0,0 to 6,8
    expect(ant.fig).toMatchObject({ type: 'netfig', solid: 'box', dims: { a: 6, b: 5, c: 3 }, shade: ['B', 'E'], path: { from: [0, 0], to: [6, 8] } });
    const { from, to } = (ant.fig as { path: { from: number[]; to: number[] } }).path;
    expect(Math.hypot(to[0] - from[0], to[1] - from[1])).toBe(10);
  });

  it('each topic has at least one claim, one error or proof, and one literacy task', () => {
    TOPIC_ORDER.filter((tp) => !PENDING_CHALLENGES.has(tp)).forEach((tp) => {
      const kinds = challengesOf(tp).map((t) => t.kind);
      expect(kinds.filter((k) => k === 'claim').length, tp).toBeGreaterThanOrEqual(1);
      expect(kinds.filter((k) => k === 'error' || k === 'proof').length, tp).toBeGreaterThanOrEqual(1);
      expect(kinds.filter((k) => k === 'literacy').length, tp).toBeGreaterThanOrEqual(1);
    });
    // a task's kind is what its parts do: a claim task has a claim part, an error task an error part, a proof an order
    CHALLENGES.forEach((t) => {
      const types = t.parts.map((p) => p.type);
      if (t.kind === 'claim') expect(types, t.id).toContain('claim');
      if (t.kind === 'error') expect(types, t.id).toContain('error');
      if (t.kind === 'proof') expect(types, t.id).toContain('order');
      if (t.kind === 'literacy') expect(t.story, `${t.id}: a real-world task has its story`).toBeTruthy();
    });
  });

  it('the algebra tasks are the spec\'s, and a task\'s mistake is one the content names', () => {
    const algebra = CHALLENGES.filter((t) => ['expr', 'eq', 'sys'].includes(t.topic));
    // eq:c4, the race of three legs, follows the motion problems (eq:6; stage5.md FUNC-7.4)
    expect(algebra.map((t) => [t.id, t.kind, t.after, t.minutes])).toEqual([
      ['expr:c1', 'claim', 'expr:4', 4], ['expr:c2', 'error', 'expr:4', 4], ['expr:c3', 'literacy', 'expr:2', 7],
      ['expr:c4', 'error', 'expr:3', 4],
      ['eq:c1', 'claim', 'eq:3', 4], ['eq:c2', 'error', 'eq:2', 4], ['eq:c3', 'literacy', 'eq:5', 8], ['eq:c4', 'literacy', 'eq:6', 8],
      ['sys:c1', 'claim', 'sys:2', 4], ['sys:c2', 'error', 'sys:2', 5], ['sys:c3', 'literacy', 'sys:4', 8],
    ]);
    // the spec names the mistake of each error task
    expect(['expr:c2', 'eq:c2', 'sys:c2', 'expr:c4'].map((id) => challengeById(id)!.misc)).toEqual(['partial-dist', 'move-no-flip', 'move-no-flip', 'drop-minus']);
    // expr:c4 (CLASSROOM-6): the minus lost when -7x moves to its family; the right families cancel to 0x - 2 = -2, and
    // the wrong line, 14x - 2, gives 12 at x = 1
    const e4 = taskById('expr:c4')!.parts[0] as Extract<ChallengePart, { type: 'error' }>;
    expect([e4.wrong, e4.fix.answer, evaluate('-7*1 + 3 - 2*1 + 9*1 - 5'), evaluate('7*1 - 2*1 + 9*1 + 3 - 5'), evaluate('-7*(-2) + 3 - 2*(-2) + 9*(-2) - 5')]).toEqual([1, -2, -2, 12, -2]);
    expect(e4.lines).toEqual(['כנסו: $-7x + 3 - 2x + 9x - 5$', '$= 7x - 2x + 9x + 3 - 5$', '$= 14x - 2$']);
    // the signed tasks, the classroom lane's signed:c4 among them: the factor's minus lost, after brackets inside brackets
    expect(challengesOf('signed').map((t) => [t.id, t.kind, t.after, t.minutes, t.misc || null])).toEqual([
      ['signed:c1', 'claim', 'signed:1', 4, null], ['signed:c2', 'error', 'signed:1', 4, null], ['signed:c3', 'literacy', 'signed:3', 6, null],
      ['signed:c4', 'error', 'signed:5', 4, 'factor-sign'],
      ['signed:c5', 'claim', 'signed:7', 4, 'pow-odd-pos'],
    ]);
    // signed:c5: "a negative number to a power is positive" holds for an even exponent only, with the spec's examples
    // ((−2)³ = −8 is the notebook's own exercise, so it is not used), and an odd exponent is the counterexample
    const c5 = taskById('signed:c5')!.parts[0] as Claim;
    expect(c5.verdict).toBe('sometimes');
    expect([evaluate('(-6)^2'), evaluate('(-3)^3')]).toEqual([36, -27]);
    expect(c5.why).toContain('$(-6)^2 = (-6)(-6) = 36$');
    expect(c5.why).toContain('$(-3)^3 = (-3)(-3)(-3) = -27$');
    expect(c5.why).not.toMatch(/\(-2\)\^3/);
    expect([1, 3, 5].every((n) => exampleHolds(c5.example!, { n })) && ![2, 4].some((n) => exampleHolds(c5.example!, { n }))).toBe(true);
    const c4 = taskById('signed:c4')!.parts[0] as Extract<ChallengePart, { type: 'error' }>;
    expect([c4.wrong, c4.fix.answer, evaluate('-4[9 - (1 - 6)]')]).toEqual([2, -56, -56]);
    const named = new Set(ALL_SKILLS.flatMap((id) => contentOf(id)?.misconceptions.map((m) => m.id) || []));
    CHALLENGES.filter((t) => t.misc).forEach((t) => expect(named.has(t.misc!), `${t.id}: ${t.misc}`).toBe(true));
  });

  it('the functions unit\'s three tasks are the spec\'s (stage5.md FUNC-7; Critique notes 21 and 22)', () => {
    expect(PENDING_CHALLENGES.size, 'every unit is whole').toBe(0);
    expect(challengesOf('func').map((t) => [t.id, t.kind, t.after, t.minutes, t.misc ?? null])).toEqual([
      ['func:c1', 'claim', 'func:4', 4, 'from-zero'], ['func:c2', 'error', 'func:3', 4, 'rtl-read'], ['func:c3', 'literacy', 'func:4', 8, null],
    ]);
    // c1: "משתנה", so every whole start but 0 is a counterexample, cooling ones too; the hint's 8 is one, and 0 is not
    const c1 = taskById('func:c1')!.parts[0] as Claim;
    expect(c1.claim).toContain('משתנה');
    expect(c1.verdict).toBe('sometimes');
    expect(c1.example).toMatchObject({ domain: 'positive-int', expr: '40 - s', rel: '!=', value: 40 });
    expect(exampleHolds(c1.example!, { s: 8 })).toBe(true);
    expect(exampleHolds(c1.example!, { s: 0 })).toBe(false);
    // the expression is the temperature after 4 minutes from s at the start and 20 after 2, for every start 1..60
    for (let s = 1; s <= 60; s += 1) expect(same(evaluate(c1.example!.expr, { s }), s + 4 * ((20 - s) / 2)), `start ${s}`).toBe(true);
    const mc1 = taskById('func:c1')!.parts[1] as Extract<ChallengePart, { type: 'mc' }>;
    expect(mc1.choices.find((c) => c.ok)!.text).toBe('כשההתחלה $0^\\circ$');
    // c2: Tal's graph rises on 0 < x < 3 and falls on 3 < x < 8, read left to right; the wrong line says it rises there
    const c2 = taskById('func:c2')!;
    const pts = (c2.fig as { series: { pts: [number, number][] }[] }).series[0].pts;
    expect(pts).toEqual([[0, 1], [3, 7], [8, 2], [10, 2]]);
    const err = c2.parts[0] as Extract<ChallengePart, { type: 'error' }>;
    expect([err.wrong, err.fix.answer, err.fix.check]).toEqual([1, 3, '3-0']);
    expect(err.lines[1]).toContain('$3 < x < 8$');
    // c3: Yoav's ride; the average (11) is neither part's speed (18 and 12), so the last speed is not marked right
    const c3 = taskById('func:c3')!;
    const ride = (c3.fig as { series: { pts: [number, number][] }[] }).series[0].pts;
    expect(ride).toEqual([[0, 0], [20, 6], [35, 6], [60, 11]]);
    const speed = (a: [number, number], b: [number, number]) => ((b[1] - a[1]) / (b[0] - a[0])) * 60;
    const nums = c3.parts.filter((p): p is Extract<ChallengePart, { type: 'num' }> => p.type === 'num').map((p) => p.answer);
    expect(nums).toEqual([ride[2][0] - ride[1][0], speed(ride[0], ride[1]), (ride[3][1] / ride[3][0]) * 60]);
    expect([speed(ride[0], ride[1]), speed(ride[2], ride[3])]).toEqual([18, 12]);
    expect([18, 12]).not.toContain(nums[2]);
    const mc3 = c3.parts.find((p) => p.type === 'mc') as Extract<ChallengePart, { type: 'mc' }>;
    expect(mc3.choices.find((c) => c.ok)!.text).toBe('בקטע הראשון');
  });

  it('eq:c4, three legs of a race (stage5.md FUNC-7.4): each leg\'s minutes from its distance and speed, and the average speed is not the mean of the speeds', () => {
    const t = taskById('eq:c4')!;
    expect([t.title, t.kind, t.after, t.minutes]).toEqual(['שלושה מקצים', 'literacy', 'eq:6', 8]);
    // the story's three legs: distance and speed, in its own order
    const legs = [...t.story!.matchAll(/\$([\d.]+)\$ ק״מ ב־\$(\d+)\$ קמ״ש/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(legs).toEqual([[0.75, 3], [20, 30], [5, 10]]);
    const minutes = legs.map(([d, v]) => (d / v) * 60);
    const nums = t.parts.filter((p): p is Extract<ChallengePart, { type: 'num' }> => p.type === 'num').map((p) => p.answer);
    expect(nums).toEqual([minutes[0], minutes[1], minutes[0] + minutes[1] + minutes[2]]);
    expect(nums).toEqual([15, 40, 85]);
    // the feedback's numbers: all the way in all the time, about 18.18 km/h; the mean of the speeds about 14.33
    const avg = (legs.reduce((a, [d]) => a + d, 0) / (nums[2] / 60));
    const mean = legs.reduce((a, [, v]) => a + v, 0) / 3;
    expect([Math.round(avg * 100) / 100, Math.round(mean * 100) / 100]).toEqual([18.18, 14.33]);
    const mc = t.parts.find((p) => p.type === 'mc') as Extract<ChallengePart, { type: 'mc' }>;
    expect(mc.choices.find((c) => c.ok)!.text).toMatch(/^לא: /);
    expect(mc.choices.find((c) => c.ok)!.feedback).toContain('$18.18$');
    expect(mc.choices.find((c) => c.ok)!.feedback).toContain('$14.33$');
  });

  it('ids are unique, each follows a real stair of its own topic, and has its kind, minutes and 2 to 5 parts', () => {
    expect(new Set(CHALLENGES.map((t) => t.id)).size).toBe(CHALLENGES.length);
    CHALLENGES.forEach((t) => {
      expect(t.id, t.id).toMatch(new RegExp(`^${t.topic}:c\\d+$`));
      expect(TOPIC_ORDER).toContain(t.topic);
      expect(ALL_SKILLS, t.id).toContain(t.after);
      expect(parseSkill(t.after).topic, t.id).toBe(t.topic);
      expect(['claim', 'error', 'proof', 'literacy']).toContain(t.kind);
      expect(t.minutes >= 4 && t.minutes <= 10, t.id).toBe(true);
      expect(t.parts.length >= 2 && t.parts.length <= 5, `${t.id}: ${t.parts.length} parts`).toBe(true);
      expect(t.title.trim().length, t.id).toBeGreaterThan(0);
      expect(scoredParts(t).length, `${t.id}: at least one part is scored`).toBeGreaterThan(0);
    });
  });

  it('every number part\'s check evaluates to its answer, and every error\'s fix too', () => {
    CHALLENGES.forEach((t) => t.parts.forEach((p, i) => {
      if (p.type === 'num') {
        expect(same(evaluate(p.check), p.answer), `${t.id} part ${i + 1}: ${p.check} ≠ ${p.answer}`).toBe(true);
        expect(p.solution.length, `${t.id} part ${i + 1}`).toBeGreaterThan(0);
        expect(numCheck(p.answer, String(p.answer))?.ok, `${t.id} part ${i + 1}: the answer typed is right`).toBe(true);
      }
      if (p.type === 'error') {
        expect(same(evaluate(p.fix.check), p.fix.answer), `${t.id} part ${i + 1}: ${p.fix.check} ≠ ${p.fix.answer}`).toBe(true);
        expect(Number.isInteger(p.wrong) && p.wrong >= 0 && p.wrong < p.lines.length, `${t.id}: wrong line ${p.wrong}`).toBe(true);
      }
    }));
  });

  it('every choice question has exactly one right choice, with feedback on each', () => {
    CHALLENGES.forEach((t) => t.parts.forEach((p, i) => {
      if (p.type !== 'mc') return;
      expect(p.choices.filter((c) => c.ok).length, `${t.id} part ${i + 1}`).toBe(1);
      expect(p.choices.length).toBeGreaterThanOrEqual(2);
      p.choices.forEach((c) => expect(c.feedback.trim().length, `${t.id} part ${i + 1}`).toBeGreaterThan(0));
      expect(new Set(p.choices.map((c) => c.text)).size).toBe(p.choices.length);
    }));
  });

  it('every proof has at least three steps, and every reason\'s answer is one of its choices', () => {
    const orders = CHALLENGES.flatMap((t) => t.parts.filter((p): p is Order => p.type === 'order').map((p) => [t.id, p] as const));
    expect(orders.length).toBeGreaterThan(0);
    orders.forEach(([id, p]) => {
      expect(p.steps.length, id).toBeGreaterThanOrEqual(3);
      p.steps.forEach((s) => { if (s.reason) expect(Number.isInteger(s.reason.answer) && s.reason.answer >= 0 && s.reason.answer < s.reason.choices.length, id).toBe(true); });
      (p.free || []).forEach((g) => g.forEach((k) => expect(k >= 0 && k < p.steps.length, id).toBe(true)));
    });
  });

  it('congr:c2 orders template T1\'s rows, written into the challenge (the track loads first): the same claims, the same right reasons', () => {
    const order = taskById('congr:c2')!.parts.find((p) => p.type === 'order') as Order;
    const right = (st: any) => st.fixed ?? st.reason.choices[st.reason.answer];
    expect(order.steps.map((st) => st.text)).toEqual(PROOF.T1.steps.map((st: any) => st.text));
    expect(order.steps.map(right)).toEqual(PROOF.T1.steps.map(right));
    expect(order.free).toEqual(PROOF.T1.free);
    // the two givens show their reason, נתון; the vertical angles, the congruence and the conclusion are asked
    expect(order.steps.map((st) => (st.fixed ? 'fixed' : 'asked'))).toEqual(['fixed', 'fixed', 'asked', 'asked', 'asked']);
  });

  it('sim:c2 orders template T6\'s rows, written into the challenge (the track loads first): the same claims, the same right reasons', () => {
    const order = taskById('sim:c2')!.parts.find((p) => p.type === 'order') as Order;
    const right = (st: any) => st.fixed ?? st.reason.choices[st.reason.answer];
    expect(order.steps.map((st) => st.text)).toEqual(PROOF.T6.steps.map((st: any) => st.text));
    expect(order.steps.map(right)).toEqual(PROOF.T6.steps.map(right));
    expect(order.free).toEqual(PROOF.T6.free);
    // the given, the bisector and the common side show their reason; the third angle and the theorem are asked
    expect(order.steps.map((st) => (st.fixed ? 'fixed' : 'asked'))).toEqual(['fixed', 'fixed', 'fixed', 'asked', 'asked', 'fixed']);
  });

  it('the seven proof templates follow the same rules, so a template that serves a challenge passes both engines (GEOM-3)', () => {
    const parts = (PROOFS as any[]).flatMap((T) => LETTER_SETS.map((_: string, set: number) => {
      const U = proofIn(T, set);
      return [`${T.id}/${set}`, { type: 'order', prompt: 'סדרו את שלבי ההוכחה.', steps: U.steps, free: U.free } as Order] as const;
    }));
    expect(parts).toHaveLength(21);
    parts.forEach(([id, p]) => {
      expect(p.steps.length, id).toBeGreaterThanOrEqual(3);
      p.steps.forEach((s) => {
        if (s.reason) expect(Number.isInteger(s.reason.answer) && s.reason.answer >= 0 && s.reason.answer < s.reason.choices.length, id).toBe(true);
        // a reason is asked or shown, never both
        expect(!!s.reason !== (s.fixed != null), id).toBe(true);
      });
      // every free group is in range and contiguous: rows that may swap stand next to each other
      (p.free || []).forEach((g) => {
        g.forEach((k) => expect(k >= 0 && k < p.steps.length, id).toBe(true));
        const sorted = [...g].sort((a, b) => a - b);
        expect(sorted.every((k, i) => !i || k === sorted[i - 1] + 1), `${id}: ${g}`).toBe(true);
      });
      // the shuffle never starts right
      for (let k = 0; k < 20; k += 1) expect(firstOutOfPlace(p, shuffledOrder(p, `${id}:${k}`)), id).not.toBe(-1);
      // every piece of maths renders, and no Latin word stands outside it
      p.steps.flatMap((s) => [s.text, ...(s.reason?.choices || []), s.fixed || '']).filter(Boolean).forEach((t) => {
        tex(t).forEach((m) => expect(() => katex.renderToString(m, { throwOnError: true }), `${id}: ${m}`).not.toThrow());
        expect(outsideTex(t), `${id}: "${t}"`).not.toMatch(/[A-Za-z]/);
      });
    });
  });

  it('a claim is a plain sentence; "sometimes" or "never" has a counterexample a search finds, "always" has no example', () => {
    const claims = CHALLENGES.flatMap((t) => t.parts.filter((p): p is Claim => p.type === 'claim').map((p) => [t.id, p] as const));
    expect(claims.length).toBeGreaterThanOrEqual(3);
    claims.forEach(([id, p]) => {
      // "תמיד", "אף פעם" and "לכל" would make "sometimes" a wrong answer to a false universal sentence
      expect(p.claim, id).not.toMatch(/תמיד|אף פעם|לכל/);
      expect(['always', 'sometimes', 'never']).toContain(p.verdict);
      if (p.verdict === 'always') { expect(p.example, `${id}: an always-true claim has no counterexample`).toBeUndefined(); return; }
      if (!p.example) return;
      const ex = p.example;
      const vals = domainValues(ex.domain);
      // brute force over the slots: some combination of small values in the domain is a counterexample
      let found = false;
      const tryFrom = (k: number, cur: Record<string, number>) => {
        if (found) return;
        if (k === ex.slots.length) { if (exampleHolds(ex, cur)) found = true; return; }
        for (const v of vals) { tryFrom(k + 1, { ...cur, [ex.slots[k].name]: v }); if (found) return; }
      };
      tryFrom(0, {});
      expect(found, `${id}: no counterexample among small values`).toBe(true);
    });
  });

  it('a story is at most 400 characters; every piece of maths renders; no Latin word stands outside the maths', () => {
    CHALLENGES.forEach((t) => {
      if (t.story) expect(t.story.length, t.id).toBeLessThanOrEqual(400);
      texts(t).forEach((s) => {
        expect((s.match(/\$/g) || []).length % 2, `${t.id}: unbalanced $ in "${s}"`).toBe(0);
        tex(s).forEach((m) => expect(() => katex.renderToString(m, { throwOnError: true }), `${t.id}: ${m}`).not.toThrow());
        expect(outsideTex(s), `${t.id}: "${s}"`).not.toMatch(/[A-Za-z]/);
      });
    });
  });
});

describe('grading a challenge', () => {
  it('a finished task gives 20 XP and 5 per part right on the first try, at most 40', () => {
    expect(challengeXP(0)).toBe(20);
    expect(challengeXP(2)).toBe(30);
    expect(challengeXP(4)).toBe(40);
    expect(challengeXP(7)).toBe(40);
    // an explain part carries no score
    expect(scoredParts(taskById('pct:c1')!).map((p) => p.type)).toEqual(['num', 'num', 'mc']);
  });

  it('a typed number is read as students type it, and compared exactly', () => {
    expect(numCheck(7.5, '7.5')?.ok).toBe(true);
    expect(numCheck(7.5, '7,5')?.ok).toBe(true);
    expect(numCheck(7.5, '7.6')?.ok).toBe(false);
    expect(numCheck(14000, '14,000')?.ok).toBe(true);
    expect(numCheck(14000, '14000')?.ok).toBe(true);
    expect(numCheck(2.5, '2.51')?.ok).toBe(false);
    expect(numCheck(70, '')).toBeNull();
  });

  it('a counterexample: the values in the domain, the expression real, the relation holding', () => {
    const frac = (taskById('frac:c1')!.parts[0] as Claim).example!;
    expect(exampleHolds(frac, { a: 3, b: 2, k: 1 })).toBe(true); // 3/2 → 4/3: smaller
    expect(exampleHolds(frac, { a: 2, b: 2, k: 5 })).toBe(true); // 1 stays 1: it does not grow
    expect(exampleHolds(frac, { a: 1, b: 2, k: 1 })).toBe(false); // 1/2 → 2/3: it grows
    expect(exampleHolds(frac, { a: 3, b: 2, k: 0.5 })).toBe(false); // not a positive whole number
    expect(exampleHolds(frac, { a: 3, b: -2, k: 1 })).toBe(false);
    expect(exampleHolds(frac, { a: 3, b: 2 })).toBe(false); // a slot left empty
    const mean = (taskById('stats:c1')!.parts[3] as Claim).example!;
    expect(exampleHolds(mean, { x: 1, y: 2 })).toBe(true);
    expect(exampleHolds(mean, { x: -1.5, y: 4 })).toBe(true);
    expect(exampleHolds(mean, { x: 3, y: 3 })).toBe(false);
    // area:c1: the long thin rectangle 8 by 1 (perimeter 18 > 16, area 8 < 16) is a counterexample; the square 4 by 4
    // and the 5 by 4 (both grow) are not
    const rect = (taskById('area:c1')!.parts[1] as Claim).example!;
    expect(exampleHolds(rect, { a: 8, b: 1 })).toBe(true);
    expect(exampleHolds(rect, { a: 4, b: 4 })).toBe(false);
    expect(exampleHolds(rect, { a: 5, b: 4 })).toBe(false);
    expect(exampleHolds(rect, { a: 7, b: 2 })).toBe(true); // perimeter 18, area 14
    // an expression that cannot be evaluated there (a zero denominator) is not a counterexample
    expect(exampleHolds({ ...frac, domain: 'int' }, { a: 1, b: 0, k: 0 })).toBe(false);
  });

  it('the proof: the first step out of place, steps found in either order accepted, and a shuffle never already right', () => {
    const proof = taskById('angles:c1')!.parts[0] as Order;
    expect(firstOutOfPlace(proof, [0, 1, 2, 3, 4])).toBe(-1);
    expect(firstOutOfPlace(proof, [0, 2, 1, 3, 4])).toBe(-1); // A's angle and B's, either order: still a proof
    expect(firstOutOfPlace(proof, [1, 0, 2, 3, 4])).toBe(0);
    expect(firstOutOfPlace(proof, [0, 1, 2, 4, 3])).toBe(3);
    for (let k = 0; k < 50; k += 1) {
      const o = shuffledOrder(proof, `seed${k}`);
      expect([...o].sort()).toEqual([0, 1, 2, 3, 4]);
      expect(firstOutOfPlace(proof, o), `seed${k}: ${o}`).not.toBe(-1);
    }
    expect(shuffledOrder(proof, 'angles:c1:0')).toEqual(shuffledOrder(proof, 'angles:c1:0')); // the same task opens the same way
    expect(moveStep([0, 1, 2], 1, -1)).toEqual([1, 0, 2]);
    expect(moveStep([0, 1, 2], 0, -1)).toEqual([0, 1, 2]);
    expect(moveStep([0, 1, 2], 2, 1)).toEqual([0, 1, 2]);
  });
});
