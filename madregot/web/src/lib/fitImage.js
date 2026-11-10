// A picture made small enough to send: the notebook page a child sends to the teacher can grow without limit, and the
// server keeps a page of at most 600,000 characters (a bigger request body is refused outright). The page is encoded
// again at a smaller scale or a lower JPEG quality until it fits; if nothing fits, it is left out and the request goes
// without it.

/** The tries, in order: [scale factor, JPEG quality]. The first is the page as it was always sent. */
export const FIT_TRIES = [[1, 0.82], [1, 0.7], [0.8, 0.7], [0.65, 0.65], [0.5, 0.6], [0.4, 0.55], [0.3, 0.5]];
/** The most the server keeps of a help request's notebook page (worker/src/index.js askHelp). */
export const HELP_IMAGE_MAX = 600_000;

/** encode(scale, quality) → a data URL. Returns the first that is at most `max` characters long, or null. */
export function fitImage(encode, max = Infinity, tries = FIT_TRIES) {
  for (const [scale, quality] of tries) {
    const url = encode(scale, quality);
    if (url && url.length <= max) return url;
  }
  return null;
}
