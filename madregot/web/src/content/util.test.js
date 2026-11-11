// Reading answers exactly as students write them, and the shared answer rules of stage 1 (CURRICULUM-2 items 4-7):
// mixed numbers and thousands on a computer keyboard, the `precise` rule, the fraction answer form and its
// "not reduced yet" note, the format sentence, exact answer text, and practice-only questions kept out of checks.
import { describe, it, expect, afterEach } from 'vitest';
import { parseNum, readNumCandidates, numRight, shortDec, plainNum, toFrac, exactTex, fractionHint, withFormatNote, withPiNote, piNear, piValue, afterPlain, PI_AFTER, PI_NOTE } from './util.js';
import { TOPIC, makeItem, testItem, fairForCheck, slotsFor, readAnswer, isCorrect, partialOf, answerText, itemPlain } from './index.js';
import { startLesson, answer, next } from '../lib/lesson.js';
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

  it('"2,400" typed on a hardware keyboard reads 2400 where the answer is 2400 (a scale answer in metres); a phone types 2400', () => {
    const scale = num(2400, { topic: 'ratio', text: 'במפה בקנה מידה $1 : 20{,}000$ אורך הדרך $12$ ס״מ. כמה מטרים היא במציאות?' });
    expect(readAnswer(scale, { v: '2,400' })).toBe(2400);
    expect(typedRight(scale, '2,400')).toBe(true);
    expect(typedRight(scale, '2400')).toBe(true);
    // the decimal-comma reading is the other candidate, kept for an answer of 2.4 (the same distance in kilometres)
    expect(readAnswer(num(2.4), { v: '2,400' })).toBe(2.4);
    expect(typedRight(scale, '24,000')).toBe(false);
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
  // ratio: ratioMc, addSame and beads (ratio:1), statements (ratio:2), isProp and the double line (ratio:3), the scale bar
  // pct: shade, estimate and over100 (pct:1, estimate also in pct:2), classes (pct:2), the stretch (pct:4), multMc (pct:5)
  // area (stage 2, MEASURE-2): the units (ar1u), the height (ar2w) and the L's computation (ar3m) are choices; the
  // grid shapes whose target the question names: the rectangle (ar1b), the parallelogram's move (ar4c), the largest area (ar5b)
  const PRACTICE_ONLY = ['fr1p', 'fr2p', 'fr2o', 'fr3c', 'fr4g', 'sn6b', 'sn6p', 'ra1m', 'ra1a', 'ra1b', 'ra2t', 'ra3p', 'ra3l', 'ra4b',
    'pc1s', 'pc1e', 'pc1o', 'pc2c', 'pc4s', 'pc5m', 'ar1u', 'ar1b', 'ar2w', 'ar3m', 'ar4c', 'ar5c', 'ar5b'];
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

// ---------------------------------------------------------------- answers with π (stage 2, MEASURE-1 item 4, §0.5)
// No topic has π questions yet: every item here is a fixture (topic 'circle' or 'area', after/pk set by hand).
describe('answers with π', () => {
  /** A "with π" question (□π): the number before π is typed; 25 is 25π. */
  const piQ = (answer, extra = {}) => num(answer, { topic: 'circle', after: PI_AFTER, text: 'מה שטח עיגול שרדיוסו $5$ ס״מ? כתבו בעזרת $\\pi$.', ...extra });
  /** A "π ≈ 3.14" question: pk is the multiple of π, the answer 3.14·pk to tenths. */
  const pkQ = (k, extra = {}) => num(piValue(k), { topic: 'circle', pk: k, text: 'חשבו עם $\\pi \\approx 3.14$ ועגלו לעשירית.', ...extra });

  it('π ≈ 3.14: pk 25 is right with 3.14 or with the calculator\'s π, within half a tenth', () => {
    const it = pkQ(25);
    expect(it.answer).toBe(78.5);
    for (const v of ['78.5', '78.54', '78.5398', '78,5']) expect(typedRight(it, v), v).toBe(true);
    for (const v of ['78.4', '79', '25', '78.6']) expect(typedRight(it, v), v).toBe(false);
    // 3.14·100 = 314 and π·100 = 314.16: both ends are right, though they are more than a tenth apart
    expect(isCorrect(pkQ(100), 314)).toBe(true);
    expect(isCorrect(pkQ(100), 314.2)).toBe(true);
    expect(isCorrect(pkQ(100), 314.3)).toBe(false);
    expect(piNear(78.5, 25) && piNear(78.54, 25) && !piNear(78.4, 25)).toBe(true);
    expect(piNear('78.5', 25)).toBe(false);
  });

  it('with π: the number before π is the answer; the whole value typed as a decimal is a note on the form, not a mistake', () => {
    const it = piQ(25);
    expect(typedRight(it, '25')).toBe(true);
    expect(typedRight(it, '78.5')).toBe(false);
    expect(partialOf(it, 78.5)).toBe('pi-value');
    expect(partialOf(it, 78.54)).toBe('pi-value');
    expect(partialOf(it, 78.5398)).toBe('pi-value');
    expect(partialOf(it, 26)).toBeNull();
    expect(partialOf(it, 78)).toBeNull();
    expect(partialOf(it, 25)).toBeNull(); // right is right
    // a question without π after its slot has no such note
    expect(partialOf(num(25, { topic: 'circle' }), 78.5)).toBeNull();
    // a value a misconception predicts is that misconception, not a form: the generator's diag, or the model's bugs
    expect(partialOf(piQ(25, { diag: (u) => (Math.abs(u - 78.5) < 0.01 ? 'some-bug' : null) }), 78.5)).toBeNull();
    expect(partialOf(piQ(25, { diag: () => null, diagnosis: () => ({ kind: 'misconception', candidates: [{ id: 'b', conf: 1 }] }) }), 78.5)).toBeNull();
    expect(partialOf(piQ(25, { diag: () => null, diagnosis: () => ({ kind: 'slip', why: 'digits' }) }), 78.5)).toBe('pi-value');
  });

  it('answers are written as decimals in the measurement topics, and with π after a □π slot', () => {
    expect(answerText(pkQ(20))).toBe('62.8'); // not 314/5
    expect(answerText(num(6.5, { topic: 'area' }))).toBe('6.5'); // a grid triangle's area, not 13/2
    expect(answerText(num(2.5, { topic: 'solid' }))).toBe('2.5');
    expect(answerText(num(7.1, { topic: 'space', exact: Math.sqrt(50) }))).toBe('7.1');
    expect(answerText(num(62.8, { topic: 'test', pk: 20 }))).toBe('62.8'); // a pk answer is a decimal in any topic
    expect(answerText(num(6.5))).toBe('13/2'); // other topics as before
    expect(answerText(piQ(25))).toBe('25π');
    expect(answerText(piQ(25), 26)).toBe('26π'); // a wrong answer as the tutor is told it
    expect(answerText(piQ(1))).toBe('π');
    expect(answerText(piQ(-1))).toBe('-π');
    expect(answerText(piQ(12.5))).toBe('12.5π');
    expect(afterPlain('\\pi')).toBe('π');
  });

  it('the question in words reads π as π and names the answer row', () => {
    const plain = itemPlain(piQ(25));
    expect(plain).toBe('מה שטח עיגול שרדיוסו 5 ס״מ? כתבו בעזרת π. [התשובה בצורה □π]');
    expect(plain).not.toContain('\\');
    expect(itemPlain(pkQ(25))).toBe('חשבו עם π \\approx 3.14 ועגלו לעשירית.');
  });

  it('withPiNote: a □π question says once what to type, and no other question does', () => {
    const noted = withPiNote(piQ(25));
    expect(noted.text).toBe(`מה שטח עיגול שרדיוסו $5$ ס״מ? כתבו בעזרת $\\pi$. ${PI_NOTE}`);
    expect(PI_NOTE).toBe('(כותבים רק את המספר שלפני\u00a0$\\pi$.)');
    expect(withPiNote(noted)).toBe(noted);
    const plain = num(5);
    expect(withPiNote(plain)).toBe(plain);
    expect(withPiNote(pkQ(5)).text).not.toContain(PI_NOTE);
  });

  it('a lesson notes its first □π question only, and keeps a decimal π value open without recording it', () => {
    const items = [piQ(25, { level: 1, topic: 'pyth', key: 'a' }), piQ(16, { level: 1, topic: 'pyth', key: 'b' }), num(3, { level: 1, topic: 'pyth', key: 'c' })];
    let s = startLesson({ kind: 'check', purpose: 'class', fixedItems: items, topic: 'pyth', level: 1 });
    expect(s.item.text.endsWith(PI_NOTE)).toBe(true);
    // the whole value typed: a note on the form; the state is unchanged (no attempt, no event, no mistake)
    const r = answer(s, 78.5);
    expect(r.result).toEqual({ partial: 'pi-value' });
    expect(r.s).toBe(s);
    const ok = answer(s, 25);
    expect(ok.result.ok).toBe(true);
    s = next(ok.s);
    expect(s.item.key).toBe('b');
    expect(s.item.text).not.toContain(PI_NOTE);
  });

  it('a pk question\'s diag compares each misconception\'s multiple of π the same two ways', () => {
    // a circumference from r = 5 with 3.14: the radius used for the diameter predicts 5π, so 15.7 or 15.71 both name it
    const it = { ...pkQ(10), diag: (u) => (piNear(u, 5) ? 'r-for-d' : piNear(u, 25) ? 'area-for-circ' : null) };
    expect(it.diag(15.7)).toBe('r-for-d');
    expect(it.diag(15.71)).toBe('r-for-d');
    expect(it.diag(78.5)).toBe('area-for-circ');
    expect(it.diag(31.4)).toBeNull();
  });
});

describe('a model asks with π per question', () => {
  const stair = { skill: 'circle:1', topic: 'circle', level: 1, title: 'היקף מעגל' };
  // circumference with π (k 0) or the radius from a circumference (k 1, no π after the slot)
  const model = {
    params: () => ({ r: 13, k: 0 }),
    text: (p) => (p.k ? `היקף מעגל $${2 * p.r}\\pi$. מה הרדיוס?` : `מה היקף מעגל שרדיוסו $${p.r}$? כתבו בעזרת $\\pi$.`),
    answer: (p) => (p.k ? p.r : 2 * p.r), bugs: { 'r-for-d': (p) => (p.k ? 2 * p.r : p.r) }, solution: () => [], hint: () => '',
    after: (p) => (p.k ? undefined : '\\pi'), pk: 3,
  };
  it('modelItem calls a function-valued after, and never copies pk', () => {
    const fwd = modelItem(stair, model, { r: 13, k: 0 }, 'diag');
    expect(fwd.after).toBe('\\pi');
    expect(answerText(fwd)).toBe('26π');
    expect(fwd.pk).toBeUndefined();
    const inv = modelItem(stair, model, { r: 13, k: 1 }, 'diag');
    expect(inv.after).toBeUndefined(); // the radius is 13, not 13π
    expect(answerText(inv)).toBe('13');
    expect(partialOf(inv, 40.8)).toBeNull();
    // a static after is copied as it is
    expect(modelItem(stair, { ...model, after: '\\pi' }, { r: 13, k: 1 }, 'diag').after).toBe('\\pi');
    // the model's own bug is a misconception, not a form: 13 typed for 26π
    expect(partialOf(fwd, 13)).toBeNull();
    expect(partialOf(fwd, 81.64)).toBe('pi-value');
  });
});
