import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { runAI, aiReady } from '@/lib/ai.js';
import { Markdown } from './MathText.jsx';
import { Thinking } from './ui.jsx';
import Mascot from './Mascot.jsx';

const STARTERS = ['איך מתחילים?', 'אפשר רמז קטן?', 'למה זה ככה?'];
const THINK = ['קורא את התרגיל', 'חושב על הדרך', 'מנסח הסבר'];

/** Chat with the AI tutor, optionally about the exercise on screen. */
export default function AIChat({ context, intro }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, streaming, pending]);

  const send = async (text) => {
    const content = (text ?? draft).trim();
    if (!content || pending) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next); setDraft(''); setError(''); setPending(true); setStreaming('');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await runAI('chat', { messages: next, context }, { onText: setStreaming, signal: ctrl.signal });
      setMessages([...next, { role: 'assistant', content: res.text }]);
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e.message);
      setMessages(next.slice(0, -1)); setDraft(content);
    } finally { setPending(false); setStreaming(''); }
  };

  if (!aiReady()) {
    return <p className="muted">העוזר עוד לא מחובר. אפשר לחבר אותו במסך "אני".</p>;
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {intro && messages.length === 0 && <p className="chat-intro">{intro}</p>}
        {messages.map((m, i) => (
          <div key={i} className={`msg-row ${m.role}`}>
            {m.role === 'assistant' && <Mascot mood="idle" size={34} className="msg-avatar" />}
            <div className={`msg ${m.role}`}>
              {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <p>{m.content}</p>}
            </div>
          </div>
        ))}
        {pending && (
          <div className="msg-row assistant">
            <Mascot mood="thinking" size={34} className="msg-avatar" />
            <div className="msg assistant">
              {streaming ? <p className="streaming">{streaming}</p> : <Thinking states={THINK} />}
            </div>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      {messages.length === 0 && (
        <div className="starters">
          {STARTERS.map((s) => <button key={s} type="button" className="starter" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="chat-draft" className="visually-hidden">ההודעה שלכם</label>
        <textarea id="chat-draft" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="כתבו שאלה…" maxLength={1000}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button type="submit" className="icon-btn send" disabled={!draft.trim() || pending} aria-label="שליחה"><Send size={20} aria-hidden="true" /></button>
      </form>
    </div>
  );
}
