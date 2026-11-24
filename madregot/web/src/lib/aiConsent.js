// Permission before the first AI request in a store build (STUDENT-12, Apple 5.1.2(i)): the app says that what the
// student asks goes to a third-party AI, and asks first. Only builds made with VITE_STORE (the iPhone app); the web
// keeps its own introduction of the tutor. runAI (lib/ai.js) waits on askConsent() before it sends anything:
// "כן, להמשיך" keeps the time in ai.consentAt and the request goes; "לא עכשיו" (or closing the sheet) sends nothing.
// components/AIConsentSheet.jsx is the sheet; App.jsx mounts it in store builds only.
import { create } from 'zustand';
import { useApp } from './store.js';

/** Is this a store build? (Vite writes the value in at build time; the web build has none.) */
export const storeBuild = () => !!import.meta.env.VITE_STORE;

/** The sheet's state: open while a request waits for an answer. */
export const useConsent = create(() => ({ open: false }));

let waiting = null; // { promise, resolve } while the sheet is open

/** True when a request must ask first: a store build, and no permission given on this device yet. */
export const needsConsent = () => storeBuild() && !useApp.getState().ai.consentAt;

/** Open the sheet (once, however many requests wait) and resolve to the answer: true to go on, false to send nothing. */
export function askConsent() {
  if (!needsConsent()) return Promise.resolve(true);
  if (!waiting) {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    waiting = { promise, resolve };
    useConsent.setState({ open: true });
  }
  return waiting.promise;
}

/** The student's answer. Yes keeps the time on the device (it is asked once); no keeps nothing and sends nothing. */
export function answerConsent(yes) {
  if (yes) useApp.getState().setAI({ consentAt: new Date().toISOString() });
  useConsent.setState({ open: false });
  const w = waiting;
  waiting = null;
  w?.resolve(!!yes);
}
