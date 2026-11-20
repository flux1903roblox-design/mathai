import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { X, Flame } from 'lucide-react';
import { SPRING, DUR, EASE, leave } from '@/lib/motion.js';

/** What the bar says aloud: how many exercises are done, and how many of them were right the first time. */
function stripText(marks, total) {
  const done = marks.filter((x) => x === 'first' || x === 'fixed' || x === 'redone').length;
  const firsts = marks.filter((x) => x === 'first').length;
  return `${done} מתוך ${total} תרגילים, ${firsts} נכונים בפעם הראשונה`;
}

/**
 * The combo moment (a run of 3, 5, 10 right first tries): a small pill that pops over the bar (scale 1, 1.15, 1) and
 * leaves on its own (Lesson.jsx). It covers only the bar and the run's chip, never the question, the keypad or a button,
 * so the next exercise can be answered while it shows (ux-motion 16, 17); a tap on it closes it. A status: read aloud.
 * Under reduced motion it fades in and is simply gone when it closes.
 */
export function ComboPop({ n, onClose }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {n ? (
        <m.div key="combo" className="combo-pop" role="status" onClick={onClose}
          initial={{ opacity: 0, scale: 1 }} animate={{ opacity: 1, scale: [1, 1.15, 1] }}
          transition={{ opacity: { duration: DUR.quick, ease: EASE.out }, scale: { duration: 0.3, times: [0, 0.4, 1], ease: EASE.out } }}
          exit={reduce ? undefined : { opacity: 0, transition: leave() }}>
          <Flame size={18} aria-hidden="true" /><span className="combo-text">{n} ברצף!</span>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/** The lesson's top bar: leave, the progress bar, and the combo or the tested topic; `pop` is the combo moment's run. */
export function ProgressHeader({ pct, label, onExit, combo, topic, extra = null, marks = null, total = 0, exitLabel = 'יציאה מהשיעור', pop = null, onPopClose }) {
  const reduce = useReducedMotion();
  return (
    <header className="lesson-top">
      <button type="button" className="icon-btn lesson-x" onClick={onExit} aria-label={exitLabel}><X size={26} /></button>
      {/* one thick bar that fills as the lesson goes (the steps' results are read aloud) */}
      {/* the bar and what sits beside it share one box, so the combo's pill can sit over them and nothing else */}
      <div className="lesson-meter">
      <div className="lesson-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
        aria-valuetext={marks ? stripText(marks, total) : undefined}>
        <m.i initial={false} animate={{ width: `${Math.max(pct, 4)}%` }} transition={reduce ? { duration: 0 } : SPRING.fill} />
      </div>
      {topic ? (
        <span className="lesson-topic" aria-live="polite">{topic}</span>
      ) : (
        <span className="lesson-combo" aria-live="polite">
          <AnimatePresence>
            {combo >= 2 && (
              // the count pops in on a spring and fades out quicker than it came; under reduced motion it is simply
              // swapped (an exit left to finish there piled the old counts up beside the bar, "2 3 4 5")
              <m.span key={combo} className="combo-chip" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={reduce ? undefined : { scale: 0.6, opacity: 0, transition: leave() }} transition={{ ...SPRING.pop, opacity: { duration: DUR.quick, ease: EASE.out } }}>
                <Flame size={18} aria-hidden="true" />{combo}<span className="visually-hidden"> ברצף</span>
              </m.span>
            )}
          </AnimatePresence>
        </span>
      )}
      <ComboPop n={pop} onClose={onPopClose} />
      </div>
      {extra}
    </header>
  );
}

/** The mark at the head of the feedback panel: a check that draws itself (with a small burst), or a soft cross. */
export function FeedbackBadge({ good }) {
  const reduce = useReducedMotion();
  return (
    <span className={`fb-badge ${good ? 'is-good' : 'is-bad'}`} aria-hidden="true">
      {good && !reduce && (
        <span className="fb-burst">
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
            return <m.i key={i} initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }} animate={{ x: Math.cos(a) * 34, y: Math.sin(a) * 34, scale: 1, opacity: 0 }} transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.12 }} />;
          })}
        </span>
      )}
      {/* a right answer lands: the mark pops past its size and settles (1.18, then 1: ux-motion 9) */}
      <m.svg viewBox="0 0 40 40" width="40" height="40" initial={reduce ? false : { scale: 0.4, rotate: -20 }} animate={{ scale: good ? [0.4, 1.18, 1] : 1, rotate: 0 }}
        transition={good ? { scale: { duration: 0.3, times: [0, 0.55, 1], ease: EASE.out }, rotate: SPRING.pop } : SPRING.pop}>
        <circle cx="20" cy="20" r="19" className="fb-badge-disc" />
        {good ? (
          <m.path d="M11.5 20.5 L17.5 26.5 L29 14" fill="none" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, delay: 0.1, ease: 'easeOut' }} />
        ) : (
          <path d="M14 14 L26 26 M26 14 L14 26" fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" />
        )}
      </m.svg>
    </span>
  );
}
