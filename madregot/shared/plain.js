// Maths as plain Unicode text, for places with no KaTeX: the parent's report (the child's page, the /r link, /parents
// and the weekly email, PARENTS-1/2/5/7), and the teacher's CSV (TEACHER-7, with { isolate: false }). Plain JS, no
// imports, the same on the web and in the Worker.
//
// Rules (PARENTS-8): `$` goes; ^\circ → °, \cdot → ·, \times → ×, \le → ≤, \ge → ≥, \ne and \neq → ≠; ^2 → ², ^3 → ³,
// _1 → ₁, _2 → ₂; \frac{a}{b} → a/b; \sqrt{x} → √x; inside maths a minus right before a digit or "(" becomes the
// minus sign U+2212; braces go; TeX's small spaces become a space. Each maths run is wrapped in U+2066 (left-to-right
// isolate) … U+2069 (pop) when `isolate` is true, so Hebrew around it never reorders it. Anything else that still
// looks like a TeX command is left as it is, visible: web/src/learn/report.test.ts runs every misconception title
// through this and fails on a "\", a "$" or a brace, so a new title with TeX this cannot read is caught there.

const LRI = '⁦';
const PDI = '⁩';
const MINUS = '−';

/** One maths run (the text between two `$`), as plain text. */
function mathRun(tex) {
  let s = tex;
  // \frac and \sqrt first, innermost first, while their braces are still there
  for (let i = 0; i < 8; i += 1) {
    const before = s;
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√$1');
    if (s === before) break;
  }
  s = s
    .replace(/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '°')
    .replace(/\\circ(?![a-zA-Z])/g, '°')
    .replace(/\\cdot(?![a-zA-Z])/g, '·')
    .replace(/\\times(?![a-zA-Z])/g, '×')
    .replace(/\\(?:le|leq)(?![a-zA-Z])/g, '≤')
    .replace(/\\(?:ge|geq)(?![a-zA-Z])/g, '≥')
    .replace(/\\(?:ne|neq)(?![a-zA-Z])/g, '≠')
    .replace(/\^\s*(?:\{\s*2\s*\}|2(?!\d))/g, '²')
    .replace(/\^\s*(?:\{\s*3\s*\}|3(?!\d))/g, '³')
    .replace(/_\s*(?:\{\s*1\s*\}|1(?!\d))/g, '₁')
    .replace(/_\s*(?:\{\s*2\s*\}|2(?!\d))/g, '₂')
    .replace(/\\(?:text|mathrm|mathit)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\[,;:!]|\\ /g, ' ')
    .replace(/\\%/g, '%')
    .replace(/[{}]/g, '')
    .replace(/-(?=[\d(])/g, MINUS);
  return s.replace(/ {2,}/g, ' ').trim();
}

/**
 * `s` with its `$…$` maths as plain Unicode text.
 * @param {string} s
 * @param {{ isolate?: boolean }} [opts]  isolate (default true): wrap each maths run in U+2066 … U+2069
 * @returns {string}
 */
export function texToPlain(s, { isolate = true } = {}) {
  if (typeof s !== 'string' || !s) return '';
  const parts = s.split('$');
  // an odd count of `$` leaves the last run unclosed: it is still read as maths
  return parts.map((p, i) => {
    if (i % 2 === 0) return p;
    const m = mathRun(p);
    return isolate && m ? `${LRI}${m}${PDI}` : m;
  }).join('');
}
