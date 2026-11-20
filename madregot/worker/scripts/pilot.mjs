// The pilot's numbers (spec TEACHER-11): what the two-week plan measures (web/src/content/schools/pilot-plan.md §3),
// each with an exact definition, from the live database by one read-only owner command
// (npm run owner -- pilot-report, scripts/owner.mjs). Pure: pilotQueries builds SELECTs, pilotReport counts their rows.
//
// The output has no names and no student ids: aggregates only, with n next to every percentage, and any percentage
// whose n is below 5 says "מעט מדי נתונים" instead of a number. Weeks are school weeks, Sunday to Saturday, in
// Jerusalem; attempts carry their Jerusalem day, help requests their instant (compared with the range's Jerusalem
// midnights). N is --consented when given, else the number of students in the class.
//
//   key                label                                   definition
//   joined             הצטרפו                                  students in the class
//   was[w]             פעילים בשבוע w                          students with ≥ 1 attempt in week w ÷ N
//   returnRate         חזרו בשבוע 2                            of those active in week 1, the share active in week 2
//   daysMedian[w]      ימי תרגול (חציון)                       median, over the week's active students, of distinct days
//   minutesMedian[w]   דקות בשבוע (חציון)                      median, over the week's active students, of SUM(secs)/60
//   assignDone         משימות שהושלמו בזמן                     Σ done with done_day ≤ due_on ÷ Σ assigned, over
//                                                              assignments due in the range; also per assignment
//   checkPass          עברו בדיקת שליטה                        passed ÷ done, for stair and check assignments
//   firstTryEarlyLate  נכון בניסיון ראשון על המדרגות שניתנו    on the assignments' stairs: the first 3 school days
//                                                              (Sunday to Thursday) against the last 3, n answers each
//   prePost            מבחן לפני ואחרי                         students who finished both --pre and --post: mean
//                                                              right/asked before and after, the mean paired
//                                                              difference, the share who improved, n
//   helpPerStudent     בקשות עזרה לתלמיד                       help requests in the range ÷ N
//   reply24h           נענו תוך יום                            requests with a teacher message within 24 h ÷ requests
//   replyMedianH       זמן תשובה (חציון, שעות)                 median hours to the first teacher message
import { startOfDayIso, endOfDayIso, nextDay } from '../src/util.js';

export const TOO_FEW = 'מעט מדי נתונים';
export const MIN_N = 5;
export const PREPOST_CAVEAT = 'בלי קבוצת השוואה זה לא מוכיח השפעה. אם יש כיתה מקבילה שעשתה את אותם מבחנים על דף, השוו את ההפרש.';
export const CLASS_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const ASSIGNMENT_RE = /^[a-f0-9]{16}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A SQL string literal, quotes doubled, as owner.mjs writes them (inputs are validated before). */
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const isDay = (s) => DAY_RE.test(String(s || '')) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

function check({ classCode, from, to, pre = null, post = null }) {
  if (!CLASS_RE.test(String(classCode || ''))) throw new Error(`bad class code: ${classCode}`);
  if (!isDay(from) || !isDay(to) || from > to) throw new Error('--from and --to are YYYY-MM-DD, from on or before to');
  for (const id of [pre, post]) if (id !== null && !ASSIGNMENT_RE.test(String(id))) throw new Error(`bad assignment id: ${id}`);
}

/**
 * The SELECTs, by name. Every one is limited to the class; nothing writes. Rows carry student ids only so that the
 * counts can be joined; pilotReport never puts one in its output.
 */
