// Angles (זוויות), grade 7. One picture runs through the topic: a straight line is half a turn, 180°, and a ray
// that leaves a point on it splits those 180° into two adjacent angles. Each stair finds that picture again:
// vertical angles are two adjacent pairs that share an angle; the triangle's corners, torn off, fill a straight
// line; a parallel line is a slid copy of the crossing; an exterior angle completes the same angle as the two
// remote interior ones.
//
// The angle turner (manip kind 'angle') shows a straight line and a ray: the right angle is read live, the left
// one is the goal (`target`), so the student has to think "together they are 180°" to know where to stop. Its
// answer is the right angle, 180° − target.
import type { DiagModel, StairContent, GeoFig } from '../types';
import { rays, halfTurn, onLine, lineRays, fan, splitTri, crossing, scissors, triangle, apex, similar, torn, triangleSum, twoRights, parallels, isosceles, exterior } from './geo';
import { lineFan, triFromAngles, sail, aFrame } from './geoBC';
import { rint } from '../expr';
// @ts-ignore: plain JS
import { crossBisectFig, parallelTriangleFig, parallelLines } from '@/content/angleItems.js';

/** TeX for a number of degrees. */
const d = (n: number) => `${n}^\\circ`;
/** The angle turner, with the left angle as the goal: the answer (the right angle) is what is left of 180°. */
const turn = (left: number, start = 90, labels?: AngleLabels) => ({ manip: { kind: 'angle' as const, target: left, start, ...(labels ? { labels } : {}) }, answer: 180 - left });
/** The letters on the angle tool (default: the line C–O–A). In a triangle the screen must use the triangle's own
 * letters, or none: corners laid side by side on a line have no letters there. */
type AngleLabels = { left?: string; vertex?: string; right?: string; ray?: string };
const NO_LETTERS: AngleLabels = { left: '', vertex: '', right: '' };
/** The exterior angle at C: the side BC runs left from C and goes on to the right; the ray is the side CA. */
const AT_C: AngleLabels = { left: 'B', vertex: 'C', right: '', ray: 'A' };
/** Triangle ABC with A and B fixed on the x-axis; C is dragged until the angle at C is right. */
const tri = (start: [number, number]) => ({ kind: 'triangle' as const, A: [-5, 0], B: [5, 0], range: 6, start });
/** A whole number of degrees, a multiple of 5 in [5·lo, 5·hi], never a right angle (where every pair looks alike). */
const notRight = (rnd: () => number, lo: number, hi: number) => { let a = 90; while (a === 90) a = 5 * rint(rnd, lo, hi); return a; };

// ---------------------------------------------------------------- stair 1: adjacent angles

type Adj = { k: number; a: number; b: number }; // k 0: one angle given; k 1: two of three angles on a line given
const adjModel: DiagModel<Adj> = {
  params: (rnd) => {
    if (rnd() < 0.7) return { k: 0, a: notRight(rnd, 4, 32), b: 0 };
    let a = 0; let b = 0;
    do { a = 5 * rint(rnd, 4, 20); b = 5 * rint(rnd, 4, 20); } while (a + b > 160);
    return { k: 1, a, b };
  },
  // a check asks the two-step kind only, three angles on a line, drawn so that no printed number, nor 90° minus one,
  // is the answer: "180° minus the given angle" or a copied number never passes it (CURRICULUM-10)
  testParams: (rnd) => {
    for (;;) {
      const a = 5 * rint(rnd, 4, 20); const b = 5 * rint(rnd, 4, 20); const c = 180 - a - b;
      if (a + b <= 160 && a !== 90 && b !== 90 && c !== a && c !== b) return { k: 1, a, b };
    }
  },
  text: (p) => (p.k === 0
    ? `הזוויות $\\sphericalangle AOB$ ו־$\\sphericalangle BOC$ צמודות, ו־$\\sphericalangle AOB = ${d(p.a)}$. מה גודל $\\sphericalangle BOC$?`
    : `$O$ היא נקודה על הישר $AD$. הקרניים $OB$ ו־$OC$ מחלקות את הזווית השטוחה לשלוש זוויות: $\\sphericalangle AOB = ${d(p.a)}$ ו־$\\sphericalangle BOC = ${d(p.b)}$. מה גודל $\\sphericalangle COD$?`),
  answer: (p) => (p.k === 0 ? 180 - p.a : 180 - p.a - p.b),
  bugs: {
    // the two angles were taken to be equal
    'equal-not-supp': (p) => (p.k === 0 ? p.a : null),
    // completed to a right angle instead of a straight one
    'wrong-total': (p) => { const s = p.k === 0 ? p.a : p.a + p.b; return s < 90 ? 90 - s : null; },
    // completed to a full turn
    'sum-360': (p) => (p.k === 0 ? 360 - p.a : 360 - p.a - p.b),
    // three angles on the line: only the neighbouring angle was taken off
    'one-angle': (p) => (p.k === 1 ? 180 - p.b : null),
  },
  solution: (p) => (p.k === 0
    ? ['שתי הזוויות צמודות: יחד הן קו ישר, $180^\\circ$.', `$\\sphericalangle BOC = 180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$`]
    : ['שלוש הזוויות יחד ממלאות את הזווית השטוחה $\\sphericalangle AOD = 180^\\circ$.', `$\\sphericalangle COD = 180^\\circ - ${d(p.a)} - ${d(p.b)} = ${d(180 - p.a - p.b)}$`]),
  hint: (p) => (p.k === 0
    ? 'שתי הזוויות יחד יוצרות קו ישר. כמה מעלות יש בקו ישר, וכמה מהן כבר תפוסות?'
    : 'כל שלוש הזוויות יחד ממלאות את הקו הישר $AD$. מורידים מ־$180^\\circ$ את שתי הזוויות הידועות.'),
  unit: 'מעלות',
};

type AdjStory = { k: number; a: number; b: number }; // k 2: two streets from one point of the road, a and b given
/** Two streets from one point of a straight road (CURRICULUM-10): a and b, never 90°, and the answer neither of them. */
const twoStreets = (rnd: () => number): AdjStory => {
  for (;;) {
    const a = 5 * rint(rnd, 4, 20); const b = 5 * rint(rnd, 4, 20); const c = 180 - a - b;
    if (a + b <= 160 && a !== 90 && b !== 90 && c !== a && c !== b) return { k: 2, a, b };
  }
};
const adjStory: DiagModel<AdjStory> = {
  // the same skill on objects: a laptop opened on a table, a street that leaves a straight road, two streets
  params: (rnd) => { const r = rnd(); return r < 0.35 ? { k: 0, a: 5 * rint(rnd, 19, 30), b: 0 } : r < 0.7 ? { k: 1, a: notRight(rnd, 5, 31), b: 0 } : twoStreets(rnd); },
  // a check asks the two-step story only (CURRICULUM-10)
  testParams: twoStreets,
  text: (p) => [
    `מחשב נייד פתוח על שולחן. המקלדת שוכבת על השולחן, והמסך פתוח בזווית של $${d(p.a)}$ מהמקלדת. מה הזווית בין המסך לבין השולחן שמאחורי המחשב?`,
    `רחוב ישר יוצא מכביש ישר. בצד אחד של הרחוב, הזווית בינו לבין הכביש היא $${d(p.a)}$. מה הזווית בין הרחוב לכביש בצד השני?`,
    `שני רחובות ישרים יוצאים מאותה נקודה של כביש ישר, לאותו צד שלו. הזווית בין הכביש לרחוב הראשון היא $${d(p.a)}$, והזווית בין שני הרחובות היא $${d(p.b)}$. מה הזווית בין הרחוב השני לבין הכביש, בצד השני?`,
  ][p.k],
  answer: (p) => 180 - p.a - p.b,
  bugs: {
    'equal-not-supp': (p) => (p.k < 2 ? p.a : null),
    'sum-360': (p) => 360 - p.a - p.b,
    'wrong-total': (p) => (p.a + p.b < 90 ? 90 - p.a - p.b : null),
    // two streets: only the angle between the streets, the neighbour of the asked one, taken off
    'one-angle': (p) => (p.k === 2 ? 180 - p.b : null),
  },
  solution: (p) => [
    [
      'המקלדת והשולחן שמאחורי המחשב הם קו ישר אחד, והמסך הוא קרן שיוצאת מהציר: שתי זוויות צמודות.',
      'הכביש הוא קו ישר, והרחוב הוא קרן שיוצאת ממנו: שתי זוויות צמודות.',
      'הכביש הוא קו ישר, ושני הרחובות מחלקים את $180^\\circ$ שלו לשלוש זוויות.',
    ][p.k],
    p.k === 2 ? `$180^\\circ - ${d(p.a)} - ${d(p.b)} = ${d(180 - p.a - p.b)}$` : `$180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$`,
  ],
  hint: (p) => [
    'דמיינו את השולחן כקו ישר שעובר מתחת לציר של המסך. המסך מחלק אותו לשתי זוויות.',
    'הכביש הוא קו ישר. הרחוב מחלק את $180^\\circ$ שלו לשני הצדדים.',
    'הכביש הוא קו ישר: שלוש הזוויות שלאורכו, בצד של הרחובות, הן יחד $180^\\circ$.',
  ][p.k],
  unit: 'מעלות',
};

