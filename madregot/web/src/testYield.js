// Vitest setup (vite.config.js). A test file of long synchronous tests (the guessing measure, the label properties)
// would never let its worker read the runner's replies between tests, and a reply waited for over a minute is
// reported as an unhandled error that fails the run. One turn of the event loop after each test lets them through.
import { afterEach } from 'vitest';

afterEach(() => new Promise((resolve) => { setImmediate(resolve); }));
