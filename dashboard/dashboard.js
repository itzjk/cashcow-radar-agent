// NSP Channel Hub — unified dashboard

var allChannels = [];
var activeFilter = 'ALL';
var activeNiche  = 'ALL';
var activeAge    = 'ALL';
var activeSort   = 'savedAt';
var searchQuery  = '';
var scannedNichos = [];
var selectedChannels = {}; // key: channelUrl  bool
var watchingCache = {};   // mirrors chrome.storage.local.nsp_watching

function fmtAge(days) {
  if (days === null || days === undefined) return null;
  if (days < 7) return days + 'd';
  if (days < 30) return Math.round(days / 7) + 'w';
  if (days < 365) return Math.round(days / 30) + 'mo';
  var years = Math.floor(days / 365);
  var remMo = Math.round((days - years * 365) / 30);
  return remMo > 0 ? years + 'y ' + remMo + 'mo' : years + 'y';
}

function isExplodingChannel(ch) {
  if (!ch.channelAgeDays || ch.channelAgeDays > 365) return false;

  var subs = ch.subs || 0;
  var ageMonths = ch.channelAgeDays / 30;
  var subsPerMonth = ageMonths > 0 ? subs / ageMonths : 0;
  var avgViewsPerVideo = (ch.videoCount && ch.totalViews && ch.videoCount > 0)
    ? (ch.totalViews / ch.videoCount) : 0;
  var topVPH = ch.topVPH || 0;

  // Path 1: classic <6mo + <50K + traction
  if (ch.channelAgeDays <= 180 && subs <= 50000 && subs > 0) {
    if (topVPH >= 50 || avgViewsPerVideo >= 50000) return true;
  }
  // Path 2: insane velocity (>5K subs/month)
  if (ch.channelAgeDays <= 300 && subsPerMonth >= 5000) return true;
  // Path 3: very young (<3mo) with any traction
  if (ch.channelAgeDays <= 90 && subs >= 1000) return true;
  // Path 4: young + viral avg views
  if (ch.channelAgeDays <= 180 && avgViewsPerVideo >= 100000) return true;

  return false;
}

function fmtN(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return '' + Math.round(n);
}
function fmtRev(n) {
  if (!n) return '--';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n;
}

var PRO_API_BASE = 'http://127.0.0.1:8000';

function proFirst(obj, keys, fallback) {
  if (!obj) return fallback;
  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') return obj[keys[i]];
  }
  return fallback;
}

function proAsArray(value) {
  if (!value) return [];
  return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
}

function proNicheValue(item) {
  return String(item.channelUrl || item.vidId || item.channelId || item.title || item.niche || item.savedAt || '');
}

function proNicheKey(item, idx) {
  return String(idx) + '::' + proNicheValue(item);
}

function proNicheLabel(item) {
  var bits = [item.niche || 'Scanned niche'];
  if (item.title) bits.push(item.title);
  if (item.language && item.language !== 'unknown') bits.push(String(item.language).toUpperCase());
  if (item.vph) bits.push('VPH ' + fmtN(item.vph));
  if (item.revMonth) bits.push(fmtRev(item.revMonth) + '/mo');
  return bits.join(' | ');
}

function proCleanNiche(item) {
  var raw = item.niche || item.title || '';
  return String(raw).replace(/[^\w\s\-&.,]/g, '').replace(/\s+/g, ' ').trim();
}

function proNicheChannel(item) {
  return item.channelUrl || item.url || item.channelId || '';
}

function proPost(path, body) {
  return fetch(PRO_API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  }).then(function(resp) {
    return resp.text().then(function(text) {
      var data = null;
      try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
      if (!resp.ok || (data && data.ok === false)) {
        var msg = proFirst(data, ['detail', 'error', 'message'], text || 'Backend error');
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      return data && typeof data.ok !== 'undefined' ? data.data : data;
    });
  });
}

function load() {
  loadSnapshots();
  chrome.storage.local.get(['nsp_all_channels', 'ashlyv_nichos', 'ashlyv_nichos_backup', 'nsp_watching'], function(res) {
    allChannels = res.nsp_all_channels || [];
    watchingCache = res.nsp_watching || {};
    scannedNichos = Array.isArray(res.ashlyv_nichos) && res.ashlyv_nichos.length
      ? res.ashlyv_nichos
      : (Array.isArray(res.ashlyv_nichos_backup) ? res.ashlyv_nichos_backup : []);
    render();
    if (document.getElementById('pro-niche-select')) populateProNichos();
  });
}

function toggleWatch(ch, btn) {
  chrome.storage.local.get('nsp_watching', function(res) {
    var watching = res.nsp_watching || {};
    if (watching[ch.channelUrl]) {
      delete watching[ch.channelUrl];
      btn.textContent = 'Watch';
      btn.classList.remove('active');
      btn.title = 'Click to turn on outlier alerts';
    } else {
      watching[ch.channelUrl] = {
        channelUrl: ch.channelUrl,
        channelId: ch.channelId || '',
        name: ch.name || '',
        addedAt: Date.now(),
        lastChecked: 0,
        knownVideoIds: []
      };
      btn.textContent = 'Watching';
      btn.classList.add('active');
      btn.title = 'You get a notification when this channel posts an outlier, checked every 6 hours';
      // Ensure alarm exists
      if (chrome.alarms) {
        chrome.alarms.get('nsp-trend-check', function(a) {
          if (!a) chrome.alarms.create('nsp-trend-check', { periodInMinutes: 360 });
        });
      }
    }
    chrome.storage.local.set({ nsp_watching: watching }, function() {
      watchingCache = watching;
    });
  });
}

