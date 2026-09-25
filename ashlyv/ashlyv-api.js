// ashlyv-api.js - Data and AI client for the Ashlyv hub pages.
// Everything goes through the service worker with one message shape: real YouTube data read
// from InnerTube or the public channel pages (NSP_AGENT_*), free text generation through the
// provider cascade the user picked in Options (ASHLYV_CHAT_REQUEST) and the prompts the service
// worker owns (NSP_AI_TASK). There is no backend and no key ever reaches this page.

window.AshlyVAPI = (function () {
  'use strict';

  var DATA_TIMEOUT_MS = 45000;
  var AI_TIMEOUT_MS = 120000;

  function reasonError(reason, message) {
    var err = new Error(message || reason);
    err.reason = reason;
    return err;
  }

  // The single messaging client of the hub. fields are sent next to type, as the service worker
  // reads them: { payload } for the chat, { channelUrl } or { query } for the data calls.
  function sendToSW(type, fields, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        reject(reasonError('no_runtime', 'The extension runtime is not available here. Open this page from the extension.'));
        return;
      }
      var settled = false;
      var ms = timeoutMs || DATA_TIMEOUT_MS;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(reasonError('timeout', 'The service worker did not answer ' + type + ' within ' + Math.round(ms / 1000) + ' s.'));
      }, ms);
      var message = Object.assign({}, fields || {}, { type: type });
      try {
        chrome.runtime.sendMessage(message, function (response) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          var lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(reasonError('runtime_error', type + ' failed: ' + (lastError.message || 'messaging error') + '. Reload the extension.'));
            return;
          }
          if (!response) {
            reject(reasonError('no_response', 'The service worker sent no answer to ' + type + '. Reload the extension.'));
            return;
          }
          resolve(response);
        });
      } catch (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(reasonError('send_failed', type + ' could not be sent: ' + (e && e.message || e)));
      }
    });
  }

  var FAILURE_TEXT = {
    no_provider_configured: 'No AI provider is configured. Add an OpenAI, Groq or Gemini key, or enable Ollama, in Options.',
    all_busy: 'Every AI provider is busy right now. Wait a few seconds and try again.',
    unparsed_answer: 'The AI answered, but not in the structured form this tool needs. Try again.',
    invalid_channel_url: 'That is not a YouTube channel link.',
    no_videos_parsed: 'YouTube returned the channel page but no videos could be read from it.',
    ytinitialdata_not_found: 'YouTube returned a page without video data. Try again in a minute.',
    no_query: 'Type something to search for.'
  };

  function expectOk(response, type) {
    if (response && response.ok === true) return response;
    var code = String(response && response.error || 'failed');
    var detail = response && response.detail ? String(response.detail) : '';
    var text = FAILURE_TEXT[code] || (detail || code);
    if (code === 'all_providers_failed' && detail) text = 'Every configured AI provider failed: ' + detail;
    throw reasonError(code, text || (type + ' failed'));
  }

  function settle(promise) {
    return promise.then(function (value) { return { ok: true, value: value }; }, function (error) { return { ok: false, error: error }; });
  }

  // Providers are reported by name only. The keys stay in storage and are never returned.
  function getProviderStatus() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(['nsp_openai_api_key', 'nsp_groq_api_key', 'nsp_gemini_api_key', 'nsp_ollama_enabled', 'nsp_selected_model'], function (r) {
          r = r || {};
          var providers = [];
          if (typeof r.nsp_openai_api_key === 'string' && /^sk-/.test(r.nsp_openai_api_key.trim())) providers.push('OpenAI');
          if (typeof r.nsp_groq_api_key === 'string' && /^gsk_/.test(r.nsp_groq_api_key.trim())) providers.push('Groq');
          if (typeof r.nsp_gemini_api_key === 'string' && /^AIza/.test(r.nsp_gemini_api_key.trim())) providers.push('Gemini');
          if (r.nsp_ollama_enabled === true) providers.push('Ollama');
          resolve({ configured: providers.length > 0, providers: providers, selectedModel: String(r.nsp_selected_model || 'auto') });
        });
      } catch (e) {
        resolve({ configured: false, providers: [], selectedModel: 'auto', error: String(e && e.message || e) });
      }
    });
  }

  function languageName(code) {
    var raw = String(code || '').trim();
    if (!raw) return 'English';
    if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,4})?$/i.test(raw)) return raw;
    try {
      var name = new Intl.DisplayNames(['en'], { type: 'language' }).of(raw);
      if (name) return name;
    } catch (e) {}
    return raw;
  }

  // Small local models often stop mid answer or close a bracket wrong. Keep the part that is well
  // formed and close it, so a cut answer loses its tail instead of the whole result.
  function closeTruncatedJson(text) {
    var stack = [], inString = false, escaped = false, lastSafe = -1, safeStack = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
      else if (c === '}' || c === ']') {
        if (stack.pop() !== c) break;
        if (!stack.length) return text.slice(0, i + 1);
        lastSafe = i;
        safeStack = stack.slice();
      }
    }
    return lastSafe < 0 ? null : text.slice(0, lastSafe + 1) + safeStack.reverse().join('');
  }

  function parseApiJson(content) {
    if (!content || typeof content !== 'string') return null;
    var clean = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var start = clean.indexOf('{');
    if (start === -1) return null;
    clean = clean.slice(start);
    var noTrailingCommas = clean.replace(/,\s*([}\]])/g, '$1');
    var end = clean.lastIndexOf('}');
    var candidates = [end > 0 ? clean.slice(0, end + 1) : '', noTrailingCommas.slice(0, noTrailingCommas.lastIndexOf('}') + 1), closeTruncatedJson(noTrailingCommas)];
    for (var i = 0; i < candidates.length; i++) {
      if (!candidates[i]) continue;
      try { return JSON.parse(candidates[i]); } catch (e) {}
    }
    return null;
  }

  function chat(system, prompt, maxTokens) {
    return sendToSW('ASHLYV_CHAT_REQUEST', {
      payload: {
        messages: [{ role: 'user', content: String(prompt || '') }],
        system: String(system || ''),
        maxTokens: maxTokens || 1500
      }
    }, AI_TIMEOUT_MS).then(function (res) {
      expectOk(res, 'ASHLYV_CHAT_REQUEST');
      var text = String(res.text || '').trim();
      if (!text) throw reasonError('empty_answer', 'The AI provider returned an empty answer. Try again.');
      return { text: text, provider: res.provider || '', model: res.modelUsed || '' };
    });
  }

  var JSON_SYSTEM = 'You help a faceless YouTube creator plan content. Answer with one valid JSON object and nothing else: no markdown, no comments. Never state numbers you cannot know, such as RPM, revenue, CTR, search volume or scores.';

  function chatJson(prompt, maxTokens) {
    return chat(JSON_SYSTEM, prompt, maxTokens).then(function (res) {
      var data = parseApiJson(res.text);
      if (!data) throw reasonError('unparsed_answer', FAILURE_TEXT.unparsed_answer);
      return { data: data, provider: res.provider, model: res.model };
    });
  }

  function aiTask(task, data) {
    return sendToSW('NSP_AI_TASK', { task: task, data: data }, AI_TIMEOUT_MS).then(function (res) {
      expectOk(res, 'NSP_AI_TASK');
      if (!res.result || typeof res.result !== 'object') throw reasonError('unparsed_answer', FAILURE_TEXT.unparsed_answer);
      return { result: res.result, provider: res.provider || '', model: res.model || res.modelUsed || '' };
    });
  }

  // "1.2M views", "1,2 M de visualizaciones", "12 mil", "1.234.567 views", "No views".
  // Returns null when the text holds no readable count, never a made up 0.
  function parseCount(text) {
    if (typeof text === 'number') return isFinite(text) && text >= 0 ? Math.round(text) : null;
    if (text === null || text === undefined) return null;
    var s = String(text).toLowerCase().replace(/[\u00a0\u202f]/g, ' ').trim();
    if (!s || s === 'unknown') return null;
    if (/^(?:no|sin|nenhuma|aucune|keine)\b/.test(s)) return 0;
    var m = s.match(/(\d[\d.,' ]*)\s*(mil millones|millones|mill[oó]n|millions?|mill\.?|mio\.?|mln|mi|mil|tsd\.?|thousand|billions?|bn|mrd\.?|k|m|b)?(?![a-z])/);
    if (!m) return null;
    var unit = (m[2] || '').replace(/\.$/, '');
    var digits = m[1].replace(/[\s']/g, '');
    var num;
    if (unit) {
      var lastSep = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
      if (lastSep >= 0) digits = digits.slice(0, lastSep).replace(/[.,]/g, '') + '.' + digits.slice(lastSep + 1);
      num = parseFloat(digits);
    } else {
      num = parseFloat(digits.replace(/[.,]/g, ''));
    }
    if (!isFinite(num)) return null;
    var mult = 1;
    if (/^(?:k|mil|tsd|thousand)$/.test(unit)) mult = 1e3;
    else if (/^(?:m|mi|mill|mill[oó]n|millones|millions?|mio|mln)$/.test(unit)) mult = 1e6;
    else if (/^(?:b|bn|billions?|mrd|mil millones)$/.test(unit)) mult = 1e9;
    return Math.round(num * mult);
  }

  var AGE_UNITS = [
    [/\b(?:seconds?|segundos?|secondes?|sekunden?)\b/, 1 / 86400],
    [/\b(?:minutes?|minutos?|minuten?|mins?)\b/, 1 / 1440],
    [/\b(?:hours?|horas?|heures?|stunden?)\b/, 1 / 24],
    [/\b(?:days?|d[ií]as?|jours?|tage?n?)\b/, 1],
    [/\b(?:weeks?|semanas?|semaines?|wochen?)\b/, 7],
    [/\b(?:months?|m[eê]s|meses|mois|monate?n?)\b/, 30.44],
    [/(?:\byears?\b|a[ñn]os?\b|\bans?\b|\bjahre?n?\b)/, 365.25]
  ];

  // "3 days ago", "hace 2 semanas", "Streamed 1 year ago". YouTube rounds these, so the result is approximate.
  function parseAgeDays(text) {
    if (!text) return null;
    var s = String(text).toLowerCase();
    for (var i = 0; i < AGE_UNITS.length; i++) {
      if (!AGE_UNITS[i][0].test(s)) continue;
      var n = s.match(/(\d+)/);
      if (n) return parseInt(n[1], 10) * AGE_UNITS[i][1];
      if (/\b(?:a|an|one|un|una|um|uma|ein|eine|einer|einem|einen)\b/.test(s)) return AGE_UNITS[i][1];
      return null;
    }
    return null;
  }

  var MONTH_PREFIX = { jan: 0, ene: 0, gen: 0, feb: 1, fev: 1, mar: 2, apr: 3, abr: 3, avr: 3, may: 4, mai: 4, mag: 4, jun: 5, jul: 6, lug: 6, aug: 7, ago: 7, aou: 7, sep: 8, set: 8, oct: 9, out: 9, okt: 9, ott: 9, nov: 10, dec: 11, dic: 11, dez: 11 };

  // "Mar 3, 2021", "3 mar 2021", "3 de mar. de 2021". Needs a year and a month to answer.
  function parseJoinedDate(text) {
    if (!text) return null;
    var s = String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var y = s.match(/\b(19\d{2}|20\d{2})\b/);
    if (!y) return null;
    var month = -1;
    var words = s.split(/[^a-z]+/);
    for (var i = 0; i < words.length && month < 0; i++) {
      var w = words[i];
      if (w.length < 3) continue;
      if (w === 'juin') month = 5;
      else if (w.slice(0, 4) === 'juil') month = 6;
      else if (Object.prototype.hasOwnProperty.call(MONTH_PREFIX, w.slice(0, 3))) month = MONTH_PREFIX[w.slice(0, 3)];
    }
    if (month < 0) return null;
    var withoutYear = s.replace(y[1], ' ');
    var d = withoutYear.match(/\b([0-2]?\d|3[01])\b/);
    var day = d ? parseInt(d[1], 10) : 1;
    if (!day) day = 1;
    return { year: parseInt(y[1], 10), month: month, day: day };
  }

  function monthsSince(date, now) {
    now = now || new Date();
    var months = (now.getFullYear() - date.year) * 12 + (now.getMonth() - date.month);
    if (now.getDate() < date.day) months -= 1;
    return Math.max(0, months);
  }

  function isoDate(date) {
    function two(n) { return n < 10 ? '0' + n : String(n); }
    return date.year + '-' + two(date.month + 1) + '-' + two(date.day);
  }

  // Only the two forms the service worker reads: /@handle and /channel/UC...
  function normalizeChannelUrl(input) {
    var s = String(input || '').trim();
    if (!s) return null;
    var m;
    if ((m = s.match(/^@([^\s/?#]{3,100})$/))) return 'https://www.youtube.com/@' + encodeURIComponent(m[1]);
    if ((m = s.match(/^(UC[A-Za-z0-9_-]{22})$/))) return 'https://www.youtube.com/channel/' + m[1];
    if ((m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(@[^\s/?#]{3,300})/i))) return 'https://www.youtube.com/' + m[1];
    if ((m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i))) return 'https://www.youtube.com/channel/' + m[1];
    if (/^[A-Za-z0-9._-]{3,100}$/.test(s)) return 'https://www.youtube.com/@' + s;
    return null;
  }

  function looksLikeChannel(input) {
    return /^@|^https?:\/\/|youtube\.com\/|^UC[A-Za-z0-9_-]{22}$/.test(String(input || '').trim());
  }

  function requireChannelUrl(input) {
    var url = normalizeChannelUrl(input);
    if (!url) throw reasonError('bad_channel', 'Use an @handle, a youtube.com/@handle link or a youtube.com/channel/UC... link.');
    return url;
  }

  function known(value) {
    var s = value === null || value === undefined ? '' : String(value).trim();
    return s && s.toLowerCase() !== 'unknown' ? s : '';
  }

  function channelStats(input) {
    var url;
    try { url = requireChannelUrl(input); } catch (e) { return Promise.reject(e); }
    return sendToSW('NSP_AGENT_CHANNEL_STATS', { channelUrl: url }).then(function (res) {
      expectOk(res, 'NSP_AGENT_CHANNEL_STATS');
      var unreadable = [];
      var subsText = known(res.subscribers);
      var videoCountText = known(res.videoCount);
      var viewsText = known(res.totalViews);
      var joinedText = known(res.joined);
      var joined = parseJoinedDate(joinedText);
      if (!subsText) unreadable.push('subscribers');
      if (!videoCountText) unreadable.push('video count');
      if (!viewsText) unreadable.push('total views');
      if (!joinedText) unreadable.push('join date');
      else if (!joined) unreadable.push('join date (YouTube shows "' + joinedText + '")');
      return {
        url: res.channelUrl || url,
        name: known(res.name),
        subscribersText: subsText,
        subscribers: parseCount(subsText),
        videoCountText: videoCountText,
        videoCount: parseCount(videoCountText),
        totalViewsText: viewsText,
        totalViews: parseCount(viewsText),
        joinedText: joinedText,
        joinedDate: joined ? isoDate(joined) : '',
        monthsOld: joined ? monthsSince(joined) : null,
        country: known(res.country),
        description: known(res.description),
        unreadable: unreadable,
        note: known(res.note)
      };
    });
  }

  function watchUrl(videoId) {
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(String(videoId || ''));
  }

  function channelVideos(input) {
    var url;
    try { url = requireChannelUrl(input); } catch (e) { return Promise.reject(e); }
    return sendToSW('NSP_AGENT_CHANNEL_VIDEOS', { channelUrl: url }).then(function (res) {
      expectOk(res, 'NSP_AGENT_CHANNEL_VIDEOS');
      var videos = (Array.isArray(res.videos) ? res.videos : []).filter(function (v) { return v && v.videoId; }).map(function (v) {
        return {
          videoId: String(v.videoId),
          title: String(v.title || ''),
          url: watchUrl(v.videoId),
          viewsText: String(v.views || ''),
          views: parseCount(v.views),
          publishedText: String(v.published || ''),
          ageDays: parseAgeDays(v.published)
        };
      });
      return { url: res.channelUrl || url, videos: videos };
    });
  }

  function absoluteYouTubeUrl(href) {
    var s = String(href || '').trim();
    if (!s) return '';
    if (s.charAt(0) === '/') s = 'https://www.youtube.com' + s;
    return /^https:\/\/(?:www\.)?youtube\.com\//i.test(s) ? s : '';
  }

  function searchVideos(query, opts) {
    opts = opts || {};
    var q = String(query || '').trim();
    if (!q) return Promise.reject(reasonError('no_query', FAILURE_TEXT.no_query));
    return sendToSW('NSP_AGENT_SEARCH_MARKET', { query: q, gl: opts.gl || 'US', hl: opts.hl || 'en' }).then(function (res) {
      expectOk(res, 'NSP_AGENT_SEARCH_MARKET');
      return (Array.isArray(res.videos) ? res.videos : []).filter(function (v) { return v && v.videoId; }).map(function (v) {
        var views = typeof v.views === 'number' && v.views > 0 ? v.views : parseCount(v.viewsText);
        return {
          videoId: String(v.videoId),
          title: String(v.title || ''),
          url: watchUrl(v.videoId),
          views: views,
          viewsText: String(v.viewsText || ''),
          channelName: String(v.channelName || ''),
          channelId: String(v.channelId || ''),
          channelUrl: absoluteYouTubeUrl(v.channelUrl),
          publishedText: String(v.publishedText || ''),
          ageDays: parseAgeDays(v.publishedText),
          lengthText: String(v.lengthText || '')
        };
      });
    });
  }

  function median(values) {
    var list = values.filter(function (n) { return typeof n === 'number' && isFinite(n); }).sort(function (a, b) { return a - b; });
    if (!list.length) return null;
    var mid = Math.floor(list.length / 2);
    return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
  }

  function hasViews(v) { return typeof v.views === 'number'; }
  function hasAge(v) { return typeof v.ageDays === 'number'; }

  function summarizeVideos(videos, viralThreshold) {
    videos = Array.isArray(videos) ? videos : [];
    var threshold = Number(viralThreshold) > 0 ? Number(viralThreshold) : 100000;
    var withViews = videos.filter(hasViews);
    var withAge = videos.filter(hasAge);
    var perDay = videos.filter(function (v) { return hasViews(v) && hasAge(v); }).map(function (v) { return v.views / Math.max(1, v.ageDays); });
    var ages = withAge.map(function (v) { return v.ageDays; }).sort(function (a, b) { return a - b; });
    var gaps = [];
    for (var i = 1; i < ages.length; i++) gaps.push(ages[i] - ages[i - 1]);
    var viral = withViews.filter(function (v) { return v.views >= threshold; });
    return {
      analyzed: videos.length,
      withViews: withViews.length,
      withAge: withAge.length,
      unreadableViews: videos.length - withViews.length,
      unreadableAge: videos.length - withAge.length,
      viralThreshold: threshold,
      viralCount: viral.length,
      viralShare: withViews.length ? viral.length / withViews.length : null,
      medianViews: median(withViews.map(function (v) { return v.views; })),
      medianViewsPerDay: median(perDay),
      uploadsLast30Days: withAge.filter(function (v) { return v.ageDays <= 30; }).length,
      medianDaysBetweenUploads: gaps.length ? median(gaps) : null,
      topVideos: withViews.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, 5)
    };
  }

  var STOPWORD = /^(?:this|that|with|from|your|what|when|where|which|have|they|them|will|about|into|over|than|then|there|these|those|just|more|most|only|very|were|been|after|before|every|video|videos|official|full|part|episode|para|como|esta|este|estos|estas|sobre|porque|cuando|donde|todo|todos|pero|desde|hasta|entre|tiene|hacer|mais|pela|pelo|voce|isso|essa|esse|dans|pour|avec|sont|nicht|eine|einer|oder|auch|wird|sind)$/;

  function titleTerms(title) {
    var words = String(title || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    var terms = {};
    words.forEach(function (w) { if (w.length >= 4 && !/^\d+$/.test(w) && !STOPWORD.test(w)) terms[w] = true; });
    var pairs = {};
    for (var i = 1; i < words.length; i++) {
      var a = words[i - 1], b = words[i];
      if (a.length >= 3 && b.length >= 3 && !STOPWORD.test(a) && !STOPWORD.test(b)) pairs[a + ' ' + b] = true;
    }
    return { terms: Object.keys(terms), pairs: Object.keys(pairs) };
  }

  function termTable(items, key, minCount) {
    var table = {};
    items.forEach(function (item) {
      titleTerms(item.title)[key].forEach(function (t) {
        if (!table[t]) table[t] = [];
        table[t].push(item);
      });
    });
    return Object.keys(table).filter(function (t) { return table[t].length >= (minCount || 2); }).map(function (t) {
      return { term: t, count: table[t].length, medianViews: median(table[t].filter(hasViews).map(function (v) { return v.views; })) };
    }).sort(function (a, b) { return b.count - a.count || (b.medianViews || 0) - (a.medianViews || 0); });
  }

  var TITLE_FEATURES = [
    ['a number', /\d/],
    ['a question', /[?¿]/],
    ['a word in capitals', /(?:^|[^\p{L}])\p{Lu}{3,}(?![\p{L}])/u],
    ['brackets', /[\[\]()]/],
    ['a colon or pipe', /[:|]/]
  ];

  function titlePatterns(items) {
    items = (Array.isArray(items) ? items : []).filter(function (v) { return v && v.title; });
    var n = items.length;
    var features = TITLE_FEATURES.map(function (f) {
      var withIt = items.filter(function (v) { return f[1].test(v.title); });
      var without = items.filter(function (v) { return !f[1].test(v.title); });
      var mWith = withIt.filter(hasViews).length >= 2 ? median(withIt.filter(hasViews).map(function (v) { return v.views; })) : null;
      var mWithout = without.filter(hasViews).length >= 2 ? median(without.filter(hasViews).map(function (v) { return v.views; })) : null;
      return { feature: f[0], share: n ? withIt.length / n : 0, medianViewsWith: mWith, medianViewsWithout: mWithout };
    });
    return {
      sample: n,
      withViews: items.filter(hasViews).length,
      avgWords: n ? items.reduce(function (s, v) { return s + v.title.trim().split(/\s+/).length; }, 0) / n : null,
      avgChars: n ? items.reduce(function (s, v) { return s + v.title.trim().length; }, 0) / n : null,
      features: features,
      topTerms: termTable(items, 'terms', 2).slice(0, 12),
      topPairs: termTable(items, 'pairs', 2).slice(0, 8)
    };
  }

  function groupByChannel(videos) {
    var map = {};
    var order = [];
    videos.forEach(function (v) {
      var key = v.channelId || v.channelUrl || v.channelName.toLowerCase();
      if (!key) return;
      if (!map[key]) {
        map[key] = { name: v.channelName, url: v.channelUrl, channelId: v.channelId, videos: [] };
        order.push(key);
      }
      map[key].videos.push(v);
    });
    return order.map(function (key) {
      var g = map[key];
      var counted = g.videos.filter(hasViews);
      var top = counted.slice().sort(function (a, b) { return b.views - a.views; })[0] || g.videos[0];
      return {
        name: g.name,
        url: g.url,
        channelId: g.channelId,
        videosInResults: g.videos.length,
        totalViews: counted.length ? counted.reduce(function (s, v) { return s + v.views; }, 0) : null,
        medianViews: median(counted.map(function (v) { return v.views; })),
        topVideo: top ? { title: top.title, url: top.url, views: hasViews(top) ? top.views : null } : null
      };
    });
  }

  function sortVideos(videos, sortBy) {
    var list = videos.slice();
    if (sortBy === 'recent') {
      list.sort(function (a, b) { return (hasAge(a) ? a.ageDays : Infinity) - (hasAge(b) ? b.ageDays : Infinity); });
    } else {
      list.sort(function (a, b) { return (hasViews(b) ? b.views : -1) - (hasViews(a) ? a.views : -1); });
    }
    return list;
  }

  function searchTitles(keywords, opts) {
    opts = opts || {};
    return searchVideos(keywords, opts).then(function (videos) {
      return {
        query: String(keywords || '').trim(),
        sample: videos.length,
        unreadableViews: videos.filter(function (v) { return !hasViews(v); }).length,
        videos: sortVideos(videos, opts.sortBy),
        channels: groupByChannel(videos).sort(function (a, b) { return (b.totalViews || 0) - (a.totalViews || 0); }),
        patterns: titlePatterns(videos)
      };
    });
  }

  function marketRadar(seeds, opts) {
    var list = (Array.isArray(seeds) ? seeds : [seeds]).map(function (s) { return String(s || '').trim(); }).filter(Boolean).slice(0, 8);
    if (!list.length) return Promise.reject(reasonError('no_query', FAILURE_TEXT.no_query));
    var rows = [];
    return list.reduce(function (chain, seed) {
      return chain.then(function () {
        return settle(searchVideos(seed, opts)).then(function (r) {
          if (!r.ok) { rows.push({ keyword: seed, error: r.error.message }); return; }
          var videos = r.value;
          var counted = videos.filter(hasViews);
          var channels = groupByChannel(videos);
          var total = counted.reduce(function (s, v) { return s + v.views; }, 0);
          var lead = channels.slice().sort(function (a, b) { return (b.totalViews || 0) - (a.totalViews || 0); })[0];
          var recent = videos.filter(function (v) { return hasAge(v) && v.ageDays <= 30; });
          rows.push({
            keyword: seed,
            results: videos.length,
            withViews: counted.length,
            medianViews: median(counted.map(function (v) { return v.views; })),
            topViews: counted.length ? Math.max.apply(null, counted.map(function (v) { return v.views; })) : null,
            distinctChannels: channels.length,
            leadChannel: lead ? lead.name : '',
            leadChannelShare: lead && total ? (lead.totalViews || 0) / total : null,
            recentCount: recent.length,
            recentMedianViews: median(recent.filter(hasViews).map(function (v) { return v.views; }))
          });
        });
      });
    }, Promise.resolve()).then(function () { return rows; });
  }

  function competitorMap(input, opts) {
    var text = String(input || '').trim();
    if (!text) return Promise.reject(reasonError('no_query', FAILURE_TEXT.no_query));
    if (!looksLikeChannel(text)) {
      return searchVideos(text, opts).then(function (videos) {
        return { basis: 'keyword', query: text, sample: videos.length, competitors: groupByChannel(videos).sort(function (a, b) { return (b.totalViews || 0) - (a.totalViews || 0); }).slice(0, 12) };
      });
    }
    var url;
    try { url = requireChannelUrl(text); } catch (e) { return Promise.reject(e); }
    return Promise.all([settle(channelStats(url)), channelVideos(url)]).then(function (both) {
      var stats = both[0].ok ? both[0].value : null;
      var own = both[1].videos;
      var terms = titlePatterns(own).topTerms.slice(0, 3).map(function (t) { return t.term; });
      var query = terms.length ? terms.join(' ') : (stats && stats.name) || '';
      if (!query) throw reasonError('no_query', 'The channel titles gave no searchable topic.');
      var ownName = stats && stats.name ? stats.name.toLowerCase() : '';
      return searchVideos(query, opts).then(function (videos) {
        var others = videos.filter(function (v) {
          if (v.channelUrl && normalizeChannelUrl(v.channelUrl) === url) return false;
          return !(ownName && v.channelName.toLowerCase() === ownName);
        });
        return {
          basis: 'channel',
          channel: stats ? stats.name : url,
          query: query,
          sample: videos.length,
          competitors: groupByChannel(others).sort(function (a, b) { return (b.totalViews || 0) - (a.totalViews || 0); }).slice(0, 12)
        };
      });
    });
  }

  // A term counts as a gap when few of the results use it and those few pull well above the median.
  function gapFinder(seed, opts) {
    return searchVideos(seed, opts).then(function (videos) {
      var counted = videos.filter(hasViews);
      var overall = median(counted.map(function (v) { return v.views; }));
      var cap = Math.max(3, Math.ceil(counted.length * 0.25));
      var gaps = overall ? termTable(counted, 'terms', 2).filter(function (t) {
        return t.count <= cap && t.medianViews !== null && t.medianViews >= overall * 2;
      }).map(function (t) {
        return { term: t.term, videos: t.count, medianViews: t.medianViews, lift: t.medianViews / overall };
      }).sort(function (a, b) { return b.lift - a.lift; }).slice(0, 10) : [];
      return { query: String(seed || '').trim(), sample: counted.length, overallMedianViews: overall, gaps: gaps };
    });
  }

  function patternFinder(input, opts) {
    var text = String(input || '').trim();
    if (!text) return Promise.reject(reasonError('no_query', FAILURE_TEXT.no_query));
    if (looksLikeChannel(text)) {
      return channelVideos(text).then(function (r) {
        return { source: 'channel', label: r.url, patterns: titlePatterns(r.videos), top: sortVideos(r.videos, 'views').slice(0, 5) };
      });
    }
    return searchVideos(text, opts).then(function (videos) {
      return { source: 'search', label: text, patterns: titlePatterns(videos), top: sortVideos(videos, 'views').slice(0, 5) };
    });
  }

  function channelAge(input, maxMonths) {
    return channelStats(input).then(function (stats) {
      var limit = Number(maxMonths) > 0 ? Number(maxMonths) : null;
      return Object.assign({}, stats, {
        maxMonths: limit,
        passesFilter: stats.monthsOld === null || limit === null ? null : stats.monthsOld <= limit
      });
    });
  }

  function viralMetrics(input, opts) {
    opts = opts || {};
    return channelVideos(input).then(function (r) {
      return { url: r.url, videos: r.videos, metrics: summarizeVideos(r.videos, opts.viralThreshold) };
    });
  }

  function scanChannelFull(input, opts) {
    opts = opts || {};
    var url;
    try { url = requireChannelUrl(input); } catch (e) { return Promise.reject(e); }
    return Promise.all([settle(channelStats(url)), settle(channelVideos(url))]).then(function (both) {
      if (!both[0].ok && !both[1].ok) throw both[1].error;
      var videos = both[1].ok ? both[1].value.videos : [];
      return {
        url: url,
        stats: both[0].ok ? both[0].value : null,
        statsError: both[0].ok ? '' : both[0].error.message,
        videos: videos,
        videosError: both[1].ok ? '' : both[1].error.message,
        summary: summarizeVideos(videos, opts.viralThreshold),
        patterns: titlePatterns(videos)
      };
    });
  }

  function batchScan(inputs, opts, onProgress) {
    opts = opts || {};
    var list = (Array.isArray(inputs) ? inputs : []).map(function (s) { return String(s || '').trim(); }).filter(Boolean);
    var seen = {};
    list = list.filter(function (s) { var k = s.toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; }).slice(0, 20);
    var maxMonths = Number(opts.maxMonths) > 0 ? Number(opts.maxMonths) : null;
    var minViral = Number(opts.minViralVideos) > 0 ? Number(opts.minViralVideos) : 0;
    var rows = [];
    var errors = [];
    return list.reduce(function (chain, input, index) {
      return chain.then(function () {
        if (typeof onProgress === 'function') onProgress(index + 1, list.length, input);
        return settle(scanChannelFull(input, { viralThreshold: opts.viralThreshold })).then(function (r) {
          if (!r.ok) { errors.push({ input: input, error: r.error.message }); return; }
          var scan = r.value;
          var stats = scan.stats || {};
          var monthsOld = typeof stats.monthsOld === 'number' ? stats.monthsOld : null;
          var ageOk = maxMonths === null ? true : (monthsOld === null ? null : monthsOld <= maxMonths);
          var viralOk = minViral === 0 ? true : (scan.summary.withViews ? scan.summary.viralCount >= minViral : null);
          rows.push({
            input: input,
            url: scan.url,
            name: stats.name || input,
            subscribersText: stats.subscribersText || '',
            monthsOld: monthsOld,
            analyzed: scan.summary.analyzed,
            withViews: scan.summary.withViews,
            viralCount: scan.summary.viralCount,
            medianViews: scan.summary.medianViews,
            medianViewsPerDay: scan.summary.medianViewsPerDay,
            ageOk: ageOk,
            viralOk: viralOk,
            passesAll: ageOk === true && viralOk === true,
            problems: [scan.statsError, scan.videosError].filter(Boolean)
          });
        });
      });
    }, Promise.resolve()).then(function () {
      rows.sort(function (a, b) {
        if (a.passesAll !== b.passesAll) return a.passesAll ? -1 : 1;
        return (b.medianViewsPerDay || 0) - (a.medianViewsPerDay || 0);
      });
      return {
        scanned: rows.length,
        passing: rows.filter(function (r) { return r.passesAll; }).length,
        maxMonths: maxMonths,
        minViralVideos: minViral,
        viralThreshold: Number(opts.viralThreshold) > 0 ? Number(opts.viralThreshold) : 100000,
        rows: rows,
        errors: errors
      };
    });
  }

  function titleList(videos, limit) {
    return videos.slice(0, limit || 12).map(function (v, i) {
      return (i + 1) + '. ' + v.title + (v.viewsText ? ' (' + v.viewsText + (v.publishedText ? ', ' + v.publishedText : '') + ')' : '');
    }).join('\n');
  }

  function generateSubniches(niche, opts) {
    opts = opts || {};
    var topic = String(niche || '').trim();
    if (!topic) return Promise.reject(reasonError('no_query', 'Pick a niche first.'));
    var source = opts.channel ? settle(channelVideos(opts.channel)) : Promise.resolve(null);
    return source.then(function (read) {
      var videos = read && read.ok ? sortVideos(read.value.videos, 'views') : [];
      var titles = videos.map(function (v) { return v.title; });
      var prompt = 'Parent niche: "' + topic + '". Write every text value in ' + languageName(opts.language) + '.\n';
      if (videos.length) prompt += 'Real videos of the reference channel, most viewed first:\n' + titleList(videos, 12) + '\n';
      prompt += 'Return {"subNiches":[{"name":"","angle":"one sentence","exampleTitles":["","",""]}]' +
        (videos.length ? ',"replicationIdeas":[{"basedOn":"one title copied exactly from the list above","twist":"how to make it your own","exampleTitle":""}]' : '') +
        ',"avoid":["what to stay away from in this niche"]} with 4 subNiches' + (videos.length ? ' and 3 replicationIdeas' : '') + '.';
      return chatJson(prompt, 1500).then(function (res) {
        var data = res.data || {};
        var lowered = titles.map(function (t) { return t.toLowerCase().trim(); });
        var ideas = (Array.isArray(data.replicationIdeas) ? data.replicationIdeas : []).filter(function (idea) {
          return idea && lowered.indexOf(String(idea.basedOn || '').toLowerCase().trim()) >= 0;
        });
        return {
          subNiches: Array.isArray(data.subNiches) ? data.subNiches.filter(function (s) { return s && s.name; }) : [],
          replicationIdeas: ideas,
          avoid: Array.isArray(data.avoid) ? data.avoid.map(String) : [],
          basedOnTitles: titles.length,
          channelNote: opts.channel && !(read && read.ok) ? 'The reference channel could not be read: ' + (read && read.error ? read.error.message : 'unknown error') : '',
          provider: res.provider,
          model: res.model
        };
      });
    });
  }

  function generateNicheIdeas(niche, language) {
    var topic = String(niche || '').trim();
    if (!topic) return Promise.reject(reasonError('no_query', 'Enter a niche first.'));
    var prompt = 'Niche: "' + topic + '". Write every text value in ' + languageName(language) + '.\n' +
      'Return {"titles":[10 video titles],"hooks":[5 opening lines for the first 10 seconds],"thumbnailConcepts":[5 faceless thumbnail concepts]}.';
    return chatJson(prompt, 1500).then(function (res) {
      var d = res.data || {};
      function strings(list) { return Array.isArray(list) ? list.map(String).filter(Boolean) : []; }
      return { titles: strings(d.titles), hooks: strings(d.hooks), thumbnailConcepts: strings(d.thumbnailConcepts), provider: res.provider, model: res.model };
    });
  }

  function generateContentScript(niche, opts) {
    opts = opts || {};
    var topic = String(niche || '').trim();
    if (!topic) return Promise.reject(reasonError('no_query', 'Enter a topic first.'));
    var minutes = Number(opts.minutes) > 0 ? Number(opts.minutes) : 8;
    var prompt = 'Topic: "' + topic + '", a faceless documentary of about ' + minutes + ' minutes. Write every text value in ' + languageName(opts.language) + '.\n' +
      'Return {"title":"","hook":"the first 15 seconds of narration","outline":[{"section":"","summary":"two sentences"}],"thumbnailConcept":""} with 5 to 7 outline sections.';
    return chatJson(prompt, 1800).then(function (res) {
      var d = res.data || {};
      return {
        title: String(d.title || ''),
        hook: String(d.hook || ''),
        outline: Array.isArray(d.outline) ? d.outline.filter(function (s) { return s && s.section; }) : [],
        thumbnailConcept: String(d.thumbnailConcept || ''),
        provider: res.provider,
        model: res.model
      };
    });
  }

  // The AI only reads what was measured: stats, titles and view counts go in the prompt.
  function analyzeChannel(scan, language) {
    if (!scan || !scan.videos) return Promise.reject(reasonError('no_data', 'Scan the channel first.'));
    var s = scan.stats || {};
    var facts = [
      'Channel: ' + (s.name || scan.url),
      s.subscribersText ? 'Subscribers: ' + s.subscribersText : '',
      s.videoCountText ? 'Videos: ' + s.videoCountText : '',
      s.joinedText ? 'Joined: ' + s.joinedText : '',
      s.description ? 'Description: ' + s.description.slice(0, 300) : ''
    ].filter(Boolean).join('\n');
    var prompt = facts + '\nRecent videos, with views and age where YouTube showed them:\n' + titleList(scan.videos, 15) +
      '\nWrite every text value in ' + languageName(language) + '. Base every point on the data above.\n' +
      'Return {"niche":"specific niche in a few words","format":"how the videos seem to be made","strengths":["",""],"weaknesses":["",""],"contentGaps":["","",""],"subniches":[{"name":"","why":"","firstVideo":"a title"}],"nextSteps":["","",""]} with 3 subniches.';
    return chatJson(prompt, 1600).then(function (res) {
      var d = res.data || {};
      function strings(list) { return Array.isArray(list) ? list.map(String).filter(Boolean) : []; }
      return {
        niche: String(d.niche || ''),
        format: String(d.format || ''),
        strengths: strings(d.strengths),
        weaknesses: strings(d.weaknesses),
        contentGaps: strings(d.contentGaps),
        subniches: Array.isArray(d.subniches) ? d.subniches.filter(function (x) { return x && x.name; }) : [],
        nextSteps: strings(d.nextSteps),
        provider: res.provider,
        model: res.model
      };
    });
  }

  // The service worker reads the channel's real videos itself and owns the prompt.
  function replicate(channelInput, language) {
    var url;
    try { url = requireChannelUrl(channelInput); } catch (e) { return Promise.reject(e); }
    return aiTask('replicate', { channelUrl: url, language: language || 'en' }).then(function (res) {
      var r = res.result;
      return {
        source: r.source && typeof r.source === 'object' ? r.source : { name: '', url: url },
        basedOn: Array.isArray(r.basedOn) ? r.basedOn.map(String) : [],
        videos: Array.isArray(r.videos) ? r.videos.filter(function (v) { return v && v.title; }) : [],
        provider: res.provider,
        model: res.model
      };
    });
  }

  function buildBrand(niche, tone, language) {
    var topic = String(niche || '').trim();
    if (!topic) return Promise.reject(reasonError('no_query', 'Enter a niche first.'));
    return aiTask('brand', { niche: topic, tone: tone || 'pro', language: language || 'en' }).then(function (res) {
      var r = res.result;
      return {
        channelNames: Array.isArray(r.channelNames) ? r.channelNames : [],
        bio: r.bio,
        strategySummary: r.strategySummary,
        provider: res.provider,
        model: res.model
      };
    });
  }

  return {
    sendToSW: sendToSW,
    getProviderStatus: getProviderStatus,
    languageName: languageName,
    parseApiJson: parseApiJson,
    parseCount: parseCount,
    parseAgeDays: parseAgeDays,
    parseJoinedDate: parseJoinedDate,
    normalizeChannelUrl: normalizeChannelUrl,
    looksLikeChannel: looksLikeChannel,
    channelStats: channelStats,
    channelVideos: channelVideos,
    searchVideos: searchVideos,
    summarizeVideos: summarizeVideos,
    titlePatterns: titlePatterns,
    channelAge: channelAge,
    viralMetrics: viralMetrics,
    searchTitles: searchTitles,
    marketRadar: marketRadar,
    competitorMap: competitorMap,
    gapFinder: gapFinder,
    patternFinder: patternFinder,
    scanChannelFull: scanChannelFull,
    batchScan: batchScan,
    chat: chat,
    generateSubniches: generateSubniches,
    generateNicheIdeas: generateNicheIdeas,
    generateContentScript: generateContentScript,
    analyzeChannel: analyzeChannel,
    replicate: replicate,
    buildBrand: buildBrand
  };
})();
