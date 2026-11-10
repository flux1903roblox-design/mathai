// The sheet that opens when the tutor says no for now: today's free questions are used, or the action is part of
// the subscription. It speaks to a student calmly (no countdown, no pressure): practice goes on without the tutor,
// the free questions come back tomorrow, and the details for a parent are one tap away.
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/store.js';
import { usePaywall, closePaywall, useAIStatus } from '@/lib/account.js';
import { Button, Sheet } from './ui.jsx';
import Mascot from './Mascot.jsx';

export default function Paywall() {
  const { open, reason } = usePaywall();
  const limit = useAIStatus((x) => x.status?.limit) || 2;
  const role = useApp((s) => s.profile?.role);
  const navigate = useNavigate();
  const teacher = role === 'teacher';
  const title = reason === 'paid_only' ? 'זה חלק מהמנוי' : 'השאלות החינמיות של היום נגמרו';
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closePaywall()} title={title}>
      <div className="exit-sheet paywall">
        <Mascot mood="encouraging" size={88} />
        <div className="lead confirm-text">
          {reason === 'paid_only'
            ? <p>בחינם העוזר מסביר טעויות ועונה בשיחה, עד {limit} שאלות ביום. בדיקת פתרון מצולם, בדיקת מבחן ותרגילים חדשים מהעוזר כלולים במנוי.</p>
            : <p>כל יום יש {limit} שאלות חינם לעוזר, ומחר הן מתחדשות. השיעורים, המפה והמשימות עובדים גם בלי העוזר.</p>}
          <p className="muted">{teacher ? 'רישיון כיתה פותח את העוזר לכל התלמידים בכיתה.' : 'מנוי משפחתי או רישיון של הכיתה פותחים את העוזר בלי ההגבלה הזו.'}</p>
        </div>
        <Button className="btn-block btn-lg" onClick={closePaywall}>להמשיך לתרגל</Button>
        <Button variant="ghost" className="btn-block" onClick={() => { closePaywall(); navigate('/subscription'); }}>
          {teacher ? 'על רישיון כיתה' : 'פרטים על המנוי, להורים'}
        </Button>
      </div>
    </Sheet>
  );
}
