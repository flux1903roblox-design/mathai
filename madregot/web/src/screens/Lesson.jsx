import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { X, Lightbulb, Sparkles, Hand, NotebookPen, Keyboard, Flame, RotateCcw } from 'lucide-react';
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
import LessonDone from './LessonDone.jsx';

const SLOT_LABEL = { v: 'התשובה', x: 'שיעור x', y: 'שיעור y', m: 'השיפוע m', b: 'b' };
const PRAISE = ['מצוין!', 'יפה מאוד!', 'בדיוק!', 'נכון!', 'כל הכבוד!'];

function AnswerSlots({ item, slots, setSlots, active, setActive, locked, shakeKey, onEnter, struck, unstrike }) {
  const shakeRef = useShake(shakeKey);
  const names = slotsFor(item);
  const input = (k, extra = {}) => (
    <input
      key={k} id={`slot-${k}`} dir="ltr" inputMode="none" autoComplete="off" spellCheck={false}
      className={clsx('slot', active === k && !struck && !locked && 'active', struck && 'struck')}
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
  const { path, progress } = useApp.getState();
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
  const nbRef = useRef(null);
  const qRef = useRef(null);
  const dockRef = useRef(null);
  const [dockH, setDockH] = useState(380);
  const t = spec ? TOPIC[spec.topic] : null;
  const item = s?.item;
  const names = item ? slotsFor(item) : [];

  useEffect(() => {
    if (!item) return;
    setSlots({}); setChoice(null); setStruck(false); setActive(names[0] || 'v'); setExplain({ state: 'idle', text: '' }); setShowSteps(false); setNbCheck({ state: 'idle' });
    qRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    // On a tall question (a figure), bring the answer up above the keypad.
    requestAnimationFrame(() => document.querySelector('.lesson .answer, .lesson .choices')?.scrollIntoView({ block: 'nearest' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key, s?.slot]);

  useEffect(() => {
    const el = dockRef.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });

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
        if (aiReady() && ns.kind !== 'jump') setTimeout(() => askExplainFor(ns), 0);
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
    const award = useApp.getState().completeLesson(result, { fromPlan: spec.fromPlan });
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
      if (e.key === 'Enter' && last && !last.invalid) { e.preventDefault(); goOn(); }
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
  if (done) return <LessonDone {...done} topic={t} onExit={() => navigate('/', { replace: true, state: { from: spec.topic } })} onAgain={() => { setDone(null); setS(startLesson(spec)); }} />;

  const feedback = last && !last.invalid ? (last.ok ? 'good' : s.phase === 'retry' ? 'retry' : 'reveal') : null;
  const inClass = !!st.profile?.token;
  const page = pages[item.key] || { strokes: [], height: 420 };
  const setPage = (patch) => setPages((all) => ({ ...all, [item.key]: { ...page, ...patch } }));
  const locked = feedback === 'good' || feedback === 'reveal';
  const pct = Math.round(progressOf(s) * 100);

  return (
    <div className={clsx('lesson', `ch-${t.color}`, feedback && 'fb-open')} style={{ '--dock-h': `${dockH}px` }}>
      <header className="lesson-top">
        <button type="button" className="icon-btn lesson-x" onClick={() => setExitOpen(true)} aria-label="יציאה מהשיעור"><X size={26} /></button>
        <div className="lesson-bar" role="progressbar" aria-label="התקדמות בשיעור" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ width: `${Math.max(pct, 3)}%` }} />
        </div>
        <span className={clsx('lesson-combo', s.combo >= 2 && 'on')} aria-live="polite">
          {s.combo >= 2 && <><Flame size={18} aria-hidden="true" />{s.combo}<span className="visually-hidden"> ברצף</span></>}
        </span>
      </header>

      <main className="lesson-main" ref={qRef} tabIndex={-1} aria-labelledby="qtext">
        <h1 className="qtext" id="qtext"><MathText text={item.text} /></h1>
        {item.redo && <p className="redo-note"><RotateCcw size={16} aria-hidden="true" />תרגיל דומה לזה שהיה קשה קודם</p>}
        {item.display && <div className="qdisplay"><Tex tex={item.form === 'mc' ? item.display : `${item.display} = \\,?`} display /></div>}
        <Figure fig={item.fig} />
        {s.hint && s.phase === 'answer' && !feedback && <Box tone="hint" title="רמז"><MathText as="p" text={item.hint} /></Box>}

        {item.form === 'mc' ? (
          <div className={clsx('choices', item.choices.length === 3 && item.choices.every((c) => c.tex) && 'inline')} role="radiogroup" aria-label="אפשרויות">
            {item.choices.map((c, i) => {
              const state = locked && i === item.answer ? 'good' : (feedback && choice === i && i !== item.answer) || s.wrong.includes(i) ? 'bad' : '';
              return (
                <button key={i} type="button" role="radio" aria-checked={choice === i} className={clsx('choice', choice === i && 'on', state)}
                  disabled={locked || s.wrong.includes(i)} onClick={() => { setChoice(i); play('tap'); if (feedback === 'retry') setLast(null); }}>
                  <span className="choice-key" aria-hidden="true">{i + 1}</span>
                  <span className="choice-text">{c.tex ? <Tex tex={c.tex} /> : c.text}</span>
                </button>
              );
            })}
          </div>
        ) : !nbOn && (
          <AnswerSlots item={item} slots={slots} setSlots={(v) => { setSlots(v); if (feedback === 'retry') setLast(null); }} active={active} setActive={setActive} locked={locked} shakeKey={shakeKey} onEnter={() => (feedback ? goOn() : check())} struck={struck} unstrike={() => setStruck(false)} />
        )}
        {last?.invalid && <p className="form-error" role="alert">{last.text}</p>}

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

      </main>

      {combo && (
        <div className="combo-pop" role="status" onClick={() => setCombo(null)}>
          <Mascot mood="cheer" size={110} />
          <p className="combo-text">{combo} ברצף!</p>
        </div>
      )}

      {feedback ? (
        <section className={clsx('fb', `fb-${feedback}`)} aria-live="assertive" aria-labelledby="fb-title">
          <div className="fb-inner">
            <div className="fb-head">
              <Mascot mood={feedback === 'good' ? 'cheer' : feedback === 'retry' ? 'oops' : 'think'} size={58} className="fb-mascot" />
              <h2 id="fb-title" className="fb-title">{feedback === 'good' ? (last.first ? last.praise : 'יפה, תיקנתם!') : feedback === 'retry' ? 'עוד לא. נסו שוב' : 'התשובה הנכונה:'}</h2>
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
                <Steps steps={item.solution} />
                {explain.state === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={['בודק את התשובה שלכם', 'מחפש איפה זה התפספס', 'מנסח הסבר']} /></Box>}
                {explain.state === 'done' && <Box tone="ai" title="העוזר"><Markdown>{explain.text}</Markdown></Box>}
                {explain.state === 'error' && <p className="form-error" role="alert">{explain.text}</p>}
                {explain.state === 'idle' && aiReady() && s.kind !== 'jump' && <Button variant="ai" className="btn-sm" onClick={askExplain}><Sparkles size={16} aria-hidden="true" />למה טעיתי?</Button>}
                {s.kind !== 'jump' && <p className="fb-note">תרגיל דומה יחזור בסוף השיעור.</p>}
              </div>
            )}
            {feedback === 'good' && (
              <div className="fb-body">
                <button type="button" className="link-btn" onClick={() => setShowSteps(!showSteps)} aria-expanded={showSteps}>{showSteps ? 'להסתיר את הפתרון' : 'איך פותרים?'}</button>
                {showSteps && <Steps steps={item.solution} />}
              </div>
            )}
            <Button variant={feedback === 'good' ? 'good' : 'bad'} className="btn-block btn-lg" onClick={goOn} autoFocus>
              {feedback === 'retry' ? 'לנסות שוב' : feedback === 'good' ? 'המשך' : 'הבנתי'}
            </Button>
          </div>
        </section>
      ) : (
        <div className="lesson-dock" ref={dockRef}>
          {/* help sits next to the thumb, above the keypad */}
          <div className="tools" role="group" aria-label="עזרה">
            <button type="button" className="tool" onClick={() => setS(withHint(s))} disabled={s.hint || s.kind === 'jump'}><Lightbulb size={18} aria-hidden="true" />רמז</button>
            {aiReady() && s.kind !== 'jump' && <button type="button" className="tool ai" aria-label="שאלו את העוזר" onClick={() => setChatOpen(true)}><Sparkles size={18} aria-hidden="true" />העוזר</button>}
            <button type="button" className={clsx('tool', nbOn && 'on')} aria-pressed={nbOn} onClick={() => setNbOn(!nbOn)}>{nbOn ? <Keyboard size={18} aria-hidden="true" /> : <NotebookPen size={18} aria-hidden="true" />}{nbOn ? 'תשובה' : 'מחברת'}</button>
            {inClass && <button type="button" className="tool" onClick={() => setHelpOpen(true)}><Hand size={18} aria-hidden="true" />למורה</button>}
          </div>
          {item.form !== 'mc' && !nbOn && <Keypad onKey={onKey} />}
          <Button className="btn-block btn-lg" onClick={check} disabled={!canCheck}>בדיקה</Button>
        </div>
      )}

      <Sheet open={exitOpen} onOpenChange={setExitOpen} title="לצאת מהשיעור?">
        <div className="exit-sheet">
          <Mascot mood="oops" size={96} />
          <p className="lead">ההתקדמות בשיעור הזה לא תישמר. התשובות שכבר עניתם נשמרות בתרגול שלכם.</p>
          <Button className="btn-block btn-lg" onClick={() => setExitOpen(false)}>להמשיך ללמוד</Button>
          <Button variant="danger-outline" className="btn-block" onClick={() => { syncNow(); navigate('/', { replace: true }); }}>יציאה</Button>
        </div>
      </Sheet>
      <Sheet open={chatOpen} onOpenChange={setChatOpen} title="שאלו את העוזר">
        <div className="chat-context"><span className="muted">על התרגיל:</span> <MathText text={item.text} />{item.display && <> <Tex tex={item.display} /></>}</div>
        <AIChat context={aiContext()} />
      </Sheet>
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} payload={{ topic: spec.topic, level: item.level, question: itemMath(item), answer: s.wrong.map((w) => answerText(item, w)).join(' ; ') }} getImage={() => (page.strokes.length ? nbRef.current?.toImage() || null : null)} hasPage={page.strokes.length > 0} />
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
