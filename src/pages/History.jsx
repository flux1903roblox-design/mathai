const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { History as HistoryIcon, Search, Star, ScanLine, X, ChevronLeft, Tag } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

import { gradeLabel } from '@/lib/curriculum';
import MathMarkdown from '@/components/MathMarkdown';
import { Link } from 'react-router-dom';

export default function History() {
  const { user, checkUserAuth } = useAuth();
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [active, setActive] = useState(null);

  const load = () => {
    if (!user?.id) return;
    db.entities.SolvedQuestion
      .filter({ created_by_id: user.id }, '-created_date', 100)
      .then(setItems)
      .catch(() => setItems([]));
  };
  useEffect(load, [user?.id]);

  const topics = useMemo(() => {
    const set = new Set();
    items?.forEach((i) => i.topic && set.add(i.topic));
    return [...set];
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((i) => {
      const matchQ = !query || (i.question_text || '').toLowerCase().includes(query.toLowerCase()) || (i.solution || '').toLowerCase().includes(query.toLowerCase());
      const matchT = topic === 'all' || i.topic === topic;
      return matchQ && matchT;
    });
  }, [items, query, topic]);

  const toggleFav = async (q) => {
    await db.entities.SolvedQuestion.update(q.id, { is_favorite: !q.is_favorite });
    load();
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center btn-glow">
          <HistoryIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-display">היסטוריית שאלות</h1>
          <p className="text-xs text-muted-foreground">כל מה שפתרת — חיפוש ומועדפים</p>
        </div>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בשאלות…"
            className="w-full glass rounded-xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-violet-500/40 text-sm"
          />
        </div>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="glass rounded-xl px-3 outline-none text-sm max-w-[40%]">
          <option value="all">כל הנושאים</option>
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered === null ? (
        <div className="card-base p-6 text-center text-sm text-muted-foreground animate-pulse-soft">טוען…</div>
      ) : filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <ScanLine className="w-8 h-8 text-violet-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{items?.length === 0 ? 'עדיין אין שאלות שמורות' : 'אין תוצאות לחיפוש'}</p>
          <Link to="/scan" className="inline-flex items-center gap-2 bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold px-5 py-2.5 rounded-xl btn-glow">
            סרוק שאלה ראשונה
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <button key={q.id} onClick={() => setActive(q)} className="card-base p-3.5 flex items-center gap-3 w-full text-right hover:bg-white/[0.07] transition">
              {q.image_url ? (
                <img src={q.image_url} className="w-11 h-11 rounded-lg object-cover bg-black/30 shrink-0" alt="" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-white/5 grid place-items-center shrink-0"><ScanLine className="w-4 h-4 text-violet-300" /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{q.question_text || 'שאלה'}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Tag className="w-3 h-3" /> {q.topic || '—'}
                  {q.final_answer && <span className="text-cyan-300" dir="ltr">· {q.final_answer}</span>}
                </div>
              </div>
              <span onClick={(e) => { e.stopPropagation(); toggleFav(q); }} className="shrink-0 p-1.5">
                <Star className={`w-4 h-4 ${q.is_favorite ? 'fill-amber-300 text-amber-300' : 'text-muted-foreground'}`} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* detail drawer */}
      {active && (
        <div className="fixed inset-0 z-50 flex justify-start" onClick={() => setActive(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md h-full glass-strong border-l border-white/10 overflow-y-auto scrollbar-thin p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setActive(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
                <ChevronLeft className="w-4 h-4" /> חזרה
              </button>
              <span onClick={() => toggleFav(active)} className="p-1.5">
                <Star className={`w-5 h-5 ${active.is_favorite ? 'fill-amber-300 text-amber-300' : 'text-muted-foreground'}`} />
              </span>
            </div>
            {active.image_url && <img src={active.image_url} className="w-full rounded-xl mb-4 max-h-56 object-contain bg-black/30" alt="" />}
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Tag className="w-3 h-3" /> {active.topic || '—'} · כיתה {gradeLabel(user.grade)}</div>
            <div className="font-bold text-sm mb-3">{active.question_text}</div>
            <div className="math-prose text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
              <MathMarkdown>{active.solution || ''}</MathMarkdown>
            </div>
            {active.final_answer && (
              <div className="mt-4 rounded-xl bg-gradient-to-l from-violet-500/15 to-cyan-400/15 border border-white/15 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">תשובה סופית</span>
                <span className="text-base font-bold gradient-text" dir="ltr">{active.final_answer}</span>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}