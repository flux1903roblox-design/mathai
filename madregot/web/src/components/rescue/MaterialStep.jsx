// "מה יהיה במבחן?" with the material in hand (EXAM-MATERIAL 1): the student pastes the teacher's message (read on the
// device by lib/examMaterial.js, no server, no AI), or, where the smart helper is connected, photographs the material
// (up to four pictures, each through PhotoWarn and PhotoPrep as an exam page is, read by the AI kind 'syllabus'). Both
// lead to the same screen: what was found, as ticked stair chips grouped by topic, one line of what could not be placed,
// and the rest of the topics to tick by hand. Nothing is decided here: the student confirms or edits, then goes on.
// Only screens/Rescue.jsx imports this file (the lazy side of the boot split, budget.json lazyOnly).
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, Check, ClipboardPaste, FileUp, Images, X } from 'lucide-react';
import { toast } from 'sonner';
import { rowStairs, earlierUnit } from '@/content/topics.js';
import { MATERIAL_MAX, ltrRuns } from '@/lib/examMaterial.js';
import { MAX_SYLLABUS_PAGES } from '@shared/ai.js';
import { MathText } from '@/components/MathText.jsx';
import { Thinking } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import SupportCard from '@/components/SupportCard.jsx';
import { usePhotoWarn, MATERIAL_WARN } from '@/components/PhotoWarn.jsx';
import PhotoPrep, { EXAM_HEADER } from '@/components/PhotoPrep.jsx';
import { pdfPages, isPdf, pdfMessage, PDF_COPY } from '@/lib/pdfPages.js';
import '@/styles/lazy/shared.css'; // the photo step's parts other screens loaded on demand draw too (COUNCIL2-20)
import '@/styles/lazy/examCheck.css'; // the pages' thumbnails and their add buttons, as the exam check draws them

export const MATERIAL_COPY = {
  card: 'יש לי את החומר למבחן',
  // where the smart helper can read pictures: any of the material; without it only what is pasted or typed is read, and
  // the card says no more than that
  cardText: 'ההודעה מהמורה, דף סיכום, דף עבודה או דף מהמחברת: מדי ימצא בהם את הנושאים, ואתם תאשרו.',
  cardTextPaste: 'מדביקים או כותבים את ההודעה מהמורה או את רשימת הנושאים, ומדי ימצא בה את הנושאים. אתם תאשרו.',
  paste: 'להדביק או לכתוב את ההודעה',
  photo: `לצלם את החומר (עד ${MAX_SYLLABUS_PAGES} תמונות)`,
  // the build with no smart helper (the public copy): no photo button, and one plain line that says what works
  pasteOnly: 'הדבקה של ההודעה עובדת כאן במכשיר, גם בלי העוזר החכם.',
  manual: 'או בוחרים את המדרגות בעצמכם',
  pasteLabel: 'ההודעה מהמורה או רשימת הנושאים',
  pasteHint: 'מדביקים כמו שזה, גם עם מילים נוספות. למשל: "המבחן על משוואות ובעיות מילוליות, בלי שאלות תנועה".',
  find: 'מה יש במבחן?',
  read: 'לקרוא את החומר',
  photoAsk: `צלמו את החומר, עד ${MAX_SYLLABUS_PAGES} תמונות: ההודעה מהמורה, דף סיכום, דף עבודה או דף מהמחברת.`,
  photoTip: 'לתמונה טובה: אור טוב, הדף שטוח וכולו בתמונה. בלי שם ובלי תעודת זהות.',
  reading: 'העוזר קורא את החומר',
  unreadable: 'לא הצלחנו לקרוא את החומר. אפשר לצלם שוב באור טוב, או להדביק את ההודעה.',
  // what the message itself leaves out ("בלי שאלות תנועה"): said, so nothing is taken away silently
  excluded: 'לפי ההודעה, בלי:',
  unknown: 'לא זיהיתי:',
  unknownTail: 'אם צריך, בחרו את המדרגות האלה בעצמכם למטה.',
  none: 'לא מצאתי בחומר נושאים של המדרגות. אפשר לבחור בעצמכם למטה.',
  examples: 'תרגילים שראיתי בחומר',
  more: 'עוד נושאים',
  less: 'להסתיר את שאר הנושאים',
};
const LIMIT = `אפשר עד ${MAX_SYLLABUS_PAGES} תמונות`;

