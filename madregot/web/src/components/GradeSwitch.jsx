// The grade choice (ז׳ or ח׳) as a two-way switch: the student's settings, the topics list, and a teacher's new class.
import clsx from 'clsx';

export function GradeSwitch({ value, onChange, id }) {
  return (
    <div className="segmented" role="radiogroup" aria-labelledby={id}>
      {[['7', 'כיתה ז׳'], ['8', 'כיתה ח׳']].map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={clsx('seg', value === v && 'on')} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}
