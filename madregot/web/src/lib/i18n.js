// The app's languages (COUNCIL2-27/34): Hebrew, the default, and Arabic. Every word the converted screens show is looked
// up by key in a catalogue of the current language (src/locales/*.json): t('shell.nav.learn').
//
// - Hebrew is the default and reads exactly as before. Its first-load words (locales/shell.he.json) come with the first
//   download, since they replace the words that were written into those screens; the words of screens that load on
//   demand come with them (locales/settings.js registers settings.he.json when Settings loads).
// - Arabic is one file per area (locales/*.ar.json), fetched only when Arabic is chosen (loadLocale), so the first
//   download of a Hebrew user does not grow. A device that chose Arabic fetches it before the first screen (main.jsx).
// - The choice belongs to the device: localStorage `<store key>-locale`, read before the first paint by
//   public/theme-boot.js (the page's lang and dir) and here. ?lang=ar (or he) in the address sets it too: a link can open
//   the app in Arabic, and "delete all" reloads with it, since it deletes the key with everything else (lib/wipe.js).
// - Numbers and dates are written per language (fmtNum, fmtDate). Arabic uses the digits 0-9, as the maths does in
//   Arab schools in Israel, and Arabic month and day names.
// - A value may be a plural set ({ one, two, few, many, other }), chosen by the number in `vars` (count, or the first
//   number); Arabic uses all six forms of Intl.PluralRules, Hebrew one, two and other.
import { useSyncExternalStore } from 'react';
import SHELL_HE from '@/locales/shell.he.json';

export const LOCALES = Object.freeze({
  he: Object.freeze({ id: 'he', dir: 'rtl', name: 'עברית', intl: 'he-IL' }),
  ar: Object.freeze({ id: 'ar', dir: 'rtl', name: 'العربية', intl: 'ar-IL-u-nu-latn' }),
});
export const DEFAULT_LOCALE = 'he';
export const LOCALE_KEY = `${import.meta.env.VITE_STORE_KEY || 'madregot'}-locale`;
export const LOCALE_EVENT = 'madregot-locale';

const isLocale = (x) => typeof x === 'string' && Object.hasOwn(LOCALES, x);

/** The catalogues that have arrived: Hebrew's first-load part always, the rest as their screens load. */
const messages = { he: { ...SHELL_HE }, ar: null };
let current = DEFAULT_LOCALE;
const subs = new Set();
const relocalizers = [];

/**
 * A module's constant with words in it, computed again in each language: `export let X = localized(() => value,
 * (v) => { X = v; })`. An import is a live binding, so every importer reads the new words; the screens are drawn again
 * after (App.jsx). Modules register in the order they load, so a constant built from another one is computed after it.
 */
/**
 * @template T
 * @param {() => T} make
 * @param {(v: T) => void} set
 * @returns {T}
 */
export function localized(make, set) {
  relocalizers.push(() => set(make()));
  return make();
}
const relocalize = () => { for (const f of relocalizers) { try { f(); } catch (e) { console.error('i18n: a constant could not be computed again', e); } } }; // eslint-disable-line no-console

/** Add a catalogue part (a screen's own words, when it loads). */
export function addMessages(locale, part) {
  if (!isLocale(locale)) return;
  messages[locale] = { ...(messages[locale] || {}), ...part };
}

/** Every Arabic part, in one go (they are small): what loadLocale('ar') waits for. */
export function importArabic() {
  return Promise.all([import('@/locales/shell.ar.json'), import('@/locales/settings.ar.json')])
    .then((parts) => parts.reduce((all, m) => ({ ...all, ...(m.default || m) }), {}));
}

let arabic = null;
/** Make sure a language's catalogue is here. Hebrew always is; Arabic is fetched once (and again after a failure). */
export function loadLocale(locale) {
  if (locale !== 'ar' || messages.ar) return Promise.resolve();
  if (!arabic) {
    arabic = importArabic().then((all) => { addMessages('ar', all); }, (e) => { arabic = null; throw e; });
  }
  return arabic;
}

export const locale = () => current;
export const localeInfo = (l = current) => LOCALES[l] || LOCALES[DEFAULT_LOCALE];
export const dirOf = (l = current) => localeInfo(l).dir;

/** The page says which language it is in, and which way it reads. */
function applyToPage(l) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.lang = l;
  html.dir = dirOf(l);
}

function readStored() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (isLocale(q)) return { value: q, fromLink: true };
  } catch { /* no address to read */ }
  try { const s = localStorage.getItem(LOCALE_KEY); if (isLocale(s)) return { value: s, fromLink: false }; } catch { /* storage blocked */ }
  return { value: DEFAULT_LOCALE, fromLink: false };
}

