#!/usr/bin/env node
// The owner's tools for the paid tutor: grants, cancellations by email or phone, refunds, holds, and read-only lists.
// There is no HTTP admin. Every command validates its input, builds SQL with quoted literals, writes it to a temporary
// file and runs it with wrangler against the D1 database:
//
//   npm run owner -- <command> [options] [--local]
//
// Mutating commands also write an audit_log row (actor 'owner:cli'). Without --local the remote database is used.
//
//   grant-class --class C --until D --seats N [--invoice R] [--note T] [--trial]
//   grant-school --classes K --seats N --until D --invoice R [--note T]        prints a licence code once
//   grant-family --email E --until D [--note T]
//   end --id S [--reason owner]
//   cancel --id S --mode period_end|refund_now|prorata
//   refund --id S [--agorot N]
//   clear-hold --email E
//   revoke-device --id D
//   forget --email E
//   list [--class C | --email E | --status S]   requests [--open]   request-done --id R
//   usage --from D --to D                        events [--outcome mismatch]
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { endOfDayIso, CODE_ALPHABET } from '../src/util.js';
import { cleanEmail } from '../src/account.js';

const DAY = 864e5;
export class InputError extends Error {}
const fail = (msg) => { throw new InputError(msg); };

// ---------------------------------------------------------------- input rules
export const CLASS_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const ID_RE = /^[a-f0-9]{16}$/;
export function classArg(v) { const c = String(v || '').toUpperCase(); if (!CLASS_RE.test(c)) fail(`bad class code: ${v}`); return c; }
export function idArg(v, what = 'id') { const s = String(v || ''); if (!ID_RE.test(s)) fail(`bad ${what}: ${v}`); return s; }
/** A YYYY-MM-DD date, meaning the end of that day in Jerusalem, as an ISO instant. */
export function dateArg(v) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`bad date: ${v}`);
  const t = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== s) fail(`bad date: ${v}`);
  return endOfDayIso(s);
}
export function intArg(v, min, max, what) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${what} must be a whole number from ${min} to ${max}`);
  return n;
}
/** Notes keep letters, digits, spaces and .,-/ only (quotes, semicolons and the rest are stripped), at most 120. */
export const noteArg = (v) => String(v ?? '').replace(/[^\p{L}\p{N} .,\-/]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 120);
export const refArg = (v) => noteArg(v).slice(0, 40);
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

// ---------------------------------------------------------------- commands → SQL
/**
 * Build one command. Returns { sql, readOnly, print? }. `now`, `id` and `code` can be fixed for tests.
 */
export function build(cmd, o = {}, { now = new Date().toISOString(), id = randomHex(8), code = licenceCode() } = {}) {
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
      return {
        readOnly: false,
        sql: [
          // a live licence is extended (never shortened); a term grant turns a running trial into a licence
          `UPDATE subscriptions SET current_period_end = MAX(current_period_end, ${q(until)}), seats = ${seats},
  plan = CASE WHEN plan = 'trial' THEN ${q(plan)} ELSE plan END, invoice_ref = COALESCE(${q(invoice)}, invoice_ref), note = COALESCE(${q(note)}, note), updated_at = ${q(now)}
  WHERE kind = 'class' AND class_code = ${q(cls)} AND ${LIVE};`,
          `INSERT INTO subscriptions (id, kind, account_id, class_code, plan, status, provider, seats, invoice_ref, current_period_start, current_period_end, note, created_at, updated_at)
  SELECT ${q(id)}, 'class', NULL, ${q(cls)}, ${q(plan)}, 'active', 'manual', ${seats}, ${q(invoice)}, ${q(now)}, ${q(until)}, ${q(note)}, ${q(now)}, ${q(now)}
  WHERE EXISTS (SELECT 1 FROM classes WHERE code = ${q(cls)})
    AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE kind = 'class' AND class_code = ${q(cls)} AND ${LIVE});`,
          audit(now, 'licence.grant', `class:${cls}`, { plan, until, seats, invoice }),
        ].join('\n'),
      };
    }
    case 'grant-school': {
      const classes = intArg(o.classes, 1, 30, 'classes');
      const seats = intArg(o.seats, 1, 60, 'seats');
      const until = dateArg(o.until);
      if (!o.invoice) fail('--invoice is required');
      const invoice = refArg(o.invoice); const note = o.note ? noteArg(o.note) : null;
      return {
        readOnly: false,
        print: `Licence code (shown once; give it to the school): ${code}`,
        sql: [
          `INSERT INTO licence_codes (code_hash, seats, classes_left, until, invoice_ref, note, created_at, expires_at)
  VALUES (${q(licenceHash(code))}, ${seats}, ${classes}, ${q(until)}, ${q(invoice)}, ${q(note)}, ${q(now)}, ${q(new Date(Date.parse(now) + 60 * DAY).toISOString())});`,
          audit(now, 'licence.grant', `school:${invoice}`, { classes, seats, until }),
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
          `UPDATE subscriptions SET status = 'ended', ended_reason = ${q(reason)},
  current_period_end = MAX(MIN(current_period_end, ${q(now)}), strftime('%Y-%m-%dT%H:%M:%fZ', current_period_start, '+1 second')), updated_at = ${q(now)}
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
    case 'revoke-device': {
      const dev = idArg(o.id, 'device id');
      return { readOnly: false, sql: [`DELETE FROM family_devices WHERE id = ${q(dev)};`, audit(now, 'device.unlink', `device:${dev}`, { by: 'owner' })].join('\n') };
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
          `DELETE FROM family_devices WHERE account_id = ${acc};`,
          `DELETE FROM licence_requests WHERE account_id = ${acc};`,
          `DELETE FROM notices WHERE to_account = ${acc} AND sent_at IS NULL;`,
          `UPDATE subscriptions SET account_id = NULL, updated_at = ${q(now)} WHERE account_id = ${acc};`,
          `UPDATE orders SET account_id = NULL WHERE account_id = ${acc};`,
          `DELETE FROM accounts WHERE email = ${q(email)};`,
        ].join('\n'),
      };
    }
    case 'list': {
      const where = [];
      if (o.class) where.push(`s.class_code = ${q(classArg(o.class))}`);
      if (o.email) where.push(`a.email = ${q(emailArg(o.email))}`);
      if (o.status) { if (!['active', 'past_due', 'canceled', 'ended'].includes(o.status)) fail(`bad status: ${o.status}`); where.push(`s.status = ${q(o.status)}`); }
      return {
        readOnly: true,
        sql: `SELECT s.id, s.kind, s.plan, s.status, s.provider, s.class_code, s.seats, s.current_period_end, s.cancel_requested_at, s.cancel_synced_at, s.ended_reason, a.email
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
    default:
      return fail(`unknown command: ${cmd}`);
  }
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

function main(argv) {
  const { cmd, o } = parseArgs(argv);
  if (!cmd) { console.log('usage: npm run owner -- <command> [options] [--local]  (see scripts/owner.mjs)'); return; }
  const b = build(cmd, o);
  const dir = mkdtempSync(path.join(tmpdir(), 'madregot-owner-'));
  const file = path.join(dir, 'command.sql');
  writeFileSync(file, `${b.sql}\n`);
  try {
    const worker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'madregot', o.local ? '--local' : '--remote', '--file', file, '--json'], { cwd: worker, encoding: 'utf8' });
    console.log(b.readOnly ? out : 'done');
    if (b.print) console.log(b.print);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (e) {
    console.error(e instanceof InputError ? e.message : e);
    process.exitCode = 1;
  }
}
