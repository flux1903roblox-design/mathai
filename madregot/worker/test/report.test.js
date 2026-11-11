// The parents' progress report on the Worker (PARENTS-3): a linked child device sends its day summaries (codes and
// counts only), the child and the parent each hold one switch, the parent reads and deletes, the night keeps 90 days,
// and the kill switch stops storing. Synthetic data only: example.test addresses, stubbed Claude and email, the paywall on.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, signIn, accountId, insertSub, linkDevice, makeClass, bearer, rows, one, setCount, countOf, netOf,
} from './helpers.js';
import { dayOf } from '../src/util.js';
import { shiftDay, REPORT_KEEP_DAYS, cleanDay } from '../src/report.js';
import { purge } from '../src/cron.js';

let h;
afterEach(() => h?.done());

const today = () => dayOf();
const ago = (n) => shiftDay(today(), -n);
/** A DaySummary as the app sends it (web/src/learn/report.ts). */
const day = (d, over = {}) => ({
  v: 1, d, m: 18, q: 22, ls: 2, st: 1, sk: ['signed:1', 'coord:2'], ma: ['signed:1'], rv: 1, fx: [['signed:1', 'minus-minus', 'o']], sr: 3, ex: null, ...over,
});
const post = (headers, days, opts = {}) => h.call('POST', '/api/family/summary', { headers, body: { days }, ...opts });
const childSwitch = (headers, body) => h.call('POST', '/api/family/summary/sharing', { headers, body });
const parentSwitch = (fam, id, on) => h.call('POST', `/api/family/devices/${id}/sharing`, { headers: fam.parent, body: { on } });
const status = async (headers) => (await (await h.call('GET', '/api/ai/status', { headers })).json()).linked;
const daily = (deviceId) => rows(h.env, 'SELECT * FROM family_daily WHERE device_id = ? ORDER BY day', deviceId);

/** A parent with a family plan (or none), signed in, and one linked child device. */
async function family(email = 'parent@example.test', { plan = true, label = 'הטאבלט' } = {}) {
  const token = await signIn(h, email);
  const a = accountId(h.env, email);
  if (plan) insertSub(h.env, { kind: 'family', account_id: a });
  const dev = await linkDevice(h.env, a, label);
  return { token, a, dev, parent: { 'X-Account-Token': token } };
}

test('1. a linked device posts today and yesterday: two rows; a second post for today replaces it; the sync time is kept', async () => {
  h = await setup();
  const fam = await family();
  const r = await post(fam.dev.headers, [day(ago(1)), day(today())]);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, saved: 2, sharing: 'on' });
  assert.deepEqual(daily(fam.dev.id).map((x) => x.day), [ago(1), today()]);
  const first = one(h.env, 'SELECT summary_sent_at FROM family_devices WHERE id = ?', fam.dev.id).summary_sent_at;
  assert.ok(first, 'summary_sent_at is set');
  const again = await post(fam.dev.headers, [day(today(), { m: 40, q: 50, sk: ['coord:2'], ma: [], fx: [['signed:1', 'minus-minus', 'd']], ex: { d: shiftDay(today(), 5), n: 1, of: 3 } })]);
  assert.equal(again.status, 200);
  const rowsNow = daily(fam.dev.id);
  assert.equal(rowsNow.length, 2, 'upsert, not append');
  const t = rowsNow.find((x) => x.day === today());
  assert.deepEqual({ m: t.minutes, q: t.questions, worked: t.worked, mastered: t.mastered, fixes: t.fixes, exam: t.exam },
    { m: 40, q: 50, worked: '["coord:2"]', mastered: '[]', fixes: '[["signed:1","minus-minus","d"]]', exam: JSON.stringify({ d: shiftDay(today(), 5), n: 1, of: 3 }) });
  assert.equal(rowsNow.find((x) => x.day === ago(1)).minutes, 18, 'yesterday untouched');
});