function render() {
  var filtered = allChannels.filter(function(ch) {
    if (activeFilter !== 'ALL' && ch.source !== activeFilter) return false;
    if (activeNiche !== 'ALL') {
      var niche = ch.niche || '🔮 General';
      if (activeNiche === '🔮 General') {
        var mainNiches = ['🤖 AI','💻 Tech','💰 Finance','🏢 Business','📷 Camera','🎮 Gaming'];
        if (mainNiches.some(function(n) { return niche.indexOf(n.split(' ')[1]) !== -1; })) return false;
      } else {
        if (niche !== activeNiche) return false;
      }
    }
    // Age filter
    if (activeAge !== 'ALL') {
      var d = ch.channelAgeDays;
      if (activeAge === 'EXPLODING') {
        if (!isExplodingChannel(ch)) return false;
      } else if (activeAge === 'LT3M') {
        if (!d || d > 90) return false;
      } else if (activeAge === 'LT6M') {
        if (!d || d > 180) return false;
      } else if (activeAge === 'LT1Y') {
        if (!d || d > 365) return false;
      } else if (activeAge === 'GT1Y') {
        if (!d || d <= 365) return false;
      }
    }
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      if (!(ch.name || '').toLowerCase().includes(q) &&
          !(ch.niche || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    if (activeSort === 'growth') {
      var ga = computeGrowth(a), gb = computeGrowth(b);
      return (gb.subsPerDay || -1) - (ga.subsPerDay || -1);
    }
    if (activeSort === 'savedAt')  return (b.savedAt || 0)  - (a.savedAt || 0);
    if (activeSort === 'avgOS')    return (b.avgOS || 0)    - (a.avgOS || 0);
    if (activeSort === 'topVPH')   return (b.topVPH || 0)   - (a.topVPH || 0);
    if (activeSort === 'revMonth') return (b.revMonth || 0) - (a.revMonth || 0);
    if (activeSort === 'channelAgeDays') {
      // Ascending: youngest first; channels without age last
      var aa = a.channelAgeDays === null || a.channelAgeDays === undefined ? Infinity : a.channelAgeDays;
      var bb = b.channelAgeDays === null || b.channelAgeDays === undefined ? Infinity : b.channelAgeDays;
      return aa - bb;
    }
    return 0;
  });

  document.getElementById('total-count').textContent = allChannels.length + (allChannels.length === 1 ? ' channel' : ' channels');
  document.getElementById('empty-state').style.display = filtered.length ? 'none' : 'block';

  var grid = document.getElementById('grid');
  grid.innerHTML = '';

  filtered.forEach(function(ch) {
    var tier = ch.topTier || 'SLOW';
    var card = document.createElement('div');
    card.className = 'ch-card';
    card.dataset.tier = tier;

    // Source badge
    var srcBadge = document.createElement('span');
    srcBadge.className = 'source-badge source-' + (ch.source || 'scout');
    srcBadge.textContent = ch.source === 'manual' ? 'Saved' : 'Scout';
    card.appendChild(srcBadge);

    // Multi-select checkbox
    var selCheck = document.createElement('input');
    selCheck.type = 'checkbox';
    selCheck.className = 'ch-select-check';
    selCheck.checked = !!selectedChannels[ch.channelUrl];
    selCheck.addEventListener('click', function(e) { e.stopPropagation(); });
    selCheck.addEventListener('change', function() {
      if (selCheck.checked) selectedChannels[ch.channelUrl] = true;
      else delete selectedChannels[ch.channelUrl];
      updateBulkBar();
    });
    card.appendChild(selCheck);

    // NEW & EXPLODING badge (NEXLEV killer formula)
    if (isExplodingChannel(ch)) {
      var explBadge = document.createElement('span');
      explBadge.className = 'exploding-badge';
      explBadge.textContent = ' NEW & EXPLODING';
      explBadge.title = 'Under 6 months, under 50K subs, real traction';
      card.appendChild(explBadge);
    }

    // Remove btn
    var rmBtn = document.createElement('button');
    rmBtn.className = 'ch-remove';
    rmBtn.textContent = '';
    rmBtn.title = 'Remove';
    rmBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      removeChannel(ch.channelUrl);
    });
    card.appendChild(rmBtn);

    // Avatar
    var wrap = document.createElement('div');
    wrap.className = 'ch-avatar-wrap';
    if (ch.avatarUrl) {
      var img = document.createElement('img');
      img.className = 'ch-avatar';
      img.src = ch.avatarUrl;
      img.alt = ch.name || '';
      img.onerror = function() {
        wrap.innerHTML = '';
        var pl = document.createElement('span');
        pl.className = 'ch-avatar-placeholder';
        pl.textContent = ((ch.name || '?')[0]).toUpperCase();
        wrap.appendChild(pl);
      };
      wrap.appendChild(img);
    } else {
      var pl = document.createElement('span');
      pl.className = 'ch-avatar-placeholder';
      pl.textContent = ((ch.name || '?')[0]).toUpperCase();
      wrap.appendChild(pl);
    }
    card.appendChild(wrap);

    // Body
    var body = document.createElement('div');
    body.className = 'ch-body';

    var nameEl = document.createElement('div');
    nameEl.className = 'ch-name';
    nameEl.textContent = ch.name || 'Channel';
    nameEl.title = ch.name || '';
    body.appendChild(nameEl);

    // Niche
    var nicheEl = document.createElement('span');
    nicheEl.className = 'ch-niche';
    nicheEl.textContent = ch.niche || '🔮 General';
    body.appendChild(nicheEl);

    // Stats row
    var statsRow = document.createElement('div');
    statsRow.className = 'ch-stats';

    function statBox(val, lbl) {
      var box = document.createElement('div');
      box.className = 'ch-stat';
      var v = document.createElement('span');
      v.className = 'ch-stat-val';
      v.textContent = val;
      var l = document.createElement('span');
      l.className = 'ch-stat-lbl';
      l.textContent = lbl;
      box.appendChild(v);
      box.appendChild(l);
      return box;
    }

    var growth = computeGrowth(ch);
    if (growth.measurements >= 2 && !growth.tooClose) {
      statsRow.appendChild(statBox((growth.subsPerDay >= 0 ? '+' : '') + fmtN(Math.round(growth.subsPerDay)), 'Subs/day'));
    }
    if (ch.avgOS)    statsRow.appendChild(statBox('OS:' + ch.avgOS, 'Score'));
    if (ch.topVPH)   statsRow.appendChild(statBox(fmtN(ch.topVPH), 'Top VPH'));
    if (ch.revMonth) statsRow.appendChild(statBox(fmtRev(ch.revMonth), 'Per month'));
    if (ch.subs)     statsRow.appendChild(statBox(fmtN(ch.subs), 'Subs'));
    if (ch.channelAgeDays !== null && ch.channelAgeDays !== undefined) {
      var ageStr = fmtAge(ch.channelAgeDays);
      statsRow.appendChild(statBox(ageStr, 'Age'));
    }

    if (statsRow.children.length) body.appendChild(statsRow);

    // Meta line
    var metaLine = document.createElement('div');
    metaLine.className = 'ch-meta';
    var parts = [];
    if (ch.subs && !statsRow.querySelector('[data-lbl="Subs"]')) parts.push(' ' + fmtN(ch.subs));
    if (ch.monetized === 'yes') parts.push('Monetized');
    else if (ch.monetized === 'likely') parts.push('Likely monetized');
    if (parts.length) metaLine.textContent = parts.join('  ·  ');
    if (parts.length) body.appendChild(metaLine);

    // Open button
    var openBtn = document.createElement('button');
    openBtn.className = 'ch-open-btn';
    openBtn.textContent = 'Open channel';
    openBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      chrome.tabs.create({ url: ch.channelUrl });
    });
    body.appendChild(openBtn);

    // Lab tools row — open channel + auto-launch panel via pending action
    var labRow = document.createElement('div');
    labRow.className = 'ch-lab-row';

    function launchLabAction(actionType, btn, busyLabel) {
      if (!ch.channelUrl) return;
      var originalText = btn.textContent;
      btn.textContent = busyLabel;
      btn.disabled = true;
      var pending = {
        type: actionType,
        channelUrl: ch.channelUrl,
        channelId: ch.channelId || '',
        ts: Date.now()
      };
      chrome.storage.local.set({ nsp_pending_action: pending }, function() {
        chrome.tabs.create({ url: ch.channelUrl });
        setTimeout(function() {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1800);
      });
    }

    // Watch button (trend alerts)
    var watchBtn = document.createElement('button');
    watchBtn.className = 'ch-lab-btn';
    var isWatching = !!(watchingCache && watchingCache[ch.channelUrl]);
    watchBtn.textContent = isWatching ? 'Watching' : 'Watch';
    watchBtn.title = isWatching ? 'You get a notification when this channel posts an outlier, checked every 6 hours' : 'Click to turn on outlier alerts';
    if (isWatching) watchBtn.classList.add('active');
    watchBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleWatch(ch, watchBtn);
    });
    labRow.appendChild(watchBtn);

    var thumbBtn = document.createElement('button');
    thumbBtn.className = 'ch-lab-btn';
    thumbBtn.textContent = ' Thumb Lab';
    thumbBtn.title = 'Open the channel and launch Thumb Lab';
    thumbBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      launchLabAction('thumblab', thumbBtn, 'Opening');
    });
    labRow.appendChild(thumbBtn);

    var titleBtn = document.createElement('button');
    titleBtn.className = 'ch-lab-btn';
    titleBtn.textContent = ' Title Lab';
    titleBtn.title = 'Open the channel and launch Title Lab';
    titleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      launchLabAction('titlelab', titleBtn, 'Opening');
    });
    labRow.appendChild(titleBtn);

    body.appendChild(labRow);

    card.appendChild(body);
    card.addEventListener('click', function() {
      chrome.tabs.create({ url: ch.channelUrl });
    });

    grid.appendChild(card);
  });

  renderPortfolio();
}

