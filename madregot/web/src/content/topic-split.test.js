// The exercise generators, loaded per topic (the boot split): topics.gen.js is what scripts/gen-content-meta.mjs writes
// from the grade files, every topic's stairs get their functions from its own file, and before a topic has loaded
// makeItem refuses (in a fresh copy of content/index.js: the test setup loads every topic for the other tests).
// learn/content-split.test.ts checks the same script's other two files (meta.gen.ts and learn/challenges/meta.gen.ts)
// and runs its --check.
import { describe, it, expect, vi } from 'vitest';
import { renderTopicMeta, stripTopic } from '../../scripts/gen-content-meta.mjs';
import topicMetaText from './topics.gen.js?raw';
import { TOPIC_META } from './topics.gen.js';
import { GRADE7 } from './grade7.js';
import { GRADE8 } from './grade8.js';
import { TOPICS, makeItem, gensReady, loadGens, ensureGens } from './index.js';

const FULL = [...GRADE7, ...GRADE8];

/** Every path in a value that holds a function. */
function fnPaths(v, at, out = []) {
  if (typeof v === 'function') out.push(at);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) fnPaths(x, `${at}.${k}`, out);
  return out;
}

describe('what is known before the generators load', () => {
  it('topics.gen.js is what the script writes from grade7.js and grade8.js (run node scripts/gen-content-meta.mjs)', () => {
    expect(topicMetaText).toBe(renderTopicMeta(FULL));
    expect(TOPIC_META).toEqual(FULL.map((t) => stripTopic(t)));
  });

  it('the meta holds no function: every stair keeps its title and every other plain field, and loses only its functions', () => {
    expect(TOPIC_META.flatMap((t) => fnPaths(t, t.id))).toEqual([]);
    for (const t of FULL) {
      const meta = TOPIC_META.find((x) => x.id === t.id);
      expect(meta.levels.map((L) => L.title), t.id).toEqual(t.levels.map((L) => L.title));
      t.levels.forEach((L, i) => expect(Object.keys(meta.levels[i]).sort(), `${t.id}:${i + 1}`).toEqual(Object.keys(L).filter((k) => typeof L[k] !== 'function').sort()));
    }
  });

  it('only plain data can be in the meta: a value that would not survive the file is an error that says where it is', () => {
    expect(() => stripTopic({ id: 'x', levels: [{ title: 'a', re: /a/ }] })).toThrow(/x\.levels\[0\]\.re: a RegExp/);
    expect(() => stripTopic({ id: 'x', n: NaN })).toThrow(/x\.n: NaN/);
    expect(stripTopic({ id: 'x', levels: [{ title: 'a', gen: () => 1, testGen: () => 2 }], undef: undefined })).toEqual({ id: 'x', levels: [{ title: 'a' }] });
  });
});

describe('the generators, per topic', () => {
  it('once loaded, every function of every topic is the one of its own file, in the same place', () => {
    const byId = Object.fromEntries(FULL.map((t) => [t.id, t]));
    expect(TOPICS.map((t) => t.id)).toEqual(FULL.map((t) => t.id));
    for (const t of TOPICS) {
      expect(gensReady(t.id), t.id).toBe(true);
      const want = fnPaths(byId[t.id], t.id);
      expect(want.length, `${t.id}: a topic has generators`).toBeGreaterThan(0);
      expect(fnPaths(t, t.id), t.id).toEqual(want);
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

  it('the topics in one grade file load together: signed brings the other topics of grade7.js', async () => {
    vi.resetModules();
    const fresh = await import('./index.js');
    await fresh.loadGens('signed');
    for (const t of GRADE7) expect(fresh.gensReady(t.id), t.id).toBe(true);
    expect(fresh.gensReady('pyth')).toBe(false);
  });

  it('ensureGens takes topics or skills and loads only theirs; ensureTopics (the lesson\'s wait) loads them too', async () => {
    vi.resetModules();
    const fresh = await import('./index.js');
    await fresh.ensureGens(['ratio:2', 'pct']);
    expect(['ratio', 'pct'].map(fresh.gensReady)).toEqual([true, true]);
    expect(fresh.gensReady('sys')).toBe(false);
    const content = await import('@/learn/content/index.ts');
    await content.ensureTopics(['sys:1']);
    expect(fresh.gensReady('sys')).toBe(true);
    expect(fresh.makeItem('sys', 1)).toMatchObject({ topic: 'sys', level: 1 });
  });

  it('this copy of the module (the one the other tests use) works as before', async () => {
    expect(makeItem('signed', 1)).toMatchObject({ topic: 'signed' });
    await expect(loadGens('signed')).resolves.toBeUndefined();
    await expect(ensureGens(['signed:2'])).resolves.toBeUndefined();
  });
});
