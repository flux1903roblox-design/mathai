// Test hooks: the exercise on screen WITH ITS ANSWER (window.__madregotItem, <html data-qa-item>), the teaching step,
// the generated exercises' seeds and the QA states of lib/qaFixtures.js. The build decides whether they can be on:
//   VITE_QA_HOOKS=1     the staging copy (publish-staging.sh): always on
//   VITE_QA_HOOKS=flag  the test builds (e2e/playwright.config.js, store/capture.cjs) and the dev server: on once
//                       localStorage 'madregot-debug' is set on the device
//   unset               every build that ships (npm run build): never. A student who sets 'madregot-debug' in the public
//                       app reads no answers in a mastery check, a class exam or a practice exam: the build folds this
//                       function to false and holds no switch (scripts/check-dist.mjs refuses one that does).
// Every hook asks here: lib/qa.test.js pins that no other file reads the flag.
export function qaOn() {
  // read in the function, not kept in a constant: the build replaces both with fixed values, and the unit tests stub them
  if (import.meta.env.VITE_QA_HOOKS === '1') return true;
  if (!(import.meta.env.DEV || import.meta.env.VITE_QA_HOOKS === 'flag')) return false;
  try { return !!localStorage.getItem('madregot-debug'); } catch { return false; /* storage blocked */ }
}