var SNAPSHOT_KEY = 'zerack_channel_snapshots_v1';
var SNAPSHOTS = {};
var SNAPSHOT_MAX_PER_CHANNEL = 14;
var GROWTH_BATCH = 30;

function parseCount(raw) {
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
  var t = String(raw || '').trim().toLowerCase();
  if (!t || t === 'desconocido' || t === 'unknown') return 0;
  t = t.replace(/\s+/g, '');
  var mult = 1;
  if (/[km b]$/.test(t.slice(-1)) === false) { /* noop */ }
  var last = t.slice(-1);
  if (last === 'k') { mult = 1e3; t = t.slice(0, -1); }
  else if (last === 'm') { mult = 1e6; t = t.slice(0, -1); }
  else if (last === 'b') { mult = 1e9; t = t.slice(0, -1); }
  var dot = t.lastIndexOf('.'), comma = t.lastIndexOf(',');
  var dec = Math.max(dot, comma);
  var intPart = dec >= 0 ? t.slice(0, dec).replace(/[.,]/g, '') : t.replace(/[.,]/g, '');
  var frac = dec >= 0 ? t.slice(dec + 1).replace(/[^\d]/g, '') : '';
  if (dec >= 0 && frac.length === 3 && mult === 1) { intPart = intPart + frac; frac = ''; }
  var n = parseFloat(intPart + (frac ? '.' + frac : '')) || 0;
  return Math.round(n * mult);
}

function loadSnapshots(cb) {
  chrome.storage.local.get(SNAPSHOT_KEY, function(r) {
    SNAPSHOTS = (r && r[SNAPSHOT_KEY]) || {};
    if (cb) cb();
  });
}

function computeGrowth(ch) {
  var list = SNAPSHOTS[ch.channelUrl];
  if (!Array.isArray(list) || list.length < 2) {
    return { measurements: list ? list.length : 0 };
  }
  var first = list[0], last = list[list.length - 1];
  var days = (last.ts - first.ts) / 86400000;
  if (!(days > 0.5)) return { measurements: list.length, tooClose: true };
  var subsDelta = (last.subs || 0) - (first.subs || 0);
  var viewsDelta = (last.views || 0) - (first.views || 0);
  return {
    measurements: list.length,
    days: days,
    subsPerDay: subsDelta / days,
    viewsPerDay: viewsDelta / days,
    subsPct: first.subs ? (subsDelta / first.subs) * 100 : 0
  };
}

function growthLabel(g) {
  if (!g || g.measurements < 2) return g && g.measurements === 1 ? '1 measurement' : 'not measured';
  if (g.tooClose) return 'measured twice today';
  var perDay = Math.round(g.subsPerDay);
  var sign = perDay > 0 ? '+' : '';
  return sign + fmtN(perDay) + ' subs/day over ' + Math.round(g.days) + 'd';
}

function measureGrowth() {
  var btn = document.getElementById('btn-growth');
  var list = getCurrentFilteredChannels().slice(0, GROWTH_BATCH);
  if (!list.length) { alert('Save a channel first.'); return; }
  var done = 0, failed = 0;
  if (btn) { btn.disabled = true; btn.textContent = 'Measuring 0/' + list.length; }

  function finish() {
    var payload = {};
    payload[SNAPSHOT_KEY] = SNAPSHOTS;
    chrome.storage.local.set(payload, function() {
      if (btn) { btn.disabled = false; btn.textContent = 'Measure growth'; }
      render();
      var withTwo = list.filter(function(c) { return (SNAPSHOTS[c.channelUrl] || []).length >= 2; }).length;
      alert('Measured ' + done + ' of ' + list.length + (failed ? ', ' + failed + ' could not be read' : '') +
            '.\n' + withTwo + ' now have two or more measurements, so their growth is real.');
    });
  }

  function step(i) {
    if (i >= list.length) { finish(); return; }
    var ch = list[i];
    chrome.runtime.sendMessage({ type: 'NSP_AGENT_CHANNEL_STATS', channelUrl: ch.channelUrl }, function(res) {
      var err = chrome.runtime && chrome.runtime.lastError;
      if (!err && res && res.ok) {
        var snap = {
          ts: Date.now(),
          subs: parseCount(res.subscribers),
          views: parseCount(res.totalViews),
          videos: parseCount(res.videoCount)
        };
        if (snap.subs || snap.views) {
          var arr = SNAPSHOTS[ch.channelUrl] || [];
          var lastSnap = arr[arr.length - 1];
          if (!lastSnap || (snap.ts - lastSnap.ts) > 3600000) arr.push(snap);
          else arr[arr.length - 1] = snap;
          if (arr.length > SNAPSHOT_MAX_PER_CHANNEL) arr = arr.slice(-SNAPSHOT_MAX_PER_CHANNEL);
          SNAPSHOTS[ch.channelUrl] = arr;
          done++;
        } else { failed++; }
      } else { failed++; }
      if (btn) btn.textContent = 'Measuring ' + (i + 1) + '/' + list.length;
      setTimeout(function() { step(i + 1); }, 1200);
    });
  }
  step(0);
}

