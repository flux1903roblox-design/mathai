// The demo class (spec TEACHER-15 §1): one synthetic class, built the same way every time, and the teacher's routes
// answered on the device in the Worker's own JSON shapes, so every teacher screen works with no server and no sign-in.
// Lazy, in the teacher chunk: lib/teacher.js teacherApi loads it only for a demo profile (lib/demo.js).
//
// demoState(seed = 7, today) builds the class with a small seeded generator (mulberry32), never Math.random: DEMO01,
// "ז׳3 (דוגמה)", grade 7, 24 students (a first name and one letter, invented), 14 days of practice drawn so that every
// group of "מחר", every reason of "כדאי לבדוק איתם" (idle, never started, low first-try rate, help waiting, late work),
// the overview tiles and the class report have content; 3 assignments (a stair due three days ago, a mastery check due
// soon, and a class exam built by makeClassExam on grade 7's first two stairs, with Math.random replaced by the seeded
// generator while it runs, then restored); work of every state; 4 help requests (one answered and closed, one where
// the student wrote "עדיין לא ברור לי" after the teacher's answer, two new); 6 finished class-exam rows.
//
// demoApi(state, method, path, body) → { status, body }: each teacher route of this lane, worked out the way the
// Worker works it out (worker/src/index.js dashboard, report.js, assignments.js, help.js, classai.js, licence.js), and
// writes change `state`. Unknown routes: 404 not_found. Deleting the class and the teacher key are refused (403
// demo_readonly). teacherDemo.test.js holds the shapes to the worker tests' field assertions.
//
// demoCall(method, path, body): the demo's state for this tab (memory, then sessionStorage via lib/demo.js; the practice
// rows are drawn again from the seed rather than kept), one call, and after a write the tab's copy and the toast that
// says it stays here.
import { toast } from 'sonner';
import { TOPIC } from '@/content/index.js';
import { CONTENT } from '@/learn/content/index.ts';
import { TOPIC_IDS } from '@shared/ai.js';
import { MOE_RULES, classAiPolicy, NOT_SELLABLE } from '@shared/schoolRules.js';
// the Worker's own contact guard (worker/src/help.js uses the same function)
import { hasContact } from '@shared/contact.js';
import { makeClassExam, classExamTitle } from './exam.js';
import { assignTitle } from './assign.js';
import { ApiError } from './api.js';
import { DEMO_CODE, DEMO_CLASS_NAME, DEMO_TEACHER, DEMO_COPY, readDemo, writeDemo, onDemoExit } from './demo.js';

// ---------------------------------------------------------------- the seeded generator and dates
/** mulberry32: a small seeded generator, the same numbers for the same seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Run `fn` with Math.random as the seeded generator (the question generators call it), then put it back. */
function withRandom(rnd, fn) {
  const saved = Math.random;
  Math.random = rnd;
  try { return fn(); } finally { Math.random = saved; }
}

const pad = (n) => String(n).padStart(2, '0');
const hex = (n, len) => n.toString(16).padStart(len, '0');
export const jerusalemDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const plus = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isRestDay = (day) => new Date(`${day}T12:00:00Z`).getUTCDay() === 6;
/** A due date on a rest day moves to the next day that is not one (as worker/src/assignments.js schoolDay). */
const schoolDay = (day) => { let d = day; let moved = false; while (isRestDay(d)) { d = plus(d, 1); moved = true; } return { day: d, moved }; };
/** An ISO time on a day (UTC hours: 13-18 is the afternoon in Israel). */
const at = (day, h, m = 0) => `${day}T${pad(h)}:${pad(m % 60)}:00.000Z`;
const nowIso = () => new Date().toISOString();
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---------------------------------------------------------------- the class
/** Invented names, a first name and one letter: never a real-looking full name. */
export const DEMO_NAMES = Object.freeze([
  'דנה כ.', 'יואב ל.', 'נועה מ.', 'איתי ב.', 'מאיה ש.', 'עומר ג.', 'תמר ר.', 'אורי פ.', 'שירה א.', 'אלון ד.', 'יעל ח.', 'רון ז.',
  'הילה ט.', 'גיא נ.', 'ליאור ס.', 'נטע ע.', 'אדם צ.', 'רוני ק.', 'עדי ו.', 'איתמר י.', 'מיכל ה.', 'בן ת.', 'אמיר ח.', 'לין ע.',
]);
/** How each student practises: most every few days and well; two find it hard; three stopped; one never began. */
const KIND = (i) => (i === 14 || i === 15 ? 'low' : i >= 16 && i <= 18 ? 'idle' : i === 19 ? 'never' : 'regular');
const sid = (i) => `de${hex(i + 1, 14)}`;
const aid = (n) => `da${hex(n, 14)}`;

/** The mistakes a stair can show: its own misconceptions first, else its topic's. */
function stairCats(topic, level) {
  const own = (CONTENT[`${topic}:${level}`]?.misconceptions || []).map((m) => m.id);
  return own.length ? own : Object.keys(TOPIC[topic]?.cats || {});
}

