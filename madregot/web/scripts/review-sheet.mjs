// A teacher's review sheet of one topic (CURRICULUM-9, DATA-9): one printable, right-to-left HTML page with everything a
// student meets on each stair, so an Israeli ז׳–ח׳ maths teacher can read it before students do and write in its
// margin. No student data: it reads only the app's content.
//
//   npm run review:sheet -- <topic> [stairs]          writes madregot/review/<topic>.html
//   npm run review:sheet -- stats 6-8                 only stairs 6 to 8 (also 6,8 or 7)
//   npm run review:sheet -- data --out /some/dir      another folder
//
// For every stair: its objectives, key idea and new words; the discover steps with their drawings (an object the student
// moves is said in words, with what it must reach); the worked examples step by step; the solve-together problems with
// every choice and its feedback; the misconceptions with their cause, explanation and remedy; 20 practice exercises
// drawn from the stair's own generator, each with its answer, worked solution and the mistakes it can name; and the
// diagnostic models (the questions of its checks): how often each misconception's prediction differs from the answer.
// Each block has an empty column on its right for the teacher's comments; comments go back as issues with
// .github/ISSUE_TEMPLATE/content-review.md (נושא, מדרגה, שלב / שאלה, מה לא תקין, הצעה).
//
// It runs under vite-node (not plain node): the teaching content is TypeScript behind the '@' alias, and the drawings
// are the app's own (components/Figure.jsx, rendered with renderToStaticMarkup). The same seed gives the same sheet.
// Importing it (the test does) runs nothing: reviewSheet() is pure apart from the random draws it seeds itself.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import katex from 'katex';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import Figure from '@/components/Figure.jsx';
import { TOPIC, makeItem, answerText, catLabel, namesOf, slotsFor } from '@/content/index.js';
import { manipPlain, manipText } from '@/content/manip.js';
import { loadTopic } from '@/learn/content/index.ts';
import { seeded } from '@/learn/expr.ts';
import { couldShow } from '@/learn/misconceptions.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Practice exercises shown per stair, and draws per diagnostic model for its rates. */
export const ITEMS = 20;
const DRAWS = 2000;
const SEED = 20261111;

// What the owner asks the reviewing teacher in particular, per topic (DATA-9's three questions); other topics: none.
const CHARTS_RTL = 'האם הדיאגרמות נקראות מימין לשמאל, כמו בספר שלכם?';
const QUESTIONS = {
  data: ['האם "נתונים ושכיחות" הוא השם שהכיתה שלך משתמשת בו ליחידה?', CHARTS_RTL],
  stats: [CHARTS_RTL],
  prob: ['האם הטבלה של שתי קוביות מצוירת כמו בכיתה שלך (השורות הן הקובייה הראשונה)?'],
};

