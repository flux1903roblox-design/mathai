// The exercise generators, loaded per topic (COUNCIL2-14): topics.gen.js and learn/challenges/meta.gen.ts are what
// scripts/gen-topic-meta.mjs would write from the grade files and the challenge tasks, every topic's stairs get their
// generators from its own file, and before a topic has loaded makeItem refuses (in a fresh copy of content/index.js:
// the test setup loads every topic for the other tests).
import { describe, it, expect, vi } from 'vitest';
import { renderTopicMeta, renderChallengeMeta, stripTopic, CHALLENGE_KEYS } from '../../scripts/gen-topic-meta.mjs';
import topicMetaText from './topics.gen.js?raw';
import challengeMetaText from '../learn/challenges/meta.gen.ts?raw';
import { TOPIC_META } from './topics.gen.js';
import { GRADE7 } from './grade7.js';
import { GRADE8 } from './grade8.js';
import { TOPICS, makeItem, gensReady, loadGens } from './index.js';
import { CHALLENGES } from '@/learn/challenges/index';
import { CHALLENGE_META } from '@/learn/challenges/meta.gen';

const FULL = [...GRADE7, ...GRADE8];

describe('what is known before the generators load', () => {
  it('topics.gen.js is what the script writes from grade7.js and grade8.js (run node scripts/gen-topic-meta.mjs)', () => {
    expect(topicMetaText).toBe(renderTopicMeta(FULL));
    expect(TOPIC_META).toEqual(FULL.map(stripTopic));
  });

  it('the meta holds no function: every stair keeps its title, and loses only its gen', () => {
    const fns = [];
    const walk = (v, at) => { if (typeof v === 'function') fns.push(at); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`); };
    TOPIC_META.forEach((t) => walk(t, t.id));
    expect(fns).toEqual([]);
    for (const t of FULL) {
      const meta = TOPIC_META.find((x) => x.id === t.id);
      expect(meta.levels.map((L) => L.title), t.id).toEqual(t.levels.map((L) => L.title));
      expect(Object.keys(meta.levels[0]).sort(), t.id).toEqual(Object.keys(t.levels[0]).filter((k) => k !== 'gen').sort());
    }
  });

  it('learn/challenges/meta.gen.ts is what the script writes from CHALLENGES, in the same order', () => {
    expect(challengeMetaText).toBe(renderChallengeMeta(CHALLENGES));
    expect(CHALLENGE_META).toEqual(CHALLENGES.map((t) => Object.fromEntries(CHALLENGE_KEYS.map((k) => [k, t[k]]))));
  });
});

describe('the generators, per topic', () => {
  it('once loaded, every stair of every topic has the generator of its own file', () => {
    const byId = Object.fromEntries(FULL.map((t) => [t.id, t]));
    expect(TOPICS.map((t) => t.id)).toEqual(FULL.map((t) => t.id));
    for (const t of TOPICS) {
      expect(gensReady(t.id), t.id).toBe(true);
      t.levels.forEach((L, i) => expect(L.gen, `${t.id}:${i + 1}`).toBe(byId[t.id].levels[i].gen));
    }
  });

  it('a fresh start: makeItem refuses a topic not loaded yet, loadGens loads it once, and other topics stay unloaded', async () => {
    vi.resetModules();
    const fresh = await import('./index.js');
    expect(fresh.gensReady('expr')).toBe(false);
    expect(() => fresh.makeItem('expr', 1)).toThrow(/makeItem\('expr', 1\): its generators have not loaded/);
    const p = fresh.loadGens('expr');
    expect(fresh.loadGens('expr')).toBe(p);
    await p;
    expect(fresh.gensReady('expr')).toBe(true);
    expect(fresh.makeItem('expr', 1)).toMatchObject({ topic: 'expr' });
    expect(fresh.gensReady('pct')).toBe(false);
    // a topic the app does not know is "ready": nothing to load
    expect(fresh.gensReady('nope')).toBe(true);
    await expect(fresh.loadGens('nope')).resolves.toBeUndefined();
  });

  it('the topics in one grade file load together: signed brings the other grade 7 topics in grade7.js', async () => {
    vi.resetModules();
    const fresh = await import('./index.js');
    await fresh.loadGens('signed');
    for (const t of GRADE7) expect(fresh.gensReady(t.id), t.id).toBe(true);
    expect(fresh.gensReady(GRADE8[0].id)).toBe(false);
  });

  it('this copy of the module (the one the other tests use) works as before', () => {
    expect(makeItem('signed', 1)).toMatchObject({ topic: 'signed' });
    return expect(loadGens('signed')).resolves.toBeUndefined();
  });
});
