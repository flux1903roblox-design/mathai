// Every number curriculum stage 3 writes into its content, computed here: [label, value computed, value written].
// Labels name the stair and the place (disc n = discover step n, ex = worked example, tog = solve together, mis = a
// misconception's remedy, ch = challenge, pts = lesson.points, min = the Ministry's own item, as the content retells it).
// The models' values come from the app's own models (content/data.js, stats2.js, prob.js), so a quoted bug value is what the app predicts.
//
//   npx vite-node scripts/verify/facts-stage3.mjs                         the facts
//   npx vite-node scripts/verify/facts-stage3.mjs --models <models.mjs>   and the port check: the app's models against
//                                                                          the spec's (scratchpad spec/models.mjs), draw
//                                                                          by draw, from the same seeds
import { DATA1, DATA1T, DATA2, DATA2T, DATA3, DATA3T, DATA4, DATA4T, DATA4J } from '../../src/content/data.js';
import { STATS6, STATS6T, STATS7, STATS7T, STATS8, STATS8T } from '../../src/content/stats2.js';
import { PROB1, PROB1T, PROB2, PROB2T, PROB3, PROB3T, sumCount, sumPairs } from '../../src/content/prob.js';
import { PROGRAMME } from '../../../shared/programme.js';
import { monthIndex } from '../../../shared/coverage.js';

const sum = (a) => a.reduce((x, y) => x + y, 0);
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const F = [];
const f = (label, got, want) => F.push([label, got, want]);
const M = {
  data1: DATA1, data1T: DATA1T, data2: DATA2, data2T: DATA2T, data3: DATA3, data3T: DATA3T, data4: DATA4, data4T: DATA4T, data4J: DATA4J,
  stats6: STATS6, stats6T: STATS6T, stats7: STATS7, stats7T: STATS7T, stats8: STATS8, stats8T: STATS8T,
  prob1: PROB1, prob1T: PROB1T, prob2: PROB2, prob2T: PROB2T, prob3: PROB3, prob3T: PROB3T,
};
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

// ======================================================================= stats:6 (ח׳ 8.10)
f('stats:6 disc1 shoe sizes 42 − 37', 42 - 37, 5);
f('stats:6 disc2 range of 12, 5, 9, 17, 8', Math.max(12, 5, 9, 17, 8) - Math.min(12, 5, 9, 17, 8), 12);
f('stats:6 disc2 wrong: first-last 12 − 8', 12 - 8, 4);
f('stats:6 disc4 before +5', 90 - 60, 30);
f('stats:6 disc4 after +5', 95 - 65, 30);
f('stats:6 disc4 wrong: shift-range 30 + 5', 30 + 5, 35);
f('stats:6 disc5 pins 2, 4, 7 + 3', [2, 4, 7].map((v) => v + 3).join(','), '5,7,10');
f('stats:6 disc5 range kept', 10 - 5, 7 - 2);
f('stats:6 disc7 salaries range', 8000 - 6000, 2000);
f('stats:6 disc7 ×1.1', Math.round(2000 * 1.1), 2200);
f('stats:6 disc7 wrong: +10', 2000 + 10, 2010);
f('stats:6 disc8 (min) the player: 11 · 30 + 6', 11 * 30 + 6, 336);
f('stats:6 disc8 336 : 12', 336 / 12, 28);
f('stats:6 disc8 wrong: midway 30 and 6', (30 + 6) / 2, 18);
f('stats:6 ex1 (min) the workshop sum', 4 * 5000 + 5 * 5200 + 9000, 55000);
f('stats:6 ex1 mean before', 55000 / 10, 5500);
f('stats:6 ex1 the raise shared', 2000 / 10, 200);
f('stats:6 ex1 mean after', (55000 + 2000) / 10, 5700);
f('stats:6 ex1 model', ans('stats6T', { S: 55000, d: 2000, N: 10 }), 5700);
f('stats:6 ex1 model whole-raise', bug('stats6T', 'whole-raise', { S: 55000, d: 2000, N: 10 }), 7500);
f('stats:6 ex1 model mean-unchanged', bug('stats6T', 'mean-unchanged', { S: 55000, N: 10 }), 5500);
f('stats:6 ex1 median and mode stay (4 of 5000, 5 of 5200, 1 of 9000: the 5th and 6th are 5200)', [5000, 5000, 5000, 5000, 5200, 5200, 5200, 5200, 5200, 9000][4], 5200);
f('stats:6 ex2 range 91 − 55', 91 - 55, 36);
f('stats:6 ex2 after +4', 95 - 59, 36);
f('stats:6 tog1 range of 14, 3, 9, 21, 6, 17', 21 - 3, 18);
f('stats:6 tog1 wrong: last − first (TOGETHER_DIAG)', 17 - 14, 3);
f('stats:6 tog2 shift-range (TOGETHER_DIAG)', 25 + 8, 33);
f('stats:6 mis first-last: 3, 9, 1, 6', 9 - 1, 8);
f('stats:6 mis first-last: wrong 6 − 3', 6 - 3, 3);
f('stats:6 model add on ex2 (c 4)', ans('stats6', { op: 'add', r: 36 }), 36);
f('stats:6 model shift-range on ex2', bug('stats6', 'shift-range', { op: 'add', r: 36, c: 4 }), 40);
f('stats:6 model range-max on ex2', bug('stats6', 'range-max', { op: 'add', vals: [64, 78, 55, 91, 70], c: 4 }), 95);
f('stats:6 model ×1.1 of 50', ans('stats6', { op: 'x1.1', r: 50 }), 55);

