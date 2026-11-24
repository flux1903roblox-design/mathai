// "כדאי לבדוק איתם" (spec TEACHER-8 §2): who in the class the teacher should check in with, ranked by one stated score,
// with the reasons behind it. Pure: no store, no React, no network. The board's "מחר" shows the top 6, and the students
// tab sorts the whole class by the same score ("מי צריך תשומת לב").
//
//   score = idle  (no practice for 3 days or more)      3 + min(idleDays, 14) / 2      3.5 .. 10
//         + low   (5+ answers this week, first try < 60%)  4 × (0.6 − firstTry) × 10    0 .. 24
//         + help  (requests waiting for the teacher)       3 each
//         + late  (given work past its date, not finished) 2 each
//
// A student who never practised is idle since the day they joined. The reasons are listed by their weight in this
// student's score, the largest first (a tie: idle, low, help, late).
export type AttentionKind = 'idle' | 'low' | 'help' | 'late';
export interface AttentionReason {
  kind: AttentionKind;
  /** What this reason adds to the score. */
  weight: number;
  /** idle: days without practice; help: open requests; late: assignments behind. */
  n?: number;
  /** low: the week's first-try rate, 0..100. */
  p?: number;
  /** idle: the student has never practised. */
  never?: boolean;
}
export interface AttentionStudent {
  id: string;
  name: string;
  /** ISO time of the last answer, or null. */
  lastPractice: string | null;
  /** YYYY-MM-DD (Jerusalem) the student joined the class, or null when the server does not say. */
  joinedOn?: string | null;
  /** This week: answers and first-try right answers. */
  week: { n: number; first: number };
  /** Help requests waiting for the teacher. */
  openHelp?: number;
  /** Given work past its date and not finished. */
  late?: number;
}
export interface Attention<S extends AttentionStudent = AttentionStudent> {
  student: S;
  score: number;
  reasons: AttentionReason[];
  idleDays: number;
}

/** The list on "מחר": this many at most. */
export const ATTENTION_TOP = 6;
/** Days without practice that count as idle, and the most days that add to the score. */
export const IDLE_DAYS = 3;
export const IDLE_CAP = 14;
/** The struggling rule: at least this many answers this week, and a first-try rate under this. */
export const LOW_MIN_N = 5;
export const LOW_RATE = 0.6;
const ORDER: AttentionKind[] = ['idle', 'low', 'help', 'late'];
const round2 = (x: number) => Math.round(x * 100) / 100;

/** The Jerusalem day (YYYY-MM-DD) of an ISO time. */
export const jerusalemDay = (iso: string): string => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
/** Whole days from one YYYY-MM-DD to another (0 for the same day, never below 0). */
export function daysBetween(from: string, to: string): number {
  const d = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * One student's score and reasons on `today` (YYYY-MM-DD, the server's day in Jerusalem). A student with no practice
 * and no join date counts as idle for the full 14 days.
 */
export function attentionOf<S extends AttentionStudent>(s: S, today: string): Attention<S> {
  const never = !s.lastPractice;
  const idleDays = never ? (s.joinedOn ? daysBetween(s.joinedOn, today) : IDLE_CAP) : daysBetween(jerusalemDay(s.lastPractice as string), today);
  const reasons: AttentionReason[] = [];
  if (idleDays >= IDLE_DAYS) reasons.push({ kind: 'idle', weight: 3 + Math.min(idleDays, IDLE_CAP) / 2, n: idleDays, ...(never ? { never: true } : {}) });
  const n = s.week?.n || 0;
  const rate = n ? (s.week.first || 0) / n : 1;
  if (n >= LOW_MIN_N && rate < LOW_RATE) reasons.push({ kind: 'low', weight: 4 * (LOW_RATE - rate) * 10, p: Math.round(rate * 100) });
  const help = Math.max(0, s.openHelp || 0);
  if (help) reasons.push({ kind: 'help', weight: help * 3, n: help });
  const late = Math.max(0, s.late || 0);
  if (late) reasons.push({ kind: 'late', weight: late * 2, n: late });
  for (const r of reasons) r.weight = round2(r.weight);
  reasons.sort((a, b) => b.weight - a.weight || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const score = round2(reasons.reduce((t, r) => t + r.weight, 0));
  return { student: s, score, reasons, idleDays };
}

/** Every student by score, the highest first (a tie: by name, in Hebrew order). Students with score 0 are included. */
export function rankAll<S extends AttentionStudent>(students: S[], today: string): Attention<S>[] {
  return students.map((s) => attentionOf(s, today))
    .sort((a, b) => b.score - a.score || a.student.name.localeCompare(b.student.name, 'he'));
}

/** "כדאי לבדוק איתם": the students with a score above 0, ranked; `top` of them and how many more there are. */
export function attentionList<S extends AttentionStudent>(students: S[], today: string, top = ATTENTION_TOP): { top: Attention<S>[]; more: number; all: Attention<S>[] } {
  const all = rankAll(students, today).filter((a) => a.score > 0);
  return { top: all.slice(0, top), more: Math.max(0, all.length - top), all };
}

/** The open help requests per student id, from the board's help rows (those not closed). */
export function openHelpBy(help: { studentId?: string; done_at?: string | null }[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of help) if (h.studentId && !h.done_at) out[h.studentId] = (out[h.studentId] || 0) + 1;
  return out;
}

/** The words of one reason, as a chip under the name. */
export function reasonText(r: AttentionReason): string {
  if (r.kind === 'idle') return r.never ? 'עוד לא התחיל/ה לתרגל' : `לא תרגל/ה ${r.n} ימים`;
  if (r.kind === 'low') return `${r.p}% נכון בניסיון ראשון השבוע`;
  if (r.kind === 'help') return r.n === 1 ? 'בקשת עזרה מחכה' : `${r.n} בקשות עזרה מחכות`;
  return r.n === 1 ? 'משימה אחת באיחור' : `${r.n} משימות באיחור`;
}
