// /parents, /parents/link, /parents/info and /cancel in a store app (STUDENT-12): the Play Store app and the iPhone
// build sell nothing, so these pages say only how a parent lets the child ask the smart helper. No plan, no price, no
// subscription and no website here (Apple 3.1.1 forbids a call to buy outside the app; Play's Payments policy the same).
// The parent's free, one-time OK (TRUST-9: the QR code and the link) is shown under the sentence once that lane merges.
import Mascot from '@/components/Mascot.jsx';
import ParentsFrame from './ParentsFrame.jsx';

export const STORE_PARENTS_TEXT = 'כדי לשאול את העוזר החכם, אחד ההורים צריך לאשר את זה פעם אחת. זה בחינם ולוקח דקה. סורקים את הקוד בטלפון של ההורה, או שולחים את הקישור.';

export default function StoreParents() {
  return (
    <ParentsFrame title="מידע להורים" className="store-parents">
      <section className="card parents-card store-parents-card">
        <Mascot mood="idle" size={88} />
        <p className="lead">{STORE_PARENTS_TEXT}</p>
      </section>
    </ParentsFrame>
  );
}
