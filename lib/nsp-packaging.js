(function (raiz) {
  'use strict';

  function limpio(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  var PARENTESCO = ['viuda', 'viudo', 'madre', 'padre', 'hermano', 'hermana', 'nuera', 'yerno', 'suegra', 'suegro', 'hija', 'hijo', 'esposa', 'esposo', 'abuelo', 'abuela', 'nieto', 'nieta', 'cunado', 'cunada', 'tio', 'tia', 'sobrino', 'sobrina', 'primo', 'prima'];
  var ARRIBA = ['hacendado', 'hacendada', 'patron', 'patrona', 'rico', 'rica', 'terrateniente', 'senor', 'senora', 'dueno', 'duena', 'jefe'];
  var ABAJO = ['peon', 'peona', 'criada', 'criado', 'sirvienta', 'sirviente', 'mozo', 'jornalero', 'jornalera', 'empleada', 'obrero'];
  var AGRO = ['siembra', 'sembrar', 'zanja', 'cerca', 'queso', 'cosecha', 'cosechas', 'abono', 'injerto', 'riego', 'semilla', 'semillas', 'tierra seca', 'piedra molida', 'compost', 'estiercol'];
  var VIVO = ['perro', 'perra', 'caballo', 'yegua', 'nino', 'nina', 'bebe', 'hijo', 'hija', 'gato', 'burro', 'vaca', 'mula'];
  var PROPIEDAD = ['rancho', 'casa', 'tierra', 'tierras', 'herencia', 'finca', 'parcela', 'terreno', 'hacienda'];

  var CONTABLE = /\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|medio|media)\s+(costal|costales|monedas?|moneda|bocas?|plato|platos|panes?|pan|kilos?|sacos?|centavos?|pesos?|vasos?|tortillas?|frijoles?)\b/;

  function tieneAlguna(t, lista) {
    for (var i = 0; i < lista.length; i++) {
      if (new RegExp('\\b' + lista[i] + '\\b').test(t)) return lista[i];
    }
    return '';
  }

  function puntuar(titulo) {
    var crudo = String(titulo || '');
    var t = limpio(crudo);
    var señales = [];
    var negativas = [];
    var p = 0;

    function suma(id, nombre, valor, detalle) {
      p += valor;
      (valor < 0 ? negativas : señales).push({ id: id, señal: nombre, peso: valor, detalle: detalle || '' });
    }

    var parientes = PARENTESCO.filter(function (k) { return new RegExp('\\b' + k + '\\b').test(t); });
    if (parientes.length) suma('victima_parentesco', 'the victim is named by a family role', 18, parientes[0]);
    if (parientes.length > 1) suma('agresor_pariente', 'the aggressor is family too', 18, parientes[1]);

    var mc = t.match(CONTABLE);
    if (mc) suma('miseria_contable', 'a countable object of poverty', 18, mc[0]);

    var bisagra = /\bsin saber\b/.test(t) ? 'sin saber' : (/\bhasta que\b/.test(t) ? 'hasta que' : '');
    if (bisagra) suma('bisagra', 'a hinge that turns the story', 10, bisagra);

    if (bisagra) {
      var cola = t.slice(t.indexOf(bisagra) + bisagra.length);
      var v = tieneAlguna(cola, VIVO);
      var pr = tieneAlguna(cola, PROPIEDAD);
      if (v) suma('pago_vivo', 'the payoff is a living being', 18, v);
      else if (pr) suma('pago_propiedad', 'the payoff is a property', 12, pr);
      else suma('pago_abstracto', 'the payoff is abstract', 4, 'no concrete object after the hinge');
    }

    var a = tieneAlguna(t, ARRIBA), b = tieneAlguna(t, ABAJO);
    if (a && b) suma('clase_completa', 'a class axis with both sides', 18, a + ' / ' + b);
    else if (a || b) suma('clase_a_medias', 'half a class axis', 8, a || b);

    var edad = t.match(/\b([4-7]\d)\s*anos\b/);
    if (edad && +edad[1] >= 50 && +edad[1] <= 70) suma('edad_en_rango', 'an age between 50 and 70', 10, edad[1]);

    var comillas = crudo.match(/[""«»"]/g);
    var turnos = (crudo.match(/[""«"]([^""»"]{3,})/g) || []).length;
    if (comillas && turnos >= 2) suma('dialogo_dos_turnos', 'dialogue with two turns', 18, turnos + ' turns');
    else if (comillas && turnos === 1) suma('dialogo_un_turno', 'dialogue with a single turn', 8, '1 turn');

    var agro = AGRO.filter(function (k) { return t.indexOf(k) >= 0; });
    if (agro.length) suma('premisa_agro', 'a farming technique as the premise', -25, agro.join(', '));

    var colectivo = /\bse rieron\b|\btodos\b|\bnadie\b|\bel pueblo\b/.test(t);
    var nombrado = parientes.length > 0 || !!a || !!b;
    if (colectivo && !nombrado) suma('villano_colectivo', 'a collective villain with no named subject', -15, (t.match(/\bse rieron\b|\btodos\b|\bnadie\b|\bel pueblo\b/) || [''])[0]);

    var cifras = t.match(/\b\d+\b/g) || [];
    var cargaTxt = mc ? mc[0] : '';
    var fuera = cifras.filter(function (c) { return cargaTxt.indexOf(c) < 0; });
    if (fuera.length) suma('cifra_fuera_de_carga', 'a number that is not the payload', -15, fuera.join(', '));

    var largo = crudo.length;
    if (largo >= 90 && largo <= 100) suma('longitud_en_objetivo', 'length on target', 4, largo + ' characters');
    else señales.push({ id: 'longitud_fuera', señal: 'length off target', peso: 0, detalle: largo + ' characters, target 90 to 100' });

    var score = Math.max(0, Math.min(100, Math.round(p)));
    return { titulo: crudo, packagingScore: score, bruto: p, señales: señales, negativas: negativas };
  }

  raiz.NSP_PACKAGING = { puntuar: puntuar, PARENTESCO: PARENTESCO, AGRO: AGRO };
})(typeof window !== 'undefined' ? window : globalThis);
