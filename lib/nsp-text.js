// ════════════════════════════════════════════════════════════════════════════
// NSPText — núcleo de texto compartido (TF-IDF + coseno). Puro JS, sin DOM,
// sin innerHTML, sin red. Fase 1 del Policy Engine.
//
// ORIGEN: extraído BYTE-IDÉNTICO de zTitleEngine (content/nsp-studio.js).
// El flujo de títulos de Studio delega aquí y su salida se verificó campo a
// campo contra la implementación original (harness con corpus sintético fijo).
// ⚠️ NO "mejorar" estas funciones sin re-correr esa verificación: el predictor
// de títulos depende de cada detalle (n-gramas 1-3, IDF suavizado, stopwords
// CONSERVADAS por defecto — son señal de hook en títulos).
//
// CONSUMIDORES:
//   - content/nsp-studio.js (ISOLATED, studio.youtube.com) — cargado ANTES por
//     el manifest en el MISMO bloque content_scripts.
//   - nsp-policy.js (motor de policy, Fase 1 STEP 3) — usa stopwords opt-in.
//   - service worker / páginas de extensión — se adjunta a globalThis/self.
//
// Stopwords: OPT-IN vía tokenize(str, {stopwords:'en'|'es'|'de'|'pl'}).
// Con la opción APAGADA (default) el camino de ejecución es exactamente el
// original de zTitleEngine → byte-idéntico para el flujo de títulos.
// ════════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // Stopwords básicas por idioma (para análisis de GUIONES — el flujo de
  // títulos NO las usa a propósito: how/why/cómo/por qué son señal de hook).
  var STOPWORDS = {
    en: ['a','an','the','and','or','but','if','then','than','that','this','these','those','of','to','in','on','at','for','with','from','by','as','is','are','was','were','be','been','being','it','its','he','she','they','them','his','her','their','you','your','we','our','i','my','me','do','does','did','will','would','can','could','should','have','has','had','not','no','so','just','about','into','over','after','before','up','down','out','very','more','most','some','any','all'],
    es: ['un','una','unos','unas','el','la','los','las','y','o','u','pero','si','que','de','del','a','al','en','con','por','para','como','es','son','era','eran','fue','fueron','ser','estar','está','están','lo','le','les','se','su','sus','tu','tus','mi','mis','yo','tú','él','ella','ellos','ellas','nosotros','ustedes','este','esta','estos','estas','ese','esa','esos','esas','no','sí','ya','muy','más','menos','también','sobre','entre','hasta','desde','cuando','donde','todo','toda','todos','todas','algo','nada'],
    de: ['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines','und','oder','aber','wenn','dann','als','dass','von','zu','im','in','an','auf','für','mit','aus','bei','nach','über','unter','vor','ist','sind','war','waren','sein','wird','werden','wurde','wurden','hat','haben','hatte','hatten','nicht','kein','keine','es','er','sie','wir','ihr','ich','du','sich','sein','ihre','auch','noch','schon','nur','sehr','mehr','alle','alles','man','so','was','wie','auch'],
    pl: ['i','a','o','u','w','z','we','ze','na','do','od','po','za','przy','dla','bez','pod','nad','przez','jak','że','się','to','ta','ten','te','tym','tej','tego','jest','są','był','była','było','były','być','będzie','ma','mają','miał','nie','tak','już','tylko','bardzo','więcej','może','można','ich','jego','jej','my','wy','on','ona','ono','oni','co','czy','gdy','kiedy','gdzie','wszystko','coś','nic']
  };
  var _STOPSETS = {};
  function _stopset(lang) {
    if (!lang || !STOPWORDS[lang]) return null;
    if (!_STOPSETS[lang]) {
      var s = Object.create(null), arr = STOPWORDS[lang], i;
      for (i = 0; i < arr.length; i++) s[arr[i]] = 1;
      _STOPSETS[lang] = s;
    }
    return _STOPSETS[lang];
  }

  // tokenize(str[, opts]) → array de 1+2+3-gramas.
  //   opts.stopwords: 'en'|'es'|'de'|'pl' → filtra stopwords ANTES de armar n-gramas.
  //   opts.ngrams: 1..3 (default 3).
  // Sin opts ≡ implementación original de zTitleEngine (conserva stopwords).
  function tokenize(str, opts) {
    var s = String(str || '').toLowerCase().replace(/[‘’'’]/g, '');
    try { s = s.replace(/[^\p{L}\p{N}\s]/gu, ' '); } catch (e) { s = s.replace(/[^a-z0-9áéíóúñü\s]/g, ' '); }
    s = s.replace(/\s+/g, ' ').trim(); if (!s) return [];
    var w = s.split(' ');
    if (opts && opts.stopwords) {
      var stop = _stopset(opts.stopwords);
      if (stop) { var f = [], x; for (x = 0; x < w.length; x++) if (!stop[w[x]]) f.push(w[x]); w = f; if (!w.length) return []; }
    }
    var maxN = (opts && opts.ngrams) ? opts.ngrams : 3;
    var g = [], i;
    for (i = 0; i < w.length; i++) { g.push(w[i]); if (maxN >= 2 && i + 1 < w.length) g.push(w[i] + ' ' + w[i + 1]); if (maxN >= 3 && i + 2 < w.length) g.push(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]); }
    return g;  // CONSERVA stopwords de hook (how/why/did/cómo/por qué…) a propósito (default)
  }

  // buildIdf(tokenLists) → {df, N}. Recibe LISTAS DE TOKENS (desacoplado del
  // campo .t del corpus de títulos — el caller tokeniza con sus propias opts).
  function buildIdf(tokenLists) {
    var df = Object.create(null), N = (tokenLists && tokenLists.length) || 1, i, seen, g, j;
    for (i = 0; i < (tokenLists ? tokenLists.length : 0); i++) { seen = Object.create(null); g = tokenLists[i] || []; for (j = 0; j < g.length; j++) if (!seen[g[j]]) { seen[g[j]] = 1; df[g[j]] = (df[g[j]] || 0) + 1; } }
    return { df: df, N: N };
  }

  // tfidf(tokens, idf) → vector sparse {token: peso}. IDF suavizado log((N+1)/(df+1))+1.
  function tfidf(tokens, idf) {
    var tf = Object.create(null), vec = Object.create(null), i, k, keys;
    for (i = 0; i < tokens.length; i++) tf[tokens[i]] = (tf[tokens[i]] || 0) + 1;
    keys = Object.keys(tf);
    for (i = 0; i < keys.length; i++) { k = keys[i]; vec[k] = tf[k] * (Math.log((idf.N + 1) / ((idf.df[k] || 0) + 1)) + 1); }
    return vec;
  }

  function norm(v) { var s = 0, k; for (k in v) s += v[k] * v[k]; return Math.sqrt(s) || 1; }

  // cosineSimilarity(a, b) → 0..1 (sparse: itera el objeto menor).
  function cosineSimilarity(a, b) { var small = a, big = b, dot = 0, k; if (Object.keys(a).length > Object.keys(b).length) { small = b; big = a; } for (k in small) if (big[k]) dot += small[k] * big[k]; return dot / (norm(a) * norm(b)); }

  // weightedCosineAgg(qv, vecs, weights, exclude) → coseno promedio ponderado;
  // exclude = índice leave-one-out (-1 para no excluir).
  function weightedCosineAgg(qv, vecs, weights, exclude) {
    var num = 0, den = 0, i;
    for (i = 0; i < vecs.length; i++) { if (i === exclude) continue; num += weights[i] * cosineSimilarity(qv, vecs[i]); den += weights[i]; }
    return den > 0 ? num / den : 0;
  }

  // percentileOf(value, asc) → percentil 1..99 contra una distribución ORDENADA ascendente.
  function percentileOf(value, asc) { var n = asc.length, below = 0, i; if (!n) return null; for (i = 0; i < n; i++) if (asc[i] < value) below++; return Math.max(1, Math.min(99, Math.round(below / n * 100))); }

  // buildCorpusVectors(texts[, opts]) → {idf, vecs, tokens}. Conveniencia para
  // el policy engine (similitud de guiones): tokeniza todo con las mismas opts.
  function buildCorpusVectors(texts, opts) {
    var tokens = [], i;
    for (i = 0; i < (texts ? texts.length : 0); i++) tokens.push(tokenize(texts[i], opts));
    var idf = buildIdf(tokens);
    var vecs = [], j;
    for (j = 0; j < tokens.length; j++) vecs.push(tfidf(tokens[j], idf));
    return { idf: idf, vecs: vecs, tokens: tokens };
  }

  var NSPText = {
    STOPWORDS: STOPWORDS,
    tokenize: tokenize,
    buildIdf: buildIdf,
    tfidf: tfidf,
    vectorize: tfidf,            // alias pedido por la spec
    norm: norm,
    cosineSimilarity: cosineSimilarity,
    cosine: cosineSimilarity,    // alias corto (nombre original en zTitleEngine)
    weightedCosineAgg: weightedCosineAgg,
    percentileOf: percentileOf,
    buildCorpusVectors: buildCorpusVectors
  };

  global.NSPText = NSPText;
})(typeof self !== 'undefined' ? self : this);
