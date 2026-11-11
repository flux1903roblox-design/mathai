// End-to-end and visual tests for Madregot. Run from madregot/web: npm run test:e2e
// The tests build the app without a server (as the public website runs) and serve it with vite preview,
// so they need no Cloudflare worker and no AI key.
import { defineConfig } from '@playwright/test';

// E2E_PORT lets a second copy of the repo run its own suite at the same time (default 4173).
const PORT = Number(process.env.E2E_PORT) || 4173;
// The iPhone store build (STUDENT-12, VITE_STORE=ios) has its own server, on E2E_IOS_PORT (default the next port). It is
// built only when the run includes the 'ios' project (named with --project, or no --project at all), so a run of the
// phone project alone does not pay for a second build.
const IOS_PORT = Number(process.env.E2E_IOS_PORT) || PORT + 1;
const argv = process.argv.join(' ');
const WITH_IOS = !/--project[= ]/.test(argv) || /--project[= ]ios\b/.test(argv);
const IOS_ONLY = /store-ios\.spec\.js/;

const phone = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.1, animations: 'disabled', caret: 'hide' } },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screens__/{projectName}/{arg}{ext}',
  // the build registers an offline service worker (DURABLE-10); tests run without it unless a file opts in with
  // test.use({ serviceWorkers: 'allow' }) (offline.spec.js)
  use: { baseURL: `http://127.0.0.1:${PORT}/`, locale: 'he-IL', reducedMotion: 'reduce', trace: 'off', serviceWorkers: 'block' },
  webServer: [{
    // the landing pages (/mivchan/, /pilot/) are built into the same folder, as npm run build does, with stand-in values
    // for the owner's: count.js sends to API_BASE, which landing.spec.js answers with page.route
    command: `npx vite build --base ./ --outDir dist-test --emptyOutDir && node scripts/landing-build.mjs dist-test && npx vite preview --outDir dist-test --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: '..',
    env: {
      VITE_API_URL: 'none',
      PUBLIC_URL: 'https://madregot.example.test', CONTACT_EMAIL: 'hello@example.test', BUSINESS_NAME: 'מדרגות (דוגמה)', API_BASE: 'https://api.madregot.test',
    },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  }, ...(WITH_IOS ? [{
    // the iPhone store build, as store/ios builds it but with no server address (the tests answer with page.route)
    command: `npx vite build --base ./ --outDir dist-ios-test --emptyOutDir && npx vite preview --outDir dist-ios-test --port ${IOS_PORT} --strictPort --host 127.0.0.1`,
    cwd: '..',
    env: { VITE_STORE: 'ios', VITE_API_URL: 'none' },
    url: `http://127.0.0.1:${IOS_PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  }] : [])],
  projects: [
    { name: 'phone-small', use: phone(320, 568), testIgnore: IOS_ONLY },
    { name: 'phone', use: phone(390, 844), testIgnore: IOS_ONLY },
    // the same phone in dark mode (STUDENT-2): the screenshots of visual.spec, kept in __screens__/phone-dark/, and the
    // student's week (STUDENT-16), whose pictures go to qa-evidence/student/week/phone-dark/
    { name: 'phone-dark', use: { ...phone(390, 844), colorScheme: 'dark' }, testMatch: /(visual|student-week)\.spec\.js/ },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 }, testIgnore: IOS_ONLY },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, testIgnore: IOS_ONLY },
    // the iPhone store build (STUDENT-12): its own server, a phone, and service workers allowed so that "none
    // registered" means something
    { name: 'ios', use: { ...phone(390, 844), baseURL: `http://127.0.0.1:${IOS_PORT}/`, serviceWorkers: 'allow' }, testMatch: IOS_ONLY },
  ],
});
