(function (raiz) {
  'use strict';

  var MEDICION = {
    fuente: 'the owner\'s radar sweeps, radar_feed.json',
    fecha: '2026-08-30',
    canalesMirados: 149,
    canalesConDuelo: 143,
    videos: 804,
    miniaturasLeidas: 767,
    sinMaxres: 37,
    sobresalientes: 177,
    normales: 419,
    duelos: 588,
    propiedades: 20,
    barajadas: 4000,
    mayorSeparacion: 0.065,
    pFamiliar: 0.43,
    sueloDeteccion: '+4 luma planted on the winners, an eighth of a standard deviation, comes out at p=0.0007'
  };

  var HECHOS = [
    { codigo: 'contraste', tasa: 0.476, p: 0.471, dice: 'More contrast won 47.6% of 588 same channel duels. Chance is 50%.' },
    { codigo: 'saturacion', tasa: 0.437, p: 0.047, dice: 'More saturation won 43.7% of 588 duels, so the colorful one lost slightly more often than it won. Not separable from chance once 20 properties are counted.' },
    { codigo: 'brillo', tasa: 0.556, p: 0.078, dice: 'The brighter thumbnail won 55.6% of 588 duels. Not separable from chance.' },
    { codigo: 'rango', tasa: 0.513, p: 0.669, dice: 'A wider black to white range won 51.3% of 588 duels.' },
    { codigo: 'carga', tasa: 0.509, p: 0.821, dice: 'More edge energy, what the engine calls clutter, won 50.9% of 588 duels.' },
    { codigo: 'retencion_feed', tasa: 0.457, p: 0.189, dice: 'Keeping more detail at feed size won 45.7% of 588 duels.' },
    { codigo: 'contraste_feed', tasa: 0.485, p: 0.629, dice: 'More contrast once shrunk to feed size won 48.5% of 588 duels.' },
    { codigo: 'bandas_texto', tasa: 0.560, p: 0.045, dice: 'Having more dense stroke bands, which is text or a logo, won 56.0% of 588 duels. It is the widest gap of the 20 and it still does not clear chance once all 20 are counted.' },
    { codigo: 'cobertura_texto', tasa: 0.513, p: 0.701, dice: 'Covering more of the frame with stroke bands won 51.3% of 588 duels.' },
    { codigo: 'texto_grande', tasa: 0.509, p: 0.774, dice: 'A taller stroke band at feed size won 50.9% of 588 duels.' },
    { codigo: 'saturacion_paleta', tasa: 0.435, p: 0.040, dice: 'The more saturated palette won 43.5% of 588 duels, the same direction as raw saturation and the same non result.' },
    { codigo: 'contraste_paleta', tasa: 0.471, p: 0.367, dice: 'The higher contrast palette won 47.1% of 588 duels.' },
    { codigo: 'nota', tasa: 0.474, p: 0.422, dice: 'The thumbnail with the higher engine score won 47.4% of 588 duels. The score does not tell you which video beat its own channel.' },
    { codigo: 'color_calido', tasa: 0.514, p: 0.623, dice: 'More red, orange and yellow won 51.4% of 588 duels.' },
    { codigo: 'color_frio', tasa: 0.507, p: 0.815, dice: 'More blue and cyan won 50.7% of 588 duels.' },
    { codigo: 'piel', tasa: 0.481, p: 0.577, dice: 'More skin toned pixels won 48.1% of 588 duels. 71.2% of the winners carried skin tone against 72.6% of the ones that did not take off.' },
    { codigo: 'piel_centro', tasa: 0.506, p: 0.864, dice: 'More skin tone inside the central area won 50.6% of 588 duels.' },
    { codigo: 'aislamiento', tasa: 0.509, p: 0.808, dice: 'A subject that stands out from its frame, measured as center contrast minus border contrast, won 50.9% of 588 duels.' },
    { codigo: 'contraste_centro', tasa: 0.527, p: 0.402, dice: 'More contrast inside the central area won 52.7% of 588 duels.' },
    { codigo: 'centro_claro', tasa: 0.517, p: 0.615, dice: 'A center brighter than the frame won 51.7% of 588 duels.' }
  ];

  var NO_MEDIDO = [
    { codigo: 'cara', razon: 'No face detector was run over this sample: the face engine needs a browser and this was measured offline. What was measured is skin toned pixels, which is not the same thing. Whether a real face separates a winner is still unknown.' },
    { codigo: 'ctr', razon: 'Click through rate is not public. Nothing here measures it, and no number in this module should be read as one.' },
    { codigo: 'texto_legible', razon: 'The engine measures dense stroke bands, not whether the words can be read. Legibility was never measured.' },
    { codigo: 'emocion', razon: 'What the image is about, who is in it and what it promises were not measured. Only pixels were.' },
    { codigo: 'estilo', razon: 'Whether a thumbnail looks hand made or generated was not measured.' }
  ];

  var CONFUSORES = [
    { codigo: 'edad_de_observacion', dice: 'In 63.9% of the duels the winner was first seen earlier than the video it was compared against, so part of the gap is accumulated time, not the thumbnail. Repeating the test on the 124 duels seen within 7 days of each other still finds nothing.' },
    { codigo: 'maxres', dice: 'maxresdefault was missing for 4.8% of the winners and 2.9% of the rest, out of 804 videos. Thumbnail resolution does not separate them either.' }
  ];

  var AGRUPACION = {
    grupos: 'market (8 groups, 705 videos) and area (10 groups, 758 videos)',
    dice: 'Grouping by market or by area does not tighten any of the 10 properties beyond what a same sized random group of channels gives. There is no measured house style to obey.'
  };

  var REPARTO = [
    { codigo: 'contraste', etiqueta: 'Contrast', p10: 51.6, mediana: 63.7, p90: 76.0 },
    { codigo: 'saturacion', etiqueta: 'Saturation', p10: 28.0, mediana: 41.9, p90: 61.9, sufijo: '%' },
    { codigo: 'brillo', etiqueta: 'Brightness', p10: 54.0, mediana: 94.6, p90: 119.2 },
    { codigo: 'carga', etiqueta: 'Edge energy', p10: 29.4, mediana: 43.9, p90: 67.7 },
    { codigo: 'retencion_feed', etiqueta: 'Detail kept at feed size', p10: 0.46, mediana: 0.54, p90: 0.64 },
    { codigo: 'cobertura_texto', etiqueta: 'Frame covered by stroke bands', p10: 7.0, mediana: 31.1, p90: 63.7, sufijo: '%' },
    { codigo: 'texto_grande', etiqueta: 'Tallest stroke band at feed size', p10: 4.9, mediana: 12.9, p90: 21.6, sufijo: ' px' },
    { codigo: 'piel', etiqueta: 'Skin toned pixels', p10: 1.9, mediana: 17.0, p90: 31.9, sufijo: '%' },
    { codigo: 'nota', etiqueta: 'Engine score', p10: 65, mediana: 70.5, p90: 75 }
  ];

  var AVISO = 'Measured on your own sweeps: across 588 duels between videos of the same channel, none of 20 measured properties separates the one that beat the channel from the one that did not. These are thumbnails to look at, not a rule to copy.';

  function porCodigo(lista, codigo) {
    for (var i = 0; i < lista.length; i++) if (lista[i].codigo === codigo) return lista[i];
    return null;
  }

  function veredictoDe(codigo) {
    var h = porCodigo(HECHOS, codigo);
    if (h) {
      return {
        estado: 'medido_no_separa', codigo: codigo, tasa: h.tasa, p: h.p,
        duelos: MEDICION.duelos, dice: h.dice
      };
    }
    var n = porCodigo(NO_MEDIDO, codigo);
    if (n) return { estado: 'no_medido', codigo: codigo, dice: n.razon };
    return {
      estado: 'fuera_de_la_tabla', codigo: codigo,
      dice: 'This claim was never put to the sweep data, so there is no number behind it either way.'
    };
  }

  var MIN_VIDEOS_CANAL = 5;
  var SALTO = 2.5;

  function minimoEjemplos() {
    var C = raiz.NspMiniaturaCohorte || (typeof NspMiniaturaCohorte !== 'undefined' ? NspMiniaturaCohorte : null);
    return C && C.MINIMO ? C.MINIMO : 8;
  }

  function url(id) {
    var C = raiz.NspMiniaturaCohorte || (typeof NspMiniaturaCohorte !== 'undefined' ? NspMiniaturaCohorte : null);
    if (C && C.urlMiniatura) return C.urlMiniatura(id);
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(String(id || '')) + '/maxresdefault.jpg';
  }

  function mediana(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; });
    if (!s.length) return 0;
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function numero(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0; }

  function apunta(mapa, canalId, canal, v, cuenta, extra) {
    var id = v && (v.id || v.videoId);
    var vistas = numero(v && (v.views !== undefined ? v.views : v.vistas));
    if (!canalId || !id || !vistas) return;
    cuenta.leidos++;
    var c = mapa[canalId] || (mapa[canalId] = { canal: canal || '', videos: {} });
    if (canal && !c.canal) c.canal = canal;
    var prev = c.videos[id];
    if (!prev) {
      prev = c.videos[id] = { id: id, titulo: v.title || v.titulo || '', vistas: vistas };
      cuenta.videos++;
    } else if (vistas > prev.vistas) prev.vistas = vistas;
    if (extra) {
      for (var k in extra) if (extra[k] && !prev[k]) prev[k] = extra[k];
    }
  }

  function sobresalientesDe(feed, opciones) {
    opciones = opciones || {};
    var historia = feed && (feed.history || feed.historia);
    if (!historia || !historia.length) {
      return { ok: false, motivo: 'sin_feed', razon: 'The sweep feed could not be read, so no channel catalog is available.' };
    }
    var mapa = {};
    var ramas = { cohetes: 0, candidatos: 0, casi: 0, agg: 0 };
    var cuenta = { leidos: 0, videos: 0 };
    for (var d = 0; d < historia.length; d++) {
      var e = historia[d] || {};
      var lista = e.cohetes || [];
      var i, j, c, vids, v;
      for (i = 0; i < lista.length; i++) {
        c = lista[i] || {};
        vids = ((c.auditoria || {}).videos || []).concat(c.videos || []);
        for (j = 0; j < vids.length; j++) { apunta(mapa, c.chId || c.ch, c.ch, vids[j], cuenta, null); ramas.cohetes++; }
      }
      lista = e.candidatos || [];
      for (i = 0; i < lista.length; i++) {
        c = lista[i] || {};
        vids = c.videos || [];
        for (j = 0; j < vids.length; j++) { apunta(mapa, c.chId || c.ch, c.ch, vids[j], cuenta, { vertical: c.vertical }); ramas.candidatos++; }
      }
      lista = e.casi || [];
      for (i = 0; i < lista.length; i++) {
        c = lista[i] || {};
        vids = (c.evidenciaCasi || {}).videos || [];
        for (j = 0; j < vids.length; j++) {
          v = vids[j] || {};
          apunta(mapa, v.chId, '', v, cuenta, { mercado: c.market, tema: c.topic });
          ramas.casi++;
        }
      }
      var agg = e.agg || {};
      for (var tema in agg) {
        if (!Object.prototype.hasOwnProperty.call(agg, tema)) continue;
        var t = agg[tema];
        if (!t || typeof t !== 'object') continue;
        var mercado = tema.indexOf(':') > 0 ? tema.split(':')[0] : '';
        var cans = t.canales || [];
        for (i = 0; i < cans.length; i++) {
          c = cans[i] || {};
          apunta(mapa, c.chId, c.ch, c, cuenta, { mercado: mercado, tema: tema });
          ramas.agg++;
        }
        if (t.top && typeof t.top === 'object') {
          apunta(mapa, t.top.chId, t.top.ch, t.top, cuenta, { mercado: mercado, tema: tema });
          ramas.agg++;
        }
      }
    }
    if (!cuenta.leidos) {
      return {
        ok: false, motivo: 'feed_desconocido', ramas: ramas,
        razon: 'The feed was read but not one video with a channel and a view count came out of it, so its shape is not the one this module knows.'
      };
    }
    var minVideos = opciones.minVideos || MIN_VIDEOS_CANAL;
    var salto = opciones.salto || SALTO;
    var fuera = [];
    var canales = 0;
    for (var chId in mapa) {
      if (!Object.prototype.hasOwnProperty.call(mapa, chId)) continue;
      var canal = mapa[chId];
      var todos = [];
      for (var vid in canal.videos) if (Object.prototype.hasOwnProperty.call(canal.videos, vid)) todos.push(canal.videos[vid]);
      if (todos.length < minVideos) continue;
      canales++;
      var med = mediana(todos.map(function (x) { return x.vistas; }));
      if (med <= 0) continue;
      for (var k = 0; k < todos.length; k++) {
        var razon = todos[k].vistas / med;
        if (razon < salto) continue;
        fuera.push({
          id: todos[k].id, titulo: todos[k].titulo, canal: canal.canal, canalId: chId,
          vistas: todos[k].vistas, medianaCanal: med, razon: Math.round(razon * 10) / 10,
          mercado: todos[k].mercado || '', tema: todos[k].tema || '',
          videosDelCanal: todos.length, url: url(todos[k].id)
        });
      }
    }
    fuera.sort(function (a, b) { return b.razon - a.razon; });
    return {
      ok: true, videos: fuera, canales: canales, videosLeidos: cuenta.videos, ramas: ramas,
      minVideos: minVideos, salto: salto,
      dice: fuera.length + ' video' + (fuera.length === 1 ? '' : 's') + ' beat the median of its own channel by ' + salto
        + 'x or more, out of ' + canales + ' channels with at least ' + minVideos + ' videos seen.'
    };
  }

  function nombreArea(area) {
    var A = raiz.NspAreas || (typeof NspAreas !== 'undefined' ? NspAreas : null);
    return A && typeof A.nombreDe === 'function' ? A.nombreDe(area) : String(area || '');
  }

  function areaDe(txt, opciones) {
    if (opciones && typeof opciones.areaDe === 'function') return opciones.areaDe(txt);
    var A = raiz.NspAreas || (typeof NspAreas !== 'undefined' ? NspAreas : null);
    return A && A.areaDe ? A.areaDe(txt || '') : 'otros';
  }

  function paraNicho(contexto, feed, opciones) {
    contexto = contexto || {};
    opciones = opciones || {};
    var todo = opciones.sobresalientes || sobresalientesDe(feed, opciones);
    if (!todo.ok) return todo;
    var minimo = opciones.minimo || minimoEjemplos();
    if (todo.videos.length < minimo) {
      return {
        ok: false, motivo: 'sin_casos', encontrados: todo.videos.length, minimo: minimo,
        razon: 'Only ' + todo.videos.length + ' video' + (todo.videos.length === 1 ? '' : 's')
          + ' in the whole sweep beat its own channel by ' + todo.salto + 'x. ' + minimo + ' are needed before showing anything as an example.'
      };
    }
    var miArea = areaDe(contexto.titulo || '', opciones);
    var intentos = [];
    var alcances = [
      { clave: 'tema', etiqueta: contexto.tema || '', filtro: function (v) { return contexto.tema && v.tema === contexto.tema; } },
      { clave: 'area', etiqueta: miArea, filtro: function (v) { return miArea !== 'otros' && areaDe(v.titulo, opciones) === miArea; } },
      { clave: 'mercado', etiqueta: contexto.mercado || '', filtro: function (v) { return contexto.mercado && v.mercado === contexto.mercado; } }
    ];
    var elegido = null;
    for (var i = 0; i < alcances.length; i++) {
      var a = alcances[i];
      var vs = a.etiqueta ? todo.videos.filter(a.filtro) : [];
      intentos.push({ clave: a.clave, etiqueta: a.etiqueta || null, encontrados: vs.length });
      if (!elegido && vs.length >= minimo) elegido = { clave: a.clave, etiqueta: a.etiqueta, videos: vs };
    }
    if (!elegido) {
      return {
        ok: false, motivo: 'nicho_sin_medir', intentos: intentos, minimo: minimo, fondo: todo.videos.length,
        razon: 'There are ' + todo.videos.length + ' videos in the sweep that beat their own channel, but not ' + minimo
          + ' of them in this niche, so nothing can be said about this niche in particular.'
      };
    }
    var ejemplos = elegido.videos.slice(0, opciones.tope || 12);
    return {
      ok: true,
      alcance: elegido.clave,
      etiqueta: elegido.etiqueta,
      ejemplos: ejemplos,
      total: elegido.videos.length,
      intentos: intentos,
      aviso: AVISO,
      dice: ejemplos.length + ' thumbnails from your ' + (elegido.clave === 'tema' ? 'topic, ' : elegido.clave === 'area' ? 'area, ' : 'market, ')
        + (elegido.clave === 'area' ? nombreArea(elegido.etiqueta) : elegido.etiqueta) + '. Every one of them beat the median of its own channel by ' + todo.salto
        + 'x or more, so the channel, the niche and the voice are held still and only the video changes.'
    };
  }

  function perfilDe(medidas, opciones) {
    opciones = opciones || {};
    var buenas = (medidas || []).filter(function (m) { return m && typeof m === 'object'; });
    var minimo = opciones.minimo || minimoEjemplos();
    if (buenas.length < minimo) {
      return {
        ok: false, motivo: 'pocos_medidos', medidos: buenas.length, minimo: minimo,
        razon: 'Only ' + buenas.length + ' of these thumbnails could be measured. ' + minimo + ' are needed before describing a niche.'
      };
    }
    var filas = [];
    for (var i = 0; i < REPARTO.length; i++) {
      var r = REPARTO[i];
      var xs = [];
      for (var j = 0; j < buenas.length; j++) {
        var v = buenas[j][r.codigo];
        if (typeof v === 'number' && isFinite(v)) xs.push(v);
      }
      if (xs.length < minimo) continue;
      var s = xs.slice().sort(function (a, b) { return a - b; });
      var h = porCodigo(HECHOS, r.codigo);
      filas.push({
        codigo: r.codigo, etiqueta: r.etiqueta, sufijo: r.sufijo || '',
        medidos: xs.length,
        p10: s[Math.floor(0.1 * (s.length - 1))],
        mediana: mediana(xs),
        p90: s[Math.floor(0.9 * (s.length - 1))],
        barridoMediana: r.mediana,
        estado: 'descriptivo',
        predice: false,
        porQue: h ? h.dice : 'This property was not put to the duel test.'
      });
    }
    return {
      ok: true, medidos: buenas.length, filas: filas, aviso: AVISO,
      dice: 'What these ' + buenas.length + ' thumbnails look like, next to the ' + MEDICION.miniaturasLeidas
        + ' measured across the sweep. This is a description of the niche, not a target: grouping by market or by area was measured and does not tighten any of these.'
    };
  }

  raiz.NspMiniaturaMercado = {
    MEDICION: MEDICION,
    HECHOS: HECHOS,
    NO_MEDIDO: NO_MEDIDO,
    CONFUSORES: CONFUSORES,
    AGRUPACION: AGRUPACION,
    REPARTO: REPARTO,
    AVISO: AVISO,
    MIN_VIDEOS_CANAL: MIN_VIDEOS_CANAL,
    SALTO: SALTO,
    minimoEjemplos: minimoEjemplos,
    veredictoDe: veredictoDe,
    sobresalientesDe: sobresalientesDe,
    paraNicho: paraNicho,
    perfilDe: perfilDe
  };
})(typeof self !== 'undefined' ? self : this);
