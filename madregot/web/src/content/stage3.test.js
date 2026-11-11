// The whole-content check of curriculum stage 3 (data and probability), as the full check of every exercise did in
// November 2026 (16da4e2): 2,000 exercises of each of the stage's ten new stairs (data:1-4, stats:6-8, prob:1-3), and
// 500 questions of each stair's two diagnostic models (the checks' own questions), each read as the student and the
// tutor read it. For every one: the right answer is right and names no mistake; the answer as the app prints it,
// typed back, is right; no number on it is NaN or infinite and no text says "undefined"; every drawing has what it
// draws (bars and their values, rows, a table of outcomes, two sources) and says it in words; every piece of maths
// renders. Every wrong answer an exercise's diag() names has the topic's words for it, and labels.test.js checks each
// such label against its property on the same 2,000 exercises a stair. The per-topic tests sample 60 to 300.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import katex from 'katex';
import { TOPIC, makeItem, isCorrect, answerText, answerInput, readAnswer, figPlain, itemPlain, catLabel, fairForCheck } from './index.js';
import { manipText } from './manip.js';
import { nearCandidates } from './labels.sample.js';
import { seeded } from '@/learn/expr.ts';
import { itemFor, answerValue } from '@/learn/items.ts';
import { matchesValue } from '@/learn/misconceptions.ts';
import { loadTopic, contentOf } from '@/learn/content/index.ts';

const STAGE3_LEVELS = [['data', 1], ['data', 2], ['data', 3], ['data', 4], ['stats', 6], ['stats', 7], ['stats', 8], ['prob', 1], ['prob', 2], ['prob', 3]];
const N = 2000;
const N_MODEL = 500;
const SLOW = 120_000;

// a fixed random source (the generators use Math.random): the same 2,000 exercises on every run
const realRandom = Math.random;
beforeAll(async () => { Math.random = seeded(20261111); await Promise.all(['data', 'stats', 'prob'].map((t) => loadTopic(t))); });
afterAll(() => { Math.random = realRandom; });

