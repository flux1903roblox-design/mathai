// The council's round 3 (learning): proofs, the core of the grade-8 geometry exam, were never assessed. fairForCheck
// rejected every proof item, so congr:3's mastery check asked numbers only (688 of 2,000 check draws were checkable, all
// of them "use the congruence to find a number") and a student mastered the proof stair without a proof.
// Now the proof stairs' mastery checks ask whole proofs: a template in a fresh letter set, its rows shuffled, every
// reason asked, each row's choices in an order of their own, no hint. congr:3 asks two, so four right of five cannot be
// numbers alone; sim:1 and sim:3 asked one each until the student council's review found that numbers alone passed them,
// and now ask two too, from three templates each (T5, T8, T9 and T7, T10, T11), two different ones a check. The practice
// proofs (one or two reasons to fill in, the theorem alone, which row is wrong) stay practice only.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPlan, itemFor } from './items';
import { MASTERY_N, MASTERY_NEED } from './mastery';
import { seeded } from './expr';
import { ALL_SKILLS } from './skills';
import { loadAllContent } from './content/index';
// @ts-ignore: plain JS
import { fairForCheck, makeItem, isCorrect, answerInput } from '@/content/index.js';
// @ts-ignore: plain JS
import { askedSteps, proofStart, proofCorrect, proofReasonGuess, CHECK_REASONS } from '@/content/proof.js';
// @ts-ignore: plain JS
import * as lessonJs from '@/lib/lesson.js';

await loadAllContent();
// the lesson engine is plain JS: its inferred types are too narrow for these tests (as checks.test.ts)
const { startLesson, answer, next, resultOf } = lessonJs as any;
const realRandom = Math.random;
beforeEach(() => { Math.random = seeded(20261122); });
afterEach(() => { Math.random = realRandom; });

const PROOF_STAIRS: Record<string, number> = { 'congr:3': 2, 'sim:1': 2, 'sim:3': 2 };
const isProof = (it: any) => it.form === 'manip' && it.manip?.kind === 'proof';

