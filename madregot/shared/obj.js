// One check the app and the Worker share (COUNCIL2-23): a plain object, not null and not an array. The durable layer
// (web/src/lib/durable/*), the tutor's context (tutorContext.js) and the Worker's entitlement code read saved or sent
// data with it, so all of them agree on what counts as an object.

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
export const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The same check for code that walks saved data field by field (the durable layer's merges, migrations and restores):
 * a plain object whose fields are read as `any` and each checked where it is used (COUNCIL2-21's type check).
 * @type {(v: unknown) => v is Record<string, any>}
 */
export const isRecord = isObj;
