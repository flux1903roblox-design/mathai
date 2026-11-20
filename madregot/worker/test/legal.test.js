// The legal go-live gate (trust spec TRUST-2 §5-6, TRUST-13): online checkout stays closed, for every plan, until every
// detail the legal pages quote is set and LEGAL_APPROVED names the current terms version. One variable opens it; a new
// terms version closes it again. A school licence code is the owner's own invoice sale and is not gated by it.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readiness } from '../src/readiness.js';
import { readFileSync } from 'node:fs';
import { build } from '../scripts/owner.mjs';
import { LEGAL_VARS, legalMissing, legalReady, onlineCheckout } from '../src/billing.js';
import { setup, signIn, makeClass, makeEnv, rows } from './helpers.js';

let h;
afterEach(() => h?.done());
const KEY = 'legal-gate-0123456789abcdef';
const plans = async () => (await h.call('GET', '/api/billing/plans')).json();
const buy = (token, body, headers = {}) => h.call('POST', '/api/billing/checkout', {
  headers: { 'X-Account-Token': token, 'Idempotency-Key': KEY, ...headers }, body: { adult: true, terms: '2026-11', ...body },
});

test('with LEGAL_APPROVED unset: plans say online:false and name it, and checkout is 503 legal_not_ready for every plan', async () => {
  h = await setup({ LEGAL_APPROVED: '' });
  const p = await plans();
  assert.equal(p.online, false);
  assert.equal(p.legalApproved, false);
  assert.deepEqual(p.legalMissing, ['LEGAL_APPROVED']);
  assert.equal(p.paywall, true, 'the switch itself is on: only the legal gate is closed');
  const token = await signIn(h, 'parent@example.test');
  for (const plan of ['family_month', 'family_year']) {
    const r = await buy(token, { plan });
    assert.equal(r.status, 503, plan);
    assert.equal((await r.json()).error, 'legal_not_ready');
  }
  const cls = await makeClass(h, { studentAi: true });
  const r = await buy(token, { plan: 'class_year', seats: 30 }, cls.teacher);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'legal_not_ready');
  assert.equal(rows(h.env, 'SELECT * FROM orders').length, 0, 'no order, no payment page');
  // the teacher's licence card and the health check say the same
  const lic = await (await h.call('GET', '/api/teacher/licence', { headers: cls.teacher })).json();
  assert.equal(lic.offer.online, false);
  assert.equal((await (await h.call('GET', '/api/health')).json()).checkout, false);
});

test('with every var set and LEGAL_APPROVED = TERMS_VERSION, checkout is open, and plans carry what the pages quote', async () => {
  h = await setup({
    ACCESS_COORD_NAME: 'רכזת בדיקה', ACCESS_COORD_PHONE: '03-0000001', ACCESS_COORD_EMAIL: 'access@example.test',
    ACCESS_STATEMENT_DATE: '2026-11-02', ACCESS_TESTED: 'axe, VoiceOver',
  });
  const p = await plans();
  assert.equal(p.online, true);
  assert.equal(p.legalApproved, true);
  assert.deepEqual(p.legalMissing, []);
  assert.deepEqual(p.business, {
    name: 'מדרגות בדיקה', id: '000000000', kind: 'עוסק מורשה', address: 'רחוב הבדיקה 1, תל אביב',
    email: 'hello@example.test', phone: '03-0000000', provider: 'ספק בדיקה',
  });
  assert.deepEqual(p.accessibility, { name: 'רכזת בדיקה', phone: '03-0000001', email: 'access@example.test', date: '2026-11-02', tested: 'axe, VoiceOver' });
  assert.equal(p.legalDate, '2026-11-01');
  assert.equal(p.dbJurisdiction, 'eu');
  const token = await signIn(h, 'parent@example.test');
  assert.equal((await buy(token, { plan: 'family_month' })).status, 201);
});

