// Code checks of AI-written exercises (ai spec AI-4 Design 4-5, Tests "verify"): the numbers of a Hebrew + TeX text, an
// answer as written (held to the app's own parseNum), one rewritten exercise against the app's seed, a whole reply,
// and the blind solve's request. Pure functions: no model, no network, synthetic text only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numbersIn, parseAnswer, verifyRewrite, finishRewrite, checkEquations, DROP_REASONS } from '../../shared/verify.js';
import { buildBlind, BLIND_SCHEMA, BLIND_SYSTEM, LITE_MODEL, FALLBACK_BETA } from '../../shared/ai.js';
import { parseNum } from '../../web/src/content/util.js';

const sorted = (a) => [...a].sort((x, y) => x - y);

test('numbersIn reads TeX fractions, signs, the Unicode minus, thousands, decimal commas and degrees', () => {
  const table = [
    ['חשבו: 3 - (-5)', [3, -5]],
    ['$\\frac{3}{4}$ מתוך 1,500 שקלים', [0.75, 3, 4, 1500]],
    ['$\\dfrac{-6}{4}$', [-1.5, -6, 4]],
    ['$-\\frac{1}{2}$, ואחר כך $3 - \\frac{1}{2}$', [-0.5, 0.5, 1, 2, 3, 1, 2]],
    ['הטמפרטורה ירדה ב־2,5 מעלות', [2.5]],
    ['$−4 + 6$', [-4, 6]],
    ['$60^\\circ$ ועוד $120^{\\circ}$ ועוד 30°', [60, 120, 30]],
    ['הנקודות (2,5) ו־$(3, -1)$', [2, 5, 3, -1]],
    ['$3-5$ ו־$x - 5$', [3, 5, 5]],
    ['6 מעלות מתחת לאפס', [6]],
    ['מ־-4 עד 3', [-4, 3]],
    ['$\\sqrt{50} \\approx 7.07$', [50, 7.07]],
    ['שלושה רבעים: 3/4', [0.75, 3, 4]],
    ['1,500,000 ו־12.25', [1500000, 12.25]],
    ['אין כאן מספר.', []],
  ];
  for (const [text, want] of table) assert.deepEqual(sorted(numbersIn(text)), sorted(want), text);
});

test('parseAnswer reads an answer as written, and nothing else', () => {
  const table = [
    ['-3', -3], ['−7', -7], ['x = -3', -3], ['y=2.5', 2.5], ['$x = 5$', 5], ['$\\frac{3}{4}$', 0.75], ['\\dfrac{-6}{4}', -1.5],
    ['-\\frac{1}{2}', -0.5], ['2,5', 2.5], ['3/4', 0.75], ['-3/4', -0.75], ['(2, -1)', [2, -1]], ['(1;2)', [1, 2]], ['$(0, 7)$', [0, 7]],
    [' 12 ', 12], ['unclear', null], ['UNCLEAR', null], ['', null], [null, null], ['abc', null], ['3/0', null], ['x', null],
    ['(1, 2, 3)', null], ['5 ס״מ', null], ['\\frac{1}{0}', null],
  ];
  for (const [s, want] of table) assert.deepEqual(parseAnswer(s), want, String(s));
});

test('parseAnswer agrees with the app\'s parseNum on everything parseNum reads (a property test)', () => {
  // a seeded stream of strings made of what a typed answer is made of, and numbers written every way the app writes them
  let a = 7 >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ALPHABET = ['0', '1', '2', '3', '5', '7', '9', '.', ',', '/', '-', '+', '−', '–', ' '];
  let read = 0;
  for (let i = 0; i < 20000; i += 1) {
    const len = 1 + Math.floor(rnd() * 7);
    const s = Array.from({ length: len }, () => ALPHABET[Math.floor(rnd() * ALPHABET.length)]).join('');
    const want = parseNum(s);
    if (want === null) continue;
    read += 1;
    assert.equal(Object.is(parseAnswer(s), want) || parseAnswer(s) === want, true, JSON.stringify(s));
  }
  for (let i = 0; i < 2000; i += 1) {
    const v = Math.round((rnd() - 0.5) * 2000) / (rnd() < 0.5 ? 1 : 100);
    for (const s of [String(v), String(v).replace('-', '−'), String(v).replace('.', ','), ` ${v} `]) {
      if (parseNum(s) === null) continue;
      read += 1;
      assert.equal(parseAnswer(s), parseNum(s), s);
    }
  }
  assert.ok(read > 5000, `the property ran on ${read} strings`);
});

