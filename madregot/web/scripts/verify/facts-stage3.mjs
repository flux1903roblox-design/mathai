// Every number curriculum stage 3 writes into its content, computed here: [label, value computed, value written].
// Labels name the stair and the place (disc n = discover step n, ex = worked example, tog = solve together, mis = a
// misconception's remedy, ch = challenge, pts = lesson.points, min = the Ministry's own item, as the content retells it).
// The models' values come from the app's own models (content/data.js), so a quoted bug value is what the app predicts.
//
//   npx vite-node scripts/verify/facts-stage3.mjs                         the facts
//   npx vite-node scripts/verify/facts-stage3.mjs --models <models.mjs>   and the port check: the app's models against
//                                                                          the spec's (scratchpad spec/models.mjs), draw
//                                                                          by draw, from the same seeds
import { DATA1, DATA1T, DATA2, DATA2T, DATA3, DATA3T, DATA4, DATA4T, DATA4J } from '../../src/content/data.js';
import { PROGRAMME } from '../../../shared/programme.js';
import { monthIndex } from '../../../shared/coverage.js';

const sum = (a) => a.reduce((x, y) => x + y, 0);
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const F = [];
const f = (label, got, want) => F.push([label, got, want]);
const M = { data1: DATA1, data1T: DATA1T, data2: DATA2, data2T: DATA2T, data3: DATA3, data3T: DATA3T, data4: DATA4, data4T: DATA4T, data4J: DATA4J };
const bug = (m, id, p) => M[m].bugs[id](p);
const ans = (m, p) => M[m].answer(p);

// ======================================================================= data:1
f('data:1 disc1-5 the sports survey adds up (12 + 8 + 6 + 4)', 12 + 8 + 6 + 4, 30);
f('data:1 disc2 basketball read off the axis', 8, 8);
f('data:1 disc2 wrong: 4 squares of 2', 4 * 2, 8);
f('data:1 disc5 wrong: rows', 4, 4);
f('data:1 disc6 pictogram 3.5 icons × 4', 3.5 * 4, 14);
f('data:1 disc6 3 whole icons', 3 * 4, 12);
f('data:1 disc6 half an icon', 4 / 2, 2);
f('data:1 disc6 wrong: the half as whole (4 × 4)', 4 * 4, 16);
f('data:1 disc6 adventure 8 is 2 icons, comics 10 is 2.5', 8 / 4 + 10 / 4, 4.5);
f('data:1 disc7 (min) above 80: 88 − 80', 88 - 80, 8);
f('data:1 disc7 above 80: 82 − 80', 82 - 80, 2);
f('data:1 disc7 looks ×4', (88 - 80) / (82 - 80), 4);
f('data:1 disc7 real difference', 88 - 82, 6);
f('data:1 ex1 swimming 6 squares × 5', 6 * 5, 30);
f('data:1 ex1 tennis 2 squares × 5', 2 * 5, 10);
f('data:1 ex1 answer', 30 - 10, 20);
f('data:1 ex1 axis 0..35 in 5s: 8 numbers', 35 / 5 + 1, 8);
{ const L = [2, 1, 3, 2, 0, 2, 1, 4, 2, 1]; const c = (v) => L.filter((x) => x === v).length;
  f('data:1 ex2 list length', L.length, 10);
  f('data:1 ex2 counts 0..4', [0, 1, 2, 3, 4].map(c).join(','), '1,3,4,1,1');
  f('data:1 ex2 check', 1 + 3 + 4 + 1 + 1, 10); }
