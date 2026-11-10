// The final-answer guard (ai spec AI-3 Design 2): a reply under WITHHOLD never states the exercise's final answer, in
// any of the ways it can be written, and nothing else is ever masked: not a number inside a longer one, not a value put
// in, not a step on the way, not a marker. The same guard runs over a reply that arrives in pieces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  answerForms, findLeaks, maskLeaks, streamGuard, withholdCheck, guardResult, guardFor, guardOn, MASK_NOTE, STREAM_FORCE,
} from '../../shared/guard.js';
import { answerGuard } from '../../shared/ai.js';

const ctxOf = (answer, form = 'num', topicId = 'signed', policy = 'withhold') => ({ topicId, item: { text: 'תרגיל', answer, form }, policy: { answer: policy } });
const formsOf = (answer, form, topicId) => answerForms(ctxOf(answer, form, topicId));
const mask = (answer, form, topicId, text) => maskLeaks(text, formsOf(answer, form, topicId)).text;

// (answer, form, topic, text) → what the student sees
const TABLE = [
  // (i) the right-hand side of the last "=" in a $…$ run
  ['2', 'num', 'signed', '$-4 + 6 = 2$', '$-4 + 6 = ?$'],
  ['2', 'num', 'signed', 'ולכן $-4 + 6 = 2$. מה עכשיו?', 'ולכן $-4 + 6 = ?$. מה עכשיו?'],
  ['8', 'num', 'signed', '$3 - (-5) = 3 + 5 = 8$', '$3 - (-5) = 3 + 5 = ?$'],
  ['-2', 'num', 'signed', 'ולכן $3 - 5 = -2$.', 'ולכן $3 - 5 = ?$.'],
  ['-2', 'num', 'signed', '$3 - 5 = −2$', '$3 - 5 = ?$'],
  ['-2', 'num', 'signed', '$3 - 5 = (-2)$', '$3 - 5 = (?)$'],
  ['-3/4', 'num', 'signed', '$-6 : 8 = -\\frac{3}{4}$', '$-6 : 8 = ?$'],
  ['-3/4', 'num', 'signed', '$-6 : 8 = \\frac{-3}{4}$', '$-6 : 8 = ?$'],
  ['-3/4', 'num', 'signed', '$-6 : 8 = -0.75$', '$-6 : 8 = ?$'],
  ['5/2', 'num', 'stats', '$5 : 2 = 2\\frac{1}{2}$', '$5 : 2 = ?$'],
  ['5/2', 'num', 'stats', '$5 : 2 = 2{,}5$', '$5 : 2 = ?$'],
  ['2.5', 'num', 'stats', '$\\frac{10}{4} = \\frac{5}{2}$', '$\\frac{10}{4} = ?$'],
  ['40', 'num', 'angles', 'הזווית $= 180° - 140° = 40°$', 'הזווית $= 180° - 140° = ?$'],
  ['5', 'num', 'pyth', '$c^2 = 25$, ולכן $c = 5$', '$c^2 = 25$, ולכן $c = ?$'],
  ['7.1', 'num', 'pyth', '$\\sqrt{50} \\approx 7.1$', '$\\sqrt{50} \\approx ?$'],
  ['(2, -1)', 'pt', 'line', '$A = (2, -1)$', '$A = ?$'],
  ['y = 2x - 3', 'line', 'line', 'כך: $y=2x-3$', 'כך: $y=?$'],
  ['y = 2x - 3', 'line', 'line', '$y = -3 + 2x$', '$y = ?$'],
  ['y = 1x + 4', 'line', 'line', '$y = x + 4$', '$y = ?$'],
  ['y = 2x - 3', 'line', 'line', '$y = 2x + -3$', '$y = ?$'],
  ['3', 'num', 'eq', 'ולכן $x = 3$', 'ולכן $x = ?$'],
  ['3', 'num', 'eq', '$x = 6 : 2 = 3$', '$x = 6 : 2 = ?$'],
  ['3x + 12', 'lin', 'expr', 'פותחים: $3(x+4) = 12 + 3x$', 'פותחים: $3(x+4) = ?$'],
  ['3x + 12', 'lin', 'expr', '$3(x+4) = 3x + 12$', '$3(x+4) = ?$'],
  ['x - 3', 'lin', 'expr', '$2x - 3 - x = x - 3$', '$2x - 3 - x = ?$'],
  ['-x', 'lin', 'expr', '$2x - 3x = -x$', '$2x - 3x = ?$'],
  // (i) in plain text, outside $…$
  ['8', 'num', 'signed', '3 + 5 = 8 וזה הכול', '3 + 5 = ? וזה הכול'],
  // (ii) right after a cue
  ['-3/4', 'num', 'signed', 'התשובה היא $-\\frac{3}{4}$', 'התשובה היא $?$'],
  ['0.75', 'num', 'stats', 'התשובה היא 0,75', 'התשובה היא ?'],
  ['0.75', 'num', 'stats', 'התוצאה: $\\frac{3}{4}$.', 'התוצאה: $?$.'],
  ['(2, -1)', 'pt', 'line', 'יוצאת הנקודה $(2,-1)$', 'יוצאת הנקודה $?$'],
  ['(2, -1)', 'pt', 'line', 'יוצא $\\left( 2 , −1 \\right)$', 'יוצא $?$'],
  ['8', 'num', 'signed', 'הביטוי שווה ל־8.', 'הביטוי שווה ל־?.'],
  ['8', 'num', 'signed', 'ולכן התשובה הסופית היא $8$', 'ולכן התשובה הסופית היא $?$'],
  ['שלילית', 'mc', 'signed', 'התשובה הנכונה היא שלילית', 'התשובה הנכונה היא ?'],
  ['y = 2x - 3', 'line', 'line', 'הישר הוא... התשובה היא $y = 2x - 3$', 'הישר הוא... התשובה היא $?$'],
  ['2', 'num', 'signed', 'זה 2', 'זה ?'],
  ['8', 'num', 'signed', 'וזה $8$, כי…', 'וזה $?$, כי…'],
  // (iii) the form, then "היא התשובה"
  ['2', 'num', 'signed', '$2$ היא התשובה', '$?$ היא התשובה'],
  ['8', 'num', 'signed', 'אז 8 הוא התוצאה.', 'אז ? הוא התוצאה.'],
  // never masked: digit bounds, values put in, steps on the way, other numbers, markers
  ['2', 'num', 'signed', 'זזים 2 צעדים ימינה', null],
  ['2', 'num', 'signed', 'נסו $12$ או $2.5$ או $-2$', null],
  ['2', 'num', 'signed', 'זה אומר שזזים 2 צעדים', null],
  ['2', 'num', 'signed', '$5 + 2 = 7$', null],
  ['2', 'num', 'signed', '$-4 + 6 = 2 \\cdot 1$ ?', null],
  ['2', 'num', 'signed', 'התוצאה של $2 \\cdot 3$', null],
  ['2', 'num', 'signed', 'התשובה היא 2/3 מהדרך', null],
  ['2', 'num', 'signed', '[[care]]', null],
  ['2', 'num', 'signed', 'חלק מהתשובה\n[[blocked]]', null],
  ['2', 'num', 'signed', '\n[[error:bad_output]]', null],
  ['-2', 'num', 'signed', '$-25$', null],
  ['-2', 'num', 'signed', '$3 - 5 = -25$', null],
  ['0', 'num', 'line', 'מציבים $x = 0$', null],
  ['3', 'num', 'expr', 'מציבים $x = 3$ בביטוי', null],
  ['3x + 12', 'lin', 'expr', '$3x + 120$ הוא לא אותו דבר', null],
  ['y = 2x - 3', 'line', 'line', 'השיפוע הוא $2$ והחיתוך עם ציר y הוא $-3$', null],
  ['8', 'num', 'signed', 'כמה זה $3 + 5$? כתבו בתיבה.', null],
  ['8', 'num', 'signed', 'נסו דוגמה קטנה: $1 - (-2) = 3$.', null],
];

