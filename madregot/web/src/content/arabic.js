// The teaching content in Arabic (COUNCIL2-34). A topic is in Arabic whole or not at all: its teaching
// (learn/content/<topic>.ar.ts), its exercises (content/grade7.ar.js), its challenge tasks, its lesson summary and its
// names on the map, all made by scripts/gen-arabic.mjs from the Hebrew files and the translations in
// content/ar/grade7.json. On an Arabic device a topic of ARABIC_TOPICS shows its Arabic; every other topic keeps its
// Hebrew until its translation is in (docs/ARABIC.md says which come next). A Hebrew device loads none of this.
//
// The names (stair titles, misconception names, topic titles, challenge titles) are in the first download in Hebrew,
// in objects every screen reads (META, NEW_CATS, CHALLENGE_META, TOPICS). Their Arabic twins come with the Arabic
// catalogue (addLocaleLoader), and on every change of language the words are put in place in those same objects
// (onLocaleChange), before the screens draw again. content/index.js does the same for TOPICS, after this module.
import { addLocaleLoader, onLocaleChange, locale } from '@/lib/i18n.js';
import { META, NEW_CATS } from '@/learn/content/meta.gen.ts';
import { CHALLENGE_META } from '@/learn/challenges/meta.gen.ts';

/** The topics taught in Arabic. A topic joins once its teaching, exercises and challenges all have Arabic. */
export const ARABIC_TOPICS = Object.freeze(['signed']);
/** Does this topic (or skill, or challenge id: 'signed:1', 'signed:c1') have its Arabic? */
export const hasArabic = (id) => ARABIC_TOPICS.includes(String(id || '').split(':')[0]);
/** The language a topic's content shows in now: Arabic when the app is in Arabic and the topic has it, else Hebrew. */
export const contentLang = (id) => (locale() === 'ar' && hasArabic(id) ? 'ar' : 'he');

/** Each Arabic topic's challenge tasks (they come with the Arabic catalogue: the challenge screens read them at once). */
const ARABIC_CHALLENGES = {
  signed: () => import('@/learn/challenges/signed.ar.ts').then((m) => m.SIGNED_CHALLENGES),
};

const HE = { meta: { ...META }, cats: { ...NEW_CATS }, challengeTitles: CHALLENGE_META.map((c) => c.title) };
/** The Arabic twins, once fetched: { meta, cats, topics, lessons, challengeMeta, tasks }. */
let AR = null;

addLocaleLoader('ar', () => Promise.all([
  import('@/learn/content/meta.gen.ar.ts'), import('@/content/topics.gen.ar.js'), import('@/learn/challenges/meta.gen.ar.ts'),
  import('@/content/lessons.ar.js'), Promise.all(ARABIC_TOPICS.map((t) => ARABIC_CHALLENGES[t]())),
]).then(([m, tp, ch, ls, tasks]) => {
  AR = {
    meta: m.META, cats: m.NEW_CATS, topics: Object.fromEntries(tp.TOPIC_META.map((t) => [t.id, t])), lessons: ls.LESSONS,
    challengeMeta: Object.fromEntries(ch.CHALLENGE_META.map((c) => [c.id, c])), tasks: Object.fromEntries(tasks.flat().map((c) => [c.id, c])),
  };
}));

/** The Arabic of a topic's entry in topics.gen.js and of its lesson summary, when it shows in Arabic now (else null). */
export const arabicTopic = (id) => (AR && contentLang(id) === 'ar' ? AR.topics[id] || null : null);
export const arabicLesson = (id) => (AR && contentLang(id) === 'ar' ? AR.lessons[id] || null : null);
/** A challenge task in Arabic, when its topic shows in Arabic now (else null: the Hebrew task). */
export const arabicChallenge = (id) => (AR && contentLang(id) === 'ar' ? AR.tasks[id] || null : null);

/** Put the names of the language on screen in the shared objects (stairs, misconceptions, challenge titles). */
function applyNames() {
  for (const skill of Object.keys(HE.meta)) META[skill] = (AR && contentLang(skill) === 'ar' && AR.meta[skill]) || HE.meta[skill];
  for (const topic of Object.keys(HE.cats)) NEW_CATS[topic] = (AR && contentLang(topic) === 'ar' && AR.cats[topic]) || HE.cats[topic];
  CHALLENGE_META.forEach((c, i) => { c.title = (AR && contentLang(c.id) === 'ar' && AR.challengeMeta[c.id]?.title) || HE.challengeTitles[i]; });
}
onLocaleChange(applyNames);
