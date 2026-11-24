// When something happened, in the short words the app uses for it (PARENTS-4, PARENTS-5): "היום ב־14:05",
// "אתמול ב־20:10" or "9.11". Local time on the device that shows it; no time-zone names, no seconds.
import { today, dayBefore } from './days.js';

const pad = (n) => String(n).padStart(2, '0');
/** '14:05' in this device's time. */
export const clockOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * An ISO time as "היום ב־14:05", "אתמול ב־20:10" (only with `yesterday`) or "9.11". '' for no time or a broken one.
 * `now` is for tests.
 */
export function whenText(iso, { now = new Date(), yesterday = true } = {}) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const day = today(d);
  if (day === today(now)) return `היום ב־${clockOf(d)}`;
  if (yesterday && day === dayBefore(today(now))) return `אתמול ב־${clockOf(d)}`;
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
