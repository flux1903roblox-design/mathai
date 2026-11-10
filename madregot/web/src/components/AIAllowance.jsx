// One quiet line under the tutor's button on the free taste: how many free questions are left today, and where the
// subscription is explained. Says nothing on a subscription, a class licence or a personal key.
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useAIStatus } from '@/lib/account.js';
import { aiMode } from '@/lib/ai.js';

export function leftText(left) {
  if (left <= 0) return 'השאלות החינמיות של היום נגמרו. מחר יש עוד.';
  if (left === 1) return 'נשארה היום שאלה חינם אחת.';
  return `נשארו היום ${left} שאלות חינם.`;
}

export default function AIAllowance({ className }) {
  const status = useAIStatus((x) => x.status);
  if (aiMode() !== 'server' || status?.tier !== 'free' || !Number.isFinite(status.left)) return null;
  return (
    <p className={clsx('ai-left', className)} role="status">
      {leftText(status.left)} <Link to="/subscription" className="ai-left-link">מה יש במנוי</Link>
    </p>
  );
}
