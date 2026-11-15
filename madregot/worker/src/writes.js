// The day's write budgets of class students (COUNCIL2-12, COUNCIL2-18). Joining a class needs no account and the same
// database holds billing (500 MB in all on Workers Free), so what a token may store in a Jerusalem day is counted before
// it is stored, at four widths, all with take() in one batch (all or nothing):
//
//   the student     write:s:<id>:<what>         what one child can do in a long afternoon, many times over
//   the class       write:c:<code>:<what>       about 45 students' worth of a busy school day (a class holds 45 names)
//   the network     write:n:<net>:<what>        a whole large school behind one address (IPv6 by its /48)
//   new students    write:new:<net>:<what>      the students who joined today, from one network: far less, because
//                                               made-up names are free and a real first day is a placement and a lesson
//
// <what>: answers stored, exams stored, level rows written (the student's own budget only: a level row is one per topic,
// so it cannot grow), help requests sent to the teacher, and the kilobytes of their notebook pictures.
// Past the student's own budget: 429 too_many_writes with Retry-After until midnight; the app keeps its outbox and sends
// it again later (web/src/lib/api.js syncNow). Past a class's or a network's: the same answer with `scope`, and the
// owner gets one notice that day (owner:write_cap:<scope>:<day>): either a script, or a school that has outgrown the
// numbers below (WRITE_BUDGET_SCALE in wrangler.toml multiplies the class and network budgets).
import { HttpError, key, take, netKey, resetsAt, dayOf } from './util.js';
import { ownerNotice, queueNotices } from './spend.js';

/** What one class student may write in a day. */
export const WRITE_BUDGET = Object.freeze({ answers: 3000, exams: 30, levels: 6000, help: 20, helpKb: 3072 });
/** What a whole class may write in a day: about 45 students who each practise a long afternoon. */
export const CLASS_WRITE_BUDGET = Object.freeze({ answers: 30000, exams: 200, help: 200, helpKb: 9216 });
/** What every class student behind one network may write in a day: a large school on one address. */
export const NET_WRITE_BUDGET = Object.freeze({ answers: 150000, exams: 1000, help: 1000, helpKb: 20480 });
/** What the students who joined today may write from one network that day. */
export const NEW_WRITE_BUDGET = Object.freeze({ answers: 20000, exams: 100, help: 100, helpKb: 6144 });

/** WRITE_BUDGET_SCALE: a whole number from 1 to 20 that multiplies the class and network budgets; anything else is 1. */
export function writeScale(env) {
  const v = Number(env?.WRITE_BUDGET_SCALE);
  return Number.isInteger(v) && v >= 1 && v <= 20 ? v : 1;
}

const tooMany = (scope) => {
  const until = resetsAt('day');
  const wait = Math.max(60, Math.ceil((Date.parse(until) - Date.now()) / 1000));
  return new HttpError(429, 'too_many_writes', undefined, { resetsAt: until, ...(scope ? { scope } : {}) }, { 'Retry-After': String(wait) });
};

/** Did this student join today (Jerusalem)? Then their writes also count against the network's budget for new students. */
const joinedToday = (student) => !!student?.created_at && dayOf(new Date(student.created_at)) === dayOf();

/**
 * Take today's write budgets for these counts ({ answers, exams, levels, help, helpKb }), all or nothing.
 * → true when taken. Past a budget: throws 429 too_many_writes, or with `soft` answers false (a note that reads as
 * distress is never refused: its caller then stores it without a picture). A class or network budget that is full also
 * queues the owner's notice of the day.
 * @param {import('./types.js').Env} env
 * @param {Request} req
 * @param {{ id: string, class_code: string, created_at?: string }} student
 * @param {Record<string, number>} counts
 * @param {{ soft?: boolean, ctx?: { waitUntil(p: Promise<unknown>): void } | null }} [opts]
 */
export async function takeWrites(env, req, student, counts, { soft = false, ctx = null } = {}) {
  const wanted = Object.entries(counts).filter(([what, n]) => n > 0 && what in WRITE_BUDGET);
  if (!wanted.length) return true;
  const scale = writeScale(env);
  const net = await netKey(req, env, { wide: true });
  const fresh = joinedToday(student);
  const keys = [];
  for (const [what, n] of wanted) {
    keys.push({ ...key(`write:s:${student.id}:${what}`, WRITE_BUDGET[what], { n, err: tooMany() }), scope: null });
    if (what in CLASS_WRITE_BUDGET) {
      keys.push({ ...key(`write:c:${student.class_code}:${what}`, CLASS_WRITE_BUDGET[what] * scale, { n, err: tooMany('class') }), scope: 'class' });
      keys.push({ ...key(`write:n:${net}:${what}`, NET_WRITE_BUDGET[what] * scale, { n, err: tooMany('network') }), scope: 'network' });
      if (fresh) keys.push({ ...key(`write:new:${net}:${what}`, NEW_WRITE_BUDGET[what], { n, err: tooMany('new') }), scope: 'new' });
    }
  }
  const r = await take(env, keys);
  if (r.ok) return true;
  const scope = /** @type {{ scope?: string | null }} */ (r.key).scope;
  if (scope) {
    // which class is named (a class code names no one); a network never is
    const day = dayOf();
    const told = queueNotices(env, [ownerNotice(day, `owner:write_cap:${scope}:${day}`, {
      day, scope, what: r.key.who.split(':').pop(), limit: r.key.limit, ...(scope === 'class' ? { class: student.class_code } : {}),
    })]).catch(() => console.error('write cap notice'));
    if (ctx) ctx.waitUntil(told); else await told;
  }
  if (soft) return false;
  throw r.error;
}
