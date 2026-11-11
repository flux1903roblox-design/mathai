// The opt-in daily reminder on the server (STUDENT-11, src/push.js): the four endpoints behind PUSH = "on", the push
// address check, the hour, Shabbat, Yom Tov, memorial days and their eves, the batch and one VAPID token per push
// service, what each answer of a push service does, the back-off, the texts, retention and the switch.
// In-memory D1 and a fake push service that decrypts what it gets; every address is synthetic. Nothing leaves the machine.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, rows, one, netOf, setCount, makeCtx } from './helpers.js';
import { makeSubscription } from './fixtures/push.js';
import {
  pushDue, pushNight, pushEndpointOk, messageFor, payloadFor, TEXTS, TITLE, PUSH_LIMITS, PUSH_CRON, dayOfYear, pushConfigError,
} from '../src/push.js';
import { fromB64u } from '../src/webpush.js';
import { purgeRecordsSql, run } from '../src/cron.js';
import { makeVapidKeys } from '../scripts/push-keys.mjs';
import { sha256, jerusalemMidnight, dayOf } from '../src/util.js';
import { shiftDay } from '../src/goal.js';

let h;
afterEach(() => h?.done());

const VAPID = await makeVapidKeys();
const PUSH_ENV = {
  PUSH: 'on', VAPID_PUBLIC_KEY: VAPID.publicKey, VAPID_PRIVATE_JWK: JSON.stringify(VAPID.jwk),
  VAPID_SUBJECT: 'mailto:hello@example.test', PUSH_BATCH: '10',
};
const FCM = 'https://fcm.googleapis.com/fcm/send/';
const MOZ = 'https://updates.push.services.mozilla.com/wpush/v2/';

/** A fake push service: answers `status(url)` (201 by default) and keeps each request. */
function pushService(status = () => 201) {
  const got = [];
  return {
    got,
    other: async (url, body, init) => {
      got.push({ url, body, headers: init.headers });
      const s = status(url);
      if (s === 'throw') throw new TypeError('network down');
      return new Response(null, { status: s });
    },
  };
}
async function start(over = {}, svc = pushService()) {
  h = await setup({ ...PUSH_ENV, ...over }, { other: svc.other });
  h.svc = svc;
  return h;
}
/** The instant hh:mm in Jerusalem on a YYYY-MM-DD day (no clock change on these days). */
const at = (day, hh, mm = 7) => new Date(jerusalemMidnight(day).ms + (hh * 60 + mm) * 60_000);