f('data:1 ex3 4 icons × 10 + half', 4 * 10 + 10 / 2, 45);
f('data:1 ex3 thriller row 30 is 3 icons', 30 / 10, 3);
f('data:1 tog1 blue − red', 10 - 4, 6);
f('data:1 tog1 wrong: squares 6 : 2 (TOGETHER_DIAG)', bug('data1', 'scale-units', { s: 2, vals: [6, 10, 4], i: 1, j: 2 }), 3);
f('data:1 tog1 wrong: blue alone (TOGETHER_DIAG)', bug('data1', 'one-value', { s: 2, vals: [6, 10, 4], i: 1, j: 2 }), 10);
f('data:1 tog2 pupils measured', 2 + 5 + 7 + 4 + 2, 20);
f('data:1 tog2 wrong: sizes added', 36 + 37 + 38 + 39 + 40, 190);
f('data:1 mis scale-units: 4 squares × 5', 4 * 5, 20);
f('data:1 mis scale-units explore: 35 is 7 squares of 5', 35 / 5, 7);
f('data:1 mis one-value: 30 − 10', 30 - 10, 20);
f('data:1 mis icon-count: 3 icons × 4', 3 * 4, 12);
f('data:1 mis icon-count: 2.5 icons × 10', 2.5 * 10, 25);
f('data:1 mis half-icon: 3.5 × 4', 3.5 * 4, 14);
f('data:1 model on ex1: scale-units', bug('data1', 'scale-units', { s: 5, vals: [25, 15, 30, 10], i: 2, j: 3 }), 4);
f('data:1 model on ex1: one-value', bug('data1', 'one-value', { s: 5, vals: [25, 15, 30, 10], i: 2, j: 3 }), 30);
f('data:1 transfer: 4.5 icons, key 6', ans('data1T', { k: 6, icons: [4.5, 2, 3, 1], x: 0 }), 27);
f('data:1 transfer half-icon', bug('data1T', 'half-icon', { k: 6, icons: [4.5, 2, 3, 1], x: 0 }), 30);

// ======================================================================= data:2
f('data:2 disc2 (min) ז׳1 20 of 40', 20 / 40, 0.5);
f('data:2 disc2 (min) ז׳2 15 of 25', 15 / 25, 0.6);
f('data:2 disc3 15 of 25 in fifths', (15 / 25) * 5, 3);
f('data:2 disc3 15 of 25 = 3/5', 3 / 5, 0.6);
f('data:2 disc5 total 6 + 9 + 5', 6 + 9 + 5, 20);
f('data:2 disc5 blue 9/20', 9 / 20, 0.45);
f('data:2 disc5 wrong: 9/11 (the rest is 11)', 6 + 5, 11);
f('data:2 disc6 shares add up', 6 / 20 + 9 / 20 + 5 / 20, 1);
f('data:2 disc7 9/20 = 45/100', (9 / 20) * 100, 45);
f('data:2 disc8 12 of 30 (4 tenths)', 12 / 30, 0.4);
f('data:2 disc8 9 of 20', 9 / 20, 0.45);
f('data:2 ex1 total', 8 + 14 + 6 + 12, 40);
f('data:2 ex1 14/40', 14 / 40, 0.35);
f('data:2 ex2 (min) junction total', 25 + 10 + 5 + 10, 50);
f('data:2 ex2 buses', 10 / 50, 0.2);
f('data:2 ex2 shares add up', 25 / 50 + 10 / 50 + 5 / 50 + 10 / 50, 1);
f('data:2 tog1 7/25', 7 / 25, 0.28);
f('data:2 tog1 the rest', 25 - 7, 18);
f('data:2 tog1 part-part 7/18 to hundredths', r2(7 / 18), 0.39);
f('data:2 tog1 inverse 25/7 to hundredths', r2(25 / 7), 3.57);
f('data:2 tog1 in percent', 100 * 7 / 25, 28);
f('data:2 tog2 6/24', 6 / 24, 0.25);
f('data:2 tog2 6/20', 6 / 20, 0.3);
f('data:2 tog2 part-part 6/14 to hundredths', r2(6 / 14), 0.43);
f('data:2 mis per-category (2, 9, 4, 5)', 2 + 9 + 4 + 5, 20);
f('data:2 mis div-by-rel: 0.35 · 40', 0.35 * 40, 14);
f('data:2 mis div-by-rel: 40 : 0.35 over 100', 40 / 0.35 > 100, true);
f('data:2 mis div-by-rel bar: 7 of 20 parts', 7 / 20, 0.35);
f('data:2 model on disc5: part-part', r3(bug('data2', 'part-part', { f: [6, 9, 5, 0], N: 20, j: 1 })), 0.818);
f('data:2 model pct-for-dec on disc5', bug('data2', 'pct-for-dec', { f: [6, 9, 5, 0], N: 20, j: 1 }), 45);
f('data:2 transfer (min) answer', ans('data2T', { n1: 40, k1: 20, n2: 25, k2: 15 }), 0.6);
f('data:2 transfer (min) bigger-count', bug('data2T', 'bigger-count', { n1: 40, k1: 20, n2: 25, k2: 15 }), 0.5);

