// ashlyv-bridge.js — ISOLATED world
//
// Every script on youtube.com can post to this window, not only nsp-bundle.js, so nothing a page message asks for
// is trusted. This bridge forwards only the messages in PAGE_CALLS, rebuilt field by field, and the service worker
// checks the sender again at its own door. What spends the user's AI keys needs a grant the page cannot open: the
// worker opens one for a turn handed over from the chat or the voice, and this file asks for one when it sees a real
// press (isTrusted) on a ZERACK control marked data-nsp-grant. Listing, switching or closing tabs is never forwarded.

// MV3 MAIN world content scripts have no chrome.runtime, so face-api.js reads its model folder from this attribute.
try {
  document.documentElement.setAttribute('data-nsp-faceapi-url', chrome.runtime.getURL('lib/face-api/'));
} catch (eBridgeUrl) { console.warn('[NSP bridge] failed to expose the face-api folder:', eBridgeUrl && eBridgeUrl.message); }

function nspBridgePost(msg) {
  try { window.postMessage(msg, window.location.origin); } catch (e) {}
}

// One way to reach the service worker: a missing worker or a thrown send comes back as a reason, never as silence.
function nspBridgeSend(msg, done) {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) { done({ ok: false, error: 'extension_reloaded', detail: 'The extension was reloaded or updated. Reload this YouTube tab.' }); return; }
  try {
    chrome.runtime.sendMessage(msg, function(res) {
      var err = chrome.runtime && chrome.runtime.lastError;
      if (err) { done({ ok: false, error: 'service_worker_unreachable', detail: String(err.message || err) }); return; }
      done(res && typeof res === 'object' ? res : { ok: false, error: 'no_response', detail: 'The service worker answered with nothing.' });
    });
  } catch (eSend) {
    done({ ok: false, error: 'bridge_send', detail: String((eSend && eSend.message) || eSend) });
  }
}

function nspBridgeFromPage(event, type) {
  if (event.source !== window) return null;
  if (event.origin && event.origin !== window.location.origin) return null;
  var data = event.data;
  if (!data || typeof data !== 'object' || data.type !== type) return null;
  var reqId = String(data.requestId || '').slice(0, 80);
  return reqId ? { data: data, reqId: reqId } : null;
}

// ── Grants from a real press ────────────────────────────────────────────────
var NSP_GRANT_KINDS = { coach: 1, vision: 1, titles: 1, comments: 1, replicate: 1, brand: 1 };

function nspGrantFromEvent(e) {
  if (!e || e.isTrusted !== true) return;
  if (e.type === 'keydown' && (e.key !== 'Enter' || e.shiftKey || e.isComposing)) return;
  var path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  for (var i = 0; i < path.length && i < 40; i++) {
    var el = path[i];
    var kind = el && typeof el.getAttribute === 'function' ? el.getAttribute('data-nsp-grant') : null;
    if (kind) {
      if (NSP_GRANT_KINDS[kind] === 1) nspGrantAsk(kind);
      return;
    }
  }
}

function nspGrantAsk(kind) {
  nspBridgeSend({ type: 'NSP_GRANT_OPEN', kind: kind }, function(res) {
    if (!res || res.ok !== true) console.warn('[NSP bridge] grant ' + kind + ' not opened:', res && (res.detail || res.error));
  });
}

// Capture on the window runs before any handler of the button itself, so the grant is asked before the request it covers.
window.addEventListener('click', nspGrantFromEvent, true);
window.addEventListener('keydown', nspGrantFromEvent, true);

// ── AI tasks ────────────────────────────────────────────────────────────────
// The page names a task and sends data. The worker writes the prompt, picks the model and checks the grant.
var NSP_PAGE_TASKS = { coach: 1, titles: 1, comments: 1, replicate: 1, brand: 1 };

