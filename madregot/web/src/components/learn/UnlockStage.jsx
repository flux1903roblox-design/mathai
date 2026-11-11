// A new piece for מדי (STUDENT-3): one calm moment after a result, before the daily goal and the streak. Madi already
// wears the new piece; the title, the sentence that says what earned it, any other new pieces, and two buttons: put it
// on, or later. Either way the pieces are marked as shown (markEarned), so the moment comes once.
// A new colour means a whole unit completed: the maths burst (lib/mathBurst.js: + − × ÷ = in the app's colours) plays
// from the hero, once, on a canvas that takes no tap and is removed when the burst ends or the student goes on. Nothing
// plays under reduced motion. An accessory gets no extra effect.
// Loaded on demand (lib/madiLook.js UnlockStage, useNewUnlocks).
import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';
import { useApp } from '@/lib/store.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { colorOf, nameOf, unlockReason, wearing } from '@/lib/wardrobe.js';
import { DUR, enter } from '@/lib/motion.js';
import { mathBurst } from '@/lib/mathBurst.js';

const focusQuietly = (el) => { if (el) el.focus({ preventScroll: true }); };
const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: enter(DUR.slow) } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } };

export default function UnlockStage({ ids, onNext }) {
  const look = useMadiLook();
  const path = useApp((s) => s.path);
  const grade = useApp((s) => s.profile?.grade);
  const [main, ...more] = ids;
  const colour = !!colorOf(main);
  const preview = { ...look, ...wearing(main) };
  const hero = useRef(null);
  // a colour only; stop() on the way out, so a button pressed during the burst leaves no canvas behind
  useEffect(() => (colour ? mathBurst(hero.current) : undefined), [colour]);
  const done = (keep) => {
    const app = useApp.getState();
    if (keep) app.setLook(wearing(main));
    app.markEarned(ids);
    onNext();
  };
  return (
    <div className="done-screen unlock-stage">
      <div className="done-hero" ref={hero}>
        <Mascot mood="achievement" size={150} look={preview} className="unlock-madi" />
      </div>
      <m.div className="done-copy" variants={stagger} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title" id="unlock-title">מדי קיבל משהו חדש</m.h1>
        <m.p variants={rise} className="unlock-reason" id="unlock-reason">{unlockReason(main, path, grade)}</m.p>
        {more.length > 0 && <m.p variants={rise} className="unlock-more">ועוד חדש למדי: {more.map(nameOf).join(', ')}.</m.p>}
      </m.div>
      <div className="done-actions" data-region="footer">
        <Button className="btn-block btn-lg" onClick={() => done(true)} ref={focusQuietly} aria-describedby="unlock-title unlock-reason">לשמור על מדי</Button>
        <Button variant="ghost" className="btn-block" onClick={() => done(false)}>אחר כך</Button>
      </div>
    </div>
  );
}
