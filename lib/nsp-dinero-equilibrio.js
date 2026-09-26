(function (raiz) {
  'use strict';

  var MOTOR_MEDIDO = 'NSPSaludCanales.salud';

  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = typeof x === 'number' ? x : parseFloat(String(x).replace(/[\s,]/g, ''));
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  function dec(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }

  function dinero(x) { return '$' + dec(x, 2).toFixed(2); }

  function medidasUtiles(bruto) {
    if (!Array.isArray(bruto)) return 0;
    var n = 0;
    for (var i = 0; i < bruto.length; i++) {
      var m = bruto[i] || {};
      if (num(m.vistas) !== null && num(m.rpm) !== null) n++;
    }
    return n;
  }

  function equilibrio(entrada) {
    var e = entrada || {};

    var conMedida = medidasUtiles(e.medidas);
    if (conMedida > 0) {
      return {
        ok: false,
        motivo: 'hay_medicion',
        medidasUtiles: conMedida,
        usar: MOTOR_MEDIDO,
        porque: 'This channel already has ' + conMedida + ' measured reading(s) with views and RPM together. An estimate does not get to answer over data: the measured reading owns that answer.'
      };
    }

    var ingreso = num(e.ingresoPorVideo);
    var coste = num(e.costePorVideo);
    var fijo = num(e.costeFijoMes);

    var faltan = [];
    if (ingreso === null) faltan.push('estimated revenue per video');
    if (coste === null) faltan.push('cost per video');
    if (faltan.length) {
      return { ok: false, motivo: 'faltan_datos', faltan: faltan,
        porque: 'No break-even: ' + faltan.join(' and ') + ' missing. An empty box is not a zero, and a break-even built on an invented cost is worse than none.' };
    }

    var margen = ingreso - coste;
    var cuenta = [];
    cuenta.push('Revenue per video ' + dinero(ingreso) + ' minus cost per video ' + dinero(coste) + ' = margin ' + dinero(margen));

    var salida = {
      ok: true,
      estimacion: true,
      sello: 'ESTIMATE',
      ingresoPorVideo: dec(ingreso, 2),
      costePorVideo: dec(coste, 2),
      margenPorVideo: dec(margen, 2),
      cuenta: cuenta,
      reemplazadoPor: MOTOR_MEDIDO
    };

    var rpm = num(e.rpm);
    if (rpm !== null && rpm > 0) {
      salida.vistasParaCubrirUnVideo = Math.ceil(coste * 1000 / rpm);
      cuenta.push('At an RPM of ' + dinero(rpm) + ', one video pays for itself at ' + salida.vistasParaCubrirUnVideo + ' views');
    }

    if (margen <= 0) {
      salida.videosParaCubrirFijo = null;
      salida.porque = 'ESTIMATE. The margin per video is ' + dinero(margen) + ': no amount of videos covers anything, more output is more loss. Cut the cost per lane or move to a market with a higher rate.';
      return salida;
    }

    if (fijo !== null) {
      salida.costeFijoMes = dec(fijo, 2);
      salida.videosParaCubrirFijo = Math.ceil(fijo / margen);
      cuenta.push('Fixed cost ' + dinero(fijo) + ' per month / margin ' + dinero(margen) + ' = ' + salida.videosParaCubrirFijo + ' videos a month to break even');
      var porMes = num(e.videosPorMes);
      if (porMes !== null && porMes > 0) {
        salida.videosPorMes = porMes;
        salida.cubre = porMes >= salida.videosParaCubrirFijo;
        salida.resultadoMes = dec(porMes * margen - fijo, 2);
        cuenta.push('At ' + porMes + ' videos a month: ' + dinero(porMes * margen) + ' of margin minus ' + dinero(fijo) + ' fixed = ' + dinero(salida.resultadoMes) + ' a month');
      }
    }

    salida.porque = 'ESTIMATE built on a rate nobody measured on your channel. The day this channel has readings with views and RPM together, the measured reading answers instead and this number stops being shown.';
    return salida;
  }

  raiz.NspDineroEquilibrio = {
    MOTOR_MEDIDO: MOTOR_MEDIDO,
    medidasUtiles: medidasUtiles,
    equilibrio: equilibrio
  };
})(typeof window !== 'undefined' ? window : globalThis);
