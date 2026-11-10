import BalanceScale, { isIsolated, balanceHint } from '@/components/learn/BalanceScale';
import { choice, numberQ } from './steps';

const scale = ({ title, text, start, ops, hint, explain }) => ({
  kind: 'check',
  title,
  text,
  widget: BalanceScale,
  config: { ops },
  init: { ...start, hist: [] },
  ready: (v) => v.hist.length > 0,
  check: (v) => (isIsolated(v) ? true : { msg: balanceHint(v) }),
  // "show me": jump straight to the isolated x
  solve: (v) => {
    const x = (start.r1 - start.l1) / (start.lx - start.rx);
    return { ...v, lx: 1, l1: 0, rx: 0, r1: x, hist: [...v.hist, { lx: v.lx, l1: v.l1, rx: v.rx, r1: v.r1 }] };
  },
  hint,
  explain,
});

export default {
  id: 'balance',
  title: 'משוואות על מאזניים',
  subtitle: 'לבודד את x בלי לשבור את האיזון',
  minutes: 5,
  steps: [
    scale({
      title: 'משוואה היא מאזניים',
      text: 'על הכף השמאלית יש קופסה סגורה $x$ ועוד 2 משקולות. מולן — 5 משקולות. המאזניים **מאוזנים**, בדיוק כמו המשוואה $x + 2 = 5$.\n\n**המשימה:** השאר את $x$ לבד על הכף. מותר רק לעשות **אותו דבר לשני הצדדים**.',
      start: { lx: 1, l1: 2, rx: 0, r1: 5 },
      ops: ['sub1'],
      hint: 'לחץ על "$-1$ משני הצדדים" עד שליד ה-$x$ לא נשארות משקולות.',
      explain: 'הורדנו 2 משני הצדדים: $x + 2 - 2 = 5 - 2$, ולכן $x = 3$.',
    }),
    choice({
      title: 'ומה אם נרמה?',
      text: 'נניח שנוריד משקולת **רק** מהכף השמאלית ונשאיר את הימנית כמו שהיא. מה יקרה?',
      options: ['המאזניים יישארו מאוזנים', 'הכף **הימנית** תרד למטה', 'הכף **השמאלית** תרד למטה'],
      answer: 1,
      feedback: {
        0: 'הכפות כבר לא שוקלות אותו דבר — משהו חייב לזוז.',
        2: 'הורדנו משקל מהכף השמאלית, אז היא דווקא נעשתה **קלה** יותר.',
      },
      explain: 'הכף הימנית נשארה כבדה יותר, ולכן היא יורדת. בגלל זה במשוואה תמיד עושים **אותה פעולה בשני האגפים** — כדי לשמור על האיזון.',
    }),
    scale({
      title: 'שתי קופסאות',
      text: 'עכשיו יש **שתי** קופסאות $x$: $2x + 1 = 9$.\n\nקודם הורד את המשקולות שליד ה-$x$-ים, ואז **חלק** את שני הצדדים לשתי קבוצות שוות.',
      start: { lx: 2, l1: 1, rx: 0, r1: 9 },
      ops: ['sub1', 'div'],
      hint: 'אחרי שמורידים 1 משני הצדדים נשאר $2x = 8$. איזו חלוקה תשאיר $x$ אחד?',
      explain: '$2x + 1 = 9 \\;\\Rightarrow\\; 2x = 8 \\;\\Rightarrow\\; x = 4$',
    }),
    scale({
      title: 'x משני הצדדים',
      text: 'לפעמים יש $x$ גם בצד השני: $3x + 2 = x + 12$.\n\nאפשר להוריד גם **קופסת $x$** משני הצדדים — הרי היא שוקלת בדיוק אותו דבר בשניהם.',
      start: { lx: 3, l1: 2, rx: 1, r1: 12 },
      ops: ['sub1', 'subx', 'div'],
      hint: 'התחל ב-"$-x$ משני הצדדים" כדי שכל ה-$x$-ים יהיו בצד אחד.',
      explain: '$3x + 2 = x + 12 \\;\\Rightarrow\\; 2x + 2 = 12 \\;\\Rightarrow\\; 2x = 10 \\;\\Rightarrow\\; x = 5$',
    }),
    numberQ({
      title: 'בלי מאזניים',
      text: 'עכשיו אתה כבר יודע את הטריק. פתור בראש:\n\n$$4x + 3 = 23$$',
      answer: 5,
      prefix: 'x =',
      hint: 'הורד 3 משני האגפים, ואז חלק את שניהם ב-4.',
      feedback: (n) => (n === 20 ? 'זה $4x$ — עוד לא חילקת ב-4.' : n === 6.5 ? 'נראה שחילקת לפני שהורדת את ה-3.' : null),
      explain: '$4x + 3 = 23 \\;\\Rightarrow\\; 4x = 20 \\;\\Rightarrow\\; x = 5$',
    }),
    numberQ({
      title: 'אתגר אחרון',
      text: 'גם כאן יש $x$ בשני הצדדים:\n\n$$5x - 4 = 2x + 8$$',
      answer: 4,
      prefix: 'x =',
      hint: 'הורד $2x$ משני האגפים, ואז הוסף 4 לשניהם.',
      explain: '$5x - 4 = 2x + 8 \\;\\Rightarrow\\; 3x - 4 = 8 \\;\\Rightarrow\\; 3x = 12 \\;\\Rightarrow\\; x = 4$',
    }),
  ],
};
