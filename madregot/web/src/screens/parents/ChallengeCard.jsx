// "אתגר משפחתי לשבוע" on /parents (PRODUCT2-39): the parent picks one small goal from a short list and sends it to the
// child as a link (WhatsApp, the phone's share sheet, or a copied link). The goal rides in the link's # fragment
// (lib/familyChallenge.js), so this works with no server, on the free tier and signed out, and nothing reaches us. The
// child takes it on their own device (screens/FamilyOffer.jsx) and sees it on the missions tab; the parent sees how it
// goes in the weekly summary the child sends, and, on a linked device, in the daily report (FamilyReport.jsx counts that
// week against the goal sent from here: store.js noteChallengeSent). No price, and nothing here asks the child for more.
import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { MessageCircle, Link2, Share2, HeartHandshake } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { copyText } from '@/lib/clipboard.js';
import { appBase, waHref } from '@/lib/share.js';
import { weekStart } from '@shared/week.js';
import { goalsFor, challengeWeek, goalText, encodeChallenge, challengeLink, challengeText, dm } from '@/lib/familyChallenge.js';

const DAY_MS = 864e5;
/** '8.11–14.11' */
export const weekRange = (w) => `${dm(w)}–${dm(new Date(Date.parse(`${w}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10))}`;

export const CHALLENGE_CARD = {
  title: 'אתגר משפחתי לשבוע',
  intro: 'בוחרים יעד קטן לשבוע ושולחים לילד קישור. הילד מקבל את האתגר בטלפון שלו ורואה אותו במסך המשימות.',
  week: (w, thisWeek) => `${thisWeek ? 'לשבוע הזה' : 'לשבוע הבא'}: ${weekRange(w)}`,
  pick: 'היעד לשבוע',
  wa: 'וואטסאפ',
  other: 'שיתוף בדרך אחרת',
  copy: 'העתקת הקישור',
  copied: 'הקישור הועתק',
  copyFailed: 'ההעתקה לא הצליחה. אפשר לנסות שוב.',
  sent: (s) => `שלחתם: ${goalText(s)} לשבוע ${weekRange(s.w)}.`,
  see: 'איך האתגר מתקדם רואים בסיכום השבועי שהילד שולח, ובסיכום היומי אם המכשיר מחובר.',
  privacy: 'בקישור יש רק את היעד והשבוע, בלי שם ובלי פרטים, והוא לא עובר דרך השרת של מדרגות.',
  calm: 'כדאי לבחור יחד יעד שקל לעמוד בו. אין כאן ניקוד ואין השוואה לאחרים.',
};

export default function ChallengeCard() {
  const id = useId();
  const day = today();
  const w = challengeWeek(day);
  const goals = goalsFor(day);
  const sent = useApp((s) => s.family?.sent);
  // four days when the week still has room for them, else the first goal offered
  const [pick, setPick] = useState(() => Math.max(0, goals.findIndex((g) => g.k === 'd' && g.n === 4)));
  const goal = goals[Math.min(pick, goals.length - 1)];
  const { link, text } = useMemo(() => {
    const ch = { w, ...goal };
    const l = challengeLink(encodeChallenge(ch), appBase());
    return { link: l, text: challengeText(ch, l) };
  }, [w, goal]);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const note = () => useApp.getState().noteChallengeSent({ w, ...goal });
  const copy = async () => { note(); toast(await copyText(link) ? CHALLENGE_CARD.copied : CHALLENGE_CARD.copyFailed); };
  const shareOther = async () => {
    note();
    try { await navigator.share({ text }); } catch (e) { if (e?.name !== 'AbortError') toast('השיתוף לא נפתח. אפשר לשלוח בוואטסאפ או להעתיק את הקישור.'); }
  };
  const showSent = !!sent && sent.w >= weekStart(day);
  return (
    <section className="card parents-card challenge-card" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="card-title"><HeartHandshake size={22} aria-hidden="true" className="brand-icon" />{CHALLENGE_CARD.title}</h2>
      <p>{CHALLENGE_CARD.intro}</p>
      <fieldset className="ch-set">
        <legend className="ch-legend">{CHALLENGE_CARD.pick}</legend>
        <p className="ch-week" id={`${id}-w`}>{CHALLENGE_CARD.week(w, w <= day)}</p>
        <div className="ch-chips">
          {goals.map((g, i) => (
            <label key={`${g.k}${g.n}`} className={clsx('ch-chip', i === pick && 'on')}>
              <input type="radio" name={`${id}-goal`} className="ch-radio" checked={i === pick} onChange={() => setPick(i)} aria-describedby={`${id}-w`} />
              <span>{goalText(g)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="parents-note ch-calm">{CHALLENGE_CARD.calm}</p>
      <div className="ch-actions">
        <a className="btn btn-primary ch-wa" href={waHref(text)} target="_blank" rel="noopener noreferrer" onClick={note}><MessageCircle size={20} aria-hidden="true" />{CHALLENGE_CARD.wa}</a>
        {canShare && <button type="button" className="btn btn-secondary" onClick={shareOther}><Share2 size={20} aria-hidden="true" />{CHALLENGE_CARD.other}</button>}
        <button type="button" className="btn btn-secondary" onClick={copy}><Link2 size={20} aria-hidden="true" />{CHALLENGE_CARD.copy}</button>
      </div>
      {showSent && <p className="ch-sent" role="status">{CHALLENGE_CARD.sent(sent)}</p>}
      <p className="field-hint">{CHALLENGE_CARD.see}</p>
      <p className="field-hint">{CHALLENGE_CARD.privacy}</p>
    </section>
  );
}

