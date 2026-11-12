// PDFs drawn on the device (PKG-2, lib/pdfPages.js). First with the real pdf.js in node, on the synthetic fixtures that
// scripts/make-pdf-fixture.mjs writes (2 A4 pages, a red band across the top of page 1; and a scanned page that is one
// JPEG 2000 picture): it opens with 2 pages, each page comes out as a JPEG with a long side of 1800 px, the scanned
// page's picture is decoded and drawn, `max` stops early but still says how many there were, and a broken file is
// refused. The page canvases come from @napi-rs/canvas, which pdfjs-dist installs as its own optional
// dependency for node (it is not in package.json and the app never uses it). In node pdf.js runs its worker code on
// the same thread (globalThis.pdfjsWorker), so the worker's URL, which only a browser loads, is a stand-in here; the
// end-to-end test opens the real one. Then with pdf.js replaced by a stand-in that counts its imports: nothing is
// imported until the first PDF (or for a file that is too big), the options keep everything local with no eval, and
// the document is destroyed and every canvas emptied, also when a page fails, and a PDF whose every page came out white
// (a picture the browser could not decode, as under a CSP without 'wasm-unsafe-eval') is refused as 'blank'.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { examPdf, scanPdf, brokenPdf, PAGE, BAND, SCAN } from '../../scripts/make-pdf-fixture.mjs';
import { pdfPages, pdfScale, pageName, isPdf, pdfMessage, whitePage, PdfError, PDF_COPY, PDF_OPEN, PDF_MAX_BYTES } from './pdfPages.js';
import { PREP_MAX } from '@/components/PhotoPrep.jsx';
import { MAX_EXAM_PAGES } from '@shared/ai.js';

vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({ default: 'assets/pdf.worker.min.mjs' }));

const FIXTURE = new URL('../../e2e/fixtures/', import.meta.url);
const fixture = (name) => readFileSync(new URL(name, FIXTURE));
const pdfFile = (bytes, name = 'exam.pdf') => new File([bytes], name, { type: 'application/pdf' });
/** Page canvases in node, made the way the browser's are used: create, encode as JPEG, empty. */
const nodeCanvas = {
  create: (w, h) => createCanvas(w, h),
  jpeg: async (c, q) => new Blob([await c.encode('jpeg', Math.round(q * 100))], { type: 'image/jpeg' }),
  free: (c) => { c.width = 0; c.height = 0; },
};
/** A JPEG file decoded: its size and the colour of one pixel. */
async function look(file, [x, y]) {
  const img = await loadImage(Buffer.from(await file.arrayBuffer()));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  return { width: img.width, height: img.height, px: [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3) };
}
const red = ([r, g, b]) => r > 200 && g < 60 && b < 60;
const white = ([r, g, b]) => r > 240 && g > 240 && b > 240;

describe('the fixtures', () => {
  it('are the bytes scripts/make-pdf-fixture.mjs writes: synthetic, the same every run', () => {
    expect(fixture('exam-2-pages.pdf').equals(examPdf())).toBe(true);
    expect(fixture('broken.pdf').equals(brokenPdf())).toBe(true);
    expect(fixture('scan-jpx.pdf').equals(scanPdf())).toBe(true);
    expect(examPdf().toString('latin1')).toMatch(/^%PDF-1\.4\n/);
    // the scanned page: one picture, in JPEG 2000 (a JP2 file inside the PDF)
    const scan = scanPdf().toString('latin1');
    expect(scan).toMatch(/^%PDF-1\.5\n/);
    expect(scan.match(/\/Filter \/(\w+)/g)).toEqual(['/Filter /JPXDecode']);
    expect(scan).toContain('\0\0\0\x0CjP  \r\n\x87\n'); // the JPEG 2000 signature box
  });
});

describe('pdfScale and pageName', () => {
  it('gives the long side asked for: an A4 page 1800 px tall, a landscape page 1800 px wide', () => {
    expect(PREP_MAX).toBe(1800);
    expect(pdfScale(PAGE) * PAGE.height).toBeCloseTo(1800, 6);
    expect(pdfScale({ width: 842, height: 595 }) * 842).toBeCloseTo(1800, 6);
    expect(pdfScale({ width: 400, height: 300 }, 1000)).toBe(2.5);
  });
  it('names each picture after the PDF and its page', () => {
    expect(pageName('מבחן.PDF', 2)).toBe('מבחן-2.jpg');
    expect(pageName('exam.pdf', 1)).toBe('exam-1.jpg');
    expect(pageName('', 3)).toBe('pdf-3.jpg');
  });
});

