// /r/<data>: the week a child sent from their own phone (PARENTS-2). It opens on a parent's phone with no profile and
// no account, so it is routed before the role gate. The week is in the link's # fragment, which no browser sends to a
// server: this page decodes and checks it (lib/share.js) and draws it with the child's own renderer. It makes no
// request at all (no plans fetch either: the footer has the static links only), collects nothing from the parent and
// sells nothing; a quiet link says what Madregot is. A link that does not decode says so, calmly.
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import ParentsFrame from './ParentsFrame.jsx';
import ReportView from '@/components/report/ReportView.jsx';
import { StateCard } from '@/components/ds.jsx';
import { decodeShare, weekFromShare } from '@/lib/share.js';
import { today } from '@/lib/days.js';

export const BROKEN_TITLE = 'הקישור לא שלם.';
export const BROKEN_TEXT = 'אפשר לבקש מהילד לשלוח אותו שוב.';

export default function SharedReport() {
  const { data } = useParams();
  const week = useMemo(() => { const s = decodeShare(data); return s ? weekFromShare(s) : null; }, [data]);
  return (
    <ParentsFrame title="מדרגות · סיכום שבועי" className="shared-report" online={false}>
      {week
        ? <ReportView week={week} audience="parent" source="link" today={today()} />
        : <StateCard kind="empty" mood="thinking" title={BROKEN_TITLE}><p>{BROKEN_TEXT}</p></StateCard>}
      <p className="report-about"><Link to="/parents">מה זה מדרגות?</Link></p>
    </ParentsFrame>
  );
}
