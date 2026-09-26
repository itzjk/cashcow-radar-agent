(function (raiz) {
  'use strict';

  var CLAVE = 'nsp_dinero_tarifas_v1';

  var CARRILES = [
    { id: 'voz_local', parte: 'voice', etiqueta: 'Local voice engine', tarifa: null, unidad: null, consumo: null, gasto: null,
      nota: 'No cash leaves the account. Your machine time is not priced here, because nobody measured it.' },
    { id: 'voz_fish', parte: 'voice', etiqueta: 'Fish Audio', tarifa: 'fish_por_1000_caracteres', unidad: 1000, consumo: 'caracteresNarracion', gasto: 'transcripcion',
      nota: 'Charged on the characters of the script it reads out.' },
    { id: 'imagen_local', parte: 'image', etiqueta: 'Local images', tarifa: null, unidad: null, consumo: null, gasto: null,
      nota: 'No cash leaves the account.' },
    { id: 'imagen_gemini', parte: 'image', etiqueta: 'Gemini images', tarifa: 'gemini_por_imagen', unidad: 1, consumo: 'imagenes', gasto: 'vision',
      nota: 'Charged per image generated.' },
    { id: 'video_ninguno', parte: 'video', etiqueta: 'No generated video', tarifa: null, unidad: null, consumo: null, gasto: null,
      nota: 'Stills and motion from the editor only.' },
    { id: 'video_gemini', parte: 'video', etiqueta: 'Gemini video', tarifa: 'gemini_por_segundo_video', unidad: 1, consumo: 'segundosVideo', gasto: 'vision',
      nota: 'Charged per second of generated footage.' }
  ];

  var TARIFAS_VACIAS = { fish_por_1000_caracteres: null, gemini_por_imagen: null, gemini_por_segundo_video: null, moneda: 'USD' };

  var AVISO_GASTO = 'A saved key is not permission to spend. Every paid lane stays shut until you open its gate, and this page never opens one.';

  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = typeof x === 'number' ? x : parseFloat(String(x).replace(/[\s,]/g, ''));
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  function dec(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }

  function dinero(x) {
    var t = dec(x, 4).toFixed(4);
    while (t.length > t.indexOf('.') + 3 && t.charAt(t.length - 1) === '0') t = t.slice(0, -1);
    return '$' + t;
  }

  function carrilDe(id) {
    for (var i = 0; i < CARRILES.length; i++) if (CARRILES[i].id === id) return CARRILES[i];
    return null;
  }

  function normalizarTarifas(bruto) {
    var b = bruto || {};
    return {
      fish_por_1000_caracteres: num(b.fish_por_1000_caracteres),
      gemini_por_imagen: num(b.gemini_por_imagen),
      gemini_por_segundo_video: num(b.gemini_por_segundo_video),
      moneda: String(b.moneda || 'USD').slice(0, 8)
    };
  }

  function costeCarril(id, consumo, tarifas) {
    var c = carrilDe(id);
    if (!c) return { ok: false, id: id, motivo: 'carril_desconocido', porque: 'There is no lane called ' + id + '. I will not price a lane I do not know.' };
    if (!c.tarifa) {
      return { ok: true, id: id, parte: c.parte, etiqueta: c.etiqueta, gratis: true, usd: 0, sinTarifa: false,
        cuenta: c.etiqueta + ': ' + c.nota, gasto: null };
    }
    var t = normalizarTarifas(tarifas);
    var tarifa = t[c.tarifa];
    var uso = num((consumo || {})[c.consumo]);
    if (tarifa === null) {
      return { ok: true, id: id, parte: c.parte, etiqueta: c.etiqueta, gratis: false, usd: null, sinTarifa: true, gasto: c.gasto,
        cuenta: c.etiqueta + ': no rate set. I will not invent a price, so this lane has no cost, not a cost of zero.' };
    }
    if (uso === null) {
      return { ok: true, id: id, parte: c.parte, etiqueta: c.etiqueta, gratis: false, usd: null, sinConsumo: true, sinTarifa: false, gasto: c.gasto,
        cuenta: c.etiqueta + ': rate is ' + dinero(tarifa) + ' but the amount used is empty. An empty box is not a zero.' };
    }
    var usd = uso / c.unidad * tarifa;
    var linea = c.unidad === 1
      ? c.etiqueta + ': ' + dec(uso, 2) + ' x ' + dinero(tarifa) + ' = ' + dinero(usd)
      : c.etiqueta + ': ' + dec(uso, 0) + ' / ' + c.unidad + ' x ' + dinero(tarifa) + ' = ' + dinero(usd);
    return { ok: true, id: id, parte: c.parte, etiqueta: c.etiqueta, gratis: false, usd: dec(usd, 4), sinTarifa: false, gasto: c.gasto, cuenta: linea };
  }

  function costePorVideo(entrada) {
    var e = entrada || {};
    var elegidas = Array.isArray(e.elegidas) ? e.elegidas : [];
    if (!elegidas.length) return { ok: false, motivo: 'sin_carriles', porque: 'Pick a lane for voice, images and video first.' };
    var lineas = [], total = 0, faltan = [], gates = {};
    for (var i = 0; i < elegidas.length; i++) {
      var r = costeCarril(elegidas[i], e.consumo, e.tarifas);
      if (!r.ok) return { ok: false, motivo: r.motivo, porque: r.porque };
      lineas.push(r);
      if (r.gasto) gates[r.gasto] = true;
      if (r.usd === null) faltan.push(r.etiqueta);
      else total += r.usd;
    }
    var incompleto = faltan.length > 0;
    return {
      ok: true,
      lineas: lineas,
      usdPorVideo: incompleto ? null : dec(total, 4),
      incompleto: incompleto,
      faltan: faltan,
      puertasDeGasto: Object.keys(gates),
      gastoPermitido: false,
      avisoGasto: AVISO_GASTO,
      porque: incompleto
        ? 'No total. ' + faltan.join(' and ') + ' has no rate or no amount, and a missing number is not a zero.'
        : 'Cost per video ' + dinero(total) + ' over the lanes you picked.'
    };
  }

  function comparar(entrada) {
    var e = entrada || {};
    var conocidas = [], desconocidas = [];
    for (var i = 0; i < CARRILES.length; i++) {
      var r = costeCarril(CARRILES[i].id, e.consumo, e.tarifas);
      if (r.usd === null) desconocidas.push(r); else conocidas.push(r);
    }
    conocidas.sort(function (a, b) { return a.usd - b.usd; });
    return {
      ok: true,
      conocidas: conocidas,
      desconocidas: desconocidas,
      gastoPermitido: false,
      avisoGasto: AVISO_GASTO,
      porque: desconocidas.length
        ? conocidas.length + ' lane(s) priced, ' + desconocidas.length + ' with no rate set. The ones with no rate are not cheapest, they are unknown.'
        : conocidas.length + ' lane(s) priced.'
    };
  }

  function hayChrome() {
    return typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local;
  }

  function leerTarifas() {
    return new Promise(function (listo) {
      if (!hayChrome()) {
        try {
          var s = localStorage.getItem(CLAVE);
          listo(normalizarTarifas(s ? JSON.parse(s) : null));
        } catch (e) { listo(normalizarTarifas(null)); }
        return;
      }
      try {
        chrome.storage.local.get(CLAVE, function (r) { listo(normalizarTarifas(r && r[CLAVE])); });
      } catch (e) { listo(normalizarTarifas(null)); }
    });
  }

  function guardarTarifas(bruto) {
    var t = normalizarTarifas(bruto);
    return new Promise(function (listo) {
      if (!hayChrome()) {
        try { localStorage.setItem(CLAVE, JSON.stringify(t)); listo(t); } catch (e) { listo(t); }
        return;
      }
      try {
        var carga = {}; carga[CLAVE] = t;
        chrome.storage.local.set(carga, function () { listo(t); });
      } catch (e) { listo(t); }
    });
  }

  raiz.NspDineroCoste = {
    CLAVE: CLAVE,
    CARRILES: CARRILES,
    TARIFAS_VACIAS: TARIFAS_VACIAS,
    AVISO_GASTO: AVISO_GASTO,
    normalizarTarifas: normalizarTarifas,
    costeCarril: costeCarril,
    costePorVideo: costePorVideo,
    comparar: comparar,
    leerTarifas: leerTarifas,
    guardarTarifas: guardarTarifas
  };
})(typeof window !== 'undefined' ? window : globalThis);
