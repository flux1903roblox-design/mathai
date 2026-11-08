// The tutor without a model: the six questions a student asks, answered from the stair's authored content and
// the misconception engine. Nothing here pretends to be an AI. It favours a question back and a smaller step
// over the answer: "בוא נפתור יחד" walks the solution one step at a time and leaves the last step to the student.
// When the app has a server with Claude, the screens offer that separately and say so.
import type { StairContent, Text } from './types';
import type { Diagnosis } from './misconceptions';

export type Intent = 'lost' | 'other' | 'why' | 'example' | 'mistake' | 'together';
export const INTENTS: { id: Intent; label: string }[] = [
  { id: 'lost', label: 'לא הבנתי' },
  { id: 'other', label: 'תסביר לי בדרך אחרת' },
  { id: 'why', label: 'למה זה עובד?' },
  { id: 'example', label: 'אפשר דוגמה?' },
  { id: 'mistake', label: 'מה הטעות שלי?' },
  { id: 'together', label: 'בוא נפתור יחד' },
];

export interface TutorItem { solution?: Text[]; hint?: Text }
export interface TutorContext {
  content: StairContent | null;
  item?: TutorItem | null;
  /** The last wrong answer on this item: the category the exercise's diag() gave and/or a full diagnosis. */
  wrong?: { cat?: string | null; diagnosis?: Diagnosis } | null;
  /** How many times each intent was asked here, so a second "another way" gives another way. */
  asked?: Partial<Record<Intent, number>>;
}
export type TutorAction =
  | { kind: 'discover' }
  | { kind: 'example'; index: number }
  | { kind: 'steps'; steps: Text[]; last: Text | null }
  | { kind: 'remedy'; misc: string };
export interface TutorReply { say: Text[]; action?: TutorAction }

const nth = <T>(arr: T[], k: number) => arr[k % arr.length];

export function tutorReply(intent: Intent, ctx: TutorContext): TutorReply {
  const c = ctx.content; const n = ctx.asked?.[intent] || 0;
  const sol = ctx.item?.solution || [];
  switch (intent) {
    case 'lost':
      if (c) return { say: [c.idea, 'בואו נראה את זה שוב, צעד אחר צעד, עם הדברים שאפשר להזיז.'], action: { kind: 'discover' } };
      return { say: [ctx.item?.hint || 'נתחיל מהצעד הראשון.', ...(sol.length > 1 ? [sol[0]] : [])] };
    case 'other':
      if (c?.alt.length) return { say: [nth(c.alt, n)] };
      return { say: [ctx.item?.hint || 'נסו לחשוב על זה דרך דוגמה קטנה.'] };
    case 'why':
      if (c) return { say: c.why };
      return { say: ['הסבר למה זה עובד יופיע כשהשיעור של המדרגה הזאת יהיה מוכן.'] };
    case 'example':
      if (c?.examples.length) { const index = n % c.examples.length; return { say: ['הנה דוגמה פתורה. כל צעד עם הסיבה שלו.'], action: { kind: 'example', index } }; }
      return { say: sol.length ? ['ככה פותרים תרגיל כזה:', ...sol.slice(0, -1)] : ['אין עדיין דוגמה למדרגה הזאת.'] };
    case 'mistake': {
      const w = ctx.wrong;
      if (!w) return { say: ['עוד לא הייתה כאן תשובה שגויה. אם משהו לא בטוח, אפשר לבקש דוגמה או לפתור יחד.'] };
      const d = w.diagnosis;
      const ids = d?.kind === 'misconception' ? d.candidates.map((x) => x.id) : w.cat ? [w.cat] : [];
      const defs = ids.map((id) => c?.misconceptions.find((m) => m.id === id)).filter(Boolean) as StairContent['misconceptions'];
      if (defs.length > 1) return { say: ['התשובה מתאימה לשתי טעויות אפשריות, ועוד לא ברור איזו מהן. שאלה אחת נוספת תגלה.', ...defs.map((m) => `אולי: ${m.title}.`)] };
      if (defs.length === 1) return { say: [defs[0].cause, ...defs[0].explain.slice(0, 2)], action: { kind: 'remedy', misc: defs[0].id } };
      if (d?.kind === 'slip') return { say: [d.why === 'swapped-digits' ? 'נראה ששתי ספרות התחלפו. הדרך הייתה נכונה.' : 'נראה כמו טעות חישוב קטנה ולא טעות בהבנה. הדרך נכונה: בדקו שוב את החשבון האחרון.'] };
      return { say: ['התשובה לא מתאימה לאף טעות שאני מכיר, אז לא אנחש. בואו נעבור על הפתרון יחד, צעד אחר צעד.'], action: sol.length ? { kind: 'steps', steps: sol.slice(0, -1), last: null } : undefined };
    }
    case 'together':
      if (sol.length > 1) return { say: ['נעשה את זה יחד. אראה צעד אחד בכל פעם, ואת הצעד האחרון תעשו לבד.'], action: { kind: 'steps', steps: sol.slice(0, -1), last: null } };
      return { say: [ctx.item?.hint || 'נתחיל מהרמז.'] };
    default:
      return { say: [] };
  }
}
