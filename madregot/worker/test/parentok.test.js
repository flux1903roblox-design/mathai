// A parent's OK before a child alone uses the tutor (trust spec TRUST-9): with AI_PARENT_OK = "required" (the default)
// a device with no class, no teacher and no parent's link gets 403 parent_ok_needed, logged as a count with no text,
// before the free taste and before the switch-off path. A signed-in parent approves a device once, for free (purpose
// 'consent', with the tick), and gets the AI and privacy summary by email (Appendix E §E.4). Claude and the email service
// are stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parentOkRequired } from '../src/entitle.js';
import { run } from '../src/cron.js';
import { dayOf, jerusalemMidnight } from '../src/util.js';
import {
  setup, ai, signIn, accountId, insertSub, makeClass, bearer, setCount, countOf, rows, one, devOf, DEVICE,
} from './helpers.js';

let h;
afterEach(() => h?.done());
const SECRET = 'b'.repeat(32);
const here = path.dirname(fileURLToPath(import.meta.url));
const events = () => rows(h.env, 'SELECT kind, surface, source FROM safety_events ORDER BY id').map((r) => ({ ...r }));
const status = async (headers = {}) => {
  const r = await h.call('GET', '/api/ai/status', { headers });
  return { status: r.status, headers: r.headers, body: await r.json() };
};
const required = (over = {}) => setup({ AI_PARENT_OK: 'required', ...over });

/** The child's device shows a code; the parent (signed in) claims it with `body`; the device collects its token. */
async function linkByCode(token, body, device = DEVICE) {
  const s = await h.call('POST', '/api/family/link/start', { headers: { 'X-Device': device }, body: { secret: SECRET } });
  const { code } = await s.json();
  const c = await h.call('POST', '/api/family/link/claim', { headers: { 'X-Account-Token': token }, body: { code, label: 'הטאבלט', ...body } });
  const out = { claim: c.status, error: c.status === 200 ? null : (await c.json()).error };
  if (c.status !== 200) return out;
  const f = await h.call('POST', '/api/family/link/finish', { body: { code, secret: SECRET } });
  const { deviceToken } = await f.json();
  return { ...out, headers: { 'X-Family-Device': deviceToken, 'X-Device': device } };
}

test('"required" is the default: in wrangler.toml, and in the code when the var is unset; only "off" turns it off', () => {
  const toml = readFileSync(path.join(here, '..', 'wrangler.toml'), 'utf8');
  assert.match(toml, /^AI_PARENT_OK = "required"$/m);
  assert.equal(parentOkRequired({}), true);
  assert.equal(parentOkRequired({ AI_PARENT_OK: '' }), true);
  assert.equal(parentOkRequired({ AI_PARENT_OK: 'required' }), true);
  assert.equal(parentOkRequired({ AI_PARENT_OK: 'yes' }), true, 'anything unclear keeps the check');
  assert.equal(parentOkRequired({ AI_PARENT_OK: 'off' }), false);
});

test('the plans the parents\' page reads say whether the free OK is needed', async () => {
  h = await required();
  assert.equal((await (await h.call('GET', '/api/billing/plans')).json()).parentOk, true);
  h.done();
  h = await setup({ AI_PARENT_OK: 'off' });
  assert.equal((await (await h.call('GET', '/api/billing/plans')).json()).parentOk, false);
});

