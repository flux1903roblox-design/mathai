#!/usr/bin/env node
// Motion follows the owner's ux-motion rules (.claude/skills/ux-motion/SKILL.md), checked in every stylesheet under
// src/styles. Each rule names its principle:
//   8  snappy timing: a transition's duration is a motion token (tokens.css --duration-*), never a number typed in place;
//      an animation's own number is allowed only for a listed one-time moment, a loop or a pace set in code (ALLOW)
//   5  slow in, slow out: no linear transition; linear only for an endless loop (a spinner, a shimmer, turning rays)
//   17 interruptible motion: nothing the user can reverse (a sheet, its backdrop, a dialog, a menu, a switch, a fold or
//      its chevron, a tab) moves by @keyframes, which restart from the start; transitions retarget from where they are
//   18 fast closing: a thing that animates its opening ([data-starting-style]) closes faster, in at most 150ms, ease-in
//   20 reduced motion: tokens.css stops every animation and transition, and each stylesheet that moves something with
//      @keyframes names it again in its own prefers-reduced-motion block
//   12 Fitts: the small buttons listed in TARGETS reach 44px with an invisible ::after around them
//   1, 8 one press: whatever moves while pressed (:active) moves in a press token (--duration-tap, --duration-press or
//      --duration-squash), set on the thing itself; a squash (scale) is a --squash token, the full one only on things
//      that carry no text (a stop, the gift, a switch's knob), and reduced motion sets every --squash token to none
// An ALLOW or TARGETS entry nothing uses any more fails too. Run: npm run lint:motion (motion.test.js runs it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STYLES = path.resolve(here, '../src/styles');

/** [file, selector, reason]: an animation (or, paced by code, a transition) with a duration of its own. */
export const ALLOW = [
  // one-time moments (more than 500ms is fine for a moment that happens once: principle 8)
  ['canon.css', '.node-unlock', 'once: the padlock lifts off the stop just reached'],
  ['lazy/celebrate.css', '.celebrate-rays', 'once: the light opens behind מדי, then turns slowly (an endless loop)'],
  ['lazy/celebrate.css', '.xp-landed .xp-count-n', 'once: the XP number pops as the count lands'],
  ['lazy/celebrate.css', '.xp-sparks i', 'once: the sparks round the XP number'],
  ['lazy/unlock.css', '.done-hero > .unlock-rays', 'once: the light opens behind a new piece for מדי, then turns'],
  // endless ambient loops on the map (their reduced-motion rule stops them)
  ['app.css', '.node-mastered::after', 'a loop: the glint that crosses a mastered stop now and then'],
  ['app.css', '.node-halo', 'a loop: the halo the current stop breathes'],
  ['app.css', '.streak-big svg', 'a loop: the streak flame'],
  // paced by code: a batch of 10 shows each trial for 120ms (components/manip/Simulate.jsx)
  ['lazy/data.css', '.mp-sim-face.tumble', 'paced to the simulation\'s 120ms trial'],
  ['lazy/data.css', '.mp-sim-coin.flip', 'paced to the simulation\'s 120ms trial'],
  ['lazy/data.css', '.mp-sim-pointer', 'paced to the simulation\'s 120ms trial (the pointer reaches each trial before the next)'],
];

/** UI a person can open and close again, or switch back: never moved by @keyframes (principle 17). */
export const REVERSIBLE = /sheet|backdrop|dialog|drawer|popover|menu|tooltip|switch|toggle|chev|fold|accordion|disclosure|details|summary|\[open\]|\.tab\b|\.seg\b/;

/**
 * [file, selector, drawn height, drawn width or null for a full-width row]: a small button whose hit area is padded to
 * 44px by an invisible ::after (principle 12).
 */
export const TARGETS = [
  ['app.css', '.lesson-top .tool', 40, 40], // the lesson's help buttons beside the progress bar (up to five on a 320 phone)
  ['app.css', 'details.sol summary', 32, null], // "רמז" and "פתרון ותשובה" under each exercise the tutor made
  ['lazy/lesson.css', '.hint-more', 24, 24], // "עוד" / "פחות" in the lesson's hint (24px tall beside it, .hint-side)
];

/** The durations a press may take (principles 1, 8, 20): a key, a button sinking onto its lip, a tile squashing. */
export const PRESS = ['--duration-tap', '--duration-press', '--duration-squash'];
/** What may take the full squash: pressable things with no text on them (principle 1: never squash text or numbers). */
export const SQUASH_FULL = /\.node\b|\.chest\b|role="switch"/;

const NEED = 44;
const CLOSE_MAX = 150; // ms: principle 18, close in 100 to 150ms

