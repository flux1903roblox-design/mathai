// The interactive maths object for an exercise with form 'manip'. The lesson holds its value;
// content/manip.js checks it. Every object can be dragged, tapped, used with arrow keys or with step buttons.
// Under it מדי describes what the student just did (never whether it is right: that is what "בדיקה" is for).
// In a check or the placement test (`test`), nothing on screen tells the student the target is reached: the objects
// hide their live readouts of the result, and מדי says nothing. Teaching keeps them. Practice keeps them too, except on
// the first try of an object whose readout shows the quantity the question asks (`firstTry`, readoutLine below): there
// the readout is hidden as in a check, and appears after a miss or the hint (stage 2, MEASURE-1.4; CURRICULUM-11 item 1
// for the grid, the net and the circle). A random experiment (simulate) is not drawn in a check at all: its words stand
// in its place.
import NumberLine from './NumberLine.jsx';
import PlotPoint from './PlotPoint.jsx';
import LineBuilder from './LineBuilder.jsx';
import AngleTurner from './AngleTurner.jsx';
import PythSquares from './PythSquares.jsx';
import DataBars from './DataBars.jsx';
import NumberPins from './NumberPins.jsx';
import TriangleDrag from './TriangleDrag.jsx';
import Balance, { balanceCoach } from './Balance.jsx';
import Tiles, { tilesCoach } from './Tiles.jsx';
import AreaModel, { areaCoach } from './AreaModel.jsx';
import Ray, { rayCoach } from './Ray.jsx';
import FracBar, { fbarCoach } from './FracBar.jsx';
import DoubleLine, { dlineCoach } from './DoubleLine.jsx';
import GraphDraw from './GraphDraw.jsx';
import Simulate, { simCoach } from './Simulate.jsx';
import Chart, { chartCoach } from './Chart.jsx';
import GridShape, { gridCoach } from './GridShape.jsx';
import NetFold, { netCoach } from './NetFold.jsx';
import CircleRoll, { circleCoach } from './CircleRoll.jsx';
import { lazy, Suspense, useState } from 'react';
import { triangleAngles, manipPlain } from '@/content/manip.js';
import { tfStart, tfSlide, tfSame, tfSlideWords } from '@/content/transform.js';
import { proofStart, proofValueOk, proofOrderRight, proofChosen, askedSteps, rightReason } from '@/content/proof.js';
import { THEOREMS } from '@/content/proofs.js';
import { minus, partsTex } from './core.jsx';
import { Tex } from '../MathText.jsx';

// the transform object (GEOM-2) and the proof table (GEOM-3) are loaded when an exercise needs them: the first
// screen's try-out never does
const Transform = lazy(() => import('./Transform.jsx'));
const ProofTable = lazy(() => import('./ProofTable.jsx'));

export const KINDS = {
  numberline: NumberLine, plot: PlotPoint, line: LineBuilder, angle: AngleTurner, squares: PythSquares, bars: DataBars, pins: NumberPins, triangle: TriangleDrag,
  balance: Balance, tiles: Tiles, area: AreaModel, ray: Ray, fbar: FracBar, dline: DoubleLine, graph: GraphDraw, simulate: Simulate, chart: Chart,
  polygon: GridShape, net: NetFold, circle: CircleRoll, transform: Transform, proof: ProofTable,
};

/**
 * The line a practice retry adds when the first try hid the object's readout (screens/Lesson.jsx): what the student
 * can see now. Only an object whose readout shows the quantity the question asks hides it on a first try, so the
 * question is not solved by stepping until two numbers match (ar1b "שטח 12 והיקף 14", so2b's volume, ci1m's
 * circumference): the grid's rectangle (its area and perimeter), the net's build (its volume and surface, its space
 * diagonal squared, or a prism's base and volume) and the circle (its circumference, or its area). null: the object's
 * readout gives nothing away (a fold, a face, a slot, a move, a cut, the apex), and its first try is unchanged.
 * (The older objects' lines, the mean of the bars and the rest, are CURRICULUM-11's.)
 */
