// The tutor on the child's side of the app: an anonymous device id (the free taste is counted per device), the AI-only
// token of a device linked to a family plan, and what the server says this device may ask today. The parent's account
// never lives here (lib/parent.js keeps it apart, and only on the parent's own pages): a child's AI calls carry X-Device
// and X-Family-Device, never X-Account-Token. A teacher's carry the class's credentials (lib/teacher.js), which for a
// class bound to the teacher's email are the class code and the teacher's session. Nothing secret is stored: the Claude key stays on the server.
import { create } from 'zustand';
import { KIND_GROUP, FREE_KINDS } from '@shared/ai.js';
import { useApp, PERSONAL_KEY } from './store.js';
import { api, apiBase, hasServer, ApiError } from './api.js';
import { qaStatus, qaActive } from './qaFixtures.js';
import { randomHex } from './random.js';
import { teacherHeaders, previewMode } from './teacher.js';
import { afterFamilyLink, escrowWith } from './durable/escrow.js';
import { familyGone } from './durable/vault.js';

/** A random id for this device, made once. The server counts the free questions per device. */
export function deviceId() {
  const { ai, setAI } = useApp.getState();
  if (/^[a-f0-9]{32}$/.test(ai.device || '')) return ai.device;
  const id = randomHex(16);
  setAI({ device: id });
  return id;
}
// one function for every random id; it lives in a module with no imports, so the store can use it too
export { randomHex };

/**
 * Does this build use a family plan at all? Not the iPhone store build (VITE_STORE=ios, STUDENT-12): Apple 3.1.3(b)/(c)
 * lets an app unlock a consumer plan bought elsewhere only when the app also sells it by in-app purchase, which it does
 * not. So that build never sends the family-device token and shows no family rows; the AI runs on the free daily taste
 * or a class licence (sold to schools). VITE_STORE_FAMILY=1 turns it back on, for the day the owner adds in-app purchase.
 */
export const familyInApp = () => import.meta.env.VITE_STORE !== 'ios' || import.meta.env.VITE_STORE_FAMILY === '1';

/** The headers of every tutor call from this device: its id, and its family-device token when it has one. */
export function aiHeaders() {
  const fd = familyInApp() ? useApp.getState().ai.familyDevice : null;
  return { 'X-Device': deviceId(), ...(fd?.token ? { 'X-Family-Device': fd.token } : {}) };
}

/** A teacher's open class (its licence is what counts for the teacher's own questions). */
export function teacherClass() {
  const p = useApp.getState().profile;
  return p?.role === 'teacher' ? p.classes?.find((c) => c.code === p.active) || null : null;
}
const statusHeaders = () => {
  const cls = teacherClass();
  return { ...aiHeaders(), ...(cls ? teacherHeaders(cls) : {}) };
};

/** How the tutor runs on this device: through the server, with a personal key (only where compiled in), or not at all. */
export function aiMode() {
  const { ai, profile } = useApp.getState();
  // the demo class (TEACHER-15): a fixed sample answer on the device, no AI call
  if (profile?.demo === true) return 'demo';
  // A personal key is for practising alone; a class always goes through its server.
  if (PERSONAL_KEY && ai.mode === 'personal' && ai.key && !profile?.classCode) return 'personal';
  if (qaActive()) return 'server';
  return apiBase() ? 'server' : 'none';
}
export const aiReady = () => aiMode() !== 'none';

export const PAID_TIERS = ['family', 'class', 'teacher', 'trial', 'legacy'];

/**
 * What the device knows when the server says class_ai_off (trust spec TRUST-11): the student's class has the tutor
 * off under the Ministry's rules. A state of its own, not an error: every screen shows the calm line, and nothing is
 * asked of the tutor (a message that reads as distress still goes, and the server answers it with the fixed reply).
 */
export const CLASS_OFF = Object.freeze({ classOff: true, tier: null, kinds: Object.freeze([]), groups: Object.freeze({}) });
/**
 * What the device knows when the server says parent_ok_needed (trust spec TRUST-9): a child alone, on a device no
 * parent has approved. The status call says so itself ({ state: 'parent_ok_needed' }); a refused request leaves the
 * same state. Like CLASS_OFF, a state and not an error: the screens send the child to the screen for their parents.
 */
