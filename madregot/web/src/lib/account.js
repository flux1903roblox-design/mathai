// The paid AI tutor on this device: an anonymous device id (for the free taste), the parent's account token after
// sign-in by email code, and what the server says this device gets today. Nothing secret lives here: the Claude key
// stays on the server; the account token only identifies the signed-in parent account.
import { create } from 'zustand';
import { useApp } from './store.js';
import { api, hasServer } from './api.js';

/** A random id for this device, made once. The server counts the free questions per device. */
export function deviceId() {
  const { ai, setAI } = useApp.getState();
  if (/^[a-f0-9]{32}$/.test(ai.device || '')) return ai.device;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  setAI({ device: id });
  return id;
}

/** Headers every server call carries: the device, and the account when a parent signed in on this device. */
export function accountHeaders() {
  const { ai } = useApp.getState();
  return { 'X-Device': deviceId(), ...(ai.account?.token ? { 'X-Account-Token': ai.account.token } : {}) };
}

/** A teacher's open class (its licence is what counts for the teacher's own questions). */
export function teacherClass() {
  const p = useApp.getState().profile;
  return p?.role === 'teacher' ? p.classes?.find((c) => c.code === p.active) || null : null;
}
const statusHeaders = () => {
  const cls = teacherClass();
  return { ...accountHeaders(), ...(cls ? { 'X-Class-Code': cls.code, 'X-Teacher-Key': cls.key } : {}) };
};

// What the server said last, in the shape the screens read: { tier: 'free' | 'paid' | 'open', left, limit, used, kinds,
// plan, offer, signedIn, email, aiReady }. A server with the rebuilt tutor answers in a new shape (tiers family, class,
// teacher, trial, legacy, open; counts per group; the parent's plan only on GET /api/account), so viewOf() maps it.
export const useAIStatus = create(() => ({ status: null, loading: false, error: null }));

const PAID_TIERS = ['family', 'class', 'teacher', 'trial', 'legacy'];
const viewTier = (t) => (t === 'free' || t === 'open' ? t : PAID_TIERS.includes(t) ? 'paid' : t);
const priceText = (agorot) => `₪${(agorot / 100).toFixed(2)}`;

/** The new status shape, plus the signed-in account and the public plans, as the screens read it. */
function viewOf(s, account, plans) {
  const g = s.groups?.tutor || s.groups?.all || null;
  const fam = account?.plan || null;
  const month = plans?.plans?.find((x) => x.id === 'family_month');
  return {
    ...s, serverTier: s.tier, tier: viewTier(s.tier),
    left: g ? g.left : undefined, limit: g ? g.limit : undefined, used: g ? Math.max(0, g.limit - g.left) : 0,
    signedIn: account === undefined ? undefined : !!account,
    email: account?.email || null,
    plan: fam ? { kind: 'family', id: fam.id, status: fam.status, endsAt: fam.periodEnd, cancelAtPeriodEnd: fam.cancelAtPeriodEnd }
      : PAID_TIERS.includes(s.tier) && s.tier !== 'family' ? { kind: 'class' } : null,
    offer: {
      daily: { free: plans?.limits?.free?.tutor ?? 2, paid: plans?.limits?.family?.tutor ?? null, teacher: null },
      // online sign-up waits for the new parents page (it asks for the adult and terms confirmations)
      family: { price: month ? `${priceText(month.amountAgorot)} לחודש` : null, online: false },
      school: { contact: plans?.contact || null },
    },
  };
}

