// The distress detector's phrases as a sheet for a school counsellor (the owner's one action for COUNCIL2-1/4):
//
//   node worker/scripts/distress-sheet.mjs distress-review.csv
//
// writes every phrase the detector (shared/distress.js) is held to: the ones that must open the support card, with the
// family each is counted under, and the maths and school sentences that must never open it; Hebrew first, then Arabic.
// Two empty columns are for the counsellor: "נכון?" (is the row right) and "הערה" (a phrase that is missing, a wording
// children really use, a row that should move to the other list). The file opens in Excel and in Google Sheets (UTF-8
// with a byte order mark, every cell quoted). The phrases come from test/fixtures/distress-corpus.js, which the tests
// read too, so the sheet is exactly what the detector is tested against. Every phrase is synthetic.
//
// What comes back goes into that fixture (a new phrase, with its family) and, when a phrase does not flag yet, into the
// rule of its family in shared/distress.js; then `node --test test/safety.test.js test/arabic.test.js`.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CORPUS_FLAG, CORPUS_CLEAR, AR_FLAG, AR_CLEAR } from '../test/fixtures/distress-corpus.js';

/** The families, as the counsellor reads them. */
export const FAMILY = Object.freeze({
  self_harm: 'פגיעה עצמית או מחשבות אובדניות',
  abuse: 'פגיעה מצד מבוגר או בבית',
  danger: 'איום, סחיטה או סכנה',
  bullying: 'חרם או בריונות',
  distress: 'מצוקה רגשית',
});
export const LISTS = Object.freeze({ flag: 'חייב לפתוח את קווי הסיוע', clear: 'אסור שיפתח את קווי הסיוע' });
export const HEAD = Object.freeze(['רשימה', 'שפה', 'סוג', 'ניסוח', 'נכון? (כן / לא)', 'הערה']);

/** Every row of the sheet, in order: Hebrew that must flag, Hebrew that must not, then the same two in Arabic. */
export function sheetRows() {
  return [
    ...CORPUS_FLAG.map(([text, cat]) => [LISTS.flag, 'עברית', FAMILY[cat], text]),
    ...CORPUS_CLEAR.map((text) => [LISTS.clear, 'עברית', '', text]),
    ...Object.entries(AR_FLAG).flatMap(([cat, list]) => list.map((text) => [LISTS.flag, 'ערבית', FAMILY[cat], text])),
    ...AR_CLEAR.map((text) => [LISTS.clear, 'ערבית', '', text]),
  ];
}

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
/** The sheet as CSV text: a byte order mark, the heading, a row per phrase with the two empty columns. */
export function sheetCsv() {
  const lines = [HEAD, ...sheetRows().map((r) => [...r, '', ''])].map((r) => r.map(cell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const out = process.argv[2];
  if (!out) { console.error('usage: node worker/scripts/distress-sheet.mjs <file.csv>'); process.exit(2); }
  writeFileSync(out, sheetCsv());
  const rows = sheetRows();
  const n = (list, lang) => rows.filter((r) => r[0] === list && r[1] === lang).length;
  console.log(`distress-sheet: ${rows.length} phrases in ${out}`);
  console.log(`  עברית: ${n(LISTS.flag, 'עברית')} must flag, ${n(LISTS.clear, 'עברית')} must not`);
  console.log(`  ערבית: ${n(LISTS.flag, 'ערבית')} must flag, ${n(LISTS.clear, 'ערבית')} must not`);
}
