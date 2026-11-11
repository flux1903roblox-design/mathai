// The sign-in form says what each code is for: the teacher's account has its own note, and a step-up says what it does
// on its button (deleting the account, or replacing a class's teacher key), with no note. Rendered to HTML on node.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import EmailCodeForm from './EmailCodeForm.jsx';

// the note ends with a link to the privacy notice (trust spec TRUST-1 §5), so the form renders inside a router
const html = (props) => renderToStaticMarkup(<MemoryRouter><EmailCodeForm {...props} /></MemoryRouter>);

describe('EmailCodeForm', () => {
  it('purpose rekey: the code step\'s button says "אישור והחלפת המפתח", and there is no note', () => {
    const code = html({ purpose: 'rekey', startStep: 'code', presetEmail: 'teacher@example.test' });
    expect(code).toContain('אישור והחלפת המפתח');
    expect(code).not.toContain('אישור ומחיקה');
    const email = html({ purpose: 'rekey' });
    expect(email).not.toContain('class="footnote"');
  });

  it('purpose stepup still says "אישור ומחיקה"; a plain sign-in says "כניסה"', () => {
    expect(html({ purpose: 'stepup', startStep: 'code' })).toContain('אישור ומחיקה');
    expect(html({ purpose: 'join', startStep: 'code' })).toContain('>כניסה<');
  });

  it('purpose teacherAccount: the note says what the email is for, and askShared offers the shared-computer box', () => {
    const t = html({ purpose: 'teacherAccount', askShared: true });
    expect(t).toContain('המייל משמש רק לכניסה ללוח המורה ולהודעות על הכיתות שלכם. הוא עובר לשירות שליחת המיילים Resend (בארה״ב). התלמידים לא רואים אותו.');
    expect(t).toContain('מחשב משותף (למשל בחדר המורים): לא לזכור את הכניסה אחרי שסוגרים את הלשונית');
    expect(t).toContain('type="checkbox"');
    expect(t).toContain('מדיניות הפרטיות');
    expect(html({ purpose: 'teacherAccount' })).not.toContain('מחשב משותף');
  });

  it('a teacher\'s sign-in asks "over 18, a teacher or a tutor", unticked (COUNCIL2-5); a parent\'s and a step-up do not', () => {
    for (const purpose of ['teacherAccount', 'bind', 'teacher']) {
      const t = html({ purpose });
      expect(t, purpose).toContain('אני מעל גיל 18, ואני מורה או נותן/ת שיעורים פרטיים');
      expect(t, purpose).toContain('בלי הסימון הזה אפשר לנהל את הכיתה, אבל העוזר החכם לא ייפתח.');
      expect(t, purpose).not.toMatch(/type="checkbox"[^>]*checked/);
    }
    for (const purpose of ['join', 'cancel', 'buy', 'stepup', 'rekey']) expect(html({ purpose }), purpose).not.toContain('אני מעל גיל 18');
    expect(html({ purpose: 'teacherAccount', lockedEmail: 'teacher@example.test' })).not.toContain('אני מעל גיל 18');
  });
});
