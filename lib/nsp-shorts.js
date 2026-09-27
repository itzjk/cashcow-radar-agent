(function (root) {
  'use strict';

  var STEP = 0.5;
  var MIN_S = 30;
  var MAX_S = 75;
  var EDGE = 45;
  var GAP = 60;
  var PAUSE = 1.0;
  var PAUSE_BARE = 0.55;
  var WORD_MAX = 1.2;
  var PUNCT_PER_MIN = 1;
  var HEAT_SCALE = 10;

  var FIN = /[.?!]["')\]]*$/;

  var EN = {
    connector: /^(and|but|so|because|or|also|which|then|plus|cause|'cause|and,|but,|so,)$/i,
    fillerStart: /^(yeah|yep|um|uh|okay|ok|right|like|mm|hmm|oh|well|sorry|wait)[,.]?$/i,
    filler: /^(um|uh|mm|hmm)[,.]?$/i,
    claim: /\b(best|worst|elite|never|always|every|nobody|incredible|unbelievable|insane|crazy|huge|massive|biggest|most|love|favorite|perfect|career[- ]high|all[- ]star|the key|that's why|this is why|the reason|i think|i believe|i'm telling you|look at|watch this|watch how|legit|special|dominant|dominat\w*|unstoppable|efficient|impressive|beautiful|ridiculous|absolutely|exactly)\b/gi,
    number: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|percent|points?|rebounds?|assists?|steals?|blocks?|threes?)\b/gi,
    laugh: /\[(laugh|laughter|laughing)[^\]]*\]|\((laugh|laughs|laughing|laughter)[^)]*\)|\bha(ha)+\b|\blol\b/gi,
    cta: /\b(subscribe|patreon|sponsor|link in|like and|notification|welcome (back|in|to)|what's up|what is up|hey guys|hey everybody|thanks for watching|see you|peace out|merch|discord)\b/gi,
    notName: /^(?:I|I'm|I've|I'll|I'd|OK|Okay|Yeah|So|And|But|The|A|It|This|That|He|She|They|We|You)$/,
    pronoun: /^(he|he's|he'll|she|she's|they|they're|it|it's|this|that|that's|these|those|him|his|here|here's|we)$/i,
    padStart: /^(you know|let's see|next clip|hold on|all right|alright|i mean|so yeah|so like|and then|but just|well,|oh yeah)\b/i
  };

  var ES = {
    connector: /^(and|but|so|because|or|also|which|then|plus|cause|'cause|and,|but,|so,|y|e|pero|entonces|porque|o|u|tambi[eé]n|adem[aá]s|pues|luego|as[ií] que)$/i,
    fillerStart: /^(yeah|yep|um|uh|okay|ok|right|like|mm|hmm|oh|well|sorry|wait|eh|em|bueno|pues|vale|mira|oye|perd[oó]n|espera)[,.]?$/i,
    filler: /^(um|uh|mm|hmm|eh|em|mmm)[,.]?$/i,
    claim: /(?:^|[^\p{L}])(best|worst|never|always|every|nobody|incredible|huge|biggest|the key|that's why|mejor|peor|nunca|siempre|nadie|todos|incre[ií]ble|brutal|enorme|el mayor|la mayor|la clave|por eso|la raz[oó]n|creo que|f[ií]jate|mira c[oó]mo|impresionante|perfecto|exactamente|absolutamente|jam[aá]s)(?=[^\p{L}]|$)/giu,
    number: /(?:^|[^\p{L}\p{N}])(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cuarenta|cincuenta|cien|mil|millones?|por ciento|percent)(?=[^\p{L}\p{N}]|$)/giu,
    laugh: /\[(laugh|laughter|laughing|risas?)[^\]]*\]|\((laugh|laughs|laughing|laughter|risas?)[^)]*\)|\b(?:ha|ja)(?:ha|ja)+\b|\blol\b/gi,
    cta: /(?:^|[^\p{L}])(subscribe|patreon|sponsor|link in|thanks for watching|suscr[ií]bete|suscr[ií]banse|patrocin\w*|enlace en|link en|dale like|dale a like|campanita|bienvenidos|qu[eé] tal|hola a todos|gracias por ver|nos vemos|merch|discord)(?=[^\p{L}]|$)/giu,
    notName: /^(?:I|I'm|OK|Okay|Yeah|So|And|But|The|A|It|This|That|He|She|They|We|You|Yo|Y|Pero|El|La|Los|Las|Un|Una|Esto|Eso|Este|Esta|Él|Ella|Ellos|Nosotros|Que|Qué|Si|Sí|No|Bueno|Entonces|Pues|Hoy)$/,
    pronoun: /^(he|she|they|it|this|that|él|ella|ellos|ellas|esto|eso|aquí|aqui|nosotros|ese|esa)$/i,
    padStart: /^(you know|let's see|i mean|o sea|a ver|bueno pues|y entonces|pero bueno|ya sabes|como te dec[ií]a)\b/i
  };

  var WEIGHTS = {
    energia: 0.35, energia_alta: 1.5, nombres_min: 0.25, afirma: 0.35,
    numeros: 0.12, risas: 0.8, remate: 1.0, conector: -2.5,
    muletilla_ini: -1.5, muletillas_min: -0.15, cta: -3.0,
    pausa_bordes: 0.5, pronombre_ini: -1.5, sigue_despues: -1.0,
    relleno_ini: -1.5
  };

  function pyRound(x, d) {
    d = d || 0;
    if (!isFinite(x) || Math.abs(x) >= 1e20) return x;
    var sign = x < 0 ? -1 : 1;
    var s = Math.abs(x).toFixed(20);
    var dot = s.indexOf('.');
    var tail = s.slice(dot + 1 + d);
    if (!/^50*$/.test(tail)) return sign * Number(Math.abs(x).toFixed(d));
    var kept = s.slice(0, d ? dot + 1 + d : dot);
    var last = parseInt(kept.charAt(kept.length - 1), 10);
    var down = Number(kept);
    return sign * (last % 2 === 0 ? down : Number((down + Math.pow(10, -d)).toFixed(d)));
  }

  function median(list) {
    var s = list.slice().sort(function (a, b) { return a - b; });
    var n = s.length;
    if (!n) return 0;
    var h = Math.floor(n / 2);
    return n % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  function count(re, text) {
    re.lastIndex = 0;
    var m = String(text).match(re);
    return m ? m.length : 0;
  }

  function first(re, text) {
    re.lastIndex = 0;
    var ok = re.test(String(text));
    re.lastIndex = 0;
    return ok;
  }

  function stripWord(w) {
    return String(w || '').replace(/[^\p{L}\p{N}_']/gu, '');
  }

  function cleanName(w) {
    return String(w || '').replace(/[^\p{L}\p{N}_'-]/gu, '');
  }

  function isUpper(ch) {
    return !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
  }

  function wordsFromJson3(events) {
    var raw = [];
    (Array.isArray(events) ? events : []).forEach(function (ev) {
      if (!ev || !Array.isArray(ev.segs)) return;
      var start = Number(ev.tStartMs) || 0;
      var dur = Number(ev.dDurationMs) || 0;
      var segs = ev.segs.filter(function (s) { return s && typeof s.utf8 === 'string' && s.utf8.replace(/\s+/g, ''); });
      if (!segs.length) return;
      var timed = segs.length > 1 || segs.some(function (s) { return s.tOffsetMs != null; });
      if (timed && segs.every(function (s) { return String(s.utf8).trim().split(/\s+/).length <= 2; })) {
        segs.forEach(function (s) {
          var parts = String(s.utf8).trim().split(/\s+/);
          var at = (start + (Number(s.tOffsetMs) || 0)) / 1000;
          parts.forEach(function (p, k) { if (p) raw.push({ w: p, t0: at + k * 0.05, end: (start + dur) / 1000 }); });
        });
        return;
      }
      var words = segs.map(function (s) { return s.utf8; }).join('').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      var span = Math.max(0.2, dur / 1000);
      words.forEach(function (w, k) { raw.push({ w: w, t0: start / 1000 + span * k / words.length, end: start / 1000 + span }); });
    });
    raw.sort(function (a, b) { return a.t0 - b.t0; });
    return raw.map(function (p, i) {
      var next = i + 1 < raw.length ? raw[i + 1].t0 : p.end;
      var t1 = Math.min(Math.max(next, p.t0 + 0.08), p.t0 + WORD_MAX);
      return { w: p.w, t0: pyRound(p.t0, 3), t1: pyRound(t1, 3) };
    });
  }

  function heatSeries(markers, seconds) {
    var list = (Array.isArray(markers) ? markers : []).map(function (m) {
      return { s: Number(m.startMillis) / 1000, d: Number(m.durationMillis) / 1000, v: Number(m.intensityScoreNormalized) };
    }).filter(function (m) { return isFinite(m.s) && m.d > 0 && isFinite(m.v); }).sort(function (a, b) { return a.s - b.s; });
    if (list.length < 10) return [];
    var end = Math.max(Number(seconds) || 0, list[list.length - 1].s + list[list.length - 1].d);
    var out = [];
    var j = 0;
    for (var t = 0; t < end; t += STEP) {
      while (j + 1 < list.length && list[j + 1].s <= t) j++;
      out.push(pyRound(list[j].v * HEAT_SCALE, 3));
    }
    return out;
  }

  function spoken(w) {
    return Math.min(0.9, 0.12 + 0.06 * String(w || '').length);
  }

  function sentences(words, pauseEnds) {
    var out = [], cur = [];
    for (var i = 0; i < words.length; i++) {
      var p = words[i];
      cur.push(i);
      var next = i + 1 < words.length ? words[i + 1].t0 : null;
      var punct = FIN.test(p.w);
      var gap = next === null || (pauseEnds ? next - Math.min(p.t1, p.t0 + spoken(p.w)) > PAUSE_BARE && cur.length >= 4 : next - p.t1 > PAUSE);
      if (punct || gap) {
        out.push({ i0: cur[0], i1: cur[cur.length - 1], t0: words[cur[0]].t0, t1: words[cur[cur.length - 1]].t1, fin: punct || (pauseEnds && gap) });
        cur = [];
      }
    }
    return out;
  }

  function textOf(words, i0, i1) {
    var parts = [];
    for (var i = i0; i <= i1; i++) parts.push(words[i].w);
    return parts.join(' ');
  }

  function prep(words, en, titleNames, P) {
    var names = {};
    (titleNames || []).forEach(function (n) { names[String(n).toLowerCase()] = 1; });
    var n = words.length;
    var nameMid = new Float64Array(n + 1);
    var nameAtStart = new Uint8Array(n);
    var fill = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) {
      var clean = cleanName(words[i].w);
      var cap = isUpper(clean.charAt(0)) && !P.notName.test(clean);
      var afterEnd = i > 0 && FIN.test(words[i - 1].w);
      var inTitle = !!names[clean.toLowerCase()];
      nameMid[i + 1] = nameMid[i] + (cap && (!afterEnd || inTitle) ? 1 : 0);
      nameAtStart[i] = cap && inTitle ? 1 : 0;
      fill[i + 1] = fill[i] + (P.filler.test(words[i].w) ? 1 : 0);
    }
    var eSum = new Float64Array(en.length + 1);
    var sorted = en.slice().sort(function (a, b) { return a - b; });
    var med = en.length ? median(en) : -30;
    var top = en.length ? sorted[Math.floor(en.length * 0.75)] : med;
    var eTop = new Float64Array(en.length + 1);
    for (var k = 0; k < en.length; k++) {
      eSum[k + 1] = eSum[k] + en[k];
      eTop[k + 1] = eTop[k] + (en[k] >= top ? 1 : 0);
    }
    return { nameMid: nameMid, nameAtStart: nameAtStart, fill: fill, eSum: eSum, eTop: eTop, med: med, top: top, n: en.length };
  }

  function sentenceCounts(words, fr, P) {
    return fr.map(function (f) {
      var t = textOf(words, f.i0, f.i1);
      return { text: t, afirma: count(P.claim, t), numeros: count(P.number, t), risas: count(P.laugh, t), cta: count(P.cta, t) };
    });
  }

  function energyOf(pre, t0, t1) {
    var a = Math.floor(t0 / STEP);
    var b = Math.floor(t1 / STEP) + 1;
    if (a < 0) a = 0;
    if (b > pre.n) b = pre.n;
    if (b <= a) return { mean: pre.med, high: pre.med >= pre.top ? 1 : 0 };
    var len = b - a;
    return { mean: (pre.eSum[b] - pre.eSum[a]) / len, high: (pre.eTop[b] - pre.eTop[a]) / len };
  }

  function traits(words, fr, sc, pre, a, b, P) {
    var i0 = fr[a].i0, i1 = fr[b].i1;
    var t0 = fr[a].t0, t1 = fr[b].t1;
    var dur = t1 - t0;
    var e = energyOf(pre, t0, t1);
    var afirma = 0, numeros = 0, risas = 0, cta = 0;
    for (var k = a; k <= b; k++) { afirma += sc[k].afirma; numeros += sc[k].numeros; risas += sc[k].risas; cta += sc[k].cta; }
    var nombres = pre.nameMid[i1 + 1] - pre.nameMid[i0] - (pre.nameMid[i0 + 1] - pre.nameMid[i0]) + pre.nameAtStart[i0];
    var primera = stripWord(words[i0].w);
    var siguiente = i1 + 1 < words.length ? words[i1 + 1].w : '';
    var ultima = sc[b].text;
    var lead3 = [];
    for (var q = i0; q <= Math.min(i1, i0 + 2); q++) lead3.push(words[q].w);
    var before = i0 > 0 ? words[i0].t0 - words[i0 - 1].t1 : 2.0;
    var after = i1 + 1 < words.length ? words[i1 + 1].t0 - words[i1].t1 : 2.0;
    return {
      dur: pyRound(dur, 1),
      energia: pyRound(e.mean - pre.med, 2),
      energia_alta: pyRound(e.high, 2),
      nombres_min: pyRound(nombres / dur * 60, 2),
      afirma: afirma,
      numeros: numeros,
      risas: risas,
      remate: first(P.claim, ultima) || /!$/.test(ultima) ? 1 : 0,
      conector: P.connector.test(primera) ? 1 : 0,
      pronombre_ini: P.pronoun.test(primera) ? 1 : 0,
      relleno_ini: P.padStart.test(lead3.join(' ').toLowerCase()) ? 1 : 0,
      sigue_despues: P.connector.test(stripWord(siguiente)) ? 1 : 0,
      muletilla_ini: P.fillerStart.test(primera) ? 1 : 0,
      muletillas_min: pyRound((pre.fill[i1 + 1] - pre.fill[i0]) / dur * 60, 2),
      cta: cta,
      pausa_bordes: (before >= 0.3 ? 1 : 0) + (after >= 0.3 ? 1 : 0),
      palabras_s: pyRound((i1 - i0 + 1) / dur, 2)
    };
  }

  function score(r) {
    var s = 0;
    Object.keys(WEIGHTS).forEach(function (k) { s += WEIGHTS[k] * r[k]; });
    s -= (WEIGHTS.afirma * r.afirma + WEIGHTS.numeros * r.numeros) * (1 - 45.0 / Math.max(r.dur, 1));
    s -= Math.abs(r.dur - 50) / 25.0;
    return pyRound(s, 3);
  }

  function phrasesFor(lang) {
    return /^es/i.test(String(lang || '')) ? ES : EN;
  }

  function punctuated(words) {
    if (!words.length) return false;
    var ends = 0;
    words.forEach(function (w) { if (FIN.test(w.w)) ends++; });
    var minutes = Math.max(1 / 60, (words[words.length - 1].t1 - words[0].t0) / 60);
    return ends / minutes >= PUNCT_PER_MIN;
  }

  function candidates(words, en, opts) {
    opts = opts || {};
    var P = phrasesFor(opts.lang);
    var minS = opts.minS || MIN_S, maxS = opts.maxS || MAX_S, edge = opts.edge == null ? EDGE : opts.edge;
    var fr = sentences(words, !!opts.pauseEnds);
    if (!words.length || !fr.length) return { list: [], sentences: fr };
    var pre = prep(words, en || [], opts.titleNames, P);
    var sc = sentenceCounts(words, fr, P);
    var total = words[words.length - 1].t1;
    var out = [];
    for (var a = 0; a < fr.length; a++) {
      if (fr[a].t0 < edge || (a > 0 && !fr[a - 1].fin)) continue;
      for (var b = a; b < fr.length; b++) {
        var dur = fr[b].t1 - fr[a].t0;
        if (dur > maxS) break;
        if (dur < minS || !fr[b].fin || fr[b].t1 > total - edge) continue;
        var r = traits(words, fr, sc, pre, a, b, P);
        out.push({ i0: fr[a].i0, i1: fr[b].i1, a: a, b: b, t0: fr[a].t0, t1: fr[b].t1, rasgos: r, punt: score(r) });
      }
    }
    return { list: out, sentences: fr, counts: sc, pre: pre };
  }

  function choose(cands, n, sep) {
    n = n || 3;
    sep = sep == null ? GAP : sep;
    var picked = [];
    var order = cands.map(function (c, i) { return { c: c, i: i }; }).sort(function (x, y) { return y.c.punt - x.c.punt || x.i - y.i; });
    for (var k = 0; k < order.length; k++) {
      var c = order[k].c;
      var free = picked.every(function (e) { return c.t1 + sep <= e.t0 || c.t0 >= e.t1 + sep; });
      if (free) picked.push(c);
      if (picked.length === n) break;
    }
    return picked.sort(function (x, y) { return x.t0 - y.t0; });
  }

  function howMany(seconds) {
    return seconds >= 1200 ? 5 : (seconds >= 600 ? 4 : 3);
  }

  function clock(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  var WHY = {
    remate: 'ends on a strong line',
    afirma: '{n} strong claims',
    numeros: '{n} numbers',
    nombres: 'names {n} people or places a minute',
    risas: 'laughter',
    heat: 'replayed more than the rest of the video',
    edges: 'clean pauses at both cuts',
    whole: 'starts and ends on full sentences'
  };

  function why(r, heat) {
    var parts = [];
    if (heat && r.energia > 0.5) parts.push({ w: WEIGHTS.energia * r.energia + WEIGHTS.energia_alta * r.energia_alta, t: WHY.heat });
    if (r.remate) parts.push({ w: WEIGHTS.remate, t: WHY.remate });
    if (r.afirma >= 2) parts.push({ w: WEIGHTS.afirma * r.afirma * 45 / Math.max(r.dur, 1), t: WHY.afirma.replace('{n}', r.afirma) });
    if (r.nombres_min >= 2) parts.push({ w: WEIGHTS.nombres_min * r.nombres_min, t: WHY.nombres.replace('{n}', Math.round(r.nombres_min)) });
    if (r.numeros >= 2) parts.push({ w: WEIGHTS.numeros * r.numeros * 45 / Math.max(r.dur, 1), t: WHY.numeros.replace('{n}', r.numeros) });
    if (r.risas) parts.push({ w: WEIGHTS.risas * r.risas, t: WHY.risas });
    if (r.pausa_bordes === 2) parts.push({ w: WEIGHTS.pausa_bordes * 2, t: WHY.edges });
    parts.sort(function (a, b) { return b.w - a.w; });
    var list = parts.slice(0, 3).map(function (p) { return p.t; });
    if (!list.length) list.push(WHY.whole);
    return list;
  }

  function sentenceText(words, fr, k) {
    return textOf(words, fr[k].i0, fr[k].i1);
  }

  function mine(input) {
    input = input || {};
    var words = Array.isArray(input.words) ? input.words : [];
    var seconds = Number(input.seconds) || (words.length ? words[words.length - 1].t1 : 0);
    if (words.length < 40) return { ok: false, reason: 'too_few_words', words: words.length };
    var pauseEnds = !punctuated(words);
    var en = Array.isArray(input.heat) ? input.heat : [];
    var got = candidates(words, en, { lang: input.lang, titleNames: input.titleNames, pauseEnds: pauseEnds });
    var n = input.n || howMany(seconds);
    var chosen = choose(got.list, n, GAP);
    return {
      ok: chosen.length > 0,
      reason: chosen.length ? '' : (seconds < MIN_S + 2 * EDGE ? 'too_short' : 'no_window'),
      pauseEnds: pauseEnds,
      heat: en.length > 0,
      sentences: got.sentences.length,
      candidates: got.list.length,
      asked: n,
      seconds: seconds,
      clips: chosen.map(function (c) {
        return {
          t0: c.t0, t1: c.t1, dur: c.rasgos.dur, score: c.punt, traits: c.rasgos,
          hook: sentenceText(words, got.sentences, c.a),
          end: c.b > c.a ? sentenceText(words, got.sentences, c.b) : '',
          text: textOf(words, c.i0, c.i1)
        };
      })
    };
  }

  function clip(t, n) {
    t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026' : t;
  }

  function watchAt(id, sec) {
    return /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? 'https://www.youtube.com/watch?v=' + id + '&t=' + Math.max(0, Math.floor(sec)) + 's' : '';
  }

  var LINES = {
    lead: 'I found {n} moments in "{title}" that stand on their own as Shorts. The best one starts at {at}: "{hook}"',
    none: 'No stretch of "{title}" makes a clean Short: {why}',
    no_captions: 'This video has no captions I can read, so there is no text to cut on. Nothing was guessed.',
    why_short: 'it is too short for a 30 second clip with room at both ends.',
    why_window: 'no 30 to 75 second stretch starts and ends on a full sentence.',
    why_words: 'the captions have too few words to judge.'
  };

  function line(key, vars) {
    var t = LINES[key] || '';
    Object.keys(vars || {}).forEach(function (k) { t = t.split('{' + k + '}').join(String(vars[k])); });
    return t;
  }

  function card(input) {
    input = input || {};
    var res = input.result || { ok: false, reason: 'no_captions' };
    var video = input.video || {};
    var vid = video.id || '';
    var title = clip(video.title || 'This video', 90);
    var sections = [];
    var lead;
    if (!res.ok) {
      var whyKey = res.reason === 'too_short' ? 'why_short' : (res.reason === 'too_few_words' ? 'why_words' : 'why_window');
      lead = res.reason === 'no_captions' ? line('no_captions') : line('none', { title: clip(title, 60), why: line(whyKey) });
    } else {
      lead = line('lead', { n: res.clips.length, title: clip(title, 60), at: clock(res.clips.slice().sort(function (a, b) { return b.score - a.score; })[0].t0), hook: clip(res.clips.slice().sort(function (a, b) { return b.score - a.score; })[0].hook, 110) });
      var best = res.clips.slice().sort(function (a, b) { return b.score - a.score; })[0];
      res.clips.forEach(function (c, i) {
        var reasons = why(c.traits, res.heat);
        sections.push({
          id: 'clip' + (i + 1),
          title: 'Clip ' + (i + 1) + ' \u00b7 ' + clock(c.t0) + ' to ' + clock(c.t1) + ' \u00b7 ' + Math.round(c.dur) + ' s' + (c === best ? ' \u00b7 best' : ''),
          concept: c === best,
          rows: [
            { label: 'Hook line', value: '"' + clip(c.hook, 200) + '"', wide: true },
            { label: 'Why', value: reasons.join(', '), note: 'Score ' + c.score.toFixed(2) + (c.traits.cta ? ', has a call to subscribe inside' : '') },
            c.end ? { label: 'Ends on', value: '"' + clip(c.end, 160) + '"', wide: true } : null,
            { label: 'Open at ' + clock(c.t0), value: 'Watch the moment', link: watchAt(vid, c.t0) }
          ].filter(Boolean)
        });
      });
      sections.push({
        id: 'how',
        title: 'How they were picked',
        rows: [
          { label: 'Windows judged', value: String(res.candidates) },
          { label: 'Sentence ends', value: res.pauseEnds ? 'From pauses: these captions carry no punctuation, so check the first words of each cut' : 'From the punctuation in the captions', tone: res.pauseEnds ? 'plain' : 'good' },
          { label: 'Replay heat', value: res.heat ? 'Measured: YouTube\'s most replayed graph weighs in' : 'Not public for this video, left out', tone: res.heat ? 'good' : 'muted' }
        ],
        note: 'The factory clip chooser, ported: full sentences only, 30 to 75 seconds, at least 60 seconds apart, never in the first or last 45 seconds. It rewards strong closing lines, claims, names and numbers, and punishes openings on a connector, a filler or a pronoun with no name, and calls to subscribe. The weights were set by hand, not learned from clip results.',
        copy: { label: 'Copy the cut list', text: res.clips.map(function (c, i) { return (i + 1) + '. ' + clock(c.t0) + ' - ' + clock(c.t1) + ' (' + Math.round(c.dur) + ' s) "' + clip(c.hook, 120) + '"'; }).join('\n') + (vid ? '\nhttps://www.youtube.com/watch?v=' + vid : '') }
      });
    }
    var head = [];
    if (video.channel) head.push(clip(video.channel, 40));
    if (res.seconds) head.push(clock(res.seconds) + ' long');
    if (input.captions) head.push('captions: ' + input.captions);
    var c = {
      v: 1, kind: 'shorts', label: 'SHORTS', at: Date.now(),
      channel: { name: title, url: vid ? 'https://www.youtube.com/watch?v=' + vid : '', line: head.join(' \u00b7 ') },
      hero: res.ok ? { value: res.clips.length + ' Shorts', word: true, label: 'inside this video, ready to cut', tone: 'good' } : { value: 'No clean cut', word: true, label: res.reason === 'no_captions' ? 'no captions to read' : 'nothing stands on its own', tone: 'muted' },
      lead: lead, say: lead,
      sections: sections,
      next: vid ? [{ label: 'X-ray the channel', text: 'X-ray https://www.youtube.com/watch?v=' + vid }] : [],
      source: 'Read from the video\'s public captions' + (res.heat ? ' and its most replayed graph' : '') + '. Nothing was downloaded or rendered.',
      model: res.ok ? { video: title, clips: res.clips.map(function (x) { return { from: clock(x.t0), to: clock(x.t1), seconds: Math.round(x.dur), hook: clip(x.hook, 200), score: x.score }; }), windowsJudged: res.candidates, replayHeat: res.heat } : { error: res.reason }
    };
    if (res.ok && vid) {
      c.share = {
        kind: 'SHORTS', title: title, subtitle: video.channel || '',
        hero: { value: String(res.clips.length), label: 'Shorts hiding in this video' },
        quote: { label: 'Best opening line', text: clip(res.clips.slice().sort(function (a, b) { return b.score - a.score; })[0].hook, 150) },
        rows: res.clips.slice(0, 5).map(function (x, i) { return { label: 'Clip ' + (i + 1), value: clock(x.t0) + ' to ' + clock(x.t1) }; }),
        image: 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg',
        foot: 'Cut from public captions',
        post: clip('Found ' + res.clips.length + ' Shorts inside "' + clip(title, 60) + '", with the exact cuts.', 200) + ' With ZERACK, open source.'
      };
    }
    return c;
  }

  root.NSP_SHORTS = Object.freeze({
    wordsFromJson3: wordsFromJson3,
    heatSeries: heatSeries,
    sentences: sentences,
    candidates: candidates,
    choose: choose,
    score: score,
    punctuated: punctuated,
    howMany: howMany,
    mine: mine,
    card: card,
    clock: clock,
    why: why,
    WEIGHTS: WEIGHTS,
    _pyRound: pyRound
  });
})(typeof self !== 'undefined' ? self : this);