function nspTaskData(task, d) {
  d = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  if (task === 'coach') {
    var ctx = d.context && typeof d.context === 'object' ? d.context : {};
    return {
      messages: Array.isArray(d.messages) ? d.messages.slice(-50).map(function(m) { return { role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, 16000) }; }) : [],
      tools: d.tools === true,
      spoken: d.spoken === true,
      query: String(d.query || '').slice(0, 2000),
      context: { text: String(ctx.text || '').slice(0, 12000), lean: String(ctx.lean || '').slice(0, 3000) }
    };
  }
  if (task === 'titles') return { niche: String(d.niche || '').slice(0, 80), variants: nspStrings(d.variants, 12, 200), anchors: nspStrings(d.anchors, 8, 200) };
  if (task === 'comments') return { comments: (Array.isArray(d.comments) ? d.comments : []).slice(0, 50).map(function(c) { return { text: String((c && c.text) || '').slice(0, 300), likes: Number(c && c.likes) || 0 }; }) };
  if (task === 'replicate') return { channelUrl: String(d.channelUrl || '').slice(0, 300), language: String(d.language || '').slice(0, 5) };
  if (task === 'brand') return { niche: String(d.niche || '').slice(0, 120), tone: String(d.tone || '').slice(0, 10), language: String(d.language || '').slice(0, 5) };
  return null;
}

function nspStrings(list, maxItems, maxChars) {
  return (Array.isArray(list) ? list : []).slice(0, maxItems).map(function(v) { return String(v == null ? '' : v).slice(0, maxChars); });
}

window.addEventListener('message', function(event) {
  var got = nspBridgeFromPage(event, 'NSP_AI_TASK');
  if (!got) return;
  var task = String(got.data.task || '');
  var reply = function(res) { nspBridgePost(Object.assign({}, res, { type: 'NSP_AI_TASK_RESULT', requestId: got.reqId, task: task })); };
  if (NSP_PAGE_TASKS[task] !== 1) { reply({ ok: false, error: 'unknown_task' }); return; }
  nspBridgeSend({ type: 'NSP_AI_TASK', task: task, data: nspTaskData(task, got.data.data) }, function(res) {
    if (task === 'coach' && res.ok === true) {
      reply({ ok: true, text: String(res.text || ''), functionCalls: Array.isArray(res.functionCalls) ? res.functionCalls : [], provider: String(res.provider || '') });
      return;
    }
    reply(res);
  });
});

// Thumbnails only, from i.ytimg.com. The worker spends one use of the vision grant per request.
var NSP_THUMB_URL = /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/[a-z0-9_]+\.(?:jpg|webp)$/;

