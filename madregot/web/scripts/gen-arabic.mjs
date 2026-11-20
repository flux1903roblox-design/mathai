// The Arabic teaching content and exercises (COUNCIL2-34): each Hebrew content file has an Arabic twin next to it
// (signed.ts → signed.ar.ts, grade7.js → grade7.ar.js), made from the Hebrew file and the translations in
// src/content/ar/grade7.json. The twin is the same code with every Hebrew string, template and template part replaced
// by its Arabic (a template's ${…} parts kept, in the order the Arabic needs them), so the exercises, their answers and
// their checks are the Hebrew file's own: only the words differ. Imports of other twinned files point to their twins.
//
// The Hebrew stays the source. When it changes, `check` names the texts that have no Arabic yet, the reviewer's sheet
// (scripts/locale-sheet.mjs) lists them, and `build` writes the twins again. learn/arabic.test.ts fails when a twin is
// stale, when a twin keeps a Hebrew word, or when a template's values differ between the two languages.
//
//   node scripts/gen-arabic.mjs build            write every twin (a topic file only when all its texts have Arabic)
//   node scripts/gen-arabic.mjs check            list what is missing; exit 1 when a twin is stale or incomplete
//   node scripts/gen-arabic.mjs units <file>…    the texts of these files that have no Arabic yet, as JSON (id, he)
//   node scripts/gen-arabic.mjs add <json>       add translations: a JSON object { id: "Arabic text" }
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MAP_FILE = join(WEB, 'src/content/ar/grade7.json');

/** The twinned files: each topic file is twinned only when every text in it has Arabic (strict). */
export const TWINS = [
  'src/content/grade7.js', 'src/content/signed6.js',
  'src/learn/content/signed.ts', 'src/learn/content/signed6.ts',
  'src/learn/challenges/signed.ts',
];
/** The topic each twinned file teaches in Arabic (content/arabic.js ARABIC_TOPICS lists it once all of them are whole). */
export const TWIN_TOPIC = Object.freeze(Object.fromEntries(TWINS.map((f) => [f, 'signed'])));
/** The generated meta files: their twins keep the Hebrew of a topic that has no Arabic yet (the app's other grades). */
export const PARTIAL = ['src/learn/content/meta.gen.ts', 'src/content/topics.gen.js', 'src/learn/challenges/meta.gen.ts', 'src/content/lessons.js'];

const HEB = /[֐-׿]/;
const OPEN = '⟦'; const CLOSE = '⟧'; // ⟦0⟧: a template's value, as the translation sees it
export const twinOf = (file) => file.replace(/(\.[jt]s)$/, '.ar$1');
export const idOf = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);

export function readMap() { return existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, 'utf8')) : {}; }
export function writeMap(map) {
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(MAP_FILE, `${JSON.stringify(sorted, null, 1)}\n`);
}

const kindOf = (file) => (file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);

/** A template's parts as one text with ⟦i⟧ for each value; String.raw templates keep their raw text. */
function templateText(node, raw) {
  const part = (p) => (raw ? p.rawText : p.text);
  return part(node.head) + node.templateSpans.map((s, i) => `${OPEN}${i}${CLOSE}${part(s.literal)}`).join('');
}
const isRaw = (node) => ts.isTaggedTemplateExpression(node.parent) && node.parent.template === node;

