// The topics as every screen of the first load knows them (the boot split, QA_DURABLE.md): names, grades, colours,
// stairs and their titles and misconception names (content/topics.gen.js, generated from the grade files), the rows
// the teacher's screens list, and the loading of each topic's exercise generators. Nothing here makes or checks a
// question: that is content/index.js (which re-exports this file), with the checkers and content/manip.js, and it
// loads with the exercise screens. The map, the path, the store, Topics, the programme page, onboarding, Me and the
// parents' and teacher's shells import this file, never content/index.js. A topic's lesson summary is not here either:
// only its guide page shows it, and reads it from content/lessons.js (lessonOf).
// the topics without their exercise generators (generated from grade7.js and grade8.js by scripts/gen-content-meta.mjs):
// the map, the path and every screen that only names topics and stairs read these; the generators load per topic
// (loadGens, below)
import { TOPIC_META } from './topics.gen.js';

// the meta, not the content: a topic's teaching loads on demand (learn/content/index.ts)
import { NEW_CATS, META } from '@/learn/content/meta.gen.ts';
import { GUEST, ALSO_ON_PATH, onGradePath } from '@/learn/skills.ts';
import { monthIndex, schoolMonth } from '@shared/coverage.js';
import { onLocaleChange, locale, t as tr } from '@/lib/i18n.js';
// the Arabic topics (COUNCIL2-34): their names and exercises when the app is in Arabic (only in a build made with
// VITE_ARABIC=on; content/arabic.js ARABIC_TOPICS lists them)
import { contentLang, hasArabic, arabicTopic } from './arabic.js';

/**
 * A copy of plain data, so a topic's functions can be put on its own objects once they load (TOPIC_META stays as written).
 * @template T
 * @param {T} v
 * @returns {T}
 */
const copy = (v) => (Array.isArray(v) ? v.map(copy) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)])) : v);

// Each topic's misconception names include those the 2.0 teaching content adds. Every topic is a fresh copy, so a
// topic's generators can be put on its stairs once they have loaded (loadGens).
export const TOPICS = TOPIC_META.map((t) => ({ ...copy(t), cats: { ...t.cats, ...(NEW_CATS[t.id] || {}) } }));
export const TOPIC = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/**
 * The topics' words in the language on screen (COUNCIL2-34): an Arabic topic's title, description, stair titles and
 * misconception names in Arabic, every other topic's in Hebrew. The same objects, so every screen that holds TOPIC
 * reads the new words when it draws again (content/arabic.js puts NEW_CATS in place first). A topic's functions stay.
 */
function applyTopicWords() {
  TOPIC_META.forEach((he, i) => {
    const t = TOPICS[i];
    const src = arabicTopic(he.id) || he;
    for (const [k, v] of Object.entries(src)) if (k !== 'levels' && k !== 'cats') t[k] = copy(v);
    src.levels.forEach((L, j) => { for (const [k, v] of Object.entries(L)) if (typeof v !== 'function') t.levels[j][k] = copy(v); });
    t.cats = { ...src.cats, ...(NEW_CATS[t.id] || {}) };
  });
}
onLocaleChange(applyTopicWords);
// a module loaded after the language was set (a test, a later chunk) starts in it too
if (locale() !== 'he') applyTopicWords();

