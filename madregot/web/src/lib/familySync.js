// The parents' daily summary, sent from a linked child device (PARENTS-4; the Worker's side is PARENTS-3,
// worker/src/report.js). One small row per day: codes and counts only (learn/report.ts DaySummary), never an answer,
// a chat, a photo or a name. It sends only when all of these hold:
//   - the app has a server (hasServer());
//   - this device is linked to a family plan (ai.familyDevice.token);
//   - the server says the summary is on (GET /api/ai/status linked.summary === 'on': the plan is live and neither the
//     child nor the parent switched it off);
//   - the child has seen the notice and pressed "הבנתי" (ai.familyDevice.sharingSeen). Nothing leaves before that, and a
//     new profile on the device (signOut) or a new link (account.js newFamilyDevice) sees the notice again.
// When: at the app's sync moments (durable/moments.js): boot, lesson, tick and hidden, at most once in 10 minutes and
// only when a row changed since the last send. On hidden it goes first (MOMENT_ORDER.family, before the class outbox and
// the vault) and with keepalive, only when the server is this page's own address (production; across addresses the
// X-Family-Device header needs a CORS preflight, which keepalive does not get everywhere) and the bytes fit the hidden
// moment's budget. Also right after "הבנתי" and after the child turns sharing back on.
// What: the days from the last day sent (or 7 days back, whichever is later) to today that had activity, and today
// itself: at most 8. A later send replaces a day's row on the server, so the last day sent goes again with its final numbers.
// Answers: 200 → lastSent { at, days } (the exact rows, which the sharing sheet shows in words). 401 not_linked → the
// token is forgotten. 402, 403, 429 and 503 → nothing more until the next status read (useAIStatus.refreshed), and the
// state the server gave is shown. A failed send changes nothing here: the next moment tries again.
// Headers: X-Family-Device only. Never the parent's X-Account-Token, and never the class token (auth: false).
import { useEffect } from 'react';
import { useApp, today as dayOf } from './store.js';
import { api, hasServer, sameOrigin } from './api.js';
import { useAIStatus, refreshStatus } from './account.js';
import { qaActive } from './qaFixtures.js';
import { onMoment, MOMENT_ORDER, keepaliveBudget, bodyBytes } from './durable/moments.js';

export const FAMILY_MOMENTS = ['boot', 'lesson', 'hidden', 'tick'];
/** At most one send in this long (the hidden moment is the exception, when something changed). */
export const SEND_EVERY = 10 * 60_000;
/** How far back a send reaches (the Worker takes days up to 8 back), and how many days one send holds. */
export const BACK_DAYS = 7;
export const MAX_DAYS = 8;
/** The server says "not now" with these: wait for the next status read. */
const STOP = [402, 403, 429, 503];
/** What each refusal means for the state shown to the child, when the answer does not say. */
const STOP_STATE = { 402: 'no_plan', 503: 'off' };

// The report engine is not part of the first download: it loads when this device is linked (preloadEngine), so the
// hidden moment can build its rows, and claim its keepalive bytes, before anything else awaits.
let engine = null;
export function loadEngine() {
  return engine ? Promise.resolve(engine) : import('@/learn/report.ts').then((m) => { engine = m; return m; });
}

const DAY_MS = 864e5;
/** 'YYYY-MM-DD' plus n days, on the date itself. */
const shift = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10); };
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Did anything happen that day (time, an answer, a lesson, a stage, a review, a stair, a repair)? */
export const hasActivity = (s) => s.m > 0 || s.q > 0 || s.ls > 0 || s.st > 0 || s.rv > 0 || s.sk.length > 0 || s.ma.length > 0 || s.fx.some((f) => f[2] === 'd');

/** The newest day in what was sent last, or null. */
export const lastSentDay = (fd) => (fd?.lastSent?.days || []).map((r) => r?.d).filter(isDay).sort().at(-1) || null;

/**
 * The rows to send: from the last day sent (or 7 days back, whichever is later) to `day`, the days with activity and
 * `day` itself, at most 8. `summary` is the engine's daySummary.
 */
export function rowsToSend(state, { day = dayOf(), now = new Date(), summary }) {
  const floor = shift(day, -BACK_DAYS);
  const sent = lastSentDay(state.ai?.familyDevice);
  let from = sent && sent > floor ? sent : floor;
  if (from > day) from = day; // the clock went back: today still goes
  const input = { days: state.days || {}, learn: state.learn };
  const ctx = { today: day, now: now.toISOString() };
  const rows = [];
  for (let d = from; d <= day; d = shift(d, 1)) {
    const s = summary(input, d, ctx);
    if (d === day || hasActivity(s)) rows.push(s);
  }
  return rows.slice(-MAX_DAYS);
}

/** May this device send the summary now (every condition at the top of this file)? */
export function sharingReady(state = useApp.getState(), status = useAIStatus.getState().status) {
  const fd = state.ai?.familyDevice;
  return hasServer() && !!fd?.token && status?.linked?.summary === 'on' && !!fd.sharingSeen;
}

/** The summary's state as the server reported it last: 'on' | 'child_off' | 'parent_off' | 'both_off' | 'no_plan' | 'off' | null. */
export const summaryOf = (status = useAIStatus.getState().status) => status?.linked?.summary ?? null;

/** The state the child sees changes at once (the server's own answer), without a new status read. */
function showState(summary) {
  const status = useAIStatus.getState().status;
  if (!status?.linked || !summary) return;
  useAIStatus.setState({ status: { ...status, linked: { ...status.linked, summary } } });
}