export const PARENT_OK_NEEDED = Object.freeze({ state: 'parent_ok_needed', tier: null, kinds: Object.freeze([]), groups: Object.freeze({}) });
const waitsForParent = (status) => status?.state === 'parent_ok_needed';

// What the server said last: GET /api/ai/status, kept up to date by the headers of each answer.
// `ended` is true for this visit when the device was on a paid tier and is now on the free taste (said once).
// `refreshed` counts the status reads that came back: the family summary (familySync.js) waits for the next one after
// the server said "not now".
export const useAIStatus = create(() => ({ status: null, loading: false, error: null, ended: false, refreshed: 0 }));
const fresh = () => ({ refreshed: useAIStatus.getState().refreshed + 1 });

let refreshing = null;
export async function refreshStatus() {
  // the demo class asks no server: no status, so nothing is offered for sale in it
  if (useApp.getState().profile?.demo === true) { useAIStatus.setState({ status: null, loading: false, error: null }); return null; }
  const qa = qaStatus();
  if (qa) { useAIStatus.setState({ status: qa.status, loading: false, error: null, ended: !!qa.ended, ...fresh() }); return qa.status; }
  if (!hasServer()) { useAIStatus.setState({ status: null, loading: false, error: 'no_server' }); return null; }
  if (refreshing) return refreshing;
  useAIStatus.setState({ loading: true, error: null });
  refreshing = (async () => {
    try {
      const status = await api('/api/ai/status', { headers: statusHeaders(), onResponse: readLinked });
      const { ai, setAI } = useApp.getState();
      const ended = !!ai.lastTier && PAID_TIERS.includes(ai.lastTier) && status.tier === 'free';
      if (status.tier !== ai.lastTier) setAI({ lastTier: status.tier });
      useAIStatus.setState({ status, loading: false, ...(ended ? { ended: true } : {}), ...fresh() });
      return status;
    } catch (e) {
      if (e.code === 'class_ai_off') { useAIStatus.setState({ status: CLASS_OFF, loading: false, error: null }); return CLASS_OFF; }
      if (e.code === 'parent_ok_needed') { useAIStatus.setState({ status: PARENT_OK_NEEDED, loading: false, error: null }); return PARENT_OK_NEEDED; }
      useAIStatus.setState({ loading: false, error: e.code || 'network' });
      return null;
    } finally { refreshing = null; }
  })();
  return refreshing;
}

/** The day changed since the last status (its resetsAt, the next midnight in Jerusalem, has passed): ask again. */
export function refreshIfNewDay() {
  const s = useAIStatus.getState().status;
  if (s?.resetsAt && !refreshing && Date.now() >= Date.parse(s.resetsAt) && (hasServer() || qaActive())) refreshStatus();
}

/**
 * X-AI-Linked: 0 means the family-device token is no longer valid (unlinked, or the parent left): forget it, and when the
 * family kept this device's backup code, move the backup to a new code at the next sync (durable/vault.js familyGone).
 */
function readLinked(res) {
  if (res.headers.get('X-AI-Linked') === '0' && useApp.getState().ai.familyDevice) familyGone(useApp);
}

/**
 * What a tutor action can do on this device right now:
 *   offline  no tutor here (no server, no personal key)
 *   open     it works (paywall off, a paid tier, a personal key, or a status that could not be read)
 *   free     the free taste, `left` questions today
 *   used     today's questions for it are used
 *   locked   the free taste does not include it (photo check, new exercises, exam check)
 *   paused   the free tutor rests today (its daily budget is spent)
 *   resting  a shared ceiling (this network or this class) is reached today
 *   economy  a paid plan's month is over its fair use: checks come back on the 1st
 *   class_off  the student's class has the tutor off, under the Ministry's rules (TRUST-11)
 *   parent_ok_needed  a child alone: a parent approves the tutor on this device once, for free (TRUST-9)
 * An unknown status gives 'open', so a failed status call never blocks anything.
 */
