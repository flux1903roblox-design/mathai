import { describe, it, expect } from 'vitest';
import { scoreOf, makePracticeExam, weakTopics, buildPlan, focusLevel, baseEntry, PLAN_WINS } from './exam.js';
import { TOPIC } from '@/content/index.js';
import { startSession, nextQuestion, submit, withHint, FAST, NEED } from './ladder.js';
import { readAnswer } from '@/content/index.js';
import { vi, afterEach } from 'vitest';
import { makeClassExam, freezeItem, thawItem, examKey, classExamTitle, CLASS_EXAM_LENGTHS } from './exam.js';
import { isCorrect, fairForCheck, roundedLength, answerInput } from '@/content/index.js';
import { ALL_SKILLS, parseSkill } from '@/learn/skills.ts';
import { itemFor } from '@/learn/items.ts';
// the server's own validator: a class exam the app makes is one the Worker keeps as it is
import { cleanExamItems } from '../../../worker/src/assignments.js';

describe('exam', () => {
  it('scores partial answers as half', () => {
    expect(scoreOf({ questions: [{ status: 'correct' }, { status: 'partial' }, { status: 'wrong' }, { status: 'missing' }] })).toEqual({ correct: 1.5, total: 4, pct: 38 });
    expect(scoreOf({ questions: [] }).pct).toBe(0);
  });
  it('builds a practice exam with exact answers, spread over the topics', () => {
    const items = makePracticeExam(['line', 'pyth'], 8, { line: { level: 6 } });
    expect(items).toHaveLength(8);
    expect(new Set(items.map((i) => i.key)).size).toBe(8);
    expect(items.filter((i) => i.topic === 'line')).toHaveLength(4);
    for (const i of items) {
      expect(i.answer).toBeTruthy();
      expect(i.level).toBeGreaterThanOrEqual(1);
      expect(i.level).toBeLessThanOrEqual(TOPIC[i.topic].levels.length);
      expect(() => JSON.stringify(i)).not.toThrow();
    }
    expect(makePracticeExam(['nope'], 5)).toEqual([]);
  });
  it('ranks weak topics from exams and practice mistakes', () => {
    const exams = [{ result: { questions: [
      { topic: 'line', status: 'wrong', skill: 'שיפוע' }, { topic: 'line', status: 'partial', skill: 'חיתוך עם ציר x' },
      { topic: 'pyth', status: 'correct' }, { topic: 'other', status: 'wrong' },
    ] } }];
    const w = weakTopics({ exams, mistakes: { 'stats:mode-max': 2, 'line:sign': 1 } });
    expect(w.map((x) => x.topic)).toEqual(['line', 'stats']);
    expect(w[0].examLost).toBe(1.5);
    expect(w[0].skills).toContain('שיפוע');
  });
  it('targets the level where the exam lost points, and counts wins there', () => {
    const t0 = '2026-11-01T10:00:00.000Z';
    const exams = [{ at: t0, result: { questions: [
      { topic: 'line', status: 'wrong', level: 6, skill: 'חיתוך עם הצירים' },
      { topic: 'line', status: 'partial', level: 4 },
      { topic: 'line', status: 'correct', level: 2 },
    ] } }];
    expect(focusLevel('line', exams)).toBe(6);
    expect(focusLevel('pyth', exams)).toBe(null);
    const base = { line: baseEntry('line', 6, { 'line:6': 1 }, t0) };
    const before = buildPlan({ exams, progress: { line: { level: 2, max: 2 } }, streak: 1, base, wins: { 'line:6': 3 } });
    expect(before.steps.map((s) => s.kind)).toEqual(['practice', 'exam', 'habit']);
    expect(before.steps[0]).toMatchObject({ level: 6, have: 2, need: PLAN_WINS, done: false, to: '/practice/line?level=6&from=plan' });
    expect(before.steps[1].done).toBe(false);
    // two wins at level 6, then two more after climbing to level 7
    const after = buildPlan({ exams: [{ at: '2026-11-03T10:00:00.000Z', result: { questions: [] } }, ...exams], progress: {}, streak: 6, base, wins: { 'line:5': 9, 'line:6': 3, 'line:7': 2 } });
    expect(after.steps[0].done).toBe(true);
    expect(after.steps[1].done).toBe(true); // a later exam is the retest
    expect(after.steps[2].done).toBe(true);
    expect(buildPlan({}).steps.map((s) => s.kind)).toEqual(['habit']);
  });
  it('keeps a practice-only step at the level it started on', () => {
    const base = { stats: baseEntry('stats', 2, {}, '2026-11-01T10:00:00.000Z') };
    const plan = buildPlan({ mistakes: { 'stats:mode-max': 3 }, progress: { stats: { level: 4, max: 4 } }, base, wins: { 'stats:2': 4 } });
    expect(plan.steps[0]).toMatchObject({ topic: 'stats', level: 2, done: true });
  });
});

