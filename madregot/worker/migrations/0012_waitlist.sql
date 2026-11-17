-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The waitlist for the store apps (worker/src/waitlist.js): the public page /waitlist/ (web/landing/waitlist.html) asks
-- for an email address, who is asking (a parent or a teacher: no student is asked for an email), the grade and the
-- phone, so the owner can see whether enough people want the iPhone and Android apps, and write to them once when the
-- apps are in the stores (the Worker sends that email itself: sent_at, tries). What the table holds is the whole of it:
-- no name, no network address, no device, no free text. The email is stored as
-- account.js cleanEmail leaves it (trimmed, NFKC, lower case), once (a second signup with it changes nothing). source is
-- the ad's utm_source/utm_campaign, cleaned to a short label. Deleted 30 days after WAITLIST_LAUNCHED_AT, and at the
-- latest 365 days after the signup (shared/retention.js, cron.js purgeRecordsSql); also by the owner on request
-- (npm run owner -- waitlist --remove E, and forget --email E), by the launch email's removal link, and with an account
-- of the same email (forgetAccount).
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  role TEXT NOT NULL CHECK (role IN ('parent', 'teacher')),   -- adults only: the app asks no student for an email
  grade TEXT CHECK (grade IS NULL OR grade IN ('7', '8')),
  platform TEXT CHECK (platform IS NULL OR platform IN ('ios', 'android', 'both')),
  source TEXT CHECK (source IS NULL OR length(source) BETWEEN 1 AND 61),
  consent_at TEXT NOT NULL,                    -- when "one email when the app is in the stores" was ticked (the signup)
  created_at TEXT NOT NULL,
  sent_at TEXT,                                -- when the one launch email went to it (waitlist.js sendLaunch, the cron)
  tries INTEGER NOT NULL DEFAULT 0             -- the launch email's failed sends (given up at LAUNCH_MAX_TRIES)
);
CREATE INDEX IF NOT EXISTS waitlist_created ON waitlist (created_at);