// ======================================================================= stats:7 (ח׳ 8.10)
f('stats:7 disc2 (min) best legal jump of Yoav (wind 0.5, 1.2, 2.4, 1.8)', Math.max(...[6.2, 6.45, 6.8, 6.5].filter((_, i) => [0.5, 1.2, 2.4, 1.8][i] <= 2)), 6.5);
{ const wind = [1.4, 2.3, 0.8, 1.9, 2.6]; const d = [612, 640, 628, 635, 655]; const legal = [0, 1, 2, 3, 4].filter((i) => wind[i] <= 2);
  f('stats:7 disc4 legal jumps', legal.map((i) => i + 1).join(','), '1,3,4');
  f('stats:7 disc4 legal sum', sum(legal.map((i) => d[i])), 1875);
  f('stats:7 disc4 answer', ans('stats7', { legal, d }), 625);
  f('stats:7 disc4 wrong: all five (ignore-source)', bug('stats7', 'ignore-source', { d }), 634);
  f('stats:7 disc4 wrong: legal over 5 (all-count)', bug('stats7', 'all-count', { legal, d }), 375); }
f('stats:7 disc5 15% of 200', 0.15 * 200, 30);
f('stats:7 disc5 35% of 200', 0.35 * 200, 70);
f('stats:7 disc5 50% of 200', 0.5 * 200, 100);
f('stats:7 disc5 the clubs add to 100%', 15 + 35 + 50, 100);
f('stats:7 disc5 axis 0..120 by 10, a label every 2: 7 labels', 120 / 20 + 1, 7);
f('stats:7 disc6 the pie adds to 100', 50 + 30 + 20, 100);
f('stats:7 disc7 the pie adds to 105', 40 + 35 + 30, 105);
{ const p = { m: [520, 480, 420, 390, 360], S: 350 };
  f('stats:7 disc8 spring sum', 420 + 390 + 360, 1170);
  f('stats:7 disc8 spring mean', 1170 / 3, 390);
  f('stats:7 disc8 answer', ans('stats7T', p), 40);
  f('stats:7 disc8 wrong: total-not-mean', bug('stats7T', 'total-not-mean', p), 820);
  f('stats:7 disc8 wrong: all-months', bug('stats7T', 'all-months', p), 84); }