test('2. validation: every bad summary is refused with its field and nothing is written; over 8 KB is 413', async () => {
  h = await setup();
  const fam = await family();
  const stairs13 = Array.from({ length: 13 }, (_, i) => `signed:${i + 1}`);
  const bad = {
    'a 13th stair': [[day(today(), { sk: stairs13 })], 'sk'],
    'a 13th mastered stair': [[day(today(), { ma: stairs13 })], 'ma'],
    'm: 601': [[day(today(), { m: 601 })], 'm'],
    'a fraction': [[day(today(), { q: 2.5 })], 'q'],
    'a count as text': [[day(today(), { ls: '2' })], 'ls'],
    'a negative streak': [[day(today(), { sr: -1 })], 'sr'],
    'an extra key "name"': [[{ ...day(today()), name: 'נועה' }], 'keys'],
    'a missing key': [[(({ rv, ...rest }) => rest)(day(today()))], 'keys'],
    'v: 2': [[day(today(), { v: 2 })], 'v'],
    'a day 9 days back': [[day(ago(9))], 'd'],
    'a day 2 days ahead': [[day(shiftDay(today(), 2))], 'd'],
    'not a real day': [[day('2026-02-30')], 'd'],
    'fx state "x"': [[day(today(), { fx: [['signed:1', 'minus-minus', 'x']] })], 'fx'],
    'a mistake id with Hebrew': [[day(today(), { fx: [['signed:1', 'טעות', 'o']] })], 'fx'],
    '9 repairs': [[day(today(), { fx: Array.from({ length: 9 }, (_, i) => ['signed:1', `m${i}`, 'o']) })], 'fx'],
    'a stair id in capitals': [[day(today(), { sk: ['SIGNED:1'] })], 'sk'],
    'a stair twice': [[day(today(), { sk: ['signed:1', 'signed:1'] })], 'sk'],
    'an exam with another key': [[day(today(), { ex: { d: today(), n: 1, of: 2, name: 'x' } })], 'ex'],
    'an exam with n > of': [[day(today(), { ex: { d: today(), n: 3, of: 2 } })], 'ex'],
    '9 days in one body': [Array.from({ length: 9 }, (_, i) => day(ago(i))), 'days'],
    'no days': [[], 'days'],
    'a duplicated day': [[day(today()), day(today(), { m: 1 })], 'd'],
  };
  for (const [why, [days, field]] of Object.entries(bad)) {
    const r = await post(fam.dev.headers, days);
    assert.equal(r.status, 400, why);
    assert.deepEqual(await r.json(), { error: 'bad_summary', message: 'bad_summary', field }, why);
  }
  const extraTop = await h.call('POST', '/api/family/summary', { headers: fam.dev.headers, body: { days: [day(today())], label: 'x' } });
  assert.equal(extraTop.status, 400);
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0, 'nothing was written');
  // a body over 8 KB
  const big = await h.call('POST', '/api/family/summary', { headers: fam.dev.headers, body: JSON.stringify({ days: [day(today())], pad: 'x'.repeat(8200) }) });
  assert.equal(big.status, 413); assert.equal((await big.json()).error, 'too_large');
  // the edges of the window are accepted: 8 days back and tomorrow (a device's calendar may be ahead)
  assert.equal((await post(fam.dev.headers, [day(ago(8)), day(shiftDay(today(), 1))])).status, 200);
  // the longest repairs the whitelist allows fit the table (a 400, never a failed CHECK)
  const longest = Array.from({ length: 8 }, (_, i) => ['abcdefgh:12', `${'x'.repeat(28)}-${i}`, 'o']);
  const r = await post(fam.dev.headers, [day(today(), { fx: longest })]);
  assert.equal(r.status, 400); assert.equal((await r.json()).field, 'fx');
  assert.doesNotThrow(() => cleanDay(day(today(), { fx: longest.slice(0, 7) }), today()));
});

test('3. auth: a parent\'s session, a class student and an unknown device token are all 401 not_linked', async () => {
  h = await setup();
  const fam = await family();
  const asParent = await post(fam.parent, [day(today())]);
  assert.equal(asParent.status, 401); assert.equal((await asParent.json()).error, 'not_linked');
  assert.equal(asParent.headers.get('X-AI-Linked'), null);
  const cls = await makeClass(h, { students: ['דנה'] });
  const asStudent = await post(bearer(cls.students[0]), [day(today())]);
  assert.equal(asStudent.status, 401); assert.equal((await asStudent.json()).error, 'not_linked');
  const unknown = await post({ 'X-Family-Device': `fd1.${'e'.repeat(64)}` }, [day(today())]);
  assert.equal(unknown.status, 401); assert.equal((await unknown.json()).error, 'not_linked');
  assert.equal(unknown.headers.get('X-AI-Linked'), '0');
  // the child's switch needs the device too
  assert.equal((await childSwitch(fam.parent, { on: false })).status, 401);
  // and the parent's routes need the parent: the device token reaches nothing in the account
  for (const [m, p] of [['GET', '/api/family/summary'], ['POST', `/api/family/devices/${fam.dev.id}/sharing`], ['POST', `/api/family/devices/${fam.dev.id}/history/delete`]]) {
    const r = await h.call(m, p, { headers: fam.dev.headers, body: m === 'POST' ? { on: false } : undefined });
    assert.equal(r.status, 401, p); assert.equal((await r.json()).error, 'not_account', p);
  }
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0);
});

