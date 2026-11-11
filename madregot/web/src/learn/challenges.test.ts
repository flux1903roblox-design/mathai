// The challenge track (CURRICULUM-6): every task is checked mathematically and for its wording, every topic has at least
// one claim, one error or proof and one literacy task (stage 1's 36 were three each; later stages add their own, so the
// count is computed), and the grading rules (two tries, XP, the order check, the counterexample check) are pinned.
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import type { ChallengePart, ChallengeTask } from './types';
import { CHALLENGES, challengeById, challengesAfter, challengesOf } from './challenges/index';
import { challengeXP, scoredParts, numCheck, exampleHolds, domainValues, firstOutOfPlace, shuffledOrder, moveStep } from './challenges/grade';
import { ALL_SKILLS, TOPIC_ORDER, parseSkill } from './skills';
import { evaluate, same } from './expr';
import { contentOf, loadAllContent } from './content/index';

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
  it('every topic of TOPIC_ORDER has its tasks, the bridge included, numbered c1, c2, … and in topic order', () => {
    console.log(`${CHALLENGES.length} challenge tasks:\n${TOPIC_ORDER.map((tp) => `  ${tp}: ${challengesOf(tp).map((t) => `${t.id} ${t.kind} after ${t.after}`).join(' · ')}`).join('\n')}`);
    // the count is the topics' tasks, every one of them in a topic of TOPIC_ORDER
    expect(CHALLENGES).toHaveLength(TOPIC_ORDER.reduce((n, tp) => n + challengesOf(tp).length, 0));
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(36);
    TOPIC_ORDER.forEach((tp) => {
      const ids = challengesOf(tp).map((t) => t.id);
      if (!PENDING_CHALLENGES.has(tp)) expect(ids.length, tp).toBeGreaterThanOrEqual(3);
      expect(ids, tp).toEqual(ids.map((_, i) => `${tp}:c${i + 1}`));
    });
    PENDING_CHALLENGES.forEach((tp) => expect(TOPIC_ORDER, `${tp}: a pending unit is a real one`).toContain(tp));
    expect(TOPIC_ORDER).toContain('frac');
    expect(CHALLENGES.map((t) => t.topic)).toEqual(TOPIC_ORDER.flatMap((tp) => challengesOf(tp).map(() => tp)));
    expect(challengeById('pct:c1')?.after).toBe('pct:2');
    expect(challengeById('nope')).toBeNull();
    expect(challengesAfter('ratio:2').map((t) => t.id)).toEqual(['ratio:c1']);
    expect(challengesAfter('expr:4').map((t) => t.id)).toEqual(['expr:c1', 'expr:c2']);
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

  it('the nine algebra tasks are the spec\'s, and a task\'s mistake is one the content names', () => {
    const algebra = CHALLENGES.filter((t) => ['expr', 'eq', 'sys'].includes(t.topic));
    expect(algebra.map((t) => [t.id, t.kind, t.after, t.minutes])).toEqual([
      ['expr:c1', 'claim', 'expr:4', 4], ['expr:c2', 'error', 'expr:4', 4], ['expr:c3', 'literacy', 'expr:2', 7],
      ['eq:c1', 'claim', 'eq:3', 4], ['eq:c2', 'error', 'eq:2', 4], ['eq:c3', 'literacy', 'eq:5', 8],
      ['sys:c1', 'claim', 'sys:2', 4], ['sys:c2', 'error', 'sys:2', 5], ['sys:c3', 'literacy', 'sys:4', 8],
    ]);
    // the spec names the mistake of each error task
    expect(['expr:c2', 'eq:c2', 'sys:c2'].map((id) => challengeById(id)!.misc)).toEqual(['partial-dist', 'move-no-flip', 'move-no-flip']);
    const named = new Set(ALL_SKILLS.flatMap((id) => contentOf(id)?.misconceptions.map((m) => m.id) || []));
    CHALLENGES.filter((t) => t.misc).forEach((t) => expect(named.has(t.misc!), `${t.id}: ${t.misc}`).toBe(true));
  });

  it('the functions unit\'s three tasks are the spec\'s (stage5.md FUNC-7; Critique notes 21 and 22)', () => {
    expect(PENDING_CHALLENGES.size, 'every unit is whole').toBe(0);
    expect(challengesOf('func').map((t) => [t.id, t.kind, t.after, t.minutes, t.misc ?? null])).toEqual([
      ['func:c1', 'claim', 'func:4', 4, 'from-zero'], ['func:c2', 'error', 'func:3', 4, 'rtl-read'], ['func:c3', 'literacy', 'func:4', 8, null],
    ]);
    // c1: "משתנה", so every whole start but 0 is a counterexample, cooling ones too; the hint's 8 is one, and 0 is not
    const c1 = challengeById('func:c1')!.parts[0] as Claim;
    expect(c1.claim).toContain('משתנה');
    expect(c1.verdict).toBe('sometimes');
    expect(c1.example).toMatchObject({ domain: 'positive-int', expr: '40 - s', rel: '!=', value: 40 });
    expect(exampleHolds(c1.example!, { s: 8 })).toBe(true);
    expect(exampleHolds(c1.example!, { s: 0 })).toBe(false);
    // the expression is the temperature after 4 minutes from s at the start and 20 after 2, for every start 1..60
    for (let s = 1; s <= 60; s += 1) expect(same(evaluate(c1.example!.expr, { s }), s + 4 * ((20 - s) / 2)), `start ${s}`).toBe(true);
    const mc1 = challengeById('func:c1')!.parts[1] as Extract<ChallengePart, { type: 'mc' }>;
    expect(mc1.choices.find((c) => c.ok)!.text).toBe('כשההתחלה $0^\\circ$');
    // c2: Tal's graph rises on 0 < x < 3 and falls on 3 < x < 8, read left to right; the wrong line says it rises there
    const c2 = challengeById('func:c2')!;
    const pts = (c2.fig as { series: { pts: [number, number][] }[] }).series[0].pts;
    expect(pts).toEqual([[0, 1], [3, 7], [8, 2], [10, 2]]);
    const err = c2.parts[0] as Extract<ChallengePart, { type: 'error' }>;
    expect([err.wrong, err.fix.answer, err.fix.check]).toEqual([1, 3, '3-0']);
    expect(err.lines[1]).toContain('$3 < x < 8$');
    // c3: Yoav's ride; the average (11) is neither part's speed (18 and 12), so the last speed is not marked right
    const c3 = challengeById('func:c3')!;
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
    expect(scoredParts(challengeById('pct:c1')!).map((p) => p.type)).toEqual(['num', 'num', 'mc']);
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
    const frac = (challengeById('frac:c1')!.parts[0] as Claim).example!;
    expect(exampleHolds(frac, { a: 3, b: 2, k: 1 })).toBe(true); // 3/2 → 4/3: smaller
    expect(exampleHolds(frac, { a: 2, b: 2, k: 5 })).toBe(true); // 1 stays 1: it does not grow
    expect(exampleHolds(frac, { a: 1, b: 2, k: 1 })).toBe(false); // 1/2 → 2/3: it grows
    expect(exampleHolds(frac, { a: 3, b: 2, k: 0.5 })).toBe(false); // not a positive whole number
    expect(exampleHolds(frac, { a: 3, b: -2, k: 1 })).toBe(false);
    expect(exampleHolds(frac, { a: 3, b: 2 })).toBe(false); // a slot left empty
    const mean = (challengeById('stats:c1')!.parts[3] as Claim).example!;
    expect(exampleHolds(mean, { x: 1, y: 2 })).toBe(true);
    expect(exampleHolds(mean, { x: -1.5, y: 4 })).toBe(true);
    expect(exampleHolds(mean, { x: 3, y: 3 })).toBe(false);
    // an expression that cannot be evaluated there (a zero denominator) is not a counterexample
    expect(exampleHolds({ ...frac, domain: 'int' }, { a: 1, b: 0, k: 0 })).toBe(false);
  });

  it('the proof: the first step out of place, steps found in either order accepted, and a shuffle never already right', () => {
    const proof = challengeById('angles:c1')!.parts[0] as Order;
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