/** The demo class, the same for the same seed and day. */
export function demoState(seed = 7, today = jerusalemDay()) {
  const rnd = mulberry32(seed);
  const chance = (p) => rnd() < p;
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const days = Array.from({ length: 14 }, (_, i) => plus(today, i - 13));
  const week = days.slice(-7);
  const students = []; const attempts = []; const levels = {};
  DEMO_NAMES.forEach((name, i) => {
    const kind = KIND(i);
    const id = sid(i);
    students.push({ id, name, createdAt: at(plus(today, kind === 'never' ? -9 : -62 + (i % 6)), 6, 10 + i), pinReset: false, aiOff: false });
    if (kind === 'never') return;
    const ls = kind === 'low' ? 2 : int(2, 4); const lc = int(1, 2);
    levels[id] = { signed: { level: ls, max: ls }, coord: { level: lc, max: lc } };
    const rate = kind === 'low' ? 0.38 + rnd() * 0.14 : 0.68 + rnd() * 0.24;
    const stop = kind === 'idle' ? plus(today, -(5 + 2 * (i - 16))) : today;
    days.forEach((day) => {
      if (day > stop) return;
      let p = kind === 'low' ? 0.75 : 0.62;
      if (day === today) p = kind === 'regular' ? 0.5 : 0.3;
      if (isRestDay(day)) p *= 0.2;
      // the idle ones practised on their last day; the struggling ones twice this week at least
      const forced = (kind === 'idle' && day === stop) || (kind === 'low' && (day === week[1] || day === week[4]));
      if (!forced && !chance(p)) return;
      const n = kind === 'low' ? int(7, 12) : int(4, 12);
      const h = day === today ? int(5, 6) : int(13, 17); let m = int(0, 40);
      for (let k = 0; k < n; k += 1) {
        const signed = chance(0.75);
        const topic = signed ? 'signed' : 'coord';
        const top = signed ? ls : lc;
        const level = top > 1 && chance(0.2) ? top - 1 : top;
        const first = chance(rate) ? 1 : 0;
        const ok = first || chance(0.55) ? 1 : 0;
        let cat = null;
        if (!first) {
          const cats = stairCats(topic, level);
          const r = rnd();
          cat = cats.length ? cats[r < 0.55 ? 0 : r < 0.85 ? Math.min(1, cats.length - 1) : Math.floor(rnd() * cats.length)] : null;
        }
        attempts.push({ sid: id, day, at: at(day, h + Math.floor(m / 60), m), topic, level, cat, ok, first, hint: !first && chance(0.3) ? 1 : 0, secs: int(25, 95) });
        m += int(1, 3);
      }
    });
  });

  // ---- three assignments: a stair (its date has passed), a mastery check (due soon), a class exam
  const exSkills = ['signed:1', 'signed:2'];
  const examItems = withRandom(rnd, () => makeClassExam(exSkills, 6).items);
  const assignments = [
    { id: aid(1), kind: 'stair', skill: 'signed:3', title: assignTitle('stair', 'signed:3'), note: 'לסיים את חמשת השלבים לפני השיעור.', exam: null, version: null, forAll: true, targets: [], startsOn: plus(today, -8), dueOn: schoolDay(plus(today, -3)).day, createdAt: at(plus(today, -8), 16, 10) },
    { id: aid(2), kind: 'check', skill: 'signed:2', title: assignTitle('check', 'signed:2'), note: '', exam: null, version: null, forAll: true, targets: [], startsOn: plus(today, -2), dueOn: schoolDay(plus(today, 2)).day, createdAt: at(plus(today, -2), 15, 40) },
    { id: aid(3), kind: 'exam', skill: null, title: classExamTitle(exSkills), note: 'מבחן תרגול לפני המבחן בכיתה.', exam: examItems, version: 'a', forAll: true, targets: [], startsOn: plus(today, -4), dueOn: schoolDay(plus(today, 3)).day, createdAt: at(plus(today, -4), 17, 5) },
  ];
  const [stair, check, exam] = assignments;
  const work = { [stair.id]: {}, [check.id]: {}, [exam.id]: {} };
  const done = (a, day, extra) => ({ state: 'done', stage: null, right: null, asked: null, passed: null, questions: null, tries: 1, startedAt: at(plus(day, -1), 16, 0), doneAt: at(day, 16, int(0, 50)), doneDay: day, ...extra });
  const started = (day, extra) => ({ state: 'started', stage: null, right: null, asked: null, passed: null, questions: null, tries: 0, startedAt: at(day, 16, int(0, 50)), doneAt: null, doneDay: null, ...extra });
  const regular = students.filter((_, i) => KIND(i) === 'regular');
  // the stair: most finished (one after its date), three on their way, the rest not yet
  regular.forEach((s, k) => {
    if (k < 15) work[stair.id][s.id] = done(stair, k === 0 ? plus(stair.dueOn, 1) : plus(stair.startsOn, int(1, 4)), { stage: 5, passed: k !== 3 });
    else work[stair.id][s.id] = started(plus(stair.startsOn, 1), { stage: int(1, 4) });
  });
  work[stair.id][students[14].id] = started(plus(stair.startsOn, 2), { stage: 2 });
  work[stair.id][students[16].id] = started(plus(stair.startsOn, 1), { stage: 1 });
  // the mastery check: eight finished, three started
  regular.slice(0, 11).forEach((s, k) => {
    if (k < 8) { const right = int(3, 5); work[check.id][s.id] = done(check, plus(check.startsOn, int(0, 2) > 1 ? 1 : 0), { right, asked: 5, passed: right >= 4 }); } else work[check.id][s.id] = started(check.startsOn);
  });
  // the class exam: six finished, with a result per question; two started
  regular.slice(2, 10).forEach((s, k) => {
    if (k < 6) {
      const questions = exam.exam.map((it) => ({ topic: it.topic, level: it.level, status: chance(0.72) ? 'correct' : chance(0.4) ? 'partial' : 'wrong' }));
      const right = questions.filter((q) => q.status === 'correct').length;
      work[exam.id][s.id] = done(exam, plus(exam.startsOn, int(1, 3) > 2 ? 2 : 1), { right, asked: questions.length, questions });
    } else work[exam.id][s.id] = started(plus(exam.startsOn, 2));
  });

  // ---- help: one answered and closed, one the student answered "עדיין לא ברור לי", two new
  const S = (i) => students[i].id;
  const help = [
    { id: 9001, sid: S(2), topic: 'signed', level: 2, question: 'חשבו: $-7 + 3$', answer: '-10', note: 'לא הבנתי למה התשובה לא מינוס עשר', hasImage: false, createdAt: at(plus(today, -5), 16, 12), seenAt: at(plus(today, -5), 18, 0), doneAt: at(plus(today, -4), 6, 50) },
    { id: 9002, sid: S(15), topic: 'signed', level: 3, question: 'חשבו: $(-4) \\cdot (-6)$', answer: '-24', note: '', hasImage: false, createdAt: at(plus(today, -3), 15, 30), seenAt: at(plus(today, -3), 17, 5), doneAt: null },
    { id: 9003, sid: S(7), topic: 'coord', level: 2, question: 'באיזה רביע נמצאת הנקודה $(-3, 2)$?', answer: 'רביע 1', note: 'למה זה לא הרביע הראשון?', hasImage: false, createdAt: at(plus(today, -1), 16, 45), seenAt: null, doneAt: null },
    { id: 9004, sid: S(10), topic: 'signed', level: 2, question: 'חשבו: $-5 - (-8)$', answer: '-13', note: '', hasImage: false, createdAt: at(today, 5, 40), seenAt: null, doneAt: null },
  ];
  const messages = [
    { id: 1, helpId: 9001, from: 'teacher', body: 'כשמחברים מספר חיובי ומספר שלילי, מחסרים ושמים את הסימן של המספר הרחוק יותר מאפס. כאן: 7 פחות 3, והסימן של 7.', at: at(plus(today, -5), 18, 2), read: true },
    { id: 2, helpId: 9001, from: 'student', body: 'תודה, הבנתי', at: at(plus(today, -4), 6, 48), read: true },
    { id: 3, helpId: 9002, from: 'teacher', body: 'מינוס כפול מינוס נותן פלוס. חשבו קודם 4 כפול 6, ואחר כך בחרו את הסימן.', at: at(plus(today, -3), 17, 7), read: true },
    { id: 4, helpId: 9002, from: 'student', body: 'עדיין לא ברור לי', at: at(plus(today, -2), 15, 20), read: false },
  ];

  return {
    v: 1, seed, today,
    cls: { code: DEMO_CODE, name: DEMO_CLASS_NAME, grade: '7', teacherName: DEMO_TEACHER },
    joinLocked: false,
    ai: { setting: 'school', studentAi: 'off', consentAt: null },
    students, attempts, levels, assignments, work, help, messages,
    next: { assignment: 4, message: 5 },
  };
}

