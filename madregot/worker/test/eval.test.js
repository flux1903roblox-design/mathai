// The tutor evaluation, part 1 (ai spec AI-7 Tests 1-3, 6 and 8): the cases are well-formed requests, the hand-written
// references pass every code grader untouched by the guard, a leaky reply is caught, a grader that throws is an error
// and not a fail, and the equation check reads the tutor's maths right. No model and no network: synthetic text only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRequest } from '../../shared/ai.js';
import { normalizeContext } from '../../shared/tutorContext.js';
import { answerForms, findLeaks, MASK_NOTE } from '../../shared/guard.js';
import { checkEquations } from '../../shared/verify.js';
import { GRADERS, gradeRow, guardReply, SHAPE_WORDS } from '../eval/graders.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../eval/${name}`, import.meta.url), 'utf8'));
const SPECS = read('case-specs.json').cases;
const CASES = read('cases.json').cases;
const REFS = read('references.json').references;
const byId = new Map(CASES.map((c) => [c.id, c]));
const inputOf = (c) => (c.kind === 'chat' ? { ctx: c.ctx, messages: c.messages } : { ctx: c.ctx });

/** The null baseline (Design 7, --stub leaky): the final answer stated, and another mistake of the stair named. */
const leakyReply = (c) => `התשובה היא ${c.expect.answer}. מה שקרה כאן: ${c.expect.others[0]?.label ?? 'טעות בחישוב'}.`;

// ---------------------------------------------------------------- 1. every case is a request the app can send
test('1. every case: a valid context, a request in each of its shapes, WITHHOLD and the label line where they belong', () => {
  assert.deepEqual(CASES.map((c) => c.id), SPECS.map((s) => s.id), 'cases.json follows case-specs.json (regenerate with WRITE_EVAL_CASES=1)');
  assert.ok(CASES.length >= 74, String(CASES.length));
  for (const c of CASES) {
    assert.ok(normalizeContext(c.ctx), c.id);
    for (const shape of c.shapes) {
      const p = buildRequest(c.kind, inputOf(c), { shape });
      const ctxText = p.system[2].text;
      assert.equal(p.system.length, 3, `${c.id}/${shape}`);
      if (c.expect.withhold) assert.match(ctxText, /Final-answer policy: WITHHOLD/, `${c.id}/${shape}`);
      if (c.expect.policy === 'homework') assert.match(ctxText, /Final-answer policy: HOMEWORK/, c.id);
      if (c.cat === 'D1') assert.ok(ctxText.includes(`App diagnosis of answer (1): one mistake, ${c.expect.diagnosis}, "${c.expect.label}".`), `${c.id}/${shape}: the label line`);
      if (c.kind === 'chat') assert.deepEqual(p.messages, c.messages, `${c.id}: only the student's own words in the turns`);
    }
  }
  // withhold cases are where the guard matters: the answer the guard looks for exists in a written form
  for (const c of CASES.filter((x) => x.expect.withhold)) assert.ok(answerForms(c.ctx)?.forms.length, `${c.id}: the guard has forms to find`);
});

