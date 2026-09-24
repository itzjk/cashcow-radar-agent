(function (root) {
  function get(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (r) { resolve(chrome.runtime.lastError ? {} : (r || {})); });
      } catch (e) { resolve({}); }
    });
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
    });
  }

  function summNiches(arr) {
    return (Array.isArray(arr) ? arr : []).slice(0, 60).map(function (n) {
      return { title: String(n.title || '').slice(0, 120), niche: String(n.niche || '').slice(0, 60), channel: String(n.channelName || '').slice(0, 60), vph: Math.round(Number(n.vph || 0)), views: Number(n.views || 0), rpm: Number(n.rpm || 0), savedAt: n.savedAt || 0, source: n.source || '' };
    });
  }

  function extensionData(area) {
    area = String(area || 'all');
    return get(['ashlyv_nichos', 'ashlyv_niche_stats', 'ashlyv_recent_scan_runs_v', 'ashlyv_opportunity_history', 'ashlyv_alert_history', 'ashlyv_rpm_baselines']).then(function (r) {
      var out = {};
      if (area === 'savedNiches' || area === 'all') {
        var nichos = Array.isArray(r.ashlyv_nichos) ? r.ashlyv_nichos : [];
        out.savedNiches = { count: nichos.length, items: summNiches(nichos) };
      }
      if (area === 'nicheStats' || area === 'all') out.nicheStats = r.ashlyv_niche_stats || {};
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
      return { ok: true, data: out };
    });
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
    });
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
    });
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
    });
  }

  root.NSP_DATA_TOOLS = Object.freeze({
    savedNiches: savedNiches,
    extensionData: extensionData,
    saveNiche: saveNiche,
    addTracking: addTracking,
    exportNiches: exportNiches
  });
})(typeof self !== 'undefined' ? self : this);
