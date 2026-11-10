// The smart tutor's free taste, family plan and class licence, end to end against a fake server (page.route: no Worker,
// no Claude, no email, no payment company). A child sees a calm allowance and calm sheets, never a price; tools of the
// full tutor explain themselves before any upload; a parent on their own phone signs in by code, pays on the payment
// company's page and links the child's device, whose AI calls then carry an AI-only token and never the parent's
// session; cancelling takes two taps; a teacher manages the class licence, the join lock and student removal.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student, answer, proceed } from './helpers.js';

const API = 'https://api.madregot.test';
const PAY = 'https://pay.example.test';
const CORS = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-AI-Tier, X-AI-Group, X-AI-Left, X-AI-Economy, X-AI-Linked',
};
const GROUP = { explain: 'tutor', chat: 'tutor', check: 'check', generate: 'generate', exam: 'exam' };
const FAMILY = { tutor: 30, check: 6, generate: 5, exam: 2 };
const CLASS = { tutor: 20, check: 3, generate: 3, exam: 1 };
const PLANS = {
  paywall: true, online: true, vatMode: 'included', vatRate: 0.18, currency: 'ILS', termsVersion: '2026-11', checkoutHosts: ['pay.example.test'],
  plans: [
    { id: 'family_month', kind: 'family', interval: 'month', amountAgorot: 2990, vatAgorot: 456, renews: true },
    { id: 'family_year', kind: 'family', interval: 'year', amountAgorot: 24900, vatAgorot: 3798, renews: true },
    { id: 'class_year', kind: 'class', interval: 'year', seatAgorot: 4900, minSeats: 10, maxSeats: 45, renews: false },
  ],
  limits: { family: { ...FAMILY, examMonthly: 10, devices: 3 }, class: CLASS, free: { tutor: 2 } },
  business: { name: 'מדרגות בדיקה', id: '000000000', address: 'רחוב הבדיקה 1, תל אביב', email: 'hello@example.test', phone: '03-0000000' },
  contact: 'hello@example.test',
};
const TOKEN = (n) => String(n).padStart(64, 'a');
// a price, or a push to buy ('קנו' as a word, not inside 'תקנון')
const FORBIDDEN = /₪|(?<![\u0590-\u05FF])קנו(?![\u0590-\u05FF])|שדרגו/;

/** A live family plan, as GET /api/account shows it. */
const livePlan = (over = {}) => ({
  id: '5ab0000000000001', plan: 'family_month', status: 'active', priceAgorot: 2990, periodEnd: '2026-12-10T10:00:00Z',
  cancelAtPeriodEnd: false, cancelRequestedAt: null, refundUntil: '2026-11-19T10:00:00Z', canRefundNow: true, canProrata: false,
  prorataAgorot: null, canResume: true, portal: false, economy: false, ...over,
});

/**
 * A fake Worker with the paid tutor's endpoints. `st` is its state (tests may change it); `log` lists every call.
 * `target` is a page or a whole browser context (two pages: the child's device and the parent's phone).
 */
