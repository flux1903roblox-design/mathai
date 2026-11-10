// Mocked tutor and parent states for the staging copy, which has no server (VITE_QA_HOOKS=1, or the debug flag on a
// test device). A link with ?qa-ai=<state> or ?qa-parent=<state> (in the address or after the #) renders that state
// with no request at all, so every state can be screenshotted. The choice is kept for the visit (sessionStorage).
//   qa-ai:      free2 | free1 | free0 | family | class | shared | paused | economy | ended
//   qa-parent:  signed-out | code | plans | confirming | active | refund-window | canceled | past_due | economy | nosrv
import { qaOn } from './qa.js';

const AI_STATES = ['free2', 'free1', 'free0', 'family', 'class', 'shared', 'paused', 'economy', 'ended'];
const PARENT_STATES = ['signed-out', 'code', 'plans', 'confirming', 'active', 'refund-window', 'canceled', 'past_due', 'economy', 'nosrv'];

function param(name, allowed) {
  if (typeof window === 'undefined' || !qaOn()) return null;
  let v = null;
  try {
    const hashQuery = window.location.hash.split('?')[1] || '';
    v = new URLSearchParams(window.location.search).get(name) || new URLSearchParams(hashQuery).get(name);
    if (v && allowed.includes(v)) sessionStorage.setItem(`madregot-${name}`, v);
    else v = sessionStorage.getItem(`madregot-${name}`);
  } catch { /* storage blocked */ }
  return v && allowed.includes(v) ? v : null;
}

export const qaAI = () => param('qa-ai', AI_STATES);
/**
 * ?qa-throw=render (DURABLE-9): the profile throws while it renders, so the error report, the error screen and
 * "מידע לתמיכה" can be tested. Read from the address only (never kept for the visit), and only where the hooks are on.
 */
export function qaThrow() {
  if (typeof window === 'undefined' || !qaOn()) return null;
  const hashQuery = window.location.hash.split('?')[1] || '';
  const v = new URLSearchParams(window.location.search).get('qa-throw') || new URLSearchParams(hashQuery).get('qa-throw');
  return v === 'render' ? v : null;
}
export const qaParent = () => param('qa-parent', PARENT_STATES);
export const qaActive = () => !!qaAI();

// the next midnight, as the server sends it (a day ahead is close enough for screenshots)
const dayEnd = () => new Date(Date.now() + 864e5).toISOString();
const groups = (tutor, rest = null) => ({ tutor, check: rest, generate: rest, exam: rest });

/** The status the server would send in each state. */
export function qaStatus() {
  const s = qaAI();
  if (!s) return null;
  const free = (left) => ({ paywall: true, tier: 'free', kinds: ['explain', 'chat'], groups: groups({ left, limit: 2 }), economy: false, shared: null, resetsAt: dayEnd(), linked: null, legacyUntil: null, aiReady: true });
  const all = ['explain', 'chat', 'generate', 'check', 'exam'];
  const S = {
    free2: free(2), free1: free(1), free0: free(0),
    family: { ...free(0), tier: 'family', kinds: all, groups: { tutor: { left: 27, limit: 30 }, check: { left: 6, limit: 6 }, generate: { left: 5, limit: 5 }, exam: { left: 2, limit: 2, monthLeft: 9 } }, linked: { label: 'הטאבלט' } },
    class: { ...free(0), tier: 'class', kinds: all, groups: { tutor: { left: 18, limit: 20 }, check: { left: 3, limit: 3 }, generate: { left: 3, limit: 3 }, exam: { left: 1, limit: 1 } } },
    shared: { ...free(2), shared: 'network' },
    paused: { ...free(2), shared: 'paused' },
    economy: { ...free(0), tier: 'family', kinds: ['explain', 'chat'], economy: true, groups: groups({ left: 20, limit: 30 }), linked: { label: 'הטאבלט' } },
    ended: free(2),
  };
  return { status: S[s], ended: s === 'ended' };
}

