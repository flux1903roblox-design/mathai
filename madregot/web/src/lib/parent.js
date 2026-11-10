// The parent's side: sign-in by an emailed code, the plan, checkout through the payment company's page, cancelling,
// the linked devices and the account. The session (X-Account-Token) is kept apart from the child's store:
// - on a device with a student or teacher profile it lives in sessionStorage, so it is gone when the tab closes;
// - on a device with no profile (the parent's own phone) it lives in localStorage under '<STORE_KEY>-parent'.
// Parent calls never carry the student's class token, and AI calls never carry this session.
import { create } from 'zustand';
import { useApp, STORE_KEY } from './store.js';
import { api, ApiError } from './api.js';
import { deviceId, randomHex, refreshStatus } from './account.js';

const KEY = `${STORE_KEY}-parent`;
const store = (kind) => { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; } };
const read = (s) => { try { const v = JSON.parse(s?.getItem(KEY) || 'null'); return v?.token ? v : null; } catch { return null; } };

function loadSession() {
  if (typeof window === 'undefined') return null;
  return read(store('session')) || read(store('local'));
}
function saveSession(session) {
  const hasProfile = !!useApp.getState().profile;
  for (const kind of ['session', 'local']) { try { store(kind)?.removeItem(KEY); } catch { /* blocked */ } }
  if (!session) return;
  try { store(hasProfile ? 'session' : 'local')?.setItem(KEY, JSON.stringify(session)); } catch { /* the session lasts for this page only */ }
}

/** The signed-in parent (or teacher) on this page: { token, email } or null. */
export const useParent = create(() => ({ session: loadSession() }));
const setSession = (session) => { saveSession(session); useParent.setState({ session }); };
export const clearSession = () => setSession(null);

const auth = () => {
  const t = useParent.getState().session?.token;
  if (!t) throw new ApiError('not_account', 401);
  return { 'X-Account-Token': t };
};
/** A call as the parent. A session the server no longer knows signs out here too. */
async function call(path, opts = {}) {
  try {
    return await api(path, { ...opts, auth: false, headers: { ...auth(), ...(opts.headers || {}) } });
  } catch (e) {
    if (e.status === 401 && e.code === 'not_account') clearSession();
    throw e;
  }
}

// ---------------------------------------------------------------- sign-in
export const requestCode = (email) => api('/api/account/code', { method: 'POST', body: { email }, auth: false });
/** The code from the email. A step-up (a new code while signed in) replaces this page's session. */
export async function verifyCode(email, code) {
  const t = useParent.getState().session?.token;
  const r = await api('/api/account/verify', { method: 'POST', body: { email, code }, auth: false, headers: t ? { 'X-Account-Token': t } : {} });
  setSession({ token: r.token, email: r.email });
  return r;
}
export async function signOut({ all = false } = {}) {
  try { await call('/api/account/signout', { method: 'POST', body: all ? { all: true } : {} }); } catch { /* signed out here either way */ }
  clearSession();
}

// ---------------------------------------------------------------- the account and the plans
export const overview = () => call('/api/account');
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
  const r = await call('/api/billing/checkout', {
    method: 'POST', body: { plan, adult: true, terms: terms || p.termsVersion, ...(seats ? { seats } : {}) },
    headers: { 'Idempotency-Key': attemptKey(plan), ...(classHeaders || {}) },
  });
  let host = '';
  try { host = new URL(r.url).host.toLowerCase(); } catch { /* not a url */ }
  if (!host || !(p.checkoutHosts || []).includes(host)) throw new ApiError('bad_checkout_url', 502);
  try { store('session')?.setItem(`${STORE_KEY}-order`, r.orderId); } catch { /* blocked */ }
  navigate(r.url);
  return r;
}
export const pollOrder = (id) => call(`/api/billing/orders/${encodeURIComponent(id)}`);
export const cancelPlan = (subscriptionId, mode = 'period_end') => call('/api/billing/cancel', { method: 'POST', body: { subscriptionId, mode } });
export const resumePlan = (subscriptionId) => call('/api/billing/resume', { method: 'POST', body: { subscriptionId } });
export async function portal() { const r = await call('/api/billing/portal'); window.location.assign(r.url); return r; }
/** A payment's tax invoice or receipt at the payment company (its address is asked with the session header). */
export async function openInvoice(paymentId) {
  const r = await call(`/api/billing/payments/${encodeURIComponent(paymentId)}/invoice`, { headers: { Accept: 'application/json' } });
  if (!/^https:\/\//.test(r.url || '')) throw new ApiError('not_found', 404);
  const w = window.open(r.url, '_blank');
  if (w) w.opener = null; else window.location.assign(r.url); // a blocked new tab: open it here instead
  return r;
}

// ---------------------------------------------------------------- the child's devices
export const claimLink = (code, label) => call('/api/family/link/claim', { method: 'POST', body: { code: String(code || '').toUpperCase().trim(), ...(label ? { label } : {}) } });
export const unlinkDevice = (id) => call(`/api/family/devices/${encodeURIComponent(id)}/unlink`, { method: 'POST', body: {} });
/**
 * The parent holds the child's device: link it straight away. The server deletes the session that asked, and this page
 * forgets it too, so nobody can change the plan from the child's device afterwards.
 */
export async function linkThisDevice(label) {
  const r = await call('/api/family/devices/this', { method: 'POST', body: label ? { label } : {}, headers: { 'X-Device': deviceId() } });
  useApp.getState().setAI({ familyDevice: { token: r.deviceToken, label: r.label || '' }, pendingLink: null });
  clearSession();
  refreshStatus();
  return r;
}

// ---------------------------------------------------------------- the data
/** Everything kept about the account, as a file the parent saves. */
export async function exportData() {
  const data = await call('/api/account/export');
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
  await call('/api/account/delete', { method: 'POST', body: { confirm: 'DELETE' } });
  clearSession();
}

/** A code waiting to be claimed after sign-in and payment (from the QR code), kept across the payment redirect. */
const CODE_KEY = `${STORE_KEY}-link-code`;
export const keepLinkCode = (code) => { try { store('session')?.setItem(CODE_KEY, String(code).toUpperCase()); } catch { /* blocked */ } };
export const keptLinkCode = () => { try { return store('session')?.getItem(CODE_KEY) || null; } catch { return null; } };
export const dropLinkCode = () => { try { store('session')?.removeItem(CODE_KEY); } catch { /* blocked */ } };
export const keptOrder = () => { try { return store('session')?.getItem(`${STORE_KEY}-order`) || null; } catch { return null; } };
export const dropOrder = () => { try { store('session')?.removeItem(`${STORE_KEY}-order`); } catch { /* blocked */ } };