window.addEventListener('message', function(event) {
  var got = nspBridgeFromPage(event, 'NSP_VISION_JUDGE');
  if (!got) return;
  var data = got.data;
  var thumbs = (Array.isArray(data.thumbs) ? data.thumbs : [data.thumb]).filter(function(u) { return typeof u === 'string' && NSP_THUMB_URL.test(u); }).slice(0, 4);
  nspBridgeSend({
    type: 'ASHLYV_VISION_JUDGE',
    payload: {
      thumbs: thumbs,
      title: typeof data.title === 'string' ? data.title.slice(0, 300) : '',
      channel: typeof data.channel === 'string' ? data.channel.slice(0, 160) : ''
    }
  }, function(res) {
    if (res.ok !== true) { nspBridgePost({ type: 'NSP_VISION_JUDGE_RESPONSE', requestId: got.reqId, ok: false, error: res.error || 'unknown_error', detail: res.detail || '' }); return; }
    nspBridgePost({ type: 'NSP_VISION_JUDGE_RESPONSE', requestId: got.reqId, ok: true, verdict: res.verdict || null });
  });
});

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  if (!event.data) return;
  var ct = event.data.type;
  if (ct !== 'NSP_CORPUS_INGEST' && ct !== 'NSP_CORPUS_QUERY' && ct !== 'NSP_CORPUS_STATS') return;
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  var cReqId = String(event.data.requestId || '').slice(0, 80);
  if (!cReqId) return;
  var CORPUS_CAP = 3000;

  if (ct === 'NSP_CORPUS_INGEST') {
    var incoming = Array.isArray(event.data.records) ? event.data.records.slice(0, 200) : [];
    chrome.storage.local.get(['nsp_title_corpus'], function(r) {
      var corpus = Array.isArray(r && r.nsp_title_corpus) ? r.nsp_title_corpus : [];
      var byKey = {};
      corpus.forEach(function(rec) { if (rec && rec.t) byKey[String(rec.t).toLowerCase().slice(0, 80)] = rec; });
      incoming.forEach(function(rec) {
        if (!rec || !rec.t) return;
        var clean = { t: String(rec.t).slice(0, 200), n: String(rec.n || '').slice(0, 60), w: Math.max(0, Number(rec.w) || 0), th: /^https:\/\/i\.ytimg\.com\//.test(String(rec.th || '')) ? String(rec.th).slice(0, 300) : '', c: String(rec.c || '').slice(0, 80), ts: Number(rec.ts) || Date.now() };
        // A record with no measured VPH keeps e:1 and no v, as the page wrote it.
        if (rec.e === 1) clean.e = 1; else clean.v = Math.max(0, Number(rec.v) || 0);
        rec = clean;
        var k = rec.t.toLowerCase().slice(0, 80);
        var ex = byKey[k];
        // On a duplicate title keep the higher VPH record, it is the better performance signal.
        if (!ex || rec.v > Number(ex.v || 0)) byKey[k] = rec;
      });
      var merged = Object.keys(byKey).map(function(k) { return byKey[k]; });
      merged.sort(function(a, b) { return Number(b.v || 0) - Number(a.v || 0); });
      if (merged.length > CORPUS_CAP) merged = merged.slice(0, CORPUS_CAP);
      chrome.storage.local.set({ nsp_title_corpus: merged }, function() {
        nspBridgePost({ type: 'NSP_COACH_STORAGE_RESULT', requestId: cReqId, ok: true, corpusSize: merged.length });
      });
    });
    return;
  }

  if (ct === 'NSP_CORPUS_QUERY') {
    var qNiche = String(event.data.niche || '').toLowerCase();
    var limit = Math.min(40, Number(event.data.limit) || 20);
    chrome.storage.local.get(['nsp_title_corpus'], function(r) {
      var corpus = Array.isArray(r && r.nsp_title_corpus) ? r.nsp_title_corpus : [];
      var filtered = qNiche ? corpus.filter(function(rec) { return rec && String(rec.n || '').toLowerCase() === qNiche; }) : corpus.slice();
      filtered.sort(function(a, b) { return Number(b.v || 0) - Number(a.v || 0); });
      nspBridgePost({ type: 'NSP_COACH_STORAGE_RESULT', requestId: cReqId, ok: true, niche: qNiche, total: filtered.length, corpusTotal: corpus.length, winners: filtered.slice(0, limit) });
    });
    return;
  }

  if (ct === 'NSP_CORPUS_STATS') {
    chrome.storage.local.get(['nsp_title_corpus'], function(r) {
      var corpus = Array.isArray(r && r.nsp_title_corpus) ? r.nsp_title_corpus : [];
      var byNiche = {};
      corpus.forEach(function(rec) { if (rec && rec.n) byNiche[rec.n] = (byNiche[rec.n] || 0) + 1; });
      nspBridgePost({ type: 'NSP_COACH_STORAGE_RESULT', requestId: cReqId, ok: true, total: corpus.length, byNiche: byNiche });
    });
    return;
  }
});

// ── The YouTube agent's tools ───────────────────────────────────────────────
// Only what the in-page agent needs and a page could not already do by itself. Opening a tab goes through the
// worker's grant and host check; listing, switching and closing tabs and reading other sites belong to the chat.
var NSP_COACH_TOOLS = {
  NSP_COACH_TOOL_EXT_DATA: function(d, done) { NSP_DATA_TOOLS.extensionData(d.area).then(done); },
  NSP_COACH_TOOL_GETSAVED: function(d, done) { NSP_DATA_TOOLS.savedNiches().then(done); },
  NSP_COACH_TOOL_SAVENICHE: function(d, done) { NSP_DATA_TOOLS.saveNiche(d.nicho).then(done); },
  NSP_COACH_TOOL_ADD_TRACKING: function(d, done) { NSP_DATA_TOOLS.addTracking(d.nicho).then(done); },
  NSP_COACH_TOOL_EXPORT_NICHES: function(d, done) {
    NSP_DATA_TOOLS.exportNiches(d.format).then(function(res) {
      if (!res.ok) { done(res); return; }
      try {
        var url = URL.createObjectURL(new Blob([res.text], { type: res.mime }));
        var a = document.createElement('a');
        a.href = url; a.download = res.filename;
        document.body.appendChild(a); a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
        done({ ok: true, exported: res.exported, filename: res.filename });
      } catch (eDl) {
        done({ ok: false, error: 'download failed: ' + eDl.message });
      }
    });
  },
  NSP_COACH_TOOL_OPENTAB: function(d, done) {
    nspBridgeSend({ type: 'NSP_AGENT_OPEN_TAB', url: String(d.url || '').slice(0, 2000) }, done);
  },
  NSP_COACH_TOOL_SEARCH_MARKET: function(d, done) {
    nspBridgeSend({ type: 'NSP_AGENT_SEARCH_MARKET', query: String(d.query || '').slice(0, 120), gl: String(d.gl || 'US').slice(0, 4), hl: String(d.hl || 'en').slice(0, 8) }, function(res) {
      done(res.ok === true ? { ok: true, videos: res.videos || [], count: res.count || 0 } : res);
    });
  },
  NSP_COACH_TOOL_CHANNEL_STATS: function(d, done) { nspBridgeSend({ type: 'NSP_AGENT_CHANNEL_STATS', channelUrl: String(d.channelUrl || '').slice(0, 300) }, done); },
  NSP_COACH_TOOL_CHANNEL_VIDEOS: function(d, done) { nspBridgeSend({ type: 'NSP_AGENT_CHANNEL_VIDEOS', channelUrl: String(d.channelUrl || '').slice(0, 300) }, done); }
};

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  var type = event.data && typeof event.data === 'object' ? String(event.data.type || '') : '';
  if (!Object.prototype.hasOwnProperty.call(NSP_COACH_TOOLS, type)) return;
  var got = nspBridgeFromPage(event, type);
  if (!got) return;
  NSP_COACH_TOOLS[type](got.data, function(res) {
    nspBridgePost(Object.assign({}, res, { type: 'NSP_COACH_STORAGE_RESULT', requestId: got.reqId }));
  });
});

