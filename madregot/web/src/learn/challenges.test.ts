// The challenge track (CURRICULUM-6): every task is checked mathematically and for its wording; every stair has at
// least one task after it (PRODUCT2-21), and every topic has a claim, an error, a proof, a real-world (literacy) task
// and a multi-step one; the count follows from the topics' files. The meta the first download carries
// (challenges/meta.gen.ts) is what the generator writes, and every topic's file loads. The grading rules (two tries,
// XP, the order check, the counterexample check) are pinned.
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import type { ChallengePart, ChallengeTask, TopicId } from './types';
import { CHALLENGES, CHALLENGE_TOPICS, challengeById, challengesAfter, challengesOf, ensureChallenge, loadedChallenge, loadAllChallenges } from './challenges/index';
import { challengeXP, scoredParts, numCheck, exampleHolds, domainValues, firstOutOfPlace, shuffledOrder, moveStep } from './challenges/grade';
import { ALL_SKILLS, TOPIC_ORDER, STAIRS, parseSkill, skillId } from './skills';
import { evaluate, same } from './expr';
import { contentOf, loadAllContent } from './content/index';
import metaText from './challenges/meta.gen.ts?raw';
// @ts-ignore: plain JS
import { collectMeta, renderMeta } from '../../scripts/gen-challenge-meta.mjs';
// @ts-ignore: no Node types in this project
import { spawnSync } from 'node:child_process';
// @ts-ignore: no Node types in this project
import { execPath } from 'node:process';

// the meta answers before any task has loaded
const before = { known: !!challengeById('pct:c1'), loaded: !!loadedChallenge('pct:c1') };
// every topic's teaching content and every task, loaded once (the durable lane's split, DURABLE-11: they load on demand)
await loadAllContent();
const TASKS: ChallengeTask[] = await loadAllChallenges();
const task = (id: string) => TASKS.find((t) => t.id === id)!;

type Claim = Extract<ChallengePart, { type: 'claim' }>;
type Order = Extract<ChallengePart, { type: 'order' }>;
type ErrorP = Extract<ChallengePart, { type: 'error' }>;

/** Every piece of text a task shows (titles, stories, prompts, choices, lines, steps, reasons, rubrics, samples). */
function texts(t: ChallengeTask): string[] {
  const out = [t.title, t.story || ''];
  t.parts.forEach((p) => {
    out.push(p.prompt);
    if (p.type === 'num') out.push(...p.solution);
    if (p.type === 'mc') p.choices.forEach((c) => out.push(c.text, c.feedback));
    if (p.type === 'claim') { out.push(p.claim, p.why); if (p.example) out.push(p.example.ask, p.example.hint, ...p.example.slots.map((s) => s.label)); }
    if (p.type === 'order') p.steps.forEach((s) => out.push(s.text, ...(s.reason?.choices || [])));
    if (p.type === 'error') out.push(...p.lines, p.why, ...Object.values(p.lineWhy || {}), p.fix.prompt);
    if (p.type === 'explain') out.push(...p.rubric, p.sample);
  });
  return out.filter(Boolean);
}
const tex = (s: string) => (s.match(/\$([^$]+)\$/g) || []).map((m) => m.slice(1, -1));
const outsideTex = (s: string) => s.replace(/\$[^$]+\$/g, ' ');
/** Multi-step: three or more scored parts, at least two of them a typed number (a number part, or an error's fix). */
const multiStep = (t: ChallengeTask) => scoredParts(t).length >= 3 && t.parts.filter((p) => p.type === 'num' || p.type === 'error').length >= 2;

/** The topics whose stairs all have a task (PRODUCT2-21): the bridge and grade 7 first. */
const COVERED: TopicId[] = ['frac', 'signed', 'coord', 'angles', 'expr', 'eq'];
/**
 * Stairs that another lane gives a task: the classroom lane's signed:c4 follows signed:5 and its expr:c4 follows expr:3
 * (CLASSROOM-4 and CLASSROOM-6), so this lane leaves them, and numbers its own tasks of those topics after the
 * classroom lane's (signed:c6 on, expr:c5 on). Once that lane has merged, the two stairs have their tasks and this list
 * is empty: the test below says so.
 */
const OTHER_LANE: string[] = ['signed:5', 'expr:3'];

