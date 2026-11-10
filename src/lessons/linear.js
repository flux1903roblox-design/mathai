import LinePlayground, { onLine } from '@/components/learn/LinePlayground';
import { choice, numberQ } from './steps';

const line = ({ title, text, start, fixed = [], targets, showTriangle, goal, solved, miss, hint, explain }) => ({
  kind: 'check',
  title,
  text,
  widget: LinePlayground,
  config: { fixed, targets, showTriangle },
  init: start,
  ready: (v) => !!v.touched,
  check: (v) => {
    if (targets) {
      const hit = targets.filter((p) => onLine(v.m, v.b, p));
      if (hit.length === targets.length) return true;
      if (hit.length) return { msg: `הישר כבר עובר דרך $(${hit[0].join(', ')})$ — עכשיו כוון אותו גם לנקודה השנייה.` };
      return { msg: miss || 'הישר עוד לא עובר דרך הנקודות. נסה לשנות את השיפוע ואת נקודת החיתוך.' };
    }
    return goal(v) ? true : { msg: miss };
  },
  solve: (v) => ({ ...v, ...(solved || solveFor(targets)) }),
  hint,
  explain,
});

function solveFor(targets) {
  if (!targets) return {};
  const [[x1, y1], [x2, y2]] = targets;
  const m = (y2 - y1) / (x2 - x1);
  return { m, b: y1 - m * x1 };
}

export default {
  id: 'linear',
  title: 'שיפוע ונקודת חיתוך',
  subtitle: 'מה m ו-b עושים לישר',
  minutes: 6,
  steps: [
    line({
      title: 'הזזה למעלה ולמטה',
      text: 'זה הגרף של $y = x + b$. גרור את המחוון $b$ וראה מה קורה לישר.\n\n**המשימה:** גרום לישר לחתוך את ציר ה-$y$ בנקודה $(0, 3)$.',
      start: { m: 1, b: 0 },
      fixed: ['m'],
      goal: (v) => v.b === 3,
      solved: { b: 3 },
      miss: 'הנקודה הטורקיזית היא החיתוך עם ציר ה-$y$ — הבא אותה לגובה 3.',
      hint: 'הנקודה הטורקיזית יושבת תמיד בגובה $b$.',
      explain: '$b$ הוא הגובה שבו הישר חוצה את ציר ה-$y$. שינוי של $b$ **מזיז** את הישר למעלה ולמטה — בלי לשנות את התלילות שלו.',
    }),
    line({
      title: 'השיפוע',
      text: 'עכשיו נשחק עם $m$. המשולש הקטן מראה: כשזזים **צעד אחד ימינה**, בכמה הישר עולה?\n\n**המשימה:** גרום לישר לעלות **2** יחידות על כל צעד ימינה.',
      start: { m: 0.5, b: 0 },
      fixed: ['b'],
      showTriangle: true,
      goal: (v) => v.m === 2,
      solved: { m: 2 },
      miss: 'הסתכל על הקו הסגול במשולש — הוא צריך להיות באורך 2.',
      explain: 'זה השיפוע: $m = 2$ אומר שעל כל צעד ימינה הישר עולה 2. ככל ש-$m$ גדול יותר — הישר **תלול** יותר.',
    }),
    line({
      title: 'שיפוע שלילי',
      text: 'מה יקרה אם $m$ יהיה **שלילי**?\n\n**המשימה:** קבע $m$ כלשהו קטן מאפס, והסתכל לאן הישר הולך.',
      start: { m: 1, b: 1 },
      fixed: ['b'],
      showTriangle: true,
      goal: (v) => v.m < 0,
      solved: { m: -1 },
      miss: 'גרור את $m$ שמאלה, אל מתחת ל-0.',
      explain: 'כש-$m < 0$ הישר **יורד** כשהולכים ימינה. המשולש מראה את זה: צעד ימינה — וירידה למטה.',
    }),
    choice({
      title: 'מי הכי תלול?',
      text: 'איזה מהישרים הבאים הוא **התלול ביותר**?',
      options: ['$y = 0.5x + 4$', '$y = -3x + 1$', '$y = 2x - 5$'],
      answer: 1,
      feedback: {
        0: 'השיפוע $0.5$ קטן — זה ישר די שטוח.',
        2: 'כמעט! אבל יש כאן ישר עם שיפוע גדול יותר — גם אם הוא שלילי.',
      },
      explain: 'התלילות נקבעת לפי **גודל** השיפוע, בלי הסימן: $|-3| = 3$ הוא הגדול ביותר. הסימן רק אומר אם הישר עולה או יורד.',
    }),
    line({
      title: 'פגע בשתי הנקודות',
      text: 'עכשיו שני המחוונים שלך. הזז את $m$ ואת $b$ כך שהישר יעבור דרך **שתי** הנקודות המהבהבות.',
      start: { m: 0, b: 0 },
      targets: [[0, -1], [2, 3]],
      hint: 'הנקודה $(0, -1)$ יושבת על ציר ה-$y$ — מה זה אומר על $b$?',
      explain: 'מ-$(0,-1)$ ל-$(2,3)$: עלייה של 4 על פני 2 צעדים, כלומר $m = 2$. ו-$b = -1$. הישר: $y = 2x - 1$.',
    }),
    line({
      title: 'עוד אחד — הפעם יורד',
      text: 'העבר את הישר דרך שתי הנקודות.',
      start: { m: 1, b: 0 },
      targets: [[-2, 4], [2, 0]],
      hint: 'מ-$(-2, 4)$ ל-$(2, 0)$ הישר יורד. בכמה הוא יורד על כל צעד ימינה?',
      explain: 'ירידה של 4 על פני 4 צעדים: $m = -1$. וכשמציבים $x=2$: $0 = -2 + b$, אז $b = 2$. הישר: $y = -x + 2$.',
    }),
    numberQ({
      title: 'בלי גרף',
      text: 'ישר עובר דרך הנקודות $(1, 3)$ ו-$(3, 7)$. מהו השיפוע שלו?',
      answer: 2,
      prefix: 'm =',
      hint: 'חשב בכמה גדל $y$, וחלק בכמה גדל $x$.',
      feedback: (n) => (n === 0.5 ? 'הפכת את השבר — השינוי ב-$y$ למעלה, השינוי ב-$x$ למטה.' : null),
      explain: '$m = \\dfrac{7 - 3}{3 - 1} = \\dfrac{4}{2} = 2$',
    }),
  ],
};
