// The class report as a CSV file (spec TEACHER-7 §3-4), and the grades of its range for Mashov or Webtop (PRODUCT2-32,
// gradesToCsv at the end): it opens right in Excel and Google Sheets in Hebrew (UTF-8
// with a BOM, comma-separated, CRLF line ends), and a name typed as a formula never runs (safeCell, on every text cell,
// the header cells included: names are typed by students, assignment titles by the teacher). Only what the students
// typed as their names: no ID number, no internal id (the report itself carries none, GET /api/teacher/report).
// reportToCsv is pure: the words for topics, stairs and mistakes come in as arguments. reportCsv binds the app's
// content; downloadCsv hands the file to the device.
import { topicsFor } from '@/content/index.js';
import { mistakeLine } from './teacherText.js';

export const BOM = '﻿';
export const CRLF = '\r\n';

/** A text cell that a spreadsheet would read as a formula (= + - @, a tab or a CR first) starts with ' instead. */
export const safeCell = (s) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

/**
 * One field: numbers as they are (never quoted; none in the report is negative), empty for null, text through safeCell,
 * then quoted when it holds a quote, a comma, a CR or an LF, or starts or ends with a space (a quote inside is doubled).
 */
export function csvField(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const s = safeCell(String(v));
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Rows of cells as the file's text: the BOM, a comma between fields, CRLF after every row. */
export const toCsv = (rows) => BOM + rows.map((r) => r.map(csvField).join(',') + CRLF).join('');

// ---------------------------------------------------------------- maths text, plain
// Until the parents lane's shared/plain.js (texToPlain, PARENTS-8) lands: a cell holds no TeX and no invisible
// direction marks (U+2066..U+2069 do not belong in a spreadsheet cell), and a minus is the real sign −.
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SYMBOL = { cdot: '·', times: '×', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', pm: '±', pi: 'π', circ: '°', approx: '≈', degree: '°' };
function texPlain(t) {
  let s = t;
  for (let i = 0; i < 4 && /\\frac\s*\{/.test(s); i += 1) s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√$1')
    .replace(/\\text\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\^\s*\\circ/g, '°')
    .replace(/\^\s*\{(\d+)\}|\^(\d)/g, (m, a, b) => [...(a || b)].map((d) => SUP[d]).join(''))
    .replace(/_\s*\{(\d+)\}|_(\d)/g, (m, a, b) => [...(a || b)].map((d) => SUB[d]).join(''))
    .replace(/\\([a-zA-Z]+)/g, (m, w) => SYMBOL[w] ?? '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/-/g, '−');
  return s.replace(/\s+/g, ' ').trim();
}
/** Text with $…$ maths, as plain text: "$(-3) \cdot (-4)$" → "(−3) · (−4)". Outside the maths nothing changes. */
export function stripTex(s) {
  return String(s ?? '').replace(/\$([^$]*)\$/g, (m, t) => texPlain(t)).replace(/[⁦-⁩‎‏]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- the report's rows
/** A Jerusalem day (YYYY-MM-DD) of an instant. */
const dayIn = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
/** YYYY-MM-DD → dd/mm/yyyy; and dd/mm. */
export const dmy = (day) => { const [y, m, d] = day.split('-'); return `${d}/${m}/${y}`; };
const ddmm = (day) => { const [, m, d] = day.split('-'); return `${d}/${m}`; };
export const pctOf = (a, b) => (b ? Math.round((100 * a) / b) : null);

/**
 * One student's work on an assignment, in plain words (the detail statuses of TEACHER-4 §7): "לא התחיל/ה",
 * "בדרך 3/5", "הושלם 8/10", "הושלם · שולט/ת", a repair's "הושלם · תוקן", and " (באיחור)" after the due date. Empty:
 * not given to them.
 */
export function workText(kind, w) {
  if (!w) return '';
  let s;
  if (!w.state || w.state === 'none') s = 'לא התחיל/ה';
  else if (kind === 'stair') s = w.state === 'done' ? `הושלם · ${w.passed ? 'שולט/ת' : 'עוד לא שולט/ת'}` : `בדרך ${w.stage || 0}/5`;
  else if (kind === 'repair') s = w.state === 'done' ? 'הושלם · תוקן' : 'התחיל/ה';
  else if (w.state !== 'done') s = 'התחיל/ה';
  else s = `הושלם ${w.right}/${w.asked}`;
  return w.late ? `${s} (באיחור)` : s;
}

/**
 * The CSV of a report (GET /api/teacher/report). Columns, in order: שם, ימים עם תרגול, תרגילים, נכון בניסיון ראשון (%),
 * דקות, תרגול אחרון (dd/mm/yyyy); one per topic of the class's grade, "{topic}: מדרגה" ("{level}/{levels} – {stair}");
 * one per assignment, "{title} (עד dd/mm)"; and טעויות שחוזרות (up to 3, joined by " · ").
 * `topics`: [{ id, title, levels: [stair titles] }]; `mistakeText(topic, level, cat)`: the words for a mistake.
 */
export function reportToCsv(report, { topics, mistakeText: words }) {
  const head = [
    'שם', 'ימים עם תרגול', 'תרגילים', 'נכון בניסיון ראשון (%)', 'דקות', 'תרגול אחרון',
    ...topics.map((t) => `${t.title}: מדרגה`),
    ...report.assignments.map((a) => `${stripTex(a.title)} (עד ${ddmm(a.dueOn)})`),
    'טעויות שחוזרות',
  ];
  const rows = report.students.map((s, i) => [
    s.name,
    s.activeDays,
    s.exercises,
    pctOf(s.firstTry, s.exercises),
    s.minutes,
    s.lastPractice ? dmy(dayIn(s.lastPractice)) : '',
    ...topics.map((t) => {
      const l = s.levels?.[t.id];
      return l ? `${l.level}/${t.levels.length} – ${t.levels[l.level - 1] || ''}`.trim() : '';
    }),
    ...report.assignments.map((a) => workText(a.kind, a.work?.[i])),
    (s.topMistakes || []).slice(0, 3).map((m) => stripTex(words(m.topic, m.level, m.cat))).join(' · '),
  ]);
  return toCsv([head, ...rows]);
}

/** The topics of a grade as reportToCsv reads them. */
export const csvTopics = (grade) => topicsFor(grade).map((t) => ({ id: t.id, title: t.title, levels: t.levels.map((l) => l.title) }));
/** The CSV of a report with the app's own words: each mistake as the student saw it, with its stair (TEACHER-16). */
export const reportCsv = (report) => reportToCsv(report, { topics: csvTopics(report.class?.grade || '7'), mistakeText: mistakeLine });

/** The file's name: madregot-{class}-{from}-{to}.csv, the class name kept to letters, digits and '-'. */
const nameOf = (className) => String(className || '').normalize('NFC').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'class';
export const csvName = (className, from, to) => `madregot-${nameOf(className)}-${from}-${to}.csv`;

// ---------------------------------------------------------------- grades for Mashov or Webtop (PRODUCT2-32)
/**
 * One student's grade on one assignment, 0-100, or null (an empty cell) when there is no result yet or the work was not
 * given to them. A class exam or a mastery check: the share right on the first finished try. A stair: 20 for each of
 * its first four stages, and 100 once its mastery check passed in this work (mastery from before is not this work,
 * SK-BUYERS-1). A repair: 100 once its check passed.
 */
export function gradeOf(kind, w) {
  if (!w || !w.state || w.state === 'none') return null;
  const done = w.state === 'done';
  if (kind === 'exam' || kind === 'check') return done && w.asked ? pctOf(w.right || 0, w.asked) : null;
  if (kind === 'repair') return done ? 100 : null;
  if (kind === 'stair') return done && w.passed ? 100 : 20 * Math.min(4, Math.max(0, Number(w.stage) || 0));
  return null;
}

/** Names in Hebrew alphabetical order, as a class list is (vowel marks aside; Hebrew before Latin). */
const byName = new Intl.Collator('he', { numeric: true }).compare;

/**
 * The grades of a report's range as a CSV for Mashov or Webtop: a row per student in Hebrew order, and a column per
 * assignment or class exam in the range ("{title} (עד dd/mm)") holding gradeOf. The same BOM, CRLF and formula guard as
 * the report's file, and only the names the students typed: no ID number (the app has none).
 */
export function gradesToCsv(report) {
  const head = ['שם', ...report.assignments.map((a) => `${stripTex(a.title)} (עד ${ddmm(a.dueOn)})`)];
  const order = report.students.map((s, i) => ({ s, i })).sort((x, y) => byName(x.s.name, y.s.name) || x.i - y.i);
  const rows = order.map(({ s, i }) => [s.name, ...report.assignments.map((a) => gradeOf(a.kind, a.work?.[i]))]);
  return toCsv([head, ...rows]);
}
/** The grades file's name: madregot-grades-{class}-{from}-{to}.csv. */
export const gradesCsvName = (className, from, to) => `madregot-grades-${nameOf(className)}-${from}-${to}.csv`;

const isIOS = () => typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/**
 * Hand the file to the device: a Blob and a temporary <a download>. On an iPhone or iPad, the share sheet when it can
 * take files (Save to Files, AirDrop, mail); if it cannot, or fails for a reason other than the teacher closing it, the
 * link as everywhere else. Resolves to 'shared', 'closed' (the share sheet was closed) or 'saved'.
 */
export async function downloadCsv(text, name) {
  const type = 'text/csv;charset=utf-8';
  if (isIOS() && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([text], name, { type });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'closed'; }
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}
