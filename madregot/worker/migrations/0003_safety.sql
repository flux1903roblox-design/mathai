-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The trust lane's one migration (trust spec §0.3): new side tables and indexes only, never an ALTER TABLE on an
-- existing table, so schema.sql carries the same text and still runs twice. Until this file is deployed, the lane's
-- later tables are added here too.

-- Safety events: counts with no content (trust spec TRUST-4 §4.4). A row says what happened, on which surface and how it
-- was noticed, on a Jerusalem day with no time of day. There is no student, device, account, class or text column, so a
-- row can never point to a person or hold what anyone wrote. Written by recordSafety (src/safety.js); kept for
-- RETENTION.safetyEventsDays (shared/retention.js).
CREATE TABLE IF NOT EXISTS safety_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,                                   -- YYYY-MM-DD Jerusalem; no time of day
  kind TEXT NOT NULL CHECK (kind IN ('distress','pii_masked','output_blocked','link_removed','refusal','user_report','class_ai_off','parent_ok_needed','photo_redacted')),
  category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 20),
  surface TEXT NOT NULL CHECK (surface IN ('chat','explain','check','exam','generate','help_note','photo')),
  source TEXT NOT NULL CHECK (source IN ('regex','model','client','server')),
  tier TEXT NOT NULL DEFAULT '' CHECK (length(tier) <= 10)
);
CREATE INDEX IF NOT EXISTS safety_events_day ON safety_events (day);

-- What a help request is (trust spec TRUST-3), beside help_requests: kind 'help' (a question about an exercise) or 'talk'
-- (the child asked the teacher to talk, with no text), and care = 1 when the note the child chose to send reads as
-- distress. A request with no row here is kind 'help', care 0. The row goes with its request.
CREATE TABLE IF NOT EXISTS help_meta (
  help_id INTEGER PRIMARY KEY REFERENCES help_requests (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'help' CHECK (kind IN ('help','talk')),
  care INTEGER NOT NULL DEFAULT 0 CHECK (care IN (0,1))
);
