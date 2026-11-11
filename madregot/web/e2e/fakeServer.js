// The fake Worker the end-to-end tests run against (page.route: no Worker, no Claude, no email, no payment company).
// Moved unchanged from subscription.spec.js so every spec can share it: seed `ai.apiUrl` with API, then call fakeServer.

export const API = 'https://api.madregot.test';
export const PAY = 'https://pay.example.test';
export const CORS = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-AI-Tier, X-AI-Group, X-AI-Left, X-AI-Economy, X-AI-Linked',
};
export const GROUP = { explain: 'tutor', chat: 'tutor', check: 'check', generate: 'generate', exam: 'exam' };
export const FAMILY = { tutor: 30, check: 6, generate: 5, exam: 2 };
export const CLASS = { tutor: 20, check: 3, generate: 3, exam: 1 };
export const PLANS = {
  paywall: true, online: true, vatMode: 'included', vatRate: 0.18, currency: 'ILS', termsVersion: '2026-11', checkoutHosts: ['pay.example.test'],
  plans: [
    { id: 'family_month', kind: 'family', interval: 'month', amountAgorot: 2990, vatAgorot: 456, renews: true },
    { id: 'family_year', kind: 'family', interval: 'year', amountAgorot: 24900, vatAgorot: 3798, renews: false, termMonths: 12 },
    { id: 'class_year', kind: 'class', interval: 'year', seatAgorot: 4900, minSeats: 10, maxSeats: 45, renews: false },
  ],
  limits: { family: { ...FAMILY, examMonthly: 10, devices: 3 }, class: CLASS, free: { tutor: 2 } },
  business: { name: 'מדרגות בדיקה', id: '000000000', kind: 'עוסק מורשה', address: 'רחוב הבדיקה 1, תל אביב', email: 'hello@example.test', phone: '03-0000000', provider: 'ספק בדיקה' },
  accessibility: { name: 'רכזת בדיקה', phone: '03-0000001', email: 'access@example.test', date: '2026-11-02', tested: 'axe, VoiceOver' },
  contact: 'hello@example.test',
  // the legal gate (trust spec TRUST-2 §5): approved here; st.legalApproved = false shows the draft banner
  legalDate: '2026-11-01', dbJurisdiction: 'eu', legalApproved: true, legalMissing: [],
};
export const TOKEN = (n) => String(n).padStart(64, 'a');

/** A live family plan, as GET /api/account shows it. */
export const livePlan = (over = {}) => ({
  id: '5ab0000000000001', plan: 'family_month', status: 'active', priceAgorot: 2990, periodEnd: '2026-12-10T10:00:00Z',
  cancelAtPeriodEnd: false, cancelRequestedAt: null, refundUntil: '2026-11-19T10:00:00Z', canRefundNow: true, canProrata: false,
  prorataAgorot: null, canResume: true, portal: false, economy: false, ...over,
});

/**
 * A fake Worker with the paid tutor's endpoints. `st` is its state (tests may change it); `log` lists every call.
 * `target` is a page or a whole browser context (two pages: the child's device and the parent's phone).
 * `parentOk` (trust spec TRUST-9): false, as on the real server, answers a device alone (no class, no teacher, no linked
 * device) with the parent_ok_needed state and refusal; tests about the tutor itself pass parentOk: true.
 */