// ---------------------------------------------------------------- 2. the oracle: the hand-written references
test('2. oracle: each of the 24 references passes every code grader in every shape of its case, and the guard leaves it untouched', () => {
  assert.equal(REFS.length, 24);
  assert.equal(new Set(REFS.map((r) => r.case)).size, 24, 'one reference per case');
  const withhold = REFS.filter((r) => byId.get(r.case)?.expect.withhold);
  assert.ok(withhold.length >= 12, `most references are written to withhold the answer (${withhold.length})`);
  for (const r of REFS) {
    const c = byId.get(r.case);
    assert.ok(c, `${r.case}: a case in cases.json`);
    for (const k of ['sameDiagnosis', 'namesOtherMistake', 'teachesStairWay', 'givesFinalAnswer', 'mathCorrect', 'refusesToHelp', 'calm', 'rewritesForStudent', 'why']) assert.ok(k in r.judge, `${r.case}: judge.${k}`);
    if (c.expect.withhold) assert.equal(r.judge.givesFinalAnswer, 'no', `${r.case}: a withhold reference gives no final answer`);
    for (const shape of c.shapes) {
      const g = gradeRow(c, { shape, reply: r.reply, judge: r.judge });
      assert.deepEqual(g.errors, [], `${r.case}/${shape}`);
      for (const [name, v] of Object.entries(g.grades)) assert.notEqual(v.pass, false, `${r.case}/${shape}: ${name} ${v.detail}`);
      assert.equal(g.guarded, r.reply, `${r.case}/${shape}: the guard changed nothing`);
      assert.equal(g.masked, 0);
    }
    // the graders that matter did run where they apply
    const full = gradeRow(c, { reply: r.reply, judge: r.judge }).grades;
    for (const name of ['hebrew', 'latex', 'words', 'pluralOnly']) assert.equal(full[name].pass, true, `${r.case}: ${name}`);
    assert.equal(full.bannedRule.pass, c.ctx.topicId ? true : null, `${r.case}: bannedRule (the assistant has no topic)`);
    if (c.expect.withhold) for (const name of ['leakRaw', 'leakAfterGuard', 'overMask']) assert.equal(full[name].pass, true, `${r.case}: ${name}`);
    if (c.expect.candidate) assert.equal(full.noCandidateVerdict.pass, true, r.case);
  }
});

// ---------------------------------------------------------------- 3. the null baseline: a leaky reply is caught
test('3. null baseline: a leaky reply fails leakRaw on every withhold case, and after the guard nothing leaks', () => {
  const withhold = CASES.filter((c) => c.expect.withhold);
  assert.ok(withhold.length >= 31, `W1 8, W2 8, W3 4, P1 5, A2 4, X1 2 at least (${withhold.length})`);
  for (const c of withhold) {
    const reply = leakyReply(c);
    const g = gradeRow(c, { reply });
    assert.equal(g.grades.leakRaw.pass, false, `${c.id}: ${reply}`);
    assert.equal(g.grades.leakAfterGuard.pass, true, `${c.id}: ${g.guarded}`);
    assert.ok(g.masked >= 1 && g.guarded.endsWith(MASK_NOTE), c.id);
  }
  // the same reply under REVEAL is not a leak: the answer is on the screen
  for (const c of CASES.filter((x) => x.expect.policy === 'reveal')) assert.equal(gradeRow(c, { reply: leakyReply(c) }).grades.leakRaw.pass, null, c.id);
  // a D1 case's leaky reply names another mistake of the stair by its label, never the app's own (what the judge reads
  // as namesOtherMistake; the judge stub comes with judge.js)
  for (const c of CASES.filter((x) => x.cat === 'D1')) {
    assert.ok(c.expect.others.length > 0, `${c.id}: the stair knows other mistakes`);
    const reply = leakyReply(c);
    assert.ok(reply.includes(c.expect.others[0].label) && !reply.includes(c.expect.label), c.id);
    assert.ok(!c.expect.others.some((o) => o.id === c.expect.diagnosis), c.id);
  }
});

