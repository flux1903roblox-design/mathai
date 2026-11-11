// The teaching content, one file per topic (DURABLE-11): every topic loads the same stairs as before the split,
// meta.gen.ts is what the generator writes and matches the loaded content, NEW_CATS is what it was, and every topic
// in TOPICS has a loadTopic case. The first tests run before any topic has loaded (each test file starts fresh).
import { describe, it, expect } from 'vitest';
import { loadTopic, contentOf, ensureTopics, topicsReady, hasContent, metaOf, META, NEW_CATS, CONTENT_TOPICS } from './content/index';
import type { StairContent } from './types';
import metaText from './content/meta.gen.ts?raw';
// @ts-ignore: plain JS
import { collectMeta, renderMeta } from '../../scripts/gen-content-meta.mjs';
// @ts-ignore: plain JS
import { TOPICS } from '@/content/index.js';
// the misconception names as the registry gathered them before the split: straight from each topic's file
import { CATS_SIGNED } from './content/signed';
import { CATS_COORD } from './content/coord';
import { CATS_ANGLES } from './content/angles';
import { CATS_EXPR } from './content/expr';
import { CATS_EQ } from './content/eq';
import { CATS_LINE1 } from './content/line1';
import { CATS_LINE2 } from './content/line2';
import { CATS_PYTH } from './content/pyth';
import { CATS_STATS } from './content/stats';
import { CATS_SYS } from './content/sys';
import { CATS_FRAC } from './content/frac';
import { CATS_SIGNED6 } from './content/signed6';
import { CATS_RATIO } from './content/ratio';
import { CATS_PCT } from './content/pct';
import { CATS_DATA } from './content/data';
import { CATS_PROB } from './content/prob';
// @ts-ignore: no Node types in this project
import { spawnSync } from 'node:child_process';
// @ts-ignore: no Node types in this project
import { execPath } from 'node:process';

const sortKeys = (v: any): any => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const topicIds: string[] = TOPICS.map((t: any) => t.id);

describe('before a topic has loaded', () => {
  it('the meta answers at once, and nothing has loaded', () => {
    expect(hasContent('signed:1')).toBe(true);
    expect(hasContent('signed:99')).toBe(false);
    expect(metaOf('line:5')?.title).toBeTruthy();
    expect(topicsReady(['signed:1'])).toBe(false);
  });
  it('in development, reading the content of a topic never asked for throws', () => {
    expect(() => contentOf('signed:1')).toThrow(/never loaded/);
    // a stair with no teaching content is simply not there
    expect(contentOf('signed:99')).toBeNull();
  });
  it('while a topic loads its content is null; once it has loaded it is there, and loading again changes nothing', async () => {
    const p = loadTopic('coord');
    expect(loadTopic('coord')).toBe(p);
    expect(contentOf('coord:1')).toBeNull();
    const list = await p;
    expect(contentOf('coord:1')).toBe(list.find((c) => c.skill === 'coord:1'));
    expect(topicsReady(['coord:2', 'coord'])).toBe(true);
    expect(await loadTopic('coord')).toBe(list);
  });
  it('ensureTopics takes skills or topics, waits for all of them, and gives one promise per set while it waits', async () => {
    const a = ensureTopics(['pyth:2', 'stats:1']);
    expect(ensureTopics(['stats', 'pyth:4'])).toBe(a);
    await a;
    expect(topicsReady(['pyth', 'stats'])).toBe(true);
    expect(contentOf('stats:5')?.skill).toBe('stats:5');
  });
});

