/** Copy text: the clipboard where the browser allows it, else the older way. Resolves true when it was copied. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* try the older way */ }
  try {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch { return false; }
}

/**
 * Copy text that is not known yet (it comes from the server): Safari allows a copy only inside the tap, so the
 * clipboard is given a promise of the text right away, where the browser takes one (ClipboardItem); elsewhere the
 * text is copied once it is there. Resolves true when it was copied; a failure to make the text rejects as it did.
 */
export async function copyWhenReady(textPromise) {
  const text = Promise.resolve(textPromise);
  let pending = null;
  try {
    if (typeof ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function') {
      pending = navigator.clipboard.write([new ClipboardItem({ 'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })) })]);
      pending.catch(() => {}); // a refusal is handled below (or the text failed, which the caller hears about)
    }
  } catch { pending = null; }
  const value = await text;
  if (pending) {
    try { await pending; return true; } catch { /* try the plain way */ }
  }
  return copyText(value);
}
