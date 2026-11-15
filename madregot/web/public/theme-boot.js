// Before the first paint (index.html loads this before the app): an explicit choice of light or dark is applied at
// once, so the app never flashes the other theme. The key is the app's store key (a meta tag filled at build time)
// plus "-theme"; lib/theme.js writes it.
try {
  var m = document.querySelector('meta[name="madregot-store-key"]');
  var k = m && m.content;
  if (!k || k.charAt(0) === '%') k = 'madregot';
  var t = localStorage.getItem(k + '-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage blocked: follow the phone */ }
// Arabic (stored or ?lang=ar), only in a build made with VITE_ARABIC=on (lib/i18n.js): else the page stays Hebrew.
try {
  var a = document.querySelector('meta[name="madregot-arabic"]');
  var l = a && a.content === 'on' && ((/[?&]lang=(he|ar)\b/.exec(location.search) || [])[1] || localStorage.getItem(k + '-locale'));
  if (l === 'ar') document.documentElement.lang = l;
} catch (e) { /* Hebrew */ }
