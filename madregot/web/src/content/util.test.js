// Reading answers exactly as students write them, and the shared answer rules of stage 1 (CURRICULUM-2 items 4-7):
// mixed numbers and thousands on a computer keyboard, the `precise` rule, the fraction answer form and its
// "not reduced yet" note, the format sentence, exact answer text, and practice-only questions kept out of checks.
import { describe, it, expect, afterEach } from 'vitest';
import { parseNum, readNumCandidates, numRight, shortDec, plainNum, toFrac, exactTex, fractionHint, withFormatNote } from './util.js';
import { TOPIC, makeItem, testItem, fairForCheck, slotsFor, readAnswer, isCorrect, partialOf, answerText } from './index.js';
import { startLesson, answer } from '../lib/lesson.js';
import { finalCheck } from '../components/learn/Together.jsx';
import { modelItem } from '../learn/items.ts';

/** A typed item, as a generator makes one. */
const num = (answer, extra = {}) => ({ form: 'num', answer, topic: 'test', level: 1, key: 'k', text: 'כמה?', ...extra });
const frac = (answer, extra = {}) => ({ form: 'frac', answer, topic: 'test', level: 1, key: 'k', text: 'צמצמו עד הסוף.', ...extra });
/** Is this typed text right for the item, read the way the lesson reads it? */
const typedRight = (it, v) => isCorrect(it, readAnswer(it, { v }));

describe('reading numbers as students type them', () => {
  it('a mixed number is a whole number and a fraction; a fraction stays a fraction', () => {
    expect(parseNum('2 1/2')).toBe(2.5);
    expect(parseNum('-1 3/4')).toBe(-1.75);
    expect(parseNum('−1 3/4')).toBe(-1.75); // the keypad's minus
    expect(parseNum('13/4')).toBe(3.25);
    expect(parseNum('2 1/0')).toBeNull();
    // everything read before still reads the same
    expect(parseNum('-3')).toBe(-3);
    expect(parseNum('- 3')).toBe(-3);
    expect(parseNum('2.5')).toBe(2.5);
    expect(parseNum('2,5')).toBe(2.5);
    expect(parseNum('-3/4')).toBe(-0.75);
    expect(parseNum('3/0')).toBeNull();
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });

  it('"2,000" has two readings: the decimal comma and thousands; other text has one or none', () => {
    expect(readNumCandidates('2,000')).toEqual([2, 2000]);
    expect(readNumCandidates('-1,250')).toEqual([-1.25, -1250]);
    expect(readNumCandidates('1,250,000')).toEqual([1250000]); // two commas: thousands only
    expect(readNumCandidates('2,5')).toEqual([2.5]);
    expect(readNumCandidates('2000')).toEqual([2000]);
    expect(readNumCandidates('7/12')).toEqual([7 / 12]);
    expect(readNumCandidates('')).toEqual([]);
    expect(readNumCandidates('x')).toEqual([]);
  });

  it('the lesson keeps the reading the question accepts, else the one nearest its answer', () => {
    expect(typedRight(num(2000), '2,000')).toBe(true);
    expect(typedRight(num(2000), '2000')).toBe(true);
    expect(typedRight(num(2), '2,000')).toBe(true); // harmless: a decimal comma
    expect(readAnswer(num(2.5), { v: '2,5' })).toBe(2.5);
    expect(typedRight(num(2.5), '2,5')).toBe(true);
    // a wrong answer: the diagnosis sees the reading nearest the answer
    expect(readAnswer(num(1990), { v: '2,000' })).toBe(2000);
    expect(readAnswer(num(3), { v: '2,000' })).toBe(2);
    // a mixed number is its value, not its digits run together
    expect(typedRight(num(3.25), '3 1/2')).toBe(false);
    expect(typedRight(num(3.25), '3 1/4')).toBe(true);
    expect(typedRight(num(3.25), '13/4')).toBe(true);
    expect(readAnswer(num(1), { v: '' })).toBeNull();
  });
});

