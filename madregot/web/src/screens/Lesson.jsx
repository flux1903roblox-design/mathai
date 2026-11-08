import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AnimatePresence, m } from 'motion/react';
import { toast } from 'sonner';
import { Lightbulb, Sparkles, Hand, NotebookPen, Keyboard, Flame, RotateCcw, Check, X } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { TOPIC, readAnswer, answerText, itemPlain, slotsFor, itemMath } from '@/content/index.js';
import { startLesson, answer, next, withHint, progressOf, resultOf, PARTS } from '@/lib/lesson.js';
import { unitNodes } from '@/lib/path.js';
import { runAI, aiReady } from '@/lib/ai.js';
import { api, syncNow } from '@/lib/api.js';
import { play, buzz } from '@/lib/sound.js';
import { Tex, MathText, Markdown } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import AIChat from '@/components/AIChat.jsx';
import Notebook from '@/components/Notebook.jsx';
import CheckResult from '@/components/CheckResult.jsx';
import Mascot from '@/components/Mascot.jsx';
import { Box, Button, Keypad, Sheet, Steps, Thinking, useShake } from '@/components/ui.jsx';
import LessonDone, { PlacementDone } from './LessonDone.jsx';
import { ProgressHeader, FeedbackBadge } from '@/components/lesson/LessonParts.jsx';

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

const SLOT_LABEL = { v: 'התשובה', x: 'שיעור x', y: 'שיעור y', m: 'השיפוע m', b: 'b' };
const PRAISE = ['מצוין!', 'יפה מאוד!', 'בדיוק!', 'נכון!', 'כל הכבוד!'];

