import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import { X, Star, Lightbulb, Sparkles, Hand, RotateCcw, ArrowLeft, NotebookPen, Keyboard } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { TOPIC, TOPICS, readAnswer, answerText, itemPlain, slotsFor, itemMath } from '@/content/index.js';
import { startSession, nextQuestion, submit, withHint, needFor, GOAL_MINUTES } from '@/lib/ladder.js';
import { runAI, aiReady } from '@/lib/ai.js';
import { api, syncNow } from '@/lib/api.js';
import { Tex, MathText, Markdown } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import AIChat from '@/components/AIChat.jsx';
import Notebook from '@/components/Notebook.jsx';
import CheckResult from '@/components/CheckResult.jsx';
import { Box, Button, ChapterMark, Keypad, NeedSlots, Sheet, Steps, Thinking, useShake } from '@/components/ui.jsx';

const SLOT_LABEL = { v: 'התשובה', x: 'שיעור x', y: 'שיעור y', m: 'השיפוע m', b: 'b' };
const XP_FIRST = 10; const XP_LATER = 5; const XP_LEVEL = 20;

function SuccessCheck() {
  // transitions.dev #10: fade + rotate + blur + bob, then the tick draws itself.
  return (
    <span className="t-success-check" data-state="in" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28">
        <circle cx="12" cy="12" r="11" />
        <path d="M7 12.5l3.2 3.2L17 9" />
      </svg>
    </span>
  );
}

