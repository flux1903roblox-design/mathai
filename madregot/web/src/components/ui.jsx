import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Dialog } from '@base-ui/react/dialog';
import { Delete, X } from 'lucide-react';
import { MathText } from './MathText.jsx';

/** The chapter mark: a solid circle in the topic's colour with its number. */
export function ChapterMark({ color, n, size = 'md' }) {
  return <span className={clsx('chapter-mark', `ch-${color}`, size)} aria-hidden="true">{n}</span>;
}

/** Fixed level ramp: one pip per level, the same everywhere in the app. */
export function LevelPips({ total, level, max, color, label = true }) {
  return (
    <span className={clsx('pips', `ch-${color}`)} role="img" aria-label={label ? `מדרגה ${level} מתוך ${total}` : undefined}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = n < level || n <= (max || 0) && n !== level ? 'done' : n === level ? 'cur' : 'todo';
        return <i key={n} className={state} />;
      })}
    </span>
  );
}

/** Progress toward moving up a level: 2 or 4 slots. */
export function NeedSlots({ need, have }) {
  return (
    <span className="need" role="img" aria-label={`${have} מתוך ${need} נכונות לעלייה`}>
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

export function Steps({ steps }) {
  return <ol className="steps">{steps.map((s, i) => <li key={i}><MathText text={s} /></li>)}</ol>;
}

export function Button({ variant = 'primary', className, children, ...rest }) {
  return <button type="button" className={clsx('btn', `btn-${variant}`, className)} {...rest}>{children}</button>;
}

/** Number keypad with a minus key: phone keyboards have none in numeric mode. */
export function Keypad({ onKey, primary, onPrimary, primaryDisabled }) {
  const keys = ['7', '8', '9', 'del', '4', '5', '6', '-', '1', '2', '3', '/', '0', '.'];
  return (
    <div className="keypad" dir="ltr">
      {keys.map((k) => (
        <button key={k} type="button" className={clsx('key', k === '-' && 'key-minus', k === 'del' && 'key-del')}
          aria-label={k === 'del' ? 'מחיקה' : k === '-' ? 'מינוס' : k === '/' ? 'שבר' : k === '.' ? 'נקודה עשרונית' : k}
          onPointerDown={(e) => e.preventDefault()} onClick={() => onKey(k)}>
          {k === 'del' ? <Delete size={22} aria-hidden="true" /> : k === '-' ? '−' : k}
        </button>
      ))}
      <button type="button" className="key key-primary" onPointerDown={(e) => e.preventDefault()} onClick={onPrimary} disabled={primaryDisabled}>
        {primary}
      </button>
    </div>
  );
}

/** Thinking line (transitions.dev #28): shimmer while it holds, then swap the label. */
export function Thinking({ states }) {
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

/** Bottom sheet built on Base UI's dialog (focus trap, escape, scroll lock). */
export function Sheet({ open, onOpenChange, title, children, footer, wide }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup className={clsx('sheet', wide && 'wide')} dir="rtl">
          <header className="sheet-head">
            <Dialog.Title className="sheet-title">{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="סגירה"><X size={22} aria-hidden="true" /></Dialog.Close>
          </header>
          <div className="sheet-body">{children}</div>
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
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
