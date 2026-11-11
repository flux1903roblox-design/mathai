// The pilot kit in the app (spec TEACHER-10 §2), at /teacher/guide/:doc?, for the class open on the board.
// Without a document: the list of the five (content/schools). With one: a small form for the pilot's details where the
// document uses them (the school, the dates, how parents reach the teacher; saved on the class as
// profile.classes[i].pilot), the document filled in for the class (lib/schoolDocs.js) and rendered like the legal pages,
// and its actions: "הדפסה" (only the document prints; the parent letter's slip starts on a new page under a dashed cut
// line), "העתקה" (the filled text, plain, for the school's messaging system) and, for the parent letter, "גרסה קצרה
// לווטסאפ". The parent letter's AI sentence follows the class's AI policy from the dashboard. In the demo class the
// school is "בית ספר לדוגמה".
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { ChevronLeft, Printer, Copy, MessageCircle } from 'lucide-react';
import { useApp, today as todayOf } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import { plans as loadPlans } from '@/lib/parent.js';
import { publicUrl } from '@/lib/assign.js';
import { DEMO_SCHOOL } from '@/lib/demo.js';
import { useBoard } from '@/lib/teacherBoard.js';
import { schoolContext, fillSchoolDoc, fieldsOf, toPlainText, topicsLine } from '@/lib/schoolDocs.js';
import { SCHOOL_DOCS, schoolDoc } from '@/content/schools/index.js';
import { topicsFor } from '@/content/index.js';
import { Button, Field } from '@/components/ui.jsx';
import { ScreenBar } from '@/components/Screen.jsx';
import { printSheet } from './ExamSheet.jsx';
import '@/styles/lazy/legal.css'; // a document reads like the legal pages (FOLLOWUP-23)

export const GUIDE_TITLE = 'ערכת פיילוט ומדריכים';
const LABELS = {
  school: 'שם בית הספר',
  start: 'תאריך התחלה',
  end: 'תאריך סיום',
  contact: 'איך ההורים יכולים לפנות אליכם (מייל או טלפון בבית הספר)',
};
/** The product sheet goes to a principal or a colleague, not to parents: its contact field says so. */
const CONTACT_FOR = { 'product-sheet': 'איך פונים אליכם (מייל או טלפון)' };

/** A checkbox line ("☐ ...") is a list item without a bullet: the box is its mark. */
function Li({ node, children, ...p }) { // eslint-disable-line no-unused-vars
  const first = [].concat(children).find((c) => typeof c === 'string' && c.trim());
  return <li {...p} className={first?.trimStart().startsWith('☐') ? 'sd-check' : undefined}>{children}</li>;
}
const PRINTED = { li: Li };
// on screen the page's own title is the bar's h1, so the document's headings step down one level
const ON_SCREEN = {
  li: Li,
  ...Object.fromEntries(Object.entries({ h1: 'h2', h2: 'h3', h3: 'h4' }).map(([from, To]) => [from, ({ node, ...p }) => <To {...p} />])), // eslint-disable-line no-unused-vars
};

/** Text to the clipboard, with the spec's toast; when the browser refuses, say how to do it by hand. */
async function toClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('הועתק');
  } catch {
    toast.error('לא הצלחנו להעתיק. אפשר לסמן את הטקסט ולהעתיק ידנית.');
  }
}