// blank out /* comments */, keeping the length so positions and line numbers stay true
const blankComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/** Every stylesheet under src/styles (the screens' own sheets in lazy/ included). */
export function styleFiles(dir = STYLES) {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.css')) out.push(p); } };
  walk(dir);
  return out.sort();
}

/** The [start, end) of every block whose prelude matches `head` (an @media or @keyframes), by brace counting. */
function blocks(code, head) {
  const out = [];
  for (const m of code.matchAll(head)) {
    const open = code.indexOf('{', m.index);
    let depth = 0; let i = open;
    for (; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') { depth -= 1; if (depth === 0) break; }
    }
    out.push([m.index, i + 1, m[1]]);
  }
  return out;
}

/** Split a value at its top-level commas (not those inside var(), calc() or cubic-bezier()). */
function items(value) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// a var() with its fallback (one level of nesting), so a number inside a fallback is not "typed in place"
const VARS = /var\((?:[^()]|\([^()]*\))*\)/g;
const TIME = /(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g;
const ms = (n, unit) => (unit === 's' ? Number(n) * 1000 : Number(n));
/** The times written as numbers in a value, outside var(). */
const literalTimes = (value) => [...value.replace(VARS, ' ').matchAll(TIME)].map((m) => ms(m[1], m[2]));

/** The motion tokens of tokens.css in ms: { '--duration-quick': 150, … }. */
export function tokenTimes(root = STYLES) {
  const css = fs.readFileSync(path.join(root, 'tokens.css'), 'utf8');
  return Object.fromEntries([...css.matchAll(/(--[\w-]+)\s*:\s*(\d*\.?\d+)(ms|s)\s*;/g)].map((m) => [m[1], ms(m[2], m[3])]));
}
/** The durations in a transition value, in ms, tokens resolved: [first time of each item]. */
function durations(value, tokens) {
  return items(value).map((it) => {
    const v = it.match(/var\((--[\w-]+)(?:,[^)]*)?\)|(\d*\.?\d+)(ms|s)\b/);
    if (!v) return null;
    return v[1] ? tokens[v[1]] ?? null : ms(v[2], v[3]);
  }).filter((x) => x != null);
}

