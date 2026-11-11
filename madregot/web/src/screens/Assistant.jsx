import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Mascot from '@/components/Mascot.jsx';
import clsx from 'clsx';
import { Camera, MessageCircle, Wand2, Check, X, ImageUp } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { runAI, aiReady, aiMode } from '@/lib/ai.js';
import { gate, aiAccess, useAIStatus, needIntro } from '@/lib/account.js';
import ToolLocked from '@/components/ToolLocked.jsx';
import { limitVariant } from '@/components/limitCopy.js';
import ReportAnswer, { checkText, generateText } from '@/components/ReportAnswer.jsx';
import SupportCard from '@/components/SupportCard.jsx';
import { SupportLink } from '@/components/SupportSheet.jsx';
import { TOPIC, topicsFor, readAnswer, isCorrect, diagnosisLine, answerText, displayTex, itemPlain } from '@/content/index.js';
import { skillId } from '@/learn/skills.ts';
import { seedsFor, seedPayload, exercisesFrom } from '@/lib/seeds.js';
import Figure from '@/components/Figure.jsx';
import AIChat from '@/components/AIChat.jsx';
import { buildTutorContext } from '@/lib/tutorContext.js';
import { Box, Button, Field, Sheet, Thinking } from '@/components/ui.jsx';
import { usePhotoWarn } from '@/components/PhotoWarn.jsx';
import PhotoPrep from '@/components/PhotoPrep.jsx';
import { Markdown } from '@/components/MathText.jsx';

/** A result that appears below the fold scrolls up into view, clear of the tab bar. */
function useReveal(dep) {
  const ref = useRef(null);
  useEffect(() => { if (dep) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [dep]);
  return ref;
}

/**
 * The tutor is not connected (no server, no personal key): say so once, show what it will do,
 * and give two clear ways on. Nothing on this screen pretends to work and then fails.
 */
function AiOffline() {
  const inClass = useApp((s) => !!s.profile?.token);
  const FEATURES = [
    { icon: MessageCircle, title: 'שיחה עם העוזר החכם', text: 'שואלים כל שאלה, ומקבלים הסבר צעד אחר צעד.' },
    { icon: Camera, title: 'בדיקת פתרון מצולם', text: 'מצלמים את הדרך מהמחברת, והעוזר מסמן כל שלב.' },
    { icon: Wand2, title: 'תרגילים חדשים', text: 'עוד תרגילים באותה מדרגה, עם רמז ופתרון.' },
  ];
  // laid out as a conversation (like a tutor chat in Duolingo Max or Brilliant): מדי's messages, then the input bar
  // at the bottom, switched off and saying why, with the two ways on
  return (
    <section className="ai-offline chat-like" aria-labelledby="ai-off-title">
      <div className="chat-log" data-region="content">
        <div className="chat-msg">
          <Mascot mood="encouraging" size={44} className="chat-avatar" />
          <div className="chat-bubble">
            <h2 id="ai-off-title" className="chat-bubble-title">העוזר עוד לא מחובר</h2>
            <p>{inClass ? 'השרת של הכיתה לא עונה כרגע. כדאי לנסות שוב בעוד כמה דקות.' : 'בגרסה הזו העוזר כבוי. השיעורים, המפה והמשימות עובדים גם בלעדיו.'}</p>
          </div>
        </div>
        <div className="chat-msg">
          <span className="chat-avatar-space" aria-hidden="true" />
          <div className="chat-bubble">
            <p>כשהעוזר מחובר, אפשר:</p>
            <ul className="ai-features">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title}><span className="ai-feature-icon" aria-hidden="true"><Icon size={20} /></span><span><b>{title}</b><span>{text}</span></span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="chat-dock" data-region="footer">
        <label htmlFor="ai-off-input" className="visually-hidden">הודעה לעוזר</label>
        <input id="ai-off-input" className="input" disabled placeholder="העוזר עוד לא מחובר" />
        <div className="ai-offline-actions">
          <Link to="/" className="btn btn-primary btn-block">להמשיך לתרגל</Link>
          {!inClass && <Link to="/settings" state={{ focus: 'ai' }} className="foot-link">איך מחברים את העוזר</Link>}
          <SupportLink className="ai-offline-support" />
        </div>
      </div>
    </section>
  );
}

