// The tutor's context as the device builds it (ai spec AI-1 Tests, web side): the diagnosis the screen showed, recomputed
// from the item; the policy by phase; the stair's own texts; and a learner summary with nothing personal in it.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildTutorContext, describeWrong, learnerSummary, examAnswerFrom, policyFor, CTX_VERSION } from './tutorContext.js';
import { normalizeContext, renderContext, CLIP } from '@shared/tutorContext.js';
import { TOPIC, makeItem, catLabel, diagnosisLine, ambiguousText, answerText, isCorrect } from '@/content/index.js';
import { manipWrong } from '@/content/manip.js';
import { contentOf } from '@/learn/content/index.ts';
import { modelItem, itemFor } from '@/learn/items.ts';
import { ALL_SKILLS, parseSkill } from '@/learn/skills.ts';
import { seeded } from '@/learn/expr.ts';

const NOW = '2026-11-05T10:00:00.000Z';
const C1 = contentOf('signed:1');
const diagItem = (p) => modelItem(C1, C1.diag, p, 'diag');
/** A practice lesson's state after the given wrong answers (one miss: retry with the hint on; two: the answer shown). */
const lessonState = (item, wrong, extra = {}) => ({ kind: 'node', item, wrong, phase: wrong.length >= 2 ? 'reveal' : wrong.length ? 'retry' : 'answer', hint: wrong.length > 0, cats: {}, ...extra });
const build = (item, wrong, extra = {}, learn = { skills: {}, miscon: {} }) => buildTutorContext({ surface: 'lesson', item, s: lessonState(item, wrong, extra.s), learn, now: NOW, ...extra.o });

afterEach(() => vi.restoreAllMocks());

