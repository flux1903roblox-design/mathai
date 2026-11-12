// "המדי שלי" (STUDENT-3): the student styles מדי with what learning earned. Madi stands at the top in the look being
// worn; under him, one radio group of colours and one per slot (בלי first). A choice is saved at once (no save button
// and no toast: the change is visible). A locked option stays focusable and says how it opens.
// Each group is the shared Choices (components/ui.jsx: Base UI's RadioGroup; App.jsx sets the direction to right to
// left, so the arrow keys follow the reading order).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { COLORS, ITEMS, SLOTS, SLOT_NAME, MADI_PALETTE, ownedLook, lockedReason, itemOf, colorOf, nameOf } from '@/lib/wardrobe.js';
import { TOPIC } from '@/content/topics.js';
import Mascot from '@/components/Mascot.jsx';
import { ItemArt } from '@/components/mascot/Accessories.jsx';
import { Sheet, Button, Choices, Choice, ChoiceMark } from '@/components/ui.jsx';
import { count } from '@/lib/metrics.js';
import '@/styles/lazy/wardrobe.css'; // this screen's own rules, loaded with it (STUDENT-15)

const NONE = 'none';
// how long Madi looks happy after a change (no hop under reduced motion: Mascot keeps still)
const HAPPY_MS = 900;

/** A colour as a small Madi shape (his two steps) in that colour. */
function Swatch({ id }) {
  const p = MADI_PALETTE[id];
  return (
    <svg viewBox="20 24 106 106" className="wardrobe-art" aria-hidden="true" focusable="false">
      <rect x="26" y="30" width="62" height="94" rx="17" style={{ fill: p.lo }} />
      <rect x="26" y="66" width="94" height="58" rx="17" style={{ fill: p.lo }} />
      <rect x="35" y="34" width="44" height="6" rx="3" style={{ fill: p.tread }} />
      <rect x="93" y="70" width="20" height="6" rx="3" style={{ fill: p.tread }} />
    </svg>
  );
}

function Option({ id, label, sub, art, locked, describedBy, onLocked }) {
  return (
    <Choice value={id} locked={locked} onLocked={onLocked} describedBy={describedBy} className={clsx('wardrobe-opt', locked && 'is-locked')}>
      <span className="wardrobe-pic">{art}</span>
      <span className="wardrobe-text">
        <span className="wardrobe-name">{label}</span>
        {sub && <span className="wardrobe-sub">{sub}</span>}
      </span>
      <span className="wardrobe-mark" aria-hidden="true">{locked ? <Lock size={18} /> : <ChoiceMark className="wardrobe-check"><Check size={18} strokeWidth={3} /></ChoiceMark>}</span>
    </Choice>
  );
}

function Group({ id, title, value, options, owned, grade, classColor, onChoose, onLocked }) {
  const uid = useId();
  return (
    <section className="section wardrobe-group" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="set-head">{title}</h2>
      {/* moving onto a locked option with the arrow keys focuses it; it is never chosen */}
      <Choices value={value} labelledBy={`${uid}-h`} className="wardrobe-grid" locked={options.filter((o) => o !== NONE && !owned.has(o))} onValueChange={(v) => onChoose(id, v)}>
        {options.map((o) => {
          if (o === NONE) return <Option key={NONE} id={NONE} label="בלי" art={<span className="wardrobe-none" />} />;
          const locked = !owned.has(o);
          return (
            <Option key={o} id={o} label={nameOf(o)} locked={locked} onLocked={onLocked}
              sub={locked ? 'נעול' : owned.why.get(o)} describedBy={locked ? `${uid}-${o}` : undefined}
              art={colorOf(o) ? <Swatch id={o} /> : <ItemArt id={o} classColor={classColor} className="wardrobe-art" />} />
          );
        })}
      </Choices>
      {/* how each locked option opens, read out with it */}
      {options.filter((o) => o !== NONE && !owned.has(o)).map((o) => <span key={o} id={`${uid}-${o}`} className="visually-hidden">{lockedReason(o, grade).text}</span>)}
    </section>
  );
}

export default function Wardrobe() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const look = useApp((s) => s.look);
  const setLook = useApp((s) => s.setLook);
  const markEarned = useApp((s) => s.markEarned);
  const path = useApp((s) => s.path);
  const classGoals = useApp((s) => s.classGoals);
  const profile = useApp((s) => s.profile);
  const worn = useMadiLook();
  const grade = profile?.grade || '7';
  const owned = useMemo(() => {
    const o = ownedLook({ path, classGoals, grade, earned: look?.earned });
    return { has: (id) => o.colors.has(id) || o.items.has(id), why: o.why };
  }, [path, classGoals, grade, look?.earned]);
  const [mood, setMood] = useState('idle');
  const [beat, setBeat] = useState(0);
  const [locked, setLocked] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  // one more opening of the wardrobe today, counted with no one behind it (STUDENT-14; nothing without a server)
  useEffect(() => { count('wardrobe_open'); }, []);

  const choose = (group, v) => {
    setLook(group === 'color' ? { color: v } : { [group]: v === NONE ? null : v });
    // a piece put on here has been seen: the next result does not announce it as new
    if (v !== NONE && v !== 'sky') markEarned([v]);
    setMood('happy'); setBeat((b) => b + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMood('idle'), HAPPY_MS);
  };

  // ?try=<id> (the chest card's "לנסות על מדי"): an owned piece goes on, and its option takes the focus
  useEffect(() => {
    const id = params.get('try');
    if (!id) return;
    if (owned.has(id)) {
      const it = itemOf(id);
      choose(it ? it.slot : 'color', id);
    }
    setParams({}, { replace: true });
    requestAnimationFrame(() => {
      const el = document.querySelector(`.wardrobe-opt[data-value="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ block: 'center' }); // clear of Madi, who stays on top
      el?.focus({ preventScroll: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a solo student has no class goal to reach, so the class scarf is shown only in a class
  const inClass = !!profile?.classCode;
  const groups = [
    { id: 'color', title: 'צבע', value: worn.color, options: COLORS.map((c) => c.id) },
    ...SLOTS.map((slot) => ({ id: slot, title: SLOT_NAME[slot], value: worn[slot] || NONE, options: [NONE, ...ITEMS.filter((i) => i.slot === slot && (i.id !== 'class-scarf' || inClass)).map((i) => i.id)] })),
  ];
  const reason = locked ? lockedReason(locked, grade) : null;

  return (
    <div className="page pushed wardrobe">
      <header className="screen-bar" data-region="header">
        <button type="button" className="icon-btn" onClick={() => navigate('/me')} aria-label="חזרה"><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">המדי שלי</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <div className="wardrobe-stage">
        <Mascot size={160} mood={mood} beat={beat} className="wardrobe-madi" />
      </div>
      <p className="wardrobe-sub-head">צבעים ואביזרים מקבלים כשלומדים: חצי ראשון של יחידה פותח אביזר, ויחידה שלמה פותחת צבע.</p>
      {groups.map((g) => (
        <Group key={g.id} {...g} owned={owned} grade={grade} classColor={worn.classColor} onChoose={choose} onLocked={setLocked} />
      ))}
      <Sheet open={!!locked} onOpenChange={(o) => !o && setLocked(null)} title={locked ? nameOf(locked) : ''}>
        {reason && (
          <div className="wardrobe-lock">
            <p className="lead">{reason.text}</p>
            {reason.topic && (
              <Button className="btn-block btn-lg" onClick={() => navigate('/', { state: { from: reason.topic, grade: TOPIC[reason.topic].grade } })}>ליחידת {TOPIC[reason.topic].title}</Button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
