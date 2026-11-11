#!/usr/bin/env node
// The owner's tools for the paid tutor: grants, cancellations by email or phone, refunds, holds, and read-only lists.
// There is no HTTP admin. Every command validates its input, builds SQL with quoted literals, writes it to a temporary
// file and runs it with wrangler against the D1 database:
//
//   npm run owner -- <command> [options] [--local]
//
// Mutating commands also write an audit_log row (actor 'owner:cli'). Without --local the remote database is used.
//
//   grant-class --class C --until D --seats N [--invoice R] [--note T] [--trial] [--private-ok --note T]
//   grant-school --classes K --seats N --until D --invoice R [--note T | --gefen G] [--private-ok --note T]   prints a code once
//   grant-family --email E --until D [--note T]
//   end --id S [--reason owner]
//   cancel --id S --mode period_end|refund_now|prorata
//   refund --id S [--agorot N]
//   clear-hold --email E
//   revoke-device --id D
//   unbind-class --class C                      a class bound to the wrong email: the class keeps its key, no owner
//   forget --email E
//   list [--class C | --email E | --status S | --gefen [G]]   requests [--open]   request-done --id R
//   usage --from D --to D                        events [--outcome mismatch]
//   reports [--since D]                          AI answers children reported (the tutor's text only, masked)
//   pilot-report --class C --from D --to D [--consented N] [--pre A --post B] [--json]   pilot-report --class C --list
//   errors [--days 7]                            the app's error reports of the last days, most frequent first (a table)
//   reach [--days 28]                            reach counts by week (STUDENT-14), as a table
//
// Read-only commands run with --command, so the rows come back (a remote --file runs D1's import, which returns none).
//
// Licences within the Ministry of Education's rules (shared/schoolRules.js, trust spec TRUST-11 §5 and TRUST-14): while
// MOE_AI_APPROVAL is not "approved" (read from the environment, else from wrangler.toml), no AI class licence goes to a
// school. grant-class reads the class's setting and grade first (a private group its teacher attested to needs nothing
// more; a school class is refused, and after the approval so is a grade the approval does not cover); grant-school
// refuses outright, since a school code is student AI for school classes. When the owner knows the group is private (a
// tutoring centre, lessons outside any school), --private-ok with a --note saying which group, and "private" typed when
// asked, lets the grant through; the audit row records privateOk and the note. build() alone (no database) cannot see
// the class, so there a grant-class counts as a school class's. The students of a class still marked "school" keep the
// AI off until its teacher marks the group private in the app.
//
// A Gefen order (TEACHER-12): grant-school --gefen <order reference> writes the note "gefen:<ref>" (letters, digits and
// -, at most 40; it takes the place of --note), the classes that redeem the code carry it, and list --gefen shows them
// (list --gefen <ref>: that order only). The school rules apply as to any school code: refused while MOE_AI_APPROVAL is
// "none", which is right, since a Gefen order comes only after catalogue approval.
//
// The pilot's numbers (TEACHER-11, scripts/pilot.mjs): pilot-report is read-only (no audit row). It runs its SELECTs
// through the same wrangler d1 execute path and prints a Hebrew table of aggregates (or JSON with --json): no names, no
// student ids, n next to every percentage. pilot-report --class C --list prints the class's exam assignments, so the
// owner finds the ids for --pre and --post.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { endOfDayIso, startOfDayIso, CODE_ALPHABET, dayOf } from '../src/util.js';
import { cleanEmail } from '../src/account.js';
import { classAiPolicy, rulesEnv, notSellable } from '../../shared/schoolRules.js';
import { pilotQueries, pilotReport, pilotText, examListSql, examListText } from './pilot.mjs';
import { shiftDay, weekOf } from '../src/goal.js';

const DAY = 864e5;
export class InputError extends Error {}
const fail = (msg) => { throw new InputError(msg); };

