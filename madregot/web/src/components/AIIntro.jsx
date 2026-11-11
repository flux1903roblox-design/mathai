// The one-time introduction before the first AI action on a device (trust spec TRUST-4 §4.6, Appendix E.3): the tutor
// is software, not a person; what it is for; where what is written goes; what never to write; and that a person to
// talk to is one tap away. Mounted once in the app; opened by gate() and by the chat (account.js needIntro). Its one
// button remembers it on this device and continues what the child asked for. Madi waits beside the words, still.
// "עוד על בטיחות ופרטיות" opens the public safety statement (/safety); it closes the introduction and sends nothing,
// so the introduction comes again before the next AI action.
import { Link } from 'react-router-dom';
import { useAIIntro, acceptAIIntro, closeAIIntro } from '@/lib/account.js';
import { AI_INTRO } from '@/content/aiSafety.js';
import { Button, Sheet } from './ui.jsx';
import Mascot from './Mascot.jsx';

export default function AIIntro() {
  const open = useAIIntro((s) => s.open);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeAIIntro()} title={AI_INTRO.title} className="ai-intro-sheet"
      footer={<Button className="btn-block btn-lg" onClick={acceptAIIntro}>{AI_INTRO.ok}</Button>}>
      <div className="ai-intro">
        <Mascot mood="idle" size={64} still className="ai-intro-madi" />
        <ul className="ai-intro-list">
          {AI_INTRO.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <Link to="/safety" className="ai-intro-more" onClick={closeAIIntro}>{AI_INTRO.more}</Link>
      </div>
    </Sheet>
  );
}
