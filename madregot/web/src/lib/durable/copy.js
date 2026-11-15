// @ts-check
// Where the progress lives, in one sentence (DURABLE-3): the one place the app says it, so every screen that does
// (MyNumbers on the profile, the end of Settings) says the same, and it stays true in every mode. Each case is added
// only when what it describes exists: the backup-code clause (DURABLE-5); the server copy kept by the class or the
// family (DURABLE-6, backup.escrow); the family summary comes with that summary (PARENTS-4).
// The class sentence is the trust lane's (TRUST-1); it is written here once. "מוצפן" is said only of the backup code's
// copy, which only the code opens: never of a copy the class or the family keeps, which the server could open.
import '@/locales/settings.js'; // this screen's words, before anything here uses them (COUNCIL2-34)
import { hasServer } from '../api.js';

import { localized, t } from '@/lib/i18n.js';
export let WHERE_SAVED = localized(() => ({
  /** a build with no server (the public practice site): nothing leaves the device, and a backup file is the way to keep it */
  noServer: t('settings.copy.1'),
  /** with a server, a student in no class */
  solo: t('settings.copy.2'),
  /** a class student, under their numbers (MyNumbers): every answer goes to the teacher's board too */
  classNumbers: t('settings.copy.3'),
  /** a class student, anywhere else (Settings) */
  classProgress: t('settings.copy.4'),
  /** the backup code is on (DURABLE-5): an encrypted copy only the code opens */
  backup: t('settings.copy.5'),
  /** the backup code is on, after a class student's sentence */
  backupClause: t('settings.copy.6'),
  /** the class keeps the code (DURABLE-6), after a class student's sentence */
  classCopyClause: t('settings.copy.7'),
  /** a family device whose code the family plan keeps (DURABLE-6) */
  family: t('settings.copy.8'),
  /** a copy the server could open, with neither a class nor a family plan any more (a student who left the class) */
  serverCopy: t('settings.copy.9'),
  /** a linked device whose parents' summary is on (PARENTS-4), after the sentence about the progress */
  summaryClause: t('settings.copy.10'),
  /** the progress on the device, when the summary clause follows (so "רק" is not said of a device that sends one) */
  device: t('settings.copy.11'),
}), (v) => { WHERE_SAVED = v; });

/** @typedef {import('./types').Saved | null | undefined} State */
/**
 * @param {State} state
 * @param {'class' | 'family'} kind
 */
const has = (state, kind) => !!state?.backup?.on && !!state.backup.code && (state.backup.escrow === kind || state.backup.escrow === 'both');
/** The backup code's copy is on (not a class or family copy the server could open, DURABLE-6). */
/** @param {State} state */
const codeBackupOn = (state) => !!state?.backup?.on && !!state.backup.code && !state.backup.escrow;
/** A copy the server could open (the class or the family keeps its code). */
/** @param {State} state */
const escrowed = (state) => !!state?.backup?.on && !!state.backup.code && !!state.backup.escrow;

/**
 * The sentence for this state ({ profile, backup }). `server`: the app has a server (default: this build's); `about`: 'numbers' under the
 * learning numbers, else 'progress'. A class student is one signed in to a class (profile.token): only then are the
 * answers sent (store.js recordAnswer). `summary`: this device is linked and its parents' summary is on (the server's
 * linked.summary === 'on'): the summary clause follows the sentence.
 * @param {State} state
 * @param {{ server?: boolean, about?: 'numbers' | 'progress', summary?: boolean }} [opts]
 * @returns {string}
 */
export function whereSavedText(state, { server = hasServer(), about = 'progress', summary = false } = {}) {
  if (!server) return WHERE_SAVED.noServer;
  const base = progressText(state, about);
  if (!summary) return base;
  return `${base === WHERE_SAVED.solo ? WHERE_SAVED.device : base} ${WHERE_SAVED.summaryClause}`;
}

/**
 * @param {State} state
 * @param {'numbers' | 'progress'} about
 */
function progressText(state, about) {
  const backup = codeBackupOn(state);
  if (state?.profile?.role === 'student' && state.profile.token) {
    const cls = about === 'numbers' ? WHERE_SAVED.classNumbers : WHERE_SAVED.classProgress;
    if (escrowed(state)) return `${cls} ${WHERE_SAVED.classCopyClause}`;
    return backup ? `${cls} ${WHERE_SAVED.backupClause}` : cls;
  }
  if (has(state, 'family')) return WHERE_SAVED.family;
  if (escrowed(state)) return WHERE_SAVED.serverCopy;
  return backup ? WHERE_SAVED.backup : WHERE_SAVED.solo;
}
