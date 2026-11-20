// After a wrong first try the old answer stays in the box, struck out, and the next keys start a new answer.
// What did the student mean? Keys typed before, after or inside the old answer are the start of the new one;
// a delete clears it; a paste or a replaced selection is the new answer itself.
export function afterStrike(old, typed) {
  const o = String(old ?? '');
  const t = String(typed ?? '');
  if (!o) return t;
  // the part both share at the start and at the end
  let p = 0;
  while (p < o.length && p < t.length && o[p] === t[p]) p += 1;
  let s = 0;
  while (s < o.length - p && s < t.length - p && o[o.length - 1 - s] === t[t.length - 1 - s]) s += 1;
  if (t.length > o.length && p + s === o.length) return t.slice(p, t.length - s);
  if (t.length < o.length && p + s === t.length) return '';
  return t;
}
