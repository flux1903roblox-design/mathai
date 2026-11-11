// "ההתקדמות" on /parents (PARENTS-5, PARENTS-6): what each linked device sent, for the paying parent. One card per
// device, in the order they were linked: when it last sent, this week or last week in the same renderer the child
// previews (ReportView, source 'synced'), the last 8 weeks, and the parent's two controls: their own switch for the
// device's summary (the child's state is shown beside it, never explained) and deleting the device's history.
// Every early state has its own words: linked with nothing sent yet (with an example, marked as one), nothing this
// week, sharing off on the device, off by the parent, a device the plan does not cover, and a plan that ended with
// summaries still kept. Under the first card, once a week per browser: "הסיכום עוזר לכם?". No percentage right
// anywhere. Built on lib/parent.js (summary, setDeviceSharing, deleteDeviceHistory, reportFeedback); the QA states
// (?qa-parent=report | report-empty | report-off) draw from components/report/qaFamily.js and send nothing.
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { STORE_KEY, today as dayOf } from '@/lib/store.js';
import { summary as loadSummary, setDeviceSharing, deleteDeviceHistory, reportFeedback } from '@/lib/parent.js';
import { weekStart, weekFrom } from '@/learn/report.ts';
import { whenText } from '@/lib/when.js';
import { dm } from '@/lib/share.js';
import ReportView from '@/components/report/ReportView.jsx';
import WeeksChart from '@/components/report/WeeksChart.jsx';
import { EXAMPLE_WEEK, EXAMPLE_TODAY } from '@/components/report/exampleWeek.js';
import { qaFamilySummary } from '@/components/report/qaFamily.js';
import { StateCard } from '@/components/ds.jsx';
import { Button } from '@/components/ui.jsx';
import { ConfirmSheet, LoadingState } from '@/components/Screen.jsx';

export const REPORT = {
  title: 'ההתקדמות',
  sub: 'סיכום יומי מכל מכשיר מחובר.',
  updated: (iso) => `עודכן לאחרונה: ${whenText(iso, { yesterday: false })}`,
  // PARENTS-6
  firstTitle: (label) => `${label}: עוד אין סיכום`,
  first: 'הסיכום הראשון יופיע כאן אחרי התרגול הבא במכשיר. לפני כן הילד יראה במכשיר הודעה שהסיכום נשלח אליכם, ומה בדיוק יש בו.',
  willSee: 'מה תראו כאן:',
  willSeeList: ['באילו ימים ובכמה דקות תרגלו', 'אילו מדרגות תורגלו, ומה כבר עבר בדיקת שליטה', 'טעויות שחוזרות, ומה מתקנים', 'רצף, ומבחן קרוב אם יש'],
  never: 'מה לא יגיע אלינו:',
  neverText: 'התשובות עצמן, שיחות עם העוזר החכם, תמונות ושם הילד.',
  firstWeek: 'בשבוע הראשון:',
  firstWeekText: 'בהתחלה רואים כאן בעיקר שלבי לימוד. כל מדרגה מתחילה בהסבר, בדוגמה, בפתרון משותף ובתרגול, ובדיקת השליטה מגיעה בסופה, בדרך כלל אחרי כמה ימים.',
  example: 'איך זה ייראה (דוגמה)',
  noneThisWeek: 'השבוע עוד לא היה תרגול במכשיר הזה.',
  noneLastWeek: 'בשבוע שעבר לא היה תרגול במכשיר הזה.',
  lastPractice: (d) => `התרגול האחרון: ${dm(d)}.`,
  childOff: (at) => `השיתוף כבוי במכשיר עצמו${at ? ` מאז ${dm(dayOf(new Date(at)))}` : ''}. אם תרצו, אפשר לדבר על זה יחד. רק במכשיר עצמו אפשר להפעיל אותו שוב.`,
  noPlan: (label) => `${label}: הסיכום היומי כלול במנוי המשפחתי.`,
  ended: 'המנוי הסתיים. הסיכומים שכבר הגיעו נשמרים עד 90 יום ואז נמחקים. אפשר למחוק אותם עכשיו.',
  deleteRow: 'מחיקת ההיסטוריה של המכשיר',
  deleteTitle: (label) => `למחוק את הסיכומים של ${label}?`,
  deleteBody: 'נמחק את כל הסיכומים שהגיעו מהמכשיר הזה. הסיכום הבא יגיע אחרי התרגול הבא.',
  deleted: 'הסיכומים נמחקו',
  ask: 'הסיכום עוזר לכם?',
  yes: 'כן',
  no: 'לא ממש',
  thanks: 'תודה. זה עוזר לנו לשפר.',
  loadError: 'לא הצלחנו לטעון את ההתקדמות.',
};

