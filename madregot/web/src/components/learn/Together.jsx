// Stage C: solve together. The student picks each next step and checks it with the bottom "בדיקה", as everywhere
// else in the app; the result rises in the bottom sheet (green, or yellow with that choice's own feedback, and the
// hints grow stronger). The last move is the student's: a typed answer. A wrong number there is checked against the
// stair's misconceptions (learn/content/togetherDiag.ts) and the one it fits is named. After two hints and a third miss
// the answer is shown with the reason, so nobody is stuck in a loop. Praise is honest: "לבד" only without a hint.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { ArrowLeft, Check, Lightbulb, X } from 'lucide-react';
import { Tex, MathText, mathPlain } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Prompt, ResultWhy } from './StepPlayer.jsx';
import { Segments } from '@/components/ds.jsx';
import { parseNum, near, T, plainNum } from '@/content/util.js';
import { enter } from '@/lib/motion.js';
import { play } from '@/lib/sound.js';
import { qaOn } from '@/lib/qa.js';

function Hints({ hints, level }) {
  if (!level) return null;
  return (
    <div className="tg-hints" aria-live="polite">
      {hints.slice(0, level).map((h, i) => <p key={i} className="ls-why warm"><Lightbulb size={16} aria-hidden="true" /> <span className="tg-hint-n">{i === 0 ? 'רמז' : 'רמז חזק יותר'}:</span> <MathText text={h} /></p>)}
    </div>
  );
}

/** What a wrong last step most likely shows: the misconceptions it fits, by name (one, or "maybe this, maybe that"). */
function namedMistake(ids, names) {
  const t = ids.map((id) => names[id]).filter(Boolean);
  if (!t.length) return null;
  // more than one fits: the first (the stair's main one) said as a possibility, so the sheet stays short on a phone
  return t.length === 1 ? `מה כנראה קרה: ${t[0]}.` : `אולי ${t[0]}.`;
}

/**
 * onAttempt(ok, cands): each move, for the learning record (all moves here count as learning with help); cands are the
 * misconceptions a wrong last step fits. diagnose(u) gives those ids; names maps an id to its words.
 */
