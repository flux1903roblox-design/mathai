// The parents' progress report in the staging copy's QA states (lib/qaFixtures.js, ?qa-parent=report | report-empty |
// report-off): what GET /api/family/summary would answer, built around the device's own today so the week always has
// something in it. Loaded only with the parents' report. Synthetic data only.
//   report        two linked devices: the tablet with 8 weeks of practice, mastery, repairs and an exam ahead; the
//                 phone with a few days
//   report-empty  the tablet linked today, nothing sent yet (the first day, PARENTS-6 state 3)
//   report-off    the tablet's child switched sharing off 3 days ago; its earlier days are still there (state 5)
//   report-old    the tablet last sent 60 days ago: nothing in the 8 weeks read, 3 older summaries still kept
const DAY_MS = 864e5;
const shift = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10); };
const row = (d, over = {}) => ({ v: 1, d, m: 0, q: 0, ls: 0, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 0, ex: null, ...over });
const isoAt = (day, hh, mm) => new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`).toISOString();

/** The tablet's last 8 weeks: practice on most weekdays of the recent weeks, fewer further back. */
function tabletRows(today) {
  const rows = [];
  let streak = 0;
  for (let n = 55; n >= 0; n -= 1) {
    const d = shift(today, -n);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    const recent = n < 21;
    const on = wd !== 6 && (recent ? wd !== 2 : wd % 2 === 0);
    if (!on) { if (wd !== 6) streak = 0; continue; }
    streak += 1;
    const extra = {};
    if (n === 1) extra.ma = ['signed:2'];
    if (n === 9) extra.ma = ['signed:1'];
    if (n === 2) extra.fx = [['signed:1', 'minus-minus', 'd']];
    if (n === 0) extra.fx = [['signed:2', 'neg-compare', 'o'], ['coord:1', 'swap', 'o']];
    if (n === 0) extra.ex = { d: shift(today, 7), n: 2, of: 4 };
    rows.push(row(d, {
      m: 12 + ((n * 7) % 19), q: 8 + ((n * 5) % 11), ls: 1 + (n % 2), st: n % 3 === 0 ? 1 : 0, rv: n % 5 === 0 ? 1 : 0,
      sk: n < 7 ? ['coord:1', 'signed:2'] : n < 21 ? ['signed:2', 'signed:1'] : ['signed:1'], sr: streak, ...extra,
    }));
  }
  return rows;
}

/** The summary response for a QA state (no devices for a state without one). `today`: the device's day ('YYYY-MM-DD'). */
export function qaFamilySummary(state, today) {
  const tablet = { id: 'qa00000000000002', label: 'הטאבלט', linkedAt: isoAt(shift(today, -60), 16, 0), lastSeen: today };
  if (state === 'report') {
    const phoneRows = [3, 5, 12].map((n) => row(shift(today, -n), { m: 14, q: 10, ls: 1, sk: ['stats:1'], sr: 1 }));
    return {
      retentionDays: 90, days: 56,
      devices: [
        { ...tablet, sharing: 'on', sharingAt: null, lastSync: isoAt(today, 8, 10), days: tabletRows(today) },
        { id: 'qa00000000000004', label: 'הטלפון', linkedAt: isoAt(shift(today, -20), 18, 0), lastSeen: shift(today, -3), sharing: 'on', sharingAt: null, lastSync: isoAt(shift(today, -3), 19, 40), days: phoneRows },
      ],
    };
  }
  if (state === 'report-empty') return { retentionDays: 90, days: 56, devices: [{ ...tablet, linkedAt: isoAt(today, 7, 30), sharing: 'on', sharingAt: null, lastSync: null, days: [] }] };
  if (state === 'report-off') {
    const rows = tabletRows(today).filter((r) => r.d < shift(today, -3));
    return { retentionDays: 90, days: 56, devices: [{ ...tablet, sharing: 'child_off', sharingAt: isoAt(shift(today, -3), 20, 15), lastSync: isoAt(shift(today, -4), 18, 5), days: rows }] };
  }
  if (state === 'report-old') {
    return { retentionDays: 90, days: 56, devices: [{ ...tablet, sharing: 'on', sharingAt: null, lastSync: isoAt(shift(today, -60), 18, 5), kept: { n: 3, from: shift(today, -70), to: shift(today, -60) }, days: [] }] };
  }
  // any other QA state of the parents' page: no summaries, and nothing is asked of a server
  return { retentionDays: 90, days: 56, devices: [] };
}
