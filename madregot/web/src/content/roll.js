// The rules of the circle object (kind 'circle', עיגול; stage 4, MEASURE-1.3): checking a state, saying it in words, a
// solving state and a near miss. It registers itself with content/manip.js as it loads, off the first screen:
// content/net.js (and so the exercise side and the drawings) and components/manip/CircleRoll.jsx import it. (The file was content/circle.js until the topic of
// the circle, the cylinder and the cone took that name: the rules are the object's, which rolls a circle.)
//   spec   { kind: 'circle', show: 'circumference' | 'area', start: { r, t } | { r, n }, rMax?: 8, rStep?: 0.5,
//            radius?: true }
//   circumference  the radius (its handle or the Stepper רדיוס, rStep at a time, rStep..rMax) and the roll (the Stepper
//                  גלגול, a quarter turn at a time, 0..1): value { r, t }
//   area           the disc cut into n sectors (the Stepper פרוסות: 4, 6, 8, 12, 16, 24, 32), laid alternately up and
//                  down into a near-parallelogram, base πr and height r: value { r, n }; with radius: true the radius has its Stepper
//                  too (circle:2's ci2m sets the radius whose area is about S)
//   answers        { mode: 'r', r } (the radius set), { mode: 'unrolled' } (t = 1), { mode: 'sectors', min } (n ≥ min)
import { registerKind } from './manip.js';

export const SECTORS = [4, 6, 8, 12, 16, 24, 32];
export const ROLL_STEP = 0.25;
const near = (a, b) => Math.abs(a - b) < 1e-9;
/** The radius steps of a spec: rStep (½ by default) up to rMax (8). */
export const circleRange = (m) => ({ step: m.rStep || 0.5, max: m.rMax || 8 });
/** A number as the object writes it: tenths, a dot for the decimal point. */
export const circNum = (v) => String(Math.round(v * 10) / 10);

/** The controls a task shows: the radius and the roll, or the number of sectors (and the radius, when it can change). */
export const circleControls = (m) => (m.show === 'area' ? (m.radius ? ['r', 'n'] : ['n']) : ['r', 't']);
/** One press of a control (dir −1 or 1): the steppers, the keys and the tests all move the object through here. */
export function circleStep(m, v, key, dir) {
  const { step, max } = circleRange(m);
  if (key === 'r') return { ...v, r: Math.min(max, Math.max(step, Math.round((v.r + dir * step) / step) * step)) };
  if (key === 't') return { ...v, t: Math.min(1, Math.max(0, Math.round(((v.t ?? 0) + dir * ROLL_STEP) * 4) / 4)) };
  if (key === 'n') { const i = Math.max(0, SECTORS.indexOf(v.n)); return { ...v, n: SECTORS[Math.min(SECTORS.length - 1, Math.max(0, i + dir))] }; }
  return v;
}

/** Is a state right for its answer? */
export function circleCorrect(m, a, u) {
  if (!u || typeof u !== 'object' || !a) return false;
  const { step, max } = circleRange(m);
  if (!(typeof u.r === 'number' && u.r >= step - 1e-9 && u.r <= max + 1e-9)) return false;
  switch (a.mode) {
    case 'r': return near(u.r, a.r);
    case 'unrolled': return near(u.t ?? 0, 1);
    case 'sectors': return SECTORS.includes(u.n) && u.n >= a.min;
    default: return false;
  }
}
/** A state that answers: the radius asked, rolled to the end, the fewest sectors that are enough. */
export function circleSolution(it) {
  const a = it.answer; const s = it.manip.start;
  if (a.mode === 'r') return { ...s, r: a.r };
  if (a.mode === 'unrolled') return { ...s, t: 1 };
  if (a.mode === 'sectors') return { ...s, n: SECTORS.find((n) => n >= a.min) };
  return null;
}
/** A near miss: half a step past the radius (half a step short at rMax), half rolled, four sectors. */
export function circleWrong(it) {
  const a = it.answer; const s = it.manip.start; const { step, max } = circleRange(it.manip);
  if (a.mode === 'r') return { ...s, r: a.r + step <= max + 1e-9 ? a.r + step : a.r - step };
  if (a.mode === 'unrolled') return { ...s, t: 0.5 };
  if (a.mode === 'sectors') return { ...s, n: 4 };
  return null;
}

const ROLLED = { 0: 'לא מגולגל', 0.25: 'מגולגל רבע סיבוב', 0.5: 'מגולגל חצי סיבוב', 0.75: 'מגולגל שלושה רבעים מסיבוב', 1: 'מגולגל עד הסוף' };
/** A state in words: "עיגול ברדיוס 5, מגולגל עד הסוף", "עיגול ברדיוס 5, חתוך ל־32 פרוסות". */
export function circleWords(m, u) {
  const r = `עיגול ברדיוס ${circNum(u.r)}`;
  if (m.show === 'area') return `${r}, חתוך ל־${u.n} פרוסות`;
  return `${r}, ${ROLLED[u.t ?? 0] || `מגולגל ${Math.round((u.t ?? 0) * 100)}% מסיבוב`}`;
}
/** The object's state, or its answer, in words. */
function circleText(it, u) {
  const m = it.manip;
  if (u.mode === 'r') return `רדיוס ${circNum(u.r)}`;
  if (u.mode === 'unrolled') return 'העיגול מגולגל סיבוב שלם';
  if (u.mode === 'sectors') return `לפחות ${SECTORS.find((n) => n >= u.min)} פרוסות`;
  return circleWords(m, u);
}
/** The setup in words, for the tutor and the teacher. */
function circlePlain(it) {
  const m = it.manip; const { step, max } = circleRange(m);
  if (m.show === 'area') return `[עיגול ברדיוס ${circNum(m.start.r)} חתוך לפרוסות (${SECTORS.join(', ')}), והפרוסות מסודרות לסירוגין למעלה ולמטה לצורה שבסיסה חצי ההיקף וגובהה הרדיוס]`;
  return `[עיגול שמשנים את הרדיוס שלו (מ־${circNum(step)} עד ${circNum(max)}, בצעדים של ${circNum(step)}) ומגלגלים אותו סיבוב אחד על קו שמסומנים עליו קוטר אחד, שניים, שלושה וארבעה]`;
}

registerKind('circle', {
  correct: (it, u) => circleCorrect(it.manip, it.answer, u),
  text: circleText,
  plain: circlePlain,
  solution: circleSolution,
  wrong: circleWrong,
});
