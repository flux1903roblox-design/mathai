import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Mascot from '@/components/Mascot.jsx';
import clsx from 'clsx';
import { Camera, MessageCircle, Wand2, Check, X, ImageUp } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { runAI, aiReady, aiMode } from '@/lib/ai.js';
import { gate, aiAccess, useAIStatus } from '@/lib/account.js';
import ToolLocked from '@/components/ToolLocked.jsx';
import SupportCard from '@/components/SupportCard.jsx';
import { SupportLink } from '@/components/SupportSheet.jsx';
import { TOPIC, topicsFor } from '@/content/index.js';
import { parseNum, near } from '@/content/util.js';
import AIChat from '@/components/AIChat.jsx';
import { Box, Button, Field, Sheet, Thinking } from '@/components/ui.jsx';
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
    { icon: MessageCircle, title: 'שיחה עם המורה הפרטי', text: 'שואלים כל שאלה, ומקבלים הסבר צעד אחר צעד.' },
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

async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

function PhotoCheck() {
  const grade = useApp((s) => s.profile.grade) || '7';
  const [image, setImage] = useState(null);
  const [question, setQuestion] = useState('');
  const [state, setState] = useState({ phase: 'idle' });
  const pick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setState({ phase: 'idle' });
    try { setImage(await shrinkImage(f)); } catch { setState({ phase: 'error', message: 'לא הצלחנו לפתוח את התמונה. נסו תמונה אחרת.' }); }
  };
  const send = async () => {
    setState({ phase: 'loading' });
    try {
      const r = await runAI('check', { image: image, mediaType: 'image/jpeg', question, grade });
      setState({ phase: 'done', r });
    } catch (e) { setState(e.limit ? { phase: 'idle' } : { phase: 'error', message: e.message }); }
  };
  const r = state.r;
  const outRef = useReveal(state.phase !== 'idle' ? state.phase : null);
  return (
    <div className="stack">
      <p>צלמו את הדרך שכתבתם במחברת. אבדוק כל שלב ואראה איפה כדאי לתקן.</p>
      <label className="upload">
        <input type="file" accept="image/*" capture="environment" onChange={pick} className="visually-hidden" />
        {image ? <img src={image} alt="התמונה שבחרתם" className="upload-preview" /> : <span className="upload-empty"><ImageUp size={28} aria-hidden="true" />צילום או בחירת תמונה</span>}
      </label>
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
      {state.phase === 'done' && r.care && <SupportCard variant="after-message" />}
    </div>
  );
}

function GeneratedQuestion({ q, i }) {
  const [val, setVal] = useState(''); const [res, setRes] = useState(null);
  const check = () => { const u = parseNum(val); const a = parseNum(q.answer); setRes(u == null ? 'empty' : a != null && near(u, a, 0.01) ? 'ok' : 'bad'); };
  return (
    <li className="gen-q">
      <div className="gen-q-head"><span className="ex-num">{i + 1}</span><Markdown>{q.prompt}</Markdown></div>
      <div className="gen-q-answer">
        <label className="visually-hidden" htmlFor={`gq-${i}`}>התשובה לתרגיל {i + 1}</label>
        <input id={`gq-${i}`} className="input slot-inline" dir="ltr" value={val} onChange={(e) => { setVal(e.target.value); setRes(null); }} onKeyDown={(e) => e.key === 'Enter' && check()} placeholder="?" />
        <Button variant="secondary" className="btn-sm" onClick={check}>בדיקה</Button>
        {res === 'ok' && <span className="gen-ok"><Check size={18} aria-hidden="true" />נכון</span>}
        {res === 'bad' && <span className="gen-bad">עוד לא</span>}
        {res === 'empty' && <span className="gen-bad">כתבו מספר</span>}
      </div>
      <details className="sol"><summary>רמז</summary><Markdown>{q.hint}</Markdown></details>
      <details className="sol"><summary>פתרון ותשובה</summary><Markdown>{q.solution.map((s, k) => `${k + 1}. ${s}`).join('\n')}</Markdown><p>התשובה: <b className="mathline">{q.answer}</b></p></details>
    </li>
  );
}

function Generate({ initialTopic, initialLevel }) {
  const grade = useApp((s) => s.profile.grade) || '7';
  const list = topicsFor(TOPIC[initialTopic]?.grade || grade);
  const [topic, setTopic] = useState(TOPIC[initialTopic] ? initialTopic : list[0].id);
  const [level, setLevel] = useState(Number(initialLevel) || 1);
  const [count, setCount] = useState(3);
  const [state, setState] = useState({ phase: 'idle' });
  const t = TOPIC[topic];
  const outRef = useReveal(state.phase !== 'idle' ? state.phase : null);
  const go = async () => {
    setState({ phase: 'loading' });
    try {
      const sample = t.levels[level - 1].gen();
      const r = await runAI('generate', { grade: t.grade, topic: t.title, level: t.levels[level - 1].title, count, examples: `${sample.text} ${sample.display || ''}` });
      if (!r.questions?.length) throw new Error('העוזר לא החזיר תרגילים. נסו שוב.');
      setState({ phase: 'done', qs: r.questions });
    } catch (e) { setState(e.limit ? { phase: 'idle' } : { phase: 'error', message: e.message }); }
  };
  return (
    <div className="stack">
      <p>אכתוב תרגילים חדשים באותה רמה, עם רמז ופתרון לכל אחד.</p>
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
      {state.phase === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={['כותב תרגילים', 'פותר כל תרגיל', 'בודק את התשובות']} /></Box>}
      {state.phase === 'error' && <p className="form-error" role="alert">{state.message}</p>}
      {state.phase === 'done' && (
        <>
          <p className="muted">התרגילים נכתבו על ידי העוזר. אם משהו נראה לא נכון, ספרו למורה.</p>
          <ol className="gen-list">{state.qs.map((q, i) => <GeneratedQuestion key={i} q={q} i={i} />)}</ol>
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
  const lockOf = (kind) => { const st = aiAccess(kind, status).state; return st === 'locked' || st === 'economy' ? st : null; };
  useEffect(() => { if (wants) { setLocked(lockOf('generate')); setTool('generate'); } }, [wants]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setTool(null); setLocked(null); if (wants) setParams({}, { replace: true }); };
  const open = (kind, name) => {
    const g = gate(kind);
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
          <p className="footnote assistant-note">{aiMode() === 'personal' ? 'העוזר פועל עם המפתח האישי ששמרתם במכשיר הזה.' : profile?.classCode ? 'העוזר פועל דרך השרת של הכיתה.' : 'העוזר פועל דרך השרת של האפליקציה.'} Claude של Anthropic.</p>
          <AIChat context={{ grade }} intro="שאלו כל שאלה במתמטיקה של כיתה ז׳ או ח׳, ואסביר צעד אחר צעד. אפשר גם לצלם פתרון לבדיקה, או לבקש תרגילים חדשים."
            tools={[
              { label: 'בדיקת פתרון מצולם', icon: Camera, onClick: () => open('check', 'photo') },
              { label: 'תרגילים חדשים', icon: Wand2, onClick: () => open('generate', 'generate') },
            ]} />
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
