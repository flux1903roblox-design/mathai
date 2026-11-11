// The stylesheets that load with their screens (FOLLOWUP-23, after STUDENT-15): the teacher's (lazy/teacher.css), the
// parents' area's (lazy/parents.css), the legal pages' reading rules (lazy/legal.css) and the saving screens'
// (lazy/durable.css). A rule there must never be needed on a screen that has not loaded its file, so every selector in
// it names a class that only files covered by that stylesheet write: a file is covered when it imports the stylesheet,
// or statically imports a file that does, or when every file that imports it (statically or with import()) is covered.
// Classes are looked for in the source with comments removed; a class a template could build (`kpi-${tone}`) counts
// every file that builds such names. A cycle covers nothing by itself, so the check can only be stricter than needed.
// And the first load: main.jsx imports none of these files, and the demo class's code is not imported by it.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { transformWithEsbuild } from 'vite';

const SRC = join(dirname(new URL(import.meta.url).pathname), '..');
const read = (f) => readFileSync(f, 'utf8');

// ---------------------------------------------------------------- the source, its classes and its imports
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(n) && !/\.test\./.test(n)) files.push(p); } };
walk(SRC);
const code = new Map();
const raw = new Map(files.map((f) => [f, read(f)]));

function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = join(dirname(from), spec);
  else return null;
  base = base.split('?')[0];
  for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`, join(base, 'index.js'), join(base, 'index.ts')]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}
/** importers.get(file): the files that import it, statically or with import(); statics.get(file): what it imports statically. */
const importers = new Map();
const statics = new Map();
for (const [f, t] of raw) {
  statics.set(f, new Set());
  for (const m of t.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const to = resolve(f, m[1] || m[2] || m[3]);
    if (!to) continue;
    if (!importers.has(to)) importers.set(to, new Set());
    importers.get(to).add(f);
    if (!m[3]) statics.get(f).add(to);
  }
}
const imports = (f, sheet) => new RegExp(`import\\s+['"]@/styles/lazy/${sheet}['"]`).test(raw.get(f) || '');
/**
 * Is a file's markup only ever on screen with this stylesheet loaded? It imports the sheet, or statically imports a file
 * that does (a chunk's static imports load with it, their stylesheets first), or every file that imports it is covered.
 */
function coveredBy(sheet) {
  const brings = new Map();
  const bringsSheet = (f, seen = new Set()) => {
    if (brings.has(f)) return brings.get(f);
    if (seen.has(f)) return false;
    seen.add(f);
    const ok = imports(f, sheet) || [...(statics.get(f) || [])].some((g) => bringsSheet(g, seen));
    brings.set(f, ok);
    return ok;
  };
  const memo = new Map();
  const covered = (f) => {
    if (memo.has(f)) return memo.get(f);
    memo.set(f, false); // a cycle covers nothing by itself
    const from = [...(importers.get(f) || [])];
    const ok = bringsSheet(f) || (from.length > 0 && from.every(covered));
    memo.set(f, ok);
    return ok;
  };
  return covered;
}

const prefixes = [];
/** token → the files that have it: the code cut at quotes, spaces, braces, brackets, commas, colons and `$`. */
const tokens = new Map();
function writersOf(cls) {
  const out = new Set(tokens.get(cls) || []);
  for (const { p, file } of prefixes) if (cls.startsWith(p) && cls.length > p.length) out.add(file);
  return out;
}

// ---------------------------------------------------------------- the stylesheets' rules
/** Every style rule's selectors, @media and @supports opened, other at-rules (@keyframes, @page) skipped. */
function rules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const scan = (s) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const head = s.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      const body = s.slice(open + 1, j - 1);
      if (/^@(media|supports)\b/.test(head)) scan(body);
      else if (!head.startsWith('@')) out.push(head.split(/,(?![^(]*\))/).map((x) => x.trim()));
      i = j;
    }
  };
  scan(text);
  return out;
}
const required = (sel) => {
  let s = sel; for (let k = 0; k < 4; k++) s = s.replace(/:(not|is|where)\((?:[^()]|\([^()]*\))*\)/g, '');
  return [...new Set([...s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
};

beforeAll(async () => {
  for (const [f, t] of raw) {
    const loader = f.endsWith('.tsx') ? 'tsx' : f.endsWith('.ts') ? 'ts' : 'jsx';
    const out = (await transformWithEsbuild(t, f, { loader, jsx: 'preserve', minifyWhitespace: true, legalComments: 'none' })).code;
    // an id or a label's target is not a class (ProgressSummary's id="ps-title" is not the printed exam's .ps-title)
    code.set(f, out.replace(/\b(id|htmlFor|aria-labelledby|aria-describedby|aria-controls)=("[^"]*"|'[^']*')/g, ''));
  }
  for (const [f, t] of code) for (const w of t.split(/[\s'"`{}(),:$]+/)) { if (!tokens.has(w)) tokens.set(w, new Set()); tokens.get(w).add(f); }
  // a React key (key={`support-${id}`}) builds no class
  for (const [f, t] of code) for (const m of t.replace(/\bkey=\{`[^`]*`\}/g, '').matchAll(/[`\s]([a-z][a-z0-9]*(?:-[a-z0-9]+)*-)\$\{/g)) prefixes.push({ p: m[1], file: f });
}, 60_000);

describe('a lazy stylesheet styles only what the screens that load it write', () => {
  it.each(['teacher.css', 'parents.css', 'legal.css', 'durable.css'])('%s', { timeout: 30_000 }, (sheet) => {
    const covered = coveredBy(sheet);
    const bad = [];
    for (const selectors of rules(read(join(SRC, 'styles/lazy', sheet)))) {
      for (const sel of selectors) {
        const ok = required(sel).some((c) => { const w = writersOf(c); return w.size > 0 && [...w].every(covered); });
        if (!ok) bad.push(sel);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the files that write those classes import the stylesheet themselves, or come only through files that do', () => {
    const at = (p) => join(SRC, p);
    for (const f of ['screens/teacher/teacher.js', 'screens/teacher/TeacherStart.jsx', 'components/teacher/ClassSettingQuestion.jsx']) expect(imports(at(f), 'teacher.css'), f).toBe(true);
    for (const f of ['screens/parents/ParentsFrame.jsx', 'screens/parents/Parents.jsx']) expect(imports(at(f), 'parents.css'), f).toBe(true);
    for (const f of ['screens/parents/Legal.jsx', 'screens/teacher/Guide.jsx']) expect(imports(at(f), 'legal.css'), f).toBe(true);
    for (const f of ['components/durable/SaveSection.jsx', 'components/durable/SupportInfo.jsx', 'components/learn/ReminderSettings.jsx', 'components/durable/BackupCodeSheet.jsx', 'screens/Restore.jsx']) expect(imports(at(f), 'durable.css'), f).toBe(true);
  });
});

describe('the first load (FOLLOWUP-23)', () => {
  const main = read(join(SRC, 'main.jsx'));
  const app = read(join(SRC, 'App.jsx'));

  it('main.jsx imports no lazy stylesheet', () => {
    expect(main).not.toMatch(/styles\/lazy\//);
  });

  it('the boot stylesheets keep none of the moved screens\' own classes', () => {
    const boot = ['app.css', 'v4.css', 'canon.css'].map((f) => read(join(SRC, 'styles', f)).replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
    const left = ['t-head', 't-tools', 'demo-banner', 'preview-bar', 'print-root', 'ps-q', 'licence-card', 'teacher-off', 'parents-bar', 'parents-card', 'handoff-code', 'adult-form', 'legal', 'save-row', 'save-backup', 'support-rows', 'backup-code-body', 'restore-form']
      .filter((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(boot));
    expect(left).toEqual([]);
  });

  it('the demo class\'s code loads only when the address or this tab asks for it', () => {
    expect(main).not.toMatch(/from '\.\/lib\/demo\.js'/);
    expect(main).toMatch(/if \(demoWanted\(\)\) \{[^}]*\(await import\('\.\/lib\/demo\.js'\)\)\.bootDemo\(\);/);
    expect(app).not.toMatch(/from '@\/lib\/demo\.js'|from '@\/components\/DemoAsk\.jsx'/);
    const boot = [...(importers.get(join(SRC, 'lib/demo.js')) || [])].map((f) => relative(SRC, f));
    for (const f of ['main.jsx', 'App.jsx', 'screens/Welcome.jsx', 'components/DemoAsk.jsx']) {
      if (boot.includes(f)) expect(read(join(SRC, f)), f).toMatch(/import\('(\.|@)\/lib\/demo\.js'\)|import\('\.\/lib\/demo\.js'\)/);
    }
  });
});
