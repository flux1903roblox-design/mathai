// The app's install icons, drawn from the favicon in index.html (the blue circle with a white stair) by the Chromium
// that Playwright already uses for the e2e tests. Run once from madregot/web after the drawing changes, then commit
// the PNGs: node scripts/make-icons.mjs
//
// public/icons/
//   180.png            Apple touch icon: a full square (iOS paints transparent corners black and rounds them itself)
//   192.png, 512.png   the favicon as it is: the circle on a transparent ground
//   maskable-512.png   a full square in brand blue, the stair inside the central 80% (the maskable safe zone)
//   sc-today-96.png, sc-quests-96.png, sc-rescue-96.png   install shortcuts (STUDENT-10): the app's own icons for
//                      "today's lesson" (Play), quests (Target, the tab icon) and Exam Rescue (CalendarClock)
//   badge-96.png       the stair alone, white on transparent: Android's notification badge (STUDENT-11)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Play, Target, CalendarClock } from 'lucide-react';
import { chromium } from '@playwright/test';

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));
const BRAND = '#1a5cf5';
// the favicon's stair, in its own 32×32 box (index.html)
const STAIR = (stroke = 'white', width = 3) => `<path d="M9 22h5v-4h4v-4h5" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;

const svg = (body, view = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" width="100%" height="100%">${body}</svg>`;

const FAVICON = svg(`<circle cx="16" cy="16" r="15" fill="${BRAND}"/>${STAIR()}`);
// full bleed: the stair (x 9..23, y 14..22) sits centred, well inside the 80% circle (radius 12.8 around 16,16)
const SQUARE = svg(`<rect width="32" height="32" fill="${BRAND}"/><g transform="translate(16 16) scale(1.15) translate(-16 -18)">${STAIR()}</g>`);
const BADGE = svg(`<g transform="translate(16 16) scale(1.7) translate(-16 -18)">${STAIR('white', 3)}</g>`);

/** A lucide icon, white, centred on the brand circle (the icons the app shows next to the same places). */
function shortcut(Icon) {
  const glyph = renderToStaticMarkup(createElement(Icon, { size: 14, color: 'white', strokeWidth: 2.2, x: 9, y: 9 }));
  return svg(`<circle cx="16" cy="16" r="15" fill="${BRAND}"/>${glyph}`);
}

const ICONS = [
  ['180.png', 180, SQUARE],
  ['192.png', 192, FAVICON],
  ['512.png', 512, FAVICON],
  ['maskable-512.png', 512, SQUARE],
  ['sc-today-96.png', 96, shortcut(Play)],
  ['sc-quests-96.png', 96, shortcut(Target)],
  ['sc-rescue-96.png', 96, shortcut(CalendarClock)],
  ['badge-96.png', 96, BADGE],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, art] of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${art}</div></body></html>`);
    await page.screenshot({ path: `${OUT}${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`icons/${name} ${size}×${size}`);
  }
} finally {
  await browser.close();
}
