// The axe check can fail (PKG-1b): a page with a known violation is caught and named, a clean page passes, and the
// contrast rule cannot be turned off. Without this, a helper that never ran axe would look like a clean app.
import { test, expect } from '@playwright/test';
import { expectNoAxeViolations } from './axe.js';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'the helper is checked once, on one phone'); });

const page = (body) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>בדיקה</title></head>
<body><main><h1>בדיקה</h1>${body}</main></body></html>`;

test('a button with no name fails, and the message names the rule, the element and how to fix it', async ({ page: p }) => {
  await p.setContent(page('<button type="button"><svg width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="8"/></svg></button>'));
  let message = '';
  await expectNoAxeViolations(p).catch((e) => { message = e.message; });
  expect(message, 'the scan failed').not.toBe('');
  expect(message).toContain('[button-name] (critical)');
  expect(message).toContain('Buttons must have discernible text');
  expect(message).toContain('https://dequeuniversity.com/rules/axe/4.10/button-name');
  expect(message).toContain('["button"]');
  expect(message).toContain('<button type="button">');
});

test('text under 4.5:1 fails as color-contrast', async ({ page: p }) => {
  await p.setContent(page('<p style="color:#aaa;background:#fff">טקסט חיוור מדי</p>'));
  await expect(expectNoAxeViolations(p)).rejects.toThrow(/\[color-contrast\]/);
});

test('a clean page passes, and the scan really ran its rules', async ({ page: p }) => {
  await p.setContent(page('<p>שלום</p><button type="button">המשך</button>'));
  const results = await expectNoAxeViolations(p);
  const ran = [...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id);
  expect(ran).toEqual(expect.arrayContaining(['button-name', 'color-contrast', 'html-has-lang', 'image-alt']));
  expect(results.passes.map((r) => r.id)).toEqual(expect.arrayContaining(['button-name', 'html-has-lang']));
});

test('include and exclude scope the scan', async ({ page: p }) => {
  await p.setContent(page('<div id="a"><button type="button"></button></div><div id="b"><button type="button">המשך</button></div>'));
  await expect(expectNoAxeViolations(p, { include: '#a' })).rejects.toThrow(/button-name/);
  await expectNoAxeViolations(p, { include: '#b' });
});

test('color-contrast cannot be turned off, and any other rule turned off needs a reason', async ({ page: p }) => {
  await p.setContent(page('<p>שלום</p>'));
  await expect(expectNoAxeViolations(p, { disableRules: { 'color-contrast': 'no' } })).rejects.toThrow(/may not be turned off/);
  await expect(expectNoAxeViolations(p, { disableRules: { region: '' } })).rejects.toThrow(/needs a reason/);
  await expect(expectNoAxeViolations(p, { disableRules: ['region'] })).rejects.toThrow(/reason/);
});
