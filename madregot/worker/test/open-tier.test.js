// A dollar breaker for the open tier (COUNCIL2-13, COUNCIL2-19). With the shipped AI_PAYWALL "off" the tutor had a
// count per class key and nothing in money: the council's probes reached $216 (3 classes on one email) and $360 (5
// classes, AI_PARENT_OK "required") at the worst-case usage the code allows, and the skeptic put one email at about
// 4,000 exam calls a day (20 classes). Now, in open mode:
//   - the 'open' pool has a daily dollar budget (OPEN_DAILY_BUDGET_USD); past it every open request is refused with the
//     calm 503 free_paused and the owner gets one notice that day (owner:open_paused:<day>), as the free taste does;
//   - a teacher whose class is bound to an email also takes open:a:<account>, so all the classes of one email share one
//     teacher's day (OPEN_ACCOUNT_DAILY_LIMIT), whichever credential they come with;
//   - a class student also takes open:c:<code> in units (OPEN_CLASS_DAILY_UNITS), so invented students cannot multiply a
//     class's day;
//   - a device a parent approved, with no class, has its own key (open:fd:<device>), not the network's solo key;
//   - each request holds its worst-case cost in usd:<pool> before Claude is called and gives it back after, and a request
//     is let in only while today's spend plus what is held is under the budget: parallel requests pass it by at most
//     one request's worst case. The free taste's $5 check works the same way.
// Adapted from the council's probes (engineering/probe/open-tier.test.mjs, engineering-verify/open-tier.test.mjs).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, signIn, ai, rows, one, claudeReply, makeClass, bearer, accountId, linkDevice, setCount, countOf, netOf, DEVICE, INPUT,
} from './helpers.js';
import { limits, DEFAULT_LIMITS } from '../src/entitle.js';
import { worstCaseNano } from '../src/spend.js';
import { buildRequest } from '../../shared/ai.js';
import { dayOf } from '../src/util.js';
import { flushNotices } from '../src/email.js';

let h;
afterEach(() => { h?.done(); h = null; });

// every exam reply reports 8 pages of input and the 32k output cap: the worst case the code allows, as in the probe
const WORST = { usage: { input_tokens: 20000, output_tokens: 32000 } };
/** The email's and the class's parts of the pool set far above it, and no room past the budget: the pool's own rule. */
const NO_PARTS = { OPEN_ACCOUNT_DAILY_USD: '1000', OPEN_CLASS_DAILY_USD: '1000' };
const STRICT = { ...NO_PARTS, OPEN_INFLIGHT_USD: '0' };
const partNotices = (env) => rows(env, "SELECT ref, kind, params FROM notices WHERE kind LIKE 'owner:open_part_paused:%'").map((r) => ({ ref: r.ref, ...JSON.parse(r.params) }));
const usd = (env, pool) => Number(one(env, 'SELECT nano_usd FROM ai_spend WHERE pool = ? AND period = ?', pool, dayOf())?.nano_usd || 0) / 1e9;
const notices = (env, what) => rows(env, 'SELECT kind FROM notices WHERE kind LIKE ?', `owner:${what}:%`).map((r) => r.kind);
const held = (env, pool) => Number(one(env, 'SELECT count FROM ai_usage WHERE who = ? AND day = ?', `usd:${pool}`, dayOf())?.count || 0);

/**
 * n classes bound to one signed-in email (each from its own address: class creation is 10 a day per network). The
 * teacher declared 18+ on the sign-in (COUNCIL2-5), and the classes are private groups, so their teacher may check
 * exams (a school class's teacher prepares materials only: prep_only).
 */
async function classesOf(email, n) {
  const token = await signIn(h, email, {}, { adultTeacher: true });
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = await h.call('POST', '/api/classes', { ip: `198.51.100.${i + 1}`, headers: { 'X-Account-Token': token }, body: { className: `ז׳${i + 1}`, teacherName: 'רונית', grade: '7', setting: 'private', privateAttest: true } });
    assert.equal(r.status, 200, `class ${i + 1}`);
    const c = await r.json();
    out.push({ code: c.code, key: { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey }, session: { 'X-Class-Code': c.code, 'X-Account-Token': token } });
  }
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_owners WHERE account_id = ?', accountId(h.env, email)).n, n);
  return out;
}

