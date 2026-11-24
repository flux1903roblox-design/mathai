// The teacher's review sheet (CURRICULUM-9, DATA-9; scripts/review-sheet.mjs): for the data unit it has every stair,
// each with all its discover steps, examples, together problems and misconceptions, 20 practice exercises and its
// models, a comment column beside every block, and nothing undefined; a stair filter keeps only the stairs asked
// (statistics 6-8); the same seed gives the same sheet. And the owner's one action is wired: the npm script and the
// issue template the teacher's comments go into.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { reviewSheet, parseStairs, ITEMS } from './review-sheet.mjs';
import { loadTopic } from '@/learn/content/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLOW = 180_000;
const count = (s, re) => (s.match(re) || []).length;
/** The part of the sheet of one stair: from its heading to the next one. */
const section = (html, skill) => { const a = html.indexOf(`<h2 id="${skill}"`); const b = html.indexOf('<h2 ', a + 1); return html.slice(a, b < 0 ? undefined : b); };

describe('the review sheet of the data unit', () => {
  let sheet; let content;
  beforeAll(async () => {
    content = await loadTopic('data');
    sheet = await reviewSheet('data', { date: '2026-11-11' });
  }, SLOW);

  it('is a right-to-left Hebrew page with every data stair, in order', () => {
    expect(sheet.html.startsWith('<!doctype html>')).toBe(true);
    expect(sheet.html).toContain('<html lang="he" dir="rtl">');
    expect(sheet.stairs).toEqual(['data:1', 'data:2', 'data:3', 'data:4']);
    expect(count(sheet.html, /<h2 id="data:\d"/g)).toBe(4);
    sheet.stairs.forEach((s, i) => expect(sheet.html.indexOf(`<h2 id="${s}"`), s).toBeGreaterThan(i ? sheet.html.indexOf(`<h2 id="${sheet.stairs[i - 1]}"`) : 0));
  });

  it(`has, for every stair, each teaching block and ${ITEMS} practice exercises with their answers and solutions`, () => {
    for (const c of content) {
      const part = section(sheet.html, c.skill);
      expect(count(part, /class="block discover"/g), `${c.skill} discover steps`).toBe(c.discover.length);
      expect(count(part, /<h4>דוגמה פתורה \d+<\/h4>/g), `${c.skill} examples`).toBe(c.examples.length);
      expect(count(part, /<h4>פותרים יחד \d+<\/h4>/g), `${c.skill} together`).toBe(c.together.length);
      expect(count(part, /class="block miscon"/g), `${c.skill} misconceptions`).toBe(c.misconceptions.length);
      c.misconceptions.forEach((m) => expect(part, `${c.skill} ${m.id}`).toContain(`<code>${m.id}</code>`));
      expect(count(part, /class="item"/g), `${c.skill} exercises`).toBe(ITEMS);
      expect(count(part, /<p class="answer">התשובה/g), `${c.skill}: every exercise and example has its answer`).toBeGreaterThanOrEqual(ITEMS + c.examples.length);
      expect(count(part, /class="block model"/g), `${c.skill} models`).toBe(c.transfer ? 2 : 1);
      expect(part).toContain('מטרות, הרעיון והמילים');
    }
  });

  it('has a comment column beside every block, and says it holds no student data', () => {
    expect(count(sheet.html, /<section class="block/g)).toBeGreaterThan(40);
    expect(count(sheet.html, /<div class="note" aria-label="הערות">/g)).toBe(count(sheet.html, /<section class="block/g));
    expect(sheet.html).toContain('אין כאן שום מידע על תלמידים');
    // DATA-9's questions for this unit
    expect(sheet.html).toContain('הוא השם שהכיתה שלך משתמשת בו ליחידה');
  });

  it('draws every figure and writes every number: no undefined, no NaN, no drawing that failed', () => {
    expect(sheet.html).not.toMatch(/undefined|NaN|\[object /);
    expect(sheet.html).not.toContain('class="fig missing"');
    expect(count(sheet.html, /<svg/g)).toBeGreaterThan(40); // the charts are the app's own drawings
    expect(count(sheet.html, /<math/g)).toBeGreaterThan(100); // the maths, as MathML
    expect(sheet.html).not.toMatch(/\$[^$<]*\\(frac|cdot)/); // no TeX left unrendered in the text
  });
});

describe('a sheet of some stairs only, the same sheet again, and wrong input', () => {
  it('statistics stairs 6-8 only (DATA-9: the stage\'s three new stairs)', async () => {
    const { html, stairs } = await reviewSheet('stats', { stairs: parseStairs('6-8'), date: '2026-11-11' });
    expect(stairs).toEqual(['stats:6', 'stats:7', 'stats:8']);
    expect(html).not.toContain('<h2 id="stats:1"');
    expect(html).toContain('מדרגות 6, 7, 8');
    expect(count(html, /class="item"/g)).toBe(3 * ITEMS);
  }, SLOW);

  it('the same seed and date give the same sheet', async () => {
    const a = await reviewSheet('prob', { stairs: [1], date: '2026-11-11' });
    const b = await reviewSheet('prob', { stairs: [1], date: '2026-11-11' });
    expect(a.html).toBe(b.html);
    expect(a.html).toContain('השורות הן הקובייה הראשונה'); // DATA-9's question for this unit
    const c = await reviewSheet('prob', { stairs: [1], date: '2026-11-11', seed: 7 });
    expect(c.html).not.toBe(a.html);
  }, SLOW);

  it('reads the stairs as 6-8, 6,8 or 7, and refuses anything else, a topic that does not exist and a stair it does not have', async () => {
    expect(parseStairs('6-8')).toEqual([6, 7, 8]);
    expect(parseStairs('6,8')).toEqual([6, 8]);
    expect(parseStairs('7')).toEqual([7]);
    expect(parseStairs('1-2,4')).toEqual([1, 2, 4]);
    expect(parseStairs(undefined)).toBeNull();
    expect(() => parseStairs('six')).toThrow(/6-8/);
    await expect(reviewSheet('nope')).rejects.toThrow(/no topic "nope"/);
    await expect(reviewSheet('prob', { stairs: [9] })).rejects.toThrow(/no stair 9/);
  });
});

describe('the owner\'s one action is wired', () => {
  it('npm run review:sheet runs the script with vite-node', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['review:sheet']).toBe('vite-node scripts/review-sheet.mjs');
  });
  it('the issue template asks for the five fields', () => {
    const file = join(HERE, '..', '..', '..', '.github', 'ISSUE_TEMPLATE', 'content-review.md');
    expect(existsSync(file)).toBe(true);
    const t = readFileSync(file, 'utf8');
    ['**נושא:**', '**מדרגה:**', '**שלב / שאלה:**', '**מה לא תקין:**', '**הצעה:**'].forEach((f) => expect(t, f).toContain(f));
    expect(t.startsWith('---\nname: ')).toBe(true);
  });
  it('the sheets it writes are not committed', () => {
    expect(readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8')).toMatch(/^review\/$/m);
  });
});