describe('the challenge tasks', () => {
  it('every stair has at least one task after it; how many tasks there are follows from that (PRODUCT2-21)', () => {
    console.log(`${CHALLENGES.length} challenge tasks:\n${TOPIC_ORDER.map((tp) => `  ${tp}: ${challengesOf(tp).map((t) => `${t.id} ${t.kind} after ${t.after}`).join(' · ')}`).join('\n')}`);
    const stairs = COVERED.flatMap((tp) => Array.from({ length: STAIRS[tp] }, (_, i) => skillId(tp, i + 1)));
    const bare = stairs.filter((s) => !challengesAfter(s).length);
    expect(bare, 'stairs with no task after them').toEqual(OTHER_LANE.filter((s) => stairs.includes(s)));
    // every task follows a stair, so there are at least as many tasks as stairs that have one
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(stairs.length - bare.length);
    // in topic order, each topic's tasks in their file's order; the stage 1 tasks keep their ids and stairs
    expect(CHALLENGES.map((t) => t.topic)).toEqual(TOPIC_ORDER.flatMap((tp) => challengesOf(tp).map(() => tp)));
    TOPIC_ORDER.forEach((tp) => expect(challengesOf(tp).slice(0, 3).map((t) => t.id), tp).toEqual([`${tp}:c1`, `${tp}:c2`, `${tp}:c3`]));
    expect(challengeById('pct:c1')?.after).toBe('pct:2');
    expect(challengeById('nope')).toBeNull();
    expect(challengesAfter('ratio:2').map((t) => t.id)).toEqual(['ratio:c1']);
    expect(challengesAfter('expr:4').map((t) => t.id)).toEqual(['expr:c1', 'expr:c2']);
  });

  it('each topic has at least one claim, error, proof and real-world task, and one of many steps', () => {
    COVERED.forEach((tp) => {
      const kinds = challengesOf(tp).map((t) => t.kind);
      (['claim', 'error', 'proof', 'literacy'] as const).forEach((k) => expect(kinds.filter((x) => x === k).length, `${tp}: ${k}`).toBeGreaterThanOrEqual(1));
      expect(TASKS.filter((t) => t.topic === tp && multiStep(t)).map((t) => t.id), `${tp}: a task of many steps`).not.toEqual([]);
    });
    // a task's kind is what its parts do: a claim task has a claim part, an error task an error part, a proof an order
    TASKS.forEach((t) => {
      const types = t.parts.map((p) => p.type);
      if (t.kind === 'claim') expect(types, t.id).toContain('claim');
      if (t.kind === 'error') expect(types, t.id).toContain('error');
      if (t.kind === 'proof') expect(types, t.id).toContain('order');
      if (t.kind === 'literacy') expect(t.story, `${t.id}: a real-world task has its story`).toBeTruthy();
    });
  });

  it('the first download knows every task by its meta; each topic file loads exactly the meta\'s tasks', async () => {
    expect(before).toEqual({ known: true, loaded: false });
    expect(TASKS.map((t) => t.id)).toEqual(CHALLENGES.map((t) => t.id));
    TASKS.forEach((t) => expect(challengeById(t.id), t.id).toEqual(Object.fromEntries(Object.entries({ id: t.id, topic: t.topic, after: t.after, kind: t.kind, title: t.title, minutes: t.minutes, misc: t.misc }).filter(([, v]) => v !== undefined))));
    expect(CHALLENGE_TOPICS).toEqual(TOPIC_ORDER.filter((tp) => challengesOf(tp).length));
    // a loaded topic answers at once: the promise is marked settled, so the screen does not suspend again
    expect((ensureChallenge('pct:c1') as Promise<void> & { status?: string }).status).toBe('fulfilled');
    expect(loadedChallenge('pct:c1')?.parts.length).toBeGreaterThan(0);
    expect(loadedChallenge('nope')).toBeNull();
  });

  it('meta.gen.ts is what the generator writes from the topic files, and the build\'s own run agrees', () => {
    const files = import.meta.glob('./challenges/*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
    const topics = Object.fromEntries(Object.entries(files).filter(([f]) => !/\/(index|grade|meta\.gen)\.ts$/.test(f)));
    expect(renderMeta(collectMeta(topics, TOPIC_ORDER))).toBe(metaText);
    const r = spawnSync(execPath, ['scripts/gen-challenge-meta.mjs', '--check'], { encoding: 'utf8' });
    expect(r.stderr + r.stdout).toMatch(/up to date/);
    expect(r.status).toBe(0);
  }, 60_000);

  it('the nine algebra tasks of stage 1 are the spec\'s, and a task\'s mistake is one the content names', () => {
    const algebra = CHALLENGES.filter((t) => ['expr', 'eq', 'sys'].includes(t.topic) && /:c[123]$/.test(t.id));
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
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    TASKS.forEach((t) => {
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
    TASKS.forEach((t) => t.parts.forEach((p, i) => {
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

  it('every line of an error task that is not the mistake says why, for the student who marks it (PRODUCT2-18)', () => {
    const errors = TASKS.flatMap((t) => t.parts.filter((p): p is ErrorP => p.type === 'error').map((p) => [t.id, p] as const));
    expect(errors.length).toBeGreaterThanOrEqual(10);
    errors.forEach(([id, p]) => {
      p.lines.forEach((_, i) => {
        if (i === p.wrong) { expect(p.lineWhy?.[i], `${id}: the mistaken line is explained by why`).toBeUndefined(); return; }
        const w = p.lineWhy?.[i]?.trim() || '';
        expect(w.length, `${id}: line ${i + 1} has no why of its own`).toBeGreaterThan(0);
        expect(w, `${id}: line ${i + 1}`).not.toBe(p.why.trim());
        // short, as a result line: at most two short lines on a phone (maths counted as one short word)
        expect(w.replace(/\$[^$]+\$/g, 'xxxx').length, `${id}: line ${i + 1} is long`).toBeLessThanOrEqual(90);
      });
      Object.keys(p.lineWhy || {}).forEach((k) => expect(Number(k) >= 0 && Number(k) < p.lines.length, `${id}: lineWhy ${k}`).toBe(true));
    });
  });

  it('every choice question has exactly one right choice, with feedback on each', () => {
    TASKS.forEach((t) => t.parts.forEach((p, i) => {
      if (p.type !== 'mc') return;
      expect(p.choices.filter((c) => c.ok).length, `${t.id} part ${i + 1}`).toBe(1);
      expect(p.choices.length).toBeGreaterThanOrEqual(2);
      p.choices.forEach((c) => expect(c.feedback.trim().length, `${t.id} part ${i + 1}`).toBeGreaterThan(0));
      expect(new Set(p.choices.map((c) => c.text)).size).toBe(p.choices.length);
    }));
  });

  it('every proof has at least three steps, and every reason\'s answer is one of its choices', () => {
    const orders = TASKS.flatMap((t) => t.parts.filter((p): p is Order => p.type === 'order').map((p) => [t.id, p] as const));
    expect(orders.length).toBeGreaterThan(0);
    orders.forEach(([id, p]) => {
      expect(p.steps.length, id).toBeGreaterThanOrEqual(3);
      p.steps.forEach((s) => { if (s.reason) expect(Number.isInteger(s.reason.answer) && s.reason.answer >= 0 && s.reason.answer < s.reason.choices.length, id).toBe(true); });
      (p.free || []).forEach((g) => g.forEach((k) => expect(k >= 0 && k < p.steps.length, id).toBe(true)));
    });
  });

  it('a claim is a plain sentence; "sometimes" or "never" has a counterexample a search finds, "always" has no example', () => {
    const claims = TASKS.flatMap((t) => t.parts.filter((p): p is Claim => p.type === 'claim').map((p) => [t.id, p] as const));
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
    TASKS.forEach((t) => {
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
    expect(scoredParts(task('pct:c1')).map((p) => p.type)).toEqual(['num', 'num', 'mc']);
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
    const frac = (task('frac:c1').parts[0] as Claim).example!;
    expect(exampleHolds(frac, { a: 3, b: 2, k: 1 })).toBe(true); // 3/2 → 4/3: smaller
    expect(exampleHolds(frac, { a: 2, b: 2, k: 5 })).toBe(true); // 1 stays 1: it does not grow
    expect(exampleHolds(frac, { a: 1, b: 2, k: 1 })).toBe(false); // 1/2 → 2/3: it grows
    expect(exampleHolds(frac, { a: 3, b: 2, k: 0.5 })).toBe(false); // not a positive whole number
    expect(exampleHolds(frac, { a: 3, b: -2, k: 1 })).toBe(false);
    expect(exampleHolds(frac, { a: 3, b: 2 })).toBe(false); // a slot left empty
    const mean = (task('stats:c1').parts[3] as Claim).example!;
    expect(exampleHolds(mean, { x: 1, y: 2 })).toBe(true);
    expect(exampleHolds(mean, { x: -1.5, y: 4 })).toBe(true);
    expect(exampleHolds(mean, { x: 3, y: 3 })).toBe(false);
    // an expression that cannot be evaluated there (a zero denominator) is not a counterexample
    expect(exampleHolds({ ...frac, domain: 'int' }, { a: 1, b: 0, k: 0 })).toBe(false);
  });

  it('the proof: the first step out of place, steps found in either order accepted, and a shuffle never already right', () => {
    const proof = task('angles:c1').parts[0] as Order;
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
