// "מחר": what to do in tomorrow's lesson. The class licence card (when the paywall is on), mistakes that repeat this
// week (each with "לתת תרגול על זה": that stair, for the students who made the mistake, TEACHER-4 §6), weak topics in
// checked exams, who to check in with, and the newest help requests.
import clsx from 'clsx';
import { ChevronLeft, Send } from 'lucide-react';
import { TOPIC } from '@/content/index.js';
import { MathText } from '@/components/MathText.jsx';
import { useAIStatus } from '@/lib/account.js';
import LicenceCard from '@/components/teacher/LicenceCard.jsx';
import { isStair } from '@/lib/assign.js';
import { fmtDay, pct } from './common.jsx';

/** A group in the "what to do tomorrow" view: a small heading over plain rows (the settings grammar). */
function Group({ title, tone, children, more }) {
  return (
    <section className={clsx('set-group', 't-group', tone && `t-group-${tone}`)} aria-label={title}>
      <h2 className="set-head">{title}</h2>
      <div className="t-group-box">{children}</div>
      {more}
    </section>
  );
}

export default function TomorrowTab({ cls, data, students, openHelp, onOpenHelp, onAssign }) {
  const paywall = useAIStatus((x) => x.status?.paywall === true);
  const idle = (s) => !s.lastPractice || (Date.now() - new Date(s.lastPractice)) > 3 * 864e5;
  const attention = students.filter((s) => idle(s) || (s.week.n >= 5 && pct(s.week.first, s.week.n) < 60));
  // Topics where the class lost points in checked exams (last two weeks).
  const examWeak = Object.values((data?.exams || []).filter((e) => Date.now() - new Date(e.at) < 14 * 864e5).reduce((acc, e) => {
    e.questions.forEach((q) => {
      if (q.status === 'correct') return;
      const w = (acc[q.topic] ||= { topic: q.topic, lost: 0, skills: new Set(), names: new Set() });
      w.lost += 1; if (q.skill) w.skills.add(q.skill); w.names.add(e.name);
    });
    return acc;
  }, {})).map((w) => ({ ...w, skills: [...w.skills], names: [...w.names] })).sort((a, b) => b.names.length - a.names.length || b.lost - a.lost).slice(0, 5);

  return (
    <>
      {paywall && <LicenceCard cls={cls} />}
      {students.length > 0 && (
        <div className="t-grid">
          <Group title="טעויות שחוזרות השבוע" tone="warm">
            {data.mistakes.length === 0 ? <p className="t-row muted">לא זוהו טעויות שחוזרות.</p> : (
              <ul className="t-list">
                {data.mistakes.map((m) => {
                  const skill = `${m.topic}:${m.level}`;
                  const rowId = `t-mis-${m.topic}-${m.cat}`;
                  const ids = m.ids || [];
                  return (
                    <li key={`${m.topic}:${m.cat}`} className="t-row">
                      <span className="t-list-main" id={rowId}><b>{TOPIC[m.topic]?.title}</b>: <MathText text={TOPIC[m.topic]?.cats[m.cat] || m.cat} /></span>
                      <span className="muted">{m.students === 1 ? 'תלמיד אחד' : `${m.students} תלמידים`}: {m.names.slice(0, 6).join(', ')}{m.names.length > 6 ? '…' : ''}</span>
                      {onAssign && isStair(skill) && ids.length > 0 && (
                        <button type="button" className="btn btn-secondary btn-sm t-row-act" aria-describedby={rowId}
                          onClick={() => onAssign({ kind: 'stair', skill, targets: ids, targetsLabel: `לתלמידים שטעו בזה (${ids.length})` })}>
                          <Send size={16} aria-hidden="true" />לתת תרגול על זה
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Group>
          {examWeak.length > 0 && (
            <Group title="נושאים חלשים במבחנים" tone="warm">
              <ul className="t-list">
                {examWeak.map((w) => (
                  <li key={w.topic} className="t-row">
                    <span className="t-list-main"><b>{TOPIC[w.topic]?.title || 'נושא אחר'}</b>: {w.lost === 1 ? 'שאלה אחת עם טעות' : `${w.lost} שאלות עם טעות`}</span>
                    <span className="muted">{w.skills.slice(0, 3).join(', ')}{w.skills.length ? '. ' : ''}{w.names.length === 1 ? w.names[0] : `${w.names.length} תלמידים: ${w.names.slice(0, 6).join(', ')}`}</span>
                  </li>
                ))}
              </ul>
            </Group>
          )}
          <Group title="כדאי לבדוק איתם">
            {attention.length === 0 ? <p className="t-row muted">{openHelp.length ? 'כולם מתרגלים ומצליחים. יש בקשות עזרה שמחכות לכם.' : 'כולם מתרגלים ומצליחים.'}</p> : (
              <ul className="t-list">
                {attention.map((s) => (
                  <li key={s.id} className="t-row">
                    <span className="t-list-main"><b>{s.name}</b></span>
                    <span className="muted">{idle(s) ? (s.lastPractice ? `תרגול אחרון ${fmtDay(s.lastPractice)}` : 'עוד לא תרגלו אף פעם') : `נכון בניסיון ראשון: ${pct(s.week.first, s.week.n)}%`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Group>
          <Group title="בקשות עזרה חדשות" more={openHelp.length > 0 && <button type="button" className="t-more" onClick={onOpenHelp}>לכל הבקשות<ChevronLeft size={18} aria-hidden="true" /></button>}>
            {openHelp.length === 0 ? <p className="t-row muted">אין בקשות פתוחות.</p> : (
              <ul className="t-list">{openHelp.slice(0, 5).map((h) => <li key={h.id} className={clsx('t-row', !h.seen_at && 'unseen')}><span className="t-list-main"><b>{h.name}</b>, {TOPIC[h.topic]?.title || ''}</span><span className="muted">{h.note || <MathText text={h.question} />}</span></li>)}</ul>
            )}
          </Group>
        </div>
      )}
    </>
  );
}
