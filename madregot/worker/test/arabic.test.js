// The tutor in the student's language (COUNCIL2-34): an Arabic request gets the Arabic stable block (the language line,
// the safety block with the services' Arabic names, the topic words in Arabic), an Arabic care request and an Arabic
// fixed care reply; a Hebrew request's bytes do not change. And a first Arabic set of the distress detector.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildRequest, buildCare, stableSystem, safetyFor, careStatic } from '../../shared/ai.js';
import { safetyPrompt, CARE_STATIC, SUPPORT } from '../../shared/safety.js';
import { LANGUAGE_AR, TOPIC_WORDS_AR, ARABIC_TERMS, tutorLocale } from '../../shared/arabic.js';
import { TOPIC_WAYS, TUTOR_BODY, TUTOR_BODY_AR } from '../../shared/pedagogy.js';
import { detectDistress } from '../../shared/distress.js';
import { AR_FLAG, AR_CLEAR } from './fixtures/distress-corpus.js';

const HEBREW = /[֐-׿]/;
const chat = (extra = {}) => ({ messages: [{ role: 'user', content: 'ما هو العدد المعاكس؟' }], ...extra });

test('a Hebrew request is exactly what it was: no locale, or locale "he", or anything unknown', () => {
  const plain = buildRequest('chat', chat());
  assert.equal(plain.system[0].text, stableSystem());
  assert.deepEqual(buildRequest('chat', chat({ locale: 'he' })), plain);
  assert.deepEqual(buildRequest('chat', chat({ locale: 'fr' })), plain);
  assert.equal(tutorLocale({ locale: 'xx' }), 'he');
  assert.equal(safetyFor('he'), safetyPrompt());
  assert.equal(safetyFor(undefined), safetyPrompt());
});

test('an Arabic request: the stable block is Arabic in language, one cached prefix of its own, every kind and shape', () => {
  for (const [kind, input] of [['chat', chat()], ['explain', { ctx: { v: 2, mode: 'explain' }, question: '$-3 - (-5)$', studentAnswer: '-8' }]]) {
    for (const shape of ['full', 'lite', 'economy']) {
      const p = buildRequest(kind, { ...input, locale: 'ar' }, { shape });
      assert.equal(p.system[0].text, stableSystem('ar'), `${kind} ${shape}`);
    }
  }
  const ar = stableSystem('ar');
  assert.notEqual(ar, stableSystem());
  assert.ok(ar.includes(LANGUAGE_AR));
  assert.ok(!ar.includes('Language: always answer in Hebrew'));
  assert.equal(TUTOR_BODY_AR.split('\n').length, TUTOR_BODY.split('\n').length, 'only the language line changes');
  for (const [term] of Object.values(ARABIC_TERMS)) assert.ok(ar.includes(term), term);
});

// The main branch's topics that came after the Arabic work (the round-3 merge): their words have no Arabic yet, so an
// Arabic request names them in Hebrew, as the app shows them on an Arabic device (docs/ARABIC.md). A new topic must be
// in one list or the other.
const WORDS_HEBREW_ONLY = ['transf', 'area', 'solid', 'data', 'func', 'circle', 'congr', 'sim', 'prob', 'space'];
// a topic whose Hebrew list grew after the Arabic work: its first words have Arabic, the rest stay Hebrew (stats: the
// range, the data source, interpolation and extrapolation of the data unit's stats:6-8)
const WORDS_ARABIC_FIRST = { stats: 4 };

test('the topic ways in Arabic: every topic\'s words, in the order of the Hebrew ones', () => {
  for (const [id, way] of Object.entries(TOPIC_WAYS)) {
    if (WORDS_HEBREW_ONLY.includes(id)) {
      assert.equal(TOPIC_WORDS_AR[id], undefined, `${id}: has Arabic words now, so it leaves WORDS_HEBREW_ONLY`);
      // the fallback: the Hebrew words as they are, never an empty or half-Arabic list
      assert.ok(stableSystem('ar').includes(`Words the app uses: ${way.words.join(', ')}.`), `${id}: Hebrew words`);
      continue;
    }
    assert.ok(TOPIC_WORDS_AR[id], `${id}: Arabic words`);
    assert.equal(TOPIC_WORDS_AR[id].length, WORDS_ARABIC_FIRST[id] ?? way.words.length, id);
    for (const w of TOPIC_WORDS_AR[id]) assert.ok(!HEBREW.test(w), `${id}: ${w}`);
    for (const he of way.words.slice(TOPIC_WORDS_AR[id].length)) assert.ok(!stableSystem('ar').includes(`${he} (${he})`), `${id}: ${he} once`);
  }
  assert.ok(stableSystem('ar').includes('المدى') === false && stableSystem('ar').includes('טווח, מקור מידע'), 'stats: the new words in Hebrew, once');
  assert.ok(stableSystem('ar').includes('محور الأعداد (ציר המספרים)'));
});

