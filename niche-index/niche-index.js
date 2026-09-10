'use strict';

var $ = function (id) { return document.getElementById(id); };
var state = { ix: null, sortKey: 'vphProm', sortDir: -1, q: '' };
var HAS_CHROME = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);

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

function rowsFromIndex(ix) {
  var out = [];
  var niches = (ix && ix.niches) || {};
  Object.keys(niches).forEach(function (k) {
    var e = niches[k];
    if (!e || !e.vids) return;
    var hist = Array.isArray(e.hist) ? e.hist : [];
    var trend = 0;
    var trendKnown = hist.length >= 6;
    if (hist.length >= 6) {
      var half = Math.floor(hist.length / 2), a = 0, b = 0;
      for (var i = 0; i < half; i++) a += hist[i].v || 0;
      for (var j = half; j < hist.length; j++) b += hist[j].v || 0;
      var avgA = a / half, avgB = b / (hist.length - half);
      if (avgA > 0) trend = (avgB - avgA) / avgA;
      else if (avgB > 0) trend = 1;
    }
    var chNames = Object.keys(e.ch || {});
    chNames.sort(function (x, y) { return e.ch[y] - e.ch[x]; });
    var mkts = Object.keys(e.mkts || {});
    out.push({
      niche: e.n || k,
      vids: e.vids,
      vphProm: e.vids ? Math.round(e.vphSum / e.vids) : 0,
      vphMax: Math.round(e.vphMax || 0),
      trend: trend,
      trendKnown: trendKnown,
      best: e.best || '',
      channels: chNames.slice(0, 3).join(', '),
      mkts: mkts.join(','),
      last: e.last || 0
    });
  });
  return out;
}

function renderStats(ix, rows) {
  var box = $('stats');
  while (box.firstChild) box.removeChild(box.firstChild);
  function stat(v, k) {
    var d = document.createElement('div'); d.className = 'stat';
    var dv = document.createElement('div'); dv.className = 'v'; dv.textContent = v;
    var dk = document.createElement('div'); dk.className = 'k'; dk.textContent = k;
    d.appendChild(dv); d.appendChild(dk); box.appendChild(d);
  }
  var totVids = rows.reduce(function (a, r) { return a + r.vids; }, 0);
  stat(String(rows.length), 'Nichos únicos');
  stat(fmtN(totVids), 'Videos ingeridos');
  stat(String((ix && ix.meta && ix.meta.scans) || 0), 'Scans acumulados');
  stat((ix && ix.meta && ix.meta.last) ? ('hace ' + fmtAgo(ix.meta.last)) : '—', 'Último scan');
}

