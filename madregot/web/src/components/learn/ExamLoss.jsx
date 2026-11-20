// "מה לחזק אחרי המבחן": the stairs where a checked exam lost points and that are not recovered yet, as the ranked plan
// has them (learn/next.ts planNext, the exam-loss band). It replaced the improvement plan, which counted raw mistakes
// on its own: the same evidence now lives inside the one plan, so this list, the mission and the home name the same
// steps. Each row opens its step (a short practice, then the stair's check). With nothing lost, nothing is shown.
import { Link } from 'react-router-dom';
import { ChevronLeft, FileCheck } from 'lucide-react';
import { useNext } from '@/lib/useLearn.js';
import { MathText } from '@/components/MathText.jsx';
import { titleOf, topicTitleOf } from '@/learn/recommend.ts';

export default function ExamLoss({ id = 'exam-loss-title' }) {
  const items = useNext().items.filter((i) => i.kind === 'exam-loss');
  if (!items.length) return null;
  return (
    <section className="section exam-loss" aria-labelledby={id}>
      <h2 id={id} className="set-head">מה לחזק אחרי המבחן</h2>
      <ul className="hub-rows">
        {items.map((it) => (
          <li key={it.skill}>
            <Link to={it.to} className="hub-row">
              <span className="hub-row-icon" aria-hidden="true"><FileCheck size={22} /></span>
              <span className="hub-row-text">
                <span className="hub-row-title"><MathText text={titleOf(it.skill)} /></span>
                <span className="hub-row-desc">{topicTitleOf(it.skill)} · {it.minutes} דק׳</span>
                <span className="hub-row-desc"><MathText text={it.reason} /></span>
              </span>
              <ChevronLeft className="chev" size={20} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
