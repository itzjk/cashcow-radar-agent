(function (raiz) {
  'use strict';

  function mod(nombre) {
    return raiz[nombre] || (typeof globalThis !== 'undefined' && globalThis[nombre]) || null;
  }

  function veredicto() { return mod('NSP_VEREDICTO'); }

  var MAX_DIAS_DUENO = 120;

  function red(n, d) {
    var f = Math.pow(10, d == null ? 1 : d);
    return Math.round(n * f) / f;
  }

  function edadDe(videos, canal) {
    var C = mod('NSP_CADENCIA');
    var dias = (videos || []).map(function (v) {
      return v.dias != null ? v.dias : (C ? C.diasDe(v.published || v.cuando) : null);
    }).filter(function (d) { return d != null; });

    if (!dias.length) {
      return { ok: false, razon: 'No video came back with a date, so the channel age cannot be read.' };
    }

    var masViejo = Math.max.apply(null, dias);
    var barridos = (videos || []).length;
    var total = Number(canal && canal.totalVideos) || 0;
    var imposible = total > 0 && total < barridos;
    var completo = total > 0 && total === barridos;

    return {
      ok: true,
      diasMinimos: masViejo,
      cierta: completo,
      cuentaImposible: imposible,
      porQueNoEsCierta: completo ? '' : (imposible
        ? 'the channel reports ' + total + ' videos but ' + barridos + ' were read, which cannot happen, so the count was misread'
        : (total > 0 ? 'only ' + barridos + ' of its ' + total + ' videos were read' : 'the channel does not declare a total')),
      barridos: barridos,
      totalCanal: total || null,
      dice: completo
        ? 'The channel is ' + masViejo + ' days old: the sweep holds all ' + total + ' of its videos, so the oldest one is the first one.'
        : 'The channel is at least ' + masViejo + ' days old. The sweep only reaches ' + barridos + ' videos' + (total ? ' of ' + total : '') + ', so its first video is older than this and the page never says how much.',
      dentroDeLaRegla: completo ? (masViejo <= MAX_DIAS_DUENO) : null,
      reglaDice: completo
        ? (masViejo <= MAX_DIAS_DUENO ? 'Inside the 120 day rule.' : 'Older than the 120 day rule.')
        : 'The 120 day rule cannot be applied: the real opening date is not on the page.'
    };
  }

  var PARTE_MIN = 0.3;

  function votar(videos) {
    var T = mod('NSP_RPM_TABLA');
    if (!T || typeof T.resolver !== 'function') return null;
    var lista = (videos || []).map(function (v) { return String((v && v.title) || ''); }).filter(function (t) { return t.trim(); });
    var cuenta = {}, titulos = {}, orden = [];
    lista.forEach(function (t) {
      var r = T.resolver(t, {});
      if (!r.clasificado) return;
      if (!cuenta[r.label]) { cuenta[r.label] = 0; titulos[r.label] = []; orden.push(r.label); }
      cuenta[r.label]++;
      titulos[r.label].push(t);
    });
    var claves = orden.slice().sort(function (a, b) { return cuenta[b] - cuenta[a] || orden.indexOf(a) - orden.indexOf(b); });
    var top = claves[0] || '';
    var tasa = top ? T.resolver(titulos[top].join(' . '), {}) : null;
    var nombre = function (k) { return typeof T.nombreDe === 'function' ? T.nombreDe(k) : k; };
    var n = lista.length;
    var c = top ? cuenta[top] : 0;
    return {
      n: n,
      label: top,
      name: top ? nombre(top) : '',
      count: c,
      rpm: tasa ? tasa.rpm : null,
      base: tasa ? tasa.base : null,
      medido: !!(tasa && tasa.medido),
      mixed: !top || c < n * PARTE_MIN,
      second: claves[1] ? { label: claves[1], name: nombre(claves[1]), count: cuenta[claves[1]] } : null,
      counts: claves.slice(0, 6).map(function (k) { return { label: k, name: nombre(k), count: cuenta[k] }; })
    };
  }

  function nichoDe(videos) {
    var T = mod('NSP_RPM_TABLA');
    if (!T || typeof T.resolver !== 'function') {
      return { ok: false, razon: 'The niche and RPM table is not loaded on this page.' };
    }
    var texto = (videos || []).map(function (v) { return String(v.title || ''); }).join(' . ');
    if (!texto.trim()) return { ok: false, razon: 'No titles came back, so the niche cannot be read.' };
    var voto = votar(videos);
    var idioma = typeof T.detectarIdioma === 'function' ? T.detectarIdioma(texto) : null;
    var lengua = idioma && idioma.idioma ? idioma.idioma : (typeof idioma === 'string' ? idioma : null);
    if (voto && voto.label && !voto.mixed) {
      return {
        ok: true,
        nicho: voto.label,
        nombre: voto.name || voto.label,
        clasificado: true,
        rpm: voto.rpm,
        rpmBase: voto.base,
        medido: voto.medido,
        idioma: lengua,
        voto: voto,
        dice: 'Niche read title by title as ' + (voto.name || voto.label) + ' (' + voto.count + ' of ' + voto.n + ' titles), reference RPM about $' + voto.rpm + ' per thousand views. An estimate from the table, never the real RPM of this channel.'
      };
    }
    var mercado = typeof T.mercadoDe === 'function' ? T.mercadoDe(texto) : { mult: 1 };
    var suelto = { rpm: parseFloat((T.sinClasificar * (mercado.mult || 1)).toFixed(2)), base: T.sinClasificar };
    return {
      ok: true,
      nicho: '',
      nombre: voto && voto.label ? 'Mixed' : (T.SIN_CLASIFICAR || 'Unclassified'),
      clasificado: false,
      rpm: suelto.rpm,
      rpmBase: suelto.base,
      medido: false,
      idioma: lengua,
      voto: voto,
      dice: voto && voto.label
        ? 'No niche of the table holds a third of the titles: the closest is ' + voto.name + ' in ' + voto.count + ' of ' + voto.n + ', so the niche reads as mixed and the RPM falls back to the unclassified $' + suelto.rpm + '. Treat it as unknown, not as low.'
        : 'The titles do not land in any niche of the table, so the RPM falls back to the unclassified $' + suelto.rpm + '. Treat it as unknown, not as low.'
    };
  }

  function armar(entrada) {
    entrada = entrada || {};
    var videos = entrada.videos || [];
    var canal = entrada.canal || {};
    var V = veredicto();
    var MIRARLO = V ? V.MIRARLO : 'HAY QUE MIRARLO';

    if (!videos.length) {
      return {
        ok: false, motivo: 'sin_barrido',
        veredicto: MIRARLO,
        etiqueta: V ? V.etiqueta(MIRARLO) : 'LOOK AT IT',
        razon: 'The sweep came back with no videos. Nothing was measured, so nothing is decided.'
      };
    }

    var C = mod('NSP_CADENCIA');
    var Q = mod('NSP_RIVAL_QUIEBRE');
    var F = mod('NSP_RIVAL_FORMULA');
    var R = mod('NSP_RIVAL_REPLICABLE');

    var cadencia = C ? C.medir(videos, { now: entrada.now }) : { ok: false, razon: 'The cadence module is not loaded.' };
    var quiebre = Q ? Q.medir(videos) : { ok: false, razon: 'The break module is not loaded.' };
    var formula = F ? F.medir(videos) : { ok: false, razon: 'The formula module is not loaded.' };
    var replicable = R ? R.medir(videos) : { ok: false, razon: 'The replicable module is not loaded.' };
    var edad = edadDe(videos, canal);
    var nicho = nichoDe(videos);
    var estable = quiebre.ok ? quiebre.estable : null;

    var faltan = [];
    if (!cadencia.ok) faltan.push('floor and ceiling');
    else if (cadencia.suficiente === false) faltan.push('enough uploads to judge (' + cadencia.maduros + ' older than ' + cadencia.umbrales.diasMaduro + ' days, ' + cadencia.umbrales.minVeredicto + ' needed)');
    if (!quiebre.ok) faltan.push('the turning point');
    if (!formula.ok) faltan.push('the title formula');
    if (!replicable.ok) faltan.push('the replicable verdict');
    if (!edad.ok) faltan.push('the channel age');

    var palabra, razon;
    if (replicable.ok && V && replicable.veredicto === V.NO_SIRVE) {
      palabra = V.NO_SIRVE;
      razon = 'Ruled out on the camera rule, whatever the numbers say. ' + replicable.razon;
    } else if (faltan.length) {
      palabra = MIRARLO;
      razon = 'Not decided: ' + faltan.join(', ') + ' could not be measured. A verdict on half a measurement is a guess.';
    } else if (V && replicable.veredicto === V.MIRARLO) {
      palabra = MIRARLO;
      razon = 'The titles do not say whether this can be rebuilt with AI. ' + replicable.razon;
    } else if (estable && estable.ok && cadencia.luz !== 'verde') {
      palabra = V ? V.SIRVE : 'SIRVE';
      razon = 'Worth taking apart. ' + estable.dice + ' The last twelve as a block read ' + cadencia.ratio + 'x because a pre break video is still inside that window.';
    } else if (cadencia.luz === 'rojo') {
      palabra = V ? V.NO_SIRVE : 'NO SIRVE';
      razon = 'Nothing to copy: ' + cadencia.dice + ' A ceiling ' + cadencia.ratio + 'x over the floor is one lucky video, not an engine that repeats.' + (estable && estable.razon ? ' ' + estable.razon : '');
    } else if (cadencia.luz === 'verde') {
      palabra = V ? V.SIRVE : 'SIRVE';
      razon = 'Worth taking apart. ' + cadencia.dice + ' Floor ' + cadencia.piso.toLocaleString('en-US') + ' views, ceiling ' + cadencia.techo.toLocaleString('en-US') + ', ratio ' + cadencia.ratio + 'x' + (cadencia.cadenciaDias != null ? ', a video every ' + Math.max(1, Math.round(cadencia.cadenciaDias)) + ' days.' : '.');
    } else {
      palabra = MIRARLO;
      razon = 'Between an engine and a lucky hit at ' + cadencia.ratio + 'x. ' + cadencia.dice + (estable && estable.razon ? ' ' + estable.razon : '');
    }

    return {
      ok: true,
      canal: {
        nombre: canal.nombre || canal.channelName || '',
        url: canal.url || canal.channelUrl || '',
        handle: canal.handle || '',
        subs: canal.subs != null ? canal.subs : null,
        totalVideos: canal.totalVideos != null ? canal.totalVideos : null
      },
      barridos: videos.length,
      edad: edad,
      nicho: nicho,
      cadencia: cadencia,
      quiebre: quiebre,
      formula: formula,
      replicable: replicable,
      faltan: faltan,
      veredicto: palabra,
      etiqueta: V ? V.etiqueta(palabra) : palabra,
      razon: razon,
      cuota: 0,
      fuente: 'The channel /videos page, read the same way the browser reads it. Zero YouTube Data API quota.',
      resumen: [
        edad.ok ? edad.dice : edad.razon,
        cadencia.ok ? ((cadencia.cadenciaDias != null ? 'A video every ' + Math.max(1, Math.round(cadencia.cadenciaDias)) + ' days, floor ' : 'Upload rhythm not measured, floor ') + cadencia.piso.toLocaleString('en-US') + ', ceiling ' + cadencia.techo.toLocaleString('en-US') + ', ratio ' + cadencia.ratio + 'x.') : cadencia.razon,
        quiebre.ok ? quiebre.dice : quiebre.razon,
        estable ? (estable.ok ? estable.dice : estable.razon) : 'The steady run could not be measured.',
        formula.ok ? (formula.razon + (formula.muestra ? ' ' + formula.muestra : '')) : formula.razon,
        replicable.ok ? replicable.razon : replicable.razon,
        nicho.ok ? nicho.dice : nicho.razon
      ]
    };
  }

  raiz.NSP_RIVAL_EXPEDIENTE = {
    armar: armar,
    edadDe: edadDe,
    nichoDe: nichoDe,
    votar: votar,
    PARTE_MIN: PARTE_MIN,
    MAX_DIAS_DUENO: MAX_DIAS_DUENO,
    red: red
  };
})(typeof window !== 'undefined' ? window : globalThis);