// ======================================================================= data:3
{ const calls = [250, 100, 125, 25]; const N = sum(calls);
  f('data:3 disc1 (min) calls', N, 500);
  f('data:3 disc3 percents', calls.map((c) => (100 * c) / N).join(','), '50,20,25,5');
  f('data:3 disc4 parts of 20', calls.map((c) => (20 * c) / N).join(','), '10,4,5,1');
  f('data:3 disc4 a part is 5%', 100 / 20, 5);
  f('data:3 disc2 250/500', 250 / 500, 0.5); }
f('data:3 disc3 125/500 in percent', (100 * 125) / 500, 25);
f('data:3 disc5 100 − 45 − 30', 100 - 45 - 30, 25);
f('data:3 disc5 wrong 45 + 30', 45 + 30, 75);
f('data:3 disc6 pie adds up 35 + 40 + 25', 35 + 40 + 25, 100);
f('data:3 disc6 10% of 240', 240 / 10, 24);
f('data:3 disc6 30% of 240', 3 * 24, 72);
f('data:3 disc6 5% of 240', 24 / 2, 12);
f('data:3 disc6 answer', 72 + 12, 84);
f('data:3 disc6 wrong 240 : 35 to hundredths', r2(240 / 35), 6.86);
f('data:3 disc7 (min) colour pie adds up', 30 + 25 + 25 + 20, 100);
f('data:3 disc7 10% is 25', 75 / 3, 25);
f('data:3 disc7 the whole', 25 * 10, 250);
f('data:3 disc7 wrong 30% of 75', (30 * 75) / 100, 22.5);
f('data:3 disc7 wrong 75 : 30', 75 / 30, 2.5);
f('data:3 disc8 60 + 45 + 70', 60 + 45 + 70, 175);
f('data:3 ex1 pie adds up', 25 + 40 + 35, 100);
f('data:3 ex1 10% of 120', 120 / 10, 12);
f('data:3 ex1 35% of 120', 3 * 12 + 6, 42);
f('data:3 ex2 total', 14 + 10 + 16, 40);
f('data:3 ex2 14/40 in percent', (14 / 40) * 100, 35);
f('data:3 ex3 75 is 30%', (75 / 3) * 10, 250);
f('data:3 tog1 pie adds up', 20 + 45 + 35, 100);
f('data:3 tog1 1% of 300', 300 / 100, 3);
f('data:3 tog1 45% of 300', 45 * 3, 135);
f('data:3 tog1 div-by-pct 300 : 45 to hundredths', r2(bug('data3', 'div-by-pct', { N: 300, ps: [20, 45, 35], x: 1 })), 6.67);
f('data:3 tog2 60 is 25%', 60 * 4, 240);
f('data:3 tog2 pct-of-part 25% of 60', bug('data3T', 'pct-of-part', { p: 25, N: 240, c: 60 }), 15);
f('data:3 tog2 stop-at-one 60 : 25', bug('data3T', 'stop-at-one', { p: 25, N: 240, c: 60 }), 2.4);
f('data:3 mis count-as-pct explore: 35/40/25 as parts of 20', [35, 40, 25].map((p) => p / 5).join(','), '7,8,5');
f('data:3 mis div-by-pct explore: a part of 20 of 240', 240 / 20, 12);
f('data:3 mis div-by-pct explore: 84 is 7 parts', 84 / 12, 7);
f('data:3 mis pct-of-part explore: 30% is 6 parts', 30 / 5, 6);
f('data:3 mis pct-of-part explore: a part is 12.5, the whole 250', (75 / 6) * 20, 250);
f('data:3 mis inverse-ratio: 14/40 in percent', (14 / 40) * 100, 35);
f('data:3 mis inverse-ratio: 40/14 in percent, rounded', Math.round((40 / 14) * 100), 286);

