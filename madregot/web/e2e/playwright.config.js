// End-to-end and visual tests for Madregot. Run from madregot/web: npm run test:e2e
// The tests build the app without a server (as the public website runs) and serve it with vite preview,
// so they need no Cloudflare worker and no AI key.
import { defineConfig } from '@playwright/test';

// E2E_PORT lets a second copy of the repo run its own suite at the same time (default 4173).
const PORT = Number(process.env.E2E_PORT) || 4173;

const phone = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.1, animations: 'disabled', caret: 'hide' } },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screens__/{projectName}/{arg}{ext}',
  use: { baseURL: `http://127.0.0.1:${PORT}/`, locale: 'he-IL', reducedMotion: 'reduce', trace: 'off' },
  webServer: {
    command: `npx vite build --base ./ --outDir dist-test --emptyOutDir && npx vite preview --outDir dist-test --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: '..',
    env: { VITE_API_URL: 'none' },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'phone-small', use: phone(320, 568) },
    { name: 'phone', use: phone(390, 844) },
    // the same phone in dark mode (STUDENT-2): only the screenshots of visual.spec run here, kept in __screens__/phone-dark/
    { name: 'phone-dark', use: { ...phone(390, 844), colorScheme: 'dark' }, testMatch: /visual\.spec\.js/ },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  ],
});
