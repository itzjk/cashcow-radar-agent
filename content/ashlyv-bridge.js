// ashlyv-bridge.js — ISOLATED world

// ── NSP BRIDGE: expose chrome.runtime.getURL to MAIN world via DOM attribute ──
// MV3 MAIN world content scripts do NOT have access to chrome.runtime.* APIs.
// MAIN reads `document.documentElement.getAttribute('data-nsp-faceapi-url')` to
// build chrome-extension:// URLs needed by face-api.js model loader.
try {
  document.documentElement.setAttribute('data-nsp-faceapi-url', chrome.runtime.getURL('lib/face-api/'));
  document.documentElement.setAttribute('data-nsp-ext-id', chrome.runtime.id);
  console.log('[NSP bridge] modelUrl exposed to MAIN:', chrome.runtime.getURL('lib/face-api/'));
} catch(eBridgeUrl) { console.warn('[NSP bridge] failed to expose modelUrl:', eBridgeUrl && eBridgeUrl.message); }

function ashlyvBridgeSanitizeEntry(entry) {
  entry = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
  function cleanText(value, max) { return String(value || '').replace(/[<>]/g, '').slice(0, max || 200); }
  function cleanNum(value, max) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) n = 0;
    if (typeof max === 'number' && n > max) n = max;
    return n;
  }
  return {
    title: cleanText(entry.title, 240),
    niche: cleanText(entry.niche || 'General', 160),
    nicheId: cleanText(entry.nicheId, 80),
    language: cleanText(entry.language || 'unknown', 40),
    channelUrl: /^https:\/\/(www\.)?youtube\.com\//i.test(String(entry.channelUrl || '')) ? String(entry.channelUrl).slice(0, 500) : '',
    channelId: cleanText(entry.channelId, 120),
    vidId: cleanText(entry.vidId, 40),
    thumbUrl: /^https:\/\/i\.ytimg\.com\//i.test(String(entry.thumbUrl || '')) ? String(entry.thumbUrl).slice(0, 500) : '',
    subs: cleanNum(entry.subs, 1000000000),
    views: cleanNum(entry.views, 100000000000),
    revMonth: cleanNum(entry.revMonth, 1000000000),
    totalRev: cleanNum(entry.totalRev, 1000000000),
    vph: cleanNum(entry.vph, 1000000000),
    rpm: cleanNum(entry.rpm, 1000),
    os: cleanNum(entry.os, 1000000000),
    facelessScore: cleanNum(entry.facelessScore || 50, 100),
    facelessClassification: cleanText(entry.facelessClassification || 'borderline', 40),
    savedAt: cleanNum(entry.savedAt || Date.now(), Date.now() + 60000),
    source: cleanText(entry.source || 'bridge', 80)
  };
}

