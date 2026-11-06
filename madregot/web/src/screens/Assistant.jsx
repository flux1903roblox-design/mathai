import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import { Camera, MessageCircle, Wand2, Check, X, ImageUp } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { runAI, aiReady, aiMode } from '@/lib/ai.js';
import { TOPIC, topicsFor } from '@/content/index.js';
import { parseNum, near } from '@/content/util.js';
import AIChat from '@/components/AIChat.jsx';
import { Box, Button, Field, Thinking } from '@/components/ui.jsx';
import { Markdown } from '@/components/MathText.jsx';

const TABS = [
  { id: 'chat', label: 'שיחה', icon: MessageCircle },
  { id: 'photo', label: 'בדיקת פתרון', icon: Camera },
  { id: 'generate', label: 'תרגילים', icon: Wand2 },
];

/** Segmented tabs with a sliding pill (transitions.dev #16). */
function Tabs({ value, onChange }) {
  const refs = useRef({}); const [pill, setPill] = useState(null); const first = useRef(true);
  useEffect(() => {
    const el = refs.current[value]; if (!el) return;
    setPill({ x: el.offsetLeft, w: el.offsetWidth, instant: first.current }); first.current = false;
  }, [value]);
  return (
    <div className="tabs" role="tablist" aria-label="מה העוזר יעשה">
      {pill && <span className={clsx('tabs-pill', pill.instant && 'instant')} style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} aria-hidden="true" />}
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} ref={(el) => { refs.current[id] = el; }} type="button" role="tab" aria-selected={value === id} aria-controls={`panel-${id}`} id={`tab-${id}`}
          className={clsx('tab-btn', value === id && 'on')} onClick={() => onChange(id)}>
          <Icon size={18} aria-hidden="true" />{label}
        </button>
      ))}
    </div>
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
    } catch (e) { setState({ phase: 'error', message: e.message }); }
  };
  const r = state.r;
  return (
    <div className="stack">
      <p className="lead">צלמו את הדרך שכתבתם במחברת. העוזר יבדוק כל שלב ויראה איפה כדאי לתקן.</p>
      <label className="upload">
        <input type="file" accept="image/*" capture="environment" onChange={pick} className="visually-hidden" />
        {image ? <img src={image} alt="התמונה שבחרתם" className="upload-preview" /> : <span className="upload-empty"><ImageUp size={28} aria-hidden="true" />צילום או בחירת תמונה</span>}
      </label>
      <Field label="על איזה תרגיל מדובר? (לא חובה)" id="pc-q">
        <input id="pc-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="למשל: פתרו את המשוואה 3x − 5 = 10" />
      </Field>
      <Button className="btn-block" onClick={send} disabled={!image || state.phase === 'loading'}>בדיקת הפתרון</Button>
      {state.phase === 'loading' && <Box tone="ai" title="העוזר"><Thinking states={['קורא את כתב היד', 'בודק כל שלב', 'מסכם']} /></Box>}
      {state.phase === 'error' && <p className="form-error" role="alert">{state.message}</p>}
      {state.phase === 'done' && (
        <Box tone="ai" title="בדיקת העוזר" live>
          {!r.readable && <p>קשה לקרוא את התמונה. {r.summary}</p>}
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
  const go = async () => {
    setState({ phase: 'loading' });
    try {
      const sample = t.levels[level - 1].gen();
      const r = await runAI('generate', { grade: t.grade, topic: t.title, level: t.levels[level - 1].title, count, examples: `${sample.text} ${sample.display || ''}` });
      if (!r.questions?.length) throw new Error('העוזר לא החזיר תרגילים. נסו שוב.');
      setState({ phase: 'done', qs: r.questions });
    } catch (e) { setState({ phase: 'error', message: e.message }); }
  };
  return (
    <div className="stack">
      <p className="lead">העוזר כותב תרגילים חדשים באותה רמה. אחרי שמסיימים את המדרגות, זו דרך טובה להתאמן עוד.</p>
      <div className="grid2">
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
      <Button className="btn-block" onClick={go} disabled={state.phase === 'loading'}>כתיבת תרגילים</Button>
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
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('generate') ? 'generate' : 'chat');
  const grade = useApp((s) => s.profile.grade) || '7';
  const ready = aiReady();
  return (
    <div className="page">
      <h1 className="h-page">עוזר AI</h1>
      {!ready && (
        <Box tone="attention" title="העוזר עוד לא מחובר">
          <p>כדי שהעוזר יעבוד, צריך לחבר אותו לשרת של הכיתה או למפתח Claude אישי.</p>
          <Link to="/me" className="btn btn-secondary btn-sm">לחיבור במסך "אני"</Link>
        </Box>
      )}
      <Tabs value={tab} onChange={setTab} />
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === 'chat' && <AIChat context={{ grade }} intro="שאלו כל שאלה במתמטיקה של כיתה ז׳ או ח׳. העוזר יסביר צעד אחר צעד." />}
        {tab === 'photo' && <PhotoCheck />}
        {tab === 'generate' && <Generate initialTopic={params.get('generate')} initialLevel={params.get('level')} />}
      </div>
      {ready && <p className="footnote">{aiMode() === 'personal' ? 'העוזר פועל עם המפתח האישי ששמרתם במכשיר הזה.' : 'העוזר פועל דרך השרת של הכיתה.'} Claude של Anthropic.</p>}
    </div>
  );
}