/** A tutor answer in QA mode: a short canned reply, or the refusal the state implies. */
export function qaReply(kind) {
  const s = qaAI();
  const fail = (error, extra = {}) => Object.assign(new Error(error), { qa: { error, ...extra } });
  if (s === 'free0') throw fail('daily_limit', { tier: 'free', group: 'tutor', limit: 2, left: 0 });
  if (s === 'paused') throw fail('free_paused');
  if (s === 'shared') throw fail('shared_limit', { scope: 'network' });
  if (['free1', 'free2', 'ended'].includes(s) && !['explain', 'chat'].includes(kind)) throw fail('paid_only', { kind });
  if (s === 'economy' && !['explain', 'chat'].includes(kind)) throw fail('monthly_fair_use');
  return { text: 'זו תשובה לדוגמה של העוזר החכם במצב בדיקה. בגרסה הזו אין שרת, אז שום שאלה לא נשלחה.' };
}

// ---------------------------------------------------------------- the parents page
const PLANS = {
  paywall: true, online: true, vatMode: 'included', vatRate: 0.18, currency: 'ILS', termsVersion: '2026-11', checkoutHosts: [],
  plans: [
    { id: 'family_month', kind: 'family', interval: 'month', amountAgorot: 2990, vatAgorot: 456, renews: true },
    { id: 'family_year', kind: 'family', interval: 'year', amountAgorot: 24900, vatAgorot: 3798, renews: true },
    { id: 'class_year', kind: 'class', interval: 'year', seatAgorot: 4900, minSeats: 10, maxSeats: 45, renews: false },
  ],
  limits: { family: { tutor: 30, check: 6, generate: 5, exam: 2, examMonthly: 10, devices: 3 }, class: { tutor: 20, check: 3, generate: 3, exam: 1 }, free: { tutor: 2 } },
  business: { name: 'שם העסק (לדוגמה)', id: '000000000', address: 'רחוב לדוגמה 1, עיר', email: 'hello@example.test', phone: '03-0000000' },
  contact: 'hello@example.test',
};
const plan = (over = {}) => ({
  id: 'qa00000000000001', plan: 'family_month', status: 'active', priceAgorot: 2990, periodEnd: '2026-12-10T10:00:00Z',
  cancelAtPeriodEnd: false, cancelRequestedAt: null, refundUntil: '2026-11-03T10:00:00Z', canRefundNow: false, canProrata: false,
  prorataAgorot: null, canResume: false, portal: true, economy: false, ...over,
});
const account = (p) => ({
  email: 'parent@example.test', billingHold: false, maxDevices: 3, plan: p,
  devices: p ? [{ id: 'qa00000000000002', label: 'הטאבלט', linkedAt: '2026-11-02T16:00:00Z', lastSeen: '2026-11-10' }] : [],
  usageWeek: { tutor: 23, check: 2, generate: 0, exam: 1 },
  payments: p ? [{ id: 'qa00000000000003', at: '2026-11-10T10:00:00Z', amountAgorot: 2990, kind: 'charge', hasInvoice: true }] : [],
  classes: [],
});

/** The parents page in a QA state: { view, plans, account, step }. null when no QA state is chosen. */
export function qaParentView() {
  const s = qaParent();
  if (!s) return null;
  const base = { state: s, plans: PLANS, session: { token: 'qa', email: 'parent@example.test' } };
  switch (s) {
    case 'nosrv': return { ...base, nosrv: true };
    case 'signed-out': return { ...base, session: null };
    case 'code': return { ...base, session: null, step: 'code' };
    case 'plans': return { ...base, account: account(null) };
    case 'confirming': return { ...base, account: account(null), confirming: true };
    case 'active': return { ...base, account: account(plan()) };
    case 'refund-window': return { ...base, account: account(plan({ canRefundNow: true, refundUntil: '2026-11-20T10:00:00Z' })) };
    case 'canceled': return { ...base, account: account(plan({ status: 'canceled', cancelAtPeriodEnd: true, cancelRequestedAt: '2026-11-10T09:00:00Z', canResume: true })) };
    case 'past_due': return { ...base, account: account(plan({ status: 'past_due' })) };
    case 'economy': return { ...base, account: account(plan({ economy: true })) };
    default: return null;
  }
}
