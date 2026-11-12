// The topics as every screen of the first load knows them (the boot split, QA_DURABLE.md): names, grades, colours,
// stairs and their titles, misconception names and lesson summaries (content/topics.gen.js, generated from the grade
// files), the rows the teacher's screens list, and the loading of each topic's exercise generators. Nothing here makes
// or checks a question: that is content/index.js (which re-exports this file), with the checkers and content/manip.js,
// and it loads with the exercise screens. The map, the path, the store, Topics, the programme page, onboarding, Me and
// the parents' and teacher's shells import this file, never content/index.js.
import { LESSONS } from './lessons.js';
// the topics without their exercise generators (generated from grade7.js and grade8.js by scripts/gen-content-meta.mjs):
// the map, the path and every screen that only names topics and stairs read these; the generators load per topic
// (loadGens, below)
import { TOPIC_META } from './topics.gen.js';

// the meta, not the content: a topic's teaching loads on demand (learn/content/index.ts)
import { NEW_CATS, META } from '@/learn/content/meta.gen.ts';
import { GUEST, ALSO_ON_PATH, onGradePath } from '@/learn/skills.ts';

/**
 * A copy of plain data, so a topic's functions can be put on its own objects once they load (TOPIC_META stays as written).
 * @template T
 * @param {T} v
 * @returns {T}
 */
const copy = (v) => (Array.isArray(v) ? v.map(copy) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)])) : v);

// Each topic's misconception names include those the 2.0 teaching content adds. Every topic is a fresh copy, so a
// topic's generators can be put on its stairs once they have loaded (loadGens).
export const TOPICS = TOPIC_META.map((t) => ({ ...copy(t), cats: { ...t.cats, ...(NEW_CATS[t.id] || {}) }, lesson: t.lesson || LESSONS[t.id] || null }));
export const TOPIC = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

// ---------------------------------------------------------------- the exercise generators, loaded per topic
// The first load carries the topics' names, colours, stairs and misconception names (topics.gen.js), not their
// generators: each stair's gen (and any other function a topic has) loads with the topic, one dynamic import per topic
// file, so the build makes one file per topic file. grade7.js holds signed, coord and angles (and imports the expr, eq,
// data and frac files and signed's sixth stair), grade8.js pyth and stats (and imports linear, sys, ratio, pct, func,
// prob and stats' stairs 6-8 in stats2.js). A topic with no case here loads its grade's file, which holds every topic
// of the grade: correct, only larger. A topic in a file of its own adds its case (scripts/gen-content-meta.mjs
// regenerates topics.gen.js from the grade lists).
// learn/content/index.ts ensureTopics waits for a topic's generators together with its teaching, so a lesson, a check,
// the placement test, Exam Rescue, the assistant's exercises, the practice exam and the teacher's class exam have them
// before their first question; App.jsx and the map fetch the likely next topic's when the browser is idle.
function importGens(topic) {
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
const gensLoaded = new Set();
const gensAsked = new Map();
/** Put a loaded topic's functions on its topic (every topic of a file that loaded: they came with it). */
function attachGens(full) {
  const t = TOPIC[full?.id];
  if (!t || gensLoaded.has(t.id)) return;
  const { cats, lesson, ...rest } = full; // cats and lesson are plain data, and TOPICS merged its own into them
  attachFns(t, rest, t.id);
  gensLoaded.add(t.id);
}
/** Have this topic's generators loaded? (An id the app does not know has none to wait for.) */
export const gensReady = (topic) => gensLoaded.has(topic) || !TOPIC[topic];
/**
 * Load a topic's exercise generators, once (a file that failed to load, offline before it was ever kept, can be asked
 * for again). An unknown id resolves at once: it has none.
 */
export function loadGens(topic) {
  if (gensReady(topic)) return Promise.resolve();
  let p = gensAsked.get(topic);
  if (!p) {
    const q = importGens(topic).then((list) => {
      for (const full of list) attachGens(full);
      if (!gensLoaded.has(topic)) throw new Error(`content: no generators for ${topic}`);
    });
    q.catch(() => { if (gensAsked.get(topic) === q) gensAsked.delete(topic); });
    gensAsked.set(topic, q);
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
 * Two optional flags a topic may carry:
 *   placement: false   the first-day placement test skips it (it is taught later in the school year, so a new student
 *                      would only meet questions never taught); it starts at stair 1, and the unit jump test is there
 *                      for a student who already knows it
 *   alsoFor: ['8']     Exam Rescue (and the exam check's topic list) offers it to that grade too: a grade 8 test can
 *                      revise grade 7 equations, and grade 7 learns Pythagoras in March though the app files it in grade 8;
 *                      a later grade's unit with guest stairs is offered through them alone (rescueTopicsFor)
 */
export const placementTopicsFor = (grade) => topicsFor(grade).filter((t) => t.placement !== false);

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

/** An answer two misconceptions both explain: name them, and say how the lesson will tell them apart. */
export function ambiguousText(topic, level, candidates) {
  const names = (candidates || []).map((c) => catLabel(topic, level, c.id)).filter(Boolean);
  if (names.length < 2) return 'עוד שאלה אחת בסוף השיעור תעזור לדעת מה בדיוק בלבל.';
  return `מה כנראה קרה: אולי ${names.join(', ואולי ')}. עוד שאלה אחת בסוף השיעור תעזור לדעת מה מהן.`;
}

/**
 * The line a lesson shows under a first miss, from the answer's result ({ cat, diagnosis }): the app's name for the
 * mistake ("מה כנראה קרה: …."), the two candidates of an ambiguous answer, or null. The screen and the tutor's context
 * read it from here, so the tutor is told exactly what the student saw (ai spec AI-1 Design 4).
 */
export function diagnosisLine(topic, level, result) {
  if (!result) return null;
  if (result.diagnosis?.ambiguous) return ambiguousText(topic, level, result.diagnosis.candidates);
  const label = catLabel(topic, level, result.cat);
  return label ? `מה כנראה קרה: ${label}.` : null;
}

export const COLORS = ['sky', 'fuchsia', 'petrol', 'cobalt', 'violet'];