export function aiAccess(kind, status = useAIStatus.getState().status) {
  const mode = aiMode();
  if (mode === 'none') return { state: 'offline', left: null, tier: null };
  if (mode === 'personal') return { state: 'open', left: null, tier: 'personal' };
  if (status?.classOff) return { state: 'class_off', left: null, tier: null };
  if (waitsForParent(status)) return { state: 'parent_ok_needed', left: null, tier: null };
  if (!status || !status.tier) return { state: 'open', left: null, tier: null };
  const tier = status.tier;
  const group = KIND_GROUP[kind] || 'tutor';
  const kinds = Array.isArray(status.kinds) ? status.kinds : null;
  if (tier === 'open') {
    const g = status.groups?.all;
    if (g && g.left <= 0) return { state: 'used', left: 0, tier };
    return { state: 'open', left: g ? g.left : null, tier };
  }
  if (tier === 'free') {
    if (!FREE_KINDS.includes(kind) || (kinds && !kinds.includes(kind))) {
      if (FREE_KINDS.includes(kind) && kinds && !kinds.length) return { state: 'offline', left: null, tier }; // no free taste here (solo off)
      return { state: 'locked', left: null, tier };
    }
    if (status.shared === 'paused') return { state: 'paused', left: 0, tier };
    if (status.shared === 'network' || status.shared === 'class') return { state: 'resting', left: 0, tier, scope: status.shared };
    const left = status.groups?.tutor?.left ?? null;
    if (left !== null && left <= 0) return { state: 'used', left: 0, tier };
    return { state: 'free', left, tier };
  }
  // a paid tier: family, class, teacher, trial or legacy
  if (status.shared === 'paused') return { state: 'paused', left: 0, tier };
  const g = status.groups?.[group] ?? (tier === 'legacy' ? status.groups?.all : null);
  if (kinds && !kinds.includes(kind)) {
    if (status.economy && !FREE_KINDS.includes(kind)) return { state: 'economy', left: null, tier };
    if (g && g.left <= 0) return { state: 'used', left: 0, tier };
    return { state: 'locked', left: null, tier };
  }
  if (g && (g.left <= 0 || g.monthLeft === 0)) return { state: 'used', left: 0, tier };
  return { state: 'open', left: g ? g.left : null, tier };
}

/** Does this device have the tool at all today (even if today's count is used)? Locked, economy and offline do not. */
export const hasTool = (kind, status) => ['open', 'free', 'used', 'paused', 'resting'].includes(aiAccess(kind, status).state);

/**
 * May the app ask the tutor without being asked (the explanation after a second miss)? Never on the free taste, and
 * never in a teacher's student view: there the teacher's own questions would be spent without asking.
 */
export function autoAskAllowed() {
  if (previewMode()) return false;
  const mode = aiMode();
  if (mode === 'personal') return true;
  if (mode !== 'server') return false;
  const tier = useAIStatus.getState().status?.tier;
  return tier === 'open' || PAID_TIERS.includes(tier);
}

/**
 * Before a tool that sends a photo or asks for new exercises: what to show instead of the camera, or null when it
 * can go ahead. 'locked' and 'economy' are the tool's own info state (ToolLocked); a used, resting or paused tutor
 * opens the calm sheet (LimitSheet) and also returns its state. Before the first AI action on this device it opens the
 * introduction instead and returns 'intro'; `then` (the action itself) runs after "הבנתי".
 */
export function gate(kind, { onMadi, then } = {}) {
  const a = aiAccess(kind);
  if (a.state === 'locked' || a.state === 'economy') return a.state;
  if (a.state === 'class_off') { openLimitSheet({ reason: 'class_ai_off', onMadi }); return a.state; }
  if (a.state === 'parent_ok_needed') { openLimitSheet({ reason: 'parent_ok_needed', onMadi }); return a.state; }
  if (a.state === 'used') { openLimitSheet({ reason: 'daily_limit', tier: a.tier, onMadi }); return a.state; }
  if (a.state === 'paused') { openLimitSheet({ reason: 'free_paused', tier: a.tier, onMadi }); return a.state; }
  if (a.state === 'resting') { openLimitSheet({ reason: 'shared_limit', tier: a.tier, scope: a.scope, onMadi }); return a.state; }
  if (needIntro(then)) return 'intro';
  return null;
}