describe('which file is a PDF, and what is said when one does not open', () => {
  it('a PDF by its type, or by its name when the picker gave no type; never a picture', () => {
    expect(isPdf({ type: 'application/pdf', name: 'a' })).toBe(true);
    expect(isPdf({ type: '', name: 'דף עבודה.PDF' })).toBe(true);
    expect(isPdf({ type: 'image/jpeg', name: 'scan.pdf' })).toBe(false);
    expect(isPdf({ type: 'image/png', name: 'a.png' })).toBe(false);
    expect(isPdf(null)).toBe(false);
  });
  it('the exact calm lines: a file too big, and every other failure', () => {
    expect(PDF_COPY.failed).toBe('לא הצלחנו לפתוח את ה־PDF. אפשר לצלם את הדפים במקום.');
    expect(pdfMessage(new PdfError('broken'))).toBe(PDF_COPY.failed);
    expect(pdfMessage(new PdfError('empty'))).toBe(PDF_COPY.failed);
    expect(pdfMessage(new PdfError('blank'))).toBe(PDF_COPY.failed);
    expect(pdfMessage(new Error('x'))).toBe(PDF_COPY.failed);
    expect(pdfMessage(new PdfError('too_big'))).toBe('ה־PDF גדול מדי לפתיחה כאן. אפשר לצלם את הדפים במקום.');
    expect(PDF_COPY.firstOnly(3)).toBe('ב־PDF יש 3 דפים. כאן בודקים דף אחד: את הדף הראשון.');
    // no price, no countdown, nothing that hurries
    for (const line of [PDF_COPY.opening, PDF_COPY.failed, PDF_COPY.tooBig, PDF_COPY.firstOnly(2)]) expect(line).not.toMatch(/₪|\d+\s*(שניות|דקות)|מהר|עכשיו/);
  });
});

describe('the real pdf.js in node', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
  }, 120_000);
  afterEach(() => { vi.restoreAllMocks(); });

  it('opens the fixture: 2 pages, each a JPEG with a long side of 1800 px, page 1 with its red band; nothing fetched', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { pages, total } = await pdfPages(pdfFile(fixture('exam-2-pages.pdf')), { canvas: nodeCanvas });
    expect(total).toBe(2);
    expect(pages.map((p) => [p.name, p.type])).toEqual([['exam-1.jpg', 'image/jpeg'], ['exam-2.jpg', 'image/jpeg']]);
    for (const p of pages) {
      const head = new Uint8Array(await p.slice(0, 2).arrayBuffer());
      expect([...head], p.name).toEqual([0xFF, 0xD8]);
    }
    // A4 at 1800 px tall: 595 x 1800 / 842 = 1272 px wide
    const one = await look(pages[0], [10, 10]);
    expect([one.width, one.height]).toEqual([1272, 1800]);
    expect(red(one.px), `page 1 at (10,10) is ${one.px}`).toBe(true);
    // under the band (100 pt of 842: 214 px) the page is white again
    const under = await look(pages[0], [10, Math.ceil((BAND / PAGE.height) * 1800) + 10]);
    expect(white(under.px), `page 1 under the band is ${under.px}`).toBe(true);
    const two = await look(pages[1], [10, 10]);
    expect([two.width, two.height]).toEqual([1272, 1800]);
    expect(white(two.px), `page 2 at (10,10) is ${two.px}`).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a scanned page (one JPEG 2000 picture) is decoded and drawn: the band grey, the bars dark, white between', async () => {
    const { pages, total } = await pdfPages(pdfFile(fixture('scan-jpx.pdf'), 'scan.pdf'), { canvas: nodeCanvas });
    expect(total).toBe(1);
    const at = (x, y) => [Math.round((x * 1272) / SCAN.width), Math.round((y * 1800) / SCAN.height)];
    const bar = SCAN.bars[3];
    const [band, onBar, between] = await Promise.all([
      look(pages[0], at(300, SCAN.band / 2)),
      look(pages[0], at(200, (bar.y0 + bar.y1) / 2)),
      look(pages[0], at(200, bar.y1 + 28)),
    ]);
    expect([band.width, band.height]).toEqual([1272, 1800]);
    expect(Math.max(...band.px), `the band is ${band.px}`).toBeLessThan(130);
    expect(Math.max(...onBar.px), `a bar is ${onBar.px}`).toBeLessThan(80);
    expect(white(between.px), `between the bars is ${between.px}`).toBe(true);
  });

  it('max: 1 draws one page and still says the PDF has 2', async () => {
    const { pages, total } = await pdfPages(pdfFile(fixture('exam-2-pages.pdf')), { canvas: nodeCanvas, max: 1 });
    expect(total).toBe(2);
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe('exam-1.jpg');
  });

  it('a broken file, random bytes and an empty file are refused as broken', async () => {
    for (const bytes of [fixture('broken.pdf'), Buffer.from('not a pdf at all, just words'), Buffer.alloc(0)]) {
      const err = await pdfPages(pdfFile(bytes), { canvas: nodeCanvas }).catch((e) => e);
      expect(err).toBeInstanceOf(PdfError);
      expect(err.code).toBe('broken');
    }
  });
});

