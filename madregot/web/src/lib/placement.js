// The placement test: a short adaptive check that finds where each topic starts.
// Per topic it searches the levels like a binary search: a right answer raises the
// floor, a wrong one lowers the ceiling, and three questions settle it at most.
// The result is the number of stairs already climbed in each topic.
import { TOPIC, topicsFor, makeItem, isCorrect } from '@/content/index.js';

export const PER_TOPIC = 3;
export const PLACEMENT_XP = 10;
/** How much of the grade's material feels familiar (onboarding answer) → where the first question sits, as a share of the topic. */
export const KNOW = [
  { id: 0, title: 'הכול חדש לי', sub: 'מתחילים מהמדרגה הראשונה', share: 0 },
  { id: 1, title: 'קצת מוכר', sub: 'למדנו חלק מהנושאים', share: 0.4 },
  { id: 2, title: 'רוב החומר מוכר', sub: 'צריך בעיקר תרגול', share: 0.6 },
  { id: 3, title: 'הכול מוכר', sub: 'רוצים אתגר', share: 0.8 },
];

/** The first level asked in a topic with `top` levels. */
export const startLevel = (top, know = 1) => Math.min(top, Math.max(1, Math.ceil(top * (KNOW[know]?.share ?? 0.4))));

/** The next level to ask, or null when the topic is settled. */
export function nextProbe(p) {
  if (p.asked >= PER_TOPIC || p.hi - p.lo <= 1) return null;
  return Math.max(p.lo + 1, Math.min(p.hi - 1, Math.floor((p.lo + p.hi) / 2)));
}

const probeFor = (topic, know) => {
  const top = TOPIC[topic].levels.length;
  return { lo: 0, hi: top + 1, asked: 0, right: 0, first: startLevel(top, know) };
};

export function startPlacement({ grade = '7', know = 1 } = {}) {
  const topics = topicsFor(grade).map((t) => t.id);
  const probe = probeFor(topics[0], know);
  return {
    kind: 'placement', grade: String(grade), know, topics, ti: 0, probe, results: {},
    topic: topics[0], level: probe.first, slot: 0, total: topics.length * PER_TOPIC, answered: 0,
    item: makeItem(topics[0], probe.first), attempt: 1, hint: false, phase: 'answer', wrong: [],
    combo: 0, bestCombo: 0, firstTry: 0, mistakes: 0, fixed: 0, cats: {}, lastCat: null, redo: [],
    finished: false, failed: false, startedAt: Date.now(), itemStartedAt: Date.now(),
  };
}

/** Share of the test done, 0..1: settled topics plus the part of the current one. */
export const placementProgress = (s) => {
  const n = s.topics.length || 1;
  const settled = Object.keys(s.results).length;
  const cur = s.ti < n && !s.results[s.topics[s.ti]] ? s.probe.asked / PER_TOPIC : 0;
  return Math.min(1, (settled + cur) / n);
};

/** Grade one answer: one try each, no hints; the probe moves either way. */
export function placementAnswer(s, u) {
  const it = s.item;
  const ok = isCorrect(it, u);
  const secs = Math.round((Date.now() - s.itemStartedAt) / 1000);
  const cat = ok ? null : (it.diag ? it.diag(u) : null);
  const p = ok
    ? { ...s.probe, lo: Math.max(s.probe.lo, it.level), asked: s.probe.asked + 1, right: s.probe.right + 1 }
    : { ...s.probe, hi: Math.min(s.probe.hi, it.level), asked: s.probe.asked + 1 };
  const combo = ok ? s.combo + 1 : 0;
  const ns = {
    ...s, probe: p, answered: s.answered + 1, combo, bestCombo: Math.max(s.bestCombo, combo),
    firstTry: s.firstTry + (ok ? 1 : 0), mistakes: s.mistakes + (ok ? 0 : 1),
    cats: cat ? { ...s.cats, [cat]: (s.cats[cat] || 0) + 1 } : s.cats,
    wrong: ok ? s.wrong : [...s.wrong, u], phase: ok ? 'correct' : 'reveal',
  };
  // Settle the topic now, so the bar shows it the moment its last question is answered.
  if (nextProbe(p) == null) ns.results = { ...s.results, [s.topics[s.ti]]: { level: p.lo, asked: p.asked, right: p.right } };
  const event = { topic: s.topics[s.ti], level: it.level, hint: false, secs, at: new Date().toISOString(), ok, first: ok, cat };
  return { s: ns, result: ok ? { ok: true, first: true, combo, comboMark: null, event } : { ok: false, reveal: true, cat, event } };
}

/** The next question: deeper in this topic, or the first one of the next topic. */
export function placementNext(s) {
  const fresh = { attempt: 1, hint: false, phase: 'answer', wrong: [], itemStartedAt: Date.now(), slot: s.slot + 1 };
  const level = nextProbe(s.probe);
  if (level != null) return { ...s, ...fresh, level, item: makeItem(s.topics[s.ti], level, s.item.key) };
  const ti = s.ti + 1;
  if (ti >= s.topics.length) return { ...s, finished: true };
  const topic = s.topics[ti];
  const probe = probeFor(topic, s.know);
  return { ...s, ...fresh, ti, topic, probe, level: probe.first, item: makeItem(topic, probe.first) };
}

export function placementResult(s) {
  const accuracy = s.answered ? Math.round((100 * s.firstTry) / s.answered) : 0;
  return {
    kind: 'placement', grade: s.grade, results: s.results, xp: PLACEMENT_XP, accuracy, passed: true, perfect: false,
    bestCombo: s.bestCombo, mistakes: s.mistakes, secs: Math.round((Date.now() - s.startedAt) / 1000), topic: s.topics[0], level: 1,
  };
}