test(`the guard table: ${TABLE.length} rows, each leak masked and nothing else touched`, () => {
  assert.ok(TABLE.length >= 30);
  for (const [answer, form, topic, text, want] of TABLE) {
    assert.equal(mask(answer, form, topic, text), want ?? text, `${answer} (${form}, ${topic}) in: ${text}`);
  }
});

test('answerForms: every written form, letterOk only for eq and sys, no forms for an object answer', () => {
  assert.equal(answerForms({ item: {} }), null);
  assert.equal(answerForms(null), null);
  assert.equal(formsOf('3', 'num', 'eq').letterOk, true);
  assert.equal(formsOf('(2, 3)', 'pt', 'sys').letterOk, true);
  for (const t of ['signed', 'line', 'expr', 'pyth', 'stats', 'coord', 'angles']) assert.equal(formsOf('3', 'num', t).letterOk, false, t);
  // an answer written "x = 3" (the balance) is the answer itself in any topic
  assert.equal(formsOf('x = 3', 'manip', 'expr').letterOk, true);
  assert.equal(mask('x = 3', 'manip', 'expr', 'ולכן $x = 3$'), 'ולכן $x = ?$');
  // an object answer (pins on a line, tiles, an area, a ray) has no written form: the prompt alone holds
  for (const a of ['A ב־2, B ב־5', 'x > 3', '2 \\cdot (x + 3)', 'נקודה ברביע הראשון, למשל (2, 3)']) assert.equal(formsOf(a, 'manip', 'coord'), null, a);
  // a choice that is a number is found as a number
  assert.equal(mask('-12', 'mc', 'signed', 'התשובה היא $-12$'), 'התשובה היא $?$');
  // a whole number is never found in a fraction or a decimal, and no form has a lookbehind
  for (const a of ['2', '-2', '3/4', '-3/4', '2.5', '(2, -1)', 'y = 2x - 3', '3x + 12']) {
    const f = formsOf(a, a.startsWith('(') ? 'pt' : a.startsWith('y') ? 'line' : /x/.test(a) ? 'lin' : 'num', 'signed');
    assert.ok(f.forms.length > 0, a);
    for (const src of f.forms) { assert.doesNotThrow(() => new RegExp(src), src); assert.equal(src.includes('(?<'), false, src); }
  }
});

