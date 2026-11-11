// "ההורים יראו סיכום קצר של התרגול" (PARENTS-4): the notice a child sees on a device linked to a family plan, before the
// first summary is sent (lib/familySync.js sends nothing until "הבנתי"). It names every field of the summary (a test
// keeps it so: SharingNotice.test.jsx), what is never sent, and where to see it and stop it.
// When: the server says the summary is on (linked.summary 'on') and this profile has not pressed "הבנתי" yet. It opens
// a moment after a calm screen settles, never during a lesson, a teaching stage, a repair or a check (it waits for the
// next such screen), never over another sheet, and never on the parents' pages. Escape or the close button is "not
// yet": it comes back the next time the app opens. A tap outside does not close it. "לראות מה נשלח" opens the
// sharing sheet, and the notice comes back when the sheet closes. Madi is calm (idle). App.jsx mounts it for students.
import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import { useAIStatus } from '@/lib/account.js';
import { qaActive } from '@/lib/qaFixtures.js';
import { markSharingSeen } from '@/lib/familySync.js';
import { Button, Sheet } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
// the sheet (with the report's renderer) loads only when it opens: the notice is on every linked student's screen
const SharingSheet = lazy(() => import('@/components/SharingSheet.jsx'));

export const NOTICE = {
  title: 'ההורים יראו סיכום קצר של התרגול',
  what: 'המכשיר הזה מחובר למנוי המשפחתי. ההורים יראו סיכום של כל יום: באילו ימים ובכמה דקות תרגלתם, כמה שאלות, אילו מדרגות, מה עבר בדיקת שליטה, אילו טעויות שחוזרות מתקנים עכשיו, הרצף, ומבחן קרוב אם יש.',
  never: 'לא נשלחים: התשובות עצמן, השיחות עם העוזר החכם, תמונות והשם שלכם.',
  where: 'בכל רגע אפשר לראות מה נשלח, ולהפסיק, בהגדרות ← שיתוף עם ההורים.',
  ok: 'הבנתי',
  see: 'לראות מה נשלח',
};
/** How long a screen settles before the notice opens. */
export const NOTICE_DELAY = 700;

/** Screens where something is in progress: a lesson, practice, placement, a teaching stage, a repair or a check. */
const BUSY = /^\/(lesson|practice|placement|repair|exams\/(check|practice)|rescue\/(check|exam))(\/|$)|^\/learn\/[^/]+\/[^/]+\/[^/]+/;
/** Screens that are not the child's own: the parents' area, the legal pages, the restore screen, a shared summary. */
const AWAY = /^\/(parents|cancel|terms|privacy|accessibility|restore|r)(\/|$)/;
/** May the notice open on this screen? */
export const noticeRoute = (pathname) => !BUSY.test(String(pathname ?? '')) && !AWAY.test(String(pathname ?? ''));

/** The notice's words and its two buttons (the sheet around it is SharingNotice). */
export function NoticeBody({ onOk, onSee }) {
  return (
    <div className="nudge-body sharing-notice">
      <Mascot mood="idle" size={88} />
      <p>{NOTICE.what}</p>
      <p>{NOTICE.never}</p>
      <p className="nudge-how">{NOTICE.where}</p>
      <div className="nudge-actions">
        <Button className="btn-block btn-lg" onClick={onOk}>{NOTICE.ok}</Button>
        <Button variant="secondary" className="btn-block" onClick={onSee}>{NOTICE.see}</Button>
      </div>
    </div>
  );
}

// "not yet" for this app open: the notice opens again the next time the app opens (a reload), never again in this one
let notYet = false;

export default function SharingNotice() {
  const { pathname } = useLocation();
  const due = useApp((s) => !!s.ai.familyDevice?.token && !s.ai.familyDevice.sharingSeen);
  const on = useAIStatus((x) => x.status?.linked?.summary === 'on');
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [later, setLater] = useState(notYet);
  const calm = noticeRoute(pathname);
  const show = due && on && (hasServer() || qaActive()) && !later;

  useEffect(() => {
    if (!show || !calm || open || sheet) return undefined;
    // another sheet is open (the backup question, the tutor's limit…): try again a moment later
    const t = setInterval(() => { if (!document.querySelector('[role="dialog"]')) { clearInterval(t); setOpen(true); } }, NOTICE_DELAY);
    return () => clearInterval(t);
  }, [show, calm, open, sheet]);
  // a lesson or a check opened under it (back, a link): it waits for the next calm screen
  useEffect(() => { if (!calm || !show) setOpen(false); }, [calm, show]);

  const notNow = () => { notYet = true; setLater(true); setOpen(false); };
  const ok = () => { setOpen(false); markSharingSeen().catch(() => {}); };
  const see = () => { setOpen(false); setSheet(true); };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) notNow(); }} title={NOTICE.title} className="nudge-sheet sharing-notice-sheet" dismissible={false}>
        <NoticeBody onOk={ok} onSee={see} />
      </Sheet>
      {/* closing the sheet brings the notice back (its interval above), until "הבנתי" */}
      {sheet && <Suspense fallback={null}><SharingSheet open onOpenChange={(o) => { if (!o) setSheet(false); }} /></Suspense>}
    </>
  );
}