function medianOf(values) {
  var arr = values.filter(function(v) { return typeof v === 'number' && isFinite(v) && v > 0; }).sort(function(a, b) { return a - b; });
  if (!arr.length) return 0;
  var mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function renderPortfolio() {
  var box = document.getElementById('portfolio');
  if (!box) return;
  var list = getCurrentFilteredChannels();
  var setText = function(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('pf-channels', String(list.length));
  setText('pf-vph', fmtN(Math.round(medianOf(list.map(function(c) { return c.topVPH || 0; })))));
  var rev = list.reduce(function(acc, c) { return acc + (Number(c.revMonth) || 0); }, 0);
  setText('pf-rev', rev ? fmtRev(Math.round(rev)) : '--');
  setText('pf-exploding', String(list.filter(isExplodingChannel).length));
  var measured = list.map(computeGrowth).filter(function(g) { return g.measurements >= 2 && !g.tooClose; });
  var pfGrowth = document.getElementById('pf-growth');
  if (pfGrowth) {
    if (!measured.length) {
      pfGrowth.textContent = list.length ? 'measure twice to see it' : 'no channels';
    } else {
      var med = medianOf(measured.map(function(g) { return g.subsPerDay; }));
      pfGrowth.textContent = '+' + fmtN(Math.round(med)) + ' subs/day  ' + measured.length + ' measured';
    }
  }

  var byNiche = {};
  list.forEach(function(c) {
    var key = c.niche || 'unclassified';
    if (!byNiche[key]) byNiche[key] = [];
    byNiche[key].push(Number(c.avgOS) || 0);
  });
  var best = '', bestScore = 0, bestCount = 0;
  Object.keys(byNiche).forEach(function(key) {
    if (byNiche[key].length < 2) return;
    var m = medianOf(byNiche[key]);
    if (m > bestScore) { bestScore = m; best = key; bestCount = byNiche[key].length; }
  });
  setText('pf-niche', best ? (best + '  ' + Math.round(bestScore) + ' OS  ' + bestCount + ' channels') : 'needs 2 channels in one niche');
}

function removeChannel(url) {
  allChannels = allChannels.filter(function(c) { return c.channelUrl !== url; });
  delete selectedChannels[url];
  chrome.storage.local.set({ nsp_all_channels: allChannels }, render);
}

//  BULK OPERATIONS 
function getSelectedChannels() {
  var sel = [];
  for (var i = 0; i < allChannels.length; i++) {
    if (selectedChannels[allChannels[i].channelUrl]) sel.push(allChannels[i]);
  }
  return sel;
}

function clearSelection() {
  selectedChannels = {};
  document.querySelectorAll('.ch-select-check').forEach(function(c) { c.checked = false; });
  updateBulkBar();
}

function updateBulkBar() {
  var bar = document.getElementById('nsp-bulk-bar');
  var count = Object.keys(selectedChannels).length;
  if (!bar) {
    if (!count) return;
    bar = document.createElement('div');
    bar.id = 'nsp-bulk-bar';
    bar.className = 'nsp-bulk-bar';
    bar.innerHTML = '<span class="nsp-bulk-count" id="nsp-bulk-count">0 selected</span>'
      + '<button class="nsp-bulk-btn" id="nsp-bulk-export">Export selection</button>'
      + '<button class="nsp-bulk-btn" id="nsp-bulk-ideas">Ideas from these</button>'
      + '<button class="nsp-bulk-btn" id="nsp-bulk-watch">Watch for outliers</button>'
      + '<button class="nsp-bulk-btn danger" id="nsp-bulk-delete">Delete</button>'
      + '<button class="nsp-bulk-btn ghost" id="nsp-bulk-clear">Clear selection</button>';
    document.body.appendChild(bar);
    document.getElementById('nsp-bulk-export').onclick = function() {
      var data = getSelectedChannels();
      if (!data.length) return;
      exportAsCSV(data);
    };
    document.getElementById('nsp-bulk-ideas').onclick = function() {
      var sel = getSelectedChannels();
      if (!sel.length) return;
      openIdeasPanelFor(sel);
    };
    document.getElementById('nsp-bulk-watch').onclick = function() {
      var sel = getSelectedChannels();
      if (!sel.length) return;
      bulkWatch(sel);
    };
    document.getElementById('nsp-bulk-delete').onclick = function() {
      var sel = getSelectedChannels();
      if (!sel.length) return;
      if (!confirm('Remove ' + sel.length + ' selected channels?')) return;
      var urls = sel.map(function(c) { return c.channelUrl; });
      allChannels = allChannels.filter(function(c) { return urls.indexOf(c.channelUrl) === -1; });
      chrome.storage.local.set({ nsp_all_channels: allChannels }, function() {
        clearSelection();
        render();
      });
    };
    document.getElementById('nsp-bulk-clear').onclick = clearSelection;
  }
  if (count === 0) { bar.remove(); return; }
  document.getElementById('nsp-bulk-count').textContent = count + ' selected';
}

function openIdeasPanelFor(channels) {
  // Same as openIdeasPanel but with custom channels list
  var existing = document.getElementById('nsp-ideas-modal');
  if (existing) existing.remove();
  var backdrop = document.createElement('div');
  backdrop.id = 'nsp-ideas-modal';
  backdrop.className = 'nsp-modal-backdrop';
  var modal = document.createElement('div');
  modal.className = 'nsp-modal nsp-modal-lg';
  backdrop.appendChild(modal);

  var top = channels.slice(0, 10);
  modal.innerHTML = '<div class="nsp-modal-header">'
    + '<div class="nsp-modal-title">Ideas for ' + top.length + ' selected channels</div>'
    + '<button class="nsp-modal-close" id="nsp-ideas-close-2"></button></div>'
    + '<div class="nsp-modal-body">'
    + '<div class="ideas-subhead">Five fresh angles built from the channels you picked</div>'
    + '<div class="ideas-channels" id="nsp-ideas-preview-2"></div>'
    + '<button class="export-format-btn" id="nsp-ideas-gen-2">Generate ideas</button>'
    + '<div class="ideas-output" id="nsp-ideas-out-2"></div></div>';
  document.body.appendChild(backdrop);

  var prev = document.getElementById('nsp-ideas-preview-2');
  top.forEach(function(ch) {
    var chip = document.createElement('span');
    chip.className = 'ideas-channel-chip';
    chip.textContent = (ch.name || '?').slice(0, 24);
    prev.appendChild(chip);
  });
  document.getElementById('nsp-ideas-close-2').onclick = function() { backdrop.remove(); };
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) backdrop.remove(); });
  document.getElementById('nsp-ideas-gen-2').onclick = function() {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Asking Claude';
    var out = document.getElementById('nsp-ideas-out-2');
    out.innerHTML = '<div class="ideas-loading">Generating ideas</div>';
    generateDailyIdeas(top).then(function(text) {
      out.innerHTML = '<div class="ideas-result"></div>';
      out.querySelector('.ideas-result').textContent = text;
      btn.textContent = 'Generate another round';
      btn.disabled = false;
    }).catch(function(err) {
      out.innerHTML = '<div class="ideas-error">' + (err && err.message ? err.message : 'Error') + '</div>';
      btn.textContent = 'Try again';
      btn.disabled = false;
    });
  };
}

function bulkWatch(channels) {
  chrome.storage.local.get('nsp_watching', function(res) {
    var watching = res.nsp_watching || {};
    channels.forEach(function(ch) {
      watching[ch.channelUrl] = {
        channelUrl: ch.channelUrl,
        channelId: ch.channelId || '',
        name: ch.name || '',
        addedAt: Date.now(),
        lastChecked: 0,
        knownVideoIds: []
      };
    });
    chrome.storage.local.set({ nsp_watching: watching }, function() {
      var bar = document.getElementById('nsp-bulk-count');
      if (bar) {
        var prev = bar.textContent;
        bar.textContent = '' + channels.length + ' channels on the watchlist';
        setTimeout(function() { bar.textContent = prev; }, 2000);
      }
      // Register chrome.alarm if not yet registered
      if (chrome.alarms) {
        chrome.alarms.get('nsp-trend-check', function(alarm) {
          if (!alarm) {
            chrome.alarms.create('nsp-trend-check', { periodInMinutes: 360 }); // every 6h
          }
        });
      }
    });
  });
}