export async function fakeServer(target, over = {}, base = 'http://127.0.0.1:4173/') {
  const st = {
    paywall: true, online: true, legalApproved: true, shared: null, breakNext: null, economy: false, parentOk: false,
    freeUsed: {}, freeLimit: 2, famUsed: { tutor: 0, check: 0, generate: 0, exam: 0 }, classLicence: false,
    plan: null, sessions: new Set(), recent: new Set(), devices: [], links: {}, orders: {}, n: 0,
    licence: { status: 'none', until: null, seats: null, students: 2, aiWeek: 0, joinLocked: false, request: null, legacyUntil: null, offer: { seatYearAgorot: 4900, minSeats: 10, vatMode: 'included', online: true } },
    classes: [], classPayments: [], failPayment: false,
    joinLocked: false, students: [{ id: 'a1', name: 'דנה' }, { id: 'b2', name: 'יואב' }],
    ...over,
  };
  const log = [];
  const reply = (route, code, data, headers = {}) => route.fulfill({ status: code, contentType: 'application/json', headers: { ...CORS, ...headers }, body: JSON.stringify(data) });
  const famOf = (h) => st.devices.find((d) => d.token && d.token === h['x-family-device']) || null;
  const live = () => !!st.plan && ['active', 'past_due', 'canceled'].includes(st.plan.status);
  const tierOf = (h) => {
    if (!st.paywall) return 'open';
    if (h['x-class-code']) return ['trial', 'active', 'ending'].includes(st.licence.status) ? 'teacher' : 'free';
    if (h.authorization && st.classLicence) return 'class';
    if (famOf(h) && live()) return 'family';
    return 'free';
  };
  const who = (h) => h['x-family-device'] || h['x-device'] || h.authorization || h['x-class-code'] || 'anon';
  // a child alone, on a device no parent has approved (TRUST-9)
  const waits = (h) => !st.parentOk && !h.authorization && !h['x-class-code'] && !famOf(h);
  const limitsOf = (tier) => (tier === 'family' ? FAMILY : CLASS);
  const status = (h) => {
    if (waits(h)) return { paywall: st.paywall, tier: null, state: 'parent_ok_needed', kinds: [], groups: {}, resetsAt: '2026-11-06T00:00:00+02:00', aiReady: true };
    const tier = tierOf(h);
    const fam = famOf(h);
    if (tier === 'open') return { paywall: false, tier: 'open', kinds: Object.keys(GROUP), groups: { all: { left: 40, limit: 40 } }, aiReady: true };
    const out = { paywall: true, tier, kinds: [], groups: { tutor: null, check: null, generate: null, exam: null }, economy: false, shared: null, resetsAt: '2026-11-06T00:00:00+02:00', linked: fam ? { label: fam.label } : null, legacyUntil: null, aiReady: true };
    if (tier === 'free') {
      const limit = h['x-class-code'] ? 5 : st.freeLimit;
      out.kinds = ['explain', 'chat']; out.groups.tutor = { left: Math.max(0, limit - (st.freeUsed[who(h)] || 0)), limit }; out.shared = st.shared;
      return out;
    }
    const L = limitsOf(tier); const used = tier === 'family' ? st.famUsed : {};
    out.economy = st.economy;
    for (const [k, g] of Object.entries(GROUP)) {
      if (st.economy && !['explain', 'chat'].includes(k)) continue;
      out.kinds.push(k); out.groups[g] = { left: L[g] - (used[g] || 0), limit: L[g] };
    }
    return out;
  };
  const account = () => ({
    email: 'parent@example.test', billingHold: false, maxDevices: 3, plan: live() ? st.plan : null,
    // a claimed code the child's device has not collected yet is listed as pending, as the Worker does
    devices: st.devices.map((d) => ({ id: d.id, label: d.label, linkedAt: '2026-11-05T09:00:00Z', lastSeen: '2026-11-05', ...(d.token ? {} : { pending: true }) })),
    usageWeek: { tutor: st.famUsed.tutor, check: st.famUsed.check, generate: 0, exam: 0 },
    payments: [...(live() ? [{ id: 'p000000000000001', subscriptionId: st.plan.id, planKind: 'family', at: '2026-11-05T09:00:00Z', amountAgorot: 2990, kind: 'charge', hasInvoice: true }] : []), ...st.classPayments],
    classes: st.classes,
  });
  const dashboard = () => ({
    class: { name: 'ז׳3', grade: '7', teacherName: 'רונית' }, joinLocked: st.joinLocked, help: [], mistakes: [], exams: [],
    students: st.students.map((s) => ({ ...s, lastPractice: '2026-11-05T08:00:00Z', today: { n: 3 }, week: { n: 10, first: 8, days: 2 }, levels: {}, pinReset: false })),
  });

  const handler = async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url()); const path = url.pathname; const h = req.headers();
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.push({ path, method: req.method(), body, headers: h });
    const token = h['x-account-token'];
    const signed = token && st.sessions.has(token);
    // ---- the child's side
    if (path === '/api/ai/status') return reply(route, 200, status(h), h['x-family-device'] && !famOf(h) ? { 'X-AI-Linked': '0' } : {});
    // a reported answer (trust spec TRUST-4 §4.5): kept, never counted as a question
    if (path === '/api/ai/report') return reply(route, 200, { ok: true });
    if (path.startsWith('/api/ai/')) {
      const kind = path.split('/').pop(); const g = GROUP[kind]; const tier = tierOf(h);
      let left;
      if (st.breakNext) { const e = st.breakNext; st.breakNext = null; return reply(route, e.status, e.body); }
      if (waits(h)) return reply(route, 403, { error: 'parent_ok_needed' }, h['x-family-device'] ? { 'X-AI-Linked': '0' } : {});
      if (tier === 'free') {
        if (!['explain', 'chat'].includes(kind)) return reply(route, 402, { error: 'paid_only', kind });
        if (st.shared === 'paused') return reply(route, 503, { error: 'free_paused' });
        if (st.shared) return reply(route, 429, { error: 'shared_limit', scope: st.shared });
        const limit = h['x-class-code'] ? 5 : st.freeLimit; const used = st.freeUsed[who(h)] || 0;
        if (used >= limit) return reply(route, 429, { error: 'daily_limit', tier: 'free', group: 'tutor', limit, left: 0 });
        st.freeUsed[who(h)] = used + 1;
        left = limit - used - 1;
      } else if (tier !== 'open') {
        if (st.economy && !['explain', 'chat'].includes(kind)) return reply(route, 429, { error: 'monthly_fair_use' });
        const L = limitsOf(tier);
        if (tier === 'family') { if (st.famUsed[g] >= L[g]) return reply(route, 429, { error: 'daily_limit', tier, group: g, limit: L[g], left: 0 }); st.famUsed[g] += 1; left = L[g] - st.famUsed[g]; } else left = L[g] - 1;
      } else left = 39;
      const hdr = { 'X-AI-Tier': tier, 'X-AI-Group': tier === 'open' ? 'all' : g, 'X-AI-Left': String(left), ...(h['x-family-device'] && !famOf(h) ? { 'X-AI-Linked': '0' } : {}) };
      if (kind === 'chat') return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: { ...CORS, ...hdr }, body: 'כדי לחבר מספרים עם סימנים שונים, מחסרים ושמים את הסימן של הגדול.' });
      if (kind === 'explain') return reply(route, 200, { text: 'הסבר קצר מהעוזר.' }, hdr);
      if (kind === 'check') return reply(route, 200, { readable: true, final: 'correct', steps: [{ text: '3 + 4 = 7', ok: true }], summary: 'יפה.' }, hdr);
      // new exercises (ai spec AI-4): the app's seeds come back in their own wording, each ending at the app's answer;
      // a test can write its own stories (st.genReply(body) → { items, dropped, fallback })
      if (kind === 'generate') {
        const seeds = Array.isArray(body.seeds) ? body.seeds : [];
        const echo = { items: seeds.map((sd) => ({ seed: sd.i, prompt: sd.text, hint: '', solution: [`התשובה: $= ${sd.answer}$`], kept: true, blind: 'skipped' })), dropped: {}, fallback: false };
        return reply(route, 200, st.genReply ? st.genReply(body) : echo, hdr);
      }
      return reply(route, 200, { questions: [{ prompt: '2+2', answer: '4', hint: 'חברו', solution: ['2+2=4'] }] }, hdr);
    }
    if (path === '/api/progress') return reply(route, 200, { ok: true });
    if (path === '/api/family/link/start') {
      if (!/^[a-f0-9]{32}$/.test(h['x-device'] || '')) return reply(route, 400, { error: 'need_device' });
      const code = 'K7M4QX';
      st.links[code] = { secret: body.secret, claimed: false, collected: false };
      return reply(route, 201, { code, expiresAt: '2026-11-05T11:00:00Z', url: `${base}parents/link?c=${code}` });
    }
    if (path === '/api/family/link/finish') {
      const l = st.links[body.code];
      if (!l || l.secret !== body.secret) return reply(route, 404, { error: 'link_not_found' });
      if (l.collected) return reply(route, 410, { error: 'link_expired' });
      if (!l.claimed) return reply(route, 202, { state: 'waiting' });
      l.collected = true; const d = st.devices.find((x) => x.id === l.device); d.token = `fd1.${'f'.repeat(64)}`;
      return reply(route, 200, { deviceToken: d.token, label: d.label });
    }
    if (path === '/api/family/devices/leave') { st.devices = st.devices.filter((d) => d.token !== h['x-family-device']); return reply(route, 200, { ok: true }); }
    // ---- sign-in
    if (path === '/api/account/code') return reply(route, 200, { sent: true, expiresInMinutes: 10, resendAfter: 60 });
    if (path === '/api/account/verify') {
      if (body.code !== '123456') return reply(route, 403, { error: 'wrong_code', left: 4 });
      if (token) st.sessions.delete(token);
      st.n += 1; const t = TOKEN(st.n); st.sessions.add(t); st.recent.add(t);
      return reply(route, 200, { token: t, email: body.email });
    }
    if (path === '/api/billing/plans') {
      const legal = st.legalApproved !== false;
      return reply(route, 200, { ...PLANS, paywall: st.paywall, online: st.online && legal, legalApproved: legal, legalMissing: legal ? [] : ['LEGAL_APPROVED'] });
    }
    if (path.startsWith('/api/account') || path.startsWith('/api/billing') || path === '/api/family/link/claim' || path.startsWith('/api/family/devices') || path === '/api/teacher/licence/request') {
      if (path.startsWith('/api/teacher')) { /* checked below with the class too */ } else if (!signed) return reply(route, 401, { error: 'not_account' });
    }
    if (path === '/api/account') return reply(route, 200, account());
    if (path === '/api/account/signout') { if (body.all) st.sessions.clear(); else st.sessions.delete(token); return reply(route, 200, { ok: true, revoked: 1 }); }
    if (path === '/api/account/delete') {
      if (!st.recent.has(token) || st.needReauth) { st.needReauth = false; return reply(route, 401, { error: 'reauth_needed' }); }
      st.sessions.clear(); st.plan = null; st.devices = []; st.deleted = true;
      return reply(route, 200, { ok: true });
    }
    if (path === '/api/billing/checkout') {
      if (body.adult !== true) return reply(route, 400, { error: 'adult_required' });
      if (body.terms !== '2026-11') return reply(route, 400, { error: 'terms_required' });
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(h['idempotency-key'] || '')) return reply(route, 400, { error: 'bad_idempotency_key' });
      const id = `0rd${'0'.repeat(12)}${Object.keys(st.orders).length + 1}`;
      st.orders[id] = { plan: body.plan, status: 'open', polls: 0, seats: body.seats };
      return reply(route, 201, { orderId: id, url: `${PAY}/checkout?order=${id}` });
    }
    if (path.startsWith('/api/billing/orders/')) {
      const o = st.orders[path.split('/').pop()];
      if (!o) return reply(route, 404, { error: 'not_found' });
      o.polls += 1;
      if (o.paidOnPage && o.polls >= 2 && o.status === 'open') {
        o.status = 'paid';
        if (o.plan !== 'class_year') st.plan = livePlan({ plan: o.plan });
      }
      return reply(route, 200, { status: o.status, plan: o.plan, subscription: o.status === 'paid' ? { status: 'active', periodEnd: '2026-12-05T10:00:00Z' } : null });
    }
    if (path === '/api/billing/cancel') {
      const lic = st.classes.find((c) => c.plan?.id === body.subscriptionId);
      if (lic) { lic.status = 'ended'; delete lic.plan; return reply(route, 200, { ok: true, status: 'ended', endsAt: '2026-11-05T10:00:00Z', refundAgorot: 58800, refundManual: false, synced: true, reference: 'C-1B00' }); }
      const p = st.plan;
      if (!p || p.id !== body.subscriptionId) return reply(route, 404, { error: 'no_subscription' });
      if (body.mode === 'refund_now') { st.plan = { ...p, status: 'ended' }; return reply(route, 200, { ok: true, status: 'ended', endsAt: '2026-11-05T10:00:00Z', refundAgorot: 2990, refundManual: false, synced: true, reference: 'C-7F3A' }); }
      st.plan = { ...p, status: 'canceled', cancelAtPeriodEnd: true, cancelRequestedAt: '2026-11-05T10:00:00Z', canRefundNow: false };
      return reply(route, 200, { ok: true, status: 'canceled', endsAt: p.periodEnd, refundAgorot: 0, refundManual: false, synced: true, reference: 'C-7F3A' });
    }
    if (path === '/api/billing/resume') { st.plan = { ...st.plan, status: 'active', cancelAtPeriodEnd: false, cancelRequestedAt: null }; return reply(route, 200, { ok: true, status: 'active', renewsAt: st.plan.periodEnd }); }
    // the purpose of a link (TRUST-9 §3): 'plan' needs a live plan, 'consent' (the default without one) the parent's tick
    const purposeOf = () => (['plan', 'consent'].includes(body.purpose) ? body.purpose : live() ? 'plan' : 'consent');
    if ((path === '/api/family/link/claim' || path === '/api/family/devices/this') && signed) {
      const purpose = purposeOf();
      if (purpose === 'plan' && !live()) return reply(route, 402, { error: 'needs_subscription' });
      if (purpose === 'consent' && body.consent !== true) return reply(route, 400, { error: 'consent_required' });
      st.purposes = [...(st.purposes || []), purpose];
    }
    if (path === '/api/family/link/claim') {
      const l = st.links[body.code];
      if (!l) return reply(route, 404, { error: 'link_not_found' });
      if (l.claimed) return reply(route, 409, { error: 'link_used' });
      const d = { id: `d${'0'.repeat(14)}${st.devices.length + 1}`, label: body.label || '', token: null };
      st.devices.push(d); l.claimed = true; l.device = d.id; st.claimedBy = token;
      return reply(route, 200, { ok: true, device: { id: d.id, label: d.label } });
    }
    if (path === '/api/family/devices/this') {
      const d = { id: `d${'0'.repeat(14)}${st.devices.length + 1}`, label: body.label || '', token: `fd1.${'e'.repeat(64)}` };
      st.devices.push(d); st.sessions.delete(token);
      return reply(route, 200, { deviceToken: d.token, label: d.label });
    }
    if (/^\/api\/family\/devices\/[a-z0-9]+\/unlink$/.test(path)) { st.devices = st.devices.filter((d) => d.id !== path.split('/')[4]); return reply(route, 200, { ok: true }); }
    // ---- the teacher
    if (path.startsWith('/api/teacher/')) {
      if (h['x-class-code'] !== 'K7Q2MD' || h['x-teacher-key'] !== 'tkey-123') return reply(route, 401, { error: 'not_teacher' });
      if (path === '/api/teacher/dashboard') return reply(route, 200, dashboard());
      if (path === '/api/teacher/licence') return reply(route, 200, { ...st.licence, students: st.students.length, joinLocked: st.joinLocked });
      if (path === '/api/teacher/licence/request') {
        if (!signed) return reply(route, 401, { error: 'not_account' });
        st.licence = { ...st.licence, request: { wants: body.wants, at: '2026-11-05T10:00:00Z' } }; st.request = body;
        return reply(route, 200, { ok: true });
      }
      if (path === '/api/teacher/licence/claim') {
        if (body.code !== 'ABCD-EFGH-JK23') return reply(route, 400, { error: 'bad_licence_code' });
        st.licence = { ...st.licence, status: 'active', until: '2027-08-31T20:59:59Z', seats: 35, request: null };
        return reply(route, 200, { ok: true, until: st.licence.until, seats: 35 });
      }
      if (path === '/api/teacher/class/lock') { st.joinLocked = !!body.locked; return reply(route, 200, { joinLocked: st.joinLocked }); }
      const rm = path.match(/^\/api\/teacher\/students\/([a-z0-9]+)\/remove$/);
      if (rm) { st.students = st.students.filter((s) => s.id !== rm[1]); return reply(route, 200, { ok: true }); }
    }
    return reply(route, 404, { error: 'not_found' });
  };
  // the payment company's hosted page: one link pays, then goes back to the app's plain return address
  const payPage = async (route) => {
    const url = new URL(route.request().url()); const id = url.searchParams.get('order');
    if (st.orders[id] && st.failPayment) st.orders[id].status = 'expired'; // the card was declined and the order ran out
    else if (st.orders[id]) st.orders[id].paidOnPage = true;
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><p>דף התשלום לבדיקה</p><a href="${base}parents?order=${id}">חזרה לאתר</a>` });
  };
  /** The same server for another device (a second browser context). */
  const attach = async (t) => { await t.route(`${API}/**`, handler); await t.route(`${PAY}/**`, payPage); };
  await attach(target);
  return { st, log, attach };
}