test('3b. each grader catches what it is for (known-bad replies), and leaves the good alone', () => {
  const c = byId.get('W2-eq2-confirm-right'); // eq:2, 3x + 7 = 22, the student asks "רק תגיד אם זה 5"
  const g = (reply, shape = 'full', judge = null) => gradeRow(c, { shape, reply, judge }).grades;
  assert.equal(g('This is the answer: subtract seven and divide by three.').hebrew.pass, false);
  assert.equal(g('מחסירים $7 משני האגפים.').latex.pass, false, 'an odd $');
  assert.equal(g('מחלקים: \\frac{15}{3} נותן את התשובה.').latex.pass, false, 'TeX outside maths');
  assert.equal(g(Array(121).fill('מילה').join(' ')).words.pass, false);
  assert.equal(g(Array(100).fill('מילה').join(' '), 'lite').words.pass, false, `lite allows ${SHAPE_WORDS.lite}`);
  assert.equal(g(Array(100).fill('מילה').join(' ')).words.pass, true);
  assert.equal(g('תנסה להחסיר $7$ משני האגפים.').pluralOnly.pass, false);
  assert.equal(g('נסו להחסיר $7$ משני האגפים, והאפליקציה תבדוק.').pluralOnly.pass, true);
  assert.equal(g('כן, 5 נכון! כל הכבוד.').noCandidateVerdict.pass, false);
  assert.equal(g('לא, 5 זו טעות.').noCandidateVerdict.pass, false);
  assert.equal(g('את 5 כתבו בתיבה. מחסירים $7$ ומקבלים $3x = 15$, וזה נכון לכל פתרון של המשוואה.').noCandidateVerdict.pass, true, 'a verdict word far from the candidate');
  assert.equal(g('מעבירים אגף ומחליפים סימן, וזהו.').bannedRule.pass, false, 'the shortcut as a rule');
  assert.equal(g('"מעבירים אגף ומחליפים סימן" הוא קיצור של מחסירים $7$ משני האגפים.').bannedRule.pass, true, 'named as a shortcut');
  assert.equal(g('מחסירים $7$. כמה נשאר?', 'lite').noClosingQuestion.pass, false);
  assert.equal(g('מחסירים $7$. כמה נשאר?').noClosingQuestion.pass, null, 'only the free taste');
  assert.equal(g('עכשיו נסו לחלק ב־$3$.', 'lite').noClosingQuestion.pass, true);
  assert.equal(g('מחלקים: $15 : 3 = 6$.').mathEquations.pass, false);
  // the leak graders and overMask
  const leak = g('מחלקים ב־$3$ ויוצא $x = 5$.', 'full', { givesFinalAnswer: 'yes' });
  assert.equal(leak.leakRaw.pass, false); assert.equal(leak.leakAfterGuard.pass, true); assert.equal(leak.overMask.pass, true);
  assert.equal(g('מחלקים ב־$3$ ויוצא $x = 5$.', 'full', { givesFinalAnswer: 'no' }).overMask.pass, false, 'masked though the judge saw no answer');
  assert.equal(g('מחלקים ב־$3$.').overMask.pass, null, 'no verdict');
  // a homework row has no answer to leak
  assert.equal(gradeRow(byId.get('H1-eq-solve'), { reply: 'נפתור יחד.' }).grades.leakRaw.pass, null);
});

test('the guard in the graders is the Worker\'s: a streamed chat in pieces, an explain at once, each with MASK_NOTE once', () => {
  const chat = byId.get('W1-signed4-what'); // 10 - 3 · (-1) = 13
  const r = guardReply(chat, 'קודם הכפל: $3 \\cdot (-1) = -3$. ואז $10 - (-3) = 13$. וגם התשובה היא 13.');
  assert.equal(r.masked, 2);
  assert.ok(!findLeaks(r.text, answerForms(chat.ctx)).length);
  assert.equal(r.text.split(MASK_NOTE).length, 2, 'the note once');
  const reveal = byId.get('D1-signed1-dropsign');
  assert.deepEqual(guardReply(reveal, 'לכן $-4 + 3 = -1$.'), { text: 'לכן $-4 + 3 = -1$.', masked: 0 }, 'REVEAL: off');
});

// ---------------------------------------------------------------- 6. a grader that throws is an error, not a fail
test('6. a grader that throws lands in errors with class grader, never in the grades', () => {
  const c = byId.get('W1-pyth2-start');
  const graders = { hebrew: GRADERS.hebrew, boom: () => { throw new Error('boom'); }, empty: () => undefined };
  const g = gradeRow(c, { shape: 'lite', reply: 'מתחילים מהריבועים.' }, { graders });
  assert.deepEqual(Object.keys(g.grades), ['hebrew']);
  assert.deepEqual(g.errors.map((e) => [e.class, e.case, e.shape, e.grader]), [['grader', c.id, 'lite', 'boom'], ['grader', c.id, 'lite', 'empty']]);
  assert.match(g.errors[0].message, /boom/);
});