function makeProEl(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function ensureProPanel() {
  if (document.getElementById('pro-panel-backdrop')) return;

  var backdrop = makeProEl('div', 'pro-backdrop');
  backdrop.id = 'pro-panel-backdrop';
  backdrop.hidden = true;

  var panel = makeProEl('div', 'pro-panel');
  backdrop.appendChild(panel);

  var header = makeProEl('div', 'pro-panel-header');
  var titleWrap = makeProEl('div');
  titleWrap.appendChild(makeProEl('div', 'pro-panel-title', 'PRO TOOLS'));
  titleWrap.appendChild(makeProEl('div', 'pro-panel-subtitle', 'Pick a scanned niche and run the tools against that list only.'));
  header.appendChild(titleWrap);

  var closeBtn = makeProEl('button', 'pro-close-btn', 'X');
  closeBtn.id = 'pro-close-btn';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', closeProPanel);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  var selectBlock = makeProEl('div', 'pro-select-block');
  var label = makeProEl('label', 'pro-label', 'Scanned niche');
  label.setAttribute('for', 'pro-niche-select');
  selectBlock.appendChild(label);

  var selectRow = makeProEl('div', 'pro-select-row');
  var select = makeProEl('select', 'pro-select');
  select.id = 'pro-niche-select';
  select.addEventListener('change', updateProSelectedNiche);
  selectRow.appendChild(select);

  var openBtn = makeProEl('button', 'pro-secondary-btn', 'OPEN SOURCE');
  openBtn.id = 'pro-open-source';
  openBtn.addEventListener('click', function() {
    var item = getSelectedProNiche();
    var url = item ? (item.channelUrl || (item.vidId ? 'https://www.youtube.com/watch?v=' + item.vidId : '')) : '';
    if (url) chrome.tabs.create({ url: url });
  });
  selectRow.appendChild(openBtn);
  selectBlock.appendChild(selectRow);

  var summary = makeProEl('div', 'pro-selected-summary', 'Pick a niche from the last scan to see its PRO tools.');
  summary.id = 'pro-selected-summary';
  selectBlock.appendChild(summary);
  panel.appendChild(selectBlock);

  var tools = makeProEl('div', 'pro-tools-grid');
  panel.appendChild(tools);

  var scanCard = makeProCard('Scan niche', 'A summary of the scanned niche, plus channel age and viral metrics when there is a channel.');
  var scanBtn = makeProAction('pro-run-scan', 'SCAN NICHE');
  scanCard.appendChild(scanBtn);
  scanCard.appendChild(makeProResult('pro-scan-result', 'The scan summary shows up here.'));
  tools.appendChild(scanCard);

  var titlesCard = makeProCard('Search titles', 'Look for openings using the selected niche only.');
  titlesCard.appendChild(makeProAction('pro-run-titles', 'SEARCH TITLES'));
  titlesCard.appendChild(makeProResult('pro-title-result', 'Title search results.'));
  tools.appendChild(titlesCard);

  var globalCard = makeProCard('Global matrix', 'Compare the selected niche by language and opportunity.');
  globalCard.appendChild(makeProAction('pro-run-global', 'ANALYZE GLOBAL'));
  globalCard.appendChild(makeProResult('pro-global-result', 'Global score for the selected niche.'));
  tools.appendChild(globalCard);

  var repCard = makeProCard('Replicate content', 'Build ready to produce ideas from the source behind the niche.');
  repCard.appendChild(makeProSelect('pro-rep-language', 'Language', [
    ['es', 'Spanish'],
    ['en', 'English'],
    ['pt', 'Portuguese']
  ]));
  repCard.appendChild(makeProAction('pro-run-replicate', 'REPLICATE'));
  repCard.appendChild(makeProResult('pro-rep-result', 'Ideas for replicating the channel.'));
  tools.appendChild(repCard);

  var brandCard = makeProCard('Build a brand', 'Names, bio, visual identity and strategy for the selected niche.');
  brandCard.appendChild(makeProSelect('pro-brand-tone', 'Tone', [
    ['professional', 'Professional'],
    ['mysterious', 'Mysterious'],
    ['bold', 'Bold'],
    ['educational', 'Educational']
  ]));
  brandCard.appendChild(makeProAction('pro-run-brand', 'BUILD BRAND'));
  brandCard.appendChild(makeProResult('pro-brand-result', 'Brand kit for the niche.'));
  tools.appendChild(brandCard);

  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) closeProPanel();
  });

  document.body.appendChild(backdrop);

  document.getElementById('pro-run-scan').addEventListener('click', runProChannelScan);
  document.getElementById('pro-run-titles').addEventListener('click', runProTitleSearch);
  document.getElementById('pro-run-global').addEventListener('click', runProGlobalScore);
  document.getElementById('pro-run-replicate').addEventListener('click', runProReplicate);
  document.getElementById('pro-run-brand').addEventListener('click', runProBrand);
}

function makeProCard(title, desc) {
  var card = makeProEl('div', 'pro-tool-card');
  card.appendChild(makeProEl('div', 'pro-tool-title', title));
  card.appendChild(makeProEl('div', 'pro-tool-desc', desc));
  return card;
}

function makeProAction(id, label) {
  var btn = makeProEl('button', 'pro-action-btn', label);
  btn.id = id;
  return btn;
}

function makeProResult(id, text) {
  var box = makeProEl('div', 'pro-result', text);
  box.id = id;
  return box;
}

function makeProInput(id, labelText, placeholder) {
  var wrap = makeProEl('div', 'pro-field');
  var label = makeProEl('label', 'pro-label', labelText);
  label.setAttribute('for', id);
  var input = makeProEl('input', 'pro-input');
  input.id = id;
  input.placeholder = placeholder || '';
  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
}

function makeProSelect(id, labelText, options) {
  var wrap = makeProEl('div', 'pro-field');
  var label = makeProEl('label', 'pro-label', labelText);
  label.setAttribute('for', id);
  var select = makeProEl('select', 'pro-input');
  select.id = id;
  options.forEach(function(opt) {
    var option = makeProEl('option');
    option.value = opt[0];
    option.textContent = opt[1];
    select.appendChild(option);
  });
  wrap.appendChild(label);
  wrap.appendChild(select);
  return wrap;
}

function openProPanel(preselectValue) {
  ensureProPanel();
  populateProNichos(preselectValue);
  var backdrop = document.getElementById('pro-panel-backdrop');
  backdrop.hidden = false;
  requestAnimationFrame(function() { backdrop.classList.add('visible'); });
}

function closeProPanel() {
  var backdrop = document.getElementById('pro-panel-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('visible');
  setTimeout(function() { backdrop.hidden = true; }, 160);
}

function populateProNichos(preselectValue) {
  var select = document.getElementById('pro-niche-select');
  if (!select) return;
  var current = preselectValue || select.value;
  while (select.firstChild) select.removeChild(select.firstChild);

  var placeholder = makeProEl('option');
  placeholder.value = '';
  placeholder.textContent = scannedNichos.length ? 'Pick a scanned niche' : 'No scanned niches yet';
  select.appendChild(placeholder);

  scannedNichos.forEach(function(item, idx) {
    var value = proNicheKey(item, idx);
    var option = makeProEl('option');
    option.value = value;
    option.textContent = proNicheLabel(item);
    select.appendChild(option);
  });

  if (current) select.value = current;
  updateProSelectedNiche();
}

function getSelectedProNiche() {
  var select = document.getElementById('pro-niche-select');
  if (!select || !select.value) return null;
  for (var i = 0; i < scannedNichos.length; i++) {
    if (proNicheKey(scannedNichos[i], i) === select.value) return scannedNichos[i];
  }
  return null;
}

function updateProSelectedNiche() {
  var item = getSelectedProNiche();
  var summary = document.getElementById('pro-selected-summary');
  var openBtn = document.getElementById('pro-open-source');
  var hasItem = !!item;
  var hasSource = !!(item && (item.channelUrl || item.vidId));

  if (openBtn) openBtn.disabled = !hasSource;
  ['pro-run-scan', 'pro-run-titles', 'pro-run-global', 'pro-run-replicate', 'pro-run-brand'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) btn.disabled = !hasItem;
  });

  if (!summary) return;
  if (!item) {
    delete summary.dataset.channelValue;
    summary.textContent = scannedNichos.length ? 'Pick a niche from the scanned list to use PRO.' : 'No scanned niches yet. Run a scan and save or open the results first.';
    return;
  }

  var details = [];
  if (item.language && item.language !== 'unknown') details.push('Language: ' + String(item.language).toUpperCase());
  if (item.vph) details.push('VPH: ' + fmtN(item.vph));
  if (item.views) details.push('Views: ' + fmtN(item.views));
  if (item.revMonth) details.push('Per month: ' + fmtRev(item.revMonth));
  if (item.facelessScore) details.push('Faceless: ' + Math.round(item.facelessScore) + '%');
  summary.textContent = (item.niche || 'Niche') + ' - ' + (item.title || details.join(' | ') || 'scanned result');

  var selectedValue = proNicheLabel(item);
  if (summary.dataset.channelValue !== selectedValue) {
    summary.dataset.channelValue = selectedValue;
  }
}

function proRequireNiche(resultId) {
  var item = getSelectedProNiche();
  if (!item) {
    setProResult(resultId, 'Pick a scanned niche from the list first.', 'error');
    return null;
  }
  return item;
}

function setProResult(id, text, state) {
  var box = document.getElementById(id);
  if (!box) return;
  box.classList.remove('is-error', 'is-loading');
  if (state === 'error') box.classList.add('is-error');
  if (state === 'loading') box.classList.add('is-loading');
  box.textContent = text;
}

function clearProResult(id) {
  var box = document.getElementById(id);
  if (!box) return null;
  box.classList.remove('is-error', 'is-loading');
  box.textContent = '';
  return box;
}

