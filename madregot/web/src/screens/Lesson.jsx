import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AnimatePresence, m } from 'motion/react';
import { toast } from 'sonner';
import { Lightbulb, Sparkles, Hand, NotebookPen, Keyboard, Flame, RotateCcw, Check, X, Maximize2, HelpCircle, Search } from 'lucide-react';
import { afterStrike } from '@/lib/strike.js';
import { useApp } from '@/lib/store.js';
import { TOPIC, readAnswer, answerText, itemPlain, slotsFor, itemMath, catLabel, displayTex } from '@/content/index.js';
import { manipSolution, manipWrong } from '@/content/manip.js';
import { startLesson, answer, next, withHint, progressOf, resultOf, PARTS } from '@/lib/lesson.js';
import { unitNodes } from '@/lib/path.js';
import { runAI, aiReady } from '@/lib/ai.js';
import { autoAskAllowed, gate, aiAccess, useAIStatus } from '@/lib/account.js';
import AIAllowance from '@/components/AIAllowance.jsx';
import ToolLocked from '@/components/ToolLocked.jsx';
import { api, syncNow } from '@/lib/api.js';
import { play, buzz } from '@/lib/sound.js';
import { Tex, MathText, Markdown, texText, FitDisplay } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import Manip from '@/components/manip/Manip.jsx';
import AIChat from '@/components/AIChat.jsx';
import Notebook from '@/components/Notebook.jsx';
import CheckResult from '@/components/CheckResult.jsx';
import Mascot from '@/components/Mascot.jsx';
import SupportCard from '@/components/SupportCard.jsx';
import { Box, Button, Keypad, Sheet, Steps, Thinking, useShake } from '@/components/ui.jsx';
import { detectDistress } from '@shared/safety.js';
import LessonDone, { PlacementDone } from './LessonDone.jsx';
import CheckDone from './CheckDone.jsx';
import TutorSheet from '@/components/learn/TutorSheet.jsx';
import RemedyFlow from '@/components/learn/RemedyFlow.jsx';
import { contentOf } from '@/learn/content/index.ts';
import { skillId, parseSkill } from '@/learn/skills.ts';
import { ProgressHeader, FeedbackBadge } from '@/components/lesson/LessonParts.jsx';
import { DUR, SPRING, enter } from '@/lib/motion.js';
import { useTheme } from '@/lib/theme.js';
import { HELP_IMAGE_MAX } from '@/lib/fitImage.js';

/** True while a media query matches (and follows it as the window changes). */
function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query); const f = () => setOn(mq.matches);
    mq.addEventListener?.('change', f); f();
    return () => mq.removeEventListener?.('change', f);
  }, [query]);
  return on;
}

/**
 * The hint above the answer. On a short phone it shows two lines first; the button for the rest sits under the
 * word "רמז", so it does not cost the drawing another line.
 */
function HintBox({ text, clamp }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => { setOpen(false); }, [text]);
  useEffect(() => { const el = ref.current; setMore(!!el && clamp && el.scrollHeight > el.clientHeight + 2); }, [text, clamp, open]);
  return (
    <section className="box box-hint hint-box" aria-labelledby="hint-title">
      <div className="hint-side">
        <h3 className="box-tab" id="hint-title">רמז</h3>
        {clamp && (more || open) && <button type="button" className="hint-more" aria-expanded={open} aria-controls="hint-text" onClick={() => setOpen(!open)}>{open ? 'פחות' : 'עוד'}</button>}
      </div>
      <div ref={ref} id="hint-text" className={clsx('hint-text', clamp && !open && 'clamp2')}><MathText as="p" text={text} /></div>
    </section>
  );
}

const SLOT_LABEL = { v: 'התשובה', x: 'שיעור x', y: 'שיעור y', m: 'השיפוע m', b: 'b', k: 'המקדם של x', c: 'המספר החופשי' };
/** A slot's name for a screen reader; an expression's letter may be another one than x (3n + 1). */
const slotLabel = (item, k) => (k === 'k' && item?.var ? `המקדם של ${item.var}` : SLOT_LABEL[k]);

/** An answer two misconceptions both explain: name them, and say how the lesson will tell them apart. */
function ambiguousText(topic, level, candidates) {
  const names = (candidates || []).map((c) => catLabel(topic, level, c.id)).filter(Boolean);
  if (names.length < 2) return 'עוד שאלה אחת בסוף השיעור תעזור לדעת מה בדיוק בלבל.';
  return `מה כנראה קרה: אולי ${names.join(', ואולי ')}. עוד שאלה אחת בסוף השיעור תעזור לדעת מה מהן.`;
}
const PRAISE = ['מצוין!', 'יפה מאוד!', 'בדיוק!', 'נכון!', 'כל הכבוד!'];
/**
 * Three short maths choices (< = >, 12, 43) sit side by side in large type; anything longer (2x - 10) goes in the list,
 * since three expressions in one row overflow a phone.
 */
const inlineChoices = (item) => item.choices.length === 3 && item.choices.every((c) => c.tex && c.tex.replace(/\s|\\[a-z]+/g, '').length <= 3);

/** Under an expression's two slots: what to write for x alone, for −x and for no constant. */
const LIN_NOTE = (v) => `$${v}$ בלי מספר לפניו: המקדם $1$, ו־$-${v}$: המקדם $-1$. אין מספר חופשי? כתבו $0$.`;