// ---- pdf.js replaced by a stand-in that counts its imports (a fresh copy of pdfPages.js, after vi.resetModules)
function standIn({ numPages = 3, failOn = 0 } = {}) {
  const seen = { imports: 0, opened: [], destroyed: 0, rendered: [], cleaned: 0, lib: null };
  const page = (n) => ({
    getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
    render: () => ({ promise: n === failOn ? Promise.reject(new Error('bad page')) : Promise.resolve(seen.rendered.push(n)) }),
    cleanup: () => { seen.cleaned += 1; },
  });
  const lib = {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: (src) => {
      seen.opened.push(src);
      return { promise: Promise.resolve({ numPages, getPage: async (n) => page(n) }), destroy: async () => { seen.destroyed += 1; } };
    },
  };
  seen.lib = lib;
  vi.doMock('pdfjs-dist/legacy/build/pdf.min.mjs', () => { seen.imports += 1; return lib; });
  return seen;
}
/**
 * Canvases that keep count, and a JPEG of two bytes. `white`: the pages (numbered from 1, in the order drawn) that come
 * out white all over; the others have one grey pixel at the bottom right.
 */
function countingCanvas({ white = [] } = {}) {
  const made = []; let freed = 0;
  const context = (n, w, h) => ({
    fillRect() {}, set fillStyle(v) {},
    getImageData: (x, y, cw, ch) => {
      const data = new Uint8ClampedArray(cw * ch * 4).fill(255);
      if (!white.includes(n) && y + ch === h) data.fill(128, data.length - 4, data.length - 1);
      return { data, width: cw, height: ch };
    },
  });
  return {
    made, freed: () => freed,
    create: (w, h) => { made.push([w, h]); const n = made.length; return { width: w, height: h, getContext: () => context(n, w, h) }; },
    jpeg: async () => new Blob([new Uint8Array([0xFF, 0xD8])], { type: 'image/jpeg' }),
    free: (c) => { freed += 1; c.width = 0; c.height = 0; },
  };
}
async function fresh(options) {
  vi.resetModules();
  const seen = standIn(options);
  const mod = await import('./pdfPages.js');
  return { seen, mod };
}

