(function (raiz) {
  'use strict';

  var OBJETIVO_POR_DEFECTO = 10000;

  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = typeof x === 'number' ? x : parseFloat(String(x).replace(/[\s,]/g, ''));
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  function dec(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }

  function dinero(x) { return '$' + dec(x, 2).toFixed(2); }

  function vocabulario() {
    var v = raiz.NSP_VEREDICTO;
    return (v && v.SIRVE) ? v : null;
  }

  function mediana(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function porHora(canales) {
    var lista = Array.isArray(canales) ? canales : [];
    if (!lista.length) return { ok: false, motivo: 'sin_canales', porque: 'No channels handed over.' };

    var filas = [], sinDato = [];
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i] || {};
      var nombre = String(c.nombre || 'unnamed');
      var usd = num(c.usdMes);
      var horas = num(c.horasMes);
      var falta = [];
      if (usd === null) falta.push('estimated revenue');
      if (horas === null) falta.push('hours of work');
      if (horas !== null && horas <= 0) falta.push('hours of work above zero');
      if (falta.length) { sinDato.push({ nombre: nombre, falta: falta }); continue; }
      filas.push({
        nombre: nombre,
        usdMes: dec(usd, 2),
        horasMes: dec(horas, 2),
        usdPorHora: dec(usd / horas, 2),
        cuenta: dinero(usd) + ' a month / ' + dec(horas, 2) + ' hours = ' + dinero(usd / horas) + ' an hour'
      });
    }
    filas.sort(function (a, b) { return b.usdPorHora - a.usdPorHora; });

    return {
      ok: true,
      estimacion: true,
      sello: 'ESTIMATE',
      filas: filas,
      sinDato: sinDato,
      mejor: filas.length ? filas[0] : null,
      peor: filas.length ? filas[filas.length - 1] : null,
      porque: filas.length
        ? filas.length + ' of ' + lista.length + ' channels have both numbers. ' +
          (sinDato.length ? sinDato.length + ' channel(s) left out because a box is empty, and an empty box is not a zero.' : 'Every channel had both.')
        : 'None of the ' + lista.length + ' channels has both an estimated revenue and hours of work. Nothing to rank.'
    };
  }

  function dineroEnRiesgo(canales) {
    var V = vocabulario();
    if (!V) return { ok: false, motivo: 'sin_vocabulario', porque: 'lib/nsp-veredicto.js is not loaded, so there is no house wording to sort by.' };
    var lista = Array.isArray(canales) ? canales : [];
    if (!lista.length) return { ok: false, motivo: 'sin_canales', porque: 'No channels handed over.' };

    var cubos = {}, sinVeredicto = [], sinDinero = [];
    cubos[V.SIRVE] = { usd: 0, canales: [] };
    cubos[V.MIRARLO] = { usd: 0, canales: [] };
    cubos[V.NO_SIRVE] = { usd: 0, canales: [] };

    for (var i = 0; i < lista.length; i++) {
      var c = lista[i] || {};
      var nombre = String(c.nombre || 'unnamed');
      var v = String(c.veredicto || '').trim();
      if (!Object.prototype.hasOwnProperty.call(cubos, v)) { sinVeredicto.push(nombre); continue; }
      var usd = num(c.usdMes);
      if (usd === null) { sinDinero.push({ nombre: nombre, veredicto: v }); cubos[v].canales.push({ nombre: nombre, usdMes: null }); continue; }
      cubos[v].usd += usd;
      cubos[v].canales.push({ nombre: nombre, usdMes: dec(usd, 2) });
    }

    var expuesto = cubos[V.MIRARLO].usd + cubos[V.NO_SIRVE].usd;
    var contados = lista.length - sinVeredicto.length - sinDinero.length;

    return {
      ok: true,
      estimacion: true,
      sello: 'ESTIMATE',
      seguro: dec(cubos[V.SIRVE].usd, 2),
      mirarlo: dec(cubos[V.MIRARLO].usd, 2),
      noSirve: dec(cubos[V.NO_SIRVE].usd, 2),
      expuesto: dec(expuesto, 2),
      cubos: cubos,
      sinVeredicto: sinVeredicto,
      sinDinero: sinDinero,
      contados: contados,
      total: lista.length,
      porque: 'ESTIMATE over ' + contados + ' of ' + lista.length + ' channels. ' + dinero(expuesto) +
        ' a month sits behind a channel this house does not call safe: ' + dinero(cubos[V.MIRARLO].usd) + ' on ' +
        V.ETIQUETA[V.MIRARLO] + ' and ' + dinero(cubos[V.NO_SIRVE].usd) + ' on ' + V.ETIQUETA[V.NO_SIRVE] + '.' +
        (sinVeredicto.length ? ' ' + sinVeredicto.length + ' channel(s) carry no verdict and are counted nowhere.' : '') +
        (sinDinero.length ? ' ' + sinDinero.length + ' channel(s) carry a verdict but no revenue estimate, so their money is unknown, not zero.' : '')
    };
  }

  function caminoAlObjetivo(canales, objetivo) {
    var lista = Array.isArray(canales) ? canales : [];
    var meta = num(objetivo);
    if (meta === null || meta <= 0) meta = OBJETIVO_POR_DEFECTO;

    var valores = [], sinDato = [];
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i] || {};
      var usd = num(c.usdMes);
      if (usd === null) { sinDato.push(String(c.nombre || 'unnamed')); continue; }
      valores.push(usd);
    }
    if (!valores.length) {
      return { ok: false, motivo: 'sin_estimacion', objetivo: meta, sinDato: sinDato,
        porque: 'Not one of the ' + lista.length + ' channels has a revenue estimate. There is no distance to measure to ' + dinero(meta) + ' a month.' };
    }

    var total = valores.reduce(function (a, b) { return a + b; }, 0);
    var med = mediana(valores);
    var falta = meta - total;
    var cuenta = [];
    cuenta.push(valores.length + ' of ' + lista.length + ' channels estimated, adding up to ' + dinero(total) + ' a month');
    cuenta.push('Target ' + dinero(meta) + ' minus ' + dinero(total) + ' = ' + dinero(falta) + ' still missing');

    var faltanCanales = null;
    if (falta > 0 && med > 0) {
      faltanCanales = Math.ceil(falta / med);
      cuenta.push('At the median channel of ' + dinero(med) + ' a month, that is ' + faltanCanales + ' more channels like the ones you already have');
    }

    return {
      ok: true,
      estimacion: true,
      sello: 'ESTIMATE',
      objetivo: dec(meta, 2),
      total: dec(total, 2),
      mediana: dec(med, 2),
      falta: dec(falta, 2),
      llegado: falta <= 0,
      canalesQueFaltan: faltanCanales,
      contados: valores.length,
      sinDato: sinDato,
      cuenta: cuenta,
      porque: falta <= 0
        ? 'ESTIMATE. The estimated total already clears ' + dinero(meta) + ' a month. It is an estimate, not a payout: check it against YouTube Studio before you believe it.'
        : 'ESTIMATE. ' + dinero(falta) + ' a month still missing' + (faltanCanales !== null ? ', roughly ' + faltanCanales + ' more channels at the median' : '') +
          '.' + (sinDato.length ? ' ' + sinDato.length + ' channel(s) have no estimate and add nothing here, which is not the same as adding zero.' : '')
    };
  }

  raiz.NspDineroCartera = {
    OBJETIVO_POR_DEFECTO: OBJETIVO_POR_DEFECTO,
    porHora: porHora,
    dineroEnRiesgo: dineroEnRiesgo,
    caminoAlObjetivo: caminoAlObjetivo
  };
})(typeof window !== 'undefined' ? window : globalThis);