/** Exam calls round-robin over the classes' teacher keys (every 3rd with the email session instead); the statuses. */
async function examsOver(classes, attempts) {
  const status = {};
  for (let i = 0; i < attempts; i++) {
    const c = classes[i % classes.length];
    const r = await ai(h, 'exam', i % 3 === 2 ? c.session : c.key);
    const body = await r.json();
    // each request has finished (its reply priced and its hold given back) before the next one, as one teacher's are
    await h.ctx.flush();
    const k = r.status === 200 ? '200' : `${r.status} ${body.error}`;
    status[k] = (status[k] || 0) + 1;
  }
  return status;
}

for (const parentOk of ['required', 'off']) {
  for (const n of [3, 20]) {
    test(`AI_PARENT_OK ${parentOk}, ${n} classes on one email, cheap answers: the classes share one teacher's 200 a day`, async () => {
      h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: parentOk });
      assert.equal(limits(h.env).open.account, 200);
      const classes = await classesOf('teacher@example.test', n);
      const status = await examsOver(classes, 230);
      assert.deepEqual(status, { 200: 200, '429 daily_limit': 30 });
      assert.equal(h.net.log.claude.length, 200);
      assert.equal(countOf(h.env, `open:a:${accountId(h.env, 'teacher@example.test')}`), 200);
      // each class's own key counted only its share; no notice: money was never the limit
      for (const c of classes) assert.ok(countOf(h.env, `t:${c.code}`) <= Math.ceil(200 / n));
      assert.deepEqual(notices(h.env, 'open_paused'), []);
      // the teacher's screen says the day is used, on any of the classes
      const s = await (await h.call('GET', '/api/ai/status', { headers: classes[0].key })).json();
      assert.equal(s.tier, 'open');
      assert.equal(s.groups.all.left, 0);
    });

    test(`AI_PARENT_OK ${parentOk}, ${n} classes on one email, worst-case answers: calls stop at the dollar pool with the paused answer and one notice`, async () => {
      // the pool's own breaker: the email's and the class's parts are set out of the way (their tests are below)
      h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: parentOk, ...NO_PARTS }, { claude: (p) => claudeReply(p, WORST) });
      const budget = limits(h.env).budgets.openDailyUsd;
      assert.equal(budget, 25);
      const classes = await classesOf('teacher@example.test', n);
      const status = await examsOver(classes, 200);
      await h.ctx.flush();
      // about $0.36 an exam on the main model: the pool, not the account's 200, is what stops them
      const ok = status['200'];
      assert.ok(ok >= 60 && ok < 80, JSON.stringify(status));
      assert.equal(status['503 free_paused'], 200 - ok);
      assert.equal(h.net.log.claude.length, ok);
      const spent = usd(h.env, 'open');
      assert.ok(spent >= budget - 0.4 && spent < budget + 0.4, `spent ${spent}`);
      assert.deepEqual(notices(h.env, 'open_paused'), [`owner:open_paused:${dayOf()}`]);
      assert.equal(held(h.env, 'open'), 0, 'every hold was given back');
      // a refused request counted nothing: the account's count is the answers given
      assert.equal(countOf(h.env, `open:a:${accountId(h.env, 'teacher@example.test')}`), ok);
      const s = await (await h.call('GET', '/api/ai/status', { headers: classes[1].key })).json();
      assert.equal(s.shared, 'paused');
    });
  }
}