// ---------------------------------------------------------------- what the Worker would answer
const ok = (body, status = 200) => ({ status, body });
const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } });
const num = (v) => Number(v) || 0;
const daysAgo = (today, n) => plus(today, -n);
const live = (st) => new Set(st.students.map((s) => s.id));
const attemptsOf = (st) => { const ids = live(st); return st.attempts.filter((a) => ids.has(a.sid)); };
const nameOf = (st, id) => st.students.find((s) => s.id === id)?.name || '';
/** The Jerusalem day an ISO time falls on. */
const dayOfIso = (iso) => jerusalemDay(new Date(iso));

/** The class's AI policy as the dashboard shows it (worker/src/classai.js aiPolicyView); Madregot is not in the catalogue. */
function aiPolicyOf(st, s = st.ai) {
  const env = { approval: 'none', approvedFromGrade: MOE_RULES.independentFromGrade };
  const p = classAiPolicy({ setting: s.setting, grade: st.cls.grade, studentAi: s.studentAi, consentAt: s.consentAt }, env);
  return {
    ...p, setting: s.setting, consentAt: s.consentAt, fromGrade: MOE_RULES.independentFromGrade,
    rulesVersion: MOE_RULES.version, rulesUrl: MOE_RULES.url, consentFormUrl: MOE_RULES.consentFormUrl, consentPdfUrl: MOE_RULES.consentPdfUrl,
  };
}

