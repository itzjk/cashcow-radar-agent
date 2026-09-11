var allChannels = [];
var activeFilter = 'ALL';
var activeNiche  = 'ALL';
var activeAge    = 'ALL';
var activeSort   = 'savedAt';
var activeView   = 'cards';
var searchQuery  = '';
var selectedChannels = {};
var watchingCache = {};

function fmtAge(days) {
  if (days === null || days === undefined) return null;
  if (days < 7) return days + 'd';
  if (days < 30) return Math.round(days / 7) + 'w';
  if (days < 365) return Math.round(days / 30) + 'mo';
  var years = Math.floor(days / 365);
  var remMo = Math.round((days - years * 365) / 30);
  return remMo > 0 ? years + 'y ' + remMo + 'mo' : years + 'y';
}

// Same rules as isNewAndExploding in content/nsp-bundle.js, with the channel's best VPH
// where that copy uses the average VPH of a scan, which is not stored per channel.
function isExplodingChannel(ch) {
  if (!hasAge(ch) || ch.channelAgeDays > 365) return false;

  var subs = ch.subs || 0;
  var ageMonths = ch.channelAgeDays / 30;
  var subsPerMonth = ageMonths > 0 ? subs / ageMonths : 0;
  var avgViewsPerVideo = (ch.videoCount && ch.totalViews && ch.videoCount > 0)
    ? (ch.totalViews / ch.videoCount) : 0;
  var topVPH = ch.topVPH || 0;

  if (avgViewsPerVideo < 3000 && subsPerMonth < 1000 && subs < 1000) return false;

  if (ch.channelAgeDays <= 180 && subs <= 50000 && subs > 0) {
    if (topVPH >= 50 && avgViewsPerVideo >= 2000) return true;
    if (avgViewsPerVideo >= 50000) return true;
  }
  if (ch.channelAgeDays <= 300 && subsPerMonth >= 5000) return true;
  if (ch.channelAgeDays <= 90 && subs >= 1000) return true;
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

function load() {
  loadSnapshots();
  chrome.storage.local.get(['nsp_all_channels', 'nsp_watching'], function(res) {
    allChannels = res.nsp_all_channels || [];
    watchingCache = res.nsp_watching || {};
    render();
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

function buildNichePills() {
  var wrap = document.querySelector('.filter-group[data-group="niche"]');
  if (!wrap) return;
  var counts = {};
  allChannels.forEach(function(c) {
    var label = c.niche || '';
    if (!label) return;
    counts[label] = (counts[label] || 0) + 1;
  });
  var labels = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; }).slice(0, 12);
  wrap.textContent = '';
  var all = document.createElement('button');
  all.className = 'pill niche' + (activeNiche === 'ALL' ? ' active' : '');
  all.dataset.niche = 'ALL';
  all.textContent = 'All';
  wrap.appendChild(all);
  labels.forEach(function(label) {
    var b = document.createElement('button');
    b.className = 'pill niche' + (activeNiche === label ? ' active' : '');
    b.dataset.niche = label;
    b.textContent = label + ' ' + counts[label];
    wrap.appendChild(b);
  });
  wrap.querySelectorAll('.pill.niche').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeNiche = btn.dataset.niche;
      buildNichePills();
      render();
    });
  });
}

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function hasAge(ch) {
  return typeof ch.channelAgeDays === 'number' && isFinite(ch.channelAgeDays) && ch.channelAgeDays >= 0;
}

function measuredNumber(v) {
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : null;
}

function measuredValues(list, pick) {
  var out = [];
  list.forEach(function(c) {
    var v = pick(c);
    if (v !== null && v !== undefined) out.push(v);
  });
  return out;
}

function fmtSigned(n) {
  var r = Math.round(n);
  if (r > 0) return '+' + fmtN(r);
  if (r < 0) return '-' + fmtN(Math.abs(r));
  return '0';
}

function fmtSince(ts) {
  if (!ts) return null;
  var days = (Date.now() - ts) / 86400000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return Math.round(days) + 'd ago';
  return Math.round(days / 30) + 'mo ago';
}

