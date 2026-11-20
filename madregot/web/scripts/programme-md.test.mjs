// `npm run programme:check` is the gate that says PROGRAMME.md and store/counts.json are what the code gives
// (claims.test.ts compares their text). It runs the app's content under vite-node, and content/manip.js asks for the
// objects' late files as it loads (content/late.js: the grid's rules and the drawings). A run that ended before they
// arrived had vite-node close under the request: it printed "up to date" and then exited 1 with ERR_CLOSED_SERVER, so
// the gate failed on a clean tree. The script now waits for those files before it ends.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('..', import.meta.url));

describe('npm run programme:check', () => {
  it('says "up to date" and exits 0 on the committed files, with nothing left in flight', () => {
    const run = spawnSync(process.execPath, ['node_modules/vite-node/vite-node.mjs', 'scripts/programme-md.mjs', '--check'], { cwd: WEB, encoding: 'utf8' });
    expect(run.stderr).not.toMatch(/ERR_CLOSED_SERVER|out of date/);
    expect(run.stdout).toContain('up to date');
    expect(run.status).toBe(0);
  }, 180_000); // a vite-node start that loads every topic's content: seconds alone, longer on a busy machine
});
