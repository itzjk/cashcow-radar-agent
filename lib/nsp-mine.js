(function (root) {
  'use strict';

  function mod(name) {
    if (root && root[name]) return root[name];
    if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name];
    return null;
  }

  var SAY_WORDS = 50;
  var OUTLIER = 2;
  var LEANS = 1.5;
  var SLOT_HOURS = 3;
  var SLOT_MIN = 3;
  var TIMED_MIN = 6;
  var NEIGHBORS = 3;
  var STANDS_OUT = 1.15;
  var HABIT = 0.6;
  var RECENT_DAYS = 14;
  var FEED_DAYS = 7;
  var RISING = 1.5;
  var TREND = 1.3;
  var SIGNAL_MIN = 3;
  var CADENCES = [4, 8, 12];
  var PAYBACK_STEP = 10;
  var DAY_MS = 86400000;
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var P = {
    and: { en: ' and ', es: ' y ' },
    to: { en: ' to ', es: ' a ' },
    dollars: { en: '{n} dollars', es: '{n} dólares' },
    times: { en: '{n} times', es: '{n} veces' },
    w_best: { en: '{name}, your best video has {views} views, {mult} your median.', es: '{name}, tu mejor video tiene {views} vistas, {mult} tu mediana.' },
    w_flat: { en: '{name}, your uploads run close together, near {median} views each.', es: '{name}, tus videos van parejos, cerca de {median} vistas cada uno.' },
    w_none: { en: '{name}: no view counts came back, so there is nothing to wrap.', es: '{name}: no volvieron vistas, así que no hay nada que resumir.' },
    w_hour: { en: 'Your best window is {when}, at {lift} its neighbors.', es: 'Tu mejor franja es {when}, a {lift} sus vecinos.' },
    w_hour_one: { en: 'You publish between {from} and {to} almost every time, {n} of {timed}, so there is no other window to compare.', es: 'Publicas casi siempre entre las {from} y las {to}, {n} de {timed}, así que no hay otra franja con la que comparar.' },
    w_hour_spread: { en: 'Your uploads are spread across the day, so no window has enough of them to name a best hour yet.', es: 'Tus videos salen repartidos a lo largo del día, así que ninguna franja tiene suficientes para nombrar una mejor hora.' },
    w_hour_flat: { en: 'No publishing hour stands out from the others.', es: 'Ninguna hora de publicación destaca sobre las otras.' },
    w_hour_few: { en: 'Too few uploads carry an exact time to name a best hour.', es: 'Muy pocos videos traen la hora exacta para nombrar una mejor hora.' },
    w_niche: { en: 'Your real niche reads as {niche}.', es: 'Tu nicho real se lee como {niche}.' },
    w_formula: { en: 'Your winners lean on {traits}.', es: 'Tus ganadores tiran de {traits}.' },
    n_pick: { en: 'Your next video: {topic}. It follows "{title}", which did {mult} your median.', es: 'Tu próximo video: {topic}. Sigue a "{title}", que hizo {mult} tu mediana.' },
    n_rising: { en: 'The topic is also running hot in {where}.', es: 'El tema además va fuerte en {where}.' },
    n_alone: { en: 'No rising signal was measured, so this rests on your own numbers.', es: 'No se midió ninguna señal al alza, así que esto se apoya en tus propios números.' },
    n_flat: { en: '{name}: no upload beats your median by {x}, so there is no outlier to follow yet.', es: '{name}: ningún video supera tu mediana {x} veces, así que aún no hay un ganador que seguir.' },
    n_title: { en: 'Title: {title}.', es: 'Título: {title}.' },
    t_head: { en: 'The judge puts this title at percentile {p}.', es: 'El juez pone este título en el percentil {p}.' },
    t_own: { en: 'It scores above {n} of your last {of} titles.', es: 'Puntúa por encima de {n} de tus últimos {of} títulos.' },
    t_niche: { en: 'Against the real winners of {niche} it lands {pos}.', es: 'Contra los ganadores reales de {niche} queda {pos}.' },
    t_empty: { en: 'Give me the title after the words judge this title.', es: 'Dame el título después de las palabras juzga este título.' },
    th_head: { en: 'At phone size your thumbnail reads better than {pct} percent of {n} winners of the niche.', es: 'A tamaño de móvil tu miniatura se lee mejor que el {pct} por ciento de {n} ganadores del nicho.' },
    th_fix: { en: 'First change: {fix}', es: 'Primer cambio: {fix}' },
    th_text: { en: '{n} of {of} winners carry text or a logo band and yours carries none: add two or three big words on the clean side.', es: '{n} de {of} ganadores llevan texto o una franja con logo y la tuya no lleva nada: añade dos o tres palabras grandes en el lado limpio.' },
    th_hue_one: { en: 'The winners share {hues} and yours carries none of it: work one of those into the background or the accent.', es: 'Los ganadores comparten {hues} y la tuya no lo lleva: mete uno de ellos en el fondo o en el acento.' },
    th_hue_many: { en: 'The winners share {hues} and yours carries neither: work one of those into the background or the accent.', es: 'Los ganadores comparten {hues} y la tuya no lleva ninguno: mete uno de ellos en el fondo o en el acento.' },
    th_lowres: { en: 'Low resolution{px}: export at 1280x720 so it stays sharp.', es: 'Resolución baja{px}: expórtala a 1280x720 para que se vea nítida.' },
    hue_and: { en: ' and ', es: ' y ' },
    th_none: { en: 'The niche winners could not be measured, so there is nothing to place your thumbnail against.', es: 'No se pudieron medir los ganadores del nicho, así que no hay contra qué poner tu miniatura.' },
    g_head: { en: 'Three thumbnail concepts for "{title}".', es: 'Tres conceptos de miniatura para "{title}".' },
    g_draw: { en: 'Press Draw to have your {provider} key draw them.', es: 'Pulsa Draw para que tu clave de {provider} las dibuje.' },
    g_empty: { en: 'Give me the title after the words: thumbnail ideas for.', es: 'Dame el título después de las palabras: ideas de miniatura para.' },
    g_nokey: { en: 'No image key is set, so here are the prompts. A Gemini or OpenAI key in Setup would draw them.', es: 'No hay clave de imagen, así que aquí están los prompts. Una clave de Gemini u OpenAI en Setup las dibujaría.' },
    p_clear: { en: 'Nothing in the words you gave matched a policy this screen knows.', es: 'Nada de lo que me diste coincide con una política que esta revisión conozca.' },
    p_look: { en: '{n} thing to look at before you upload.', es: '{n} cosa que mirar antes de subir.' },
    p_look_many: { en: '{n} things to look at before you upload.', es: '{n} cosas que mirar antes de subir.' },
    p_block: { en: 'A hard rule fired. Rewrite that part before you upload.', es: 'Saltó una regla dura. Reescribe esa parte antes de subir.' },
    m_head: { en: '{niche} at {views} views a video pays about {one} a video, {eight} a month at 8 videos.', es: '{niche} a {views} vistas por video paga unos {one} por video, {eight} al mes con 8 videos.' },
    m_cost: { en: 'At {cost} a video it pays back at {views} views.', es: 'Con un costo de {cost} por video se paga a las {views} vistas.' },
    e_mine: { en: 'I do not know your channel yet. Open YouTube Studio, or tell me: my channel is, then your handle.', es: 'Aún no conozco tu canal. Abre YouTube Studio, o dime: mi canal es, y tu usuario.' },
    e_read: { en: 'YouTube did not return the uploads of {q}.', es: 'YouTube no devolvió los videos de {q}.' },
    saved: { en: 'Saved. {name} is your channel from now on.', es: 'Guardado. {name} es tu canal a partir de ahora.' },
    forgot: { en: 'Done. I no longer remember your channel.', es: 'Hecho. Ya no recuerdo tu canal.' }
  };

  var POS = {
    top: { en: 'in the top tenth', es: 'en la décima parte de arriba' },
    alto: { en: 'in the top quarter', es: 'en el cuarto de arriba' },
    medio: { en: 'at or above the median', es: 'en la mediana o por encima' },
    bajo: { en: 'below the median', es: 'por debajo de la mediana' },
    fondo: { en: 'in the bottom quarter', es: 'en el cuarto de abajo' }
  };

  var POS_LABEL = { top: 'Top tenth', alto: 'Top quarter', medio: 'At or above the median', bajo: 'Below the median', fondo: 'Bottom quarter' };

  var MEDIUM = {
    'Historia': 'painterly cinematic illustration with realistic proportions',
    'Religion e Historia': 'painterly cinematic illustration with realistic proportions',
    'Misterio Oscuro': 'cinematic photograph, low key, film grain',
    'Ciencia': 'photoreal 3D render',
    'Naturaleza': 'wildlife photograph, telephoto compression',
    'Sleep y Relax': 'soft painterly illustration',
    'Finanzas': 'clean studio photograph',
    'IA y Tecnologia': 'photoreal 3D render',
    'Geografia': 'satellite and map illustration, photoreal',
    'Gaming': 'stylised 3D render, saturated',
    'Infantil': 'stylised 3D render, toy-like surfaces'
  };

  var PHONE = { w: 168, h: 94 };

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
    return {
      I: mod('NSP_INTEL'), F: mod('NSP_RIVAL_FORMULA'), E: mod('NSP_RIVAL_EXPEDIENTE'), C: mod('NSP_CADENCIA'), T: mod('NSP_RPM_TABLA'),
      J: mod('NSP_TITULOS'), S: mod('NSP_TITULOS_SENALES'), K: mod('NspMiniaturaCohorte'), M: mod('NspMiniaturaMercado'), A: mod('NspAreas'),
      R: mod('NspDineroRpm'), Q: mod('NspDineroEquilibrio'), X: mod('NspDineroRiesgo'), V: mod('NSP_VEREDICTO')
    };
  }

  function I() { return engines().I; }

  function num(n) { n = Number(n); return isFinite(n) ? n : 0; }

  function compact(n) { var x = I(); return x ? x.compact(n) : String(Math.round(num(n))); }

  function mult(n) { var x = I(); return x ? x.mult(n) : (Math.round(num(n) * 10) / 10) + 'x'; }

  function multOf(n) { return num(n) > 0 && num(n) < 0.1 ? 'under 0.1x' : mult(n); }

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n - 1).replace(/\s+\S*$/, '');
    return (cut || s.slice(0, n - 1)) + '\u2026';
  }

  function median(list) {
    var s = (list || []).filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  function quantile(list, q) {
    var s = (list || []).filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
  }

  function viewsOf(v) {
    var n = Number(v && (v.viewsNum != null ? v.viewsNum : v.views));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function usd(x) {
    x = num(x);
    if (x >= 1000) return '$' + Math.round(x).toLocaleString('en-US');
    return '$' + (Math.round(x * 100) / 100).toFixed(2);
  }

  function usdSpoken(x, lang) {
    x = Math.round(num(x));
    var t = x >= 1000 ? x.toLocaleString(langOf(lang) === 'es' ? 'es-ES' : 'en-US') : String(x);
    return fill('dollars', lang, { n: t });
  }

  function spokenNum(n, lang) { var x = I(); return x ? x.spokenNum(n, lang) : String(Math.round(num(n))); }

  function spokenViews(n, lang) { var x = I(); return x ? x.spokenViews(n, lang) : String(Math.round(num(n))); }

  function spokenMult(n, lang) {
    var x = num(n);
    var t = x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10);
    if (langOf(lang) === 'es') t = t.replace('.', ',');
    return fill('times', lang, { n: t });
  }

  function listJoin(items, lang) {
    items = items.filter(Boolean);
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + fill('and', lang) + items[items.length - 1];
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

  function stamp(now) {
    var x = I();
    if (x && x.stamp) return x.stamp(now);
    return new Date(Number(now) || Date.now()).toISOString().slice(0, 10);
  }

  function speakable(t, n) {
    var s = String(t || '').replace(/\s+[|\u2013]\s+.*$/, '').replace(/\s+-\s+.*$/, '').replace(/["\u201c\u201d\u2026]/g, '').replace(/\s+/g, ' ').trim();
    n = n || 80;
    if (s.length <= n) return s;
    return s.slice(0, n).replace(/\s+\S*$/, '');
  }

  function low(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function norm(t) {
    return low(t).replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function words(t) {
    var x = I();
    if (x && x.contentWords) return x.contentWords(t);
    return norm(t).split(' ').filter(function (w) { return w.length >= 4 && !/^\d+$/.test(w); });
  }

  function head(ch, videos, extra) {
    ch = ch || {};
    var bits = [];
    if (ch.handle) bits.push(ch.handle);
    if (typeof ch.subs === 'number' && ch.subs > 0 && I()) bits.push(I().compactSubs(ch.subs) + ' subscribers');
    if (videos) bits.push(videos.length + ' uploads read');
    if (extra) bits.push(extra);
    return { name: clip(ch.name || ch.handle || 'Your channel', 80), handle: ch.handle || '', url: ch.url || '', subs: typeof ch.subs === 'number' ? ch.subs : null, line: bits.join(' \u00b7 ') };
  }

  function sourceLine(videos) {
    return 'Read from the public /videos page of the channel: ' + (videos || []).length + ' uploads, 0 YouTube API quota.';
  }

  function bestOf(videos) {
    var x = I();
    if (x && x.bestOf) return x.bestOf(videos);
    var list = (videos || []).filter(function (v) { return viewsOf(v) > 0; });
    var med = median(list.map(viewsOf));
    var best = null;
    list.forEach(function (v) { if (!best || viewsOf(v) > viewsOf(best)) best = v; });
    var total = list.reduce(function (a, v) { return a + viewsOf(v); }, 0);
    return { median: med, best: best, count: list.length, total: total, share: best && total ? Math.round(viewsOf(best) / total * 100) : null };
  }

  function watch(id) {
    return /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? 'https://www.youtube.com/watch?v=' + id : '';
  }

  function thumbUrl(id, size) {
    return /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? 'https://i.ytimg.com/vi/' + id + '/' + (size || 'mqdefault') + '.jpg' : '';
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function hourLabel(h) { return pad(((h % 24) + 24) % 24) + ':00'; }

  function tzLabel(offsetMin) {
    var east = -num(offsetMin);
    if (!east) return 'UTC';
    var h = Math.floor(Math.abs(east) / 60), m = Math.abs(east) % 60;
    return 'UTC' + (east > 0 ? '+' : '-') + h + (m ? ':' + pad(m) : '');
  }

  function liftsOf(videos) {
    var list = videos || [];
    return list.map(function (v, i) {
      var around = [];
      for (var k = Math.max(0, i - NEIGHBORS); k <= Math.min(list.length - 1, i + NEIGHBORS); k++) {
        if (k !== i && viewsOf(list[k]) > 0) around.push(viewsOf(list[k]));
      }
      var m = median(around);
      return m && viewsOf(v) > 0 ? viewsOf(v) / m : null;
    });
  }

  function slotsOf(videos, offsetMin) {
    var lifts = liftsOf(videos);
    var timed = [];
    (videos || []).forEach(function (v, i) {
      var at = Number(v && v.publishedAt);
      if (!(at > 0) || lifts[i] == null) return;
      var local = new Date(at - num(offsetMin) * 60000);
      timed.push({ hour: local.getUTCHours(), day: local.getUTCDay(), lift: lifts[i], views: viewsOf(v), title: v.title || '' });
    });
    var out = { timed: timed.length, of: (videos || []).length, tz: tzLabel(offsetMin), state: 'few', slots: [], days: [] };
    if (timed.length < TIMED_MIN) return out;
    var hours = {};
    timed.forEach(function (t) { hours[t.hour] = (hours[t.hour] || 0) + 1; });
    var mode = Object.keys(hours).map(Number).sort(function (a, b) { return hours[b] - hours[a] || a - b; })[0];
    out.modeHour = mode;
    out.modeCount = hours[mode];
    var group = function (keyOf, labelOf) {
      var box = {};
      timed.forEach(function (t) { var k = keyOf(t); (box[k] = box[k] || []).push(t.lift); });
      return Object.keys(box).map(function (k) { return { key: Number(k), label: labelOf(Number(k)), n: box[k].length, lift: median(box[k]) }; })
        .sort(function (a, b) { return a.key - b.key; });
    };
    out.slots = group(function (t) { return Math.floor(t.hour / SLOT_HOURS); }, function (k) { return hourLabel(k * SLOT_HOURS) + ' to ' + hourLabel(k * SLOT_HOURS + SLOT_HOURS); });
    out.days = group(function (t) { return t.day; }, function (k) { return DAYS[k]; });
    var busiest = out.slots.slice().sort(function (a, b) { return b.n - a.n || a.key - b.key; })[0];
    out.busiest = busiest || null;
    var pick = function (list) {
      var ok = list.filter(function (s) { return s.n >= SLOT_MIN; }).sort(function (a, b) { return b.lift - a.lift; });
      if (!ok.length) return { state: 'spread' };
      if (ok.length === 1) return ok[0].n >= timed.length * HABIT ? { state: 'one', best: ok[0] } : { state: 'spread', best: ok[0] };
      if (ok[0].lift / Math.max(0.01, ok[1].lift) < STANDS_OUT) return { state: 'flat', best: ok[0], next: ok[1] };
      return { state: 'best', best: ok[0], next: ok[1] };
    };
    out.hour = pick(out.slots);
    out.day = pick(out.days);
    out.state = out.hour.state;
    return out;
  }

  function channelWords(videos) {
    var df = {};
    var n = 0;
    (videos || []).forEach(function (v) {
      if (!v || !v.title) return;
      n++;
      words(v.title).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
    });
    return { df: df, n: n };
  }

  var WEAK = /^(?:propio|propios|propia|propias|habia|habian|hizo|hicieron|tenia|tenian|dijo|dijeron|queria|estaba|estaban|fueron|siendo|mismo|misma|mismos|otra|otro|otros|otras|cosa|cosas|nadie|nunca|todo|toda|todos|todas|aquel|aquella|luego|solo|sola|tras|despues|antes|ahora|entonces|pero|porque|while|would|could|should|their|there|these|those|every|thing|things|something|nothing|really|actually|became|become|never|always|about|after|before|other|became|made|makes|making|gets|got|went|goes|says|said|years|year|dias|anos)$/;

  function distinct(title, cw) {
    return words(title).filter(function (w) { return !WEAK.test(w) && (!cw.n || (cw.df[w] || 0) / cw.n < 0.5); });
  }

  function topicOf(title, cw, n) {
    var list = distinct(title, cw);
    list.sort(function (a, b) { return (cw.df[a] || 0) - (cw.df[b] || 0) || b.length - a.length; });
    var keep = list.slice(0, n || 2);
    return words(title).filter(function (w) { return keep.indexOf(w) >= 0; });
  }

  function matches(text, topic) {
    if (!topic.length) return false;
    var have = ' ' + norm(text) + ' ';
    var hit = 0;
    topic.forEach(function (w) { if (have.indexOf(' ' + w + ' ') >= 0) hit++; });
    return topic.length <= 2 ? hit === topic.length : hit >= 2;
  }

  function hoursAgo(text, now) {
    var t = String(text || '').toLowerCase();
    var m = /(\d+)\s*(minut|hora|hour|d[ií]a|day|semana|week|mes|month|a[nñ]o|year)/.exec(t);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    var u = m[2];
    if (/^minut/.test(u)) return Math.max(1, n / 60);
    if (/^(?:hora|hour)/.test(u)) return n;
    if (/^(?:d[ií]a|day)/.test(u)) return n * 24;
    if (/^(?:semana|week)/.test(u)) return n * 168;
    if (/^(?:mes|month)/.test(u)) return n * 720;
    return n * 8760;
  }

  function signalsFor(topic, sig, label, now) {
    sig = sig || {};
    now = Number(now) || Date.now();
    var out = [];
    var corpus = Array.isArray(sig.corpus) ? sig.corpus : [];
    var recent = corpus.filter(function (r) { return r && r.t && Number(r.v) > 0 && now - Number(r.ts || 0) <= RECENT_DAYS * DAY_MS; });
    if (!corpus.length) {
      out.push({ id: 'corpus', label: 'Your scans, last 14 days', measured: false, value: 'No scans stored in this browser yet', rising: false });
    } else if (recent.length < 10) {
      out.push({ id: 'corpus', label: 'Your scans, last 14 days', measured: false, value: 'Only ' + recent.length + ' videos scanned in the last 14 days, too few for a baseline', rising: false });
    } else {
      var hit = recent.filter(function (r) { return matches(r.t, topic); });
      var base = median(recent.map(function (r) { return Number(r.v); }));
      var mv = median(hit.map(function (r) { return Number(r.v); }));
      var ratio = hit.length && base ? mv / base : 0;
      out.push({
        id: 'corpus', label: 'Your scans, last 14 days', measured: true, n: hit.length, of: recent.length, ratio: ratio,
        rising: hit.length >= SIGNAL_MIN && ratio >= RISING,
        value: hit.length ? hit.length + ' of ' + recent.length + ' scanned videos match, median ' + compact(mv) + ' views an hour, ' + mult(ratio) + ' the median of all' : 'None of the ' + recent.length + ' videos scanned matches this topic',
        best: hit.sort(function (a, b) { return Number(b.v) - Number(a.v); }).slice(0, 2).map(function (r) { return { title: r.t, vph: Number(r.v) }; })
      });
    }
    var ix = sig.index && sig.index.niches && typeof sig.index.niches === 'object' ? sig.index.niches : null;
    if (!ix) {
      out.push({ id: 'index', label: 'Scan history of the niche', measured: false, value: 'No scan history in this browser yet', rising: false });
    } else {
      var lab = low(label || '');
      var readings = [];
      Object.keys(ix).forEach(function (k) {
        var e = ix[k] || {};
        var named = lab && (low(e.n || k) === lab || low(k) === lab);
        if (!named && !matches(String(e.n || k) + ' ' + String(e.best || ''), topic)) return;
        (Array.isArray(e.hist) ? e.hist : []).forEach(function (h) { if (h && Number(h.ts) > 0 && Number(h.v) >= 0) readings.push({ ts: Number(h.ts), v: Number(h.v) }); });
      });
      readings.sort(function (a, b) { return a.ts - b.ts; });
      var spanDays = readings.length ? (readings[readings.length - 1].ts - readings[0].ts) / DAY_MS : 0;
      if (readings.length < 6 || spanDays < 1) {
        out.push({ id: 'index', label: 'Scan history of the niche', measured: false, value: readings.length ? readings.length + ' readings over ' + Math.max(0, Math.round(spanDays)) + ' days, too few for a trend' : 'No scan recorded this niche or topic', rising: false });
      } else {
        var third = Math.max(2, Math.floor(readings.length / 3));
        var early = median(readings.slice(0, third).map(function (r) { return r.v; }));
        var late = median(readings.slice(-third).map(function (r) { return r.v; }));
        var tr = early > 0 ? late / early : 0;
        out.push({ id: 'index', label: 'Scan history of the niche', measured: true, n: readings.length, ratio: tr, rising: tr >= TREND,
          value: 'Latest views an hour ' + compact(late) + ' against ' + compact(early) + ' at the start, ' + readings.length + ' readings over ' + Math.round(spanDays) + ' days' });
      }
    }
    var feed = Array.isArray(sig.feed) ? sig.feed : [];
    var fresh = feed.map(function (v) {
      var h = hoursAgo(v.publishedText, now);
      var views = Number(v.viewsNum) || 0;
      return h != null && h <= FEED_DAYS * 24 && views > 0 ? { title: v.title, vph: views / Math.max(1, h) } : null;
    }).filter(Boolean);
    if (!feed.length) {
      out.push({ id: 'feed', label: 'Country feed, last 7 days', measured: false, value: 'The country feed was not opened in this browser yet', rising: false });
    } else if (fresh.length < 10) {
      out.push({ id: 'feed', label: 'Country feed, last 7 days', measured: false, value: 'Only ' + fresh.length + ' uploads of the last 7 days in the stored feed', rising: false });
    } else {
      var fh = fresh.filter(function (v) { return matches(v.title, topic); });
      var fb = median(fresh.map(function (v) { return v.vph; }));
      var fm = median(fh.map(function (v) { return v.vph; }));
      var fr = fh.length && fb ? fm / fb : 0;
      out.push({ id: 'feed', label: 'Country feed, last 7 days', measured: true, n: fh.length, of: fresh.length, ratio: fr, rising: fh.length >= SIGNAL_MIN && fr >= RISING,
        value: fh.length ? fh.length + ' of ' + fresh.length + ' fresh uploads match, median ' + compact(fm) + ' views an hour, ' + mult(fr) + ' the feed median' : 'None of the ' + fresh.length + ' fresh uploads matches this topic' });
    }
    var stats = sig.stats && typeof sig.stats === 'object' ? sig.stats : null;
    var st = null;
    if (stats) Object.keys(stats).forEach(function (k) { if (!st && (low(k) === low(label || '') || matches(k, topic))) st = { key: k, v: stats[k] || {} }; });
    if (!st) {
      out.push({ id: 'rpm', label: 'RPM trend of the niche', measured: false, value: stats ? 'The scanner has no RPM history for this niche' : 'No niche RPM history in this browser yet', rising: false });
    } else {
      var hist = Array.isArray(st.v.rpmHistory) ? st.v.rpmHistory : [];
      out.push({ id: 'rpm', label: 'RPM trend of the niche', measured: hist.length >= 2, rising: st.v.trend === 'up' && hist.length >= 2,
        value: 'Trend ' + String(st.v.trend || 'new') + ' over ' + hist.length + ' readings, average $' + num(st.v.avgRpm).toFixed(2) + ' (the scanner\'s estimate, not a measurement)' });
    }
    return out;
  }

  function nicheVote(videos) {
    var x = engines();
    var list = (videos || []).filter(function (v) { return v && v.title; });
    if (!x.T || !x.E || typeof x.E.votar !== 'function' || !list.length) return null;
    var v = x.E.votar(list);
    if (!v) return null;
    var mel = 0;
    list.forEach(function (it) { if (x.J && x.J.esMelodrama && x.J.esMelodrama(it.title)) mel++; });
    return { n: v.n, label: v.label, name: v.name, count: v.count, rpm: v.rpm, mixed: v.mixed, melodrama: mel, second: v.second ? { name: v.second.name, count: v.second.count } : null };
  }

  function wrapped(input, lang) {
    input = input || {};
    var x = engines();
    var videos = input.videos || [];
    var h = head(input.channel, videos);
    var name = clip(h.name, 40);
    var b = bestOf(videos);
    var slots = slotsOf(videos, input.offsetMin);
    var f = x.F ? x.F.medir(videos) : { ok: false, razon: 'The title engine is not loaded.' };
    var tpl = x.I && x.I.templateOf ? x.I.templateOf(videos) : { ok: false, note: 'The title template engine is not loaded.' };
    var niche = x.E ? x.E.nichoDe(videos) : { ok: false, razon: 'The niche table is not loaded.' };
    var say = [];
    var bm = b.best && b.median ? viewsOf(b.best) / b.median : 0;
    if (!b.median) say.push(fill('w_none', lang, { name: name }));
    else if (bm >= LEANS) say.push(fill('w_best', lang, { name: name, views: spokenViews(viewsOf(b.best), lang), mult: spokenMult(bm, lang) }));
    else say.push(fill('w_flat', lang, { name: name, median: spokenViews(b.median, lang) }));
    var when = '';
    if (slots.hour && slots.hour.state === 'best') {
      when = slots.hour.best.label + (slots.day && slots.day.state === 'best' ? ', ' + slots.day.best.label : '');
      say.push(fill('w_hour', lang, { when: hourLabel(slots.hour.best.key * SLOT_HOURS) + fill('to', lang) + hourLabel(slots.hour.best.key * SLOT_HOURS + SLOT_HOURS), lift: spokenMult(slots.hour.best.lift, lang) }));
    } else if (slots.state === 'one') say.push(fill('w_hour_one', lang, { from: hourLabel(slots.hour.best.key * SLOT_HOURS), to: hourLabel(slots.hour.best.key * SLOT_HOURS + SLOT_HOURS), n: slots.hour.best.n, timed: slots.timed }));
    else if (slots.state === 'spread') say.push(fill('w_hour_spread', lang));
    else if (slots.state === 'flat') say.push(fill('w_hour_flat', lang));
    else say.push(fill('w_hour_few', lang));
    var up = f.ok && !f.plano ? (f.suben || []) : [];
    if (up.length && x.I && x.I.titleTraits) {
      var tt = x.I.titleTraits(f, lang);
      if (tt.say) say.push(tt.say);
    }

    var realSay = realNiche(nicheVote(videos), niche);
    if (realSay.ok && !realSay.mixed) say.push(fill('w_niche', lang, { niche: realSay.name }));
    var sections = [];
    var best = { id: 'best', title: 'Your best video', rows: [] };
    if (b.best && b.median) {
      best.rows.push({ label: 'Title', value: '"' + clip(b.best.title, 110) + '"', link: watch(b.best.videoId) });
      best.rows.push({ label: 'Views', value: compact(viewsOf(b.best)) + ', ' + mult(bm) + ' your median of ' + compact(b.median), tone: bm >= OUTLIER ? 'good' : 'plain' });
      best.rows.push({ label: 'Share of all views read', value: b.share + '% of ' + compact(b.total) + ' over ' + b.count + ' uploads', tone: b.share >= 50 ? 'bad' : 'plain' });
      best.images = [{ src: thumbUrl(b.best.videoId), link: watch(b.best.videoId) }].filter(function (im) { return im.src; });
    } else {
      best.rows.push({ label: 'Best video', value: 'No view counts came back', tone: 'muted' });
    }
    sections.push(best);

    var titles = { id: 'formula', title: 'Your own title formula', rows: [] };
    if (tpl.ok) titles.rows.push({ label: 'Skeleton', value: tpl.plantilla, mono: true, note: tpl.note });
    else titles.rows.push({ label: 'Skeleton', value: 'None repeated', tone: 'muted', note: tpl.note || '' });
    if (up.length) up.slice(0, 3).forEach(function (t) { titles.rows.push({ label: 'Winners use', value: t.etiqueta + ', ' + t.enGana + '/' + t.deGana + ' of your top titles against ' + t.enPierde + '/' + t.dePierde + ' of the bottom', tag: t.fuerza === 'probado' ? 'PROVEN' : 'LEANS', tone: t.fuerza === 'probado' ? 'good' : 'plain' }); });
    else titles.rows.push({ label: 'Winning traits', value: f.ok && f.plano ? 'Your best and worst titles barely differ, so the title is not your formula' : 'No title trait separates your winners', tone: 'muted' });
    titles.note = f.razon || '';
    sections.push(titles);

    var time = { id: 'time', title: 'When you publish', rows: [] };
    if (slots.state === 'few') {
      time.rows.push({ label: 'Best hour', value: 'Not measured: ' + slots.timed + ' of ' + slots.of + ' uploads carry an exact time, ' + TIMED_MIN + ' are needed', tone: 'muted' });
    } else {
      if (slots.busiest) time.rows.push({ label: 'Most uploads go out', value: slots.busiest.label + ' (' + slots.busiest.n + ' of ' + slots.timed + ')', tone: slots.state === 'spread' ? 'muted' : 'plain', note: slots.state === 'spread' ? 'Spread across the day: no window holds ' + SLOT_MIN + ' uploads, or the one that does holds under ' + Math.round(HABIT * 100) + '% of them.' : '' });
      slots.slots.forEach(function (s) {
        var top = slots.hour.best && s.key === slots.hour.best.key && slots.hour.state === 'best';
        time.rows.push({ label: s.label, value: s.n + ' uploads, ' + mult(s.lift) + ' their neighbors' + (s.n < SLOT_MIN ? ', too few to count' : ''), tag: top ? 'BEST' : '', tone: top ? 'good' : (s.n < SLOT_MIN ? 'muted' : 'plain') });
      });
      if (slots.day && slots.day.state === 'best') time.rows.push({ label: 'Best day', value: slots.day.best.label + ', ' + mult(slots.day.best.lift) + ' its neighbors over ' + slots.day.best.n + ' uploads', tone: 'good' });
      else if (slots.day && slots.day.best) time.rows.push({ label: 'Best day', value: slots.day.state === 'one' ? 'Most uploads go out on ' + slots.day.best.label + ', ' + slots.day.best.n + ' of ' + slots.timed + ', so there is no other day to compare' : 'No day stands out', tone: 'muted' });
    }
    time.note = 'Times in ' + slots.tz + ', from the exact publish time YouTube gives for ' + slots.timed + ' of the ' + slots.of + ' uploads. Each upload is compared with the ' + (NEIGHBORS * 2) + ' uploaded around it, so older videos do not win just for being older. A window needs ' + SLOT_MIN + ' uploads to count.';
    sections.push(time);

    var vote = nicheVote(videos);
    var real = realNiche(vote, niche);
    var nic = { id: 'niche', title: 'Your real niche', rows: [] };
    if (real.ok) {
      nic.rows.push({ label: 'Niche, title by title', value: real.mixed ? 'Mixed: no niche of the table holds a third of your titles. Closest: ' + real.name + ' in ' + real.count + ' of ' + real.n + (vote.second ? ', ' + vote.second.name + ' in ' + vote.second.count : '') : real.name + ' in ' + real.count + ' of ' + real.n + ' titles' + (vote.second ? ', then ' + vote.second.name + ' in ' + vote.second.count : ''), tone: real.mixed ? 'muted' : 'plain', tag: real.mixed ? 'MIXED' : '' });
      if (vote.melodrama * 3 >= vote.n) nic.rows.push({ label: 'Story format', value: 'Family and ranch melodrama with a hinge in ' + vote.melodrama + ' of ' + vote.n + ' titles', tone: 'plain' });
      if (!real.mixed) nic.rows.push({ label: 'Reference RPM', value: '$' + num(real.rpm).toFixed(2) + ' per 1,000 views for ' + real.name, tag: 'ESTIMATE' });
      else nic.rows.push({ label: 'Reference RPM', value: 'Not given: a mixed niche has no single rate in the table', tone: 'muted' });
      nic.note = 'Each title is placed in the niche table on its own and the niche that most titles land in wins. The RPM is the table\u2019s estimate, never the real RPM of your channel.';
    } else {
      nic.rows.push({ label: 'Niche', value: niche.ok ? 'No niche of the table matched your titles' : 'Not measured', tone: 'muted' });
      nic.note = niche.ok ? niche.dice : niche.razon;
    }
    sections.push(nic);

    var honest = [];
    honest.push(videos.length + ' uploads read');
    if (b.median) honest.push('median ' + compact(b.median) + ' views');
    if (b.best) honest.push('best ' + compact(viewsOf(b.best)));
    honest.push(slots.timed + ' with an exact time');
    honest.push('0 API quota');
    sections.push({ id: 'numbers', title: 'The honest numbers', rows: [{ label: 'Measured', value: honest.join(', ') }, { label: 'Not measured', value: 'Click-through rate, retention and revenue live only in YouTube Studio', tone: 'muted' }] });

    var hero = b.best && b.median && bm >= LEANS ? { value: mult(bm), label: 'your best video over your own median of ' + compact(b.median) + ' views' } : { value: b.median ? compact(b.median) : 'n/a', label: b.median ? 'median views, your uploads run close together' : 'no view counts read' };
    var lead = say.join(' ');
    var card = {
      v: 1, kind: 'wrapped', label: 'WRAPPED', lang: langOf(lang), at: Number(input.now) || Date.now(), count: videos.length,
      say: sayOf(say, SAY_WORDS), channel: h, hero: hero, leadBase: lead, lead: lead, sections: sections,
      next: nextChips('wrapped', h),
      source: sourceLine(videos) + (input.from === 'studio' ? ' Channel detected from your open YouTube Studio tab.' : (input.from === 'saved' ? ' Your saved channel.' : '')),
      model: {
        channel: h.name, handle: h.handle, uploadsRead: videos.length, median: b.median,
        best: b.best ? { title: b.best.title, views: viewsOf(b.best), overMedian: Math.round(bm * 10) / 10 } : null,
        template: tpl.ok ? tpl.plantilla : 'none', winnerTraits: up.map(function (t) { return t.etiqueta + ' (' + t.fuerza + ')'; }),
        publishing: slots.state === 'few' ? 'not measured, ' + slots.timed + ' exact times' : { busiestWindow: slots.busiest ? slots.busiest.label + ', ' + slots.busiest.n + ' of ' + slots.timed : 'none', best: slots.hour.state === 'best' ? slots.hour.best.label + ' at ' + mult(slots.hour.best.lift) : slots.hour.state, bestDay: slots.day && slots.day.state === 'best' ? slots.day.best.label : 'none', timeZone: slots.tz },
        niche: realSay.ok ? realSay.name + (realSay.mixed ? ' (mixed)' : '') : 'unknown', referenceRpm: realSay.ok ? realSay.rpm : null
      }
    };
    var rows = [];
    if (slots.hour && slots.hour.state === 'best') rows.push({ label: 'Best window', value: when });
    else if (slots.state === 'one') rows.push({ label: 'Publishes', value: slots.hour.best.label + ' ' + slots.tz + ', ' + slots.hour.best.n + ' of ' + slots.timed });
    rows.push({ label: 'Title formula', value: tpl.ok ? tpl.plantilla : (up.length ? up[0].etiqueta : 'free-form') });
    if (realSay.ok) rows.push({ label: 'Real niche', value: realSay.mixed ? 'mixed' : realSay.name + ', RPM ~$' + num(realSay.rpm).toFixed(2) });
    if (b.median && rows.length < 3) rows.push({ label: 'Median', value: compact(b.median) + ' views over ' + b.count });
    card.share = {
      kind: 'WRAPPED', title: h.name, subtitle: h.line, hero: hero, image: b.best && bm >= LEANS ? thumbUrl(b.best.videoId, 'mqdefault') : '',
      quote: b.best ? { label: 'Your best video', text: b.best.title } : null,
      rows: rows.slice(0, 3),
      foot: 'Measured from ' + videos.length + ' public uploads \u00b7 ' + stamp(card.at)
    };
    card.share.post = clip(b.best && b.median && bm >= LEANS ? 'My YouTube channel, wrapped: my best video did ' + mult(bm) + ' my median of ' + compact(b.median) + ' views.' : 'My YouTube channel, wrapped: ' + (b.median ? 'my uploads run close together, near ' + compact(b.median) + ' views each.' : 'no view counts yet.'), 200) + ' Measured from public data with ZERACK, open source.';
    return card;
  }

  function realNiche(vote, niche) {
    if (!vote || !vote.label) return { ok: false };
    return { ok: true, name: vote.name, label: vote.label, count: vote.count, n: vote.n, rpm: vote.rpm != null ? vote.rpm : (niche && niche.ok ? niche.rpm : 0), mixed: vote.mixed === true };
  }

  function nextChips(kind, h) {
    var out = [];
    if (kind !== 'wrapped') out.push({ label: 'My Wrapped', text: 'My Wrapped' });
    if (kind !== 'next') out.push({ label: 'My next video', text: 'What is my next video?' });
    if (kind !== 'title') out.push({ label: 'Judge a title', text: 'Judge this title: ', fill: true });
    if (kind !== 'money') out.push({ label: 'What it pays', text: 'Money calculator' });
    return out.slice(0, 4);
  }

  function capsStyle(videos) {
    var list = (videos || []).map(function (v) { return String(v.title || ''); }).filter(Boolean);
    if (!list.length) return false;
    var caps = list.filter(function (t) {
      var letters = t.replace(/[^A-Za-z\u00C0-\u024F]/g, '');
      var up = t.replace(/[^A-Z\u00C0-\u00DE]/g, '');
      return letters.length > 6 && up.length / letters.length > 0.6;
    }).length;
    return caps / list.length >= 0.6;
  }

  function titleCase(words, caps) {
    var t = words.join(' ');
    if (caps) return t.toUpperCase();
    return t.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  var PHRASE_MAX = 7;
  var PHRASE_STOP = /^(?:the|a|an|to|of|in|on|at|and|or|for|with|from|by|is|was|it|its|this|that|what|how|why|when|who|el|la|los|las|lo|de|del|y|e|o|en|un|una|al|a|que|por|para|con|es|fue|se|su|sus)$/;

  function phraseOf(title, keep) {
    var tokens = String(title || '').replace(/\s+[|\u2013\u2014]\s+.*$/, '').split(/\s+/).filter(Boolean);
    var hits = [];
    tokens.forEach(function (t, i) { var k = norm(t); if (k && keep.indexOf(k) >= 0) hits.push(i); });
    if (!hits.length) return '';
    var a = hits[0], b = hits[hits.length - 1];
    if (b - a + 1 > PHRASE_MAX) {
      var best = null;
      hits.forEach(function (h) {
        var n = hits.filter(function (x) { return x >= h && x < h + PHRASE_MAX; }).length;
        if (!best || n > best.n) best = { a: h, n: n };
      });
      a = best.a;
      b = hits.filter(function (x) { return x >= a && x < a + PHRASE_MAX; }).pop();
    }
    if (a > 0 && /^[A-Z\u00c0-\u00de]/.test(tokens[a - 1]) && norm(tokens[a - 1]).length <= 3 && !PHRASE_STOP.test(norm(tokens[a - 1]))) a--;
    return tokens.slice(a, b + 1).join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  }

  function fromTemplate(tpl, topic, caps) {
    if (!tpl || !tpl.ok || !topic || !topic.length) return '';
    var out = String(tpl.plantilla || '');
    var filled = false;
    out = out.replace(/\{topic\}/, function () { filled = true; return typeof topic === 'string' ? (caps ? topic.toUpperCase() : topic) : titleCase(topic, caps); });
    (tpl.huecos || []).forEach(function (h) {
      var first = (h.valores || [])[0];
      out = out.split('{' + h.nombre + '}').join(first != null ? String(first) : '');
    });
    out = out.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
    return filled ? out : '';
  }

  function nextVideo(input, lang) {
    input = input || {};
    var x = engines();
    var videos = input.videos || [];
    var h = head(input.channel, videos);
    var name = clip(h.name, 40);
    var b = bestOf(videos);
    var cw = channelWords(videos);
    var niche = x.E ? x.E.nichoDe(videos) : { ok: false };
    var label = niche.ok ? niche.nicho : '';
    var scored = videos.filter(function (v) { return viewsOf(v) > 0 && b.median; }).map(function (v) { return { v: v, lift: viewsOf(v) / b.median }; }).sort(function (a, c) { return c.lift - a.lift; });
    var outliers = scored.filter(function (s) { return s.lift >= OUTLIER; }).slice(0, 5);
    var leans = false;
    if (!outliers.length) { outliers = scored.filter(function (s) { return s.lift >= LEANS; }).slice(0, 3); leans = outliers.length > 0; }
    var say = [];
    var sections = [];
    var card = {
      v: 1, kind: 'next', label: 'NEXT VIDEO', lang: langOf(lang), at: Number(input.now) || Date.now(), count: videos.length,
      channel: h, sections: sections, next: nextChips('next', h), source: sourceLine(videos)
    };
    var ol = { id: 'outliers', title: 'Your outliers', rows: [] };
    if (!outliers.length) {
      say.push(fill('n_flat', lang, { name: name, x: spokenMult(LEANS, lang) }));
      ol.rows.push({ label: 'Outliers', value: b.median ? 'None: your best upload is ' + mult(scored.length ? scored[0].lift : 0) + ' your median of ' + compact(b.median) : 'No view counts came back', tone: 'muted' });
      sections.push(ol);
      card.hero = { value: 'NO OUTLIER', label: 'nothing beats your median by ' + LEANS + 'x yet', word: true, tone: 'muted' };
      card.lead = card.leadBase = say.join(' ');
      card.say = sayOf(say, SAY_WORDS);
      card.model = { channel: h.name, outliers: 0, median: b.median, reason: 'no upload beats the median by ' + LEANS + 'x' };
      return card;
    }
    outliers.forEach(function (o) {
      ol.rows.push({ label: mult(o.lift) + ' the median', value: '"' + clip(o.v.title, 100) + '", ' + compact(viewsOf(o.v)) + ' views', link: watch(o.v.videoId), tone: o.lift >= OUTLIER ? 'good' : 'plain' });
    });
    ol.note = (leans ? 'No upload reaches ' + OUTLIER + 'x your median, so these lean rather than stand out. ' : '') + 'Your median is ' + compact(b.median) + ' views over the ' + b.count + ' uploads read.';
    sections.push(ol);

    var cands = [];
    outliers.forEach(function (o) {
      var all = distinct(o.v.title, cw);
      if (!all.length) return;
      var same = null;
      cands.forEach(function (c) { if (!same && c.words.some(function (w) { return all.indexOf(w) >= 0; })) same = c; });
      if (same) {
        same.lift += o.lift;
        same.from.push(o);
        var shared = same.words.filter(function (w) { return all.indexOf(w) >= 0; });
        same.words = shared;
        same.topic = shared.slice(0, 3);
        return;
      }
      cands.push({ topic: topicOf(o.v.title, cw, 2), words: all, lift: o.lift, from: [o] });
    });
    cands.forEach(function (c) {
      c.label = c.from.length > 1 ? c.topic : distinct(c.from[0].v.title, cw).slice(0, 4);
      c.phrase = phraseOf(c.from[0].v.title, c.label.length ? c.label : c.topic);
    });
    cands.forEach(function (c) {
      c.signals = signalsFor(c.topic, input.signals, label, input.now);
      c.rising = c.signals.filter(function (s) { return s.rising; });
      c.measured = c.signals.filter(function (s) { return s.measured; }).length;
      c.score = c.lift * (1 + 0.5 * c.rising.length);
    });
    cands.sort(function (a, c) { return c.score - a.score; });
    var pick = cands[0];
    if (!pick) {
      pick = { topic: words(outliers[0].v.title).slice(0, 2), lift: outliers[0].lift, from: [outliers[0]], signals: signalsFor([], input.signals, label, input.now), rising: [], measured: 0 };
    }
    var anchor = pick.from[0];
    var shown = pick.label && pick.label.length ? pick.label : pick.topic;
    var phrase = pick.phrase || phraseOf(anchor.v.title, shown) || titleCase(shown, false);
    var topicText = phrase;
    say.push(fill('n_pick', lang, { topic: topicText, title: speakable(anchor.v.title, 70), mult: spokenMult(anchor.lift, lang) }));
    if (pick.rising.length) say.push(fill('n_rising', lang, { where: listJoin(pick.rising.map(function (s) { return s.label.toLowerCase(); }), lang) }));
    else say.push(fill('n_alone', lang));

    var ev = { id: 'evidence', title: 'Why this topic', rows: [] };
    ev.rows.push({ label: 'Your own numbers', value: pick.from.length + ' outlier' + (pick.from.length > 1 ? 's' : '') + ' on "' + topicText + '", best ' + mult(anchor.lift) + ' your median', tag: 'MEASURED', tone: 'good' });
    pick.signals.forEach(function (s) {
      ev.rows.push({ label: s.label, value: s.value, tag: s.rising ? 'RISING' : (s.measured ? 'MEASURED' : 'NOT AVAILABLE'), tone: s.rising ? 'good' : (s.measured ? 'plain' : 'muted') });
      (s.best || []).forEach(function (r) { ev.rows.push({ label: 'Scanned', value: '"' + clip(r.title, 90) + '", ' + compact(r.vph) + ' views an hour', tone: 'muted' }); });
    });
    ev.note = 'A signal counts as rising when at least ' + SIGNAL_MIN + ' matching videos run at ' + RISING + 'x the median of everything read with them, or the scan history of the niche climbs ' + TREND + 'x. Topic words that appear in half your titles are left out, because they name the channel, not the topic.';
    sections.push(ev);

    if (cands.length > 1) {
      sections.push({ id: 'others', title: 'Other topics considered', rows: cands.slice(1, 4).map(function (c) {
        return { label: '"' + (c.phrase || titleCase(c.label || c.topic, false)) + '"', value: mult(c.lift) + ' your median' + (c.rising.length ? ', rising in ' + c.rising.length + ' signal' + (c.rising.length > 1 ? 's' : '') : ''), tone: 'muted' };
      }) });
    }

    var tpl = x.I && x.I.templateOf ? x.I.templateOf(videos) : { ok: false };
    var caps = capsStyle(videos);
    var built = fromTemplate(tpl, phrase, caps);
    var write = { id: 'write', title: 'Title and hook', rows: [] };
    if (built) write.rows.push({ label: 'Your skeleton, filled with the topic', value: built, mono: false, tone: 'muted', note: 'A slot suggestion from your own titles, not a written title: the writer below writes the real one.' });
    else write.rows.push({ label: 'Your skeleton', value: 'Your titles repeat no skeleton, so there is none to fill', tone: 'muted' });
    write.rows.push({ label: 'Hook', value: 'Waiting for the writer', tone: 'muted', busy: true });
    write.state = 'pending';
    write.note = 'The skeleton comes from your own titles. The hook is written from the evidence above by the AI provider you set up.';
    sections.push(write);
    card.leadCore = say.join(' ');

    card.hero = { value: phrase, label: 'next topic, from ' + (pick.from.length > 1 ? pick.from.length + ' of your outliers' : 'your outlier at ' + mult(anchor.lift)) + (pick.rising.length ? ' and ' + pick.rising.length + ' rising signal' + (pick.rising.length > 1 ? 's' : '') : ''), word: true, tone: 'good' };
    card.lead = card.leadBase = say.join(' ');
    card.say = sayOf(say, SAY_WORDS);
    card.brief = {
      channel: h.name, language: String(input.language || ''), topic: topicText, niche: niche.ok ? niche.nombre : '',
      outliers: pick.from.map(function (o) { return { title: o.v.title, views: viewsOf(o.v), overMedian: Math.round(o.lift * 10) / 10 }; }),
      median: b.median, skeleton: tpl.ok ? tpl.plantilla : '', skeletonTitle: built,
      winnerTraits: (x.F ? (x.F.medir(videos).suben || []) : []).map(function (t) { return t.etiqueta; }),
      rising: pick.rising.map(function (s) { return s.label + ': ' + s.value; }),
      recentTitles: videos.slice(0, 8).map(function (v) { return v.title; })
    };
    card.model = { channel: h.name, topic: topicText, outliers: card.brief.outliers, risingSignals: card.brief.rising, signalsMeasured: pick.measured, titleFromSkeleton: built || 'none', hook: 'pending' };
    card.share = {
      kind: 'NEXT VIDEO', title: h.name, subtitle: h.line, image: thumbUrl(anchor.v.videoId, 'mqdefault'),
      hero: { value: mult(anchor.lift), label: 'my outlier over my median. Next topic: ' + phrase },
      quote: { label: 'Following my outlier', text: anchor.v.title },
      rows: [
        { label: 'My median', value: compact(b.median) + ' views' },
        { label: 'Outliers on the topic', value: String(pick.from.length) },
        { label: 'Rising signals', value: pick.rising.length ? String(pick.rising.length) + ' of ' + pick.signals.length : 'none measured' }
      ],
      foot: 'Measured from ' + videos.length + ' public uploads \u00b7 ' + stamp(card.at)
    };
    card.share.post = clip('My next video, picked from my own outliers: ' + phrase + '.', 200) + ' Measured with ZERACK, open source.';
    return card;
  }

  function withHook(card, got, lang) {
    if (!card || !card.sections) return card;
    var out = JSON.parse(JSON.stringify(card));
    var x = engines();
    for (var i = 0; i < out.sections.length; i++) {
      var s = out.sections[i];
      if (s.id !== 'write') continue;
      s.state = 'done';
      s.rows = s.rows.filter(function (r) { return r.label !== 'Hook'; });
      if (got && got.ok) {
        var j = x.J && got.title ? x.J.puntuar(got.title, { mercado: /^es$/.test(String(out.brief && out.brief.language || '')) ? 'ES' : '' }) : null;
        if (got.title) s.rows.unshift({ label: 'Title', value: got.title, note: j && j.percentil != null ? 'Judge percentile ' + j.percentil + ', ' + j.veredicto.texto.toLowerCase() : '', tone: 'good' });
        s.rows.push({ label: 'Hook', value: got.hook || 'The writer returned no hook', tone: got.hook ? 'plain' : 'muted' });
        s.note = 'Written by ' + (got.by || 'your AI provider') + ' from the evidence above. The skeleton comes from your own titles.';
        if (out.model) { out.model.title = got.title || ''; out.model.hook = got.hook || ''; }
        if (got.title && out.share) out.share.quote = { label: 'Next title', text: got.title };
        if (got.title) {
          out.lead = (out.leadCore || out.leadBase) + ' ' + fill('n_title', lang, { title: speakable(got.title, 90) });
        }
      } else {
        s.rows.push({ label: 'Hook', value: got && got.reason ? got.reason : 'Not written', tone: 'muted' });
        s.note = 'The skeleton comes from your own titles. ' + (got && got.why ? got.why : '');
        if (out.model) out.model.hook = 'not written: ' + (got && got.reason ? got.reason : 'no provider');
      }
    }
    return out;
  }

  function hookPrompt(brief) {
    brief = brief || {};
    var lang = brief.language === 'es' ? 'Spanish' : (brief.language && brief.language !== 'en' ? 'the language code ' + brief.language : 'English');
    return {
      system: 'You write for one YouTube channel. From the evidence the user gives, write the title and the spoken hook of its next video on the topic given. '
        + 'Rules: the title is in ' + lang + ', under 90 characters, follows the channel skeleton when one is given and the winner traits, and names the topic. '
        + 'The hook is the first two or three sentences the narrator says, in ' + lang + ', under 45 words, concrete, it names the topic in the first sentence and makes one promise the video keeps. '
        + 'Never invent a statistic or a date. Answer with JSON only: {"title": "...", "hook": "..."}',
      user: JSON.stringify({ channel: brief.channel, niche: brief.niche, topic: brief.topic, outliersOnThisTopic: brief.outliers, channelMedianViews: brief.median, skeleton: brief.skeleton, titleFromSkeleton: brief.skeletonTitle, winnerTraits: brief.winnerTraits, risingSignals: brief.rising, recentTitles: brief.recentTitles })
    };
  }

  function parseHook(text) {
    var t = String(text || '').trim();
    var m = /\{[\s\S]*\}/.exec(t);
    if (!m) return null;
    try {
      var j = JSON.parse(m[0]);
      var title = String(j.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      var hook = String(j.hook || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      if (!title && !hook) return null;
      return { title: title, hook: hook };
    } catch (e) { return null; }
  }

  function ownScores(title, videos, J) {
    var list = (videos || []).filter(function (v) { return v && v.title; });
    if (!J || !list.length) return null;
    var score = function (p) { return p.motor === 'melodrama' ? p.puntos : p.bruto; };
    var mine = J.puntuar(title, {});
    if (mine.vacio) return null;
    var rows = list.map(function (v) { var p = J.puntuar(v.title, {}); return { v: v, bruto: score(p), motor: p.motor }; }).filter(function (r) { return r.motor === mine.motor; });
    if (!rows.length) return null;
    var below = rows.filter(function (r) { return r.bruto < score(mine); }).length;
    return { bruto: score(mine), below: below, of: rows.length, rows: rows, motor: mine.motor };
  }

  function nearest(title, videos, med) {
    var t = words(title);
    if (!t.length) return [];
    return (videos || []).map(function (v) {
      var w = words(v.title);
      var inter = w.filter(function (x) { return t.indexOf(x) >= 0; });
      var union = {};
      w.concat(t).forEach(function (x) { union[x] = 1; });
      return { v: v, score: inter.length / Math.max(1, Object.keys(union).length), shared: inter };
    }).filter(function (r) { return r.shared.length >= 1 && r.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3).map(function (r) {
      return { title: r.v.title, views: viewsOf(r.v), lift: med ? viewsOf(r.v) / med : null, shared: r.shared, videoId: r.v.videoId };
    });
  }

  function fixedPart(tpl, title) {
    if (!tpl || !tpl.ok) return null;
    var parts = String(tpl.plantilla || '').split('{topic}');
    if (parts.length !== 2) return null;
    var pre = parts[0], post = parts[1];
    if (/\{/.test(pre + post) || (pre + post).replace(/[\s|:\-]/g, '').length < 4) return null;
    var t = String(title);
    var lowT = t.toLowerCase();
    if (post && lowT.slice(-post.length) !== post.toLowerCase()) return null;
    if (pre && lowT.slice(0, pre.length) !== pre.toLowerCase()) return null;
    var head = t.slice(pre.length, t.length - post.length).trim();
    if (!head) return null;
    return { head: head, before: t.slice(0, pre.length), after: t.slice(t.length - post.length), kept: (pre + ' ' + post).replace(/\s+/g, ' ').trim() };
  }

  function titleJudge(input, lang) {
    input = input || {};
    var x = engines();
    var title = String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    var videos = input.videos || [];
    var h = input.channel ? head(input.channel, videos) : { name: 'Title check', handle: '', url: '', line: videos.length ? videos.length + ' of your uploads read' : 'No channel of yours read' };
    var card = { v: 1, kind: 'title', label: 'TITLE JUDGE', lang: langOf(lang), at: Number(input.now) || Date.now(), channel: h, sections: [], next: nextChips('title', h) };
    if (!title || !x.J) {
      card.hero = { value: 'NO TITLE', label: x.J ? 'nothing to judge' : 'the title judge did not load', word: true, tone: 'muted' };
      card.lead = card.leadBase = x.J ? fill('t_empty', lang) : 'The title judge did not load. Reload the extension.';
      card.say = card.lead;
      card.model = { error: card.lead };
      return card;
    }
    var es = x.T && x.T.idiomaDe ? x.T.idiomaDe(title).codigo === 'es' : false;
    var nicheLabel = input.niche || (x.T ? x.T.resolver(title + ' ' + videos.slice(0, 10).map(function (v) { return v.title; }).join(' . '), {}).label : '');
    var p = x.J.puntuar(title, { mercado: es ? 'ES' : '', nicho: nicheLabel });
    var ref = x.J.contraGanadores(title, { nicho: nicheLabel, mercado: es ? 'ES' : '' });
    var fixed = videos.length && x.I && x.I.templateOf ? fixedPart(x.I.templateOf(videos), title) : null;
    var fix = x.J.reescribir(fixed ? fixed.head : title, { mercado: es ? 'ES' : '' });
    if (fix && !fix.vacio && fixed) {
      var cut = fix.cambios.filter(function (c) { return /^Cut the tail/.test(c.que); })[0];
      if (cut) {
        var headWords = fixed.head.split(/\s+/).filter(Boolean);
        var keptN = fix.propuesta.split(/\s+/).filter(Boolean).length;
        var rest = headWords.slice(keptN).join(' ');
        if (fix.cambios.some(function (c) { return /capitals/.test(c.que); })) rest = rest.toUpperCase();
        fix.propuesta = (fix.propuesta + ' ' + rest).trim();
        fix.cambios = fix.cambios.filter(function (c) { return c !== cut; });
      }
      fix.propuesta = fixed.before + fix.propuesta + fixed.after;
      fix.kept = fixed.kept;
    }
    var b = bestOf(videos);
    var own = ownScores(title, videos, x.J);
    var near0 = {};
    var cw0 = channelWords(videos);
    distinct(title, cw0).forEach(function (w) { near0[w] = 1; });
    var winnersSame = function (list) {
      var mine = x.T && x.T.idiomaDe ? x.T.idiomaDe(title).codigo : '';
      return list.filter(function (g) {
        if (mine && x.T.idiomaDe(g.titulo).codigo !== mine) return false;
        return words(g.titulo).some(function (w) { return near0[w]; });
      });
    };
    var near = nearest(title, videos, b.median);
    var f = x.F && videos.length ? x.F.medir(videos) : null;
    var say = [];
    var pc = p.percentil != null ? p.percentil : p.puntos;
    say.push(fill('t_head', lang, { p: pc }));
    if (own) say.push(fill('t_own', lang, { n: own.below, of: own.of }));
    if (ref.hayReferencia) say.push(fill('t_niche', lang, { niche: x.T && x.T.nombreDe ? x.T.nombreDe(nicheLabel) : nicheLabel, pos: (POS[ref.posicion] || POS.medio)[langOf(lang)] }));

    var sec = card.sections;
    var ownSec = { id: 'own', title: 'Against your own titles', rows: [] };
    if (!videos.length) {
      ownSec.rows.push({ label: 'Your titles', value: 'Not read: tell me your channel once (my channel is @handle) or open YouTube Studio', tone: 'muted' });
    } else {
      if (own) ownSec.rows.push({ label: 'Judge score among yours', value: 'Above ' + own.below + ' of your last ' + own.of + ' titles', tone: own.below / own.of >= 0.66 ? 'good' : (own.below / own.of <= 0.33 ? 'bad' : 'plain') });
      if (own && b.median) {
        var winners = own.rows.filter(function (r) { return viewsOf(r.v) >= b.median; });
        var wm = median(winners.map(function (r) { return r.bruto; }));
        if (wm != null) ownSec.rows.push({ label: 'Your above-median titles score', value: 'median ' + wm + ' on the judge, this one ' + own.bruto, tone: own.bruto >= wm ? 'good' : 'plain' });
      }
      if (f && f.ok && !f.plano && (f.suben || []).length) {
        var has = x.F.rasgos(title);
        (f.suben || []).slice(0, 3).forEach(function (t) {
          var on = has.indexOf(t.id) >= 0;
          ownSec.rows.push({ label: 'Your winners use: ' + t.etiqueta, value: on ? 'This title has it' : 'This title does not', tag: t.fuerza === 'probado' ? 'PROVEN' : 'LEANS', tone: on ? 'good' : 'bad' });
        });
        (f.hunden || []).slice(0, 2).forEach(function (t) {
          var on = has.indexOf(t.id) >= 0;
          if (on) ownSec.rows.push({ label: 'Your losers use: ' + t.etiqueta, value: 'This title has it', tag: t.fuerza === 'probado' ? 'PROVEN' : 'LEANS', tone: 'bad' });
        });
      } else if (f) {
        ownSec.rows.push({ label: 'Your winning traits', value: f.ok && f.plano ? 'Your best and worst titles barely differ' : 'No trait separates your winners yet', tone: 'muted' });
      }
      near.forEach(function (n) {
        ownSec.rows.push({ label: 'Closest of yours', value: '"' + clip(n.title, 90) + '", ' + compact(n.views) + ' views' + (n.lift ? ', ' + multOf(n.lift) + ' your median' : ''), link: watch(n.videoId), tone: n.lift != null && n.lift >= OUTLIER ? 'good' : 'muted' });
      });
      ownSec.note = 'The judge was calibrated between channels. Inside one channel it did not beat plain view counts, so this is a side by side with your own titles, not a promise that it beats them.';
    }
    sec.push(ownSec);

    var sig = { id: 'signals', title: 'What the judge sees', rows: [] };
    (p.aFavor || []).slice(0, 4).forEach(function (r) { sig.rows.push({ label: r.etiqueta, value: '+' + r.peso + ', won ' + r.gana + '% of ' + r.duelos + ' duels', tone: 'good' }); });
    (p.enContra || []).slice(0, 4).forEach(function (r) { sig.rows.push({ label: r.etiqueta, value: r.peso + ', won ' + r.gana + '% of ' + r.duelos + ' duels', tone: 'bad' }); });
    if (!sig.rows.length) sig.rows.push({ label: 'Signals', value: 'None of the calibrated signals is present', tone: 'muted' });
    var cal = p.calibracion || {};
    sig.note = 'Calibrated on ' + Number(cal.duelos || 0).toLocaleString('en-US') + ' duels between videos: it calls ' + cal.acierto + '% right' + (cal.baseVistas ? ' against ' + cal.baseVistas + '% for view counts alone' : '') + ' and 50% for chance.' + (p.motor === 'segmento' ? ' Spanish market table.' : (p.motor === 'melodrama' ? ' Ranch melodrama engine.' : ''));
    sec.push(sig);

    var nsec = { id: 'niche', title: 'Against the niche winners', rows: [] };
    var nicheName = x.T && x.T.nombreDe ? x.T.nombreDe(nicheLabel) : nicheLabel;
    if (ref.hayReferencia) {
      nsec.rows.push({ label: 'Niche', value: nicheName + ', ' + ref.referencia.n + ' real titles in the sweeps' });
      nsec.rows.push({ label: 'Where it lands', value: POS_LABEL[ref.posicion] + ': scores ' + ref.bruto + ', niche median ' + ref.referencia.mediana + ', top tenth from ' + ref.referencia.p90, tag: ref.posicion === 'top' || ref.posicion === 'alto' ? 'STRONG' : (ref.posicion === 'fondo' ? 'WEAK' : ''), tone: ref.posicion === 'top' || ref.posicion === 'alto' ? 'good' : (ref.posicion === 'fondo' ? 'bad' : 'plain') });
      var shownWinners = winnersSame(ref.ganadores || []).slice(0, 4);
      shownWinners.forEach(function (g) { nsec.rows.push({ label: 'Real winner, ' + compact(g.vph) + ' views an hour', value: '"' + clip(g.titulo, 100) + '"', tone: 'muted' }); });
      nsec.note = ref.razon + (shownWinners.length < (ref.ganadores || []).length ? ' Winners in another language or on another topic are left out of the examples, not out of the numbers.' : '');
    } else {
      nsec.rows.push({ label: 'Niche', value: p.motor === 'melodrama' ? 'Ranch melodrama: judged by its own engine, which has no niche reference' : (nicheName ? nicheName + ': no reference' : 'Not read'), tone: 'muted' });
      nsec.note = ref.razon || '';
    }
    sec.push(nsec);

    if (fix && !fix.vacio && p.motor !== 'melodrama') {
      if (fix.cambios.length && !fixed) {
        var trimmed = fix.propuesta.replace(/(?:\s+(?:hasta|que|y|de|del|la|el|los|las|a|en|con|sin|por|para|the|and|of|to|a|an|in|on|with|but|until|that|who))+\s*$/i, '');
        if (trimmed !== fix.propuesta) { fix.propuesta = trimmed; fix.cambios.push({ que: 'Dropped the connector left dangling at the end', peso: 0, duelos: 0, gana: 0 }); }
      }
      var rw = { id: 'rewrite', title: 'Rewrite without inventing', rows: [] };
      var pAfter = fix.cambios.length ? x.J.puntuar(fix.propuesta, { mercado: es ? 'ES' : '', nicho: nicheLabel }) : null;
      var afterPc = pAfter ? (pAfter.percentil != null ? pAfter.percentil : pAfter.puntos) : null;
      if (fix.cambios.length && afterPc != null && afterPc <= pc) {
        rw.rows.push({ label: 'Proposal', value: 'Leave it: removing what the table punishes scores P' + afterPc + ', no higher than P' + pc, tone: 'muted' });
      } else if (fix.cambios.length) {
        rw.rows.push({ label: 'Proposal', value: fix.propuesta, note: 'Scores P' + afterPc + ' against P' + pc + ' for yours', tone: 'good' });
        if (fix.kept) rw.rows.push({ label: 'Kept as it is', value: '"' + fix.kept + '", the fixed part of your own skeleton', tone: 'muted' });
        fix.cambios.forEach(function (c) { rw.rows.push({ label: c.que, value: c.duelos ? 'weight ' + c.peso + ', won ' + c.gana + '% of ' + c.duelos + ' duels' : 'so the title does not end mid sentence', tone: 'muted' }); });
        rw.note = 'Only removes or recases what the calibrated table measured. It never adds a word you did not write.';
      } else {
        rw.rows.push({ label: 'Proposal', value: 'Leave it: nothing the table punishes is present', tone: 'muted' });
      }
      sec.push(rw);
    }

    card.hero = { value: 'P' + pc, label: 'percentile on the calibrated judge, ' + String(p.veredicto && p.veredicto.texto || '').toLowerCase(), tone: p.veredicto && p.veredicto.estado === 'weak' ? 'bad' : '' };
    card.channel = Object.assign({}, h, { name: clip(title, 90) });
    if (!input.channel) card.channel.line = videos.length ? videos.length + ' of your uploads read' : 'Judged without your channel';
    else card.channel.line = 'Against ' + h.name + (h.handle ? ' (' + h.handle + ')' : '') + ', ' + videos.length + ' uploads read';
    card.lead = card.leadBase = say.join(' ');
    card.say = sayOf(say, SAY_WORDS);
    card.source = videos.length ? sourceLine(videos) : 'The calibrated title table ships with ZERACK; no page was read.';
    card.model = {
      title: title, percentile: pc, verdict: p.veredicto && p.veredicto.texto, helps: (p.aFavor || []).map(function (r) { return r.etiqueta; }), hurts: (p.enContra || []).map(function (r) { return r.etiqueta; }),
      againstOwn: own ? { above: own.below, of: own.of } : 'channel not read', niche: nicheName, nichePosition: ref.hayReferencia ? POS_LABEL[ref.posicion] : 'no reference',
      rewrite: fix && fix.cambios && fix.cambios.length ? fix.propuesta : 'none needed', calibration: cal.acierto + '% on cross-channel duels, not validated inside one channel'
    };
    card.share = {
      kind: 'TITLE JUDGE', title: input.channel ? h.name : 'Title check', subtitle: nicheName ? 'Niche: ' + nicheName : 'Calibrated title judge', hero: card.hero,
      quote: { label: 'The title', text: title },
      rows: [
        own ? { label: 'Against my own titles', value: 'above ' + own.below + ' of ' + own.of } : null,
        ref.hayReferencia ? { label: 'Against the niche winners', value: POS_LABEL[ref.posicion].toLowerCase() } : null,
        (p.aFavor || [])[0] ? { label: 'Strongest signal', value: clip(p.aFavor[0].etiqueta, 34) } : null,
        (p.enContra || [])[0] ? { label: 'Costs it most', value: clip(p.enContra[0].etiqueta, 34) } : null
      ].filter(Boolean),
      foot: 'Judge calibrated on ' + Number(cal.duelos || 0).toLocaleString('en-US') + ' real duels \u00b7 ' + stamp(card.at)
    };
    card.share.post = clip('My title scored P' + pc + ' on a judge calibrated on real YouTube duels.', 200) + ' Measured with ZERACK, open source.';
    return card;
  }

  var FIXES = {
    contrasteFeed: { en: 'Raise the contrast behind the subject: at phone size yours measures {mine}, the winners\u2019 median {med}.', es: 'Sube el contraste detrás del sujeto: a tamaño de móvil la tuya mide {mine}, la mediana de los ganadores {med}.' },
    retencion: { en: 'Too much fine detail disappears at phone size ({mine} kept against {med}): use fewer, bigger shapes.', es: 'A tamaño de móvil se pierde demasiado detalle fino ({mine} conservado contra {med}): usa menos formas y más grandes.' },
    trazo: { en: 'Your biggest text or shape is {mine} tall at phone size, the winners\u2019 median {med}: make the words bigger or cut them to three.', es: 'Tu texto o forma más grande mide {mine} de alto a tamaño de móvil, la mediana de los ganadores {med}: agranda las palabras o déjalas en tres.' },
    luma: { en: 'It is darker than most winners ({mine} against {med}): lift the exposure on the subject.', es: 'Es más oscura que la mayoría de los ganadores ({mine} contra {med}): sube la exposición del sujeto.' },
    luma_hi: { en: 'It is brighter than most winners ({mine} against {med}): bring the highlights down so the subject pops.', es: 'Es más clara que la mayoría de los ganadores ({mine} contra {med}): baja las luces para que el sujeto resalte.' },
    saturacion: { en: 'The colour is flatter than the winners ({mine} against {med}): saturate the one accent colour.', es: 'El color es más apagado que el de los ganadores ({mine} contra {med}): satura el color de acento.' },
    contraste: { en: 'Overall contrast is low ({mine} against {med}): push the darks darker and the lights lighter.', es: 'El contraste general es bajo ({mine} contra {med}): oscurece los oscuros y aclara los claros.' }
  };

  function fixLine(key, fila, lang) {
    var t = FIXES[key] ? FIXES[key][langOf(lang) === 'es' ? 'es' : 'en'] : '';
    return t.replace('{mine}', fila.valor + fila.sufijo).replace('{med}', fila.mediana + fila.sufijo);
  }

  function fixOf(key, fila) {
    return { key: key, line: fixLine(key, fila, 'en'), es: fixLine(key, fila, 'es') };
  }

  function thumbJudge(input, lang) {
    input = input || {};
    var x = engines();
    var mine = input.mine;
    var cohort = input.cohort || {};
    var measured = (cohort.measured || []).filter(function (m) { return m && m.ok; });
    var h = { name: input.title ? clip(input.title, 90) : 'Your thumbnail', handle: '', url: '', line: input.from || '' };
    var card = { v: 1, kind: 'thumb', label: 'THUMBNAIL', lang: langOf(lang), at: Number(input.now) || Date.now(), channel: h, sections: [], next: [{ label: 'Thumbnail ideas', text: 'Thumbnail ideas for: ' + (input.title || ''), fill: !input.title }, { label: 'Judge a title', text: 'Judge this title: ' + (input.title || ''), fill: !input.title }] };
    var say = [];
    var cmp = x.K && mine && mine.ok ? x.K.comparar(mine, measured) : { ok: false, razon: mine && !mine.ok ? (mine.razon || 'Your thumbnail could not be read.') : 'The cohort engine is not loaded.' };
    var phone = { id: 'phone', title: 'At phone size, next to the niche winners', rows: [], images: [] };
    if (input.preview) phone.images.push({ src: input.preview, label: 'Yours', phone: true, mine: true });
    (cohort.videos || []).slice(0, 7).forEach(function (v) { var src = thumbUrl(v.id); if (src) phone.images.push({ src: src, label: compact(v.vph) + '/h', phone: true, link: watch(v.id) }); });
    phone.note = 'Shown at ' + PHONE.w + ' x ' + PHONE.h + ', the size of a search or suggested row on a phone. ' + (cohort.dice || cohort.razon || '');
    card.sections.push(phone);
    if (!cmp.ok) {
      say.push(fill('th_none', lang));
      card.sections.push({ id: 'measures', title: 'Measured against the winners', rows: [{ label: 'Comparison', value: 'Not measured', tone: 'muted' }], note: cmp.razon + (cohort.ok === false && cohort.razon ? ' ' + cohort.razon : '') });
      card.hero = { value: 'NOT PLACED', label: 'no cohort to place it in', word: true, tone: 'muted' };
      card.lead = card.leadBase = say.join(' ');
      card.say = sayOf(say, SAY_WORDS);
      card.model = { placed: false, reason: cmp.razon };
      card.source = input.source || '';
      return card;
    }
    var byKey = {};
    cmp.filas.forEach(function (f) { byKey[f.clave] = f; });
    var phoneKeys = ['contrasteFeed', 'retencion', 'trazo'];
    var pcts = phoneKeys.map(function (k) { var f = byKey[k]; return f ? Math.round(f.porDebajo / Math.max(1, f.de) * 100) : null; }).filter(function (v) { return v != null; });
    var score = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length) : 0;
    var fixes = [];
    var q = function (key, lo) {
      var vals = measured.map(function (m) {
        var f = x.K.METRICAS.filter(function (mm) { return mm.clave === key; })[0];
        try { return f ? f.saca(m) : null; } catch (e) { return null; }
      }).filter(function (v) { return v != null; });
      return quantile(vals, lo);
    };
    phoneKeys.forEach(function (k) {
      var f = byKey[k];
      if (!f) return;
      var p25 = q(k, 0.25);
      if (p25 != null && f.valor < p25) fixes.push(fixOf(k, f));
    });
    ['luma', 'saturacion', 'contraste'].forEach(function (k) {
      var f = byKey[k];
      if (!f) return;
      var p10 = q(k, 0.1), p90 = q(k, 0.9);
      if (p10 != null && f.valor < p10) fixes.push(fixOf(k, f));
      else if (k === 'luma' && p90 != null && f.valor > p90) fixes.push(fixOf('luma_hi', f));
    });
    var bandsWinners = measured.filter(function (m) { return m.trazo && m.trazo.ok && m.trazo.bandas && m.trazo.bandas.length; }).length;
    var mineBands = mine.trazo && mine.trazo.ok && mine.trazo.bandas ? mine.trazo.bandas.length : 0;
    if (!mineBands && bandsWinners >= Math.ceil(measured.length / 2)) {
      var textFix = { key: 'text', line: fill('th_text', 'en', { n: bandsWinners, of: measured.length }), es: fill('th_text', 'es', { n: bandsWinners, of: measured.length }) };
      fixes = [textFix].concat(fixes.filter(function (f) { return f.key !== 'trazo'; }));
    }
    var comun = x.K.paletaComun(measured);
    var gap = comun.ok && mine.paleta ? x.K.brechaDePaleta(mine.paleta, comun) : null;
    var HUE = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky blue', 'blue', 'violet', 'magenta', 'pink'];
    var HUE_ES = ['rojo', 'naranja', 'amarillo', 'lima', 'verde', 'verde azulado', 'cian', 'celeste', 'azul', 'violeta', 'magenta', 'rosa'];
    var hues = function (lg) { return gap.faltan.map(function (c) { return (lg === 'es' ? HUE_ES : HUE)[c.tono] || ((lg === 'es' ? 'tono ' : 'hue ') + c.tono); }).join(fill('hue_and', lg)); };
    if (gap && gap.ok && gap.faltan.length) fixes.push({ key: 'palette', line: fill(gap.faltan.length > 1 ? 'th_hue_many' : 'th_hue_one', 'en', { hues: hues('en') }), es: fill(gap.faltan.length > 1 ? 'th_hue_many' : 'th_hue_one', 'es', { hues: hues('es') }) });
    (mine.puntuacion && mine.puntuacion.tipoCodigos || []).forEach(function (code, i) {
      if (code !== 'poca_resolucion') return;
      var px = /\(\d+px\)/.exec(String(mine.puntuacion.tips[i] || ''));
      fixes.push({ key: code, line: mine.puntuacion.tips[i], es: fill('th_lowres', 'es', { px: px ? ' ' + px[0] : '' }) });
    });

    say.push(fill('th_head', lang, { pct: score, n: cmp.medidos }));
    if (fixes.length) say.push(fill('th_fix', lang, { fix: langOf(lang) === 'es' && fixes[0].es ? fixes[0].es : fixes[0].line }));

    var ms = { id: 'measures', title: 'Measured against ' + cmp.medidos + ' winners', rows: [] };
    cmp.filas.forEach(function (f) {
      var pct = Math.round(f.porDebajo / Math.max(1, f.de) * 100);
      var isPhone = phoneKeys.indexOf(f.clave) >= 0;
      ms.rows.push({ label: f.etiqueta, value: 'Yours ' + f.valor + f.sufijo + ', winners\u2019 median ' + f.mediana + f.sufijo + ', above ' + f.porDebajo + ' of ' + f.de, tag: isPhone ? (pct <= 25 ? 'LOW' : (pct >= 75 ? 'HIGH' : '')) : '', tone: isPhone ? (pct <= 25 ? 'bad' : (pct >= 50 ? 'good' : 'plain')) : 'plain' });
    });
    ms.rows.push({ label: 'Text or logo bands', value: 'Yours ' + mineBands + ', ' + bandsWinners + ' of ' + measured.length + ' winners carry at least one', tone: 'plain' });
    ms.note = 'The phone read score is the average place of the three phone-size measures (contrast, detail kept, biggest stroke) among the winners.';
    card.sections.push(ms);
    var ch = { id: 'change', title: 'What to change', rows: [] };
    if (fixes.length) fixes.slice(0, 5).forEach(function (fx, i) { ch.rows.push({ label: String(i + 1), value: fx.line, num: true, tone: 'plain' }); });
    else ch.rows.push({ label: 'Nothing', value: 'Every measure sits inside the range of the winners. Test a variant with YouTube\u2019s own thumbnail test.', tone: 'muted' });
    if (gap && gap.ok) ch.note = comun.dice + ' ' + gap.dice;
    card.sections.push(ch);
    card.sections.push({ id: 'honest', title: 'What this is not', rows: [{ label: 'Clicks', value: 'Not a click prediction', tone: 'muted' }], note: x.M && x.M.AVISO ? x.M.AVISO : 'Across same-channel duels no pixel property predicted which thumbnail won.' });
    card.hero = { value: score + '/100', label: 'phone read: reads better at phone size than ' + score + '% of ' + cmp.medidos + ' niche winners', tone: score < 35 ? 'bad' : '' };
    card.lead = card.leadBase = say.join(' ');
    card.say = sayOf(say, SAY_WORDS);
    card.source = input.source || '';
    card.model = { phoneRead: score, winnersMeasured: cmp.medidos, cohort: cohort.dice || '', measures: cmp.filas.map(function (f) { return { measure: f.etiqueta, yours: f.valor, winnersMedian: f.mediana, above: f.porDebajo + ' of ' + f.de }; }), change: fixes.map(function (f) { return f.line; }), note: 'not a click prediction' };
    card.share = {
      kind: 'THUMBNAIL', title: 'My thumbnail, measured', subtitle: input.title ? String(input.title) : 'Placed among the niche winners at phone size', image: input.shareImage || '', hero: { value: score + '/100', label: 'phone read, placed among ' + cmp.medidos + ' niche winners' },
      quote: fixes.length ? { label: 'First change', text: fixes[0].line } : null,
      rows: cmp.filas.filter(function (f) { return phoneKeys.indexOf(f.clave) >= 0; }).map(function (f) { return { label: f.etiqueta.replace(' at feed size', ''), value: f.valor + f.sufijo + ' vs ' + f.mediana + f.sufijo }; }).slice(0, 3),
      foot: 'Measured on ' + cmp.medidos + ' real winners \u00b7 ' + stamp(card.at)
    };
    card.share.post = clip('My thumbnail at phone size: ' + score + '/100 against ' + cmp.medidos + ' winners of its niche.', 200) + ' Measured with ZERACK, open source.';
    return card;
  }

  function hookWords(title) {
    var raw = String(title || '').replace(/["\u201c\u201d]/g, '').trim();
    var hinge = /\b(?:until|but then|that|who|which|hasta que|que|sin saber|cuando|when)\b(.*)$/i.exec(raw);
    var tail = hinge && hinge[1].trim().split(/\s+/).length >= 2 ? hinge[1] : raw;
    var num2 = /\b\d[\d,.]*\s+\S+/.exec(raw);
    var content = words(tail);
    var pick = num2 ? [num2[0]] : content.slice(-3).slice(0, 3);
    if (!pick.length) pick = raw.split(/\s+/).slice(-3);
    var text = pick.join(' ').replace(/[?!.,:;]+$/, '').trim();
    return text.split(/\s+/).slice(0, 4).join(' ').toUpperCase();
  }

  function styleOf(style) {
    style = style || {};
    var hues = (style.hues || []).slice(0, 2);
    var bright = num(style.brightness);
    var key = !bright ? 'mid key' : (bright < 90 ? 'dark, low key' : (bright > 150 ? 'bright, high key' : 'mid key'));
    var text = style.measured ? style.bands / style.measured >= 0.5 : true;
    return { hues: hues, key: key, text: text, measured: style.measured || 0, bands: style.bands || 0, known: !!style.measured };
  }

  function concepts(input, lang) {
    input = input || {};
    var title = String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    var st = styleOf(input.style);
    var label = input.niche || '';
    var medium = MEDIUM[label] || 'cinematic photograph, realistic';
    var Medium = medium.charAt(0).toUpperCase() + medium.slice(1);
    var palette = st.hues.length ? st.hues.join(' and ') + ' as the dominant colours' : 'a near black background with one warm accent colour';
    var hook = hookWords(title);
    var neg = 'Do not draw any text, letters, numbers, logos, watermarks, borders, split screens or collage.';
    var base = 'YouTube thumbnail, 16:9, 1280 x 720. ' + Medium + '. The scene shows: ' + title + '.';
    var list = [
      { id: 'close', name: 'Subject close-up, text on the left', composition: 'The main subject fills the right two thirds in a close-up, its expression or its most telling detail readable at phone size.', free: 'left third', side: 'left' },
      { id: 'wide', name: 'Wide reveal, text on top', composition: 'A wide shot: the subject small against a huge environment that shows the stakes, strong sense of scale, horizon low.', free: 'top band', side: 'top' },
      { id: 'object', name: 'The telling object, text at the bottom', composition: 'An extreme close-up of the single object or place that proves the story, centred, sharp, everything else falling into shadow.', free: 'bottom band', side: 'bottom' }
    ];
    var out = list.map(function (c) {
      var prompt = base + ' ' + c.composition + ' Lighting: one hard light source from the ' + (c.side === 'left' ? 'right' : 'side') + ', ' + st.key + '. Palette: ' + palette + '. Keep the ' + c.free + ' plain and uncluttered for text added later. ' + neg;
      return { id: c.id, name: c.name, composition: c.composition, free: c.free, side: c.side, text: st.text ? hook : '', prompt: prompt };
    });
    var h = { name: clip(title || 'Thumbnail ideas', 90), handle: '', url: '', line: st.known ? 'In your style: ' + st.measured + ' of your thumbnails measured' : 'Your style is unknown: tell me your channel to match it' };
    var say = [fill('g_head', lang, { title: clip(title, 60) })];
    if (input.provider) say.push(fill('g_draw', lang, { provider: input.provider === 'openai' ? 'OpenAI' : 'Gemini' }));
    else say.push(fill('g_nokey', lang));
    var sections = [];
    var styleSec = { id: 'style', title: 'Your style', rows: [] };
    if (st.known) {
      styleSec.rows.push({ label: 'Dominant hues', value: st.hues.length ? st.hues.join(', ') : 'mixed, no hue dominates' });
      styleSec.rows.push({ label: 'Text or logo on', value: st.bands + ' of ' + st.measured + ' thumbnails' + (st.text ? ', so the concepts carry text' : ', so the concepts stay clean') });
      styleSec.rows.push({ label: 'Light', value: st.key });
    } else {
      styleSec.rows.push({ label: 'Style', value: 'Not measured: your channel is not known, so a neutral dark style is used', tone: 'muted' });
    }
    styleSec.note = 'Measured on the most viewed thumbnails of your channel. The niche medium is ' + medium + '.';
    sections.push(styleSec);
    out.forEach(function (c, i) {
      var s = { id: 'concept-' + c.id, title: 'Concept ' + (i + 1) + ': ' + c.name, rows: [], concept: true };
      s.rows.push({ label: 'Composition', value: c.composition, wide: true });
      s.rows.push({ label: 'Text', value: c.text ? '"' + c.text + '" on the ' + c.free : 'No text, like most of your thumbnails' });
      s.rows.push({ label: 'Prompt', value: c.prompt, mono: true, wide: true });
      s.copy = { label: 'Copy prompt', text: c.prompt };
      s.overlay = c.text ? { text: c.text, side: c.side } : null;
      sections.push(s);
    });
    var card = {
      v: 1, kind: 'thumbgen', label: 'THUMBNAIL IDEAS', lang: langOf(lang), at: Number(input.now) || Date.now(), channel: h,
      hero: { value: '3 concepts', label: input.provider ? 'ready to draw with your ' + (input.provider === 'openai' ? 'OpenAI' : 'Gemini') + ' key' : 'prompts only: no image key is set', word: true },
      sections: sections, next: [{ label: 'Judge the title', text: 'Judge this title: ' + title }],
      source: input.provider ? 'Built from the title and your measured style. Nothing is drawn until you press Draw them.' : 'Built from the title and your measured style. Copy a prompt into any image tool you use.',
      model: { title: title, concepts: out.map(function (c) { return { name: c.name, text: c.text, prompt: c.prompt }; }), canDraw: !!input.provider, drawWith: input.provider || 'no image key: a Gemini or OpenAI key in Setup would draw them' }
    };
    if (input.provider) card.draw = { provider: input.provider, label: 'Draw the 3 with ' + (input.provider === 'openai' ? 'OpenAI' : 'Gemini'), cost: 'Uses your ' + (input.provider === 'openai' ? 'OpenAI' : 'Gemini') + ' key: 3 images.', title: title, prompts: out.map(function (c) { return { id: c.id, prompt: c.prompt, text: c.text, side: c.side }; }) };
    else card.keyNeeded = 'A Gemini key with an image model, or an OpenAI key, saved in Setup would draw these. Nothing new is required: the same keys the chat uses.';
    card.lead = card.leadBase = say.join(' ');
    card.say = sayOf(say, SAY_WORDS);
    return card;
  }

  function withDrawn(card, images, note) {
    var out = JSON.parse(JSON.stringify(card));
    var byId = {};
    (images || []).forEach(function (im) { if (im && im.id) byId[im.id] = im; });
    out.sections.forEach(function (s) {
      var id = String(s.id || '').replace(/^concept-/, '');
      if (!s.concept || !byId[id]) return;
      var im = byId[id];
      if (im.src) s.images = [{ src: im.src, overlay: s.overlay || null, big: true, save: 'zerack-thumbnail-' + id + '.png' }];
      else s.rows.push({ label: 'Drawing', value: im.error || 'No image came back', tone: 'bad' });
    });
    out.drawn = { at: Date.now(), note: note || '' };
    delete out.draw;
    out.lead = out.leadBase = 'The three concepts, drawn on your key' + (note ? ' (' + note.replace(/^drawn with /, '') + ')' : '') + '. The words are laid on top here, not drawn by the model, so you can change them.';
    out.source = 'Drawn after you pressed Draw them. Save PNG keeps the words on the image.';
    var ok = (images || []).filter(function (im) { return im && im.src; }).length;
    out.hero = { value: ok + ' drawn', label: note || 'drawn with your key', word: true, tone: ok ? 'good' : 'bad' };
    if (out.model) out.model.drawn = ok;
    return out;
  }

  function shortPolicy(name) {
    var t = String(name || '');
    var m = /guidelines, ([^.]+)\./.exec(t);
    if (m) return m[1];
    m = /^YouTube ([^(]+?)(?: policy| rules)/.exec(t);
    return m ? m[1].trim() : clip(t, 40);
  }

  function policy(input, lang) {
    input = input || {};
    var x = engines();
    var risk = input.risk || { ok: false, porque: 'The policy screen did not run.' };
    var pol = input.pol || null;
    var title = String(input.title || ''), desc = String(input.description || ''), script = String(input.script || '');
    var wc = function (t) { var s = String(t || '').trim(); return s ? s.split(/\s+/).length : 0; };
    var h = { name: title ? clip(title, 90) : 'Check before upload', handle: '', url: '', line: 'Title ' + (title ? title.length + ' characters' : 'empty') + ' \u00b7 description ' + wc(desc) + ' words \u00b7 script ' + wc(script) + ' words' };
    var card = { v: 1, kind: 'policy', label: 'BEFORE UPLOAD', lang: langOf(lang), at: Number(input.now) || Date.now(), channel: h, sections: [], next: [{ label: 'Check another', text: 'Check before upload' }] };
    if (!risk.ok) {
      card.hero = { value: 'NOT CHECKED', label: risk.porque || 'the policy engine did not load', word: true, tone: 'muted' };
      card.lead = card.leadBase = risk.porque || 'The policy engine did not load.';
      card.say = card.lead;
      card.model = { checked: false, reason: card.lead };
      return card;
    }
    var V = x.V || {};
    var word, tone, key;
    if (risk.veredicto === V.NO_SIRVE) { word = 'HARD BLOCK'; tone = 'bad'; key = 'p_block'; }
    else if (risk.veredicto === V.MIRARLO) { word = 'LOOK AT IT'; tone = 'plain'; key = 'p_look'; }
    else { word = 'NO FLAGS'; tone = 'good'; key = 'p_clear'; }
    var hard = pol && pol.detail ? pol.detail.hardBlocks || [] : [];
    var soft = pol && pol.detail ? pol.detail.softFlags || [] : [];
    var finds = (risk.hallazgos || []).length + hard.length + soft.length + (pol && pol.evidence && !pol.evidence.hasText ? 1 : 0) + (pol && pol.similarity && pol.similarity.score >= 60 ? 1 : 0);
    var say = [key === 'p_look' ? fill(finds === 1 ? 'p_look' : 'p_look_many', lang, { n: finds }) : fill(key, lang)];
    var read = { id: 'read', title: 'What was read', rows: [
      { label: 'Title', value: title ? '"' + clip(title, 110) + '"' : 'Empty', tone: title ? 'plain' : 'muted' },
      { label: 'Description', value: desc ? wc(desc) + ' words' : 'Empty', tone: desc ? 'plain' : 'muted' },
      { label: 'Script', value: script ? wc(script) + ' words read' : 'None pasted: nothing of the narration was cleared', tone: script ? 'plain' : 'bad', tag: script ? '' : 'UNAUDITED' }
    ] };
    card.sections.push(read);
    var fl = { id: 'flags', title: 'Flags', rows: [] };
    hard.forEach(function (hb) { fl.rows.push({ label: 'Hard rule, ' + String(hb.rule && hb.rule.scope || '').replace(/^global\./, ''), value: '"' + hb.term + '" in the ' + hb.field, tag: 'HARD', tone: 'bad', note: hb.rule && hb.rule.note ? hb.rule.note : '' }); });
    soft.forEach(function (sf) { fl.rows.push({ label: 'Soft rule, ' + String(sf.rule && sf.rule.scope || '').replace(/^global\./, ''), value: '"' + sf.term + '" in the ' + sf.field, tag: 'SOFT', tone: 'bad', note: sf.rule && sf.rule.note ? sf.rule.note : '' }); });
    (risk.hallazgos || []).forEach(function (f) { fl.rows.push({ label: shortPolicy(f.nombre), value: '"' + f.termino + '" in the ' + f.campo, tag: 'FLAG', tone: 'bad', note: f.nombre }); });
    if (!fl.rows.length) fl.rows.push({ label: 'Flags', value: 'Nothing this screen knows matched', tone: 'good' });
    fl.note = 'A keyword screen over the words you pasted, not YouTube\u2019s classifier: read each flagged passage and decide.';
    card.sections.push(fl);
    if (pol && pol.similarity) {
      var sim = pol.similarity;
      card.sections.push({ id: 'similar', title: 'Similarity to your earlier scripts', rows: [
        sim.nearest && sim.nearest.length ? { label: 'Closest earlier script', value: sim.score + '% similar to "' + clip(sim.nearest[0].title, 80) + '"', tone: sim.score >= 60 ? 'bad' : 'plain' } : { label: 'Earlier scripts', value: 'None saved in this browser, so reuse was not measured', tone: 'muted' }
      ] });
    }
    card.sections.push({ id: 'scope', title: 'Never looked at', rows: (risk.fueraDeAlcance || []).map(function (s, i) { return { label: String(i + 1), value: s.charAt(0).toUpperCase() + s.slice(1), tone: 'muted', num: true }; }).slice(0, 5), note: pol && pol.disclosureReminder ? 'When a voice or an image is synthetic, tick the altered or synthetic content box when you upload.' : '' });
    card.hero = { value: word, label: word === 'HARD BLOCK' ? 'a hard rule fired: rewrite that part, there is no way around it' : (word === 'LOOK AT IT' ? finds + ' thing' + (finds === 1 ? '' : 's') + ' to read before you upload' : 'nothing this screen knows matched, which is not a yes from YouTube'), word: true, tone: tone };
    card.lead = card.leadBase = say.join(' ');
    card.say = sayOf(say, SAY_WORDS);
    card.source = 'Checked in your browser with the policy rules that ship with ZERACK. Nothing you pasted left this computer.';
    card.model = { verdict: word, reasons: (risk.razones || []).slice(0, 8), flags: fl.rows.filter(function (r) { return r.tag; }).map(function (r) { return r.label + ': ' + r.value; }), scriptWords: wc(script) };
    return card;
  }

  function money(input, lang) {
    input = input || {};
    var x = engines();
    var tema = String(input.niche || '').trim();
    var views = num(input.views) > 0 ? num(input.views) : null;
    var shorts = !!input.shorts;
    var h = { name: tema ? clip(tema, 80) : 'Money calculator', handle: '', url: '', line: input.viewsFrom || '' };
    var card = { v: 1, kind: 'money', label: 'WHAT IT PAYS', lang: langOf(lang), at: Number(input.now) || Date.now(), channel: h, sections: [], next: [{ label: 'Another niche', text: 'Money calculator: ', fill: true }] };
    var pv = x.R ? x.R.porVideo({ tema: tema, vistasPorVideo: views, duracionSegundos: input.seconds || null, esShort: shorts, idioma: input.market || '' }) : { ok: false, porque: 'The RPM engine is not loaded.' };
    if (!pv.ok) {
      card.hero = { value: 'NO NUMBER', label: pv.porque, word: true, tone: 'muted' };
      card.lead = card.leadBase = pv.porque;
      card.say = card.lead;
      card.model = { error: pv.porque };
      card.form = moneyForm(input);
      return card;
    }
    var per = pv.usdPorVideo;
    var rows = CADENCES.slice();
    var extra = num(input.perMonth);
    if (extra > 0 && rows.indexOf(extra) < 0) { rows.push(extra); rows.sort(function (a, b) { return a - b; }); }
    var table = { head: ['Videos a month', 'Views a month', 'Revenue a month'], hi: 2, rows: rows.map(function (n) { return [String(n), compact(n * views), usd(n * per)]; }) };
    var own = input.own || null;
    if (own && own.floor && own.ceiling) {
      table.head.push('At your floor');
      table.rows.forEach(function (r, i) { r.push(usd(rows[i] * own.floor / 1000 * pv.rpm)); });
    }
    card.sections.push({ id: 'month', title: 'A month at ' + compact(views) + ' views a video', rows: [], table: table, note: 'Revenue = views / 1,000 x the RPM below, for every video of the month. The views a video gets are yours to measure; the RPM is the table\u2019s.' });
    var rate = { id: 'rate', title: 'The rate', rows: [] };
    pv.cuenta.forEach(function (c) { rate.rows.push({ label: '', value: c, tone: 'muted' }); });
    rate.rows.forEach(function (r) { r.num = true; r.label = ''; });
    rate.rows.unshift({ label: 'RPM', value: '$' + pv.rpm.toFixed(2) + ' per 1,000 views, ' + pv.nombre + (pv.mercado ? ', market ' + pv.mercado : ''), tag: pv.sello, tone: 'plain' });
    rate.note = pv.porque;
    card.sections.push(rate);
    var be = { id: 'breakeven', title: 'Break-even', rows: [] };
    var cost = input.cost != null && input.cost !== '' ? num(input.cost) : null;
    if (cost != null && x.Q) {
      var eq = x.Q.equilibrio({ ingresoPorVideo: per, costePorVideo: cost, costeFijoMes: input.fixed != null ? num(input.fixed) : null, videosPorMes: 8, rpm: pv.rpm });
      if (eq.ok) {
        be.rows.push({ label: 'Margin a video', value: usd(eq.margenPorVideo) + ' (' + usd(per) + ' in, ' + usd(cost) + ' out)', tone: eq.margenPorVideo > 0 ? 'good' : 'bad' });
        if (eq.vistasParaCubrirUnVideo) be.rows.push({ label: 'A video pays itself back at', value: eq.vistasParaCubrirUnVideo.toLocaleString('en-US') + ' views', tone: views >= eq.vistasParaCubrirUnVideo ? 'good' : 'bad' });
        if (eq.videosParaCubrirFijo != null) be.rows.push({ label: 'Videos a month to cover the fixed cost', value: String(eq.videosParaCubrirFijo) });
        if (eq.resultadoMes != null) be.rows.push({ label: 'At 8 videos a month', value: usd(eq.resultadoMes) + ' a month after costs', tone: eq.resultadoMes >= 0 ? 'good' : 'bad' });
        be.note = eq.porque;
      } else {
        be.rows.push({ label: 'Break-even', value: eq.porque, tone: 'muted' });
      }
    } else {
      be.rows.push({ label: 'Views to pay back each $' + PAYBACK_STEP + ' a video costs', value: Math.ceil(PAYBACK_STEP * 1000 / Math.max(0.01, pv.rpm)).toLocaleString('en-US') + ' views' });
      be.rows.push({ label: 'Your cost a video', value: 'Not given: add "cost $40 a video" and the margin and break-even appear', tone: 'muted' });
      be.note = 'An empty cost is not a zero, so no margin is invented.';
    }
    card.sections.push(be);
    var rk = { id: 'risk', title: 'Risk', rows: [] };
    var topic = input.topicRisk;
    if (topic && topic.ok) {
      if ((topic.hallazgos || []).length) topic.hallazgos.forEach(function (f) { rk.rows.push({ label: 'Niche words', value: '"' + f.termino + '" can limit ads: ' + shortPolicy(f.nombre), tag: 'FLAG', tone: 'bad' }); });
      else rk.rows.push({ label: 'Niche words', value: 'No advertiser-friendly flag in the niche words', tone: 'good' });
    }
    rk.rows.push({ label: 'Rate confidence', value: pv.clasificado ? (pv.sinReferenciaDeMercado ? 'Niche known, market has no citable multiplier' : 'Niche and market both in the table') : 'No niche of the table matched, the unclassified rate is used', tone: pv.clasificado && !pv.sinReferenciaDeMercado ? 'plain' : 'bad' });
    if (input.marketFrom) rk.rows.push({ label: 'Market', value: String(pv.mercado || '').toUpperCase() + ', taken from ' + input.marketFrom + ', because the niche words name no language', tone: 'muted' });
    if (own && own.floor && own.ceiling) rk.rows.push({ label: 'Your spread', value: 'Your last ' + (own.used ? own.used + ' mature ' : '') + 'uploads run from ' + compact(own.floor) + ' to ' + compact(own.ceiling) + ' views, so 8 videos a month land between ' + usd(8 * own.floor / 1000 * pv.rpm) + ' and ' + usd(8 * own.ceiling / 1000 * pv.rpm), tone: own.ceiling / Math.max(1, own.floor) > 4 ? 'bad' : 'plain' });
    if (shorts) rk.rows.push({ label: 'Shorts', value: 'Shorts pay a pooled rate far below long videos', tone: 'bad' });
    rk.rows.push({ label: 'Not counted', value: (pv.noEstimamos || []).join(', ') + ': they are never estimated here', tone: 'muted' });
    card.sections.push(rk);
    var say = [fill('m_head', lang, { niche: pv.nombre, views: spokenViews(views, lang), one: usdSpoken(per, lang), eight: usdSpoken(8 * per, lang) })];
    if (cost != null && pv.rpm > 0) say.push(fill('m_cost', lang, { cost: usdSpoken(cost, lang), views: spokenViews(Math.ceil(cost * 1000 / pv.rpm), lang) }));
    card.hero = { value: usd(8 * per), label: 'a month at 8 videos of ' + compact(views) + ' views, ' + pv.sello.toLowerCase() };
    card.channel.name = pv.nombre + (tema && low(tema) !== low(pv.nombre) ? ' (' + clip(tema, 50) + ')' : '');
    card.channel.line = compact(views) + ' views a video' + (input.viewsFrom ? ', ' + input.viewsFrom : '') + (shorts ? ', Shorts' : '');
    card.lead = card.leadBase = say.join(' ');
    card.say = sayOf(say, SAY_WORDS);
    card.source = 'Estimated with the RPM table that ships with ZERACK (niche base x market x length). Your real RPM is only in YouTube Studio.';
    card.model = { niche: pv.nombre, rpm: pv.rpm, stamp: pv.sello, viewsPerVideo: views, perVideo: per, perMonth: rows.map(function (n) { return { videos: n, usd: Math.round(n * per * 100) / 100 }; }), costPerVideo: cost, risks: rk.rows.map(function (r) { return r.label + ': ' + r.value; }) };
    card.share = {
      kind: 'WHAT IT PAYS', title: pv.nombre, subtitle: compact(views) + ' views a video \u00b7 RPM $' + pv.rpm.toFixed(2) + ' (' + pv.sello.toLowerCase() + ')', hero: { value: usd(8 * per), label: 'a month at 8 videos, an estimate' },
      quote: null,
      rows: rows.slice(0, 4).map(function (n) { return { label: n + ' videos a month', value: usd(n * per) }; }),
      foot: 'RPM from the ZERACK niche table \u00b7 ' + stamp(card.at)
    };
    card.share.post = clip(pv.nombre + ' at ' + compact(views) + ' views a video: about ' + usd(8 * per) + ' a month at 8 videos (estimate).', 200) + ' Calculated with ZERACK, open source.';
    return card;
  }

  function moneyForm(input) {
    input = input || {};
    return { op: 'money', submit: 'Calculate', fields: [
      { id: 'niche', label: 'Niche or topic', kind: 'text', value: input.niche || '', placeholder: 'ancient history documentaries', max: 120 },
      { id: 'views', label: 'Views a video', kind: 'number', value: input.views ? String(input.views) : '', placeholder: '20000', max: 12 },
      { id: 'cost', label: 'Cost a video in USD (optional)', kind: 'number', value: input.cost != null ? String(input.cost) : '', placeholder: '40', max: 10 }
    ] };
  }

  function ask(kind, lang, extra) {
    extra = extra || {};
    var card = { v: 1, kind: 'ask', label: 'YOUR CHANNEL', lang: langOf(lang), at: Date.now(), channel: { name: '', handle: '', url: '', line: '' }, sections: [], next: [] };
    if (kind === 'policy') {
      card.label = 'BEFORE UPLOAD';
      card.channel.name = 'Check before upload';
      card.channel.line = 'Paste what you are about to publish';
      card.lead = card.leadBase = 'Paste the title, the description or the script. It is checked in your browser against the policy rules that ship with ZERACK.';
      card.form = { op: 'policy', submit: 'Check it', fields: [
        { id: 'title', label: 'Title', kind: 'text', placeholder: 'The title you will publish', max: 150 },
        { id: 'description', label: 'Description', kind: 'area', rows: 3, placeholder: 'The description', max: 5000 },
        { id: 'script', label: 'Script', kind: 'area', rows: 6, placeholder: 'The narration script', max: 60000 }
      ] };
    } else if (kind === 'thumb') {
      card.label = 'THUMBNAIL';
      card.channel.name = 'Judge a thumbnail';
      card.channel.line = 'Drop the image, choose a file, or open the video in YouTube Studio';
      card.lead = card.leadBase = 'Drop your thumbnail here. It is measured at phone size and placed among the real winners of its niche.';
      card.form = { op: 'thumb', submit: 'Judge it', fields: [
        { id: 'image', label: 'Thumbnail', kind: 'file' },
        { id: 'title', label: 'Video title (sets the niche)', kind: 'text', value: extra.title || '', placeholder: 'The title of the video', max: 150 }
      ] };
    } else if (kind === 'money') {
      card.label = 'WHAT IT PAYS';
      card.channel.name = 'Money calculator';
      card.channel.line = 'Niche, views a video and cost';
      card.lead = card.leadBase = 'Give me the niche and the views a video gets. The rate comes from the RPM table; the views are yours.';
      card.form = moneyForm(extra);
    } else {
      card.channel.name = 'Your channel';
      card.channel.line = 'Studio not open and no channel saved';
      card.lead = card.leadBase = fill('e_mine', lang);
      card.form = { op: 'setmine', submit: 'Save my channel', fields: [{ id: 'ref', label: 'Your channel', kind: 'text', placeholder: '@yourhandle or the channel link', max: 200 }] };
      card.then = extra.then || '';
    }
    card.say = card.lead;
    card.model = { needs: card.form ? card.form.fields.map(function (f) { return f.label; }) : [], hint: card.lead };
    return card;
  }

  function parseAmount(t) {
    var m = /(\d+(?:[.,]\d+)*)\s*(k|m|mil|thousand|million|millones|millon)?\b/.exec(String(t || ''));
    if (!m) return null;
    var raw = m[1];
    var n;
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) n = parseFloat(raw.replace(/[.,]/g, ''));
    else n = parseFloat(raw.replace(',', '.'));
    var u = m[2] || '';
    if (u === 'k' || u === 'mil' || u === 'thousand') n *= 1000;
    else if (u === 'm' || /^mill/.test(u)) n *= 1000000;
    return isFinite(n) ? n : null;
  }

  var MONEY_LEAD = /^(?:money calculator|revenue calculator|income calculator|earnings calculator|calculadora(?: de)? (?:dinero|ingresos|ganancias)|calcula(?:me)? (?:cuanto|lo que) (?:gano|ganaria|paga)|how much (?:can|could|would|will|do|does) (?:i|you|a channel|it|this niche|that niche) (?:make|earn|pay)|how much money (?:can|could|would) (?:i|a channel) make|what (?:does|would|could) (?:the |a )?(.+?) (?:niche |channel )?pay|cuanto (?:gano|ganaria|puedo ganar|se gana|paga|pagaria|dinero (?:gano|da|deja))|que paga el nicho)(?=\s|$)/;
  var VIEWS_RE = /(\d+(?:[.,]\d+)*)\s*(k|m|mil|thousand|million|millones|millon)?\s*(?:de\s+)?(?:views?|vistas?|visitas|reproducciones|visualizaciones)(?:\s*(?:per|a|por|each|cada|al|every)\s*(?:video|v[ií]deo))?/;
  var AMOUNT_RE = /(\d+(?:[.,]\d+)*)\s*(k|mil|thousand|million|millones|millon)\b/;
  var COST_RE = /(?:cost(?:s|ing)?|cuesta|me cuesta|costo|coste|gasto|spend|pay)\s*(?:me\s*)?(?:of\s*|de\s*)?\$?\s*(\d+(?:[.,]\d+)?)\s*(?:\$|usd|dollars?|dolares)?(?:\s*(?:per|a|por|each|cada)\s*(?:video|v[ií]deo))?|\$\s*(\d+(?:[.,]\d+)?)\s*(?:per|a|por|each|cada)\s*(?:video|v[ií]deo)|(\d+(?:[.,]\d+)?)\s*(?:\$|usd|dollars?|dolares)\s*(?:per|a|por|each|cada)\s*(?:video|v[ií]deo)/;
  var PER_MONTH_RE = /(\d+)\s*(?:videos?|v[ií]deos)\s*(?:a|per|al|por|each|cada)\s*(?:month|mes)/;

  function moneyOf(raw) {
    var t = low(raw).replace(/^[\s\u00bf\u00a1?!.,]+/, '').replace(LEAD, '').replace(/\b(?:un|one|a)\s+(millon|million)\b/g, '1 $1').replace(/\bmedio millon\b/g, '500 mil');
    var m = MONEY_LEAD.exec(t);
    if (m && !/calcula|calculator/.test(m[0]) && t.split(' ').length > 18) return null;
    if (!m) return null;
    var explicit = /calcula|calculator/.test(m[0]);
    var viewsM = VIEWS_RE.exec(t);
    var costM = COST_RE.exec(t);
    var perM = PER_MONTH_RE.exec(t);
    var views = viewsM ? parseAmount(viewsM[0]) : null;
    var cost = costM ? parseFloat(String(costM[1] || costM[2] || costM[3]).replace(',', '.')) : null;
    var rest = t.replace(m[0], ' ');
    [viewsM, costM, perM].forEach(function (x) { if (x) rest = rest.replace(x[0], ' '); });
    var loose = viewsM ? null : AMOUNT_RE.exec(rest);
    if (loose) rest = rest.replace(loose[0], ' ');
    rest = rest.replace(/[?!.,:;"\u00bf\u00a1$]+/g, ' ')
      .replace(/\b(?:with|con|of|de|del|the|el|la|los|las|a|at|en|in|on|for|para|por|per|un|una|niche|nicho|channel|canal|videos?|shorts?|month|mes|al|each|cada|and|y|if|si|i|my|mi|make|earn|pay|paga|gano|ganaria|youtube|money|dinero|about|sobre|calculator|calculadora|calcula|how|much|cuanto|would|could|can|does|do|que)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
    var T = engines().T;
    var classified = rest && T ? T.resolver(rest, {}).clasificado : false;
    if (!explicit && !classified) return null;
    return { kind: 'money', niche: rest.slice(0, 120), views: views, cost: cost, perMonth: perM ? Number(perM[1]) : null, shorts: /\bshorts?\b/.test(t) };
  }

  var POLICY_CMD = /^(?:(?:run|do|haz|hazme|make)\s+(?:a\s+|an\s+|una\s+|un\s+)?)?(?:check before upload(?:ing)?|pre.?upload check|demoneti[sz]ation check|monetization check|policy check|advertiser.?friendly check|revis(?:a|ar|ion) antes de subir|chequeo antes de subir|revisa (?:las )?politicas)\b/;
  var POLICY_ASK = /(?:demoneti[sz]\w*|desmoneti[sz]\w*|advertiser.?friendly|apto para anunciantes)/;
  var LEAD = /^(?:(?:hey|oye|ok|okay|hola|zerack|please|por favor|porfa|y|and|so|now|ahora|a ver|pues|bueno)[\s,]+)+/i;
  var NEG = /\b(?:no|nunca|never|dont|don't|not)\b/i;

  function cleanTitle(t) {
    return String(t || '').replace(/^[\s:\-\u2013"\u201c\u201d\u00ab\u00bb'`]+|[\s"\u201c\u201d\u00ab\u00bb'`]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  function refOf(t) {
    var I0 = I();
    if (!I0 || !I0.refsOf) return null;
    var r = I0.refsOf(t).refs;
    return r.length ? r[0] : null;
  }

  function intent(raw) {
    var text = String(raw || '').slice(0, 20000);
    var lead = text.replace(LEAD, '');
    var first = lead.split(/[:\n]/)[0];
    var t = low(first).replace(/^[\s?!\u00bf\u00a1.,]+|[\s?!\u00bf\u00a1.,]+$/g, '').trim();
    var m;
    var es = /[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00bf\u00a1]/.test(first) || /\b(?:mi|mis|miniaturas?|titulo|cuanto|canal|que|este|esta|juzga|revisa|haz|hazme|dame|genera|generame|crea|creame|dibuja|calcula|calculadora|antes|subir|olvida|desmonetiza\w*|proximo|siguiente|para|con|resumen|gano|paga|nicho|vistas|portadas?)\b/.test(t);
    var lang = es ? 'es' : 'en';
    var hit = function (o) { o.lang = lang; return o; };

    m = /^(?:judge|rate|score|grade|check|test|review|juzga(?:me)?|califica|evalua|puntua|revisa|prueba|mide)\s+(?:(?:this|my|the|new|este|mi|el|nuevo|esta)\s+)*(?:video\s+)?(?:title|titulo)\b\s*(?:is|es)?\s*(.*)$/i.exec(low(lead).split('\n')[0]);
    if (m) {
      var tail = lead.replace(/^[^:"\u201c]*?(?:title|t[ií]tulo)\b\s*(?:is|es)?\s*/i, '');
      return hit({ kind: 'title', title: cleanTitle(tail) });
    }
    m = /^(?:is this (?:a good )?title (?:good|ok|any good|strong)|(?:es|esta) (?:bueno|bien) (?:este|mi) titulo|funciona (?:este|mi) titulo|will this title work|title check)\b/.exec(t);
    if (m) {
      var after = lead.indexOf(':') >= 0 ? lead.slice(lead.indexOf(':') + 1) : lead.replace(/^[^?]*\?/, '');
      return hit({ kind: 'title', title: cleanTitle(after) });
    }
    m = /^(?:(?:give me|dame|make me|hazme|crea|creame|create|generate|genera|generame|design|disena|disename|draw|dibuja|dibujame|make|haz)\s+)?(?:(?:a|an|some|one|three|3|una|unas|tres)\s+)?(?:(?:thumbnail|miniatura|portada)\s+(?:ideas?|concepts?)|ideas?\s+(?:de|para)\s+(?:(?:la|una|mi)\s+)?(?:miniaturas?|portadas?)|thumbnails?|miniaturas?|portadas?)\b(.*)$/.exec(t);
    if (m && (/^(?:give me|dame|make me|hazme|crea|creame|create|generate|genera|generame|design|disena|disename|draw|dibuja|dibujame|make|haz)\b/.test(t) || /\b(?:ideas?|concepts?)\b/.test(t))) {
      var restT = m[1].replace(/^\s*(?:(?:for|para|de|about|sobre|del)\s+)?(?:(?:the|my|this|el|mi|este|esta)\s+(?:video|title|titulo)\b\s*)?/, '').trim();
      var gt = '';
      if (lead.indexOf(':') >= 0) gt = lead.slice(lead.indexOf(':') + 1);
      else if (restT) gt = lead.trim().split(/\s+/).slice(-restT.split(' ').length).join(' ');
      return hit({ kind: 'thumbgen', title: cleanTitle(gt) });
    }
    m = /^(?:judge|rate|score|grade|check|test|review|analy[sz]e|juzga|califica|evalua|puntua|revisa|analiza|mide)\s+(?:(?:my|this|the|new|mi|esta|la|el|nueva)\s+)*(?:thumbnail|thumb|miniatura|portada)\b\s*(.*)$/.exec(t);
    if (m) {
      var ref = refOf(lead);
      var imgUrl = /(https:\/\/i\.ytimg\.com\/[^\s"']+)/.exec(lead);
      return hit({ kind: 'thumb', ref: ref, image: imgUrl ? imgUrl[1] : '', title: '' });
    }
    var payload = lead.indexOf(':') >= 0 ? lead.slice(lead.indexOf(':') + 1).trim() : '';
    if (POLICY_CMD.test(t) || (POLICY_ASK.test(t) && payload.length >= 8)) {
      var o = { kind: 'policy', title: '', description: '', script: '' };
      if (payload) {
        if (/\b(?:title|t[ií]tulo)\b/i.test(first) || (payload.length <= 110 && !/\n/.test(payload) && !/[.!?]\s+\S/.test(payload))) o.title = payload.slice(0, 150);
        else if (/\b(?:description|descripci[oó]n)\b/i.test(first)) o.description = payload.slice(0, 5000);
        else o.script = payload.slice(0, 60000);
      }
      return hit(o);
    }
    if (t.split(' ').length > 30) return null;
    if (/^(?:forget|olvida|borra)\s+(?:my|mi)\s+(?:channel|canal)$/.test(t)) return hit({ kind: 'forgetmine' });
    m = /^(?:my channel is|this is my channel|set my channel(?: to| as)?|remember my channel(?: is)?|mi canal es|este es mi canal|guarda mi canal|recuerda mi canal|recuerda que mi canal es)\b\s*(.*)$/.exec(t);
    if (m) {
      var r2 = refOf(lead);
      if (r2) return hit({ kind: 'setmine', who: r2 });
      if (!m[1] || /^(?:this|this one|este|esta|el de la pestana|el que tengo abierto)?$/.test(m[1])) return hit({ kind: 'setmine', who: { tab: true } });
      return null;
    }
    if (NEG.test(t)) return null;
    m = /^(?:(?:show me |give me |make |dame |haz(?:me)? |muestrame |ensename )?(?:my|mi|el|the)\s+(?:channel\s+|canal\s+)?wrapped|wrapped(?:\s+(?:de|of|for|para)\s+(?:my|mi)\s+(?:channel|canal))?|(?:my|mi)\s+(?:channel|canal)\s+wrapped|(?:resumen|recap|summary|balance)\s+(?:de|of)\s+(?:my|mi)\s+(?:channel|canal)|(?:my|mi)\s+(?:channel|canal)\s+(?:in one card|en una tarjeta|resumido))\b\s*(.*)$/.exec(t);
    if (m) {
      var r3 = refOf(lead);
      if (m[1] && !r3 && !/^(?:please|porfa|por favor|now|ahora)?$/.test(m[1])) return null;
      return hit(r3 ? { kind: 'wrapped', who: r3 } : { kind: 'wrapped' });
    }
    if (/^wrapped\b/.test(t) && refOf(lead)) return hit({ kind: 'wrapped', who: refOf(lead) });
    if (/^(?:what(?:'s| is| should be| will be)? my next video(?: be| about)?|what should my next video be(?: about)?|my next video|next video (?:idea|topic)s? for me|what should i (?:make|upload|post|film|do|record) next|what video should i (?:make|do|upload|post) (?:next|now)|que video (?:hago|subo|deberia hacer|deberia subir|me toca)(?: ahora| despues| manana| ahorita)?|(?:cual (?:es|seria|deberia ser) )?mi (?:proximo|siguiente) video|que hago en mi (?:proximo|siguiente) video|dame (?:la )?idea (?:de|para) mi (?:proximo|siguiente) video)$/.test(t)) return hit({ kind: 'next' });
    var money2 = moneyOf(lead);
    if (money2) return hit(money2);
    return null;
  }

  function line(key, lang, vars) { return fill(key, lang, vars); }

  root.NSP_MINE = {
    PHONE: PHONE,
    CADENCES: CADENCES,
    intent: intent,
    moneyOf: moneyOf,
    parseAmount: parseAmount,
    slotsOf: slotsOf,
    liftsOf: liftsOf,
    signalsFor: signalsFor,
    topicOf: topicOf,
    channelWords: channelWords,
    hookWords: hookWords,
    speakable: speakable,
    nicheVote: nicheVote,
    wrapped: wrapped,
    nextVideo: nextVideo,
    withHook: withHook,
    hookPrompt: hookPrompt,
    parseHook: parseHook,
    titleJudge: titleJudge,
    thumbJudge: thumbJudge,
    concepts: concepts,
    withDrawn: withDrawn,
    policy: policy,
    money: money,
    ask: ask,
    use: use,
    line: line
  };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
