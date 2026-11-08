// The interactive maths object for an exercise with form 'manip'. The lesson holds its value;
// content/manip.js checks it. Every object can be dragged, tapped, used with arrow keys or with step buttons.
// Under it מדי describes what the student just did (never whether it is right: that is what "בדיקה" is for).
import NumberLine from './NumberLine.jsx';
import PlotPoint from './PlotPoint.jsx';
import LineBuilder from './LineBuilder.jsx';
import AngleTurner from './AngleTurner.jsx';
import PythSquares from './PythSquares.jsx';
import DataBars from './DataBars.jsx';
import Mascot from '../Mascot.jsx';
import { minus } from './core.jsx';

const KINDS = { numberline: NumberLine, plot: PlotPoint, line: LineBuilder, angle: AngleTurner, squares: PythSquares, bars: DataBars };

// A number inside Hebrew text keeps its minus sign on the left.
const N = ({ v }) => <bdi dir="ltr">{minus(v)}</bdi>;
const steps = (n, one, many) => (Math.abs(n) === 1 ? one : <><N v={Math.abs(n)} /> {many}</>);

/** What מדי says about the object as it is now. */
function coach(it, v, touched) {
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': {
      if (!touched) return 'גררו את הסמן על הציר, ואני אראה לכם את הקפיצה.';
      const j = v - m.from;
      if (!j) return 'הסמן בנקודת ההתחלה.';
      return <>מ־<N v={m.from} /> קפצתם {steps(j, 'צעד אחד', 'צעדים')} {j > 0 ? 'ימינה. ימינה מוסיפים.' : 'שמאלה. שמאלה מחסירים.'}</>;
    }
    case 'plot': {
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
      if (!touched) return 'סובבו את הקרן. שתי הזוויות יחד יוצרות קו ישר.';
      return <>הזווית הימנית עכשיו <bdi dir="ltr">{v}°</bdi>. כמה נשאר לשמאלית עד קו ישר?</>;
    case 'squares': {
      if (!touched) return 'שנו את הניצבים ושימו לב לשטחים.';
      const sum = v.a * v.a + v.b * v.b; const target = it.answer.c * it.answer.c;
      return sum === target ? 'שני הריבועים הקטנים יחד שווים בדיוק ליעד.' : `הריבוע על היתר ${sum < target ? 'קטן' : 'גדול'} מהיעד. הוא תמיד שווה לשני הקטנים יחד.`;
    }
    case 'bars': {
      if (!touched) return 'גררו את העמודה האחרונה למעלה או למטה.';
      const n = m.values.length + 1;
      return <>כל שינוי של 1 בעמודה מזיז את הממוצע ב־<bdi dir="ltr">{1 / n}</bdi>.</>;
    }
    default: return null;
  }
}

export default function Manip({ item, value, onChange, locked, reveal, good, touched, mood, hint }) {
  const C = KINDS[item.manip.kind];
  if (!C) return null;
  return (
    <>
      <C m={item.manip} value={value} onChange={onChange} locked={locked} reveal={reveal} good={good} answer={item.answer} hint={hint && !locked} />
      <div className="manip-coach">
        <Mascot mood={mood} size={52} className="coach-mascot" />
        <p className="coach-say">{coach(item, value, touched)}</p>
      </div>
    </>
  );
}
