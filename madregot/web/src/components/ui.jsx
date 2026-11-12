import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { Delete, ArrowRightLeft, ArrowLeft, Check } from 'lucide-react';
import { MathText } from './MathText.jsx';

import { t as tr, fmtNum } from '@/lib/i18n.js';
/** The chapter mark: a solid circle in the topic's colour with its number. */
export function ChapterMark({ color, n, size = 'md' }) {
  return <span className={clsx('chapter-mark', `ch-${color}`, `cm-${size}`)} aria-hidden="true">{n}</span>;
}

/** Fixed level ramp: one pip per level, the same everywhere in the app. */
export function LevelPips({ total, level, max, color, label = true }) {
  return (
    <span className={clsx('pips', `ch-${color}`)} role="img" aria-label={label ? tr('shell.ui.1', { level, total }) : undefined}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = n < level || n <= (max || 0) && n !== level ? 'done' : n === level ? 'cur' : 'todo';
        return <i key={n} className={state} />;
      })}
    </span>
  );
}

/** Correct answers counted toward a goal (moving up a level, a plan step): round dots, never the level squares. */
export function NeedSlots({ need, have, label = true }) {
  return (
    <span className="need" role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} aria-label={label ? tr('shell.ui.2', { have, need }) : undefined}>
      {Array.from({ length: need }, (_, i) => <i key={i} className={i < have ? 'on' : ''} />)}
    </span>
  );
}

/** The textbook box: a tinted panel with its label set on the top edge. */
export function Box({ tone = 'note', title, children, live = false, className }) {
  return (
    <section className={clsx('box', `box-${tone}`, className)} aria-live={live ? 'polite' : undefined}>
      {title && <h3 className="box-tab">{title}</h3>}
      <div className="box-body">{children}</div>
    </section>
  );
}

/**
 * A worked solution. With `stepwise` it goes down like a staircase, one step at a time: each step on its own
 * stair (numbered, a little further in than the one before), and a button for the next.
 */
export function Steps({ steps, stepwise = false }) {
  const [n, setN] = useState(stepwise ? 1 : steps.length);
  useEffect(() => { setN(stepwise ? 1 : steps.length); }, [steps, stepwise]);
  if (!stepwise) return <ol className="steps">{steps.map((s, i) => <li key={i}><MathText text={s} /></li>)}</ol>;
  return (
    <div className="stair-steps">
      <ol className="stair-list" aria-live="polite">
        {steps.slice(0, n).map((s, i) => (
          <li key={i} className="stair-step" style={{ '--i': i }}>
            <span className="stair-n" aria-hidden="true">{i + 1}</span>
            <span className="stair-text"><MathText text={s} /></span>
          </li>
        ))}
      </ol>
      {n < steps.length && (
        <button type="button" className="stair-next" onClick={() => setN(n + 1)}>{tr('shell.ui.3')}<ArrowLeft size={18} aria-hidden="true" /><span className="stair-count"><bdi dir="ltr">{n}/{steps.length}</bdi></span>
        </button>
      )}
    </div>
  );
}

/**
 * The app's button. `state` (STUDENT-15 A1, the Aceternity "stateful button" idea written here) is for an action that
 * takes a moment: 'busy' while it runs (aria-busy, a spinner next to the words; with reduced motion the words change to
 * `busyText` instead), 'done' when it worked (a check drawn next to `doneText`; with reduced motion the words only).
 * While busy or done the button keeps its place and its focus (aria-disabled, not disabled) and ignores taps, so a
 * double tap sends one request. A screen that shows 'done' does not also say it in a toast.
 */
export function Button({ variant = 'primary', className, children, state = 'idle', busyText = tr('shell.ui.4'), doneText, onClick, ...rest }) {
  const reduce = useReducedMotion();
  const held = state === 'busy' || state === 'done';
  let content = children;
  if (state === 'busy') content = reduce ? busyText : <><span className="btn-spin" aria-hidden="true" />{children}</>;
  if (state === 'done') content = reduce ? (doneText ?? children) : <><Check className="btn-check" size={20} strokeWidth={3} aria-hidden="true" />{doneText ?? children}</>;
  return (
    <button type="button" className={clsx('btn', `btn-${variant}`, held && `is-${state}`, className)} {...rest}
      onClick={held ? (e) => e.preventDefault() : onClick}
      aria-busy={state === 'busy' || undefined} aria-disabled={held || rest['aria-disabled'] || undefined}>
      {content}
    </button>
  );
}

/**
 * A progress bar (STUDENT-15 B8), drawn with the existing .bar track and the screen's own fill class: role=progressbar
 * with its value, and `valueText` as what a screen reader says. The same elements, attributes and inline style as Base
 * UI's Progress gave it (the root, the track and the indicator, with data-progressing or data-complete), written here so
 * the first screen's download carries no Base UI (COUNCIL2-14); ui.test.jsx pins the markup.
 */
