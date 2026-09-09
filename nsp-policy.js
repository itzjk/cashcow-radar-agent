// ════════════════════════════════════════════════════════════════════════════
// NSPPolicy — Policy Engine Fase 1 (núcleo). Funciones puras: sin DOM, sin
// innerHTML, sin red salvo fetch del propio paquete (data/policies.json).
// Corre con el MISMO archivo en el SERVICE WORKER (classic, vía importScripts)
// y en páginas de extensión (<script>) → se adjunta a globalThis, NUNCA a window.
// Depende de NSPText (lib/nsp-text.js) para tokenizado/TF-IDF/coseno.
//
// PROPÓSITO: auditar NUESTRO PROPIO contenido (guion/título/descripción) por
// compliance real y valor de transformación. Cuando pega un hardBlock, la ÚNICA
// guía válida es "ELIMINA O REESCRIBE este contenido" — jamás un workaround.
//
// Almacenamiento: chrome.storage.local clave "nsp_script_corpus"
//   { <channelKey>: [ { t: título ≤120ch, ts: epoch-ms, vec: {token: frecuencia} } ] }
//   vec = TOP-400 frecuencias de tokens (NUNCA el guion crudo — cuota) ·
//   cap 25 entradas por canal, expulsión FIFO (la más vieja sale primero).
//   En entornos sin chrome.storage (tests Node) cae a un store en memoria.
// ════════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var NSPText = global.NSPText;

  // ── Constantes PROPIAS del motor (separadas de los 72/50 legacy de computeMonetScore) ──
  var ENGINE = {
    // Umbral de similitud guion-vs-corpus que sube a YELLOW.
    // 📊 DATAPOINTS Fase 1 STEP 4 (corpus sintético, truncación top-400, mismo par):
    //   1-gramas → casi-dup 70% vs distinto-tema 5% · 1-2 → 55% vs 3% · 1-3 → 44% vs 2%
    // ✅ DECISIÓN (cierre Fase 1, GO del dueño): SIM_NGRAMS 3→1 y umbral 70→55.
    //   Razón: para GUIONES largos la similitud útil es a nivel de VOCABULARIO
    //   (unigramas); los 3-gramas eran herencia del motor de TÍTULOS (textos de
    //   ~10 palabras) y castigan la paráfrasis hasta esconder casi-duplicados.
    //   El umbral debe quedar DEBAJO del ancla de casi-duplicado (70%) con margen → 55.
    // ⚠️ REGLAS PERMANENTES DE CALIBRACIÓN:
    //   1) calibrar SIEMPRE con la misma truncación top-400 — NUNCA con números
    //      de similitud de texto completo (no son comparables);
    //   2) recalibrar contra guiones REALES de los canales antes de shippear
    //      Fase 2 (loguear los raw scores de las primeras ~10 evaluaciones reales).
    SIMILARITY_YELLOW: 55,
    CORPUS_CAP_PER_CHANNEL: 25,    // FIFO: al entrar la 26ª, sale la más vieja
    CORPUS_DEDUPE_SIM: 0.98,       // GUARD ANTI RE-EXPORT: mismo título + sim ≥98% → actualiza ts, NO inserta
                                   // (re-exports del mismo video no deben llenar el FIFO de auto-copias —
                                   //  inflarían la similitud futura en falsos yellows)
    VEC_TOP_TOKENS: 400,           // frecuencias guardadas por guion (cuota de storage)
    NEAREST_LIMIT: 3,              // vecinos devueltos por scriptSimilarity
    TITLE_MAX: 120,
    ACRONYM_GUARD_MAXLEN: 4,       // word de 1 token y término ≤4 → exige ORIGINAL en MAYÚSCULAS
    SIM_NGRAMS: 1                  // UNIGRAMAS para similitud de guiones (decisión cierre Fase 1):
                                   // vocabulario > secuencia en textos largos; 1-3 era herencia de títulos.
                                   // Si esto cambia, el régimen 'ng' de las entradas viejas deja de coincidir
                                   // y el guard de integridad las descarta (no son recomputables).
  };
  var STORAGE_KEY = 'nsp_script_corpus';
  var HARDBLOCK_GUIDANCE = 'ELIMINA O REESCRIBE este contenido — no existe workaround válido para un hardBlock.';

  // ════════════ NORMALIZACIÓN CON MAPA A POSICIONES ORIGINALES ════════════
  // Contrato (data/policies.json → engine.normalization): minúsculas + plegado
  // de diacríticos + ß→ss + ł→l + todo no-letra/número → espacio (colapsado).
  // map[i] = índice en el texto ORIGINAL del carácter normalizado i — así
  // matchedTerms.index siempre apunta al original aunque ß expanda a 'ss'.
  function _foldChar(ch) {
    if (ch === 'ß' || ch === 'ẞ') return 'ss';
    if (ch === 'ł' || ch === 'Ł') return 'l';
    var lower = ch.toLowerCase();
    try {
      var d = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return d || lower;
    } catch (e) { return lower; }
  }
  function normalizeWithMap(original) {
    var src = String(original || '');
    var norm = '', map = [], i, j, ch, folded, isSpace, lastSpace = true;
    for (i = 0; i < src.length; i++) {
      ch = src[i];
      folded = _foldChar(ch);
      for (j = 0; j < folded.length; j++) {
        var f = folded[j];
        // letra o número (Unicode si está disponible; fallback ASCII+latín-1)
        var isWordChar;
        try { isWordChar = /[\p{L}\p{N}]/u.test(f); } catch (e) { isWordChar = /[a-z0-9]/i.test(f); }
        if (isWordChar) { norm += f; map.push(i); lastSpace = false; }
        else { isSpace = true; if (!lastSpace) { norm += ' '; map.push(i); lastSpace = true; } }
      }
    }
    if (norm.length && norm[norm.length - 1] === ' ') { norm = norm.slice(0, -1); map.pop(); }
    return { norm: norm, map: map };
  }
  // tokens con offset en el normalizado (para word-match y para el case guard)
  function _tokensWithPos(normObj) {
    var out = [], norm = normObj.norm, i = 0, start;
    while (i < norm.length) {
      while (i < norm.length && norm[i] === ' ') i++;
      if (i >= norm.length) break;
      start = i;
      while (i < norm.length && norm[i] !== ' ') i++;
      out.push({ tok: norm.slice(start, i), normStart: start });
    }
    return out;
  }
  // trozo ORIGINAL que cubre el token normalizado [normStart, normStart+len)
  function _originalSlice(original, normObj, normStart, len) {
    var a = normObj.map[normStart];
    var b = normObj.map[Math.min(normStart + len - 1, normObj.map.length - 1)];
    if (a == null || b == null) return '';
    return String(original).slice(a, b + 1);
  }
  // CASE GUARD (enmienda dueño): término word de 1 token ≤4 chars solo cuenta
  // si el trozo original está COMPLETO en mayúsculas ("SA" sí, "Sa." no).
  function _passesCaseGuard(original, normObj, normStart, len) {
    var slice = _originalSlice(original, normObj, normStart, len);
    if (!slice) return false;
    var hasLetter;
    try { hasLetter = /\p{L}/u.test(slice); } catch (e) { hasLetter = /[a-z]/i.test(slice); }
    return hasLetter && slice === slice.toUpperCase();
  }

  // ════════════ MATCHER DE REGLAS ════════════
  // scanFieldForRules(field, originalText, rules) → hits
  //   hit = { term, index (ORIGINAL), rule: {id, scope, severity, match}, field, note }
  function scanFieldForRules(field, originalText, rules) {
    var hits = [];
    if (!originalText || !rules || !rules.length) return hits;
    var normObj = normalizeWithMap(originalText);
    var toks = null; // lazy: solo si alguna regla es word
    var r, ri;
    for (ri = 0; ri < rules.length; ri++) {
      r = rules[ri];
      if (!r || !r.term) continue;
      var term = String(r.term);
      if ((r.match || 'word') === 'substring') {
        var from = 0, at;
        while ((at = normObj.norm.indexOf(term, from)) !== -1) {
          // endIndex (exclusivo, sobre el ORIGINAL): fin exacto del trozo aunque ß→ss desplace longitudes
          var subEnd = normObj.map[Math.min(at + term.length - 1, normObj.map.length - 1)] + 1;
          hits.push({ term: term, index: normObj.map[at], endIndex: subEnd, field: field, note: r.note || '', rule: { id: r.id, scope: r.scope, severity: r.severity, match: 'substring' } });
          from = at + Math.max(1, term.length);
        }
      } else {
        // word: secuencia EXACTA de tokens consecutivos (soporta multi-token "waffen ss")
        if (!toks) toks = _tokensWithPos(normObj);
        var termToks = term.split(' ').filter(Boolean);
        if (!termToks.length) continue;
        var needGuard = (r.caseGuard !== false) && termToks.length === 1 && termToks[0].length <= ENGINE.ACRONYM_GUARD_MAXLEN;
        var i, k, okSeq;
        for (i = 0; i + termToks.length <= toks.length; i++) {
          okSeq = true;
          for (k = 0; k < termToks.length; k++) { if (toks[i + k].tok !== termToks[k]) { okSeq = false; break; } }
          if (!okSeq) continue;
          if (needGuard && !_passesCaseGuard(originalText, normObj, toks[i].normStart, termToks[0].length)) continue;
          var lastTok = toks[i + termToks.length - 1];
          var lastNormIdx = lastTok.normStart + termToks[termToks.length - 1].length - 1;
          var wordEnd = normObj.map[Math.min(lastNormIdx, normObj.map.length - 1)] + 1;   // endIndex exclusivo sobre el ORIGINAL
          hits.push({ term: term, index: normObj.map[toks[i].normStart], endIndex: wordEnd, field: field, note: r.note || '', rule: { id: r.id, scope: r.scope, severity: r.severity, match: 'word' } });
        }
      }
    }
    return hits;
  }

  // ════════════ CARGA DE POLÍTICAS (caché en memoria) ════════════
  var _policiesCache = null;
  function loadPolicies() {
    if (_policiesCache) return Promise.resolve(_policiesCache);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL && typeof fetch === 'function') {
      return fetch(chrome.runtime.getURL('data/policies.json'))
        .then(function (res) { if (!res.ok) throw new Error('policies.json HTTP ' + res.status); return res.json(); })
        .then(function (j) { _policiesCache = j; return j; });
    }
    return Promise.reject(new Error('sin chrome.runtime — inyecta políticas con NSPPolicy._setPoliciesForTest()'));
  }
  // SOLO tests/harness (Node no tiene chrome.runtime): inyectar el JSON ya parseado.
  function _setPoliciesForTest(p) { _policiesCache = p || null; }

  // reúne las reglas aplicables: SIEMPRE las globales + las del canal
  function _collectRules(policies, channelKey, lang) {
    var hard = [], soft = [];
    var g = policies && policies.global;
    if (g && g.childSafety && Array.isArray(g.childSafety.hardBlock)) hard = hard.concat(g.childSafety.hardBlock);
    var ch = policies && policies.channels && channelKey ? policies.channels[channelKey] : null;
    var effLang = lang || (ch && ch.lang) || null;
    if (g && g.medicalClaims && g.medicalClaims.softFlag && effLang && Array.isArray(g.medicalClaims.softFlag[effLang])) {
      soft = soft.concat(g.medicalClaims.softFlag[effLang]);
    }
    if (ch) {
      if (Array.isArray(ch.hardBlock)) hard = hard.concat(ch.hardBlock);
      if (Array.isArray(ch.softFlag)) soft = soft.concat(ch.softFlag);
    }
    return { hard: hard, soft: soft, lang: effLang };
  }

  // ════════════ analyzeScript ════════════
  // ({channelKey, lang, scriptText}) → Promise<{hardBlocks[], softFlags[], matchedTerms[]}>
  // matchedTerms = [{term, index, rule, field, note}] con index sobre el texto ORIGINAL.
  function analyzeScript(args) {
    args = args || {};
    return loadPolicies().then(function (policies) {
      var rules = _collectRules(policies, args.channelKey, args.lang);
      var hits = scanFieldForRules('script', String(args.scriptText || ''), rules.hard.concat(rules.soft));
      var hardBlocks = hits.filter(function (h) { return h.rule.severity === 'hard'; });
      var softFlags = hits.filter(function (h) { return h.rule.severity === 'soft'; });
      return { hardBlocks: hardBlocks, softFlags: softFlags, matchedTerms: hits };
    });
  }

  // ════════════ STORAGE (chrome.storage.local con fallback memoria p/ tests) ════════════
  var _memStore = {};
  function _storeGet(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise(function (resolve) { chrome.storage.local.get(key, function (res) { resolve((res && res[key]) || null); }); });
    }
    return Promise.resolve(_memStore[key] || null);
  }
  function _storeSet(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise(function (resolve) { var o = {}; o[key] = value; chrome.storage.local.set(o, function () { resolve(true); }); });
    }
    _memStore[key] = value; return Promise.resolve(true);
  }

  // tokenizado canónico de GUIONES: stopwords del idioma (si la lib lo cubre) +
  // mismos n-gramas 1-3. Constante por canal → los vecs guardados siguen comparables.
  function _scriptTokens(text, lang) {
    var opts = { ngrams: ENGINE.SIM_NGRAMS };
    if (lang && NSPText.STOPWORDS && NSPText.STOPWORDS[lang]) opts.stopwords = lang;
    return NSPText.tokenize(String(text || ''), opts);
  }
  // vec comprimido: TOP-N frecuencias de tokens (NUNCA texto crudo)
  function _compressTf(tokens, topN) {
    var tf = Object.create(null), i;
    for (i = 0; i < tokens.length; i++) tf[tokens[i]] = (tf[tokens[i]] || 0) + 1;
    var keys = Object.keys(tf);
    if (keys.length > topN) {
      keys.sort(function (a, b) { return tf[b] - tf[a]; });
      var slim = Object.create(null), j;
      for (j = 0; j < topN; j++) slim[keys[j]] = tf[keys[j]];
      return slim;
    }
    return tf;
  }

  // ════════════ CORPUS API ════════════
  // addScriptToCorpus({channelKey, title, scriptText, ts}) → Promise<{ok, count}>
  function addScriptToCorpus(args) {
    args = args || {};
    var channelKey = String(args.channelKey || '').trim();
    if (!channelKey) return Promise.reject(new Error('channelKey requerido'));
    return loadPolicies().catch(function () { return null; }).then(function (policies) {
      var lang = (policies && policies.channels && policies.channels[channelKey] && policies.channels[channelKey].lang) || null;
      var vec = _compressTf(_scriptTokens(args.scriptText, lang), ENGINE.VEC_TOP_TOKENS);
      return _storeGet(STORAGE_KEY).then(function (all) {
        all = all || {};
        var list = Array.isArray(all[channelKey]) ? all[channelKey] : [];
        var title = String(args.title || '').slice(0, ENGINE.TITLE_MAX);
        var titleKey = normalizeWithMap(title).norm;   // comparación de título NORMALIZADA (case + diacríticos + ß)
        // MISMO TÍTULO = MISMO VIDEO (Enmienda A): NUNCA se acumula una segunda entrada
        // con el mismo título normalizado en el mismo canal.
        //   · mismo régimen ng y sim ≥98%  → re-export idéntico: solo se actualiza ts (deduped)
        //   · sim <98% o régimen viejo     → video ITERADO: se REEMPLAZA vec+ts+ng en su lugar
        //     (iterar un video no debe acumular auto-copias que envenenen la similitud futura)
        // Título distinto → insert normal (FIFO 25).
        for (var di = 0; di < list.length; di++) {
          var ex = list[di];
          if (!ex || normalizeWithMap(ex.t || '').norm !== titleKey) continue;
          var sim = 0;
          if (ex.ng === ENGINE.SIM_NGRAMS) {
            var dfP = Object.create(null), kP;
            for (kP in ex.vec) dfP[kP] = (dfP[kP] || 0) + 1;
            for (kP in vec) dfP[kP] = (dfP[kP] || 0) + 1;
            var idfP = { df: dfP, N: 2 };
            var _wP = function (m) { var v = Object.create(null), k; for (k in m) v[k] = m[k] * (Math.log((idfP.N + 1) / ((idfP.df[k] || 0) + 1)) + 1); return v; };
            sim = NSPText.cosineSimilarity(_wP(ex.vec), _wP(vec));
          }
          if (ex.ng === ENGINE.SIM_NGRAMS && sim >= ENGINE.CORPUS_DEDUPE_SIM) {
            ex.ts = Number(args.ts) || Date.now();
            all[channelKey] = list;
            return _storeSet(STORAGE_KEY, all).then(function () { return { ok: true, count: list.length, deduped: true }; });
          }
          ex.vec = vec; ex.ts = Number(args.ts) || Date.now(); ex.ng = ENGINE.SIM_NGRAMS; ex.t = title;   // REPLACE in-place (misma posición FIFO)
          all[channelKey] = list;
          return _storeSet(STORAGE_KEY, all).then(function () { return { ok: true, count: list.length, replaced: true }; });
        }
        // ng = SELLO DE RÉGIMEN de tokenizado (integridad del corpus): los vecs no guardan
        // el guion crudo, así que si SIM_NGRAMS cambia, las entradas viejas NO son
        // recomputables ni comparables → el guard de lectura las descarta.
        list.push({ t: title, ts: Number(args.ts) || Date.now(), ng: ENGINE.SIM_NGRAMS, vec: vec });
        while (list.length > ENGINE.CORPUS_CAP_PER_CHANNEL) list.shift();   // FIFO: sale la más vieja
        all[channelKey] = list;
        return _storeSet(STORAGE_KEY, all).then(function () { return { ok: true, count: list.length }; });
      });
    });
  }
  // getCorpus(channelKey) → Promise<[{t, ts, ng, vec}]>
  // GUARD DE RÉGIMEN: entradas cuyo ng ≠ ENGINE.SIM_NGRAMS se DESCARTAN al leer
  // (no comparables y no recomputables — los guiones crudos nunca se guardan, por diseño).
  function getCorpus(channelKey) {
    return _storeGet(STORAGE_KEY).then(function (all) {
      var list = (all && Array.isArray(all[String(channelKey)])) ? all[String(channelKey)] : [];
      var valid = list.filter(function (e) { return e && e.ng === ENGINE.SIM_NGRAMS; });
      var dropped = list.length - valid.length;
      if (dropped > 0) console.warn('[NSPPolicy] corpus "' + channelKey + '": descartadas ' + dropped + ' entrada(s) con régimen ng ≠ ' + ENGINE.SIM_NGRAMS + ' (no comparables; el guion crudo nunca se guarda)');
      return valid;
    });
  }

  // ════════════ scriptSimilarity ════════════
  // ({channelKey, scriptText, excludeTitle?}) → Promise<{score: 0-100, nearest: [{title, ts, sim}]}>
  // IDF se reconstruye al vuelo desde los TF guardados (df = nº de guiones con el
  // token) + el guion consultado → los vecs guardados siguen válidos al crecer el corpus.
  // excludeTitle (Enmienda B): las entradas cuyo título normalizado coincide se SALTAN —
  // la similitud mide repetición contra OTROS videos; un video vs su propia versión
  // anterior no es señal de plantilla (los falsos yellows entrenan overrides por fatiga).
  function scriptSimilarity(args) {
    args = args || {};
    var channelKey = String(args.channelKey || '').trim();
    var exKeyRaw = (args.excludeTitle != null) ? String(args.excludeTitle).trim() : '';
    var exKey = exKeyRaw ? normalizeWithMap(exKeyRaw).norm : null;
    return Promise.all([
      getCorpus(channelKey),
      loadPolicies().catch(function () { return null; })
    ]).then(function (rs) {
      var corpus = rs[0], policies = rs[1];
      if (exKey) corpus = corpus.filter(function (e) { return normalizeWithMap(e.t || '').norm !== exKey; });
      if (!corpus.length) return { score: 0, nearest: [] };
      var lang = (policies && policies.channels && policies.channels[channelKey] && policies.channels[channelKey].lang) || null;
      var qTf = _compressTf(_scriptTokens(args.scriptText, lang), ENGINE.VEC_TOP_TOKENS);
      // df sobre corpus + query (N = corpus + 1)
      var df = Object.create(null), N = corpus.length + 1;
      function _countDoc(tfMap) { var k; for (k in tfMap) df[k] = (df[k] || 0) + 1; }
      var i; for (i = 0; i < corpus.length; i++) _countDoc(corpus[i].vec || {});
      _countDoc(qTf);
      var idf = { df: df, N: N };
      function _weigh(tfMap) {
        var v = Object.create(null), k;
        for (k in tfMap) v[k] = tfMap[k] * (Math.log((idf.N + 1) / ((idf.df[k] || 0) + 1)) + 1);
        return v;
      }
      var qv = _weigh(qTf);
      var sims = corpus.map(function (e) {
        return { title: e.t, ts: e.ts, sim: Math.round(NSPText.cosineSimilarity(qv, _weigh(e.vec || {})) * 1000) / 1000 };
      });
      sims.sort(function (a, b) { return b.sim - a.sim; });
      var top = sims.slice(0, ENGINE.NEAREST_LIMIT);
      return { score: Math.round((top[0] ? top[0].sim : 0) * 100), nearest: top };
    });
  }

  // ════════════ evaluatePackage ════════════
  // ({channelKey, lang, script, title, description}) →
  //   Promise<{risk, reasons[], similarity, disclosureReminder: true, overrideAllowed, detail}>
  // Reglas: hardBlock → red + overrideAllowed=false (líneas legales: §86, childSafety) —
  // guía fija "elimina o reescribe", NUNCA un workaround. softFlag o similitud ≥ umbral →
  // yellow + override=true. Si no → green. El escaneo de reglas corre sobre
  // script+título+descripción (matchedTerms etiquetados por campo); la similitud SOLO sobre el guion.
  function evaluatePackage(args) {
    args = args || {};
    var channelKey = args.channelKey, lang = args.lang;
    return loadPolicies().then(function (policies) {
      var rules = _collectRules(policies, channelKey, lang);
      var allRules = rules.hard.concat(rules.soft);
      var hits = []
        .concat(scanFieldForRules('script', String(args.script || ''), allRules))
        .concat(scanFieldForRules('title', String(args.title || ''), allRules))
        .concat(scanFieldForRules('description', String(args.description || ''), allRules));
      var hardBlocks = hits.filter(function (h) { return h.rule.severity === 'hard'; });
      var softFlags = hits.filter(function (h) { return h.rule.severity === 'soft'; });
      // Enmienda B: el título del paquete se excluye de la similitud (el panel siempre lo pasa) —
      // override explícito posible vía args.excludeTitle.
      var exTitle = (args.excludeTitle != null) ? args.excludeTitle : args.title;
      return scriptSimilarity({ channelKey: channelKey, scriptText: args.script, excludeTitle: exTitle }).then(function (similarity) {
        var reasons = [], risk, overrideAllowed;
        if (hardBlocks.length) {
          risk = 'red'; overrideAllowed = false;
          hardBlocks.forEach(function (h) {
            reasons.push('HARDBLOCK [' + h.rule.id + '] «' + h.term + '» en ' + h.field + ' (índice ' + h.index + '): ' + (h.note || h.rule.scope) + ' → ' + HARDBLOCK_GUIDANCE);
          });
        } else if (softFlags.length || similarity.score >= ENGINE.SIMILARITY_YELLOW) {
          risk = 'yellow'; overrideAllowed = true;
          softFlags.forEach(function (h) {
            reasons.push('SOFTFLAG [' + h.rule.id + '] «' + h.term + '» en ' + h.field + ' (índice ' + h.index + '): ' + (h.note || h.rule.scope) + ' → revisa y reformula ese pasaje.');
          });
          if (similarity.score >= ENGINE.SIMILARITY_YELLOW) {
            reasons.push('SIMILITUD ' + similarity.score + '% con «' + (similarity.nearest[0] ? similarity.nearest[0].title : '?') + '» (umbral provisional ' + ENGINE.SIMILARITY_YELLOW + '%) → demasiado parecido a un guion ya usado: aporta ángulo/estructura nuevos.');
          }
        } else {
          risk = 'green'; overrideAllowed = true;
          reasons.push('Sin términos de riesgo en script/título/descripción y similitud ' + similarity.score + '% bajo el umbral ' + ENGINE.SIMILARITY_YELLOW + '%.');
        }
        return {
          risk: risk,
          reasons: reasons,
          similarity: similarity,
          disclosureReminder: true,   // SIEMPRE: recuerda la casilla de contenido alterado/sintético al subir
          overrideAllowed: overrideAllowed,
          detail: { hardBlocks: hardBlocks, softFlags: softFlags, matchedTerms: hits, lang: rules.lang, channelKey: channelKey || null }
        };
      });
    });
  }

  var NSPPolicy = {
    ENGINE: ENGINE,
    STORAGE_KEY: STORAGE_KEY,
    loadPolicies: loadPolicies,
    analyzeScript: analyzeScript,
    scriptSimilarity: scriptSimilarity,
    addScriptToCorpus: addScriptToCorpus,
    getCorpus: getCorpus,
    evaluatePackage: evaluatePackage,
    // internos expuestos para harness/Fase 2 (no parte del contrato estable):
    _normalizeWithMap: normalizeWithMap,
    _scanFieldForRules: scanFieldForRules,
    _setPoliciesForTest: _setPoliciesForTest
  };

  global.NSPPolicy = NSPPolicy;
})(typeof self !== 'undefined' ? self : this);
