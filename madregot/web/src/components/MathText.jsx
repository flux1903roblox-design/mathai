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
 * control no name (a multiple-choice answer). A lone comparison sign is said in words.
 */
export function texText(tex) {
  const t = String(tex ?? '').trim();
  if (RELATION[t]) return RELATION[t];
  return t
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√$1')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\^\{?\\circ\}?/g, '°').replace(/\\(cdot|times)/g, '×').replace(/\\div/g, ':').replace(/\\circ/g, '°')
    .replace(/\\leq?(?![a-z])/g, '≤').replace(/\\geq?(?![a-z])/g, '≥').replace(/\\neq?(?![a-z])/g, '≠')
    .replace(/\^\{?2\}?/g, '²')
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
 * Display maths, as large as it fits: a long expression (3(x - 2) - (x + 4) = ?) is set smaller until it fits
 * the width, down to 60% of the size, instead of scrolling sideways. A display that fits is left alone.
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
      const base = parseFloat(getComputedStyle(box).fontSize); const parent = parseFloat(getComputedStyle(box.parentElement).fontSize);
      if (box.scrollWidth - box.clientWidth > 1 && base > 0 && parent > 0) box.style.fontSize = `${(base * Math.max(0.6, (box.clientWidth / box.scrollWidth) * 0.97)) / parent}em`;
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

/** Hebrew text with inline math between $...$ (generator output only). */
export const MathText = memo(function MathText({ text, as: As = 'span', className }) {
  const parts = String(text ?? '').split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <As className={className}>
      {parts.map((p, i) => (p.startsWith('$') && p.endsWith('$') && p.length > 2
        ? <Tex key={i} tex={p.slice(1, -1)} />
        : <span key={i}>{p}</span>))}
    </As>
  );
});

/** Text with $...$ maths as plain words, for an accessible name (a button whose text is only maths). */
export const mathPlain = (text) => String(text || '').replace(/\$([^$]+)\$/g, (_, t) => texText(t)).replace(/\s+/g, ' ').trim();
