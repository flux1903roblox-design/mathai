// A lesson opened straight from a link (a bookmark, a teacher's link, a reload of the first page) would be the
// first page in the browser's history, so Back would leave the app with no question asked. Before the router
// starts, put the map underneath it: Back then returns to the map, and the lesson asks first.
// It runs only when the lesson is the first page of this visit (the router numbers its pages with idx).
try {
  const { hash } = window.location;
  const first = !(window.history.state && window.history.state.idx > 0);
  if (first && /^#\/(lesson|practice|placement)(\/|\?|$)/.test(hash)) {
    window.history.replaceState({ usr: null, key: 'map', idx: 0 }, '', '#/');
    window.history.pushState({ usr: null, key: 'start', idx: 1 }, '', hash);
  }
} catch { /* history not available: the app works as before */ }
