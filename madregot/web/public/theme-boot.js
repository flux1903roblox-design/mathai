// Before the first paint (index.html loads this before the app): an explicit choice of "בהיר" or "כהה" is applied at
// once, so the app never flashes the other theme. "כמו במכשיר" stores nothing and leaves the CSS to follow the phone.
// The key is the app's store key (VITE_STORE_KEY, filled into a meta tag at build time) plus "-theme"; lib/theme.js writes it.
try {
  var m = document.querySelector('meta[name="madregot-store-key"]');
  var k = m && m.content;
  if (!k || k.charAt(0) === '%') k = 'madregot';
  var t = localStorage.getItem(k + '-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage blocked: follow the phone */ }