export function pilotQueries({ classCode, from, to, pre = null, post = null }) {
  check({ classCode, from, to, pre, post });
  const C = q(classCode); const F = q(from); const T = q(to);
  const inClass = `st.class_code = ${C}`;
  const due = `x.due_on BETWEEN ${F} AND ${T}`;
  const exams = [pre, post].filter(Boolean);
  const dueOrExam = exams.length ? `(${due} OR x.id IN (${exams.map(q).join(', ')}))` : due;
  return {
    students: `SELECT st.id AS s FROM students st WHERE ${inClass};`,
    activity: `SELECT a.student_id AS s, a.day, COUNT(*) AS n, SUM(a.secs) AS secs FROM attempts a JOIN students st ON st.id = a.student_id
  WHERE ${inClass} AND a.day BETWEEN ${F} AND ${T} GROUP BY a.student_id, a.day;`,
    answers: `SELECT a.day, a.topic, a.level, COUNT(*) AS n, SUM(a.first_try) AS first FROM attempts a JOIN students st ON st.id = a.student_id
  WHERE ${inClass} AND a.day BETWEEN ${F} AND ${T} GROUP BY a.day, a.topic, a.level;`,
    assignments: `SELECT x.id, x.kind, x.skill, x.title, x.for_all, x.due_on FROM assignments x WHERE x.class_code = ${C} AND ${due};`,
    examStairs: `SELECT DISTINCT x.id, json_extract(e.value, '$.topic') AS topic, json_extract(e.value, '$.level') AS level
  FROM assignments x, json_each(x.exam) e WHERE x.class_code = ${C} AND x.kind = 'exam' AND ${due};`,
    targets: `SELECT t.assignment_id AS a, t.student_id AS s FROM assignment_targets t JOIN assignments x ON x.id = t.assignment_id
  WHERE x.class_code = ${C} AND ${due};`,
    work: `SELECT w.assignment_id AS a, w.student_id AS s, w.state, w.passed, w.right_n, w.asked, w.done_day
  FROM assignment_work w JOIN assignments x ON x.id = w.assignment_id JOIN students st ON st.id = w.student_id
  WHERE x.class_code = ${C} AND ${inClass} AND ${dueOrExam};`,
    help: `SELECT h.id, h.created_at, (SELECT MIN(m.created_at) FROM help_messages m WHERE m.help_id = h.id AND m.from_role = 'teacher') AS first_reply
  FROM help_requests h JOIN students st ON st.id = h.student_id
  WHERE ${inClass} AND h.created_at >= ${q(startOfDayIso(from))} AND h.created_at < ${q(endOfDayIso(to))};`,
  };
}

/** pilot-report --list: the class's exam assignments (id, title, version, due date, how many finished). */
export function examListSql(classCode) {
  if (!CLASS_RE.test(String(classCode || ''))) throw new Error(`bad class code: ${classCode}`);
  return `SELECT x.id, x.title, x.version, x.due_on, (SELECT COUNT(*) FROM assignment_work w WHERE w.assignment_id = x.id AND w.state = 'done') AS done
  FROM assignments x WHERE x.class_code = ${q(classCode)} AND x.kind = 'exam' ORDER BY x.created_at;`;
}

// ---------------------------------------------------------------- counting
const dow = (day) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 Sunday … 6 Saturday
const shift = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const sunday = (day) => shift(day, -dow(day));
/** The range's school weeks, Sunday to Saturday, clipped to the range: [{ w, from, to }]. */
export function weeksOf(from, to) {
  const out = [];
  for (let s = sunday(from), w = 1; s <= to; s = shift(s, 7), w++) out.push({ w, from: s < from ? from : s, to: shift(s, 6) > to ? to : shift(s, 6) });
  return out;
}
const weekOf = (weeks, day) => weeks.find((x) => day >= x.from && day <= x.to)?.w || null;
/** The days of the range that are school days (Sunday to Thursday). */
export function schoolDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = nextDay(d)) if (dow(d) <= 4) out.push(d);
  return out;
}
export function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round = (x, d = 3) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
/** k of n, with the share only when n is enough. */
export const share = (k, n) => ({ k, n, rate: n >= MIN_N ? round(k / n, 4) : null, ...(n < MIN_N ? { tooFew: true } : {}) });
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * The numbers from the queries' rows (results[name] = rows). opts: { from, to, consented, pre, post }.
 * Aggregates only: no name, no student id.
 */