export function readoutLine(item) {
  const m = item?.manip;
  if (!m) return null;
  if (m.kind === 'polygon') return m.task === 'rect' ? 'עכשיו רואים גם את השטח ואת ההיקף. נסו שוב.' : null;
  if (m.kind === 'net') {
    if (m.task !== 'build') return null;
    if (m.solid === 'prism') return 'עכשיו רואים גם את שטח הבסיס ואת הנפח. נסו שוב.';
    return item.answer?.d2 != null ? 'עכשיו רואים גם את האלכסון בריבוע. נסו שוב.' : 'עכשיו רואים גם את הנפח ואת שטח הפנים. נסו שוב.';
  }
  if (m.kind === 'circle') return m.show === 'area' ? 'עכשיו רואים גם את השטח. נסו שוב.' : 'עכשיו רואים גם את ההיקף. נסו שוב.';
  return null;
}

// A number inside Hebrew text keeps its minus sign on the left.
const N = ({ v }) => <bdi dir="ltr">{minus(v)}</bdi>;
const steps = (n, one, many) => (Math.abs(n) === 1 ? one : <><N v={Math.abs(n)} /> {many}</>);

/** What מדי says about the transform object: the moves the item has, then what the last move did (GEOM-2.7). */
export function transformCoach(m, v, touched, last) {
  const can = [m.moves?.drag && 'חצים מזיזים', m.moves?.flips?.length && 'שיקוף הופך', m.moves?.turns && 'סיבוב מסובב'].filter(Boolean);
  if (!touched || !last) return `${m.moves?.drag ? 'גררו את העותק, או השתמשו בכפתורים' : 'השתמשו בכפתורים'}: ${can.join(', ')}.`;
  if (last.move === 'refuse') return last.text;
  if (last.move === 'reset') return 'העותק חזר להתחלה.';
  if (last.move === 'flip') return 'העותק הפוך עכשיו, כמו במראה: האותיות רצות בכיוון השני.';
  if (last.move === 'turn') return <>העותק הסתובב סביב <Tex tex="O" />. המרחק של כל קודקוד מ־<Tex tex="O" /> לא השתנה.</>;
  // slides: how far from the start, while the copy is only slid
  const s = tfStart(m); const cur = v || s;
  const dx = cur[0][0] - s[0][0]; const dy = cur[0][1] - s[0][1];
  if (!tfSame(tfSlide(s, dx, dy), cur)) return 'העותק זז. כל הקודקודים זזים יחד, באותו כיוון ובאותו מרחק.';
  if (!dx && !dy) return 'העותק במקום שבו התחלתם.';
  return `מהמקום שבו התחלתם: ${tfSlideWords(dx, dy)}.`;
}

/**
 * What מדי says about the proof table (GEOM-3.6): before a move, what to do (put the rows in order and choose the
 * reasons; with lockOrder only the missing reasons; with only the theorem asked, which theorem); then how many reasons
 * are chosen, and that the order is right when it is (practice only: in a check מדי says nothing).
 */
export function proofCoach(m, v, touched) {
  const asked = askedSteps(m.part);
  if (!touched) {
    if (m.lockOrder) return 'השלימו את הנימוקים החסרים. הסדר כבר נכון.';
    const only = asked.length === 1 && THEOREMS.includes(rightReason(m.part.steps[asked[0]])) ? rightReason(m.part.steps[asked[0]]) : null;
    if (only) return `סדרו את השורות, ובחרו לפי איזה משפט המשולשים ${only === THEOREMS[3] ? 'דומים' : 'חופפים'}.`;
    return 'סדרו את השורות מהנתונים אל המסקנה, ובחרו נימוק לכל שורה.';
  }
  const cur = proofValueOk(m.part, v) ? v : proofStart(m);
  const { k, n } = proofChosen(m, cur);
  const count = n === 1 ? (k ? 'בחרתם נימוק.' : 'עוד לא בחרתם נימוק.') : `בחרתם ${k} מתוך ${n} נימוקים.`;
  return !m.lockOrder && k < n && proofOrderRight(m, cur) ? `${count} הסדר נכון. נשארו הנימוקים.` : count;
}

