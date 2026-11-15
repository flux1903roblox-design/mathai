// An adult is told, with no text (COUNCIL2-9), off until the owner turns it on (SAFETY_ALERTS = "on" in wrangler.toml).
// legal/safety.md: the owner turns it on only if the lawyer says reporting is required. When a child's message to the AI
// is a plain statement of suicide or self-harm, one adult hears that something came up today, never what was written:
//
//   a device a parent linked (X-Family-Device)  an email to that parent, through the notices outbox (src/email.js)
//   else a class student                        the teacher's help board: a request with the care flag and no text
//
// Who is told depends on what the message says (shared/distress.js distressDetail):
//   - Only a message the word list reads as `sure` alerts anyone (or one the optional classifier marked self_harm): a
//     word that is also maths or slang ("לקפוץ", "חותכת", "בא לי למות מהמבחן") shows the child the support card and
//     tells no adult.
//   - A message that is also about home (`home`: it reads as abuse, or names a parent or the home) is never sent to a
//     parent: the parent may be the person the child is afraid of. A class student's teacher is told instead; a child
//     with no class has nobody the app can tell, and the support card on the screen is what they get.
//
// At most once a day for each child: the notice's key is the device and the day (notices are kept once per key), and
// the board's request takes the counter alert:s:<student> (1 a day; forget.js deletes it with the student). The child's
// screen does not change: the support card is already there. Nothing is stored about the message itself; the safety
// log has its own row (src/safety.js).
import { identify } from './entitle.js';
import { notice, queueNotices } from './spend.js';
import { dayOf, key, take, nowIso } from './util.js';

/** The help board's request for an alert: no exercise (this topic), no question, no note, the care flag on. */
export const ALERT_TOPIC = 'safety';

export const alertsOn = (env) => String(env.SAFETY_ALERTS ?? 'off').trim().toLowerCase() === 'on';

/** The notice's kind, one a day for a device. */
export const alertKind = (day = dayOf()) => `safety_alert:${day}`;

/**
 * Should this flagged message alert an adult at all? Self-harm only, and only when it is unambiguous: the word list's
 * `sure`, or the classifier's own reading (source 'model').
 * @param {{ flag: boolean, category: string | null, source?: string }} hit what the request was flagged with
 * @param {{ sure: boolean, categories: string[] }} detail shared/distress.js distressDetail(text)
 */
export function alertWorthy(hit, detail) {
  if (!hit?.flag) return false;
  if (hit.source === 'model') return hit.category === 'self_harm';
  return !!detail?.sure && detail.categories.includes('self_harm');
}

/**
 * Tell the child's adult, at most once a day. → 'parent', 'teacher' or null (off, nobody to tell, already told today, or
 * an error). `home`: the message is also about home, so a parent is never the one told. Never throws: a request is
 * never failed by its alert.
 * @param {import('./types.js').Env} env
 * @param {Request} req
 * @param {{ home?: boolean }} [about]
 */
export async function safetyAlert(env, req, { home = false } = {}) {
  if (!alertsOn(env)) return null;
  try {
    const id = await identify(req, env);
    if (id.fam?.account_id && !home) {
      const nt = notice(`fd:${id.fam.device_id}`, alertKind(), id.fam.account_id, {});
      const before = await env.DB.prepare('SELECT 1 AS x FROM notices WHERE ref = ? AND kind = ?').bind(nt.ref, nt.kind).first();
      if (before) return null;
      await queueNotices(env, [nt]);
      return 'parent';
    }
    // a class student (also one on a family device, when the message is about home): the teacher's board
    const student = id.student;
    if (student) {
      const r = await take(env, [key(`alert:s:${student.id}`, 1)]);
      if (!r.ok) return null;
      await env.DB.batch([
        env.DB.prepare('INSERT INTO help_requests (student_id, topic, level, question, answer, note, image, created_at) VALUES (?, ?, NULL, \'\', \'\', \'\', NULL, ?)')
          .bind(student.id, ALERT_TOPIC, nowIso()),
        env.DB.prepare('INSERT INTO help_meta (help_id, kind, care) SELECT MAX(id), \'help\', 1 FROM help_requests WHERE student_id = ?').bind(student.id),
      ]);
      return 'teacher';
    }
    return null;
  } catch {
    console.error('safety alert: not sent'); // nothing from the request in the log
    return null;
  }
}