const subs = new Map(); // endpoint -> the browser's keys (to decrypt)
let seq = 0;
/** A subscription row written directly: real keys, so the fake service can decrypt what it gets. */
async function addRow(env, { slot = 17, endpoint, status = 'on', done = null, sent = null, seen = null, misses = 0, created = '2026-11-01T10:00:00.000Z' } = {}) {
  const sub = await makeSubscription();
  const id = (seq++).toString(16).padStart(16, '0');
  const ep = endpoint || `${FCM}synthetic-${id}`;
  subs.set(ep, sub);
  env.DB.raw.prepare(`INSERT INTO push_subs (id, secret_hash, endpoint, p256dh, auth, slot, status, created_at, last_seen_day, last_done_day, last_sent_day, misses)
    VALUES (?, 'hash', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, ep, sub.p256dh, sub.auth, slot, status, created, seen, done, sent, misses);
  return id;
}
const sentTo = () => h.svc.got.map((g) => g.url);
const metric = (name, day) => one(h.env, 'SELECT n FROM metrics_daily WHERE name = ? AND day = ?', name, day)?.n ?? 0;
const subscribeBody = async (over = {}) => {
  const sub = await makeSubscription();
  return { endpoint: `${FCM}e-${crypto.randomUUID()}`, keys: { p256dh: sub.p256dh, auth: sub.auth }, slot: '17', ...over };
};

// ---------------------------------------------------------------- 1, 2b: subscribe and the push address check
test('1. subscribe: a push service address -> 200 and a row with the secret hashed; any other host -> 400 bad_endpoint', async () => {
  await start();
  const bad = await h.call('POST', '/api/push/subscribe', { body: await subscribeBody({ endpoint: 'https://example.test/push/1' }) });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'bad_endpoint');
  assert.equal(rows(h.env, 'SELECT * FROM push_subs').length, 0);
  const body = await subscribeBody({ slot: 17 });
  const r = await h.call('POST', '/api/push/subscribe', { body });
  assert.equal(r.status, 200);
  const { id, secret } = await r.json();
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.match(secret, /^[0-9a-f]{32}$/);
  const row = one(h.env, 'SELECT * FROM push_subs');
  assert.equal(row.id, id);
  assert.equal(row.secret_hash, await sha256(secret));
  assert.equal(row.endpoint, body.endpoint);
  assert.equal(row.slot, 17);
  assert.equal(row.status, 'on');
  assert.equal(row.last_seen_day, dayOf());
  assert.ok(!JSON.stringify(rows(h.env, 'SELECT * FROM push_subs')).includes(secret), 'the secret itself is never stored');
  // the table holds no name, class, account, device or address
  const cols = h.env.DB.raw.prepare('PRAGMA table_info(push_subs)').all().map((c) => c.name);
  assert.deepEqual(cols, ['id', 'secret_hash', 'endpoint', 'p256dh', 'auth', 'slot', 'status', 'created_at', 'last_seen_day', 'last_done_day', 'last_sent_day', 'misses']);
});

test('2b. the endpoint check matches a push service on a label boundary, https only, with no port', async () => {
  for (const ok of ['https://web.push.apple.com/x', 'https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://db5p.notify.windows.com/w/?token=x', 'https://push.apple.com/x']) assert.equal(pushEndpointOk(ok), true, ok);
  for (const bad of ['https://evil.example/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.example/x', 'https://xfcm.googleapis.com.example/',
    'http://fcm.googleapis.com/x', 'https://xfcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://fcm.googleapis.com:443/x',
    'https://user@fcm.googleapis.com/x', 'https://fcm.googleapis.com./x', 'https://evil.example?fcm.googleapis.com', 'https://evil.example#.fcm.googleapis.com',
    'https://[::1]/fcm.googleapis.com', 'javascript:alert(1)', '', 'https://fcm.googleapis.com/' + 'x'.repeat(2100), null, 42]) {
    assert.equal(pushEndpointOk(bad), false, String(bad).slice(0, 60));
  }
  await start();
  for (const endpoint of ['https://evil.example/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.example/x', 'https://xfcm.googleapis.com.example/', 'http://fcm.googleapis.com/x']) {
    const r = await h.call('POST', '/api/push/subscribe', { body: await subscribeBody({ endpoint }) });
    assert.equal(r.status, 400, endpoint);
    assert.equal((await r.json()).error, 'bad_endpoint');
  }
  for (const endpoint of ['https://web.push.apple.com/x', 'https://fcm.googleapis.com/fcm/send/x']) {
    assert.equal((await h.call('POST', '/api/push/subscribe', { body: await subscribeBody({ endpoint }) })).status, 200, endpoint);
  }
});

test('subscribe checks the keys and the hour; replaces deletes the old row; the same address again takes its place; 20 a day', async () => {
  await start();
  const body = await subscribeBody();
  const p = fromB64u(body.keys.p256dh);
  const offCurve = Buffer.from(Uint8Array.of(4, ...p.slice(1, 33), ...p.slice(33).map((b, i) => (i === 31 ? b ^ 1 : b)))).toString('base64url');
  for (const [keys, why] of [[{ ...body.keys, p256dh: body.keys.p256dh.slice(0, 43) }, 'short'], [{ ...body.keys, p256dh: Buffer.from(Uint8Array.of(3, ...p.slice(1))).toString('base64url') }, 'not 0x04'],
    [{ ...body.keys, p256dh: offCurve }, 'off the curve'], [{ ...body.keys, auth: 'AAAAAAAAAAAAAAAAAAAAAA==AA' }, 'auth not base64url'], [{ ...body.keys, auth: 'AAAAAAAAAAAAAAAAAAAA' }, 'auth 15 bytes'], [undefined, 'none']]) {
    const r = await h.call('POST', '/api/push/subscribe', { body: { ...body, keys } });
    assert.equal(r.status, 400, why);
    assert.equal((await r.json()).error, 'bad_keys', why);
  }
  for (const slot of ['15', '21', 17.5, '1700', null, 'x']) {
    const r = await h.call('POST', '/api/push/subscribe', { body: { ...body, slot } });
    assert.equal((await r.json()).error, 'bad_slot', String(slot));
  }
  const first = await (await h.call('POST', '/api/push/subscribe', { body })).json();
  // a slot change: the browser keeps its address, the app re-subscribes with replaces
  const second = await (await h.call('POST', '/api/push/subscribe', { body: { ...body, slot: '19', replaces: first } })).json();
  assert.notEqual(second.id, first.id);
  assert.deepEqual(rows(h.env, 'SELECT id, slot FROM push_subs').map((r) => ({ ...r })), [{ id: second.id, slot: 19 }]);
  // a new address with replaces (pushsubscriptionchange): the old row goes
  const moved = await subscribeBody({ slot: '19', replaces: second });
  const third = await (await h.call('POST', '/api/push/subscribe', { body: moved })).json();
  assert.deepEqual(rows(h.env, 'SELECT id, endpoint FROM push_subs').map((r) => ({ ...r })), [{ id: third.id, endpoint: moved.endpoint }]);
  // replaces with a wrong secret deletes nothing
  const other = await (await h.call('POST', '/api/push/subscribe', { body: await subscribeBody({ replaces: { id: third.id, secret: 'f'.repeat(32) } }) })).json();
  assert.equal(rows(h.env, 'SELECT * FROM push_subs').length, 2);
  assert.ok(other.id);
  // the network's daily limit
  await setCount(h.env, `push:subscribe:${await netOf(h.env)}`, PUSH_LIMITS.subscribe);
  const over = await h.call('POST', '/api/push/subscribe', { body: await subscribeBody() });
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error, 'too_many_push');
  assert.equal(PUSH_LIMITS.subscribe, 20);
  assert.equal(PUSH_LIMITS.seen, 200);
});

test('key, seen and off: the key while on; seen moves the days forward and answers the status; off deletes', async () => {
  await start();
  const key = await h.call('GET', '/api/push/key');
  assert.equal(key.status, 200);
  assert.deepEqual(await key.json(), { key: VAPID.publicKey });
  const { id, secret } = await (await h.call('POST', '/api/push/subscribe', { body: await subscribeBody() })).json();
  const seen = (b) => h.call('POST', '/api/push/seen', { body: { id, secret, ...b } });
  const today = dayOf(); const yesterday = shiftDay(today, -1);
  h.env.DB.raw.prepare('UPDATE push_subs SET last_seen_day = ?').run(shiftDay(today, -3));
  let r = await seen({ day: today, done: false });
  assert.deepEqual(await r.json(), { status: 'on' });
  assert.deepEqual({ ...one(h.env, 'SELECT last_seen_day, last_done_day FROM push_subs') }, { last_seen_day: today, last_done_day: null });
  await seen({ day: yesterday, done: true });
  assert.deepEqual({ ...one(h.env, 'SELECT last_seen_day, last_done_day FROM push_subs') }, { last_seen_day: today, last_done_day: yesterday }, 'a lesson just before midnight counts for its day; days never go back');
  await seen({ day: shiftDay(today, 5), done: true });
  assert.equal(one(h.env, 'SELECT last_done_day FROM push_subs').last_done_day, today, 'a day the server does not know as today or yesterday is today');
  await seen({ day: '2026-01-01', done: true });
  assert.equal(one(h.env, 'SELECT last_done_day FROM push_subs').last_done_day, today);
  h.env.DB.raw.prepare("UPDATE push_subs SET status = 'paused'").run();
  assert.deepEqual(await (await seen({ day: today })).json(), { status: 'paused' });
  // a wrong secret or id opens nothing
  for (const b of [{ id, secret: 'f'.repeat(32) }, { id: '0'.repeat(16), secret }, { id: 'x', secret: 'y' }, {}]) {
    const bad = await h.call('POST', '/api/push/seen', { body: { ...b, day: today, done: true } });
    assert.equal(bad.status, 404);
    assert.equal((await bad.json()).error, 'no_push');
  }
  assert.equal((await h.call('POST', '/api/push/off', { body: { id, secret: 'f'.repeat(32) } })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM push_subs').length, 1, 'off with a wrong secret deletes nothing');
  assert.equal((await h.call('POST', '/api/push/off', { body: { id, secret } })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM push_subs').length, 0);
  assert.equal((await seen({ day: today })).status, 404, 'gone: the app learns it');
  await setCount(h.env, `push:seen:${await netOf(h.env)}`, PUSH_LIMITS.seen);
  assert.equal((await seen({ day: today })).status, 429);
});

// ---------------------------------------------------------------- 2: who is sent to, and what
test('2. pushDue at 17:07 Jerusalem on a Tuesday sends to slot 17 only, with the headers, the token and the declarative message', async () => {
  await start();
  const day = '2026-11-10'; // a Tuesday
  await addRow(h.env, { slot: 16 });
  const id17 = await addRow(h.env, { slot: 17 });
  await addRow(h.env, { slot: 18 });
  await addRow(h.env, { slot: 17, status: 'paused' });
  const out = await pushDue(h.env, at(day, 17, 7));
  assert.deepEqual(out, { sent: 1, gone: 0, rejected: 0, failed: 0, deferred: 0 });
  assert.equal(h.svc.got.length, 1);
  const [req] = h.svc.got;
  assert.equal(req.url, `${FCM}synthetic-${id17}`);
  assert.equal(req.headers.TTL, '7200');
  assert.equal(req.headers.Urgency, 'normal');
  assert.equal(req.headers.Topic, 'daily');
  assert.equal(req.headers['Content-Encoding'], 'aes128gcm');
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(req.headers.Authorization);
  assert.ok(m, req.headers.Authorization);
  assert.equal(m[2], VAPID.publicKey);
  const claims = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'mailto:hello@example.test');
  assert.ok(claims.exp <= at(day, 17, 7).getTime() / 1000 + 12 * 3600);
  const key = await crypto.subtle.importKey('raw', fromB64u(VAPID.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const [hh, cc, ss] = m[1].split('.');
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64u(ss), new TextEncoder().encode(`${hh}.${cc}`)), true);
  // the browser decrypts exactly the declarative message
  const { text } = await subs.get(req.url).decrypt(req.body);
  assert.deepEqual(JSON.parse(text), {
    web_push: 8030,
    notification: { title: 'מדרגות', body: messageFor(day), lang: 'he', dir: 'rtl', navigate: 'https://madregot.example.test/#/?go=today&src=push', tag: 'daily', silent: false },
  });
  assert.equal(one(h.env, 'SELECT last_sent_day FROM push_subs WHERE id = ?', id17).last_sent_day, day);
  assert.equal(metric('push_sent', day), 1);
  // 16:xx, 18:xx: the other slots
  h.svc.got.length = 0;
  await pushDue(h.env, at(day, 16, 37));
  await pushDue(h.env, at(day, 18, 37));
  assert.equal(h.svc.got.length, 2);
  // never before 16:00 or after 20:59
  for (const hour of [9, 12, 15, 21, 23, 3]) assert.deepEqual(await pushDue(h.env, at('2026-11-11', hour, 37)), { skipped: 'hour' }, String(hour));
});

test('2a. a batch: 30 due, PUSH_BATCH 10 -> 10 sent, one VAPID token per push service, 20 deferred; the oldest send first', async () => {
  await start();
  const day = '2026-11-10';
  for (let i = 0; i < 30; i++) await addRow(h.env, { slot: 17, endpoint: `${i % 2 ? MOZ : FCM}batch-${String(i).padStart(2, '0')}` });
  const sign = crypto.subtle.sign;
  const signs = [];
  crypto.subtle.sign = function spy(alg, ...rest) { signs.push(alg?.name || alg); return sign.call(this, alg, ...rest); };
  let out;
  try { out = await pushDue(h.env, at(day, 17, 37)); } finally { crypto.subtle.sign = sign; }
  assert.deepEqual(out, { sent: 10, gone: 0, rejected: 0, failed: 0, deferred: 20 });
  assert.equal(h.svc.got.length, 10);
  assert.deepEqual(signs, ['ECDSA', 'ECDSA'], 'one token for fcm.googleapis.com, one for the Mozilla service');
  assert.equal(new Set(h.svc.got.map((g) => /vapid t=([^,]+)/.exec(g.headers.Authorization)[1])).size, 2);
  assert.equal(metric('push_deferred', day), 20);
  // the next day the 20 that waited go first (never sent: NULL first), then the 10 of yesterday
  h.svc.got.length = 0;
  const sentYesterday = rows(h.env, 'SELECT id FROM push_subs WHERE last_sent_day = ?', day).map((r) => r.id);
  await pushDue(h.env, at('2026-11-11', 17, 37));
  assert.equal(h.svc.got.length, 10);
  const firstDay2 = rows(h.env, "SELECT id FROM push_subs WHERE last_sent_day = '2026-11-11'").map((r) => r.id);
  assert.equal(firstDay2.filter((id) => sentYesterday.includes(id)).length, 0);
});

test('2a. the schedules: "7 * * * *" runs the billing jobs and never sends; "37 * * * *" sends and runs nothing else', async () => {
  await start();
  for (let i = 0; i < 3; i++) await addRow(h.env, { slot: 17 });
  const fire = async (cron, when) => {
    const c = makeCtx();
    await h.worker.scheduled({ cron, scheduledTime: when.getTime() }, h.env, c);
    await c.flush();
  };
  await fire('7 * * * *', at('2026-11-10', 17, 7));
  assert.equal(h.svc.got.length, 0, 'the billing cron sends no reminder');
  assert.equal(rows(h.env, 'SELECT * FROM push_subs WHERE last_sent_day IS NOT NULL').length, 0);
  assert.equal(PUSH_CRON, '37 * * * *');
  await fire(PUSH_CRON, at('2026-11-10', 17, 37));
  assert.equal(h.svc.got.length, 3);
  assert.equal(h.net.log.email.length, 0, 'the reminder cron sends no notice');
});

// ---------------------------------------------------------------- 3: rest days, quiet days and their eves
test('3. never on Shabbat, Yom Tov, memorial days or Tish\'a B\'Av, nor on their eve; a plain weekday sends', async (t) => {
  // each case on its own Worker (afterEach closes it after every case)
  const cases = [
    ['2026-11-13', 17, 7, false, 'Friday: the eve of Shabbat'],
    ['2026-11-14', 17, 7, false, 'Shabbat'],
    ['2026-09-20', 17, 7, false, 'Sunday 20 Sept: the eve of Yom Kippur'],
    ['2026-09-21', 17, 7, false, 'Yom Kippur'],
    ['2026-09-17', 17, 7, true, 'Thursday 17 Sept: a plain weekday'],
    ['2027-04-21', 17, 7, false, 'Wednesday 21 Apr 2027: the eve of Pesach I'],
    ['2027-05-11', 17, 7, false, 'Yom HaZikaron 2027'],
    ['2027-05-10', 17, 37, false, 'Monday 10 May 2027: the eve of Yom HaZikaron'],
    ['2026-10-05', 17, 7, false, 'the Swords of Iron War Memorial Day'],
    ['2026-10-04', 17, 37, false, 'Sunday 4 Oct: its eve'],
    ['2027-08-12', 17, 7, false, 'Tish\'a B\'Av 2027'],
  ];
  for (const [day, hh, mm, sends, why] of cases) {
    await t.test(`${day} ${hh}:${String(mm).padStart(2, '0')} ${why}: ${sends ? 'sends' : 'nothing'}`, async () => {
      await start();
      await addRow(h.env, { slot: 17 });
      const out = await pushDue(h.env, at(day, hh, mm));
      assert.equal(h.svc.got.length, sends ? 1 : 0, why);
      if (!sends) assert.deepEqual(out, { skipped: 'quiet' }, why);
    });
  }
  await t.test('2027-05-10 11:37: outside 16-20 anyway', async () => {
    await start();
    assert.deepEqual(await pushDue(h.env, at('2027-05-10', 11, 37)), { skipped: 'hour' });
  });
});

// ---------------------------------------------------------------- 4, 5: already learned, already sent, the answers
test('4. a student who already learned today is skipped, and a second run the same day sends nothing again', async () => {
  await start();
  const day = '2026-11-10';
  await addRow(h.env, { slot: 17, done: day });
  const id = await addRow(h.env, { slot: 17, done: '2026-11-09' });
  await pushDue(h.env, at(day, 17, 7));
  assert.deepEqual(sentTo(), [`${FCM}synthetic-${id}`]);
  await pushDue(h.env, at(day, 17, 37));
  assert.equal(h.svc.got.length, 1, 'once a day');
});

test('5. what each answer does: 404/410 delete, 429/5xx and no answer keep, other 4xx delete and count push_rejected', async () => {
  const status = { a: 410, b: 404, c: 429, d: 503, e: 400, f: 403, g: 'throw', h: 202 };
  await start({}, pushService((url) => status[url.slice(-1)]));
  const day = '2026-11-10';
  for (const k of Object.keys(status)) await addRow(h.env, { slot: 17, endpoint: `${FCM}row-${k}` });
  const out = await pushDue(h.env, at(day, 17, 37));
  assert.deepEqual(out, { sent: 1, gone: 2, rejected: 2, failed: 3, deferred: 0 });
  assert.deepEqual(rows(h.env, 'SELECT endpoint, last_sent_day FROM push_subs ORDER BY endpoint').map((r) => [r.endpoint.slice(-1), r.last_sent_day]),
    [['c', null], ['d', null], ['g', null], ['h', day]]);
  assert.equal(metric('push_sent', day), 1);
  assert.equal(metric('push_rejected', day), 2);
  assert.equal(metric('push_failed', day), 3);
});

// ---------------------------------------------------------------- 6: back-off
test('6. ignored reminders: 3 in a row -> even days of the year only; 6 -> paused, and nothing more is sent', async () => {
  await start();
  const id = await addRow(h.env, { slot: 17 });
  const day = (d) => `2026-11-${String(d).padStart(2, '0')}`;
  const sentOn = [];
  const live = async (d) => {
    const before = h.svc.got.length;
    await pushDue(h.env, at(day(d), 17, 37));
    if (h.svc.got.length > before) sentOn.push(d);
    await pushNight(h.env, at(day(d + 1), 3, 7));
  };
  for (let d = 15; d <= 26; d++) await live(d);
  // 15, 16, 17 every day (3 misses after the night of the 18th); then even days only: 18 (322), 22 (326), 24 (328);
  // Friday 20 and Shabbat 21 are quiet; after the 24th, 6 misses: paused
  assert.deepEqual(sentOn, [15, 16, 17, 18, 22, 24]);
  assert.equal(dayOfYear('2026-11-18') % 2, 0);
  assert.equal(dayOfYear('2026-11-19') % 2, 1);
  assert.deepEqual({ ...one(h.env, 'SELECT status, misses FROM push_subs WHERE id = ?', id) }, { status: 'paused', misses: 6 });
  assert.equal(metric('push_paused', '2026-11-25'), 1);
  // turning it on again is a new subscription (the app re-subscribes): a paused row never sends
  await pushDue(h.env, at('2026-11-30', 17, 37));
  assert.equal(sentOn.length, 6);
});

test('6. the night step: a lesson the day of the reminder (or since) sets the misses back to 0; not sent yesterday, no change', async () => {
  await start();
  const now = at('2026-11-11', 3, 7); const y = '2026-11-10';
  const ignored = await addRow(h.env, { sent: y, done: '2026-11-08', misses: 2 });
  const never = await addRow(h.env, { sent: y, misses: 0 });
  const learned = await addRow(h.env, { sent: y, done: y, misses: 4 });
  const learnedAfterMidnight = await addRow(h.env, { sent: y, done: '2026-11-11', misses: 5 });
  const notSent = await addRow(h.env, { sent: '2026-11-09', misses: 2 });
  const sixth = await addRow(h.env, { sent: y, misses: 5 });
  assert.deepEqual(await pushNight(h.env, now), { missed: 3, reset: 2, paused: 1 });
  const m = (id) => ({ ...one(h.env, 'SELECT misses, status FROM push_subs WHERE id = ?', id) });
  assert.deepEqual(m(ignored), { misses: 3, status: 'on' });
  assert.deepEqual(m(never), { misses: 1, status: 'on' });
  assert.deepEqual(m(learned), { misses: 0, status: 'on' });
  assert.deepEqual(m(learnedAfterMidnight), { misses: 0, status: 'on' });
  assert.deepEqual(m(notSent), { misses: 2, status: 'on' });
  assert.deepEqual(m(sixth), { misses: 6, status: 'paused' });
  // the 03:00 run of the hourly jobs takes this step
  const report = await run(h.env, { now: at('2026-11-12', 3, 7) });
  assert.ok(report.pushNight && typeof report.pushNight === 'object', JSON.stringify(report.pushNight));
});

// ---------------------------------------------------------------- 7: the texts
test('7. the six texts: never a price, the plan, a streak, a number or a name; one a day in turn; the title is the app', () => {
  assert.equal(TEXTS.length, 6);
  assert.equal(TITLE, 'מדרגות');
  for (const t of TEXTS) {
    for (const banned of ['₪', 'מנוי', 'רצף', 'מחיר', 'שקל', 'פרימיום', 'מסלול']) assert.ok(!t.includes(banned), `${banned} in ${t}`);
    assert.doesNotMatch(t, /\d/);
  }
  const days = Array.from({ length: 6 }, (_, i) => shiftDay('2026-11-10', i));
  assert.deepEqual(new Set(days.map(messageFor)), new Set(TEXTS), 'six days show all six');
  for (const d of days) {
    const p = payloadFor({ PUBLIC_URL: 'https://madregot.example.test/' }, d);
    for (const banned of ['₪', 'מנוי', 'רצף']) assert.ok(!p.includes(banned));
    assert.equal(JSON.parse(p).notification.navigate, 'https://madregot.example.test/#/?go=today&src=push');
  }
});

// ---------------------------------------------------------------- 8, 9: retention and the switch
test('8. a reminder whose app was not opened for 45 days is deleted', async () => {
  await start();
  const t = Date.now();
  const ago = (n) => dayOf(new Date(t - n * 864e5));
  const keep = await addRow(h.env, { seen: ago(44) });
  await addRow(h.env, { seen: ago(46) });
  await addRow(h.env, { seen: null, created: new Date(t - 46 * 864e5).toISOString() });
  const fresh = await addRow(h.env, { seen: null, created: new Date(t - 2 * 864e5).toISOString() });
  await h.env.DB.batch(purgeRecordsSql(h.env, new Date(t)));
  assert.deepEqual(rows(h.env, 'SELECT id FROM push_subs ORDER BY id').map((r) => r.id), [keep, fresh].sort());
});

test('9. PUSH = "off": every endpoint 404 and pushDue does nothing', async () => {
  await start({ PUSH: 'off' });
  await addRow(h.env, { slot: 17 });
  assert.equal((await h.call('GET', '/api/push/key')).status, 404);
  for (const p of ['subscribe', 'seen', 'off']) {
    assert.equal((await h.call('POST', `/api/push/${p}`, { body: await subscribeBody() })).status, 404, p);
  }
  assert.deepEqual(await pushDue(h.env, at('2026-11-10', 17, 37)), { skipped: 'off' });
  assert.equal(h.svc.got.length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM push_subs').length, 1);
});

test('nothing is sent while the keys, the subject or the app address are wrong (a refusal would delete every row)', async () => {
  const other = await makeVapidKeys();
  for (const [over, missing] of [
    [{ VAPID_PUBLIC_KEY: '' }, 'VAPID_PUBLIC_KEY'], [{ VAPID_PUBLIC_KEY: other.publicKey }, 'VAPID_PRIVATE_JWK'], [{ VAPID_PRIVATE_JWK: '' }, 'VAPID_PRIVATE_JWK'],
    [{ VAPID_SUBJECT: '' }, 'VAPID_SUBJECT'], [{ VAPID_SUBJECT: 'hello@example.test' }, 'VAPID_SUBJECT'], [{ PUBLIC_URL: '' }, 'PUBLIC_URL'], [{ PUBLIC_URL: 'http://madregot.example.test' }, 'PUBLIC_URL'],
  ]) {
    await start(over);
    await addRow(h.env, { slot: 17 });
    assert.equal(pushConfigError(h.env), missing);
    assert.deepEqual(await pushDue(h.env, at('2026-11-10', 17, 37)), { skipped: 'config', missing });
    assert.equal(h.svc.got.length, 0);
    h.done();
  }
  h = null;
  assert.equal(pushConfigError({ ...PUSH_ENV, PUBLIC_URL: 'https://madregot.example.test' }), null);
  assert.equal(pushConfigError({ ...PUSH_ENV, VAPID_SUBJECT: 'https://madregot.example.test/contact', PUBLIC_URL: 'https://madregot.example.test' }), null);
});