// ---------------------------------------------------------------- one rewritten exercise
// a seed as the request carries it: the app's text (itemPlain), its answer (answerText), and the two flags
const SEED = { i: 0, text: 'בבוקר היו -6 מעלות. בצהריים הטמפרטורה עלתה ב־9 מעלות. כמה מעלות היו בצהריים?', answer: '3', round: false, fig: false };
const STORY = {
  seed: 0,
  prompt: 'בבוקר בחרמון היו 6 מעלות מתחת לאפס. עד הצהריים הטמפרטורה עלתה ב־9 מעלות. מה הטמפרטורה בצהריים?',
  hint: 'מתחילים ב־$-6$ על ציר המספרים וזזים ימינה.',
  solution: ['מתחילים ב־$-6$.', 'עלייה של 9 מעלות היא תזוזה של 9 ימינה: $-6 + 9$.', '$-6 + 9 = 3$'],
  kept: false,
};
const v = (item, blind = '3', seed = SEED) => verifyRewrite(seed, item, blind);

test('verifyRewrite: a faithful story passes, and the reply keeps exactly what was written', () => {
  const r = v(STORY);
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual([r.reason, r.fixed, r.blind], [null, null, 'ok']);
  assert.deepEqual(r.item, { seed: 0, prompt: STORY.prompt, hint: STORY.hint, solution: STORY.solution, kept: false, blind: 'ok' });
  // the blind solve may write its answer any way an answer is written
  for (const b of ['3', '$3$', 'x = 3', '3.0', '6/2', '\\frac{6}{2}']) assert.equal(v(STORY, b).ok, true, b);
});

test('verifyRewrite drops what code can prove wrong, each for its reason, in order', () => {
  const cases = [
    ['a changed number (−6 became 8)', { ...STORY, prompt: STORY.prompt.replace('6 מעלות', '8 מעלות') }, '3', 'numbers'],
    ['a number left out', { ...STORY, prompt: 'בבוקר היה קר מאוד. עד הצהריים הטמפרטורה עלתה ב־9 מעלות. מה הטמפרטורה בצהריים?' }, '3', 'numbers'],
    ['the sum asked instead of the difference: the blind solve gives another value', {
      ...STORY,
      prompt: 'בבוקר היו 6 מעלות מתחת לאפס, ובערב 9 מעלות. בכמה מעלות עלתה הטמפרטורה?',
    }, '15', 'blind'],
    ['the last step ends at another value', { ...STORY, solution: ['$-6 + 9$', 'ולכן $= 5$'] }, '3', 'solution'],
    ['the last step has no "= answer"', { ...STORY, solution: ['מתחילים ב־$-6$.', 'זזים 9 ימינה ומגיעים ל־3.'] }, '3', 'solution'],
    ['an odd $ in a step', { ...STORY, solution: ['מתחילים ב־$-6.', '$-6 + 9 = 3$'] }, '3', 'latex'],
    ['an odd $ in the story', { ...STORY, prompt: `${STORY.prompt} $` }, '3', 'latex'],
    ['a false equation on the way to the right answer', { ...STORY, solution: ['$3 + 5 = 9$', '$-6 + 9 = 3$'] }, '3', 'equations'],
    ['the answer written in the story', { ...STORY, prompt: `${STORY.prompt} (רמז: יצא 3)` }, '3', 'leak'],
    ['blind "unclear"', STORY, 'unclear', 'blind'],
    ['blind gave nothing for this story', STORY, null, 'blind'],
  ];
  for (const [what, item, blind, reason] of cases) {
    const r = v(item, blind);
    assert.equal(r.ok, false, what);
    assert.equal(r.reason, reason, what);
    assert.equal(r.item, null, what);
  }
  assert.deepEqual(DROP_REASONS, ['kept', 'latex', 'numbers', 'leak', 'solution', 'equations', 'blind']);
});

test('verifyRewrite: a negative said in words still ends "= -6" with its sign', () => {
  const seed = { i: 3, text: 'חשבו: $-2 - 4$', answer: '-6', round: false, fig: false };
  const story = {
    seed: 3, kept: false, hint: 'מתחילים ב־$-2$ וזזים שמאלה.',
    prompt: 'בלילה היו 2 מעלות מתחת לאפס, ועד הבוקר הטמפרטורה ירדה עוד 4 מעלות. מה הטמפרטורה בבוקר?',
    solution: ['ירידה של 4 היא תזוזה של 4 שמאלה: $-2 - 4$.', 'בבוקר היו 6 מעלות מתחת לאפס: $-2 - 4 = -6$'],
  };
  assert.equal(verifyRewrite(seed, story, '-6').ok, true);
  assert.equal(verifyRewrite(seed, { ...story, solution: ['$-2 - 4$', 'כלומר 6 מעלות מתחת לאפס: $= 6$'] }, '-6').reason, 'solution', 'the sign is part of the value');
  // a unit after the last run is fine; more maths after it is not
  assert.equal(verifyRewrite(seed, { ...story, solution: ['$-2 - 4 = -6$ מעלות.'] }, '-6').ok, true);
  assert.equal(verifyRewrite(seed, { ...story, solution: ['$-2 - 4 = -6$ ועוד 2 מעלות'] }, '-6').reason, 'solution');
});

