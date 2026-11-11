// What the Worker writes to its log (trust spec TRUST-1 §3). Cloudflare keeps the Worker's own console lines for 3-7
// days, so no line may carry a person, a header, a secret or anything a child or parent typed. wrangler.toml turns the
// invocation logs (every request's address and headers) off. A static scan of every console call in the code the
// Worker runs (worker/src and the shared modules it imports): an argument may not name a forbidden word, as an
// identifier (also inside a longer camelCase name: studentNote, bodyText) or as a header name in a string.
// The durable lane (DURABLE-8) adds its vault words to these lists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOTS = [path.join(here, '..', 'src'), path.join(here, '..', '..', 'shared')];

/** Names an argument may not carry: request content, sign-in and class secrets, addresses and request details. */
export const FORBIDDEN_NAMES = [
  'body', 'input', 'messages', 'note', 'question', 'text', 'image', 'pin', 'code', // what was typed or sent; a PIN or sign-in code
  'email', 'token', 'headers', 'url', 'pathname', // DURABLE-8's rule: req.url, url.pathname, an address; and any token or header
];
/** Header names that may not appear in a console call, as a string or a property name. */
export const FORBIDDEN_HEADERS = ['X-Device', 'X-Family-Device', 'X-Teacher-Key', 'X-Account-Token', 'Authorization', 'CF-Connecting-IP'];
/**
 * The only lines allowed to name a forbidden word, and why. Both run only with EMAIL_DEV_LOG = "true" on a Worker whose
 * PUBLIC_URL is on localhost (account.js devLogAllowed, email.js noticeDevLog): a developer's own machine, where no
 * email can be sent, never production.
 */
export const ALLOWED = [
  { file: 'email.js', line: 'if (devLog) { console.log(`[dev] login code: ${code}`); return; }', why: 'the sign-in code on a local dev Worker (devLog)' },
  { file: 'email.js', line: 'console.log(`[dev] notice ${row.kind}: ${msg.subject}`);', why: 'a notice subject on a local dev Worker (noticeDevLog)' },
];

const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return files(p);
  return /\.(m?js)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
});

/**
 * Tokens of a piece of code: { t: 'str', v } for a quoted string or a template's fixed text, { t: 'id', v } for a name,
 * { t: 'p', v } for anything else. Template expressions are tokenised in place. Comments are skipped.
 */
export function tokens(src) {
  const out = [];
  let i = 0;
  const readQuoted = (q) => {
    let s = ''; i++;
    while (i < src.length && src[i] !== q) { if (src[i] === '\\') { s += src[i + 1]; i += 2; } else s += src[i++]; }
    i++;
    return s;
  };
  const readTemplate = () => {
    i++;
    let s = '';
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        out.push({ t: 'str', v: s }); s = '';
        i += 2;
        let depth = 1; const start = i;
        while (i < src.length && depth > 0) {
          if (src[i] === '{') depth++;
          else if (src[i] === '}') depth--;
          else if (src[i] === '`') { readTemplate(); continue; }
          else if (src[i] === "'" || src[i] === '"') { readQuoted(src[i]); continue; }
          i++;
        }
        out.push({ t: 'p', v: '${' }, ...tokens(src.slice(start, i - 1)), { t: 'p', v: '}' });
        continue;
      }
      s += src[i++];
    }
    i++;
    out.push({ t: 'str', v: s });
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
    if (c === "'" || c === '"') { out.push({ t: 'str', v: readQuoted(c) }); continue; }
    if (c === '`') { readTemplate(); continue; }
    const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 200));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    if (!/\s/.test(c)) out.push({ t: 'p', v: c });
    i++;
  }
  return out;
}

/** The parts of a name: studentNote → student, note; X_DEVICE → x, device. */
const parts = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_$]+/).filter(Boolean).map((w) => w.toLowerCase());
const HEADERS = FORBIDDEN_HEADERS.map((h) => h.toLowerCase());

