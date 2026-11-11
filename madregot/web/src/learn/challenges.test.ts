// The challenge track (CURRICULUM-6): every task is checked mathematically and for its wording, the set is stage 1's 36
// and the data and probability units' 3 each (three per topic, one claim, one error or proof, one literacy task each), and the grading rules
// (two tries, XP, the order check, the counterexample check) are pinned.
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import type { ChallengePart, ChallengeTask } from './types';
import { CHALLENGES as META_LIST, challengeById, challengesAfter, challengesOf } from './challenges/index';
// the tasks with their parts (the registry keeps only their meta for the first load)
import { CHALLENGE_TASKS as CHALLENGES, taskById } from './challenges/all';
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

describe('the challenge tasks', () => {
  it('the first load knows each task without its story and parts (meta.gen.ts): the same tasks, in the same order', () => {
    expect(META_LIST.map((t) => t.id)).toEqual(CHALLENGES.map((t) => t.id));
    for (const t of CHALLENGES) expect(challengeById(t.id)).toEqual({ id: t.id, topic: t.topic, after: t.after, kind: t.kind, title: t.title, minutes: t.minutes, ...(t.misc ? { misc: t.misc } : {}) });
    expect(META_LIST.some((t) => 'parts' in t || 'story' in t)).toBe(false);
    expect(taskById('prob:c2')?.parts).toHaveLength(2);
    expect(taskById('nope')).toBeNull();
  });
  it('42 tasks (stage 1\'s 36, data\'s 3 and probability\'s 3): three per topic of TOPIC_ORDER, the bridge included, in topic order', () => {
    console.log(`${CHALLENGES.length} challenge tasks:\n${TOPIC_ORDER.map((tp) => `  ${tp}: ${challengesOf(tp).map((t) => `${t.id} ${t.kind} after ${t.after}`).join(' · ')}`).join('\n')}`);
    expect(CHALLENGES).toHaveLength(42);
    expect(challengesOf('data').map((t) => [t.id, t.kind, t.after])).toEqual([['data:c1', 'literacy', 'data:3'], ['data:c2', 'claim', 'data:2'], ['data:c3', 'error', 'data:4']]);
    // DATA-7: a claim with no "לכל" (two plain sentences), Danny's unordered pairs, the Ministry's rain table
    expect(challengesOf('prob').map((t) => [t.id, t.kind, t.after])).toEqual([['prob:c1', 'claim', 'prob:1'], ['prob:c2', 'error', 'prob:3'], ['prob:c3', 'literacy', 'prob:2']]);
    TOPIC_ORDER.forEach((tp) => expect(challengesOf(tp).map((t) => t.id), tp).toEqual([`${tp}:c1`, `${tp}:c2`, `${tp}:c3`]));
    expect(TOPIC_ORDER).toContain('frac');
    expect(CHALLENGES.map((t) => t.topic)).toEqual(TOPIC_ORDER.flatMap((tp) => [tp, tp, tp]));
    expect(challengeById('pct:c1')?.after).toBe('pct:2');
    expect(challengeById('nope')).toBeNull();
    expect(challengesAfter('ratio:2').map((t) => t.id)).toEqual(['ratio:c1']);
    expect(challengesAfter('expr:4').map((t) => t.id)).toEqual(['expr:c1', 'expr:c2']);
  });

  it('each topic has one claim, one error or proof, and one literacy task', () => {
    TOPIC_ORDER.forEach((tp) => {
      const kinds = challengesOf(tp).map((t) => t.kind);
      expect(kinds.filter((k) => k === 'claim'), tp).toHaveLength(1);
      expect(kinds.filter((k) => k === 'error' || k === 'proof'), tp).toHaveLength(1);
      expect(kinds.filter((k) => k === 'literacy'), tp).toHaveLength(1);
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
