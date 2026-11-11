// Nothing secret or personal reaches the Worker's log (trust spec TRUST-1 §3, with DURABLE-8's rule). Cloudflare keeps
// the Worker's own console lines for 3-7 days, so no line may carry a person, a header, a secret or anything a child or
// parent typed; wrangler.toml turns the invocation logs (every request's address and headers) off. Every console call
// in the code the Worker runs (worker/src and the shared modules it imports) is read statically, and its arguments may
// not mention the request URL or path, an email, a request body, the AI input or messages, what a child typed (a note,
// a question, a text, an image), a PIN or a sign-in code, a token, a request header's value or name (X-Device,
// Authorization ...), or the vault's secrets (the X-Vault header, the vault, its lookup, a blob, anything sealed), also
// inside a longer camelCase name (studentNote, bodyText). String labels are free text: only the code in the arguments
// (identifiers, member paths, template ${...} parts) and header names are checked. Later lanes extend FORBIDDEN_* here;
// there is one such file (the safety lane's TRUST-1 scan and the durable lane's DURABLE-8 scan, merged).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');
const SHARED = path.join(here, '..', '..', 'shared');

/** Identifier words (split at camelCase and snake_case, any case) that may not be logged. `message` is fine, `messages` is not. */
const FORBIDDEN_WORDS = new Set([
  'email', 'emails', 'body', 'bodies', 'input', 'inputs', 'messages',
  // what a child or parent typed or sent, a PIN or sign-in code, any token or header, an address (TRUST-1 §3)
  'note', 'notes', 'question', 'questions', 'text', 'texts', 'image', 'images', 'pin', 'pins', 'token', 'tokens',
  'headers', 'url', 'pathname',
  // the vault (DURABLE-5): its header, the restore code, the lookup key, the encrypted blob
  'vault', 'vaults', 'lookup', 'lookups', 'blob', 'blobs', 'code', 'codes', 'sealed',
]);
/** Header names that may not appear in a logged argument, as a string or a name (their values are secrets or identify someone). */
const FORBIDDEN_HEADERS = new Set(['x-vault', 'x-device', 'x-family-device', 'x-teacher-key', 'x-account-token', 'authorization', 'cf-connecting-ip']);
/** Member paths that carry the request URL (the webhook path holds a secret): req.url, request.url, url, url.pathname... */
const urlPath = (segs) => segs[0] === 'url' || segs.some((s, i) => (s === 'req' || s === 'request') && segs[i + 1] === 'url');

/**
 * Known calls that would match, each allowed by its exact text, with the line that must guard it and the reason.
 * An entry whose call or guard is gone fails the test, so the list cannot go stale. The sign-in code line runs only with
 * EMAIL_DEV_LOG = "true" on a Worker whose PUBLIC_URL is on localhost (account.js devLogAllowed): a developer's own
 * machine, where no email can be sent, never production.
 */
const ALLOWED = [
  {
    file: 'email.js',
    call: 'console.log(`[dev] login code: ${code}`)',
    guard: 'if (devLog) { console.log(`[dev] login code: ${code}`); return; }',
    why: 'dev only: devLog is EMAIL_DEV_LOG on a localhost PUBLIC_URL (account.js), never a deployed Worker',
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
    for (const s of segs) if (FORBIDDEN_HEADERS.has(s.toLowerCase())) why.push(`header ${s}`);
  }
  return why;
}

/** Lines where `console` is used other than as console.<level>(…) (an alias would hide a call from the scan). */
export function bareConsole(src) {
  const out = [];
  for (const m of src.matchAll(/\bconsole\b/g)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const before = src.slice(lineStart, m.index);
    if (before.includes('//') || /^\s*\*/.test(before) || /^\s*\/\*/.test(before)) continue;
    if (/^console\s*\.\s*(?:log|error|warn|info|debug|trace)\s*\(/.test(src.slice(m.index))) continue;
    out.push(src.slice(0, m.index).split('\n').length);
  }
  return out;
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(full);
    return /\.m?js$/.test(d.name) && !/\.test\./.test(d.name) ? [full] : [];
  });
}

