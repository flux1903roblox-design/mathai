// The database's size (COUNCIL2-18). Every D1 result carries meta.size_after, the size of the whole database in bytes
// after the statement. The class student's write routes (index.js saveProgress and saveExam) pass their batch results
// here: the day's largest size is kept in meters as db_size:<YYYY-MM-DD>, and once it passes DB_SIZE_NOTICE_MB the owner
// gets one notice that day (owner:db_size:<day>, through the notices outbox). The same database holds billing, and on
// Workers Free the whole of it stops at 500 MB, so the owner hears of growth well before writes start failing.
// The meter rows are purged after 35 days with the counters (cron.js purgeCountersSql).
import { dayOf } from './util.js';
import { noticeStmt, ownerNotice } from './spend.js';

const MiB = 1024 * 1024;
/** The notice's default: 400 MB, four fifths of the 500 MB a database may hold on Workers Free. */
export const DB_SIZE_NOTICE_MB = 400;
/** The size in MB over which the owner gets the day's notice: DB_SIZE_NOTICE_MB, else the default. */
export function dbSizeNoticeMb(env) {
  const v = Number(env.DB_SIZE_NOTICE_MB);
  return String(env.DB_SIZE_NOTICE_MB ?? '').trim() !== '' && Number.isFinite(v) && v > 0 ? v : DB_SIZE_NOTICE_MB;
}

// The largest size this isolate has written for a day, per database binding, so a write that did not grow the database
// sends nothing more (the size moves in whole pages, so most writes leave it as it was).
const written = new WeakMap();

/**
 * Keep the day's largest meta.size_after of `results` (a D1 batch's results) in meters, and queue the owner's notice when
 * it is over the line. Never throws: a meter that could not be written must not fail the student's save.
 */
export async function meterDbSize(env, results, now = new Date()) {
  try {
    const bytes = Math.max(0, ...(Array.isArray(results) ? results : []).map((r) => Number(r?.meta?.size_after) || 0));
    if (!bytes || !env.DB) return;
    const day = dayOf(now);
    const seen = written.get(env.DB);
    if (seen && seen.day === day && bytes <= seen.bytes) return;
    const line = dbSizeNoticeMb(env);
    const mb = Math.round((bytes / MiB) * 10) / 10;
    await env.DB.batch([
      env.DB.prepare('INSERT INTO meters (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = MAX(value, excluded.value)').bind(`db_size:${day}`, bytes),
      ...(bytes > line * MiB ? [noticeStmt(env, ownerNotice(day, `owner:db_size:${day}`, { day, mb, noticeMb: line }))] : []),
    ]);
    written.set(env.DB, { day, bytes });
  } catch (e) {
    console.error('db size meter', e?.message);
  }
}
