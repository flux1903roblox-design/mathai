// Links into the app from the landing pages (STUDENT-13): the parents' page opens #/?next=/rescue&src=mivchan, the
// schools' page #/?start=teacher&src=pilot. The query is read from the hash route, so it works on any host and path.
// - next: where a new student lands after the first questions (Welcome), or where a returning student goes at once;
//   only the places below, so a link can never send anyone elsewhere.
// - start=teacher (role=teacher is the same): the teacher's way in opens at once. next=/teacher means the same.
// - src: which page the visit came from; Welcome counts welcome_from_landing once for the two pages (STUDENT-14).
import { count } from './metrics.js';

export const NEXT_ALLOWED = ['/rescue', '/teacher', '/parents', '/quests'];
export const LANDING_SOURCES = ['mivchan', 'pilot'];

/** { next, teacher, src } from a route's search ('?next=/rescue&src=mivchan'); anything not on the lists is null. */
export function deepLink(search) {
  let q;
  try { q = new URLSearchParams(search || ''); } catch { q = new URLSearchParams(); }
  const raw = q.get('next');
  const next = NEXT_ALLOWED.includes(raw) ? raw : null;
  const teacher = q.get('start') === 'teacher' || q.get('role') === 'teacher' || next === '/teacher';
  const src = q.get('src');
  return { next: teacher ? null : next, teacher, src: LANDING_SOURCES.includes(src) ? src : null };
}

let counted = false;
/** welcome_from_landing, at most once per page load. */
export function countFromLanding(link) {
  if (!link?.src || counted) return false;
  counted = true;
  count('welcome_from_landing');
  return true;
}
/** For tests: forget that this load already counted. */
export const resetLandingCount = () => { counted = false; };