describe('the precise rule (items marked precise: true)', () => {
  // the spec's table, line by line: [answer, typed, right?]
  const TABLE = [
    [1 / 12, '0.08', true], [1 / 12, '0.083', true], [1 / 12, '1/12', true], [1 / 12, '0.1', false],
    [7 / 12, '0.58', true], [7 / 12, '0.583', true], [7 / 12, '7/12', true], [7 / 12, '14/24', true], [7 / 12, '0.59', false],
    [1 / 36, '1/36', true], [1 / 36, '1/35', false],
    [0.125, '0.125', true], [0.125, '1/8', true], [0.125, '0.12', false], [0.125, '0.13', false],
    [-4 / 3, '-1.33', true], [-4 / 3, '-4/3', true], [-4 / 3, '-1.3', false],
    [2.5, '2.5', true], [2.5, '2 1/2', true], [2.5, '2.51', false],
  ];
  it.each(TABLE)('answer %d, typed %s: right is %s', (a, typed, right) => {
    expect(typedRight(num(a, { precise: true }), typed)).toBe(right);
  });

  it('an exact value is right, and a short decimal within half a hundredth only when the answer has no short decimal', () => {
    expect(shortDec(0.125)).toBe(true);
    expect(shortDec(7)).toBe(true);
    expect(shortDec(7 / 12)).toBe(false);
    expect(shortDec(1 / 35)).toBe(false);
    expect(numRight(0.08, 1 / 12, true)).toBe(true);
    expect(numRight(1 / 35, 1 / 36, true)).toBe(false);
    expect(numRight(NaN, 1, true)).toBe(false);
    expect(numRight(null, 1)).toBe(false);
  });

  it('items without the flag keep ±0.01: nothing that passes today fails', () => {
    expect(typedRight(num(-4 / 3), '-1.33')).toBe(true);
    expect(typedRight(num(-4 / 3), '-1.333')).toBe(true);
    expect(typedRight(num(-4 / 3), '-4/3')).toBe(true);
    expect(typedRight(num(-4 / 3), '-1.3')).toBe(false);
    expect(typedRight(num(1 / 36), '1/35')).toBe(true); // the old tolerance, which precise closes
    expect(numRight(5.009, 5)).toBe(true);
    expect(numRight(5.02, 5)).toBe(false);
  });

  it('the answer shown after a miss is exact: denominators up to 100 for precise items, decimals for fmt: dec', () => {
    expect(answerText(num(11 / 36, { precise: true }))).toBe('11/36');
    expect(answerText(num(11 / 36))).toBe('0.31'); // an ordinary item, as before
    expect(answerText(num(7 / 12, { precise: true }))).toBe('7/12');
    expect(answerText(num(-1.3, { precise: true }))).toBe('-13/10');
    expect(answerText(num(-1.3, { precise: true, fmt: 'dec' }))).toBe('-1.3');
    expect(answerText(num(-0.125, { precise: true, fmt: 'dec' }))).toBe('-0.125');
    expect(answerText(num(-4 / 3, { precise: true, fmt: 'dec' }))).toBe('-4/3');
    // a stats mean reads as before
    expect(answerText({ ...num(5.4), topic: 'stats' })).toBe('5.4');
    expect(plainNum(0.37)).toBe('0.37');
    expect(plainNum(37 / 100, { maxDen: 100 })).toBe('37/100');
    expect(exactTex(11 / 36)).toBe('\\frac{11}{36}');
    expect(exactTex(-7 / 12)).toBe('-\\frac{7}{12}');
    expect(exactTex(3)).toBe('3');
  });

  it('a question whose answer has no short decimal says once how to write it, with an example that is not its answer', () => {
    const it7 = withFormatNote(num(7 / 12, { precise: true }));
    expect(it7.text).toBe(`כמה? ${fractionHint('5/9')}`);
    expect(withFormatNote(it7)).toBe(it7); // once
    expect(withFormatNote(num(1 / 36, { precise: true })).text).toBe(`כמה? ${fractionHint()}`);
    expect(fractionHint()).toBe('אפשר לכתוב כשבר (למשל $7/12$) או כמספר עשרוני מעוגל לשתי ספרות אחרי הנקודה.');
    // whole and short decimal answers need no note
    const whole = num(3, { precise: true });
    expect(withFormatNote(whole)).toBe(whole);
    const short = num(0.125, { precise: true });
    expect(withFormatNote(short)).toBe(short);
  });
});

describe('a question made from a diagnostic model follows the same rule', () => {
  const stair = { skill: 'test:1', topic: 'test', level: 1, title: 'בדיקה' };
  const model = (extra) => ({ params: () => ({}), text: () => 'כמה?', answer: () => 7 / 12, bugs: {}, solution: () => [], hint: () => '', ...extra });
  it('a precise model makes a precise question, with the format note once', () => {
    const it = modelItem(stair, model({ precise: true }), {}, 'diag');
    expect(it.precise).toBe(true);
    expect(it.text).toBe(`כמה? ${fractionHint('5/9')}`);
    expect(typedRight(it, '0.58')).toBe(true);
    expect(typedRight(it, '0.59')).toBe(false);
    expect(answerText(it)).toBe('7/12');
  });
  it('a model without the flag is as before: ±0.01, no note', () => {
    const it = modelItem(stair, model({}), {}, 'diag');
    expect(it.precise).toBeUndefined();
    expect(it.text).toBe('כמה?');
    expect(typedRight(it, '0.59')).toBe(true);
    expect(modelItem(stair, model({ fmt: 'dec', answer: () => -1.3 }), {}, 'diag').fmt).toBe('dec');
  });
});

