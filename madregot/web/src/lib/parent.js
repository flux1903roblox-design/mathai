// The parent's side: sign-in by an emailed code, the plan, checkout through the payment company's page, cancelling,
// the linked devices and the account. The session (X-Account-Token) is kept apart from the child's store:
// - on a device with a student profile it lives in sessionStorage, so it is gone when the tab closes;
// - on a device with no profile (the parent's own phone) or a teacher's profile it lives in localStorage under
//   '<STORE_KEY>-parent': a teacher's classes open with it on any device (lib/teacher.js), so it must outlast the tab;
// - a session signed in as "shared computer" ({shared: true}) always lives in sessionStorage.
// Parent calls never carry the student's class token, and a child's AI calls never carry this session (only a
// teacher's, with the class code).
import { create } from 'zustand';
import { useApp, STORE_KEY } from './store.js';
import { api, ApiError } from './api.js';
import { deviceId, randomHex, refreshStatus } from './account.js';

const KEY = `${STORE_KEY}-parent`;
const store = (kind) => { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; } };
const read = (s) => { try { const v = JSON.parse(s?.getItem(KEY) || 'null'); return v?.token ? v : null; } catch { return null; } };
const drop = (kind, key) => { try { store(kind)?.removeItem(key); } catch { /* blocked */ } };

/** Tell the server to end a session (best effort: it is forgotten here either way). */
function revoke(token) {
  if (!token) return;
  api('/api/account/signout', { method: 'POST', body: {}, auth: false, headers: { 'X-Account-Token': token } }).catch(() => {});
}

const isTeacher = (profile) => profile?.role === 'teacher';
/**
 * The session saved on this device. One kept in localStorage belongs to a device with no profile (the parent's own
 * phone) or to a teacher's device; once a student profile exists here, it is a child's device, so that session is
 * ended (on the server too) instead of being kept where a child could open the parents' page with it.
 */
function loadSession() {
  if (typeof window === 'undefined') return null;
  const inTab = read(store('session'));
  if (inTab) return inTab;
  const kept = read(store('local'));
  const profile = useApp.getState().profile;
  if (kept && profile && !isTeacher(profile)) { drop('local', KEY); revoke(kept.token); return null; }
  return kept;
}
/** localStorage on the parent's own phone (no profile) and on a teacher's device, unless signed in as a shared computer. */
function saveSession(session) {
  const profile = useApp.getState().profile;
  for (const kind of ['session', 'local']) drop(kind, KEY);
  if (!session) return;
  const keep = !session.shared && (!profile || isTeacher(profile));
  try { store(keep ? 'local' : 'session')?.setItem(KEY, JSON.stringify(session)); } catch { /* the session lasts for this page only */ }
}

/** The signed-in parent (or teacher) on this page: { token, email } or null. */
export const useParent = create(() => ({ session: loadSession() }));
const setSession = (session) => { saveSession(session); useParent.setState({ session }); };
export const clearSession = () => setSession(null);

// A profile created on this device after a parent signed in here (a family tablet: the parent joined first, then the
// child made a profile): the parent's session must not stay behind for the child. A teacher who signed in and then
// opened the board keeps the session: it is what opens the classes.
useApp.subscribe((st, prev) => {
  if (!st.profile || prev.profile || isTeacher(st.profile)) return;
  const kept = read(store('local'));
  if (!kept) return;
  drop('local', KEY);
  revoke(kept.token);
  if (useParent.getState().session?.token === kept.token) useParent.setState({ session: null });
});

const auth = () => {
  const t = useParent.getState().session?.token;
  if (!t) throw new ApiError('not_account', 401);
  return { 'X-Account-Token': t };
};
/** A call as the signed-in account (a parent's or a teacher's). A session the server no longer knows signs out here too. */
export async function accountCall(path, opts = {}) {
  try {
    return await api(path, { ...opts, auth: false, headers: { ...auth(), ...(opts.headers || {}) } });
  } catch (e) {
    if (e.status === 401 && e.code === 'not_account') clearSession();
    throw e;
  }
}

