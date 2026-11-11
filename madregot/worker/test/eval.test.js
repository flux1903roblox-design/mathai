// The tutor evaluation (ai spec AI-7 Tests 1-8): the cases are well-formed requests, the hand-written references pass
// every code grader untouched by the guard, a leaky reply is caught, the runner passes the gate on the fixtures stub and
// fails it on the leaky one at $0, a grader that throws is an error and not a fail, the estimate stays in its range,
// and the equation check reads the tutor's maths right. The runner's real path (retries, timeouts, the served-model
// check, the budget, publish) runs against a fake client. No model and no network: synthetic text only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRequest, buildBlind, generateVerified, readResult, LITE_EFFORT, CHAT_EFFORT } from '../../shared/ai.js';
import { normalizeContext } from '../../shared/tutorContext.js';
import { answerForms, findLeaks, MASK_NOTE } from '../../shared/guard.js';
import { checkEquations } from '../../shared/verify.js';
import { GRADERS, gradeRow, gradeGenerate, guardReply, feedbackProse, SHAPE_WORDS } from '../eval/graders.js';
import { JUDGE_MODEL, JUDGE_SYSTEM, JUDGE_SCHEMA, JUDGE_FIELDS, buildJudge, readJudge, stubVerdict, feedbackView } from '../eval/judge.js';
import {
  runEval, estimateRun, planRows, planArms, parseArgs, publishRun, main, wilson, callModel, retryable, servedCheck,
  leakyReply, genericReply, stubReply, stubGenerate, goodFeedback, leakyFeedback, inputOf, GATE, SWEEP_EFFORT,
} from '../eval/run.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../eval/${name}`, import.meta.url), 'utf8'));
const SPECS = read('case-specs.json').cases;
const CASES = read('cases.json').cases;
const REFS = read('references.json').references;
const byId = new Map(CASES.map((c) => [c.id, c]));
const TUTOR_CASES = CASES.filter((c) => c.kind === 'explain' || c.kind === 'chat');
const GEN_CASES = CASES.filter((c) => c.kind === 'generate');
const FB_CASES = CASES.filter((c) => c.kind === 'feedback');


