// The teaching content in Arabic (COUNCIL2-34): a topic of ARABIC_TOPICS is the Hebrew topic in Arabic words. Its
// twins are what scripts/gen-arabic.mjs makes from the Hebrew and content/ar/grade7.json; every translation keeps its
// values and its maths and says the programme's terms; the Arabic teaching, exercises and challenge tasks are the
// Hebrew ones with only the words changed (same stairs, steps, numbers, answers, the same questions from the same
// random numbers), and no Hebrew word is left in them; the names on the map follow the language, and come back in
// Hebrew. labels.arabic.test.js and guessing.arabic.test.ts run the label properties and the guessing measure again
// in Arabic.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// @ts-ignore: no Node types in this project
import { readFileSync, existsSync } from 'node:fs';
// @ts-ignore: no Node types in this project
import { join } from 'node:path';
// @ts-ignore: no Node types in this project
import { fileURLToPath } from 'node:url';
// @ts-ignore: plain JS
import { buildAll, unitsOf, readMap, idOf, TWINS, TWIN_TOPIC, twinOf } from '../../scripts/gen-arabic.mjs';
// @ts-ignore: plain JS
import { loadLocale, resetLocaleForTests } from '@/lib/i18n.js';
// @ts-ignore: plain JS
import { ARABIC_TOPICS, hasArabic, contentLang, arabicLesson } from '@/content/arabic.js';
// @ts-ignore: plain JS
import { lessonOf } from '@/content/lessons.js';
// @ts-ignore: plain JS
import { TOPIC, loadGens, gensReady, diagnosisLine, ambiguousText, catLabel } from '@/content/index.js';
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
      if (!r.code) {
        // a file whose Hebrew has texts without Arabic has no twin, and its topic is not taught in Arabic (a topic is
        // Arabic whole or not at all): the main branch's newer Hebrew of the directed numbers, until it is translated
        expect(existsSync(join(WEB, r.twin)), `${r.twin}: a stale twin (node scripts/gen-arabic.mjs build removes it)`).toBe(false);
        expect(ARABIC_TOPICS, `${r.file}: ${r.missing.length} texts have no Arabic (node scripts/gen-arabic.mjs check)`).not.toContain(TWIN_TOPIC[r.file]);
        continue;
      }
      expect(readFileSync(join(WEB, r.twin), 'utf8') === r.code, `${r.twin} is stale: node scripts/gen-arabic.mjs build`).toBe(true);
    }
  });

  it('a topic\'s twin keeps no Hebrew text: every string, template and template part is Arabic', () => {
    for (const f of TWINS.filter((x: string) => existsSync(join(WEB, twinOf(x))))) expect(unitsOf(readFileSync(join(WEB, twinOf(f)), 'utf8'), twinOf(f)).map((u: { he: string }) => u.he), f).toEqual([]);
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

// none since the round-3 merge (content/arabic.js): the block runs again once a topic is back in ARABIC_TOPICS
describe.skipIf(ARABIC_TOPICS.length === 0).each((ARABIC_TOPICS.length ? ARABIC_TOPICS : ['signed']) as TopicId[])('%s in Arabic', (topic) => {
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
    const words = JSON.stringify([TOPIC[topic].title, TOPIC[topic].desc, TOPIC[topic].levels.map((L: { title: string }) => L.title), TOPIC[topic].cats, arabicLesson(topic) || lessonOf(topic),
      Object.entries(META).filter(([s]) => s.startsWith(`${topic}:`)), CHALLENGE_META.filter((c) => c.topic === topic).map((c) => c.title)]);
    expect(words.match(/[֐-׿]+/g)).toBeNull();
    expect((arabicLesson(topic) || lessonOf(topic))?.points?.length).toBeGreaterThan(0);
    // a topic without Arabic yet keeps its Hebrew on an Arabic device
    expect(hasArabic('coord')).toBe(false);
    expect(JSON.stringify(TOPIC.coord)).toBe(coord);
    he();
    expect(JSON.stringify([TOPIC[topic], Object.entries(META).filter(([s]) => s.startsWith(`${topic}:`)), CHALLENGE_META.filter((c) => c.topic === topic)])).toBe(before);
  });
});

describe('loading follows the language', () => {
  it('ensureTopics waits for an Arabic topic\'s Arabic teaching and exercises; a topic without its Arabic is the same Hebrew in both', async () => {
    // every topic of the main branch falls back to its Hebrew on an Arabic device (content/arabic.js ARABIC_TOPICS):
    // the same teaching objects, the same generators and the same names as on a Hebrew device
    ar();
    for (const t of ['signed', 'coord', 'area', 'func', 'transf', 'congr', 'prob', 'space']) expect(contentLang(`${t}:1`), t).toBe(ARABIC_TOPICS.includes(t) ? 'ar' : 'he');
    await ensureTopics(['signed:1', 'coord:1', 'area:1', 'func:1']);
    expect(topicsReady(['signed:1', 'coord:1', 'area:1', 'func:1'])).toBe(true);
    expect(gensReady('signed')).toBe(true);
    const a = contentOf('signed:1');
    const c = contentOf('coord:1');
    const g = (TOPIC.signed.levels[0] as { gen?: unknown }).gen;
    const title = TOPIC.area.title;
    he();
    expect(contentOf('signed:1')).toBe(a);
    expect(JSON.stringify(a?.discover)).toMatch(HEBREW);
    expect(contentOf('coord:1')).toBe(c);
    expect((TOPIC.signed.levels[0] as { gen?: unknown }).gen).toBe(g);
    expect(TOPIC.area.title).toBe(title);
  });

  it('the lesson\'s words about a mistake and an object\'s answer are in the language on screen', () => {
    ar();
    const line = diagnosisLine('signed', 1, { cat: 'sign' });
    expect(line).toMatch(/^ما الذي حدث على الأرجح: /);
    // a topic without its Arabic names its mistake in Hebrew, inside the Arabic sentence
    expect(line?.replace(/^ما الذي حدث على الأرجح: /, '')).toBe(`${catLabel('signed', 1, 'sign')}.`);
    expect(ambiguousText('signed', 1, [{ id: 'sign' }, { id: 'abs-add' }])).toMatch(/^ما الذي حدث على الأرجح: ربما /);
    const pins = { manip: { kind: 'pins', labels: ['-2', '\\frac{1}{2}'], min: -5, max: 5 }, answer: [-2, 0.5] };
    expect(manipText(pins)).toMatch(/عند/);
    expect(manipText(pins)).not.toMatch(HEBREW);
    he();
    expect(diagnosisLine('signed', 1, { cat: 'sign' })).toMatch(/^מה כנראה קרה: /);
    expect(manipText(pins)).toMatch(/ב־/);
  });
});