const BAD_TEXT = /undefined|NaN|Infinity|\[object /;
/** Every number on an exercise is finite, every list has no hole, and no text says "undefined" or "NaN". */
function clean(x, path, out) {
  if (typeof x === 'function') return;
  if (typeof x === 'number') { if (!Number.isFinite(x)) out.push(`${path} is ${x}`); return; }
  if (typeof x === 'string') { if (BAD_TEXT.test(x)) out.push(`${path} says "${x.slice(0, 80)}"`); return; }
  if (x == null) { out.push(`${path} is ${x}`); return; }
  if (Array.isArray(x)) { x.forEach((v, i) => clean(v, `${path}[${i}]`, out)); return; }
  if (typeof x === 'object') Object.entries(x).forEach(([k, v]) => { if (v !== undefined) clean(v, `${path}.${k}`, out); });
}

const filled = (s) => typeof s === 'string' && s.trim().length > 0;
/** What a drawing must have so that it draws something: the parts of each figure type of the stage. */
function figHoles(f, where) {
  const out = [];
  const no = (m) => out.push(`${where}: ${m}`);
  if (!f || typeof f !== 'object') { no('no figure'); return out; }
  switch (f.type) {
    case 'chart': {
      const labels = f.mode === 'line' ? f.xs : f.cats;
      if (!Array.isArray(labels) || labels.length < 2) no(`a ${f.mode} chart with fewer than two categories`);
      else if (!labels.every((x) => filled(String(x ?? '')))) no('a category with no name');
      if (!Array.isArray(f.values) || f.values.length !== labels?.length) no('values that do not match the categories');
      else if (f.values.some((v) => !(v >= 0))) no('a negative or missing value');
      if (f.mode === 'pie' && !(f.values.reduce((a, b) => a + b, 0) > 0)) no('a pie of nothing');
      if (f.mode === 'picto' && !(f.key > 0)) no('a pictogram with no key');
      if ((f.mode === 'bar' || f.mode === 'line') && f.step != null && !(f.step > 0 && f.max >= Math.max(...f.values))) no('an axis that does not reach the tallest value');
      if (!['bar', 'pie', 'picto', 'line'].includes(f.mode)) no(`an unknown chart mode ${f.mode}`);
      break;
    }
    case 'table':
      if (!Array.isArray(f.rows) || !f.rows.length) no('a table with no rows');
      else {
        f.rows.forEach((r, i) => { if (!Array.isArray(r) || !r.length || r.some((c) => c === '' || c == null)) no(`row ${i} has an empty cell`); });
        if (f.head && f.rows.some((r) => r.length !== f.head.length)) no('a row that does not match the heading');
      }
      break;
    case 'outcomes': {
      if (!Array.isArray(f.cols) || f.cols.length < 2 || !f.cols.every((c) => filled(String(c)))) no('a table of outcomes with fewer than two outcomes');
      if (f.rows) {
        if (f.rows.length < 2) no('a two-stage table with one row');
        if (f.cells && (f.cells.length !== f.rows.length || f.cells.some((r) => r.length !== f.cols.length || r.some((c) => !filled(String(c)))))) no('cells that do not fill the table');
      }
      (f.marked || []).forEach(([i, j]) => { if (!(j >= 0 && j < f.cols.length) || (f.rows ? !(i >= 0 && i < f.rows.length) : i !== 0)) no(`a marked cell (${i}, ${j}) off the table`); });
      break;
    }
    case 'pair':
      if (!Array.isArray(f.items) || f.items.length !== 2) no('a pair that is not two sources');
      else f.items.forEach((x, i) => out.push(...figHoles(x, `${where} source ${i + 1}`)));
      break;
    default: no(`a figure type the stage does not draw: ${f.type}`);
  }
  const words = figPlain(f);
  if (!filled(words) || words.length < 12) no(`no words for the drawing: "${words}"`);
  if (BAD_TEXT.test(words)) no(`the words say "${words.slice(0, 80)}"`);
  return out;
}

const TEX_SEEN = new Set();
/** Every $...$ of the texts, and the display, renders (each different chunk once). */
function texHoles(it) {
  const out = [];
  const chunks = [];
  const grab = (s) => String(s || '').replace(/\$([^$]+)\$/g, (_, t) => { chunks.push(t); return ''; });
  grab(it.text); grab(it.hint); (it.solution || []).forEach(grab);
  if (it.display) chunks.push(it.display);
  (it.choices || []).forEach((c) => c.tex && chunks.push(c.tex));
  if (it.manip?.kind === 'simulate' && it.answer?.choices) it.answer.choices.forEach((c) => chunks.push(typeof c === 'string' ? c : c.tex));
  for (const tex of chunks) {
    if (TEX_SEEN.has(tex)) continue;
    try { katex.renderToString(tex, { throwOnError: true }); TEX_SEEN.add(tex); } catch (e) { out.push(`${tex}: ${e.message.slice(0, 80)}`); }
  }
  return out;
}

/** The answer as printed, typed back in the item's own boxes. */
function typedBack(it) {
  const shown = answerText(it);
  if (it.form === 'num') return readAnswer(it, { v: shown });
  if (it.form === 'frac') { const [n, d = '1'] = shown.split('/'); return readAnswer(it, { n, d }); }
  return answerInput(it);
}

/** A check question's diagnostic model and its parameters (its key is skill:source:parameters), or null. */
function modelOf(it) {
  const m = String(it.key).match(/^([a-z]+:\d+):(diag|transfer):(.*)$/);
  if (!m) return null;
  const c = contentOf(m[1]);
  return { model: m[2] === 'transfer' ? c.transfer : c.diag, p: JSON.parse(m[3]) };
}

/** Every problem of one exercise, as lines a failing test prints. */
function problems(it, where) {
  const out = [];
  const say = (m) => out.push(`${where} ${it.key}: ${m}`);
  if (!filled(it.key)) say('no key');
  if (!filled(it.text)) say('no question');
  if (!filled(it.hint)) say('no hint');
  if (!Array.isArray(it.solution) || !it.solution.length || !it.solution.every(filled)) say('a worked solution with an empty line');
  const { diag, diagnosis, ...rest } = it;
  const holes = []; clean(rest, 'item', holes); holes.forEach(say);
  // the right answer is right, and names no mistake
  const right = answerInput(it);
  if (!isCorrect(it, right)) say(`its own answer ${JSON.stringify(right)} is marked wrong`);
  if (it.diag(right) != null) say(`its own answer is diagnosed as ${it.diag(right)}`);
  // the answer as printed (the solution's last word, the tutor's key) reads back as right
  const shown = answerText(it);
  if (!filled(shown) || BAD_TEXT.test(shown)) say(`the answer prints as "${shown}"`);
  if (!isCorrect(it, typedBack(it))) say(`the printed answer "${shown}", typed back, is marked wrong`);
  if (it.form === 'num' && !Number.isFinite(it.answer)) say(`answer ${it.answer}`);
  if (it.form === 'mc') {
    if (!it.choices?.[it.answer]) say('the right choice is missing');
    const texts = (it.choices || []).map((c) => c.text || c.tex);
    if (!texts.every(filled)) say('an empty choice');
    if (new Set(texts).size !== texts.length) say(`two choices read the same: ${texts.join(' / ')}`);
  }
  if (it.form === 'manip' && !filled(manipText(it, right))) say('the object\'s answer has no words');
  // the drawing draws something and says it in words; the tutor's line names it
  if (it.fig) figHoles(it.fig, 'figure').forEach(say);
  const plain = itemPlain(it);
  if (plain.length < 10 || BAD_TEXT.test(plain)) say(`the tutor reads "${plain.slice(0, 80)}"`);
  if (it.fig && !/\[.+\]/.test(plain)) say('the tutor\'s line has no drawing');
  texHoles(it).forEach((m) => say(`KaTeX: ${m}`));
  // every mistake a wrong answer is named has words on this stair; on a check's question, the named misconception's
  // own prediction is the answer given (as typed: rounded to tenths or hundredths), and for an exercise of the
  // generators labels.test.js reads the label against its property
  const mp = modelOf(it);
  const preds = mp ? Object.values(mp.model.bugs).map((f) => f(mp.p)).filter((v) => v != null && Number.isFinite(v)) : null;
  for (const u of nearCandidates(mp ? { ...it, diag: { wrongs: preds } } : it)) {
    if (isCorrect(it, u)) continue;
    const cat = it.diag(u);
    if (!cat) continue;
    if (!(cat in TOPIC[it.topic].cats && catLabel(it.topic, it.level, cat))) say(`${JSON.stringify(u)} is named "${cat}", which has no words`);
    if (mp && !matchesValue(mp.model.bugs[cat](mp.p), answerValue(u), mp.model.answer(mp.p))) say(`${JSON.stringify(u)} is named "${cat}", whose prediction is ${mp.model.bugs[cat](mp.p)}`);
  }
  return out;
}

describe('curriculum stage 3, the whole-content check: 2,000 exercises of every new stair', () => {
  it.each(STAGE3_LEVELS)('%s:%i, the practice exercises', (topic, level) => {
    const bad = []; const kinds = new Map(); let named = 0;
    for (let i = 0; i < N; i += 1) {
      const it = makeItem(topic, level);
      const kind = it.key.split(':')[0];
      kinds.set(kind, (kinds.get(kind) || 0) + 1);
      bad.push(...problems(it, `${topic}:${level}`));
      if (it.diag?.wrongs?.length) named += 1;
      if (bad.length > 20) break;
    }
    expect(bad).toEqual([]);
    // every kind of exercise of the stair is drawn, often enough to mean something
    expect(kinds.size, [...kinds.keys()].join(', ')).toBeGreaterThan(2);
    [...kinds.values()].forEach((n) => expect(n).toBeGreaterThan(50));
    expect(named).toBeGreaterThan(N / 4); // most exercises list the answers their diag() names
  }, SLOW);

  it.each(STAGE3_LEVELS)('%s:%i, the questions of its checks (the diagnostic model and the transfer)', (topic, level) => {
    const bad = []; const rnd = seeded(level * 101 + topic.length);
    for (const source of ['diag', 'transfer']) {
      for (let i = 0; i < N_MODEL; i += 1) {
        const it = itemFor(`${topic}:${level}`, source, rnd, undefined, undefined, { test: true });
        expect(it.source, `${topic}:${level} ${source}: a question of the stair's own model`).toBe(source);
        expect(fairForCheck(it)).toBe(true);
        bad.push(...problems(it, `${topic}:${level} ${source}`));
        if (bad.length > 20) break;
      }
    }
    expect(bad).toEqual([]);
  }, SLOW);
});

describe('the whole-content check finds what it looks for', () => {
  // a typed exercise whose diag() lists its predictions
  const base = () => { for (;;) { const it = makeItem('data', 2); if (it.form === 'num' && it.diag.wrongs?.length) return it; } };
  it('a NaN, an undefined in a text, a hole in a list', () => {
    const out = [];
    clean({ a: NaN, b: 'השכיחות היא undefined', c: [1, undefined, 3], d: { e: Infinity } }, 'x', out);
    expect(out).toEqual(['x.a is NaN', 'x.b says "השכיחות היא undefined"', 'x.c[1] is undefined', 'x.d.e is Infinity']);
  });
  it('an empty chart, a table with an empty cell, a pair of one source, a table of one outcome', () => {
    expect(figHoles({ type: 'chart', mode: 'bar', cats: [], values: [] }, 'f').join(' ')).toMatch(/fewer than two categories/);
    expect(figHoles({ type: 'chart', mode: 'bar', cats: ['א', 'ב'], values: [3, 9], step: 2, max: 6 }, 'f').join(' ')).toMatch(/does not reach/);
    expect(figHoles({ type: 'table', head: ['א', 'ב'], rows: [['כלב', '']] }, 'f').join(' ')).toMatch(/empty cell/);
    expect(figHoles({ type: 'pair', items: [{ type: 'table', rows: [['א', 1]] }] }, 'f').join(' ')).toMatch(/not two sources/);
    expect(figHoles({ type: 'outcomes', cols: ['1'] }, 'f').join(' ')).toMatch(/fewer than two outcomes/);
  });
  it('an own answer named as a mistake, an answer that is not a number, a name with no words, an empty hint', () => {
    const it = base();
    expect(problems({ ...it, diag: Object.assign(() => 'part-part', { wrongs: [] }) }, 'x').join(' ')).toMatch(/its own answer is diagnosed as part-part/);
    expect(problems({ ...it, answer: NaN }, 'x').join(' ')).toMatch(/item\.answer is NaN/);
    const named = { ...it, diag: Object.assign((u) => (u === it.answer ? null : 'no-such-mistake'), { wrongs: [it.answer + 0.3] }) };
    expect(problems(named, 'x').join(' ')).toMatch(/named "no-such-mistake", which has no words/);
    expect(problems({ ...it, hint: '' }, 'x').join(' ')).toMatch(/no hint/);
    expect(problems(it, 'x')).toEqual([]);
  });
});
