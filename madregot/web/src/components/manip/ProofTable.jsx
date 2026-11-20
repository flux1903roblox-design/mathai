// A proof in the class's table, טענה | נימוק (GEOM-3.4): the drawing the proof is read against on top, the נתון and צ״ל
// lines, then one row per step: its number, the claim and its reason. A given reason is plain text; an asked one is a
// chip, "בחרו נימוק", that opens its choices right under the row (a radiogroup of 44px rows, no modal). Each row moves
// with 44px "הזיזו למעלה" / "הזיזו למטה" buttons (the whole method, as in the challenge's OrderPart: there is no drag),
// and none with lockOrder. In a lesson the drawing keeps at most 30% of the stage and the table scrolls under it, so
// the triangle stays in view while the last row's reason is chosen; at 360px and below each row takes two lines.
// After a wrong check (`checked`) the first row out of place is outlined, or, when the order is right, the first wrong
// reason; `reveal` shows the whole right table. Nothing is outlined in a check (`test`). Manip.jsx loads this file on
// demand and says מדי's lines (proofCoach).
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { MathText, mathPlain } from '../MathText.jsx';
import Figure from '../Figure.jsx';
import { moveStep } from '@/learn/challenges/grade.ts';
import { proofStart, proofValueOk, proofSolution, proofFirstWrong, reasonShown } from '@/content/proof.js';
import { play } from '@/lib/sound.js';
import '@/styles/lazy/proof.css'; // the object's own rules, loaded with it (STUDENT-15)

/** What the outline says under the row a check found (GEOM-3.5). */
const OUTLINE = { order: 'השורה הזאת עוד לא במקום', reason: 'הנימוק הזה לא מתאים לשורה', missing: 'עוד לא בחרתם נימוק לשורה הזאת' };