/** Every rule in the stylesheets: { file, line, selector, body, inReduced }. Keyframe steps are left out. */
export function rules(files = styleFiles(), root = STYLES) {
  const out = [];
  for (const abs of files) {
    const file = path.relative(root, abs).split(path.sep).join('/');
    const code = blankComments(fs.readFileSync(abs, 'utf8'));
    const lineAt = (i) => code.slice(0, i).split('\n').length;
    const keyframes = blocks(code, /@keyframes\s+([\w-]+)/g);
    const reduced = blocks(code, /@media[^{]*prefers-reduced-motion:\s*reduce()[^{]*/g);
    for (const b of code.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const at = b.index + b[1].length;
      if (keyframes.some(([s, e]) => at > s && at < e)) continue;
      let sel = b[1]; if (sel.includes(';')) sel = sel.slice(sel.lastIndexOf(';') + 1);
      sel = sel.trim().replace(/\s+/g, ' ');
      if (!sel || sel.startsWith('@')) continue;
      out.push({ file, line: lineAt(at), selector: sel, body: b[2], inReduced: reduced.some(([s, e]) => at > s && at < e) });
    }
  }
  return out;
}

/** The @keyframes that move something (transform, translate, rotate, scale), by name, from every stylesheet. */
function movingKeyframes(files, root) {
  const names = new Set();
  for (const abs of files) {
    const code = blankComments(fs.readFileSync(abs, 'utf8'));
    for (const [s, e, name] of blocks(code, /@keyframes\s+([\w-]+)/g)) if (/\b(transform|translate|rotate|scale)\s*:/.test(code.slice(s, e))) names.add(name);
  }
  return names;
}

const decls = (body) => [...body.matchAll(/(?<![-\w])([\w-]+)\s*:\s*([^;]+)/g)].map((d) => ({ prop: d[1], value: d[2].trim() }));

/**
 * Every place the stylesheets break a rule: [{ rule, file, line, selector, text }], and the ALLOW and TARGETS entries
 * nothing matched (stale).
 */
export function findMotionProblems(files = styleFiles(), root = STYLES, { allow = ALLOW, targets = TARGETS } = {}) {
  const bad = []; const used = new Set(); const usedT = new Set();
  const all = rules(files, root);
  const tokens = tokenTimes(root);
  const moving = movingKeyframes(files, root);
  const push = (rule, r, text) => bad.push({ rule, file: r.file, line: r.line, selector: r.selector, text });
  const allowed = (r) => { const i = allow.findIndex(([f, s]) => f === r.file && s === r.selector); if (i >= 0) used.add(i); return i >= 0; };

  for (const r of all) {
    for (const { prop, value } of decls(r.body)) {
      const isTransition = prop === 'transition' || prop === 'transition-duration';
      const isAnimation = prop === 'animation' || prop === 'animation-duration';
      if (r.inReduced || /^none\b/.test(value)) continue;
      // 8: a transition's duration is a token; an animation's own number is a listed moment, loop or pace
      if (isTransition && literalTimes(value).length && !allowed(r)) push(8, r, `${prop}: ${value}`);
      if (isAnimation && literalTimes(value).length && !allowed(r)) push(8, r, `${prop}: ${value}`);
      // 5: linear only for an endless loop
      if ((isTransition || prop === 'transition-timing-function') && /\blinear\b/.test(value)) push(5, r, `${prop}: ${value}`);
      if (prop === 'animation') for (const it of items(value)) if (/\blinear\b/.test(it) && !/\binfinite\b/.test(it)) push(5, r, `animation: ${it}`);
      // 17: nothing reversible moves by keyframes
      if (prop === 'animation' && REVERSIBLE.test(r.selector)) push(17, r, `animation: ${value}`);
    }
  }

  // 18: what animates its opening closes faster, ease-in, in at most 150ms
  const startOf = new Set(all.flatMap((r) => r.selector.split(',').map((s) => s.trim()).filter((s) => s.endsWith('[data-starting-style]')).map((s) => s.slice(0, -'[data-starting-style]'.length))));
  for (const el of startOf) {
    const base = all.filter((r) => r.selector.split(',').map((s) => s.trim()).includes(el));
    const open = Math.max(0, ...base.flatMap((r) => decls(r.body).filter((d) => d.prop === 'transition').flatMap((d) => durations(d.value, tokens))));
    if (!open) continue;
    const end = all.filter((r) => r.selector.split(',').map((s) => s.trim()).includes(`${el}[data-ending-style]`));
    const d = end.flatMap((r) => decls(r.body)).filter((x) => x.prop === 'transition-duration').map((x) => durations(x.value, tokens)[0]);
    const ease = end.flatMap((r) => decls(r.body)).filter((x) => x.prop === 'transition-timing-function').map((x) => x.value);
    const at = end[0] || base[0];
    const close = d.at(-1);
    if (close == null) push(18, at, `${el} closes as slowly as it opens (${open}ms): give ${el}[data-ending-style] a transition-duration`);
    else if (close > CLOSE_MAX || close >= open) push(18, at, `${el} closes in ${close}ms (opens in ${open}ms)`);
    if (!ease.some((e) => /--ease-in\b/.test(e))) push(18, at, `${el} closes without ease-in`);
  }

  // 20: reduced motion everywhere
  const global = all.find((r) => r.file === 'tokens.css' && r.inReduced && r.selector.startsWith('*'));
  if (!global || !/animation-duration:\s*0\.01ms/.test(global.body) || !/transition-duration:\s*0\.01ms/.test(global.body)) {
    bad.push({ rule: 20, file: 'tokens.css', line: 1, selector: '*', text: 'no global prefers-reduced-motion rule that stops animations and transitions' });
  }
  // a reduced-motion rule covers a selector it names, or one that carries its last class (.answer covers .answer.is-shaking)
  const lastClass = (sel) => (sel.match(/\.[\w-]+(?![\s\S]*\.[\w-])/) || [sel])[0];
  const hasClass = (sel, cls) => new RegExp(`${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(sel);
  const covers = (q, sel) => q === sel || hasClass(q, lastClass(sel)) || hasClass(sel, lastClass(q));
  for (const r of all) {
    if (r.inReduced) continue;
    for (const { prop, value } of decls(r.body)) {
      if (prop !== 'animation' || /^none\b/.test(value)) continue;
      const names = items(value).map((it) => it.split(/\s+/).find((w) => moving.has(w))).filter(Boolean);
      if (!names.length) continue;
      // each selector of the rule is named (or its last class is) in a reduced-motion rule of the same file
      for (const sel of r.selector.split(',').map((s) => s.trim())) {
        const stopped = all.some((q) => q.file === r.file && q.inReduced && /animation\s*:\s*none/.test(q.body)
          && q.selector.split(',').map((s) => s.trim()).some((s) => covers(s, sel)));
        if (!stopped) push(20, { ...r, selector: sel }, `animation: ${value} has no prefers-reduced-motion rule in ${r.file}`);
      }
    }
  }

  // 12: the listed small buttons reach 44px
  for (const [i, [file, sel, h, w]] of targets.entries()) {
    const pad = all.filter((r) => r.file === file && !r.inReduced && r.selector.split(',').map((s) => s.trim()).includes(`${sel}::after`));
    if (!all.some((r) => r.file === file && r.selector.split(',').map((s) => s.trim()).includes(sel))) continue; // stale
    usedT.add(i);
    const inset = pad.flatMap((r) => decls(r.body)).filter((d) => d.prop === 'inset').map((d) => d.value.split(/\s+/).map((v) => -parseFloat(v)));
    const ok = inset.some((v) => {
      const [t, x = t, b = t, l = x] = v;
      return h + t + b >= NEED && (w == null || w + x + l >= NEED);
    }) && pad.some((r) => /content\s*:/.test(r.body) && /position\s*:\s*absolute/.test(r.body));
    if (!ok) bad.push({ rule: 12, file, line: (all.find((r) => r.file === file && r.selector.includes(sel)) || {}).line || 1, selector: sel, text: `a ${h}px button with no ${NEED}px hit area (${sel}::after)` });
  }

  // 1, 8: one press. What an :active rule moves has a transition in a press token on the thing itself (the rule's
  // selector without :active and :not(), or one that ends with it); a squash is a --squash token
  const plain = (sel) => sel.replace(/:active/g, '').replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '').trim();
  const moves = (prop) => prop === 'transform' || prop === 'scale' || prop === 'translate';
  const pressTimed = (body, prop) => decls(body).some((d) => (d.prop === 'transition' && items(d.value).some((it) => new RegExp(`^(${prop}|all)\\b`).test(it) && PRESS.some((t) => it.includes(`var(${t})`))))
    || (d.prop === 'transition-duration' && PRESS.some((t) => d.value.includes(`var(${t})`))));
  for (const r of all) {
    if (r.inReduced || !r.selector.includes(':active')) continue;
    for (const { prop, value } of decls(r.body)) {
      if (!moves(prop) || /^none\b/.test(value)) continue;
      for (const sel of r.selector.split(',').map((x) => x.trim()).filter((x) => x.includes(':active'))) {
        const base = plain(sel);
        const timed = all.some((q) => !q.inReduced && !q.selector.includes(':active') && q.selector.split(',').map((x) => x.trim()).some((x) => x === base || x.endsWith(` ${base}`) || (x.startsWith('.') && base.endsWith(` ${x}`)))
          && (pressTimed(q.body, prop) || (prop === 'scale' && pressTimed(q.body, 'transform') && pressTimed(q.body, 'scale'))));
        if (!timed) push(8, { ...r, selector: sel }, `${prop}: ${value} while pressed, with no transition in ${PRESS.join(' / ')} on ${base}`);
        if (prop === 'scale' && !/^var\(--squash(-soft|-knob)?\)$/.test(value)) push(1, { ...r, selector: sel }, `scale: ${value}: a press squashes by a --squash token`);
        if (prop === 'scale' && /--squash\)/.test(value) && !SQUASH_FULL.test(sel)) push(1, { ...r, selector: sel }, `the full squash on ${sel}, which carries text: use --squash-soft`);
        if (prop === 'transform' && /scale/.test(value)) push(1, { ...r, selector: sel }, `transform: ${value}: a press sinks (translate) and squashes by a --squash token, never a scale of its own`);
      }
    }
  }
  const tok = all.filter((r) => r.file === 'tokens.css' && r.inReduced && r.selector === ':root').flatMap((r) => decls(r.body));
  for (const name of ['--squash', '--squash-soft', '--squash-knob']) {
    if (!tok.some((d) => d.prop === name && d.value === 'none')) bad.push({ rule: 20, file: 'tokens.css', line: 1, selector: ':root', text: `${name} is not none under reduced motion` });
  }

  const stale = [
    ...allow.filter((_, i) => !used.has(i)).map(([f, s]) => `ALLOW ${f} ${s}`),
    ...targets.filter((_, i) => !usedT.has(i)).map(([f, s]) => `TARGETS ${f} ${s}`),
  ];
  return { bad, stale };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { bad, stale } = findMotionProblems();
  for (const b of bad) console.error(`#${b.rule} ${b.file}:${b.line}  ${b.selector}  ${b.text}`);
  for (const s of stale) console.error(`list entry with nothing to allow: ${s}`);
  if (bad.length || stale.length) {
    console.error('\nSee .claude/skills/ux-motion/SKILL.md (the number before each line is the principle). An exception goes in ALLOW in scripts/check-motion.mjs, with its reason.');
    process.exit(1);
  }
  console.log(`motion: tokens, easing, closing, reduced motion and hit areas hold (${styleFiles().length} stylesheets, ${ALLOW.length} listed exceptions)`);
}