function proMetric(label, value, tone) {
  var box = makeProEl('div', 'pro-metric ' + (tone || ''));
  box.appendChild(makeProEl('span', 'pro-metric-label', label));
  box.appendChild(makeProEl('strong', 'pro-metric-value', value));
  return box;
}

function appendProJson(parent, data) {
  var pre = makeProEl('pre', 'pro-json');
  pre.textContent = JSON.stringify(data, null, 2);
  parent.appendChild(pre);
}

async function runProChannelScan() {
  var item = proRequireNiche('pro-scan-result');
  if (!item) return;
  var channel = proNicheChannel(item);
  setProResult('pro-scan-result', 'Analyzing the selected niche', 'loading');

  try {
    if (channel) {
      var age = await proPost('/niche/channel-age', { channel: channel, maxMonths: 3 });
      var viral = await proPost('/niche/viral-metrics', {
        channel: channel,
        language: item.language || 'es',
        viralThreshold: 100000,
        minViralVideos: 10,
        maxVideos: 40
      });
      renderProScanResult(item, age, viral);
    } else {
      renderProScanResult(item, null, null);
    }
  } catch (err) {
    setProResult('pro-scan-result', 'PRO error: ' + (err && err.message ? err.message : err), 'error');
  }
}

function renderProScanResult(item, age, viral) {
  var box = clearProResult('pro-scan-result');
  if (!box) return;

  var metrics = viral ? (viral.viralMetrics || viral || {}) : {};
  var channel = viral ? (viral.channel || {}) : {};
  var ratio = Number(metrics.viralRatio || 0);
  var ratioText = (ratio <= 1 ? Math.round(ratio * 100) : Math.round(ratio)) + '%';
  var pass = age ? age.passesFilter : null;

  var head = makeProEl('div', 'pro-result-head');
  head.textContent = item.niche || proFirst(channel, ['title', 'name', 'channelTitle'], 'Analyzed niche');
  box.appendChild(head);

  var grid = makeProEl('div', 'pro-metric-grid');
  grid.appendChild(proMetric('Niche', item.niche || 'General'));
  grid.appendChild(proMetric('Language', (item.language || 'unknown').toUpperCase()));
  grid.appendChild(proMetric('VPH scan', fmtN(item.vph || 0), item.vph >= 100 ? 'ok' : 'warn'));
  grid.appendChild(proMetric('Views scan', fmtN(item.views || 0)));
  grid.appendChild(proMetric('RPM scan', item.rpm ? '$' + Number(item.rpm).toFixed(2) : 'n/a'));
  grid.appendChild(proMetric('Revenue per month', fmtRev(item.revMonth || 0), item.revMonth ? 'ok' : ''));
  grid.appendChild(proMetric('Faceless', item.facelessScore ? Math.round(item.facelessScore) + '%' : 'n/a', item.facelessScore >= 70 ? 'ok' : 'warn'));
  grid.appendChild(proMetric('Source', item.channelUrl ? 'Channel' : (item.vidId ? 'Video' : 'Scan')));
  if (age) {
    grid.appendChild(proMetric('Channel age', age.monthsOld !== null && age.monthsOld !== undefined ? age.monthsOld + ' months' : 'n/a', pass === true ? 'ok' : (pass === false ? 'bad' : '')));
    grid.appendChild(proMetric('Created', age.createdDate || age.publishedAt || 'n/a'));
  }
  if (viral) {
    grid.appendChild(proMetric('Viral videos', String(metrics.viralVideoCount || 0), metrics.viralVideoCount >= 10 ? 'ok' : 'warn'));
    grid.appendChild(proMetric('Viral ratio', ratioText, ratio >= 0.2 ? 'ok' : 'warn'));
    grid.appendChild(proMetric('Velocity', metrics.velocityTier || 'n/a', metrics.velocityTier === 'EXPLOSIVE' || metrics.velocityTier === 'HIGH' ? 'ok' : ''));
    grid.appendChild(proMetric('Views per week', fmtN(metrics.weeklyViewVelocity || 0)));
  }
  box.appendChild(grid);

  var videos = proAsArray(metrics.viralVideos).slice(0, 6);
  if (videos.length) {
    box.appendChild(makeProEl('div', 'pro-list-title', 'Top viral videos'));
    videos.forEach(function(v) {
      var row = makeProEl('div', 'pro-video-row');
      row.appendChild(makeProEl('span', 'pro-video-title', v.title || 'Video'));
      row.appendChild(makeProEl('strong', 'pro-video-views', fmtN(v.views || 0)));
      box.appendChild(row);
    });
  }
}

async function runProTitleSearch() {
  var item = proRequireNiche('pro-title-result');
  if (!item) return;
  var keywords = proCleanNiche(item);
  if (!keywords) {
    setProResult('pro-title-result', 'This scanned result has no usable niche or title.', 'error');
    return;
  }

  setProResult('pro-title-result', 'Searching titles and channels', 'loading');
  try {
    var data = await proPost('/niche/search-titles', {
      keywords: keywords,
      language: item.language || 'es',
      maxResults: 30,
      sortBy: 'views'
    });
    renderProTitleResult(data);
  } catch (err) {
    setProResult('pro-title-result', 'PRO error: ' + (err && err.message ? err.message : err), 'error');
  }
}

function renderProTitleResult(data) {
  var box = clearProResult('pro-title-result');
  if (!box) return;
  var channels = proAsArray(proFirst(data, ['channels', 'topChannels', 'results'], []));
  var videos = proAsArray(proFirst(data, ['videos', 'topVideos'], []));
  var title = makeProEl('div', 'pro-result-head');
  title.textContent = 'Sub-niche: ' + proFirst(data, ['subNiche', 'subniche', 'query'], 'n/a') + ' | RPM: ' + proFirst(data, ['estimatedRpm', 'rpm', 'RPM'], 'n/a');
  box.appendChild(title);

  var rows = channels.length ? channels.slice(0, 6) : videos.slice(0, 6);
  rows.forEach(function(item) {
    var row = makeProEl('div', 'pro-video-row');
    row.appendChild(makeProEl('span', 'pro-video-title', proFirst(item, ['name', 'channel', 'title'], 'Result')));
    row.appendChild(makeProEl('strong', 'pro-video-views', fmtN(proFirst(item, ['totalViews', 'views', 'viewCount'], 0))));
    box.appendChild(row);
  });
  if (!rows.length) appendProJson(box, data);
}

async function runProGlobalScore() {
  var item = proRequireNiche('pro-global-result');
  if (!item) return;
  var niche = proCleanNiche(item);
  if (!niche) {
    setProResult('pro-global-result', 'This scanned result has no usable niche.', 'error');
    return;
  }
  setProResult('pro-global-result', 'Analyzing global opportunity', 'loading');
  try {
    var data = await proPost('/niche/score-by-language', { niche: niche });
    renderProGlobalResult(data);
  } catch (err) {
    setProResult('pro-global-result', 'PRO error: ' + (err && err.message ? err.message : err), 'error');
  }
}

function renderProGlobalResult(data) {
  var box = clearProResult('pro-global-result');
  if (!box) return;
  var rows = proAsArray(proFirst(data, ['results', 'languages', 'scores'], []));
  box.appendChild(makeProEl('div', 'pro-result-head', 'Best: ' + proFirst(data, ['bestLanguage', 'bestVerdict', 'bestScore'], 'n/a')));
  if (!rows.length) {
    appendProJson(box, data);
    return;
  }
  rows.slice(0, 8).forEach(function(row) {
    var item = makeProEl('div', 'pro-video-row');
    item.appendChild(makeProEl('span', 'pro-video-title', proFirst(row, ['language', 'code', 'name'], 'Language')));
    item.appendChild(makeProEl('strong', 'pro-video-views', String(proFirst(row, ['score', 'value', 'verdict'], 'n/a'))));
    box.appendChild(item);
  });
}

