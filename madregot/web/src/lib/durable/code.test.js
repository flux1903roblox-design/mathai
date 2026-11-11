// The restore code (DURABLE-5, code.js): the alphabet is the Worker's, every made code passes its check, every single
// wrong symbol and every swap of two neighbours fails it, and what a person types (any case, dashes, spaces, direction
// marks, the Hebrew keyboard) comes out right before any network call.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CODE_ALPHABET, CODE_LENGTH, HEBREW_KEYS, makeCode, checkSymbol, normalise, formatCode, isCode, findCode } from './code.js';
import { seeded } from './testing.js';

/** A generator of random bytes from a seed, as crypto.getRandomValues would give them. */
const bytesFrom = (rnd) => (n) => Uint8Array.from({ length: n }, () => Math.floor(rnd() * 256));

describe('the alphabet', () => {
  it('is the same 31 symbols as the Worker\'s class codes (worker/src/util.js)', () => {
    const util = readFileSync(new URL('../../../../worker/src/util.js', import.meta.url), 'utf8');
    expect(util.match(/export const CODE_ALPHABET = '([^']+)'/)?.[1]).toBe(CODE_ALPHABET);
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });
});

describe('making a code', () => {
  it('10,000 random codes: 16 symbols of the alphabet, and each passes the check', () => {
    const random = bytesFrom(seeded(11));
    const seen = new Set(); const bad = [];
    for (let i = 0; i < 10_000; i += 1) {
      const c = makeCode(random);
      const n = normalise(c);
      if (c.length !== CODE_LENGTH || !n.ok || n.code !== c) bad.push(c);
      seen.add(c);
    }
    expect(bad).toEqual([]);
    expect(seen.size).toBe(10_000);
  });

  it('every single wrong symbol in 500 codes fails the check (31 is prime)', () => {
    const random = bytesFrom(seeded(12));
    let tried = 0; const passed = [];
    for (let i = 0; i < 500; i += 1) {
      const c = makeCode(random);
      for (let p = 0; p < CODE_LENGTH; p += 1) {
        for (const ch of CODE_ALPHABET) {
          if (ch === c[p]) continue;
          const bad = c.slice(0, p) + ch + c.slice(p + 1);
          if (normalise(bad).reason !== 'typo') passed.push(bad);
          tried += 1;
        }
      }
    }
    expect(passed).toEqual([]);
    expect(tried).toBe(500 * 16 * 30);
  });

  it('every swap of two different neighbours fails the check, the check symbol included', () => {
    const random = bytesFrom(seeded(13));
    let tried = 0; const passed = [];
    for (let i = 0; i < 500; i += 1) {
      const c = makeCode(random);
      for (let p = 0; p < CODE_LENGTH - 1; p += 1) {
        if (c[p] === c[p + 1]) continue;
        const swapped = c.slice(0, p) + c[p + 1] + c[p] + c.slice(p + 2);
        if (normalise(swapped).ok) passed.push(swapped);
        tried += 1;
      }
    }
    expect(passed).toEqual([]);
    expect(tried).toBeGreaterThan(7000);
  });

  it('the check symbol is Σ (i+1)·v_i mod 31 over the first 15', () => {
    expect(checkSymbol('AAAAAAAAAAAAAAA')).toBe('A');
    expect(checkSymbol('BAAAAAAAAAAAAAA')).toBe('B'); // 1·1
    expect(checkSymbol('AAAAAAAAAAAAAAB')).toBe(CODE_ALPHABET[15]); // 15·1
    expect(checkSymbol('99999999999999'.padEnd(15, '9'))).toBe(CODE_ALPHABET[(120 * 30) % 31]);
  });
});

