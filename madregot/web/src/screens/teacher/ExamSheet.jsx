// A class practice exam, ready to print (spec TEACHER-3 §4), at /teacher/exam/:id: its title (the teacher may change
// it), the version on screen (א or ב, when there are two), the questions as the class will see them on paper, and the
// actions: "הדפסת המבחן" (the version on screen), "הדפסת מפתח התשובות" (a page per version, with the steps) and
// "לשלוח לכיתה כמשימה" (the assign sheet, with the version on screen). /teacher/exam/a:<assignmentId> shows an exam
// already sent, as the server keeps it (GET /api/teacher/assignments/:id), to print again: read-only.
// What is printed is its own copy at the end of <body> (PrintSheets): the print rules in styles/app.css show only the
// mode asked for (printSheet sets <html data-print>), black on white, with a header on every page and room to work.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { Printer, KeyRound, Send } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { classExamTitle } from '@/lib/exam.js';
import { workDetail } from '@/lib/assign.js';
import { MathText } from '@/components/MathText.jsx';
import { Button, Field } from '@/components/ui.jsx';
import { ScreenBar, ScreenFoot, EmptyState, LoadingState } from '@/components/Screen.jsx';
import AssignSheet from '@/components/teacher/AssignSheet.jsx';
import { ExamQuestion, KeyAnswer } from '../PracticeExam.jsx';
import { skippedNote } from './ExamNew.jsx';

export const KEY_NOTE = 'השאלות נוצרו באפליקציה, וכל תשובה חושבה ונבדקה בקוד, לא בבינה מלאכותית. אורך שאינו מספר שלם מעוגל לעשיריות, וגם תשובה קרובה יותר (למשל 7.07 במקום 7.1) נכונה.';
const TITLE_MAX = 80;

/** Print one mode of the sheet ('exam' or 'key'): <html data-print> says which, until the print dialog closes. */
export function printSheet(mode) {
  const root = document.documentElement;
  root.dataset.print = mode;
  const clear = () => { if (root.dataset.print === mode) delete root.dataset.print; window.removeEventListener('afterprint', clear); };
  window.addEventListener('afterprint', clear);
  window.print();
}

/** A line to write on: "שם: ______". */
const Blank = ({ wide }) => <span className={wide ? 'ps-blank wide' : 'ps-blank'} aria-hidden="true" />;

/**
 * The printed copies: the exam of the version on screen (its header on every page: a table header repeats), and the
 * answer key, a page per version. Hidden on screen; under print, only the mode asked for shows.
 */
