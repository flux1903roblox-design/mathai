// The paid AI tutor: who gets which tier, subscriptions, the payment-provider adapter, webhooks, cancellation and the
// owner's admin endpoints.
//
// Tiers (decided per AI request, on the server):
//   paid  - a signed-in parent account with an active family subscription (its devices share one daily limit), or a
//           student / teacher of a class with an active class licence. Model CLAUDE_MODEL, limit AI_DAILY_LIMIT
//           (teachers TEACHER_DAILY_LIMIT), every AI kind.
//   free  - everyone else: FREE_DAILY_LIMIT questions a day (2), only the short kinds (explain, chat), on FREE_MODEL
//           (default the low-cost claude-haiku-5-5) with short answers. Counted per student, per account or per device
//           (X-Device), and capped per network address (FREE_IP_DAILY) because a whole school can share one address.
// A subscription counts while status is active, past_due (the provider is retrying) or canceled (it runs to the end of
// the paid period), and current_period_end is still ahead.
import { HttpError, body, json, sha256, randomToken, nowIso, spend, usedToday, clientIp, safeEqual, hmacHex } from './util.js';
import { cleanEmail, requireAccount } from './account.js';

export const FREE_KINDS = ['explain', 'chat'];
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export const limits = (env) => ({
  free: num(env.FREE_DAILY_LIMIT, 2),
  freeIp: num(env.FREE_IP_DAILY, 80),
  paid: num(env.AI_DAILY_LIMIT, 40),
  teacher: num(env.TEACHER_DAILY_LIMIT, 200),
});
export const freeModel = (env) => env.FREE_MODEL || 'claude-haiku-5-5';

const LIVE = "status IN ('active', 'past_due', 'canceled') AND current_period_end > ?";
export async function activeFamilySub(env, accountId) {
  if (!accountId) return null;
  return env.DB.prepare(`SELECT * FROM subscriptions WHERE kind = 'family' AND account_id = ? AND ${LIVE} ORDER BY current_period_end DESC LIMIT 1`)
    .bind(accountId, nowIso()).first();
}
export async function activeClassSub(env, classCode) {
  if (!classCode) return null;
  return env.DB.prepare(`SELECT * FROM subscriptions WHERE kind = 'class' AND class_code = ? AND ${LIVE} ORDER BY current_period_end DESC LIMIT 1`)
    .bind(String(classCode).toUpperCase(), nowIso()).first();
}

const cleanDevice = (v) => (/^[a-f0-9]{16,64}$/.test(String(v || '')) ? String(v) : null);

/** Which tier this caller gets, and the counters that apply. */
export async function entitlement(req, env, { student, teacher, account }) {
  const L = limits(env);
  if (account) {
    const sub = await activeFamilySub(env, account.id);
    if (sub) return { tier: 'paid', who: `a:${account.id}`, limit: L.paid, model: env.CLAUDE_MODEL, sub };
  }
  if (student) {
    const sub = await activeClassSub(env, student.class_code);
    if (sub) return { tier: 'paid', who: `s:${student.id}`, limit: L.paid, model: env.CLAUDE_MODEL, sub };
  }
  if (teacher) {
    const sub = await activeClassSub(env, teacher.code);
    if (sub) return { tier: 'paid', who: `t:${teacher.code}`, limit: L.teacher, model: env.CLAUDE_MODEL, sub };
  }
  const device = cleanDevice(req.headers.get('X-Device'));
  const ip = clientIp(req);
  const who = student ? `free:s:${student.id}` : account ? `free:a:${account.id}` : teacher ? `free:t:${teacher.code}` : device ? `free:d:${device}` : `free:ip:${ip}`;
  return { tier: 'free', who, limit: L.free, model: freeModel(env), kinds: FREE_KINDS, ipKey: `free-ip:${ip}`, ipLimit: L.freeIp, anonymous: !student && !account && !teacher };
}

