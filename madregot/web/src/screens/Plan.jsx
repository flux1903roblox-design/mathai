import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { usePlan } from '@/lib/usePlan.js';
import { TOPIC } from '@/content/index.js';
import { Box, Button, NeedSlots } from '@/components/ui.jsx';
import { Markdown } from '@/components/MathText.jsx';

export default function Plan() {
  const navigate = useNavigate();
  const { exams } = useApp();
  const plan = usePlan();
  const latest = exams[0];

  const hasData = plan.weak.length > 0;
  return (
    <div className="page">
      <Link to="/exams" className="back-link"><ArrowRight size={18} aria-hidden="true" />מבחנים</Link>
      <h1 className="h-page">התוכנית שלי לשיפור</h1>
      {!hasData ? (
        <Box tone="note" title="התוכנית עוד ריקה">
          <p>אחרי בדיקת מבחן או כמה סבבי תרגול, האפליקציה תראה כאן מה כדאי לחזק ובאיזה סדר.</p>
          <div className="form-actions row">
            <Button className="btn-sm" onClick={() => navigate('/exams/check')}>בדיקת מבחן</Button>
            <Button variant="secondary" className="btn-sm" onClick={() => navigate('/')}>לתרגול</Button>
          </div>
        </Box>
      ) : (
        <>
          <div className="goal">
            <div className="goal-text"><span>ההתקדמות בתוכנית</span><span>{plan.done} מתוך {plan.steps.length} צעדים</span></div>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={plan.steps.length} aria-valuenow={plan.done} aria-label="צעדים שהושלמו"><i style={{ width: `${(plan.done / plan.steps.length) * 100}%` }} /></div>
          </div>
          <ol className="plan-steps">
            {plan.steps.map((s, i) => {
              const t = s.topic ? TOPIC[s.topic] : null;
              return (
                <li key={s.id} className={clsx('plan-step', s.done && 'done', t && `ch-${t.color}`)}>
                  <span className="plan-num" aria-hidden="true">{s.done ? <Check size={18} /> : i + 1}</span>
                  <div className="plan-body">
                    <h2 className="plan-title">{s.title}{s.done && <span className="visually-hidden"> (הושלם)</span>}</h2>
                    <p className="muted">{s.why}</p>
                    {s.kind === 'practice' && (
                      <div className="plan-meter">
                        <span className="plan-target">{s.have} מתוך {s.need} תשובות נכונות, ממדרגה {s.level} ומעלה</span>
                        <NeedSlots need={s.need} have={s.have} label={false} />
                      </div>
                    )}
                    {!s.done && (
                      <Link to={s.to} className="btn btn-secondary btn-sm">{s.kind === 'practice' ? 'לתרגל עכשיו' : s.kind === 'exam' ? 'הכנת מבחן תרגול' : 'לתרגול היומי'}</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {latest?.result?.nextSteps?.length > 0 && (
        <Box tone="ai" title="המלצות מהבדיקה האחרונה">
          <p className="muted">{latest.title}</p>
          <ol className="steps">{latest.result.nextSteps.map((n, i) => <li key={i}><Markdown>{n}</Markdown></li>)}</ol>
        </Box>
      )}
    </div>
  );
}