/** The students an assignment is for: everyone, or the named ones still in the class. */
const forWhom = (st, a) => (a.forAll ? st.students.map((s) => s.id) : a.targets.filter((id) => live(st).has(id)));
const workOf = (st, a, id) => st.work[a.id]?.[id] || null;
/** An assignment as the teacher's screens read it (assignments.js view). */
function viewOf(st, a) {
  const who = forWhom(st, a);
  const ws = who.map((id) => workOf(st, a, id));
  const started = ws.filter((w) => w?.state === 'started').length;
  const done = ws.filter((w) => w?.state === 'done').length;
  const doneLate = ws.filter((w) => w?.state === 'done' && w.doneDay > a.dueOn).length;
  const assigned = who.length;
  return {
    id: a.id, kind: a.kind, skill: a.skill, title: a.title, note: a.note, startsOn: a.startsOn, dueOn: a.dueOn,
    forAll: a.forAll, targets: a.forAll ? [] : [...who].sort(), createdAt: a.createdAt,
    hasExam: !!a.exam, examCount: a.exam ? a.exam.length : null, version: a.version || null,
    counts: { assigned, notStarted: Math.max(0, assigned - started - done), started, done, late: doneLate + (a.dueOn < st.today ? assigned - done : 0) },
  };
}
const lateOf = (st, a, w) => (w?.state === 'done' ? w.doneDay > a.dueOn : a.dueOn < st.today);

/** The help request's status as the student sees it (help.js statusOf). */
const helpStatus = (h, msgs) => (h.doneAt ? 'done' : msgs.some((m) => m.from === 'teacher') ? 'answered' : h.seenAt ? 'seen' : 'sent');
const msgView = (m) => ({ id: m.id, from: m.from, body: m.body, at: m.at, read: !!m.read });

/** A practice row's mistakes, one group per stair and mistake (TEACHER-16; the Worker groups by topic, level, cat). */
function byStair(rows) {
  const groups = {};
  for (const r of rows) if (r.cat) (groups[`${r.topic}\u0000${r.level}\u0000${r.cat}`] ||= []).push(r);
  return Object.values(groups);
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** The order of the Worker's mistake rows after their counts: topic, stair, mistake. */
const byKey = (a, b) => cmp(a.topic, b.topic) || a.level - b.level || cmp(a.cat, b.cat);
/** The class's repeated mistakes over some practice rows (most students first, then most answers; at most 12). */
function classMistakes(st, rows, { ids = false } = {}) {
  return byStair(rows).map((g) => {
    const who = [...new Set(g.map((r) => r.sid))].map((id) => ({ id, name: nameOf(st, id) })).sort(byName);
    return {
      topic: g[0].topic, level: g[0].level, cat: g[0].cat, n: g.length, students: who.length,
      ...(ids ? { ids: who.map((w) => w.id) } : {}), names: who.map((w) => w.name),
    };
  }).sort((a, b) => b.students - a.students || b.n - a.n || byKey(a, b)).slice(0, 12);
}

/** GET /api/teacher/dashboard (worker/src/index.js dashboard). */
function dashboard(st) {
  const today = st.today; const weekStart = daysAgo(today, 6);
  const rows = attemptsOf(st);
  const sum = (list) => ({ n: list.length, ok: list.reduce((t, r) => t + r.ok, 0), first: list.reduce((t, r) => t + r.first, 0), secs: list.reduce((t, r) => t + r.secs, 0) });
  const helpRows = st.help.filter((h) => live(st).has(h.sid) && (!h.doneAt || h.doneAt >= at(daysAgo(today, 7), 0)))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100);
  const classExams = st.assignments.filter((a) => a.kind === 'exam').flatMap((a) => Object.entries(st.work[a.id] || {})
    .filter(([id, w]) => w.state === 'done' && live(st).has(id))
    .map(([id, w]) => ({ id: `a:${a.id}:${id}`, studentId: id, name: nameOf(st, id), title: a.title, correct: w.right, total: w.asked, weak: [], questions: w.questions || [], at: w.doneAt, assignmentId: a.id })));
  const late = (id) => st.assignments.filter((a) => a.dueOn < today && a.dueOn >= daysAgo(today, 30) && forWhom(st, a).includes(id) && workOf(st, a, id)?.state !== 'done').length;
  return {
    class: { ...st.cls },
    today,
    joinLocked: st.joinLocked,
    students: [...st.students].sort(byName).map((s) => {
      const mine = rows.filter((r) => r.sid === s.id);
      const t = sum(mine.filter((r) => r.day === today));
      const w = mine.filter((r) => r.day >= weekStart); const ws = sum(w);
      return {
        id: s.id, name: s.name, lastSeen: mine.length ? mine.reduce((m, r) => (r.at > m ? r.at : m), '') : null,
        lastPractice: mine.length ? mine.reduce((m, r) => (r.at > m ? r.at : m), '') : null, pinReset: !!s.pinReset,
        joinedOn: dayOfIso(s.createdAt), late: late(s.id), aiOff: !!s.aiOff,
        today: { n: t.n, ok: t.ok, first: t.first, minutes: Math.round(t.secs / 60) },
        week: { n: ws.n, first: ws.first, days: new Set(w.map((r) => r.day)).size, minutes: Math.round(ws.secs / 60) },
        levels: st.levels[s.id] || {},
      };
    }),
    exams: classExams.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 200),
    mistakes: classMistakes(st, rows.filter((r) => r.day >= weekStart), { ids: true }),
    assignments: st.assignments.filter((a) => a.dueOn >= daysAgo(today, 7))
      .sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.createdAt < b.createdAt ? -1 : 1)).slice(0, 10).map((a) => viewOf(st, a)),
    help: helpRows.map((h) => {
      const msgs = st.messages.filter((m) => m.helpId === h.id);
      return {
        id: h.id, topic: h.topic, level: h.level, question: h.question, answer: h.answer, note: h.note, has_image: h.hasImage ? 1 : 0,
        created_at: h.createdAt, seen_at: h.seenAt, done_at: h.doneAt, name: nameOf(st, h.sid), studentId: h.sid,
        messages: msgs.slice(0, 6).map(msgView), unreadFromStudent: msgs.filter((m) => m.from === 'student' && !m.read).length,
      };
    }),
    helpDigest: null,
    aiPolicy: aiPolicyOf(st),
    // the demo class is bound to no email (teacherAccount.js bindingView)
    boundElsewhere: false, boundAt: null, rekeyFrom: null,
  };
}

