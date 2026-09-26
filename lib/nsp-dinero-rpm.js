(function (raiz) {
  'use strict';

  var SELLO_ESTIMADO = 'ESTIMATE';
  var SELLO_MEDIDO = 'MEASURED';

  var NO_ESTIMAMOS = ['click-through rate', 'audience retention', 'average view duration', 'impressions'];

  function tabla() {
    var t = raiz.NSP_RPM_TABLA;
    return (t && typeof t.resolver === 'function') ? t : null;
  }

  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = typeof x === 'number' ? x : parseFloat(String(x).replace(/[\s,]/g, ''));
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  function dec(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }

  function dinero(x) { return '$' + dec(x, 2).toFixed(2); }

  function sello(t) { return t.measured === true ? SELLO_MEDIDO : SELLO_ESTIMADO; }

  function mercadoPedido(t, codigo) {
    var gl = String(codigo || '').trim().toLowerCase();
    if (!gl) return null;
    var mult = t.mercados[gl];
    if (typeof mult === 'number') return { gl: gl, mult: mult, sinReferencia: false };
    return { gl: gl, mult: t.mercadoNeutro, sinReferencia: true };
  }

  function proyeccion(entrada) {
    var e = entrada || {};
    var t = tabla();
    if (!t) return { ok: false, motivo: 'sin_tabla', porque: 'The RPM table is not loaded on this page, so there is no rate to work from.' };

    var tema = String(e.tema || '').trim();
    if (!tema) return { ok: false, motivo: 'sin_tema', porque: 'Type the niche or the video topic first. I will not pick a rate for a topic I was not given.' };

    var vistas = num(e.vistasMes);
    if (vistas === null) return { ok: false, motivo: 'sin_vistas', porque: 'Monthly views are empty. An empty box is not a zero, so there is nothing to multiply.' };
    if (vistas < 0) return { ok: false, motivo: 'vistas_negativas', porque: 'Monthly views cannot be negative.' };

    var duracion = num(e.duracionSegundos);
    var esShort = !!e.esShort;
    var base = t.resolver(tema, { durationSecs: duracion === null ? 0 : duracion, isShort: esShort });

    var mer = mercadoPedido(t, e.idioma);
    var rpm = base.rpm;
    var multMercado = base.mercado;
    var glMercado = base.gl;
    var sinReferencia = base.sinReferencia;
    var mercadoForzado = false;

    if (mer) {
      mercadoForzado = true;
      glMercado = mer.gl;
      multMercado = mer.mult;
      sinReferencia = mer.sinReferencia;
      rpm = base.base * mer.mult;
      if (base.largo) rpm = rpm * t.duracion.multiplicador;
      if (esShort) rpm = t.shortsRpm;
      rpm = parseFloat(rpm.toFixed(2));
    }

    var usd = vistas / 1000 * rpm;

    var cuenta = [];
    cuenta.push('Niche read as ' + (base.name || base.label) + (base.clasificado ? '' : ' (no niche matched, falling back to the unclassified rate)') + ', base ' + dinero(base.base) + ' per 1000 views');
    cuenta.push('Market ' + (glMercado || 'unknown') + ' x' + multMercado + (sinReferencia ? ' (no citable reference for this market, neutral multiplier used)' : '') + (mercadoForzado ? ' (market you picked, not the one detected from the text)' : ''));
    if (esShort) cuenta.push('Shorts rate replaces the niche rate: ' + dinero(t.shortsRpm) + ' per 1000 views');
    else if (base.largo) cuenta.push('Over ' + t.duracion.minutos + ' minutes x' + t.duracion.multiplicador);
    cuenta.push('RPM ' + dinero(rpm) + ' per 1000 views');
    cuenta.push(Math.round(vistas) + ' views / 1000 x ' + dinero(rpm) + ' = ' + dinero(usd) + ' per month');

    return {
      ok: true,
      sello: sello(t),
      estimacion: t.measured !== true,
      etiqueta: base.label,
      nombre: base.name || base.label,
      clasificado: base.clasificado,
      rpm: rpm,
      base: base.base,
      mercado: glMercado,
      multiplicadorMercado: multMercado,
      sinReferenciaDeMercado: sinReferencia,
      largo: !!base.largo,
      esShort: esShort,
      vistasMes: vistas,
      usdMes: dec(usd, 2),
      cuenta: cuenta,
      noEstimamos: NO_ESTIMAMOS.slice(),
      porque: 'ESTIMATE. The rate comes from the reference table in this extension, not from your channel. Your real RPM only exists in YouTube Studio.'
    };
  }

  function porVideo(entrada) {
    var e = entrada || {};
    var vistas = num(e.vistasPorVideo);
    if (vistas === null) return { ok: false, motivo: 'sin_vistas', porque: 'Views per video are empty. An empty box is not a zero.' };
    var r = proyeccion({ tema: e.tema, idioma: e.idioma, vistasMes: vistas, duracionSegundos: e.duracionSegundos, esShort: e.esShort });
    if (!r.ok) return r;
    r.usdPorVideo = r.usdMes;
    r.vistasPorVideo = vistas;
    delete r.usdMes;
    delete r.vistasMes;
    r.cuenta[r.cuenta.length - 1] = Math.round(vistas) + ' views / 1000 x ' + dinero(r.rpm) + ' = ' + dinero(r.usdPorVideo) + ' per video';
    return r;
  }

  raiz.NspDineroRpm = {
    SELLO_ESTIMADO: SELLO_ESTIMADO,
    SELLO_MEDIDO: SELLO_MEDIDO,
    NO_ESTIMAMOS: NO_ESTIMAMOS,
    proyeccion: proyeccion,
    porVideo: porVideo,
    _num: num,
    _dinero: dinero
  };
})(typeof window !== 'undefined' ? window : globalThis);
