// Settings › שמירת ההתקדמות (DURABLE-1): where the progress is kept, said plainly. The first row is this device: saved
// (in the browser's storage, or in the copy on the device when the storage is full), or not, and why.
import { Check } from 'lucide-react';
import { useDurable, savedHealth } from '@/lib/durable/useDurable.js';

const NOT_SAVED = { full: 'לא נשמר: הדפדפן מלא', memory: 'לא נשמר: הדפדפן חוסם שמירה' };

export default function SaveSection() {
  const health = useDurable((s) => s.health);
  const saved = savedHealth(health);
  return (
    <section id="save" className="section set-group save-section" aria-labelledby="save-title">
      <h2 id="save-title" className="set-head" tabIndex={-1}>שמירת ההתקדמות</h2>
      <dl className="save-rows">
        <div className="save-row">
          <dt>במכשיר הזה</dt>
          <dd className={saved ? 'save-ok' : 'save-not'}>
            {saved && <Check size={18} strokeWidth={3} aria-hidden="true" />}
            {saved ? 'נשמר' : NOT_SAVED[health]}
          </dd>
        </div>
      </dl>
    </section>
  );
}
