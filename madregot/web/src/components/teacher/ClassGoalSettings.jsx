// The teacher's "מטרת כיתה שבועית" block (STUDENT-4 §7): on or off, and the size of the goal (empty: automatic, 4 steps
// for each active student). Its temporary home is the "תלמידים" view of the teacher's board; TEACHER-9's class settings
// page takes it over. The students see only the class total and their own share.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { api, teacherHeaders } from '@/lib/api.js';
import { Button } from '@/components/ui.jsx';

const MIN = 10; const MAX = 400;
const OPTIONS = [[true, 'פועלת'], [false, 'כבויה']];

/** The size as typed: null when empty (automatic), a whole number from 10 to 400, or undefined when it is not one. */
export function parseSize(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n >= MIN && n <= MAX ? n : undefined;
}

export default function ClassGoalSettings({ cls, goal, onSaved }) {
  const [on, setOn] = useState(goal?.on !== false);
  const [size, setSize] = useState(goal?.custom ? String(goal.custom) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const radios = useRef([]);
  useEffect(() => { setOn(goal?.on !== false); setSize(goal?.custom ? String(goal.custom) : ''); }, [goal?.on, goal?.custom]);

  const save = async (nextOn, text, what) => {
    const target = parseSize(text);
    if (target === undefined) { setError(`גודל המטרה הוא מספר שלם בין ${MIN} ל־${MAX}. אפשר גם להשאיר ריק, ואז הגודל נקבע לבד.`); return; }
    setError(''); setBusy(true);
    try {
      const r = await api('/api/teacher/class/goal', { method: 'POST', body: { on: nextOn, target }, headers: teacherHeaders(cls) });
      if (what === 'switch') toast.success(nextOn ? 'מטרת הכיתה פועלת. התלמידים רואים אותה במסך המשימות.' : 'מטרת הכיתה כבויה. התלמידים לא רואים אותה.');
      else if (r.goal?.target !== goal?.target) toast.success(`נשמר. המטרה של השבוע: ${r.goal.target} צעדים.`);
      else toast.success(target === null ? 'נשמר. מהשבוע הבא הגודל ייקבע לבד.' : 'נשמר. הגודל החדש ייכנס לתוקף בשבוע הבא.');
      onSaved?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const pick = (v) => { if (busy || v === on) return; setOn(v); save(v, size, 'switch'); };
  // a radio group: the arrows move between the two options (and choose), Tab leaves the group
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = !on; pick(next);
    radios.current[next ? 0 : 1]?.focus();
  };

  return (
    <section className="set-group t-goal" aria-labelledby="t-goal-title">
      <h2 id="t-goal-title" className="set-head">מטרת כיתה שבועית</h2>
      <div className="segmented t-goal-seg" role="radiogroup" aria-labelledby="t-goal-title" onKeyDown={onKey}>
        {OPTIONS.map(([v, label], i) => (
          <button key={label} ref={(el) => { radios.current[i] = el; }} type="button" role="radio" aria-checked={on === v} tabIndex={on === v ? 0 : -1}
            className={clsx('seg', on === v && 'on')} onClick={() => pick(v)} disabled={busy && on !== v}>{label}</button>
        ))}
      </div>
      {on && (
        <form className="t-goal-size" onSubmit={(e) => { e.preventDefault(); save(true, size, 'size'); }} noValidate>
          <label htmlFor="t-goal-n" className="field-label">גודל המטרה (צעדים בשבוע)</label>
          <div className="t-goal-row">
            <input id="t-goal-n" className="input" inputMode="numeric" autoComplete="off" placeholder="אוטומטי" value={size} maxLength={3}
              onChange={(e) => { setSize(e.target.value.replace(/[^\d]/g, '')); setError(''); }}
              aria-invalid={!!error} aria-describedby={clsx('t-goal-hint', error && 't-goal-err')} />
            <Button type="submit" variant="secondary" disabled={busy}>שמירה</Button>
          </div>
          {error && <p id="t-goal-err" className="form-error" role="alert">{error}</p>}
        </form>
      )}
      <p id="t-goal-hint" className="field-hint">התלמידים רואים רק את הסכום של כל הכיתה ואת החלק של עצמם. אין דירוג ואין שמות. בלי מספר, המטרה היא 4 צעדים לכל תלמיד פעיל.</p>
    </section>
  );
}
