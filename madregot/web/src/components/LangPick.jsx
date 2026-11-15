// The language choice (COUNCIL2-34): עברית or العربية, each written in its own language and marked with its own lang,
// so a screen reader says it right in either language. Two pressable buttons in one group, the app's segmented look;
// the one in use is pressed. On the first screen (Welcome) and in Settings. Choosing one fetches its words first
// (lib/i18n.js setLocale), then every screen is drawn again in it (App.jsx); if they cannot be fetched (offline before
// Arabic was ever opened), the language stays as it was and a calm line says why.
// With one language there is nothing to choose, so nothing is drawn: a build without Arabic (the default; VITE_ARABIC,
// lib/i18n.js) shows no language choice anywhere.
import { useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { LOCALES, setLocale, useLocale, t } from '@/lib/i18n.js';

export default function LangPick({ className, labelledBy }) {
  const current = useLocale();
  const [busy, setBusy] = useState(false);
  if (Object.keys(LOCALES).length < 2) return null;
  const pick = async (id) => {
    if (id === current || busy) return;
    setBusy(true);
    try { await setLocale(id); } catch { toast(t('shell.locale.failed')); } finally { setBusy(false); }
  };
  return (
    <div className={clsx('segmented lang-pick', className)} role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : t('shell.locale.group')} aria-busy={busy || undefined}>
      {Object.values(LOCALES).map((l) => (
        <button key={l.id} type="button" lang={l.id} className={clsx('seg', current === l.id && 'on')} aria-pressed={current === l.id} onClick={() => pick(l.id)}>
          {l.name}
        </button>
      ))}
    </div>
  );
}
