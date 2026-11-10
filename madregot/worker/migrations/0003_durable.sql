-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The durable-progress lane's one migration: later items of the lane add to this file until it is deployed.
-- DURABLE-7: each answer a class student's app sends carries its own 12-hex id, so a batch sent twice (a retry, a page
-- closed mid-request) is stored once. Answers from older apps have no id (NULL) and are stored as before.
ALTER TABLE attempts ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS attempts_client ON attempts (student_id, client_id) WHERE client_id IS NOT NULL;
