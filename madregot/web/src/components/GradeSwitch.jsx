// The grade choice (ז׳ or ח׳) as a two-way switch: the student's settings, the topics list, and a teacher's new class.
import clsx from 'clsx';

import { t } from '@/lib/i18n.js';
export function GradeSwitch({ value, onChange, id }) {
  return (
    <div className="segmented" role="radiogroup" aria-labelledby={id}>
      {[['7', t('shell.gradeswitch.1')], ['8', t('shell.gradeswitch.2')]].map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={clsx('seg', value === v && 'on')} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}
