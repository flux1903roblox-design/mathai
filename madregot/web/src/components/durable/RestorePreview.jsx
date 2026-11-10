// "מצאנו גיבוי" (DURABLE-4): what a backup holds, in one line (name, grade, XP, stairs, the last practice day, and the
// stairs mastered), and what restoring it here will do, with the buttons for that case (apply.js says the cases):
//   empty  להמשיך מכאן
//   same   לאחד עם מה שיש כאן, and why nothing is lost
//   other  a calm warning that it replaces another student's progress, undoable for 30 days; "לא עכשיו" is the big
//          button and "להחליף" the quiet one, so a sibling's progress is never replaced by a slip
// Shared by every restore (the file now; the vault and the class later).
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp, isActiveDay } from '@/lib/store.js';
import { TOPICS, topicsFor } from '@/content/index.js';
import { doneCount } from '@/lib/path.js';
import { skillId } from '@/learn/skills.ts';
import { masteryState } from '@/learn/mastery.ts';
import { Button } from '@/components/ui.jsx';
import { applyRestored, restoreCase, RESTORE_TOAST } from '@/lib/durable/apply.js';
import { dataOf } from '@/lib/durable/merge.js';

const GRADE = { 7: 'כיתה ז׳', 8: 'כיתה ח׳' };

/** What a backup holds, counted as the profile screen counts it (Me.jsx). */
export function previewOf(state, now = new Date()) {
  const profile = state?.profile || {};
  const path = state?.path || {};
  const skills = state?.learn?.skills || {};
  const iso = now.toISOString();
  const stairs = TOPICS.reduce((a, t) => a + doneCount(t.id, path), 0);
  const mastered = topicsFor(profile.grade || '7').reduce((a, t) => a + t.levels.filter((_, i) => masteryState(skills[skillId(t.id, i + 1)], iso) === 'mastered').length, 0);
  const last = Object.keys(state?.days || {}).filter((d) => isActiveDay(state.days[d])).sort().at(-1) || null;
  return {
    name: profile.name || '', grade: profile.role === 'teacher' ? 'מורה' : GRADE[profile.grade] || '', xp: Number(state?.xp) || 0, stairs, mastered,
    last: last ? new Date(`${last}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : null,
  };
}

/**
 * `backup`: { state, at } (importBackup's result). `heading`: the tag of its own title ('h1' on a screen of its own;
 * none inside a sheet, whose title it is), which takes the focus when it appears.
 */
export default function RestorePreview({ backup, source = 'file', heading = null, onDone, onCancel }) {
  const [local] = useState(() => dataOf(useApp.getState()));
  const head = useRef(null);
  useEffect(() => { head.current?.focus(); }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const kind = restoreCase(local, backup.state);
  const p = previewOf(backup.state);
  const localName = local.profile?.name || 'תלמיד אחר';

  const go = async (replace) => {
    setBusy(true); setError('');
    const r = await applyRestored(backup.state, source, { at: backup.at, replace });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    if (!r.applied) return;
    toast.success(RESTORE_TOAST);
    onDone?.(r);
  };

  const parts = [p.name && <bdi key="n">{p.name}</bdi>, p.grade, <span key="x"><bdi dir="ltr">{p.xp} XP</bdi></span>, p.stairs === 1 ? 'מדרגה אחת' : `${p.stairs} מדרגות`, p.last && `תרגול אחרון: ${p.last}`].filter(Boolean);
  return (
    <div className="restore-preview">
      {heading === 'h1' && <h1 className="restore-title" tabIndex={-1} ref={head}>מצאנו גיבוי</h1>}
      {heading === 'h2' && <h2 className="restore-title" tabIndex={-1} ref={head}>מצאנו גיבוי</h2>}
      <p className="restore-summary">{parts.map((x, i) => <span key={i}>{i > 0 && <span aria-hidden="true"> · </span>}{x}</span>)}</p>
      <p className="restore-mastered">שולטים לבד: {p.mastered}</p>
      {kind === 'same' && <p className="restore-note">שום דבר לא יימחק: אנחנו משאירים את הגבוה מבין השניים בכל מדרגה ובכל יום.</p>}
      {kind === 'other' && <p className="restore-warn">במכשיר הזה יש התקדמות של <bdi>{localName}</bdi>. שחזור יחליף אותה. אפשר לבטל את זה במשך 30 יום בהגדרות.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="restore-actions">
        {kind === 'other' ? (
          <>
            <Button className="btn-block btn-lg" onClick={onCancel}>לא עכשיו</Button>
            <Button variant="secondary" className="btn-block" onClick={() => go(true)} disabled={busy}>להחליף</Button>
          </>
        ) : (
          <>
            <Button className="btn-block btn-lg" onClick={() => go(false)} disabled={busy}>{kind === 'same' ? 'לאחד עם מה שיש כאן' : 'להמשיך מכאן'}</Button>
            <Button variant="ghost" className="btn-block" onClick={onCancel}>לא עכשיו</Button>
          </>
        )}
      </div>
    </div>
  );
}
