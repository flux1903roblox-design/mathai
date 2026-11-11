// The exams tab, laid out as a tab's own screen (LAYOUT_SPEC E1, Duolingo's practice hub and quests tab): the solid
// header, ONE featured card with the one thing to do now and its button, the other ways as plain rows, then what was
// already done (checked exams, practice exams made). Rows open their own screens; no row carries a second primary.
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { aiAccess, hasTool, useAIStatus } from '@/lib/account.js';
import { ClipboardCheck, Printer, ChevronLeft, FileText } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import PageHero from '@/components/PageHero.jsx';
import ExamLoss from '@/components/learn/ExamLoss.jsx';
import { Bar } from '@/components/ds.jsx';
import '@/styles/lazy/exams.css'; // this screen's own rules, loaded with it (STUDENT-15)

const fmtDate = (iso) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
export const pctTone = (pct) => (pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low');

function Row({ to, icon: Icon, title, desc, lead }) {
  return (
    <li>
      <Link to={to} className="hub-row">
        {lead || <span className="hub-row-icon" aria-hidden="true"><Icon size={22} /></span>}
        <span className="hub-row-text"><span className="hub-row-title">{title}</span><span className="hub-row-desc">{desc}</span></span>
        <ChevronLeft className="chev" size={20} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function Exams() {
  const { exams, practiceExams } = useApp();
  const status = useAIStatus((x) => x.status);
  const ai = hasTool('exam', status);
  const examState = aiAccess('exam', status).state;
  // the one thing to do now: checking an exam (with the assistant), else a practice exam. What to strengthen after a
  // checked exam is the one plan's exam-loss items, listed under it.
  const lead = ai
    ? { key: 'check', to: '/exams/check', icon: ClipboardCheck, title: 'בדיקת מבחן שפתרתם', desc: 'מצלמים את הדפים. העוזר בודק כל שאלה ומסביר מה לתרגל.', go: 'לבדיקת מבחן' }
    : { key: 'new', to: '/exams/new', icon: Printer, title: 'מבחן תרגול להדפסה', desc: 'מבחן מהנושאים שלכם, עם מפתח תשובות לבדיקה מדויקת.', go: 'הכנת מבחן תרגול' };
  const rows = [
    lead.key !== 'check' && { to: '/exams/check', icon: ClipboardCheck, title: 'בדיקת מבחן שפתרתם', desc: ai ? 'מצלמים את הדפים, והעוזר בודק כל תשובה' : examState === 'offline' ? 'צריך את העוזר, שעוד לא מחובר בגרסה הזו' : examState === 'economy' ? 'הבדיקה הזו חוזרת ב־1 בחודש' : examState === 'class_off' ? 'בכיתה הזו העוזר החכם כבוי' : 'את הבדיקה הזו עושה העוזר החכם המלא' },
    lead.key !== 'new' && { to: '/exams/new', icon: Printer, title: 'מבחן תרגול להדפסה', desc: 'מהנושאים שלכם, עם מפתח תשובות' },
  ].filter(Boolean);
  const LeadIcon = lead.icon;
  return (
    <div className="page wide exams-page">
      <PageHero tone="sky" scene="exams" mood="happy" title="מבחנים" sub="בודקים מבחן, מקבלים הסבר על כל שאלה, ורואים מה לתרגל עכשיו." />

      <section className={clsx('card', 'hub-card', `hub-${lead.key}`)} aria-labelledby="hub-lead" data-region="card">
        <div className="hub-card-head">
          <span className="hub-card-icon" aria-hidden="true"><LeadIcon size={30} /></span>
          <div className="hub-card-text">
            <h2 id="hub-lead" className="hub-card-title">{lead.title}</h2>
            <p className="hub-card-desc">{lead.desc}</p>
          </div>
        </div>
        <Link to={lead.to} className="btn btn-primary btn-block btn-lg" data-region="primary">{lead.go}</Link>
      </section>

      <ExamLoss id="exams-loss" />

      <section className="section" aria-labelledby="more-title">
        <h2 id="more-title" className="set-head">עוד במבחנים</h2>
        <ul className="hub-rows">{rows.map((r) => <Row key={r.to} {...r} />)}</ul>
      </section>

      <section className="section" aria-labelledby="checked-title">
        <h2 id="checked-title" className="set-head">מבחנים שנבדקו</h2>
        {exams.length === 0 ? (
          <p className="hub-empty">עוד לא בדקתם מבחן. אחרי הבדיקה הראשונה הוא יופיע כאן, עם ציון ומשוב לכל שאלה.</p>
        ) : (
          <ul className="hub-rows">
            {exams.map((e) => (
              <Row key={e.id} to={`/exams/${e.id}`} title={e.title} desc={`${e.score.correct} מתוך ${e.score.total} נכונות · ${fmtDate(e.at)}`}
                lead={<span className={`score-chip ${pctTone(e.score.pct)}`}><bdi dir="ltr">{e.score.pct}%</bdi></span>} />
            ))}
          </ul>
        )}
      </section>

      {practiceExams.length > 0 && (
        <section className="section" aria-labelledby="practice-title">
          <h2 id="practice-title" className="set-head">מבחני תרגול שהכנתם</h2>
          <ul className="hub-rows">
            {practiceExams.map((pe) => <Row key={pe.id} to={`/exams/practice/${pe.id}`} icon={FileText} title={pe.title} desc={`${pe.items.length} שאלות · ${fmtDate(pe.at)}`} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