export function pilotReport(results, { from, to, consented = null, pre = null, post = null } = {}) {
  const r = (k) => results[k] || [];
  const students = new Set(r('students').map((x) => x.s));
  const joined = students.size;
  const N = consented ? Number(consented) : joined;
  const weeks = weeksOf(from, to);

  // activity per week: student → { days, secs }
  const byWeek = new Map(weeks.map((x) => [x.w, new Map()]));
  for (const a of r('activity')) {
    const w = weekOf(weeks, a.day); if (!w || !students.has(a.s)) continue;
    const m = byWeek.get(w); const cur = m.get(a.s) || { days: new Set(), secs: 0 };
    cur.days.add(a.day); cur.secs += Number(a.secs) || 0; m.set(a.s, cur);
  }
  const was = {}; const daysMedian = {}; const minutesMedian = {};
  for (const { w } of weeks) {
    const m = byWeek.get(w);
    was[w] = share(m.size, N);
    daysMedian[w] = { median: median([...m.values()].map((x) => x.days.size)), n: m.size };
    minutesMedian[w] = { median: round(median([...m.values()].map((x) => x.secs / 60)), 1), n: m.size };
  }
  const w1 = byWeek.get(1) || new Map(); const w2 = byWeek.get(2);
  const returnRate = w2 ? share([...w1.keys()].filter((s) => w2.has(s)).length, w1.size) : null;

  // assignments due in the range
  const work = r('work');
  const workOf = (id) => work.filter((x) => x.a === id && students.has(x.s));
  const targets = new Map();
  for (const t of r('targets')) { if (!targets.has(t.a)) targets.set(t.a, new Set()); targets.get(t.a).add(t.s); }
  const per = r('assignments').map((x) => {
    const assigned = x.for_all ? [...students] : [...(targets.get(x.id) || [])].filter((s) => students.has(s));
    const mine = workOf(x.id).filter((w) => assigned.includes(w.s));
    const done = mine.filter((w) => w.state === 'done');
    const onTime = done.filter((w) => w.done_day && w.done_day <= x.due_on);
    return { title: x.title, kind: x.kind, dueOn: x.due_on, assigned: assigned.length, done: done.length, onTime: onTime.length,
      passed: done.filter((w) => Number(w.passed) === 1).length, rate: share(onTime.length, assigned.length).rate };
  }).sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));
  const sum = (xs, k) => xs.reduce((a, x) => a + x[k], 0);
  const assignDone = { ...share(sum(per, 'onTime'), sum(per, 'assigned')), per };
  const graded = per.filter((x) => x.kind === 'stair' || x.kind === 'check');
  const checkPass = share(sum(graded, 'passed'), sum(graded, 'done'));

  // first try on the assignments' stairs: the first three school days against the last three
  const stairs = new Set([
    ...r('assignments').filter((x) => x.skill).map((x) => x.skill),
    ...r('examStairs').map((x) => `${x.topic}:${x.level}`),
  ]);
  const days = schoolDays(from, to);
  const span = (ds) => {
    const set = new Set(ds); let right = 0; let n = 0;
    for (const a of r('answers')) if (set.has(a.day) && stairs.has(`${a.topic}:${a.level}`)) { right += Number(a.first) || 0; n += Number(a.n) || 0; }
    return { from: ds[0] || null, to: ds[ds.length - 1] || null, ...share(right, n) };
  };
  const firstTryEarlyLate = { early: span(days.slice(0, 3)), late: span(days.slice(-3)) };

  // the class exams before and after, paired per student
  let prePost = null;
  if (pre && post) {
    const score = (id) => new Map(work.filter((x) => x.a === id && x.state === 'done' && Number(x.asked) > 0 && students.has(x.s))
      .map((x) => [x.s, Number(x.right_n) / Number(x.asked)]));
    const a = score(pre); const b = score(post);
    const both = [...a.keys()].filter((s) => b.has(s));
    const n = both.length;
    const enough = n >= MIN_N;
    const diffs = both.map((s) => b.get(s) - a.get(s));
    prePost = {
      n, before: enough ? round(mean(both.map((s) => a.get(s)))) : null, after: enough ? round(mean(both.map((s) => b.get(s)))) : null,
      meanDiff: enough ? round(mean(diffs)) : null, improved: share(diffs.filter((d) => d > 0).length, n),
      onlyBefore: a.size - n, onlyAfter: b.size - n, ...(enough ? {} : { tooFew: true }), caveat: PREPOST_CAVEAT,
    };
  }

  // help requests and the teacher's answers
  const help = r('help');
  const hours = help.filter((h) => h.first_reply).map((h) => (Date.parse(h.first_reply) - Date.parse(h.created_at)) / 36e5);
  const helpPerStudent = { requests: help.length, n: N, perStudent: N ? round(help.length / N, 2) : null };
  const reply24h = share(hours.filter((h) => h <= 24).length, help.length);
  const replyMedianH = { median: round(median(hours), 1), n: hours.length };

  return {
    range: { from, to, weeks }, N, consented: consented ? Number(consented) : null, joined,
    was, returnRate, daysMedian, minutesMedian, assignDone, checkPass, firstTryEarlyLate, prePost, helpPerStudent, reply24h, replyMedianH,
  };
}

