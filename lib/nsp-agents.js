(function (root) {
  var owns = Object.prototype.hasOwnProperty;
  if (owns.call(root, 'NSP_AGENTS')) return;

  var KEY = 'nsp_agent_picks';
  var MAX_PICKS = 300;
  var NO_SITE = '*';
  var ORDER = ['youtube', 'shopify', 'etsy', 'amazon', 'creators', 'freelance', 'local', 'seo', 'newsletter', 'digital', 'builders'];
  var YOUTUBE_HOST = /(^|\.)youtube\.com$/;
  var HOST = /^(?:[a-z0-9-]{1,63}\.)*[a-z0-9-]{1,63}$|^\[[0-9a-f:.]{2,45}\]$/;
  var YOUTUBE = {
    id: 'youtube',
    name: 'YouTube agent',
    does: 'Reads channels and your Studio; decides why a channel grew, your next video, titles and thumbnails, and what a niche pays.',
    sites: ['youtube.com', 'studio.youtube.com'],
    playbook: ''
  };

  function playbooks() {
    var P = owns.call(root, 'NSP_PLAYBOOKS') ? root.NSP_PLAYBOOKS : null;
    return P && typeof P.get === 'function' ? P : null;
  }

  function entry(id) {
    if (id === 'youtube') return { id: YOUTUBE.id, name: YOUTUBE.name, does: YOUTUBE.does, sites: YOUTUBE.sites.slice(), playbook: '' };
    var P = playbooks();
    var pb = P ? P.get(id) : null;
    if (!pb || !pb.agent || !pb.agent.name) return null;
    return { id: pb.id, name: String(pb.agent.name), does: String(pb.agent.does || ''), sites: (pb.agent.sites || []).slice(0, 10).map(String), playbook: pb.id };
  }

  function get(id) {
    id = String(id || '').toLowerCase();
    return ORDER.indexOf(id) >= 0 ? entry(id) : null;
  }

  function list() {
    return ORDER.map(entry).filter(Boolean);
  }

  function title(id) {
    var a = get(id);
    return a ? 'ZERACK ' + a.name : 'ZERACK';
  }

  function hostKey(host) {
    host = String(host == null ? '' : host).toLowerCase().replace(/\.$/, '');
    if (!host || host === NO_SITE) return NO_SITE;
    return host.length <= 255 && HOST.test(host) ? host : '';
  }

  function clean(map) {
    var out = {};
    if (!map || typeof map !== 'object') return out;
    Object.keys(map).forEach(function (host) {
      var e = map[host];
      var key = hostKey(host);
      if (!key || key !== host || !e || typeof e !== 'object' || !get(e.agent)) return;
      out[key] = { agent: String(e.agent).toLowerCase(), since: Number(e.since) || 0 };
    });
    return out;
  }

  function withPick(map, host, id, now) {
    var out = clean(map);
    var key = hostKey(host);
    if (!key) return out;
    id = String(id || '').toLowerCase();
    if (!id || id === 'auto' || !get(id)) {
      delete out[key];
      return out;
    }
    out[key] = { agent: id, since: Number(now) || Date.now() };
    var keys = Object.keys(out);
    if (keys.length > MAX_PICKS) {
      keys.sort(function (a, b) { return out[a].since - out[b].since; }).slice(0, keys.length - MAX_PICKS).forEach(function (k) { delete out[k]; });
    }
    return out;
  }

  function pickIn(map, host) {
    var key = hostKey(host);
    var e = key ? clean(map)[key] : null;
    return e ? e.agent : '';
  }

  function auto(site) {
    var host = site && typeof site === 'object' ? String(site.host || '').toLowerCase() : '';
    if (!host || YOUTUBE_HOST.test(host)) return 'youtube';
    var id = String(site.playbook || '');
    if (id && id !== 'youtube' && get(id)) return id;
    var P = playbooks();
    var path = '/';
    try { path = new URL(String(site.url || '')).pathname || '/'; } catch (e) { path = '/'; }
    var found = P && typeof P.forHost === 'function' ? P.forHost(host, path) : '';
    return found && get(found) ? found : '';
  }

  function resolve(site, map) {
    var host = site && typeof site === 'object' ? site.host : '';
    var byHost = auto(site);
    var picked = pickIn(map, host);
    if (picked) return { id: picked, how: 'picked', auto: byHost };
    return { id: byHost, how: byHost ? 'site' : 'none', auto: byHost };
  }

  function roster() {
    return list().map(function (a) { return { id: a.id, name: a.name, does: a.does, sites: a.sites.slice(0, 6), more: Math.max(0, a.sites.length - 6) }; });
  }

  function load() {
    return new Promise(function (resolve) {
      try {
        root.chrome.storage.local.get(KEY, function (r) {
          resolve(clean(!root.chrome.runtime.lastError && r ? r[KEY] : null));
        });
      } catch (e) { resolve({}); }
    });
  }

  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
    }
    return o;
  }

  freeze(YOUTUBE);

  Object.defineProperty(root, 'NSP_AGENTS', {
    value: freeze({
      key: KEY,
      noSite: NO_SITE,
      ids: ORDER.slice(),
      get: get,
      list: list,
      roster: roster,
      title: title,
      hostKey: hostKey,
      clean: clean,
      withPick: withPick,
      pickIn: pickIn,
      auto: auto,
      resolve: resolve,
      load: load
    }),
    writable: false,
    configurable: false
  });
})(typeof self !== 'undefined' ? self : this);
