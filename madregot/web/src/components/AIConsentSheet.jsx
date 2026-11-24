// The permission sheet before the first AI request in a store build (STUDENT-12, Apple 5.1.2(i), lib/aiConsent.js). It
// says plainly who the smart helper is (a program by a named company, not a person), what is sent, where, and what is
// never sent or kept, and asks. "כן, להמשיך" lets the waiting request go; "לא עכשיו", the close button, Escape or "מה
// עוד כדאי לדעת" send nothing. Mounted in App.jsx only in builds made with VITE_STORE; the web keeps its own introduction.
import { Link } from 'react-router-dom';
import { APP_NAME } from '@shared/brand.js';
import { useConsent, answerConsent } from '@/lib/aiConsent.js';
import { Button, Sheet } from './ui.jsx';
import Mascot from './Mascot.jsx';

export const CONSENT_TITLE = 'לפני שמדברים עם העוזר החכם';
export const CONSENT_TEXT = `העוזר החכם הוא Claude של חברת Anthropic, תוכנה ולא אדם. כדי לענות, נשלחים ל־Anthropic בארה״ב התרגיל שעל המסך, מה שכתבתם, ותמונה אם צילמתם. לא נשלחים שם, מייל או טלפון, ו${APP_NAME} לא שומרת את השיחות.`;

export default function AIConsentSheet() {
  const open = useConsent((s) => s.open);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) answerConsent(false); }} title={CONSENT_TITLE}>
      <div className="exit-sheet consent-sheet">
        <Mascot mood="idle" size={88} />
        <p className="lead confirm-text">{CONSENT_TEXT}</p>
        <Link to="/privacy" className="foot-link consent-more" onClick={() => answerConsent(false)}>מה עוד כדאי לדעת</Link>
        <Button className="btn-block btn-lg" onClick={() => answerConsent(true)}>כן, להמשיך</Button>
        <Button variant="ghost" className="btn-block exit-quit" onClick={() => answerConsent(false)}>לא עכשיו</Button>
      </div>
    </Sheet>
  );
}
