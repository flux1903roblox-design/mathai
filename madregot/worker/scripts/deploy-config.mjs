// Writes wrangler.deploy.toml next to wrangler.toml and prints how many settings Cloudflare gets (the free Workers plan
// takes 64, text vars and secrets together). What the file is and why: scripts/deployConfig.mjs.
//
//   node scripts/deploy-config.mjs                 wrangler.toml as it is (npm run deploy, setup.ps1, setup.sh, deploy.ps1)
//   node scripts/deploy-config.mjs --production    wrangler.toml plus production.json, the live server's own settings
//                                                  (scripts/production.mjs: GitHub Actions > Deploy, npm run
//                                                  deploy:production, npm run db:migrate:production)
//
// Exits 1, with the file removed, when the deploy file would not mean what wrangler.toml (and production.json) says, so
// a deploy that follows with --config wrangler.deploy.toml never runs on an old or wrong file. With --production it also
// exits 1 while git says wrangler.toml or production.json has changes that are not committed: the live server gets only
// committed settings, never a value that was edited on one computer.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDeployFile, FREE_PLAN_SETTINGS, SECRETS_ROOM } from './deployConfig.mjs';
import { PRODUCTION_FILE, uncommitted } from './production.mjs';
import { BLANK_VARS } from '../src/blankVars.js';
import { configErrorLine } from './wranglerConfig.mjs';

function main(args) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = path.join(here, '..');
  const unknown = args.filter((a) => a !== '--production');
  if (unknown.length) {
    console.error(`unknown argument: ${unknown[0]}\nusage: node scripts/deploy-config.mjs [--production]`);
    return 1;
  }
  const production = args.includes('--production');
  if (production) {
    const dirty = uncommitted(dir, ['wrangler.toml', PRODUCTION_FILE]);
    if (dirty) {
      console.error(`Not writing the production deploy file: ${dirty}`);
      console.error('A production deploy reads only committed settings. Put a value for the live server in production.json');
      console.error('(npm run owner -- set --production NAME=value) and commit it; set other local changes aside (git stash).');
      return 1;
    }
  }
  let w;
  try {
    w = writeDeployFile({ sourceFile: path.join(dir, 'wrangler.toml'), production });
  } catch (e) {
    console.error(`Could not write wrangler.deploy.toml: ${configErrorLine(e)}`);
    if (e?.message?.includes('\n')) console.error(e.message.split('\n').slice(1).join('\n'));
    return 1;
  }
  const empty = w.folded.vars?.length || 0;
  const from = production ? `; production.json sets ${Object.keys(w.overlay.vars).length}` : '';
  console.log(`wrangler.deploy.toml: ${w.sent} settings for Cloudflare (${empty} empty ones sent as one, ${BLANK_VARS}${from}).`);
  if (w.sent + SECRETS_ROOM > FREE_PLAN_SETTINGS) {
    console.log(`With the secrets that is more than the ${FREE_PLAN_SETTINGS} the free Workers plan takes. If the deploy is refused`);
    console.log('with "exceeded the maximum number of environment variables", move to Workers Paid (128) in the Cloudflare dashboard.');
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
