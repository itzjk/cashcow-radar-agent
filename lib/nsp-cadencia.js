(function (raiz) {
  'use strict';

  var VENTANA = 12;
  var DIAS_MADURO = 7;
  var VERDE = 6;
  var ROJO = 20;

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

  function mediana(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  function medir(videos) {
    var lista = (videos || []).map(function (v) {
      return {
        videoId: v.videoId || '',
        title: String(v.title || ''),
        views: Number(v.viewsNum != null ? v.viewsNum : v.views) || 0,
        dias: v.dias != null ? v.dias : diasDe(v.published || v.cuando)
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

    var edades = ventana.map(function (v) { return v.dias; }).filter(function (d) { return d != null; }).sort(function (a, b) { return a - b; });
    var huecos = [];
    for (var i = 1; i < edades.length; i++) huecos.push(edades[i] - edades[i - 1]);
    var cadencia = huecos.length ? mediana(huecos) : null;

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
      cadenciaDias: cadencia,
      usados: usados.length,
      recortadosPorNuevos: recortados,
      ventana: ventana.length,
      umbrales: { verde: VERDE, rojo: ROJO, diasMaduro: DIAS_MADURO }
    };
  }

  raiz.NSP_CADENCIA = { medir: medir, diasDe: diasDe, VENTANA: VENTANA, VERDE: VERDE, ROJO: ROJO };
})(typeof window !== 'undefined' ? window : globalThis);