/** The parent's own switch for a device, in each state (the child's part is stated, never explained). */
export const PARENT_SWITCH = {
  on: { text: 'הסיכום מהמכשיר הזה: פועל', button: 'לכבות', to: false },
  parent_off: { text: 'כיביתם את הסיכום מהמכשיר הזה.', button: 'להפעיל', to: true },
  child_off: { text: 'השיתוף כבוי במכשיר עצמו.', button: 'לכבות', to: false },
  both_off: { text: 'כיביתם את הסיכום, והשיתוף כבוי גם במכשיר עצמו.', button: 'להפעיל', to: true, hint: 'הסיכום יחזור רק כשהשיתוף יופעל גם במכשיר.' },
};
const CHILD_OFF = ['child_off', 'both_off'];
const nameOf = (d) => d.label || 'מכשיר';
const DAY_MS = 864e5;
const lastWeekOf = (day) => new Date(Date.parse(`${weekStart(day)}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
/** The newest day with any practice (time, an answer, a lesson or a stage), or null. */
const lastPracticeOf = (rows) => [...rows].sort((a, b) => (a.d < b.d ? -1 : 1)).filter((r) => r.m > 0 || r.q > 0 || r.ls > 0 || r.st > 0).at(-1)?.d || null;

// ---------------------------------------------------------------- "הסיכום עוזר לכם?": once a week per browser
const FB_KEY = `${STORE_KEY}-report-fb-week`;
const fbWeek = { get: () => { try { return localStorage.getItem(FB_KEY); } catch { return null; } }, set: (w) => { try { localStorage.setItem(FB_KEY, w); } catch { /* blocked */ } } };

function Feedback({ qa }) {
  const week = weekStart(dayOf());
  const [state, setState] = useState(() => (fbWeek.get() === week ? 'hidden' : 'ask')); // ask | busy | thanks | hidden
  if (state === 'hidden') return null;
  const answer = async (useful) => {
    setState('busy');
    try {
      if (!qa) await reportFeedback(useful);
    } catch (e) {
      // answered already this week (another browser): that is a thanks too
      if (e.code !== 'already_answered') { toast.error(e.message); setState('ask'); return; }
    }
    fbWeek.set(week);
    setState('thanks');
  };
  return (
    <section className="card parents-card report-fb" aria-label={REPORT.ask}>
      {state === 'thanks' ? <p role="status" className="report-fb-thanks">{REPORT.thanks}</p> : (
        <>
          <p className="report-fb-ask">{REPORT.ask}</p>
          <div className="report-fb-actions">
            <Button variant="secondary" className="btn-sm" onClick={() => answer(true)} disabled={state === 'busy'}>{REPORT.yes}</Button>
            <Button variant="secondary" className="btn-sm" onClick={() => answer(false)} disabled={state === 'busy'}>{REPORT.no}</Button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- the first day: linked, nothing sent yet
function FirstDay({ device }) {
  return (
    <StateCard kind="empty" mood="idle" level={4} title={REPORT.firstTitle(nameOf(device))}>
      <p>{REPORT.first}</p>
      <p className="report-state-head">{REPORT.willSee}</p>
      <ul className="report-state-list">{REPORT.willSeeList.map((x) => <li key={x}>{x}</li>)}</ul>
      <p><span className="report-state-head">{REPORT.never}</span> {REPORT.neverText}</p>
      <p><span className="report-state-head">{REPORT.firstWeek}</span> {REPORT.firstWeekText}</p>
      <details className="report-example">
        <summary>{REPORT.example}</summary>
        <ReportView week={EXAMPLE_WEEK} audience="parent" source="synced" today={EXAMPLE_TODAY} level={5} />
      </details>
    </StateCard>
  );
}

// ---------------------------------------------------------------- one device
function DeviceCard({ device, plan, today, qa, onChange }) {
  const id = useId();
  const rows = device.days || [];
  const [which, setWhich] = useState(() => (weekStart(today) === today ? 'last' : 'this'));
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const start = which === 'this' ? weekStart(today) : lastWeekOf(today);
  const week = weekFrom(rows, start, today);
  const sw = plan ? PARENT_SWITCH[device.sharing] : null;
  const label = nameOf(device);
  const flip = async () => {
    setBusy(true);
    try {
      const r = qa ? { sharing: { on: 'parent_off', parent_off: 'on', child_off: 'both_off', both_off: 'child_off' }[device.sharing] } : await setDeviceSharing(device.id, sw.to);
      onChange({ ...device, sharing: r.sharing });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      if (!qa) await deleteDeviceHistory(device.id);
      setDel(false); onChange({ ...device, days: [] }); toast(REPORT.deleted);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const last = lastPracticeOf(rows);
  return (
    <section className="card parents-card report-device" aria-labelledby={`${id}-name`}>
      <header className="report-device-head">
        <h3 id={`${id}-name`} className="card-title">{label}</h3>
        {device.lastSync && <p className="report-device-sync">{REPORT.updated(device.lastSync)}</p>}
      </header>
      {CHILD_OFF.includes(device.sharing) && <p className="parents-note report-off-note">{REPORT.childOff(device.sharingAt)}</p>}
      {rows.length === 0 && plan && device.sharing === 'on' && <FirstDay device={device} />}
      {rows.length > 0 && (
        <>
          <div className="segmented report-switch" role="radiogroup" aria-label={`איזה שבוע להציג: ${label}`}>
            <button type="button" role="radio" aria-checked={which === 'this'} className={clsx('seg', which === 'this' && 'on')} onClick={() => setWhich('this')}>השבוע</button>
            <button type="button" role="radio" aria-checked={which === 'last'} className={clsx('seg', which === 'last' && 'on')} onClick={() => setWhich('last')}>השבוע שעבר</button>
          </div>
          {week.empty ? (
            <div className="report-week-empty" role="status">
              <p className="report-week-empty-title">{which === 'this' ? REPORT.noneThisWeek : REPORT.noneLastWeek}</p>
              {last && <p className="report-sub">{REPORT.lastPractice(last)}</p>}
            </div>
          ) : <ReportView week={week} audience="parent" source="synced" today={today} level={4} />}
          <WeeksChart rows={rows} today={today} id={`${id}-weeks`} level={4} />
        </>
      )}
      {(sw || rows.length > 0) && (
        <div className="report-controls">
          {sw && (
            <div className="report-control">
              <p id={`${id}-sw`} className="report-control-text">{sw.text}</p>
              <Button variant="secondary" className="btn-sm" onClick={flip} disabled={busy} aria-describedby={`${id}-sw`}>{sw.button}</Button>
              {sw.hint && <p className="field-hint report-control-hint">{sw.hint}</p>}
            </div>
          )}
          {rows.length > 0 && <button type="button" className="set-row danger report-delete" onClick={() => setDel(true)}>{REPORT.deleteRow}</button>}
        </div>
      )}
      <ConfirmSheet open={del} onOpenChange={(o) => { if (!o && !busy) setDel(false); }} title={REPORT.deleteTitle(label)} keep="לא למחוק"
        confirm={busy ? 'מוחקים…' : 'כן, למחוק'} onConfirm={remove} mood="idle">
        <p>{REPORT.deleteBody}</p>
      </ConfirmSheet>
    </section>
  );
}

/**
 * The section. `plan`: the live plan or null; `devices`: the account's devices (the page renders this only when the
 * report is on and there is a plan or a device); `qa`: the QA state name.
 */
export default function FamilyReport({ plan, devices = [], qa = null }) {
  const today = dayOf();
  const [data, setData] = useState(() => (qa ? qaFamilySummary(qa, today) : null));
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (qa) return;
    setError('');
    loadSummary({ days: 56 }).then(setData).catch((e) => setError(e.message || REPORT.loadError));
  }, [qa]);
  const linked = devices.filter((d) => !d.pending).map((d) => d.id).join(',');
  useEffect(() => { load(); }, [load, linked]);
  const change = (next) => setData((cur) => ({ ...cur, devices: cur.devices.map((d) => (d.id === next.id ? next : d)) }));

  if (!plan && !devices.length) return null;
  let body;
  if (error) {
    body = (
      <section className="card parents-card" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={load}>לנסות שוב</Button>
      </section>
    );
  } else if (!data) body = <LoadingState text="טוענים את ההתקדמות…" />;
  else {
    const list = [...(data.devices || [])].sort((a, b) => (a.linkedAt < b.linkedAt ? -1 : 1));
    if (!list.length) return null;
    const withRows = list.filter((d) => d.days?.length);
    // no plan: the devices whose summaries are still kept can be read and deleted; the others say what the plan holds
    const shown = plan ? list : withRows;
    const firstWithRows = shown.find((d) => d.days?.length);
    body = (
      <>
        {!plan && withRows.length > 0 && <p className="parents-note report-ended">{REPORT.ended}</p>}
        {!plan && list.filter((d) => !d.days?.length).map((d) => <p key={d.id} className="parents-note report-noplan">{REPORT.noPlan(nameOf(d))}</p>)}
        {shown.map((d) => (
          <div key={d.id} className="report-device-wrap">
            <DeviceCard device={d} plan={plan} today={today} qa={!!qa} onChange={change} />
            {d === firstWithRows && <Feedback qa={!!qa} />}
          </div>
        ))}
      </>
    );
  }
  return (
    <section className="parents-report" aria-labelledby="report-title">
      <header className="parents-report-head">
        <h2 id="report-title" className="parents-report-title">{REPORT.title}</h2>
        <p className="parents-report-sub">{REPORT.sub}</p>
      </header>
      {body}
    </section>
  );
}
