// The stylesheets that load with their screens (FOLLOWUP-23, after STUDENT-15; COUNCIL2-20 checks every file in
// styles/lazy/): the teacher's (lazy/teacher.css), the parents' area's (lazy/parents.css), the legal pages' reading rules
// (lazy/legal.css), the saving screens' (lazy/durable.css), each lazy screen's own sheet, and lazy/shared.css for the
// parts several of them draw. A rule there must never be needed on a screen that has not loaded its file, so every selector in
// it names a class that only files covered by that stylesheet write: a file is covered when it imports the stylesheet,
// or statically imports a file that does, or when every file that imports it (statically or with import()) is covered.
// Classes are looked for in the source with comments removed; a class a template could build (`kpi-${tone}`) counts
// every file that builds such names. A cycle covers nothing by itself, so the check can only be stricter than needed.
// And the first load: main.jsx imports none of these files, and the boot stylesheets keep none of the moved classes.
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
/**
 * Words a file has that are never a class there (the round-3 merge: the main branch's data and props share a name with
 * a class), so the check does not count the file as writing it. Each was read in the file: [file, words, why].
 */
const NOT_A_CLASS = [
  ['components/mascot/Accessories.jsx', ['medal'], 'a piece\'s drawing, by its id'],
  ['lib/wardrobe.js', ['medal', 'quest'], 'a piece\'s id, and the quest chest\'s unlock key'],
  ['lib/durable/merge.js', ['tw'], 'a variable'],
  ['content/topics.js', ['nums'], 'a variable'], ['content/frac.js', ['nums'], 'a parameter'], ['content/congr.gen.js', ['nums'], 'a field'],
  ['learn/content/func.ts', ['guide'], 'a figure\'s option'],
  ['components/PathNode.jsx', ['celebrate'], 'a prop'], ['components/map/Chest.jsx', ['celebrate'], 'a prop'],
  ['components/ds.jsx', ['celebrate'], 'a StateCard kind (its class is state-celebrate)'], ['screens/Learn.jsx', ['celebrate'], 'a prop'],
  // `hint-${scale}` builds hint-left and hint-right only (the protractor's lit scale)
  ['components/manip/AngleTurner.jsx', ['hint-bar', 'hint-box', 'hint-line', 'hint-more', 'hint-side', 'hint-text'], 'not what hint-${scale} builds'],
].flatMap(([f, words]) => words.map((w) => `${join(SRC, f)}|${w}`));
const notAClass = new Set(NOT_A_CLASS);
// (and `ch-${colour}`, a unit's colour on the map, the lesson and the board, never builds the challenge feedback's ch-fb-…)
function writersOf(cls) {
  const out = new Set(tokens.get(cls) || []);
  for (const { p, file } of prefixes) if (cls.startsWith(p) && cls.length > p.length && !(p === 'ch-' && cls.startsWith('ch-fb'))) out.add(file);
  for (const f of [...out]) if (notAClass.has(`${f}|${cls}`)) out.delete(f);
  return out;
}
/**
 * Selectors the token check cannot tie to a file, pinned by the importers instead (the test below): classes built from a
 * caller's prefix (the graph and protractor drawings, `${cls}-grid`; the bars' tone, `qbar-${tone}`), and a rule that
 * only applies inside a parent the check strips (`:is(.stage-done, .unlock-stage) > .done-hero`).
 */
