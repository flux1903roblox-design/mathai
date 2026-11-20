// "מצאנו גיבוי" (DURABLE-4): what a backup holds, in one line (name, grade, XP, stairs, the last practice day, and the
// stairs mastered), and what restoring it here will do, with the buttons for that case (apply.js says the cases):
//   empty  להמשיך מכאן
//   same   לאחד עם מה שיש כאן, and why nothing is lost
//   other  a calm warning that it replaces another student's progress, undoable for 30 days; "לא עכשיו" is the big
//          button and "להחליף" the quiet one, so a sibling's progress is never replaced by a slip
// Shared by every restore (the file, the backup code; the class and the family later).
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp, isActiveDay } from '@/lib/store.js';
import { TOPICS } from '@/content/topics.js';
import { doneCount } from '@/lib/path.js';
import { gradeCounts } from '@/learn/stairStatus.ts';
import { Button } from '@/components/ui.jsx';
import { applyRestored, restoreCase, RESTORE_TOAST } from '@/lib/durable/apply.js';
import { dataOf } from '@/lib/durable/merge.js';

import { localized, t as tr, fmtDate } from '@/lib/i18n.js';
let GRADE = localized(() => ({ 7: tr('shell.restorepreview.1'), 8: tr('shell.restorepreview.2') }), (v) => { GRADE = v; });

/** What a backup holds, counted as the profile screen counts it (Me.jsx). */
export function previewOf(state, now = new Date()) {
  const profile = state?.profile || {};
  const path = state?.path || {};
  const skills = state?.learn?.skills || {};
  const iso = now.toISOString();
  const stairs = TOPICS.reduce((a, t) => a + doneCount(t.id, path), 0);
  // as the profile's "שולטים לבד" (learn/stairStatus.ts): an old backup's stairs whose memory check came due still count
  const mastered = gradeCounts(profile.grade || '7', skills, path, iso).learned;
  const last = Object.keys(state?.days || {}).filter((d) => isActiveDay(state.days[d])).sort().at(-1) || null;
  return {
    name: profile.name || '', grade: profile.role === 'teacher' ? tr('shell.restorepreview.3') : GRADE[profile.grade] || '', xp: Number(state?.xp) || 0, stairs, mastered,
    last: last ? fmtDate(last, { day: 'numeric', month: 'long', year: 'numeric' }) : null,
  };
}

/**
 * `backup`: { state, at } (importBackup's result). `heading`: the tag of its own title ('h1' on a screen of its own;
 * none inside a sheet, whose title it is), which takes the focus when it appears. `quiet`: no toast when it is done
 * (the caller says so on a screen of its own).
 */
export default function RestorePreview({ backup, source = 'file', heading = null, quiet = false, onDone, onCancel }) {
  const [local] = useState(() => dataOf(useApp.getState()));
  const head = useRef(null);
  useEffect(() => { head.current?.focus(); }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const kind = restoreCase(local, backup.state);
  const p = previewOf(backup.state);
  const localName = local.profile?.name || tr('shell.restorepreview.4');

  const go = async (replace) => {
    setBusy(true); setError('');
    const r = await applyRestored(backup.state, source, { at: backup.at, replace });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    if (!r.applied) return;
    if (!quiet) toast.success(RESTORE_TOAST);
    onDone?.(r);
  };

  const parts = [p.name && <bdi key="n">{p.name}</bdi>, p.grade, <span key="x"><bdi dir="ltr">{p.xp} XP</bdi></span>, p.stairs === 1 ? tr('shell.restorepreview.5') : tr('shell.restorepreview.6', { stairs: p.stairs }), p.last && tr('shell.restorepreview.7', { last: p.last })].filter(Boolean);
  return (
    <div className="restore-preview">
      {heading === 'h1' && <h1 className="restore-title" tabIndex={-1} ref={head}>{tr('shell.restorepreview.8')}</h1>}
      {heading === 'h2' && <h2 className="restore-title" tabIndex={-1} ref={head}>{tr('shell.restorepreview.8')}</h2>}
      <p className="restore-summary">{parts.map((x, i) => <span key={i}>{i > 0 && <span aria-hidden="true"> · </span>}{x}</span>)}</p>
      <p className="restore-mastered">{tr('shell.restorepreview.9')}{p.mastered}</p>
      {kind === 'same' && <p className="restore-note">{tr('shell.restorepreview.10')}</p>}
      {kind === 'other' && <p className="restore-warn">{tr('shell.restorepreview.11')}<bdi>{localName}</bdi>{tr('shell.restorepreview.12')}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="restore-actions">
        {kind === 'other' ? (
          <>
            <Button className="btn-block btn-lg" onClick={onCancel}>{tr('shell.restorepreview.13')}</Button>
            <Button variant="secondary" className="btn-block" onClick={() => go(true)} disabled={busy}>{tr('shell.restorepreview.14')}</Button>
          </>
        ) : (
          <>
            <Button className="btn-block btn-lg" onClick={() => go(false)} disabled={busy}>{kind === 'same' ? tr('shell.restorepreview.15') : tr('shell.restorepreview.16')}</Button>
            <Button variant="ghost" className="btn-block" onClick={onCancel}>{tr('shell.restorepreview.13')}</Button>
          </>
        )}
      </div>
    </div>
  );
}