f('stats:7 ex2 10% of 160', 160 / 10, 16);
f('stats:7 ex2 40% of 160', 0.4 * 160, 64);
f('stats:7 ex2 the pie adds to 100', 25 + 40 + 35, 100);
{ const p = { m: [460, 440, 380, 350, 320], S: 330 };
  f('stats:7 tog1 answer', ans('stats7T', p), 20);
  f('stats:7 tog1 total-not-mean (TOGETHER_DIAG)', bug('stats7T', 'total-not-mean', p), 720);
  f('stats:7 tog1 all-months (TOGETHER_DIAG)', bug('stats7T', 'all-months', p), 60); }
f('stats:7 tog2 tickets 2 · 40 + 3 · 25', 2 * 40 + 3 * 25, 155);

// ======================================================================= stats:8 (ח׳ 8.11)
f('stats:8 disc2 (min) a year of 1.2 over 6', 1.2 / 6, 0.2);
f('stats:8 disc2 2014: 2.0 + 4 · 0.2', 2 + 4 * 0.2, 2.8);
f('stats:8 disc2 wrong (min): the middle 2.6', (2 + 3.2) / 2, 2.6);
f('stats:8 disc2 wrong: five years, 2015', 2 + 5 * 0.2, 3);
f('stats:8 disc4 dline: 4 years of 0.2', 4 * 0.2, 0.8);
f('stats:8 disc4 dline: 6 steps of 0.2 is 1.2', 6 * 0.2, 1.2);
f('stats:8 disc5 (min) March between February and April', (7400 + 7900) / 2, 7650);
f('stats:8 disc6 every two hours', 350 - 200, 150);
f('stats:8 disc6 the trend is uniform', [200, 350, 500, 650].every((v, i, a) => i === 0 || v - a[i - 1] === 150), true);
f('stats:8 disc6 by 16:00', ans('stats8T', { vals: [200, 350, 500, 650], a: 150, s: 1 }), 800);
f('stats:8 disc6 wrong: hours as steps', bug('stats8T', 'hours-as-steps', { vals: [200, 350, 500, 650], a: 150, s: 1 }), 950);
f('stats:8 disc8 (min) 4 to 10 at 6 a year', 102 + 6 * 6, 138);
f('stats:8 disc8 at 30', 138 + 20 * 6, 258);
f('stats:8 disc8 the chart 4, 6, 8, 10', [102, 114, 126, 138].every((v, i) => v === 102 + 12 * i), true);
{ const p = { d: 8, j: 3, rate: 15, y1: 140, y2: 260 };
  f('stats:8 ex1 change', 260 - 140, 120);
  f('stats:8 ex1 a year', 120 / 8, 15);
  f('stats:8 ex1 answer', ans('stats8', p), 185);
  f('stats:8 ex1 midpoint', bug('stats8', 'midpoint', p), 200);
  f('stats:8 ex1 steps-not-scaled', bug('stats8', 'steps-not-scaled', p), 500);
  f('stats:8 ex1 wrong-end', bug('stats8', 'wrong-end', p), 215);
  f('stats:8 ex1 no-start', bug('stats8', 'no-start', p), 45); }
f('stats:8 ex2 an hour', 900 - 780, 120);
f('stats:8 ex2 uniform', 780 - 660, 120);
f('stats:8 ex2 at 13:00', 660 - 3 * 120, 300);
{ const p = { d: 6, j: 2, rate: 6, y1: 48, y2: 84 };
  f('stats:8 tog1 answer', ans('stats8', p), 60);
  f('stats:8 tog1 (critique 3) midpoint 66, not a ten-off slip', bug('stats8', 'midpoint', p), 66);
  f('stats:8 tog1 steps-not-scaled', bug('stats8', 'steps-not-scaled', p), 120);
  f('stats:8 tog1 wrong-end', bug('stats8', 'wrong-end', p), 72);
  f('stats:8 tog1 no-start', bug('stats8', 'no-start', p), 12);
  f('stats:8 tog1 36 in six years', 84 - 48, 36);
  f('stats:8 tog1 half the change', 36 / 2, 18); }
{ const p = { vals: [120, 180, 240, 300], a: 60, s: 3 };
  f('stats:8 tog2 240 + 3 · 60', 240 + 3 * 60, 420);
  f('stats:8 tog2 one step (TOGETHER_DIAG)', 240 + 60, 300);
  f('stats:8 tog2 hours as steps (TOGETHER_DIAG)', 240 + 6 * 60, 600);
  f('stats:8 transfer model on 120..300, 3 steps', ans('stats8T', p), 480); }
