const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Send, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

import { chatReply } from '@/lib/llm';
import { consumeAction, getActions, isPro } from '@/lib/mathActions';
import PaywallGate from '@/components/PaywallGate';
import MathMarkdown from '@/components/MathMarkdown';

const SUGGESTIONS = [
  'הסבר על נגזרת של פולינום',
  'איך פותרים משוואה ריבועית?',
  'משפט פיתגורס — דוגמה',
  'מה ההפרש בין תוחלת לסטנדרט דוויאציה?',
];

export default function Chat() {
  const { user, checkUserAuth } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const blocked = !isPro(user) && getActions(user) <= 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading || blocked) return;
    setInput('');
    const userMsg = { role: 'user', content };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      await consumeAction(user);
      await checkUserAuth();
      const reply = await chatReply(messages, content, user);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      db.entities.ChatMessage.create({ role: 'user', content }).catch(() => {});
      db.entities.ChatMessage.create({ role: 'assistant', content: reply }).catch(() => {});
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'מצטער, לא הצלחתי לענות כעת. נסה שוב.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-9rem)] lg:h-[calc(100vh-5rem)]">
      <header className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center btn-glow">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-display">צ׳אט עם המורה</h1>
          <p className="text-xs text-muted-foreground">שאל כל שאלה — מאלגברה ועד חדו״א</p>
        </div>
      </header>

      {blocked ? (
        <PaywallGate reason="אזלו לך הפעולות החינמיות — שדרג ל-Pro לצ׳אט ללא הגבלה" />
      ) : (
        <>
          <div className="card-base flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center mx-auto mb-3 btn-glow">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <p className="font-bold">שאל אותי הכל</p>
                <p className="text-sm text-muted-foreground mt-1">אני כאן לעזור בכל נושא מתמטיקה</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="glass rounded-full px-3 py-1.5 text-xs hover:bg-white/10 transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-l from-violet-500 to-cyan-400 text-white rounded-bl-md whitespace-pre-wrap'
                    : 'glass rounded-br-md math-prose'
                }`}>
                  {m.role === 'user' ? m.content : <MathMarkdown>{m.content}</MathMarkdown>}
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="glass rounded-2xl rounded-br-md px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="shrink-0 flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              dir="rtl"
              placeholder="כתוב שאלה…"
              className="flex-1 glass rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 focus:ring-violet-500/40 text-[15px] max-h-32"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center btn-glow disabled:opacity-40 transition shrink-0">
              {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}