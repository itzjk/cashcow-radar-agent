(function (root) {
  if (Object.prototype.hasOwnProperty.call(root, 'NSP_SITES')) return;

  var KEY = 'nsp_agent_sites';
  var MODES = { read: 1, act: 1 };
  var MAX_SITES = 300;
  var YOUTUBE = /(^|\.)youtube\.com$/;
  var NO_SCRIPT = /^https:\/\/(?:chromewebstore\.google\.com|chrome\.google\.com\/webstore)(?:[\/?#]|$)/;
  var HOST = /^(?:[a-z0-9-]{1,63}\.)*[a-z0-9-]{1,63}$|^\[[0-9a-f:.]{2,45}\]$/;

  function parse(url) {
    var u;
    try { u = new URL(String(url || '')); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!HOST.test(u.hostname.toLowerCase())) return null;
    return u;
  }

  function hostOf(url) {
    var u = parse(url);
    return u ? u.hostname.toLowerCase() : '';
  }

  function patternOf(url) {
    var u = parse(url);
    return u ? u.protocol + '//' + u.hostname.toLowerCase() + '/*' : '';
  }

  function scriptable(url) {
    var u = parse(url);
    return !!u && !NO_SCRIPT.test(u.href);
  }

  function isYouTube(host) {
    return YOUTUBE.test(String(host || '').toLowerCase());
  }

  function playbookFor(host) {
    return isYouTube(host) ? 'youtube' : 'web';
  }

  function validHost(host) {
    return typeof host === 'string' && host.length <= 255 && HOST.test(host);
  }

  function clean(map) {
    var out = {};
    if (!map || typeof map !== 'object') return out;
    Object.keys(map).forEach(function (host) {
      var e = map[host];
      if (!validHost(host) || !e || typeof e !== 'object' || MODES[e.mode] !== 1) return;
      out[host] = { mode: e.mode, playbook: typeof e.playbook === 'string' ? e.playbook.slice(0, 40) : playbookFor(host), since: Number(e.since) || 0 };
    });
    return out;
  }

  function accessIn(map, host) {
    var e = clean(map)[String(host || '').toLowerCase()];
    return e ? e.mode : 'none';
  }

  function allows(access, need) {
    if (need === 'read') return access === 'read' || access === 'act';
    return access === 'act';
  }

  function withSite(map, host, mode, now) {
    var out = clean(map);
    host = String(host || '').toLowerCase();
    if (!validHost(host) || MODES[mode] !== 1) return out;
    out[host] = { mode: mode, playbook: playbookFor(host), since: Number(now) || Date.now() };
    var hosts = Object.keys(out);
    if (hosts.length > MAX_SITES) {
      hosts.sort(function (a, b) { return out[a].since - out[b].since; }).slice(0, hosts.length - MAX_SITES).forEach(function (h) { delete out[h]; });
    }
    return out;
  }

  function withoutSite(map, host) {
    var out = clean(map);
    delete out[String(host || '').toLowerCase()];
    return out;
  }

  function load() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(KEY, function (r) {
          resolve(clean(!chrome.runtime.lastError && r ? r[KEY] : null));
        });
      } catch (e) { resolve({}); }
    });
  }

  root.NSP_SITES = Object.freeze({
    key: KEY,
    parse: parse,
    hostOf: hostOf,
    patternOf: patternOf,
    scriptable: scriptable,
    isYouTube: isYouTube,
    playbookFor: playbookFor,
    clean: clean,
    accessIn: accessIn,
    allows: allows,
    withSite: withSite,
    withoutSite: withoutSite,
    load: load
  });
})(typeof self !== 'undefined' ? self : this);
