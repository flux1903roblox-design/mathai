// The class report as a CSV (spec TEACHER-7 §3-4): the BOM and CRLF that Excel needs for Hebrew, the exact columns,
// quoting, the formula guard on every text cell (header cells too), numbers as numbers, no ID-shaped number and no
// internal id, maths as plain text, and a round trip through a minimal RFC 4180 parser. Every name is synthetic.
import { describe, it, expect } from 'vitest';
import { reportToCsv, reportCsv, safeCell, csvField, toCsv, stripTex, csvName, workText, BOM, gradeOf, gradesToCsv, gradesCsvName } from './teacherCsv.js';

const TOPICS = [
  { id: 'signed', title: 'מספרים מכוונים', levels: ['חיבור וחיסור', 'השוואת מספרים', 'כפל וחילוק'] },
  { id: 'coord', title: 'מערכת צירים', levels: ['קריאת נקודה', 'סימון נקודה'] },
];
const WORDS = { 'signed:sign': 'חיברו במקום לחסר', 'signed:order': 'השוו בלי הסימן, כאילו $-9$ גדול מ־$2$', 'coord:swap': 'החליפו בין $x$ ל־$y$' };
const words = (topic, level, cat) => WORDS[`${topic}:${cat}`] || 'טעות שחוזרת';
const opts = { topics: TOPICS, mistakeText: words };

/** A report as GET /api/teacher/report gives it: rows by name, work by row index, no ids. */
const fixture = (over = {}) => ({
  class: { name: 'ז׳3', grade: '7', teacherName: 'רונית' }, from: '2026-11-01', to: '2026-11-12', today: '2026-11-12', generatedAt: '2026-11-12T08:00:00.000Z',
  students: [
    { name: 'דנה', joinedOn: '2026-09-02', lastPractice: '2026-11-11T22:30:00.000Z', activeDays: 4, exercises: 40, firstTry: 30, correct: 36, hinted: 3, minutes: 52,
      levels: { signed: { level: 2, max: 3 } }, topMistakes: [{ topic: 'signed', cat: 'sign', level: 1, n: 4 }, { topic: 'signed', cat: 'order', level: 2, n: 2 }] },
    { name: 'יואב', joinedOn: '2026-09-02', lastPractice: null, activeDays: 0, exercises: 0, firstTry: 0, correct: 0, hinted: 0, minutes: 0, levels: {}, topMistakes: [] },
  ],
  assignments: [
    { title: 'חיבור וחיסור', kind: 'stair', skill: 'signed:1', dueOn: '2026-11-12', work: {
      0: { state: 'done', stage: 5, passed: true, late: false }, 1: { state: 'none', late: false } } },
    { title: 'בדיקת שליטה: השוואת מספרים', kind: 'check', skill: 'signed:2', dueOn: '2026-11-05', work: {
      0: { state: 'done', right: 8, asked: 10, passed: true, late: true } } },
  ],
  mistakes: [],
  ...over,
});

