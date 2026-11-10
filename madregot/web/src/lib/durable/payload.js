// What a backup holds (DURABLE-4): the student's whole saved progress, without what belongs to this device. Used by the
// backup file now, and by the vault and the class and family restores later, so every copy that leaves the device is
// made the same way.
//   left out   ai (the tutor on this device), outbox (class answers waiting for the server), durable (this device's
//              tag and save prompts), backup (this device's backup settings), classWork and workOutbox (the teacher's
//              work as last fetched, and its reports waiting for the server), and the profile's class token and
//              student id: with them, someone else could act as this student in the class
//   kept       everything else, and a teacher's class keys (profile.classes[].key): for a class that is not tied to
//              an email account the key is the only way back in, so the teacher's file note says who can use it
import { DEVICE_ONLY, dataOf } from './merge.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A plain copy of `state` for a backup: no device-only slices, no class token or student id. */
export function snapshotForBackup(state) {
  const out = dataOf(state);
  for (const k of DEVICE_ONLY) delete out[k];
  if (isObj(out.profile)) {
    const { token, studentId, ...profile } = out.profile; // eslint-disable-line no-unused-vars
    out.profile = profile;
  }
  return JSON.parse(JSON.stringify(out));
}
