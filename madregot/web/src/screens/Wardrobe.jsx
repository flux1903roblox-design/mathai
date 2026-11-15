// "המדי שלי" (STUDENT-3): the student styles מדי with what learning earned. Madi stands at the top in the look being
// worn; under him, the meter of the next piece ("החלק הבא: עוד 2 שלבים", PRODUCT2-36), the quest chest's choice when one
// waits, one radio group of the colours owned and one per slot that has a piece (בלי first), and last the few pieces
// that come next, each saying how it opens, with the count of the rest: never a wall of locked tiles. A choice is saved
// at once (no save button and no toast: the change is visible). A coming piece is a button that opens how it opens.
// Each group is the shared Choices (components/ui.jsx: Base UI's RadioGroup; App.jsx sets the direction to right to
// left, so the arrow keys follow the reading order).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { COLORS, ITEMS, SLOTS, SLOT_NAME, MADI_PALETTE, DEFAULT_LOOK, ownedLook, lockedReason, itemOf, colorOf, nameOf, wearing } from '@/lib/wardrobe.js';
import { upcoming, leftText, whereText } from '@/lib/rewards.js';
import { TOPIC } from '@/content/topics.js';
import Mascot from '@/components/Mascot.jsx';
import ChestChoice, { useChestOffer } from '@/components/learn/ChestChoice.jsx';
import { Sheet, Button, Choices, Choice, ChoiceMark, Progress } from '@/components/ui.jsx';
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

function Option({ id, label, sub, art }) {
  return (
    <Choice value={id} className="wardrobe-opt">
      <span className="wardrobe-pic">{art}</span>
      <span className="wardrobe-text">
        <span className="wardrobe-name">{label}</span>
        {sub && <span className="wardrobe-sub">{sub}</span>}
      </span>
      <span className="wardrobe-mark" aria-hidden="true"><ChoiceMark className="wardrobe-check"><Check size={18} strokeWidth={3} /></ChoiceMark></span>
    </Choice>
  );
}

/** A piece on a small, still מדי (a colour is his shape in it): what he looks like with it. */
const Preview = ({ id, size = 64, classColor = 'sky' }) => <Mascot size={size} still look={{ ...DEFAULT_LOOK, ...wearing(id), classColor }} className="wardrobe-preview" />;

/** One group of what the student owns: the colours, or one slot (with בלי first). */
function Group({ id, title, value, options, owned, classColor, onChoose }) {
  const uid = useId();
  return (
    <section className="section wardrobe-group" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="set-head">{title}</h2>
      <Choices value={value} labelledBy={`${uid}-h`} className="wardrobe-grid" onValueChange={(v) => onChoose(id, v)}>
        {options.map((o) => (o === NONE
          ? <Option key={NONE} id={NONE} label="בלי" art={<span className="wardrobe-none" />} />
          : <Option key={o} id={o} label={nameOf(o)} sub={owned.why.get(o)} art={colorOf(o) ? <Swatch id={o} /> : <Preview id={o} size={56} classColor={classColor} />} />))}
      </Choices>
    </section>
  );
}

