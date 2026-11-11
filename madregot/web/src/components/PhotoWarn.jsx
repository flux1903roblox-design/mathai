// The warning before the camera or the picker opens for an exam page or a notebook photo (trust spec TRUST-5 §1,
// Appendix E.9). An exam page often carries a name, an ID number, a grade, a class and a school; the Ministry of
// Education's rule is that none of these goes to an AI tool. The sheet says so once a session, before anything is
// photographed, and says where the photo goes. Its one button opens the hidden file input itself, inside the same tap,
// so the camera or the picker opens at once. The next step (PhotoPrep) crops and blacks out on the device.
import { useCallback, useState } from 'react';
import { STORE_KEY } from '@/lib/store.js';
import { Button, Sheet } from './ui.jsx';
import Mascot from './Mascot.jsx';

/** sessionStorage: the warning was read in this session (the data map's client block lists it). */
export const PHOTO_WARNED = `${STORE_KEY}-photo-warned`;

export const PHOTO_WARN = {
  title: 'לפני שמצלמים',
  lines: [
    'בדף של מבחן יש לפעמים שם, תעודת זהות, ציון, כיתה ובית ספר. את הפרטים האלה לא שולחים לעוזר. בשלב הבא נחתוך את השורה העליונה, ואפשר להשחיר כל דבר נוסף.',
    'התמונה נשלחת לעוזר החכם (Anthropic, בארה״ב) כדי לבדוק אותה, ולא נשמרת אצלנו.',
  ],
  ok: 'הבנתי, לצלם',
};

export function photoWarned() {
  try { return sessionStorage.getItem(PHOTO_WARNED) === '1'; } catch { return false; }
}
function markWarned() {
  try { sessionStorage.setItem(PHOTO_WARNED, '1'); } catch { /* storage blocked: the warning simply comes again */ }
}

export function PhotoWarn({ open, onGo, onClose }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={PHOTO_WARN.title} className="photo-warn-sheet"
      footer={<Button className="btn-block btn-lg" onClick={onGo}>{PHOTO_WARN.ok}</Button>}>
      <div className="photo-warn">
        <Mascot mood="idle" size={64} still className="photo-warn-madi" />
        <div className="photo-warn-text">
          {PHOTO_WARN.lines.map((line) => <p key={line}>{line}</p>)}
        </div>
      </div>
    </Sheet>
  );
}

/**
 * `ask(input)` opens a hidden file input: at once when the warning was read in this session, else after the warning,
 * whose button clicks the input inside its own tap (a browser opens a file picker only from a tap). Render `warn`.
 */
export function usePhotoWarn() {
  const [input, setInput] = useState(null);
  const ask = useCallback((el) => {
    if (!el) return;
    if (photoWarned()) { el.click(); return; }
    setInput(el);
  }, []);
  const go = () => {
    markWarned();
    const el = input;
    setInput(null);
    el?.click();
  };
  const warn = <PhotoWarn open={!!input} onGo={go} onClose={() => setInput(null)} />;
  return { ask, warn };
}