// ── NSP AI COACH storage bridge ──────────────────────────────────────────────
// MAIN cannot use chrome.storage directly. Bridge for read/write conversation history.
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  if (!event.data || (event.data.type !== 'NSP_COACH_STORAGE_GET' && event.data.type !== 'NSP_COACH_STORAGE_SET' && event.data.type !== 'NSP_COACH_SESSIONS_GET' && event.data.type !== 'NSP_COACH_SESSIONS_SET' && event.data.type !== 'NSP_COACH_GET_PREFERRED_PROVIDER' && event.data.type !== 'NSP_COACH_SET_PREFERRED_PROVIDER' && event.data.type !== 'NSP_COACH_PROVIDER_CHECK')) return;
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  var data = event.data;
  var reqId = String(data.requestId || '').slice(0, 80);
  if (!reqId) return;
  if (data.type === 'NSP_COACH_STORAGE_GET') {
    chrome.storage.local.get(['nsp_coach_history'], function(r) {
      var hist = Array.isArray(r && r.nsp_coach_history) ? r.nsp_coach_history : [];
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, history: hist }, window.location.origin);
    });
  } else if (data.type === 'NSP_COACH_GET_PREFERRED_PROVIDER') {
    chrome.storage.local.get(['nsp_preferred_provider'], function(r) {
      var pref = r && r.nsp_preferred_provider;
      if (['openai', 'groq', 'ollama', 'gemini', 'auto'].indexOf(pref) === -1) pref = 'auto';
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, preferredProvider: pref }, window.location.origin);
    });
  } else if (data.type === 'NSP_COACH_SET_PREFERRED_PROVIDER') {
    var prefValue = String(data.provider || 'auto');
    if (['openai', 'groq', 'ollama', 'gemini', 'auto'].indexOf(prefValue) === -1) prefValue = 'auto';
    chrome.storage.local.set({ nsp_preferred_provider: prefValue }, function() {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, saved: true, preferredProvider: prefValue }, window.location.origin);
    });
  } else if (data.type === 'NSP_COACH_PROVIDER_CHECK') {
    // Reports which providers are configured without ever exposing the keys.
    chrome.storage.local.get(['nsp_groq_api_key', 'nsp_ollama_enabled', 'nsp_gemini_api_key', 'nsp_openai_api_key'], function(r) {
      var hasOpenai = !!(r && r.nsp_openai_api_key && /^sk-/.test(r.nsp_openai_api_key));
      var hasGroq = !!(r && r.nsp_groq_api_key && /^gsk_/.test(r.nsp_groq_api_key));
      var hasOllama = !!(r && r.nsp_ollama_enabled === true);
      var hasGemini = !!(r && r.nsp_gemini_api_key && /^AIza/.test(r.nsp_gemini_api_key));
      window.postMessage({
        type: 'NSP_COACH_STORAGE_RESULT',
        requestId: reqId,
        providerConfig: { hasOpenai: hasOpenai, hasGroq: hasGroq, hasOllama: hasOllama, hasGemini: hasGemini }
      }, window.location.origin);
    });
  } else if (data.type === 'NSP_COACH_SESSIONS_GET') {
    chrome.storage.local.get(['nsp_coach_sessions', 'nsp_coach_history'], function(r) {
      var sessions = Array.isArray(r && r.nsp_coach_sessions) ? r.nsp_coach_sessions : [];
      // Old installs only have nsp_coach_history, turn it into the first session.
      if (!sessions.length && Array.isArray(r && r.nsp_coach_history) && r.nsp_coach_history.length) {
        var migrated = {
          id: 'sess-migrated-' + Date.now(),
          title: 'Previous conversation',
          createdAt: Date.now() - 1000,
          updatedAt: Date.now(),
          messages: r.nsp_coach_history.slice(-100)
        };
        sessions = [migrated];
        chrome.storage.local.set({ nsp_coach_sessions: sessions });
      }
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, sessions: sessions }, window.location.origin);
    });
  } else if (data.type === 'NSP_COACH_SESSIONS_SET') {
    var newSessions = Array.isArray(data.sessions) ? data.sessions.slice(-30).map(function(s) {
      return {
        id: String(s && s.id || '').slice(0, 80),
        title: String(s && s.title || 'Conversation').slice(0, 120),
        createdAt: Number(s && s.createdAt) || Date.now(),
        updatedAt: Number(s && s.updatedAt) || Date.now(),
        messages: Array.isArray(s && s.messages) ? s.messages.slice(-100) : []
      };
    }) : [];
    chrome.storage.local.set({ nsp_coach_sessions: newSessions }, function() {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, saved: true }, window.location.origin);
    });
  } else {
    var newHist = Array.isArray(data.history) ? data.history.slice(-50) : [];
    chrome.storage.local.set({ nsp_coach_history: newHist }, function() {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, saved: true }, window.location.origin);
    });
  }
});