var AGE_LABELS = {
  ALL: 'Any',
  EXPLODING: 'New and exploding',
  LT3M: 'under 3 months',
  LT6M: 'under 6 months',
  LT1Y: 'under 1 year',
  GT1Y: '1 year or older'
};

function channelMatchesFilters(ch) {
  if (activeFilter !== 'ALL' && ch.source !== activeFilter) return false;
  if (activeNiche !== 'ALL' && (ch.niche || '') !== activeNiche) return false;
  if (activeAge !== 'ALL') {
    var d = hasAge(ch) ? ch.channelAgeDays : null;
    if (activeAge === 'EXPLODING') { if (!isExplodingChannel(ch)) return false; }
    else if (d === null) return false;
    else if (activeAge === 'LT3M' && d > 90) return false;
    else if (activeAge === 'LT6M' && d > 180) return false;
    else if (activeAge === 'LT1Y' && d > 365) return false;
    else if (activeAge === 'GT1Y' && d <= 365) return false;
  }
  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    if (!(ch.name || '').toLowerCase().includes(q) &&
        !(ch.niche || '').toLowerCase().includes(q)) return false;
  }
  return true;
}

function sortChannels(list) {
  return list.sort(function(a, b) {
    if (activeSort === 'growth') {
      var ga = computeGrowth(a), gb = computeGrowth(b);
      var va = (ga.measurements >= 2 && !ga.tooClose) ? ga.subsPerDay : -Infinity;
      var vb = (gb.measurements >= 2 && !gb.tooClose) ? gb.subsPerDay : -Infinity;
      if (va === vb) return 0;
      return vb - va;
    }
    if (activeSort === 'savedAt')  return (b.savedAt || 0)  - (a.savedAt || 0);
    if (activeSort === 'subs')     return (b.subs || 0)     - (a.subs || 0);
    if (activeSort === 'avgOS')    return (b.avgOS || 0)    - (a.avgOS || 0);
    if (activeSort === 'topVPH')   return (b.topVPH || 0)   - (a.topVPH || 0);
    if (activeSort === 'revMonth') return (b.revMonth || 0) - (a.revMonth || 0);
    if (activeSort === 'channelAgeDays') {
      var aa = hasAge(a) ? a.channelAgeDays : Infinity;
      var bb = hasAge(b) ? b.channelAgeDays : Infinity;
      return aa - bb;
    }
    return 0;
  });
}

function activeFilterSummary() {
  var bits = [];
  if (activeFilter !== 'ALL') bits.push('Source: ' + (activeFilter === 'manual' ? 'Saved' : 'Scout'));
  if (activeNiche !== 'ALL') bits.push('Niche: ' + activeNiche);
  if (activeAge !== 'ALL') bits.push('Age: ' + (AGE_LABELS[activeAge] || activeAge));
  if (searchQuery) bits.push('Search: ' + searchQuery);
  return bits;
}

function syncPillGroup(selector, key, value) {
  document.querySelectorAll(selector).forEach(function(b) {
    if (b.dataset[key] === value) b.classList.add('active');
    else b.classList.remove('active');
  });
}

function resetFilters() {
  activeFilter = 'ALL';
  activeNiche = 'ALL';
  activeAge = 'ALL';
  searchQuery = '';
  var search = document.getElementById('search-input');
  if (search) search.value = '';
  syncPillGroup('.pill[data-filter]', 'filter', 'ALL');
  syncPillGroup('.pill.age', 'age', 'ALL');
  render();
}

function render() {
  buildNichePills();
  var list = sortChannels(getCurrentFilteredChannels());

  var count = document.getElementById('total-count');
  if (count) {
    count.textContent = list.length === allChannels.length
      ? allChannels.length + (allChannels.length === 1 ? ' channel' : ' channels')
      : list.length + ' of ' + allChannels.length + ' channels';
  }

  renderEmptyState(list);

  var grid = document.getElementById('grid');
  var tableHost = document.getElementById('table-view');
  grid.textContent = '';
  if (tableHost) tableHost.textContent = '';
  grid.style.display = (list.length && activeView === 'cards') ? 'grid' : 'none';
  if (tableHost) tableHost.style.display = (list.length && activeView === 'table') ? 'block' : 'none';

  if (list.length) {
    if (activeView === 'table' && tableHost) renderTable(list, tableHost);
    else list.forEach(function(ch) { grid.appendChild(buildCard(ch)); });
  }

  renderPortfolio(list);
}

