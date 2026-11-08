import { describe, it, expect } from 'vitest';
// @ts-ignore: plain JS
import * as lessonJs from '@/lib/lesson.js';
// @ts-ignore: plain JS
import { isCorrect } from '@/content/index.js';
import { learnAfterAnswer, learnAfterCheck, migrateLearn, emptyLearn } from './storeGlue';
import { masteryState } from './mastery';
import { addSubModel } from './content/signed';
import { ALL_SKILLS } from './skills';
import { contentOf } from './content/index';

// the lesson engine is plain JS: its inferred types are too narrow for these tests
const { startLesson, answer, next, resultOf } = lessonJs as any;

/** Play a whole lesson, answering right except where wrong(i, item) gives a wrong answer. */
function play(s: any, wrong: (i: number, it: any) => number | null = () => null) {
  const seen: any[] = [];
  for (let i = 0; i < 40 && !s.finished; i += 1) {
    const it = s.item; seen.push(it);
    const w = wrong(i, it);
    const u = w == null ? it.answer : w;
    let r = answer(s, u);
    if (r.s.phase === 'retry') r = answer(r.s, it.answer);
    s = next(r.s);
  }
  return { s, seen };
}

describe('the mastery check', () => {
  it('asks 5 questions without hints, from the generator and the diagnostic models, and needs 4', () => {
    const s0 = startLesson({ kind: 'check', purpose: 'mastery', skill: 'signed:1' });
    expect(s0.total).toBe(5);
    const { s, seen } = play(s0);
    expect(new Set(seen.map((it: any) => it.source || 'gen')).size).toBeGreaterThan(1);
    const r = resultOf(s);
    expect(r).toMatchObject({ kind: 'check', purpose: 'mastery', right: 5, asked: 5, passed: true });
    const two = resultOf(play(startLesson({ kind: 'check', purpose: 'mastery', skill: 'signed:1' }), (i, it) => (i < 2 ? it.answer + 37 : null)).s);
    expect(two).toMatchObject({ right: 3, passed: false, xp: 0 });
  });
  it('gives one try: a miss shows the answer, no retry', () => {
    const s0 = startLesson({ kind: 'check', purpose: 'mastery', skill: 'signed:1' });
    const r = answer(s0, s0.item.answer + 37);
    expect(r.s.phase).toBe('reveal');
    expect(r.result.event.purpose).toBe('mastery');
  });
});

describe('the verification after a repair', () => {
  it('asks questions where the misconception would show, and fails when it shows again', () => {
    const s0 = startLesson({ kind: 'check', purpose: 'verify', skill: 'signed:1', misc: 'minus-minus' });
    expect(s0.item.could).toContain('minus-minus');
    const { s } = play(s0, (_i, it) => addSubModel.bugs['minus-minus'](JSON.parse(it.key.split(':probe:')[1])));
    const r = resultOf(s);
    expect(r.showed).toBeGreaterThan(0);
    expect(r.passed).toBe(false);
  });
});

describe('the Exam Rescue diagnostic', () => {
  it('asks every chosen stair and reports each', () => {
    const { s } = play(startLesson({ kind: 'check', purpose: 'diagnostic', skills: ['signed:1', 'coord:1', 'angles:1'] }));
    const r = resultOf(s);
    expect(Object.keys(r.perSkill).sort()).toEqual(['angles:1', 'coord:1', 'signed:1']);
    Object.values(r.perSkill).forEach((x: any) => expect(x.asked).toBe(2));
  });
});

describe('practice on a stair with teaching content', () => {
  it('mixes in a diagnostic and a transfer question', () => {
    const { seen } = play(startLesson({ kind: 'node', topic: 'signed', level: 1, part: 1 }));
    expect(seen[3].source).toBe('diag');
    expect(seen[6].source).toBe('transfer');
    seen.forEach((it: any) => expect(isCorrect(it, it.answer)).toBe(true));
  });
  it('adds one question that tells apart two misconceptions an answer could mean', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 1, part: 1 });
    // reach the diagnostic question and give an answer two misconceptions explain
    for (let i = 0; i < 3; i += 1) { s = next(answer(s, s.item.answer).s); }
    const p = { a: -4, b: -7, s: -1 };
    s = { ...s, item: { ...s.item, key: 'x', answer: 3, diagnosis: (u: number) => (u === 3 ? { kind: 'right' } : { kind: 'misconception', ambiguous: true, candidates: [{ id: 'minus-minus', conf: 0.5 }, { id: 'abs-add', conf: 0.5 }] }), could: [] } };
    const r = answer(s, -11);
    expect(r.s.probes).toHaveLength(1);
    expect(r.result.event.cands).toHaveLength(2);
    let t = answer(r.s, 3).s;
    for (let i = 0; i < 20 && !t.item?.probe && !t.finished; i += 1) t = next(i === 0 ? t : answer(t, t.item.answer).s);
    expect(t.item.probe).toEqual(['minus-minus', 'abs-add']);
    expect(addSubModel.answer(p)).toBe(3);
  });
});

