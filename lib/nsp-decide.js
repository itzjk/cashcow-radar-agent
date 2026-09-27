(function (root) {
  'use strict';

  var DEFAULT_PRIOR_ALPHA = 0.5;
  var DEFAULT_PRIOR_BETA = 0.5;
  var DEFAULT_SAMPLES = 20000;
  var DEFAULT_EFFECT_SIZE_TOLERANCE = 0.01;
  var DEFAULT_ALPHA = 0.05;
  var DEFAULT_THRESHOLD = 0.95;
  var DEFAULT_MIN_IMPRESSIONS = 200;
  var DEFAULT_EVIDENCE_CONCENTRATION = 50;
  var EVIDENCE_CALIBRATION = 1.4;
  var EVIDENCE_GRID_STEP = 0.15;
  var EVIDENCE_GRID_SPAN = 9.5;

  var MIN_MEASURES = 4;
  var BASE_MIN = 3;
  var ABERRATION = 2;
  var FRESH_HOURS = 72;
  var DOUBLING_HOURS = 24 * 14;
  var WINDOW_MIN_READINGS = 6;

  var KEEP = 'keep';
  var LOOK = 'look';
  var DROP = 'drop';
  var HOUR = 3600000;
  var DAY = 86400000;
  var MAX_TRIES = 3;
  var KEPT_RECHECK_DAYS = 30;
  var SPEND_FRESH_DAYS = 14;
  var PROJECTION_STEPS = [1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  var DUE_DAYS = { ab: 7, trend: 3, window: 3, share: 7 };
  var KINDS = { ab: 1, trend: 1, window: 1, share: 1 };

  function opt(v, d) {
    return v === undefined || v === null ? d : v;
  }

  function copy(o) {
    var out = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
    return out;
  }

  function createRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sampleNormal(rng) {
    var u = rng();
    while (u <= 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  function sampleGamma(shape, rng) {
    rng = rng || Math.random;
    if (!(shape > 0)) throw new Error('shape must be positive, got ' + shape);
    if (shape < 1) {
      var u0 = rng();
      while (u0 <= 0) u0 = rng();
      return sampleGamma(shape + 1, rng) * Math.pow(u0, 1 / shape);
    }
    var d = shape - 1 / 3;
    var c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x = sampleNormal(rng);
      var t = 1 + c * x;
      if (t <= 0) continue;
      var v = t * t * t;
      var u = rng();
      var xx = x * x;
      if (u < 1 - 0.0331 * xx * xx) return d * v;
      if (Math.log(u) < 0.5 * xx + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  function sampleBeta(alpha, beta, rng) {
    rng = rng || Math.random;
    var x = sampleGamma(alpha, rng);
    var y = sampleGamma(beta, rng);
    var s = x + y;
    if (!(s > 0) || !isFinite(s)) return rng() < alpha / (alpha + beta) ? 1 : 0;
    return x / s;
  }

  var LANCZOS = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];

  function logGamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    var z = x - 1;
    var a = 0.99999999999980993;
    for (var i = 0; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i + 1);
    var t = z + LANCZOS.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
  }

  function logBetaFn(a, b) {
    return logGamma(a) + logGamma(b) - logGamma(a + b);
  }

  function logMixtureBayesFactor(arms, priorAlpha, priorBeta) {
    if (arms.length < 2) return 0;
    var base = logBetaFn(priorAlpha, priorBeta);
    var clicks = 0;
    var misses = 0;
    var i;
    for (i = 0; i < arms.length; i++) {
      clicks += arms[i].clicks;
      misses += arms[i].impressions - arms[i].clicks;
    }
    var pooled = logBetaFn(priorAlpha + clicks, priorBeta + misses) - base;
    var terms = arms.map(function (arm) {
      var miss = arm.impressions - arm.clicks;
      var split = logBetaFn(priorAlpha + arm.clicks, priorBeta + miss) - base + logBetaFn(priorAlpha + clicks - arm.clicks, priorBeta + misses - miss) - base;
      return split - pooled;
    });
    var top = Math.max.apply(null, terms);
    if (!isFinite(top)) return top;
    var acc = 0;
    for (i = 0; i < terms.length; i++) acc += Math.exp(terms[i] - top);
    return top + Math.log(acc / arms.length);
  }

  var evidenceBases = {};

  function evidenceBasis(concentration) {
    var key = String(concentration);
    if (Object.prototype.hasOwnProperty.call(evidenceBases, key)) return evidenceBases[key];
    var rates = [];
    for (var z = -EVIDENCE_GRID_SPAN; z <= EVIDENCE_GRID_SPAN + 1e-9; z += EVIDENCE_GRID_STEP) {
      rates.push(1 / (1 + Math.exp(-z)));
    }
    var built = { alpha: [], beta: [], base: [] };
    for (var g = 0; g < rates.length; g++) {
      built.alpha[g] = concentration * rates[g];
      built.beta[g] = concentration * (1 - rates[g]);
      built.base[g] = logBetaFn(built.alpha[g], built.beta[g]);
    }
    evidenceBases[key] = built;
    return built;
  }

  function logSumExp(values) {
    var top = -Infinity;
    var i;
    for (i = 0; i < values.length; i++) if (values[i] > top) top = values[i];
    if (!isFinite(top)) return top;
    var acc = 0;
    for (i = 0; i < values.length; i++) acc += Math.exp(values[i] - top);
    return top + Math.log(acc);
  }

  function logCohortBayesFactor(arms, concentration) {
    if (concentration === undefined) concentration = DEFAULT_EVIDENCE_CONCENTRATION;
    if (arms.length < 2) return 0;
    var clicks = 0;
    var misses = 0;
    var i, g;
    for (i = 0; i < arms.length; i++) {
      clicks += arms[i].clicks;
      misses += arms[i].impressions - arms[i].clicks;
    }
    var basis = evidenceBasis(concentration);
    var grid = basis.base.length;
    var pooled = [];
    for (g = 0; g < grid; g++) pooled.push(logBetaFn(basis.alpha[g] + clicks, basis.beta[g] + misses) - basis.base[g]);
    var logPooled = logSumExp(pooled);
    var split = [];
    for (i = 0; i < arms.length; i++) {
      var arm = arms[i];
      var miss = arm.impressions - arm.clicks;
      var terms = [];
      for (g = 0; g < grid; g++) {
        terms.push(logBetaFn(basis.alpha[g] + arm.clicks, basis.beta[g] + miss) - basis.base[g] + logBetaFn(basis.alpha[g] + clicks - arm.clicks, basis.beta[g] + misses - miss) - basis.base[g]);
      }
      split.push(logSumExp(terms));
    }
    return logSumExp(split) - Math.log(arms.length) - logPooled;
  }

  function zeros(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(0);
    return out;
  }

  function evaluate(arms, options) {
    options = options || {};
    var rng = opt(options.rng, Math.random);
    var samples = opt(options.samples, DEFAULT_SAMPLES);
    var threshold = opt(options.threshold, DEFAULT_THRESHOLD);
    var minImpressions = opt(options.minImpressions, DEFAULT_MIN_IMPRESSIONS);
    var rule = opt(options.candidateRule, 'probabilityBest');
    var priorAlpha = opt(options.priorAlpha, DEFAULT_PRIOR_ALPHA);
    var priorBeta = opt(options.priorBeta, DEFAULT_PRIOR_BETA);
    var tolerance = opt(options.effectSizeTolerance, DEFAULT_EFFECT_SIZE_TOLERANCE);
    var alphaLevel = opt(options.alpha, DEFAULT_ALPHA);
    var totalImpressions = arms.reduce(function (sum, a) { return sum + a.impressions; }, 0);
    var k;

    if (arms.length === 0) {
      return { candidateIndex: -1, probabilityBest: 0, sufficientEvidence: false, totalImpressions: totalImpressions, expectedLoss: Infinity, eValue: 0, posteriorMean: 0, thresholdMet: false, minImpressionsMet: false, effectSizeOk: false, anytimeValid: false };
    }
    if (arms.length === 1) {
      var enough = arms[0].impressions >= minImpressions;
      return { candidateIndex: 0, probabilityBest: 1, sufficientEvidence: enough, totalImpressions: totalImpressions, expectedLoss: 0, eValue: Infinity, posteriorMean: (arms[0].clicks + priorAlpha) / (arms[0].impressions + priorAlpha + priorBeta), thresholdMet: true, minImpressionsMet: enough, effectSizeOk: true, anytimeValid: true };
    }

    var alpha = arms.map(function (a) { return a.clicks + priorAlpha; });
    var beta = arms.map(function (a) { return a.impressions - a.clicks + priorBeta; });

    var sampled = 0;
    var bestDraw = -1;
    for (k = 0; k < arms.length; k++) {
      var draw = sampleBeta(alpha[k], beta[k], rng);
      if (draw > bestDraw) {
        bestDraw = draw;
        sampled = k;
      }
    }

    var wins = zeros(arms.length);
    var lossSum = zeros(arms.length);
    var draws = zeros(arms.length);
    for (var s = 0; s < samples; s++) {
      var leader = 0;
      for (k = 0; k < arms.length; k++) {
        draws[k] = sampleBeta(alpha[k], beta[k], rng);
        if (draws[k] > draws[leader]) leader = k;
      }
      wins[leader]++;
      var top = draws[leader];
      for (k = 0; k < arms.length; k++) lossSum[k] += top - draws[k];
    }

    var candidateIndex = sampled;
    if (rule === 'probabilityBest') {
      candidateIndex = 0;
      for (k = 1; k < arms.length; k++) if (wins[k] > wins[candidateIndex]) candidateIndex = k;
    } else if (rule === 'posteriorMean') {
      candidateIndex = 0;
      var bestMean = alpha[0] / (alpha[0] + beta[0]);
      for (k = 1; k < arms.length; k++) {
        var mean = alpha[k] / (alpha[k] + beta[k]);
        if (mean > bestMean) {
          bestMean = mean;
          candidateIndex = k;
        }
      }
    }

    var probabilityBest = wins[candidateIndex] / samples;
    var expectedLoss = lossSum[candidateIndex] / samples;
    var posteriorMean = alpha[candidateIndex] / (alpha[candidateIndex] + beta[candidateIndex]);
    var logBf = logCohortBayesFactor(arms, options.evidenceConcentration);
    var eValue = Math.exp(logBf) / EVIDENCE_CALIBRATION;
    var thresholdMet = probabilityBest > threshold;
    var minImpressionsMet = arms[candidateIndex].impressions >= minImpressions;
    var effectSizeOk = expectedLoss < tolerance * posteriorMean;
    var anytimeValid = eValue >= 1 / alphaLevel;

    return {
      candidateIndex: candidateIndex,
      probabilityBest: probabilityBest,
      sufficientEvidence: thresholdMet && minImpressionsMet && effectSizeOk && anytimeValid,
      totalImpressions: totalImpressions,
      expectedLoss: expectedLoss,
      eValue: eValue,
      posteriorMean: posteriorMean,
      thresholdMet: thresholdMet,
      minImpressionsMet: minImpressionsMet,
      effectSizeOk: effectSizeOk,
      anytimeValid: anytimeValid
    };
  }

  function simulateTraffic(arms, trueRates, impressions, rng, allocation) {
    rng = rng || Math.random;
    allocation = allocation || 'thompson';
    if (arms.length !== trueRates.length) throw new Error('arms and trueRates length mismatch');
    var next = arms.map(function (a) { return copy(a); });
    var served = next.reduce(function (sum, a) { return sum + a.impressions; }, 0);
    for (var i = 0; i < impressions; i++) {
      var target = served % next.length;
      if (allocation === 'thompson') {
        var bestDraw = -1;
        for (var k = 0; k < next.length; k++) {
          var draw = sampleBeta(next[k].clicks + 1, next[k].impressions - next[k].clicks + 1, rng);
          if (draw > bestDraw) {
            bestDraw = draw;
            target = k;
          }
        }
      }
      next[target].impressions += 1;
      if (rng() < trueRates[target]) next[target].clicks += 1;
      served += 1;
    }
    return next;
  }

  function collapse(measures) {
    var order = measures.slice().sort(function (a, b) { return a.t - b.t; });
    var out = [];
    var dragged = 0;
    for (var i = 0; i < order.length; i++) {
      var m = order[i];
      var u = out[out.length - 1];
      if (u && u.value === m.value && u.rate === m.rate && u.views === m.views) { dragged++; u.lastSeen = m.t; continue; }
      var c = copy(m);
      c.lastSeen = m.t;
      out.push(c);
    }
    return { measures: out, dragged: dragged };
  }

  function mean(xs) {
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  }

  function deviation(xs) {
    if (xs.length < 2) return 0;
    var m = mean(xs);
    return Math.sqrt(xs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (xs.length - 1));
  }

  function growth(a, b) {
    if (a.value == null || b.value == null || a.value <= 0) return null;
    var hours = b.t - a.t;
    if (hours <= 0) return null;
    return (b.value - a.value) / a.value / hours;
  }

  function analyze(series, o) {
    o = o || {};
    var minMeasures = opt(o.minMeasures, MIN_MEASURES);
    var aberration = opt(o.aberration, ABERRATION);
    var freshHours = opt(o.freshHours, FRESH_HOURS);
    var col = collapse(series.measures || []);
    var measures = col.measures;
    var base = { id: series.id, name: series.name, measures: measures.length, dragged: col.dragged };
    var out;

    if (measures.length < minMeasures) {
      out = copy(base);
      out.outbreak = false;
      out.judgeable = false;
      out.whyCode = 'few_measures';
      out.why = 'only ' + measures.length + ' distinct reading' + (measures.length === 1 ? '' : 's') + ', ' + minMeasures + ' are needed before acceleration can be told apart';
      return out;
    }

    var last = measures[measures.length - 1];
    var prev = measures[measures.length - 2];
    var hoursStale = measures.length ? (last.lastSeen - last.t) : 0;
    var rates = [];
    for (var i = 1; i < measures.length; i++) {
      var r = growth(measures[i - 1], measures[i]);
      if (r != null) rates.push(r);
    }
    if (rates.length < BASE_MIN) {
      out = copy(base);
      out.outbreak = false;
      out.judgeable = false;
      out.whyCode = 'no_baseline';
      out.why = 'too few spans with a measured value to build a baseline';
      return out;
    }

    var rLast = rates[rates.length - 1];
    var baseline = rates.slice(0, -1);
    var mu = mean(baseline);
    var sd = deviation(baseline);
    var score = sd > 0 ? (rLast - mu) / sd : null;
    var perHour = rLast;
    var doubling = perHour > 0 ? Math.log(2) / Math.log(1 + perHour) : null;
    var fresh = hoursStale <= freshHours;
    var accelerates = score != null && score >= aberration;
    var strong = perHour > 0 && doubling != null && doubling <= DOUBLING_HOURS;
    var outbreak = fresh && accelerates && strong;
    var code, why;
    if (!fresh) { code = 'stale'; why = 'the reading has not changed for ' + Math.round(hoursStale) + ' h: a flat line here means nobody looked, not that it stopped growing'; }
    else if (sd === 0) { code = 'flat_baseline'; why = 'the baseline never varied, so any change would look like a jump: not judged'; }
    else if (outbreak) { code = 'outbreak'; why = 'accelerates ' + score.toFixed(1) + ' deviations over its own baseline and doubles in ' + Math.round(doubling) + ' h'; }
    else if (accelerates) { code = 'accelerating_slow'; why = 'accelerates over its baseline but too slowly to double within two weeks'; }
    else { code = 'normal'; why = 'within its normal pace (' + score.toFixed(1) + ' deviations)'; }

    out = copy(base);
    out.outbreak = outbreak;
    out.judgeable = sd > 0 && fresh;
    out.valueNow = last.value;
    out.valueBefore = prev.value;
    out.growthPerHourPct = Number((perHour * 100).toFixed(3));
    out.doublingHours = doubling == null ? null : Math.round(doubling);
    out.score = score == null ? null : Number(score.toFixed(2));
    out.baseline = { spans: baseline.length, meanPct: Number((mu * 100).toFixed(3)), sdPct: Number((sd * 100).toFixed(3)) };
    out.hoursStale = Math.round(hoursStale);
    out.whyCode = code;
    out.why = why;
    return out;
  }

  function windowReadings(points) {
    var list = Array.isArray(points) ? points : [];
    return list.filter(function (s) { return s && isFinite(Number(s.t)) && isFinite(Number(s.value)); });
  }

  function windowOpen(points) {
    var s = windowReadings(points);
    if (s.length < WINDOW_MIN_READINGS) return null;
    var values = s.map(function (x) { return Number(x.value); });
    var top = Math.max.apply(null, values);
    if (!(top > 0)) return false;
    return values[values.length - 1] >= top;
  }

  function wilson(successes, total, z, upper) {
    z = z === undefined ? 1.96 : z;
    var n = Number(total) || 0;
    var k = Math.max(0, Math.min(n, Number(successes) || 0));
    if (!n) return upper ? 1 : 0;
    var p = k / n;
    var d = 1 + (z * z) / n;
    var centre = p + (z * z) / (2 * n);
    var margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
    if (upper) return Math.min(1, Math.round(((centre + margin) / d) * 1000) / 1000);
    return Math.max(0, Math.round(((centre - margin) / d) * 1000) / 1000);
  }

  function wilsonLower(successes, total, z) {
    return wilson(successes, total, z, false);
  }

  function wilsonUpper(successes, total, z) {
    return wilson(successes, total, z, true);
  }

  function verdictWord(state) {
    var V = root.NSP_VEREDICTO;
    if (!V) return '';
    return state === KEEP ? V.SIRVE : (state === DROP ? V.NO_SIRVE : V.MIRARLO);
  }

  function label(state) {
    var V = root.NSP_VEREDICTO;
    return V ? V.etiqueta(verdictWord(state)) : '';
  }

  function grouped(x) {
    var n = Math.round(Number(x) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function pct(x, digits) {
    var p = Number(x) * 100;
    var d = digits === undefined ? (p >= 10 || p === 0 ? 0 : 1) : digits;
    return p.toFixed(d).replace(/\.0+$/, '') + '%';
  }

  function chance(p) {
    if (p >= 0.9995) return 'over 99.9%';
    if (p >= 0.9) return (p * 100).toFixed(1) + '%';
    return Math.round(p * 100) + '%';
  }

  function deviations(x) {
    return Math.abs(x) >= 100 ? grouped(x) : x.toFixed(1);
  }

  function fixed(x, d) {
    return Number(Number(x).toFixed(d));
  }

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 3) + '...' : s;
  }

  function quote(name) {
    return '"' + clip(name, 100) + '"';
  }

  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function evalue(x) {
    if (!isFinite(x)) return x > 0 ? 'unbounded' : '0';
    if (x >= 1000) return grouped(x);
    return x >= 10 ? x.toFixed(0) : x.toFixed(1);
  }

  function result(kind, state, extra) {
    var out = { ok: true, kind: kind, state: state, label: label(state), verdict: verdictWord(state) };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  function fail(kind, code, error) {
    return { ok: false, kind: kind, code: code, error: error };
  }

  function cleanArms(list) {
    if (!Array.isArray(list) || list.length < 2) return { error: 'an A/B decision needs at least two options, each with its impressions and clicks' };
    if (list.length > 12) return { error: 'at most 12 options can be compared at once' };
    var seen = {};
    var arms = [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i] && typeof list[i] === 'object' ? list[i] : {};
      var name = clip(a.name || a.id || ('Option ' + (i + 1)), 120);
      var imp = Number(a.impressions);
      var clicks = Number(a.clicks);
      if (!isFinite(imp) || !isFinite(clicks) || imp < 0 || clicks < 0 || Math.floor(imp) !== imp || Math.floor(clicks) !== clicks) return { error: 'option ' + quote(name) + ' needs whole numbers of impressions and clicks, and an empty box is not a zero' };
      if (clicks > imp) return { error: 'option ' + quote(name) + ' has more clicks (' + clicks + ') than impressions (' + imp + ')' };
      var key = name.toLowerCase();
      if (seen[key]) return { error: 'two options are both called ' + quote(name) };
      seen[key] = 1;
      arms.push({ name: name, impressions: imp, clicks: clicks });
    }
    return { arms: arms };
  }

  function indexOfArm(arms, ref) {
    if (ref === undefined || ref === null || ref === '') return -1;
    if (typeof ref === 'number' && ref >= 0 && ref < arms.length && Math.floor(ref) === ref) return ref;
    var key = String(ref).replace(/\s+/g, ' ').trim().toLowerCase();
    for (var i = 0; i < arms.length; i++) if (arms[i].name.toLowerCase() === key) return i;
    return -1;
  }

  function displayNames(names) {
    var list = (Array.isArray(names) ? names : []).map(function (n) { return String(n == null ? '' : n); });
    var origin = '';
    var same = list.length > 1 && list.every(function (n) {
      var m = /^(https?:\/\/[^\/?#]+)(\/[^?#]*)?/i.exec(n);
      if (!m) return false;
      if (!origin) origin = m[1].toLowerCase();
      return m[1].toLowerCase() === origin;
    });
    return same ? list.map(function (n) { return n.slice(origin.length) || '/'; }) : list;
  }

  function seedOf(arms) {
    return hash(arms.map(function (a) { return a.name + ':' + a.impressions + ':' + a.clicks; }).join('|'));
  }

  function scaled(arms, m) {
    return arms.map(function (a) {
      var imp = Math.round(a.impressions * m);
      return { name: a.name, impressions: imp, clicks: Math.min(imp, Math.round(a.clicks * m)) };
    });
  }

  function projection(arms, o, seed) {
    var total = arms.reduce(function (s, a) { return s + a.impressions; }, 0);
    if (!total) return null;
    for (var i = 0; i < PROJECTION_STEPS.length; i++) {
      var m = PROJECTION_STEPS[i];
      var ev = evaluate(scaled(arms, m), { rng: createRng(seed), samples: o.samples, threshold: o.threshold, minImpressions: o.minImpressions });
      if (ev.sufficientEvidence) {
        var more = Math.round(total * (m - 1));
        var round = more >= 1000 ? Math.round(more / 100) * 100 : Math.round(more / 10) * 10;
        return { times: m, more: round, line: 'about ' + grouped(round) + ' more impressions in total at the current rates' };
      }
    }
    return { times: null, more: null, line: 'at the current rates the options are too close to call even with ' + PROJECTION_STEPS[PROJECTION_STEPS.length - 1] + ' times the traffic' };
  }

  function ab(input) {
    input = input && typeof input === 'object' ? input : {};
    var c = cleanArms(input.arms);
    if (c.error) return fail('ab', 'bad_input', c.error);
    var arms = c.arms;
    var o = {
      samples: Number(input.samples) > 0 ? Math.floor(Number(input.samples)) : DEFAULT_SAMPLES,
      threshold: DEFAULT_THRESHOLD,
      minImpressions: DEFAULT_MIN_IMPRESSIONS
    };
    var seed = isFinite(Number(input.seed)) && input.seed !== null && input.seed !== '' ? Number(input.seed) >>> 0 : seedOf(arms);
    var ev = evaluate(arms, { rng: createRng(seed), samples: o.samples, threshold: o.threshold, minImpressions: o.minImpressions });
    var lead = arms[ev.candidateIndex];
    var shown = displayNames(arms.map(function (a) { return a.name; }));
    var leadName = shown[ev.candidateIndex];
    var controlIdx = indexOfArm(arms, input.control);
    var state = ev.sufficientEvidence ? (controlIdx >= 0 && ev.candidateIndex === controlIdx ? DROP : KEEP) : LOOK;
    var lossShare = ev.posteriorMean > 0 ? ev.expectedLoss / ev.posteriorMean : Infinity;
    var number = quote(leadName) + ' leads: ' + chance(ev.probabilityBest) + ' chance it is best, ' + grouped(lead.impressions) + ' of ' + grouped(ev.totalImpressions) + ' impressions, e-value ' + evalue(ev.eValue);
    var missing = [];
    if (!ev.minImpressionsMet) missing.push({ rule: 'impressions', has: lead.impressions, needs: o.minImpressions, text: grouped(o.minImpressions - lead.impressions) + ' more impressions on it (' + grouped(lead.impressions) + ' now, ' + o.minImpressions + ' needed)' });
    if (!ev.thresholdMet) missing.push({ rule: 'probability', has: fixed(ev.probabilityBest, 3), needs: o.threshold, text: 'a ' + chance(ev.probabilityBest) + ' chance it is best, over 95% needed' });
    if (!ev.anytimeValid) missing.push({ rule: 'evalue', has: isFinite(ev.eValue) ? fixed(ev.eValue, 2) : null, needs: 1 / DEFAULT_ALPHA, text: 'evidence (e-value) of ' + evalue(ev.eValue) + ', 20 needed' });
    if (!ev.effectSizeOk) missing.push({ rule: 'loss', has: isFinite(lossShare) ? fixed(lossShare, 4) : null, needs: DEFAULT_EFFECT_SIZE_TOLERANCE, text: 'if it is the wrong pick it costs ' + (isFinite(lossShare) ? pct(lossShare, 1) : 'an unknown share') + ' of its rate, under 1% needed' });
    var proj = state === LOOK ? projection(arms, o, seed) : null;
    var line;
    if (state === KEEP) line = 'Keep ' + quote(leadName) + ': it beats ' + (controlIdx >= 0 ? quote(shown[controlIdx]) : 'the other options') + ' with enough evidence (' + chance(ev.probabilityBest) + ' chance best, e-value ' + evalue(ev.eValue) + ', ' + grouped(lead.impressions) + ' impressions).';
    else if (state === DROP) line = 'Drop the change: ' + quote(leadName) + ', the current version, is better with enough evidence (' + chance(ev.probabilityBest) + ' chance best, e-value ' + evalue(ev.eValue) + ').';
    else line = 'Keep testing: ' + number + '. Missing: ' + missing.map(function (m) { return m.text; }).join('; ') + '.' + (proj ? ' That is ' + proj.line + '.' : '');
    return result('ab', state, {
      leader: lead.name,
      control: controlIdx >= 0 ? arms[controlIdx].name : '',
      leaderLabel: leadName,
      controlLabel: controlIdx >= 0 ? shown[controlIdx] : '',
      sufficient: ev.sufficientEvidence,
      number: number,
      missing: state === LOOK ? missing : [],
      projection: proj,
      line: line,
      arms: arms.map(function (a, i) { return { name: a.name, label: shown[i], impressions: a.impressions, clicks: a.clicks, rate: a.impressions ? fixed(a.clicks / a.impressions, 4) : null }; }),
      evaluation: {
        probabilityBest: fixed(ev.probabilityBest, 4),
        expectedLoss: fixed(ev.expectedLoss, 6),
        eValue: isFinite(ev.eValue) ? fixed(ev.eValue, 3) : null,
        posteriorMean: fixed(ev.posteriorMean, 5),
        totalImpressions: ev.totalImpressions,
        thresholdMet: ev.thresholdMet,
        minImpressionsMet: ev.minImpressionsMet,
        effectSizeOk: ev.effectSizeOk,
        anytimeValid: ev.anytimeValid
      },
      seed: seed
    });
  }

  function cleanPoints(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (p) { return p && typeof p === 'object' ? { t: Number(p.t), value: p.value === null || p.value === undefined || p.value === '' ? NaN : Number(p.value) } : null; })
      .filter(function (p) { return p && isFinite(p.t) && isFinite(p.value); })
      .sort(function (a, b) { return a.t - b.t; })
      .slice(-400);
  }

  function trend(input) {
    input = input && typeof input === 'object' ? input : {};
    var name = clip(input.name || 'this number', 80);
    var points = cleanPoints(input.points);
    var measures = points.map(function (p) { return { t: p.t / HOUR, value: p.value, rate: null, views: null }; });
    var a = analyze({ id: name, name: name, measures: measures });
    var now = Number(input.now);
    var ageHours = null;
    if (isFinite(now) && points.length) {
      var col = collapse(measures);
      var last = col.measures[col.measures.length - 1];
      ageHours = Math.max(0, now / HOUR - last.lastSeen);
    }
    var old = ageHours != null && ageHours > FRESH_HOURS;
    var missing = [];
    var state;
    if (a.whyCode === 'few_measures') { state = LOOK; missing.push({ rule: 'measures', has: a.measures, needs: MIN_MEASURES, text: (MIN_MEASURES - a.measures) + ' more distinct reading' + (MIN_MEASURES - a.measures === 1 ? '' : 's') + ' of ' + name + ' (it has ' + a.measures + ', ' + MIN_MEASURES + ' are needed)' }); }
    else if (a.whyCode === 'no_baseline') { state = LOOK; missing.push({ rule: 'baseline', has: 0, needs: BASE_MIN, text: 'readings above zero to measure growth between them' }); }
    else if (a.whyCode === 'stale' || old) { state = LOOK; var h = old ? Math.round(ageHours) : a.hoursStale; missing.push({ rule: 'fresh', has: h, needs: FRESH_HOURS, text: 'a fresh reading: the last one is ' + h + ' h old and ' + FRESH_HOURS + ' h is the limit' }); }
    else if (a.whyCode === 'flat_baseline') { state = LOOK; missing.push({ rule: 'variation', has: 0, needs: 1, text: 'a baseline that varies: every earlier span grew exactly alike, so any change would look like a jump' }); }
    else state = a.outbreak ? KEEP : DROP;
    var number = a.score != null ? name + ' at ' + grouped(a.valueNow) + ' (was ' + grouped(a.valueBefore) + '), ' + deviations(a.score) + ' deviations over its own baseline' + (a.doublingHours != null ? ', doubles in ' + grouped(a.doublingHours) + ' h' : '') : name + ': ' + a.measures + ' distinct reading' + (a.measures === 1 ? '' : 's');
    var line = state === KEEP ? 'Accelerating: ' + number + '.' : (state === DROP ? (a.whyCode === 'accelerating_slow' ? 'Not an outbreak: ' + number + ', too slow to double within two weeks.' : 'Normal pace: ' + number + '.') : 'Not judged yet: ' + missing.map(function (m) { return m.text; }).join('; ') + '.');
    return result('trend', state, { name: name, number: number, missing: missing, line: line, analysis: a, readings: points.length });
  }

  function windowState(input) {
    input = input && typeof input === 'object' ? input : {};
    var name = clip(input.name || 'this number', 80);
    var points = cleanPoints(input.points);
    var open = windowOpen(points);
    var values = points.map(function (p) { return p.value; });
    var top = values.length ? Math.max.apply(null, values) : null;
    var lastV = values.length ? values[values.length - 1] : null;
    var state, number, missing = [];
    if (open === null) {
      state = LOOK;
      number = name + ': ' + points.length + ' reading' + (points.length === 1 ? '' : 's');
      missing.push({ rule: 'readings', has: points.length, needs: WINDOW_MIN_READINGS, text: (WINDOW_MIN_READINGS - points.length) + ' more reading' + (WINDOW_MIN_READINGS - points.length === 1 ? '' : 's') + ' of ' + name + ' (it has ' + points.length + ', ' + WINDOW_MIN_READINGS + ' are needed)' });
    } else if (open) {
      state = KEEP;
      number = name + ' at ' + grouped(lastV) + ', the highest of ' + points.length + ' readings';
    } else {
      state = DROP;
      number = top > 0 ? name + ' at ' + grouped(lastV) + ' against a top of ' + grouped(top) + ' in ' + points.length + ' readings' : name + ' never rose above zero in ' + points.length + ' readings';
    }
    var line = state === KEEP ? 'The window is still opening: ' + number + '.' : (state === DROP ? 'Past its top: ' + number + '.' : 'Not judged yet: ' + missing[0].text + '.');
    return result('window', state, { name: name, number: number, missing: missing, line: line, readings: points.length, top: top, last: lastV });
  }

  function share(input) {
    input = input && typeof input === 'object' ? input : {};
    var name = clip(input.name || 'the rate', 80);
    var n = Number(input.total), k = Number(input.successes), bar = Number(input.bar);
    if (!isFinite(n) || !isFinite(k) || n < 0 || k < 0 || Math.floor(n) !== n || Math.floor(k) !== k) return fail('share', 'bad_input', 'a rate needs whole numbers of successes and of the total, and an empty box is not a zero');
    if (k > n) return fail('share', 'bad_input', 'there are more successes (' + k + ') than tries (' + n + ')');
    if (!isFinite(bar) || bar <= 0 || bar >= 1) return fail('share', 'bad_input', 'the bar must be a share between 0 and 1, for example 0.3 for 30%');
    var lo = wilsonLower(k, n), hi = wilsonUpper(k, n);
    var state = lo >= bar ? KEEP : (hi < bar ? DROP : LOOK);
    var number = grouped(k) + ' of ' + grouped(n) + (n ? ' (' + pct(k / n, 0) + ')' : '') + ', at worst ' + pct(lo, 1) + ' and at best ' + pct(hi, 1) + ' against a bar of ' + pct(bar, 0);
    var missing = [];
    if (state === LOOK) {
      var p = n ? k / n : 0;
      var need = null;
      if (p > bar) {
        for (var m = n + 1; m <= Math.max(n * 50, 5000); m++) {
          if (wilsonLower(Math.round(p * m), m) >= bar) { need = m - n; break; }
        }
      }
      missing.push({ rule: 'tries', has: n, needs: need == null ? null : n + need, text: need == null ? 'more tries: at this rate the bar cannot be cleared yet' : 'about ' + grouped(need) + ' more tries at the same rate' });
    }
    var line = state === KEEP ? 'Clears the bar: ' + number + '.' : (state === DROP ? 'Below the bar: ' + number + '.' : 'Not judged yet: ' + number + '; ' + missing[0].text + '.');
    return result('share', state, { name: name, number: number, missing: missing, line: line, lower: lo, upper: hi, bar: bar });
  }

  function decide(kind, input) {
    if (kind === 'ab') return ab(input);
    if (kind === 'trend') return trend(input);
    if (kind === 'window') return windowState(input);
    if (kind === 'share') return share(input);
    return fail(String(kind || ''), 'bad_kind', 'kind must be ab, trend, window or share');
  }

  function claimOf(r) {
    if (!r || !r.ok) return null;
    if (r.kind === 'ab') return { state: r.control && r.leader === r.control ? DROP : KEEP, winner: r.leader };
    return { state: r.state === LOOK ? KEEP : r.state, winner: '' };
  }

  function agrees(claim, fresh) {
    if (!claim || !fresh || !fresh.ok) return false;
    if (fresh.kind === 'ab') return fresh.leader === claim.winner && fresh.state === claim.state;
    return fresh.state === claim.state;
  }

  function dueIn(kind, days) {
    var d = Number(days);
    if (!isFinite(d) || d <= 0) d = DUE_DAYS[kind] || 7;
    return Math.round(Math.max(1 / 24, Math.min(90, d)) * DAY);
  }

  function recheck(decision, fresh, now) {
    decision = decision || {};
    now = Number(now) || Date.now();
    var tries = (Number(decision.tries) || 0) + 1;
    var span = Number(decision.span) > 0 ? Number(decision.span) : dueIn(decision.kind);
    var was = decision.lesson && decision.lesson.state === 'firm' ? 'firm' : 'tentative';
    var claim = decision.claim || null;
    var decisive = !!(fresh && fresh.ok && (fresh.state === KEEP || fresh.state === DROP));
    if (decisive && agrees(claim, fresh)) {
      return { status: 'kept', lesson: 'firm', tries: 0, dueAt: now + KEPT_RECHECK_DAYS * DAY, why: 'measured again and it holds' };
    }
    if (decisive) {
      return { status: 'dropped', lesson: 'deleted', tries: tries, dueAt: 0, why: 'measured again and it did not hold' };
    }
    if (was === 'firm') {
      return { status: 'kept', lesson: 'firm', tries: 0, dueAt: now + KEPT_RECHECK_DAYS * DAY, why: 'no clear answer on this re-measure, so the lesson stays as it was' };
    }
    if (tries >= MAX_TRIES) {
      return { status: 'expired', lesson: 'deleted', tries: tries, dueAt: 0, why: 'never proven in ' + tries + ' re-measures, so it is not kept as a lesson' };
    }
    return { status: 'open', lesson: 'tentative', tries: tries, dueAt: now + span, why: 'not enough evidence yet' + (fresh && fresh.ok && fresh.missing && fresh.missing.length ? ': ' + fresh.missing.map(function (m) { return m.text; }).join('; ') : (fresh && fresh.error ? ': ' + fresh.error : '')) };
  }

  function lessonText(kind, r, question, given) {
    var own = clip(given, 200);
    if (own) return own;
    var q = clip(question, 120);
    var lead = r.leaderLabel || r.leader, ctrl = r.controlLabel || r.control;
    if (kind === 'ab') return (r.control && r.leader === r.control ? quote(lead) + ', the current version, beats the change' : quote(lead) + ' beats ' + (ctrl ? quote(ctrl) : 'the other options')) + (q ? ' (' + q + ')' : '');
    if (kind === 'trend') return clip(r.name, 80) + (r.state === DROP ? ' grows at its usual pace' : ' is accelerating') + (q ? ' (' + q + ')' : '');
    if (kind === 'window') return clip(r.name, 80) + (r.state === DROP ? ' is past its top' : ' is still opening') + (q ? ' (' + q + ')' : '');
    return clip(r.name, 80) + (r.state === DROP ? ' stays below the bar' : ' clears the bar') + (q ? ' (' + q + ')' : '');
  }

  function firmLessons(decisions, o) {
    o = o || {};
    var host = String(o.host || '');
    var playbook = String(o.playbook || '');
    var max = Number(o.max) > 0 ? Number(o.max) : 6;
    var list = (Array.isArray(decisions) ? decisions : []).filter(function (d) {
      return d && d.lesson && d.lesson.state === 'firm' && d.lesson.text && ((host && d.host === host) || (playbook && d.playbook === playbook));
    });
    list.sort(function (a, b) {
      var ah = a.host === host ? 1 : 0, bh = b.host === host ? 1 : 0;
      if (ah !== bh) return bh - ah;
      return (Number(b.lesson.at) || 0) - (Number(a.lesson.at) || 0);
    });
    return list.slice(0, max).map(function (d) {
      return { id: d.id, host: d.host, text: d.lesson.text, evidence: d.lesson.evidence || (d.result && d.result.number) || '', at: Number(d.lesson.at) || Number(d.at) || 0 };
    });
  }

  function latestAb(decisions, host, now) {
    now = Number(now) || Date.now();
    var list = (Array.isArray(decisions) ? decisions : []).filter(function (d) {
      return d && d.kind === 'ab' && d.host === host && d.result && d.status !== 'forgotten' && now - (Number(d.measuredAt) || Number(d.at) || 0) <= SPEND_FRESH_DAYS * DAY;
    });
    list.sort(function (a, b) { return ((Number(b.measuredAt) || Number(b.at) || 0) - (Number(a.measuredAt) || Number(a.at) || 0)) || ((Number(b.id) || 0) - (Number(a.id) || 0)); });
    return list[0] || null;
  }

  function spendEvidence(decisions, host, now) {
    host = String(host || '');
    var d = latestAb(decisions, host, now);
    var bar = 'one option beating the others with over 95% chance, 200 impressions on it, an e-value of 20 and under 1% expected loss';
    if (!d) {
      return { ok: false, missing: ['a measured A/B test on ' + (host || 'this site') + ' from the last ' + SPEND_FRESH_DAYS + ' days: ask ZERACK which option wins first', bar], line: 'No measured test on ' + (host || 'this site') + ' yet.' };
    }
    var r = d.result;
    if (r.sufficient === true) {
      return { ok: true, decision: d.id, question: clip(d.question, 140), number: r.number, line: clip(d.question, 100) + ': ' + r.number };
    }
    var miss = (r.missing || []).map(function (m) { return m.text; });
    return { ok: false, decision: d.id, missing: ['a test that settles "' + clip(d.question, 100) + '": ' + r.number].concat(miss.length ? miss : [bar]), line: clip(d.question, 100) + ': ' + r.number };
  }

  function undoText(entry) {
    entry = entry || {};
    var fields = Array.isArray(entry.fields) ? entry.fields : [];
    var result = String(entry.result || '');
    var decision = String(entry.decision || '');
    if (result !== 'done' || decision === 'refused' || decision === 'declined' || decision === 'timeout' || decision === 'stopped' || decision === 'no_evidence') return 'Nothing to undo: it did not run.';
    if (fields.length) {
      return fields.map(function (f) {
        return 'Set ' + clip(String(f.field || 'the field').replace(/^(?:textbox|searchbox|combobox|listbox) (?=")/, ''), 80) + ' back to ' + (String(f.before || '') ? '"' + clip(f.before, 300) + '"' : 'empty');
      }).join('; ') + (entry.pressed ? ', then save it again yourself.' : '.');
    }
    var act = String(entry.action || '');
    if (act === 'navigate' || act === 'goto' || act === 'open') return entry.urlBefore ? 'Go back to ' + clip(entry.urlBefore, 200) + '.' : 'Go back in the tab.';
    var kind = String(entry.kind || '');
    var named = /"([^"]{1,120})"/.exec(String(entry.target || ''));
    var what = named ? '"' + named[1] + '"' : clip(String(entry.target || '').replace(/^the /, ''), 120);
    var where = entry.host || 'the site';
    if (kind === 'Pay') return 'Money moved when ' + (what || 'it') + ' ran, so it cannot be undone here: ask ' + where + ' for a refund, or cancel it there.';
    if (kind === 'Publish' && named && /^(save|update|guardar|actualizar)\b/i.test(named[1])) return 'To undo, set the fields back on ' + where + ' and press ' + what + ' again.';
    if (kind === 'Publish') return 'To undo, open ' + where + ' and unpublish or restore what ' + (what || 'it') + ' changed.';
    if (kind === 'Send') return 'What ' + (what || 'it') + ' sent cannot be unsent: follow up with a correction if needed.';
    if (kind === 'Delete') return 'Look for what ' + (what || 'it') + ' removed in the trash or archive on ' + where + '.';
    if (kind === 'Fulfill') return 'To undo, cancel the fulfillment on ' + where + ' and tell the buyer.';
    return (what ? 'Undo ' + what + ' by hand' : 'Undo it by hand') + (entry.urlAfter && entry.urlAfter !== entry.urlBefore ? ', starting from ' + clip(entry.urlBefore || entry.url || '', 200) : '') + '.';
  }

  root.NSP_DECIDE = Object.freeze({
    KEEP: KEEP,
    LOOK: LOOK,
    DROP: DROP,
    kinds: Object.keys(KINDS),
    DEFAULTS: Object.freeze({ priorAlpha: DEFAULT_PRIOR_ALPHA, priorBeta: DEFAULT_PRIOR_BETA, samples: DEFAULT_SAMPLES, effectSizeTolerance: DEFAULT_EFFECT_SIZE_TOLERANCE, alpha: DEFAULT_ALPHA, threshold: DEFAULT_THRESHOLD, minImpressions: DEFAULT_MIN_IMPRESSIONS, evidenceConcentration: DEFAULT_EVIDENCE_CONCENTRATION, evidenceCalibration: EVIDENCE_CALIBRATION, minMeasures: MIN_MEASURES, baseMin: BASE_MIN, aberration: ABERRATION, freshHours: FRESH_HOURS, windowMinReadings: WINDOW_MIN_READINGS, maxTries: MAX_TRIES, keptRecheckDays: KEPT_RECHECK_DAYS, spendFreshDays: SPEND_FRESH_DAYS }),
    createRng: createRng,
    sampleGamma: sampleGamma,
    sampleBeta: sampleBeta,
    logGamma: logGamma,
    logBetaFn: logBetaFn,
    logMixtureBayesFactor: logMixtureBayesFactor,
    logCohortBayesFactor: logCohortBayesFactor,
    evaluate: evaluate,
    simulateTraffic: simulateTraffic,
    collapse: collapse,
    analyze: analyze,
    windowReadings: windowReadings,
    windowOpen: windowOpen,
    wilsonLower: wilsonLower,
    wilsonUpper: wilsonUpper,
    ab: ab,
    trend: trend,
    window: windowState,
    share: share,
    decide: decide,
    label: label,
    claimOf: claimOf,
    agrees: agrees,
    dueIn: dueIn,
    recheck: recheck,
    lessonText: lessonText,
    firmLessons: firmLessons,
    spendEvidence: spendEvidence,
    displayNames: displayNames,
    undoText: undoText
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
