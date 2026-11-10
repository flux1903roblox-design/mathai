// Small helpers the teacher's board and its tabs share.
import { toast } from 'sonner';
import { TriangleAlert, CircleCheck, CircleAlert } from 'lucide-react';

export const fmtDay = (iso) => {
  if (!iso) return 'אף פעם';
  const d = new Date(iso); const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return 'היום'; if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
};
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

// A student asked the teacher to talk (trust spec TRUST-3 §3.5): a help request with kind 'talk' and no exercise.
export const TALK = 'ביקש/ה לדבר איתך';

export function copy(text, label) {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} הועתק`), () => toast(`${label}: ${text}`));
}

export function Rate({ value }) {
  if (value == null) return <span className="muted">אין עדיין</span>;
  const tone = value < 60 ? 'low' : value < 80 ? 'mid' : 'high';
  const Icon = tone === 'low' ? TriangleAlert : tone === 'mid' ? CircleAlert : CircleCheck;
  return <span className={`rate ${tone}`}><Icon size={15} aria-hidden="true" />{value}%</span>;
}
