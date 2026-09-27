(function (root) {
  'use strict';

  var MAX_WORDS = 40;
  var TITLE_MAX = 100;
  var DESC_MAX = 5000;
  var TAGS_MAX = 500;
  var CHAPTER_MIN = 10;
  var CHAPTERS_MIN = 3;
  var RECENT_DAYS = 30;

  var LEAD = /^(?:(?:hey|oye|ok|okay|hola|zerack|please|por favor|porfa|y|and|so|now|ahora|a ver|pues|bueno|can you|could you|puedes|podrias|quiero que|i want you to|necesito que)[\s,]+)+/;
  var CODE = /\b(?:python|javascript|js|bash|shell|sql|code|codigo|programa|macro|app|bot|scraper|automation|automatizacion|excel)\b/;

  function text(v) { return String(v == null ? '' : v); }
  function norm(t) {
    return text(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9@:\s./_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function clip(t, n) {
    t = text(t).replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026' : t;
  }
  function clock(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }
  function money(x) {
    x = Math.max(0, Number(x) || 0);
    if (x >= 100) return '$' + Math.round(x).toLocaleString('en-US');
    return '$' + x.toFixed(2);
  }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }

  function refs(raw) {
    var I = root.NSP_INTEL;
    if (I && typeof I.refsOf === 'function') return I.refsOf(raw);
    return { refs: [], text: text(raw) };
  }

  var VIDEO_URL = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?\S*?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

  function minutesOf(t) {
    var m = /\b(\d{1,2})\s*(?:-\s*)?(?:min|mins|minute|minutes|minuto|minutos)\b/.exec(t);
    if (m) return Math.max(2, Math.min(20, parseInt(m[1], 10)));
    return 0;
  }

  var SCRIPT_NOUN = '(?:sourced script|researched script|script with sources|script|guion con fuentes|guion documentado|guion investigado|guion citado|guion|libreto)';
  var SCRIPT_VERB = '(?:write|write me|draft|make|make me|create|give me|research and write|escribe|escribeme|escribir|redacta|redactame|hazme|haz|crea|creame|dame|investiga y escribe|prepara|preparame|genera|generame)';
  var SCRIPT_RE = new RegExp('^(?:' + SCRIPT_VERB + '\\s+)?(?:(?:a|an|one|the|un|una|el)\\s+)?(?:(?:\\d{1,2}\\s*(?:-\\s*)?(?:minute|min|minuto|minutos)|sourced|researched|cited|full|youtube|video)\\s+)*' + SCRIPT_NOUN + '(?:\\s+(?:de|of)\\s+\\d{1,2}\\s*(?:minutos|minutes|min))?(?:\\s+(?:sourced|with sources|with citations|con fuentes|citado|documentado|investigado))?(?:\\s+(?:de|of)\\s+\\d{1,2}\\s*(?:minutos|minutes|min))?\\s*(?:about|on|for|sobre|de|del|acerca de|para)\\s+(.+)$');
  var SCRIPT_COLON = /^(?:sourced script|script with sources|guion con fuentes|sourced script about)\s*:?\s*(.+)$/;

  function scriptOf(t, raw) {
    if (CODE.test(t)) return null;
    var m = SCRIPT_RE.exec(t) || SCRIPT_COLON.exec(t);
    if (!m) return null;
    var hasVerb = new RegExp('^' + SCRIPT_VERB + '\\b').test(t);
    var sourced = /\b(?:sourced|researched|cited|sources|citations|fuentes|citado|documentado|investigado)\b/.test(t);
    if (!hasVerb && !sourced) return null;
    var topic = m[1].replace(/\b(?:\d{1,2}\s*(?:-\s*)?(?:minutes?|mins?|minutos?))\b/g, ' ').replace(/\b(?:with sources|con fuentes|please|por favor)\b/g, ' ').replace(/^(?:la|el|los|las|the)\s+(?=\S)/, function (x) { return x; }).replace(/\s+/g, ' ').trim();
    var rawTopic = rawTail(raw, topic);
    if (!topic || topic.split(' ').length > 18 || /^(?:it|this|that|esto|eso|este|esta)$/.test(topic)) return null;
    return { kind: 'script', topic: rawTopic || topic, minutes: minutesOf(t) };
  }

  function rawTail(raw, normTopic) {
    var words = normTopic.split(' ').length;
    var clean = text(raw).replace(/[?!.¿¡]+$/g, '').trim().split(/\s+/);
    var tail = clean.slice(-words).join(' ').replace(/^["'\u201c\u00ab]|["'\u201d\u00bb]$/g, '');
    return norm(tail) === normTopic ? tail : '';
  }

  var SHORTS_WORD = '(?:shorts|short|shots|reels|tiktoks|clips para shorts|clips for shorts|clips cortos|videos cortos|cortos|clips)';
  var SHORTS_A = new RegExp('^(?:find|get|pull|cut|mine|make|give me|show me|saca|sacame|busca|buscame|encuentra|encuentrame|corta|haz|hazme|dame|extrae|extraeme)\\s+(?:the |some |me |los |unos |me los )?(?:best |mejores )?' + SHORTS_WORD + '\\s+(?:in|from|out of|inside|of|de|del|en|dentro de)\\s+(.+)$');
  var SHORTS_B = /^(?:cut|turn|split|corta|convierte|parte|trocea)\s+(.+?)\s+(?:into|in|en)\s+(?:shorts|shots|reels|clips|clips cortos|cortos)$/;
  var SHORTS_C = /^(?:(?:which|what) (?:parts|moments|bits|clips) (?:of|from|in) (.+?) (?:work|would work|make good|are good) (?:as|for) shorts|(?:que|cuales) (?:partes|momentos|trozos) (?:de|del) (.+?) (?:sirven|valen|funcionan) (?:para|como) shorts|shorts miner|minero de shorts|shorts from (.+)|shorts de (.+))$/;

  function videoTarget(tail, raw) {
    var t = text(tail).trim();
    var u = VIDEO_URL.exec(raw);
    if (u) return { video: u[1] };
    if (!t || /^(?:this|this video|the video|that video|it|este|este video|el video|ese video|esto|aqui|here|the one on screen|this one)$/.test(t)) return { tab: true };
    return null;
  }

  function shortsOf(t, raw) {
    var m = SHORTS_A.exec(t);
    if (m) return withTarget(videoTarget(m[1], raw));
    m = SHORTS_B.exec(t);
    if (m) return withTarget(videoTarget(m[1], raw));
    m = SHORTS_C.exec(t);
    if (m) return withTarget(videoTarget(m[1] || m[2] || m[3] || m[4] || '', raw));
    return null;
  }

  function withTarget(target) {
    return target ? { kind: 'shorts', target: target } : null;
  }

  var STUDIO = '(?:youtube studio|youtube estudio|studio|estudio(?: de youtube)?)';
  var STUDIO_FILL = new RegExp('^(?:fill|fill in|fill out|complete|rellena|rellenar|llena|llenar|completa|completar|pon|ponme|escribe)\\s+(?:the |my |los |mis |el |la )?(?:fields |campos |details |datos |detalles |video |package |paquete )?(?:(?:in|on|de|en|del)\\s+)?(?:the |el )?' + STUDIO + '(?:\\s+(?:fields|campos|details|detalles|with the package|con el paquete|now|ya|ahora))?$|^(?:fill|rellena|llena)\\s+(?:the |los )?(?:fields|campos)$|^(?:studio mode|modo studio)$');
  var STUDIO_PACK = new RegExp('^(?:(?:make|build|prepare|create|get|give me|show me|open|haz|hazme|arma|armame|prepara|preparame|crea|creame|dame|abre)\\s+)?(?:the |a |my |el |un |mi )?(?:' + STUDIO + ' package|package for ' + STUDIO + '|upload package|paquete (?:de|para) (?:subida|' + STUDIO + ')|paquete de ' + STUDIO + ')$');

  function studioOf(t) {
    if (STUDIO_FILL.test(t)) return { kind: 'studio_fill' };
    if (STUDIO_PACK.test(t)) return { kind: 'studio_pack' };
    return null;
  }

  var EARN_VERB = '(?:earn|make|makes|earns|bring in|gross|gana|genera|factura|ingresa|cobra)';
  var EARN_A = new RegExp('^(?:how much|how much money|what|cuanto|cuanto dinero|que dinero|cuanta plata|cuanto pasta)\\s+(?:does|do|is|did)?\\s*(.+?)\\s+' + EARN_VERB + '(?:\\s+(?:a month|per month|monthly|al mes|por mes|mensual|from youtube|en youtube|con youtube|with ads|con anuncios))*$');
  var EARN_B = new RegExp('^(?:how much|cuanto|cuanto dinero)\\s+' + EARN_VERB + '\\s+(.+?)(?:\\s+(?:a month|per month|al mes|por mes|en youtube|con youtube))*$');
  var EARN_C = /^(?:(?:estimate|show me|give me|dame|muestrame|calcula|estima)\s+)?(?:the |los |las |el )?(?:revenue|earnings|income|ingresos|ganancias)\s+(?:of|for|de|del)\s+(.+)$/;
  var EARN_SELF = /^(?:this channel|that channel|the channel|this one|this youtuber|this creator|este canal|ese canal|el canal|este youtuber|este creador|este|esto|chref|(?:the channel|el canal|canal)\s+(?:de\s+)?chref)$/;
  var EARN_PERSON = /^(?:he|she|they|him|her|them|el|ella|ellos|ellas|ese|esa|esta|(?:(?:this|that|the|este|ese|esta|esa|el|la)\s+)?(?:guy|girl|man|woman|person|dude|creator|youtuber|tipo|chico|chica|senor|senora|persona|creadora)|this person|esta persona)$/;

  function earnOf(t, r) {
    var m = EARN_A.exec(t) || EARN_B.exec(t) || EARN_C.exec(t);
    if (!m) return null;
    var who = m[1].replace(/^(?:a|al|the|el|la)\s+/, '').trim();
    if (/^(?:i|yo|me|mi|my|we|nosotros|youtube|un youtuber|a youtuber|a channel|un canal|youtubers|creators)\b/.test(who)) return null;
    if (/\b(?:views?|vistas|mil|thousand|million|per 1000|por mil|niche|nicho)\b/.test(who)) return null;
    if (EARN_SELF.test(who)) return { kind: 'earn', who: r.refs.length === 1 && /chref/.test(who) ? r.refs[0] : { tab: true } };
    if (EARN_PERSON.test(who) || EARN_PERSON.test(m[1].trim())) return r.refs.length ? null : { kind: 'earn', who: { tab: true } };
    if (r.refs.length) return null;
    var name = who.replace(/^(?:the channel|el canal|canal|channel)\s+(?:de\s+|of\s+)?/, '').trim();
    if (!name || name.split(' ').length > 5 || /\b(?:my|mi|your|tu|su|his|her)\b/.test(name)) return null;
    return { kind: 'earn', who: { name: name } };
  }

  function saidOf(src) {
    return norm(refs(src).text).replace(LEAD, '').replace(/[.?!]+$/, '').trim().replace(/^(?:hey|oye|zerack)\s+/, '').trim();
  }

  function writeOf(src) {
    var I = root.NSP_INTEL;
    return I && typeof I.writeLang === 'function' ? I.writeLang(src) : { lang: '', text: src };
  }

  function intent(raw) {
    var src = text(raw).slice(0, 600);
    if (!src.trim()) return null;
    var r = refs(src);
    var t = saidOf(src);
    if (!t || t.split(' ').length > MAX_WORDS) return null;
    if (/^(?:what is|what s|whats|que es|que significa|define)\b/.test(t)) return null;
    if (/^(?:no|dont|don t|never|nunca|jamas)\b/.test(t) || /\b(?:dont|don t|no|nunca|never)\s+(?:write|make|fill|escribas|hagas|rellenes|llenes)\b/.test(t)) return null;
    var want = writeOf(src);
    var written = want.lang ? scriptOf(saidOf(want.text), want.text) : null;
    if (written) written.write = want.lang;
    var hit = written || scriptOf(t, src) || shortsOf(t, src) || studioOf(t) || earnOf(t, r);
    if (!hit) return null;
    hit.said = t;
    return hit;
  }

  function daysOf(published) {
    var m = /(\d+)\s*(second|minute|hour|day|week|month|year)/i.exec(text(published));
    if (!m) return null;
    var n = Number(m[1]);
    var unit = m[2].toLowerCase();
    return unit === 'second' ? n / 86400 : unit === 'minute' ? n / 1440 : unit === 'hour' ? n / 24 : unit === 'day' ? n : unit === 'week' ? n * 7 : unit === 'month' ? n * 30.44 : n * 365.25;
  }

  function secondsOf(len) {
    var m = /^(\d+)(?::(\d\d))?(?::(\d\d))?$/.exec(text(len).trim());
    if (!m) return null;
    var parts = [m[1], m[2], m[3]].filter(function (x) { return x != null; }).map(Number);
    var s = 0;
    for (var i = 0; i < parts.length; i++) s = s * 60 + parts[i];
    return parts.length >= 2 ? s : null;
  }

  function median(list) {
    var s = list.filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  var ELINES = {
    lead: '{name} makes about {low} to {high} a month from ads. That is an estimate at {rpm} per 1,000 views for {niche}, not its real RPM.',
    lead_one: '{name} makes about {v} a month from ads. That is an estimate at {rpm} per 1,000 views for {niche}, not its real RPM.',
    none: 'I could not put a number on {name}: {why}',
    why_views: 'its uploads show no view counts I can read.'
  };

  function efill(key, vars) {
    var t = ELINES[key] || '';
    Object.keys(vars || {}).forEach(function (k) { t = t.split('{' + k + '}').join(String(vars[k])); });
    return t;
  }

  function earnings(input) {
    input = input || {};
    var R = root.NspDineroRpm;
    var ch = input.channel || {};
    var videos = (input.videos || []).filter(function (v) { return v && typeof v.viewsNum === 'number' && v.viewsNum >= 0; });
    var stats = input.stats || {};
    var name = clip(ch.name || ch.handle || 'This channel', 60);
    var now = Number(input.now) || Date.now();
    var T = root.NSP_RPM_TABLA;
    var niche = input.niche && input.niche.label ? input.niche : null;
    var voted = niche && T ? videos.filter(function (v) { return T.resolver(v.title, {}).label === niche.label; }) : [];
    var titles = (voted.length ? voted : videos).slice(0, 30).map(function (v) { return v.title; }).join(' . ');
    var lens = videos.map(function (v) { return secondsOf(v.length); });
    var medLen = median(lens) || 0;
    var recent = videos.filter(function (v) { var d = daysOf(v.published); return d != null && d <= RECENT_DAYS; });
    var recentViews = recent.reduce(function (a, v) { return a + v.viewsNum; }, 0);
    var joined = Date.parse(text(stats.joinedDate));
    var months = isFinite(joined) ? Math.max(1, (now - joined) / (30.44 * 86400000)) : null;
    var lifeMonthly = months && stats.totalViews > 0 ? stats.totalViews / months : null;
    var mixed = !!(niche && niche.mixed);
    var blend = null;
    if (mixed && R && T) {
      var groups = {}, order = [];
      videos.slice(0, 30).forEach(function (v) {
        var k = T.resolver(v.title, {}).label;
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(v.title);
      });
      var n = 0, sum = 0, parts = [];
      order.forEach(function (k) {
        var r = R.proyeccion({ tema: groups[k].join(' . '), vistasMes: 1000, duracionSegundos: medLen, idioma: input.language || '' });
        if (!r || !r.ok) return;
        n += groups[k].length;
        sum += groups[k].length * r.rpm;
        parts.push({ name: r.clasificado ? r.nombre : 'unclassified', count: groups[k].length, rpm: r.rpm });
      });
      if (n) {
        parts.sort(function (a, b) { return b.count - a.count; });
        var rate = Math.round(sum / n * 100) / 100;
        blend = { rpm: rate, parts: parts, n: n, nombre: 'a mixed niche' };
      }
    }
    var basis = function (views) {
      if (blend) {
        var usd = Math.round(views / 1000 * blend.rpm * 100) / 100;
        return { ok: true, rpm: blend.rpm, usdMes: usd, nombre: blend.nombre, cuenta: ['No niche of the table holds a third of the titles, so each title is priced at its own niche rate', blend.parts.slice(0, 4).map(function (p) { return p.name + ' in ' + p.count + ' of ' + blend.n + ' at ' + money(p.rpm); }).join(', '), 'Blended rate ' + money(blend.rpm) + ' per 1000 views', Math.round(views) + ' views / 1000 x ' + money(blend.rpm) + ' = ' + money(usd) + ' per month'] };
      }
      return R ? R.proyeccion({ tema: titles || name, vistasMes: views, duracionSegundos: medLen, idioma: input.language || '' }) : null;
    };
    var a = recent.length && recentViews > 0 ? basis(recentViews) : null;
    var b = lifeMonthly ? basis(lifeMonthly) : null;
    var any = (a && a.ok) ? a : ((b && b.ok) ? b : null);
    var sections = [];
    var rows = [];
    if (a && a.ok) rows.push({ label: 'Last ' + RECENT_DAYS + ' days of uploads', value: money(a.usdMes) + ' a month', note: recent.length + ' upload' + (recent.length === 1 ? '' : 's') + ' collected ' + compact(recentViews) + ' views so far. Older videos keep earning and are not in this number, so it is a floor.' });
    else rows.push({ label: 'Last ' + RECENT_DAYS + ' days of uploads', value: 'Not measured', note: recent.length ? 'The uploads show no views yet.' : 'No upload in the last ' + RECENT_DAYS + ' days among the ' + videos.length + ' read.', tone: 'muted' });
    if (b && b.ok) rows.push({ label: 'Lifetime average', value: money(b.usdMes) + ' a month', note: compact(stats.totalViews) + ' total views over ' + Math.round(months) + ' months since it joined, Shorts included, which pay far less.' });
    else rows.push({ label: 'Lifetime average', value: 'Not measured', note: 'The About panel did not give total views and a join date.', tone: 'muted' });
    sections.push({ id: 'range', title: 'Two ways to count the month', rows: rows, note: 'Neither is the channel\'s real revenue, which only its owner sees in YouTube Studio. The first counts only what its new uploads earned so far, the second smooths every view it ever had over its whole life.' });
    if (any) {
      sections.push({ id: 'rate', title: 'The rate used', rows: any.cuenta.map(function (c, i) { return { label: i === 0 ? 'Niche' : (i === any.cuenta.length - 1 ? 'Math' : 'Step'), value: c }; }), note: (blend ? 'Mixed niche: the closest, ' + (niche.name || niche.label) + ', holds only ' + niche.count + ' of ' + niche.n + ' titles, so no single niche rate is used. ' : (niche ? 'Niche decided title by title: ' + niche.count + ' of ' + videos.length + ' uploads read as ' + (niche.name || niche.label) + '. ' : '')) + 'Reference RPM per niche and market from the table in this extension. Sponsors, memberships, merch and Shorts revenue are not in it.' });
    }
    var vals = [a && a.ok ? a.usdMes : null, b && b.ok ? b.usdMes : null].filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; });
    var lead;
    if (!vals.length) lead = efill('none', { name: name, why: efill('why_views') });
    else if (vals.length === 2 && Math.abs(vals[1] - vals[0]) > 0.5) lead = efill('lead', { name: name, low: money(vals[0]), high: money(vals[1]), rpm: money(any.rpm), niche: any.nombre });
    else lead = efill('lead_one', { name: name, v: money(vals[0]), rpm: money(any.rpm), niche: any.nombre });
    var head = [];
    if (ch.handle) head.push(ch.handle);
    if (ch.subs) head.push(compact(ch.subs) + ' subscribers');
    head.push(videos.length + ' uploads read');
    var card = {
      v: 1, kind: 'earn', label: 'EARNINGS', at: now,
      channel: { name: name, url: ch.url || '', line: head.join(' \u00b7 ') },
      hero: vals.length ? { value: vals.length === 2 && Math.abs(vals[1] - vals[0]) > 0.5 ? money(vals[0]) + ' to ' + money(vals[1]) : money(vals[0]), label: 'a month from ads, estimated', tone: 'plain' } : { value: 'Not measured', word: true, label: 'no views to count', tone: 'muted' },
      lead: lead, say: lead,
      sections: sections,
      next: [{ label: 'X-ray it', text: 'X-ray ' + (ch.handle || 'this channel') }, { label: 'Luck or growth?', text: 'Verdict on ' + (ch.handle || 'this channel') }],
      source: 'Read from the channel\'s public /videos and About pages, 0 API quota. ESTIMATE.',
      model: { channel: name, lowUsdMonth: vals[0] != null ? Math.round(vals[0]) : null, highUsdMonth: vals[1] != null ? Math.round(vals[1]) : null, rpmUsed: any ? any.rpm : null, niche: any ? any.nombre : '', recentUploads: recent.length, recentViews: recentViews, lifetimeViews: stats.totalViews || null, monthsActive: months ? Math.round(months) : null, stamp: 'ESTIMATE' }
    };
    if (vals.length) {
      card.share = {
        kind: 'EARNINGS', title: name, subtitle: ch.handle || '',
        hero: { value: card.hero.value, label: 'a month from ads, estimated' },
        rows: [{ label: 'RPM used', value: money(any.rpm) }, { label: 'Niche', value: any.nombre }, { label: 'Uploads read', value: String(videos.length) }],
        foot: 'Estimate from public pages',
        post: clip('How much does ' + name + ' make? About ' + card.hero.value + ' a month from ads, by my estimate.', 200) + ' With ZERACK, open source.'
      };
    }
    return card;
  }

  function parseChapters(raw) {
    var out = [];
    text(raw).split(/\n/).forEach(function (ln) {
      var m = /^\s*(?:\(|\[)?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\)|\])?\s*[-.:)\u2013\u2014]?\s*(.+?)\s*$/.exec(ln);
      if (!m) return;
      var p = m[1].split(':').map(Number);
      var s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
      out.push({ at: s, title: clip(m[2], 90) });
    });
    return out;
  }

  function chapterLines(list) {
    return (list || []).map(function (c) { return clock(c.at) + ' ' + c.title; }).join('\n');
  }

  function tagsOf(raw) {
    var seen = {};
    return text(raw).split(/[,\n]/).map(function (t) { return t.replace(/["<>]/g, '').replace(/\s+/g, ' ').trim(); }).filter(function (t) {
      var k = t.toLowerCase();
      if (!t || seen[k]) return false;
      seen[k] = 1;
      return true;
    }).slice(0, 30);
  }

  function tagChars(tags) {
    return tags.reduce(function (a, t, i) { return a + t.length + (/\s/.test(t) ? 2 : 0) + (i ? 1 : 0); }, 0);
  }

  function stripChapters(desc) {
    return text(desc).split('\n').filter(function (l) { return !/^\s*(?:\(|\[)?(?:\d{1,2}:)?\d{1,2}:\d{2}\b/.test(l) && !/^\s*(?:chapters|cap[i\u00ed]tulos|timestamps|chapitres|kapitel)\s*:?\s*$/i.test(l); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function composeDescription(body, chapters, write) {
    var base = stripChapters(body);
    var block = chapters && chapters.length ? (write === 'es' ? 'Capítulos' : 'Chapters') + '\n' + chapterLines(chapters) : '';
    if (!block) return base;
    var parts = base.split(/\n\n/);
    return [parts[0], block].concat(parts.slice(1)).filter(Boolean).join('\n\n').trim();
  }

  function check(pkg) {
    pkg = pkg || {};
    var problems = [];
    var title = text(pkg.title).replace(/\s+/g, ' ').trim();
    var desc = text(pkg.description).replace(/\r/g, '');
    var tags = Array.isArray(pkg.tags) ? pkg.tags : tagsOf(pkg.tags);
    var chapters = Array.isArray(pkg.chapters) ? pkg.chapters : parseChapters(pkg.chapters);
    if (!title) problems.push('The title is empty.');
    if (title.length > TITLE_MAX) problems.push('The title is ' + title.length + ' characters. YouTube takes ' + TITLE_MAX + '.');
    if (/[<>]/.test(title) || /[<>]/.test(desc)) problems.push('YouTube refuses < and > in the title and the description.');
    if (desc.length > DESC_MAX) problems.push('The description is ' + desc.length + ' characters. YouTube takes ' + DESC_MAX + '.');
    if (tagChars(tags) > TAGS_MAX) problems.push('The tags add up to ' + tagChars(tags) + ' characters. YouTube takes ' + TAGS_MAX + '.');
    if (chapters.length) {
      if (chapters.length < CHAPTERS_MIN) problems.push('YouTube shows chapters only with ' + CHAPTERS_MIN + ' or more. There are ' + chapters.length + '.');
      if (chapters[0].at !== 0) problems.push('The first chapter has to start at 0:00.');
      for (var i = 1; i < chapters.length; i++) {
        if (chapters[i].at - chapters[i - 1].at < CHAPTER_MIN) { problems.push('"' + clip(chapters[i - 1].title, 40) + '" is shorter than ' + CHAPTER_MIN + ' seconds, or the times are out of order.'); break; }
      }
      if (chapters.some(function (c) { return !text(c.title).trim(); })) problems.push('A chapter has no title.');
    }
    return { ok: problems.length === 0, problems: problems, title: title, description: desc, tags: tags, chapters: chapters };
  }

  function wordsKey(s) {
    return text(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
  }

  function alignChapters(chapters, words) {
    if (!Array.isArray(words) || words.length < 50) return { ok: false, chapters: chapters, matched: 0 };
    var keys = words.map(function (w) { return wordsKey(w.w)[0] || ''; });
    var from = 0;
    var matched = 0;
    var out = chapters.map(function (c, i) {
      if (i === 0) return { at: 0, title: c.title, first: c.first };
      var want = wordsKey(c.first).slice(0, 8);
      if (want.length < 3) return { at: c.at, title: c.title, first: c.first, estimated: true };
      var best = -1, bestScore = 0;
      for (var k = from; k < keys.length; k++) {
        if (keys[k] !== want[0]) continue;
        var j = 0;
        for (var q = k; q < Math.min(keys.length, k + want.length + 4) && j < want.length; q++) if (keys[q] === want[j]) j++;
        if (j > bestScore) { bestScore = j; best = k; }
        if (j === want.length) break;
      }
      if (best >= 0 && bestScore >= Math.ceil(want.length * 0.6)) {
        matched++;
        from = best + 1;
        return { at: Math.floor(words[best].t0), title: c.title, first: c.first };
      }
      return { at: c.at, title: c.title, first: c.first, estimated: true };
    });
    return { ok: matched > 0, chapters: out, matched: matched };
  }

  var NAME_PHRASE = /(^|[\s,;:("'])(\p{Lu}[\p{L}'-]+(?:\s+(?:of|de|del|la|the|von|du|y|and)\s+\p{Lu}[\p{L}'-]+|\s+\p{Lu}[\p{L}'-]+|\s+(?:I{1,3}|IV|V|VI{0,3}|IX|X{1,3}I{0,3}))*)/gu;
  var NOT_TAG = /^(?:the|this|that|these|those|but|and|nobody|by|in|on|at|for|when|what|why|how|it|its|el|la|los|las|pero|y|nadie|en|por|para|cuando|como|esto|este|esta|un|una)$/i;

  function namesIn(t) {
    var out = [];
    text(t).split(/(?<=[.?!])\s+/).forEach(function (sent) {
      sent.replace(NAME_PHRASE, function (m, pre, name, at) {
        var words = name.split(/\s+/);
        if (at === 0 && words.length === 1) return m;
        if (NOT_TAG.test(words[0])) words = words.slice(1);
        var n = words.join(' ').trim();
        if (n.length >= 4 && out.indexOf(n.toLowerCase()) < 0) out.push(n.toLowerCase());
        return m;
      });
    });
    return out;
  }

  function packFromScript(script, write) {
    script = script || {};
    var hook = (script.hook || []).map(function (r) { return r.text; }).join(' ');
    var first = hook.split(/(?<=[.?!])\s+/).slice(0, 2).join(' ');
    var chapters = (script.chapters || []).map(function (c) { return { at: c.at, title: c.title, first: c.first }; });
    var sources = (script.sources || []).map(function (s) { return '[' + s.n + '] ' + clip(s.title, 90) + (s.url ? ' ' + s.url : ''); });
    var body = [first, sources.length ? (write === 'es' ? 'Fuentes' : 'Sources') + '\n' + sources.join('\n') : ''].filter(Boolean).join('\n\n');
    var tags = [];
    if (script.topic) tags.push(clip(text(script.topic).replace(/^(?:the|la|el|los|las)\s+/i, ''), 60).toLowerCase());
    namesIn(hook + ' ' + (script.sections || []).map(function (s) { return (s.lines || []).map(function (r) { return r.text; }).join(' '); }).join(' ')).forEach(function (n) { if (tags.indexOf(n) < 0 && tags.length < 12) tags.push(n); });
    var list = tagsOf(tags.join(','));
    while (list.length > 1 && tagChars(list) > 400) list.pop();
    return { title: clip(script.title || script.topic || '', TITLE_MAX), description: body, chapters: chapters, tags: list, write: write || 'en' };
  }

  function formCard(pkg, opts) {
    opts = opts || {};
    var from = opts.from || '';
    var lead = 'Review the package and approve it. ZERACK only writes it into Studio after you press Approve, and it never saves or publishes for you.';
    return {
      v: 1, kind: 'studio', label: 'STUDIO PACKAGE', at: Date.now(),
      channel: { name: clip(pkg.title || 'New upload', 90), line: from ? 'From ' + from : 'Paste or type each field' },
      hero: { value: 'Draft', word: true, label: 'not approved yet', tone: 'plain' },
      lead: lead, say: lead,
      notice: opts.problems && opts.problems.length ? 'Not approved: ' + opts.problems.join(' ') : '',
      form: {
        op: 'studio_approve', submit: 'Approve package',
        fields: [
          { id: 'title', label: 'Title', value: pkg.title || '', max: TITLE_MAX, placeholder: 'Up to 100 characters' },
          { id: 'description', label: 'Description', kind: 'area', rows: 7, value: stripChapters(pkg.description || ''), max: DESC_MAX, placeholder: 'What the video is about, and its sources' },
          { id: 'chapters', label: 'Chapters, one per line', kind: 'area', rows: 6, value: chapterLines(pkg.chapters), max: 2000, placeholder: '0:00 Intro' },
          { id: 'tags', label: 'Tags, separated by commas', value: (pkg.tags || []).join(', '), max: 600, placeholder: 'history, rome' }
        ]
      },
      sections: [{ id: 'rules', title: 'What happens next', rows: [
        { label: 'Fill', value: 'The title, the description with its chapters and the tags go into the video open in YouTube Studio' },
        { label: 'Save', value: 'Only when you press Save on the ZERACK bar in Studio, or Studio\'s own Save' },
        { label: 'Never', value: 'Visibility, monetization, audience and publishing are never touched', tone: 'good' }
      ], note: pkg.chaptersEstimated ? 'Chapter times are estimated from the script at 150 words a minute. When the video in Studio has captions ZERACK can read, they are timed again from them before filling.' : '' }],
      next: [],
      source: 'Nothing leaves this browser until you fill it into Studio.',
      model: { title: pkg.title, chapters: (pkg.chapters || []).length, tags: (pkg.tags || []).length, approved: false }
    };
  }

  function approvedCard(pkg) {
    var chapterRows = (pkg.chapters || []).slice(0, 12).map(function (c) { return { label: clock(c.at), value: c.title }; });
    var lead = 'Package approved. Open the video in YouTube Studio and press Fill in Studio: I write the title, the description with its chapters and the tags. Saving stays with you.';
    return {
      v: 1, kind: 'studio', label: 'STUDIO PACKAGE', at: Date.now(),
      channel: { name: clip(pkg.title, 90), line: 'Approved ' + new Date(pkg.approvedAt || Date.now()).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' },
      hero: { value: 'Approved', word: true, label: 'ready to fill into Studio', tone: 'good' },
      lead: lead, say: lead,
      sections: [
        { id: 'fields', title: 'Fields', rows: [
          { label: 'Title', value: pkg.title, note: pkg.title.length + ' of ' + TITLE_MAX + ' characters' },
          { label: 'Description', value: clip(stripChapters(pkg.description), 220), note: pkg.description.length + ' of ' + DESC_MAX + ' characters, chapters included', wide: true },
          { label: 'Tags', value: (pkg.tags || []).join(', ') || 'None', note: tagChars(pkg.tags || []) + ' of ' + TAGS_MAX + ' characters' }
        ] },
        { id: 'chapters', title: 'Chapters', rows: chapterRows.length ? chapterRows : [{ label: 'Chapters', value: 'None', tone: 'muted' }], note: pkg.chaptersEstimated ? 'Estimated from the script. Timed again from the video\'s captions when Studio\'s video has captions ZERACK can read.' : '' },
        { id: 'never', title: 'The gate', rows: [
          { label: 'Filling', value: 'Title, description and tags of the video open in Studio' },
          { label: 'Saving', value: 'Only on your press: Save on the ZERACK bar, or Studio\'s own button' },
          { label: 'Never touched', value: 'Visibility, monetization, audience, schedule, publish', tone: 'good' }
        ] }
      ],
      actions: [{ label: 'Fill in Studio', job: { op: 'studio_fill' }, primary: true }, { label: 'Edit the package', job: { op: 'studio_edit' } }],
      next: [],
      source: 'Stored only in this browser.',
      model: { title: pkg.title, chapters: (pkg.chapters || []).length, tags: (pkg.tags || []).length, approved: true }
    };
  }

  function filledCard(pkg, report) {
    report = report || {};
    var ok = report.ok === true;
    var rows = [
      { label: 'Title', value: report.title ? 'Filled' : 'Not found on the page', tone: report.title ? 'good' : 'bad' },
      { label: 'Description', value: report.description ? 'Filled, ' + (pkg.chapters || []).length + ' chapters inside' : 'Not found on the page', tone: report.description ? 'good' : 'bad' },
      { label: 'Tags', value: report.tags ? report.tags + ' added' : (pkg.tags && pkg.tags.length ? 'The tag box did not open' : 'None in the package'), tone: report.tags ? 'good' : 'muted' },
      { label: 'Chapter times', value: report.timing === 'captions' ? 'Timed from the video\'s own captions (' + report.matched + ' of ' + ((pkg.chapters || []).length - 1) + ' matched)' : 'Estimated from the script: check them against the video', tone: report.timing === 'captions' ? 'good' : 'plain' },
      { label: 'Saved', value: 'No. Review the fields, then press Save on the ZERACK bar in Studio', tone: 'plain' }
    ];
    var lead = ok ? 'Done: the video in Studio is filled. Nothing is saved: check the fields and press Save on the ZERACK bar.' : 'I could not fill Studio: ' + text(report.error || '');
    return {
      v: 1, kind: 'studio_filled', label: 'STUDIO', at: Date.now(),
      channel: { name: clip(pkg.title, 90), line: report.video ? 'Video ' + report.video : 'YouTube Studio' },
      hero: ok ? { value: 'Filled', word: true, label: 'not saved, your press saves it', tone: 'good' } : { value: 'Not filled', word: true, label: clip(report.error || 'Studio did not answer', 60), tone: 'bad' },
      lead: lead, say: lead,
      sections: ok ? [{ id: 'filled', title: 'What went in', rows: rows, note: 'Visibility, monetization and audience were not touched.' }] : [],
      next: [],
      source: 'Written into the Studio page by ZERACK\'s Studio script, on this computer.',
      model: { filled: ok, report: report }
    };
  }

  root.NSP_CREATE = Object.freeze({
    intent: intent,
    earnings: earnings,
    daysOf: daysOf,
    parseChapters: parseChapters,
    chapterLines: chapterLines,
    composeDescription: composeDescription,
    stripChapters: stripChapters,
    tagsOf: tagsOf,
    tagChars: tagChars,
    check: check,
    alignChapters: alignChapters,
    packFromScript: packFromScript,
    formCard: formCard,
    approvedCard: approvedCard,
    filledCard: filledCard,
    clock: clock,
    LIMITS: { title: TITLE_MAX, description: DESC_MAX, tags: TAGS_MAX, chapterMin: CHAPTER_MIN, chaptersMin: CHAPTERS_MIN }
  });
})(typeof self !== 'undefined' ? self : this);