function renderEmptyState(list) {
  var box = document.getElementById('empty-state');
  if (!box) return;
  box.textContent = '';
  if (list.length) { box.style.display = 'none'; return; }
  box.style.display = 'flex';

  if (!allChannels.length) {
    box.appendChild(el('div', 'empty-title', 'Nothing saved yet'));
    box.appendChild(el('div', 'empty-desc', 'Two ways to fill this page:'));
    var steps = document.createElement('ol');
    steps.className = 'empty-steps';
    [
      'Open a YouTube channel and press Save in the ZERACK bar. Saving from the channel page also reads its age, total views and video count.',
      'Run a scan on a YouTube search. Scout saves every channel it scores while you browse.'
    ].forEach(function(text) {
      steps.appendChild(el('li', null, text));
    });
    box.appendChild(steps);
    var cta = el('a', 'cta-btn', 'Go to YouTube');
    cta.href = 'https://www.youtube.com';
    cta.target = '_blank';
    box.appendChild(cta);
    return;
  }

  box.appendChild(el('div', 'empty-title', 'Nothing matches these filters'));
  var bits = activeFilterSummary();
  box.appendChild(el('div', 'empty-desc', bits.length
    ? 'Active filters: ' + bits.join('  ·  ')
    : 'All ' + allChannels.length + ' saved channels are hidden.'));
  if (activeAge !== 'ALL' && !allChannels.some(hasAge)) {
    box.appendChild(el('div', 'empty-desc', 'No saved channel has an age yet. The age is read from the channel About page when you save from the channel itself, so channels collected by Scout have none.'));
  }
  var clearBtn = el('button', 'cta-btn', 'Clear filters');
  clearBtn.addEventListener('click', resetFilters);
  box.appendChild(clearBtn);
}

