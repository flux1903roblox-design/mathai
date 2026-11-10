// Paid tiers (AI_PAYWALL = "on"): family devices, class licences, teachers, trials and the legacy window; the spend
// ledger and the response headers. Claude is stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRequest, AI_KINDS, DEFAULT_MODEL } from '../../shared/ai.js';
import { limits } from '../src/entitle.js';
import { priceOf, PRICES } from '../src/spend.js';
import { dayOf, monthOf, resetsAt } from '../src/util.js';
import {
  setup, ai, makeClass, bearer, signIn, accountId, insertSub, linkDevice, setCount, setSpend, countOf, rows, one, claudeReply, devOf,
} from './helpers.js';

let h;
afterEach(() => h?.done());

async function family(email = 'fam@example.test') {
  await signIn(h, email);
  const a = accountId(h.env, email);
  const sub = insertSub(h.env, { kind: 'family', account_id: a });
  return { a, sub, d1: await linkDevice(h.env, a, 'הטאבלט'), d2: await linkDevice(h.env, a, 'הטלפון') };
}

test('family: linked devices share the family limits per kind group (30 / 6 / 5 / 2)', async () => {
  h = await setup();
  const { a, d1, d2 } = await family();
  await setCount(h.env, `fam:${a}:tutor`, 29);
  const r = await ai(h, 'explain', d1.headers);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'family'); assert.equal(r.headers.get('X-AI-Left'), '0');
  const capped = await ai(h, 'chat', d2.headers);
  assert.equal(capped.status, 429);
  assert.deepEqual(await capped.json(), { error: 'daily_limit', message: 'daily_limit', tier: 'family', group: 'tutor', limit: 30, left: 0, resetsAt: resetsAt('day') });
  for (const [kind, limit] of [['check', 6], ['generate', 5], ['exam', 2]]) {
    for (let i = 0; i < limit; i++) assert.equal((await ai(h, kind, (i % 2 ? d2 : d1).headers)).status, 200, `${kind} ${i + 1}`);
    const r2 = await ai(h, kind, d1.headers);
    assert.equal(r2.status, 429, kind);
    assert.equal((await r2.json()).limit, limit);
  }
  assert.equal(countOf(h.env, `fam:${a}:check`), 6);
  assert.ok(h.net.log.claude.every((p) => p.model === 'claude-sonnet-5-5'));
});

test('family: the exam check is capped at 10 a month', async () => {
  h = await setup();
  const { a, d1 } = await family();
  await setCount(h.env, `fam:${a}:exam`, 9, 'month');
  assert.equal((await ai(h, 'exam', d1.headers)).status, 200);
  const r = await ai(h, 'exam', d1.headers);
  assert.equal(r.status, 429);
  const b = await r.json();
  assert.equal(b.limit, 10);
  assert.equal(b.resetsAt, resetsAt('month'));
  assert.equal(one(h.env, 'SELECT count FROM ai_usage WHERE who = ? AND day = ?', `fam:${a}:exam`, monthOf()).count, 10);
  const s = await (await h.call('GET', '/api/ai/status', { headers: d1.headers })).json();
  assert.deepEqual(s.groups.exam, { left: 1, limit: 2, monthLeft: 0 });
});

test('family over FAMILY_MONTHLY_BUDGET_USD: chat runs on FREE_MODEL with 2500 tokens; check, generate and exam are monthly_fair_use', async () => {
  h = await setup();
  const { a, d1 } = await family();
  await setSpend(h.env, `fam:${a}`, 5.01, 'month');
  const r = await ai(h, 'chat', d1.headers);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Economy'), '1');
  const p = h.net.log.claude.at(-1);
  assert.equal(p.model, 'claude-haiku-5-5'); assert.equal(p.max_tokens, 2500); assert.equal(p.fallbacks, undefined);
  for (const kind of ['check', 'generate', 'exam']) {
    const x = await ai(h, kind, d1.headers);
    assert.equal(x.status, 429, kind);
    const b = await x.json();
    assert.equal(b.error, 'monthly_fair_use'); assert.equal(b.resetsAt, resetsAt('month'));
  }
  const s = await (await h.call('GET', '/api/ai/status', { headers: d1.headers })).json();
  assert.equal(s.economy, true); assert.equal(s.groups.check, null);
});