// On page load, check if the dashboard triggered a "Scan This Niche" action.
// If so, relay it to MAIN world so nsp-bundle.js can fire the scan.
(function checkPendingScanFromDashboard() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime) return;
  chrome.storage.local.get(['ashlyv_pending_scan'], function(res) {
    var pending = res && res.ashlyv_pending_scan;
    if (!pending || !pending.query || !pending.expiry) return;
    if (Date.now() > pending.expiry) {
      chrome.storage.local.remove('ashlyv_pending_scan');
      return;
    }
    // Clear immediately to prevent duplicate triggers. The dashboard asked for this scan, not the page, so the bridge opens its vision grant itself.
    chrome.storage.local.remove('ashlyv_pending_scan', function() {
      nspGrantAsk('vision');
      window.postMessage({
        type: 'ASHLYV_TRIGGER_SCAN',
        query: String(pending.query || '').slice(0, 2000),
        nicheId: String(pending.nicheId || '').slice(0, 200),
        languageCode: String(pending.languageCode || 'auto').slice(0, 20)
      }, window.location.origin);
    });
  });
})();

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== 'NSP_INDEX_INGEST') return;
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  var recs = Array.isArray(event.data.records) ? event.data.records.slice(0, 40) : [];
  if (!recs.length) return;
  var mkt = String(event.data.market || 'global').slice(0, 24);
  var indexKey = NSP_DATA_TOOLS.NICHE_INDEX_KEY;
  chrome.storage.local.get([indexKey], function(st) {
    var ix = (st && st[indexKey]) || { meta: { scans: 0, first: Date.now() }, niches: {} };
    if (!ix.meta) ix.meta = { scans: 0, first: Date.now() };
    if (!ix.niches) ix.niches = {};
    ix.meta.scans = (ix.meta.scans || 0) + 1;
    ix.meta.last = Date.now();
    recs.forEach(function(r) {
      if (!r || !r.t) return;
      var vNum = Number(r.v);
      if (!isFinite(vNum) || vNum < 0) vNum = 0;
      if (vNum > 10000000) vNum = 10000000;
      var tsNum = Number(r.ts);
      if (!isFinite(tsNum) || tsNum <= 0) tsNum = Date.now();
      var key = String(r.n || 'general').toLowerCase().trim().slice(0, 60) || 'general';
      var e = ix.niches[key];
      if (!e) e = ix.niches[key] = { n: String(r.n || 'general').slice(0, 60), vids: 0, vphSum: 0, vphMax: 0, best: '', ch: {}, mkts: {}, first: tsNum, last: 0, hist: [] };
      e.vids++;
      e.vphSum += vNum;
      e.last = tsNum;
      if (vNum >= e.vphMax) { e.vphMax = vNum; e.best = String(r.t || '').slice(0, 180); }
      if (r.c) {
        var cKey = String(r.c).slice(0, 60);
        e.ch[cKey] = (e.ch[cKey] || 0) + 1;
        var chKeys = Object.keys(e.ch);
        if (chKeys.length > 15) { chKeys.sort(function(a, b) { return e.ch[a] - e.ch[b]; }); delete e.ch[chKeys[0]]; }
      }
      e.mkts[mkt] = (e.mkts[mkt] || 0) + 1;
      var mkKeys = Object.keys(e.mkts);
      if (mkKeys.length > 20) { mkKeys.sort(function(a, b) { return e.mkts[a] - e.mkts[b]; }); delete e.mkts[mkKeys[0]]; }
      e.hist.push({ ts: tsNum, v: vNum });
      if (e.hist.length > 30) e.hist = e.hist.slice(-30);
    });
    var nk = Object.keys(ix.niches);
    if (nk.length > 400) {
      nk.sort(function(a, b) { return (ix.niches[a].last || 0) - (ix.niches[b].last || 0); });
      for (var d = 0; d < nk.length - 400; d++) delete ix.niches[nk[d]];
    }
    var write = {};
    write[indexKey] = ix;
    chrome.storage.local.set(write);
  });
});

