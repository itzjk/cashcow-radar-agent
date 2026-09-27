(function (raiz) {
  'use strict';

  var VENTANA = 12;
  var DIAS_MADURO = 7;
  var VERDE = 6;
  var ROJO = 20;
  var MIN_VEREDICTO = 6;
  var MIN_HUECOS = 2;
  var ERROR_MAX = 0.4;
  var DIA = 86400000;

  function diasDe(txt) {
    var t = String(txt || '').toLowerCase();
    var m = t.match(/(\d+)\s*(d[ií]a|semana|mes|a[nñ]o|day|week|month|year|hora|hour|minut)/);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    var u = m[2];
    if (u.indexOf('minut') === 0 || u.indexOf('hor') === 0 || u.indexOf('hour') === 0) return 0;
    if (u.indexOf('d') === 0 || u.indexOf('day') === 0) return n;
    if (u.indexOf('sem') === 0 || u.indexOf('week') === 0) return n * 7;
    if (u.indexOf('mes') === 0 || u.indexOf('month') === 0) return n * 30;
    return n * 365;
  }

  function resolucionDe(txt) {
    var t = String(txt || '').toLowerCase();
    var m = t.match(/(\d+)\s*(d[ií]a|semana|mes|a[nñ]o|day|week|month|year|hora|hour|minut)/);
    if (!m) return null;
    var u = m[2];
    if (u.indexOf('minut') === 0 || u.indexOf('hor') === 0 || u.indexOf('hour') === 0) return 1 / 24;
    if (u.indexOf('d') === 0 || u.indexOf('day') === 0) return 1;
    if (u.indexOf('sem') === 0 || u.indexOf('week') === 0) return 7;
    if (u.indexOf('mes') === 0 || u.indexOf('month') === 0) return 30;
    return 365;
  }

  function mediana(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  function huecos(dias) {
    var edades = (dias || []).filter(function (d) { return typeof d === 'number' && isFinite(d); }).sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 1; i < edades.length; i++) out.push(edades[i] - edades[i - 1]);
    return { huecos: out, cadenciaDias: out.length ? mediana(out) : null };
  }

  function ritmo(ventana) {
    var huecosFinos = [];
    for (var i = 1; i < ventana.length; i++) {
      var a = ventana[i - 1], b = ventana[i];
      if (a.dias == null || b.dias == null || a.res > 1 || b.res > 1) continue;
      huecosFinos.push(Math.max(0, b.dias - a.dias));
    }
    if (huecosFinos.length >= MIN_HUECOS) {
      return { dias: Math.round(mediana(huecosFinos) * 10) / 10, metodo: 'exacto', razon: 'Median gap between ' + (huecosFinos.length + 1) + ' uploads with an exact date.' };
    }
    var fechados = ventana.filter(function (v) { return v.dias != null; });
    if (fechados.length >= 4) {
      var nuevo = fechados[0], viejo = fechados[fechados.length - 1];
      var tramo = viejo.dias - nuevo.dias;
      var error = (viejo.res || 0) + (nuevo.res || 0);
      if (tramo > 0 && error <= tramo * ERROR_MAX) {
        return { dias: Math.round(tramo / (fechados.length - 1) * 10) / 10, metodo: 'tramo', razon: fechados.length + ' uploads over about ' + Math.round(tramo) + ' days, read from the dates YouTube shows.' };
      }
    }
    return { dias: null, metodo: 'sin_medir', razon: 'The dates YouTube shows ("2 months ago", "1 year ago") are too coarse to time the gaps between these uploads, and too few exact times came back.' };
  }

  function medir(videos, opciones) {
    opciones = opciones || {};
    var ahora = Number(opciones.now) || Date.now();
    var lista = (videos || []).map(function (v) {
      var at = Number(v.publishedAt);
      var exacto = at > 0 && at <= ahora + DIA;
      var texto = v.published || v.cuando;
      return {
        videoId: v.videoId || '',
        title: String(v.title || ''),
        views: Number(v.viewsNum != null ? v.viewsNum : v.views) || 0,
        dias: v.dias != null ? v.dias : (exacto ? Math.max(0, (ahora - at) / DIA) : diasDe(texto)),
        res: v.dias != null || exacto ? 0 : resolucionDe(texto)
      };
    }).filter(function (v) { return v.views > 0; });

    if (!lista.length) {
      return { ok: false, motivo: 'sin_vistas', razon: 'The sweep returned no view counts, so floor and ceiling cannot be computed.' };
    }

    lista.sort(function (a, b) {
      var da = a.dias == null ? 1e9 : a.dias, db = b.dias == null ? 1e9 : b.dias;
      return da - db;
    });
    var ventana = lista.slice(0, VENTANA);

    var maduros = ventana.filter(function (v) { return v.dias == null || v.dias >= DIAS_MADURO; });
    var usados = maduros.length >= 4 ? maduros : ventana;
    var recortados = ventana.length - usados.length;

    var vistas = usados.map(function (v) { return v.views; });
    var piso = Math.min.apply(null, vistas);
    var techo = Math.max.apply(null, vistas);
    var ratio = piso > 0 ? techo / piso : 0;

    var r = ritmo(ventana);

    var luz = ratio <= VERDE ? 'verde' : (ratio > ROJO ? 'rojo' : 'ambar');
    var dice = luz === 'verde'
      ? 'Channel with an engine: its floor and its ceiling are close, so the format repeats.'
      : (luz === 'rojo'
        ? 'One lucky hit: the ceiling is far above the floor, so the channel does not repeat it.'
        : 'Needs a look: between an engine and a lucky hit.');

    return {
      ok: true,
      piso: piso, techo: techo,
      ratio: Math.round(ratio * 10) / 10,
      luz: luz, dice: dice,
      mediana: mediana(vistas),
      cadenciaDias: r.dias,
      cadenciaMetodo: r.metodo,
      cadenciaRazon: r.razon,
      usados: usados.length,
      maduros: maduros.length,
      suficiente: maduros.length >= MIN_VEREDICTO,
      recortadosPorNuevos: recortados,
      ventana: ventana.length,
      umbrales: { verde: VERDE, rojo: ROJO, diasMaduro: DIAS_MADURO, minVeredicto: MIN_VEREDICTO }
    };
  }

  raiz.NSP_CADENCIA = { medir: medir, huecos: huecos, diasDe: diasDe, resolucionDe: resolucionDe, VENTANA: VENTANA, VERDE: VERDE, ROJO: ROJO, MIN_VEREDICTO: MIN_VEREDICTO };
})(typeof window !== 'undefined' ? window : globalThis);
