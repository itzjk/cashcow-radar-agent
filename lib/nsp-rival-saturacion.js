(function (raiz) {
  'use strict';

  function mediana(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  var MINIMO_CANALES = 5;
  var JOVEN_DIAS = 120;
  var PISO_UTIL = 10000;

  function medir(expedientes, opciones) {
    opciones = opciones || {};
    var pisoUtil = opciones.pisoUtil || PISO_UTIL;
    var jovenDias = opciones.jovenDias || JOVEN_DIAS;

    var lista = (expedientes || []).filter(function (e) { return e && e.ok; });
    if (lista.length < MINIMO_CANALES) {
      return {
        ok: false, motivo: 'muestra_corta',
        canales: lista.length,
        razon: 'Only ' + lista.length + ' channels carry a dossier. A niche cannot be called crowded or empty on fewer than ' + MINIMO_CANALES + '.'
      };
    }

    var filas = lista.map(function (e) {
      var cad = e.cadencia && e.cadencia.ok ? e.cadencia : null;
      var edadCierta = !!(e.edad && e.edad.ok && e.edad.cierta);
      var dias = e.edad && e.edad.ok ? e.edad.diasMinimos : null;
      return {
        nombre: (e.canal && (e.canal.nombre || e.canal.handle || e.canal.url)) || 'unnamed channel',
        url: (e.canal && e.canal.url) || '',
        total: e.canal && typeof e.canal.totalVideos === 'number' ? e.canal.totalVideos : null,
        dias: dias,
        edadCierta: edadCierta,
        joven: edadCierta && dias != null && dias <= jovenDias,
        mediana: cad ? cad.mediana : null,
        piso: cad ? cad.piso : null,
        luz: cad ? cad.luz : null,
        cadenciaDias: cad ? cad.cadenciaDias : null,
        aterrizo: !!(cad && cad.mediana >= pisoUtil),
        veredicto: e.etiqueta || null
      };
    });

    var jovenes = filas.filter(function (f) { return f.joven; });
    var jovenesQueAterrizan = jovenes.filter(function (f) { return f.aterrizo; });
    var edadDesconocida = filas.filter(function (f) { return !f.edadCierta; });
    var conMotor = filas.filter(function (f) { return f.luz === 'verde'; });
    var aterrizan = filas.filter(function (f) { return f.aterrizo; });

    var medianas = filas.map(function (f) { return f.mediana; }).filter(function (v) { return v != null; });
    var cadencias = filas.map(function (f) { return f.cadenciaDias; }).filter(function (v) { return v != null; });

    var dice = aterrizan.length + ' of ' + filas.length + ' channels clear a median of ' + pisoUtil.toLocaleString('en-US') + ' views. ';
    if (jovenes.length) {
      dice += jovenesQueAterrizan.length + ' of ' + jovenes.length + ' channels opened inside the last ' + jovenDias + ' days already clear it.';
    } else {
      dice += 'Not one channel here can be proven to be under ' + jovenDias + ' days old, so nothing says whether newcomers land.';
    }
    if (edadDesconocida.length) {
      dice += ' ' + edadDesconocida.length + ' of ' + filas.length + ' hide their real opening date behind more than 30 videos, so they are not counted as young either way.';
    }

    return {
      ok: true,
      canales: filas.length,
      filas: filas,
      jovenes: jovenes.length,
      jovenesQueAterrizan: jovenesQueAterrizan.length,
      edadDesconocida: edadDesconocida.length,
      conMotor: conMotor.length,
      aterrizan: aterrizan.length,
      medianaDelNicho: Math.round(mediana(medianas)),
      cadenciaDelNicho: cadencias.length ? mediana(cadencias) : null,
      pisoUtil: pisoUtil,
      jovenDias: jovenDias,
      minimoCanales: MINIMO_CANALES,
      dice: dice
    };
  }

  raiz.NSP_RIVAL_SATURACION = {
    medir: medir,
    MINIMO_CANALES: MINIMO_CANALES,
    JOVEN_DIAS: JOVEN_DIAS,
    PISO_UTIL: PISO_UTIL
  };
})(typeof window !== 'undefined' ? window : globalThis);