export default function ProofTable({ m, value, onChange, locked, reveal, good, test = false, checked = false }) {
  const start = useMemo(() => proofStart(m), [m]);
  const cur = proofValueOk(m.part, value) ? value : start;
  const shown = reveal ? proofSolution(m) : cur;
  const lock = !!(locked || reveal);
  const canMove = !m.lockOrder && !lock;
  const [open, setOpen] = useState(null); // the step whose reasons are open
  const [said, setSaid] = useState(''); // the live sentence after a move or a choice
  const [focus, setFocus] = useState(null); // after a move or a choice: the control to keep the focus on
  const ctl = useRef({});
  const scrollRef = useRef(null);
  const uid = useId().replace(/[^\w-]/g, '');
  const claimId = (s) => `pf${uid}-c${s}`;
  const n = m.part.steps.length;
  // the outline after a wrong check: never in a check, and gone as soon as the student changes something
  const mark = checked && !test && !lock ? proofFirstWrong(m, cur) : null;
  const markKey = mark ? `${mark.place}:${mark.why}` : '';

  useEffect(() => { setOpen(null); setSaid(''); }, [m]);
  useEffect(() => { if (lock) setOpen(null); }, [lock]);
  useEffect(() => { if (focus) ctl.current[focus]?.focus({ preventScroll: false }); }, [cur, open, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  // the outlined row comes into view inside the table's own scroll, and a screen reader hears where it is
  useEffect(() => {
    if (!mark) return;
    // only the table scrolls (scrollIntoView would move the page too, and the drawing with it)
    const box = scrollRef.current; const row = box?.querySelector('.mp-proof-row.off');
    if (box && row) {
      const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      const bottom = top + row.offsetHeight + 40; // and the line under it
      if (top < box.scrollTop) box.scrollTop = top - 4;
      else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
    }
    setSaid(`שורה ${mark.place + 1}: ${OUTLINE[mark.why]}.`);
  }, [markKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (place, dir) => {
    if (!canMove) return;
    const order = moveStep(cur.order, place, dir);
    if (order === cur.order) return;
    const s = cur.order[place]; const to = place + dir;
    setOpen(null); play('tap');
    setSaid(`${mathPlain(m.part.steps[s].text)} עכשיו בשורה ${to + 1} מתוך ${n}.`);
    // the focus stays on the moved row: the same button, or the other one at the end of the table
    const edge = (dir < 0 && to === 0) || (dir > 0 && to === n - 1);
    setFocus(`${s}-${edge ? (dir < 0 ? 'down' : 'up') : dir < 0 ? 'up' : 'down'}`);
    onChange({ order, reasons: cur.reasons });
  };
  const choose = (s, k, close) => {
    if (lock) return;
    const reasons = [...cur.reasons]; reasons[s] = k;
    const place = cur.order.indexOf(s);
    setSaid(`נימוק לשורה ${place + 1}: ${mathPlain(m.part.steps[s].reason.choices[k])}.`);
    if (close) { setOpen(null); setFocus(`${s}-why`); play('tap'); } else setFocus(`${s}-opt${k}`);
    if (reasons[s] !== cur.reasons[s]) onChange({ order: cur.order, reasons });
  };
  const toggle = (s) => {
    if (lock) return;
    const next = open === s ? null : s;
    setOpen(next);
    setFocus(next == null ? `${s}-why` : `${s}-opt${cur.reasons[s] ?? 0}`);
  };
  // the choices: arrows move the choice (a radio group), Enter or Space keeps it and closes, Escape closes
  const onPickKey = (s, k, e) => {
    const len = m.part.steps[s].reason.choices.length;
    const step = { ArrowDown: 1, ArrowRight: -1, ArrowUp: -1, ArrowLeft: 1 }[e.key]; // right to left: → is back
    if (step) { e.preventDefault(); choose(s, (k + step + len) % len, false); return; }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); choose(s, e.key === 'Home' ? 0 : len - 1, false); return; }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(null); setFocus(`${s}-why`); }
  };
  const ref = (key) => (el) => { ctl.current[key] = el; };

  const reasonCell = (s, place) => {
    const st = m.part.steps[s];
    if (st.fixed != null) return <span className="mp-proof-fixed"><MathText text={st.fixed} /></span>;
    const r = reasonShown(st, shown.reasons[s]);
    if (lock) return <span className={clsx('mp-proof-fixed', 'asked', reveal && 'right')}>{r ? <MathText text={r} /> : '?'}</span>;
    return (
      <button type="button" ref={ref(`${s}-why`)} className={clsx('mp-proof-chip', r == null && 'empty', open === s && 'open')} onClick={() => toggle(s)}
        aria-expanded={open === s} aria-controls={`pf${uid}-pick${s}`} aria-describedby={claimId(s)}
        aria-label={r == null ? `בחרו נימוק לשורה ${place + 1}` : `נימוק לשורה ${place + 1}: ${mathPlain(r)}. לשינוי`}>
        <span className="mp-proof-chip-text">{r == null ? 'בחרו נימוק' : <MathText text={r} />}</span>
        <ChevronDown size={18} strokeWidth={2.6} aria-hidden="true" className="mp-proof-chev" />
      </button>
    );
  };

  return (
    <div className={clsx('manip', 'manip-proof', good && 'good', reveal && 'reveal', m.lockOrder && 'locked-order')}>
      {m.fig && <div className="mp-proof-fig"><Figure fig={m.fig} /></div>}
      {/* the given, the goal and the table scroll together; the box takes the keyboard's focus, so it can be scrolled
          also once the proof is locked and no button is left inside (WCAG 2.1.1, as the app's other scroll boxes) */}
      <div className="mp-proof-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="הנתון, מה שצריך להוכיח וההוכחה">
        <div className="mp-proof-head">
          <p><b>נתון:</b> <MathText text={m.given} /></p>
          <p><b>צ״ל:</b> <MathText text={m.goal} /></p>
        </div>
        <table className="mp-proof-table" role="table" aria-label="ההוכחה: טענה ונימוק">
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col" className="n"><span className="visually-hidden">שורה</span></th>
              <th role="columnheader" scope="col" className="claim">טענה</th>
              <th role="columnheader" scope="col" className="why">נימוק</th>
              {canMove && <th role="columnheader" scope="col" className="mv"><span className="visually-hidden">הזזה</span></th>}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {shown.order.map((s, place) => {
              const off = mark?.place === place;
              const st = m.part.steps[s];
              return (
                <Fragment key={s}>
                  <tr role="row" className={clsx('mp-proof-row', off && 'off', off && `off-${mark.why}`, good && 'set', reveal && 'right')} aria-current={off ? 'step' : undefined}>
                    <td role="cell" className="n">{place + 1}</td>
                    <td role="cell" className="claim" id={claimId(s)}><MathText text={st.text} /></td>
                    <td role="cell" className="why"><span className="mp-proof-why-lab" aria-hidden="true">נימוק:</span>{reasonCell(s, place)}</td>
                    {canMove && (
                      <td role="cell" className="mv">
                        <button type="button" className="icon-btn mp-proof-move" aria-label="הזיזו למעלה" aria-describedby={claimId(s)} disabled={place === 0}
                          ref={ref(`${s}-up`)} onClick={() => move(place, -1)}><ArrowUp size={20} aria-hidden="true" /></button>
                        <button type="button" className="icon-btn mp-proof-move" aria-label="הזיזו למטה" aria-describedby={claimId(s)} disabled={place === n - 1}
                          ref={ref(`${s}-down`)} onClick={() => move(place, 1)}><ArrowDown size={20} aria-hidden="true" /></button>
                      </td>
                    )}
                  </tr>
                  {off && (
                    <tr role="row" className="mp-proof-note"><td role="cell" colSpan={canMove ? 4 : 3}>{OUTLINE[mark.why]}</td></tr>
                  )}
                  {open === s && st.reason && (
                    <tr role="row" className="mp-proof-pick">
                      <td role="cell" colSpan={canMove ? 4 : 3}>
                        <div role="radiogroup" id={`pf${uid}-pick${s}`} aria-label={`נימוק לשורה ${place + 1}`} className="mp-proof-opts">
                          {st.reason.choices.map((c, k) => {
                            const on = cur.reasons[s] === k;
                            return (
                              <button key={k} type="button" role="radio" aria-checked={on} ref={ref(`${s}-opt${k}`)} tabIndex={(cur.reasons[s] ?? 0) === k ? 0 : -1}
                                className={clsx('mp-proof-opt', on && 'on')} onClick={() => choose(s, k, true)} onKeyDown={(e) => onPickKey(s, k, e)}
                                aria-label={mathPlain(c)}>
                                <span className="mp-proof-dot" aria-hidden="true" />
                                <span className="mp-proof-opt-text"><MathText text={c} /></span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="visually-hidden" aria-live="polite">{said}</p>
    </div>
  );
}
