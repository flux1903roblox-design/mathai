// The sheet that opens when the tutor says "not now": today's questions are used, it rests today, a shared ceiling is
// reached, or this month's checks are over. Mounted once in the app. It speaks to a child calmly (Madi encouraging,
// no red, no countdown, no price): Madi and practice are always open, and the questions come back tomorrow.
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/store.js';
import { useLimitSheet, closeLimitSheet } from '@/lib/account.js';
import { limitVariant } from './limitCopy.js';
import { Button, Sheet } from './ui.jsx';
import Mascot from './Mascot.jsx';

export default function LimitSheet() {
  const { open, reason, tier, scope, onMadi } = useLimitSheet();
  const role = useApp((s) => s.profile?.role);
  const navigate = useNavigate();
  const v = limitVariant({ reason, tier, scope, role });
  const go = (to, state) => { closeLimitSheet(); navigate(to, state ? { state } : undefined); };
  // "להמשיך לתרגל" closes the sheet where practice is (a lesson); elsewhere it goes to the map
  // (read at the tap, not subscribed: the sheet does not re-render on every navigation)
  const practice = () => {
    closeLimitSheet();
    const path = window.location.hash.replace(/^#/, '');
    if (!/^\/(lesson|practice|placement|learn|repair|rescue\/)/.test(path) && role !== 'teacher') navigate('/');
  };
  const madi = onMadi && v.actions.includes('madi');
  const buttons = v.actions.filter((a) => a !== 'madi' || madi);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeLimitSheet()} title={v.title}>
      <div className="exit-sheet limit-sheet">
        <Mascot mood="encouraging" size={88} />
        <div className="lead confirm-text">{v.text.map((t) => <p key={t}>{t}</p>)}</div>
        {buttons.map((a, i) => {
          const variant = i === 0 ? 'primary' : 'secondary';
          const cls = i === 0 ? 'btn-block btn-lg' : 'btn-block';
          if (a === 'madi') return <Button key={a} variant={variant} className={cls} onClick={() => { const fn = onMadi; closeLimitSheet(); fn?.(); }}>לשאול את מדי</Button>;
          if (a === 'licence') return <Button key={a} variant={variant} className={cls} onClick={() => go('/teacher', { focus: 'licence' })}>על רישיון כיתה</Button>;
          return <Button key={a} variant={variant} className={cls} onClick={practice}>להמשיך לתרגל</Button>;
        })}
        {v.parents && role !== 'teacher' && <button type="button" className="link-btn limit-parents" onClick={() => go('/parents/info')}>מידע להורים</button>}
      </div>
    </Sheet>
  );
}
