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
