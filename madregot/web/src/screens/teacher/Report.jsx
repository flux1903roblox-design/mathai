// The class report (spec TEACHER-7 §2), at /teacher/report, for the class open on the board: a range (this week, two
// weeks, this month, from the start of the school year, or one the teacher picks), four tiles, a table of the students
// (by name, the CSV's columns), the class's repeated mistakes in the range, and two actions: the CSV for Excel and a
// printout (landscape, the table only, a header with the class and the range, 25 students a page). The report has no
// student ids (worker/src/report.js); TEACHER-8 turns the names into buttons with the board's name → id map.
// ?range=year&csv=1 (the class settings' "הורדת הדוח של כל השנה") opens the year and starts the CSV once.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Users, CalendarDays, Target, ListChecks, FileDown, Printer } from 'lucide-react';
import { useApp, today as todayOf } from '@/lib/store.js';
import { RANGES, rangeDays, customRange, rangeText, dmyDots, fetchReport, saveReportCsv, MAX_DAYS } from '@/lib/report.js';
import { workText, pctOf, stripTex } from '@/lib/teacherCsv.js';
import { mistakeText } from '@/lib/teacherText.js';
import { plusDays, dm } from '@/lib/workDates.js';
import { TOPIC, topicsFor } from '@/content/index.js';
import { Stat } from '@/components/ds.jsx';
import { Button, ChapterMark, LevelPips } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import { ScreenBar, ScreenFoot, EmptyState } from '@/components/Screen.jsx';
import { Rate } from './common.jsx';
import { printSheet } from './ExamSheet.jsx';

export const REPORT_NOTE = 'בקובץ יש רק את השמות כפי שהתלמידים כתבו אותם, בלי תעודות זהות ובלי מספרים מזהים. שמרו אותו במקום מוגן, ומחקו אותו כשכבר לא צריך.';
export const EMPTY_RANGE = 'בטווח הזה עוד לא היה תרגול בכיתה.';
/** Printed: a column per assignment up to this many; more, and one column counts what each student finished. */
const PRINT_ASSIGNMENTS = 6;
/** Students on one printed page. */
const PRINT_ROWS = 25;
const IDS = RANGES.map(([id]) => id);

/** "5.11", or "5.11.2025" in another year. */
const shortDay = (iso, thisYear) => {
  if (!iso) return '';
  const day = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  return day.slice(0, 4) === thisYear ? dm(day) : dmyDots(day);
};
/** "4.2", without a trailing ".0". */
const oneDecimal = (n) => String(Math.round(n * 10) / 10);

/** A student's mistakes in the range, as the student saw them. */
const mistakeWords = (s) => (s.topMistakes || []).map((m) => mistakeText(m.topic, m.level, m.cat));