function AnswerSlots({ item, slots, setSlots, active, setActive, locked, shakeKey, onEnter, struck, unstrike }) {
  const shakeRef = useShake(shakeKey);
  const names = slotsFor(item);
  const input = (k, extra = {}) => (
    <input
      key={k} id={`slot-${k}`} dir="ltr" inputMode="none" autoComplete="off" spellCheck={false}
      className={clsx('slot', active === k && 'active', struck && 'struck')} aria-label={struck ? `${SLOT_LABEL[k]}, התשובה הקודמת: ${slots[k] || ''}. כתבו תשובה חדשה` : SLOT_LABEL[k]} placeholder={extra.ph || '?'}
      value={slots[k] || ''} readOnly={locked}
      onFocus={() => setActive(k)}
      onChange={(e) => {
        const typed = e.target.value.replace(/[^\d\-−./,]/g, '').slice(0, 9);
        // A struck (wrong) answer is replaced, not edited: the first new key starts a fresh answer.
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

function Summary({ s, t, onAgain, onHome }) {
  const cats = Object.entries(s.cats).sort((a, b) => b[1] - a[1]).filter(([c]) => t.cats[c]);
  if (s.n === 0) {
    return (
      <div className="page summary">
        <h1 className="h-page">עוד לא פתרתם תרגילים בסבב הזה</h1>
        <p className="lead">אפשר לחזור לתרגל, או לבחור נושא אחר.</p>
        <div className="form-actions">
          <Button className="btn-block btn-lg" onClick={onAgain}>חזרה לתרגול</Button>
          <Button variant="secondary" className="btn-block" onClick={onHome}>למסך הבית</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={`page summary ch-${t.color}`}>
      <h1 className="h-page">סיכום התרגול</h1>
      <p className="lead">{t.title}</p>
      <dl className="stats3">
        <div><dt>תרגילים</dt><dd>{s.n}</dd></div>
        <div><dt>נכון בניסיון ראשון</dt><dd>{s.firstTry}</dd></div>
        <div><dt>מדרגה</dt><dd>{s.startLevel === s.level ? s.level : <span className="mathline">{s.startLevel} → {s.level}</span>}</dd></div>
      </dl>
      <div className="form-actions row">
        <Button className="btn-lg" onClick={onAgain}><RotateCcw size={18} aria-hidden="true" />סבב נוסף</Button>
        <Button variant="secondary" className="btn-lg" onClick={onHome}>למסך הבית</Button>
      </div>
      {s.levelUps > 0 && <Box tone="ok" title="עליתם מדרגה"><p>הגעתם למדרגה {s.level}: {t.levels[s.level - 1].title}.</p></Box>}
      {cats.length > 0 && (
        <Box tone="attention" title="שימו לב">
          <p>טעויות שחזרו בסבב הזה:</p>
          <ul className="plain-list">{cats.map(([c, v]) => <li key={c}><MathText text={t.cats[c]} /> <span className="muted">({v})</span></li>)}</ul>
          <p className="muted">העוזר יכול להסביר כל אחת מהן: פתחו את "עוזר AI".</p>
        </Box>
      )}
    </div>
  );
}

export default function Practice() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const t = TOPIC[id];
  const st = useApp();
  const saved = st.progress[id];
  const startLevel = Number(params.get('level')) || saved?.level || 1;

  const [s, setS] = useState(() => (t ? nextQuestion(startSession(id, { level: startLevel, max: saved?.max })) : null));
  const [slots, setSlots] = useState({});
  const [struck, setStruck] = useState(false); // after a mistake: the wrong answer stays visible, crossed out
  const [active, setActive] = useState('v');
  const [shakeKey, setShakeKey] = useState(0);
  const [last, setLast] = useState(null); // result of the last submit
  const [explain, setExplain] = useState({ state: 'idle', text: '' });
  const [chatOpen, setChatOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [levelFlash, setLevelFlash] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(0);
  const qRef = useRef(null);
  const nbRef = useRef(null);
  const solveMode = useApp((x) => x.solveMode) || 'answer';
  const setSolveMode = useApp((x) => x.setSolveMode);
  const [pages, setPages] = useState({}); // notebook page per exercise: { strokes, height }
  const [nbCheck, setNbCheck] = useState({ state: 'idle' });

  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') setSessionSecs((v) => v + 1); }, 1000);
    return () => clearInterval(iv);
  }, []);

  const item = s?.item;
  const names = item ? slotsFor(item) : [];
  useEffect(() => {
    if (!item) return;
    setSlots({}); setStruck(false); setActive(names[0] || 'v'); setExplain({ state: 'idle', text: '' }); setNbCheck({ state: 'idle' });
    qRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key, s?.served]);

  // Test hook: with localStorage 'madregot-debug' set, the current exercise is exposed for automated checks.
  useEffect(() => { try { if (localStorage.getItem('madregot-debug')) window.__madregotItem = item; } catch { /* storage blocked */ } }, [item]);

  const focusSlot = useCallback((k) => { const el = document.getElementById(`slot-${k}`); el?.focus({ preventScroll: true }); }, []);

  const onKey = (k) => {
    if (s.phase === 'done' || s.phase === 'revealed') return;
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

  const commitEvent = (event, xp) => {
    st.recordAnswer(event, xp);
    if (st.profile?.token && (useApp.getState().outbox.length >= 5)) syncNow();
  };

  const check = (choice) => {
    if (!item || s.phase === 'done' || s.phase === 'revealed') return;
    if (struck && item.form !== 'mc') {
      setLast({ ...last, invalid: true, text: 'כתבו תשובה חדשה במקום התשובה המחוקה.' });
      setShakeKey((v) => v + 1); focusSlot(active);
      return;
    }
    const u = item.form === 'mc' ? choice : readAnswer(item, slots);
    if (u == null) {
      const missing = names.find((k) => !String(slots[k] || '').trim()) || names[0];
      setLast({ invalid: true, text: item.form === 'pt' ? 'מלאו את שני השיעורים.' : item.form === 'line' ? 'מלאו את m ואת b.' : 'כתבו מספר. מינוס יש במקלדת.' });
      setShakeKey((v) => v + 1); setActive(missing); focusSlot(missing);
      return;
    }
    const shown = answerText(item, u);
    const { s: ns, result } = submit(s, u, shown);
    setLast({ ...result, shown, choice });
    if (result.ok) {
      const gain = (result.first ? XP_FIRST : XP_LATER) + (result.levelUp ? XP_LEVEL : 0);
      commitEvent(result.event, gain);
      st.setLevel(id, ns.level, ns.max);
      if (result.levelUp) setLevelFlash((v) => v + 1);
    } else {
      setShakeKey((v) => v + 1);
      if (result.reveal) commitEvent(result.event, 0);
      if (result.retry) { setStruck(true); setActive(names[0] || 'v'); }
    }
    setS(ns);
  };

  const next = () => { setLast(null); setS(nextQuestion(s)); };
  const primary = () => (s.phase === 'done' || s.phase === 'revealed' ? next() : check());

  useEffect(() => {
    const onDoc = (e) => {
      if (finished || chatOpen || helpOpen) return;
      if (e.key === 'Enter' && (s?.phase === 'done' || s?.phase === 'revealed')) { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onDoc);
    return () => window.removeEventListener('keydown', onDoc);
  });

  const checkWork = async () => {
    const image = nbRef.current?.toImage();
    if (!image) { setNbCheck({ state: 'error', message: 'כתבו קודם את הדרך במחברת.' }); return; }
    setNbCheck({ state: 'loading' });
    try {
      const r = await runAI('check', { ...aiContext(), image, mediaType: 'image/jpeg' });
      setNbCheck({ state: 'done', r });
    } catch (e) { setNbCheck({ state: 'error', message: e.message }); }
  };

  const askExplain = async () => {
    setExplain({ state: 'loading', text: '' });
    try {
      const r = await runAI('explain', aiContext());
      setExplain({ state: 'done', text: r.text });
    } catch (e) { setExplain({ state: 'error', text: e.message }); }
  };

  const aiContext = () => ({
    grade: t.grade, topic: t.title, level: item.levelTitle, question: itemPlain(item),
    correct: answerText(item), studentAnswer: s.wrong.join(' ; ') || '', attempts: s.attempt,
  });

  const finish = () => { syncNow(); setFinished(true); };

  if (!t) return <div className="page"><p>הנושא לא נמצא.</p></div>;
  if (finished) {
    return <Summary s={s} t={t} onAgain={() => { setFinished(false); setS(nextQuestion(startSession(id, useApp.getState().progress[id]))); setLast(null); }} onHome={() => navigate('/')} />;
  }

  const topicN = TOPICS.filter((x) => x.grade === t.grade).indexOf(t) + 1;
  // recorded time today plus the time spent on the exercise now on screen (sessionSecs ticks the render)
  const goalSecs = (st.days[today()]?.secs || 0) + (isFinite(sessionSecs) ? Math.min(Math.round((Date.now() - s.itemStartedAt) / 1000), 300) : 0);
  const goalNow = Math.min(1, goalSecs / (GOAL_MINUTES * 60));
  const levelTitle = t.levels[s.level - 1].title;
  const need = needFor(s);
  const isDone = s.phase === 'done' || s.phase === 'revealed';
  const inClass = !!st.profile?.token;
  const page = pages[item.key] || { strokes: [], height: 420 };
  const setPage = (patch) => setPages((all) => ({ ...all, [item.key]: { ...page, ...patch } }));
  const notebook = solveMode === 'notebook' && !isDone;

  return (
    <div className={`practice ch-${t.color}`}>
      <header className="pbar">
        <button type="button" className="pbar-exit" onClick={finish}><X size={20} aria-hidden="true" /><span>סיום</span></button>
        <div className="pbar-goal">
          <div className="bar thin" role="progressbar" aria-label="היעד היומי" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalNow * 100)}><i style={{ width: `${goalNow * 100}%` }} /></div>
          <span className="pbar-goal-text">{Math.min(Math.floor(goalSecs / 60), GOAL_MINUTES)} מתוך {GOAL_MINUTES} דק׳</span>
        </div>
        <span className="pbar-xp"><Star size={18} aria-hidden="true" /><NumberFlow value={st.xp} /><span className="visually-hidden">נקודות</span></span>
      </header>

      <div className={clsx('pline', levelFlash && 'flash')} key={`lv${s.level}`}>
        <ChapterMark color={t.color} n={topicN} size="sm" />
        <span className="pline-text"><b>{t.title}</b> · מדרגה {s.level}: {levelTitle}</span>
        {s.level < s.top ? <NeedSlots need={need} have={s.cnt} /> : <span className="pline-top">המדרגה העליונה</span>}
      </div>

      <main className="qarea" ref={qRef} tabIndex={-1} aria-labelledby="qtext">
        {item.returning && <p className="tag-return">התרגיל הזה חוזר, כי היה קשה קודם</p>}
        <p className="qtext" id="qtext"><span className="ex-num" aria-label={`תרגיל ${s.served}`}>{s.served}</span><MathText text={item.text} /></p>
        {item.display && <div className="qdisplay"><Tex tex={item.form === 'mc' ? item.display : `${item.display} = \\,?`} display /></div>}
        <Figure fig={item.fig} />

        {item.form === 'mc' ? (
          <div className={clsx('choices', item.choices.length === 3 && item.choices.every((c) => c.tex) && 'inline')} role="group" aria-label="אפשרויות">
            {item.choices.map((c, i) => {
              const picked = s.wrong.includes(answerText(item, i)) || (last?.choice === i);
              const state = isDone && i === item.answer ? 'good' : picked && i !== item.answer ? 'bad' : '';
              return (
                <button key={i} type="button" className={clsx('choice', state)} disabled={isDone || s.wrong.includes(answerText(item, i))} onClick={() => check(i)}>
                  {c.tex ? <Tex tex={c.tex} /> : c.text}
                </button>
              );
            })}
          </div>
        ) : !notebook && (
          <AnswerSlots item={item} slots={slots} setSlots={setSlots} active={active} setActive={setActive} locked={isDone} shakeKey={shakeKey} onEnter={primary} struck={struck} unstrike={() => setStruck(false)} />
        )}

        {!isDone && (
          <div className="segmented solve-switch" role="radiogroup" aria-label="איך פותרים">
            <button type="button" role="radio" aria-checked={!notebook} className={clsx('seg', !notebook && 'on')} onClick={() => setSolveMode('answer')}><Keyboard size={18} aria-hidden="true" />תשובה</button>
            <button type="button" role="radio" aria-checked={notebook} className={clsx('seg', notebook && 'on')} onClick={() => setSolveMode('notebook')}><NotebookPen size={18} aria-hidden="true" />פותרים במחברת</button>
          </div>
        )}
        {notebook && (
          <>
            <Notebook ref={nbRef} strokes={page.strokes} onStrokes={(strokes) => { setPage({ strokes }); if (nbCheck.state !== 'loading') setNbCheck({ state: 'idle' }); }} height={page.height} onGrow={() => setPage({ height: page.height + 240 })} />
            <p className="nb-note">כתבו את הדרך כמו במחברת, שורה אחרי שורה. כשמסיימים, עוברים ל"תשובה" וכותבים את התוצאה.</p>
          </>
        )}
        {nbCheck.state === 'loading' && <Box tone="ai" title="בדיקת הדרך"><Thinking states={['קורא את מה שכתבתם', 'בודק כל שורה', 'מסכם']} /></Box>}
        {nbCheck.state === 'error' && <p className="form-error" role="alert">{nbCheck.message}</p>}
        {nbCheck.state === 'done' && <CheckResult r={nbCheck.r} />}

        <div className="feedback" aria-live="polite">
          {last?.invalid && <p className="form-error">{last.text}</p>}
          {s.phase === 'answer' && s.hint && !last && <Box tone="hint" title="רמז"><MathText as="p" text={item.hint} /></Box>}
          {s.phase === 'retry' && (
            <Box tone="attention" title="שימו לב">
              <p>עוד לא. כתבתם <s className="wrong-answer mathline">{s.wrong[s.wrong.length - 1]}</s>. נסו שוב.</p>
              {last?.cat && t.cats[last.cat] && <p className="diag"><MathText text={`מה כנראה קרה: ${t.cats[last.cat]}.`} /></p>}
              <p className="hint-line"><Lightbulb size={16} aria-hidden="true" /><MathText text={item.hint} /></p>
            </Box>
          )}
          {s.phase === 'done' && (
            <Box tone="ok" title="נכון">
              <p className="ok-line"><SuccessCheck />{last?.first ? 'בניסיון הראשון.' : 'יפה, תיקנתם.'}</p>
              {last?.levelUp && <p className="levelup">עליתם למדרגה {s.level}: {levelTitle}</p>}
              <details className="sol"><summary>איך פותרים</summary><Steps steps={item.solution} /></details>
            </Box>
          )}
          {s.phase === 'revealed' && (
            <Box tone="attention" title="הפתרון">
              <p>כתבתם <s className="wrong-answer mathline">{s.wrong[s.wrong.length - 1]}</s>. התשובה הנכונה: <b className="mathline">{answerText(item)}</b></p>
              <Steps steps={item.solution} />
              <p className="muted">התרגיל יחזור בעוד כמה תרגילים.</p>
            </Box>
          )}
          {(s.phase === 'retry' || s.phase === 'revealed') && aiReady() && (
            <div className="explain">
              {explain.state === 'idle' && <Button variant="ai" className="btn-sm" onClick={askExplain}><Sparkles size={16} aria-hidden="true" />למה טעיתי? הסבר מהעוזר</Button>}
              {explain.state === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={['בודק את התשובה שלכם', 'מחפש איפה זה התפספס', 'מנסח הסבר']} /></Box>}
              {explain.state === 'done' && <Box tone="ai" title="העוזר"><Markdown>{explain.text}</Markdown></Box>}
              {explain.state === 'error' && <p className="form-error" role="alert">{explain.text}</p>}
            </div>
          )}
        </div>

        <div className="helprow">
          <button type="button" className="help-chip" onClick={() => setS(withHint(s))} disabled={s.hint || isDone}><Lightbulb size={18} aria-hidden="true" />רמז</button>
          <button type="button" className="help-chip ai" onClick={() => setChatOpen(true)}><Sparkles size={18} aria-hidden="true" />שאלו את העוזר</button>
          {inClass && <button type="button" className="help-chip" onClick={() => setHelpOpen(true)}><Hand size={18} aria-hidden="true" />למורה</button>}
        </div>
      </main>

      {notebook ? (
        <div className="dock">
          <div className="nb-actions">
            {aiReady() && <Button variant="ai" onClick={checkWork} disabled={nbCheck.state === 'loading' || !page.strokes.length}><Sparkles size={18} aria-hidden="true" />בדיקת הדרך עם העוזר</Button>}
            <Button onClick={() => setSolveMode('answer')}><Keyboard size={18} aria-hidden="true" />{item.form === 'mc' ? 'לבחירת התשובה' : 'כתיבת התשובה'}</Button>
          </div>
        </div>
      ) : item.form === 'mc' ? (
        isDone && <div className="dock"><Button className="btn-block btn-lg" onClick={next}>לתרגיל הבא<ArrowLeft size={18} aria-hidden="true" /></Button></div>
      ) : (
        <div className="dock">
          <Keypad onKey={onKey} onPrimary={primary} primary={isDone ? <>הבא<ArrowLeft size={18} aria-hidden="true" /></> : 'בדיקה'} />
        </div>
      )}

      <Sheet open={chatOpen} onOpenChange={setChatOpen} title="שאלו את העוזר">
        <div className="chat-context"><span className="muted">על התרגיל:</span> <MathText text={item.text} />{item.display && <> <Tex tex={item.display} /></>}</div>
        <AIChat context={aiContext()} />
      </Sheet>
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} payload={{ topic: id, level: item.level, question: itemMath(item), answer: s.wrong.join(' ; ') }} getImage={() => (page.strokes.length ? nbRef.current?.toImage() || null : null)} hasPage={page.strokes.length > 0} />
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
