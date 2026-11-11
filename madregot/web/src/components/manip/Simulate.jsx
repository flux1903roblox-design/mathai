// A random experiment repeated (DATA-2.1): spin a spinner, roll a die or two, toss a coin or draw a ball from a bag
// (and put it back) 10, 100 or 1000 times, and watch the relative frequency of one outcome jump about after a few
// trials and settle after many. Phone first (critique note 22): one row with the device (96px) beside a large readout
// of the watched outcome; under it the line of that outcome's relative frequency after every 10 trials (for two dice,
// the 11 sums as bars); every outcome in a table behind "כל התוצאות"; the three batch buttons in one row at the bottom.
// At 320 × 568 the object is at most 300px tall.
//   guided   the buttons open in order: 100 after a batch of 10, 1000 after a batch of 100 ("קודם 10" / "קודם 100"), so
//            one tap on 1000 cannot skip the jumpy start a teaching step is about
//   seed     the trials come from learn/expr.ts seeded(seed), one stream for the whole object (10, then 100, then 1000
//            continue it), so a teaching step's screenshots hold every time; without it, Math.random
//   truth    a dashed line at the watched outcome's probability
//   hidden   the wheel or the bag is covered until the answer is shown (the estimate mode, critique note 23)
// A batch of 10 shows each trial (120ms each: the pointer turns, the die tumbles); 100 and 1000 come at once, the
// numbers rolling up in 400ms; with reduced motion nothing turns and the numbers simply appear. A spin is part
// floor(P·r) of the wheel's P equal parts, the sectors' parts in order; a die is 1 + floor(6r); two dice are two such.
// Never in a check: Manip.jsx shows the plain words instead in test mode, and every simulate item is practice-only.
import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { Check, ChevronDown, RotateCcw } from 'lucide-react';
import { Tex } from '../MathText.jsx';
import { labelText } from './core.jsx';
import { PatternDefs, Toned, slicePath } from './ChartArt.jsx';
import { seeded } from '@/learn/expr.ts';
import '@/styles/lazy/figure.css'; // the colour families (fig-tone-k) and patterns the wheel and the bag share with the charts
import {
  SIM_BATCHES, SIM_MAX, simOutcomes, simWatch, simWords, simEmpty, simSentence, simFreq, simChoice,
} from '@/content/manip.js';

// ---------------------------------------------------------------- the trials (pure, so the seeded claims are testable)

/** One trial: the outcome's index `o`, and what the drawing needs (where the pointer stops, the faces). */
export function simTrial(m, rnd) {
  if (m.device === 'die') { const f = 1 + Math.floor(rnd() * 6); return { o: f - 1, f }; }
  if (m.device === 'coin') return { o: Math.floor(rnd() * 2) };
  if (m.device === 'dice2') { const a = 1 + Math.floor(rnd() * 6); const b = 1 + Math.floor(rnd() * 6); return { o: a + b - 2, a, b }; }
  // a spinner: part floor(P·r) of its P equal parts; a bag: ball floor(N·r) of its N balls; the groups in order
  const parts = m.device === 'bag' ? (m.bag || []).map((b) => b.n) : (m.sectors || []).map((s) => s.parts);
  const r = rnd(); const at = Math.floor(r * parts.reduce((a, b) => a + b, 0));
  let o = 0; let acc = parts[0];
  while (at >= acc && o < parts.length - 1) { o += 1; acc += parts[o]; }
  return { o, r };
}

/** A batch of `size` trials added to a run: the new run, and the trials to show (all ten of a 10, else the last). */
export function simBatch(m, u, size, rnd) {
  const w = simWatch(m); const counts = [...u.counts]; const hist = [...(u.hist || [])];
  let { n } = u; const shown = [];
  for (let i = 0; i < size; i += 1) {
    const t = simTrial(m, rnd); counts[t.o] += 1; n += 1;
    if (n % 10 === 0) hist.push(counts[w]);
    if (size === 10 || i === size - 1) shown.push(t);
  }
  return { value: { ...u, n, counts, batches: [...u.batches, size], hist }, trials: shown };
}

