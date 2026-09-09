// NSP Channel Hub — unified dashboard

var allChannels = [];
var activeFilter = 'ALL';
var activeNiche  = 'ALL';
var activeAge    = 'ALL';
var activeSort   = 'savedAt';
var searchQuery  = '';
var scannedNichos = [];
var selectedChannels = {}; // key: channelUrl → bool
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
  var bits = [item.niche || 'Nicho escaneado'];
  if (item.title) bits.push(item.title);
  if (item.language && item.language !== 'unknown') bits.push(String(item.language).toUpperCase());
  if (item.vph) bits.push('VPH ' + fmtN(item.vph));
  if (item.revMonth) bits.push(fmtRev(item.revMonth) + '/mes');
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
      btn.title = 'Click para activar alertas de outliers';
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
      btn.title = 'Recibes notif. cuando publique outliers (cada 6h)';
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
        // "Otros" catches anything not in main niches
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
      explBadge.textContent = '💎 NEW & EXPLODING';
      explBadge.title = '<6 meses + <50K subs + alta tracción';
      card.appendChild(explBadge);
    }

    // Remove btn
    var rmBtn = document.createElement('button');
    rmBtn.className = 'ch-remove';
    rmBtn.textContent = '✕';
    rmBtn.title = 'Eliminar';
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
    nameEl.textContent = ch.name || 'Canal';
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
    if (ch.subs && !statsRow.querySelector('[data-lbl="Subs"]')) parts.push('👥 ' + fmtN(ch.subs));
    if (ch.monetized === 'yes') parts.push('✅ Mon.');
    else if (ch.monetized === 'likely') parts.push('🟡 Prob. Mon.');
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
    watchBtn.title = isWatching ? 'Recibes notif. cuando publique outliers (cada 6h)' : 'Click para activar alertas de outliers';
    if (isWatching) watchBtn.classList.add('active');
    watchBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleWatch(ch, watchBtn);
    });
    labRow.appendChild(watchBtn);

    var thumbBtn = document.createElement('button');
    thumbBtn.className = 'ch-lab-btn';
    thumbBtn.textContent = '🎨 Thumb Lab';
    thumbBtn.title = 'Abre el canal y lanza Thumb Lab';
    thumbBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      launchLabAction('thumblab', thumbBtn, 'Abriendo...');
    });
    labRow.appendChild(thumbBtn);

    var titleBtn = document.createElement('button');
    titleBtn.className = 'ch-lab-btn';
    titleBtn.textContent = '✏️ Title Lab';
    titleBtn.title = 'Abre el canal y lanza Title Lab';
    titleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      launchLabAction('titlelab', titleBtn, 'Abriendo...');
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

