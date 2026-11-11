-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- DURABLE-5 (review): a backup that its owner deleted ("להפסיק את הגיבוי", "מחיקת כל הנתונים") leaves a tombstone, so
-- another device that still has the same code is told the backup was deleted (410 vault_deleted) instead of making it
-- again. Only the hash the vault was stored under and when it was deleted: no content, no code, no address. A vault that
-- expired (400 days unused) leaves none, so it is made again. Tombstones go after 400 days (cron.js).
CREATE TABLE IF NOT EXISTS vault_tombstones (
  id_hash TEXT PRIMARY KEY,                 -- vaults.id_hash of the deleted vault
  deleted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vault_tombstones_at ON vault_tombstones (deleted_at);
