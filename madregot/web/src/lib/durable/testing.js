// Test helpers for the durable layer (imported by tests only; nothing in the app imports this file).
// heavyYear() builds the council's "heavy year" save from a seed instead of a committed 400 KB file: a v4 save after a
// school year of daily use, with the analytics log at its cap (3,000 events), 30 checked exams and 300 days.
// realIdb() is idb.js on a real IndexedDB (fake-indexeddb, a full implementation of the standard in memory), a fresh
// one for each test; memoryIdb() is kept only for what a real IndexedDB cannot do on demand: answer 400 ms late.
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { MAX_EVENTS } from '@/learn/analytics.ts';
import { browserBackend, createIdb } from './idb.js';

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

/**
 * A localStorage in memory with a quota, counted as characters of keys and values (as the browsers count it, roughly).
 * A write that would go over it throws a QuotaExceededError, as a full browser storage does. `blocked`: every access
 * throws, as in a browser that lets a site save nothing.
 */
export function memoryLocalStorage({ quotaBytes = Infinity, blocked = false } = {}) {
  const m = new Map();
  const size = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  const deny = () => { if (blocked) throw Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError' }); };
  const api = {
    writes: [], // every setItem key, in order (tests count the writes)
    quotaBytes,
    getItem: (k) => { deny(); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) {
      deny();
      const s = String(v);
      if (size() - (m.get(k)?.length ?? -k.length) + s.length > api.quotaBytes) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError', code: 22 });
      m.set(k, s); api.writes.push(k);
    },
    removeItem: (k) => { deny(); m.delete(k); },
    clear: () => { deny(); m.clear(); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    size,
  };
  return api;
}

const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/**
 * An IndexedDB backend in memory for idb.js, with the same calls as browserBackend. `delay` (ms) makes every call
 * answer late; `failPut` makes writes fail; `failOpen` makes every call fail (a browser that blocks IndexedDB).
 * Only for the late copy at boot (DURABLE-1 test 11 and its neighbours in storage.test.js): a real IndexedDB answers
 * in a few event-loop turns and cannot be made to answer after 400 ms on demand. Everything else uses realIdb().
 */
export function memoryIdb({ delay = 0, failPut = false, failOpen = false } = {}) {
  const stores = { mirror: new Map(), quarantine: new Map(), errors: new Map() };
  let seq = 0;
  const api = {
    stores, delay, failPut, failOpen, destroyed: false,
    async ready() {
      if (api.delay) await new Promise((r) => { setTimeout(r, api.delay); });
      if (api.failOpen) throw new Error('IndexedDB is blocked');
    },
    async get(store, key) { await api.ready(); return copy(stores[store].get(key)); },
    async put(store, value, key) { await api.ready(); if (api.failPut) throw new Error('write failed'); stores[store].set(key, copy(value)); return key; },
    async add(store, value) { await api.ready(); if (api.failPut) throw new Error('write failed'); seq += 1; stores[store].set(seq, copy(value)); return seq; },
    async delete(store, key) { await api.ready(); stores[store].delete(key); },
    async entries(store) { await api.ready(); return [...stores[store]].map(([key, value]) => ({ key, value: copy(value) })); },
    close() {},
    async destroy() { api.destroyed = true; Object.values(stores).forEach((s) => s.clear()); },
  };
  return api;
}

const PUT = IDBObjectStore.prototype.put;
const ADD = IDBObjectStore.prototype.add;

/**
 * idb.js over a real IndexedDB of its own (a new IDBFactory, so no test sees another's databases):
 * `{ factory, name, backend: browserBackend(name, factory), idb: createIdb(backend) }`, and
 *   another()   a second connection to the same database (the next start of the app, or another tab)
 *   failPut()   every put and add of every object store throws, as a full or broken disk does
 *   failOpen()  opening a database throws, as a browser that blocks IndexedDB does
 *   restore()   undo both (call it in afterEach: failPut changes fake-indexeddb's shared prototype)
 */
export function realIdb({ name = 'madregot-test-durable' } = {}) {
  const factory = new IDBFactory();
  const backend = browserBackend(name, factory);
  const fail = (what) => () => { throw new DOMException(`${what} failed`, 'UnknownError'); };
  return {
    factory, name, backend, idb: createIdb(backend),
    another: () => browserBackend(name, factory),
    failPut() { IDBObjectStore.prototype.put = fail('put'); IDBObjectStore.prototype.add = fail('add'); },
    failOpen() { factory.open = () => { throw new DOMException('IndexedDB is blocked', 'SecurityError'); }; },
    restore() { IDBObjectStore.prototype.put = PUT; IDBObjectStore.prototype.add = ADD; delete factory.open; },
  };
}

/**
 * One record in a database of `factory`, through a real transaction: `idbRecord(f, db, store, key)` reads it,
 * `idbRecord(f, db, store, key, value)` writes it. A database that does not exist yet is made at version 1 with that
 * one store, as lib/push.js and sw.js make madregot-push.
 */
export function idbRecord(factory, name, store, key, ...value) {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(store); };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(store, value.length ? 'readwrite' : 'readonly');
      const r = value.length ? tx.objectStore(store).put(value[0], key) : tx.objectStore(store).get(key);
      tx.oncomplete = () => { db.close(); resolve(value.length ? true : r.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

/** The names of the databases a factory holds now. */
export const idbNames = async (factory) => (await factory.databases()).map((d) => d.name);

/** Let every pending promise and timer of `ms` run (with real timers). */
export const settle = (ms = 0) => new Promise((r) => { setTimeout(r, ms); });