describe('the diagnosis the screen showed is the one the tutor gets', () => {
  it('1. one misconception: drop-sign on −4 + 3 → 7, with the stair\'s own texts and withhold', () => {
    const item = diagItem({ a: -4, b: 3, s: 1 });
    const ctx = build(item, [7]);
    const a = ctx.tries.answers[0];
    expect(ctx.v).toBe(2); expect(CTX_VERSION).toBe(2);
    expect(a).toMatchObject({ value: '7', kind: 'misconception', ambiguous: false });
    expect(a.ids).toEqual(['drop-sign']);
    expect(a.labels[0]).toBe(catLabel('signed', 1, 'drop-sign'));
    const m = C1.misconceptions.find((x) => x.id === 'drop-sign');
    expect(ctx.miscon).toMatchObject({ id: 'drop-sign', label: catLabel('signed', 1, 'drop-sign'), cause: m.cause, remedy: true });
    expect(ctx.miscon.explain).toEqual(m.explain);
    expect(ctx.teach.idea).toBe(C1.idea);
    expect(ctx.teach.why).toEqual(C1.why.slice(0, 3));
    expect(ctx.shown[0]).toBe(diagnosisLine('signed', 1, { cat: item.diag(7), diagnosis: item.diagnosis(7) }));
    expect(ctx.shown[0]).toBe(`מה כנראה קרה: ${catLabel('signed', 1, 'drop-sign')}.`);
    expect(ctx.shown[1]).toBe(`רמז: ${item.hint}`);
    expect(ctx.policy.answer).toBe('withhold');
    expect(ctx.tries).toMatchObject({ phase: 'retry', hinted: true });
    expect(ctx).toMatchObject({ skill: 'signed:1', topicId: 'signed', topic: 'מספרים מכוונים', stair: 'חיבור וחיסור', grade: '7' });
    expect(ctx.item).toMatchObject({ answer: '-1', answerFrom: 'app', form: 'num' });
    expect(ctx.item.solution).toEqual(item.solution);
  });

  it('2. after the second miss: phase reveal and policy reveal, both answers diagnosed', () => {
    const item = diagItem({ a: -4, b: 3, s: 1 });
    const ctx = build(item, [7, 90]);
    expect(ctx.tries.phase).toBe('reveal');
    expect(ctx.policy.answer).toBe('reveal');
    expect(ctx.tries.answers.map((a) => a.kind)).toEqual(['misconception', 'unknown']);
    // the line the student saw is the first miss's; the newest answer has no mistake, so the screen offers no repair
    expect(ctx.shown[0]).toBe(`מה כנראה קרה: ${catLabel('signed', 1, 'drop-sign')}.`);
    expect(ctx.miscon).toMatchObject({ id: 'drop-sign', remedy: false });
  });

  it('2b. the generator\'s 3 − (−5) answered −2: minus-minus, the label the screen shows', () => {
    // makeItem('signed', 1): the level picks addSub (≥ 0.5), a = 3, b = −5, op '−'
    const r = vi.spyOn(Math, 'random');
    [0.9, 15.5 / 25, 7.5 / 25, 0.75].forEach((v) => r.mockReturnValueOnce(v));
    const item = makeItem('signed', 1);
    r.mockRestore();
    expect(item.key).toBe('sn1:3 - (-5)');
    const ctx = build(item, [-2]);
    expect(ctx.tries.answers[0].ids).toEqual(['minus-minus']);
    expect(ctx.tries.answers[0].labels).toEqual([catLabel('signed', 1, 'minus-minus')]);
    expect(ctx.miscon.id).toBe('minus-minus');
    expect(ctx.item.text).toBe('חשבו: 3 - (-5)');
    expect(ctx.item.answer).toBe('8');
    // and after a second, unexplained miss the tutor may reveal; the answer is the app's
    const two = build(item, [-2, 4]);
    expect(two.policy.answer).toBe('reveal');
    expect(two.tries.answers[1]).toEqual({ value: '4', kind: 'unknown' });
    expect(renderContext(two)).toContain('Correct answer (computed by the app, authoritative): 8');
  });

  it('3. an answer several mistakes predict: ambiguous, every label, no single misconception', () => {
    const item = diagItem({ a: -4, b: -6, s: -1 }); // −4 − (−6) = 2; −10 fits minus-minus, abs-add and direction
    const ctx = build(item, [-10]);
    const a = ctx.tries.answers[0];
    expect(a.ambiguous).toBe(true);
    expect([...a.ids].sort()).toEqual(['abs-add', 'direction', 'minus-minus']);
    expect(a.labels).toHaveLength(3);
    a.ids.forEach((id, i) => expect(a.labels[i]).toBe(catLabel('signed', 1, id)));
    expect(ctx.miscon).toBeNull();
    expect(ctx.shown[0]).toBe(ambiguousText('signed', 1, item.diagnosis(-10).candidates));
  });

  it('4. a slip and an unknown answer', () => {
    const item = diagItem({ a: 5, b: -3, s: -1 }); // 5 − (−3) = 8
    expect(describeWrong(item, 9)).toEqual({ value: '9', kind: 'slip', slip: 'off-by-one' });
    expect(describeWrong(item, 90)).toEqual({ value: '90', kind: 'unknown' });
    const ctx = build(item, [9]);
    expect(ctx.miscon).toBeNull();
    expect(ctx.shown).toEqual([`רמז: ${item.hint}`]);
    // a generator's number is a slip by the same rule
    const r = vi.spyOn(Math, 'random');
    [0.9, 15.5 / 25, 7.5 / 25, 0.75].forEach((v) => r.mockReturnValueOnce(v));
    const gen = makeItem('signed', 1);
    r.mockRestore();
    expect(describeWrong(gen, 9)).toEqual({ value: '9', kind: 'slip', slip: 'off-by-one' });
    expect(describeWrong(gen, 90)).toEqual({ value: '90', kind: 'unknown' });
  });

  it('the policy follows the surface and the phase', () => {
    expect(policyFor('lesson', 'answer').answer).toBe('withhold');
    expect(policyFor('lesson', 'retry').answer).toBe('withhold');
    expect(policyFor('notebook', 'retry').answer).toBe('withhold');
    expect(policyFor('lesson', 'reveal').answer).toBe('reveal');
    expect(policyFor('lesson', 'correct').answer).toBe('reveal');
    expect(policyFor('assistant').answer).toBe('homework');
    expect(policyFor('exam-review').answer).toBe('reveal');
    // a fresh exercise: no answers yet, nothing shown, withhold
    const item = diagItem({ a: -4, b: 3, s: 1 });
    const ctx = build(item, []);
    expect(ctx.tries).toEqual({ answers: [], phase: 'answer', hinted: false });
    expect(ctx.shown).toEqual([]);
    expect(ctx.policy.answer).toBe('withhold');
    // "איך מתחילים?" opened: the first step is listed as shown, and it counts as a hint
    const guided = build(item, [7], { o: { guide: true } });
    expect(guided.shown.at(-1)).toBe(`איך מתחילים: ${item.solution[0]}`);
    expect(guided.tries.hinted).toBe(true);
    // the tutor or Madi asked earlier on this exercise (AI-3 helped) counts as help as well
    expect(build(item, [], { s: { helped: true, hint: false } }).tries.hinted).toBe(true);
    // a check spans its questions: no wrong answer of another question is put on this one
    const check = buildTutorContext({ surface: 'lesson', item, s: { kind: 'check', item, wrong: [7, 3], phase: 'reveal', cats: {} }, learn: {}, now: NOW });
    expect(check.tries.answers).toEqual([]);
  });
});

