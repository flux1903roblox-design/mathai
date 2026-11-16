// The warning before the camera or the picker opens for an exam page or a notebook photo (trust spec TRUST-5 §1,
// Appendix E.9). An exam page often carries a name, an ID number, a grade, a class and a school; the Ministry of
// Education's rule is that none of these goes to an AI tool. The sheet says so once a session, before anything is
// photographed, and says where the photo goes. Its one button opens the hidden file input itself, inside the same tap,
// so the camera or the picker opens at once. The next step (PhotoPrep) crops and blacks out on the device.
// Two wordings, for the input it opens: the camera ('לפני שמצלמים', a photo) and the picker ('לפני ששולחים דף', a
// picture or a PDF, which opens on the device: the file itself is never sent, only the pictures of its pages). The
// input says which: one with `capture` opens the camera. Read once a session, whichever came first.
import { useCallback, useState } from 'react';
import { STORE_KEY } from '@/lib/store.js';
import { Button, Sheet } from './ui.jsx';
import Mascot from './Mascot.jsx';

/** sessionStorage: the warning was read in this session (the data map's client block lists it). */
export const PHOTO_WARNED = `${STORE_KEY}-photo-warned`;

const DETAILS = 'בדף של מבחן יש לפעמים שם, תעודת זהות, ציון, כיתה ובית ספר. את הפרטים האלה לא שולחים לעוזר. בשלב הבא נחתוך את השורה העליונה, ואפשר להשחיר כל דבר נוסף.';

/** The camera's wording; `file`: the picker's (a picture or a PDF chosen from the phone). */
export const PHOTO_WARN = {
  title: 'לפני שמצלמים',
  lines: [
    DETAILS,
    'התמונה נשלחת לעוזר החכם (Anthropic, בארה״ב) כדי לבדוק אותה, ולא נשמרת אצלנו.',
  ],
  ok: 'הבנתי, לצלם',
  file: {
    title: 'לפני ששולחים דף',
    lines: [
      DETAILS,
      'קובץ PDF נפתח כאן, במכשיר. הקובץ עצמו לא נשלח.',
      'רק התמונות של הדפים נשלחות לעוזר החכם (Anthropic, בארה״ב) כדי לבדוק אותן, והן לא נשמרות אצלנו.',
    ],
    ok: 'הבנתי, לבחור קובץ',
  },
};

/**
 * The material of a coming test (EXAM-MATERIAL 1b: the teacher's message, a summary sheet, a worksheet, a notebook page):
 * the same step, in the words of reading it, not checking it.
 */
const MATERIAL_DETAILS = 'בהודעה או בדף יש לפעמים שם, טלפון, כיתה ובית ספר. את הפרטים האלה לא שולחים לעוזר. בשלב הבא נחתוך את השורה העליונה, ואפשר להשחיר כל דבר נוסף.';
export const MATERIAL_WARN = {
  title: PHOTO_WARN.title,
  lines: [MATERIAL_DETAILS, 'התמונה נשלחת לעוזר החכם (Anthropic, בארה״ב) כדי לקרוא ממנה את נושאי המבחן, ולא נשמרת אצלנו.'],
  ok: PHOTO_WARN.ok,
  file: {
    title: PHOTO_WARN.file.title,
    lines: [MATERIAL_DETAILS, PHOTO_WARN.file.lines[1], 'רק התמונות של הדפים נשלחות לעוזר החכם (Anthropic, בארה״ב) כדי לקרוא מהן את נושאי המבחן, והן לא נשמרות אצלנו.'],
    ok: PHOTO_WARN.file.ok,
  },
};

/** Which wording a hidden file input gets: 'camera' for one that opens the camera (`capture`), else 'file'. */
export const warnKind = (input) => (input?.hasAttribute?.('capture') ? 'camera' : 'file');

export function photoWarned() {
  try { return sessionStorage.getItem(PHOTO_WARNED) === '1'; } catch { return false; }
}
function markWarned() {
  try { sessionStorage.setItem(PHOTO_WARNED, '1'); } catch { /* storage blocked: the warning simply comes again */ }
}

export function PhotoWarn({ open, kind = 'camera', onGo, onClose, words = PHOTO_WARN }) {
  const copy = kind === 'file' ? words.file : words;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={copy.title} className="photo-warn-sheet"
      footer={<Button className="btn-block btn-lg" onClick={onGo}>{copy.ok}</Button>}>
      <div className="photo-warn">
        <Mascot mood="idle" size={64} still className="photo-warn-madi" />
        <div className="photo-warn-text">
          {copy.lines.map((line) => <p key={line}>{line}</p>)}
        </div>
      </div>
    </Sheet>
  );
}

/**
 * `ask(input)` opens a hidden file input: at once when the warning was read in this session, else after the warning (in
 * the camera's words or the picker's, warnKind), whose button clicks the input inside its own tap (a browser opens a
 * file picker only from a tap). Render `warn`. `words`: PHOTO_WARN (an exam or a notebook), or MATERIAL_WARN (a test's material).
 */
export function usePhotoWarn(words = PHOTO_WARN) {
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
  const warn = <PhotoWarn open={!!input} kind={warnKind(input)} onGo={go} onClose={() => setInput(null)} words={words} />;
  return { ask, warn };
}
