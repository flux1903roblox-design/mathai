// The evening before the exam (EXAM-MATERIAL 2): one stair's rule, short, from the stair's own teaching: its key idea,
// the rule as the stair states it with its reason, and one worked example's lines. Reading it is the evening's first
// step for the stair; its button goes on to the stair's quick check (three questions, /rescue/check?skill=). Only a stair
// of the exam's plan opens here; anything else goes back to the plan.
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/topics.js';
import { skillId } from '@/learn/skills.ts';
import { useStairContent } from '@/learn/useStairContent.js';
import { MathText, FitDisplay } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { ScreenBar, ScreenFoot } from '@/components/Screen.jsx';
import '@/styles/lazy/shared.css'; // the teaching step's maths display, shared with other screens loaded on demand (COUNCIL2-20)
import '@/styles/lazy/rescue.css'; // Exam Rescue's own rules, loaded with its screens (STUDENT-15)

export const RULE_COPY = { bar: 'נזכרים בכלל', idea: 'הרעיון', why: 'למה זה עובד?', example: 'דוגמה פתורה', go: 'הבנתי, לבדיקה המהירה', back: 'חזרה לתוכנית' };

export default function RescueRule() {
  const { topic, level: L } = useParams();
  const navigate = useNavigate();
  const level = Number(L);
  const skill = TOPIC[topic] && level >= 1 && level <= TOPIC[topic].levels.length ? skillId(topic, level) : null;
  const inPlan = useApp((s) => !!skill && !!s.learn.exam?.skills?.includes(skill));
  const seeRule = useApp((s) => s.seeRule);
  const completeMission = useApp((s) => s.completeMission);
  const content = useStairContent(inPlan ? skill : null);
  if (!inPlan) return <Navigate to="/rescue" replace />;
  const t = TOPIC[topic];
  const title = typeof t.levels[level - 1] === 'string' ? t.levels[level - 1] : t.levels[level - 1].title;
  // the stair's rule steps; a stair whose teaching states no rule step shows its idea and its reason
  const rules = (content?.discover || []).filter((s) => s.kind === 'rule');
  const example = content?.examples?.[0] || null;
  const go = () => {
    seeRule(skill);
    completeMission({ skill, kind: 'exam', rescue: 'rule' });
    navigate(`/rescue/check?skill=${skill}`, { replace: true });
  };
  return (
    <div className="page pushed rescue-rule">
      <ScreenBar title={RULE_COPY.bar} back="/rescue" />
      <main className="rule-main" data-region="content">
        <p className="rule-kicker">{t.title}</p>
        <h2 className="rule-title"><MathText text={title} /></h2>
        {content?.idea && (
          <section className="rule-block" aria-label={RULE_COPY.idea}>
            <p className="rule-idea"><MathText text={content.idea} /></p>
          </section>
        )}
        {rules.map((r, i) => (
          <section key={i} className="rule-block rule-card" aria-label={`הכלל${rules.length > 1 ? ` ${i + 1}` : ''}`}>
            <p className="rule-text"><MathText text={r.text} /></p>
            {r.display && <FitDisplay className="lm-expr rule-display" tex={r.display} />}
            {r.why && <p className="rule-why"><b>{RULE_COPY.why}</b> <MathText text={r.why} /></p>}
          </section>
        ))}
        {!rules.length && content?.why?.[0] && <section className="rule-block rule-card"><p className="rule-why"><b>{RULE_COPY.why}</b> <MathText text={content.why[0]} /></p></section>}
        {example && (
          <section className="rule-block rule-example" aria-labelledby="rule-example">
            <h3 id="rule-example" className="rule-example-title">{RULE_COPY.example}</h3>
            <p><MathText text={example.problem} /></p>
            {example.display && <FitDisplay className="lm-expr rule-display" tex={example.display} />}
            <ol className="rule-steps">
              {example.steps.map((s, i) => (
                <li key={i}><span className="rule-step-action"><MathText text={s.action} /></span><FitDisplay className="rule-step-result" tex={s.result} /></li>
              ))}
            </ol>
          </section>
        )}
      </main>
      <ScreenFoot>
        <Button className="btn-block btn-lg" onClick={go} data-region="primary">{RULE_COPY.go}</Button>
        <Button variant="ghost" className="btn-block" onClick={() => navigate('/rescue')}>{RULE_COPY.back}</Button>
      </ScreenFoot>
    </div>
  );
}
