import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';
import { Pencil, Eraser, Undo2, Trash2, Plus } from 'lucide-react';
import { fitImage } from '@/lib/fitImage.js';
import '@/styles/lazy/notebook.css'; // this screen's own rules, loaded with it (STUDENT-15)

// A squared notebook page (like an Israeli math notebook: 5mm squares, red
// margin on the right) that students write their working on with a finger,
// a stylus or a mouse. Strokes are kept as data so the page survives
// re-renders and can be exported as an image for the AI or the teacher.
const SQUARE = 20;
// the page stays light like real squared paper, in both themes, so its colours are its own
const INK = '#1c2f7a'; // colour-ok: notebook page
const GRID = '#c9dcee'; // colour-ok: notebook page
const MARGIN = '#e48a9b'; // colour-ok: notebook page

function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  for (let x = w % SQUARE; x <= w; x += SQUARE) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
  for (let y = SQUARE; y <= h; y += SQUARE) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
  ctx.strokeStyle = MARGIN; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(w - 2 * SQUARE + 0.5, 0); ctx.lineTo(w - 2 * SQUARE + 0.5, h); ctx.stroke();
  ctx.restore();
}

function drawStroke(ctx, s) {
  const pts = s.points; if (!pts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = s.tool === 'erase' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const base = s.tool === 'erase' ? 18 : 2.6;
  if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], base / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0, p0] = pts[i - 1]; const [x1, y1, p1] = pts[i];
      ctx.lineWidth = s.tool === 'erase' ? base : base * (0.65 + 0.7 * ((p0 + p1) / 2));
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }
  ctx.restore();
}

const Notebook = forwardRef(function Notebook({ strokes, onStrokes, height, onGrow }, ref) {
  const wrapRef = useRef(null); const canvasRef = useRef(null);
  const [width, setWidth] = useState(0);
  const live = useRef(null); const penSeen = useRef(false);
  const [tool, setTool] = useState('pen');

  useEffect(() => {
    const el = wrapRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const redraw = useCallback(() => {
    const c = canvasRef.current; if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    strokes.forEach((s) => drawStroke(ctx, s));
  }, [strokes, width, height]);
  useEffect(() => { redraw(); }, [redraw]);

  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pressure && e.pointerType === 'pen' ? e.pressure : 0.5]; };
  const down = (e) => {
    if (e.pointerType === 'pen') penSeen.current = true;
    if (e.pointerType === 'touch' && penSeen.current) return; // palm rejection once a stylus is used
    e.preventDefault(); canvasRef.current.setPointerCapture(e.pointerId);
    live.current = { tool, points: [pos(e)] };
    const ctx = canvasRef.current.getContext('2d'); drawStroke(ctx, live.current);
  };
  const move = (e) => {
    if (!live.current) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const ctx = canvasRef.current.getContext('2d');
    for (const ev of events) {
      const p = pos(ev); const pts = live.current.points; pts.push(p);
      drawStroke(ctx, { tool: live.current.tool, points: pts.slice(-2) });
    }
  };
  const up = () => { if (!live.current) return; const s = live.current; live.current = null; onStrokes([...strokes, s]); };

  useImperativeHandle(ref, () => ({
    /** The page as a JPEG data URL: white paper, grid and ink, trimmed below the last line written. */
    /** The page as a JPEG data URL; with `max`, encoded smaller until it is at most that long (null if it never fits). */
    toImage({ max = Infinity } = {}) {
      if (!strokes.length || !width) return null;
      const maxY = Math.max(...strokes.flatMap((s) => s.points.map((p) => p[1])));
      const h = Math.min(height, Math.ceil((maxY + 2 * SQUARE) / SQUARE) * SQUARE);
      const base = Math.min(2, 1400 / width);
      const encode = (factor, quality) => {
        const scale = base * factor;
        const out = document.createElement('canvas'); out.width = Math.round(width * scale); out.height = Math.round(h * scale);
        const ctx = out.getContext('2d'); ctx.scale(scale, scale);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, h); drawGrid(ctx, width, h); // colour-ok: the exported page is white paper
        const ink = document.createElement('canvas'); ink.width = out.width; ink.height = out.height;
        const ictx = ink.getContext('2d'); ictx.scale(scale, scale); strokes.forEach((s) => drawStroke(ictx, s));
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ink, 0, 0);
        return out.toDataURL('image/jpeg', quality);
      };
      return fitImage(encode, max);
    },
  }), [strokes, width, height]);

  return (
    <div className="notebook">
      <div className="nb-tools" role="toolbar" aria-label="כלי כתיבה">
        <button type="button" className={clsx('nb-tool', tool === 'pen' && 'on')} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}><Pencil size={18} aria-hidden="true" />עט</button>
        <button type="button" className={clsx('nb-tool', tool === 'erase' && 'on')} aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}><Eraser size={18} aria-hidden="true" />מחק</button>
        <button type="button" className="nb-tool" onClick={() => onStrokes(strokes.slice(0, -1))} disabled={!strokes.length}><Undo2 size={18} aria-hidden="true" />בטל</button>
        <button type="button" className="nb-tool" onClick={() => onStrokes([])} disabled={!strokes.length}><Trash2 size={18} aria-hidden="true" />נקה</button>
      </div>
      <div ref={wrapRef} className="nb-page" style={{ height, '--sq': `${SQUARE}px` }}>
        <canvas ref={canvasRef} className={clsx('nb-canvas', tool === 'erase' && 'erasing')} style={{ width: '100%', height }}
          role="img" aria-label="דף מחברת לכתיבת הפתרון. כתבו באצבע, בעט או בעכבר."
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={(e) => { if (e.buttons === 0) up(); }} />
      </div>
      <button type="button" className="nb-more" onClick={onGrow}><Plus size={16} aria-hidden="true" />עוד שורות</button>
    </div>
  );
});

export default Notebook;