export function Progress({ value, max = 100, labelledBy, valueText, className, trackClassName, fillClassName }) {
  // as Base UI computes them: the value clamped to 0..max, its share of max in percent (unrounded) for the width, and
  // that share written as a percent for a screen reader when no `valueText` is given
  const now = Math.min(Math.max(value, 0), max);
  const percent = Math.min(Math.max(max > 0 ? (value * 100) / max : 0, 0), 100);
  const state = now === max ? { 'data-complete': '' } : { 'data-progressing': '' };
  const text = valueText || fmtNum(percent / 100, { style: 'percent' });
  return (
    <div {...state} aria-labelledby={labelledBy} aria-valuemax={max} aria-valuemin={0} aria-valuenow={now} aria-valuetext={text} role="progressbar" className={className}>
      <div {...state} className={clsx('bar', trackClassName)}>
        <div {...state} style={{ insetInlineStart: 0, height: 'inherit', width: `${percent}%` }} className={fillClassName} />
      </div>
    </div>
  );
}

/** Number keypad with a minus key: phone keyboards have none in numeric mode. */
/**
 * The maths keypad: digits, minus, fraction bar, decimal point, delete. With onNext (an answer in two fields,
 * a point or a line) the last cell moves to the next field; otherwise the 0 key takes the row.
 */
/** Grid-area names, so a short screen can lay the same keys out in three rows (see .lesson .keypad in app.css). */
const KEY_AREA = { '-': 'minus', '.': 'dot', '/': 'frac', del: 'del' };
'0123456789'.split('').forEach((d) => { KEY_AREA[d] = `d${d}`; });

export function Keypad({ onKey, primary, onPrimary, primaryDisabled, onNext, nextLabel = tr('shell.ui.5') }) {
  const keys = ['7', '8', '9', 'del', '4', '5', '6', '-', '1', '2', '3', '/', '0', '.'];
  return (
    <div className="keypad" dir="ltr">
      {keys.map((k) => (
        <button key={k} type="button" data-k={KEY_AREA[k]} className={clsx('key', k === '-' && 'key-minus', k === 'del' && 'key-del', k === '0' && primary == null && (onNext ? 'key-wide' : 'key-wide3'))}
          aria-label={k === 'del' ? tr('shell.ui.6') : k === '-' ? tr('shell.ui.7') : k === '/' ? tr('shell.ui.8') : k === '.' ? tr('shell.ui.9') : k}
          onPointerDown={(e) => e.preventDefault()} onClick={() => onKey(k)}>
          {k === 'del' ? <Delete size={22} aria-hidden="true" /> : k === '-' ? '−' : k}
        </button>
      ))}
      {onNext && primary == null && (
        <button type="button" data-k="next" className="key key-next" aria-label={nextLabel} onPointerDown={(e) => e.preventDefault()} onClick={onNext}>
          <ArrowRightLeft size={22} aria-hidden="true" />
        </button>
      )}
      {primary != null && (
        <button type="button" className="key key-primary" onPointerDown={(e) => e.preventDefault()} onClick={onPrimary} disabled={primaryDisabled}>
          {primary}
        </button>
      )}
    </div>
  );
}

/** Thinking line (transitions.dev #28): shimmer while it holds, then swap the label. */
export function Thinking({ states: raw }) {
  const states = raw.map((x) => (x.endsWith('…') ? x : `${x}…`));
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(null);
  useEffect(() => {
    if (states.length < 2) return undefined;
    const t = setInterval(() => {
      setI((v) => { setPrev(v); return (v + 1) % states.length; });
    }, 2200);
    return () => clearInterval(t);
  }, [states.length]);
  useEffect(() => { if (prev == null) return undefined; const t = setTimeout(() => setPrev(null), 220); return () => clearTimeout(t); }, [prev]);
  const longest = states.reduce((a, b) => (b.length > a.length ? b : a), '');
  return (
    <span className="t-think" role="status">
      <span className="t-think-sizer" aria-hidden="true">{longest}</span>
      {prev != null && <span className="t-think-text is-exit" data-text={states[prev]} aria-hidden="true">{states[prev]}</span>}
      <span key={i} className="t-think-text is-enter" data-text={states[i]}>{states[i]}</span>
    </span>
  );
}

/**
 * Bottom sheet built on Base UI's dialog (focus trap, escape, scroll lock). `dismissible={false}`: a tap outside does not
 * close it (Escape and the close button still do).
 *
 * The dialog itself is its own small file, fetched the first time a sheet opens (COUNCIL2-14: Base UI's dialog is not
 * part of the first download; App.jsx fetches it ahead once the first screen is up, so a sheet still opens at once).
 * Once it has opened, a sheet stays mounted, so it closes with its animation.
 */
export function Sheet(props) {
  const [ever, setEver] = useState(!!props.open);
  if (props.open && !ever) setEver(true);
  if (!ever) return null;
  return <Suspense fallback={null}><SheetDialog {...props} /></Suspense>;
}
const SheetDialog = lazy(() => import('./SheetDialog.jsx'));
/** Fetch the sheet's dialog ahead (App.jsx, when the first screen is idle). */
export const preloadSheet = () => import('./SheetDialog.jsx');

/** Replays the shake (transitions.dev #12) whenever `trigger` changes. */
export function useShake(trigger) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el || !trigger) return undefined;
    el.classList.remove('is-shaking'); void el.offsetWidth; el.classList.add('is-shaking');
    const t = setTimeout(() => el.classList.remove('is-shaking'), 300);
    return () => clearTimeout(t);
  }, [trigger]);
  return ref;
}

export function Field({ label, hint, children, id }) {
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
      {hint && <p className="field-hint" id={id ? `${id}-hint` : undefined}>{hint}</p>}
    </div>
  );
}