// ---------------------------------------------------------------- input rules
export const CLASS_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const ID_RE = /^[a-f0-9]{16}$/;
export function classArg(v) { const c = String(v || '').toUpperCase(); if (!CLASS_RE.test(c)) fail(`bad class code: ${v}`); return c; }
export function idArg(v, what = 'id') { const s = String(v || ''); if (!ID_RE.test(s)) fail(`bad ${what}: ${v}`); return s; }
/** A YYYY-MM-DD date, meaning the end of that day in Jerusalem, as an ISO instant (`start`: its start instead). */
export function dateArg(v, { start = false } = {}) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`bad date: ${v}`);
  const t = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== s) fail(`bad date: ${v}`);
  return start ? startOfDayIso(s) : endOfDayIso(s);
}
export function intArg(v, min, max, what) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${what} must be a whole number from ${min} to ${max}`);
  return n;
}
/** Notes keep letters, digits, spaces and .,-/ only (quotes, semicolons and the rest are stripped), at most 120. */
export const noteArg = (v) => String(v ?? '').replace(/[^\p{L}\p{N} .,\-/]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 120);
export const refArg = (v) => noteArg(v).slice(0, 40);
/** A Gefen order reference: letters, digits and "-", at most 40 (TEACHER-12). */
export const GEFEN_RE = /^[\p{L}\p{N}-]{1,40}$/u;
export function gefenArg(v) { const s = String(v ?? ''); if (v === true || !GEFEN_RE.test(s)) fail(`bad Gefen order reference: ${v} (letters, digits and -, at most 40)`); return s; }
/**
 * grant-school --gefen <ref>: the note "gefen:<ref>". It takes the place of --note, and a Gefen order is a school's, so
 * it never goes with --private-ok. null without --gefen.
 */
export function gefenNote(o) {
  if (o.gefen === undefined) return null;
  if (o.note) fail('--gefen writes the note itself: give --gefen or --note, not both');
  if (o['private-ok']) fail('a Gefen order is for a school: --gefen does not go with --private-ok');
  return `gefen:${gefenArg(o.gefen)}`;
}
/** A YYYY-MM-DD day as it is (the pilot's range). */
export function dayArg(v) {
  const s = String(v || '');
  const t = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== s) fail(`bad date: ${v}`);
  return s;
}
export const PILOT_USAGE = 'usage: npm run owner -- pilot-report --class C --from YYYY-MM-DD --to YYYY-MM-DD [--consented N] [--pre <assignmentId> --post <assignmentId>] [--json] [--local], or pilot-report --class C --list';
export function emailArg(v) { try { return cleanEmail(v); } catch { return fail(`bad email: ${v}`); } }
/** A SQL string literal (inputs are validated before; quotes are doubled anyway). */
export const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const audit = (now, action, target, detail) => `INSERT INTO audit_log (at, actor, action, target, detail) VALUES (${q(now)}, 'owner:cli', ${q(action)}, ${q(target)}, ${q(JSON.stringify(detail))});`;
const LIVE = "status IN ('active', 'past_due')";
const RUNNING = "status IN ('active', 'past_due', 'canceled')";
const randomHex = (bytes) => randomBytes(bytes).toString('hex');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
/** A licence code: 12 symbols of the code alphabet, shown as XXXX-XXXX-XXXX. Uniform (rejection sampling). */
export function licenceCode() {
  const out = [];
  const cap = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < 12) for (const b of randomBytes(24)) if (b < cap && out.length < 12) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${out.slice(0, 4).join('')}-${out.slice(4, 8).join('')}-${out.slice(8).join('')}`;
}
export const licenceHash = (code) => sha256(String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''));

// ---------------------------------------------------------------- the Ministry's rules (TRUST-11 §5)
const WRANGLER_TOML = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'wrangler.toml');
const readText = (file) => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };
/**
 * The approval the rules run on, as the Worker has it: MOE_AI_APPROVAL and MOE_AI_FROM_GRADE from the environment, else
 * from wrangler.toml's vars (the first match of the spec's pattern, so a commented line never counts). `toml` is the
 * file's text (read from disk when not given). → rulesEnv's { approval, approvedFromGrade }.
 */
export function moeVars(env = process.env, toml = null) {
  const text = toml ?? readText(WRANGLER_TOML);
  const fromToml = (name) => (text.match(new RegExp(`^${name}\\s*=\\s*"(.*)"`, 'm')) || [])[1];
  const pick = (name, dflt) => (env[name] !== undefined && env[name] !== '' ? env[name] : fromToml(name) ?? dflt);
  return rulesEnv({ MOE_AI_APPROVAL: pick('MOE_AI_APPROVAL', 'none'), MOE_AI_FROM_GRADE: pick('MOE_AI_FROM_GRADE', '7') });
}
/** MOE_AI_APPROVAL as the Worker has it: the environment first, else wrangler.toml (the file at `toml`); 'approved' or 'none'. */
export const moeApproval = (env = process.env, toml = WRANGLER_TOML) => moeVars(env, readText(toml)).approval;
/** The commands that grant an AI class licence. */
export const CLASS_GRANTS = Object.freeze(['grant-class', 'grant-school']);
/** Does this command, with these options, need the owner to type "private" first? (the approval alone, no class read) */
export const needsPrivateConfirm = (cmd, o, approval) => CLASS_GRANTS.includes(cmd) && approval !== 'approved' && !!o['private-ok'];
/** With --private-ok, what the audit row records: { privateOk: true, note }. */
const privateOkDetail = (o) => (o['private-ok'] ? { privateOk: true, note: noteArg(o.note) } : {});

/** The read the grant-class gate needs: is the class there, its grade and its setting (no settings row: school). */
export const classSettingSql = (cls) => `SELECT c.code, c.grade, COALESCE(cs.setting, 'school') AS setting FROM classes c
  LEFT JOIN class_settings cs ON cs.code = c.code WHERE c.code = ${q(classArg(cls))};`;

/** Why the rules refuse this grant (null: they do not). `cls` undefined: the class was not read (build() alone). */
function refusalOf(cmd, o, moe, cls) {
  const wait = `student AI in school classes waits for the Ministry's catalogue approval (MOE_AI_APPROVAL is "${moe.approval}")`;
  if (cmd === 'grant-school') return moe.approval === 'approved' ? null : `a school licence code is for school classes, and ${wait}`;
  if (cls === undefined) return moe.approval === 'approved' ? null : `${wait}, so no class licence goes to a school yet`;
  if (!cls) fail(`no class with the code ${o.class}`);
  const p = classAiPolicy({ setting: cls.setting, grade: cls.grade, studentAi: 'on', consentAt: 'given' }, moe);
  if (!notSellable(p)) return null;
  return p.reason === 'grade' ? `the class is a school class in grade ${cls.grade}, below the approved grade` : `the class is a school class, and ${wait}`;
}