/** The printed copy, at the end of <body>: hidden on screen; printed, it is the only thing on the page. */
function PrintReport({ report, topics, title }) {
  const many = report.assignments.length > PRINT_ASSIGNMENTS;
  const cols = 6 + topics.length + (many ? 1 : report.assignments.length) + 1;
  const made = dmyDots(todayOf(new Date(report.generatedAt)));
  return createPortal(
    <div className="print-root" dir="rtl" lang="he">
      <section className="print-sheet" data-mode="report">
        <table className="pr-table">
          <thead>
            <tr><th colSpan={cols} className="pr-head">{title} · {rangeText(report.from, report.to)} · הופק ב־{made}</th></tr>
            <tr>
              <th scope="col">שם</th><th scope="col">ימים עם תרגול</th><th scope="col">תרגילים</th><th scope="col">נכון בניסיון ראשון</th>
              <th scope="col">דקות</th><th scope="col">תרגול אחרון</th>
              {topics.map((t) => <th key={t.id} scope="col">{t.title}</th>)}
              {many ? <th scope="col">משימות שהושלמו</th> : report.assignments.map((a, i) => <th key={i} scope="col">{stripTex(a.title)} (עד {dm(a.dueOn)})</th>)}
              <th scope="col">טעויות שחוזרות</th>
            </tr>
          </thead>
          <tbody>
            {report.students.map((s, i) => {
              const given = report.assignments.filter((a) => a.work[i]);
              const done = given.filter((a) => a.work[i].state === 'done').length;
              const p = pctOf(s.firstTry, s.exercises);
              return (
                <tr key={i} className={clsx((i + 1) % PRINT_ROWS === 0 && i + 1 < report.students.length && 'pr-break')}>
                  <th scope="row">{s.name}</th>
                  <td>{s.activeDays}</td><td>{s.exercises}</td><td>{p == null ? '–' : `${p}%`}</td><td>{s.minutes}</td>
                  <td>{s.lastPractice ? dmyDots(todayOf(new Date(s.lastPractice))) : '–'}</td>
                  {topics.map((t) => { const l = s.levels[t.id]; return <td key={t.id}>{l ? `${l.level}/${t.levels.length}` : '–'}</td>; })}
                  {many ? <td>{given.length ? `${done}/${given.length}` : '–'}</td> : report.assignments.map((a, k) => <td key={k}>{workText(a.kind, a.work[i]) || '–'}</td>)}
                  <td className="pr-mis">{mistakeWords(s).map(stripTex).join(' · ') || '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>,
    document.body,
  );
}

/** The range chips, and two dates for "טווח אחר". */
function RangePicker({ range, onRange, custom, onCustom, day }) {
  const min = plusDays(day, -(MAX_DAYS - 1));
  return (
    <fieldset className="as-set rp-range">
      <legend className="visually-hidden">טווח הדוח</legend>
      <div className="as-chips">
        {RANGES.map(([id, label]) => (
          <label key={id} className={clsx('as-chip', range === id && 'on')}>
            <input type="radio" className="as-radio" name="rp-range" value={id} checked={range === id} onChange={() => onRange(id)} />
            {label}
          </label>
        ))}
      </div>
      {range === 'custom' && (
        <div className="rp-dates">
          <label className="field rp-date" htmlFor="rp-from">
            <span className="field-label">מתאריך</span>
            <input id="rp-from" type="date" className="input" value={custom.from} min={min} max={custom.to || day} onChange={(e) => onCustom({ ...custom, from: e.target.value })} />
          </label>
          <label className="field rp-date" htmlFor="rp-to">
            <span className="field-label">עד תאריך</span>
            <input id="rp-to" type="date" className="input" value={custom.to} min={custom.from || min} max={day} onChange={(e) => onCustom({ ...custom, to: e.target.value })} />
          </label>
          {!customRange(custom.from, custom.to, day) && <p className="field-hint rp-bad" role="status">בוחרים תאריך התחלה ותאריך סיום עד היום, עד 400 יום.</p>}
        </div>
      )}
    </fieldset>
  );
}

export default function ClassReport() {
  const profile = useApp((s) => s.profile);
  const cls = profile.classes.find((c) => c.code === profile.active) || profile.classes[0];
  const [params, setParams] = useSearchParams();
  const day = todayOf();
  const range = IDS.includes(params.get('range')) ? params.get('range') : 'two';
  const [custom, setCustom] = useState(() => ({ from: params.get('from') || rangeDays('two', day).from, to: params.get('to') || day }));
  const want = range === 'custom' ? customRange(custom.from, custom.to, day) : rangeDays(range, day);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!want) return undefined;
    let on = true;
    setBusy(true); setError('');
    fetchReport(cls, want).then((r) => { if (on) setReport(r); }, (e) => { if (on) setError(e.message); }).finally(() => { if (on) setBusy(false); });
    return () => { on = false; };
  }, [cls, want?.from, want?.to, tries]); // eslint-disable-line react-hooks/exhaustive-deps
  // leaving the screen ends a print mode left behind
  useEffect(() => () => { if (document.documentElement.dataset.print === 'report') delete document.documentElement.dataset.print; }, []);

  const shown = report && want && report.from === want.from && report.to === want.to ? report : null;
  const download = async (r = shown) => {
    if (!r) return;
    try {
      const how = await saveReportCsv(r);
      if (how === 'saved') toast.success('הקובץ הורד למכשיר.');
    } catch (e) { toast.error(e.message || 'לא הצלחנו להכין את הקובץ. נסו שוב.'); }
  };
  // ?csv=1: the file once, as soon as the asked range is here
  useEffect(() => {
    if (params.get('csv') !== '1' || !shown) return;
    setParams((p) => { const n = new URLSearchParams(p); n.delete('csv'); return n; }, { replace: true });
    download(shown);
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id) => setParams(id === 'custom' ? { range: id, from: custom.from, to: custom.to } : { range: id }, { replace: true });
  const pickDates = (c) => { setCustom(c); if (customRange(c.from, c.to, day)) setParams({ range: 'custom', from: c.from, to: c.to }, { replace: true }); };

  const topics = useMemo(() => topicsFor(shown?.class?.grade || cls.grade || '7'), [shown?.class?.grade, cls.grade]);
  const students = shown?.students || [];
  const practiced = students.filter((s) => s.exercises > 0).length;
  const sum = (k) => students.reduce((a, s) => a + s[k], 0);
  const pairs = (shown?.assignments || []).flatMap((a) => Object.values(a.work));
  const empty = !!shown && students.length > 0 && practiced === 0 && shown.assignments.length === 0;
  const thisYear = day.slice(0, 4);
  const title = `דוח הכיתה ${shown?.class?.name || cls.className}`;
  const sub = want ? `${shown?.class?.name || cls.className} · ${rangeText(want.from, want.to)}` : cls.className;

  return (
    <div className="page pushed t-report">
      <ScreenBar title="דוח הכיתה" back="/teacher" backLabel="חזרה ללוח" />
      <p className="t-report-sub"><bdi>{sub}</bdi></p>
      <RangePicker range={range} onRange={pick} custom={custom} onCustom={pickDates} day={day} />
      {busy && !shown && <p className="muted t-report-status" role="status">טוענים את הדוח…</p>}
      {error && (
        <div className="t-report-error" role="alert">
          <p className="form-error">{error}</p>
          <Button variant="secondary" className="btn-sm" onClick={() => setTries((n) => n + 1)}>לנסות שוב</Button>
        </div>
      )}

      {shown && students.length === 0 && (
        <EmptyState mood="idle" title="עוד אין תלמידים בכיתה"><p>כשתלמידים יצטרפו עם הקוד <b dir="ltr">{cls.code}</b>, הדוח יראה את התרגול שלהם.</p></EmptyState>
      )}
      {empty && <EmptyState mood="idle" title={EMPTY_RANGE}><p>אפשר לבחור טווח אחר למעלה.</p></EmptyState>}

      {shown && students.length > 0 && !empty && (
        <>
          <div className="t-kpis t-report-kpis" aria-busy={busy}>
            <Stat icon={Users} tone="brand" value={<bdi>{practiced}/{students.length}</bdi>} label="תרגלו בטווח" />
            <Stat icon={CalendarDays} tone="sky" value={oneDecimal(sum('activeDays') / students.length)} label="ימי תרגול בממוצע" />
            <Stat icon={Target} tone="good" value={sum('exercises') ? <bdi>{pctOf(sum('firstTry'), sum('exercises'))}%</bdi> : '–'} label="נכון בניסיון ראשון" />
            <Stat icon={ListChecks} tone="gold" value={pairs.length ? <bdi>{pairs.filter((w) => w.state === 'done').length}/{pairs.length}</bdi> : '–'} label="משימות שהושלמו" />
          </div>

          <section className="t-report-table" aria-labelledby="rp-table-h">
            <h2 id="rp-table-h" className="set-head">התלמידים</h2>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="טבלת הדוח">
              <table className="t-table rp-table">
                <thead>
                  <tr>
                    <th scope="col">שם</th><th scope="col">ימים עם תרגול</th><th scope="col">תרגילים</th><th scope="col">נכון בניסיון ראשון</th>
                    <th scope="col">דקות</th><th scope="col">תרגול אחרון</th>
                    {topics.map((t, i) => <th key={t.id} scope="col"><span className="th-topic"><ChapterMark color={t.color} n={i + 1} size="sm" />{t.title}</span></th>)}
                    {shown.assignments.map((a, i) => <th key={i} scope="col" className="rp-assign-h"><span className="rp-assign-t">{a.title}</span><span className="rp-due">עד {dm(a.dueOn)}</span></th>)}
                    <th scope="col">טעויות שחוזרות</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={i}>
                      <th scope="row">{s.name}</th>
                      <td>{s.activeDays}</td>
                      <td>{s.exercises}</td>
                      <td><Rate value={pctOf(s.firstTry, s.exercises)} /></td>
                      <td>{s.minutes}</td>
                      <td>{s.lastPractice ? shortDay(s.lastPractice, thisYear) : <span className="muted">עוד לא</span>}</td>
                      {topics.map((t) => { const l = s.levels[t.id]; return <td key={t.id}>{l ? <LevelPips total={t.levels.length} level={l.level} max={l.max} color={t.color} /> : <span className="muted">–</span>}</td>; })}
                      {shown.assignments.map((a, k) => {
                        const w = a.work[i];
                        if (!w) return <td key={k}><span className="muted">–</span></td>;
                        const text = workText(a.kind, { ...w, late: false });
                        return <td key={k}><span className="aw-state">{text}</span>{w.late && <span className="aw-late">באיחור</span>}</td>;
                      })}
                      <td className="rp-mis">{mistakeWords(s).length ? mistakeWords(s).map((m, k) => <span key={k} className="rp-mis-one"><MathText text={m} /></span>) : <span className="muted">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="set-group t-group t-group-warm" aria-labelledby="rp-mis-h">
            <h2 id="rp-mis-h" className="set-head">טעויות שחוזרות בטווח</h2>
            <div className="t-group-box">
              {shown.mistakes.length === 0 ? <p className="t-row muted">לא זוהו טעויות שחוזרות.</p> : (
                <ul className="t-list">
                  {shown.mistakes.map((m) => (
                    <li key={`${m.topic}:${m.cat}`} className="t-row">
                      <span className="t-list-main"><b>{TOPIC[m.topic]?.title}</b>: <MathText text={mistakeText(m.topic, m.level, m.cat)} /></span>
                      <span className="muted">{m.students === 1 ? 'תלמיד אחד' : `${m.students} תלמידים`}: {m.names.slice(0, 6).join(', ')}{m.names.length > 6 ? '…' : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <p className="footnote t-report-note">{REPORT_NOTE}</p>
          <PrintReport report={shown} topics={topics} title={title} />
        </>
      )}

      {shown && students.length > 0 && !empty && (
        <ScreenFoot>
          <Button className="btn-block btn-lg" onClick={() => download()} data-region="primary"><FileDown size={20} aria-hidden="true" />הורדת קובץ CSV (לאקסל)</Button>
          <Button variant="secondary" className="btn-block" onClick={() => printSheet('report')}><Printer size={20} aria-hidden="true" />הדפסה</Button>
        </ScreenFoot>
      )}
    </div>
  );
}