const PINNED = {
  'graph.css': /^\.(mp-graph|mp-prot)-/,
  'figure.css': /^\.(fig-sgraph|fig-prot)-/,
  'topics.css': /^\.qbar-light\b/,
  'celebrate.css': /^:is\(\.stage-done, \.unlock-stage\) > \.done-hero$/,
  // the class-goal moment (ClassGoalCard, first load) has a .done-hero of its own, never inside a .done-screen, and the
  // unlock moment's fallback (lib/madiLook.js) is an empty .done-screen
  'shared.css': /^\.done-screen \.done-hero$/,
};

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
  // every sheet that loads on demand: FOLLOWUP-23's four, STUDENT-15's, the per-screen and shared sheets COUNCIL2-20 made
  const SHEETS = readdirSync(join(SRC, 'styles/lazy')).filter((n) => n.endsWith('.css'));
  it.each(SHEETS)('%s', { timeout: 30_000 }, (sheet) => {
    const covered = coveredBy(sheet);
    const bad = [];
    for (const selectors of rules(read(join(SRC, 'styles/lazy', sheet)))) {
      for (const sel of selectors) {
        if (PINNED[sheet]?.test(sel)) continue;
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
    // the graph and protractor drawings (FUNC-1): their sheet loads with the two drawing modules, which the objects and the
    // still figures reach only through them. Their class names are built from the caller's prefix (`${cls}-grid`, 'mp-graph'
    // or 'fig-sgraph'), which the selector check above cannot read, so graph.css (like figure.css) is pinned here instead
    for (const f of ['components/manip/graphAxes.jsx', 'components/manip/protractor.jsx']) expect(imports(at(f), 'graph.css'), f).toBe(true);
    // curriculum stage 3's two objects (DATA-2): moved out of the first load at the stage-3 merge
    for (const f of ['components/manip/Simulate.jsx', 'components/manip/Chart.jsx']) expect(imports(at(f), 'data.css'), f).toBe(true);
    // curriculum stage 2's three objects (MEASURE-1): moved out of the first load at the stage-2 merge
    for (const f of ['components/manip/GridShape.jsx', 'components/manip/NetFold.jsx', 'components/manip/CircleRoll.jsx']) expect(imports(at(f), 'measure.css'), f).toBe(true);
    // the product2 merge (the boot CSS gate): the ghost race and the family challenge, Settings' section for adults, a
    // check's repeated mistake, the stair page's stages; and the topics screen's light pills, whose class Bar builds
    // from its tone (`qbar-${tone}`), which the selector check cannot tie to one screen, so it is pinned here
    for (const f of ['screens/Quests.jsx', 'components/learn/FamilyChallengeCard.jsx', 'screens/FamilyOffer.jsx']) expect(imports(at(f), 'quests.css'), f).toBe(true);
    expect(imports(at('screens/Settings.jsx'), 'settings.css')).toBe(true);
    expect(imports(at('components/learn/RepeatNote.jsx'), 'checkDone.css')).toBe(true);
    expect(imports(at('screens/Journey.jsx'), 'journey.css')).toBe(true);
    expect(imports(at('screens/Topics.jsx'), 'topics.css')).toBe(true);
    // the round-3 merge: the main branch's parts that write the lesson's own classes (the answer's label and its
    // partial note in solve-together and the challenge, the sent help line), the Sunday recap's week, and the figures'
    // table in the line explorer; and the pinned selectors' sheets, with their writers
    for (const f of ['components/learn/Together.jsx', 'components/challenge/common.jsx', 'components/learn/MyHelp.jsx']) expect(imports(at(f), 'lesson.css'), f).toBe(true);
    expect(imports(at('components/learn/RecapSheet.jsx'), 'shared.css')).toBe(true);
    expect(imports(at('components/LineExplorer.jsx'), 'figure.css')).toBe(true);
    for (const f of ['components/learn/StageDone.jsx', 'components/learn/UnlockStage.jsx']) expect(imports(at(f), 'celebrate.css') || [...(statics.get(at(f)) || [])].some((g) => imports(g, 'celebrate.css')), f).toBe(true);
  });
});