describe('what a person types', () => {
  const code = makeCode(bytesFrom(seeded(14)));
  const shown = formatCode(code);

  it('is shown in four groups of four', () => {
    expect(shown).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(shown.replace(/-/g, '')).toBe(code);
  });

  it('any letter case, dashes and spaces', () => {
    expect(normalise(shown)).toEqual({ ok: true, code });
    expect(normalise(` ${shown.toLowerCase().replace(/-/g, ' - ')} `)).toEqual({ ok: true, code });
    expect(normalise(shown.replace(/-/g, '–'))).toEqual({ ok: true, code }); // a dash a phone typed
    expect(normalise(shown.replace(/-/g, '־'))).toEqual({ ok: true, code }); // the Hebrew maqaf
  });

  it('direction and zero-width marks are dropped (a code pasted from a Hebrew message)', () => {
    const marked = `‏‫${shown.slice(0, 4)}‎-⁧${shown.slice(5)}⁩‬​﻿`;
    expect(normalise(marked)).toEqual({ ok: true, code });
  });

  it('the Hebrew keyboard: שנבג-… is ABCD-…, and every Latin key of the code types right', () => {
    const toHebrew = Object.fromEntries(Object.entries(HEBREW_KEYS).filter(([h]) => !['׳', '’'].includes(h)).map(([h, l]) => [l, h]));
    expect(normalise('שנבג').code).toBeUndefined(); // only four symbols: a typo, not a crash
    expect(normalise('שנבג')).toEqual({ ok: false, reason: 'typo' });
    const typed = [...shown].map((ch) => toHebrew[ch] || ch).join('');
    expect(typed).not.toMatch(/[A-Z]/); // every letter came from the Hebrew layout
    expect(normalise(typed)).toEqual({ ok: true, code });
    // the W key: ' on a computer, ׳ or ’ on some phone keyboards
    const withW = 'W'.repeat(15);
    const w = withW + checkSymbol(withW);
    for (const k of ["'", '׳', '’']) expect(normalise(k.repeat(15) + w[15]).code).toBe(w);
    expect(normalise('ABCD').reason).toBe('typo');
    const map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    expect([...'שנבגקכעיןחלךצמםפ/רדאוה\'סטז'].map((h) => HEBREW_KEYS[h]).join('')).toBe(map);
  });

  it('a symbol outside the alphabet is "chars"; the wrong length or check is "typo"; nothing typed is "empty"', () => {
    expect(normalise(code.slice(0, 15) + '0')).toEqual({ ok: false, reason: 'chars' });
    expect(normalise(code.replace(code[3], 'O'))).toEqual({ ok: false, reason: 'chars' });
    expect(normalise(`${code.slice(0, 3)}ם${code.slice(4)}`)).toEqual({ ok: false, reason: 'chars' }); // ם is the O key
    expect(normalise(code.slice(0, 15))).toEqual({ ok: false, reason: 'typo' });
    expect(normalise(`${code}A`)).toEqual({ ok: false, reason: 'typo' });
    expect(normalise(' - ')).toEqual({ ok: false, reason: 'empty' });
    expect(normalise(null)).toEqual({ ok: false, reason: 'empty' });
  });

  it('isCode: only a sound code, as it is stored', () => {
    expect(isCode(code)).toBe(true);
    expect(isCode(shown)).toBe(false);
    expect(isCode(code.toLowerCase())).toBe(false);
    expect(isCode(null)).toBe(false);
  });

  it('findCode: a code inside the message sent to a parent, pasted whole; a wrong one inside it is not taken', () => {
    expect(findCode(shown)).toBe(code);
    expect(findCode(`קוד הגיבוי שלי במדרגות: ${shown}\nאם הטלפון יתחלף: פותחים את מדרגות`)).toBe(code);
    expect(findCode(`הקוד: ${code.toLowerCase()} .`)).toBe(code);
    const typo = code.slice(0, 15) + CODE_ALPHABET[(CODE_ALPHABET.indexOf(code[15]) + 1) % CODE_ALPHABET.length];
    expect(findCode(`קוד: ${formatCode(typo)}`)).toBeNull();
    expect(findCode('שלום')).toBeNull();
    expect(findCode('')).toBeNull();
  });
});