/** GET /api/teacher/report?from&to (worker/src/report.js classReport). */
function report(st, params) {
  const today = st.today;
  const f = params.get('from'); const t = params.get('to');
  if ((f && !isDay(f)) || (t && !isDay(t))) return fail(400, 'bad_range');
  const to = t && t < today ? t : today;
  let from = f || plus(to, -13);
  if (from > to) return fail(400, 'bad_range');
  if (from < plus(to, -399)) from = plus(to, -399);
  const rows = attemptsOf(st);
  const inRange = rows.filter((r) => r.day >= from && r.day <= to);
  const students = [...st.students].sort(byName);
  const index = Object.fromEntries(students.map((s, i) => [s.id, i]));
  const topMistakes = (id) => byStair(inRange.filter((r) => r.sid === id))
    .map((list) => ({ topic: list[0].topic, cat: list[0].cat, level: list[0].level, n: list.length }))
    .sort((a, b) => b.n - a.n || byKey(a, b)).slice(0, 3);
  const assignments = st.assignments.filter((a) => a.dueOn >= from && a.startsOn <= to)
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1)).slice(0, 200);
  return ok({
    class: { name: st.cls.name, grade: st.cls.grade, teacherName: st.cls.teacherName },
    from, to, today, generatedAt: nowIso(),
    students: students.map((s) => {
      const mine = inRange.filter((r) => r.sid === s.id);
      const before = rows.filter((r) => r.sid === s.id && r.day <= to);
      return {
        name: s.name, joinedOn: dayOfIso(s.createdAt),
        lastPractice: before.length ? before.reduce((m, r) => (r.at > m ? r.at : m), '') : null,
        activeDays: new Set(mine.map((r) => r.day)).size, exercises: mine.length,
        firstTry: mine.reduce((x, r) => x + r.first, 0), correct: mine.reduce((x, r) => x + r.ok, 0), hinted: mine.reduce((x, r) => x + r.hint, 0),
        minutes: Math.round(mine.reduce((x, r) => x + r.secs, 0) / 60),
        levels: st.levels[s.id] || {},
        topMistakes: topMistakes(s.id),
      };
    }),
    assignments: assignments.map((a) => {
      const work = {};
      for (const id of forWhom(st, a)) {
        const w = workOf(st, a, id); const state = w?.state || 'none';
        work[index[id]] = { state, stage: w?.stage ?? null, right: w?.right ?? null, asked: w?.asked ?? null, passed: w?.passed ?? null, tries: num(w?.tries), late: lateOf(st, a, w) };
      }
      return { title: a.title, kind: a.kind, skill: a.skill, dueOn: a.dueOn, work };
    }),
    mistakes: classMistakes(st, inRange),
  });
}

