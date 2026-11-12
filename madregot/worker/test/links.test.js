// The school links and the parents' link preview (COUNCIL2-35, COUNCIL2-36), against the in-memory D1: a shared
// assignment link resolves to what the app needs to open the work (or to join the class first) and to nothing about
// any student, a student who joins through it lands on that very assignment, and /r answers the app's page with a
// link preview that is the same for every link and holds no child data. Every name is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setup, makeClass, bearer, advanceClock } from './helpers.js';
import { REPORT_PREVIEW, PAGE_HEADERS, previewTags, publicBase } from '../src/preview.js';

let h;
afterEach(() => h?.done());
const NOW = Date.parse('2026-11-12T08:00:00Z'); // Thursday 12 November 2026, 10:00 in Jerusalem
const NAMES = ['דנה', 'יואב'];
const stair = { kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', dueOn: '2026-11-17', note: 'דנה, זה בשבילך במיוחד' };

const linkOf = (id, ip) => h.call('GET', `/api/work/${id}`, { ip });

test('a shared assignment link: what the app needs to open it, and nothing about any student', async () => {
  advanceClock(NOW - Date.now());
  h = await setup();
  const cls = await makeClass(h, { students: NAMES });
  const made = await (await h.call('POST', '/api/teacher/assignments', { headers: cls.teacher, body: stair })).json();
  const id = made.assignment.id;
  // a student works on it, so there is a result the link must not show
  await h.call('POST', `/api/class/work/${id}`, { headers: bearer(cls.students[0]), body: { state: 'done', stage: 5, passed: true } });

  const res = await linkOf(id);
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.deepEqual(b, {
    assignment: { id, kind: 'stair', skill: 'signed:1', title: stair.title, startsOn: '2026-11-12', dueOn: '2026-11-17' },
    class: { code: cls.code, name: 'ז׳3', grade: '7', open: true },
  });
  const text = JSON.stringify(b);
  for (const name of [...NAMES, 'רונית']) assert.ok(!text.includes(name), `no ${name} in the link's answer`);
  assert.ok(!/note|done|count|student|teacher|token|pin/i.test(text), text);

  // the teacher closes the class to new students: the link says so, so the screen does not offer a join that fails
  await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: true } });
  assert.equal((await (await linkOf(id)).json()).class.open, false);
});

test('an unknown, malformed or deleted assignment is 404; one network opens at most 300 links a day', async () => {
  advanceClock(NOW - Date.now());
  h = await setup();
  const cls = await makeClass(h);
  const id = (await (await h.call('POST', '/api/teacher/assignments', { headers: cls.teacher, body: stair })).json()).assignment.id;
  assert.equal((await linkOf('0123456789abcdef')).status, 404);
  assert.equal((await h.call('GET', '/api/work/NOT-AN-ID')).status, 404);
  await h.call('POST', `/api/teacher/assignments/${id}/delete`, { headers: cls.teacher, body: {} });
  assert.equal((await linkOf(id)).status, 404);
  h.env.DB.raw.prepare("UPDATE ai_usage SET count = 300 WHERE who LIKE 'alink:n:%'").run();
  const r = await linkOf(id);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'slow_down');
  assert.equal((await linkOf(id, '198.51.100.9')).status, 404, 'another network still opens links');
});

test('the round trip: the link, the join with the class code it gave, and the assignment in the class work', async () => {
  advanceClock(NOW - Date.now());
  h = await setup();
  const cls = await makeClass(h, { students: ['דנה'] });
  const id = (await (await h.call('POST', '/api/teacher/assignments', { headers: cls.teacher, body: stair })).json()).assignment.id;
  const link = await (await linkOf(id)).json();
  // a new student on a phone that has never been in the class joins with the code the link gave
  const joined = await (await h.call('POST', `/api/classes/${link.class.code}/join`, { body: { name: 'נועה', pin: '4321' } })).json();
  assert.ok(joined.token);
  const mine = await (await h.call('GET', '/api/class/work', { headers: bearer(joined) })).json();
  const a = mine.assignments.find((x) => x.id === link.assignment.id);
  assert.ok(a, 'the assignment the link named is this student\'s now');
  assert.equal(a.kind, link.assignment.kind);
  assert.equal(a.skill, link.assignment.skill);
  // and the report the app sends from the stair's page (?assignment=id) is taken
  const r = await h.call('POST', `/api/class/work/${id}`, { headers: bearer(joined), body: { state: 'started', stage: 1 } });
  assert.equal(r.status, 200);
});

