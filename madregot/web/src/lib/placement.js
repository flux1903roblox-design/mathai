// The placement test: a short adaptive check that finds where each topic starts.
// Per topic it searches the levels: a probe at a level is up to three questions there (an exercise, a diagnostic
// question and one on an unfamiliar surface), and the level counts as known only when all of them are right; the
// first miss ends the probe. A passed probe raises the floor, a missed one lowers the ceiling, and two probes settle
// a topic at most. Three right answers in a row are needed to pass over a stair, so guessing does not place a
// student above what they know (src/learn/guessing.test.ts). The result is the number of stairs already climbed
// in each topic: the path passes over them, and each one still waits for its own mastery check. Topics taught later
// in the school year (topic flag placement: false) are not tested on the first day.
import { TOPIC, placementTopicsFor, testItem, isCorrect } from '@/content/index.js';
import { itemFor } from '@/learn/items.ts';
import { metaOf } from '@/learn/content/index.ts';
import { skillId } from '@/learn/skills.ts';

// The test's numbers and the onboarding's familiarity answers live in lib/placementRules.js, which the first screen
// reads without this file (the boot split: the test's items and the exercise generators load with the test).
export { PER_TOPIC, PROBE_LEN, PLACEMENT_XP, placementMax, KNOW } from './placementRules.js';
import { PER_TOPIC, PROBE_LEN, PLACEMENT_XP, placementMax, KNOW } from './placementRules.js';

/** The first level asked in a topic with `top` levels. */
export const startLevel = (top, know = 1) => Math.min(top, Math.max(1, Math.ceil(top * (KNOW[know]?.share ?? 0.4))));

/** The next level to probe (halfway, rounded up), or null when the topic is settled. */
export function nextProbe(p) {
  if (p.asked >= PER_TOPIC || p.hi - p.lo <= 1) return null;
  return Math.max(p.lo + 1, Math.min(p.hi - 1, Math.round((p.lo + p.hi) / 2)));
}

/** The k-th question of a probe at a level: an exercise, then the stair's diagnostic and transfer questions. */
export function probeItem(topic, level, k, avoidKey) {
  const skill = skillId(topic, level);
  const c = metaOf(skill);
  const source = k === 1 && c ? 'diag' : k === 2 && c?.transfer ? 'transfer' : k === 2 && c ? 'diag' : 'gen';
  const it = source === 'gen' ? testItem(topic, level, avoidKey) : itemFor(skill, source, Math.random, avoidKey, undefined, { test: true });
  return { ...it, topic, level };
}

const probeFor = (topic, know) => {
  const top = TOPIC[topic].levels.length;
  return { lo: 0, hi: top + 1, asked: 0, right: 0, first: startLevel(top, know), q: 0 };
};

export function startPlacement({ grade = '7', know = 1 } = {}) {
  // topics taught later in the year are not tested on the first day (topic flag placement: false)
  const topics = placementTopicsFor(grade).map((t) => t.id);
  const probe = probeFor(topics[0], know);
  return {
    kind: 'placement', grade: String(grade), know, topics, ti: 0, probe, results: {},
    topic: topics[0], level: probe.first, slot: 0, total: placementMax(grade), answered: 0,
    item: probeItem(topics[0], probe.first, 0), attempt: 1, hint: false, phase: 'answer', wrong: [],
    combo: 0, bestCombo: 0, firstTry: 0, mistakes: 0, fixed: 0, cats: {}, lastCat: null, redo: [],
    finished: false, failed: false, startedAt: Date.now(), itemStartedAt: Date.now(),
  };
}

/** Share of the test done, 0..1: settled topics plus the part of the current one. */
export const placementProgress = (s) => {
  const n = s.topics.length || 1;
  const settled = Object.keys(s.results).length;
  const cur = s.ti < n && !s.results[s.topics[s.ti]] ? (s.probe.asked + (s.probe.q || 0) / PROBE_LEN) / PER_TOPIC : 0;
  return Math.min(1, (settled + cur) / n);
};

/** Grade one answer: one try each, no hints. A miss ends the probe; the last of its questions right passes it. */
export function placementAnswer(s, u) {
  const it = s.item;
  const ok = isCorrect(it, u);
  const secs = Math.round((Date.now() - s.itemStartedAt) / 1000);
  const cat = ok ? null : (it.diag ? it.diag(u) : null);
  const done = !ok || (s.probe.q || 0) + 1 >= PROBE_LEN;
  const p = !done
    ? { ...s.probe, q: (s.probe.q || 0) + 1, right: s.probe.right + 1 }
    : ok
      ? { ...s.probe, lo: Math.max(s.probe.lo, it.level), asked: s.probe.asked + 1, right: s.probe.right + 1, q: 0 }
      : { ...s.probe, hi: Math.min(s.probe.hi, it.level), asked: s.probe.asked + 1, q: 0 };
  const combo = ok ? s.combo + 1 : 0;
  const ns = {
    ...s, probe: p, answered: s.answered + 1, combo, bestCombo: Math.max(s.bestCombo, combo),
    firstTry: s.firstTry + (ok ? 1 : 0), mistakes: s.mistakes + (ok ? 0 : 1),
    cats: cat ? { ...s.cats, [cat]: (s.cats[cat] || 0) + 1 } : s.cats,
    wrong: ok ? s.wrong : [...s.wrong, u], phase: ok ? 'correct' : 'reveal',
  };
  // Settle the topic now, so the bar shows it the moment its last question is answered.
  if (done && nextProbe(p) == null) ns.results = { ...s.results, [s.topics[s.ti]]: { level: p.lo, asked: p.asked, right: p.right } };
  const event = { topic: s.topics[s.ti], level: it.level, hint: false, secs, at: new Date().toISOString(), ok, first: ok, cat };
  return { s: ns, result: ok ? { ok: true, first: true, combo, comboMark: null, event } : { ok: false, reveal: true, cat, event } };
}

/** The next question: the probe's next one, deeper in this topic, or the first one of the next topic. */
export function placementNext(s) {
  const fresh = { attempt: 1, hint: false, phase: 'answer', wrong: [], itemStartedAt: Date.now(), slot: s.slot + 1 };
  const topic = s.topics[s.ti];
  if (s.probe.q > 0) return { ...s, ...fresh, item: probeItem(topic, s.level, s.probe.q, s.item.key) };
  const level = nextProbe(s.probe);
  if (level != null) return { ...s, ...fresh, level, item: probeItem(topic, level, 0, s.item.key) };
  const ti = s.ti + 1;
  if (ti >= s.topics.length) return { ...s, finished: true };
  const next = s.topics[ti];
  const probe = probeFor(next, s.know);
  return { ...s, ...fresh, ti, topic: next, probe, level: probe.first, item: probeItem(next, probe.first, 0) };
}

export function placementResult(s) {
  const accuracy = s.answered ? Math.round((100 * s.firstTry) / s.answered) : 0;
  return {
    kind: 'placement', grade: s.grade, results: s.results, xp: PLACEMENT_XP, accuracy, passed: true, perfect: false,
    bestCombo: s.bestCombo, mistakes: s.mistakes, secs: Math.round((Date.now() - s.startedAt) / 1000), topic: s.topics[0], level: 1,
  };
}