test('4. no live plan: an ended plan answers 402 and stores nothing; a device linked with no plan reports no_plan', async () => {
  h = await setup();
  const token = await signIn(h, 'ended@example.test');
  const a = accountId(h.env, 'ended@example.test');
  insertSub(h.env, { kind: 'family', account_id: a, status: 'ended', start: new Date(Date.now() - 31 * 864e5).toISOString(), end: new Date(Date.now() - 864e5).toISOString() });
  const dev = await linkDevice(h.env, a);
  const r = await post(dev.headers, [day(today())]);
  assert.equal(r.status, 402); assert.equal((await r.json()).error, 'needs_subscription');
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0);
  assert.equal((await status(dev.headers)).summary, 'no_plan');
  // a device linked for consent only (TRUST-9: no plan at all)
  const consent = await family('consent@example.test', { plan: false });
  assert.equal((await status(consent.dev.headers)).summary, 'no_plan');
  assert.equal((await post(consent.dev.headers, [day(today())])).status, 402);
  assert.ok(token);
});

test('5. the child\'s switch: stop and delete, then the parent\'s switch cannot turn it back on; only the child can', async () => {
  h = await setup();
  const fam = await family();
  await post(fam.dev.headers, [day(ago(1)), day(today())]);
  const off = await childSwitch(fam.dev.headers, { on: false, forget: true });
  assert.equal(off.status, 200); assert.deepEqual(await off.json(), { sharing: 'child_off' });
  assert.equal(daily(fam.dev.id).length, 0, 'the rows are gone');
  const dev = one(h.env, 'SELECT share_child, share_parent, share_at FROM family_devices WHERE id = ?', fam.dev.id);
  assert.equal(dev.share_child, 0); assert.equal(dev.share_parent, 1); assert.ok(dev.share_at);
  assert.equal((await status(fam.dev.headers)).summary, 'child_off');
  const refused = await post(fam.dev.headers, [day(today())]);
  assert.equal(refused.status, 403); assert.deepEqual(await refused.json(), { error: 'sharing_off', message: 'sharing_off', sharing: 'child_off' });
  // the parent turns theirs off: both off; back on: still off on the child's side, and a post is still refused
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, false)).json(), { sharing: 'both_off' });
  assert.equal((await status(fam.dev.headers)).summary, 'both_off');
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, true)).json(), { sharing: 'child_off' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 403);
  assert.equal(daily(fam.dev.id).length, 0);
  // the child turns it back on
  assert.deepEqual(await (await childSwitch(fam.dev.headers, { on: true })).json(), { sharing: 'on' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 200);
  // stopping without forgetting keeps the history for the parent
  await childSwitch(fam.dev.headers, { on: false });
  assert.equal(daily(fam.dev.id).length, 1);
  assert.equal((await childSwitch(fam.dev.headers, { on: 'no' })).status, 400);
});