test('verifyRewrite: equations are checked like the eval checks a reply (roots with ≈ pass, letters are skipped)', () => {
  const seed = { i: 1, text: 'במשולש ישר־זווית שני הניצבים באורך 5. מה אורך היתר? עגלו לעשירית.', answer: '7.1', round: true, fig: false };
  const story = {
    seed: 1, kept: false, hint: 'מה שטח הריבוע על היתר?',
    prompt: 'סולם נשען על קיר. הוא מגיע לגובה 5 מטרים, ורגלו 5 מטרים מהקיר. מה אורכו? עגלו לעשירית.',
    solution: ['$c^2 = 5^2 + 5^2 = 50$', '$c = \\sqrt{50} \\approx 7.1$'],
  };
  assert.equal(verifyRewrite(seed, story, '7.07').ok, true, 'a rounded seed allows 0.05');
  assert.equal(verifyRewrite(seed, story, '7.2').reason, 'blind');
  assert.equal(verifyRewrite(seed, { ...story, solution: ['$\\sqrt{50} \\approx 7.5$', '$c \\approx 7.1$'] }, '7.1').reason, 'equations');
  const eq = { i: 2, text: 'פתרו: $x + 5 = 12$', answer: '7', round: false, fig: false };
  const eqStory = { seed: 2, kept: false, hint: 'מה עושים לשני האגפים?', prompt: 'לדני היו כמה מדבקות. הוא קיבל עוד 5, ועכשיו יש לו 12. כמה היו לו? ($x + 5 = 12$)', solution: ['$x + 5 = 12$', 'מחסירים 5 משני האגפים: $x = 12 - 5 = 7$'] };
  assert.equal(verifyRewrite(eq, eqStory, '7').ok, true, '"x + 5 = 12" has a letter: skipped, never failed');
  assert.equal(checkEquations(eqStory.solution.join('\n')).checked, 1);
});

test('verifyRewrite: a seed with a drawing keeps its wording; kept seeds skip the blind solve', () => {
  const seed = { i: 4, text: 'מצאו את הזווית המסומנת. [ישרים מקבילים וחותך: זווית נתונה 75°, הזווית המבוקשת מתחלפות לה]', answer: '75', round: false, fig: true };
  const kept = { seed: 4, kept: true, prompt: ' מצאו את הזווית   המסומנת. [ישרים מקבילים וחותך: זווית נתונה $75°$, הזווית המבוקשת מתחלפות לה]', hint: 'זוויות מתחלפות בין ישרים מקבילים שוות.', solution: ['זוויות מתחלפות שוות: $= 75^\\circ$'] };
  const r = verifyRewrite(seed, kept, undefined);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.blind, 'skipped');
  assert.equal(verifyRewrite(seed, kept, 'unclear').ok, true, 'the app\'s own wording needs no blind solve');
  assert.equal(verifyRewrite(seed, { ...kept, kept: false, prompt: 'שתי מסילות רכבת מקבילות... זווית של 75 מעלות. מה הזווית השנייה?' }, '75').reason, 'kept', 'no new story under a drawing');
  assert.equal(verifyRewrite(seed, { ...kept, prompt: 'מצאו את הזווית. [ישרים מקבילים וחותך: זווית נתונה 80°]' }, '75').reason, 'kept', 'changed wording, called kept');
  // a seed without a drawing may be kept too ("could not be put in a story"), on the same terms
  assert.equal(verifyRewrite(SEED, { ...STORY, kept: true, prompt: SEED.text }, undefined).ok, true);
  assert.equal(verifyRewrite(SEED, { ...STORY, kept: true }, '3').reason, 'kept');
});

test('verifyRewrite repairs the hint only: a hint with the answer (or an odd $) is dropped for the seed\'s own', () => {
  for (const hint of ['בסוף יוצא 3.', 'מתחילים ב־$-6 וזזים.']) {
    const r = v({ ...STORY, hint });
    assert.equal(r.ok, true, hint);
    assert.equal(r.fixed, 'hint');
    assert.equal(r.item.hint, '');
    assert.equal(r.item.fixed, 'hint');
  }
  // a number of the seed in the hint is no leak, even when it equals the answer
  const seed = { i: 5, text: 'חשבו: $5 - 0$', answer: '5', round: false, fig: false };
  const story = { seed: 5, kept: false, prompt: 'בקופה היו 5 שקלים ולא הוציאו כלום (0 שקלים). כמה נשאר?', hint: 'כמה הוציאו מתוך ה־5?', solution: ['$5 - 0 = 5$'] };
  assert.deepEqual([verifyRewrite(seed, story, '5').ok, verifyRewrite(seed, story, '5').fixed], [true, null]);
  // a value is never repaired: a wrong ending is a drop, not a fix
  assert.equal(v({ ...STORY, solution: ['$-6 + 9 = 4$'] }).reason, 'solution');
});

