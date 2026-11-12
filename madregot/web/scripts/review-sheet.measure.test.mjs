// The teacher's review sheet for curriculum stage 2, measurement (MEASURE-8, CURRICULUM-9; scripts/review-sheet.mjs,
// the stage-3 lane's script): the owner's one action is `npm run review:sheet -- area` (and solid, circle, space). Each
// sheet has every stair of its unit, each with all its teaching blocks, 20 practice exercises and its models, nothing
// undefined and no drawing that failed; the circle's answers "with π" are written 25π; and each sheet asks the teacher
// MEASURE-8's question for its unit.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { reviewSheet, ITEMS } from './review-sheet.mjs';
import { loadTopic } from '@/learn/content/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLOW = 240_000;
const count = (s, re) => (s.match(re) || []).length;
const section = (html, skill) => { const a = html.indexOf(`<h2 id="${skill}"`); const b = html.indexOf('<h2 ', a + 1); return html.slice(a, b < 0 ? undefined : b); };

// MEASURE-8: what the owner asks the teacher by name, on the sheet of the unit it is about
const ASKS = { area: 'קודם צורות מורכבות', solid: null, circle: 'כותבים קודם בעזרת π', space: 'פיתגורס במרחב' };

describe('the review sheets of the measurement units', () => {
  for (const [topic, ask] of Object.entries(ASKS)) {
    it(`${topic}: every stair in order, every block, ${ITEMS} exercises a stair, nothing undefined${ask ? ', and its question' : ''}`, async () => {
      const content = await loadTopic(topic);
      const { html, stairs } = await reviewSheet(topic, { date: '2026-11-12' });
      expect(html).toContain('<html lang="he" dir="rtl">');
      expect(stairs).toEqual(content.map((c) => c.skill));
      for (const c of content) {
        const part = section(html, c.skill);
        expect(count(part, /class="block discover"/g), `${c.skill} discover steps`).toBe(c.discover.length);
        expect(count(part, /<h4>דוגמה פתורה \d+<\/h4>/g), `${c.skill} examples`).toBe(c.examples.length);
        expect(count(part, /<h4>פותרים יחד \d+<\/h4>/g), `${c.skill} together`).toBe(c.together.length);
        expect(count(part, /class="block miscon"/g), `${c.skill} misconceptions`).toBe(c.misconceptions.length);
        expect(count(part, /class="item"/g), `${c.skill} exercises`).toBe(ITEMS);
      }
      expect(count(html, /<div class="note" aria-label="הערות">/g)).toBe(count(html, /<section class="block/g));
      expect(html).not.toMatch(/undefined|NaN|\[object /);
      expect(html).not.toContain('class="fig missing"');
      expect(html).not.toMatch(/\$[^$<]*\\(frac|cdot|pi)/); // no TeX left unrendered in the text
      if (ask) expect(html).toContain(ask);
      // an answer "with π" is written as the lesson writes it: the number, then π
      if (topic === 'circle') expect(html).toMatch(/<p class="answer">התשובה: \d+π /);
    }, SLOW);
  }
});

describe('the owner\'s one action is wired on this branch', () => {
  it('npm run review:sheet runs the script with vite-node, and the issue template asks for the five fields', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['review:sheet']).toBe('vite-node scripts/review-sheet.mjs');
    const file = join(HERE, '..', '..', '..', '.github', 'ISSUE_TEMPLATE', 'content-review.md');
    expect(existsSync(file)).toBe(true);
    const t = readFileSync(file, 'utf8');
    ['**נושא:**', '**מדרגה:**', '**שלב / שאלה:**', '**מה לא תקין:**', '**הצעה:**'].forEach((f) => expect(t, f).toContain(f));
    expect(readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8')).toMatch(/^review\/$/m);
  });
});