// ---------------------------------------------------------------- the introduction before the first AI action (TRUST-4 §4.6)
// Mounted once in the app (AIIntro.jsx). Shown once per device: ai.introSeen === true afterwards (an older saved state
// has no such field, so it shows once there too; no store version is needed). The action that opened it is kept and
// runs after "הבנתי", so nothing the child asked for is lost; closing the sheet any other way runs nothing.
export const useAIIntro = create(() => ({ open: false, then: null }));
export const introSeen = () => useApp.getState().ai?.introSeen === true;
export const openAIIntro = (then = null) => useAIIntro.setState({ open: true, then });
export const closeAIIntro = () => useAIIntro.setState({ open: false, then: null });
/** "הבנתי": remembered on this device, then the action that was waiting runs. */
export function acceptAIIntro() {
  const { then } = useAIIntro.getState();
  useApp.getState().setAI({ introSeen: true });
  closeAIIntro();
  then?.();
}
/**
 * Is the introduction still due before an AI action here? Then it opens (with `then`, the action, to run after it) and
 * this returns true: the caller stops. Never on a device with no tutor (nothing would be sent), never in the teacher
 * lane's demo class (a fixed sample answer on the device: nothing goes to Anthropic, which the introduction is about),
 * and never for a message that reads as distress (the caller checks that first: a child in distress never meets it).
 */
export function needIntro(then) {
  if (introSeen() || aiMode() === 'none' || aiMode() === 'demo') return false;
  openAIIntro(then || null);
  return true;
}

/** The server's count after an answer (the headers X-AI-Tier, X-AI-Group, X-AI-Left, X-AI-Economy, X-AI-Linked). */
export function noteUsage(res) {
  readLinked(res);
  const tier = res.headers.get('X-AI-Tier'); const group = res.headers.get('X-AI-Group'); const left = Number(res.headers.get('X-AI-Left'));
  if (!tier) return;
  // an answer while the class's tutor was off means the teacher has turned it on since (or, on a device waiting for a
  // parent, that a parent has approved it): start again from this answer, and ask for the whole status
  const cur = useAIStatus.getState().status || {};
  const reopened = !!cur.classOff || waitsForParent(cur);
  const prev = reopened ? {} : cur;
  const groups = { ...(prev.groups || {}) };
  const g = tier === 'open' ? 'all' : group;
  if (g && Number.isFinite(left)) groups[g] = { ...(groups[g] || { limit: left }), left };
  useAIStatus.setState({ status: { ...prev, tier, groups, economy: res.headers.get('X-AI-Economy') === '1' ? true : !!prev.economy } });
  if (reopened) refreshStatus();
}

/** A limit the server reported (an AI call refused): remember it, so the screens show the calm state at once. */
export function noteLimit(data = {}, kind) {
  if (data.error === 'class_ai_off') { useAIStatus.setState({ status: CLASS_OFF }); return; }
  if (data.error === 'parent_ok_needed') { useAIStatus.setState({ status: PARENT_OK_NEEDED }); return; }
  const prev = useAIStatus.getState().status;
  if (!prev) return;
  const groups = { ...(prev.groups || {}) };
  if (data.error === 'daily_limit') {
    const g = prev.tier === 'open' ? 'all' : data.group || KIND_GROUP[kind] || 'tutor';
    groups[g] = { ...(groups[g] || {}), limit: data.limit ?? groups[g]?.limit, left: 0 };
  }
  const shared = data.error === 'free_paused' ? 'paused' : data.error === 'shared_limit' ? (data.scope === 'class' ? 'class' : 'network') : prev.shared;
  const economy = data.error === 'monthly_fair_use' ? true : prev.economy;
  // when the count starts again (in every mode, also with the switch off): a screen left open asks again then
  const resetsAt = data.resetsAt && (!prev.resetsAt || Date.parse(data.resetsAt) < Date.parse(prev.resetsAt)) ? data.resetsAt : prev.resetsAt;
  useAIStatus.setState({ status: { ...prev, groups, shared, economy, ...(resetsAt ? { resetsAt } : {}) } });
}

