// The contract layer (COUNCIL2-22): the key end-to-end flows run against the real Worker, not only against the fake
// server. The 'contract' project (playwright.config.js) builds the app with VITE_API_URL="/" and serves it from
// worker/scripts/serve-local.mjs, which runs the Worker's own fetch handler on a node:sqlite database built from the
// migrations, with the stubs of worker/test/helpers.js (Claude, the email service; the test payment provider is the
// Worker's own). The app and /api are then one address, as in production.
//
// A test tagged @contract runs twice: in the phone project against fakeServer.js, and in the contract project against
// the Worker. Its fakeServer(...) call returns, in the contract project, the object below instead of the fake: a
// database of the test's own (a tenant of serve-local, /t/<tenant>), the log of the requests the browser made to it
// (the fake's log shape: { path, method, body, headers }), and the same `attach` for a second device. The fake's `st`
// is not there: a test reads what the server holds through the helpers below, which read either backend, so one test
// body checks both. Where the two disagree, the Worker is the truth (QA_DURABLE.md lists what was fixed).
import { test } from '@playwright/test';
import { createHash } from 'node:crypto';

export const CONTRACT_PORT = Number(process.env.CONTRACT_PORT) || 4423;
export const CONTRACT_ORIGIN = `http://127.0.0.1:${CONTRACT_PORT}`;
/** This test runs in the contract project (against the real Worker). */
export const inContract = () => { try { return test.info().project.name === 'contract'; } catch { return false; } };
const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

let made = 0;
/** A database of this test's own on serve-local, and the log of what the browser asked it. */
export async function contractServer(target) {
  made += 1;
  const tenant = `${process.pid.toString(36)}-${Date.now().toString(36)}-${made}`;
  const base = `${CONTRACT_ORIGIN}/t/${tenant}`;
  const log = [];
  const watched = new WeakSet();
  const entries = new WeakMap();
  // the log keeps what reached the server, as the fake's does: a request the device sent with no network (offline, or
  // aborted by a test's offline switch) is taken out again; one whose reply was lost on the way back stays
  const watch = (ctx) => {
    if (watched.has(ctx)) return;
    watched.add(ctx);
    ctx.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith(`${base}/api/`)) return;
      let body = {};
      try { body = r.postDataJSON() ?? {}; } catch { body = r.postData(); }
      const entry = { path: new URL(url).pathname.slice(`/t/${tenant}`.length), method: r.method(), body, headers: r.headers() };
      log.push(entry);
      entries.set(r, entry);
      r.allHeaders().then((h) => { entry.headers = h; }).catch(() => { /* the request is gone */ });
    });
    ctx.on('requestfailed', (r) => {
      const entry = entries.get(r);
      if (!entry || !/INTERNET_DISCONNECTED/.test(r.failure()?.errorText || '')) return;
      const i = log.indexOf(entry);
      if (i >= 0) log.splice(i, 1);
    });
  };
  watch(typeof target.context === 'function' ? target.context() : target);
  const control = async (route, body) => {
    const res = await fetch(`${base}/__contract/${route}`, body ? { method: 'POST', body: JSON.stringify(body) } : {});
    if (!res.ok) throw new Error(`serve-local ${route}: ${res.status} ${await res.text()}`);
    return res.json();
  };
  /** A call to the Worker from the test itself (a teacher's class made before the student's device opens). */
  const api = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
    return data;
  };
  return {
    contract: true, st: null, log, base, tenant, api,
    attach: async (ctx) => watch(ctx),
    sql: async (sql, ...args) => (await control('sql', { sql, args })).rows,
    emails: async () => (await control('emails')).emails,
    escrows: async () => (await control('escrows')).escrows,
  };
}

