-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- (The council2 lane wrote it as 0009_claim_code; product2's 0009_repair_work merged into the main branch first, so it
-- is 0010 there, and the lane's 0010_exam_pass is 0011.)
-- COUNCIL2-25: a teacher's PIN reset issues a one-time claim code (6 characters, shown to the teacher once). Only its
-- salted hash is kept, with the moment it stops working (RETENTION.claimCodeDays after the reset). The next join under
-- the student's name needs it; it is cleared when it is used, by the next reset, and by the night purge once expired.
ALTER TABLE students ADD COLUMN claim_hash TEXT;
ALTER TABLE students ADD COLUMN claim_expires TEXT;