test('6. the parent\'s switch: off stores nothing; the child cannot turn it back on; only the parent can', async () => {
  h = await setup();
  const fam = await family();
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, false)).json(), { sharing: 'parent_off' });
  assert.equal((await status(fam.dev.headers)).summary, 'parent_off');
  const r = await post(fam.dev.headers, [day(today())]);
  assert.equal(r.status, 403); assert.equal((await r.json()).sharing, 'parent_off');
  assert.equal(daily(fam.dev.id).length, 0);
  assert.equal(one(h.env, 'SELECT summary_sent_at FROM family_devices WHERE id = ?', fam.dev.id).summary_sent_at, null);
  assert.deepEqual(await (await childSwitch(fam.dev.headers, { on: false })).json(), { sharing: 'both_off' });
  assert.deepEqual(await (await childSwitch(fam.dev.headers, { on: true })).json(), { sharing: 'parent_off' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 403);
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, true)).json(), { sharing: 'on' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 200);
  // another account's device is not found; a bad body is refused
  const other = await family('other@example.test');
  assert.equal((await parentSwitch(fam, other.dev.id, false)).status, 404);
  assert.equal((await h.call('POST', `/api/family/devices/${fam.dev.id}/sharing`, { headers: fam.parent, body: { on: 1 } })).status, 400);
  // the audit names the switch and who, and nothing personal
  const audit = rows(h.env, "SELECT actor, action, target, detail FROM audit_log WHERE action LIKE 'summary.%' ORDER BY id");
  assert.deepEqual(audit.map((x) => x.action), ['summary.parent_off', 'summary.child_off', 'summary.child_on', 'summary.parent_on']);
  assert.deepEqual(audit.map((x) => x.actor.split(':')[0]), ['account', 'device', 'device', 'account']);
  assert.doesNotMatch(JSON.stringify(audit), /@|הטאבלט/);
});

test('7. the parent reads only their own devices, 7 to 90 days, as the app\'s DaySummary, also after the plan ended', async () => {
  h = await setup();
  const fam = await family();
  const other = await family('other@example.test', { label: 'הטלפון' });
  const sent = [day(ago(2), { ex: { d: shiftDay(today(), 3), n: 2, of: 4 } }), day(today())];
  await post(fam.dev.headers, sent);
  await post(other.dev.headers, [day(today(), { m: 99 })]);
  const raw = (d, m) => h.env.DB.raw.prepare(`INSERT INTO family_daily (device_id, day, minutes, updated_at) VALUES (?, ?, ?, 'x')`).run(fam.dev.id, d, m);
  raw(ago(10), 1); raw(ago(60), 2); raw(ago(89), 3);
  const get = async (q = '') => (await h.call('GET', `/api/family/summary${q}`, { headers: fam.parent })).json();
  const all = await get();
  assert.equal(all.retentionDays, REPORT_KEEP_DAYS);
  assert.equal(all.days, 56);
  assert.equal(all.devices.length, 1, 'never another account\'s device');
  const d = all.devices[0];
  assert.deepEqual({ id: d.id, label: d.label, sharing: d.sharing, sharingAt: d.sharingAt }, { id: fam.dev.id, label: 'הטאבלט', sharing: 'on', sharingAt: null });
  assert.ok(d.lastSync); assert.ok(d.linkedAt); assert.ok(d.lastSeen);
  assert.deepEqual(d.days.map((x) => x.d), [ago(10), ago(2), today()]);
  assert.deepEqual(d.days.slice(1), sent, 'the rows come back as the app sent them');
  assert.doesNotMatch(JSON.stringify(all), /99|הטלפון/);
  // days clamps to 7..90
  assert.equal((await get('?days=3')).days, 7);
  assert.deepEqual((await get('?days=3')).devices[0].days.map((x) => x.d), [ago(2), today()]);
  assert.equal((await get('?days=500')).days, 90);
  assert.deepEqual((await get('?days=500')).devices[0].days.map((x) => x.d), [ago(89), ago(60), ago(10), ago(2), today()]);
  assert.equal((await get('?days=abc')).days, 56);
  // after the plan ended: still readable (and deletable), the state says why nothing new arrives
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'ended', current_period_end = ? WHERE account_id = ?").run(new Date(Date.now() - 864e5).toISOString(), fam.a);
  const ended = await get();
  assert.equal(ended.devices[0].sharing, 'no_plan');
  assert.equal(ended.devices[0].days.length, 3);
  assert.equal((await h.call('GET', '/api/family/summary')).status, 401);
});

