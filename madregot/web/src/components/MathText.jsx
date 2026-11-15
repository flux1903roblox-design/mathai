// Maths in the app's text: $...$ inside Hebrew, drawn by KaTeX. No markdown here: AI answers and the legal pages use
// RichText (components/RichText.jsx), whose markdown file loads only when such text is shown (DURABLE-11).
import { memo, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';

// KaTeX and its stylesheet (components/katex.js) are their own file, fetched as the app starts but never waited for by
// the first screen: until it is here an expression shows as plain words (texText), then every expression on screen
// draws itself. A screen opened straight on a lesson or a stair waits for it with its topic (lib/bootTopics.js).
let katex = null;
let loading = null;
const listeners = new Set();
/** Fetch KaTeX (once); resolves when expressions can be drawn. */
export function loadKatex() {
  if (!loading) {
    const p = import('./katex.js').then((m) => { katex = m.default; listeners.forEach((f) => f()); return katex; });
    p.catch(() => { if (loading === p) loading = null; }); // offline before it was ever kept: asked again next time
    loading = p;
  }
  return loading;
}
const subscribe = (f) => { listeners.add(f); return () => { listeners.delete(f); }; };
const drawnNow = () => !!katex;
/** Is KaTeX here? Re-renders when it arrives. */
export const useKatex = () => useSyncExternalStore(subscribe, drawnNow, drawnNow);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/**
 * One TeX expression as HTML. When KaTeX cannot render it, the TeX is shown as text, escaped: it never reaches the
 * page as HTML (a student's help note goes through here on the teacher's board). Before KaTeX has loaded: the
 * expression in plain words, escaped too.
 */
export const renderTex = (tex, displayMode = false) => {
  if (!katex) { loadKatex().catch(() => {}); return `<span class="tex-plain" dir="ltr">${escapeHtml(texText(tex))}</span>`; }
  try { return katex.renderToString(String(tex ?? ''), { displayMode, throwOnError: false, strict: 'ignore' }); } catch { return escapeHtml(tex); }
};

const RELATION = { '<': 'קטן מ־', '>': 'גדול מ־', '=': 'שווה ל־', '\\le': 'קטן או שווה ל־', '\\ge': 'גדול או שווה ל־', '\\ne': 'שונה מ־' };

/**
 * A TeX expression as plain text, for a screen-reader label where the rendered maths alone gives a
 * control no name (a multiple-choice answer). A lone comparison sign is said in words, and so are the absolute value
 * (|−9| is "הערך המוחלט של -9", CLASSROOM-1) and the class's angle sign (∢BOC is "זווית BOC", CLASSROOM-9): a
 * screen reader says the bars and ∢ as "vertical line" and "spherical angle". The geometry relations are said in words
 * for the same reason (≅ "חופף ל־", ∼ "דומה ל־", ∥ "מקביל ל־", ⊥ "מאונך ל־", GEOM-1.4). Any other command is turned into
 * its sign; one this does not know is left as its name, and components/choiceNames.test.js finds it in any choice.
 */
export function texText(tex) {
  const t = String(tex ?? '').trim();
  if (RELATION[t]) return RELATION[t];
  return t
    // a table (array) is read row by row; when its first column is a heading column ({c|ccc}), each row says its
    // heading first: "x: 1, 2, 3; y: 4, 5, 6"
    .replace(/\\begin\{array\}\{([^}]*)\}([\s\S]*?)\\end\{array\}/g, (_, spec, body) => {
      const headed = /^[lcr]\|/.test(spec.trim());
      const rows = body.replace(/\\hline/g, '').split('\\\\').map((row) => row.split('&').map((c) => c.trim())).filter((cells) => cells.some(Boolean));
      return ` ${rows.map(([head, ...cells]) => (headed && head && cells.length ? `${head}: ${cells.join(', ')}` : [head, ...cells].filter(Boolean).join(', '))).join('; ')} `;
    })
    .replace(/\\lvert(?![a-zA-Z])\s*([^]*?)\s*\\rvert(?![a-zA-Z])/g, 'הערך המוחלט של $1').replace(/\\[lr]vert(?![a-zA-Z])/g, '|')
    .replace(/\\(?:sphericalangle|angle|measuredangle)(?![a-zA-Z])\s*/g, 'זווית ').replace(/\\triangle(?![a-zA-Z])\s*/g, 'משולש ')
    .replace(/\\(boxed|underline|underbrace|overbrace|mathrm|mathbf)(?![a-zA-Z])/g, '').replace(/\\q?quad(?![a-zA-Z])/g, ' ')
    .replace(/\\alpha(?![a-zA-Z])/g, 'α').replace(/\\beta(?![a-zA-Z])/g, 'β').replace(/\\gamma(?![a-zA-Z])/g, 'γ').replace(/\\delta(?![a-zA-Z])/g, 'δ')
    .replace(/\\approx(?![a-zA-Z])/g, '≈').replace(/\\to(?![a-zA-Z])/g, '→').replace(/\\(?:ldots|cdots|dots)(?![a-zA-Z])/g, '…')
    .replace(/\\pm(?![a-zA-Z])/g, '±').replace(/\\%/g, '%')
    // a system (cases, aligned) is read row by row
    .replace(/\\(begin|end)\{[a-z]+\}/g, ' ').replace(/\\\\/g, ', ').replace(/&/g, '')
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√$1')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\^\{?\\circ\}?/g, '°').replace(/\\(cdot|times)/g, '×').replace(/\\div/g, ':').replace(/\\circ/g, '°')
    .replace(/\\leq?(?![a-z])/g, '≤').replace(/\\geq?(?![a-z])/g, '≥').replace(/\\neq?(?![a-z])/g, '≠')
    .replace(/\^\{?2\}?/g, '²').replace(/\\pi(?![a-zA-Z])/g, 'π')
    // the class's geometry relations (GEOM-1.4), said in words as the angle and the triangle are above: a screen reader
    // has no Hebrew name for ≅, ∼, ∥ or ⊥ ("משולש ABC חופף ל־משולש KML")
    .replace(/\s*\\cong(?![a-zA-Z])\s*/g, ' חופף ל־').replace(/\s*\\sim(?![a-zA-Z])\s*/g, ' דומה ל־')
    .replace(/\s*\\parallel(?![a-zA-Z])\s*/g, ' מקביל ל־').replace(/\s*\\perp(?![a-zA-Z])\s*/g, ' מאונך ל־')
    .replace(/\\(left|right)|\\[,;! ]/g, ' ')
    .replace(/[{}]/g, '').replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

/** One TeX expression. */
export const Tex = memo(function Tex({ tex, display = false, className }) {
  const drawn = useKatex();
  const html = useMemo(() => renderTex(tex, display), [tex, display, drawn]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

/**
 * A line of text with maths that must fit its box (a step of a solution, ui.jsx StairStep): inline maths never wraps
 * (tokens.css), so an expression wider than the box would scroll sideways inside it, and its start would look cut off.
 * When it does not fit, the maths of the line is set smaller until it fits, never below 15px, the size of a hint's
 * text; a line that fits is left alone. A line that still does not fit at 15px is too long for a phone and is split
 * where it is written (e2e/solutions-fit.spec.js measures every generated solution at 320). The box's own width is
 * read from its step (the parent), which does not change with the maths, so setting the size never measures again.
 */
export function useFitLine(ref, text) {
  const drawn = useKatex(); // measured again once KaTeX has drawn it
  useLayoutEffect(() => {
    const el = ref.current; const frame = el?.parentElement;
    if (!el || !frame) return undefined;
    let width = -1;
    const fit = () => {
      if (frame.clientWidth === width) return;
      width = frame.clientWidth;
      const boxes = [...el.querySelectorAll('.katex')];
      boxes.forEach((b) => { b.style.transition = 'none'; b.style.fontSize = ''; });
      if (!boxes.length || el.scrollWidth - el.clientWidth <= 1) return;
      const base = boxes.map((b) => parseFloat(getComputedStyle(b).fontSize)); const parent = boxes.map((b) => parseFloat(getComputedStyle(b.parentElement).fontSize));
      if (!(base[0] > 0)) return;
      const floor = Math.min(1, 15 / base[0]);
      let scale = 1;
      for (let k = 0; k < 4 && el.scrollWidth - el.clientWidth > 1 && scale > floor; k += 1) {
        scale = Math.max(floor, scale * (el.clientWidth / el.scrollWidth) * 0.98);
        boxes.forEach((b, i) => { if (base[i] > 0 && parent[i] > 0) b.style.fontSize = `${(base[i] * scale) / parent[i]}em`; });
      }
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(frame);
    // the maths font may arrive after the first layout and widen the line: measure again then
    const refit = () => { if (el.isConnected) { width = -1; fit(); } };
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    fonts?.addEventListener?.('loadingdone', refit);
    fonts?.ready?.then(refit);
    return () => { ro?.disconnect(); fonts?.removeEventListener?.('loadingdone', refit); };
  }, [text, drawn]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Display maths, as large as it fits: a long expression (3(x - 2) - (x + 4) = ?) is set smaller until it fits
 * the width, down to 60% of the size, instead of scrolling sideways. A display that fits is left alone. A large display
 * (an exercise's question) may go further, down to the size of the text around it (15px), so the class's chain of five
 * bracketed numbers, (+3) + (-4) + (+7) - (-10) - (+7), fits a 320 phone in one line (CLASSROOM-2). One still too wide
 * at its smallest size breaks onto a second line after an = sign or an operator (stage 2).
 * The question of an exercise (className 'qdisplay') and the maths of a teaching step ('lm-expr') use it.
 */
export function FitDisplay({ tex, className = 'qdisplay' }) {
  const ref = useRef(null);
  const drawn = useKatex(); // measured again once KaTeX has drawn it
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    let width = -1;
    const fit = () => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      // the rendered maths (KaTeX's own block) says how much too wide it is; it is scaled in em of the panel, so
      // measuring again never starts from an already smaller size. The size is measured at once: a transition on it
      // (reduced motion still leaves a tiny one) would report the old size, and the base is read, not assumed (KaTeX
      // sets 1em in an exercise's question, 1.08em elsewhere).
      const box = el.querySelector('.katex');
      if (!box) return;
      box.style.transition = 'none';
      box.style.fontSize = '';
      box.classList.remove('fit-wrap');
      const base = parseFloat(getComputedStyle(box).fontSize); const parent = parseFloat(getComputedStyle(box.parentElement).fontSize);
      const floor = Math.min(0.6, 15 / base);
      if (box.scrollWidth - box.clientWidth > 1 && base > 0 && parent > 0) box.style.fontSize = `${(base * Math.max(floor, (box.clientWidth / box.scrollWidth) * 0.97)) / parent}em`;
      // still too wide at its smallest size: the display breaks after its = signs and operators (styles/tokens.css), so
      // its end is never hidden in a scroll box (a long rule should be written on stacked lines instead; this is the
      // safety net)
      if (box.scrollWidth - box.clientWidth > 1) box.classList.add('fit-wrap');
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    // the maths font may arrive after the first layout and widen the line: measure again then
    const refit = () => { if (el.isConnected) { width = -1; fit(); } };
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    fonts?.addEventListener?.('loadingdone', refit);
    fonts?.ready?.then(refit);
    return () => { ro?.disconnect(); fonts?.removeEventListener?.('loadingdone', refit); };
  }, [tex, drawn]);
  return <div className={className} ref={ref}><Tex tex={tex} display /></div>;
}

// An inline $…$ that is only a number: -3, (-4), 2.5, 35^\circ (STUDENT-9 §3).
const BARE_NUMBER = /^\(?[-−+]?\d+(?:[.,]\d+)?\)?(?:\^\\circ|\^\{\\circ\})?$/;

/**
 * The text of an inline TeX that is only a number, set like the sentence around it: a real minus sign (U+2212) and
 * a degree sign. Null for anything else (a letter, an operator, a fraction), which stays KaTeX.
 */
export function plainNumber(tex) {
  const t = String(tex ?? '').trim();
  if (!BARE_NUMBER.test(t)) return null;
  return t.replace(/-/g, '\u2212').replace(/\^\{?\\circ\}?$/, '°');
}

/**
 * Hebrew text with inline math between $...$ (generator output only). Maths in a sentence uses the sentence's digits:
 * a bare number is plain text in Rubik (bdi.num, left to right, tabular); other flat inline maths ($x = -3$, $3^2 + 4^2$)
 * is set in Rubik too, digits, operators and letters (.mt-ui, canon.css: PRODUCT2-41); maths laid out in rows (a fraction,
 * a root) keeps KaTeX's layout and fonts, with its digits in Rubik (.mt-inline). Display maths is KaTeX's own.
 */
export const MathText = memo(function MathText({ text, as: As = 'span', className }) {
  const parts = String(text ?? '').split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <As className={className}>
      {parts.map((p, i) => {
        if (!(p.startsWith('$') && p.endsWith('$') && p.length > 2)) return <span key={i}>{p}</span>;
        const tex = p.slice(1, -1);
        const num = plainNumber(tex);
        return num === null ? <Tex key={i} tex={tex} className={STACKED.test(tex) ? 'mt-inline' : 'mt-inline mt-ui'} /> : <bdi key={i} className="num" dir="ltr">{num}</bdi>;
      })}
    </As>
  );
});

/** TeX that is laid out in rows (a fraction, a root, a matrix or a system): it keeps KaTeX's own fonts in a sentence. */
const STACKED = /\\(?:[dt]?frac|sqrt|over\b|binom|begin)/;

/** Text with $...$ maths as plain words, for an accessible name (a button whose text is only maths). */
export const mathPlain = (text) => String(text || '').replace(/\$([^$]+)\$/g, (_, t) => texText(t)).replace(/\s+/g, ' ').trim();

/**
 * Text with $...$ maths split after its first sentence: [first, rest] (rest '' when there is one sentence). A sentence
 * ends at '.', '?' or '!' outside the maths, followed by a space; a decimal point inside $…$ never ends one.
 */
export function splitFirstSentence(text) {
  const t = String(text ?? '').trim();
  let math = false;
  for (let k = 0; k < t.length; k += 1) {
    const c = t[k];
    if (c === '$') math = !math;
    else if (!math && (c === '.' || c === '?' || c === '!') && /\s/.test(t[k + 1] || '')) {
      return [t.slice(0, k + 1), t.slice(k + 1).trim()];
    }
  }
  return [t, ''];
}