test('a class student takes open:c:<code> in units as well as s:<id>: invented students cannot multiply the class\'s day', async () => {
  h = await setup({ AI_PAYWALL: 'off', OPEN_CLASS_DAILY_UNITS: '100' });
  const names = Array.from({ length: 8 }, (_, i) => `תלמיד ${i + 1}`);
  const cls = await makeClass(h, { studentAi: true, students: names });
  const status = [];
  // an exam is 20 units: 5 exams fill 100, whoever asks
  for (const s of cls.students) {
    const r = await ai(h, 'exam', bearer(s));
    status.push(r.status === 200 ? 200 : (await r.json()).scope);
  }
  assert.deepEqual(status, [200, 200, 200, 200, 200, 'class', 'class', 'class']);
  assert.equal(countOf(h.env, `open:c:${cls.code}`), 100);
  // a chat is 1 unit, and the class has none left today
  const chat = await ai(h, 'chat', bearer(cls.students[0]));
  assert.equal(chat.status, 429);
  assert.equal((await chat.json()).error, 'shared_limit');
  // the refused students kept their own 40
  assert.equal(countOf(h.env, `s:${cls.students[7].studentId}`), 0);
  const st = await (await h.call('GET', '/api/ai/status', { headers: bearer(cls.students[7]) })).json();
  assert.equal(st.shared, 'class', 'the screen shows the class\'s day as used, not the student\'s');
  assert.equal(st.groups.all.left, 40);
  // the default is 600 units, as the legacy window's class cap
  assert.equal(DEFAULT_LIMITS.open.classUnits, 600);
});

test('a device a parent approved, with no class, has its own key: not the network\'s solo key', async () => {
  h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: 'required' });
  await signIn(h, 'parent@example.test');
  const acc = accountId(h.env, 'parent@example.test');
  const a = await linkDevice(h.env, acc, 'הטאבלט');
  const b = await linkDevice(h.env, acc, 'הטלפון');
  // the network's solo key is full (other children on the same home address, before this stage)
  await setCount(h.env, `solo:n:${await netOf(h.env)}`, 20);
  const r = await ai(h, 'explain', a.headers);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Left'), '19');
  assert.equal(countOf(h.env, `open:fd:${a.id}`), 1);
  await setCount(h.env, `open:fd:${a.id}`, 20);
  assert.equal((await ai(h, 'explain', a.headers)).status, 429, 'the device\'s own 20');
  assert.equal((await ai(h, 'explain', b.headers)).status, 200, 'the other device has its own');
  // an anonymous device on the same network still needs a parent's OK
  const anon = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(anon.status, 403);
  assert.equal((await anon.json()).error, 'parent_ok_needed');
  const st = await (await h.call('GET', '/api/ai/status', { headers: b.headers })).json();
  assert.equal(st.groups.all.left, 19);
  // with the parent's OK off, anonymous devices still share the network's 20; a linked device is not counted there
  h.done();
  h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: 'off' });
  await signIn(h, 'parent@example.test');
  const c = await linkDevice(h.env, accountId(h.env, 'parent@example.test'));
  assert.equal((await ai(h, 'explain', c.headers)).status, 200);
  assert.equal(countOf(h.env, `solo:n:${await netOf(h.env)}`), 0);
  assert.equal((await ai(h, 'explain', { 'X-Device': DEVICE })).status, 200);
  assert.equal(countOf(h.env, `solo:n:${await netOf(h.env)}`), 1);
});

/**
 * A Claude stub that keeps every call waiting until all `total` requests have either reached it or been refused, so
 * the requests are truly in flight together (the race the council's skeptic named: each one read the spend before any
 * reply was priced). Returns { claude, fire(promises) } where fire resolves to each request's status or error code.
 */
function together(total, usage) {
  let arrived = 0; let refused = 0; let open;
  const gate = new Promise((r) => { open = r; });
  const check = () => { if (arrived + refused === total) open(); };
  return {
    claude: async (p) => { arrived += 1; check(); await gate; return claudeReply(p, usage); },
    fire: (calls) => Promise.all(calls.map(async (c) => {
      const r = await c;
      const code = r.status === 200 ? 200 : (await r.json()).error;
      if (code !== 200) { refused += 1; check(); }
      return code;
    })),
    get arrived() { return arrived; },
  };
}