test('the safety block in Arabic: the same rules, Arabic answer, the services by their Arabic names and the same numbers', () => {
  const ar = safetyFor('ar');
  assert.ok(!HEBREW.test(ar), 'no Hebrew left in the Arabic safety block');
  assert.ok(ar.startsWith('Safety comes before mathematics, always.'));
  assert.ok(ar.includes('Answer in warm, simple Arabic'));
  for (const n of [SUPPORT.eran.phone, SUPPORT.eran.whatsapp, SUPPORT.sahar.whatsapp, SUPPORT.online.phone, SUPPORT.police, SUPPORT.mda]) assert.ok(ar.includes(n), n);
  assert.ok(ar.includes('عيران') && ar.includes('الشرطة') && ar.includes('الإسعاف'));
  assert.equal(ar.split('\n').length, safetyPrompt().split('\n').length, 'line for line');
  assert.ok(stableSystem('ar').startsWith(ar), 'the Arabic stable block starts with the Arabic safety block');
  const care = buildCare(chat({ locale: 'ar' }));
  assert.ok(care.system.startsWith(ar));
});

test('the fixed care reply in Arabic: no AI, the same numbers, calm', () => {
  const ar = careStatic('ar');
  assert.ok(!HEBREW.test(ar));
  for (const n of ['1201', SUPPORT.police, SUPPORT.mda]) assert.ok(ar.includes(n), n);
  assert.equal(careStatic('he'), CARE_STATIC);
  assert.equal(careStatic(undefined), CARE_STATIC);
  assert.doesNotMatch(ar, /!/);
});

test('the distress detector reads Arabic: suicidal thoughts, self-harm, abuse, threats, bullying, distress, in masculine, feminine and plural forms', () => {
  // the phrases are in test/fixtures/distress-corpus.js (the counsellor's sheet is made from them); the review's probe
  // missed 8 of 18: only the masculine "بيضربني" was matched, and none of the feminine or plural forms
  assert.deepEqual(Object.keys(AR_FLAG), ['self_harm', 'abuse', 'danger', 'bullying', 'distress']);
  assert.ok(Object.values(AR_FLAG).flat().length >= 45);
  for (const [cat, list] of Object.entries(AR_FLAG)) {
    for (const text of list) assert.deepEqual(detectDistress(text), { flag: true, category: cat }, text);
  }
  for (const probe of ['امي بتضربني كل يوم', 'هم بيضربوني', 'عمي بلمسني', 'تعبت من الحياة', 'زهقت من حياتي', 'بخاف ارجع عالبيت']) assert.ok(Object.values(AR_FLAG).flat().includes(probe), probe);
});

test('Arabic maths does not flag: multiplying, jumping on the line, a line that cuts an axis, laughter, a unique solution and a bag of tablets', () => {
  assert.ok(AR_CLEAR.length >= 20);
  for (const text of AR_CLEAR) assert.deepEqual(detectDistress(text), { flag: false, category: null }, text);
  for (const probe of ['للمعادلة حل وحيد', 'بدي اوخذ كل الحبوب من الكيس، ما الاحتمال؟', 'احمد ما باكل تفاح، كم تفاحة بقيت؟']) assert.ok(AR_CLEAR.includes(probe), probe);
});

test('the committed stable-system.ar.txt is the Arabic stable block, for the Arabic reviewer (make-full-params.mjs writes it)', () => {
  assert.equal(readFileSync(new URL('./fixtures/stable-system.ar.txt', import.meta.url), 'utf8'), `${stableSystem('ar')}\n`);
});
