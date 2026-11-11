// PhotoPrep (trust spec TRUST-5 §2, Appendix E.9): every exam page and notebook photo passes this step on the device
// before it can be sent. The whole page is shown fitted to the screen. The top band (by default 15% of an exam's first
// page, nothing elsewhere) is shaded in the brand blue and is cut off, not sent; the child drags its line, or moves it
// with the arrow keys. "השחרה" draws solid black boxes (never blur, which can be undone for text); "הוספת מלבן" places
// one that the arrow keys move and Shift with the arrows resizes, for keyboard and switch users; "ביטול האחרון" takes
// the last one away. The output is the cropped, blacked-out page re-encoded as a JPEG, so nothing of the original file
// leaves the device. prepImage() is the pure part, tested on its own.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Brush, Camera, SquarePlus, Undo2 } from 'lucide-react';
import { Button, Sheet } from './ui.jsx';

/** The working size: the long side of the canvas, as the exam check always sent it. */
export const PREP_MAX = 1800;
export const PREP_QUALITY = 0.85;
/** The band cut off the first page of an exam by default (its name, ID, class and school line). */
export const EXAM_HEADER = 0.15;
/** At most this much of the top can be cut: the rest of the page must still be there to check. */
export const CUT_MAX = 0.6;
const STEP = 0.02; // a box moves or grows by 2% of the page per key press
const MIN_BOX = 0.03; // a drawn box smaller than this (a tap) is not a box

export const PREP_COPY = {
  title: 'מסתירים פרטים אישיים',
  lead: 'השחירו כל שם, תעודת זהות או ציון שנשארו בדף.',
  band: 'השורה הזו לא תישלח',
  cutLabel: 'כמה לחתוך מלמעלה',
  cutHint: 'גררו את הקו כדי לבחור כמה מהחלק העליון לחתוך. במקלדת: חצים למעלה ולמטה.',
  draw: 'השחרה',
  add: 'הוספת מלבן',
  undo: 'ביטול האחרון',
  boxHint: 'חצים מזיזים את המלבן, Shift עם חצים משנה את הגודל, Delete מוחק אותו.',
  drawing: 'גררו על הדף כדי להשחיר.',
  done: 'סיימתי, אין בדף פרטים אישיים',
  retake: 'צילום מחדש',
  loading: 'פותחים את התמונה…',
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 1000) / 1000;

/**
 * The pure step: an ImageData-like { width, height, data } (RGBA bytes), `cropTop` the share of the height cut off the
 * top (0-1), and `boxes` [{ x, y, w, h }] as shares of the whole picture. → a new { width, height, data }: the rows
 * under the cut only, with every pixel of every box set to solid black. A box is widened to whole pixels, never
 * narrowed, so nothing at its edge survives. The input is not changed.
 */
export function prepImage(img, { cropTop = 0, boxes = [] } = {}) {
  const { width: W, height: H, data } = img;
  const top = clamp(Math.round(clamp(Number(cropTop) || 0, 0, 1) * H), 0, H - 1);
  const outH = H - top;
  const out = new Uint8ClampedArray(W * outH * 4);
  out.set(data.subarray(top * W * 4, H * W * 4));
  for (const b of boxes || []) {
    if (!b || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) continue;
    const x0 = clamp(Math.floor(b.x * W), 0, W); const x1 = clamp(Math.ceil((b.x + b.w) * W), 0, W);
    const y0 = clamp(Math.floor(b.y * H) - top, 0, outH); const y1 = clamp(Math.ceil((b.y + b.h) * H) - top, 0, outH);
    for (let y = y0; y < y1; y += 1) {
      for (let i = (y * W + x0) * 4, end = (y * W + x1) * 4; i < end; i += 4) {
        out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 255;
      }
    }
  }
  return { width: W, height: outH, data: out };
}

/** The size a w×h picture is shown at inside a bw×bh area: all of it visible, nothing scrolled. */
export function fitSize(w, h, bw, bh) {
  const s = Math.min(bw / w, bh / h);
  return { width: Math.max(1, Math.floor(w * s)), height: Math.max(1, Math.floor(h * s)) };
}

/** A box kept inside the page, at least MIN_BOX on each side. */
export function keepBox(b) {
  const w = clamp(b.w, MIN_BOX, 1); const h = clamp(b.h, MIN_BOX, 1);
  return { x: round(clamp(b.x, 0, 1 - w)), y: round(clamp(b.y, 0, 1 - h)), w: round(w), h: round(h) };
}

