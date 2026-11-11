// Madregot's shared pieces. The layouts follow two familiar apps (Duolingo for the daily loop, Brilliant for the
// lessons); the colours, fonts, icons and מדי are Madregot's own.
//   Segments   a segmented progress bar: thin (a lesson's steps) or thick (a breakdown such as exam readiness)
//   Bar        a thick progress bar with its count written inside (a quest's progress)
//   Badge      one status language: mastered, ready, practising, review, support, new, brand
//   Stat       a stat tile: an icon, a number and its label
//   StateCard  empty, error and celebration states with מדי
import clsx from 'clsx';
import Mascot from './Mascot.jsx';

/**
 * A row of equal segments. `steps` is a number (with `done` and `current`) or an array of tones
 * ('done' | 'current' | 'todo' | a status tone) for a breakdown.
 */
export function Segments({ steps, done = 0, current = -1, label, valueText, size = 'thin', className }) {
  const list = Array.isArray(steps)
    ? steps
    : Array.from({ length: steps }, (_, i) => (i < done ? 'done' : i === current ? 'current' : 'todo'));
  const n = list.length;
  return (
    <div className={clsx('segs', `segs-${size}`, className)} role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={n} aria-valuenow={Array.isArray(steps) ? list.filter((t) => t !== 'todo').length : done} aria-valuetext={valueText}>
      {list.map((tone, i) => <i key={i} className={clsx('seg-step', `rs-${tone}`)} />)}
    </div>
  );
}
/** Older name, kept so nothing breaks. */
export const Riser = Segments;

/** A thick bar with the count inside it, filling in the reading direction. */
export function Bar({ value, max, label, text, tone = 'good' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={clsx('qbar', `qbar-${tone}`)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text}>
      <i style={{ width: `${pct}%` }} />
      <span className="qbar-text" dir="auto">{text ?? `${value} / ${max}`}</span>
    </div>
  );
}

export function Badge({ tone = 'neutral', icon: Icon, children, className }) {
  return <span className={clsx('badge', `badge-${tone}`, className)}>{Icon && <Icon size={14} strokeWidth={2.6} aria-hidden="true" />}{children}</span>;
}

export function Stat({ value, label, tone = 'brand', icon: Icon }) {
  return (
    <div className={clsx('kpi', `kpi-${tone}`)}>
      {Icon && <Icon size={24} aria-hidden="true" className="kpi-icon" />}
      <span className="kpi-text">
        <span className="kpi-num">{value}</span>
        <span className="kpi-cap">{label}</span>
      </span>
    </div>
  );
}

/** `level`: the title's heading level where the card sits under a deeper heading (default h2). */
export function StateCard({ kind = 'empty', mood, title, children, action, level = 2 }) {
  const m = mood || (kind === 'celebrate' ? 'achievement' : kind === 'error' ? 'encouraging' : 'thinking');
  const Title = `h${Math.min(6, Math.max(2, level))}`;
  return (
    <section className={clsx('state-card', `state-${kind}`)} role={kind === 'error' ? 'alert' : 'status'}>
      <Mascot mood={m} size={kind === 'celebrate' ? 132 : 84} />
      {title && <Title className="state-title">{title}</Title>}
      {children && <div className="state-body">{children}</div>}
      {action}
    </section>
  );
}