// ---------------------------------------------------------------- 8. the equation check
test('8. mathEquations: a false equation fails, a true one passes, a blank to fill is skipped (not failed)', () => {
  const c = byId.get('D1-signed1-dropsign');
  const m = (reply) => gradeRow(c, { reply }).grades.mathEquations;
  assert.equal(m('$3 + 5 = 9$').pass, false);
  assert.equal(m('$-4 + 6 = 2$').pass, true);
  assert.equal(m('$x + 5 = ?$').pass, null);
  assert.equal(m('אין כאן משוואה.').pass, null);
});

test('checkEquations reads the tutor\'s TeX: fractions, roots, powers, chains, "≈", degrees, units; it skips what it cannot read', () => {
  const ok = (t) => { const r = checkEquations(t); return r.checked > 0 && r.ok; };
  const bad = (t) => checkEquations(t).wrong.length > 0;
  const skipped = (t) => { const r = checkEquations(t); return r.checked === 0 && r.ok; };
  for (const t of ['$3 - (-5) = 3 + 5 = 8$', '$\\frac{-6}{1} = -6$', '$\\dfrac{3}{4} = 0.75$', '$d = \\sqrt{4^2 + 3^2} = \\sqrt{25} = 5$', '$(-3) \\cdot (-4) = 12$',
    '$3 \\times 4 = 12$', '$54 : 6 = 9$', '$12 \\div 4 = 3$', '$-3^2 = -9$', '$(-3)^2 = 9$', '$2^{10} = 1024$', '$|-7| = 7$', '$2(3 + 1) = 8$',
    '$180^\\circ - 105^\\circ = 75^\\circ$', '$180° - 140° = 40°$', '$\\sqrt{50} \\approx 7.1$', '$\\sqrt{41} = 6.4$', '$1/3 = 0.33$', '$3 + 4 = 7 \\text{ ס״מ}$',
    '$\\left(-2\\right) \\cdot 3 = -6$', '$$12 : 4 = 3$$', '$5 \\cdot 7 = 35 \\quad 2 + 2 = 4$', '$−4 + 6 = 2$']) assert.ok(ok(t), t);
  for (const t of ['$3 + 5 = 9$', '$\\sqrt{50} \\approx 7.5$', '$\\sqrt{41} = 6$', '$5 \\cdot 7 = 35 \\quad 2 + 2 = 5$', '$1/3 = 0.4$', '$2^{3} = 9$']) assert.ok(bad(t), t);
  for (const t of ['$x + 5 = 12$', '$x = 7$', '$y = 2x - 1$', '$(2, -1) = (2,-1)$', '$2\\frac{1}{2} = 2.5$', '$\\sqrt[3]{8} = 2$', '$\\pi = 3$', '$50\\% = 0.5$',
    '$1{,}500 = 1500$', '$5 \\text{ ס״מ} + 2 = 7$', '$3 : 0 = 0$', '$\\begin{cases} x = 1 \\\\ y = 2 \\end{cases}$', '$-4 + 6 = ?$']) assert.ok(skipped(t), t);
  // a chain is checked pair by pair; a side with a letter breaks only its own pairs
  assert.deepEqual(checkEquations('$m = \\frac{8}{-2} = -4$'), { ok: true, checked: 1, skipped: 1, declaredFalse: 0, wrong: [] });
  // an equation the text itself calls false ("no solution") is not a wrong equation
  const none = checkEquations('מחסירים $x$ משני האגפים: $8 = 10$. זה לא נכון לאף $x$, ולכן אין פתרון.');
  assert.equal(none.ok, true); assert.equal(none.declaredFalse, 1);
  // other relations end a chain and are not checked
  assert.equal(checkEquations('$2 < 3$, $-2 > -3$, $3 \\neq 4$').checked, 0);
});

test('verify.js computes, it never evaluates code: no eval, no Function, no lookbehind', () => {
  const src = readFileSync(new URL('../../shared/verify.js', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');
  assert.doesNotMatch(code, /\beval\s*\(|new Function|Function\s*\(/);
  assert.equal(src.includes('(?<'), false);
  // something that would run as code is just not a number
  assert.equal(checkEquations('$process.exit(1) = 1$').checked, 0);
  assert.equal(checkEquations('$alert(1) = 1$').checked, 0);
});
