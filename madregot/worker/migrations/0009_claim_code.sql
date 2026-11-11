-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- COUNCIL2-25: a teacher's PIN reset issues a one-time claim code (6 characters, shown to the teacher once). Only its
-- salted hash is kept, with the moment it stops working (RETENTION.claimCodeDays after the reset). The next join under
-- the student's name needs it; it is cleared when it is used, by the next reset, and by the night purge once expired.
ALTER TABLE students ADD COLUMN claim_hash TEXT;
ALTER TABLE students ADD COLUMN claim_expires TEXT;
