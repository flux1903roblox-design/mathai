// Where the progress lives, in one sentence (DURABLE-3): the one place the app says it, so every screen that does
// (MyNumbers on the profile, the end of Settings) says the same, and it stays true in every mode. Each case is added
// only when what it describes exists: the backup-code clause (DURABLE-5) is here; the server copy for class students
// and family devices comes with that copy (DURABLE-6), the family summary with that summary (PARENTS-4).
// A family device has no server copy of its own yet, so it is told the solo sentence (or the backup code's).
// The class sentence is the trust lane's (TRUST-1); it is written here once. "מוצפן" is said only of the backup code's
// copy, which only the code opens: never of a copy the server could read.
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
  /** the backup code is on (DURABLE-5): an encrypted copy only the code opens */
  backup: 'ההתקדמות נשמרת במכשיר, ועותק מוצפן שרק הקוד שלכם פותח נשמר בגיבוי.',
  /** the backup code is on, after a class student's sentence */
  backupClause: 'עותק מוצפן שרק הקוד שלכם פותח נשמר גם בגיבוי.',
};

/** The backup code's copy is on (not a class or family copy the server could open, DURABLE-6). */
const codeBackupOn = (state) => !!state?.backup?.on && !!state.backup.code && !state.backup.escrow;

/**
 * The sentence for this state ({ profile, backup }). `server`: the app has a server (default: this build's); `about`: 'numbers' under the
 * learning numbers, else 'progress'. A class student is one signed in to a class (profile.token): only then are the
 * answers sent (store.js recordAnswer).
 */
export function whereSavedText(state, { server = hasServer(), about = 'progress' } = {}) {
  if (!server) return WHERE_SAVED.noServer;
  const backup = codeBackupOn(state);
  if (state?.profile?.role === 'student' && state.profile.token) {
    const cls = about === 'numbers' ? WHERE_SAVED.classNumbers : WHERE_SAVED.classProgress;
    return backup ? `${cls} ${WHERE_SAVED.backupClause}` : cls;
  }
  return backup ? WHERE_SAVED.backup : WHERE_SAVED.solo;
}
