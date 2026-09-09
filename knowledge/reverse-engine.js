(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined') ? globalThis : this;

  var STOP = {};
  ('de la el los las un una unos unas y o u que en a por con para del al se su sus lo le les mi tu es son como mas más muy este esta esto estos estas ese esa eso si no sin sobre entre cuando donde porque the a an and or of to in for on with from this that these those is are was were be by your you my his her it as at how why what who which when where then than so but not your'
    .split(' ')).forEach(function (w) { STOP[w] = 1; });

  function getTitle(v) {
    if (!v) return '';
    return String(v.title || v.name || v.videoTitle || v.text || v.heading || '').trim();
  }

  function parseNum(x) {
    if (x == null) return 0;
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    var s = String(x).trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
    var m = s.match(/^([\d.]+)\s*([kmb])?/);
    if (!m) return 0;
    var n = parseFloat(m[1]);
    if (!isFinite(n)) return 0;
    if (m[2] === 'k') n *= 1e3;
    else if (m[2] === 'm') n *= 1e6;
    else if (m[2] === 'b') n *= 1e9;
    return n;
  }

  function getMetric(v) {
    if (!v) return 0;
    var fields = ['vph', 'viewsPerHour', 'views', 'viewCount', 'viewsNum', 'viewCountNum'];
    for (var i = 0; i < fields.length; i++) {
      if (v[fields[i]] != null) {
        var n = parseNum(v[fields[i]]);
        if (n > 0) return n;
      }
    }
    return 0;
  }

  function getChannel(v) {
    if (!v) return '';
    return String(v.channelName || v.channel || v.author || v.channelTitle || '').trim();
  }

  function tokenize(t) {
    return String(t).toLowerCase()
      .replace(/[“”"'’‘()¿?¡!:;,.\-–—|/\\\[\]{}]/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length >= 3 && !STOP[w] && !/^\d+$/.test(w); });
  }

  function detectFormats(title) {
    var t = String(title).toLowerCase();
    var tags = [];
    var startsNum = /^\s*(?:top\s*)?\d{1,3}\b/.test(t);
    if (startsNum || /\b\d{1,3}\s+(cosas|formas|maneras|razones|trucos|secretos|errores|tips|things|ways|reasons|signs|facts|types|mistakes)\b/.test(t)) tags.push('lista');
    if (t.indexOf('?') >= 0 || /^\s*(por qu[eé]|c[oó]mo|qu[eé]|cu[aá]l|qui[eé]n|why|how|what|which|who)\b/.test(t)) tags.push('pregunta');
    if (/\b(c[oó]mo|how to|tutorial|gu[ií]a|guide|step by step|paso a paso)\b/.test(t)) tags.push('howto');
    if (/\b(nadie|jam[aá]s|nunca|secreto|secretos|verdad|oculto|ocultos|prohibido|revelado|shocking|nobody|never|secret|truth|hidden|exposed|insane|crazy|reveals?)\b/.test(t)) tags.push('shock');
    if (/\bvs\b|\bversus\b|mejor que|better than|\bor\b/.test(t)) tags.push('comparacion');
    if (/\b(el m[aá]s|la m[aá]s|los m[aá]s|#1|n[uú]mero 1|mejor|peor|best|worst|biggest|greatest|most|largest|richest)\b/.test(t)) tags.push('superlativo');
    if (/[$€£]|\d+\s*%|\b\d+\s*(millones|mill[oó]n|billones|mil|million|billion|trillion|grand)\b|\b\d+[km]\b/.test(t)) tags.push('cifra');
    if (/\b(error|errores|deja de|no hagas|nunca hagas|stop|mistake|mistakes|wrong|avoid|don'?t|dont)\b/.test(t)) tags.push('negativo');
    if (/\b(ahora|antes de|hoy|ya no|urgente|2026|2027|right now|before|today|this year)\b/.test(t)) tags.push('urgencia');
    if (/\b(la historia de|el hombre que|la mujer que|el d[ií]a que|el ni[ñn]o que|the man who|the woman who|the story of|the day|this man|this is why|how i|c[oó]mo logr[eé])\b/.test(t)) tags.push('narrativo');
    return tags;
  }

  var TEMPLATES = {
    lista: '[N] [secretos/errores/datos] de {tema} que {resultado inesperado}',
    pregunta: '¿Por qué {sujeto} {acción inesperada}?',
    howto: 'Cómo {resultado deseado} sin {obstáculo común}',
    shock: 'Nadie te contó esto sobre {tema}',
    comparacion: '{A} vs {B}: cuál {criterio} de verdad',
    superlativo: 'El {superlativo} {tema} de la historia',
    cifra: 'Cómo {sujeto} generó {cifra} con {método}',
    negativo: 'Deja de {acción} — estás {consecuencia negativa}',
    urgencia: '{tema} está cambiando: lo que tenés que hacer antes de {fecha}',
    narrativo: 'La historia del {sujeto} que {hazaña o tragedia}'
  };

  var FORMAT_ALL = ['lista', 'pregunta', 'howto', 'shock', 'comparacion', 'superlativo', 'cifra', 'negativo', 'urgencia', 'narrativo'];

  function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

  function analyzeTitles(videos) {
    var list = (videos || []).map(getTitle).filter(Boolean);
    var n = list.length;
    if (!n) return { count: 0 };
    var fmtCount = {}, wordCount = {}, lenSum = 0, capsCount = 0, numCount = 0;
    var numStat = {}, cifraStat = {};
    FORMAT_ALL.forEach(function (f) { fmtCount[f] = 0; });
    list.forEach(function (title) {
      lenSum += title.length;
      if (/\d/.test(title)) numCount++;
      var letters = title.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '');
      var caps = title.replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
      if (letters.length >= 6 && caps.length / letters.length > 0.6) capsCount++;
      detectFormats(title).forEach(function (f) { fmtCount[f]++; });
      tokenize(title).forEach(function (w) { wordCount[w] = (wordCount[w] || 0) + 1; });
      (title.match(/\b([1-9]|[1-4]\d|50)\b/g) || []).forEach(function (d) { numStat[d] = (numStat[d] || 0) + 1; });
      (title.match(/[$€£]\s?\d[\d.,]*\s?[kmb]?|\b\d+\s?%/gi) || []).forEach(function (cc) { var k = cc.replace(/\s+/g, ''); cifraStat[k] = (cifraStat[k] || 0) + 1; });
    });
    var fmtDist = FORMAT_ALL.map(function (f) { return { formato: f, n: fmtCount[f], pct: pct(fmtCount[f], n) }; })
      .filter(function (x) { return x.n > 0; })
      .sort(function (a, b) { return b.n - a.n; });
    var topWords = Object.keys(wordCount).map(function (w) { return { palabra: w, n: wordCount[w] }; })
      .filter(function (x) { return x.n >= 2; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 12);
    var dominant = fmtDist.length ? fmtDist[0].formato : 'shock';
    var ejemplos = list.slice().sort(function (a, b) { return detectFormats(b).length - detectFormats(a).length; }).slice(0, 3);
    return {
      count: n,
      avgLen: Math.round(lenSum / n),
      conNumero: pct(numCount, n),
      conCaps: pct(capsCount, n),
      formatos: fmtDist,
      formatoDominante: dominant,
      palabrasGatillo: topWords,
      plantilla: TEMPLATES[dominant] || TEMPLATES.shock,
      numerosComunes: Object.keys(numStat).map(function (k) { return { num: k, n: numStat[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5),
      cifrasComunes: Object.keys(cifraStat).map(function (k) { return { cifra: k, n: cifraStat[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5),
      ejemplos: ejemplos
    };
  }

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function findOutliers(videos) {
    var rows = (videos || []).map(function (v) { return { title: getTitle(v), metric: getMetric(v) }; })
      .filter(function (r) { return r.title && r.metric > 0; });
    if (rows.length < 4) return { count: 0, motivo: 'pocos datos con métrica' };
    var med = median(rows.map(function (r) { return r.metric; }));
    if (!med) return { count: 0, motivo: 'mediana 0' };
    var threshold = med * 3;
    var outliers = rows.filter(function (r) { return r.metric >= threshold; })
      .sort(function (a, b) { return b.metric - a.metric; });
    if (!outliers.length) {
      var sorted = rows.slice().sort(function (a, b) { return b.metric - a.metric; });
      outliers = sorted.slice(0, Math.max(1, Math.round(rows.length * 0.2)));
      threshold = outliers.length ? outliers[outliers.length - 1].metric : med;
    }
    var rest = rows.filter(function (r) { return outliers.indexOf(r) < 0; });
    var outFmt = {}, restFmt = {}, outWords = {}, aperturas = {};
    FORMAT_ALL.forEach(function (f) { outFmt[f] = 0; restFmt[f] = 0; });
    outliers.forEach(function (r) {
      detectFormats(r.title).forEach(function (f) { outFmt[f]++; });
      tokenize(r.title).forEach(function (w) { outWords[w] = (outWords[w] || 0) + 1; });
      var ap = String(r.title).trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      if (ap) aperturas[ap] = (aperturas[ap] || 0) + 1;
    });
    rest.forEach(function (r) { detectFormats(r.title).forEach(function (f) { restFmt[f]++; }); });
    var overIndex = FORMAT_ALL.map(function (f) {
      var op = pct(outFmt[f], outliers.length), rp = pct(restFmt[f], rest.length || 1);
      return { formato: f, outlierPct: op, restoPct: rp, ventaja: op - rp };
    }).filter(function (x) { return x.outlierPct > 0 && x.ventaja > 0; })
      .sort(function (a, b) { return b.ventaja - a.ventaja; });
    var topOutWords = Object.keys(outWords).map(function (w) { return { palabra: w, n: outWords[w] }; })
      .filter(function (x) { return x.n >= 2; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    return {
      count: outliers.length,
      medianaMetric: Math.round(med),
      umbral: Math.round(threshold),
      formatosQueExplotan: overIndex,
      palabrasQueExplotan: topOutWords,
      aperturasOutliers: Object.keys(aperturas).map(function (k) { return { apertura: k, n: aperturas[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 4),
      ejemplos: outliers.slice(0, 4).map(function (r) { return { titulo: r.title, metric: Math.round(r.metric) }; })
    };
  }

  function analyzeChannels(videos) {
    var map = {};
    (videos || []).forEach(function (v) {
      var ch = getChannel(v); if (!ch) return;
      var m = getMetric(v), t = getTitle(v);
      if (!map[ch]) map[ch] = { canal: ch, n: 0, vphSum: 0, best: '', bestMetric: 0 };
      var e = map[ch]; e.n++; e.vphSum += m;
      if (m >= e.bestMetric) { e.bestMetric = m; e.best = t; }
    });
    var arr = Object.keys(map).map(function (k) {
      var e = map[k];
      return { canal: e.canal, videos: e.n, vphProm: Math.round(e.vphSum / e.n), mejorTitulo: e.best, mejorVph: Math.round(e.bestMetric) };
    });
    arr.sort(function (a, b) { return (b.videos - a.videos) || (b.vphProm - a.vphProm); });
    return { total: arr.length, dominantes: arr.slice(0, 5) };
  }

  function buildReport(videos, nicho) {
    var t = analyzeTitles(videos);
    var o = findOutliers(videos);
    var c = analyzeChannels(videos);
    if (!t.count) return { ok: false, texto: 'No hay videos para analizar.' };
    var nombre = nicho ? String(nicho) : 'este nicho';
    var L = [];
    L.push('INGENIERIA INVERSA DE ' + nombre.toUpperCase() + ' (' + t.count + ' videos reales del escaneo):');
    L.push('- Formula de titulo dominante: ' + t.formatoDominante.toUpperCase() + '. Longitud media ' + t.avgLen + ' caracteres; ' + t.conNumero + '% usan numero, ' + t.conCaps + '% usan mayusculas fuertes.');
    if (t.formatos.length) {
      L.push('- Mezcla de formatos: ' + t.formatos.slice(0, 5).map(function (f) { return f.formato + ' ' + f.pct + '%'; }).join(', ') + '.');
    }
    if (t.palabrasGatillo.length) {
      L.push('- Palabras gatillo del nicho: ' + t.palabrasGatillo.slice(0, 8).map(function (w) { return w.palabra + '(' + w.n + ')'; }).join(', ') + '.');
    }
    if (o.count) {
      if (o.formatosQueExplotan.length) {
        L.push('- LO QUE EXPLOTA (outliers vs promedio): ' + o.formatosQueExplotan.slice(0, 3).map(function (f) { return f.formato + ' (+' + f.ventaja + ' pts)'; }).join(', ') + ' rinden por encima del resto.');
      }
      if (o.palabrasQueExplotan.length) {
        L.push('- Palabras en los outliers: ' + o.palabrasQueExplotan.slice(0, 6).map(function (w) { return w.palabra; }).join(', ') + '.');
      }
      if (o.aperturasOutliers && o.aperturasOutliers.length) {
        L.push('- Con qué ABREN los que explotan (gancho adelante, primeras 2 palabras): ' + o.aperturasOutliers.map(function (a) { return '"' + a.apertura + '"'; }).join(', ') + '.');
      }
      if (o.ejemplos.length) {
        L.push('- Titulos reales que explotaron: ' + o.ejemplos.map(function (e) { return '"' + e.titulo + '"'; }).join(' | ') + '.');
      }
    }
    if (c.dominantes && c.dominantes.length) {
      L.push('- CANALES que dominan tu nicho (estudiá su mejor video y hacelo mejor): ' + c.dominantes.slice(0, 4).map(function (x) { return x.canal + ' (' + x.videos + ' en el scan, mejor: "' + x.mejorTitulo + '")'; }).join(' | ') + '.');
    }
    if (t.numerosComunes && t.numerosComunes.length) {
      L.push('- Números/cifras que más usan: ' + t.numerosComunes.map(function (x) { return x.num; }).join(', ') + (t.cifrasComunes && t.cifrasComunes.length ? ' | cifras: ' + t.cifrasComunes.map(function (x) { return x.cifra; }).join(', ') : '') + '.');
    }
    var formatoGanador = (o.count && o.formatosQueExplotan && o.formatosQueExplotan.length) ? o.formatosQueExplotan[0].formato : t.formatoDominante;
    var plantillaGanadora = TEMPLATES[formatoGanador] || t.plantilla;
    L.push('- PLANTILLA para replicar (basada en lo que EXPLOTA = ' + formatoGanador.toUpperCase() + ', rellenala): ' + plantillaGanadora);
    if (t.ejemplos.length) {
      L.push('- Ejemplos reales del escaneo a imitar: ' + t.ejemplos.map(function (e) { return '"' + e + '"'; }).join(' | ') + '.');
    }
    return {
      ok: true,
      titulos: t,
      outliers: o,
      canales: c,
      plantilla: plantillaGanadora,
      formatoGanador: formatoGanador,
      texto: L.join('\n')
    };
  }

  root.NSP_REVERSE_ENGINE = {
    version: '1.2.0',
    detectFormats: detectFormats,
    analyzeTitles: analyzeTitles,
    findOutliers: findOutliers,
    analyzeChannels: analyzeChannels,
    buildReport: buildReport
  };
})();