const stair1: StairContent = {
  skill: 'angles:1', topic: 'angles', level: 1, title: 'זוויות צמודות',
  objectives: [
    'לזהות זוויות צמודות: קרן שיוצאת מנקודה על ישר יוצרת שתיים כאלה.',
    'להבין למה זוויות צמודות משלימות זו את זו ל־$180^\\circ$.',
    'למצוא את הזווית הצמודה לזווית נתונה, וגם זווית חסרה כשעל הישר יש כמה קרניים.',
  ],
  idea: 'קרן שיוצאת מנקודה על ישר מחלקת את הקו הישר, $180^\\circ$, לשתי זוויות צמודות. מה שאחת מקבלת השנייה מפסידה, ולכן יחד הן תמיד $180^\\circ$.',
  why: [
    'קו ישר הוא חצי סיבוב: מי שמסתכל קדימה ומסתובב עד שהוא מסתכל אחורה, הסתובב $180^\\circ$. לזווית כזאת קוראים זווית שטוחה.',
    'הקרן לא מוסיפה מעלות ולא מורידה מעלות. היא רק מחלקת את $180^\\circ$ לשני חלקים.',
    'לכן כשחלק אחד הוא $\\alpha$, החלק השני הוא מה שנשאר: $180^\\circ - \\alpha$.',
  ],
  alt: [
    'חשבו על חצי פיצה. הצלע הישרה שלה היא קו ישר. חתך אחד מהמרכז מחלק את החצי לשתי פרוסות, ושתיהן יחד הן עדיין אותו חצי.',
    'סיבוב שלם הוא $360^\\circ$, וקו ישר הוא חצי סיבוב: $360^\\circ : 2 = 180^\\circ$. זווית ישרה היא רבע סיבוב, $90^\\circ$, ולכן בקו ישר יש בדיוק שתיים כאלה.',
    'הסתכלו על זוגות: $30^\\circ$ ו־$150^\\circ$, $60^\\circ$ ו־$120^\\circ$, $90^\\circ$ ו־$90^\\circ$. כשאחת גדלה ב־$30^\\circ$, השנייה קטנה ב־$30^\\circ$, והסכום נשאר $180^\\circ$.',
  ],
  discover: [
    { kind: 'say', fig: rays(), mood: 'happy', text: 'זווית היא הפתיחה בין שתי קרניים שיוצאות מאותה נקודה, הקודקוד. מודדים אותה במעלות, וסיבוב שלם הוא $360^\\circ$.' },
    { kind: 'predict', fig: halfTurn(), text: 'קו ישר הוא חצי סיבוב: מסתכלים קדימה ומסתובבים עד שמסתכלים אחורה. כמה מעלות יש בקו ישר?',
      choices: ['$90^\\circ$', '$180^\\circ$', '$360^\\circ$'], answer: 1,
      why: 'חצי סיבוב הוא חצי מ־$360^\\circ$, כלומר $180^\\circ$. לזווית כזאת קוראים זווית שטוחה.',
      wrongWhy: { 0: '$90^\\circ$ היא זווית ישרה, הפינה של דף. קו ישר הוא שתי פינות כאלה זו ליד זו.', 2: '$360^\\circ$ הוא סיבוב שלם, עד שחוזרים להסתכל קדימה. קו ישר הוא רק חצי מזה.' } },
    { kind: 'say', fig: onLine(65, { o: 'O', right: {}, left: {} }), text: 'עכשיו נוציא קרן מנקודה $O$ שעל הישר. הקרן מחלקת את הזווית השטוחה לשתי זוויות, אחת מכל צד שלה. לשתי זוויות כאלה קוראים זוויות צמודות.' },
    { kind: 'explore', text: 'סובבו את הקרן כך שהזווית השמאלית תהיה $40^\\circ$. שימו לב מה קורה לזווית הימנית בזמן שאתם מסובבים.', display: '40^\\circ + \\,?\\, = 180^\\circ',
      ...turn(40), hint: 'כשהזווית השמאלית קטנה, הימנית גדלה. יחד הן כל הקו הישר, $180^\\circ$. כמה צריכה להיות הימנית?',
      success: 'השמאלית $40^\\circ$ והימנית $140^\\circ$. יחד: $40^\\circ + 140^\\circ = 180^\\circ$.' },
    { kind: 'predict', fig: onLine(80, { before: 60, right: {}, left: { text: '?', target: true } }), text: 'נסובב את הקרן כך שהזווית הימנית תגדל ב־$20^\\circ$. מה יקרה לשמאלית?',
      choices: ['גם היא תגדל ב־$20^\\circ$', 'היא תקטן ב־$20^\\circ$', 'היא לא תשתנה'], answer: 1,
      why: 'הקרן רק מעבירה מעלות מצד לצד. מה שהימנית מקבלת, השמאלית מפסידה, והסכום נשאר $180^\\circ$.',
      wrongWhy: { 0: 'אז יחד הן יהיו $220^\\circ$, יותר מקו ישר. אבל הקו לא זז.', 2: 'אז יחד הן יהיו $200^\\circ$, יותר מקו ישר. משהו צריך לקטון.' } },
    { kind: 'explore', text: 'עוד אחת: סובבו את הקרן כך שהזווית השמאלית תהיה $115^\\circ$.', display: '115^\\circ + \\,?\\, = 180^\\circ',
      ...turn(115), hint: 'השמאלית גדולה מזווית ישרה, אז הימנית קטנה מזווית ישרה. כמה חסר ל־$115^\\circ$ עד $180^\\circ$?',
      success: '$115^\\circ + 65^\\circ = 180^\\circ$. זווית קהה, וצמודה לה זווית חדה.' },
    { kind: 'predict', fig: onLine(35, { right: { text: '35°' }, left: { text: '?', target: true } }), text: 'בלי לסובב: הזווית הימנית $35^\\circ$. מה הזווית השמאלית?',
      choices: ['$35^\\circ$', '$145^\\circ$', '$55^\\circ$'], answer: 1,
      why: '$180^\\circ - 35^\\circ = 145^\\circ$. זוויות צמודות לא שוות זו לזו: הן משלימות זו את זו ל־$180^\\circ$.',
      wrongWhy: { 0: 'זוויות צמודות שוות רק כששתיהן $90^\\circ$. כאן אחת חדה, ולכן השנייה קהה.', 2: '$55^\\circ$ משלימה ל־$90^\\circ$, לזווית ישרה. זוויות צמודות משלימות ל־$180^\\circ$, לקו ישר.' } },
    { kind: 'rule', fig: onLine(70, { right: { text: 'α' }, left: { text: 'β', n: 2 } }), text: 'הכלל: זוויות צמודות משלימות זו את זו ל־$180^\\circ$.', display: '\\alpha + \\beta = 180^\\circ',
      why: 'שתי הזוויות יחד הן הקו הישר כולו, זווית שטוחה של $180^\\circ$, והקרן רק מחלקת אותה לשניים. לכן הזווית הצמודה ל־$\\alpha$ היא $180^\\circ - \\alpha$.' },
    // CLASSROOM-9: the class's two names, kept apart (its notes write "(או זוויות על קו ישר)" beside the rule)
    { kind: 'rule', fig: lineRays([55, 120], [{ text: '1' }, { text: '2' }, { text: '3' }]),
      text: 'שני שמות. זוויות צמודות הן זוג: קודקוד משותף, צלע משותפת, והצלעות האחרות שלהן יוצרות ישר אחד. שלוש זוויות או יותר זו ליד זו על ישר הן זוויות על קו ישר: יחד הן זווית שטוחה, $180^\\circ$.',
      display: '\\sphericalangle 1 + \\sphericalangle 2 + \\sphericalangle 3 = 180^\\circ',
      why: 'בשרטוט, $\\sphericalangle 1$ ו־$\\sphericalangle 2$ זו ליד זו, אבל הן לא זוג צמודות: הצלעות האחרות שלהן לא יוצרות ישר. שלוש הזוויות יחד ממלאות את הקו הישר, ולכן הסכום שלהן $180^\\circ$.' },
    { kind: 'predict', fig: fan(130, 55, { AOC: { text: '130°' }, AOB: { text: '55°' }, BOC: { text: '?', target: true } }),
      text: '$\\sphericalangle AOB$ ו־$\\sphericalangle BOC$ זו ליד זו. האם יחד הן $180^\\circ$?',
      choices: ['לא: $OA$ ו־$OC$ לא על ישר אחד, ויחד הן $130^\\circ$', 'כן, כי הן זו ליד זו'], answer: 0,
      why: 'יחד הן $\\sphericalangle AOC$, ולא קו ישר. לכן $\\sphericalangle BOC = 130^\\circ - 55^\\circ = 75^\\circ$.',
      wrongWhy: { 1: 'זו ליד זו לא מספיק. שתי זוויות משלימות ל־$180^\\circ$ רק כשהצלעות האחרות שלהן יוצרות ישר אחד, וכאן $OA$ ו־$OC$ פותחות רק $130^\\circ$.' } },
    { kind: 'predict', fig: onLine(90, { right: { text: '?', target: true }, left: { text: '?', target: true } }), text: 'שתי זוויות צמודות שוות זו לזו. מה הגודל של כל אחת?',
      choices: ['$90^\\circ$', '$180^\\circ$', '$45^\\circ$'], answer: 0,
      why: 'שתי זוויות שוות שיחד הן $180^\\circ$: כל אחת $180^\\circ : 2 = 90^\\circ$. הקרן עומדת ישר, מאונכת לישר.',
      wrongWhy: { 1: '$180^\\circ$ הוא שתיהן יחד.', 2: '$45^\\circ$ היה נכון אם שתיהן יחד היו $90^\\circ$. אבל יחד הן קו ישר.' } },
    { kind: 'explore', text: 'עכשיו לבד: הזווית השמאלית צריכה להיות $155^\\circ$. חשבו קודם כמה תהיה הימנית, ורק אז סובבו.', display: '155^\\circ + \\,?\\, = 180^\\circ',
      ...turn(155), hint: 'הימנית היא מה שחסר ל־$155^\\circ$ עד $180^\\circ$: זווית קטנה מאוד.',
      success: '$180^\\circ - 155^\\circ = 25^\\circ$. חישבתם לפני שסובבתם: זה הכלל בפעולה.' },
  ],
  examples: [
    { problem: 'הזוויות $\\sphericalangle AOB$ ו־$\\sphericalangle BOC$ צמודות, ו־$\\sphericalangle AOB = 48^\\circ$. מה גודל $\\sphericalangle BOC$?', display: '\\sphericalangle AOB = 48^\\circ', answer: 132, check: '180 - 48',
      fig: lineFan([48], [{ text: '48°' }, { text: '?', target: true }], { right: 'A', o: 'O', rays: ['B'], left: 'C' }),
      steps: [
        { action: 'מזהים את הזוג: לשתי הזוויות יש צלע משותפת, $OB$, והצלעות האחרות, $OA$ ו־$OC$, הן ישר אחד.', why: 'זה מה שהופך אותן לזוויות צמודות: יחד הן הזווית השטוחה $\\sphericalangle AOC$.', result: '\\sphericalangle AOB + \\sphericalangle BOC = 180^\\circ' },
        { action: 'מורידים את הזווית הידועה מ־$180^\\circ$.', why: 'הזווית החסרה היא מה שנשאר מהקו הישר אחרי $48^\\circ$.', result: '\\sphericalangle BOC = 180^\\circ - 48^\\circ', value: '180 - 48' },
        { action: 'מחשבים: $180 - 50 = 130$, ומוסיפים בחזרה $2$.', why: 'הורדנו $50$ במקום $48$, כלומר $2$ יותר מדי.', result: '\\sphericalangle BOC = 132^\\circ', value: '132', calc: { expr: '180 - 50 + 2', value: 132 } },
        { action: 'בודקים: מחברים את שתי הזוויות.', why: 'אם יוצא $180^\\circ$, הן באמת ממלאות קו ישר. וגם: אחת חדה ואחת קהה, כמו שצריך.', result: '48^\\circ + 132^\\circ = 180^\\circ', calc: { expr: '48 + 132', value: 180 } },
      ] },
    { problem: 'חצי פיצה מונח על צלחת. מהמרכז שלה, שנמצא על הצלע הישרה, חתכו שני חתכים, ונוצרו שלוש פרוסות. הזווית של פרוסה אחת $70^\\circ$, ושל השנייה $45^\\circ$. מה הזווית של הפרוסה השלישית?', answer: 65, check: '180 - 70 - 45',
      fig: lineFan([70, 115], [{ text: '70°' }, { text: '45°' }, { text: '?', target: true }], {}, 'חצי פיצה: הצלע הישרה ושלוש פרוסות מהמרכז'),
      steps: [
        { action: 'מוצאים את הקו הישר: הצלע הישרה של חצי הפיצה.', why: 'שלוש הפרוסות יוצאות מאותה נקודה על הקו הזה, ויחד הן ממלאות את כל החצי: זווית שטוחה.', result: '70^\\circ + 45^\\circ + x = 180^\\circ' },
        { action: 'מורידים מ־$180^\\circ$ את שתי הפרוסות הידועות.', why: 'מה שלא תפוס על ידי שתיהן הוא הפרוסה השלישית.', result: 'x = 180^\\circ - 70^\\circ - 45^\\circ', value: '180 - 70 - 45' },
        { action: 'מחשבים בשני שלבים: קודם $70 + 45 = 115$.', why: 'שתי הפרוסות יחד הן כמו זווית אחת של $115^\\circ$, והשלישית צמודה לה.', result: 'x = 180^\\circ - 115^\\circ = 65^\\circ', value: '180 - 115', calc: { expr: '70 + 45', value: 115 } },
        { action: 'בודקים שהשלוש ממלאות קו ישר.', why: 'סכום של $180^\\circ$ אומר שלא נשאר חור ושאין חפיפה.', result: '70^\\circ + 45^\\circ + 65^\\circ = 180^\\circ', calc: { expr: '70 + 45 + 65', value: 180 } },
      ] },
  ],
  together: [
    { problem: 'הקרן $OB$ יוצאת מהנקודה $O$ שעל הישר $AC$, ו־$\\sphericalangle AOB = 38^\\circ$. נמצא יחד את $\\sphericalangle BOC$.', display: '\\sphericalangle AOB = 38^\\circ',
      fig: lineFan([38], [{ text: '38°' }, { text: '?', target: true }], { right: 'A', o: 'O', rays: ['B'], left: 'C' }),
      steps: [
        { prompt: 'מה ידוע על $\\sphericalangle AOB$ ו־$\\sphericalangle BOC$ יחד?', choices: [
          { text: 'יחד הן $180^\\circ$', ok: true, feedback: 'נכון: הן צמודות, ויחד הן הקו הישר $AC$.' },
          { text: 'הן שוות', ok: false, misc: 'equal-not-supp', feedback: 'זוויות צמודות שוות רק כששתיהן $90^\\circ$. כאן אחת היא $38^\\circ$, חדה, ולכן השנייה קהה.' },
          { text: 'יחד הן $90^\\circ$', ok: false, misc: 'wrong-total', feedback: '$90^\\circ$ היא פינה, זווית ישרה. שתי הזוויות יחד יוצרות קו ישר, לא פינה.' },
        ], hints: ['הצלעות $OA$ ו־$OC$ הן ישר אחד. כמה מעלות יש בישר?', 'ישר הוא זווית שטוחה, $180^\\circ$, והקרן $OB$ מחלקת אותה לשתיים.'], done: '$\\sphericalangle AOB + \\sphericalangle BOC = 180^\\circ$' },
        { prompt: 'איזה חישוב נותן את $\\sphericalangle BOC$?', choices: [
          { text: '$180^\\circ - 38^\\circ$', ok: true, feedback: 'נכון: מה שנשאר מהקו הישר.' },
          { text: '$180^\\circ + 38^\\circ$', ok: false, feedback: 'זה יותר מקו ישר שלם. $\\sphericalangle BOC$ היא רק חלק מהקו, אז מחסירים.' },
          { text: '$90^\\circ - 38^\\circ$', ok: false, misc: 'wrong-total', feedback: 'משלימים לקו ישר, $180^\\circ$, לא לזווית ישרה.' },
        ], hints: ['מה נשאר מהקו הישר אחרי שלקחנו ממנו $38^\\circ$?', 'מהשלם, $180^\\circ$, מורידים את החלק הידוע, $38^\\circ$.'], done: '$\\sphericalangle BOC = 180^\\circ - 38^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות $\\sphericalangle BOC$? כתבו מספר.', answer: 142, check: '180 - 38', hints: ['$180 - 40 = 140$, ו־$38$ קטן מ־$40$.', 'הורדנו $2$ פחות מ־$40$, ולכן התוצאה גדולה מ־$140$ ב־$2$.'] } },
    { problem: 'אתגר: שתי זוויות צמודות, ואחת מהן גדולה מהשנייה ב־$30^\\circ$. מה הגדלים שלהן?',
      fig: lineFan([75], [{ text: '?' }, { text: '? + 30°', target: true }]),
      steps: [
        { prompt: 'כמה הן שתי הזוויות יחד?', choices: [
          { text: '$180^\\circ$', ok: true, feedback: 'נכון: הן צמודות.' },
          { text: '$30^\\circ$', ok: false, feedback: '$30^\\circ$ הוא ההפרש ביניהן: בכמה אחת גדולה מהשנייה. הסכום הוא משהו אחר.' },
          { text: '$360^\\circ$', ok: false, misc: 'sum-360', feedback: 'סיבוב שלם הוא $360^\\circ$. שתי זוויות צמודות ממלאות רק קו ישר.' },
        ], hints: ['הן צמודות. מה הן יוצרות יחד?', 'יחד הן קו ישר: $180^\\circ$.'], done: 'יחד: $180^\\circ$.' },
        { prompt: 'נקצץ מהזווית הגדולה את $30^\\circ$ העודפות. מה יישאר?', choices: [
          { text: 'שתי זוויות שוות, ויחד $150^\\circ$', ok: true, feedback: 'נכון: עכשיו הן באותו גודל, והסכום קטן ב־$30^\\circ$.' },
          { text: 'שתי זוויות שוות, ויחד $180^\\circ$', ok: false, feedback: 'קיצצנו $30^\\circ$, ולכן גם הסכום קטן ב־$30^\\circ$.' },
          { text: 'שתי זוויות שונות, ויחד $150^\\circ$', ok: false, feedback: 'הגדולה הייתה גדולה בדיוק ב־$30^\\circ$. אחרי הקיצוץ הן שוות.' },
        ], hints: ['אחרי הקיצוץ, האם הגדולה עדיין גדולה מהקטנה? ומה קרה לסכום?', 'הן שוות עכשיו, והסכום הוא $180^\\circ - 30^\\circ = 150^\\circ$.'], done: 'שתי זוויות שוות, ויחד $180^\\circ - 30^\\circ = 150^\\circ$.' },
        { prompt: 'אז מה גודל הזווית הקטנה?', choices: [
          { text: '$150^\\circ : 2 = 75^\\circ$', ok: true, feedback: 'נכון: היא חצי מ־$150^\\circ$.' },
          { text: '$180^\\circ : 2 = 90^\\circ$', ok: false, feedback: 'כך היה אילו הזוויות היו שוות מההתחלה. קיצצנו $30^\\circ$, ולכן מחלקים את $150^\\circ$.' },
          { text: '$150^\\circ$', ok: false, feedback: '$150^\\circ$ הן שתיהן יחד, אחרי הקיצוץ. כל אחת היא חצי.' },
        ], hints: ['שתי זוויות שוות, ויחד $150^\\circ$.', 'מחלקים את $150^\\circ$ לשני חלקים שווים.'], done: 'הקטנה: $75^\\circ$.' },
      ],
      final: { prompt: 'ומה גודל הזווית הגדולה?', answer: 105, check: '(180 - 30) / 2 + 30', hints: ['הגדולה גדולה מהקטנה ב־$30^\\circ$.', '$75 + 30$. בדקו: יחד עם $75^\\circ$ צריך לצאת $180^\\circ$.'] } },
  ],
  diag: adjModel,
  transfer: adjStory,
  misconceptions: [
    { id: 'equal-not-supp', title: 'ענו שהזווית הצמודה שווה לזווית הנתונה',
      cause: 'בציור שתי הזוויות עומדות זו ליד זו, ולכן קל לחשוב שהן "אותו דבר". אבל הן שני חלקים של קו ישר אחד, ומה שאחת לוקחת חסר לשנייה.',
      explain: [
        'זוויות צמודות לא שוות זו לזו, חוץ מהמקרה ששתיהן $90^\\circ$. הן מתחלקות בקו הישר.',
        'אם אחת היא $50^\\circ$, השנייה היא מה שנשאר מ־$180^\\circ$: $130^\\circ$.',
        'בדיקה מהירה: אחת חדה (קטנה מ־$90^\\circ$)? אז השנייה קהה (גדולה מ־$90^\\circ$).',
      ],
      remedy: [
        { kind: 'explore', text: 'סובבו את הקרן כך שהזווית השמאלית תהיה $50^\\circ$. האם הימנית יוצאת שווה לה?', ...turn(50),
          hint: 'כשהשמאלית קטנה, הימנית גדלה. יחד הן $180^\\circ$.', success: 'הימנית $130^\\circ$, לא $50^\\circ$. יחד הן $180^\\circ$.' },
        { kind: 'predict', text: 'זווית אחת היא $20^\\circ$, חדה מאוד. הזווית הצמודה לה היא:', choices: ['גם $20^\\circ$', '$160^\\circ$, קהה מאוד'], answer: 1,
          why: 'מה שאחת לא לוקחת מהקו הישר, השנייה לוקחת: $180^\\circ - 20^\\circ = 160^\\circ$.' },
      ] },
    { id: 'wrong-total', title: 'השלימו לסכום הלא נכון (בדרך כלל ל־$90^\\circ$) במקום ל־$180^\\circ$',
      cause: 'בלבול בין שלושה "שלמים": זווית ישרה ($90^\\circ$, פינה של דף), זווית שטוחה ($180^\\circ$, קו ישר) וסיבוב שלם ($360^\\circ$).',
      explain: [
        'זוויות צמודות יוצרות יחד קו ישר: לא פינה ($90^\\circ$), ולא סיבוב שלם ($360^\\circ$).',
        'קו ישר הוא שתי זוויות ישרות זו ליד זו, $90^\\circ + 90^\\circ$, והוא חצי מסיבוב שלם. לכן משלימים ל־$180^\\circ$.',
      ],
      remedy: [
        { kind: 'predict', text: 'כמה זוויות ישרות נכנסות בקו ישר?', choices: ['אחת', 'שתיים', 'ארבע'], answer: 1,
          why: 'קרן שמאונכת לישר יוצרת שתי זוויות ישרות, אחת מכל צד. לכן בקו ישר יש $2 \\cdot 90^\\circ = 180^\\circ$.' },
        { kind: 'explore', text: 'סובבו את הקרן כך שהזווית השמאלית תהיה $30^\\circ$. כמה יוצאת הימנית?', ...turn(30),
          hint: 'הימנית גדולה מ־$90^\\circ$: היא משלימה ל־$180^\\circ$, לא ל־$90^\\circ$.', success: '$30^\\circ + 150^\\circ = 180^\\circ$. לא $60^\\circ$: הקרן יוצאת מקו ישר, לא מפינה.' },
      ] },
    { id: 'sum-360', title: 'השלימו ל־$360^\\circ$ במקום ל־$180^\\circ$',
      cause: 'זכרו ש"סיבוב שלם הוא $360^\\circ$", אבל זוויות צמודות ממלאות רק חצי סיבוב: צד אחד של הישר.',
      explain: [
        '$360^\\circ$ הם כל מה שיש סביב נקודה, משני הצדדים של הישר.',
        'זוויות צמודות נמצאות רק בצד אחד של הישר, ולכן יחד הן חצי: $180^\\circ$.',
        'סימן אזהרה: זווית שיצאה גדולה מ־$180^\\circ$ לא יכולה להיות חלק מקו ישר.',
      ],
      remedy: [
        { kind: 'predict', text: 'הזווית הנתונה $70^\\circ$, ומישהו ענה שהצמודה לה היא $290^\\circ$. מה הבעיה?',
          choices: ['$290^\\circ$ גדולה מקו ישר שלם, אז היא לא יכולה להיות חלק ממנו', 'אין בעיה'], answer: 0,
          why: 'כל זווית צמודה היא חלק מקו ישר, ולכן קטנה מ־$180^\\circ$. הנכון: $180^\\circ - 70^\\circ = 110^\\circ$.' },
        { kind: 'explore', text: 'סובבו את הקרן כך שהזווית השמאלית תהיה $70^\\circ$. שימו לב שהכול קורה מעל הישר.', ...turn(70),
          hint: 'הימנית היא מה שחסר ל־$70^\\circ$ עד קו ישר.', success: '$70^\\circ + 110^\\circ = 180^\\circ$. חצי סיבוב, לא סיבוב שלם.' },
      ] },
    { id: 'one-angle', title: 'הורידו מ־$180^\\circ$ רק זווית אחת, ושכחו זווית נוספת על הישר',
      cause: 'כשעל הישר יש כמה קרניים, הזווית החסרה צמודה לכל הזוויות האחרות יחד, ולא רק לזו שנוגעת בה.',
      explain: [
        'כל הזוויות על אותו צד של הישר ממלאות יחד $180^\\circ$.',
        'לכן מורידים מ־$180^\\circ$ את כל הזוויות הידועות, לא רק את השכנה.',
      ],
      remedy: [
        { kind: 'predict', text: 'על ישר יש שלוש זוויות זו ליד זו: $40^\\circ$, $60^\\circ$, והשלישית חסרה. כמה היא?',
          choices: ['$120^\\circ$', '$80^\\circ$', '$140^\\circ$'], answer: 1,
          why: '$180^\\circ - 40^\\circ - 60^\\circ = 80^\\circ$. בדיקה: $40 + 60 + 80 = 180$.',
          wrongWhy: { 0: '$120^\\circ$ משלימה רק את $60^\\circ$. אבל גם $40^\\circ$ נמצאת על אותו ישר.', 2: '$140^\\circ$ משלימה רק את $40^\\circ$.' } },
        { kind: 'explore', text: 'שתי הזוויות הידועות יחד הן זווית אחת: $40^\\circ + 60^\\circ = 100^\\circ$. סובבו את הקרן כך שהזווית השמאלית תהיה $100^\\circ$.', ...turn(100),
          hint: 'הימנית היא הזווית השלישית: מה שנשאר מ־$180^\\circ$ אחרי $100^\\circ$.', success: 'הימנית $80^\\circ$: זו הזווית השלישית.' },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 2: vertical angles

type Cross = { k: number; a: number }; // k 0: the opposite angle; k 1: a neighbouring angle; k 2: the other three together; k 3: two opposite angles add to a, a neighbour asked
/**
 * Two opposite angles whose sum is given (CURRICULUM-10): each is half of it, and a neighbour is 180° minus that. The sum
 * is a multiple of 10 and not 120° (where the answer would be the sum), 90° or 180° (where two mistakes meet), 170° or
 * 190° (where taking the angle beside as equal is ten off the answer, a slip).
 */
const oppositeSum = (rnd: () => number): Cross => { for (;;) { const a = 10 * rint(rnd, 4, 32); if (![90, 120, 170, 180, 190].includes(a)) return { k: 3, a }; } };
const crossModel: DiagModel<Cross> = {
  params: (rnd) => { const r = rnd(); return r < 0.75 ? { k: r < 0.35 ? 0 : r < 0.65 ? 1 : 2, a: notRight(rnd, 4, 32) } : oppositeSum(rnd); },
  // a check asks the two-step kind only: copying the angle, or 180° or 360° minus it, never passes it (CURRICULUM-10)
  testParams: oppositeSum,
  text: (p) => [
    `שני ישרים נחתכים. אחת הזוויות היא $${d(p.a)}$. מה גודל הזווית שמולה, הקודקודית לה?`,
    `שני ישרים נחתכים. אחת הזוויות היא $${d(p.a)}$. מה גודל זווית שנמצאת לידה?`,
    `שני ישרים נחתכים. אחת מארבע הזוויות היא $${d(p.a)}$. מה הסכום של שלוש הזוויות האחרות?`,
    `שני ישרים נחתכים. שתי זוויות שעומדות זו מול זו הן יחד $${d(p.a)}$. מה גודל כל אחת משתי הזוויות האחרות?`,
  ][p.k],
  answer: (p) => [p.a, 180 - p.a, 360 - p.a, 180 - p.a / 2][p.k],
  bugs: {
    // the opposite angle completed to 180°
    'supp-not-equal': (p) => (p.k === 0 ? 180 - p.a : null),
    // the neighbouring angle taken as equal (to the given angle, or to half the sum of the opposite pair)
    'equal-not-supp': (p) => (p.k === 1 ? p.a : p.k === 3 ? p.a / 2 : null),
    // the four angles taken to make 180°
    'wrong-total': (p) => (p.k === 2 ? 180 - p.a : p.k === 3 && p.a < 180 ? (180 - p.a) / 2 : null),
  },
  solution: (p) => [
    [`הזווית שמולה קודקודית לה, וזוויות קודקודיות שוות: $${d(p.a)}$.`],
    ['זווית שליד הזווית הנתונה צמודה לה: יחד הן $180^\\circ$.', `$180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$`],
    ['ארבע הזוויות הן שני זוגות של זוויות צמודות, ויחד $360^\\circ$.', `$360^\\circ - ${d(p.a)} = ${d(360 - p.a)}$`],
    [`שתי הזוויות שמול זו קודקודיות, ולכן שוות: כל אחת $${d(p.a)} : 2 = ${d(p.a / 2)}$.`, `כל אחת מהזוויות האחרות צמודה לזווית כזאת: $180^\\circ - ${d(p.a / 2)} = ${d(180 - p.a / 2)}$`],
  ][p.k],
  hint: (p) => [
    'הזווית הנתונה והזווית שמולה צמודות שתיהן לאותה זווית שביניהן.',
    'זווית שליד הנתונה חולקת איתה צלע, והצלעות האחרות שלהן הן ישר אחד.',
    'סביב נקודת החיתוך יש סיבוב שלם: $180^\\circ$ מעל אחד הישרים, ועוד $180^\\circ$ מתחתיו.',
    'זוויות שעומדות זו מול זו שוות: כמה כל אחת מהן? והזווית שלידה משלימה אותה ל־$180^\\circ$.',
  ][p.k],
  unit: 'מעלות',
};

const crossStory: DiagModel<Cross> = {
  // scissors, a junction of two straight roads, a folding chair seen from the side
  params: (rnd) => {
    if (rnd() < 0.25) return oppositeSum(rnd);
    const k = rint(rnd, 0, 2);
    if (k === 0) return { k, a: 5 * rint(rnd, 4, 12) };
    if (k === 1) return { k, a: notRight(rnd, 8, 28) };
    return { k, a: notRight(rnd, 10, 20) };
  },
  // a check asks the two-step story only: two opposite corners of a junction add to a (CURRICULUM-10)
  testParams: oppositeSum,
  text: (p) => [
    `מספריים פתוחים. הזווית בין שתי הידיות היא $${d(p.a)}$. מה הזווית בין שני הלהבים?`,
    `שני כבישים ישרים מצטלבים. באחת הפינות של הצומת, הזווית בין הכבישים היא $${d(p.a)}$. מה הזווית בפינה הסמוכה לה?`,
    `כיסא מתקפל: שתי רגליים ישרות מצטלבות בצורת $X$. הזווית בין הרגליים מעל נקודת ההצטלבות היא $${d(p.a)}$. מה הזווית ביניהן מתחתיה, ליד הרצפה?`,
    `שני כבישים ישרים מצטלבים. בשתי פינות של הצומת שעומדות זו מול זו, הזוויות יחד הן $${d(p.a)}$. מה הזווית בכל אחת משתי הפינות האחרות?`,
  ][p.k],
  answer: (p) => [p.a, 180 - p.a, p.a, 180 - p.a / 2][p.k],
  bugs: {
    'supp-not-equal': (p) => (p.k === 0 || p.k === 2 ? 180 - p.a : null),
    'equal-not-supp': (p) => (p.k === 1 ? p.a : p.k === 3 ? p.a / 2 : null),
    // the four corners taken to make 180°: the other two share what is left of 180°
    'wrong-total': (p) => (p.k === 3 && p.a < 180 ? (180 - p.a) / 2 : null),
  },
  solution: (p) => [
    ['כל להב והידית שלו הם מוט ישר אחד. שני מוטות ישרים מצטלבים, והזווית בין הלהבים עומדת מול הזווית בין הידיות.', `זוויות קודקודיות שוות: $${d(p.a)}$.`],
    ['שתי פינות סמוכות בצומת הן זוויות צמודות: יחד $180^\\circ$.', `$180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$`],
    ['שתי הרגליים הן שני ישרים שמצטלבים, והזווית למטה עומדת מול הזווית למעלה.', `זוויות קודקודיות שוות: $${d(p.a)}$.`],
    [`שתי פינות שעומדות זו מול זו הן זוויות קודקודיות, ולכן שוות: כל אחת $${d(p.a)} : 2 = ${d(p.a / 2)}$.`, `פינה סמוכה צמודה לפינה כזאת: $180^\\circ - ${d(p.a / 2)} = ${d(180 - p.a / 2)}$`],
  ][p.k],
  hint: (p) => [
    'מצאו את שני הקווים הישרים. הזווית המבוקשת עומדת מול הזווית הנתונה.',
    'שתי פינות סמוכות בצומת הן זו ליד זו, על אותו כביש ישר.',
    'מצאו את שני הקווים הישרים. הזווית המבוקשת עומדת מול הזווית הנתונה.',
    'פינות שעומדות זו מול זו בצומת שוות. פינה סמוכה משלימה ל־$180^\\circ$.',
  ][p.k],
  unit: 'מעלות',
};

const stair2: StairContent = {
  skill: 'angles:2', topic: 'angles', level: 2, title: 'זוויות קודקודיות',
  objectives: [
    'לזהות זוויות קודקודיות: שתי זוויות שעומדות זו מול זו כששני ישרים נחתכים.',
    'להבין למה זוויות קודקודיות שוות: שתיהן משלימות את אותה זווית ל־$180^\\circ$.',
    'למצוא את כל ארבע הזוויות בחיתוך מזווית אחת נתונה.',
  ],
  idea: 'כששני ישרים נחתכים, הזוויות שעומדות זו מול זו שוות: כל אחת מהן צמודה לאותה זווית שביניהן, ולכן שתיהן שוות ל־$180^\\circ$ פחות אותה זווית.',
  why: [
    'נמספר את ארבע הזוויות סביב נקודת החיתוך לפי הסדר: $1$, $2$, $3$, $4$. זווית $1$ וזווית $2$ צמודות על ישר אחד, ולכן $\\sphericalangle 1 = 180^\\circ - \\sphericalangle 2$.',
    'זווית $3$ וזווית $2$ צמודות על הישר השני, ולכן $\\sphericalangle 3 = 180^\\circ - \\sphericalangle 2$.',
    'שתיהן התקבלו מאותו חישוב על אותה זווית, ולכן $\\sphericalangle 1 = \\sphericalangle 3$. באותו אופן $\\sphericalangle 2 = \\sphericalangle 4$, דרך זווית $1$.',
  ],
  alt: [
    'חשבו על מספריים: כל להב והידית שלו הם מוט ישר אחד. כשפותחים את הלהבים, גם הידיות נפתחות, בדיוק באותה מידה.',
    'סובבו את כל הציור חצי סיבוב סביב נקודת החיתוך. כל ישר נוחת על עצמו, וכל זווית נוחתת בדיוק על הזווית שמולה. לכן הן שוות.',
  ],
  discover: [
    { kind: 'say', fig: crossing(55, [{ text: '1' }, { text: '2', n: 2 }, { text: '3' }, { text: '4', n: 2 }]), mood: 'happy', text: 'שני ישרים שנחתכים יוצרים ארבע זוויות סביב נקודת החיתוך. נמספר אותן לפי הסדר: $1$, $2$, $3$, $4$. זווית $1$ וזווית $3$ עומדות זו מול זו, וכך גם $2$ ו־$4$. לזוגות כאלה קוראים זוויות קודקודיות.' },
    { kind: 'predict', fig: scissors(40), text: 'חשבו על מספריים פתוחים. אם נפתח את הלהבים עוד קצת, מה יקרה לזווית בין הידיות?',
      choices: ['היא תגדל באותה מידה', 'היא תקטן', 'היא לא תשתנה'], answer: 0,
      why: 'כל להב והידית שלו הם מוט ישר אחד. כשמסובבים מוט, שני הקצוות שלו זזים יחד, ולכן הזווית בין הלהבים והזווית בין הידיות גדלות יחד.',
      wrongWhy: { 1: 'להב וידית הם מוט אחד. כשהלהבים נפתחים, גם הידיות מתרחקות.', 2: 'כל ידית מחוברת ללהב שלה. אי אפשר להזיז להב בלי שהידית תזוז איתו.' } },
    { kind: 'say', fig: crossing(50, [{ text: '1' }, { text: '2', n: 2 }, null, null], { ray: true }), text: 'ננסה להבין את זה בעזרת מה שכבר יודעים. ישר אחד, ועוד חצי מהישר השני, הם בדיוק קו וקרן: זוויות צמודות.' },
    { kind: 'explore', text: 'נניח שזווית $2$ היא $130^\\circ$. על המסך, הקו הוא הישר הראשון והקרן היא חצי מהישר השני. סובבו את הקרן כך שהזווית השמאלית, זווית $2$, תהיה $130^\\circ$. הימנית היא זווית $1$.',
      ...turn(130), hint: 'זווית $1$ וזווית $2$ צמודות: יחד $180^\\circ$.', success: 'זווית $1$ היא $180^\\circ - 130^\\circ = 50^\\circ$.' },
    { kind: 'predict', fig: crossing(50, [null, { text: '130°', n: 2 }, { text: '?', target: true }, null], { second: true }), text: 'עכשיו הסתכלו על הישר השני. גם עליו זווית $2$ צמודה לזווית אחרת: לזווית $3$. כמה היא זווית $3$?',
      choices: ['$130^\\circ$', '$50^\\circ$', '$230^\\circ$'], answer: 1,
      why: 'זווית $3$ משלימה את זווית $2$ ל־$180^\\circ$, בדיוק כמו זווית $1$: $180^\\circ - 130^\\circ = 50^\\circ$. לכן $\\sphericalangle 3 = \\sphericalangle 1$.',
      wrongWhy: { 0: '$130^\\circ$ היא זווית $2$ עצמה. זווית $3$ צמודה לה, ולכן משלימה אותה ל־$180^\\circ$.', 2: 'זוויות צמודות יחד הן $180^\\circ$, לא $360^\\circ$.' } },
    { kind: 'explore', text: 'נשנה את החיתוך: עכשיו זווית $2$ היא $65^\\circ$. סובבו את הקרן כך שהזווית השמאלית תהיה $65^\\circ$, וקראו את זווית $1$.',
      ...turn(65), hint: 'זווית $1$ היא מה שחסר ל־$65^\\circ$ עד $180^\\circ$.', success: 'זווית $1$ היא $115^\\circ$, וזווית $3$ גם: שתיהן משלימות את אותה $65^\\circ$ ל־$180^\\circ$.' },
    { kind: 'rule', fig: crossing(55, [{ text: '1' }, { text: '2', n: 2 }, { text: '3' }, { text: '4', n: 2 }]), text: 'הכלל: זוויות קודקודיות שוות זו לזו.', display: '\\sphericalangle 1 = \\sphericalangle 3,\\qquad \\sphericalangle 2 = \\sphericalangle 4',
      why: 'זווית $1$ וזווית $3$ צמודות שתיהן לזווית $2$. כל אחת מהן היא $180^\\circ - \\sphericalangle 2$, ולכן הן שוות. אותו דבר לזוויות $2$ ו־$4$, דרך זווית $1$.' },
    { kind: 'predict', fig: crossing(70, [{ text: '70°' }, { text: '2', n: 2 }, { text: '3' }, { text: '4', n: 2 }]), text: 'זווית $1$ היא $70^\\circ$. מה שלוש האחרות?',
      choices: ['$\\sphericalangle 2 = 110^\\circ$, $\\sphericalangle 3 = 70^\\circ$, $\\sphericalangle 4 = 110^\\circ$', 'כולן $70^\\circ$', '$\\sphericalangle 2 = 110^\\circ$, $\\sphericalangle 3 = 110^\\circ$, $\\sphericalangle 4 = 70^\\circ$'], answer: 0,
      why: 'זווית $3$ מול זווית $1$, ולכן שווה לה. זוויות $2$ ו־$4$ שכנות של זווית $1$, ולכן כל אחת $180^\\circ - 70^\\circ = 110^\\circ$.',
      wrongWhy: { 1: 'רק הזווית שמול $70^\\circ$ שווה לה. השכנות משלימות אותה ל־$180^\\circ$.', 2: 'זווית $3$ עומדת מול זווית $1$, לא לידה.' } },
    { kind: 'predict', fig: crossing(70, [{ text: '70°' }, { text: '110°', n: 2 }, { text: '70°' }, { text: '110°', n: 2 }]), text: 'וכמה כל ארבע הזוויות יחד?', choices: ['$180^\\circ$', '$360^\\circ$', '$280^\\circ$'], answer: 1,
      why: '$70^\\circ + 110^\\circ + 70^\\circ + 110^\\circ = 360^\\circ$. כך תמיד: שני זוגות של זוויות צמודות, $180^\\circ + 180^\\circ$, סיבוב שלם.',
      wrongWhy: { 2: 'זה כאילו כל ארבע הזוויות הן $70^\\circ$. אבל שתיים מהן $110^\\circ$.', 0: '$180^\\circ$ הוא רק זוג אחד, מצד אחד של הישר. מהצד השני יש עוד זוג.' } },
    { kind: 'explore', text: 'נסו לבד: זווית $3$ היא $40^\\circ$, וזווית $2$ צמודה לה. סובבו את הקרן כך שהזווית השמאלית תהיה זווית $2$, וראו מה יוצא בזווית $1$.',
      ...turn(140), hint: 'זווית $2$ משלימה את $40^\\circ$ ל־$180^\\circ$.', success: 'זווית $2$ היא $140^\\circ$, והימנית, זווית $1$, יצאה $40^\\circ$: בדיוק כמו זווית $3$ שמולה.' },
  ],
  examples: [
    { problem: 'שני ישרים נחתכים, ו־$\\sphericalangle 1 = 62^\\circ$. מצאו את שלוש הזוויות האחרות. כמה היא $\\sphericalangle 4$?', display: '\\sphericalangle 1 = 62^\\circ', answer: 118, check: '180 - 62',
      fig: crossing(62, [{ text: '62°' }, { text: '2', n: 2 }, { text: '3' }, { text: '4', n: 2, target: true }]),
      steps: [
        { action: 'הזווית שמול $\\sphericalangle 1$ היא $\\sphericalangle 3$: הן קודקודיות.', why: 'זוויות קודקודיות שוות, כי שתיהן משלימות את $\\sphericalangle 2$ ל־$180^\\circ$.', result: '\\sphericalangle 3 = \\sphericalangle 1 = 62^\\circ', calc: { expr: '62', value: 62 } },
        { action: '$\\sphericalangle 2$ שכנה של $\\sphericalangle 1$: הן צמודות.', why: 'הן חולקות צלע, והצלעות האחרות שלהן הן ישר אחד.', result: '\\sphericalangle 2 = 180^\\circ - 62^\\circ = 118^\\circ', calc: { expr: '180 - 62', value: 118 } },
        { action: '$\\sphericalangle 4$ עומדת מול $\\sphericalangle 2$, ולכן שווה לה.', why: 'שוב זוויות קודקודיות.', result: '\\sphericalangle 4 = \\sphericalangle 2 = 118^\\circ', value: '180 - 62' },
        { action: 'בודקים: ארבע הזוויות יחד.', why: 'סביב נקודת החיתוך יש סיבוב שלם, $360^\\circ$.', result: '62^\\circ + 118^\\circ + 62^\\circ + 118^\\circ = 360^\\circ', calc: { expr: '62 + 118 + 62 + 118', value: 360 } },
      ] },
    { problem: 'שני כבישים ישרים מצטלבים. שתיים מהפינות בצומת עומדות זו מול זו, ויחד הן $100^\\circ$. מה הזווית בכל אחת משתי הפינות האחרות?', answer: 130, check: '180 - 100 / 2',
      fig: crossing(50, [{}, { text: '?', n: 2, target: true }, {}, { n: 2 }]),
      steps: [
        { action: 'שתי הפינות שעומדות זו מול זו הן זוויות קודקודיות, ולכן שוות.', why: 'שתי זוויות שוות שיחד הן $100^\\circ$: כל אחת היא חצי.', result: '100^\\circ : 2 = 50^\\circ', calc: { expr: '100 / 2', value: 50 } },
        { action: 'כל אחת מהפינות האחרות נמצאת ליד פינה של $50^\\circ$: הן צמודות.', why: 'פינות סמוכות בצומת יוצרות יחד קו ישר של כביש אחד.', result: '180^\\circ - 50^\\circ', value: '180 - 50' },
        { action: 'מחשבים.', why: 'שתי הפינות האחרות עומדות זו מול זו, ולכן שתיהן יוצאות אותו דבר.', result: '130^\\circ', value: '130' },
        { action: 'בודקים: כל ארבע הפינות יחד.', why: 'סביב הצומת יש סיבוב שלם.', result: '50^\\circ + 130^\\circ + 50^\\circ + 130^\\circ = 360^\\circ', calc: { expr: '50 + 130 + 50 + 130', value: 360 } },
      ] },
    // CURRICULUM-10: a question of two steps (a check asks such questions), solved in two written steps and checked
    { problem: 'שני ישרים נחתכים, ואחת הזוויות היא $70^\\circ$. קרן חוצה את הזווית שצמודה לה, כלומר מחלקת אותה לשתי זוויות שוות. מה גודל כל אחד מהחלקים?',
      fig: crossBisectFig(70, 'ul', true), answer: 55, check: '(180 - 70) / 2',
      steps: [
        { action: 'שלב 1: מוצאים את כל הזווית שהקרן חוצה. היא צמודה לזווית של $70^\\circ$.', why: 'שתי זוויות זו ליד זו בחיתוך יוצרות יחד קו ישר, $180^\\circ$.', result: '180^\\circ - 70^\\circ = 110^\\circ', calc: { expr: '180 - 70', value: 110 } },
        { action: 'שלב 2: לוקחים חצי ממנה.', why: 'הקרן חוצה את $110^\\circ$ לשני חלקים שווים.', result: '110^\\circ : 2 = 55^\\circ', value: '110 / 2' },
        { action: 'בודקים: שני החלקים יחד עם $70^\\circ$.', why: 'שלושתם זה ליד זה על ישר אחד, ולכן יחד צריך לצאת $180^\\circ$.', result: '55^\\circ + 55^\\circ + 70^\\circ = 180^\\circ', calc: { expr: '55 + 55 + 70', value: 180 } },
      ] },
  ],
  together: [
    { problem: 'שני ישרים נחתכים, ו־$\\sphericalangle 2 = 104^\\circ$. נמצא יחד את $\\sphericalangle 1$.', display: '\\sphericalangle 2 = 104^\\circ',
      fig: crossing(76, [{ text: '1', target: true }, { text: '104°', n: 2 }, { text: '3' }, { text: '4', n: 2 }]),
      steps: [
        { prompt: 'קודם כול: איזו זווית עומדת מול $\\sphericalangle 2$, ומה הגודל שלה?', choices: [
          { text: '$\\sphericalangle 4$, גם היא $104^\\circ$', ok: true, feedback: 'נכון: זוויות קודקודיות שוות.' },
          { text: '$\\sphericalangle 4$, והיא $76^\\circ$', ok: false, feedback: '$\\sphericalangle 4$ עומדת מול $\\sphericalangle 2$, ולכן שווה לה. משלימה ל־$180^\\circ$ רק זווית שכנה.' },
          { text: '$\\sphericalangle 3$, גם היא $104^\\circ$', ok: false, feedback: '$\\sphericalangle 3$ שכנה של $\\sphericalangle 2$, לא מולה. במספור לפי הסדר, מול $\\sphericalangle 2$ נמצאת $\\sphericalangle 4$.' },
        ], hints: ['במספור לפי הסדר, הזווית שמול כל זווית רחוקה ממנה בשני מספרים.', 'מול $\\sphericalangle 2$ נמצאת $\\sphericalangle 4$, וזוויות קודקודיות שוות.'], done: '$\\sphericalangle 4 = \\sphericalangle 2 = 104^\\circ$' },
        { prompt: 'ואיך $\\sphericalangle 1$ קשורה ל־$\\sphericalangle 2$?', choices: [
          { text: 'הן צמודות: יחד $180^\\circ$', ok: true, feedback: 'נכון: הן שכנות על אותו ישר.' },
          { text: 'הן קודקודיות: שוות', ok: false, misc: 'equal-not-supp', feedback: '$\\sphericalangle 1$ לא מול $\\sphericalangle 2$, היא לידה. שכנות בחיתוך הן צמודות.' },
          { text: 'אין ביניהן קשר', ok: false, feedback: 'יש: הן חולקות צלע, והצלעות האחרות שלהן הן ישר אחד.' },
        ], hints: ['זוויות שהמספרים שלהן עוקבים, כמו $1$ ו־$2$, הן שכנות.', 'שכנות בחיתוך הן צמודות: יחד $180^\\circ$.'], done: '$\\sphericalangle 1 = 180^\\circ - 104^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות $\\sphericalangle 1$?', answer: 76, check: '180 - 104', hints: ['$180 - 100 = 80$, ואז מורידים עוד $4$.', '$\\sphericalangle 1 = 180^\\circ - 104^\\circ$. בדקו: יחד עם $104^\\circ$ צריך לצאת $180^\\circ$.'] } },
    { problem: 'הפתעה: שני ישרים נחתכים, ושתי זוויות שכנות שוות זו לזו. מה גודל הזוויות?',
      fig: crossing(90, [{}, {}, { text: '?', target: true }, null]),
      steps: [
        { prompt: 'שתי זוויות שכנות ושוות. כמה כל אחת?', choices: [
          { text: '$90^\\circ$', ok: true, feedback: 'נכון: הן צמודות, אז יחד $180^\\circ$, וכל אחת חצי.' },
          { text: '$180^\\circ$', ok: false, feedback: '$180^\\circ$ הן שתיהן יחד. כל אחת היא חצי.' },
          { text: '$45^\\circ$', ok: false, feedback: '$45^\\circ$ היה נכון אילו שתיהן יחד היו $90^\\circ$. אבל זוויות צמודות יחד הן $180^\\circ$.' },
        ], hints: ['שכנות בחיתוך הן צמודות. כמה הן יחד?', 'יחד $180^\\circ$, ושתיהן שוות: מחלקים לשתיים.'], done: 'כל אחת $90^\\circ$.' },
      ],
      final: { prompt: 'ומה גודל הזווית שעומדת מול אחת מהן?', answer: 90, check: '180 / 2', hints: ['הזווית שמול היא הקודקודית שלה.', 'זוויות קודקודיות שוות. אז כל ארבע הזוויות ישרות, והישרים מאונכים.'] } },
  ],
  diag: crossModel,
  transfer: crossStory,
  misconceptions: [
    { id: 'supp-not-equal', title: 'השלימו ל־$180^\\circ$, אבל הזווית שמול הנתונה שווה לה',
      cause: 'הכלל של זוויות צמודות, "משלימים ל־$180^\\circ$", הופעל על זוויות שעומדות זו מול זו. זוויות קודקודיות לא חולקות צלע, ולכן הן לא יוצרות יחד קו ישר.',
      explain: [
        'שתי זוויות משלימות זו את זו ל־$180^\\circ$ רק כשהן שכנות על אותו ישר.',
        'הזווית שמול הנתונה לא שכנה שלה. שתיהן שכנות של אותה זווית שלישית, ולכן שתיהן שוות ל־$180^\\circ$ פחות אותה זווית. כלומר: הן שוות.',
      ],
      remedy: [
        { kind: 'explore', text: 'זווית $2$ היא $145^\\circ$, והיא שכנה גם של זווית $1$ וגם של זווית $3$. סובבו את הקרן כך שהזווית השמאלית תהיה $145^\\circ$.', ...turn(145),
          hint: 'הימנית היא מה שחסר ל־$145^\\circ$ עד $180^\\circ$.', success: 'הימנית יצאה $35^\\circ$: זו זווית $1$. גם זווית $3$ היא $180^\\circ - 145^\\circ = 35^\\circ$. הן שוות.' },
        { kind: 'predict', text: 'במספריים, הזווית בין הלהבים היא $30^\\circ$. מה הזווית בין הידיות?', choices: ['$30^\\circ$', '$150^\\circ$'], answer: 0,
          why: 'הידיות הן ההמשך של הלהבים מעבר לציר. הזווית ביניהן עומדת מול הזווית בין הלהבים, ולכן שווה לה.' },
      ] },
    { id: 'equal-not-supp', title: 'ענו שזווית שליד הנתונה שווה לה, אבל הן צמודות', prereq: 'angles:1',
      cause: 'אחרי שלומדים ש"קודקודיות שוות", קל להחיל את זה על כל זוג זוויות בחיתוך. אבל רק זוויות שעומדות זו מול זו שוות. זוויות שכנות משלימות זו את זו ל־$180^\\circ$.',
      explain: [
        'בחיתוך של שני ישרים יש שני סוגים של זוגות: זו מול זו (שוות), וזו ליד זו (יחד $180^\\circ$).',
        'בדיקה מהירה: אם הזווית הנתונה חדה, השכנות שלה קהות. זווית חדה וזווית קהה לא יכולות להיות שוות.',
      ],
      remedy: [
        { kind: 'explore', text: 'זווית $1$ היא $40^\\circ$, וזווית $2$ לידה. סובבו את הקרן כך שהזווית השמאלית תהיה $40^\\circ$, וקראו את הימנית.', ...turn(40),
          hint: 'השכנה של $40^\\circ$ משלימה אותה ל־$180^\\circ$.', success: 'השכנה היא $140^\\circ$, לא $40^\\circ$. זוויות שכנות בחיתוך יוצרות יחד קו ישר.' },
        { kind: 'predict', text: 'בחיתוך של שני ישרים יש זווית של $25^\\circ$. כמה זוויות של $25^\\circ$ יש בחיתוך?', choices: ['אחת', 'שתיים', 'ארבע'], answer: 1,
          why: 'הזווית עצמה והזווית שמולה. שתי השכנות שלהן הן $155^\\circ$ כל אחת.' },
      ] },
    { id: 'wrong-total', title: 'חשבו שארבע הזוויות בחיתוך יחד הן $180^\\circ$',
      cause: 'הסכום $180^\\circ$ שייך לקו ישר אחד, מצד אחד שלו. סביב נקודת החיתוך יש שני צדדים, כלומר סיבוב שלם.',
      explain: [
        'ארבע הזוויות הן שני זוגות של זוויות צמודות: $180^\\circ$ מעל הישר, ועוד $180^\\circ$ מתחתיו.',
        'יחד $360^\\circ$: סיבוב שלם סביב הנקודה.',
      ],
      remedy: [
        { kind: 'predict', text: 'בחיתוך, זווית $1$ היא $80^\\circ$. כמה הן $\\sphericalangle 2 + \\sphericalangle 3 + \\sphericalangle 4$?', choices: ['$100^\\circ$', '$280^\\circ$', '$180^\\circ$'], answer: 1,
          why: '$\\sphericalangle 2 = 100^\\circ$, $\\sphericalangle 3 = 80^\\circ$, $\\sphericalangle 4 = 100^\\circ$. יחד $280^\\circ$, כלומר $360^\\circ - 80^\\circ$.',
          wrongWhy: { 0: '$100^\\circ$ היא רק זווית $2$, שמשלימה את $80^\\circ$ לישר אחד. יש עוד שתי זוויות.' } },
        { kind: 'explore', text: 'מעל הישר יש זוג זוויות צמודות. זווית $1$ היא $80^\\circ$: סובבו את הקרן כך שהזווית השמאלית תהיה $80^\\circ$.', ...turn(80),
          hint: 'הימנית משלימה את $80^\\circ$ ל־$180^\\circ$.', success: 'מעל הישר: $80^\\circ + 100^\\circ = 180^\\circ$. מתחתיו יש עוד זוג כזה. בסך הכול $360^\\circ$.' },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 3: the sum of the angles of a triangle

type TriSum = { k: number; a: number; b: number }; // k 0: two angles given; k 1: a right triangle and one acute angle
const triModel: DiagModel<TriSum> = {
  params: (rnd) => {
    if (rnd() < 0.3) return { k: 1, a: 5 * rint(rnd, 3, 17), b: 90 };
    let a = 0; let b = 0;
    do { a = 5 * rint(rnd, 4, 22); b = 5 * rint(rnd, 4, 22); } while (a + b > 165);
    return { k: 0, a, b };
  },
  // a check: nine in ten two angles given, the answer neither of them (CURRICULUM-10: "90° minus the given angle" passed
  // a verification of three right triangles 3.5% of the time)
  testParams: (rnd) => {
    if (rnd() < 0.1) return { k: 1, a: 5 * rint(rnd, 3, 17), b: 90 };
    for (;;) {
      const a = 5 * rint(rnd, 4, 22); const b = 5 * rint(rnd, 4, 22); const c = 180 - a - b;
      if (a + b <= 165 && a !== 90 && b !== 90 && c !== a && c !== b) return { k: 0, a, b };
    }
  },
  text: (p) => (p.k === 0
    ? `במשולש $ABC$: $\\sphericalangle A = ${d(p.a)}$ ו־$\\sphericalangle B = ${d(p.b)}$. מה גודל $\\sphericalangle C$?`
    : `במשולש ישר־זווית $ABC$ הזווית $C$ ישרה, ו־$\\sphericalangle A = ${d(p.a)}$. מה גודל $\\sphericalangle B$?`),
  answer: (p) => 180 - p.a - p.b,
  bugs: {
    // a full turn instead of a straight line
    'sum-360': (p) => 360 - p.a - p.b,
    // only one known angle taken off (in a right triangle: the right angle, which has no number next to it)
    'one-angle': (p) => 180 - p.a,
  },
  solution: (p) => (p.k === 0
    ? ['סכום הזוויות במשולש הוא $180^\\circ$.', `$\\sphericalangle C = 180^\\circ - ${d(p.a)} - ${d(p.b)} = ${d(180 - p.a - p.b)}$`]
    : ['סכום הזוויות במשולש הוא $180^\\circ$, והזווית $C$ לוקחת מהם $90^\\circ$.', `$\\sphericalangle B = 180^\\circ - 90^\\circ - ${d(p.a)} = ${d(90 - p.a)}$`]),
  hint: (p) => (p.k === 0
    ? 'שלוש הזוויות יחד הן $180^\\circ$. כמה לוקחות שתי הידועות?'
    : 'גם הזווית הישרה היא אחת משלוש הזוויות: $90^\\circ$, גם אם לא כתוב לידה מספר.'),
  unit: 'מעלות',
};

const triStory: DiagModel<TriSum> = {
  // a triangular garden bed, a ladder against a wall (the wall and the floor make the right angle)
  params: (rnd) => {
    if (rnd() < 0.5) return { k: 1, a: 5 * rint(rnd, 11, 16), b: 90 };
    let a = 0; let b = 0;
    do { a = 5 * rint(rnd, 6, 20); b = 5 * rint(rnd, 6, 20); } while (a + b > 160);
    return { k: 0, a, b };
  },
  text: (p) => (p.k === 0
    ? `ערוגה בגינה היא משולש. בשתי פינות שלה מדדו זוויות של $${d(p.a)}$ ושל $${d(p.b)}$. מה הזווית בפינה השלישית?`
    : `סולם נשען על קיר. הקיר עומד ישר, מאונך לרצפה. הסולם יוצר עם הרצפה זווית של $${d(p.a)}$. מה הזווית בין הסולם לקיר?`),
  answer: (p) => 180 - p.a - p.b,
  bugs: {
    'sum-360': (p) => 360 - p.a - p.b,
    'one-angle': (p) => 180 - p.a,
  },
  solution: (p) => (p.k === 0
    ? ['שלוש הפינות של הערוגה הן שלוש הזוויות של משולש: יחד $180^\\circ$.', `$180^\\circ - ${d(p.a)} - ${d(p.b)} = ${d(180 - p.a - p.b)}$`]
    : ['הסולם, הקיר והרצפה יוצרים משולש, ובין הקיר לרצפה יש זווית ישרה.', `$180^\\circ - 90^\\circ - ${d(p.a)} = ${d(90 - p.a)}$`]),
  hint: (p) => (p.k === 0 ? 'שלוש פינות של משולש: כמה מעלות יחד?' : 'ציירו את המשולש: סולם, קיר ורצפה. מה הזווית בין הקיר לרצפה?'),
  unit: 'מעלות',
};

const stair3: StairContent = {
  skill: 'angles:3', topic: 'angles', level: 3, title: 'סכום זוויות במשולש',
  objectives: [
    'לדעת שסכום הזוויות בכל משולש הוא $180^\\circ$, ולראות למה.',
    'למצוא זווית שלישית משתי זוויות נתונות.',
    'במשולש ישר־זווית: לדעת ששתי הזוויות החדות יחד הן $90^\\circ$.',
  ],
  idea: 'בכל משולש, גדול או קטן, צר או רחב, שלוש הזוויות יחד הן $180^\\circ$: כשקורעים את שלוש הפינות ומצמידים אותן זו ליד זו, הן ממלאות בדיוק קו ישר.',
  why: [
    'גוזרים משולש מנייר, קורעים את שלוש הפינות, ומצמידים אותן כך שהקודקודים נפגשים בנקודה אחת, פינה ליד פינה.',
    'שלוש הפינות ממלאות קו ישר, בלי חור ובלי חפיפה. קו ישר הוא $180^\\circ$, ולכן גם שלוש הזוויות יחד.',
    'כשמזיזים קודקוד, זווית אחת גדלה ואחרות קטנות באותה מידה. הסכום לא משתנה, ולכן זווית חסרה היא תמיד $180^\\circ$ פחות שתי האחרות.',
  ],
  alt: [
    'ניסוי עם עיפרון: מניחים אותו על צלע אחת. בכל קודקוד מסובבים אותו, תמיד לאותו כיוון, בדיוק בזווית של הקודקוד, עד שהוא מונח על הצלע הבאה. אחרי שלושה קודקודים הוא חוזר לצלע הראשונה, אבל הפוך: הוא הסתובב חצי סיבוב, $180^\\circ$.',
    'חותכים מלבן באלכסון ומקבלים שני משולשים זהים. במלבן ארבע זוויות ישרות, $360^\\circ$, והן מתחלקות שווה בשווה בין שני המשולשים: $180^\\circ$ לכל אחד.',
    'דמיינו שמורידים את הקודקוד $C$ עד הבסיס: המשולש נעשה שטוח. $\\sphericalangle A$ ו־$\\sphericalangle B$ מתכווצות לאפס, ו־$\\sphericalangle C$ נפתחת עד קו ישר, $180^\\circ$.',
  ],
  discover: [
    { kind: 'say', fig: triangle(['A', 'B', 'C'], [[0, 0], [5, 0], [1.8, 3]], { A: {}, B: { n: 2 }, C: { n: 3, r: 22 } }), mood: 'thinking', text: 'במשולש $ABC$ יש שלוש זוויות, אחת בכל קודקוד: $\\sphericalangle A$, $\\sphericalangle B$ ו־$\\sphericalangle C$. האם יש קשר ביניהן? נבדוק.' },
    { kind: 'predict', fig: similar(), text: 'משולש גדול מאוד ומשולש קטן מאוד, באותה צורה. באיזה מהם סכום הזוויות גדול יותר?',
      choices: ['בגדול', 'בקטן', 'הסכום שווה בשניהם'], answer: 2,
      why: 'זווית מודדת פתיחה, לא אורך. כשמגדילים משולש פי $2$, הצלעות מתארכות, אבל הפינות נשארות אותן פינות.',
      wrongWhy: { 0: 'זוויות לא תלויות באורך הצלעות. משולש שמוגדל פי $2$ נראה אותו דבר, עם אותן פינות.', 1: 'גם במשולש קטן הפינות פתוחות בדיוק כמו במשולש גדול באותה צורה.' } },
    { kind: 'explore', text: 'גררו את הקודקוד $C$ למקומות שונים, והסתכלו על שלוש הזוויות ועל הסכום שלהן. בסוף עצרו במקום שבו הזווית $C$ ישרה, $90^\\circ$.',
      manip: tri([-2, 3]), answer: [0, 5],
      hint: 'העלו את $C$ מעל האמצע של $AB$. כשהוא נמוך הזווית $C$ קהה, וכשהוא גבוה היא חדה.',
      success: 'הזווית $C$ ישרה. הזוויות $A$ ו־$B$ השתנו כל הזמן, אבל הסכום נשאר $180^\\circ$.' },
    { kind: 'predict', fig: triangle(['A', 'B', 'C'], [[0, 0], [5, 0], [1.8, 2.4]], { A: { text: '?', target: true }, B: { text: '?', target: true, n: 2 }, C: { right: true } }), text: 'הזווית $C$ ישרה. כמה הן $\\sphericalangle A + \\sphericalangle B$ יחד?', choices: ['$90^\\circ$', '$180^\\circ$', '$45^\\circ$'], answer: 0,
      why: 'שלוש הזוויות יחד הן $180^\\circ$, ו־$\\sphericalangle C$ לוקחת מזה $90^\\circ$. ל־$\\sphericalangle A$ ול־$\\sphericalangle B$ יחד נשאר $90^\\circ$.',
      wrongWhy: { 1: '$180^\\circ$ הוא הסכום של שלוש הזוויות, כולל $\\sphericalangle C$.', 2: '$45^\\circ$ זה כל אחת, וגם זה רק כששתיהן שוות. יחד הן $90^\\circ$.' } },
    { kind: 'say', fig: torn(), text: 'הסכום נשאר $180^\\circ$ בכל מקום שגררתם. אבל למה? ניסוי עם נייר: גוזרים משולש, קורעים את שלוש הפינות, ומצמידים אותן זו ליד זו כך שהקודקודים נפגשים בנקודה אחת.' },
    { kind: 'predict', fig: torn(), text: 'מה יוצרות שלוש הפינות יחד?', choices: ['קו ישר', 'זווית ישרה', 'סיבוב שלם'], answer: 0,
      why: 'שלוש הפינות ממלאות בדיוק קו ישר: זווית שטוחה, $180^\\circ$. זו הסיבה שסכום הזוויות במשולש הוא $180^\\circ$.',
      wrongWhy: { 1: 'זווית ישרה היא רק $90^\\circ$, כמו פינה של דף. שלוש הפינות ממלאות יותר.', 2: 'סיבוב שלם הוא $360^\\circ$, מסביב לנקודה. הפינות ממלאות רק צד אחד של הקו.' } },
    { kind: 'explore', text: 'נבנה את זה: במשולש $\\sphericalangle A = 70^\\circ$ ו־$\\sphericalangle B = 45^\\circ$. הנחנו את שתי הפינות זו ליד זו על הישר, ויחד הן $115^\\circ$. סובבו את הקרן כך שהזווית השמאלית תהיה $115^\\circ$.',
      ...turn(115, 90, NO_LETTERS), hint: 'השמאלית היא שתי הפינות יחד, $70^\\circ + 45^\\circ$. הימנית היא מה שנשאר עד $180^\\circ$.',
      success: 'בצד ימין נשאר רווח של $65^\\circ$, והפינה $C$ נכנסת בו בדיוק: $\\sphericalangle C = 65^\\circ$.' },
    { kind: 'rule', fig: triangleSum(), text: 'הכלל: סכום הזוויות בכל משולש הוא $180^\\circ$.', display: '\\sphericalangle A + \\sphericalangle B + \\sphericalangle C = 180^\\circ',
      why: 'שלוש הפינות של משולש, כשמצמידים אותן, ממלאות קו ישר. לכן זווית חסרה היא $180^\\circ$ פחות שתי הזוויות האחרות.' },
    // CLASSROOM-11: the class's triangle split by a segment from a vertex ("יש 3 Δ בשרטוט")
    { kind: 'say', fig: splitTri(45, 64, { ADC: { text: '64°' }, BAD: { text: '19°' }, B: { text: 'β', target: true } }),
      text: 'במשולש ישר־זווית $ABC$ הנקודה $D$ על הצלע $BC$, והקטע $AD$ מחלק אותו. בשרטוט הזה יש שלושה משולשים: $ABD$, $ADC$, והגדול $ABC$. הזווית ב־$B$ היא $\\beta$.' },
    { kind: 'predict', fig: splitTri(45, 64, { ADC: { text: '64°' }, BAD: { text: '19°' }, B: { text: 'β', target: true } }),
      text: 'במשולש $ABC$ הזווית ב־$C$ ישרה, $D$ על $BC$, $\\sphericalangle ADC = 64^\\circ$ ו־$\\sphericalangle BAD = 19^\\circ$. כדי למצוא את $\\beta$, באיזה משולש כדאי להשתמש?',
      choices: ['במשולש שיש בו את $\\beta$ ועוד שתי זוויות שאפשר למצוא: $ABD$, או הגדול $ABC$', 'אין צורך במשולש: $\\beta + 64^\\circ = 180^\\circ$'], answer: 0,
      why: 'ב־$ABD$: $19^\\circ$ נתונה, והזווית שלו ב־$D$ צמודה ל־$64^\\circ$. ב־$ABC$: הזווית הישרה, והזווית ב־$A$ כולה, אחרי שמוצאים במשולש $ADC$ את החלק השני שלה. שתי הדרכים נותנות $\\beta = 45^\\circ$.',
      wrongWhy: { 1: '$\\beta$ בקודקוד $B$, ו־$64^\\circ$ בקודקוד $D$. אין להן קודקוד משותף, ולכן הן לא משלימות זו את זו ל־$180^\\circ$. $180^\\circ - 64^\\circ = 116^\\circ$ היא $\\sphericalangle ADB$, לא $\\beta$.' } },
    { kind: 'predict', fig: twoRights(), text: 'האם יכול להיות משולש עם שתי זוויות ישרות?', choices: ['כן', 'לא'], answer: 1,
      why: 'שתי זוויות ישרות הן כבר $180^\\circ$. לזווית השלישית לא נשאר כלום, ושתי הצלעות לא ייפגשו: הן יעלו ישר למעלה זו ליד זו.',
      wrongWhy: { 0: 'נסו לצייר: שתי צלעות שעולות ישר למעלה לא נפגשות אף פעם.' } },
    { kind: 'predict', fig: triangle(['A', 'B', 'C'], [[0, 0], [5, 0], apex(50, 60)], { A: { text: '50°' }, B: { text: '60°', n: 2 }, C: { text: '?', target: true } }), text: 'במשולש $\\sphericalangle A = 50^\\circ$ ו־$\\sphericalangle B = 60^\\circ$. מה $\\sphericalangle C$?', choices: ['$70^\\circ$', '$110^\\circ$', '$250^\\circ$'], answer: 0,
      why: '$180^\\circ - 50^\\circ - 60^\\circ = 70^\\circ$. בדיקה: $50 + 60 + 70 = 180$.',
      wrongWhy: { 1: '$110^\\circ$ הוא $50^\\circ + 60^\\circ$: כמה ששתי הזוויות הידועות לוקחות. $\\sphericalangle C$ היא מה שנשאר מ־$180^\\circ$.', 2: '$250^\\circ$ יוצא מ־$360^\\circ$. שלוש פינות של משולש ממלאות קו ישר, לא סיבוב שלם.' } },
  ],
  examples: [
    { problem: 'במשולש $ABC$: $\\sphericalangle A = 48^\\circ$ ו־$\\sphericalangle B = 67^\\circ$. מה גודל $\\sphericalangle C$?', display: '\\sphericalangle A = 48^\\circ,\\quad \\sphericalangle B = 67^\\circ', answer: 65, check: '180 - 48 - 67',
      fig: triFromAngles(48, 67, { A: { text: '48°' }, B: { text: '67°' }, C: { text: '?', target: true } }),
      steps: [
        { action: 'כותבים מה ידוע על כל שלוש הזוויות.', why: 'סכום הזוויות במשולש הוא $180^\\circ$: שלוש הפינות ממלאות קו ישר.', result: '48^\\circ + 67^\\circ + \\sphericalangle C = 180^\\circ' },
        { action: 'מחברים את שתי הזוויות הידועות.', why: 'כך יודעים כמה מתוך $180^\\circ$ כבר תפוס.', result: '48^\\circ + 67^\\circ = 115^\\circ', calc: { expr: '48 + 67', value: 115 } },
        { action: 'מורידים את התפוס מ־$180^\\circ$.', why: '$\\sphericalangle C$ היא מה שנשאר.', result: '\\sphericalangle C = 180^\\circ - 115^\\circ = 65^\\circ', value: '180 - 115' },
        { action: 'בודקים: שלוש הזוויות יחד.', why: 'אם יוצא $180^\\circ$, החישוב נכון.', result: '48^\\circ + 67^\\circ + 65^\\circ = 180^\\circ', calc: { expr: '48 + 67 + 65', value: 180 } },
      ] },
    { problem: 'מפרש של סירה הוא משולש. התורן עומד ישר, מאונך למוט התחתון של המפרש. בראש התורן, הזווית בין התורן לשפת המפרש היא $28^\\circ$. מה הזווית בקצה המוט התחתון?', answer: 62, check: '180 - 90 - 28',
      fig: sail(28),
      steps: [
        { action: 'מזהים את שלוש הזוויות: בין התורן למוט יש זווית ישרה.', why: 'התורן מאונך למוט, ולכן המפרש הוא משולש ישר־זווית.', result: '90^\\circ + 28^\\circ + x = 180^\\circ' },
        { action: 'מורידים מ־$180^\\circ$ את שתי הזוויות הידועות, גם את הישרה.', why: 'הזווית הישרה לוקחת $90^\\circ$ מתוך $180^\\circ$, גם אם לא כתוב לידה מספר.', result: 'x = 180^\\circ - 90^\\circ - 28^\\circ', value: '180 - 90 - 28' },
        { action: 'דרך קצרה: במשולש ישר־זווית, שתי הזוויות החדות יחד הן $90^\\circ$.', why: 'אחרי $90^\\circ$ של הזווית הישרה נשארים $90^\\circ$ לשתי האחרות.', result: 'x = 90^\\circ - 28^\\circ = 62^\\circ', value: '90 - 28' },
        { action: 'בודקים.', why: 'שלוש הזוויות צריכות למלא $180^\\circ$.', result: '90^\\circ + 28^\\circ + 62^\\circ = 180^\\circ', calc: { expr: '90 + 28 + 62', value: 180 } },
      ] },
    // CLASSROOM-11: the class's way, two helper sketches (שרטוטי עזר), each its own triangle with its own right angle and
    // givens, each line with its reason
    { problem: 'במשולש ישר־זווית $ABC$ ($\\sphericalangle C = 90^\\circ$) הנקודה $D$ על הצלע $BC$. $\\sphericalangle ADC = 64^\\circ$ ו־$\\sphericalangle BAD = 19^\\circ$. מה גודל $\\beta$, הזווית ב־$B$?',
      fig: splitTri(45, 64, { ADC: { text: '64°' }, BAD: { text: '19°' }, B: { text: 'β', target: true } }), answer: 45, check: '64 - 19',
      steps: [
        { action: 'שרטוט עזר 1: המשולש הקטן $ADC$, עם הזווית הישרה ב־$C$ ו־$64^\\circ$ ב־$D$. מוצאים בו את $\\alpha = \\sphericalangle DAC$.', why: 'סכום זוויות ב־$\\Delta$ שווה $180^\\circ$.',
          result: '\\alpha = 180^\\circ - 90^\\circ - 64^\\circ = 26^\\circ', calc: { expr: '180 - 90 - 64', value: 26 },
          fig: splitTri(45, 64, { ADC: { text: '64°' }, DAC: { text: 'α', target: true } }, { show: 'ADC' }) },
        { action: 'שרטוט עזר 2: המשולש הגדול $ABC$, עם הזווית הישרה ב־$C$. הזווית ב־$A$ כולה: $19^\\circ + 26^\\circ = 45^\\circ$.', why: 'סכום זוויות ב־$\\Delta$ שווה $180^\\circ$.',
          result: '\\beta = 180^\\circ - 90^\\circ - 45^\\circ = 45^\\circ', value: '180 - 90 - 45',
          fig: splitTri(45, 64, { BAC: { text: '45°' }, B: { text: 'β', target: true } }, { show: 'ABC' }) },
        { action: 'בודקים במשולש השלישי, $ABD$. הזווית שלו ב־$D$ צמודה ל־$64^\\circ$: $180^\\circ - 64^\\circ = 116^\\circ$.', why: 'סכום זוויות ב־$\\Delta$ שווה $180^\\circ$ גם בו.',
          result: '19^\\circ + 116^\\circ + 45^\\circ = 180^\\circ', calc: { expr: '19 + 116 + 45', value: 180 } },
      ] },
  ],
  together: [
    { problem: 'במשולש $\\sphericalangle A = 35^\\circ$ ו־$\\sphericalangle C = 100^\\circ$. נמצא יחד את $\\sphericalangle B$.', display: '\\sphericalangle A = 35^\\circ,\\quad \\sphericalangle C = 100^\\circ',
      fig: triFromAngles(35, 45, { A: { text: '35°' }, B: { text: '?', target: true }, C: { text: '100°' } }),
      steps: [
        { prompt: 'מה ידוע על שלוש הזוויות?', choices: [
          { text: 'יחד הן $180^\\circ$', ok: true, feedback: 'נכון: שלוש הפינות ממלאות קו ישר.' },
          { text: 'יחד הן $360^\\circ$', ok: false, misc: 'sum-360', feedback: '$360^\\circ$ הוא סיבוב שלם. שלוש פינות של משולש ממלאות רק קו ישר.' },
          { text: 'הן שוות', ok: false, feedback: 'הן שוות רק במשולש שכל הצלעות שלו שוות. כאן נתונות שתי זוויות שונות.' },
        ], hints: ['זכרו את שלוש הפינות הקרועות.', 'הפינות ממלאות קו ישר: $180^\\circ$.'], done: '$\\sphericalangle A + \\sphericalangle B + \\sphericalangle C = 180^\\circ$' },
        { prompt: 'איזה חישוב נותן את $\\sphericalangle B$?', choices: [
          { text: '$180^\\circ - 35^\\circ - 100^\\circ$', ok: true, feedback: 'נכון: מה שנשאר אחרי שתי הזוויות הידועות.' },
          { text: '$180^\\circ - 100^\\circ$', ok: false, misc: 'one-angle', feedback: 'הורדתם רק את $\\sphericalangle C$. גם $\\sphericalangle A$ לוקחת חלק מ־$180^\\circ$.' },
          { text: '$35^\\circ + 100^\\circ$', ok: false, feedback: 'זה כמה ששתי הזוויות הידועות לוקחות יחד. $\\sphericalangle B$ היא מה שנשאר.' },
        ], hints: ['כמה לוקחות שתי הזוויות הידועות יחד?', '$35^\\circ + 100^\\circ = 135^\\circ$, ו־$\\sphericalangle B$ היא מה שנשאר מ־$180^\\circ$.'], done: '$\\sphericalangle B = 180^\\circ - 35^\\circ - 100^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות $\\sphericalangle B$?', answer: 45, check: '180 - 35 - 100', hints: ['קודם $35 + 100$.', '$180 - 135$.'] } },
    { problem: 'במשולש מסוים כל שלוש הזוויות שוות. מה גודל כל אחת?',
      fig: triFromAngles(60, 60, { _A: {}, _B: {}, _C: { text: '?', target: true } }, ['_A', '_B', '_C']),
      steps: [
        { prompt: 'איך מוצאים זווית אחת?', choices: [
          { text: 'מחלקים את $180^\\circ$ לשלושה חלקים שווים', ok: true, feedback: 'נכון: שלוש זוויות שוות ממלאות יחד $180^\\circ$.' },
          { text: 'מחלקים את $360^\\circ$ לשלושה', ok: false, misc: 'sum-360', feedback: 'הזוויות של משולש ממלאות קו ישר, $180^\\circ$, לא סיבוב שלם.' },
          { text: 'כל אחת $90^\\circ$', ok: false, feedback: 'שלוש זוויות ישרות הן $270^\\circ$, יותר מ־$180^\\circ$. במשולש יש לכל היותר זווית ישרה אחת.' },
        ], hints: ['כמה הן שלוש הזוויות יחד?', 'יחד $180^\\circ$, ושלושתן שוות.'], done: 'כל זווית היא $180^\\circ : 3$.' },
      ],
      final: { prompt: 'כמה מעלות כל זווית?', answer: 60, check: '180 / 3', hints: ['$180 : 3$.', 'בדקו: שלוש פעמים התשובה צריך לתת $180$.'] } },
  ],
  diag: triModel,
  transfer: triStory,
  misconceptions: [
    { id: 'sum-360', title: 'השתמשו ב־$360^\\circ$ במקום ב־$180^\\circ$',
      cause: 'המספר $360^\\circ$ מוכר מסיבוב שלם, וקל להתבלבל. אבל שלוש הפינות של משולש ממלאות רק חצי סיבוב: קו ישר.',
      explain: [
        'כשמצמידים את שלוש הפינות של משולש, הן יוצרות קו ישר. קו ישר הוא חצי סיבוב: $180^\\circ$.',
        'סימן אזהרה: זווית של משולש תמיד קטנה מ־$180^\\circ$. אם יצאה זווית גדולה יותר, משהו לא בסדר.',
      ],
      remedy: [
        { kind: 'explore', text: 'גררו את $C$ לכמה מקומות ושימו לב לסכום. עצרו כשהזווית $C$ ישרה.', manip: tri([4, 1]), answer: [0, 5],
          hint: 'הזיזו את $C$ אל מעל האמצע של $AB$ ונסו גבהים שונים.', success: 'בכל מקום שגררתם, הסכום היה $180^\\circ$, לא $360^\\circ$.' },
        { kind: 'predict', text: 'במשולש $\\sphericalangle A = 80^\\circ$ ו־$\\sphericalangle B = 60^\\circ$. מישהו ענה $\\sphericalangle C = 220^\\circ$. מה הטעות?',
          choices: ['זווית של $220^\\circ$ גדולה מקו ישר, ולא יכולה להיות פינה של משולש', 'אין טעות'], answer: 0,
          why: 'הוא השתמש ב־$360^\\circ$. הנכון: $180^\\circ - 80^\\circ - 60^\\circ = 40^\\circ$.' },
      ] },
    { id: 'other-vertex', title: 'חיברו ל־$180^\\circ$ שתי זוויות בקודקודים שונים',
      cause: 'כשקטע מחלק את המשולש, זווית בקודקוד אחד וזווית בקודקוד אחר יכולות להיראות כמו זוג. אבל רק זוויות צמודות, באותו קודקוד ועל ישר אחד, משלימות זו את זו ל־$180^\\circ$.',
      explain: [
        '$\\beta$ בקודקוד $B$, והזווית הנתונה בקודקוד $D$. אין להן קודקוד משותף, ולכן הן לא זוג.',
        'הזווית שצמודה לזווית ב־$D$ היא השנייה באותו קודקוד, $\\sphericalangle ADB$. היא נכנסת למשולש $ABD$ יחד עם $\\beta$.',
      ],
      remedy: [
        { kind: 'predict', fig: splitTri(45, 64, { ADC: { text: '64°' }, B: { text: 'β', target: true } }, { dots: ['B', 'D'] }),
          text: 'במשולש $ABC$ הזווית ב־$C$ ישרה, ו־$D$ על $BC$. האם ל־$\\beta$ ול־$64^\\circ$ יש קודקוד משותף?',
          choices: ['לא: $\\beta$ בקודקוד $B$, ו־$64^\\circ$ בקודקוד $D$', 'כן'], answer: 0,
          why: 'זוויות שמשלימות זו את זו ל־$180^\\circ$ על ישר הן צמודות: יש להן קודקוד משותף. ל־$\\beta$ ול־$64^\\circ$ אין, ולכן אין סיבה שיחד יהיו $180^\\circ$.' },
        { kind: 'predict', fig: splitTri(45, 64, { ADC: { text: '64°' }, ADB: { text: '?', target: true } }),
          text: 'במשולש $ABC$, ו־$D$ על $BC$: איזו זווית יחד עם $64^\\circ$ היא $180^\\circ$?',
          choices: ['$\\sphericalangle ADB = 116^\\circ$, באותו קודקוד $D$', '$\\beta = 116^\\circ$'], answer: 0,
          why: '$\\sphericalangle ADB$ ו־$\\sphericalangle ADC$ צמודות: קודקוד $D$ משותף, ו־$DB$ ו־$DC$ ישר אחד. $\\sphericalangle ADB$ נכנסת למשולש $ABD$, ושם מוצאים את $\\beta$.' },
      ] },
    { id: 'one-angle', title: 'הורידו מ־$180^\\circ$ רק זווית אחת',
      cause: 'שכחו שגם הזווית השנייה לוקחת חלק מ־$180^\\circ$. במשולש ישר־זווית קל במיוחד לשכוח את הזווית הישרה, כי לא כתוב לידה מספר.',
      explain: [
        '$180^\\circ$ מתחלקות בין שלוש הזוויות. כדי למצוא את החסרה, מורידים את שתי האחרות.',
        'במשולש ישר־זווית, הזווית הישרה היא אחת מהן: $90^\\circ$, גם אם לא כתוב.',
      ],
      remedy: [
        { kind: 'explore', text: 'במשולש ישר־זווית $\\sphericalangle A = 35^\\circ$. שתי הפינות הידועות על הישר: $90^\\circ + 35^\\circ = 125^\\circ$. סובבו את הקרן כך שהזווית השמאלית תהיה $125^\\circ$.', ...turn(125, 90, NO_LETTERS),
          hint: 'הימנית היא הזווית השלישית: מה שנשאר עד $180^\\circ$.', success: 'נשארו $55^\\circ$ לזווית השלישית. בלי הזווית הישרה הייתם מקבלים $145^\\circ$, ואז הסכום היה $90 + 35 + 145 = 270$, הרבה יותר מ־$180^\\circ$.' },
        { kind: 'predict', text: 'במשולש $\\sphericalangle A = 40^\\circ$ ו־$\\sphericalangle B = 70^\\circ$. מה $\\sphericalangle C$?', choices: ['$140^\\circ$', '$70^\\circ$', '$110^\\circ$'], answer: 1,
          why: '$180^\\circ - 40^\\circ - 70^\\circ = 70^\\circ$.',
          wrongWhy: { 0: 'הורדתם רק את $40^\\circ$. גם $70^\\circ$ לוקחת חלק.', 2: 'הורדתם רק את $70^\\circ$. גם $40^\\circ$ לוקחת חלק.' } },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 4: parallel lines

const PAIR = ['מתאימה', 'מתחלפת', 'חד־צדדית'];
// k 0: corresponding; 1: alternate; 2: co-interior; 3: a ray splits the co-interior angle of a into b and the asked
// part (w 0: the given angle left of the transversal, 1: right of it). In a story (parStory) k 3 is a trapezoid's
// two other angles.
type Par = { k: number; a: number; b: number; w: number };
const PAR_KIND = ['corresponding', 'alternate', 'cointerior'];
/** The co-interior angle split by a ray (CURRICULUM-10): a and b never 90°, the part asked neither of them. */
const coSplitParams = (rnd: () => number): Par => {
  for (;;) {
    const a = notRight(rnd, 8, 28); const b = 5 * rint(rnd, 4, 24); const c = 180 - a - b;
    if (c >= 20 && b !== 90 && c !== a && c !== b) return { k: 3, a, b, w: rint(rnd, 0, 1) };
  }
};
/**
 * The drawing of k 3: two parallels and a transversal, the given angle a between the lines at the upper crossing, and
 * at the lower crossing its co-interior angle split by a ray into b and the part asked.
 */
function coSplit(p: Par): GeoFig {
  const t = p.w === 0 ? p.a : 180 - p.a; // the given angle left of the transversal is t; right of it, 180° − t
  // a wide strip: the given angle and the split one are both between the lines, on the same side of the transversal
  const par = parallelLines(t, 4);
  // the given angle between the lines at the upper crossing; below it, the lower crossing's angle on the same side (from
  // up to left, or from right to up), split by the ray: b beside the transversal, the part asked beside the lower line
  const [u0, u1] = par.span('U', p.w === 0 ? 'll' : 'lr');
  const [from, to] = par.span('L', p.w === 0 ? 'ul' : 'ur');
  const at = p.w === 0 ? t + p.b : t - p.b; // b is measured from the transversal
  const M: [number, number] = [Math.round(1.3 * Math.cos((at * Math.PI) / 180) * 1e4) / 1e4, Math.round(1.3 * Math.sin((at * Math.PI) / 180) * 1e4) / 1e4];
  const [bFrom, bTo, qFrom, qTo] = p.w === 0 ? [from, '_M', '_M', to] : ['_M', to, from, '_M'];
  return {
    type: 'geo', view: [300, 250], label: `שני ישרים מקבילים וחותך: זווית של ${p.a}° בחיתוך העליון, ובחיתוך התחתון קרן שמחלקת את הזווית החד־צדדית לה ל־${p.b}° ולחלק המסומן ב־?`,
    pts: { ...par.pts, _M: M }, segs: [...par.segs, { a: '_L', b: '_M', hi: true }], dots: ['_U', '_L'],
    angles: [
      { at: '_U', from: u0, to: u1, r: 20, text: `${p.a}°` },
      { at: '_L', from: bFrom, to: bTo, r: 24, text: `${p.b}°` },
      { at: '_L', from: qFrom, to: qTo, r: 34, text: '?', target: true },
    ],
  } as GeoFig;
}
const parModel: DiagModel<Par> = {
  params: (rnd) => (rnd() < 0.25 ? coSplitParams(rnd) : { k: rint(rnd, 0, 2), a: notRight(rnd, 6, 30), b: 0, w: 0 }),
  // a check asks the two-step kind only: copying the angle, or 180° minus it, never passes it (CURRICULUM-10)
  testParams: coSplitParams,
  // the drawing marks the given angle and the one asked for, as the exercises do
  fig: (p) => (p.k === 3 ? coSplit(p) : { type: 'parallel', a: p.a, kind: PAR_KIND[p.k] }),
  text: (p) => (p.k === 3
    ? `שני ישרים מקבילים נחתכים על ידי ישר שלישי. אחת הזוויות היא $${d(p.a)}$. קרן מחלקת את הזווית החד־צדדית לה לשני חלקים, ואחד מהם $${d(p.b)}$. מה גודל החלק השני?`
    : `שני ישרים מקבילים נחתכים על ידי ישר שלישי. אחת הזוויות היא $${d(p.a)}$. מה גודל הזווית ה${PAIR[p.k]} לה?`),
  answer: (p) => (p.k === 3 ? 180 - p.a - p.b : p.k === 2 ? 180 - p.a : p.a),
  bugs: {
    // corresponding or alternate angles completed to 180°
    'supp-not-equal': (p) => (p.k < 2 ? 180 - p.a : null),
    // co-interior angles taken as equal (k 3: the split angle taken as a, so the part left is a − b)
    'equal-not-supp': (p) => (p.k === 2 ? p.a : p.k === 3 && p.a > p.b ? p.a - p.b : null),
  },
  solution: (p) => [
    [`זוויות מתאימות בין ישרים מקבילים שוות: החיתוך השני הוא העתק של הראשון. התשובה: $${d(p.a)}$.`],
    ['הזווית המתחלפת קודקודית לזווית המתאימה של הנתונה.', `קודקודית שווה ומתאימה שווה, ולכן מתחלפות שוות: $${d(p.a)}$.`],
    ['הזווית החד־צדדית צמודה לזווית המתאימה של הנתונה, ולכן יחד הן $180^\\circ$.', `$180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$`],
    ['הזווית שהקרן מחלקת חד־צדדית לזווית הנתונה, ולכן יחד הן $180^\\circ$.', `כל הזווית: $180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$. החלק השני: $${d(180 - p.a)} - ${d(p.b)} = ${d(180 - p.a - p.b)}$`],
  ][p.k],
  hint: (p) => [
    'מתאימות: באותו מקום בשני החיתוכים. מחליקים חיתוך אחד לאורך החותך עד השני.',
    'מתחלפות: בין הישרים, בצדדים שונים של החותך (צורת $Z$).',
    'חד־צדדיות: בין הישרים, באותו צד של החותך (צורת $C$). אחת חדה ואחת קהה.',
    'קודם מוצאים את כל הזווית שהקרן מחלקת: היא חד־צדדית לזווית הנתונה. אחר כך מורידים ממנה את החלק הידוע.',
  ][p.k],
  unit: 'מעלות',
};

/** A trapezoid's angles at the ends of one base, a and b (CURRICULUM-10): never 90°, nor adding to 180°, and the sum asked neither. */
const trapezoidParams = (rnd: () => number): Par => {
  for (;;) {
    const a = notRight(rnd, 8, 28); const b = notRight(rnd, 8, 28); const c = 360 - a - b;
    if (a + b !== 180 && c !== a && c !== b) return { k: 3, a, b, w: 0 };
  }
};
const parStory: DiagModel<Par> = {
  // a trapezoid's two angles on one leg, the letter Z, parallel sun rays falling on flat ground; a trapezoid's other two angles
  params: (rnd) => {
    if (rnd() < 0.25) return trapezoidParams(rnd);
    const k = rint(rnd, 0, 2);
    if (k === 0) return { k, a: notRight(rnd, 9, 26), b: 0, w: 0 };
    if (k === 1) return { k, a: 5 * rint(rnd, 6, 15), b: 0, w: 0 };
    return { k, a: 5 * rint(rnd, 6, 14), b: 0, w: 0 };
  },
  // a check asks the two-step story only: both legs of the trapezoid (CURRICULUM-10)
  testParams: trapezoidParams,
  text: (p) => [
    `בטרפז $ABCD$ הבסיסים $AB$ ו־$CD$ מקבילים, ו־$AD$ היא שוק. $\\sphericalangle A = ${d(p.a)}$. מה גודל $\\sphericalangle D$?`,
    `באות $Z$ הקו העליון והקו התחתון מקבילים, והאלכסון מחבר ביניהם. הזווית בפינה העליונה, בין הקו העליון לאלכסון, היא $${d(p.a)}$. מה הזווית בפינה התחתונה, בין האלכסון לקו התחתון?`,
    `קרני השמש מקבילות זו לזו. קרן אחת פוגעת בקרקע השטוחה, והזווית בינה לבין הקרקע, בצד המזרחי, היא $${d(p.a)}$. מה הזווית בין קרן אחרת לבין הקרקע, גם בצד המזרחי?`,
    `בטרפז $ABCD$ הבסיסים $AB$ ו־$CD$ מקבילים. $\\sphericalangle A = ${d(p.a)}$ ו־$\\sphericalangle B = ${d(p.b)}$. מה הסכום $\\sphericalangle C + \\sphericalangle D$?`,
  ][p.k],
  answer: (p) => (p.k === 3 ? 360 - p.a - p.b : p.k === 0 ? 180 - p.a : p.a),
  bugs: {
    'supp-not-equal': (p) => (p.k === 1 || p.k === 2 ? 180 - p.a : null),
    // co-interior angles taken as equal (k 3: the angle at D taken as A's and the angle at C as B's)
    'equal-not-supp': (p) => (p.k === 0 ? p.a : p.k === 3 ? p.a + p.b : null),
  },
  solution: (p) => [
    ['השוק $AD$ חותכת את שני הבסיסים המקבילים, ו־$\\sphericalangle A$, $\\sphericalangle D$ נמצאות ביניהם, באותו צד של השוק: חד־צדדיות.', `$\\sphericalangle D = 180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$`],
    ['האלכסון חותך שני ישרים מקבילים, ושתי הפינות נמצאות ביניהם, בצדדים שונים של האלכסון: זוויות מתחלפות.', `מתחלפות שוות: $${d(p.a)}$.`],
    ['הקרקע חותכת את שתי הקרניים המקבילות, ושתי הזוויות נמצאות באותו מקום בשני החיתוכים: זוויות מתאימות.', `מתאימות שוות: $${d(p.a)}$.`],
    ['כל שוק חותכת את הבסיסים המקבילים: ליד $AD$ הזוויות $\\sphericalangle A$ ו־$\\sphericalangle D$ חד־צדדיות, וליד $BC$ הזוויות $\\sphericalangle B$ ו־$\\sphericalangle C$.',
      `$\\sphericalangle D = 180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$, $\\sphericalangle C = 180^\\circ - ${d(p.b)} = ${d(180 - p.b)}$. יחד: $${d(360 - p.a - p.b)}$`],
  ][p.k],
  hint: (p) => [
    'מי מקבילים כאן, ומי החותך? הבסיסים מקבילים, והשוק חותכת אותם.',
    'הקווים העליון והתחתון מקבילים, והאלכסון הוא החותך. איפה כל פינה, ביחס לאלכסון?',
    'הקרניים הן הישרים המקבילים, והקרקע היא החותך.',
    'כל שוק של הטרפז חותכת את שני הבסיסים המקבילים. אילו זוויות חד־צדדיות יש ליד כל שוק?',
  ][p.k],
  unit: 'מעלות',
};

const stair4: StairContent = {
  skill: 'angles:4', topic: 'angles', level: 4, title: 'ישרים מקבילים',
  objectives: [
    'לזהות זוויות מתאימות, מתחלפות וחד־צדדיות בין שני ישרים מקבילים וחותך.',
    'להבין למה בין ישרים מקבילים מתאימות ומתחלפות שוות, וחד־צדדיות משלימות ל־$180^\\circ$.',
    'למצוא זווית בחיתוך אחד מזווית בחיתוך השני.',
  ],
  idea: 'כשישר חותך שני ישרים מקבילים, החיתוך השני הוא העתק של הראשון: מחליקים את הישר העליון לאורך החותך והוא נוחת על התחתון. מכאן כל השאר: זווית מול זווית שוות, וזווית ליד זווית משלימות ל־$180^\\circ$.',
  why: [
    'ישרים מקבילים הולכים באותו כיוון. החותך פוגש את שניהם באותה הטיה, ולכן כל זווית בחיתוך אחד חוזרת באותו מקום בחיתוך השני: זוויות מתאימות שוות.',
    'זווית מתחלפת היא קודקודית לזווית המתאימה. קודקודית שווה ומתאימה שווה, ולכן מתחלפות שוות.',
    'זווית חד־צדדית צמודה לזווית המתאימה. לכן זוויות חד־צדדיות משלימות זו את זו ל־$180^\\circ$.',
  ],
  alt: [
    'חשבו על כביש שחוצה באלכסון שתי מסילות רכבת. המסילות מקבילות, ולכן הכביש פוגש את שתיהן באותה הטיה בדיוק.',
    'צורות של אותיות עוזרות לזכור: מתאימות יוצרות צורת $F$, מתחלפות צורת $Z$, וחד־צדדיות צורת $C$.',
    'בין שני מקבילים וחותך יש שמונה זוויות, אבל רק שני גדלים: זווית חדה אחת וזווית קהה אחת, שיחד הן $180^\\circ$. זוג שבו שתיהן חדות (או שתיהן קהות) שווה. זוג של חדה וקהה משלים ל־$180^\\circ$.',
  ],
  discover: [
    { kind: 'say', fig: parallels(55, [], { words: [{ at: '_t1', text: 'חותך', dx: 30, dy: 4 }] }), mood: 'happy', text: 'שני ישרים מקבילים לא נפגשים לעולם, כמו שתי מסילות של רכבת. ישר שלישי, החותך, חוצה את שניהם. נוצרות שתי נקודות חיתוך, ובכל אחת ארבע זוויות.' },
    { kind: 'predict', fig: parallels(55, [{ at: 'U', pos: 'ur' }, { at: 'U', pos: 'ul', n: 2 }, { at: 'U', pos: 'll' }, { at: 'U', pos: 'lr', n: 2 }], { slide: true }), text: 'נחליק את הישר העליון למטה לאורך החותך, בלי לסובב אותו, עד שהוא נוחת על הישר התחתון. מה יקרה לארבע הזוויות שלו?',
      choices: ['הן יישארו בדיוק אותן זוויות', 'הן יגדלו', 'הן יקטנו'], answer: 0,
      why: 'הישר רק זז, הוא לא מסתובב, ולכן הוא חוצה את החותך באותה הטיה. הוא נוחת בדיוק על הישר התחתון, וכל זווית נוחתת על התאומה שלה.',
      wrongWhy: { 1: 'הישר לא מסתובב, רק זז. בלי סיבוב, אף זווית לא נפתחת.', 2: 'הישר לא מסתובב, רק זז. בלי סיבוב, אף זווית לא נסגרת.' } },
    { kind: 'say', fig: { type: 'parallel', a: 55, kind: 'corresponding' }, text: 'שתי זוויות שנמצאות באותו מקום בשני החיתוכים, למשל שתיהן מעל הישר שלהן ומימין לחותך, כמו בשרטוט, נקראות זוויות מתאימות. בין ישרים מקבילים הן שוות.' },
    { kind: 'explore', text: 'בחיתוך העליון, הזווית מעל הישר ומשמאל לחותך היא $125^\\circ$. על המסך רואים את החיתוך התחתון: הישר התחתון, והחותך יוצא ממנו למעלה. הזווית השמאלית היא המתאימה. סובבו את הקרן כך שהיא תהיה $125^\\circ$.',
      ...turn(125), hint: 'מתאימות שוות, אז השמאלית צריכה להיות $125^\\circ$. הימנית צמודה לה: כמה היא?',
      success: 'השמאלית $125^\\circ$, כמו התאומה שלה למעלה, והימנית $55^\\circ$. החיתוך התחתון הוא העתק של העליון.' },
    { kind: 'say', fig: { type: 'parallel', a: 55, kind: 'alternate' }, text: 'בין שני הישרים יש ארבע זוויות, שתיים בכל חיתוך. זוויות מתחלפות: אחת מכל חיתוך, בצדדים שונים של החותך (צורת $Z$). זוויות חד־צדדיות: אחת מכל חיתוך, באותו צד של החותך (צורת $C$).' },
    { kind: 'predict', fig: parallels(55, [{ at: 'U', pos: 'ul', text: '125°' }, { at: 'U', pos: 'lr', n: 2 }, { at: 'L', pos: 'ul', text: '?', target: true }]), text: 'בחיתוך העליון, הזווית שמול ה־$125^\\circ$ נמצאת בין הישרים, מימין לחותך. המתחלפת שלה בחיתוך התחתון היא בין הישרים, משמאל לחותך: הזווית השמאלית שעל המסך. מה הקשר ביניהן?',
      choices: ['הן שוות: שתיהן $125^\\circ$', 'יחד הן $180^\\circ$'], answer: 0,
      why: 'הזווית למעלה קודקודית ל־$125^\\circ$, ולכן גם היא $125^\\circ$. הזווית השמאלית שעל המסך מתאימה ל־$125^\\circ$, ולכן גם היא $125^\\circ$. שוויון אחרי שוויון: זוויות מתחלפות שוות.',
      wrongWhy: { 1: 'זה הכלל של זוויות חד־צדדיות. מתחלפות, משני צדי החותך, שוות.' } },
    { kind: 'predict', fig: parallels(55, [{ at: 'U', pos: 'lr', text: '125°', n: 2 }, { at: 'L', pos: 'ur', text: '?', target: true }]), text: 'ומה החד־צדדית שלה: בחיתוך התחתון, בין הישרים, מימין לחותך? זו הזווית הימנית שעל המסך.',
      choices: ['$125^\\circ$', '$55^\\circ$'], answer: 1,
      why: 'היא צמודה לזווית השמאלית, ולכן $180^\\circ - 125^\\circ = 55^\\circ$. יחד עם $125^\\circ$ שלמעלה: $180^\\circ$. זוויות חד־צדדיות משלימות זו את זו.',
      wrongWhy: { 0: '$125^\\circ$ היא הזווית השמאלית. הימנית צמודה לה, ויחד הן $180^\\circ$.' } },
    { kind: 'rule', fig: { type: 'parallel', a: 60, kind: 'cointerior' }, text: 'הכלל: בין שני ישרים מקבילים, זוויות מתאימות שוות, זוויות מתחלפות שוות, וזוויות חד־צדדיות משלימות זו את זו ל־$180^\\circ$.',
      why: 'מתאימות שוות כי החיתוך התחתון הוא העתק של העליון. מתחלפת היא קודקודית של המתאימה, ולכן שווה. חד־צדדית צמודה למתאימה, ולכן משלימה ל־$180^\\circ$.' },
    { kind: 'explore', text: 'עכשיו לבד: בחיתוך העליון, הזווית בין הישרים ומימין לחותך היא $110^\\circ$. על המסך, החיתוך התחתון: השמאלית מתחלפת לה, והימנית חד־צדדית לה. סובבו את הקרן למקום הנכון.',
      ...turn(110), hint: 'מתחלפות שוות: השמאלית צריכה להיות $110^\\circ$. אז הימנית היא $180^\\circ - 110^\\circ$.',
      success: 'השמאלית $110^\\circ$ (מתחלפת, שווה) והימנית $70^\\circ$ (חד־צדדית): $110^\\circ + 70^\\circ = 180^\\circ$.' },
    { kind: 'predict', fig: parallels(55, [{ at: 'U', pos: 'ur', text: '?', target: true }, { at: 'L', pos: 'ur', text: '?', target: true }], { tilt: 14 }), text: 'ואם הישרים לא מקבילים? האם זוויות מתאימות עדיין שוות?', choices: ['כן, תמיד', 'לא בהכרח'], answer: 1,
      why: 'אם מסובבים קצת את אחד הישרים, הזווית שלו עם החותך משתנה, והזווית בחיתוך השני לא. הכללים עובדים רק בין מקבילים. וגם להפך: אם זוויות מתאימות שוות, הישרים מקבילים.',
      wrongWhy: { 0: 'סובבו קצת את אחד הישרים: הזווית שלו משתנה, והשנייה לא. הכלל רק בין מקבילים.' } },
  ],
  examples: [
    { problem: 'שני ישרים מקבילים נחתכים על ידי ישר שלישי. אחת הזוויות בין הישרים היא $64^\\circ$. מה גודל הזווית החד־צדדית לה?', answer: 116, check: '180 - 64',
      fig: parallels(64, [{ at: 'L', pos: 'ur', text: '64°' }, { at: 'U', pos: 'lr', text: '?', target: true }]),
      steps: [
        { action: 'מזהים את הזוג: חד־צדדיות, בין הישרים ובאותו צד של החותך.', why: 'הזוג קובע את הקשר: חד־צדדיות משלימות ל־$180^\\circ$, הן לא שוות.', result: '64^\\circ + x = 180^\\circ' },
        { action: 'למה דווקא $180^\\circ$? הזווית המבוקשת צמודה למתאימה של $64^\\circ$.', why: 'המתאימה בחיתוך השני היא גם $64^\\circ$, והזווית המבוקשת יוצרת איתה קו ישר.', result: 'x = 180^\\circ - 64^\\circ', value: '180 - 64' },
        { action: 'מחשבים: $180 - 60 = 120$, ואז מורידים עוד $4$.', why: 'מחלקים את החיסור לשני חלקים נוחים.', result: 'x = 116^\\circ', value: '116', calc: { expr: '180 - 60 - 4', value: 116 } },
        { action: 'בודקים בעין: אחת חדה ואחת קהה.', why: 'בין מקבילים יש רק שני גדלים של זוויות. זוג שלא שווה הוא תמיד חדה וקהה.', result: '64^\\circ + 116^\\circ = 180^\\circ', calc: { expr: '64 + 116', value: 180 } },
      ] },
    { problem: 'שתי מסילות רכבת מקבילות עוברות ממזרח למערב, וכביש ישר חוצה אותן באלכסון. במסילה הצפונית, הזווית שמצפון למסילה וממזרח לכביש היא $47^\\circ$. מה הזווית במסילה הדרומית, מצפון למסילה וממערב לכביש?', answer: 133, check: '180 - 47',
      fig: parallels(47, [{ at: 'U', pos: 'ur', text: '47°' }, { at: 'L', pos: 'ul', text: '?', target: true }]),
      steps: [
        { action: 'מעבירים את הזווית לחיתוך הדרומי: המתאימה לה, מצפון למסילה הדרומית וממזרח לכביש, היא גם $47^\\circ$.', why: 'המסילות מקבילות, וזוויות מתאימות שוות.', result: '47^\\circ' },
        { action: 'הזווית המבוקשת צמודה לזווית הזאת: שתיהן מצפון למסילה הדרומית, משני צדי הכביש.', why: 'יחד הן ממלאות את הקו הישר של המסילה.', result: 'x = 180^\\circ - 47^\\circ', value: '180 - 47' },
        { action: 'מחשבים.', why: 'יוצאת זווית קהה, ליד זווית חדה של $47^\\circ$.', result: 'x = 133^\\circ', value: '133' },
        { action: 'בודקים בדרך אחרת: הזווית שמדרום למסילה הצפונית וממערב לכביש היא קודקודית ל־$47^\\circ$, והיא חד־צדדית לזווית המבוקשת.', why: 'שתיהן בין המסילות, ממערב לכביש. לכן יחד הן צריכות לתת $180^\\circ$.', result: '47^\\circ + 133^\\circ = 180^\\circ', calc: { expr: '47 + 133', value: 180 } },
      ] },
    // CURRICULUM-10: a question of two steps (a check asks such questions), solved in two written steps and checked
    { problem: 'שני ישרים מקבילים. הקודקוד העליון של המשולש על הישר העליון, והבסיס על הישר התחתון. על הישר העליון, משמאל לקודקוד, הזווית בין הישר לצלע השמאלית היא $65^\\circ$. זווית הבסיס הימנית היא $55^\\circ$. מה גודל זווית הראש?',
      fig: parallelTriangleFig(65, 55, false), answer: 60, check: '180 - 65 - 55',
      steps: [
        { action: 'שלב 1: מעבירים את $65^\\circ$ אל המשולש. זווית הבסיס השמאלית מתחלפת לה, ולכן גם היא $65^\\circ$.', why: 'הצלע השמאלית חותכת את שני הישרים המקבילים. שתי הזוויות נמצאות ביניהם, משני צדי הצלע: זוויות מתחלפות שוות.', result: '65^\\circ + 55^\\circ + x = 180^\\circ' },
        { action: 'שלב 2: סכום הזוויות במשולש הוא $180^\\circ$. מורידים את שתי זוויות הבסיס.', why: 'זווית הראש היא מה שנשאר.', result: 'x = 180^\\circ - 65^\\circ - 55^\\circ = 60^\\circ', value: '180 - 65 - 55' },
        { action: 'בודקים בדרך אחרת: שלוש הזוויות שליד הקודקוד העליון, על הישר העליון.', why: 'משמאל $65^\\circ$, באמצע זווית הראש, ומימין זווית שמתחלפת ל־$55^\\circ$. יחד הן קו ישר.', result: '65^\\circ + 60^\\circ + 55^\\circ = 180^\\circ', calc: { expr: '65 + 60 + 55', value: 180 } },
      ] },
  ],
  together: [
    { problem: 'שני ישרים מקבילים וחותך. בחיתוך העליון, הזווית בין הישרים ומשמאל לחותך היא $72^\\circ$. מה הזווית בחיתוך התחתון, בין הישרים ומשמאל לחותך?',
      fig: parallels(72, [{ at: 'U', pos: 'll', text: '72°' }, { at: 'L', pos: 'ul', text: '?', target: true }]),
      steps: [
        { prompt: 'איך נקרא הזוג הזה?', choices: [
          { text: 'זוויות חד־צדדיות', ok: true, feedback: 'נכון: שתיהן בין הישרים, ושתיהן משמאל לחותך.' },
          { text: 'זוויות מתחלפות', ok: false, feedback: 'מתחלפות נמצאות בצדדים שונים של החותך. שתי אלה באותו צד.' },
          { text: 'זוויות מתאימות', ok: false, feedback: 'מתאימות נמצאות באותו מקום בשני החיתוכים. כאן אחת מתחת לישר העליון, והשנייה מעל הישר התחתון.' },
        ], hints: ['שתיהן בין הישרים. האם הן באותו צד של החותך?', 'בין הישרים ובאותו צד של החותך: צורת $C$.'], done: 'הן חד־צדדיות.' },
        { prompt: 'מה הקשר בין זוויות חד־צדדיות?', choices: [
          { text: 'יחד $180^\\circ$', ok: true, feedback: 'נכון: אחת מהן צמודה למתאימה של השנייה.' },
          { text: 'הן שוות', ok: false, misc: 'equal-not-supp', feedback: 'שוות הן המתאימות והמתחלפות. בצורת $C$ אחת חדה ואחת קהה.' },
          { text: 'יחד $90^\\circ$', ok: false, feedback: 'הן יחד קו ישר, לא פינה: $180^\\circ$.' },
        ], hints: ['הזווית המבוקשת צמודה למתאימה של $72^\\circ$.', 'צמודות יחד $180^\\circ$.'], done: '$72^\\circ + x = 180^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות הזווית בחיתוך התחתון?', answer: 108, check: '180 - 72', hints: ['$180 - 70 = 110$.', 'עוד $2$ פחות: $180 - 72$.'] } },
    { problem: 'שני ישרים מקבילים וחותך. בחיתוך העליון, הזווית מעל הישר ומימין לחותך היא $58^\\circ$. מה הזווית בחיתוך התחתון, מעל הישר ומשמאל לחותך?',
      fig: parallels(58, [{ at: 'U', pos: 'ur', text: '58°' }, { at: 'L', pos: 'ul', text: '?', target: true }]),
      steps: [
        { prompt: 'מה הצעד הראשון?', choices: [
          { text: 'להעביר את $58^\\circ$ לחיתוך התחתון: המתאימה לה, מעל הישר ומימין לחותך, גם היא $58^\\circ$', ok: true, feedback: 'נכון: עכשיו יש זווית ידועה באותו חיתוך כמו הזווית המבוקשת.' },
          { text: 'לומר שהמבוקשת מתחלפת ל־$58^\\circ$, ולכן שווה לה', ok: false, feedback: 'מתחלפות נמצאות שתיהן בין הישרים. $58^\\circ$ נמצאת מעל הישר העליון, מחוץ לרצועה שבין הישרים.' },
          { text: 'לומר שהמבוקשת מתאימה ל־$58^\\circ$, ולכן שווה לה', ok: false, feedback: 'מתאימות נמצאות באותו מקום בשני החיתוכים. $58^\\circ$ מימין לחותך, והמבוקשת משמאל לו.' },
        ], hints: ['הנתונה והמבוקשת בחיתוכים שונים ובצדדים שונים של החותך. קודם נביא את הנתונה לחיתוך התחתון.', 'מתאימות שוות: בחיתוך התחתון, מעל הישר ומימין לחותך, יש גם $58^\\circ$.'], done: 'בחיתוך התחתון, מימין לחותך: $58^\\circ$.' },
        { prompt: 'מה הקשר בין $58^\\circ$ שבחיתוך התחתון לבין הזווית המבוקשת?', choices: [
          { text: 'צמודות: יחד $180^\\circ$', ok: true, feedback: 'נכון: שתיהן מעל הישר התחתון, משני צדי החותך.' },
          { text: 'קודקודיות: שוות', ok: false, misc: 'equal-not-supp', feedback: 'קודקודיות עומדות זו מול זו, אחת מעל הישר ואחת מתחתיו. שתי אלה מעל הישר, זו ליד זו.' },
          { text: 'אין ביניהן קשר', ok: false, feedback: 'יש: החותך הוא צלע משותפת לשתיהן, והצלעות האחרות שלהן הן הישר התחתון.' },
        ], hints: ['שתיהן מעל הישר התחתון. הן זו ליד זו או זו מול זו?', 'זו ליד זו על אותו ישר: זוויות צמודות.'], done: '$x = 180^\\circ - 58^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות הזווית המבוקשת?', answer: 122, check: '180 - 58', hints: ['$180 - 60 = 120$.', 'הורדנו $2$ יותר מדי, אז מוסיפים אותן בחזרה.'] } },
  ],
  diag: parModel,
  transfer: parStory,
  misconceptions: [
    { id: 'supp-not-equal', title: 'השלימו ל־$180^\\circ$, אבל הזוויות (מתאימות או מתחלפות) שוות', prereq: 'angles:2',
      cause: 'הכלל של החד־צדדיות, "יחד $180^\\circ$", הופעל על זוג אחר. כשהשמות מתבלבלים, כל זוג נראה "קשור", וקשה לזכור איזה קשר.',
      explain: [
        'מתאימות ומתחלפות הן העתק או קודקודית של אותה פינה: אותה פתיחה בדיוק, ולכן הן שוות.',
        'בדיקה מהירה: בין מקבילים יש רק שני גדלים של זוויות. אם שתי הזוויות חדות, או שתיהן קהות, הן שוות. רק זוג של חדה וקהה משלים ל־$180^\\circ$.',
      ],
      remedy: [
        { kind: 'predict', text: 'בין שני מקבילים וחותך (לא מאונך) יש שמונה זוויות. כמה גדלים שונים יש ביניהן?', choices: ['שמונה', 'ארבעה', 'שניים'], answer: 2,
          why: 'כל חיתוך הוא העתק של השני, ובכל חיתוך יש רק זווית אחת והצמודה לה. לכן ארבע זוויות חדות שוות, ארבע קהות שוות, וכל חדה וקהה יחד $180^\\circ$.' },
        { kind: 'explore', text: 'בחיתוך העליון, הזווית בין הישרים ומשמאל לחותך היא $65^\\circ$. על המסך, החיתוך התחתון: השמאלית חד־צדדית לה, ולכן $115^\\circ$. סובבו את הקרן כך שהשמאלית תהיה $115^\\circ$, וראו מה יוצא במתחלפת, הימנית.', ...turn(115),
          hint: 'הימנית משלימה את $115^\\circ$ ל־$180^\\circ$.', success: 'המתחלפת, הימנית, יצאה $65^\\circ$: שווה לזווית למעלה, לא משלימה אותה.' },
      ] },
    { id: 'equal-not-supp', title: 'ענו שזוויות חד־צדדיות שוות, אבל הן משלימות ל־$180^\\circ$', prereq: 'angles:1',
      cause: 'אחרי "מתאימות שוות" ו"מתחלפות שוות", קל לחשוב שכל זוג בין מקבילים שווה.',
      explain: [
        'זוויות חד־צדדיות נמצאות באותו צד של החותך, בין הישרים, כמו האות $C$. אחת פתוחה למעלה והשנייה פתוחה למטה.',
        'כשהחותך נוטה, אחת מהן חדה והשנייה קהה. לכן הן לא שוות: יחד הן $180^\\circ$.',
      ],
      remedy: [
        { kind: 'predict', text: 'בטרפז הבסיסים מקבילים. ליד אחת השוקיים, הזווית למטה היא $70^\\circ$. מה הזווית למעלה, ליד אותה שוק?', choices: ['$70^\\circ$', '$110^\\circ$'], answer: 1,
          why: 'שתי הזוויות ליד אותה שוק הן חד־צדדיות בין הבסיסים המקבילים: $180^\\circ - 70^\\circ = 110^\\circ$. רואים את זה בטרפז: חדה למטה, קהה למעלה.' },
        { kind: 'explore', text: 'בחיתוך העליון, הזווית בין הישרים ומימין לחותך היא $130^\\circ$. על המסך, החיתוך התחתון: השמאלית מתחלפת לה, ולכן גם היא $130^\\circ$. סובבו את הקרן כך שהשמאלית תהיה $130^\\circ$, וראו מה יוצא בחד־צדדית, הימנית.', ...turn(130),
          hint: 'הימנית משלימה את $130^\\circ$ ל־$180^\\circ$.', success: 'החד־צדדית יצאה $50^\\circ$, ויחד עם $130^\\circ$ זה $180^\\circ$. הן לא שוות, הן משלימות.' },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 5: isosceles triangles and the exterior angle

type Iso = { k: number; a: number; b: number }; // k 0: apex a given; k 1: base angle a given; k 2: exterior angle at C from A = a, B = b
const isoModel: DiagModel<Iso> = {
  params: (rnd) => {
    const r = rnd();
    if (r < 0.35) return { k: 0, a: 10 * rint(rnd, 2, 14), b: 0 };
    if (r < 0.65) return { k: 1, a: 5 * rint(rnd, 6, 17), b: 0 };
    let a = 0; let b = 0;
    do { a = 5 * rint(rnd, 4, 14); b = 5 * rint(rnd, 4, 14); } while (a + b > 140);
    return { k: 2, a, b };
  },
  text: (p) => [
    `במשולש שווה־שוקיים $ABC$ ($AB = AC$) זווית הראש היא $\\sphericalangle A = ${d(p.a)}$. מה גודל זווית הבסיס $\\sphericalangle B$?`,
    `במשולש שווה־שוקיים $ABC$ ($AB = AC$) זווית הבסיס היא $\\sphericalangle B = ${d(p.a)}$. מה גודל זווית הראש $\\sphericalangle A$?`,
    `במשולש $ABC$: $\\sphericalangle A = ${d(p.a)}$ ו־$\\sphericalangle B = ${d(p.b)}$. מה גודל הזווית החיצונית ליד הקודקוד $C$?`,
  ][p.k],
  answer: (p) => [(180 - p.a) / 2, 180 - 2 * p.a, p.a + p.b][p.k],
  bugs: {
    // the apex taken off, but the rest not shared between the two base angles
    'forgot-half': (p) => (p.k === 0 ? 180 - p.a : null),
    // one base angle taken off, as if the other were not equal to it
    'one-angle': (p) => (p.k === 1 ? 180 - p.a : null),
    // the apex treated as a base angle, or a base angle as the apex
    'apex-base-swap': (p) => (p.k === 0 ? (p.a < 90 ? 180 - 2 * p.a : null) : p.k === 1 ? (180 - p.a) / 2 : null),
    // the interior angle at C instead of the exterior one
    'interior-not-exterior': (p) => (p.k === 2 ? 180 - p.a - p.b : null),
  },
  solution: (p) => [
    ['זוויות הבסיס שוות. מורידים את זווית הראש מ־$180^\\circ$:', `$180^\\circ - ${d(p.a)} = ${d(180 - p.a)}$`, `ומחלקים בין שתי זוויות הבסיס: $${180 - p.a} : 2 = ${d((180 - p.a) / 2)}$`],
    [`זוויות הבסיס שוות, ולכן גם $\\sphericalangle C = ${d(p.a)}$.`, `$\\sphericalangle A = 180^\\circ - 2 \\cdot ${d(p.a)} = ${d(180 - 2 * p.a)}$`],
    ['הזווית החיצונית שווה לסכום שתי הזוויות הפנימיות שלא צמודות לה.', `$${d(p.a)} + ${d(p.b)} = ${d(p.a + p.b)}$`],
  ][p.k],
  hint: (p) => [
    'זוויות הבסיס שוות. כמה מעלות נשארות לשתיהן יחד אחרי זווית הראש?',
    `גם זווית הבסיס השנייה היא $${d(p.a)}$. כמה נשאר לזווית הראש?`,
    'הזווית החיצונית צמודה ל־$\\sphericalangle C$. מה עוד משלים את $\\sphericalangle C$ ל־$180^\\circ$?',
  ][p.k],
  unit: 'מעלות',
};

const isoStory: DiagModel<Iso> = {
  // a gable roof, a tent, a runner who turns at the corner of a triangular track (the turn is the exterior angle)
  params: (rnd) => {
    const k = rint(rnd, 0, 2);
    if (k === 0) return { k, a: 10 * rint(rnd, 8, 14), b: 0 };
    if (k === 1) return { k, a: 5 * rint(rnd, 13, 17), b: 0 };
    let a = 0; let b = 0;
    do { a = 5 * rint(rnd, 6, 16); b = 5 * rint(rnd, 6, 16); } while (a + b > 150);
    return { k, a, b };
  },
  text: (p) => [
    `גג של בית בנוי כמשולש שווה־שוקיים: שני צדי הגג שווים באורכם. הזווית בראש הגג היא $${d(p.a)}$. מה הזווית בין צד של הגג לבין התקרה?`,
    `אוהל: שתי יריעות שוות באורכן נפגשות למעלה, וכל יריעה יוצרת עם הקרקע זווית של $${d(p.a)}$. מה הזווית בין היריעות בראש האוהל?`,
    `מסלול ריצה בפארק הוא משולש $ABC$. בפינה $A$ הזווית $${d(p.a)}$, ובפינה $B$ הזווית $${d(p.b)}$. נועה רצה מ־$B$ אל $C$, ובפינה $C$ פנתה אל $A$. בכמה מעלות היא פנתה?`,
  ][p.k],
  answer: (p) => [(180 - p.a) / 2, 180 - 2 * p.a, p.a + p.b][p.k],
  bugs: {
    'forgot-half': (p) => (p.k === 0 ? 180 - p.a : null),
    'one-angle': (p) => (p.k === 1 ? 180 - p.a : null),
    'apex-base-swap': (p) => (p.k === 0 ? (p.a < 90 ? 180 - 2 * p.a : null) : p.k === 1 ? (180 - p.a) / 2 : null),
    'interior-not-exterior': (p) => (p.k === 2 ? 180 - p.a - p.b : null),
  },
  solution: (p) => [
    ['צדי הגג הם השוקיים, והתקרה היא הבסיס. הזווית המבוקשת היא זווית בסיס.', `$(180^\\circ - ${d(p.a)}) : 2 = ${d((180 - p.a) / 2)}$`],
    ['היריעות הן השוקיים, והקרקע היא הבסיס: שתי זוויות בסיס של $' + d(p.a) + '$.', `$180^\\circ - 2 \\cdot ${d(p.a)} = ${d(180 - 2 * p.a)}$`],
    ['אילו המשיכה ישר, הייתה ממשיכה את הצלע $BC$. הפנייה היא הזווית בין ההמשך הזה לבין $CA$: הזווית החיצונית ליד $C$.', `$${d(p.a)} + ${d(p.b)} = ${d(p.a + p.b)}$`],
  ][p.k],
  hint: (p) => [
    'זוויות הבסיס של הגג שוות. מה נשאר להן מ־$180^\\circ$, ואיך מתחלקים?',
    'שתי הזוויות ליד הקרקע שוות. כמה הן לוקחות יחד?',
    'אילו הרצה לא הייתה פונה, היא הייתה ממשיכה ישר. הפנייה היא הזווית בין הכיוון הזה לבין הכיוון החדש.',
  ][p.k],
  unit: 'מעלות',
};

const stair5: StairContent = {
  skill: 'angles:5', topic: 'angles', level: 5, title: 'שווה־שוקיים וזווית חיצונית',
  objectives: [
    'במשולש שווה־שוקיים: לדעת שזוויות הבסיס שוות, ולמצוא זווית בסיס מזווית הראש, או להפך.',
    'להכיר זווית חיצונית של משולש ולמצוא אותה.',
    'להבין למה זווית חיצונית שווה לסכום שתי הזוויות הפנימיות שלא צמודות לה.',
  ],
  idea: 'במשולש שווה־שוקיים, קיפול לאורך ציר הסימטריה מניח זווית בסיס אחת על השנייה, ולכן הן שוות. זווית חיצונית משלימה את הזווית הפנימית שלידה ל־$180^\\circ$, בדיוק כמו שתי הזוויות הפנימיות האחרות, ולכן היא שווה לסכום שלהן.',
  why: [
    'משולש שווה־שוקיים מתקפל לאורך הקו שיורד מזווית הראש לאמצע הבסיס. השוקיים נופלות זו על זו, וזווית בסיס אחת מכסה בדיוק את השנייה.',
    'הזווית החיצונית ליד $C$ והזווית הפנימית $\\sphericalangle C$ יוצרות יחד קו ישר: $180^\\circ$.',
    'גם $\\sphericalangle A + \\sphericalangle B$ משלימות את $\\sphericalangle C$ ל־$180^\\circ$, כי זה סכום הזוויות במשולש. שני דברים שמשלימים את אותה זווית ל־$180^\\circ$ שווים, ולכן הזווית החיצונית שווה ל־$\\sphericalangle A + \\sphericalangle B$.',
  ],
  alt: [
    'גג של בית הוא לרוב משולש שווה־שוקיים: שני צדי הגג שווים, ולכן שניהם נוטים באותה זווית.',
    'זווית חיצונית היא כמה פונים בפינה. הולכים לאורך צלע, מגיעים לפינה $C$, ופונים אל הצלע הבאה: הפנייה היא הזווית החיצונית. ככל שהפינה חדה יותר, הפנייה גדולה יותר.',
    'זה אותו רעיון כמו בזוויות קודקודיות: שם שתי זוויות השלימו את אותה זווית ל־$180^\\circ$, ולכן היו שוות. כאן הזווית החיצונית ו־$\\sphericalangle A + \\sphericalangle B$ משלימות שתיהן את $\\sphericalangle C$.',
  ],
  discover: [
    { kind: 'say', fig: isosceles(44, { top: {}, left: { n: 2 }, right: { n: 2 } }, { words: true }), mood: 'happy', text: 'משולש שווה־שוקיים הוא משולש עם שתי צלעות שוות, השוקיים. הצלע השלישית היא הבסיס. הזווית שבין השוקיים היא זווית הראש, ושתי האחרות, ליד הבסיס, הן זוויות הבסיס.' },
    { kind: 'predict', fig: isosceles(44, { left: { n: 2 }, right: { n: 2 } }, { fold: true }), text: 'גוזרים משולש שווה־שוקיים ומקפלים אותו כך שהשוקיים נופלות זו על זו. מה קורה לזוויות הבסיס?',
      choices: ['אחת מכסה בדיוק את השנייה', 'אחת בולטת מעבר לשנייה', 'אי אפשר לדעת'], answer: 0,
      why: 'הקיפול מניח שוק על שוק וחצי בסיס על חצי בסיס. כל זווית בסיס נוחתת על השנייה, ולכן זוויות הבסיס שוות.',
      wrongWhy: { 1: 'השוקיים שוות, ולכן הקיפול מניח שוק בדיוק על שוק. שום פינה לא בולטת.', 2: 'אפשר: מקפלים ורואים. השוקיים נופלות זו על זו, וגם הפינות.' } },
    { kind: 'predict', fig: isosceles(40, { top: { text: '40°' }, left: { text: '?', target: true, n: 2 }, right: { text: '?', target: true, n: 2 } }), text: 'זווית הראש היא $40^\\circ$. כמה מעלות נשארות לשתי זוויות הבסיס יחד?', choices: ['$140^\\circ$', '$70^\\circ$', '$320^\\circ$'], answer: 0,
      why: '$180^\\circ - 40^\\circ = 140^\\circ$ לשתיהן יחד. כל אחת מהן היא חצי מזה.',
      wrongWhy: { 1: '$70^\\circ$ היא כל זווית בסיס לבדה. יחד הן פי $2$.', 2: 'סכום הזוויות במשולש הוא $180^\\circ$, לא $360^\\circ$.' } },
    { kind: 'explore', text: 'נניח את הפינות על ישר: זווית הראש, $40^\\circ$, משמאל. סובבו את הקרן כך שהזווית השמאלית תהיה $40^\\circ$. הזווית הימנית היא שתי זוויות הבסיס יחד.',
      ...turn(40, 90, NO_LETTERS), hint: 'הימנית היא מה שנשאר מ־$180^\\circ$ אחרי זווית הראש.',
      success: 'הימנית $140^\\circ$: שתי זוויות הבסיס יחד. הן שוות, ולכן כל אחת $140^\\circ : 2 = 70^\\circ$.' },
    { kind: 'rule', fig: isosceles(44, { top: {}, left: { n: 2 }, right: { n: 2 } }, { names: ['B', 'C', 'A'] }), text: 'הכלל: במשולש שווה־שוקיים זוויות הבסיס שוות. מזווית הראש, כל זווית בסיס היא $180^\\circ$ פחות הראש, חלקי $2$.', display: '\\sphericalangle B = \\sphericalangle C = \\dfrac{180^\\circ - \\sphericalangle A}{2}',
      why: 'הקיפול מראה שזוויות הבסיס שוות. אחרי שמורידים את זווית הראש מ־$180^\\circ$, מה שנשאר מתחלק שווה בשווה בין שתיהן.' },
    { kind: 'predict', fig: isosceles(50, { left: { text: '65°', n: 2 }, right: { n: 2 }, top: { text: '?', target: true } }), text: 'ועכשיו הפוך: זווית בסיס היא $65^\\circ$. מה זווית הראש?', choices: ['$115^\\circ$', '$50^\\circ$', '$57.5^\\circ$'], answer: 1,
      why: 'שתי זוויות הבסיס שוות: $65^\\circ + 65^\\circ = 130^\\circ$. לזווית הראש נשאר $180^\\circ - 130^\\circ = 50^\\circ$.',
      wrongWhy: { 0: '$115^\\circ$ יוצא כשמורידים רק זווית בסיס אחת. יש שתיים, ושתיהן $65^\\circ$.', 2: 'זה החישוב של זווית בסיס מזווית הראש. כאן נתונה זווית בסיס.' } },
    { kind: 'say', fig: exterior(50, 60, { ext: { target: true } }), text: 'עכשיו זווית חדשה. ממשיכים את הצלע $BC$ מעבר לקודקוד $C$. הזווית בין ההמשך לבין הצלע $CA$ נמצאת מחוץ למשולש: זו זווית חיצונית.' },
    { kind: 'explore', text: 'במשולש $\\sphericalangle A = 50^\\circ$ ו־$\\sphericalangle B = 60^\\circ$, ולכן $\\sphericalangle C = 70^\\circ$. על המסך, הקו הוא $BC$ עם ההמשך שלו, והקרן היא $CA$. סובבו את הקרן כך שהזווית השמאלית, הפנימית $\\sphericalangle C$, תהיה $70^\\circ$.',
      ...turn(70, 90, AT_C), hint: 'הזווית הימנית היא החיצונית. יחד עם $\\sphericalangle C$ היא קו ישר.',
      success: 'הזווית החיצונית $110^\\circ$. ושימו לב: $50^\\circ + 60^\\circ = 110^\\circ$, בדיוק $\\sphericalangle A + \\sphericalangle B$.' },
    { kind: 'predict', fig: exterior(30, 45, { A: { text: '30°' }, B: { text: '45°', n: 2 }, ext: { text: '?', target: true } }), text: 'צירוף מקרים? במשולש אחר $\\sphericalangle A = 30^\\circ$ ו־$\\sphericalangle B = 45^\\circ$. מה הזווית החיצונית ליד $C$?', choices: ['$75^\\circ$', '$105^\\circ$', '$150^\\circ$'], answer: 0,
      why: '$\\sphericalangle C = 180^\\circ - 75^\\circ = 105^\\circ$, והחיצונית $180^\\circ - 105^\\circ = 75^\\circ$. שוב $\\sphericalangle A + \\sphericalangle B$: גם החיצונית וגם $\\sphericalangle A + \\sphericalangle B$ משלימות את $\\sphericalangle C$ ל־$180^\\circ$.',
      wrongWhy: { 1: '$105^\\circ$ היא הזווית הפנימית $\\sphericalangle C$. החיצונית צמודה לה.', 2: '$150^\\circ$ משלימה רק את $\\sphericalangle A$ ל־$180^\\circ$. החיצונית ליד $C$ צמודה ל־$\\sphericalangle C$.' } },
    { kind: 'rule', fig: exterior(50, 60, { A: {}, B: { n: 2 }, ext: { target: true } }), text: 'הכלל: זווית חיצונית של משולש שווה לסכום שתי הזוויות הפנימיות שלא צמודות לה.', display: '180^\\circ - \\sphericalangle C = \\sphericalangle A + \\sphericalangle B',
      why: 'הזווית החיצונית משלימה את $\\sphericalangle C$ ל־$180^\\circ$ (קו ישר). גם $\\sphericalangle A + \\sphericalangle B$ משלימות את $\\sphericalangle C$ ל־$180^\\circ$ (סכום הזוויות במשולש). לכן הן שוות.' },
  ],
  examples: [
    { problem: 'במשולש שווה־שוקיים $ABC$ ($AB = AC$) זווית הראש היא $\\sphericalangle A = 36^\\circ$. מה גודל $\\sphericalangle B$?', display: '\\sphericalangle A = 36^\\circ', answer: 72, check: '(180 - 36) / 2',
      fig: isosceles(36, { top: { text: '36°' }, left: { text: '?', target: true } }, { names: ['B', 'C', 'A'] }),
      steps: [
        { action: 'מזהים: $AB = AC$, ולכן $\\sphericalangle B$ ו־$\\sphericalangle C$ הן זוויות הבסיס.', why: 'זוויות הבסיס הן אלה שמול השוקיים, ליד הבסיס $BC$. הן שוות.', result: '\\sphericalangle B = \\sphericalangle C' },
        { action: 'מורידים את זווית הראש מ־$180^\\circ$.', why: 'מה שנשאר הוא שתי זוויות הבסיס יחד.', result: '\\sphericalangle B + \\sphericalangle C = 180^\\circ - 36^\\circ = 144^\\circ', calc: { expr: '180 - 36', value: 144 } },
        { action: 'מחלקים לשתיים.', why: 'שתי זוויות שוות שיחד הן $144^\\circ$.', result: '\\sphericalangle B = 144^\\circ : 2 = 72^\\circ', value: '144 / 2' },
        { action: 'בודקים: ראש ועוד שתי זוויות בסיס.', why: 'צריך לצאת $180^\\circ$.', result: '36^\\circ + 72^\\circ + 72^\\circ = 180^\\circ', calc: { expr: '36 + 72 + 72', value: 180 } },
      ] },
    { problem: 'סולם דו־צדדי פתוח עומד על הרצפה. שתי הרגליים שלו שוות באורכן, והזווית ביניהן למעלה היא $40^\\circ$. מה הזווית בין רגל של הסולם לבין הרצפה, מחוץ לסולם?', answer: 110, check: '180 - (180 - 40) / 2',
      fig: aFrame(40),
      steps: [
        { action: 'רואים משולש שווה־שוקיים: נקרא לראש הסולם $A$ ולרגליים $B$ ו־$C$. הרגליים הן השוקיים, הרצפה היא הבסיס.', why: 'רגליים שוות באורכן הן שוקיים שוות, ולכן הזוויות ליד הרצפה שוות.', result: '\\sphericalangle A = 40^\\circ,\\quad \\sphericalangle B = \\sphericalangle C' },
        { action: 'מוצאים זווית בסיס: מורידים את הראש מ־$180^\\circ$ ומחלקים לשתיים.', why: 'מה שנשאר מתחלק שווה בין שתי זוויות הבסיס.', result: '\\sphericalangle B = (180^\\circ - 40^\\circ) : 2 = 70^\\circ', calc: { expr: '(180 - 40) / 2', value: 70 } },
        { action: 'הזווית שמחוץ לסולם צמודה לזווית הבסיס: יחד הן הקו הישר של הרצפה.', why: 'זו זווית חיצונית של המשולש, ליד $B$.', result: '180^\\circ - 70^\\circ = 110^\\circ', value: '180 - 70' },
        { action: 'בודקים בכלל של הזווית החיצונית: סכום שתי הזוויות הפנימיות הרחוקות.', why: 'הרחוקות מ־$B$ הן זווית הראש, $40^\\circ$, וזווית הבסיס השנייה, $70^\\circ$.', result: '40^\\circ + 70^\\circ = 110^\\circ', value: '40 + 70' },
      ] },
  ],
  together: [
    { problem: 'במשולש שווה־שוקיים זווית בסיס היא $52^\\circ$. נמצא יחד את זווית הראש.', display: '\\sphericalangle B = 52^\\circ',
      fig: isosceles(76, { left: { text: '52°' }, top: { text: '?', target: true } }, { names: ['B', '_C', '_A'] }),
      steps: [
        { prompt: 'כמה זוויות של $52^\\circ$ יש במשולש?', choices: [
          { text: 'שתיים: שתי זוויות הבסיס', ok: true, feedback: 'נכון: זוויות הבסיס שוות.' },
          { text: 'אחת', ok: false, misc: 'one-angle', feedback: 'זוויות הבסיס שוות, ולכן גם השנייה $52^\\circ$.' },
          { text: 'שלוש', ok: false, feedback: 'כל הזוויות שוות רק כשכל הצלעות שוות. כאן רק זוויות הבסיס שוות.' },
        ], hints: ['מה הקיפול הראה על זוויות הבסיס?', 'זוויות הבסיס שוות: שתיהן $52^\\circ$.'], done: 'שתי זוויות בסיס של $52^\\circ$.' },
        { prompt: 'איזה חישוב נותן את זווית הראש?', choices: [
          { text: '$180^\\circ - 2 \\cdot 52^\\circ$', ok: true, feedback: 'נכון: מה שנשאר אחרי שתי זוויות הבסיס.' },
          { text: '$180^\\circ - 52^\\circ$', ok: false, misc: 'one-angle', feedback: 'הורדתם רק זווית בסיס אחת. יש שתיים.' },
          { text: '$(180^\\circ - 52^\\circ) : 2$', ok: false, misc: 'apex-base-swap', feedback: 'כך מוצאים זווית בסיס מזווית הראש. כאן נתונה זווית בסיס, וזה הפוך.' },
        ], hints: ['כמה לוקחות שתי זוויות הבסיס יחד?', '$52^\\circ + 52^\\circ = 104^\\circ$, והראש מקבל את מה שנשאר מ־$180^\\circ$.'], done: '$\\sphericalangle A = 180^\\circ - 104^\\circ$' },
      ],
      final: { prompt: 'כמה מעלות זווית הראש?', answer: 76, check: '180 - 2 * 52', hints: ['$180 - 104$.', '$180 - 100 = 80$, ועוד $4$ פחות.'] } },
    { problem: 'במשולש $\\sphericalangle A = 38^\\circ$ ו־$\\sphericalangle B = 77^\\circ$. נמצא את הזווית החיצונית ליד $C$.', display: '\\sphericalangle A = 38^\\circ,\\quad \\sphericalangle B = 77^\\circ',
      fig: exterior(38, 77, { A: { text: '38°' }, B: { text: '77°' }, ext: { text: '?', target: true } }),
      steps: [
        { prompt: 'מה הדרך הקצרה?', choices: [
          { text: 'לחבר $\\sphericalangle A + \\sphericalangle B$', ok: true, feedback: 'נכון: הזווית החיצונית שווה לסכום שתי הזוויות הפנימיות הרחוקות.' },
          { text: 'לחשב $180^\\circ - 38^\\circ - 77^\\circ$', ok: false, misc: 'interior-not-exterior', feedback: 'זו הזווית הפנימית $\\sphericalangle C$. החיצונית צמודה לה, מחוץ למשולש.' },
          { text: 'לחשב $180^\\circ - 38^\\circ$', ok: false, feedback: 'הזווית החיצונית ליד $C$ צמודה ל־$\\sphericalangle C$, לא ל־$\\sphericalangle A$.' },
        ], hints: ['החיצונית ו־$\\sphericalangle C$ יוצרות קו ישר. מה עוד משלים את $\\sphericalangle C$ ל־$180^\\circ$?', '$\\sphericalangle A + \\sphericalangle B$ משלימות את $\\sphericalangle C$ ל־$180^\\circ$, בדיוק כמו החיצונית.'], done: 'החיצונית $= \\sphericalangle A + \\sphericalangle B$' },
      ],
      final: { prompt: 'כמה מעלות הזווית החיצונית?', answer: 115, check: '38 + 77', hints: ['$38 + 77$.', '$38 + 77 = 115$. בדקו: $\\sphericalangle C = 65^\\circ$, ו־$65 + 115 = 180$.'] } },
  ],
  diag: isoModel,
  transfer: isoStory,
  misconceptions: [
    { id: 'forgot-half', title: 'שכחו לחלק לשתי זוויות הבסיס',
      cause: 'אחרי $180^\\circ$ פחות זווית הראש מתקבל הסכום של שתי זוויות הבסיס יחד, וקל לעצור שם.',
      explain: [
        '$180^\\circ$ פחות זווית הראש הוא מה שנשאר לשתי זוויות הבסיס יחד.',
        'הן שוות, ולכן כל אחת היא חצי.',
        'בדיקה: ראש ועוד פעמיים זווית הבסיס צריך לתת $180^\\circ$.',
      ],
      remedy: [
        { kind: 'explore', text: 'זווית הראש היא $50^\\circ$: סובבו את הקרן כך שהזווית השמאלית תהיה $50^\\circ$.', ...turn(50, 90, NO_LETTERS),
          hint: 'הימנית היא מה שנשאר לשתי זוויות הבסיס יחד.', success: 'הימנית, $130^\\circ$, היא שתי זוויות הבסיס יחד. כל אחת: $130^\\circ : 2 = 65^\\circ$.' },
        { kind: 'predict', text: 'זווית הראש היא $80^\\circ$. מה זווית בסיס?', choices: ['$100^\\circ$', '$50^\\circ$'], answer: 1,
          why: '$180^\\circ - 80^\\circ = 100^\\circ$ לשתיהן, ו־$50^\\circ$ לכל אחת. בדיקה: $80 + 50 + 50 = 180$.',
          wrongWhy: { 0: 'אילו כל זווית בסיס הייתה $100^\\circ$, שתיהן יחד היו $200^\\circ$: יותר מכל המשולש.' } },
      ] },
    { id: 'one-angle', title: 'הורידו מ־$180^\\circ$ רק זווית בסיס אחת',
      cause: 'נתונה רק זווית בסיס אחת, ושכחו שגם השנייה שווה לה.',
      explain: [
        'במשולש שווה־שוקיים, זווית בסיס אחת נותנת גם את השנייה: הן שוות.',
        'לכן זווית הראש היא $180^\\circ$ פחות פעמיים זווית הבסיס.',
      ],
      remedy: [
        { kind: 'predict', text: 'זווית בסיס היא $70^\\circ$. מה עוד ידוע מיד?', choices: ['גם זווית הבסיס השנייה $70^\\circ$', 'זווית הראש $70^\\circ$', 'שום דבר'], answer: 0,
          why: 'זוויות הבסיס שוות. עכשיו ידועות שתי זוויות, $70^\\circ$ ו־$70^\\circ$, ולראש נשאר $180^\\circ - 140^\\circ = 40^\\circ$.' },
        { kind: 'explore', text: 'שתי זוויות הבסיס, $70^\\circ + 70^\\circ = 140^\\circ$, מונחות על הישר. סובבו את הקרן כך שהזווית השמאלית תהיה $140^\\circ$.', ...turn(140, 90, NO_LETTERS),
          hint: 'הימנית היא זווית הראש: מה שנשאר עד $180^\\circ$.', success: 'נשארו $40^\\circ$ לזווית הראש. עם זווית בסיס אחת בלבד הייתם מקבלים $110^\\circ$, והסכום היה $250^\\circ$.' },
      ] },
    { id: 'apex-base-swap', title: 'התבלבלו בין זווית הראש לזווית הבסיס',
      cause: 'זכרו מתכון, "$180$ פחות, ולחלק ב־$2$", בלי לבדוק איזו זווית נתונה. החילוק ב־$2$ שייך רק למקרה שבו נתונה זווית הראש.',
      explain: [
        'קודם מסמנים: איזו זווית נתונה, ראש או בסיס? זווית הראש נמצאת בין שתי השוקיים השוות.',
        'נתונה זווית הראש: מורידים אותה מ־$180^\\circ$ ומחלקים ב־$2$.',
        'נתונה זווית בסיס: יש שתיים כאלה. מורידים אותה פעמיים מ־$180^\\circ$, ומה שנשאר הוא הראש.',
      ],
      remedy: [
        { kind: 'predict', text: 'במשולש שווה־שוקיים $ABC$, $AB = AC$. איזו זווית היא זווית הראש?', choices: ['$\\sphericalangle A$, בין השוקיים', '$\\sphericalangle B$', '$\\sphericalangle C$'], answer: 0,
          why: 'זווית הראש נמצאת בין שתי השוקיים השוות, $AB$ ו־$AC$: בקודקוד $A$. $\\sphericalangle B$ ו־$\\sphericalangle C$ הן זוויות הבסיס.' },
        { kind: 'explore', text: 'זווית בסיס היא $50^\\circ$, ולכן שתי זוויות הבסיס יחד $100^\\circ$. סובבו את הקרן כך שהזווית השמאלית תהיה $100^\\circ$.', ...turn(100, 90, NO_LETTERS),
          hint: 'הימנית היא זווית הראש: מה שנשאר עד $180^\\circ$.', success: 'זווית הראש $80^\\circ$. החישוב $(180^\\circ - 50^\\circ) : 2 = 65^\\circ$ היה מתייחס ל־$50^\\circ$ כאילו היא זווית הראש.' },
        { kind: 'predict', text: 'זווית הראש היא $40^\\circ$. מה זווית בסיס?', choices: ['$100^\\circ$', '$70^\\circ$'], answer: 1,
          why: 'נתון הראש, אז מחלקים: $(180^\\circ - 40^\\circ) : 2 = 70^\\circ$. $100^\\circ$ יוצא כשמורידים את $40^\\circ$ פעמיים, כאילו היא זווית בסיס.' },
      ] },
    { id: 'interior-not-exterior', title: 'חישבו את הזווית הפנימית במקום החיצונית', prereq: 'angles:1',
      cause: 'החישוב "$180^\\circ$ פחות שתי הזוויות" מוכר מסכום הזוויות במשולש, והוא נותן את הזווית הפנימית ליד $C$. הזווית החיצונית היא הצמודה שלה, מחוץ למשולש.',
      explain: [
        'הזווית החיצונית נמצאת מחוץ למשולש, בין צלע לבין ההמשך של הצלע השכנה.',
        'היא והזווית הפנימית שלידה יוצרות קו ישר. לכן היא $180^\\circ - \\sphericalangle C$, כלומר $\\sphericalangle A + \\sphericalangle B$.',
      ],
      remedy: [
        { kind: 'explore', text: '$\\sphericalangle A = 35^\\circ$ ו־$\\sphericalangle B = 75^\\circ$, ולכן $\\sphericalangle C = 70^\\circ$. סובבו את הקרן כך שהזווית השמאלית, הפנימית $\\sphericalangle C$, תהיה $70^\\circ$.', ...turn(70, 90, AT_C),
          hint: 'הימנית היא החיצונית, מחוץ למשולש.', success: 'הימנית היא החיצונית: $110^\\circ = 35^\\circ + 75^\\circ$. את $70^\\circ$, הפנימית, מצאתם בדרך.' },
        { kind: 'predict', text: 'במשולש $\\sphericalangle A = 40^\\circ$ ו־$\\sphericalangle B = 30^\\circ$. מה הזווית החיצונית ליד $C$?', choices: ['$110^\\circ$', '$70^\\circ$'], answer: 1,
          why: 'החיצונית היא $40^\\circ + 30^\\circ = 70^\\circ$. $110^\\circ$ היא הפנימית $\\sphericalangle C$, שבתוך המשולש.' },
      ] },
  ],
};

export const ANGLES: StairContent[] = [stair1, stair2, stair3, stair4, stair5];
/** Names of misconceptions new to this topic (merged into the topic's cats so the board can name them). */
export const CATS_ANGLES: Record<string, string> = {
  'apex-base-swap': 'התבלבלו בין זווית הראש לזווית הבסיס',
};