test('8. deletion: unlink, leave and the parent\'s delete history remove the rows explicitly, with the FK cascade off', async () => {
  h = await setup();
  // the explicit delete is what is proved, not the cascade
  h.env.DB.raw.exec('PRAGMA foreign_keys = OFF');
  const fam = await family();
  const second = await linkDevice(h.env, fam.a, 'הטלפון');
  const third = await linkDevice(h.env, fam.a, 'המחשב');
  for (const d of [fam.dev, second, third]) assert.equal((await post(d.headers, [day(ago(1)), day(today())])).status, 200);
  // the parent deletes one device's history: rows gone, device kept
  const del = await h.call('POST', `/api/family/devices/${fam.dev.id}/history/delete`, { headers: fam.parent, body: {} });
  assert.deepEqual(await del.json(), { ok: true, deleted: 2 });
  assert.equal(daily(fam.dev.id).length, 0);
  assert.ok(one(h.env, 'SELECT id FROM family_devices WHERE id = ?', fam.dev.id), 'the device stays linked');
  assert.ok(one(h.env, "SELECT * FROM audit_log WHERE action = 'summary.delete'"));
  // the parent unlinks a device
  assert.equal((await h.call('POST', `/api/family/devices/${second.id}/unlink`, { headers: fam.parent, body: {} })).status, 200);
  assert.equal(daily(second.id).length, 0, 'unlink');
  // a device leaves by itself
  assert.equal((await h.call('POST', '/api/family/devices/leave', { headers: third.headers, body: {} })).status, 200);
  assert.equal(daily(third.id).length, 0, 'leave');
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0);
  // another account cannot delete this account's history
  const other = await family('other@example.test');
  assert.equal((await h.call('POST', `/api/family/devices/${fam.dev.id}/history/delete`, { headers: other.parent, body: {} })).status, 404);
});

test('9. the night keeps exactly 90 days, and sweeps the rows of devices that are gone', async () => {
  h = await setup();
  const fam = await family();
  const now = new Date('2026-11-11T01:10:00Z'); // 03:10 in Jerusalem
  const t = dayOf(now);
  const ins = (dev, d) => h.env.DB.raw.prepare(`INSERT INTO family_daily (device_id, day, updated_at) VALUES (?, ?, 'x')`).run(dev, d);
  ins(fam.dev.id, shiftDay(t, -90)); ins(fam.dev.id, shiftDay(t, -89)); ins(fam.dev.id, t);
  // a device unused for a year (the family purge deletes it) and a row whose device is already gone, with the FK off
  h.env.DB.raw.exec('PRAGMA foreign_keys = OFF');
  const stale = await linkDevice(h.env, fam.a, 'ישן');
  h.env.DB.raw.prepare('UPDATE family_devices SET last_seen = ? WHERE id = ?').run(shiftDay(t, -400), stale.id);
  ins(stale.id, shiftDay(t, -1));
  ins('0000000000000000', shiftDay(t, -1));
  await purge(h.env, now);
  assert.deepEqual(daily(fam.dev.id).map((x) => x.day), [shiftDay(t, -89), t]);
  assert.ok(!one(h.env, 'SELECT id FROM family_devices WHERE id = ?', stale.id), 'the stale device was purged');
  assert.equal(rows(h.env, 'SELECT * FROM family_daily WHERE device_id != ?', fam.dev.id).length, 0, 'and its rows, and the orphan');
  // the cut moves with the clock
  await purge(h.env, new Date(now.getTime() + 864e5));
  assert.deepEqual(daily(fam.dev.id).map((x) => x.day), [t]);
});

test('10. the status shows the summary\'s state for each switch, the plan and the paywall', async () => {
  h = await setup();
  const fam = await family();
  assert.deepEqual(await status(fam.dev.headers), { label: 'הטאבלט', summary: 'on' });
  await childSwitch(fam.dev.headers, { on: false });
  assert.equal((await status(fam.dev.headers)).summary, 'child_off');
  await parentSwitch(fam, fam.dev.id, false);
  assert.equal((await status(fam.dev.headers)).summary, 'both_off');
  await childSwitch(fam.dev.headers, { on: true });
  assert.equal((await status(fam.dev.headers)).summary, 'parent_off');
  h.env.PARENT_REPORT = 'off';
  assert.equal((await status(fam.dev.headers)).summary, 'off');
  // a phone with no family device has no linked at all
  assert.equal(await status({}), null);
  h.done();
  // with the paywall off there is no family plan, so the report is off; the device still shows as linked
  h = await setup({ AI_PAYWALL: 'off' });
  const off = await family('off@example.test');
  const s = await (await h.call('GET', '/api/ai/status', { headers: off.dev.headers })).json();
  assert.equal(s.paywall, false);
  assert.deepEqual(s.linked, { label: 'הטאבלט', summary: 'off' });
  assert.equal(Object.hasOwn(await (await h.call('GET', '/api/ai/status')).json(), 'linked'), false);
  assert.equal((await post(off.dev.headers, [day(today())])).status, 503);
});