// ---------------------------------------------------------------- text, maths and drawings as HTML

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
/** TeX as MathML: every browser draws it, prints it, and needs no stylesheet or font from the network. */
const tex = (t, display = false) => {
  try { return katex.renderToString(String(t ?? ''), { output: 'mathml', displayMode: display, throwOnError: false, strict: 'ignore' }); } catch { return `<code dir="ltr">${esc(t)}</code>`; }
};
/** The app's text: Hebrew with $...$ maths and **bold**. */
export const txt = (s) => String(s ?? '').split(/(\$[^$]+\$)/g).map((part) => (/^\$[^$]+\$$/.test(part)
  ? tex(part.slice(1, -1))
  : esc(part).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'))).join('');
const display = (d) => (d ? `<div class="display">${tex(d, true)}</div>` : '');
/** A drawing, as the app draws it. */
export const fig = (f) => {
  if (!f) return '';
  try { return `<div class="fig">${renderToStaticMarkup(createElement(Figure, { fig: f }))}</div>`; } catch (e) { return `<div class="fig missing">ציור שלא נוצר: ${esc(f.type)} (${esc(e.message)})</div>`; }
};
const list = (items, cls = '') => (items?.length ? `<ul${cls ? ` class="${cls}"` : ''}>${items.map((x) => `<li>${txt(x)}</li>`).join('')}</ul>` : '');
const pct = (x) => `${Math.round(100 * x)}%`;

/** One block of the sheet: its content, and the empty comment column on its right. */
const block = (title, body, kind = '') => `<section class="block${kind ? ` ${kind}` : ''}"><div class="note" aria-label="הערות"><span>הערות</span></div><div class="body"><h4>${title}</h4>${body}</div></section>`;

const STEP_KIND = { say: 'הסבר', predict: 'ניחוש לפני ההסבר', explore: 'פעילות', rule: 'הכלל' };
/** A discover (or remedy) step. */
function stepHtml(st) {
  const parts = [`<p>${txt(st.text)}</p>`, display(st.display), fig(st.fig)];
  if (st.kind === 'predict') {
    parts.push(`<ol class="choices">${st.choices.map((c, i) => `<li${i === st.answer ? ' class="right"' : ''}>${txt(c)}${i === st.answer ? ' <b>(התשובה)</b>' : ''}${st.wrongWhy?.[i] ? `<div class="sub">אם בחרו בזה: ${txt(st.wrongWhy[i])}</div>` : ''}</li>`).join('')}</ol>`);
    parts.push(`<p class="sub">למה: ${txt(st.why)}</p>`);
  }
  if (st.kind === 'explore') {
    const it = { manip: st.manip, answer: st.answer };
    parts.push(`<p class="sub">מה מזיזים: ${esc(manipPlain(it).replace(/^\[|\]$/g, ''))}</p>`);
    parts.push(`<p class="sub">היעד: ${esc(manipText(it, st.answer))}</p>`);
    parts.push(`<p class="sub">רמז: ${txt(st.hint)}</p><p class="sub">כשמגיעים: ${txt(st.success)}</p>`);
  }
  if (st.kind === 'rule') parts.push(`<p class="sub">למה זה עובד: ${txt(st.why)}</p>`);
  return parts.join('');
}

function exampleHtml(ex) {
  const steps = ex.steps.map((s) => `<li><b>${txt(s.action)}</b> ${txt(s.why)}${s.result ? `<div class="display small">${tex(s.result, true)}</div>` : ''}</li>`).join('');
  return `<p>${txt(ex.problem)}</p>${display(ex.display)}${fig(ex.fig)}<ol class="steps">${steps}</ol><p class="answer">התשובה: ${ex.answerTex ? tex(ex.answerTex) : esc(ex.answer)}</p>`;
}

function togetherHtml(g) {
  const steps = g.steps.map((s) => `<li><p>${txt(s.prompt)}</p>${display(s.display)}<ul class="choices">${s.choices.map((c) => `<li${c.ok ? ' class="right"' : ''}>${txt(c.text)}${c.ok ? ' <b>(נכון)</b>' : ''}<div class="sub">${txt(c.feedback)}</div></li>`).join('')}</ul><p class="sub">רמזים: ${txt(s.hints[0])} / ${txt(s.hints[1])}</p><p class="sub">אחרי הצעד: ${txt(s.done)}</p></li>`).join('');
  const f = g.final;
  return `<p>${txt(g.problem)}</p>${display(g.display)}${fig(g.fig)}<ol class="steps">${steps}</ol><p><b>הצעד האחרון, לבד:</b> ${txt(f.prompt)}</p><p class="answer">התשובה: ${esc(f.answer)}${f.precise ? ' (בדיוק)' : ''}</p><p class="sub">רמזים: ${txt(f.hints[0])} / ${txt(f.hints[1])}</p>`;
}

function misconHtml(m) {
  return `<p><b>${txt(m.title)}</b> <code>${esc(m.id)}</code></p><p class="sub">הסיבה: ${txt(m.cause)}</p>${list(m.explain)}${m.remedy?.length ? `<p class="sub">התיקון (פעילות):</p><ol class="steps">${m.remedy.map((st) => `<li><span class="kind">${STEP_KIND[st.kind] || st.kind}</span> ${stepHtml(st)}</li>`).join('')}</ol>` : ''}`;
}

/** One practice exercise of the stair's generator, as the student sees it, with its answer and worked solution. */
function itemHtml(it, n) {
  const q = [`<p>${txt(it.text)}</p>`, display(it.display), fig(it.fig)];
  if (it.form === 'mc') q.push(`<ol class="choices">${it.choices.map((c, i) => `<li${i === it.answer ? ' class="right"' : ''}>${c.tex ? tex(c.tex) : txt(c.text)}</li>`).join('')}</ol>`);
  if (it.form === 'manip') q.push(`<p class="sub">${esc(manipPlain(it).replace(/^\[|\]$/g, ''))}</p>`);
  const how = it.form === 'frac' ? ' (כשבר: מונה ומכנה)' : slotsFor(it).length > 1 ? ` (${slotsFor(it).join(', ')})` : '';
  const named = it.form === 'manip' ? [] : namesOf(it).map((id) => catLabel(it.topic, it.level, id) || id);
  return `<div class="item"><p class="num">תרגיל ${n}${it.practiceOnly ? ' <span class="tag">תרגול בלבד</span>' : ''}</p>${q.join('')}`
    + `<p class="answer">התשובה${how}: ${esc(answerText(it))}${it.unit ? ` ${esc(it.unit)}` : ''}</p>`
    + `<ol class="steps">${(it.solution || []).map((s) => `<li>${txt(s)}</li>`).join('')}</ol>`
    + `<p class="sub">רמז: ${txt(it.hint)}</p>`
    + (named.length ? `<p class="sub">טעויות שהתרגיל מזהה: ${named.map(txt).join('; ')}</p>` : '')
    + '</div>';
}

/** A diagnostic model's rates: on how many draws each misconception predicts an answer other than the right one. */
export function modelRates(model, rnd, draws = DRAWS) {
  const ids = Object.keys(model.bugs); const shows = Object.fromEntries(ids.map((id) => [id, 0]));
  for (let i = 0; i < draws; i += 1) couldShow(model, model.params(rnd)).forEach((id) => { shows[id] += 1; });
  return ids.map((id) => ({ id, rate: shows[id] / draws }));
}
function modelHtml(c, model, name, rnd) {
  const rates = modelRates(model, rnd);
  const p = model.params(rnd);
  const words = (id) => c.misconceptions.find((m) => m.id === id)?.title || catLabel(c.topic, c.level, id) || id;
  return `<p class="sub">שאלה לדוגמה:</p><p>${txt(model.text(p))}</p>${display(model.display?.(p))}${fig(model.fig?.(p))}`
    + `<p class="answer">התשובה: ${esc(model.answer(p))}</p>`
    + `<table class="rates"><thead><tr><th>טעות</th><th>מזוהה ב־</th><th>בשאלה לדוגמה</th></tr></thead><tbody>${rates.map(({ id, rate }) => {
      const v = model.bugs[id](p);
      return `<tr><td>${txt(words(id))} <code>${esc(id)}</code></td><td>${pct(rate)} מ־${DRAWS} שאלות</td><td>${v == null || !Number.isFinite(v) ? '—' : esc(Math.round(v * 1000) / 1000)}</td></tr>`;
    }).join('')}</tbody></table><p class="sub">${esc(name)}: כמה פעמים, מתוך ${DRAWS} שאלות שהבדיקות שואלות, התשובה של כל טעות שונה מהתשובה הנכונה (אז אפשר לזהות אותה).</p>`;
}

/** Everything of one stair. */
function stairHtml(c, rnd) {
  const out = [];
  out.push(`<h2 id="${esc(c.skill)}">מדרגה ${c.level}: ${txt(c.title)} <code>${esc(c.skill)}</code></h2>`);
  out.push(block('מטרות, הרעיון והמילים', `${list(c.objectives)}<p><b>הרעיון:</b> ${txt(c.idea)}</p>${c.why?.length ? `<p class="sub">למה זה עובד:</p>${list(c.why)}` : ''}${c.alt?.length ? `<p class="sub">דרך אחרת:</p>${list(c.alt)}` : ''}${c.words?.length ? `<p class="sub">מילים חדשות: ${c.words.map(txt).join(', ')}</p>` : ''}`));
  c.discover.forEach((st, i) => out.push(block(`גילוי ${i + 1} מתוך ${c.discover.length}: ${STEP_KIND[st.kind] || st.kind}`, stepHtml(st), 'discover')));
  c.examples.forEach((ex, i) => out.push(block(`דוגמה פתורה ${i + 1}`, exampleHtml(ex))));
  c.together.forEach((g, i) => out.push(block(`פותרים יחד ${i + 1}`, togetherHtml(g))));
  c.misconceptions.forEach((m) => out.push(block(`טעות נפוצה: ${txt(m.title)}`, misconHtml(m), 'miscon')));
  const items = Array.from({ length: ITEMS }, () => makeItem(c.topic, c.level));
  out.push(block(`${ITEMS} תרגילים לדוגמה מהתרגול`, items.map((it, i) => itemHtml(it, i + 1)).join(''), 'items'));
  out.push(block('שאלות הבדיקה: המודל האבחוני', modelHtml(c, c.diag, 'המודל האבחוני', rnd), 'model'));
  if (c.transfer) out.push(block('שאלות הבדיקה: שאלות העברה (הקשר אחר)', modelHtml(c, c.transfer, 'שאלות ההעברה', rnd), 'model'));
  return out.join('\n');
}

/** "6-8", "6,8", "7" → [6, 7, 8] ... ; nothing → null (every stair). */
export function parseStairs(s) {
  if (!s) return null;
  const out = new Set();
  for (const part of String(s).split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`stairs "${s}": write them as 6-8, 6,8 or 7`);
    for (let k = Number(m[1]); k <= Number(m[2] || m[1]); k += 1) out.add(k);
  }
  return [...out].sort((a, b) => a - b);
}

const SRC = join(HERE, '..', 'src', 'styles');
/** The CSS between two markers of a stylesheet, both included (a marker that is not there gives nothing). */
const between = (css, from, to) => {
  const a = css.indexOf(from); const b = css.indexOf('\n', css.indexOf(to, a));
  return a < 0 || b < 0 ? '' : css.slice(a, b);
};
/**
 * The app's colour tokens (tokens.css :root), its base figure rules (app.css: a drawing runs left to right, its axes,
 * ticks and tables) and the drawings' own rules (lazy/figure.css), so a figure looks as it does in the app.
 */
function figureCss() {
  const read = (...p) => readFileSync(join(SRC, ...p), 'utf8');
  return [between(read('tokens.css'), ':root {', '\n}'), between(read('app.css'), '.figure { width', '.fg-table th {'), read('lazy', 'figure.css')].join('\n');
}

const PAGE_CSS = `
  body { font-family: Rubik, Arial, sans-serif; color: #1f2430; background: #fff; margin: 0; padding: 24px; line-height: 1.55; font-size: 14px; }
  main { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 20px; margin: 32px 0 8px; padding-top: 12px; border-top: 3px solid #1f5fe0; page-break-before: always; }
  h2:first-of-type { page-break-before: auto; } h4 { margin: 0 0 6px; font-size: 15px; }
  code { font-size: 11px; color: #5b6475; direction: ltr; unicode-bidi: isolate; }
  .lead { color: #4a5263; margin: 0 0 16px; } .lead li { margin: 2px 0; }
  .block { display: grid; grid-template-columns: 30% 1fr; border: 1px solid #c9cfdb; border-radius: 8px; margin: 8px 0; break-inside: avoid; }
  .block.items, .block.discover, .block.miscon { break-inside: auto; }
  .note { border-inline-end: 1px dashed #c9cfdb; padding: 8px; color: #8a93a6; font-size: 12px; min-height: 64px; }
  .body { padding: 10px 14px; min-width: 0; }
  .sub { color: #4a5263; font-size: 13px; margin: 4px 0; }
  .answer { font-weight: 600; margin: 6px 0; }
  .right { font-weight: 600; }
  .choices li, .steps li { margin: 4px 0; }
  .display { margin: 6px 0; } .display.small { margin: 2px 0; }
  .fig { max-width: 100%; margin: 8px 0; overflow-x: auto; } .fig svg { max-width: 340px; height: auto; } .fig.missing { color: #b42318; }
  .visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .item { border-top: 1px solid #e3e7ef; padding: 8px 0; break-inside: avoid; } .item:first-child { border-top: 0; }
  .num { font-weight: 700; margin: 0; } .tag { font-weight: 400; font-size: 12px; background: #eef2fb; border-radius: 4px; padding: 1px 6px; }
  .kind { font-size: 12px; color: #1f5fe0; font-weight: 600; }
  table.rates { border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0; }
  table.rates th, table.rates td { border: 1px solid #d8dde7; padding: 4px 6px; text-align: start; }
  math { font-size: 1.15em; }
  @media print { body { padding: 0; font-size: 12px; } .block { border-color: #999; } }
`;

/**
 * The whole sheet of a topic: { html, stairs } (the stairs drawn, as skill ids). `stairs`: their numbers, or null for
 * all. The random draws (practice exercises, the models' rates) come from `seed`, so a sheet can be regenerated as it was.
 */
export async function reviewSheet(topic, { stairs = null, seed = SEED, date = new Date().toISOString().slice(0, 10) } = {}) {
  const t = TOPIC[topic];
  if (!t) throw new Error(`no topic "${topic}". Topics: ${Object.keys(TOPIC).join(', ')}`);
  const content = (await loadTopic(topic)).filter((c) => !stairs || stairs.includes(c.level)).sort((a, b) => a.level - b.level);
  if (!content.length) throw new Error(`topic ${topic} has no stair ${stairs?.join(', ')} with teaching content`);
  const realRandom = Math.random;
  Math.random = seeded(seed);
  let body;
  try { body = content.map((c) => stairHtml(c, seeded(seed + c.level))).join('\n'); } finally { Math.random = realRandom; }
  const which = stairs ? `מדרגות ${content.map((c) => c.level).join(', ')}` : `כל ${content.length} המדרגות`;
  const toc = content.map((c) => `<li><a href="#${esc(c.skill)}">מדרגה ${c.level}: ${txt(c.title)}</a></li>`).join('');
  const qs = QUESTIONS[topic]?.length ? `<p><b>שאלות שחשוב לנו לשמוע עליהן במיוחד:</b></p>${list(QUESTIONS[topic])}` : '';
  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מדרגות: דף בדיקה למורה, ${esc(t.title)}</title>
<style>${figureCss()}\n${PAGE_CSS}</style>
</head>
<body>
<main>
<h1>דף בדיקה למורה: ${esc(t.title)} (כיתה ${t.grade === '7' ? 'ז׳' : 'ח׳'}), ${which}</h1>
<div class="lead">
<p>כל מה שתלמיד פוגש בכל מדרגה: המטרות, שלבי הגילוי עם הציורים, דוגמאות פתורות, פותרים יחד, טעויות נפוצות והתיקון שלהן, ${ITEMS} תרגילים מהתרגול עם התשובות והפתרונות, ושאלות הבדיקה. בכל קטע יש עמודה ריקה בצד ימין להערות.</p>
<p>אין כאן שום מידע על תלמידים. התרגילים נוצרים מחדש בכל פעם; הדף הזה נוצר ב־${esc(date)}.</p>
<p>הערות אפשר לכתוב בעמודה ולשלוח צילום, או בקצרה לפי הסדר: נושא, מדרגה, שלב או שאלה, מה לא תקין, הצעה.</p>
${qs}
<ol>${toc}</ol>
</div>
${body}
</main>
</body>
</html>
`;
  return { html, stairs: content.map((c) => c.skill) };
}

// ---------------------------------------------------------------- the command

// vite-node hands the script its own arguments only (process.argv: node, vite-node, then them); a test importing this
// file runs under vitest and runs nothing
const isMain = !process.env.VITEST && /vite-node(\.\w+)?$/.test(process.argv[1] || '');
if (isMain) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const outAt = args.indexOf('--out');
  const outDir = outAt >= 0 ? resolve(args[outAt + 1]) : join(HERE, '..', '..', 'review');
  const rest = args.filter((_, i) => outAt < 0 || (i !== outAt && i !== outAt + 1));
  const [topic, stairsArg] = rest;
  if (!topic) {
    console.error('usage: npm run review:sheet -- <topic> [stairs, e.g. 6-8] [--out <folder>]');
    console.error(`topics: ${Object.keys(TOPIC).join(', ')}`);
    process.exit(1);
  }
  try {
    const { html, stairs } = await reviewSheet(topic, { stairs: parseStairs(stairsArg) });
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `${topic}.html`);
    writeFileSync(file, html);
    console.log(`review sheet: ${file} (${stairs.join(', ')}; ${ITEMS} exercises a stair)`);
  } catch (e) {
    console.error(`review sheet: ${e.message}`);
    process.exit(1);
  }
}
