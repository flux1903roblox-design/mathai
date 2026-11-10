// Nothing secret or personal reaches the Worker's log (DURABLE-8, with TRUST-1's rule). Every console call in
// worker/src is read statically, and its arguments may not mention the request URL or path, an email, a request body,
// the AI input or messages, a request header's value, or the vault's secrets (the X-Vault header, the vault, its lookup,
// a blob, a code, anything sealed). String labels are free text: only the code in the arguments (identifiers, member
// paths, template ${...} parts) and header names are checked. Later lanes extend FORBIDDEN_* here; there is one such file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** Identifier words (split at camelCase and snake_case, any case) that may not be logged. `message` is fine, `messages` is not. */
const FORBIDDEN_WORDS = new Set([
  'email', 'emails', 'body', 'bodies', 'input', 'inputs', 'messages',
  // the vault (DURABLE-5): its header, the restore code, the lookup key, the encrypted blob
  'vault', 'vaults', 'lookup', 'lookups', 'blob', 'blobs', 'code', 'codes', 'sealed',
]);
/** Header names that may not appear in a logged argument (their values are secrets). */
const FORBIDDEN_HEADERS = new Set(['x-vault']);
/** Member paths that carry the request URL (the webhook path holds a secret): req.url, request.url, url, url.pathname... */
const urlPath = (segs) => segs[0] === 'url' || segs.some((s, i) => (s === 'req' || s === 'request') && segs[i + 1] === 'url');

/**
 * Known calls that would match, each allowed by its exact text, with the line that must guard it and the reason.
 * An entry whose call or guard is gone fails the test, so the list cannot go stale.
 */
const ALLOWED = [
  {
    file: 'email.js',
    call: 'console.log(`[dev] login code: ${code}`)',
    guard: 'if (devLog) { console.log(`[dev] login code: ${code}`); return; }',
    why: 'dev only: devLog is EMAIL_DEV_LOG on a localhost PUBLIC_URL (account.js), never a deployed Worker',
  },
  {
    file: 'index.js',
    call: "console.error('ai', kind, code, e?.status, e?.message)",
    guard: 'const code = aiErrorCode(e);',
    why: 'code here is the AI error word from aiErrorCode (busy, upstream...), not a secret',
  },
];

// ---------------------------------------------------------------- a small scanner for JavaScript source
/** The index just after the string literal that starts at i (quote at src[i]). */
function skipQuoted(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === q) return j + 1;
  }
  throw new Error(`unterminated string at ${i}`);
}
/** Template literal at i: returns { end, texts, exprs } (its text parts and its ${...} expressions). */
function readTemplate(src, i) {
  const texts = []; const exprs = [];
  let text = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { text += src[j + 1]; j++; } else if (c === '`') { texts.push(text); return { end: j + 1, texts, exprs }; } else if (c === '$' && src[j + 1] === '{') {
      texts.push(text); text = '';
      const close = closing(src, j + 1);
      exprs.push(src.slice(j + 2, close));
      j = close;
    } else text += c;
  }
  throw new Error(`unterminated template at ${i}`);
}
/** The index of the bracket that closes the one at `open` ( ( [ { ), skipping strings, templates and comments. */
function closing(src, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [pairs[src[open]]];
  for (let j = open + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"') j = skipQuoted(src, j) - 1;
    else if (c === '`') j = readTemplate(src, j).end - 1;
    else if (c === '/' && src[j + 1] === '/') j = src.indexOf('\n', j) < 0 ? src.length : src.indexOf('\n', j);
    else if (c === '/' && src[j + 1] === '*') j = src.indexOf('*/', j + 2) + 1;
    else if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack.at(-1)) { stack.pop(); if (!stack.length) return j; }
  }
  throw new Error(`unclosed bracket at ${open}`);
}
/** Split argument text into its code (string literals blanked) and its string contents, template parts included. */
function split(text) {
  let code = ''; const strings = [];
  for (let j = 0; j < text.length; j++) {
    const c = text[j];
    if (c === "'" || c === '"') {
      const end = skipQuoted(text, j);
      strings.push(text.slice(j + 1, end - 1));
      code += ' "" ';
      j = end - 1;
    } else if (c === '`') {
      const t = readTemplate(text, j);
      strings.push(...t.texts);
      for (const e of t.exprs) { const inner = split(e); code += ` ${inner.code} `; strings.push(...inner.strings); }
      j = t.end - 1;
    } else if (c === '/' && text[j + 1] === '/') {
      const nl = text.indexOf('\n', j); j = nl < 0 ? text.length : nl;
    } else if (c === '/' && text[j + 1] === '*') {
      j = text.indexOf('*/', j + 2) + 1;
    } else code += c;
  }
  return { code, strings };
}
const words = (ident) => ident.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_$]+/).filter(Boolean).map((w) => w.toLowerCase());

