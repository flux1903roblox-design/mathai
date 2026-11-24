// One quiet line about today's questions to the tutor: under "למה טעיתי?", under the tutor's button in Madi's sheet,
// and above the chat's input. Muted, a status, no link: it informs a child, it does not push. Says nothing when there
// is nothing worth saying (a plan with plenty left, a personal key, no tutor).
import clsx from 'clsx';
import { useAIStatus, aiAccess } from '@/lib/account.js';
import { useApp } from '@/lib/store.js';
import { allowanceText } from './limitCopy.js';

export default function AIAllowance({ className, kind = 'explain' }) {
  const status = useAIStatus((x) => x.status);
  const ended = useAIStatus((x) => x.ended);
  useApp((x) => x.ai.mode);
  const role = useApp((x) => x.profile?.role);
  const a = aiAccess(kind, status);
  if (a.state === 'offline' || a.tier === 'personal' || !status) return null;
  const text = allowanceText({ state: a.state, left: a.left, tier: status.tier, ended, role });
  if (!text) return null;
  return <p className={clsx('ai-left', className)} role="status">{text}</p>;
}
