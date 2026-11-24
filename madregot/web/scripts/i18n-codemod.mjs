// Moves a screen's Hebrew words into a catalogue (COUNCIL2-34): every Hebrew string, template and JSX text in the given
// files becomes t('<ns>.<file>.<n>') (a template's ${…} parts become named values: t(key, { name })), and the Hebrew,
// unchanged, goes into the catalogue file under that key. A string evaluated when the module loads (a constant at the
// top of a file), a comparison with a Hebrew literal and a Hebrew object key are not changed: they are listed, to be
// turned into functions by hand first (t() must run when the screen draws, in the language of that moment).
// Usage: node scripts/i18n-codemod.mjs <catalogue.he.json> <ns> <file>… [--dry]
// It is a tool for converting the next screens; the catalogues it writes are ordinary JSON that people edit after it.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, extname } from 'node:path';
import ts from 'typescript';

const HEB = /[֐-׿]/;

/** React's rule for JSX text: lines trimmed where they meet a line break, empty lines dropped, joined by one space. */
export function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let last = 0;
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) last = i; });
  let out = '';
  lines.forEach((line, i) => {
    let s = line.replace(/\t/g, ' ');
    if (i !== 0) s = s.replace(/^[ ]+/, '');
    if (i !== lines.length - 1) s = s.replace(/[ ]+$/, '');
    if (s) { out += s; if (i !== last) out += ' '; }
  });
  return out.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

const FN = new Set([ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor, ts.SyntaxKind.Constructor]);
const inFunction = (n) => { for (let p = n.parent; p; p = p.parent) if (FN.has(p.kind)) return true; return false; };

function declaresT(sf) {
  let found = false;
  const visit = (n) => {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name) && n.name.text === 't') found = true;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

/** Transform one file. Returns { code, entries: [[key, value]], flagged: [{ line, text, why }] }. */
export function convert(src, file, { ns, catalogue = {} }) {
  const kind = /\.tsx?$/.test(file) ? (file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) : (file.endsWith('x') ? ts.ScriptKind.JSX : ts.ScriptKind.JS);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const base = basename(file, extname(file)).replace(/\W+/g, '').toLowerCase();
  const prefix = `${ns}.${base}.`;
  const used = Object.keys(catalogue).filter((k) => k.startsWith(prefix)).map((k) => Number(k.slice(prefix.length))).filter(Number.isFinite);
  let n = used.length ? Math.max(...used) : 0;
  const byText = new Map(Object.entries(catalogue).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [JSON.stringify(v), k]));
  const entries = [];
  const flagged = [];
  const fname = declaresT(sf) ? 'tr' : 't';
  const keyFor = (value) => {
    const id = JSON.stringify(value);
    if (byText.has(id)) return byText.get(id);
    n += 1;
    const key = `${prefix}${n}`;
    byText.set(id, key);
    entries.push([key, value]);
    return key;
  };
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const flag = (node, why) => { flagged.push({ line: line(node), text: node.getText(sf).slice(0, 80), why }); };

  const skipReason = (node) => {
    const p = node.parent;
    if (!p) return null;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p)) return 'module';
    if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === node) return 'object key';
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) return 'comparison';
    if (ts.isCaseClause(p)) return 'comparison';
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && (p.expression.text === 't' || p.expression.text === 'tr')) return 'already';
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ['includes', 'startsWith', 'endsWith', 'test', 'indexOf', 'split', 'replace', 'match'].includes(p.expression.name.text)) return 'comparison';
    if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'RegExp') return 'comparison';
    if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return 'object key';
    if (!inFunction(node)) return 'module scope';
    return null;
  };

  const varName = (expr, i, taken) => {
    let name = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.name.text : `p${i}`;
    if (!/^\w+$/.test(name)) name = `p${i}`;
    let k = name; let j = 2;
    while (taken.has(k)) { k = `${name}${j}`; j += 1; }
    taken.add(k);
    return k;
  };

  function replacement(node) {
    if (ts.isJsxText(node)) {
      if (!HEB.test(node.text)) return null;
      const value = jsxTextValue(node.text);
      if (!value.trim()) return null;
      if (!inFunction(node)) { flag(node, 'module scope'); return null; }
      return `{${fname}('${keyFor(value)}')}`;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!HEB.test(node.text)) return null;
      const why = skipReason(node);
      if (why) { if (why !== 'already') flag(node, why); return null; }
      const call = `${fname}('${keyFor(node.text)}')`;
      return ts.isJsxAttribute(node.parent) ? `{${call}}` : call;
    }
    if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      if (!parts.some((p) => HEB.test(p))) return null;
      const why = skipReason(node);
      if (why) { if (why !== 'already') flag(node, why); return null; }
      const taken = new Set();
      let value = node.head.text;
      const vars = [];
      node.templateSpans.forEach((s, i) => {
        const name = varName(s.expression, i, taken);
        vars.push([name, emit(s.expression).trim()]);
        value += `{${name}}${s.literal.text}`;
      });
      const obj = vars.map(([k, e]) => (k === e ? k : `${k}: ${e}`)).join(', ');
      return `${fname}('${keyFor(value)}', { ${obj} })`;
    }
    return null;
  }

  function emit(node) {
    const r = replacement(node);
    // JSX text owns its spaces (its value keeps the ones React keeps): it is replaced whole
    if (r != null) return ts.isJsxText(node) ? r : src.slice(node.pos, node.getStart(sf)) + r;
    // JSDoc nodes are children too, over the same text as the next token's leading comments: skipped, or it doubles
    const kids = node.getChildren(sf).filter((k) => k.kind < ts.SyntaxKind.FirstJSDocNode || k.kind > ts.SyntaxKind.LastJSDocNode);
    if (!kids.length) return src.slice(node.pos, node.end);
    let out = ''; let cur = node.pos;
    for (const k of kids) { out += src.slice(cur, k.pos); out += emit(k); cur = k.end; }
    return out + src.slice(cur, node.end);
  }

  let code = emit(sf);
  if (entries.length && !new RegExp(`import \\{[^}]*\\bt\\b[^}]*\\} from '@/lib/i18n\\.js'`).test(code)) {
    const name = fname === 't' ? 't' : 't as tr';
    if (/import \{ localized \} from '@\/lib\/i18n\.js';/.test(code)) {
      code = code.replace("import { localized } from '@/lib/i18n.js';", `import { localized, ${name} } from '@/lib/i18n.js';`);
      return { code, entries, flagged };
    }
    const imp = `import { ${name} } from '@/lib/i18n.js';`;
    const imports = [...code.matchAll(/^import [^;]+;\s*$/gm)];
    if (imports.length) { const at = imports.at(-1).index + imports.at(-1)[0].length; code = `${code.slice(0, at)}\n${imp}${code.slice(at)}`; }
    else code = `${imp}\n${code}`;
  }
  return { code, entries, flagged };
}

