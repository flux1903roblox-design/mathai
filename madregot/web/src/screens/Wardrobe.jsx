// "המדי שלי" (STUDENT-3): the student styles מדי with what learning earned. Madi stands at the top in the look being
// worn; under him, one radio group of colours and one per slot (בלי first). A choice is saved at once (no save button
// and no toast: the change is visible). A locked option stays focusable and says how it opens.
// The groups are Base UI RadioGroups in a right-to-left DirectionProvider, so arrow keys follow the reading direction.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useApp } from '@/lib/store.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { COLORS, ITEMS, SLOTS, SLOT_NAME, MADI_PALETTE, ownedLook, lockedReason, itemOf, colorOf, nameOf } from '@/lib/wardrobe.js';
import { TOPIC } from '@/content/index.js';
import Mascot from '@/components/Mascot.jsx';
import { ItemArt } from '@/components/mascot/Accessories.jsx';
import { Sheet, Button } from '@/components/ui.jsx';
import { count } from '@/lib/metrics.js';

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

/**
 * Base UI's composite skips items marked aria-disabled when the arrow keys move, so a locked option could never be
 * reached from the keyboard. While an arrow key is handled, the locked options of the group lose the attribute (and
 * get it back right after), so they are focusable and still announced as unavailable.
 */
function reachLocked(e) {
  if (!e.key.startsWith('Arrow')) return;
  const locked = [...e.currentTarget.querySelectorAll('[data-locked][aria-disabled="true"]')];
  locked.forEach((el) => el.removeAttribute('aria-disabled'));
  setTimeout(() => locked.forEach((el) => el.setAttribute('aria-disabled', 'true')), 0);
}

function Option({ id, label, sub, art, locked, describedBy, onLocked }) {
  return (
    <Radio.Root
      value={id}
      data-value={id}
      className={clsx('wardrobe-opt', locked && 'is-locked')}
      data-locked={locked || undefined}
      aria-disabled={locked || undefined}
      aria-describedby={describedBy}
      // a locked option opens its reason: a click or a tap, Enter, or Space (Base UI's own handler is skipped, so it is never chosen)
      onClick={locked ? (e) => { e.preventBaseUIHandler?.(); onLocked(id); } : undefined}
      onKeyDown={locked ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLocked(id); } } : undefined}
    >
      <span className="wardrobe-pic">{art}</span>
      <span className="wardrobe-text">
        <span className="wardrobe-name">{label}</span>
        {sub && <span className="wardrobe-sub">{sub}</span>}
      </span>
      <span className="wardrobe-mark" aria-hidden="true">{locked ? <Lock size={18} /> : <Radio.Indicator className="wardrobe-check"><Check size={18} strokeWidth={3} /></Radio.Indicator>}</span>
    </Radio.Root>
  );
}

function Group({ id, title, value, options, owned, grade, classColor, onChoose, onLocked }) {
  const uid = useId();
  return (
    <section className="section wardrobe-group" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="set-head">{title}</h2>
      <RadioGroup
        value={value} aria-labelledby={`${uid}-h`} className="wardrobe-grid" onKeyDownCapture={reachLocked}
        onValueChange={(v, details) => {
          // moving onto a locked option with the arrow keys focuses it; it is never chosen
          if (v !== NONE && !owned.has(v)) { details.cancel(); return; }
          onChoose(id, v);
        }}
      >
        {options.map((o) => {
          if (o === NONE) return <Option key={NONE} id={NONE} label="בלי" art={<span className="wardrobe-none" />} />;
          const locked = !owned.has(o);
          return (
            <Option key={o} id={o} label={nameOf(o)} locked={locked} onLocked={onLocked}
              sub={locked ? 'נעול' : owned.why.get(o)} describedBy={locked ? `${uid}-${o}` : undefined}
              art={colorOf(o) ? <Swatch id={o} /> : <ItemArt id={o} classColor={classColor} className="wardrobe-art" />} />
          );
        })}
      </RadioGroup>
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
      <DirectionProvider direction="rtl">
        {groups.map((g) => (
          <Group key={g.id} {...g} owned={owned} grade={grade} classColor={worn.classColor} onChoose={choose} onLocked={setLocked} />
        ))}
      </DirectionProvider>
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