function PrintSheets({ title, className, versions, shown, marked }) {
  const two = marked;
  const v = versions[shown];
  return createPortal(
    <div className="print-root" dir="rtl" lang="he">
      <section className="print-sheet" data-mode="exam">
        <table className="ps-frame">
          <thead>
            <tr><td>
              <div className="ps-head">
                <p className="ps-title"><b>{title}</b>{two && <span className="ps-version">גרסה {v.label}׳</span>}</p>
                <p className="ps-lines">
                  <span className="ps-name">שם: <Blank wide /></span>
                  <span>כיתה: {className || <Blank />}</span>
                  <span>תאריך: <Blank /></span>
                </p>
              </div>
            </td></tr>
          </thead>
          <tbody>
            {v.items.map((it, i) => <tr key={it.key}><td><ExamQuestion as="div" className="ps-q" it={it} n={i + 1} /></td></tr>)}
          </tbody>
        </table>
      </section>
      <section className="print-sheet" data-mode="key">
        {versions.map((ver) => (
          <article key={ver.label} className="ps-key-page">
            <h1 className="ps-key-title">מפתח תשובות: {title}{two ? ` · גרסה ${ver.label}׳` : ''} (למורה)</h1>
            <ol className="ps-key">
              {ver.items.map((it, i) => (
                <li key={it.key} className="ps-key-line">
                  <p className="ps-key-ans"><span className="ps-key-n">{i + 1}.</span> <KeyAnswer it={it} /></p>
                  {it.solution?.length > 0 && (
                    <div className="ps-key-steps">
                      <span className="ps-key-way">הדרך:</span>
                      <ol>{it.solution.map((step, k) => <li key={k}><MathText text={step} /></li>)}</ol>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <p className="ps-key-foot">{KEY_NOTE}</p>
          </article>
        ))}
      </section>
    </div>,
    document.body,
  );
}

/**
 * The sheet itself. `exam`: { title, skills, versions, skipped? }; `className`: the class's name for the print header;
 * `onTitle(title)`: the teacher renamed it (none: the title is read-only); `onSend(version)`: send it to the class
 * ('a' or 'b', the version on screen; none: no such action); `marked`: say the version even when there is one.
 */
export function SheetView({ exam, className, onTitle, onSend, marked, back = '/teacher/exam/new', backLabel = 'חזרה למבחנים', note }) {
  const [shown, setShown] = useState(0);
  const [title, setTitle] = useState(exam.title);
  const versions = exam.versions;
  const two = versions.length > 1 || !!marked;
  const v = versions[Math.min(shown, versions.length - 1)];
  const printed = title.trim() || classExamTitle(exam.skills || []);
  // leaving the screen ends a print mode left behind (a browser that never says the dialog closed)
  useEffect(() => () => { delete document.documentElement.dataset.print; }, []);
  const rename = (t) => { const next = t.slice(0, TITLE_MAX); setTitle(next); if (next.trim()) onTitle?.(next.trim()); };
  return (
    <div className="page pushed xs">
      <ScreenBar title="מבחן להדפסה" back={back} backLabel={backLabel} />
      <div className="xs-top">
        {onTitle
          ? (
            <Field label="כותרת המבחן" id="xs-title">
              <input id="xs-title" className="input" maxLength={TITLE_MAX} value={title} onChange={(e) => rename(e.target.value)} onBlur={() => { if (!title.trim()) setTitle(printed); }} />
            </Field>
          ) : null}
        {versions.length > 1 && (
          <fieldset className="as-set xs-versions">
            <legend className="visually-hidden">הגרסה שעל המסך</legend>
            <div className="as-chips">
              {versions.map((ver, i) => (
                <label key={ver.label} className={shown === i ? 'as-chip on' : 'as-chip'}>
                  <input type="radio" className="as-radio" name="xs-version" checked={shown === i} onChange={() => setShown(i)} />
                  גרסה {ver.label}׳
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <p className="muted xs-lead">{note || 'מדפיסים כמה עותקים שצריך. מפתח התשובות מודפס בנפרד, עמוד לכל גרסה, עם הדרך.'}</p>
        {(exam.skipped || []).map((s) => <p key={s} className="as-hint" role="status">{skippedNote(s)}</p>)}
      </div>
      <article className="exam-sheet xs-screen" data-region="content" aria-labelledby="xs-sheet-title">
        <header className="exam-sheet-head">
          <h2 className="h-page" id="xs-sheet-title">{printed}</h2>
          <p className="exam-sheet-meta">
            <span>שם: ________</span>
            {className && <span>כיתה: {className}</span>}
            <span>תאריך: ________</span>
            {two && <span>גרסה {v.label}׳</span>}
            <span>{v.items.length} שאלות</span>
          </p>
        </header>
        <ol className="exam-qs">
          {v.items.map((it, i) => <ExamQuestion key={it.key} it={it} n={i + 1} />)}
        </ol>
      </article>
      <ScreenFoot>
        <Button className="btn-block btn-lg" onClick={() => printSheet('exam')} data-region="primary"><Printer size={20} aria-hidden="true" />הדפסת המבחן</Button>
        <Button variant="secondary" className="btn-block" onClick={() => printSheet('key')}><KeyRound size={20} aria-hidden="true" />הדפסת מפתח התשובות</Button>
        {onSend && <button type="button" className="foot-link xs-send" onClick={() => onSend(shown === 1 ? 'b' : 'a')}><Send size={18} aria-hidden="true" />לשלוח לכיתה כמשימה</button>}
      </ScreenFoot>
      <PrintSheets title={printed} className={className} versions={versions} shown={Math.min(shown, versions.length - 1)} marked={two} />
    </div>
  );
}

/** An exam already sent to the class (a:<assignmentId>): the version the class got, as the server keeps it. */
function SentExam({ assignmentId }) {
  const cls = useApp((s) => s.profile.classes?.find((c) => c.code === s.profile.active) || s.profile.classes?.[0]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let on = true;
    workDetail(cls, assignmentId).then((d) => { if (on) setData(d); }, (e) => { if (on) setError(e.message); });
    return () => { on = false; };
  }, [cls, assignmentId]);
  const bar = <ScreenBar title="מבחן להדפסה" back="/teacher?tab=work" backLabel="חזרה למשימות" />;
  if (error || (data && !data.exam?.items?.length)) {
    return (
      <div className="page pushed xs">
        {bar}
        <EmptyState mood="oops" title="לא הצלחנו לפתוח את המבחן"><p role="alert">{error || 'למשימה הזו אין מבחן.'}</p></EmptyState>
        <ScreenFoot><Link to="/teacher?tab=work" className="btn btn-primary btn-block btn-lg">חזרה למשימות</Link></ScreenFoot>
      </div>
    );
  }
  if (!data) return <div className="page pushed xs">{bar}<LoadingState text="טוענים את המבחן…" /></div>;
  const label = data.assignment.version === 'b' ? 'ב' : 'א';
  const exam = { title: data.assignment.title, skills: [], versions: [{ label, items: data.exam.items }] };
  return <SheetView exam={exam} className={cls?.className || ''} marked back="/teacher?tab=work" backLabel="חזרה למשימות"
    note={`זה המבחן כפי שנשלח לכיתה, גרסה ${label}׳. אפשר להדפיס אותו ואת מפתח התשובות.`} />;
}

export default function ExamSheet() {
  const { id } = useParams();
  const sent = /^a:([a-f0-9]{16})$/.exec(id || '')?.[1];
  const exam = useApp((s) => (s.teacherExams || []).find((x) => x.id === id));
  const classes = useApp((s) => s.profile.classes) || [];
  const updateTeacherExam = useApp((s) => s.updateTeacherExam);
  const [assign, setAssign] = useState(null); // { version, n } while the assign sheet is open
  const opened = useRef(0);
  if (sent) return <SentExam assignmentId={sent} />;
  if (!exam) {
    return (
      <div className="page pushed xs">
        <ScreenBar title="מבחן להדפסה" back="/teacher/exam/new" backLabel="חזרה למבחנים" />
        <EmptyState mood="encouraging" title="המבחן לא נמצא"><p>אולי הוא נמחק מהמכשיר הזה. אפשר להכין מבחן חדש בשתי דקות.</p></EmptyState>
        <ScreenFoot><Link to="/teacher/exam/new" className="btn btn-primary btn-block btn-lg">מבחן חדש</Link></ScreenFoot>
      </div>
    );
  }
  const cls = classes.find((c) => c.code === exam.classCode) || null;
  return (
    <>
      <SheetView key={exam.id} exam={exam} className={cls?.className || ''} onTitle={(title) => updateTeacherExam(exam.id, { title })}
        onSend={cls ? (version) => { opened.current += 1; setAssign({ version, n: opened.current }); } : null} />
      {assign && cls && (
        <AssignSheet key={assign.n} cls={cls} preset={{ kind: 'exam', examId: exam.id, version: assign.version }} open onOpenChange={(o) => { if (!o) setAssign(null); }} />
      )}
    </>
  );
}