function ashlyvBridgeOpenDashboard(url) {
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  chrome.runtime.sendMessage({ type: 'ASHLYV_OPEN', url: url }, function(res) {
    var shouldFallback = false;
    try {
      var err = chrome.runtime && chrome.runtime.lastError;
      if (err) shouldFallback = true;
      if (res && res.ok) shouldFallback = false;
      else if (!res || res.ok !== true) shouldFallback = true;
    } catch(e) {
      shouldFallback = true;
    }
    if (shouldFallback) {
      try { window.open(url, '_blank', 'noopener'); } catch(e2) {}
    }
  });
}

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== 'ASHLYV_OPEN_URL') return;
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  var trustedInternal = event.data.ashlyvInternal && event.data.ashlyvInternal === chrome.runtime.id;
  var trustedBridgeRequest = event.data.ashlyvBridgeRequest === true;
  if (!trustedInternal && !trustedBridgeRequest) return;

  var nichoData = event.data.nichoData;
  var allNichos = event.data.allNichos;
  var openPage = event.data.openPage;

  chrome.storage.local.get(['ashlyv_nichos'], function(res) {
    var saved = Array.isArray(res.ashlyv_nichos) ? res.ashlyv_nichos.map(ashlyvBridgeSanitizeEntry).slice(0, 240) : [];

    var toSave = (Array.isArray(allNichos) ? allNichos.slice(0, 20) : (nichoData ? [nichoData] : [])).map(ashlyvBridgeSanitizeEntry);
    toSave.forEach(function(n) {
      var incomingKey = [n.channelId || '', n.channelUrl || '', n.vidId || '', n.title || '', n.savedAt || ''].join('|');
      var isDupe = saved.some(function(s) {
        return [s.channelId || '', s.channelUrl || '', s.vidId || '', s.title || '', s.savedAt || ''].join('|') === incomingKey;
      });
      if (!isDupe) saved.unshift(n);
    });

    if (saved.length > 240) saved.length = 240;

    var payload = { ashlyv_nichos: saved };
    try {
      while (saved.length > 20 && JSON.stringify(payload).length > 102400) {
        saved.length = Math.floor(saved.length * 0.8);
        payload = { ashlyv_nichos: saved };
      }
      if (JSON.stringify(payload).length > 102400) {
        window.postMessage({ type: 'ASHLYV_SAVE_RESULT', ok: false, error: 'storage_full' }, window.location.origin);
        return;
      }
    } catch (e) {
      window.postMessage({ type: 'ASHLYV_SAVE_RESULT', ok: false, error: 'storage_error' }, window.location.origin);
      return;
    }
    chrome.storage.local.set(payload, function() {
      if (openPage) {
        var base = chrome.runtime.getURL('ashlyv/ashlyv.html');
        if (typeof event.data.channelQuery === 'string') base += '?channel=' + encodeURIComponent(event.data.channelQuery.slice(0, 500));
        if (typeof event.data.urlQuery === 'string' && /^https:\/\/(www\.)?youtube\.com\//i.test(event.data.urlQuery)) base += (base.indexOf('?') > -1 ? '&' : '?') + 'url=' + encodeURIComponent(event.data.urlQuery.slice(0, 500));
        ashlyvBridgeOpenDashboard(base);
      }
    });
  });
});

