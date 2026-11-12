// The Arabic reviewer's sheet (COUNCIL2-34, owner step in docs/ARABIC.md): every text the app holds in both languages,
// one row each, key | Hebrew | Arabic (a plural set as its forms), as a CSV a spreadsheet opens in Arabic and Hebrew.
// The reviewer writes a corrected Arabic text in the fourth column; the next build of the catalogues takes it from there.
// Usage: node scripts/locale-sheet.mjs [out.csv]   (default: locale-review.csv in the current folder)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dir = new URL('../src/locales/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const show = (v) => (v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `[${k}] ${x}`).join('\n') : v);

const rows = [['key', 'עברית', 'العربية', 'تصحيح (اختياري)']];
for (const part of ['shell', 'settings']) {
  const he = read(`${part}.he.json`);
  const ar = read(`${part}.ar.json`);
  for (const k of Object.keys(he)) rows.push([k, he[k], show(ar[k]), '']);
}
// the teaching content's Arabic (stage 30 adds content/ar/*.json: Hebrew text → Arabic text)
const content = new URL('../src/content/ar/', import.meta.url);
for (const f of ['grade7.json']) {
  const p = new URL(f, content);
  if (!existsSync(p)) continue;
  for (const [he, ar] of Object.entries(JSON.parse(readFileSync(p, 'utf8')))) rows.push([`content:${f}`, he, ar, '']);
}
const out = process.argv[2] || 'locale-review.csv';
// a byte-order mark, so a spreadsheet reads the file as UTF-8
writeFileSync(out, `﻿${rows.map((r) => r.map(cell).join(',')).join('\n')}\n`);
console.log(`${out}: ${rows.length - 1} texts`);
