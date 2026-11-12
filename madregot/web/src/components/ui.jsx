import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { Dialog } from '@base-ui/react/dialog';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { Progress as BaseProgress } from '@base-ui/react/progress';
import { Delete, X, ArrowRightLeft, ArrowLeft, Check } from 'lucide-react';
import { MathText } from './MathText.jsx';

/** The chapter mark: a solid circle in the topic's colour with its number. */
export function ChapterMark({ color, n, size = 'md' }) {
  return <span className={clsx('chapter-mark', `ch-${color}`, `cm-${size}`)} aria-hidden="true">{n}</span>;
}

/**
 * Fixed level ramp: one pip per level, the same everywhere in the app: done, the current one, and those ahead. `states`
 * (a guest row, content/index.js rowLevel) gives each square its own state; `done` says every stair of the row is mastered.
 */
export function LevelPips({ total, level, max, color, label = true, states, done = false }) {
  const said = done ? (total === 1 ? 'המדרגה הושלמה' : `כל ${total} המדרגות הושלמו`) : `מדרגה ${level} מתוך ${total}`;
  return (
    <span className={clsx('pips', `ch-${color}`)} role="img" aria-label={label ? said : undefined}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = states?.[i] || (n < level || n <= (max || 0) && n !== level ? 'done' : n === level ? 'cur' : 'todo');
        return <i key={n} className={state} />;
      })}
    </span>
  );
}

/** Correct answers counted toward a goal (moving up a level, a plan step): round dots, never the level squares. */
export function NeedSlots({ need, have, label = true }) {
  return (
    <span className="need" role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} aria-label={label ? `${have} מתוך ${need} נכונות לעלייה` : undefined}>
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
        <button type="button" className="stair-next" onClick={() => setN(n + 1)}>
          השלב הבא<ArrowLeft size={18} aria-hidden="true" /><span className="stair-count"><bdi dir="ltr">{n}/{steps.length}</bdi></span>
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
export function Button({ variant = 'primary', className, children, state = 'idle', busyText = 'רגע…', doneText, onClick, ...rest }) {
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
 * A segmented choice (STUDENT-15 B3): Base UI's RadioGroup drawing the .segmented / .seg buttons, so the look does not
 * change. The group is one Tab stop; the arrow keys move and choose (right to left: App.jsx sets the direction), Space
 * chooses. `options` is [[value, label], …] or [{ value, label, disabled }, …]. While `busy` nothing is chosen (the
 * focus still moves, and every option says it is unavailable).
 */
export function Segmented({ value, onValueChange, options, labelledBy, describedBy, label, className, busy = false }) {
  return (
    <RadioGroup
      value={value} className={clsx('segmented', className)} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-label={label}
      onValueChange={(v, details) => { if (busy) { details.cancel(); return; } onValueChange?.(v); }}
    >
      {options.map((o) => {
        const { value: v, label: text, disabled } = Array.isArray(o) ? { value: o[0], label: o[1] } : o;
        return (
          <Radio.Root key={String(v)} value={v} disabled={disabled} nativeButton render={<button type="button" />}
            className={(st) => clsx('seg', st.checked && 'on')} aria-disabled={busy || undefined}>
            {text}
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}

/**
 * Base UI's composite skips items marked aria-disabled when the arrow keys move, so a locked choice could never be
 * reached from the keyboard. While an arrow key is handled, the locked choices of the group lose the attribute (and get
 * it back right after), so they are focusable and still announced as unavailable.
 */
function reachLocked(e) {
  if (!e.key.startsWith('Arrow')) return;
  const locked = [...e.currentTarget.querySelectorAll('[data-locked][aria-disabled="true"]')];
  locked.forEach((el) => el.removeAttribute('aria-disabled'));
  setTimeout(() => locked.forEach((el) => el.setAttribute('aria-disabled', 'true')), 0);
}

/**
 * Choice cards (STUDENT-15 B4): Base UI's RadioGroup for a set of tap cards (מדי's wardrobe). One Tab stop, arrows in
 * reading order. A value in `locked` is never chosen: moving onto it with the arrows only focuses it, and the card's own
 * `onLocked` says how it opens.
 */
export function Choices({ value, onValueChange, locked = [], labelledBy, className, children }) {
  return (
    <RadioGroup
      value={value} aria-labelledby={labelledBy} className={className} onKeyDownCapture={reachLocked}
      onValueChange={(v, details) => { if (locked.includes(v)) { details.cancel(); return; } onValueChange?.(v); }}
    >
      {children}
    </RadioGroup>
  );
}

/** One card in Choices. A locked card stays focusable, is announced as unavailable, and opens `onLocked` (tap, Enter, Space). */
export function Choice({ value, locked = false, onLocked, describedBy, className, children }) {
  return (
    <Radio.Root
      value={value} data-value={value} className={className} data-locked={locked || undefined} aria-disabled={locked || undefined}
      aria-describedby={describedBy}
      // a locked card opens its reason (Base UI's own handler is skipped, so it is never chosen)
      onClick={locked ? (e) => { e.preventBaseUIHandler?.(); onLocked?.(value); } : undefined}
      onKeyDown={locked ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLocked?.(value); } } : undefined}
    >
      {children}
    </Radio.Root>
  );
}

/** The check inside a chosen Choice (Base UI shows it only on the chosen one). */
export const ChoiceMark = Radio.Indicator;

/**
 * A progress bar (STUDENT-15 B8) on Base UI's Progress, drawn with the existing .bar track and the screen's own fill
 * class: role=progressbar with its value, and `valueText` as what a screen reader says.
 */
export function Progress({ value, max = 100, labelledBy, valueText, className, trackClassName, fillClassName }) {
  return (
    <BaseProgress.Root className={className} value={value} max={max} aria-labelledby={labelledBy} getAriaValueText={valueText ? () => valueText : undefined}>
      <BaseProgress.Track className={clsx('bar', trackClassName)}><BaseProgress.Indicator className={fillClassName} /></BaseProgress.Track>
    </BaseProgress.Root>
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

export function Keypad({ onKey, primary, onPrimary, primaryDisabled, onNext, nextLabel = 'לשדה הבא' }) {
  const keys = ['7', '8', '9', 'del', '4', '5', '6', '-', '1', '2', '3', '/', '0', '.'];
  return (
    <div className="keypad" dir="ltr">
      {keys.map((k) => (
        <button key={k} type="button" data-k={KEY_AREA[k]} className={clsx('key', k === '-' && 'key-minus', k === 'del' && 'key-del', k === '0' && primary == null && (onNext ? 'key-wide' : 'key-wide3'))}
          aria-label={k === 'del' ? 'מחיקה' : k === '-' ? 'מינוס' : k === '/' ? 'שבר' : k === '.' ? 'נקודה עשרונית' : k}
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
 */
export function Sheet({ open, onOpenChange, title, children, footer, wide, className, dismissible = true }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal={!dismissible}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup className={clsx('sheet', wide && 'wide', className)} dir="rtl" data-region="feedback">
          <header className="sheet-head">
            <Dialog.Title className="sheet-title">{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="סגירה"><X size={22} aria-hidden="true" /></Dialog.Close>
          </header>
          {/* a region the keyboard can reach and scroll, even when it holds only text (axe: scrollable-region-focusable) */}
          <div className="sheet-body" tabIndex={0} role="region" aria-label={typeof title === 'string' ? title : undefined}>{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

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