// ── NSP AI COACH bridge ──────────────────────────────────────────────────────
console.log('[NSP COACH BRIDGE] isolated bridge loaded, listeners ready');
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== 'NSP_COACH_SEND') return;
  console.log('[NSP COACH BRIDGE] NSP_COACH_SEND received, reqId:', event.data.requestId);
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.warn('[NSP COACH BRIDGE] chrome.runtime not available');
    return;
  }
  var data = event.data;
  var reqId = String(data.requestId || '').slice(0, 80);
  if (!reqId) return;
  var messages = Array.isArray(data.messages) ? data.messages.slice(-50) : [];
  if (!messages.length) {
    window.postMessage({ type: 'NSP_COACH_RESPONSE', requestId: reqId, ok: false, error: 'no_messages' }, window.location.origin);
    return;
  }
  console.log('[NSP COACH BRIDGE] calling SW ASHLYV_CHAT_REQUEST with', messages.length, 'msgs');
  try {   // sendMessage throws synchronously when the service worker is gone, without this the coach hangs forever with no answer.
  chrome.runtime.sendMessage({
    type: 'ASHLYV_CHAT_REQUEST',
    payload: {
      messages: messages,
      // The full system prompt is sent, the service worker trims it per provider.
      system: typeof data.system === 'string' ? data.system.slice(0, 24000) : '',
      model: typeof data.model === 'string' ? data.model : 'gemini-1.5-flash',
      maxTokens: Number(data.maxTokens) || 2048,
      tools: Array.isArray(data.tools) ? data.tools : undefined
    }
  }, function(res) {
    var err = chrome.runtime && chrome.runtime.lastError;
    if (err) {
      console.warn('[NSP COACH BRIDGE] SW lastError:', err.message);
      window.postMessage({ type: 'NSP_COACH_RESPONSE', requestId: reqId, ok: false, error: String(err.message || err) }, window.location.origin);
      return;
    }
    if (!res || res.ok !== true) {
      console.warn('[NSP COACH BRIDGE] SW response not ok:', res && res.error);
      var errPayload = { type: 'NSP_COACH_RESPONSE', requestId: reqId, ok: false, error: (res && res.error) || 'unknown_error' };
      if (res && res.retryAfter) errPayload.retryAfter = res.retryAfter;
      window.postMessage(errPayload, window.location.origin);
      return;
    }
    console.log('[NSP COACH BRIDGE] SW response OK:', { text: (res.text || '').length, calls: (res.functionCalls || []).length });
    window.postMessage({
      type: 'NSP_COACH_RESPONSE',
      requestId: reqId,
      ok: true,
      text: String(res.text || ''),
      functionCalls: Array.isArray(res.functionCalls) ? res.functionCalls : []
    }, window.location.origin);
  });
  } catch (eSend) {
    // Answer with an error instead of leaving the coach waiting when the service worker is unreachable.
    window.postMessage({ type: 'NSP_COACH_RESPONSE', requestId: reqId, ok: false, error: 'bridge_send: ' + String((eSend && eSend.message) || eSend) }, window.location.origin);
  }
});

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== 'NSP_VISION_JUDGE') return;
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  var data = event.data;
  var reqId = String(data.requestId || '').slice(0, 80);
  if (!reqId) return;
  try {
    chrome.runtime.sendMessage({
      type: 'ASHLYV_VISION_JUDGE',
      payload: {
        thumbs: Array.isArray(data.thumbs) ? data.thumbs.slice(0, 4) : [],
        thumb: typeof data.thumb === 'string' ? data.thumb : '',
        title: typeof data.title === 'string' ? data.title.slice(0, 300) : '',
        channel: typeof data.channel === 'string' ? data.channel.slice(0, 160) : ''
      }
    }, function(res) {
      var err = chrome.runtime && chrome.runtime.lastError;
      if (err) { window.postMessage({ type: 'NSP_VISION_JUDGE_RESPONSE', requestId: reqId, ok: false, error: String(err.message || err) }, window.location.origin); return; }
      if (!res || res.ok !== true) { window.postMessage({ type: 'NSP_VISION_JUDGE_RESPONSE', requestId: reqId, ok: false, error: (res && res.error) || 'unknown_error' }, window.location.origin); return; }
      window.postMessage({ type: 'NSP_VISION_JUDGE_RESPONSE', requestId: reqId, ok: true, verdict: res.verdict || null }, window.location.origin);
    });
  } catch (eSend) {
    window.postMessage({ type: 'NSP_VISION_JUDGE_RESPONSE', requestId: reqId, ok: false, error: 'bridge_send: ' + String((eSend && eSend.message) || eSend) }, window.location.origin);
  }
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
    var incoming = Array.isArray(event.data.records) ? event.data.records : [];
    chrome.storage.local.get(['nsp_title_corpus'], function(r) {
      var corpus = Array.isArray(r && r.nsp_title_corpus) ? r.nsp_title_corpus : [];
      var byKey = {};
      corpus.forEach(function(rec) { if (rec && rec.t) byKey[String(rec.t).toLowerCase().slice(0, 80)] = rec; });
      incoming.forEach(function(rec) {
        if (!rec || !rec.t) return;
        var k = String(rec.t).toLowerCase().slice(0, 80);
        var ex = byKey[k];
        // On a duplicate title keep the higher VPH record, it is the better performance signal.
        if (!ex || Number(rec.v || 0) > Number(ex.v || 0)) byKey[k] = rec;
      });
      var merged = Object.keys(byKey).map(function(k) { return byKey[k]; });
      merged.sort(function(a, b) { return Number(b.v || 0) - Number(a.v || 0); });
      if (merged.length > CORPUS_CAP) merged = merged.slice(0, CORPUS_CAP);
      chrome.storage.local.set({ nsp_title_corpus: merged }, function() {
        window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: cReqId, ok: true, corpusSize: merged.length }, window.location.origin);
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
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: cReqId, ok: true, niche: qNiche, total: filtered.length, corpusTotal: corpus.length, winners: filtered.slice(0, limit) }, window.location.origin);
    });
    return;
  }

  if (ct === 'NSP_CORPUS_STATS') {
    chrome.storage.local.get(['nsp_title_corpus'], function(r) {
      var corpus = Array.isArray(r && r.nsp_title_corpus) ? r.nsp_title_corpus : [];
      var byNiche = {};
      corpus.forEach(function(rec) { if (rec && rec.n) byNiche[rec.n] = (byNiche[rec.n] || 0) + 1; });
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: cReqId, ok: true, total: corpus.length, byNiche: byNiche }, window.location.origin);
    });
    return;
  }
});