let running = null;
let lastTry = 0; // the last attempt in this visit (sent or failed), for the 10 minutes
let stoppedAt = null; // the status read the server said "not now" at

/** For tests: forget this visit's attempts. */
export function resetFamilySync() { running = null; lastTry = 0; stoppedAt = null; }

async function run(moment, store, now) {
  const st = store.getState();
  const fd = st.ai?.familyDevice;
  if (!sharingReady(st)) return fd?.token && !fd.sharingSeen ? 'not_seen' : 'off';
  const { refreshed } = useAIStatus.getState();
  if (stoppedAt !== null && stoppedAt === refreshed) return 'stopped';
  stoppedAt = null;
  // from here to the claim nothing awaits when the engine is loaded, so the hidden moment's order holds
  const eng = engine || await loadEngine();
  const at = now();
  const rows = rowsToSend(st, { day: dayOf(at), now: at, summary: eng.daySummary });
  if (fd.lastSent && JSON.stringify(rows) === JSON.stringify(fd.lastSent.days)) return 'unchanged';
  const force = moment === 'seen' || moment === 'switch';
  const last = Math.max(lastTry, Date.parse(fd.lastSent?.at) || 0);
  if (!force && moment !== 'hidden' && at.getTime() - last < SEND_EVERY) return 'throttled';
  const body = { days: rows };
  const keepalive = moment === 'hidden' && sameOrigin() && keepaliveBudget.claim(bodyBytes(body));
  lastTry = at.getTime();
  try {
    await api('/api/family/summary', { method: 'POST', body, keepalive, auth: false, headers: { 'X-Family-Device': fd.token } });
  } catch (e) {
    if (e?.status === 401) {
      // unlinked, or the parent left: the token is forgotten, as the tutor's X-AI-Linked: 0 does
      if (e.code === 'not_linked' && store.getState().ai.familyDevice?.token === fd.token) store.getState().setAI({ familyDevice: null });
      return 'unlinked';
    }
    if (STOP.includes(e?.status)) {
      stoppedAt = useAIStatus.getState().refreshed;
      showState(e.data?.sharing || STOP_STATE[e.status]);
      return 'stopped';
    }
    return e?.code === 'network' ? 'offline' : 'error';
  }
  // the device may have been unlinked or signed out meanwhile: only the same link records what it sent
  const cur = store.getState().ai.familyDevice;
  if (cur?.token === fd.token) store.getState().setAI({ familyDevice: { ...cur, lastSent: { at: at.toISOString(), days: rows } } });
  return 'sent';
}

/**
 * Send the summary if it may and should go now. `moment`: the sync moment ('boot' | 'lesson' | 'hidden' | 'tick'), or
 * 'seen' (the child just pressed "הבנתי") and 'switch' (sharing turned back on), which do not wait for the 10 minutes.
 * One at a time. Resolves with what happened: 'off' | 'not_seen' | 'stopped' | 'unchanged' | 'throttled' | 'sent' |
 * 'unlinked' | 'offline' | 'error'. `store` and `now` are for tests.
 */
export function syncFamily({ moment = 'manual', store = useApp, now = () => new Date() } = {}) {
  if (running) return running;
  running = run(moment, store, now).finally(() => { running = null; });
  return running;
}

/** The child pressed "הבנתי" on the notice: from now on the summary may go, and it goes now. */
export function markSharingSeen({ store = useApp, now = () => new Date() } = {}) {
  const fd = store.getState().ai.familyDevice;
  if (!fd?.token) return Promise.resolve('off');
  store.getState().setAI({ familyDevice: { ...fd, sharingSeen: now().toISOString() } });
  return syncFamily({ moment: 'seen', store, now });
}

/**
 * The child's own switch (POST /api/family/summary/sharing {on, forget}). Off with `forget` also deletes what was sent
 * (on the server, and the record of it here). Resolves with the new state. On the staging copy (qa-ai=family) nothing
 * is sent and the state just changes.
 */
export async function setChildSharing(on, { forget = false, store = useApp } = {}) {
  const fd = store.getState().ai.familyDevice;
  if (!fd?.token) return null;
  let sharing;
  if (qaActive() && !hasServer()) {
    const was = summaryOf();
    sharing = on ? (was === 'both_off' ? 'parent_off' : 'on') : (was === 'parent_off' ? 'both_off' : 'child_off');
  } else {
    sharing = (await api('/api/family/summary/sharing', { method: 'POST', body: { on, ...(on ? {} : { forget }) }, auth: false, headers: { 'X-Family-Device': fd.token } })).sharing;
  }
  showState(sharing);
  const cur = store.getState().ai.familyDevice;
  if (forget && cur?.token === fd.token) store.getState().setAI({ familyDevice: { ...cur, lastSent: null } });
  if (on) { stoppedAt = null; syncFamily({ moment: 'switch', store }).catch(() => {}); }
  if (hasServer()) refreshStatus();
  return sharing;
}

/**
 * The app mounts this once (App.jsx): while this device is linked and the app has a server, the summary keeps in step
 * at the sync moments, first on hidden.
 */
export function useFamilySync() {
  const token = useApp((s) => s.ai.familyDevice?.token);
  useEffect(() => {
    if (!token || !hasServer()) return undefined;
    loadEngine().catch(() => {});
    return onMoment(FAMILY_MOMENTS, (m) => syncFamily({ moment: m }), { priority: MOMENT_ORDER.family });
  }, [token]);
}