// ---------------------------------------------------------------- the exercise generators, loaded per topic
// The first load carries the topics' names, colours, stairs and misconception names (topics.gen.js), not their
// generators: each stair's gen (and any other function a topic has) loads with the topic, one dynamic import per topic
// file, so the build makes one file per topic file. grade7.js holds signed, coord and angles (and imports the transf,
// expr, area, solid, eq, data and frac files and signed's sixth stair), grade8.js pyth and stats (and imports linear,
// sys, ratio, pct, func, circle, congr, sim, space, prob and stats' stairs 6-8 in stats2.js). A topic with no case here loads its grade's file, which holds every topic
// of the grade: correct, only larger. A topic in a file of its own adds its case (scripts/gen-content-meta.mjs
// regenerates topics.gen.js from the grade lists).
// learn/content/index.ts ensureTopics waits for a topic's generators together with its teaching, so a lesson, a check,
// the placement test, Exam Rescue, the assistant's exercises, the practice exam and the teacher's class exam have them
// before their first question; App.jsx and the map fetch the likely next topic's when the browser is idle.
function importGens(topic, lang = 'he') {
  // an Arabic topic's generators (COUNCIL2-34): the Arabic twin of its file (scripts/gen-arabic.mjs), one case per topic
  // of content/arabic.js ARABIC_TOPICS (learn/arabic.test.ts holds the list). Only in a build that has Arabic
  // (VITE_ARABIC=on, lib/i18n.js): any other build carries none of these files. No topic has its Arabic now (see
  // content/arabic.js), so every topic loads its Hebrew file.
  if (import.meta.env.VITE_ARABIC === 'on' && lang === 'ar') {
    switch (topic) {
      default: return Promise.reject(new Error(`content: no Arabic generators for ${topic}`));
    }
  }
  switch (topic) {
    case 'expr': return import('./expr.js').then((m) => [m.EXPR]);
    case 'eq': return import('./eq.js').then((m) => [m.EQ]);
    case 'frac': return import('./frac.js').then((m) => [m.FRAC]);
    case 'line': return import('./linear.js').then((m) => [m.LINEAR]);
    case 'sys': return import('./sys.js').then((m) => [m.SYS]);
    case 'ratio': return import('./ratio.js').then((m) => [m.RATIO]);
    case 'pct': return import('./pct.js').then((m) => [m.PCT]);
    case 'func': return import('./func.js').then((m) => [m.FUNC]);
    case 'data': return import('./data.js').then((m) => [m.DATA]);
    case 'prob': return import('./prob.js').then((m) => [m.PROB]);
    // stage 2's measurement units (space.js builds on circle.js, and all of them on area.js's helpers)
    case 'area': return import('./area.js').then((m) => [m.AREA]);
    case 'solid': return import('./solid.js').then((m) => [m.SOLID]);
    case 'circle': return import('./circle.js').then((m) => [m.CIRCLE]);
    case 'space': return import('./space.js').then((m) => [m.SPACE]);
    // stage 4's geometry units: each topic file puts its generators (transf.gen.js, congr.gen.js, sim.gen.js; the last
    // two with the proof templates, proofs.js) on its stairs
    case 'transf': return import('./transf.js').then((m) => [m.TRANSF]);
    case 'congr': return import('./congr.js').then((m) => [m.CONGR]);
    case 'sim': return import('./sim.js').then((m) => [m.SIM]);
    default: return TOPIC[topic]?.grade === '8' ? import('./grade8.js').then((m) => m.GRADE8) : import('./grade7.js').then((m) => m.GRADE7);
  }
}

/**
 * Put every function of a loaded topic (its stairs' gen, and any other) on the same place of the topic in TOPICS. The
 * rest of the topic is the meta already (a stale topics.gen.js, with stairs added or removed, is an error that says so).
 */
