// ════════════════════════════════════════════════════════════════════════════
// NSPPolicy: pure functions, no DOM and no network beyond fetching data/policies.json.
// The same file runs in the classic service worker and on extension pages, so it attaches to globalThis, never to window.
// Corpus lives in chrome.storage.local under "nsp_script_corpus" and stores only top-400 token frequencies per script, never the raw script, to stay inside the storage quota.
// Without chrome.storage (Node tests) it falls back to an in-memory store.
// ════════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var NSPText = global.NSPText;

  var ENGINE = {
    // Calibrated on top-400 truncated vectors: near duplicates land around 70 and unrelated topics around 5. Recalibrate only with the same truncation.
    SIMILARITY_YELLOW: 55,
    CORPUS_CAP_PER_CHANNEL: 25,
    // Same title and similarity at or above this is a re-export: refresh the timestamp instead of inserting, or the FIFO fills with self-copies and inflates future similarity.
    CORPUS_DEDUPE_SIM: 0.98,
    VEC_TOP_TOKENS: 400,           // token frequencies kept per script, capped for the storage quota
    NEAREST_LIMIT: 3,
    TITLE_MAX: 120,
    ACRONYM_GUARD_MAXLEN: 4,       // a single-token term this short must be uppercase in the original to count
    // Unigrams: in long scripts vocabulary carries the signal, not word order. Changing this invalidates stored entries and the read guard drops them.
    SIM_NGRAMS: 1
  };
  var STORAGE_KEY = 'nsp_script_corpus';
  var HARDBLOCK_GUIDANCE = 'Remove or rewrite this content. A hard block has no valid workaround.';

  // Normalization keeps a map back to the original text, so matchedTerms.index always points at the original even when a fold expands one character into two.
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
        // letter or digit, Unicode when available, ASCII fallback otherwise
        var isWordChar;
        try { isWordChar = /[\p{L}\p{N}]/u.test(f); } catch (e) { isWordChar = /[a-z0-9]/i.test(f); }
        if (isWordChar) { norm += f; map.push(i); lastSpace = false; }
        else { isSpace = true; if (!lastSpace) { norm += ' '; map.push(i); lastSpace = true; } }
      }
    }
    if (norm.length && norm[norm.length - 1] === ' ') { norm = norm.slice(0, -1); map.pop(); }
    return { norm: norm, map: map };
  }
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
  function _originalSlice(original, normObj, normStart, len) {
    var a = normObj.map[normStart];
    var b = normObj.map[Math.min(normStart + len - 1, normObj.map.length - 1)];
    if (a == null || b == null) return '';
    return String(original).slice(a, b + 1);
  }
  // Case guard: a single-token term of 4 characters or fewer only counts when the original slice is fully uppercase, so "SA" matches and "Sa." does not.
  function _passesCaseGuard(original, normObj, normStart, len) {
    var slice = _originalSlice(original, normObj, normStart, len);
    if (!slice) return false;
    var hasLetter;
    try { hasLetter = /\p{L}/u.test(slice); } catch (e) { hasLetter = /[a-z]/i.test(slice); }
    return hasLetter && slice === slice.toUpperCase();
  }

  // Rule matcher
  function scanFieldForRules(field, originalText, rules) {
    var hits = [];
    if (!originalText || !rules || !rules.length) return hits;
    var normObj = normalizeWithMap(originalText);
    var toks = null;
    var r, ri;
    for (ri = 0; ri < rules.length; ri++) {
      r = rules[ri];
      if (!r || !r.term) continue;
      var term = String(r.term);
      if ((r.match || 'word') === 'substring') {
        var from = 0, at;
        while ((at = normObj.norm.indexOf(term, from)) !== -1) {
          // endIndex is exclusive and over the ORIGINAL text, correct even when a fold shifts lengths
          var subEnd = normObj.map[Math.min(at + term.length - 1, normObj.map.length - 1)] + 1;
          hits.push({ term: term, index: normObj.map[at], endIndex: subEnd, field: field, note: r.note || '', rule: { id: r.id, scope: r.scope, severity: r.severity, match: 'substring' } });
          from = at + Math.max(1, term.length);
        }
      } else {
        // word: an exact run of consecutive tokens, so multi-token terms work
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
          var wordEnd = normObj.map[Math.min(lastNormIdx, normObj.map.length - 1)] + 1;
          hits.push({ term: term, index: normObj.map[toks[i].normStart], endIndex: wordEnd, field: field, note: r.note || '', rule: { id: r.id, scope: r.scope, severity: r.severity, match: 'word' } });
        }
      }
    }
    return hits;
  }

  // Policy loading, cached in memory
  var _policiesCache = null;
  function loadPolicies() {
    if (_policiesCache) return Promise.resolve(_policiesCache);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL && typeof fetch === 'function') {
      return fetch(chrome.runtime.getURL('data/policies.json'))
        .then(function (res) { if (!res.ok) throw new Error('policies.json HTTP ' + res.status); return res.json(); })
        .then(function (j) { _policiesCache = j; return j; });
    }
    return Promise.reject(new Error('no chrome.runtime available, inject policies with NSPPolicy._setPoliciesForTest()'));
  }
  // Tests only: Node has no chrome.runtime, so the parsed JSON is injected.
  function _setPoliciesForTest(p) { _policiesCache = p || null; }

  // Global rules always apply, plus the rules of the channel.
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

  // Storage: chrome.storage.local, with an in-memory fallback for tests
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

  // Tokenizing must stay constant per channel, otherwise the stored vectors stop being comparable.
  function _scriptTokens(text, lang) {
    var opts = { ngrams: ENGINE.SIM_NGRAMS };
    if (lang && NSPText.STOPWORDS && NSPText.STOPWORDS[lang]) opts.stopwords = lang;
    return NSPText.tokenize(String(text || ''), opts);
  }
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

  // Corpus API
  function addScriptToCorpus(args) {
    args = args || {};
    var channelKey = String(args.channelKey || '').trim();
    if (!channelKey) return Promise.reject(new Error('channelKey is required'));
    return loadPolicies().catch(function () { return null; }).then(function (policies) {
      var lang = (policies && policies.channels && policies.channels[channelKey] && policies.channels[channelKey].lang) || null;
      var vec = _compressTf(_scriptTokens(args.scriptText, lang), ENGINE.VEC_TOP_TOKENS);
      return _storeGet(STORAGE_KEY).then(function (all) {
        all = all || {};
        var list = Array.isArray(all[channelKey]) ? all[channelKey] : [];
        var title = String(args.title || '').slice(0, ENGINE.TITLE_MAX);
        var titleKey = normalizeWithMap(title).norm;
        // Same normalized title means the same video, so it never accumulates a second entry: an identical re-export only refreshes the timestamp, an iterated one replaces the vector in place.
        // Self-copies in the corpus would poison future similarity.
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
          ex.vec = vec; ex.ts = Number(args.ts) || Date.now(); ex.ng = ENGINE.SIM_NGRAMS; ex.t = title;   // replace in place, keeping its FIFO position
          all[channelKey] = list;
          return _storeSet(STORAGE_KEY, all).then(function () { return { ok: true, count: list.length, replaced: true }; });
        }
        // ng stamps the tokenizing regime: raw scripts are never stored, so entries written under a different SIM_NGRAMS cannot be recomputed and the read guard drops them.
        list.push({ t: title, ts: Number(args.ts) || Date.now(), ng: ENGINE.SIM_NGRAMS, vec: vec });
        while (list.length > ENGINE.CORPUS_CAP_PER_CHANNEL) list.shift();
        all[channelKey] = list;
        return _storeSet(STORAGE_KEY, all).then(function () { return { ok: true, count: list.length }; });
      });
    });
  }
  function getCorpus(channelKey) {
    return _storeGet(STORAGE_KEY).then(function (all) {
      var list = (all && Array.isArray(all[String(channelKey)])) ? all[String(channelKey)] : [];
      var valid = list.filter(function (e) { return e && e.ng === ENGINE.SIM_NGRAMS; });
      var dropped = list.length - valid.length;
      if (dropped > 0) console.warn('[NSPPolicy] corpus "' + channelKey + '": dropped ' + dropped + ' entry or entries written under a tokenizing regime other than ' + ENGINE.SIM_NGRAMS + ', they are not comparable and cannot be recomputed');
      return valid;
    });
  }

  // scriptSimilarity: IDF is rebuilt on the fly from the stored term frequencies, so old vectors stay valid as the corpus grows.
  // excludeTitle skips entries with the same normalized title: a video against its own earlier version is not evidence of a template, and false yellows train people to override.
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

  // evaluatePackage: a hard block is red and cannot be overridden, a soft flag or similarity at or above the threshold is yellow, anything else is green.
  // Rules are scanned over script, title and description; similarity is measured on the script alone.
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
      // The package title is excluded from similarity because the panel always passes it; args.excludeTitle overrides that.
      var exTitle = (args.excludeTitle != null) ? args.excludeTitle : args.title;
      return scriptSimilarity({ channelKey: channelKey, scriptText: args.script, excludeTitle: exTitle }).then(function (similarity) {
        var reasons = [], risk, overrideAllowed;
        if (hardBlocks.length) {
          risk = 'red'; overrideAllowed = false;
          hardBlocks.forEach(function (h) {
            reasons.push('HARDBLOCK [' + h.rule.id + '] "' + h.term + '" in ' + h.field + ' (index ' + h.index + '): ' + (h.note || h.rule.scope) + '. ' + HARDBLOCK_GUIDANCE);
          });
        } else if (softFlags.length || similarity.score >= ENGINE.SIMILARITY_YELLOW) {
          risk = 'yellow'; overrideAllowed = true;
          softFlags.forEach(function (h) {
            reasons.push('SOFTFLAG [' + h.rule.id + '] "' + h.term + '" in ' + h.field + ' (index ' + h.index + '): ' + (h.note || h.rule.scope) + '. Review and rewrite that passage.');
          });
          if (similarity.score >= ENGINE.SIMILARITY_YELLOW) {
            reasons.push('SIMILARITY ' + similarity.score + '% with "' + (similarity.nearest[0] ? similarity.nearest[0].title : '?') + '" (threshold ' + ENGINE.SIMILARITY_YELLOW + '%). Too close to a script already used: change the angle or the structure.');
          }
        } else {
          risk = 'green'; overrideAllowed = true;
          reasons.push('No risk terms in script, title or description, and similarity ' + similarity.score + '% is under the ' + ENGINE.SIMILARITY_YELLOW + '% threshold.');
        }
        return {
          risk: risk,
          reasons: reasons,
          similarity: similarity,
          disclosureReminder: true,   // always on: reminds the uploader to tick the altered or synthetic content box
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
    // internal, exposed for the test harness and not part of the stable contract
    _normalizeWithMap: normalizeWithMap,
    _scanFieldForRules: scanFieldForRules,
    _setPoliciesForTest: _setPoliciesForTest
  };

  global.NSPPolicy = NSPPolicy;
})(typeof self !== 'undefined' ? self : this);
