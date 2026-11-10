// Test helpers for the durable layer (imported by tests only; nothing in the app imports this file).
// heavyYear() builds the council's "heavy year" save from a seed instead of a committed 400 KB file: a v4 save after a
// school year of daily use, with the analytics log at its cap (3,000 events), 30 checked exams and 300 days.
import { MAX_EVENTS } from '@/learn/analytics.ts';

/** A small seeded random generator (mulberry32): the same seed gives the same numbers on every run. */
export function seeded(seed = 1) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

/** Freeze an object and everything inside it, so a test proves the code under test never changes its input. */
export function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(deepFreeze); }
  return v;
}

const TOPICS = ['signed', 'coord', 'angles', 'expr', 'eq'];
const iso = (ms) => new Date(ms).toISOString();
const dayKey = (ms) => iso(ms).slice(0, 10);

/**
 * A v4 save `{ state, version: 4 }` after a heavy school year, ending on `end` (an ISO date). Synthetic and repeatable.
 * Its XP is the sum of its days' XP, so the v5 migration's counter can be checked against it.
 */
export function heavyYear({ seed = 7, end = '2026-11-05T12:00:00.000Z', days: nDays = 300, events: nEvents = MAX_EVENTS, exams: nExams = 30, practiceExams: nPractice = 8 } = {}) {
  const rnd = seeded(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const endMs = Date.parse(end);
  const days = {};
  let xp = 0;
  for (let i = nDays - 1; i >= 0; i -= 1) {
    const q = 10 + Math.floor(rnd() * 30); const ok = Math.floor(q * (0.6 + rnd() * 0.4)); const dxp = 10 + Math.floor(rnd() * 40);
    days[dayKey(endMs - i * 864e5)] = { q, ok, secs: q * 40, lessons: 1 + Math.floor(rnd() * 3), stages: Math.floor(rnd() * 3), xp: dxp, combo: Math.floor(rnd() * 8) };
    xp += dxp;
  }
  // shaped as the council's probe made them: answers in the log, 12 questions an exam with long written feedback
  const events = Array.from({ length: nEvents }, (_, i) => ({ t: iso(endMs - (nEvents - i) * 6e4), e: 'answer', s: `${pick(TOPICS)}:${1 + Math.floor(rnd() * 5)}`, ok: rnd() > 0.3 }));
  const question = (q) => ({
    number: String(q + 1), prompt: 'שאלה ארוכה עם $-3+5=2$ '.repeat(4), studentAnswer: '$2$', status: rnd() > 0.4 ? 'right' : 'wrong', correctAnswer: '$2$',
    feedback: 'משוב אישי מפורט על הטעות של התלמיד '.repeat(5), solution: ['צעד ראשון $x$', 'צעד שני', 'צעד שלישי'],
    topic: pick(TOPICS), level: 1 + Math.floor(rnd() * 5), skill: 'חיבור',
  });
  const exams = Array.from({ length: nExams }, (_, n) => ({
    id: `ex${n}`, at: iso(endMs - n * 7 * 864e5), title: `מבחן ${n + 1}`, source: 'photo',
    result: { questions: Array.from({ length: 12 }, (_, q) => question(q)), summary: 'סיכום '.repeat(30), weakTopics: [pick(TOPICS)], nextSteps: ['a', 'b'] },
    score: Math.floor(rnd() * 100), levels: { [pick(TOPICS)]: 2 },
  }));
  const practiceExams = Array.from({ length: nPractice }, (_, n) => ({
    id: `pe${n}`, at: iso(endMs - n * 3 * 864e5), title: `מבחן תרגול ${n + 1}`, topics: [pick(TOPICS)],
    questions: Array.from({ length: 8 }, (_, q) => ({ prompt: `תרגיל ${q + 1}: $${q}-(-${n})$`, answer: `$${q + n}$` })),
  }));
  const skills = {};
  TOPICS.forEach((t) => {
    for (let L = 1; L <= 5; L += 1) {
      const attempts = Array.from({ length: 12 }, (_, i) => ({ at: iso(endMs - (12 - i) * 36e5), ok: rnd() > 0.3, independent: rnd() > 0.4, purpose: 'practice' }));
      skills[`${t}:${L}`] = { taught: { A: iso(endMs - 2e10), B: iso(endMs - 2e10), C: iso(endMs - 2e10) }, attempts, ...(L <= 2 ? { mastered: { at: iso(endMs - 1e9), box: 2, due: iso(endMs + 1e9) } } : {}) };
    }
  });
  const path = Object.fromEntries(TOPICS.map((t) => [t, { parts: { 1: 2, 2: 2, 3: 1 }, reviews: 1, jumped: 0, done: { 1: 'mastered', 2: 'mastered' } }]));
  const progress = Object.fromEntries(TOPICS.map((t) => [t, { level: 3, max: 3 }]));
  return {
    version: 4,
    state: {
      profile: { role: 'student', name: 'בדיקה', grade: '8', know: 2 }, progress, days, xp, path, freezes: 2, goalXp: 30, sound: true,
      mistakes: { 'signed:sign': 4, 'coord:swap': 2 }, lastTopic: 'eq', outbox: [],
      ai: { mode: 'server', apiUrl: '', key: '', device: 'a'.repeat(32), familyDevice: null, pendingLink: null, lastTier: 'free' },
      helpSent: 3, solveMode: 'answer', exams, practiceExams, planBase: {}, wins: { 'signed:3': 40 }, gaps: {}, placement: null,
      learn: { skills, miscon: {}, exam: null, missions: {}, events },
    },
  };
}