describe('the first load (FOLLOWUP-23, COUNCIL2-20)', () => {
  const main = read(join(SRC, 'main.jsx'));
  const app = read(join(SRC, 'App.jsx'));

  it('main.jsx imports no lazy stylesheet, and one layer: fonts, tokens, app, motion, canon, dark (v4.css merged)', () => {
    expect(main).not.toMatch(/styles\/lazy\//);
    expect([...main.matchAll(/import '\.\/styles\/([\w.]+)'/g)].map((m) => m[1])).toEqual(['fonts.css', 'tokens.css', 'app.css', 'motion.css', 'canon.css', 'dark.css']);
    expect(existsSync(join(SRC, 'styles/v4.css'))).toBe(false);
  });

  it('the boot stylesheets keep none of the moved screens\' own classes', () => {
    const boot = ['app.css', 'canon.css'].map((f) => read(join(SRC, 'styles', f)).replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
    const left = ['t-head', 't-tools', 'demo-banner', 'preview-bar', 'print-root', 'ps-q', 'licence-card', 'teacher-off', 'parents-bar', 'parents-card', 'handoff-code', 'adult-form', 'legal', 'save-row', 'save-backup', 'support-rows', 'backup-code-body', 'restore-form',
      // COUNCIL2-20: the lesson's, the topics', the quests', the programme's and the teaching steps' own parts
      'fig-zoom', 'fb-retry', 'quest-mission', 'section-cards', 'prog-unit', 'tg-built', 'done-chest', 'explorer-table',
      // the product2 merge: the ghost race and the family challenge, Settings' section for adults, a check's repeated
      // mistake, the stair page's stages and challenge cards, the topics screen's light pills
      'ghost-card', 'family-card', 'offer-card', 'set-adults', 'check-repeat', 'jstage', 'jchallenge', 'qbar-light']
      .filter((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(boot));
    expect(left).toEqual([]);
  });

  it('the tutor\'s prompts, schemas and checks load with the tutor, never with the first screen', () => {
    // every file main.jsx reaches by static imports (the first load: its chunk and what that chunk preloads), the
    // shared code included; an import() is where loading on demand starts
    const SHARED = join(SRC, '../../shared');
    const find = (from, spec) => {
      if (!spec.startsWith('@shared/')) return resolve(from, spec);
      const base = join(SHARED, spec.slice('@shared/'.length));
      return [base, `${base}.js`].find((c) => existsSync(c) && statSync(c).isFile()) || null;
    };
    const boot = new Set();
    const walk = (f) => {
      if (boot.has(f)) return;
      boot.add(f);
      const text = raw.get(f) ?? read(f);
      for (const m of text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)) {
        const to = find(f, m[1] || m[2]);
        if (to) walk(to);
      }
    };
    walk(join(SRC, 'main.jsx'));
    const rel = [...boot].map((f) => relative(join(SRC, '../..'), f));
    // the kinds and limits the first load reads (lib/account.js) are in their own small file (FOLLOWUP-23)
    expect(rel).toContain('web/src/lib/account.js');
    expect(rel).toContain('shared/aiKinds.js');
    for (const f of ['shared/ai.js', 'shared/pedagogy.js', 'shared/topicWays.js', 'shared/guard.js', 'web/src/lib/ai.js']) expect(rel, f).not.toContain(f);
    // the help lines the first screen shows (SupportSheet, SupportCard) are on their own as well (shared/helpLines.js,
    // re-exported by shared/safety.js): the distress detector, the masking and the output screen load with the screens
    // that read a child's words (the lesson, the tutor, the help thread), never with the first one
    expect(rel).toContain('shared/helpLines.js');
    for (const f of ['shared/safety.js', 'shared/blocklist.js']) expect(rel, f).not.toContain(f);
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

// shared.css spreads a settings button to both ends (button.set-row: the words at the start, a chevron at the end, the
// student's privacy group). The teacher's "מחיקת הכיתה" rows (the class settings, the students tab) are a bin and its
// words, side by side as the year's report beside them: spread, the words ran to the far side of the row, away from the
// bin (the demo class's settings in teacher.spec.js, teacher-demo-settings-end.png).
describe('the teacher\'s delete rows keep the bin beside the words', () => {
  const body = (css, selector) => {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (m[1].split(',').map((s) => s.trim()).includes(selector)) return m[2];
    }
    return null;
  };
  const teacher = read(join(SRC, 'styles/lazy/teacher.css'));
  const shared = read(join(SRC, 'styles/lazy/shared.css'));

  it('shared.css spreads a settings button; teacher.css sets the two delete rows from the start, with a gap', () => {
    expect(body(shared, 'button.set-row')).toMatch(/justify-content:\s*space-between/);
    for (const sel of ['.t-set button.set-row.danger', 'button.set-row.t-quiet-row']) {
      const b = body(teacher, sel);
      expect(b, sel).toMatch(/justify-content:\s*flex-start/);
      expect(b, sel).toMatch(/gap:\s*var\(--s2\)/);
    }
  });

  it('the two rows are those buttons: the bin first, then the words', () => {
    const settings = read(join(SRC, 'screens/teacher/Settings.jsx'));
    const students = read(join(SRC, 'screens/teacher/StudentsTab.jsx'));
    expect(settings).toMatch(/<section className="section set-group t-set" aria-labelledby="ts-year">[\s\S]*?<button type="button" className="set-row danger"[^\n]*?><Trash2 [^>]*\/>מחיקת הכיתה<\/button>/);
    expect(students).toMatch(/<button type="button" className="set-row t-quiet-row"[^\n]*?><Trash2 [^>]*\/>מחיקת הכיתה<\/button>/);
  });
});
