// The teaching content in Arabic (COUNCIL2-34): a topic of ARABIC_TOPICS is the Hebrew topic in Arabic words. Its
// twins are what scripts/gen-arabic.mjs makes from the Hebrew and content/ar/grade7.json; every translation keeps its
// values and its maths and says the programme's terms; the Arabic teaching, exercises and challenge tasks are the
// Hebrew ones with only the words changed (same stairs, steps, numbers, answers, the same questions from the same
// random numbers), and no Hebrew word is left in them; the names on the map follow the language, and come back in
// Hebrew. labels.arabic.test.js and guessing.arabic.test.ts run the label properties and the guessing measure again
// in Arabic.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// @ts-ignore: no Node types in this project
import { readFileSync } from 'node:fs';
// @ts-ignore: no Node types in this project
import { join } from 'node:path';
// @ts-ignore: no Node types in this project
import { fileURLToPath } from 'node:url';
// @ts-ignore: plain JS
import { buildAll, unitsOf, readMap, idOf, TWINS, twinOf } from '../../scripts/gen-arabic.mjs';
// @ts-ignore: plain JS
import { loadLocale, resetLocaleForTests } from '@/lib/i18n.js';
// @ts-ignore: plain JS
import { ARABIC_TOPICS, hasArabic, contentLang } from '@/content/arabic.js';
// @ts-ignore: plain JS
import { TOPIC, loadGens, gensReady, diagnosisLine, ambiguousText } from '@/content/index.js';
// @ts-ignore: plain JS
import { manipText } from '@/content/manip.js';
// @ts-ignore: plain JS
import { termGaps } from '@/locales/terms.js';
import { META, loadTopic, contentOf, ensureTopics, topicsReady } from './content/index';
import { CHALLENGE_META } from './challenges/meta.gen';
import { challengesOf, challengeById } from './challenges/index';
import { seeded } from './expr';
import type { TopicId } from './types';

const WEB = fileURLToPath(new URL('../..', import.meta.url));
const HEBREW = /[֐-׿]/;
const VALUE = /⟦\d+⟧/g;
const values = (s: string) => (s.match(VALUE) || []).sort();
const maths = (s: string) => (s.match(/\$[^$]*\$/g) || []).sort();
const he = () => resetLocaleForTests('he');
const ar = () => resetLocaleForTests('ar');

beforeAll(async () => { await loadLocale('ar'); });
afterAll(() => he());

/**
 * The Arabic is the Hebrew with only its words changed: the same shape (keys, lengths), the same numbers and flags,
 * every text without Hebrew letters the same, and every Hebrew text an Arabic one. Functions are not compared here
 * (the exercises are compared by what they make).
 */
function sameBut(h: unknown, a: unknown, path: string, out: string[]) {
  if (typeof h === 'function') return;
  if (typeof h === 'string') {
    if (typeof a !== 'string') { out.push(`${path}: not a text`); return; }
    if (HEBREW.test(a)) out.push(`${path}: Hebrew left: ${a}`);
    if (!HEBREW.test(h) && a !== h) out.push(`${path}: ${JSON.stringify(a)} for ${JSON.stringify(h)}`);
    if (HEBREW.test(h) && !a.trim()) out.push(`${path}: empty`);
    return;
  }
  if (h == null || typeof h !== 'object') { if (a !== h) out.push(`${path}: ${String(a)} for ${String(h)}`); return; }
  if (a == null || typeof a !== 'object') { out.push(`${path}: missing`); return; }
  if (Array.isArray(h) !== Array.isArray(a)) { out.push(`${path}: not the same kind`); return; }
  const hk = Object.keys(h).sort(); const ak = Object.keys(a as object).sort();
  if (hk.join() !== ak.join()) { out.push(`${path}: keys ${ak.join()} for ${hk.join()}`); return; }
  for (const k of hk) sameBut((h as Record<string, unknown>)[k], (a as Record<string, unknown>)[k], `${path}.${k}`, out);
}
const diff = (h: unknown, a: unknown) => { const out: string[] = []; sameBut(h, a, '', out); return out; };

describe('the twins and the translations', () => {
  it('every twin is what scripts/gen-arabic.mjs builds now (after a Hebrew change: node scripts/gen-arabic.mjs build)', () => {
    for (const r of buildAll()) {
      expect(r.code, `${r.file}: ${r.missing.length} texts have no Arabic (node scripts/gen-arabic.mjs check)`).toBeTruthy();
      expect(readFileSync(join(WEB, r.twin), 'utf8') === r.code, `${r.twin} is stale: node scripts/gen-arabic.mjs build`).toBe(true);
    }
  });

  it('a topic\'s twin keeps no Hebrew text: every string, template and template part is Arabic', () => {
    for (const f of TWINS) expect(unitsOf(readFileSync(join(WEB, twinOf(f)), 'utf8'), twinOf(f)).map((u: { he: string }) => u.he), f).toEqual([]);
  });

  it('every translation keeps the Hebrew\'s values and maths, has no Hebrew, and says the programme\'s terms', () => {
    const map: Record<string, [string, string]> = readMap();
    expect(Object.keys(map).length).toBeGreaterThan(1000);
    for (const [id, [h, a]] of Object.entries(map)) {
      expect(idOf(h), `${id}: its id is its Hebrew's`).toBe(id);
      expect(HEBREW.test(a), `${id}: ${a}`).toBe(false);
      expect(values(a), `${id}: ${a}`).toEqual(values(h));
      expect(maths(a), `${id}: the maths of ${h}`).toEqual(maths(h));
      expect(termGaps(h, a), `${id}: ${h} → ${a}`).toEqual([]);
    }
  });
});