// ---------------------------------------------------------------- subscriptions
async function upsertSubscription(env, s) {
  // one row per provider subscription; a manual grant always makes a new row
  const now = nowIso();
  const existing = s.providerRef ? await env.DB.prepare('SELECT * FROM subscriptions WHERE provider = ? AND provider_ref = ?').bind(s.provider, s.providerRef).first() : null;
  if (existing) {
    await env.DB.prepare(
      'UPDATE subscriptions SET status = ?, current_period_end = ?, cancel_at_period_end = ?, account_id = COALESCE(?, account_id), class_code = COALESCE(?, class_code), updated_at = ? WHERE id = ?',
    ).bind(s.status, s.periodEnd || existing.current_period_end, s.cancelAtPeriodEnd ? 1 : 0, s.accountId || null, s.classCode || null, now, existing.id).run();
    return existing.id;
  }
  const id = randomToken(8);
  await env.DB.prepare(
    'INSERT INTO subscriptions (id, kind, account_id, class_code, status, provider, provider_ref, current_period_end, cancel_at_period_end, created_at, updated_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, s.kind, s.accountId || null, s.classCode ? String(s.classCode).toUpperCase() : null, s.status, s.provider, s.providerRef || null, s.periodEnd, s.cancelAtPeriodEnd ? 1 : 0, now, now, s.note || null).run();
  return id;
}

/**
 * Apply one verified provider event, once. Event: { provider, eventId, type, ref, kind, accountId, email, classCode,
 * periodEnd }. type: activated | renewed | payment_failed | canceled | ended.
 */
export async function applyEvent(env, ev) {
  const fresh = await env.DB.prepare('INSERT INTO billing_events (provider, event_id, received_at, kind) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(ev.provider, String(ev.eventId), nowIso(), ev.type).run();
  if (!fresh.meta?.changes) return { duplicate: true };
  let accountId = ev.accountId || null;
  if (!accountId && ev.email) {
    const email = cleanEmail(ev.email);
    const a = await env.DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
    accountId = a?.id || randomToken(8);
    if (!a) await env.DB.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)').bind(accountId, email, nowIso()).run();
  }
  const status = { activated: 'active', renewed: 'active', payment_failed: 'past_due', canceled: 'canceled', ended: 'ended' }[ev.type];
  if (!status) return { ignored: true };
  const prev = ev.ref ? await env.DB.prepare('SELECT * FROM subscriptions WHERE provider = ? AND provider_ref = ?').bind(ev.provider, ev.ref).first() : null;
  const periodEnd = ev.type === 'ended' ? nowIso() : ev.periodEnd || prev?.current_period_end || nowIso();
  const id = await upsertSubscription(env, {
    provider: ev.provider, providerRef: ev.ref, kind: ev.kind || prev?.kind || 'family', accountId, classCode: ev.classCode,
    status, periodEnd, cancelAtPeriodEnd: ev.type === 'canceled' || (ev.type !== 'activated' && ev.type !== 'renewed' && !!prev?.cancel_at_period_end),
  });
  return { id, status };
}

// ---------------------------------------------------------------- payment providers
// A provider is { name, checkout(env, { account, plan, returnUrl }) -> { url }, webhook(req, env) -> [event], cancel(env, sub) }.
// "manual": no online payment; the owner grants subscriptions with the admin endpoints (school invoices, tests).
// "generic": a provider-neutral webhook signed with HMAC-SHA256 (header X-Signature over the raw body, secret
// BILLING_WEBHOOK_SECRET) and a hosted payment link per plan (BILLING_FAMILY_URL, with ?ref=<account id> appended);
// it lets a payment page or an automation tool (e.g. Make or Zapier relaying the provider's notification) drive
// subscriptions until a dedicated adapter for the chosen provider is added here.
const PROVIDERS = {
  manual: {
    name: 'manual',
    async checkout() { throw new HttpError(501, 'checkout_not_configured'); },
    async webhook() { throw new HttpError(404, 'not_found'); },
    async cancel() { /* nothing to stop: the owner does not charge again */ },
  },
  generic: {
    name: 'generic',
    async checkout(env, { account, plan }) {
      if (plan !== 'family' || !env.BILLING_FAMILY_URL || !env.BILLING_CANCEL_URL) throw new HttpError(501, 'checkout_not_configured');
      const url = new URL(env.BILLING_FAMILY_URL);
      url.searchParams.set('ref', account.id);
      return { url: url.toString() };
    },
    async webhook(req, env) {
      if (!env.BILLING_WEBHOOK_SECRET) throw new HttpError(503, 'billing_not_configured');
      const raw = await req.text();
      if (raw.length > 64_000) throw new HttpError(413, 'too_large');
      const sig = String(req.headers.get('X-Signature') || '').replace(/^sha256=/, '');
      if (!safeEqual(await hmacHex(env.BILLING_WEBHOOK_SECRET, raw), sig)) throw new HttpError(401, 'bad_signature');
      let data; try { data = JSON.parse(raw); } catch { throw new HttpError(400, 'bad_json'); }
      const list = Array.isArray(data) ? data : [data];
      return list.slice(0, 20).map((e) => ({
        provider: 'generic', eventId: String(e.id || ''), type: String(e.type || ''), ref: e.subscription ? String(e.subscription) : null,
        kind: e.kind === 'class' ? 'class' : 'family', accountId: e.ref ? String(e.ref) : null, email: e.email || null,
        classCode: e.classCode || null, periodEnd: e.periodEnd ? new Date(e.periodEnd).toISOString() : null,
      })).filter((e) => e.eventId && e.type);
    },
    async cancel(env, sub) {
      // A provider-neutral relay cannot stop billing by itself: the relay must cancel at the payment company, or the
      // parent would see "cancelled" here and still be charged there. Without a relay the cancel is refused.
      if (!env.BILLING_CANCEL_URL || !env.BILLING_WEBHOOK_SECRET) throw new HttpError(501, 'cancel_failed');
      const payload = JSON.stringify({ subscription: sub.provider_ref, at: nowIso() });
      const res = await fetch(env.BILLING_CANCEL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': await hmacHex(env.BILLING_WEBHOOK_SECRET, payload) }, body: payload });
      if (!res.ok) throw new HttpError(502, 'cancel_failed');
    },
  },
};
export const providerOf = (env, name) => PROVIDERS[name || env.BILLING_PROVIDER || 'manual'] || PROVIDERS.manual;

// ---------------------------------------------------------------- endpoints
const subView = (s) => (s ? { kind: s.kind, status: s.status, endsAt: s.current_period_end, cancelAtPeriodEnd: !!s.cancel_at_period_end, provider: s.provider } : null);

/** What this caller gets today, and what they could buy. No sign-in needed. */
export async function aiStatus(req, env, cors, who) {
  const ent = await entitlement(req, env, who);
  const used = await usedToday(env, ent.who);
  const provider = providerOf(env);
  return json({
    tier: ent.tier, limit: ent.limit, used, left: Math.max(0, ent.limit - used), kinds: ent.tier === 'free' ? FREE_KINDS : null,
    signedIn: !!who.account, email: who.account?.email || null,
    plan: subView(ent.sub || (who.account ? await activeFamilySub(env, who.account.id) : null)),
    offer: {
      daily: { free: limits(env).free, paid: limits(env).paid, teacher: limits(env).teacher },
      // online sign-up only when online cancelling works too (the consumer law asks for both)
      family: { price: env.PRICE_FAMILY_TEXT || null, online: provider.name !== 'manual' && !!env.BILLING_FAMILY_URL && !!env.BILLING_CANCEL_URL },
      school: { contact: env.CONTACT_EMAIL || null },
    },
    aiReady: !!env.ANTHROPIC_API_KEY,
  }, 200, cors);
}

export async function checkout(req, env, cors) {
  const account = await requireAccount(req, env);
  const b = await body(req);
  const plan = b.plan === 'family' ? 'family' : null;
  if (!plan) throw new HttpError(400, 'bad_plan');
  if (await activeFamilySub(env, account.id)) throw new HttpError(409, 'already_subscribed');
  const { url } = await providerOf(env).checkout(env, { account, plan });
  return json({ url }, 200, cors);
}

export async function webhook(name, req, env, cors) {
  const provider = PROVIDERS[name];
  if (!provider || provider.name === 'manual') throw new HttpError(404, 'not_found');
  const events = await provider.webhook(req, env);
  const results = [];
  for (const ev of events) results.push(await applyEvent(env, ev));
  return json({ ok: true, applied: results.length }, 200, cors);
}

/** Cancel the family subscription online: it stops renewing and runs to the end of the paid period. */
export async function cancel(req, env, cors) {
  const account = await requireAccount(req, env);
  const sub = await activeFamilySub(env, account.id);
  if (!sub) throw new HttpError(404, 'no_subscription');
  if (!sub.cancel_at_period_end) {
    await providerOf(env, sub.provider).cancel(env, sub);
    await env.DB.prepare("UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 1, updated_at = ? WHERE id = ?").bind(nowIso(), sub.id).run();
  }
  return json({ ok: true, endsAt: sub.current_period_end }, 200, cors);
}

// ---------------------------------------------------------------- the owner's admin endpoints (X-Admin-Key)
async function requireAdmin(req, env) {
  if (!env.ADMIN_KEY || String(env.ADMIN_KEY).length < 24) throw new HttpError(404, 'not_found');
  const ip = clientIp(req);
  if ((await usedToday(env, `admin-fail:${ip}`)) >= 20) throw new HttpError(429, 'too_many_tries');
  const key = String(req.headers.get('X-Admin-Key') || '');
  if (!safeEqual(await sha256(key), await sha256(env.ADMIN_KEY))) {
    await spend(env, `admin-fail:${ip}`, 1000);
    throw new HttpError(401, 'not_admin');
  }
}
const monthsAhead = (m) => { const d = new Date(); d.setMonth(d.getMonth() + Math.min(Math.max(Number(m) || 1, 1), 36)); return d.toISOString(); };

export async function adminGrant(req, env, cors) {
  await requireAdmin(req, env);
  const b = await body(req);
  const until = b.until && !Number.isNaN(Date.parse(b.until)) ? new Date(b.until).toISOString() : monthsAhead(b.months);
  const note = String(b.note || '').slice(0, 200) || null;
  if (b.kind === 'class') {
    const code = String(b.classCode || '').toUpperCase();
    const cls = await env.DB.prepare('SELECT code FROM classes WHERE code = ?').bind(code).first();
    if (!cls) throw new HttpError(404, 'no_class');
    const id = await upsertSubscription(env, { provider: 'manual', kind: 'class', classCode: code, status: 'active', periodEnd: until, note });
    return json({ id, kind: 'class', classCode: code, until }, 200, cors);
  }
  if (b.kind === 'family') {
    const email = cleanEmail(b.email);
    let a = await env.DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
    if (!a) { a = { id: randomToken(8) }; await env.DB.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)').bind(a.id, email, nowIso()).run(); }
    const id = await upsertSubscription(env, { provider: 'manual', kind: 'family', accountId: a.id, status: 'active', periodEnd: until, note });
    return json({ id, kind: 'family', email, until }, 200, cors);
  }
  throw new HttpError(400, 'bad_kind');
}

export async function adminEnd(req, env, cors) {
  await requireAdmin(req, env);
  const b = await body(req);
  const r = await env.DB.prepare("UPDATE subscriptions SET status = 'ended', current_period_end = ?, updated_at = ? WHERE id = ?").bind(nowIso(), nowIso(), String(b.id || '')).run();
  if (!r.meta?.changes) throw new HttpError(404, 'no_subscription');
  return json({ ok: true }, 200, cors);
}

export async function adminList(req, env, cors) {
  await requireAdmin(req, env);
  const rows = (await env.DB.prepare(
    'SELECT s.id, s.kind, s.status, s.provider, s.provider_ref, s.class_code, s.current_period_end, s.cancel_at_period_end, s.created_at, s.note, a.email FROM subscriptions s LEFT JOIN accounts a ON a.id = s.account_id ORDER BY s.created_at DESC LIMIT 500',
  ).all()).results || [];
  return json({ subscriptions: rows }, 200, cors);
}
