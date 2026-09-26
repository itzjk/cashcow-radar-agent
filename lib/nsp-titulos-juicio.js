(function (raiz) {
  'use strict';

  var SN = raiz.NSP_TITULOS_SENALES;
  var T = raiz.NSP_TITULOS_TABLA;

  function limpio(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  var PARENTESCO = ['viuda', 'viudo', 'madre', 'padre', 'hermano', 'hermana', 'nuera', 'yerno', 'suegra', 'suegro', 'hija', 'hijo', 'esposa', 'esposo', 'abuelo', 'abuela', 'nieto', 'nieta', 'cunado', 'cunada', 'tio', 'tia', 'sobrino', 'sobrina', 'primo', 'prima', 'prometida', 'prometido'];
  var CLASE = ['hacendado', 'hacendada', 'patron', 'patrona', 'rico', 'rica', 'terrateniente', 'senor', 'senora', 'dueno', 'duena', 'jefe', 'peon', 'peona', 'criada', 'criado', 'sirvienta', 'sirviente', 'mozo', 'jornalero', 'jornalera', 'rancho', 'hacienda', 'herencia', 'magnate'];
  var GIRO_ES = /hasta que|sin saber|no sabia|hasta el dia/;

  var MOTOR_NOMBRE = { general: 'general', segmento: 'market segment', melodrama: 'ranch melodrama', ninguno: 'empty' };

  function motorNombre(m) { return MOTOR_NOMBRE[m] || String(m || ''); }

  function nichoNombre(n) {
    var R = raiz.NSP_RPM_TABLA;
    return R && typeof R.nombreDe === 'function' ? R.nombreDe(n) : String(n || '');
  }

  function tieneAlguna(t, lista) {
    for (var i = 0; i < lista.length; i++) if (new RegExp('\\b' + lista[i] + '\\b').test(t)) return lista[i];
    return '';
  }

  function esMelodrama(titulo) {
    var s = limpio(titulo);
    if (!GIRO_ES.test(s)) return false;
    return !!(tieneAlguna(s, PARENTESCO) || tieneAlguna(s, CLASE));
  }

  function segmentoDe(opciones) {
    var o = opciones || {};
    var m = String(o.mercado || '').toUpperCase();
    return (m && T.segmentos[m]) ? m : '';
  }

  function percentil(bruto) {
    var e = T.reparto.escalones, i = 0;
    while (i < e.length && e[i] < bruto) i++;
    return Math.max(0, Math.min(100, i * 5));
  }

  function veredicto(p) {
    if (p >= 75) return { estado: 'strong', texto: 'Strong for this corpus' };
    if (p <= 35) return { estado: 'weak', texto: 'Weak for this corpus' };
    return { estado: 'mirar', texto: 'Needs a look' };
  }

  function puntuar(titulo, opciones) {
    var crudo = String(titulo == null ? '' : titulo);
    var o = opciones || {};
    if (!crudo.trim()) {
      return { titulo: crudo, motor: 'ninguno', vacio: true, razon: 'No title given.' };
    }
    if ((esMelodrama(crudo) || o.nicho === 'Melodrama campirano') && raiz.NSP_PACKAGING) {
      var pk = raiz.NSP_PACKAGING.puntuar(crudo);
      var ficha = T.nichoMotor['Melodrama campirano'];
      return {
        titulo: crudo, motor: 'melodrama', motorFichero: ficha.fichero,
        nicho: 'Melodrama campirano', segmento: '', calibrado: true,
        puntos: pk.packagingScore, bruto: pk.bruto, percentil: null,
        aFavor: pk['señales'].filter(function (x) { return x.peso > 0; }).map(function (x) {
          return { clave: x.id || x['señal'], etiqueta: x['señal'], peso: x.peso, duelos: ficha.duelos, gana: ficha.acierto, detalle: x.detalle };
        }),
        enContra: pk.negativas.map(function (x) {
          return { clave: x.id || x['señal'], etiqueta: x['señal'], peso: x.peso, duelos: ficha.duelos, gana: ficha.acierto, detalle: x.detalle };
        }),
        veredicto: veredicto(pk.packagingScore),
        calibracion: { acierto: ficha.acierto, contra: ficha.general, duelos: ficha.duelos, canales: ficha.canales, azar: 50, corpus: ficha.corpus }
      };
    }
    var seg = segmentoDe(o);
    var tabla = seg ? T.segmentos[seg].tabla : T.general;
    var r = SN.puntuarCon(crudo, tabla);
    var pc = percentil(r.bruto);
    var cal = seg
      ? { acierto: T.segmentos[seg].acierto, contra: T.segmentos[seg].general, duelos: T.segmentos[seg].duelos, divisiones: T.segmentos[seg].divisiones, azar: 50, baseVistas: T.calibracion.baseVistas }
      : { acierto: T.calibracion.acierto, min: T.calibracion.min, max: T.calibracion.max, duelos: T.corpus.duelos, divisiones: T.calibracion.divisiones, azar: 50, baseVistas: T.calibracion.baseVistas };
    return {
      titulo: crudo, motor: seg ? 'segmento' : 'general', segmento: seg,
      nicho: o.nicho || '', calibrado: true,
      sinTablaDeNicho: !!o.nicho && !T.nichoMotor[o.nicho],
      puntos: pc, bruto: r.bruto, percentil: pc,
      aFavor: r.aFavor, enContra: r.enContra,
      veredicto: veredicto(pc), calibracion: cal
    };
  }

  function contra(titulo, opciones) {
    var p = puntuar(titulo, opciones);
    if (p.vacio) return { titulo: p.titulo, vacio: true, razon: p.razon, enContra: [] };
    var coste = 0;
    for (var i = 0; i < p.enContra.length; i++) coste += Math.abs(p.enContra[i].peso);
    return {
      titulo: p.titulo, motor: p.motor, segmento: p.segmento,
      enContra: p.enContra, coste: coste,
      limpio: p.enContra.length === 0,
      calibracion: p.calibracion
    };
  }

  function comparar(a, b, opciones) {
    var pa = puntuar(a, opciones), pb = puntuar(b, opciones);
    if (pa.vacio || pb.vacio) return { estado: 'vacio', razon: 'Both titles are needed.' };
    if (pa.motor !== pb.motor) {
      return { estado: 'mirar', a: pa, b: pb, margen: 0,
        razon: 'The two titles are judged by different engines, so their numbers are not comparable.' };
    }
    var ma = pa.motor === 'melodrama' ? pa.puntos : pa.bruto;
    var mb = pb.motor === 'melodrama' ? pb.puntos : pb.bruto;
    var margen = Math.abs(ma - mb);
    var corte = pa.motor === 'melodrama' ? 10 : T.margen.corte;
    if (margen <= corte) {
      return { estado: 'mirar', a: pa, b: pb, margen: margen, corte: corte,
        razon: 'Too close to call. Below a ' + corte + ' point gap the table calls the loser as often as the winner.',
        calibracion: pa.calibracion };
    }
    var gana = ma > mb ? 'a' : 'b';
    var alto = ma > mb ? pa : pb, bajo = ma > mb ? pb : pa;
    var motivos = [];
    var enBajo = {}, i;
    for (i = 0; i < bajo.aFavor.length; i++) enBajo[bajo.aFavor[i].clave] = true;
    for (i = 0; i < alto.aFavor.length; i++) if (!enBajo[alto.aFavor[i].clave]) motivos.push({ lado: 'gana', fila: alto.aFavor[i] });
    var enAlto = {};
    for (i = 0; i < alto.enContra.length; i++) enAlto[alto.enContra[i].clave] = true;
    for (i = 0; i < bajo.enContra.length; i++) if (!enAlto[bajo.enContra[i].clave]) motivos.push({ lado: 'pierde', fila: bajo.enContra[i] });
    motivos.sort(function (x, y) { return Math.abs(y.fila.peso) - Math.abs(x.fila.peso); });
    return {
      estado: 'llamado', gana: gana, a: pa, b: pb, margen: margen, corte: corte,
      motivos: motivos, calibracion: pa.calibracion,
      fiabilidad: pa.motor === 'melodrama' ? null : { acierto: T.margen.acierto, cubre: T.margen.cubre, azar: 50 }
    };
  }

  var GIROS = [
    { re: /\b(until)\b/i, gl: 'en' }, { re: /\bbut then\b/i, gl: 'en' }, { re: /\bwhat happened next\b/i, gl: 'en' },
    { re: /hasta que|hasta el d[ií]a|sin saber|no sab[ií]a|pero entonces/i, gl: 'es' },
    { re: /\bbis\b|doch dann|bis zu dem tag/i, gl: 'de' },
    { re: /jusqu.?[aà]|mais ensuite/i, gl: 'fr' },
    { re: /at[ée] que|mas ent[aã]o/i, gl: 'pt' },
    { re: /indtil|men s[aå]/i, gl: 'da' }
  ];
  var VIVO = /\b(perro|perra|caballo|yegua|ni[nñ]o|ni[nñ]a|bebe|beb[eé]|hijo|hija|gato|burro|vaca|mula|dog|horse|child|baby|cat|kind|hund|pferd|baby|enfant|chien|cheval|crian[cç]a|c[aã]o|cavalo|barn|hund|hest)\b/i;
  var PROPIEDAD = /\b(rancho|casa|tierra|tierras|herencia|finca|parcela|terreno|hacienda|house|land|farm|estate|inheritance|haus|land|hof|erbe|maison|terre|ferme|h[ée]ritage|casa|terra|fazenda|heran[cç]a|hus|jord|g[aå]rd|arv)\b/i;
  var CIFRA = /\d/;

  function bisagra(titulo) {
    var s = String(titulo == null ? '' : titulo);
    var hit = null, gl = '';
    for (var i = 0; i < GIROS.length; i++) {
      var m = GIROS[i].re.exec(s);
      if (m) { hit = m; gl = GIROS[i].gl; break; }
    }
    if (!hit) {
      return { titulo: s, tiene: false, estado: 'sin_bisagra',
        razon: 'No hinge found. The title states a situation and never turns it.' };
    }
    var cola = s.slice(hit.index + hit[0].length).trim();
    var pago, peso, razon;
    if (VIVO.test(cola)) { pago = 'living'; peso = 3; razon = 'What is paid off is a living thing, the most concrete payoff there is.'; }
    else if (PROPIEDAD.test(cola)) { pago = 'property'; peso = 2; razon = 'What is paid off is a piece of property, concrete enough to picture.'; }
    else if (CIFRA.test(cola)) { pago = 'figure'; peso = 2; razon = 'What is paid off is a figure, concrete but colder than a thing.'; }
    else if (cola.split(/\s+/).filter(Boolean).length >= 3) { pago = 'abstract'; peso = 1; razon = 'The hinge turns but the payoff is abstract. Nothing after the turn can be pictured.'; }
    else { pago = 'empty'; peso = 0; razon = 'The hinge turns and nothing follows it.'; }
    return {
      titulo: s, tiene: true, giro: hit[0], idioma: gl, cola: cola,
      pago: pago, peso: peso, razon: razon,
      estado: peso >= 2 ? 'concreto' : peso === 1 ? 'abstracto' : 'vacio'
    };
  }

  function contraGanadores(titulo, opciones) {
    var o = opciones || {};
    var nicho = o.nicho || '';
    var ref = T.referencia[nicho];
    var p = puntuar(titulo, o);
    if (p.vacio) return { vacio: true, razon: p.razon };
    if (!ref) {
      return { titulo: p.titulo, hayReferencia: false, nicho: nicho,
        razon: nicho
          ? 'The sweeps hold fewer than 40 titles for ' + nichoNombre(nicho) + ', so there is no honest reference to measure against.'
          : 'Pick a niche to measure the title against its real winners.',
        nichos: Object.keys(T.referencia) };
    }
    var b = p.motor === 'melodrama' ? null : p.bruto;
    if (b === null) {
      return { titulo: p.titulo, hayReferencia: false, nicho: nicho,
        razon: 'This title is judged by the melodrama engine, whose scale is not the one the niche reference is built on.' };
    }
    var pos = b >= ref.p90 ? 'top' : b >= ref.p75 ? 'alto' : b >= ref.mediana ? 'medio' : b >= ref.p25 ? 'bajo' : 'fondo';
    return {
      titulo: p.titulo, hayReferencia: true, nicho: nicho, bruto: b,
      referencia: ref, posicion: pos,
      ganadores: ref.ganadores,
      razon: 'Your title scores ' + b + '. Across ' + ref.n + ' real titles of this niche in your sweeps the median is ' +
        ref.mediana + ' and the top tenth starts at ' + ref.p90 + '.'
    };
  }

  function reescribir(titulo, opciones) {
    var s = String(titulo == null ? '' : titulo);
    if (!s.trim()) return { vacio: true, razon: 'No title given.' };
    var o = opciones || {};
    var antes = puntuar(s, o);
    var tabla = antes.motor === 'segmento' ? T.segmentos[antes.segmento].tabla : T.general;
    var cambios = [];
    var t = s;

    function castiga(clave) { return tabla[clave] && tabla[clave].peso < 0 ? tabla[clave] : null; }

    var e = castiga('guion_sep');
    if (e && /\s[-\u2013\u2014]\s/.test(t)) {
      t = t.replace(/\s[-\u2013\u2014]\s/g, ' ');
      cambios.push({ que: 'Dropped the dash that split the title', peso: e.peso, duelos: e.duelos, gana: e.gana });
    }
    e = castiga('dos_puntos');
    if (e && /:/.test(t)) {
      t = t.replace(/\s*:\s*/g, ' ');
      cambios.push({ que: 'Dropped the colon that split the title', peso: e.peso, duelos: e.duelos, gana: e.gana });
    }
    e = castiga('barra');
    if (e && /[|｜]/.test(t)) {
      t = t.replace(/\s*[|｜]\s*/g, ' ');
      cambios.push({ que: 'Dropped the pipe that split the title', peso: e.peso, duelos: e.duelos, gana: e.gana });
    }
    e = castiga('corchetes');
    if (e && /[\[\]()]/.test(t)) {
      t = t.replace(/\s*[\[(][^\])]*[\])]\s*/g, ' ').replace(/[\[\]()]/g, '');
      cambios.push({ que: 'Dropped the bracketed tag', peso: e.peso, duelos: e.duelos, gana: e.gana });
    }
    t = t.replace(/\s{2,}/g, ' ').trim();

    var recorte = castiga('palabras_muchas') || castiga('largo_alto');
    if (recorte) {
      var pal = t.split(/\s+/).filter(Boolean);
      var tope = castiga('palabras_muchas') ? 11 : pal.length;
      var corto = t;
      while (pal.length > tope) { pal.pop(); corto = pal.join(' '); }
      if (castiga('largo_alto')) {
        while (corto.length > 70 && pal.length > 5) { pal.pop(); corto = pal.join(' '); }
      }
      if (corto !== t) {
        cambios.push({ que: 'Cut the tail down to ' + pal.length + ' words', peso: recorte.peso, duelos: recorte.duelos, gana: recorte.gana });
        t = corto;
      }
    }
    t = t.replace(/[\s,;:.\-\u2013\u2014]+$/, '').trim();

    var subeMayus = tabla.todo_mayusculas && tabla.todo_mayusculas.peso > 0;
    if (subeMayus && !SN.rasgos(t).todo_mayusculas) {
      t = t.toUpperCase();
      cambios.push({ que: 'Set the whole title in capitals', peso: tabla.todo_mayusculas.peso, duelos: tabla.todo_mayusculas.duelos, gana: tabla.todo_mayusculas.gana });
    }

    var despues = puntuar(t, o);
    return {
      original: s, propuesta: t, cambios: cambios,
      antes: antes, despues: despues,
      gana: (despues.bruto || 0) - (antes.bruto || 0),
      sinInventar: true,
      razon: cambios.length ? '' : 'Nothing the calibrated table punishes is present, so the title is left as it is.'
    };
  }

  function ejePackaging(miTitulo, refTitulo, opciones) {
    var mio = String(miTitulo == null ? '' : miTitulo).trim();
    var ref = String(refTitulo == null ? '' : refTitulo).trim();
    if (!mio && !ref) {
      return { estado: 'sin_medir', motivo: 'sin_titulos', mio: null, ref: null, motor: '',
        razon: 'Packaging axis: no title on either side, so nothing was measured.' };
    }
    if (!mio) {
      return { estado: 'sin_medir', motivo: 'sin_mio', mio: null, ref: null, motor: '',
        razon: 'Packaging axis: paste the title you plan to publish and it gets measured against the reference.' };
    }
    if (!ref) {
      return { estado: 'sin_medir', motivo: 'sin_referencia', mio: null, ref: null, motor: '',
        razon: 'Packaging axis: the reference has no title, so there is nothing to measure yours against.' };
    }
    var pa = puntuar(mio, opciones);
    var pb = puntuar(ref, opciones);
    if (pa.motor !== pb.motor) {
      return { estado: 'sin_medir', motivo: 'motores_distintos', mio: null, ref: null, motor: '',
        razon: 'Packaging axis: your title is judged by the ' + motorNombre(pa.motor) + ' engine and the reference by the ' +
          motorNombre(pb.motor) + ' one. Two different scales inside the same margin would not be a measurement.' };
    }
    var cal = pa.calibracion || {};
    return {
      estado: 'medido', motivo: 'mismo_motor', motor: pa.motor,
      mio: pa.puntos, ref: pb.puntos,
      razon: 'Packaging axis measured by the ' + motorNombre(pa.motor) + ' engine' +
        (cal.acierto ? ', which calls ' + cal.acierto + ' per cent of real duels right against ' + (cal.azar || 50) + ' for chance' : '') + '.'
    };
  }

  raiz.NSP_TITULOS = {
    puntuar: puntuar, contra: contra, comparar: comparar, ejePackaging: ejePackaging,
    bisagra: bisagra, contraGanadores: contraGanadores, reescribir: reescribir,
    esMelodrama: esMelodrama, percentil: percentil, TABLA: T
  };
})(typeof window !== 'undefined' ? window : globalThis);
