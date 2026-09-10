// ZERACK Country Radar — resultados faceless por país (datos InnerTube reales)
'use strict';

var NSP_MARKET_META = {
  global:      { label: 'Global',      flag: '', gl: null, hl: null, lang: null },
  usa:         { label: 'USA',         flag: '', gl: 'US', hl: 'en', lang: 'en' },
  australia:   { label: 'Australia',   flag: '', gl: 'AU', hl: 'en', lang: 'en' },
  uk:          { label: 'UK',          flag: '', gl: 'GB', hl: 'en', lang: 'en' },
  canada:      { label: 'Canada',      flag: '', gl: 'CA', hl: 'en', lang: 'en' },
  newzealand:  { label: 'New Zealand', flag: '', gl: 'NZ', hl: 'en', lang: 'en' },
  spain:       { label: 'Spain',       flag: '', gl: 'ES', hl: 'es', lang: 'es' },
  mexico:      { label: 'Mexico',      flag: '', gl: 'MX', hl: 'es', lang: 'es' },
  germany:     { label: 'Germany',     flag: '', gl: 'DE', hl: 'de', lang: 'de' },
  france:      { label: 'France',      flag: '', gl: 'FR', hl: 'fr', lang: 'fr' },
  italy:       { label: 'Italy',       flag: '', gl: 'IT', hl: 'it', lang: 'it' },
  japan:       { label: 'Japan',       flag: '', gl: 'JP', hl: 'ja', lang: 'ja' },
  netherlands: { label: 'Netherlands', flag: '', gl: 'NL', hl: 'nl', lang: 'nl' },
  sweden:      { label: 'Sweden',      flag: '', gl: 'SE', hl: 'sv', lang: 'sv' },
  norway:      { label: 'Norway',      flag: '', gl: 'NO', hl: 'no', lang: 'no' },
  denmark:     { label: 'Denmark',     flag: '', gl: 'DK', hl: 'da', lang: 'da' },
  switzerland: { label: 'Switzerland', flag: '', gl: 'CH', hl: 'de', lang: 'de' }
};

var NSP_FACELESS_QUERIES_BY_LANG = {
  en: ['top 10 facts','unbelievable stories','true crime stories','history documentary','space facts','mystery explained','finance tips','psychology facts','sleep meditation','satisfying compilation','mythology explained','ancient civilizations'],
  es: ['top 10 datos curiosos','historias increíbles','true crime español','documental historia','misterios sin resolver','datos del universo','finanzas personales','psicología explicada','meditación dormir','mitología explicada','civilizaciones antiguas','historias de terror'],
  de: ['top 10 fakten','unglaubliche geschichten','true crime deutsch','geschichte dokumentation','mysterien erklärt','weltraum fakten','finanzen tipps','psychologie fakten','schlafmeditation','mythologie erklärt','antike zivilisationen','horror geschichten'],
  fr: ['top 10 faits','histoires incroyables','true crime français','documentaire histoire','mystères inexpliqués','faits espace','finances personnelles','psychologie expliquée','méditation sommeil','mythologie expliquée','civilisations anciennes','histoires horreur'],
  it: ['top 10 fatti','storie incredibili','true crime italiano','documentario storia','misteri irrisolti','fatti spazio','finanza personale','psicologia spiegata','meditazione sonno','mitologia spiegata','civiltà antiche','storie horror'],
  nl: ['top 10 feiten','ongelooflijke verhalen','true crime nederlands','documentaire geschiedenis','mysteries onopgelost','ruimte feiten','persoonlijke financiën','psychologie uitgelegd','slaap meditatie','mythologie uitgelegd','antieke beschavingen'],
  sv: ['top 10 fakta','otroliga berättelser','true crime svenska','historia dokumentär','mysterier olösta','rymdfakta','personlig ekonomi','psykologi förklarad','sömn meditation','mytologi förklarad','antika civilisationer'],
  no: ['topp 10 fakta','utrolige historier','true crime norsk','historie dokumentar','mysterier uløst','rom fakta','personlig økonomi','psykologi forklart','søvnmeditasjon','mytologi forklart','antikke sivilisasjoner'],
  da: ['top 10 fakta','utrolige historier','true crime dansk','historie dokumentar','mysterier uopklarede','rumfakta','personlig økonomi','psykologi forklaret','søvnmeditation','mytologi forklaret','antikke civilisationer'],
  ja: ['雑学 トップ10','都市伝説','怖い話','歴史 ドキュメンタリー','宇宙の謎','不思議な話','投資 初心者','心理学 解説','睡眠 瞑想','神話 解説','古代文明','ホラー 物語']
};