// ---------------------------------------------------------------- the owner's table
const dmy = (d) => (d ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}` : '–');
const pct = (s) => (!s ? '–' : s.rate === null || s.tooFew ? `${TOO_FEW} (n=${s.n})` : `${Math.round(s.rate * 100)}% (${s.k} מתוך ${s.n})`);
const num = (x, n) => (x == null ? `– (n=${n})` : `${x} (n=${n})`);
const KIND = { stair: 'ללמוד מדרגה', check: 'בדיקת שליטה', exam: 'מבחן תרגול' };

/** The report as the Hebrew table the owner reads (no names, no ids). */
export function pilotText(rep, classCode = '') {
  const lines = [];
  const row = (label, value) => lines.push(`${label}: ${value}`);
  lines.push(`דוח פיילוט${classCode ? `, כיתה ${classCode}` : ''}: ${dmy(rep.range.from)}–${dmy(rep.range.to)} (שבועות מראשון עד שבת)`);
  lines.push(`N = ${rep.N}${rep.consented ? ' (אישרו השתתפות)' : ' (כל התלמידים בכיתה)'}`);
  lines.push('');
  row('הצטרפו', rep.joined);
  for (const { w, from, to } of rep.range.weeks) row(`פעילים בשבוע ${w} (${dmy(from)}–${dmy(to)})`, pct(rep.was[w]));
  if (rep.returnRate) row('חזרו בשבוע 2', pct(rep.returnRate));
  for (const { w } of rep.range.weeks) row(`ימי תרגול (חציון), שבוע ${w}`, num(rep.daysMedian[w].median, rep.daysMedian[w].n));
  for (const { w } of rep.range.weeks) row(`דקות בשבוע (חציון), שבוע ${w}`, num(rep.minutesMedian[w].median, rep.minutesMedian[w].n));
  row('משימות שהושלמו בזמן', pct(rep.assignDone));
  for (const a of rep.assignDone.per) lines.push(`  ${a.title} (${KIND[a.kind] || a.kind}, עד ${dmy(a.dueOn)}): ${pct(share(a.onTime, a.assigned))}`);
  row('עברו בדיקת שליטה', pct(rep.checkPass));
  const { early, late } = rep.firstTryEarlyLate;
  row('נכון בניסיון ראשון על המדרגות שניתנו', `שלושת הימים הראשונים ${pct(early)}, שלושת האחרונים ${pct(late)}`);
  if (rep.prePost) {
    const p = rep.prePost;
    if (p.tooFew) row('מבחן לפני ואחרי', `${TOO_FEW} (n=${p.n})`);
    else {
      const sign = p.meanDiff > 0 ? '+' : '';
      row('מבחן לפני ואחרי', `לפני ${Math.round(p.before * 100)}%, אחרי ${Math.round(p.after * 100)}%, הפרש ממוצע ${sign}${Math.round(p.meanDiff * 100)} נקודות אחוז, השתפרו ${pct(p.improved)}`);
    }
    if (p.onlyBefore || p.onlyAfter) lines.push(`  עשו רק את מבחן הפתיחה: ${p.onlyBefore}, רק את מבחן הסיום: ${p.onlyAfter} (לא נכללים)`);
    lines.push(`  ${p.caveat}`);
  }
  row('בקשות עזרה לתלמיד', `${rep.helpPerStudent.perStudent ?? '–'} (${rep.helpPerStudent.requests} בקשות, N=${rep.helpPerStudent.n})`);
  row('נענו תוך יום', pct(rep.reply24h));
  row('זמן תשובה (חציון, שעות)', num(rep.replyMedianH.median, rep.replyMedianH.n));
  return lines.join('\n');
}

/** --list as a table: id, title, version, due date, finished. */
export function examListText(rows) {
  if (!rows.length) return 'אין בכיתה הזו מבחני כיתה.';
  return ['id                 גרסה  עד          סיימו  כותרת',
    ...rows.map((x) => `${x.id}   ${x.version === 'b' ? 'ב׳' : 'א׳'}    ${String(dmy(x.due_on)).padEnd(10)}  ${String(x.done).padStart(5)}  ${x.title}`)].join('\n');
}
