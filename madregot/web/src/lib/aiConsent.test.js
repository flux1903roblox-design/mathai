// The store builds (STUDENT-12): the permission sheet comes before the first AI request (Apple 5.1.2(i)), "לא עכשיו"
// sends nothing, and the iPhone build never sends the family-device token (Apple 3.1.3(b)/(c)). The web build is as before.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { aiHeaders, familyInApp, classAiInApp, aiAccess, autoAskAllowed, refreshStatus, useAIStatus, closeLimitSheet } from './account.js';
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

describe('VITE_STORE_CLASS_AI=0, the owner\'s rebuild if App Review objects to class licences (3.1.3(c), FOLLOWUP-44)', () => {
  const ALL = ['explain', 'chat', 'generate', 'check', 'exam'];
  const CLASS = (tier = 'class') => ({ paywall: true, tier, kinds: ALL, groups: { tutor: { left: 20, limit: 20 }, check: { left: 3, limit: 3 }, generate: { left: 3, limit: 3 }, exam: { left: 1, limit: 1 } }, economy: false, shared: null });
  const FREE = { paywall: true, tier: 'free', kinds: ['explain', 'chat'], groups: { tutor: { left: 2, limit: 2 }, check: null, generate: null, exam: null }, economy: false, shared: null };
  beforeEach(() => {
    useApp.getState().setAI({ familyDevice: null, consentAt: '2026-11-05T10:00:00.000Z' });
    useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' });
  });

  it('default on: the web, and the iPhone build without it (or with 1), send no X-Class-AI and read a class licence as it is', () => {
    expect(classAiInApp()).toBe(true);
    vi.stubEnv('VITE_STORE_CLASS_AI', '0'); // outside the iPhone build it changes nothing
    expect(classAiInApp()).toBe(true);
    vi.stubEnv('VITE_STORE', 'ios');
    vi.stubEnv('VITE_STORE_CLASS_AI', '');
    expect(classAiInApp()).toBe(true);
    vi.stubEnv('VITE_STORE_CLASS_AI', '1');
    expect(classAiInApp()).toBe(true);
    expect(aiHeaders()['X-Class-AI']).toBeUndefined();
    expect(aiAccess('check', CLASS()).state).toBe('open');
  });

  it('0 in the iPhone build: the calls and the status say X-Class-AI: off, and the student has the free taste only', async () => {
    vi.stubEnv('VITE_STORE', 'ios');
    vi.stubEnv('VITE_STORE_CLASS_AI', '0');
    expect(classAiInApp()).toBe(false);
    expect(aiHeaders()).toEqual({ 'X-Device': expect.stringMatching(/^[a-f0-9]{32}$/), 'X-Class-AI': 'off' });
    // the status is asked with it, and the Worker answers the free taste (worker/test/paid.test.js)
    const sent = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      sent.push({ url: String(url), headers: init?.headers || {} });
      const body = String(url).endsWith('/api/ai/status') ? FREE : { text: 'הסבר' };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'X-AI-Tier': 'free', 'X-AI-Group': 'tutor', 'X-AI-Left': '1' } });
    }));
    await refreshStatus();
    expect(sent[0].url).toBe('https://api.example.test/api/ai/status');
    expect(sent[0].headers['X-Class-AI']).toBe('off');
    expect(aiAccess('explain')).toMatchObject({ state: 'free', left: 2 });
    for (const k of ['check', 'generate', 'exam']) expect(aiAccess(k).state).toBe('locked');
    // a question goes with the class token (the Worker still knows the class: its rules and its shared ceiling) and the header
    await runAI('explain', { question: '1+1' });
    const call = sent.find((r) => r.url.endsWith('/api/ai/explain'));
    expect(call.headers).toMatchObject({ Authorization: 'Bearer stu_token_1', 'X-Class-AI': 'off' });
    // even a status that still names a class licence offers no class-only tool, and nothing is asked by itself
    for (const tier of ['class', 'teacher', 'trial', 'legacy']) {
      expect(aiAccess('explain', CLASS(tier))).toMatchObject({ state: 'free', tier: 'free', left: 20 });
      expect(aiAccess('check', CLASS(tier)).state).toBe('locked');
    }
    useAIStatus.setState({ status: CLASS() });
    expect(autoAskAllowed()).toBe(false);
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
