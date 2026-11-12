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

test('the topic ways in Arabic: every topic\'s words, in the order of the Hebrew ones', () => {
  for (const [id, way] of Object.entries(TOPIC_WAYS)) {
    assert.ok(TOPIC_WORDS_AR[id], `${id}: Arabic words`);
    assert.equal(TOPIC_WORDS_AR[id].length, way.words.length, id);
    for (const w of TOPIC_WORDS_AR[id]) assert.ok(!HEBREW.test(w), `${id}: ${w}`);
  }
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

test('the distress detector reads Arabic: suicidal thoughts, self-harm, abuse, threats, bullying, distress', () => {
  const flag = {
    self_harm: ['بدي انتحر', 'أفكّر بالانتحار', 'بدي اموت', 'أريد أن أموت', 'بدي أقتل حالي', 'بجرح حالي كل يوم', 'ما بدي أعيش', 'لا أريد أن أعيش', 'بدي أنام وما أصحى', 'بدي انط من السطح', 'بدي اوخذ كل الحبوب'],
    abuse: ['أبوي بيضربني', 'بخاف من أبوي', 'في واحد بتحرش فيي', 'ما بدي أرجع عالبيت'],
    danger: ['واحد على الانستغرام بدو صور', 'هو بيهددني', 'بيبتزني', 'راح ينشر صوري'],
    bullying: ['كلهم بيكرهوني', 'بيتنمروا علي بالصف'],
    distress: ['أنا حزين كتير', 'ما إلي حدا', 'بدي أهرب من البيت', 'بطلت آكل', 'ببكي كل يوم'],
  };
  for (const [cat, list] of Object.entries(flag)) {
    for (const text of list) assert.deepEqual(detectDistress(text), { flag: true, category: cat }, text);
  }
});

test('Arabic maths does not flag: multiplying, jumping on the line, a line that cuts an axis, laughter', () => {
  for (const text of ['اضربوا العدد في 3', 'كم يساوي 3 ضرب 4؟', 'اقفزوا 3 خطوات على محور الأعداد', 'المستقيم يقطع محور x', 'بدي اموت من الضحك',
    'هذا التمرين صعب', 'حلّوا المعادلة', 'الزاوية الخارجية للمثلث', 'ما فهمت الكسور', 'بدي أتعلم الكسور', 'العدد المعاكس للعدد −3 هو 3']) {
    assert.deepEqual(detectDistress(text), { flag: false, category: null }, text);
  }
});

test('the committed stable-system.ar.txt is the Arabic stable block, for the Arabic reviewer (make-full-params.mjs writes it)', () => {
  assert.equal(readFileSync(new URL('./fixtures/stable-system.ar.txt', import.meta.url), 'utf8'), `${stableSystem('ar')}\n`);
});