function buildCard(ch) {
  var tier = ch.topTier || 'SLOW';
  var card = el('div', 'ch-card');
  card.dataset.tier = tier;

  var selCheck = document.createElement('input');
  selCheck.type = 'checkbox';
  selCheck.className = 'ch-select-check';
  selCheck.title = 'Select this channel for a bulk action';
  selCheck.checked = !!selectedChannels[ch.channelUrl];
  selCheck.addEventListener('click', function(e) { e.stopPropagation(); });
  selCheck.addEventListener('change', function() {
    if (selCheck.checked) selectedChannels[ch.channelUrl] = true;
    else delete selectedChannels[ch.channelUrl];
    updateBulkBar();
  });
  card.appendChild(selCheck);

  if (isExplodingChannel(ch)) {
    var explBadge = el('span', 'exploding-badge', 'NEW & EXPLODING');
    explBadge.title = 'Under a year old with measured traction: views per video, subscribers per month, or both';
    card.appendChild(explBadge);
  }

  var wrap = el('div', 'ch-avatar-wrap');
  if (ch.avatarUrl) {
    var img = document.createElement('img');
    img.className = 'ch-avatar';
    img.src = ch.avatarUrl;
    img.alt = ch.name || '';
    img.onerror = function() {
      wrap.textContent = '';
      wrap.appendChild(el('span', 'ch-avatar-placeholder', ((ch.name || '?')[0]).toUpperCase()));
    };
    wrap.appendChild(img);
  } else {
    wrap.appendChild(el('span', 'ch-avatar-placeholder', ((ch.name || '?')[0]).toUpperCase()));
  }
  card.appendChild(wrap);

  var body = el('div', 'ch-body');

  var nameEl = el('div', 'ch-name', ch.name || 'Channel');
  nameEl.title = ch.name || '';
  body.appendChild(nameEl);

  var chips = el('div', 'ch-chips');
  chips.appendChild(el('span', 'source-badge source-' + (ch.source || 'scout'),
    ch.source === 'manual' ? 'Saved by you' : 'Found by Scout'));
  if (ch.niche) chips.appendChild(el('span', 'ch-niche', ch.niche));
  body.appendChild(chips);

  var statsRow = el('div', 'ch-stats');
  function statBox(val, lbl, hint) {
    var box = el('div', 'ch-stat');
    box.appendChild(el('span', 'ch-stat-val', val));
    box.appendChild(el('span', 'ch-stat-lbl', lbl));
    if (hint) box.title = hint;
    return box;
  }

  var growth = computeGrowth(ch);
  if (growth.measurements >= 2 && !growth.tooClose) {
    statsRow.appendChild(statBox(fmtSigned(growth.subsPerDay), 'Subs/day',
      'Measured: ' + growth.measurements + ' readings over ' + Math.round(growth.days) + ' days'));
  }
  if (measuredNumber(ch.subs)) statsRow.appendChild(statBox(fmtN(ch.subs), 'Subs', 'Subscribers read from the channel page'));
  if (measuredNumber(ch.topVPH)) statsRow.appendChild(statBox(fmtN(ch.topVPH), 'Top VPH', 'Best views per hour seen on a video of this channel'));
  if (measuredNumber(ch.videosSeen)) statsRow.appendChild(statBox(String(ch.videosSeen), 'Videos seen', 'How many videos of this channel the scanner measured before saving it'));
  if (measuredNumber(ch.avgOS)) statsRow.appendChild(statBox(String(Math.round(ch.avgOS)), 'Score', 'Average opportunity score of the videos scanned'));
  if (measuredNumber(ch.revMonth)) statsRow.appendChild(statBox(fmtRev(ch.revMonth), 'Est. $/mo', 'Estimate: recent views times the RPM of the niche'));
  if (hasAge(ch)) statsRow.appendChild(statBox(fmtAge(ch.channelAgeDays), 'Age', ch.joinedDate ? 'Joined ' + ch.joinedDate : 'Read from the channel About page'));
  if (statsRow.children.length) body.appendChild(statsRow);

  var parts = [];
  if (ch.monetized === 'yes') parts.push('Monetized');
  else if (ch.monetized === 'likely') parts.push('Likely monetized');
  var since = fmtSince(ch.savedAt);
  if (since) parts.push('Saved ' + since);
  if (parts.length) body.appendChild(el('div', 'ch-meta', parts.join('  ·  ')));

  var openBtn = el('button', 'ch-open-btn', 'Open channel');
  openBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    chrome.tabs.create({ url: ch.channelUrl });
  });
  body.appendChild(openBtn);

  var labRow = el('div', 'ch-lab-row');

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

  labRow.appendChild(buildWatchButton(ch, 'ch-lab-btn'));

  var thumbBtn = el('button', 'ch-lab-btn', 'Thumb Lab');
  thumbBtn.title = 'Open the channel and launch Thumb Lab';
  thumbBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    launchLabAction('thumblab', thumbBtn, 'Opening');
  });
  labRow.appendChild(thumbBtn);

  var titleBtn = el('button', 'ch-lab-btn', 'Title Lab');
  titleBtn.title = 'Open the channel and launch Title Lab';
  titleBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    launchLabAction('titlelab', titleBtn, 'Opening');
  });
  labRow.appendChild(titleBtn);

  var rmBtn = el('button', 'ch-remove', 'Remove');
  rmBtn.title = 'Remove this channel from the list';
  rmBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    removeChannel(ch.channelUrl);
  });
  labRow.appendChild(rmBtn);

  body.appendChild(labRow);
  card.appendChild(body);
  card.addEventListener('click', function() {
    chrome.tabs.create({ url: ch.channelUrl });
  });
  return card;
}

function buildWatchButton(ch, className) {
  var btn = el('button', className);
  var isWatching = !!(watchingCache && watchingCache[ch.channelUrl]);
  btn.textContent = isWatching ? 'Watching' : 'Watch';
  btn.title = isWatching
    ? 'You get a notification when this channel posts an outlier, checked every 6 hours'
    : 'Click to turn on outlier alerts';
  if (isWatching) btn.classList.add('active');
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleWatch(ch, btn);
  });
  return btn;
}