// ======================================================================= data:4
f('data:4 disc3 (min) wallet 4 + 2 + 1', 4 + 2 + 1, 7);
f('data:4 disc3 4/7 to hundredths', r2(4 / 7), 0.57);
f('data:4 disc3 equiprob 1/3', bug('data4', 'equiprob', { c: [4, 2, 1], N: 7, j: 0, k: 3 }), 1 / 3);
f('data:4 disc3 part-part 4/3', bug('data4', 'part-part', { c: [4, 2, 1], N: 7, j: 0, k: 3 }), 4 / 3);
f('data:4 disc5 the wheel 3 + 5 + 4', 3 + 5 + 4, 12);
f('data:4 disc5 red 3 of 12', 3 / 12, 0.25);
{ const reds = [1, 1, 2, 3, 3, 3, 4, 4, 5, 5]; // red, blue, red, red, green, blue, red, green, red, blue
  f('data:4 disc6 Noa: red 5 of 10', reds[9], 5);
  f('data:4 disc6 Noa: the last relative frequency', reds[9] / 10, 0.5);
  f('data:4 disc6 Noa: each count goes up by at most 1', reds.every((k, i) => !i || k - reds[i - 1] <= 1), true); }
{ const spins = [510, 243, 247];
  f('data:4 disc7 (min) spins', sum(spins), 1000);
  f('data:4 disc7 shares', spins.map((s) => s / 1000).join(','), '0.51,0.243,0.247');
  f('data:4 disc7 equal sectors would give about 333 each', Math.round(1000 / 3), 333); }
f('data:4 disc8 (min) 70/120 of 24', (24 * 70) / 120, 14);
f('data:4 disc8 70/120 to hundredths', r2(70 / 120), 0.58);
f('data:4 disc8 transfer model on the bag', ans('data4T', { B: 24, n: 120, w: 70, c: 14 }), 14);
f('data:4 disc8 rel-not-scaled', r2(bug('data4T', 'rel-not-scaled', { B: 24, n: 120, w: 70, c: 14 })), 0.58);
f('data:4 disc8 draws-as-count', bug('data4T', 'draws-as-count', { B: 24, n: 120, w: 70, c: 14 }), 70);
f('data:4 ex1 total', 6 + 8 + 6, 20);
f('data:4 ex1 8/20', 8 / 20, 0.4);
f('data:4 ex1 2/5', 2 / 5, 0.4);
f('data:4 ex2 80/200', 80 / 200, 0.4);
f('data:4 ex2 0.4 × 30', 0.4 * 30, 12);
f('data:4 ex3 400 × 1/8', 400 / 8, 50);
f('data:4 tog1 (critique) 5 + 2 + 3', 5 + 2 + 3, 10);
f('data:4 tog1 2/10', 2 / 10, 0.2);
f('data:4 tog1 equiprob 1/3 typed to tenths is not the answer', Math.round(10 / 3) / 10 !== 0.2, true);
f('data:4 tog1 part-part 2/8', bug('data4', 'part-part', { c: [5, 2, 3], N: 10, j: 1, k: 3 }), 0.25);
f('data:4 tog2 150/600', 150 / 600, 0.25);
f('data:4 tog2 a fair die: 600 × 1/6', 600 / 6, 100);
f('data:4 tog2 part-part 150/450', 150 / (600 - 150), 1 / 3);
f('data:4 mis old-total etc. (retold): 10% of 300', 0.1 * 300, 30);
f('data:4 mis old-total: 30 + 60 over 300 + 60', ans('data4J', { N: 300, p: 10, m: 60, x: 30 }), 0.25);
f('data:4 mis old-total: 90/300', bug('data4J', 'old-total', { N: 300, p: 10, m: 60, x: 30 }), 0.3);
f('data:4 mis new-not-counted: 30/360 to hundredths', r2(bug('data4J', 'new-not-counted', { N: 300, p: 10, m: 60, x: 30 })), 0.08);
f('data:4 mis old-rel', bug('data4J', 'old-rel', { N: 300, p: 10, m: 60, x: 30 }), 0.1);
f('data:4 mis bars: 30 of 300 is 1 of 10, 90 of 360 is 3 of 12', [30 / 300, 90 / 360].join(','), [1 / 10, 3 / 12].join(','));
f('data:4 mis equiprob explore: the 20s of the bag', 4 / 7 > 1 / 2, true);