/**
 * A constant at the top of a module that holds Hebrew words is computed again whenever the language changes:
 * `export const X = <value>;` becomes `export let X = localized(() => <value>, (v) => { X = v; });` (lib/i18n.js), so
 * every module that imports X reads the words of the current language (an import is a live binding) and no importer
 * changes. Then convert() turns the words inside the arrow into t() calls.
 */
export function wrapConstants(src, file) {
  const kind = /\.tsx?$/.test(file) ? (file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) : (file.endsWith('x') ? ts.ScriptKind.JSX : ts.ScriptKind.JS);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const hebrewText = (node) => {
    let found = false;
    const visit = (n) => {
      if (found) return;
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) && HEB.test(n.text)) {
        const p = n.parent;
        const cmp = ts.isBinaryExpression(p) || ts.isCaseClause(p) || ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) && p.name === n);
        if (!cmp) found = true;
      } else if (ts.isTemplateExpression(n) && [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].some((x) => HEB.test(x))) found = true;
      // words inside a function are already computed when it runs
      if (!found && !FN.has(n.kind)) ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };
  const edits = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    const decls = st.declarationList.declarations;
    if (decls.length !== 1) continue;
    const d = decls[0];
    if (!ts.isIdentifier(d.name) || !d.initializer || !hebrewText(d.initializer)) continue;
    const name = d.name.text;
    const type = d.type ? `: ${d.type.getText(sf)}` : '';
    const init = d.initializer.getText(sf);
    const exp = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? 'export ' : '';
    const body = /^[[{]/.test(init) ? `(${init})` : init;
    edits.push([st.getStart(sf), st.end, `${exp}let ${name}${type} = localized(() => ${body}, (v) => { ${name} = v; });`]);
  }
  let out = src;
  for (const [a, b, text] of edits.reverse()) out = out.slice(0, a) + text + out.slice(b);
  if (edits.length && !/import \{[^}]*\blocalized\b[^}]*\} from '@\/lib\/i18n\.js'/.test(out)) {
    const imports = [...out.matchAll(/^import [^;]+;\s*$/gm)];
    const imp = "import { localized } from '@/lib/i18n.js';";
    if (imports.length) { const at = imports.at(-1).index + imports.at(-1)[0].length; out = `${out.slice(0, at)}\n${imp}${out.slice(at)}`; }
    else out = `${imp}\n${out}`;
  }
  return { code: out, wrapped: edits.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  const [catFile, ns, ...files] = args;
  const catalogue = existsSync(catFile) ? JSON.parse(readFileSync(catFile, 'utf8')) : {};
  for (const file of files) {
    const wrapped = wrapConstants(readFileSync(file, 'utf8'), file);
    if (wrapped.wrapped) console.log(`${file}: ${wrapped.wrapped} constants recomputed per language`);
    const src = wrapped.code;
    const { code, entries, flagged } = convert(src, file, { ns, catalogue });
    for (const [k, v] of entries) catalogue[k] = v;
    console.log(`${file}: ${entries.length} new keys`);
    for (const f of flagged) console.log(`  ! line ${f.line} (${f.why}): ${f.text}`);
    if (!dry) writeFileSync(file, code);
    else if (process.argv.includes('--show')) console.log(code);
  }
  if (!dry) writeFileSync(catFile, `${JSON.stringify(catalogue, null, 2)}\n`);
}
