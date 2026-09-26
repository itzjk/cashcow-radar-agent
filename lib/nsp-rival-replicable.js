(function (raiz) {
  'use strict';

  function veredicto() {
    return raiz.NSP_VEREDICTO || (typeof NSP_VEREDICTO !== 'undefined' ? NSP_VEREDICTO : null);
  }

  function limpio(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  var CAMARA = [
    { id: 'proceso', etiqueta: 'A process filmed on site', re: /\b(como se (fabrica|hace|construye|produce)|how (it'?s|its) made|inside the factory|factory tour|production line|linea de produccion|fabrica de|wie (wird|es) (gemacht|hergestellt)|fabrikbesichtigung|usine|cha[iî]ne de production|fabriksbes[oø]g)\b/ },
    { id: 'manos', etiqueta: 'Hands on a repair or a build', re: /\b(restauracion|restaurando|restoration|restoring|rebuild|rebuilt|teardown|i built|we built|construi|lo constru[ií]|repar[ée] (mi|el|la)|fixing my|watch me (build|fix|make)|time ?lapse de (mi|la|el)|selbst gebaut|eigenbau|j'ai construit|jeg byggede|byggede jeg)\b/ },
    { id: 'lugar', etiqueta: 'Somebody travelled there', re: /\b(visitamos|visite (la|el|los)|fui a|fuimos a|we visited|i went to|we went to|walking tour|street tour|road trip|vlog|wir besuchten|ich war in|besuch in|nous avons visit[ée]|je suis all[ée] [aà]|vi bes[oø]gte)\b/ },
    { id: 'fauna', etiqueta: 'Real wildlife footage', re: /\b(caught on camera|captado por la camara|grabado en video|filmed in the wild|trail ?cam|camara trampa|documental de (fauna|vida salvaje)|wildlife documentary|nature cam|live cam|en directo desde|live from the)\b/ },
    { id: 'persona', etiqueta: 'A person on camera', re: /\b(entrevista con|interview with|q&a|storytime|story time|day in (my|the) life|un dia en mi vida|mi rutina|my routine|face ?cam|talking head|en vivo|live stream|directo|podcast con|reaccion a|reaction to|react to)\b/ },
    { id: 'receta', etiqueta: 'Cooking or a craft shown step by step', re: /\b(receta paso a paso|step by step recipe|cooking with me|cocina conmigo|tutorial de (maquillaje|costura|carpinteria)|makeup tutorial|sewing tutorial|woodworking|schritt f[uü]r schritt rezept|recette [ée]tape par [ée]tape)\b/ }
  ];

  var ANIMACION = [
    { id: 'animacion', etiqueta: 'Animated, so nothing has to be filmed',
      re: /(animad[oa]s?|animaci[oó]n|anima[cç][aã]o|desenho animado|dibujos animados|animated|animation|cartoons?|animiert|zeichentrick|anim[eé]s?|dessin anim[eé]|アニメ|アニメーション|动画|動畫|애니메이션|애니)/i }
  ];

  var RELATO = [
    { id: 'drama', etiqueta: 'A narrated story', re: /\b(se rieron|se burlaron|humillaron|sin saber|hasta que|nadie sabia|la traicionaron|lo echaron|la echaron|laughed at|mocked her|mocked him|without knowing|until (she|he|they)|nobody knew|betrayed (her|him)|lachten [uu]ber|ohne zu wissen|bis (sie|er)|se moquaient|sans savoir|jusqu'a ce que|de grinede|uden at vide)\b/ },
    { id: 'explicado', etiqueta: 'An explainer', re: /\b(explicado|explicacion|por que|que paso|que pasaria|explained|why (did|is|are|do)|what happened|what if|how it works|erkl[aä]rt|warum|was (waere|wäre) wenn|expliqu[ée]|pourquoi|que s'est[- ]il pass[ée]|forklaret|hvorfor)\b/ },
    { id: 'lista', etiqueta: 'A list or a ranking', re: /(^|\s)(top\s*\d+|los\s*\d+|die\s*top\s*\d+|\d+\s*(datos|hechos|cosas|facts|things|fakten|sachen|choses|ting)|iceberg|ranking|tier list)\b/ },
    { id: 'historia', etiqueta: 'History or mythology told over stills', re: /\b(la historia de|the story of|the history of|die geschichte von|l'histoire de|historien om|imperio|empire|civilizacion|civilization|mitolog|mytholog|antigua|ancient|edad media|middle ages|mittelalter)\b/ },
    { id: 'dormir', etiqueta: 'Sleep or relax narration', re: /\b(para dormir|historias para dormir|sleep story|bedtime story|fall asleep|zum einschlafen|einschlafgeschichte|pour dormir|histoire pour dormir|godnathistorie)\b/ }
  ];

  function deTitulo(titulo) {
    var t = limpio(titulo);
    var conCamara = [], conRelato = [], conAnimacion = [];
    CAMARA.forEach(function (m) { if (m.re.test(t)) conCamara.push(m.id); });
    RELATO.forEach(function (m) { if (m.re.test(t)) conRelato.push(m.id); });
    ANIMACION.forEach(function (m) {
      if (m.re.test(t) || m.re.test(String(titulo || ''))) conAnimacion.push(m.id);
    });
    var clase = conAnimacion.length ? 'animacion'
      : (conCamara.length ? 'camara' : (conRelato.length ? 'relato' : 'mudo'));
    return { titulo: String(titulo || ''), clase: clase, camara: conCamara, relato: conRelato, animacion: conAnimacion };
  }

  function etiquetaDe(id) {
    for (var i = 0; i < CAMARA.length; i++) if (CAMARA[i].id === id) return CAMARA[i].etiqueta;
    for (var j = 0; j < RELATO.length; j++) if (RELATO[j].id === id) return RELATO[j].etiqueta;
    return id;
  }

  var CAMARA_MATA = 0.30;
  var CAMARA_TOLERA = 0.10;
  var RELATO_APRUEBA = 0.40;
  var MUDO_MAXIMO = 0.60;
  var MINIMO = 8;

  function medir(videos, opciones) {
    opciones = opciones || {};
    var V = veredicto();
    var MIRARLO = V ? V.MIRARLO : 'HAY QUE MIRARLO';
    var titulos = (videos || []).map(function (v) { return String(v.title || v || ''); }).filter(function (t) { return t.trim(); });

    if (titulos.length < MINIMO) {
      return {
        ok: false, motivo: 'pocos_titulos',
        veredicto: MIRARLO,
        etiqueta: V ? V.etiqueta(V.MIRARLO) : 'LOOK AT IT',
        razon: 'Only ' + titulos.length + ' titles came back. This verdict needs at least ' + MINIMO + ' before it says anything about a channel.'
      };
    }

    var filas = titulos.map(deTitulo);
    var nCamara = filas.filter(function (f) { return f.clase === 'camara'; }).length;
    var nRelato = filas.filter(function (f) { return f.clase === 'relato'; }).length;
    var nMudo = filas.filter(function (f) { return f.clase === 'mudo'; }).length;
    var n = filas.length;

    var fCamara = nCamara / n, fRelato = nRelato / n, fMudo = nMudo / n;

    var cuenta = {};
    filas.forEach(function (f) {
      f.camara.concat(f.relato).forEach(function (id) { cuenta[id] = (cuenta[id] || 0) + 1; });
    });
    var marcas = Object.keys(cuenta).map(function (id) {
      return { id: id, etiqueta: etiquetaDe(id), veces: cuenta[id], deCamara: CAMARA.some(function (m) { return m.id === id; }) };
    }).sort(function (a, b) { return b.veces - a.veces; });

    var palabra, razon;
    if (fCamara >= CAMARA_MATA) {
      palabra = V ? V.NO_SIRVE : 'NO SIRVE';
      razon = nCamara + ' of ' + n + ' titles need somebody on site with a camera. That is above the ' + Math.round(CAMARA_MATA * 100) + ' out of 100 that rules a channel out, and no amount of views changes it.';
    } else if (fMudo > MUDO_MAXIMO) {
      palabra = MIRARLO;
      razon = nMudo + ' of ' + n + ' titles say nothing either way, so the titles cannot answer this. Open three of its videos and look at what is on screen.';
    } else if (fRelato >= RELATO_APRUEBA && fCamara <= CAMARA_TOLERA) {
      palabra = V ? V.SIRVE : 'SIRVE';
      razon = nRelato + ' of ' + n + ' titles are narration over pictures and only ' + nCamara + ' of ' + n + ' need a camera on site. This format can be rebuilt with AI.';
    } else {
      palabra = MIRARLO;
      razon = nRelato + ' of ' + n + ' titles read as narration and ' + nCamara + ' of ' + n + ' need a camera. Neither side is clear enough to decide from titles alone.';
    }

    return {
      ok: true,
      veredicto: palabra,
      etiqueta: V ? V.etiqueta(palabra) : palabra,
      replicable: palabra === (V ? V.SIRVE : 'SIRVE'),
      titulos: n,
      camara: nCamara, relato: nRelato, mudo: nMudo,
      fraccionCamara: Math.round(fCamara * 100) / 100,
      fraccionRelato: Math.round(fRelato * 100) / 100,
      fraccionMudo: Math.round(fMudo * 100) / 100,
      marcas: marcas,
      ejemplosCamara: filas.filter(function (f) { return f.clase === 'camara'; }).slice(0, 4),
      umbrales: { camaraMata: CAMARA_MATA, camaraTolera: CAMARA_TOLERA, relatoAprueba: RELATO_APRUEBA, mudoMaximo: MUDO_MAXIMO, minimo: MINIMO },
      razon: razon
    };
  }

  raiz.NSP_RIVAL_REPLICABLE = {
    medir: medir,
    deTitulo: deTitulo,
    etiquetaDe: etiquetaDe,
    CAMARA: CAMARA,
    RELATO: RELATO,
    CAMARA_MATA: CAMARA_MATA,
    CAMARA_TOLERA: CAMARA_TOLERA,
    RELATO_APRUEBA: RELATO_APRUEBA,
    MUDO_MAXIMO: MUDO_MAXIMO,
    MINIMO: MINIMO
  };
})(typeof window !== 'undefined' ? window : globalThis);