/** What מדי says about the object as it is now (`last`: what the object said its last move did, for transform). */
function coach(it, v, touched, last) {
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': {
      // a line cut into parts: how many parts from the start, and how big one part is
      if (m.den) {
        const one = <bdi dir="ltr"><Tex tex={partsTex(1, m.den)} /></bdi>;
        if (!touched) return <>כל יחידה מחולקת ל־<N v={m.den} /> חלקים שווים, וכל חלק הוא {one}. גררו את הסמן, וספרו חלקים.</>;
        const k = Math.round((v - m.from) * m.den);
        if (!k) return 'הסמן בנקודת ההתחלה.';
        return <>מ־<N v={m.from} /> זזתם {steps(k, 'חלק אחד', 'חלקים')} {k > 0 ? 'ימינה' : 'שמאלה'}. כל חלק הוא {one}.</>;
      }
      if (!touched) return 'גררו את הסמן על הציר, ואני אראה לכם את הקפיצה.';
      const j = v - m.from;
      if (!j) return 'הסמן בנקודת ההתחלה.';
      return <>מ־<N v={m.from} /> קפצתם {steps(j, 'צעד אחד', 'צעדים')} {j > 0 ? 'ימינה. ימינה מוסיפים.' : 'שמאלה. שמאלה מחסירים.'}</>;
    }
    case 'pins': {
      if (!touched) return 'גררו כל סמן למספר שלו. הכפתורים למטה בוחרים איזה סמן זז.';
      const placed = m.labels.filter((_, i) => v[i] !== m.start[i]).length;
      return placed < m.labels.length ? `הזזתם ${placed} מתוך ${m.labels.length} סמנים. מה שמשמאל קטן יותר.` : 'כל הסמנים על הציר. הקטן ביותר הוא השמאלי.';
    }
    case 'triangle': {
      if (!touched) return 'גררו את C. הזוויות משתנות, והסכום שלהן?';
      const [, , c] = triangleAngles(m, v);
      return <>הזווית C עכשיו <bdi dir="ltr">{Math.round(c)}°</bdi>, והסכום עדיין <bdi dir="ltr">180°</bdi>.</>;
    }
    case 'plot': {
      if (!v && m.shape) return 'הקישו במקום שבו הקודקוד החסר משלים את המלבן.';
      if (!v && m.line) return 'הקישו על הנקודה של הישר שבה x הוא המספר מהשאלה.';
      if (!v && m.lines) return 'הקישו על הנקודה שבה שני הישרים נפגשים.';
      if (!v) return 'הקישו על נקודה ברשת, או גררו אותה.';
      const [x, y] = v;
      if (!x && !y) return 'הנקודה בראשית הצירים.';
      const xs = !x ? 'על ציר y' : <>{steps(x, 'צעד אחד', 'צעדים')} {x > 0 ? 'ימינה' : 'שמאלה'}</>;
      const ys = !y ? 'על ציר x' : <>{steps(y, 'צעד אחד', 'צעדים')} {y > 0 ? 'למעלה' : 'למטה'}</>;
      return <>מראשית הצירים: {xs}, {ys}.</>;
    }
    case 'line': {
      if (!touched) return 'הנקודה על ציר y קובעת את b. הנקודה השנייה קובעת את השיפוע.';
      const rise = !v.m ? 'לא עולה ולא יורד' : <>{v.m > 0 ? 'עולה' : 'יורד'} <N v={Math.abs(v.m)} /></>;
      return <>הישר חותך את ציר y ב־<N v={v.b} />. בכל צעד ימינה הוא {rise}.</>;
    }
    case 'angle':
      // a protractor: build an angle from the 0 on the fixed arm, or turn the protractor onto an arm
      if (m.protractor) return m.mode === 'align' ? 'מרכז מד הזווית כבר על הקודקוד. סובבו עד שקו האפס יונח על שוק.' : 'השוק הקבועה על 0. סופרים מעלות על הסולם שמתחיל ב־0 הזה.';
      // a ray turning inside a fixed angle (CLASSROOM-10): the two parts always make the whole
      if (m.whole) return !touched ? <>סובבו את הקרן <bdi dir="ltr">OC</bdi>. שתי הזוויות יחד הן תמיד <bdi dir="ltr">{m.whole}°</bdi>.</>
        : <>עכשיו <bdi dir="ltr">∢AOC = {v}°</bdi> ו־<bdi dir="ltr">∢COB = {m.whole - v}°</bdi>.</>;
      if (!touched) return 'סובבו את הקרן. שתי הזוויות יחד יוצרות קו ישר.';
      return <>הזווית הימנית עכשיו <bdi dir="ltr">{v}°</bdi>. כמה נשאר לשמאלית עד קו ישר?</>;
    case 'squares': {
      if (!touched) return 'שנו את הניצבים ושימו לב לשטחים.';
      const sum = v.a * v.a + v.b * v.b; const target = it.answer.c * it.answer.c;
      return sum === target ? 'שני הריבועים הקטנים יחד שווים בדיוק ליעד.' : `הריבוע על היתר ${sum < target ? 'קטן' : 'גדול'} מהיעד. הוא תמיד שווה לשני הקטנים יחד.`;
    }
    case 'bars': {
      if (!touched) return 'גררו את העמודה האחרונה למעלה או למטה.';
      if (m.stat === 'median') return 'עמודה גבוהה מאוד מושכת את הממוצע למעלה, אבל החציון כמעט לא זז.';
      const n = m.values.length + 1;
      return <>כל שינוי של 1 בעמודה מזיז את הממוצע ב־<bdi dir="ltr">{1 / n}</bdi>.</>;
    }
    case 'balance': return balanceCoach(m, v, it.answer, touched);
    case 'tiles': return tilesCoach(m, v, touched);
    case 'area': return areaCoach(m, v, touched);
    case 'ray': return rayCoach(m, v, touched);
    case 'fbar': return fbarCoach(m, v, touched);
    case 'dline': return dlineCoach(m, v, touched);
    // a story drawn as a shape: decide each segment first; anything else: each column is one moment, dragged to its height
    case 'graph': return it.answer?.mode === 'shape' ? 'קודם מחליטים בכל קטע: עולה, יורד או נשאר. אחר כך גוררים.' : 'גררו כל נקודה לגובה הנכון. כל עמודה היא רגע אחד.';
    case 'simulate': return simCoach(m, v, it.answer, touched);
    case 'chart': return chartCoach(m, v, touched);
    case 'polygon': return gridCoach(m, v, touched);
    case 'net': return netCoach(m, v, touched);
    case 'circle': return circleCoach(m, v, touched);
    case 'transform': return transformCoach(m, v, touched, last);
    case 'proof': return proofCoach(m, v, touched);
    default: return null;
  }
}

