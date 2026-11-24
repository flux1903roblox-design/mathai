// The QA states' views that only lazy code reads (lib/qaFixtures.js keeps what the first load needs): the tutor's canned
// answers (lib/ai.js) and the parents page in each qa-parent state (screens/parents/Parents.jsx). Moved out of the first
// load to pay for the evening plan's growth (EXAM-MATERIAL review); pinned in budget.json lazyOnly.
import { FREE_KINDS } from '@shared/aiKinds.js';
import { qaAI, qaParent } from './qaFixtures.js';

const QA_TEXT = 'זו תשובה לדוגמה של העוזר החכם במצב בדיקה. בגרסה הזו אין שרת, אז שום שאלה לא נשלחה.';

/**
 * A tutor answer in QA mode: a short canned reply, or the refusal the state implies. New exercises echo the app's own
 * seeds in their own wording (kept), so the screen shows its list, its checks and its grading with no server (AI-4).
 */
export function qaReply(kind, input = {}) {
  const s = qaAI();
  const fail = (error, extra = {}) => Object.assign(new Error(error), { qa: { error, ...extra } });
  if (s === 'free0') throw fail('daily_limit', { tier: 'free', group: 'tutor', limit: 2, left: 0 });
  if (s === 'paused') throw fail('free_paused');
  if (s === 'shared') throw fail('shared_limit', { scope: 'network' });
  if (['free1', 'free2', 'ended'].includes(s) && !FREE_KINDS.includes(kind)) throw fail('paid_only', { kind });
  if (s === 'economy' && !FREE_KINDS.includes(kind)) throw fail('monthly_fair_use');
  // feedback on a written explanation (ai spec AI-10): the reply's shape, every rubric point still open, nothing invented
  if (kind === 'feedback') {
    const n = Array.isArray(input.rubric) ? input.rubric.length : 0;
    return { points: Array.from({ length: n }, (_, i) => ({ i, status: 'no', quote: '', tip: '' })), summary: QA_TEXT, care: false };
  }
  // the material of a coming test (EXAM-MATERIAL 1b): the first two stairs offered, and one piece not placed
  if (kind === 'syllabus') {
    const stairs = (Array.isArray(input.stairs) ? input.stairs : []).slice(0, 2);
    return { readable: true, stairs, unplaced: ['פרק 3'], examples: [], care: false };
  }
  if (kind === 'generate') {
    const seeds = Array.isArray(input.seeds) ? input.seeds : [];
    const items = seeds.map((sd) => ({
      seed: sd.i, prompt: sd.text, hint: '', kept: true, blind: 'skipped',
      solution: ['במצב בדיקה אין שרת, אז זה התרגיל מהמאגר בלי סיפור חדש.', `התשובה: $= ${sd.answer}$`],
    }));
    return { items, dropped: {}, fallback: false };
  }
  return { text: QA_TEXT };
}

// ---------------------------------------------------------------- the parents page
const PLANS = {
  paywall: true, online: true, report: true, vatMode: 'included', vatRate: 0.18, currency: 'ILS', termsVersion: '2026-11', checkoutHosts: [],
  plans: [
    { id: 'family_month', kind: 'family', interval: 'month', amountAgorot: 2990, vatAgorot: 456, renews: true },
    { id: 'family_year', kind: 'family', interval: 'year', amountAgorot: 24900, vatAgorot: 3798, renews: false, termMonths: 12 },
    // the exam pass (COUNCIL2-33) at wrangler.toml's placeholder price
    { id: 'exam_pass', kind: 'family', interval: 'once', amountAgorot: 3900, vatAgorot: 595, renews: false, termDays: 30 },
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
  email: 'parent@example.test', billingHold: false, maxDevices: 3, plan: p, reportEmail: false,
  devices: p ? [{ id: 'qa00000000000002', label: 'הטאבלט', linkedAt: '2026-11-02T16:00:00Z', lastSeen: '2026-11-10' }] : [],
  usageWeek: { tutor: 23, check: 2, generate: 0, exam: 1 },
  payments: p ? [{ id: 'qa00000000000003', at: '2026-11-10T10:00:00Z', amountAgorot: 2990, kind: 'charge', hasInvoice: true }] : [],
  classes: [],
});

/** The progress the QA family keeps (GET /api/family/vaults): the tablet's own, and an older phone's in the account. */
export const QA_VAULTS = [
  { id: 'qa00000000000011', label: 'הטאבלט', device: { id: 'qa00000000000002', label: 'הטאבלט' }, updatedAt: '2026-11-10T08:00:00Z' },
  { id: 'qa00000000000012', label: 'הטלפון הקודם', device: null, updatedAt: '2026-10-28T17:30:00Z' },
];

/** The parents page in a QA state: { view, plans, account, step, vaults }. null when no QA state is chosen. */
export function qaParentView() {
  const s = qaParent();
  if (!s) return null;
  const base = { state: s, plans: PLANS, session: { token: 'qa', email: 'parent@example.test' }, vaults: QA_VAULTS };
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
    // an exam pass in its 14 days (COUNCIL2-33): 30 days, no next charge, the whole price back on cancelling
    case 'pass': return { ...base, account: account(plan({ plan: 'exam_pass', priceAgorot: 3900, periodEnd: '2026-12-02T10:00:00Z', refundUntil: '2026-11-16T10:00:00Z', canRefundNow: true, canResume: false, portal: false, renews: false })) };
    // the progress report (PARENTS-5, PARENTS-6): the account's devices here, their summaries in qaFamily.js
    case 'report': {
      const a = account(plan());
      return { ...base, report: s, account: { ...a, devices: [...a.devices, { id: 'qa00000000000004', label: 'הטלפון', linkedAt: '2026-10-16T18:00:00Z', lastSeen: '2026-11-02' }] } };
    }
    case 'report-empty': case 'report-off': case 'report-old': return { ...base, report: s, account: account(plan()) };
    default: return null;
  }
}