test('the family budget and the main model are the same in code and in wrangler.toml (neither can drift alone)', () => {
  const L = limits({});
  assert.equal(L.budgets.familyMonthlyUsd, 4, 'the code default when the variable is missing');
  assert.equal(limits({ FAMILY_MONTHLY_BUDGET_USD: '' }).budgets.familyMonthlyUsd, 4, 'an empty variable keeps the default');
  assert.equal(limits({ FAMILY_MONTHLY_BUDGET_USD: '4' }).budgets.familyMonthlyUsd, 4);
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const vars = Object.fromEntries([...toml.matchAll(/^([A-Z_]+)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]]));
  assert.equal(Number(vars.FAMILY_MONTHLY_BUDGET_USD), L.budgets.familyMonthlyUsd, 'wrangler.toml and the code default agree');
  assert.equal(vars.CLAUDE_MODEL, DEFAULT_MODEL, 'wrangler.toml uses the shared default model');
});

test('class: each student has their own limits; seats x 25 units stop a leaked-code flood', async () => {
  h = await setup();
  const cls = await makeClass(h, { studentAi: true, students: ['א', 'ב', 'ג'] });
  insertSub(h.env, { kind: 'class', class_code: cls.code, seats: 1 });
  const [a, b, c] = cls.students;
  await setCount(h.env, `s:${a.studentId}:tutor`, 20);
  const capped = await ai(h, 'explain', bearer(a));
  assert.equal(capped.status, 429);
  assert.deepEqual([(await capped.json()).tier], ['class']);
  const ok = await ai(h, 'explain', bearer(b));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('X-AI-Tier'), 'class'); assert.equal(ok.headers.get('X-AI-Left'), '19');
  await setCount(h.env, `cls:${cls.code}`, 25);
  const flood = await ai(h, 'explain', bearer(c));
  assert.equal(flood.status, 429);
  const body = await flood.json();
  assert.equal(body.error, 'shared_limit'); assert.equal(body.scope, 'class');
  assert.equal(countOf(h.env, `s:${c.studentId}:tutor`), 0, 'the refused question was undone');
  // a check weighs 4 units against the class cap
  await setCount(h.env, `cls:${cls.code}`, 22);
  assert.equal((await ai(h, 'check', bearer(c))).status, 429);
  await setCount(h.env, `cls:${cls.code}`, 21);
  assert.equal((await ai(h, 'check', bearer(c))).status, 200);
  assert.equal(countOf(h.env, `cls:${cls.code}`), 25);
});

test('a licensed teacher counts into the class and has the teacher limits', async () => {
  h = await setup();
  const cls = await makeClass(h);
  insertSub(h.env, { kind: 'class', class_code: cls.code, seats: 30 });
  const r = await ai(h, 'generate', cls.teacher);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'teacher'); assert.equal(r.headers.get('X-AI-Left'), '29');
  assert.equal(countOf(h.env, `cls:${cls.code}`), 3);
});

test('a licensed student on a linked family device uses the class bucket first, then the family bucket for that kind', async () => {
  h = await setup();
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  insertSub(h.env, { kind: 'class', class_code: cls.code, seats: 30 });
  const { a, d1 } = await family();
  const both = { ...bearer(cls.students[0]), ...d1.headers };
  const first = await ai(h, 'check', both);
  assert.equal(first.headers.get('X-AI-Tier'), 'class');
  await setCount(h.env, `s:${cls.students[0].studentId}:check`, 3);
  const then = await ai(h, 'check', both);
  assert.equal(then.status, 200);
  assert.equal(then.headers.get('X-AI-Tier'), 'family');
  assert.equal(countOf(h.env, `fam:${a}:check`), 1);
  const s = await (await h.call('GET', '/api/ai/status', { headers: both })).json();
  assert.equal(s.tier, 'class');
  assert.deepEqual(s.groups.check, { left: 5, limit: 6 }, 'the family serves check now');
  assert.deepEqual(s.linked, { label: 'הטאבלט' });
});

test('a paid caller at the cap gets 429 daily_limit and never drops to the free taste', async () => {
  h = await setup();
  const { a, d1 } = await family();
  await setCount(h.env, `fam:${a}:tutor`, 30);
  const r = await ai(h, 'explain', { ...d1.headers, 'X-Device': 'f'.repeat(32) });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).tier, 'family');
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'free:%'").length, 0);
  assert.equal(h.net.log.claude.length, 0);
});

