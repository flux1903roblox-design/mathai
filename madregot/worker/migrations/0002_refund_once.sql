-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- Two cancel requests at the same moment (two tabs, two devices, a retry) must never queue two refunds for one plan:
-- at most one cooling-off and one pro-rata refund per plan.
CREATE UNIQUE INDEX IF NOT EXISTS refund_queue_once ON refund_queue (subscription_id, reason) WHERE reason IN ('cooling_off', 'prorata');