/** The five documents, a line each. */
function GuideList({ cls }) {
  return (
    <div className="page pushed t-guide">
      <ScreenBar title={GUIDE_TITLE} back="/teacher" backLabel="חזרה ללוח" />
      <p className="t-guide-sub">כל מה שצריך לניסיון בכיתה: מדריך, טפסים ותוכנית לשבועיים. המכתב והטפסים מתמלאים בפרטים של <bdi>{cls.className}</bdi>.</p>
      <nav className="section set-group sd-list" aria-label="המסמכים בערכה">
        <ul className="set-box">
          {SCHOOL_DOCS.map((d) => (
            <li key={d.id}>
              <Link className="set-row sd-row" to={`/teacher/guide/${d.id}`}>
                <span className="sd-row-text"><span className="sd-row-title">{d.title}</span><span className="sd-row-line">{d.line}</span></span>
                <ChevronLeft size={20} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** The pilot's details the document uses, saved on the class as they are typed. */
function PilotForm({ fields, pilot, onChange, className, contactLabel = LABELS.contact }) {
  const late = pilot.start && pilot.end && pilot.end < pilot.start;
  const dates = fields.filter((f) => f === 'start' || f === 'end');
  const input = (f) => (
    <Field key={f} label={f === 'contact' ? contactLabel : LABELS[f]} id={`sd-${f}`}>
      <input id={`sd-${f}`} className="input" type={f === 'start' || f === 'end' ? 'date' : 'text'} value={pilot[f] || ''}
        maxLength={f === 'contact' ? 120 : 80} autoComplete="off" dir={f === 'contact' ? 'auto' : undefined}
        onChange={(e) => onChange({ [f]: e.target.value })} aria-describedby={f === 'end' && late ? 'sd-late' : undefined} />
    </Field>
  );
  return (
    <section className="section set-group sd-form-wrap" aria-labelledby="sd-form-h">
      <h2 id="sd-form-h" className="set-head">הפרטים במסמך</h2>
      <form className="set-box sd-form" onSubmit={(e) => e.preventDefault()} noValidate>
        <p className="field-hint sd-form-note">נשמרים במכשיר הזה, לכיתה <bdi>{className}</bdi>. מה שנשאר ריק יודפס כקו למילוי ביד.</p>
        {fields.includes('school') && input('school')}
        {dates.length > 0 && <div className="sd-dates">{dates.map(input)}</div>}
        {late && <p className="field-hint sd-late" id="sd-late" role="status">תאריך הסיום לפני תאריך ההתחלה.</p>}
        {fields.includes('contact') && input('contact')}
      </form>
    </section>
  );
}

/** The printed copy, at the end of <body>: hidden on screen; printed, it is the only thing on the page. */
function PrintDoc({ text }) {
  return createPortal(
    <div className="print-root" dir="rtl" lang="he">
      <section className="print-sheet sd-print" data-mode="doc">
        <article className="sd-print-doc"><ReactMarkdown components={PRINTED}>{text}</ReactMarkdown></article>
      </section>
    </div>,
    document.body,
  );
}

/** One document, filled in for the class. */
function GuideDoc({ doc, cls }) {
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const demo = profile.demo === true;
  // the class's AI policy, for the parent letter's AI sentence (the board's, else the dashboard asked once)
  const { board } = useBoard(cls);
  // the teacher guide's "כל שאלה אחרת" is Madregot's own contact, from the server's details
  const [plans, setPlans] = useState(null);
  useEffect(() => {
    if (doc.id === 'teacher-guide' && hasServer() && !demo) loadPlans().then(setPlans).catch(() => {});
  }, [doc.id, demo]);
  useEffect(() => { window.scrollTo?.(0, 0); }, [doc.id]);
  // leaving the screen ends a print mode left behind
  useEffect(() => () => { if (document.documentElement.dataset.print === 'doc') delete document.documentElement.dataset.print; }, []);

  const pilot = { ...(cls.pilot || {}), school: cls.pilot?.school ?? (demo ? DEMO_SCHOOL : '') };
  const savePilot = (patch) => {
    const p = useApp.getState().profile;
    setProfile({ ...p, classes: p.classes.map((c) => (c.code === cls.code ? { ...c, pilot: { ...(c.pilot || {}), ...patch } } : c)) });
  };
  const ctx = schoolContext({
    cls, teacher: profile.name, policy: board?.aiPolicy || null, base: publicUrl(), server: hasServer(),
    today: todayOf(), topics: topicsLine(topicsFor), pilot,
  });
  if (doc.id === 'teacher-guide') ctx.CONTACT = plans?.business?.email || plans?.contact || '';
  const filled = fillSchoolDoc(doc.text, ctx);
  const fields = doc.id === 'teacher-guide' ? [] : fieldsOf(doc.text);

  return (
    <div className="page pushed t-guide">
      <ScreenBar title={doc.title} back="/teacher/guide" backLabel="חזרה לערכה" />
      {fields.length > 0 && <PilotForm fields={fields} pilot={pilot} onChange={savePilot} className={cls.className} contactLabel={CONTACT_FOR[doc.id]} />}
      <div className="sd-actions" role="group" aria-label="פעולות על המסמך">
        <Button className="btn-sm" onClick={() => printSheet('doc')}><Printer size={18} aria-hidden="true" />הדפסה</Button>
        <Button variant="secondary" className="btn-sm" onClick={() => toClipboard(toPlainText(filled))}><Copy size={18} aria-hidden="true" />העתקה</Button>
        {doc.short && (
          <Button variant="secondary" className="btn-sm" onClick={() => toClipboard(toPlainText(fillSchoolDoc(doc.short, ctx)))}>
            <MessageCircle size={18} aria-hidden="true" />גרסה קצרה לווטסאפ
          </Button>
        )}
      </div>
      <article className="legal md sd-doc sd-paper" aria-label={doc.title}>
        <ReactMarkdown components={ON_SCREEN}>{filled}</ReactMarkdown>
      </article>
      <PrintDoc text={filled} />
    </div>
  );
}

export default function TeacherGuide() {
  const { doc: id } = useParams();
  const profile = useApp((s) => s.profile);
  const cls = profile.classes.find((c) => c.code === profile.active) || profile.classes[0];
  if (!id) return <GuideList cls={cls} />;
  const doc = schoolDoc(id);
  if (!doc) return <Navigate to="/teacher/guide" replace />;
  return <GuideDoc key={`${doc.id}-${cls.code}`} doc={doc} cls={cls} />;
}