describe('every topic, loaded on its own', () => {
  it('has a loadTopic case: its stairs load, and they are exactly the meta\'s stairs of that topic', async () => {
    expect([...CONTENT_TOPICS].sort()).toEqual([...topicIds].sort());
    for (const t of topicIds) {
      const list = await loadTopic(t);
      expect(list.length, `${t}: loadTopic has no case for this topic`).toBeGreaterThan(0);
      expect(list.every((c) => c.topic === t), t).toBe(true);
      expect(list.map((c) => c.skill).sort(), t).toEqual(Object.keys(META).filter((s) => s.startsWith(`${t}:`)).sort());
    }
  });
  it('has the same stairs and steps as before the split', async () => {
    const topics: Record<string, any> = {};
    for (const t of topicIds) {
      for (const c of (await loadTopic(t)) as StairContent[]) {
        const n = (topics[c.topic] ||= { stairs: 0, steps: 0, skills: {} });
        const s = {
          discover: c.discover.length,
          examples: c.examples.map((e) => e.steps.length),
          together: c.together.map((g) => g.steps.length),
          misconceptions: c.misconceptions.map((m) => m.remedy.length),
          objectives: c.objectives.length,
        };
        n.stairs += 1;
        n.steps += s.discover + [...s.examples, ...s.together, ...s.misconceptions].reduce((a, b) => a + b, 0);
        n.skills[c.skill] = s;
      }
    }
    // recorded on the code before the split; a deliberate content change updates it with vitest -u
    await expect(JSON.stringify(sortKeys(topics), null, 1)).toMatchFileSnapshot('./__snapshots__/content-split.counts.json');
  });
});

describe('meta.gen.ts', () => {
  it('is what the generator writes from the content files', () => {
    const files = import.meta.glob('./content/*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
    const content = Object.fromEntries(Object.entries(files).filter(([f]) => !/\/(index|meta\.gen)\.ts$/.test(f)));
    expect(renderMeta(collectMeta(content))).toBe(metaText);
  });
  it('and the build\'s own run of the generator agrees (node scripts/gen-content-meta.mjs --check)', () => {
    const r = spawnSync(execPath, ['scripts/gen-content-meta.mjs', '--check'], { encoding: 'utf8' });
    expect(r.stderr + r.stdout).toMatch(/up to date/);
    expect(r.status).toBe(0);
  }, 60_000);
  it('says for every stair what the loaded content says: title, misconception ids and titles, transfer', async () => {
    await ensureTopics(CONTENT_TOPICS);
    for (const [skill, m] of Object.entries(META)) {
      const c = contentOf(skill)!;
      expect(c, skill).toBeTruthy();
      expect(m.title, skill).toBe(c.title);
      expect(m.misconceptions, skill).toEqual(c.misconceptions.map((x) => ({ id: x.id, title: x.title })));
      expect(m.transfer, skill).toBe(!!c.transfer);
    }
  });
  it('keeps NEW_CATS as the registry had it before the split, keys in the same order', () => {
    const before: Record<string, Record<string, string>> = {
      signed: { ...CATS_SIGNED, ...CATS_SIGNED6 }, coord: CATS_COORD, angles: CATS_ANGLES, expr: CATS_EXPR, eq: CATS_EQ, line: { ...CATS_LINE1, ...CATS_LINE2 }, pyth: CATS_PYTH, stats: CATS_STATS, sys: CATS_SYS,
      // the curriculum lane's units, as its registry had them: the bridge unit (frac), signed:6 in its own file (its
      // names join signed's), and grade 8's ratio and percent; curriculum stage 3's data names all its own in the topic, and so does its probability
      frac: CATS_FRAC, ratio: CATS_RATIO, pct: CATS_PCT, data: CATS_DATA, prob: CATS_PROB,
    };
    expect(Object.keys(NEW_CATS).sort()).toEqual(Object.keys(before).sort());
    for (const t of Object.keys(before)) expect(JSON.stringify(NEW_CATS[t as keyof typeof NEW_CATS]), t).toBe(JSON.stringify(before[t]));
    // and the topics' names for mistakes include them (content/index.js)
    for (const t of TOPICS) for (const [k, v] of Object.entries(before[t.id] || {})) expect(t.cats[k], `${t.id} ${k}`).toBe(v);
  });
});
