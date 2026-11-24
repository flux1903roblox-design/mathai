// What the first load needs of the demo class (TEACHER-15), and nothing more (FOLLOWUP-23): whether this tab or its
// address asks for the demo, the flags of the sheet that asks before opening it in a new tab (the sheet itself,
// components/DemoAsk.jsx, loads when it is asked), and the demo's address.
// The demo itself (lib/demo.js: entering it, holding the saving, leaving it) loads on demand, only when one of these
// says it is wanted: main.jsx imports it before the first screen then, and the teacher's screens import it as they load.
import { create } from 'zustand';
import { STORE_KEY } from './store.js';
import { qaTeacher } from './qaFixtures.js';

/** This tab's record of the demo, in sessionStorage (lib/demo.js writes it). */
export const DEMO_KEY = `${STORE_KEY}-demo`;

/** { on, hadProfile, data } from sessionStorage, or null. */
export function readDemo() {
  try { const v = JSON.parse(sessionStorage.getItem(DEMO_KEY) || 'null'); return v?.on ? v : null; } catch { return null; }
}

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

/** Before the first screen: is the demo open in this tab (a reload inside it), or does the address ask for it? */
export const demoWanted = () => typeof window !== 'undefined' && (!!readDemo() || !!askedForDemo());

/**
 * The question asked on a device someone uses before the demo opens in a new tab (components/DemoAsk.jsx). `asked`
 * stays true once it was asked, so the sheet, loaded on demand then, stays mounted and closes as a sheet does.
 */
export const useDemoAsk = create(() => ({ open: false, asked: false }));

/** This app's address with the demo asked for; `tab`: open it even though this device has a profile. */
export const demoUrl = ({ tab = false } = {}) => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/?start=demo${tab ? '&tab=1' : ''}`;
};