/** "מצאתי 6 מדרגות בשני נושאים", or one of each. */
export function foundLine(n, topics) {
  const stairs = n === 1 ? 'מדרגה אחת' : <><bdi>{n}</bdi> מדרגות</>;
  const where = topics === 1 ? 'בנושא אחד' : topics === 2 ? 'בשני נושאים' : <>ב־<bdi>{topics}</bdi> נושאים</>;
  return <>מצאתי {stairs} {where}. בדקו שזה מה שיהיה במבחן, ותקנו אם צריך.</>;
}

/**
 * One topic of Exam Rescue's list: its name (the whole topic's checkbox), how many of its stairs are chosen, and a chip
 * per stair. Shared by the full list and the material's "found" screen.
 */
export function TopicRow({ t, grade, skills, onToggle, onToggleTopic }) {
  const ids = rowStairs(t).map((s) => s.id);
  const all = ids.every((x) => skills.includes(x));
  const some = ids.filter((x) => skills.includes(x)).length;
  // a topic of an earlier grade is revision and says so ("מכיתה ז׳"); Pythagoras, filed under ח׳, is taught in ז׳ too by
  // this year's programme, so for ז׳ it is simply one of theirs; a unit also on this grade's path this year
  // (learn/skills.ts ALSO_ON_PATH) is theirs too, not revision
  const earlier = earlierUnit(t, grade);
  return (
    <fieldset className={clsx('rescue-topic', `ch-${t.color}`)}>
      <legend className="visually-hidden">{t.title}</legend>
      <div className="rescue-topic-head">
        <label className="check-row topic-row"><input type="checkbox" checked={all} onChange={() => onToggleTopic(t)} /><span>{t.title}{earlier ? ` מכיתה ${t.grade === '7' ? 'ז׳' : 'ח׳'}` : ''} {t.only ? `(מה שלומדים בכיתה ${grade === '7' ? 'ז׳' : 'ח׳'})` : '(כל הנושא)'}</span></label>
        {some > 0 && <span className="rescue-topic-count">{some}/{ids.length}</span>}
      </div>
      <div className="stair-chips">
        {rowStairs(t).map(({ id, title }) => { const on = skills.includes(id); return <label key={id} className={clsx('chip-toggle', on && 'on')}><input type="checkbox" checked={on} onChange={() => onToggle(id)} />{on && <Check size={15} strokeWidth={3} aria-hidden="true" />}<span>{title}</span></label>; })}
      </div>
    </fieldset>
  );
}

/** The first choice of the question: the material. `onPhoto` is null where the smart helper cannot read pictures. */
export function MaterialCard({ onPaste, onPhoto }) {
  return (
    <section className="material-card" aria-labelledby="material-title">
      <h2 id="material-title" className="material-title">{MATERIAL_COPY.card}</h2>
      <p className="material-text">{onPhoto ? MATERIAL_COPY.cardText : MATERIAL_COPY.cardTextPaste}</p>
      <div className="material-ways">
        <button type="button" className="material-way" onClick={onPaste}><ClipboardPaste size={22} aria-hidden="true" /><span>{MATERIAL_COPY.paste}</span></button>
        {onPhoto && <button type="button" className="material-way" onClick={onPhoto}><Images size={22} aria-hidden="true" /><span>{MATERIAL_COPY.photo}</span></button>}
      </div>
      {!onPhoto && <p className="material-note">{MATERIAL_COPY.pasteOnly}</p>}
    </section>
  );
}

/** The teacher's message, pasted or typed. The form's own button reads it. */
export function PasteMaterial({ text, onText }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="field material-paste" data-region="answers">
      <label htmlFor="material-text" className="field-label">{MATERIAL_COPY.pasteLabel}</label>
      <textarea ref={ref} id="material-text" className="input material-input" rows={7} maxLength={MATERIAL_MAX} value={text}
        onChange={(e) => onText(e.target.value)} aria-describedby="material-hint" dir="auto" autoComplete="off" />
      <p id="material-hint" className="field-hint">{MATERIAL_COPY.pasteHint}</p>
    </div>
  );
}

