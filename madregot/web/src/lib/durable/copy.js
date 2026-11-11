// Where the progress lives, in one sentence (DURABLE-3): the one place the app says it, so every screen that does
// (MyNumbers on the profile, the end of Settings) says the same, and it stays true in every mode. Each case is added
// only when what it describes exists: the backup-code clause (DURABLE-5); the server copy kept by the class or the
// family (DURABLE-6, backup.escrow); the family summary comes with that summary (PARENTS-4).
// The class sentence is the trust lane's (TRUST-1); it is written here once. "מוצפן" is said only of the backup code's
// copy, which only the code opens: never of a copy the class or the family keeps, which the server could open.
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
  /** the class keeps the code (DURABLE-6), after a class student's sentence */
  classCopyClause: 'עותק של ההתקדמות נשמר גם בשרת, כדי שתוכלו להמשיך מכל מכשיר עם הקוד האישי.',
  /** a family device whose code the family plan keeps (DURABLE-6) */
  family: 'ההתקדמות נשמרת במכשיר, ועותק שלה נשמר בשרת דרך המנוי המשפחתי, כדי שאפשר יהיה להעביר אותה למכשיר חדש.',
  /** a copy the server could open, with neither a class nor a family plan any more (a student who left the class) */
  serverCopy: 'ההתקדמות נשמרת במכשיר, ועותק שלה נשמר בשרת.',
};

const has = (state, kind) => !!state?.backup?.on && !!state.backup.code && (state.backup.escrow === kind || state.backup.escrow === 'both');
/** The backup code's copy is on (not a class or family copy the server could open, DURABLE-6). */
const codeBackupOn = (state) => !!state?.backup?.on && !!state.backup.code && !state.backup.escrow;
/** A copy the server could open (the class or the family keeps its code). */
const escrowed = (state) => !!state?.backup?.on && !!state.backup.code && !!state.backup.escrow;

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
    if (escrowed(state)) return `${cls} ${WHERE_SAVED.classCopyClause}`;
    return backup ? `${cls} ${WHERE_SAVED.backupClause}` : cls;
  }
  if (has(state, 'family')) return WHERE_SAVED.family;
  if (escrowed(state)) return WHERE_SAVED.serverCopy;
  return backup ? WHERE_SAVED.backup : WHERE_SAVED.solo;
}