// ---------------------------------------------------------------- every stair, with only the keys the server knows
const KEYS = {
  '': ['v', 'surface', 'grade', 'skill', 'topicId', 'topic', 'stair', 'item', 'tries', 'shown', 'miscon', 'teach', 'learner', 'policy'],
  item: ['text', 'form', 'answer', 'answerFrom', 'solution', 'hint', 'unit'],
  tries: ['answers', 'phase', 'hinted'],
  'tries.answers': ['value', 'kind', 'ids', 'labels', 'ambiguous', 'slip'],
  miscon: ['id', 'label', 'cause', 'explain', 'remedy'],
  teach: ['idea', 'why', 'alt'],
  learner: ['stairState', 'recent', 'open', 'lessonRepeats', 'taught'],
  'learner.recent': ['right', 'asked'],
  'learner.open': ['skill', 'label', 'state'],
  'learner.lessonRepeats': ['label', 'n'],
  policy: ['answer', 'why'],
};
/** Every key of the context is one the typedef lists (a recursive walk; arrays of objects use their own list). */
function badKeys(v, path = '') {
  if (Array.isArray(v)) return v.flatMap((x) => (x && typeof x === 'object' ? badKeys(x, path) : []));
  if (!v || typeof v !== 'object') return [];
  const allowed = KEYS[path];
  if (!allowed) return [`${path} (no objects allowed here)`];
  return Object.entries(v).flatMap(([k, x]) => (allowed.includes(k) ? badKeys(x, path ? `${path}.${k}` : k) : [`${path}.${k}`]));
}
/** One wrong answer of any form. */
function wrongOf(item) {
  if (item.form === 'mc') return item.answer === 0 ? 1 : 0;
  if (item.form === 'manip') return manipWrong(item);
  if (item.form === 'pt') return [item.answer[0] + 7, item.answer[1]];
  if (item.form === 'line') return { m: item.answer.m + 7, b: item.answer.b };
  if (item.form === 'lin') return { k: item.answer.k + 7, c: item.answer.c };
  return item.answer + 37;
}

describe('5. every stair', () => {
  const learn = {
    skills: { 'signed:1': { attempts: [{ at: NOW, ok: true, independent: true, purpose: 'practice' }], taught: { A: NOW } } },
    miscon: { 'signed:1|minus-minus': { skill: 'signed:1', id: 'minus-minus', score: 2, seen: ['a', 'b'], state: 'confirmed', at: NOW } },
  };
  it.each(ALL_SKILLS)('%s: 5 items from its models and its generator, one wrong answer each', (skill) => {
    const { topic, level } = parseSkill(skill);
    const rnd = seeded(skill.length * 977 + level);
    const items = [];
    for (let k = 0; k < 3; k += 1) items.push(itemFor(skill, k === 1 && contentOf(skill)?.transfer ? 'transfer' : 'diag', rnd));
    const r = vi.spyOn(Math, 'random').mockImplementation(seeded(level * 131 + topic.length));
    for (let k = 0; k < 2; k += 1) items.push(makeItem(topic, level));
    r.mockRestore();
    for (const item of items) {
      const u = wrongOf(item);
      expect(isCorrect(item, u), `${item.key}: the wrong answer is wrong`).toBe(false);
      const ctx = build(item, [u], { s: { cats: { sign: 2 } } }, learn);
      expect(normalizeContext(ctx), item.key).not.toBeNull();
      const json = JSON.stringify(ctx);
      expect(json.length, item.key).toBeLessThan(8000);
      expect(json, item.key).not.toMatch(/undefined|NaN/);
      expect(badKeys(ctx), item.key).toEqual([]);
      expect(ctx.skill).toBe(skill);
      expect(ctx.item.answer).toBe(answerText(item).slice(0, CLIP.answer));
      expect(ctx.teach.idea).toBe(contentOf(skill).idea);
      expect(ctx.tries.answers[0].value).toBe(answerText(item, u).slice(0, CLIP.answer));
      expect(['misconception', 'slip', 'unknown']).toContain(ctx.tries.answers[0].kind);
      // an expression's answer is an expression in its own letter
      if (item.form === 'lin') expect(ctx.item.answer).toMatch(new RegExp(item.var || 'x'));
      // the server renders it, with the answer marked as the app's
      expect(renderContext(ctx)).toContain(`Correct answer (computed by the app, authoritative): ${ctx.item.answer}`);
    }
  });

  it('the key check itself finds a key the typedef does not list', () => {
    const ctx = build(diagItem({ a: -4, b: 3, s: 1 }), [7]);
    expect(badKeys({ ...ctx, name: 'נועה', item: { ...ctx.item, at: NOW }, learner: { ...ctx.learner, open: [{ skill: 'signed:1', label: 'x', state: 'confirmed', device: 'd' }] }, shown: [{ x: 1 }] }).sort())
      .toEqual(['.name', 'item.at', 'learner.open.device', 'shown (no objects allowed here)'].sort());
  });

  it('the learner summary carries nothing personal: no name, class, device, date or typed text', () => {
    const item = diagItem({ a: -4, b: 3, s: 1 });
    const ctx = build(item, [7], { s: { cats: { 'drop-sign': 2 } } }, { ...learn, profile: { name: 'נועה', classCode: 'K7Q2MD' } });
    const json = JSON.stringify(ctx);
    expect(json).not.toMatch(/2026-|נועה|K7Q2MD/);
    expect(ctx.learner).toEqual({
      stairState: 'מתרגלים', recent: { right: 1, asked: 1 },
      open: [{ skill: 'signed:1', label: catLabel('signed', 1, 'minus-minus'), state: 'confirmed' }],
      lessonRepeats: [{ label: catLabel('signed', 1, 'drop-sign'), n: 2 }], taught: ['A'],
    });
  });
});

