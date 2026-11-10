// "לשחזר מקובץ" (DURABLE-4): choose a backup file. A file input under a label drawn as a button (44 px and more, the
// label is its name for a screen reader, Enter or Space opens the chooser), and a plain message when the file cannot
// be used. A file that can be used goes to `onLoaded` ({ state, at }), which shows what it holds (RestorePreview).
import { useId, useState } from 'react';
import { Upload } from 'lucide-react';
import clsx from 'clsx';
import { importBackup } from '@/lib/durable/file.js';

export default function FileRestore({ onLoaded, label = 'לשחזר מקובץ', className }) {
  const id = useId();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be chosen again
    if (!file) return;
    setError(''); setBusy(true);
    const r = await importBackup(file);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    onLoaded(r);
  };
  return (
    <div className={clsx('file-restore', className)}>
      <label className={clsx('btn btn-secondary btn-block file-pick', busy && 'is-busy')} htmlFor={id}>
        <Upload size={20} aria-hidden="true" />
        <span>{label}</span>
      </label>
      <input id={id} type="file" accept=".json,application/json" className="visually-hidden file-input" onChange={pick} disabled={busy}
        aria-describedby={error ? `${id}-error` : undefined} />
      {error && <p id={`${id}-error`} className="form-error file-error" role="alert">{error}</p>}
    </div>
  );
}
