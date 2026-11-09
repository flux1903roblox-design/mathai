// The app's screen skeletons (LAYOUT_SPEC, part E). Every screen is one of four kinds, and each kind is built from
// these parts, so the header, where the content starts and where the one primary action sits are the same
// everywhere:
//   a tab's own screen     PageHero (a solid block in the screen's colour) + cards, the tab bar below;
//   a pushed screen        ScreenBar (back, the title in the middle) + content, its one primary in ScreenFoot;
//   a question flow        Flow: back + a progress bar, מדי asks in a bubble, the answers, "המשך" at the bottom;
//   a result               centred מדי and a title, tiles, one pinned button (LessonDone, CheckDone).
// A screen with its own pinned primary has no tab bar on a phone: the primary takes the bar's place, as in
// Duolingo's lessons, onboarding and results.
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import Mascot from './Mascot.jsx';

/** A pushed screen's bar: the way back (to `back`, or one step back), the title, and an optional action at the end. */
export function ScreenBar({ title, back, backLabel = 'חזרה', end, id, className }) {
  const navigate = useNavigate();
  return (
    <header className={clsx('screen-bar', className)} data-region="header">
      <button type="button" className="icon-btn" onClick={() => (back ? navigate(back) : navigate(-1))} aria-label={backLabel}><ArrowRight size={24} aria-hidden="true" /></button>
      <h1 className="screen-bar-title" id={id}>{title}</h1>
      {end || <span className="icon-btn-spacer" aria-hidden="true" />}
    </header>
  );
}

/** The bottom of a pushed screen: its one primary action, full width, pinned; a quiet second way under it. */
export function ScreenFoot({ children, className }) {
  return <footer className={clsx('screen-foot', className)} data-region="footer">{children}</footer>;
}

/** Nothing here yet, or this needs something first: מדי in the middle, a title, one or two lines. */
export function EmptyState({ mood = 'idle', title, children, className }) {
  return (
    <section className={clsx('empty-state', className)} data-region="content">
      <Mascot mood={mood} size={120} className="empty-madi" />
      <h2 className="empty-title">{title}</h2>
      {children && <div className="empty-text">{children}</div>}
    </section>
  );
}

/**
 * One question per screen (Duolingo's onboarding): back and a progress bar, מדי asking in a bubble, the answers,
 * then the button at the bottom. step / steps: where in the flow; onBack(): the back arrow (the previous question,
 * or leaving); ask: מדי's question; foot: the bottom button(s); onSubmit: the form's submit (the bottom button).
 */
export function Flow({ label, step, steps, onBack, ask, mood = 'idle', children, foot, onSubmit, className, askId = 'flow-q' }) {
  return (
    <form className={clsx('ob', 'ob-flow', className)} onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }} noValidate>
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <div className="ob-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={steps} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / steps) * 100}%` }} /></div>
      </header>
      <main className="ob-main" data-region="content">
        <div className="ob-ask" data-region="question">
          <Mascot mood={mood} size={84} className="ob-mascot" />
          <p className="ob-bubble" id={askId}>{ask}</p>
        </div>
        {children}
      </main>
      <footer className="ob-foot" data-region="footer">{foot}</footer>
    </form>
  );
}
