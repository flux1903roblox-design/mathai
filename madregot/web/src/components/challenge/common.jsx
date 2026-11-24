// What every part of a challenge shares (CURRICULUM-6.4): two tries, the result strip and the one button at the bottom
// (as in a lesson: "בדיקה", then "המשך"), and a typed number with the lesson's own keypad.
import { useState } from 'react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { Check, Lightbulb } from 'lucide-react';
import { Button, Keypad } from '@/components/ui.jsx';
import { MathText, Tex, mathPlain } from '@/components/MathText.jsx';
import { ResultWhy } from '@/components/learn/StepPlayer.jsx';
import { enter, entrance } from '@/lib/motion.js';
import { TRIES } from '@/learn/challenges/grade.ts';
import { PARTIAL } from '@/content/partial.js';
import { numRight, piNear, PI_AFTER } from '@/content/util.js';
import { diagnosisLine } from '@/content/topics.js';
import { parseSkill } from '@/learn/skills.ts';
import '@/styles/lazy/lesson.css'; // the answer's label and its partial note are the lesson's own rules (round-3 merge)

export const RETRY = 'עוד לא. נסו שוב, יש עוד ניסיון.';
export const SHOWN = 'הנה הפתרון. ממשיכים.';
export const CHECK = 'בדיקה';
export const GO_ON = 'המשך';
/**
 * A part whose slot is followed by π (`after: '\\pi'`, the answer the number before π), answered with the whole value
 * as a decimal: 31.4 for 10π. Right, in another form: the part says so and the try does not count (content/index.js
 * partialOf 'pi-value', as in a lesson).
 */
export function piValueTyped(answer, after, u) {
  return after === PI_AFTER && answer !== 0 && !numRight(u, answer, true) && piNear(u, answer);
}

/**
 * The line under a wrong number that known mistakes explain (learn/challenges/grade.ts numMistakes gives their ids), as a
 * lesson says it (content/topics.js diagnosisLine, in the words of the stair the task comes after): "מה כנראה קרה: …",
 * two mistakes each as a possibility, no question at the end to tell them apart. Null when none.
 */
export function mistakeLine(task, ids) {
  if (!ids?.length) return null;
  const { level } = parseSkill(task.after);
  const result = ids.length === 1 ? { cat: ids[0] } : { diagnosis: { ambiguous: true, candidates: ids.map((id) => ({ id })) }, more: false };
  return diagnosisLine(task.topic, level, result);
}

/** A number part's answer as TeX, with what is drawn after its slot: 25\pi. */
export const answerTexOf = (answer, after) => `${answer}${after || ''}`;

/** The whole value typed into a □π slot (31.4 for 10π): right, in another form; the try does not count (as in a lesson). */
export const PI_VALUE_LINE = PARTIAL['pi-value'];

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
        <m.div key={`${result.tone}-${result.title}`} className="bl-result" role="status" initial={entrance({ opacity: 0, y: 12 })} animate={{ opacity: 1, y: 0 }} transition={enter(0.2)}>
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
 * a lesson). fields: [{ name, label, unit?, after? }] (`after`: TeX drawn after the slot, '\\pi' for □π); values:
 * { name: text }. `note`: a line under the fields that is not a result (a right value typed in another form).
 */
/** A screen reader's name for a slot followed by π. */
const AFTER_SAID = 'המספר שלפני פאי';

export function NumFields({ fields, values, onChange, locked = false, state = null, onEnter, note = null }) {
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
              {/* a slot with maths after it (□π) is set left to right, the number then π; the unit stays after both */}
              <span className="ch-field-math" dir="ltr">
                <input
                  id={`ch-slot-${f.name}`} dir="ltr" inputMode="none" autoComplete="off" spellCheck={false} placeholder="?"
                  className={clsx('slot', 'ch-slot', active === f.name && !locked && 'active', state === 'good' && 'good', state === 'bad' && 'struck')}
                  aria-label={fields.length > 1 ? (f.after ? AFTER_SAID : undefined) : `${mathPlain(f.label)}${f.after ? `, ${AFTER_SAID}` : ''}`} value={values[f.name] || ''} readOnly={locked}
                  onFocus={() => setActive(f.name)}
                  onChange={(e) => set(f.name, e.target.value.replace(/[^\d\-−./,]/g, '').slice(0, 9))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }}
                />
                {f.after && <span className="answer-lab ch-after" aria-hidden="true"><Tex tex={f.after} /></span>}
              </span>
              {f.unit && <span className="answer-unit">{f.unit}</span>}
            </span>
          </label>
        ))}
      </div>
      {note && <p className="answer-partial ch-note" role="status"><MathText text={note} /></p>}
      {/* after a miss the struck value is replaced by the next key, as in a lesson */}
      {!locked && <Keypad onKey={(k) => set(active, typeKey(state === 'bad' ? '' : values[active], k))} onNext={fields.length > 1 ? next : undefined} />}
    </div>
  );
}