test('the strict rule (OPEN_INFLIGHT_USD "0"): 30 exams at once against a $3 open pool: the holds let 3 in, the rest are told to retry; never more than one worst case over', async () => {
  const t = together(30, WORST);
  h = await setup({ AI_PAYWALL: 'off', OPEN_DAILY_BUDGET_USD: '3', ...STRICT }, { claude: t.claude });
  const classes = await classesOf('teacher@example.test', 3);
  const hold = worstCaseNano(buildRequest('exam', INPUT.exam, { model: h.env.CLAUDE_MODEL }), 'exam', h.env) / 1e9;
  assert.ok(hold > 1 && hold < 1.5, `an exam's worst case: ${hold}`);
  const codes = await t.fire(Array.from({ length: 30 }, (_, i) => ai(h, 'exam', classes[i % 3].key)));
  await h.ctx.flush();
  // without the holds all 30 read a spend of $0 together and all 30 were sent: $10.80 against $3. With them: $0, one
  // hold and two holds are under $3, three are not
  assert.equal(t.arrived, 3);
  assert.deepEqual(codes.filter((c) => c !== 200), Array(27).fill('busy'), 'not "paused": the day is not spent, only held');
  assert.equal(usd(h.env, 'open'), 1.08);
  assert.equal(held(h.env, 'open'), 0, 'the holds were given back');
  assert.equal(rows(h.env, "SELECT who FROM ai_usage WHERE who LIKE 'usd:%' AND count > 0").length, 0, 'the parts\' holds too');
  // a refused request counted nothing: 3 questions in all on the three classes' keys
  assert.equal(classes.reduce((n, c) => n + countOf(h.env, `t:${c.code}`), 0), 3);
  assert.deepEqual(notices(h.env, 'open_paused'), []);
  // one at a time, the pool fills until its day is spent: then paused, one notice, and never more than one worst case over
  const after = [];
  for (let i = 0; i < 12; i++) { after.push((await ai(h, 'exam', classes[i % 3].key)).status); await h.ctx.flush(); }
  assert.deepEqual(after, [200, 200, 200, 200, 200, 200, 503, 503, 503, 503, 503, 503]);
  const spent = usd(h.env, 'open');
  assert.ok(spent >= 3 && spent <= 3 + hold, `spent ${spent}`);
  assert.deepEqual(notices(h.env, 'open_paused'), [`owner:open_paused:${dayOf()}`]);
  // the owner's email says it plainly, with the var to raise and the workspace limit behind it
  await flushNotices(h.env);
  const mail = h.net.log.email.find((m) => /העוזר החכם נח עד חצות: העלות/.test(m.subject));
  assert.ok(mail, 'the notice was sent');
  assert.match(mail.subject, /3\$/);
  assert.match(mail.text, /OPEN_DAILY_BUDGET_USD/);
  assert.match(mail.text, /Anthropic/);
});

