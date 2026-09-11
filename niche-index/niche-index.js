'use strict';

var $ = function (id) { return document.getElementById(id); };
var state = { ix: null, sortKey: 'vphProm', sortDir: -1, q: '' };
var HAS_CHROME = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
var TREND_MIN_SCANS = 3;

function fmtN(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function fmtAgo(ts) {
  if (!ts) return '—';
  var m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return m + ' min';
  var h = Math.round(m / 60);
  if (h < 48) return h + ' h';
  return Math.round(h / 24) + ' d';
}

function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

// Every video of one scan is ingested with the same timestamp, so scans are counted by distinct minute, never by video.
function scanSeries(hist) {
  var buckets = {};
  (hist || []).forEach(function (h) {
    if (!h || !h.ts) return;
    var key = Math.floor(h.ts / 60000);
    if (!buckets[key]) buckets[key] = { ts: h.ts, sum: 0, n: 0 };
    buckets[key].sum += Number(h.v) || 0;
    buckets[key].n++;
  });
  return Object.keys(buckets).map(function (k) {
    return { ts: buckets[k].ts, mean: buckets[k].n ? buckets[k].sum / buckets[k].n : 0 };
  }).sort(function (a, b) { return a.ts - b.ts; });
}

function trendFromScans(series) {
  if (series.length < TREND_MIN_SCANS) return null;
  var half = Math.floor(series.length / 2), a = 0, b = 0;
  for (var i = 0; i < half; i++) a += series[i].mean;
  for (var j = half; j < series.length; j++) b += series[j].mean;
  var avgA = a / half, avgB = b / (series.length - half);
  if (avgA > 0) return (avgB - avgA) / avgA;
  if (avgB > 0) return 1;
  return 0;
}

function rowsFromIndex(ix) {
  var out = [];
  var niches = (ix && ix.niches) || {};
  Object.keys(niches).forEach(function (k) {
    var e = niches[k];
    if (!e || !e.vids) return;
    var series = scanSeries(Array.isArray(e.hist) ? e.hist : []);
    var trend = trendFromScans(series);
    var chNames = Object.keys(e.ch || {});
    chNames.sort(function (x, y) { return e.ch[y] - e.ch[x]; });
    var mkts = Object.keys(e.mkts || {});
    mkts.sort(function (x, y) { return e.mkts[y] - e.mkts[x]; });
    out.push({
      niche: e.n || k,
      vids: e.vids,
      scans: series.length,
      vphProm: e.vids ? Math.round(e.vphSum / e.vids) : 0,
      vphMax: Math.round(e.vphMax || 0),
      trend: trend,
      trendKnown: trend !== null,
      best: e.best || '',
      topChannel: chNames[0] || '',
      topChannelVids: chNames.length ? e.ch[chNames[0]] : 0,
      channelCount: chNames.length,
      channels: chNames.slice(0, 3).join(', '),
      channelsAll: chNames.join(', '),
      chCounts: e.ch || {},
      mkts: mkts.join(','),
      topMkt: mkts[0] || '',
      mktCounts: e.mkts || {},
      first: e.first || 0,
      last: e.last || 0
    });
  });
  return out;
}

function renderStats(ix, rows) {
  var box = $('stats');
  while (box.firstChild) box.removeChild(box.firstChild);
  function stat(v, k, title) {
    var d = document.createElement('div'); d.className = 'stat';
    if (title) d.title = title;
    var dv = document.createElement('div'); dv.className = 'v'; dv.textContent = v;
    var dk = document.createElement('div'); dk.className = 'k'; dk.textContent = k;
    d.appendChild(dv); d.appendChild(dk); box.appendChild(d);
  }
  var totVids = rows.reduce(function (a, r) { return a + r.vids; }, 0);
  var firstSeen = (ix && ix.meta && ix.meta.first) || rows.reduce(function (a, r) {
    return (r.first && (!a || r.first < a)) ? r.first : a;
  }, 0);
  stat(String(rows.length), 'Unique niches');
  stat(fmtN(totVids), 'Videos taken in');
  stat(String((ix && ix.meta && ix.meta.scans) || 0), 'Scans so far', 'Every scan that sent at least one video to the index.');
  stat((ix && ix.meta && ix.meta.last) ? (fmtAgo(ix.meta.last) + ' ago') : '—', 'Last scan');
  stat(firstSeen ? (fmtAgo(firstSeen) + ' ago') : '—', 'First scan');
}

function renderAnswers(rows) {
  var box = $('answers');
  var head = $('answers-head');
  while (box.firstChild) box.removeChild(box.firstChild);
  if (head) head.hidden = !rows.length;
  if (!rows.length) return;

  function card(question, answer, sample) {
    var d = document.createElement('div'); d.className = 'answer';
    var q = document.createElement('div'); q.className = 'a-q'; q.textContent = question;
    var a = document.createElement('div'); a.className = 'a-v'; a.textContent = answer;
    var s = document.createElement('div'); s.className = 'a-n'; s.textContent = sample;
    d.appendChild(q); d.appendChild(a); d.appendChild(s); box.appendChild(d);
  }
  function best(list, pick) {
    var top = null;
    list.forEach(function (r) { if (top === null || pick(r) > pick(top)) top = r; });
    return top;
  }
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

  var byAvg = best(rows, function (r) { return r.vphProm; });
  card('Which niche runs hottest per video',
    byAvg.niche + ' · ' + fmtN(byAvg.vphProm) + ' VPH average',
    'from ' + plural(byAvg.vids, 'video') + ' in ' + plural(byAvg.scans, 'scan'));

  var byMax = best(rows, function (r) { return r.vphMax; });
  card('The single strongest video seen',
    fmtN(byMax.vphMax) + ' VPH · ' + byMax.niche,
    short(byMax.best, 70) || 'no title stored for it');

  var chTotals = {}, chNiches = {};
  rows.forEach(function (r) {
    Object.keys(r.chCounts).forEach(function (name) {
      chTotals[name] = (chTotals[name] || 0) + r.chCounts[name];
      chNiches[name] = (chNiches[name] || 0) + 1;
    });
  });
  var chNames = Object.keys(chTotals).sort(function (a, b) { return chTotals[b] - chTotals[a]; });
  if (chNames.length) {
    card('The channel you keep running into',
      chNames[0],
      plural(chTotals[chNames[0]], 'video') + ' across ' + plural(chNiches[chNames[0]], 'niche'));
  } else {
    card('The channel you keep running into', 'Not yet', 'no scan has stored a channel name');
  }

  var withTrend = rows.filter(function (r) { return r.trendKnown; });
  if (withTrend.length) {
    var mover = best(withTrend, function (r) { return Math.abs(r.trend); });
    var pct = Math.round(mover.trend * 100);
    card('Which niche is moving',
      mover.niche + ' · ' + (pct >= 0 ? 'up ' + pct : 'down ' + Math.abs(pct)) + '%',
      'mean VPH per scan, ' + plural(mover.scans, 'scan') + ' of history');
  } else {
    var deepest = best(rows, function (r) { return r.scans; });
    card('Which niche is moving', 'Not yet',
      'a trend needs ' + TREND_MIN_SCANS + ' scans of one niche, the most so far is ' + plural(deepest.scans, 'scan') + ' in ' + deepest.niche);
  }

  var owned = rows.filter(function (r) { return r.vids >= 3 && r.topChannel; });
  if (owned.length) {
    var conc = best(owned, function (r) { return r.topChannelVids / r.vids; });
    card('Where one channel owns the niche',
      conc.niche + ' · ' + conc.topChannel,
      conc.topChannelVids + ' of ' + plural(conc.vids, 'video') + ' seen there, ' + plural(conc.channelCount, 'channel') + ' tracked');
  } else {
    card('Where one channel owns the niche', 'Not yet', 'no niche has 3 videos in the index yet');
  }

  var mktTotals = {};
  rows.forEach(function (r) {
    Object.keys(r.mktCounts).forEach(function (m) { mktTotals[m] = (mktTotals[m] || 0) + r.mktCounts[m]; });
  });
  var mktNames = Object.keys(mktTotals).sort(function (a, b) { return mktTotals[b] - mktTotals[a]; });
  if (mktNames.length) {
    var mktTotal = mktNames.reduce(function (a, m) { return a + mktTotals[m]; }, 0);
    card('Which market fed the index',
      mktNames[0],
      mktTotals[mktNames[0]] + ' of ' + plural(mktTotal, 'video') + ' · ' + mktNames.slice(0, 4).join(', '));
  }
}

function renderTable(rows, totalRows) {
  var wrap = $('tableWrap');
  while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  if (!rows.length) {
    var e = document.createElement('div');
    e.className = 'empty';
    if (totalRows && state.q) {
      e.textContent = 'Nothing here matches "' + state.q + '". Clear the search box to see all ' + plural(totalRows, 'niche') + '.';
    } else {
      var l1 = document.createElement('div');
      l1.textContent = 'The index is empty because no scan has run yet.';
      var l2 = document.createElement('div');
      l2.append('It fills itself: open YouTube, hit ');
      var b = document.createElement('b'); b.textContent = 'SCAN';
      l2.appendChild(b);
      l2.append(', and every scan writes the niches it saw here.');
      e.appendChild(l1); e.appendChild(l2);
    }
    wrap.appendChild(e);
    return;
  }
  var cols = [
    { k: 'niche', label: 'Niche', title: 'Sort by niche name' },
    { k: 'vids', label: 'Videos', title: 'Videos this niche has contributed to the index' },
    { k: 'scans', label: 'Scans', title: 'Distinct scan times, to the minute, among the videos kept for this niche' },
    { k: 'vphProm', label: 'Avg VPH', title: 'Total VPH divided by videos taken in' },
    { k: 'vphMax', label: 'Max VPH', title: 'Best single video seen in this niche' },
    { k: 'trend', label: 'Trend', title: 'Mean VPH per scan, first half against second half. Needs ' + TREND_MIN_SCANS + ' scans' },
    { k: 'topChannelVids', label: 'Top channel', title: 'The channel with most videos here, and how many of this niche videos it holds' },
    { k: 'best', label: 'Best title seen', title: 'Title of the highest VPH video' },
    { k: 'last', label: 'Seen', title: 'Last time a scan found this niche' }
  ];
  var table = document.createElement('table');
  var thead = document.createElement('tr');
  cols.forEach(function (c) {
    var th = document.createElement('th');
    th.textContent = c.label;
    if (state.sortKey === c.k) {
      var ar = document.createElement('span');
      ar.className = 'arrow';
      ar.textContent = state.sortDir > 0 ? '↑' : '↓';
      th.appendChild(ar);
      th.setAttribute('aria-sort', state.sortDir > 0 ? 'ascending' : 'descending');
      th.title = c.title + '. Sorted ' + (state.sortDir > 0 ? 'lowest first' : 'highest first') + ', click to flip.';
    } else {
      th.title = c.title;
    }
    th.addEventListener('click', function () {
      if (state.sortKey === c.k) state.sortDir = -state.sortDir;
      else { state.sortKey = c.k; state.sortDir = -1; }
      refresh();
    });
    thead.appendChild(th);
  });
  table.appendChild(thead);
  rows.forEach(function (r) {
    var tr = document.createElement('tr');
    function td(txt, cls, title) {
      var d = document.createElement('td');
      if (cls) d.className = cls;
      d.textContent = txt;
      if (title) d.title = title;
      tr.appendChild(d);
      return d;
    }
    td(r.niche, 'niche');
    td(String(r.vids), 'num');
    td(String(r.scans), 'num', r.scans === 1 ? 'Seen in one scan' : 'Seen in ' + r.scans + ' scans');
    td(fmtN(r.vphProm), 'num vph');
    td(fmtN(r.vphMax), 'num vph');
    var tCell = document.createElement('td');
    var tSpan = document.createElement('span');
    if (!r.trendKnown) {
      tSpan.className = 'flat';
      tSpan.textContent = '—';
      tSpan.title = 'A trend needs ' + TREND_MIN_SCANS + ' scans of this niche. This one has ' + plural(r.scans, 'scan') + '.';
    } else {
      var pct = Math.round(r.trend * 100);
      tSpan.className = pct > 15 ? 'up' : (pct < -15 ? 'down' : 'flat');
      tSpan.textContent = (pct > 0 ? '+' : '') + pct + '%';
      tSpan.title = 'Mean VPH per scan, first half against second half, over ' + plural(r.scans, 'scan') + '.';
    }
    tCell.appendChild(tSpan);
    tr.appendChild(tCell);
    var chCell = td(r.topChannel ? (r.topChannel + ' · ' + r.topChannelVids + '/' + r.vids) : '—', 'chs');
    chCell.title = r.channelsAll ? plural(r.channelCount, 'channel') + ' tracked: ' + r.channelsAll : 'No channel name stored for this niche.';
    var bCell = document.createElement('td');
    var bSpan = document.createElement('span');
    bSpan.className = 'best';
    bSpan.textContent = r.best || '—';
    bSpan.title = r.best || '';
    bCell.appendChild(bSpan);
    tr.appendChild(bCell);
    td(fmtAgo(r.last) + ' ago', 'chs', r.first ? 'First seen ' + fmtAgo(r.first) + ' ago' : '');
    table.appendChild(tr);
  });
  wrap.appendChild(table);
}

function refresh() {
  var all = rowsFromIndex(state.ix);
  var rows = all;
  var q = state.q.toLowerCase();
  if (q) {
    rows = rows.filter(function (r) {
      return r.niche.toLowerCase().indexOf(q) >= 0 ||
        (r.best || '').toLowerCase().indexOf(q) >= 0 ||
        (r.channelsAll || '').toLowerCase().indexOf(q) >= 0 ||
        (r.mkts || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  var k = state.sortKey, dir = state.sortDir;
  rows = rows.slice().sort(function (a, b) {
    var av = a[k], bv = b[k];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'string') return dir * String(av).localeCompare(String(bv));
    return dir * ((av || 0) - (bv || 0));
  });
  renderStats(state.ix, all);
  renderAnswers(all);
  renderTable(rows, all.length);
  $('foot').textContent = HAS_CHROME
    ? 'Data stays local in chrome.storage. Every SCAN feeds it, capped at 400 niches and the last 30 videos of history per niche. A trend needs ' + TREND_MIN_SCANS + ' scans of the same niche, so it stays empty until then.'
    : 'Preview without chrome.storage, showing made up rows. Open this page from the extension to see your real index.';
}

function load() {
  if (!HAS_CHROME) {
    var t0 = Date.now() - 7 * 86400000, t1 = Date.now() - 3 * 86400000, t2 = Date.now() - 600000;
    state.ix = { meta: { scans: 3, first: t0, last: t2 }, niches: {
      'medieval history': { n: 'medieval history', vids: 9, vphSum: 14620, vphMax: 3000, best: 'The queen who betrayed her own kingdom', ch: { 'Crown Chronicles': 5, 'Dark Ages': 4 }, mkts: { global: 6, germany: 3 }, first: t0, last: t2, hist: [
        { ts: t0, v: 700 }, { ts: t0, v: 820 }, { ts: t0, v: 900 },
        { ts: t1, v: 1500 }, { ts: t1, v: 1300 }, { ts: t1, v: 1900 },
        { ts: t2, v: 2400 }, { ts: t2, v: 2100 }, { ts: t2, v: 3000 }
      ] },
      'space mystery': { n: 'space mystery', vids: 6, vphSum: 4170, vphMax: 1000, best: 'What NASA found and never explained', ch: { 'Void Files': 4 }, mkts: { global: 6 }, first: t0, last: t2, hist: [
        { ts: t0, v: 900 }, { ts: t0, v: 1000 },
        { ts: t1, v: 700 }, { ts: t1, v: 640 },
        { ts: t2, v: 500 }, { ts: t2, v: 430 }
      ] },
      'sleep frequencies': { n: 'sleep frequencies', vids: 3, vphSum: 840, vphMax: 300, best: 'Eight hours of deep sleep tones', ch: { 'Pulse Sleep': 3 }, mkts: { global: 3 }, first: t2, last: t2, hist: [
        { ts: t2, v: 300 }, { ts: t2, v: 280 }, { ts: t2, v: 260 }
      ] }
    } };
    refresh();
    return;
  }
  chrome.storage.local.get(['nsp_niche_index_v1'], function (st) {
    state.ix = (st && st.nsp_niche_index_v1) || { meta: { scans: 0 }, niches: {} };
    refresh();
  });
}

var _searchDeb = null;
$('search').addEventListener('input', function () {
  state.q = this.value.trim();
  clearTimeout(_searchDeb);
  _searchDeb = setTimeout(refresh, 250);
});

$('btnExport').addEventListener('click', function () {
  var rows = rowsFromIndex(state.ix);
  if (!rows.length) {
    $('foot').textContent = 'Nothing to export yet. Run a SCAN on YouTube and the index fills itself.';
    return;
  }
  var head = 'niche,videos,scans,avg_vph,max_vph,trend_pct,top_channel,top_channel_videos,channels_tracked,best_title,markets,first_ts,last_ts\n';
  var csv = head + rows.map(function (r) {
    function esc(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; }
    return [esc(r.niche), r.vids, r.scans, r.vphProm, r.vphMax, r.trendKnown ? Math.round(r.trend * 100) : '', esc(r.topChannel), r.topChannelVids, r.channelCount, esc(r.best), esc(r.mkts), r.first, r.last].join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'zerack-niche-index.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 2000);
});

$('btnClear').addEventListener('click', function () {
  if (!confirm('Delete the whole index you have built up? This cannot be undone.')) return;
  if (HAS_CHROME) chrome.storage.local.remove('nsp_niche_index_v1', function () { load(); });
  else { state.ix = { meta: { scans: 0 }, niches: {} }; refresh(); }
});

if (HAS_CHROME && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.nsp_niche_index_v1) load();
  });
}

load();
