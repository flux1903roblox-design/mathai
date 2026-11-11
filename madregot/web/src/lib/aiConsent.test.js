// The store builds (STUDENT-12): the permission sheet comes before the first AI request (Apple 5.1.2(i)), "לא עכשיו"
// sends nothing, and the iPhone build never sends the family-device token (Apple 3.1.3(b)/(c)). The web build is as before.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { aiHeaders, familyInApp, useAIStatus, closeLimitSheet } from './account.js';
import { needsConsent, askConsent, answerConsent, useConsent, storeBuild } from './aiConsent.js';
import { runAI } from './ai.js';
import { CONSENT_TITLE, CONSENT_TEXT } from '../components/AIConsentSheet.jsx';
import { STORE_PARENTS_TEXT } from '../screens/parents/StoreParents.jsx';

const FAMILY = { token: `fd1.${'f'.repeat(64)}`, label: 'הטאבלט' };
const ok = () => new Response(JSON.stringify({ text: 'הסבר' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  useApp.getState().setAI({ mode: 'server', apiUrl: 'https://api.example.test', key: '', familyDevice: FAMILY, pendingLink: null, consentAt: '' });
  useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
  useAIStatus.setState({ status: null, ended: false });
  closeLimitSheet();
});
afterEach(() => { if (useConsent.getState().open) answerConsent(false); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('the web build', () => {
  it('asks nothing and keeps the family link', async () => {
    expect(storeBuild()).toBe(false);
    expect(needsConsent()).toBe(false);
    expect(familyInApp()).toBe(true);
    expect(aiHeaders()['X-Family-Device']).toBe(FAMILY.token);
    const fetch = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetch);
    await runAI('explain', { question: '1+1' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useConsent.getState().open).toBe(false);
  });
});

describe('the iPhone store build (VITE_STORE=ios)', () => {
  beforeEach(() => { vi.stubEnv('VITE_STORE', 'ios'); });

  it('never sends the family-device token, unless VITE_STORE_FAMILY=1', () => {
    expect(familyInApp()).toBe(false);
    expect(Object.keys(aiHeaders())).toEqual(['X-Device']);
    vi.stubEnv('VITE_STORE_FAMILY', '1');
    expect(familyInApp()).toBe(true);
    expect(aiHeaders()['X-Family-Device']).toBe(FAMILY.token);
  });

  it('"לא עכשיו" sends nothing and keeps nothing; the screen goes quietly back', async () => {
    const fetch = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetch);
    expect(needsConsent()).toBe(true);
    const asked = runAI('explain', { question: '1+1' });
    await vi.waitFor(() => expect(useConsent.getState().open).toBe(true));
    // a second request while the sheet is open waits on the same answer: one sheet
    const second = runAI('chat', { messages: [] });
    answerConsent(false);
    await expect(asked).rejects.toMatchObject({ code: 'no_consent', limit: true });
    await expect(second).rejects.toMatchObject({ code: 'no_consent' });
    expect(fetch).not.toHaveBeenCalled();
    expect(useApp.getState().ai.consentAt).toBe('');
    expect(useConsent.getState().open).toBe(false);
  });

  it('"כן, להמשיך" keeps the time, the request goes without the family token, and the sheet is not asked again', async () => {
    const sent = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => { sent.push({ url, headers: init.headers }); return ok(); }));
    const asked = runAI('explain', { question: '1+1' });
    await vi.waitFor(() => expect(useConsent.getState().open).toBe(true));
    expect(sent).toHaveLength(0);
    answerConsent(true);
    await expect(asked).resolves.toMatchObject({ text: 'הסבר' });
    expect(sent).toHaveLength(1);
    expect(sent[0].headers['X-Family-Device']).toBeUndefined();
    expect(Date.parse(useApp.getState().ai.consentAt)).not.toBeNaN();
    expect(needsConsent()).toBe(false);
    await expect(askConsent()).resolves.toBe(true);
    await runAI('explain', { question: '2+2' });
    expect(sent).toHaveLength(2);
    expect(useConsent.getState().open).toBe(false);
  });
});

describe('the store words', () => {
  it('say who the helper is, what goes where, and what is never sent or kept; no price, plan or website', () => {
    expect(CONSENT_TITLE).toBe('לפני שמדברים עם העוזר החכם');
    expect(CONSENT_TEXT).toBe('העוזר החכם הוא Claude של חברת Anthropic, תוכנה ולא אדם. כדי לענות, נשלחים ל־Anthropic בארה״ב התרגיל שעל המסך, מה שכתבתם, ותמונה אם צילמתם. לא נשלחים שם, מייל או טלפון, ומדרגות לא שומרת את השיחות.');
    expect(STORE_PARENTS_TEXT).toBe('כדי לשאול את העוזר החכם, אחד ההורים צריך לאשר את זה פעם אחת. זה בחינם ולוקח דקה. סורקים את הקוד בטלפון של ההורה, או שולחים את הקישור.');
    for (const t of [CONSENT_TEXT, STORE_PARENTS_TEXT]) expect(t).not.toMatch(/₪|מנוי|באתר|תוכנית|לקנות/);
  });
});