test('wrangler.toml keeps the Worker logs but turns the invocation logs (request headers) off', () => {
  const toml = readFileSync(path.join(here, '..', 'wrangler.toml'), 'utf8');
  const section = (name) => {
    const at = toml.indexOf(`\n[${name}]\n`);
    assert.ok(at >= 0, `[${name}] is in wrangler.toml`);
    const rest = toml.slice(at + name.length + 4);
    return rest.slice(0, rest.search(/\n\[/) < 0 ? rest.length : rest.search(/\n\[/));
  };
  assert.match(section('observability'), /^enabled = true$/m);
  assert.match(section('observability.logs'), /^invocation_logs = false$/m);
  assert.equal((toml.match(/^\[observability\]$/gm) || []).length, 1, 'one block');
});

test('no console call in worker/src or shared/ logs the request URL, an email, a body, the AI input, what a child typed, a PIN or code, a token, a header or a vault secret', () => {
  const files = [...sourceFiles(SRC), ...sourceFiles(SHARED)];
  assert.ok(files.some((f) => f.endsWith(`${path.sep}index.js`)), 'the scan reads worker/src');
  assert.ok(files.some((f) => f.endsWith(`${path.sep}ai.js`)), 'the scan reads shared/');
  const found = [];
  let calls = 0;
  for (const f of files) {
    const rel = path.relative(SRC, f);
    const src = readFileSync(f, 'utf8');
    for (const line of bareConsole(src)) found.push(`${rel}:${line} console used other than as console.<level>(…)`);
    for (const c of consoleCalls(src)) {
      calls++;
      if (ALLOWED.some((a) => a.file === rel && a.call === c.call)) continue;
      const why = leaks(c.args);
      if (why.length) found.push(`${rel}:${c.line} ${c.call} -> ${why.join('; ')}`);
    }
  }
  assert.ok(calls >= 10, `the scan found the Worker's console calls (${calls})`);
  assert.deepEqual(found, []);
});

test('every allowed call still exists behind its guard (remove an entry once its line is gone), and runs only on a local dev Worker', () => {
  for (const a of ALLOWED) {
    const src = readFileSync(path.join(SRC, a.file), 'utf8');
    assert.ok(consoleCalls(src).some((c) => c.call === a.call), `${a.file}: ${a.call}`);
    assert.ok(src.includes(a.guard), `${a.file}: guard ${a.guard}`);
    assert.ok(leaks(a.call.slice(a.call.indexOf('(') + 1, -1)).length, `${a.file}: the entry is still needed`);
  }
  // the dev notice line (a subject, never a code) sits in flushNotices, which returns at once unless Resend is set or
  // the dev log is allowed; the dev log needs EMAIL_DEV_LOG and a localhost PUBLIC_URL
  const email = readFileSync(path.join(SRC, 'email.js'), 'utf8');
  assert.ok(email.split('\n').some((l) => l.trim() === 'console.log(`[dev] notice ${row.kind}: ${msg.subject}`);'), 'the dev notice line');
  assert.match(email, /if \(!emailReady\(env\) && !noticeDevLog\(env\)\) return \{ sent: 0 \};/);
  assert.match(email, /String\(env\.EMAIL_DEV_LOG\) !== 'true'/);
  const account = readFileSync(path.join(SRC, 'account.js'), 'utf8');
  assert.match(account, /export function devLogAllowed\(req, env\)/);
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
    // TRUST-1 §3
    'console.log(req.body)', 'console.error("x", input)', 'console.log(JSON.stringify(messages))', 'console.warn(studentNote)',
    "console.log(req.headers.get('X-Device'))", 'console.log(`pin ${pin}`)', "console.error('h', 'Authorization')", 'console.log(url.pathname)',
    'console.log(questionText)', 'console.info(a.email)', 'console.debug(teacherKey, code)', 'console.log(Authorization)',
    "console.error('t', b.token)", "console.error('img', helpImage)",
  ];
  for (const src of caught) {
    const [c] = consoleCalls(src);
    assert.ok(c, `parsed: ${src}`);
    assert.ok(leaks(c.args).length, `must be caught: ${src}`);
  }
  assert.deepEqual(bareConsole('const log = console.log;'), [1], 'an alias of console is caught');
  assert.deepEqual(bareConsole("// console here is a comment\nconsole.error('ok', e?.message);"), [], 'a comment and a call pass');
  const fine = [
    "console.error('unhandled', e?.message)",
    "console.error('email send failed', res.status)",
    "console.error('vault sync failed', e?.status)",
    "console.error('cron', name, e?.message)",
    "console.error('billing: provider unreachable', provider.id)",
    "console.error('spend' /* never the body */, e?.message)",
    'console.log(`[dev] notice ${row.kind}: ${msg.subject}`)',
    'console.error(`ai ${kind}`, reason, e?.status)',
    "console.error('ai', 'generate', reason) // the request body is never logged",
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