var NSP_RELAY_CALLS = {
  NSP_UI_PREFS_GET: 1,
  NSP_UI_PREFS_SET: 1,
  NSP_SCAN_CONTEXT_GET: 1,
  NSP_SCAN_MARK_SEEN: 1,
  NSP_SCAN_MEMORY_CLEAR: 1,
  NSP_SAVE_CHANNEL: 1,
  NSP_SET_YT_COOKIE: 1,
  ASHLYV_SAVE_NICHO: 1,
  ASHLYV_OPPORTUNITY_HISTORY_PUSH: 1,
  ASHLYV_ALERT_PUSH: 1,
  ASHLYV_ALERT_DISMISS: 1,
  ASHLYV_ALERTS_READ: 1,
  ASHLYV_SHOW_NOTIFICATION: 1,
  ASHLYV_OPEN: 1,
  NSP_FETCH_COUNTRY_FACELESS_FEED: 1
};

var NSP_RELAY_KEYS = {
  nsp_pending_action: 1,
  nsp_watching: 1,
  nsp_all_channels: 1,
  nsp_scan_memory: 1,
  ashlyv_nichos: 1,
  ashlyv_installed_version: 1,
  ashlyv_thumbnail_history: 1,
  ashlyv_niche_stats: 1,
  ashlyv_rpm_baselines: 1,
  ashlyv_alert_history: 1,
  ashlyv_alerts_unread: 1,
  nsp_channel_faceless_v2: 1,
  ashlyv_nichos_backup: 1,
  ashlyv_phase_progress: 1,
  ashlyv_phase_ops_v1: 1,
  ashlyv_phase_notes_v1: 1,
  nsp_session_prefs: 1,
  zerack_channel_snapshots_v1: 1,
  nsp_selected_model: 1
};

// Switches and consents the page reads and only Options writes: a page that could set them could grant itself the spend they guard.
var NSP_RELAY_READONLY = {
  nsp_agent_enabled: 1,
  nsp_vision_allowed: 1
};

function nspRelayKeyAllowed(key) {
  key = String(key || '');
  if (/key|token|secret|password|auth/i.test(key)) return false;
  return NSP_RELAY_KEYS[key] === 1;
}

function nspRelayReadAllowed(key) {
  key = String(key || '');
  if (/key|token|secret|password|auth/i.test(key)) return false;
  return NSP_RELAY_KEYS[key] === 1 || NSP_RELAY_READONLY[key] === 1;
}

