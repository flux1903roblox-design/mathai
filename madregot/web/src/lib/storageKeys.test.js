// Every key the web app keeps on a device has an entry in the data map's client block (worker/datamap.json, trust spec
// TRUST-1 §1), and every entry there is still used. The keys are read from the source itself: string and template
// literals that start with 'madregot-' or `${STORE_KEY}-`, the saved state's own name (STORE_KEY), and any literal
// passed to localStorage or sessionStorage. A new key without an entry fails here.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..');
const MAP = JSON.parse(readFileSync(path.resolve(SRC, '../../worker/datamap.json'), 'utf8'));
const ENTRIES = Object.keys(MAP.client);

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(js|jsx|ts|tsx|mjs)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}
const FILES = sourceFiles(SRC).map((p) => ({ file: path.relative(SRC, p), text: readFileSync(p, 'utf8') }));

/** A key as the map writes it: `${STORE_KEY}` at the start becomes <STORE_KEY>, every other ${…} becomes *. */
const normal = (raw) => raw.replace(/^\$\{STORE_KEY\}/, '<STORE_KEY>').replace(/\$\{[^}]*\}/g, '*');
// a quoted or backquoted literal that starts with madregot- or ${STORE_KEY}-, up to the same quote
const KEY_LITERAL = /(['"`])((?:madregot-|\$\{STORE_KEY\}-)(?:(?!\1)[^\\\n])*)\1/g;
// the first argument of a storage call, when it is a literal
// (a storage held in a short name is read too: the durable lane's probe, s.getItem('__t'))
const STORAGE_CALL = /\b(?:localStorage|sessionStorage|\)\??|s|ls)\.(?:getItem|setItem|removeItem)\(\s*(['"`])((?:(?!\1)[^\\\n])+)\1/g;

function scan() {
  const found = new Map(); // key -> files
  const add = (k, file) => found.set(k, [...(found.get(k) || []), file]);
  for (const { file, text } of FILES) {
    for (const m of text.matchAll(KEY_LITERAL)) {
      const k = normal(m[2]);
      if (/\.[a-z]{2,4}$/.test(k)) continue; // a download's file name (madregot-<date>.json), not a key
      add(k, file);
    }
    for (const m of text.matchAll(STORAGE_CALL)) add(normal(m[2]), file);
  }
  // the saved state itself: zustand persist under STORE_KEY (lib/store.js)
  if (FILES.some((f) => /\bname:\s*STORE_KEY\b/.test(f.text))) add('<STORE_KEY>', 'lib/store.js');
  return found;
}
const FOUND = scan();

/** Does a key found in the code fall under a map entry (exact, or an entry ending in * as a prefix)? */
const covers = (entry, key) => (entry.endsWith('*') ? key.startsWith(entry.slice(0, -1)) : key === entry);

describe('storage keys and the data map', () => {
  it('finds the keys it should (the scan itself works)', () => {
    for (const k of ['<STORE_KEY>', '<STORE_KEY>-parent', '<STORE_KEY>-order', '<STORE_KEY>-checkout-*', '<STORE_KEY>-photo-warned', '<STORE_KEY>-adult',
      '<STORE_KEY>-adult-wait', 'madregot-debug', 'madregot-seed', 'madregot-*', '__t']) {
      expect([...FOUND.keys()], k).toContain(k);
    }
    expect([...FOUND.keys()].some((k) => k.endsWith('.json'))).toBe(false);
  });

  it('every key in web/src has an entry in worker/datamap.json → client', () => {
    const missing = [...FOUND.entries()].filter(([k]) => !ENTRIES.some((e) => covers(e, k))).map(([k, files]) => `${k} (${files.join(', ')})`);
    expect(missing).toEqual([]);
  });

  it('every client entry is still a key the app uses', () => {
    const stale = ENTRIES.filter((e) => ![...FOUND.keys()].some((k) => covers(e, k)));
    expect(stale).toEqual([]);
  });

  it('a database or cache in the browser, or a cookie, would need an entry of its own', () => {
    // an entry's store may name two places ("sessionStorage or cache"): each counts
    const kinds = new Set(Object.values(MAP.client).flatMap((c) => c.store.split(' or ')));
    // the durable lane opens its database through a factory (lib/durable/idb.js: factory.open), not indexedDB.open
    for (const [re, kind] of [[/\bindexedDB\.open\(|\bfactory\.open\(/, 'indexedDB'], [/\bcaches\.open\(/, 'cache'], [/\bdocument\.cookie\b/, 'cookie']]) {
      const users = FILES.filter((f) => re.test(f.text)).map((f) => f.file);
      if (users.length) expect(kinds.has(kind), `${kind} used in ${users.join(', ')}`).toBe(true);
    }
  });

  it('"delete all" removes every key the map lists: each starts with the saved state\'s name or madregot (lib/wipe.js)', () => {
    for (const e of ENTRIES.filter((k) => k !== '__t')) expect(e.startsWith('<STORE_KEY>') || e.startsWith('madregot'), e).toBe(true);
  });
});
