// A small stand-in for IndexedDB in unit tests (node has none): open() with onupgradeneeded and onsuccess, one
// transaction at a time, and an object store with get, put and delete. Enough for lib/push.js and sw.js, which keep
// one record (madregot-push / sub / current). Never imported by the app.
export function fakeIndexedDB() {
  const dbs = new Map(); // name -> Map(store name -> Map(key -> value))
  const later = (fn) => setTimeout(fn, 0);
  return {
    dbs,
    /** The record a test wants to look at: dbs.get(name).get(store).get(key). */
    peek: (name, store, key) => dbs.get(name)?.get(store)?.get(key),
    open(name) {
      const req = { result: null, error: null };
      later(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, new Map());
        const stores = dbs.get(name);
        req.result = {
          createObjectStore: (s) => { stores.set(s, new Map()); },
          close: () => {},
          transaction: (s) => {
            const store = stores.get(s);
            if (!store) throw new Error('NotFoundError');
            const tx = { error: null };
            tx.objectStore = () => ({
              get: (k) => ({ result: store.has(k) ? structuredClone(store.get(k)) : undefined }),
              put: (v, k) => { store.set(k, structuredClone(v)); return { result: k }; },
              delete: (k) => { store.delete(k); return { result: undefined }; },
            });
            later(() => tx.oncomplete?.());
            return tx;
          },
        };
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}