describe('the store glue', () => {
  const at = '2026-11-08T10:00:00.000Z';
  it('counts a first try without help as independent, and help as help', () => {
    let L = learnAfterAnswer(emptyLearn(), { topic: 'signed', level: 1, ok: false, retry: true, hint: false, at, cat: 'sign', key: 'q1' });
    L = learnAfterAnswer(L, { topic: 'signed', level: 1, ok: true, first: false, hint: true, at, key: 'q1' });
    const a = L.skills['signed:1'].attempts;
    expect(a.map((x) => x.independent)).toEqual([true, false]);
    expect(L.miscon['signed:1|sign'].state).toBe('suspected');
  });
  it('confirms a misconception seen on two questions, and a passed mastery check masters the stair', () => {
    let L = emptyLearn();
    ['q1', 'q2'].forEach((key) => { L = learnAfterAnswer(L, { topic: 'signed', level: 1, ok: false, retry: true, at, key, cands: [{ id: 'minus-minus', conf: 1 }] }); });
    expect(L.miscon['signed:1|minus-minus'].state).toBe('confirmed');
    L = learnAfterCheck(L, { purpose: 'mastery', skill: 'signed:1', right: 4, asked: 5, perSkill: {} }, at, '2026-11-08');
    expect(masteryState(L.skills['signed:1'], at)).toBe('mastered');
    expect(L.events.some((e) => e.e === 'check-done' && e.p === 'mastery' && e.ok)).toBe(true);
  });
  it('takes evidence against a misconception only from questions where it could have shown', () => {
    let L = learnAfterAnswer(emptyLearn(), { topic: 'signed', level: 1, ok: false, retry: true, at, key: 'q1', cands: [{ id: 'minus-minus', conf: 1 }] });
    ['g1', 'g2', 'g3', 'g4'].forEach((key) => { L = learnAfterAnswer(L, { topic: 'signed', level: 1, ok: true, first: true, at, key }); });
    expect(L.miscon['signed:1|minus-minus'].score).toBe(1); // right answers to other questions say nothing
    L = learnAfterAnswer(L, { topic: 'signed', level: 1, ok: true, first: true, at, key: 'd1', could: ['minus-minus'] });
    expect(L.miscon['signed:1|minus-minus'].score).toBe(0.5);
  });
  it('migrates the misconceptions an older version recorded, without inventing any', () => {
    const L = migrateLearn({ 'signed:sign': { level: 1, n: 3, ok: 0, at }, 'coord:swap': { level: 2, n: 1, ok: 0, at }, 'stats:mode-max': { level: 1, n: 4, ok: 3 }, 'line:exam:שיפוע': { level: 4, n: 1, ok: 0, exam: true } });
    expect(L.miscon['signed:1|sign'].state).toBe('confirmed');
    expect(L.miscon['coord:2|swap'].state).toBe('suspected');
    expect(Object.keys(L.miscon)).toHaveLength(2);
    expect(L.skills).toEqual({});
  });
});

describe('every stair supports its checks', () => {
  it.each(ALL_SKILLS)('%s: a mastery check, a review, and a verification for every misconception it can diagnose', (skill) => {
    const c = contentOf(skill)!;
    expect(c, `${skill} has teaching content`).toBeTruthy();
    for (const purpose of ['mastery', 'review']) {
      const { s } = play(startLesson({ kind: 'check', purpose, skill }));
      const r = resultOf(s);
      expect(r.passed, `${skill} ${purpose}`).toBe(true);
      expect(r.asked).toBe(purpose === 'mastery' ? 5 : 3);
    }
    const ids = new Set<string>([...Object.keys(c.diag.bugs), ...Object.keys(c.transfer?.bugs || {})]);
    ids.forEach((misc) => {
      const s0 = startLesson({ kind: 'check', purpose: 'verify', skill, misc });
      // the verification asks questions where this misconception would show
      expect(s0.item.could, `${skill} verify ${misc}`).toContain(misc);
      const r = resultOf(play(s0).s);
      expect(r.passed, `${skill} verify ${misc}`).toBe(true);
    });
  });
});