describe('the fraction answer form', () => {
  const half = frac(1 / 2, { reduced: true });
  it('two slots, the numerator and the denominator, read as whole numbers', () => {
    expect(slotsFor(half)).toEqual(['n', 'd']);
    expect(readAnswer(half, { n: '1', d: '2' })).toEqual({ n: 1, d: 2 });
    expect(readAnswer(half, { n: '-3', d: '4' })).toEqual({ n: -3, d: 4 });
    // a minus in the denominator moves up
    expect(readAnswer(half, { n: '3', d: '-4' })).toEqual({ n: -3, d: 4 });
    expect(readAnswer(half, { n: '0', d: '-4' })).toEqual({ n: 0, d: 4 });
  });

  it('a denominator of 0, an empty slot or a number that is not whole is invalid', () => {
    expect(readAnswer(half, { n: '1', d: '0' })).toBeNull();
    expect(readAnswer(half, { n: '1', d: '' })).toBeNull();
    expect(readAnswer(half, { n: '', d: '2' })).toBeNull();
    expect(readAnswer(half, { n: '1.5', d: '3' })).toBeNull();
    expect(readAnswer(half, { n: '1/2', d: '1' })).toBeNull();
    expect(isCorrect(half, null)).toBe(false);
    expect(isCorrect(half, { n: 1, d: 0 })).toBe(false);
  });

  it('compared exactly; with reduced, only lowest terms with a positive denominator', () => {
    expect(isCorrect(half, { n: 1, d: 2 })).toBe(true);
    expect(isCorrect(half, { n: 2, d: 4 })).toBe(false);
    expect(isCorrect(half, { n: -1, d: -2 })).toBe(false); // read from the slots it is { n: 1, d: 2 }
    expect(isCorrect(half, readAnswer(half, { n: '-1', d: '-2' }))).toBe(true);
    expect(isCorrect(half, { n: 50, d: 99 })).toBe(false); // 0.505… is not 1/2, though within ±0.01
    const any = frac(1 / 2);
    expect(isCorrect(any, { n: 2, d: 4 })).toBe(true); // not asked to reduce: any equal fraction
    expect(isCorrect(frac(-7 / 12, { reduced: true }), { n: -7, d: 12 })).toBe(true);
    expect(isCorrect(frac(0, { reduced: true }), { n: 0, d: 1 })).toBe(true);
    expect(isCorrect(frac(0, { reduced: true }), { n: 0, d: 5 })).toBe(false);
  });

  it('the right value not in lowest terms is a form note (not-reduced), not a mistake', () => {
    expect(partialOf(half, { n: 2, d: 4 })).toBe('not-reduced');
    expect(partialOf(half, { n: 1, d: 2 })).toBeNull(); // right
    expect(partialOf(half, { n: 2, d: 3 })).toBeNull(); // wrong
    expect(partialOf(frac(1 / 2), { n: 2, d: 4 })).toBeNull(); // the question does not ask to reduce: right
    expect(partialOf(num(0.5), 0.5)).toBeNull();
    expect(partialOf(undefined, 1)).toBeNull();
  });

  it('answer text: the student\'s own fraction, or the answer in lowest terms', () => {
    expect(answerText(half)).toBe('1/2');
    expect(answerText(half, { n: 2, d: 4 })).toBe('2/4');
    expect(answerText(frac(-21 / 36, { reduced: true }))).toBe('-7/12');
    expect(toFrac(0.75)).toEqual({ n: 3, d: 4 });
    expect(toFrac(-2)).toEqual({ n: -2, d: 1 });
    expect(toFrac(Math.SQRT2)).toBeNull();
  });
});

