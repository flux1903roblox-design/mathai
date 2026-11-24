// Rest days and quiet days (STUDENT-5): the table in shared/restDays.js, its range guard, and its generator.
// Rest days (Shabbat, Yom Tov) are passed over by the streak; quiet days (also the memorial days and Tish'a B'Av) only
// silence reminders, so the streak does not skip them.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { YOMTOV_IL, MEMORIAL_IL, FAST_IL, RANGE, isYomTov, isRestDay, isQuietDay, isEve, isQuietEve } from '@shared/restDays.js';
import { collect, missingVerified, render, urlFor, VERIFIED, MEMORIAL_TITLES } from '../../../scripts/rest-days.mjs';
import { daysBetween, today } from './streak.js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url)); // madregot/
const YOMTOV_5787 = ['2026-09-12', '2026-09-13', '2026-09-21', '2026-09-26', '2026-10-03', '2027-04-22', '2027-04-28', '2027-06-11'];

describe('the 5787 dates verified against Hebcal (Israeli schedule)', () => {
  it('the eight Yom Tov dates are rest days', () => {
    YOMTOV_5787.forEach((d) => { expect(isRestDay(d), d).toBe(true); expect(isYomTov(d), d).toBe(true); });
    expect(YOMTOV_IL.filter((d) => d < '2027-09-01')).toEqual(YOMTOV_5787); // and nothing else in 5787
  });
  it('a Saturday is a rest day, the Friday before it is an eve, and the Thursday is neither', () => {
    expect(isRestDay('2026-11-14')).toBe(true);
    expect(isYomTov('2026-11-14')).toBe(false);
    expect(isEve('2026-11-13')).toBe(true);
    expect(isRestDay('2026-11-13')).toBe(false);
    expect(isRestDay('2026-11-12')).toBe(false);
    expect(isEve('2026-11-12')).toBe(false);
  });
  it('the memorial days are quiet but not rest days: the streak does not skip them', () => {
    ['2026-10-05', '2027-05-04', '2027-05-11'].forEach((d) => {
      expect(isQuietDay(d), d).toBe(true);
      expect(isRestDay(d), d).toBe(false);
    });
    expect(MEMORIAL_IL.filter((d) => d < '2027-09-01')).toEqual(['2026-10-05', '2027-05-04', '2027-05-11']);
  });
  it("the day before Yom HaZikaron is a quiet eve (it begins at sundown), not an eve", () => {
    expect(isQuietEve('2027-05-10')).toBe(true);
    expect(isEve('2027-05-10')).toBe(false);
  });
  it("Tish'a B'Av is quiet", () => {
    expect(isQuietDay('2027-08-12')).toBe(true);
    expect(isRestDay('2027-08-12')).toBe(false);
    expect(FAST_IL.filter((d) => d < '2027-09-01')).toEqual(['2027-08-12']);
  });
  it("Tish'a B'Av moved off Shabbat to Sunday is quiet on the Sunday (2029)", () => {
    expect(isQuietDay('2029-07-22')).toBe(true);
    expect(isRestDay('2029-07-22')).toBe(false);
  });
  it('every school year has its eight Yom Tov days, three memorial days and Tish\'a B\'Av', () => {
    for (let y = 2026; y < 2031; y += 1) {
      const inYear = (xs) => xs.filter((d) => d >= `${y}-09-01` && d <= `${y + 1}-08-31`).length;
      expect([inYear(YOMTOV_IL), inYear(MEMORIAL_IL), inYear(FAST_IL)], `${y}-${y + 1}`).toEqual([8, 3, 1]);
    }
  });
  it('a two-day Yom Tov: the first day is not an eve, the day before it is', () => {
    expect(isEve('2026-09-11')).toBe(true); // Erev Rosh Hashana
    expect(isEve('2026-09-12')).toBe(false);
    expect(isEve('2026-09-20')).toBe(true); // Erev Yom Kippur
  });
  it('the weekday does not depend on the time zone (UTC noon)', () => {
    expect(isRestDay('2026-11-07')).toBe(true); // a Saturday
    expect(isRestDay('2026-11-08')).toBe(false); // a Sunday
  });
});

