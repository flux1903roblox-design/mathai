// Generates src/styles/dark.gen.css: the black screens of the "Electric Premium" theme, from the light stylesheets.
// Run after changing app.css, motion.css or v4.css:   node scripts/theme-dark.cjs
//
// Every colour declaration of every rule (in source order, so the cascade is the same) is repeated under
// [data-theme="dark"], with each literal colour turned for a black page by its role:
//   backgrounds: white -> black (lightness inverted), tints -> dark tints, vivid fills stay;
//   text: dark ink -> white or light grey, white text on a fill stays white, coloured ink -> its light version;
//   lines and solid lips: light greys -> mid greys, light tints -> dark tints;
//   the electric-blue family: fills stay #0066FF, text becomes the glowing #00C8FF, tints become navy.
// Tokens are not generated: [data-theme="dark"] in theme-dark.css redefines them, with the few hand decisions.
const fs = require('fs'); const path = require('path');
const postcss = require(path.resolve(__dirname, '../node_modules/postcss'));
const SRC = ['app.css', 'motion.css', 'v4.css'].map((f) => path.resolve(__dirname, '../src/styles', f));
const OUT = path.resolve(__dirname, '../src/styles/dark.gen.css');
const SCOPE = '[data-theme="dark"]';
const ELECTRIC = [0, 102, 255]; const GLOW = [0, 200, 255];

const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function parse(s) {
  s = s.trim().toLowerCase();
  if (s === 'white') return [255, 255, 255, 1]; if (s === 'black') return [0, 0, 0, 1];
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) { let h = m[1]; if (h.length <= 4) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1]; }
  m = s.match(/^rgba?\(([^)]*)\)$/);
  if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  return null;
}
function hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function rgb(h, s, l) { const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0) * 255, f(8) * 255, f(4) * 255]; }
const out = (c, a) => (a < 1 ? `rgba(${c.map(Math.round).join(', ')}, ${+a.toFixed(3)})` : hex(...c));
const grey = (l) => [l * 255, l * 255, l * 255];

function convert(lit, role) {
  const c = parse(lit); if (!c) return lit;
  const [h, s, l] = hsl(c); const a = c[3];
  const neutral = s < 0.14;
  const blue = !neutral && h >= 180 && h < 340;
  if (neutral) {
    if (role === 'text') return l > 0.85 ? lit : out(grey(l < 0.3 ? 1 : 1 - l), a);
    if (role === 'line') return out(l < 0.2 ? grey(1) : grey(Math.min(0.45, 0.14 + (1 - l) * 1.6)), a);
    if (role === 'shadow') return lit;
    return out(grey(1 - l), a);
  }
  if (blue) {
    if (role === 'text') return out(l > 0.85 ? grey(1) : GLOW, a);
    if (role === 'line') return out(l > 0.85 ? [0, 38, 92] : l > 0.6 ? [0, 82, 204] : [0, 71, 179], a);
    if (role === 'shadow') return out([0, 71, 179], a);
    return out(l > 0.88 ? [0, 20, 51] : l > 0.72 ? [0, 42, 102] : ELECTRIC, a);
  }
  if (role === 'text') return out(l < 0.5 ? rgb(h, Math.min(1, s), 0.68) : l > 0.85 ? c.slice(0, 3) : c.slice(0, 3), a);
  if (role === 'line') return out(l > 0.8 ? rgb(h, s * 0.55, 0.24) : c.slice(0, 3), a);
  if (role === 'shadow') return out(l > 0.8 ? rgb(h, s * 0.55, 0.2) : c.slice(0, 3), a);
  return out(l > 0.86 ? rgb(h, s * 0.6, 0.1) : l > 0.72 ? rgb(h, s * 0.55, 0.2) : c.slice(0, 3), a);
}
const COLOR_PROP = /^(color|background|background-color|background-image|border|border-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end)(-color)?|border-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|stop-color|caret-color|text-decoration|text-decoration-color|accent-color|column-rule|column-rule-color|-webkit-text-fill-color|scrollbar-color|filter)$/;
const LIT = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/g;
function roleOf(prop) {
  prop = prop.toLowerCase();
  if (prop.startsWith('--')) { if (/ink|-on\b|-on$|text|fg/.test(prop) && !/bg|tint/.test(prop)) return 'text'; if (/line|lip|edge|rule|border|stroke/.test(prop)) return 'line'; if (/shadow/.test(prop)) return 'shadow'; return 'bg'; }
  if (/^(color|caret-color|-webkit-text-fill-color|text-decoration-color|accent-color|text-decoration)$/.test(prop)) return 'text';
  if (/border|outline|column-rule|^stroke$/.test(prop)) return 'line';
  if (/shadow|filter/.test(prop)) return 'shadow';
  return 'bg';
}
const scopeSel = (sel) => (/^:root\b/.test(sel) ? null : /^html\b/.test(sel) ? sel.replace(/^html/, `html${SCOPE}`) : `${SCOPE} ${sel}`);

const res = postcss.root();
let decls = 0, rules = 0;
for (const f of SRC) {
  const root = postcss.parse(fs.readFileSync(f, 'utf8'), { from: f });
  root.walkRules((r) => {
    if (r.parent.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
    const sels = r.selectors.map(scopeSel).filter(Boolean); if (!sels.length) return;
    const keep = [];
    r.each((d) => {
      if (d.type !== 'decl') return;
      const custom = d.prop.startsWith('--');
      const hasColour = LIT.test(d.value) || /var\(--|color-mix|currentcolor|transparent/i.test(d.value); LIT.lastIndex = 0;
      if (!(COLOR_PROP.test(d.prop) || (custom && hasColour))) return;
      if (!hasColour && !COLOR_PROP.test(d.prop)) return;
      const lipLike = roleOf(d.prop) === 'shadow' && /^(inset\s+)?0\s+-?\d+px\s+0\s/.test(d.value.trim());
      let value = d.value.replace(LIT, (lit) => convert(lit, lipLike ? 'line' : roleOf(d.prop)));
      // electric blue is a fill (buttons, actions); as text on black it is too dark (4.3:1), so text glows instead
      if (roleOf(d.prop) === 'text') value = value.replace(/var\(--(brand|cyan|p-400|p-500|p-600)\)/g, 'var(--glow)');
      keep.push(d.clone({ value }));
    });
    if (!keep.length) return;
    const nr = postcss.rule({ selectors: sels }); keep.forEach((d) => nr.append(d)); decls += keep.length; rules++;
    // rebuild the at-rule chain (media / supports) around the rule
    let node = nr; let p = r.parent;
    while (p && p.type === 'atrule') { const at = postcss.atRule({ name: p.name, params: p.params }); at.append(node); node = at; p = p.parent; }
    res.append(node);
  });
}
const header = '/* GENERATED by scripts/theme-dark.cjs from app.css, motion.css and v4.css. Do not edit by hand: change the light\n   stylesheets (or theme-dark.css for tokens and the hand decisions) and run  node scripts/theme-dark.cjs  again. */\n';
fs.writeFileSync(OUT, header + res.toString().replace(/\n{3,}/g, '\n\n') + '\n');
console.log(`dark.gen.css: ${rules} rules, ${decls} colour declarations`);
