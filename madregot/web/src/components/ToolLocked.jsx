// What a tool of the full tutor says before any camera or upload opens, when this device does not have it today:
// what it does, and what is open instead (the teacher, the worked solutions, the answer key). Calm and short: no
// price, no plan, no lock icon. The small "מידע להורים" link leads to the page meant for a parent.
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '@/lib/store.js';
import { Button } from './ui.jsx';
import Mascot from './Mascot.jsx';
import { lockedText } from './limitCopy.js';
import { openLimitSheet } from '@/lib/account.js';

export default function ToolLocked({ kind, state = 'locked', onTeacher, children, className, compact = false }) {
  const inClass = useApp((s) => !!s.profile?.token);
  const teacher = useApp((s) => s.profile?.role === 'teacher');
  const t = lockedText(kind, { state, inClass, role: teacher ? 'teacher' : 'student' });
  return (
    <section className={clsx('tool-locked', compact && 'is-compact', className)} role="status" aria-live="polite">
      {!compact && <Mascot mood="encouraging" size={72} />}
      <div className="tool-locked-text">{t.lines.map((l) => <p key={l}>{l}</p>)}</div>
      {t.teacher && onTeacher && <Button variant="secondary" className="btn-block" onClick={onTeacher}>לשלוח למורה</Button>}
      {/* a teacher whose class is not bound to an email yet signs in from the sheet (TRUST-9) */}
      {t.bind && <Button className="btn-block" onClick={() => openLimitSheet({ reason: 'parent_ok_needed' })}>כניסה עם מייל</Button>}
      {children}
      {t.parents && !teacher && <Link to="/parents/info" className="foot-link tool-locked-parents">מידע להורים</Link>}
    </section>
  );
}
