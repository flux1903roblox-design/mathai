// #/f/<data>: a family challenge a parent sent (PRODUCT2-39, lib/familyChallenge.js). The goal and its week are in the
// link's # fragment, which no browser sends to a server: this page decodes and checks it, makes no request, and asks the
// child whether to take it. Taking it keeps it on this device only (store.js acceptChallenge) and it shows on the
// missions tab; "לא עכשיו" keeps nothing. The link holds a goal and a week and nothing else (no name, no text), so a link
// from anyone can only ever offer a few days of practice. A link that does not decode, or whose week has ended, says so
// calmly. On a device with no student (the parent's own phone, a teacher's) it says where to open it.
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { HeartHandshake } from 'lucide-react';
import { ScreenBar, ScreenFoot } from '@/components/Screen.jsx';
import { StateCard } from '@/components/ds.jsx';
import Mascot from '@/components/Mascot.jsx';
import { useApp, today } from '@/lib/store.js';
import { weekStart } from '@shared/week.js';
import { decodeChallenge, challengeFor, goalText, unitHint, dm } from '@/lib/familyChallenge.js';
import '@/styles/lazy/quests.css'; // the challenge's rules, loaded with this screen (moved out of the first load at the product2 merge)

export const OFFER = {
  title: 'אתגר משפחתי',
  lead: 'הגיע אליכם אתגר משפחתי לשבוע:',
  counts: 'מה שתרגלתם כבר השבוע נספר.',
  kept: 'האתגר נשמר רק במכשיר הזה. אפשר להסיר אותו בכל רגע במסך המשימות.',
  replaces: (old) => `יש לכם כבר אתגר לשבוע הזה: ${goalText(old)}. אם תקבלו את החדש, הוא יחליף אותו.`,
  accept: 'לקבל את האתגר',
  later: 'לא עכשיו',
  accepted: 'האתגר נשמר במסך המשימות',
  same: 'האתגר הזה כבר אצלכם, במסך המשימות.',
  toQuests: 'למשימות',
  brokenTitle: 'הקישור לא שלם.',
  brokenText: 'אפשר לבקש מההורים לשלוח אותו שוב.',
  pastTitle: 'האתגר הזה היה לשבוע שכבר עבר.',
  pastText: 'אפשר לבקש מההורים אתגר לשבוע הזה.',
  elsewhere: 'את האתגר מקבלים בטלפון שבו מתרגלים במדרגות. פתחו את הקישור שם.',
  start: 'להתחיל לתרגל במדרגות',
};

/** '8.11–14.11' */
const range = (w) => { const end = new Date(Date.parse(`${w}T00:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10); return `${dm(w)}–${dm(end)}`; };

export default function FamilyOffer() {
  const { data } = useParams();
  const navigate = useNavigate();
  const role = useApp((s) => s.profile?.role);
  const family = useApp((s) => s.family);
  const ch = useMemo(() => decodeChallenge(data), [data]);
  const d = today();
  const home = () => navigate('/', { replace: true });

  let body; let foot = null;
  if (!ch) {
    body = <StateCard kind="empty" mood="thinking" title={OFFER.brokenTitle}><p>{OFFER.brokenText}</p></StateCard>;
  } else if (ch.w < weekStart(d)) {
    body = <StateCard kind="empty" mood="idle" title={OFFER.pastTitle}><p>{OFFER.pastText}</p></StateCard>;
  } else {
    const had = challengeFor(family, ch.w);
    const same = !!had && had.k === ch.k && had.n === ch.n;
    body = (
      <section className="card offer-card" aria-labelledby="offer-goal">
        <Mascot mood="happy" size={96} className="offer-madi" />
        <p className="offer-lead">{OFFER.lead}</p>
        <p id="offer-goal" className="offer-goal"><HeartHandshake size={26} aria-hidden="true" className="brand-icon" />{goalText(ch)}</p>
        <p className="offer-week">{`בשבוע ${range(ch.w)}`}</p>
        <p className="offer-line">{`${OFFER.counts} ${unitHint(ch.k)}`}</p>
        {role === 'student' && !same && had && <p className="offer-line offer-replaces">{OFFER.replaces(had)}</p>}
        {role === 'student' && <p className="field-hint offer-kept">{same ? OFFER.same : OFFER.kept}</p>}
        {role !== 'student' && <p className="offer-line offer-elsewhere">{OFFER.elsewhere}</p>}
      </section>
    );
    if (role === 'student' && same) {
      foot = <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/quests', { replace: true })}>{OFFER.toQuests}</button>;
    } else if (role === 'student') {
      const accept = () => { if (useApp.getState().acceptChallenge(ch)) { toast(OFFER.accepted); navigate('/quests', { replace: true }); } };
      foot = (
        <>
          <button type="button" className="btn btn-primary btn-lg" onClick={accept}>{OFFER.accept}</button>
          <button type="button" className="btn btn-ghost offer-later" onClick={home}>{OFFER.later}</button>
        </>
      );
    } else if (!role) {
      foot = <button type="button" className="btn btn-secondary btn-lg" onClick={home}>{OFFER.start}</button>;
    }
  }
  return (
    <div className="page pushed family-offer">
      <ScreenBar title={OFFER.title} back="/" />
      {body}
      {foot && <ScreenFoot>{foot}</ScreenFoot>}
    </div>
  );
}
