// The distress detector never reads the app's own maths as a child in distress (COUNCIL2-4): every teaching step of
// every stair, every challenge task, every lesson, every mistake name, and a sample of every generator's items with
// their hints and solutions. Words that are also maths ("לקפוץ" on a number line, "כדורים" in a word problem, "לא שווה"
// for ≠, "חותך" for a line that cuts an axis) need a first person or an intent beside them; this sweep is the proof
// that they have it. A false positive here would turn a maths question into a care reply. The phrases that must flag,
// and the everyday school sentences that must not, are in worker/test/safety.test.js.
import { describe, it, expect } from 'vitest';
// @ts-ignore: plain JS
import { detectDistress, readsPersonal } from '@shared/distress.js';
import { loadAllContent } from './content/index';
import { CHALLENGE_TASKS } from './challenges/all';
// @ts-ignore: plain JS
import { TOPICS, makeItem, loadAllGens } from '@/content/index.js';
// @ts-ignore: plain JS
import { LESSONS } from '@/content/lessons.js';

/** Every string inside a value (objects, arrays), once each; functions and numbers are skipped. */
function strings(value: unknown, out = new Set<string>(), seen = new WeakSet<object>()): Set<string> {
  if (typeof value === 'string') { if (/[א-תa-z]/i.test(value)) out.add(value); return out; }
  if (!value || typeof value !== 'object') return out;
  if (seen.has(value as object)) return out;
  seen.add(value as object);
  for (const v of Array.isArray(value) ? value : Object.values(value as object)) strings(v, out, seen);
  return out;
}

/** The texts that flag, with what they flag as: an empty list is the pass. */
function flagged(texts: Iterable<string>): string[] {
  const hits: string[] = [];
  for (const t of texts) { const r = detectDistress(t); if (r.flag) hits.push(`${r.category}: ${t}`); }
  return hits;
}

/** Items drawn per generator level: enough to meet every template (the label tests draw far more for the maths). */
const DRAWS = 60;
/** A whole sweep takes a few seconds; on a loaded machine far more. */
const SLOW = 120_000;

