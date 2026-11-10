import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { runAI, aiReady } from '@/lib/ai.js';
import { aiAccess, useAIStatus } from '@/lib/account.js';
import { Button } from './ui.jsx';
import { Markdown } from './MathText.jsx';
import { Thinking } from './ui.jsx';
import AIAllowance from './AIAllowance.jsx';
import Mascot from './Mascot.jsx';

const STARTERS = ['איך מתחילים?', 'אפשר רמז קטן?', 'למה זה ככה?'];
const THINK = ['קורא את התרגיל', 'חושב על הדרך', 'מנסח הסבר'];

/**
 * Chat with the AI tutor, optionally about the exercise on screen.
 * Pass `messages` and `onMessages` to keep the conversation outside (it then survives closing the sheet).
 * When the tutor is done for today the input waits (the draft is kept) and a calm card says when it is back; `onDone`
 * is "continue practising" there (closing the sheet in a lesson), `onMadi` the opener's way to Madi.
 */
export default function AIChat({ context, intro, messages: kept, onMessages, tools, onDone, onMadi }) {
  const navigate = useNavigate();
  const status = useAIStatus((x) => x.status);
  const access = aiAccess('chat', status);
  const resting = ['used', 'paused', 'resting'].includes(access.state);
  const [own, setOwn] = useState([]);
  const messages = kept ?? own;
  const setMessages = onMessages ?? setOwn;
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const abortRef = useRef(null);

  // A conversation kept outside is not cut off when the chat closes: the reply still arrives there.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (!onMessages) abortRef.current?.abort(); }, []);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, streaming, pending]);

  const send = async (text) => {
    const content = (text ?? draft).trim();
    if (!content || pending || resting) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next); setDraft(''); setError(''); setPending(true); setStreaming('');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await runAI('chat', { messages: next, context }, { onText: setStreaming, signal: ctrl.signal, onMadi });
      setMessages([...next, { role: 'assistant', content: res.text }]);
    } catch (e) {
      if (e.name === 'AbortError') return;
      // a limit is said calmly by the sheet and the card below, never as a red error
      if (!e.limit) setError(e.message);
      setMessages(next.slice(0, -1)); setDraft(content);
    } finally { setPending(false); setStreaming(''); }
  };

  if (!aiReady()) {
    return <p className="muted">העוזר עוד לא מחובר. אפשר לחבר אותו בהגדרות.</p>;
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {/* the same conversation layout everywhere (LAYOUT_SPEC B3): מדי opens with a bubble, the starters wait
            above the input, and the input is docked at the bottom */}
        {intro && (
          <div className="msg-row assistant chat-intro">
            <Mascot mood="happy" size={34} className="msg-avatar" />
            <div className="msg assistant"><p>{intro}</p></div>
          </div>
        )}
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
        {!pending && !resting && <AIAllowance className="chat-left" kind="chat" />}
      </div>
      <div className="chat-dock-live" data-region="footer">
        {resting && (
          <section className="chat-rest" role="status" aria-label="העוזר החכם">
            <p>{access.state === 'used' ? 'להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.' : 'העוזר החכם נח היום. מחר הוא חוזר.'}</p>
            <div className="chat-rest-actions">
              <Button className="btn-sm" onClick={() => (onDone ? onDone() : navigate('/'))}>להמשיך לתרגל</Button>
              <Button variant="secondary" className="btn-sm" onClick={() => navigate('/topics')}>מה מדי יודע להסביר</Button>
            </div>
          </section>
        )}
        {messages.length === 0 && !resting && (
          <div className="starters chat-chips">
            {STARTERS.map((s) => <button key={s} type="button" className="starter" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {tools?.length > 0 && (
          <div className="chat-tools" role="group" aria-label="עוד דרכים לעזרה">
            {tools.map(({ label, icon: Icon, onClick }) => <button key={label} type="button" className="chat-tool" onClick={onClick}><Icon size={18} aria-hidden="true" />{label}</button>)}
          </div>
        )}
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="chat-draft" className="visually-hidden">ההודעה שלכם</label>
          <textarea id="chat-draft" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={resting ? 'העוזר החכם חוזר מחר' : 'כתבו שאלה…'} maxLength={1000}
            disabled={resting} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="submit" className="icon-btn send" disabled={!draft.trim() || pending || resting} aria-label="שליחה"><Send size={20} aria-hidden="true" /></button>
        </form>
      </div>
    </div>
  );
}
