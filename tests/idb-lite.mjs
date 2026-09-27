// An in-memory IndexedDB with only the calls lib/nsp-chat-store.js makes, so the real store runs in Node.

function clone(v) {
  return v === undefined ? undefined : structuredClone(v);
}

export const IDBKeyRange = {
  only: v => ({ test: k => k === v }),
  upperBound: v => ({ test: k => k <= v })
};

function later(fn) {
  setImmediate(fn);
}

function makeRequest(tx, work) {
  const req = { result: undefined, error: null, onsuccess: null, onerror: null };
  tx._pending++;
  later(() => {
    try { req.result = work(); } catch (e) { req.error = e; }
    if (req.error) { if (req.onerror) req.onerror(); tx._fail(req.error); }
    else if (req.onsuccess) req.onsuccess();
    tx._pending--;
    tx._settle();
  });
  return req;
}

class Store {
  constructor(name, opts) {
    this.name = name;
    this.keyPath = (opts && opts.keyPath) || "id";
    this.auto = !!(opts && opts.autoIncrement);
    this.next = 1;
    this.rows = new Map();
    this.indexes = {};
  }
  sorted() {
    return [...this.rows.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
}

function storeView(store, tx) {
  const view = {
    get indexNames() { return Object.keys(store.indexes); },
    createIndex(name, keyPath) { store.indexes[name] = keyPath; return {}; },
    add(value) {
      return makeRequest(tx, () => {
        const v = clone(value);
        let key = v[store.keyPath];
        if (key === undefined && store.auto) { key = store.next++; v[store.keyPath] = key; }
        if (store.rows.has(key)) throw new Error("ConstraintError");
        if (typeof key === "number" && key >= store.next) store.next = key + 1;
        store.rows.set(key, v);
        return key;
      });
    },
    put(value) {
      return makeRequest(tx, () => {
        const v = clone(value);
        let key = v[store.keyPath];
        if (key === undefined && store.auto) { key = store.next++; v[store.keyPath] = key; }
        if (typeof key === "number" && key >= store.next) store.next = key + 1;
        store.rows.set(key, v);
        return key;
      });
    },
    get(key) { return makeRequest(tx, () => clone(store.rows.get(key))); },
    getAll() { return makeRequest(tx, () => store.sorted().map(k => clone(store.rows.get(k)))); },
    delete(keyOrRange) {
      return makeRequest(tx, () => {
        if (keyOrRange && typeof keyOrRange.test === "function") { for (const k of [...store.rows.keys()]) if (keyOrRange.test(k)) store.rows.delete(k); }
        else store.rows.delete(keyOrRange);
      });
    },
    clear() { return makeRequest(tx, () => { store.rows.clear(); }); },
    index(name) {
      const path = store.indexes[name];
      const match = range => store.sorted().filter(k => !range || range.test(store.rows.get(k)[path]));
      return {
        getAll(range) { return makeRequest(tx, () => match(range).map(k => clone(store.rows.get(k)))); },
        openKeyCursor(range) {
          const keys = match(range);
          let i = 0;
          const req = { result: null, onsuccess: null };
          const step = () => {
            tx._pending++;
            later(() => {
              req.result = i < keys.length ? { primaryKey: keys[i], continue() { i++; step(); } } : null;
              if (req.onsuccess) req.onsuccess();
              tx._pending--;
              tx._settle();
            });
          };
          step();
          return req;
        }
      };
    }
  };
  return view;
}

class Db {
  constructor(name) {
    this.name = name;
    this.version = 0;
    this.stores = {};
    this.onversionchange = null;
  }
  get objectStoreNames() {
    const names = Object.keys(this.stores);
    return { contains: n => names.includes(n), length: names.length };
  }
  createObjectStore(name, opts) {
    this.stores[name] = new Store(name, opts);
    return storeView(this.stores[name], this._upgrade);
  }
  transaction(names, mode) {
    const list = [].concat(names);
    for (const n of list) if (!this.stores[n]) throw new Error("NotFoundError: " + n);
    const db = this;
    const tx = {
      mode, _pending: 0, _done: false, oncomplete: null, onerror: null, onabort: null, error: null,
      objectStore(n) { if (!list.includes(n)) throw new Error("NotFoundError: " + n); return storeView(db.stores[n], tx); },
      _fail(e) { if (tx._done) return; tx._done = true; tx.error = e; later(() => { if (tx.onerror) tx.onerror(); }); },
      _settle() {
        later(() => {
          if (tx._done || tx._pending > 0) return;
          tx._done = true;
          if (tx.oncomplete) tx.oncomplete();
        });
      }
    };
    tx._settle();
    return tx;
  }
  close() {}
}

export function makeIndexedDB() {
  const dbs = {};
  return {
    dbs,
    open(name, version) {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      later(() => {
        const db = dbs[name] || (dbs[name] = new Db(name));
        if ((version || 1) > db.version) {
          db._upgrade = { _pending: 0, _settle() {}, _fail() {} };
          req.result = db;
          if (req.onupgradeneeded) req.onupgradeneeded({ oldVersion: db.version, newVersion: version });
          db.version = version || 1;
        }
        req.result = db;
        later(() => { if (req.onsuccess) req.onsuccess(); });
      });
      return req;
    }
  };
}