function attachFns(into, from, at) {
  if (Array.isArray(from) && (!Array.isArray(into) || into.length !== from.length)) throw new Error(`${at}: ${from.length} in its file, ${Array.isArray(into) ? into.length : 'none'} in topics.gen.js (run node scripts/gen-content-meta.mjs)`);
  for (const [k, v] of Object.entries(from)) {
    if (typeof v === 'function') into[k] = v;
    else if (v && typeof v === 'object' && into[k] && typeof into[k] === 'object') attachFns(into[k], v, `${at}.${k}`);
  }
}
// each language's loaded topics, by id (an Arabic topic has both: the device can change language)
const gensBy = { he: new Map(), ar: new Map() };
const gensAsked = new Map();
/** Put the functions of the language on screen on a topic (an Arabic topic keeps its Hebrew ones until its Arabic come). */
function applyGens(id) {
  const fns = gensBy[contentLang(id)].get(id) || gensBy.he.get(id);
  if (fns) attachFns(TOPIC[id], fns, id);
}
/** Keep a loaded topic's functions (every topic of a file that loaded: they came with it; an Arabic file's Arabic topics). */
function attachGens(full, lang) {
  const t = TOPIC[full?.id];
  if (!t || gensBy[lang].has(t.id) || (lang === 'ar' && !hasArabic(t.id))) return;
  const { cats, lesson, ...rest } = full; // plain data: TOPICS merged its own names into cats, and the lesson summary is the guide page's (content/lessons.js)
  gensBy[lang].set(t.id, rest);
  applyGens(t.id);
}
onLocaleChange(() => { for (const t of TOPICS) applyGens(t.id); });
/** Have this topic's generators, in the language on screen, loaded? (An id the app does not know has none to wait for.) */
export const gensReady = (topic) => !TOPIC[topic] || gensBy[contentLang(topic)].has(topic);
/**
 * Load a topic's exercise generators in the language on screen, once (a file that failed to load, offline before it
 * was ever kept, can be asked for again). An unknown id resolves at once: it has none.
 */
export function loadGens(topic) {
  if (gensReady(topic)) return Promise.resolve();
  const lang = contentLang(topic);
  const key = `${lang}:${topic}`;
  let p = gensAsked.get(key);
  if (!p) {
    const q = importGens(topic, lang).then((list) => {
      for (const full of list) attachGens(full, lang);
      if (!gensBy[lang].has(topic)) throw new Error(`content: no generators for ${topic}`);
    });
    q.catch(() => { if (gensAsked.get(key) === q) gensAsked.delete(key); });
    gensAsked.set(key, q);
    p = q;
  }
  return p;
}
/**
 * The generators of these topics or skills ('eq', 'eq:6'), and nothing else: the practice exam and the teacher's class
 * exam draw only generator questions, so they wait for this rather than for the topics' teaching (ensureTopics).
 */
export const ensureGens = (ids) => Promise.all([...new Set((ids || []).filter(Boolean).map((id) => String(id).split(':')[0]))].map(loadGens)).then(() => undefined);
/** Every topic's generators (tests, and tools that make exercises of every topic). */
export const loadAllGens = () => Promise.all(TOPICS.map((t) => loadGens(t.id))).then(() => undefined);

/**
 * A grade's units, in order: its own, and a unit also climbed in it this school year (learn/skills.ts ALSO_ON_PATH)
 * right after the unit named there (at the end when that one is not on the path). A bridge unit (bridge: true, the
 * fractions floor) is not one of them. `also`: another table, for tests.
 */
export const topicsFor = (grade, also = ALSO_ON_PATH) => {
  const g = String(grade); const out = TOPICS.filter((t) => t.grade === g && !t.bridge);
  TOPICS.filter((t) => !t.bridge && t.grade !== g && also[t.id]?.grade === g).forEach((t) => {
    const i = out.findIndex((x) => x.id === also[t.id].after); out.splice(i < 0 ? out.length : i + 1, 0, t);
  });
  return out;
};
/**
 * A unit's number on a viewer's path ("יחידה 3"): among the viewer's grade's units when it is on that path (a unit also
 * climbed in ח׳ this year is numbered there as ח׳ meets it), else among its own grade's; 0 for the fractions floor.
 */