test('finishRewrite: the passing exercises in seed order, one per seed, and a count per reason', () => {
  const seeds = [SEED, { ...SEED, i: 1 }, { ...SEED, i: 2 }, { ...SEED, i: 3 }, { ...SEED, i: 4 }];
  const data = {
    items: [
      { ...STORY, seed: 4 },
      { ...STORY, seed: 0 },
      { ...STORY, seed: 0, prompt: 'a second story for seed 0 is ignored' },
      { ...STORY, seed: 1, prompt: STORY.prompt.replace('9 מעלות', '8 מעלות') },
      { ...STORY, seed: 2 },
      { ...STORY, seed: 3, solution: ['$-6 + 9 = 3$', 'ולכן $= 4$'] },
      { ...STORY, seed: 9 }, // no such seed
      null,
    ],
  };
  const blind = { answers: [{ seed: 0, answer: '3' }, { seed: 1, answer: '2' }, { seed: 2, answer: '15' }, { seed: 3, answer: '3' }, { seed: 4, answer: '3' }] };
  const r = finishRewrite(seeds, data, blind);
  assert.deepEqual(r.items.map((x) => [x.seed, x.blind]), [[0, 'ok'], [4, 'ok']]);
  assert.deepEqual(r.dropped, { kept: 0, latex: 0, numbers: 1, leak: 0, solution: 1, equations: 0, blind: 1 });
  // the blind solve did not run: code checks 1-4 still apply, and the items say so
  const skipped = finishRewrite(seeds, data, null);
  assert.deepEqual(skipped.items.map((x) => [x.seed, x.blind]), [[0, 'skipped'], [2, 'skipped'], [4, 'skipped']]);
  assert.deepEqual(skipped.dropped, { kept: 0, latex: 0, numbers: 1, leak: 0, solution: 1, equations: 0, blind: 0 });
  // nothing usable is an empty list, never a throw
  assert.deepEqual(finishRewrite(seeds, {}, null), { items: [], dropped: Object.fromEntries(DROP_REASONS.map((k) => [k, 0])) });
  assert.deepEqual(finishRewrite(null, null, null).items, []);
  // a seed whose answer cannot be read drops its exercise instead of grading against nothing
  assert.equal(finishRewrite([{ ...SEED, answer: 'abc' }], { items: [STORY] }, null).dropped.solution, 1);
});

// ---------------------------------------------------------------- the blind solve's request
test('buildBlind sends only the stories, numbered by their seed, to the low-cost model at effort high', () => {
  const p = buildBlind([
    { ...STORY, seed: 0 },
    { ...STORY, seed: 1, prompt: 'קו   ראשון\nקו שני' },
    { ...STORY, seed: 2, kept: true, prompt: 'נוסח של האפליקציה' },
  ]);
  assert.equal(p.model, LITE_MODEL);
  assert.equal(p.max_tokens, 6000);
  assert.equal(p.output_config.effort, 'high');
  assert.deepEqual(p.output_config.format, { type: 'json_schema', schema: BLIND_SCHEMA });
  assert.equal(p.system, 'Solve each exercise on your own. Answer with the final answer only: an integer, a decimal, a fraction a/b, or a point (x, y). If an exercise can be read in more than one way, or is missing information, answer "unclear".');
  assert.equal(p.system, BLIND_SYSTEM);
  assert.equal(BLIND_SCHEMA.additionalProperties, false);
  assert.deepEqual(BLIND_SCHEMA.properties.answers.items.required, ['seed', 'answer']);
  const asked = p.messages[0].content;
  assert.equal(p.messages.length, 1);
  assert.match(asked, /^Exercises:\n0\. בבוקר בחרמון/);
  assert.match(asked, /\n1\. קו ראשון קו שני\n/);
  assert.ok(!asked.includes('נוסח של האפליקציה'), 'a kept story is the app\'s own wording: not sent');
  for (const secret of ['$-6 + 9 = 3$', STORY.hint, '"answer"']) assert.ok(!asked.includes(secret), secret);
  // the low-cost model has no server-side fallback; another blind model gets it
  assert.equal(p.betas, undefined); assert.equal(p.fallbacks, undefined);
  const other = buildBlind([STORY], { model: 'claude-sonnet-5-5' });
  assert.deepEqual([other.model, other.betas, other.fallbacks], ['claude-sonnet-5-5', [FALLBACK_BETA], 'default']);
  assert.throws(() => buildBlind([{ ...STORY, kept: true }]), /at least one story/);
  assert.throws(() => buildBlind([]), /at least one story/);
});