test('past_due keeps access for FAMILY_GRACE_DAYS after the period end; canceled keeps it to the period end', async () => {
  h = await setup();
  await signIn(h, 'grace@example.test');
  const a = accountId(h.env, 'grace@example.test');
  const sub = insertSub(h.env, { kind: 'family', account_id: a, status: 'past_due', start: new Date(Date.now() - 40 * 864e5).toISOString(), end: new Date(Date.now() - 2 * 864e5).toISOString() });
  const d = await linkDevice(h.env, a);
  assert.equal((await ai(h, 'explain', d.headers)).headers.get('X-AI-Tier'), 'family');
  h.env.DB.raw.prepare('UPDATE subscriptions SET current_period_end = ? WHERE id = ?').run(new Date(Date.now() - 4 * 864e5).toISOString(), sub.id);
  assert.equal((await ai(h, 'explain', d.headers)).headers.get('X-AI-Tier'), 'free');
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'canceled', current_period_end = ? WHERE id = ?").run(new Date(Date.now() + 864e5).toISOString(), sub.id);
  assert.equal((await ai(h, 'explain', d.headers)).headers.get('X-AI-Tier'), 'family');
  h.env.DB.raw.prepare('UPDATE subscriptions SET current_period_end = ? WHERE id = ?').run(new Date(Date.now() - 60_000).toISOString(), sub.id);
  const after = await ai(h, 'explain', d.headers);
  assert.equal(after.headers.get('X-AI-Tier'), 'free');
  assert.equal(countOf(h.env, `free:fd:${d.id}`), 2, 'an ended plan leaves the device on the free taste as free:fd');
});

test('trial: tutor and check only, lower limits, paused by TRIAL_DAILY_BUDGET_USD', async () => {
  h = await setup();
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  insertSub(h.env, { kind: 'class', class_code: cls.code, plan: 'trial', seats: 10 });
  const s = bearer(cls.students[0]);
  const g = await ai(h, 'generate', s);
  assert.equal(g.status, 402);
  assert.equal((await g.json()).error, 'paid_only');
  const c = await ai(h, 'check', s);
  assert.equal(c.headers.get('X-AI-Tier'), 'trial'); assert.equal(c.headers.get('X-AI-Left'), '1');
  await setCount(h.env, `s:${cls.students[0].studentId}:tutor`, 10);
  assert.equal((await ai(h, 'explain', s)).status, 429);
  const t = await ai(h, 'explain', cls.teacher);
  assert.equal(t.headers.get('X-AI-Left'), '49');
  await setSpend(h.env, 'trial', 10);
  const paused = await ai(h, 'explain', cls.teacher);
  assert.equal(paused.status, 503);
  assert.equal((await paused.json()).error, 'free_paused');
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'free:%'").length, 0, 'a paused trial does not fall to free');
});

test('legacy: a class created before BILLING_START keeps 40 / 200 until LEGACY_CLASS_AI_UNTIL, then the free taste', async () => {
  const tomorrow = dayOf(new Date(Date.now() + 864e5));
  const later = dayOf(new Date(Date.now() + 60 * 864e5));
  h = await setup({ BILLING_START: tomorrow, LEGACY_CLASS_AI_UNTIL: later });
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  const r = await ai(h, 'generate', bearer(cls.students[0]));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'legacy'); assert.equal(r.headers.get('X-AI-Left'), '39');
  assert.equal(countOf(h.env, `s:${cls.students[0].studentId}`), 1);
  assert.equal(countOf(h.env, `cls:${cls.code}`), 3);
  const t = await ai(h, 'exam', cls.teacher);
  assert.equal(t.headers.get('X-AI-Left'), '199');
  const st = await (await h.call('GET', '/api/ai/status', { headers: bearer(cls.students[0]) })).json();
  assert.equal(st.tier, 'legacy'); assert.equal(st.legacyUntil, later);
  // a class wide cap of LEGACY_CLASS_DAILY_UNITS
  await setCount(h.env, `cls:${cls.code}`, 600);
  assert.equal((await ai(h, 'explain', bearer(cls.students[0]))).status, 429);
  h.done();
  h = await setup({ BILLING_START: tomorrow, LEGACY_CLASS_AI_UNTIL: dayOf(new Date(Date.now() - 864e5)) });
  const ended = await makeClass(h, { studentAi: true, students: ['דנה'] });
  assert.equal((await ai(h, 'explain', bearer(ended.students[0]))).headers.get('X-AI-Tier'), 'free');
  h.done();
  h = await setup({ BILLING_START: dayOf(new Date(Date.now() - 864e5)), LEGACY_CLASS_AI_UNTIL: later });
  const fresh = await makeClass(h, { studentAi: true, students: ['גל'] });
  assert.equal((await ai(h, 'explain', bearer(fresh.students[0]))).headers.get('X-AI-Tier'), 'free', 'new classes are never legacy');
});

