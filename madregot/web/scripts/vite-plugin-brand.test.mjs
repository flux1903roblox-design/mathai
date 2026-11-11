// The product's name lives in shared/brand.js only (STUDENT-12): index.html and the web manifest carry %APP_NAME%,
// which the build fills (scripts/vite-plugin-brand.mjs), so a rename is one line.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_NAME } from '../../shared/brand.js';
import { fillBrand } from './vite-plugin-brand.mjs';
import { WEB } from './landing-build.mjs';

describe('the product name', () => {
  it('is written once, in shared/brand.js', () => {
    expect(APP_NAME).toBe('מדרגות');
    const html = readFileSync(join(WEB, 'index.html'), 'utf8');
    const manifest = readFileSync(join(WEB, 'public/manifest.webmanifest'), 'utf8');
    expect(html).not.toContain(APP_NAME);
    expect(manifest).not.toContain(APP_NAME);
    expect(html.match(/%APP_NAME%/g)).toHaveLength(3); // the description, the Home Screen name, the title
    const m = JSON.parse(manifest);
    expect([m.name, m.short_name]).toEqual(['%APP_NAME%', '%APP_NAME%']);
  });

  it('is filled in wherever the placeholder stands', () => {
    expect(fillBrand('<title>%APP_NAME% · תרגול</title> %APP_NAME%')).toBe(`<title>${APP_NAME} · תרגול</title> ${APP_NAME}`);
    expect(JSON.parse(fillBrand(readFileSync(join(WEB, 'public/manifest.webmanifest'), 'utf8'))).name).toBe(APP_NAME);
  });
});