f('stats:8 mis wrong-end: 2010 100, 2018 180, a year', (180 - 100) / 8, 10);
f('stats:8 mis wrong-end: 2012', 100 + 2 * 10, 120);
f('stats:8 mis wrong-end: from 2018 instead', 100 + 6 * 10, 160);

// ======================================================================= prob:1-3 (DATA-6)
const count = (n, ok) => Array.from({ length: n }, (_, i) => i + 1).filter(ok).length;
f('prob:1 disc2 a 4 on a die', 1 / 6, 1 / 6);
f('prob:1 disc3 even: 3 faces', count(6, (v) => v % 2 === 0), 3);
f('prob:1 disc3 3/6 = 1/2 (lesson point)', 3 / 6, 0.5);
f('prob:1 raffle 1-9 and 46-72: 9 + 27', 9 + (72 - 46 + 1), 36);
f('prob:1 raffle 36/72', 36 / 72, 0.5);
f('prob:1 raffle fencepost 46-72 counted as 26: 35/72', ans('prob1T', { N: 72, a: 9, b: 46, w: 36 }) - 1 / 72, 35 / 72);
f('prob:1 raffle model 36/72', ans('prob1T', { N: 72, a: 9, b: 46, w: 36 }), 0.5);
f('prob:1 sticker die counts add to 1000', 255 + 168 + 165 + 170 + 162 + 80, 1000);
f('prob:1 ex1 multiples of 3 in 1-20', count(20, (v) => v % 3 === 0), 6);
f('prob:1 ex1 6/20', 6 / 20, 0.3);
f('prob:1 ex2 more than 5 in 1-8', count(8, (v) => v > 5), 3);
f('prob:1 ex2 3/8', 3 / 8, 0.375);
f('prob:1 ex3 two letters of four', 2 / 4, 0.5);
f('prob:1 tg1 more than 7 in 1-10', count(10, (v) => v > 7), 3);
f('prob:1 tg1 model answer 3/10', ans('prob1', { n: 10, e: 'gt', t: 7, k: 3 }), 0.3);
f('prob:1 tg1 one card 1/10', bug('prob1', 'one-over-n', { n: 10, e: 'gt', t: 7, k: 3 }), 0.1);
f('prob:1 tg2 91-100 is 10 tickets', 100 - 91 + 1, 10);
f('prob:1 tg2 15/100', ans('prob1T', { N: 100, a: 5, b: 91, w: 15 }), 0.15);
f('prob:1 tg2 fencepost 14/100', bug('prob1T', 'fencepost', { N: 100, a: 5, b: 91, w: 15 }), 0.14);
f('prob:1 mis fencepost 72 - 46 = 26 jumps', 72 - 46, 26);
f('prob:2 Haifa dry 1 - 0.9', r2(1 - 0.9), 0.1);
f('prob:2 not red: 9 of 12', 9 / 12, 0.75);
f('prob:2 not red 1 - 3/12', 1 - 3 / 12, 0.75);
f('prob:2 green 1 - 0.3 - 0.25', r2(1 - 0.3 - 0.25), 0.45);
f('prob:2 red or blue 0.3 + 0.25', r2(0.3 + 0.25), 0.55);
f('prob:2 only red taken 1 - 0.3', r2(1 - 0.3), 0.7);
f('prob:2 at least 2: 5 faces', count(6, (v) => v >= 2), 5);
f('prob:2 not 6: 5/6', 1 - 1 / 6, 5 / 6);
f('prob:2 pens: blue 28 · 2/7', (28 * 2) / 7, 8);
f('prob:2 pens: pink 2 · 8', 2 * 8, 16);
f('prob:2 pens: others 28 - 8 - 16', 28 - 8 - 16, 4);
f('prob:2 pens model 4/28 = 1/7', ans('prob2T', { N: 28, a: 2, b: 7, m: 2, blue: 8, pink: 16 }), 1 / 7);
f('prob:2 pens one-part 1 - 2/7', bug('prob2T', 'one-part', { N: 28, a: 2, b: 7, m: 2, blue: 8, pink: 16 }), 5 / 7);
f('prob:2 30% rain: 70% dry', 100 - 30, 70);
f('prob:2 tg1 not blue 1 - 0.4', r2(1 - 0.4), 0.6);
f('prob:2 tg2 not winning 1 - 3/8', 1 - 3 / 8, 5 / 8);
f('prob:2 lesson 1 - 0.35', r2(1 - 0.35), 0.65);
f('prob:3 sum 7: 6 cells', sumCount(7), 6);
f('prob:3 sum 12: 1 cell', sumCount(12), 1);
f('prob:3 sum 11: 2 cells', sumCount(11), 2);
f('prob:3 sum 7 6/36 = 1/6', ans('prob3', { e: 'sum', t: 7, sums: [7] }), 1 / 6);
f('prob:3 sum 7 equiprob 1/11', bug('prob3', 'equiprob-sums', { e: 'sum', t: 7, sums: [7] }), 1 / 11);
f('prob:3 sum 7 unordered 3/36', bug('prob3', 'unordered', { e: 'sum', t: 7, sums: [7] }), 3 / 36);
f('prob:3 sum 7 unordered pairs', sumPairs(7), 3);
f('prob:3 at least 10: 3 + 2 + 1', sumCount(10) + sumCount(11) + sumCount(12), 6);
f('prob:3 coin and die: 2 · 6 cells', 2 * 6, 12);
f('prob:3 heads and more than 4: 2/12', ans('prob3T', { kind: 'coin-die', n1: 2, n2: 6, k1: 1, k2: 2 }), 1 / 6);
f('prob:3 coin-die add-probs 1/2 + 2/6', bug('prob3T', 'add-probs', { kind: 'coin-die', n1: 2, n2: 6, k1: 1, k2: 2 }), 5 / 6);
f('prob:3 doubles 6/36', 6 / 36, 1 / 6);
f('prob:3 doubles on the diagonal', [1, 2, 3, 4, 5, 6].length, 6);
f('prob:3 wheel of 3 and coin: 6 cells', 3 * 2, 6);
f('prob:3 21 pairs without order', sumPairs(2) + sumPairs(3) + sumPairs(4) + sumPairs(5) + sumPairs(6) + sumPairs(7) + sumPairs(8) + sumPairs(9) + sumPairs(10) + sumPairs(11) + sumPairs(12), 21);
f('prob:3 double 1 is one cell, 1 and 2 in any order two', JSON.stringify([sumCount(2), sumCount(3)]), JSON.stringify([1, 2]));
f('prob:3 together diag space-21 6/21', 6 / 21, 2 / 7);
f('prob:c2 sum 11 twice sum 12', sumCount(11) / sumCount(12), 2);
f('prob:c3 Haifa dry 1 - 0.9', r2(1 - 0.9), 0.1);
f('prob:c3 Arad 0.05 < 0.2', 0.05 < 0.2, true);
f('prob:c1 not 6 on a die', 5 / 6, 1 - 1 / 6);

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
f('pts stats range of 12, 5, 9, 17, 8', 17 - 5, 12);