// ---------------------------------------------------------------- sign-in
export const requestCode = (email) => api('/api/account/code', { method: 'POST', body: { email }, auth: false });
/**
 * The code from the email. A step-up (a new code while signed in) replaces this page's session and keeps its "shared
 * computer" choice. shared: this sign-in is on a shared computer (kept for this tab only).
 */
export async function verifyCode(email, code, { shared = false } = {}) {
  const prev = useParent.getState().session;
  const t = prev?.token;
  const r = await api('/api/account/verify', { method: 'POST', body: { email, code }, auth: false, headers: t ? { 'X-Account-Token': t } : {} });
  setSession({ token: r.token, email: r.email, shared: !!shared || !!(t && prev.shared) });
  return r;
}
export async function signOut({ all = false } = {}) {
  try { await accountCall('/api/account/signout', { method: 'POST', body: all ? { all: true } : {} }); } catch { /* signed out here either way */ }
  clearSession();
}

/**
 * "Delete all data" (and signing out of the device) on this device: the parent's session is ended on the server, and
 * everything the parents' pages kept here goes, in both storages: the session, a waiting link code, an order being
 * paid, "continue on this device", and the checkout attempt keys.
 */
export async function forgetParentHere() {
  const token = useParent.getState().session?.token || read(store('session'))?.token || read(store('local'))?.token;
  if (token) {
    try { await api('/api/account/signout', { method: 'POST', body: {}, auth: false, headers: { 'X-Account-Token': token } }); } catch { /* forgotten here either way */ }
  }
  const fixed = [KEY, `${STORE_KEY}-link-code`, `${STORE_KEY}-order`, `${STORE_KEY}-here`];
  for (const kind of ['session', 'local']) {
    const s = store(kind);
    if (!s) continue;
    let keys = [];
    try { keys = Array.from({ length: s.length }, (_, i) => s.key(i)).filter(Boolean); } catch { /* blocked */ }
    for (const k of new Set([...fixed, ...keys.filter((k) => k.startsWith(`${STORE_KEY}-checkout-`))])) drop(kind, k);
  }
  useParent.setState({ session: null });
}

// ---------------------------------------------------------------- the account and the plans
export const overview = () => accountCall('/api/account');
let plansCache = null;
/** The public plans, prices and business details. Kept for the visit. */
export async function plans({ fresh = false } = {}) {
  if (!plansCache || fresh) plansCache = api('/api/billing/plans', { auth: false }).catch((e) => { plansCache = null; throw e; });
  return plansCache;
}

// One Idempotency-Key per checkout attempt, kept for this tab: pressing again (or after a network error) returns the
// same order and the same payment page.
const idemKey = (plan) => `${STORE_KEY}-checkout-${plan}`;
function attemptKey(plan) {
  const s = store('session');
  let k = null;
  try { k = s?.getItem(idemKey(plan)); } catch { /* blocked */ }
  if (!k || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) { k = randomHex(16); try { s?.setItem(idemKey(plan), k); } catch { /* blocked */ } }
  return k;
}
export const endAttempt = (plan) => { try { store('session')?.removeItem(idemKey(plan)); } catch { /* blocked */ } };

/**
 * Checkout: an order priced on the server, then the payment company's page. It navigates only to a host the server
 * lists for its provider. classHeaders: the teacher's class (class_year).
 */