test('a child alone gets 403 parent_ok_needed and the status says so: nothing counted, no AI call, one count logged', async () => {
  h = await required();
  const r = await ai(h, 'chat', { 'X-Device': DEVICE });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'parent_ok_needed');
  for (const kind of ['explain', 'check']) assert.equal((await ai(h, kind, { 'X-Device': DEVICE })).status, 403, kind);
  // no device id at all: the same
  assert.equal((await ai(h, 'explain')).status, 403);
  assert.equal(h.net.log.claude.length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage').length, 0, 'no counter moved, not even the free taste\'s');
  assert.deepEqual(events(), [
    { kind: 'parent_ok_needed', surface: 'chat', source: 'server' },
    { kind: 'parent_ok_needed', surface: 'explain', source: 'server' },
    { kind: 'parent_ok_needed', surface: 'check', source: 'server' },
    { kind: 'parent_ok_needed', surface: 'explain', source: 'server' },
  ]);
  const s = await status({ 'X-Device': DEVICE });
  assert.equal(s.status, 200);
  assert.equal(s.body.state, 'parent_ok_needed');
  assert.equal(s.body.tier, null);
  assert.deepEqual(s.body.kinds, []);
  assert.equal(events().length, 4, 'a status call is not a request: nothing more is logged');
  // a family-device token that is no longer valid: the same answer, and the device is told to forget it
  const bad = await ai(h, 'chat', { 'X-Device': DEVICE, 'X-Family-Device': `fd1.${'0'.repeat(64)}` });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('X-AI-Linked'), '0');
  // with the paywall off the check comes first too (the open solo limits are not a way round it)
  h.done();
  h = await required({ AI_PAYWALL: 'off' });
  const open = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(open.status, 403); assert.equal((await open.json()).error, 'parent_ok_needed');
  const so = await status({ 'X-Device': DEVICE });
  assert.equal(so.body.state, 'parent_ok_needed'); assert.equal(so.body.paywall, false);
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage').length, 0);
});

test('with AI_PARENT_OK = "off" a child alone is served as before; with ALLOW_SOLO_AI = "false" no OK is asked for', async () => {
  h = await setup({ AI_PARENT_OK: 'off' });
  const r = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'free');
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 1);
  assert.equal((await status({ 'X-Device': DEVICE })).body.tier, 'free');
  assert.equal(rows(h.env, "SELECT * FROM safety_events WHERE kind = 'parent_ok_needed'").length, 0);
  // the owner turned the tutor off for everyone outside a class: a parent's OK would not open it, so it is not asked for
  h.done();
  h = await required({ ALLOW_SOLO_AI: 'false' });
  const solo = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(solo.status, 403); assert.equal((await solo.json()).error, 'solo_ai_off');
  const s = await status({ 'X-Device': DEVICE });
  assert.equal(s.body.state, undefined); assert.deepEqual(s.body.kinds, []);
});

test('a parent with no plan approves a device for free: consent needs the tick; the device gets the free taste on free:fd', async () => {
  h = await required();
  const token = await signIn(h, 'parent@example.test');
  const a = accountId(h.env, 'parent@example.test');
  // the plan purpose needs a plan; the free OK needs the tick, sent as true (not "true", not 1)
  assert.deepEqual(await linkByCode(token, { purpose: 'plan', consent: true }), { claim: 402, error: 'needs_subscription' });
  assert.deepEqual(await linkByCode(token, { purpose: 'consent' }), { claim: 400, error: 'consent_required' });
  assert.deepEqual(await linkByCode(token, { purpose: 'consent', consent: 'true' }), { claim: 400, error: 'consent_required' });
  assert.deepEqual(await linkByCode(token, {}), { claim: 400, error: 'consent_required' }, 'no purpose and no plan: the free OK');
  assert.equal(rows(h.env, 'SELECT * FROM family_devices').length, 0, 'no device row without the tick');
  const ok = await linkByCode(token, { purpose: 'consent', consent: true });
  assert.equal(ok.claim, 200);
  const dev = one(h.env, 'SELECT id FROM family_devices WHERE account_id = ?', a).id;
  // the device is no longer a child alone: the free taste, counted on its own device key
  const s = await status(ok.headers);
  assert.equal(s.body.state, undefined); assert.equal(s.body.tier, 'free'); assert.equal(s.body.groups.tutor.left, 2);
  // (the family lane's daily summary for the parents: no plan, so nothing is kept)
  assert.deepEqual(s.body.linked, { label: 'הטאבלט', summary: 'no_plan' });
  const r = await ai(h, 'chat', ok.headers);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'free');
  assert.equal(h.net.log.claude.at(-1).model, 'claude-haiku-5-5');
  assert.equal(countOf(h.env, `free:fd:${dev}`), 1);
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 0);
  // the free taste is still the free taste: no photo check
  assert.equal((await ai(h, 'check', ok.headers)).status, 402);
  // the record: an audit row with the purpose, and the notice with it
  const audit = JSON.parse(one(h.env, "SELECT detail FROM audit_log WHERE action = 'device.link'").detail);
  assert.deepEqual(audit, { how: 'code', purpose: 'consent' });
  const notice = one(h.env, "SELECT * FROM notices WHERE kind LIKE 'device_linked:%'");
  assert.equal(notice.to_account, a);
  assert.equal(JSON.parse(notice.params).purpose, 'consent');
  // a plan later: the same device is the family's, with no new link
  insertSub(h.env, { kind: 'family', account_id: a });
  const fam = await ai(h, 'explain', ok.headers);
  assert.equal(fam.headers.get('X-AI-Tier'), 'family');
  assert.equal(rows(h.env, 'SELECT * FROM family_devices').length, 1);
  // the parent takes the OK back: the device is a child alone again
  const un = await h.call('POST', `/api/family/devices/${dev}/unlink`, { headers: { 'X-Account-Token': token }, body: {} });
  assert.equal(un.status, 200);
  const after = await ai(h, 'explain', ok.headers);
  assert.equal(after.status, 403); assert.equal((await after.json()).error, 'parent_ok_needed');
  assert.equal(after.headers.get('X-AI-Linked'), '0');
});