test('every answer adds priced usage to ai_spend: pool day and month, all, kind', async () => {
  h = await setup({}, {
    claude: (p) => claudeReply(p, { usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500, cache_creation_input_tokens: 100 } }),
  });
  const { a, d1 } = await family();
  await ai(h, 'explain', d1.headers);
  await h.ctx.flush();
  const P = PRICES[h.env.CLAUDE_MODEL];
  const nano = 1000 * P.input + 200 * P.output + 500 * P.cacheRead + 100 * P.cacheWrite;
  const spend = Object.fromEntries(rows(h.env, 'SELECT pool, period, nano_usd, cache_tokens, calls FROM ai_spend').map((r) => [`${r.pool}|${r.period}`, r]));
  for (const k of [`fam:${a}|${dayOf()}`, `fam:${a}|${monthOf()}`, `all|${dayOf()}`, `all|${monthOf()}`, `kind:explain|${monthOf()}`]) {
    assert.equal(spend[k]?.nano_usd, nano, k);
    assert.equal(spend[k]?.cache_tokens, 600, k);
  }
});

test('pricing: cache tokens, fallback iterations each at their own model, and an unknown model above every known rate', () => {
  assert.equal(priceOf({ model: 'claude-haiku-5-5', usage: { input_tokens: 10, output_tokens: 5 } }).nano, 10 * 100 + 5 * 500);
  const fb = priceOf({
    model: 'claude-opus-5', usage: {
      input_tokens: 1, output_tokens: 1,
      iterations: [
        { type: 'message', model: 'claude-opus-5-5', input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 50 },
        { type: 'fallback_message', model: 'claude-sonnet-5-5', input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 10 },
      ],
    },
  });
  assert.equal(fb.nano, (100 * 4000 + 10 * 20000 + 50 * 200) + (100 * 2000 + 20 * 10000 + 10 * 2500));
  assert.equal(fb.cache, 60);
  // the fallback models cost more than the main model, and an unknown model costs more than any of them
  assert.equal(priceOf({ model: 'claude-opus-4-8', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1 } }).nano, 5000 + 25000 + 500 + 6250);
  assert.equal(priceOf({ model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 } }).nano, 5000 + 25000);
  const unknown = priceOf({ model: 'claude-future-9', usage: { input_tokens: 1, output_tokens: 1 } }).nano;
  assert.equal(unknown, 10000 + 50000);
  for (const [model, p] of Object.entries(PRICES)) assert.ok(p.input + p.output < unknown, model);
});

test('the owner gets one notice when all spend in a day passes OWNER_ALERT_USD', async () => {
  h = await setup({ OWNER_ALERT_USD: '0.000001' });
  await ai(h, 'explain', { 'X-Device': 'b'.repeat(32) });
  await ai(h, 'explain', { 'X-Device': 'c'.repeat(32) });
  await h.ctx.flush();
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:spend:%'").length, 1);
});

test('full-shape requests are byte-for-byte the params from before, for every kind', async () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/full-params.json', import.meta.url), 'utf8'));
  for (const kind of AI_KINDS) {
    assert.deepEqual(buildRequest(kind, fx[kind].input, { model: 'claude-opus-5-5' }), fx[kind].opus, kind);
    assert.deepEqual(buildRequest(kind, fx[kind].input, { model: 'claude-opus-5-5', shape: 'full' }), fx[kind].opus, kind);
    assert.deepEqual(buildRequest(kind, fx[kind].input), fx[kind].dflt, kind);
  }
  h = await setup();
  const cls = await makeClass(h);
  insertSub(h.env, { kind: 'class', class_code: cls.code });
  await ai(h, 'explain', cls.teacher, { body: fx.explain.input });
  const { betas, ...sent } = fx.explain.opus;
  assert.deepEqual(h.net.log.claude.at(-1), { ...sent, model: h.env.CLAUDE_MODEL }, 'the body sent to Claude (betas travel in a header)');
  assert.ok(betas.length);
});