/** GET /api/teacher/students/:id (worker/src/report.js studentDetail). */
function studentPage(st, id) {
  const s = st.students.find((x) => x.id === id);
  if (!s) return fail(404, 'not_found');
  const today = st.today;
  const mine = st.attempts.filter((r) => r.sid === id);
  const from14 = plus(today, -13); const from30 = plus(today, -29);
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const day = plus(from14, i); const list = mine.filter((r) => r.day === day);
    return { day, n: list.length, first: list.reduce((x, r) => x + r.first, 0), minutes: Math.round(list.reduce((x, r) => x + r.secs, 0) / 60) };
  });
  const mistakes = byStair(mine.filter((r) => r.day >= from30))
    .map((list) => ({ topic: list[0].topic, cat: list[0].cat, level: list[0].level, n: list.length, lastAt: list.reduce((m, r) => (r.at > m ? r.at : m), '') }))
    .sort((a, b) => b.n - a.n || cmp(b.lastAt, a.lastAt) || byKey(a, b)).slice(0, 8);
  const work = st.assignments.filter((a) => a.dueOn >= plus(today, -60) && a.startsOn <= today && forWhom(st, a).includes(id))
    .sort((a, b) => (a.dueOn < b.dueOn ? 1 : a.dueOn > b.dueOn ? -1 : a.createdAt < b.createdAt ? 1 : -1)).slice(0, 40)
    .map((a) => {
      const w = workOf(st, a, id); const state = w?.state || 'none';
      return { assignmentId: a.id, title: a.title, kind: a.kind, dueOn: a.dueOn, state, stage: w?.stage ?? null, right: w?.right ?? null, asked: w?.asked ?? null, passed: w?.passed ?? null, late: lateOf(st, a, w) };
    });
  const since = at(plus(today, -30), 0);
  const help = st.help.filter((h) => h.sid === id && h.createdAt >= since).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 20)
    .map((h) => ({ id: h.id, topic: h.topic, question: h.question, createdAt: h.createdAt, status: helpStatus(h, st.messages.filter((m) => m.helpId === h.id)) }));
  const exams = st.assignments.filter((a) => a.kind === 'exam' && workOf(st, a, id)?.state === 'done')
    .map((a) => { const w = workOf(st, a, id); return { id: `a:${a.id}`, title: a.title, correct: num(w.right), total: num(w.asked), at: w.doneAt, questions: w.questions || [] }; })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 20);
  return ok({
    student: { id: s.id, name: s.name, joinedOn: dayOfIso(s.createdAt), lastPractice: mine.length ? mine.reduce((m, r) => (r.at > m ? r.at : m), '') : null, pinReset: !!s.pinReset, aiOff: !!s.aiOff },
    days14, levels: st.levels[id] || {}, mistakes, work, help, exams,
  });
}

// ---- writes, checked as the Worker checks them
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g;
const cleanLine = (s, max) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanNote = (s, max) => String(s ?? '').replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30);
const TOPICS = TOPIC_IDS.filter((t) => t !== 'other');
function cleanSkill(v) {
  const m = String(v ?? '').match(/^([a-z]{2,10}):(\d{1,2})$/);
  if (!m || !TOPICS.includes(m[1])) return null;
  const level = Number(m[2]);
  return level >= 1 && level <= 12 ? `${m[1]}:${level}` : null;
}
const badAssignment = (field) => fail(400, 'bad_assignment', { field });
function dueDate(st, value, from = st.today) {
  const v = String(value ?? '');
  if (!isDay(v) || v < st.today || v > plus(st.today, 120)) return null;
  const due = schoolDay(v);
  return due.day < from ? null : due;
}

function createAssignment(st, b) {
  const kind = ['stair', 'check', 'exam'].includes(b.kind) ? b.kind : null;
  if (!kind) return badAssignment('kind');
  const skill = kind === 'exam' ? null : cleanSkill(b.skill);
  if (kind !== 'exam' && !skill) return badAssignment('skill');
  const startsOn = b.startsOn == null ? st.today : String(b.startsOn);
  if (!isDay(startsOn) || startsOn < st.today) return badAssignment('startsOn');
  const due = dueDate(st, b.dueOn, startsOn);
  if (!due) return badAssignment('dueOn');
  let exam = null; let version = null;
  if (kind === 'exam') {
    if (!b.exam || typeof b.exam !== 'object') return badAssignment('exam');
    version = b.exam.version == null ? 'a' : b.exam.version;
    if (!['a', 'b'].includes(version)) return badAssignment('version');
    const items = b.exam.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 14 || !items.every((it) => it && TOPICS.includes(it.topic) && typeof it.key === 'string')) return badAssignment('exam');
    exam = JSON.parse(JSON.stringify(items));
  }
  let targets = [];
  if (b.targets != null && !(Array.isArray(b.targets) && b.targets.length === 0)) {
    if (!Array.isArray(b.targets) || b.targets.length > 45 || !b.targets.every((t) => typeof t === 'string' && /^[a-f0-9]{1,64}$/.test(t))) return badAssignment('targets');
    targets = [...new Set(b.targets)];
    if (!targets.every((t) => live(st).has(t))) return badAssignment('targets');
  }
  if (st.assignments.filter((a) => a.dueOn >= plus(st.today, -14)).length >= 20) return fail(409, 'too_many_open');
  const a = {
    id: aid(st.next.assignment), kind, skill, title: cleanLine(b.title, 80) || (kind === 'exam' ? 'מבחן תרגול' : skill), note: cleanNote(b.note, 200),
    exam, version, forAll: !targets.length, targets, startsOn, dueOn: due.day, createdAt: nowIso(),
  };
  st.next.assignment += 1;
  st.assignments.push(a);
  st.work[a.id] = {};
  return ok({ assignment: viewOf(st, a), moved: due.moved }, 201);
}

