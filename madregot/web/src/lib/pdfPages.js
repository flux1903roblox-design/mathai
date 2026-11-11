// PDFs open on the device (PKG-2, trust spec TRUST-5 §3): each page of a chosen PDF is drawn on a canvas here and
// becomes a JPEG picture, which then goes through PhotoPrep like a photo (the top band cut, anything personal blacked
// out). The PDF itself is never sent.
// - pdf.js (pdfjs-dist 4.10.38) is imported here only, when a PDF is chosen: vite.config.js puts it in its own 'pdf'
//   chunk, budget.json's lazyOnly keeps it out of the first load, and the service worker does not keep it for offline
//   use (scripts/vite-plugin-sw.mjs): the check that follows needs the internet anyway.
// - The legacy build: the newer one calls Promise.withResolvers (Safari 17.4), while iPhones that stay on iOS 16
//   (iPhone 8 and X) can open a PDF with this one. A browser that cannot run it gets a calm message and can photograph
//   the pages instead (ExamCheck, Assistant).
// - Nothing is fetched from outside the app: no CMaps and no standard fonts from anywhere (a font a PDF does not embed
//   is drawn with the phone's own), and no eval, which the CSP forbids (public/_headers has no 'unsafe-eval').
import { MAX_EXAM_PAGES } from '@shared/ai.js';
import { PREP_MAX } from '@/components/PhotoPrep.jsx';

/** A bigger file is not opened: a phone could run out of memory. */
export const PDF_MAX_BYTES = 25 * 1024 * 1024;
/** Each page is a JPEG of this quality; PhotoPrep encodes it once more as it sends it. */
export const PDF_JPEG_QUALITY = 0.92;

/** The options every PDF is opened with: everything local, no eval, only errors in the console. */
export const PDF_OPEN = {
  isEvalSupported: false,
  useWorkerFetch: false,
  useSystemFonts: true,
  enableXfa: false,
  stopAtErrors: false,
  verbosity: 0,
};

/** What the two screens that take a PDF say (ExamCheck, the photo check in Assistant). */
export const PDF_COPY = {
  opening: 'פותחים את ה־PDF…',
  failed: 'לא הצלחנו לפתוח את ה־PDF. אפשר לצלם את הדפים במקום.',
  tooBig: 'ה־PDF גדול מדי לפתיחה כאן. אפשר לצלם את הדפים במקום.',
  firstOnly: (n) => `ב־PDF יש ${n} דפים. כאן בודקים דף אחד: את הדף הראשון.`,
};

/** Is this picked file a PDF? Some pickers give no type, so the name says it then. */
export const isPdf = (file) => file?.type === 'application/pdf' || (!file?.type && /\.pdf$/i.test(file?.name || ''));

/** The calm line for a PDF that did not open: too big, or anything else. */
export const pdfMessage = (err) => (err?.code === 'too_big' ? PDF_COPY.tooBig : PDF_COPY.failed);

/** Why a PDF did not open: 'too_big' (over PDF_MAX_BYTES), 'empty' (no pages), or 'broken' (pdf.js could not read it). */
export class PdfError extends Error {
  constructor(code, cause) {
    super(`pdf ${code}`);
    this.name = 'PdfError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/** The scale that draws a page of this viewport (at scale 1) with a long side of `longSide` pixels. */
export function pdfScale(viewport, longSide = PREP_MAX) {
  return longSide / Math.max(viewport.width, viewport.height);
}

/** The picture of page n of a PDF called `name`: "exam.pdf" → "exam-1.jpg". */
export function pageName(name, n) {
  const stem = String(name || '').replace(/\.pdf$/i, '').trim() || 'pdf';
  return `${stem}-${n}.jpg`;
}

let engine = null;
/** pdf.js with its worker, imported once on the first PDF; a failed import is tried again next time. */
export function loadPdfjs() {
  engine = engine || Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  }, (e) => { engine = null; throw e; });
  return engine;
}

/** The page canvases in a browser: made, encoded as a JPEG, and emptied (a phone frees the memory at once). */
export const domCanvas = {
  create(width, height) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    return c;
  },
  jpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('jpeg'))), 'image/jpeg', quality);
    });
  },
  free(canvas) { canvas.width = 0; canvas.height = 0; },
};

async function renderPage(doc, n, { name, longSide, canvas }) {
  const page = await doc.getPage(n);
  try {
    const viewport = page.getViewport({ scale: pdfScale(page.getViewport({ scale: 1 }), longSide) });
    const width = Math.max(1, Math.round(viewport.width));
    const height = Math.max(1, Math.round(viewport.height));
    const c = canvas.create(width, height);
    try {
      const ctx = c.getContext('2d');
      // colour-ok: a JPEG has no alpha, so the page is drawn on white, as on paper
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvas.jpeg(c, PDF_JPEG_QUALITY);
      return new File([blob], pageName(name, n), { type: 'image/jpeg' });
    } finally {
      canvas.free(c);
    }
  } finally {
    page.cleanup();
  }
}

/**
 * The pages of a PDF as JPEG files: pages 1 to min(total, max), each with a long side of `longSide` pixels.
 * → { pages: [File], total } (total: the PDF's number of pages). Rejects with a PdfError: 'too_big' before anything is
 * read or loaded, 'broken' when pdf.js cannot open or draw it (pdf.js failing to load counts too), 'empty' with no
 * pages. The document and its worker are always destroyed, and every canvas is emptied.
 * `canvas` is the canvas maker ({ create, jpeg, free }); the unit tests give one that works in node.
 */
export async function pdfPages(file, { max = MAX_EXAM_PAGES, longSide = PREP_MAX, canvas = domCanvas } = {}) {
  if (!file) throw new PdfError('broken');
  if (file.size > PDF_MAX_BYTES) throw new PdfError('too_big');
  let task = null;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdfjs = await loadPdfjs();
    task = pdfjs.getDocument({ data, ...PDF_OPEN });
    const doc = await task.promise;
    const total = doc.numPages;
    if (!total) throw new PdfError('empty');
    const pages = [];
    for (let n = 1; n <= Math.min(total, max); n += 1) pages.push(await renderPage(doc, n, { name: file.name, longSide, canvas }));
    return { pages, total };
  } catch (e) {
    throw e instanceof PdfError ? e : new PdfError('broken', e);
  } finally {
    // the loading task destroys the document and the worker it started
    if (task) await task.destroy().catch(() => {});
  }
}
