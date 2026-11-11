// What the first load must not carry (COUNCIL2-14, COUNCIL2-37): the files main.jsx reaches through static imports
// are the boot chunk, so none of them may be the tutor's prompts, a topic's exercise generators, a challenge task's
// parts, motion's animation features, Base UI, KaTeX or markdown. npm run build checks the built files the same way
// (budget.json lazyOnly and neverInBoot, scripts/check-budget.mjs); this finds a new static import before a build.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const SRC = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(SRC, '..');
const SHARED = resolve(WEB, '../shared');
const EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.ts', '/index.jsx'];

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
    const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of text.matchAll(/^\s*(import|export)\s+(type\s+)?(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      if (m[2]) continue;
      const to = resolveImport(f, m[3]);
      if (!seen.has(to)) { seen.set(to, f); queue.push(to); }
    }
  }
  const name = (p) => (p.startsWith('package:') ? p : relative(WEB, p).split('\\').join('/'));
  const why = (p) => { const chain = []; for (let c = p; c; c = seen.get(c)) chain.unshift(name(c)); return chain.join(' -> '); };
  return { files: [...seen.keys()].map(name), why: (n) => why([...seen.keys()].find((p) => name(p) === n)) };
}

const NEVER = [
  // the tutor's prompts and the code that builds them (shared/ai.js, the personal-key path in lib/ai.js)
  '../shared/ai.js', '../shared/pedagogy.js', '../shared/guard.js', '../shared/topicWays.js', '../shared/tutorContext.js', 'src/lib/ai.js',
  // the exercise generators, per topic (content/index.js loadGens)
  'src/content/grade7.js', 'src/content/grade8.js', 'src/content/expr.js', 'src/content/eq.js', 'src/content/frac.js',
  'src/content/linear.js', 'src/content/sys.js', 'src/content/ratio.js', 'src/content/pct.js', 'src/content/signed6.js',
  // the challenge tasks' parts (the plan reads learn/challenges/meta.gen.ts)
  'src/learn/challenges/index.ts', 'src/learn/challenges/signed.ts', 'src/learn/challenges/frac.ts', 'src/learn/challenges/line.ts',
  // what loads after the first screen: the sheet's dialog, the choice controls, motion's features
  'src/components/SheetDialog.jsx', 'src/components/choices.jsx', 'src/lib/motionFeatures.js',
  // the lesson's, the exam's and the placement test's engines (their rules are in lessonRules, examFocus, placementRules)
  'src/lib/lesson.js', 'src/lib/exam.js', 'src/lib/placement.js', 'src/learn/items.ts',
  'package:@base-ui/react', 'package:katex', 'package:react-markdown',
];

describe('the first load (the files main.jsx imports statically)', () => {
  const boot = bootGraph();

  it('holds none of the tutor\'s prompts, generators, challenge parts, Base UI, KaTeX or markdown', () => {
    const found = NEVER.filter((f) => boot.files.includes(f));
    expect(found.map(boot.why)).toEqual([]);
  });

  it('every file in the list exists, so a rename cannot make the test pass by itself', () => {
    for (const f of NEVER.filter((x) => !x.startsWith('package:'))) expect(existsSync(resolve(WEB, f)), f).toBe(true);
  });

  it('motion\'s animation features load after the first screen: LazyMotion gets a function, strict, and no boot file names domAnimation or domMax', () => {
    const app = readFileSync(join(SRC, 'App.jsx'), 'utf8');
    expect(app).toMatch(/<LazyMotion features=\{loadMotionFeatures\} strict>/);
    expect(readFileSync(join(SRC, 'lib/motion.js'), 'utf8')).toMatch(/export const loadMotionFeatures = \(\) => import\('\.\/motionFeatures\.js'\)/);
    const named = boot.files.filter((f) => !f.startsWith('package:') && /\b(domAnimation|domMax)\b/.test(readFileSync(resolve(WEB, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')));
    expect(named).toEqual([]);
  });

  it('the boot is still the app: main.jsx reaches the store, the map and the shell', () => {
    for (const f of ['src/App.jsx', 'src/lib/store.js', 'src/screens/Learn.jsx', 'src/components/Shell.jsx', 'src/content/index.js', 'src/content/topics.gen.js', 'src/learn/challenges/meta.gen.ts']) expect(boot.files, f).toContain(f);
  });
});