/**
 * May this grant go ahead under the rules? null: yes. 'confirm': only with --private-ok, after the typed confirmation
 * (when `confirmed` is not given yet); 'private': confirmed. Throws InputError when it may not, and says how the owner
 * can proceed when the group is really private.
 *   moe        { approval, approvedFromGrade } (moeVars)
 *   cls        grant-class: the row classSettingSql reads (null: no such class; undefined: not read, counts as a school's)
 *   confirmed  what the owner typed when asked (undefined: not asked yet)
 */
export function schoolGate(cmd, o, { moe, cls, confirmed } = {}) {
  if (!CLASS_GRANTS.includes(cmd)) return null;
  // a Gefen reference is checked first: a bad one, or one with --note or --private-ok, never reaches the prompt
  if (cmd === 'grant-school') gefenNote(o);
  const why = refusalOf(cmd, o, moe, cls);
  if (!why) return null;
  if (!o['private-ok']) {
    fail(`${cmd} refused: ${why}. Nothing was granted. Only if the group is private (not a school's), run it again with `
      + '--private-ok and --note "<which group>", and type private when asked.');
  }
  if (typeof o.note !== 'string' || !noteArg(o.note)) fail('--private-ok needs --note saying which private group this is');
  if (confirmed === undefined) return 'confirm';
  if (String(confirmed ?? '').trim() !== 'private') fail('not confirmed: nothing was granted (type private to confirm a private group)');
  return 'private';
}

// ---------------------------------------------------------------- commands → SQL
/**
 * Build one command. Returns { sql, readOnly, print? } (pilot-report: { queries, opts } or { list, sql }). `now`, `id`
 * and `code` can be fixed for tests. The grants' rules: `moe` ({ approval, approvedFromGrade }), or `approval` alone
 * (MOE_AI_APPROVAL; both read with moeVars() when neither is given), `cls` the class row cli() read for grant-class, and
 * `confirmed` what the owner typed for --private-ok (null: nothing).
 */
