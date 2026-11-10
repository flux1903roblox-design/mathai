// The demo class's banner (spec TEACHER-15 §4), above every teacher screen while the demo is open: it says the class
// is invented and that nothing leaves the device, and offers the way out. Where this copy of the app has a server and the
// demo opened on a device with no profile, a second way: opening a real class (TeacherStart).
import { useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { hasServer } from '@/lib/api.js';
import { DEMO_COPY, exitDemo, demoOverProfile } from '@/lib/demo.js';

export default function DemoBanner() {
  const navigate = useNavigate();
  const real = hasServer() && !demoOverProfile();
  const leave = async (to) => { await exitDemo(); navigate(to, { replace: true }); };
  return (
    <div className="demo-banner" role="region" aria-label="כיתה לדוגמה" data-region="banner">
      <p className="demo-banner-text"><FlaskConical size={18} aria-hidden="true" /><span>{DEMO_COPY.banner}</span></p>
      <div className="demo-banner-actions">
        <button type="button" className="demo-banner-btn" onClick={() => leave('/')}>{DEMO_COPY.exit}</button>
        {real && <button type="button" className="demo-banner-btn strong" onClick={() => leave('/?start=teacher')}>{DEMO_COPY.real}</button>}
      </div>
    </div>
  );
}