describe('the range guard', () => {
  it('the table covers today, and is regenerated at least 180 days before it runs out', () => {
    const now = today();
    expect(now >= RANGE.from, `today (${now}) is before the table starts (${RANGE.from})`).toBe(true);
    // From 180 days before RANGE.to this fails: run `node madregot/scripts/rest-days.mjs` on a machine with network
    // access (it asks Hebcal for the next school years) and commit madregot/shared/restDays.js.
    expect(daysBetween(now, RANGE.to), `the holiday table ends on ${RANGE.to}: run node madregot/scripts/rest-days.mjs`).toBeGreaterThanOrEqual(180);
  });
  it('every listed date lies inside the range', () => {
    [...YOMTOV_IL, ...MEMORIAL_IL, ...FAST_IL].forEach((d) => { expect(d >= RANGE.from && d <= RANGE.to, d).toBe(true); });
  });
});

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : /\.(m?js|jsx|ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe('licences: the app and the Worker never import a Hebcal package', () => {
  it('no file under web/src or worker/src imports @hebcal', () => {
    const hits = ['web/src', 'worker/src'].flatMap((d) => filesUnder(join(ROOT, d))).filter((f) => /['"]@hebcal\//.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
  it('the holiday table credits Hebcal in ASSETS.md', () => {
    expect(readFileSync(join(ROOT, 'ASSETS.md'), 'utf8')).toContain('Jewish holiday dates: Hebcal.com, CC BY 4.0');
  });
});

describe('the generator (scripts/rest-days.mjs) on an answer shaped like Hebcal\'s', () => {
  // a synthetic answer in Hebcal's JSON shape (title, date, yomtov), not a recorded one
  const items = [
    { title: 'Erev Rosh Hashana', date: '2026-09-11', category: 'holiday', subcat: 'major' },
    { title: 'Rosh Hashana 5787', date: '2026-09-12', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Rosh Hashana II', date: '2026-09-13', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Yom Kippur', date: '2026-09-21', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Sukkot I', date: '2026-09-26', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Sukkot II (CH\'\'M)', date: '2026-09-27', category: 'holiday', subcat: 'major' },
    { title: 'Shmini Atzeret', date: '2026-10-03', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Swords of Iron War Memorial Day', date: '2026-10-05', category: 'holiday', subcat: 'modern' },
    { title: 'Sigd', date: '2026-11-18', category: 'holiday', subcat: 'modern' },
    { title: 'Family Day', date: '2027-02-04', category: 'holiday', subcat: 'modern' },
    { title: 'Pesach I', date: '2027-04-22', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Pesach VII', date: '2027-04-28', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Yom HaShoah', date: '2027-05-04', category: 'holiday', subcat: 'modern' },
    { title: 'Yom HaZikaron', date: '2027-05-11', category: 'holiday', subcat: 'modern' },
    { title: 'Yom HaAtzma\'ut', date: '2027-05-12', category: 'holiday', subcat: 'modern' },
    { title: 'Shavuot', date: '2027-06-11', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Shavuot', date: '2027-06-11', category: 'holiday', subcat: 'major', yomtov: true },
    { title: 'Erev Tish\u2019a B\u2019Av', date: '2027-08-11', category: 'holiday', subcat: 'major' },
    { title: 'Tish\u2019a B\u2019Av', date: '2027-08-12', category: 'holiday', subcat: 'major' }, // Hebcal writes U+2019
  ];
  it('takes Yom Tov from yomtov: true, memorial days from the exact-title list, and Tish\'a B\'Av', () => {
    const lists = collect(items);
    expect(lists).toEqual({ yomtov: VERIFIED.yomtov, memorial: VERIFIED.memorial, fast: VERIFIED.fast });
    expect(lists.memorial).not.toContain('2026-11-18'); // Sigd is not quiet
    expect(MEMORIAL_TITLES).toEqual(['Yom HaShoah', 'Yom HaZikaron', 'Swords of Iron War Memorial Day']);
    expect(missingVerified(lists)).toEqual([]);
  });
  it('fails when a verified date is missing from the answer', () => {
    const lists = collect(items.filter((it) => it.title !== 'Swords of Iron War Memorial Day' && it.title !== 'Yom Kippur'));
    expect(missingVerified(lists)).toEqual(['yomtov: 2026-09-21', 'memorial: 2026-10-05']);
  });
  it('asks for the Israeli schedule with major and modern holidays', () => {
    expect(urlFor('2026-09-01', '2027-08-31')).toBe('https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&mod=on&i=on&start=2026-09-01&end=2027-08-31');
  });
  it('writes the file in the repository: the same header, range line and rules', () => {
    const text = render(collect(items), RANGE);
    const repo = readFileSync(join(ROOT, 'shared/restDays.js'), 'utf8');
    const rules = (x) => x.slice(x.indexOf('/** The dates this table covers.'));
    expect(rules(text)).toBe(rules(repo));
    const head = (x) => x.slice(0, x.indexOf('/** Yom Tov in Israel'));
    expect(head(text)).toBe(head(repo));
    expect(text).toContain(`export const YOMTOV_IL = ['${VERIFIED.yomtov.join("', '")}'];`);
    expect(text.startsWith('// Generated by scripts/rest-days.mjs from Hebcal.com (CC BY 4.0). Do not edit by hand.')).toBe(true);
  });
});