export function build(cmd, o = {}, { now = new Date().toISOString(), id = randomHex(8), code = licenceCode(), approval, moe, cls, confirmed = null } = {}) {
  const gate = () => schoolGate(cmd, o, { moe: moe ?? (approval !== undefined ? rulesEnv({ MOE_AI_APPROVAL: approval }) : moeVars()), cls, confirmed });
  switch (cmd) {
    case 'grant-class': {
      const cls = classArg(o.class);
      const trial = !!o.trial;
      const seats = intArg(o.seats, 1, trial ? 40 : 60, 'seats');
      const until = o.until ? dateArg(o.until) : trial ? new Date(Date.parse(now) + 14 * DAY).toISOString() : fail('--until is required');
      if (trial && Date.parse(until) > Date.parse(now) + 15 * DAY) fail('a trial lasts at most 14 days');
      if (until <= now) fail('--until must be in the future');
      const plan = trial ? 'trial' : 'term';
      const invoice = o.invoice ? refArg(o.invoice) : null; const note = o.note ? noteArg(o.note) : null;
      const allowed = gate();
      return {
        readOnly: false,
        ...(allowed === 'private' ? { print: 'Granted to a private group. Its teacher marks the class as a private group and records the parents\' consent before students use the tutor.' } : {}),
        sql: [
          // a live licence is extended (never shortened); a term grant turns a running trial into a licence
          `UPDATE subscriptions SET current_period_end = MAX(current_period_end, ${q(until)}), seats = ${seats},
  plan = CASE WHEN plan = 'trial' THEN ${q(plan)} ELSE plan END, invoice_ref = COALESCE(${q(invoice)}, invoice_ref), note = COALESCE(${q(note)}, note), updated_at = ${q(now)}
  WHERE kind = 'class' AND class_code = ${q(cls)} AND ${LIVE};`,
          `INSERT INTO subscriptions (id, kind, account_id, class_code, plan, status, provider, seats, invoice_ref, current_period_start, current_period_end, note, created_at, updated_at)
  SELECT ${q(id)}, 'class', NULL, ${q(cls)}, ${q(plan)}, 'active', 'manual', ${seats}, ${q(invoice)}, ${q(now)}, ${q(until)}, ${q(note)}, ${q(now)}, ${q(now)}
  WHERE EXISTS (SELECT 1 FROM classes WHERE code = ${q(cls)})
    AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE kind = 'class' AND class_code = ${q(cls)} AND ${LIVE});`,
          audit(now, 'licence.grant', `class:${cls}`, { plan, until, seats, invoice, ...privateOkDetail(o) }),
        ].join('\n'),
      };
    }
    case 'grant-school': {
      const classes = intArg(o.classes, 1, 30, 'classes');
      const seats = intArg(o.seats, 1, 60, 'seats');
      const until = dateArg(o.until);
      if (!o.invoice) fail('--invoice is required');
      const gefen = gefenNote(o);
      const invoice = refArg(o.invoice); const note = gefen || (o.note ? noteArg(o.note) : null);
      const allowed = gate();
      return {
        readOnly: false,
        // a code attaches only classes whose rule allows student AI: before the approval, private groups only
        print: `Licence code (shown once; give it to the ${allowed === 'private' ? 'private group' : 'school'}): ${code}`,
        sql: [
          `INSERT INTO licence_codes (code_hash, seats, classes_left, until, invoice_ref, note, created_at, expires_at)
  VALUES (${q(licenceHash(code))}, ${seats}, ${classes}, ${q(until)}, ${q(invoice)}, ${q(note)}, ${q(now)}, ${q(new Date(Date.parse(now) + 60 * DAY).toISOString())});`,
          audit(now, 'licence.grant', `school:${invoice}`, { classes, seats, until, ...(gefen ? { gefen: gefen.slice(6) } : {}), ...privateOkDetail(o) }),
        ].join('\n'),
      };
    }
    case 'grant-family': {
      const email = emailArg(o.email);
      const until = dateArg(o.until);
      if (until <= now) fail('--until must be in the future');
      const note = o.note ? noteArg(o.note) : null;
      const acc = `(SELECT id FROM accounts WHERE email = ${q(email)})`;
      return {
        readOnly: false,
        sql: [
          `INSERT INTO accounts (id, email, created_at) VALUES (${q(randomHex(8))}, ${q(email)}, ${q(now)}) ON CONFLICT (email) DO NOTHING;`,
          `UPDATE subscriptions SET current_period_end = MAX(current_period_end, ${q(until)}), updated_at = ${q(now)} WHERE kind = 'family' AND account_id = ${acc} AND ${LIVE};`,
          `INSERT INTO subscriptions (id, kind, account_id, plan, status, provider, current_period_start, current_period_end, note, created_at, updated_at)
  SELECT ${q(id)}, 'family', ${acc}, 'term', 'active', 'manual', ${q(now)}, ${q(until)}, ${q(note)}, ${q(now)}, ${q(now)}
  WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE kind = 'family' AND account_id = ${acc} AND ${LIVE});`,
          audit(now, 'licence.grant', `family:${id}`, { until }),
        ].join('\n'),
      };
    }
    case 'end': {
      const sub = idArg(o.id);
      const reason = o.reason ? String(o.reason) : 'owner';
      if (!['owner', 'expired', 'refunded', 'canceled'].includes(reason)) fail(`bad reason: ${reason}`);
      return {
        readOnly: false,
        sql: [
          // the provider is told to stop charging too (the hourly cron): an ended plan never renews
          `UPDATE subscriptions SET status = 'ended', ended_reason = ${q(reason)},
  current_period_end = MAX(MIN(current_period_end, ${q(now)}), strftime('%Y-%m-%dT%H:%M:%fZ', current_period_start, '+1 second')),
  cancel_requested_at = COALESCE(cancel_requested_at, ${q(now)}), cancel_at_period_end = 1, updated_at = ${q(now)}
  WHERE id = ${q(sub)} AND status != 'ended';`,
          audit(now, 'licence.end', `sub:${sub}`, { reason }),
        ].join('\n'),
      };
    }
    case 'cancel': {
      const sub = idArg(o.id);
      const mode = String(o.mode || '');
      if (!['period_end', 'refund_now', 'prorata'].includes(mode)) fail('--mode must be period_end, refund_now or prorata');
      const charge = `(SELECT id FROM payments WHERE subscription_id = ${q(sub)} AND kind = 'charge' AND status = 'ok' ORDER BY occurred_at DESC LIMIT 1)`;
      const chargeAmount = `(SELECT amount_agorot FROM payments WHERE subscription_id = ${q(sub)} AND kind = 'charge' AND status = 'ok' ORDER BY occurred_at DESC LIMIT 1)`;
      const endNow = `MAX(${q(now)}, strftime('%Y-%m-%dT%H:%M:%fZ', current_period_start, '+1 second'))`;
      const lines = [];
      if (mode === 'period_end') {
        lines.push(`UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, ${q(now)}), cancel_at_period_end = 1,
  status = CASE WHEN status IN ('active', 'past_due') THEN 'canceled' ELSE status END, updated_at = ${q(now)} WHERE id = ${q(sub)} AND status != 'ended';`);
      } else if (mode === 'refund_now') {
        lines.push(`INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at)
  SELECT ${q(sub)}, ${charge}, ${chargeAmount}, 'cooling_off', ${q(now)} FROM subscriptions
  WHERE id = ${q(sub)} AND status != 'ended' AND refund_until > ${q(now)} AND ${chargeAmount} > 0;`);
        lines.push(`UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, ${q(now)}), cancel_at_period_end = 1, status = 'ended', ended_reason = 'refunded',
  current_period_end = ${endNow}, updated_at = ${q(now)} WHERE id = ${q(sub)} AND status != 'ended' AND refund_until > ${q(now)};`);
      } else {
        const unused = `CAST((julianday(current_period_end) - julianday(${q(now)})) AS INTEGER)`;
        const total = `MAX(1, CAST(ROUND(julianday(current_period_end) - julianday(current_period_start)) AS INTEGER))`;
        lines.push(`INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at)
  SELECT ${q(sub)}, ${charge}, CAST(price_agorot * ${unused} / ${total} AS INTEGER), 'prorata', ${q(now)} FROM subscriptions
  WHERE id = ${q(sub)} AND status != 'ended' AND plan IN ('family_year', 'class_year') AND refund_until <= ${q(now)} AND CAST(price_agorot * ${unused} / ${total} AS INTEGER) > 0;`);
        lines.push(`UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, ${q(now)}), cancel_at_period_end = 1, status = 'ended', ended_reason = 'canceled',
  current_period_end = ${endNow}, updated_at = ${q(now)} WHERE id = ${q(sub)} AND status != 'ended' AND plan IN ('family_year', 'class_year') AND refund_until <= ${q(now)};`);
      }
      lines.push(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
  SELECT id, 'canceled:' || ${q(mode)} || ':' || cancel_requested_at, account_id, json_object('requestedAt', cancel_requested_at, 'endsAt', current_period_end,
    'refundAgorot', COALESCE((SELECT SUM(amount_agorot) FROM refund_queue WHERE subscription_id = ${q(sub)} AND reason IN ('cooling_off', 'prorata')), 0)), ${q(now)}
  FROM subscriptions WHERE id = ${q(sub)} AND account_id IS NOT NULL AND cancel_requested_at IS NOT NULL;`);
      lines.push(audit(now, 'subscription.cancel', `sub:${sub}`, { mode, by: 'owner' }));
      return { readOnly: false, sql: lines.join('\n'), print: 'The cancellation is recorded now; the hourly cron tells the provider and sends the confirmation email.' };
    }
    case 'refund': {
      const sub = idArg(o.id);
      const amount = o.agorot !== undefined ? intArg(o.agorot, 1, 10_000_000, 'agorot') : null;
      const charge = `(SELECT id FROM payments WHERE subscription_id = ${q(sub)} AND kind = 'charge' AND status = 'ok' ORDER BY occurred_at DESC LIMIT 1)`;
      const chargeAmount = `(SELECT amount_agorot FROM payments WHERE subscription_id = ${q(sub)} AND kind = 'charge' AND status = 'ok' ORDER BY occurred_at DESC LIMIT 1)`;
      return {
        readOnly: false,
        sql: [
          `INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at)
  SELECT ${q(sub)}, ${charge}, ${amount === null ? chargeAmount : `MIN(${amount}, ${chargeAmount})`}, 'owner', ${q(now)} WHERE ${chargeAmount} > 0;`,
          audit(now, 'refund', `sub:${sub}`, { amountAgorot: amount }),
        ].join('\n'),
      };
    }
    case 'clear-hold': {
      const email = emailArg(o.email);
      return { readOnly: false, sql: [`UPDATE accounts SET billing_hold_at = NULL WHERE email = ${q(email)};`, audit(now, 'billing.clear_hold', 'account', {})].join('\n') };
    }
    case 'unbind-class': {
      // support's undo of a mistaken late bind (teacherAccount.js: a co-teacher with the key bound it to their email).
      // Within the 7 days nobody could replace the key, so the teacher who opened the class still has it; she binds
      // the class to her own email from the device that opened it.
      const cls = classArg(o.class);
      return { readOnly: false, sql: [`DELETE FROM class_owners WHERE class_code = ${q(cls)};`, audit(now, 'class.unbind', `class:${cls}`, { by: 'owner' })].join('\n') };
    }
    case 'revoke-device': {
      const dev = idArg(o.id, 'device id');
      // the device's daily summaries for the parents (PARENTS-3) go first, then the device
      return {
        readOnly: false,
        sql: [`DELETE FROM family_daily WHERE device_id = ${q(dev)};`, `DELETE FROM family_devices WHERE id = ${q(dev)};`, audit(now, 'device.unlink', `device:${dev}`, { by: 'owner' })].join('\n'),
      };
    }
    case 'forget': {
      const email = emailArg(o.email);
      const acc = `(SELECT id FROM accounts WHERE email = ${q(email)})`;
      const endNow = `MAX(${q(now)}, strftime('%Y-%m-%dT%H:%M:%fZ', current_period_start, '+1 second'))`;
      return {
        readOnly: false,
        sql: [
          `INSERT INTO audit_log (at, actor, action, target, detail) SELECT ${q(now)}, 'owner:cli', 'account.delete', 'account:' || id, '{}' FROM accounts WHERE email = ${q(email)};`,
          `UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, ${q(now)}), cancel_at_period_end = 1, status = 'ended', ended_reason = 'account_deleted',
  current_period_end = ${endNow}, updated_at = ${q(now)} WHERE kind = 'family' AND account_id = ${acc} AND ${RUNNING};`,
          `DELETE FROM account_sessions WHERE account_id = ${acc};`,
          `DELETE FROM link_codes WHERE account_id = ${acc};`,
          `DELETE FROM family_daily WHERE device_id IN (SELECT id FROM family_devices WHERE account_id = ${acc});`,
          `DELETE FROM family_devices WHERE account_id = ${acc};`,
          `DELETE FROM licence_requests WHERE account_id = ${acc};`,
          `DELETE FROM class_owners WHERE account_id = ${acc};`,
          `DELETE FROM notices WHERE to_account = ${acc} AND sent_at IS NULL;`,
          `UPDATE subscriptions SET account_id = NULL, updated_at = ${q(now)} WHERE account_id = ${acc};`,
          `UPDATE orders SET status = CASE WHEN status = 'open' THEN 'expired' ELSE status END, account_id = NULL WHERE account_id = ${acc};`,
          `DELETE FROM accounts WHERE email = ${q(email)};`,
        ].join('\n'),
      };
    }
    case 'list': {
      const where = [];
      if (o.class) where.push(`s.class_code = ${q(classArg(o.class))}`);
      if (o.email) where.push(`a.email = ${q(emailArg(o.email))}`);
      if (o.status) { if (!['active', 'past_due', 'canceled', 'ended'].includes(o.status)) fail(`bad status: ${o.status}`); where.push(`s.status = ${q(o.status)}`); }
      // the classes of Gefen orders (the note grant-school --gefen wrote, carried to each class that redeemed the code)
      if (o.gefen !== undefined) where.push(o.gefen === true ? "s.note LIKE 'gefen:%'" : `s.note = ${q(`gefen:${gefenArg(o.gefen)}`)}`);
      return {
        readOnly: true,
        sql: `SELECT s.id, s.kind, s.plan, s.status, s.provider, s.class_code, s.seats, s.current_period_end, s.cancel_requested_at, s.cancel_synced_at, s.ended_reason, s.invoice_ref, s.note, a.email
  FROM subscriptions s LEFT JOIN accounts a ON a.id = s.account_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.created_at DESC LIMIT 200;`,
      };
    }
    case 'requests':
      return { readOnly: true, sql: `SELECT r.id, r.class_code, r.wants, r.school, r.classes, r.students, r.note, r.created_at, r.handled_at, a.email FROM licence_requests r LEFT JOIN accounts a ON a.id = r.account_id ${o.open ? 'WHERE r.handled_at IS NULL' : ''} ORDER BY r.created_at DESC LIMIT 200;` };
    case 'request-done': {
      const r = idArg(o.id, 'request id');
      return { readOnly: false, sql: [`UPDATE licence_requests SET handled_at = ${q(now)} WHERE id = ${q(r)};`, audit(now, 'licence.request_done', `request:${r}`, {})].join('\n') };
    }
    case 'usage': {
      const from = String(o.from || ''); const to = String(o.to || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) fail('--from and --to are YYYY-MM-DD');
      return { readOnly: true, sql: `SELECT pool, period, calls, input_tokens, output_tokens, cache_tokens, ROUND(nano_usd / 1e9, 4) AS usd FROM ai_spend WHERE length(period) = 10 AND period BETWEEN ${q(from)} AND ${q(to)} ORDER BY period, nano_usd DESC;` };
    }
    case 'events': {
      const outcome = o.outcome ? String(o.outcome) : null;
      if (outcome && !['applied', 'duplicate_payment', 'after_cancel', 'ignored_old', 'unknown', 'mismatch', 'test_mode'].includes(outcome)) fail(`bad outcome: ${outcome}`);
      return { readOnly: true, sql: `SELECT provider, event_id, type, outcome, subscription_id, amount_agorot, detail, received_at FROM billing_events ${outcome ? `WHERE outcome = ${q(outcome)}` : ''} ORDER BY received_at DESC LIMIT 200;` };
    }
    case 'reports': {
      // what a child reported about an AI answer: the reason, where, and the tutor's own text (masked on the server);
      // nothing in the table says who reported it. Kept 60 days (RETENTION.answerReportsDays).
      const since = o.since ? dateArg(o.since, { start: true }) : null;
      return { readOnly: true, sql: `SELECT id, created_at, reason, kind, tier, reply FROM answer_reports ${since ? `WHERE created_at >= ${q(since)}` : ''} ORDER BY created_at DESC LIMIT 200;` };
    }
    case 'pilot-report': {
      // read-only: SELECTs only, no audit row (scripts/pilot.mjs)
      if (!o.class || o.class === true) fail(PILOT_USAGE);
      const cls = classArg(o.class);
      if (o.list) return { readOnly: true, list: true, sql: examListSql(cls) };
      if (!o.from || !o.to || o.from === true || o.to === true) fail(PILOT_USAGE);
      const from = dayArg(o.from); const to = dayArg(o.to);
      if (from > to) fail('--from must be on or before --to');
      if ((Date.parse(to) - Date.parse(from)) / DAY > 120) fail('a pilot report covers at most 120 days');
      const consented = o.consented !== undefined ? intArg(o.consented, 1, 200, 'consented') : null;
      if (!!o.pre !== !!o.post) fail('--pre and --post go together');
      const pre = o.pre ? idArg(o.pre, 'pre assignment id') : null;
      const post = o.post ? idArg(o.post, 'post assignment id') : null;
      return { readOnly: true, queries: pilotQueries({ classCode: cls, from, to, pre, post }), opts: { classCode: cls, from, to, consented, pre, post } };
    }
    case 'errors': {
      const days = o.days === undefined ? 7 : intArg(o.days, 1, 30, 'days');
      const since = dayOf(new Date(Date.parse(now) - (days - 1) * DAY));
      return {
        readOnly: true,
        table: ['count', 'kind', 'route', 'release', 'agents', 'name', 'message', 'frame', 'first', 'last'],
        sql: `SELECT SUM(count) AS count, kind, route, release, COUNT(DISTINCT agent) AS agents, name, message, frame, MIN(first_at) AS first, MAX(last_at) AS last
  FROM client_errors WHERE day >= ${q(since)} GROUP BY fp, route, release ORDER BY count DESC, last DESC LIMIT 100;`,
      };
    }
    default:
      return fail(`unknown command: ${cmd}`);
  }
}

/** Rows as an aligned text table with these columns (long cells are cut, so a line stays readable). */
export function formatTable(rows, columns, { max = 60 } = {}) {
  if (!rows.length) return '(nothing)';
  const cell = (v) => { const t = v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' '); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };
  const body = rows.map((r) => columns.map((c) => cell(r[c])));
  const width = columns.map((c, i) => Math.max(c.length, ...body.map((r) => r[i].length)));
  const line = (cells) => cells.map((x, i) => x.padEnd(width[i])).join('  ').trimEnd();
  return [line(columns), line(width.map((w) => '-'.repeat(w))), ...body.map(line)].join('\n');
}

/** The rows of `wrangler d1 execute --json` output (an array of results, each with its rows). */
export const wranglerRows = (out) => { const v = JSON.parse(out); return (Array.isArray(v) ? v : [v]).flatMap((r) => r?.results || []); };

// ---------------------------------------------------------------- reach (STUDENT-14)
/** The rows of the reach table, by group: every name metrics.js accepts or counts appears once. */
export const REACH_GROUPS = [
  ['Landing pages', ['landing_view_mivchan', 'landing_cta_mivchan', 'landing_view_pilot', 'landing_cta_pilot', 'welcome_from_landing']],
  ['Install', ['install_offer', 'install_accept', 'installed']],
  ['Reminders', ['push_offer', 'push_on', 'push_off', 'push_open']],
  ['Store apps', ['store_open_play', 'store_open_ios']],
  ['In the app', ['wardrobe_open', 'recap_open']],
  ['Classes', ['class_goal_reached']],
];
// a Jerusalem day's Sunday, in SQL (strftime %w: 0 is Sunday)
const WEEK_SQL = "date(day, '-' || strftime('%w', day) || ' days')";

/**
 * The weeks a reach report covers: from the Sunday on or before the first of the last `days` Jerusalem days, to today.
 * Returns { from, to, weeks, sql: [statements] }; the statements read counts only (no id leaves the database).
 */
export function reachPlan(o = {}, now = new Date()) {
  const days = o.days === undefined || o.days === true ? 28 : intArg(o.days, 1, 400, 'days');
  const to = dayOf(now);
  const from = weekOf(shiftDay(to, -(days - 1)));
  const weeks = [];
  for (let w = from; w <= to; w = shiftDay(w, 7)) weeks.push(w);
  const range = `day >= ${q(from)} AND day <= ${q(to)}`;
  return {
    days, from, to, weeks,
    sql: [
      `SELECT ${WEEK_SQL} AS week, name, SUM(n) AS n FROM metrics_daily WHERE ${range} GROUP BY week, name`,
      `SELECT ${WEEK_SQL} AS week, COUNT(DISTINCT student_id) AS n FROM class_steps WHERE ${range} GROUP BY week`,
      `SELECT COUNT(DISTINCT student_id) AS n FROM class_steps WHERE ${range}`,
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'family_daily'",
    ],
    // the parents lane's table, read only where it exists (a statement naming a missing table would fail the rest)
    familySql: [
      `SELECT ${WEEK_SQL} AS week, COUNT(DISTINCT device_id) AS n FROM family_daily WHERE ${range} GROUP BY week`,
      `SELECT COUNT(DISTINCT device_id) AS n FROM family_daily WHERE ${range}`,
    ],
  };
}

/** The reach table as text. `res` holds the rows of plan.sql in order; `family` those of plan.familySql, or null. */
export function reachTable(plan, res, family = null) {
  const { weeks } = plan;
  const byName = {};
  for (const r of res[0] || []) (byName[r.name] ||= {})[r.week] = Number(r.n) || 0;
  const perWeek = (rows) => Object.fromEntries((rows || []).map((r) => [r.week, Number(r.n) || 0]));
  const sum = (m) => weeks.reduce((a, w) => a + (m[w] || 0), 0);
  const LABEL = 36; const CELL = 8;
  const lines = [];
  const row = (label, cells) => lines.push(label.padEnd(LABEL) + cells.map((c) => String(c).padStart(CELL)).join(''));
  const counts = (label, m, total = sum(m)) => row(`  ${label}`, [...weeks.map((w) => m[w] || 0), total]);
  lines.push(`Reach, ${plan.from} to ${plan.to} (Jerusalem days; a week starts on Sunday; * this week so far)`);
  lines.push('Counts of steps only: no person, device or address is behind any number.', '');
  row('week of', [...weeks.map((w, i) => `${w.slice(5)}${i === weeks.length - 1 ? '*' : ''}`), 'total']);
  for (const [title, names] of REACH_GROUPS) {
    lines.push(title);
    for (const name of names) counts(name, byName[name] || {});
    if (title === 'Install') {
      const offer = byName.install_offer || {}; const accept = byName.install_accept || {};
      const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
      row('  accepted per offer', [...weeks.map((w) => pct(accept[w] || 0, offer[w] || 0)), pct(sum(accept), sum(offer))]);
    }
    if (title === 'Classes') counts('students who learned (class_steps)', perWeek(res[1]), Number(res[2]?.[0]?.n || 0));
  }
  lines.push('Families');
  if (family) counts('linked devices that learned', perWeek(family[0]), Number(family[1]?.[0]?.n || 0));
  else lines.push('  (no family_daily table on this database yet)');
  lines.push('', 'Kept: metrics_daily 400 days, class_steps 120 days. A student is counted once a week however much they learned.');
  return lines.join('\n');
}

/** The whole reach command: `query(statements)` runs SQL and returns each statement's rows. */
export function reach(o, query, now = new Date()) {
  const plan = reachPlan(o, now);
  const res = query(plan.sql);
  const family = Number(res[3]?.[0]?.n || 0) > 0 ? query(plan.familySql) : null;
  return reachTable(plan, res, family);
}

/** --name value pairs and --flags. */
export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const o = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) fail(`unexpected argument: ${a}`);
    const name = a.slice(2);
    if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) { o[name] = rest[i + 1]; i++; } else o[name] = true;
  }
  return { cmd, o };
}

/** The commands, one line each (printed with no command, or with help). */
export const HELP = `usage: npm run owner -- <command> [options] [--local]   (without --local: the remote database)
  grant-class --class C --until D --seats N [--invoice R] [--note T] [--trial] [--private-ok]
  grant-school --classes K --seats N --until D --invoice R [--note T | --gefen G] [--private-ok]   prints a licence code once
    (until MOE_AI_APPROVAL is "approved": refused for schools; a private group needs --private-ok --note T and "private" typed)
  grant-family --email E --until D [--note T]
  end --id S [--reason owner]
  cancel --id S --mode period_end|refund_now|prorata
  refund --id S [--agorot N]
  clear-hold --email E
  revoke-device --id D
  unbind-class --class C   a class bound to the wrong email: the class keeps its key, no owner
  forget --email E
  list [--class C | --email E | --status S | --gefen [G]]
  requests [--open]
  request-done --id R
  usage --from D --to D
  events [--outcome mismatch]
  reports [--since D]   AI answers children reported (the tutor's text only, masked; kept 60 days)
  errors [--days 7]   the app's error reports of the last days, most frequent first (a table)
  pilot-report --class C --from D --to D [--consented N] [--pre A --post B] [--json]   (or --class C --list)
  reach [--days 28]   reach counts by week (STUDENT-14): counts of named steps only, no person behind any number
Dates are YYYY-MM-DD (Jerusalem).`;

/**
 * One line typed by the owner (the prompt goes to stderr, so a command's output stays clean). No answer at all (the
 * input closed) is '': nothing is confirmed, and the command fails rather than end quietly.
 */
async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await new Promise((resolve) => {
      rl.once('close', () => resolve(''));
      rl.question(question).then((a) => resolve(String(a).trim()), () => resolve(''));
    });
  } finally { rl.close(); }
}

const WORKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = (o, args) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'madregot', o.local ? '--local' : '--remote', ...args, '--json'], { cwd: WORKER, encoding: 'utf8' });
/** What the CLI does outside itself: the database through wrangler, the terminal. Tests pass their own. */
const realIo = {
  env: process.env,
  /** One read-only SELECT: its first row, or null. */
  query: async (sql, o) => (JSON.parse(wrangler(o, ['--command', sql]))?.[0]?.results || [])[0] || null,
  /** One read-only SELECT: all its rows. */
  rows: async (sql, o) => JSON.parse(wrangler(o, ['--command', sql]))?.[0]?.results || [],
  /** Each statement's rows, in order (read-only SELECTs, run together with --command). */
  statements: async (sqls, o) => JSON.parse(wrangler(o, ['--command', sqls.join(';\n')])).map((r) => r.results || []),
  /**
   * Run a built command; returns what wrangler printed. A read-only command runs with --command, so its rows come back
   * (a remote --file runs D1's import, which returns none); a write runs from a file.
   */
  exec: async (b, o) => {
    if (b.readOnly) return wrangler(o, ['--command', b.sql]);
    const dir = mkdtempSync(path.join(tmpdir(), 'madregot-owner-'));
    const file = path.join(dir, 'command.sql');
    writeFileSync(file, `${b.sql}\n`);
    try { return wrangler(o, ['--file', file]); } finally { rmSync(dir, { recursive: true, force: true }); }
  },
  prompt: ask,
  log: (...a) => console.log(...a),
  error: (...a) => console.error(...a),
};

/** The whole command line: 0 when it ran, 1 when it was refused or failed (nothing written then). */
export async function cli(argv, io = realIo) {
  try {
    const { cmd, o } = parseArgs(argv);
    if (!cmd || cmd === 'help' || cmd === '--help') { io.log(HELP); return 0; }
    // reach counts by week (STUDENT-14): read-only, counts only
    if (cmd === 'reach') {
      const plan = reachPlan(o);
      const res = await io.statements(plan.sql, o);
      const family = Number(res[3]?.[0]?.n || 0) > 0 ? await io.statements(plan.familySql, o) : null;
      io.log(reachTable(plan, res, family));
      return 0;
    }
    // the Ministry's rules come first: nothing is written, and nothing asked, for a grant they refuse. Every other input
    // is checked before the class is read; then the class (grant-class), the rules, and "private" typed when needed.
    let opts = {};
    if (CLASS_GRANTS.includes(cmd)) {
      build(cmd, o, { moe: { approval: 'approved', approvedFromGrade: 7 } });
      const moe = moeVars(io.env);
      opts = { moe, cls: cmd === 'grant-class' ? await io.query(classSettingSql(o.class), o) : undefined };
      if (schoolGate(cmd, o, opts) === 'confirm') {
        build(cmd, o, { ...opts, confirmed: 'private' });
        opts.confirmed = await io.prompt('MOE_AI_APPROVAL is not "approved": this licence may go only to a private group outside any school. Type private to confirm: ');
      }
    }
    const b = build(cmd, o, opts);
    // the pilot's numbers: each SELECT on its own, then the counting here; nothing is written
    if (b.queries) {
      const results = {};
      for (const [name, sql] of Object.entries(b.queries)) results[name] = await io.rows(sql, o);
      const rep = pilotReport(results, b.opts);
      io.log(o.json ? JSON.stringify(rep, null, 2) : pilotText(rep, b.opts.classCode));
      return 0;
    }
    if (b.list) { io.log(examListText(await io.rows(b.sql, o))); return 0; }
    const out = await io.exec(b, o);
    io.log(b.table ? formatTable(wranglerRows(out), b.table) : b.readOnly ? out : 'done');
    if (b.print) io.log(b.print);
    return 0;
  } catch (e) {
    io.error(e instanceof InputError ? e.message : e);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  cli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