test('X-AI-Tier, X-AI-Group, X-AI-Left, X-AI-Economy and X-AI-Linked are sent and exposed to the app', async () => {
  h = await setup();
  const { a, d1 } = await family();
  await setSpend(h.env, `fam:${a}`, 9, 'month');
  const r = await ai(h, 'explain', { ...d1.headers, Origin: 'http://localhost:5173' });
  assert.equal(r.headers.get('X-AI-Tier'), 'family'); assert.equal(r.headers.get('X-AI-Group'), 'tutor');
  assert.equal(r.headers.get('X-AI-Left'), '29'); assert.equal(r.headers.get('X-AI-Economy'), '1');
  const exposed = r.headers.get('Access-Control-Expose-Headers');
  for (const name of ['X-AI-Tier', 'X-AI-Group', 'X-AI-Left', 'X-AI-Economy', 'X-AI-Linked']) assert.ok(exposed.includes(name), name);
  const pre = await h.call('OPTIONS', '/api/ai/explain', { headers: { Origin: 'http://localhost:5173' } });
  const allowed = pre.headers.get('Access-Control-Allow-Headers');
  assert.ok(allowed.includes('X-Family-Device') && allowed.includes('Idempotency-Key'));
  const stale = await ai(h, 'explain', { 'X-Family-Device': `fd1.${'0'.repeat(64)}`, 'X-Device': 'e'.repeat(32) });
  assert.equal(stale.headers.get('X-AI-Linked'), '0');
  assert.equal(stale.headers.get('X-AI-Tier'), 'free');
  const st = await h.call('GET', '/api/ai/status', { headers: { 'X-Family-Device': `fd1.${'0'.repeat(64)}` } });
  assert.equal(st.headers.get('X-AI-Linked'), '0');
  await setCount(h.env, `free:d:${await devOf(h.env, 'e'.repeat(32))}`, 2);
  const refused = await ai(h, 'explain', { 'X-Family-Device': `fd1.${'0'.repeat(64)}`, 'X-Device': 'e'.repeat(32) });
  assert.equal(refused.status, 429);
  assert.equal(refused.headers.get('X-AI-Linked'), '0', 'also on a refusal');
});

test('a streamed chat sends the headers before the body and counts once', async () => {
  h = await setup();
  const { a, d1 } = await family();
  const r = await ai(h, 'chat', d1.headers, { body: { ...{ messages: [{ role: 'user', content: 'שאלה' }] }, stream: true } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'family');
  assert.equal(await r.text(), 'הסבר קצר.');
  await h.ctx.flush();
  assert.equal(countOf(h.env, `fam:${a}:tutor`), 1);
  assert.equal(rows(h.env, "SELECT * FROM ai_spend WHERE pool = 'kind:chat'").length, 1);
});

test('a streamed chat the child leaves part-way, or that breaks, is still priced in ai_spend', async () => {
  h = await setup();
  const { a, d1 } = await family();
  const left = await ai(h, 'chat', d1.headers, { body: { messages: [{ role: 'user', content: 'שלום' }], stream: true } });
  assert.equal(left.status, 200);
  await left.body.cancel(); // the child closes the sheet
  await h.ctx.flush();
  assert.equal(h.net.log.claude.length, 1);
  const spent = one(h.env, 'SELECT calls, input_tokens, output_tokens, nano_usd FROM ai_spend WHERE pool = ? AND length(period) = 10', `fam:${a}`);
  assert.equal(spent?.calls, 1, 'the abandoned stream is recorded');
  assert.equal(spent.input_tokens, 10);
  assert.ok(spent.nano_usd >= 10 * 4000, 'at least its input at the main model\'s price');
  // a stream that breaks after Claude started: what it did is priced as well
  h.done();
  h = await setup({}, {
    claude: () => new Response('event: message_start\ndata: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"claude-opus-5-5","content":[],"stop_reason":null,"usage":{"input_tokens":30,"output_tokens":1}}}\n\nevent: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"x"}}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
  });
  const f = await family('broken@example.test');
  const r = await ai(h, 'chat', f.d1.headers, { body: { messages: [{ role: 'user', content: 'שלום' }], stream: true } });
  assert.match(await r.text(), /\[\[error:/);
  await h.ctx.flush();
  const broke = one(h.env, 'SELECT calls, input_tokens FROM ai_spend WHERE pool = ? AND length(period) = 10', `fam:${f.a}`);
  assert.equal(broke?.calls, 1); assert.equal(broke.input_tokens, 30);
});