export default function Together({ problem, n, of, onDone, onAttempt, decimal = false, renderHead, diagnose, names = {} }) {
  const [k, setK] = useState(0); // the step; problem.steps.length = the final answer
  const [picked, setPicked] = useState({}); // step → choices already checked
  const [sel, setSel] = useState(null); // the choice picked now, before "בדיקה"
  const [hint, setHint] = useState(0);
  const [built, setBuilt] = useState([]); // what the solved steps gave
  const [typed, setTyped] = useState('');
  const [finalMiss, setFinalMiss] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrongVal, setWrongVal] = useState(null); // the typed answer that was just checked and missed
  const [missIds, setMissIds] = useState([]); // the misconceptions that wrong answer fits
  const ref = useRef(null);
  useEffect(() => { setHint(0); setSel(null); ref.current?.focus({ preventScroll: true }); }, [k]);
  const onFinal = k >= problem.steps.length;
  const step = problem.steps[k];
  // test hook: the move being asked for now
  useEffect(() => { if (qaOn()) window.__madregotGuided = onFinal ? { final: problem.final } : { step }; }, [k, problem]); // eslint-disable-line react-hooks/exhaustive-deps

  const tried = picked[k] || [];
  const last = tried.length ? tried[tried.length - 1] : null; // the choice checked last
  const stepOk = !onFinal && last != null && step.choices[last].ok;
  const giveUp = finalMiss >= 3;
  // Same rule as every graded answer in the app: picking or typing only selects; "בדיקה" at the bottom judges it.
  const check = () => {
    if (!onFinal) {
      if (sel == null) return;
      const c = step.choices[sel];
      setPicked({ ...picked, [k]: [...tried, sel] });
      setSel(null);
      onAttempt?.(c.ok);
      if (c.ok) play('correct'); else { play('wrong'); setHint((h) => Math.min(2, h + 1)); }
      return;
    }
    const u = parseNum(typed);
    if (u == null) return;
    // the same tolerance as practice (isCorrect): -2/3 typed as -0.67 is right
    const ok = near(u, problem.final.answer, 0.01);
    const ids = ok ? [] : (diagnose?.(u) || []);
    onAttempt?.(ok, ids.length ? ids.map((id) => ({ id, conf: 1 / ids.length })) : undefined);
    if (ok) { play('correct'); setSolved(true); } else { play('wrong'); setWrongVal(typed); setMissIds(ids); setFinalMiss((x) => x + 1); setHint((h) => Math.min(2, h + 1)); }
  };
  const next = () => {
    if (onFinal) { onDone?.(); return; }
    setBuilt([...built, step.done]);
    setK(k + 1);
  };
  const answerTex = decimal && !Number.isInteger(problem.final.answer) ? plainNum(problem.final.answer, { decimal: true }) : T(problem.final.answer);
  // the result sheet, as in teaching: green when right, yellow (never red) when not yet
  const result = !onFinal
    ? (last == null ? null : stepOk
      ? { tone: 'good', title: 'נכון!', body: <MathText text={step.choices[last].feedback} /> }
      : sel == null ? { tone: 'warm', title: 'עוד לא. בחרו צעד אחר', body: <MathText text={step.choices[last].feedback} /> } : null)
    // "לבד" only when no hint was shown (a miss shows one too); after a hint, the praise says so, warmly
    : solved ? (hint === 0
      ? { tone: 'good', title: 'פתרתם לבד!', body: <>בדיוק! פתרתם את הצעד האחרון לבד.</> }
      : { tone: 'good', title: 'נכון, בעזרת רמז', body: <>הגעתם לתשובה, והרמז עזר בדרך. בתרגול תפתרו תרגילים כאלה לבד.</> })
      : giveUp ? { tone: 'warm', title: 'נחזור על זה בתרגול', body: <>התשובה היא <Tex tex={answerTex} />. נעבור על זה שוב בתרגול.</> }
        : finalMiss > 0 && typed === wrongVal ? { tone: 'warm', title: 'עוד לא. נסו שוב', body: namedMistake(missIds, names) ? <MathText text={namedMistake(missIds, names)} /> : <>בדקו את החישוב, והרמז למטה יכול לעזור.</> } : null;
  const done = stepOk || solved || giveUp;
  const canCheck = onFinal ? parseNum(typed) != null && typed !== wrongVal : sel != null;
  const moves = problem.steps.length + 1;
  const bar = <Segments steps={moves} done={solved ? moves : k + (stepOk ? 1 : 0)} current={k} size="thin" label={`פותרים יחד ${n} מתוך ${of}`} valueText={`צעד ${Math.min(k + 1, moves)} מתוך ${moves}`} />;
  return (
    <div className="together lm">
      {renderHead ? renderHead(bar) : <div className="lm-progress">{bar}</div>}
      <section className="lm-card" data-region="content">
      <Prompt tag={`פותרים יחד ${n} מתוך ${of}`}><p><MathText text={problem.problem} /></p></Prompt>
      {(problem.display || built.length > 0) && (
        <div className="lm-canvas big" data-region="visual">
          {problem.display && <div className="lm-expr"><Tex tex={problem.display} display /></div>}
          {built.length > 0 && (
            <ol className="tg-built" aria-label="מה עשינו עד עכשיו">
              {built.map((b, i) => <li key={i}><Check size={16} aria-hidden="true" /> <MathText text={b} /></li>)}
            </ol>
          )}
        </div>
      )}
      <m.section key={k} ref={ref} tabIndex={-1} className="tg-step lm-response" data-region="answers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter(0.22)} aria-label={onFinal ? 'הצעד האחרון' : `צעד ${k + 1}`}>
        {!onFinal ? (
          <>
            <p className="tg-prompt"><MathText text={step.prompt} /></p>
            {step.display && <div className="ls-display"><Tex tex={step.display} display /></div>}
            <div className="ls-choices" role="radiogroup" aria-label="הצעד הבא">
              {step.choices.map((c, i) => {
                const was = tried.includes(i);
                const state = was ? (c.ok ? 'good' : 'bad') : '';
                const on = sel === i;
                return (
                  <button key={i} type="button" role="radio" aria-checked={on || (was && c.ok)} aria-label={mathPlain(c.text)} className={clsx('choice', 'ls-choice', state, on && 'on')} disabled={was || stepOk} onClick={() => { setSel(i); play('tap'); }}>
                    <span className="choice-key" aria-hidden="true">{state === 'good' ? <Check size={18} strokeWidth={3.4} /> : state === 'bad' ? <X size={18} strokeWidth={3.4} /> : i + 1}</span>
                    <span className="choice-text"><MathText text={c.text} /></span>
                  </button>
                );
              })}
            </div>
            <Hints hints={step.hints} level={hint} />
            {hint < 2 && !stepOk && <button type="button" className="link-btn" onClick={() => setHint(hint + 1)}><Lightbulb size={16} aria-hidden="true" />{hint ? 'עוד רמז' : 'רמז'}</button>}
          </>
        ) : (
          <>
            <p className="tg-prompt"><MathText text={problem.final.prompt} /></p>
            <form className="tg-final" onSubmit={(e) => { e.preventDefault(); if (canCheck && !done) check(); }}>
              <label htmlFor={`tg-${n}`} className="visually-hidden">התשובה</label>
              <input id={`tg-${n}`} className={clsx('input', 'tg-input', solved && 'good')} dir="ltr" inputMode="text" autoComplete="off" readOnly={done} value={giveUp && !solved ? '' : typed} onChange={(e) => setTyped(e.target.value.replace(/[^\d\-−./,]/g, '').slice(0, 9))} placeholder="?" />
            </form>
            <Hints hints={problem.final.hints} level={solved ? 0 : hint} />
            {!done && hint < 2 && <button type="button" className="link-btn" onClick={() => setHint(hint + 1)}><Lightbulb size={16} aria-hidden="true" />{hint ? 'עוד רמז' : 'רמז'}</button>}
          </>
        )}
      </m.section>
      </section>
      <footer className={clsx('lm-actions', result && `has-${result.tone}`)} data-region="footer">
        {result && (
          <m.div key={`${k}-${tried.length}-${finalMiss}-${result.tone}`} className="bl-result" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={enter(0.22)}>
            <p className="lm-banner"><span className="lm-banner-icon" aria-hidden="true">{result.tone === 'good' ? <Check size={18} strokeWidth={3.4} /> : <Lightbulb size={18} />}</span>{result.title}</p>
            <ResultWhy tone={result.tone}><p>{result.body}</p></ResultWhy>
          </m.div>
        )}
        <div className="lm-actions-row">
          {done
            ? <Button className="sp-next btn-lg" onClick={next} data-region="primary">המשך<ArrowLeft size={18} aria-hidden="true" /></Button>
            : <Button className="lm-check btn-lg" onClick={check} disabled={!canCheck} data-region="primary">בדיקה</Button>}
        </div>
      </footer>
    </div>
  );
}