async function runProReplicate() {
  var item = proRequireNiche('pro-rep-result');
  if (!item) return;
  var channel = proNicheChannel(item);
  if (!channel) {
    setProResult('pro-rep-result', 'This scanned niche has no source channel. Use Search titles or Build a brand instead.', 'error');
    return;
  }
  var lang = document.getElementById('pro-rep-language').value || 'es';
  setProResult('pro-rep-result', 'Generating ideas to replicate', 'loading');

  try {
    var data = await proPost('/niche/replicate-content', {
      channel: channel,
      language: lang,
      maxVideos: 50,
      targetVideos: 5
    });
    renderProReplicateResult(data);
  } catch (err) {
    setProResult('pro-rep-result', 'PRO error: ' + (err && err.message ? err.message : err), 'error');
  }
}

function renderProReplicateResult(data) {
  var box = clearProResult('pro-rep-result');
  if (!box) return;
  var plans = proAsArray(proFirst(data, ['replicationPlans', 'videos', 'ideas', 'replications'], []));
  if (!plans.length) {
    appendProJson(box, data);
    return;
  }
  plans.slice(0, 5).forEach(function(plan, idx) {
    var item = makeProEl('div', 'pro-plan');
    item.appendChild(makeProEl('div', 'pro-plan-title', (idx + 1) + '. ' + proFirst(plan, ['title', 'videoTitle', 'idea'], 'Idea')));
    item.appendChild(makeProEl('div', 'pro-plan-line', 'Angle: ' + proFirst(plan, ['angle', 'concept'], 'n/a')));
    item.appendChild(makeProEl('div', 'pro-plan-line', 'Hook: ' + proFirst(plan, ['hook', 'openingHook'], 'n/a')));
    item.appendChild(makeProEl('div', 'pro-plan-line', 'Thumbnail: ' + proFirst(plan, ['thumbnailConcept', 'thumbnail'], 'n/a')));
    box.appendChild(item);
  });
}

async function runProBrand() {
  var item = proRequireNiche('pro-brand-result');
  if (!item) return;
  var niche = proCleanNiche(item);
  if (!niche) {
    setProResult('pro-brand-result', 'This scanned result has no usable niche.', 'error');
    return;
  }

  setProResult('pro-brand-result', 'Building a brand for the niche', 'loading');
  try {
    var data = await proPost('/niche/build-brand', {
      niche: niche,
      language: 'es',
      tone: document.getElementById('pro-brand-tone').value || 'professional',
      targetAudience: 'general'
    });
    renderProBrandResult(data);
  } catch (err) {
    setProResult('pro-brand-result', 'PRO error: ' + (err && err.message ? err.message : err), 'error');
  }
}

function renderProBrandResult(data) {
  var box = clearProResult('pro-brand-result');
  if (!box) return;
  var names = proAsArray(proFirst(data, ['channelNames', 'names'], []));
  var bio = proFirst(data, ['bio'], '');
  var visual = proFirst(data, ['visualIdentity'], {});
  var strategy = proFirst(data, ['contentStrategy', 'strategy'], {});

  box.appendChild(makeProEl('div', 'pro-result-head', names.length ? names.join(' | ') : proFirst(data, ['channelName', 'name'], 'Brand')));
  box.appendChild(makeProEl('div', 'pro-plan-line', 'Bio: ' + (typeof bio === 'string' ? bio : proFirst(bio, ['short', 'description', 'text'], JSON.stringify(bio)))));
  box.appendChild(makeProEl('div', 'pro-plan-line', 'Visual: ' + (typeof visual === 'string' ? visual : proFirst(visual, ['style', 'summary'], JSON.stringify(visual)))));
  box.appendChild(makeProEl('div', 'pro-plan-line', 'Strategy: ' + (typeof strategy === 'string' ? strategy : proFirst(strategy, ['summary', 'postingPlan'], JSON.stringify(strategy)))));
}

document.addEventListener('DOMContentLoaded', function() {
  load();

  var proHeaderBtn = document.getElementById('btn-pro-tools');
  if (proHeaderBtn) {
    proHeaderBtn.addEventListener('click', function() {
      openProPanel();
    });
  }
  var proLaunchBtn = document.getElementById('btn-pro-launch');
  if (proLaunchBtn) {
    proLaunchBtn.addEventListener('click', function() {
      openProPanel();
    });
  }

  // Source filter
  document.querySelectorAll('.pill:not(.sort):not(.niche)').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pill:not(.sort):not(.niche)').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  // Niche filter
  document.querySelectorAll('.pill.niche').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pill.niche').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeNiche = btn.dataset.niche;
      render();
    });
  });

  // Age filter
  document.querySelectorAll('.pill.age').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pill.age').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeAge = btn.dataset.age;
      render();
    });
  });

  // Sort
  document.querySelectorAll('.pill.sort').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pill.sort').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeSort = btn.dataset.sort;
      render();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', function() {
    searchQuery = this.value.trim();
    render();
  });

  // Clear
  document.getElementById('btn-clear').addEventListener('click', function() {
    if (!confirm('Remove EVERY saved channel?')) return;
    allChannels = [];
    chrome.storage.local.set({ nsp_all_channels: [] }, render);
  });

  // Export
  var growthBtn = document.getElementById('btn-growth');
  if (growthBtn) growthBtn.addEventListener('click', measureGrowth);
  var exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.addEventListener('click', openExportModal);

  var ideasBtn = document.getElementById('btn-ideas');
  if (ideasBtn) ideasBtn.addEventListener('click', openIdeasPanel);

  // Paused while the tab is hidden or a multi-selection is open, so bulk ops and scroll are not reset.
  setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    if (typeof selectedChannels === 'object' && selectedChannels && Object.keys(selectedChannels).length) return;
    load();
  }, 4000);
});

