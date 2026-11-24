// A thing drawn and called by a colour is drawn in that colour (stage 3 review: the wheel's "אדום" was fuchsia and its
// "ירוק" petrol, so a 12-year-old told "the red part" found no red). Every drawn label in the app is collected: the
// teaching steps, worked examples, misconception remedies and the models' figures of every stair, the practice items of
// every topic and level, and the challenge tasks. A label that is a colour word must be the word of the colour family it
// is drawn in (content/manip.js TONE_WORDS); red and green are the app's right and wrong, so no drawn thing is red or
// green.
import { describe, it, expect } from 'vitest';
import { loadAllContent } from './content/index';
import type { StairContent } from './types';
import { seeded } from './expr';
import { CHALLENGE_TASKS } from './challenges/all';
// @ts-ignore: plain JS
import { TONE_WORDS, chartTone } from '@/content/manip.js';
// @ts-ignore: plain JS
import { TOPICS, makeItem } from '@/content/index.js';

const CONTENT = await loadAllContent();
const stairs = Object.values(CONTENT) as StairContent[];

/** The words a label may start with that name a colour. */
const COLOUR_WORDS = ['אדום', 'ירוק', 'כחול', 'כתום', 'צהוב', 'סגול', 'ורוד', 'אפור', 'טורקיז', 'חום', 'שחור', 'לבן'];
const isColour = (label: unknown) => typeof label === 'string' && COLOUR_WORDS.includes(label.trim().split(/\s+/)[0]);

type Drawn = { label: string; tone: number; where: string };

/** The labels a figure or an object draws in a colour family, with that family (as the components draw them). */
function drawnOf(x: any, where: string): Drawn[] {
  const out: Drawn[] = [];
  const add = (label: unknown, tone: number) => { if (typeof label === 'string') out.push({ label, tone: ((tone % 8) + 8) % 8, where }); };
  // a chart figure (ChartArt.jsx): a pie's slices in their families, a bar or a pictogram's rows in the brand colour
  // unless `tones` gives each its own; a line chart is one colour
  if (x.type === 'chart' && Array.isArray(x.cats) && x.mode !== 'line') {
    x.cats.forEach((c: string, i: number) => add(c, x.mode === 'pie' || x.tones ? (x.tones?.[i] ?? i) : 0));
  }
  // a chart the student builds (Chart.jsx): the same rule
  if (x.kind === 'chart' && Array.isArray(x.cats)) x.cats.forEach((c: string, i: number) => add(c, x.mode === 'pie' || x.tones ? chartTone(x, i) : 0));
  // a spinner's sectors and a bag's groups (Simulate.jsx), each in its own family
  if (x.kind === 'simulate') [...(x.sectors || []), ...(x.bag || [])].forEach((s: { label: string; tone: number }) => add(s.label, s.tone));
  // a fraction strip with coloured parts (Figure.jsx fbar: tone, else its place)
  if (x.type === 'fbar' && Array.isArray(x.tones)) x.tones.forEach((t: { label?: string; tone?: number }, i: number) => add(t.label, t.tone ?? i));
  return out;
}

/** Every figure and object anywhere under a node (steps, choices, parts, a pair's two sources), with their labels. */
function walk(node: unknown, where: string, out: Drawn[], seen = new Set<unknown>()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${where}[${i}]`, out, seen)); return; }
  out.push(...drawnOf(node, where));
  for (const [k, v] of Object.entries(node)) if (typeof v === 'object') walk(v, `${where}.${k}`, out, seen);
}

function collect(): Drawn[] {
  const out: Drawn[] = [];
  const rnd = seeded(20261111);
  for (const c of stairs) {
    walk(c, c.skill, out);
    // the models draw a figure from their parameters: many draws of each
    for (const [name, model] of [['diag', c.diag], ['transfer', c.transfer]] as const) {
      if (!model?.fig) continue;
      for (let i = 0; i < 40; i += 1) walk(model.fig(model.params(rnd)), `${c.skill} ${name}`, out);
    }
  }
  for (const t of TOPICS) {
    for (let level = 1; level <= t.levels.length; level += 1) {
      for (let i = 0; i < 150; i += 1) { const it = makeItem(t.id, level); walk({ fig: it.fig, manip: it.manip }, `${t.id}:${level} ${it.key}`, out); }
    }
  }
  walk(CHALLENGE_TASKS, 'challenges', out);
  return out;
}

describe('a colour word labels a thing drawn in that colour (stage 3 review)', () => {
  const drawn = collect();
  const coloured = drawn.filter((d) => isColour(d.label));

  it('the colour families have words a child uses, and red and green are not among them', () => {
    expect(TONE_WORDS).toHaveLength(8);
    expect(TONE_WORDS).not.toContain('אדום');
    expect(TONE_WORDS).not.toContain('ירוק');
    expect(TONE_WORDS[0]).toBe('כחול'); // the brand blue
  });

  it('finds the drawn colour labels: a wheel\'s sectors, a pie\'s slices, coloured bars and a coloured strip', () => {
    const where = new Set(coloured.map((d) => d.where.split(/[ .[]/)[0]));
    expect(coloured.length).toBeGreaterThan(30);
    expect([...where]).toEqual(expect.arrayContaining(['data:2', 'data:3', 'data:4', 'prob:2']));
  }, 60_000);

  it('every one is drawn in the colour it is called', () => {
    const wrong = [...new Set(coloured.filter((d) => TONE_WORDS[d.tone] !== d.label.trim()).map((d) => `${d.where.split(' ')[0]}: "${d.label}" drawn as tone ${d.tone} (${TONE_WORDS[d.tone] ?? 'no colour word'})`))];
    expect(wrong, wrong.join('\n')).toEqual([]);
  });
});