//  Parsers (mirror of nsp-bundle.js subset) 
function pViews(t) {
  if (!t) return 0;
  t = ('' + t).toLowerCase().replace(/visualizaciones?|reproducciones?|views?|vistas?|aufrufe|vues|visualizzazioni|weergaven|visningar|回視聴|回再生/gi, '').trim();
  var m;
  m = t.match(/([\d.,]+)\s*mio/); if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e6);
  m = t.match(/([\d.,]+)\s*mil(?!l)/); if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1000);
  m = t.match(/([\d.,]+)\s*m(?!in|es|io)/); if (m) { var n = parseFloat(m[1].replace(',', '.')); if (n < 10000) return Math.round(n * 1e6); }
  m = t.match(/([\d.,]+)\s*k/); if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1000);
  m = t.match(/([\d.,]+)\s*b/); if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e9);
  m = t.match(/([\d.,]+)\s*万/); if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e4);
  var c = parseInt(('' + t).replace(/[\s.,]/g, ''));
  return isNaN(c) ? 0 : c;
}
function pHours(t) {
  if (!t) return null;
  t = ('' + t).toLowerCase();
  var patterns = [
    [/(\d+)\s*(second|segundo|sekunde|seconde|secondo|秒)/, 1/3600],
    [/(\d+)\s*(minute|minuto|min|分)/, 1/60],
    [/(\d+)\s*(hour|hora|stunde|heure|ora|uur|時間)/, 1],
    [/(\d+)\s*(day|d[ií]a|tag|jour|giorno|dag|日)/, 24],
    [/(\d+)\s*(week|semana|woche|semaine|settimana|uge|週)/, 24 * 7],
    [/(\d+)\s*(month|mes|monat|mois|mese|maand|måned|ヶ月)/, 24 * 30],
    [/(\d+)\s*(year|a[ñn]o|jahr|année|anno|jaar|år|年)/, 24 * 365]
  ];
  for (var i = 0; i < patterns.length; i++) { var m = t.match(patterns[i][0]); if (m) return parseInt(m[1], 10) * patterns[i][1]; }
  return null;
}
function parseDurationSecs(t) {
  if (!t) return 0;
  var parts = String(t).trim().split(':').map(function(p) { return parseInt(p, 10) || 0; });
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parts[0] || 0;
}
function fmtN(n) {
  n = Math.round(n || 0);
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtVPH(v) { v = Math.round(v||0); return v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v); }
function fmtAge(h) {
  if (h == null) return '?';
  if (h < 1) return Math.round(h*60) + 'm';
  if (h < 24) return Math.round(h) + 'h';
  if (h < 168) return Math.round(h/24) + 'd';
  if (h < 720) return Math.round(h/168) + 'w';
  return Math.round(h/720) + 'mo';
}


function scoreFacelessAIPatterns(title, channelName) {
  var t = String(title || '');
  var c = String(channelName || '');
  var cLower = c.toLowerCase().trim();
  var score = 0;
  var hits = [];

  for (var w = 0; w < AI_FACELESS_CHANNEL_WHITELIST.length; w++) {
    if (cLower.indexOf(AI_FACELESS_CHANNEL_WHITELIST[w]) !== -1) {
      score += 35;
      hits.push('whitelist:' + AI_FACELESS_CHANNEL_WHITELIST[w]);
      break;
    }
  }

  for (var i = 0; i < AI_FACELESS_TITLE_PATTERNS.length; i++) {
    if (AI_FACELESS_TITLE_PATTERNS[i].test(t)) {
      score += 18;
      hits.push('title_pattern_' + i);
      if (hits.filter(function(h) { return h.indexOf('title_pattern') === 0; }).length >= 3) break;
    }
  }

  for (var j = 0; j < AI_FACELESS_CHANNEL_PATTERNS.length; j++) {
    if (AI_FACELESS_CHANNEL_PATTERNS[j].test(c)) {
      score += 15;
      hits.push('channel_pattern_' + j);
      if (hits.filter(function(h) { return h.indexOf('channel_pattern') === 0; }).length >= 2) break;
    }
  }

  if (CHANNEL_NAME_HUMAN_FACE_PENALTY.test(c)) {
    score -= 25;
    hits.push('human_face_penalty');
  }

  var titleHits = hits.filter(function(h) { return h.indexOf('title_pattern') === 0; }).length;
  var channelHits = hits.filter(function(h) { return h.indexOf('channel_pattern') === 0; }).length;
  if (titleHits > 0 && channelHits > 0) score += 15;

  return { score: Math.max(0, Math.min(100, score)), hits: hits };
}

