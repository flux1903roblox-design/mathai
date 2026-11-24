// Limits that the Worker and its tests share. They live here, not in index.js: Cloudflare's runtime reads every named
// export of the main module as an entry point, and refuses to start a Worker whose main module exports a number
// ("Incorrect type for map entry …"), so index.js exports its default handler and nothing else (test/entry.test.js).

/** A class holds at most this many names (the licence seats and an assignment's targets use the same number). */
export const CLASS_MAX_STUDENTS = 45;
/** New names a day from one network (IPv6 by its /48), in all its classes: a school's first day, not a script's. */
export const NEW_NAMES_PER_NET = 200;
/** The highest level a stair can have (shared/stairs.js has at most 8 per topic; the exam check already caps at 12). */
export const MAX_LEVEL = 12;
/**
 * The notebook page kept with a help request: a JPEG data URL of at most this many characters, about 200 KB (COUNCIL2-18;
 * the app fits its page to it, web/src/lib/fitImage.js). A longer one is left out and the request is kept without it.
 */
export const HELP_IMAGE_MAX = 270_000;
