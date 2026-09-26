(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined') ? globalThis : this;

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
    var fields = ['vph', 'viewsPerHour', 'viewsNum', 'viewCountNum', 'views', 'viewCount'];
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
    var re = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;
    var out = [], m;
    while ((m = re.exec(String(t))) !== null) {
      var w = m[0].toLowerCase();
      if (!RE_ALFANUM.test(w) || /^\d+$/.test(w)) continue;
      out.push(w);
    }
    return out;
  }

  var DF_SENAL = 0.5;
  var DF_FRASE_FIJA = 0.33;
  var DISPERSION_FRASE = 0.35;
  var MIN_TITULOS_PALABRAS = 4;
  var VENTAJA_MINIMA_OUTLIER = 0.35;

  function contarPalabras(lista) {
    var cf = {}, df = {}, vecinos = {};
    lista.forEach(function (titulo) {
      var ts = tokenize(titulo), visto = {};
      ts.forEach(function (w, i) {
        cf[w] = (cf[w] || 0) + 1;
        if (!visto[w]) { df[w] = (df[w] || 0) + 1; visto[w] = 1; }
        if (!vecinos[w]) vecinos[w] = {};
        vecinos[w][i === 0 ? '^' : ts[i - 1]] = 1;
        vecinos[w][i === ts.length - 1 ? '$' : ts[i + 1]] = 1;
      });
    });
    return { cf: cf, df: df, vecinos: vecinos };
  }

  function dispersionDe(c, w) {
    var v = c.vecinos[w] ? Object.keys(c.vecinos[w]).length : 0;
    return v / (2 * c.cf[w]);
  }

  function palabrasDestacadas(lista) {
    var n = (lista || []).length;
    if (n < MIN_TITULOS_PALABRAS) return [];
    var c = contarPalabras(lista);
    return Object.keys(c.df).map(function (w) {
      return { palabra: w, n: c.cf[w], titulos: c.df[w], share: c.df[w] / n, dispersion: dispersionDe(c, w) };
    }).filter(function (x) {
      if (x.titulos < 2) return false;
      if (x.share >= DF_SENAL) return true;
      return x.share >= DF_FRASE_FIJA && x.dispersion <= DISPERSION_FRASE;
    }).sort(function (a, b) {
      return (b.titulos * (1 - b.dispersion)) - (a.titulos * (1 - a.dispersion));
    }).map(function (x) {
      return { palabra: x.palabra, n: x.n, titulos: x.titulos, pct: pct(x.titulos, n) };
    }).slice(0, 12);
  }

  function palabrasQueDestacanEnOutliers(outliers, resto) {
    if (!outliers.length || outliers.length < 2) return [];
    var co = contarPalabras(outliers), cr = contarPalabras(resto);
    return Object.keys(co.df).map(function (w) {
      var enOut = co.df[w] / outliers.length;
      var enResto = resto.length ? ((cr.df[w] || 0) / resto.length) : 0;
      return { palabra: w, n: co.cf[w], enOut: enOut, ventaja: enOut - enResto };
    }).filter(function (x) {
      return x.enOut >= DF_SENAL && x.ventaja >= VENTAJA_MINIMA_OUTLIER;
    }).sort(function (a, b) { return b.ventaja - a.ventaja; })
      .map(function (x) { return { palabra: x.palabra, n: x.n, ventaja: Math.round(x.ventaja * 100) }; })
      .slice(0, 8);
  }

  var RE_SIN_ESPACIOS = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}]/u;
  var RE_ALFANUM = /[\p{L}\p{N}]/u;

  var MIN_TITULOS_GRUPO = 4;
  var FRACCION_MINIMA = 0.25;
  var PESO_MINIMO_ANCLAS = 12;
  var ANCLAS_LARGAS_MINIMAS = 2;
  var ANCLAS_MINIMAS_SIN_ESPACIOS = 4;
  var MARCAS_QUE_SOSTIENEN_UNA_LARGA = 2;
  var MAX_TITULOS_ESQUELETO = 60;
  var MAX_SEMILLAS = 14;

  function esAlfanum(s) { return RE_ALFANUM.test(String(s)); }

  function letras(s) { return Array.from(String(s)); }

  function tokenizar(titulo) {
    var s = String(titulo || '');
    var re = /(\p{Extended_Pictographic}(?:\ufe0f|\u200d\p{Extended_Pictographic}|\p{Emoji_Modifier})*)|([\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*)|([^\s])/gu;
    var out = [], m, fin = 0;
    while ((m = re.exec(s)) !== null) {
      var bruto = m[0];
      var pre = out.length > 0 && m.index > fin;
      var ini = m.index;
      fin = m.index + bruto.length;
      if (m[2] && RE_SIN_ESPACIOS.test(bruto)) {
        var trozos = letras(bruto), desp = ini;
        for (var c = 0; c < trozos.length; c++) {
          out.push({ raw: trozos[c], key: trozos[c].toLowerCase(), pre: c === 0 ? pre : false, i0: desp, i1: desp + trozos[c].length });
          desp += trozos[c].length;
        }
        continue;
      }
      out.push({ raw: bruto, key: m[2] ? bruto.toLowerCase() : bruto, pre: pre, i0: ini, i1: fin });
    }
    return out;
  }

  function subsecuenciaComun(a, b) {
    var n = a.length, m = b.length;
    if (!n || !m) return [];
    var dp = [], i, j, fila;
    for (i = 0; i <= n; i++) { fila = []; for (j = 0; j <= m; j++) fila.push(0); dp.push(fila); }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        dp[i][j] = (a[i] === b[j]) ? dp[i + 1][j + 1] + 1 : (dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1]);
      }
    }
    var out = [], x = 0, y = 0;
    while (x < n && y < m) {
      if (a[x] === b[y]) { out.push(a[x]); x++; y++; }
      else if (dp[x + 1][y] >= dp[x][y + 1]) x++;
      else y++;
    }
    return out;
  }

  var VALOR_MARCA = 3;
  var RE_MARCA_FUERTE = /[\p{Ps}\p{Pe}\p{Pi}\p{Pf}\p{Pd}\p{S}]/u;

  function medirAnclas(anclas) {
    var peso = 0, largas = 0, marcas = 0;
    anclas.forEach(function (k) {
      if (esAlfanum(k)) {
        var n = letras(k).length;
        peso += n;
        if (n >= 4) largas++;
        return;
      }
      if (RE_MARCA_FUERTE.test(k)) marcas++;
    });
    return { peso: peso, largas: largas, marcas: marcas, total: anclas.length, senal: peso + marcas * VALOR_MARCA };
  }

  function anclasSirven(anclas) {
    var m = medirAnclas(anclas);
    if (m.senal < PESO_MINIMO_ANCLAS) return false;
    return m.largas >= ANCLAS_LARGAS_MINIMAS
      || (m.largas >= 1 && m.marcas >= MARCAS_QUE_SOSTIENEN_UNA_LARGA)
      || m.marcas >= ANCLAS_MINIMAS_SIN_ESPACIOS;
  }

  function posicionesDeAnclas(tokens, anclas) {
    var pos = [], j = 0;
    for (var i = 0; i < tokens.length && j < anclas.length; i++) {
      if (tokens[i].key === anclas[j]) { pos.push(i); j++; }
    }
    return j === anclas.length ? pos : null;
  }

  function mayoritario(valores) {
    var frec = {}, mejor = valores[0], tope = 0;
    valores.forEach(function (v) {
      var k = String(v);
      frec[k] = (frec[k] || 0) + 1;
      if (frec[k] > tope) { tope = frec[k]; mejor = v; }
    });
    return mejor;
  }

  function distintosPorFrecuencia(valores) {
    var frec = {};
    valores.forEach(function (v) { if (v) frec[v] = (frec[v] || 0) + 1; });
    return Object.keys(frec).sort(function (a, b) { return frec[b] - frec[a] || letras(a).length - letras(b).length; });
  }

  function nombreDeHueco(valores) {
    var limpios = valores.filter(Boolean).map(function (v) { return String(v).replace(/[{}]/g, '').trim(); }).filter(Boolean);
    var distintos = distintosPorFrecuencia(limpios);
    if (!distintos.length) return 'extra';
    if (distintos.every(function (v) { return /^\d{4}$/.test(v) && +v >= 1000 && +v <= 2999; })) return 'year';
    if (distintos.every(function (v) { return /^\d[\d.,]*$/.test(v); })) return 'number';
    if (distintos.every(function (v) { return !esAlfanum(v); })) return 'emoji';
    var muestra = [], largo = 0;
    for (var i = 0; i < distintos.length && muestra.length < 3; i++) {
      var n = letras(distintos[i]).length;
      if (muestra.length && largo + n > 34) break;
      muestra.push(distintos[i]);
      largo += n + 3;
    }
    if (!muestra.length) muestra.push(letras(distintos[0]).slice(0, 30).join(''));
    return muestra.join(' / ') + (distintos.length > muestra.length ? ' / …' : '');
  }

  function armarPlantilla(docs, grupo, anclas) {
    var alineados = [];
    grupo.forEach(function (i) {
      var pos = posicionesDeAnclas(docs[i].tokens, anclas);
      if (pos) alineados.push({ doc: docs[i], pos: pos });
    });
    if (alineados.length < MIN_TITULOS_GRUPO) return null;
    var n = alineados.length, g, i;

    var caras = [], pegas = [];
    for (i = 0; i < anclas.length; i++) {
      caras.push(mayoritario(alineados.map(function (a) { return a.doc.tokens[a.pos[i]].raw; })));
      pegas.push(mayoritario(alineados.map(function (a) { return a.doc.tokens[a.pos[i]].pre ? 1 : 0; })) === 0);
    }

    var piezas = [], huecos = [];
    for (g = 0; g <= anclas.length; g++) {
      var valores = [], pega = [];
      for (i = 0; i < n; i++) {
        var a = alineados[i];
        var ini = g === 0 ? 0 : a.pos[g - 1] + 1;
        var fin = g === anclas.length ? a.doc.tokens.length : a.pos[g];
        if (fin <= ini) { valores.push(''); continue; }
        valores.push(a.doc.texto.slice(a.doc.tokens[ini].i0, a.doc.tokens[fin - 1].i1).trim());
        pega.push(a.doc.tokens[ini].pre ? 1 : 0);
      }
      var llenos = valores.filter(Boolean).length;
      if (llenos * 2 >= n) {
        var distintos = distintosPorFrecuencia(valores);
        if (distintos.length === 1 && llenos === n) {
          piezas.push({ texto: distintos[0], pega: mayoritario(pega) === 0 });
        } else {
          var nombre = nombreDeHueco(valores);
          piezas.push({ texto: '{' + nombre + '}', pega: mayoritario(pega) === 0 });
          huecos.push({ nombre: nombre, valores: distintosPorFrecuencia(valores).slice(0, 12), llenos: llenos, de: n });
        }
      }
      if (g < anclas.length) piezas.push({ texto: caras[g], pega: pegas[g] });
    }

    var salida = '';
    piezas.forEach(function (p, k) {
      if (k > 0 && !p.pega) salida += ' ';
      salida += p.texto;
    });
    salida = salida.trim();
    if (!salida) return null;

    return {
      plantilla: salida,
      anclas: anclas.slice(),
      huecos: huecos,
      encaja: n,
      titulosQueEncajan: alineados.map(function (a) { return a.doc.texto; })
    };
  }

  function esqueletoDeTitulos(titulos) {
    var docs = [], vistos = {};
    (titulos || []).forEach(function (t) {
      if (docs.length >= MAX_TITULOS_ESQUELETO) return;
      var texto = String(t || '').trim();
      var clave = texto.toLowerCase().replace(/\s+/g, ' ');
      if (!clave || vistos[clave]) return;
      vistos[clave] = 1;
      var tk = tokenizar(texto);
      if (tk.length < 3) return;
      docs.push({ texto: texto, tokens: tk, keys: tk.map(function (x) { return x.key; }) });
    });
    if (docs.length < MIN_TITULOS_GRUPO) {
      return { ok: false, motivo: 'muestra_corta', analizados: docs.length };
    }
    var minGrupo = Math.max(MIN_TITULOS_GRUPO, Math.ceil(docs.length * FRACCION_MINIMA));
    var paso = Math.max(1, Math.ceil(docs.length / MAX_SEMILLAS));
    var mejor = null;

    for (var s = 0; s < docs.length; s += paso) {
      var grupo = [s], anclas = docs[s].keys.slice(), libres = [];
      for (var k = 0; k < docs.length; k++) if (k !== s) libres.push(k);
      while (libres.length) {
        var elegido = -1, mejorAnclas = null, mejorPeso = -1;
        for (var c = 0; c < libres.length; c++) {
          var cand = subsecuenciaComun(anclas, docs[libres[c]].keys);
          if (!anclasSirven(cand)) continue;
          var peso = medirAnclas(cand).senal;
          if (peso > mejorPeso) { mejorPeso = peso; elegido = c; mejorAnclas = cand; }
        }
        if (elegido < 0) break;
        anclas = mejorAnclas;
        grupo.push(libres[elegido]);
        libres.splice(elegido, 1);
        if (grupo.length < minGrupo) continue;
        var puntaje = grupo.length * medirAnclas(anclas).senal;
        if (!mejor || puntaje > mejor.puntaje) mejor = { puntaje: puntaje, grupo: grupo.slice(), anclas: anclas.slice() };
      }
    }

    if (!mejor) return { ok: false, motivo: 'sin_esqueleto_repetido', analizados: docs.length };
    var armado = armarPlantilla(docs, mejor.grupo, mejor.anclas);
    if (!armado) return { ok: false, motivo: 'sin_esqueleto_repetido', analizados: docs.length };
    armado.ok = true;
    armado.de = docs.length;
    armado.cobertura = pct(armado.encaja, docs.length);
    return armado;
  }

  function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

  function analyzeTitles(videos) {
    var list = (videos || []).map(getTitle).filter(Boolean);
    var n = list.length;
    if (!n) return { count: 0 };
    var lenSum = 0, capsCount = 0, numCount = 0;
    var numStat = {}, cifraStat = {};
    list.forEach(function (title) {
      lenSum += title.length;
      if (/\d/.test(title)) numCount++;
      var letters = title.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '');
      var caps = title.replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
      if (letters.length >= 6 && caps.length / letters.length > 0.6) capsCount++;
      (title.match(/\b([1-9]|[1-4]\d|50)\b/g) || []).forEach(function (d) { numStat[d] = (numStat[d] || 0) + 1; });
      (title.match(/[$€£]\s?\d[\d.,]*\s?[kmb]?|\b\d+\s?%/gi) || []).forEach(function (cc) { var k = cc.replace(/\s+/g, ''); cifraStat[k] = (cifraStat[k] || 0) + 1; });
    });
    var topWords = palabrasDestacadas(list);
    var esq = esqueletoDeTitulos(list);
    var ejemplos = (esq && esq.ok) ? esq.titulosQueEncajan.slice(0, 3) : list.slice(0, 3);
    return {
      count: n,
      avgLen: Math.round(lenSum / n),
      conNumero: pct(numCount, n),
      conCaps: pct(capsCount, n),
      palabrasRepetidas: topWords,
      esqueleto: esq,
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
    if (rows.length < 4) return { count: 0, motivo: 'too few rows carry a metric' };
    var med = median(rows.map(function (r) { return r.metric; }));
    if (!med) return { count: 0, motivo: 'median is zero' };
    var threshold = med * 3;
    var outliers = rows.filter(function (r) { return r.metric >= threshold; })
      .sort(function (a, b) { return b.metric - a.metric; });
    if (!outliers.length) {
      var sorted = rows.slice().sort(function (a, b) { return b.metric - a.metric; });
      outliers = sorted.slice(0, Math.max(1, Math.round(rows.length * 0.2)));
      threshold = outliers.length ? outliers[outliers.length - 1].metric : med;
    }
    var rest = rows.filter(function (r) { return outliers.indexOf(r) < 0; });
    var aperturas = {};
    outliers.forEach(function (r) {
      var ap = String(r.title).trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      if (ap) aperturas[ap] = (aperturas[ap] || 0) + 1;
    });
    var topOutWords = palabrasQueDestacanEnOutliers(
      outliers.map(function (r) { return r.title; }),
      rest.map(function (r) { return r.title; })
    );
    return {
      count: outliers.length,
      medianaMetric: Math.round(med),
      umbral: Math.round(threshold),
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
    if (!t.count) return { ok: false, texto: 'No videos to analyze.', nota: 'No videos to analyze yet.' };
    var esq = t.esqueleto || { ok: false, motivo: 'sin_esqueleto_repetido' };
    var nombre = nicho ? String(nicho) : 'this niche';
    if (!esq.ok) {
      var faltan = esq.motivo === 'muestra_corta';
      return {
        ok: false,
        titulos: t,
        outliers: o,
        canales: c,
        esqueleto: esq,
        texto: faltan
          ? ('Only ' + (esq.analizados || 0) + ' distinct titles of ' + nombre + ' were read, and a repeated skeleton needs at least ' + MIN_TITULOS_GRUPO + '.')
          : ('The ' + (esq.analizados || t.count) + ' titles of ' + nombre + ' share no repeated skeleton, so there is no template to pull out of their data.'),
        nota: faltan
          ? ('Only ' + (esq.analizados || 0) + ' distinct title' + ((esq.analizados === 1) ? '' : 's') + ' read so far. A repeated skeleton needs at least ' + MIN_TITULOS_GRUPO + '.')
          : ('No repeated title skeleton across these ' + (esq.analizados || t.count) + ' titles. Nothing to template, the winning titles below are the evidence.')
      };
    }
    var L = [];
    L.push('REVERSE ENGINEERING OF ' + nombre.toUpperCase() + ' (' + t.count + ' real videos from the scan):');
    L.push('- Average length ' + t.avgLen + ' characters; ' + t.conNumero + '% use a number, ' + t.conCaps + '% lean on capitals.');
    if (t.palabrasRepetidas.length) {
      L.push('- Words these titles repeat: ' + t.palabrasRepetidas.slice(0, 8).map(function (w) { return w.palabra + ' (' + w.pct + '% of the titles)'; }).join(', ') + '.');
    }
    if (o.count) {
      if (o.palabrasQueExplotan.length) {
        L.push('- Words inside the outliers: ' + o.palabrasQueExplotan.slice(0, 6).map(function (w) { return w.palabra; }).join(', ') + '.');
      }
      if (o.aperturasOutliers && o.aperturasOutliers.length) {
        L.push('- How the outliers OPEN (hook up front, first 2 words): ' + o.aperturasOutliers.map(function (a) { return '"' + a.apertura + '"'; }).join(', ') + '.');
      }
      if (o.ejemplos.length) {
        L.push('- Real titles that took off: ' + o.ejemplos.map(function (e) { return '"' + e.titulo + '"'; }).join(' | ') + '.');
      }
    }
    if (c.dominantes && c.dominantes.length) {
      L.push('- CHANNELS that own this niche (study their best video, then beat it): ' + c.dominantes.slice(0, 4).map(function (x) { return x.canal + ' (' + x.videos + ' in the scan, best: "' + x.mejorTitulo + '")'; }).join(' | ') + '.');
    }
    if (t.numerosComunes && t.numerosComunes.length) {
      L.push('- Numbers used most: ' + t.numerosComunes.map(function (x) { return x.num; }).join(', ') + (t.cifrasComunes && t.cifrasComunes.length ? ' | figures: ' + t.cifrasComunes.map(function (x) { return x.cifra; }).join(', ') : '') + '.');
    }
    L.push('- TEMPLATE derived from these titles, it fits ' + esq.encaja + ' of the ' + esq.de + ' read (' + esq.cobertura + '%): ' + esq.plantilla);
    if (esq.huecos.length) {
      L.push('- What changes in each slot: ' + esq.huecos.map(function (h) {
        return '{' + h.nombre + '} = ' + h.valores.slice(0, 4).join(', ');
      }).join(' | ') + '.');
    }
    L.push('- Real titles the template came from: ' + esq.titulosQueEncajan.slice(0, 4).map(function (x) { return '"' + x + '"'; }).join(' | ') + '.');
    return {
      ok: true,
      titulos: t,
      outliers: o,
      canales: c,
      esqueleto: esq,
      plantilla: esq.plantilla,
      encaja: esq.encaja,
      de: esq.de,
      cobertura: esq.cobertura,
      huecos: esq.huecos,
      titulosQueEncajan: esq.titulosQueEncajan,
      texto: L.join('\n')
    };
  }

  root.NSP_REVERSE_ENGINE = {
    version: '2.3.0',
    tokenizar: tokenizar,
    esqueletoDeTitulos: esqueletoDeTitulos,
    analyzeTitles: analyzeTitles,
    findOutliers: findOutliers,
    analyzeChannels: analyzeChannels,
    buildReport: buildReport
  };
})();