test('an old approval closes it again; so does an empty or wrong var, and legalMissing names each one', async () => {
  h = await setup({ LEGAL_APPROVED: '2026-10' });
  let p = await plans();
  assert.equal(p.online, false); assert.deepEqual(p.legalMissing, ['LEGAL_APPROVED']);
  const token = await signIn(h, 'parent@example.test');
  assert.equal((await buy(token, { plan: 'family_month' })).status, 503);
  h.done();

  h = await setup({ DB_JURISDICTION: '' });
  p = await plans();
  assert.equal(p.online, false); assert.equal(p.legalApproved, false); assert.deepEqual(p.legalMissing, ['DB_JURISDICTION']);
  h.done();

  // a database somewhere the privacy notice has no words for, and a date that is not a date
  h = await setup({ DB_JURISDICTION: 'fedramp', LEGAL_DATE: '1 בדצמבר' });
  p = await plans();
  assert.equal(p.online, false); assert.deepEqual(p.legalMissing, ['LEGAL_DATE', 'DB_JURISDICTION']);
  h.done();

  // a new terms version is not approved by the old sign-off
  h = await setup({ TERMS_VERSION: '2027-01' });
  p = await plans();
  assert.equal(p.online, false); assert.deepEqual(p.legalMissing, ['LEGAL_APPROVED']);
});

test('wrangler.toml ships every legal var empty, so a fresh copy is closed and legalMissing names them all', () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const vars = ['BUSINESS_NAME', 'BUSINESS_ID', 'BUSINESS_KIND', 'BUSINESS_ADDRESS', 'CONTACT_EMAIL', 'CONTACT_PHONE', 'PAYMENT_PROVIDER_NAME',
    'LEGAL_DATE', 'DB_JURISDICTION', 'LEGAL_APPROVED', 'ACCESS_COORD_NAME', 'ACCESS_COORD_PHONE', 'ACCESS_COORD_EMAIL', 'ACCESS_STATEMENT_DATE', 'ACCESS_TESTED'];
  for (const k of vars) assert.match(toml, new RegExp(`^${k} = ""$`, 'm'), k);
  const shipped = makeEnv(Object.fromEntries([...LEGAL_VARS, 'LEGAL_APPROVED'].map((k) => [k, ''])));
  assert.deepEqual(legalMissing(shipped), [...LEGAL_VARS, 'LEGAL_APPROVED']);
  assert.equal(legalReady(shipped), false);
  assert.equal(onlineCheckout(shipped), false);
  assert.equal(legalReady(makeEnv()), true);
  for (const k of LEGAL_VARS) {
    const env = makeEnv({ [k]: '  ' });
    assert.equal(legalReady(env), false, k);
    assert.deepEqual(legalMissing(env), [k]);
  }
});

test('a school licence code still attaches a class with LEGAL_APPROVED unset (the owner\'s invoice sale)', async () => {
  h = await setup({ LEGAL_APPROVED: '' });
  const code = 'ABCD-EFGH-JKMN';
  h.env.DB.raw.exec(build('grant-school', { classes: '1', seats: '30', until: '2099-08-31', invoice: 'INV-7' }, { code, approval: 'approved' }).sql);
  const cls = await makeClass(h, { setting: 'private' });
  const r = await h.call('POST', '/api/teacher/licence/claim', { headers: cls.teacher, body: { code } });
  assert.equal(r.status, 200);
  assert.equal(rows(h.env, "SELECT * FROM subscriptions WHERE kind = 'class' AND status = 'active'").length, 1);
});

