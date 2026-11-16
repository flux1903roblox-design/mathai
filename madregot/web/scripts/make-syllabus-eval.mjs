// The pictures of the syllabus kind's evaluation (worker/eval/syllabus.json, category S): each case's `picture` drawn
// as a synthetic screenshot of a teacher's message or a photographed sheet, with Playwright's Chromium (as
// scripts/make-icons.mjs draws the icons), and saved as worker/eval/syllabus/<id>.png. What is drawn is only the text in
// the JSON (an injected instruction in its own colour, as a student might photograph a note under the list). Run after
// a change to the cases: node scripts/make-syllabus-eval.mjs (from madregot/web).
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const EVAL = fileURLToPath(new URL('../../worker/eval/', import.meta.url));
const FONT = fileURLToPath(new URL('../node_modules/@fontsource-variable/rubik/files/rubik-hebrew-wght-normal.woff2', import.meta.url));
const { cases } = JSON.parse(readFileSync(`${EVAL}syllabus.json`, 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const font = `@font-face { font-family: Rubik; src: url(data:font/woff2;base64,${readFileSync(FONT).toString('base64')}) format('woff2'); font-weight: 300 900; }`;

function html(p) {
  const lines = p.lines.map((l) => `<p dir="auto">${esc(l)}</p>`).join('');
  const inject = p.inject ? `<p class="inject" dir="auto">${esc(p.inject)}</p>` : '';
  const body = p.kind === 'message'
    ? `<div class="chat"><div class="who">קבוצת הכיתה</div><div class="bubble">${lines}<span class="time">19:42</span></div>${inject ? `<div class="bubble">${inject}</div>` : ''}</div>`
    : `<div class="sheet"><h1>${esc(p.title || '')}</h1>${lines}${inject}</div>`;
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>${font}
    body { margin: 0; font: 26px/1.5 Rubik, 'DejaVu Sans', sans-serif; color: #1d232b; }
    .chat { background: #e8ded4; padding: 28px 24px; min-height: 460px; }
    .who { font-weight: 700; margin-bottom: 14px; color: #3a5a40; }
    .bubble { background: #fff; border-radius: 14px; padding: 14px 20px 30px; margin-bottom: 16px; max-width: 760px; position: relative; }
    .bubble p { margin: 0 0 4px; } .time { position: absolute; bottom: 6px; left: 14px; font-size: 18px; color: #6b7280; }
    .sheet { background: #fbfaf5; padding: 40px 48px; min-height: 520px; border: 1px solid #d6d3c4; }
    .sheet h1 { font-size: 34px; margin: 0 0 22px; } .sheet p { margin: 0 0 12px; }
    .inject { color: #9a3412; font-size: 22px; margin-top: 26px; }
  </style></head><body>${body}</body></html>`;
}

mkdirSync(`${EVAL}syllabus`, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 860, height: 560 }, deviceScaleFactor: 1 });
for (const c of cases) {
  await page.setContent(html(c.picture));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${EVAL}syllabus/${c.id}.png`, fullPage: true });
}
await browser.close();
process.stdout.write(`${cases.length} pictures in ${EVAL}syllabus/\n`);