/** The run after these batches, from the seed (or the source given). */
export const simRun = (m, sizes, rnd = m.seed != null ? seeded(m.seed) : Math.random) => sizes.reduce((u, s) => simBatch(m, u, s, rnd).value, simEmpty(m));

/** Does the object take this run as its own (else it starts empty)? */
const runOf = (m, v) => (v && Array.isArray(v.counts) && v.counts.length === simOutcomes(m).length ? v : v?.pick != null ? { ...simEmpty(m), pick: v.pick } : simEmpty(m));

// ---------------------------------------------------------------- the devices, 96 × 96

const D = 96; const C = 48;
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
/** A die's face at (x, y), s wide: its pips, or nothing yet. */
function Face({ x, y, s, f, spin }) {
  const c = s / 2; const d = s * 0.27;
  return (
    <g className={clsx('mp-sim-face', spin && 'tumble')} style={{ transformOrigin: `${x + c}px ${y + c}px` }}>
      <rect x={x} y={y} width={s} height={s} rx={s * 0.2} className="mp-sim-die" />
      {f ? PIPS[f].map(([i, j], k) => <circle key={k} cx={x + c + i * d} cy={y + c + j * d} r={s * 0.09} className="mp-sim-pip" />)
        : <text x={x + c} y={y + c + 6} textAnchor="middle" className="mp-sim-q small">?</text>}
    </g>
  );
}