function AnswerSlots({ item, slots, setSlots, active, setActive, locked, shakeKey, onEnter, struck, unstrike, good }) {
  const shakeRef = useShake(shakeKey);
  const names = slotsFor(item);
  const input = (k, extra = {}) => (
    <input
      key={k} id={`slot-${k}`} dir="ltr" inputMode="none" autoComplete="off" spellCheck={false}
      className={clsx('slot', active === k && !struck && !locked && 'active', struck && 'struck', good && 'good')}
      aria-label={struck ? `${slotLabel(item, k)}, התשובה הקודמת: ${slots[k] || ''}. כתבו תשובה חדשה` : slotLabel(item, k)} placeholder={extra.ph || '?'}
      value={slots[k] || ''} readOnly={locked}
      onFocus={() => setActive(k)}
      onChange={(e) => {
        const typed = e.target.value.replace(/[^\d\-−./,]/g, '').slice(0, 9);
        if (struck) { unstrike(); setSlots({ [k]: afterStrike(slots[k], typed) }); return; }
        setSlots({ ...slots, [k]: typed });
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
    />
  );
  return (
    <div className="answer" ref={shakeRef}>
      <div className="answer-row" dir="ltr">
        {item.form === 'pt' && (<><span className="answer-lab"><Tex tex={`${item.label ?? 'P'}\\,(`} /></span>{input('x', { ph: 'x' })}<span className="answer-lab">,</span>{input('y', { ph: 'y' })}<span className="answer-lab">)</span></>)}
        {item.form === 'line' && (<><span className="answer-lab"><Tex tex="y =" /></span>{input('m', { ph: 'm' })}<span className="answer-lab"><Tex tex="x\,+" /></span>{input('b', { ph: 'b' })}</>)}
        {/* an expression: the coefficient, the letter, the constant (□x + □) */}
        {item.form === 'lin' && (<>{input('k')}<span className="answer-lab"><Tex tex={`${item.var || 'x'}\\,+`} /></span>{input('c')}</>)}
        {item.form === 'num' && (<>{item.label && <span className="answer-lab"><Tex tex={item.label} /></span>}{input('v')}</>)}
      </div>
      {item.unit && <span className="answer-unit">{item.unit}</span>}
      {item.form === 'line' && <p className="answer-note">b שלילי? כותבים מינוס בתיבה. שבר כותבים כך: 3/4</p>}
      {item.form === 'lin' && <MathText as="p" className="answer-note" text={LIN_NOTE(item.var || 'x')} />}
      {names.length > 0 && <span className="visually-hidden" aria-live="polite">{`השדה הפעיל: ${slotLabel(item, active) || ''}`}</span>}
    </div>
  );
}

/** Which lesson a route asks for: /lesson/:topic/:level?kind=&part= or the older /practice/:topic?level= */
function useLessonSpec() {
  const { topic: tParam, id, level: lParam } = useParams();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const { path, progress, profile } = useApp.getState();
  if (pathname === '/placement') return { kind: 'placement', grade: ['7', '8'].includes(params.get('grade')) ? params.get('grade') : profile?.grade || '7', know: profile?.know ?? 1 };
  // Exam Rescue: the diagnostic and the practice exam run over the exam's stairs
  if (pathname === '/rescue/check' || pathname === '/rescue/exam') {
    const ex = useApp.getState().learn?.exam;
    if (!ex?.skills?.length) return null;
    const first = parseSkill(ex.skills[0]);
    return { kind: 'check', purpose: pathname.endsWith('exam') ? 'exam' : 'diagnostic', skills: ex.skills, topic: first.topic, level: first.level };
  }
  const topic = tParam || id;
  if (!TOPIC[topic]) return null;
  if (params.get('kind') === 'check') {
    const lv = Math.min(Math.max(Number(lParam) || 1, 1), TOPIC[topic].levels.length);
    const purpose = ['mastery', 'review', 'verify'].includes(params.get('purpose')) ? params.get('purpose') : 'mastery';
    return { kind: 'check', purpose, skill: skillId(topic, lv), misc: purpose === 'verify' ? params.get('misc') : null, topic, level: lv };
  }
  const kind = ['review', 'jump'].includes(params.get('kind')) ? params.get('kind') : 'node';
  const nodes = unitNodes(topic, path);
  const current = nodes.find((n) => n.kind === 'node' && n.state === 'current');
  const level = Number(lParam || params.get('level')) || current?.level || TOPIC[topic].levels.length;
  const node = nodes.find((n) => n.kind === 'node' && n.level === level);
  const part = Number(params.get('part')) || (node?.state === 'done' ? PARTS : Math.min(PARTS, (node?.parts || 0) + 1));
  const max = progress[topic]?.max || level;
  return { kind, topic, level, part, max, fromPlan: params.get('from') === 'plan', fromJourney: params.get('from') === 'journey' };
}

export default function Lesson() {
  const spec = useLessonSpec();
  const navigate = useNavigate();
  const st = useApp();
  const [s, setS] = useState(() => (spec ? startLesson(spec) : null));
  const [slots, setSlots] = useState({});
  const [choice, setChoice] = useState(null);
  const [struck, setStruck] = useState(false);
  const [active, setActive] = useState('v');
  const [shakeKey, setShakeKey] = useState(0);
  const [last, setLast] = useState(null);
  const [explain, setExplain] = useState({ state: 'idle', text: '' });
  const [showSteps, setShowSteps] = useState(false);
  const [guide, setGuide] = useState(false); // "איך מתחילים?": the first step of the solution, after a first miss
  const [chatOpen, setChatOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const leaving = useRef(false);
  // While a lesson is under way (open, not finished), Back asks first, exactly like the close button.
  const underway = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => underway.current && !leaving.current && currentLocation.pathname !== nextLocation.pathname);
  // Each time the question opens it is a fresh dialog: reopening one that is still closing (a quick second
  // back press) could otherwise leave it hidden while the lesson waits for an answer.
  const [exitKey, setExitKey] = useState(0);
  const askExit = () => { setExitKey((k) => k + 1); setExitOpen(true); };
  // Every blocked back press is a new blocker object: react to each one, even when "stay" and the next
  // back press land in the same render (blocked, reset, blocked again).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (blocker.state === 'blocked') askExit(); }, [blocker]);
  const stay = () => { setExitOpen(false); if (blocker.state === 'blocked') blocker.reset(); };
  const leave = (to, opts) => {
    leaving.current = true; setExitOpen(false); syncNow();
    if (blocker.state === 'blocked') blocker.proceed(); else navigate(to, opts);
  };
  const [combo, setCombo] = useState(null);
  // How each exercise went, for the steps in the header: first | fixed | shown | redone (by slot)
  const [marks, setMarks] = useState([]);
  const [done, setDone] = useState(null); // { result, award } once the lesson ends
  const [nbOn, setNbOn] = useState(false);
  const [pages, setPages] = useState({});
  const [nbCheck, setNbCheck] = useState({ state: 'idle' });
  const [zoom, setZoom] = useState(false); // the drawing, enlarged in a sheet (small phones)
  const [chat, setChat] = useState([]); // the tutor conversation about this exercise
  // Short phones: the hint opens as two lines, and typed answers get the compact bottom (see `compact`).
  const short = useMedia('(max-height: 700px) and (max-width: 899px)');
  const nbRef = useRef(null);
  const qRef = useRef(null);
  const nbResRef = useRef(null);
  const item = s?.item;
  // A placement test moves across topics: the colours and the misconceptions follow the question.
  const t = spec ? TOPIC[item?.topic || spec.topic] : null;
  const placement = spec?.kind === 'placement';
  const isTest = (k) => k === 'jump' || k === 'placement' || k === 'check'; // a check, not practice: one try, no hints
  const isCheck = spec?.kind === 'check';
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorIntent, setTutorIntent] = useState(null); // Madi's sheet opened on a question already asked (the mistake)
  const [remedy, setRemedy] = useState(null); // a misconception's repair, opened from the feedback
  // what the tutor can do here today (the free taste, a plan, a class licence): the buttons follow it
  const aiStatus = useAIStatus((x) => x.status);
  const explainState = aiAccess('explain', aiStatus).state;
  const chatState = aiAccess('chat', aiStatus).state;
  // when the tutor is done for today, Madi explains the mistake instead (no request)
  const askMadi = () => { setChatOpen(false); setTutorIntent(s?.wrong?.length ? 'mistake' : null); setTutorOpen(true); };
  const names = item ? slotsFor(item) : [];
  // An interactive exercise: the state of the object the student moves. It belongs to one exercise, so a new
  // exercise starts from its own starting state even before the reset effect runs (the shapes differ by kind).
  const mkey = item ? `${item.key}:${s.slot}` : null;
  const [mvs, setMvs] = useState({ key: null, v: null, touched: false });
  const isManip = item?.form === 'manip';
  const mv = isManip ? (mvs.key === mkey ? mvs.v : item.manip.start ?? null) : null;
  const touched = isManip && mvs.key === mkey && mvs.touched;

  useEffect(() => {
    if (!item) return;
    setSlots({}); setChoice(null); setStruck(false); setActive(names[0] || 'v'); setExplain({ state: 'idle', text: '' }); setShowSteps(false); setGuide(false); setNbCheck({ state: 'idle' }); setZoom(false); setChat([]);
    qRef.current?.focus({ preventScroll: true });
    qRef.current?.scrollTo?.({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key, s?.slot]);


  // Test hook for automated checks: the current exercise (with its answer) as window.__madregotItem and, for tools
  // that run their scripts in an isolated context and cannot see page variables, as JSON in <html data-qa-item>.
  // On in a QA build (VITE_QA_HOOKS=1, the staging copy); elsewhere only with localStorage 'madregot-debug' set.
  useEffect(() => {
    let on = import.meta.env.VITE_QA_HOOKS === '1';
    try { on = on || !!localStorage.getItem('madregot-debug'); } catch { /* storage blocked */ }
    if (!on) return undefined;
    window.__madregotItem = item;
    // __madregotSolve(true) puts an interactive exercise in a right state, (false) in a near miss
    window.__madregotSolve = (ok = true) => {
      if (item?.form !== 'manip') return false;
      setMvs({ key: mkey, v: ok ? manipSolution(item) : manipWrong(item), touched: true }); setStruck(false);
      return true;
    };
    const root = document.documentElement;
    try { root.setAttribute('data-qa-item', JSON.stringify(item ?? null)); } catch { /* not serialisable */ }
    return () => root.removeAttribute('data-qa-item');
  }, [item, mkey]);

  const focusSlot = useCallback((k) => { document.getElementById(`slot-${k}`)?.focus({ preventScroll: true }); }, []);

  // the learning record: a lesson or a check started (for the outcome metrics, on this device only)
  useEffect(() => { if (spec && !placement) useApp.getState().learnEvent({ e: 'lesson-start', s: skillId(spec.topic, spec.level), p: spec.kind === 'check' ? spec.purpose : spec.kind }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aiContext = () => ({
    grade: t.grade, topic: t.title, level: item.levelTitle, question: itemPlain(item),
    correct: answerText(item), studentAnswer: s.wrong.map((w) => answerText(item, w)).join(' ; '), attempts: s.attempt,
  });

  const askExplain = async () => {
    setExplain({ state: 'loading', text: '' });
    try { const r = await runAI('explain', aiContext(), { onMadi: askMadi }); setExplain({ state: 'done', text: r.text, care: r.care === true }); } catch (e) { setExplain(e.limit ? { state: 'idle', text: '' } : { state: 'error', text: e.message }); }
  };

  const commit = (event) => {
    st.recordAnswer(event, 0);
    if (st.profile?.token && useApp.getState().outbox.length >= 5) syncNow();
  };

  const onKey = (k) => {
    if (s.phase !== 'answer' && s.phase !== 'retry') return;
    const base = struck ? {} : slots;
    if (struck) setStruck(false);
    const cur = base[active] || '';
    let v = cur;
    if (k === 'del') v = cur.slice(0, -1);
    else if (k === '-') v = cur.startsWith('-') ? cur.slice(1) : `-${cur}`;
    else if (cur.length < 9) v = cur + k;
    setSlots({ ...base, [active]: v });
    focusSlot(active);
  };

  // Two answer fields (a point, a line): the keypad's last key moves to the other one.
  const nextSlot = () => { const k = names[(names.indexOf(active) + 1) % names.length]; setActive(k); focusSlot(k); };

  const canCheck = item && (item.form === 'mc' ? choice != null : isManip ? touched && !struck && mv != null : !struck && names.every((k) => String(slots[k] || '').trim()));

  const check = () => {
    if (!item || !canCheck || (s.phase !== 'answer' && s.phase !== 'retry')) return;
    const u = item.form === 'mc' ? choice : isManip ? mv : readAnswer(item, slots);
    if (u == null) {
      const missing = names.find((k) => !String(slots[k] || '').trim()) || names[0];
      setLast({ invalid: true, text: item.form === 'pt' ? 'מלאו את שני השיעורים.' : item.form === 'line' ? 'מלאו את m ואת b.' : item.form === 'lin' ? 'מלאו את המקדם ואת המספר החופשי.' : 'כתבו מספר. מינוס יש במקלדת.' });
      setShakeKey((v) => v + 1); setActive(missing); focusSlot(missing);
      return;
    }
    const { s: ns, result } = answer(s, u);
    if (!placement && (result.ok || result.reveal)) {
      setMarks((mk) => {
        const out = [...mk];
        if (s.slot < s.total) out[s.slot] = result.ok ? (result.first ? 'first' : 'fixed') : 'shown';
        else if (result.ok) { const k = out.indexOf('shown'); if (k >= 0) out[k] = 'redone'; } // a returned exercise, solved
        return out;
      });
    }
    setLast({ ...result, praise: PRAISE[Math.floor(Math.random() * PRAISE.length)] });
    if (result.ok) { play('correct'); commit(result.event); }
    else {
      play('wrong'); buzz(40); setShakeKey((v) => v + 1);
      if (result.reveal) {
        commit(result.event);
        if (item.form !== 'mc') setStruck(true);
        // The second miss is the moment help matters most: ask the tutor without waiting to be asked.
        // (only when that is not one of the few free questions: on the free taste the student chooses when to ask)
        if (aiReady() && !isTest(ns.kind) && autoAskAllowed() && aiAccess('explain').state === 'open') setTimeout(() => askExplainFor(ns), 0);
      }
      if (result.retry) { setStruck(true); setActive(names[0] || 'v'); if (item.form === 'mc') setChoice(null); if (result.event) st.noteLearn(result.event); }
    }
    setS(ns);
  };
  const askExplainFor = async (ns) => {
    setExplain({ state: 'loading', text: '' });
    try {
      const r = await runAI('explain', { ...aiContext(), studentAnswer: ns.wrong.map((w) => answerText(ns.item, w)).join(' ; ') }, { onMadi: askMadi });
      setExplain({ state: 'done', text: r.text, care: r.care === true });
    } catch (e) { setExplain(e.limit ? { state: 'idle', text: '' } : { state: 'error', text: e.message }); }
  };

  const finish = (ns) => {
    const result = resultOf(ns);
    const app = useApp.getState();
    const award = placement ? app.completePlacement(result) : isCheck ? app.completeCheck(result) : app.completeLesson(result, { fromPlan: spec.fromPlan });
    // a finished activity completes its item of today's mission
    if (!placement && result.topic && result.level) {
      const kindOf = { mastery: 'mastery', review: 'review', verify: 'repair', diagnostic: 'exam', exam: 'exam' };
      // practice (stage D) or a check: each completes only the mission item it is
      (result.skills || [skillId(result.topic, result.level)]).forEach((sk) => app.completeMission({ skill: sk, kind: isCheck ? kindOf[result.purpose] : 'continue', stage: isCheck ? (result.purpose === 'mastery' ? 'E' : undefined) : result.kind === 'node' ? 'D' : undefined, misc: result.misc || undefined }));
      app.learnEvent({ e: 'lesson-done', s: skillId(result.topic, result.level), p: isCheck ? result.purpose : result.kind, ok: result.passed });
    }
    syncNow();
    play(result.passed ? 'complete' : 'wrong');
    setDone({ result, award });
  };

  const tryAgain = () => {
    setLast(null);
    if (isManip) requestAnimationFrame(() => qRef.current?.querySelector('.manip-canvas[tabindex="0"], .manip .step-btn:not(:disabled)')?.focus({ preventScroll: true }));
    else focusSlot(active);
  };
  const goOn = () => {
    if (s.phase === 'retry') { tryAgain(); return; }
    const mark = last?.comboMark;
    const ns = next(s);
    setLast(null);
    if (ns.finished) { finish(ns); return; }
    setS(ns);
    if (mark) { setCombo(mark); play('combo'); setTimeout(() => setCombo(null), 1400); }
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (done || chatOpen || helpOpen || exitOpen || tutorOpen || remedy) return;
      // A computer keyboard types into the answer even when the focus is elsewhere on the screen.
      const tag = document.activeElement?.tagName;
      // Enter goes on from the feedback, unless it is pressing another button there ("the next step", "how to solve")
      const innerButton = tag === 'BUTTON' && !document.activeElement.closest('.fb-actions');
      if (e.key === 'Enter' && last && !last.invalid && !innerButton) { e.preventDefault(); goOn(); return; }
      if (e.key === 'Enter' && !last && canCheck && !['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(tag)) { e.preventDefault(); check(); return; }
      // the numbers printed on the choices pick them
      if (item?.form === 'mc' && /^[1-9]$/.test(e.key) && tag !== 'INPUT' && tag !== 'TEXTAREA' && !locked) {
        const n = Number(e.key) - 1;
        if (n < item.choices.length && !s.wrong.includes(n)) { e.preventDefault(); setChoice(n); if (feedback === 'retry') setLast(null); }
        return;
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey || !item || item.form === 'mc' || isManip || nbOn) return;
      const k = /^[0-9./]$/.test(e.key) ? e.key : e.key === '-' ? '-' : e.key === 'Backspace' ? 'del' : null;
      if (k) { e.preventDefault(); onKey(k); }
    };
    window.addEventListener('keydown', onDoc);
    return () => window.removeEventListener('keydown', onDoc);
  });

  // Once the right choice is marked, it is brought into view: on a small phone the feedback panel
  // shrinks the maths region and the choice could otherwise sit below its fold.
  const marked = !!(last && !last.invalid && (last.ok || s?.phase !== 'retry') && item?.form === 'mc');
  useEffect(() => {
    if (marked) qRef.current?.querySelector('.choice.good')?.scrollIntoView?.({ block: 'nearest' });
  }, [marked]);
  // After checking, the focus goes to the feedback's button, so a keyboard or a screen reader is where the action is.
  const fbKey = last && !last.invalid ? `${item?.key}:${s?.phase}:${last.ok}` : null;
  useEffect(() => {
    if (fbKey) requestAnimationFrame(() => document.querySelector('section.fb .fb-actions .btn')?.focus({ preventScroll: true }));
  }, [fbKey]);
  // Arrow keys move between the choices (one tab stop for the group, as a radio group should be).
  const onChoiceKeys = (e) => {
    // Enter on the chosen answer checks it (as Enter in an answer field does)
    if (e.key === 'Enter' && !last && choice != null) { e.preventDefault(); e.stopPropagation(); check(); return; }
    const dir = { ArrowDown: 1, ArrowLeft: 1, ArrowUp: -1, ArrowRight: -1 }[e.key];
    if (!dir || !item || item.form !== 'mc' || locked) return;
    e.preventDefault();
    const open = item.choices.map((_, i) => i).filter((i) => !s.wrong.includes(i));
    const at = open.indexOf(choice ?? open[0]);
    const nextI = open[(at + dir + open.length) % open.length];
    setChoice(nextI); if (feedback === 'retry') setLast(null);
    qRef.current?.querySelectorAll('.choice')[nextI]?.focus();
  };

  // The notebook check (waiting, result or error) appears under the notebook: bring it into view.
  useEffect(() => {
    if (nbCheck.state === 'idle') return;
    const el = nbResRef.current; const box = qRef.current;
    if (el && box) box.scrollTo({ top: Math.max(0, box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 12), behavior: 'smooth' });
  }, [nbCheck.state]);

  const checkWork = async () => {
    // the photo check is the full tutor's: on the free taste its info state shows instead (and the teacher is one tap away)
    const g = gate('check', { onMadi: askMadi });
    if (g === 'locked' || g === 'economy') { setNbCheck({ state: 'locked', kind: g }); return; }
    if (g) return;
    const image = nbRef.current?.toImage();
    if (!image) { setNbCheck({ state: 'error', message: 'כתבו קודם את הדרך במחברת.' }); return; }
    setNbCheck({ state: 'loading' });
    try { const r = await runAI('check', { ...aiContext(), image, mediaType: 'image/jpeg' }, { onMadi: askMadi }); setNbCheck({ state: 'done', r }); } catch (e) { setNbCheck(e.limit ? { state: 'idle' } : { state: 'error', message: e.message }); }
  };

  underway.current = !!(spec && t && !done);
  if (!spec || !t) {
    return (
      <div className="page not-found">
        <Mascot mood="oops" size={96} />
        <h1 className="h-page">השיעור הזה לא נמצא</h1>
        <p className="muted">אולי הקישור ישן. כל השיעורים מחכים במפה.</p>
        <Button className="btn-block btn-lg" onClick={() => navigate('/', { replace: true })}>חזרה למפה</Button>
      </div>
    );
  }
  // white while learning (exercises, graphs), black for the result screens that follow
  useTheme(done ? 'dark' : 'light');
  if (done) leaving.current = true; // the end screens lead back to the map without asking
  if (done && placement) return <PlacementDone {...done} onExit={() => navigate('/topics', { replace: true, state: { placed: true } })} />;
  if (done && isCheck) return <CheckDone result={done.result} award={done.award} onExit={() => navigate('/', { replace: true, preventScrollReset: true, state: done.award?.stairDone ? { from: spec.topic, nodeDone: true } : undefined })} />;
  if (done) return <LessonDone {...done} topic={t} onExit={() => (spec.fromJourney ? navigate(`/learn/${spec.topic}/${spec.level}`, { replace: true }) : navigate('/', { replace: true, preventScrollReset: true, state: { from: spec.topic, nodeDone: !!done.award.unitDone } }))} onAgain={() => { setDone(null); setMarks([]); setS(startLesson(spec)); }} />;

  const feedback = last && !last.invalid ? (last.ok ? 'good' : s.phase === 'retry' ? 'retry' : 'reveal') : null;
  const inClass = !!st.profile?.token;
  const page = pages[item.key] || { strokes: [], height: 420 };
  const setPage = (patch) => setPages((all) => ({ ...all, [item.key]: { ...page, ...patch } }));
  const locked = feedback === 'good' || feedback === 'reveal';
  const pct = Math.round(progressOf(s) * 100);

  // מדי follows the work: curious while the student experiments with the object, then glad or encouraging
  const mood = feedback === 'good' ? 'happy' : feedback ? 'encouraging' : s.hint || nbOn || touched ? 'thinking' : 'idle';
  const onManip = (v) => { setMvs({ key: mkey, v, touched: true }); if (struck) setStruck(false); if (feedback === 'retry') setLast(null); };
  const stage = `${s.slot}-${item.key}`;
  // Each exercise slides in from the reading side; the last one leaves the other way.
  const slide = { initial: { opacity: 0, x: -28 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 28 }, transition: enter(0.2) };
  const typed = item.form !== 'mc' && !isManip && !nbOn;
  // On a short phone a typed answer gets the room it needs: the check button joins the answer row and the help
  // buttons move up beside the progress bar, so the drawing keeps the height of a whole row.
  const compact = short && typed;
  const tools = (
    <div className="tools" role="group" aria-label="עזרה">
      {!isTest(s.kind) && <button type="button" className={clsx('tool', s.hint && 'on')} onClick={() => setS(withHint(s))} disabled={s.hint} aria-pressed={!!s.hint} aria-label="רמז"><Lightbulb size={20} aria-hidden="true" /><span className="tool-label">רמז</span></button>}
      {!isTest(s.kind) && <button type="button" className="tool" aria-label="שאלה למדי" onClick={() => setTutorOpen(true)}><HelpCircle size={20} aria-hidden="true" /><span className="tool-label">מדי</span></button>}
      {aiReady() && !isTest(s.kind) && <button type="button" className="tool ai" aria-label="שאלו את העוזר" onClick={() => setChatOpen(true)}><Sparkles size={20} aria-hidden="true" /><span className="tool-label">העוזר</span></button>}
      <button type="button" className={clsx('tool', nbOn && 'on')} aria-pressed={nbOn} aria-label={nbOn ? 'תשובה' : 'מחברת'} onClick={() => setNbOn(!nbOn)}>{nbOn ? <Keyboard size={20} aria-hidden="true" /> : <NotebookPen size={20} aria-hidden="true" />}<span className="tool-label">{nbOn ? 'תשובה' : 'מחברת'}</span></button>
      {inClass && <button type="button" className="tool" aria-label="למורה" onClick={() => setHelpOpen(true)}><Hand size={20} aria-hidden="true" /><span className="tool-label">למורה</span></button>}
    </div>
  );
  const checkButton = <Button className="check-btn btn-lg" onClick={check} disabled={!canCheck}>בדיקה</Button>;
  // The question stays pinned on top, as in a Duolingo exercise: a short instruction is the screen's bold title
  // ("חשבו:"); a longer one (a word problem) is said by מדי in a speech bubble beside him. The drawing below fits
  // whatever room is left.
  const talk = (item.text || '').length > 64;
  const question = talk ? (
    <div className="lesson-q is-talk" data-region="question">
      <h1 className="qtext q-bubble" id="qtext"><MathText text={item.text} /></h1>
    </div>
  ) : (
    <div className="lesson-q is-title" data-region="question">
      <h1 className="qtext q-title" id="qtext"><MathText text={item.text} /></h1>
    </div>
  );

  return (
    <div className={clsx('lesson', `ch-${t.color}`, feedback && 'fb-open', typed && 'is-typed', isManip && !nbOn && 'is-manip')}>
      {/* top: progress and the question, always on screen */}
      <header className="lesson-head" data-region="header">
        <ProgressHeader extra={tools} pct={pct} marks={placement ? null : marks} total={s.total} label={placement ? 'התקדמות בבדיקת הרמה' : isCheck ? 'התקדמות בבדיקה' : 'התקדמות בשיעור'} onExit={askExit} combo={s.combo} topic={placement ? t.title : null} />
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={stage} className="q-pin" {...slide}>{question}</m.div>
        </AnimatePresence>
      </header>

      {/* middle: the maths (expression, drawing, table, choices); the only part that scrolls */}
      <main className="lesson-main" ref={qRef} tabIndex={-1} aria-labelledby="qtext" data-region="content">
        <AnimatePresence mode="wait" initial={false}>
        <m.div key={stage} className="q-stage" {...slide}>
        {item.redo && <p className="redo-note"><RotateCcw size={16} aria-hidden="true" />תרגיל דומה לזה שהיה קשה קודם</p>}
        {item.extra && <p className="redo-note"><Search size={16} aria-hidden="true" />עוד שאלה אחת, כדי להבין מה בדיוק בלבל</p>}
        {item.display && <FitDisplay tex={displayTex(item)} />}
        {item.fig && (
          <div className="fig-zoomable">
            <Figure fig={item.fig} />
            {item.fig.type !== 'table' && (
              <button type="button" className="fig-zoom" aria-label="הגדלת השרטוט" onClick={() => setZoom(true)}><Maximize2 size={18} aria-hidden="true" /></button>
            )}
          </div>
        )}
        {isManip && !nbOn && <Manip item={item} value={mv} onChange={onManip} locked={locked} reveal={feedback === 'reveal'} good={feedback === 'good'} touched={touched} mood={mood} hint={!!s.hint} test={isTest(s.kind)} />}
        {item.form === 'mc' && (
          <div className={clsx('choices', inlineChoices(item) && 'inline')} role="radiogroup" aria-label="אפשרויות" onKeyDown={onChoiceKeys} data-region="answers">
            {item.choices.map((c, i) => {
              const state = locked && i === item.answer ? 'good' : (feedback && choice === i && i !== item.answer) || s.wrong.includes(i) ? 'bad' : '';
              return (
                <m.button key={i} type="button" role="radio" aria-checked={choice === i} tabIndex={(choice ?? item.choices.findIndex((_, k) => !s.wrong.includes(k))) === i ? 0 : -1} aria-label={c.tex ? texText(c.tex) : undefined} className={clsx('choice', choice === i && 'on', state)}
                  whileTap={locked ? undefined : { scale: 0.96 }} animate={state === 'good' ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}
                  disabled={locked || s.wrong.includes(i)} onClick={() => { setChoice(i); play('tap'); if (feedback === 'retry') setLast(null); }}>
                  <span className="choice-key" aria-hidden="true">{state === 'good' ? <Check size={18} strokeWidth={3.4} /> : state === 'bad' ? <X size={18} strokeWidth={3.4} /> : i + 1}</span>
                  <span className="choice-text">{c.tex ? <Tex tex={c.tex} /> : c.text}</span>
                </m.button>
              );
            })}
          </div>
        )}
        {nbOn && (
          <>
            <Notebook ref={nbRef} strokes={page.strokes} onStrokes={(strokes) => { setPage({ strokes }); if (nbCheck.state !== 'loading') setNbCheck({ state: 'idle' }); }} height={page.height} onGrow={() => setPage({ height: page.height + 240 })} />
            <p className="nb-note">כתבו את הדרך כמו במחברת. כשמסיימים, חוזרים ל"תשובה" וכותבים את התוצאה.</p>
            {aiReady() && <Button variant="ai" className="btn-sm" onClick={checkWork} disabled={nbCheck.state === 'loading' || !page.strokes.length}><Sparkles size={16} aria-hidden="true" />בדיקת הדרך עם העוזר</Button>}
            <div className="nb-anchor" ref={nbResRef} aria-hidden="true" />
            {nbCheck.state === 'loading' && <Box tone="ai" title="בדיקת הדרך"><Thinking states={['קורא את מה שכתבתם', 'בודק כל שורה', 'מסכם']} /></Box>}
            {nbCheck.state === 'error' && <p className="form-error" role="alert">{nbCheck.message}</p>}
            {nbCheck.state === 'done' && <CheckResult r={nbCheck.r} />}
            {nbCheck.state === 'done' && nbCheck.r?.care && <SupportCard variant="after-message" />}
            {nbCheck.state === 'locked' && <ToolLocked kind="check" state={nbCheck.kind} compact onTeacher={inClass ? () => setHelpOpen(true) : undefined} />}
          </>
        )}
        </m.div>
        </AnimatePresence>
      </main>

      {/* bottom: the answer row, then the keypad and the check button (or the feedback that replaces them) */}
      <div className="lesson-foot" data-region="footer">
        {/* the hint sits above the answer, on the first try and again on the second; the drawing above makes room */}
        <AnimatePresence>
          {s.hint && (s.phase === 'answer' || s.phase === 'retry') && !feedback && (
            <m.div key="hint" className="hint-bar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={enter(DUR.fast)}>
              <HintBox text={item.hint} clamp={short} />
            </m.div>
          )}
        </AnimatePresence>
        {typed && (
          <div className={clsx('answer-bar', compact && 'with-check')} data-region="answers">
            <AnswerSlots item={item} slots={slots} setSlots={(v) => { setSlots(v); if (feedback === 'retry') setLast(null); }} active={active} setActive={setActive} locked={locked} shakeKey={shakeKey} onEnter={() => (feedback ? goOn() : check())} struck={struck} unstrike={() => setStruck(false)} good={feedback === 'good'} />
            {compact && !feedback && checkButton}
          </div>
        )}
        {last?.invalid && <p className="form-error answer-error" role="alert">{last.text}</p>}
        {feedback ? (
          <m.section className={clsx('fb', `fb-${feedback}`)} aria-live="assertive" aria-labelledby="fb-title" data-region="feedback"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={SPRING.settle}>
            <div className="fb-scroll">
              <div className="fb-head">
                <FeedbackBadge good={feedback === 'good'} />
                <h2 id="fb-title" className="fb-title">{feedback === 'good' ? (last.first ? last.praise : 'יפה, תיקנתם!') : feedback === 'retry' ? 'עוד לא. נסו שוב' : 'התשובה הנכונה:'}</h2>
                {feedback === 'good' && s.combo >= 2 && <span className="fb-combo"><Flame size={16} aria-hidden="true" />{s.combo} ברצף</span>}
              </div>
              {feedback === 'retry' && (
                <div className="fb-body">
                  {last?.cat && catLabel(item.topic || spec.topic, item.level, last.cat) && !last.diagnosis?.ambiguous && <p><MathText text={`מה כנראה קרה: ${catLabel(item.topic || spec.topic, item.level, last.cat)}.`} /></p>}
                  {last?.diagnosis?.ambiguous && <p><MathText text={ambiguousText(item.topic || spec.topic, item.level, last.diagnosis.candidates)} /></p>}
                  {!isTest(s.kind) && last?.cat && !last.diagnosis?.ambiguous && contentOf(skillId(item.topic || spec.topic, item.level))?.misconceptions.some((x) => x.id === last.cat) && (
                    <button type="button" className="link-btn" onClick={() => setRemedy(last.cat)}>בואו נראה את זה אחרת</button>
                  )}
                  <p className="hint-line"><Lightbulb size={16} aria-hidden="true" /><MathText text={item.hint} /></p>
                  {/* guide, don't just say "again": the first step of the way, never the whole solution */}
                  {item.solution?.length > 1 && !isTest(s.kind) && (guide ? (
                    <ol className="stair-list guide-step" aria-live="polite"><li className="stair-step" style={{ '--i': 0 }}><span className="stair-n" aria-hidden="true">1</span><span className="stair-text"><MathText text={item.solution[0]} /></span></li></ol>
                  ) : (
                    <button type="button" className="link-btn" onClick={() => setGuide(true)}>איך מתחילים?</button>
                  ))}
                </div>
              )}
              {feedback === 'reveal' && (
                <div className="fb-body">
                  <p className="fb-answer">{/[\u0590-\u05FF]/.test(answerText(item)) ? answerText(item) : <Tex tex={answerText(item)} />}</p>
                  {placement ? <p className="fb-note">זה בסדר. כך יודעים מאיפה להתחיל בנושא הזה.</p> : <Steps steps={item.solution} stepwise />}
                  {explain.state === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={['בודק את התשובה שלכם', 'מחפש איפה זה התפספס', 'מנסח הסבר']} /></Box>}
                  {explain.state === 'done' && <Box tone="ai" title="העוזר"><Markdown>{explain.text}</Markdown></Box>}
                  {explain.state === 'done' && explain.care && <SupportCard variant="after-message" />}
                  {explain.state === 'error' && <p className="form-error" role="alert">{explain.text}</p>}
                  {explain.state === 'idle' && !isTest(s.kind) && ['free', 'open'].includes(explainState) && (
                    <>
                      <Button variant="ai" className="btn-sm" onClick={askExplain}><Sparkles size={16} aria-hidden="true" />למה טעיתי?</Button>
                      <AIAllowance />
                    </>
                  )}
                  {explain.state === 'idle' && !isTest(s.kind) && ['used', 'paused', 'resting'].includes(explainState) && (
                    <Button variant="secondary" className="btn-sm" onClick={askMadi}><HelpCircle size={16} aria-hidden="true" />שאלה למדי</Button>
                  )}
                  {!isTest(s.kind) && <p className="fb-note">תרגיל דומה יחזור בסוף השיעור.</p>}
                  {!isTest(s.kind) && last?.cat && contentOf(skillId(item.topic || spec.topic, item.level))?.misconceptions.some((x) => x.id === last.cat) && (
                    <button type="button" className="link-btn" onClick={() => setRemedy(last.cat)}>בואו נראה את זה אחרת</button>
                  )}
                </div>
              )}
              {feedback === 'good' && (
                <div className="fb-body">
                  <button type="button" className="link-btn" onClick={() => setShowSteps(!showSteps)} aria-expanded={showSteps}>{showSteps ? 'להסתיר את הפתרון' : 'איך פותרים?'}</button>
                  {showSteps && <Steps steps={item.solution} stepwise />}
                </div>
              )}
            </div>
            <div className="fb-actions">
              <Button variant={feedback === 'good' ? 'good' : 'bad'} className="btn-block btn-lg" onClick={goOn} autoFocus>
                {feedback === 'retry' ? 'לנסות שוב' : feedback === 'good' ? 'המשך' : 'הבנתי'}
              </Button>
            </div>
          </m.section>
        ) : (
          <div className="lesson-dock">
            {/* as in Duolingo's maths exercises: the full-width check button sits right above the number pad, and the
                pad fills the bottom of the screen; help sits in the top bar, where Duolingo keeps its counter */}
            {!compact && <div className="dock-row" data-region="primary">{checkButton}</div>}
            {typed && <div className="pad-panel"><Keypad onKey={onKey} onNext={names.length > 1 ? nextSlot : undefined} nextLabel={`מעבר ל${slotLabel(item, names[(names.indexOf(active) + 1) % names.length]) || 'שדה הבא'}`} /></div>}
          </div>
        )}
      </div>

      <AnimatePresence>
        {combo && (
          <m.div key="combo" className="combo-pop" role="status" onClick={() => setCombo(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <m.div className="combo-card" initial={{ scale: 0.6, y: 20 }} animate={{ scale: 1, y: 0 }} transition={SPRING.pop}>
              <Mascot mood="excited" size={116} />
              <p className="combo-text"><Flame size={30} aria-hidden="true" />{combo} ברצף!</p>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <Sheet open={zoom} onOpenChange={setZoom} title="השרטוט" wide>
        <div className="fig-big"><Figure fig={item.fig} /></div>
      </Sheet>
      <Sheet key={`exit-${exitKey}`} open={exitOpen} onOpenChange={(o) => (o ? setExitOpen(true) : stay())} title={placement ? 'לצאת מבדיקת הרמה?' : 'לצאת מהשיעור?'}>
        <div className="exit-sheet">
          <Mascot mood="oops" size={96} />
          <p className="lead">{placement ? 'כל נושא יתחיל מהמדרגה הראשונה. אפשר לחזור לבדיקה מהלוח בכל זמן.' : 'ההתקדמות בשיעור הזה לא תישמר. התשובות שכבר עניתם נשמרות בתרגול שלכם.'}</p>
          <Button className="btn-block btn-lg" onClick={stay}>{placement ? 'להמשיך בבדיקה' : 'להמשיך ללמוד'}</Button>
          <Button variant="ghost" className="btn-block exit-quit" onClick={() => leave('/', { replace: true })}>יציאה</Button>
        </div>
      </Sheet>
      {/* every sheet in a lesson has the same build: its title and the way out at the top, the content, and its one
          action pinned at the bottom (the chat's input, the remedy's button, the help request's "send") */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen} title="שאלו את העוזר" className="chat-sheet">
        <div className="chat-context"><span className="muted">על התרגיל:</span> <MathText text={item.text} />{item.display && <> <Tex tex={item.display} /></>}</div>
        <AIChat context={aiContext()} messages={chat} onMessages={setChat} intro="אני רואה את התרגיל ואת מה שכתבתם. מה לא ברור?" onDone={() => setChatOpen(false)} onMadi={askMadi} />
      </Sheet>
      <TutorSheet open={tutorOpen} onOpenChange={(o) => { setTutorOpen(o); if (!o) setTutorIntent(null); }} content={contentOf(skillId(item.topic || spec.topic, item.level))} item={item}
        wrong={s.wrong.length ? { cat: last?.cat ?? null, diagnosis: last?.diagnosis ?? null } : null} onAskAI={aiReady() ? () => { setTutorOpen(false); setChatOpen(true); } : null}
        aiState={chatState} startIntent={tutorIntent} />
      <Sheet open={!!remedy} onOpenChange={(o) => { if (!o) setRemedy(null); }} title="בואו נראה את זה אחרת" className="flow-sheet">
        {remedy && <RemedyFlow content={contentOf(skillId(item.topic || spec.topic, item.level))} misc={remedy} compact onDone={() => setRemedy(null)} doneLabel="חזרה לשיעור" />}
      </Sheet>
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} payload={{ topic: item.topic, level: item.level, question: itemMath(item), answer: s.wrong.map((w) => answerText(item, w)).join(' ; ') }} getImage={() => (page.strokes.length ? nbRef.current?.toImage({ max: HELP_IMAGE_MAX }) || null : null)} hasPage={page.strokes.length > 0} />
    </div>
  );
}

/**
 * Ask the teacher for help with this exercise, with an optional note and the notebook page. A note that reads as
 * distress (trust spec TRUST-3 §3.5, Appendix E.2): after sending, the sheet stays open and says the request went,
 * above the support card, in place of the toast. The server checks the note again on its own and marks the request
 * for the teacher; the child's own words go only to the teacher they chose to write to.
 */
function HelpSheet({ open, onOpenChange, payload, getImage, hasPage }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // a note that read as distress: 'sent' (the sheet shows the card) or 'failed' (the card still shows, and the note
  // waits in the form to be sent again)
  const [care, setCare] = useState(null);
  const close = (o) => { if (!o) setCare(null); onOpenChange(o); };
  const send = async () => {
    setBusy(true);
    const flagged = detectDistress(note).flag;
    try {
      // the page goes only as large as the server keeps it (shrunk if needed); a page that cannot fit stays behind
      const image = getImage();
      await api('/api/help', { method: 'POST', body: { ...payload, note, image } });
      setNote('');
      if (flagged) { setCare('sent'); return; }
      toast.success(hasPage && !image ? 'הבקשה נשלחה למורה, בלי הדף מהמחברת: הוא גדול מדי לשליחה.' : 'הבקשה נשלחה למורה');
      onOpenChange(false);
    } catch (e) {
      if (flagged) setCare('failed'); else toast.error(e.message);
    } finally { setBusy(false); }
  };
  const footer = useMemo(() => (care === 'sent'
    ? <Button variant="secondary" className="btn-block" onClick={() => close(false)}>חזרה</Button>
    : care === 'failed'
      ? <Button className="btn-block btn-lg" onClick={() => setCare(null)}>לנסות לשלוח שוב</Button>
      : <Button className="btn-block btn-lg" onClick={send} disabled={busy}>{busy ? 'שולחים…' : 'שליחה למורה'}</Button>), [busy, note, care]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onOpenChange={close} title="לבקש עזרה מהמורה" footer={footer}>
      {care ? (
        <div className="help-sent">
          <p className="help-sent-line" role="status">{care === 'sent' ? 'הבקשה נשלחה למורה.' : 'לא הצלחנו לשלוח את הבקשה למורה. בדקו את החיבור לאינטרנט ונסו שוב.'}</p>
          {/* when it did not go, the card says nothing about the teacher seeing the note */}
          <SupportCard variant={care === 'sent' ? 'help-note' : 'opened'} />
        </div>
      ) : (
        <>
          <div className="ob-ask sheet-ask">
            <p className="ob-bubble">המורה יראה את התרגיל ואת מה שכתבתם{hasPage ? ', כולל הדף מהמחברת' : ''}, ויוכל לעבור עליו איתכם.</p>
          </div>
          <label htmlFor="help-note" className="field-label">מה לא ברור? (לא חובה)</label>
          <textarea id="help-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </>
      )}
    </Sheet>
  );
}
