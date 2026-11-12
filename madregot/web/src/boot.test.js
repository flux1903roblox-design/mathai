// What the first load must not carry (the boot split, QA_DURABLE.md): the files main.jsx reaches through static imports
// are the boot chunk, so none of them may be exercise code: a topic's generators (any src/content/*.js that defines a
// stair's `gen`), the checkers and the figures' words (content/index.js, content/manip.js), a challenge task's parts
// (learn/challenges/<topic>.ts and all.ts), a topic's teaching (learn/content/<topic>.ts), or the engines that make and
// grade questions (lib/lesson.js, lib/placement.js, lib/exam.js, lib/seeds.js, learn/items.ts). The lists are read from
// the folders, so a new topic's files are covered without editing this test. npm run build checks the built files the
// same way (budget.json lazyOnly, scripts/check-budget.mjs); this finds a new static import before a build.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const SRC = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(SRC, '..');
const SHARED = resolve(WEB, '../shared');
const EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.ts', '/index.jsx'];
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('@shared/')) base = join(SHARED, spec.slice(8));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return `package:${spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/')}`;
  base = base.split('?')[0];
  for (const e of EXTS) if (existsSync(base + e) && statSync(base + e).isFile()) return base + e;
  throw new Error(`${relative(WEB, from)}: cannot resolve ${spec}`);
}

/** Every file and package main.jsx reaches by static import or re-export (not import(), not import type). */
function bootGraph() {
  const seen = new Map([[join(SRC, 'main.jsx'), null]]);
  const queue = [...seen.keys()];
  while (queue.length) {
    const f = queue.shift();
    if (f.startsWith('package:') || !/\.(jsx?|tsx?|mjs)$/.test(f)) continue;
    for (const m of strip(readFileSync(f, 'utf8')).matchAll(/^\s*(import|export)\s+(type\s+)?(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      if (m[2]) continue;
      const to = resolveImport(f, m[3]);
      if (!seen.has(to)) { seen.set(to, f); queue.push(to); }
    }
  }
  const name = (p) => (p.startsWith('package:') ? p : relative(WEB, p).split('\\').join('/'));
  const why = (p) => { const chain = []; for (let c = p; c; c = seen.get(c)) chain.unshift(name(c)); return chain.join(' -> '); };
  return { files: [...seen.keys()].map(name), why: (n) => why([...seen.keys()].find((p) => name(p) === n)) };
}

const list = (dir, re) => readdirSync(join(SRC, dir)).filter((f) => re.test(f) && !/\.test\./.test(f)).map((f) => `src/${dir}/${f}`);
const read = (f) => strip(readFileSync(resolve(WEB, f), 'utf8'));

// a topic's generators: every content file that defines a stair's gen (grade7.js, eq.js, …, and a new topic's file)
const GENERATORS = list('content', /\.js$/).filter((f) => /\bgen\s*:/.test(read(f)));
// a challenge task's story and parts: every task file, and the list of all of them
const TASKS = [...list('learn/challenges', /\.ts$/).filter((f) => /\bparts\s*:/.test(read(f))), 'src/learn/challenges/all.ts'];
// a topic's teaching (DURABLE-11): every learn/content file but the registry and its meta
const TEACHING = list('learn/content', /\.ts$/).filter((f) => !/\/(index|meta\.gen)\.ts$/.test(f));
// the checkers and the engines that make and grade questions
const ENGINES = ['src/content/index.js', 'src/content/manip.js', 'src/lib/lesson.js', 'src/lib/placement.js', 'src/lib/exam.js', 'src/lib/seeds.js', 'src/learn/items.ts'];

describe('the first load (the files main.jsx imports statically)', () => {
  const boot = bootGraph();

  it('holds no exercise generator, checker, challenge part, teaching file or exercise engine', () => {
    const found = [...GENERATORS, ...TASKS, ...TEACHING, ...ENGINES].filter((f) => boot.files.includes(f));
    expect(found.map(boot.why)).toEqual([]);
  });

  it('the lists are real: the generator files of today\'s topics, every task file, every teaching file, every engine', () => {
    for (const f of ['src/content/grade7.js', 'src/content/grade8.js', 'src/content/eq.js', 'src/content/expr.js', 'src/content/frac.js', 'src/content/func.js', 'src/content/sys.js']) expect(GENERATORS, f).toContain(f);
    expect(TASKS.length).toBeGreaterThanOrEqual(14);
    expect(TEACHING.length).toBeGreaterThanOrEqual(13);
    for (const f of [...TASKS, ...ENGINES]) expect(existsSync(resolve(WEB, f)), f).toBe(true);
    // the first-load side is not on the lists (it would make the first test fail for the wrong reason)
    for (const f of ['src/content/topics.js', 'src/content/topics.gen.js', 'src/learn/challenges/index.ts', 'src/learn/challenges/meta.gen.ts']) expect([...GENERATORS, ...TASKS, ...TEACHING, ...ENGINES], f).not.toContain(f);
  });

  it('the boot is still the app: main.jsx reaches the store, the map, the shell and the first-load side of the content', () => {
    for (const f of ['src/App.jsx', 'src/lib/store.js', 'src/screens/Learn.jsx', 'src/screens/Welcome.jsx', 'src/components/Shell.jsx', 'src/content/topics.js', 'src/content/topics.gen.js', 'src/learn/content/meta.gen.ts', 'src/learn/challenges/index.ts', 'src/learn/challenges/meta.gen.ts', 'src/lib/lessonRules.js', 'src/lib/placementRules.js']) expect(boot.files, f).toContain(f);
  });
});