// MAIN has no chrome.tabs.* access, so these tool messages are relayed to the service worker.
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.origin && event.origin !== window.location.origin) return;
  if (!event.data) return;
  var t = event.data.type;
  if (t !== 'NSP_COACH_TOOL_OPENTAB' && t !== 'NSP_COACH_TOOL_NAVIGATE' && t !== 'NSP_COACH_TOOL_SAVENICHE' && t !== 'NSP_COACH_TOOL_LISTTABS' && t !== 'NSP_COACH_TOOL_SWITCHTAB' && t !== 'NSP_COACH_TOOL_CLOSETAB' && t !== 'NSP_COACH_TOOL_GETSAVED' && t !== 'NSP_COACH_TOOL_FETCHURL' && t !== 'NSP_COACH_TOOL_SEARCH_MARKET' && t !== 'NSP_COACH_TOOL_CHANNEL_STATS' && t !== 'NSP_COACH_TOOL_CHANNEL_VIDEOS' && t !== 'NSP_COACH_TOOL_EXPORT_NICHES' && t !== 'NSP_COACH_TOOL_ADD_TRACKING' && t !== 'NSP_COACH_TOOL_EXT_DATA') return;
  if (typeof chrome === 'undefined' || !chrome.runtime) return;
  var reqId = String(event.data.requestId || '').slice(0, 80);
  if (!reqId) return;

  if (t === 'NSP_COACH_TOOL_EXT_DATA') {
    var area = String(event.data.area || 'all');
    chrome.storage.local.get(['ashlyv_nichos', 'ashlyv_niche_stats', 'ashlyv_recent_scan_runs_v', 'ashlyv_opportunity_history', 'ashlyv_alert_history', 'ashlyv_rpm_baselines'], function(r) {
      r = r || {};
      var out = {};
      function summNiches(arr) {
        return (Array.isArray(arr) ? arr : []).slice(0, 60).map(function(n) {
          return { title: String(n.title || '').slice(0, 120), niche: String(n.niche || '').slice(0, 60), channel: String(n.channelName || '').slice(0, 60), vph: Math.round(Number(n.vph || 0)), views: Number(n.views || 0), rpm: Number(n.rpm || 0), savedAt: n.savedAt || 0, source: n.source || '' };
        });
      }
      if (area === 'savedNiches' || area === 'all') {
        var nichos = Array.isArray(r.ashlyv_nichos) ? r.ashlyv_nichos : [];
        out.savedNiches = { count: nichos.length, items: summNiches(nichos) };
      }
      if (area === 'nicheStats' || area === 'all') {
        out.nicheStats = r.ashlyv_niche_stats || {};
      }
      if (area === 'scanHistory' || area === 'all') {
        var runs = Array.isArray(r.ashlyv_recent_scan_runs_v) ? r.ashlyv_recent_scan_runs_v : [];
        out.scanHistory = { count: runs.length, recent: runs.slice(-10) };
        out.rpmBaselines = r.ashlyv_rpm_baselines || {};
      }
      if (area === 'alerts' || area === 'all') {
        var alerts = Array.isArray(r.ashlyv_alert_history) ? r.ashlyv_alert_history : [];
        out.alerts = { count: alerts.length, recent: alerts.slice(-10) };
        out.opportunityHistory = r.ashlyv_opportunity_history || {};
      }
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: true, data: out }, window.location.origin);
    });
    return;
  }

  if (t === 'NSP_COACH_TOOL_OPENTAB') {
    var url = String(event.data.url || '');
    if (!/^https:\/\//i.test(url)) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: false, error: 'invalid_url' }, window.location.origin);
      return;
    }
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_OPEN_TAB', url: url }, function(res) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: !!(res && res.ok), tabId: res && res.tabId, error: res && res.error }, window.location.origin);
    });
    return;
  }

  if (t === 'NSP_COACH_TOOL_SEARCH_MARKET') {
    var mq = String(event.data.query || '').slice(0, 120);
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_SEARCH_MARKET', query: mq, gl: event.data.gl || 'US', hl: event.data.hl || 'en' }, function(res) {
      var err = chrome.runtime && chrome.runtime.lastError;
      if (err) { window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: false, error: String(err.message || err) }, window.location.origin); return; }
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: !!(res && res.ok), videos: (res && res.videos) || [], error: res && res.error }, window.location.origin);
    });
    return;
  }

  if (t === 'NSP_COACH_TOOL_NAVIGATE') {
    var navUrl = String(event.data.url || '');
    if (!/^https:\/\/(www\.)?youtube\.com\//i.test(navUrl)) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: false, error: 'only youtube.com URLs are allowed' }, window.location.origin);
      return;
    }
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_NAVIGATE', url: navUrl }, function(res) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: !!(res && res.ok), error: res && res.error }, window.location.origin);
    });
    return;
  }

  if (t === 'NSP_COACH_TOOL_LISTTABS') {
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_LIST_TABS' }, function(res) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: !!(res && res.ok), tabs: res && res.tabs, error: res && res.error }, window.location.origin);
    });
    return;
  }
  if (t === 'NSP_COACH_TOOL_SWITCHTAB') {
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_SWITCH_TAB', tabId: Number(event.data.tabId) || 0 }, function(res) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: !!(res && res.ok), error: res && res.error }, window.location.origin);
    });
    return;
  }
  if (t === 'NSP_COACH_TOOL_CLOSETAB') {
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_CLOSE_TAB', tabId: Number(event.data.tabId) || 0 }, function(res) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: !!(res && res.ok), error: res && res.error }, window.location.origin);
    });
    return;
  }
  if (t === 'NSP_COACH_TOOL_GETSAVED') {
    chrome.storage.local.get(['ashlyv_nichos'], function(r) {
      var list = Array.isArray(r && r.ashlyv_nichos) ? r.ashlyv_nichos.slice(0, 50).map(function(n) {
        return {
          title: String(n.title || '').slice(0, 200),
          channelName: String(n.channelName || '').slice(0, 100),
          niche: String(n.niche || '').slice(0, 60),
          savedAt: Number(n.savedAt) || 0,
          source: String(n.source || '')
        };
      }) : [];
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: true, count: list.length, niches: list }, window.location.origin);
    });
    return;
  }
  if (t === 'NSP_COACH_TOOL_FETCHURL') {
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_FETCH_URL', url: String(event.data.url || '') }, function(res) {
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: !!(res && res.ok), text: res && res.text, status: res && res.status, error: res && res.error }, window.location.origin);
    });
    return;
  }

  if (t === 'NSP_COACH_TOOL_SAVENICHE') {
    var nicho = event.data.nicho || {};
    chrome.storage.local.get(['ashlyv_nichos'], function(r) {
      var list = Array.isArray(r && r.ashlyv_nichos) ? r.ashlyv_nichos : [];
      list.unshift({
        title: String(nicho.title || '').slice(0, 240),
        niche: String(nicho.niche || 'General').slice(0, 80),
        channelUrl: /^https:\/\/(www\.)?youtube\.com\//i.test(String(nicho.channelUrl || '')) ? String(nicho.channelUrl).slice(0, 500) : '',
        channelName: String(nicho.channelName || '').slice(0, 100),
        vidId: String(nicho.vidId || '').slice(0, 40),
        savedAt: Date.now(),
        source: 'agent'
      });
      if (list.length > 240) list.length = 240;
      chrome.storage.local.set({ ashlyv_nichos: list }, function() {
        window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: true, totalSaved: list.length }, window.location.origin);
      });
    });
    return;
  }

  // ─── v3.9.0 GOD-TIER bridge handlers ───
  if (t === 'NSP_COACH_TOOL_CHANNEL_STATS') {
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_CHANNEL_STATS', channelUrl: String(event.data.channelUrl || '') }, function(res) {
      window.postMessage(Object.assign({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId }, res || { ok: false, error: 'no_response' }), window.location.origin);
    });
    return;
  }
  if (t === 'NSP_COACH_TOOL_CHANNEL_VIDEOS') {
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_CHANNEL_VIDEOS', channelUrl: String(event.data.channelUrl || '') }, function(res) {
      window.postMessage(Object.assign({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId }, res || { ok: false, error: 'no_response' }), window.location.origin);
    });
    return;
  }
  if (t === 'NSP_COACH_TOOL_EXPORT_NICHES') {
    var fmt = String(event.data.format || 'csv').toLowerCase();
    chrome.storage.local.get(['ashlyv_nichos'], function(r) {
      var list = Array.isArray(r && r.ashlyv_nichos) ? r.ashlyv_nichos : [];
      if (!list.length) {
        window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: false, error: 'No saved niches to export' }, window.location.origin);
        return;
      }
      var blob, filename;
      if (fmt === 'json') {
        blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        filename = 'nsp-niches-' + Date.now() + '.json';
      } else {
        var headers = ['title', 'channelName', 'niche', 'channelUrl', 'vidId', 'savedAt', 'source'];
        var rows = [headers.join(',')];
        list.forEach(function(n) {
          var row = headers.map(function(h) {
            var v = String(n[h] == null ? '' : n[h]).replace(/"/g, '""');
            return '"' + v + '"';
          });
          rows.push(row.join(','));
        });
        blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        filename = 'nsp-niches-' + Date.now() + '.csv';
      }
      try {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
        window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: true, exported: list.length, filename: filename }, window.location.origin);
      } catch(eDl) {
        window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: false, error: 'download failed: ' + eDl.message }, window.location.origin);
      }
    });
    return;
  }
  if (t === 'NSP_COACH_TOOL_ADD_TRACKING') {
    var trk = event.data.nicho || {};
    chrome.storage.local.get(['ashlyv_tracking', 'nsp_tracking'], function(r) {
      // Two storage keys exist (legacy and current), write to whichever one already holds data.
      var key = Array.isArray(r && r.nsp_tracking) ? 'nsp_tracking' : 'ashlyv_tracking';
      var list = Array.isArray(r && r[key]) ? r[key] : [];
      list.unshift({
        title: String(trk.title || trk.channelName || '').slice(0, 240),
        channelName: String(trk.channelName || '').slice(0, 100),
        channelUrl: String(trk.channelUrl || '').slice(0, 500),
        niche: String(trk.niche || 'General').slice(0, 80),
        addedAt: Date.now(),
        source: 'agent'
      });
      if (list.length > 100) list.length = 100;
      var setObj = {}; setObj[key] = list;
      chrome.storage.local.set(setObj, function() {
        window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, ok: true, tracking: list.length }, window.location.origin);
      });
    });
    return;
  }
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
      if (['groq', 'ollama', 'gemini', 'auto'].indexOf(pref) === -1) pref = 'auto';
      window.postMessage({ type: 'NSP_COACH_STORAGE_RESULT', requestId: reqId, preferredProvider: pref }, window.location.origin);
    });
  } else if (data.type === 'NSP_COACH_SET_PREFERRED_PROVIDER') {
    var prefValue = String(data.provider || 'auto');
    if (['groq', 'ollama', 'gemini', 'auto'].indexOf(prefValue) === -1) prefValue = 'auto';
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
    // Clear immediately to prevent duplicate triggers
    chrome.storage.local.remove('ashlyv_pending_scan', function() {
      window.postMessage({
        type: 'ASHLYV_TRIGGER_SCAN',
        ashlyvInternal: chrome.runtime.id,
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
  chrome.storage.local.get(['nsp_niche_index_v1'], function(st) {
    var ix = (st && st.nsp_niche_index_v1) || { meta: { scans: 0, first: Date.now() }, niches: {} };
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
    chrome.storage.local.set({ nsp_niche_index_v1: ix });
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
  NSP_FETCH_COUNTRY_FACELESS_FEED: 1,
  ASHLYV_CHAT_REQUEST: 1
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
  nsp_selected_model: 1,
  nsp_vision_allowed: 1,
  ashlyv_thumbnail_consent: 1
};

function nspRelayKeyAllowed(key) {
  key = String(key || '');
  if (/key|token|secret|password|auth/i.test(key)) return false;
  return NSP_RELAY_KEYS[key] === 1;
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
    try {
      chrome.runtime.sendMessage(msg, function(res) {
        var err = chrome.runtime && chrome.runtime.lastError;
        if (err) { nspRelayReply(reqId, { ok: false, error: String(err.message || err), noServiceWorker: true }); return; }
        nspRelayReply(reqId, { ok: true, res: res || { ok: false } });
      });
    } catch (e) {
      nspRelayReply(reqId, { ok: false, error: String(e && e.message || e) });
    }
    return;
  }

  var op = String(data.op || '');
  if (op === 'get') {
    var keys = (Array.isArray(data.keys) ? data.keys : [data.keys]).filter(nspRelayKeyAllowed);
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

try { window.postMessage({ type: 'ASHLYV_BRIDGE_READY' }, window.location.origin); } catch (eReady) {}
