(function (root) {
  var DB_NAME = 'zerack_chat';
  var DB_VERSION = 2;
  var LEDGER_TEXT = 2000;
  var LEDGER_MAX = 5000;
  var TITLE_MAX = 80;
  var TEXT_MAX = 60000;
  var opening = null;

  function open() {
    if (opening) return opening;
    opening = new Promise(function (resolve, reject) {
      var req;
      try { req = root.indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('conversations')) {
          var convs = db.createObjectStore('conversations', { keyPath: 'id' });
          convs.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('messages')) {
          var msgs = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          msgs.createIndex('convId', 'convId');
        }
        if (!db.objectStoreNames.contains('ledger')) {
          var ledger = db.createObjectStore('ledger', { keyPath: 'id', autoIncrement: true });
          ledger.createIndex('host', 'host');
          ledger.createIndex('convId', 'convId');
        }
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); opening = null; };
        resolve(db);
      };
      req.onerror = function () { opening = null; reject(req.error || new Error('indexedDB open failed')); };
      req.onblocked = function () { opening = null; reject(new Error('indexedDB open blocked')); };
    });
    return opening;
  }

  function tx(stores, mode, work) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(stores, mode);
        var out;
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error || new Error('transaction failed')); };
        t.onabort = function () { reject(t.error || new Error('transaction aborted')); };
        out = work(t);
      });
    });
  }

  function wait(req, map) {
    var box = { value: undefined };
    req.onsuccess = function () { box.value = map ? map(req.result) : req.result; };
    return box;
  }

  function newId() {
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function cleanTitle(t) {
    return String(t || '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
  }

  function listConversations() {
    return tx(['conversations'], 'readonly', function (t) {
      return wait(t.objectStore('conversations').getAll());
    }).then(function (box) {
      return (box.value || []).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    });
  }

  function getConversation(id) {
    return tx(['conversations'], 'readonly', function (t) {
      return wait(t.objectStore('conversations').get(String(id)));
    }).then(function (box) { return box.value || null; });
  }

  function createConversation(opts) {
    opts = opts || {};
    var now = Date.now();
    var conv = { id: newId(), title: cleanTitle(opts.title) || 'New chat', titled: !!cleanTitle(opts.title), createdAt: now, updatedAt: now };
    return tx(['conversations'], 'readwrite', function (t) {
      t.objectStore('conversations').put(conv);
    }).then(function () { return conv; });
  }

  function patchConversation(id, patch) {
    return tx(['conversations'], 'readwrite', function (t) {
      var store = t.objectStore('conversations');
      var box = { value: null };
      var req = store.get(String(id));
      req.onsuccess = function () {
        var conv = req.result;
        if (!conv) return;
        Object.keys(patch).forEach(function (k) { conv[k] = patch[k]; });
        store.put(conv);
        box.value = conv;
      };
      return box;
    }).then(function (box) { return box.value; });
  }

  function renameConversation(id, title) {
    var t = cleanTitle(title);
    if (!t) return Promise.resolve(null);
    return patchConversation(id, { title: t, titled: true, updatedAt: Date.now() });
  }

  function deleteConversation(id) {
    id = String(id);
    return tx(['conversations', 'messages'], 'readwrite', function (t) {
      t.objectStore('conversations').delete(id);
      var idx = t.objectStore('messages').index('convId');
      var req = idx.openKeyCursor(IDBKeyRange.only(id));
      var msgs = t.objectStore('messages');
      req.onsuccess = function () {
        var cur = req.result;
        if (!cur) return;
        msgs.delete(cur.primaryKey);
        cur.continue();
      };
    }).then(function () { return true; });
  }

  function clearAll() {
    return tx(['conversations', 'messages', 'ledger'], 'readwrite', function (t) {
      t.objectStore('conversations').clear();
      t.objectStore('messages').clear();
      t.objectStore('ledger').clear();
    }).then(function () { return true; });
  }

  function text(v, n) {
    return v == null ? '' : String(v).slice(0, n || LEDGER_TEXT);
  }

  function ledgerEntry(e) {
    e = e && typeof e === 'object' ? e : {};
    var fields = Array.isArray(e.fields) ? e.fields.slice(0, 20).map(function (f) {
      f = f && typeof f === 'object' ? f : {};
      return { field: text(f.field, 200), before: text(f.before), after: text(f.after) };
    }) : [];
    var pressed = e.pressed && typeof e.pressed === 'object' ? { by: text(e.pressed.by, 20), at: Number(e.pressed.at) || 0 } : null;
    return {
      v: 1,
      at: Number(e.at) || Date.now(),
      convId: text(e.convId, 80),
      host: text(e.host, 255),
      url: text(e.url, 2000),
      playbook: text(e.playbook, 40),
      action: text(e.action, 20),
      target: text(e.target, 300),
      kind: text(e.kind, 20),
      decision: text(e.decision, 20),
      pressed: pressed,
      fields: fields,
      urlBefore: text(e.urlBefore, 2000),
      urlAfter: text(e.urlAfter, 2000),
      stateChanged: text(e.stateChanged, 300),
      result: text(e.result, 20),
      detail: text(e.detail, 600)
    };
  }

  function addLedger(entry) {
    var row = ledgerEntry(entry);
    return tx(['ledger'], 'readwrite', function (t) {
      var store = t.objectStore('ledger');
      var box = { value: 0 };
      var add = store.add(row);
      add.onsuccess = function () {
        box.value = add.result;
        if (box.value > LEDGER_MAX) store.delete(IDBKeyRange.upperBound(box.value - LEDGER_MAX));
      };
      return box;
    }).then(function (box) {
      row.id = box.value;
      return row;
    });
  }

  function listLedger(opts) {
    opts = opts || {};
    var limit = Math.max(1, Math.min(500, Number(opts.limit) || 100));
    return tx(['ledger'], 'readonly', function (t) {
      var store = t.objectStore('ledger');
      if (opts.host) return wait(store.index('host').getAll(IDBKeyRange.only(String(opts.host))));
      if (opts.convId) return wait(store.index('convId').getAll(IDBKeyRange.only(String(opts.convId))));
      return wait(store.getAll());
    }).then(function (box) {
      return (box.value || []).sort(function (a, b) { return a.id - b.id; }).slice(-limit);
    });
  }

  function getMessages(convId) {
    return tx(['messages'], 'readonly', function (t) {
      return wait(t.objectStore('messages').index('convId').getAll(IDBKeyRange.only(String(convId))));
    }).then(function (box) {
      return (box.value || []).sort(function (a, b) { return a.id - b.id; });
    });
  }

  function appendMessage(convId, msg) {
    convId = String(convId);
    var row = {
      convId: convId,
      at: Number(msg && msg.at) || Date.now(),
      role: String((msg && msg.role) || 'user'),
      text: String((msg && msg.text) || '').slice(0, TEXT_MAX),
      meta: msg && msg.meta && typeof msg.meta === 'object' ? msg.meta : null
    };
    return tx(['messages', 'conversations'], 'readwrite', function (t) {
      var box = { value: 0 };
      var convs = t.objectStore('conversations');
      var get = convs.get(convId);
      get.onsuccess = function () {
        var conv = get.result;
        if (!conv) return;
        var add = t.objectStore('messages').add(row);
        add.onsuccess = function () { box.value = add.result; };
        conv.updatedAt = row.at;
        if (!conv.titled && row.role === 'user' && row.text) { conv.title = cleanTitle(row.text) || conv.title; conv.titled = true; }
        convs.put(conv);
      };
      return box;
    }).then(function (box) {
      if (!box.value) return null;
      row.id = box.value;
      return row;
    });
  }

  function updateMessage(id, patch) {
    return tx(['messages'], 'readwrite', function (t) {
      var store = t.objectStore('messages');
      var req = store.get(Number(id));
      req.onsuccess = function () {
        var row = req.result;
        if (!row) return;
        Object.keys(patch).forEach(function (k) { if (k !== 'id' && k !== 'convId') row[k] = patch[k]; });
        store.put(row);
      };
    }).then(function () { return true; });
  }

  root.NSP_CHAT_STORE = Object.freeze({
    name: DB_NAME,
    listConversations: listConversations,
    getConversation: getConversation,
    createConversation: createConversation,
    renameConversation: renameConversation,
    deleteConversation: deleteConversation,
    clearAll: clearAll,
    getMessages: getMessages,
    appendMessage: appendMessage,
    updateMessage: updateMessage,
    addLedger: addLedger,
    listLedger: listLedger
  });
})(typeof self !== 'undefined' ? self : this);
