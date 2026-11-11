// The interactive maths object for an exercise with form 'manip'. The lesson holds its value;
// content/manip.js checks it. Every object can be dragged, tapped, used with arrow keys or with step buttons.
// Under it מדי describes what the student just did (never whether it is right: that is what "בדיקה" is for).
// In a check or the placement test (`test`), nothing on screen tells the student the target is reached: the objects
// hide their live readouts of the result, and מדי says nothing. Teaching and practice keep them.
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
import { triangleAngles } from '@/content/manip.js';
import { minus, partsTex } from './core.jsx';
import { Tex } from '../MathText.jsx';

export const KINDS = {
  numberline: NumberLine, plot: PlotPoint, line: LineBuilder, angle: AngleTurner, squares: PythSquares, bars: DataBars, pins: NumberPins, triangle: TriangleDrag,
  balance: Balance, tiles: Tiles, area: AreaModel, ray: Ray, fbar: FracBar, dline: DoubleLine, graph: GraphDraw,
};

// A number inside Hebrew text keeps its minus sign on the left.
const N = ({ v }) => <bdi dir="ltr">{minus(v)}</bdi>;
const steps = (n, one, many) => (Math.abs(n) === 1 ? one : <><N v={Math.abs(n)} /> {many}</>);

/** What מדי says about the object as it is now. */
function coach(it, v, touched) {
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
    default: return null;
  }
}

export default function Manip({ item, value, onChange, locked, reveal, good, touched, mood, hint, test = false }) {
  const C = KINDS[item.manip.kind];
  if (!C) return null;
  return (
    <>
      <C m={item.manip} value={value} onChange={onChange} locked={locked} reveal={reveal} good={good} answer={item.answer} hint={hint && !locked} test={test && !reveal && !good} />
      {!test && (
        <div className="manip-coach">
          <p className="coach-say">{coach(item, value, touched)}</p>
        </div>
      )}
    </>
  );
}
