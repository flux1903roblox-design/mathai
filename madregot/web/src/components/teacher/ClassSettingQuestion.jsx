// "איפה הכיתה הזו לומדת?" (TRUST-11, trust Appendix E §E.8 copy word for word): a school class, where student AI
// follows the Ministry of Education's rules, or a private group (lessons, a club, extra classes), where the parents
// decide and the teacher attests that it is not run by a school. Asked when a class is opened (TeacherStart's details
// step and the board's "כיתה נוספת") and when its setting is changed in the class settings. The default is school.
import clsx from 'clsx';
import { SETTING_Q, SETTINGS, ATTEST } from '@/content/classAi.js';
import '@/styles/lazy/teacher.css'; // the teacher's screens' rules, loaded with them (FOLLOWUP-23)

export { SETTING_Q, SETTINGS, ATTEST };

/** What POST /api/classes (and a change of setting) carries: { setting } and, for a private group, privateAttest. */
export const settingBody = (setting, attest) => (setting === 'private' ? { setting: 'private', privateAttest: attest === true } : { setting: 'school' });
/** A private group needs the attestation ticked before the class can be opened or changed. */
export const settingReady = (setting, attest) => setting !== 'private' || attest === true;

/** One answer of a question in a sheet or a flow: a native radio inside a big pressable row (arrow keys move between them). */
export function Choice({ name, value, checked, onChange, title, sub, disabled }) {
  return (
    <label className={clsx('ob-opt', 'as-choice', checked && 'on', disabled && 'is-disabled')}>
      <input type="radio" className="as-radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
      <span className="ob-opt-text"><b>{title}</b>{sub && <span>{sub}</span>}</span>
    </label>
  );
}

/** The private group's attestation: a required checkbox. */
export function AttestBox({ id, checked, onChange }) {
  return (
    <label className="check-row cs-attest" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required aria-required="true" />
      <span>{ATTEST}</span>
    </label>
  );
}

/**
 * The question with its two answers and, when "private" is picked, the attestation. Props: `setting` ('school' |
 * 'private'), `attest` (boolean), `onChange({ setting, attest })`, `idPrefix` (unique per page).
 */
export default function ClassSettingQuestion({ setting = 'school', attest = false, onChange, idPrefix = 'cs' }) {
  const pick = (v) => onChange({ setting: v, attest: v === 'private' ? attest : false });
  return (
    <fieldset className="as-set cs-set">
      <legend className="field-label">{SETTING_Q}</legend>
      <div className="as-opts">
        {Object.entries(SETTINGS).map(([v, c]) => (
          <Choice key={v} name={`${idPrefix}-setting`} value={v} checked={setting === v} onChange={pick} title={c.title} sub={c.sub} />
        ))}
      </div>
      {setting === 'private' && <AttestBox id={`${idPrefix}-attest`} checked={attest} onChange={(a) => onChange({ setting, attest: a })} />}
    </fieldset>
  );
}
