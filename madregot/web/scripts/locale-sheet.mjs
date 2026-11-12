// The Arabic reviewer's sheet (COUNCIL2-34, owner steps in docs/ARABIC.md): every text the app holds in both
// languages, one row each, key | Hebrew | Arabic | correction, as a CSV a spreadsheet opens in Arabic and Hebrew: the
// shell and Settings catalogues (src/locales/*.json, a plural set as its forms "[one] …") and the teaching content's
// translations (src/content/ar/grade7.json, key content:<id>). The reviewer writes a corrected Arabic text in the
// fourth column; `apply` puts every correction back where its text lives and builds the content's Arabic files again.
//
//   node scripts/locale-sheet.mjs [out.csv]          write the sheet (default: locale-review.csv here)
//   node scripts/locale-sheet.mjs apply reviewed.csv  take the corrections (a correction that loses a {value} or a
//                                                     ⟦value⟧, or has a Hebrew letter, is listed and left out)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readMap, writeMap, buildAll } from './gen-arabic.mjs';

const dir = new URL('../src/locales/', import.meta.url);
const PARTS = ['shell', 'settings'];
const HEBREW = /[֐-׿]/;
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const write = (f, v) => writeFileSync(new URL(f, dir), `${JSON.stringify(v, null, 2)}\n`);
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const show = (v) => (v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `[${k}] ${x}`).join('\n') : v);
/** A plural set written as its forms ("[one] …\n[other] …") back into { one, other }; any other text as it is. */
const unshow = (s) => {
  const lines = s.split('\n');
  if (!lines.every((l) => /^\[(zero|one|two|few|many|other)\] /.test(l))) return s;
  return Object.fromEntries(lines.map((l) => { const m = /^\[(\w+)\] (.*)$/.exec(l); return [m[1], m[2]]; }));
};
const values = (v, re) => [...new Set((v && typeof v === 'object' ? Object.values(v).join(' ') : String(v)).match(re) || [])].sort().join();

/** Every row of the sheet: [key, Hebrew, Arabic, correction]. */
export function sheetRows() {
  const rows = [['key', 'עברית', 'العربية', 'تصحيح (اختياري)']];
  for (const part of PARTS) {
    const he = read(`${part}.he.json`);
    const ar = read(`${part}.ar.json`);
    for (const k of Object.keys(he)) rows.push([k, show(he[k]), show(ar[k]), '']);
  }
  for (const [id, [he, ar]] of Object.entries(readMap())) rows.push([`content:${id}`, he, ar, '']);
  return rows;
}

/** The rows of a CSV text (quoted cells may hold commas, quotes and line breaks). */
export function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/**
 * Apply a reviewed sheet: each correction goes to its catalogue key or its content text, when it keeps every value
 * of the Hebrew and has no Hebrew letter. With write: false nothing is saved (a dry run). → { applied, refused }.
 */
export function applySheet(text, { write: save = true } = {}) {
  const cats = Object.fromEntries(PARTS.map((p) => [p, { he: read(`${p}.he.json`), ar: read(`${p}.ar.json`) }]));
  const map = readMap();
  const refused = []; let applied = 0;
  for (const [key, , , fix] of parseCsv(text).slice(1)) {
    const corr = String(fix ?? '').trim();
    if (!key || !corr) continue;
    if (HEBREW.test(corr)) { refused.push({ key, why: 'a Hebrew letter' }); continue; }
    if (key.startsWith('content:')) {
      const id = key.slice(8);
      if (!map[id]) { refused.push({ key, why: 'no such text' }); continue; }
      if (values(corr, /⟦\d+⟧/g) !== values(map[id][0], /⟦\d+⟧/g)) { refused.push({ key, why: 'its ⟦values⟧ differ from the Hebrew' }); continue; }
      map[id] = [map[id][0], corr]; applied += 1;
      continue;
    }
    const part = PARTS.find((p) => Object.hasOwn(cats[p].he, key));
    if (!part) { refused.push({ key, why: 'no such key' }); continue; }
    const v = unshow(corr);
    // the same {values} as the Arabic it replaces (an Arabic text may leave out one the Hebrew has, locales.test.js)
    if (values(v, /\{\w+\}/g) !== values(cats[part].ar[key], /\{\w+\}/g)) { refused.push({ key, why: 'its {values} differ' }); continue; }
    cats[part].ar[key] = v; applied += 1;
  }
  if (save) {
    for (const p of PARTS) write(`${p}.ar.json`, cats[p].ar);
    writeMap(map);
  }
  return { applied, refused };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'apply') {
    const file = process.argv[3];
    if (!file || !existsSync(file)) { console.error('usage: node scripts/locale-sheet.mjs apply reviewed.csv'); process.exit(1); }
    const { applied, refused } = applySheet(readFileSync(file, 'utf8'));
    // the content's Arabic files follow their translations
    for (const r of buildAll()) if (r.code) writeFileSync(fileURLToPath(new URL(`../${r.twin}`, import.meta.url)), r.code);
    console.log(`${applied} corrections applied${refused.length ? `, ${refused.length} left out:` : ''}`);
    for (const r of refused) console.log(`  ${r.key}: ${r.why}`);
    console.log('next: npx vitest run src/locales src/learn/arabic.test.ts');
  } else {
    const rows = sheetRows();
    const out = process.argv[2] || 'locale-review.csv';
    // a byte-order mark, so a spreadsheet reads the file as UTF-8
    writeFileSync(out, `﻿${rows.map((r) => r.map(cell).join(',')).join('\n')}\n`);
    console.log(`${out}: ${rows.length - 1} texts`);
  }
}