test('findLeaks gives the place of the form only: the cue, the "=" and the brackets stay', () => {
  const f = formsOf('-2', 'num', 'signed');
  const text = 'ולכן $3 - 5 = (-2)$';
  const [span] = findLeaks(text, f);
  assert.equal(text.slice(span.start, span.end), '-2');
  assert.deepEqual(findLeaks('', f), []);
  assert.deepEqual(findLeaks('$1 = 1$', null), []);
});

test('maskLeaks counts each leak once', () => {
  const r = maskLeaks('$-4 + 6 = 2$, כלומר התשובה היא $2$. $2$ היא התשובה.', formsOf('2', 'num', 'signed'));
  assert.equal(r.masked, 3);
  assert.equal(r.text, '$-4 + 6 = ?$, כלומר התשובה היא $?$. $?$ היא התשובה.');
});

// ---------------------------------------------------------------- a reply in pieces
const run = (f, pieces) => {
  const g = streamGuard(f);
  const out = pieces.map((p) => g.push(p)).join('') + g.end();
  return { out, masked: g.masked };
};

test('stream: "= " and "2$" in two pushes still come out "= ?$", and never "= 2"', () => {
  const f = formsOf('2', 'num', 'signed');
  const g = streamGuard(f);
  const shown = [];
  for (const p of ['נחבר: $-4 + 6 = ', '2$. ועכשיו', ' נבדוק.']) shown.push(g.push(p));
  shown.push(g.end());
  const out = shown.join('');
  assert.ok(out.includes('= ?$'), out);
  assert.ok(!shown.some((s) => /=\s*2/.test(s)), 'no piece ever shows the answer');
  assert.equal(out, 'נחבר: $-4 + 6 = ?$. ועכשיו נבדוק.');
  assert.equal(g.masked, 1);
});