test('setup.ps1 and setup.sh create the database in the EU and record DB_JURISDICTION = "eu" with its id (TRUST-15 step 1)', () => {
  const ps = readFileSync(new URL('../../setup.ps1', import.meta.url), 'utf8');
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const create = ps.split('\n').find((l) => /wrangler d1 create madregot/.test(l));
  assert.ok(create, 'setup.ps1 creates the database');
  assert.match(create, /--jurisdiction=eu\b/);
  // the same write that saves the id sets the var, and the shipped wrangler.toml has the empty value it replaces
  assert.match(ps, /\.Replace\('REPLACE_WITH_DATABASE_ID', \$id\)\.Replace\('DB_JURISDICTION = ""', 'DB_JURISDICTION = "eu"'\)/);
  assert.match(toml, /^DB_JURISDICTION = ""$/m);
  // setup.sh, its twin for a Mac or Linux machine, does the same (the go-live check names either one: readiness.js)
  const sh = readFileSync(new URL('../../setup.sh', import.meta.url), 'utf8');
  assert.match(sh.split('\n').find((l) => /wrangler d1 create madregot/.test(l)) || '', /--jurisdiction=eu\b/);
  assert.match(sh, /sed -e "s\/REPLACE_WITH_DATABASE_ID\/\$id\/" -e 's\/\^DB_JURISDICTION = ""\$\/DB_JURISDICTION = "eu"\/'/);
  assert.match(toml, /^database_id = "REPLACE_WITH_DATABASE_ID"$/m);
  // and the gate reads it: "eu" is the only value that opens checkout
  assert.equal(legalMissing(makeEnv({ DB_JURISDICTION: 'eu' })).includes('DB_JURISDICTION'), false);
  assert.equal(legalMissing(makeEnv({ DB_JURISDICTION: '' })).includes('DB_JURISDICTION'), true);
});

test('every other setup path makes the database in the EU too: setup.sh, the README\'s commands and the doctor\'s hint (COUNCIL2-6)', () => {
  const sh = readFileSync(new URL('../../setup.sh', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  // setup.sh: the create command carries the jurisdiction, and the write that saves the id sets the var
  const create = sh.split('\n').find((l) => /wrangler d1 create madregot\b/.test(l));
  assert.ok(create, 'setup.sh creates the database');
  assert.match(create, /--jurisdiction=eu\b/);
  const write = sh.split('\n').find((l) => /REPLACE_WITH_DATABASE_ID\/\$id/.test(l));
  assert.ok(write, 'setup.sh saves the id');
  assert.match(write, /s\/\^DB_JURISDICTION = ""\$\/DB_JURISDICTION = "eu"\//);
  // a database made before (or elsewhere) is named, as setup.ps1 does
  assert.match(sh, /DB_JURISDICTION is not \\"eu\\"/);
  // that sed (and setup.ps1's Replace) changes exactly one line: the one in [vars], never staging's
  assert.equal((toml.match(/DB_JURISDICTION = ""/g) || []).length, 1);
  const vars = toml.slice(toml.indexOf('[vars]'), toml.indexOf('\n[observability]'));
  assert.match(vars, /^DB_JURISDICTION = ""$/m);
  // README: the Mac or Linux commands create it in the EU and say to write DB_JURISDICTION = "eu" next to the id
  const cmd = readme.split('\n').filter((l) => /wrangler d1 create madregot\b/.test(l));
  assert.ok(cmd.length >= 1, 'README creates the database');
  for (const l of cmd) assert.match(l, /--jurisdiction=eu\b/, l);
  assert.match(readme, /DB_JURISDICTION = "eu"/);
  // the doctor's hint for a missing database names the same flag and the var
  const r = readiness({ migrationsInRepo: [], migrationsApplied: [] });
  const hint = r.items.find((i) => i.id === 'db:id');
  assert.equal(hint.ok, false);
  assert.match(hint.how, /npx wrangler d1 create madregot --jurisdiction=eu\b/);
  assert.match(hint.how, /DB_JURISDICTION = "eu"/);
  // and with an id that was not made in the EU, the doctor says so (a reminder: the legal gate keeps checkout closed)
  const notEu = readiness({ databaseId: '00000000-0000-0000-0000-000000000000', vars: { DB_JURISDICTION: '' } }).items.find((i) => i.id === 'db:eu');
  assert.equal(notEu.ok, false); assert.equal(notEu.required, false);
  assert.equal(readiness({ databaseId: '00000000-0000-0000-0000-000000000000', vars: { DB_JURISDICTION: 'eu' } }).items.find((i) => i.id === 'db:eu').ok, true);
});
