// The sign-in form says what each code is for: the teacher's account has its own note, and a step-up says what it does
// on its button (deleting the account, or replacing a class's teacher key), with no note. Rendered to HTML on node.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmailCodeForm from './EmailCodeForm.jsx';

const html = (props) => renderToStaticMarkup(<EmailCodeForm {...props} />);

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
    expect(t).toContain('המייל משמש רק לכניסה ללוח המורה ולהודעות על הכיתות שלכם. הוא עובר לשירות שליחת המיילים (Resend). התלמידים לא רואים אותו.');
    expect(t).toContain('מחשב משותף (למשל בחדר המורים): לא לזכור את הכניסה אחרי שסוגרים את הלשונית');
    expect(t).toContain('type="checkbox"');
    expect(html({ purpose: 'teacherAccount' })).not.toContain('type="checkbox"');
  });
});