// ── BULK OPERATIONS ─────────────────────────────────────────────────────────
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
    bar.innerHTML = '<span class="nsp-bulk-count" id="nsp-bulk-count">0 seleccionados</span>'
      + '<button class="nsp-bulk-btn" id="nsp-bulk-export">📥 Export selección</button>'
      + '<button class="nsp-bulk-btn" id="nsp-bulk-ideas">💡 Ideas con estos</button>'
      + '<button class="nsp-bulk-btn" id="nsp-bulk-watch">🔔 Watch (alertas)</button>'
      + '<button class="nsp-bulk-btn danger" id="nsp-bulk-delete">🗑 Borrar</button>'
      + '<button class="nsp-bulk-btn ghost" id="nsp-bulk-clear">✕ Limpiar selección</button>';
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
  document.getElementById('nsp-bulk-count').textContent = count + ' seleccionado' + (count !== 1 ? 's' : '');
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
    + '<button class="nsp-modal-close" id="nsp-ideas-close-2">✕</button></div>'
    + '<div class="nsp-modal-body">'
    + '<div class="ideas-subhead">Five fresh angles built from the channels you picked</div>'
    + '<div class="ideas-channels" id="nsp-ideas-preview-2"></div>'
    + '<button class="export-format-btn" id="nsp-ideas-gen-2">⚡ Generar ideas</button>'
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
    btn.textContent = '⚡ Consultando Claude...';
    var out = document.getElementById('nsp-ideas-out-2');
    out.innerHTML = '<div class="ideas-loading">Generando ideas...</div>';
    generateDailyIdeas(top).then(function(text) {
      out.innerHTML = '<div class="ideas-result"></div>';
      out.querySelector('.ideas-result').textContent = text;
      btn.textContent = '🔄 Generar otra ronda';
      btn.disabled = false;
    }).catch(function(err) {
      out.innerHTML = '<div class="ideas-error">⚠️ ' + (err && err.message ? err.message : 'Error') + '</div>';
      btn.textContent = '🔄 Reintentar';
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
  titleWrap.appendChild(makeProEl('div', 'pro-panel-subtitle', 'Selecciona un nicho escaneado y ejecuta tools solo con esa lista.'));
  header.appendChild(titleWrap);

  var closeBtn = makeProEl('button', 'pro-close-btn', 'X');
  closeBtn.id = 'pro-close-btn';
  closeBtn.title = 'Cerrar';
  closeBtn.addEventListener('click', closeProPanel);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  var selectBlock = makeProEl('div', 'pro-select-block');
  var label = makeProEl('label', 'pro-label', 'Nicho escaneado');
  label.setAttribute('for', 'pro-niche-select');
  selectBlock.appendChild(label);

  var selectRow = makeProEl('div', 'pro-select-row');
  var select = makeProEl('select', 'pro-select');
  select.id = 'pro-niche-select';
  select.addEventListener('change', updateProSelectedNiche);
  selectRow.appendChild(select);

  var openBtn = makeProEl('button', 'pro-secondary-btn', 'ABRIR FUENTE');
  openBtn.id = 'pro-open-source';
  openBtn.addEventListener('click', function() {
    var item = getSelectedProNiche();
    var url = item ? (item.channelUrl || (item.vidId ? 'https://www.youtube.com/watch?v=' + item.vidId : '')) : '';
    if (url) chrome.tabs.create({ url: url });
  });
  selectRow.appendChild(openBtn);
  selectBlock.appendChild(selectRow);

  var summary = makeProEl('div', 'pro-selected-summary', 'Selecciona un nicho del ultimo scan para ver sus tools PRO.');
  summary.id = 'pro-selected-summary';
  selectBlock.appendChild(summary);
  panel.appendChild(selectBlock);

  var tools = makeProEl('div', 'pro-tools-grid');
  panel.appendChild(tools);

  var scanCard = makeProCard('Scan nicho', 'Resumen del nicho escaneado y, si hay canal, edad/viral metrics.');
  var scanBtn = makeProAction('pro-run-scan', 'SCAN NICHO');
  scanCard.appendChild(scanBtn);
  scanCard.appendChild(makeProResult('pro-scan-result', 'Aqui saldra el resumen del scan.'));
  tools.appendChild(scanCard);

  var titlesCard = makeProCard('Buscar titulos', 'Busca oportunidades usando solo el nicho seleccionado.');
  titlesCard.appendChild(makeProAction('pro-run-titles', 'BUSCAR TITULOS'));
  titlesCard.appendChild(makeProResult('pro-title-result', 'Resultados de busqueda por titulo.'));
  tools.appendChild(titlesCard);

  var globalCard = makeProCard('Matrix global', 'Compara el nicho seleccionado por idioma y oportunidad.');
  globalCard.appendChild(makeProAction('pro-run-global', 'ANALIZAR GLOBAL'));
  globalCard.appendChild(makeProResult('pro-global-result', 'Score global del nicho seleccionado.'));
  tools.appendChild(globalCard);

  var repCard = makeProCard('Replicar contenido', 'Genera ideas listas para producir basadas en la fuente del nicho.');
  repCard.appendChild(makeProSelect('pro-rep-language', 'Idioma', [
    ['es', 'Espanol'],
    ['en', 'English'],
    ['pt', 'Portugues']
  ]));
  repCard.appendChild(makeProAction('pro-run-replicate', 'REPLICAR'));
  repCard.appendChild(makeProResult('pro-rep-result', 'Ideas de replicacion del canal.'));
  tools.appendChild(repCard);

  var brandCard = makeProCard('Crear marca', 'Nombres, bio, identidad visual y estrategia para el nicho seleccionado.');
  brandCard.appendChild(makeProSelect('pro-brand-tone', 'Tono', [
    ['professional', 'Professional'],
    ['mysterious', 'Mysterious'],
    ['bold', 'Bold'],
    ['educational', 'Educational']
  ]));
  brandCard.appendChild(makeProAction('pro-run-brand', 'CREAR MARCA'));
  brandCard.appendChild(makeProResult('pro-brand-result', 'Kit de marca para el nicho.'));
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
  placeholder.textContent = scannedNichos.length ? 'Selecciona un nicho escaneado...' : 'No hay nichos escaneados';
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
    summary.textContent = scannedNichos.length ? 'Selecciona un nicho de la lista escaneada para usar PRO.' : 'Aun no hay nichos escaneados. Corre un scan y guarda/abre resultados primero.';
    return;
  }

  var details = [];
  if (item.language && item.language !== 'unknown') details.push('Idioma: ' + String(item.language).toUpperCase());
  if (item.vph) details.push('VPH: ' + fmtN(item.vph));
  if (item.views) details.push('Views: ' + fmtN(item.views));
  if (item.revMonth) details.push('Mes: ' + fmtRev(item.revMonth));
  if (item.facelessScore) details.push('Faceless: ' + Math.round(item.facelessScore) + '%');
  summary.textContent = (item.niche || 'Nicho') + ' - ' + (item.title || details.join(' | ') || 'resultado escaneado');

  var selectedValue = proNicheLabel(item);
  if (summary.dataset.channelValue !== selectedValue) {
    summary.dataset.channelValue = selectedValue;
  }
}