/** A minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF between records (the BOM first is removed). */
function parseCsv(text) {
  const t = text.startsWith(BOM) ? text.slice(1) : text;
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\r' && t[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

describe('the CSV of a class report', () => {
  it('1. starts with the BOM, ends every row with CRLF, and has the exact header for a grade-7 class with 2 assignments', () => {
    const csv = reportToCsv(fixture(), opts);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(4); // header, two students, and the empty end
    expect(lines[0]).toBe('שם,ימים עם תרגול,תרגילים,נכון בניסיון ראשון (%),דקות,תרגול אחרון,מספרים מכוונים: מדרגה,מערכת צירים: מדרגה,חיבור וחיסור (עד 12/11),בדיקת שליטה: השוואת מספרים (עד 05/11),טעויות שחוזרות');
    // the last practice is the Jerusalem day (22:30 UTC on the 11th is the 12th there)
    expect(lines[1]).toBe('דנה,4,40,75,52,12/11/2026,2/3 – השוואת מספרים,,הושלם · שולט/ת,הושלם 8/10 (באיחור),"חיברו במקום לחסר · השוו בלי הסימן, כאילו −9 גדול מ־2"');
    expect(lines[2]).toBe('יואב,0,0,,0,,,,לא התחיל/ה,,');
    // the real grade-7 topics, read from the app's content
    const real = reportCsv(fixture()).slice(1).split('\r\n')[0];
    expect(real.split(',').slice(6, 9)).toEqual(['מספרים מכוונים: מדרגה', 'מערכת צירים: מדרגה', 'זוויות: מדרגה']);
  });

  it('2. quotes a field with a comma or a quote, and doubles the quote', () => {
    expect(csvField('דנה, "המלכה"')).toBe('"דנה, ""המלכה"""');
    expect(csvField('שורה\nשנייה')).toBe('"שורה\nשנייה"');
    expect(csvField(' רווח')).toBe('" רווח"');
    expect(csvField('רווח ')).toBe('"רווח "');
    expect(csvField('דנה')).toBe('דנה');
    const csv = reportToCsv(fixture({ students: [{ ...fixture().students[1], name: 'דנה, "המלכה"' }] }), opts);
    expect(csv.split('\r\n')[1].startsWith('"דנה, ""המלכה""",')).toBe(true);
  });

  it('3. a formula never runs: names and teacher-typed titles (header cells) start with an apostrophe', () => {
    expect(['=1+1', '+972', '-5', '@x', '\tx', '\rx'].map(safeCell)).toEqual(["'=1+1", "'+972", "'-5", "'@x", "'\tx", "'\rx"]);
    const names = ['=1+1', '+972', '-5', '@x'];
    const base = fixture().students[1];
    const r = fixture({
      students: names.map((name) => ({ ...base, name })),
      assignments: [{ title: '=HYPERLINK("x")', kind: 'stair', dueOn: '2026-11-12', work: {} }],
    });
    const rows = parseCsv(reportToCsv(r, opts));
    expect(rows.slice(1).map((x) => x[0])).toEqual(["'=1+1", "'+972", "'-5", "'@x"]);
    expect(rows[0][8]).toBe('\'=HYPERLINK("x") (עד 12/11)');
    expect(reportToCsv(r, opts)).toContain('"\'=HYPERLINK(""x"") (עד 12/11)"');
    // no cell of the file starts with a formula character
    for (const cell of rows.flat()) expect(cell).not.toMatch(/^[=+\-@\t\r]/);
  });

  it('4. numbers are written as numbers, never quoted', () => {
    expect(csvField(40)).toBe('40');
    expect(csvField(0)).toBe('0');
    expect(csvField(null)).toBe('');
    expect(csvField(Number.NaN)).toBe('');
    const line = reportToCsv(fixture(), opts).split('\r\n')[1];
    expect(line.startsWith('דנה,4,40,75,52,')).toBe(true);
    expect(toCsv([[1, 'a', 2.5]])).toBe(`${BOM}1,a,2.5\r\n`);
  });

  it('5. no ID-shaped number and no internal id, even when the source has them', () => {
    const ids = { id: 'a1b2c3d4e5f60718', studentId: '0f1e2d3c4b5a6978' };
    const r = fixture();
    r.students = r.students.map((s, i) => ({ ...s, ...ids, studentId: `${ids.studentId.slice(0, 15)}${i}` }));
    r.assignments = r.assignments.map((a) => ({ ...a, id: 'ffffeeeeddddcccc' }));
    const csv = reportToCsv(r, opts);
    expect(csv).not.toMatch(/[0-9a-f]{16}/);
    for (const cell of parseCsv(csv).flat()) expect(cell).not.toMatch(/^\d{9}$/);
  });

  it('6. maths is plain text with the real minus, and no invisible direction marks', () => {
    expect(stripTex('$(-3) \\cdot (-4)$')).toBe('(−3) · (−4)');
    expect(stripTex('השלימו ל־$90^\\circ$ במקום ל־$180^\\circ$')).toBe('השלימו ל־90° במקום ל־180°');
    expect(stripTex('$\\frac{3}{4}$ ו־$c^2$ ו־$m x_1$ ו־$<$ או $\\le$')).toBe('3/4 ו־c² ו־m x₁ ו־< או ≤');
    expect(stripTex('דו-ספרתי, בלי מתמטיקה')).toBe('דו-ספרתי, בלי מתמטיקה');
    const r = fixture();
    r.students[0].topMistakes = [{ topic: 'signed', cat: 'rule', level: 3, n: 1 }];
    const csv = reportToCsv(r, { topics: TOPICS, mistakeText: () => 'השתמשו בכלל של חיבור, למשל $(-3) \\cdot (-4) = -12$' });
    expect(csv).toContain('(−3) · (−4) = −12');
    expect(csv).not.toMatch(/[⁦-⁩$\\]/);
    // the app's own words for a stair's mistake, through the same path
    const real = fixture();
    real.students[0].topMistakes = [{ topic: 'signed', cat: 'rule', level: 3, n: 1 }];
    expect(reportCsv(real)).not.toMatch(/[⁦-⁩$\\]/);
    // each mistake with its stair (TEACHER-16): the same id on two stairs is told apart
    real.students[0].topMistakes = [{ topic: 'signed', cat: 'sign', level: 3, n: 2 }, { topic: 'signed', cat: 'sign', level: 1, n: 1 }];
    const cell = parseCsv(reportCsv(real))[1].at(-1);
    expect(cell).toMatch(/^.+ \(מספרים מכוונים, מדרגה 3\) · .+ \(מספרים מכוונים, מדרגה 1\)$/);
  });

  it('7. the fixture round-trips: every cell parsed back is the cell written', () => {
    const r = fixture();
    r.students.push({ ...r.students[1], name: 'נועה "הקטנה", ז\'' });
    const csv = reportToCsv(r, opts);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(4);
    expect(rows.every((x) => x.length === rows[0].length)).toBe(true);
    expect(rows[3][0]).toBe('נועה "הקטנה", ז\'');
    expect(rows[1]).toEqual(['דנה', '4', '40', '75', '52', '12/11/2026', '2/3 – השוואת מספרים', '', 'הושלם · שולט/ת', 'הושלם 8/10 (באיחור)',
      'חיברו במקום לחסר · השוו בלי הסימן, כאילו −9 גדול מ־2']);
    // and writing the parsed rows again gives the same file
    expect(toCsv(rows.map((x) => x.map((c) => (/^\d+$/.test(c) ? Number(c) : c))))).toBe(csv);
  });
});

describe('the words and the file name', () => {
  it('each student\'s work in plain words', () => {
    expect(workText('stair', undefined)).toBe('');
    expect(workText('stair', { state: 'none', late: true })).toBe('לא התחיל/ה (באיחור)');
    expect(workText('stair', { state: 'started', stage: 3 })).toBe('בדרך 3/5');
    expect(workText('stair', { state: 'done', passed: false })).toBe('הושלם · עוד לא שולט/ת');
    expect(workText('check', { state: 'started' })).toBe('התחיל/ה');
    expect(workText('exam', { state: 'done', right: 5, asked: 6, late: false })).toBe('הושלם 5/6');
    // a repair the teacher gave (SK-BUYERS-2): fixed once its check passed
    expect(workText('repair', { state: 'started' })).toBe('התחיל/ה');
    expect(workText('repair', { state: 'done', late: true })).toBe('הושלם · תוקן (באיחור)');
  });
  it('the file name keeps letters, digits and dashes of the class name', () => {
    expect(csvName('ז׳3', '2026-09-01', '2026-11-10')).toBe('madregot-ז3-2026-09-01-2026-11-10.csv');
    expect(csvName('ח׳ 2 / מתמטיקה', '2026-11-01', '2026-11-05')).toBe('madregot-ח-2-מתמטיקה-2026-11-01-2026-11-05.csv');
    expect(csvName('../..', '2026-11-01', '2026-11-05')).toBe('madregot-class-2026-11-01-2026-11-05.csv');
  });
});

// PRODUCT2-32: grades for Mashov or Webtop. One row per student by name in Hebrew order (as a class list is), and one
// number 0-100 per assignment or class exam in the range, so a column pastes straight into the school system's grade
// sheet. The same BOM, CRLF and formula guard as the report's file; only names, never an ID number.
describe('the grades file for Mashov and Webtop (PRODUCT2-32)', () => {
  const report = () => fixture({
    students: [
      { name: 'Ben', levels: {}, topMistakes: [] },
      { name: 'נוֹעם', levels: {}, topMistakes: [] },
      { name: 'אלה', levels: {}, topMistakes: [] },
      { name: '=דנה', levels: {}, topMistakes: [] },
      { name: 'נועה', levels: {}, topMistakes: [] },
    ],
    assignments: [
      { title: 'מבחן תרגול: שבוע 3', kind: 'exam', skill: null, dueOn: '2026-11-10', work: {
        0: { state: 'done', right: 5, asked: 6 }, 1: { state: 'started' }, 2: { state: 'done', right: 6, asked: 6 }, 3: { state: 'none' }, 4: { state: 'done', right: 0, asked: 6 } } },
      { title: 'בדיקת שליטה: $-3$ ועוד', kind: 'check', skill: 'signed:2', dueOn: '2026-11-05', work: {
        2: { state: 'done', right: 4, asked: 5, passed: true }, 4: { state: 'done', right: 2, asked: 5, passed: false } } },
      { title: 'מספרים מכוונים: חיבור וחיסור', kind: 'stair', skill: 'signed:1', dueOn: '2026-11-12', work: {
        0: { state: 'started', stage: 3 }, 1: { state: 'done', stage: 5, passed: true }, 2: { state: 'done', stage: 4, passed: false },
        3: { state: 'started', stage: 5, passed: true }, 4: { state: 'none' } } },
      { title: 'תיקון טעות: חיבור וחיסור', kind: 'repair', skill: 'signed:1', misc: 'sign', dueOn: '2026-11-12', work: {
        2: { state: 'done' }, 4: { state: 'started' } } },
    ],
  });
  it('a number 0-100 for each result; an empty cell when there is none yet or the work was not given', () => {
    expect(gradeOf('exam', { state: 'done', right: 5, asked: 6 })).toBe(83);
    expect(gradeOf('exam', { state: 'started' })).toBeNull();
    expect(gradeOf('check', { state: 'done', right: 4, asked: 5, passed: true })).toBe(80);
    expect(gradeOf('check', undefined)).toBeNull();
    // a stair: 20 for each of its first four stages, and 100 only once its mastery check passed in this work
    expect(gradeOf('stair', { state: 'started', stage: 3 })).toBe(60);
    expect(gradeOf('stair', { state: 'done', stage: 5, passed: true })).toBe(100);
    expect(gradeOf('stair', { state: 'done', stage: 4, passed: false })).toBe(80);
    expect(gradeOf('stair', { state: 'started', stage: 5, passed: true })).toBe(80); // mastered before, not again (SK-BUYERS-1)
    expect(gradeOf('stair', { state: 'none' })).toBeNull();
    // a repair: 100 once its check passed
    expect(gradeOf('repair', { state: 'done' })).toBe(100);
    expect(gradeOf('repair', { state: 'started' })).toBeNull();
  });
  it('one row per student in Hebrew order, one grade column per assignment, numbers unquoted, the formula guard', () => {
    const csv = gradesToCsv(report());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(['שם', 'מבחן תרגול: שבוע 3 (עד 10/11)', 'בדיקת שליטה: −3 ועוד (עד 05/11)', 'מספרים מכוונים: חיבור וחיסור (עד 12/11)', 'תיקון טעות: חיבור וחיסור (עד 12/11)']);
    // Hebrew order (the vowel marks do not move a name, and Hebrew comes before Latin), each with its own results
    expect(rows.slice(1)).toEqual([
      ["'=דנה", '', '', '80', ''], // a symbol sorts before the letters
      ['אלה', '100', '80', '80', '100'],
      ['נועה', '0', '40', '', ''],
      ['נוֹעם', '', '', '100', ''],
      ['Ben', '83', '', '60', ''],
    ]);
    expect(csv).toContain('\r\nאלה,100,80,80,100\r\n');
    expect(csv).not.toMatch(/\d{9}/);
  });
  it('a range with no assignments is the names alone; the file name says it holds grades', () => {
    expect(parseCsv(gradesToCsv({ ...report(), assignments: [] }))).toEqual([['שם'], ["'=דנה"], ['אלה'], ['נועה'], ['נוֹעם'], ['Ben']]);
    expect(gradesCsvName('ז׳3', '2026-11-01', '2026-11-12')).toBe('madregot-grades-ז3-2026-11-01-2026-11-12.csv');
  });
});