export const unitNumber = (t, viewerGrade, also = ALSO_ON_PATH) => (!t ? 0 : (viewerGrade ? topicsFor(viewerGrade, also).indexOf(t) + 1 : 0) || topicsFor(t.grade, also).indexOf(t) + 1);
/** Is a unit revision for this grade (filed under an earlier grade and not on this grade's path), labelled "מכיתה ז׳"? */
export const earlierUnit = (t, grade, also = ALSO_ON_PATH) => Number(t.grade) < Number(grade) && !onGradePath(t.id, String(grade), also);
/** The grade a student meets a unit in: their own when the unit is on their path, else the unit's (the tutor is told it). */
export const unitGrade = (t, grade, also = ALSO_ON_PATH) => (grade && t && onGradePath(t.id, String(grade), also) ? String(grade) : t?.grade);
/** The bridge units under a grade: of that grade, or with it in alsoFor (the floor; shown only when it is switched on). */
export const bridgeTopicsFor = (grade) => TOPICS.filter((t) => t.bridge && (t.grade === String(grade) || (t.alsoFor || []).includes(String(grade))));
/**
 * The first school month (September 0 … June 9) in which a grade's programme (shared/programme.js) teaches one of a
 * topic's stairs; null when it teaches none. A unit the grade climbs through guest stairs (learn/skills.ts GUEST,
 * stage5.md FUNC-6: ח׳'s eq:6 and eq:7) never joins that grade's path: the guest stairs are offered one by one from the
 * banner, and the rest of the unit is the earlier grade's, revised whole in Exam Rescue (rescueTopicsFor), so a ח׳
 * student is never sent back a year.
 */
export const joinMonth = (t, grade) => {
  const g = String(grade);
  if ((GUEST[g] || []).some((id) => id.startsWith(`${t.id}:`))) return null;
  const ms = t.levels.map((_, i) => monthIndex(`${t.id}:${i + 1}`, g)).filter((m) => m != null);
  return ms.length ? Math.min(...ms) : null;
};
/**
 * A grade's path in a school month (the map, the plan and Topics): its units (topicsFor: its own, with a unit of the
 * other grade climbed in it this year, ALSO_ON_PATH, in its place), then the units of the other grade it has in alsoFor,
 * each from the month the grade's programme first teaches one of its stairs (a month-aware alsoFor, PRODUCT2-20). So
 * every hour the coverage counts for a grade is on that grade's path when the school teaches it: ז׳ meets Pythagoras
 * from December, the mode from January and a table of values in May; ח׳ the angles unit from September (angles between
 * parallels, 8.3). A unit stays filed under its own grade (GRADE_OF, its placement test). A unit climbed through guest
 * stairs (skills.ts GUEST: ח׳'s equations, 8.9) does not join (joinMonth): its guest stairs are the grade's, and the
 * rest is revised in Exam Rescue.
 */
export const pathTopicsFor = (grade, month = schoolMonth(), also = ALSO_ON_PATH) => {
  const g = String(grade); const own = topicsFor(g, also);
  return [...own, ...TOPICS.filter((t) => !t.bridge && !own.includes(t) && t.grade !== g && (t.alsoFor || []).includes(g)
    && (joinMonth(t, g) ?? Infinity) <= month)];
};
/** The five colour families of the units (canon.css .ch-*). */
export const UNIT_COLOURS = ['sky', 'petrol', 'violet', 'fuchsia', 'cobalt'];
/**
 * The colour each unit of a path shows, by topic id: its own, unless it would sit beside the same colour. A grade's own
 * units never do (content.test.js); a unit joined from the other grade then takes the first family colour that neither
 * neighbour has, so two banners side by side always differ (STUDENT-1).
 */
export function pathColours(list) {
  const out = list.map((t) => t.color);
  for (let i = 1; i < list.length; i += 1) {
    if (out[i] !== out[i - 1]) continue;
    out[i] = UNIT_COLOURS.find((c) => c !== out[i - 1] && c !== list[i + 1]?.color) || out[i];
  }
  return Object.fromEntries(list.map((t, i) => [t.id, out[i]]));
}
/**
 * Two optional flags a topic may carry:
 *   placement: false   the first-day placement test skips it (it is taught later in the school year, so a new student
 *                      would only meet questions never taught); it starts at stair 1, and the unit jump test is there
 *                      for a student who already knows it
 *   placement: 'taught'  the first-day test asks it once the school calendar has taught it: when the student starts
 *                      after the month its first stair is taught in (shared/programme.js). ח׳ ratio (September) and
 *                      percent (October) are taught at the very start of the year (PRODUCT2-19)
 *   alsoFor: ['8']     Exam Rescue (and the exam check's topic list) offers it to that grade too: a grade 8 test can
 *                      revise grade 7 equations, and grade 7 learns Pythagoras in March though the app files it in grade 8;
 *                      a later grade's unit with guest stairs is offered through them alone (rescueTopicsFor); and once
 *                      that grade's programme teaches one of its stairs, it joins that grade's path (pathTopicsFor)
 */
