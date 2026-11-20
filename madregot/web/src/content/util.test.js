// Reading answers exactly as students write them, and the shared answer rules of stage 1 (CURRICULUM-2 items 4-7):
// mixed numbers and thousands on a computer keyboard, the `precise` rule, the fraction answer form and its
// "not reduced yet" note, the format sentence, exact answer text, and practice-only questions kept out of checks; and
// stage 4's rule that an answer is never a number the question shows (notGuessable).
import { describe, it, expect, afterEach } from 'vitest';
import { parseNum, readNumCandidates, numRight, shortDec, plainNum, toFrac, exactTex, fractionHint, withFormatNote, S, opMark, minusOp, undoOp, divOp, mulOp, unmark, unmarkLine, flipLine, withPiNote, piNear, piValue, afterPlain, PI_AFTER, PI_NOTE, needsFormat, placesOf, roundTo, FRACTION_HINT, FORMAT_LINE } from './util.js';
import { holds } from '../learn/expr.ts';
import { TOPIC, makeItem, testItem, fairForCheck, slotsFor, readAnswer, isCorrect, partialOf, answerText, itemPlain } from './index.js';
import { startLesson, answer, next } from '../lib/lesson.js';
import { finalCheck } from '../components/learn/Together.jsx';
import { modelItem } from '../learn/items.ts';
import * as CW from './circle.js';
import { notGuessable } from './frac.js';
import { ensureTopics } from '../learn/content/index.ts';
import { SYM_SHAPES } from './transf.gen.js';
import { loadAllGens } from './index.js';
// the exercise generators load per topic (the boot split); this file makes questions while its tests are collected
await loadAllGens();

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
    // a space anywhere else between digits is not a number yet: "1 3" is never 13, "5 13" never 513 (the keypad's space
    // key can type them on the way to 1 3/4)
    for (const s of ['1 3', '5 13', '-1 3', '−1 3', '1 3/', '2 000', '1 .5', '1. 5']) expect(parseNum(s), s).toBeNull();
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

  it('a mixed number left half typed is not an answer yet: "5 " after the space key, "1 3" before the fraction', () => {
    expect(readAnswer(num(5), { v: '5 ' })).toBeNull();
    expect(readAnswer(num(-13), { v: '-1 3' })).toBeNull();
    expect(readAnswer(num(16 / 3), { v: '5 1/3' })).toBeCloseTo(16 / 3, 12);
    expect(readAnswer(num(5), { v: '5' })).toBe(5);
    expect(readAnswer(num(-3), { v: '- 3' })).toBe(-3);
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

describe('a signed number in the class\'s brackets (CLASSROOM-2)', () => {
  it('S writes every number with its sign in brackets, and zero alone', () => {
    expect(S(14)).toBe('(+14)');
    expect(S(-9)).toBe('(-9)');
    expect(S(1)).toBe('(+1)');
    expect(S(-12)).toBe('(-12)');
    expect(S(0)).toBe('0');
  });
  it('the bracketed form reads back as the same number', () => {
    for (const n of [-12, -1, 0, 1, 12]) expect(parseNum(S(n).replace(/[()]/g, ''))).toBe(n);
  });
});

describe('an equation line as the class writes it (CLASSROOM-7)', () => {
  it('opMark puts the operation after a slash at the end of the line it acts on', () => {
    expect(opMark('3x + 9 = 4x', '-3x')).toBe('3x + 9 = 4x \\qquad /{-3x}');
    expect(opMark('x - 8 = 2', '+8')).toBe('x - 8 = 2 \\qquad /{+8}');
    expect(opMark('2x = 18', ':2')).toBe('2x = 18 \\qquad /{:}2');
    expect(opMark('-3x = 12', ':(-3)')).toBe('-3x = 12 \\qquad /{:}(-3)');
    expect(opMark('\\frac{x}{2} = 5', '\\cdot 2')).toBe('\\frac{x}{2} = 5 \\qquad /{\\cdot}2');
    expect(opMark('2x > 6', '·2')).toBe('2x > 6 \\qquad /{\\cdot}2');
    // anything that is not an operation on both sides is refused
    expect(() => opMark('x = 1', 'x')).toThrow();
    expect(() => opMark('x = 1', '-')).toThrow();
  });
  it('the operations are written with their signs, a negative divisor in brackets', () => {
    expect(minusOp('3x')).toBe('-3x');
    expect(minusOp('-2x')).toBe('+2x');
    expect(undoOp(5)).toBe('-5');
    expect(undoOp(-7)).toBe('+7');
    expect(divOp(4)).toBe(':4');
    expect(divOp(-3)).toBe(':(-3)');
    expect(mulOp(3)).toBe('\\cdot 3');
    expect(mulOp(-2)).toBe('\\cdot (-2)');
  });
  it('the mark is not part of the equation: it is read without it, and left out when no line follows', () => {
    expect(unmark('3x + 9 = 4x \\qquad /{-3x}')).toBe('3x + 9 = 4x');
    expect(unmark('2x = 8')).toBe('2x = 8');
    expect(holds('3x + 9 = 4x \\qquad /{-3x}', { x: 9 })).toBe(true);
    expect(holds('-2x > 6 \\qquad /{:}(-2)', { x: -4 })).toBe(true);
    expect(unmarkLine('מחברים: $y$ נעלם. $4x = 12 \\qquad /{:}4$')).toBe('מחברים: $y$ נעלם. $4x = 12$');
    expect(flipLine('9')).toBe('$x = 9$ (הפכנו צדדים)');
    expect(flipLine('-2', 'y')).toBe('$y = -2$ (הפכנו צדדים)');
  });
});

describe('the precise rule (items marked precise: true)', () => {
  // the spec's table, line by line: [answer, typed, right?]
  const TABLE = [
    [1 / 12, '0.08', true], [1 / 12, '0.083', true], [1 / 12, '1/12', true], [1 / 12, '0.1', false],
    [7 / 12, '0.58', true], [7 / 12, '0.583', true], [7 / 12, '7/12', true], [7 / 12, '14/24', true], [7 / 12, '0.59', false],
    [1 / 36, '1/36', true], [1 / 36, '1/35', false],
    // 0.125 has no two-place decimal: its question says to round to two places, and 0.13 is that rounding (0.12 is not)
    [0.125, '0.125', true], [0.125, '1/8', true], [0.125, '0.12', false], [0.125, '0.13', true],
    [-4 / 3, '-1.33', true], [-4 / 3, '-4/3', true], [-4 / 3, '-1.3', false],
    // PRODUCT2-6: a better rounding is right, a decimal cut off is not
    [2 / 3, '0.67', true], [2 / 3, '0.667', true], [2 / 3, '0.6667', true], [2 / 3, '2/3', true],
    [2 / 3, '0.666', false], [2 / 3, '0.6666', false], [2 / 3, '0.7', false], [2 / 3, '0.66', false],
    [7 / 12, '0.5833', true], [7 / 12, '0.58333', true], [7 / 12, '0.5834', false], [7 / 12, '0.584', false],
    [4 / 3, '1.3333', true], [4 / 3, '1.333', true], [4 / 3, '1.33', true], [4 / 3, '1 1/3', true], [4 / 3, '1.334', false], [4 / 3, '1.3', false],
    [-4 / 3, '-1.3333', true], [-4 / 3, '-1.333', true], [-4 / 3, '-1.334', false], [-4 / 3, '-1.3334', false],
    [16 / 3, '5 1/3', true], [16 / 3, '5.33', true], [16 / 3, '5.3', false],
    [2.5, '2.5', true], [2.5, '2 1/2', true], [2.5, '2.51', false],
    // math7 oracle: answers whose two-place rounding ends in 0 (19/21 is 0.90, −8/27 is −0.30, 16/81 is 0.20, 7/23 is
    // 0.30, 23/21 is 1.10). The question says "rounded to two places", so 0.90 is right, and 0.9 too: the same number
    // with its last zero left off. A wrong rounding (0.91, −0.29, 1.09) and a cut-off decimal (0.19 for 0.1975…) are not.
    [19 / 21, '0.90', true], [19 / 21, '0.9', true], [19 / 21, '0.905', true], [19 / 21, '0.904', false], [19 / 21, '0.91', false], [19 / 21, '0.8', false],
    [-8 / 27, '-0.30', true], [-8 / 27, '-0.3', true], [-8 / 27, '-0.29', false],
    [16 / 81, '0.20', true], [16 / 81, '0.19', false], [7 / 23, '0.30', true],
    [23 / 21, '1.10', true], [23 / 21, '1.1', true], [23 / 21, '1.09', false], [2 / 21, '0.10', true],
  ];
  it.each(TABLE)('answer %d, typed %s: right is %s', (a, typed, right) => {
    expect(typedRight(num(a, { precise: true }), typed)).toBe(right);
  });

  it('an exact value is right, and so is a decimal of two or more places rounded correctly at its own places', () => {
    expect(shortDec(0.125)).toBe(true);
    expect(shortDec(7)).toBe(true);
    expect(shortDec(7 / 12)).toBe(false);
    expect(shortDec(1 / 35)).toBe(false);
    expect([placesOf(7), placesOf(0.67), placesOf(0.6667), placesOf(-1.3333), placesOf(16.97)]).toEqual([0, 2, 4, 4, 2]);
    // school rounding: a half goes away from zero, also where floating point stores it a hair below
    expect([roundTo(0.125, 2), roundTo(-1.335, 2), roundTo(1.005, 2), roundTo(2 / 3, 4)]).toEqual([0.13, -1.34, 1.01, 0.6667]);
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

  it('a question whose answer has no two-place decimal says once how to write it, with an example that is not its answer', () => {
    const it7 = withFormatNote(num(7 / 12, { precise: true }));
    expect(it7.text).toBe(`כמה? ${fractionHint('5/9')}`);
    expect(withFormatNote(it7)).toBe(it7); // once
    expect(withFormatNote(num(1 / 36, { precise: true })).text).toBe(`כמה? ${fractionHint()}`);
    expect(fractionHint()).toBe('אפשר לכתוב כשבר (למשל $7/12$) או כמספר עשרוני מעוגל לשתי ספרות אחרי הנקודה.');
    expect(FRACTION_HINT).toBe(fractionHint());
    expect(FORMAT_LINE.test(fractionHint('-4/3'))).toBe(true);
    // whole answers and those with two places or fewer need no note; 0.125 has three, so it is rounded to two (0.13)
    const whole = num(3, { precise: true });
    expect(withFormatNote(whole)).toBe(whole);
    const short = num(0.25, { precise: true });
    expect(withFormatNote(short)).toBe(short);
    expect(withFormatNote(num(0.125, { precise: true })).text).toBe(`כמה? ${fractionHint()}`);
    expect([needsFormat(0.125), needsFormat(0.29), needsFormat(-1.3), needsFormat(4 / 3), needsFormat(3), needsFormat('1/3')]).toEqual([true, false, false, true, false, false]);
    // every typed number gets it, not only the precise ones (a slope of -5/6, a mean of 13/3), but never a rounded
    // length (it says to round to tenths) or a question that asks for a decimal (a fraction is not read there)
    expect(withFormatNote(num(-5 / 6)).text).toBe(`כמה? ${fractionHint()}`);
    const root = num(7.1, { exact: Math.sqrt(50), text: 'מה אורך היתר? אם יוצא מספר לא שלם, עגלו לעשירית.' });
    expect(withFormatNote(root)).toBe(root);
    const dec = num(0.375, { askDec: true, precise: true, text: 'כתבו כמספר עשרוני:' });
    expect(withFormatNote(dec)).toBe(dec);
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
  it('a model without the flag keeps ±0.01, and its answer with no two-place decimal says how to write it', () => {
    const it = modelItem(stair, model({}), {}, 'diag');
    expect(it.precise).toBeUndefined();
    expect(it.text).toBe(`כמה? ${fractionHint('5/9')}`);
    expect(typedRight(it, '0.59')).toBe(true);
    expect(modelItem(stair, model({ answer: () => 0.75 }), {}, 'diag').text).toBe('כמה?');
    expect(modelItem(stair, model({ fmt: 'dec', answer: () => -1.3 }), {}, 'diag').fmt).toBe('dec');
  });
});

describe('isCorrect, as the lesson reads a typed answer (PRODUCT2-6, SK-MATH-2)', () => {
  // [item, typed, right?]: precise answers, ordinary ones (±0.01), and lengths rounded to tenths (their exact value)
  const P = (a) => num(a, { precise: true });
  const L = (exact) => num(Math.round(exact * 10) / 10, { topic: 'pyth', exact, text: 'מה אורך היתר? אם יוצא מספר לא שלם, עגלו לעשירית.' });
  const TABLE = [
    [P(2 / 3), '0.67', true], [P(2 / 3), '0.6667', true], [P(2 / 3), '0.666', false], [P(2 / 3), '0.6666', false],
    [P(7 / 12), '0.58', true], [P(7 / 12), '0.5833', true], [P(7 / 12), '0.59', false],
    [P(4 / 3), '1.33', true], [P(4 / 3), '1.3333', true], [P(4 / 3), '1 1/3', true], [P(4 / 3), '1.3', false],
    [P(-4 / 3), '-1.33', true], [P(-4 / 3), '-1.3333', true], [P(-4 / 3), '-4/3', true], [P(-4 / 3), '-1.3', false], [P(-4 / 3), '-1.4', false],
    // an ordinary item keeps ±0.01: -1.33, -1.333 and -4/3 right for -4/3 (its question says so), -1.3 and -1.4 not
    [num(-4 / 3), '-1.33', true], [num(-4 / 3), '-1.333', true], [num(-4 / 3), '-4/3', true], [num(-4 / 3), '-1.3', false], [num(-4 / 3), '-1.4', false],
    // √50 = 7.0710…: the exact value rounded at the places typed, tenths or finer
    [L(Math.sqrt(50)), '7.1', true], [L(Math.sqrt(50)), '7.07', true], [L(Math.sqrt(50)), '7.071', true],
    [L(Math.sqrt(50)), '7.12', false], [L(Math.sqrt(50)), '7.05', false], [L(Math.sqrt(50)), '7', false], [L(Math.sqrt(50)), '7.0', false], [L(Math.sqrt(50)), '7.08', false],
    // √288 = 16.970…: 17.0 is its rounding to tenths, a whole number, and 16.97 is right too
    [L(Math.sqrt(288)), '17', true], [L(Math.sqrt(288)), '17.0', true], [L(Math.sqrt(288)), '16.97', true], [L(Math.sqrt(288)), '16.971', true],
    [L(Math.sqrt(288)), '16.9', false], [L(Math.sqrt(288)), '16.98', false], [L(Math.sqrt(288)), '17.02', false],
  ];
  it.each(TABLE)('%#: typed %s', (it, typed, right) => {
    expect(typedRight(it, typed), `${it.answer} ${typed}`).toBe(right);
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
  // func: flatMc, pointMc and drawStory (func:1), isFunction and drawTable (func:2), whichMc and drawShape (func:3),
  // uniformMc, fasterMc and a rate continued (func:4; stage5.md FUNC-2)
  // eq: tableMc, which equation fits a motion table (eq:6; stage5.md FUNC-3), and lcdMc, the smallest common denominator
  // (eq:7; FUNC-4)
  // data: barRead (an axis label), listCount (a number of the list), groupsMc, buildBar and axisMc (data:1), compareMc
  // (data:2), buildPie and pieOk (data:3), scaleMc and the covered wheel (data:4)
  // signed (CLASSROOM-1, -2, -3): the regrouped line of a chain (signed:1), which numbers have absolute value n (signed:2)
  // and dividing with 0 and 1 (signed:3); expr (CLASSROOM-6): the regrouping by families, and a collecting question whose
  // two families both cancel (0x + 0 = 0: typing 0 and 0 would always earn it)
  // area (stage 2, MEASURE-2): the units (ar1u), the height (ar2w) and the L's computation (ar3m) are choices; the
  // grid shapes whose target the question names: the rectangle (ar1b), the parallelogram's move (ar4c), the largest area (ar5b)
  // solid (stage 2, MEASURE-3): the nets, a face, a missing base, a box or a prism built (so1n, so3n, so2b, so4b), the
  // four nets to choose from (so1m), and how many times the volume grows (so4k, one of four numbers)
  // circle (stage 2, MEASURE-4): the circle object set to a circumference or an area (ci1m, ci2m), one sheet rolled two
  // ways (ci3m) and how many cones fill the cylinder (ci4m)
  // transf (curriculum stage 4): the copy slid, flipped and turned (tf1c, tf2c, tf3c), which slide (tf1w), the axes of
  // symmetry (tf2s), the least turn (tf3r), which move (tf4m), two rectangles congruent? (tf4r), tiles at a point (tf4t)
  // congr (curriculum stage 4): the angle by the ticks (cg1t: its answer is always 180° minus both printed), which side
  // (cg1p), which theorem (cg2w), what is missing (cg2n), the same perimeter (cg2p), the proof object (cg3f, cg3o), which
  // row is wrong (cg3e), which segment (cg4s), a claim about the median (cg4c), can these lengths make a triangle (cg5c),
  // which angle is the largest (cg5m); sim: how many isosceles triangles (sm1c), a theorem's converse (sm1v), the
  // isosceles proofs (sm1p), similar shapes (sm2s), which triangle in which order (sm3w), the similarity proof (sm3o),
  // two angles in each triangle (sm3a), the area on the grid (sm4g)
  const PRACTICE_ONLY = ['fr1p', 'fr2p', 'fr2o', 'fr3c', 'fr4g', 'sn6b', 'sn6p', 'ra1m', 'ra1a', 'ra1b', 'ra2t', 'ra3p', 'ra3l', 'ra4b',
    'pc1s', 'pc1e', 'pc1o', 'pc2c', 'pc4s', 'pc5m', 'fu1f', 'fu1p', 'fu1s', 'fu2i', 'fu2d', 'fu3w', 'fu3s', 'fu4u', 'fu4f', 'fu4n', 'eq6t', 'eq7l',
    'da1r', 'da1c', 'da1g', 'da1b', 'da1a', 'da2c', 'da3b', 'da3o', 'da4s', 'da4w',
    // stats:6-8 (curriculum stage 3): which measure moves, what does not fit, between or beyond, a trend carried too far
    'st6o', 'st7c', 'st8w', 'st8l',
    // prob:1-3: the rain table's scale, a die that is not fair, the gambler, what a forecast says, (a, b) and (b, a), a
    // double against a mixed pair, two dice thrown many times
    'pr1s', 'pr1f', 'pr2g', 'pr2f', 'pr3o', 'pr3s', 'pr3d',
    'sn1r', 'sn2m', 'sn3z', 'ex3r', 'ex3z',
    // the median bar whose answer is the number the question names (CURRICULUM-10's guessing test sets objects too)
    'st2b',
    // the class's split triangle S1 (CLASSROOM-11): its answer is 90° minus a printed number
    'an3a',
    // "is OC the bisector?", a choice among three reasons (CLASSROOM-10)
    'an6c',
    // stage 2's measurement units (the kinds named above)
    'ar1u', 'ar1b', 'ar2w', 'ar3m', 'ar4c', 'ar5c', 'ar5b',
    'so1n', 'so1m', 'so2b', 'so3n', 'so4k', 'so4b', 'ci1m', 'ci2m', 'ci3m', 'ci4m', 'sp1w', 'sp2m',
    // curriculum stage 4's geometry units (the kinds named above)
    'tf1c', 'tf1w', 'tf2c', 'tf2s', 'tf3c', 'tf3r', 'tf4m', 'tf4r', 'tf4t',
    'cg1t', 'cg1p', 'cg2w', 'cg2n', 'cg2p', 'cg3f', 'cg3o', 'cg3e', 'cg4s', 'cg4c', 'cg5c', 'cg5m',
    'sm1c', 'sm1v', 'sm1p', 'sm2s', 'sm3w', 'sm3o', 'sm3a', 'sm4g'];
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

// The circle's model (stage 2, MEASURE-4), as the teaching will wrap it: the circumference asked with π (□π), the radius
// from a circumference without it (13, not 13π); a pk question never comes from a model.
describe('circle1 asks with π per question', () => {
  const stair = { skill: 'circle:1', topic: 'circle', level: 1, title: 'היקף מעגל' };
  const model = {
    params: CW.CIRCLE1.params, answer: CW.CIRCLE1.answer, bugs: CW.CIRCLE1.bugs, after: CW.CIRCLE1.after,
    text: CW.circle1Text, fig: CW.circle1Fig, solution: CW.circle1Solution, hint: CW.circle1Hint, unit: CW.UNIT.cm,
  };
  it('the inverse (k = 1) has no after, the forward (k = 0) has π after its slot, and neither carries pk', () => {
    const inv = modelItem(stair, model, { k: 1, r: 13, c: 26 }, 'diag');
    expect(inv.after).toBeUndefined();
    expect(inv.answer).toBe(13);
    expect(inv.text).toBe('היקף מעגל $26\\pi$ ס״מ. מה הרדיוס?');
    const fwd = modelItem(stair, model, { k: 0, r: 13, c: 26 }, 'diag');
    expect(fwd.after).toBe(PI_AFTER);
    expect(fwd.answer).toBe(26);
    expect(answerText(fwd)).toBe('26π');
    for (const it of [inv, fwd]) expect(it.pk).toBeUndefined();
    // and the inverse's diagnosis: the diameter typed for the radius
    expect(inv.diag(26)).toBe('d-for-r');
    expect(fwd.diag(13)).toBe('r-for-d');
    expect(fwd.diag(169)).toBe('area-for-circ');
  });
});

describe('the answer is never shown (stage 4 §0.5, notGuessable)', () => {
  it('an answer equal to a printed number is redrawn', () => {
    expect(notGuessable(12, [8, 6])).toBe(true);
    expect(notGuessable(6, [8, 6])).toBe(false);
    expect(notGuessable(2.5, [2.5, 4])).toBe(false);
    expect(notGuessable(-3, [3])).toBe(true); // the sign is part of the number
    expect(notGuessable(5, [])).toBe(true);
  });
  it('an angle that is 180 − n, 90 − n or 360 − n of a printed n is redrawn; other answers keep that rule off', () => {
    // ∢A = 50°, ∢B = 60°: the third angle 70° is none of 130, 120, 40, 30, 310, 300, 50, 60
    expect(notGuessable(70, [50, 60], true)).toBe(true);
    expect(notGuessable(130, [50, 60], true)).toBe(false); // 180 − 50
    expect(notGuessable(30, [50, 60], true)).toBe(false); // 90 − 60
    expect(notGuessable(310, [50, 60], true)).toBe(false); // 360 − 50
    expect(notGuessable(60, [50, 60], true)).toBe(false); // printed
    // a length is not an angle: 180 − 50 is a fair length
    expect(notGuessable(130, [50, 60])).toBe(true);
    // the critique's slip: (3x + 10)° with ∢M = 70° gave x = 20 = 90 − 70, which a 90 − n guesser types
    expect(notGuessable(20, [3, 10, 70], true)).toBe(false);
    expect(notGuessable(20, [2, 10, 70, 45], true)).toBe(false);
    expect(notGuessable(30, [2, 10, 70, 45], true)).toBe(true); // (2x + 10)° = 70°: x = 30
  });
  it('compares to a billionth, as clean() does', () => {
    expect(notGuessable(0.1 + 0.2, [0.3])).toBe(false);
    expect(notGuessable(0.3001, [0.3])).toBe(true);
  });
});

// Curriculum stage 4's review: "AB = 5x − 6 ס״מ … מה x?" had x = 6, and "(3x − 20)° … מה x?" x = 20. The models compared
// the answer with the signed constant (−6), while the student reads the 6 after the minus sign. Over the geometry stairs'
// questions that a check may ask (fairForCheck), the answer is none of the numbers the question or its drawing prints,
// whatever their sign.
describe('a geometry answer is never a number printed in its question or drawing, read without its sign', () => {
  const seeded = (seed) => { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
  const strings = (o, out = []) => { if (o == null) return out; if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (typeof o === 'object') Object.values(o).forEach((x) => strings(x, out)); return out; };
  const shown = (it) => [it.text || '', ...strings(it.fig)].join(' ').match(/\d+(\.\d+)?/g)?.map(Number) || [];
  for (const topic of ['transf', 'congr', 'sim']) {
    it(`${topic}: 1,500 draws of every stair`, async () => {
      await ensureTopics([topic]);
      const real = Math.random; Math.random = seeded(20261112);
      const bad = [];
      try {
        TOPIC[topic].levels.forEach((_, i) => {
          for (let k = 0; k < 1500; k += 1) {
            const it = makeItem(topic, i + 1);
            if (!fairForCheck(it) || typeof it.answer !== 'number') continue;
            if (shown(it).includes(Math.abs(it.answer))) bad.push(`${topic}:${i + 1} ${it.key}: ${it.text} (${it.answer})`);
          }
        });
      } finally { Math.random = real; }
      expect(bad.slice(0, 6)).toEqual([]);
    }, 60_000);
  }
});

// Curriculum stage 4's review: "כמה צירי סימטריה יש למשולש שווה־שוקיים?" accepted only 1, while sim:1 teaches that an
// equilateral triangle is isosceles (it has 3); a rectangle may be a square (4). Every shape counted is named so that it
// has one count: a class whose special case has another count is named without that case.
describe('the axes of symmetry are counted for one shape, never for a class with a special case (transf:2)', () => {
  // a class, the special case inside it, and the special case's count
  const SPECIAL = [['מלבן', 'ריבוע', 4], ['מעוין', 'ריבוע', 4], ['משולש שווה־שוקיים', 'שווה־צלעות', 3], ['דלתון', 'מעוין', 2], ['מקבילית', 'מלבן', 2], ['מקבילית', 'מעוין', 2]];
  it('a name with a special case of another count leaves that case out', () => {
    for (const [id, sh] of Object.entries(SYM_SHAPES)) {
      for (const [cls, special, m] of SPECIAL) {
        if (!sh.name.startsWith(cls) || m === sh.n) continue;
        expect(sh.name, `${id}: ${sh.name}`).toMatch(new RegExp(`שאינ(ו|ה) ${special}|ואינה ${special}`));
      }
    }
  });
});

// Curriculum stage 4's review read two lines as unnatural Hebrew: "הצלע שלו פי k ארוכה" (the word order) and "איזו זווית
// הגדולה ביותר?" (no copula). They are written "כל צלע ארוכה פי k" and "איזו זווית היא הגדולה ביותר?"; neither old
// wording comes back in the geometry units' generators or teaching.
describe('the geometry units\' Hebrew reads naturally', () => {
  const sources = import.meta.glob(['./transf.gen.js', './congr.gen.js', './sim.gen.js', '../learn/content/transf.ts', '../learn/content/congr.ts', '../learn/content/sim.ts'], { query: '?raw', import: 'default', eager: true });
  it.each([/הצלע שלו פי \S+ ארוכה/, /איזו זווית הגדולה/])('never %s', (re) => {
    expect(Object.keys(sources)).toHaveLength(6);
    for (const [file, text] of Object.entries(sources)) expect(re.test(text), file).toBe(false);
  });
});