/** A picked file drawn on a white canvas at its working size (≤ PREP_MAX on the long side). The file's URL is revoked. */
async function loadWork(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, PREP_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // colour-ok: a JPEG has no alpha, so the canvas is filled white before the photo
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

/** The page as it is sent: cut, blacked out, and re-encoded. */
function encode(work, cut, boxes) {
  const src = work.getContext('2d').getImageData(0, 0, work.width, work.height);
  const out = prepImage(src, { cropTop: cut, boxes });
  const c = document.createElement('canvas'); c.width = out.width; c.height = out.height;
  c.getContext('2d').putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
  // The canvas re-encodes the pixels, so nothing of the original file comes along: its EXIF data (where and when the
  // photo was taken, the phone) is gone, and so is everything under the cut and under the black boxes.
  return c.toDataURL('image/jpeg', PREP_QUALITY);
}

/**
 * `file`: the picked image (null: closed). `crop`: the default cut for this page. `onDone({ data, prep })`: the JPEG data
 * URL and { crop, boxes } for the request; `onRetake()` runs inside the tap, so it can open the camera again;
 * `onCancel()`: closed, nothing kept; `onError()`: the file is not a picture this browser can open.
 */
export default function PhotoPrep({ file, crop = 0, onDone, onRetake, onCancel, onError }) {
  const [work, setWork] = useState(null);
  const [cut, setCut] = useState(crop);
  const [boxes, setBoxes] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [stage, setStage] = useState(null);
  const [frame, setFrame] = useState(null);
  const [focusBox, setFocusBox] = useState(null);
  const frameRef = useRef(null);
  const addRef = useRef(null);
  const boxRefs = useRef([]);
  const drag = useRef(null);

  // a new file: everything starts again, with this page's default cut
  useEffect(() => {
    if (!file) return undefined;
    let live = true;
    setWork(null); setCut(crop); setBoxes([]); setDrawing(false); setDraft(null);
    loadWork(file).then((c) => { if (live) setWork(c); }, () => { if (live) onError?.(); });
    return () => { live = false; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  // the whole page fitted to the space the screen leaves for it
  useLayoutEffect(() => {
    if (!stage || !work) return undefined;
    const fit = () => {
      const r = stage.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFrame(fitSize(work.width, work.height, r.width, r.height));
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    return () => ro?.disconnect();
  }, [stage, work]);

  const paint = useCallback((el) => {
    if (!el || !work) return;
    el.width = work.width; el.height = work.height;
    el.getContext('2d').drawImage(work, 0, 0);
  }, [work]);

  useEffect(() => {
    if (focusBox == null) return;
    boxRefs.current[focusBox]?.focus();
    setFocusBox(null);
  }, [focusBox]);

  const point = (e) => {
    const r = frameRef.current.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };
  const rectFrom = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  const capture = (e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* an old browser: the drag still works inside the page */ } };

  const onCutDown = (e) => { e.preventDefault(); e.stopPropagation(); capture(e); drag.current = { kind: 'cut' }; };
  const onBoxDown = (i) => (e) => {
    e.stopPropagation(); capture(e);
    drag.current = { kind: 'move', i, from: point(e), box: boxes[i] };
  };
  const onFrameDown = (e) => {
    if (!drawing) return;
    e.preventDefault(); capture(e);
    const p = point(e);
    drag.current = { kind: 'draw', from: p };
    setDraft({ ...p, w: 0, h: 0 });
  };
  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    const p = point(e);
    if (d.kind === 'cut') setCut(round(clamp(p.y, 0, CUT_MAX)));
    else if (d.kind === 'draw') setDraft(rectFrom(d.from, p));
    else if (d.kind === 'move') {
      setBoxes((list) => list.map((b, k) => (k === d.i ? keepBox({ ...d.box, x: d.box.x + p.x - d.from.x, y: d.box.y + p.y - d.from.y }) : b)));
    }
  };
  const onUp = (e) => {
    const d = drag.current; drag.current = null;
    if (d?.kind !== 'draw') return;
    const r = rectFrom(d.from, point(e));
    setDraft(null);
    if (r.w >= MIN_BOX && r.h >= MIN_BOX) setBoxes((list) => [...list, keepBox(r)]);
  };

  const onCutKey = (e) => {
    const by = { ArrowUp: -0.01, ArrowDown: 0.01, PageUp: -0.05, PageDown: 0.05 }[e.key];
    if (by !== undefined) { e.preventDefault(); setCut((c) => round(clamp(c + by, 0, CUT_MAX))); }
    else if (e.key === 'Home') { e.preventDefault(); setCut(0); }
    else if (e.key === 'End') { e.preventDefault(); setCut(CUT_MAX); }
  };
  const onBoxKey = (i) => (e) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      e.preventDefault();
      setBoxes((list) => list.map((b, k) => {
        if (k !== i) return b;
        return e.shiftKey
          ? keepBox({ ...b, w: b.w + dir[0] * STEP, h: b.h + dir[1] * STEP })
          : keepBox({ ...b, x: b.x + dir[0] * STEP, y: b.y + dir[1] * STEP });
      }));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setBoxes((list) => list.filter((_, k) => k !== i));
      if (i > 0) setFocusBox(i - 1); else addRef.current?.focus();
    }
  };
  // a 40%-wide box in the middle of what is sent, focused, ready for the arrow keys
  const addBox = () => {
    const y = cut + (1 - cut) / 2 - 0.05;
    setBoxes((list) => [...list, keepBox({ x: 0.3, y, w: 0.4, h: 0.1 })]);
    setFocusBox(boxes.length);
  };
  const undo = () => setBoxes((list) => list.slice(0, -1));
  const done = () => {
    if (!work) return;
    onDone({ data: encode(work, cut, boxes), prep: { crop: cut > 0, boxes: boxes.length } });
  };

  const pct = Math.round(cut * 100);
  const bandPx = frame ? cut * frame.height : 0;
  return (
    <Sheet open={!!file} onOpenChange={(o) => !o && onCancel()} title={PREP_COPY.title} className="photo-prep-sheet"
      footer={(
        <div className="prep-foot">
          <Button className="btn-block btn-lg" onClick={done} disabled={!work}>{PREP_COPY.done}</Button>
          <Button variant="ghost" className="btn-block btn-sm" onClick={onRetake}><Camera size={20} aria-hidden="true" />{PREP_COPY.retake}</Button>
        </div>
      )}>
      <div className="photo-prep">
        {/* both lines take the same place, so turning "השחרה" on or off never moves the page under the finger */}
        <p className="prep-lead" aria-live="polite">
          <span className={clsx(drawing && 'is-off')}>{PREP_COPY.lead}</span>
          <span className={clsx(!drawing && 'is-off')}>{PREP_COPY.drawing}</span>
        </p>
        <div className="prep-tools" role="group" aria-label={PREP_COPY.title}>
          <button type="button" className="prep-tool" aria-pressed={drawing} onClick={() => setDrawing((v) => !v)}><Brush size={20} aria-hidden="true" />{PREP_COPY.draw}</button>
          <button type="button" className="prep-tool" ref={addRef} onClick={addBox} disabled={!work}><SquarePlus size={20} aria-hidden="true" />{PREP_COPY.add}</button>
          <button type="button" className="prep-tool" onClick={undo} disabled={!boxes.length}><Undo2 size={20} aria-hidden="true" />{PREP_COPY.undo}</button>
        </div>
        <div className="prep-stage" ref={setStage}>
          {!work || !frame ? <p className="prep-loading" role="status">{PREP_COPY.loading}</p> : (
            <div className={clsx('prep-frame', drawing && 'is-drawing')} ref={frameRef} style={{ width: frame.width, height: frame.height }}
              onPointerDown={onFrameDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setDraft(null); }}>
              <canvas ref={paint} className="prep-canvas" role="img" aria-label="הדף שצילמתם" />
              {cut > 0 && (
                <div className="prep-band" style={{ height: `${cut * 100}%` }} aria-hidden="true">
                  <span className={clsx('prep-band-label', bandPx < 40 && 'below')}>{PREP_COPY.band}</span>
                </div>
              )}
              {boxes.map((b, i) => (
                <button key={i} type="button" className="prep-box" ref={(el) => { boxRefs.current[i] = el; }}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                  aria-label={`מלבן שחור ${i + 1}`} aria-describedby="prep-box-hint" onPointerDown={onBoxDown(i)} onKeyDown={onBoxKey(i)} />
              ))}
              {draft && <span className="prep-draft" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
              <div className="prep-handle" role="slider" tabIndex={0} aria-orientation="vertical" aria-label={PREP_COPY.cutLabel}
                aria-valuemin={0} aria-valuemax={Math.round(CUT_MAX * 100)} aria-valuenow={pct} aria-valuetext={`${pct}% מלמעלה לא יישלחו`}
                aria-describedby="prep-cut-hint" style={{ top: `${cut * 100}%` }} onPointerDown={onCutDown} onKeyDown={onCutKey}>
                <span className="prep-grip" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
        <p id="prep-cut-hint" className="visually-hidden">{PREP_COPY.cutHint}</p>
        <p id="prep-box-hint" className="visually-hidden">{PREP_COPY.boxHint}</p>
      </div>
    </Sheet>
  );
}
