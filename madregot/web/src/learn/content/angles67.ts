// Angles, grade 7, the classroom lane's two stairs after the five (finish/specs/classroom.md): the angle bisector
// (angles:6, CLASSROOM-10), as the class's printed worksheet asks it, and the sum of the angles of a quadrilateral
// (angles:7, CLASSROOM-12), as exercise 189 writes it: "סכום זוויות במרובע שווה 360°". The same picture as the rest of the
// topic: a bisector halves an angle into two equal parts; a diagonal cuts a quadrilateral into two triangles, 180° each.
//
// The exercises and the diagnostic models share one source (content/angles67.js). The drawings are geo figures from
// named points, drawn to size; learn/figures.test.ts checks each against its text, and learn/content.test.ts checks
// that a ray named as a bisector is not an arm of the angle it halves and halves it on the drawing.
import type { DiagModel, StairContent, GeoFig } from '../types';
import { fan, quad, twoQuads } from './geo';
// @ts-ignore: plain JS
import { drawBisAny, bisAnswer, bisBugs, bisFig, bisText, bisHint, bisSolution, drawQuadAny, quadAnswer, quadBugs, quadFig, quadText, quadHint, quadSolution } from '@/content/angles67.js';

const asked = { text: '?', target: true };

// ---------------------------------------------------------------- stair 6: the angle bisector

type Bis = { k: 'w' | 'h' | 't' | 'l'; h?: number; w?: number; a?: number; b?: number };
const bis = (id: string) => (p: Bis) => (bisBugs(p) as Record<string, number | null | undefined>)[id] ?? null;
/** The worksheet's questions: the whole from a half, a half from the whole, two bisectors in a fan, a bisector on a line. */
const bisModel: DiagModel<Bis> = {
  params: (rnd) => drawBisAny(rnd),
  text: (p) => bisText(p),
  fig: (p) => bisFig(p),
  answer: (p) => bisAnswer(p),
  bugs: {
    // a half taken for the whole: the given half (w), or a + b, the two given parts once each (t)
    'part-for-whole': bis('part-for-whole'),
    // the whole angle answered for its half: the given whole (h), or ∢BOC = 180° − a itself (l)
    'no-half': bis('no-half'),
    // halved instead of doubled (w: h : 2), or doubled instead of halved (h: 2w)
    'half-double-swap': bis('half-double-swap'),
    // a full turn instead of the straight line AC (l: (360° − a) : 2)
    'sum-360': bis('sum-360'),
  },
  solution: (p) => bisSolution(p),
  hint: (p) => bisHint(p),
  unit: 'מעלות',
};

/** A ray OC halving ∢AOB of `w` degrees, opening upwards; `marks` on AOC, COB and the whole AOB. */
const halved = (w: number, marks: Record<string, Record<string, unknown>>): GeoFig => fan({ A: 90 - w / 2, C: 90, B: 90 + w / 2 }, marks);
/** A, O, C on a line, OB at 180° − a, and OD halving ∢BOC. */
const onLineBis = (a: number, marks: Record<string, Record<string, unknown>>): GeoFig => fan({ C: 0, D: (180 - a) / 2, B: 180 - a, A: 180 }, marks);