test('11. PARENT_REPORT "off": the device cannot store or turn sharing on; stopping, reading and deleting still work', async () => {
  h = await setup({ PARENT_REPORT: 'off' });
  const fam = await family();
  h.env.DB.raw.prepare(`INSERT INTO family_daily (device_id, day, updated_at) VALUES (?, ?, 'x')`).run(fam.dev.id, ago(3));
  const r = await post(fam.dev.headers, [day(today())]);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'report_off');
  assert.equal((await childSwitch(fam.dev.headers, { on: true })).status, 503);
  assert.equal((await status(fam.dev.headers)).summary, 'off');
  const plans = await (await h.call('GET', '/api/billing/plans')).json();
  assert.equal(plans.report, false);
  const got = await (await h.call('GET', '/api/family/summary', { headers: fam.parent })).json();
  assert.equal(got.devices[0].sharing, 'off'); assert.equal(got.devices[0].days.length, 1, 'kept rows stay readable');
  const stop = await childSwitch(fam.dev.headers, { on: false, forget: true });
  assert.equal(stop.status, 200); assert.deepEqual(await stop.json(), { sharing: 'off' });
  assert.equal(daily(fam.dev.id).length, 0, 'and the child can still stop and delete');
  h.done();
  h = await setup();
  assert.equal((await (await h.call('GET', '/api/billing/plans')).json()).report, true, 'on by default with the paywall on');
});

test('12. at most 150 posts a day per device, also when 151 arrive at once, and 3000 per network', async () => {
  h = await setup();
  const fam = await family();
  const results = await Promise.all(Array.from({ length: 151 }, (_, i) => post(fam.dev.headers, [day(today(), { m: i % 600 })])));
  const codes = results.map((r) => r.status);
  assert.equal(codes.filter((c) => c === 200).length, 150);
  assert.equal(codes.filter((c) => c === 429).length, 1);
  assert.equal(countOf(h.env, `sum:d:${fam.dev.id}`), 150);
  const after = await post(fam.dev.headers, [day(today())]);
  assert.equal(after.status, 429); assert.equal((await after.json()).error, 'slow_down');
  // the network's ceiling, for another device
  const other = await family('net@example.test');
  await setCount(h.env, `sum:n:${await netOf(h.env)}`, 3000);
  assert.equal((await post(other.dev.headers, [day(today())])).status, 429);
  assert.equal((await post(other.dev.headers, [day(today())], { ip: '198.51.100.9' })).status, 200, 'another network');
});

test('13. what is stored is ASCII codes and counts: no Hebrew, no label, no name, no address', async () => {
  h = await setup();
  const fam = await family('privacy@example.test', { label: 'הטאבלט של נועה' });
  await post(fam.dev.headers, [
    day(ago(3), { sk: ['angles:5', 'expr:2', 'eq:1'], ma: ['eq:1'], fx: [['eq:1', 'move-no-flip', 'o'], ['angles:5', 'sum-180', 'd']], ex: { d: shiftDay(today(), 9), n: 1, of: 5 } }),
    day(ago(1), { m: 0, q: 0, sk: [], ma: [], fx: [] }),
    day(today()),
  ]);
  // a summary with Hebrew or a name in it never gets in
  for (const bad of [{ ...day(today()), label: 'נועה' }, day(today(), { sk: ['שבר:1'] }), day(today(), { fx: [['signed:1', 'privacy@example.test', 'o']] })]) {
    assert.equal((await post(fam.dev.headers, [bad])).status, 400);
  }
  const stored = rows(h.env, 'SELECT * FROM family_daily');
  assert.equal(stored.length, 3);
  for (const r of stored) {
    for (const [col, v] of Object.entries(r)) {
      if (typeof v !== 'string') continue;
      assert.match(v, /^[\x20-\x7e]*$/, `${col} is ASCII`);
      assert.doesNotMatch(v, /@/, col);
    }
  }
});
