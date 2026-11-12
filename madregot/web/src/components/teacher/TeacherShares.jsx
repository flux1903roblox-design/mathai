// What a teacher can pass on from the board without passing on the class (COUNCIL2-36, lib/teacherShare.js):
//   ColleagueSheet   "שליחה לעמית/ה": the demo class's link, a made-up class that opens on the colleague's own device
//                    with no sign-up. Nothing of this class goes with it: no name, no code, no result.
//   GoalShareSheet   the class's week against its own goal, as a card and a message: the class total and the target,
//                    as the students see them, and no name or any one student's share.
// Each sends from the teacher's own phone (WhatsApp, the phone's share sheet, or a copy); nothing is sent from here.
import { useMemo } from 'react';
import { toast } from 'sonner';
import { MessageCircle, Share2, Copy, Mail } from 'lucide-react';
import { Sheet } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { copyText } from '@/lib/clipboard.js';
import { waHref } from '@/lib/share.js';
import { demoLink, colleagueText, goalShare } from '@/lib/teacherShare.js';

export const SHARES_TEXT = {
  colleague: 'שליחה לעמית/ה',
  colleagueLead: 'אפשר לשלוח למורה אחר או אחרת קישור לכיתה לדוגמה של מדרגות. שום דבר מהכיתה שלכם לא נשלח: לא שמות, לא קוד הכיתה ולא תוצאות.',
  goal: 'מטרת הכיתה השבוע',
  goalLead: 'כרטיס של הכיתה כולה מול המטרה שהיא הציבה לעצמה. אין בו שמות, ולא כמה עשה כל תלמיד.',
  whatsapp: 'וואטסאפ',
  other: 'שיתוף בדרך אחרת',
  copy: 'העתקת ההודעה',
  mail: 'מייל',
};

const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** The three ways a message leaves the teacher's phone: WhatsApp, the phone's share sheet (where there is one), a copy. */
function SendActions({ text, mailSubject }) {
  const other = async () => {
    try { await navigator.share({ text }); } catch (e) { if (e?.name !== 'AbortError') toast('השיתוף לא נפתח. אפשר לשלוח בוואטסאפ או להעתיק.'); }
  };
  const copy = async () => toast(await copyText(text) ? 'ההודעה הועתקה' : 'ההעתקה לא הצליחה. אפשר לסמן את ההודעה ולהעתיק אותה.');
  return (
    <div className="ts-actions">
      <a className="btn btn-primary" href={waHref(text)} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true" />{SHARES_TEXT.whatsapp}</a>
      {canShare() && <button type="button" className="btn btn-secondary" onClick={other}><Share2 size={20} aria-hidden="true" />{SHARES_TEXT.other}</button>}
      {mailSubject && (
        <a className="btn btn-secondary" href={`mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(text)}`}><Mail size={20} aria-hidden="true" />{SHARES_TEXT.mail}</a>
      )}
      <button type="button" className="btn btn-secondary" onClick={copy}><Copy size={20} aria-hidden="true" />{SHARES_TEXT.copy}</button>
    </div>
  );
}

/** The message as the sheet shows it, its link set left to right inside the Hebrew line. */
function Message({ text, link }) {
  const lead = link && text.endsWith(link) ? text.slice(0, text.length - link.length).trimEnd() : text;
  return <blockquote className="as-msg" data-testid="share-message">{lead}{link && text.endsWith(link) && <> <bdi dir="ltr">{link}</bdi></>}</blockquote>;
}

export function ColleagueSheet({ open, onOpenChange }) {
  const link = demoLink();
  const text = colleagueText(link);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={SHARES_TEXT.colleague} className="ts-sheet"
      footer={<SendActions text={text} mailSubject="מדרגות: כיתה לדוגמה לתרגול מתמטיקה" />}>
      <div className="ts-body">
        <p className="ts-lead">{SHARES_TEXT.colleagueLead}</p>
        <Message text={text} link={link} />
      </div>
    </Sheet>
  );
}

/** The card itself: the class's total against its own goal, the bar, and Madi when the goal is reached. */
function GoalCard({ g }) {
  return (
    <figure className={`ts-goal${g.reached ? ' is-reached' : ''}`} aria-label={`מטרת הכיתה השבוע: ${g.have} מתוך ${g.target} צעדים`}>
      <div className="ts-goal-top">
        <div>
          <p className="ts-goal-brand"><span className="wordmark sm">מדרגות</span></p>
          <p className="ts-goal-title">מטרת הכיתה השבוע</p>
        </div>
        <Mascot mood={g.reached ? 'happy' : 'idle'} size={64} />
      </div>
      <p className="ts-goal-count"><bdi dir="ltr">{g.have}</bdi> מתוך <bdi dir="ltr">{g.target}</bdi> צעדים</p>
      <div className="bar ts-goal-bar" aria-hidden="true"><i style={{ width: `${g.pct}%` }} /></div>
      <figcaption className="ts-goal-line">{g.reached ? 'הכיתה הגיעה למטרה שהציבה לעצמה.' : 'כל שיעור, שלב לימוד או בדיקה הם צעד של הכיתה כולה.'}</figcaption>
    </figure>
  );
}

/** Props: `goal` (the dashboard's: { on, week, target, have, reached }). Nothing else of the class is read. */
export function GoalShareSheet({ open, onOpenChange, goal }) {
  const g = useMemo(() => goalShare(goal), [goal]);
  if (!g) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={SHARES_TEXT.goal} className="ts-sheet" footer={<SendActions text={g.text} />}>
      <div className="ts-body">
        <p className="ts-lead">{SHARES_TEXT.goalLead}</p>
        <GoalCard g={g} />
        <Message text={g.text} link={g.text.match(/https?:\/\/\S+$/)?.[0] || ''} />
      </div>
    </Sheet>
  );
}