// ---------------------------------------------------------------- /r: the parents' summary link's preview
const APP_PAGE = '<!doctype html>\n<html lang="he" dir="rtl">\n  <head>\n    <meta charset="UTF-8" />\n    <title>מדרגות · תרגול מתמטיקה</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n';
const assets = (seen = []) => ({
  fetch: async (req) => {
    seen.push(req);
    return new Response(APP_PAGE, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'x=1' } });
  },
});

test('/r: the app\'s page with one fixed card, and nothing of the request in it', async () => {
  const seen = [];
  h = await setup({ PUBLIC_URL: 'https://madregot.example.test/', ASSETS: assets(seen) });
  // what a crawler could be sent: a query with a name, a script, a cookie; the week itself is in the # and never arrives
  const res = await h.call('GET', '/r?name=%D7%93%D7%A0%D7%94&x=%3Cscript%3E', { headers: { Cookie: 'who=%D7%93%D7%A0%D7%94', Accept: 'text/html' } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<meta property="og:title" content="מדרגות: סיכום השבוע מהתרגול">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/madregot\.example\.test\/l\/og-report\.png">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/madregot\.example\.test\/r">/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(html.indexOf('og:title') < html.indexOf('</head>'), 'the tags are in the head');
  assert.ok(!html.includes('דנה') && !html.includes('<script>') && !/[?&](name|x)=/.test(html) && !html.includes('who=') && !html.includes('%D7'), 'nothing of the request is in the page');
  // the assets were asked for the app's page only: no query, no cookie
  assert.equal(new URL(seen[0].url).pathname, '/');
  assert.equal(new URL(seen[0].url).search, '');
  assert.equal(seen[0].headers.get('Cookie'), null);
  // the app's own security headers, and no cookie set
  assert.equal(res.headers.get('Content-Security-Policy'), PAGE_HEADERS['Content-Security-Policy']);
  assert.equal(res.headers.get('Set-Cookie'), null);
  assert.equal(res.headers.get('Content-Type'), 'text/html; charset=utf-8');
  // two links of two children answer the same page
  const other = await (await h.call('GET', '/r')).text();
  assert.equal(other, html);
  // HEAD answers the headers only
  const head = await h.call('HEAD', '/r');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('/r without PUBLIC_URL: the page as it is, with no card; without the assets binding: 404', async () => {
  h = await setup({ PUBLIC_URL: '', ASSETS: assets() });
  const html = await (await h.call('GET', '/r')).text();
  assert.equal(html, APP_PAGE);
  h.done();
  h = await setup({ PUBLIC_URL: 'https://madregot.example.test' });
  assert.equal((await h.call('GET', '/r')).status, 404);
  assert.equal(previewTags({ PUBLIC_URL: 'javascript:alert(1)' }), '');
  assert.equal(publicBase({ PUBLIC_URL: 'https://madregot.example.test/?x=1' }), '');
});

test('the card\'s words are calm, name no child, and its picture ships with the landing pages', () => {
  const words = `${REPORT_PREVIEW.title} ${REPORT_PREVIEW.description} ${REPORT_PREVIEW.imageAlt}`;
  assert.ok(!/[0-9]/.test(words), 'no number that could read as a child\'s');
  const web = new URL('../../web/', import.meta.url);
  const img = readFileSync(new URL('landing/img/og-report.png', web));
  assert.equal(img.readUInt32BE(16), REPORT_PREVIEW.width);
  assert.equal(img.readUInt32BE(20), REPORT_PREVIEW.height);
  assert.match(readFileSync(new URL('scripts/landing-build.mjs', web), 'utf8'), /'og-report\.png'/);
  // the page keeps the app's own security headers (web/public/_headers, /*)
  const headers = readFileSync(new URL('public/_headers', web), 'utf8');
  for (const [k, v] of Object.entries(PAGE_HEADERS)) assert.ok(headers.includes(`${k}: ${v}`), k);
});