describe('pdf.js loads with the first PDF, and only then', () => {
  afterEach(() => { vi.doUnmock('pdfjs-dist/legacy/build/pdf.min.mjs'); });

  it('is not imported with the module, nor for a file that is too big; then once, with its worker set', async () => {
    const { seen, mod } = await fresh();
    expect(seen.imports).toBe(0);
    const big = { name: 'big.pdf', size: PDF_MAX_BYTES + 1, arrayBuffer: () => { throw new Error('read'); } };
    await expect(mod.pdfPages(big)).rejects.toMatchObject({ code: 'too_big' });
    expect(seen.imports).toBe(0);
    const canvas = countingCanvas();
    const first = await mod.pdfPages(pdfFile(examPdf()), { canvas });
    expect(seen.imports).toBe(1);
    expect(seen.lib.GlobalWorkerOptions.workerSrc).toBe('assets/pdf.worker.min.mjs');
    expect(first.total).toBe(3);
    await mod.pdfPages(pdfFile(examPdf()), { canvas });
    expect(seen.imports).toBe(1);
  });

  it('opens with everything local and no eval, draws up to MAX_EXAM_PAGES at 1800 px, and cleans up', async () => {
    const { seen, mod } = await fresh({ numPages: MAX_EXAM_PAGES + 3 });
    const canvas = countingCanvas();
    const { pages, total } = await mod.pdfPages(pdfFile(examPdf(), 'worksheet.pdf'), { canvas });
    expect(total).toBe(MAX_EXAM_PAGES + 3);
    expect(pages).toHaveLength(MAX_EXAM_PAGES);
    expect(pages.at(-1).name).toBe(`worksheet-${MAX_EXAM_PAGES}.jpg`);
    const [src] = seen.opened;
    expect(src.data).toBeInstanceOf(Uint8Array);
    expect(src.data.length).toBe(examPdf().length);
    expect(src).toMatchObject({ isEvalSupported: false, useWorkerFetch: false, enableXfa: false });
    expect(src).toEqual({ data: src.data, ...PDF_OPEN });
    for (const key of ['url', 'cMapUrl', 'standardFontDataUrl', 'docBaseUrl']) expect(src, key).not.toHaveProperty(key);
    // 600 x 800 at a long side of 1800: 1350 x 1800
    expect(canvas.made).toEqual(Array(MAX_EXAM_PAGES).fill([1350, 1800]));
    expect(canvas.freed()).toBe(MAX_EXAM_PAGES);
    expect(seen.cleaned).toBe(MAX_EXAM_PAGES);
    expect(seen.destroyed).toBe(1);
  });

  it('a page that fails: refused as broken, the document destroyed and every canvas emptied', async () => {
    const { seen, mod } = await fresh({ numPages: 3, failOn: 2 });
    const canvas = countingCanvas();
    await expect(mod.pdfPages(pdfFile(examPdf()), { canvas })).rejects.toMatchObject({ code: 'broken' });
    expect(seen.rendered).toEqual([1]);
    expect(canvas.made).toHaveLength(2);
    expect(canvas.freed()).toBe(2);
    expect(seen.destroyed).toBe(1);
  });

  it('a PDF whose every page came out white is "blank"; one page with something on it is enough to keep them all', async () => {
    const { seen, mod } = await fresh({ numPages: 2 });
    const all = countingCanvas({ white: [1, 2] });
    await expect(mod.pdfPages(pdfFile(examPdf()), { canvas: all })).rejects.toMatchObject({ name: 'PdfError', code: 'blank' });
    expect(all.freed()).toBe(2);
    expect(seen.destroyed).toBe(1);
    const one = countingCanvas({ white: [1] });
    const { pages } = await mod.pdfPages(pdfFile(examPdf()), { canvas: one });
    expect(pages).toHaveLength(2);
  });

  it('a PDF with no pages is "empty"; a pdf.js that cannot load is "broken" and is tried again next time', async () => {
    const { seen, mod } = await fresh({ numPages: 0 });
    await expect(mod.pdfPages(pdfFile(examPdf()), { canvas: countingCanvas() })).rejects.toMatchObject({ code: 'empty' });
    expect(seen.destroyed).toBe(1);
    vi.resetModules();
    let tries = 0;
    vi.doMock('pdfjs-dist/legacy/build/pdf.min.mjs', () => { tries += 1; if (tries === 1) throw new SyntaxError('Unexpected token'); return seen.lib; });
    const again = await import('./pdfPages.js');
    await expect(again.pdfPages(pdfFile(examPdf()), { canvas: countingCanvas() })).rejects.toMatchObject({ code: 'broken' });
    await expect(again.pdfPages(pdfFile(examPdf()), { canvas: countingCanvas() })).rejects.toMatchObject({ code: 'empty' });
    expect(tries).toBe(2);
  });
});

describe('whitePage', () => {
  it('is true only when every pixel is pure white, wherever the first other pixel is', () => {
    const c = createCanvas(300, 200);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 200);
    expect(whitePage(ctx, 300, 200)).toBe(true);
    expect(whitePage(ctx, 300, 200, 7)).toBe(true); // bands that do not divide the height
    ctx.fillStyle = 'rgb(254, 255, 255)'; ctx.fillRect(299, 199, 1, 1); // the very last pixel, nearly white
    expect(whitePage(ctx, 300, 200)).toBe(false);
    expect(whitePage(ctx, 300, 200, 7)).toBe(false);
  });
  it('reads only as far as it needs: one band on a page with something at its top', () => {
    const reads = [];
    const ctx = { getImageData: (x, y, w, h) => { reads.push(y); const data = new Uint8ClampedArray(w * h * 4).fill(255); data[0] = 0; return { data }; } };
    expect(whitePage(ctx, 1272, 1800)).toBe(false);
    expect(reads).toEqual([0]);
  });
});
