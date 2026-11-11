// "Report this answer" under every AI answer (trust spec TRUST-4 §4.5): a small flag button, a sheet that asks what
// was wrong, and one calm thank-you. Only the tutor's own text is sent (the server masks it again and keeps at most
// 4,000 characters); never what the child wrote, never their name. A build with no server has nowhere to send it, so
// there the button is not shown at all.
import { useId, useState } from 'react';
import clsx from 'clsx';
import { Flag, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api, hasServer } from '@/lib/api.js';
import { aiHeaders, aiMode, useAIStatus } from '@/lib/account.js';
import { REPORT } from '@/content/aiSafety.js';
import { Button, Sheet } from './ui.jsx';

export const REPORT_MAX = 4000;
export const REPORT_KINDS = ['chat', 'explain', 'check', 'exam', 'generate', 'feedback'];

/** A photo or notebook check, as the tutor wrote it: its verdict, each line with its comment, and its summary. */
export function checkText(r) {
  if (!r || typeof r !== 'object') return '';
  const steps = Array.isArray(r.steps) ? r.steps : [];
  return [
    r.final ? `final: ${r.final}` : '',
    ...steps.map((st, i) => `${i + 1}. ${st.ok ? '✓' : '✗'} ${st.text || ''}${st.comment ? ` (${st.comment})` : ''}`),
    r.summary || '',
  ].filter(Boolean).join('\n');
}

/** One question of a checked exam, as the tutor wrote it (the question as it read it, the answers, its feedback). */
export function examText(q) {
  if (!q || typeof q !== 'object') return '';
  const solution = Array.isArray(q.solution) ? q.solution : [];
  return [
    `שאלה ${q.number ?? ''}${q.status ? ` (${q.status})` : ''}`,
    q.item ? '' : q.prompt || '',
    q.correctAnswer ? `תשובה נכונה: ${q.correctAnswer}` : '',
    q.feedback || '',
    ...solution.map((x, i) => `${i + 1}. ${x}`),
  ].filter(Boolean).join('\n');
}

/** Exercises the tutor wrote: each one with its answer, hint and solution. */
export function generateText(qs) {
  return (Array.isArray(qs) ? qs : []).map((q, i) => [
    `${i + 1}. ${q.prompt || ''}`, q.answer != null ? `תשובה: ${q.answer}` : '', q.hint ? `רמז: ${q.hint}` : '',
    ...(Array.isArray(q.solution) ? q.solution : []),
  ].filter(Boolean).join('\n')).join('\n\n');
}

/** The request body: the reason, the surface and the tutor's text (clipped), with the tier the server last reported. */
export function reportBody({ reason, kind, reply }) {
  const tier = aiMode() === 'personal' ? 'personal' : useAIStatus.getState().status?.tier || '';
  return { reason, kind, reply: String(reply || '').slice(0, REPORT_MAX), ...(tier ? { tier } : {}) };
}

/** Send a report. Resolves when the server kept it; throws its ApiError otherwise. */
export const sendReport = (r) => api('/api/ai/report', { method: 'POST', body: reportBody(r), headers: aiHeaders() });

export default function ReportAnswer({ kind, reply, className }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const id = useId();
  if (!hasServer() || !REPORT_KINDS.includes(kind) || !String(reply || '').trim()) return null;
  const send = async () => {
    if (!reason || busy) return;
    setBusy(true); setError('');
    try {
      await sendReport({ reason, kind, reply });
      setSent(true); setOpen(false);
      toast.success(REPORT.thanks);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={clsx('icon-btn report-btn', sent && 'is-sent', className)} onClick={() => setOpen(true)} disabled={sent}
        aria-label={sent ? REPORT.sent : REPORT.button} aria-haspopup="dialog" title={sent ? REPORT.sent : REPORT.button}>
        {sent ? <Check size={18} aria-hidden="true" /> : <Flag size={18} aria-hidden="true" />}
      </button>
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(''); }} title={REPORT.title} className="report-sheet"
        footer={<Button className="btn-block btn-lg" onClick={send} disabled={!reason || busy}>{busy ? REPORT.sending : REPORT.send}</Button>}>
        <fieldset className="report-reasons">
          <legend className="visually-hidden">{REPORT.title}</legend>
          {REPORT.reasons.map((r) => (
            <label key={r.id} className={clsx('report-reason', reason === r.id && 'on')}>
              <input type="radio" name={`${id}-reason`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
              <span>{r.label}</span>
            </label>
          ))}
        </fieldset>
        <p className="report-note">{REPORT.note}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </Sheet>
    </>
  );
}
