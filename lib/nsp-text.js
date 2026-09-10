// NSPText: shared text core (TF-IDF + cosine). Extracted byte-identical from
// zTitleEngine; the title predictor depends on every detail (1-3 n-grams, smoothed
// IDF, stopwords kept by default), so re-run the corpus verification before changing it.
(function (global) {
  'use strict';

  // Opt-in, for script analysis only: the title flow keeps how/why words because they are hook signal.
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
    return g;
  }

  function buildIdf(tokenLists) {
    var df = Object.create(null), N = (tokenLists && tokenLists.length) || 1, i, seen, g, j;
    for (i = 0; i < (tokenLists ? tokenLists.length : 0); i++) { seen = Object.create(null); g = tokenLists[i] || []; for (j = 0; j < g.length; j++) if (!seen[g[j]]) { seen[g[j]] = 1; df[g[j]] = (df[g[j]] || 0) + 1; } }
    return { df: df, N: N };
  }

  function tfidf(tokens, idf) {
    var tf = Object.create(null), vec = Object.create(null), i, k, keys;
    for (i = 0; i < tokens.length; i++) tf[tokens[i]] = (tf[tokens[i]] || 0) + 1;
    keys = Object.keys(tf);
    for (i = 0; i < keys.length; i++) { k = keys[i]; vec[k] = tf[k] * (Math.log((idf.N + 1) / ((idf.df[k] || 0) + 1)) + 1); }
    return vec;
  }

  function norm(v) { var s = 0, k; for (k in v) s += v[k] * v[k]; return Math.sqrt(s) || 1; }

  function cosineSimilarity(a, b) { var small = a, big = b, dot = 0, k; if (Object.keys(a).length > Object.keys(b).length) { small = b; big = a; } for (k in small) if (big[k]) dot += small[k] * big[k]; return dot / (norm(a) * norm(b)); }

  function weightedCosineAgg(qv, vecs, weights, exclude) {
    var num = 0, den = 0, i;
    for (i = 0; i < vecs.length; i++) { if (i === exclude) continue; num += weights[i] * cosineSimilarity(qv, vecs[i]); den += weights[i]; }
    return den > 0 ? num / den : 0;
  }

  function percentileOf(value, asc) { var n = asc.length, below = 0, i; if (!n) return null; for (i = 0; i < n; i++) if (asc[i] < value) below++; return Math.max(1, Math.min(99, Math.round(below / n * 100))); }

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
    vectorize: tfidf,
    norm: norm,
    cosineSimilarity: cosineSimilarity,
    cosine: cosineSimilarity,
    weightedCosineAgg: weightedCosineAgg,
    percentileOf: percentileOf,
    buildCorpusVectors: buildCorpusVectors
  };

  global.NSPText = NSPText;
})(typeof self !== 'undefined' ? self : this);
