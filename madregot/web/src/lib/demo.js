// The demo class's way in and out (spec TEACHER-15 §2-3): a synthetic class anyone can open, with no server and no
// sign-in. Its data (lib/teacherDemo.js, lazy in the teacher chunk) lives in memory and in this tab's sessionStorage
// ('<STORE_KEY>-demo'), never in the saved store: while the demo is open the store holds its saving (store.js
// holdSaving), so the device's own saved state stays exactly as it was, and leaving the demo reads it back.
//
// Ways in: TeacherStart's "לראות לוח לדוגמה, בלי הרשמה", the same button on the public no-server teacher page,
// #/?start=demo, and ?qa-teacher=demo on a QA build (lib/qaFixtures.js). On a device with no profile the demo opens
// here; on a device someone uses (a student's, a real teacher's) it opens in a new tab instead (&tab=1), after asking.
// A reload keeps the demo for the visit. Every call the demo's screens make is answered on the device: lib/api.js
// refuses to reach the server while the profile is a demo.
import { create } from 'zustand';
import { useApp, STORE_KEY, holdSaving } from './store.js';
import { qaTeacher } from './qaFixtures.js';

export const DEMO_KEY = `${STORE_KEY}-demo`;
export const DEMO_CODE = 'DEMO01';
export const DEMO_CLASS_NAME = 'ז׳3 (דוגמה)';
export const DEMO_TEACHER = 'מורה לדוגמה';
/** The pilot kit's school in the demo (TEACHER-15 §5: the guide and kit open with the demo class's details). */
export const DEMO_SCHOOL = 'בית ספר לדוגמה';
/** The words of the demo (spec TEACHER-15, Hebrew copy). */
export const DEMO_COPY = {
  link: 'לראות לוח לדוגמה, בלי הרשמה',
  banner: 'כיתה לדוגמה: השמות והנתונים בדויים, ושום דבר כאן לא נשלח.',
  exit: 'יציאה מהדוגמה',
  real: 'לפתיחת כיתה אמיתית',
  saved: 'בכיתה לדוגמה זה נשמר רק כאן, עד שתסגרו את הלשונית.',
  noDelete: 'בכיתה לדוגמה אי אפשר למחוק או להחליף מפתח.',
  aiSample: 'תשובה לדוגמה. בכיתה אמיתית העוזר עונה על השאלה שלכם.',
};

/** The profile of the demo: a teacher with one class, marked demo (never saved to the device). */
export const demoProfile = () => ({
  role: 'teacher', name: DEMO_TEACHER, grade: '7', active: DEMO_CODE, demo: true,
  classes: [{ code: DEMO_CODE, key: null, className: DEMO_CLASS_NAME, grade: '7' }],
});
export const isDemo = (p = useApp.getState().profile) => p?.demo === true;
export const useDemo = () => useApp((s) => s.profile?.demo === true);

// ---------------------------------------------------------------- this tab's record of the demo
/** { on, hadProfile, data } from sessionStorage, or null. */
export function readDemo() {
  try { const v = JSON.parse(sessionStorage.getItem(DEMO_KEY) || 'null'); return v?.on ? v : null; } catch { return null; }
}
export function writeDemo(patch) {
  try { sessionStorage.setItem(DEMO_KEY, JSON.stringify({ ...(readDemo() || { on: true }), ...patch, on: true })); } catch { /* the demo lasts for this page */ }
}
function clearDemo() {
  try { sessionStorage.removeItem(DEMO_KEY); sessionStorage.removeItem('madregot-qa-teacher'); } catch { /* nothing kept */ }
}
/** The device had its own profile before the demo opened in this tab (a student's or a teacher's). */
export const demoOverProfile = () => !!readDemo()?.hadProfile;

/** Code that keeps the demo's data in memory registers here, so leaving the demo forgets it (teacherDemo.js). */
const forgetters = new Set();
export const onDemoExit = (fn) => { forgetters.add(fn); return () => forgetters.delete(fn); };

/** Open the demo in this tab: saving held first, then the demo profile in memory. */
export function enterDemo() {
  const p = useApp.getState().profile;
  const hadProfile = readDemo()?.hadProfile ?? (!!p && !isDemo(p));
  holdSaving(true);
  writeDemo({ hadProfile });
  useApp.getState().setProfile(demoProfile());
}

/** This app's address with the demo asked for; `tab`: open it even though this device has a profile. */
export const demoUrl = ({ tab = false } = {}) => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/?start=demo${tab ? '&tab=1' : ''}`;
};

/** A demo link pressed: here on a device with no profile, else in a new tab (this device's profile is never touched). */
export function openDemo() {
  const p = useApp.getState().profile;
  if (p && !isDemo(p)) { window.open(demoUrl({ tab: true }), '_blank'); return 'tab'; }
  enterDemo();
  return 'here';
}

/**
 * Leave the demo: its data is forgotten, saving resumes, and the device's saved state is read back as it was before
 * (a device with no profile is on the first screen again; one with a profile is that profile again).
 */
export async function exitDemo() {
  clearDemo();
  forgetters.forEach((fn) => fn());
  holdSaving(false);
  await useApp.persist.rehydrate();
  if (isDemo()) useApp.getState().setProfile(null);
}

// ---------------------------------------------------------------- on opening the app
/** The question asked on a device someone uses before the demo opens in a new tab. */
export const useDemoAsk = create(() => ({ open: false }));

/** Does the address ask for the demo? { tab } or null. */
export function askedForDemo(loc = window.location) {
  try {
    const q = new URLSearchParams(loc.hash.split('?')[1] || '');
    const s = new URLSearchParams(loc.search);
    const start = q.get('start') || s.get('start');
    if (start === 'demo') return { tab: (q.get('tab') || s.get('tab')) === '1' };
  } catch { /* an address it cannot read asks for nothing */ }
  return qaTeacher() === 'demo' ? { tab: false } : null;
}

/**
 * Before the first render (main.jsx): a reload inside the demo opens it again; an address that asks for it opens it on
 * a device with no profile (or in the tab opened for it), and on a device someone uses asks first. → 'entered' |
 * 'ask' | null.
 */
export function bootDemo() {
  if (typeof window === 'undefined') return null;
  if (readDemo()) { enterDemo(); return 'entered'; }
  const want = askedForDemo();
  if (!want) return null;
  const p = useApp.getState().profile;
  if (!p || isDemo(p) || want.tab) { enterDemo(); return 'entered'; }
  useDemoAsk.setState({ open: true });
  return 'ask';
}