describe('a not-reduced fraction records nothing', () => {
  const real = TOPIC.signed.levels[0].gen;
  afterEach(() => { TOPIC.signed.levels[0].gen = real; });

  it('the lesson state is the same, with no attempt, no answer event and no mistake', () => {
    // a practice lesson whose questions are "reduce 6/8"
    TOPIC.signed.levels[0].gen = () => ({ form: 'frac', answer: 3 / 4, reduced: true, text: 'צמצמו עד הסוף: $\\frac{6}{8}$', key: `f:${Math.random()}`, diag: () => 'wrong-op', solution: '' });
    const s = startLesson({ kind: 'node', topic: 'signed', level: 1 });
    expect(s.item.form).toBe('frac');
    const r = answer(s, { n: 6, d: 8 });
    expect(r.result).toEqual({ partial: 'not-reduced' });
    expect(r.s).toBe(s);
    expect(r.result.event).toBeUndefined();
    // the same state takes the reduced answer as a first-try success
    const ok = answer(r.s, { n: 3, d: 4 });
    expect(ok.result.ok).toBe(true);
    expect(ok.result.first).toBe(true);
    expect(ok.result.event.ok).toBe(true);
    // a wrong value is a mistake as usual
    const miss = answer(s, { n: 5, d: 8 });
    expect(miss.result.ok).toBe(false);
    expect(miss.result.event.cat).toBe('wrong-op');
    expect(miss.s.attempt).toBe(2);
  });
});

describe('practice-only questions are kept out of checks', () => {
  const real = TOPIC.signed.levels[0].gen;
  afterEach(() => { TOPIC.signed.levels[0].gen = real; });

  it('fairForCheck rejects them before any other rule; practice still draws them', () => {
    expect(fairForCheck({ topic: 'line', practiceOnly: true })).toBe(false);
    expect(fairForCheck({ topic: 'line' })).toBe(true);
    expect(fairForCheck({ topic: 'signed', practiceOnly: true, display: '-3 + 5', answer: 2 })).toBe(false);
    // half the questions of signed:1 become practice-only
    let n = 0;
    TOPIC.signed.levels[0].gen = () => { n += 1; const it = real(); return n % 2 ? { ...it, practiceOnly: true } : it; };
    for (let i = 0; i < 30; i += 1) expect(testItem('signed', 1).practiceOnly).toBeUndefined();
    const seen = Array.from({ length: 20 }, () => makeItem('signed', 1).practiceOnly);
    expect(seen).toContain(true);
  });

  // the kinds whose answer is a choice among two or three, or an object whose target the question names (spec §0.5)
  const PRACTICE_ONLY = ['fr1p', 'fr2p', 'fr2o', 'fr3c', 'fr4g'];
  it('only the named practice-only kinds carry the flag', () => {
    Object.values(TOPIC).forEach((t) => t.levels.forEach((L, i) => {
      for (let k = 0; k < 60; k += 1) {
        const it = makeItem(t.id, i + 1);
        expect(!!it.practiceOnly, `${it.key}`).toBe(PRACTICE_ONLY.includes(it.key.split(':')[0]));
      }
    }));
  });
});

describe('a question that asks for a decimal takes a decimal', () => {
  it('the fraction typed back is not read; the decimal and its comma are', () => {
    const it = { form: 'num', answer: 0.75, precise: true, fmt: 'dec', askDec: true, text: 'כתבו כמספר עשרוני:', display: '\\frac{3}{4}' };
    expect(readAnswer(it, { v: '3/4' })).toBeNull();
    expect(readAnswer(it, { v: '0.75' })).toBe(0.75);
    expect(readAnswer(it, { v: '0,75' })).toBe(0.75);
    expect(readAnswer({ ...it, askDec: undefined }, { v: '3/4' })).toBe(0.75); // other questions read a fraction as always
  });
});

describe('"solve together": the last typed step follows the same rule', () => {
  it('±0.01 by default, exact when the final is marked precise', () => {
    const final = { answer: 7 / 12 };
    expect(finalCheck(final, '0.59')).toEqual({ u: 0.59, ok: true });
    expect(finalCheck({ ...final, precise: true }, '0.59')).toEqual({ u: 0.59, ok: false });
    expect(finalCheck({ ...final, precise: true }, '0.58').ok).toBe(true);
    expect(finalCheck({ ...final, precise: true }, '7/12').ok).toBe(true);
    expect(finalCheck({ answer: 1 / 36, precise: true }, '1/35').ok).toBe(false);
    expect(finalCheck({ answer: 1 / 36 }, '1/35').ok).toBe(true);
    expect(finalCheck({ answer: -4 / 3 }, '-1.33').ok).toBe(true);
  });
  it('reads "2,000" the way that is right, and nothing typed is null', () => {
    expect(finalCheck({ answer: 2000 }, '2,000')).toEqual({ u: 2000, ok: true });
    expect(finalCheck({ answer: 2.5 }, '2 1/2')).toEqual({ u: 2.5, ok: true });
    expect(finalCheck({ answer: 3 }, '2,000')).toEqual({ u: 2, ok: false });
    expect(finalCheck({ answer: 3 }, '')).toBeNull();
  });
});