// ---------------------------------------------------------------- one email or one class pauses only itself (the review)
test('one email spends its own $3 of the open pool and is paused alone: an unrelated class is still answered, and the owner\'s notice names the account', async () => {
  h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: 'required' }, { claude: (p) => claudeReply(p, WORST) });
  assert.equal(limits(h.env).budgets.openAccountDailyUsd, 3);
  const [c] = await classesOf('abuser@example.test', 1);
  const account = accountId(h.env, 'abuser@example.test');
  const st = await examsOver([c], 120);
  await h.ctx.flush();
  // about $0.36 an exam: nine of them pass $3, where the review saw 70 and the whole $25
  assert.deepEqual(st, { 200: 9, '503 free_paused': 111 });
  assert.ok(usd(h.env, 'open') > 3 && usd(h.env, 'open') < 3.4, `the pool: ${usd(h.env, 'open')}`);
  assert.equal(usd(h.env, `open:a:${account}`), usd(h.env, 'open'));
  assert.deepEqual(notices(h.env, 'open_paused'), [], 'the pool itself is not paused');
  const told = partNotices(h.env);
  // the class and its email reached their $3 together: each is named once, the email by its account id (never the address)
  assert.deepEqual(told.map((n) => [n.scope, n.account ?? n.class, n.budgetUsd]).sort(), [['account', account, 3], ['class', c.code, 3]]);
  assert.ok(!JSON.stringify(told).includes('abuser@'));
  // the same email's other class is paused with it (the part is the email's, across its classes) ...
  const token = await signIn(h, 'abuser@example.test', {}, { adultTeacher: true });
  const second = await (await h.call('POST', '/api/classes', { ip: '198.51.100.99', headers: { 'X-Account-Token': token }, body: { className: 'ז׳9', teacherName: 'רונית', grade: '7', setting: 'private', privateAttest: true } })).json();
  assert.equal((await ai(h, 'explain', { 'X-Class-Code': second.code, 'X-Teacher-Key': second.teacherKey })).status, 503);
  // ... and its screen says so before anything is asked
  assert.equal((await (await h.call('GET', '/api/ai/status', { headers: c.key })).json()).shared, 'paused');
  // an unrelated class whose adult teacher turned student AI on: answered, and its status is not paused
  const other = await makeClass(h, { students: ['נועה'], studentAi: true });
  const victim = await ai(h, 'explain', bearer(other.students[0]));
  assert.equal(victim.status, 200);
  assert.equal((await (await h.call('GET', '/api/ai/status', { headers: bearer(other.students[0]) })).json()).shared, undefined);
  // the owner's email names the var to raise
  await h.ctx.flush();
  await flushNotices(h.env);
  const mail = h.net.log.email.find((m) => /נח עד חצות אצל החשבון/.test(m.subject));
  assert.ok(mail, 'the notice was sent');
  assert.match(mail.text, /OPEN_ACCOUNT_DAILY_USD/);
});

test('one class spends its own $3 and is paused alone: its students and its teacher rest, another class does not', async () => {
  // a chat answer that costs $0.30 (30k output tokens on the main model)
  h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: 'off', OPEN_CLASS_DAILY_UNITS: '100000' }, { claude: (p) => claudeReply(p, { usage: { input_tokens: 0, output_tokens: 30000 } }) });
  const cls = await makeClass(h, { students: Array.from({ length: 12 }, (_, i) => `ת${i}`), studentAi: true });
  const codes = {};
  for (const s of cls.students) { const r = await ai(h, 'explain', bearer(s)); codes[r.status] = (codes[r.status] || 0) + 1; await h.ctx.flush(); }
  assert.deepEqual(codes, { 200: 10, 503: 2 });
  assert.ok(Math.abs(usd(h.env, `open:c:${cls.code}`) - 3) < 1e-9);
  assert.equal((await ai(h, 'explain', cls.teacher)).status, 503, 'the class\'s teacher with the key: the same part');
  assert.deepEqual(partNotices(h.env).map((n) => [n.scope, n.class]), [['class', cls.code]]);
  const other = await makeClass(h, { students: ['נועה'], studentAi: true });
  assert.equal((await ai(h, 'explain', bearer(other.students[0]))).status, 200);
  // deleting the class takes its hold counter with it (forget.js CLASS_COUNTERS usd:open:c:)
  assert.equal((await h.call('POST', '/api/teacher/class/delete', { headers: cls.teacher, body: { confirm: 'DELETE' } })).status, 200);
  assert.equal(rows(h.env, 'SELECT who FROM ai_usage WHERE who LIKE ?', `usd:open:c:${cls.code}%`).length, 0);
});

