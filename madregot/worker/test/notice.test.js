// The privacy notice's retention numbers are the Worker's: the vault's 400 days (vault.js), the error reports' 30
// days (errors.js) and the parents' daily summaries' 90 days (report.js). A change of any of these constants fails here
// until web/src/content/legal/privacy.md says the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VAULT_KEEP_DAYS } from '../src/vault.js';
import { KEEP_DAYS as ERRORS_KEEP_DAYS } from '../src/errors.js';
import { REPORT_KEEP_DAYS } from '../src/report.js';

const notice = readFileSync(new URL('../../web/src/content/legal/privacy.md', import.meta.url), 'utf8');
const line = (lead) => notice.split('\n').find((l) => l.includes(`**${lead}`)) || '';

test('the privacy notice keeps the vault and the error reports exactly as long as the Worker does', () => {
  assert.match(line('עותק הגיבוי בשרת'), new RegExp(`אחרי ${VAULT_KEEP_DAYS} יום`));
  assert.match(line('דיווחי תקלות**'), new RegExp(`אחרי ${ERRORS_KEEP_DAYS} יום`));
  assert.match(line('דיווחי תקלות.'), new RegExp(`נשמרים ${ERRORS_KEEP_DAYS} יום`));
});

test('the privacy notice keeps the parents\' daily summaries exactly as long as the Worker does', () => {
  assert.match(line('סיכומי ההתקדמות מהמכשיר של הילד:'), new RegExp(`:\\*\\* ${REPORT_KEEP_DAYS} יום\\.`));
});