describe('ladder', () => {
  const solve = (s) => submit(s, s.item.answer, String(s.item.answer));
  it('moves up after two in a row', () => {
    let s = nextQuestion(startSession('signed', { level: 1 }));
    while (s.item.form !== 'num') s = nextQuestion(s);
    for (let i = 0; i < FAST; i++) { s = solve(s).s; if (s.level > 1) break; s = nextQuestion(s); while (s.item.form !== 'num' || s.item.level !== s.level) s = nextQuestion(s); }
    expect(s.level).toBe(2);
  });
  it('needs four after a mistake, and brings the wrong question back', () => {
    let s = nextQuestion(startSession('line', { level: 1 }));
    const first = s.item;
    let r = submit(s, first.answer + 100, 'x'); s = r.s;
    expect(r.result.retry).toBe(true);
    expect(s.miss).toBe(true);
    r = submit(s, first.answer + 100, 'x'); s = r.s;
    expect(r.result.reveal).toBe(true);
    let back = false; let level = s.level; let correct = 0;
    for (let i = 0; i < 12 && level === 1; i++) {
      s = nextQuestion(s);
      if (s.item.key === first.key && s.item.returning) back = true;
      const u = s.item.form === 'line' ? s.item.answer : s.item.answer;
      r = submit(s, u, 'ok'); s = r.s; level = s.level;
      if (!s.item.returning) correct += 1;
    }
    expect(back).toBe(true);
    expect(correct).toBeGreaterThanOrEqual(NEED);
  });
  it('a hint switches the level to the slow lane', () => {
    const s = withHint(nextQuestion(startSession('pyth', { level: 1 })));
    expect(s.hint).toBe(true);
    expect(s.miss).toBe(true);
  });
  it('reads typed answers', () => {
    const it2 = { form: 'pt' };
    expect(readAnswer(it2, { x: '−2.5', y: '0' })).toEqual([-2.5, 0]);
    expect(readAnswer({ form: 'line' }, { m: '3/4', b: '-2' })).toEqual({ m: 0.75, b: -2 });
    expect(readAnswer({ form: 'num' }, { v: '' })).toBeNull();
  });
});

// The teacher's class exam (spec TEACHER-3 §1): questions from the app's own generators, frozen as plain JSON that the
// server keeps (worker/src/assignments.js cleanExamItems) and the app grades again after a round trip.
/** A small seeded generator (mulberry32), so a run can be repeated. */
const seeded = (seed) => { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };

afterEach(() => { vi.restoreAllMocks(); });