function assignmentRoute(st, method, id, rest, b) {
  const a = st.assignments.find((x) => x.id === id);
  if (!a) return fail(404, 'not_found');
  if (method === 'POST' && rest === '/delete') {
    st.assignments = st.assignments.filter((x) => x !== a); delete st.work[a.id];
    return ok({ ok: true });
  }
  if (method === 'POST' && !rest) {
    let moved = false;
    if (b.dueOn !== undefined) { const due = dueDate(st, b.dueOn, a.startsOn); if (!due) return badAssignment('dueOn'); a.dueOn = due.day; moved = due.moved; }
    if (b.note !== undefined) a.note = cleanNote(b.note, 200);
    if (b.title !== undefined) { const title = cleanLine(b.title, 80); if (!title) return badAssignment('title'); a.title = title; }
    return ok({ assignment: viewOf(st, a), moved });
  }
  if (method !== 'GET' || rest) return fail(404, 'not_found');
  const rank = (w) => (w?.state === 'done' ? 2 : w?.state === 'started' ? 1 : 0);
  const work = forWhom(st, a).map((sid0) => ({ id: sid0, name: nameOf(st, sid0), w: workOf(st, a, sid0) }))
    .sort((x, y) => rank(x.w) - rank(y.w) || byName(x, y))
    .map(({ id: sid0, name, w }) => ({
      studentId: sid0, name, state: w?.state || 'none', stage: w?.stage ?? null, right: w?.right ?? null, asked: w?.asked ?? null,
      passed: w?.passed ?? null, questions: w?.questions ?? null, tries: w?.tries || 0, startedAt: w?.startedAt || null, doneAt: w?.doneAt || null,
      late: lateOf(st, a, w),
    }));
  return ok({ assignment: viewOf(st, a), exam: a.exam ? { items: a.exam } : null, work });
}

function helpRoute(st, method, id, rest, b) {
  const h = st.help.find((x) => x.id === id && live(st).has(x.sid));
  const readStudent = () => { st.messages.forEach((m) => { if (m.helpId === id && m.from === 'student') m.read = true; }); };
  if (rest === '/image') return fail(404, 'not_found');
  if (method !== 'POST') return fail(404, 'not_found');
  if (!rest) {
    if (!['seen', 'done', 'reopen'].includes(b.action)) return fail(400, 'bad_action');
    if (h) {
      if (b.action === 'seen') h.seenAt ||= nowIso();
      if (b.action === 'done') h.doneAt ||= nowIso();
      if (b.action === 'reopen') h.doneAt = null;
      readStudent();
    }
    return ok({ ok: true });
  }
  if (rest !== '/reply') return fail(404, 'not_found');
  if (!h) return fail(404, 'not_found');
  const text = cleanNote(b.body, 501);
  if (!text || text.length > 500) return fail(400, 'bad_reply');
  if (hasContact(text)) return fail(400, 'reply_has_contact');
  if (st.messages.filter((m) => m.helpId === id && m.from === 'teacher').length >= 3) return fail(409, 'reply_limit');
  const message = { id: st.next.message, helpId: id, from: 'teacher', body: text, at: nowIso(), read: false };
  st.next.message += 1;
  st.messages.push(message);
  h.seenAt ||= message.at;
  readStudent();
  return ok({ message: msgView(message) }, 201);
}

/** POST /api/teacher/class/ai (worker/src/classai.js setClassAi). */
function classAi(st, b) {
  const has = (k) => b[k] !== undefined;
  if (!has('studentAi') && !has('consent') && !has('setting')) return fail(400, 'bad_request');
  if ((has('studentAi') && !['on', 'off'].includes(b.studentAi)) || (has('consent') && b.consent !== true) || (has('setting') && !['school', 'private'].includes(b.setting))) return fail(400, 'bad_request');
  let next = { ...st.ai };
  if (has('setting') && b.setting !== st.ai.setting) {
    if (b.setting === 'private' && b.privateAttest !== true) return fail(400, 'private_attest_required');
    next = { setting: b.setting, studentAi: 'off', consentAt: null };
  }
  if (b.consent === true) next.consentAt = nowIso();
  if (b.studentAi === 'on') {
    const p = aiPolicyOf(st, next);
    if (!p.canTurnOn) return fail(409, 'class_ai_locked', { reason: p.reason });
    if (!next.consentAt) return fail(409, 'consent_needed');
    next.studentAi = 'on';
  } else if (b.studentAi === 'off') next.studentAi = 'off';
  st.ai = next;
  return ok({ policy: aiPolicyOf(st) });
}

