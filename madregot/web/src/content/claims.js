// What the public pages may say about Madregot (STUDENT-17): every sentence about the product that the landing pages
// (web/landing, scripts/landing-build.mjs) and the store listing (store/make-listing.mjs) print is one of these claims,
// and each claim has a check that reads the code. A claim whose check is false is not shown anywhere, and the build
// prints which claims it hid, so the pages can never promise a feature this build does not have. One sentence has one
// source: a page names a claim by its id ({{CLAIM id}}), never by copying its words.
//
// - `required: true`: the claim is about this app's own core (diagnosis, code grading, Exam Rescue, the teacher's
//   board). Its check failing means the app lost the feature, so the landing build stops instead of hiding it.
// - The others wait for another lane's code: their checks look for that code by the exact names it has where it was
//   built (`needs` says which item), so they turn on by themselves once it is merged, and stay hidden until then.
// - `marks`: words only that claim may put on a page. landing-build.test.mjs fails if a page or a template says them
//   outside the claim (a feature written into the page by hand).
//
// A check gets `ctx`: { code, data }. code.has(path) and code.read(path) read a file of the repository by its path
// from madregot/ (web/src/…, worker/src/…, shared/…); data holds what the build computed from the app (data.mistakes,
// data.coverage when CURRICULUM-1's programme exists, data.vars: the Worker's [vars]).
import { TOPICS, isCorrect } from './index.js';
import { META, loadAllContent } from '@/learn/content/index.ts';
import { isRestDay, YOMTOV_IL } from '@shared/restDays.js';

const he = (s) => typeof s === 'string' && /[֐-׿]/.test(s);

/**
 * The named mistakes the app can tell apart: distinct misconception ids that carry a Hebrew title, in the teaching
 * content's stairs (learn/content) and in the topics' categories (content/grade7.js, grade8.js), the same names the
 * labels test and the teacher's board read. `content` and `topics` are for the unit test's fixture. The stairs' names
 * come from learn/content/meta.gen.ts (META: every stair's misconception ids and titles, generated from the content,
 * DURABLE-11), so the count needs no topic loaded.
 */
export function countNamedMistakes(content = META, topics = TOPICS) {
  const ids = new Set();
  for (const stair of Object.values(content || {})) for (const m of stair?.misconceptions || []) if (m?.id && he(m.title)) ids.add(m.id);
  for (const t of topics || []) for (const [id, title] of Object.entries(t?.cats || {})) if (he(title)) ids.add(id);
  return ids.size;
}

// CURRICULUM-1's programme (the Ministry's hours and what the app covers), once that lane has merged: {} until then
const PROGRAMME = import.meta.glob('../learn/programme.ts', { eager: true });

/** The share of both grades' programme hours the app teaches, as a whole percentage; null without the programme. */
export function programmeCoverage(mods = PROGRAMME) {
  const coverageOf = Object.values(mods)[0]?.coverageOf;
  if (typeof coverageOf !== 'function') return null;
  const g = ['7', '8'].map((x) => coverageOf(x));
  const hours = g.reduce((a, c) => a + (c?.hours || 0), 0);
  return hours ? Math.round((100 * g.reduce((a, c) => a + (c?.taught || 0), 0)) / hours) : null;
}

/** Every misconception of every stair has its own explanation (the "mistakes" claim's second half). */
export const allExplained = (content) => Object.values(content || {}).every((s) => (s?.misconceptions || []).every((m) => (m.explain || []).length > 0));

/**
 * What the claims' checks compute from the app itself (ctx.data, without the Worker's vars). Async: the teaching
 * content loads one topic at a time (DURABLE-11), and the explanations are read from all of it.
 */
export async function claimData() {
  return { mistakes: countNamedMistakes(), explained: allExplained(await loadAllContent()), coverage: programmeCoverage() };
}

const grep = (code, path, re) => code.has(path) && re.test(code.read(path));
const allOf = (...tests) => (ctx) => tests.every((t) => t(ctx));

