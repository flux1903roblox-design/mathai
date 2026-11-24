// The lawyer's privacy documents (COUNCIL2-7, COUNCIL2-3 code side). docs/privacy/DATABASE_DEFINITIONS.md is generated from
// worker/datamap.json and shared/retention.js by scripts/privacy-docs.mjs: it must be exactly what the script prints (so
// a new table, column or retention number reaches the lawyer's copy in the same commit), and it must name every table
// and column of the map and every retention number. The three hand-written drafts (security procedure, DPIA, school DPA)
// exist, say they are drafts, keep blanks for the owner's business details, and are linked from the lawyer's packet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { render, readMap, retentionNotes, OUT } from '../scripts/privacy-docs.mjs';
import { RETENTION } from '../../shared/retention.js';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const MAP = readMap();
const DOC = read(OUT);

test('the database definitions document is what the script makes of the data map and the retention numbers', () => {
  assert.equal(DOC, render(), `${OUT} is stale: run node worker/scripts/privacy-docs.mjs --write`);
});

test('it names every table of the data map, each with every one of its columns', () => {
  for (const [t, e] of Object.entries(MAP.tables)) {
    const at = DOC.indexOf(`### \`${t}\`\n`);
    assert.ok(at >= 0, `${t}: no section`);
    const section = DOC.slice(at, DOC.indexOf('\n### ', at + 1) === -1 ? undefined : DOC.indexOf('\n### ', at + 1));
    for (const f of e.fields) assert.ok(section.includes(`\`${f}\``), `${t}.${f}: missing`);
    assert.ok(section.includes(e.purpose) && section.includes(e.retention), `${t}: purpose or retention not quoted`);
  }
  // and a table or a column the map does not have would fail the first test: render() is made from the map alone
  const extra = { ...MAP, tables: { ...MAP.tables, new_table: { ...MAP.tables.classes, fields: ['code', 'secret_column'] } } };
  assert.match(render(extra), /### `new_table`[\s\S]*`secret_column`/);
  assert.notEqual(render(extra), DOC);
});

test('it gives every retention number the purge uses, with the code\'s own reason', () => {
  const notes = retentionNotes();
  for (const [k, v] of Object.entries(RETENTION)) {
    const row = DOC.split('\n').find((l) => l.startsWith(`| \`${k}\` |`));
    assert.ok(row, `${k}: no row`);
    assert.match(row, new RegExp(`\\| ${v} (ימים|שנים) \\|`), `${k}: the number`);
    assert.ok(notes[k] && row.includes(notes[k].replace(/\|/g, '\\|')), `${k}: the reason`);
  }
  // a changed number changes the document
  assert.notEqual(render(MAP, { ...RETENTION, attemptsDays: 401 }), DOC);
});

test('it lists every recipient, the device keys and what the tutor receives', () => {
  for (const r of Object.keys(MAP.recipients)) assert.ok(DOC.includes(MAP.recipients[r].replace(/\|/g, '\\|')), r);
  for (const k of Object.keys(MAP.client)) assert.ok(DOC.includes(`| \`${k}\` |`), k);
  for (const s of MAP.ai.sent) assert.ok(DOC.includes(s), s.slice(0, 40));
});

const DRAFTS = ['docs/privacy/DATABASE_DEFINITIONS.md', 'docs/privacy/SECURITY_PROCEDURE.md', 'docs/privacy/DPIA.md', 'docs/privacy/SCHOOL_DPA.md'];

test('all four documents are marked as drafts, with blanks for the owner\'s business details', () => {
  for (const f of DRAFTS) {
    assert.ok(existsSync(new URL(f, ROOT)), `${f} missing`);
    const t = read(f);
    assert.match(t.split('\n').slice(0, 8).join('\n'), /טיוטה/, `${f}: says טיוטה at the top`);
    assert.match(t, /______/, `${f}: blanks for the owner`);
  }
});

test('the hand-written drafts describe what the code does, and name the owner\'s steps as such', () => {
  const sec = read('docs/privacy/SECURITY_PROCEDURE.md');
  // the measures the code really has, by the file that does each
  for (const f of ['worker/src/cron.js', 'worker/src/forget.js', 'worker/src/edge.js', 'shared/retention.js', 'wrangler.toml', 'web/src/lib/durable/crypto.js']) assert.ok(sec.includes(f), `security procedure: ${f}`);
  for (const f of [sec, read('docs/privacy/DPIA.md'), read('docs/privacy/SCHOOL_DPA.md')]) assert.match(f, /צעד של הבעלים/);
  // the school DPA lists the same processors as the data map
  const dpa = read('docs/privacy/SCHOOL_DPA.md');
  for (const name of ['Cloudflare', 'Anthropic', 'Resend']) assert.ok(dpa.includes(name), `DPA: ${name}`);
  // and the retention numbers it quotes are the purge's
  assert.ok(dpa.includes(`${RETENTION.studentIdleDays} ימים`) && dpa.includes(`${RETENTION.classIdleDays} ימים`));
});

test('the lawyer\'s packet links the four documents in §3 as drafts for the lawyer', () => {
  const packet = read('docs/legal/LAWYER_PACKET.md');
  const s3 = packet.slice(packet.indexOf('## 3.'), packet.indexOf('## 4.'));
  for (const f of DRAFTS) assert.ok(s3.includes(f.replace('docs/', '../')), `§3 links ${f}`);
  assert.match(s3, /טיוטות/);
});