function nspRelayReply(reqId, payload) {
  var out = payload && typeof payload === 'object' ? payload : {};
  out.type = 'NSP_RELAY_RESULT';
  out.requestId = reqId;
  window.postMessage(out, window.location.origin);
}

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  var data = event.data;
  if (!data || (data.type !== 'NSP_RELAY_CALL' && data.type !== 'NSP_RELAY_STORAGE')) return;
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  var reqId = String(data.requestId || '').slice(0, 80);
  if (!reqId) return;

  if (data.type === 'NSP_RELAY_CALL') {
    var call = String(data.call || '');
    if (NSP_RELAY_CALLS[call] !== 1) { nspRelayReply(reqId, { ok: false, error: 'call_not_allowed' }); return; }
    var msg = {};
    if (data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
      Object.keys(data.payload).forEach(function(k) { if (k !== 'type') msg[k] = data.payload[k]; });
    }
    msg.type = call;
    nspBridgeSend(msg, function(res) {
      if (res.error === 'service_worker_unreachable' || res.error === 'bridge_send' || res.error === 'extension_reloaded') { nspRelayReply(reqId, { ok: false, error: res.error, detail: res.detail, noServiceWorker: true }); return; }
      nspRelayReply(reqId, { ok: true, res: res });
    });
    return;
  }

  var op = String(data.op || '');
  if (op === 'get') {
    var keys = (Array.isArray(data.keys) ? data.keys : [data.keys]).filter(nspRelayReadAllowed);
    if (!keys.length) { nspRelayReply(reqId, { ok: false, error: 'no_allowed_keys' }); return; }
    chrome.storage.local.get(keys, function(r) {
      nspRelayReply(reqId, { ok: true, data: r || {} });
    });
    return;
  }
  if (op === 'set') {
    var items = data.items && typeof data.items === 'object' ? data.items : {};
    var clean = {};
    Object.keys(items).forEach(function(k) { if (nspRelayKeyAllowed(k)) clean[k] = items[k]; });
    if (!Object.keys(clean).length) { nspRelayReply(reqId, { ok: false, error: 'no_allowed_keys' }); return; }
    chrome.storage.local.set(clean, function() {
      var err = chrome.runtime && chrome.runtime.lastError;
      nspRelayReply(reqId, err ? { ok: false, error: String(err.message || err) } : { ok: true });
    });
    return;
  }
  if (op === 'remove') {
    var rk = (Array.isArray(data.keys) ? data.keys : [data.keys]).filter(nspRelayKeyAllowed);
    if (!rk.length) { nspRelayReply(reqId, { ok: false, error: 'no_allowed_keys' }); return; }
    chrome.storage.local.remove(rk, function() { nspRelayReply(reqId, { ok: true }); });
    return;
  }
  nspRelayReply(reqId, { ok: false, error: 'bad_op' });
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (!msg || msg.type !== 'NSP_VOICE_TURN') return false;
  if (!sender || sender.id !== chrome.runtime.id) return false;
  var reqId = String(msg.requestId || '').slice(0, 80);
  var text = String(msg.text || '').trim().slice(0, 2000);
  if (!reqId || !text) { sendResponse({ accepted: false, code: 'bad_request' }); return false; }
  // Past this moment the service worker has already answered through the provider cascade, so running the turn too would answer twice.
  if (!(Date.now() < Number(msg.acceptBefore))) { sendResponse({ accepted: false, code: 'late' }); return false; }
  if (document.documentElement.getAttribute('data-nsp-voice-hook') !== '1') { sendResponse({ accepted: false, code: 'no_assistant' }); return false; }
  window.postMessage({ type: 'NSP_VOICE_TURN', requestId: reqId, text: text, origin: msg.origin === 'chat' ? 'chat' : 'voice', waitMs: Number(msg.waitMs) || 0 }, window.location.origin);
  sendResponse({ accepted: true });
  return false;
});

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  var data = event.data;
  if (!data || data.type !== 'NSP_VOICE_TURN_RESULT') return;
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  var reqId = String(data.requestId || '').slice(0, 80);
  if (!reqId) return;
  try {
    chrome.runtime.sendMessage({
      type: 'NSP_VOICE_TURN_DONE',
      requestId: reqId,
      ok: data.ok === true,
      answer: String(data.answer || '').slice(0, 6000),
      error: String(data.error || '').slice(0, 600)
    }, function() { void (chrome.runtime && chrome.runtime.lastError); });
  } catch (eSend) {}
});

var NSP_VOICE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
var NSP_VOICE_CARD = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, yt-lockup-view-model';