/** "החלק הבא": the nearest piece learning opens, its picture, how many stages are left, and a bar from the last one. */
function Meter({ next }) {
  const uid = useId();
  return (
    <section className="card wardrobe-meter" aria-labelledby={`${uid}-h`}>
      <span className="wardrobe-meter-pic"><Preview id={next.id} /></span>
      <div className="wardrobe-meter-text">
        <h2 id={`${uid}-h`} className="wardrobe-meter-head">החלק הבא: {leftText(next.left)}</h2>
        <p className="wardrobe-meter-name">{nameOf(next.id)} · {whereText(next)}</p>
        <Progress className="wardrobe-meter-bar" fillClassName="wardrobe-meter-fill" value={next.of - next.left} max={next.of} labelledBy={`${uid}-h`}
          valueText={`${nameOf(next.id)}: ${leftText(next.left)}`} />
      </div>
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
  const skills = useApp((s) => s.learn.skills);
  const classGoals = useApp((s) => s.classGoals);
  const profile = useApp((s) => s.profile);
  const worn = useMadiLook();
  const grade = profile?.grade || '7';
  const owned = useMemo(() => {
    const o = ownedLook({ path, classGoals, grade, earned: look?.earned, skills });
    const all = new Set([...o.colors, ...o.items]);
    return { has: (id) => all.has(id), why: o.why, all };
  }, [path, classGoals, grade, look?.earned, skills]);
  // a solo student has no class goal to reach, so the class scarf is shown only in a class
  const inClass = !!profile?.classCode;
  // what learning opens next, nearest first (lib/rewards.js): the meter shows the first, the list the next ones
  const coming = useMemo(() => upcoming({ path, skills, grade, owned: owned.all }), [path, skills, grade, owned]);
  const offer = useChestOffer();
  const [picked, setPicked] = useState(null);
  const [mood, setMood] = useState('idle');
  const [beat, setBeat] = useState(0);
  const [locked, setLocked] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  // one more opening of the wardrobe today, counted with no one behind it (STUDENT-14; nothing without a server)
  useEffect(() => { count('wardrobe_open'); }, []);
  // a chest choice made here is kept on screen until the student leaves, even though the offer is gone
  const [chest] = useState(() => offer);

  const choose = (group, v) => {
    setLook(group === 'color' ? { color: v } : { [group]: v === NONE ? null : v });
    // a piece put on here has been seen: the next result does not announce it as new
    if (v !== NONE && v !== 'sky') markEarned([v]);
    setMood('happy'); setBeat((b) => b + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMood('idle'), HAPPY_MS);
  };
  const pick = (id) => {
    if (!useApp.getState().pickChest(chest.day, id)) return;
    setPicked(id);
    choose(itemOf(id).slot, id);
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

  // the groups hold only what is owned; a slot with nothing yet is left out
  const groups = [
    { id: 'color', title: 'צבע', value: worn.color, options: COLORS.map((c) => c.id).filter((c) => owned.has(c)) },
    ...SLOTS.map((slot) => ({ id: slot, title: SLOT_NAME[slot], value: worn[slot] || NONE, options: [NONE, ...ITEMS.filter((i) => i.slot === slot && owned.has(i.id)).map((i) => i.id)] })),
  ].filter((g) => g.id === 'color' || g.options.length > 1);
  // after the meter's piece, two more that learning opens, and the class scarf for a student in a class
  const next = coming[0] || null;
  const soon = [...coming.slice(1, 3).map((p) => ({ id: p.id, text: `${leftText(p.left)} · ${whereText(p)}` })),
    ...(inClass && !owned.has('class-scarf') ? [{ id: 'class-scarf', text: 'כשהכיתה מגיעה למטרה של השבוע' }] : [])];
  const shown = new Set([next?.id, ...soon.map((p) => p.id), ...(chest?.ids || [])]);
  const rest = [...COLORS.filter((c) => c.unlock), ...ITEMS.filter((i) => i.id !== 'class-scarf' || inClass)].filter((p) => !owned.has(p.id) && !shown.has(p.id)).length;
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
      {next && <Meter next={next} />}
      {chest && (
        <section className="card wardrobe-chest" aria-label="תיבת המשימות">
          <ChestChoice ids={chest.ids} picked={picked} onPick={pick} title={chest.day === today() ? 'בחרו חלק מתיבת המשימות' : 'התיבה עוד מחכה: בחרו חלק'} />
        </section>
      )}
      <p className="wardrobe-sub-head">מדי מקבל חלקים חדשים כשלומדים: על שלבים שמסיימים, באמצע ובסוף כל יחידה, ובתיבת המשימות היומיות.</p>
      {groups.map((g) => (
        <Group key={g.id} {...g} owned={owned} classColor={worn.classColor} onChoose={choose} />
      ))}
      {(soon.length > 0 || rest > 0) && (
        <section className="section wardrobe-soon" aria-labelledby="wardrobe-soon-h">
          <h2 id="wardrobe-soon-h" className="set-head">בדרך למדי</h2>
          {soon.length > 0 && (
            <ul className="wardrobe-soon-list">
              {soon.map((p) => (
                <li key={p.id}>
                  <button type="button" className="wardrobe-soon-row" onClick={() => setLocked(p.id)}>
                    <span className="wardrobe-soon-pic"><Preview id={p.id} size={48} classColor={worn.classColor} /></span>
                    <span className="wardrobe-text"><span className="wardrobe-name">{nameOf(p.id)}</span><span className="wardrobe-sub">{p.text}</span></span>
                    <ChevronLeft size={20} aria-hidden="true" className="wardrobe-soon-go" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rest > 0 && <p className="wardrobe-rest">{rest === 1 ? 'ועוד חלק אחד' : `ועוד ${rest} חלקים`} שנפתחים בהמשך הלמידה ובתיבות המשימות.</p>}
        </section>
      )}
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