describe('the proof stairs\' mastery checks ask proofs', () => {
  it('congr:3, sim:1 and sim:3 ask two whole proofs of five; no other stair asks any', () => {
    for (const skill of ALL_SKILLS) {
      for (let s = 1; s <= 5; s += 1) {
        const plan = checkPlan({ purpose: 'mastery', skill }, seeded(s));
        expect(plan).toHaveLength(MASTERY_N);
        expect(plan.filter((q) => q.source === 'proof').length, skill).toBe(PROOF_STAIRS[skill] || 0);
      }
    }
    // numbers alone are at most three right of a proof stair's five: not the four a pass needs
    for (const n of Object.values(PROOF_STAIRS)) expect(MASTERY_N - n).toBeLessThan(MASTERY_NEED);
  });

  it('a proof question of a check: rows shuffled, at least three reasons asked, no hint, fair for a check', () => {
    for (const skill of Object.keys(PROOF_STAIRS)) {
      const orders = new Set<string>();
      for (let i = 0; i < 60; i += 1) {
        const it = itemFor(skill, 'proof', seeded(i), undefined, undefined, { test: true });
        expect(isProof(it), skill).toBe(true);
        expect(fairForCheck(it), `${skill} ${it.key}`).toBe(true);
        expect(it.hint, `${skill}: a check gives no hint`).toBeUndefined();
        expect(it.practiceOnly).toBeFalsy();
        expect(it.manip.lockOrder).toBeFalsy();
        expect(askedSteps(it.manip.part).length).toBeGreaterThanOrEqual(CHECK_REASONS);
        // it does not start right, and its right table is right
        expect(proofCorrect(it.manip, proofStart(it.manip)), it.key).toBe(false);
        expect(isCorrect(it, answerInput(it)), it.key).toBe(true);
        // a student who knows the order of the rows and picks every reason at random: at most one in 27
        expect(proofReasonGuess(it.manip), it.key).toBeLessThanOrEqual(1 / 27 + 1e-12);
        orders.add(JSON.stringify(it.manip.part.steps.map((st: any) => st.reason?.choices ?? null)));
      }
      // the choices come in orders of their own: no position of a right reason is remembered from practice
      expect(orders.size, skill).toBeGreaterThan(10);
    }
  });

  it('the practice proofs stay practice only', () => {
    for (const [topic, level] of [['congr', 3], ['sim', 1], ['sim', 3]] as const) {
      let proofs = 0;
      for (let i = 0; i < 400; i += 1) {
        const it = makeItem(topic, level);
        if (!isProof(it)) continue;
        proofs += 1;
        expect(fairForCheck(it), it.key).toBe(false);
      }
      expect(proofs, `${topic}:${level}`).toBeGreaterThan(10);
    }
  });

  // The student council's review: a student who gets every number right and every proof wrong passed sim:1's and
  // sim:3's checks, which asked one proof each (four right of five). 200 whole checks of each proof stair, played as
  // that student: the number questions answered right, every proof left as it starts (its rows shuffled, no reason
  // chosen). Before sim:1 and sim:3 asked two proofs this student passed 200 of 200 checks of each; congr:3, which
  // asked two already, 0 of 200. Now no proof stair's check passes on numbers alone.
  it('200 checks of each proof stair: numbers right and proofs wrong never pass', () => {
    const passes: Record<string, number> = {};
    for (const skill of Object.keys(PROOF_STAIRS)) {
      const [topic, level] = skill.split(':');
      passes[skill] = 0;
      for (let n = 0; n < 200; n += 1) {
        let s = startLesson({ kind: 'check', purpose: 'mastery', skill, topic, level: Number(level) });
        let asked = 0;
        while (!s.finished && asked < 20) {
          const it = s.item; asked += 1;
          s = answer(s, isProof(it) ? proofStart(it.manip) : answerInput(it)).s;
          s = next(s);
        }
        if (resultOf(s).passed) passes[skill] += 1;
      }
    }
    expect(passes).toEqual({ 'congr:3': 0, 'sim:1': 0, 'sim:3': 0 });
  }, 60_000);

  it('a whole check of each proof stair runs: the proofs answered right pass it, and numbers alone do not', () => {
    // the templates each stair's check asks (content/congr.gen.js, sim.gen.js)
    const TEMPLATES: Record<string, string[]> = { 'congr:3': ['T1', 'T2', 'T3', 'T4'], 'sim:1': ['T5', 'T8', 'T9'], 'sim:3': ['T7', 'T10', 'T11'] };
    for (const skill of Object.keys(PROOF_STAIRS)) {
      const [topic, level] = skill.split(':');
      const seen = new Set<string>();
      for (let n = 0; n < 12; n += 1) {
        for (const proofsRight of [true, false]) {
          let s = startLesson({ kind: 'check', purpose: 'mastery', skill, topic, level: Number(level) });
          let asked = 0; const proofs: string[] = [];
          while (!s.finished && asked < 20) {
            const it = s.item; asked += 1;
            if (isProof(it)) { proofs.push(it.key); seen.add(it.manip.tpl); }
            const u = isProof(it) && !proofsRight ? proofStart(it.manip) : answerInput(it);
            s = answer(s, u).s;
            s = next(s);
          }
          // two proofs, and two different ones: the same template in other letters is the same question (its key)
          expect(proofs, skill).toHaveLength(2);
          expect(new Set(proofs).size, `${skill}: ${proofs.join(' ')}`).toBe(2);
          expect(resultOf(s).passed, `${skill}: proofs ${proofsRight ? 'right' : 'wrong'}`).toBe(proofsRight);
        }
      }
      // every template of the stair is asked, and none of another stair's
      expect([...seen].sort(), skill).toEqual([...TEMPLATES[skill]].sort());
    }
  });
});
