// The waitlist page's form (/waitlist/ and /w/, worker/src/waitlist.js). Without this script the form still posts as a
// plain form to the Worker, which sends the page back at #joined, #oops or #closed. With it: the fields are checked here
// first (each error under its field, tied to it, and the focus on the first one), the signup goes as JSON to the address
// in the form's data-api ('' = the Worker that serves this page, 'none' = a copy with no server), the utm_source and
// utm_campaign of the page's address go with it, and the thank-you takes the form's place with a way to share the page
// (the phone's share sheet, else the link copied, else the link to copy by hand). Nothing is kept on the device.
// landing-build drops these comment lines and copies the rest to dist/l/waitlist.js.
(function () {
  'use strict';
  var form = document.getElementById('wl-form');
  if (!form || !window.fetch) return;
  var card = document.getElementById('join');
  var done = document.getElementById('joined');
  var status = document.getElementById('wl-status');
  var submit = form.querySelector('.wl-submit');
  var api = form.getAttribute('data-api') || '';
  var MSG = {
    emailEmpty: 'כתבו כתובת מייל.',
    emailBad: 'זו לא נראית כמו כתובת מייל. בדקו שיש בה @ ונקודה.',
    role: 'בחרו מי אתם: הורה, תלמיד/ה או מורה.',
    consent: 'כדי שנוכל לשלוח את המייל, סמנו את התיבה.',
    busy: 'שולחים…',
    net: 'לא הצלחנו לשלוח. בדקו את החיבור לאינטרנט ונסו שוב.',
    tooMany: 'היום כבר נשלחו מכאן הרבה הרשמות. נסו שוב מאוחר יותר.',
    server: 'משהו השתבש אצלנו. נסו שוב בעוד כמה דקות.',
    none: 'מהעותק הזה של האתר אי אפשר להצטרף לרשימה.',
    copied: 'הקישור הועתק. אפשר להדביק אותו בוואטסאפ או בהודעה.',
    copyHand: 'העתיקו את הקישור מכאן:'
  };
  form.noValidate = true;

  // the ad's labels from the page's address, into the form (also for a plain post)
  var q = new URLSearchParams(location.search);
  ['utm_source', 'utm_campaign'].forEach(function (k) { if (form.elements[k]) form.elements[k].value = (q.get(k) || '').slice(0, 60); });

  function field(name) { return form.elements[name]; }
  function errBox(id) { return document.getElementById(id); }
  function showErr(id, target, text) {
    var box = errBox(id);
    box.textContent = text; box.hidden = !text;
    if (target) { if (text) target.setAttribute('aria-invalid', 'true'); else target.removeAttribute('aria-invalid'); }
  }
  var emailInput = field('email');
  var roleSet = document.getElementById('wl-role');
  var consentBox = field('consent');
  function checked(name) { return Array.prototype.filter.call(form.querySelectorAll('input[name="' + name + '"]'), function (i) { return i.checked; }).map(function (i) { return i.value; }); }

  function validate() {
    var email = emailInput.value.trim();
    var bad = [];
    var emailMsg = !email ? MSG.emailEmpty : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : MSG.emailBad;
    showErr('wl-email-err', emailInput, emailMsg); if (emailMsg) bad.push(emailInput);
    var roleMsg = checked('role').length ? '' : MSG.role;
    showErr('wl-role-err', roleSet, roleMsg); if (roleMsg) bad.push(form.querySelector('input[name="role"]'));
    var consentMsg = consentBox.checked ? '' : MSG.consent;
    showErr('wl-consent-err', consentBox, consentMsg); if (consentMsg) bad.push(consentBox);
    return bad;
  }
  // an error goes once its field is fixed (never a new error while typing). The email's goes while typing, not when the
  // field is left: its line going away on blur would move a chip from under the finger that just pressed it.
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'role' && !errBox('wl-role-err').hidden) showErr('wl-role-err', roleSet, '');
    if (t.name === 'consent' && t.checked && !errBox('wl-consent-err').hidden) showErr('wl-consent-err', consentBox, '');
  });
  emailInput.addEventListener('input', function () {
    if (!errBox('wl-email-err').hidden && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) showErr('wl-email-err', emailInput, '');
  });

  function say(text, error) { status.textContent = text || ''; status.classList.toggle('is-error', !!error); }
  function note(id, on) { var n = document.getElementById(id); if (n) n.classList.toggle('is-on', !!on); }
  function busy(on) { submit.disabled = on; if (on) submit.setAttribute('aria-busy', 'true'); else submit.removeAttribute('aria-busy'); }
  function url() { return api ? api + '/api/waitlist' : new URL('../api/waitlist', location.href).href; }

  function joined() {
    card.classList.add('is-joined');
    note('oops', false);
    done.focus();
    if (done.scrollIntoView) done.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    say(''); note('oops', false);
    var bad = validate();
    if (bad.length) { bad[0].focus(); return; }
    if (api === 'none') { say(MSG.none, true); return; }
    var phones = checked('platform');
    var body = {
      email: emailInput.value.trim(), role: checked('role')[0], grade: checked('grade')[0] || null,
      platform: phones.length === 2 ? 'both' : phones[0] || null, consent: true,
      utm_source: field('utm_source').value, utm_campaign: field('utm_campaign').value, website: field('website').value
    };
    busy(true); say(MSG.busy);
    fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
      if (r.ok) { say(''); joined(); return null; }
      return r.json().catch(function () { return {}; }).then(function (out) {
        var code = out && out.error;
        if (code === 'bad_email') { showErr('wl-email-err', emailInput, MSG.emailBad); emailInput.focus(); say(''); return; }
        if (code === 'bad_role') { showErr('wl-role-err', roleSet, MSG.role); say(''); return; }
        if (code === 'consent_needed') { showErr('wl-consent-err', consentBox, MSG.consent); consentBox.focus(); say(''); return; }
        if (r.status === 410) { say(''); note('closed', true); document.getElementById('closed').focus(); return; }
        say(r.status === 429 ? MSG.tooMany : MSG.server, true);
      });
    }).catch(function () { say(MSG.net, true); }).then(function () { busy(false); });
  });

  // sharing: the page's own address, marked so the owner sees how many came from a friend
  var share = done.querySelector('.wl-share');
  var shareStatus = document.getElementById('wl-share-status');
  var canon = document.querySelector('link[rel="canonical"]');
  var link = (canon ? canon.href : location.origin + location.pathname) + '?utm_source=share';
  share.hidden = false;
  share.addEventListener('click', function () {
    var text = 'מדרגות: תרגול מתמטיקה לכיתות ז׳–ח׳, בעברית. אפשר להצטרף לרשימה ולשמוע כשהאפליקציה בחנויות:';
    shareStatus.textContent = '';
    if (navigator.share) {
      navigator.share({ title: document.title, text: text, url: link }).catch(function () { /* closed, or the phone said no */ });
      return;
    }
    var byHand = function () {
      var box = done.querySelector('.wl-copy');
      var input = document.getElementById('wl-link');
      input.value = link; box.hidden = false;
      shareStatus.textContent = MSG.copyHand;
      input.focus(); input.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () { shareStatus.textContent = MSG.copied; }, byHand);
    } else byHand();
  });
})();
