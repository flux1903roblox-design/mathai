// Writes wrangler.deploy.toml next to wrangler.toml and prints how many settings Cloudflare gets (the free Workers plan
// takes 64, text vars and secrets together). What the file is and why: scripts/deployConfig.mjs.
//
//   node scripts/deploy-config.mjs
//
// Exits 1, with the file removed, when the deploy file would not mean what wrangler.toml says, so a deploy that follows
// with --config wrangler.deploy.toml never runs on an old or wrong file.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldBlankVars, envNames, differences, settingsSent, FREE_PLAN_SETTINGS, SECRETS_ROOM } from './deployConfig.mjs';
import { BLANK_VARS } from '../src/blankVars.js';
import { readWranglerConfig, configErrorLine } from './wranglerConfig.mjs';

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = path.join(here, '..');
  const sourceFile = path.join(dir, 'wrangler.toml');
  const deployFile = path.join(dir, 'wrangler.deploy.toml');
  rmSync(deployFile, { force: true }); // never a file from an earlier run, whatever happens below
  let folded;
  try {
    const source = readFileSync(sourceFile, 'utf8');
    folded = foldBlankVars(source);
    writeFileSync(deployFile, folded.text);
    const found = differences(readWranglerConfig, sourceFile, deployFile, envNames(source));
    if (found.length) throw new Error(`wrangler.deploy.toml would not mean what wrangler.toml says:\n  ${found.join('\n  ')}`);
  } catch (e) {
    rmSync(deployFile, { force: true });
    console.error(`Could not write wrangler.deploy.toml: ${configErrorLine(e)}`);
    if (e?.message?.includes('\n')) console.error(e.message.split('\n').slice(1).join('\n'));
    process.exit(1);
  }
  const sent = settingsSent(readWranglerConfig, deployFile);
  const empty = folded.folded.vars?.length || 0;
  console.log(`wrangler.deploy.toml: ${sent} settings for Cloudflare (${empty} empty ones sent as one, ${BLANK_VARS}).`);
  if (sent + SECRETS_ROOM > FREE_PLAN_SETTINGS) {
    console.log(`With the secrets that is more than the ${FREE_PLAN_SETTINGS} the free Workers plan takes. If the deploy is refused`);
    console.log('with "exceeded the maximum number of environment variables", move to Workers Paid (128) in the Cloudflare dashboard.');
  }
}

await main();