// ---------------------------------------------------------------- what the server holds, from either backend
/** The vault a lookup token names: { rev, blob } or null. */
export async function vaultRow(srv, lookup) {
  if (!srv.contract) return srv.st.vaults[lookup] || null;
  const [row] = await srv.sql('SELECT rev, blob, updated_at AS updatedAt FROM vaults WHERE id_hash = ?', sha256(lookup));
  return row || null;
}
/** How many vaults the server holds. */
export async function vaultCount(srv) {
  if (!srv.contract) return Object.keys(srv.st.vaults).length;
  return (await srv.sql('SELECT count(*) AS n FROM vaults'))[0].n;
}
/** A vault deleted by its owner leaves a mark (410 vault_deleted for another device with the code). */
export async function tombstoned(srv, lookup) {
  if (!srv.contract) return srv.st.tombstones.has(lookup);
  return (await srv.sql('SELECT 1 AS x FROM vault_tombstones WHERE id_hash = ?', sha256(lookup))).length === 1;
}
/** The kept restore codes: [{ kind: 'student' | 'account', owner, code, label }]. */
export async function escrowsOf(srv) {
  if (!srv.contract) return srv.st.escrows.map((e) => ({ kind: e.kind, owner: e.owner, code: e.code, label: e.label ?? '' }));
  return (await srv.escrows()).map((e) => ({ kind: e.owner_kind, owner: e.owner_id, code: e.code, label: e.label }));
}
/** A class student's answers the server stored: [{ id, topic, level, ok }]. */
export async function answersOf(srv) {
  if (!srv.contract) return srv.st.answers;
  return srv.sql('SELECT client_id AS id, topic, level, ok FROM attempts ORDER BY id');
}
/** The 6-digit code the sign-in email carried to `email` (the fake takes any code; the Worker sends a real one). */
export async function emailedCode(srv, email) {
  if (!srv.contract) return '123456';
  const mails = (await srv.emails()).filter((m) => [].concat(m.to).includes(email));
  return String(mails.at(-1)?.text || '').match(/(\d{6})/)?.[1] || null;
}
/**
 * A class with one student who joined from another device: the class code, its name, the student's token and id. The
 * fake knows one class (K7Q2MD, ז׳3) and takes any token; the Worker gets the class made and the student joined.
 */
export async function joinedStudent(srv, { name = 'נועה', pin = '1234' } = {}) {
  if (!srv.contract) return { classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' };
  const c = await srv.api('/api/classes', { method: 'POST', body: { className: 'ז׳3', teacherName: 'רונית', grade: '7' } });
  const s = await srv.api(`/api/classes/${c.code}/join`, { method: 'POST', body: { name, pin } });
  return { classCode: c.code, className: c.className, token: s.token, studentId: s.studentId, teacherKey: c.teacherKey };
}
const hex32 = () => Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
/**
 * The real Worker only (the fake is set up by the test, st.devices and st.plan): a parent signs in with the emailed code,
 * buys the family plan through the test provider's payment page, and links a child's device. Returns the device's
 * family token and its X-Device id, as the app would hold them after the link.
 */
export async function familyDevice(srv, { label = 'הטאבלט', plan = 'family_month', email = 'parent@example.test' } = {}) {
  await srv.api('/api/account/code', { method: 'POST', body: { email } });
  const { token: session } = await srv.api('/api/account/verify', { method: 'POST', body: { email, code: await emailedCode(srv, email) } });
  const order = await srv.api('/api/billing/checkout', { method: 'POST', headers: { 'X-Account-Token': session, 'Idempotency-Key': hex32() }, body: { plan, adult: true, terms: '2026-11' } });
  const paid = await fetch(`${srv.base}/api/billing/test-pay/${order.orderId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result: 'paid' }), redirect: 'manual' });
  if (paid.status !== 303) throw new Error(`test-pay: ${paid.status}`);
  const device = hex32(); const secret = hex32();
  const link = await srv.api('/api/family/link/start', { method: 'POST', headers: { 'X-Device': device }, body: { secret } });
  await srv.api('/api/family/link/claim', { method: 'POST', headers: { 'X-Account-Token': session }, body: { code: link.code, label } });
  const done = await srv.api('/api/family/link/finish', { method: 'POST', headers: { 'X-Device': device }, body: { code: link.code, secret } });
  return { token: done.deviceToken, device };
}

/** A class for a student to join in the first questions: { code, className } (the fake's one class, or a new one). */
export async function classFor(srv) {
  if (!srv.contract) return { code: 'K7Q2MD', className: 'ז׳3' };
  const c = await srv.api('/api/classes', { method: 'POST', body: { className: 'ז׳3', teacherName: 'רונית', grade: '7' } });
  return { code: c.code, className: c.className, teacherKey: c.teacherKey };
}
