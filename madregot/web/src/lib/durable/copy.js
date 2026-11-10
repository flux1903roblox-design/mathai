// Where the progress lives, in one sentence (DURABLE-3): the one place the app says it, so every screen that does
// (MyNumbers on the profile, the end of Settings) says the same, and it stays true in every mode. Each case is added
// only when what it describes exists: the backup-code clause comes with the backup code (DURABLE-5), the server copy for
// class students and family devices with that copy (DURABLE-6), the family summary with that summary (PARENTS-4).
// A family device keeps its progress only on the device today, so it is told the solo sentence.
// The class sentence is the trust lane's (TRUST-1); it is written here once.
import { hasServer } from '../api.js';

export const WHERE_SAVED = {
  /** a build with no server (the public practice site): nothing leaves the device, and a backup file is the way to keep it */
  noServer: 'ההתקדמות נשמרת במכשיר הזה. כדאי לשמור קובץ גיבוי מדי פעם.',
  /** with a server, a student in no class */
  solo: 'ההתקדמות נשמרת רק במכשיר הזה.',
  /** a class student, under their numbers (MyNumbers): every answer goes to the teacher's board too */
  classNumbers: 'המספרים האלה מחושבים במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.',
  /** a class student, anywhere else (Settings) */
  classProgress: 'ההתקדמות נשמרת במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.',
};

/**
 * The sentence for this state. `server`: the app has a server (default: this build's); `about`: 'numbers' under the
 * learning numbers, else 'progress'. A class student is one signed in to a class (profile.token): only then are the
 * answers sent (store.js recordAnswer).
 */
export function whereSavedText(state, { server = hasServer(), about = 'progress' } = {}) {
  if (!server) return WHERE_SAVED.noServer;
  if (state?.profile?.role === 'student' && state.profile.token) return about === 'numbers' ? WHERE_SAVED.classNumbers : WHERE_SAVED.classProgress;
  return WHERE_SAVED.solo;
}
