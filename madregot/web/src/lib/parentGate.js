// The adult step before the parents' area on a child's device (trust spec TRUST-8). A speed bump, not verification: the
// checks that count are elsewhere (the code in the parent's mailbox, the 18+ box at checkout, the cardholder at the
// payment company, the payer's welcome email). The year typed is checked here and forgotten: it is never sent and never
// stored. What is kept: a flag for this tab once the step was passed, and, after a year that is not an adult's, the
// time until which the field stays closed (10 minutes), so it cannot simply be tried again at once.
import { STORE_KEY } from './store.js';

export const ADULT_KEY = `${STORE_KEY}-adult`;
export const WAIT_KEY = `${STORE_KEY}-adult-wait`;
export const WAIT_MS = 10 * 60 * 1000;

/**
 * Is this a birth year of an adult, 18 to 100 years old in the year of `now`? Known error: up to one year (a child born in
 * December 2008 passes in November 2026), as the code comment in AdultGate says.
 */
export function adultYearOk(y, now = new Date()) {
  const s = typeof y === 'number' ? String(y) : String(y ?? '').trim();
  if (!/^\d{4}$/.test(s)) return false;
  const year = Number(s);
  const thisYear = now.getFullYear();
  return year >= thisYear - 100 && year <= thisYear - 18;
}

const read = (store, key) => { try { return store()?.getItem(key) ?? null; } catch { return null; } };
const write = (store, key, value) => { try { if (value == null) store()?.removeItem(key); else store()?.setItem(key, value); } catch { /* blocked */ } };
const session = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
const local = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** The step was passed in this tab. */
export const adultPassed = () => read(session, ADULT_KEY) === '1';
export const setAdultPassed = () => write(session, ADULT_KEY, '1');

/**
 * Until when the field stays closed (ms since the epoch), or 0. Kept on the device (not only this tab), so opening a new
 * tab does not open it again; it holds a time, never the year.
 */
export function waitUntil(now = Date.now()) {
  const t = Number(read(local, WAIT_KEY));
  if (!Number.isFinite(t) || t <= now) return 0;
  return Math.min(t, now + WAIT_MS); // a clock moved back never closes it for longer than 10 minutes
}
export const startWait = (now = Date.now()) => write(local, WAIT_KEY, String(now + WAIT_MS));

/** Does the parents' area show the adult step first? mode home or link (never cancel), a student profile, no parent session. */
export function needsAdultStep({ mode, role, session: parentSession }) {
  if (mode === 'cancel') return false; // cancelling must stay easy (Consumer Protection Law s.14ט)
  if (mode !== 'home' && mode !== 'link') return false;
  return role === 'student' && !parentSession && !adultPassed();
}
