// The improvement plan, laid out as a course outline (LAYOUT_SPEC B2, the same outline as a stair's page): the bar
// with the way back, how far the plan is (a thin bar and the next step's name), then the steps as stops on one
// vertical line: done ones checked, the current one open with its reason and its count. ONE primary, pinned at the
// bottom, opens the current step; the other steps are not buttons.
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Check, PencilRuler, FileText, Flame } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { usePlan } from '@/lib/usePlan.js';
import { aiReady } from '@/lib/ai.js';
import { TOPIC } from '@/content/index.js';
import { NeedSlots } from '@/components/ui.jsx';
import { Segments } from '@/components/ds.jsx';
import { Markdown } from '@/components/MathText.jsx';
import { ScreenBar, ScreenFoot, EmptyState } from '@/components/Screen.jsx';

const KIND_ICON = { practice: PencilRuler, exam: FileText, habit: Flame };
const GO = { practice: 'לתרגל עכשיו', exam: 'הכנת מבחן תרגול', habit: 'לתרגול היומי' };

export default function Plan() {
  const { exams } = useApp();
  const plan = usePlan();
  const latest = exams[0];
  const hasData = plan.weak.length > 0;
  const next = plan.steps.find((s) => !s.done);

  if (!hasData) {
    return (
      <div className="page pushed plan-page">
        <ScreenBar title="התוכנית לשיפור" back="/exams" />
        <EmptyState mood="encouraging" title="התוכנית עוד ריקה">
          <p>אחרי בדיקת מבחן או כמה סבבי תרגול, אראה כאן מה כדאי לחזק ובאיזה סדר.</p>
        </EmptyState>
        <ScreenFoot>
          {aiReady()
            ? <Link to="/exams/check" className="btn btn-primary btn-block btn-lg" data-region="primary">בדיקת מבחן</Link>
            : <Link to="/exams/new" className="btn btn-primary btn-block btn-lg" data-region="primary">מבחן תרגול</Link>}
          <Link to="/" className="foot-link">להמשיך לתרגל במסלול</Link>
        </ScreenFoot>
      </div>
    );
  }

  return (
    <div className="page pushed plan-page">
      <ScreenBar title="התוכנית לשיפור" back="/exams" />
      <section className="plan-head" aria-label="ההתקדמות בתוכנית" data-region="banner">
        <Segments steps={plan.steps.length} done={plan.done} current={next ? plan.steps.indexOf(next) : plan.steps.length} size="thin" label="צעדים בתוכנית" valueText={`${plan.done} מתוך ${plan.steps.length} צעדים`} />
        <p className="plan-head-count"><bdi>{plan.done} מתוך {plan.steps.length} צעדים</bdi></p>
        <p className="plan-head-next">{next ? <>הצעד הבא: <b>{next.title}</b></> : 'כל הצעדים הושלמו. כל הכבוד!'}</p>
      </section>

      <ol className="journey-stages plan-stages" aria-label="צעדי התוכנית" data-region="path">
        {plan.steps.map((s) => {
          const t = s.topic ? TOPIC[s.topic] : null;
          const Icon = KIND_ICON[s.kind] || PencilRuler;
          const current = s === next;
          return (
            <li key={s.id} className={clsx('jstage', s.done && 'done', current && 'current', t && `ch-${t.color}`)}>
              <span className="jstage-icon" aria-hidden="true">{s.done ? <Check size={20} strokeWidth={3} /> : <Icon size={20} />}</span>
              <div className="jstage-text">
                <p className="jstage-title">{s.title}{s.done && <span className="visually-hidden"> (הושלם)</span>}{current && <span className="level-badge">הצעד הבא</span>}</p>
                <p className="jstage-sub">{s.why}</p>
                {s.kind === 'practice' && !s.done && (
                  <div className="plan-meter">
                    <span className="plan-target">{s.have} מתוך {s.need} תשובות נכונות, ממדרגה {s.level} ומעלה</span>
                    <NeedSlots need={s.need} have={s.have} label={false} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {latest?.result?.nextSteps?.length > 0 && (
        <section className="section" aria-labelledby="rec-title">
          <h2 id="rec-title" className="set-head">המלצות מהבדיקה האחרונה ({latest.title})</h2>
          <ol className="steps result-next">{latest.result.nextSteps.map((n, i) => <li key={i}><Markdown>{n}</Markdown></li>)}</ol>
        </section>
      )}

      <ScreenFoot>
        {next
          ? <Link to={next.to} className="btn btn-primary btn-block btn-lg" data-region="primary">{GO[next.kind]}</Link>
          : <Link to="/" className="btn btn-primary btn-block btn-lg" data-region="primary">להמשיך במסלול</Link>}
      </ScreenFoot>
    </div>
  );
}
