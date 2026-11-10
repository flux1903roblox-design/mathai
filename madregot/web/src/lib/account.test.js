import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { aiAccess, autoAskAllowed, aiHeaders, useAIStatus, gate, useLimitSheet, closeLimitSheet, hasTool, noteLimit, refreshIfNewDay } from './account.js';
import { runAI } from './ai.js';

const groups = (tutor, rest = null) => ({ tutor, check: rest, generate: rest, exam: rest });
const FREE = (left = 2, extra = {}) => ({ paywall: true, tier: 'free', kinds: ['explain', 'chat'], groups: groups({ left, limit: 2 }), economy: false, shared: null, ...extra });
const ALL = ['explain', 'chat', 'generate', 'check', 'exam'];
const PAID = (tier, extra = {}) => ({ paywall: true, tier, kinds: ALL, groups: { tutor: { left: 27, limit: 30 }, check: { left: 6, limit: 6 }, generate: { left: 5, limit: 5 }, exam: { left: 2, limit: 2, monthLeft: 9 } }, economy: false, shared: null, ...extra });
const OPEN = { paywall: false, tier: 'open', kinds: ALL, groups: { all: { left: 37, limit: 40 } }, aiReady: true };

beforeEach(() => {
  useApp.getState().setAI({ mode: 'server', apiUrl: 'https://api.example.test', key: '', familyDevice: null, pendingLink: null });
  useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
  useAIStatus.setState({ status: null, ended: false });
  closeLimitSheet();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('aiAccess: what each tutor action can do now', () => {
  it('offline without a server or a personal key', () => {
    useApp.getState().setAI({ apiUrl: 'none' });
    expect(aiAccess('explain', FREE()).state).toBe('offline');
  });
  it('an unknown status never blocks: open', () => {
    expect(aiAccess('check', null)).toMatchObject({ state: 'open' });
    expect(aiAccess('explain', {})).toMatchObject({ state: 'open' });
  });
  it('the free taste: free with what is left, then used', () => {
    expect(aiAccess('explain', FREE(2))).toMatchObject({ state: 'free', left: 2, tier: 'free' });
    expect(aiAccess('chat', FREE(1))).toMatchObject({ state: 'free', left: 1 });
    expect(aiAccess('chat', FREE(0))).toMatchObject({ state: 'used', left: 0 });
  });
  it('the free taste does not include the photo check, new exercises or the exam check: locked', () => {
    for (const k of ['check', 'generate', 'exam']) expect(aiAccess(k, FREE(2)).state).toBe('locked');
  });
  it('paused when the free tutor rests today, resting when a shared ceiling is reached', () => {
    expect(aiAccess('explain', FREE(2, { shared: 'paused' })).state).toBe('paused');
    expect(aiAccess('explain', FREE(2, { shared: 'network' }))).toMatchObject({ state: 'resting', scope: 'network' });
    expect(aiAccess('chat', FREE(2, { shared: 'class' }))).toMatchObject({ state: 'resting', scope: 'class' });
  });
  it('paid tiers are open per group, used when that group is spent', () => {
    for (const tier of ['family', 'class', 'teacher', 'trial', 'legacy']) expect(aiAccess('check', PAID(tier)).state).toBe('open');
    const spent = PAID('family', { groups: { ...PAID('family').groups, check: { left: 0, limit: 6 } } });
    expect(aiAccess('check', spent).state).toBe('used');
    expect(aiAccess('explain', spent).state).toBe('open');
    const month = PAID('family', { groups: { ...PAID('family').groups, exam: { left: 2, limit: 2, monthLeft: 0 } } });
    expect(aiAccess('exam', month).state).toBe('used');
  });
  it('a trial has no new exercises or exam check: locked', () => {
    const trial = PAID('trial', { kinds: ['explain', 'chat', 'check'], groups: { tutor: { left: 10, limit: 10 }, check: { left: 2, limit: 2 }, generate: null, exam: null } });
    expect(aiAccess('generate', trial).state).toBe('locked');
    expect(aiAccess('check', trial).state).toBe('open');
  });
  it('economy: checks rest until the 1st, the chat goes on', () => {
    const eco = PAID('family', { kinds: ['explain', 'chat'], economy: true, groups: groups({ left: 20, limit: 30 }) });
    expect(aiAccess('check', eco).state).toBe('economy');
    expect(aiAccess('exam', eco).state).toBe('economy');
    expect(aiAccess('chat', eco).state).toBe('open');
  });
  it('the switch off: open, used at the old daily limit', () => {
    expect(aiAccess('exam', OPEN)).toMatchObject({ state: 'open', left: 37, tier: 'open' });
    expect(aiAccess('chat', { ...OPEN, groups: { all: { left: 0, limit: 40 } } }).state).toBe('used');
  });
  it('hasTool: a spent group is still the device\'s tool; locked and economy are not', () => {
    expect(hasTool('exam', FREE())).toBe(false);
    expect(hasTool('exam', PAID('family'))).toBe(true);
    expect(hasTool('exam', PAID('family', { groups: { ...PAID('family').groups, exam: { left: 0, limit: 2 } } }))).toBe(true);
  });
});

describe('autoAskAllowed: the tutor asks by itself only where the question is not one of the few free ones', () => {
  it('never on the free taste or with an unknown status', () => {
    useAIStatus.setState({ status: FREE() }); expect(autoAskAllowed()).toBe(false);
    useAIStatus.setState({ status: null }); expect(autoAskAllowed()).toBe(false);
  });
  it('on every paid tier and with the switch off', () => {
    for (const tier of ['family', 'class', 'teacher', 'trial', 'legacy']) { useAIStatus.setState({ status: PAID(tier) }); expect(autoAskAllowed()).toBe(true); }
    useAIStatus.setState({ status: OPEN }); expect(autoAskAllowed()).toBe(true);
  });
  it('with a personal key, in a build that has one', async () => {
    vi.stubEnv('VITE_ALLOW_PERSONAL_KEY', '1');
    vi.resetModules();
    const store = await import('./store.js');
    const acc = await import('./account.js');
    store.useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
    store.useApp.getState().setAI({ mode: 'personal', key: 'k-test' });
    expect(acc.aiMode()).toBe('personal');
    expect(acc.autoAskAllowed()).toBe(true);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe('gate: a tool says why before anything is sent', () => {
  it('returns locked or economy for the tool\'s own info state, and opens nothing', () => {
    useAIStatus.setState({ status: FREE() });
    expect(gate('check')).toBe('locked');
    expect(useLimitSheet.getState().open).toBe(false);
  });
  it('a spent tutor opens the calm sheet', () => {
    useAIStatus.setState({ status: FREE(0) });
    expect(gate('chat')).toBe('used');
    expect(useLimitSheet.getState()).toMatchObject({ open: true, reason: 'daily_limit', tier: 'free' });
  });
  it('lets an open tool through', () => {
    useAIStatus.setState({ status: PAID('class') });
    expect(gate('check')).toBeNull();
  });
});

describe('AI calls carry the device and its family link, never the parent session', () => {
  it('aiHeaders: X-Device and X-Family-Device only', () => {
    useApp.getState().setAI({ familyDevice: { token: `fd1.${'c'.repeat(64)}`, label: 'הטאבלט' } });
    const h = aiHeaders();
    expect(h['X-Device']).toMatch(/^[a-f0-9]{32}$/);
    expect(h['X-Family-Device']).toBe(`fd1.${'c'.repeat(64)}`);
    expect(Object.keys(h).sort()).toEqual(['X-Device', 'X-Family-Device']);
  });
  it('a real call sends no X-Account-Token, and a limit opens the calm sheet instead of failing loudly', async () => {
    useApp.getState().setAI({ familyDevice: { token: `fd1.${'d'.repeat(64)}`, label: '' } });
    useAIStatus.setState({ status: PAID('family') });
    const sent = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      sent.push({ url, headers: init.headers });
      return new Response(JSON.stringify({ error: 'daily_limit', tier: 'family', group: 'tutor', limit: 30, left: 0 }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }));
    const onMadi = vi.fn();
    await expect(runAI('explain', { question: '1+1' }, { onMadi })).rejects.toMatchObject({ code: 'daily_limit', limit: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.example.test/api/ai/explain');
    expect(Object.keys(sent[0].headers).map((k) => k.toLowerCase())).not.toContain('x-account-token');
    expect(sent[0].headers['X-Family-Device']).toBe(`fd1.${'d'.repeat(64)}`);
    expect(useLimitSheet.getState()).toMatchObject({ open: true, reason: 'daily_limit', tier: 'family', onMadi });
    expect(aiAccess('explain').state).toBe('used');
  });
  it('X-AI-Linked: 0 forgets a family link the server no longer knows', async () => {
    useApp.getState().setAI({ familyDevice: { token: `fd1.${'e'.repeat(64)}`, label: '' } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'הסבר' }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-AI-Tier': 'free', 'X-AI-Group': 'tutor', 'X-AI-Left': '1', 'X-AI-Linked': '0' } })));
    useAIStatus.setState({ status: FREE(2) });
    const r = await runAI('explain', { question: '1+1' });
    expect(r.text).toBe('הסבר');
    expect(useApp.getState().ai.familyDevice).toBeNull();
    expect(aiAccess('explain')).toMatchObject({ state: 'free', left: 1 });
  });
});

describe('a tab that stays open across midnight', () => {
  it('a refused call keeps its resetsAt, so the status is asked again once the day changes (also with the switch off)', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    useAIStatus.setState({ status: { ...OPEN, groups: { all: { left: 1, limit: 40 } } } }); // no resetsAt yet
    noteLimit({ error: 'daily_limit', tier: 'open', group: 'all', limit: 40, left: 0, resetsAt: past }, 'explain');
    expect(aiAccess('explain').state).toBe('used');
    expect(useAIStatus.getState().status.resetsAt).toBe(past);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ...OPEN, resetsAt: new Date(Date.now() + 864e5).toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    refreshIfNewDay();
    await vi.waitFor(() => expect(aiAccess('explain').state).toBe('open'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('the class\'s AI is off (TRUST-11): every action says so, nothing is offered, the calm sheet opens', () => {
  const OFF = { paywall: true, tier: 'class_off', classAi: 'off', kinds: [], groups: { tutor: null, check: null, generate: null, exam: null }, aiReady: true };
  it('aiAccess and hasTool', () => {
    for (const kind of ALL) {
      expect(aiAccess(kind, OFF)).toMatchObject({ state: 'class_off' });
      expect(hasTool(kind, OFF)).toBe(false);
    }
  });
  it('gate opens the sheet with its own reason', () => {
    useAIStatus.setState({ status: OFF });
    expect(gate('chat')).toBe('class_off');
    expect(useLimitSheet.getState()).toMatchObject({ open: true, reason: 'class_ai_off' });
  });
  it('a refused call (403 class_ai_off) marks the status off at once, even with no status yet; runAI opens the sheet', async () => {
    noteLimit({ error: 'class_ai_off' }, 'explain');
    expect(useAIStatus.getState().status).toMatchObject({ tier: 'class_off', classAi: 'off', kinds: [] });
    useAIStatus.setState({ status: null });
    useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7', token: 'stok' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'class_ai_off', message: 'class_ai_off' }), { status: 403, headers: { 'Content-Type': 'application/json' } })));
    const e = await runAI('explain', { question: '3 - 8' }).catch((x) => x);
    expect(e.limit).toBe(true);
    expect(e.code).toBe('class_ai_off');
    expect(e.message).toBe('בכיתה הזו העוזר החכם כבוי.');
    expect(useLimitSheet.getState()).toMatchObject({ open: true, reason: 'class_ai_off' });
    expect(aiAccess('chat').state).toBe('class_off');
  });
});
