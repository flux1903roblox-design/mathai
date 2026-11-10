// The next step, above the home map, when it is not a stop of the map: an Exam Rescue step, a misconception to repair,
// a due review, points lost in an exam, or the floor check (learn/next.ts planNext().top). When the next step is a
// stair of the map, the map focuses that stair instead and there is no banner. At most one banner shows above the path;
// this one stacks last under any other.
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { KIND_ICON, KIND_LABEL } from '@/components/learn/TodayCard.jsx';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';

export default function NextBanner({ item, onGo }) {
  const Icon = KIND_ICON[item.kind] || Sparkles;
  return (
    <section className="next-banner" aria-label="הצעד הבא" data-region="banner">
      <div className="next-banner-row">
        <span className={clsx('quest-icon', `qk-${item.kind}`)} aria-hidden="true"><Icon size={22} /></span>
        <div className="next-banner-text">
          <h2 className="next-banner-title"><MathText text={item.title} /></h2>
          <p className="next-banner-meta">{KIND_LABEL[item.kind]} · {item.minutes} דק׳</p>
        </div>
      </div>
      <Button className="btn-block btn-sm next-banner-go" onClick={onGo}>לצעד הבא</Button>
    </section>
  );
}
