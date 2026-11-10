// The demo class asked for on a device someone uses (a student's or a real teacher's; lib/demo.js bootDemo): it opens
// in a new tab, so nothing on this device changes. Asked once, with a tap, since a browser opens a new tab only then.
import { useDemoAsk, demoUrl } from '@/lib/demo.js';
import { Button, Sheet } from './ui.jsx';

export default function DemoAsk() {
  const open = useDemoAsk((s) => s.open);
  const close = () => useDemoAsk.setState({ open: false });
  const go = () => { window.open(demoUrl({ tab: true }), '_blank'); close(); };
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }} title="לוח לדוגמה">
      <div className="stack demo-ask">
        <p className="lead">הלוח לדוגמה ייפתח בלשונית חדשה, כדי שמה שיש במכשיר הזה יישאר בדיוק כמו שהוא.</p>
        <Button className="btn-block btn-lg" onClick={go}>לפתוח בלשונית חדשה</Button>
        <Button variant="ghost" className="btn-block" onClick={close}>לא עכשיו</Button>
      </div>
    </Sheet>
  );
}