/** Every Hebrew text of a file: { id, he } (strings, templates, String.raw templates). */
export function unitsOf(src, file) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kindOf(file));
  const out = [];
  const visit = (n) => {
    let text = null;
    if (ts.isStringLiteral(n)) text = n.text;
    else if (ts.isNoSubstitutionTemplateLiteral(n)) text = isRaw(n) ? n.rawText : n.text;
    else if (ts.isTemplateExpression(n)) {
      const t = templateText(n, isRaw(n));
      if ([n.head, ...n.templateSpans.map((s) => s.literal)].some((p) => HEB.test(p.text ?? p.rawText))) text = t;
    }
    if (text != null && HEB.test(text.replace(new RegExp(`${OPEN}\\d+${CLOSE}`, 'g'), ''))) out.push({ id: idOf(text), he: text });
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

const escTemplate = (s, raw) => (raw ? s : s.replace(/\\/g, '\\\\')).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const escString = (s, q) => JSON.stringify(s).slice(1, -1).replace(q === "'" ? /'/g : /(?!)/g, "\\'").replace(q === "'" ? /\\"/g : /(?!)/g, '"');

/**
 * The Arabic twin of a file. strict: every text must have Arabic (else { missing } and no code). Imports of a twinned
 * file point to its twin.
 */
export function twin(src, file, map, { strict = true, twinned = [] } = {}) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kindOf(file));
  const missing = [];
  const arOf = (text) => {
    const hit = map[idOf(text)];
    if (hit && hit[1]) return hit[1];
    missing.push({ id: idOf(text), he: text });
    return null;
  };
  const absTwinned = new Set(twinned.map((f) => join(WEB, f).replace(/\.[jt]s$/, '')));
  const rewriteSpec = (spec) => {
    let base = null;
    if (spec.startsWith('.')) base = resolve(dirname(join(WEB, file)), spec);
    else if (spec.startsWith('@/')) base = join(WEB, 'src', spec.slice(2));
    if (!base) return spec;
    const bare = base.replace(/\.[jt]sx?$/, '');
    if (!absTwinned.has(bare)) return spec;
    return spec.replace(/(\.[jt]s)?$/, (m) => `.ar${m || ''}`);
  };

  function replacement(node) {
    if (ts.isStringLiteral(node) && ts.isImportDeclaration(node.parent)) {
      const spec = rewriteSpec(node.text);
      return spec === node.text ? null : `'${spec}'`;
    }
    if (ts.isStringLiteral(node) && ts.isCallExpression(node.parent) && node.parent.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const spec = rewriteSpec(node.text);
      return spec === node.text ? null : `'${spec}'`;
    }
    if (ts.isStringLiteral(node) && HEB.test(node.text)) {
      const ar = arOf(node.text);
      if (ar == null) return null;
      const q = node.getText(sf)[0];
      return `${q}${escString(ar, q)}${q}`;
    }
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const raw = isRaw(node);
      const he = raw ? node.rawText : node.text;
      if (!HEB.test(he)) return null;
      const ar = arOf(he);
      return ar == null ? null : `\`${escTemplate(ar, raw)}\``;
    }
    if (ts.isTemplateExpression(node)) {
      const raw = isRaw(node);
      if (![node.head, ...node.templateSpans.map((s) => s.literal)].some((p) => HEB.test(raw ? p.rawText : p.text))) return null;
      const he = templateText(node, raw);
      const ar = arOf(he);
      const values = node.templateSpans.map((s) => emit(s.expression).trim());
      if (ar == null) return null;
      const parts = ar.split(new RegExp(`(${OPEN}\\d+${CLOSE})`));
      return `\`${parts.map((p) => {
        const m = new RegExp(`^${OPEN}(\\d+)${CLOSE}$`).exec(p);
        return m ? `\${${values[Number(m[1])]}}` : escTemplate(p, raw);
      }).join('')}\``;
    }
    return null;
  }
  function emit(node) {
    const r = replacement(node);
    if (r != null) return src.slice(node.pos, node.getStart(sf)) + r;
    const kids = node.getChildren(sf).filter((k) => k.kind < ts.SyntaxKind.FirstJSDocNode || k.kind > ts.SyntaxKind.LastJSDocNode);
    if (!kids.length) return src.slice(node.pos, node.end);
    let out = ''; let cur = node.pos;
    for (const k of kids) { out += src.slice(cur, k.pos); out += emit(k); cur = k.end; }
    return out + src.slice(cur, node.end);
  }
  const body = emit(sf);
  if (strict && missing.length) return { missing };
  const head = `// GENERATED by scripts/gen-arabic.mjs from ${relative(join(WEB, 'src'), join(WEB, file))} and content/ar/grade7.json (COUNCIL2-34).\n// Do not edit: change the Hebrew file or the translation, then run node scripts/gen-arabic.mjs build.\n`;
  return { code: head + body, missing };
}

/** Every twin as it should be: { file, twin, code, missing }. */
export function buildAll(map = readMap()) {
  const out = [];
  for (const file of TWINS) out.push({ file, twin: twinOf(file), ...twin(readFileSync(join(WEB, file), 'utf8'), file, map, { strict: true, twinned: TWINS }) });
  for (const file of PARTIAL) out.push({ file, twin: twinOf(file), ...twin(readFileSync(join(WEB, file), 'utf8'), file, map, { strict: false, twinned: TWINS }) });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'units') {
    const map = readMap();
    const seen = new Set();
    const units = args.flatMap((f) => unitsOf(readFileSync(f, 'utf8'), f)).filter((u) => !map[u.id]?.[1] && !seen.has(u.id) && seen.add(u.id));
    console.log(JSON.stringify(units, null, 0).replace(/\},\{/g, '},\n{'));
  } else if (cmd === 'add') {
    const map = readMap();
    const add = JSON.parse(readFileSync(args[0], 'utf8'));
    // the Hebrew of each id, from the files that hold it
    const he = new Map([...TWINS, ...PARTIAL, ...args.slice(1)].flatMap((f) => unitsOf(readFileSync(join(WEB, f), 'utf8'), f)).map((u) => [u.id, u.he]));
    let n = 0;
    for (const [id, ar] of Object.entries(add)) {
      const h = he.get(id) ?? map[id]?.[0];
      if (h == null) { console.error(`unknown id ${id}`); continue; }
      const want = (h.match(new RegExp(`${OPEN}\\d+${CLOSE}`, 'g')) || []).sort().join();
      const got = (ar.match(new RegExp(`${OPEN}\\d+${CLOSE}`, 'g')) || []).sort().join();
      if (want !== got) { console.error(`${id}: values ${got} ≠ ${want}: ${ar}`); continue; }
      map[id] = [h, ar]; n += 1;
    }
    writeMap(map);
    console.log(`${n} added, ${Object.keys(map).length} in the map`);
  } else if (cmd === 'build' || cmd === 'check') {
    let bad = 0;
    for (const r of buildAll()) {
      const p = join(WEB, r.twin);
      // a file whose Hebrew has texts without Arabic has no twin: build removes a stale one, so nothing can load words
      // that no longer match the Hebrew (its topic is not in content/arabic.js ARABIC_TOPICS until it is whole again)
      if (!r.code) {
        console.log(`${r.file}: ${r.missing.length} texts without Arabic, no twin`);
        if (cmd === 'build' && existsSync(p)) { unlinkSync(p); console.log(`${r.twin} removed`); }
        if (cmd === 'check') bad += 1;
        continue;
      }
      const old = existsSync(p) ? readFileSync(p, 'utf8') : null;
      if (cmd === 'build') { if (old !== r.code) writeFileSync(p, r.code); console.log(`${r.twin}${r.missing.length ? ` (${r.missing.length} Hebrew kept)` : ''}`); }
      else if (old !== r.code) { console.log(`${r.twin} is stale`); bad += 1; }
    }
    if (cmd === 'check' && bad) process.exit(1);
  } else {
    console.log('usage: gen-arabic.mjs build | check | units <file>… | add <json>');
  }
}