// ======================================================================= the programme
const units = Object.fromEntries(PROGRAMME.units.map((u) => [u.id, u]));
f('7.15 is 2 h of stats:1 and 4 h of data:1', JSON.stringify(units['7.15'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[2, ['stats:1']], [4, ['data:1']]]));
f('7.16 is 5 h of data:2-3', JSON.stringify(units['7.16'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[5, ['data:2', 'data:3']]]));
f('7.17 is 4 h of data:4', JSON.stringify(units['7.17'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[4, ['data:4']]]));
f('month data:1 for ז׳ (January)', monthIndex('data:1', '7'), 4);
f('month data:2 for ז׳ (February)', monthIndex('data:2', '7'), 5);
f('month data:4 for ז׳ (February)', monthIndex('data:4', '7'), 5);
f('8.10 is 8 h of stats:2-5 and 4 h of stats:6-7', JSON.stringify(units['8.10'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[8, ['stats:2', 'stats:3', 'stats:4', 'stats:5']], [4, ['stats:6', 'stats:7']]]));
f('8.11 is 4 h of stats:8', JSON.stringify(units['8.11'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[4, ['stats:8']]]));
f('month stats:6 for ח׳ (December)', monthIndex('stats:6', '8'), 3);
f('month stats:8 for ח׳ (January)', monthIndex('stats:8', '8'), 4);
f('8.16 is 2 h of data:4 and 4 h of prob:1-3', JSON.stringify(units['8.16'].parts.map((p) => [p.hours, p.skills])), JSON.stringify([[2, ['data:4']], [4, ['prob:1', 'prob:2', 'prob:3']]]));
f('month prob:1 for ח׳ (March)', monthIndex('prob:1', '8'), 6);
f('prob:1 is no ז׳ stair', monthIndex('prob:1', '7'), null);

