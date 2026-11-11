// checkPlan and itemFor with the teaching content split per topic (DURABLE-11). A check's plan needs only the meta, so
// it is made before any topic has loaded; its questions need the topics, so they are made once ensureTopics resolved.
// With the same seeds, both are exactly what they were before the split (__snapshots__/items-split.json was recorded
// on the code before it; a deliberate content change updates it with vitest -u).
import { describe, it, expect, vi } from 'vitest';

// Some exercise generators keep the random source they found when they loaded (content/sys.js rnd0): seeded before any
// module loads, so every question of this test is the same on every run.
vi.hoisted(() => {
  let t = 2026;
  Math.random = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
});

import { checkPlan, itemFor, modelItem } from './items';
import { ensureTopics, topicsReady, hasContent, META } from './content/index';
import type { DiagModel, StairContent } from './types';
// @ts-ignore: plain JS
import { TOPICS, topicsFor, isCorrect, readAnswer, answerText, answerInput, makeItem, namesOf } from '@/content/index.js';
import { PROB } from './content/prob';

// the same generator as main.jsx's test seed
const seeded = (seed: number) => { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
const sortKeys = (v: any): any => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const brief = (it: any) => `${it.key}|${JSON.stringify(it.answer)}|${it.source || 'gen'}`;
const line = (q: { skill: string; source: string; candidates?: string[] }) => `${q.skill}/${q.source}/${(q.candidates || []).join(',')}`;

describe('checks with the content split per topic', () => {
  it('plans from the meta alone, then the same questions as before the split once the topics have loaded', async () => {
    // in the order of the registry before the split (the topics' order): some exercise generators remember what they
    // asked last, so the order is part of "the same seed"
    const skills: string[] = TOPICS.flatMap((t: any) => t.levels.map((_: any, i: number) => `${t.id}:${i + 1}`)).filter(hasContent);
    expect([...skills].sort()).toEqual(Object.keys(META).sort());
    const out: Record<string, any> = {};
    const plans: Record<string, Record<string, ReturnType<typeof checkPlan>>> = {};
    // the plans: no topic has loaded yet (contentOf would throw in development if checkPlan read the content)
    expect(topicsReady(skills)).toBe(false);
    for (const s of skills) {
      const misc = META[s].misconceptions[0]?.id;
      plans[s] = {
        mastery: checkPlan({ purpose: 'mastery', skill: s }, seeded(1)),
        review: checkPlan({ purpose: 'review', skill: s }, seeded(2)),
        verify: checkPlan({ purpose: 'verify', skill: s, misc }, seeded(3)),
      };
    }
    for (const g of ['7', '8']) {
      const sk = topicsFor(g).flatMap((t: any) => t.levels.map((_: any, i: number) => `${t.id}:${i + 1}`)).filter(hasContent);
      out[`diagnostic-${g}`] = checkPlan({ purpose: 'diagnostic', skills: sk }, seeded(4)).map((q) => `${q.skill}/${q.source}`);
      out[`exam-${g}`] = checkPlan({ purpose: 'exam', skills: sk.slice(0, 5) }, seeded(5)).map((q) => `${q.skill}/${q.source}`);
    }
    expect(topicsReady(skills)).toBe(false);

    // the questions: once ensureTopics resolved, as a lesson does before its first question
    await ensureTopics(skills);
    const realRandom = Math.random;
    try {
      for (const s of skills) {
        Math.random = seeded(7); // the stair's exercise generators draw from Math.random
        const items: string[] = [];
        for (const [k, plan] of Object.entries(plans[s])) plan.forEach((q, i) => items.push(`${k}${i}:${brief(itemFor(q.skill, q.source, seeded(100 + i), undefined, q.candidates, { test: true }))}`));
        for (const src of ['gen', 'diag', 'transfer'] as const) items.push(`${src}:${brief(itemFor(s, src, seeded(11)))}`);
        out[s] = { plans: Object.fromEntries(Object.entries(plans[s]).map(([k, p]) => [k, p.map(line)])), items };
      }
    } finally { Math.random = realRandom; }
    await expect(JSON.stringify(sortKeys(out), null, 1)).toMatchFileSnapshot('./__snapshots__/items-split.json');
  });
});

// A model answered as a fraction (DiagModel form 'frac'): two dice's probabilities are 1/36 apart, so a decimal answer
// would leave their documented errors ambiguous. The fixture is curriculum stage 3's prob:3 shape (P of a sum of two
// dice), before that stair exists.
describe('a model answered as a fraction', () => {
  type P = { s: number };
  const ways = (s: number) => 6 - Math.abs(7 - s); // ordered pairs of two dice with this sum
  const unordered = (s: number) => Math.ceil(ways(s) / 2); // (5, 6) and (6, 5) counted once
  const DICE: DiagModel<P> = {
    form: 'frac', precise: true,
    params: () => ({ s: 7 }),
    text: (p) => `מטילים שתי קוביות. מה ההסתברות שהסכום יהיה $${p.s}$?`,
    answer: (p) => ways(p.s) / 36,
    bugs: {
      'equiprob-sums': () => 1 / 11, // eleven sums, as if each were as likely
      unordered: (p) => unordered(p.s) / 36,
      'space-21': (p) => unordered(p.s) / 21,
    },
    solution: (p) => [`בטבלה $36$ תאים, ובסכום $${p.s}$ יש $${ways(p.s)}$ מהם.`],
    hint: () => 'ספרו את התאים בטבלה.',
  };
  const stair = { skill: 'prob:3', topic: 'prob', level: 3, title: 'ניסוי בשני שלבים' } as unknown as StairContent;
  const it7 = modelItem(stair, DICE, { s: 7 }, 'diag');

  it('makes an item in the fraction form, with no note on how to type a decimal', () => {
    expect(it7.form).toBe('frac');
    expect(it7.answer).toBeCloseTo(1 / 6, 12);
    expect(it7.text).toBe(DICE.text({ s: 7 }));
    expect(answerInput(it7)).toEqual({ n: 1, d: 6 });
    expect(answerText(it7)).toBe('1/6');
  });
  it('accepts the fraction as counted (6/36) and reduced (1/6), and nothing else', () => {
    expect(isCorrect(it7, { n: 6, d: 36 })).toBe(true);
    expect(isCorrect(it7, { n: 1, d: 6 })).toBe(true);
    expect(isCorrect(it7, readAnswer(it7, { n: '6', d: '36' }))).toBe(true);
    expect(isCorrect(it7, { n: 1, d: 11 })).toBe(false);
    expect(isCorrect(it7, { n: 6, d: 35 })).toBe(false);
  });
  it('diagnoses a typed fraction by its value: the same mistake however it is written', () => {
    expect(it7.diag({ n: 1, d: 11 })).toBe('equiprob-sums');
    expect(it7.diag({ n: 2, d: 22 })).toBe('equiprob-sums');
    expect(it7.diag({ n: 3, d: 36 })).toBe('unordered');
    expect(it7.diag({ n: 1, d: 12 })).toBe('unordered');
    expect(it7.diag({ n: 3, d: 21 })).toBe('space-21');
    expect(it7.diagnosis({ n: 1, d: 7 })).toMatchObject({ kind: 'misconception' });
    expect(it7.diag({ n: 5, d: 36 })).toBeNull();
    // a number still works where one is typed (the default form)
    expect(it7.diag(1 / 11)).toBe('equiprob-sums');
  });
  it('a model with no form is a number, as before', () => {
    const num = modelItem(stair, { ...DICE, form: undefined }, { s: 7 }, 'diag');
    expect(num.form).toBe('num');
  });
});

// Curriculum stage 3's real prob:3 (DATA-6): its model and its practice exercise answer as a fraction, as the fixture
// above does.
describe('prob:3, the sum of two dice, answered as a fraction', () => {
  it('its model: 6/36 and 1/6 right; 1/11, 3/36 and 3/21 the three documented errors', () => {
    const stair = PROB[2];
    expect(stair.skill).toBe('prob:3');
    const it7 = modelItem(stair, stair.diag!, { e: 'sum', t: 7, sums: [7] }, 'diag');
    expect(it7.form).toBe('frac');
    expect(isCorrect(it7, { n: 6, d: 36 })).toBe(true);
    expect(isCorrect(it7, { n: 1, d: 6 })).toBe(true);
    expect(isCorrect(it7, { n: 1, d: 11 })).toBe(false);
    expect(it7.diag({ n: 1, d: 11 })).toBe('equiprob-sums');
    expect(it7.diag({ n: 3, d: 36 })).toBe('unordered');
    expect(it7.diag({ n: 1, d: 7 })).toBe('space-21');
  });
  it('its practice exercise: the same, and a fraction near a prediction (1/10 for 1/11) names nothing', () => {
    let it7: any = null;
    for (let i = 0; i < 20000 && !it7; i += 1) { const x = makeItem('prob', 3); if (x.key === 'pr3:sum:7') it7 = x; }
    expect(it7, 'the generator makes sum 7').toBeTruthy();
    expect(it7.form).toBe('frac');
    expect(isCorrect(it7, { n: 6, d: 36 })).toBe(true);
    expect(isCorrect(it7, readAnswer(it7, { n: '1', d: '6' }))).toBe(true);
    expect(it7.diag({ n: 1, d: 11 })).toBe('equiprob-sums');
    expect(it7.diag({ n: 2, d: 22 })).toBe('equiprob-sums');
    expect(it7.diag({ n: 1, d: 12 })).toBe('unordered');
    expect(it7.diag({ n: 3, d: 21 })).toBe('space-21');
    expect(it7.diag({ n: 1, d: 10 })).toBeNull();
    expect(it7.diag({ n: 6, d: 36 })).toBeNull();
    // a verification's probe finds the three at once (the predictions, listed as fractions)
    expect(namesOf(it7).sort()).toEqual(['equiprob-sums', 'space-21', 'unordered']);
  });
});
