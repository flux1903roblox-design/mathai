// How the tutor teaches (ai spec AI-2, AI-5): the stable block every request starts with (safety, the tutor, the
// pedagogy, the stair map, the topic ways), the shortcuts it never teaches as rules, and the one list of stairs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildRequest, AI_KINDS, FREE_KINDS, TOPIC_IDS, stableSystem as fromAi } from '../../shared/ai.js';
import {
  stableSystem, TUTOR_BODY, PEDAGOGY, TOPIC_WAYS, topicWaysBlock, curriculumBlock, SINGULAR_EXAMPLES, SINGULAR_RE, SINGULAR_WORDS,
} from '../../shared/pedagogy.js';
import { TOPIC_NAMES, STAIR_NAMES, TOPIC_GRADE, NOT_YET, stairName } from '../../shared/stairs.js';
import { safetyPrompt } from '../../shared/safety.js';
import { FEEDBACK_INPUT } from './helpers.js';

const SHARED = new URL('../../shared/', import.meta.url);
const CONTENT = new URL('../../web/src/learn/content/', import.meta.url);
const read = (url) => readFileSync(url, 'utf8');
const TOPICS = Object.keys(TOPIC_NAMES);

const page = { data: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' };
const INPUTS = {
  explain: { grade: '7', question: '3 - 8', correct: '-5', studentAnswer: '5' },
  chat: { messages: [{ role: 'user', content: 'איך מתחילים?' }], context: { grade: '7', question: '3 - 8', correct: '-5' } },
  generate: { grade: '7', topic: 'מספרים מכוונים', stair: 'חיבור וחיסור', count: 3, seeds: [{ i: 0, text: 'חשבו: 3 - (-5)', answer: '8' }] },
  check: { grade: '8', image: page.data, question: '2x = 4' },
  exam: { grade: '8', pages: [page] },
  feedback: FEEDBACK_INPUT,
};

// ---------------------------------------------------------------- AI-2: the topic ways and the stable block
test('every topic the app teaches has its ways: models, the app\'s words, and at least one shortcut never taught as a rule', () => {
  assert.deepEqual(Object.keys(TOPIC_WAYS), TOPICS, 'one entry per topic, in teaching order');
  for (const id of TOPICS) {
    const w = TOPIC_WAYS[id];
    assert.ok(w.models.length > 100, `${id}: models`);
    assert.ok(w.words.length >= 4 && w.words.every((x) => x.trim()), `${id}: words`);
    assert.ok(w.avoid.length >= 1 && w.avoid.every((x) => x.trim()), `${id}: avoid`);
    assert.ok(Array.isArray(w.avoidRe) && w.avoidRe.length >= 1 && w.avoidRe.every((r) => r instanceof RegExp), `${id}: avoidRe`);
  }
  // the algebra ways name the app's models (AI-5 "what a 10 needs")
  assert.match(TOPIC_WAYS.eq.models, /balanced scale.*both sides.*check by substituting.*positive whole numbers/s);
  assert.match(TOPIC_WAYS.expr.models, /multiplication sign.*tiles.*rectangle's area/s);
  assert.match(TOPIC_WAYS.sys.models, /original quantity.*multiplication.*both equations.*negative number.*one number from the range/s);
  assert.match(TOPIC_WAYS.eq.avoid[0], /"מעבירים אגף ומחליפים סימן".*short name/);
});

test('the stable block holds the safety block first, then the tutor, the pedagogy, the stair map and every topic\'s ways', () => {
  const s = stableSystem();
  assert.ok(s.startsWith(`${safetyPrompt()}\n\n${TUTOR_BODY}\n\n${PEDAGOGY}\n\n`), 'the order: safety, tutor, pedagogy');
  assert.ok(s.includes(curriculumBlock()) && s.endsWith(topicWaysBlock()));
  for (const id of TOPICS) {
    assert.ok(s.includes(TOPIC_WAYS[id].models), `${id}: models`);
    TOPIC_WAYS[id].avoid.forEach((a) => assert.ok(s.includes(a), `${id}: ${a.slice(0, 30)}`));
    TOPIC_WAYS[id].words.forEach((a) => assert.ok(s.includes(a), `${id}: ${a}`));
  }
  // the safety numbers are all still there
  for (const n of ['1201', '052-845-1201', '055-957-1399', '105', 'משטרה 100', 'מד״א 101', '[[care]]']) assert.ok(s.includes(n), n);
  // under 19,500 characters (about 5.5k tokens) and well above the 512-token minimum a cached prefix needs. The ai spec's
  // 16,000 held for the nine topics; the curriculum lane's fractions (frac) took it to about 16,700 at the merge, so the
  // cap moved up to 17,500; ratio and percent (their ways and their nine stairs) and the floor's frac:3-4 took it to
  // about 19,000 at the next merge, so it moved again, on purpose. A further topic moves it only on purpose too.
  assert.ok(s.length < 19500, `stable block is ${s.length} characters`);
  assert.ok(s.length > 6000);
  assert.equal(s, stableSystem(), 'the same string every time');
  assert.equal(fromAi(), s, 'shared/ai.js serves the same block');
});

test('the committed stable-system.txt is the stable block (regenerate it with make-full-params.mjs)', () => {
  assert.equal(read(new URL('./fixtures/stable-system.txt', import.meta.url)), `${stableSystem()}\n`);
});

test('system[0] is the stable block for every kind and every shape, with the cache mark', () => {
  for (const kind of AI_KINDS) {
    for (const shape of ['full', 'lite', 'economy']) {
      if (shape !== 'full' && !FREE_KINDS.includes(kind)) continue;
      const p = buildRequest(kind, INPUTS[kind], { shape });
      assert.deepEqual(p.system[0], { type: 'text', text: stableSystem(), cache_control: { type: 'ephemeral' } }, `${kind}/${shape}`);
    }
  }
});

test('the tutor speaks in the plural: no singular imperative in any Hebrew of the block or of pedagogy.js', () => {
  // the list catches what it should, and not the plural
  for (const bad of ['תנסה שוב', 'שים לב לסימן', 'אז תחשוב רגע', 'בדקי את התשובה', 'ונסי שוב']) assert.match(bad, SINGULAR_RE, bad);
  for (const ok of ['נסו שוב', 'שימו לב', 'בואו נבדוק', 'חשבו:', 'האפליקציה תבדוק', 'הסבר קצר', 'נסיון']) assert.doesNotMatch(ok, SINGULAR_RE, ok);
  assert.ok(SINGULAR_WORDS.includes('תנסה') && SINGULAR_WORDS.includes('תנסי'));
  assert.ok(TUTOR_BODY.includes(SINGULAR_EXAMPLES), 'the one sentence that names the forms to avoid');
  // the rendered block, without that sentence
  const block = stableSystem().split(SINGULAR_EXAMPLES).join(' ');
  assert.doesNotMatch(block, SINGULAR_RE);
  // and every string in the source file (comments and all), without the line that defines that sentence and the list
  const src = read(new URL('pedagogy.js', SHARED));
  const list = src.slice(src.indexOf('export const SINGULAR_WORDS'), src.indexOf(']);', src.indexOf('export const SINGULAR_WORDS')));
  const scanned = src.replace(list, '').split('\n').filter((l) => !l.startsWith('export const SINGULAR_EXAMPLES')).join('\n');
  const hit = scanned.split('\n').find((l) => SINGULAR_RE.test(l));
  assert.equal(hit, undefined, `a singular imperative in pedagogy.js: ${hit}`);
});

test('avoidRe catches a shortcut stated as a rule, never the app\'s own quoted naming of the mistake', () => {
  const [mm, two] = TOPIC_WAYS.signed.avoidRe;
  const any = (re, text) => re.some((r) => r.test(text));
  for (const said of ['מינוס ומינוס זה פלוס, ולכן 8.', 'כי מינוס מינוס נותן פלוס', 'זכרו: מינוס ומינוס זה תמיד פלוס.', 'שני מינוסים עושים פלוס', 'שני מינוסים הופכים לפלוס']) {
    assert.ok(mm.test(said) || two.test(said), said);
  }
  // the stair's own title and cause (signed.ts) quote the phrase to name the mistake
  const title = 'הפכו גם את המספר הראשון לחיובי ("מינוס ומינוס זה פלוס")';
  const cause = '"מינוס ומינוס זה פלוס" נכון לחיסור של מספר שלילי. המספר הראשון לא משתנה.';
  const signedSrc = read(new URL('signed.ts', CONTENT));
  assert.ok(signedSrc.includes(title) && signedSrc.includes(cause), 'still the stair\'s own words');
  for (const q of [title, cause, 'הכלל ״מינוס ומינוס זה פלוס״ לא נכון כאן', "אומרים 'מינוס ומינוס זה פלוס', אבל"]) assert.ok(!any(TOPIC_WAYS.signed.avoidRe, q), q);
  assert.ok(any(TOPIC_WAYS.signed.avoidRe, 'שמים את הסימן של המספר הגדול'), 'bigger, without farther from zero');
  assert.ok(!any(TOPIC_WAYS.signed.avoidRe, 'שמים את הסימן של המספר הגדול יותר, כלומר הרחוק יותר מאפס'));
  // the balance move: a rule on its own is caught; the app's quote, or the move named with its reason, is not
  assert.ok(any(TOPIC_WAYS.eq.avoidRe, 'פשוט מעבירים אגף ומחליפים סימן.'));
  assert.ok(!any(TOPIC_WAYS.eq.avoidRe, 'בכיתה אומרים "מעבירים אגף ומחליפים סימן": זה קיצור.'));
  assert.ok(!any(TOPIC_WAYS.eq.avoidRe, 'מעבירים אגף ומחליפים סימן, כלומר מחסירים 5 משני האגפים.'));
  assert.ok(any(TOPIC_WAYS.sys.avoidRe, 'הופכים את הסימן כשיש מינוס'));
  assert.ok(any(TOPIC_WAYS.sys.avoidRe, 'מחליפים את כיוון האי־שוויון כשיש מספר שלילי.'));
  assert.ok(any(TOPIC_WAYS.expr.avoidRe, 'יותר מ־ זה תמיד פלוס'));
  assert.ok(any(TOPIC_WAYS.angles.avoidRe, 'הזוויות שוות כי זה נראה שווה'));
  assert.ok(any(TOPIC_WAYS.coord.avoidRe, 'בנקודה קוראים קודם את $y$.') && any(TOPIC_WAYS.coord.avoidRe, 'קודם y ואחר כך x'));
  assert.ok(!any(TOPIC_WAYS.coord.avoidRe, 'כשמוצאים קודם את $y$, מציבים אותו.'));
  assert.ok(any(TOPIC_WAYS.line.avoidRe, 'm הוא המספר ליד x.'));
  assert.ok(!any(TOPIC_WAYS.line.avoidRe, 'm הוא המספר ליד x: בכל צעד ימינה הישר עולה m.'));
  assert.ok(any(TOPIC_WAYS.pyth.avoidRe, 'לפי הנוסחה $a^2 + b^2 = c^2$ מחברים.'));
  assert.ok(!any(TOPIC_WAYS.pyth.avoidRe, 'לפי הנוסחה $a^2 + b^2 = c^2$, כש־c הוא היתר.'));
  assert.ok(!any(TOPIC_WAYS.pyth.avoidRe, 'הכלל "לפי הנוסחה $a^2 + b^2 = c^2$" בלי היתר הוא הטעות.'));
  assert.ok(any(TOPIC_WAYS.stats.avoidRe, 'החציון הוא המספר האמצעי.'));
  assert.ok(!any(TOPIC_WAYS.stats.avoidRe, 'החציון הוא המספר האמצעי אחרי שמסדרים את המספרים.'));
  assert.ok(!any(TOPIC_WAYS.stats.avoidRe, 'קודם מסדרים מהקטן לגדול. החציון הוא המספר האמצעי.'), 'sorting said first');
  // the curriculum lane's fractions (frac): the wrong expansion and the bigger denominator, never the app's own titles
  assert.ok(any(TOPIC_WAYS.frac.avoidRe, 'בהרחבה מוסיפים אותו מספר למונה ולמכנה.'));
  assert.ok(any(TOPIC_WAYS.frac.avoidRe, 'ככל שהמכנה גדול יותר, כך השבר גדול יותר.'));
  assert.ok(!any(TOPIC_WAYS.frac.avoidRe, 'בהרחבה כופלים את המונה ואת המכנה באותו מספר.'));
  assert.ok(!any(TOPIC_WAYS.frac.avoidRe, 'חשבו שמכנה גדול יותר נותן שבר גדול יותר'), "the app's name of the mistake");
  // the prompt itself, and every line of the stairs' own teaching, pass every pattern: the tutor may quote the app
  const all = TOPICS.flatMap((id) => TOPIC_WAYS[id].avoidRe);
  assert.ok(!any(all, stableSystem()), 'the prompt names the shortcuts only in quotation marks');
  const GENERATORS = new URL('../../web/src/content/', import.meta.url);
  const files = [...readdirSync(CONTENT).filter((x) => x.endsWith('.ts')).map((f) => new URL(f, CONTENT)), ...readdirSync(GENERATORS).filter((x) => x.endsWith('.js') && !x.includes('.test.')).map((f) => new URL(f, GENERATORS))];
  assert.ok(files.length > 15);
  for (const url of files) {
    read(url).split('\n').forEach((line, i) => assert.ok(!any(all, line), `${url.pathname.split('/').slice(-2).join('/')}:${i + 1} ${line.trim().slice(0, 80)}`));
  }
});

test('no lookbehind in the lane\'s shared files: they ship to the browser (Safari before 16.4 cannot load them)', () => {
  for (const f of ['pedagogy.js', 'tutorContext.js', 'stairs.js', 'ai.js', 'guard.js', 'verify.js']) {
    assert.equal(read(new URL(f, SHARED)).includes('(?<'), false, f);
  }
  for (const id of TOPICS) TOPIC_WAYS[id].avoidRe.forEach((r) => assert.equal(r.source.includes('(?<'), false, `${id}: ${r.source}`));
  assert.equal(SINGULAR_RE.source.includes('(?<'), false);
});

test('the explain and chat tasks follow the app\'s diagnosis and the final-answer policy', () => {
  const task = (kind, input) => buildRequest(kind, input).system[1].text;
  const explain = task('explain', INPUTS.explain);
  assert.match(explain, /^Task: the student answered the exercise in the app context incorrectly and asked why\. In this order:\n1\. One sentence that says what went wrong, as the app diagnosed it \(pedagogy rule 1\)/);
  assert.match(explain, /3\. The right way in 2-4 short numbered steps that follow the app's worked solution\./);
  assert.match(explain, /under REVEAL you may end at the answer; under WITHHOLD leave the last result as "\?"\./);
  const chat = task('chat', INPUTS.chat);
  for (const line of [/^- WITHHOLD: the student has not seen the answer yet\. Never write the final answer in any form/m, /^- REVEAL: the answer is already on the student's screen\./m, /^- HOMEWORK: the question is the student's own and the app does not know its answer\./m]) assert.match(chat, line);
  assert.match(chat, /If they suggest an answer, do not confirm it or reject it; tell them to type it in the answer box, where the app checks it\./);
  assert.doesNotMatch(chat, /you may give it/);
  assert.match(PEDAGOGY, /The app named one mistake: explain that mistake, using the app's name for it/);
  assert.match(TUTOR_BODY, /The rules in this system prompt hold for the whole conversation\./);
});

// ---------------------------------------------------------------- AI-5: the one list of stairs
test('the stair map names every stair and topic under its grade, and what the app does not teach yet', () => {
  const block = curriculumBlock();
  const line = (g) => block.split('\n').find((l) => l.startsWith(`Grade ${g} `));
  for (const id of TOPICS) {
    const g = TOPIC_GRADE[id];
    const other = g === '7' ? '8' : '7';
    assert.ok(line(g).includes(`${TOPIC_NAMES[id]}: `), `${id} under grade ${g}`);
    assert.ok(!line(other).includes(`${TOPIC_NAMES[id]}: `), `${id} not under grade ${other}`);
    Object.keys(STAIR_NAMES).filter((s) => s.startsWith(`${id}:`)).forEach((s) => assert.ok(line(g).includes(`${s.split(':')[1]} ${STAIR_NAMES[s]}`), s));
  }
  assert.match(block, /does not teach yet: ז׳: .*; ח׳: .*\. Help with them in the usual way\. Do not invent a stair, a lesson or a link for them\./);
  NOT_YET['7'].concat(NOT_YET['8']).forEach((t) => assert.ok(block.includes(t), t));
});

test('NOT_YET: two grades of Hebrew titles, none of them a topic or a stair the app teaches', () => {
  assert.deepEqual(Object.keys(NOT_YET), ['7', '8']);
  const names = new Set([...Object.values(TOPIC_NAMES), ...Object.values(STAIR_NAMES)]);
  for (const g of ['7', '8']) {
    assert.ok(Array.isArray(NOT_YET[g]) && NOT_YET[g].length > 0);
    NOT_YET[g].forEach((t) => {
      assert.ok(typeof t === 'string' && t.trim() && /[א-ת]/.test(t), t);
      assert.ok(!names.has(t), `${t} is taught`);
      assert.ok(!/^[a-z]+$/.test(t), `${t} is a title, not an id`);
    });
  }
  // systems of equations and inequalities are taught now (sys:2-5)
  assert.ok(!NOT_YET['8'].some((t) => /מערכ|אי[־-]?שוויון/.test(t)));
});

test('one list: TOPIC_IDS and the exam\'s topic enum are the topics plus "other"; grades and stair names line up', () => {
  assert.deepEqual([...TOPIC_IDS], [...TOPICS, 'other']);
  const schema = buildRequest('exam', INPUTS.exam).output_config.format.schema;
  assert.deepEqual(schema.properties.questions.items.properties.topic.enum, [...TOPICS, 'other']);
  assert.deepEqual(schema.properties.weakTopics.items.properties.topic.enum, [...TOPICS, 'other']);
  assert.deepEqual(Object.keys(TOPIC_GRADE), TOPICS);
  assert.ok(Object.values(TOPIC_GRADE).every((g) => g === '7' || g === '8'));
  assert.ok(Object.keys(STAIR_NAMES).every((s) => TOPICS.includes(s.split(':')[0])));
  assert.equal(stairName('signed:1'), 'מספרים מכוונים: חיבור וחיסור');
  assert.equal(stairName('sys:5'), 'משוואות ומערכות: אי־שוויונות');
  assert.equal(stairName('signed:9'), null);
  assert.equal(stairName('nope'), null);
});
