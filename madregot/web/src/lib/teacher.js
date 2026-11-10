// The one place a teacher's credentials are chosen (spec TEACHER-1). A class bound to the teacher's email (owned) opens
// with the signed-in session (X-Account-Token, lib/parent.js) on any device; otherwise with the class's teacher key.
// The server checks either (requireTeacher). Every teacher call goes through teacherHeaders() or teacherApi(). The
// demo class (TEACHER-15, lib/demo.js) is checked first: its calls are answered on the device by lib/teacherDemo.js,
// and teacherHeaders is never called for it.
// The email is never copied into the saved profile: it is read from the session.
import { useEffect, useState } from 'react';
import { useApp, today, STORE_KEY } from './store.js';
import { api, ApiError, serverHealth } from './api.js';
import { useParent, accountCall, clearSession } from './parent.js';

const token = () => useParent.getState().session?.token || null;
const keyPair = (cls) => ({ 'X-Class-Code': cls.code, 'X-Teacher-Key': cls.key });
const accountPair = (cls, t) => ({ 'X-Class-Code': cls.code, 'X-Account-Token': t });

/**
 * The headers that open this class: the session for an owned class when one exists, else the teacher key. Neither:
 * ApiError not_account (the page asks for the email).
 */
export function teacherHeaders(cls) {
  const t = token();
  if (cls?.owned && t) return accountPair(cls, t);
  if (cls?.key) return keyPair(cls);
  throw new ApiError('not_account', 401);
}

/** Change one class of the teacher's profile on this device. */
export function patchClass(code, patch) {
  const p = useApp.getState().profile;
  if (p?.role !== 'teacher') return;
  useApp.getState().patchProfile({ classes: p.classes.map((c) => (c.code === code ? { ...c, ...patch } : c)) });
}

/**
 * One call as the class's teacher. On a 401 it tries the other credential once:
 * - the key was refused (the owner made a new one on another device) and this page has a session: the session opens
 *   the class if it is bound to it, and the stale key is dropped from this device;
 * - the session has ended (not_account): it is forgotten here, and a key on this device still opens the class;
 * - the session is fine but no longer has the class (not_teacher): the key opens it, and the class is no longer
 *   marked owned on this device.
 */
export async function teacherApi(path, opts = {}, cls) {
  // the demo class (TEACHER-15): answered on this device, in the Worker's shapes; no credentials are ever chosen
  if (useApp.getState().profile?.demo === true) {
    const { demoCall } = await import('./teacherDemo.js');
    return demoCall(opts.method || 'GET', path, opts.body);
  }
  const send = (h) => api(path, { ...opts, auth: false, headers: { ...(opts.headers || {}), ...h } });
  const first = teacherHeaders(cls);
  try {
    return await send(first);
  } catch (e) {
    if (e?.status !== 401) throw e;
    const again = async (h) => { try { return await send(h); } catch (e2) { throw e2?.status === 401 ? e : e2; } };
    if (first['X-Teacher-Key']) {
      const t = token();
      if (e.code !== 'not_teacher' || !t) throw e;
      const r = await again(accountPair(cls, t));
      patchClass(cls.code, { key: null, owned: true });
      return r;
    }
    if (e.code === 'not_account') clearSession();
    if (!cls.key) throw e;
    const r = await again(keyPair(cls));
    // the session is fine but this account no longer has the class: the key is what opens it here now
    if (e.code === 'not_teacher') patchClass(cls.code, { owned: false });
    return r;
  }
}

// ---------------------------------------------------------------- the teacher's account
/** The classes bound to the signed-in account (newest first, at most 20). */
export const myClasses = () => accountCall('/api/teacher/classes').then((r) => r.classes || []);

/** Bind a class this device opens with its key to the signed-in account. */
export async function bindClass(cls) {
  const t = token();
  if (!t) throw new ApiError('not_account', 401);
  if (!cls?.key) throw new ApiError('not_teacher', 401);
  const r = await accountCall('/api/teacher/class/owner', { method: 'POST', body: {}, headers: keyPair(cls) });
  patchClass(cls.code, { owned: true });
  return r;
}

/**
 * A new teacher key for an owned class (the owner only). The server asks for a code from the last 10 minutes: a 401
 * reauth_needed means the page shows the step-up (EmailCodeForm) and calls this again. The new key is kept on this
 * device, so it can be copied to a co-teacher; every other device's old key stops working.
 */
export async function rekey(cls) {
  const t = token();
  if (!t) throw new ApiError('not_account', 401);
  const r = await accountCall('/api/teacher/class/rekey', { method: 'POST', body: {}, headers: { 'X-Class-Code': cls.code } });
  patchClass(cls.code, { key: r.teacherKey, owned: true });
  return r;
}

// ---------------------------------------------------------------- the class itself (spec TEACHER-9)
/** A new name for the class (the server cleans it as it cleans a new class's name); this device's list follows. */
export async function renameClass(cls, className) {
  const r = await teacherApi('/api/teacher/class/rename', { method: 'POST', body: { className } }, cls);
  patchClass(cls.code, { className: r.className });
  return r;
}

