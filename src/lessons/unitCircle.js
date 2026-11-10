import UnitCircle, { sinOf, cosOf } from '@/components/learn/UnitCircle';
import { choice, numberQ } from './steps';

const circle = ({ title, text, kind = 'check', goal, solved, miss, hint, explain }) => ({
  kind,
  title,
  text,
  widget: UnitCircle,
  config: {},
  init: { deg: 40 },
  ready: (v) => !!v.touched,
  check: goal ? (v) => (goal(v.deg) ? true : { msg: miss(v.deg) }) : undefined,
  solve: solved != null ? (v) => ({ ...v, deg: solved }) : undefined,
  hint,
  explain,
});

export default {
  id: 'unit-circle',
  title: 'מעגל היחידה',
  subtitle: 'מאיפה באים sin ו-cos',
  minutes: 6,
  steps: [
    circle({
      kind: 'explore',
      title: 'סובב את הנקודה',
      text: 'זה מעגל שהרדיוס שלו $1$. גרור את הנקודה סביב המעגל.\n\nהקו **הטורקיז** (האופקי) הוא $\\cos\\theta$, והקו **הוורוד** (האנכי) הוא $\\sin\\theta$.',
    }),
    circle({
      title: 'חצי גובה',
      text: '**המשימה:** מצא זווית שבה $\\sin\\theta = 0.5$ — הקו הוורוד בדיוק בחצי הדרך לפסגה.',
      goal: (d) => Math.abs(sinOf(d) - 0.5) < 1e-6,
      solved: 30,
      miss: (d) => (sinOf(d) > 0.5 ? 'הקו הוורוד ארוך מדי — הנמך את הנקודה.' : 'הקו הוורוד קצר מדי — הגבה את הנקודה.'),
      hint: 'זו זווית חדה, קטנה מ-$45°$.',
      explain: '$\\sin 30° = 0.5$. וגם $\\sin 150° = 0.5$ — יש **שתי** נקודות באותו גובה, משני צידי ציר ה-$y$.',
    }),
    circle({
      title: 'הכי שמאלה',
      text: '**המשימה:** מצא זווית שבה $\\cos\\theta = -1$.',
      goal: (d) => Math.abs(cosOf(d) + 1) < 1e-6,
      solved: 180,
      miss: () => '$\\cos$ הוא המיקום האופקי. איפה הנקודה הכי רחוקה שמאלה?',
      explain: 'ב-$180°$ הנקודה בקצה השמאלי, $(-1, 0)$: $\\cos 180° = -1$ ו-$\\sin 180° = 0$.',
    }),
    choice({
      title: 'רביעים',
      text: 'באיזה רביע **גם** $\\sin\\theta$ **וגם** $\\cos\\theta$ שליליים?',
      options: ['רביע I', 'רביע II', 'רביע III', 'רביע IV'],
      answer: 2,
      feedback: {
        0: 'ברביע I הנקודה למעלה ומימין — שניהם חיוביים.',
        1: 'ברביע II הנקודה למעלה, אז $\\sin$ חיובי.',
        3: 'ברביע IV הנקודה מימין, אז $\\cos$ חיובי.',
      },
      explain: 'ברביע III ($180°$–$270°$) הנקודה **משמאל** ($\\cos < 0$) **ולמטה** ($\\sin < 0$).',
    }),
    choice({
      title: 'פיתגורס מסתתר כאן',
      text: 'הקווים הטורקיז והוורוד והרדיוס יוצרים משולש ישר-זווית. כמה שווה\n\n$$\\sin^2\\theta + \\cos^2\\theta \\;?$$',
      options: ['תמיד $1$', 'תלוי בזווית', 'תמיד $0$'],
      answer: 0,
      feedback: {
        1: 'הניצבים משתנים, אבל היתר — הרדיוס — לא משתנה אף פעם.',
        2: 'סכום של שני ריבועים יכול להיות 0 רק אם שניהם 0. זה לא קורה כאן.',
      },
      explain: 'היתר הוא הרדיוס, $1$. לפי פיתגורס: $\\sin^2\\theta + \\cos^2\\theta = 1^2 = 1$ — **לכל** זווית.',
    }),
    numberQ({
      title: 'תרגום לזווית אחרת',
      text: 'מה ערכו של $\\cos 60°$?',
      answer: 0.5,
      tol: 0.01,
      hint: 'במשולש של $30°$–$60°$–$90°$ הצלע הקצרה היא חצי מהיתר.',
      explain: '$\\cos 60° = 0.5$ — בדיוק כמו $\\sin 30°$. זה לא מקרי: $\\cos\\theta = \\sin(90° - \\theta)$.',
    }),
  ],
};
