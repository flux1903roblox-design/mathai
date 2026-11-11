// The distress detector never reads the app's own maths as a child in distress (COUNCIL2-4): every teaching step of
// every stair, every challenge task, every lesson, every mistake name, and a sample of every generator's items with
// their hints and solutions. Words that are also maths ("לקפוץ" on a number line, "כדורים" in a word problem, "לא שווה"
// for ≠, "חותך" for a line that cuts an axis) need a first person or an intent beside them; this sweep is the proof
// that they have it. A false positive here would turn a maths question into a care reply. The phrases that must flag,
// and the everyday school sentences that must not, are in worker/test/safety.test.js.
import { describe, it, expect } from 'vitest';
// @ts-ignore: plain JS
import { detectDistress } from '@shared/distress.js';
import { loadAllContent } from './content/index';
import { CHALLENGES } from './challenges/index';
// @ts-ignore: plain JS
import { TOPICS, makeItem } from '@/content/index.js';
// @ts-ignore: plain JS
import { LESSONS } from '@/content/lessons.js';

/** Every string inside a value (objects, arrays), once each; functions and numbers are skipped. */
function strings(value: unknown, out = new Set<string>(), seen = new WeakSet<object>()): Set<string> {
  if (typeof value === 'string') { if (/[א-תa-z]/i.test(value)) out.add(value); return out; }
  if (!value || typeof value !== 'object') return out;
  if (seen.has(value as object)) return out;
  seen.add(value as object);
  for (const v of Array.isArray(value) ? value : Object.values(value as object)) strings(v, out, seen);
  return out;
}

/** The texts that flag, with what they flag as: an empty list is the pass. */
function flagged(texts: Iterable<string>): string[] {
  const hits: string[] = [];
  for (const t of texts) { const r = detectDistress(t); if (r.flag) hits.push(`${r.category}: ${t}`); }
  return hits;
}

/** Items drawn per generator level: enough to meet every template (the label tests draw far more for the maths). */
const DRAWS = 60;
/** A whole sweep takes a few seconds; on a loaded machine far more. */
const SLOW = 120_000;

describe('the distress detector and the app\'s own maths', () => {
  it('no teaching step of any stair flags (worked examples, guided problems, predictions, why-lines, diagnostic models)', async () => {
    const content = await loadAllContent();
    const all = strings(content);
    expect(all.size).toBeGreaterThan(3000);
    expect(flagged(all)).toEqual([]);
  }, SLOW);

  it('no challenge task flags', () => {
    const all = strings(CHALLENGES);
    expect(all.size).toBeGreaterThan(300);
    expect(flagged(all)).toEqual([]);
  });

  it('no lesson, topic or mistake name flags', () => {
    const all = strings(LESSONS);
    for (const t of TOPICS) strings({ title: t.title, cats: t.cats, lesson: t.lesson, levels: t.levels.map((l: { title: string }) => l.title) }, all);
    expect(all.size).toBeGreaterThan(200);
    expect(flagged(all)).toEqual([]);
  });

  it(`no generator item flags: ${DRAWS} items of every level of every topic, with their hints and solutions`, () => {
    const all = new Set<string>();
    let items = 0;
    for (const t of TOPICS) {
      t.levels.forEach((_: unknown, i: number) => {
        for (let k = 0; k < DRAWS; k += 1) { strings(makeItem(t.id, i + 1), all); items += 1; }
      });
    }
    expect(items).toBeGreaterThan(1500);
    expect(flagged(all)).toEqual([]);
  }, SLOW);
});