function remember(l) {
  try {
    if (l === DEFAULT_LOCALE) localStorage.removeItem(LOCALE_KEY);
    else localStorage.setItem(LOCALE_KEY, l);
  } catch { /* storage blocked: the choice holds until the page closes */ }
}

/**
 * Before the first screen (main.jsx): the stored or linked language, its catalogue fetched. A language that cannot be
 * fetched (offline before Arabic was ever kept) falls back to Hebrew for this visit and keeps the choice for the next.
 * A ?lang= in the address is taken once and leaves it.
 */
export async function initLocale() {
  const { value, fromLink } = readStored();
  if (fromLink) {
    remember(value);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('lang');
      window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
    } catch { /* the address keeps it: harmless */ }
  }
  try { await loadLocale(value); current = value; } catch { current = DEFAULT_LOCALE; }
  if (current !== DEFAULT_LOCALE) relocalize();
  applyToPage(current);
  return current;
}

/** Change the language (Welcome, Settings): its catalogue first, then every screen draws again in it. */
export async function setLocale(l) {
  if (!isLocale(l)) return current;
  await loadLocale(l);
  const changed = current !== l;
  current = l;
  remember(l);
  applyToPage(l);
  if (changed) relocalize();
  subs.forEach((f) => f());
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LOCALE_EVENT));
  return current;
}

/** The language on screen, kept up to date (App.jsx draws the screens again when it changes). */
export function useLocale() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, locale, () => DEFAULT_LOCALE);
}

const plurals = new Map();
function pluralOf(l, n) {
  let p = plurals.get(l);
  if (!p) { p = new Intl.PluralRules(localeInfo(l).intl); plurals.set(l, p); }
  return p.select(n);
}

/** The number a plural set is chosen by: `count`, or else the first number among the values. */
const countOf = (vars) => (typeof vars?.count === 'number' ? vars.count : Object.values(vars || {}).find((v) => typeof v === 'number'));

/** A plural set's form for this number (a missing form falls back to `other`). */
export function pluralForm(value, vars, l = current) {
  if (!value || typeof value !== 'object') return value;
  const n = countOf(vars);
  const cat = typeof n === 'number' ? pluralOf(l, n) : 'other';
  return value[cat] ?? value.other;
}

/** {name} in a value becomes vars.name, as written (numbers as plain digits, as the Hebrew screens always showed them). */
export const fill = (text, vars) => (vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) && vars[k] != null ? String(vars[k]) : m)) : String(text));

/**
 * The words for a key in the current language. A key the Arabic catalogue lacks falls back to Hebrew (the tests keep
 * the two catalogues equal, so this happens only while a screen's part is still loading); an unknown key shows as itself.
 */
/**
 * @param {string} key
 * @param {Record<string, unknown>} [vars]
 * @returns {string}
 */
export function t(key, vars) {
  const own = messages[current]?.[key];
  const value = own ?? messages[DEFAULT_LOCALE][key];
  if (value == null) {
    if (import.meta.env.DEV) console.warn(`i18n: no text for ${key}`); // eslint-disable-line no-console
    return key;
  }
  return fill(pluralForm(value, vars, own != null ? current : DEFAULT_LOCALE), vars);
}

/** Is there a text for this key (in the current language or in Hebrew)? */
export const hasText = (key) => messages[current]?.[key] != null || messages[DEFAULT_LOCALE][key] != null;

const numFormats = new Map();
/**
 * A number written in the current language (Intl.NumberFormat options).
 * @param {number} n
 * @param {Intl.NumberFormatOptions} [opts]
 */
export function fmtNum(n, opts = {}) {
  const k = `${current}|${JSON.stringify(opts)}`;
  let f = numFormats.get(k);
  if (!f) { f = new Intl.NumberFormat(localeInfo().intl, opts); numFormats.set(k, f); }
  return f.format(n);
}

/**
 * A date written in the current language (Intl.DateTimeFormat options). Accepts a Date, an ISO time or a day 'YYYY-MM-DD'.
 * @param {Date | string} d
 * @param {Intl.DateTimeFormatOptions} [opts]
 */
export function fmtDate(d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const date = d instanceof Date ? d : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T12:00:00` : d);
  if (Number.isNaN(date.getTime())) return '';
  try { return new Intl.DateTimeFormat(localeInfo().intl, opts).format(date); } catch { return ''; }
}

/** For tests: start again from Hebrew (the catalogues already fetched stay). */
export function resetLocaleForTests(l = DEFAULT_LOCALE) { const changed = current !== l; current = l; if (changed) relocalize(); }
