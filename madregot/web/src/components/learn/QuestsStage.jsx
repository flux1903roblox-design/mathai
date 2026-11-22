// The day's chest (PRODUCT2-36), opened by the last of the three quests wherever that quest was done: the end of a
// lesson (LessonDone) and, since the student council's round 3, the end of a teaching stage (StageDone), where it had
// been a chip ("קיבלתם הקפאת רצף") and the piece for מדי waited, unannounced, on the missions tab. The chest opens (its
// Lottie, a still frame under reduced motion), the streak freeze it holds is said, and the student picks one of two
// pieces for מדי (ChestChoice), or leaves the choice for later ("לבחור אחר כך, במשימות": the button says where it
// waits), and the missions tab carries a dot meanwhile (Shell.jsx). Confetti falls once behind it, but not under reduced motion (Lottie decorative) and
// not in a quiet class (lib/sound.js classQuiet, PRODUCT2-38): there the chest opens on the student's own screen only.
// Once a piece is chosen, מדי shows it on, and "לשמור על מדי" keeps it on.
import { useState } from 'react';
import { m } from 'motion/react';
import { Snowflake } from 'lucide-react';
import Mascot from '@/components/Mascot.jsx';
import Lottie from '@/components/Lottie.jsx';
import { Button } from '@/components/ui.jsx';
import { useApp } from '@/lib/store.js';
import { classQuiet } from '@/lib/sound.js';
import { DUR, enter, entrance } from '@/lib/motion.js';
import { useMadiLook } from '@/lib/madiLook.js';
import { wearing } from '@/lib/wardrobe.js';
import ChestChoice, { useChestOffer } from './ChestChoice.jsx';
import '@/styles/lazy/shared.css'; // the chest's size and the freeze's line (.done-chest, .reward.streak-freeze, .freeze-flake)

const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: enter(DUR.slow) } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } } };

/** The way on without a choice says where the choice waits: the missions tab ("משימות"). */
export const CHEST_LATER = 'לבחור אחר כך, במשימות';

/** award: what completed the quests ({ freezeEarned }); onNext: on to what comes after (the offer is fixed as it opens). */
export default function QuestsStage({ award, onNext }) {
  const live = useChestOffer();
  const [offer] = useState(live);
  const [picked, setPicked] = useState(null);
  const look = useMadiLook();
  const quiet = useApp(classQuiet);
  const pick = (id) => { if (useApp.getState().pickChest(offer.day, id)) setPicked(id); };
  const keep = () => { useApp.getState().setLook(wearing(picked)); onNext(); };
  return (
    <div className="done-screen quests-done-screen">
      <div className="done-hero">
        {!picked && !quiet && <Lottie name="confetti" className="done-confetti" decorative />}
        {picked
          ? <Mascot mood="achievement" size={130} look={{ ...look, ...wearing(picked) }} reveal={picked} className="done-madi" />
          : <Lottie name="chest" className="done-chest" label="תיבת אוצר נפתחת" fallback={<Mascot mood="achievement" size={150} />} />}
      </div>
      <m.div className="done-copy" variants={stagger} initial={entrance('hidden')} animate="show">
        <m.h1 variants={rise} className="done-title">סיימתם את המשימות של היום!</m.h1>
        {award.freezeEarned
          ? <m.p variants={rise} className="reward streak-freeze"><Lottie name="snowflake" className="freeze-flake" fallback={<Snowflake size={22} aria-hidden="true" />} />קיבלתם הקפאת רצף. היא שומרת על הרצף ביום שלא יוצא ללמוד בו.</m.p>
          : !offer && <m.p variants={rise} className="lead">כל הכבוד. מחר יחכו משימות חדשות.</m.p>}
        {offer && <m.div variants={rise} className="quests-done-choice"><ChestChoice ids={offer.ids} picked={picked} onPick={pick} title="ובתיבה גם חלק למדי. בחרו אחד:" /></m.div>}
      </m.div>
      <div className="done-actions" data-region="footer">
        {picked
          ? <><Button className="btn-block btn-lg" onClick={keep}>לשמור על מדי</Button><Button variant="ghost" className="btn-block" onClick={onNext}>המשך</Button></>
          : <Button className="btn-block btn-lg" variant={offer ? 'secondary' : 'primary'} onClick={onNext}>{offer ? CHEST_LATER : 'המשך'}</Button>}
      </div>
    </div>
  );
}