test('60 students of two classes press "explain" at the same moment: all 60 are answered (the review saw 40 of 60)', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  let arrived = 0;
  h = await setup({ AI_PAYWALL: 'off' }, { claude: async (p) => { arrived += 1; await gate; return claudeReply(p); } });
  const classes = [];
  for (let c = 0; c < 2; c++) classes.push(await makeClass(h, { students: Array.from({ length: 30 }, (_, i) => `תלמיד ${c}-${i}`), studentAi: true }));
  const pending = classes.flatMap((cls) => cls.students.map((s) => ai(h, 'explain', bearer(s))));
  for (let i = 0; i < 100 && arrived < 60; i++) await new Promise((r) => setTimeout(r, 30));
  assert.equal(arrived, 60, 'every request reached Claude while the others were still in flight');
  // while they are in flight, the pool and each class hold their worst cases: well past $3 a class, under $3 + $20
  const heldNow = (who) => Number(one(h.env, 'SELECT count FROM ai_usage WHERE who = ? AND day = ?', who, dayOf())?.count || 0) / 1e9;
  assert.ok(heldNow(`usd:open:c:${classes[0].code}`) > 3 && heldNow(`usd:open:c:${classes[0].code}`) < 23, `${heldNow(`usd:open:c:${classes[0].code}`)}`);
  assert.ok(heldNow('usd:open') < 45);
  release();
  const res = await Promise.all(pending);
  assert.deepEqual([...new Set(res.map((r) => r.status))], [200]);
  await h.ctx.flush();
  assert.equal(held(h.env, 'open'), 0);
  assert.ok(usd(h.env, 'open') < 0.01, 'sixty real answers cost under a cent here');
});

test('the room for requests in flight is bounded: past the budget plus OPEN_INFLIGHT_USD of holds the next request waits (busy), and a spent day admits no one', async () => {
  const t = together(40, WORST);
  h = await setup({ AI_PAYWALL: 'off', OPEN_DAILY_BUDGET_USD: '3', OPEN_INFLIGHT_USD: '4', ...NO_PARTS }, { claude: t.claude });
  const classes = await classesOf('teacher@example.test', 3);
  const hold = worstCaseNano(buildRequest('exam', INPUT.exam, { model: h.env.CLAUDE_MODEL }), 'exam', h.env) / 1e9;
  const codes = await t.fire(Array.from({ length: 40 }, (_, i) => ai(h, 'exam', classes[i % 3].key)));
  await h.ctx.flush();
  // holds of $0, 1.42, 2.84, 4.26 and 5.68 are under $3 + $4; the sixth request sees $7.10
  assert.equal(t.arrived, Math.floor(7 / hold) + 1);
  assert.equal(codes.filter((c) => c === 'busy').length, 40 - t.arrived);
  assert.ok(usd(h.env, 'open') <= 3 + 4 + hold, 'never more than the budget, the room and one worst case');
  // the day is spent now ($1.80 > ... each answer $0.36): once it passes $3 nobody is admitted, whatever room is left
  for (let i = 0; i < 6; i++) { await ai(h, 'exam', classes[0].key); await h.ctx.flush(); }
  assert.ok(usd(h.env, 'open') >= 3);
  assert.equal((await ai(h, 'exam', classes[1].key)).status, 503);
});

test('hold sizes: a rerun is held at the dearest fallback model, only for a request that carries the fallback; a chat question holds under half a dollar', async () => {
  const { FALLBACK_PRICE, PRICES, UNKNOWN_PRICE } = await import('../src/spend.js');
  assert.deepEqual({ ...FALLBACK_PRICE }, { ...PRICES['claude-opus-5'] });
  assert.ok(FALLBACK_PRICE.output < UNKNOWN_PRICE.output);
  const holdOf = (kind, opts) => worstCaseNano(buildRequest(kind, INPUT[kind], opts), kind, {}) / 1e9;
  const full = { model: 'claude-sonnet-5-5', shape: 'full' };
  const chat = holdOf('chat', full); const exam = holdOf('exam', full);
  assert.ok(chat > 0.1 && chat < 0.45, `chat ${chat}`);
  assert.ok(exam > 1 && exam < 1.5, `exam ${exam}`);
  // the low-cost model has no server-side fallback: its request carries none, and its hold has no rerun in it
  const lite = buildRequest('explain', INPUT.explain, { model: 'claude-haiku-5-5', shape: 'lite' });
  assert.equal(lite.fallbacks, undefined);
  assert.ok(worstCaseNano(lite, 'explain', {}) / 1e9 < 0.01);
  // the ledger still prices a model that is on no list above everything
  const { priceOf } = await import('../src/spend.js');
  assert.equal(priceOf({ model: 'some-new-model', usage: { input_tokens: 1000, output_tokens: 1000 } }).nano, 1000 * UNKNOWN_PRICE.input + 1000 * UNKNOWN_PRICE.output);
});