export const placementTopicsFor = (grade, month = schoolMonth()) => topicsFor(grade).filter((t) => t.placement !== false
  && (t.placement !== 'taught' || taughtBefore(t.id, grade, month)));
/** Was a topic's first stair taught in a school month before `month` (September 0 … June 9; the summer counts as 9)? */
const taughtBefore = (topic, grade, month) => { const m = monthIndex(`${topic}:1`, String(grade)); return m != null && month > m; };

/**
 * A grade's guest rows (stage5.md FUNC-6): each unit with a guest stair of that grade (learn/skills.ts GUEST), once, as a
 * copy carrying `only:` its guest stairs, in GUEST's order. ח׳: eq with eq:6 and eq:7; ז׳: func with func:1. A teacher's
 * screens list them after the grade's units, each showing only its `only` stairs.
 */
export const guestTopicsFor = (grade) => {
  const ids = GUEST[String(grade)] || [];
  return [...new Set(ids.map((id) => id.split(':')[0]))].filter((id) => TOPIC[id]).map((id) => ({ ...TOPIC[id], only: ids.filter((s) => s.startsWith(`${id}:`)) }));
};
/** What a teacher's screens list for a class of a grade: its units, then its guest rows. */
export const classTopicsFor = (grade) => [...topicsFor(grade), ...guestTopicsFor(grade)];
/** The stairs a row shows, [{ id, level, title }]: every stair of a unit, or a guest row's `only` ones (levels as titles or { title }). */
export const rowStairs = (t) => t.levels.map((l, i) => ({ id: `${t.id}:${i + 1}`, level: i + 1, title: typeof l === 'string' ? l : l.title }))
  .filter((s) => !t.only || t.only.includes(s.id));
/** A row's name: the unit's title, and on a guest row which of its stairs ("משוואות: מדרגות 6–7"). */
export function rowTitle(t) {
  if (!t.only) return t.title;
  const ls = rowStairs(t).map((s) => s.level);
  const run = ls.every((n, i) => !i || n === ls[i - 1] + 1);
  const nums = ls.length === 1 ? `${ls[0]}` : run ? `${ls[0]}–${ls.at(-1)}` : ls.join(', ');
  return `${t.title}: ${ls.length === 1 ? 'מדרגה' : 'מדרגות'} ${nums}`;
}
/**
 * A guest stair's state as the class sync sends it (lib/path.js guestStairLevels): under the stair's own id ("eq:6") in
 * the levels object, beside the units' { level, max }, with level 1 practised and 2 mastered now (the server keeps the
 * highest max). A guest row reads only these, never its unit's level: a ח׳ student's eq level says nothing about eq:6,
 * and a ז׳ student's func level cannot tell func:1 opened from func:1 mastered.
 */
export const GUEST_STATE = Object.freeze({ practised: 1, mastered: 2 });
/**
 * A student's place on a row, from the levels the class sync sends ({ [unit]: { level, max }, [guest stair]: state }):
 * on a unit, its { level, max } as is; on a guest row, from each of its own stairs' states. { total, level, max, title }:
 * the stair at that place; a guest row adds `states` (each stair 'done', 'cur' or 'todo', for LevelPips) and `done`
 * (every stair of the row mastered). null when the student has nothing on the row.
 */
