(function (raiz) {
  'use strict';

  var SIRVE = 'SIRVE';
  var MIRARLO = 'HAY QUE MIRARLO';
  var NO_SIRVE = 'NO SIRVE';

  var ETIQUETA = {};
  ETIQUETA[SIRVE] = 'KEEP';
  ETIQUETA[MIRARLO] = 'LOOK AT IT';
  ETIQUETA[NO_SIRVE] = 'DROP';

  var DE_ACCION = {
    seguir: SIRVE,
    seguir_con_limite: MIRARLO,
    observar: MIRARLO,
    congelar: MIRARLO,
    cerrar: NO_SIRVE,
    sin_veredicto: MIRARLO
  };

  function deAccion(accion) {
    var a = String(accion || '').trim();
    return Object.prototype.hasOwnProperty.call(DE_ACCION, a) ? DE_ACCION[a] : MIRARLO;
  }

  function conoce(accion) {
    return Object.prototype.hasOwnProperty.call(DE_ACCION, String(accion || '').trim());
  }

  function veredictoEnPalabras(v) {
    if (!v) return NO_SIRVE;
    if (v.aprobado) return SIRVE;
    if (v.necesitaOjos && !v.regla) return MIRARLO;
    return NO_SIRVE;
  }

  function etiqueta(palabra) {
    return ETIQUETA[palabra] || ETIQUETA[MIRARLO];
  }

  raiz.NSP_VEREDICTO = {
    SIRVE: SIRVE, MIRARLO: MIRARLO, NO_SIRVE: NO_SIRVE,
    ETIQUETA: ETIQUETA, DE_ACCION: DE_ACCION,
    deAccion: deAccion, conoce: conoce,
    veredictoEnPalabras: veredictoEnPalabras, etiqueta: etiqueta
  };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
