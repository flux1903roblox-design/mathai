// The privacy notice's retention numbers are the Worker's: the vault's 400 days, the error reports' 30 days, the
// parents' daily summaries' 90 days and the daily reminder's 45 days, all read by their purges from shared/retention.js
// (FOLLOWUP-24). A change of any of them fails here until web/src/content/legal/privacy.md says the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RETENTION as R } from '../../shared/retention.js';

const notice = readFileSync(new URL('../../web/src/content/legal/privacy.md', import.meta.url), 'utf8');
const line = (lead) => notice.split('\n').find((l) => l.includes(`**${lead}`)) || '';

test('the privacy notice keeps the vault, the error reports and the daily reminder exactly as long as the Worker does', () => {
  assert.match(line('עותק הגיבוי בשרת'), new RegExp(`אחרי ${R.vaultIdleDays} יום`));
  assert.match(line('דיווחי תקלות**'), new RegExp(`אחרי ${R.clientErrorsDays} יום`));
  assert.match(line('דיווחי תקלות.'), new RegExp(`נשמרים ${R.clientErrorsDays} יום`));
  assert.match(line('התזכורת היומית**'), new RegExp(`אחרי ${R.pushIdleDays} יום שבהם האפליקציה לא נפתחה`));
});

test('the privacy notice keeps the parents\' daily summaries exactly as long as the Worker does', () => {
  assert.match(line('סיכומי ההתקדמות מהמכשיר של הילד:'), new RegExp(`:\\*\\* ${R.familyDailyDays} יום\\.`));
});

test('the privacy notice keeps the waitlist exactly as long as the Worker does, and says how to leave it', () => {
  const keep = line('רשימת ההמתנה**');
  assert.match(keep, new RegExp(`נמחקת ${R.waitlistAfterLaunchDays} יום אחרי שהאפליקציה יוצאת לחנויות, ולכל המאוחר ${R.waitlistMaxDays} יום אחרי ההרשמה`));
  // what is kept, why, and how to be removed: a line that writing to the contact email removes you
  const part = notice.slice(notice.indexOf('{#waitlist}'), notice.indexOf('### ', notice.indexOf('{#waitlist}')));
  for (const t of ['כתובת המייל', 'בלי שם, בלי כתובת רשת ובלי מספר מכשיר', 'למה:', 'מייל אחד', 'כתבו לנו ל־{{CONTACT_EMAIL}} ונמחק את הכתובת']) assert.ok(part.includes(t), t);
  assert.match(line('רשימת ההמתנה:**'), /כתבו לנו ל־\{\{CONTACT_EMAIL\}\}/);
});

test('the privacy notice says what the waitlist code does: adults only, the network code and its days, the launch email marked and sent by Resend', async () => {
  const { WAITLIST_ROLES, LAUNCH_TEXT } = await import('../src/waitlist.js');
  const part = notice.slice(notice.indexOf('{#waitlist}'), notice.indexOf('### ', notice.indexOf('{#waitlist}')));
  // the code takes parents and teachers only, and the text says students are not asked for an email, here too
  assert.deepEqual(WAITLIST_ROLES, ['parent', 'teacher']);
  assert.ok(part.includes('נרשמים לרשימה רק הורים ומורים') && part.includes('מתלמידים אנחנו לא מבקשים מייל'));
  assert.doesNotMatch(part, /תלמיד או תלמידה|מתחת לגיל/);
  assert.match(notice.slice(notice.indexOf('{#kids}')), /לרשימת ההמתנה נרשמים רק הורים ומורים/);
  // the signup limits' network code, kept as long as every counter (ai_usage)
  assert.match(part, new RegExp(`קוד מקודד של הרשת \\(לא כתובת ה־IP\\) עד ${R.aiUsageDays} יום`));
  // the launch email: marked as the subject of the code is, sent through the recipient named in "למי המידע עובר"
  assert.match(LAUNCH_TEXT.subject([{ phone: 'iPhone' }]), /^פרסומת: /);
  assert.ok(part.includes('"פרסומת"') && part.includes('Resend') && part.includes('קישור להסרה'));
  assert.match(notice.slice(notice.indexOf('{#share}')), /Resend:[^\n]*המייל האחד של רשימת ההמתנה/);
  // and "no marketing email" is no longer said beside it
  assert.doesNotMatch(notice, /לא שולחים מיילים שיווקיים/);
});
