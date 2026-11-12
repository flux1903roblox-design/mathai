// A new piece for מדי (STUDENT-3): one moment after a result, before the daily goal and the streak. The title, the
// piece's name, the sentence that says what earned it, any other new pieces, and two buttons: put it on, or later.
// Either way the pieces are marked as shown (markEarned), so the moment comes once.
// A new colour means a whole unit completed: the confetti LessonDone plays for a finished lesson plays here too. A new
// accessory has its own moment too (SK-STUDENT-2, PRODUCT2-36): soft gold rays open behind Madi and the piece drops
// onto him with a bounce and a sparkle (components/mascot/Accessories.jsx reveal). מדי himself jumps in first, and small
// gold shapes fly out as the piece lands (Celebrate, PRODUCT2-38), with the level-up sound and vibration. Under reduced
// motion there is no movement: he simply wears it, as before. The buttons work from the first moment, and the first is
// focused, so one tap or Enter skips it. Loaded on demand (lib/madiLook.js UnlockStage, useNewUnlocks).
import { useEffect } from 'react';
import clsx from 'clsx';
import { m } from 'motion/react';
import Mascot from '@/components/Mascot.jsx';
import Lottie from '@/components/Lottie.jsx';
import { Button } from '@/components/ui.jsx';
import { useApp } from '@/lib/store.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { colorOf, nameOf, unlockReason, wearing } from '@/lib/wardrobe.js';
import { DUR, enter } from '@/lib/motion.js';
import { play, haptic } from '@/lib/sound.js';
import Celebrate from './Celebrate.jsx';
import '@/styles/lazy/unlock.css';

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
  useEffect(() => { play('levelup'); haptic('levelup'); }, []);
  const done = (keep) => {
    const app = useApp.getState();
    if (keep) app.setLook(wearing(main));
    app.markEarned(ids);
    onNext();
  };
  return (
    <div className="done-screen unlock-stage">
      <div className={clsx('done-hero', !colour && 'unlock-hero')}>
        {colour ? <Lottie name="confetti" className="done-confetti" decorative /> : <span className="unlock-rays" aria-hidden="true" />}
        <Celebrate tone="gold" rays={false} burst={!colour} burstAt={0.75}>
          <Mascot mood="achievement" size={150} look={preview} reveal={colour ? null : main} className="unlock-madi" />
        </Celebrate>
      </div>
      <m.div className="done-copy" variants={stagger} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title" id="unlock-title">מדי קיבל משהו חדש</m.h1>
        <m.p variants={rise} className="unlock-name">{nameOf(main)}</m.p>
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