describe('6. the learner summary', () => {
  const rec = (skill, id, state = 'confirmed', score = 2) => [`${skill}|${id}`, { skill, id, score, seen: ['a', 'b'], state, at: NOW }];
  const pythId = contentOf('pyth:2').misconceptions[0].id;
  const s3 = contentOf('signed:3').misconceptions.map((m) => m.id);
  it('an ancestor\'s misconception is there, another topic\'s is not, and never more than 3', () => {
    const learn = { skills: {}, miscon: Object.fromEntries([rec('signed:1', 'minus-minus'), rec('pyth:2', pythId, 'confirmed', 5)]) };
    expect(catLabel('pyth', 2, pythId)).toBeTruthy();
    const sum = learnerSummary(learn, 'signed:3', {}, NOW);
    expect(sum.open).toEqual([{ skill: 'signed:1', label: catLabel('signed', 1, 'minus-minus'), state: 'confirmed' }]);
    // this stair's own come first, then its ancestors; at most 3; a suspicion is not open
    const many = { skills: {}, miscon: Object.fromEntries([rec('signed:1', 'minus-minus', 'confirmed', 9), rec('signed:1', 'sign', 'repairing'), ...s3.slice(0, 2).map((id) => rec('signed:3', id)), rec('signed:3', s3[2] || s3[0], 'suspected')]) };
    const out = learnerSummary(many, 'signed:3', {}, NOW).open;
    expect(out).toHaveLength(3);
    expect(out.slice(0, 2).map((o) => o.skill)).toEqual(['signed:3', 'signed:3']);
    expect(out[2].skill).toBe('signed:1');
  });

  it('on the assistant: the 3 strongest open misconceptions across all stairs, and nothing about a stair', () => {
    const learn = { skills: {}, miscon: Object.fromEntries([rec('signed:1', 'minus-minus', 'confirmed', 3), rec('pyth:2', pythId, 'confirmed', 5), rec('signed:3', s3[0], 'confirmed', 4), rec('signed:3', s3[1], 'confirmed', 1)]) };
    const ctx = buildTutorContext({ surface: 'assistant', grade: '8', learn });
    expect(ctx).toEqual({
      v: 2, surface: 'assistant', grade: '8', policy: policyFor('assistant'),
      learner: { open: [
        { skill: 'pyth:2', label: catLabel('pyth', 2, pythId), state: 'confirmed' },
        { skill: 'signed:3', label: catLabel('signed', 3, s3[0]), state: 'confirmed' },
        { skill: 'signed:1', label: catLabel('signed', 1, 'minus-minus'), state: 'confirmed' },
      ] },
    });
    expect(ctx.item).toBeUndefined();
    expect(renderContext(ctx)).toContain('Final-answer policy: HOMEWORK');
  });
});