describe('the distress detector and the app\'s own maths', () => {
  it('no teaching step of any stair flags (worked examples, guided problems, predictions, why-lines, diagnostic models)', async () => {
    const content = await loadAllContent();
    const all = strings(content);
    expect(all.size).toBeGreaterThan(3000);
    expect(flagged(all)).toEqual([]);
  }, SLOW);

  it('no challenge task flags', () => {
    const all = strings(CHALLENGE_TASKS);
    expect(all.size).toBeGreaterThan(300);
    expect(flagged(all)).toEqual([]);
  });

  it('no lesson, topic or mistake name flags', () => {
    const all = strings(LESSONS);
    for (const t of TOPICS) strings({ title: t.title, desc: t.desc, cats: t.cats, levels: t.levels.map((l: { title: string }) => l.title) }, all);
    expect(all.size).toBeGreaterThan(200);
    expect(flagged(all)).toEqual([]);
  });

  it(`no generator item flags: ${DRAWS} items of every level of every topic, with their hints and solutions`, async () => {
    // the generators load per topic since the boot split (content/topics.js loadGens): every topic's, the newer ones
    // (area, solid, circle, space, data, prob, func, transf, congr, sim...) included; half the draws are the checks' own
    // items (testGen, `{ test: true }`)
    await loadAllGens();
    const all = new Set<string>();
    let items = 0;
    for (const t of TOPICS) {
      t.levels.forEach((_: unknown, i: number) => {
        for (let k = 0; k < DRAWS; k += 1) { strings(makeItem(t.id, i + 1, undefined, { test: k % 2 === 1 }), all); items += 1; }
      });
    }
    expect(items).toBeGreaterThan(1500);
    expect(flagged(all)).toEqual([]);
  }, SLOW);

  // The app's word problems are about lifts, temperatures, divers, debts, balls in a bag, things that fall and lines
  // that cut an axis. A child who asks about one, in a child's words and in the first person, is asking about maths:
  // it never flags, and it never reads as personal either (the "held" support card of a resting tutor is for a
  // message that is not about maths at all).
  const ASKED = [
    'המעלית ירדה 3 קומות ואז עלתה 5, איך אני יודע באיזו קומה היא?',
    'אני לא מבין למה המעלית בקומה מינוס 2',
    'הטמפרטורה ירדה ב-5 מעלות, למה יצא מינוס 2?',
    'אני מוציא כדור מהשק בלי להסתכל, מה הסיכוי שהוא אדום?',
    'יש בשקית 3 כדורים אדומים ו-5 כחולים, איך מחשבים?',
    'לקחתי 2 כדורים מהשק ולא החזרתי, מה ההסתברות עכשיו?',
    'נשארו לי 3 כדורים מתוך 10, איזה שבר זה?',
    'אם אני זורק כדור מגובה 20 מטר, אחרי כמה שניות הוא נופל לרצפה?',
    'האבן נופלת מהגג, איך אני מחשב את המהירות?',
    'הכדור נפל לבור בעומק 2 מטר, איפה הוא ביחס לקרקע?',
    'העץ נפל ונשבר בגובה 3 מטר, איך מחשבים את אורכו?',
    'איפה הישר חותך את ציר ה-y?',
    'אני לא מבינה איפה הגרף חותך את הצירים',
    'אני חותך את הפיצה ל-8 חלקים שווים, כמה זה שלושה חלקים?',
    'חתכתי את העוגה לשלושה חלקים, כל חלק הוא שליש?',
    'אני רוצה לקפוץ 3 צעדים שמאלה על ציר המספרים, לאן אני מגיע?',
    'קפצתי מ-2 ל-מינוס 3, כמה צעדים זה?',
    'בתרגיל כתוב שדני קפץ מהמקפצה לעומק 3 מטר, איך כותבים את זה?',
    'הצוללת ירדה לעומק של 40 מטר מתחת לפני הים',
    'הצוללן צלל 12 מטר ואז עלה 4, איפה הוא?',
    'הציפור צללה מגובה 15 מטר אל מתחת לפני המים',
    'המטוס ירד 300 מטר ואז עוד 150, כמה הוא ירד בסך הכול?',
    'אני בחוב של 50 שקלים, איך כותבים את זה כמספר?',
    'למה הצלע הזו לא שווה לצלע השנייה?',
    'אני לא שווה את שני האגפים נכון, מה עשיתי לא טוב?',
    'אני שובר את הסוגריים ומה עושים עם המינוס?',
    'זרקתי קובייה 3 פעמים ויצא 6, מה הסיכוי?',
    'אם אני מטיל מטבע פעמיים, מה ההסתברות לעץ פעמיים?',
    'הרכבת יצאה ב-8 ונוסעת 90 קמ"ש, מתי היא תפגוש את הרכבת השנייה?',
    'שני רוכבי אופניים יוצאים זה מול זה, מתי הם נפגשים?',
    'המחיר ירד ב-20 אחוז, כמה אני משלם עכשיו?',
    'הסולם נשען על הקיר בגובה 4 מטר, כמה הוא ארוך?',
    'הממוצע שלי ירד כי קיבלתי 60 במבחן, איך מחשבים ממוצע חדש?',
    'התרגיל הזה הורג אותי, מה עושים עם המינוס?',
    'אני רוצה להרוג את התרגיל הזה כבר, איך פותרים?',
    'אני מת על שברים, תן לי עוד תרגיל',
    'נמאס לי מהתרגיל הזה, אפשר רמז?',
    'אין לי כוח לתרגיל הזה, תן רמז',
    'הגובה של הר הוא 800 מטר וים המלח במינוס 430, מה ההפרש?',
  ];
  it('a child\'s own question about a word problem (a lift, a diver, balls in a bag, a falling stone, a line that cuts an axis) never flags', () => {
    expect(ASKED.length).toBeGreaterThanOrEqual(35);
    expect(flagged(ASKED)).toEqual([]);
  });
  it('and never reads as a message that is not about maths', () => {
    expect(ASKED.filter((q) => readsPersonal(q))).toEqual([]);
    // while a message with nothing of the lesson in it does (the resting tutor's support card shows under it)
    for (const q of ['אף אחד לא מדבר איתי בכיתה כבר שבוע', 'אמא ואבא רבים כל הזמן ואני לא ישן', 'אני מפחד לחזור הביתה היום']) expect(readsPersonal(q), q).toBe(true);
  });
});