describe.each(ARABIC_TOPICS as TopicId[])('%s in Arabic', (topic) => {
  it('its teaching: the same stairs, steps and answers as the Hebrew, in Arabic words', async () => {
    he(); const h = await loadTopic(topic);
    ar(); const a = await loadTopic(topic);
    expect(a.map((c) => c.skill)).toEqual(h.map((c) => c.skill));
    expect(a.length).toBeGreaterThan(0);
    expect(diff(h, a)).toEqual([]);
  });

  it('its exercises: from the same random numbers, the same questions and answers as the Hebrew, in Arabic words', async () => {
    type Stair = { gen: () => unknown };
    he(); await loadGens(topic); const hg = (TOPIC[topic].levels as unknown as Stair[]).map((L) => L.gen);
    ar(); await loadGens(topic); const ag = (TOPIC[topic].levels as unknown as Stair[]).map((L) => L.gen);
    expect(ag.every((g: unknown, i: number) => typeof g === 'function' && g !== hg[i])).toBe(true);
    const real = Math.random;
    try {
      hg.forEach((g: () => unknown, i: number) => {
        for (let k = 0; k < 60; k += 1) {
          Math.random = seeded(1000 * i + k); const x = g();
          Math.random = seeded(1000 * i + k); const y = ag[i]();
          expect(diff(x, y), `${topic}:${i + 1} #${k}`).toEqual([]);
        }
      });
    } finally { Math.random = real; }
  });

  it('its challenge tasks: the Hebrew tasks in Arabic words', () => {
    he(); const h = challengesOf(topic);
    ar(); const a = challengesOf(topic);
    expect(a.length).toBe(h.length);
    expect(a.length).toBeGreaterThan(0);
    expect(diff(h, a)).toEqual([]);
    expect(challengeById(h[0].id)).toBe(a[0]);
  });

  it('its names follow the language: the map, the stairs, the misconceptions, the lesson summary, the challenge titles', () => {
    he();
    const before = JSON.stringify([TOPIC[topic], Object.entries(META).filter(([s]) => s.startsWith(`${topic}:`)), CHALLENGE_META.filter((c) => c.topic === topic)]);
    const coord = JSON.stringify(TOPIC.coord);
    ar();
    const words = JSON.stringify([TOPIC[topic].title, TOPIC[topic].desc, TOPIC[topic].levels.map((L: { title: string }) => L.title), TOPIC[topic].cats, TOPIC[topic].lesson,
      Object.entries(META).filter(([s]) => s.startsWith(`${topic}:`)), CHALLENGE_META.filter((c) => c.topic === topic).map((c) => c.title)]);
    expect(words.match(/[֐-׿]+/g)).toBeNull();
    expect(TOPIC[topic].lesson?.points?.length).toBeGreaterThan(0);
    // a topic without Arabic yet keeps its Hebrew on an Arabic device
    expect(hasArabic('coord')).toBe(false);
    expect(JSON.stringify(TOPIC.coord)).toBe(coord);
    he();
    expect(JSON.stringify([TOPIC[topic], Object.entries(META).filter(([s]) => s.startsWith(`${topic}:`)), CHALLENGE_META.filter((c) => c.topic === topic)])).toBe(before);
  });
});

describe('loading follows the language', () => {
  it('ensureTopics waits for an Arabic topic\'s Arabic teaching and exercises; a Hebrew topic is the same in both', async () => {
    ar();
    expect(contentLang('signed:1')).toBe('ar');
    expect(contentLang('coord:1')).toBe('he');
    await ensureTopics(['signed:1', 'coord:1']);
    expect(topicsReady(['signed:1', 'coord:1'])).toBe(true);
    expect(gensReady('signed')).toBe(true);
    const a = contentOf('signed:1');
    expect(JSON.stringify(a?.discover)).not.toMatch(HEBREW);
    const c = contentOf('coord:1');
    he();
    expect(contentOf('signed:1')).not.toBe(a);
    expect(JSON.stringify(contentOf('signed:1')?.discover)).toMatch(HEBREW);
    expect(contentOf('coord:1')).toBe(c);
  });

  it('the lesson\'s words about a mistake and an object\'s answer are in the language on screen', () => {
    ar();
    const line = diagnosisLine('signed', 1, { cat: 'sign' });
    expect(line).toMatch(/^ما الذي حدث على الأرجح: /);
    expect(line).not.toMatch(HEBREW);
    expect(ambiguousText('signed', 1, [{ id: 'sign' }, { id: 'abs-add' }])).not.toMatch(HEBREW);
    const pins = { manip: { kind: 'pins', labels: ['-2', '\\frac{1}{2}'], min: -5, max: 5 }, answer: [-2, 0.5] };
    expect(manipText(pins)).toMatch(/عند/);
    expect(manipText(pins)).not.toMatch(HEBREW);
    he();
    expect(diagnosisLine('signed', 1, { cat: 'sign' })).toMatch(/^מה כנראה קרה: /);
    expect(manipText(pins)).toMatch(/ב־/);
  });
});