// ======================================================================= challenges and points
f('data:c1 (min) Ido 12 of 20', (100 * 12) / 20, 60);
f('data:c1 (min) Noam 7 of 10', (100 * 7) / 10, 70);
f('data:c1 Ido needs 70% of 20', 0.7 * 20, 14);
f('data:c1 Ido threw twice as many', 20 / 10, 2);
f('data:c2 20/40 < 15/25 and 20 > 15', 20 / 40 < 15 / 25 && 20 > 15, true);
f('data:c3 (retold) 10% of 300', 0.1 * 300, 30);
f('data:c3 after 60 joined', 30 + 60, 90);
f('data:c3 wrong line 90/300', 90 / 300, 0.3);
f('data:c3 fix 90/360', 90 / 360, 0.25);
f('pts 9/20 = 0.45 = 45%', 100 * (9 / 20), 45);
f('pts 30% of 240', 0.3 * 240, 72);

// ======================================================================= the programme
const units = Object.fromEntries(PROGRAMME.units.map((u) => [u.id, u]));
f('7.15 is 2 h of stats:1 and 4 h of data:1', JSON.stringify(units['7.15'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[2, ['stats:1']], [4, ['data:1']]]));
f('7.16 is 5 h of data:2-3', JSON.stringify(units['7.16'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[5, ['data:2', 'data:3']]]));
f('7.17 is 4 h of data:4', JSON.stringify(units['7.17'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[4, ['data:4']]]));
f('month data:1 for ז׳ (January)', monthIndex('data:1', '7'), 4);
f('month data:2 for ז׳ (February)', monthIndex('data:2', '7'), 5);
f('month data:4 for ז׳ (February)', monthIndex('data:4', '7'), 5);

const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) : a === b);
const bad = F.filter(([, got, want]) => !same(got, want));
bad.forEach(([label, got, want]) => console.log(`  FAIL ${label}: computed ${got}, written ${want}`));
console.log(`${F.length} data:1-4 facts checked${bad.length ? `, ${bad.length} FAILED` : ', all pass'}`);

// ---------------------------------------------------------------- the port check (optional)
const at = process.argv.indexOf('--models');
let portBad = 0;
if (at > 0) {
  const { MODELS } = await import(process.argv[at + 1]);
  const seeded = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  let n = 0;
  for (const [name, app] of Object.entries(M)) {
    const spec = MODELS[name]; const ra = seeded(name.length * 31 + 7); const rs = seeded(name.length * 31 + 7);
    for (let i = 0; i < 5000; i += 1) {
      const pa = app.params(ra); const ps = spec.params(rs); n += 1;
      const ka = JSON.stringify(pa); const ks = JSON.stringify(ps);
      const va = [app.answer(pa), ...Object.keys(spec.bugs).map((id) => app.bugs[id]?.(pa))];
      const vs = [spec.answer(ps), ...Object.keys(spec.bugs).map((id) => spec.bugs[id](ps))];
      if (ka !== ks || JSON.stringify(va) !== JSON.stringify(vs)) { portBad += 1; if (portBad < 5) console.log(`  PORT ${name} draw ${i}: ${ka} ≠ ${ks}`); }
    }
  }
  console.log(`${n} draws of the nine data models compared with the spec's, ${portBad} differences`);
}
process.exit(bad.length || portBad ? 1 : 0);
