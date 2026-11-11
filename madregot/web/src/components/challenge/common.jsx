// What every part of a challenge shares (CURRICULUM-6.4): two tries, the result strip and the one button at the bottom
// (as in a lesson: "בדיקה", then "המשך"), and a typed number with the lesson's own keypad.
import { useState } from 'react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { Check, Lightbulb } from 'lucide-react';
import { Button, Keypad } from '@/components/ui.jsx';
import { MathText, mathPlain } from '@/components/MathText.jsx';
import { ResultWhy } from '@/components/learn/StepPlayer.jsx';
import { enter } from '@/lib/motion.js';
import { TRIES } from '@/learn/challenges/grade.ts';

export const RETRY = 'עוד לא. נסו שוב, יש עוד ניסיון.';
export const SHOWN = 'הנה הפתרון. ממשיכים.';
export const CHECK = 'בדיקה';
export const GO_ON = 'המשך';

/**
 * Two tries at one question. miss() after a wrong check: 'retry' while a try is left, then 'shown' (the solution is
 * shown and the part goes on). first: right on the first try.
 */
export function useTries() {
  const [misses, setMisses] = useState(0);
  const [state, setState] = useState('open'); // 'open' | 'retry' | 'good' | 'shown'
  return {
    state, misses, first: state === 'good' && misses === 0, done: state === 'good' || state === 'shown',
    right: () => setState('good'),
    miss: () => { const n = misses + 1; setMisses(n); setState(n >= TRIES ? 'shown' : 'retry'); },
    again: () => { if (state === 'retry') setState('open'); },
  };
}

/** The result of a check, in the strip above the button: right (green), or not yet and the solution (warm). */
export function resultOf(state, { good, retry, shown }) {
  if (state === 'good') return { tone: 'good', title: 'נכון!', body: good };
  if (state === 'retry') return { tone: 'warm', title: RETRY, body: retry };
  if (state === 'shown') return { tone: 'warm', title: SHOWN, body: shown };
  return null;
}

/** The bottom of a part: the result strip once there is one, and one button. */
export function PartFooter({ result, label, onClick, disabled = false }) {
  return (
    <footer className={clsx('lm-actions', 'ch-foot', result && `has-${result.tone}`)} data-region="footer">
      {result && (
        <m.div key={`${result.tone}-${result.title}`} className="bl-result" role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={enter(0.2)}>
          <p className="lm-banner"><span className="lm-banner-icon" aria-hidden="true">{result.tone === 'good' ? <Check size={18} strokeWidth={3.4} /> : <Lightbulb size={18} />}</span>{result.title}</p>
          {result.body && <ResultWhy tone={result.tone}>{result.body}</ResultWhy>}
        </m.div>
      )}
      <div className="lm-actions-row">
        <Button className="btn-lg ch-go" onClick={onClick} disabled={disabled} data-region="primary">{label}</Button>
      </div>
    </footer>
  );
}

/** Lines of maths text, each its own paragraph. */
export const Lines = ({ lines }) => <>{lines.map((t, i) => <p key={i}><MathText text={t} /></p>)}</>;

/** What a key does to a typed value: a digit, a point, a minus at the start, a fraction bar, or delete. */
export function typeKey(value, k) {
  const v = String(value || '');
  if (k === 'del') return v.slice(0, -1);
  if (k === '-') return v.startsWith('-') ? v.slice(1) : `-${v}`;
  return `${v}${k}`.slice(0, 9);
}

/**
 * Typed numbers with the lesson's keypad: one field or several (a counterexample's slots), the keypad typing into the
 * active one and its "next" key moving on. A hardware keyboard types too (the phone's own keyboard stays closed, as in
 * a lesson). fields: [{ name, label, unit? }]; values: { name: text }.
 */
export function NumFields({ fields, values, onChange, locked = false, state = null, onEnter }) {
  const [active, setActive] = useState(fields[0].name);
  const set = (name, v) => onChange({ ...values, [name]: v });
  const next = () => { const i = fields.findIndex((f) => f.name === active); setActive(fields[(i + 1) % fields.length].name); };
  return (
    <div className="ch-num">
      <div className={clsx('ch-fields', fields.length > 1 && 'many')}>
        {fields.map((f) => (
          <label key={f.name} className="ch-field">
            {fields.length > 1 && <span className="ch-field-label"><MathText text={f.label} /></span>}
            <span className="ch-field-row">
              <input
                id={`ch-slot-${f.name}`} dir="ltr" inputMode="none" autoComplete="off" spellCheck={false} placeholder="?"
                className={clsx('slot', 'ch-slot', active === f.name && !locked && 'active', state === 'good' && 'good', state === 'bad' && 'struck')}
                aria-label={fields.length > 1 ? undefined : mathPlain(f.label)} value={values[f.name] || ''} readOnly={locked}
                onFocus={() => setActive(f.name)}
                onChange={(e) => set(f.name, e.target.value.replace(/[^\d\-−./,]/g, '').slice(0, 9))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }}
              />
              {f.unit && <span className="answer-unit">{f.unit}</span>}
            </span>
          </label>
        ))}
      </div>
      {/* after a miss the struck value is replaced by the next key, as in a lesson */}
      {!locked && <Keypad onKey={(k) => set(active, typeKey(state === 'bad' ? '' : values[active], k))} onNext={fields.length > 1 ? next : undefined} />}
    </div>
  );
}