test('the parent holding the child\'s device approves it there: purpose consent, the tick, the session ends on that device', async () => {
  h = await required();
  const token = await signIn(h, 'here@example.test');
  const call = (body) => h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': token, 'X-Device': DEVICE }, body });
  const no = await call({ label: 'הטלפון של נועה' });
  assert.equal(no.status, 400); assert.equal((await no.json()).error, 'consent_required');
  const r = await call({ label: 'הטלפון של נועה', purpose: 'consent', consent: true });
  assert.equal(r.status, 200);
  const { deviceToken } = await r.json();
  assert.equal((await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).status, 401, 'no parent session stays on the child\'s device');
  assert.deepEqual(JSON.parse(one(h.env, "SELECT detail FROM audit_log WHERE action = 'device.link'").detail), { how: 'this_device', purpose: 'consent' });
  const c = await ai(h, 'chat', { 'X-Family-Device': deviceToken, 'X-Device': DEVICE });
  assert.equal(c.status, 200); assert.equal(c.headers.get('X-AI-Tier'), 'free');
});

test('the device limit (3) counts approved devices and plan devices together', async () => {
  h = await required();
  const token = await signIn(h, 'three@example.test');
  for (let i = 0; i < 3; i++) assert.equal((await linkByCode(token, { purpose: 'consent', consent: true }, String(i).repeat(32))).claim, 200);
  const fourth = await linkByCode(token, { purpose: 'consent', consent: true }, 'e'.repeat(32));
  assert.deepEqual({ claim: fourth.claim, error: fourth.error }, { claim: 409, error: 'device_limit' });
});

