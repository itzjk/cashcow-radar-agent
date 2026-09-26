(function (raiz) {
  'use strict';

  var MINIMO = 8;
  var TOPE = 16;

  function urlMiniatura(id, grande) {
    id = String(id || '').trim();
    if (!id) return '';
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/' + (grande === false ? 'mqdefault' : 'maxresdefault') + '.jpg';
  }

  function areasDe(opciones) {
    if (opciones && typeof opciones.areaDe === 'function') return opciones.areaDe;
    var A = raiz.NspAreas || (typeof NspAreas !== 'undefined' ? NspAreas : null);
    return A && typeof A.areaDe === 'function' ? A.areaDe : null;
  }

  function nombreArea(area) {
    var A = raiz.NspAreas || (typeof NspAreas !== 'undefined' ? NspAreas : null);
    return A && typeof A.nombreDe === 'function' ? A.nombreDe(area) : String(area || '');
  }

  function listaDe(indice) {
    var out = [];
    var por = indice && indice.por;
    if (!por) return out;
    for (var id in por) {
      if (!Object.prototype.hasOwnProperty.call(por, id)) continue;
      var v = por[id];
      out.push({ id: id, titulo: v.titulo || '', canal: v.canal || '', vph: Number(v.vph) || 0,
                 vistas: Number(v.vistas) || 0, mercado: v.mercado || '', lista: v.lista || '' });
    }
    return out;
  }

  function porVph(a, b) { return b.vph - a.vph; }

  function cohorteDe(indice, titulo, opciones) {
    opciones = opciones || {};
    if (!indice || !indice.por) {
      return { ok: false, motivo: 'sin_indice', razon: 'The sweep index could not be read, so there is nothing to compare against.' };
    }
    var areaDe = areasDe(opciones);
    if (!areaDe) {
      return { ok: false, motivo: 'sin_areas', razon: 'The area table is not loaded on this page.' };
    }
    var todos = listaDe(indice).filter(function (v) { return v.id !== opciones.excluir; });
    var area = areaDe(titulo || '');
    var porArea = area === 'otros' ? [] : todos.filter(function (v) { return areaDe(v.titulo) === area; });
    var mercado = opciones.mercado || '';
    var porMercado = mercado ? todos.filter(function (v) { return v.mercado === mercado; }) : [];
    var intentos = [
      { clave: 'area', etiqueta: area, encontrados: porArea.length },
      { clave: 'mercado', etiqueta: mercado || null, encontrados: porMercado.length }
    ];

    var elegida = null;
    if (porArea.length >= MINIMO) elegida = { clave: 'area', etiqueta: area, videos: porArea };
    else if (porMercado.length >= MINIMO) elegida = { clave: 'mercado', etiqueta: mercado, videos: porMercado };

    if (!elegida) {
      return {
        ok: false, motivo: 'cohorte_corta', intentos: intentos, minimo: MINIMO, fondo: todos.length,
        razon: 'Not enough winners to compare against: the ' + (area === 'otros' ? 'area is not one the table names' : 'area "' + nombreArea(area) + '" has ' + porArea.length)
          + (mercado ? ' and market ' + mercado + ' has ' + porMercado.length : '')
          + '. ' + MINIMO + ' are needed, out of the ' + todos.length + ' videos in the sweep.'
      };
    }

    var videos = elegida.videos.slice().sort(porVph).slice(0, TOPE);
    return {
      ok: true,
      clave: elegida.clave,
      etiqueta: elegida.etiqueta,
      videos: videos,
      total: elegida.videos.length,
      intentos: intentos,
      dice: videos.length + ' real winners from your ' + (elegida.clave === 'area' ? 'area, ' + nombreArea(elegida.etiqueta) : 'market, ' + elegida.etiqueta)
        + ', out of ' + elegida.videos.length + ' in the sweep, sorted by views per hour.'
    };
  }

  function percentil(valor, valores) {
    var xs = (valores || []).filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (!xs.length) return { ok: false, motivo: 'sin_muestra', razon: 'No winner was measured, so there is no distribution to place this in.' };
    var debajo = xs.filter(function (v) { return v < valor; }).length;
    return { ok: true, porDebajo: debajo, de: xs.length, pct: Math.round(debajo / xs.length * 100) };
  }

  function mediana(xs) {
    var s = (xs || []).slice().sort(function (a, b) { return a - b; });
    if (!s.length) return 0;
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  var METRICAS = [
    { clave: 'contraste', etiqueta: 'Contrast', saca: function (x) { return x.medidas.stdL; }, decimales: 0 },
    { clave: 'saturacion', etiqueta: 'Saturation', saca: function (x) { return x.medidas.meanSat * 100; }, decimales: 0, sufijo: '%' },
    { clave: 'luma', etiqueta: 'Brightness', saca: function (x) { return x.medidas.meanL; }, decimales: 0 },
    { clave: 'retencion', etiqueta: 'Detail kept at feed size', saca: function (x) { return x.feed.retencion * 100; }, decimales: 0, sufijo: '%' },
    { clave: 'contrasteFeed', etiqueta: 'Contrast at feed size', saca: function (x) { return x.feed.contrasteFeed; }, decimales: 0 },
    { clave: 'trazo', etiqueta: 'Tallest stroke band at feed size', saca: function (x) { return x.trazo.altoFeedMax; }, decimales: 1, sufijo: ' px' }
  ];

  function redondear(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }

  function comparar(mia, ganadores) {
    if (!mia || !mia.medidas) return { ok: false, motivo: 'sin_medida', razon: 'The thumbnail was not measured.' };
    var buenos = (ganadores || []).filter(function (g) { return g && g.medidas && g.feed && g.trazo; });
    if (buenos.length < MINIMO) {
      return { ok: false, motivo: 'pocos_medidos', medidos: buenos.length, minimo: MINIMO,
               razon: 'Only ' + buenos.length + ' winner thumbnails could be measured. ' + MINIMO + ' are needed before placing yours in the distribution.' };
    }
    var filas = METRICAS.map(function (m) {
      var valores = buenos.map(m.saca);
      var mio = m.saca(mia);
      var p = percentil(mio, valores);
      var med = mediana(valores);
      return {
        clave: m.clave, etiqueta: m.etiqueta,
        valor: redondear(mio, m.decimales), mediana: redondear(med, m.decimales),
        sufijo: m.sufijo || '', porDebajo: p.porDebajo, de: p.de,
        dice: 'Yours ' + redondear(mio, m.decimales) + (m.sufijo || '') + ', above ' + p.porDebajo + ' of ' + p.de
          + ' winners, their median ' + redondear(med, m.decimales) + (m.sufijo || '') + '.'
      };
    });
    return { ok: true, medidos: buenos.length, filas: filas };
  }

  var PRESENCIA = 0.5;
  var PESO_CUENTA = 8;

  function paletaComun(ganadores) {
    var paletas = (ganadores || []).map(function (g) { return g && g.paleta; }).filter(function (p) { return p && p.tonos; });
    if (paletas.length < MINIMO) {
      return { ok: false, motivo: 'pocos_medidos', medidos: paletas.length, minimo: MINIMO,
               razon: 'Only ' + paletas.length + ' winner palettes could be read. ' + MINIMO + ' are needed before calling anything shared.' };
    }
    var n = paletas[0].tonos.length;
    var tonos = [];
    for (var t = 0; t < n; t++) {
      var pesos = paletas.map(function (p) { return (p.tonos[t] || {}).peso || 0; });
      var presentes = pesos.filter(function (w) { return w >= PESO_CUENTA; }).length;
      tonos.push({
        tono: t, grado: paletas[0].tonos[t].grado,
        presencia: Math.round(presentes / paletas.length * 100),
        pesoMediano: Math.round(mediana(pesos) * 10) / 10
      });
    }
    var compartidos = tonos.filter(function (x) { return x.presencia >= PRESENCIA * 100; })
      .sort(function (a, b) { return b.presencia - a.presencia; });
    return {
      ok: true, medidos: paletas.length, tonos: tonos, compartidos: compartidos,
      saturacion: Math.round(mediana(paletas.map(function (p) { return p.saturacion; })) * 10) / 10,
      luma: Math.round(mediana(paletas.map(function (p) { return p.luma; })) * 10) / 10,
      contraste: Math.round(mediana(paletas.map(function (p) { return p.contraste; })) * 10) / 10,
      dice: compartidos.length
        ? compartidos.length + ' hue band' + (compartidos.length > 1 ? 's are' : ' is') + ' present in at least half of these ' + paletas.length + ' winners.'
        : 'No hue band shows up in half of these ' + paletas.length + ' winners, so this area does not share a palette.'
    };
  }

  function brechaDePaleta(mia, comun) {
    if (!mia || !comun || !comun.ok) return { ok: false, motivo: 'sin_comun', razon: 'There is no shared palette to measure a gap against.' };
    var faltan = comun.compartidos.filter(function (c) {
      var m = mia.tonos[c.tono];
      return !m || m.peso < PESO_CUENTA;
    });
    return {
      ok: true,
      faltan: faltan,
      saturacion: Math.round((mia.saturacion - comun.saturacion) * 10) / 10,
      luma: Math.round((mia.luma - comun.luma) * 10) / 10,
      contraste: Math.round((mia.contraste - comun.contraste) * 10) / 10,
      dice: faltan.length
        ? faltan.length + ' of the ' + comun.compartidos.length + ' hue bands these winners share are missing from yours.'
        : 'Your thumbnail carries every hue band these winners share.'
    };
  }

  raiz.NspMiniaturaCohorte = {
    MINIMO: MINIMO,
    TOPE: TOPE,
    PESO_CUENTA: PESO_CUENTA,
    METRICAS: METRICAS,
    urlMiniatura: urlMiniatura,
    cohorteDe: cohorteDe,
    percentil: percentil,
    mediana: mediana,
    comparar: comparar,
    paletaComun: paletaComun,
    brechaDePaleta: brechaDePaleta
  };
})(typeof self !== 'undefined' ? self : this);
