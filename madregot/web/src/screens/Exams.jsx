import { Link } from 'react-router-dom';
import { aiReady } from '@/lib/ai.js';
import { ClipboardCheck, Printer, Route, ChevronLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { usePlan } from '@/lib/usePlan.js';
import PageHero from '@/components/PageHero.jsx';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
export const pctTone = (pct) => (pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low');

function ActionRow({ to, icon: Icon, title, desc }) {
  return (
    <li>
      <Link to={to} className="action-row">
        <span className="action-icon" aria-hidden="true"><Icon size={22} /></span>
        <span className="topic-row-text"><span className="topic-row-title">{title}</span><span className="topic-row-desc">{desc}</span></span>
        <ChevronLeft className="chev" size={20} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function Exams() {
  const { exams, practiceExams } = useApp();
  const plan = usePlan();
  const ai = aiReady();
  // the same rule as the plan screen: without weak topics there is no plan yet
  const planDesc = plan.weak.length ? `${plan.done} מתוך ${plan.steps.length} צעדים הושלמו` : 'התוכנית עוד ריקה. היא נבנית מטעויות בתרגול ובמבחנים';
  return (
    <div className="page wide exams-page">
      <PageHero tone="sky" art="exams-empty" title="מבחנים" sub="בודקים מבחן שפתרתם, מקבלים הסבר על כל שאלה, ורואים מה כדאי לתרגל עכשיו." />
      <ul className="topic-list">
        {ai && <ActionRow to="/exams/check" icon={ClipboardCheck} title="בדיקת מבחן שפתרתם" desc="מצלמים את הדפים או מעלים PDF, והעוזר בודק כל תשובה" />}
        <ActionRow to="/exams/new" icon={Printer} title="מבחן תרגול להדפסה" desc="מבחן מהנושאים שלכם, עם מפתח תשובות לבדיקה מדויקת" />
        <ActionRow to="/plan" icon={Route} title="התוכנית שלי לשיפור" desc={planDesc} />
        {!ai && <ActionRow to="/exams/check" icon={ClipboardCheck} title="בדיקת מבחן שפתרתם" desc="צריך את העוזר, שעוד לא מחובר בגרסה הזו" />}
      </ul>

      <section className="section" aria-labelledby="checked-title">
        <h2 id="checked-title" className="h-section">מבחנים שנבדקו</h2>
        {exams.length === 0 ? (
          <p className="muted">עוד לא בדקתם מבחן. אחרי הבדיקה הראשונה הוא יופיע כאן, עם ציון ומשוב לכל שאלה.</p>
        ) : (
          <ul className="topic-list">
            {exams.map((e) => (
              <li key={e.id}>
                <Link to={`/exams/${e.id}`} className="action-row">
                  <span className={`score-chip ${pctTone(e.score.pct)}`}>{e.score.pct}%</span>
                  <span className="topic-row-text">
                    <span className="topic-row-title">{e.title}</span>
                    <span className="topic-row-desc">{e.score.correct} מתוך {e.score.total} שאלות נכונות, {fmtDate(e.at)}</span>
                  </span>
                  <ChevronLeft className="chev" size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {practiceExams.length > 0 && (
        <section className="section" aria-labelledby="practice-title">
          <h2 id="practice-title" className="h-section">מבחני תרגול שהכנתם</h2>
          <ul className="topic-list">
            {practiceExams.map((pe) => (
              <li key={pe.id} className="practice-exam-row">
                <span className="topic-row-text">
                  <span className="topic-row-title">{pe.title}</span>
                  <span className="topic-row-desc">{pe.items.length} שאלות, {fmtDate(pe.at)}</span>
                </span>
                <span className="row-actions">
                  <Link to={`/exams/practice/${pe.id}`} className="btn btn-secondary btn-sm">פתיחה</Link>
                  <Link to={`/exams/check?practice=${pe.id}`} className="btn btn-primary btn-sm">בדיקה</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