export async function startCheckout(plan, { seats, classHeaders, terms, navigate = (url) => window.location.assign(url) } = {}) {
  const p = await plans();
  const order = () => accountCall('/api/billing/checkout', {
    method: 'POST', body: { plan, adult: true, terms: terms || p.termsVersion, ...(seats ? { seats } : {}) },
    headers: { 'Idempotency-Key': attemptKey(plan), ...(classHeaders || {}) },
  });
  let r;
  try { r = await order(); } catch (e) {
    // the last attempt's order was paid or has expired: this is a new attempt, with a new key
    if (e.code !== 'order_closed') throw e;
    endAttempt(plan);
    r = await order();
  }
  let host = '';
  try { host = new URL(r.url).host.toLowerCase(); } catch { /* not a url */ }
  if (!host || !(p.checkoutHosts || []).includes(host)) throw new ApiError('bad_checkout_url', 502);
  try { store('session')?.setItem(`${STORE_KEY}-order`, r.orderId); } catch { /* blocked */ }
  navigate(r.url);
  return r;
}
export const pollOrder = (id) => accountCall(`/api/billing/orders/${encodeURIComponent(id)}`);
export const cancelPlan = (subscriptionId, mode = 'period_end') => accountCall('/api/billing/cancel', { method: 'POST', body: { subscriptionId, mode } });
export const resumePlan = (subscriptionId) => accountCall('/api/billing/resume', { method: 'POST', body: { subscriptionId } });
export async function portal() { const r = await accountCall('/api/billing/portal'); window.location.assign(r.url); return r; }
/** A payment's tax invoice or receipt at the payment company (its address is asked with the session header). */
export async function openInvoice(paymentId) {
  const r = await accountCall(`/api/billing/payments/${encodeURIComponent(paymentId)}/invoice`, { headers: { Accept: 'application/json' } });
  if (!/^https:\/\//.test(r.url || '')) throw new ApiError('not_found', 404);
  const w = window.open(r.url, '_blank');
  if (w) w.opener = null; else window.location.assign(r.url); // a blocked new tab: open it here instead
  return r;
}

// ---------------------------------------------------------------- the child's devices
/**
 * Claim the code a child's device shows. `extra` is { purpose: 'consent', consent: true } for the parent's free OK for
 * the tutor (trust spec TRUST-9); with nothing, the server links for the plan when the account has one.
 */
export const claimLink = (code, label, extra = {}) => accountCall('/api/family/link/claim', { method: 'POST', body: { code: String(code || '').toUpperCase().trim(), ...(label ? { label } : {}), ...extra } });
export const unlinkDevice = (id) => accountCall(`/api/family/devices/${encodeURIComponent(id)}/unlink`, { method: 'POST', body: {} });
/**
 * The parent holds the child's device: link it straight away. The server deletes the session that asked, and this page
 * forgets it too, so nobody can change the plan from the child's device afterwards.
 */
export async function linkThisDevice(label, extra = {}) {
  const r = await accountCall('/api/family/devices/this', { method: 'POST', body: { ...(label ? { label } : {}), ...extra }, headers: { 'X-Device': deviceId() } });
  useApp.getState().setAI({ familyDevice: { token: r.deviceToken, label: r.label || '' }, pendingLink: null });
  clearSession();
  refreshStatus();
  return r;
}

// ---------------------------------------------------------------- the data
/** Everything kept about the account, as a file the parent saves. */
export async function exportData() {
  const data = await accountCall('/api/account/export');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `madregot-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return data;
}
/** Deleting needs a code from the last 10 minutes: a 401 reauth_needed asks the page for a fresh one. */
export async function deleteAccount() {
  await accountCall('/api/account/delete', { method: 'POST', body: { confirm: 'DELETE' } });
  clearSession();
}

/** A code waiting to be claimed after sign-in and payment (from the QR code), kept across the payment redirect. */
const CODE_KEY = `${STORE_KEY}-link-code`;
export const keepLinkCode = (code) => { try { store('session')?.setItem(CODE_KEY, String(code).toUpperCase()); } catch { /* blocked */ } };
export const keptLinkCode = () => { try { return store('session')?.getItem(CODE_KEY) || null; } catch { return null; } };
export const dropLinkCode = () => { try { store('session')?.removeItem(CODE_KEY); } catch { /* blocked */ } };
export const keptOrder = () => { try { return store('session')?.getItem(`${STORE_KEY}-order`) || null; } catch { return null; } };
export const dropOrder = () => { try { store('session')?.removeItem(`${STORE_KEY}-order`); } catch { /* blocked */ } };
