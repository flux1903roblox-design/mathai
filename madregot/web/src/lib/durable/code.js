// The restore code (DURABLE-5): 16 symbols from the class-code alphabet (no 0/O, 1/I/L), 15 random ones (31^15, about
// 2^74) and a check symbol, shown as ABCD-EFGH-JKMN-PQRS (left to right, in mono). The check symbol is
// Σ (i+1)·v_i mod 31 over the 15 random symbols; 31 is prime, so it catches every single wrong symbol and every swap of
// two neighbours, the check symbol included. A typing mistake is found here, before any network call.
// normalise() takes what a person types or pastes: any letter case, spaces, dashes, direction and zero-width marks, and
// the Hebrew keyboard layout (SI-1452), so a child who types the code with the Hebrew keyboard still gets it right.

/** The class-code alphabet, the same 31 symbols as worker/src/util.js (code.test.js pins them equal). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 16;
const BODY = CODE_LENGTH - 1;
const N = CODE_ALPHABET.length;

/**
 * The Hebrew keyboard (SI-1452) letter on each Latin key, checked letter by letter against the standard layout. The
 * final forms ן ך ם sit on I, L and O, which are not in the alphabet, so they fail the check with the "bad characters"
 * message. ׳ (geresh) and ’ come from the W key on some phone keyboards.
 */
export const HEBREW_KEYS = {
  ש: 'A', נ: 'B', ב: 'C', ג: 'D', ק: 'E', כ: 'F', ע: 'G', י: 'H', ן: 'I', ח: 'J', ל: 'K', ך: 'L', צ: 'M', מ: 'N', ם: 'O',
  פ: 'P', '/': 'Q', ר: 'R', ד: 'S', א: 'T', ו: 'U', ה: 'V', "'": 'W', '׳': 'W', '’': 'W', ס: 'X', ט: 'Y', ז: 'Z',
};
// spaces, dashes (the Hebrew maqaf and the Unicode dashes too), direction marks and zero-width characters
const DROP = /[\s\-־‐-―−​-‏‪-‮⁦-⁩﻿]/g;

const valueOf = (ch) => CODE_ALPHABET.indexOf(ch);

/** The check symbol for the first 15 symbols. */
export function checkSymbol(body) {
  let sum = 0;
  for (let i = 0; i < BODY; i += 1) sum += (i + 1) * valueOf(body[i]);
  return CODE_ALPHABET[sum % N];
}

/** A new restore code: 15 symbols drawn uniformly (rejection sampling, no modulo bias) and its check symbol. */
export function makeCode(random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const cap = 256 - (256 % N);
  let body = '';
  while (body.length < BODY) {
    for (const b of random(BODY * 2)) if (b < cap && body.length < BODY) body += CODE_ALPHABET[b % N];
  }
  return body + checkSymbol(body);
}

/** ABCD-EFGH-JKMN-PQRS (show it with dir="ltr"). */
export const formatCode = (code) => String(code || '').match(/.{1,4}/g)?.join('-') || '';

/**
 * What a person typed, as a code: `{ ok: true, code }`, or `{ ok: false, reason }` with reason 'empty', 'chars' (a
 * symbol that is not in the code's alphabet) or 'typo' (the length or the check symbol is wrong).
 */
export function normalise(input) {
  const raw = String(input ?? '').replace(DROP, '');
  if (!raw) return { ok: false, reason: 'empty' };
  const code = [...raw].map((ch) => HEBREW_KEYS[ch] || ch.toUpperCase()).join('');
  if (![...code].every((ch) => CODE_ALPHABET.includes(ch))) return { ok: false, reason: 'chars' };
  if (code.length !== CODE_LENGTH || checkSymbol(code) !== code[BODY]) return { ok: false, reason: 'typo' };
  return { ok: true, code };
}

/** A stored code is sound: 16 symbols of the alphabet with the right check symbol. */
export const isCode = (code) => typeof code === 'string' && normalise(code).ok && normalise(code).code === code;