/** One teacher route of the demo class: { status, body } in the Worker's shapes. */
export function demoApi(st, method = 'GET', fullPath = '', body = {}) {
  const M = String(method).toUpperCase();
  const [path, query = ''] = String(fullPath).split('?');
  const b = body && typeof body === 'object' ? body : {};
  let m;
  if (M === 'GET' && path === '/api/teacher/dashboard') return ok(dashboard(st));
  if (M === 'GET' && path === '/api/teacher/report') return report(st, new URLSearchParams(query));
  if ((m = path.match(/^\/api\/teacher\/students\/([a-f0-9]{1,32})(\/(reset-pin|remove|ai))?$/))) {
    const s = st.students.find((x) => x.id === m[1]);
    if (M === 'GET' && !m[2]) return studentPage(st, m[1]);
    if (M !== 'POST' || !m[2]) return fail(404, 'not_found');
    if (!s) return fail(404, 'not_found');
    if (m[3] === 'reset-pin') { s.pinReset = true; return ok({ ok: true }); }
    if (m[3] === 'ai') { if (typeof b.off !== 'boolean') return fail(400, 'bad_request'); s.aiOff = b.off; return ok({ aiOff: b.off }); }
    // remove: the student and everything of theirs on the board
    st.students = st.students.filter((x) => x.id !== s.id);
    const theirs = new Set(st.help.filter((h) => h.sid === s.id).map((h) => h.id));
    st.help = st.help.filter((h) => !theirs.has(h.id));
    st.messages = st.messages.filter((x) => !theirs.has(x.helpId));
    for (const w of Object.values(st.work)) delete w[s.id];
    st.assignments.forEach((a) => { a.targets = a.targets.filter((t) => t !== s.id); });
    return ok({ ok: true });
  }
  if (path === '/api/teacher/assignments') {
    if (M === 'GET') return ok({ today: st.today, assignments: [...st.assignments].sort((a, b2) => (a.dueOn < b2.dueOn ? 1 : a.dueOn > b2.dueOn ? -1 : a.createdAt < b2.createdAt ? 1 : -1)).slice(0, 60).map((a) => viewOf(st, a)) });
    if (M === 'POST') return createAssignment(st, b);
  }
  if ((m = path.match(/^\/api\/teacher\/assignments\/([a-f0-9]{16})(\/delete)?$/))) return assignmentRoute(st, M, m[1], m[2] || '', b);
  if ((m = path.match(/^\/api\/teacher\/help\/(\d+)(\/reply|\/image)?$/))) return helpRoute(st, M, Number(m[1]), m[2] || '', b);
  if (M === 'POST' && path === '/api/teacher/class/lock') { st.joinLocked = !!b.locked; return ok({ joinLocked: st.joinLocked }); }
  if (M === 'POST' && path === '/api/teacher/class/rename') {
    const name = cleanName(b.className);
    if (!name) return fail(400, 'missing_fields');
    st.cls.name = name;
    return ok({ ok: true, className: name });
  }
  if (M === 'POST' && path === '/api/teacher/class/ai') return classAi(st, b);
  if (M === 'POST' && path === '/api/teacher/class/digest') return fail(403, 'not_owner');
  if (M === 'GET' && path === '/api/teacher/licence') {
    return ok({ status: 'none', until: null, seats: null, students: st.students.length, aiWeek: 0, joinLocked: st.joinLocked, request: null, legacyUntil: null, offer: { seatYearAgorot: 4900, minSeats: 10, vatMode: 'included', online: false } });
  }
  if (M === 'POST' && (path === '/api/teacher/licence/request' || path === '/api/teacher/licence/claim')) {
    if ((path.endsWith('/claim') || b.wants !== 'quote') && NOT_SELLABLE.includes(aiPolicyOf(st).reason)) return fail(409, 'school_ai_not_approved', { reason: aiPolicyOf(st).reason });
    return fail(403, 'demo_readonly');
  }
  // the class itself and its keys stay as they are in the demo
  if (M === 'POST' && ['/api/teacher/class/delete', '/api/teacher/class/rekey', '/api/teacher/class/owner'].includes(path)) return fail(403, 'demo_readonly');
  if (path === '/api/teacher/classes') return fail(401, 'not_account');
  return fail(404, 'not_found');
}

// ---------------------------------------------------------------- this tab's demo
let mem = null;
onDemoExit(() => { mem = null; });
/** The demo's state for this tab: in memory, else the tab's copy (its practice rows drawn again from the seed), else new. */
export function demoSession() {
  if (mem) return mem;
  const kept = readDemo()?.data;
  if (kept?.v === 1 && kept.seed != null && kept.today) mem = { ...kept, attempts: demoState(kept.seed, kept.today).attempts };
  else mem = demoState(7);
  return mem;
}
function keep(st) { const { attempts, ...rest } = st; writeDemo({ data: rest }); } // eslint-disable-line no-unused-vars

/** A teacher call in the demo (lib/teacher.js teacherApi): the answer's body, or an ApiError as the server's would be. */
export async function demoCall(method = 'GET', path = '', body = {}) {
  const st = demoSession();
  const M = String(method).toUpperCase();
  const res = demoApi(st, M, path, body);
  if (res.status >= 400) throw new ApiError(res.body?.error || 'server_error', res.status, res.body);
  if (M !== 'GET') {
    keep(st);
    // opening a request marks it seen by itself: that is not something the teacher saved
    if (body?.action !== 'seen') toast(DEMO_COPY.saved, { id: 'demo-saved' });
  }
  return JSON.parse(JSON.stringify(res.body));
}
