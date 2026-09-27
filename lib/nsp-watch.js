(function (root) {
  'use strict';

  function mod(name) {
    if (root && root[name]) return root[name];
    if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name];
    return null;
  }

  var HOUR = 3600000;
  var DAY = 86400000;
  var SAY_WORDS = 55;
  var OUTLIER_X = 5;
  var FRESH_HOURS = 168;
  var BASIS_HOURS = 168;
  var BASIS_MIN = 5;
  var BRIEF_HOUR = 7;
  var RISING = 1.3;
  var COOLING = 0.77;
  var SILENT_DAYS = 30;
  var PICKS = 10;
  var CONTROLS = 10;
  var HORIZON_DAYS = 14;
  var YOUNG_DAYS = 365;
  var RECENT_HOURS = 336;
  var MIN_SCORE = 0.5;
  var MIN_SETTLED = 20;
  var ARB_POOL = 60;
  var ARB_EN_MIN = 5;
  var ARB_WIN = 1.2;
  var ARB_MISSING = 2;
  var ARB_SHARE = 2.5;
  var ARB_REL = 0.6;
  var ARB_TARGETS = ['es', 'de', 'pt'];
  var LANG_NAME = { en: 'English', es: 'Spanish', de: 'German', pt: 'Portuguese' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var P = {
    and: { en: ' and ', es: ' y ' },
    o_title: { en: '{name}: an outlier at {mult} its median', es: '{name}: un outlier a {mult} su mediana' },
    o_body: { en: '"{title}" has {views} views after {age}. The channel median is {median}. Click for the X-ray.', es: '"{title}" lleva {views} vistas en {age}. La mediana del canal es {median}. Haz clic para el rayos X.' },
    b_quiet: { en: 'Morning brief: a quiet night. No watched upload ran at 5 times its channel median.', es: 'Resumen de la mañana: noche tranquila. Ningún video vigilado llegó a 5 veces la mediana de su canal.' },
    b_outliers: { en: 'Morning brief: {n} outliers.', es: 'Resumen de la mañana: {n} outliers.' },
    b_outlier: { en: 'Morning brief: one outlier.', es: 'Resumen de la mañana: un outlier.' },
    b_top: { en: '{name} has "{title}" at {mult} its median.', es: '{name} tiene "{title}" a {mult} su mediana.' },
    b_uploads: { en: '{n} new uploads across {c}.', es: '{n} videos nuevos en {c}.' },
    b_upload: { en: 'One new upload across {c}.', es: 'Un video nuevo en {c}.' },
    b_none_new: { en: 'No new upload across {c}.', es: 'Ningún video nuevo en {c}.' },
    b_one_ch: { en: 'your watched channel', es: 'tu canal vigilado' },
    b_many_ch: { en: '{n} watched channels', es: '{n} canales vigilados' },
    b_rising: { en: '{niche} is rising: its uploads run at {now} views an hour, up from {before}.', es: '{niche} está subiendo: sus videos van a {now} vistas por hora, antes {before}.' },
    b_cooling: { en: '{niche} is cooling: {now} views an hour, down from {before}.', es: '{niche} se enfría: {now} vistas por hora, antes {before}.' },
    b_nothing: { en: 'Nothing to brief yet: no watched channel and no saved niche.', es: 'Todavía no hay nada que resumir: ningún canal vigilado ni nicho guardado.' },
    b_settled: { en: '{n} predictions settled: {hits} doubled.', es: 'Se cerraron {n} predicciones: {hits} se duplicaron.' },
    bs_on: { en: 'Morning brief on, every day at {hour}.', es: 'Resumen de la mañana activado, todos los días a las {hour}.' },
    bs_off: { en: 'Morning brief off.', es: 'Resumen de la mañana apagado.' },
    w_on: { en: 'Watching {name}. You get a notification when a new upload runs at 5 times its median of {median} views.', es: 'Vigilo {name}. Te aviso cuando un video nuevo llegue a 5 veces su mediana de {median} vistas.' },
    w_off: { en: 'Stopped watching {name}.', es: 'Dejé de vigilar {name}.' },
    w_list: { en: 'You watch {n} channels.', es: 'Vigilas {n} canales.' },
    w_list_one: { en: 'You watch one channel.', es: 'Vigilas un canal.' },
    w_none: { en: 'You watch no channel yet. Say watch this channel on a channel page.', es: 'Todavía no vigilas ningún canal. Di vigila este canal en la página de un canal.' },
    p_none: { en: 'No prediction is sealed yet.', es: 'Todavía no hay predicciones selladas.' },
    p_sealed: { en: '{n} predictions sealed, the first results come on {date}.', es: '{n} predicciones selladas, los primeros resultados llegan el {date}.' },
    p_score: { en: 'Picks doubled {a} percent of the time, random controls {b} percent. {verdict}', es: 'Las elegidas se duplicaron un {a} por ciento de las veces, los controles al azar un {b} por ciento. {verdict}' },
    p_new: { en: 'Sealed {n} picks and {c} controls from {pool} young channels. They settle on {date}.', es: 'Sellé {n} elegidos y {c} controles de {pool} canales jóvenes. Se cierran el {date}.' },
    ev_none: { en: 'No batch has settled yet.', es: 'Todavía no se cerró ningún lote.' },
    ev_thin: { en: 'Too few settled calls to judge.', es: 'Muy pocas predicciones cerradas para juzgar.' },
    ev_noedge: { en: 'The picks do no better than chance.', es: 'Las elegidas no superan al azar.' },
    ev_weak: { en: 'The edge is weak and could be chance.', es: 'La ventaja es débil y podría ser azar.' },
    ev_some: { en: 'The edge is suggestive, not proven.', es: 'La ventaja sugiere algo, no está probada.' },
    ev_sig: { en: 'The edge is significant.', es: 'La ventaja es significativa.' },
    ev_strong: { en: 'The edge is strong.', es: 'La ventaja es fuerte.' },
    a_lead: { en: 'Measured from {n} titles: {counts}.', es: 'Medido sobre {n} títulos: {counts}.' },
    a_gap: { en: '{niche} wins in English and is {state} in {lang}.', es: '{niche} gana en inglés y está {state} en {lang}.' },
    a_none: { en: 'No niche that wins in English is missing or weak in the languages with enough data.', es: 'Ningún nicho que gana en inglés falta o flojea en los idiomas con datos suficientes.' },
    a_thin: { en: 'Too little data to call a language gap.', es: 'Muy pocos datos para hablar de un hueco de idioma.' },
    a_missing: { en: 'missing', es: 'ausente' },
    a_weak: { en: 'weak', es: 'flojo' },
    c_lead: { en: '{k} of the {n} comments read ask for something.', es: '{k} de los {n} comentarios leídos piden algo.' },
    c_none: { en: 'None of the {n} comments read asks for a video.', es: 'Ninguno de los {n} comentarios leídos pide un video.' },
    c_top: { en: 'The most liked ask: "{text}".', es: 'Lo más pedido: "{text}".' },
    c_ideas: { en: 'Three ideas: {list}.', es: 'Tres ideas: {list}.' },
    c_empty: { en: 'This video shows no comments, or they are turned off.', es: 'Este video no muestra comentarios, o están desactivados.' },
    age_min: { en: '{n} minutes', es: '{n} minutos' },
    age_hour: { en: '1 hour', es: '1 hora' },
    age_hours: { en: '{n} hours', es: '{n} horas' },
    age_days: { en: '{n} days', es: '{n} días' }
  };

  var LANGS_ES = { English: 'inglés', Spanish: 'español', German: 'alemán', Portuguese: 'portugués' };

  function langOf(lang) { return lang === 'es' ? 'es' : 'en'; }

  function fill(key, lang, vars) {
    var row = P[key];
    if (!row) return '';
    var t = row[langOf(lang)] || row.en;
    return t.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : ''; });
  }

  var injected = null;

  function use(set) { injected = set && typeof set === 'object' ? set : null; }

  function engines() {
    if (injected) return injected;
    return { I: mod('NSP_INTEL'), T: mod('NSP_RPM_TABLA') };
  }

  function I() { return engines().I; }

  function num(n) { n = Number(n); return isFinite(n) ? n : 0; }

  function compact(n) { var x = I(); return x ? x.compact(n) : String(Math.round(num(n))); }

  function mult(n) { var x = I(); return x ? x.mult(n) : (Math.round(num(n) * 10) / 10) + 'x'; }

  function spokenNum(n, lang) { var x = I(); return x ? x.spokenNum(n, lang) : String(Math.round(num(n))); }

  function spokenMult(n, lang) { var x = I(); return x ? x.spokenMult(n, lang) : mult(n); }

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n - 1).replace(/\s+\S*$/, '');
    return (cut || s.slice(0, n - 1)) + '…';
  }

  function median(list) {
    var s = (list || []).filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  function viewsOf(v) {
    var n = Number(v && (v.viewsNum != null ? v.viewsNum : v.views));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function hoursOf(v) {
    var h = Number(v && v.hours);
    return v && v.hours != null && isFinite(h) && h >= 0 ? h : null;
  }

  function setOf(list) {
    var o = {};
    (list || []).forEach(function (k) { if (k) o[String(k)] = 1; });
    return o;
  }

  function sayOf(list, max) {
    var out = [], words = 0;
    for (var i = 0; i < list.length; i++) {
      var n = String(list[i] || '').split(/\s+/).filter(Boolean).length;
      if (!n) continue;
      if (out.length && words + n > max) break;
      out.push(list[i]);
      words += n;
    }
    return out.join(' ');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function day(ms) {
    var d = new Date(Number(ms) || Date.now());
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function dayYear(ms) {
    var d = new Date(Number(ms) || Date.now());
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function clockOf(ms) {
    var d = new Date(Number(ms) || Date.now());
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function whenOf(ms) {
    var d = new Date(Number(ms) || Date.now());
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + clockOf(ms);
  }

  function hourLabel(h) { return pad(((Number(h) % 24) + 24) % 24) + ':00'; }

  function ageText(hours, lang) {
    var h = num(hours);
    if (h < 1) return fill('age_min', lang, { n: Math.max(1, Math.round(h * 60)) });
    if (h < 48) return Math.round(h) === 1 ? fill('age_hour', lang) : fill('age_hours', lang, { n: Math.round(h) });
    return fill('age_days', lang, { n: Math.round(h / 24) });
  }

  function pct(a, b) { return b > 0 ? Math.round(100 * a / b) : 0; }

  function watchUrl(id) { return /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? 'https://www.youtube.com/watch?v=' + id : ''; }

  function thumbUrl(id) { return /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : ''; }

  function norm(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9@\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function outliers(input) {
    input = input || {};
    var videos = (input.videos || []).filter(function (v) { return v && /^[A-Za-z0-9_-]{11}$/.test(String(v.videoId || '')); });
    var base = setOf(input.baseline), done = setOf(input.alerted);
    var fresh = videos.filter(function (v) { var h = hoursOf(v); return !base[v.videoId] && h != null && h <= FRESH_HOURS; });
    var freshIds = setOf(fresh.map(function (v) { return v.videoId; }));
    var aged = videos.filter(function (v) { var h = hoursOf(v); return !base[v.videoId] && h != null && h > FRESH_HOURS; }).map(function (v) { return v.videoId; });
    var basis = videos.filter(function (v) { var h = hoursOf(v); return h != null && h > BASIS_HOURS && viewsOf(v) > 0; });
    var kind = 'older';
    if (basis.length < BASIS_MIN) {
      basis = videos.filter(function (v) { return !freshIds[v.videoId] && viewsOf(v) > 0; });
      kind = 'others';
    }
    var out = { ok: false, threshold: OUTLIER_X, basis: basis.length, basisKind: kind, fresh: fresh.length, rows: [], hits: [], aged: aged, median: null };
    if (basis.length < BASIS_MIN) { out.reason = 'Only ' + basis.length + ' uploads with views to set the median, and ' + BASIS_MIN + ' are needed.'; return out; }
    var med = median(basis.map(viewsOf));
    if (!(med > 0)) { out.reason = 'No view count came back for this channel.'; return out; }
    out.ok = true;
    out.median = med;
    out.rows = fresh.map(function (v) {
      var x = viewsOf(v) / med;
      return { videoId: v.videoId, title: String(v.title || '').slice(0, 200), views: viewsOf(v), hours: hoursOf(v), multiple: x, outlier: x >= OUTLIER_X, alerted: !!done[v.videoId] };
    }).sort(function (a, b) { return b.multiple - a.multiple; });
    out.hits = out.rows.filter(function (r) { return r.outlier && !r.alerted; });
    return out;
  }

  function alertText(channel, hit, median, lang) {
    var name = clip(channel && channel.name || 'A watched channel', 40);
    return {
      title: clip(fill('o_title', lang, { name: name, mult: mult(hit.multiple) }), 80),
      message: clip(fill('o_body', lang, { title: clip(hit.title, 70), views: compact(hit.views), age: ageText(hit.hours, lang), median: compact(median) }), 220)
    };
  }

  function nextAt(hour, now) {
    var h = Math.max(0, Math.min(23, Math.round(num(hour))));
    var d = new Date(Number(now) || Date.now());
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0, 0).getTime();
    return t <= d.getTime() + 60000 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, h, 0, 0, 0).getTime() : t;
  }

  function briefRow(ch, lang) {
    var link = ch.url || '';
    if (!ch.ok) return { label: clip(ch.name || ch.url, 34), value: 'Could not be read: ' + clip(ch.error || 'no answer', 90), tone: 'muted', link: link, linkOn: 'label' };
    var fresh = (ch.rows || []).filter(function (r) { return r.hours != null && r.hours <= ch.windowHours; });
    var best = fresh.slice().sort(function (a, b) { return b.multiple - a.multiple; })[0];
    var value, tone = 'plain', tag = '';
    if (fresh.length) {
      value = (fresh.length === 1 ? '1 new upload' : fresh.length + ' new uploads') + (best && ch.median ? ', best ' + (best.multiple < 0.1 ? 'under 0.1x' : mult(best.multiple)) + ' its median so far: "' + clip(best.title, 60) + '"' : '');
      if (best && best.multiple >= OUTLIER_X) { tone = 'good'; tag = 'OUTLIER'; }
    } else if (ch.lastDays != null && ch.lastDays >= SILENT_DAYS) {
      value = 'Silent: no upload in ' + ch.lastDays + ' days';
      tone = 'bad';
    } else {
      value = 'Nothing new' + (ch.lastDays != null ? ', last upload ' + (ch.lastDays === 0 ? 'today' : ch.lastDays === 1 ? 'yesterday' : ch.lastDays + ' days ago') : '');
      tone = 'muted';
    }
    var r = { label: clip(ch.name || ch.url, 34), value: value, tone: tone, link: link, linkOn: 'label' };
    if (tag) r.tag = tag;
    return r;
  }

  function nicheTrend(n) {
    if (!(n.medianVph > 0) || !(n.prevMedianVph > 0)) return '';
    var r = n.medianVph / n.prevMedianVph;
    return r >= RISING ? 'rising' : (r <= COOLING ? 'cooling' : 'steady');
  }

  function briefCard(input, lang) {
    input = input || {};
    var now = Number(input.now) || Date.now();
    var channels = input.channels || [];
    var niches = input.niches || [];
    var alerts = (input.alerts || []).slice().sort(function (a, b) { return num(b.multiple) - num(a.multiple); });
    var windowHours = Math.max(1, Math.min(72, num(input.windowHours) || 24));
    channels.forEach(function (c) { c.windowHours = windowHours; });
    var seen = {};
    var hits = [];
    channels.forEach(function (c) {
      (c.rows || []).forEach(function (r) {
        if (r.multiple >= OUTLIER_X && r.hours != null && r.hours <= windowHours && !seen[r.videoId]) { seen[r.videoId] = 1; hits.push({ name: c.name, url: c.url, videoId: r.videoId, title: r.title, views: r.views, multiple: r.multiple, hours: r.hours, median: c.median }); }
      });
    });
    alerts.forEach(function (a) { if (a.videoId && !seen[a.videoId]) { seen[a.videoId] = 1; hits.push({ name: a.name, url: a.channelUrl, videoId: a.videoId, title: a.title, views: a.views, multiple: a.multiple, hours: a.hours, median: a.median }); } });
    hits.sort(function (a, b) { return b.multiple - a.multiple; });
    var newCount = 0;
    channels.forEach(function (c) { if (c.ok) newCount += (c.rows || []).filter(function (r) { return r.hours != null && r.hours <= windowHours; }).length; });
    var read = channels.filter(function (c) { return c.ok; }).length;
    var say = [];
    var sections = [];
    if (!channels.length && !niches.length) {
      say.push(fill('b_nothing', lang));
    } else {
      say.push(hits.length ? (hits.length === 1 ? fill('b_outlier', lang) : fill('b_outliers', lang, { n: hits.length })) : fill('b_quiet', lang));
      if (hits[0]) say.push(fill('b_top', lang, { name: clip(hits[0].name, 40), title: clip(hits[0].title, 60), mult: spokenMult(hits[0].multiple, lang) }));
      var chs = channels.length === 1 ? fill('b_one_ch', lang) : fill('b_many_ch', lang, { n: channels.length });
      if (channels.length) say.push(newCount ? (newCount === 1 ? fill('b_upload', lang, { c: chs }) : fill('b_uploads', lang, { n: newCount, c: chs })) : fill('b_none_new', lang, { c: chs }));
    }
    var outRows = hits.slice(0, 6).map(function (h) {
      return { label: clip(h.name, 34), value: '"' + clip(h.title, 80) + '", ' + compact(h.views) + ' views after ' + ageText(h.hours) + ', ' + mult(h.multiple) + ' its median of ' + compact(h.median), tone: 'good', tag: mult(h.multiple), link: watchUrl(h.videoId) };
    });
    if (!outRows.length) outRows.push({ label: 'Outliers', value: channels.length ? 'No watched upload ran at 5x its channel median in the last ' + windowHours + ' hours' : 'No channel is watched yet', tone: 'muted' });
    sections.push({ id: 'outliers', title: 'Outliers', rows: outRows, note: 'An outlier is a new upload at 5x or more the median views of the channel\'s uploads older than a week.' });
    if (channels.length) {
      sections.push({ id: 'channels', title: 'Watched channels', rows: channels.slice(0, 20).map(function (c) { return briefRow(c, lang); }), note: read + ' of ' + channels.length + ' channels read. New means uploaded in the last ' + windowHours + ' hours.' });
    } else {
      sections.push({ id: 'channels', title: 'Watched channels', rows: [{ label: 'None yet', value: 'Say "watch this channel" on a channel page, or press Watch in the Command Center', tone: 'muted' }] });
    }
    var trendSaid = false;
    var nicheRows = [];
    niches.slice(0, 8).forEach(function (n) {
      if (!n.ok) { nicheRows.push({ label: clip(n.name, 34), value: 'Not read: ' + clip(n.error || 'no answer', 80), tone: 'muted' }); return; }
      var tr = nicheTrend(n);
      var v = n.count + (n.count === 1 ? ' upload this week' : ' uploads this week') + (n.medianVph > 0 ? ', median ' + compact(n.medianVph) + (n.medianVph === 1 ? ' view an hour' : ' views an hour') : '') + (tr && tr !== 'steady' ? ', ' + (tr === 'rising' ? 'up' : 'down') + ' from ' + compact(n.prevMedianVph) : '');
      var row = { label: clip(n.name, 34), value: v, tone: tr === 'rising' ? 'good' : (tr === 'cooling' ? 'bad' : 'plain') };
      if (tr === 'rising') row.tag = 'RISING';
      else if (tr === 'cooling') row.tag = 'COOLING';
      else if (!n.prevMedianVph) row.tag = 'FIRST READ';
      nicheRows.push(row);
      if (n.top && n.top.videoId) nicheRows.push({ label: 'Top upload', value: '"' + clip(n.top.title, 80) + '", ' + compact(n.top.vph) + ' views an hour' + (n.top.channel ? ' on ' + clip(n.top.channel, 30) : ''), tone: 'muted', link: watchUrl(n.top.videoId) });
      if (!trendSaid && (tr === 'rising' || tr === 'cooling')) {
        trendSaid = true;
        say.push(fill(tr === 'rising' ? 'b_rising' : 'b_cooling', lang, { niche: n.name, now: spokenNum(n.medianVph, lang), before: spokenNum(n.prevMedianVph, lang) }));
      }
    });
    if (niches.length) sections.push({ id: 'niches', title: 'Saved niches', rows: nicheRows, note: 'One YouTube search per niche for uploads of this week. Rising or cooling compares with the previous brief, 1.3x either way.' });
    var pr = input.predictions;
    if (pr && pr.settled > 0) {
      sections.push({ id: 'predictions', title: 'Predictions settled', rows: [
        { label: 'Picks', value: pr.pickHits + ' of ' + pr.picks + ' doubled in 14 days', tone: pr.pickHits > pr.controlHits ? 'good' : 'plain' },
        { label: 'Random controls', value: pr.controlHits + ' of ' + pr.controls + ' doubled' }
      ] });
      say.push(fill('b_settled', lang, { n: pr.picks, hits: pr.pickHits }));
    }
    var lead = say.join(' ');
    var top = hits[0];
    var next = [];
    if (top && top.url) next.push({ label: 'X-ray ' + clip(top.name, 24), text: 'X-ray ' + top.url });
    next.push({ label: 'Predictions', text: 'Show my predictions' });
    next.push({ label: 'Language gaps', text: 'Language arbitrage' });
    return {
      v: 1, kind: 'brief', label: 'MORNING BRIEF', lang: langOf(lang), at: now,
      channel: { name: 'Morning brief', url: '', line: whenOf(now) + ' · ' + channels.length + (channels.length === 1 ? ' channel, ' : ' channels, ') + niches.length + (niches.length === 1 ? ' niche' : ' niches') },
      hero: hits.length ? { value: String(hits.length), label: hits.length === 1 ? 'outlier in the last ' + windowHours + ' hours' : 'outliers in the last ' + windowHours + ' hours', tone: 'good' } : { value: 'Quiet', word: true, label: channels.length ? 'no watched upload broke out' : 'nothing watched yet' },
      lead: lead, leadBase: lead, say: sayOf(say, SAY_WORDS),
      sections: sections,
      actions: [{ label: 'Run it again', job: { op: 'brief_now' } }, { label: 'Brief settings', job: { op: 'brief_state' } }],
      next: next,
      source: 'Read from the public /videos pages of ' + channels.length + ' watched channels and ' + niches.length + ' YouTube searches, 0 API quota. No AI model wrote this brief.',
      model: {
        outliers: hits.slice(0, 6).map(function (h) { return { channel: h.name, title: h.title, views: h.views, multiple: Math.round(h.multiple * 10) / 10 }; }),
        newUploads: newCount, channelsRead: read, channels: channels.length,
        niches: niches.map(function (n) { return { niche: n.name, uploadsThisWeek: n.count, medianViewsPerHour: n.medianVph, before: n.prevMedianVph || null, trend: nicheTrend(n) || 'first read' }; })
      }
    };
  }

  function briefState(st, lang) {
    st = st || {};
    var on = st.on === true;
    var hour = st.hour != null ? st.hour : BRIEF_HOUR;
    var rows = [
      { label: 'Status', value: on ? 'On, every day at ' + hourLabel(hour) : 'Off', tone: on ? 'good' : 'muted', tag: on ? 'ON' : 'OFF' },
      { label: 'Watched channels', value: st.channels ? st.channels + ' channels' : 'None yet: say "watch this channel" on a channel page', tone: st.channels ? 'plain' : 'muted' },
      { label: 'Saved niches', value: st.niches ? st.niches + ' niches' : 'None saved yet', tone: st.niches ? 'plain' : 'muted' }
    ];
    if (on && st.next) rows.push({ label: 'Next brief', value: whenOf(st.next) });
    if (st.last) rows.push({ label: 'Last brief', value: whenOf(st.last) });
    var lead = on ? fill('bs_on', lang, { hour: hourLabel(hour) }) : fill('bs_off', lang);
    var actions = on
      ? [{ label: 'Run it now', job: { op: 'brief_now' }, primary: true }, { label: 'Turn it off', job: { op: 'brief_off' } }]
      : [{ label: 'Turn it on at ' + hourLabel(hour), job: { op: 'brief_on', hour: hour }, primary: true }, { label: 'Run it now', job: { op: 'brief_now' } }];
    [6, 7, 8, 9].forEach(function (h) { if (on && h !== hour) actions.push({ label: 'At ' + hourLabel(h), job: { op: 'brief_on', hour: h } }); });
    return {
      v: 1, kind: 'brief_state', label: 'MORNING BRIEF', lang: langOf(lang), at: Date.now(),
      channel: { name: 'Morning brief', url: '', line: on ? 'Every day at ' + hourLabel(hour) : 'Off' },
      hero: { value: on ? 'On' : 'Off', word: true, label: on ? 'a brief of your watched channels and saved niches at ' + hourLabel(hour) : 'switch it on for a brief every morning', tone: on ? 'good' : 'plain' },
      lead: lead, leadBase: lead, say: lead,
      sections: [{ id: 'state', title: 'What it reads', rows: rows, note: 'Chrome has to be open. If the computer sleeps through the hour, the brief comes when it wakes. It reads public pages only and never calls an AI model.' }],
      actions: actions,
      next: [],
      model: { on: on, hour: hour, watchedChannels: st.channels || 0, savedNiches: st.niches || 0 }
    };
  }

  function watchCard(input, lang) {
    input = input || {};
    var list = input.list || [];
    var rows = list.slice(0, 30).map(function (w) {
      var s = w.state || {};
      var v = s.median ? 'median ' + compact(s.median) + ' views' : 'baseline pending';
      if (s.checkedAt) v += ', read ' + whenOf(s.checkedAt);
      if (s.lastAlert) v += ', last outlier ' + day(s.lastAlert);
      return { label: clip(w.name || w.channelUrl, 34), value: v, link: w.channelUrl, linkOn: 'label', tone: s.median ? 'plain' : 'muted' };
    });
    var lead;
    if (input.op === 'add') lead = fill('w_on', lang, { name: clip(input.name, 40), median: compact(input.median) });
    else if (input.op === 'remove') lead = fill('w_off', lang, { name: clip(input.name, 40) });
    else lead = list.length ? (list.length === 1 ? fill('w_list_one', lang) : fill('w_list', lang, { n: list.length })) : fill('w_none', lang);
    if (!rows.length) rows.push({ label: 'Watched', value: 'No channel yet', tone: 'muted' });
    var card = {
      v: 1, kind: 'watch', label: 'OUTLIER ALERTS', lang: langOf(lang), at: Date.now(),
      channel: { name: input.op === 'add' || input.op === 'remove' ? clip(input.name, 60) : 'Watched channels', url: input.url || '', line: list.length + (list.length === 1 ? ' channel watched' : ' channels watched') + ', checked every hour' },
      hero: input.op === 'add' && input.median ? { value: compact(input.median * OUTLIER_X), label: 'views a new upload needs for an alert, 5x its median of ' + compact(input.median) } : { value: String(list.length), label: list.length === 1 ? 'channel watched' : 'channels watched' },
      lead: lead, leadBase: lead, say: lead,
      sections: [{ id: 'list', title: 'Watched channels', rows: rows, note: 'Checked every hour from the public /videos page, 0 API quota. An alert fires once per upload, when it reaches 5x the median views of the channel\'s uploads older than a week.' }],
      next: [{ label: 'Morning brief', text: 'Morning brief settings' }]
    };
    if (input.op === 'add' && input.url) card.next.unshift({ label: 'X-ray it', text: 'X-ray ' + input.url });
    if (input.op === 'add' && input.url) card.actions = [{ label: 'Stop watching', job: { op: 'watch_remove', url: input.url } }];
    return card;
  }

  function canonical(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o === undefined ? null : o);
    if (Array.isArray(o)) return '[' + o.map(canonical).join(',') + ']';
    return '{' + Object.keys(o).filter(function (k) { return o[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(o[k]); }).join(',') + '}';
  }

  function ageDays(joinedDate, now) {
    var t = Date.parse(String(joinedDate || ''));
    if (!isFinite(t)) return null;
    return Math.max(0, Math.floor((Number(now) - t) / DAY));
  }

  function scoreOf(input) {
    input = input || {};
    var total = num(input.totalViews);
    var recent = 0, counted = 0;
    (input.videos || []).forEach(function (v) {
      var h = hoursOf(v);
      if (h != null && h <= RECENT_HOURS && viewsOf(v) > 0) { recent += viewsOf(v); counted++; }
    });
    return { total: total, recent: recent, recentUploads: counted, score: total > 0 ? Math.min(1, recent / total) : 0 };
  }

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(num(rand()) * (i + 1));
      if (j > i) j = i;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(scored, rand) {
    var eligible = (scored || []).filter(function (s) { return s && s.id && s.views > 0 && s.ageDays != null && s.ageDays <= YOUNG_DAYS; });
    var picks = eligible.filter(function (s) { return s.score >= MIN_SCORE; }).sort(function (a, b) { return b.score - a.score || b.recent - a.recent; }).slice(0, PICKS);
    var taken = setOf(picks.map(function (s) { return s.id; }));
    var controls = shuffle(eligible.filter(function (s) { return !taken[s.id]; }), rand || Math.random).slice(0, CONTROLS);
    return { picks: picks, controls: controls, eligible: eligible.length };
  }

  function entryOf(s) {
    return { id: s.id, name: clip(s.name, 80), url: s.url, joined: s.joined || '', ageDays: s.ageDays, views: s.views, recent: s.recent, score: Math.round(s.score * 1000) / 1000 };
  }

  function sealable(input) {
    var at = Number(input.now);
    return {
      v: 1,
      kind: 'zerack-prediction',
      claim: 'Each pick will reach at least twice its total channel views within ' + HORIZON_DAYS + ' days of the seal.',
      rule: 'Pool: channels under ' + YOUNG_DAYS + ' days old that your ZERACK scans surfaced. Picks: up to ' + PICKS + ' whose uploads of the last ' + HORIZON_DAYS + ' days already hold at least ' + Math.round(MIN_SCORE * 100) + ' percent of all their views. Controls: up to ' + CONTROLS + ' chosen at random from the same pool.',
      sealedAt: new Date(at).toISOString(),
      dueAt: new Date(at + HORIZON_DAYS * DAY).toISOString(),
      pool: num(input.pool),
      read: num(input.read),
      picks: (input.picks || []).map(entryOf),
      controls: (input.controls || []).map(entryOf),
      prev: String(input.prev || '')
    };
  }

  function settleOf(batch, readings, now) {
    var byId = {};
    (readings || []).forEach(function (r) { if (r && r.id) byId[r.id] = r; });
    var side = function (list) {
      var rows = (list || []).map(function (e) {
        var r = byId[e.id];
        var views = r && r.ok && r.views > 0 ? r.views : null;
        return { id: e.id, views: views, hit: views != null && views >= 2 * num(e.views), gone: views == null };
      });
      var live = rows.filter(function (r) { return !r.gone; });
      return { rows: rows, n: live.length, hits: live.filter(function (r) { return r.hit; }).length, gone: rows.length - live.length };
    };
    return { at: new Date(Number(now)).toISOString(), picks: side(batch.sealed.picks), controls: side(batch.sealed.controls) };
  }

  function logFact(n) {
    var s = 0;
    for (var i = 2; i <= n; i++) s += Math.log(i);
    return s;
  }

  function fisher(a, n1, c, n2) {
    var K = a + c, N = n1 + n2;
    if (!(n1 > 0) || !(n2 > 0)) return 1;
    var lo = a, hi = Math.min(K, n1);
    var denom = logFact(N) - logFact(n1) - logFact(N - n1);
    var p = 0;
    for (var x = lo; x <= hi; x++) {
      if (K - x > n2 || K - x < 0) continue;
      var lg = (logFact(K) - logFact(x) - logFact(K - x)) + (logFact(N - K) - logFact(n1 - x) - logFact(N - K - n1 + x));
      p += Math.exp(lg - denom);
    }
    return Math.min(1, Math.max(0, p));
  }

  function evidence(ledger, lang) {
    var batches = (ledger && ledger.batches) || [];
    var settled = batches.filter(function (b) { return b.settled; });
    var a = 0, n1 = 0, c = 0, n2 = 0;
    settled.forEach(function (b) { a += b.settled.picks.hits; n1 += b.settled.picks.n; c += b.settled.controls.hits; n2 += b.settled.controls.n; });
    var out = { batches: batches.length, settledBatches: settled.length, picks: { n: n1, hits: a }, controls: { n: n2, hits: c }, p: null, level: 0, key: 'none' };
    if (!settled.length) { out.key = 'none'; out.text = fill('ev_none', lang); return out; }
    out.p = fisher(a, n1, c, n2);
    var ra = n1 ? a / n1 : 0, rc = n2 ? c / n2 : 0;
    if (n1 < MIN_SETTLED || n2 < MIN_SETTLED) { out.key = 'thin'; out.level = 1; }
    else if (ra <= rc) { out.key = 'noedge'; out.level = 1; }
    else if (out.p >= 0.1) { out.key = 'weak'; out.level = 2; }
    else if (out.p >= 0.05) { out.key = 'some'; out.level = 3; }
    else if (out.p >= 0.01) { out.key = 'sig'; out.level = 4; }
    else { out.key = 'strong'; out.level = 5; }
    out.text = fill('ev_' + out.key, lang);
    return out;
  }

  var EV_LABEL = { none: 'Nothing settled yet', thin: 'Too little data', noedge: 'No edge over chance', weak: 'Weak', some: 'Suggestive', sig: 'Significant', strong: 'Strong' };

  function predictCard(ledger, lang, now, extra) {
    ledger = ledger || { batches: [] };
    extra = extra || {};
    now = Number(now) || Date.now();
    var batches = (ledger.batches || []).slice().sort(function (x, y) { return Date.parse(y.sealed.sealedAt) - Date.parse(x.sealed.sealedAt); });
    var ev = evidence(ledger, lang);
    var open = batches.filter(function (b) { return !b.settled; });
    var latest = batches[0] || null;
    var sections = [];
    var say = [];
    var ra = ev.picks.n ? pct(ev.picks.hits, ev.picks.n) : 0, rc = ev.controls.n ? pct(ev.controls.hits, ev.controls.n) : 0;
    var meterRows = [
      { label: 'Picks', value: ev.picks.n ? ev.picks.hits + ' of ' + ev.picks.n + ' doubled (' + ra + '%)' : 'none settled yet', tone: ev.picks.n ? (ra > rc ? 'good' : 'plain') : 'muted' },
      { label: 'Random controls', value: ev.controls.n ? ev.controls.hits + ' of ' + ev.controls.n + ' doubled (' + rc + '%)' : 'none settled yet', tone: ev.controls.n ? 'plain' : 'muted' }
    ];
    if (ev.p != null) meterRows.push({ label: 'One-sided Fisher test', value: 'p = ' + (ev.p < 0.001 ? '< 0.001' : ev.p.toFixed(3)), mono: true, tone: 'muted' });
    meterRows.push({ label: 'Settled calls needed', value: MIN_SETTLED + ' picks and ' + MIN_SETTLED + ' controls before any verdict', tone: 'muted' });
    sections.push({ id: 'meter', title: 'Evidence meter', meter: { level: ev.level, steps: 5, label: EV_LABEL[ev.key], tone: ev.level >= 4 ? 'good' : (ev.key === 'noedge' ? 'bad' : 'plain') }, rows: meterRows, note: ev.text + ' The meter only fills when the picks beat the random controls drawn from the same pool, by a margin chance rarely gives.' });
    if (ev.settledBatches) say.push(fill('p_score', lang, { a: ra, b: rc, verdict: ev.text }));
    else if (open.length) { if (!extra.sealedNow) say.push(fill('p_sealed', lang, { n: open.reduce(function (s, b) { return s + b.sealed.picks.length; }, 0), date: day(Date.parse(open[open.length - 1].sealed.dueAt)) })); }
    else say.push(fill('p_none', lang));
    if (extra.sealedNow) say.unshift(fill('p_new', lang, { n: extra.sealedNow.picks.length, c: extra.sealedNow.controls.length, pool: extra.sealedNow.pool, date: day(Date.parse(extra.sealedNow.dueAt)) }));
    if (latest) {
      var sealed = latest.sealed;
      var tableRows = sealed.picks.map(function (e) { return [clip(e.name, 30), compact(e.views), Math.round(e.score * 100) + '%', e.ageDays + ' d']; });
      sections.push({ id: 'latest', title: 'Latest batch, sealed ' + whenOf(Date.parse(sealed.sealedAt)), table: tableRows.length ? { head: ['Pick', 'Views at seal', 'Last 14 days share', 'Age'], rows: tableRows } : null, rows: [
        { label: 'Picks', value: sealed.picks.length ? sealed.picks.length + ' channels' : 'None: no young channel in the pool ran at a doubling pace', tone: sealed.picks.length ? 'plain' : 'muted' },
        { label: 'Random controls', value: sealed.controls.length + ' channels from the same pool of ' + sealed.pool },
        { label: 'Settles', value: latest.settled ? 'Settled ' + whenOf(Date.parse(latest.settled.at)) : whenOf(Date.parse(sealed.dueAt)) },
        { label: 'SHA-256', value: latest.hash, mono: true, tone: 'muted' }
      ] });
    }
    var done = batches.filter(function (b) { return b.settled; }).slice(0, 1)[0];
    if (done) {
      var names = {};
      done.sealed.picks.concat(done.sealed.controls).forEach(function (e) { names[e.id] = e; });
      var rowsOf = function (side, label) {
        return side.rows.map(function (r) { var e = names[r.id] || {}; return [clip(e.name || r.id, 28), label, compact(e.views), r.gone ? 'not readable' : compact(r.views), r.gone ? 'out' : (r.hit ? 'doubled' : 'no')]; });
      };
      sections.push({ id: 'settled', title: 'Last settled batch, sealed ' + day(Date.parse(done.sealed.sealedAt)), table: { head: ['Channel', 'Kind', 'At seal', 'After 14 days', 'Result'], rows: rowsOf(done.settled.picks, 'pick').concat(rowsOf(done.settled.controls, 'control')) }, rows: [
        { label: 'Picks', value: done.settled.picks.hits + ' of ' + done.settled.picks.n + ' doubled' + (done.settled.picks.gone ? ', ' + done.settled.picks.gone + ' could not be read and are left out' : ''), tone: done.settled.picks.hits > done.settled.controls.hits ? 'good' : 'plain' },
        { label: 'Random controls', value: done.settled.controls.hits + ' of ' + done.settled.controls.n + ' doubled' + (done.settled.controls.gone ? ', ' + done.settled.controls.gone + ' left out' : '') }
      ] });
    }
    if (open.length) {
      sections.push({ id: 'open', title: 'Waiting for their 14 days', rows: open.slice(0, 8).map(function (b) {
        return { label: 'Sealed ' + day(Date.parse(b.sealed.sealedAt)), value: b.sealed.picks.length + ' picks, ' + b.sealed.controls.length + ' controls, settles ' + day(Date.parse(b.sealed.dueAt)), note: b.hash.slice(0, 24) + '…' };
      }) });
    }
    sections.push({ id: 'rule', title: 'How the calls are made', rows: [
      { label: 'Pool', value: 'Channels under ' + YOUNG_DAYS + ' days old that your scans surfaced' },
      { label: 'Pick', value: 'Up to ' + PICKS + ' whose uploads of the last 14 days already hold half or more of all their views' },
      { label: 'Control', value: 'Up to ' + CONTROLS + ' drawn at random from the same pool, so the picks have something to beat' },
      { label: 'Seal', value: 'Stored on this computer with the time and a SHA-256 of the batch, chained to the previous one' },
      { label: 'Settle', value: 'After 14 days each channel is read again; doubled means its total views reached twice the sealed figure' },
      { label: 'Daily sealing', value: dailyOn(ledger) ? 'On: every day at 04:00 ZERACK reads young channels from your scans in the background, seals a batch, and reads each call again 14 days later' : 'Off until you turn it on. When on, ZERACK reads young channels from your scans in the background every day at 04:00', tone: 'muted' },
      { label: 'Publishing', value: 'Never automatic. The export and Share on X only run when you press them', tone: 'muted' }
    ] });
    var actions = [];
    var sealedToday = batches.some(function (b) { return now - Date.parse(b.sealed.sealedAt) < 20 * HOUR; });
    if (!sealedToday) actions.push({ label: 'Seal today\'s batch now', job: { op: 'predict_seal' }, primary: true });
    if (batches.length) actions.push({ label: 'Export JSON', job: { op: 'predict_export' } });
    actions.push(!dailyOn(ledger) ? { label: 'Turn daily sealing on', job: { op: 'predict_daily', on: true } } : { label: 'Turn daily sealing off', job: { op: 'predict_daily', on: false } });
    var lead = say.join(' ');
    var hero = ev.settledBatches ? { value: ra + '% vs ' + rc + '%', label: 'picks that doubled in 14 days against random controls', tone: ra > rc && ev.level >= 4 ? 'good' : 'plain' }
      : (function () {
        var pk = open.reduce(function (n, b) { return n + b.sealed.picks.length; }, 0), ct = open.reduce(function (n, b) { return n + b.sealed.controls.length; }, 0);
        return { value: String(pk), label: open.length ? (pk === 1 ? 'young channel' : 'young channels') + ' called to double their views in 14 days, next to ' + ct + ' random controls' : 'sealed calls so far' };
      })();
    var card = {
      v: 1, kind: 'predict', label: 'PREDICTIONS', lang: langOf(lang), at: now,
      channel: { name: 'Sealed predictions', url: '', line: batches.length + (batches.length === 1 ? ' batch' : ' batches') + ', ' + ev.settledBatches + ' settled' + (!dailyOn(ledger) ? ', daily sealing off' : ', one new batch a day') },
      hero: hero, lead: lead, leadBase: lead, say: sayOf(say, SAY_WORDS),
      notice: extra.notice || '',
      sections: sections, actions: actions,
      next: [{ label: 'Morning brief', text: 'Morning brief settings' }, { label: 'Language gaps', text: 'Language arbitrage' }],
      source: 'Every figure comes from public channel pages read by ZERACK, 0 API quota. Hashes are SHA-256 over the canonical JSON of each sealed batch.',
      model: { batches: batches.length, settledBatches: ev.settledBatches, picks: ev.picks, controls: ev.controls, fisherP: ev.p, evidence: EV_LABEL[ev.key], latestHash: latest ? latest.hash : '' }
    };
    if (batches.length) {
      card.share = {
        kind: 'PREDICTIONS', title: 'Sealed before the results',
        subtitle: batches.length + (batches.length === 1 ? ' batch, ' : ' batches, ') + ev.settledBatches + ' settled',
        hero: ev.settledBatches ? { value: ra + '% vs ' + rc + '%', label: 'picks that doubled in 14 days vs random controls' } : { value: String(latest.sealed.picks.length), label: 'young channels called to double their views in 14 days' },
        rows: [
          { label: 'Picks doubled', value: ev.picks.n ? ev.picks.hits + ' of ' + ev.picks.n : 'waiting' },
          { label: 'Controls doubled', value: ev.controls.n ? ev.controls.hits + ' of ' + ev.controls.n : 'waiting' },
          { label: 'Evidence', value: EV_LABEL[ev.key] },
          { label: 'Latest seal', value: 'sha256 ' + latest.hash.slice(0, 16) }
        ],
        foot: 'Sealed locally with SHA-256 · ' + dayYear(now),
        post: clip(ev.settledBatches ? 'ZERACK sealed its calls before the results: ' + ra + '% of its picks doubled their views in 14 days against ' + rc + '% of random controls. Evidence: ' + EV_LABEL[ev.key].toLowerCase() + '.' : 'ZERACK just sealed ' + latest.sealed.picks.length + ' young channels it expects to double their views in 14 days, next to ' + latest.sealed.controls.length + ' random controls. Hash ' + latest.hash.slice(0, 12) + '.', 200) + ' Open source.'
      };
    }
    return card;
  }

  function exportOf(ledger, now) {
    var batches = ((ledger && ledger.batches) || []).slice().sort(function (x, y) { return Date.parse(x.sealed.sealedAt) - Date.parse(y.sealed.sealedAt); });
    var ev = evidence(ledger, 'en');
    return {
      format: 'zerack-predictions',
      version: 1,
      exportedAt: new Date(Number(now) || Date.now()).toISOString(),
      verify: 'For each batch, sha256 is the SHA-256 hex digest of canonical(sealed): JSON with object keys sorted and no spaces. sealed.prev is the sha256 of the batch before it, so a changed batch breaks every hash after it. settled is added after the 14 days and is not part of the hash.',
      evidence: { picks: ev.picks, controls: ev.controls, fisherOneSidedP: ev.p, verdict: EV_LABEL[ev.key] },
      batches: batches.map(function (b) { return { sha256: b.hash, sealed: b.sealed, settled: b.settled || null }; })
    };
  }

  function langCode(title) {
    var T = engines().T;
    if (!T || typeof T.idiomaDe !== 'function') return '';
    var d = T.idiomaDe(title);
    return d && d.seguro ? d.codigo : '';
  }

  function nicheOf(title) {
    var T = engines().T;
    if (!T || typeof T.resolver !== 'function') return null;
    var r = T.resolver(title, {});
    return r.clasificado ? { label: r.label, name: r.name } : null;
  }

  function arbitrage(input, lang) {
    input = input || {};
    var T = engines().T;
    var now = Number(input.now) || Date.now();
    var seen = {};
    var pools = { en: [], es: [], de: [], pt: [] };
    var unknown = 0, other = 0, total = 0;
    (input.records || []).forEach(function (r) {
      if (!r || !r.title || !(num(r.vph) > 0)) return;
      var key = r.videoId || String(r.title).toLowerCase().slice(0, 80);
      if (seen[key]) return;
      seen[key] = 1;
      total++;
      var code = r.lang || langCode(r.title);
      if (!code) { unknown++; return; }
      if (!pools[code]) { other++; return; }
      var n = nicheOf(r.title);
      pools[code].push({ title: r.title, vph: num(r.vph), niche: n ? n.label : '', name: n ? n.name : '', videoId: r.videoId || '', source: r.source || '' });
    });
    var es = langOf(lang) === 'es';
    var countsText = ['en', 'es', 'de', 'pt'].map(function (c) { return pools[c].length + ' ' + (es ? LANGS_ES[LANG_NAME[c]] : LANG_NAME[c]); }).join(', ');
    var stats = function (pool) {
      var by = {};
      pool.forEach(function (x) { if (x.niche) { (by[x.niche] = by[x.niche] || { label: x.niche, name: x.name, list: [] }).list.push(x); } });
      var all = median(pool.map(function (x) { return x.vph; })) || 0;
      Object.keys(by).forEach(function (k) {
        var s = by[k];
        s.n = s.list.length;
        s.median = median(s.list.map(function (x) { return x.vph; })) || 0;
        s.rel = all > 0 ? s.median / all : 0;
        s.share = pool.length ? s.n / pool.length : 0;
        s.top = s.list.slice().sort(function (a, b) { return b.vph - a.vph; })[0];
      });
      return { by: by, median: all, n: pool.length };
    };
    var en = stats(pools.en);
    var winners = Object.keys(en.by).map(function (k) { return en.by[k]; }).filter(function (s) { return s.n >= ARB_EN_MIN && s.rel >= ARB_WIN; }).sort(function (a, b) { return b.rel - a.rel; });
    var sections = [];
    var gaps = [];
    var say = [fill('a_lead', lang, { n: total, counts: countsText })];
    var enNote = 'English pool: ' + en.n + ' uploads with views, median ' + compact(en.median) + ' views an hour. A niche wins in English when it has ' + ARB_EN_MIN + '+ uploads there at ' + ARB_WIN + 'x or more the English median.';
    var refused = en.n < ARB_POOL ? 'Only ' + en.n + ' English uploads with views are stored, and ' + ARB_POOL + ' are needed to know what wins in English.' : (!winners.length ? 'No niche in the ' + en.n + ' English uploads runs at ' + ARB_WIN + 'x the English median with ' + ARB_EN_MIN + ' or more uploads.' : '');
    sections.push({ id: 'en', title: 'Wins in English', rows: refused ? [{ label: 'Not judged', value: refused, tone: 'muted' }] : winners.slice(0, 8).map(function (s) {
      return { label: clip(s.name, 30), value: s.n + ' uploads at ' + mult(s.rel) + ' the English median (' + compact(s.median) + ' views an hour)', tone: 'good', link: s.top && s.top.videoId ? watchUrl(s.top.videoId) : '' };
    }), note: enNote });
    var judged = [];
    ARB_TARGETS.forEach(function (code) {
      var name = LANG_NAME[code];
      var pool = pools[code];
      var rows = [];
      var note;
      if (refused) {
        rows.push({ label: 'Not judged', value: 'English first: ' + refused.charAt(0).toLowerCase() + refused.slice(1), tone: 'muted' });
        note = pool.length + ' ' + name + ' uploads stored.';
      } else if (pool.length < ARB_POOL) {
        rows.push({ label: 'Not judged', value: 'Only ' + pool.length + ' ' + name + ' uploads with views are stored, and ' + ARB_POOL + ' are needed before a niche can be called missing there', tone: 'muted' });
        note = 'Press Measure to run the Country radar in ' + name + ' for this month.';
      } else {
        judged.push(code);
        var st = stats(pool);
        winners.forEach(function (w) {
          var t = st.by[w.label];
          var n = t ? t.n : 0;
          var shareEn = w.share, shareT = pool.length ? n / pool.length : 0;
          var state = n <= ARB_MISSING ? 'missing' : ((shareT < shareEn / ARB_SHARE || (t && t.rel < ARB_REL)) ? 'weak' : 'served');
          var rpm = T && T.mercados && T.rows ? (function () { var base = 0; T.rows.forEach(function (rr) { if (rr.label === w.label) base = rr.rpm; }); return base * (T.mercados[code] || T.mercadoNeutro || 0); })() : 0;
          var value = state === 'missing'
            ? (n === 0 ? 'No ' + name + ' upload' : 'Only ' + n + ' ' + name + (n === 1 ? ' upload' : ' uploads')) + ' of ' + pool.length + ' read, against ' + w.n + ' of ' + en.n + ' in English'
            : n + ' of ' + pool.length + ' ' + name + ' uploads (' + pct(n, pool.length) + '% against ' + pct(w.n, en.n) + '% in English), ' + (t ? mult(t.rel) + ' the ' + name + ' median' : '');
          var row = { label: clip(w.name, 30), value: value, tag: state.toUpperCase(), tone: state === 'served' ? 'muted' : 'good' };
          if (rpm > 0 && state !== 'served') row.note = 'Reference RPM in ' + name + ': $' + rpm.toFixed(2) + ' per 1,000 views, an estimate from the RPM table.';
          rows.push(row);
          if (state !== 'served') gaps.push({ niche: w.name, label: w.label, lang: code, state: state, n: n, pool: pool.length, en: w.n, enRel: w.rel, rpm: rpm });
        });
        if (!rows.length) rows.push({ label: 'Nothing to compare', value: 'No niche wins in English yet', tone: 'muted' });
        note = name + ' pool: ' + pool.length + ' uploads with views, median ' + compact(st.median) + ' views an hour. Missing means ' + ARB_MISSING + ' uploads or fewer; weak means its share is under 1/' + ARB_SHARE + ' of the English share, or it runs under ' + ARB_REL + 'x the ' + name + ' median.';
      }
      sections.push({ id: 'lang-' + code, title: name, rows: rows, note: note });
    });
    gaps.sort(function (a, b) { return (a.state === 'missing' ? 0 : 1) - (b.state === 'missing' ? 0 : 1) || b.enRel - a.enRel; });
    if (refused) say.push(fill('a_thin', lang));
    else if (gaps.length) gaps.slice(0, 2).forEach(function (g) {
      var ln = LANG_NAME[g.lang];
      say.push(fill('a_gap', lang, { niche: es ? g.label : g.niche, state: fill(g.state === 'missing' ? 'a_missing' : 'a_weak', lang), lang: es ? LANGS_ES[ln] : ln }));
    });
    else say.push(judged.length ? fill('a_none', lang) : fill('a_thin', lang));
    var sources = input.sources || {};
    var thin = ARB_TARGETS.filter(function (c) { return pools[c].length < ARB_POOL; });
    if (en.n < ARB_POOL) thin.unshift('en');
    var actions = thin.length ? [{ label: 'Measure ' + thin.map(function (c) { return c.toUpperCase(); }).join(', ') + ' now', job: { op: 'arb_measure', langs: thin }, primary: true }] : [{ label: 'Measure again', job: { op: 'arb_measure', langs: ['en'].concat(ARB_TARGETS) } }];
    var lead = say.join(' ');
    var card = {
      v: 1, kind: 'arb', label: 'LANGUAGE GAPS', lang: langOf(lang), at: now,
      channel: { name: 'Wins in English, missing elsewhere', url: '', line: 'Spanish, German and Portuguese against English' },
      hero: refused ? { value: 'Too little data', word: true, label: 'no language gap can be called honestly yet' } : (gaps.length ? { value: String(gaps.length), label: gaps.length === 1 ? 'niche that wins in English and is missing or weak in ES, DE or PT' : 'niches that win in English and are missing or weak in ES, DE or PT', tone: 'good' } : { value: '0', label: judged.length ? 'gaps in the languages with enough data' : 'languages with enough data to judge' }),
      lead: lead, leadBase: lead, say: sayOf(say, SAY_WORDS),
      sections: sections, actions: actions,
      next: [{ label: 'Predictions', text: 'Show my predictions' }],
      source: 'Measured from ' + total + ' distinct titles, out of ' + num(sources.corpus) + ' stored from your scans and ' + num(sources.feed) + ' from the Country radar' + (sources.markets ? ' (' + sources.markets + ')' : '') + '. Language read from each title' + (num(sources.byMarket) ? ', and ' + num(sources.byMarket) + ' plain titles with no language marker from English radar markets counted as English' : '') + '; ' + unknown + ' titles with no clear language and ' + other + ' in other languages were left out. Views an hour is views over age. No AI model used.',
      model: { titles: total, pools: { en: en.n, es: pools.es.length, de: pools.de.length, pt: pools.pt.length }, winsInEnglish: winners.slice(0, 8).map(function (w) { return { niche: w.name, uploads: w.n, overEnglishMedian: Math.round(w.rel * 100) / 100 }; }), gaps: gaps.slice(0, 10), judged: judged, refused: refused || '' }
    };
    if (gaps.length) {
      card.share = {
        kind: 'LANGUAGE GAPS', title: 'Wins in English, missing elsewhere', subtitle: 'Measured from ' + total + ' titles',
        hero: { value: String(gaps.length), label: gaps.length === 1 ? 'niche open in another language' : 'niches open in other languages' },
        rows: gaps.slice(0, 4).map(function (g) { return { label: clip(g.niche, 26) + ' in ' + LANG_NAME[g.lang], value: g.state === 'missing' ? (g.n ? g.n + ' uploads' : 'none') + ' of ' + g.pool : 'weak' }; }),
        foot: 'Measured from public YouTube data · ' + dayYear(now),
        post: clip(gaps[0].niche + ' wins in English and is ' + gaps[0].state + ' in ' + LANG_NAME[gaps[0].lang] + ': ' + gaps[0].n + ' of ' + gaps[0].pool + ' uploads there.', 180) + ' Measured with ZERACK, open source.'
      };
    }
    return card;
  }

  var ASKS = [
    /\b(?:please|pls|plz)\b[^.?!]{0,60}\b(?:make|do|cover|talk|explain|upload|video|part|episode|react|review)\b/,
    /\b(?:can|could|would|will) (?:you|u)(?: guys)?(?: please| pls)? (?:make|do|cover|talk|explain|react|review|show|film|try|upload)\b/,
    /\b(?:make|do|upload) (?:a|an|another|more|one more|the next) (?:video|part|episode|series|one|vid)\b/,
    /\bpart (?:2|two|ii|3|three)\b/,
    /\b(?:i|we)(?: would|d| really)? (?:love|like|want) (?:to see|a video|another|more|you to)\b/,
    /\bmore (?:videos?|content|episodes?|of these|like this) (?:about|on|like|of)\b/,
    /\bdo (?:one|a video|an episode) (?:about|on)\b/,
    /\bnext (?:video|episode|part)\b[^.?!]{0,40}\b(?:about|on|should|please)\b/,
    /\bwaiting for (?:the )?(?:next|part)\b/,
    /(?:^|[.!?]\s+)["'(]?(?:so |and |but )?(?:what|how) about (?:the |a |an |some |one |your |this |that )?[a-z0-9]{3,}/,
    /\b(?:you|they|someone|u) (?:should|could|need to|have to|gotta) (?:try|do|cover|make|look (?:at|into)|talk about|explain|read|translate|analy[sz]e|investigate|compare|show)\b/,
    /\b(?:i'?m|i am|we'?re|we are) (?:way |much |far |a lot |really |so )*more interested in\b/,
    /(?:^|[.!?]\s+)[\u00bf\u00a1]?(?:y )?(?:que tal|y que hay de|y que pasa con los?|y sobre|que me dices de) (?:un |una |el |la |los |las |lo )?[a-z0-9]{3,}/,
    /\bdeber(?:ias|ian|ia) (?:hacer|hablar|subir|explicar|cubrir|probar|investigar|analizar|traducir)\b/,
    /\bwas ist mit\b|\bwie w(?:a|ae)re es mit\b|\bsolltet? (?:ihr|du) (?:mal )?(?:machen|zeigen|erklaren|erklaeren)\b/,
    /(?:^|[.!?]\s+)(?:e )?(?:que tal|e sobre|e o|e a) (?:um |uma |o |a |os |as )?[a-z0-9]{3,}[^.!?]{0,60}\?|\bdeveria(?:m)? (?:fazer|falar|mostrar|explicar)\b/,
    /\b(?:haz|hagan|hace|hacer|sube|suban|podrias hacer|puedes hacer|podrian hacer|pueden hacer) (?:un|una|otro|otra|mas|el|la) (?:video|parte|capitulo|serie|episodio)\b/,
    /\b(?:segunda|tercera) parte\b|\bparte (?:2|dos|3|tres)\b/,
    /\b(?:me|nos) (?:gustaria|encantaria) (?:ver|un video|que hicieras|que hagas|que hablaras|que hables)\b/,
    /\bmas videos? (?:de|sobre|como|asi)\b/,
    /\bpor ?favor[^.?!]{0,50}\b(?:haz|hagan|sube|suban|habla|hablen|explica|video|parte)\b/,
    /\b(?:habla|hablen|hablar|explica|expliquen) (?:de|sobre|acerca)\b/,
    /\b(?:podrias|puedes|podrian|pueden) (?:hablar|explicar|contar|hacer|subir)\b/,
    /\besperando (?:la|el) (?:siguiente|proximo|segunda)\b/,
    /\bbitte\b[^.?!]{0,50}\b(?:mach|macht|mehr|video|teil)\b|\bteil (?:2|zwei)\b|\bkannst du (?:mal )?(?:ein|eine|uber|ueber|bitte)\b|\bmehr videos? (?:uber|ueber|zu|von)\b/,
    /\b(?:faz|faca|fazer|poderia fazer|pode fazer) (?:um|uma|outro|outra|mais) (?:video|parte|episodio)\b|\bmais videos? (?:sobre|de)\b|\bpor favor[^.?!]{0,50}\b(?:faz|faca|fala|video|parte)\b/
  ];

  function asks(text) {
    var t = String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (var i = 0; i < ASKS.length; i++) if (ASKS[i].test(t)) return true;
    return false;
  }

  function digest(comments) {
    var list = (comments || []).filter(function (c) { return c && String(c.text || '').trim(); }).map(function (c) {
      return { text: String(c.text).replace(/\s+/g, ' ').trim().slice(0, 500), likes: Math.max(0, Math.round(num(c.likes))), author: String(c.author || '').slice(0, 60), ask: asks(c.text), question: /\?/.test(String(c.text)) };
    });
    var req = list.filter(function (c) { return c.ask; }).sort(function (a, b) { return b.likes - a.likes; });
    return { read: list.length, asks: req.length, questions: list.filter(function (c) { return c.question && !c.ask; }).length, requests: req.slice(0, 10), comments: list };
  }

  function commentsCard(input, lang) {
    input = input || {};
    var d = input.digest || digest(input.comments);
    var video = input.video || {};
    var ai = input.ai || null;
    var result = ai && ai.ok ? ai.result || {} : null;
    var ideas = result && Array.isArray(result.ideas) ? result.ideas.slice(0, 3) : [];
    var sections = [];
    var say = [];
    if (!d.read) say.push(fill('c_empty', lang));
    else {
      say.push(d.asks ? fill('c_lead', lang, { k: d.asks, n: d.read }) : fill('c_none', lang, { n: d.read }));
      if (d.requests[0]) say.push(fill('c_top', lang, { text: clip(d.requests[0].text, 90) }));
    }
    if (ideas.length) say.push(fill('c_ideas', lang, { list: ideas.map(function (x, i) { return (i + 1) + ', ' + clip(x.title, 80); }).join('; ') }));
    var ideaRows = ideas.map(function (x, i) {
      return { label: String(i + 1), value: clip(x.title, 110), note: (x.answers ? 'Answers: ' + clip(x.answers, 150) : '') + (x.comments ? (x.answers ? ' · ' : '') + x.comments + (x.comments === 1 ? ' comment behind it' : ' comments behind it') : ''), wide: true };
    });
    var ideaNote;
    if (ideas.length) ideaNote = 'Written by ' + (ai.by || 'your AI provider') + ' from the comments and the requests above. The comments are data it read, never instructions.';
    else if (input.toolMode) ideaNote = 'Left to the assistant: it writes the three ideas in its answer from these requests.';
    else if (!d.read) ideaNote = 'Nothing to turn into ideas.';
    else ideaNote = ai && ai.reason ? ai.reason : 'Not written.';
    sections.push({ id: 'ideas', title: '3 video ideas from the comments', concept: true, rows: ideaRows.length ? ideaRows : [{ label: 'Ideas', value: input.toolMode ? 'In the answer below' : 'Not written', tone: 'muted' }], note: ideaNote, copy: ideas.length ? { label: 'Copy the titles', text: ideas.map(function (x) { return x.title; }).join('\n') } : null });
    var askRows = d.requests.slice(0, 6).map(function (c) {
      return { label: c.likes ? compact(c.likes) + (c.likes === 1 ? ' like' : ' likes') : 'no likes', value: '"' + clip(c.text, 180) + '"', wide: true };
    });
    sections.push({ id: 'asks', title: 'What they ask for', rows: askRows.length ? askRows : [{ label: 'Requests', value: d.read ? 'No comment asks for a video, a part two or a topic' : 'No comments to read', tone: 'muted' }], note: d.read ? 'Found by phrase, not by a model: comments that ask for a video, a topic, a part two or more of something, in English, Spanish, German or Portuguese. Sorted by likes. ' + d.questions + ' other comments ask a question.' : '' });
    if (result && Array.isArray(result.requests) && result.requests.length) sections.push({ id: 'grouped', title: 'The asks, grouped', rows: result.requests.slice(0, 6).map(function (r) { return { label: 'Asked', value: clip(r, 160) }; }), note: 'Grouped by the model from the same comments.' });
    if (result && Array.isArray(result.painPoints) && result.painPoints.length) sections.push({ id: 'pain', title: 'Pain points', rows: result.painPoints.slice(0, 5).map(function (r) { return { label: 'Pain', value: clip(r, 160), tone: 'bad' }; }) });
    if (result && result.sentiment) {
      var s = result.sentiment;
      sections.push({ id: 'mood', title: 'Mood', rows: [{ label: 'AI reading', value: num(s.positive) + ' positive, ' + num(s.neutral) + ' neutral, ' + num(s.negative) + ' negative' }], note: result.summary ? clip(result.summary, 300) : '' });
    }
    var lead = say.join(' ');
    var vid = video.id || '';
    var card = {
      v: 1, kind: 'comments', label: 'COMMENTS', lang: langOf(lang), at: Date.now(),
      channel: { name: clip(video.title || 'This video', 90), url: watchUrl(vid), line: (video.channel ? clip(video.channel, 40) + ' · ' : '') + d.read + ' top comments read' + (input.videos > 1 ? ' from ' + input.videos + ' uploads' : '') },
      hero: d.read ? { value: d.asks + ' of ' + d.read, label: 'comments ask for something', tone: d.asks ? 'good' : 'plain' } : { value: 'No comments', word: true, label: 'nothing to read on this video' },
      lead: lead, leadBase: lead, say: sayOf(say, SAY_WORDS),
      sections: sections,
      next: vid ? [{ label: 'X-ray the channel', text: 'X-ray ' + watchUrl(vid) }] : [],
      source: 'Read the top ' + d.read + ' comments from YouTube\'s public comment pages, 0 API quota' + (input.pages ? ', ' + input.pages + ' pages' : '') + '.',
      model: { video: video.title || '', commentsRead: d.read, asking: d.asks, topRequests: d.requests.slice(0, 8).map(function (c) { return { text: c.text.slice(0, 240), likes: c.likes }; }), sampleComments: d.comments.slice(0, 25).map(function (c) { return { text: c.text.slice(0, 200), likes: c.likes }; }), ideas: ideas.map(function (x) { return x.title; }) }
    };
    if (ideas.length || d.asks) {
      card.share = {
        kind: 'COMMENTS', title: clip(video.title || 'This video', 80), subtitle: video.channel || '',
        hero: { value: d.asks + ' of ' + d.read, label: 'comments ask for something' },
        quote: d.requests[0] ? { label: 'Most liked ask', text: clip(d.requests[0].text, 160) } : null,
        rows: ideas.map(function (x, i) { return { label: 'Idea ' + (i + 1), value: clip(x.title, 60) }; }),
        image: thumbUrl(vid),
        foot: 'Read from public comments · ' + dayYear(Date.now()),
        post: clip('Read ' + d.read + ' comments on "' + clip(video.title || 'a video', 60) + '": ' + d.asks + ' ask for something.' + (ideas[0] ? ' Idea: ' + ideas[0].title : ''), 200) + ' With ZERACK, open source.'
      };
    }
    return card;
  }

  var LEAD = /^(?:(?:hey|oye|ok|okay|hola|zerack|please|por favor|porfa|y|and|so|now|ahora|a ver|pues|bueno)\s+)+/;
  var BRIEF = '(?:morning brief|daily brief|morning briefing|daily briefing|the brief|brief|resumen de la manana|resumen diario|resumen matutino|resumen de hoy|resumen de la noche|informe de la manana|informe diario|informe matutino|parte de la manana)';
  var BRIEF_AT = '(?:\\s+(?:at|for|a las|a la|para las|para la)\\s+(\\d{1,2}|five|six|seven|eight|nine|ten|eleven|twelve|cinco|seis|siete|ocho|nueve|diez|once|doce|una)(?:\\s?(?:h|00|30))?\\s*(am|pm|de la manana|de la tarde)?)?';
  var BRIEF_DAILY = '(?:\\s+(?:every day|daily|each morning|todos los dias|cada dia|cada manana))?';
  var BRIEF_ON = new RegExp('^(?:turn on|switch on|enable|activate|set up|schedule|activa|activar|enciende|encender|prende|programa|programar)\\s+(?:the |my |a |el |mi |un )?' + BRIEF + BRIEF_AT + BRIEF_DAILY + '$');
  var BRIEF_ON_MAYBE = new RegExp('^(?:start|pon|ponme)\\s+(?:the |my |a |el |mi |un )?' + BRIEF + BRIEF_AT + BRIEF_DAILY + '$');
  var BRIEF_SCHEDULE = /\b(?:at|a las|a la|para las|para la|every day|daily|each morning|todos los dias|cada dia|cada manana)\b/;
  var BRIEF_OFF = new RegExp('^(?:turn off|switch off|disable|stop|cancel|deactivate|desactiva|desactivar|apaga|apagar|quita|quitar|cancela|cancelar|deten|detener)\\s+(?:the |my |el |mi )?' + BRIEF + '$');
  var BRIEF_NOW = new RegExp('^(?:(?:show me|give me|read me|run|make|open|dame|muestrame|leeme|haz|hazme|abre|lee|corre)\\s+)?(?:the |my |el |mi |un )?' + BRIEF + '(?:\\s+(?:now|today|ahora|de hoy|ya))?$');
  var BRIEF_SET = new RegExp('^(?:' + BRIEF + '\\s+(?:settings|options|status|ajustes|opciones|estado)|(?:ajustes|opciones|estado) del? ' + BRIEF + ')$');
  var OVERNIGHT = /^(?:what did (?:my )?(?:competitors|rivals|watched channels|channels i watch) (?:do|post|upload)(?: last night| overnight| today| yesterday)?|what happened (?:last night|overnight)(?: (?:with|on) my (?:channels|competitors|niches))?|que (?:hicieron|subieron|publicaron) (?:mis )?(?:competidores|rivales|canales vigilados)(?: anoche| hoy| ayer| esta noche)?|que paso anoche(?: con mis (?:canales|competidores|nichos))?)$/;
  var SELF_CH = '(?:this channel|that channel|the channel|este canal|ese canal|el canal|chref|this one|this|este)';
  var CHANNEL_REF = '(?:this channel|that channel|the channel|este canal|ese canal|el canal|chref|(?:the channel|el canal|canal)\\s+(?:de\\s+)?chref)';
  var WATCH_ADD = new RegExp('^(?:watch|track|monitor|vigila|vigilar|monitorea|rastrea|sigue de cerca|turn on alerts for|turn on alerts on|activa las alertas de|activa las alertas para|activa alertas de)\\s+' + CHANNEL_REF + '(?:\\s+(?:for outliers|for me|por mi|por outliers|por si explota))?$');
  var WATCH_ASK = new RegExp('^(?:alert me|notify me|tell me|let me know|avisame|notificame|dime)\\s+(?:when|if|cuando|si)\\s+' + SELF_CH + '\\s+(?:posts?|uploads?|has|gets|drops|saca|saque|sube|suba|publica|publique|tiene|tenga)\\s+(?:an? |un |otro )?(?:outlier|hit|viral video|video viral|bombazo|exito|pelotazo)$');
  var WATCH_DEL = new RegExp('^(?:stop watching|unwatch|stop tracking|deja de vigilar|deja de seguir|dejar de vigilar|turn off alerts for|turn off alerts on|desactiva las alertas de|quita las alertas de)\\s+' + SELF_CH + '$');
  var WATCH_LIST = /^(?:(?:which|what) channels (?:am i|do i|are you) (?:watching|tracking|track|watch|following)|(?:my )?watched channels|(?:my )?watch ?list|(?:que|cuales) canales (?:vigilo|sigo|estoy vigilando|vigilas|estas vigilando)|(?:mis )?canales vigilados)$/;
  var PRED = '(?:predictions?|prediction receipts|prediction ledger|forecasts?|receipts|predicciones|pronosticos|recibos de (?:mis |las )?predicciones)';
  var PRED_SHOW = new RegExp('^(?:(?:show me|show|open|give me|see|check|muestrame|abre|dame|ver|ensename|revisa)\\s+)?(?:my |the |your |mis |las |tus )?' + PRED + '(?:\\s+(?:ledger|record|track record|so far|historial|hasta ahora|de zerack))?$|^how (?:are|did|good are) (?:my |the |your )?predictions?(?: (?:do|doing|going|perform|performing))?$|^como van (?:mis |las |tus )?predicciones$');
  var PRED_SEAL = new RegExp('^(?:seal|make|run|create|haz|hazme|sella|sellar|genera|crea)\\s+(?:today s |todays |the |some |new |las |unas |nuevas |mas )?' + PRED + '(?:\\s+(?:now|today|ahora|de hoy|ya))?$');
  var PRED_EXPORT = new RegExp('^(?:export|download|save|exporta|exportar|descarga|descargar|guarda)\\s+(?:my |the |mis |las )?' + PRED + '(?:\\s+(?:as |como |en )?json)?$');
  var ARB_LANG = { spanish: 'es', espanol: 'es', castellano: 'es', es: 'es', german: 'de', aleman: 'de', de: 'de', portuguese: 'pt', portugues: 'pt', pt: 'pt', brazil: 'pt', brasil: 'pt' };
  var ARB_RE = /^(?:(?:show me|find|give me|run|do|muestrame|busca|dame|haz|hazme)\s+)?(?:the |a |el |un |my |mi )?(?:language arbitrage|arbitraje de idiomas?|language gaps?|huecos? de idiomas?|brechas? de idiomas?)(?:\s+(?:for|in|into|en|para|al|hacia)\s+(\w+))?$|^(?:what|which niches?|which) (?:wins?|is winning|are winning|win) in english (?:and|but) (?:is |are )?(?:missing|weak|absent|not there|nowhere)(?: in (\w+))?$|^(?:que|cuales|que nichos) (?:nichos )?ganan? en ingles y (?:faltan?|no (?:existen?|estan?|hay)|flojean?)(?: en (\w+))?$/;
  var COMMENTS_RE = /^(?:what (?:do|are|is) (?:the |my |these )?(?:comments|viewers|audience|subscribers|people in the comments) (?:ask(?:ing)? for|want(?:ing)?|request(?:ing)?|say(?:ing)?)|(?:give me |get |make |find )?(?:video )?ideas (?:from|out of) (?:the |my |these )?comments|turn (?:the |my )?comments into (?:video )?ideas|comments to (?:video )?ideas|read (?:me )?(?:the |my )?comments|(?:que|lo que) (?:piden|pide|dicen|dice|quieren|quiere) (?:los comentarios|mis comentarios|mi audiencia|la audiencia|los espectadores|mis seguidores|mis suscriptores|la gente en los comentarios|en los comentarios)|(?:dame )?ideas (?:de|desde|a partir de|sacadas de) (?:los |mis |estos )?comentarios|(?:convierte|pasa|transforma) (?:los |mis )?comentarios en ideas|lee(?:me)? (?:los |mis )?comentarios)(?:\s+(?:of|on|for|in|de|del|en)\s+(?:this video|este video|el video|that video|ese video|chref))?$/;
  var OWN = /\b(?:my|mis|mi)\b/;
  var ES_WORDS = /\b(?:activa|activar|enciende|prende|programa|pon|ponme|apaga|desactiva|quita|cancela|dame|muestrame|leeme|haz|hazme|abre|lee|resumen|informe|manana|vigila|vigilar|avisame|este|canal|deja|mis|las|tus|predicciones|sella|genera|crea|exporta|descarga|guarda|arbitraje|huecos?|ganan?|ingles|que|cuales|comentarios|piden|dicen|quieren|ideas de|convierte|pasa|transforma|anoche|hicieron|subieron|como van|canales|ajustes|opciones|estado|del)\b/;

  function refsOf(raw) {
    var x = I();
    if (x && x.refsOf) return x.refsOf(raw);
    return { refs: [], text: String(raw || '') };
  }

  var HOUR_WORDS = { una: 1, five: 5, cinco: 5, six: 6, seis: 6, seven: 7, siete: 7, eight: 8, ocho: 8, nine: 9, nueve: 9, ten: 10, diez: 10, eleven: 11, once: 11, twelve: 12, doce: 12 };

  function hourOf(m) {
    if (!m || m[1] == null) return null;
    var h = HOUR_WORDS[m[1]] != null ? HOUR_WORDS[m[1]] : Number(m[1]);
    if (!(h >= 0 && h <= 23)) return null;
    var ap = m[2] || '';
    if (/^(?:pm|de la tarde)$/.test(ap) && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h;
  }

  function intent(raw) {
    var r = refsOf(String(raw || '').slice(0, 600));
    var s = norm(r.text).replace(LEAD, '').trim();
    if (!s || s.split(' ').length > 16) return null;
    var lang = ES_WORDS.test(s) ? 'es' : 'en';
    var hit = function (o) { o.lang = lang; o.said = s; return o; };
    var m;
    if ((m = BRIEF_ON.exec(s))) return hit({ kind: 'brief', op: 'on', hour: hourOf([null, m[1], m[2]]) });
    if ((m = BRIEF_ON_MAYBE.exec(s))) return BRIEF_SCHEDULE.test(s) ? hit({ kind: 'brief', op: 'on', hour: hourOf([null, m[1], m[2]]) }) : hit({ kind: 'brief', op: 'now' });
    if (BRIEF_OFF.test(s)) return hit({ kind: 'brief', op: 'off' });
    if (BRIEF_SET.test(s)) return hit({ kind: 'brief', op: 'state' });
    if (BRIEF_NOW.test(s) || OVERNIGHT.test(s)) return hit({ kind: 'brief', op: 'now' });
    if (WATCH_ADD.test(s) || WATCH_ASK.test(s)) {
      if (/chref/.test(s) && r.refs.length !== 1) return null;
      return hit({ kind: 'watch', op: 'add', who: r.refs.length ? r.refs[0] : { tab: true } });
    }
    if (WATCH_DEL.test(s)) {
      if (/chref/.test(s) && r.refs.length !== 1) return null;
      return hit({ kind: 'watch', op: 'remove', who: r.refs.length ? r.refs[0] : { tab: true } });
    }
    if (WATCH_LIST.test(s)) return hit({ kind: 'watch', op: 'list' });
    if (PRED_SEAL.test(s)) return hit({ kind: 'predict', op: 'seal' });
    if (PRED_EXPORT.test(s)) return hit({ kind: 'predict', op: 'export' });
    if (PRED_SHOW.test(s)) return hit({ kind: 'predict', op: 'show' });
    if ((m = ARB_RE.exec(s))) {
      var want = m[1] || m[2] || m[3] || '';
      if (want && !ARB_LANG[want]) return null;
      return hit({ kind: 'arb', target: want ? ARB_LANG[want] : '' });
    }
    if (COMMENTS_RE.test(s)) {
      if (/chref/.test(s) && r.refs.length !== 1) return null;
      var who = r.refs.length ? r.refs[0] : (OWN.test(s) ? { mine: true } : { tab: true });
      return hit({ kind: 'comments', who: who });
    }
    return null;
  }

  function line(key, lang, vars) { return fill(key, lang, vars); }

  function dailyOn(ledger) {
    return !!ledger && (ledger.on === true || ledger.off === false);
  }

  root.NSP_WATCH = {
    OUTLIER_X: OUTLIER_X,
    FRESH_HOURS: FRESH_HOURS,
    BRIEF_HOUR: BRIEF_HOUR,
    HORIZON_DAYS: HORIZON_DAYS,
    YOUNG_DAYS: YOUNG_DAYS,
    RECENT_HOURS: RECENT_HOURS,
    MIN_SCORE: MIN_SCORE,
    MIN_SETTLED: MIN_SETTLED,
    PICKS: PICKS,
    CONTROLS: CONTROLS,
    ARB_POOL: ARB_POOL,
    ARB_TARGETS: ARB_TARGETS,
    intent: intent,
    outliers: outliers,
    alertText: alertText,
    nextAt: nextAt,
    hourLabel: hourLabel,
    briefCard: briefCard,
    briefState: briefState,
    watchCard: watchCard,
    canonical: canonical,
    ageDays: ageDays,
    scoreOf: scoreOf,
    pick: pick,
    sealable: sealable,
    settleOf: settleOf,
    fisher: fisher,
    evidence: evidence,
    predictCard: predictCard,
    exportOf: exportOf,
    arbitrage: arbitrage,
    langCode: langCode,
    asks: asks,
    digest: digest,
    commentsCard: commentsCard,
    median: median,
    use: use,
    dailyOn: dailyOn,
    line: line
  };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