function proRequireNiche(resultId) {
  var item = getSelectedProNiche();
  if (!item) {
    setProResult(resultId, 'Primero selecciona un nicho escaneado de la lista.', 'error');
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
  setProResult('pro-scan-result', 'Analizando el nicho escaneado seleccionado...', 'loading');

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
  head.textContent = item.niche || proFirst(channel, ['title', 'name', 'channelTitle'], 'Nicho analizado');
  box.appendChild(head);

  var grid = makeProEl('div', 'pro-metric-grid');
  grid.appendChild(proMetric('Nicho', item.niche || 'General'));
  grid.appendChild(proMetric('Idioma', (item.language || 'unknown').toUpperCase()));
  grid.appendChild(proMetric('VPH scan', fmtN(item.vph || 0), item.vph >= 100 ? 'ok' : 'warn'));
  grid.appendChild(proMetric('Views scan', fmtN(item.views || 0)));
  grid.appendChild(proMetric('RPM scan', item.rpm ? '$' + Number(item.rpm).toFixed(2) : 'n/a'));
  grid.appendChild(proMetric('Ingreso mes', fmtRev(item.revMonth || 0), item.revMonth ? 'ok' : ''));
  grid.appendChild(proMetric('Faceless', item.facelessScore ? Math.round(item.facelessScore) + '%' : 'n/a', item.facelessScore >= 70 ? 'ok' : 'warn'));
  grid.appendChild(proMetric('Fuente', item.channelUrl ? 'Canal' : (item.vidId ? 'Video' : 'Scan')));
  if (age) {
    grid.appendChild(proMetric('Edad canal', age.monthsOld !== null && age.monthsOld !== undefined ? age.monthsOld + ' meses' : 'n/a', pass === true ? 'ok' : (pass === false ? 'bad' : '')));
    grid.appendChild(proMetric('Creado', age.createdDate || age.publishedAt || 'n/a'));
  }
  if (viral) {
    grid.appendChild(proMetric('Virales', String(metrics.viralVideoCount || 0), metrics.viralVideoCount >= 10 ? 'ok' : 'warn'));
    grid.appendChild(proMetric('Ratio viral', ratioText, ratio >= 0.2 ? 'ok' : 'warn'));
    grid.appendChild(proMetric('Velocidad', metrics.velocityTier || 'n/a', metrics.velocityTier === 'EXPLOSIVE' || metrics.velocityTier === 'HIGH' ? 'ok' : ''));
    grid.appendChild(proMetric('Views/sem', fmtN(metrics.weeklyViewVelocity || 0)));
  }
  box.appendChild(grid);

  var videos = proAsArray(metrics.viralVideos).slice(0, 6);
  if (videos.length) {
    box.appendChild(makeProEl('div', 'pro-list-title', 'Top videos virales'));
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
    setProResult('pro-title-result', 'Este resultado escaneado no tiene nicho/titulo usable.', 'error');
    return;
  }

  setProResult('pro-title-result', 'Buscando titulos y canales...', 'loading');
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
  title.textContent = 'Subnicho: ' + proFirst(data, ['subNiche', 'subniche', 'query'], 'n/a') + ' | RPM: ' + proFirst(data, ['estimatedRpm', 'rpm', 'RPM'], 'n/a');
  box.appendChild(title);

  var rows = channels.length ? channels.slice(0, 6) : videos.slice(0, 6);
  rows.forEach(function(item) {
    var row = makeProEl('div', 'pro-video-row');
    row.appendChild(makeProEl('span', 'pro-video-title', proFirst(item, ['name', 'channel', 'title'], 'Resultado')));
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
    setProResult('pro-global-result', 'Este resultado escaneado no tiene nicho usable.', 'error');
    return;
  }
  setProResult('pro-global-result', 'Analizando oportunidad global...', 'loading');
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
    item.appendChild(makeProEl('span', 'pro-video-title', proFirst(row, ['language', 'code', 'name'], 'Idioma')));
    item.appendChild(makeProEl('strong', 'pro-video-views', String(proFirst(row, ['score', 'value', 'verdict'], 'n/a'))));
    box.appendChild(item);
  });
}

