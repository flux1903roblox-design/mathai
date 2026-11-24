// The Arabic reviewer's sheet (COUNCIL2-34): every catalogue text and every content translation is a row, the CSV
// reads back as written, and a correction is taken only when it keeps its values and has no Hebrew (a dry run: the
// test writes nothing).
import { describe, it, expect } from 'vitest';
import { sheetRows, parseCsv, applySheet } from './locale-sheet.mjs';
import { readMap } from './gen-arabic.mjs';

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = (rows) => `﻿${rows.map((r) => r.map(cell).join(',')).join('\n')}\n`;

describe('the review sheet', () => {
  const rows = sheetRows();
  it('has a row for every catalogue key and every content text', () => {
    const keys = rows.slice(1).map((r) => r[0]);
    expect(keys).toContain('shell.content.whatHappened');
    expect(keys.filter((k) => k.startsWith('content:')).length).toBe(Object.keys(readMap()).length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reads back as written: commas, quotes and line breaks inside a cell', () => {
    const sample = [rows[0], ['k', 'a, "b"\nc', 'د', '']];
    expect(parseCsv(csv(sample))).toEqual(sample);
    expect(parseCsv(csv(rows)).length).toBe(rows.length);
  });

  it('takes a correction that keeps its values; leaves out one with Hebrew, a lost value or an unknown key', () => {
    const content = rows.find((r) => r[0].startsWith('content:') && /⟦0⟧/.test(r[1]));
    const fixes = [
      rows[0],
      ['shell.content.whatHappened', '', '', 'ما الذي حدث على الأرجح: {label}.'],
      [content[0], '', '', content[2]],
      ['shell.content.ambiguous', '', '', 'ربما'], // its {names} is lost
      ['shell.content.orMaybe', '', '', 'או'], // Hebrew
      [content[0], '', '', 'بلا قيمة'], // its ⟦0⟧ is lost
      ['shell.nope', '', '', 'نص'],
    ];
    const { applied, refused } = applySheet(csv(fixes), { write: false });
    expect(applied).toBe(2);
    expect(refused.map((r) => r.key)).toEqual(['shell.content.ambiguous', 'shell.content.orMaybe', content[0], 'shell.nope']);
  });
});