/** The spinner: its sectors in their colours (each part's line drawn, so 3 of 12 can be counted), or a cover. */
function Spinner({ m, outs, covered, angle, pid }) {
  const R = 44; const P = m.sectors.reduce((a, s) => a + s.parts, 0) || 1;
  let at = 0;
  const sectors = m.sectors.map((s, i) => { const a0 = (at * 360) / P; at += s.parts; return { i, a0, a1: (at * 360) / P }; });
  const ray = (a, r = R) => [C + r * Math.sin((a * Math.PI) / 180), C - r * Math.cos((a * Math.PI) / 180)];
  return (
    <g>
      {covered ? (
        <g className="mp-sim-covered">
          <circle cx={C} cy={C} r={R} className="mp-sim-cover" />
          <circle cx={C} cy={C} r={R} fill={`url(#${pid}-1)`} className="mp-sim-cover-pat" />
          <text x={C} y={C + 32} textAnchor="middle" className="mp-sim-q">?</text>
        </g>
      ) : sectors.map((s) => (
        <Toned key={s.i} tone={outs[s.i].tone % 8} pid={pid}>
          {(cls, fill) => (s.a1 - s.a0 >= 359.99 ? <circle cx={C} cy={C} r={R} className={cls} fill={fill} /> : <path d={slicePath(C, C, R, s.a0, s.a1)} className={cls} fill={fill} />)}
        </Toned>
      ))}
      {!covered && Array.from({ length: P }, (_, k) => { const [x, y] = ray((k * 360) / P); return <line key={k} x1={C} y1={C} x2={x} y2={y} className="mp-sim-part" />; })}
      {!covered && sectors.length > 1 && sectors.map((s) => { const [x, y] = ray(s.a0); return <line key={`e${s.i}`} x1={C} y1={C} x2={x} y2={y} className="mp-sim-edge" />; })}
      <circle cx={C} cy={C} r={R} className="mp-sim-rim" />
      <g className="mp-sim-pointer" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${C}px ${C}px` }}>
        <line x1={C} y1={C} x2={C} y2={C - R + 12} />
        <path d={`M ${C - 6} ${C - R + 14} L ${C} ${C - R + 2} L ${C + 6} ${C - R + 14} Z`} />
      </g>
      <circle cx={C} cy={C} r="5" className="mp-sim-hub" />
    </g>
  );
}

/** The bag: its balls in rows (or covered), and the last ball drawn beside it. */
function Bag({ m, outs, covered, last, pid }) {
  const balls = (m.bag || []).flatMap((b, i) => Array.from({ length: b.n }, () => i));
  const per = balls.length > 12 ? 6 : 4; const r = balls.length > 12 ? 4.2 : 5.5; const gap = r * 2 + 2;
  return (
    <g>
      <path d="M 30 36 Q 12 52 14 72 Q 16 92 46 92 Q 76 92 78 72 Q 80 52 62 36 Z" className={clsx('mp-sim-bag', covered && 'shut')} />
      <path d="M 34 36 L 39 26 L 53 26 L 58 36" className="mp-sim-bag-neck" />
      {covered ? <text x="46" y="78" textAnchor="middle" className="mp-sim-q">?</text>
        : balls.map((o, k) => {
          const row = Math.floor(k / per); const col = k % per; const rowLen = Math.min(per, balls.length - row * per);
          const x = 46 + (col - (rowLen - 1) / 2) * gap; const y = 84 - row * gap;
          return <Toned key={k} tone={outs[o].tone % 8} pid={pid}>{(cls, fill) => <circle cx={x} cy={y} r={r} className={cls} fill={fill} />}</Toned>;
        })}
      {last && (
        <g className="mp-sim-drawn">
          <Toned tone={outs[last.o].tone % 8} pid={pid}>{(cls, fill) => <circle cx="80" cy="16" r="11" className={cls} fill={fill} />}</Toned>
          <circle cx="80" cy="16" r="11" className="mp-sim-ball-rim" />
        </g>
      )}
    </g>
  );
}

function Device({ m, outs, covered, last, angle, step, pid }) {
  switch (m.device) {
    case 'spinner': return <Spinner m={m} outs={outs} covered={covered} angle={angle} pid={pid} />;
    case 'bag': return <Bag m={m} outs={outs} covered={covered} last={last} pid={pid} />;
    case 'die': return <Face key={step} x={16} y={16} s={64} f={last?.f} spin={step > 0} />;
    case 'dice2': return <g key={step}><Face x={3} y={26} s={42} f={last?.a} spin={step > 0} /><Face x={51} y={26} s={42} f={last?.b} spin={step > 0} /></g>;
    default: return (
      <g key={step} className={clsx('mp-sim-coin', step > 0 && 'flip')} style={{ transformOrigin: `${C}px ${C}px` }}>
        <circle cx={C} cy={C} r="42" className="mp-sim-coin-face" />
        <circle cx={C} cy={C} r="35" className="mp-sim-coin-ring" />
        <text x={C} y={C + 8} textAnchor="middle" direction="rtl" className={clsx('mp-sim-coin-text', !last && 'mp-sim-q')}>{last ? outs[last.o].label : '?'}</text>
      </g>
    );
  }
}

/** The device in words: what a screen reader hears for the drawing (a covered wheel says only that). */
function deviceWords(m, outs, covered, last) {
  const got = last ? `; יצא ${m.device === 'dice2' ? `${last.a} ו־${last.b}` : outs[last.o].label}` : '';
  if (m.device === 'spinner') {
    if (covered) return `גלגל מכוסה${got}`;
    const P = m.sectors.reduce((a, s) => a + s.parts, 0);
    return `גלגל מחולק ל־${P} חלקים שווים: ${m.sectors.map((s) => `${s.label} ${s.parts}`).join(', ')}${got}`;
  }
  if (m.device === 'bag') {
    if (covered) return `שקית שלא רואים מה יש בה${got}`;
    return `שקית עם ${m.bag.reduce((a, b) => a + b.n, 0)} כדורים: ${m.bag.map((b) => `${b.label} ${b.n}`).join(', ')}${got}`;
  }
  return `${m.device === 'die' ? 'קובייה' : m.device === 'coin' ? 'מטבע' : 'שתי קוביות'}${got}`;
}

// ---------------------------------------------------------------- the chart under the device

const CW = 288; const CH = 96; const CX0 = 22; const CX1 = 282;
const cy = (f) => 6 + (1 - f) * (CH - 12);

/** The watched outcome's relative frequency after every 10 trials, 0 to 1 (at least 100 trials wide). */
function FreqLine({ hist, n, p, truth, name }) {
  const span = Math.max(n, 100);
  const pts = hist.slice(0, Math.floor(n / 10)).map((k, j) => [CX0 + ((10 * (j + 1)) / span) * (CX1 - CX0), cy(k / (10 * (j + 1)))]);
  const end = pts[pts.length - 1];
  return (
    <>
      <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" className="mp-sim-plot" aria-hidden="true">
        {[0, 0.5, 1].map((f) => <line key={f} x1={CX0} x2={CX1} y1={cy(f)} y2={cy(f)} className={f ? 'mp-sim-grid' : 'mp-sim-base'} />)}
        <line x1={CX0} x2={CX0} y1={cy(1)} y2={cy(0)} className="mp-sim-base" />
        {truth && <line x1={CX0} x2={CX1} y1={cy(p)} y2={cy(p)} className="mp-sim-truth" />}
        {pts.length > 1 && <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} className="mp-sim-line" />}
        {end && <line x1={end[0]} x2={end[0]} y1={end[1]} y2={end[1]} className="mp-sim-dot" />}
      </svg>
      {[1, 0.5, 0].map((f) => <span key={f} className="mp-sim-y" style={{ top: `${Math.min(CH - 17, Math.max(1, cy(f) - 8))}px` }}>{f === 0.5 ? '½' : f}</span>)}
      <span className="mp-sim-cap">
        {truth && <i className="mp-sim-key" />}השכיחות היחסית של {name}
        {truth && <><i className="mp-sim-key dash" />הסיכוי</>}
      </span>
    </>
  );
}

/** Two dice: how many times each sum came, as 11 bars (the watched sum in the brand colour). */
function SumBars({ counts, w }) {
  const top = Math.max(1, ...counts);
  return (
    <div className="mp-sim-sums" aria-hidden="true">
      {counts.map((c, i) => (
        <div key={i} className={clsx('mp-sim-sum', i === w && 'on')}>
          <div className="mp-sim-bar"><i style={{ height: `${(c / top) * 100}%` }} /></div>
          <span>{i + 2}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the object

export default function Simulate({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const reduce = useReducedMotion();
  const pid = `sim-${useId().replace(/[^\w-]/g, '')}`;
  const tableId = `${pid}-all`;
  const outs = simOutcomes(m); const w = simWatch(m); const words = simWords(m); const o = outs[w];
  const u = runOf(m, value);
  const est = answer?.mode === 'estimate';
  const shown = good || reveal;
  const covered = !!m.hidden && !shown;
  // one source of trials for the whole object: the seeded stream continues across batches and restarts
  // (keyed by what the object is, so a parent that rebuilds the same spec does not restart the stream)
  const key = `${m.device}|${m.seed}|${JSON.stringify(m.sectors || m.bag || '')}`;
  const src = useRef(null);
  if (!src.current || src.current.key !== key) src.current = { key, rnd: m.seed != null ? seeded(m.seed) : Math.random };
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(null); // the last trial, for the device: where the pointer stopped, the faces
  const [angle, setAngle] = useState(0); // the pointer's turn so far (it only ever turns forward)
  const [play, setPlay] = useState(null); // a batch being shown: { id, base, final, trials, angles, k }
  const playing = play && play.final === value ? play : null;

  useEffect(() => {
    if (!play) return undefined;
    const ticks = play.trials.length > 1 ? play.trials.length : 20; const dur = play.trials.length > 1 ? 120 * ticks : 400;
    let raf = 0; const t0 = performance.now();
    const tick = (now) => {
      const k = Math.floor(((now - t0) / dur) * ticks);
      if (k >= ticks) { setPlay(null); return; }
      setPlay((p) => (p && p.id === play.id && p.k !== k ? { ...p, k } : p));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const opened = (s) => !m.guided || s === 10 || u.batches.includes(s === 100 ? 10 : 100);
  const run = (s) => {
    if (locked || !opened(s) || u.n + s > SIM_MAX) return;
    const { value: next, trials } = simBatch(m, u, s, src.current.rnd);
    // the pointer turns forward to each trial's place on the wheel
    let a = angle; const angles = trials.map((t) => { if (t.r == null) return a; a += ((t.r * 360 - a) % 360 + 360) % 360; return a; });
    setLast(trials[trials.length - 1]); setAngle(a);
    setPlay(reduce ? null : { id: (play?.id || 0) + 1, base: u, final: next, trials, angles, k: 0 });
    onChange(next);
  };
  const restart = () => { if (locked) return; setPlay(null); setLast(null); onChange(u.pick != null ? { ...simEmpty(m), pick: u.pick } : simEmpty(m)); };
  const pick = (i) => { if (!locked) onChange({ ...u, pick: i }); };

  // what is drawn now: the run, or a batch on its way (a 10 one trial at a time, a 100 or a 1000 rolling up)
  let view = u; let lastShown = last; let angleShown = angle; let step = 0;
  if (playing) {
    const { base, final, trials, k } = playing;
    if (trials.length > 1) {
      const counts = [...base.counts]; trials.slice(0, k + 1).forEach((t) => { counts[t.o] += 1; });
      view = { ...base, n: base.n + k + 1, counts }; lastShown = trials[k]; angleShown = playing.angles[k]; step = k + 1;
    } else {
      const q = (k + 1) / 20;
      view = { ...final, n: Math.round(base.n + q * (final.n - base.n)), counts: final.counts.map((c, i) => Math.round(base.counts[i] + q * (c - base.counts[i]))) };
    }
  }
  const kw = view.counts[w];
  const sentence = simSentence(m, u);
  const sums = m.device === 'dice2';
  const chartLabel = sums && u.n ? `${sentence} כמה פעמים יצא כל סכום: ${u.counts.map((c, i) => `${i + 2}: ${c}`).join(', ')}.` : sentence;
  const hintText = est
    ? `${words.act} הרבה פעמים, ובחרו את השבר הקרוב לשכיחות היחסית.`
    : m.guided ? `קודם 10, אחר כך 100, ואז 1000. ${words.act} עד שיהיו לפחות ${answer?.atLeast ?? 1000} ${words.noun}.` : `${words.act} עד שיהיו לפחות ${answer?.atLeast ?? 1000} ${words.noun}.`;

  return (
    <div className={clsx('manip manip-simulate', good && 'good')}>
      {hint && <p className="manip-hint-line">{hintText}</p>}
      <div className="mp-sim-row">
        <svg viewBox={`0 0 ${D} ${D}`} className="mp-sim-device" role="img" aria-label={deviceWords(m, outs, covered, last)}>
          <PatternDefs id={pid} />
          <Device m={m} outs={outs} covered={covered} last={lastShown} angle={angleShown} step={step} pid={pid} />
        </svg>
        <div className="mp-sim-side">
          <div className="manip-readout mp-sim-read" aria-live="polite" aria-atomic="true">
            <span className="visually-hidden">{sentence}</span>
            <span className="mp-sim-big" aria-hidden="true">
              {(m.device === 'spinner' || m.device === 'bag') && <i className={`mp-sim-swatch fig-tone-${o.tone % 8}`} />}
              <span className="mp-sim-name">{o.name}:</span> <b dir="ltr">{view.n ? simFreq(kw, view.n) : '–'}</b>
            </span>
            <span className="mp-sim-small" aria-hidden="true">{view.n ? `${kw} מתוך ${view.n} ${words.noun}` : `${words.none}`}</span>
          </div>
          <button type="button" className="mp-sim-more" aria-expanded={open} aria-controls={tableId} onClick={() => setOpen((x) => !x)}>
            כל התוצאות <ChevronDown size={16} strokeWidth={2.6} aria-hidden="true" className={clsx(open && 'up')} />
          </button>
        </div>
      </div>
      <div className={clsx('mp-sim-chart', sums && 'sums')} role="img" aria-label={chartLabel}>
        {sums ? <SumBars counts={view.counts} w={w} /> : <FreqLine hist={(playing && playing.trials.length > 1 ? playing.base : u).hist || []} n={playing && playing.trials.length > 1 ? playing.base.n : u.n} p={o.p} truth={!!m.truth && !covered} name={o.name} />}
      </div>
      <table id={tableId} className="mp-sim-table" hidden={!open}>
        <caption className="visually-hidden">כל התוצאות עד עכשיו</caption>
        <thead><tr><th scope="col">תוצאה</th><th scope="col">כמה פעמים</th><th scope="col">שכיחות יחסית</th></tr></thead>
        <tbody>
          {outs.map((x, i) => (
            <tr key={i} className={i === w ? 'on' : undefined}>
              <th scope="row">{(m.device === 'spinner' || m.device === 'bag') && <i className={`mp-sim-swatch fig-tone-${x.tone % 8}`} aria-hidden="true" />}<bdi>{x.label}</bdi></th>
              <td dir="ltr">{u.counts[i]}</td>
              <td dir="ltr">{simFreq(u.counts[i], u.n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {est && (
        <div className="mp-sim-pick" role="group" aria-label="בערך איזה חלק?">
          <span className="mp-sim-pick-q" aria-hidden="true">בערך איזה חלק?</span>
          {answer.choices.map((c, i) => {
            const ch = simChoice(c); const right = shown && i === answer.answer;
            return (
              <button key={i} type="button" className={clsx('mp-sim-choice', u.pick === i && 'on', right && 'right')} aria-pressed={u.pick === i}
                aria-label={`${labelText(ch.tex)}${right ? ' (התשובה)' : ''}`} disabled={locked} onClick={() => pick(i)}>
                <Tex tex={ch.tex.replace(/\\frac/g, '\\dfrac')} />{right && <Check size={16} strokeWidth={3} aria-hidden="true" className="mp-sim-right" />}
              </button>
            );
          })}
        </div>
      )}
      <div className="mp-sim-btns">
        {SIM_BATCHES.map((s, i) => {
          const on = opened(s);
          return (
            <button key={s} type="button" className={clsx('mp-sim-btn', !on && 'shut')} disabled={locked || u.n + s > SIM_MAX} aria-disabled={on ? undefined : 'true'} onClick={() => run(s)}>
              <b dir="ltr">{s}</b>{' '}
              {on ? <span className="mp-sim-noun">{words.noun}</span> : <><span className="visually-hidden">{words.noun}, </span><span className="mp-sim-noun">קודם {SIM_BATCHES[i - 1]}</span></>}
            </button>
          );
        })}
        <button type="button" className="mp-sim-btn reset" aria-label="להתחיל מחדש" disabled={locked || !u.n} onClick={restart}>
          <RotateCcw size={18} strokeWidth={2.6} aria-hidden="true" /><span className="mp-sim-noun">מחדש</span>
        </button>
      </div>
    </div>
  );
}

/** What מדי says (Manip.jsx): the start, then what a short and a long run show; never whether a pick is right. */
export function simCoach(m, v, answer, touched) {
  const w = simWords(m); const n = v?.n || 0;
  const est = answer?.mode === 'estimate';
  if (est) {
    if (!touched) {
      const lead = m.hidden ? (m.device === 'bag' ? 'לא רואים מה יש בשקית. ' : 'הגלגל מכוסה. ') : '';
      return `${lead}${w.act} כמה פעמים, ואז בחרו.`;
    }
    if (v?.pick != null && n < 100) return `אפשר ${w.inf} עוד לפני שבוחרים.`;
  } else if (!touched) return `${w.act} 10 פעמים, ואז עוד 100. מה קורה לשכיחות היחסית?`;
  if (!n) return `${w.none}.`;
  if (n <= 10) return `${w.ten} זה מעט: השכיחות היחסית עוד קופצת.`;
  if (n < 100) return `גם ${n} ${w.noun} זה מעט: השכיחות היחסית עוד קופצת.`;
  if (n < 1000) return `אחרי ${n} ${w.noun} השכיחות היחסית קופצת פחות. ${est ? 'איזה שבר קרוב אליה?' : `${w.act} עוד 1000.`}`;
  return `אחרי הרבה ${w.noun} השכיחות היחסית כמעט לא זזה.`;
}