// the facts each claim stands on: what this branch has, and the names another lane's code has where it was built
const FACT = {
  board: ({ code }) => grep(code, 'web/src/screens/Teacher.jsx', /'tomorrow'/) && grep(code, 'worker/src/index.js', /mistakes: catRows/),
  assignments: ({ code }) => grep(code, 'worker/src/assignments.js', /due_on/) && grep(code, 'worker/src/index.js', /p === '\/api\/teacher\/assignments'/),
  classReport: ({ code }) => grep(code, 'web/src/lib/teacherCsv.js', /text\/csv/),
  pilotKit: ({ code }) => ['teacher-guide', 'parent-letter', 'principal-approval'].every((d) => code.has(`web/src/content/schools/${d}.md`)),
  principalForm: ({ code }) => code.has('web/src/content/schools/principal-approval.md'),
  classDelete: ({ code }) => grep(code, 'worker/src/index.js', /p === '\/api\/teacher\/class\/delete'/),
  // the one delete path of the integrated app (TRUST-6/7): forget.js STUDENT_ROWS lists the student's rows, and
  // licence.js removeStudent deletes them with the student in one batch
  studentRemove: ({ code }) => ['attempts', 'levels', 'help_requests', 'exams', 'class_steps'].every((t) => grep(code, 'worker/src/forget.js', new RegExp(`\\['${t}', 'student_id'\\]`)))
    && grep(code, 'worker/src/licence.js', /\.\.\.studentDeleteStmts\(env, st\.id\)/) && grep(code, 'worker/src/licence.js', /DELETE FROM students WHERE id = \?/),
  pilotReport: ({ code }) => code.has('worker/scripts/pilot.mjs') && grep(code, 'worker/scripts/owner.mjs', /pilot-report/),
  weeklyShare: ({ code }) => grep(code, 'web/src/components/report/ShareSheet.jsx', /export function ShareSheet/),
  demoClass: ({ code }) => code.has('web/src/lib/teacherDemo.js') && grep(code, 'web/src/screens/Welcome.jsx', /get\('start'\) === 'demo'/),
  schoolAiOff: ({ code, data }) => grep(code, 'shared/schoolRules.js', /export function classAiPolicy/) && grep(code, 'shared/schoolRules.js', /not_in_catalogue/)
    && String(data?.vars?.MOE_AI_APPROVAL || '').trim() !== 'approved',
  tutorKnows: ({ code }) => grep(code, 'shared/tutorContext.js', /POLICIES = Object\.freeze\(\[[^\]]*'withhold'/) && code.has('shared/guard.js'),
  reportAnswer: ({ code }) => grep(code, 'worker/src/index.js', /p === '\/api\/ai\/report'/),
  parentOk: ({ code }) => grep(code, 'worker/src/family.js', /LINK_PURPOSES = Object\.freeze\(\[[^\]]*'consent'/),
  localReminders: ({ code }) => grep(code, 'web/src/lib/localReminder.js', /export function planReminders/) && grep(code, 'web/src/lib/push.js', /if \(storeIos\(env\)\) return 'store-ios'/),
};

/** Every claim. Read the top of this file before adding one. */
export const CLAIMS = [
  // ── the app's own core: always true on this code, or the build stops ──
  {
    id: 'graded-by-code', required: true,
    he: 'כל תשובה בתרגול ובבדיקות נבדקת בקוד, לא על ידי בינה מלאכותית.',
    check: () => typeof isCorrect === 'function' && TOPICS.length > 0 && TOPICS.every((t) => t.levels.length > 0 && t.levels.every((l) => typeof l.gen === 'function')),
  },
  {
    id: 'mistakes', required: true,
    he: 'המערכת מזהה {{MISTAKES}} טעויות נפוצות בשמן, ומציעה דרך אחרת להבין כל אחת.',
    fill: ({ data }) => ({ MISTAKES: data.mistakes }),
    check: ({ data }) => data.mistakes >= 50 && data.explained === true,
  },
  {
    id: 'rest', required: true,
    he: 'הרצף לא נשבר בשבת ובחג.',
    check: () => isRestDay('2026-11-14') && YOMTOV_IL.length > 0 && YOMTOV_IL.every(isRestDay),
  },
  {
    id: 'no-ads', required: true,
    he: 'בלי פרסומות ובלי מעקב.',
    // the build itself is checked: scripts/check-dist.mjs refuses any file that names an analytics, ads or tag host
    check: ({ code }) => grep(code, 'web/scripts/check-dist.mjs', /export const TRACKERS = \[/) && grep(code, 'web/package.json', /node scripts\/check-dist\.mjs dist/),
  },
  {
    id: 'free-list', required: true,
    he: 'כל השיעורים, התרגול, תוכנית החזרה למבחן ומבחן תרגול להדפסה עם מפתח תשובות.',
    check: ({ code }) => code.has('web/src/screens/Rescue.jsx') && grep(code, 'web/src/screens/PracticeExam.jsx', /window\.print\(\)/) && grep(code, 'web/src/screens/PracticeExam.jsx', /id="answer-key"/),
  },
  {
    id: 'ai-helper', required: true,
    he: 'עוזר שמסביר לילד את הטעות בתרגיל שעל המסך ובודק דף פתרון מצולם.',
    check: ({ code }) => code.has('web/src/screens/Assistant.jsx') && code.has('web/src/screens/ExamCheck.jsx') && grep(code, 'shared/ai.js', /AI_KINDS = \[[^\]]*'explain'[^\]]*'check'/),
  },
  {
    id: 'cancel-web', required: true,
    he: 'בלי התחייבות, מבטלים באתר.',
    check: ({ code }) => grep(code, 'web/src/App.jsx', /path="\/cancel"/),
  },
  {
    id: 'tomorrow-board', required: true,
    he: 'לוח "מה לחזור מחר" לפי הטעויות של הכיתה.',
    marks: ['מה לחזור מחר'],
    check: FACT.board,
  },
  {
    id: 'class-goal', required: true,
    he: 'מטרה שבועית משותפת לכיתה, בלי דירוג ובלי שמות.',
    check: ({ code }) => grep(code, 'worker/src/goal.js', /export async function goalFor/) && code.has('web/src/components/learn/ClassGoalCard.jsx'),
  },
  {
    id: 'student-remove', required: true,
    he: 'אפשר להסיר תלמיד מהכיתה בכל רגע, ומה שנשמר עליו בשרת נמחק.',
    check: FACT.studentRemove,
  },
  {
    // the store listing's teachers' line before assignments are merged; 'teachers-assign' after (one of the two shows)
    id: 'teachers',
    he: 'מורים יכולים לפתוח כיתה ולראות מה כדאי לחזור מחר.',
    check: (ctx) => FACT.board(ctx) && !FACT.assignments(ctx),
  },
  {
    id: 'local-reminders', required: true, lang: 'en',
    en: 'Daily reminders are local notifications (iOS) / web push (Android), opt-in, never on Shabbat or holidays.',
    check: FACT.localReminders,
  },

  // ── waiting for another lane: hidden until its code is here ──
  {
    id: 'teachers-assign', needs: 'TEACHER-4',
    he: 'מורים יכולים לפתוח כיתה, לראות מה כדאי לחזור מחר ולתת משימות.',
    marks: ['ולתת משימות'],
    check: allOf(FACT.board, FACT.assignments),
  },
  { id: 'assign-due', needs: 'TEACHER-4', he: 'משימות לכיתה עם תאריך יעד.', marks: ['תאריך יעד'], check: FACT.assignments },
  { id: 'class-report', needs: 'TEACHER-7', he: 'דוח כיתה להדפסה ולייצוא.', marks: ['לייצוא'], check: FACT.classReport },
  { id: 'pilot-kit', needs: 'TEACHER-10', he: 'מדריך למורה, מכתב להורים ואישור מנהל, מוכנים להדפסה.', marks: ['מדריך למורה', 'מכתב להורים'], check: FACT.pilotKit },
  { id: 'principal-form', needs: 'TEACHER-10', he: 'בערכה למורה יש טופס אישור מוכן להדפסה.', marks: ['טופס'], check: FACT.principalForm },
  { id: 'class-delete', needs: 'TEACHER-9, TRUST-7', he: 'אפשר למחוק את הכיתה בכל רגע.', marks: ['למחוק את הכיתה'], check: FACT.classDelete },
  {
    id: 'pilot-report', needs: 'TEACHER-11',
    he: 'כמה תלמידים מתרגלים בכל שבוע, כמה חוזרים, ואילו טעויות פחתו. בסוף מקבלים דוח.',
    marks: ['מקבלים דוח', 'כמה חוזרים'],
    check: FACT.pilotReport,
  },
  { id: 'weekly-share', needs: 'PARENTS-2', he: 'אפשר לשתף אתכם בסיכום שבועי.', marks: ['סיכום שבועי'], check: FACT.weeklyShare },
  { id: 'demo-class', needs: 'TEACHER-15', he: 'לראות כיתה לדוגמה', marks: ['כיתה לדוגמה'], check: FACT.demoClass },
  {
    id: 'school-ai-off', needs: 'TRUST-11',
    he: 'בכיתות של בית ספר העוזר החכם כבוי לתלמידים, עד שמדרגות תאושר בקטלוג החינוכי של משרד החינוך. השיעורים, התרגול והבדיקות לא צריכים אותו.',
    marks: ['העוזר החכם כבוי'],
    check: FACT.schoolAiOff,
  },
  {
    id: 'tutor-knows', needs: 'AI-1, AI-3',
    he: 'העוזר החכם יודע איזו טעות זוהתה בתרגיל, ומלמד בדרך של המדרגה. הוא לא נותן את התשובה לתרגיל פתוח.',
    marks: ['לא נותן את התשובה'],
    check: FACT.tutorKnows,
  },
  {
    id: 'coverage', needs: 'CURRICULUM-1',
    he: 'מכסה {{COVERAGE}}% משעות תכנית הלימודים במתמטיקה של כיתות ז׳ ו־ח׳.',
    marks: ['משעות תכנית הלימודים'],
    fill: ({ data }) => ({ COVERAGE: data.coverage }),
    check: ({ data }) => Number.isFinite(data?.coverage) && data.coverage > 0,
  },
  {
    id: 'chatbot', needs: 'AI-1, AI-3',
    he: 'צ׳אטבוט כללי יכול לפתור תרגיל, אבל הוא לא יודע איזו טעות הילד עשה אתמול, ולא בודק בקוד אם התשובה שלו נכונה. במדרגות כל תשובה נבדקת בקוד, הטעות מקבלת שם, ויש תרגול שמתקן אותה. העוזר החכם הוא חלק אחד מזה, והוא לא נותן את התשובה לתרגיל פתוח.',
    marks: ['צ׳אטבוט כללי'],
    check: FACT.tutorKnows,
  },
  { id: 'report-answer', needs: 'TRUST-4', lang: 'en', en: 'AI answers can be reported in the app.', check: FACT.reportAnswer },
  { id: 'parent-ok', needs: 'TRUST-9', lang: 'en', en: 'A parent\'s one-time approval is also required.', check: FACT.parentOk },
];

export const CLAIM = Object.fromEntries(CLAIMS.map((c) => [c.id, c]));

/** A claim's words with its slots filled. */
export function claimText(claim, ctx) {
  const vars = claim.fill ? claim.fill(ctx) : {};
  return (claim.he || claim.en).replace(/\{\{(\w+)\}\}/g, (all, k) => (vars[k] === undefined || vars[k] === null ? all : String(vars[k])));
}

/**
 * Every claim checked against `ctx`: [{ id, text, visible, required, needs, why }]. A check that throws counts as false.
 * A visible claim's text has no slot left; a claim whose slot stays empty is hidden.
 */
export function claimStatus(ctx) {
  return CLAIMS.map((c) => {
    let ok = false;
    let why = '';
    try { ok = !!c.check(ctx); } catch (e) { why = String(e?.message || e); }
    const text = ok ? claimText(c, ctx) : '';
    if (ok && /\{\{/.test(text)) { ok = false; why = 'a slot has no value'; }
    if (!ok && !why) why = c.needs ? `waits for ${c.needs}` : 'its check is false';
    return { id: c.id, text, visible: ok, required: !!c.required, needs: c.needs || null, lang: c.lang || 'he', why: ok ? '' : why };
  });
}

/** The visible claims, by id: { id: text }. */
export const visibleClaims = (ctx) => Object.fromEntries(claimStatus(ctx).filter((s) => s.visible).map((s) => [s.id, s.text]));
