// The plan of each kind of check (items.ts checkPlan): here the floor check, the short check of the basics under the
// grade (curriculum stage 1, CURRICULUM-3). (The curriculum lane's items.test.ts; items.test.ts is the durable lane's
// test of the content split, so this one has its own file.)
import { describe, it, expect } from 'vitest';
import { checkPlan, itemFor, FACTS_SKILL, FLOOR_SKILLS } from './items';
import { ensureTopics } from './content/index';
// @ts-ignore: plain JS
import { fairForCheck } from '@/content/index.js';

// the fractions floor's teaching content (its diagnostic models), loaded before a question is made, as a check does
await ensureTopics(FLOOR_SKILLS);

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('the floor check plan', () => {
  it('has 6 questions: one diagnostic question of each fractions stair and two multiplication facts', () => {
    const plan = checkPlan({ purpose: 'floor', skills: FLOOR_SKILLS }, seeded(7));
    expect(plan).toHaveLength(6);
    for (const s of FLOOR_SKILLS) expect(plan.filter((q) => q.skill === s)).toEqual([{ skill: s, source: 'diag' }]);
    expect(plan.filter((q) => q.source === 'facts')).toEqual([{ skill: FACTS_SKILL, source: 'facts' }, { skill: FACTS_SKILL, source: 'facts' }]);
  });
  it('without a list of stairs it asks the four fractions stairs', () => {
    expect(checkPlan({ purpose: 'floor' }, seeded(3)).map((q) => q.skill).sort()).toEqual([...FLOOR_SKILLS, FACTS_SKILL, FACTS_SKILL].sort());
  });
  it('is shuffled: the order changes from one check to the next', () => {
    const orders = new Set(Array.from({ length: 30 }, (_, i) => checkPlan({ purpose: 'floor' }, seeded(i + 1)).map((q) => q.skill).join(',')));
    expect(orders.size).toBeGreaterThan(5);
  });
  it('every question can be asked in a check: diagnostic questions of each stair, and facts on no stair', () => {
    const rnd = seeded(11);
    for (let k = 0; k < 40; k += 1) {
      for (const q of checkPlan({ purpose: 'floor' }, rnd)) {
        const it = itemFor(q.skill, q.source, rnd, undefined, q.candidates, { test: true }) as any;
        expect(fairForCheck(it)).toBe(true);
        if (q.source === 'facts') {
          expect(it).toMatchObject({ topic: 'facts', level: 0 });
          expect(it.key).toMatch(/^facts:\d:\d:(mul|div)$/);
        } else {
          expect(`${it.topic}:${it.level}`).toBe(q.skill);
          expect(it.source).toBe('diag');
          expect(typeof it.diagnosis).toBe('function'); // a wrong answer names its misconception
        }
      }
    }
  });
});
