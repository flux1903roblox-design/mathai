// The copy of the progress on this device, in IndexedDB (DURABLE-1). localStorage stays the main store (it is read
// synchronously, so the first screen already has the progress); this database keeps three things beside it:
//   mirror      'current': { raw, rev, at }, the last saved JSON, written a second after each save and when the page
//               is hidden or closed; when localStorage is full, at once
//   quarantine  saved data that could not be used ('parse': not valid JSON; 'future-version': written by a newer build),
//               kept as it was, the newest 5 for 30 days, so nothing is thrown away by a bug
//   errors      the last 20 error records of this device, for "מידע לתמיכה"
// What the copy protects against: a corrupt key, a full localStorage, a bad migration, a lost write. What it does not:
// Safari's 7-day removal and "clear website data" remove IndexedDB too (backups are for that).
// The database code works through a small backend (browserBackend), so a test can hand it any IndexedDB: the unit tests
// give it fake-indexeddb, a real implementation of the standard in memory (durable/testing.js realIdb, idb.test.js),
// and the browser tests the browser's own.

export const DB_VERSION = 1;
export const KEEP_QUARANTINE = 5;
export const QUARANTINE_DAYS = 30;
export const KEEP_ERRORS = 20;

/**
 * The real IndexedDB as a backend: `get`, `put`, `add`, `entries`, `delete`, `close`, `destroy`. Null where the browser
 * has none. After another page deletes or upgrades the database (a "delete all" in another tab), this page stops using
 * it: every call fails, and nothing is written back.
 */
export function browserBackend(name, factory = globalThis.indexedDB) {
  if (!factory) return null;
  let dbp = null;
  let gone = false;
  const open = () => {
    if (gone) return Promise.reject(new Error('the database was closed'));
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        let req;
        try { req = factory.open(name, DB_VERSION); } catch (e) { reject(e); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('mirror')) db.createObjectStore('mirror');
          if (!db.objectStoreNames.contains('quarantine')) db.createObjectStore('quarantine', { autoIncrement: true });
          if (!db.objectStoreNames.contains('errors')) db.createObjectStore('errors', { autoIncrement: true });
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => { gone = true; dbp = null; db.close(); };
          resolve(db);
        };
        req.onerror = () => reject(req.error || new Error('the database did not open'));
        req.onblocked = () => reject(new Error('the database is blocked'));
      });
      dbp.catch(() => { dbp = null; }); // a failed open is tried again next time
    }
    return dbp;
  };
  // one transaction: `fn(objectStore)` returns a request (its result is the answer) or a function read at the end
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      let t;
      try { t = db.transaction(store, mode); } catch (e) { reject(e); return; }
      const r = fn(t.objectStore(store));
      t.oncomplete = () => resolve(typeof r === 'function' ? r() : r?.result);
      t.onerror = () => reject(t.error || new Error('the database write failed'));
      t.onabort = () => reject(t.error || new Error('the database write was stopped'));
    });
  };
  return {
    get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
    put: (store, value, key) => tx(store, 'readwrite', (s) => s.put(value, key)),
    add: (store, value) => tx(store, 'readwrite', (s) => s.add(value)),
    delete: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
    entries: (store) => tx(store, 'readonly', (s) => {
      const keys = s.getAllKeys(); const values = s.getAll();
      return () => keys.result.map((key, i) => ({ key, value: values.result[i] }));
    }),
    close() { gone = true; const p = dbp; dbp = null; p?.then((db) => db.close(), () => {}); },
    /** Delete the database; resolves when it is gone (or after a few seconds if another page keeps it open). */
    destroy() {
      this.close();
      return new Promise((resolve) => {
        const done = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(done, 3000);
        try {
          const req = factory.deleteDatabase(name);
          req.onsuccess = done; req.onerror = done;
        } catch { done(); }
      });
    },
  };
}

/** The mirror, quarantine and error log over a backend. Reads that fail answer null or []; writes reject. */
export function createIdb(backend) {
  if (!backend) return null;
  const all = async (store) => { try { return await backend.entries(store); } catch { return []; } };
  return {
    /** The copy: `{ raw, rev, at }`, or null when there is none (or the database cannot be read). */
    async readMirror() {
      try { const v = await backend.get('mirror', 'current'); return v && typeof v.raw === 'string' ? v : null; } catch { return null; }
    },
    writeMirror: (raw, rev, at) => backend.put('mirror', { raw, rev, at }, 'current'),
    deleteMirror: () => backend.delete('mirror', 'current'),
    /** Keep data that could not be used, as it was. Resolves true when it is kept. */
    async quarantine(raw, reason, version, at) {
      try { await backend.add('quarantine', { raw, reason, version: version ?? null, at }); } catch { return false; }
      await this.pruneQuarantine(at);
      return true;
    },
    /** The quarantined records, oldest first: `[{ key, value }]`. */
    listQuarantine: () => all('quarantine'),
    /** Remove one quarantined record (an undone restore has used its copy). */
    dropQuarantine: (k) => backend.delete('quarantine', k),
    /** Records older than 30 days go, and only the newest 5 stay. */
    async pruneQuarantine(now) {
      const list = await all('quarantine');
      const cutoff = Date.parse(now) - QUARANTINE_DAYS * 864e5;
      const drop = list.filter((r, i) => i < list.length - KEEP_QUARANTINE || !(Date.parse(r.value?.at) >= cutoff));
      await Promise.all(drop.map((r) => backend.delete('quarantine', r.key).catch(() => {})));
    },
    /** One error record in the ring of the last 20. */
    async addError(rec) {
      try { await backend.add('errors', rec); } catch { return false; }
      const list = await all('errors');
      await Promise.all(list.slice(0, Math.max(0, list.length - KEEP_ERRORS)).map((r) => backend.delete('errors', r.key).catch(() => {})));
      return true;
    },
    listErrors: async () => (await all('errors')).map((r) => r.value),
    close: () => backend.close(),
    destroy: () => backend.destroy(),
  };
}
