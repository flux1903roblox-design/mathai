// Vitest setup (vite.config.js). A test file of long synchronous tests (the guessing measure, the label properties)
// would never let its worker read the runner's replies between tests, and a reply waited for over a minute is
// reported as an unhandled error that fails the run. One turn of the event loop after each test lets them through.
import { afterEach, beforeAll } from 'vitest';

afterEach(() => new Promise((resolve) => { setImmediate(resolve); }));

// The exercise generators load per topic in the app (content/index.js loadGens, COUNCIL2-14: a screen waits for its
// topic before its first question). Unit tests make questions of any topic at once, so every topic's generators are
// loaded before a test file's tests run (the same module instances the test file imports). In beforeAll, after the
// test file's own imports, as the static imports loaded them before the split: a file that seeds Math.random before
// its imports (vi.hoisted, items.test.ts) still seeds it before content/sys.js keeps it (rnd0).
beforeAll(async () => {
  const { loadAllGens } = await import('@/content/index.js');
  await loadAllGens();
});

