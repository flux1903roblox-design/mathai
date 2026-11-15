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
// The contract project (COUNCIL2-22, e2e/contract.js): the tests tagged @contract in these files run against the real
// Worker (worker/scripts/serve-local.mjs on CONTRACT_PORT, default 4423), which also serves an app built with
// VITE_API_URL="/". Built and started only when the run includes the 'contract' project (or no --project at all).
const CONTRACT_PORT = Number(process.env.CONTRACT_PORT) || 4423;
const WITH_CONTRACT = !/--project[= ]/.test(argv) || /--project[= ]contract\b/.test(argv);
const CONTRACT_SPECS = /(class-sync|durable|restore|tutor|subscription|school-links)\.spec\.js/;
// Arabic is behind a build flag that is off by default (VITE_ARABIC, lib/i18n.js): every other project runs the default
// build, where arabic-off.spec.js checks that nothing Arabic is offered or fetched. arabic.spec.js runs in the 'arabic'
// project against a build made with VITE_ARABIC=on, on E2E_AR_PORT (default the third port after E2E_PORT), built only
// when the run includes that project (or no --project at all).
const AR_PORT = Number(process.env.E2E_AR_PORT) || PORT + 3;
const WITH_ARABIC = !/--project[= ]/.test(argv) || /--project[= ]arabic\b/.test(argv);
const ARABIC_ONLY = /arabic\.spec\.js/;
/** The specs of a build other than the default one: the store build's and the Arabic build's. */
const OTHER_BUILD = [IOS_ONLY, ARABIC_ONLY];

const phone = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.1, animations: 'disabled', caret: 'hide' } },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screens__/{projectName}/{arg}{ext}',
  // The build is a production build, so its service worker (DURABLE-10) would register in every test: blocked here, so
  // every test starts with the network and the page routes it expects; offline.spec.js allows it for itself
  // (test.use({ serviceWorkers: 'allow' })).
  use: { baseURL: `http://127.0.0.1:${PORT}/`, locale: 'he-IL', reducedMotion: 'reduce', trace: 'off', serviceWorkers: 'block' },
  webServer: [{
    // the landing pages (/mivchan/, /pilot/) are built into the same folder, as npm run build does, with stand-in values
    // for the owner's: count.js sends to API_BASE, which landing.spec.js answers with page.route
    command: `npx vite build --base ./ --outDir dist-test --emptyOutDir && node scripts/landing-build.mjs dist-test && npx vite preview --outDir dist-test --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: '..',
    // no server, as the public site; VITE_TEACHER_URL: the public teacher page points to the full app (TEACHER-1);
    // the landing pages' stand-in owner values (scripts/landing-build.mjs), selling as Grow does at launch, before it
    // lets us stop a standing order: the plans paid once, the one-year plan (COUNCIL2-30) and the exam pass
    // (COUNCIL2-33). wrangler.toml ships the pass with no price (the owner decides it), so the tests give the landing
    // build one of their own: ₪39, in the test environment only.
    env: {
      VITE_API_URL: 'none', VITE_TEACHER_URL: 'https://example.test/',
      PUBLIC_URL: 'https://madregot.example.test', CONTACT_EMAIL: 'hello@example.test', BUSINESS_NAME: 'מדרגות (דוגמה)', API_BASE: 'https://api.madregot.test',
      BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'off', LANDING_PRICE_PASS_AGOROT: '3900',
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
  }] : []), ...(WITH_CONTRACT ? [{
    // the app as the Worker serves it in production (one address, VITE_API_URL="/"), from the local Worker with its
    // test vars and stubs: no .dev.vars, no key, nothing leaves the machine
    command: `npx vite build --base ./ --outDir dist-contract --emptyOutDir && node ../worker/scripts/serve-local.mjs --port ${CONTRACT_PORT} --app dist-contract`,
    cwd: '..',
    env: { VITE_API_URL: '/', VITE_TEACHER_URL: 'https://example.test/' },
    url: `http://127.0.0.1:${CONTRACT_PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  }] : []), ...(WITH_ARABIC ? [{
    // the app with Arabic in it (VITE_ARABIC=on), with no server, as the default build
    command: `npx vite build --base ./ --outDir dist-arabic-test --emptyOutDir && npx vite preview --outDir dist-arabic-test --port ${AR_PORT} --strictPort --host 127.0.0.1`,
    cwd: '..',
    env: { VITE_ARABIC: 'on', VITE_API_URL: 'none', VITE_TEACHER_URL: 'https://example.test/' },
    url: `http://127.0.0.1:${AR_PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  }] : [])],
  projects: [
    { name: 'phone-small', use: phone(320, 568), testIgnore: OTHER_BUILD },
    { name: 'phone', use: phone(390, 844), testIgnore: OTHER_BUILD },
    // the same phone in dark mode (STUDENT-2): the screenshots of visual.spec, kept in __screens__/phone-dark/, and the
    // student's week (STUDENT-16), whose pictures go to qa-evidence/student/week/phone-dark/, and the axe scan of every
    // screen (PKG-1, a11y.spec.js), so every colour pair is checked in both themes
    { name: 'phone-dark', use: { ...phone(390, 844), colorScheme: 'dark' }, testMatch: /(visual|student-week|a11y)\.spec\.js/ },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 }, testIgnore: OTHER_BUILD },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, testIgnore: OTHER_BUILD },
    // the iPhone store build (STUDENT-12): its own server, a phone, and service workers allowed so that "none
    // registered" means something
    { name: 'ios', use: { ...phone(390, 844), baseURL: `http://127.0.0.1:${IOS_PORT}/`, serviceWorkers: 'allow' }, testMatch: IOS_ONLY },
    // the real Worker (COUNCIL2-22): the @contract tests of the class sync, the backup code and the class's kept code,
    // the tutor's allowance and the parents' checkout, on the same phone
    { name: 'contract', use: { ...phone(390, 844), baseURL: `http://127.0.0.1:${CONTRACT_PORT}/` }, testMatch: CONTRACT_SPECS, grep: /@contract/ },
    // the build with Arabic in it (VITE_ARABIC=on): the Arabic shell and the Arabic topic, on the two phones
    { name: 'arabic', use: { ...phone(390, 844), baseURL: `http://127.0.0.1:${AR_PORT}/` }, testMatch: ARABIC_ONLY },
    { name: 'arabic-small', use: { ...phone(320, 568), baseURL: `http://127.0.0.1:${AR_PORT}/` }, testMatch: ARABIC_ONLY },
  ],
});
