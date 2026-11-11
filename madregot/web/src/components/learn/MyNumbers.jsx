// "הלמידה שלי במספרים": what the evidence says, from this device only. Time in the app is not counted as learning.
// A number with too little behind it is shown as "not enough yet", never as a percentage.
import { useApp } from '@/lib/store.js';
import { metrics, MIN_N } from '@/learn/analytics.ts';

const pct = (r) => (r.value == null ? null : `${Math.round(r.value * 100)}%`);

/**
 * Where these numbers live (trust spec TRUST-1 §5). A class student's practice answers also go to the teacher's board,
 * so "only on this device" would not be true for them. (The durable lane moves this into durable/copy.js whereSavedText.)
 */
export const whereSaved = (inClass) => (inClass
  ? 'המספרים האלה מחושבים במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.'
  : 'המספרים נשמרים רק במכשיר הזה ולא נשלחים לשום מקום.');

export default function MyNumbers() {
  const learn = useApp((s) => s.learn);
  // a student signed in to a class: only then are the answers sent (store.js recordAnswer)
  const inClass = useApp((s) => s.profile?.role === 'student' && !!s.profile.token);
  const m = metrics(learn, new Date().toISOString());
  const rows = [
    { label: 'מדרגות שאתם שולטים בהן לבד', value: String(m.masteredNow) },
    { label: 'תשובות לבד (בלי רמז, בניסיון ראשון) שיצאו נכונות', value: pct(m.independent), n: m.independent.n },
    { label: 'טעויות חוזרות שתוקנו', value: pct(m.misconResolution), n: m.misconResolution.n },
    { label: 'בדיקות זיכרון שעברו', value: pct(m.reviews), n: m.reviews.n },
    { label: 'ימים שבהם למדתם', value: String(m.activeDays) },
  ];
  const gain = m.masteryGain.value == null ? null : `${m.masteryGain.value >= 0 ? '+' : ''}${Math.round(m.masteryGain.value * 100)}`;
  return (
    <section className="section my-numbers" aria-labelledby="nums-title">
      <h2 id="nums-title" className="h-section">הלמידה שלי במספרים</h2>
      <dl className="nums">
        {rows.map((r) => (
          <div key={r.label} className="num-row">
            <dt>{r.label}</dt>
            <dd>{r.value ?? <span className="muted">עוד אין מספיק נתונים</span>}{r.value != null && r.n != null && <span className="num-n"> ({r.n})</span>}</dd>
          </div>
        ))}
      </dl>
      <details className="nums-more">
        <summary>מדדי למידה מפורטים</summary>
        <dl className="nums">
          <div className="num-row"><dt>שיפור בשליטה עצמאית (מהבדיקה הראשונה לבדיקה מאוחרת, בנקודות אחוז)</dt><dd>{gain ?? <span className="muted">עוד אין מספיק נתונים</span>}</dd></div>
          <div className="num-row"><dt>שליטה שנשמרה אחרי שבוע או יותר</dt><dd>{pct(m.retained7) ?? <span className="muted">עוד אין מספיק נתונים</span>}</dd></div>
          <div className="num-row"><dt>חזרתם אחרי יום / שבוע / חודש</dt><dd>{[m.returned.d1, m.returned.d7, m.returned.d30].map((x) => (x ? 'כן' : 'עוד לא')).join(' / ')}</dd></div>
          <div className="num-row"><dt>שיעורים שהתחלתם / סיימתם</dt><dd>{m.lessonsStarted} / {m.lessonsDone}</dd></div>
        </dl>
        <p className="field-hint">מספר מוצג רק כשיש מאחוריו לפחות {MIN_N} מקרים.</p>
      </details>
      <p className="field-hint">{whereSaved(inClass)} הזמן באפליקציה לא נספר כאן: רק מה שפתרתם לבד.</p>
    </section>
  );
}
