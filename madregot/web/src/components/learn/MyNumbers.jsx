// "הלמידה שלי במספרים": what the evidence says, worked out on this device. Time in the app is not counted as learning.
// A number with too little behind it is shown as "not enough yet", never as a percentage. Where the data goes is said by
// the one sentence the app uses for it (lib/durable/copy.js): a class student's answers also go to the teacher, and a
// linked device's short daily summary goes to the parents (PARENTS-4).
import { useApp } from '@/lib/store.js';
import { useAIStatus } from '@/lib/account.js';
import { metrics, MIN_N } from '@/learn/analytics.ts';
import { gradeCounts } from '@/learn/stairStatus.ts';
import { whereSavedText } from '@/lib/durable/copy.js';

const pct = (r) => (r.value == null ? null : `${Math.round(r.value * 100)}%`);

export default function MyNumbers() {
  const learn = useApp((s) => s.learn);
  const profile = useApp((s) => s.profile);
  const backup = useApp((s) => s.backup);
  const linked = useApp((s) => !!s.ai.familyDevice?.token);
  const summaryOn = useAIStatus((x) => x.status?.linked?.summary === 'on');
  const path = useApp((s) => s.path);
  const now = new Date().toISOString();
  const m = metrics(learn, now);
  // the three that say the most, in the student's words; the rest under "עוד מספרים" (STUDENT-9 §6)
  const rows = [
    // the same number as the profile's "שולטים לבד" tile (Me.jsx): a stair whose memory check came due is still learned
    { label: 'מדרגות שאתם שולטים בהן לבד', value: String(gradeCounts(profile?.grade || '7', learn.skills, path, now).learned) },
    { label: 'נכון בניסיון הראשון, בלי רמז', value: pct(m.independent), n: m.independent.n },
    { label: 'טעויות שתיקנתם', value: pct(m.misconResolution), n: m.misconResolution.n },
  ];
  const gain = m.masteryGain.value == null ? null : `${m.masteryGain.value >= 0 ? '+' : '\u2212'}${Math.abs(Math.round(m.masteryGain.value * 100))} נקודות אחוז`;
  const more = [
    { label: 'חזרות שהצלחתם', value: pct(m.reviews), n: m.reviews.n },
    { label: 'ימים שלמדתם', value: String(m.activeDays) },
    { label: 'כמה השליטה שלכם השתפרה', value: gain },
    { label: 'שליטה שנשארה גם אחרי שבוע', value: pct(m.retained7) },
    { label: 'שיעורים שהתחלתם / סיימתם', value: `${m.lessonsStarted} / ${m.lessonsDone}` },
  ];
  const list = (items) => (
    <dl className="nums">
      {items.map((r) => (
        <div key={r.label} className="num-row">
          <dt>{r.label}</dt>
          <dd>{r.value ?? <span className="muted">עוד אין מספיק נתונים</span>}{r.value != null && r.n != null && <span className="num-n"> ({r.n})</span>}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <section className="section my-numbers" aria-labelledby="nums-title">
      <h2 id="nums-title" className="h-section">הלמידה שלי במספרים</h2>
      {list(rows)}
      <details className="nums-more">
        <summary>עוד מספרים</summary>
        {list(more)}
        <p className="field-hint">מספר מוצג רק כשיש מאחוריו לפחות {MIN_N} מקרים.</p>
      </details>
      <p className="field-hint nums-where">{whereSavedText({ profile, backup }, { about: 'numbers', summary: linked && summaryOn })} הזמן באפליקציה לא נספר כאן: רק מה שפתרתם לבד.</p>
    </section>
  );
}
