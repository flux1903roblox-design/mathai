// Types for the static check of the code where a student's progress can be lost (COUNCIL2-21): the durable layer
// (lib/durable/*.js), the store (lib/store.js) and the API client (lib/api.js), each marked `// @ts-check` and listed in
// tsconfig.json. Only types live here; nothing is imported at run time.

/**
 * A saved state, or a slice of one, as it is read back: JSON from this device's storage, another tab, a backup file,
 * the vault or a class server. It is never trusted, so each reader checks what it uses (isObj, Array.isArray, …).
 */
export type Saved = Record<string, any>;

/**
 * One value inside a saved state (a slice, a day, a skill, a log item…), as the merges and migrations walk it: any JSON,
 * or undefined where a side lacks it. Each step checks what it reads (isObj, isNum, Array.isArray) before using it.
 */
export type Json = any;

/** zustand persist's envelope, as the progress is kept under STORE_KEY in localStorage and in the IndexedDB copy. */
export interface Persisted {
  state: Saved;
  version: number;
}

/** How the saving is going on this device (useDurable.js). */
export type Health = 'ok' | 'mirror' | 'full' | 'memory';

/** The store's state and actions at run time (lib/store.js useApp): read as a whole by the durable layer. */
export type AppState = Saved;

/** A zustand store as the durable layer and the API client use it: read, write and listen. */
export interface StoreApi<T = AppState> {
  getState(): T;
  setState(partial: Partial<T> | ((s: T) => Partial<T>), replace?: boolean): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

/** The small backend the copy on the device works through (idb.js): the real IndexedDB, or the tests' in-memory one. */
export interface Backend {
  get(store: string, key: IDBValidKey): Promise<any>;
  put(store: string, value: unknown, key: IDBValidKey): Promise<unknown>;
  add(store: string, value: unknown): Promise<unknown>;
  delete(store: string, key: IDBValidKey): Promise<unknown>;
  entries(store: string): Promise<Array<{ key: IDBValidKey; value: any }>>;
  close(): void;
  destroy(): Promise<void>;
}

/** The copy of the last save (idb.js mirror 'current'). */
export interface Mirror {
  raw: string;
  rev: number;
  at: string;
}

/** Why saved data was kept in quarantine (idb.js). */
export type QuarantineReason = 'parse' | 'future-version' | 'before-merge' | 'before-restore' | (string & {});

/** The copy on the device: createIdb(backend) when there is a backend. */
export type Idb = NonNullable<ReturnType<typeof import('./idb.js').createIdb>>;

/** A save's `meta` block beside zustand's envelope (storage.js). */
export interface SaveMeta {
  rev: number;
  at: string;
  tab: string;
  parent: { rev: number; tab: string | null };
  keyAt: Record<string, string>;
  seen: Record<string, number>;
  app: string;
}

declare global {
  /** The git commit the build was made from (vite.config.js `define`); missing in the unit tests. */
  const __RELEASE__: unknown;
}

/** A class student's answer waiting for the server (store.js toWire: all the outbox keeps of it). */
export interface OutboxEntry {
  id?: string;
  topic: string;
  level: number;
  ok: boolean;
  first?: boolean;
  hint?: boolean;
  cat?: string | null;
  secs?: number;
  at?: string;
}

/** The backup of this student's progress (migrations.js BACKUP_DEFAULTS says what each field is). */
export interface Backup {
  on: boolean;
  code: string | null;
  lookup: string | null;
  rev: number | null;
  at: string | null;
  hash: string | null;
  escrow: 'class' | 'family' | 'both' | null;
  undoUntil: string | null;
  forcePush: boolean;
  moveCode: boolean;
  state: string | null;
  note: string | null;
  /** when a backup that is on by default was turned on (an older saved state has none) */
  since?: string | null;
}

/** One finished item's step for the class goal (store.js withStep). */
export interface Step {
  sid: string;
  at: string;
  pts: number;
}

/**
 * The store's saved data (store.js `empty` says what each field holds). Slices whose inside is read by code outside the
 * checked files (a profile, a day, a path unit, the look…) are Saved: what they hold is checked where it is read.
 */
export interface AppData {
  profile: Saved | null;
  progress: Record<string, { level: number; max: number }>;
  days: Record<string, Saved>;
  xp: number;
  xpBy: Record<string, number>;
  resetAt: string | null;
  path: Record<string, Saved>;
  freezes: number;
  streak: { lastRepair: string | null };
  nudges: Saved;
  reminder: Saved;
  goalXp: number;
  sound: boolean;
  haptics: boolean;
  prefs: { theme: 'system' | 'light' | 'dark'; soundSet: boolean };
  look: Saved;
  mistakes: Record<string, number>;
  lastTopic: string | null;
  outbox: OutboxEntry[];
  stepsOut: Step[];
  classGoals: Record<string, Saved>;
  ai: Saved;
  durable: Saved;
  backup: Backup;
  helpSent: number;
  solveMode: 'answer' | 'notebook';
  exams: Saved[];
  practiceExams: Saved[];
  gaps: Record<string, Saved>;
  placement: Saved | null;
  learn: import('@/learn/types').LearnState;
  classWork: Saved;
  workOutbox: Record<string, Saved>;
  teacherExams: Saved[];
}
