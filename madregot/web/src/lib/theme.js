// Light and dark (STUDENT-2). The app follows the phone by default ('system'); the student can choose 'light' or 'dark'
// in Settings (מראה). The colours themselves are tokens: tokens.css holds the light values and dark.css the dark ones,
// applied under the phone's dark setting or data-theme="dark". This file only says which one applies:
// - data-theme on <html> is set for an explicit choice and removed for 'system';
// - the two theme-color metas (the browser bar) follow the choice;
// - a mirror of the choice in localStorage (`${STORE_KEY}-theme`) lets public/theme-boot.js apply it before the first
//   paint, so the app never flashes the other theme. 'system' stores nothing.
import { useEffect, useState } from 'react';

// the same key as the store's (store.js STORE_KEY), written out here because the store imports this file
export const THEME_KEY = `${import.meta.env.VITE_STORE_KEY || 'madregot'}-theme`;
export const THEMES = ['system', 'light', 'dark'];
export const THEME_EVENT = 'madregot-theme';
const BAR = { light: '#ffffff', dark: '#0f1115' }; // colour-ok: the browser bar, the same as --paper in each theme
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Apply a theme choice ('system' | 'light' | 'dark'; anything else counts as 'system'). */
export function applyTheme(pref) {
  if (typeof document === 'undefined') return;
  const t = pref === 'light' || pref === 'dark' ? pref : 'system';
  const html = document.documentElement;
  if (t === 'system') html.removeAttribute('data-theme');
  else html.dataset.theme = t;
  // each meta keeps its media query; an explicit choice paints the bar in that theme under both
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const own = /dark/.test(meta.getAttribute('media') || '') ? 'dark' : 'light';
    meta.setAttribute('content', BAR[t === 'system' ? own : t]);
  }
  try {
    if (t === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch { /* storage blocked: the choice still holds until the page closes */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** The theme on screen now: 'light' or 'dark'. */
export function themeName() {
  if (typeof document === 'undefined') return 'light';
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** For code that paints colours itself (the KaTeX colours of the line builder): the theme on screen, kept up to date. */
export function useThemeName() {
  const [name, setName] = useState(themeName);
  useEffect(() => {
    const update = () => setName(themeName());
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
    mq?.addEventListener?.('change', update);
    window.addEventListener(THEME_EVENT, update);
    update();
    return () => { mq?.removeEventListener?.('change', update); window.removeEventListener(THEME_EVENT, update); };
  }, []);
  return name;
}