/** Every console.(log|error|warn|info|debug|trace) call in a source text: { call, args, line }. */
export function consoleCalls(src) {
  const out = [];
  for (const m of src.matchAll(/\bconsole\s*\.\s*(?:log|error|warn|info|debug|trace)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = closing(src, open);
    out.push({ call: src.slice(m.index, close + 1), args: src.slice(open + 1, close), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}
/** Why a call's arguments would leak, as a list of reasons (empty: the call is fine). */
export function leaks(args) {
  const { code, strings } = split(args);
  const why = [];
  if (/\bheaders\s*\.\s*get\s*\(/.test(code)) why.push('reads a request header');
  for (const s of strings) if (FORBIDDEN_HEADERS.has(s.trim().toLowerCase())) why.push(`header ${s}`);
  const paths = code.match(/[A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*)*/g) || [];
  for (const p of paths) {
    const segs = p.replace(/[\s?]/g, '').split('.');
    if (urlPath(segs)) why.push(`the request URL (${segs.join('.')})`);
    const bad = segs.flatMap(words).filter((w) => FORBIDDEN_WORDS.has(w));
    if (bad.length) why.push(`${segs.join('.')} (${[...new Set(bad)].join(', ')})`);
  }
  return why;
}

function sourceFiles(dir = SRC) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(full);
    return d.name.endsWith('.js') ? [full] : [];
  });
}

test('no console call in worker/src logs the request URL, an email, a body, the AI input, a header value or a vault secret', () => {
  const files = sourceFiles();
  assert.ok(files.some((f) => f.endsWith(`${path.sep}index.js`)), 'the scan reads worker/src');
  const found = [];
  let calls = 0;
  for (const f of files) {
    const rel = path.relative(SRC, f);
    for (const c of consoleCalls(readFileSync(f, 'utf8'))) {
      calls++;
      if (ALLOWED.some((a) => a.file === rel && a.call === c.call)) continue;
      const why = leaks(c.args);
      if (why.length) found.push(`${rel}:${c.line} ${c.call} -> ${why.join('; ')}`);
    }
  }
  assert.ok(calls >= 10, `the scan found the Worker's console calls (${calls})`);
  assert.deepEqual(found, []);
});

test('every allowed call still exists behind its guard (remove an entry once its line is gone)', () => {
  for (const a of ALLOWED) {
    const src = readFileSync(path.join(SRC, a.file), 'utf8');
    assert.ok(consoleCalls(src).some((c) => c.call === a.call), `${a.file}: ${a.call}`);
    assert.ok(src.includes(a.guard), `${a.file}: guard ${a.guard}`);
    assert.ok(leaks(a.call.slice(a.call.indexOf('(') + 1, -1)).length, `${a.file}: the entry is still needed`);
  }
});

test('the matcher checks itself: leaks are caught, labels and today\'s safe calls pass', () => {
  const caught = [
    "console.error('vault', req.headers.get('X-Vault'))",
    "console.error('header', 'X-Vault')",
    "console.log('join', req.url)",
    "console.warn('bad path', new URL(request.url).pathname)",
    'console.error(`no route for ${url.pathname}`)',
    "console.error('sent', email)",
    "console.error('sent to', account.email)",
    "console.error('bad json', body)",
    "console.log('ai', input.messages)",
    "console.error('ai', b.messages)",
    "console.error('vault put failed', sealedBlob)",
    "console.error('vault', lookupHash)",
    "console.error('restore', restoreCode)",
    "console.log({ code })",
    "console.error('vault', vault.id)",
    "console.error('escrow', row.sealed)",
    "console.error('a ) b', body)",
    "console.error(\n  'multi-line',\n  user_email,\n)",
  ];
  for (const src of caught) {
    const [c] = consoleCalls(src);
    assert.ok(c, `parsed: ${src}`);
    assert.ok(leaks(c.args).length, `must be caught: ${src}`);
  }
  const fine = [
    "console.error('unhandled', e?.message)",
    "console.error('email send failed', res.status)",
    "console.error('vault sync failed', e?.status)",
    "console.error('cron', name, e?.message)",
    "console.error('billing: provider unreachable', provider.id)",
    "console.error('spend' /* never the body */, e?.message)",
    'console.log(`[dev] notice ${row.kind}: ${msg.subject}`)',
  ];
  for (const src of fine) {
    const [c] = consoleCalls(src);
    assert.deepEqual(leaks(c.args), [], `must pass: ${src}`);
  }
  // a whole fixture file: every call is found, the one leak among them is reported
  const file = "function f(req, e) {\n  console.error('ok', e?.message);\n  const s = ')';\n  console.error('vault', req.headers.get('X-Vault'));\n}\n";
  const reported = consoleCalls(file).filter((c) => leaks(c.args).length).map((c) => c.line);
  assert.deepEqual(reported, [4]);
});