function renderTable(rows) {
  var wrap = $('tableWrap');
  while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  if (!rows.length) {
    var e = document.createElement('div');
    e.className = 'empty';
    var l1 = document.createElement('div');
    l1.textContent = 'El índice está vacío todavía.';
    var l2 = document.createElement('div');
    l2.append('Corré un ');
    var b = document.createElement('b'); b.textContent = 'SCAN ';
    l2.appendChild(b);
    l2.append(' en YouTube — cada scan alimenta esta base automáticamente y acá se acumula tu inteligencia de nichos.');
    e.appendChild(l1); e.appendChild(l2);
    wrap.appendChild(e);
    return;
  }
  var cols = [
    { k: 'niche', label: 'Nicho' },
    { k: 'vids', label: 'Videos' },
    { k: 'vphProm', label: 'VPH prom' },
    { k: 'vphMax', label: 'VPH máx' },
    { k: 'trend', label: 'Tendencia' },
    { k: 'best', label: 'Mejor título visto' },
    { k: 'channels', label: 'Canales top' },
    { k: 'last', label: 'Visto' }
  ];
  var table = document.createElement('table');
  var thead = document.createElement('tr');
  cols.forEach(function (c) {
    var th = document.createElement('th');
    th.textContent = c.label;
    if (state.sortKey === c.k) {
      var ar = document.createElement('span');
      ar.className = 'arrow';
      ar.textContent = state.sortDir > 0 ? '' : '';
      th.appendChild(ar);
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
    td(fmtN(r.vphProm), 'num vph');
    td(fmtN(r.vphMax), 'num vph');
    var tCell = document.createElement('td');
    var tSpan = document.createElement('span');
    if (!r.trendKnown) { tSpan.className = 'flat'; tSpan.textContent = '·'; tSpan.title = 'Pocos datos aún — la tendencia aparece tras ~6 scans de este nicho.'; }
    else if (r.trend > 0.15) { tSpan.className = 'up'; tSpan.textContent = ' +' + Math.round(r.trend * 100) + '%'; }
    else if (r.trend < -0.15) { tSpan.className = 'down'; tSpan.textContent = ' ' + Math.round(r.trend * 100) + '%'; }
    else { tSpan.className = 'flat'; tSpan.textContent = ''; }
    tCell.appendChild(tSpan);
    tr.appendChild(tCell);
    var bCell = document.createElement('td');
    var bSpan = document.createElement('span');
    bSpan.className = 'best';
    bSpan.textContent = r.best || '—';
    bSpan.title = r.best || '';
    bCell.appendChild(bSpan);
    tr.appendChild(bCell);
    td(r.channels || '—', 'chs');
    td('hace ' + fmtAgo(r.last), 'chs');
    table.appendChild(tr);
  });
  wrap.appendChild(table);
}

function refresh() {
  var rows = rowsFromIndex(state.ix);
  var q = state.q.toLowerCase();
  if (q) {
    rows = rows.filter(function (r) {
      return r.niche.toLowerCase().indexOf(q) >= 0 || (r.best || '').toLowerCase().indexOf(q) >= 0 || (r.channels || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  var k = state.sortKey, dir = state.sortDir;
  rows.sort(function (a, b) {
    var av = a[k], bv = b[k];
    if (typeof av === 'string') return dir * String(av).localeCompare(String(bv));
    return dir * ((av || 0) - (bv || 0));
  });
  renderStats(state.ix, rowsFromIndex(state.ix));
  renderTable(rows);
  $('foot').textContent = HAS_CHROME
    ? 'Datos 100% locales (chrome.storage) · el índice crece solo con cada SCAN · tope 400 nichos (borra los más viejos).'
    : ' Vista previa sin chrome.storage — abrí esta página desde la extensión para ver tu índice real.';
}

function load() {
  if (!HAS_CHROME) {
    state.ix = { meta: { scans: 3, last: Date.now() - 540000 }, niches: {
      'historias medievales': { n: 'historias medievales', vids: 14, vphSum: 18200, vphMax: 4200, best: 'La reina que traicionó a su propio reino', ch: { 'Crown Chronicles': 6, 'Dark Ages': 4 }, mkts: { germany: 1, global: 2 }, last: Date.now() - 600000, hist: [{ ts: 1, v: 700 }, { ts: 2, v: 800 }, { ts: 3, v: 900 }, { ts: 4, v: 1500 }, { ts: 5, v: 1900 }, { ts: 6, v: 2400 }] },
      'misterio espacial': { n: 'misterio espacial', vids: 8, vphSum: 6100, vphMax: 1800, best: 'Lo que la NASA encontró y no explicó', ch: { 'Void Files': 5 }, mkts: { global: 2 }, last: Date.now() - 5400000, hist: [{ ts: 1, v: 900 }, { ts: 2, v: 800 }, { ts: 3, v: 700 }, { ts: 4, v: 600 }, { ts: 5, v: 500 }, { ts: 6, v: 400 }] }
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
  var head = 'nicho,videos,vph_prom,vph_max,tendencia_pct,mejor_titulo,canales_top,mercados,ultimo_ts\n';
  var csv = head + rows.map(function (r) {
    function esc(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; }
    return [esc(r.niche), r.vids, r.vphProm, r.vphMax, r.trendKnown ? Math.round(r.trend * 100) : '', esc(r.best), esc(r.channels), esc(r.mkts), r.last].join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'zerack-indice-nichos.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 2000);
});

$('btnClear').addEventListener('click', function () {
  if (!confirm('¿Borrar TODO el índice acumulado? Esta acción no se puede deshacer.')) return;
  if (HAS_CHROME) chrome.storage.local.remove('nsp_niche_index_v1', function () { load(); });
  else { state.ix = { meta: { scans: 0 }, niches: {} }; refresh(); }
});

if (HAS_CHROME && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.nsp_niche_index_v1) load();
  });
}

load();