/** Every console call in a source file: { line (the source line it starts on), text, problems }. */
export function consoleCalls(src) {
  const calls = [];
  const re = /\bconsole\b/g;
  let m;
  while ((m = re.exec(src))) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const lineEnd = src.indexOf('\n', m.index);
    const line = src.slice(lineStart, lineEnd < 0 ? src.length : lineEnd).trim();
    // console mentioned in a comment is not a call
    const before = src.slice(lineStart, m.index);
    if (before.includes('//') || /^\s*\*/.test(before)) continue;
    const head = /^console\.(log|error|warn|info|debug|trace)\(/.exec(src.slice(m.index));
    if (!head) { calls.push({ line, text: '', problems: ['console used other than as console.<level>(…)'] }); continue; }
    // the arguments: up to the matching parenthesis, strings and templates skipped
    let i = m.index + head[0].length; let depth = 1; const start = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') {
        const q = c; i++;
        while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      } else if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    const text = src.slice(start, i - 1);
    const problems = [];
    for (const tk of tokens(text)) {
      if (tk.t === 'id') {
        for (const w of parts(tk.v)) if (FORBIDDEN_NAMES.includes(w)) problems.push(`names "${w}" (${tk.v})`);
      } else if (tk.t === 'str') {
        const s = tk.v.trim().toLowerCase();
        if (HEADERS.includes(s)) problems.push(`names the header ${tk.v}`);
      }
      if (tk.t === 'id' && HEADERS.includes(tk.v.toLowerCase())) problems.push(`names the header ${tk.v}`);
    }
    calls.push({ line, text, problems });
  }
  return calls;
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

test('no console line names a person, a header, a secret or request content', () => {
  const found = [];
  let calls = 0;
  for (const root of ROOTS) {
    for (const file of files(root)) {
      const src = readFileSync(file, 'utf8');
      for (const c of consoleCalls(src)) {
        calls++;
        if (!c.problems.length) continue;
        const name = path.basename(file);
        if (ALLOWED.some((a) => a.file === name && a.line === c.line)) continue;
        found.push(`${path.relative(path.join(here, '..', '..'), file)}: ${c.line}\n    ${c.problems.join('; ')}`);
      }
    }
  }
  assert.ok(calls >= 10, `the scan found the Worker's console calls (${calls})`);
  assert.deepEqual(found, [], `console lines that may leak:\n${found.join('\n')}`);
});

test('the two allowed lines still exist, word for word, and run only on a local dev Worker', () => {
  const email = readFileSync(path.join(here, '..', 'src', 'email.js'), 'utf8');
  for (const a of ALLOWED) {
    const src = readFileSync(path.join(here, '..', 'src', a.file), 'utf8');
    assert.ok(src.split('\n').some((l) => l.trim() === a.line), `still in ${a.file}: ${a.line} (update ALLOWED when it changes)`);
  }
  // the notice line sits in flushNotices, which returns at once unless Resend is set or the dev log is allowed
  assert.match(email, /if \(!emailReady\(env\) && !noticeDevLog\(env\)\) return \{ sent: 0 \};/);
  assert.match(email, /String\(env\.EMAIL_DEV_LOG\) !== 'true'/);
  const account = readFileSync(path.join(here, '..', 'src', 'account.js'), 'utf8');
  assert.match(account, /export function devLogAllowed\(req, env\)/);
});

test('the scan itself: it catches what it must and passes plain lines', () => {
  const bad = [
    'console.log(req.body)', 'console.error("x", input)', 'console.log(JSON.stringify(messages))', 'console.warn(studentNote)',
    "console.log(req.headers.get('X-Device'))", 'console.log(`pin ${pin}`)', "console.error('h', 'Authorization')", 'console.log(url.pathname)',
    'console.log(questionText)', 'const log = console.log;', 'console.info(a.email)', 'console.debug(teacherKey, code)',
  ];
  for (const s of bad) assert.ok(consoleCalls(s).some((c) => c.problems.length), `caught: ${s}`);
  const fine = ["console.error('email send failed', res.status)", "console.error('cron', name, e?.message)", 'console.error(`ai ${kind}`, reason, e?.status)',
    "console.error('ai', 'generate', reason) // the request body is never logged"];
  for (const s of fine) assert.deepEqual(consoleCalls(s).flatMap((c) => c.problems), [], `passes: ${s}`);
});