var TABLE_COLUMNS = [
  { label: '', sort: '' },
  { label: 'Channel', sort: 'savedAt' },
  { label: 'Niche', sort: '' },
  { label: 'Source', sort: '' },
  { label: 'Subs', sort: 'subs', num: true },
  { label: 'Age', sort: 'channelAgeDays', num: true },
  { label: 'Top VPH', sort: 'topVPH', num: true },
  { label: 'Score', sort: 'avgOS', num: true },
  { label: 'Est. $/mo', sort: 'revMonth', num: true },
  { label: 'Subs/day', sort: 'growth', num: true },
  { label: '', sort: '' }
];

function renderTable(list, host) {
  var scroll = el('div', 'table-scroll');
  var table = el('table', 'ch-table');

  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  TABLE_COLUMNS.forEach(function(col) {
    var th = document.createElement('th');
    if (col.num) th.className = 'num';
    th.textContent = col.label;
    if (col.sort) {
      th.classList.add('sortable');
      if (activeSort === col.sort) {
        th.classList.add('sorted');
        th.appendChild(el('span', 'sort-caret', col.sort === 'channelAgeDays' ? '▲' : '▼'));
      }
      th.title = 'Sort by ' + col.label;
      th.addEventListener('click', function() {
        activeSort = col.sort;
        syncPillGroup('.pill.sort', 'sort', activeSort);
        render();
      });
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  list.forEach(function(ch) {
    tbody.appendChild(buildTableRow(ch));
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  host.appendChild(scroll);
  host.appendChild(el('div', 'table-note', 'A dash means the value was never measured. Age, total views and video count are read when you save from the channel page. Subs per day needs two measurements at least a day apart.'));
}

function buildTableRow(ch) {
  var row = document.createElement('tr');
  if (isExplodingChannel(ch)) row.classList.add('is-exploding');

  var selCell = document.createElement('td');
  var selCheck = document.createElement('input');
  selCheck.type = 'checkbox';
  selCheck.className = 'ch-select-check in-table';
  selCheck.title = 'Select this channel for a bulk action';
  selCheck.checked = !!selectedChannels[ch.channelUrl];
  selCheck.addEventListener('change', function() {
    if (selCheck.checked) selectedChannels[ch.channelUrl] = true;
    else delete selectedChannels[ch.channelUrl];
    updateBulkBar();
  });
  selCell.appendChild(selCheck);
  row.appendChild(selCell);

  var nameCell = document.createElement('td');
  var nameBtn = el('button', 'table-name', ch.name || 'Channel');
  nameBtn.title = 'Open ' + (ch.name || 'this channel') + ' on YouTube';
  nameBtn.addEventListener('click', function() { chrome.tabs.create({ url: ch.channelUrl }); });
  nameCell.appendChild(nameBtn);
  if (isExplodingChannel(ch)) nameCell.appendChild(el('span', 'table-flag', 'NEW & EXPLODING'));
  row.appendChild(nameCell);

  row.appendChild(cellText(ch.niche || ''));
  row.appendChild(cellText(ch.source === 'manual' ? 'Saved' : 'Scout'));
  row.appendChild(cellNum(measuredNumber(ch.subs) === null ? null : fmtN(ch.subs)));
  row.appendChild(cellNum(hasAge(ch) ? fmtAge(ch.channelAgeDays) : null));
  row.appendChild(cellNum(measuredNumber(ch.topVPH) === null ? null : fmtN(ch.topVPH)));
  row.appendChild(cellNum(measuredNumber(ch.avgOS) === null ? null : String(Math.round(ch.avgOS))));
  row.appendChild(cellNum(measuredNumber(ch.revMonth) === null ? null : fmtRev(ch.revMonth)));

  var growth = computeGrowth(ch);
  var growthCell = cellNum((growth.measurements >= 2 && !growth.tooClose) ? fmtSigned(growth.subsPerDay) : null);
  if (growth.measurements >= 2 && !growth.tooClose) {
    growthCell.title = growth.measurements + ' readings over ' + Math.round(growth.days) + ' days';
  } else if (growth.measurements === 1) {
    growthCell.title = 'One measurement so far, measure again tomorrow';
  } else if (growth.tooClose) {
    growthCell.title = 'Both measurements landed on the same day';
  }
  row.appendChild(growthCell);

  var actions = document.createElement('td');
  actions.className = 'table-actions';
  actions.appendChild(buildWatchButton(ch, 'table-btn'));
  var rm = el('button', 'table-btn danger', 'Remove');
  rm.title = 'Remove this channel from the list';
  rm.addEventListener('click', function() { removeChannel(ch.channelUrl); });
  actions.appendChild(rm);
  row.appendChild(actions);

  return row;
}

function cellText(text) {
  var td = document.createElement('td');
  td.textContent = text || '';
  return td;
}

function cellNum(text) {
  var td = document.createElement('td');
  td.className = 'num';
  if (text === null || text === undefined) {
    td.classList.add('unmeasured');
    td.textContent = '-';
    td.title = 'Never measured';
  } else {
    td.textContent = text;
  }
  return td;
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

function measureGrowth() {
  var btn = document.getElementById('btn-growth');
  var list = getCurrentFilteredChannels().slice(0, GROWTH_BATCH);
  if (!list.length) {
    alert(allChannels.length
      ? 'No channel matches these filters, so there is nothing to measure.'
      : 'Save a channel first.');
    return;
  }
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
  var arr = values.filter(function(v) { return typeof v === 'number' && isFinite(v); }).sort(function(a, b) { return a - b; });
  if (!arr.length) return null;
  var mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function coverageText(measured, total) {
  if (!total) return 'no channels in view';
  if (!measured) return 'not measured on any of the ' + total;
  return 'measured on ' + measured + ' of ' + total;
}

function pfSet(id, value, meta, small) {
  var v = document.getElementById(id);
  if (v) {
    v.textContent = value;
    if (small) v.classList.add('small');
    else v.classList.remove('small');
  }
  var m = document.getElementById(id + '-meta');
  if (m) m.textContent = meta || '';
}

function renderPortfolio(list) {
  var box = document.getElementById('portfolio');
  if (!box) return;
  var total = list.length;

  var scope = !allChannels.length ? 'nothing saved yet'
    : total === allChannels.length ? (total === 1 ? 'the only one saved' : 'every saved channel')
    : 'filtered out of ' + allChannels.length + ' saved';
  pfSet('pf-channels', String(total), scope);

  var subs = measuredValues(list, function(c) { return measuredNumber(c.subs); });
  var subsMed = medianOf(subs);
  pfSet('pf-subs', subsMed === null ? 'not measured' : fmtN(Math.round(subsMed)), coverageText(subs.length, total), subsMed === null);

  var vph = measuredValues(list, function(c) { return measuredNumber(c.topVPH); });
  var vphMed = medianOf(vph);
  pfSet('pf-vph', vphMed === null ? 'not measured' : fmtN(Math.round(vphMed)), coverageText(vph.length, total), vphMed === null);

  var revs = measuredValues(list, function(c) { return measuredNumber(c.revMonth); });
  var revSum = revs.reduce(function(acc, v) { return acc + v; }, 0);
  pfSet('pf-rev', revs.length ? fmtRev(Math.round(revSum)) : 'no estimate',
    revs.length ? 'added up over ' + revs.length + ' of ' + total : 'an estimate needs a scanned channel', !revs.length);

  var measuredGrowth = list.map(computeGrowth).filter(function(g) { return g.measurements >= 2 && !g.tooClose; });
  var growthMed = medianOf(measuredGrowth.map(function(g) { return g.subsPerDay; }));
  pfSet('pf-growth', growthMed === null ? 'not measured' : fmtSigned(growthMed) + ' subs/day',
    growthMed === null
      ? (total ? 'press Measure growth twice, a day apart' : 'no channels in view')
      : coverageText(measuredGrowth.length, total), true);

  var aged = list.filter(hasAge);
  pfSet('pf-exploding', String(list.filter(isExplodingChannel).length),
    !total ? 'no channels in view'
      : aged.length ? 'age known on ' + aged.length + ' of ' + total
      : 'no channel in view has an age yet');

  var byNiche = {};
  list.forEach(function(c) {
    var key = c.niche || 'unclassified';
    if (!byNiche[key]) byNiche[key] = { total: 0, scores: [] };
    byNiche[key].total++;
    var score = measuredNumber(c.avgOS);
    if (score !== null) byNiche[key].scores.push(score);
  });
  var best = null;
  Object.keys(byNiche).forEach(function(key) {
    var group = byNiche[key];
    if (group.scores.length < 2) return;
    var med = medianOf(group.scores);
    if (med === null) return;
    if (!best || med > best.median) best = { key: key, median: med, scored: group.scores.length, total: group.total };
  });
  if (best) {
    pfSet('pf-niche', best.key + '  ' + Math.round(best.median) + ' OS',
      'median of the ' + best.scored + ' scored channels of ' + best.total + ' in this niche', true);
  } else {
    pfSet('pf-niche', 'not enough scores', 'needs two channels with an opportunity score in the same niche', true);
  }
}

function removeChannel(url) {
  chrome.storage.local.get('nsp_all_channels', function(res) {
    var stored = Array.isArray(res.nsp_all_channels) ? res.nsp_all_channels : [];
    var next = stored.filter(function(c) { return c.channelUrl !== url; });
    delete selectedChannels[url];
    chrome.storage.local.set({ nsp_all_channels: next }, function() {
      allChannels = next;
      render();
    });
  });
}

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
      chrome.storage.local.get('nsp_all_channels', function(res) {
        var stored = Array.isArray(res.nsp_all_channels) ? res.nsp_all_channels : [];
        var next = stored.filter(function(c) { return urls.indexOf(c.channelUrl) === -1; });
        chrome.storage.local.set({ nsp_all_channels: next }, function() {
          allChannels = next;
          clearSelection();
          render();
        });
      });
    };
    document.getElementById('nsp-bulk-clear').onclick = clearSelection;
  }
  if (count === 0) { bar.remove(); return; }
  document.getElementById('nsp-bulk-count').textContent = count + ' selected';
}

function openIdeasPanelFor(channels) {
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
    + '<button class="nsp-modal-close" id="nsp-ideas-close-2">Close</button></div>'
    + '<div class="nsp-modal-body">'
    + '<div class="ideas-subhead">Five angles built from the channels you picked, written by the model you set in Options</div>'
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
    btn.textContent = 'Asking the model';
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
      watchingCache = watching;
      render();
      var bar = document.getElementById('nsp-bulk-count');
      if (bar) {
        var prev = bar.textContent;
        bar.textContent = '' + channels.length + ' channels on the watchlist';
        setTimeout(function() { bar.textContent = prev; }, 2000);
      }
      if (chrome.alarms) {
        chrome.alarms.get('nsp-trend-check', function(alarm) {
          if (!alarm) {
            chrome.alarms.create('nsp-trend-check', { periodInMinutes: 360 });
          }
        });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  load();

  document.querySelectorAll('.pill[data-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      syncPillGroup('.pill[data-filter]', 'filter', btn.dataset.filter);
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  document.querySelectorAll('.pill.age').forEach(function(btn) {
    btn.addEventListener('click', function() {
      syncPillGroup('.pill.age', 'age', btn.dataset.age);
      activeAge = btn.dataset.age;
      render();
    });
  });

  document.querySelectorAll('.pill.view').forEach(function(btn) {
    btn.addEventListener('click', function() {
      syncPillGroup('.pill.view', 'view', btn.dataset.view);
      activeView = btn.dataset.view;
      render();
    });
  });

  document.querySelectorAll('.pill.sort').forEach(function(btn) {
    btn.addEventListener('click', function() {
      syncPillGroup('.pill.sort', 'sort', btn.dataset.sort);
      activeSort = btn.dataset.sort;
      render();
    });
  });

  document.getElementById('search-input').addEventListener('input', function() {
    searchQuery = this.value.trim();
    render();
  });

  document.getElementById('btn-clear').addEventListener('click', function() {
    if (!confirm('Remove every saved channel? This cannot be undone.')) return;
    allChannels = [];
    chrome.storage.local.set({ nsp_all_channels: [] }, render);
  });

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

function getCurrentFilteredChannels() {
  return allChannels.filter(channelMatchesFilters);
}

function downloadFile(content, filename, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Revoking the object URL right after click() cancels the download in some browsers, so defer it.
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
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
    + '  <button class="nsp-modal-close" id="nsp-export-close">Close</button>'
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
  var top = filtered.slice().sort(function(a, b) {
    return (b.avgOS || 0) - (a.avgOS || 0) || (b.topVPH || 0) - (a.topVPH || 0);
  }).slice(0, 8);

  modal.innerHTML = '<div class="nsp-modal-header">'
    + '  <div class="nsp-modal-title">Video ideas</div>'
    + '  <button class="nsp-modal-close" id="nsp-ideas-close">Close</button>'
    + '</div>'
    + '<div class="nsp-modal-body">'
    + '  <div class="ideas-subhead">The model you set in Options reads your top ' + top.length + ' channels and writes five ideas for today</div>'
    + '  <div class="ideas-channels" id="nsp-ideas-channels-preview"></div>'
    + '  <button class="export-format-btn" id="nsp-ideas-generate">Generate ideas</button>'
    + '  <div class="ideas-output" id="nsp-ideas-output"></div>'
    + '</div>';

  document.body.appendChild(backdrop);

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
    btn.textContent = 'Asking the model';
    var output = document.getElementById('nsp-ideas-output');
    output.innerHTML = '<div class="ideas-loading">Generating ideas, 5 to 15 seconds</div>';

    generateDailyIdeas(top).then(function(text) {
      output.innerHTML = '<div class="ideas-result"></div>';
      output.querySelector('.ideas-result').textContent = text;
      btn.textContent = 'Generate another round';
      btn.disabled = false;
    }).catch(function(err) {
      output.innerHTML = '<div class="ideas-error">' + (err && err.message ? err.message : 'Error') + '</div>'
        + '<div class="ideas-help">Open Options, pick a model and add its key. Groq, Gemini and a local Ollama all work.</div>';
      btn.textContent = 'Try again';
      btn.disabled = false;
    });
  };
}


function generateDailyIdeas(channels) {
  return new Promise(function (resolve, reject) {
    var summary = channels.map(function (ch, i) {
      return (i + 1) + '. ' + (ch.name || 'channel') +
        ' | niche ' + (ch.niche || 'unclassified') +
        ' | ' + fmtN(ch.subs || 0) + ' subs' +
        (ch.topVPH ? ' | best ' + fmtN(ch.topVPH) + ' views per hour' : '') +
        (ch.channelAgeDays ? ' | ' + fmtAge(ch.channelAgeDays) + ' old' : '');
    }).join('\n');

    var prompt = 'These are the channels I track:\n' + summary +
      '\n\nGive me five video ideas I could publish this week, drawn from what these channels have in common and where they leave a gap. ' +
      'For each idea give the title exactly as it would appear on YouTube, the hook in one sentence, why it fits this set, and which of these channels it competes with. ' +
      'Be concrete, no generic advice, and answer in English.';

    chrome.runtime.sendMessage({
      type: 'ASHLYV_CHAT_REQUEST',
      payload: { messages: [{ role: 'user', content: prompt }], temperature: 0.7, maxTokens: 1200 }
    }, function (res) {
      var err = chrome.runtime && chrome.runtime.lastError;
      if (err) { reject(new Error(err.message)); return; }
      if (!res || !res.ok) {
        reject(new Error((res && (res.detail || res.error)) || 'No AI provider answered. Add a Groq or Gemini key in Options.'));
        return;
      }
      var text = res.text || res.content || '';
      if (!text) { reject(new Error('The model answered with nothing. Pick another model and try again.')); return; }
      resolve(text);
    });
  });
}