// ---------------------------------------------------------------- the calm sheet when the tutor says "not now"
// Mounted once in the app. reason: daily_limit | shared_limit | free_paused | monthly_fair_use | paid_only | class_ai_off |
// parent_ok_needed. onMadi: the opener's way to ask Madi instead (the lesson opens its TutorSheet), or none.
export const useLimitSheet = create(() => ({ open: false, reason: null, tier: null, scope: null, onMadi: null }));
export const openLimitSheet = ({ reason, tier = null, scope = null, onMadi = null }) => useLimitSheet.setState({ open: true, reason, tier, scope, onMadi });
export const closeLimitSheet = () => useLimitSheet.setState({ open: false, onMadi: null });
export const LIMIT_ERRORS = ['paid_only', 'daily_limit', 'shared_limit', 'monthly_fair_use', 'free_paused', 'class_ai_off', 'parent_ok_needed'];

// ---------------------------------------------------------------- linking this device to a family plan (spec §3.3)
/** A link code for this device: the one already waiting, or a new one. The secret never leaves this device. */
export async function startLink({ fresh = false } = {}) {
  const { ai, setAI } = useApp.getState();
  const p = ai.pendingLink;
  if (!fresh && p?.code && p.secret && Date.parse(p.expiresAt) > Date.now() + 60_000) return p;
  const secret = randomHex(16);
  const r = await api('/api/family/link/start', { method: 'POST', body: { secret }, headers: { 'X-Device': deviceId() }, auth: false });
  const link = { code: r.code, secret, expiresAt: r.expiresAt, url: r.url };
  setAI({ pendingLink: link });
  return link;
}

/**
 * The family device as a new link writes it: its AI-only token and the parent's label for it. The summary's notice was
 * not seen yet and nothing was sent (sharingSeen and lastSent, lib/familySync.js).
 */
export const newFamilyDevice = (r) => ({ token: r.deviceToken, label: r.label || '', sharingSeen: null, lastSent: null });

/**
 * Ask once whether a parent claimed the code: 'waiting', 'linked' (the token is saved) or 'expired'. Once linked, the
 * family keeps this device's backup code, or the progress the parent chose to continue from comes here (DURABLE-6,
 * durable/escrow.js): that runs in the background, and `onEscrow({ toast, restored })` hears how it went.
 */
export async function pollLink({ onEscrow } = {}) {
  const { ai, setAI } = useApp.getState();
  const p = ai.pendingLink;
  if (!p?.code) return 'expired';
  try {
    const r = await api('/api/family/link/finish', { method: 'POST', body: { code: p.code, secret: p.secret }, auth: false });
    if (!r.deviceToken) return 'waiting';
    // a new link starts fresh: the child is told about the parents' summary again before anything is sent (PARENTS-4)
    setAI({ familyDevice: newFamilyDevice(r), pendingLink: null });
    afterFamilyLink(r).then((x) => onEscrow?.(x));
    await refreshStatus();
    return 'linked';
  } catch (e) {
    if (e.code === 'link_expired' || e.code === 'link_not_found') { setAI({ pendingLink: null }); return 'expired'; }
    if (e.code === 'slow_down' || e.code === 'network') return 'waiting';
    throw e;
  }
}

/**
 * This device leaves the family plan (the settings row, and before deleting everything). The server deletes the link,
 * the summaries sent to the parents and the code the family kept for this device. When the server could not be reached
 * (no network, or it answered 5xx) this rejects and nothing changes here: the token stays, so the leave can be tried
 * again and the summaries are never left behind on the server. Any other answer means the server no longer knows the
 * token (it already left), and the device forgets it.
 */
export async function leaveFamily() {
  const { ai, setAI } = useApp.getState();
  const token = ai.familyDevice?.token;
  // the iPhone store build never sends the token, not even to leave (familyInApp)
  if (token && hasServer() && familyInApp()) {
    try { await api('/api/family/devices/leave', { method: 'POST', body: {}, headers: { 'X-Family-Device': token }, auth: false }); } catch (e) {
      if (!(e instanceof ApiError) || e.code === 'network' || !e.status || e.status >= 500) throw e;
    }
  }
  setAI({ familyDevice: null, pendingLink: null });
  // the family no longer keeps this device's code (the server deleted it with the link)
  const b = useApp.getState().backup;
  if (b?.escrow === 'family' || b?.escrow === 'both') useApp.setState({ backup: { ...b, escrow: escrowWith(b.escrow, 'family', false) } });
  if (hasServer()) await refreshStatus();
}

export { ApiError };