test('stream: a cue in one sentence and the answer on the next line are still seen together', () => {
  const { out, masked } = run(formsOf('8', 'num', 'signed'), ['התשובה היא:', '\n', '$8$', '\nבדקו בעצמכם.']);
  assert.equal(out, 'התשובה היא:\n$?$\nבדקו בעצמכם.');
  assert.equal(masked, 1);
});

test('stream: a clean reply of 1,000 characters comes out byte-identical, in any pieces', () => {
  const f = formsOf('2', 'num', 'signed');
  const clean = 'נסו לחסר $3$ משני האגפים, ואז לחלק ב־$4$. זזים 12 צעדים, לא $2.5$! '.repeat(16).slice(0, 1000);
  assert.equal(clean.length, 1000);
  for (const size of [1, 7, 33, 1000]) assert.equal(run(f, clean.match(new RegExp(`[^]{1,${size}}`, 'g'))).out, clean, `pieces of ${size}`);
});

test('stream: a long sentence with no end is cut at 400 characters, and a leak at the cut is still masked', () => {
  const f = formsOf('2', 'num', 'signed');
  const long = `${'מילה '.repeat(78)}ולכן $-4 + 6 = 2$ וזה בלי נקודה ${'עוד '.repeat(30)}`;
  const g = streamGuard(f);
  const first = g.push(long.slice(0, 410));
  assert.ok(first.length > 0 && first.length <= STREAM_FORCE, 'something went out before the sentence ended');
  const out = first + g.push(long.slice(410)) + g.end();
  assert.equal(out, long.replace('= 2$', '= ?$'));
  assert.equal(g.masked, 1);
});

test('stream: markers pass untouched, and with no forms everything passes as it comes', () => {
  const f = formsOf('2', 'num', 'signed');
  assert.equal(run(f, ['[[care]]\n', 'אני כאן.', '\n[[blocked]]']).out, '[[care]]\nאני כאן.\n[[blocked]]');
  const g = streamGuard(null);
  assert.equal(g.push('$-4 + 6 = 2$'), '$-4 + 6 = 2$');
  assert.equal(g.end(), '');
  assert.equal(g.masked, 0);
});

test('stream: a maths run is never cut, and an unclosed run at the very end is still checked', () => {
  const f = formsOf('2', 'num', 'signed');
  const g = streamGuard(f);
  assert.equal(g.push('ככה: $1. 2. -4 + 6 = '), '', 'a "." inside maths is not the end of a sentence');
  assert.equal(g.push('2'), '');
  assert.equal(g.end(), 'ככה: $1. 2. -4 + 6 = ?');
});

// ---------------------------------------------------------------- the check and whole replies
const CHECK = {
  readable: true, care: false, transcript: '$2x + 4 = 10$ ... $x = 3$',
  steps: [
    { text: '$2x + 4 = 10$', ok: true, comment: '' },
    { text: '$2x = 6$', ok: true, comment: 'יפה, הורדתם 4 משני האגפים.' },
    { text: '$x = 3$', ok: true, comment: 'נכון, $x = 3$.' },
    { text: 'בדיקה', ok: true, comment: '' },
  ],
  final: 'correct',
  summary: 'הפתרון נכון: $x = 3$.',
};