const stair6: StairContent = {
  skill: 'angles:6', topic: 'angles', level: 6, title: 'חוצה זווית',
  objectives: [
    'לדעת מהו חוצה זווית: קרן שמחלקת זווית לשתי זוויות שוות.',
    'למצוא זווית שלמה מהחצי שלה, וחצי מהזווית השלמה.',
    'לפתור שאלה עם שני חוצי זווית, ועם חוצה זווית ליד קו ישר.',
    'לבדוק בחישוב, ולא לפי המראה, אם קרן היא חוצה זווית.',
  ],
  idea: 'חוצה זווית הוא קרן שיוצאת מהקודקוד ומחלקת את הזווית לשתי זוויות שוות. כל אחת היא חצי מהזווית כולה, והזווית כולה היא פעמיים כל אחת.',
  why: [
    'שתי הזוויות שחוצה הזווית יוצר שוות, ויחד הן הזווית כולה. שני חלקים שווים שיחד הם השלם: כל אחד הוא חצי ממנו.',
    'לכן כשידוע חצי, כופלים ב־$2$, וכשידועה הזווית כולה, מחלקים ב־$2$. התשובה גדלה או קטנה, ולפי זה בודקים שלא התבלבלנו.',
  ],
  alt: [
    'מקפלים דף שמצוירת עליו זווית, כך ששתי הצלעות שלה נופלות זו על זו. קו הקיפול הוא חוצה הזווית: שני הצדדים שלו מכסים זה את זה בדיוק.',
    'בשעון, בשעה $2$ בדיוק, בין המחוגים יש $60^\\circ$. המספר $1$ נמצא באמצע ביניהם: קרן מהמרכז אל ה־$1$ חוצה את הזווית, $30^\\circ$ לכל צד.',
  ],
  discover: [
    { kind: 'say', fig: halved(110, { AOC: { n: 2 }, COB: { n: 2 } }), mood: 'thinking',
      text: 'קרן שיוצאת מהקודקוד של זווית ומחלקת אותה לשתי זוויות שוות נקראת חוצה זווית. בשרטוט $OC$ חוצה את $\\sphericalangle AOB$: הקשתות הכפולות מסמנות ש־$\\sphericalangle AOC = \\sphericalangle COB$.' },
    { kind: 'explore', text: 'כאן $\\sphericalangle AOB = 110^\\circ$. סובבו את הקרן $OC$ עד שתחצה את הזווית: עד ש־$\\sphericalangle AOC$ ו־$\\sphericalangle COB$ יהיו שוות.',
      manip: { kind: 'angle', whole: 110, start: 30 }, answer: 55,
      hint: 'שתי הזוויות יחד הן תמיד $110^\\circ$. כשהן שוות, כל אחת היא חצי מ־$110^\\circ$.',
      success: 'עכשיו שתי הזוויות $55^\\circ$: $OC$ חוצה את $\\sphericalangle AOB$, ו־$55^\\circ$ הוא בדיוק חצי מ־$110^\\circ$.' },
    { kind: 'predict', fig: halved(68, { AOC: { text: '34°', n: 2 }, COB: { n: 2 }, AOB: asked }),
      text: '$OC$ חוצה את $\\sphericalangle AOB$, ו־$\\sphericalangle AOC = 34^\\circ$. מה גודל $\\sphericalangle AOB$?',
      choices: ['$68^\\circ$', '$34^\\circ$', '$17^\\circ$'], answer: 0,
      why: '$OC$ מחלקת את $\\sphericalangle AOB$ לשתי זוויות של $34^\\circ$: $\\sphericalangle AOB = 2 \\cdot 34^\\circ = 68^\\circ$.',
      wrongWhy: { 1: '$34^\\circ$ היא רק $\\sphericalangle AOC$, אחד החצאים. הזווית כולה גדולה פי $2$.', 2: '$34^\\circ$ היא כבר החצי. מהחצי אל הזווית כולה כופלים ב־$2$, לא מחלקים.' } },
    { kind: 'rule', fig: halved(110, { AOC: { n: 2 }, COB: { n: 2 }, AOB: {} }),
      text: 'הכלל: $OC$ חוצה את $\\sphericalangle AOB$ $\\iff$ שתי הזוויות שהיא יוצרת שוות. כל אחת מהן היא חצי מהזווית כולה:',
      display: '\\sphericalangle AOC = \\sphericalangle COB = \\tfrac{1}{2}\\sphericalangle AOB',
      why: 'שתי זוויות שוות שיחד הן $\\sphericalangle AOB$: כל אחת חצי ממנה. ולהפך: אם $\\sphericalangle AOC = \\sphericalangle COB$, אז $OC$ חוצה את הזווית.' },
    { kind: 'predict', fig: onLineBis(76, { AOB: { text: '76°' }, BOD: { n: 2 }, DOC: { n: 2, ...asked } }),
      text: 'הנקודות $A$, $O$ ו־$C$ על ישר אחד, $\\sphericalangle AOB = 76^\\circ$, ו־$OD$ חוצה את $\\sphericalangle BOC$. מה גודל $\\sphericalangle DOC$?',
      choices: ['$52^\\circ$', '$104^\\circ$', '$38^\\circ$'], answer: 0,
      why: '$\\sphericalangle BOC$ צמודה ל־$76^\\circ$: $180^\\circ - 76^\\circ = 104^\\circ$. $OD$ חוצה אותה: $104^\\circ : 2 = 52^\\circ$.',
      wrongWhy: { 1: '$104^\\circ$ היא $\\sphericalangle BOC$ כולה. $OD$ חוצה אותה, ו־$\\sphericalangle DOC$ היא רק חצי ממנה.', 2: '$38^\\circ$ הוא חצי מ־$76^\\circ$, אבל $OD$ לא חוצה את $\\sphericalangle AOB$. היא חוצה את הזווית שלידה, $\\sphericalangle BOC$.' } },
    // the worksheet's "האם … הוא חוצה זווית? הסבירו": OC looks like the middle, and the numbers say no
    { kind: 'predict', fig: fan({ A: 26, B: 66, C: 108, D: 154 }, { AOD: { text: '128°' }, AOB: { text: '40°' }, COD: { text: '46°' } }),
      text: '$\\sphericalangle AOD = 128^\\circ$, $\\sphericalangle AOB = 40^\\circ$ ו־$\\sphericalangle COD = 46^\\circ$. בשרטוט $OC$ נראית באמצע $\\sphericalangle BOD$. האם היא חוצה אותה?',
      choices: ['כן, היא באמצע השרטוט', 'לא: $\\sphericalangle BOC = 42^\\circ$, ו־$\\sphericalangle COD = 46^\\circ$'], answer: 1,
      why: '$\\sphericalangle BOD = 128^\\circ - 40^\\circ = 88^\\circ$, ולכן $\\sphericalangle BOC = 88^\\circ - 46^\\circ = 42^\\circ$. הזוויות לא שוות, ולכן $OC$ לא חוצה את $\\sphericalangle BOD$. בודקים בחישוב, לא לפי המראה.',
      wrongWhy: { 0: 'הבדל של $4^\\circ$ כמעט לא רואים בשרטוט. החישוב נותן $\\sphericalangle BOC = 42^\\circ$, ו־$\\sphericalangle COD = 46^\\circ$.' } },
  ],
  examples: [
    // the worksheet's question: two bisectors in a fan of five rays
    { problem: 'הקרניים $OA$, $OB$, $OD$, $OE$ ו־$OC$ יוצאות מהנקודה $O$ בסדר הזה. $OB$ חוצה את $\\sphericalangle AOD$, ו־$OE$ חוצה את $\\sphericalangle DOC$. $\\sphericalangle AOB = 41^\\circ$ ו־$\\sphericalangle DOE = 27^\\circ$. מה גודל $\\sphericalangle AOC$?',
      fig: bisFig({ k: 't', a: 41, b: 27 }), answer: 136, check: '2 * 41 + 2 * 27',
      steps: [
        { action: '$OB$ חוצה את $\\sphericalangle AOD$, ולכן שני החלקים שלה שווים.', why: 'חוצה זווית מחלק אותה לשתי זוויות שוות.', result: '\\sphericalangle BOD = \\sphericalangle AOB = 41^\\circ' },
        { action: '$OE$ חוצה את $\\sphericalangle DOC$, ולכן גם שני החלקים שלה שווים.', why: 'אותו כלל, בזווית השנייה.', result: '\\sphericalangle EOC = \\sphericalangle DOE = 27^\\circ' },
        { action: 'מחברים את ארבעת החלקים של $\\sphericalangle AOC$.', why: 'ארבע הזוויות זו ליד זו ממלאות את $\\sphericalangle AOC$.', result: '\\sphericalangle AOC = 41^\\circ + 41^\\circ + 27^\\circ + 27^\\circ = 136^\\circ', value: '41 + 41 + 27 + 27' },
        { action: 'בודקים בדרך אחרת: $\\sphericalangle AOD$ ועוד $\\sphericalangle DOC$.', why: 'כל אחת מהן היא פעמיים החצי שלה.', result: '2 \\cdot 41^\\circ + 2 \\cdot 27^\\circ = 82^\\circ + 54^\\circ = 136^\\circ', calc: { expr: '2 * 41 + 2 * 27', value: 136 } },
      ] },
    { problem: 'הנקודות $A$, $O$ ו־$C$ על ישר אחד. $OD$ חוצה את $\\sphericalangle BOC$, ו־$\\sphericalangle AOB = 58^\\circ$. מה גודל $\\sphericalangle DOC$?',
      fig: bisFig({ k: 'l', a: 58 }), answer: 61, check: '(180 - 58) / 2',
      steps: [
        { action: '$\\sphericalangle BOC$ צמודה ל־$\\sphericalangle AOB$: יחד הן הקו הישר $AC$.', why: 'זוויות צמודות משלימות זו את זו ל־$180^\\circ$.', result: '\\sphericalangle BOC = 180^\\circ - 58^\\circ = 122^\\circ', calc: { expr: '180 - 58', value: 122 } },
        { action: '$OD$ חוצה את $\\sphericalangle BOC$: מחלקים ב־$2$.', why: 'חוצה זווית מחלק אותה לשתי זוויות שוות.', result: '\\sphericalangle DOC = 122^\\circ : 2 = 61^\\circ', value: '122 / 2' },
        { action: 'בודקים: שלוש הזוויות על הישר יחד.', why: 'על קו ישר הן ממלאות $180^\\circ$.', result: '58^\\circ + 61^\\circ + 61^\\circ = 180^\\circ', calc: { expr: '58 + 61 + 61', value: 180 } },
      ] },
  ],
  together: [
    { problem: '$OC$ חוצה את $\\sphericalangle AOB$, ו־$\\sphericalangle BOC = 37^\\circ$. נמצא יחד את $\\sphericalangle AOB$.',
      fig: halved(74, { AOC: { n: 2 }, COB: { text: '37°', n: 2 }, AOB: asked }),
      steps: [
        { prompt: 'מה ידוע על $\\sphericalangle AOC$?', choices: [
          { text: 'היא שווה ל־$\\sphericalangle BOC$: $37^\\circ$', ok: true, feedback: 'נכון: חוצה זווית מחלק אותה לשתי זוויות שוות.' },
          { text: 'היא $180^\\circ - 37^\\circ$', ok: false, feedback: '$OA$ ו־$OB$ לא על ישר אחד. אין כאן זוויות צמודות, יש שני חצאים שווים.' },
          { text: 'אי אפשר לדעת', ok: false, feedback: 'אפשר: $OC$ חוצה את הזווית, ולכן שני החלקים שלה שווים.' },
        ], hints: ['מה עושה חוצה זווית?', 'הוא מחלק את הזווית לשתי זוויות שוות.'], done: '$\\sphericalangle AOC = \\sphericalangle BOC = 37^\\circ$' },
        { prompt: 'איך מוצאים את $\\sphericalangle AOB$?', choices: [
          { text: '$2 \\cdot 37^\\circ$', ok: true, feedback: 'נכון: שני חצאים של $37^\\circ$.' },
          { text: '$37^\\circ : 2$', ok: false, feedback: '$37^\\circ$ כבר החצי. הזווית כולה גדולה ממנו, לא קטנה.' },
          { text: '$37^\\circ$', ok: false, feedback: 'זה רק חצי מהזווית. $\\sphericalangle AOB$ היא שני החצאים יחד.' },
        ], hints: ['מכמה חצאים בנויה $\\sphericalangle AOB$?', 'משני חצאים של $37^\\circ$.'], done: '$\\sphericalangle AOB = 2 \\cdot 37^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות $\\sphericalangle AOB$?', answer: 74, check: '2 * 37', hints: ['$37 + 37$.', '$2 \\cdot 37 = 74$.'] } },
    { problem: '$OC$ חוצה את $\\sphericalangle AOB$, ו־$\\sphericalangle AOB = 128^\\circ$. נמצא יחד את $\\sphericalangle BOC$.',
      fig: halved(128, { AOB: { text: '128°' }, AOC: { n: 2 }, COB: { n: 2, ...asked } }),
      steps: [
        { prompt: 'מה ידוע על $\\sphericalangle BOC$?', choices: [
          { text: 'היא חצי מ־$\\sphericalangle AOB$', ok: true, feedback: 'נכון: $OC$ מחלקת את $128^\\circ$ לשתי זוויות שוות.' },
          { text: 'היא שווה ל־$\\sphericalangle AOB$', ok: false, feedback: '$\\sphericalangle BOC$ היא רק החלק שבין $OC$ ל־$OB$, לא הזווית כולה.' },
          { text: 'היא פעמיים $\\sphericalangle AOB$', ok: false, feedback: 'חלק של זווית קטן ממנה. כאן הוא בדיוק חצי.' },
        ], hints: ['לכמה חלקים $OC$ מחלקת את $\\sphericalangle AOB$?', 'לשני חלקים שווים.'], done: '$\\sphericalangle BOC = 128^\\circ : 2$' },
      ],
      final: { prompt: 'כמה מעלות $\\sphericalangle BOC$?', answer: 64, check: '128 / 2', hints: ['$128 : 2$.', 'חצי מ־$120$ הוא $60$, וחצי מ־$8$ הוא $4$.'] } },
  ],
  diag: bisModel,
  misconceptions: [
    // CLASSROOM-11's id, the same error: a part of an angle taken for the whole (here the half for the whole angle)
    { id: 'part-for-whole', title: 'לקחו את החצי במקום הזווית כולה',
      cause: 'המספר שבשאלה הוא של אחד החצאים, וקל לכתוב אותו כתשובה. אבל הזווית כולה בנויה משני חצאים, והיא גדולה פי $2$ מכל אחד.',
      explain: [
        'הזווית כולה היא שני החצאים יחד: חצי ועוד חצי.',
        'עם שני חוצי זווית, $\\sphericalangle AOC$ בנויה מארבעה חלקים: כל חלק נתון מופיע בה פעמיים.',
      ],
      remedy: [
        { kind: 'explore', text: 'כאן $\\sphericalangle AOB = 80^\\circ$. סובבו את הקרן $OC$ עד שתחצה אותה, והסתכלו על שתי הזוויות.',
          manip: { kind: 'angle', whole: 80, start: 25 }, answer: 40,
          hint: 'שתי הזוויות יחד הן $80^\\circ$. עצרו כשהן שוות.', success: 'כל חצי $40^\\circ$, והזווית כולה $80^\\circ$: פי $2$ מהחצי.' },
        { kind: 'predict', fig: halved(80, { AOC: { text: '40°', n: 2 }, COB: { n: 2 }, AOB: asked }),
          text: '$OC$ חוצה את $\\sphericalangle AOB$, ו־$\\sphericalangle AOC = 40^\\circ$. כמה זוויות של $40^\\circ$ יש בתוך $\\sphericalangle AOB$?',
          choices: ['שתיים: $\\sphericalangle AOB = 80^\\circ$', 'אחת: $\\sphericalangle AOB = 40^\\circ$'], answer: 0,
          why: 'הקשתות הכפולות מסמנות שתי זוויות שוות. יחד הן $40^\\circ + 40^\\circ = 80^\\circ$.' },
      ] },
    { id: 'no-half', title: 'לקחו את כל הזווית במקום חצי ממנה',
      cause: 'את הזווית שחוצה הזווית מחלק כבר יודעים, או מחשבים אותה בדרך, וקל לעצור שם. אבל השאלה שואלת על אחד החצאים.',
      explain: [
        'חוצה זווית מחלק את הזווית לשתיים: כל חלק הוא חצי ממנה.',
        'ליד קו ישר: קודם $180^\\circ$ פחות הזווית הנתונה, ואחר כך עוד צעד, חילוק ב־$2$.',
      ],
      remedy: [
        { kind: 'explore', text: 'כאן $\\sphericalangle AOB = 130^\\circ$. סובבו את הקרן $OC$ עד שתחצה אותה.',
          manip: { kind: 'angle', whole: 130, start: 30 }, answer: 65,
          hint: 'עצרו כששתי הזוויות שוות. יחד הן $130^\\circ$.', success: 'כל חצי $65^\\circ$: חצי מ־$130^\\circ$, ולא $130^\\circ$.' },
        { kind: 'predict', fig: onLineBis(40, { AOB: { text: '40°' }, BOD: { n: 2 }, DOC: { n: 2, ...asked } }),
          text: 'הנקודות $A$, $O$ ו־$C$ על ישר אחד, $\\sphericalangle AOB = 40^\\circ$, ו־$OD$ חוצה את $\\sphericalangle BOC$. מה גודל $\\sphericalangle DOC$?',
          choices: ['$70^\\circ$', '$140^\\circ$'], answer: 0,
          why: '$\\sphericalangle BOC = 180^\\circ - 40^\\circ = 140^\\circ$, ו־$\\sphericalangle DOC$ היא חצי ממנה: $70^\\circ$.',
          wrongWhy: { 1: '$140^\\circ$ היא $\\sphericalangle BOC$ כולה. $\\sphericalangle DOC$ היא רק החצי שלה.' } },
      ] },
    { id: 'half-double-swap', title: 'כפלו ב־$2$ במקום לחלק ב־$2$, או להפך',
      cause: 'בשאלות על חוצה זווית תמיד יש $2$, וקל לבחור את הפעולה ההפוכה. מה שמכריע הוא מה ידוע: החצי, או הזווית כולה?',
      explain: [
        'ידוע החצי, ומחפשים את הזווית כולה: כופלים ב־$2$. התשובה גדולה מהמספר הנתון.',
        'ידועה הזווית כולה, ומחפשים חצי: מחלקים ב־$2$. התשובה קטנה מהמספר הנתון.',
      ],
      remedy: [
        { kind: 'predict', fig: halved(96, { AOB: { text: '96°' }, AOC: { n: 2 }, COB: { n: 2, ...asked } }),
          text: '$OC$ חוצה את $\\sphericalangle AOB$, ו־$\\sphericalangle AOB = 96^\\circ$. האם $\\sphericalangle BOC$ גדולה מ־$96^\\circ$ או קטנה ממנה?',
          choices: ['קטנה: היא חצי, $48^\\circ$', 'גדולה: $192^\\circ$'], answer: 0,
          why: '$\\sphericalangle BOC$ היא חלק של $\\sphericalangle AOB$, ולכן קטנה ממנה: $96^\\circ : 2 = 48^\\circ$.' },
        { kind: 'predict', fig: halved(56, { AOC: { text: '28°', n: 2 }, COB: { n: 2 }, AOB: asked }),
          text: '$OC$ חוצה את $\\sphericalangle AOB$, ו־$\\sphericalangle AOC = 28^\\circ$. מה גודל $\\sphericalangle AOB$?',
          choices: ['$56^\\circ$', '$14^\\circ$'], answer: 0,
          why: '$\\sphericalangle AOC$ היא חצי, ו־$\\sphericalangle AOB$ היא הזווית כולה: גדולה פי $2$, $56^\\circ$.',
          wrongWhy: { 1: '$14^\\circ$ קטן מ־$28^\\circ$, אבל הזווית כולה גדולה מכל חלק שלה.' } },
      ] },
    { id: 'sum-360', title: 'השלימו ל־$360^\\circ$ במקום ל־$180^\\circ$',
      cause: 'הקרניים שיוצאות מ־$O$ מזכירות סיבוב שלם. אבל $A$, $O$ ו־$C$ על ישר אחד, והזוויות שמעליו הן רק חצי סיבוב.',
      explain: [
        'הזוויות מעל הישר $AC$ ממלאות קו ישר: $180^\\circ$.',
        'לכן $\\sphericalangle BOC = 180^\\circ - \\sphericalangle AOB$, ורק אחר כך מחלקים ב־$2$.',
      ],
      remedy: [
        { kind: 'predict', fig: onLineBis(50, { AOB: { text: '50°' }, BOD: { n: 2 }, DOC: { n: 2 } }),
          text: 'הנקודות $A$, $O$ ו־$C$ על ישר אחד, ו־$\\sphericalangle AOB = 50^\\circ$. כמה מעלות יש ב־$\\sphericalangle BOC$?',
          choices: ['$130^\\circ$', '$310^\\circ$'], answer: 0,
          why: '$\\sphericalangle AOB$ ו־$\\sphericalangle BOC$ יחד ממלאות את הקו הישר: $180^\\circ - 50^\\circ = 130^\\circ$. החצי שלה, $65^\\circ$.',
          wrongWhy: { 1: '$310^\\circ$ יוצא מסיבוב שלם. הזוויות מעל קו ישר הן רק $180^\\circ$.' } },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 7: the sum of the angles of a quadrilateral

type Quad = { k: 0 | 1 | 2; q: number; s?: number; j?: number; given: number[]; g: [number, number, number, number] };
const qb = (p: Quad) => quadBugs(p) as Record<string, number | null>;
/** Three angles given, a right angle and two, or two marked equal angles and two given. */
const quadModel: DiagModel<Quad> = {
  params: (rnd) => drawQuadAny(rnd) as Quad,
  text: (p) => quadText(p),
  fig: (p) => quadFig(p),
  answer: (p) => quadAnswer(p),
  bugs: {
    // one known angle left out of the 360°: the first given (three given), the right angle (a right angle and two)
    'quad-missed': (p) => (p.k === 2 ? null : qb(p)['quad-missed#0']),
    // two equal angles: their share, 360° − a − b, not halved
    'forgot-half': (p) => qb(p)['forgot-half'] ?? null,
    // two equal angles with 180° as in a triangle: (180° − a − b) : 2, when that is an angle at all
    'wrong-total': (p) => qb(p)['wrong-total'] ?? null,
  },
  solution: (p) => quadSolution(p),
  hint: (p) => quadHint(p),
  unit: 'מעלות',
};

const Q0 = { k: 0 as const, q: 3, given: [75, 110, 95], g: [75, 110, 95, 80] as [number, number, number, number] };
const Q2 = { k: 2 as const, q: 2, j: 3, given: [100, 70], g: [100, 70, 95, 95] as [number, number, number, number] };
const Q1 = { k: 1 as const, q: 3, s: 1, given: [115, 70], g: [115, 90, 70, 85] as [number, number, number, number] };

const stair7: StairContent = {
  skill: 'angles:7', topic: 'angles', level: 7, title: 'סכום זוויות במרובע',
  objectives: [
    'לדעת שסכום הזוויות בכל מרובע הוא $360^\\circ$, ולראות למה: אלכסון מחלק אותו לשני משולשים.',
    'למצוא זווית רביעית משלוש זוויות נתונות, גם כשאחת מהן ישרה.',
    'למצוא שתי זוויות שוות כשידועות שתי האחרות.',
  ],
  idea: 'אלכסון מחלק כל מרובע לשני משולשים. בכל משולש $180^\\circ$, ושני המשולשים יחד ממלאים בדיוק את ארבע הפינות של המרובע: $180^\\circ + 180^\\circ = 360^\\circ$.',
  why: [
    'מותחים את האלכסון $AC$. הוא מחלק את המרובע $ABCD$ לשני משולשים, $ABC$ ו־$ACD$.',
    'הזוויות של שני המשולשים יחד הן בדיוק הזוויות של המרובע: ב־$A$ וב־$C$ האלכסון רק מחלק כל זווית לשני חלקים. לכן הסכום $180^\\circ + 180^\\circ = 360^\\circ$.',
  ],
  alt: [
    'במלבן ארבע זוויות ישרות: $4 \\cdot 90^\\circ = 360^\\circ$. כשמעקמים את המלבן, זווית אחת גדלה ואחרת קטנה באותה מידה, והסכום נשאר $360^\\circ$.',
    'קורעים את ארבע הפינות של מרובע מנייר ומצמידים אותן סביב נקודה אחת: הן ממלאות סיבוב שלם, $360^\\circ$.',
  ],
  discover: [
    { kind: 'say', fig: quad([80, 105, 75, 100], {}, { diag: 'AC' }), mood: 'thinking',
      text: 'במרובע $ABCD$ מותחים אלכסון: הקטע $AC$, בין שני קודקודים שאינם שכנים. אלכסון מחלק מרובע לשני משולשים, $ABC$ ו־$ACD$.' },
    { kind: 'predict', fig: quad([80, 105, 75, 100], { A: {}, B: { n: 2 }, C: {}, D: { n: 3 } }, { diag: 'AC' }),
      text: 'במרובע $ABCD$ האלכסון $AC$ יצר שני משולשים. בכל משולש סכום הזוויות $180^\\circ$. כמה מעלות יש בשני המשולשים יחד?',
      choices: ['$360^\\circ$', '$180^\\circ$', '$540^\\circ$'], answer: 0,
      why: '$180^\\circ + 180^\\circ = 360^\\circ$. והזוויות של שני המשולשים הן בדיוק ארבע הזוויות של המרובע.',
      wrongWhy: { 1: '$180^\\circ$ הוא משולש אחד. האלכסון יצר שניים.', 2: '$540^\\circ$ הם שלושה משולשים. אלכסון אחד מחלק מרובע לשניים בלבד.' } },
    { kind: 'rule', fig: quad([80, 105, 75, 100], { A: {}, B: { n: 2 }, C: {}, D: { n: 3 } }),
      text: 'הכלל: סכום זוויות במרובע שווה $360^\\circ$.', display: '\\sphericalangle A + \\sphericalangle B + \\sphericalangle C + \\sphericalangle D = 360^\\circ',
      why: 'אלכסון מחלק את המרובע לשני משולשים, ו־$180^\\circ + 180^\\circ = 360^\\circ$. לכן זווית חסרה היא $360^\\circ$ פחות שלוש האחרות.' },
    // in place of dragging a vertex (no four-point object): two quadrilaterals side by side
    { kind: 'predict', fig: twoQuads([90, 90, 90, 90], [60, 130, 75, 95]),
      text: 'שני מרובעים: מלבן, ומרובע עקום מאוד. באיזה מהם סכום הזוויות גדול יותר?',
      choices: ['במלבן', 'במרובע העקום', 'הסכום שווה בשניהם'], answer: 2,
      why: 'בכל מרובע אלכסון יוצר שני משולשים, ולכן בשניהם $360^\\circ$. במרובע העקום יש זוויות גדולות יותר וקטנות יותר, והן מאזנות זו את זו.',
      wrongWhy: { 0: 'במלבן $4 \\cdot 90^\\circ = 360^\\circ$, אבל גם במרובע העקום יש שני משולשים: $360^\\circ$.', 1: 'זווית גדולה במרובע העקום באה עם זווית קטנה. הסכום נשאר $360^\\circ$.' } },
    { kind: 'predict', fig: quad([90, 120, 70, 80], { A: { right: true }, B: { text: '120°' }, C: { text: '70°' }, D: asked }),
      text: 'במרובע $ABCD$ הזווית $A$ ישרה, $\\sphericalangle B = 120^\\circ$ ו־$\\sphericalangle C = 70^\\circ$. מה גודל $\\sphericalangle D$?',
      choices: ['$80^\\circ$', '$170^\\circ$'], answer: 0,
      why: 'גם הזווית הישרה היא אחת מארבע הזוויות: $360^\\circ - 90^\\circ - 120^\\circ - 70^\\circ = 80^\\circ$.',
      wrongWhy: { 1: '$170^\\circ$ יוצא כששוכחים את הזווית הישרה. היא $90^\\circ$, גם אם לא כתוב לידה מספר.' } },
    // the notebook's ex. 189 with new numbers: the angles with x, solved, and the found angles written on the figure
    { kind: 'say', fig: quad([72, 129, 123, 36], { A: { text: '72°' }, B: { text: '129°' }, C: { text: '123°' }, D: { text: '36°' } }), mood: 'happy',
      text: 'גם כשהזוויות כתובות בביטויים: במרובע $ABCD$, $\\sphericalangle A = 2x$, $\\sphericalangle B = 4x - 15^\\circ$, $\\sphericalangle C = 3x + 15^\\circ$ ו־$\\sphericalangle D = x$. יחד $360^\\circ$, ואחרי כינוס משפחות $10x = 360^\\circ$, ולכן $x = 36^\\circ$. בשרטוט כתובות הזוויות שמצאנו: $72^\\circ$, $129^\\circ$, $123^\\circ$ ו־$36^\\circ$. שאלות כאלה תתרגלו במשוואות, במדרגה "בעיות מילוליות".' },
  ],
  examples: [
    { problem: 'במרובע $ABCD$: $\\sphericalangle A = 75^\\circ$, $\\sphericalangle B = 110^\\circ$ ו־$\\sphericalangle C = 95^\\circ$. מה גודל $\\sphericalangle D$?',
      fig: quadFig(Q0), answer: 80, check: '360 - 75 - 110 - 95',
      steps: [
        { action: 'כותבים מה ידוע על ארבע הזוויות.', why: 'סכום זוויות במרובע שווה $360^\\circ$.', result: '75^\\circ + 110^\\circ + 95^\\circ + \\sphericalangle D = 360^\\circ' },
        { action: 'מחברים את שלוש הזוויות הידועות.', why: 'כך יודעים כמה מתוך $360^\\circ$ כבר תפוס.', result: '75^\\circ + 110^\\circ + 95^\\circ = 280^\\circ', calc: { expr: '75 + 110 + 95', value: 280 } },
        { action: 'מורידים את התפוס מ־$360^\\circ$.', why: '$\\sphericalangle D$ היא מה שנשאר.', result: '\\sphericalangle D = 360^\\circ - 280^\\circ = 80^\\circ', value: '360 - 280' },
        { action: 'בודקים, וכותבים את $80^\\circ$ על השרטוט.', why: 'ארבע הזוויות יחד צריכות לתת $360^\\circ$.', result: '75^\\circ + 110^\\circ + 95^\\circ + 80^\\circ = 360^\\circ', calc: { expr: '75 + 110 + 95 + 80', value: 360 }, fig: quadFig(Q0, 80) },
      ] },
    { problem: 'במרובע $ABCD$: $\\sphericalangle A = 100^\\circ$ ו־$\\sphericalangle B = 70^\\circ$. שתי הזוויות המסומנות שוות: $\\sphericalangle C = \\sphericalangle D$. מה גודל $\\sphericalangle C$?',
      fig: quadFig(Q2), answer: 95, check: '(360 - 100 - 70) / 2',
      steps: [
        { action: 'מורידים מ־$360^\\circ$ את שתי הזוויות הידועות.', why: 'מה שנשאר שייך ל־$\\sphericalangle C$ ול־$\\sphericalangle D$ יחד.', result: '\\sphericalangle C + \\sphericalangle D = 360^\\circ - 100^\\circ - 70^\\circ = 190^\\circ', calc: { expr: '360 - 100 - 70', value: 190 } },
        { action: 'שתי הזוויות שוות: מחלקים ב־$2$.', why: 'שתי זוויות שוות שיחד הן $190^\\circ$.', result: '\\sphericalangle C = 190^\\circ : 2 = 95^\\circ', value: '190 / 2' },
        { action: 'בודקים, וכותבים $95^\\circ$ על שתי הזוויות בשרטוט.', why: 'ארבע הזוויות יחד צריכות לתת $360^\\circ$.', result: '100^\\circ + 70^\\circ + 95^\\circ + 95^\\circ = 360^\\circ', calc: { expr: '100 + 70 + 95 + 95', value: 360 }, fig: quadFig(Q2, 95) },
      ] },
  ],
  together: [
    { problem: 'במרובע $ABCD$ הזווית $B$ ישרה, $\\sphericalangle A = 115^\\circ$ ו־$\\sphericalangle C = 70^\\circ$. נמצא יחד את $\\sphericalangle D$.',
      fig: quadFig(Q1),
      steps: [
        { prompt: 'כמה זוויות במרובע כבר ידועות?', choices: [
          { text: 'שלוש: $115^\\circ$, $70^\\circ$ והזווית הישרה, $90^\\circ$', ok: true, feedback: 'נכון: הזווית הישרה היא $90^\\circ$, גם אם לא כתוב לידה מספר.' },
          { text: 'שתיים: $115^\\circ$ ו־$70^\\circ$', ok: false, feedback: 'גם הזווית ב־$B$ ידועה: הריבוע הקטן מסמן זווית ישרה, $90^\\circ$.' },
        ], hints: ['מה מסמן הריבוע הקטן ב־$B$?', 'זווית ישרה: $90^\\circ$.'], done: 'ידועות $115^\\circ$, $90^\\circ$ ו־$70^\\circ$.' },
        { prompt: 'איזה חישוב נותן את $\\sphericalangle D$?', choices: [
          { text: '$360^\\circ - 115^\\circ - 90^\\circ - 70^\\circ$', ok: true, feedback: 'נכון: מה שנשאר מ־$360^\\circ$ אחרי שלוש הזוויות הידועות.' },
          { text: '$360^\\circ - 115^\\circ - 70^\\circ$', ok: false, feedback: 'שכחתם את הזווית הישרה. גם היא לוקחת חלק מ־$360^\\circ$.' },
          { text: '$180^\\circ - 115^\\circ - 70^\\circ$', ok: false, feedback: '$180^\\circ$ הוא סכום הזוויות במשולש. במרובע $360^\\circ$.' },
        ], hints: ['כמה מעלות בכל מרובע?', '$360^\\circ$, פחות שלוש הזוויות הידועות.'], done: '$\\sphericalangle D = 360^\\circ - 115^\\circ - 90^\\circ - 70^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות $\\sphericalangle D$?', answer: 85, check: '360 - 115 - 90 - 70', hints: ['$115 + 90 + 70 = 275$.', '$360 - 275$.'] } },
  ],
  diag: quadModel,
  misconceptions: [
    { id: 'quad-missed', title: 'הורידו מ־$360^\\circ$ רק חלק מהזוויות הידועות (גם הישרה נחשבת)',
      cause: 'כשזווית מסומנת רק בריבוע קטן, או כשיש הרבה מספרים, קל לשכוח אחת מהזוויות הידועות.',
      explain: [
        'ב־$360^\\circ$ יש ארבע זוויות. כדי למצוא אחת, מורידים את שלוש האחרות, את כולן.',
        'זווית ישרה היא $90^\\circ$ גם בלי מספר לידה: הריבוע הקטן אומר את זה.',
      ],
      remedy: [
        { kind: 'predict', fig: quad([105, 90, 80, 85], { A: { text: '105°' }, B: { right: true }, C: { text: '80°' }, D: asked }),
          text: 'במרובע $ABCD$ הזווית $B$ ישרה, $\\sphericalangle A = 105^\\circ$ ו־$\\sphericalangle C = 80^\\circ$. מישהו ענה $\\sphericalangle D = 175^\\circ$. מה הוא שכח?',
          choices: ['את הזווית הישרה, $90^\\circ$: הנכון $85^\\circ$', 'שום דבר'], answer: 0,
          why: '$360^\\circ - 105^\\circ - 80^\\circ = 175^\\circ$ בלי הזווית הישרה. איתה: $175^\\circ - 90^\\circ = 85^\\circ$.' },
        { kind: 'predict', fig: quad([80, 95, 110, 75], { A: { text: '80°' }, B: { text: '95°' }, C: { text: '110°' }, D: asked }),
          text: 'במרובע $ABCD$: $\\sphericalangle A = 80^\\circ$, $\\sphericalangle B = 95^\\circ$ ו־$\\sphericalangle C = 110^\\circ$. מה גודל $\\sphericalangle D$?',
          choices: ['$75^\\circ$', '$155^\\circ$'], answer: 0,
          why: 'מורידים את שלוש הזוויות: $360^\\circ - 80^\\circ - 95^\\circ - 110^\\circ = 75^\\circ$.',
          wrongWhy: { 1: '$155^\\circ$ יוצא כשמורידים רק את $95^\\circ$ ואת $110^\\circ$. גם $80^\\circ$ לוקחת חלק מ־$360^\\circ$.' } },
      ] },
    { id: 'forgot-half', title: 'שכחו לחלק לשתי הזוויות השוות',
      cause: 'אחרי $360^\\circ$ פחות הזוויות הידועות מתקבל הסכום של שתי הזוויות השוות יחד, וקל לעצור שם.',
      explain: [
        'מה שנשאר מ־$360^\\circ$ שייך לשתי הזוויות השוות יחד.',
        'הן שוות, ולכן כל אחת היא חצי. בדיקה: ארבע הזוויות יחד צריכות לתת $360^\\circ$.',
      ],
      remedy: [
        { kind: 'predict', fig: quad([110, 80, 85, 85], { A: { text: '110°' }, B: { text: '80°' }, C: { n: 2, ...asked }, D: { n: 2 } }),
          text: 'במרובע $ABCD$: $\\sphericalangle A = 110^\\circ$, $\\sphericalangle B = 80^\\circ$, ו־$\\sphericalangle C = \\sphericalangle D$. מה גודל $\\sphericalangle C$?',
          choices: ['$85^\\circ$', '$170^\\circ$'], answer: 0,
          why: '$360^\\circ - 110^\\circ - 80^\\circ = 170^\\circ$ לשתיהן יחד, ו־$85^\\circ$ לכל אחת. בדיקה: $110 + 80 + 85 + 85 = 360$.',
          wrongWhy: { 1: 'אילו כל אחת הייתה $170^\\circ$, שתיהן יחד היו $340^\\circ$, והמרובע כולו $530^\\circ$.' } },
      ] },
    { id: 'wrong-total', title: 'השלימו ל־$180^\\circ$, כמו במשולש, במקום ל־$360^\\circ$',
      cause: 'סכום הזוויות במשולש, $180^\\circ$, מוכר מהמדרגה של המשולש. אבל במרובע ארבע זוויות, ואלכסון מחלק אותו לשני משולשים.',
      explain: [
        'במרובע $180^\\circ + 180^\\circ = 360^\\circ$, כי אלכסון יוצר בו שני משולשים.',
        'סימן אזהרה: אם יוצאת זווית קטנה מאוד, או בכלל מספר שלילי, כנראה השתמשתם ב־$180^\\circ$.',
      ],
      remedy: [
        { kind: 'predict', fig: quad([80, 105, 75, 100], {}, { diag: 'AC' }),
          text: 'האלכסון $AC$ מחלק את המרובע $ABCD$. כמה משולשים נוצרו, וכמה מעלות בזוויות של כולם יחד?',
          choices: ['שני משולשים: $360^\\circ$', 'משולש אחד: $180^\\circ$'], answer: 0,
          why: 'נוצרו $ABC$ ו־$ACD$, ובכל אחד $180^\\circ$. יחד $360^\\circ$: סכום הזוויות של המרובע.' },
      ] },
  ],
};

export const ANGLES67: StairContent[] = [stair6, stair7];
