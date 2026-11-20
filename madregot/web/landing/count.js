// Reach counts for the landing pages (STUDENT-13, STUDENT-14): one name when the page is seen (landing_view_<page>) and
// one when a way into the app is pressed (landing_cta_<page>), by navigator.sendBeacon, with nothing else: no cookie,
// no id, no address. <page> is <html data-page>. A is the Worker's address, filled in by scripts/landing-build.mjs:
// '' when the Worker serves these pages, the Worker's https address for a copy on another host, 'none' for a copy
// with no server (then nothing is sent). landing-build drops these comment lines (dist/l/count.js stays under 400 B).
(function () {
  var A = "{{API_BASE}}", p = document.documentElement.getAttribute('data-page');
  if (A === 'none' || !p || !navigator.sendBeacon) return;
  function c(n) { try { navigator.sendBeacon(A + '/api/metrics', n); } catch (e) { /* never in the way */ } }
  c('landing_view_' + p);
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-cta]')) c('landing_cta_' + p);
  });
})();
