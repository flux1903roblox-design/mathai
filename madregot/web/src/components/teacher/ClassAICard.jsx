// "העוזר החכם לתלמידים" in the class settings (TEACHER-9 §1.3, the screens of TRUST-11): whether the class's students
// may use the smart tutor under the Ministry of Education's rules, and why, in trust Appendix E §E.8's words
// (content/classAi.js). Built from the dashboard's aiPolicy:
// - where the class learns (a school, or a private group with the teacher's attestation); a change asks first, since it
//   changes the rule and starts the switch and the consent over (the server does the same);
// - a school class before catalogue approval, or below the approved grade: off, the reason, the teacher's own use;
// - consent needed: the Ministry's parent form (school) or the parents' agreement (private), the pilot kit's parent
//   letter, a checkbox and "שמירה";
// - after consent: the switch, and the day the consent was recorded.
// Every change is POST /api/teacher/class/ai; its answer is the new policy.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLink, Printer } from 'lucide-react';
import { teacherApi } from '@/lib/teacher.js';
import { dateNum } from '@/lib/price.js';
import { AI_CARD_TITLE, AI_COPY, classAiView } from '@/content/classAi.js';
import { Button, Sheet } from '@/components/ui.jsx';
import { Choice, AttestBox, SETTINGS, settingBody, settingReady } from './ClassSettingQuestion.jsx';

/** A link to the Ministry's page or form, in a new tab. */
function Ext({ href, children }) {
  if (!href) return null;
  return <a className="cai-link" href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={16} aria-hidden="true" /></a>;
}

/** Changing where the class learns: what happens, the attestation for a private group, then the change. */
function SettingSheet({ to, open, onOpenChange, onConfirm }) {
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = settingReady(to, attest);
  const go = async () => { setBusy(true); try { await onConfirm(settingBody(to, attest)); } finally { setBusy(false); } };
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setAttest(false); onOpenChange(o); }} title={to === 'private' ? 'לשנות לקבוצה פרטית?' : 'לשנות לכיתה בבית ספר?'}
      footer={(
        <div className="stack">
          <Button className="btn-block btn-lg" onClick={go} disabled={!ready || busy}>{busy ? 'שומרים…' : 'לשנות'}</Button>
          <Button variant="ghost" className="btn-block" onClick={() => onOpenChange(false)}>לא לשנות</Button>
        </div>
      )}>
      <div className="stack cai-sheet">
        <p className="lead"><b>{SETTINGS[to]?.title}</b>: {SETTINGS[to]?.sub}.</p>
        <p>לבית ספר ולקבוצה פרטית יש כללים שונים לעוזר החכם. אחרי השינוי העוזר כבוי לתלמידים, ואם נרשם אישור הורים, צריך לאשר שוב.</p>
        {to === 'private' && <AttestBox id="cai-attest" checked={attest} onChange={setAttest} />}
      </div>
    </Sheet>
  );
}

/** The consent block: the Ministry's form (a school class), the checkbox, "שמירה" → {consent: true}. */
function ConsentForm({ policy, box, links, onSave }) {
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!ticked || busy) return;
    setBusy(true);
    try { await onSave(); } finally { setBusy(false); }
  };
  return (
    <form className="cai-consent" onSubmit={save} noValidate>
      {links && (
        <ul className="cai-links">
          <li><Ext href={policy.consentFormUrl}>{AI_COPY.consentPortal}</Ext></li>
          <li><Ext href={policy.consentPdfUrl}>{AI_COPY.consentPdf}</Ext></li>
        </ul>
      )}
      {/* the pilot kit's letter to parents, which says what the AI does in this class (TEACHER-10 §3) */}
      <Link className="cai-link cai-letter" to="/teacher/guide/parent-letter"><Printer size={16} aria-hidden="true" />מכתב להורים להדפסה</Link>
      <label className="check-row cai-box">
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
        <span>{box}</span>
      </label>
      <Button type="submit" variant="secondary" className="btn-sm cai-save" disabled={!ticked || busy}>{busy ? 'שומרים…' : AI_COPY.save}</Button>
    </form>
  );
}

/** Props: `cls`; `policy` (the dashboard's aiPolicy; nothing is shown before it comes); `onPolicy(policy)` after a change. */
export default function ClassAICard({ cls, policy, onPolicy }) {
  const [changeTo, setChangeTo] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!policy) return null;
  const view = classAiView(policy);
  const setting = policy.setting === 'private' ? 'private' : 'school';
  const post = async (body, done) => {
    const r = await teacherApi('/api/teacher/class/ai', { method: 'POST', body }, cls);
    onPolicy(r.policy);
    if (done) toast.success(done);
    return r;
  };
  const change = async (body) => {
    try { await post(body, 'המקום שבו הכיתה לומדת עודכן.'); setChangeTo(null); } catch (e) { toast.error(e.message); }
  };
  const consent = async () => { try { await post({ consent: true }, 'אישור ההורים נשמר.'); } catch (e) { toast.error(e.message); } };
  const turn = async (on) => {
    setBusy(true);
    try { await post({ studentAi: on ? 'on' : 'off' }, on ? AI_COPY.turnedOn : AI_COPY.turnedOff); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="section set-group t-set cai" aria-labelledby="ts-ai" id="ts-ai-card">
      <h2 id="ts-ai" className="set-head">{AI_CARD_TITLE}</h2>
      <div className="set-box">
        <p className="cai-status">לתלמידים בכיתה: <span className={view.on ? 'cai-chip on' : 'cai-chip off'}>{view.status}</span></p>


        {view.text.map((t) => <p key={t} className="cai-text">{t}</p>)}
        {view.consent && <ConsentForm key={`${setting}-${policy.reason}`} policy={policy} box={view.consent.box} links={view.consent.links} onSave={consent} />}
        {view.toggle && (
          <div className="t-lock cai-switch">
            <label className="check-row t-lock-row">
              <input type="checkbox" role="switch" checked={view.on} disabled={busy} onChange={(e) => turn(e.target.checked)} aria-describedby={policy.consentAt ? 'cai-consent-at' : undefined} />
              <span>{AI_COPY.switch}</span>
            </label>
            {policy.consentAt && <p className="field-hint" id="cai-consent-at">{AI_COPY.consentAt(dateNum(policy.consentAt))}</p>}
          </div>
        )}
        {view.rules && <p className="cai-rules"><Ext href={policy.rulesUrl}>{AI_COPY.rulesLink}</Ext></p>}

        {/* where the class learns: it changes the rule, so a change asks first and the choice stays until confirmed */}
        <div className="cai-where">
          <fieldset className="as-set">
            <legend className="field-label">איפה הכיתה לומדת</legend>
            <div className="as-opts">
              {Object.entries(SETTINGS).map(([v, c]) => (
                <Choice key={v} name="cai-setting" value={v} checked={setting === v} title={c.title} sub={c.sub}
                  onChange={(next) => { if (next !== setting) setChangeTo(next); }} />
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <SettingSheet key={changeTo || 'none'} to={changeTo || 'school'} open={!!changeTo} onOpenChange={(o) => { if (!o) setChangeTo(null); }} onConfirm={change} />
    </section>
  );
}
