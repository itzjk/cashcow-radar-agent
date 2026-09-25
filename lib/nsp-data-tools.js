(function (root) {
  // Every scan adds its results here (the bridge writes it on NSP_INDEX_INGEST), so it is the scan history that lasts.
  var NICHE_INDEX_KEY = 'nsp_niche_index_v1';

  // A failed read rejects: an empty object here would tell the model the user has no data at all.
  function get(keys) {
    return new Promise(function (resolve, reject) {
      try {
        chrome.storage.local.get(keys, function (r) {
          if (chrome.runtime.lastError) reject(new Error('storage read failed: ' + chrome.runtime.lastError.message));
          else resolve(r || {});
        });
      } catch (e) { reject(e); }
    });
  }

  function failed(e) {
    return { ok: false, error: String((e && e.message) || e) };
  }

  function set(items) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set(items, function () { resolve(!chrome.runtime.lastError); });
      } catch (e) { resolve(false); }
    });
  }

  function savedNiches() {
    return get(['ashlyv_nichos']).then(function (r) {
      var list = Array.isArray(r.ashlyv_nichos) ? r.ashlyv_nichos.slice(0, 50).map(function (n) {
        return {
          title: String(n.title || '').slice(0, 200),
          channelName: String(n.channelName || '').slice(0, 100),
          niche: String(n.niche || '').slice(0, 60),
          savedAt: Number(n.savedAt) || 0,
          source: String(n.source || '')
        };
      }) : [];
      return { ok: true, count: list.length, niches: list };
    }, failed);
  }

  function summNiches(arr) {
    return (Array.isArray(arr) ? arr : []).slice(0, 60).map(function (n) {
      return { title: String(n.title || '').slice(0, 120), niche: String(n.niche || '').slice(0, 60), channel: String(n.channelName || '').slice(0, 60), vph: Math.round(Number(n.vph || 0)), views: Number(n.views || 0), rpm: Number(n.rpm || 0), savedAt: n.savedAt || 0, source: n.source || '' };
    });
  }

  function scanHistory(ix) {
    var meta = (ix && ix.meta) || {};
    var niches = ix && ix.niches && typeof ix.niches === 'object' ? Object.keys(ix.niches).map(function (k) { return ix.niches[k]; }) : [];
    niches.sort(function (a, b) { return (Number(b.last) || 0) - (Number(a.last) || 0); });
    var out = {
      scans: Number(meta.scans) || 0,
      firstScanAt: Number(meta.first) || null,
      lastScanAt: Number(meta.last) || null,
      nichesSeen: niches.length,
      recentNiches: niches.slice(0, 10).map(function (e) {
        var vids = Number(e.vids) || 0;
        return { niche: String(e.n || '').slice(0, 60), videosSeen: vids, avgVph: vids ? Math.round((Number(e.vphSum) || 0) / vids) : 0, bestVph: Math.round(Number(e.vphMax) || 0), bestTitle: String(e.best || '').slice(0, 180), lastSeenAt: Number(e.last) || null, markets: Object.keys(e.mkts || {}).slice(0, 10) };
      })
    };
    if (!out.scans) out.note = 'No scan has been recorded in this browser yet.';
    return out;
  }

  function extensionData(area) {
    area = String(area || 'all');
    return get(['ashlyv_nichos', 'ashlyv_niche_stats', NICHE_INDEX_KEY, 'ashlyv_opportunity_history', 'ashlyv_alert_history', 'ashlyv_rpm_baselines', 'nsp_tracking', 'ashlyv_tracking']).then(function (r) {
      var out = {};
      if (area === 'savedNiches' || area === 'all') {
        var nichos = Array.isArray(r.ashlyv_nichos) ? r.ashlyv_nichos : [];
        out.savedNiches = { count: nichos.length, items: summNiches(nichos) };
      }
      if (area === 'nicheStats' || area === 'all') out.nicheStats = r.ashlyv_niche_stats || {};
      if (area === 'scanHistory' || area === 'all') {
        out.scanHistory = scanHistory(r[NICHE_INDEX_KEY]);
        out.rpmBaselines = r.ashlyv_rpm_baselines || {};
      }
      if (area === 'alerts' || area === 'all') {
        var alerts = Array.isArray(r.ashlyv_alert_history) ? r.ashlyv_alert_history : [];
        out.alerts = { count: alerts.length, recent: alerts.slice(-10) };
        out.opportunityHistory = r.ashlyv_opportunity_history || {};
      }
      if (area === 'tracking' || area === 'all') {
        var tracked = Array.isArray(r.nsp_tracking) ? r.nsp_tracking : (Array.isArray(r.ashlyv_tracking) ? r.ashlyv_tracking : []);
        out.tracking = { count: tracked.length, items: tracked.slice(0, 30) };
      }
      return { ok: true, data: out };
    }, failed);
  }

  function saveNiche(nicho) {
    nicho = nicho && typeof nicho === 'object' ? nicho : {};
    return get(['ashlyv_nichos']).then(function (r) {
      var list = Array.isArray(r.ashlyv_nichos) ? r.ashlyv_nichos : [];
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
      return set({ ashlyv_nichos: list }).then(function (ok) {
        return ok ? { ok: true, totalSaved: list.length } : { ok: false, error: 'storage write failed' };
      });
    }, failed);
  }

  function addTracking(trk) {
    trk = trk && typeof trk === 'object' ? trk : {};
    return get(['ashlyv_tracking', 'nsp_tracking']).then(function (r) {
      // Two storage keys exist (legacy and current), write to whichever one already holds data.
      var key = Array.isArray(r.nsp_tracking) ? 'nsp_tracking' : 'ashlyv_tracking';
      var list = Array.isArray(r[key]) ? r[key] : [];
      list.unshift({
        title: String(trk.title || trk.channelName || '').slice(0, 240),
        channelName: String(trk.channelName || '').slice(0, 100),
        channelUrl: String(trk.channelUrl || '').slice(0, 500),
        niche: String(trk.niche || 'General').slice(0, 80),
        addedAt: Date.now(),
        source: 'agent'
      });
      if (list.length > 100) list.length = 100;
      var items = {};
      items[key] = list;
      return set(items).then(function (ok) {
        return ok ? { ok: true, tracking: list.length } : { ok: false, error: 'storage write failed' };
      });
    }, failed);
  }

  function exportNiches(format) {
    var fmt = String(format || 'csv').toLowerCase() === 'json' ? 'json' : 'csv';
    return get(['ashlyv_nichos']).then(function (r) {
      var list = Array.isArray(r.ashlyv_nichos) ? r.ashlyv_nichos : [];
      if (!list.length) return { ok: false, error: 'No saved niches to export' };
      if (fmt === 'json') return { ok: true, exported: list.length, filename: 'nsp-niches-' + Date.now() + '.json', mime: 'application/json', text: JSON.stringify(list, null, 2) };
      var headers = ['title', 'channelName', 'niche', 'channelUrl', 'vidId', 'savedAt', 'source'];
      var rows = [headers.join(',')];
      list.forEach(function (n) {
        rows.push(headers.map(function (h) { return '"' + String(n[h] == null ? '' : n[h]).replace(/"/g, '""') + '"'; }).join(','));
      });
      return { ok: true, exported: list.length, filename: 'nsp-niches-' + Date.now() + '.csv', mime: 'text/csv', text: rows.join('\n') };
    }, failed);
  }

  root.NSP_DATA_TOOLS = Object.freeze({
    NICHE_INDEX_KEY: NICHE_INDEX_KEY,
    savedNiches: savedNiches,
    extensionData: extensionData,
    saveNiche: saveNiche,
    addTracking: addTracking,
    exportNiches: exportNiches
  });
})(typeof self !== 'undefined' ? self : this);
