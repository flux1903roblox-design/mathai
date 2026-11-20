// One calm line at the top of Learn when nothing could save the progress (DURABLE-1): the browser is full, or it lets
// this site save nothing. A full storage that the copy on the device still covers says nothing here (Settings says
// "נשמר"). Never shown inside a lesson.
import { Link } from 'react-router-dom';
import { useDurable } from '@/lib/durable/useDurable.js';

import { localized, t } from '@/lib/i18n.js';
let TEXT = localized(() => ({
  full: t('shell.storagebanner.1'),
  memory: t('shell.storagebanner.2'),
}), (v) => { TEXT = v; });

export default function StorageBanner() {
  const health = useDurable((s) => s.health);
  if (!TEXT[health]) return null;
  return (
    <div className="storage-banner" role="status">
      <p>{TEXT[health]}</p>
      <Link to="/settings#save" className="storage-banner-link">{t('shell.storagebanner.3')}</Link>
    </div>
  );
}