/**
 * `checked`: the last check was wrong and nothing has moved since (the lesson's "עוד לא"): an object that can say where
 * (the proof table outlines the first row out of place, or the first wrong reason) shows it, never in a check.
 */
export default function Manip({ item, value, onChange, locked, reveal, good, touched, mood, hint, test = false, firstTry = false, checked = false }) {
  // an object that says what its last move did (transform: a flip, a turn, a move it refused), for this exercise only
  const [said, setSaid] = useState({ key: null, last: null });
  const C = KINDS[item.manip.kind];
  if (!C) return null;
  // a random experiment is never a check (its items are practice-only): in a check it would be read, not run
  if (test && item.manip.kind === 'simulate') return <p className="manip-plain">{manipPlain(item)}</p>;
  // a check hides the readout of the result; a practice first try hides it too where it shows the quantity asked
  const hide = test || (firstTry && !!readoutLine(item));
  const last = said.key === item.key ? said.last : null;
  return (
    <>
      <Suspense fallback={<div className="manip manip-loading" aria-busy="true" />}>
        <C m={item.manip} value={value} onChange={onChange} locked={locked} reveal={reveal} good={good} answer={item.answer} hint={hint && !locked} test={hide && !reveal && !good}
          checked={checked && !test} onSay={(x) => setSaid({ key: item.key, last: x })} />
      </Suspense>
      {!test && (
        <div className="manip-coach">
          <p className="coach-say">{coach(item, value, touched, last)}</p>
        </div>
      )}
    </>
  );
}
