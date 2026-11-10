// Prices as the parents page shows them: integer agorot from the server, written as shekels. A whole amount has no
// decimals (₪249); any other has two (₪29.90). Only the parents' pages use this: no child screen shows a price.

/** 2990 → '₪29.90'; 24900 → '₪249'. */
export function formatAgorot(agorot) {
  const a = Math.round(Number(agorot) || 0);
  const shekels = Math.floor(Math.abs(a) / 100);
  const rest = Math.abs(a) % 100;
  return `${a < 0 ? '-' : ''}₪${shekels}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

/** The VAT inside a price that includes 18% VAT, in whole agorot (2990 → 456). Exempt dealers charge none. */
export const vatOf = (agorot, mode = 'included') => (mode === 'exempt' ? 0 : Math.round((Number(agorot) || 0) * 18 / 118));

/** The words after a price: 'כולל מע״מ', or for an exempt dealer 'המחיר סופי'. */
export const vatLine = (mode) => (mode === 'exempt' ? 'המחיר סופי' : 'כולל מע״מ');

/** A yearly price per month, rounded down to whole agorot: 24900 → '₪20.75'. */
export const perMonth = (yearAgorot) => formatAgorot(Math.floor((Number(yearAgorot) || 0) / 12));

/** An ISO time as the date people read: 10.12.2026 (Jerusalem). */
export function dateNum(iso) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jerusalem' }).formatToParts(new Date(iso));
    const v = (t) => p.find((x) => x.type === t)?.value || '';
    return `${v('day')}.${v('month')}.${v('year')}`;
  } catch { return ''; }
}

/** An ISO time as words: 10 בדצמבר 2026 (Jerusalem). */
export function dateWords(iso) {
  try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }); } catch { return ''; }
}
