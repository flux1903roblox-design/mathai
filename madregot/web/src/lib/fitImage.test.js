import { describe, it, expect } from 'vitest';
import { fitImage, FIT_TRIES, HELP_IMAGE_MAX } from './fitImage.js';

// a fake encoder: the size of a JPEG data URL grows with the area (scale²) and the quality
const page = (chars) => (scale, quality) => `data:image/jpeg;base64,${'A'.repeat(Math.round(chars * scale * scale * (quality / 0.82)))}`;

describe('the notebook page sent to the teacher', () => {
  it('the server keeps about 200 KB of a page (270,000 characters of its data URL), as worker/src/index.js HELP_IMAGE_MAX', async () => {
    expect(HELP_IMAGE_MAX).toBe(270_000);
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const worker = readFileSync(fileURLToPath(new URL('../../../worker/src/index.js', import.meta.url)), 'utf8');
    expect(worker).toMatch(/export const HELP_IMAGE_MAX = 270_000;/);
  });
  it('a page that fits is sent as it always was', () => {
    const calls = [];
    const url = fitImage((s, q) => { calls.push([s, q]); return page(200_000)(s, q); }, HELP_IMAGE_MAX);
    expect(calls).toEqual([FIT_TRIES[0]]);
    expect(url.length).toBeLessThanOrEqual(HELP_IMAGE_MAX);
  });
  it('a grown desktop page (about 950,000 characters) is encoded smaller until it fits the server', () => {
    const url = fitImage(page(951_000), HELP_IMAGE_MAX);
    expect(url).not.toBeNull();
    expect(url.length).toBeLessThanOrEqual(HELP_IMAGE_MAX);
  });
  it('a phone page of the size the old limit let through (600,000 characters) still fits after one or two smaller tries', () => {
    const calls = [];
    const url = fitImage((s, q) => { calls.push([s, q]); return page(600_000)(s, q); }, HELP_IMAGE_MAX);
    expect(url).not.toBeNull();
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.length).toBeLessThanOrEqual(FIT_TRIES.length);
  });
  it('a page that cannot fit is left out, so the question still reaches the teacher', () => {
    expect(fitImage(page(50_000_000), HELP_IMAGE_MAX)).toBeNull();
  });
  it('without a limit nothing changes', () => {
    expect(fitImage(page(951_000)).length).toBe(page(951_000)(1, 0.82).length);
  });
});
