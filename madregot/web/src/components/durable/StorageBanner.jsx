// One calm line at the top of Learn when nothing could save the progress (DURABLE-1): the browser is full, or it lets
// this site save nothing. A full storage that the copy on the device still covers says nothing here (Settings says
// "נשמר"). Never shown inside a lesson.
import { Link } from 'react-router-dom';
import { useDurable } from '@/lib/durable/useDurable.js';

const TEXT = {
  full: 'הדפדפן מלא, ולכן ההתקדמות החדשה לא נשמרת כרגע.',
  memory: 'הדפדפן לא מאפשר לשמור כאן, ולכן ההתקדמות תישמר רק עד שהמסך ייסגר.',
};

export default function StorageBanner() {
  const health = useDurable((s) => s.health);
  if (!TEXT[health]) return null;
  return (
    <div className="storage-banner" role="status">
      <p>{TEXT[health]}</p>
      <Link to="/settings#save" className="storage-banner-link">מה עושים</Link>
    </div>
  );
}
