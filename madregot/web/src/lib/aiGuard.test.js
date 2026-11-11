// The personal-key path (the owner's own dev build, VITE_ALLOW_PERSONAL_KEY=1) guards the final answer exactly as the
// Worker does (ai spec AI-3 Design 3): a streamed chat is masked as it arrives, explain and chat end with MASK_NOTE when
// something was masked, and a check under WITHHOLD is withheld. The SDK is stubbed; no request leaves the test.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MASK_NOTE } from '@shared/guard.js';

const fake = vi.hoisted(() => ({ text: '', pieces: [], json: null }));
vi.mock('@anthropic-ai/sdk', () => {
  const message = (text) => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'm', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
  class Anthropic {
    constructor() {
      this.beta = { messages: {
        create: async () => message(fake.json ? JSON.stringify(fake.json) : fake.text),
        stream: () => {
          const on = {};
          return {
            on(ev, cb) { on[ev] = cb; return this; },
            async finalMessage() { for (const p of fake.pieces) on.text?.(p); return message(fake.pieces.join('')); },
          };
        },
      } };
    }
  }
  return { default: Anthropic };
});

let runAI;
beforeAll(async () => {
  vi.stubEnv('VITE_ALLOW_PERSONAL_KEY', '1');
  const { useApp } = await import('./store.js');
  ({ runAI } = await import('./ai.js'));
  useApp.getState().setAI({ mode: 'personal', apiUrl: '', key: 'sk-test-not-real', familyDevice: null, pendingLink: null });
  useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
});

const ctx = (policy = 'withhold') => ({
  v: 2, surface: 'lesson', grade: '7', skill: 'signed:1', topicId: 'signed',
  item: { text: 'חשבו: -4 + 6', form: 'num', answer: '2', answerFrom: 'app', solution: [] },
  tries: { answers: [], phase: 'answer', hinted: false },
  policy: { answer: policy, why: '' },
});

describe('the personal-key path guards the final answer like the Worker', () => {
  it('a streamed chat under WITHHOLD never shows the answer, and ends with MASK_NOTE', async () => {
    fake.pieces = ['מתחילים ב־$-4$. ולכן $-4 + 6 = ', '2$. נסו ', 'בעצמכם.'];
    const shown = [];
    const r = await runAI('chat', { ctx: ctx(), messages: [{ role: 'user', content: 'איך?' }] }, { onText: (t) => shown.push(t) });
    for (const t of shown) expect(t).not.toMatch(/=\s*2/);
    expect(r).toEqual({ text: `מתחילים ב־$-4$. ולכן $-4 + 6 = ?$. נסו בעצמכם.\n\n${MASK_NOTE}`, care: false });
  });
  it('under REVEAL the same reply is unchanged', async () => {
    fake.pieces = ['ולכן $-4 + 6 = ', '2$.'];
    const r = await runAI('chat', { ctx: ctx('reveal'), messages: [{ role: 'user', content: 'איך?' }] }, { onText: () => {} });
    expect(r.text).toBe('ולכן $-4 + 6 = 2$.');
  });
  it('explain is masked with the note; a check is withheld', async () => {
    fake.json = null; fake.text = 'הדרך: $-4 + 6 = 2$.';
    expect((await runAI('explain', { ctx: ctx() })).text).toBe(`הדרך: $-4 + 6 = ?$.\n\n${MASK_NOTE}`);
    fake.json = { readable: true, care: false, transcript: '', steps: [{ text: '$-4+6=2$', ok: true, comment: 'נכון, 2.' }], final: 'correct', summary: 'יוצא $2$.' };
    const c = await runAI('check', { ctx: { ...ctx(), surface: 'notebook' }, image: 'data:image/png;base64,iVBORw0KGgo=', mediaType: 'image/png' });
    expect(c).toMatchObject({ final: 'unknown', withheld: true, summary: 'יוצא $?$.', care: false });
    expect(c.steps[0]).toMatchObject({ ok: null, comment: '' });
    fake.json = null;
  });
});
