// The text of the teaching content and the practice generators. TeX written inside JavaScript strings keeps its backslashes. In a JS string '\;' is just ';' and '\frac' starts with a
// form feed, so a TeX command written with one backslash loses itself silently: area:2's class-form line showed
// "52; /·2" instead of "52 /·2". Two checks: the source of every content file has no one-backslash TeX spacing
// (\; \, \! \:), and no string of any stair's teaching content holds the control characters a lost \f, \t, \v or \b
// leaves behind (\frac, \times, \vec, \beta).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllContent } from './content/index.ts';
import { TOPIC, makeItem } from '@/content/index.js';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['learn/content', 'content', 'learn/challenges'].map((d) => join(SRC, d));
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return files(p);
  return /\.(js|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
});

/** One-backslash TeX spacing in source: a backslash not after another, before ; , ! or : (comments are skipped). */
export function loneSpacing(source) {
  return source.split('\n').flatMap((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return [];
    return /(?<!\\)\\[;,!:]/.test(line) ? [`${i + 1}: ${line.trim().slice(0, 120)}`] : [];
  });
}

describe('TeX escapes in content', () => {
  it('finds a one-backslash \\; and leaves a two-backslash one alone', () => {
    expect(loneSpacing("display: '52 \\;/{\\\\cdot}2'")).toHaveLength(1);
    expect(loneSpacing("display: '52 \\\\;/{\\\\cdot}2'")).toEqual([]);
    expect(loneSpacing('// a comment: 12 \\;\\square')).toEqual([]);
  });

  it('no content source writes TeX spacing with one backslash', () => {
    const bad = DIRS.flatMap(files).flatMap((f) => loneSpacing(readFileSync(f, 'utf8')).map((l) => `${relative(SRC, f)}:${l}`));
    expect(bad).toEqual([]);
  });

  it('no stair holds a control character left by a lost backslash (\\f, \\t, \\v, \\b)', async () => {
    const content = await loadAllContent();
    const bad = [];
    const walk = (v, at, seen) => {
      if (typeof v === 'string') { if (/[\f\t\v\b]/.test(v)) bad.push(`${at}: ${JSON.stringify(v.slice(0, 80))}`); return; }
      if (!v || typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`, seen);
    };
    for (const [id, stair] of Object.entries(content)) walk(stair, id, new Set());
    expect(bad).toEqual([]);
  });
});

// Hebrew the stage-2 review found wrong (a missing ה, a phrase a 12-year-old misreads: "מדף" read as a shelf); they
// stay fixed in the teaching content and in every practice question
const WRONG = ['הארוכה ובולטת', 'מדף נייר'];
describe('copy the review corrected', () => {
  it('never comes back in a stair or a practice question', async () => {
    const content = await loadAllContent();
    const seen = [];
    const walk = (v, at, done) => {
      if (typeof v === 'string') { if (WRONG.some((w) => v.includes(w))) seen.push(`${at}: ${v.slice(0, 80)}`); return; }
      if (!v || typeof v !== 'object' || done.has(v)) return;
      done.add(v);
      for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`, done);
    };
    for (const [id, stair] of Object.entries(content)) walk(stair, id, new Set());
    for (const topic of ['area', 'solid', 'circle', 'space']) {
      for (let level = 1; level <= TOPIC[topic].levels.length; level += 1) {
        for (let i = 0; i < 300; i += 1) { const it = makeItem(topic, level); walk({ text: it.text, solution: it.solution, hint: it.hint, choices: it.choices }, it.key, new Set()); }
      }
    }
    expect(seen).toEqual([]);
  });
});
