// Answer parsing/matching shared by lessons and AI practice.

// "3", "-2.5", "0,5", "1/2", "70°" → number (null if it isn't one)
export function parseNum(text) {
  const s = String(text || '').replace(/[\s°$]/g, '').replace(',', '.').replace(/[−–]/g, '-');
  if (!s) return null;
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}

const clean = (s) => String(s || '').replace(/\$/g, '').replace(/\s+/g, '').replace(/[−–]/g, '-').toLowerCase();
const rhs = (s) => (s.includes('=') ? s.split('=').pop() : s);
const loose = (s) => String(s || '').replace(/[^\d.,\-/a-zA-Zα-ω]/gi, '').toLowerCase();

// Forgiving comparison for free-text answers: "x = 3" ≡ "3", "0.5" ≡ "1/2", small rounding differences OK.
export function answersMatch(given, expected) {
  const a = clean(given);
  const b = clean(expected);
  if (!a) return false;
  if (a === b || rhs(a) === rhs(b)) return true;
  const na = parseNum(rhs(a));
  const nb = parseNum(rhs(b));
  if (na != null && nb != null) return Math.abs(na - nb) <= Math.max(1e-9, Math.abs(nb) * 0.005);
  return loose(given) === loose(expected);
}
