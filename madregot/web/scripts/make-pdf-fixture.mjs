// The PDF fixtures of the PDF tests (PKG-2, trust spec TRUST-5 §3), written by hand: a 2-page A4 exam with synthetic
// text only, whose page 1 has a red band across the top where a name and an ID number would be (the band the exam
// check cuts off by default), a scanned page, and a file that says it is a PDF but is not one. The bytes are the same
// on every run, so the committed files can be checked against this script (src/lib/pdfPages.test.js does).
//   e2e/fixtures/exam-2-pages.pdf   2 pages, 595 x 842 pt, Helvetica (a standard font, not embedded)
//   e2e/fixtures/scan-jpx.pdf       1 page that is one picture in JPEG 2000 (/JPXDecode), as many scanners write:
//                                   pdf.js decodes it with WebAssembly, which the CSP must allow ('wasm-unsafe-eval')
//   e2e/fixtures/broken.pdf         a PDF header, then nothing a PDF reader can open
// The scanned page's picture is e2e/fixtures/scan-page.jp2 (2.5 KB, a JPEG 2000 file): 595 x 842 grey pixels,
// white, a grey band across the top 100 rows (where a name would be, 90) and 8 dark bars for lines of writing (30).
// It was made once with Pillow's OpenJPEG encoder; no JavaScript package here writes JPEG 2000:
//   im = Image.new('L', (595, 842), 255); d = ImageDraw.Draw(im); d.rectangle([0, 0, 594, 99], fill=90)
//   for i in range(8): d.rectangle([60, 200 + i * 70, 480, 213 + i * 70], fill=30)
//   im.save('scan-page.jp2', 'JPEG2000', irreversible=True, quality_mode='rates', quality_layers=[200])
// Usage: node scripts/make-pdf-fixture.mjs [folder]   (default: e2e/fixtures)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** A4 in PDF points, rounded as most writers round it. */
export const PAGE = { width: 595, height: 842 };
/** The red band on page 1: the top 100 pt (11.9% of the page, inside the 15% the exam check cuts). */
export const BAND = 100;

const text = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
const lines = (rows, { x = 60, top, step, size }) => rows
  .map((row, i) => `BT /F1 ${size} Tf ${x} ${top - i * step} Td (${text(row)}) Tj ET`).join('\n');

function page1() {
  return [
    // the header band: red, with the blanks a name and an ID would be written in
    '1 0 0 rg', `0 ${PAGE.height - BAND} ${PAGE.width} ${BAND} re f`,
    '1 1 1 rg', `BT /F1 20 Tf 40 ${PAGE.height - 60} Td (${text('Name: ____________   ID: ____________')}) Tj ET`,
    '0 0 0 rg',
    lines(['Synthetic practice exam - page 1'], { top: 690, step: 0, size: 24 }),
    lines(['1)  3x + 5 = 20', '2)  -4 - (-9) = ?', '3)  2(x - 1) = 10', '4)  (-3) x (-5) = ?', '5)  7 - 2x = -1'], { top: 620, step: 70, size: 20 }),
  ].join('\n');
}

function page2() {
  return [
    '0 0 0 rg',
    lines(['Synthetic practice exam - page 2'], { top: 760, step: 0, size: 24 }),
    lines(['6)  x / 4 = 3', '7)  5x - 2 = 3x + 8', '8)  12 : (-3) = ?', '9)  4(2 - x) = 0', '10) -2x + 6 = 0'], { top: 690, step: 70, size: 20 }),
  ].join('\n');
}

const stream = (s) => `<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`;
const box = `/MediaBox [0 0 ${PAGE.width} ${PAGE.height}]`;

/** A PDF file from its objects (latin1 strings, object 1 the catalogue): the cross-reference table at their exact offsets. */
function pdfOf(objects, version = '1.4') {
  let out = `%PDF-${version}\n%\xE2\xE3\xCF\xD3\n`;
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) out += `${String(at).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** The 2-page exam as bytes: the objects, the cross-reference table at their exact offsets, and the trailer. */
export function examPdf() {
  return pdfOf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    `<< /Type /Page /Parent 2 0 R ${box} /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>`,
    stream(page1()),
    `<< /Type /Page /Parent 2 0 R ${box} /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>`,
    stream(page2()),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]);
}

/** The scanned page's picture: rows and bars as scan-page.jp2 draws them, in its own pixels (1 px = 1 pt). */
export const SCAN = { width: 595, height: 842, band: 100, bars: Array.from({ length: 8 }, (_, i) => ({ x0: 60, x1: 480, y0: 200 + i * 70, y1: 213 + i * 70 })) };

/** One A4 page that is a single JPEG 2000 picture over the whole page, as a scanner writes it (PDF 1.5: /JPXDecode). */
export function scanPdf(jp2 = readFileSync(new URL('../e2e/fixtures/scan-page.jp2', import.meta.url))) {
  const image = `<< /Type /XObject /Subtype /Image /Width ${SCAN.width} /Height ${SCAN.height} /Filter /JPXDecode /Length ${jp2.length} >>\nstream\n`;
  return pdfOf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R ${box} /Resources << /XObject << /Scan 5 0 R >> >> /Contents 4 0 R >>`,
    stream(`q ${PAGE.width} 0 0 ${PAGE.height} 0 0 cm /Scan Do Q`),
    image + jp2.toString('latin1') + '\nendstream',
  ], '1.5');
}

/** A file that starts like a PDF and has no objects, no cross-reference table and no trailer. */
export function brokenPdf() {
  return Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\nThis file is broken on purpose. It has no pages.\n%%EOF\n', 'latin1');
}

export const FIXTURES = { 'exam-2-pages.pdf': examPdf, 'scan-jpx.pdf': scanPdf, 'broken.pdf': brokenPdf };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] || join(fileURLToPath(new URL('..', import.meta.url)), 'e2e', 'fixtures');
  mkdirSync(dir, { recursive: true });
  for (const [name, make] of Object.entries(FIXTURES)) {
    const bytes = make();
    writeFileSync(join(dir, name), bytes);
    console.log(`${join(dir, name)}  ${bytes.length} bytes`);
  }
}