export async function refreshStatus() {
  if (!hasServer()) { useAIStatus.setState({ status: null, loading: false, error: 'no_server' }); return null; }
  useAIStatus.setState({ loading: true, error: null });
  try {
    let status = await api('/api/ai/status', { headers: statusHeaders() });
    if (status && 'groups' in status) {
      const token = useApp.getState().ai.account?.token;
      const [account, plans] = await Promise.all([
        token ? api('/api/account', { headers: { 'X-Account-Token': token } }).catch((e) => (e.status === 401 ? null : undefined)) : Promise.resolve(null),
        api('/api/billing/plans').catch(() => null),
      ]);
      status = viewOf(status, account, plans);
    }
    // the server signed this device out (a newer device took its place, or the account was deleted)
    if (status.signedIn === false && useApp.getState().ai.account) useApp.getState().setAI({ account: null });
    useAIStatus.setState({ status, loading: false });
    return status;
  } catch (e) {
    useAIStatus.setState({ loading: false, error: e.code || 'network' });
    return null;
  }
}

/**
 * May the app ask the tutor without being asked (the explanation after a second miss)? Only when that question is
 * not one of the few free ones: with a personal key, or on a subscription or class licence. On the free taste the
 * student decides when to spend a question.
 */
export function autoAskAllowed() {
  const { ai, profile } = useApp.getState();
  if (ai.mode === 'personal' && ai.key && !profile?.classCode) return true;
  const tier = useAIStatus.getState().status?.tier;
  return tier === 'paid' || tier === 'open';
}

/** Is this tutor action part of the subscription, on this device today (the free taste covers explain and chat)? */
export function needsPlan(kind) {
  const { ai, profile } = useApp.getState();
  if (ai.mode === 'personal' && ai.key && !profile?.classCode) return false;
  const st = useAIStatus.getState().status;
  return st?.tier === 'free' && Array.isArray(st.kinds) && !st.kinds.includes(kind);
}
/** Before a paid action: on the free taste, explain it (the sheet) instead of sending a photo the server will refuse. */
export function gate(kind) {
  if (!needsPlan(kind)) return false;
  openPaywall('paid_only');
  return true;
}

/** The server's count after an AI answer (sent in the X-AI-Tier / X-AI-Left headers). */
export function noteUsage(res) {
  const tier = res.headers.get('X-AI-Tier'); const left = res.headers.get('X-AI-Left'); const group = res.headers.get('X-AI-Group');
  if (!tier) return;
  const prev = useAIStatus.getState().status;
  // the count shown is the tutor's (explain and chat); a photo check or new exercises count in their own group
  const counts = !group || group === 'tutor' || group === 'all';
  useAIStatus.setState({ status: { ...(prev || {}), tier: viewTier(tier), ...(counts ? { left: Number(left) } : {}) } });
}

export async function sendCode(email) {
  return api('/api/account/code', { method: 'POST', body: { email }, headers: accountHeaders() });
}
export async function verifyCode(email, code) {
  const r = await api('/api/account/verify', { method: 'POST', body: { email, code }, headers: accountHeaders() });
  useApp.getState().setAI({ account: { token: r.token, email: r.email } });
  await refreshStatus();
  return r;
}
export async function signOutAccount() {
  try { await api('/api/account/signout', { method: 'POST', headers: accountHeaders() }); } catch { /* signed out here either way */ }
  useApp.getState().setAI({ account: null });
  await refreshStatus();
}
export async function deleteAccount() {
  await api('/api/account/delete', { method: 'POST', body: { confirm: 'DELETE' }, headers: accountHeaders() });
  useApp.getState().setAI({ account: null });
  await refreshStatus();
}
export async function startCheckout() {
  const { url } = await api('/api/billing/checkout', { method: 'POST', body: { plan: 'family' }, headers: accountHeaders() });
  return url;
}
export async function cancelPlan() {
  const plan = useAIStatus.getState().status?.plan;
  const r = await api('/api/billing/cancel', { method: 'POST', body: { subscriptionId: plan?.id, mode: 'period_end' }, headers: accountHeaders() });
  await refreshStatus();
  return r;
}

// The sheet that explains the limit (mounted once in the app): opened when an AI call says the free questions of
// today are used, or the action needs a subscription.
export const usePaywall = create(() => ({ open: false, reason: null }));
export const openPaywall = (reason) => usePaywall.setState({ open: true, reason });
export const closePaywall = () => usePaywall.setState({ open: false });
