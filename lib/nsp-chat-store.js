(function (root) {
  var DB_NAME = 'zerack_chat';
  var DB_VERSION = 4;
  var LEDGER_TEXT = 2000;
  var LEDGER_MAX = 5000;
  var SERIES_MAX = 5000;
  var SERIES_IDS = 250;
  var SERIES_ITEMS = 60;
  var SERIES_FACTS = 24;
  var DECISIONS_MAX = 2000;
  var DECISION_MEASURES = 20;
  var DECISION_POINTS = 400;
  var STATES = { keep: 1, look: 1, drop: 1 };
  var LESSON_STATES = { tentative: 1, firm: 1, deleted: 1 };
  var DECISION_STATUS = { open: 1, kept: 1, dropped: 1, expired: 1, forgotten: 1 };
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
        if (!db.objectStoreNames.contains('series')) {
          var series = db.createObjectStore('series', { keyPath: 'id', autoIncrement: true });
          series.createIndex('key', 'key');
          series.createIndex('host', 'host');
        }
        if (!db.objectStoreNames.contains('decisions')) {
          var decisions = db.createObjectStore('decisions', { keyPath: 'id', autoIncrement: true });
          decisions.createIndex('host', 'host');
          decisions.createIndex('status', 'status');
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
    return tx(['conversations', 'messages', 'ledger', 'series', 'decisions'], 'readwrite', function (t) {
      t.objectStore('conversations').clear();
      t.objectStore('messages').clear();
      t.objectStore('ledger').clear();
      t.objectStore('series').clear();
      t.objectStore('decisions').clear();
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
    var evidence = e.evidence && typeof e.evidence === 'object' ? { decision: Number(e.evidence.decision) || 0, line: text(e.evidence.line, 400) } : null;
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
      detail: text(e.detail, 600),
      evidence: evidence
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

  function seriesEntry(e) {
    e = e && typeof e === 'object' ? e : {};
    var metrics = {};
    var m = e.metrics && typeof e.metrics === 'object' ? e.metrics : {};
    Object.keys(m).slice(0, 40).forEach(function (k) {
      var v = m[k];
      if (typeof v === 'number' && isFinite(v)) metrics[text(k, 40)] = v;
    });
    var per = {};
    var p = e.per && typeof e.per === 'object' ? e.per : {};
    Object.keys(p).slice(0, 80).forEach(function (k) {
      var v = p[k];
      if (!v || typeof v !== 'object') return;
      var row = {};
      ['position', 'clicks', 'impressions', 'stars'].forEach(function (n) { if (typeof v[n] === 'number' && isFinite(v[n])) row[n] = v[n]; });
      if (typeof v.url === 'string' && /^https:\/\//.test(v.url)) row.url = text(v.url, 300);
      if (Object.keys(row).length) per[text(k, 160)] = row;
    });
    var facts = {};
    var f = e.facts && typeof e.facts === 'object' ? e.facts : {};
    Object.keys(f).slice(0, SERIES_FACTS).forEach(function (k) {
      var v = f[k];
      if (typeof v === 'number' && isFinite(v)) facts[text(k, 40)] = v;
      else if (typeof v === 'string' && v) facts[text(k, 40)] = text(v, 600);
    });
    var items = Array.isArray(e.items) ? e.items.slice(0, SERIES_ITEMS).map(function (x) {
      x = x && typeof x === 'object' ? x : {};
      return {
        kind: text(x.kind, 12),
        id: text(x.id, 60),
        title: text(x.title, 300),
        text: text(x.text, 600),
        url: text(x.url, 400),
        n: num(x.n),
        by: text(x.by, 60),
        at: Number(x.at) || 0,
        depth: Math.max(0, Math.min(20, Number(x.depth) || 0)),
        labels: Array.isArray(x.labels) ? x.labels.slice(0, 4).map(function (l) { return text(l, 40); }) : []
      };
    }).filter(function (x) { return x.title || x.text; }) : [];
    return {
      v: 1,
      at: Number(e.at) || Date.now(),
      key: text(e.key, 600),
      host: text(e.host, 255),
      reader: text(e.reader, 40),
      playbook: text(e.playbook, 40),
      metrics: metrics,
      ids: Array.isArray(e.ids) ? e.ids.slice(0, SERIES_IDS).map(function (x) { return text(x, 300); }) : [],
      per: per,
      items: items,
      facts: facts
    };
  }

  function addSeries(entry) {
    var row = seriesEntry(entry);
    if (!row.key) return Promise.resolve(null);
    return tx(['series'], 'readwrite', function (t) {
      var store = t.objectStore('series');
      var box = { value: 0 };
      var add = store.add(row);
      add.onsuccess = function () {
        box.value = add.result;
        if (box.value > SERIES_MAX) store.delete(IDBKeyRange.upperBound(box.value - SERIES_MAX));
      };
      return box;
    }).then(function (box) {
      row.id = box.value;
      return row;
    });
  }

  function lastSeries(key) {
    return tx(['series'], 'readonly', function (t) {
      return wait(t.objectStore('series').index('key').getAll(IDBKeyRange.only(String(key || ''))));
    }).then(function (box) {
      var list = (box.value || []).sort(function (a, b) { return a.id - b.id; });
      return list.length ? list[list.length - 1] : null;
    });
  }

  function seriesFor(key, limit) {
    var max = Math.max(1, Math.min(1000, Number(limit) || 400));
    return tx(['series'], 'readonly', function (t) {
      return wait(t.objectStore('series').index('key').getAll(IDBKeyRange.only(String(key || ''))));
    }).then(function (box) {
      return (box.value || []).sort(function (a, b) { return a.id - b.id; }).slice(-max);
    });
  }

  function seriesByHost(host, limit) {
    var max = Math.max(1, Math.min(500, Number(limit) || 50));
    return tx(['series'], 'readonly', function (t) {
      return wait(t.objectStore('series').index('host').getAll(IDBKeyRange.only(String(host || ''))));
    }).then(function (box) {
      return (box.value || []).sort(function (a, b) { return b.id - a.id; }).slice(0, max);
    });
  }

  function listSeries(opts) {
    opts = opts || {};
    var since = Number(opts.since) || 0;
    var readers = Array.isArray(opts.readers) ? opts.readers.map(String) : null;
    var max = Math.max(1, Math.min(SERIES_MAX, Number(opts.limit) || 500));
    return tx(['series'], 'readonly', function (t) {
      return wait(t.objectStore('series').getAll());
    }).then(function (box) {
      return (box.value || []).filter(function (r) {
        return (!since || r.at >= since) && (!readers || readers.indexOf(String(r.reader || '')) >= 0);
      }).sort(function (a, b) { return b.id - a.id; }).slice(0, max);
    });
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function missingList(list) {
    return Array.isArray(list) ? list.slice(0, 8).map(function (m) {
      m = m && typeof m === 'object' ? m : {};
      return { rule: text(m.rule, 30), has: num(m.has), needs: num(m.needs), text: text(m.text, 300) };
    }) : [];
  }

  function resultEntry(r) {
    r = r && typeof r === 'object' ? r : {};
    return {
      ok: r.ok === true,
      kind: text(r.kind, 10),
      state: STATES[r.state] === 1 ? r.state : 'look',
      label: text(r.label, 20),
      number: text(r.number, 400),
      line: text(r.line, 900),
      error: text(r.error, 300),
      missing: missingList(r.missing),
      leader: text(r.leader, 120),
      control: text(r.control, 120),
      sufficient: r.sufficient === true,
      projection: r.projection && typeof r.projection === 'object' ? { line: text(r.projection.line, 200), more: num(r.projection.more) } : null,
      arms: Array.isArray(r.arms) ? r.arms.slice(0, 12).map(function (a) {
        a = a && typeof a === 'object' ? a : {};
        return { name: text(a.name, 120), impressions: num(a.impressions), clicks: num(a.clicks), rate: num(a.rate), from: text(a.from, 10) };
      }) : [],
      readings: num(r.readings)
    };
  }

  function decisionEntry(e) {
    e = e && typeof e === 'object' ? e : {};
    var lesson = e.lesson && typeof e.lesson === 'object' ? e.lesson : {};
    var src = e.source && typeof e.source === 'object' ? e.source : null;
    var claim = e.claim && typeof e.claim === 'object' ? e.claim : {};
    var input = e.input && typeof e.input === 'object' ? e.input : {};
    return {
      v: 1,
      at: Number(e.at) || Date.now(),
      convId: text(e.convId, 80),
      host: text(e.host, 255),
      playbook: text(e.playbook, 40),
      url: text(e.url, 2000),
      kind: text(e.kind, 10),
      question: text(e.question, 300),
      input: {
        arms: Array.isArray(input.arms) ? input.arms.slice(0, 12).map(function (a) { a = a && typeof a === 'object' ? a : {}; return { name: text(a.name, 120), impressions: num(a.impressions), clicks: num(a.clicks), from: text(a.from, 10) }; }) : [],
        control: text(input.control, 120),
        name: text(input.name, 120),
        metric: text(input.metric, 40),
        points: Array.isArray(input.points) ? input.points.slice(-DECISION_POINTS).map(function (p) { p = p && typeof p === 'object' ? p : {}; return { t: num(p.t), value: num(p.value) }; }) : [],
        successes: num(input.successes),
        total: num(input.total),
        bar: num(input.bar)
      },
      source: src ? { key: text(src.key, 600), reader: text(src.reader, 40), url: text(src.url, 2000), metric: text(src.metric, 40), rows: Array.isArray(src.rows) ? src.rows.slice(0, 12).map(function (x) { return text(x, 160); }) : [] } : null,
      result: resultEntry(e.result),
      claim: { state: STATES[claim.state] === 1 ? claim.state : 'keep', winner: text(claim.winner, 120) },
      lesson: { text: text(lesson.text, 300), state: LESSON_STATES[lesson.state] === 1 ? lesson.state : 'tentative', at: Number(lesson.at) || 0, evidence: text(lesson.evidence, 400), why: text(lesson.why, 600) },
      status: DECISION_STATUS[e.status] === 1 ? e.status : 'open',
      dueAt: Number(e.dueAt) || 0,
      span: Number(e.span) || 0,
      tries: Math.max(0, Math.min(99, Number(e.tries) || 0)),
      measuredAt: Number(e.measuredAt) || 0,
      readAt: Number(e.readAt) || 0,
      waiting: text(e.waiting, 300),
      measures: Array.isArray(e.measures) ? e.measures.slice(-DECISION_MEASURES).map(function (m) {
        m = m && typeof m === 'object' ? m : {};
        return { at: Number(m.at) || 0, state: STATES[m.state] === 1 ? m.state : 'look', number: text(m.number, 400), why: text(m.why, 600), by: text(m.by, 20) };
      }) : []
    };
  }

  function addDecision(entry) {
    var row = decisionEntry(entry);
    return tx(['decisions'], 'readwrite', function (t) {
      var store = t.objectStore('decisions');
      var box = { value: 0 };
      var add = store.add(row);
      add.onsuccess = function () {
        box.value = add.result;
        if (box.value > DECISIONS_MAX) store.delete(IDBKeyRange.upperBound(box.value - DECISIONS_MAX));
      };
      return box;
    }).then(function (box) {
      row.id = box.value;
      return row;
    });
  }

  function getDecision(id) {
    return tx(['decisions'], 'readonly', function (t) {
      return wait(t.objectStore('decisions').get(Number(id)));
    }).then(function (box) { return box.value || null; });
  }

  function putDecision(row) {
    if (!row || !(Number(row.id) > 0)) return Promise.resolve(null);
    var clean = decisionEntry(row);
    clean.id = Number(row.id);
    return tx(['decisions'], 'readwrite', function (t) {
      t.objectStore('decisions').put(clean);
    }).then(function () { return clean; });
  }

  function listDecisions(opts) {
    opts = opts || {};
    var limit = Math.max(1, Math.min(2000, Number(opts.limit) || 200));
    return tx(['decisions'], 'readonly', function (t) {
      var store = t.objectStore('decisions');
      if (opts.host) return wait(store.index('host').getAll(IDBKeyRange.only(String(opts.host))));
      if (opts.status) return wait(store.index('status').getAll(IDBKeyRange.only(String(opts.status))));
      return wait(store.getAll());
    }).then(function (box) {
      return (box.value || []).sort(function (a, b) { return b.id - a.id; }).slice(0, limit);
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
    listLedger: listLedger,
    addSeries: addSeries,
    lastSeries: lastSeries,
    seriesFor: seriesFor,
    seriesByHost: seriesByHost,
    listSeries: listSeries,
    addDecision: addDecision,
    getDecision: getDecision,
    putDecision: putDecision,
    listDecisions: listDecisions
  });
})(typeof self !== 'undefined' ? self : this);
