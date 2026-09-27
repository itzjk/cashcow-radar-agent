(function (root) {
  'use strict';

  function mod(name) {
    if (root && root[name]) return root[name];
    if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name];
    return null;
  }

  var REPO = 'https://github.com/itzjk/cashcow-radar-agent';
  var MAX_WORDS = 18;
  var NAME_WORDS = 5;
  var IDLE_DAYS = 90;
  var ELLIPSIS = '\u2026';
  var SAY_WORDS = 58;

  var P = {
    million: { en: '{n} million', es: '{n} millones' },
    million_one: { en: '1 million', es: 'un millón' },
    billion: { en: '{n} billion', es: '{n} mil millones' },
    thousand: { en: '{n} thousand', es: '{n} mil' },
    times: { en: '{n} times', es: '{n} veces' },
    and: { en: ' and ', es: ' y ' },
    x_break: { en: '{name}: the floor lifted {salto} at "{title}", upload {pos} of the {total} read.', es: '{name}: el piso subió {salto} en "{title}", el video {pos} de los {total} leídos.' },
    x_median: { en: 'The median went from {before} to {after} views.', es: 'La mediana pasó de {before} a {after} vistas.' },
    x_lean: { en: '{name}: no clear turning point. The best lift is {salto}, under the 3 times that makes a break.', es: '{name}: no hay un quiebre claro. La mayor subida es de {salto}, por debajo de las 3 veces que marcan un quiebre.' },
    x_flat: { en: '{name}: no turning point. It has always run near {median} views.', es: '{name}: no hay punto de quiebre. Siempre ha rondado {median} vistas.' },
    x_short: { en: '{name}: only {n} uploads came back, too few to find a turning point.', es: '{name}: solo volvieron {n} videos, muy pocos para encontrar un quiebre.' },
    x_focus: { en: 'This video has {views} views, {mult} the channel median.', es: 'Este video tiene {views} vistas, {mult} la mediana del canal.' },
    x_best: { en: 'Its best video has {views} views, {mult} its median.', es: 'Su mejor video tiene {views} vistas, {mult} su mediana.' },
    f_proven: { en: 'Winning titles use {traits}, proven against the losers.', es: 'Los títulos ganadores usan {traits}, probado contra los perdedores.' },
    f_leans: { en: 'Winning titles lean on {traits}, but nothing is proven yet.', es: 'Los títulos ganadores tiran a {traits}, pero nada está probado.' },
    f_flat: { en: 'Its best and worst titles are only {brecha} apart, so the title is not the formula.', es: 'Sus mejores y peores títulos solo se separan {brecha}, así que la fórmula no está en el título.' },
    f_none: { en: 'No title trait separates its winners from its losers.', es: 'Ningún rasgo del título separa a sus ganadores de sus perdedores.' },
    r_keep: { en: 'AI can rebuild this format.', es: 'Este formato se puede rehacer con IA.' },
    r_drop: { en: 'It needs a camera on site, so AI cannot rebuild it.', es: 'Necesita una cámara en el lugar, así que la IA no puede rehacerlo.' },
    r_look: { en: 'The titles do not say whether AI can rebuild it.', es: 'Los títulos no dicen si la IA puede rehacerlo.' },
    w_pending: { en: 'Now I am reading the niche window.', es: 'Ahora leo la ventana del nicho.' },
    w_open: { en: 'The window is open: {lleg} of {jov} channels opened in the last 120 days already {land}.', es: 'La ventana está abierta: {lleg} de {jov} canales abiertos en los últimos 120 días ya {despega}.' },
    w_shut: { en: 'The window looks shut: none of {jov} recent channels land.', es: 'La ventana parece cerrada: ninguno de {jov} canales recientes despega.' },
    w_unclear: { en: 'The window is unclear: {lleg} of {jov} {recent} {land}, too few to call it.', es: 'La ventana no está clara: {despega} {lleg} de {jov} {recent}, muy pocos para decidir.' },
    w_none: { en: 'No channel in the sample is provably younger than 120 days, so the window stays unmeasured.', es: 'Ningún canal de la muestra es con certeza menor de 120 días, así que la ventana queda sin medir.' },
    w_failed: { en: 'The niche window could not be read.', es: 'No se pudo leer la ventana del nicho.' },
    v_growth: { en: '{name} is real growth, not luck: its last {n} videos run from {floor} to {ceiling} views, a ratio of {ratio}.', es: '{name} es crecimiento real, no suerte: sus últimos {n} videos van de {floor} a {ceiling} vistas, una razón de {ratio}.' },
    v_recent: { en: '{name} found an engine recently: its last {n} videos stay between {floor} and {ceiling} views.', es: '{name} encontró un motor hace poco: sus últimos {n} videos se mantienen entre {floor} y {ceiling} vistas.' },
    v_luck: { en: '{name} looks like one lucky hit: the ceiling is {ratio} its floor, and the best video holds {share} percent of the views read.', es: '{name} parece un golpe de suerte: el techo es {ratio} su piso, y el mejor video concentra el {share} por ciento de las vistas leídas.' },
    v_mid: { en: '{name} needs a look: between an engine and a lucky hit, with the ceiling {ratio} the floor.', es: 'A {name} hay que mirarlo: entre un motor y un golpe de suerte, con el techo {ratio} el piso.' },
    v_none: { en: '{name}: no view counts came back, so there is no verdict.', es: '{name}: no volvieron vistas, así que no hay veredicto.' },
    v_few: { en: '{name}: only {n} {uploads} old enough to judge, and {need} are needed, so there is no verdict yet.', es: '{name}: solo {n} {uploads} edad para juzgar y hacen falta {need}, así que aún no hay veredicto.' },
    v_idle: { en: 'It has not uploaded in {days} days.', es: 'No sube un video desde hace {days} días.' },
    v_copy: { en: 'Worth copying: {label}.', es: 'Para copiar: {label}.' },
    fo_template: { en: 'Its titles repeat one skeleton in {pct} percent of its uploads; the template is on the card.', es: 'Sus títulos repiten un esqueleto en el {pct} por ciento de sus videos; la plantilla está en la tarjeta.' },
    fo_free: { en: 'Its titles share no repeated skeleton.', es: 'Sus títulos no repiten un esqueleto.' },
    fo_length: { en: 'Videos run a median of {min} minutes{cad}.', es: 'Los videos duran una mediana de {min} minutos{cad}.' },
    fo_cad: { en: ', one every {d} days', es: ', uno cada {d} días' },
    fo_cad_one: { en: ', one a day', es: ', uno al día' },
    fo_length_h: { en: 'Videos run a median of {h} hours{cad}.', es: 'Los videos duran una mediana de {h} horas{cad}.' },
    fo_cad_many: { en: ', several a day', es: ', varios al día' },
    fo_thumbs: { en: 'Its thumbnails lean {hues}, with text or a logo in {bands} of {n}.', es: 'Sus miniaturas tiran a {hues}, con texto o logo en {bands} de {n}.' },
    fo_thumbs_plain: { en: 'Its thumbnails carry text or a logo in {bands} of {n}.', es: 'Sus miniaturas llevan texto o logo en {bands} de {n}.' },
    d_head: { en: '{a} against {b}: {wa} axes go to {a}, {wb} to {b}, {tie} are close.', es: '{a} contra {b}: {wa} ejes para {a}, {wb} para {b} y {tie} parejos.' },
    d_leads: { en: '{who} leads on {axes}.', es: '{who} gana en {axes}.' },
    d_niche: { en: 'Careful, the titles read as two different niches.', es: 'Ojo, los títulos parecen de dos nichos distintos.' },
    d_none: { en: 'Nothing measured separates them.', es: 'Nada de lo medido los separa.' },
    e_no_channel: { en: 'Open a YouTube channel or video first, or name the channel.', es: 'Abre primero un canal o un video de YouTube, o dime el canal.' },
    e_no_second: { en: 'Name the second channel, for example: compare this channel with @kurzgesagt.', es: 'Dime el segundo canal, por ejemplo: compara este canal con kurzgesagt.' },
    e_not_found: { en: 'I could not find a channel called {q}.', es: 'No encontré un canal llamado {q}.' },
    e_read: { en: 'YouTube did not return the uploads of {q}.', es: 'YouTube no devolvió los videos de {q}.' },
    e_same: { en: 'Both sides are the same channel. Name a different one.', es: 'Los dos lados son el mismo canal. Dime otro.' },
    reading: { en: 'Reading the channel.', es: 'Leo el canal.' },
    reading_two: { en: 'Reading both channels.', es: 'Leo los dos canales.' }
  };

  var LABEL_ES = {
    'KEEP': { en: 'keep', es: 'sirve' },
    'LOOK AT IT': { en: 'look at it', es: 'hay que mirarlo' },
    'DROP': { en: 'drop', es: 'no sirve' }
  };

  var TRAIT = {
    bisagra_puntos: { en: 'an ellipsis hinge', es: 'puntos suspensivos' },
    bisagra_raya: { en: 'a dash hinge', es: 'un guion que parte el título' },
    dialogo: { en: 'quoted dialogue', es: 'diálogo entre comillas' },
    pregunta: { en: 'a question', es: 'una pregunta' },
    cifra: { en: 'a number', es: 'un número' },
    gritado: { en: 'capitals', es: 'mayúsculas' },
    corto: { en: 'under 60 characters', es: 'menos de 60 caracteres' },
    largo: { en: 'over 95 characters', es: 'más de 95 caracteres' },
    parentesco: { en: 'a family role', es: 'un parentesco' },
    clase: { en: 'rich against poor', es: 'ricos contra pobres' },
    burla: { en: 'a humiliation', es: 'una humillación' },
    secreto: { en: 'a secret', es: 'un secreto' },
    dinero: { en: 'money or land', es: 'dinero o tierras' },
    muerte: { en: 'a death', es: 'una muerte' },
    giro_temporal: { en: 'a jump in time', es: 'un salto en el tiempo' },
    nino: { en: 'a child', es: 'un niño' },
    agro: { en: 'a farming premise', es: 'una premisa agrícola' }
  };

  var AXIS = {
    cadencia: { en: 'upload rhythm', es: 'ritmo de subida' },
    piso: { en: 'floor', es: 'piso' },
    mediana: { en: 'median', es: 'mediana' },
    techo: { en: 'ceiling', es: 'techo' },
    ratio: { en: 'steadiness', es: 'estabilidad' },
    quiebre: { en: 'best lift', es: 'mayor subida' },
    edad: { en: 'youth', es: 'juventud' }
  };

  var HUES = [
    { en: 'red', es: 'rojo' }, { en: 'orange', es: 'naranja' }, { en: 'yellow', es: 'amarillo' }, { en: 'lime', es: 'lima' },
    { en: 'green', es: 'verde' }, { en: 'teal', es: 'verde azulado' }, { en: 'cyan', es: 'cian' }, { en: 'sky blue', es: 'celeste' },
    { en: 'blue', es: 'azul' }, { en: 'violet', es: 'violeta' }, { en: 'magenta', es: 'magenta' }, { en: 'pink', es: 'rosa' }
  ];

  var FORMAT = {
    drama: 'Narrated drama', explicado: 'Explainer', lista: 'List or ranking', historia: 'History over stills', dormir: 'Sleep narration',
    proceso: 'Filmed process', manos: 'Hands-on build', lugar: 'Travel on site', fauna: 'Wildlife footage', persona: 'Person on camera', receta: 'Recipe on camera'
  };

  function langOf(lang) { return lang === 'es' ? 'es' : 'en'; }

  function fill(key, lang, vars) {
    var row = P[key];
    if (!row) return '';
    var t = row[langOf(lang)] || row.en;
    return t.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : ''; });
  }

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n - 1).replace(/\s+\S*$/, '');
    return (cut || s.slice(0, n - 1)) + ELLIPSIS;
  }

  function trunc(v, d) {
    var f = Math.pow(10, d);
    return Math.floor(v * f + 1e-9) / f;
  }

  function compact(n) {
    n = Number(n);
    if (!isFinite(n)) return '';
    var a = Math.abs(n);
    if (a < 1000) return String(Math.round(n));
    var units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (var i = 0; i < units.length; i++) {
      if (a >= units[i][0]) {
        var v = a / units[i][0];
        return (n < 0 ? '-' : '') + (v < 10 ? String(trunc(v, 1)) : String(Math.floor(v))) + units[i][1];
      }
    }
    return String(n);
  }

  function compactSubs(n) {
    n = Number(n);
    if (!isFinite(n) || n <= 0) return '';
    if (n < 1000) return String(Math.round(n));
    var units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var v = n / units[i][0];
        return String(trunc(v, v < 10 ? 2 : (v < 100 ? 1 : 0))) + units[i][1];
      }
    }
    return String(n);
  }

  function spokenNum(n, lang) {
    var a = Math.abs(Number(n) || 0);
    var es = langOf(lang) === 'es';
    var dec = function (v) {
      var t = String(v < 10 ? trunc(v, 1) : Math.floor(v));
      return es ? t.replace('.', ',') : t;
    };
    if (a >= 1e9) return fill('billion', lang, { n: dec(a / 1e9) });
    if (a >= 1e6) {
      var m = dec(a / 1e6);
      return m === '1' ? fill('million_one', lang) : fill('million', lang, { n: m });
    }
    if (a >= 1e4) return fill('thousand', lang, { n: String(Math.floor(a / 1e3)) });
    if (a >= 1e3) return fill('thousand', lang, { n: dec(a / 1e3) });
    return String(Math.round(a));
  }

  function spokenViews(n, lang) {
    return spokenNum(n, lang) + (langOf(lang) === 'es' && Math.abs(Number(n) || 0) >= 1e6 ? ' de' : '');
  }

  function mult(x) {
    x = Number(x) || 0;
    return (x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10)) + 'x';
  }

  function spokenMult(x, lang) {
    x = Number(x) || 0;
    var t = x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10);
    if (langOf(lang) === 'es') t = t.replace('.', ',');
    return fill('times', lang, { n: t });
  }

  function listJoin(items, lang) {
    items = items.filter(Boolean);
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + fill('and', lang) + items[items.length - 1];
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

  function seconds(text) {
    var m = /^(\d+)(?::(\d\d))?(?::(\d\d))?$/.exec(String(text || '').trim());
    if (!m) return null;
    var parts = [m[1], m[2], m[3]].filter(function (x) { return x != null; }).map(Number);
    var s = 0;
    for (var i = 0; i < parts.length; i++) s = s * 60 + parts[i];
    return parts.length >= 2 ? s : null;
  }

  function clock(sec) {
    sec = Math.round(Number(sec) || 0);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  function norm(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  var URL_RE = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:@[^\s\/?#]{1,100}|channel\/UC[A-Za-z0-9_-]{22}|c\/[^\s\/?#]{1,100}|user\/[^\s\/?#]{1,100}|watch\?\S*?v=[A-Za-z0-9_-]{11}|shorts\/[A-Za-z0-9_-]{11}|live\/[A-Za-z0-9_-]{11})|youtu\.be\/[A-Za-z0-9_-]{11})\S*/gi;
  var HANDLE_RE = /(^|[\s(,;:"'])@([A-Za-z0-9][A-Za-z0-9._-]{1,99})/g;
  var SELF = '(?:este canal|ese canal|el canal|this channel|that channel|the channel|este video|ese video|el video|this video|that video|the video|esto|eso|este|ese|this|that|it)';
  var LEAD = /^(?:(?:hey|oye|ok|okay|hola|zerack|please|por favor|porfa|y|and|so|now|ahora|a ver|pues|bueno)\s+)+/;
  var OWN = /\b(?:mi|mis|my|mine|nuestro|nuestra|our)\b/;
  var NEGATION = /\b(?:no|nunca|never|dont|not)\b/;
  var DEFINE = /^(?:que es|que significa|what is an?|what does|define)\b/;
  var NOT_A_CHANNEL = /\b(?:titulo|titulos|title|titles|miniatura|miniaturas|thumbnail|thumbnails|idea|ideas|guion|script|nicho|niche|precio|price|rpm|cpm)\b/;
  var SELF_ONLY = new RegExp('^' + SELF + '(?: (?:tanto|so much|so fast|asi|like that))?$');
  var OF_SELF = new RegExp('^(?:(?:a|al|de|del|on|of|for|to|sobre)\\s+)?' + SELF + '(?: (?:tanto|so much|so fast|asi))?$');
  var OF_REF = /^(?:(?:a|al|de|del|on|of|for|to|sobre|con|with|contra|against|vs|versus|y|and)\s+)?(?:(?:el canal|canal|channel|the channel)\s+(?:de\s+|del\s+)?)?chref(?: (?:tanto|so much))?$/;
  var OF_NAME = /^(?:a|al|de|del|on|of|for|to|sobre)\s+(?:(?:el canal|canal|channel|the channel)\s+(?:de\s+|del\s+)?)?(.+)$/;
  var OF_CHANNEL_NAME = /^(?:(?:a|al|de|del|on|of|for|to|sobre)\s+)?(?:el canal|canal|channel|the channel)\s+(?:de\s+|del\s+)?(.+)$/;

  function refsOf(raw) {
    var refs = [];
    var text = String(raw || '').slice(0, 600).replace(URL_RE, function (m) {
      refs.push({ url: m.replace(/[.,;:!?)\]]+$/, '') });
      return ' chref ';
    }).replace(HANDLE_RE, function (m, pre, h) {
      refs.push({ handle: '@' + h.replace(/[._-]+$/, '') });
      return pre + ' chref ';
    });
    return { refs: refs, text: text };
  }

  function nameOk(name) {
    var n = String(name || '').trim();
    if (!n || n.split(' ').length > NAME_WORDS || n === 'chref') return '';
    if (NOT_A_CHANNEL.test(n) || new RegExp('^' + SELF + '$').test(n)) return '';
    if (/^(?:la|el|los|las|lo|un|una|unos|unas|mi|tu|su|sus|esa|esas|esos|aquel|aquella|otro|otra)\b/.test(n)) return '';
    return n;
  }

  function target(tail, refs, allowName) {
    var t = String(tail || '').trim();
    if (!t || SELF_ONLY.test(t) || OF_SELF.test(t)) return refs.length ? null : { tab: true };
    if (refs.length === 1 && OF_REF.test(t)) return refs[0];
    if (!allowName || refs.length) return null;
    var m = (allowName === 'channel' ? OF_CHANNEL_NAME : OF_NAME).exec(t);
    var name = m ? nameOk(m[1]) : '';
    return name ? { name: name } : null;
  }

  function one(kind, who) {
    return who ? { kind: kind, who: [who] } : null;
  }

  function duelOf(s, refs) {
    var verb = /\b(?:vs|versus|contra|against|compar\w*|duel\w*|enfrent\w*|face off|head to head|cara a cara|who wins|quien gana)\b/;
    if (NOT_A_CHANNEL.test(s)) return null;
    if (refs.length >= 2 && verb.test(s)) return { kind: 'duel', who: [refs[0], refs[1]] };
    if (refs.length === 1 && verb.test(s)) {
      var rest = s.replace(/\bchref\b/, ' ').replace(/\s+/g, ' ').trim();
      var ok = new RegExp('^(?:(?:haz|hazme|make|run|do|start)\\s+(?:un |una |a )?)?(?:duelo|duel|compara|comparalo|comparar|compare|compare it|enfrenta|enfrentalo|face off)(?:\\s+' + SELF + ')?(?:\\s+(?:con|with|contra|against|to|vs|versus|y|and|a))?(?:\\s+(?:el canal|canal|channel|the channel)(?:\\s+de)?)?$').test(rest)
        || /^(?:vs|versus|contra|against)$/.test(rest)
        || new RegExp('^' + SELF + '\\s+(?:vs|versus|contra|against)$').test(rest);
      return ok ? { kind: 'duel', who: [{ tab: true }, refs[0]] } : null;
    }
    if (refs.length) return null;
    var m = new RegExp('^(?:(?:haz|hazme|make|run|do|start)\\s+(?:un |una |a )?)?(?:duelo|duel|compara|comparalo|comparar|compare|compare it|enfrenta|enfrentalo|face off)(?:\\s+' + SELF + ')?\\s+(?:con|with|contra|against|to|vs|versus|y|and)\\s+(?:(?:el canal|canal|channel|the channel)\\s+(?:de\\s+|del\\s+)?)?(.+)$').exec(s);
    var name = m ? nameOk(m[1]) : '';
    return name ? { kind: 'duel', who: [{ tab: true }, { name: name }] } : null;
  }

  function verdictOf(s, refs) {
    var strong = /\b(?:canal muerto|dead channel|is (?:this|that|chref|this channel|that channel|the channel) dead|(?:esta|anda) (?:muerto|muerta) (?:este|ese|el) canal|(?:este|ese|el) canal (?:esta|anda) (?:muerto|muerto ya)|one hit wonder|lucky hit|golpe de suerte|pegue de suerte|suerte o (?:crecimiento|motor|real)|luck or (?:real )?growth|growth or luck|crecimiento o suerte)\b/;
    var weak = /\b(?:fue suerte|es suerte|pura suerte|is (?:it|this) luck|was (?:it|this) luck|just luck|dead or alive|vivo o muerto|muerto o vivo|esta muerto|esta muerta|is it dead)\b/;
    var self = /\b(?:canal|channel|chref|este video|ese video|this video|that video)\b/;
    var words = s.split(' ').length;
    var hit = (strong.test(s) && (self.test(s) || words <= 5)) || (weak.test(s) && (self.test(s) || words <= 4));
    if (!hit) {
      var m = /^(?:(?:dame|give me|haz|run|show me|muestrame)\s+(?:el |the |a )?)?(?:veredicto|verdict)(?:\s+(?:de|del|sobre|on|for|of)\s+(.+))?$/.exec(s);
      if (!m) return null;
      if (!m[1]) return refs.length ? null : { kind: 'verdict', who: [{ tab: true }] };
      var t = m[1];
      if (refs.length === 1 && OF_REF.test(t)) return { kind: 'verdict', who: [refs[0]] };
      if (refs.length) return null;
      if (new RegExp('^' + SELF + '$').test(t) || /^(?:este|ese|this|that|the|el) (?:canal|channel)$/.test(t)) return { kind: 'verdict', who: [{ tab: true }] };
      var n = /^(?:(?:el canal|canal|channel|the channel)\s+(?:de\s+)?)?(.+)$/.exec(t);
      var name = n ? nameOk(n[1]) : '';
      return name ? { kind: 'verdict', who: [{ name: name }] } : null;
    }
    if (refs.length === 1) return { kind: 'verdict', who: [refs[0]] };
    if (refs.length > 1) return null;
    return { kind: 'verdict', who: [{ tab: true }] };
  }

  function formulaOf(s, refs) {
    var m = /\b(clona\w*|clonar|clone|copia(?:r|le|me)?|copy|replica\w*|replicate|saca(?:me|r)?|dame|give me|show me|muestrame|ensename|cual es|what is|whats|what s|get)\s+(?:(?:la|su|the|its|their|el|this channel s|this channels|este)\s+)*(formula|receta|recipe)\b\s*(.*)$/.exec(s);
    if (m) {
      var cloneVerb = /^(?:clon|copi|copy|replic)/.test(m[1]);
      if (m[2] !== 'formula' && !m[3] && !cloneVerb) return null;
      if (!m[3] && !cloneVerb && /^(?:cual es|what is|whats|what s|get)$/.test(m[1])) return null;
      return one('formula', target(m[3], refs, cloneVerb));
    }
    m = new RegExp('\\b(?:la |the )?formula (?:de|del|of) (' + SELF + '|chref)$').exec(s);
    if (m) return one('formula', m[1] === 'chref' ? (refs.length === 1 ? refs[0] : null) : (refs.length ? null : { tab: true }));
    m = /^(?:clona|clone|copia|copy)\s+(.+)$/.exec(s);
    if (m && /^(?:este canal|this channel|el canal|chref)$/.test(m[1])) return one('formula', m[1] === 'chref' ? (refs.length === 1 ? refs[0] : null) : { tab: true });
    return null;
  }

  function xrayOf(s, refs) {
    var m = /^(?:(?:haz|hazme|hagamos|dame|pasa|pasale|give me|run|do|show me|muestrame|make)\s+)?(?:(?:un|una|los|el|a|an|the)\s+)?(?:rayos? x|rayos? equis|x ray|xray)\b\s*(.*)$/.exec(s);
    if (m) return one('xray', target(m[1], refs, 'channel'));
    m = /\bpor ?que (?:exploto|ha explotado|reviento|se hizo viral|se volvio viral|se viralizo|pego tanto|pego|crecio tanto|crecio)\b\s*(.*)$/.exec(s);
    if (m) return one('xray', target(m[1], refs, false));
    m = /\bwhy (?:did|does|has|is|was) (.+?) (?:blow up|blown up|blowing up|blew up|go viral|gone viral|going viral|went viral|explode|exploded|exploding|take off|taken off|taking off|took off|grow so fast|growing so fast|grow so much)\b\s*(.*)$/.exec(s);
    if (m && (!m[2] || /^(?:so much|so fast|like that|lately)$/.test(m[2]))) return one('xray', target(m[1], refs, false));
    m = /\bwhat made (.+?) (?:blow up|go viral|explode|take off)$/.exec(s);
    if (m) return one('xray', target(m[1], refs, false));
    m = /\bque hizo (?:explotar|crecer|viral) (?:a )?(.+)$/.exec(s);
    if (m) return one('xray', target(m[1], refs, false));
    return null;
  }

  var SAID_ES = /\b(?:por ?que|exploto|reviento|crecio|pego|viralizo|rayos?|equis|compara\w*|duelo|enfrenta\w*|clona\w*|copia\w*|replica\w*|dame|haz|hazme|receta|veredicto|muerto|muerta|suerte|canal|este|esto|ese|eso|que hizo|contra|con|de|del)\b/;
  var SAID_EN = /\b(?:why|what|made|blow|blew|viral|x ray|xray|compare|duel|versus|against|with|clone|copy|replicate|formula of|recipe|verdict|dead|luck|growth|this|that|channel|video|the|of|on|is)\b/;

  function intent(raw) {
    var r = refsOf(raw);
    var s = norm(r.text).replace(LEAD, '').trim();
    if (!s || s.split(' ').length > MAX_WORDS) return null;
    if (NEGATION.test(s) || DEFINE.test(s)) return null;
    if (OWN.test(s) && !r.refs.length) return null;
    var hit = duelOf(s, r.refs) || verdictOf(s, r.refs) || formulaOf(s, r.refs) || xrayOf(s, r.refs);
    if (!hit) return null;
    hit.said = s;
    hit.lang = SAID_ES.test(s) ? 'es' : (SAID_EN.test(s) ? 'en' : '');
    return hit;
  }

  var injected = null;

  function use(set) {
    injected = set && typeof set === 'object' ? set : null;
  }

  function engines() {
    if (injected) return injected;
    return {
      C: mod('NSP_CADENCIA'), Q: mod('NSP_RIVAL_QUIEBRE'), F: mod('NSP_RIVAL_FORMULA'), R: mod('NSP_RIVAL_REPLICABLE'),
      E: mod('NSP_RIVAL_EXPEDIENTE'), V: mod('NSP_VEREDICTO'), S: mod('NSP_RIVAL_SATURACION'), W: mod('NSP_RIVAL_VENTANA'),
      D: mod('NSP_RIVAL_DUELO'), RE: mod('NSP_REVERSE_ENGINE'), M: mod('NspMiniaturaMercado')
    };
  }

  function channelHead(ch, videos) {
    ch = ch || {};
    var subs = typeof ch.subs === 'number' && ch.subs > 0 ? ch.subs : null;
    var bits = [];
    if (ch.handle) bits.push(ch.handle);
    if (subs) bits.push(compactSubs(subs) + ' subscribers');
    bits.push((videos || []).length + ' uploads read');
    return { name: clip(ch.name || ch.handle || 'This channel', 80), handle: ch.handle || '', url: ch.url || '', subs: subs, total: typeof ch.total === 'number' ? ch.total : null, line: bits.join(' \u00b7 ') };
  }

  function dossier(input) {
    var E = engines().E;
    var ch = input.channel || {};
    if (!E) return { ok: false, razon: 'The dossier engine is not loaded.' };
    return E.armar({ videos: input.videos || [], canal: { nombre: ch.name || '', url: ch.url || '', handle: ch.handle || '', subs: ch.subs != null ? ch.subs : null, totalVideos: typeof ch.total === 'number' ? ch.total : null } });
  }

  function traitRows(list, sideA, sideB) {
    return (list || []).slice(0, 4).map(function (f) {
      return {
        label: f.etiqueta,
        value: f.enGana + '/' + f.deGana + ' ' + sideA + ', ' + f.enPierde + '/' + f.dePierde + ' ' + sideB,
        tag: f.fuerza === 'probado' ? 'PROVEN' : 'LEANS',
        tone: f.fuerza === 'probado' ? 'good' : 'plain'
      };
    });
  }

  function titleTraits(formula, lang) {
    if (!formula || !formula.ok) return { rows: [], note: formula ? formula.razon : 'The title engine is not loaded.', say: '' };
    if (formula.plano) return { rows: [], note: formula.razon, say: fill('f_flat', lang, { brecha: spokenMult(formula.brecha, lang) }), flat: true };
    var up = formula.suben || [];
    var down = formula.hunden || [];
    var rows = traitRows(up, 'top', 'bottom').concat(traitRows(down, 'top', 'bottom').map(function (r) { r.label = 'Losers use more: ' + r.label; r.tone = 'bad'; return r; }));
    var proven = up.filter(function (f) { return f.fuerza === 'probado'; });
    var names = function (list) { return list.slice(0, 2).map(function (f) { return (TRAIT[f.id] || { en: f.etiqueta, es: f.etiqueta })[langOf(lang)]; }); };
    var say = proven.length ? fill('f_proven', lang, { traits: listJoin(names(proven), lang) })
      : (up.length ? fill('f_leans', lang, { traits: listJoin(names(up), lang) }) : fill('f_none', lang));
    return { rows: rows, note: formula.razon + (formula.muestra ? ' ' + formula.muestra : ''), say: say, proven: proven.length, up: up.length };
  }

  function replicableRow(rep, lang) {
    if (!rep || !rep.ok) return { row: { label: 'Rebuildable with AI', value: 'Not measured', tone: 'muted' }, note: rep ? rep.razon : '', say: '' };
    var tag = rep.etiqueta;
    var say = tag === 'KEEP' ? fill('r_keep', lang) : (tag === 'DROP' ? fill('r_drop', lang) : fill('r_look', lang));
    return {
      row: { label: 'Rebuildable with AI', value: rep.relato + ' of ' + rep.titulos + ' titles are narration, ' + rep.camara + ' need a camera', tag: tag, tone: tag === 'KEEP' ? 'good' : (tag === 'DROP' ? 'bad' : 'plain') },
      note: rep.razon,
      say: say
    };
  }

  function templateOf(videos) {
    var RE = engines().RE;
    if (!RE || typeof RE.analyzeTitles !== 'function') return { ok: false, note: 'The title template engine is not loaded.' };
    var t = RE.analyzeTitles(videos);
    var esq = t && t.esqueleto;
    if (!esq || !esq.ok) {
      return { ok: false, stats: t, note: esq && esq.motivo === 'muestra_corta' ? 'Only ' + (esq.analizados || 0) + ' distinct titles, and a skeleton needs at least 4.' : 'No repeated skeleton across these ' + ((esq && esq.analizados) || (t && t.count) || 0) + ' titles. The channel writes each title free-form.' };
    }
    var plantilla = String(esq.plantilla || '');
    var free = 0;
    var huecos = (esq.huecos || []).map(function (h) {
      var name = String(h.nombre || '');
      if (!/^(?:year|number|emoji|extra)$/.test(name)) {
        free++;
        var short = free === 1 ? 'topic' : 'topic ' + free;
        plantilla = plantilla.split('{' + name + '}').join('{' + short + '}');
        name = short;
      }
      return { nombre: name, valores: (h.valores || []).slice(0, 4) };
    });
    return {
      ok: true,
      stats: t,
      plantilla: plantilla,
      encaja: esq.encaja,
      de: esq.de,
      cobertura: esq.cobertura,
      huecos: huecos.slice(0, 4),
      ejemplos: (esq.titulosQueEncajan || []).slice(0, 3),
      note: 'Fits ' + esq.encaja + ' of the ' + esq.de + ' titles read (' + esq.cobertura + '%).'
    };
  }

  function templateSection(tpl) {
    if (!tpl.ok) return { id: 'template', title: 'Title template', rows: [{ label: 'Skeleton', value: 'None repeated', tone: 'muted' }], note: tpl.note };
    var rows = [{ label: 'Skeleton', value: tpl.plantilla, mono: true }];
    tpl.huecos.forEach(function (h) { rows.push({ label: '{' + clip(h.nombre, 40) + '}', value: h.valores.map(function (v) { return clip(v, 40); }).join(', '), tone: 'muted' }); });
    tpl.ejemplos.slice(0, 2).forEach(function (e) { rows.push({ label: 'Real title', value: '"' + clip(e, 120) + '"', tone: 'muted' }); });
    return { id: 'template', title: 'Title template', rows: rows, note: tpl.note };
  }

  function bestOf(videos) {
    var list = (videos || []).filter(function (v) { return viewsOf(v) > 0; });
    var med = median(list.map(viewsOf));
    var best = null;
    list.forEach(function (v) { if (!best || viewsOf(v) > viewsOf(best)) best = v; });
    var total = list.reduce(function (a, v) { return a + viewsOf(v); }, 0);
    return { median: med, best: best, count: list.length, total: total, share: best && total ? Math.round(viewsOf(best) / total * 100) : null };
  }

  function daysOf(v, now) {
    var C = engines().C;
    if (!v) return null;
    if (v.dias != null) return v.dias;
    var at = Number(v.publishedAt);
    if (at > 0) return Math.max(0, Math.floor(((Number(now) || Date.now()) - at) / 86400000));
    return C ? C.diasDe(v.published || v.cuando) : null;
  }

  function nextChips(ch, kind) {
    var ref = ch.handle || ch.url || '';
    if (!ref) return [];
    var out = [];
    if (kind !== 'xray') out.push({ label: 'X-ray', text: 'X-ray ' + ref });
    if (kind !== 'formula') out.push({ label: 'Clone the formula', text: 'Clone the formula of ' + ref });
    if (kind !== 'verdict') out.push({ label: 'Luck or growth?', text: 'Verdict on ' + ref });
    if (kind !== 'duel') out.push({ label: 'Duel it', text: 'Compare ' + ref + ' with @', fill: true });
    return out;
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

  function titleShare(f) {
    if (!f || !f.ok) return { label: 'Title traits', value: 'Not measured' };
    if (f.plano) return { label: 'Title traits', value: 'Flat channel, not the formula' };
    var up = f.suben || [];
    var proven = up.filter(function (t) { return t.fuerza === 'probado'; });
    if (proven.length) return { label: 'Winning titles use', value: clip(proven[0].etiqueta, 30) + ', proven' };
    if (up.length) return { label: 'Winning titles lean on', value: clip(up[0].etiqueta, 26) + ', not proven' };
    return { label: 'Title traits', value: 'None separates winners' };
  }

  function rhythmOf(d) {
    if (d == null || d === '') return null;
    d = Number(d);
    if (!isFinite(d) || d < 0) return null;
    if (d < 0.8) return { key: 'many', days: d };
    var n = Math.round(d);
    return n <= 1 ? { key: 'one', days: 1 } : { key: 'every', days: n };
  }

  function everyDays(d) {
    var r = rhythmOf(d);
    if (!r) return '';
    if (r.key === 'many') return 'Several videos a day';
    return r.key === 'one' ? 'A video every day' : 'A video every ' + r.days + ' days';
  }

  function plural(n, one, many) {
    return Number(n) === 1 ? one : many;
  }

  function stamp(now) {
    var d = new Date(Number(now) || Date.now());
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }

  function xray(input, lang) {
    input = input || {};
    var x = engines();
    var videos = input.videos || [];
    var head = channelHead(input.channel, videos);
    var name = clip(head.name, 40);
    var q = x.Q ? x.Q.medir(videos) : { ok: false, razon: 'The break engine is not loaded.' };
    var f = x.F ? x.F.medir(videos) : { ok: false, razon: 'The title engine is not loaded.' };
    var rep = x.R ? x.R.medir(videos) : { ok: false, razon: 'The replicable engine is not loaded.' };
    var b = bestOf(videos);
    var tpl = templateOf(videos);
    var say = [];
    var sections = [];
    var hero;

    if (q.ok && q.hubo) {
      say.push(fill('x_break', lang, { name: name, salto: spokenMult(q.salto, lang), title: clip(q.video.title, 60), pos: q.posicion, total: q.total }));
      say.push(fill('x_median', lang, { before: spokenNum(q.medianaAntes, lang), after: spokenViews(q.medianaDespues, lang) }));
      hero = { value: mult(q.salto), label: 'floor lift at the turning point' };
    } else if (q.ok && q.apunta) {
      say.push(fill('x_lean', lang, { name: name, salto: spokenMult(q.salto, lang) }));
    } else if (q.ok) {
      say.push(fill('x_flat', lang, { name: name, median: spokenViews(b.median, lang) }));
    } else {
      say.push(fill('x_short', lang, { name: name, n: b.count }));
    }

    var turning = { id: 'turning', title: 'The turning point', rows: [] };
    if (q.ok) {
      if (q.hubo || q.apunta) {
        turning.rows.push({ label: q.hubo ? 'Break video' : 'Biggest lift at', value: '"' + clip(q.video.title, 110) + '"', link: q.video.videoId ? 'https://www.youtube.com/watch?v=' + q.video.videoId : '' });
        turning.rows.push({ label: 'Its views', value: compact(q.video.views) + ' views' });
        turning.rows.push({ label: 'Where', value: 'Upload ' + q.posicion + ' of the ' + q.total + ' read, counted from the oldest' });
      }
      turning.rows.push({ label: q.hubo || q.apunta ? 'Floor lift' : 'Best lift found', value: mult(q.salto) + (q.hubo ? '' : ', a break needs ' + q.umbral + 'x'), tone: q.hubo ? 'good' : 'muted' });
      turning.rows.push({ label: 'Median, ' + (q.ventana || 6) + ' uploads each side', value: compact(q.medianaAntes) + ' before, ' + compact(q.medianaDespues) + ' after' });
      if (q.queCambio && q.queCambio.ok && (q.queCambio.suben || []).length) {
        traitRows(q.queCambio.suben, 'after', 'before').forEach(function (r) { r.label = 'After the break: ' + r.label; turning.rows.push(r); });
      } else if (q.hubo || q.apunta) {
        turning.rows.push({ label: 'What changed in the titles', value: 'No title trait separates after from before', tone: 'muted' });
      }
      turning.note = q.dice;
    } else {
      turning.rows.push({ label: 'Turning point', value: 'Not measured', tone: 'muted' });
      turning.note = q.razon;
    }
    sections.push(turning);

    var against = { id: 'median', title: 'Against its own median', rows: [] };
    if (b.median) {
      against.rows.push({ label: 'Channel median', value: compact(b.median) + ' views over ' + b.count + ' uploads' });
      if (b.best) {
        var bm = viewsOf(b.best) / b.median;
        against.rows.push({ label: 'Best video', value: '"' + clip(b.best.title, 90) + '"', link: b.best.videoId ? 'https://www.youtube.com/watch?v=' + b.best.videoId : '' });
        against.rows.push({ label: 'Its views', value: compact(viewsOf(b.best)) + ' views, ' + mult(bm) + ' the median', tone: bm >= 3 ? 'good' : 'plain' });
        if (!hero && bm >= 3) hero = { value: mult(bm), label: 'best video over the channel median' };
        if (!(q.ok && q.hubo) && !input.focus) say.push(fill('x_best', lang, { views: spokenViews(viewsOf(b.best), lang), mult: spokenMult(bm, lang) }));
      }
      var fo = input.focus;
      if (fo && fo.views > 0) {
        var fm = fo.views / b.median;
        against.rows.push({ label: 'This video', value: '"' + clip(fo.title || '', 90) + '", ' + compact(fo.views) + ' views, ' + mult(fm) + ' the median', tone: fm >= 3 ? 'good' : 'plain' });
        say.push(fill('x_focus', lang, { views: spokenViews(fo.views, lang), mult: spokenMult(fm, lang) }));
      }
    } else {
      against.rows.push({ label: 'Channel median', value: 'No view counts came back', tone: 'muted' });
    }
    against.note = b.median ? 'The median is the middle upload of the ' + b.count + ' read, so one hit does not move it.' : '';
    sections.push(against);
    if (!hero) hero = { value: b.median ? compact(b.median) : 'n/a', label: b.median ? 'median views, no turning point' : 'no view counts read' };

    var tt = titleTraits(f, lang);
    sections.push({ id: 'titles', title: 'What winning titles share', rows: tt.rows.length ? tt.rows : [{ label: 'Title traits', value: f.ok && f.plano ? 'Flat channel' : 'None separates winners', tone: 'muted' }], note: tt.note });
    if (tt.say) say.push(tt.say);

    var rr = replicableRow(rep, lang);
    sections.push({ id: 'ai', title: 'Can AI rebuild it', rows: [rr.row], note: rr.note });
    if (rr.say) say.push(rr.say);

    sections.push(templateSection(tpl));
    sections.push({ id: 'window', title: 'Is the window open', state: 'pending', rows: [{ label: 'Entry window', value: 'Reading channels of the same niche', tone: 'muted', busy: true }], note: 'The window needs several channels of the niche, so ZERACK reads them one at a time after this card.' });

    var base = say.join(' ');
    var card = {
      v: 1, kind: 'xray', label: 'X-RAY', lang: langOf(lang), at: Number(input.now) || Date.now(), count: videos.length,
      say: sayOf(say, SAY_WORDS - 8) + ' ' + fill('w_pending', lang),
      channel: head,
      from: input.from || '',
      hero: hero,
      leadBase: base,
      lead: base + ' ' + fill('w_pending', lang),
      sections: sections,
      next: nextChips(head, 'xray'),
      source: 'Read from the public /videos page of the channel: ' + videos.length + ' uploads, 0 YouTube API quota.',
      model: {
        channel: head.name, handle: head.handle, subscribers: head.subs, uploadsRead: videos.length,
        median: b.median, best: b.best ? { title: b.best.title, views: viewsOf(b.best) } : null,
        turningPoint: q.ok ? { found: !!q.hubo, leans: !!q.apunta, lift: q.salto, video: q.video ? { title: q.video.title, views: q.video.views } : null, upload: q.posicion, of: q.total, medianBefore: q.medianaAntes, medianAfter: q.medianaDespues } : { found: false, reason: q.razon },
        titleTraits: f.ok ? (f.plano ? 'flat: ' + f.razon : (f.suben || []).map(function (t) { return t.etiqueta + ' (' + t.fuerza + ')'; })) : f.razon,
        rebuildableWithAI: rep.ok ? rep.etiqueta : 'not measured',
        template: tpl.ok ? tpl.plantilla + ' (' + tpl.cobertura + '% of titles)' : 'none',
        window: 'being measured, it will appear on the card'
      }
    };
    card.formulaRaw = f;
    card.share = shareOf(card, q, b);
    delete card.formulaRaw;
    card.share.post = shareText(card);
    return card;
  }

  function shareOf(card, q, b) {
    var rows = [];
    var sec = function (id) { for (var i = 0; i < card.sections.length; i++) if (card.sections[i].id === id) return card.sections[i]; return null; };
    if (card.kind === 'xray') {
      if (q && q.ok && (q.hubo || q.apunta)) rows.push({ label: 'Median before, after', value: compact(q.medianaAntes) + ' \u2192 ' + compact(q.medianaDespues) });
      if (b && b.median) rows.push({ label: 'Channel median', value: compact(b.median) + ' views' });
      rows.push(titleShare(card.formulaRaw));
      var ai = sec('ai');
      if (ai && ai.rows[0] && ai.rows[0].tag) rows.push({ label: 'Rebuildable with AI', value: ai.rows[0].tag });
      var w = sec('window');
      if (w && w.state === 'done' && w.rows[0]) rows.push({ label: 'Entry window', value: w.rows[0].tag || w.rows[0].value });
      return {
        kind: 'X-RAY', title: card.channel.name, subtitle: card.channel.line,
        hero: card.hero,
        quote: q && q.ok && (q.hubo || q.apunta) ? { label: q.hubo ? 'The video where it changed' : 'The biggest lift', text: q.video.title } : (b && b.best ? { label: 'Its best video', text: b.best.title } : null),
        rows: rows.slice(0, 4),
        foot: 'Measured from ' + card.count + ' public uploads \u00b7 ' + stamp(card.at)
      };
    }
    return null;
  }

  function windowOf(subject, neighbors, lang) {
    var x = engines();
    var list = [subject].concat(neighbors || []).filter(function (e) { return e && e.ok; });
    if (!x.S || !x.W) return { state: 'failed', rows: [{ label: 'Entry window', value: 'Not measured', tone: 'muted' }], note: 'The saturation engines are not loaded.', say: fill('w_failed', lang) };
    var sat = x.S.medir(list);
    var win = x.W.medir(sat);
    var rows = [];
    var say;
    if (!sat.ok) {
      rows.push({ label: 'Entry window', value: 'Not measured', tone: 'muted' });
      return { state: 'done', rows: rows, note: sat.razon + ' Only ' + list.length + ' channels of this niche could be read.', say: fill('w_failed', lang), sat: sat, win: win, channels: list.length };
    }
    var tag = win.etiqueta;
    var own = subject && subject.ok && subject.canal ? String(subject.canal.url || '') : '';
    rows.push({ label: 'Entry window', value: win.cifra, tag: tag === 'KEEP' ? 'OPEN' : (tag === 'DROP' ? 'SHUT' : 'UNCLEAR'), tone: tag === 'KEEP' ? 'good' : (tag === 'DROP' ? 'bad' : 'plain') });
    rows.push({ label: 'Channels read', value: 'this one and ' + (sat.canales - 1) + ' related ' + plural(sat.canales - 1, 'channel', 'channels') + ', ' + sat.jovenes + ' provably under ' + sat.jovenDias + ' days old' });
    rows.push({ label: 'Clear ' + compact(sat.pisoUtil) + ' median views', value: sat.aterrizan + ' of ' + sat.canales });
    if (sat.medianaDelNicho) rows.push({ label: 'Niche median', value: compact(sat.medianaDelNicho) + ' views, over each channel\'s last ' + (x.C ? x.C.VENTANA : 12) + ' uploads' });
    (sat.filas || []).filter(function (fila) { return !own || fila.url !== own; }).slice(0, 6).forEach(function (fila) {
      var age = '';
      if (fila.dias != null) age = fila.edadCierta ? ', ' + fila.dias + ' days old' : (fila.total >= 100 ? ', ' + fila.total + ' videos, first upload not on the page' : ', at least ' + fila.dias + ' days old');
      rows.push({ label: clip(fila.nombre, 34), value: (fila.mediana != null ? compact(fila.mediana) + ' median' : 'no median') + age, tone: 'muted', link: fila.url || '', linkOn: 'label' });
    });
    var es = langOf(lang) === 'es';
    var agree = { lleg: sat.jovenesQueAterrizan, jov: sat.jovenes, land: plural(sat.jovenesQueAterrizan, 'lands', 'land'), despega: plural(sat.jovenesQueAterrizan, 'despega', 'despegan'), recent: es ? plural(sat.jovenes, 'canal reciente', 'canales recientes') : plural(sat.jovenes, 'recent channel', 'recent channels') };
    if (sat.jovenes === 0) say = fill('w_none', lang);
    else if (tag === 'KEEP') say = fill('w_open', lang, agree);
    else if (tag === 'DROP') say = fill('w_shut', lang, agree);
    else say = fill('w_unclear', lang, agree);
    return { state: 'done', rows: rows, note: win.razon + (tag === 'KEEP' || tag === 'DROP' ? ' ' + win.accion : ''), say: say, sat: sat, win: win, channels: list.length };
  }

  function withWindow(card, win) {
    if (!card || !card.sections) return card;
    var out = JSON.parse(JSON.stringify(card));
    for (var i = 0; i < out.sections.length; i++) {
      if (out.sections[i].id !== 'window') continue;
      out.sections[i] = { id: 'window', title: 'Is the window open', state: win.state || 'done', rows: win.rows, note: win.note };
    }
    out.lead = out.leadBase + (win.say ? ' ' + win.say : '');
    out.windowSay = win.say || '';
    if (out.model) out.model.window = win.rows && win.rows[0] ? (win.rows[0].tag ? win.rows[0].tag + ': ' : '') + win.rows[0].value : 'not measured';
    if (out.share && out.kind === 'xray' && win.rows && win.rows[0] && win.rows[0].tag) {
      if (out.share.rows.length >= 4) out.share.rows = out.share.rows.slice(0, 3);
      out.share.rows.push({ label: 'Entry window', value: win.rows[0].tag.toLowerCase() });
    }
    return out;
  }

  function verdict(input, lang) {
    input = input || {};
    var x = engines();
    var videos = input.videos || [];
    var head = channelHead(input.channel, videos);
    var name = clip(head.name, 40);
    var e = dossier(input);
    var cad = e && e.cadencia ? e.cadencia : (x.C ? x.C.medir(videos, { now: input.now }) : { ok: false, razon: 'The cadence engine is not loaded.' });
    var q = e && e.quiebre ? e.quiebre : { ok: false };
    var few = cad.ok && cad.suficiente === false;
    var run = q.ok ? q.estable : null;
    var b = bestOf(videos);
    var newest = null;
    videos.forEach(function (v) { var d = daysOf(v, input.now); if (d != null && (newest == null || d < newest)) newest = d; });
    var word, tone, key, vars;
    if (!cad.ok) {
      word = 'NO VERDICT'; tone = 'muted'; key = 'v_none'; vars = { name: name };
    } else if (few) {
      word = 'NO VERDICT'; tone = 'muted'; key = 'v_few'; vars = { name: name, n: cad.maduros, need: cad.umbrales.minVeredicto, uploads: langOf(lang) === 'es' ? plural(cad.maduros, 'video tiene', 'videos tienen') : plural(cad.maduros, 'upload is', 'uploads are') };
    } else if (run && run.ok && cad.luz !== 'verde') {
      word = 'REAL GROWTH'; tone = 'good'; key = 'v_recent'; vars = { name: name, n: run.videos, floor: spokenNum(run.piso, lang), ceiling: spokenViews(run.techo, lang) };
    } else if (cad.luz === 'verde') {
      word = 'REAL GROWTH'; tone = 'good'; key = 'v_growth'; vars = { name: name, n: cad.usados, floor: spokenNum(cad.piso, lang), ceiling: spokenViews(cad.techo, lang), ratio: spokenMult(cad.ratio, lang) };
    } else if (cad.luz === 'rojo') {
      word = 'ONE LUCKY HIT'; tone = 'bad'; key = 'v_luck'; vars = { name: name, ratio: spokenMult(cad.ratio, lang), share: b.share };
    } else {
      word = 'NEEDS A LOOK'; tone = 'plain'; key = 'v_mid'; vars = { name: name, ratio: spokenMult(cad.ratio, lang) };
    }
    var say = [fill(key, lang, vars)];
    if (newest != null && newest >= IDLE_DAYS) say.push(fill('v_idle', lang, { days: newest }));
    if (e && e.ok && e.etiqueta && !few) say.push(fill('v_copy', lang, { label: (LABEL_ES[e.etiqueta] || LABEL_ES['LOOK AT IT'])[langOf(lang)] }));

    var sections = [];
    var nums = { id: 'numbers', title: 'Last ' + (cad.ok ? cad.ventana : 12) + ' uploads', rows: [] };
    if (cad.ok) {
      nums.rows.push({ label: 'Floor', value: compact(cad.piso) + ' views' });
      nums.rows.push({ label: 'Ceiling', value: compact(cad.techo) + ' views' });
      if (few) nums.rows.push({ label: 'Ceiling over floor', value: mult(cad.ratio) + ' over ' + cad.usados + ' ' + plural(cad.usados, 'upload', 'uploads') + ', too few to judge', tone: 'muted' });
      else if (run && run.ok && cad.luz !== 'verde') nums.rows.push({ label: 'Ceiling over floor', value: mult(cad.ratio) + ' across all ' + cad.ventana + ', a video from before the break is still among them', tone: 'muted' });
      else nums.rows.push({ label: 'Ceiling over floor', value: mult(cad.ratio), tag: cad.luz === 'verde' ? 'ENGINE' : (cad.luz === 'rojo' ? 'LUCK' : 'BETWEEN'), tone: cad.luz === 'verde' ? 'good' : (cad.luz === 'rojo' ? 'bad' : 'plain') });
      nums.rows.push({ label: 'Median', value: compact(cad.mediana) + ' views' });
      nums.rows.push(cad.cadenciaDias != null ? { label: 'Upload rhythm', value: everyDays(cad.cadenciaDias) } : { label: 'Upload rhythm', value: 'Not measured', tone: 'muted' });
      nums.note = (few ? 'A verdict needs ' + cad.umbrales.minVeredicto + ' uploads older than ' + cad.umbrales.diasMaduro + ' days; this channel has ' + cad.maduros + '.' : cad.dice + ' Green at ' + cad.umbrales.verde + 'x or less, red over ' + cad.umbrales.rojo + 'x.') + (cad.recortadosPorNuevos ? ' ' + cad.recortadosPorNuevos + ' ' + plural(cad.recortadosPorNuevos, 'upload younger than ' + cad.umbrales.diasMaduro + ' days is', 'uploads younger than ' + cad.umbrales.diasMaduro + ' days are') + ' left out of the floor.' : '') + (cad.cadenciaDias == null && cad.cadenciaRazon ? ' Upload rhythm: ' + cad.cadenciaRazon : '');
    } else {
      nums.rows.push({ label: 'Floor and ceiling', value: 'Not measured', tone: 'muted' });
      nums.note = cad.razon;
    }
    sections.push(nums);
    var conc = { id: 'luck', title: 'How much rides on one video', rows: [] };
    if (b.best && b.total) {
      conc.rows.push({ label: 'Best video', value: '"' + clip(b.best.title, 90) + '"', link: b.best.videoId ? 'https://www.youtube.com/watch?v=' + b.best.videoId : '' });
      conc.rows.push({ label: 'Its share of all views read', value: b.share + '% of ' + compact(b.total) + ' views over ' + b.count + ' uploads', tone: b.share >= 50 ? 'bad' : 'plain' });
      conc.rows.push({ label: 'Over the channel median', value: mult(viewsOf(b.best) / b.median) });
    }
    if (newest != null) conc.rows.push({ label: 'Last upload', value: newest === 0 ? 'Today' : newest + ' days ago', tag: newest >= IDLE_DAYS ? 'INACTIVE' : '', tone: newest >= IDLE_DAYS ? 'bad' : 'plain' });
    sections.push(conc);
    sections.push({ id: 'run', title: 'Steady run and turning point', rows: [
      { label: 'Steady run', value: run && run.ok ? 'Last ' + run.videos + ' uploads within ' + mult(run.ratio) : 'None', tone: run && run.ok ? 'good' : 'muted' },
      { label: 'Turning point', value: q.ok ? (q.hubo ? mult(q.salto) + ' at upload ' + q.posicion + ' of ' + q.total : 'None, best lift ' + mult(q.salto)) : 'Not measured', tone: q.ok && q.hubo ? 'good' : 'muted' }
    ], note: [run ? (run.ok ? run.dice : run.razon) : '', q.ok ? q.dice : (q.razon || '')].filter(Boolean).join(' ') });
    if (e && e.ok) sections.push({ id: 'engine', title: 'Worth copying', rows: [{ label: 'Verdict engine', value: e.veredicto === (x.V && x.V.SIRVE) ? 'Take it apart' : (e.etiqueta === 'DROP' ? 'Leave it' : 'Look before copying'), tag: e.etiqueta, tone: e.etiqueta === 'KEEP' ? 'good' : (e.etiqueta === 'DROP' ? 'bad' : 'plain') }], note: e.razon });

    conc.note = b.best && b.total ? 'A channel that lives on one video has most of its views in it. Over half is a warning sign.' : '';
    var lead = say.join(' ');
    var card = {
      v: 1, kind: 'verdict', label: 'LUCK OR GROWTH', lang: langOf(lang), at: Number(input.now) || Date.now(), say: sayOf(say, SAY_WORDS),
      channel: head, from: input.from || '',
      hero: { value: word, label: !cad.ok ? 'no view counts read' : (few ? 'only ' + cad.maduros + ' ' + plural(cad.maduros, 'upload', 'uploads') + ' older than ' + cad.umbrales.diasMaduro + ' days, ' + cad.umbrales.minVeredicto + ' needed' : (key === 'v_recent' ? 'the last ' + run.videos + ' uploads stay within ' + mult(run.ratio) : 'ceiling ' + mult(cad.ratio) + ' the floor over the last ' + cad.usados + ' mature uploads')), tone: tone, word: true },
      leadBase: lead, lead: lead,
      sections: sections,
      next: nextChips(head, 'verdict'),
      source: 'Read from the public /videos page of the channel: ' + videos.length + ' uploads, 0 YouTube API quota.',
      model: { channel: head.name, verdict: word, floor: cad.ok ? cad.piso : null, ceiling: cad.ok ? cad.techo : null, ratio: cad.ok ? cad.ratio : null, bestVideoShareOfViews: b.share, lastUploadDaysAgo: newest, steadyRun: run && run.ok ? run.dice : null, worthCopying: e && e.ok ? e.etiqueta : null, reason: e && e.ok ? e.razon : cad.razon }
    };
    card.share = {
      kind: 'LUCK OR GROWTH', title: head.name, subtitle: head.line, hero: card.hero,
      quote: b.best ? { label: 'Its best video, ' + b.share + '% of the views read', text: b.best.title } : null,
      rows: (few ? [
        { label: 'Uploads old enough to judge', value: cad.maduros + ' of ' + cad.umbrales.minVeredicto + ' needed' }
      ] : key === 'v_recent' ? [
        { label: 'Last ' + run.videos + ' uploads', value: compact(run.piso) + ' \u2192 ' + compact(run.techo) + ' views' },
        { label: 'Ceiling over floor', value: mult(run.ratio) },
        { label: 'Turning point', value: q.ok && q.hubo ? mult(q.salto) + ' at upload ' + q.posicion : 'none' }
      ] : (cad.ok ? [
        { label: 'Floor, ceiling', value: compact(cad.piso) + ' \u2192 ' + compact(cad.techo) + ' views' },
        { label: 'Ceiling over floor', value: mult(cad.ratio) },
        { label: 'Median of those ' + cad.usados, value: compact(cad.mediana) + ' views' }
      ] : [])).concat(newest != null ? [{ label: 'Last upload', value: newest === 0 ? 'today' : newest + ' days ago' }] : []).slice(0, 4),
      foot: 'Measured from ' + videos.length + ' public uploads \u00b7 ' + stamp(card.at)
    };
    card.share.post = shareText(card);
    return card;
  }

  function lengthStats(videos) {
    var secs = (videos || []).map(function (v) { return v.seconds != null ? v.seconds : seconds(v.length); }).filter(function (s) { return s != null && s > 0; });
    if (!secs.length) return null;
    return { n: secs.length, median: median(secs), p25: quantile(secs, 0.25), p75: quantile(secs, 0.75), long: secs.filter(function (s) { return s >= 1200; }).length };
  }

  function thumbProfile(thumbs, lang) {
    var M = engines().M;
    var list = (thumbs || []).filter(function (t) { return t && t.ok && t.medidas; });
    if (!list.length) return { rows: [{ label: 'Thumbnails', value: 'Not measured', tone: 'muted' }], note: 'No thumbnail of this channel could be read.', say: '' };
    var codes = list.map(function (t) {
      return {
        contraste: t.medidas.stdL, saturacion: t.medidas.meanSat * 100, brillo: t.medidas.meanL,
        retencion_feed: t.feed && t.feed.ok ? t.feed.retencion : null,
        cobertura_texto: t.trazo && t.trazo.ok ? t.trazo.cobertura : null,
        texto_grande: t.trazo && t.trazo.ok ? t.trazo.altoFeedMax : null,
        nota: t.puntuacion ? t.puntuacion.thumbScore : null
      };
    });
    var hueWeight = [];
    for (var h = 0; h < 12; h++) hueWeight.push(0);
    var bands = 0;
    list.forEach(function (t) {
      if (t.paleta && t.paleta.tonos) t.paleta.tonos.forEach(function (x) { hueWeight[x.tono] += x.peso; });
      if (t.trazo && t.trazo.bandas && t.trazo.bandas.length) bands++;
    });
    var hueOrder = hueWeight.map(function (w, i) { return { i: i, w: w / list.length }; }).sort(function (a, b) { return b.w - a.w; }).filter(function (x) { return x.w >= 12; }).slice(0, 2);
    var rows = [];
    var prof = M ? M.perfilDe(codes) : { ok: false, razon: 'The thumbnail market module is not loaded.' };
    if (prof.ok) {
      prof.filas.forEach(function (f) {
        var dec = f.codigo === 'retencion_feed' ? 2 : (f.codigo === 'texto_grande' ? 1 : 0);
        var r = function (v) { var k = Math.pow(10, dec); return String(Math.round(v * k) / k) + (f.sufijo || ''); };
        rows.push({ label: f.etiqueta, value: r(f.mediana) + ' median, sweep ' + r(f.barridoMediana), tone: 'plain' });
      });
    } else {
      var med = function (k) { return median(codes.map(function (c) { return c[k]; })); };
      rows.push({ label: 'Contrast', value: String(Math.round(med('contraste'))) + ' median' });
      rows.push({ label: 'Saturation', value: String(Math.round(med('saturacion'))) + '% median' });
      rows.push({ label: 'Brightness', value: String(Math.round(med('brillo'))) + ' median' });
    }
    rows.push({ label: 'Text or logo bands', value: bands + ' of ' + list.length + ' thumbnails' });
    if (hueOrder.length) rows.push({ label: 'Dominant hues', value: hueOrder.map(function (x) { return HUES[x.i].en + ' ' + Math.round(x.w) + '%'; }).join(', ') });
    var say = hueOrder.length
      ? fill('fo_thumbs', lang, { hues: listJoin(hueOrder.map(function (x) { return HUES[x.i][langOf(lang)]; }), lang), bands: bands, n: list.length })
      : fill('fo_thumbs_plain', lang, { bands: bands, n: list.length });
    var note = 'Measured on the ' + list.length + ' most viewed thumbnails of the channel' + (prof.ok ? '' : ' (' + prof.razon + ')') + '. ' + (M ? M.AVISO : '');
    return { rows: rows, note: note, say: say, measured: list.length, hues: hueOrder.map(function (x) { return HUES[x.i].en; }), bands: bands };
  }

  function formula(input, lang) {
    input = input || {};
    var x = engines();
    var videos = input.videos || [];
    var head = channelHead(input.channel, videos);
    var name = clip(head.name, 40);
    var tpl = templateOf(videos);
    var f = x.F ? x.F.medir(videos) : { ok: false, razon: 'The title engine is not loaded.' };
    var rep = x.R ? x.R.medir(videos) : { ok: false, razon: 'The replicable engine is not loaded.' };
    var cad = x.C ? x.C.medir(videos, { now: input.now }) : { ok: false };
    var len = lengthStats(videos);
    var th = thumbProfile(input.thumbs, lang);
    var say = [];
    say.push(tpl.ok ? fill('fo_template', lang, { pct: tpl.cobertura }) : fill('fo_free', lang));
    var tt = titleTraits(f, lang);
    if (tt.say) say.push(tt.say);
    var rhythm = cad.ok ? rhythmOf(cad.cadenciaDias) : null;
    var cadSay = !rhythm ? '' : (rhythm.key === 'many' ? fill('fo_cad_many', lang) : (rhythm.key === 'one' ? fill('fo_cad_one', lang) : fill('fo_cad', lang, { d: rhythm.days })));
    if (len && len.median >= 5400) say.push(fill('fo_length_h', lang, { h: langOf(lang) === 'es' ? String(Math.round(len.median / 360) / 10).replace('.', ',') : String(Math.round(len.median / 360) / 10), cad: cadSay }));
    else if (len) say.push(fill('fo_length', lang, { min: Math.max(1, Math.round(len.median / 60)), cad: cadSay }));
    if (th.say) say.push(th.say);

    var sections = [templateSection(tpl)];
    var style = tpl.stats && tpl.stats.count ? tpl.stats : null;
    var titleRows = tt.rows.slice();
    if (style) {
      titleRows.push({ label: 'Average length', value: style.avgLen + ' characters', tone: 'muted' });
      titleRows.push({ label: 'With a number', value: style.conNumero + '% of titles', tone: 'muted' });
      titleRows.push({ label: 'In capitals', value: style.conCaps + '% of titles', tone: 'muted' });
      var words = (style.palabrasRepetidas || []).filter(function (w) { return String(w.palabra).length >= 4; }).slice(0, 5);
      if (words.length) titleRows.push({ label: 'Repeated words', value: words.map(function (w) { return w.palabra + ' ' + w.pct + '%'; }).join(', '), tone: 'muted' });
    }
    sections.push({ id: 'titles', title: 'Title traits, winners against losers', rows: titleRows.length ? titleRows : [{ label: 'Title traits', value: 'None measured', tone: 'muted' }], note: tt.note });
    var struct = { id: 'structure', title: 'Structure', rows: [] };
    if (len) {
      struct.rows.push({ label: 'Median length', value: clock(len.median) + ', middle half ' + clock(len.p25) + ' to ' + clock(len.p75) });
      struct.rows.push({ label: '20 minutes or longer', value: len.long + ' of ' + len.n + ' uploads' });
    } else {
      struct.rows.push({ label: 'Length', value: 'Not shown on the page', tone: 'muted' });
    }
    if (rhythm) struct.rows.push({ label: 'Upload rhythm', value: everyDays(cad.cadenciaDias) });
    else if (cad.ok) struct.rows.push({ label: 'Upload rhythm', value: 'Not measured', tone: 'muted', note: cad.cadenciaRazon || '' });
    if (rep.ok) {
      var marks = (rep.marcas || []).filter(function (m) { return FORMAT[m.id]; }).slice(0, 3);
      struct.rows.push({ label: 'Format read from titles', value: marks.length ? marks.map(function (m) { return FORMAT[m.id] + ' ' + m.veces + '/' + rep.titulos; }).join(', ') : 'Titles do not name a format', tone: marks.length ? 'plain' : 'muted' });
      struct.rows.push({ label: 'Rebuildable with AI', value: rep.relato + ' of ' + rep.titulos + ' narration, ' + rep.camara + ' camera', tag: rep.etiqueta, tone: rep.etiqueta === 'KEEP' ? 'good' : (rep.etiqueta === 'DROP' ? 'bad' : 'plain') });
    }
    struct.rows.push({ label: 'Openings and section rhythm', value: 'Not measured: public pages do not show them', tone: 'muted' });
    struct.note = 'Length comes from the duration badge of each upload, rhythm from the upload dates, format from the words of the titles.';
    sections.push(struct);
    sections.push({ id: 'thumbs', title: 'Thumbnail style', rows: th.rows, note: th.note });

    var lead = name + '. ' + say.join(' ');
    var card = {
      v: 1, kind: 'formula', label: 'FORMULA', lang: langOf(lang), at: Number(input.now) || Date.now(), say: name + '. ' + sayOf(say, SAY_WORDS - 4),
      channel: head, from: input.from || '',
      hero: tpl.ok ? { value: tpl.cobertura + '%', label: 'of its titles follow one skeleton' } : { value: 'Free-form', label: 'no repeated title skeleton', word: true },
      leadBase: lead, lead: lead,
      sections: sections,
      next: nextChips(head, 'formula'),
      source: 'Read from the public /videos page and the thumbnails of the channel: ' + videos.length + ' uploads, 0 YouTube API quota.',
      model: {
        channel: head.name, template: tpl.ok ? { skeleton: tpl.plantilla, coverage: tpl.cobertura + '%', slots: tpl.huecos, examples: tpl.ejemplos } : 'none',
        titleTraits: f.ok ? (f.plano ? 'flat' : (f.suben || []).map(function (t) { return t.etiqueta + ' (' + t.fuerza + ')'; })) : f.razon,
        medianLengthSeconds: len ? len.median : null, uploadEveryDays: cad.ok ? cad.cadenciaDias : null,
        rebuildableWithAI: rep.ok ? rep.etiqueta : null, thumbnails: th.measured ? { measured: th.measured, hues: th.hues, withTextBands: th.bands } : 'not measured'
      }
    };
    card.share = {
      kind: 'FORMULA', title: head.name, subtitle: head.line, hero: card.hero,
      quote: tpl.ok ? { label: 'Title template', text: tpl.plantilla } : null,
      rows: [
        titleShare(f),
        len ? { label: 'Median length', value: clock(len.median) } : null,
        rhythm ? { label: 'Upload rhythm', value: everyDays(cad.cadenciaDias).replace(/^A video every/, 'every') } : null,
        th.measured ? { label: 'Thumbnails', value: (th.hues.length ? th.hues.join(' + ') : 'mixed hues') + ', text or logo ' + th.bands + '/' + th.measured } : null
      ].filter(Boolean).slice(0, 4),
      foot: 'Measured from ' + videos.length + ' public uploads \u00b7 ' + stamp(card.at)
    };
    card.share.post = shareText(card);
    return card;
  }

  function why(fila, na, nb) {
    if (fila.estado === 'sin_medir') return fila.razon || 'Not measured.';
    if (fila.estado === 'parecidos') return 'Within ' + fila.distancia + ' of each other.';
    var hi = Math.max(fila.a, fila.b), lo = Math.min(fila.a, fila.b);
    var r = lo > 0 ? hi / lo : null;
    var w = fila.gana === 'a' ? na : nb;
    if (fila.id === 'cadencia') return w + ' uploads ' + (r ? mult(r) + ' as often' : 'more often') + '.';
    if (fila.id === 'ratio') return w + ' is steadier: ceiling ' + mult(fila.gana === 'a' ? fila.a : fila.b) + ' the floor against ' + mult(fila.gana === 'a' ? fila.b : fila.a) + '.';
    if (fila.id === 'edad') return w + ' is younger: ' + (fila.gana === 'a' ? fila.a : fila.b) + ' days old, and the other is at least ' + (fila.gana === 'a' ? fila.b : fila.a) + '.';
    return w + ' is ' + (r ? mult(r) : 'far') + ' higher.';
  }

  function axisValue(fila) {
    var f = function (v, exact) {
      if (v == null) return 'n/a';
      if (fila.id === 'edad' && exact === false) return 'at least ' + Math.round(v) + ' days';
      if (fila.unidad === 'views') return compact(v);
      if (fila.unidad === 'x') return mult(v);
      var n = fila.unidad === 'days' ? Math.round(v) : v;
      return n === 1 ? '1 day' : n + ' days';
    };
    return { a: f(fila.a, fila.ciertaA), b: f(fila.b, fila.ciertaB) };
  }

  function duel(A, B, lang) {
    var x = engines();
    var ha = channelHead(A.channel, A.videos), hb = channelHead(B.channel, B.videos);
    var na = clip(ha.name, 26), nb = clip(hb.name, 26);
    var ea = dossier(A), eb = dossier(B);
    var d = x.D ? x.D.comparar(ea, eb, A.videos, B.videos) : { ok: false, razon: 'The duel engine is not loaded.' };
    var say = [];
    var sections = [];
    var wa = 0, wb = 0, tie = 0;
    if (!d.ok) {
      sections.push({ id: 'axes', title: 'Axes', rows: [{ label: 'Duel', value: 'Not measured', tone: 'muted' }], note: d.razon });
    } else {
      var leadA = [], leadB = [];
      var rows = d.filas.map(function (fila) {
        var v = axisValue(fila);
        if (fila.gana === 'a') { wa++; leadA.push(AXIS[fila.id] ? AXIS[fila.id][langOf(lang)] : fila.eje); }
        else if (fila.gana === 'b') { wb++; leadB.push(AXIS[fila.id] ? AXIS[fila.id][langOf(lang)] : fila.eje); }
        else if (fila.estado === 'parecidos') tie++;
        return {
          label: fila.eje, value: na + ' ' + v.a + ' \u00b7 ' + nb + ' ' + v.b,
          tag: fila.gana === 'a' ? 'A' : (fila.gana === 'b' ? 'B' : (fila.estado === 'parecidos' ? 'CLOSE' : 'N/A')),
          tone: fila.gana ? 'good' : 'muted',
          note: why(fila, na, nb)
        };
      });
      var ca = ea.cadencia, cb = eb.cadencia;
      var scope = ca && ca.ok && cb && cb.ok ? ' Floor, median and ceiling are read over each side\'s newest uploads, leaving out those younger than ' + ca.umbrales.diasMaduro + ' days when enough are older (' + na + ' ' + ca.usados + ', ' + nb + ' ' + cb.usados + '), so this median can differ from the X-ray median over every upload read.' : '';
      sections.push({ id: 'axes', title: 'Axes, and who wins each', rows: rows, note: 'An axis goes to a side only when the gap clears the engine\'s margin; otherwise it is close.' + scope + ' Age counts only when the younger side\'s real age is on the page: with more than 30 uploads the page shows a lower bound, which ranks nothing.' });
      sections.push({ id: 'words', title: 'In words', rows: d.palabras.map(function (p) {
        return { label: p.eje, value: na + ': ' + (p.a == null ? 'not measured' : p.a) + ' \u00b7 ' + nb + ': ' + (p.b == null ? 'not measured' : p.b), tone: p.estado === 'separa' ? 'plain' : 'muted' };
      }) });
      if (d.titulos && d.titulos.ok) {
        var tr = [];
        (d.titulos.suben || []).slice(0, 3).forEach(function (t) { tr.push({ label: na + ' writes more: ' + t.etiqueta, value: t.enGana + '/' + t.deGana + ' against ' + t.enPierde + '/' + t.dePierde, tag: t.fuerza === 'probado' ? 'PROVEN' : 'LEANS' }); });
        (d.titulos.hunden || []).slice(0, 3).forEach(function (t) { tr.push({ label: nb + ' writes more: ' + t.etiqueta, value: t.enPierde + '/' + t.dePierde + ' against ' + t.enGana + '/' + t.deGana, tag: t.fuerza === 'probado' ? 'PROVEN' : 'LEANS' }); });
        sections.push({ id: 'titles', title: 'What one writes that the other does not', rows: tr.length ? tr : [{ label: 'Titles', value: 'No trait separates their titles', tone: 'muted' }], note: d.titulos.razon });
      }
      say.push(fill('d_head', lang, { a: na, b: nb, wa: wa, wb: wb, tie: tie }));
      if (leadA.length) say.push(fill('d_leads', lang, { who: na, axes: listJoin(leadA.slice(0, 3), lang) }));
      if (leadB.length) say.push(fill('d_leads', lang, { who: nb, axes: listJoin(leadB.slice(0, 3), lang) }));
      if (!leadA.length && !leadB.length) say.push(fill('d_none', lang));
      if (d.mismoNicho === false) say.push(fill('d_niche', lang));
    }
    var lead = say.join(' ');
    var card = {
      v: 1, kind: 'duel', label: 'DUEL', lang: langOf(lang), at: Number(A.now || B.now) || Date.now(), say: sayOf(say, SAY_WORDS),
      channel: { name: na + ' vs ' + nb, handle: '', url: '', line: ha.line + '  |  ' + hb.line },
      sides: { a: ha, b: hb },
      hero: { value: wa + ' : ' + wb, label: 'axes won, ' + na + ' : ' + nb + (tie ? ', ' + tie + ' close' : '') },
      leadBase: lead, lead: lead,
      sections: sections,
      notice: d.ok ? d.aviso : '',
      next: [ha, hb].filter(function (h) { return h.handle || h.url; }).map(function (h) { return { label: 'X-ray ' + clip(h.name, 18), text: 'X-ray ' + (h.handle || h.url) }; }),
      source: 'Both read from their public /videos pages: ' + (A.videos || []).length + ' and ' + (B.videos || []).length + ' uploads, 0 YouTube API quota.',
      model: d.ok ? { a: ha.name, b: hb.name, axesWon: { a: wa, b: wb, close: tie }, axes: d.filas.map(function (f) { return { axis: f.eje, a: f.a, b: f.b, winner: f.gana ? (f.gana === 'a' ? ha.name : hb.name) : (f.estado === 'parecidos' ? 'close' : 'not measured') }; }), words: d.palabras.map(function (p) { return { axis: p.eje, a: p.a, b: p.b }; }), sameNiche: d.mismoNicho, notice: d.aviso } : { error: d.razon }
    };
    var top = d.ok ? d.filas.filter(function (f) { return f.gana; }).slice(0, 4) : [];
    card.share = {
      kind: 'DUEL', title: na + ' vs ' + nb, subtitle: ha.subs && hb.subs ? compactSubs(ha.subs) + ' vs ' + compactSubs(hb.subs) + ' subscribers' : 'Two channels, face to face',
      quote: null,
      hero: { value: card.hero.value, label: 'axes won' + (tie ? ', ' + tie + ' close' : '') + ', left against right' },
      rows: top.map(function (f) { var v = axisValue(f); return { label: AXIS[f.id] ? AXIS[f.id].en.charAt(0).toUpperCase() + AXIS[f.id].en.slice(1) : f.eje, value: v.a + ' vs ' + v.b, pair: { a: v.a, b: v.b, win: f.gana } }; }),
      foot: 'Measured from ' + (A.videos || []).length + ' + ' + (B.videos || []).length + ' public uploads \u00b7 ' + stamp(card.at)
    };
    card.share.post = shareText(card);
    return card;
  }

  var FILLER = /^(?:the|and|for|with|from|that|this|what|when|where|which|who|why|how|into|your|you|are|was|were|will|would|could|should|about|after|before|than|then|them|they|their|there|here|have|has|had|just|only|every|ever|never|most|more|much|very|really|part|video|episode|full|official|new|best|top|ever|like|over|under|inside|without|para|como|pero|porque|cuando|donde|quien|este|esta|estos|estas|todo|toda|todos|todas|sobre|entre|hasta|desde|nunca|siempre|tras|sin|con|los|las|una|unos|unas|del|que|por|mas|muy|fue|era|son|sus|hizo|tiene|parte|video|capitulo|something|anything|everything|nothing|someone|somebody|anyone|everyone|people|thing|things|stuff|happens|happened|happen|happening|makes|making|gets|getting|goes|going|comes|coming|looks|wants|need|needs|know|knows|think|thinks|actually|finally|literally|basically|probably|explained|explains|because|while|during|these|those|said|says|algo|nada|cosa|cosas|gente|pasa|paso|pasaria|hace|hacer|hacen|viene|vienen|asi|aqui|alli|cada|otro|otra|otros|otras|mismo|misma|explicado)$/;

  function contentWords(title) {
    var seen = {};
    return norm(title).split(' ').filter(function (w) {
      if (w.length < 4 || /^\d+$/.test(w) || FILLER.test(w) || seen[w]) return false;
      seen[w] = 1;
      return true;
    });
  }

  function keyWords(videos, n) {
    var count = {}, first = {};
    (videos || []).filter(function (v) { return v && v.title; }).forEach(function (v, i) {
      contentWords(v.title).forEach(function (w) {
        count[w] = (count[w] || 0) + 1;
        if (first[w] == null) first[w] = i;
      });
    });
    return Object.keys(count).filter(function (w) { return count[w] >= 2; }).sort(function (a, b) { return count[b] - count[a] || first[a] - first[b]; }).slice(0, n || 12);
  }

  function nicheOf(videos) {
    var E = engines().E;
    var v = E && typeof E.votar === 'function' ? E.votar(videos) : null;
    return v && v.label && !v.mixed ? v : null;
  }

  function nicheQuery(videos, lang) {
    var T = mod('NSP_RPM_TABLA');
    var niche = nicheOf(videos);
    var q = niche && T && typeof T.queryDe === 'function' ? T.queryDe(niche.label, langOf(lang) === 'es') : '';
    if (q) return q;
    var list = (videos || []).filter(function (v) { return viewsOf(v) > 0 && v.title; }).sort(function (a, b) { return viewsOf(b) - viewsOf(a); }).slice(0, 10);
    var words = keyWords(list, 3);
    if (words.length >= 2) return words.join(' ');
    return list.length ? contentWords(list[0].title).slice(0, 4).join(' ') : '';
  }

  function related(subjectVideos, otherVideos) {
    var a = nicheOf(subjectVideos), b = nicheOf(otherVideos);
    if (a && b) return a.label === b.label;
    var keys = keyWords(subjectVideos, 12);
    if (!keys.length) return false;
    var have = {};
    (otherVideos || []).forEach(function (v) { contentWords(v && v.title).forEach(function (w) { have[w] = 1; }); });
    return keys.filter(function (k) { return have[k]; }).length >= 2;
  }

  function duelLine(card) {
    var a = clip(card.sides.a.name, 40), b = clip(card.sides.b.name, 40), w = card.model.axesWon;
    var close = w.close ? ', ' + w.close + ' close' : '';
    if (w.a === w.b) return a + ' against ' + b + ': ' + w.a + ' axes each' + close + '.';
    return (w.a > w.b ? a : b) + ' beats ' + (w.a > w.b ? b : a) + ' on ' + Math.max(w.a, w.b) + ' axes to ' + Math.min(w.a, w.b) + close + '.';
  }

  function shareText(card) {
    var name = card && card.channel ? card.channel.name : '';
    var hero = card && card.hero ? card.hero.value + ' ' + card.hero.label : '';
    var head = card.kind === 'xray' ? 'X-ray of ' + name + ': ' + hero + '.'
      : card.kind === 'verdict' ? name + ': ' + String(card.hero.value).toLowerCase() + ', ' + card.hero.label + '.'
        : card.kind === 'formula' ? 'The formula of ' + name + ': ' + hero + '.'
          : card.kind === 'duel' && card.sides && card.model && card.model.axesWon ? duelLine(card)
            : name + ': ' + hero + '.';
    return clip(head, 200) + ' Measured from public data with ZERACK, open source.';
  }

  function line(key, lang, vars) {
    return fill(key, lang, vars);
  }

  root.NSP_INTEL = {
    REPO: REPO,
    IDLE_DAYS: IDLE_DAYS,
    intent: intent,
    refsOf: refsOf,
    norm: norm,
    compact: compact,
    compactSubs: compactSubs,
    spokenNum: spokenNum,
    mult: mult,
    seconds: seconds,
    median: median,
    dossier: dossier,
    xray: xray,
    verdict: verdict,
    formula: formula,
    duel: duel,
    windowOf: windowOf,
    withWindow: withWindow,
    shareText: shareText,
    use: use,
    sayOf: sayOf,
    nicheQuery: nicheQuery,
    related: related,
    keyWords: keyWords,
    contentWords: contentWords,
    templateOf: templateOf,
    titleTraits: titleTraits,
    thumbProfile: thumbProfile,
    bestOf: bestOf,
    clip: clip,
    listJoin: listJoin,
    spokenMult: spokenMult,
    spokenViews: spokenViews,
    stamp: stamp,
    everyDays: everyDays,
    line: line
  };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
