(function (raiz) {
  'use strict';

  var NEG = /\b(never|nunca|nadie|nada|jamais|personne|niemand|kein|keine|nie|n[aã]o|ningu[eé]m|nobody|sin|ohne|sans|sem)\b/i;
  var PREG = /\b(why|how|what|who|when|where|por qu[eé]|c[oó]mo|qu[eé]|qui[eé]n|d[oó]nde|warum|wie|was|wer|wo|pourquoi|comment|quoi|o[uù]|como|quem|onde|porque)\b/i;
  var EXT = /\b(worst|best|biggest|deadliest|most|only|first|last|peor|mejor|mayor|[uú]nico|primer|[uú]ltimo|schlimmste|beste|gr[oö][sß]te|einzige|erste|letzte|pire|meilleur|seul|premier|dernier|pior|melhor|maior|primeiro)\b/i;
  var REV = /\b(secret|truth|revealed|hidden|shocking|forbidden|exposed|mystery|secreto|verdad|oculto|revelad|prohibid|misterio|geheim|wahrheit|versteckt|verboten|r[äa]tsel|v[ée]rit[ée]|cach[ée]|interdit|myst[èe]re|segredo|verdade|proibid|mist[ée]rio)\b/i;
  var BIS = /(\buntil\b|\bbut then\b|hasta que|sin saber|no sab[ií]a|jusqu.?a|\bbis\b|at[ée] que|pero entonces|doch dann|mais ensuite|then this|what happened)/i;
  var PERS = /\b(you|your|yours|tu|tus|tuyo|te|usted|dein|deine|dich|du|votre|vous|ton|ta|seu|sua|voc[eê])\b/i;

  function rasgos(entrada) {
    var s = String(entrada == null ? '' : entrada);
    var letras = s.replace(/[^\p{L}]/gu, '');
    var mayus = s.replace(/[^\p{Lu}]/gu, '').length;
    var palabras = s.split(/\s+/).filter(Boolean);
    return {
      cifra: /\d/.test(s),
      numero_grande: /\b\d{3,}/.test(s),
      anio: /\b(1[89]\d\d|20[0-4]\d)\b/.test(s),
      dos_puntos: /:/.test(s),
      barra: /[|｜]/.test(s),
      guion_sep: /\s[-\u2013\u2014]\s/.test(s),
      suspensivos: /\.\.\.|…/.test(s),
      comillas: /["“”«»]/.test(s),
      corchetes: /[\[\]()]/.test(s),
      interrogacion: /[?¿]/.test(s),
      exclamacion: /[!¡]/.test(s),
      emoji: /\p{Extended_Pictographic}/u.test(s),
      todo_mayusculas: !!letras && mayus / letras.length > 0.6,
      largo_alto: s.length > 70,
      largo_corto: s.length <= 45,
      palabras_muchas: palabras.length >= 12,
      bisagra: BIS.test(s),
      negacion: NEG.test(s),
      pregunta: PREG.test(s),
      extremo: EXT.test(s),
      revelacion: REV.test(s),
      segunda: PERS.test(s)
    };
  }

  var CLAVES = Object.keys(rasgos('x'));

  var ETIQUETA = {
    cifra: 'a number in the title',
    numero_grande: 'a number of three digits or more',
    anio: 'a year',
    dos_puntos: 'a colon splitting the title',
    barra: 'a pipe splitting the title',
    guion_sep: 'a dash splitting the title',
    suspensivos: 'an ellipsis holding the payoff back',
    comillas: 'quoted speech',
    corchetes: 'a bracketed tag',
    interrogacion: 'a question mark',
    exclamacion: 'an exclamation mark',
    emoji: 'an emoji',
    todo_mayusculas: 'mostly capital letters',
    largo_alto: 'over 70 characters',
    largo_corto: '45 characters or fewer',
    palabras_muchas: '12 words or more',
    bisagra: 'a hinge that turns the story',
    negacion: 'a negation',
    pregunta: 'an open question word',
    extremo: 'a superlative',
    revelacion: 'a promise of something hidden',
    segunda: 'second person address'
  };

  function duelos(videos, minPorCanal, ratio) {
    var porCanal = {};
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      var c = v.canal;
      if (!c || !(v.vph > 0)) continue;
      (porCanal[c] = porCanal[c] || []).push(v);
    }
    var salida = [];
    Object.keys(porCanal).forEach(function (c) {
      var g = porCanal[c];
      if (g.length < minPorCanal) return;
      for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) {
        var hi = Math.max(g[i].vph, g[j].vph), lo = Math.min(g[i].vph, g[j].vph);
        if (lo <= 0 || hi / lo < ratio) continue;
        salida.push(g[i].vph > g[j].vph ? [g[i], g[j]] : [g[j], g[i]]);
      }
    });
    return salida;
  }

  function aprender(listaDuelos, minDuelos, minZ) {
    var tabla = {};
    for (var k = 0; k < CLAVES.length; k++) {
      var clave = CLAVES[k], gana = 0, total = 0;
      for (var i = 0; i < listaDuelos.length; i++) {
        var a = rasgos(listaDuelos[i][0].titulo)[clave];
        var b = rasgos(listaDuelos[i][1].titulo)[clave];
        if (a === b) continue;
        total++;
        if (a) gana++;
      }
      if (total < minDuelos) continue;
      var p = (gana + 2) / (total + 4);
      var z = (p - 0.5) / Math.sqrt(0.25 / total);
      if (Math.abs(z) < minZ) continue;
      tabla[clave] = { peso: Math.round((p - 0.5) * 200), duelos: total, gana: Math.round(gana / total * 1000) / 10 };
    }
    return tabla;
  }

  function puntuarCon(titulo, tabla) {
    var f = rasgos(titulo), bruto = 0, aFavor = [], enContra = [];
    for (var i = 0; i < CLAVES.length; i++) {
      var k = CLAVES[i];
      if (!f[k] || !tabla || !tabla[k]) continue;
      var e = tabla[k];
      bruto += e.peso;
      var fila = { clave: k, etiqueta: ETIQUETA[k] || k, peso: e.peso, duelos: e.duelos, gana: e.gana };
      (e.peso < 0 ? enContra : aFavor).push(fila);
    }
    aFavor.sort(function (a, b) { return b.peso - a.peso; });
    enContra.sort(function (a, b) { return a.peso - b.peso; });
    return { bruto: bruto, aFavor: aFavor, enContra: enContra };
  }

  raiz.NSP_TITULOS_SENALES = {
    rasgos: rasgos, CLAVES: CLAVES, ETIQUETA: ETIQUETA,
    duelos: duelos, aprender: aprender, puntuarCon: puntuarCon
  };
})(typeof window !== 'undefined' ? window : globalThis);