test('the free taste\'s $5 check holds the same way: 40 questions at once let in only what the holds allow', async () => {
  const usage = { usage: { input_tokens: 4000, output_tokens: 4000 } };
  const t = together(40, usage);
  h = await setup({ FREE_DAILY_BUDGET_USD: '0.01', FREE_NET_DAILY: '1000' }, { claude: t.claude });
  const hold = worstCaseNano(buildRequest('explain', INPUT.explain, { model: 'claude-haiku-5-5', shape: 'lite' }), 'explain', h.env) / 1e9;
  const codes = await t.fire(Array.from({ length: 40 }, (_, i) => ai(h, 'explain', { 'X-Device': i.toString(16).padStart(32, 'b') })));
  await h.ctx.flush();
  // $0 and one hold are under $0.01, two holds are not
  assert.ok(hold > 0.005 && hold < 0.01, `a free question's worst case: ${hold}`);
  assert.equal(t.arrived, 2);
  assert.equal(codes.filter((c) => c === 'busy').length, 38);
  assert.equal(held(h.env, 'free'), 0);
  // the old check (spend before the call) let all 40 through: here the spend is two answers
  assert.ok(Math.abs(usd(h.env, 'free') - 2 * 0.0024) < 1e-9, `${usd(h.env, 'free')}`);
  for (let i = 0; i < 4; i++) { await ai(h, 'explain', { 'X-Device': (100 + i).toString(16).padStart(32, 'c') }); await h.ctx.flush(); }
  assert.ok(usd(h.env, 'free') <= 0.01 + hold);
  const r = await ai(h, 'explain', { 'X-Device': 'd'.repeat(32) });
  assert.equal(r.status, 503);
  assert.deepEqual(notices(h.env, 'free_paused'), [`owner:free_paused:${dayOf()}`]);
});

test('a hold is given back when Claude fails, and on the stream path after the reply is priced', async () => {
  h = await setup({ AI_PAYWALL: 'off' }, { claude: () => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }), { status: 500, headers: { 'Content-Type': 'application/json', 'x-should-retry': 'false' } }) });
  const cls = await makeClass(h);
  assert.equal((await ai(h, 'explain', cls.teacher)).status, 502);
  await h.ctx.flush();
  assert.equal(held(h.env, 'open'), 0);
  assert.equal(countOf(h.env, `t:${cls.code}`), 0, 'the question was given back');
  h.done();
  h = await setup({ AI_PAYWALL: 'off' });
  const c2 = await makeClass(h);
  const r = await ai(h, 'chat', c2.teacher, { body: { ...INPUT.chat, stream: true } });
  assert.equal(r.status, 200);
  await r.text();
  await h.ctx.flush();
  assert.equal(held(h.env, 'open'), 0);
  assert.ok(usd(h.env, 'open') > 0);
});

test('limits and vars: the open budget, the account cap and the class units come from wrangler.toml\'s vars', () => {
  assert.equal(DEFAULT_LIMITS.budgets.openDailyUsd, 25);
  assert.equal(DEFAULT_LIMITS.open.account, 200);
  const L = limits({ OPEN_DAILY_BUDGET_USD: '40', OPEN_ACCOUNT_DAILY_LIMIT: '300', OPEN_CLASS_DAILY_UNITS: '900' });
  assert.equal(L.budgets.openDailyUsd, 40); assert.equal(L.open.account, 300); assert.equal(L.open.classUnits, 900);
  assert.equal(limits({ AI_LIMITS: JSON.stringify({ budgets: { openDailyUsd: 7 } }) }).budgets.openDailyUsd, 7);
});
