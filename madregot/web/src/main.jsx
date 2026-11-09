// must run before the router is created (imports run in order)
import './lib/historySeed.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/rubik';
import '@fontsource-variable/fredoka';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/motion.css';
import './styles/v4.css';
import './styles/dark.gen.css';
import './styles/theme-dark.css';
import App from './App.jsx';

// Test hook: with localStorage 'madregot-seed' set, exercises come out the same on every run (visual tests).
try {
  const seed = Number(localStorage.getItem('madregot-seed'));
  if (seed) {
    let t = seed >>> 0;
    Math.random = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
} catch { /* storage blocked */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