function buildFacelessNicheGroups(videos) {
  var groups = {};
  (videos || []).forEach(function(v) {
    var key = String(v.niche || '🌐 General');
    if (!groups[key]) {
      groups[key] = { niche: key, videos: [], score: 0, totalVph: 0 };
    }
    groups[key].videos.push(v);
    groups[key].totalVph += v.vph || 0;
    groups[key].score = Math.max(groups[key].score, v.facelessScore || 0);
  });
  var out = Object.keys(groups).map(function(key) {
    var grp = groups[key];
    grp.videos.sort(function(a, b) {
      if ((b.facelessScore || 0) !== (a.facelessScore || 0)) return (b.facelessScore || 0) - (a.facelessScore || 0);
      return (b.vph || 0) - (a.vph || 0);
    });
    grp.topVideo = grp.videos[0];
    return grp;
  });
  out.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.videos.length !== a.videos.length) return b.videos.length - a.videos.length;
    return b.totalVph - a.totalVph;
  });
  return out;
}

function selectFacelessNicheGroups(videos) {
  var strongThreshold = 60;
  var strongest = buildFacelessNicheGroups(videos.filter(function(v) { return (v.facelessScore || 0) >= strongThreshold; }));
  if (strongest.length >= 6) return strongest.slice(0, 10);
  // Fallback: antes devolvía [] con <6 grupos → el usuario veía "DONE · 0 nichos" AUNQUE
  // hubiera videos válidos. Ahora mostramos los grupos fuertes que haya; si no hay ninguno,
  // bajamos el umbral a 40 para no esconder todo.
  if (strongest.length) return strongest.slice(0, 10);
  var relaxed = buildFacelessNicheGroups(videos.filter(function(v) { return (v.facelessScore || 0) >= 40; }));
  return relaxed.slice(0, 10);
}

function detectNicheLabel(t) { t = String(t || ''); for (var i = 0; i < NICHE_RPM.length; i++) if (NICHE_RPM[i].re.test(t)) return NICHE_RPM[i].label; return '🌐 General'; }
function detectRPM(t)       { t = String(t || ''); for (var i = 0; i < NICHE_RPM.length; i++) if (NICHE_RPM[i].re.test(t)) return NICHE_RPM[i].rpm; return 4; }
function processVideo(v) {
  if (!v || !v.videoId || !v.title) return null;
  var views = pViews(v.viewsText || '');
  if (!views) return null;
  var hoursOld = pHours(v.publishedText || '');
  var duration = parseDurationSecs(v.lengthText || '');
  var vph = views / (hoursOld || 720);
  var niche = detectNicheLabel(v.title + ' ' + (v.channelName || ''));
  var rpm = detectRPM(v.title + ' ' + (v.channelName || ''));
  var totalRev = Math.round((views * 0.95) / 1000 * rpm);
  var faceless = scoreFacelessAIPatterns(v.title || '', v.channelName || '');
  return {
    videoId: v.videoId, title: v.title,
    channelName: v.channelName || '', channelUrl: v.channelUrl || '', channelId: v.channelId || '',
    thumbnail: v.thumbnail || ('https://i.ytimg.com/vi/' + v.videoId + '/hqdefault.jpg'),
    views: views, hoursOld: hoursOld, duration: duration, durationText: v.lengthText || '',
    publishedText: v.publishedText || '', vph: vph, niche: niche, rpm: rpm, totalRev: totalRev,
    facelessScore: faceless.score,
    facelessHits: faceless.hits,
    source: v.source || 'innertube'
  };
}


