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

import { checkPlan, itemFor } from './items';
import { ensureTopics, topicsReady, hasContent, META } from './content/index';
// @ts-ignore: plain JS
import { TOPICS, topicsFor } from '@/content/index.js';

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