function AnswerSlots({ item, slots, setSlots, active, setActive, locked, shakeKey, onEnter, struck, unstrike, good }) {
  const shakeRef = useShake(shakeKey);
  const names = slotsFor(item);
  const input = (k, extra = {}) => (
    <input
      key={k} id={`slot-${k}`} dir="ltr" inputMode="none" autoComplete="off" spellCheck={false}
      className={clsx('slot', active === k && !struck && !locked && 'active', struck && 'struck', good && 'good')}
      aria-label={struck ? `${SLOT_LABEL[k]}, התשובה הקודמת: ${slots[k] || ''}. כתבו תשובה חדשה` : SLOT_LABEL[k]} placeholder={extra.ph || '?'}
      value={slots[k] || ''} readOnly={locked}
      onFocus={() => setActive(k)}
      onChange={(e) => {
        const typed = e.target.value.replace(/[^\d\-−./,]/g, '').slice(0, 9);
        if (struck) { unstrike(); setSlots({ [k]: typed.slice((slots[k] || '').length) || typed.slice(-1) }); return; }
        setSlots({ ...slots, [k]: typed });
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
    />
  );
  return (
    <div className="answer" ref={shakeRef}>
      <div className="answer-row" dir="ltr">
        {item.form === 'pt' && (<><span className="answer-lab"><Tex tex={`${item.label || 'P'}\\,(`} /></span>{input('x', { ph: 'x' })}<span className="answer-lab">,</span>{input('y', { ph: 'y' })}<span className="answer-lab">)</span></>)}
        {item.form === 'line' && (<><span className="answer-lab"><Tex tex="y =" /></span>{input('m', { ph: 'm' })}<span className="answer-lab"><Tex tex="x\,+" /></span>{input('b', { ph: 'b' })}</>)}
        {item.form === 'num' && (<>{item.label && <span className="answer-lab"><Tex tex={item.label} /></span>}{input('v')}</>)}
      </div>
      {item.unit && <span className="answer-unit">{item.unit}</span>}
      {item.form === 'line' && <p className="answer-note">b שלילי? כותבים מינוס בתיבה. שבר כותבים כך: 3/4</p>}
      {names.length > 0 && <span className="visually-hidden" aria-live="polite">{`השדה הפעיל: ${SLOT_LABEL[active] || ''}`}</span>}
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
  const topic = tParam || id;
  if (!TOPIC[topic]) return null;
  const kind = ['review', 'jump'].includes(params.get('kind')) ? params.get('kind') : 'node';
  const nodes = unitNodes(topic, path, progress);
  const current = nodes.find((n) => n.kind === 'node' && n.state === 'current');
  const level = Number(lParam || params.get('level')) || current?.level || TOPIC[topic].levels.length;
  const node = nodes.find((n) => n.kind === 'node' && n.level === level);
  const part = Number(params.get('part')) || (node?.state === 'done' ? PARTS : Math.min(PARTS, (node?.parts || 0) + 1));
  const max = progress[topic]?.max || level;
  return { kind, topic, level, part, max, fromPlan: params.get('from') === 'plan' };
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
  const [chatOpen, setChatOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [combo, setCombo] = useState(null);
  const [done, setDone] = useState(null); // { result, award } once the lesson ends
  const [nbOn, setNbOn] = useState(false);
  const [pages, setPages] = useState({});
  const [nbCheck, setNbCheck] = useState({ state: 'idle' });
  const short = useMedia('(max-height: 620px)');
  const nbRef = useRef(null);
  const qRef = useRef(null);
  const item = s?.item;
  // A placement test moves across topics: the colours and the misconceptions follow the question.
  const t = spec ? TOPIC[item?.topic || spec.topic] : null;
  const placement = spec?.kind === 'placement';
  const isTest = (k) => k === 'jump' || k === 'placement'; // a check, not practice: one try, no hints
  const names = item ? slotsFor(item) : [];

  useEffect(() => {
    if (!item) return;
    setSlots({}); setChoice(null); setStruck(false); setActive(names[0] || 'v'); setExplain({ state: 'idle', text: '' }); setShowSteps(false); setNbCheck({ state: 'idle' });
    qRef.current?.focus({ preventScroll: true });
    qRef.current?.scrollTo?.({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key, s?.slot]);


  // Test hook: with localStorage 'madregot-debug' set, the current exercise is exposed for automated checks.
  useEffect(() => { try { if (localStorage.getItem('madregot-debug')) window.__madregotItem = item; } catch { /* storage blocked */ } }, [item]);

  const focusSlot = useCallback((k) => { document.getElementById(`slot-${k}`)?.focus({ preventScroll: true }); }, []);

  const aiContext = () => ({
    grade: t.grade, topic: t.title, level: item.levelTitle, question: itemPlain(item),
    correct: answerText(item), studentAnswer: s.wrong.map((w) => answerText(item, w)).join(' ; '), attempts: s.attempt,
  });

  const askExplain = async () => {
    setExplain({ state: 'loading', text: '' });
    try { const r = await runAI('explain', aiContext()); setExplain({ state: 'done', text: r.text }); } catch (e) { setExplain({ state: 'error', text: e.message }); }
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

  const canCheck = item && (item.form === 'mc' ? choice != null : !struck && names.every((k) => String(slots[k] || '').trim()));

  const check = () => {
    if (!item || !canCheck || (s.phase !== 'answer' && s.phase !== 'retry')) return;
    const u = item.form === 'mc' ? choice : readAnswer(item, slots);
    if (u == null) {
      const missing = names.find((k) => !String(slots[k] || '').trim()) || names[0];
      setLast({ invalid: true, text: item.form === 'pt' ? 'מלאו את שני השיעורים.' : item.form === 'line' ? 'מלאו את m ואת b.' : 'כתבו מספר. מינוס יש במקלדת.' });
      setShakeKey((v) => v + 1); setActive(missing); focusSlot(missing);
      return;
    }
    const { s: ns, result } = answer(s, u);
    setLast({ ...result, praise: PRAISE[Math.floor(Math.random() * PRAISE.length)] });
    if (result.ok) { play('correct'); commit(result.event); }
    else {
      play('wrong'); buzz(40); setShakeKey((v) => v + 1);
      if (result.reveal) {
        commit(result.event);
        if (item.form !== 'mc') setStruck(true);
        // The second miss is the moment help matters most: ask the tutor without waiting to be asked.
        if (aiReady() && !isTest(ns.kind)) setTimeout(() => askExplainFor(ns), 0);
      }
      if (result.retry) { setStruck(true); setActive(names[0] || 'v'); if (item.form === 'mc') setChoice(null); }
    }
    setS(ns);
  };
  const askExplainFor = async (ns) => {
    setExplain({ state: 'loading', text: '' });
    try {
      const r = await runAI('explain', { ...aiContext(), studentAnswer: ns.wrong.map((w) => answerText(ns.item, w)).join(' ; ') });
      setExplain({ state: 'done', text: r.text });
    } catch (e) { setExplain({ state: 'error', text: e.message }); }
  };

  const finish = (ns) => {
    const result = resultOf(ns);
    const award = placement ? useApp.getState().completePlacement(result) : useApp.getState().completeLesson(result, { fromPlan: spec.fromPlan });
    syncNow();
    play(result.passed ? 'complete' : 'wrong');
    setDone({ result, award });
  };

  const tryAgain = () => { setLast(null); focusSlot(active); };
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
      if (done || chatOpen || helpOpen || exitOpen) return;
      if (e.key === 'Enter' && last && !last.invalid) { e.preventDefault(); goOn(); return; }
      // A computer keyboard types into the answer even when the focus is elsewhere on the screen.
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey || !item || item.form === 'mc' || nbOn) return;
      const k = /^[0-9./]$/.test(e.key) ? e.key : e.key === '-' ? '-' : e.key === 'Backspace' ? 'del' : null;
      if (k) { e.preventDefault(); onKey(k); }
    };
    window.addEventListener('keydown', onDoc);
    return () => window.removeEventListener('keydown', onDoc);
  });

  const checkWork = async () => {
    const image = nbRef.current?.toImage();
    if (!image) { setNbCheck({ state: 'error', message: 'כתבו קודם את הדרך במחברת.' }); return; }
    setNbCheck({ state: 'loading' });
    try { const r = await runAI('check', { ...aiContext(), image, mediaType: 'image/jpeg' }); setNbCheck({ state: 'done', r }); } catch (e) { setNbCheck({ state: 'error', message: e.message }); }
  };

  if (!spec || !t) return <div className="page"><p>השיעור לא נמצא.</p></div>;
  if (done && placement) return <PlacementDone {...done} onExit={() => navigate('/', { replace: true, state: { placed: true } })} />;
  if (done) return <LessonDone {...done} topic={t} onExit={() => navigate('/', { replace: true, state: { from: spec.topic, nodeDone: !!(done.award.nodeDone || done.award.unitDone) } })} onAgain={() => { setDone(null); setS(startLesson(spec)); }} />;

  const feedback = last && !last.invalid ? (last.ok ? 'good' : s.phase === 'retry' ? 'retry' : 'reveal') : null;
  const inClass = !!st.profile?.token;
  const page = pages[item.key] || { strokes: [], height: 420 };
  const setPage = (patch) => setPages((all) => ({ ...all, [item.key]: { ...page, ...patch } }));
  const locked = feedback === 'good' || feedback === 'reveal';
  const pct = Math.round(progressOf(s) * 100);

  const mood = feedback === 'good' ? 'happy' : feedback ? 'encouraging' : s.hint || nbOn ? 'thinking' : 'idle';
  const stage = `${s.slot}-${item.key}`;
  // Each exercise slides in from the reading side; the last one leaves the other way.
  const slide = { initial: { opacity: 0, x: -28 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 28 }, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } };
  const typed = item.form !== 'mc' && !nbOn;
  // On a short screen the question scrolls with the maths, so the drawing keeps room; elsewhere it stays pinned on top.
  const question = (
    <div className="lesson-q">
      <Mascot mood={mood} beat={shakeKey + (last?.ok ? s.solved * 100 : 0)} size={56} className="q-mascot" />
      <h1 className="qtext q-bubble" id="qtext"><MathText text={item.text} /></h1>
    </div>
  );

  return (
    <div className={clsx('lesson', `ch-${t.color}`, feedback && 'fb-open', typed && 'is-typed')}>
      {/* top: progress and the question, always on screen */}
      <header className="lesson-head">
        <ProgressHeader pct={pct} label={placement ? 'התקדמות בבדיקת הרמה' : 'התקדמות בשיעור'} onExit={() => setExitOpen(true)} combo={s.combo} topic={placement ? t.title : null} />
        {!short && (
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={stage} className="q-pin" {...slide}>{question}</m.div>
          </AnimatePresence>
        )}
      </header>

      {/* middle: the maths (expression, drawing, table, choices); the only part that scrolls */}
      <main className="lesson-main" ref={qRef} tabIndex={-1} aria-labelledby="qtext">
        <AnimatePresence mode="wait" initial={false}>
        <m.div key={stage} className="q-stage" {...slide}>
        {short && question}
        {item.redo && <p className="redo-note"><RotateCcw size={16} aria-hidden="true" />תרגיל דומה לזה שהיה קשה קודם</p>}
        {item.display && <div className="qdisplay"><Tex tex={item.form === 'mc' ? item.display : `${item.display} = \\,?`} display /></div>}
        <Figure fig={item.fig} />
        <AnimatePresence>
          {s.hint && s.phase === 'answer' && !feedback && (
            <m.div key="hint" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <Box tone="hint" title="רמז"><MathText as="p" text={item.hint} /></Box>
            </m.div>
          )}
        </AnimatePresence>
        {item.form === 'mc' && (
          <div className={clsx('choices', item.choices.length === 3 && item.choices.every((c) => c.tex) && 'inline')} role="radiogroup" aria-label="אפשרויות">
            {item.choices.map((c, i) => {
              const state = locked && i === item.answer ? 'good' : (feedback && choice === i && i !== item.answer) || s.wrong.includes(i) ? 'bad' : '';
              return (
                <m.button key={i} type="button" role="radio" aria-checked={choice === i} className={clsx('choice', choice === i && 'on', state)}
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
            {nbCheck.state === 'loading' && <Box tone="ai" title="בדיקת הדרך"><Thinking states={['קורא את מה שכתבתם', 'בודק כל שורה', 'מסכם']} /></Box>}
            {nbCheck.state === 'error' && <p className="form-error" role="alert">{nbCheck.message}</p>}
            {nbCheck.state === 'done' && <CheckResult r={nbCheck.r} />}
          </>
        )}
        </m.div>
        </AnimatePresence>
      </main>

      {/* bottom: the answer row, then the keypad and the check button (or the feedback that replaces them) */}
      <div className="lesson-foot">
        {typed && (
          <div className="answer-bar">
            <AnswerSlots item={item} slots={slots} setSlots={(v) => { setSlots(v); if (feedback === 'retry') setLast(null); }} active={active} setActive={setActive} locked={locked} shakeKey={shakeKey} onEnter={() => (feedback ? goOn() : check())} struck={struck} unstrike={() => setStruck(false)} good={feedback === 'good'} />
          </div>
        )}
        {last?.invalid && <p className="form-error answer-error" role="alert">{last.text}</p>}
        {feedback ? (
          <m.section className={clsx('fb', `fb-${feedback}`)} aria-live="assertive" aria-labelledby="fb-title"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
            <div className="fb-scroll">
              <div className="fb-head">
                <FeedbackBadge good={feedback === 'good'} />
                <h2 id="fb-title" className="fb-title">{feedback === 'good' ? (last.first ? last.praise : 'יפה, תיקנתם!') : feedback === 'retry' ? 'עוד לא. נסו שוב' : 'התשובה הנכונה:'}</h2>
                {feedback === 'good' && s.combo >= 2 && <span className="fb-combo"><Flame size={16} aria-hidden="true" />{s.combo} ברצף</span>}
              </div>
              {feedback === 'retry' && (
                <div className="fb-body">
                  {last?.cat && t.cats[last.cat] && <p><MathText text={`מה כנראה קרה: ${t.cats[last.cat]}.`} /></p>}
                  <p className="hint-line"><Lightbulb size={16} aria-hidden="true" /><MathText text={item.hint} /></p>
                </div>
              )}
              {feedback === 'reveal' && (
                <div className="fb-body">
                  <p className="fb-answer">{/[\u0590-\u05FF]/.test(answerText(item)) ? answerText(item) : <Tex tex={answerText(item)} />}</p>
                  {placement ? <p className="fb-note">זה בסדר. כך יודעים מאיפה להתחיל בנושא הזה.</p> : <Steps steps={item.solution} />}
                  {explain.state === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={['בודק את התשובה שלכם', 'מחפש איפה זה התפספס', 'מנסח הסבר']} /></Box>}
                  {explain.state === 'done' && <Box tone="ai" title="העוזר"><Markdown>{explain.text}</Markdown></Box>}
                  {explain.state === 'error' && <p className="form-error" role="alert">{explain.text}</p>}
                  {explain.state === 'idle' && aiReady() && !isTest(s.kind) && <Button variant="ai" className="btn-sm" onClick={askExplain}><Sparkles size={16} aria-hidden="true" />למה טעיתי?</Button>}
                  {!isTest(s.kind) && <p className="fb-note">תרגיל דומה יחזור בסוף השיעור.</p>}
                </div>
              )}
              {feedback === 'good' && (
                <div className="fb-body">
                  <button type="button" className="link-btn" onClick={() => setShowSteps(!showSteps)} aria-expanded={showSteps}>{showSteps ? 'להסתיר את הפתרון' : 'איך פותרים?'}</button>
                  {showSteps && <Steps steps={item.solution} />}
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
            {typed && <Keypad onKey={onKey} onNext={names.length > 1 ? nextSlot : undefined} nextLabel={`מעבר ל${SLOT_LABEL[names[(names.indexOf(active) + 1) % names.length]] || 'שדה הבא'}`} />}
            <div className="dock-row">
              {/* help sits next to the thumb: icon buttons with a short label */}
              <div className="tools" role="group" aria-label="עזרה">
                <button type="button" className="tool" onClick={() => setS(withHint(s))} disabled={s.hint || isTest(s.kind)} aria-label="רמז"><Lightbulb size={20} aria-hidden="true" /><span className="tool-label">רמז</span></button>
                {aiReady() && !isTest(s.kind) && <button type="button" className="tool ai" aria-label="שאלו את העוזר" onClick={() => setChatOpen(true)}><Sparkles size={20} aria-hidden="true" /><span className="tool-label">העוזר</span></button>}
                <button type="button" className={clsx('tool', nbOn && 'on')} aria-pressed={nbOn} aria-label={nbOn ? 'תשובה' : 'מחברת'} onClick={() => setNbOn(!nbOn)}>{nbOn ? <Keyboard size={20} aria-hidden="true" /> : <NotebookPen size={20} aria-hidden="true" />}<span className="tool-label">{nbOn ? 'תשובה' : 'מחברת'}</span></button>
                {inClass && <button type="button" className="tool" aria-label="למורה" onClick={() => setHelpOpen(true)}><Hand size={20} aria-hidden="true" /><span className="tool-label">למורה</span></button>}
              </div>
              <Button className="check-btn btn-lg" onClick={check} disabled={!canCheck}>בדיקה</Button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {combo && (
          <m.div key="combo" className="combo-pop" role="status" onClick={() => setCombo(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <m.div className="combo-card" initial={{ scale: 0.6, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }}>
              <Mascot mood="excited" size={116} />
              <p className="combo-text"><Flame size={30} aria-hidden="true" />{combo} ברצף!</p>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <Sheet open={exitOpen} onOpenChange={setExitOpen} title={placement ? 'לצאת מבדיקת הרמה?' : 'לצאת מהשיעור?'}>
        <div className="exit-sheet">
          <Mascot mood="oops" size={96} />
          <p className="lead">{placement ? 'כל נושא יתחיל מהמדרגה הראשונה. אפשר לחזור לבדיקה מהלוח בכל זמן.' : 'ההתקדמות בשיעור הזה לא תישמר. התשובות שכבר עניתם נשמרות בתרגול שלכם.'}</p>
          <Button className="btn-block btn-lg" onClick={() => setExitOpen(false)}>{placement ? 'להמשיך בבדיקה' : 'להמשיך ללמוד'}</Button>
          <Button variant="danger-outline" className="btn-block" onClick={() => { syncNow(); navigate('/', { replace: true }); }}>יציאה</Button>
        </div>
      </Sheet>
      <Sheet open={chatOpen} onOpenChange={setChatOpen} title="שאלו את העוזר">
        <div className="chat-context"><span className="muted">על התרגיל:</span> <MathText text={item.text} />{item.display && <> <Tex tex={item.display} /></>}</div>
        <AIChat context={aiContext()} />
      </Sheet>
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} payload={{ topic: item.topic, level: item.level, question: itemMath(item), answer: s.wrong.map((w) => answerText(item, w)).join(' ; ') }} getImage={() => (page.strokes.length ? nbRef.current?.toImage() || null : null)} hasPage={page.strokes.length > 0} />
    </div>
  );
}

function HelpSheet({ open, onOpenChange, payload, getImage, hasPage }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api('/api/help', { method: 'POST', body: { ...payload, note, image: getImage() } });
      toast.success('הבקשה נשלחה למורה'); setNote(''); onOpenChange(false);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const footer = useMemo(() => <Button className="btn-block" onClick={send} disabled={busy}>{busy ? 'שולחים…' : 'שליחה למורה'}</Button>, [busy, note]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="לבקש עזרה מהמורה" footer={footer}>
      <p className="lead">המורה יראה את התרגיל ואת מה שכתבתם{hasPage ? ', כולל הדף מהמחברת' : ''}, ויוכל לעבור עליו איתכם.</p>
      <label htmlFor="help-note" className="field-label">מה לא ברור? (לא חובה)</label>
      <textarea id="help-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
    </Sheet>
  );
}