async function runProReplicate() {
  var item = proRequireNiche('pro-rep-result');
  if (!item) return;
  var channel = proNicheChannel(item);
  if (!channel) {
    setProResult('pro-rep-result', 'Este nicho escaneado no trae canal fuente. Usa Buscar titulos o Crear marca.', 'error');
    return;
  }
  var lang = document.getElementById('pro-rep-language').value || 'es';
  setProResult('pro-rep-result', 'Generando ideas para replicar...', 'loading');

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
    setProResult('pro-brand-result', 'Este resultado escaneado no tiene nicho usable.', 'error');
    return;
  }

  setProResult('pro-brand-result', 'Creando marca para el nicho...', 'loading');
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

  box.appendChild(makeProEl('div', 'pro-result-head', names.length ? names.join(' | ') : proFirst(data, ['channelName', 'name'], 'Marca')));
  box.appendChild(makeProEl('div', 'pro-plan-line', 'Bio: ' + (typeof bio === 'string' ? bio : proFirst(bio, ['short', 'description', 'text'], JSON.stringify(bio)))));
  box.appendChild(makeProEl('div', 'pro-plan-line', 'Visual: ' + (typeof visual === 'string' ? visual : proFirst(visual, ['style', 'summary'], JSON.stringify(visual)))));
  box.appendChild(makeProEl('div', 'pro-plan-line', 'Estrategia: ' + (typeof strategy === 'string' ? strategy : proFirst(strategy, ['summary', 'postingPlan'], JSON.stringify(strategy)))));
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
  var exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.addEventListener('click', openExportModal);

  // Ideas Hoy (Claude AI)
  var ideasBtn = document.getElementById('btn-ideas');
  if (ideasBtn) ideasBtn.addEventListener('click', openIdeasPanel);

  // Auto-refresh — pausado si la pestaña está oculta (CPU) o si hay multi-selección activa (no pisar Bulk ops ni el scroll)
  setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    if (typeof selectedChannels === 'object' && selectedChannels && Object.keys(selectedChannels).length) return;
    load();
  }, 4000);
});