test('the parent\'s email at that moment: the AI and privacy summary (E.4), with no price and no billing footer', async () => {
  h = await required({ CONTACT_PHONE: '03-0000000' });
  const token = await signIn(h, 'mail@example.test');
  assert.equal((await linkByCode(token, { purpose: 'consent', consent: true })).claim, 200);
  await h.ctx.flush();
  const mail = h.net.log.email.find((m) => m.subject === 'אישרתם את העוזר החכם במכשיר של הילד');
  assert.ok(mail, 'sent');
  assert.deepEqual(mail.to, ['mail@example.test']);
  const t = mail.text;
  assert.match(t, /ב־.+ אישרתם את העוזר החכם של מדרגות במכשיר "הטאבלט"\./);
  assert.match(t, /בחינם, העוזר עונה במכשיר הזה על 2 שאלות קצרות ביום במתמטיקה\./);
  assert.match(t, /תוכנת בינה מלאכותית \(Claude של Anthropic\), לא אדם, והוא יכול לטעות/);
  assert.match(t, /לא שם, מייל או טלפון\. המידע נשלח ל־Anthropic בארה״ב/);
  assert.match(t, /ער״ן 1201\)\. אנחנו לא שולחים לכם את מה שהילד כתב\./);
  assert.match(t, /לביטול האישור: https:\/\/madregot\.example\.test\/parents, או השיבו למייל הזה\./);
  assert.match(t, /מדיניות הפרטיות: https:\/\/madregot\.example\.test\/privacy/);
  assert.match(t, /לא אתם אישרתם\? השיבו למייל הזה ונבטל\./);
  assert.ok(!/₪|מנוי|\/cancel/.test(t), 'no price, no plan, no cancellation footer');
  assert.equal(mail.reply_to, 'hello@example.test');
  // the number follows the limits in force, and one question reads as one question
  h.done();
  h = await required({ FREE_DAILY_LIMIT: '1' });
  const t2 = await signIn(h, 'one@example.test');
  const s = await h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': t2, 'X-Device': DEVICE }, body: { purpose: 'consent', consent: true } });
  assert.equal(s.status, 200);
  await h.ctx.flush();
  const m2 = h.net.log.email.find((m) => m.subject === 'אישרתם את העוזר החכם במכשיר של הילד');
  assert.match(m2.text, /על שאלה קצרה אחת ביום/);
  assert.match(m2.text, /במכשיר של הילד\./, 'no label: "של הילד"');
  // with the paywall off there is no free taste to count
  h.done();
  h = await required({ AI_PAYWALL: 'off' });
  const t4 = await signIn(h, 'open@example.test');
  assert.equal((await linkByCode(t4, { purpose: 'consent', consent: true })).claim, 200);
  await h.ctx.flush();
  const m4 = h.net.log.email.find((m) => m.subject === 'אישרתם את העוזר החכם במכשיר של הילד');
  assert.match(m4.text, /מה זה אומר: כרגע העוזר פתוח בחינם, ועונה במכשיר הזה על שאלות במתמטיקה\./);
  // a link for a plan keeps the plan's email
  h.done();
  h = await required();
  const t3 = await signIn(h, 'plan@example.test');
  insertSub(h.env, { kind: 'family', account_id: accountId(h.env, 'plan@example.test') });
  assert.equal((await linkByCode(t3, {})).claim, 200);
  await h.ctx.flush();
  assert.ok(h.net.log.email.some((m) => m.subject === 'מכשיר חדש חובר למנוי'));
  assert.ok(!h.net.log.email.some((m) => m.subject === 'אישרתם את העוזר החכם במכשיר של הילד'));
});

test('a class student and a teacher are not asked for a parent\'s OK', async () => {
  h = await required();
  const cls = await makeClass(h, { students: ['נועה'], studentAi: true });
  const s = await ai(h, 'explain', bearer(cls.students[0]));
  assert.equal(s.status, 200);
  const t = await ai(h, 'explain', cls.teacher);
  assert.equal(t.status, 200);
  assert.equal((await status(bearer(cls.students[0]))).body.state, undefined);
  assert.equal((await status(cls.teacher)).body.state, undefined);
  // a school class keeps its own answer (the class's rule, not a parent's OK)
  const school = await makeClass(h, { students: ['יואב'] });
  const sc = await ai(h, 'explain', bearer(school.students[0]));
  assert.equal(sc.status, 403); assert.equal((await sc.json()).error, 'class_ai_off');
  assert.equal(rows(h.env, "SELECT * FROM safety_events WHERE kind = 'parent_ok_needed'").length, 0);
});

test('the owner\'s daily summary counts yesterday\'s requests that waited for a parent\'s OK', async () => {
  h = await required({ OWNER_DAILY_SUMMARY: 'true' });
  const night = new Date(jerusalemMidnight(dayOf()).ms + 3 * 3600_000 + 10 * 60_000); // 03:10 in Jerusalem, when the night jobs run
  const y = dayOf(new Date(night.getTime() - 864e5));
  const st = h.env.DB.raw.prepare("INSERT INTO safety_events (day, kind, surface, source) VALUES (?, 'parent_ok_needed', 'chat', 'server')");
  for (let i = 0; i < 3; i++) st.run(y);
  st.run(dayOf(night)); // today's are tomorrow's news
  await run(h.env, { now: night });
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${y}`).params);
  assert.equal(p.parentOkNeeded, 3);
  const mail = h.net.log.email.find((m) => m.subject.startsWith(`[מדרגות] סיכום יומי ${y}`));
  assert.match(mail.text, /בקשות לעוזר ממכשירים שמחכים לאישור של הורה: 3/);
});
