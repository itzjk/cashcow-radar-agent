(function (raiz) {
  'use strict';

  function mod(nombre) {
    return raiz[nombre] || (typeof globalThis !== 'undefined' && globalThis[nombre]) || null;
  }

  function hay(v) {
    return v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !isFinite(v));
  }

  function red(n, d) {
    var f = Math.pow(10, d == null ? 1 : d);
    return Math.round(n * f) / f;
  }

  var EJES = [
    { id: 'cadencia', eje: 'A video every', unidad: 'days', lee: function (e) { return e.cadencia && e.cadencia.ok ? e.cadencia.cadenciaDias : null; }, mejor: 'menos', brecha: 0.34 },
    { id: 'piso', eje: 'Floor', unidad: 'views', lee: function (e) { return e.cadencia && e.cadencia.ok ? e.cadencia.piso : null; }, mejor: 'mas', brecha: 0.5 },
    { id: 'mediana', eje: 'Median video', unidad: 'views', lee: function (e) { return e.cadencia && e.cadencia.ok ? e.cadencia.mediana : null; }, mejor: 'mas', brecha: 0.5 },
    { id: 'techo', eje: 'Ceiling', unidad: 'views', lee: function (e) { return e.cadencia && e.cadencia.ok ? e.cadencia.techo : null; }, mejor: 'mas', brecha: 0.5 },
    { id: 'ratio', eje: 'Ceiling over floor', unidad: 'x', lee: function (e) { return e.cadencia && e.cadencia.ok ? e.cadencia.ratio : null; }, mejor: 'menos', brecha: 0.5 },
    { id: 'quiebre', eje: 'Best floor lift', unidad: 'x', lee: function (e) { return e.quiebre && e.quiebre.ok ? e.quiebre.salto : null; }, mejor: 'mas', brecha: 0.5 },
    { id: 'edad', eje: 'Age', unidad: 'days', lee: function (e) { return e.edad && e.edad.ok ? e.edad.diasMinimos : null; }, cierta: function (e) { return !!(e.edad && e.edad.ok && e.edad.cierta); }, mejor: 'menos', brecha: 0.5 }
  ];

  var PALABRA = [
    { id: 'luz', eje: 'Engine or luck', lee: function (e) { return e.cadencia && e.cadencia.ok && e.cadencia.suficiente !== false ? e.cadencia.luz : null; }, traduce: { verde: 'engine', ambar: 'look at it', rojo: 'one lucky hit' } },
    { id: 'replicable', eje: 'Rebuildable with AI', lee: function (e) { return e.replicable && e.replicable.ok ? e.replicable.etiqueta : null; } },
    { id: 'nicho', eje: 'Niche read from titles', lee: function (e) { return e.nicho && e.nicho.ok ? (e.nicho.nombre || e.nicho.nicho) : null; } },
    { id: 'veredicto', eje: 'Verdict', lee: function (e) { return e.etiqueta || null; } }
  ];

  function nombreDe(e, porDefecto) {
    return (e && e.canal && (e.canal.nombre || e.canal.handle || e.canal.url)) || porDefecto;
  }

  function comparar(a, b, videosA, videosB) {
    if (!a || !a.ok || !b || !b.ok) {
      return { ok: false, motivo: 'sin_expediente', razon: 'Both channels need a finished dossier before they can be compared.' };
    }

    var nombreA = nombreDe(a, 'Channel A');
    var nombreB = nombreDe(b, 'Channel B');

    var filas = EJES.map(function (x) {
      var va = x.lee(a), vb = x.lee(b);
      if (!hay(va) || !hay(vb)) {
        return {
          id: x.id, eje: x.eje, unidad: x.unidad, a: hay(va) ? va : null, b: hay(vb) ? vb : null,
          estado: 'sin_medir', gana: null,
          razon: !hay(va) && !hay(vb) ? 'Neither side was measured.' : (!hay(va) ? nombreA + ' was not measured.' : nombreB + ' was not measured.')
        };
      }
      var base = Math.max(Math.abs(va), Math.abs(vb));
      var rel = base ? Math.abs(va - vb) / base : 0;
      var separa = rel >= x.brecha;
      var gana = null;
      if (separa) gana = (x.mejor === 'mas') ? (va > vb ? 'a' : 'b') : (va < vb ? 'a' : 'b');
      if (separa && x.cierta) {
        var joven = gana === 'a' ? a : b;
        if (!x.cierta(joven)) {
          return {
            id: x.id, eje: x.eje, unidad: x.unidad, a: va, b: vb,
            estado: 'sin_medir', gana: null, cotas: true,
            razon: (x.cierta(a) || x.cierta(b) ? 'The side that reads younger shows only a lower bound, so it could be the older one.' : 'Both ages are lower bounds from the last uploads read, so they rank nothing.')
          };
        }
      }
      return {
        id: x.id, eje: x.eje, unidad: x.unidad, a: va, b: vb,
        estado: separa ? 'separa' : 'parecidos',
        distancia: red(rel * 100) + '%',
        gana: gana
      };
    });

    filas.forEach(function (f, i) {
      if (!EJES[i].cierta) return;
      f.ciertaA = EJES[i].cierta(a);
      f.ciertaB = EJES[i].cierta(b);
    });

    var palabras = PALABRA.map(function (x) {
      var va = x.lee(a), vb = x.lee(b);
      var ta = x.traduce && x.traduce[va] ? x.traduce[va] : va;
      var tb = x.traduce && x.traduce[vb] ? x.traduce[vb] : vb;
      return {
        id: x.id, eje: x.eje,
        a: hay(ta) ? ta : null, b: hay(tb) ? tb : null,
        estado: (!hay(ta) || !hay(tb)) ? 'sin_medir' : (String(ta) === String(tb) ? 'parecidos' : 'separa')
      };
    });

    var mismoNicho = null;
    var ca = !!(a.nicho && a.nicho.ok && a.nicho.clasificado);
    var cb = !!(b.nicho && b.nicho.ok && b.nicho.clasificado);
    var na = ca ? a.nicho.nicho : null;
    var nb = cb ? b.nicho.nicho : null;
    if (na && nb) mismoNicho = na === nb;

    var titulos = null;
    var F = mod('NSP_RIVAL_FORMULA');
    var listaA = (videosA || []).map(function (v) { return String(v.title || ''); }).filter(Boolean);
    var listaB = (videosB || []).map(function (v) { return String(v.title || ''); }).filter(Boolean);
    if (F && listaA.length && listaB.length) titulos = F.diferenciar(listaA, listaB);

    var separan = filas.filter(function (f) { return f.estado === 'separa'; })
      .concat(palabras.filter(function (f) { return f.estado === 'separa'; }));
    var sinMedir = filas.concat(palabras).filter(function (f) { return f.estado === 'sin_medir'; }).length;

    var resumen = separan.length
      ? separan.length + ' of ' + (filas.length + palabras.length) + ' axes separate them'
      : 'Nothing separates them on the axes measured here';
    if (sinMedir) resumen += ', ' + sinMedir + ' not measured';
    resumen += '.';

    var aviso = '';
    if (mismoNicho === false) aviso = 'The titles read as two different niches, ' + (a.nicho.nombre || na) + ' against ' + (b.nicho.nombre || nb) + '. Compare them anyway if you know they share an audience, but the numbers are not like for like.';
    else if (mismoNicho === null) aviso = 'The niche could not be read on at least one side, so nothing guarantees these two compete for the same viewer.';

    return {
      ok: true,
      a: { nombre: nombreA, url: (a.canal && a.canal.url) || '' },
      b: { nombre: nombreB, url: (b.canal && b.canal.url) || '' },
      filas: filas,
      palabras: palabras,
      separan: separan,
      titulos: titulos,
      mismoNicho: mismoNicho,
      aviso: aviso,
      resumen: resumen
    };
  }

  raiz.NSP_RIVAL_DUELO = { comparar: comparar, EJES: EJES, PALABRA: PALABRA };
})(typeof window !== 'undefined' ? window : globalThis);
