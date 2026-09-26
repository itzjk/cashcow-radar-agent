(function (raiz) {
  'use strict';

  function limpio(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function paquete() {
    return raiz.NSP_PACKAGING || (typeof NSP_PACKAGING !== 'undefined' ? NSP_PACKAGING : null);
  }

  var FORMA = [
    { id: 'bisagra_puntos', etiqueta: 'Ellipsis hinge', mide: function (crudo) { return /…|\.\.\./.test(crudo); } },
    { id: 'bisagra_raya', etiqueta: 'Dash hinge', mide: function (crudo) { return /\u2014|\u2013|\s-\s/.test(crudo); } },
    { id: 'dialogo', etiqueta: 'Quoted dialogue', mide: function (crudo) { return /["“”«»‘’][^"“”«»‘’]{3,}/.test(crudo); } },
    { id: 'pregunta', etiqueta: 'Question mark', mide: function (crudo) { return /[?¿]/.test(crudo); } },
    { id: 'cifra', etiqueta: 'A number in the title', mide: function (crudo) { return /\d/.test(crudo); } },
    { id: 'gritado', etiqueta: 'Written in capitals', mide: function (crudo) {
      var letras = crudo.replace(/[^\p{L}]/gu, '');
      if (letras.length < 12) return false;
      var altas = letras.replace(/[^\p{Lu}]/gu, '').length;
      return altas / letras.length >= 0.7;
    } },
    { id: 'corto', etiqueta: 'Under 60 characters', mide: function (crudo) { return crudo.length < 60; } },
    { id: 'largo', etiqueta: 'Over 95 characters', mide: function (crudo) { return crudo.length > 95; } }
  ];

  var FONDO = [
    { id: 'parentesco', etiqueta: 'A family role', re: /\b(viuda|viudo|madre|padre|hermano|hermana|nuera|yerno|suegra|suegro|hija|hijo|esposa|esposo|abuelo|abuela|nieto|nieta|widow|mother|father|brother|sister|daughter|son|husband|wife|grandmother|grandfather|mutter|vater|bruder|schwester|tochter|sohn|witwe|schwiegermutter|m[eè]re|p[eè]re|fr[eè]re|soeur|fille|veuve|belle[- ]m[eè]re|mor|far|bror|s[oø]ster|datter|s[oø]n|enke)\b/ },
    { id: 'clase', etiqueta: 'Rich against poor', re: /\b(hacendado|hacendada|patron|patrona|terrateniente|rico|rica|pobre|peon|peona|criada|criado|sirvienta|jornalero|millonario|rich|poor|wealthy|landlord|maid|servant|beggar|millionaire|reich|arm|magd|diener|millionar|riche|pauvre|servante|patron|rig|fattig|tjener)\b/ },
    { id: 'burla', etiqueta: 'They mocked or humiliated', re: /\b(se rieron|se rio|se burlaron|burlaron|humillaron|despreciaron|se rieron de|laughed at|mocked|humiliated|made fun|lachten|verspottet|gedem[uu]tigt|se moqu|rirent|humili|lo de|h[aa]nte|ydmyg)\b/ },
    { id: 'secreto', etiqueta: 'A secret or a hidden truth', re: /\b(secreto|secreta|oculto|oculta|escondi|la verdad|sin saber|nadie sabia|secret|hidden|truth|nobody knew|without knowing|geheim|versteckt|wahrheit|ohne zu wissen|secr[eè]t|cach[ée]|v[ée]rit[ée]|sans savoir|hemmelig|skjult|sandhed)\b/ },
    { id: 'dinero', etiqueta: 'Money, land or inheritance', re: /\b(herencia|hacienda|rancho|finca|tierra|tierras|dinero|fortuna|millones|deuda|subasta|inheritance|estate|ranch|farm|land|money|fortune|debt|auction|erbe|hof|geld|verm[oo]gen|schuld|h[ée]ritage|ferme|terre|argent|dette|arv|g[aa]rd|jord|penge|g[ae]ld)\b/ },
    { id: 'muerte', etiqueta: 'A death or a funeral', re: /\b(muri[oo]|muerte|funeral|entierro|tumba|viuda|died|death|funeral|grave|starb|tod|beerdigung|grab|mourut|mort|fun[ée]railles|tombe|d[oø]de|d[oø]d|begravelse|grav)\b/ },
    { id: 'giro_temporal', etiqueta: 'A jump in time', re: /(\b\d+\s*(a[nñ]os|meses|semanas|dias|d[íi]as|years?|months?|weeks?|days?|jahre|monate|wochen|tage|ans|mois|semaines|jours|[aa]r|m[aa]neder|uger|dage)\s*(despues|despu[ée]s|later|sp[aa]ter|plus tard|senere)|\b(despues|despu[ée]s|later|sp[aa]ter|plus tard|senere)\b)/ },
    { id: 'nino', etiqueta: 'A child or a baby', re: /\b(ni[nñ]o|ni[nñ]a|bebe|beb[ée]|child|baby|kid|kind|s[aa]ugling|enfant|b[ée]b[ée]|barn|baby)\b/ }
  ];

  var PRESTADOS = [
    { id: 'agro', etiqueta: 'Farming technique as the premise', lista: 'AGRO' }
  ];

  function rasgos(titulo) {
    var crudo = String(titulo || '');
    var t = limpio(crudo);
    var puestos = [];
    FORMA.forEach(function (r) { if (r.mide(crudo, t)) puestos.push(r.id); });
    FONDO.forEach(function (r) { if (r.re.test(t)) puestos.push(r.id); });
    var pk = paquete();
    if (pk) {
      PRESTADOS.forEach(function (r) {
        var lista = pk[r.lista];
        if (!lista) return;
        for (var i = 0; i < lista.length; i++) {
          if (t.indexOf(limpio(lista[i])) >= 0) { puestos.push(r.id); return; }
        }
      });
    }
    return puestos;
  }

  function etiquetaDe(id) {
    for (var i = 0; i < FORMA.length; i++) if (FORMA[i].id === id) return FORMA[i].etiqueta;
    for (var j = 0; j < FONDO.length; j++) if (FONDO[j].id === id) return FONDO[j].etiqueta;
    for (var k = 0; k < PRESTADOS.length; k++) if (PRESTADOS[k].id === id) return PRESTADOS[k].etiqueta;
    return id;
  }

  function noMedidos() {
    if (paquete()) return [];
    return PRESTADOS.map(function (r) { return r.etiqueta; });
  }

  function mediana(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }

  function red(n, d) {
    var f = Math.pow(10, d == null ? 2 : d);
    return Math.round(n * f) / f;
  }

  var CORTE = 0.25;
  var Z_PROBADO = 2;
  var Z_APUNTA = 1.3;
  var COMUN = 0.8;

  function fuerzaDe(ca, na, cb, nb) {
    var fa = ca / na, fb = cb / nb;
    var d = fa - fb;
    var p = (ca + cb) / (na + nb);
    var se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
    var z = se > 0 ? d / se : 0;
    var az = Math.abs(z);
    var fuerza = 'ruido';
    if (Math.abs(d) >= CORTE) {
      if (az >= Z_PROBADO) fuerza = 'probado';
      else if (az >= Z_APUNTA) fuerza = 'apunta';
    }
    return { d: d, z: z, fuerza: fuerza };
  }

  function diferenciar(gana, pierde) {
    var A = (gana || []).map(rasgos);
    var B = (pierde || []).map(rasgos);
    if (!A.length || !B.length) {
      return { ok: false, motivo: 'sin_lados', razon: 'One of the two sides is empty, so nothing can be compared.' };
    }

    var ids = {};
    A.concat(B).forEach(function (lista) { lista.forEach(function (id) { ids[id] = 1; }); });

    var filas = Object.keys(ids).map(function (id) {
      var ca = A.filter(function (l) { return l.indexOf(id) >= 0; }).length;
      var cb = B.filter(function (l) { return l.indexOf(id) >= 0; }).length;
      var fa = ca / A.length, fb = cb / B.length;
      var f = fuerzaDe(ca, A.length, cb, B.length);
      return {
        id: id, etiqueta: etiquetaDe(id),
        enGana: ca, deGana: A.length, enPierde: cb, dePierde: B.length,
        fracGana: red(fa), fracPierde: red(fb),
        diferencia: red(f.d),
        z: red(f.z, 2),
        fuerza: f.fuerza,
        comun: fa >= COMUN && fb >= COMUN,
        lado: fa > fb ? 'gana' : (fb > fa ? 'pierde' : 'igual')
      };
    }).sort(function (x, y) { return Math.abs(y.z) - Math.abs(x.z); });

    var probados = filas.filter(function (f) { return f.fuerza === 'probado'; });
    var apuntan = filas.filter(function (f) { return f.fuerza === 'apunta'; });
    var separan = probados.concat(apuntan);
    var comunes = filas.filter(function (f) { return f.comun; });

    var razon;
    if (probados.length) {
      razon = probados.length + ' trait(s) proven over ' + A.length + ' against ' + B.length + ' titles';
      if (apuntan.length) razon += ', and ' + apuntan.length + ' more that only lean';
      razon += '.';
    } else if (apuntan.length) {
      razon = 'Nothing is proven on ' + A.length + ' against ' + B.length + ' titles. ' + apuntan.length + ' trait(s) lean but stay inside what chance can produce at this sample size. Sweep more channels in the niche before copying them.';
    } else {
      razon = 'No title trait separates the two sides. The titles do not explain the gap, so the formula is not in the title. Look at the thumbnail, the topic or the upload rhythm.';
    }

    return {
      ok: true,
      separa: probados.length > 0,
      apunta: apuntan.length > 0,
      corte: CORTE,
      zProbado: Z_PROBADO,
      todos: filas,
      separan: separan,
      probados: probados,
      apuntan: apuntan,
      comunes: comunes,
      suben: separan.filter(function (f) { return f.lado === 'gana'; }),
      hunden: separan.filter(function (f) { return f.lado === 'pierde'; }),
      sinMedir: noMedidos(),
      razon: razon
    };
  }

  var MINIMO_VIDEOS = 10;
  var CUANTOS = 10;
  var BRECHA_MINIMA = 3;

  function medir(videos, opciones) {
    opciones = opciones || {};
    var lista = (videos || []).map(function (v) {
      return {
        videoId: v.videoId || '',
        title: String(v.title || ''),
        views: Number(v.viewsNum != null ? v.viewsNum : v.views) || 0
      };
    }).filter(function (v) { return v.title && v.views > 0; });

    if (lista.length < MINIMO_VIDEOS) {
      return { ok: false, motivo: 'pocos_videos', razon: 'Only ' + lista.length + ' videos carry both a title and a view count. The split needs at least ' + MINIMO_VIDEOS + '.' };
    }

    var orden = lista.slice().sort(function (a, b) { return b.views - a.views; });
    var cuantos = Math.min(opciones.cuantos || CUANTOS, Math.floor(orden.length / 2));
    var arriba = orden.slice(0, cuantos);
    var abajo = orden.slice(orden.length - cuantos);

    var medArriba = mediana(arriba.map(function (v) { return v.views; }));
    var medAbajo = mediana(abajo.map(function (v) { return v.views; }));
    var brecha = medAbajo > 0 ? medArriba / medAbajo : 0;

    if (brecha < BRECHA_MINIMA) {
      return {
        ok: true, separa: false, plano: true,
        cuantos: cuantos, medianaArriba: medArriba, medianaAbajo: medAbajo, brecha: red(brecha, 1),
        razon: 'The best and the worst are only ' + red(brecha, 1) + 'x apart, under the ' + BRECHA_MINIMA + 'x this needs. There is no winning half to copy: the channel is flat.'
      };
    }

    var d = diferenciar(arriba.map(function (v) { return v.title; }), abajo.map(function (v) { return v.title; }));
    if (!d.ok) return d;

    return {
      ok: true,
      separa: d.separa,
      apunta: d.apunta,
      plano: false,
      cuantos: cuantos,
      medianaArriba: medArriba,
      medianaAbajo: medAbajo,
      brecha: red(brecha, 1),
      arriba: arriba,
      abajo: abajo,
      separan: d.separan,
      probados: d.probados,
      apuntan: d.apuntan,
      comunes: d.comunes,
      suben: d.suben,
      hunden: d.hunden,
      todos: d.todos,
      corte: d.corte,
      sinMedir: d.sinMedir,
      razon: d.razon,
      muestra: 'Top ' + cuantos + ' at a median of ' + Math.round(medArriba).toLocaleString('en-US') + ' views against the bottom ' + cuantos + ' at ' + Math.round(medAbajo).toLocaleString('en-US') + '.'
    };
  }

  raiz.NSP_RIVAL_FORMULA = {
    rasgos: rasgos,
    etiquetaDe: etiquetaDe,
    diferenciar: diferenciar,
    fuerzaDe: fuerzaDe,
    medir: medir,
    FORMA: FORMA,
    FONDO: FONDO,
    PRESTADOS: PRESTADOS,
    CORTE: CORTE,
    Z_PROBADO: Z_PROBADO,
    Z_APUNTA: Z_APUNTA,
    BRECHA_MINIMA: BRECHA_MINIMA,
    MINIMO_VIDEOS: MINIMO_VIDEOS
  };
})(typeof window !== 'undefined' ? window : globalThis);
