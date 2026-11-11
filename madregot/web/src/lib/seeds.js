// Seeds for exercises the tutor rewrites (ai spec AI-4 Design 1). The app chooses the numbers and computes the answer;
// the tutor only writes a new story, a hint and a solution around them, and code checks that text before it is shown
// (shared/verify.js). A seed is an exercise of the stair's own diagnostic and transfer models, so a student's wrong
// answer gets the same named diagnosis as in a lesson, and the app grades it, never the AI.
//
// The full item stays on the device (answer, diagnosis(u), diag(u), could, unit, fig, solution, hint). Only the request
// seeds leave it: { i, text, answer, round, fig }.
import { itemFor } from '@/learn/items.ts';
import { answerText, itemPlain } from '@/content/index.js';
import { verifyRewrite } from '@shared/verify.js';

/** How many draws a seed may take: to find a key not used yet, and an exercise without a drawing when there is one. */
export const SEED_DRAWS = 40;

/**
 * An exercise the rewrite can use: one number for an answer, and a key. A stair whose models answer as a fraction
 * (prob:3, two dice's probabilities 1/36 apart) has none: the server checks a story against one number within 0.01,
 * too loose for them, so the screen offers no new exercises there (screens/Assistant.jsx).
 */
const usable = (it) => !!it && it.form === 'num' && Number.isFinite(it.answer) && typeof it.key === 'string';

/**
 * `n` exercises of a stair, with distinct keys, all answered by one number: diagnostic and transfer models in turn
 * (`itemFor`; a stair without models falls back to its generator, whose number exercises are used). An exercise without
 * a drawing is preferred; a stair whose models always draw one (most angle and Pythagoras stairs) gives drawn seeds,
 * which the rewrite keeps in their own wording (seedPayload's fig). Fewer than `n` only when the stair has fewer
 * distinct exercises than that.
 */
export function seedsFor(skill, n, rnd) {
  const seeds = [];
  const keys = new Set();
  for (let i = 0; i < n; i += 1) {
    const prefer = i % 2 ? 'transfer' : 'diag';
    let drawn = null;
    for (let d = 0; d < SEED_DRAWS; d += 1) {
      // half the draws from the seed's own model, then from the other one, so a small model never stops the list
      const it = itemFor(skill, d < SEED_DRAWS / 2 ? prefer : prefer === 'diag' ? 'transfer' : 'diag', rnd);
      if (!usable(it) || keys.has(it.key)) continue;
      if (!it.fig) { drawn = it; break; }
      if (!drawn) drawn = it;
    }
    if (!drawn) continue;
    keys.add(drawn.key);
    seeds.push(drawn);
  }
  return seeds;
}

/** Does the exercise ask for a rounded answer ("עגלו לעשירית")? Then a check allows 0.05 instead of 0.01. */
export const seedRounds = (it) => String(it?.text || '').includes('עגלו');

/** The seeds as the generate request carries them: the exercise as text, its answer as text, and the two flags. */
export function seedPayload(items) {
  return items.map((it, i) => ({ i, text: itemPlain(it), answer: answerText(it), round: seedRounds(it), fig: !!it.fig }));
}

/**
 * The exercises a generate reply gives the screen (ai spec AI-4 Design 7): `count` of them, the stories that pass first
 * (in seed order), then seeds in their own wording, from the app's bank. Every story is checked again here with the
 * code checks of verifyRewrite (all but the blind solve, which only the server runs), so a server that is not up to date
 * cannot show an unchecked story. Each exercise keeps its seed: the app grades it, never the AI.
 * → { list: [{ seed, story, from: 'ai' | 'bank' }], stories: how many stories passed, fallback: the server gave the
 * question back }
 */
export function exercisesFrom(seeds, reply, count) {
  const payload = seedPayload(seeds);
  const bySeed = new Map();
  for (const it of Array.isArray(reply?.items) ? reply.items : []) {
    if (it && Number.isInteger(it.seed) && !bySeed.has(it.seed)) bySeed.set(it.seed, it);
  }
  const passed = [];
  payload.forEach((p, k) => {
    const it = bySeed.get(p.i);
    if (!it) return;
    const r = verifyRewrite(p, it, undefined);
    if (r.ok) passed.push({ seed: seeds[k], story: r.item, from: 'ai' });
  });
  const list = passed.slice(0, count);
  for (const seed of seeds) {
    if (list.length >= count) break;
    if (!list.some((x) => x.seed === seed)) list.push({ seed, story: null, from: 'bank' });
  }
  return { list, stories: Math.min(passed.length, count), fallback: reply?.fallback === true };
}