describe('class exam', () => {
  it('1. every stair (algebra included) gives printable questions at its own level, or is named as skipped', () => {
    for (const t of ['expr', 'eq', 'sys']) expect(ALL_SKILLS.some((s) => s.startsWith(`${t}:`))).toBe(true);
    for (const skill of ALL_SKILLS) {
      const { items, skipped } = makeClassExam([skill], 4);
      expect(items.length > 0 || skipped.includes(skill), skill).toBe(true);
      const { topic, level } = parseSkill(skill);
      for (const it of items) {
        expect(it.form, skill).not.toBe('manip');
        expect(it).toMatchObject({ topic, level });
        if (it.topic === 'signed') expect(fairForCheck(thawItem(it)), it.key).toBe(true);
        expect(it.key.length).toBeLessThanOrEqual(80);
      }
    }
  });

  it('2. a frozen question is plain JSON: a round trip changes nothing, and no function is left', () => {
    for (const skill of ALL_SKILLS) {
      for (const it of makeClassExam([skill], 3).items) {
        expect(JSON.parse(JSON.stringify(it))).toEqual(it);
        expect(Object.values(it).some((v) => typeof v === 'function')).toBe(false);
        // the base fields, and the curriculum's checking flags only when the question has them
        const flags = ['askDec', 'fmt', 'precise', 'reduced'];
        expect(Object.keys(it).filter((k) => !flags.includes(k)).sort()).toEqual(['answer', 'answerText', 'choices', 'display', 'exact', 'fig', 'form', 'hint', 'key', 'label', 'level', 'levelTitle', 'solution', 'text', 'topic', 'unit', 'var'].sort());
      }
    }
    const thawed = thawItem(makeClassExam(['signed:3'], 1).items[0]);
    expect(thawed.diag(5)).toBe(null);
  });

  it('3. its own answer is right after freezing, on 200 random draws over every stair', () => {
    for (let i = 0; i < 200; i += 1) {
      const skill = ALL_SKILLS[Math.floor(Math.random() * ALL_SKILLS.length)];
      const [it] = makeClassExam([skill], 1).items;
      // the right answer as the student types it (a fraction as its numerator and denominator: the curriculum's frac form)
      expect(isCorrect(thawItem(it), answerInput(thawItem(JSON.parse(JSON.stringify(it))))), `${skill} ${it.key}`).toBe(true);
      expect(it.answerText.length).toBeGreaterThan(0);
    }
  });

  it('4. a rounded length keeps its exact value: 7.07 for √50 is right after freezing, as before', () => {
    let roots = 0;
    for (const skill of ALL_SKILLS.filter((s) => s.startsWith('pyth:'))) {
      for (let i = 0; i < 120; i += 1) {
        const raw = itemFor(skill, 'gen', Math.random, undefined, undefined, { test: true });
        if (raw.form !== 'num' || !roundedLength(raw)) continue;
        roots += 1;
        const it = freezeItem(raw);
        const close = Number(it.exact.toFixed(2));
        expect(isCorrect(raw, close)).toBe(true);
        expect(isCorrect(thawItem(JSON.parse(JSON.stringify(it))), close), it.key).toBe(true);
      }
    }
    expect(roots).toBeGreaterThan(20);
    // √50 itself: 7.1 and 7.07 are right, 7 is not
    const sqrt50 = thawItem(freezeItem({ key: 'py1:1:7', topic: 'pyth', level: 1, levelTitle: '', text: 't', form: 'num', answer: 7.1, exact: Math.sqrt(50), solution: [], hint: '' }));
    expect([isCorrect(sqrt50, 7.07), isCorrect(sqrt50, 7.1), isCorrect(sqrt50, 7)]).toEqual([true, true, false]);
  });

  it('5. an expression keeps its letter and its {k, c} answer', () => {
    let lin = 0;
    for (const skill of ALL_SKILLS.filter((s) => s.startsWith('expr:') || s.startsWith('eq:'))) {
      for (const it of makeClassExam([skill], 14).items.filter((x) => x.form === 'lin')) {
        lin += 1;
        expect(it.var).toMatch(/^[A-Za-z]$/);
        expect(Number.isFinite(it.answer.k) && Number.isFinite(it.answer.c)).toBe(true);
        expect(isCorrect(thawItem(it), { k: it.answer.k, c: it.answer.c })).toBe(true);
      }
    }
    expect(lin).toBeGreaterThan(5);
    const n = freezeItem({ key: 'ex2l', topic: 'expr', level: 2, text: 't', form: 'lin', var: 'n', answer: { k: 3, c: 1 }, solution: [], hint: '' });
    expect(n).toMatchObject({ var: 'n', answer: { k: 3, c: 1 }, answerText: '3n + 1' });
  });

  it('6. questions go round-robin over the stairs: 14 over 2 stairs is 7 each', () => {
    const { items } = makeClassExam(['signed:3', 'pyth:2'], 14);
    expect(items).toHaveLength(14);
    expect(items.filter((x) => x.topic === 'signed')).toHaveLength(7);
    expect(items.filter((x) => x.topic === 'pyth')).toHaveLength(7);
    expect(items.map((x) => x.topic).slice(0, 4)).toEqual(['signed', 'pyth', 'signed', 'pyth']);
    expect(CLASS_EXAM_LENGTHS).toEqual([6, 10, 14]);
    expect(makeClassExam(['nope:1', 'signed:99'], 6)).toEqual({ items: [], skipped: [] });
  });

  it('7. version ב avoids version א\'s keys (a seeded run)', () => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(424242));
    const a = makeClassExam(['signed:2', 'coord:3'], 14);
    const b = makeClassExam(['signed:2', 'coord:3'], 14, { avoid: a.items.map((x) => x.key) });
    expect(a.items).toHaveLength(14); expect(b.items).toHaveLength(14);
    const keysA = new Set(a.items.map((x) => x.key));
    expect(b.items.filter((x) => keysA.has(x.key))).toEqual([]);
    expect(new Set(b.items.map((x) => x.key)).size).toBe(14); // and no question twice in one version
  });

  it('every question the builder makes is one the server keeps as it is, and a long exam fits its limit', () => {
    for (const skill of ALL_SKILLS) {
      const { items } = makeClassExam([skill], 6);
      if (!items.length) continue;
      expect(JSON.parse(cleanExamItems(items)), skill).toEqual(items);
    }
    const big = makeClassExam(['sys:5', 'sys:3', 'eq:5', 'coord:4', 'expr:2', 'pyth:3', 'sys:4'], 14).items;
    expect(big).toHaveLength(14);
    expect(() => cleanExamItems(big)).not.toThrow();
  });

  it('a key longer than the server\'s 80 characters is cut and ends in its hash, the same every time', () => {
    const long = `ex2w:${'א'.repeat(90)}`;
    expect(examKey(long)).toHaveLength(73);
    expect(examKey(long)).toBe(examKey(long));
    expect(examKey(`${long}ב`)).not.toBe(examKey(long));
    expect(examKey('sn1:3')).toBe('sn1:3');
  });

  it('the title names the stairs\' topics', () => {
    expect(classExamTitle(['signed:2', 'signed:3', 'coord:1'])).toBe('מבחן תרגול: מספרים מכוונים, מערכת צירים');
  });
});