function nspVoiceRows() {
  var host = document.getElementById('nsp-shadow-host');
  var root = host && host.shadowRoot;
  return root ? Array.prototype.slice.call(root.querySelectorAll('#list [data-niche-card]')) : [];
}

function nspVoiceVideoLink(vid) {
  return document.querySelector('a[href^="/watch?v=' + vid + '"], a[href*="/watch?v=' + vid + '"], a[href^="/shorts/' + vid + '"]');
}

function nspVoiceChannelLink(vid) {
  var link = nspVoiceVideoLink(vid);
  var card = link && link.closest(NSP_VOICE_CARD);
  var links = card ? card.querySelectorAll('a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]') : [];
  for (var i = 0; i < links.length; i++) {
    if (/^https:\/\/www\.youtube\.com\/(?:@|channel\/|c\/|user\/)/.test(links[i].href)) return links[i];
  }
  return null;
}

function nspVoiceWaitFor(find, ms, done) {
  var until = Date.now() + ms;
  (function look() {
    var el = find();
    if (el || Date.now() > until) { done(el || null); return; }
    setTimeout(look, 200);
  })();
}

function nspVoiceStopAgent() {
  var host = document.getElementById('nsp-coach-host');
  var stop = host && host.shadowRoot && host.shadowRoot.getElementById('stop-btn');
  if (stop && stop.style.display !== 'none') stop.click();
}

function nspVoiceFollow(el, url) {
  setTimeout(function() {
    if (el) el.click();
    else window.location.assign(url);
  }, 30);
}

function nspVoiceAct(msg, reply) {
  var action = String(msg.action || '');
  if (action === 'stop') { nspVoiceStopAgent(); reply({ ok: true, code: 'stopped' }); return; }
  chrome.storage.local.get('nsp_agent_enabled', function(st) {
    if (chrome.runtime.lastError || !st || st.nsp_agent_enabled !== true) { reply({ ok: false, code: 'agent_needed' }); return; }
    if (action === 'scan') {
      nspVoiceWaitFor(function() { return document.getElementById('nsp-batman-scan-btn'); }, 6000, function(btn) {
        if (!btn) { reply({ ok: false, code: 'no_scan_button' }); return; }
        // A synthetic click is not a trusted press, and the voice asked for this scan, so the grant is asked here.
        nspGrantAsk('vision');
        btn.click();
        reply({ ok: true, code: 'scanning' });
      });
      return;
    }
    var n = Math.floor(Number(msg.n) || 0);
    var rows = nspVoiceRows();
    if (action === 'save' && !n) {
      var own = document.getElementById('nsp-save-btn');
      if (own) { own.click(); reply({ ok: true, code: 'saved' }); return; }
      reply({ ok: false, code: rows.length ? 'which_one' : 'nothing_to_save' });
      return;
    }
    if (!rows.length) { reply({ ok: false, code: 'no_results' }); return; }
    if (n < 1 || n > rows.length) { reply({ ok: false, code: 'no_such_result' }); return; }
    var row = rows[n - 1];
    if (action === 'save') {
      var save = row.querySelector('.save-btn');
      if (!save) { reply({ ok: false, code: 'failed' }); return; }
      save.click();
      reply({ ok: true, code: 'saved' });
      return;
    }
    var vid = String(row.getAttribute('data-video-id') || '');
    if (!NSP_VOICE_VIDEO_ID.test(vid)) { reply({ ok: false, code: 'failed' }); return; }
    if (action === 'result') {
      reply({ ok: true, code: 'open' });
      nspVoiceFollow(nspVoiceVideoLink(vid), 'https://www.youtube.com/watch?v=' + vid);
      return;
    }
    if (action === 'channel') {
      var channel = nspVoiceChannelLink(vid);
      if (!channel) { reply({ ok: false, code: 'no_channel_link', vid: vid }); return; }
      reply({ ok: true, code: 'opening_channel' });
      nspVoiceFollow(channel, channel.href);
      return;
    }
    reply({ ok: false, code: 'failed' });
  });
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (!msg || (msg.type !== 'NSP_VOICE_PING' && msg.type !== 'NSP_VOICE_ACT')) return false;
  if (!sender || sender.id !== chrome.runtime.id || sender.tab) return false;
  if (msg.type === 'NSP_VOICE_PING') { sendResponse({ ok: true }); return false; }
  nspVoiceAct(msg, sendResponse);
  return true;
});

nspBridgePost({ type: 'ASHLYV_BRIDGE_READY' });
