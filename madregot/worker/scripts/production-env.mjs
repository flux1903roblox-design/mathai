// Runs a command with the live server's settings (production.json's vars, scripts/production.mjs) in its environment.
// For the production build of the app: the landing pages, robots.txt and sitemap.xml take PUBLIC_URL, CONTACT_EMAIL,
// BUSINESS_NAME, the prices and the sale settings from the build env first, else from wrangler.toml
// (web/scripts/landing-build.mjs), so a build for the live server says what the live server does.
//
//   node scripts/production-env.mjs <command> [args…]
//   npm run build:production          (this, with: npm run build --prefix ../web)
//
// A value in production.json wins over the same name already in the environment. Nothing here is secret: production.json
// holds no key and no email address. The contact address, which never goes into git, comes from the environment instead:
// CONTACT_EMAIL (in GitHub Actions the production environment's variable of that name, deploy.yml), given to the landing
// pages as it is and to the app's teacher screens as VITE_CONTACT_EMAIL. The command's exit code is this script's.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRODUCTION_FILE, readOverlay, productionEnv } from './production.mjs';

const WORKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * How to start `argv` without a shell where possible: npm, when this runs under npm, through npm's own JavaScript file
 * and this Node (npm is npm.cmd on Windows, which cannot start without a shell); anything else as it is, with a shell
 * on Windows only. → { file, args, shell }.
 */
export function commandLine(argv, env = process.env, platform = process.platform) {
  const [cmd, ...rest] = argv;
  if (cmd === 'npm' && /\.c?js$/.test(String(env.npm_execpath || ''))) return { file: process.execPath, args: [env.npm_execpath, ...rest], shell: false };
  return { file: cmd, args: rest, shell: platform === 'win32' };
}

function main(argv) {
  if (!argv.length) {
    console.error('usage: node scripts/production-env.mjs <command> [args…]   (e.g. npm run build --prefix ../web)');
    return 1;
  }
  let overlay;
  try {
    overlay = readOverlay(readFileSync(path.join(WORKER, PRODUCTION_FILE), 'utf8'), readFileSync(path.join(WORKER, 'wrangler.toml'), 'utf8'));
  } catch (e) {
    console.error(e.message || e);
    return 1;
  }
  console.log(`production-env: ${Object.keys(overlay.vars).join(', ') || '(no settings)'} from production.json`);
  // the address itself is not printed: the log of a public repository's run is public
  console.log(`production-env: CONTACT_EMAIL ${String(process.env.CONTACT_EMAIL ?? '').trim() ? 'from the environment' : 'is not set: the pages show no e-mail address'}`);
  const { file, args, shell } = commandLine(argv);
  const r = spawnSync(file, args, { stdio: 'inherit', env: productionEnv(overlay), shell });
  if (r.error) { console.error(`production-env: could not start ${argv[0]}: ${r.error.message}`); return 1; }
  return r.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