// ── EXPORT (CSV / JSON) ─────────────────────────────────────────────────────
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
    + '  <button class="nsp-modal-close" id="nsp-export-close">✕</button>'
    + '</div>'
    + '<div class="nsp-modal-body">'
    + '  <div class="export-row">'
    + '    <label class="export-radio"><input type="radio" name="export-scope" value="filtered" checked> Solo filtrados (<strong>' + totalFiltered + '</strong>)</label>'
    + '    <label class="export-radio"><input type="radio" name="export-scope" value="all"> All (<strong>' + totalAll + '</strong>)</label>'
    + '  </div>'
    + '  <div class="export-row">'
    + '    <button class="export-format-btn" id="nsp-export-csv">📊 Descargar CSV<small>Excel / Sheets ready</small></button>'
    + '    <button class="export-format-btn" id="nsp-export-json">📦 Descargar JSON<small>Para devs / re-import</small></button>'
    + '  </div>'
    + '  <div class="export-row">'
    + '    <button class="export-format-btn ghost" id="nsp-export-clipboard">📋 Copiar al portapapeles (JSON)</button>'
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
      btn.textContent = '✓ Copiado ' + data.length + ' channels';
      setTimeout(function() { backdrop.remove(); }, 1200);
    });
  };
}

// ── IDEAS HOY (Claude AI sobre canales guardados) ────────────────────────────
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
    + '  <div class="nsp-modal-title">💡 Ideas de video — AI Coach</div>'
    + '  <button class="nsp-modal-close" id="nsp-ideas-close">✕</button>'
    + '</div>'
    + '<div class="nsp-modal-body">'
    + '  <div class="ideas-subhead">Claude analizará tus top ' + top.length + ' canales y generará 5 ideas frescas para hoy</div>'
    + '  <div class="ideas-channels" id="nsp-ideas-channels-preview"></div>'
    + '  <button class="export-format-btn" id="nsp-ideas-generate">⚡ Generar ideas con Claude</button>'
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
    btn.textContent = '⚡ Consultando Claude...';
    var output = document.getElementById('nsp-ideas-output');
    output.innerHTML = '<div class="ideas-loading">Generando ideas (5-15s)...</div>';

    generateDailyIdeas(top).then(function(text) {
      output.innerHTML = '<div class="ideas-result"></div>';
      output.querySelector('.ideas-result').textContent = text;
      btn.textContent = '🔄 Generar otra ronda';
      btn.disabled = false;
    }).catch(function(err) {
      output.innerHTML = '<div class="ideas-error">⚠️ ' + (err && err.message ? err.message : 'Error') + '</div>'
        + '<div class="ideas-help">Verifica que tengas tu API key de Claude configurada en chrome.storage (ashlyv_api_key, formato sk-ant-...).</div>';
      btn.textContent = '🔄 Reintentar';
      btn.disabled = false;
    });
  };
}

function generateDailyIdeas(channels) {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get('ashlyv_api_key', function(res) {
      var apiKey = res && res.ashlyv_api_key;
      if (!apiKey || !/^sk-ant-/.test(apiKey)) {
        reject(new Error('No hay API key de Claude. Configúrala en options.'));
        return;
      }

      var summary = channels.map(function(ch, i) {
        return (i + 1) + '. ' + (ch.name || 'Canal')
          + ' (niche: ' + (ch.niche || 'General') + ', '
          + (ch.subs ? fmtN(ch.subs) + ' subs, ' : '')
          + (ch.topVPH ? 'top VPH ' + fmtN(ch.topVPH) + ', ' : '')
          + (ch.revMonth ? '$' + ch.revMonth + '/mes, ' : '')
          + (ch.channelAgeDays !== null && ch.channelAgeDays !== undefined ? 'edad ' + fmtAge(ch.channelAgeDays) : '')
          + ')';
      }).join('\n');

      var prompt = 'Eres un AI Coach experto en YouTube faceless. Analiza estos canales del dashboard del usuario:\n\n'
        + summary
        + '\n\nGenera EXACTAMENTE 5 ideas de video frescas y replicables para HOY. Para cada idea:\n'
        + '1. Título sugerido (clickbait pero no engañoso, máx 70 chars)\n'
        + '2. Hook de 1 línea (primeros 8 segundos)\n'
        + '3. Por qué funcionaría (basado en señales de los canales arriba)\n'
        + '4. Nicho objetivo + RPM estimado\n\n'
        + 'Formato: markdown numerado. Sé directo, sin intro. Las ideas deben aprovechar tendencias que ves en los canales arriba (mismo nicho, mismo formato, ángulos no saturados).';

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
        if (!text) { reject(new Error('Sin respuesta de Claude')); return; }
        resolve(text);
      }).catch(function(err) {
        reject(err);
      });
    });
  });
}
