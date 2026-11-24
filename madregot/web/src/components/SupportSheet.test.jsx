// The quiet link "צריכים לדבר עם מישהו?" (trust spec TRUST-3 §3.5) is a child's: a student's screens show it, a
// teacher's own screens never do (FOLLOWUP-1: the teacher's assistant and the sign-in sheet of the limit sheet).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SUPPORT_LINK } from '@/content/support.js';
import { SupportLink, supportLinkShown } from './SupportSheet.jsx';

describe('SupportLink', () => {
  it('a student, a class student and a device with no profile yet see it; a teacher does not', () => {
    for (const profile of [null, { role: 'student', name: 'נועה', grade: '7' }, { role: 'student', name: 'דנה', grade: '7', classCode: 'K7Q2MD', token: 'stok-a1' }]) {
      expect(supportLinkShown({ profile }), JSON.stringify(profile)).toBe(true);
    }
    expect(supportLinkShown({ profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'tkey-123' }], active: 'K7Q2MD' } })).toBe(false);
  });

  it('is a button that opens the support sheet', () => {
    // rendered on the server, the store is as on a new device (no profile)
    const out = renderToStaticMarkup(<SupportLink className="chat-support-link" />);
    expect(out).toBe(`<button type="button" class="link-btn support-open chat-support-link" aria-haspopup="dialog">${SUPPORT_LINK}</button>`);
  });
});
