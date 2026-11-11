// Small helpers the teacher's board and its tabs share.
import { toast } from 'sonner';
import { TriangleAlert, CircleCheck, CircleAlert } from 'lucide-react';
import { MathText } from '@/components/MathText.jsx';
import { mistakeText, stairName } from '@/lib/teacherText.js';

export const fmtDay = (iso) => {
  if (!iso) return 'אף פעם';
  const d = new Date(iso); const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return 'היום'; if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
};
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

export function copy(text, label) {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} הועתק`), () => toast(`${label}: ${text}`));
}

export function Rate({ value }) {
  if (value == null) return <span className="muted">אין עדיין</span>;
  const tone = value < 60 ? 'low' : value < 80 ? 'mid' : 'high';
  const Icon = tone === 'low' ? TriangleAlert : tone === 'mid' ? CircleAlert : CircleCheck;
  return <span className={`rate ${tone}`}><Icon size={15} aria-hidden="true" />{value}%</span>;
}

/**
 * A student's name that opens their page (TEACHER-8): a link-style button wherever the board names a student. With no
 * id (a student no longer in the class) or no `onOpen`, the name stays plain text.
 */
export function StudentName({ id, name, onOpen, className }) {
  if (!id || !onOpen) return <b className={className}>{name}</b>;
  return <button type="button" className={`link-btn t-name${className ? ` ${className}` : ''}`} onClick={() => onOpen({ id, name })}>{name}</button>;
}

/**
 * A repeated mistake as the teacher reads it (TEACHER-16): the stair on its own line, then the words the student saw on
 * that stair. A screen reader hears the stair, a pause, then the words.
 */
export function MistakeWords({ topic, level, cat }) {
  return (
    <>
      <b className="t-mis-stair"><MathText text={stairName(topic, level)} /></b>
      <span className="visually-hidden">. </span>
      <MathText text={mistakeText(topic, level, cat)} />
    </>
  );
}
