// An adult is told, with no text (COUNCIL2-9), off until the owner turns it on (SAFETY_ALERTS = "on" in wrangler.toml).
// legal/safety.md: the owner turns it on only if the lawyer says reporting is required. When a child's message to the AI
// reads as self-harm (the word list or the optional classifier), one adult hears that something came up today, never what
// was written:
//
//   a device a parent linked (X-Family-Device)  an email to that parent, through the notices outbox (src/email.js)
//   else a class student                        the teacher's help board: a request with the care flag and no text
//
// At most once a day for each child: the notice's key is the device and the day (notices are kept once per key), and
// the board's request takes the counter alert:s:<student> (1 a day). The child's screen does not change: the support
// card is already there. Nothing is stored about the message itself; the safety log has its own row (src/safety.js).
import { identify } from './entitle.js';
import { notice, queueNotices } from './spend.js';
import { dayOf, key, take, nowIso } from './util.js';

/** The help board's request for an alert: no exercise (this topic), no question, no note, the care flag on. */
export const ALERT_TOPIC = 'safety';

export const alertsOn = (env) => String(env.SAFETY_ALERTS ?? 'off').trim().toLowerCase() === 'on';

/** The notice's kind, one a day for a device. */
export const alertKind = (day = dayOf()) => `safety_alert:${day}`;

/**
 * Tell the child's adult, at most once a day. → 'parent', 'teacher' or null (off, nobody to tell, already told today, or
 * an error). Never throws: a request is never failed by its alert.
 */
export async function safetyAlert(env, req) {
  if (!alertsOn(env)) return null;
  try {
    const id = await identify(req, env);
    if (id.fam?.account_id) {
      const nt = notice(`fd:${id.fam.device_id}`, alertKind(), id.fam.account_id, {});
      const before = await env.DB.prepare('SELECT 1 AS x FROM notices WHERE ref = ? AND kind = ?').bind(nt.ref, nt.kind).first();
      if (before) return null;
      await queueNotices(env, [nt]);
      return 'parent';
    }
    if (id.student) {
      const r = await take(env, [key(`alert:s:${id.student.id}`, 1)]);
      if (!r.ok) return null;
      await env.DB.batch([
        env.DB.prepare('INSERT INTO help_requests (student_id, topic, level, question, answer, note, image, created_at) VALUES (?, ?, NULL, \'\', \'\', \'\', NULL, ?)')
          .bind(id.student.id, ALERT_TOPIC, nowIso()),
        env.DB.prepare('INSERT INTO help_meta (help_id, kind, care) SELECT MAX(id), \'help\', 1 FROM help_requests WHERE student_id = ?').bind(id.student.id),
      ]);
      return 'teacher';
    }
    return null;
  } catch {
    console.error('safety alert: not sent'); // nothing from the request in the log
    return null;
  }
}