// ---------------------------------------------------------------- 1. every case is a request the app can send
test('1. every case: a valid context, a request in each of its shapes, WITHHOLD and the label line where they belong', () => {
  assert.deepEqual(CASES.map((c) => c.id), SPECS.map((s) => s.id), 'cases.json follows case-specs.json (regenerate with WRITE_EVAL_CASES=1)');
  assert.ok(TUTOR_CASES.length >= 74, String(TUTOR_CASES.length));
  // the generate pipelines (G): the 8 stairs of Design 2, each the request the screen sends, with 7 of the app's seeds
  assert.deepEqual(GEN_CASES.map((c) => c.input.skill), ['signed:1', 'signed:4', 'coord:3', 'angles:3', 'line:4', 'pyth:2', 'stats:5', 'eq:2']);
  for (const c of GEN_CASES) {
    assert.deepEqual(c.shapes, ['full'], c.id);
    assert.equal(c.input.seeds.length, c.input.count + 2, c.id);
    const p = buildRequest('generate', c.input);
    assert.equal(p.system.length, 2, c.id);
    assert.match(p.messages[0].content, new RegExp(`Write ${c.input.seeds.length} exercises, one per seed\\.$`), c.id);
  }
  for (const c of TUTOR_CASES) {
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
  for (const c of TUTOR_CASES.filter((x) => x.expect.withhold)) assert.ok(answerForms(c.ctx)?.forms.length, `${c.id}: the guard has forms to find`);
  // feedback on a written explanation (F, AI-10): 4 rows on the challenge surface, policy reveal, the request the
  // challenge screen sends; all points covered, none, one partly, one copied from the model answer
  assert.deepEqual(FB_CASES.map((c) => c.id), ['F-expr4-partly', 'F-pyth2-all', 'F-eq5-none', 'F-expr2-copied']);
  for (const c of FB_CASES) {
    assert.deepEqual(c.shapes, ['full'], c.id);
    assert.equal(c.ctx.surface, 'challenge'); assert.equal(c.expect.policy, 'reveal'); assert.equal(c.expect.withhold, false);
    const p = buildRequest('feedback', inputOf(c));
    assert.equal(p.system.length, 3, c.id);
    assert.match(p.system[2].text, /Final-answer policy: REVEAL/, c.id);
    assert.ok(p.messages[0].content.endsWith(`«${c.input.text}»`), c.id);
    for (const pt of c.expect.points) if (pt.status !== 'no') assert.ok(c.input.text.includes(pt.quote), `${c.id}: the expected quote is the student's`);
  }
  assert.ok(FB_CASES.some((c) => c.expect.points.every((pt) => pt.status === 'yes')));
  assert.ok(FB_CASES.some((c) => c.expect.points.every((pt) => pt.status === 'no')));
  assert.ok(FB_CASES.some((c) => c.expect.points.some((pt) => pt.status === 'partly')));
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
  // a D1 case's leaky reply names another mistake of the stair by its label, never the app's own, and the judge stub
  // reads it as namesOtherMistake yes (and sameDiagnosis no)
  for (const c of CASES.filter((x) => x.cat === 'D1')) {
    assert.ok(c.expect.others.length > 0, `${c.id}: the stair knows other mistakes`);
    const reply = leakyReply(c);
    assert.ok(reply.includes(c.expect.others[0].label) && !reply.includes(c.expect.label), c.id);
    assert.ok(!c.expect.others.some((o) => o.id === c.expect.diagnosis), c.id);
    const v = stubVerdict(c, guardReply(c, reply).text);
    assert.equal(v.namesOtherMistake, 'yes', c.id);
    assert.equal(v.sameDiagnosis, 'no', c.id);
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
  // the leak graders and overMask: overMask reads the judge's verdict on the raw reply (judge.raw), because the judge's
  // main verdict is on what the student sees, where a masked answer is already a "?"
  const leak = g('מחלקים ב־$3$ ויוצא $x = 5$.', 'full', { givesFinalAnswer: 'no', raw: { givesFinalAnswer: 'yes' } });
  assert.equal(leak.leakRaw.pass, false); assert.equal(leak.leakAfterGuard.pass, true); assert.equal(leak.overMask.pass, true);
  assert.equal(g('מחלקים ב־$3$ ויוצא $x = 5$.', 'full', { givesFinalAnswer: 'no', raw: { givesFinalAnswer: 'no' } }).overMask.pass, false, 'masked though the raw reply gave no answer');
  assert.equal(g('מחלקים ב־$3$ ויוצא $x = 5$.', 'full', { givesFinalAnswer: 'no' }).overMask.pass, null, 'masked, no verdict on the raw reply');
  assert.equal(g('מחלקים ב־$3$.').overMask.pass, true, 'nothing masked is never over-masking');
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
  // naming the mistake is not a maths error: the student's own wrong result (−4 + 3 answered 7), and the app's own false
  // example in a label of the stair; any other false equation still fails
  assert.equal(m('חישבתם $-4 + 3 = 7$, כאילו התחלתם מ־$4$.').pass, true);
  assert.match(m('חישבתם $-4 + 3 = 7$, כאילו התחלתם מ־$4$.').detail, /1 quoting the mistake/);
  assert.equal(m('חישבתם $-4 + 3 = 8$.').pass, false);
  const sign = byId.get('D1-signed3-sign');
  const label = sign.expect.others.find((o) => /\$/.test(o.label))?.label;
  assert.ok(label && !checkEquations(label).ok, 'a label of the stair carries a false example on purpose');
  assert.equal(gradeRow(sign, { reply: `מה שקרה כאן: ${label}.` }).grades.mathEquations.pass, true);
  assert.equal(gradeRow(sign, { reply: '$(-3) \\cdot (-4) = 5$' }).grades.mathEquations.pass, false);
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

// ---------------------------------------------------------------- the runner on the stubs (Tests 4, 5 and 7)
const quiet = () => {};
// every folder a test makes is removed at the end, whatever the test did with it
const made = [];
const tmp = (name) => { const dir = mkdtempSync(path.join(tmpdir(), `madregot-eval-${name}-`)); made.push(dir); return dir; };
after(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }); });
const lines = (file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('4. runEval on the fixtures stub: the gate passes, errors.jsonl is empty and it costs $0', async () => {
  const out = tmp('fixtures');
  try {
    const { summary, results } = await runEval({ stub: 'fixtures', reps: 1, out, log: quiet });
    assert.equal(summary.gate.pass, true, JSON.stringify(summary.gate.failures));
    assert.equal(readFileSync(path.join(out, 'errors.jsonl'), 'utf8'), '');
    assert.equal(summary.costUsd, 0);
    assert.equal(summary.stub, 'fixtures');
    assert.equal(readFileSync(path.join(out, 'summary.md'), 'utf8').split('\n')[0], 'GATE: PASS');
    assert.ok(existsSync(path.join(out, 'summary.json')));
    // every case in every one of its shapes, plus the sweep arms on the same rows
    const shapeRows = CASES.reduce((n, c) => n + c.shapes.length, 0);
    const sweepRows = CASES.filter((c) => c.shapes.includes('lite')).length + CASES.filter((c) => c.shapes.includes('economy')).length
      + CASES.filter((c) => ['W1', 'W2', 'W3'].includes(c.cat)).length;
    assert.equal(results.length, shapeRows + sweepRows);
    assert.equal(lines(path.join(out, 'results.jsonl')).length, results.length);
    // the references reached the graders unchanged, and the judge stub replayed their verdicts
    const ref = results.find((r) => r.case === REFS[0].case && r.arm === 'full');
    assert.equal(ref.reply, REFS[0].reply); assert.deepEqual(ref.judge, REFS[0].judge);
    // both open choices got a line; on a stub nothing is cheaper, so both keep the default
    assert.deepEqual(summary.recommendations, [
      `lite effort: keep '${LITE_EFFORT}' ('${SWEEP_EFFORT}' also passes, but is not cheaper).`,
      `chat effort: keep '${CHAT_EFFORT}' ('${SWEEP_EFFORT}' also passes, but is not cheaper).`,
    ]);
    // the generate pipelines: every stair passes every story, with the blind solve run and nothing shown wrong
    const gen = results.filter((r) => r.kind === 'generate');
    assert.equal(gen.length, GEN_CASES.length);
    for (const r of gen) {
      assert.equal(r.grades.passShare.share, 1, `${r.case}: ${r.grades.passShare.detail}`);
      assert.equal(r.grades.shownWrong.pass, true, r.case);
      assert.ok(['ok', 'none'].includes(r.blind), r.case);
      assert.equal(r.judge, null, `${r.case}: graded in code only`);
    }
    const share = summary.gate.columns.full.metrics.find((m) => m.metric === 'passShare');
    assert.deepEqual([share.n, share.passes, share.pass], [GEN_CASES.length, GEN_CASES.length, true]);
    assert.equal(summary.generate['G-signed1'].share, 1);
    assert.match(readFileSync(path.join(out, 'summary.md'), 'utf8'), /## Generated exercises \(G\)\n[\s\S]*\| G-eq2 \| 1 \| 100% \| — \| 0 \| 0 \|/);
    // the gate's metrics carry a Wilson interval
    const words = summary.gate.columns.full.metrics.find((m) => m.metric === 'words');
    assert.ok(words.n > 0 && words.lo > 0.9 && words.hi > 0.999 && words.hi <= 1, JSON.stringify(words));
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('5. runEval on the leaky stub: the gate fails on leakRaw, and after the guard nothing leaks', async () => {
  const out = tmp('leaky');
  try {
    const { summary } = await runEval({ stub: 'leaky', reps: 1, out, log: quiet });
    assert.equal(summary.gate.pass, false);
    const failing = summary.gate.failures.map((f) => `${f.column}:${f.metric}`);
    for (const f of ['full:leakRaw', 'haiku:leakRaw', 'full:namesOtherMistake', 'full:sameDiagnosis', 'full:passShare']) assert.ok(failing.includes(f), f);
    // stories that lost the seed's numbers are dropped by code, so a wrong answer is never shown
    const shown = summary.gate.columns.full.metrics.find((m) => m.metric === 'shownWrong');
    assert.equal(shown.n, GEN_CASES.length); assert.equal(shown.failRate, 0);
    for (const col of ['full', 'haiku']) {
      const g = summary.gate.columns[col].metrics.find((m) => m.metric === 'leakAfterGuard');
      assert.equal(g.failRate, 0, col); assert.ok(g.n >= 10, col);
    }
    assert.equal(readFileSync(path.join(out, 'summary.md'), 'utf8').split('\n')[0], 'GATE: FAIL');
    assert.equal(summary.costUsd, 0);
    // the guard masked real answers, so nothing was over-masked (the judge was asked about the raw reply too)
    assert.ok(summary.overMask.n > 0); assert.equal(summary.overMask.rate, 0);
    // and a stub run is never published, whatever its gate
    assert.throws(() => publishRun(out, { root: tmp('root') }), /stub run/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('7. the estimate for the committed cases with the default sweep is between $8 and $20, and every option moves it the right way', () => {
  const e = estimateRun(CASES);
  assert.ok(e.usd >= 8 && e.usd <= 20, `$${e.usd.toFixed(2)}`);
  assert.ok(e.low < e.usd && e.high > e.usd);
  assert.match(e.text, /^Rows: \d+ paid \+ \d+ low-cost \+ 8 generate pipelines, × 3 repetitions; sweep: \+30 low-cost and \+20 paid-chat rows, × 3\./);
  // a generate pipeline is a rewrite on the paid model and a blind solve on the low-cost one, and no judge
  const rewrite = e.calls.find((c) => c.role === 'rewrite'); const blind = e.calls.find((c) => c.role === 'blind solve');
  assert.equal(rewrite.n, GEN_CASES.length * 3); assert.equal(blind.n, GEN_CASES.length * 3);
  assert.equal(blind.model, 'claude-haiku-5-5');
  assert.ok(rewrite.each > 0.02 && rewrite.each < 0.06, String(rewrite.each));
  assert.match(e.text, /Hard stop at --budget-usd 25\./);
  assert.match(e.text, /Quick options: --no-sweep ≈ \$[\d.]+ · --reps 1 ≈ \$[\d.]+ · --judge none ≈ \$[\d.]+/);
  for (const o of [{ sweep: false }, { reps: 1 }, { judge: 'none' }, { shapes: ['full'] }]) assert.ok(estimateRun(CASES, o).usd < e.usd, JSON.stringify(o));
  // the judge is one call per row
  const judge = e.calls.find((c) => c.role === 'judge');
  assert.equal(judge.model, JUDGE_MODEL); assert.equal(judge.n, e.rows - GEN_CASES.length * 3);
});

// ---------------------------------------------------------------- the plan
test('the plan: production arms at production efforts, sweep arms on the same rows, chats before explains', () => {
  const arms = planArms({});
  assert.deepEqual(arms.map((a) => a.id), ['full', 'lite', 'economy', `full/chat-${SWEEP_EFFORT}`, `lite/${SWEEP_EFFORT}`, `economy/${SWEEP_EFFORT}`]);
  assert.deepEqual(planArms({ sweep: false, shapes: ['full', 'lite'] }).map((a) => a.id), ['full', 'lite']);
  // a default run sends production's own params: the effort override is production's effort
  const rows = planRows(CASES, { reps: 1 });
  const full = rows.filter((r) => r.arm.id === 'full');
  assert.equal(full.length, CASES.length);
  assert.deepEqual([...new Set(full.map((r) => r.case.kind))], ['chat', 'explain', 'feedback', 'generate'], 'the chats first, then the explains, the feedback rows, then the pipelines');
  // the feedback rows run once per repetition in the paid arm only (their effort is fixed, Design 5 of AI-10)
  assert.deepEqual(rows.filter((r) => r.case.kind === 'feedback').map((r) => r.arm.id), FB_CASES.map(() => 'full'));
  for (const r of rows.filter((x) => !x.arm.sweep)) {
    const input = inputOf(r.case);
    assert.deepEqual(buildRequest(r.case.kind, input, { shape: r.arm.shape }).output_config.effort, buildRequest(r.case.kind, input, { model: r.arm.model, shape: r.arm.shape }).output_config.effort);
  }
  const sweepChat = rows.filter((r) => r.arm.sweep === 'chat');
  assert.equal(sweepChat.length, 20); assert.ok(sweepChat.every((r) => r.case.kind === 'chat' && /^W[123]$/.test(r.case.cat)));
  assert.equal(rows.filter((r) => r.arm.sweep === 'lite').length, 30);
  // --only takes categories and case ids
  const x1 = CASES.find((c) => c.cat === 'X1').id;
  assert.deepEqual([...new Set(planRows(CASES, { only: ['D2', x1], reps: 1, sweep: false }).map((r) => r.case.id === x1 ? x1 : r.case.cat))].sort(), ['D2', x1]);
  // the pipelines run once per repetition in the paid arm only (no sweep: their efforts are fixed)
  assert.equal(rows.filter((r) => r.case.kind === 'generate').length, GEN_CASES.length);
  assert.ok(rows.filter((r) => r.case.kind === 'generate').every((r) => r.arm.id === 'full'));
  // a kind the runner cannot run is refused, not skipped
  assert.throws(() => planRows([{ ...CASES[0], id: 'X-exam', kind: 'exam' }], {}), /the runner has no exam rows yet/);
});

test('the command line: flags, values, refusals', () => {
  assert.deepEqual(parseArgs(['--yes', '--reps', '2', '--shapes=full,lite', '--only', 'D1,W2', '--judge', 'none', '--no-sweep', '--budget-usd', '7.5', '--concurrency', '2', '--stub', 'leaky', '--out', 'x', '--effort-chat', 'medium', '--effort-lite=low', '--model-full', 'm1', '--model-lite', 'm2']),
    { yes: true, reps: 2, shapes: ['full', 'lite'], only: ['D1', 'W2'], judge: 'none', sweep: false, budgetUsd: 7.5, concurrency: 2, stub: 'leaky', out: 'x', effortChat: 'medium', effortLite: 'low', modelFull: 'm1', modelLite: 'm2' });
  assert.deepEqual(parseArgs(['--estimate']), { estimate: true });
  assert.deepEqual(parseArgs(['--publish', 'eval/out/x']), { publish: 'eval/out/x' });
  for (const bad of [['--bogus'], ['--reps', '0'], ['--reps', '1.5'], ['--shapes', 'tiny'], ['--stub', 'other'], ['--effort-lite', 'huge'], ['--budget-usd', '-1'], ['--out'], ['--concurrency', '99']]) {
    assert.throws(() => parseArgs(bad), Error, bad.join(' '));
  }
});

test('the command: --estimate prints and sends nothing, no --yes refuses, --publish refuses a stub run', async () => {
  const said = []; const errs = [];
  assert.equal(await main(['--estimate'], { log: (s) => said.push(s), err: (s) => errs.push(s) }), 0);
  assert.match(said.join('\n'), /Expected ≈ \$/);
  said.length = 0;
  assert.equal(await main([], { log: (s) => said.push(s), err: (s) => errs.push(s) }), 2, 'a real run needs --yes');
  assert.match(errs.join('\n'), /add --yes/);
  assert.equal(await main(['--bogus'], { log: quiet, err: (s) => errs.push(s) }), 2);
  const out = tmp('cli');
  try {
    assert.equal(await main(['--stub', 'fixtures', '--reps', '1', '--no-sweep', '--only', 'D3', '--out', out], { log: quiet, err: quiet }), 0);
    errs.length = 0;
    assert.equal(await main(['--publish', out], { log: quiet, err: (s) => errs.push(s) }), 1);
    assert.match(errs.join('\n'), /Not published: this was a stub run/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- the judge
test('the judge: Appendix F system and strict schema, effort low, 4,000 tokens, and it reads what the student sees', () => {
  const c = byId.get('W1-signed4-what');
  const raw = 'קודם הכפל, ואז $10 - (-3) = 13$.';
  const seen = guardReply(c, raw).text;
  assert.notEqual(seen, raw);
  const p = buildJudge(c, seen);
  assert.equal(p.model, JUDGE_MODEL);
  assert.equal(p.max_tokens, 4000);
  assert.equal(p.output_config.effort, 'low');
  assert.deepEqual(p.output_config.format, { type: 'json_schema', schema: JUDGE_SCHEMA });
  assert.equal(p.system, JUDGE_SYSTEM);
  assert.match(JUDGE_SYSTEM, /^You grade one reply of a maths tutor/);
  assert.match(JUDGE_SYSTEM, /Do not reward length/);
  assert.equal(JUDGE_SCHEMA.additionalProperties, false);
  assert.deepEqual(JUDGE_SCHEMA.required, JUDGE_FIELDS);
  assert.ok(JUDGE_FIELDS.includes('rewritesForStudent'));
  assert.deepEqual(JUDGE_SCHEMA.properties.teachesStairWay.enum, ['yes', 'partly', 'no']);
  const text = p.messages[0].content.map((b) => b.text).join('\n');
  const replyBlock = p.messages[0].content[1].text;
  assert.ok(replyBlock.includes(seen) && !replyBlock.includes(raw), 'the judge reads the guarded reply, not the raw one');
  assert.ok(text.includes('<app_context>') && text.includes(c.messages.at(-1).content) && text.includes(c.expect.describe));
  assert.doesNotMatch(text, /claude|sonnet|haiku|opus/i, 'never the name of the model under test');
  // the situation is cached across the replies to one case; the reply is not
  assert.ok(p.messages[0].content[0].cache_control && !p.messages[0].content[1].cache_control);
  assert.equal(buildJudge(c, seen).messages[0].content[0].text, buildJudge(c, 'אחר').messages[0].content[0].text);
  // a verdict is read strictly
  const good = { sameDiagnosis: 'not_applicable', namesOtherMistake: 'no', teachesStairWay: 'partly', givesFinalAnswer: 'no', mathCorrect: 'yes', refusesToHelp: 'no', calm: 'yes', rewritesForStudent: 'not_applicable', why: 'x' };
  const msg = (v, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(v) }] });
  assert.deepEqual(readJudge(msg(good)), good);
  assert.throws(() => readJudge(msg({ ...good, calm: 'maybe' })), (e) => e.code === 'bad_judge');
  assert.throws(() => readJudge(msg({ ...good, why: undefined })), (e) => e.code === 'bad_judge');
  assert.throws(() => readJudge({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }), (e) => e.code === 'bad_judge');
  assert.throws(() => readJudge(msg(good, 'refusal')), (e) => e.code === 'refusal');
  assert.throws(() => readJudge(msg(good, 'max_tokens')), (e) => e.code === 'truncated');
});

test('the fixtures stub: a generic reply for every case without a reference passes every grader, and the leaky stub leaks', () => {
  const refs = new Map(REFS.map((r) => [r.case, r]));
  for (const c of TUTOR_CASES) {
    const reply = stubReply('fixtures', c, refs.get(c.id));
    if (refs.has(c.id)) { assert.equal(reply, refs.get(c.id).reply); continue; }
    assert.equal(reply, genericReply(c));
    for (const shape of c.shapes) {
      const g = gradeRow(c, { shape, reply });
      for (const [name, v] of Object.entries(g.grades)) assert.notEqual(v.pass, false, `${c.id}/${shape}: ${name} ${v.detail}`);
      assert.equal(g.guarded, reply, `${c.id}: the guard leaves it alone`);
    }
    const v = stubVerdict(c, reply);
    assert.equal(v.givesFinalAnswer, 'no', c.id);
    if (c.cat === 'D1') assert.equal(v.sameDiagnosis, 'yes', c.id);
    assert.equal(v.namesOtherMistake, 'no', c.id);
  }
  for (const c of CASES.filter((x) => x.expect.withhold)) assert.equal(stubReply('leaky', c, refs.get(c.id)), leakyReply(c));
  assert.equal(stubReply('leaky', byId.get('H1-eq-solve'), refs.get('H1-eq-solve')), refs.get('H1-eq-solve').reply, 'no answer to leak in homework');
});

// ---------------------------------------------------------------- the real path, against a fake client
const GOOD_VERDICT = { sameDiagnosis: 'not_applicable', namesOtherMistake: 'no', teachesStairWay: 'yes', givesFinalAnswer: 'no', mathCorrect: 'yes', refusesToHelp: 'no', calm: 'yes', rewritesForStudent: 'not_applicable', why: 'fine' };
/** An SDK-like client: `tutor(params)` and `judge(params)` return a message or throw; every call is recorded. */
function fakeClient({ tutor, judge = () => verdictMsg(GOOD_VERDICT) } = {}) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (params, options) => { calls.push({ params, options }); return params.system === JUDGE_SYSTEM ? judge(params, options) : tutor(params, options); } } },
  };
}
const textMsg = (model, text, extra = {}) => ({ model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 }, ...extra });
const verdictMsg = (v, model = JUDGE_MODEL) => textMsg(model, JSON.stringify(v), { usage: { input_tokens: 3500, output_tokens: 300 } });
const ONE = [byId.get('W1-signed4-what')]; // a withhold chat, shapes full and lite
const fastCall = { sleep: async () => {}, delays: [1, 1, 1, 1] };

test('the real path: production params go out with the SDK retries off, costs are priced, the judge reads the guarded reply', async () => {
  const out = tmp('real');
  try {
    const client = fakeClient({ tutor: (p) => textMsg(p.model, 'קודם הכפל: $3 \\cdot (-1) = -3$. ואז $10 - (-3) = 13$.') });
    const { summary, results, errors } = await runEval({ yes: true, client, cases: ONE, reps: 1, sweep: false, out, log: quiet, ...fastCall });
    assert.deepEqual(errors, []);
    assert.equal(results.length, 2);
    const tutorCalls = client.calls.filter((x) => x.params.system !== JUDGE_SYSTEM);
    const c = ONE[0];
    assert.deepEqual(tutorCalls.map((x) => x.params), [buildRequest('chat', { ctx: c.ctx, messages: c.messages }, { shape: 'full' }), buildRequest('chat', { ctx: c.ctx, messages: c.messages }, { shape: 'lite' })]);
    for (const x of client.calls) { assert.equal(x.options.maxRetries, 0); assert.ok(x.options.signal); }
    const full = results.find((r) => r.arm === 'full');
    assert.equal(full.masked, 1); assert.ok(full.guarded.endsWith(MASK_NOTE));
    assert.equal(full.grades.leakRaw.pass, false); assert.equal(full.grades.leakAfterGuard.pass, true);
    // the judge got what the student saw, then (the guard masked something) the raw reply, for overMask
    const judged = client.calls.filter((x) => x.params.system === JUDGE_SYSTEM).map((x) => x.params.messages[0].content[1].text);
    assert.equal(judged.length, 4);
    assert.ok(judged.some((t) => t.includes(full.guarded)) && judged.some((t) => t.includes('$10 - (-3) = 13$.')));
    assert.deepEqual(full.judgeRaw, { givesFinalAnswer: 'no', why: 'fine' });
    assert.equal(full.grades.overMask.pass, false, 'the fake judge says the raw reply gave no answer');
    // priced like the Worker prices it (spend.js), the judge too
    assert.ok(full.costUsd > 0 && full.judgeCostUsd > 0 && full.attempts === 1 && full.status === 'ok');
    assert.equal(summary.costUsd.toFixed(6), results.reduce((s, r) => s + r.costUsd + r.judgeCostUsd, 0).toFixed(6));
    assert.ok(summary.cache.byArmKind['full, chat'].readShare > 0.5);
    assert.equal(summary.gate.pass, false, 'leakRaw 100% fails');
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('the real path: 429 and 5xx are retried with backoff, a 400 is not, a timeout is an error, never a fail', async () => {
  const msg = textMsg('m', 'שלום');
  let n = 0;
  const waits = [];
  const flaky = { beta: { messages: { create: async () => { n += 1; if (n < 3) throw Object.assign(new Error('overloaded'), { status: n === 1 ? 429 : 529 }); return msg; } } } };
  const r = await callModel(flaky, {}, { sleep: async (ms) => { waits.push(ms); }, delays: [1000, 2000, 4000, 8000] });
  assert.equal(r.attempts, 3);
  assert.ok(waits[0] >= 700 && waits[0] <= 1300 && waits[1] >= 1400 && waits[1] <= 2600, String(waits));
  n = 0;
  const always = { beta: { messages: { create: async () => { n += 1; throw Object.assign(new Error('busy'), { status: 503 }); } } } };
  await assert.rejects(callModel(always, {}, fastCall), (e) => e.class === 'api' && e.attempts === 5 && n === 5);
  n = 0;
  const bad = { beta: { messages: { create: async () => { n += 1; throw Object.assign(new Error('bad request'), { status: 400 }); } } } };
  await assert.rejects(callModel(bad, {}, fastCall), (e) => e.class === 'api' && e.attempts === 1 && n === 1);
  const hang = { beta: { messages: { create: (p, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) } } };
  await assert.rejects(callModel(hang, {}, { timeoutMs: 20 }), (e) => e.class === 'timeout');
  assert.equal(retryable({ status: 500 }), true); assert.equal(retryable({ status: 404 }), false);

  // in a run: the failed row is in errors.jsonl, not in the results
  const out = tmp('errors');
  try {
    const client = fakeClient({ tutor: (p) => { if (p.model.includes('haiku')) throw Object.assign(new Error('bad request'), { status: 400 }); return textMsg(p.model, 'מתחילים מהכפל. עכשיו נסו בעצמכם.'); } });
    const { results, errors, summary } = await runEval({ yes: true, client, cases: ONE, reps: 1, sweep: false, out, log: quiet, ...fastCall });
    assert.deepEqual(results.map((r) => r.arm), ['full']);
    assert.deepEqual(errors.map((e) => [e.class, e.arm, e.case]), [['api', 'lite', ONE[0].id]]);
    assert.equal(lines(path.join(out, 'errors.jsonl')).length, 1);
    assert.match(readFileSync(path.join(out, 'summary.md'), 'utf8'), /Errors \(api 1\)/);
    assert.equal(summary.rows.errors, 1);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('the real path: the served model must be the one asked for, unless the vendor fallback answered', async () => {
  assert.deepEqual(servedCheck({ model: 'a' }, 'a'), { ok: true, fallback: false });
  assert.deepEqual(servedCheck({ model: 'b' }, 'a'), { ok: false, fallback: false });
  assert.deepEqual(servedCheck({ model: 'b', usage: { iterations: [{ type: 'message' }, { type: 'fallback_message', model: 'b' }] } }, 'a'), { ok: true, fallback: true });
  const out = tmp('served');
  try {
    const client = fakeClient({
      tutor: (p) => (p.model.includes('haiku')
        ? textMsg('claude-something-else', 'מתחילים מהכפל.')
        : textMsg('claude-fallback-model', 'מתחילים מהכפל. עכשיו נסו בעצמכם.', { usage: { input_tokens: 10, output_tokens: 10, iterations: [{ type: 'message', model: p.model, input_tokens: 5, output_tokens: 0 }, { type: 'fallback_message', model: 'claude-fallback-model', input_tokens: 5, output_tokens: 10 }] } })),
      judge: () => verdictMsg(GOOD_VERDICT, 'claude-not-the-judge'),
    });
    const { results, errors } = await runEval({ yes: true, client, cases: ONE, reps: 1, sweep: false, out, log: quiet, ...fastCall });
    assert.deepEqual(results.map((r) => [r.arm, r.fallback, r.served]), [['full', true, 'claude-fallback-model']]);
    assert.deepEqual(errors.map((e) => [e.class, e.arm]).sort(), [['judge', 'full'], ['model', 'lite']]);
    assert.equal(results[0].judge, null, 'a verdict from another model is not used');
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('the real path: a refusal is its own status, a reply cut off with no text is graded as what it is, and neither is judged', async () => {
  const out = tmp('status');
  try {
    const client = fakeClient({ tutor: (p) => (p.model.includes('haiku') ? { ...textMsg(p.model, ''), stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '' }] } : { ...textMsg(p.model, ''), stop_reason: 'refusal', content: [] }) });
    const { results, summary } = await runEval({ yes: true, client, cases: ONE, reps: 1, sweep: false, out, log: quiet, ...fastCall });
    const byArm = Object.fromEntries(results.map((r) => [r.arm, r]));
    assert.equal(byArm.full.status, 'refusal'); assert.deepEqual(byArm.full.grades, {});
    assert.equal(byArm.lite.status, 'truncated'); assert.equal(byArm.lite.grades.hebrew.pass, false);
    assert.equal(client.calls.filter((x) => x.params.system === JUDGE_SYSTEM).length, 0);
    assert.deepEqual([summary.rows.refusals, summary.rows.truncated, summary.rows.empty], [1, 1, 1]);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('the real path: the budget stops new rows, a refused key stops the run, and neither can pass the gate', async () => {
  const out = tmp('budget');
  try {
    // each tutor answer costs $1 at the paid model's price (500k fresh tokens at $2 a million)
    const client = fakeClient({ tutor: (p) => textMsg(p.model, 'מתחילים מהכפל. עכשיו נסו בעצמכם.', { usage: { input_tokens: 500_000, output_tokens: 0 } }) });
    const cases = CASES.filter((c) => c.cat === 'W1');
    const { summary, results } = await runEval({ yes: true, client, cases, reps: 1, sweep: false, shapes: ['full'], judge: 'none', budgetUsd: 2, concurrency: 1, out, log: quiet, ...fastCall });
    assert.equal(results.length, 2);
    assert.equal(summary.gate.stopped, 'budget'); assert.equal(summary.gate.notRun, cases.length - 2);
    assert.equal(summary.gate.pass, false); assert.equal(summary.gate.complete, false);
    assert.match(readFileSync(path.join(out, 'summary.md'), 'utf8'), /the budget of \$2 was reached\): 6 rows did not run/);
  } finally { rmSync(out, { recursive: true, force: true }); }
  const out2 = tmp('auth');
  try {
    const client = fakeClient({ tutor: () => { throw Object.assign(new Error('invalid x-api-key'), { status: 401 }); } });
    const { summary } = await runEval({ yes: true, client, cases: CASES.filter((c) => c.cat === 'W1'), reps: 1, sweep: false, shapes: ['full'], concurrency: 1, out: out2, log: quiet, ...fastCall });
    assert.equal(summary.gate.stopped, 'auth'); assert.equal(summary.rows.errors, 1); assert.equal(summary.gate.pass, false);
  } finally { rmSync(out2, { recursive: true, force: true }); }
});

test('--publish copies a passing, clean, complete run, and refuses everything else', async () => {
  const out = tmp('pub'); const root = tmp('root');
  try {
    // the hand-written references, answered by a fake client keyed on the context it was sent: a real-path run that passes
    const refs = new Map(REFS.map((r) => [r.case, r]));
    const cases = CASES.filter((c) => refs.has(c.id));
    const key = (p) => `${p.system[2].text}\n${JSON.stringify(p.messages)}`;
    const replies = new Map();
    for (const c of cases) for (const shape of c.shapes) replies.set(key(buildRequest(c.kind, c.kind === 'chat' ? { ctx: c.ctx, messages: c.messages } : { ctx: c.ctx }, { shape })), refs.get(c.id));
    const judgeOf = (p) => [...refs.values()].find((r) => p.messages[0].content[1].text.includes(r.reply))?.judge;
    const client = fakeClient({ tutor: (p) => textMsg(p.model, replies.get(key(p)).reply), judge: (p) => verdictMsg(judgeOf(p)) });
    const { summary } = await runEval({ yes: true, client, cases, reps: 1, out, log: quiet, ...fastCall });
    assert.equal(summary.gate.pass, true, JSON.stringify(summary.gate.failures));
    assert.equal(summary.gate.complete, true);
    const { to } = publishRun(out, { root });
    assert.equal(to, path.join(root, summary.stamp));
    assert.deepEqual(readdirSync(to).sort(), ['results.jsonl', 'summary.md']);
    assert.equal(readFileSync(path.join(to, 'summary.md'), 'utf8'), readFileSync(path.join(out, 'summary.md'), 'utf8'));
    assert.throws(() => publishRun(out, { root }), /already exists/);
    // an error line, a failed gate or a narrowed run is never published
    writeFileSync(path.join(out, 'errors.jsonl'), '{"class":"api"}\n');
    assert.throws(() => publishRun(out, { root: tmp('root2') }), /errors\.jsonl has 1 errors/);
    writeFileSync(path.join(out, 'errors.jsonl'), '');
    const s = JSON.parse(readFileSync(path.join(out, 'summary.json'), 'utf8'));
    writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ ...s, gate: { ...s.gate, pass: false, failures: [{ column: 'full', metric: 'leakRaw' }] } }));
    assert.throws(() => publishRun(out, { root: tmp('root3') }), /the gate failed \(full leakRaw\)/);
    writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ ...s, gate: { ...s.gate, complete: false, narrowed: ['--only D1'] } }));
    assert.throws(() => publishRun(out, { root: tmp('root4') }), /narrowed or stopped \(--only D1\)/);
    assert.throws(() => publishRun(tmp('empty'), { root }), /summary\.json is missing/);
  } finally { rmSync(out, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

test('Wilson intervals and the gate table', () => {
  assert.deepEqual(wilson(0, 0), [null, null]);
  const [lo, hi] = wilson(5, 10);
  assert.ok(Math.abs(lo - 0.2366) < 1e-3 && Math.abs(hi - 0.7634) < 1e-3);
  assert.ok(Math.abs(wilson(10, 10)[0] - 0.7225) < 1e-3 && wilson(10, 10)[1] === 1);
  // the spec's gate, row for row
  const bars = Object.fromEntries(GATE.map((m) => [m.id, [m.full, m.haiku]]));
  assert.deepEqual(bars, {
    leakAfterGuard: [1, 1], leakRaw: [0.97, 0.95], noCandidateVerdict: [1, 0.95], sameDiagnosis: [0.95, 0.9], namesOtherMistake: [0.98, 0.96],
    teachesStairWay: [0.9, 0.85], mathCorrect: [0.98, 0.95], bannedRule: [1, 1], mathEquations: [0.99, 0.97], refusesToHelp: [0.95, 0.95],
    hebrew: [0.98, 0.95], latex: [0.98, 0.95], pluralOnly: [0.98, 0.95], words: [0.95, 0.95], noClosingQuestion: [null, 0.95],
    // AI-10's feedback rows: statuses on 90% of the points, every quote the student's, a rewrite on at most 5%
    feedbackMatch: [0.9, null], quoteIsStudents: [1, null], rewritesForStudent: [0.95, null],
    passShare: [1, null], shownWrong: [1, null],
  });
  assert.equal(GATE.find((m) => m.id === 'feedbackMatch').from, 'points', 'pooled over the points, not the rows');
  // generate passShare: the bar is every stair, each at a mean of at least 80% over its repetitions
  assert.equal(GATE.find((m) => m.id === 'passShare').stairBar, 0.8);
});

// ---------------------------------------------------------------- the generate pipeline (category G)
test('the generate grader: the share of stories that passed, and a wrong answer shown is caught however it got there', () => {
  const c = GEN_CASES[0];
  const seeds = c.input.seeds;
  const item = (sd, end = sd.answer, blind = 'ok') => ({ seed: sd.i, prompt: sd.text, hint: '', solution: [`$= ${end}$`], kept: false, blind });
  const answers = seeds.map((sd) => ({ seed: sd.i, answer: sd.answer }));
  const good = gradeGenerate(c, { items: seeds.slice(0, 6).map((sd) => item(sd)), dropped: { numbers: 1 }, blindAnswers: answers });
  assert.deepEqual(good.errors, []);
  assert.equal(good.grades.passShare.share, 6 / 7); assert.equal(good.grades.passShare.pass, true);
  assert.match(good.grades.passShare.detail, /6 of 7 stories passed \(numbers 1\)/);
  assert.equal(good.grades.shownWrong.pass, true);
  assert.equal(gradeGenerate(c, { items: seeds.slice(0, 5).map((sd) => item(sd)), blindAnswers: answers }).grades.passShare.pass, false, '5 of 7 is under 80%');
  // an answer that is not the app's, at the end of the solution or from the blind solve, or a seed never asked
  const wrongEnd = gradeGenerate(c, { items: [item(seeds[1], Number(seeds[1].answer) + 1)], blindAnswers: answers });
  assert.equal(wrongEnd.grades.shownWrong.pass, false); assert.equal(wrongEnd.grades.shownWrong.n, 1);
  const wrongBlind = gradeGenerate(c, { items: [item(seeds[1])], blindAnswers: [{ seed: 1, answer: '999' }] });
  assert.match(wrongBlind.grades.shownWrong.detail, /blind solve gave 999/);
  assert.equal(gradeGenerate(c, { items: [item(seeds[1], seeds[1].answer, 'skipped')], blindAnswers: null }).grades.shownWrong.pass, true, 'no blind solve to compare');
  assert.equal(gradeGenerate(c, { items: [{ ...item(seeds[1]), seed: 42 }], blindAnswers: answers }).grades.shownWrong.pass, false);
  // a grader that throws is an error, not a fail
  const broken = gradeGenerate({ id: 'G-x' }, { items: [] });
  assert.equal(broken.errors[0].class, 'grader');
});

test('the generate stubs go through generateVerified: fixtures pass every story, leaky loses every number', async () => {
  for (const c of GEN_CASES) {
    const call = (stub) => async (params) => ({ model: params.model, stop_reason: 'end_turn', content: [{ type: 'text', text: stubGenerate(stub, c, params) }], usage: {} });
    const ok = await generateVerified(call('fixtures'), c.input, { model: 'claude-sonnet-5-5', blindModel: 'claude-haiku-5-5' });
    assert.equal(ok.items.length, c.input.seeds.length, c.id);
    assert.ok(ok.items.every((it) => it.blind === (c.input.seeds.find((sd) => sd.i === it.seed).fig ? 'skipped' : 'ok')), c.id);
    const leaky = await generateVerified(call('leaky'), c.input, { model: 'claude-sonnet-5-5' });
    assert.ok(leaky.items.length / c.input.seeds.length < 0.8, `${c.id}: ${leaky.items.length}`);
  }
  // the blind stub answers exactly the stories it was sent, by their numbers
  const c = GEN_CASES[0];
  const items = JSON.parse(stubGenerate('fixtures', c, buildRequest('generate', c.input))).items;
  const answers = JSON.parse(stubGenerate('fixtures', c, buildBlind(items))).answers;
  assert.deepEqual(answers.map((a) => a.answer), c.input.seeds.map((sd) => sd.answer));
});

// ---------------------------------------------------------------- feedback rows (category F, ai spec AI-10)
/** A stub feedback reply as the runner reads it: the model's JSON, and what the server's checks leave for the screen. */
const asRead = (c, json) => {
  const message = { stop_reason: 'end_turn', content: [{ type: 'text', text: json }] };
  const shown = readResult('feedback', message, inputOf(c));
  return { raw: JSON.parse(json), shown, prose: feedbackProse(shown), view: feedbackView(c, shown) };
};

test('F: the good stub feedback passes every grader, statuses as a teacher marked them, quotes the student\'s own words, no rewrite', () => {
  for (const c of FB_CASES) {
    const f = asRead(c, goodFeedback(c));
    const g = gradeRow(c, { reply: f.prose, feedback: f });
    assert.deepEqual(g.errors, [], c.id);
    for (const [name, v] of Object.entries(g.grades)) assert.notEqual(v.pass, false, `${c.id}: ${name} ${v.detail}`);
    assert.equal(g.grades.feedbackMatch.matched, c.expect.points.length, c.id);
    assert.equal(g.grades.feedbackMatch.total, c.expect.points.length, c.id);
    assert.equal(g.grades.quoteIsStudents.pass, c.expect.points.some((p) => p.quote) ? true : null, c.id);
    // the server kept every quote (they are the student's), and the judge stub sees no rewrite, even where the student's
    // own sentence is copied from the model answer (F-expr2-copied): a quote is the student's text, not the tutor's
    assert.deepEqual(f.shown.points.map((p) => p.quote), c.expect.points.map((p) => p.quote || ''), c.id);
    const v = stubVerdict(c, f.view);
    assert.equal(v.rewritesForStudent, 'no', c.id); assert.equal(v.mathCorrect, 'yes', c.id);
    assert.ok(f.view.includes('Summary: ') && c.expect.points.every((p, i) => f.view.includes(`${i}. ${c.input.rubric[i]}: `)), c.id);
  }
  const copied = byId.get('F-expr2-copied');
  assert.ok(copied.input.sample.includes(copied.expect.points[0].quote), 'the copied row quotes words that are also the model answer\'s');
});

test('F: the leaky stub feedback fails feedbackMatch, quoteIsStudents and rewritesForStudent; the server blanks the invented quotes', () => {
  let matched = 0; let total = 0;
  for (const c of FB_CASES) {
    const f = asRead(c, leakyFeedback(c));
    const g = gradeRow(c, { reply: f.prose, feedback: f }).grades;
    matched += g.feedbackMatch.matched; total += g.feedbackMatch.total;
    assert.equal(g.quoteIsStudents.pass, false, c.id);
    assert.ok(f.shown.points.every((p) => p.quote === ''), `${c.id}: no invented quote reaches the screen`);
    assert.equal(stubVerdict(c, f.view).rewritesForStudent, 'yes', `${c.id}: the summary is the model answer`);
  }
  assert.ok(matched / total < 0.9, `${matched}/${total}`);
});

test('F: each feedback grader catches what it is for', () => {
  const c = byId.get('F-expr4-partly');
  const json = (points, summary = 'יפה.') => JSON.stringify({ points, summary, care: false });
  const grade = (j) => { const f = asRead(c, j); return gradeRow(c, { reply: f.prose, feedback: f }).grades; };
  const good = c.expect.points.map((p, i) => ({ i, status: p.status, quote: p.quote || '', tip: p.tip || '' }));
  // one status off out of two: 50% of the points, below 90%
  const off = grade(json([{ ...good[0] }, { ...good[1], status: 'yes', tip: '' }]));
  assert.deepEqual([off.feedbackMatch.matched, off.feedbackMatch.total, off.feedbackMatch.pass], [1, 2, false]);
  // a missing point reads as "no" (the server fills it), which is not what the teacher marked
  assert.equal(grade(json([good[0]])).feedbackMatch.matched, 1);
  // a quote with one word the student never wrote is not theirs, though most of it is
  assert.equal(grade(json([{ ...good[0], quote: `${good[0].quote} בזהירות` }, good[1]])).quoteIsStudents.pass, false);
  // a quote the model wrapped in quotation marks, with its own spacing, is still the student's
  assert.equal(grade(json([{ ...good[0], quote: `"${good[0].quote.replace(/ /g, '  ')}"` }, good[1]])).quoteIsStudents.pass, true);
  // the prose graders read the tutor's own words: a singular tip fails pluralOnly, a quote of the student never does
  assert.equal(grade(json([good[0], { ...good[1], tip: 'תכתוב מה קורה ל־4.' }])).pluralOnly.pass, false);
  // a broken reply: no point matched (the runner records it as bad_output)
  assert.throws(() => asRead(c, '{"points": 1'), (e) => e.code === 'bad_output');
  assert.equal(GRADERS.feedbackMatch({ case: c, feedback: { raw: null, shown: null } }).matched, 0);
  // the feedback graders do not apply to the other rows
  const w = byId.get('W1-signed4-what');
  assert.equal(gradeRow(w, { reply: 'נסו את הצעד הראשון.' }).grades.feedbackMatch.pass, null);
  assert.equal(gradeRow(w, { reply: 'נסו את הצעד הראשון.' }).grades.quoteIsStudents.pass, null);
});

test('F: the judge sees the rubric, the model answer as the tutor\'s reference, the student\'s text, and the reply as the screen shows it', () => {
  const c = byId.get('F-expr4-partly');
  const f = asRead(c, goodFeedback(c));
  const p = buildJudge(c, f.view);
  const situation = p.messages[0].content[0].text;
  for (const part of [...c.input.rubric, c.input.sample, `«${c.input.text}»`, c.expect.describe, '<app_context>']) assert.ok(situation.includes(part), part);
  assert.match(situation, /must not rewrite the explanation/);
  const reply = p.messages[0].content[1].text;
  assert.ok(reply.includes('Tip: ') && reply.includes('The student\'s own words it points to: «'));
  assert.ok(reply.includes(`0. ${c.input.rubric[0]}: covered ("יש")`) && reply.includes(`1. ${c.input.rubric[1]}: partly covered ("יש חלק")`));
});

test('F: runEval on the fixtures stub grades every feedback row; the leaky stub fails all three F metrics', async () => {
  const out = tmp('fb');
  try {
    const { summary, results } = await runEval({ stub: 'fixtures', reps: 1, only: ['F'], out, log: quiet });
    const fb = results.filter((r) => r.kind === 'feedback');
    assert.equal(fb.length, FB_CASES.length);
    for (const r of fb) {
      assert.equal(r.status, 'ok', r.case);
      assert.equal(r.grades.feedbackMatch.matched, r.grades.feedbackMatch.total, r.case);
      assert.equal(r.judge.rewritesForStudent, 'no', r.case);
      assert.ok(r.guarded.includes('Summary: '), `${r.case}: what the student saw`);
      assert.doesNotThrow(() => JSON.parse(r.reply), `${r.case}: the model's own JSON is kept`);
    }
    const metric = (id) => summary.gate.columns.full.metrics.find((m) => m.metric === id);
    assert.deepEqual([metric('feedbackMatch').n, metric('feedbackMatch').passes, metric('feedbackMatch').pass], [9, 9, true]);
    assert.deepEqual([metric('quoteIsStudents').n, metric('quoteIsStudents').pass], [3, true], 'the row with no quote is not counted');
    assert.deepEqual([metric('rewritesForStudent').n, metric('rewritesForStudent').pass], [4, true]);
    assert.equal(metric('teachesStairWay').n, 0, 'not asked of a feedback row');
  } finally { rmSync(out, { recursive: true, force: true }); }
  const bad = tmp('fb-leaky');
  try {
    const { summary } = await runEval({ stub: 'leaky', reps: 1, only: ['F'], out: bad, log: quiet });
    const failing = summary.gate.failures.map((f) => `${f.column}:${f.metric}`);
    for (const f of ['full:feedbackMatch', 'full:quoteIsStudents', 'full:rewritesForStudent']) assert.ok(failing.includes(f), f);
  } finally { rmSync(bad, { recursive: true, force: true }); }
});

test('F, the real path: the request the app sends, the judge on the screen\'s view, and a reply that is not JSON is bad_output with no judge', async () => {
  const out = tmp('fb-real');
  const c = byId.get('F-pyth2-all');
  try {
    let mode = 'ok';
    const client = fakeClient({ tutor: (p) => textMsg(p.model, mode === 'ok' ? goodFeedback(c) : '{"points": [') });
    const { results, errors } = await runEval({ yes: true, client, cases: [c], reps: 1, sweep: false, out, log: quiet, ...fastCall });
    assert.deepEqual(errors, []);
    const tutorCalls = client.calls.filter((x) => x.params.system !== JUDGE_SYSTEM);
    assert.deepEqual(tutorCalls.map((x) => x.params), [buildRequest('feedback', inputOf(c), { shape: 'full' })]);
    const judged = client.calls.filter((x) => x.params.system === JUDGE_SYSTEM).map((x) => x.params.messages[0].content[1].text);
    assert.equal(judged.length, 1); assert.ok(judged[0].includes(results[0].guarded));
    assert.equal(results[0].grades.feedbackMatch.matched, 2);
    mode = 'broken';
    const again = await runEval({ yes: true, client, cases: [c], reps: 1, sweep: false, out: `${out}-2`, log: quiet, ...fastCall });
    assert.equal(again.results[0].status, 'bad_output');
    assert.equal(again.results[0].judge, null);
    assert.deepEqual([again.results[0].grades.feedbackMatch.matched, again.results[0].grades.feedbackMatch.pass], [0, false]);
    assert.equal(again.summary.gate.pass, false);
  } finally { rmSync(out, { recursive: true, force: true }); rmSync(`${out}-2`, { recursive: true, force: true }); }
});