//  EXPORT (CSV / JSON) 
function getCurrentFilteredChannels() {
  // Re-apply current filters to allChannels
  return allChannels.filter(function(ch) {
    if (activeFilter !== 'ALL' && ch.source !== activeFilter) return false;
    if (activeNiche !== 'ALL') {
      var niche = ch.niche || '🔮 General';
      if (activeNiche === '🔮 General') {
        var mainNiches = ['🤖 AI','💻 Tech','💰 Finance','🏢 Business','📷 Camera','🎮 Gaming'];
        if (mainNiches.some(function(n) { return niche.indexOf(n.split(' ')[1]) !== -1; })) return false;
      } else if (niche !== activeNiche) return false;
    }
    if (activeAge !== 'ALL') {
      var d = ch.channelAgeDays;
      if (activeAge === 'EXPLODING') { if (!isExplodingChannel(ch)) return false; }
      else if (activeAge === 'LT3M') { if (!d || d > 90) return false; }
      else if (activeAge === 'LT6M') { if (!d || d > 180) return false; }
      else if (activeAge === 'LT1Y') { if (!d || d > 365) return false; }
      else if (activeAge === 'GT1Y') { if (!d || d <= 365) return false; }
    }
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      if (!(ch.name || '').toLowerCase().includes(q) && !(ch.niche || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function downloadFile(content, filename, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function exportAsJSON(channels) {
  var payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: 'ZERACK',
    totalChannels: channels.length,
    channels: channels
  };
  var stamp = new Date().toISOString().slice(0, 10);
  downloadFile(JSON.stringify(payload, null, 2), 'nsp-export-' + stamp + '.json', 'application/json');
}

function exportAsCSV(channels) {
  if (!channels.length) return;
  var headers = [
    'name', 'channelUrl', 'channelId', 'niche', 'subs', 'avgOS', 'topVPH',
    'revMonth', 'monetized', 'channelAgeDays', 'joinedDate', 'videoCount',
    'totalViews', 'source', 'savedAt', 'subGrowth'
  ];
  var rows = [headers.join(',')];
  channels.forEach(function(ch) {
    var row = headers.map(function(h) {
      var v = ch[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return v;
      var s = String(v).replace(/"/g, '""');
      return '"' + s + '"';
    });
    rows.push(row.join(','));
  });
  var stamp = new Date().toISOString().slice(0, 10);
  downloadFile(rows.join('\n'), 'nsp-export-' + stamp + '.csv', 'text/csv;charset=utf-8');
}

function openExportModal() {
  // Remove existing if open
  var existing = document.getElementById('nsp-export-modal');
  if (existing) { existing.remove(); return; }

  var backdrop = document.createElement('div');
  backdrop.id = 'nsp-export-modal';
  backdrop.className = 'nsp-modal-backdrop';

  var modal = document.createElement('div');
  modal.className = 'nsp-modal';
  backdrop.appendChild(modal);

  var filtered = getCurrentFilteredChannels();
  var totalAll = allChannels.length;
  var totalFiltered = filtered.length;

  modal.innerHTML = '<div class="nsp-modal-header">'
    + '  <div class="nsp-modal-title">Export channels</div>'
    + '  <button class="nsp-modal-close" id="nsp-export-close"></button>'
    + '</div>'
    + '<div class="nsp-modal-body">'
    + '  <div class="export-row">'
    + '    <label class="export-radio"><input type="radio" name="export-scope" value="filtered" checked> Filtered only (<strong>' + totalFiltered + '</strong>)</label>'
    + '    <label class="export-radio"><input type="radio" name="export-scope" value="all"> All (<strong>' + totalAll + '</strong>)</label>'
    + '  </div>'
    + '  <div class="export-row">'
    + '    <button class="export-format-btn" id="nsp-export-csv">Download CSV<small>Excel and Sheets ready</small></button>'
    + '    <button class="export-format-btn" id="nsp-export-json">Download JSON<small>For devs and re-import</small></button>'
    + '  </div>'
    + '  <div class="export-row">'
    + '    <button class="export-format-btn ghost" id="nsp-export-clipboard">Copy to clipboard as JSON</button>'
    + '  </div>'
    + '</div>';

  document.body.appendChild(backdrop);

  function getScope() {
    var checked = document.querySelector('input[name="export-scope"]:checked');
    return checked && checked.value === 'all' ? allChannels.slice() : filtered;
  }
  document.getElementById('nsp-export-close').onclick = function() { backdrop.remove(); };
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) backdrop.remove(); });
  document.getElementById('nsp-export-csv').onclick = function() { exportAsCSV(getScope()); backdrop.remove(); };
  document.getElementById('nsp-export-json').onclick = function() { exportAsJSON(getScope()); backdrop.remove(); };
  document.getElementById('nsp-export-clipboard').onclick = function() {
    var data = getScope();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(function() {
      var btn = document.getElementById('nsp-export-clipboard');
      btn.textContent = 'Copied ' + data.length + ' channels';
      setTimeout(function() { backdrop.remove(); }, 1200);
    });
  };
}

function openIdeasPanel() {
  var existing = document.getElementById('nsp-ideas-modal');
  if (existing) { existing.remove(); return; }

  var backdrop = document.createElement('div');
  backdrop.id = 'nsp-ideas-modal';
  backdrop.className = 'nsp-modal-backdrop';
  var modal = document.createElement('div');
  modal.className = 'nsp-modal nsp-modal-lg';
  backdrop.appendChild(modal);

  var filtered = getCurrentFilteredChannels();
  // Pick top channels by avgOS, then topVPH
  var top = filtered.slice().sort(function(a, b) {
    return (b.avgOS || 0) - (a.avgOS || 0) || (b.topVPH || 0) - (a.topVPH || 0);
  }).slice(0, 8);

  modal.innerHTML = '<div class="nsp-modal-header">'
    + '  <div class="nsp-modal-title">Video ideas, AI Coach</div>'
    + '  <button class="nsp-modal-close" id="nsp-ideas-close"></button>'
    + '</div>'
    + '<div class="nsp-modal-body">'
    + '  <div class="ideas-subhead">Claude reads your top ' + top.length + ' channels and writes 5 fresh ideas for today</div>'
    + '  <div class="ideas-channels" id="nsp-ideas-channels-preview"></div>'
    + '  <button class="export-format-btn" id="nsp-ideas-generate">Generate ideas with Claude</button>'
    + '  <div class="ideas-output" id="nsp-ideas-output"></div>'
    + '</div>';

  document.body.appendChild(backdrop);

  // Preview chips
  var preview = document.getElementById('nsp-ideas-channels-preview');
  top.forEach(function(ch) {
    var chip = document.createElement('span');
    chip.className = 'ideas-channel-chip';
    chip.textContent = (ch.name || '?').slice(0, 24);
    if (ch.niche) chip.title = ch.niche;
    preview.appendChild(chip);
  });

  document.getElementById('nsp-ideas-close').onclick = function() { backdrop.remove(); };
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) backdrop.remove(); });

  document.getElementById('nsp-ideas-generate').onclick = function() {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Asking Claude';
    var output = document.getElementById('nsp-ideas-output');
    output.innerHTML = '<div class="ideas-loading">Generating ideas, 5 to 15 seconds</div>';

    generateDailyIdeas(top).then(function(text) {
      output.innerHTML = '<div class="ideas-result"></div>';
      output.querySelector('.ideas-result').textContent = text;
      btn.textContent = 'Generate another round';
      btn.disabled = false;
    }).catch(function(err) {
      output.innerHTML = '<div class="ideas-error">' + (err && err.message ? err.message : 'Error') + '</div>'
        + '<div class="ideas-help">Check that your Claude API key is set in chrome.storage under ashlyv_api_key, in the sk-ant- format.</div>';
      btn.textContent = 'Try again';
      btn.disabled = false;
    });
  };
}

function generateDailyIdeas(channels) {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get('ashlyv_api_key', function(res) {
      var apiKey = res && res.ashlyv_api_key;
      if (!apiKey || !/^sk-ant-/.test(apiKey)) {
        reject(new Error('No Claude API key. Set one in options.'));
        return;
      }

      var summary = channels.map(function(ch, i) {
        return (i + 1) + '. ' + (ch.name || 'Channel')
          + ' (niche: ' + (ch.niche || 'General') + ', '
          + (ch.subs ? fmtN(ch.subs) + ' subs, ' : '')
          + (ch.topVPH ? 'top VPH ' + fmtN(ch.topVPH) + ', ' : '')
          + (ch.revMonth ? '$' + ch.revMonth + '/mo, ' : '')
          + (ch.channelAgeDays !== null && ch.channelAgeDays !== undefined ? 'age ' + fmtAge(ch.channelAgeDays) : '')
          + ')';
      }).join('\n');

      var prompt = 'You are an AI coach who knows faceless YouTube well. Read these channels from the user dashboard:\n\n'
        + summary
        + '\n\nWrite EXACTLY 5 fresh, repeatable video ideas for today. For each idea give:\n'
        + '1. A suggested title, clickable but not misleading, 70 characters at most\n'
        + '2. A one line hook for the first 8 seconds\n'
        + '3. Why it would work, based on the signals in the channels above\n'
        + '4. The target niche and an estimated RPM\n\n'
        + 'Format: numbered markdown. Be direct, no preamble. The ideas must ride trends visible in the channels above: same niche, same format, angles that are not saturated yet.';

      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20251022',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data && data.error) { reject(new Error(data.error.message || 'API error')); return; }
        var text = data && data.content && data.content[0] && data.content[0].text;
        if (!text) { reject(new Error('No answer from Claude')); return; }
        resolve(text);
      }).catch(function(err) {
        reject(err);
      });
    });
  });
}
