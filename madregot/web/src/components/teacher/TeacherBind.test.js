// A teacher whose class has no adult behind it (trust spec TRUST-9, the trust review): the sheet signs the teacher in
// with an email and binds the class to it, once. Rendered on the server, as CheckResult.test.js does.
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { useApp } from '@/lib/store.js';
import { useParent } from '@/lib/parent.js';
import TeacherBind, { BIND_COPY } from './TeacherBind.jsx';

const render = () => renderToStaticMarkup(h(MemoryRouter, null, h(TeacherBind)));

const teacher = { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7' }], active: 'K7Q2MD' };

describe('TeacherBind', () => {
  beforeEach(() => { useApp.setState({ profile: teacher }); useParent.setState({ session: null }); });

  it('signed out: what the email is for, and the email form with its notice', () => {
    const out = render();
    expect(out).toContain(BIND_COPY.intro);
    expect(out).toContain('המייל משמש לכניסה ולקישור הכיתה אליכם.');
    expect(out).toContain('type="email"');
    expect(out).not.toContain(BIND_COPY.bind);
  });

  it('its words: one action, calm, no price and no parent anywhere', () => {
    // (a server render reads a store's first state, so the signed-in button is checked by its words here)
    const words = [BIND_COPY.intro, BIND_COPY.bind, BIND_COPY.busy, BIND_COPY.done('teacher@example.test'), BIND_COPY.other, BIND_COPY.failed].join(' ');
    for (const w of ['₪', 'מחיר', 'הורה', 'רישיון']) expect(words).not.toContain(w);
    expect(BIND_COPY.done('teacher@example.test')).toBe('הכיתה מקושרת עכשיו ל־teacher@example.test. העוזר החכם פתוח לכם.');
  });

  it('a device that is not a teacher\'s shows nothing', () => {
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7' } });
    expect(render()).toBe('');
  });
});
