// The words a server error is shown with (api.js): the legal gate's refusal at checkout (trust spec TRUST-2 §6), and the
// one code the server uses for two things, class_has_licence, told apart by the request it answers (TRUST-7 §4, E.6).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}
const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
let next;

async function load() {
  vi.resetModules();
  const { useApp } = await import('./store.js');
  useApp.setState({ ai: { ...useApp.getState().ai, apiUrl: 'https://api.example.test' } });
  return import('./api.js');
}

beforeEach(() => {
  const local = fakeStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', fakeStorage());
  vi.stubGlobal('window', { localStorage: local, location: { origin: 'https://madregot.example.test' } });
  vi.stubGlobal('fetch', vi.fn(async () => next()));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('server errors in words', () => {
  it('checkout before the legal sign-off says the online sign-up is not open yet', async () => {
    const { api, errorText } = await load();
    next = () => reply(503, { error: 'legal_not_ready' });
    await expect(api('/api/billing/checkout', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'legal_not_ready', status: 503, message: 'ההצטרפות באתר עוד לא פתוחה. כתבו לנו ונפעיל את המנוי לחשבון.',
    });
    expect(errorText('legal_not_ready')).not.toMatch(/משהו השתבש/);
  });

  it('a class whose licence still runs: deleting it says when it can be deleted; a school code says the class has a licence', async () => {
    const { api, routeErrorText } = await load();
    next = () => reply(409, { error: 'class_has_licence' });
    await expect(api('/api/teacher/class/delete', { method: 'POST', body: { confirm: 'DELETE' } })).rejects.toMatchObject({
      code: 'class_has_licence', status: 409, message: 'לכיתה יש רישיון פעיל. אפשר למחוק אותה אחרי שהרישיון מסתיים, או לכתוב לנו.',
    });
    await expect(api('/api/teacher/licence/claim', { method: 'POST', body: { code: 'x' } })).rejects.toMatchObject({ message: 'לכיתה הזו כבר יש רישיון פעיל.' });
    next = () => reply(400, { error: 'confirm_required' });
    await expect(api('/api/teacher/class/delete', { method: 'POST', body: {} })).rejects.toMatchObject({ message: 'צריך לאשר את המחיקה.' });
    expect(routeErrorText('class_has_licence', '/api/teacher/class/delete?x=1')).toMatch(/אחרי שהרישיון מסתיים/);
  });
});