const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) : a === b);
const bad = F.filter(([, got, want]) => !same(got, want));
bad.forEach(([label, got, want]) => console.log(`  FAIL ${label}: computed ${got}, written ${want}`));
console.log(`${F.length} data:1-4, stats:6-8 and prob:1-3 facts checked${bad.length ? `, ${bad.length} FAILED` : ', all pass'}`);

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
  console.log(`${n} draws of the ${Object.keys(M).length} data, statistics and probability models compared with the spec's, ${portBad} differences`);
  // the TypeScript teaching content's own models (each stair's diag and transfer, learn/content/*.ts), the ones the
  // checks and the together steps run, against the spec's, draw by draw from the same seeds
  const { DATA } = await import('../../src/learn/content/data.ts');
  const { STATS2 } = await import('../../src/learn/content/stats2.ts');
  const { PROB } = await import('../../src/learn/content/prob.ts');
  const TS = {};
  [...DATA, ...STATS2, ...PROB].forEach((st) => {
    const base = `${st.topic}${st.level}`;
    TS[base] = st.diag; if (st.transfer) TS[`${base}T`] = st.transfer;
  });
  let m = 0; let tsBad = 0;
  for (const [name, ts] of Object.entries(TS)) {
    const spec = MODELS[name];
    if (!spec) { tsBad += 1; console.log(`  PORT ts ${name}: no such model in the spec`); continue; }
    const ra = seeded(name.length * 37 + 11); const rs = seeded(name.length * 37 + 11);
    for (let i = 0; i < 5000; i += 1) {
      const pa = ts.params(ra); const ps = spec.params(rs); m += 1;
      const va = [ts.answer(pa), ...Object.keys(spec.bugs).map((id) => ts.bugs[id]?.(pa))];
      const vs = [spec.answer(ps), ...Object.keys(spec.bugs).map((id) => spec.bugs[id](ps))];
      const extra = Object.keys(ts.bugs).filter((id) => !(id in spec.bugs));
      if (JSON.stringify(pa) !== JSON.stringify(ps) || JSON.stringify(va) !== JSON.stringify(vs) || extra.length) {
        tsBad += 1; if (tsBad < 5) console.log(`  PORT ts ${name} draw ${i}: ${JSON.stringify(pa)} ≠ ${JSON.stringify(ps)}${extra.length ? ` (bugs not in the spec: ${extra})` : ''}`);
      }
    }
  }
  console.log(`${m} draws of the teaching content's ${Object.keys(TS).length} stair models (learn/content/*.ts) compared with the spec's, ${tsBad} differences`);
  portBad += tsBad;
}
process.exit(bad.length || portBad ? 1 : 0);