/**
 * Pictures of the material: the camera or a picture or a PDF from the phone, up to MAX_SYLLABUS_PAGES. Every picture
 * passes PhotoPrep before it joins the list (a PDF's pages are drawn on the device first, lib/pdfPages.js), each with
 * the top band cut by default: a screenshot of the teacher's message repeats the chat's header (a name, a phone number)
 * on every picture, so the material has no "first page" the way an exam has. `pages` and `onPages` are the form's;
 * `state` is the read's.
 */
export function PhotoMaterial({ pages, onPages, state }) {
  const [queue, setQueue] = useState([]); // { id, file, pdf }
  const [opening, setOpening] = useState(false);
  const queued = useRef(0);
  const retaking = useRef(false);
  const camRef = useRef(null);
  const pickRef = useRef(null);
  const lastInput = useRef(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const { ask, warn } = usePhotoWarn(MATERIAL_WARN);
  const openInput = (el) => { if (opening) return; lastInput.current = el; ask(el); };
  const add = async (e) => {
    const files = [...(e.target.files || [])]; e.target.value = '';
    const replacing = retaking.current; retaking.current = false;
    let room = MAX_SYLLABUS_PAGES - pages.length - queue.length;
    const next = [];
    const take = (file, pdf = false) => { room -= 1; queued.current += 1; next.push({ id: queued.current, file, pdf }); };
    for (const f of files) {
      if (room <= 0) { toast(LIMIT); break; }
      if (f.type.startsWith('image/')) { take(f); continue; }
      if (!isPdf(f)) { toast.error(`לא הצלחנו לקרוא את ${f.name}`); continue; }
      setOpening(true);
      try {
        const { pages: drawn, total } = await pdfPages(f, { max: room });
        for (const page of drawn) take(page, true);
        if (total > drawn.length) { toast(LIMIT); break; }
      } catch (err) {
        toast.error(pdfMessage(err));
      } finally {
        if (mounted.current) setOpening(false);
      }
    }
    if (next.length && mounted.current) setQueue((q) => (replacing ? [...next, ...q] : [...q, ...next]));
  };
  const current = queue[0] || null;
  const shift = () => setQueue((q) => q.slice(1));
  if (state.phase === 'loading') {
    return (
      <section className="empty-state check-status material-reading" aria-live="polite" data-region="content">
        <Mascot mood="thinking" size={110} className="empty-madi" />
        <h2 className="empty-title">{MATERIAL_COPY.reading}</h2>
        <Thinking states={['קורא את התמונות', 'מוצא את הנושאים', 'מתאים אותם למדרגות']} />
      </section>
    );
  }
  return (
    <section className="material-photos" aria-labelledby="material-pages" data-region="answers">
      <p className="field-hint">{MATERIAL_COPY.photoAsk}</p>
      {state.phase === 'error' && <p className="form-error" role="alert">{state.message}</p>}
      {state.phase === 'care' && <SupportCard variant="after-message" className="exam-support" />}
      <h2 id="material-pages" className="set-head">התמונות (<bdi>{pages.length}</bdi> מתוך <bdi>{MAX_SYLLABUS_PAGES}</bdi>)</h2>
      <ul className="page-thumbs">
        {pages.map((p, i) => (
          <li key={`${p.name}-${i}`} className="page-thumb">
            <img src={p.data} alt={`תמונה ${i + 1}`} width={96} height={128} />
            <span className="page-num">{i + 1}</span>
            <button type="button" className="icon-btn page-remove" aria-label={`הסרת תמונה ${i + 1}`} onClick={() => onPages(pages.filter((_, k) => k !== i))}><X size={18} /></button>
          </li>
        ))}
        {pages.length < MAX_SYLLABUS_PAGES && (
          <>
            <li>
              <button type="button" className="page-add" onClick={() => openInput(camRef.current)} aria-disabled={opening || undefined}>
                <Camera size={26} aria-hidden="true" />
                <span>{pages.length ? 'צילום נוסף' : 'צילום'}</span>
              </button>
            </li>
            <li>
              <button type="button" className="page-add" onClick={() => openInput(pickRef.current)} aria-disabled={opening || undefined}>
                <FileUp size={26} aria-hidden="true" />
                <span>תמונה או PDF</span>
              </button>
            </li>
          </>
        )}
      </ul>
      <p className="pdf-status" role="status">{opening && <><span className="btn-spin" aria-hidden="true" />{PDF_COPY.opening}</>}</p>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={add} />
      <input ref={pickRef} type="file" accept="image/*,application/pdf" multiple className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={add} />
      <p className="field-hint">{MATERIAL_COPY.photoTip}</p>
      {warn}
      <PhotoPrep file={current?.file || null} crop={EXAM_HEADER}
        onDone={({ data, prep }) => { onPages([...pages, { data, mediaType: 'image/jpeg', name: current.file.name, prep }]); shift(); }}
        onRetake={() => { const pdf = current?.pdf; retaking.current = true; shift(); ask(pdf ? pickRef.current : lastInput.current); }} onCancel={shift}
        onError={() => { toast.error(`לא הצלחנו לקרוא את ${current?.file.name || 'התמונה'}`); shift(); }} />
    </section>
  );
}

/** Plain text with each number or expression in its own left-to-right isolate (examMaterial.js ltrRuns). */
export function LtrText({ text }) {
  return ltrRuns(text).map((r, i) => (r.ltr ? <bdi key={i} dir="ltr">{r.text}</bdi> : <span key={i}>{r.text}</span>));
}
/** Text with $...$ maths (an exercise the helper saw): the maths by MathText, the plain parts by LtrText. */
function ExampleText({ text }) {
  return String(text ?? '').split(/(\$[^$]+\$)/g).filter(Boolean).map((p, i) => (p.startsWith('$') && p.endsWith('$') && p.length > 2 ? <MathText key={i} text={p} /> : <LtrText key={i} text={p} />));
}

/**
 * What was found: the topics with a found stair, each with its chips (the found ones ticked); one line of what the
 * message leaves out ("בלי: …"); one line of what could not be placed, each piece in the text's own words as an isolate (a page range or a formula keeps its direction); for
 * pictures, a few exercises seen in them; and the rest of the topics, folded, to tick by hand.
 */
export function FoundMaterial({ found, rows, grade, skills, onToggle, onToggleTopic, titleOf }) {
  const [more, setMore] = useState(!found.byTopic.length);
  const foundIds = new Set(found.byTopic.map((r) => r.topic));
  const foundRows = rows.filter((t) => foundIds.has(t.id));
  const rest = rows.filter((t) => !foundIds.has(t.id));
  const n = found.byTopic.reduce((a, r) => a + r.skills.length, 0);
  return (
    <div className="material-found" data-region="answers">
      <p className="material-found-line" role="status">{n ? foundLine(n, found.byTopic.length) : MATERIAL_COPY.none}</p>
      {foundRows.map((t) => <TopicRow key={t.id} t={t} grade={grade} skills={skills} onToggle={onToggle} onToggleTopic={onToggleTopic} />)}
      {found.excluded?.length > 0 && (
        <p className="material-unknown material-excluded">
          <b>{MATERIAL_COPY.excluded}</b>{' '}
          {found.excluded.map((x, i) => <span key={x}>{i > 0 && ', '}<MathText text={titleOf(x)} /></span>)}.
        </p>
      )}
      {found.unknown.length > 0 && (
        <p className="material-unknown">
          <b>{MATERIAL_COPY.unknown}</b>{' '}
          {found.unknown.map((u, i) => <span key={u}>{i > 0 && ', '}<bdi className="material-piece"><LtrText text={u} /></bdi></span>)}.{' '}
          {MATERIAL_COPY.unknownTail}
        </p>
      )}
      {found.examples?.length > 0 && (
        <section className="material-examples" aria-labelledby="material-examples">
          <h2 id="material-examples" className="set-head">{MATERIAL_COPY.examples}</h2>
          <ul className="plain-list">
            {found.examples.map((x, i) => (
              <li key={i} className="material-example">
                <span className="material-example-text"><ExampleText text={x.text} /></span>
                {x.stair && <span className="material-example-stair"><MathText text={titleOf(x.stair)} /></span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {rest.length > 0 && (
        <>
          <button type="button" className="material-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? MATERIAL_COPY.less : MATERIAL_COPY.more}</button>
          {more && rest.map((t) => <TopicRow key={t.id} t={t} grade={grade} skills={skills} onToggle={onToggle} onToggleTopic={onToggleTopic} />)}
        </>
      )}
    </div>
  );
}
