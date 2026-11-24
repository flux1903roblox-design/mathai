// Settings › מידע לתמיכה (DURABLE-9): the technical details a family can copy into an email when something does not
// work: the build, how the saving goes, whether the browser promised to keep the data, how much room the site uses,
// the backup (its state, never its code), and the last 5 errors kept on this device (lib/monitor.js writes them, with
// or without a server). No name, no code, nothing typed by the student.
import '@/locales/settings.js'; // this screen's words, before anything here uses them (COUNCIL2-34)
import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { useDurable, healthText } from '@/lib/durable/useDurable.js';
import { persistedText } from '@/lib/durable/persist.js';
import { errorLog } from '@/lib/durable/storage.js';
import { RELEASE } from '@/lib/monitor.js';
import { useApp } from '@/lib/store.js';
import { backupText } from '@/lib/durable/vault.js';
import { copyText } from '@/lib/clipboard.js';
import { Button } from '@/components/ui.jsx';
import { localized, t as tr, fmtDate } from '@/lib/i18n.js';
import '@/styles/lazy/durable.css'; // the saving rules, loaded with this screen (FOLLOWUP-23)

export let COPIED = localized(() => tr('settings.supportinfo.1'), (v) => { COPIED = v; });
export let NOT_COPIED = localized(() => tr('settings.supportinfo.2'), (v) => { NOT_COPIED = v; });
const SHOWN_ERRORS = 5;

/** Megabytes, as people read them: one decimal under 10, whole above. */
export const mb = (bytes) => { const n = bytes / 1024 / 1024; return `${n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 1 : 0 })} MB`; };
const knownRoom = (est) => !!est && Number.isFinite(est.usage) && Number.isFinite(est.quota) && est.quota > 0;
/** "0.4 MB מתוך 2,048 MB", or "לא ידוע" when the browser cannot say. */
export const roomText = (est) => (knownRoom(est) ? tr('settings.supportinfo.3', { p0: mb(est.usage), p1: mb(est.quota) }) : tr('settings.supportinfo.4'));
const when = (iso) => fmtDate(iso, { dateStyle: 'short', timeStyle: 'short' });

/** The details as plain text, as they are copied. `errors`: the newest first. */
export function supportText({ release, health, persisted, estimate, backup, errors }) {
  return [
    tr('settings.supportinfo.5'),
    tr('settings.supportinfo.6', { release }),
    tr('settings.supportinfo.7', { p0: healthText(health) }),
    tr('settings.supportinfo.8', { p0: persistedText(persisted) }),
    tr('settings.supportinfo.9', { p0: roomText(estimate) }),
    tr('settings.supportinfo.10', { p0: backupText(backup) }),
    tr('settings.supportinfo.12', { p0: errors.length ? '' : tr('settings.supportinfo.11') }).trim(),
    ...errors.map((e) => `- ${when(e.at)} · ${e.kind} · ${e.route || ''} · ${e.message || e.name || ''}`),
  ].join('\n');
}

export default function SupportInfo() {
  const health = useDurable((s) => s.health);
  const persisted = useDurable((s) => s.persisted);
  const backup = useApp((s) => s.backup);
  const [estimate, setEstimate] = useState(null);
  const [errors, setErrors] = useState([]);
  // read when it is opened, so what it shows is now
  const load = async () => {
    try { setEstimate((await navigator.storage?.estimate?.()) ?? null); } catch { setEstimate(null); }
    try { setErrors((await errorLog.list()).slice(-SHOWN_ERRORS).reverse()); } catch { setErrors([]); }
  };
  const info = { release: RELEASE, health, persisted, estimate, backup, errors };
  const onCopy = async () => { if (await copyText(supportText(info))) toast.success(COPIED); else toast(NOT_COPIED); };
  return (
    <details className="section set-group support-info" onToggle={(e) => { if (e.currentTarget.open) load(); }}>
      <summary className="set-head support-summary">{tr('settings.supportinfo.13')}<ChevronDown size={22} aria-hidden="true" className="support-chev" /></summary>
      <dl className="save-rows support-rows">
        <div className="save-row"><dt>{tr('settings.supportinfo.14')}</dt><dd dir="ltr">{RELEASE}</dd></div>
        <div className="save-row"><dt>{tr('settings.supportinfo.15')}</dt><dd>{healthText(health)}</dd></div>
        <div className="save-row"><dt>{tr('settings.supportinfo.16')}</dt><dd>{persistedText(persisted)}</dd></div>
        <div className="save-row">
          <dt>{tr('settings.supportinfo.17')}</dt>
          {/* each amount keeps its own order inside the Hebrew line */}
          <dd>{knownRoom(estimate) ? <span><bdi dir="ltr">{mb(estimate.usage)}</bdi>{tr('settings.supportinfo.18')}<bdi dir="ltr">{mb(estimate.quota)}</bdi></span> : tr('settings.supportinfo.4')}</dd>
        </div>
        <div className="save-row"><dt>{tr('settings.supportinfo.19')}</dt><dd>{backupText(backup)}</dd></div>
        <div className="save-row support-errors-row">
          <dt>{tr('settings.supportinfo.20')}</dt>
          <dd>
            {errors.length ? (
              <ol className="support-errors">
                {errors.map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <span className="support-error-when"><bdi dir="ltr">{when(e.at)}</bdi> · {e.kind}</span>
                    <span className="support-error-msg" dir="auto">{e.message || e.name}</span>
                  </li>
                ))}
              </ol>
            ) : tr('settings.supportinfo.11')}
          </dd>
        </div>
      </dl>
      <Button variant="secondary" className="btn-block support-copy" onClick={onCopy}>{tr('settings.supportinfo.21')}</Button>
    </details>
  );
}
