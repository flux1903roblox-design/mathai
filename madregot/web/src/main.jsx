// first of all: the error monitor hears the page before anything else runs (lib/monitor.js)
import { monitor } from './lib/monitor.js';
// must run before the router is created (imports run in order): a plain /parents… path becomes its hash route first
import './lib/pathToHash.js';
import './lib/historySeed.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Rubik's Hebrew and Latin subsets only (DURABLE-11)
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/motion.css';
import './styles/v4.css';
import './styles/canon.css';
import './styles/dark.css'; // last: the dark values of the tokens (STUDENT-2)
import App from './App.jsx';
import { durableBoot, errorLog } from './lib/durable/storage.js';
import { apiBase } from './lib/api.js';
import { onMoment, keepaliveBudget, MOMENT_ORDER } from './lib/durable/moments.js';
import { registerSW } from './lib/swClient.js';
import { useApp } from './lib/store.js';
import { bootTopics } from './lib/bootTopics.js';
import { bootDemo } from './lib/demo.js';

// Which release this page runs (the update test reads it; error reports carry the same name).
window.__RELEASE = import.meta.env.VITE_RELEASE;

// Error reports go to this app's server, if it has one (never with VITE_MONITOR=off), and always to the errors kept on
// the device; when the page is hidden, they are sent with what the keepalive budget has left after the class outbox.
monitor.configure({ server: () => (import.meta.env.VITE_MONITOR === 'off' ? '' : apiBase()), ring: errorLog, budget: keepaliveBudget });
onMoment('hidden', () => monitor.flush({ hidden: true }), { priority: MOMENT_ORDER.other });

// Test hook: with localStorage 'madregot-seed' set, exercises come out the same on every run (visual tests).
try {
  const seed = Number(localStorage.getItem('madregot-seed'));
  if (seed) {
    let t = seed >>> 0;
    Math.random = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
} catch { /* storage blocked */ }

// The first screen waits for the copy of the progress on the device (at most 300 ms, lib/durable/storage.js), so a
// broken or lost save is already back when the app appears. Then the demo class (TEACHER-15): a reload inside it, or
// an address that asks for it, opens it before the first screen (it holds saving, so the device's own save stays as
// it was). Opened straight on a lesson or a stair, the first screen also waits for that screen's teaching content
// (lib/bootTopics.js), so it appears whole.
(async () => {
  await durableBoot();
  bootDemo();
  await bootTopics(window.location.hash, useApp.getState());
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
})();

// The service worker (DURABLE-10; production builds only): registerSW waits for the page to finish loading, so it
// never competes with the first screen.
registerSW();
