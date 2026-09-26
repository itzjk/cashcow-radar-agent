(function (raiz) {
  'use strict';

  function mediana(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  function red(n, d) {
    var f = Math.pow(10, d == null ? 1 : d);
    return Math.round(n * f) / f;
  }

  var VENTANA = 6;
  var MINIMO = 14;
  var SALTO = 3;
  var SALTO_APUNTA = 2;

  function cadencia() {
    return raiz.NSP_CADENCIA || (typeof NSP_CADENCIA !== 'undefined' ? NSP_CADENCIA : null);
  }

  function cronologico(videos) {
    var C = cadencia();
    return (videos || []).map(function (v, i) {
      return {
        videoId: v.videoId || '',
        title: String(v.title || ''),
        views: Number(v.viewsNum != null ? v.viewsNum : v.views) || 0,
        dias: v.dias != null ? v.dias : (C ? C.diasDe(v.published || v.cuando) : null),
        puestoBarrido: i
      };
    }).filter(function (v) { return v.views > 0; }).reverse();
  }

  var MIN_RACHA = 8;

  function estabilidad(lista, minRacha) {
    var C = cadencia();
    var techoRatio = C ? C.VERDE : 6;
    var min = minRacha || MIN_RACHA;
    if (lista.length < min) {
      return { ok: false, razon: 'Fewer than ' + min + ' videos came back, so no run can be called steady.', umbral: techoRatio };
    }
    for (var s = 0; s <= lista.length - min; s++) {
      var trozo = lista.slice(s).map(function (v) { return v.views; });
      var piso = Math.min.apply(null, trozo);
      var techo = Math.max.apply(null, trozo);
      if (!piso) continue;
      var ratio = techo / piso;
      if (ratio <= techoRatio) {
        return {
          ok: true,
          desde: s + 1,
          videos: lista.length - s,
          piso: piso, techo: techo,
          ratio: red(ratio),
          umbral: techoRatio,
          dice: 'The last ' + (lista.length - s) + ' videos run between ' + piso.toLocaleString('en-US') + ' and ' + techo.toLocaleString('en-US') + ' views, a ratio of ' + red(ratio) + 'x. That stretch is an engine, whatever the older half of the sweep looks like.'
        };
      }
    }
    return {
      ok: false,
      umbral: techoRatio,
      razon: 'No run of ' + min + ' videos or more ending today stays inside ' + techoRatio + 'x. The channel is still bouncing, so its recent floor is not a floor yet.'
    };
  }

  function medir(videos, opciones) {
    opciones = opciones || {};
    var lista = cronologico(videos);
    var ventana = opciones.ventana || VENTANA;

    if (lista.length < MINIMO) {
      return {
        ok: false, motivo: 'sin_historia',
        razon: 'Only ' + lista.length + ' videos came back with views. A break needs at least ' + MINIMO + ' so there is history on both sides of it.'
      };
    }

    var mejor = null;
    for (var i = ventana; i <= lista.length - ventana; i++) {
      var antes = lista.slice(i - ventana, i).map(function (v) { return v.views; });
      var despues = lista.slice(i, i + ventana).map(function (v) { return v.views; });
      var mAntes = mediana(antes);
      var mDespues = mediana(despues);
      if (!mAntes) continue;
      var salto = mDespues / mAntes;
      if (!mejor || salto > mejor.salto) {
        mejor = {
          indice: i, salto: salto,
          medianaAntes: mAntes, medianaDespues: mDespues,
          pisoAntes: Math.min.apply(null, antes), pisoDespues: Math.min.apply(null, despues),
          video: lista[i]
        };
      }
    }

    if (!mejor) {
      return { ok: false, motivo: 'sin_base', razon: 'Every window before a candidate has a zero median, so no lift can be divided out.' };
    }

    var hubo = mejor.salto >= SALTO;
    var apunta = !hubo && mejor.salto >= SALTO_APUNTA;

    var comun = null;
    var F = raiz.NSP_RIVAL_FORMULA || (typeof NSP_RIVAL_FORMULA !== 'undefined' ? NSP_RIVAL_FORMULA : null);
    if (F && (hubo || apunta)) {
      comun = F.diferenciar(
        lista.slice(mejor.indice, mejor.indice + ventana).map(function (v) { return v.title; }),
        lista.slice(mejor.indice - ventana, mejor.indice).map(function (v) { return v.title; })
      );
    }

    var dice;
    if (hubo) {
      dice = 'The floor lifted ' + red(mejor.salto) + 'x at video ' + (mejor.indice + 1) + ' of ' + lista.length + ' and stayed up. That video is where the channel changed.';
    } else if (apunta) {
      dice = 'The best lift in the whole sweep is ' + red(mejor.salto) + 'x, under the ' + SALTO + 'x this calls a break. Something moved there, but not enough to call it the turning point.';
    } else {
      dice = 'No video lifted the floor more than ' + red(mejor.salto) + 'x. This channel has always run at the same level: there is no turning point to copy, only its steady format.';
    }

    return {
      ok: true,
      hubo: hubo,
      apunta: apunta,
      total: lista.length,
      ventana: ventana,
      umbral: SALTO,
      salto: red(mejor.salto),
      posicion: mejor.indice + 1,
      video: mejor.video,
      medianaAntes: Math.round(mejor.medianaAntes),
      medianaDespues: Math.round(mejor.medianaDespues),
      pisoAntes: mejor.pisoAntes,
      pisoDespues: mejor.pisoDespues,
      queCambio: comun,
      estable: estabilidad(lista, opciones.minRacha),
      dice: dice,
      masVisto: lista.slice().sort(function (a, b) { return b.views - a.views; })[0]
    };
  }

  raiz.NSP_RIVAL_QUIEBRE = {
    medir: medir,
    cronologico: cronologico,
    estabilidad: estabilidad,
    MIN_RACHA: MIN_RACHA,
    VENTANA: VENTANA,
    MINIMO: MINIMO,
    SALTO: SALTO,
    SALTO_APUNTA: SALTO_APUNTA
  };
})(typeof window !== 'undefined' ? window : globalThis);