var STATE = { videos: [], rows: [], busy: false, sortKey: 'facelessScore', sortDir: -1, _watchdog: null, _firstErr: null };
var HAS_EXT = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage);
var $ = function(id) { return document.getElementById(id); };
var __prog = { done: 0, error: 0, total: 0 };

function setStatus(text, kind) {
  var s = $('status-line');
  s.textContent = text;
  s.style.color = kind === 'error' ? '#FF2D2D' : (kind === 'ok' ? '#FFFFFF' : 'rgba(255,255,255,.7)');
}

function setProgress(pct) {
  $('progress-fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
}

function populateMarkets() {
  var sel = $('sel-market');
  Object.keys(NSP_MARKET_META).forEach(function(k) {
    var m = NSP_MARKET_META[k];
    if (!m.gl) return;
    var op = document.createElement('option');
    op.value = k;
    op.textContent = (m.flag ? m.flag + ' ' : '') + m.label;
    sel.appendChild(op);
  });
}

function getActiveQueries() {
  var m = NSP_MARKET_META[$('sel-market').value];
  if (!m || !m.hl) return [];
  if ($('sel-niche').value === 'custom') {
    return ($('txt-queries').value || '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean).slice(0, 12);
  }
  return NSP_FACELESS_QUERIES_BY_LANG[m.hl] || NSP_FACELESS_QUERIES_BY_LANG.en;
}

function applyFilters() {
  var minVph = parseFloat($('inp-vph').value) || 0;
  var maxAge = parseFloat($('sel-age').value) || 0;
  STATE.rows = STATE.videos.filter(function(v) {
    if (minVph > 0 && v.vph < minVph) return false;
    if (maxAge > 0 && v.hoursOld != null && v.hoursOld > maxAge) return false;
    return true;
  });
  sortRows();
}

function sortRows() {
  var k = STATE.sortKey, dir = STATE.sortDir;
  STATE.rows.sort(function(a, b) {
    var av = a[k], bv = b[k];
    if (typeof av === 'string') return dir * String(av || '').localeCompare(String(bv || ''));
    return dir * ((av || 0) - (bv || 0));
  });
}

function render() {
  var wrap = $('results-wrap');
  while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  var rows = STATE.rows;
  var nicheSet = {};
  rows.forEach(function(r) { nicheSet[r.niche] = 1; });
  $('results-count').textContent = rows.length
    ? ((rows.length > 120 ? 'mostrando 120 de ' + rows.length + ' videos' : rows.length + ' videos') + ' · ' + Object.keys(nicheSet).length + ' nichos')
    : '';
  if (!rows.length) {
    var e = document.createElement('div');
    e.className = 'empty';
    e.textContent = STATE.videos.length ? 'Los filtros dejaron 0 resultados — bajá el VPH mínimo o ampliá la edad.' : 'Elegí un país y dale ESCANEAR PAÍS — resultados faceless reales del feed de ese mercado.';
    wrap.appendChild(e);
    return;
  }
  var cols = [
    { k: 'title', label: 'Video' },
    { k: 'channelName', label: 'Canal' },
    { k: 'niche', label: 'Nicho' },
    { k: 'views', label: 'Views' },
    { k: 'vph', label: 'VPH' },
    { k: 'facelessScore', label: 'Faceless' },
    { k: 'totalRev', label: '$ est' },
    { k: 'hoursOld', label: 'Edad' }
  ];
  var table = document.createElement('table');
  var thead = document.createElement('tr');
  cols.forEach(function(c) {
    var th = document.createElement('th');
    th.textContent = c.label;
    if (STATE.sortKey === c.k) {
      var ar = document.createElement('span');
      ar.className = 'arrow';
      ar.textContent = STATE.sortDir > 0 ? '' : '';
      th.appendChild(ar);
    }
    th.addEventListener('click', function() {
      if (STATE.sortKey === c.k) STATE.sortDir = -STATE.sortDir;
      else { STATE.sortKey = c.k; STATE.sortDir = -1; }
      sortRows(); render();
    });
    thead.appendChild(th);
  });
  table.appendChild(thead);
  rows.slice(0, 120).forEach(function(v) {
    var tr = document.createElement('tr');
    var tdT = document.createElement('td');
    var a = document.createElement('a');
    a.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.videoId);
    a.target = '_blank'; a.rel = 'noopener';
    a.className = 'vlink';
    a.textContent = v.title.length > 70 ? v.title.slice(0, 70) + '…' : v.title;
    a.title = v.title;
    tdT.appendChild(a);
    tr.appendChild(tdT);
    function td(txt, cls) { var d = document.createElement('td'); if (cls) d.className = cls; d.textContent = txt; tr.appendChild(d); return d; }
    td(v.channelName || '—', 'chs');
    td(v.niche, 'chs');
    td(fmtN(v.views), 'num');
    var verd = vphVerdict(v.vph);
    var tdV = td(fmtVPH(v.vph) + (verd.label !== 'SLOW' ? ' · ' + verd.label : ''), 'num vph');
    if (verd.cls === 'viral') tdV.style.color = '#FFFFFF';
    var fs = Math.round(v.facelessScore || 0);
    var tdF = td(fs + '', 'num');
    tdF.style.color = fs >= 60 ? '#FFFFFF' : (fs >= 30 ? '#FFFFFF' : 'rgba(255,255,255,.45)');
    tdF.style.fontWeight = '800';
    td('$' + fmtN(v.totalRev), 'num');
    td(fmtAge(v.hoursOld), 'chs');
    table.appendChild(tr);
  });
  wrap.appendChild(table);
}

function finishScan(okMsg) {
  STATE.busy = false;
  STATE._progSess = null;
  var btn = $('btn-scan');
  btn.disabled = false;
  btn.textContent = ' ESCANEAR PAÍS';
  if (okMsg) setStatus(okMsg, 'ok');
  setProgress(100);
}

function onFatalError(msg) {
  if (STATE._watchdog) { clearTimeout(STATE._watchdog); STATE._watchdog = null; }
  finishScan(null);
  setStatus(' ' + msg, 'error');
  setProgress(0);
}

function runScan() {
  if (STATE.busy) return;
  if (!HAS_EXT) { runDemo(); return; }
  var market = NSP_MARKET_META[$('sel-market').value];
  if (!market || !market.gl) { setStatus('Elegí un mercado primero.', 'error'); return; }
  var queries = getActiveQueries();
  if (!queries.length) { setStatus('Sin queries activas.', 'error'); return; }
  STATE.busy = true;
  STATE.videos = [];
  STATE.rows = [];
  STATE._firstErr = null;
  STATE._progSess = null;
  STATE._reqGl = market.gl;
  __prog = { done: 0, error: 0, total: queries.length };
  render();
  var btn = $('btn-scan');
  btn.disabled = true;
  btn.textContent = 'ESCANEANDO…';
  setStatus('Scanning ' + market.label + ', ' + queries.length + ' faceless searches within the selected window');
  setProgress(4);
  if (STATE._watchdog) clearTimeout(STATE._watchdog);
  STATE._watchdog = setTimeout(function() { if (STATE.busy) onFatalError('Timeout: el service worker no respondió en 70s. Reintentá.'); }, 70000);
  chrome.runtime.sendMessage({
    type: 'NSP_FETCH_COUNTRY_FACELESS_FEED',
    gl: market.gl,
    hl: market.hl,
    queries: queries,
    maxAgeHours: parseFloat($('sel-age').value) || 0,
    force: false
  }, function(res) {
    if (STATE._watchdog) { clearTimeout(STATE._watchdog); STATE._watchdog = null; }
    if (!STATE.busy) return;
    var err = chrome.runtime && chrome.runtime.lastError;
    if (err) { onFatalError(err.message); return; }
    if (!res || !res.ok) { onFatalError((res && res.error) || (STATE._firstErr || 'sin respuesta')); return; }
    var vids = (res.videos || []).map(processVideo).filter(Boolean);
    STATE.videos = vids;
    applyFilters();
    render();
    finishScan(' ' + vids.length + ' videos de ' + market.label + (res.cached ? ' (cache)' : ' (frescos)') + ' — ordenados por señal faceless.');
  });
}

if (HAS_EXT && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(function(msg) {
    if (!msg || msg.type !== 'NSP_FEED_PROGRESS') return;
    if (!STATE.busy) return;
    if (msg.stage === 'session' && msg.status === 'start') {
      if (STATE._progSess && msg.sessionId && msg.sessionId !== STATE._progSess) return;
      if (msg.gl && STATE._reqGl && msg.gl !== STATE._reqGl) return;
      STATE._progSess = msg.sessionId || null;
      __prog = { done: 0, error: 0, total: msg.totalSteps || __prog.total };
      return;
    }
    if (STATE._progSess && msg.sessionId && msg.sessionId !== STATE._progSess) return;
    if (msg.status === 'done') __prog.done++;
    else if (msg.status === 'error') {
      __prog.error++;
      if (!STATE._firstErr) STATE._firstErr = msg.error;
    }
    if (__prog.total) {
      var f = __prog.done + __prog.error;
      setProgress(6 + Math.round((f / __prog.total) * 88));
      setStatus('Trayendo datos… ' + f + '/' + __prog.total + (__prog.error ? ' (' + __prog.error + ' err)' : ''));
    }
  });
}

function exportCsv() {
  if (!STATE.rows.length) { setStatus('Nada para exportar — escaneá primero.', 'error'); return; }
  var head = 'titulo,canal,nicho,views,vph,faceless_score,revenue_est,horas_edad,video_url\n';
  var csv = head + STATE.rows.map(function(v) {
    function esc(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; }
    return [esc(v.title), esc(v.channelName), esc(v.niche), v.views, Math.round(v.vph), Math.round(v.facelessScore || 0), v.totalRev, Math.round(v.hoursOld || 0), 'https://www.youtube.com/watch?v=' + v.videoId].join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'zerack-country-radar.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 2000);
}

function clearCache() {
  if (!HAS_EXT || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  if (STATE.busy) { setStatus('Esperá a que termine el scan antes de limpiar.', 'error'); return; }
  var keys = Object.keys(NSP_MARKET_META).map(function(k) {
    var m = NSP_MARKET_META[k];
    return m.gl ? ('nsp_country_feed_' + m.gl + '_' + m.hl) : null;
  }).filter(Boolean);
  chrome.storage.local.remove(keys, function() {
    var err = chrome.runtime && chrome.runtime.lastError;
    setStatus(err ? 'No pude limpiar el cache.' : ' Cache limpio (' + keys.length + ' países) — el próximo scan trae datos frescos.', err ? 'error' : 'ok');
  });
}

function runDemo() {
  var demo = [
    { videoId: 'demo1', title: 'La dinastía que desapareció sin dejar rastro', channelName: 'Crónicas Perdidas', viewsText: '412K views', publishedText: '2 days ago', lengthText: '18:42' },
    { videoId: 'demo2', title: 'KI erklärt: Was niemand über Rom wusste', channelName: 'Historia AI', viewsText: '128K views', publishedText: '1 day ago', lengthText: '14:10' },
    { videoId: 'demo3', title: 'Top 12 secretos del océano profundo', channelName: 'Abismo Digital', viewsText: '89K views', publishedText: '3 days ago', lengthText: '22:03' }
  ];
  STATE.videos = demo.map(processVideo).filter(Boolean);
  applyFilters();
  render();
  setStatus('DEMO (vista previa sin extensión) — abrí esta página desde la extensión para escanear de verdad.', 'ok');
  setProgress(100);
}

$('btn-scan').addEventListener('click', runScan);
$('btn-export').addEventListener('click', exportCsv);
$('btn-cache').addEventListener('click', clearCache);
var _vphDeb = null;
$('inp-vph').addEventListener('input', function() { clearTimeout(_vphDeb); _vphDeb = setTimeout(function() { applyFilters(); render(); }, 250); });
$('sel-age').addEventListener('change', function() { applyFilters(); render(); });
$('sel-niche').addEventListener('change', function() { $('txt-queries').style.display = this.value === 'custom' ? 'block' : 'none'; });
populateMarkets();
render();
function vphVerdict(vph)    { if (vph >= 1000) return {label:'VIRAL',cls:'viral'}; if (vph >= 200) return {label:'HOT',cls:'hot'}; if (vph >= 50) return {label:'GROW',cls:'vph'}; if (vph >= 10) return {label:'STABLE',cls:'vph'}; return {label:'SLOW',cls:''}; }