describe('the review of a checked exam', () => {
  const q = { number: '3', prompt: 'פתרו: $2x + 3 = 11$', studentAnswer: '$x = 5$', correctAnswer: '$x = 4$', status: 'wrong', topic: 'eq', level: 2, solution: ['$2x = 8$'] };
  it('reveal, with where the answer came from; the stair\'s texts when the level is a stair', () => {
    const ctx = buildTutorContext({ surface: 'exam-review', grade: '7', exam: q, answerFrom: 'ai' });
    expect(ctx.policy.answer).toBe('reveal');
    expect(ctx.item).toEqual({ text: q.prompt, answer: q.correctAnswer, answerFrom: 'ai' });
    expect(ctx.tries).toEqual({ answers: [{ value: '$x = 5$' }], phase: 'reveal', hinted: false });
    expect(ctx).toMatchObject({ skill: 'eq:2', topicId: 'eq', topic: TOPIC.eq.title, stair: TOPIC.eq.levels[1].title });
    expect(ctx.teach.idea).toBe(contentOf('eq:2').idea);
    expect(renderContext(ctx)).not.toContain('authoritative');
    // another topic, or no level: no stair
    const other = buildTutorContext({ surface: 'exam-review', grade: '7', exam: { ...q, topic: 'other', level: 0 }, answerFrom: 'ai' });
    expect(other.skill).toBeUndefined(); expect(other.teach).toBeUndefined();
  });
  it('the answer is the key\'s for a matched practice exam or a key-graded question, else the AI check\'s', () => {
    expect(examAnswerFrom({ source: 'practice' }, { ...q, item: { text: 'x', form: 'num' } })).toBe('key');
    expect(examAnswerFrom({ source: 'practice' }, q)).toBe('ai');
    expect(examAnswerFrom({ source: 'upload' }, q)).toBe('ai');
    expect(examAnswerFrom({ source: 'upload' }, { ...q, graded: 'key' })).toBe('key');
    expect(examAnswerFrom({ source: 'practice' }, { ...q, item: {}, graded: 'ai' })).toBe('ai');
    const ctx = buildTutorContext({ surface: 'exam-review', grade: '7', exam: { ...q, item: { text: 'פתרו:', display: '2x + 3 = 11', form: 'num' } }, answerFrom: 'key' });
    expect(ctx.item.text).toBe('פתרו: 2x + 3 = 11');
    expect(renderContext(ctx)).toContain('Correct answer (from the answer key, authoritative): $x = 4$');
  });
});

describe('a finished challenge, for feedback on the student\'s explanation (ai spec AI-10)', () => {
  const task = { skill: 'expr:4', story: 'גינה מלבנית ברוחב $3$ מטר.', prompt: 'הסבירו למה $3(x + 4) = 3x + 12$.' };
  it('reveal, the task as the exercise with no answer, the stair and its teaching; only the keys the server knows', () => {
    const ctx = buildTutorContext({ surface: 'challenge', ...task });
    expect(ctx).toMatchObject({ v: CTX_VERSION, surface: 'challenge', grade: String(TOPIC.expr.grade), skill: 'expr:4', topicId: 'expr', topic: TOPIC.expr.title, stair: TOPIC.expr.levels[3].title });
    expect(ctx.policy).toEqual(policyFor('challenge'));
    expect(ctx.policy.answer).toBe('reveal');
    expect(ctx.item).toEqual({ text: `${task.story}\n${task.prompt}`, answerFrom: 'app' });
    expect(ctx.teach.idea).toBe(contentOf('expr:4').idea);
    expect(ctx.tries).toBeUndefined();
    expect(badKeys(ctx)).toEqual([]);
    const text = renderContext(normalizeContext(ctx));
    expect(text).toContain('Final-answer policy: REVEAL');
    expect(text).toContain(`Exercise on screen: ${task.story}\n${task.prompt}`);
    expect(text).not.toContain('Correct answer');
  });
  it('an unknown stair keeps the task and drops the stair; no prompt is the assistant\'s context', () => {
    const ctx = buildTutorContext({ surface: 'challenge', skill: 'nope:9', prompt: 'הסבירו.' });
    expect(ctx.skill).toBeUndefined(); expect(ctx.teach).toBeUndefined();
    expect(ctx.item.text).toBe('הסבירו.');
    expect(buildTutorContext({ surface: 'challenge', skill: 'expr:4' }).surface).toBe('assistant');
    // a context with no policy from a challenge reads as reveal on the server too
    expect(normalizeContext({ v: CTX_VERSION, surface: 'challenge', item: { text: 'הסבירו.' } }).policy.answer).toBe('reveal');
  });
});