export function rowLevel(t, levels) {
  const ls = rowStairs(t);
  if (!t.only) {
    const l = levels?.[t.id];
    return l ? { total: ls.length, level: l.level, max: l.max, title: ls[l.level - 1]?.title || '' } : null;
  }
  const st = ls.map((s) => { const v = levels?.[s.id]; return !v ? null : Number(v.level) >= GUEST_STATE.mastered ? 'mastered' : 'practised'; });
  if (st.every((x) => !x)) return null;
  const done = st.every((x) => x === 'mastered');
  // the stair being worked on: the first one practised and not mastered, else the first not mastered
  const k = done ? ls.length - 1 : st.includes('practised') ? st.indexOf('practised') : st.findIndex((x) => x !== 'mastered');
  const states = st.map((x, i) => (x === 'mastered' ? 'done' : i === k ? 'cur' : 'todo'));
  return { total: ls.length, level: k + 1, max: Math.max(k + 1, st.lastIndexOf('mastered') + 1), title: ls[k].title, states, done };
}
/** A place on a row in a table cell: "1/2", or on a guest row whose stairs are all mastered "הושלם". */
export const rowLevelText = (r) => (!r ? '–' : r.done ? 'הושלם' : `${r.level}/${r.total}`);
/**
 * The topics Exam Rescue offers a grade: those on its path (topicsFor, with a unit also climbed in it this year), then
 * those of another grade that are revised in it (alsoFor; no bridge unit), each once. An earlier grade's unit is revised
 * whole (a ח׳ test can revise all of the ז׳ equations unit); a later grade's unit is offered through its guest stairs
 * alone when it has any (a ז׳ student who picks "מבוא לפונקציות" gets func:1, the part of it ז׳ learns).
 */
export const rescueTopicsFor = (grade, also = ALSO_ON_PATH) => {
  const g = String(grade);
  const own = topicsFor(g, also);
  const guest = Object.fromEntries(guestTopicsFor(g).map((t) => [t.id, t]));
  const other = TOPICS.filter((t) => !t.bridge && !own.includes(t) && t.grade !== g && (t.alsoFor || []).includes(g))
    .map((t) => (guest[t.id] && Number(t.grade) > Number(g) ? guest[t.id] : t));
  return [...own, ...other];
};

/**
 * The words for a mistake on one stair: the stair's own misconception when it has one (one id can mean different
 * things on different stairs, e.g. 'sign' is a negative length on coord:3), else the topic's name for it.
 */
export function catLabel(topicId, level, cat) {
  if (!cat) return null;
  const own = META[`${topicId}:${level}`]?.misconceptions.find((m) => m.id === cat);
  return own?.title || TOPIC[topicId]?.cats[cat] || null;
}

/**
 * An answer two misconceptions both explain: name them, and say how the lesson will tell them apart. Three or more are
 * not listed (a long "maybe this, maybe that" helps no one): one short sentence says the answer fits several mistakes.
 * `more`: the lesson will ask one more question that tells them apart (lib/lesson.js); without one, the line only
 * names them. Only a question that shows a number line can name a move on it ('direction'), so a typed question's line
 * never speaks of the line.
 */
export function ambiguousText(topic, level, candidates, more = true) {
  const names = (candidates || []).map((c) => catLabel(topic, level, c.id)).filter(Boolean);
  // the words are the language's (COUNCIL2-34, locales/shell.*.json)
  const then = more ? ` ${tr('shell.content.ambiguousOne')}` : '';
  if (names.length === 2) return `${tr('shell.content.ambiguous', { a: names[0], b: names[1] })}${then}`;
  if (names.length > 2) return `${tr('shell.content.ambiguousMany')}${then}`;
  return more ? then.trim() : null;
}

/**
 * The line a lesson shows under a first miss, from the answer's result ({ cat, diagnosis, more }): the app's name for
 * the mistake ("מה כנראה קרה: …."), the candidates of an ambiguous answer, or null. `more: false` when no question at the
 * end of the lesson will tell the candidates apart (lib/lesson.js; the AI practice screen has none). The screen and the
 * tutor's context read it from here, so the tutor is told exactly what the student saw (ai spec AI-1 Design 4).
 */
export function diagnosisLine(topic, level, result) {
  if (!result) return null;
  if (result.diagnosis?.ambiguous) return ambiguousText(topic, level, result.diagnosis.candidates, result.more !== false);
  const label = catLabel(topic, level, result.cat);
  return label ? tr('shell.content.whatHappened', { label }) : null;
}

export const COLORS = ['sky', 'fuchsia', 'petrol', 'cobalt', 'violet'];