/**
 * The notebook photo check (trust spec TRUST-5 §4): the warning before the camera (once a session), then PhotoPrep with
 * no default cut, where the child can black out anything personal. Only the prepared picture is kept and sent.
 */
function PhotoCheck() {
  const grade = useApp((s) => s.profile.grade) || '7';
  const [image, setImage] = useState(null);
  const [prep, setPrep] = useState(null);
  const [file, setFile] = useState(null); // the picture in PhotoPrep
  const [question, setQuestion] = useState('');
  const [state, setState] = useState({ phase: 'idle' });
  const inputRef = useRef(null);
  const { ask, warn } = usePhotoWarn();
  const pick = (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setState({ phase: 'idle' });
    if (!f.type.startsWith('image/')) { setState({ phase: 'error', message: 'אפשר לבדוק כאן רק תמונה. צלמו את הדף מהמחברת.' }); return; }
    setFile(f);
  };
  const prepared = ({ data, prep: p }) => { setImage(data); setPrep(p); setFile(null); };
  const send = async () => {
    setState({ phase: 'loading' });
    try {
      // the photo is the student's own question (policy homework): the check may say whether their final answer is right;
      // the question they typed goes as their own words, never as the app's
      const ctx = buildTutorContext({ surface: 'assistant', grade, learn: useApp.getState().learn });
      const r = await runAI('check', { ctx, image, mediaType: 'image/jpeg', question, prep });
      setState({ phase: 'done', r });
    } catch (e) { setState(e.limit ? { phase: 'idle' } : { phase: 'error', message: e.message }); }
  };
  const r = state.r;
  const outRef = useReveal(state.phase !== 'idle' ? state.phase : null);
  return (
    <div className="stack">
      <p>צלמו את הדרך שכתבתם במחברת. אבדוק כל שלב ואראה איפה כדאי לתקן.</p>
      {image ? (
        <div className="upload-picked">
          <img src={image} alt="התמונה שבחרתם" className="upload-preview" />
          <Button variant="secondary" className="btn-sm" onClick={() => ask(inputRef.current)}><Camera size={20} aria-hidden="true" />צילום אחר</Button>
        </div>
      ) : (
        <button type="button" className="upload" onClick={() => ask(inputRef.current)}>
          <span className="upload-empty"><ImageUp size={28} aria-hidden="true" />צילום או בחירת תמונה</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={pick} className="visually-hidden" tabIndex={-1} aria-hidden="true" />
      {warn}
      <PhotoPrep file={file} crop={0} onDone={prepared} onRetake={() => { setFile(null); ask(inputRef.current); }} onCancel={() => setFile(null)}
        onError={() => { setFile(null); setState({ phase: 'error', message: 'לא הצלחנו לפתוח את התמונה. נסו תמונה אחרת.' }); }} />
      <Field label="על איזה תרגיל מדובר? (לא חובה)" id="pc-q">
        <input id="pc-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="למשל: פתרו את המשוואה 3x − 5 = 10" />
      </Field>
      <div className="sheet-cta"><Button className="btn-block btn-lg" onClick={send} disabled={!image || state.phase === 'loading'}>בדיקת הפתרון</Button></div>
      <div ref={outRef} className="reveal-anchor" />
      {state.phase === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={['קורא את כתב היד', 'בודק כל שלב', 'מסכם']} /></Box>}
      {state.phase === 'error' && <p className="form-error" role="alert">{state.message}</p>}
      {state.phase === 'done' && (
        <Box tone="ai" title="בדיקת העוזר" live>
          {!r.readable && <p>{r.care ? '' : 'קשה לקרוא את התמונה. '}{r.summary}</p>}
          {r.readable && (
            <>
              <p className="check-final">{{ correct: 'התשובה הסופית נכונה.', wrong: 'יש טעות בדרך.', unfinished: 'הפתרון עוד לא גמור.', unknown: 'לא ברור מה התשובה הסופית.' }[r.final]}</p>
              <ol className="check-steps">
                {r.steps.map((st, i) => (
                  <li key={i} className={st.ok ? 'ok' : 'bad'}>
                    <span className="check-icon" aria-label={st.ok ? 'נכון' : 'טעות'}>{st.ok ? <Check size={16} /> : <X size={16} />}</span>
                    <div><Markdown>{st.text}</Markdown>{st.comment && <Markdown className="check-comment">{st.comment}</Markdown>}</div>
                  </li>
                ))}
              </ol>
              <Markdown>{r.summary}</Markdown>
            </>
          )}
        </Box>
      )}
      {state.phase === 'done' && <div className="ai-report-row"><ReportAnswer kind="check" reply={checkText(r)} /></div>}
      {state.phase === 'done' && r.care && <SupportCard variant="after-message" />}
    </div>
  );
}

const GEN_COPY = {
  intro: 'אכתוב תרגילים חדשים באותה מדרגה, בסיפורים חדשים. את המספרים ואת התשובות קובעת האפליקציה, והיא גם בודקת כל תרגיל.',
  loading: ['בוחרים מספרים מהמדרגה', 'כותבים סיפורים חדשים', 'בודקים כל תרגיל'],
  note: 'העוזר כתב את הסיפורים, הרמזים והפתרונות. האפליקציה קבעה את המספרים ובדקה כל תשובה.',
  some: 'חלק מהסיפורים לא עברו את הבדיקה, אז השלמנו בתרגילים מהמאגר.',
  none: 'הפעם הסיפורים לא עברו את הבדיקה, אז הנה תרגילים מהמאגר.',
  notCounted: 'הבקשה הזו לא נספרה.',
  bank: 'מהמאגר',
  locked: 'הפתרון כבר פתוח, אז את התרגיל הזה לא בודקים. אפשר לנסות את הבא.',
};

/**
 * One generated exercise (ai spec AI-4 Design 7). It holds its seed, the app's own exercise: the app grades the answer
 * (readAnswer and isCorrect, as in a lesson) and names the mistake (the stair's diagnosis), never the AI. The first
 * answer is recorded as practice. Opening the solution before answering locks the exercise and records nothing.
 */
function GeneratedQuestion({ ex, n }) {
  const { seed, story } = ex;
  const id = `gq-${n}`;
  const [val, setVal] = useState('');
  // answer → retry (a first miss) → shown (a second miss); right; locked (the solution was opened first)
  const [phase, setPhase] = useState('answer');
  const [line, setLine] = useState(null); // the diagnosis line under a first miss
  const [empty, setEmpty] = useState(false);
  const [solOpen, setSolOpen] = useState(false);
  const answered = useRef(false);
  const hinted = useRef(false);
  const started = useRef(Date.now());
  const done = phase === 'right' || phase === 'shown' || phase === 'locked';
  const check = () => {
    if (done) return;
    const u = readAnswer(seed, { v: val });
    if (u == null) { setEmpty(true); return; }
    setEmpty(false);
    const ok = isCorrect(seed, u);
    const diagnosis = !ok && seed.diagnosis ? seed.diagnosis(u) : null;
    const cat = ok ? null : (seed.diag ? seed.diag(u) : null);
    if (!answered.current) {
      answered.current = true;
      // the lesson's event (lib/lesson.js): practice evidence, the mistake counted, a misconception's evidence
      useApp.getState().recordAnswer({
        topic: seed.topic, level: seed.level, ok, first: true, hint: hinted.current, secs: Math.round((Date.now() - started.current) / 1000),
        at: new Date().toISOString(), purpose: 'practice', key: seed.key, cat,
        cands: diagnosis?.kind === 'misconception' ? diagnosis.candidates : undefined, could: seed.could, src: 'gen-ai',
      }, 0);
    }
    if (ok) { setPhase('right'); return; }
    if (phase === 'answer') { setLine(diagnosisLine(seed.topic, seed.level, { cat, diagnosis })); setPhase('retry'); return; }
    setPhase('shown');
  };
  const steps = story ? story.solution : seed.solution;
  const hint = (story && story.hint) || seed.hint;
  // a story is shown in its own words; a seed the AI kept (every seed with a drawing) is shown as the app shows it, with
  // its display and its drawing under it, never as the words the tutor reads for the drawing (the AI review: "[טבלה: …]")
  const prompt = story && !story.kept ? story.prompt : `${seed.text || ''}${seed.display ? ` $${displayTex(seed)}$` : ''}`;
  const answer = answerText(seed);
  // the app's own solutions end "התשובה: …"; the line is not said twice
  const saysAnswer = /^התשובה:/.test(String(steps.at(-1) || '').trim());
  const onSolution = (e) => {
    const open = e.currentTarget.open;
    setSolOpen(open);
    // the answer is on the screen now: nothing more is checked, and an exercise not answered yet is not recorded
    if (open && !done) setPhase(answered.current ? 'shown' : 'locked');
  };
  return (
    <li className="gen-q" aria-labelledby={`${id}-q`}>
      <div className="gen-q-head">
        <span className="ex-num" aria-hidden="true">{n}</span>
        <div className="gen-q-text" id={`${id}-q`}>
          {ex.from === 'bank' && <span className="gen-src">{GEN_COPY.bank}</span>}
          <Markdown>{prompt}</Markdown>
        </div>
      </div>
      {seed.fig && <div className="gen-q-fig"><Figure fig={seed.fig} /></div>}
      <div className="gen-q-answer">
        <label className="visually-hidden" htmlFor={id}>התשובה לתרגיל {n}</label>
        <input id={id} className="input slot-inline" dir="ltr" inputMode="decimal" value={val} disabled={done}
          onChange={(e) => { setVal(e.target.value); setEmpty(false); }} onKeyDown={(e) => e.key === 'Enter' && check()} placeholder="?" />
        {seed.unit && <span className="gen-unit">{seed.unit}</span>}
        <Button variant="secondary" className="btn-sm" onClick={check} disabled={done}>בדיקה</Button>
      </div>
      <div className="gen-q-result" role="status">
        {empty && <p className="gen-bad">כתבו מספר</p>}
        {phase === 'right' && <p className="gen-ok"><Check size={18} aria-hidden="true" />נכון!</p>}
        {phase === 'retry' && <p className="gen-bad">עוד לא.{line ? <span className="gen-why">{line}</span> : null}</p>}
        {phase === 'shown' && !solOpen && (
          <div className="gen-shown">
            <p>התשובה: <b className="mathline" dir="ltr">{answer}</b></p>
            <Markdown>{steps.map((st, k) => `${k + 1}. ${st}`).join('\n')}</Markdown>
          </div>
        )}
        {phase === 'locked' && <p className="muted">{GEN_COPY.locked}</p>}
      </div>
      <details className="sol" onToggle={(e) => { if (e.currentTarget.open && !answered.current) hinted.current = true; }}><summary>רמז</summary><Markdown>{hint}</Markdown></details>
      <details className="sol" onToggle={onSolution}>
        <summary>פתרון ותשובה</summary>
        <Markdown>{steps.map((st, k) => `${k + 1}. ${st}`).join('\n')}</Markdown>
        {!saysAnswer && <p>התשובה: <b className="mathline" dir="ltr">{answer}</b></p>}
      </details>
    </li>
  );
}

/** The tutor's report flag reads what was shown: each exercise's text, the app's answer, the hint and the solution. */
const shownText = (list) => generateText(list.map(({ seed, story }) => ({
  prompt: story && !story.kept ? story.prompt : itemPlain(seed), answer: answerText(seed), hint: (story && story.hint) || seed.hint, solution: story ? story.solution : seed.solution,
})));

function Generate({ initialTopic, initialLevel }) {
  const grade = useApp((s) => s.profile.grade) || '7';
  const list = topicsFor(TOPIC[initialTopic]?.grade || grade);
  const [topic, setTopic] = useState(TOPIC[initialTopic] ? initialTopic : list[0].id);
  const [level, setLevel] = useState(Number(initialLevel) || 1);
  const [count, setCount] = useState(3);
  const [state, setState] = useState({ phase: 'idle' });
  const runs = useRef(0); // each new list starts its exercises afresh
  const t = TOPIC[topic];
  const outRef = useReveal(state.phase !== 'idle' ? state.phase : null);
  const go = async () => {
    // opened from a topic's "new exercises" link, this can be the first AI action on the device: the introduction first
    if (needIntro(go)) return;
    setState({ phase: 'loading' });
    // the app chooses the exercises and computes the answers (two spares, in case a story does not pass)
    const seeds = seedsFor(skillId(topic, level), count + 2, Math.random);
    try {
      const r = await runAI('generate', { grade: t.grade, skill: skillId(topic, level), topic: t.title, stair: t.levels[level - 1].title, count, seeds: seedPayload(seeds) });
      runs.current += 1;
      setState({ phase: 'done', run: runs.current, ...exercisesFrom(seeds, r, count) });
    } catch (e) { setState(e.limit ? { phase: 'idle' } : { phase: 'error', message: e.message }); }
  };
  const short = state.phase === 'done' && state.stories < state.list.length;
  // Test hook for automated checks, as in a lesson (QA builds, or localStorage 'madregot-debug'): the exercises' seeds,
  // with their answers and diagnoses, as window.__madregotGen
  useEffect(() => {
    let on = import.meta.env.VITE_QA_HOOKS === '1';
    try { on = on || !!localStorage.getItem('madregot-debug'); } catch { /* storage blocked */ }
    if (on) window.__madregotGen = state.phase === 'done' ? state.list.map((x) => x.seed) : null;
  }, [state]);
  return (
    <div className="stack">
      <p>{GEN_COPY.intro}</p>
      <div className="grid2 gen-pick">
        <Field label="נושא" id="g-topic">
          <select id="g-topic" className="input" value={topic} onChange={(e) => { setTopic(e.target.value); setLevel(1); }}>
            {list.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </Field>
        <Field label="מדרגה" id="g-level">
          <select id="g-level" className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {t.levels.map((L, i) => <option key={L.title} value={i + 1}>{i + 1}. {L.title}</option>)}
          </select>
        </Field>
      </div>
      <div className="field"><span className="field-label" id="g-count">כמה תרגילים</span>
        <div className="segmented" role="radiogroup" aria-labelledby="g-count">
          {[3, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={count === n} className={clsx('seg', count === n && 'on')} onClick={() => setCount(n)}>{n} תרגילים</button>)}
        </div>
      </div>
      <div className="sheet-cta"><Button className="btn-block btn-lg" onClick={go} disabled={state.phase === 'loading'}>כתיבת תרגילים</Button></div>
      <div ref={outRef} className="reveal-anchor" />
      {state.phase === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={GEN_COPY.loading} /></Box>}
      {state.phase === 'error' && <p className="form-error" role="alert">{state.message}</p>}
      {state.phase === 'done' && (
        <>
          <div className="gen-note">
            <div className="gen-note-text">
              {state.stories > 0 && <p className="muted">{GEN_COPY.note}</p>}
              {state.stories === 0 && <p className="muted">{GEN_COPY.none}{state.fallback ? ` ${GEN_COPY.notCounted}` : ''}</p>}
              {state.stories > 0 && short && <p className="muted">{GEN_COPY.some}</p>}
            </div>
            {state.stories > 0 && <ReportAnswer kind="generate" reply={shownText(state.list)} />}
          </div>
          <ol className="gen-list">{state.list.map((ex, i) => <GeneratedQuestion key={`${state.run}:${ex.seed.key}`} ex={ex} n={i + 1} />)}</ol>
        </>
      )}
    </div>
  );
}

export default function Assistant() {
  const [params, setParams] = useSearchParams();
  // the photo check and new exercises are tools of the same conversation: each opens over it as a sheet
  const [tool, setTool] = useState(params.get('generate') ? 'generate' : null);
  const [locked, setLocked] = useState(null); // the tool's info state, when this device does not have it today
  const wants = params.get('generate');
  const grade = useApp((s) => s.profile.grade) || '7';
  const profile = useApp((s) => s.profile);
  const ready = aiReady();
  const status = useAIStatus((x) => x.status); // the tools follow what the server says
  const lockOf = (kind) => { const st = aiAccess(kind, status).state; return ['locked', 'economy', 'class_off', 'parent_ok_needed'].includes(st) ? st : null; };
  // the class has the tutor off under the Ministry's rules (TRUST-11 §6), or no parent has approved the tutor on this
  // device yet (TRUST-9 §4): Madi's bubble says so calmly, with no tools, and the card under it leads on (for a parent's
  // OK, to the screen for the parents); the input stays usable, so a message that reads as distress still shows the
  // card and still gets an answer
  const chatState = ready ? aiAccess('chat', status).state : null;
  // what the tutor is told here: the student's own questions (policy homework) and a learner summary, nothing personal
  const learn = useApp((s) => s.learn);
  const ctx = buildTutorContext({ surface: 'assistant', grade, learn });
  const classOff = chatState === 'class_off';
  const waiting = chatState === 'parent_ok_needed';
  const role = useApp((x) => x.profile?.role);
  const off = classOff ? limitVariant({ reason: 'class_ai_off' }) : waiting ? limitVariant({ reason: 'parent_ok_needed', role }) : null;
  useEffect(() => { if (wants) { setLocked(lockOf('generate')); setTool('generate'); } }, [wants]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setTool(null); setLocked(null); if (wants) setParams({}, { replace: true }); };
  const open = (kind, name) => {
    // before the first AI action on this device the introduction opens, and the tool after it ('intro')
    const g = gate(kind, { then: () => open(kind, name) });
    if (g === 'locked' || g === 'economy') { setLocked(g); setTool(name); return; }
    if (!g) { setLocked(null); setTool(name); }
  };
  // A conversation (LAYOUT_SPEC B3): the bar with the title, מדי's messages, and the input docked at the bottom with
  // the starters and the two tools above it. One screen, one way in: no tabs.
  return (
    <div className="page assistant-page">
      <header className="screen-bar" data-region="header">
        <span className="icon-btn-spacer" aria-hidden="true" />
        <h1 className="screen-bar-title">עוזר AI</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      {!ready ? <AiOffline /> : (
        <section className="assistant-chat" aria-label="שיחה עם העוזר" data-region="content">
          {/* who answers and where what is written goes (trust spec TRUST-1 §5); the link opens in a new tab, so the
              conversation stays */}
          {!off && (
            <p className="footnote assistant-note">
              {aiMode() === 'personal' ? 'העוזר פועל עם המפתח האישי ששמרתם במכשיר הזה.' : profile?.classCode ? 'העוזר פועל דרך השרת של הכיתה.' : 'העוזר פועל דרך השרת של האפליקציה.'}
              {' '}העוזר הוא Claude של Anthropic, תוכנה ולא אדם. מה שכותבים כאן נשלח ל־Anthropic בארה״ב ולא נשמר אצלנו.{' '}
              <Link to="/safety" target="_blank" rel="noopener noreferrer">בטיחות ופרטיות<span className="visually-hidden"> (נפתח בכרטיסייה חדשה)</span></Link>
            </p>
          )}
          {off ? (
            <AIChat context={ctx} introTitle={off.title} intro={off.text[0]} restLine={null} />
          ) : (
            <AIChat context={ctx} intro="שאלו כל שאלה במתמטיקה של כיתה ז׳ או ח׳, ואסביר צעד אחר צעד. אפשר גם לצלם פתרון לבדיקה, או לבקש תרגילים חדשים."
              tools={[
                { label: 'בדיקת פתרון מצולם', icon: Camera, onClick: () => open('check', 'photo') },
                { label: 'תרגילים חדשים', icon: Wand2, onClick: () => open('generate', 'generate') },
              ]} />
          )}
        </section>
      )}
      {ready && (
        <>
          <Sheet open={tool === 'photo'} onOpenChange={(o) => !o && close()} title="בדיקת פתרון מצולם">
            {locked ? <ToolLocked kind="check" state={locked} /> : <PhotoCheck />}
          </Sheet>
          <Sheet open={tool === 'generate'} onOpenChange={(o) => !o && close()} title="תרגילים חדשים">
            {locked ? <ToolLocked kind="generate" state={locked} /> : <Generate key={`${params.get('generate') || ''}:${params.get('level') || ''}`} initialTopic={params.get('generate')} initialLevel={params.get('level')} />}
          </Sheet>
        </>
      )}
    </div>
  );
}
