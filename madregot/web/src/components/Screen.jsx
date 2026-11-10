// The app's screen skeletons (LAYOUT_SPEC, part E). Every screen is one of four kinds, and each kind is built from
// these parts, so the header, where the content starts and where the one primary action sits are the same
// everywhere:
//   a tab's own screen     PageHero (a solid block in the screen's colour) + cards, the tab bar below;
//   a pushed screen        ScreenBar (back, the title in the middle) + content, its one primary in ScreenFoot;
//   a question flow        Flow: back + a progress bar, מדי asks in a bubble, the answers, "המשך" at the bottom;
//   a result               centred מדי and a title, tiles, one pinned button (LessonDone, CheckDone).
// A screen with its own pinned primary has no tab bar on a phone: the primary takes the bar's place, as in
// Duolingo's lessons, onboarding and results.
import { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import Mascot from './Mascot.jsx';
import { useDurable, savedHealth } from '@/lib/durable/useDurable.js';
import { Button, Sheet } from './ui.jsx';

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
export function Flow({ label, step, steps, onBack, ask, mood = 'idle', children, foot, onSubmit, className, askId = 'flow-q', form = true }) {
  // form={false}: a step that holds its own form (an email sign-in), since forms cannot nest
  const Tag = form ? 'form' : 'div';
  const formProps = form ? { onSubmit: (e) => { e.preventDefault(); onSubmit?.(); }, noValidate: true } : {};
  return (
    <Tag className={clsx('ob', 'ob-flow', className)} {...formProps}>
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <div className="ob-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={steps} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / steps) * 100}%` }} /></div>
      </header>
      <main className="ob-main" data-region="content">
        <div className="ob-ask" data-region="question">
          <p className="ob-bubble" id={askId}>{ask}</p>
        </div>
        {children}
      </main>
      {foot && <footer className="ob-foot" data-region="footer">{foot}</footer>}
    </Tag>
  );
}

/**
 * Before anything is deleted or left behind: the quit sheet's build (Duolingo's, LAYOUT_SPEC A9) for every such
 * question. מדי, what will happen, the big button keeps things as they are, and the destructive action is a quiet
 * red text button under it, so it is never the obvious tap.
 */
export function ConfirmSheet({ open, onOpenChange, title, children, keep = 'ביטול', confirm, onConfirm, mood = 'oops' }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="exit-sheet confirm-sheet">
        <Mascot mood={mood} size={88} />
        <div className="lead confirm-text">{children}</div>
        <Button className="btn-block btn-lg" onClick={() => onOpenChange(false)}>{keep}</Button>
        <Button variant="ghost" className="btn-block exit-quit" onClick={onConfirm}>{confirm}</Button>
      </div>
    </Sheet>
  );
}

/** While a screen's code loads: מדי in the middle, one line. */
export function LoadingState({ text = 'טוענים…' }) {
  return (
    <div className="page loading-state" role="status" aria-live="polite">
      <Mascot mood="thinking" size={96} />
      <p className="loading-text">{text}</p>
    </div>
  );
}

/**
 * If a screen breaks, the app says so in its own voice instead of going blank, and offers the two ways out:
 * load again, or back to the start. Nothing the student saved is touched. It says the progress is saved only when it
 * is (lib/durable/useDurable.js): when the browser could not save the last changes, it says they may be lost.
 */
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Madregot screen error', error); } // eslint-disable-line no-console
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page pushed error-screen" role="alert">
        <section className="empty-state" data-region="content">
          <Mascot mood="oops" size={120} className="empty-madi" />
          <h1 className="empty-title">משהו במסך הזה לא עבד</h1>
          <div className="empty-text"><p>{savedHealth(useDurable.getState().health) ? 'ההתקדמות שלכם שמורה במכשיר.' : 'ייתכן שהשינויים האחרונים לא נשמרו.'} אפשר לטעון את המסך מחדש, או לחזור להתחלה.</p></div>
        </section>
        <footer className="screen-foot" data-region="footer">
          <Button className="btn-block btn-lg" onClick={() => window.location.reload()}>לטעון מחדש</Button>
          <a href="#/" className="foot-link" onClick={() => setTimeout(() => window.location.reload(), 0)}>חזרה להתחלה</a>
        </footer>
      </div>
    );
  }
}
