// Synthetic reach data for the owner's `reach` command (owner-script.test.js) and its sample output
// (qa-evidence/student/reach.txt): counts by day and name, and class-goal steps of made-up students. No real person.
export const REACH_NOW = '2026-11-10T10:00:00.000Z'; // a Tuesday; the report runs 2026-10-11 (Sunday) to 2026-11-10

export const METRIC_ROWS = [
  ['2026-10-12', 'landing_view_mivchan', 40], ['2026-10-13', 'landing_view_mivchan', 31], ['2026-10-20', 'landing_view_mivchan', 52],
  ['2026-10-27', 'landing_view_mivchan', 47], ['2026-11-03', 'landing_view_mivchan', 66], ['2026-11-09', 'landing_view_mivchan', 25],
  ['2026-10-12', 'landing_cta_mivchan', 9], ['2026-10-20', 'landing_cta_mivchan', 12], ['2026-10-27', 'landing_cta_mivchan', 10],
  ['2026-11-03', 'landing_cta_mivchan', 15], ['2026-11-09', 'landing_cta_mivchan', 6],
  ['2026-10-21', 'landing_view_pilot', 8], ['2026-11-02', 'landing_view_pilot', 11], ['2026-11-02', 'landing_cta_pilot', 2],
  ['2026-10-12', 'welcome_from_landing', 7], ['2026-10-20', 'welcome_from_landing', 10], ['2026-10-27', 'welcome_from_landing', 9],
  ['2026-11-03', 'welcome_from_landing', 13], ['2026-11-09', 'welcome_from_landing', 5],
  ['2026-10-14', 'install_offer', 6], ['2026-10-22', 'install_offer', 9], ['2026-10-28', 'install_offer', 8], ['2026-11-04', 'install_offer', 12],
  ['2026-11-10', 'install_offer', 3], ['2026-10-14', 'install_accept', 2], ['2026-10-22', 'install_accept', 4], ['2026-10-28', 'install_accept', 3],
  ['2026-11-04', 'install_accept', 6], ['2026-10-14', 'installed', 2], ['2026-10-22', 'installed', 4], ['2026-10-28', 'installed', 3],
  ['2026-11-04', 'installed', 5], ['2026-11-10', 'installed', 1],
  ['2026-10-16', 'wardrobe_open', 21], ['2026-10-23', 'wardrobe_open', 30], ['2026-10-30', 'wardrobe_open', 26], ['2026-11-06', 'wardrobe_open', 34],
  ['2026-11-10', 'wardrobe_open', 8],
  ['2026-10-31', 'class_goal_reached', 1], ['2026-11-07', 'class_goal_reached', 2],
  // the daily reminder (STUDENT-11): offered and turned on in the app, sent and opened, and the server's own counts
  ['2026-11-02', 'push_offer', 5], ['2026-11-02', 'push_on', 3], ['2026-11-03', 'push_sent', 3], ['2026-11-04', 'push_sent', 3],
  ['2026-11-04', 'push_open', 2], ['2026-11-09', 'push_offer', 2], ['2026-11-09', 'push_on', 1], ['2026-11-09', 'push_sent', 4],
  ['2026-11-09', 'push_open', 1], ['2026-11-10', 'push_off', 1], ['2026-11-04', 'push_failed', 1], ['2026-11-10', 'push_paused', 1],
  // outside the report: before its first Sunday, and a name the report does not know (never written by the API)
  ['2026-10-10', 'install_offer', 99], ['2026-11-04', 'some_old_name', 5],
];

/** [student, day] pairs of class-goal steps: a student counts once a week however many steps they add. */
export const STEP_ROWS = [
  ['s01', '2026-10-12'], ['s01', '2026-10-13'], ['s02', '2026-10-12'], ['s03', '2026-10-15'],
  ['s01', '2026-10-19'], ['s02', '2026-10-20'], ['s03', '2026-10-21'], ['s04', '2026-10-22'], ['s05', '2026-10-22'],
  ['s01', '2026-10-26'], ['s02', '2026-10-27'], ['s04', '2026-10-28'], ['s05', '2026-10-29'], ['s06', '2026-10-30'], ['s07', '2026-10-30'],
  ['s01', '2026-11-02'], ['s02', '2026-11-02'], ['s03', '2026-11-03'], ['s04', '2026-11-03'], ['s05', '2026-11-04'], ['s06', '2026-11-05'],
  ['s07', '2026-11-05'], ['s08', '2026-11-06'], ['s01', '2026-11-09'], ['s02', '2026-11-10'], ['s08', '2026-11-10'],
  ['s09', '2026-10-01'], // before the report
];

/** Daily reminders as they are on REACH_NOW: [status, last_done_day]. Push addresses and keys are made up. */
export const PUSH_ROWS = [['on', '2026-11-09'], ['on', '2026-11-01'], ['on', null], ['paused', '2026-11-05']];

/** Write the rows into a database (node:sqlite) that has the schema. */
export function seedReach(db) {
  const m = db.prepare('INSERT INTO metrics_daily (day, name, n) VALUES (?, ?, ?)');
  for (const r of METRIC_ROWS) m.run(...r);
  const s = db.prepare("INSERT INTO class_steps (sid, student_id, class_code, day, pts, at) VALUES (?, ?, 'ABC234', ?, 1, ?)");
  STEP_ROWS.forEach(([who, day], i) => s.run(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, who, day, `${day}T15:00:00.000Z`));
  const p = db.prepare(`INSERT INTO push_subs (id, secret_hash, endpoint, p256dh, auth, slot, status, created_at, last_seen_day, last_done_day)
    VALUES (?, 'x', ?, 'BKEY', 'AUTH', 17, ?, '2026-10-20T15:00:00.000Z', '2026-11-10', ?)`);
  PUSH_ROWS.forEach(([status, done], i) => p.run(`000000000000000${i}`, `https://fcm.googleapis.com/fcm/send/synthetic-${i}`, status, done));
}

/** The parents lane's table, as far as the report reads it (device and day), with three devices. */
export function seedFamily(db) {
  db.exec('CREATE TABLE family_daily (device_id TEXT NOT NULL, day TEXT NOT NULL, minutes INTEGER, PRIMARY KEY (device_id, day))');
  const f = db.prepare('INSERT INTO family_daily (device_id, day, minutes) VALUES (?, ?, 10)');
  for (const [d, day] of [['d1', '2026-10-13'], ['d1', '2026-10-20'], ['d2', '2026-10-20'], ['d1', '2026-11-03'], ['d2', '2026-11-04'], ['d3', '2026-11-04'], ['d3', '2026-11-09']]) f.run(d, day);
}