/**
 * Delete the class on the server, with everything of it (TRUST-7). The signed-in session goes with the call even when
 * the key opens the class, because a class bound to an email can be deleted only by its owner, with a code from the
 * last 10 minutes: 403 not_owner (a key alone, or another email) and 401 reauth_needed ask the page for the step-up.
 * 409 class_has_licence while a licence runs. Returns {ok, students}; the class is not removed from this device here.
 */
export function deleteClass(cls) {
  const t = token();
  return teacherApi('/api/teacher/class/delete', { method: 'POST', body: { confirm: 'DELETE' }, headers: t ? { 'X-Account-Token': t } : {} }, cls);
}

/**
 * The class is gone: take it off this device. Returns the class that opens next, or null when none is left (the page
 * then closes the board, as leaving does).
 */
export function dropClassHere(code) {
  const st = useApp.getState();
  const p = st.profile;
  if (p?.role !== 'teacher') return null;
  const classes = p.classes.filter((c) => c.code !== code);
  if (!classes.length) return null;
  const next = classes.find((c) => c.code === p.active) || classes[0];
  st.setProfile({ ...p, classes, active: next.code, grade: next.grade || p.grade });
  return next;
}

/**
 * Open the board with the classes of the account (from myClasses). A teacher profile already on this device keeps its
 * classes and its keys; classes from the list are added, all marked owned, and the open class stays open.
 */
export function restore(list) {
  const st = useApp.getState();
  const prev = st.profile?.role === 'teacher' ? st.profile : null;
  const codes = new Set(list.map((c) => c.code));
  const kept = (prev?.classes || []).map((c) => (codes.has(c.code) ? { ...c, owned: true } : c));
  const known = new Set(kept.map((c) => c.code));
  const added = list.filter((c) => !known.has(c.code)).map((c) => ({ code: c.code, key: null, className: c.name, grade: c.grade, owned: true }));
  const classes = [...kept, ...added];
  if (!classes.length) return null;
  const open = classes.find((c) => c.code === prev?.active) || classes[0];
  const profile = { role: 'teacher', name: prev?.name || list[0]?.teacherName || '', classes, active: open.code, grade: open.grade };
  st.setProfile(profile);
  return profile;
}

// ---------------------------------------------------------------- the student view (spec TEACHER-2)
// A teacher opens the student screens (a stair, its stages, practice, a mastery check, a repair) inside PreviewFrame.
// They work on this device's own learning state; nothing reaches the class, because a teacher has no class token
// (recordAnswer queues answers only with profile.token, and the help button needs one).
const PREVIEW_PATH = /^\/(learn|lesson|repair)\//;
const currentPath = () => String(globalThis.location?.hash || '').replace(/^#/, '').split('?')[0] || '/';

/** A teacher on a student screen (the routes PreviewFrame wraps): never on the board or another /teacher screen. */
export function previewMode(path = currentPath()) {
  return useApp.getState().profile?.role === 'teacher' && PREVIEW_PATH.test(path);
}

/**
 * Where "חזרה ללוח" and the end of a student screen lead: kept in this tab only while a preview is open. PreviewFrame
 * sets it; every /teacher screen clears it on opening, so a teacher who opens #/ later lands on the board.
 */
const BACK_KEY = `${STORE_KEY}-preview-back`;
const safeBack = (url) => (typeof url === 'string' && /^\/teacher(\/|\?|$)/.test(url) ? url : null);
export const previewBack = {
  get() { try { return safeBack(sessionStorage.getItem(BACK_KEY)); } catch { return null; } },
  set(url) { const u = safeBack(url); if (!u) return; try { sessionStorage.setItem(BACK_KEY, u); } catch { /* storage blocked: the board is the way back */ } },
  clear() { try { sessionStorage.removeItem(BACK_KEY); } catch { /* nothing kept */ } },
};

// ---------------------------------------------------------------- the board's questions
/** Whether this server can send sign-in codes: true or false, or null while it is asked (or does not answer). */
export function useEmailSignIn() {
  const [email, setEmail] = useState(null);
  useEffect(() => {
    let on = true;
    // the demo class asks nothing of a server: no email sign-in in it
    if (useApp.getState().profile?.demo === true) { setEmail(false); return () => { on = false; }; }
    serverHealth().then((h) => { if (on) setEmail(h ? h.email !== false : null); });
    return () => { on = false; };
  }, []);
  return email;
}

/** The day `days` after `day` ('YYYY-MM-DD'). */
export function dayPlus(day, days) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + days);
  return today(d);
}
/** "לא עכשיו" on the bind card: ask again in a week. */
export const BIND_LATER_DAYS = 7;
export const remindBindLater = (cls, day = today()) => patchClass(cls.code, { bindLater: dayPlus(day, BIND_LATER_DAYS) });
/** Offer to bind this class to the email: it opens only with its key here, and "לא עכשיו" was not pressed this week. */
export const offerBind = (cls, day = today()) => !!cls && !cls.owned && !!cls.key && !(cls.bindLater && cls.bindLater > day);

/**
 * The public site's "ללוח המורה": the hosted app (VITE_TEACHER_URL) opened on the teacher's way in. '' for anything
 * but an http(s) address.
 */
export function teacherSiteLink(url) {
  const u = String(url || '').trim().replace(/#.*$/, '');
  return /^https?:\/\/[^\s/]+/i.test(u) ? `${u}#/?start=teacher` : '';
}
