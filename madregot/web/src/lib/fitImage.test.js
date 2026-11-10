import { describe, it, expect } from 'vitest';
import { fitImage, FIT_TRIES, HELP_IMAGE_MAX } from './fitImage.js';

// a fake encoder: the size of a JPEG data URL grows with the area (scale²) and the quality
const page = (chars) => (scale, quality) => `data:image/jpeg;base64,${'A'.repeat(Math.round(chars * scale * scale * (quality / 0.82)))}`;

describe('the notebook page sent to the teacher', () => {
  it('a page that fits is sent as it always was', () => {
    const calls = [];
    const url = fitImage((s, q) => { calls.push([s, q]); return page(300_000)(s, q); }, HELP_IMAGE_MAX);
    expect(calls).toEqual([FIT_TRIES[0]]);
    expect(url.length).toBeLessThanOrEqual(HELP_IMAGE_MAX);
  });
  it('a grown desktop page (about 950,000 characters) is encoded smaller until it fits the server', () => {
    const url = fitImage(page(951_000), HELP_IMAGE_MAX);
    expect(url).not.toBeNull();
    expect(url.length).toBeLessThanOrEqual(HELP_IMAGE_MAX);
  });
  it('a page that cannot fit is left out, so the question still reaches the teacher', () => {
    expect(fitImage(page(50_000_000), HELP_IMAGE_MAX)).toBeNull();
  });
  it('without a limit nothing changes', () => {
    expect(fitImage(page(951_000)).length).toBe(page(951_000)(1, 0.82).length);
  });
});