test('a check under WITHHOLD: comments and summary masked, the line with the final value unmarked, final unknown, withheld', () => {
  const { data, masked } = withholdCheck(CHECK, formsOf('3', 'num', 'eq'));
  assert.equal(data.final, 'unknown');
  assert.equal(data.withheld, true);
  assert.equal(data.steps[2].ok, null, 'the last step that states a value');
  assert.equal(data.steps[2].comment, '');
  assert.deepEqual(data.steps.map((s) => s.ok), [true, true, null, true], 'the other steps keep their marks');
  assert.deepEqual(data.steps.map((s) => s.text), CHECK.steps.map((s) => s.text), 'the student\'s own steps as written');
  assert.equal(data.transcript, CHECK.transcript);
  assert.equal(data.summary, 'הפתרון נכון: $x = ?$.');
  assert.equal(masked, 1);
  // no step states a value: the last step; no steps: nothing to mark
  assert.equal(withholdCheck({ ...CHECK, steps: [{ text: 'מתחילים', ok: true, comment: 'טוב' }] }, null).data.steps[0].ok, null);
  assert.deepEqual(withholdCheck({ readable: false, steps: [], final: 'unknown', summary: '' }, null).data.steps, []);
});

test('guardResult: explain and chat get MASK_NOTE once; a care reply and an unguarded request are never touched', () => {
  const g = { on: true, forms: formsOf('2', 'num', 'signed') };
  const r = guardResult('chat', { text: '$-4 + 6 = 2$ ו־$1 + 1 = 2$', care: false }, g);
  assert.equal(r.result.text, `$-4 + 6 = ?$ ו־$1 + 1 = ?$\n\n${MASK_NOTE}`);
  assert.equal(r.masked, 2);
  assert.deepEqual(guardResult('chat', { text: 'אין כאן תשובה.' }, g), { result: { text: 'אין כאן תשובה.' }, masked: 0 });
  const care = { text: '$-4 + 6 = 2$', care: true };
  assert.equal(guardResult('explain', care, g).result, care);
  assert.equal(guardResult('explain', { text: '$-4 + 6 = 2$' }, { on: false, forms: g.forms }).result.text, '$-4 + 6 = 2$');
  assert.equal(MASK_NOTE, 'את הצעד האחרון משאירים לכם: כתבו את התשובה בתיבה, והאפליקציה תבדוק.');
});

test('the guard is on only for chat, explain and check, under WITHHOLD, with an answer', () => {
  const ctx = ctxOf('2');
  for (const kind of ['chat', 'explain', 'check']) assert.equal(guardOn(kind, ctx), true, kind);
  for (const kind of ['generate', 'exam']) assert.equal(guardOn(kind, ctx), false, kind);
  assert.equal(guardOn('chat', ctxOf('2', 'num', 'signed', 'reveal')), false);
  assert.equal(guardOn('chat', ctxOf('2', 'num', 'signed', 'homework')), false);
  assert.equal(guardOn('chat', { policy: { answer: 'withhold' }, item: { text: 'x' } }), false);
  assert.equal(guardFor('chat', ctxOf('A ב־2', 'manip')).forms, null, 'on, with nothing to find');
  // from a request: a version-2 context, or an older app's flat fields read the same conservative way
  const v2 = { v: 2, surface: 'lesson', topicId: 'signed', item: { text: '3 - (-5)', form: 'num', answer: '8' }, policy: { answer: 'withhold', why: '' } };
  assert.equal(answerGuard('chat', { ctx: v2, messages: [] }).on, true);
  assert.equal(answerGuard('chat', { ctx: { ...v2, policy: { answer: 'reveal' } } }).on, false);
  assert.equal(answerGuard('explain', { question: '3 - 8', correct: '-5', studentAnswer: '5' }).on, true, 'one answer: withhold');
  assert.equal(answerGuard('explain', { question: '3 - 8', correct: '-5', studentAnswer: '5 ; 4' }).on, false, 'two answers: reveal');
  assert.equal(answerGuard('chat', { messages: [], context: { question: '3x + 5 = 11' } }).on, false, 'no answer: homework');
  assert.equal(answerGuard('generate', {}).on, false);
});

test('guard.js ships to the browser: no lookbehind anywhere in it', () => {
  const src = readFileSync(new URL('../../shared/guard.js', import.meta.url), 'utf8');
  assert.equal(src.includes('(?<'), false);
});