async function fakeServer(target, over = {}, base = 'http://127.0.0.1:4173/') {
  const st = {
    paywall: true, online: true, shared: null, breakNext: null, economy: false,
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
  const limitsOf = (tier) => (tier === 'family' ? FAMILY : CLASS);
  const status = (h) => {
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
    if (path.startsWith('/api/ai/')) {
      const kind = path.split('/').pop(); const g = GROUP[kind]; const tier = tierOf(h);
      let left;
      if (st.breakNext) { const e = st.breakNext; st.breakNext = null; return reply(route, e.status, e.body); }
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
    if (path === '/api/billing/plans') return reply(route, 200, { ...PLANS, paywall: st.paywall, online: st.online });
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
    if (path === '/api/family/link/claim') {
      if (!live()) return reply(route, 402, { error: 'needs_subscription' });
      const l = st.links[body.code];
      if (!l) return reply(route, 404, { error: 'link_not_found' });
      if (l.claimed) return reply(route, 409, { error: 'link_used' });
      const d = { id: `d${'0'.repeat(14)}${st.devices.length + 1}`, label: body.label || '', token: null };
      st.devices.push(d); l.claimed = true; l.device = d.id; st.claimedBy = token;
      return reply(route, 200, { ok: true, device: { id: d.id, label: d.label } });
    }
    if (path === '/api/family/devices/this') {
      if (!live()) return reply(route, 402, { error: 'needs_subscription' });
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

/**
 * Open a route on a device with a saved state. The storage is seeded by an init script before the app starts, so an app
 * still running from the last route can never write its old state over the new one (it may be answering the server).
 * `local`: more localStorage keys (a parent's session on their own phone).
 */
let seeds = 0;
async function open(page, route, state = null, { local = {}, seed = '424242' } = {}) {
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  seeds += 1;
  const key = `seeded-${seeds}-${Date.now()}`;
  await page.addInitScript(([s, sd, k, extra]) => {
    if (location.protocol === 'about:' || sessionStorage.getItem(k)) return;
    Object.keys(sessionStorage).filter((x) => !x.startsWith('seeded-')).forEach((x) => sessionStorage.removeItem(x));
    sessionStorage.setItem(k, '1');
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', sd);
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
    Object.entries(extra).forEach(([n, v]) => localStorage.setItem(n, v));
  }, [state, seed, key, local]);
  await page.goto(`./${route}`);
  await page.evaluate(() => document.fonts.ready);
}

/** A device with the app pointed at the fake server. `profile: null` is the parent's own phone. */
// (seeded as a current, v3 save: the v3 migration drops a saved server address in builds that cannot change it)
const withServer = (extra = {}, grade = '7') => ({ ...student(grade, { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, ...extra }), version: 3 });
const classStudent = (extra = {}) => withServer({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' }, ...extra });
const parentPhone = () => withServer({ profile: null });
const teacher = () => withServer({ profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7' }], active: 'K7Q2MD' } });
const aiCalls = (log) => log.filter((r) => r.path.startsWith('/api/ai/') && r.path !== '/api/ai/status');
const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';

// Screenshots for a look at the screens (SUBV2_SHOTS=<folder>); nothing is compared.
async function shot(page, name) {
  const dir = process.env.SUBV2_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png`, fullPage: false });
}

/** Sign in on the parents page with the emailed code (a wrong code first, when asked). */
async function signIn(page, { wrongFirst = false } = {}) {
  await page.getByLabel('כתובת המייל שלכם').fill('parent@example.test');
  await page.getByRole('button', { name: 'שליחת קוד' }).click();
  await expect(page.getByText('שלחנו קוד בן 6 ספרות אל')).toBeVisible();
  if (wrongFirst) {
    await page.getByLabel('הקוד מהמייל').fill('111111');
    await expect(page.getByRole('alert')).toContainText('הקוד לא נכון. נשארו עוד 4 ניסיונות.');
  }
  await page.getByLabel('הקוד מהמייל').fill('123456');
}

test.describe('the smart tutor', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('the free taste: two questions, then the chat rests calmly and Madi takes over', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/assistant', withServer());
    await expect(page.getByText('היום אפשר לשאול את העוזר החכם עוד 2 שאלות.')).toBeVisible();
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך מחברים 3 ועוד מינוס 5?'); await draft.press('Enter');
    await expect(page.getByText('היום אפשר לשאול את העוזר החכם עוד שאלה אחת.')).toBeVisible();
    await draft.fill('ועוד שאלה'); await draft.press('Enter');
    await expect(page.getByText('להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.')).toBeVisible();
    await expect(draft).toBeDisabled();
    // the answer just received is on screen, above the docked card and input (not hidden behind them)
    const lastAnswer = page.locator('.msg-row.assistant').last();
    await expect(lastAnswer).toBeInViewport();
    const [answerBox, dockBox] = [await lastAnswer.boundingBox(), await page.locator('.chat-dock-live').boundingBox()];
    expect(answerBox.y + answerBox.height).toBeLessThanOrEqual(dockBox.y + 1);
    await expect(draft).toHaveAttribute('placeholder', 'העוזר החכם חוזר מחר');
    await shot(page, 'chat-rest');
    expect(aiCalls(log)).toHaveLength(2);
    // every call carried this device's id, never an account token
    const devices = new Set(aiCalls(log).map((r) => r.headers['x-device']));
    expect(devices.size).toBe(1); expect([...devices][0]).toMatch(/^[a-f0-9]{32}$/);
    expect(aiCalls(log).some((r) => r.headers['x-account-token'])).toBe(false);
    await expect(page.locator('.form-error')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);
    // in a lesson the tutor's button gives way to Madi, who answers without a request
    await page.goto('./#/lesson/signed/1');
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'למה טעיתי?' })).toHaveCount(0);
    await page.locator('section.fb-reveal').getByRole('button', { name: 'שאלה למדי' }).click();
    const madi = page.getByRole('dialog', { name: 'שאלה למדי' });
    await expect(madi.getByText('העוזר החכם חוזר מחר')).toBeVisible();
    await expect(madi.locator('.tutor-q')).toHaveCount(1); // the question about the mistake is asked at once
    expect(aiCalls(log)).toHaveLength(2);
  });

  test('when the server says today is done, a calm sheet opens and "ask Madi" opens Madi', async ({ page }) => {
    const { st, log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/lesson/signed/1', withServer());
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    await expect(page.locator('.ai-left')).toContainText('היום אפשר לשאול את העוזר החכם עוד 2 שאלות.');
    expect(aiCalls(log)).toHaveLength(0); // the free taste never asks by itself
    st.freeLimit = 0; // used up on another screen in the meantime
    await page.getByRole('button', { name: 'למה טעיתי?' }).click();
    const sheet = page.getByRole('dialog', { name: 'העוזר החכם חוזר מחר' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('מדי יכול להסביר את המדרגה')).toBeVisible();
    // in a lesson the sheet offers no parents link: it would ask the child to leave the lesson
    await expect(sheet.getByRole('button', { name: 'מידע להורים' })).toHaveCount(0);
    expect(await sheet.innerText()).not.toMatch(FORBIDDEN);
    await shot(page, 'limit-sheet');
    await sheet.getByRole('button', { name: 'לשאול את מדי' }).click();
    await expect(page.getByRole('dialog', { name: 'שאלה למדי' })).toBeVisible();
    await expect(page.locator('.form-error')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('section.fb-reveal').getByRole('button', { name: 'שאלה למדי' })).toBeVisible();
  });

  test('busy networks, a resting free tutor and the month\'s fair use show calm sheets, never a red error', async ({ page }) => {
    const { st } = await fakeServer(page, {}, baseOf());
    await open(page, '#/assistant', withServer());
    const draft = page.getByLabel('ההודעה שלכם');
    st.breakNext = { status: 429, body: { error: 'shared_limit', scope: 'network' } };
    await draft.fill('שאלה'); await draft.press('Enter');
    const busy = page.getByRole('dialog', { name: 'העוזר החכם עמוס היום' });
    await expect(busy.getByText('מאותה רשת אינטרנט')).toBeVisible();
    await busy.getByRole('button', { name: 'סגירה' }).click();
    await expect(page.locator('.form-error')).toHaveCount(0);
    await expect(draft).toBeDisabled(); // the draft waits for tomorrow
    // a resting free tutor
    await open(page, '#/assistant', withServer());
    st.breakNext = { status: 503, body: { error: 'free_paused' } };
    await page.getByLabel('ההודעה שלכם').fill('שאלה'); await page.getByLabel('ההודעה שלכם').press('Enter');
    await expect(page.getByRole('dialog', { name: 'העוזר החכם נח היום' })).toBeVisible();
    await expect(page.locator('.form-error')).toHaveCount(0);
    // a family plan over its month: the photo check says when it is back, and a stale screen gets the calm sheet
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: `fd1.${'c'.repeat(64)}` }); st.plan = livePlan(); st.economy = true;
    await open(page, '#/assistant', withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '', familyDevice: { token: `fd1.${'c'.repeat(64)}`, label: 'הטאבלט' } } }));
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    await expect(page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' }).getByText('הבדיקה הזו חוזרת ב־1 בחודש.')).toBeVisible();
    await page.keyboard.press('Escape');
    st.breakNext = { status: 429, body: { error: 'monthly_fair_use' } };
    await page.getByLabel('ההודעה שלכם').fill('שאלה'); await page.getByLabel('ההודעה שלכם').press('Enter');
    await expect(page.getByRole('dialog', { name: 'הבדיקות של החודש נגמרו' })).toBeVisible();
    await expect(page.locator('.form-error')).toHaveCount(0);
  });

  test('tools of the full tutor show their info state before any upload; a class student can send the page to the teacher', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/assistant', withServer());
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    const photo = page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' });
    await expect(photo.getByText('את הבדיקה הזו עושה העוזר החכם המלא.')).toBeVisible();
    await expect(photo.getByRole('link', { name: 'מידע להורים' })).toBeVisible();
    await expect(photo.locator('input[type=file]')).toHaveCount(0);
    await shot(page, 'tool-locked');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'תרגילים חדשים' }).click();
    await expect(page.getByRole('dialog', { name: 'תרגילים חדשים' }).getByText('תרגילים חדשים מכין העוזר החכם המלא.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'כתיבת תרגילים' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('./#/exams/check');
    await expect(page.getByText('את בדיקת המבחן עושה העוזר החכם המלא.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'מבחן תרגול עם מפתח תשובות' })).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await shot(page, 'exam-locked');
    // the topic guide offers no "new exercises" on the free taste
    await page.goto('./#/topic/signed');
    await expect(page.getByRole('button', { name: /תרגילים נוספים מהעוזר/ })).toHaveCount(0);
    // the class student's notebook: the photo check explains itself and offers the teacher
    await open(page, '#/lesson/signed/1', classStudent());
    await page.getByRole('button', { name: 'מחברת' }).click();
    const canvas = page.locator('.nb-canvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 60, { steps: 5 }); await page.mouse.up();
    await page.getByRole('button', { name: 'בדיקת הדרך עם העוזר' }).click();
    await expect(page.getByText('רוצים שמישהו יסתכל על הפתרון? אפשר לשלוח את הדף למורה.')).toBeVisible();
    await page.getByRole('button', { name: 'לשלוח למורה' }).click();
    await expect(page.getByRole('dialog', { name: 'לבקש עזרה מהמורה' })).toBeVisible();
    expect(log.filter((r) => ['/api/ai/check', '/api/ai/generate', '/api/ai/exam'].includes(r.path))).toHaveLength(0);
    expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);
  });

  test('the lesson asks the tutor by itself on a family plan and in a licensed class, never on the free taste', async ({ page }) => {
    const { st, log } = await fakeServer(page, {}, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: `fd1.${'c'.repeat(64)}` }); st.plan = livePlan();
    await open(page, '#/lesson/signed/1', withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '', familyDevice: { token: `fd1.${'c'.repeat(64)}`, label: 'הטאבלט' } } }));
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.getByText('הסבר קצר מהעוזר.')).toBeVisible();
    const fam = aiCalls(log).find((r) => r.path === '/api/ai/explain');
    expect(fam.headers['x-family-device']).toBe(`fd1.${'c'.repeat(64)}`);
    expect(fam.headers['x-account-token']).toBeUndefined();
    st.classLicence = true;
    await open(page, '#/lesson/signed/1', classStudent());
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.getByText('הסבר קצר מהעוזר.')).toBeVisible();
    expect(aiCalls(log).filter((r) => r.path === '/api/ai/explain')).toHaveLength(2);
    expect(aiCalls(log).at(-1).headers.authorization).toBe('Bearer stu_token_1');
  });

  test('a parent on their own phone signs in, pays and links the child\'s device, which then asks as the family', async ({ browser, page }) => {
    const base = baseOf();
    const { log, attach } = await fakeServer(page.context(), {}, base);
    // the child's device: settings → the family plan → a QR code and the code, no price
    await open(page, '#/settings', withServer());
    await page.locator('#ai-title').scrollIntoViewIfNeeded();
    await shot(page, 'settings-free');
    await page.getByRole('link', { name: 'חיבור למנוי משפחתי' }).click();
    await expect(page.getByRole('heading', { name: 'המסך הזה בשביל ההורים' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'קוד QR לטלפון של ההורים' })).toBeVisible();
    await expect(page.locator('.handoff-code')).toHaveText('K7M4QX');
    await expect(page.getByText('מחכים להורים…')).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);
    await shot(page, 'handoff');
    // the parent's own phone: no profile at all
    const phone = await browser.newContext({ baseURL: base, viewport: page.viewportSize(), isMobile: true, hasTouch: true, locale: 'he-IL', reducedMotion: 'reduce' });
    await attach(phone); // the same server answers both devices
    const pp = await phone.newPage();
    await open(pp, '#/parents/link?c=K7M4QX', parentPhone());
    await expect(pp.getByRole('heading', { name: 'העוזר החכם של מדרגות · להורים' })).toBeVisible();
    await expect(pp.locator('.parents-price')).toHaveText('₪29.90 לחודש, כולל מע״מאו ₪249 לשנה, כולל מע״מ');
    await shot(pp, 'parents-info');
    await signIn(pp, { wrongFirst: true });
    await expect(pp.getByRole('heading', { name: 'אין מנוי פעיל' })).toBeVisible();
    await expect(pp.getByText('אחרי התשלום אפשר יהיה לחבר את המכשיר של הילד עם הקוד')).toBeVisible();
    const saved = await pp.evaluate(() => JSON.parse(localStorage.getItem('madregot-parent')));
    expect(saved.email).toBe('parent@example.test');
    await expect(pp.getByText('סה״כ לתשלום היום: ₪29.90 (כולל מע״מ 18%).')).toBeVisible();
    await shot(pp, 'parents-plans');
    await pp.getByRole('button', { name: 'למעבר לתשלום מאובטח' }).click();
    await expect(pp.getByRole('alert')).toContainText('מעל גיל 18');
    await pp.getByLabel('אני מעל גיל 18, ואני ההורה או האפוטרופוס של הילד/ה').check();
    await pp.getByLabel('קראתי את התקנון ואת מדיניות הביטול').check();
    await pp.getByRole('button', { name: 'למעבר לתשלום מאובטח' }).click();
    await pp.waitForURL(`${PAY}/**`);
    const checkout = log.find((r) => r.path === '/api/billing/checkout');
    expect(checkout.body).toMatchObject({ plan: 'family_month', adult: true, terms: '2026-11' });
    expect(checkout.body.amountAgorot).toBeUndefined();
    // back from the payment page at the plain return address: the order is polled until the plan is active
    await pp.getByRole('link', { name: 'חזרה לאתר' }).click();
    await expect(pp.getByText('מאשרים את התשלום…')).toBeVisible();
    await expect(pp.getByText('המנוי פעיל', { exact: true })).toBeVisible({ timeout: 15_000 });
    // the code from the QR waits, filled in, for the parent: a link alone never attaches a device to the plan
    const linkCard = pp.locator('section', { has: pp.getByRole('heading', { name: 'חיבור המכשיר של הילד' }) });
    await expect(linkCard.getByLabel('הקוד מהמכשיר של הילד')).toHaveValue('K7M4QX');
    await expect(linkCard.getByText('המכשיר שמציג את הקוד הזה יקבל את העוזר החכם דרך המנוי שלכם.')).toBeVisible();
    expect(log.find((r) => r.path === '/api/family/link/claim')).toBeUndefined();
    await linkCard.getByLabel('איך לקרוא למכשיר? (לא חובה, למשל: הטאבלט)').fill('הטאבלט של נועה');
    await linkCard.getByRole('button', { name: 'חיבור המכשיר' }).click();
    await expect(pp.getByText('קיבלנו את הקוד. המכשיר של הילד יתחבר ברגע שהמסך עם הקוד פתוח בו.')).toBeVisible();
    await expect(pp.getByText('המנוי פעיל', { exact: true })).toHaveCount(0); // one line at a time: the newer replaced it
    expect(log.find((r) => r.path === '/api/family/link/claim').body).toEqual({ code: 'K7M4QX', label: 'הטאבלט של נועה' });
    await shot(pp, 'parents-active');
    // the child's device collects its token by itself, then asks as the family
    await expect(page.getByText('העוזר החכם פתוח! אפשר לשאול אותו על כל תרגיל.')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'לעוזר החכם' }).click();
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('שאלה'); await draft.press('Enter');
    await expect(page.getByText('כדי לחבר מספרים עם סימנים שונים')).toBeVisible();
    const last = aiCalls(log).at(-1);
    expect(last.headers['x-family-device']).toMatch(/^fd1\.[a-f0-9]{64}$/);
    expect(last.headers['x-account-token']).toBeUndefined();
    const child = await page.evaluate(() => ({ store: JSON.parse(localStorage.getItem('madregot')).state.ai, parent: localStorage.getItem('madregot-parent') || sessionStorage.getItem('madregot-parent') }));
    expect(child.store.account).toBeUndefined();
    expect(child.store.familyDevice.token).toMatch(/^fd1\./);
    expect(child.parent).toBeNull();
    await phone.close();
  });

  test('the parent finishes on the child\'s device: it is linked, and the parent is signed out there', async ({ page }) => {
    const { st, log } = await fakeServer(page, { plan: livePlan() }, baseOf());
    await open(page, '#/parents/info', withServer());
    await page.getByRole('link', { name: 'להמשיך במכשיר הזה (להורים)' }).click();
    await signIn(page);
    await expect(page.getByRole('heading', { name: /המנוי פעיל/ })).toBeVisible();
    // a device with a profile keeps the parent's session for this tab only
    expect(await page.evaluate(() => [!!sessionStorage.getItem('madregot-parent'), !!localStorage.getItem('madregot-parent')])).toEqual([true, false]);
    await page.getByRole('button', { name: 'להפעיל את העוזר החכם במכשיר הזה' }).click();
    await expect(page.getByText('המכשיר חובר. כדי שאי אפשר יהיה לשנות את המנוי מהמכשיר הזה, יצאנו מהחשבון שלכם בו.')).toBeVisible();
    await shot(page, 'same-device-linked');
    await expect(page.getByLabel('כתובת המייל שלכם')).toBeVisible(); // /parents asks for a code again
    expect(await page.evaluate(() => [sessionStorage.getItem('madregot-parent'), localStorage.getItem('madregot-parent')])).toEqual([null, null]);
    expect(st.sessions.size).toBe(0); // the server deleted the session that asked
    const ai = await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.ai);
    expect(ai.familyDevice.token).toBe(`fd1.${'e'.repeat(64)}`);
    expect(log.find((r) => r.path === '/api/family/devices/this').headers['x-device']).toMatch(/^[a-f0-9]{32}$/);
    await page.getByRole('button', { name: 'חזרה לאפליקציה' }).click();
    await expect(page.getByText('העוזר החכם פתוח במכשיר הזה דרך המנוי המשפחתי.').or(page.getByLabel('ההודעה שלכם'))).toBeVisible();
    await page.goto('./#/settings');
    await expect(page.getByText('העוזר החכם פתוח במכשיר הזה דרך המנוי המשפחתי.')).toBeVisible();
    await page.locator('#ai-title').scrollIntoViewIfNeeded();
    await shot(page, 'settings-linked');
  });

  test('cancelling takes two taps from the plan card, names the end date and the 14-day refund, and can be undone', async ({ page }) => {
    const { st, log } = await fakeServer(page, { plan: livePlan() }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/parents', parentPhone(), { local: { 'madregot-parent': JSON.stringify({ token: TOKEN(9), email: 'parent@example.test' }) } });
    await expect(page.getByRole('heading', { name: 'המנוי פעיל · החיוב הבא: ₪29.90 ב־10.12.2026' })).toBeVisible();
    await shot(page, 'plan-card');
    await page.getByRole('button', { name: 'ביטול המנוי' }).click();
    const sheet = page.getByRole('dialog', { name: 'לבטל את המנוי?' });
    await expect(sheet.getByText('העוזר החכם ימשיך לעבוד עד 10.12.2026, ואז יחזור ל־2 שאלות ביום.')).toBeVisible();
    await expect(sheet.getByRole('radio', { name: /לבטל עכשיו ולקבל החזר מלא של ₪29.90/ })).toBeVisible();
    await shot(page, 'cancel-sheet');
    await sheet.getByRole('button', { name: 'כן, לבטל' }).click();
    await expect(page.getByText('ביטלתם. שלחנו אישור למייל. מספר אישור: C-7F3A.')).toBeVisible();
    const done = page.locator('.parents-banner');
    await expect(done).toBeInViewport();
    await expect(done).toBeFocused();
    await expect(done.locator('bdi')).toHaveText('C-7F3A');
    expect(log.find((r) => r.path === '/api/billing/cancel').body).toEqual({ subscriptionId: '5ab0000000000001', mode: 'period_end' });
    await expect(page.getByRole('heading', { name: 'המנוי בוטל. העוזר החכם פתוח עד 10.12.2026, ולא יהיו חיובים נוספים.' })).toBeVisible();
    await page.getByRole('button', { name: 'לחדש את המנוי' }).click();
    await expect(page.getByRole('heading', { name: 'המנוי פעיל · החיוב הבא: ₪29.90 ב־10.12.2026' })).toBeVisible();
    // devices: one is unlinked by the parent
    st.devices.push({ id: 'd000000000000009', label: 'הטאבלט', token: `fd1.${'9'.repeat(64)}` });
    await page.reload();
    await page.getByRole('button', { name: 'מכשירים מחוברים (1)' }).click();
    await expect(page.getByText('הטאבלט · חובר ב־05.11.2026 · שימוש אחרון 05.11.2026')).toBeVisible();
    await page.getByRole('button', { name: 'ניתוק' }).click();
    await expect(page.getByText('העוזר החכם יחזור במכשיר "הטאבלט" ל־2 שאלות ביום.')).toBeVisible();
    await page.getByRole('button', { name: 'כן, לנתק' }).click();
    await expect(page.getByRole('button', { name: 'מכשירים מחוברים (0)' })).toBeVisible();
    // deleting the account asks for a fresh code first
    await page.getByRole('button', { name: 'מחיקת החשבון' }).click();
    await page.getByRole('dialog', { name: 'למחוק את החשבון?' }).getByRole('button', { name: 'כן, למחוק' }).click();
    await expect(page.getByText('כדי למחוק, שלחנו קוד חדש למייל.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'אישור ומחיקה' })).toBeVisible();
    await expect(page.getByText('צריך אותו רק כדי להצטרף')).toHaveCount(0);
    await shot(page, 'delete-step-up');
    await page.getByLabel('הקוד מהמייל').fill('123456');
    await expect(page.getByLabel('כתובת המייל שלכם')).toBeVisible();
    expect(st.deleted).toBe(true);
  });

  test('the front page\'s cancel link → /cancel → a code → cancel', async ({ page }) => {
    const { st } = await fakeServer(page, { plan: livePlan({ canRefundNow: false }) }, baseOf());
    await open(page, '#/', parentPhone());
    await expect(page.getByRole('navigation', { name: 'להורים ומידע משפטי' })).toBeVisible();
    await shot(page, 'welcome-footer');
    await page.getByRole('link', { name: 'ביטול מנוי' }).click();
    await expect(page.getByRole('heading', { name: 'ביטול מנוי' })).toBeVisible();
    await expect(page.getByText('אפשר לבטל גם במייל אל')).toBeVisible();
    await shot(page, 'cancel-signed-out');
    await signIn(page);
    const sheet = page.getByRole('dialog', { name: 'לבטל את המנוי?' });
    await expect(sheet).toBeVisible(); // it opens by itself after sign-in
    await sheet.getByRole('button', { name: 'כן, לבטל' }).click();
    await expect(page.getByText('מספר אישור: C-7F3A.')).toBeVisible();
    expect(st.plan.status).toBe('canceled');
    // the plain address works too (a link in an email)
    await page.goto(`${baseOf()}cancel`);
    await expect(page).toHaveURL(/#\/cancel$/);
    await expect(page.getByRole('heading', { name: 'מדרגות · להורים' })).toBeVisible();
  });

  test('past_due, economy and an ended plan on the parents page', async ({ page }) => {
    const { st } = await fakeServer(page, { plan: livePlan({ status: 'past_due', portal: true, accessUntil: '2026-12-13T10:00:00Z' }) }, baseOf());
    st.sessions.add(TOKEN(8));
    await open(page, '#/parents', parentPhone(), { local: { 'madregot-parent': JSON.stringify({ token: TOKEN(8), email: 'parent@example.test' }) } });
    await expect(page.getByRole('heading', { name: 'התשלום האחרון לא עבר' })).toBeVisible();
    await expect(page.getByText('חברת הסליקה תנסה שוב בימים הקרובים, והעוזר החכם ממשיך לעבוד עד 13.12.2026.')).toBeVisible();
    await expect(page.getByText('החיוב הבא')).toHaveCount(0);
    await shot(page, 'past-due');
    await expect(page.getByRole('button', { name: 'עדכון אמצעי תשלום' })).toBeVisible();
    // a provider with no page for the card: the row says who updates it, and how to reach us
    st.plan = livePlan({ status: 'past_due', portal: false, periodEnd: '2026-11-04T10:00:00Z', accessUntil: '2026-11-07T10:00:00Z' });
    await page.reload();
    await page.getByRole('button', { name: 'עדכון אמצעי תשלום' }).click();
    await expect(page.getByText('עדכון אמצעי תשלום נעשה מול חברת הסליקה. כתבו לנו אל hello@example.test ונעזור.')).toBeVisible();
    // its period is over: cancelling ends it now, and the sheet says so
    await page.getByRole('button', { name: 'ביטול המנוי' }).click();
    await expect(page.getByRole('dialog', { name: 'לבטל את המנוי?' }).getByText('התשלום האחרון לא עבר, אז העוזר החכם יחזור עכשיו ל־2 שאלות ביום.')).toBeVisible();
    await page.keyboard.press('Escape');
    st.plan = livePlan({ economy: true });
    await page.reload();
    await expect(page.getByText('החודש השימוש גבוה במיוחד, אז עד ה־1 בחודש העוזר עונה בשיחה בגרסה קצרה')).toBeVisible();
    st.plan = null;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'אין מנוי פעיל' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /שנתי/ })).toContainText('₪249 לשנה, כולל מע״מ (₪20.75 לחודש)');
    // the disclosure, before payment
    await expect(page.getByLabel('פרטי העסק')).toContainText('מדרגות בדיקה');
    await expect(page.getByRole('contentinfo', { name: 'ביטול מנוי ומידע משפטי' })).toContainText('רחוב הבדיקה 1');
  });

  test('a teacher: the licence card, a request with code sign-in, a licence code, the join lock and removing a student', async ({ page }) => {
    const { st, log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher', teacher());
    const card = page.locator('#t-licence');
    await expect(card.getByRole('heading', { name: 'העוזר החכם בכיתה' })).toBeVisible();
    await expect(card.getByText('בלי רישיון, כל תלמיד יכול לשאול את העוזר החכם 2 שאלות ביום.')).toBeVisible();
    await shot(page, 'licence-card');
    await card.getByRole('button', { name: 'הצעת מחיר לבית הספר' }).click();
    const sheet = page.getByRole('dialog', { name: 'הצעת מחיר לבית הספר' });
    await signIn(sheet);
    await sheet.getByLabel('שם בית הספר').fill('חטיבת הביניים <הדר>');
    await sheet.getByLabel('כמה תלמידים בכיתה').fill('32');
    await shot(page, 'licence-request');
    await sheet.getByRole('button', { name: 'שליחה' }).click();
    await expect(sheet.getByText('קיבלנו. נשלח הצעת מחיר וחשבונית למייל תוך יום עבודה.')).toBeVisible();
    expect(st.request).toMatchObject({ wants: 'quote', school: 'חטיבת הביניים <הדר>', classes: 1, students: 32 });
    expect(log.find((r) => r.path === '/api/teacher/licence/request').headers['x-account-token']).toBeTruthy();
    await sheet.getByRole('button', { name: 'סגירה', exact: true }).first().click();
    await expect(card.getByText('ביקשתם הצעת מחיר ב־05.11.2026. נחזור אליכם במייל.')).toBeVisible();
    // a school's licence code
    await card.getByRole('button', { name: 'יש לי קוד רישיון מבית הספר' }).click();
    await card.getByLabel('קוד רישיון מבית הספר').fill('abcdefghjk23');
    await expect(card.getByLabel('קוד רישיון מבית הספר')).toHaveValue('ABCD-EFGH-JK23');
    await card.getByRole('button', { name: 'הפעלה' }).click();
    await expect(card.getByRole('heading', { name: 'רישיון כיתה פעיל עד 31.08.2027' })).toBeVisible();
    await expect(card.getByText('35 מקומות · 2 תלמידים בכיתה')).toBeVisible();
    // the students tab: the join lock and removing a student
    await page.getByRole('tab', { name: 'תלמידים' }).click();
    await page.getByRole('switch', { name: 'נעילת הכיתה לתלמידים חדשים' }).click();
    await expect(page.getByText('הכיתה נעולה לתלמידים חדשים.')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'נעילת הכיתה לתלמידים חדשים' })).toBeChecked();
    expect(st.joinLocked).toBe(true);
    await shot(page, 'teacher-students');
    await page.getByRole('row', { name: /יואב/ }).getByRole('button', { name: 'הסרה מהכיתה' }).click();
    const rm = page.getByRole('dialog', { name: 'להסיר את יואב מהכיתה?' });
    await expect(rm.getByText('כדי שלא תהיה הצטרפות מחדש באותו שם, נעלו את הכיתה.')).toBeVisible();
    await rm.getByRole('button', { name: 'כן, להסיר' }).click();
    await expect(page.getByRole('row', { name: /יואב/ })).toHaveCount(0);
    expect(st.students.map((s) => s.name)).toEqual(['דנה']);
  });

  test('a copy without a server: the parents pages say so, nothing is requested, nothing is offered', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { if (/\/api\//.test(r.url())) calls.push(r.url()); });
    await open(page, '#/parents', student());
    await expect(page.getByText('בגרסה הזו אין שרת, ולכן אין כאן מנויים. התרגול עובד כרגיל.')).toBeVisible();
    await shot(page, 'parents-nosrv');
    await page.goto('./#/parents/info');
    await expect(page.getByText('בגרסה הזו אין שרת, ולכן אין כאן מנויים.')).toBeVisible();
    await page.goto('./#/cancel');
    await expect(page.getByText('בגרסה הזו אין שרת, ולכן אין כאן מנויים.')).toBeVisible();
    await page.goto('./#/settings');
    await expect(page.getByText('בגרסה הזו העוזר החכם לא מחובר.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'חיבור למנוי משפחתי' })).toHaveCount(0);
    await page.goto('./#/assistant');
    await expect(page.getByRole('heading', { name: 'העוזר עוד לא מחובר' })).toBeVisible();
    await open(page, '#/');
    await expect(page.getByRole('navigation', { name: 'להורים ומידע משפטי' })).toHaveCount(0);
    await page.goto('./#/terms');
    await expect(page.getByRole('heading', { name: 'תקנון' })).toBeVisible();
    await shot(page, 'legal-terms');
    expect(calls).toEqual([]);
  });

  test('QA hooks render the tutor and parents states with no request', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { if (/\/api\//.test(r.url())) calls.push(r.url()); });
    await open(page, '#/assistant?qa-ai=free1', student());
    await expect(page.getByText('היום אפשר לשאול את העוזר החכם עוד שאלה אחת.')).toBeVisible();
    await open(page, '#/parents?qa-parent=refund-window', student());
    await expect(page.getByRole('heading', { name: 'המנוי פעיל · החיוב הבא: ₪29.90 ב־10.12.2026' })).toBeVisible();
    await page.getByRole('button', { name: 'ביטול המנוי' }).click();
    await expect(page.getByRole('radio', { name: /החזר מלא/ })).toBeVisible();
    await open(page, '#/parents?qa-parent=plans', student());
    await expect(page.getByRole('heading', { name: 'אין מנוי פעיל' })).toBeVisible();
    expect(calls).toEqual([]);
  });
  test('a payment that did not go through hands the page back: a calm line and the pay button again', async ({ page }) => {
    const { st, log } = await fakeServer(page, { failPayment: true }, baseOf());
    await open(page, '#/parents', parentPhone());
    await signIn(page);
    await page.getByLabel('אני מעל גיל 18, ואני ההורה או האפוטרופוס של הילד/ה').check();
    await page.getByLabel('קראתי את התקנון ואת מדיניות הביטול').check();
    await page.getByRole('button', { name: 'למעבר לתשלום מאובטח' }).click();
    await page.waitForURL(`${PAY}/**`);
    await page.getByRole('link', { name: 'חזרה לאתר' }).click();
    await expect(page.getByText('התשלום לא הושלם. אפשר לנסות שוב.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'למעבר לתשלום מאובטח' })).toBeVisible();
    expect(new URL(page.url()).hash).not.toContain('order=');
    // a new attempt opens a new order
    st.failPayment = false;
    await page.getByLabel('אני מעל גיל 18, ואני ההורה או האפוטרופוס של הילד/ה').check();
    await page.getByLabel('קראתי את התקנון ואת מדיניות הביטול').check();
    await page.getByRole('button', { name: 'למעבר לתשלום מאובטח' }).click();
    await page.waitForURL(`${PAY}/**`);
    const keys = log.filter((r) => r.path === '/api/billing/checkout').map((r) => r.headers['idempotency-key']);
    expect(new Set(keys).size).toBe(2);
  });

  test('a class licence bought by card shows on the parents page with its receipts, and can be cancelled with a refund', async ({ page }) => {
    const lic = {
      classCode: 'K7Q2MD', status: 'active', until: '2027-11-05T10:00:00Z',
      plan: { id: 'c1a0000000000001', kind: 'class', plan: 'class_year', status: 'active', priceAgorot: 58800, periodEnd: '2027-11-05T10:00:00Z', accessUntil: '2027-11-05T10:00:00Z', seats: 12, classCode: 'K7Q2MD', canRefundNow: true, canProrata: false, prorataAgorot: null },
    };
    const { st, log } = await fakeServer(page, { classes: [lic], classPayments: [{ id: 'p000000000000009', subscriptionId: 'c1a0000000000001', planKind: 'class', at: '2026-11-05T09:00:00Z', amountAgorot: 58800, kind: 'charge', hasInvoice: true }] }, baseOf());
    st.sessions.add(TOKEN(7));
    await open(page, '#/parents', teacher(), { local: { 'madregot-parent': JSON.stringify({ token: TOKEN(7), email: 'teacher@example.test' }) } });
    // (a session in localStorage on a device with a profile is not used: this device signs in again)
    await signIn(page);
    const card = page.locator('section', { has: page.getByRole('heading', { name: /רישיון הכיתה K7Q2MD פעיל עד 05\.11\.2027/ }) });
    await expect(card).toBeVisible();
    await expect(card.getByText('12 מקומות')).toBeVisible();
    await card.getByRole('button', { name: 'קבלות וחשבוניות' }).click();
    await expect(card.getByText('05.11.2026 · ₪588 · חיוב')).toBeVisible();
    await card.getByRole('button', { name: 'ביטול הרישיון' }).click();
    const sheet = page.getByRole('dialog', { name: 'לבטל את רישיון הכיתה?' });
    await expect(sheet.getByRole('radio', { name: /החזר מלא של ₪588/ })).toBeVisible();
    await sheet.getByRole('button', { name: 'כן, לבטל' }).click();
    await expect(page.getByText('ביטלתם את רישיון הכיתה. שלחנו אישור למייל. מספר אישור: C-1B00.')).toBeVisible();
    expect(log.find((r) => r.path === '/api/billing/cancel').body).toEqual({ subscriptionId: 'c1a0000000000001', mode: 'refund_now' });
    await expect(page.getByRole('heading', { name: /רישיון הכיתה K7Q2MD/ })).toHaveCount(0);
  });

  test('the licence card: an ending licence offers only the renewal quote; a trial takes a school licence code', async ({ page }) => {
    const { st } = await fakeServer(page, {}, baseOf());
    st.licence = { ...st.licence, status: 'ending', until: '2026-11-20T10:00:00Z', seats: 30 };
    await open(page, '#/teacher', teacher());
    const card = page.locator('#t-licence');
    await expect(card.getByRole('heading', { name: 'הרישיון מסתיים ב־20.11.2026' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'לחידוש: הצעת מחיר' })).toBeVisible();
    for (const name of ['ניסיון של שבועיים לכיתה', 'רכישה בכרטיס אשראי', 'יש לי קוד רישיון מבית הספר']) await expect(card.getByRole('button', { name })).toHaveCount(0);
    st.licence = { ...st.licence, status: 'trial', until: '2026-11-19T10:00:00Z', seats: 30 };
    await page.reload();
    await expect(card.getByRole('heading', { name: 'ניסיון פעיל עד 19.11.2026' })).toBeVisible();
    await card.getByRole('button', { name: 'יש לי קוד רישיון מבית הספר' }).click();
    await card.getByLabel('קוד רישיון מבית הספר').fill('abcdefghjk23');
    await card.getByRole('button', { name: 'הפעלה' }).click();
    await expect(card.getByRole('heading', { name: 'רישיון כיתה פעיל עד 31.08.2027' })).toBeVisible();
  });

  test('with the switch off, the front page offers no parents\' or cancel link (there is nothing to join or cancel)', async ({ page }) => {
    await fakeServer(page, { paywall: false }, baseOf());
    await open(page, '#/', parentPhone());
    const nav = page.getByRole('navigation', { name: 'מידע משפטי' });
    await expect(nav.getByRole('link', { name: 'תקנון' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ביטול מנוי' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'להורים' })).toHaveCount(0);
  });
});
