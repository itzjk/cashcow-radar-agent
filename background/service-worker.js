// Classic service worker, so importScripts runs at initial evaluation. Order matters: NSPPolicy needs NSPText.
try { importScripts('../lib/nsp-text.js', '../nsp-policy.js', '../lib/nsp-models.js'); } catch (eNspText) { console.warn('[NSP SW] importScripts policy engine:', eNspText && eNspText.message); }

var NSP_GEMINI_LIMIT_PER_MIN = 14;
var NSP_GROQ_LIMIT_PER_MIN = 28;
// A bare timer is not extension activity, so a wait longer than this can be killed with the worker and the caller never gets an answer.
var NSP_MAX_SLEEP_MS = 5000;

// The window has to outlive the worker: MV3 tears it down after about 30s idle, and an in-memory array would reset the count on every restart.
function nspRateStore() {
  return (chrome.storage && chrome.storage.session) ? chrome.storage.session : chrome.storage.local;
}

var _nspRateQueue = Promise.resolve();

function nspRateReserve(bucket, limitPerMin) {
  var key = 'nsp_rate_' + bucket;
  _nspRateQueue = _nspRateQueue.then(function() {
    return new Promise(function(resolve) {
      var store = nspRateStore();
      store.get(key, function(r) {
        var now = Date.now();
        var times = ((r && Array.isArray(r[key])) ? r[key] : []).filter(function(t) { return typeof t === 'number' && (now - t) < 60000; });
        var granted = times.length < limitPerMin;
        if (granted) times.push(now);
        var payload = {};
        payload[key] = times;
        store.set(payload, function() {
          if (granted) { resolve({ granted: true, waitMs: 0, used: times.length }); return; }
          var waitMs = (times[0] + 60000) - now + 100;
          resolve({ granted: false, waitMs: waitMs > 0 ? waitMs : 0, used: times.length });
        });
      });
    });
  }).catch(function() { return { granted: true, waitMs: 0, used: 0 }; });
  return _nspRateQueue;
}

async function nspRateLimitGate(bucket, limitPerMin) {
  var res = await nspRateReserve(bucket, limitPerMin);
  if (res.granted) return { ok: true };
  console.log('[NSP rate-limiter ' + bucket + '] ' + res.used + '/' + limitPerMin + ' used in the last minute, ' + Math.ceil(res.waitMs / 1000) + 's to free a slot');
  if (res.waitMs <= NSP_MAX_SLEEP_MS) {
    await new Promise(function(r) { setTimeout(r, res.waitMs); });
    var again = await nspRateReserve(bucket, limitPerMin);
    if (again.granted) return { ok: true };
    return { ok: false, retryAfter: Math.ceil(again.waitMs / 1000) };
  }
  return { ok: false, retryAfter: Math.ceil(res.waitMs / 1000) };
}

function nspGeminiWaitForRateLimit() {
  return nspRateLimitGate('gemini', NSP_GEMINI_LIMIT_PER_MIN);
}

function nspGroqWaitForRateLimit() {
  return nspRateLimitGate('groq', NSP_GROQ_LIMIT_PER_MIN);
}

// Groq and Ollama speak the OpenAI format, Gemini does not; these helpers normalize both to {ok, text, functionCalls}.
function nspMessagesToOpenAI(messages) {
  return (messages || []).map(function(m) {
    var role = m.role === 'assistant' || m.role === 'model' ? 'assistant' :
               m.role === 'function' || m.role === 'tool' ? 'tool' : 'user';
    var content = String(m.content || '');
    if (role === 'tool' && m.functionResponse) {
      return { role: 'tool', tool_call_id: m.toolCallId || m.functionResponse.name || 'call', name: m.functionResponse.name, content: JSON.stringify(m.functionResponse.response || {}) };
    }
    if (m.functionCall) {
      return { role: 'assistant', content: null, tool_calls: [{ id: m.functionCall.id || 'call_' + Date.now(), type: 'function', function: { name: m.functionCall.name, arguments: JSON.stringify(m.functionCall.args || {}) } }] };
    }
    return { role: role, content: content };
  });
}

function nspToolsToOpenAI(tools) {
  if (!Array.isArray(tools) || !tools.length) return [];
  var openAITools = [];
  tools.forEach(function(group) {
    var decls = group && group.functionDeclarations || [];
    decls.forEach(function(decl) {
      openAITools.push({
        type: 'function',
        function: {
          name: decl.name,
          description: decl.description || '',
          parameters: decl.parameters || { type: 'object', properties: {} }
        }
      });
    });
  });
  return openAITools;
}

function nspParseOpenAIResponse(data) {
  if (!data || data.error) {
    return { ok: false, error: (data && data.error && (data.error.message || data.error)) || 'unknown' };
  }
  var choice = (data.choices && data.choices[0]) || null;
  if (!choice) return { ok: false, error: 'no_choices_in_response', raw: data };
  var msg = choice.message || {};
  var text = String(msg.content || '');
  var functionCalls = [];
  if (Array.isArray(msg.tool_calls)) {
    msg.tool_calls.forEach(function(tc) {
      if (tc && tc.function) {
        var args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) { args = { _parseError: true, raw: tc.function.arguments }; }
        functionCalls.push({ name: tc.function.name, args: args, id: tc.id });
      }
    });
  }
  return { ok: true, text: text, functionCalls: functionCalls, raw: data };
}

// Without a timeout, an AI fetch that connects but never answers leaves the handler on `return true` forever and sendResponse never runs.
function nspFetchTimeout(url, opts, ms) {
  opts = opts || {};
  var ctrl = new AbortController();
  var to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 45000);
  opts.signal = ctrl.signal;
  return fetch(url, opts).finally(function () { clearTimeout(to); });
}

// The Groq free tier has a low tokens-per-minute cap, so the system prompt is cut to about 9000 characters to keep one turn under it.
async function nspCallGroq(apiKey, model, payload, messages) {
  var gate = await nspGroqWaitForRateLimit();
  if (!gate.ok) {
    return { ok: false, error: NSP_GROQ_LIMIT_PER_MIN + ' requests already sent in the last minute, ' + gate.retryAfter + 's to a free slot', rateLimited: true, retryAfter: gate.retryAfter };
  }
  var openAIMessages = nspMessagesToOpenAI(messages);
  if (payload.system) openAIMessages.unshift({ role: 'system', content: String(payload.system).slice(0, 9000) });
  var body = {
    model: model,
    messages: openAIMessages,
    max_tokens: Math.max(256, Math.min(2048, Number(payload.maxTokens) || 1536)),
    temperature: 0.7
  };
  var openAITools = nspToolsToOpenAI(payload.tools);
  if (openAITools.length) { body.tools = openAITools; body.tool_choice = 'auto'; }
  var t0 = Date.now();
  var resp, data;
  try {
    resp = await nspFetchTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body)
    }, 45000);
    data = await resp.json();
  } catch (eNet) {
    // A network failure returns {ok:false} instead of throwing, or the provider cascade breaks instead of falling through.
    console.warn('[NSP SW] Groq network/timeout:', eNet && eNet.message);
    return { ok: false, error: 'Groq network: ' + String((eNet && eNet.message) || eNet), rateLimited: false };
  }
  var elapsedMs = Date.now() - t0;
  console.log('[NSP SW] Groq ' + model + ' → ' + elapsedMs + 'ms, ' + (resp.ok ? 'OK' : 'FAIL ' + resp.status));
  if (!resp.ok) {
    var isRate = resp.status === 429;
    var retryAfter = 0;
    if (isRate) {
      // Groq sends the delay in the retry-after header, or inside the error message text.
      retryAfter = parseFloat(resp.headers.get('retry-after')) || 0;
      var rmsg = (data && data.error && data.error.message) ? String(data.error.message) : '';
      if (!retryAfter && rmsg) {
        var mm = rmsg.match(/try again in\s+([\d.]+)\s*s/i);
        if (mm) retryAfter = parseFloat(mm[1]);
      }
    }
    return {
      ok: false,
      error: 'Groq ' + resp.status + ': ' + ((data && data.error && (data.error.message || data.error)) || 'error'),
      rateLimited: isRate,
      retryAfter: retryAfter,
      detail: data && data.error
    };
  }
  var parsed = nspParseOpenAIResponse(data);
  if (parsed.ok) parsed.elapsedMs = elapsedMs;
  return parsed;
}

async function nspCallGroqWithRetry(apiKey, model, payload, messages) {
  var attempts = 0;
  while (true) {
    var res = await nspCallGroq(apiKey, model, payload, messages);
    if (res.ok) return res;
    if (res.rateLimited && res.retryAfter > 0 && ((res.retryAfter + 0.5) * 1000) <= NSP_MAX_SLEEP_MS && attempts < 1) {
      console.log('[NSP SW] Groq rate limit, waiting ' + res.retryAfter + 's before retrying');
      await new Promise(function(r) { setTimeout(r, (res.retryAfter + 0.5) * 1000); });
      attempts++;
      continue;
    }
    return res;
  }
}

async function nspDetectLocalModels(url) {
  try {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 2500);
    var resp = await fetch(String(url).replace(/\/$/, '') + '/api/tags', { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return [];
    var data = await resp.json();
    return (data && Array.isArray(data.models) ? data.models : []).map(function (m) { return m.name; }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function nspPickLocalModel(names) {
  var preferred = [/^qwen2\.5:7b/i, /^llama3\.1:8b/i, /^llama3\.2/i, /^qwen2\.5/i, /^llama3/i, /^mistral/i, /^gemma/i];
  for (var i = 0; i < preferred.length; i++) {
    for (var j = 0; j < names.length; j++) if (preferred[i].test(names[j])) return names[j];
  }
  return names[0] || '';
}

async function nspAutoEnableLocalProvider() {
  var stored = await new Promise(function (resolve) {
    chrome.storage.local.get(['nsp_ollama_url', 'nsp_ollama_enabled', 'nsp_ollama_model', 'nsp_ollama_optout'], resolve);
  });
  if (stored && stored.nsp_ollama_optout === true) return;
  var url = (stored && stored.nsp_ollama_url) || 'http://localhost:11434';
  var names = await nspDetectLocalModels(url);
  if (!names.length) {
    if (stored && stored.nsp_ollama_enabled === true && !stored.nsp_ollama_model) {
      chrome.storage.local.set({ nsp_ollama_enabled: false });
    }
    return;
  }
  var keep = (stored && stored.nsp_ollama_model && names.indexOf(stored.nsp_ollama_model) !== -1)
    ? stored.nsp_ollama_model
    : nspPickLocalModel(names);
  chrome.storage.local.set({ nsp_ollama_enabled: true, nsp_ollama_url: url, nsp_ollama_model: keep });
  console.log('[NSP SW] local provider ready: ' + keep + ' of ' + names.length + ' installed');
}

async function nspPingOllama(url) {
  try {
    var ctrl = new AbortController();
    var timeoutId = setTimeout(function() { ctrl.abort(); }, 2000);
    var resp = await fetch(String(url).replace(/\/$/, '') + '/api/tags', { signal: ctrl.signal });
    clearTimeout(timeoutId);
    return resp.ok;
  } catch (e) {
    return false;
  }
}

function nspLeanMessagesForLocal(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map(function (m) {
    if (!m || m.role !== 'system' || typeof m.content !== 'string') return m;
    var c = m.content;
    if (c.length <= 3200) return m;
    var head = c.slice(0, 1400);
    var tail = c.slice(-1800);
    return { role: 'system', content: head + '\n\n' + tail };
  });
}

async function nspCallOllama(url, model, payload, messages) {
  messages = nspLeanMessagesForLocal(messages);
  var openAIMessages = nspMessagesToOpenAI(messages);
  if (payload.system) openAIMessages.unshift(nspLeanMessagesForLocal([{ role: 'system', content: String(payload.system).slice(0, 24000) }])[0]);
  var body = {
    model: model,
    messages: openAIMessages,
    stream: false,
    keep_alive: '30m',
    options: {
      num_predict: Math.max(96, Math.min(8192, Number(payload.maxTokens) || 700)),
      temperature: 0.7
    }
  };
  var openAITools = nspToolsToOpenAI(payload.tools);
  if (openAITools.length) { body.tools = openAITools; }
  var endpoint = String(url).replace(/\/$/, '') + '/v1/chat/completions';
  var resp, data;
  try {
    resp = await nspFetchTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 45000);
    data = await resp.json();
  } catch (eNet) {
    // Same as Groq: return {ok:false} instead of throwing so the cascade falls through to the next provider.
    console.warn('[NSP SW] Ollama network/timeout:', eNet && eNet.message);
    return { ok: false, error: 'Ollama network: ' + String((eNet && eNet.message) || eNet) };
  }
  if (!resp.ok) {
    return { ok: false, error: 'Ollama ' + resp.status + ': ' + JSON.stringify(data).slice(0, 200) };
  }
  return nspParseOpenAIResponse(data);
}

async function nspCallGemini(geminiKey, cachedModel, payload, messages) {
  var modelChain = [];
  if (cachedModel) modelChain.push(cachedModel);
  // Ordered by how likely each model is to be reachable.
  var fallbacks = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash'
  ];
  fallbacks.forEach(function(m) {
    if (modelChain.indexOf(m) === -1) modelChain.push(m);
  });
  if (payload.model && /^gemini/.test(payload.model) && modelChain.indexOf(payload.model) === -1) {
    modelChain.unshift(payload.model);
  }

  var contents = messages.slice(-50).map(function(m) {
    return {
      role: (m.role === 'assistant') ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 16000) }]
    };
  });
  var body = {
    contents: contents,
    generationConfig: {
      maxOutputTokens: Math.max(256, Math.min(8192, Number(payload.maxTokens) || 2048)),
      temperature: 0.7
    }
  };
  if (typeof payload.system === 'string' && payload.system.trim()) {
    body.systemInstruction = { parts: [{ text: String(payload.system).slice(0, 24000) }] };
  }
  if (Array.isArray(payload.tools) && payload.tools.length) {
    body.tools = payload.tools;
  }

  var lastError = 'no_models_tried';
  var lastDetail = null;
  var triedLog = [];
  var rateLimitedDelay = 0;

  for (var idx = 0; idx < modelChain.length; idx++) {
    var modelName = modelChain[idx];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(geminiKey);

    var retryCount = 0;
    var maxRetries = 2;
    var modelDone = false;

    while (!modelDone && retryCount <= maxRetries) {
      try {
        var gate = await nspGeminiWaitForRateLimit();
        if (!gate.ok) {
          return { ok: false, error: NSP_GEMINI_LIMIT_PER_MIN + ' requests already sent in the last minute, ' + gate.retryAfter + 's to a free slot', triedModels: triedLog, rateLimited: true, retryAfter: gate.retryAfter };
        }
        var resp = await nspFetchTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }, 45000);
        var data = await resp.json();
        if (data && data.error) {
          var errCode = data.error.code || 0;
          var errStatus = data.error.status || '';
          var errMsg = data.error.message || 'unknown';
          triedLog.push(modelName + ' → ' + errStatus + ' (' + errCode + ')' + (retryCount > 0 ? ' [retry ' + retryCount + ']' : ''));

          if (errCode === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
            var retryDelaySec = 0;
            try {
              var details = data.error.details || [];
              for (var di = 0; di < details.length; di++) {
                if (details[di] && details[di].retryDelay) {
                  retryDelaySec = parseFloat(details[di].retryDelay) || 0;
                  break;
                }
              }
              if (!retryDelaySec) {
                var matchD = errMsg.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i);
                if (matchD) retryDelaySec = parseFloat(matchD[1]);
              }
            } catch(eRd) {}

            if (retryDelaySec > 0 && ((retryDelaySec + 1) * 1000) <= NSP_MAX_SLEEP_MS && retryCount < maxRetries) {
              console.log('[NSP SW] Rate limit on ' + modelName + ', waiting ' + retryDelaySec + 's');
              await new Promise(function(res) { setTimeout(res, (retryDelaySec + 1) * 1000); });
              retryCount++;
              continue;
            }
            if (retryDelaySec > rateLimitedDelay) rateLimitedDelay = retryDelaySec;
            lastError = errMsg;
            lastDetail = data.error;
            modelDone = true;
            break;
          }

          if (errCode === 404 || errCode === 400 || errCode === 403 ||
              /not found|not supported|limit:\s*0|permission/i.test(errMsg)) {
            lastError = errMsg;
            lastDetail = data.error;
            modelDone = true;
            break;
          }
          return { ok: false, error: errMsg, detail: data.error, triedModels: triedLog, rateLimited: false };
        }

        var text = '';
        var functionCalls = [];
        var cand = null;
        try {
          if (data && Array.isArray(data.candidates) && data.candidates.length) {
            cand = data.candidates[0];
            if (cand && cand.content && Array.isArray(cand.content.parts)) {
              for (var i = 0; i < cand.content.parts.length; i++) {
                var part = cand.content.parts[i];
                if (part && typeof part.text === 'string') text += part.text;
                if (part && part.functionCall) functionCalls.push(part.functionCall);
              }
            }
          }
        } catch(e) {}
        // A block at prompt level answers 200 with no candidates at all, so nothing here can be treated as a success.
        if (!text && !functionCalls.length) {
          var blockReason = '';
          try { blockReason = (data && data.promptFeedback && data.promptFeedback.blockReason) || ''; } catch (eBlock) {}
          // A block at prompt level is not about the model, so walking the rest of the chain would spend quota on the same refusal.
          if (blockReason) {
            triedLog.push(modelName + ' → blocked ' + blockReason);
            return { ok: false, error: 'gemini_blocked_' + blockReason, detail: data.promptFeedback, triedModels: triedLog, rateLimited: false };
          }
          var emptyWhy = (cand && cand.finishReason) ? ('gemini_finished_' + cand.finishReason) : 'gemini_empty_answer';
          triedLog.push(modelName + ' → ' + emptyWhy);
          lastError = emptyWhy;
          lastDetail = cand || null;
          modelDone = true;
          break;
        }
        chrome.storage.local.set({ nsp_gemini_working_model: modelName });
        console.log('[NSP SW] Gemini model OK:', modelName, '(after trying:', triedLog, ')',
          functionCalls.length ? '+ ' + functionCalls.length + ' function calls' : '');
        return { ok: true, text: text, functionCalls: functionCalls, raw: data, modelUsed: modelName, triedModels: triedLog };
      } catch (eFetch) {
        triedLog.push(modelName + ' → fetch threw: ' + (eFetch && eFetch.message));
        lastError = String(eFetch && eFetch.message || eFetch);
        modelDone = true;
        break;
      }
    } // end while retries
  } // end for modelChain

  return { ok: false, error: lastError, detail: lastDetail, triedModels: triedLog, rateLimited: rateLimitedDelay > 0, retryAfter: rateLimitedDelay };
}

async function nspFetchImageAsBase64(url) {
  var resp = await nspFetchTimeout(url, { method: 'GET' }, 15000);
  if (!resp || !resp.ok) throw new Error('thumb_http_' + (resp ? resp.status : 'noresp'));
  var buf = await resp.arrayBuffer();
  var bytes = new Uint8Array(buf);
  var bin = '';
  for (var i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  var ct = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || 'image/jpeg';
  if (!/^image\//.test(ct)) ct = 'image/jpeg';
  return { data: btoa(bin), mimeType: ct };
}

async function nspCallGeminiVision(geminiKey, cachedModel, images, prompt, system) {
  var modelChain = [];
  if (cachedModel) modelChain.push(cachedModel);
  ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'].forEach(function (m) {
    if (modelChain.indexOf(m) === -1) modelChain.push(m);
  });
  var parts = [{ text: String(prompt || '').slice(0, 8000) }];
  (images || []).slice(0, 6).forEach(function (img) {
    if (img && img.data) parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data } });
  });
  var body = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.1 }
  };
  if (typeof system === 'string' && system.trim()) body.systemInstruction = { parts: [{ text: system.slice(0, 4000) }] };
  var lastError = 'no_models_tried';
  for (var idx = 0; idx < modelChain.length; idx++) {
    var modelName = modelChain[idx];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(geminiKey);
    try {
      var visionGate = await nspGeminiWaitForRateLimit();
      if (!visionGate.ok) {
        return { ok: false, error: NSP_GEMINI_LIMIT_PER_MIN + ' requests already sent in the last minute, ' + visionGate.retryAfter + 's to a free slot', rateLimited: true, retryAfter: visionGate.retryAfter };
      }
      var resp = await nspFetchTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 45000);
      var data = await resp.json();
      if (data && data.error) {
        lastError = data.error.message || 'gemini_error';
        var c = data.error.code || 0;
        if (c === 404 || c === 400 || c === 403 || c === 429) continue;
        return { ok: false, error: lastError };
      }
      var text = '';
      if (data && Array.isArray(data.candidates) && data.candidates[0] && data.candidates[0].content && Array.isArray(data.candidates[0].content.parts)) {
        data.candidates[0].content.parts.forEach(function (p) { if (p && typeof p.text === 'string') text += p.text; });
      }
      if (!text) { lastError = 'empty_response'; continue; }
      chrome.storage.local.set({ nsp_gemini_working_model: modelName });
      return { ok: true, text: text, modelUsed: modelName };
    } catch (e) {
      lastError = String(e && e.message || e);
      continue;
    }
  }
  return { ok: false, error: lastError };
}



chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'nsp-trend-check') {
    console.log('[NSP SW] trend-check starting,', new Date().toLocaleTimeString());
    runTrendCheck();
  }
});

// ── TREND ALERTS — Check watched channels for new outlier videos ─────────────
chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.get('nsp-trend-check', function(a) {
    if (!a) chrome.alarms.create('nsp-trend-check', { periodInMinutes: 360 }); // 6h
  });
});

async function runTrendCheck() {
  var data = await new Promise(function(r) {
    chrome.storage.local.get('nsp_watching', function(res) { r(res.nsp_watching || {}); });
  });
  var keys = Object.keys(data);
  if (!keys.length) { console.log('[NSP SW] no watched channels'); return; }
  console.log('[NSP SW] checking', keys.length, 'watched channels');

  var alerts = [];
  for (var i = 0; i < keys.length; i++) {
    var w = data[keys[i]];
    if (!w || !w.channelUrl) continue;
    try {
      var res = await checkChannelForNewOutliers(w);
      if (res && res.newOutliers && res.newOutliers.length) {
        alerts.push({ channel: w, outliers: res.newOutliers });
      }
      // Every video seen on this pass is recorded, or an upload that was not an outlier today alerts weeks later as if it were new.
      if (res && res.seenVideoIds && res.seenVideoIds.length) {
        w.knownVideoIds = uniqueSlice(res.seenVideoIds.concat(w.knownVideoIds || []), 200);
      }
      w.lastChecked = Date.now();
      // Throttle to avoid YouTube rate-limit
      await new Promise(function(r) { setTimeout(r, 2000); });
    } catch(e) {
      console.warn('[NSP SW] check failed for', w.channelUrl, e.message);
    }
  }

  // Persist updated watching data
  await new Promise(function(r) { chrome.storage.local.set({ nsp_watching: data }, r); });

  // Fire notifications
  if (alerts.length) {
    for (var j = 0; j < alerts.length; j++) {
      var a = alerts[j];
      var top = a.outliers[0];
      try {
        chrome.notifications.create('nsp-trend-' + Date.now() + '-' + j, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: (a.channel.name || 'Channel') + ' published an outlier',
          message: (top.title || 'video').slice(0, 80) + ' · ' + fmtViews(top.views) + ' views in ' + fmtHours(top.hoursOld),
          priority: 2
        });
      } catch(e) { console.warn('[NSP SW] notif fail:', e); }
    }
  }
  console.log('[NSP SW] trend-check done, alerts:', alerts.length);
}

var NSP_OUTLIER_MAX_AGE_HOURS = 168;

function nspExtractYtInitialData(html) {
  var s = String(html || '');
  var m = s.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) m = s.match(/window\["ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch(e) { return null; }
}

async function checkChannelForNewOutliers(w) {
  var url = w.channelUrl.replace(/\/+$/, '').split('?')[0] + '/videos';
  var resp = await nspFetchTimeout(url, { method: 'GET', credentials: 'omit' }, 20000);
  var html = await resp.text();
  var data = nspExtractYtInitialData(html);
  if (!data) return null;

  var videos = (extractVideosFromInnertube(data) || []).map(function(v) {
    return {
      vidId: v.videoId,
      title: v.title,
      views: parseViews(v.viewsText),
      hoursOld: parseRelHours(v.publishedText)
    };
  });
  if (!videos.length) return null;
  var seenVideoIds = videos.map(function(v) { return v.vidId; });

  // First pass only baselines, or every upload already on the channel would alert at once.
  var known = w.knownVideoIds || [];
  if (!known.length) return { newOutliers: [], seenVideoIds: seenVideoIds };

  var threshold_vph = 100;
  var newOutliers = videos.filter(function(v) {
    if (known.indexOf(v.vidId) !== -1) return false;
    if (!v.views || !v.hoursOld || v.hoursOld < 0.5) return false;
    if (v.hoursOld > NSP_OUTLIER_MAX_AGE_HOURS) return false;
    var vph = v.views / v.hoursOld;
    if (vph >= threshold_vph) return true;
    if (v.hoursOld < 72 && v.views >= 50000) return true;
    return false;
  });

  return { newOutliers: newOutliers.slice(0, 5), seenVideoIds: seenVideoIds };
}

// Magnitude words as YouTube writes them per market. Matched tokens, not UI copy.
var NSP_VIEW_MAGNITUDES = {
  k: 1e3, tsd: 1e3, mil: 1e3, mila: 1e3, tys: 1e3, bin: 1e3, rb: 1e3, ribu: 1e3, thousand: 1e3,
  m: 1e6, mn: 1e6, mi: 1e6, mio: 1e6, mln: 1e6, jt: 1e6, juta: 1e6, milyon: 1e6,
  million: 1e6, millions: 1e6, millionen: 1e6, millon: 1e6, millones: 1e6,
  milhao: 1e6, milhoes: 1e6, milione: 1e6, milioni: 1e6,
  b: 1e9, bn: 1e9, md: 1e9, mld: 1e9, mrd: 1e9, milyar: 1e9, miliar: 1e9,
  billion: 1e9, billions: 1e9, milliarde: 1e9, milliarden: 1e9,
  bilhao: 1e9, bilhoes: 1e9, miliardo: 1e9, miliardi: 1e9
};

// Languages that write one point two as 1,2. Data, not UI copy.
var NSP_COMMA_DECIMAL_LANGS = ['af','az','be','bg','bs','ca','cs','da','de','el','es','et','eu','fi','fr','gl','hr','hu','hy','id','is','it','ka','kk','lt','lv','mk','nb','nl','no','pl','pt','ro','ru','sk','sl','sq','sr','sv','tr','uk','vi'];

function nspDecimalSeparator(hl) {
  var lang = String(hl || '').toLowerCase().split(/[-_]/)[0];
  return NSP_COMMA_DECIMAL_LANGS.indexOf(lang) !== -1 ? ',' : '.';
}

function nspStripAccents(s) {
  try { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return String(s); }
}

function nspViewMagnitude(tail) {
  var words = nspStripAccents(String(tail || '').toLowerCase()).match(/[a-z]+/g) || [];
  var first = words[0] || '';
  var second = words[1] || '';
  // Spanish and Portuguese build a billion out of two words: mil millones, mil milhoes, mil M.
  if ((first === 'mil' || first === 'mila') && NSP_VIEW_MAGNITUDES[second] === 1e6) return 1e9;
  return NSP_VIEW_MAGNITUDES[first] || 1;
}

function nspParseGroupedNumber(token, hl, hasMagnitude) {
  var s = String(token).replace(/[\s\u00a0\u202f']/g, '');
  var dots = (s.match(/\./g) || []).length;
  var commas = (s.match(/,/g) || []).length;
  var decSep = '';
  if (dots && commas) {
    decSep = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
  } else if ((dots + commas) === 1) {
    var sep = dots ? '.' : ',';
    var digitsAfter = s.length - 1 - s.lastIndexOf(sep);
    // Three digits behind one separator is a thousands group; YouTube never prints more than one decimal digit.
    if (digitsAfter === 3) decSep = (hasMagnitude && sep === nspDecimalSeparator(hl)) ? sep : '';
    else decSep = sep;
  }
  var cleaned;
  if (decSep) {
    var at = s.lastIndexOf(decSep);
    cleaned = s.slice(0, at).replace(/[.,]/g, '') + '.' + s.slice(at + 1).replace(/[.,]/g, '');
  } else {
    cleaned = s.replace(/[.,]/g, '');
  }
  var n = parseFloat(cleaned);
  return isFinite(n) ? n : NaN;
}

function parseViews(t, hl) {
  if (!t) return 0;
  var raw = String(t);
  var numMatch = raw.match(/\d[\d.,\u00a0\u202f' ]*\d|\d/);
  if (!numMatch) return 0;
  var tail = raw.slice(numMatch.index + numMatch[0].length);
  var mult = nspViewMagnitude(tail);
  var n = nspParseGroupedNumber(numMatch[0], hl, mult > 1);
  if (!isFinite(n)) return 0;
  return Math.round(n * mult);
}

function parseRelHours(text) {
  if (!text) return null;
  // Covers ES, EN, DE, FR, PT and IT: with only ES and EN, German dates parsed as null and the age filter dropped every result.
  var t = String(text).toLowerCase()
    .replace(/^(hace|premiered|streamed|vor|il y a|há|fa)\s*/i, '')
    .trim();
  var m = t.match(/(\d+)\s*(second|segundo|sekund|seconde|minut|min|hora|hour|hr|stunde|heure|ora|d[ií]a|day|tag|jour|giorno|dia|semana|week|woche|semaine|settiman|month|mes|monat|mois|mese|year|a[ñn]o|jahr|an[s]?|anno|ann)/);
  if (!m) {
    if (/\b(hoy|today|heute|aujourd|hoje|oggi)\b/.test(t)) return 6;
    if (/\b(ayer|yesterday|gestern|hier|ontem|ieri)\b/.test(t)) return 24;
    return null;
  }
  var n = parseInt(m[1], 10), u = m[2];
  if (/second|segundo|sekund|seconde/.test(u)) return n / 3600;
  if (/minut|^min/.test(u)) return n / 60;
  if (/hour|hora|hr|stunde|heure|ora/.test(u)) return n;
  if (/day|d[ií]a|tag|jour|giorno|^dia/.test(u)) return n * 24;
  if (/week|semana|woche|semaine|settiman/.test(u)) return n * 168;
  if (/month|mes|monat|mois|mese/.test(u)) return n * 720;
  if (/year|a[ñn]o|jahr|an|anno/.test(u)) return n * 8760;
  return null;
}

function fmtViews(v) {
  if (!v) return '0';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1000) return Math.round(v / 1000) + 'K';
  return String(v);
}
function fmtHours(h) {
  if (!h) return '?';
  if (h < 1) return Math.round(h * 60) + 'min';
  if (h < 24) return Math.round(h) + 'h';
  return Math.round(h / 24) + 'd';
}


// ── Storage helpers ─────────────────────────────────────────────────────────

var NSP_PAGE_FETCH_HOSTS = ['www.youtube.com', 'm.youtube.com', 'youtube.com', 'studio.youtube.com', 'i.ytimg.com', 'img.youtube.com'];

function nspFetchUrlAllowed(rawUrl, sender) {
  var host = '';
  try { host = new URL(rawUrl).hostname.toLowerCase(); } catch (e) { return false; }
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return false;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/\.local$/.test(host) || /\.internal$/.test(host)) return false;
  if (!(sender && sender.tab)) return true;
  return NSP_PAGE_FETCH_HOSTS.indexOf(host) !== -1;
}

var _nspStorageQueue = Promise.resolve();

function nspStorageUpdate(key, mutate) {
  _nspStorageQueue = _nspStorageQueue.then(function() {
    return new Promise(function(resolve) {
      chrome.storage.local.get(key, function(r) {
        var next = mutate((r && r[key]));
        if (typeof next === 'undefined') { resolve(false); return; }
        var payload = {};
        payload[key] = next;
        chrome.storage.local.set(payload, function() { resolve(true); });
      });
    });
  }).catch(function() { return false; });
  return _nspStorageQueue;
}

chrome.runtime.onInstalled.addListener(function () { nspAutoEnableLocalProvider(); });
try { chrome.runtime.onStartup.addListener(function () { nspAutoEnableLocalProvider(); }); } catch (eLp) {}
nspAutoEnableLocalProvider();

function storageGet(keys) {
  return new Promise(function(resolve) {
    try { chrome.storage.local.get(keys, function(r) { resolve(r || {}); }); }
    catch(e) { resolve({}); }
  });
}

function storageSet(payload) {
  return new Promise(function(resolve) {
    try { chrome.storage.local.set(payload, function() { resolve(true); }); }
    catch(e) { resolve(false); }
  });
}

function nspParsePrefCookie(value) {
  var pairs = {};
  String(value || '').split('&').forEach(function(part) {
    if (!part) return;
    var eq = part.indexOf('=');
    var k = eq > 0 ? part.slice(0, eq) : part;
    var v = eq > 0 ? part.slice(eq + 1) : '';
    if (k) pairs[k] = v;
  });
  return pairs;
}

function nspWritePrefCookie(existing, pairs, done) {
  var value = Object.keys(pairs).map(function(k) { return k + '=' + pairs[k]; }).join('&');
  var details = {
    url: 'https://www.youtube.com/',
    name: 'PREF',
    value: value,
    path: (existing && existing.path) || '/',
    secure: existing ? !!existing.secure : true
  };
  if (!existing || !existing.hostOnly) details.domain = (existing && existing.domain) || '.youtube.com';
  if (existing && existing.sameSite && existing.sameSite !== 'unspecified') details.sameSite = existing.sameSite;
  else if (!existing) details.sameSite = 'no_restriction';
  // A session cookie stays a session cookie: adding an expiry would outlive the browsing session the user chose.
  if (!existing || !existing.session) {
    details.expirationDate = (existing && existing.expirationDate) || (Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180);
  }
  chrome.cookies.set(details, function(cookie) {
    var err = chrome.runtime && chrome.runtime.lastError;
    done(cookie || null, err ? err.message : '');
  });
}

function uniqueSlice(list, max) {
  var seen = {};
  var out = [];
  (list || []).forEach(function(item) {
    if (typeof item !== 'string') return;
    var v = item.trim();
    if (!v || seen[v]) return;
    seen[v] = true;
    out.push(v);
  });
  return out.slice(0, max || 2500);
}

// ── Message router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (!msg || !msg.type) return false;

  // — Health check
  if (msg.type === 'ASHLYV_PING') {
    sendResponse({ pong: true, ts: Date.now() });
    return false;
  }

  // Channel snippet and statistics in batches of up to 50 ids. Run here because the MAIN world content script hits CORS.
  if (msg.type === 'NSP_FETCH_YT_CHANNELS') {
    var ids = (msg.channelIds || []).filter(function(id) {
      return typeof id === 'string' && /^[A-Za-z0-9_\-]{20,80}$/.test(id);
    }).slice(0, 50);
    if (!ids.length) { sendResponse({ ok: false, error: 'no ids' }); return false; }
    var apiKey = (msg.apiKey || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 50);
    if (!apiKey) { sendResponse({ ok: false, error: 'no key' }); return false; }
    var url = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id='
      + ids.join(',') + '&key=' + apiKey;
    // With a timeout: without it a hung YouTube Data API call left the caller waiting and sendResponse never arrived.
    nspFetchTimeout(url, { method: 'GET' }, 15000)
      .then(function(r) {
        var status = r.status;
        return r.json().then(function(data) { return { status: status, data: data }; });
      })
      .then(function(res) {
        if (res.data && res.data.error) {
          sendResponse({ ok: false, error: res.data.error.message || 'api-error', code: res.data.error.code, status: res.status });
          return;
        }
        sendResponse({ ok: true, items: (res.data && res.data.items) || [], status: res.status });
      })
      .catch(function(err) {
        sendResponse({ ok: false, error: (err && err.message) || 'fetch-failed' });
      });
    return true; // keep channel open for async response
  }

  // — Save channel (manual + scout)
  if (msg.type === 'NSP_SAVE_CHANNEL') {
    var entry = msg.data;
    if (!entry || !entry.channelUrl) { sendResponse({ ok: false }); return false; }
    nspStorageUpdate('nsp_all_channels', function(stored) {
      var all = stored || [];
      var idx = -1;
      for (var i = 0; i < all.length; i++) {
        if (all[i].channelUrl === entry.channelUrl) { idx = i; break; }
      }
      if (idx >= 0) {
        var prev = all[idx];
        if (!prev.avatarUrl && entry.avatarUrl) prev.avatarUrl = entry.avatarUrl;
        if (entry.source === 'manual') prev.source = 'manual';
        if ((entry.subs || 0) > (prev.subs || 0)) prev.subs = entry.subs;
        if ((entry.revMonth || 0) > (prev.revMonth || 0)) prev.revMonth = entry.revMonth;
        if ((entry.avgOS || 0) > (prev.avgOS || 0)) prev.avgOS = entry.avgOS;
        if ((entry.topVPH || 0) > (prev.topVPH || 0)) { prev.topVPH = entry.topVPH; prev.topTier = entry.topTier; }
        if (entry.niche && entry.niche !== '🔮 General') prev.niche = entry.niche;
        if (entry.channelAgeDays != null) prev.channelAgeDays = entry.channelAgeDays;
        if ((entry.videosSeen || 0) > (prev.videosSeen || 0)) prev.videosSeen = entry.videosSeen;
        if ((entry.outliers || 0) > (prev.outliers || 0)) prev.outliers = entry.outliers;
        if ((entry.avgVPH || 0) > (prev.avgVPH || 0)) prev.avgVPH = entry.avgVPH;
        if (entry.joinedDate) prev.joinedDate = entry.joinedDate;
        if ((entry.totalViews || 0) > (prev.totalViews || 0)) prev.totalViews = entry.totalViews;
        if ((entry.videoCount || 0) > (prev.videoCount || 0)) prev.videoCount = entry.videoCount;
        prev.savedAt = Date.now();
      } else {
        entry.savedAt = Date.now();
        all.unshift(entry);
      }
      if (all.length > 500) all.length = 500;
      entry._total = all.length;
      return all;
    }).then(function(saved) {
      sendResponse({ ok: !!saved, total: entry._total || 0 });
    });
    return true;
  }

  // — Save ASHLYV niche
  if (msg.type === 'ASHLYV_SAVE_NICHO') {
    var nicho = msg.data;
    if (!nicho) { sendResponse({ ok: false }); return false; }
    chrome.storage.local.get(['ashlyv_nichos', 'ashlyv_nichos_backup'], function(res) {
      var saved = Array.isArray(res.ashlyv_nichos) ? res.ashlyv_nichos : [];
      var isDupe = saved.some(function(s) {
        return s.vidId && nicho.vidId && s.vidId === nicho.vidId;
      });
      if (!isDupe) saved.unshift(nicho);
      if (saved.length > 200) saved.length = 200;
      chrome.storage.local.set({ ashlyv_nichos: saved, ashlyv_nichos_backup: saved }, function() {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  // Open dashboard tab. URL restricted to extension-internal or youtube.com, same rule as NSP_OPEN_TAB.
  if (msg.type === 'ASHLYV_OPEN') {
    var url = String(msg.url || '') || chrome.runtime.getURL('ashlyv/ashlyv.html');
    var extPrefixOpen = chrome.runtime.getURL('');
    if (url.indexOf(extPrefixOpen) === 0 || /^https:\/\/(www\.)?youtube\.com\//i.test(url)) {
      chrome.tabs.create({ url: url });
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: 'url not allowed' });
    }
    return false;
  }

  // — Open arbitrary tab (used by Country Scanner from content script)
  if (msg.type === 'NSP_OPEN_TAB') {
    try {
      var openUrl = String(msg.url || '');
      // Only allow extension-internal URLs for safety
      var extPrefix = chrome.runtime.getURL('');
      if (openUrl.indexOf(extPrefix) === 0 || openUrl.indexOf('chrome-extension://') === 0) {
        chrome.tabs.create({ url: openUrl });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'url not allowed' });
      }
    } catch(e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    return false;
  }

  // — UI scan preferences
  if (msg.type === 'NSP_UI_PREFS_GET') {
    chrome.storage.local.get('nsp_ui_prefs', function(r) {
      var prefs = r.nsp_ui_prefs || { language: 'auto', market: 'global', depth: 'balanced' };
      chrome.storage.sync.get('nsp_settings', function(sy) {
        sendResponse({ ok: true, prefs: prefs, settings: (sy && sy.nsp_settings) || null });
      });
    });
    return true;
  }
  if (msg.type === 'NSP_UI_PREFS_SET') {
    chrome.storage.local.set({ nsp_ui_prefs: msg.prefs || {} }, function() {
      sendResponse({ ok: true, prefs: msg.prefs });
    });
    return true;
  }

  // — Merge gl/hl into the YouTube PREF cookie for the user's session.
  //   Pages loaded after this call pick up the new locale; pages already open need a reload.
  if (msg.type === 'NSP_SET_YT_COOKIE') {
    var gl = String(msg.gl || '').trim();
    var hl = String(msg.hl || '').trim();
    if (!chrome.cookies) {
      sendResponse({ ok: false, error: 'chrome.cookies API not available' });
      return false;
    }
    // PREF also holds theme, playback and autoplay settings, so the current value is read and only hl and gl are touched.
    chrome.cookies.get({ url: 'https://www.youtube.com/', name: 'PREF' }, function(existing) {
      var pairs = nspParsePrefCookie(existing && existing.value);
      if (!gl && !hl) {
        delete pairs.hl;
        delete pairs.gl;
        if (!Object.keys(pairs).length) {
          chrome.cookies.remove({ url: 'https://www.youtube.com/', name: 'PREF' }, function(removed) {
            var errRm = chrome.runtime && chrome.runtime.lastError;
            if (errRm) sendResponse({ ok: false, error: errRm.message });
            else sendResponse({ ok: true, cleared: !!removed });
          });
          return;
        }
      } else {
        if (hl) pairs.hl = encodeURIComponent(hl); else delete pairs.hl;
        if (gl) pairs.gl = encodeURIComponent(gl); else delete pairs.gl;
      }
      nspWritePrefCookie(existing, pairs, function(cookie, errSet) {
        if (errSet) { sendResponse({ ok: false, error: errSet }); return; }
        sendResponse({ ok: true, cookie: cookie ? { value: cookie.value, gl: gl, hl: hl } : null });
      });
    });
    return true;
  }

  // ── NSP_FETCH_COUNTRY_FACELESS_FEED ───────────────────────────────────────
  // Fetches REAL country-specific YouTube content via the InnerTube private API
  // with credentials:'omit' (no user cookies → not personalized by Google account).
  // This is the only way to see "Germany's actual feed" while logged-in elsewhere.
  // Caches 15min in chrome.storage to respect rate limits.
  if (msg.type === 'NSP_FETCH_COUNTRY_FACELESS_FEED') {
    var gl = String(msg.gl || 'US').toUpperCase();
    var hl = String(msg.hl || 'en').toLowerCase();
    var queries = Array.isArray(msg.queries) ? msg.queries.slice(0, 18) : [];
    var force = !!msg.force; // bypass cache
    var maxAgeHours = Number(msg.maxAgeHours) || 0;
    var cacheKey = nspCountryFeedCacheKey(gl, hl, maxAgeHours, queries);
    var TTL = 15 * 60 * 1000; // 15 min

    function returnCached(cached, source) {
      sendResponse({ ok: true, videos: cached.videos || [], cached: true, ts: cached.ts, source: source });
    }
    function returnFresh(videos) {
      // An empty answer is not cached: caching it would hand the same empty list back for 15 minutes without asking YouTube again.
      if (videos && videos.length) {
        try {
          var payload = { videos: videos, ts: Date.now(), gl: gl, hl: hl, queries: queries };
          var setObj = {}; setObj[cacheKey] = payload;
          chrome.storage.local.set(setObj, function() {
            var errSet = chrome.runtime && chrome.runtime.lastError;
            if (errSet) console.warn('[NSP SW] country feed cache not written:', errSet.message);
          });
        } catch(e) {}
      }
      sendResponse({ ok: true, videos: videos, cached: false, ts: Date.now() });
    }

    chrome.storage.local.get(cacheKey, function(r) {
      var cached = r && r[cacheKey];
      var usable = !!(cached && Array.isArray(cached.videos) && cached.videos.length);
      if (!force && usable && (Date.now() - cached.ts) < TTL) {
        returnCached(cached, 'cache-fresh');
        return;
      }
      // Fetch fresh
      fetchCountryFacelessFeed(gl, hl, queries, maxAgeHours)
        .then(returnFresh)
        .catch(function(err) {
          console.warn('[NSP SW] InnerTube fetch error:', err && err.message);
          if (usable) returnCached(cached, 'cache-stale-fallback');
          else sendResponse({ ok: false, error: String(err && err.message || err), videos: [] });
        });
    });
    return true; // async
  }

  // Clearing must build the key the same way the writer does, or it removes nothing and still reports success.
  if (msg.type === 'NSP_COUNTRY_FEED_CACHE_CLEAR') {
    chrome.storage.local.get(null, function(all) {
      var keys = Object.keys(all || {}).filter(function(k) { return k.indexOf(NSP_COUNTRY_FEED_PREFIX) === 0; });
      if (!keys.length) { sendResponse({ ok: true, removed: 0 }); return; }
      chrome.storage.local.remove(keys, function() {
        var err = chrome.runtime && chrome.runtime.lastError;
        if (err) sendResponse({ ok: false, error: err.message, removed: 0 });
        else sendResponse({ ok: true, removed: keys.length });
      });
    });
    return true;
  }

  // — Scan memory (cross-session dedup)
  if (msg.type === 'NSP_SCAN_CONTEXT_GET') {
    chrome.storage.local.get(['nsp_scan_memory', 'nsp_all_channels'], function(r) {
      var mem = r.nsp_scan_memory || {};
      // Merge optional legacy data passed by the client one-shot
      if (msg.legacyData && typeof msg.legacyData === 'object') {
        ['seenTitles', 'seenVideoIds', 'seenChannelUrls', 'seenChannelKeys', 'seenTopicKeys', 'seenNicheLabels'].forEach(function(k) {
          mem[k] = uniqueSlice((mem[k] || []).concat(msg.legacyData[k] || []), 2500);
        });
        mem.legacyMigrated = true;
      }
      var dashboardChannels = (r.nsp_all_channels || []).filter(function(c) { return c.blocked; });
      var answer = {
        ok: true,
        memory: mem,
        blockedDashboardChannelUrls: dashboardChannels.map(function(c) { return c.channelUrl; }).filter(Boolean),
        blockedDashboardChannelKeys: dashboardChannels.map(function(c) { return c.channelKey; }).filter(Boolean)
      };
      if (mem.legacyMigrated) {
        chrome.storage.local.set({ nsp_scan_memory: mem }, function() { sendResponse(answer); });
        return;
      }
      sendResponse(answer);
    });
    return true;
  }
  if (msg.type === 'NSP_SCAN_MARK_SEEN') {
    chrome.storage.local.get('nsp_scan_memory', function(r) {
      var mem = r.nsp_scan_memory || {};
      (msg.entries || []).forEach(function(e) {
        if (e.title) mem.seenTitles = uniqueSlice([(e.title || '').toLowerCase().slice(0, 120)].concat(mem.seenTitles || []), 2500);
        if (e.videoId) mem.seenVideoIds = uniqueSlice([e.videoId].concat(mem.seenVideoIds || []), 2500);
        if (e.channelUrl) mem.seenChannelUrls = uniqueSlice([e.channelUrl].concat(mem.seenChannelUrls || []), 2500);
        if (e.channelKey) mem.seenChannelKeys = uniqueSlice([e.channelKey].concat(mem.seenChannelKeys || []), 2500);
        if (e.topicKey) mem.seenTopicKeys = uniqueSlice([e.topicKey].concat(mem.seenTopicKeys || []), 2500);
        if (e.nicheLabel) mem.seenNicheLabels = uniqueSlice([e.nicheLabel].concat(mem.seenNicheLabels || []), 2500);
      });
      chrome.storage.local.set({ nsp_scan_memory: mem }, function() {
        sendResponse({ ok: true, memory: mem });
      });
    });
    return true;
  }
  if (msg.type === 'NSP_SCAN_MEMORY_CLEAR') {
    chrome.storage.local.set({ nsp_scan_memory: {} }, function() {
      sendResponse({ ok: true, memory: {} });
    });
    return true;
  }

  // — Global state for ashlyv.html dashboard
  if (msg.type === 'ASHLYV_GLOBAL_STATE_GET') {
    chrome.storage.local.get([
      'ashlyv_global_state', 'ashlyv_alert_history', 'ashlyv_opportunity_history',
      'ashlyv_nichos', 'ashlyv_nichos_backup', 'nsp_all_channels'
    ], function(r) {
      sendResponse({
        ok: true,
        state: r.ashlyv_global_state || {
          selectedLanguage: 'auto', recentLanguages: [], pinnedLanguages: ['en','es','fr'],
          autoMix: true, filters: [], watchlist: []
        },
        alertHistory: r.ashlyv_alert_history || [],
        opportunityHistory: r.ashlyv_opportunity_history || [],
        savedNichos: Array.isArray(r.ashlyv_nichos) && r.ashlyv_nichos.length
          ? r.ashlyv_nichos
          : (Array.isArray(r.ashlyv_nichos_backup) ? r.ashlyv_nichos_backup : []),
        savedChannels: r.nsp_all_channels || []
      });
    });
    return true;
  }
  if (msg.type === 'ASHLYV_GLOBAL_STATE_SET') {
    chrome.storage.local.set({ ashlyv_global_state: msg.state || {} }, function() {
      sendResponse({ ok: true });
    });
    return true;
  }
  // Merges a partial dashboard state. Without this handler the patches were dropped and nothing survived a reload.
  if (msg.type === 'ASHLYV_GLOBAL_STATE_PATCH') {
    chrome.storage.local.get('ashlyv_global_state', function(r) {
      var merged = Object.assign({}, r.ashlyv_global_state || {}, msg.patch || {});
      chrome.storage.local.set({ ashlyv_global_state: merged }, function() {
        sendResponse({ ok: true, state: merged });
      });
    });
    return true;
  }

  // — Opportunity history (push latest top-N from each scan)
  if (msg.type === 'ASHLYV_OPPORTUNITY_HISTORY_PUSH') {
    chrome.storage.local.get('ashlyv_opportunity_history', function(r) {
      var hist = Array.isArray(r.ashlyv_opportunity_history) ? r.ashlyv_opportunity_history : [];
      var entries = Array.isArray(msg.entries) ? msg.entries : [];
      hist = entries.concat(hist);
      // Dedup by languageCode|nicheId
      var seen = {};
      hist = hist.filter(function(item) {
        var k = String(item.languageCode || '') + '|' + String(item.nicheId || '');
        if (!k || seen[k]) return false;
        seen[k] = true;
        return true;
      }).slice(0, 80);
      chrome.storage.local.set({ ashlyv_opportunity_history: hist }, function() {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  // — Alerts
  if (msg.type === 'ASHLYV_ALERT_PUSH') {
    chrome.storage.local.get(['ashlyv_alert_history', 'ashlyv_alerts_unread'], function(r) {
      var hist = Array.isArray(r.ashlyv_alert_history) ? r.ashlyv_alert_history : [];
      var alert = msg.alert || {};
      alert.timestamp = alert.timestamp || Date.now();
      alert.signature = String(alert.signature || (alert.nicheTitle || '') + '|' + Math.floor(alert.timestamp / 60000));
      var isDupe = hist.some(function(h) { return h.signature === alert.signature; });
      if (isDupe) { sendResponse({ ok: true, show: false }); return; }
      hist.unshift(alert);
      hist = hist.slice(0, 50);
      var unread = (Number(r.ashlyv_alerts_unread) || 0) + 1;
      chrome.storage.local.set({ ashlyv_alert_history: hist, ashlyv_alerts_unread: unread }, function() {
        sendResponse({ ok: true, show: true, alert: alert });
      });
    });
    return true;
  }
  if (msg.type === 'ASHLYV_ALERT_DISMISS') {
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'ASHLYV_ALERTS_READ') {
    chrome.storage.local.set({ ashlyv_alerts_unread: 0 }, function() {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'ASHLYV_VISION_JUDGE') {
    chrome.storage.local.get(['nsp_gemini_api_key', 'nsp_gemini_working_model', 'nsp_vision_allowed'], async function (r) {
      try {
        // Reading thumbnails costs Gemini quota, so the stored opt in is checked here too and not only in the page that asks.
        if (!(r && r.nsp_vision_allowed === true)) { sendResponse({ ok: false, error: 'vision_not_allowed' }); return; }
        var geminiKey = r && typeof r.nsp_gemini_api_key === 'string' ? r.nsp_gemini_api_key.trim() : '';
        if (!geminiKey || !/^AIza[a-zA-Z0-9\-_]{30,50}$/.test(geminiKey)) { sendResponse({ ok: false, error: 'missing_or_invalid_gemini_key' }); return; }
        var cachedModel = r && typeof r.nsp_gemini_working_model === 'string' ? r.nsp_gemini_working_model : '';
        var payload = msg.payload || {};
        var urls = Array.isArray(payload.thumbs) ? payload.thumbs.slice(0, 4) : [];
        if (!urls.length && payload.thumb) urls = [payload.thumb];
        urls = urls.filter(function (u) { return typeof u === 'string' && /^https:\/\//.test(u); });
        if (!urls.length) { sendResponse({ ok: false, error: 'no_thumbnail' }); return; }
        var title = String(payload.title || '').slice(0, 300);
        var channel = String(payload.channel || '').slice(0, 160);
        var images = [];
        for (var i = 0; i < urls.length; i++) {
          try { images.push(await nspFetchImageAsBase64(urls[i])); } catch (eImg) {}
        }
        if (!images.length) { sendResponse({ ok: false, error: 'thumb_fetch_failed' }); return; }
        var system = 'You classify YouTube channels as faceless or not. FACELESS means the channel does not depend on a real person on camera: voice over with images, stock or AI footage, gameplay, compilations, text, illustrations or b-roll. NOT FACELESS: a recurring host on camera, a vlogger, a news outlet (reporters, TV logos, real events), reaction videos, or a music artist. Answer with valid JSON only, no extra text.';
        var prompt = 'Look at the thumbnail or thumbnails from this YouTube channel and decide whether it is faceless.\nVideo title: "' + title + '"\nChannel: "' + channel + '"\n\nReturn EXACTLY this JSON: {"faceless": true|false, "confidence": 0-100, "type": "AI"|"compilation"|"narration"|"gameplay"|"news"|"vlog"|"person"|"music"|"other", "reason": "max 12 words"}';
        var res = await nspCallGeminiVision(geminiKey, cachedModel, images, prompt, system);
        if (!res.ok) { sendResponse({ ok: false, error: res.error || 'vision_failed' }); return; }
        var verdict = null;
        try { var mm = res.text.match(/\{[\s\S]*\}/); if (mm) verdict = JSON.parse(mm[0]); } catch (eP) {}
        if (!verdict || typeof verdict.faceless !== 'boolean') { sendResponse({ ok: false, error: 'parse_failed', raw: String(res.text || '').slice(0, 200) }); return; }
        sendResponse({ ok: true, verdict: verdict, modelUsed: res.modelUsed });
      } catch (eV) {
        try { sendResponse({ ok: false, error: 'vision_exception', detail: String(eV && eV.message || eV) }); } catch (e2) {}
      }
    });
    return true;
  }

  // Provider cascade: Groq first, then local Ollama, then Gemini.
  if (msg.type === 'ASHLYV_CHAT_REQUEST') {
    chrome.storage.local.get([
      'nsp_gemini_api_key', 'nsp_gemini_working_model',
      'nsp_groq_api_key', 'nsp_groq_model', 'nsp_selected_model',
      'nsp_ollama_url', 'nsp_ollama_model', 'nsp_ollama_enabled',
      'nsp_provider_priority',
      'nsp_preferred_provider'
    ], async function(r) {
      // A throw inside this async callback would hang the message channel for good.
      try {
      var payload = msg.payload || {};
      var messages = Array.isArray(payload.messages) ? payload.messages : [];
      if (!messages.length) { sendResponse({ ok: false, error: 'no_messages' }); return; }

      // Read all provider configs
      var groqKey = r && typeof r.nsp_groq_api_key === 'string' ? r.nsp_groq_api_key.trim() : '';
      var groqValid = groqKey && /^gsk_[A-Za-z0-9_\-]{30,}$/.test(groqKey);
      var groqModel = (r && r.nsp_groq_model) || 'llama-3.3-70b-versatile';
      var chosen = String((r && r.nsp_selected_model) || 'auto');
      var chosenProvider = '', chosenModel = '';
      if (chosen && chosen !== 'auto') {
        // The model name comes from the catalog, not from the id: the local entry carries no model on purpose and the id half reads 'local'.
        var catalogEntry = null;
        try { catalogEntry = (typeof NSP_MODELS !== 'undefined' && NSP_MODELS.byId) ? NSP_MODELS.byId(chosen) : null; } catch (eCat) {}
        if (!catalogEntry || catalogEntry.id !== chosen) catalogEntry = null;
        var cut = chosen.indexOf(':');
        chosenProvider = catalogEntry ? catalogEntry.provider : (cut > 0 ? chosen.slice(0, cut) : chosen);
        chosenModel = catalogEntry ? String(catalogEntry.model || '') : (cut > 0 ? chosen.slice(cut + 1) : '');
        if (chosenProvider === 'groq' && chosenModel) groqModel = chosenModel;
      }

      var ollamaEnabled = r && r.nsp_ollama_enabled === true;
      var ollamaUrl = (r && r.nsp_ollama_url) || 'http://localhost:11434';
      var ollamaModel = (r && r.nsp_ollama_model) || 'llama3.2:3b';

      var geminiKey = r && typeof r.nsp_gemini_api_key === 'string' ? r.nsp_gemini_api_key.trim() : '';
      var geminiValid = geminiKey && /^AIza[a-zA-Z0-9\-_]{30,50}$/.test(geminiKey);

      var cachedModel = r && typeof r.nsp_gemini_working_model === 'string' ? r.nsp_gemini_working_model : '';

      // The preferred provider sets priority, not exclusivity: on a rate limit or a failure the next configured provider takes over.
      var preferredProvider = chosenProvider || (r && r.nsp_preferred_provider) || 'auto';
      if (chosenProvider === 'gemini' && chosenModel) cachedModel = chosenModel;
      if (chosenProvider === 'ollama' && chosenModel) ollamaModel = chosenModel;
      var order = [];
      function pushProv(name) { if (order.indexOf(name) === -1) order.push(name); }
      if (preferredProvider === 'groq' || preferredProvider === 'ollama' || preferredProvider === 'gemini') {
        pushProv(preferredProvider);
      }
      pushProv('groq'); pushProv('ollama'); pushProv('gemini');
      var queue = order.filter(function(p) {
        if (p === 'groq') return !!groqValid;
        if (p === 'ollama') return !!ollamaEnabled;
        if (p === 'gemini') return !!geminiValid;
        return false;
      });

      if (!queue.length) {
        sendResponse({ ok: false, error: 'no_provider_configured', detail: 'No AI provider is configured. Add your Groq or Gemini key in Options, or enable Ollama.' });
        return;
      }

      var lastErr = '';
      var anyAttempted = false;
      var allRateLimited = true;

      for (var qi = 0; qi < queue.length; qi++) {
        var prov = queue[qi];
        try {
          if (prov === 'groq') {
            anyAttempted = true;
            console.log('[NSP SW] Provider → groq', groqModel);
            var gr = await nspCallGroqWithRetry(groqKey, groqModel, payload, messages);
            if (gr.ok) { sendResponse(Object.assign({ provider: 'groq', modelUsed: groqModel }, gr)); return; }
            lastErr = 'Groq: ' + (gr.error || 'unknown');
            if (!gr.rateLimited) allRateLimited = false;
            console.warn('[NSP SW] Groq exhausted, falling through:', lastErr);
          } else if (prov === 'ollama') {
            var alive = await nspPingOllama(ollamaUrl);
            if (!alive) {
              lastErr = 'Ollama is not responding at ' + ollamaUrl;
              allRateLimited = false;
              console.warn('[NSP SW] Ollama not reachable, falling through');
              continue;
            }
            anyAttempted = true;
            console.log('[NSP SW] Provider → ollama', ollamaModel);
            var orr = await nspCallOllama(ollamaUrl, ollamaModel, payload, messages);
            if (orr.ok) { sendResponse(Object.assign({ provider: 'ollama', modelUsed: ollamaModel }, orr)); return; }
            lastErr = 'Ollama: ' + (orr.error || 'unknown');
            allRateLimited = false;
            console.warn('[NSP SW] Ollama exhausted, falling through:', lastErr);
          } else if (prov === 'gemini') {
            anyAttempted = true;
            console.log('[NSP SW] Provider → gemini');
            var ge = await nspCallGemini(geminiKey, cachedModel, payload, messages);
            if (ge.ok) { sendResponse(Object.assign({ provider: 'gemini' }, ge)); return; }
            lastErr = 'Gemini: ' + (ge.error || 'unknown');
            if (!ge.rateLimited) allRateLimited = false;
            console.warn('[NSP SW] Gemini exhausted, falling through:', lastErr);
          }
        } catch (e) {
          lastErr = prov + ' exception: ' + (e && e.message || e);
          allRateLimited = false;
          console.warn('[NSP SW] ' + prov + ' exception:', e);
        }
      }

      if (anyAttempted && allRateLimited) {
        sendResponse({ ok: false, error: 'all_busy', detail: 'All AI providers are busy right now. Wait a few seconds and try again.', lastError: lastErr });
      } else {
        sendResponse({ ok: false, error: 'all_providers_failed', detail: lastErr || 'No provider available' });
      }
      } catch (eChat) { try { sendResponse({ ok: false, error: 'chat_exception', detail: String(eChat && eChat.message || eChat) }); } catch (e2) {} }
    });
    return true;
  }

  // — NSP AGENT tools (v3.6.0) — chrome.tabs control ───────────────────────
  if (msg.type === 'NSP_AGENT_OPEN_TAB') {
    var url = String(msg.url || '');
    if (!/^https:\/\//i.test(url)) { sendResponse({ ok: false, error: 'invalid_url' }); return false; }
    try {
      chrome.tabs.create({ url: url, active: true }, function(tab) {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, tabId: tab && tab.id });
        }
      });
    } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    return true;
  }

  // Market search over InnerTube, feeds the predictor corpus.
  if (msg.type === 'NSP_AGENT_SEARCH_MARKET') {
    var mq = String(msg.query || '').slice(0, 120);
    if (!mq) { sendResponse({ ok: false, error: 'no_query' }); return false; }
    var mHl = String(msg.hl || 'en');
    try {
      innertubeFetch('search', { query: mq }, { gl: msg.gl || 'US', hl: mHl })
        .then(function(data) {
          var vids = (extractVideosFromInnertube(data) || []).slice(0, 45);
          var parsed = vids.map(function(v) {
            var viewsNum = 0;
            try { viewsNum = parseViews(v.viewsText, mHl); } catch(e) {}
            return {
              videoId: v.videoId,
              vidId: v.videoId,
              title: v.title,
              views: viewsNum,
              viewsText: v.viewsText || '',
              channelName: v.channelName,
              channelId: v.channelId || '',
              thumbnail: v.thumbnail,
              channelUrl: v.channelUrl,
              publishedText: v.publishedText,
              lengthText: v.lengthText || '',
              source: v.source || 'innertube_search'
            };
          });
          sendResponse({ ok: true, query: mq, count: parsed.length, videos: parsed });
        })
        .catch(function(e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
    } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    return true;
  }

  if (msg.type === 'NSP_AGENT_NAVIGATE') {
    var navUrl = String(msg.url || '');
    if (!/^https:\/\//i.test(navUrl)) {
      sendResponse({ ok: false, error: 'url_must_be_https' }); return false;
    }
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs || !tabs.length) { sendResponse({ ok: false, error: 'no_active_tab' }); return; }
        chrome.tabs.update(tabs[0].id, { url: navUrl }, function() {
          if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          else sendResponse({ ok: true });
        });
      });
    } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    return true;
  }

  if (msg.type === 'NSP_AGENT_LIST_TABS') {
    try {
      chrome.tabs.query({}, function(tabs) {
        if (chrome.runtime.lastError) { sendResponse({ ok: false, error: chrome.runtime.lastError.message }); return; }
        var list = (tabs || []).slice(0, 30).map(function(t) {
          return { id: t.id, url: String(t.url || '').slice(0, 300), title: String(t.title || '').slice(0, 200), active: !!t.active };
        });
        sendResponse({ ok: true, tabs: list, count: list.length });
      });
    } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    return true;
  }

  if (msg.type === 'NSP_AGENT_SWITCH_TAB') {
    var sId = Number(msg.tabId) || 0;
    try {
      chrome.tabs.update(sId, { active: true }, function() {
        if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        else sendResponse({ ok: true });
      });
    } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    return true;
  }

  if (msg.type === 'NSP_AGENT_CLOSE_TAB') {
    var cId = Number(msg.tabId) || 0;
    try {
      chrome.tabs.remove(cId, function() {
        if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        else sendResponse({ ok: true });
      });
    } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    return true;
  }

  if (msg.type === 'NSP_AGENT_FETCH_URL') {
    var fUrl = String(msg.url || '');
    if (!/^https:\/\//i.test(fUrl)) { sendResponse({ ok: false, error: 'must_be_https' }); return false; }
    if (!nspFetchUrlAllowed(fUrl, sender)) { sendResponse({ ok: false, error: 'host_not_allowed' }); return false; }
    (async function() {
      try {
        var resp = await nspFetchTimeout(fUrl, { method: 'GET', credentials: 'omit' }, 20000);
        var text = await resp.text();
        sendResponse({ ok: true, status: resp.status, text: String(text || '').slice(0, 8000), truncated: text.length > 8000 });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  // Captions for a video, read through the InnerTube player without cookies.
  if (msg.type === 'NSP_FETCH_TRANSCRIPT') {
    var vid = String(msg.videoId || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) { sendResponse({ ok: false, error: 'bad_video_id' }); return false; }
    (async function () {
      try {
        var player = await innertubeFetch('player', { videoId: vid }, { gl: msg.gl || 'US', hl: msg.hl || 'en' });
        var tracks = [], title = '', author = '';
        try { tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks || []; } catch (e) {}
        try { title = (player.videoDetails && player.videoDetails.title) || ''; } catch (e) {}
        try { author = (player.videoDetails && player.videoDetails.author) || ''; } catch (e) {}
        if (!tracks.length) { sendResponse({ ok: false, error: 'no_captions', title: title, author: author }); return; }
        // Preference order: requested language non-asr, any non-asr, requested language asr, then the first track.
        var hl = String(msg.hl || 'en').toLowerCase().slice(0, 2);
        function score(t) { var lc = String(t.languageCode || '').toLowerCase().slice(0, 2); return (lc === hl ? 0 : 2) + (t.kind === 'asr' ? 1 : 0); }
        tracks.sort(function (a, b) { return score(a) - score(b); });
        var track = tracks[0], url = String(track.baseUrl || '');
        if (!url) { sendResponse({ ok: false, error: 'no_track_url', title: title, author: author }); return; }
        if (url.indexOf('fmt=') < 0) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'fmt=json3';
        var r = await nspFetchTimeout(url, { method: 'GET', credentials: 'omit', cache: 'no-store' }, 20000);
        var segments = [], full = '';
        if (r.ok) {
          var j = null; try { j = await r.json(); } catch (e) {}
          ((j && j.events) || []).forEach(function (ev) {
            if (!ev.segs) return;
            var txt = ev.segs.map(function (s) { return s.utf8 || ''; }).join('').replace(/\s+/g, ' ').trim();
            if (!txt) return;
            segments.push({ text: txt, start: Math.round((ev.tStartMs || 0) / 10) / 100, dur: Math.round((ev.dDurationMs || 0) / 10) / 100 });
            full += (full ? ' ' : '') + txt;
          });
        }
        if (!segments.length) { sendResponse({ ok: false, error: 'empty_transcript', title: title, author: author }); return; }
        sendResponse({ ok: true, title: title, author: author, lang: track.languageCode || '', kind: track.kind || '', segments: segments.slice(0, 4000), text: full.slice(0, 60000) });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  // Storyboard spec, used to measure cut rhythm, motion and color across the whole video.
  if (msg.type === 'NSP_FETCH_STORYBOARD') {
    var sbId = String(msg.videoId || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(sbId)) { sendResponse({ ok: false, error: 'bad_video_id' }); return false; }
    (async function () {
      try {
        var player = await innertubeFetch('player', { videoId: sbId }, { gl: msg.gl || 'US', hl: msg.hl || 'en' });
        var spec = '';
        try { spec = player.storyboards.playerStoryboardSpecRenderer.spec || ''; } catch (e) {}
        if (!spec) { sendResponse({ ok: false, error: 'no_storyboard' }); return; }
        var parts = spec.split('|'), base = parts[0];
        var levels = parts.slice(1).map(function (p) { var f = p.split('#'); return { tileW: +f[0], tileH: +f[1], total: +f[2], cols: +f[3], rows: +f[4], interval: +f[5], name: f[6], sigh: f[7] }; })
          .filter(function (L) { return L.cols > 0 && L.rows > 0 && L.total > 0 && L.tileW > 0; });
        if (!levels.length) { sendResponse({ ok: false, error: 'no_levels' }); return; }
        var idx = levels.length - 1, L = levels[idx];
        var per = L.cols * L.rows, sheets = Math.max(1, Math.ceil(L.total / per)), sprites = [];
        for (var n = 0; n < Math.min(sheets, 8); n++) {
          var u = String(base).split('$L').join(idx).split('$N').join(L.name).split('$M').join(n);
          u += (u.indexOf('?') >= 0 ? '&' : '?') + 'sigh=' + L.sigh;
          sprites.push(u);
        }
        sendResponse({ ok: true, tileW: L.tileW, tileH: L.tileH, cols: L.cols, rows: L.rows, total: L.total, interval: L.interval, sprites: sprites });
      } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    })();
    return true;
  }

  // Channel stats parsed out of /about.
  if (msg.type === 'NSP_AGENT_CHANNEL_STATS') {
    (async function() {
      try {
        var chUrl = String(msg.channelUrl || '').split('?')[0].replace(/\/$/, '');
        if (!/youtube\.com/i.test(chUrl)) { sendResponse({ ok: false, error: 'invalid_channel_url' }); return; }
        var aboutUrl = chUrl + '/about';
        var resp = await nspFetchTimeout(aboutUrl, { method: 'GET', credentials: 'omit', headers: { 'Accept-Language': 'es,en' } }, 20000);
        var html = await resp.text();
        function extractNum(re) { var m = html.match(re); return m ? m[1] : ''; }
        var subsRaw = extractNum(/"subscriberCountText":\{"(?:simpleText|accessibility)"[^}]*?"(?:simpleText"?:?\s*")?([\d.,]+ ?[KMB]?)[^"]*?(?:subscriber|suscriptor)/i)
          || extractNum(/([\d.,]+\s?[KMB]?)\s*subscribers/i)
          || extractNum(/([\d.,]+\s?[KMB]?)\s*suscriptores/i);
        var videoCountRaw = extractNum(/"videoCountText":\{"runs":\[\{"text":"([\d.,]+)"/i)
          || extractNum(/([\d.,]+)\s*videos/i);
        var joinedRaw = extractNum(/"joinedDateText":\{"runs":\[[^\]]*?"text":"([^"]+)"\}\]/i)
          || extractNum(/(?:Joined|Se unió el)\s*([^"<,]+)/i);
        var viewsRaw = extractNum(/"viewCountText":\{"simpleText":"([\d.,]+[^"]*?)"/i)
          || extractNum(/([\d.,]+)\s*views/i);
        var countryRaw = extractNum(/"country":\{"simpleText":"([^"]+)"/i)
          || extractNum(/"detailsMetadata"[^}]*?"country"[^"]*?"([A-Za-z ]+)"/i);
        var nameRaw = extractNum(/"title":"([^"]{2,80})","description"/i)
          || extractNum(/<meta property="og:title" content="([^"]+)"/i);
        var descRaw = extractNum(/<meta property="og:description" content="([^"]{0,300})"/i);
        sendResponse({
          ok: true,
          channelUrl: chUrl,
          name: nameRaw || '',
          subscribers: subsRaw || 'unknown',
          videoCount: videoCountRaw || 'unknown',
          totalViews: viewsRaw || 'unknown',
          joined: joinedRaw || 'unknown',
          country: countryRaw || 'unknown',
          description: (descRaw || '').slice(0, 300),
          note: subsRaw ? '' : 'Partial parse: YouTube changed its HTML, some fields may be missing.'
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  // Recent videos parsed out of /videos.
  if (msg.type === 'NSP_AGENT_CHANNEL_VIDEOS') {
    (async function() {
      try {
        var cvUrl = String(msg.channelUrl || '').split('?')[0].replace(/\/$/, '');
        if (!/youtube\.com/i.test(cvUrl)) { sendResponse({ ok: false, error: 'invalid_channel_url' }); return; }
        var videosUrl = cvUrl + '/videos';
        var resp = await nspFetchTimeout(videosUrl, { method: 'GET', credentials: 'omit', headers: { 'Accept-Language': 'es,en' } }, 20000);
        var html = await resp.text();
        // Read the embedded JSON: the thumbnail block sits between videoId and title, so no flat regex over the HTML can pair them.
        var initial = nspExtractYtInitialData(html);
        if (!initial) { sendResponse({ ok: false, error: 'ytinitialdata_not_found', channelUrl: cvUrl }); return; }
        var videos = (extractVideosFromInnertube(initial) || []).slice(0, 15).map(function(v) {
          return {
            videoId: v.videoId,
            title: String(v.title || '').slice(0, 200),
            views: v.viewsText || '',
            published: v.publishedText || '',
            url: 'https://www.youtube.com/watch?v=' + v.videoId
          };
        });
        if (!videos.length) { sendResponse({ ok: false, error: 'no_videos_parsed', channelUrl: cvUrl }); return; }
        sendResponse({ ok: true, channelUrl: cvUrl, count: videos.length, videos: videos });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  // — Notifications
  if (msg.type === 'ASHLYV_SHOW_NOTIFICATION') {
    try {
      if (chrome.notifications && chrome.notifications.create) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: msg.iconUrl || chrome.runtime.getURL('icons/icon128.png'),
          title: String(msg.title || 'ZERACK').slice(0, 100),
          message: String(msg.message || '').slice(0, 300),
          priority: 1
        }, function() { sendResponse({ ok: true }); });
        return true;
      }
    } catch (e) {}
    sendResponse({ ok: false });
    return false;
  }

  return false;
});

// ══════════════════════════════════════════════════════════════════════════
// ── InnerTube fetcher — REAL country-localized YouTube content ────────────
// ══════════════════════════════════════════════════════════════════════════

var NSP_INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // WEB key, public
var NSP_INNERTUBE_CLIENT_VERSION = '2.20260520.00.00'; // bump every ~6 months

function buildInnertubeContext(gl, hl) {
  return {
    client: {
      clientName: 'WEB',
      clientVersion: NSP_INNERTUBE_CLIENT_VERSION,
      hl: String(hl || 'en').toLowerCase(),
      gl: String(gl || 'US').toUpperCase(),
      utcOffsetMinutes: 0
    },
    user: { lockedSafetyMode: false },
    request: { useSsl: true }
  };
}

function innertubeFetch(endpoint, body, opts) {
  opts = opts || {};
  var url = 'https://www.youtube.com/youtubei/v1/' + endpoint + '?key=' + NSP_INNERTUBE_API_KEY + '&prettyPrint=false';
  var fullBody = Object.assign({}, body || {}, {
    context: buildInnertubeContext(opts.gl, opts.hl)
  });
  // In an MV3 service worker Origin, Referer and X-YouTube-* are forbidden headers and the request fails, so only Content-Type is sent; gl and hl travel inside context.
  return nspFetchTimeout(url, {
    method: 'POST',
    credentials: 'omit', // CRITICAL: no user cookies → no personalization
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullBody)
  }, 20000).then(function(r) {
    if (!r.ok) throw new Error('InnerTube HTTP ' + r.status);
    return r.json();
  }).catch(function(e) {
    // One stalled search out of eighteen would keep Promise.all pending and the scan would never answer.
    if (e && e.name === 'AbortError') throw new Error('InnerTube timed out after 20s');
    throw e;
  });
}

// ── Parse helper: walks any InnerTube response and extracts video data ──
function extractVideosFromInnertube(data) {
  var out = [];
  var seen = {};
  function pushFromRenderer(v, source) {
    if (!v || !v.videoId || seen[v.videoId]) return;
    seen[v.videoId] = true;
    var title = '';
    try { title = (v.title.simpleText) || (v.title.runs && v.title.runs[0] && v.title.runs[0].text) || ''; } catch(e) {}
    if (!title) return;
    var viewsTxt = '';
    try { viewsTxt = (v.viewCountText && (v.viewCountText.simpleText || (v.viewCountText.runs && v.viewCountText.runs[0] && v.viewCountText.runs[0].text))) || ''; } catch(e) {}
    if (!viewsTxt) {
      try { viewsTxt = (v.shortViewCountText && (v.shortViewCountText.simpleText || (v.shortViewCountText.runs && v.shortViewCountText.runs[0] && v.shortViewCountText.runs[0].text))) || ''; } catch(e) {}
    }
    var pubTxt = '';
    try { pubTxt = (v.publishedTimeText && (v.publishedTimeText.simpleText || (v.publishedTimeText.runs && v.publishedTimeText.runs[0] && v.publishedTimeText.runs[0].text))) || ''; } catch(e) {}
    var lenTxt = '';
    try { lenTxt = (v.lengthText && (v.lengthText.simpleText || (v.lengthText.runs && v.lengthText.runs[0] && v.lengthText.runs[0].text))) || ''; } catch(e) {}
    var channelName = '';
    try {
      var byline = (v.ownerText && v.ownerText.runs && v.ownerText.runs[0])
        || (v.shortBylineText && v.shortBylineText.runs && v.shortBylineText.runs[0])
        || (v.longBylineText && v.longBylineText.runs && v.longBylineText.runs[0]);
      channelName = (byline && byline.text) || '';
    } catch(e) {}
    var channelId = '';
    try {
      var nav = (v.ownerText && v.ownerText.runs && v.ownerText.runs[0] && v.ownerText.runs[0].navigationEndpoint)
        || (v.shortBylineText && v.shortBylineText.runs && v.shortBylineText.runs[0] && v.shortBylineText.runs[0].navigationEndpoint);
      channelId = (nav && nav.browseEndpoint && nav.browseEndpoint.browseId) || '';
    } catch(e) {}
    var thumb = '';
    try {
      var thumbs = v.thumbnail && v.thumbnail.thumbnails;
      thumb = (thumbs && thumbs.length) ? (thumbs[thumbs.length-1].url || thumbs[0].url) : '';
    } catch(e) {}
    out.push({
      videoId: v.videoId,
      title: title,
      viewsText: viewsTxt,
      publishedText: pubTxt,
      lengthText: lenTxt,
      channelName: channelName,
      channelId: channelId,
      channelUrl: channelId ? ('https://www.youtube.com/channel/' + channelId) : '',
      thumbnail: thumb,
      source: source || 'innertube'
    });
  }
  // Channel pages ship this shape instead of videoRenderer, so without it a channel reads as zero videos.
  function pushFromLockup(lockup, source) {
    if (!lockup || String(lockup.contentType || '') !== 'LOCKUP_CONTENT_TYPE_VIDEO') return;
    var videoId = String(lockup.contentId || '');
    if (!videoId || seen[videoId]) return;
    var md = (lockup.metadata && lockup.metadata.lockupMetadataViewModel) || {};
    var title = '';
    try { title = String((md.title && (md.title.content || md.title.simpleText)) || ''); } catch(e) {}
    if (!title) return;
    seen[videoId] = true;
    var viewsTxt = '';
    var pubTxt = '';
    try {
      var rows = (md.metadata && md.metadata.contentMetadataViewModel && md.metadata.contentMetadataViewModel.metadataRows) || [];
      for (var ri = 0; ri < rows.length && !pubTxt; ri++) {
        var texts = ((rows[ri] && rows[ri].metadataParts) || []).map(function(part) {
          return String((part && part.text && (part.text.content || part.text.simpleText)) || '');
        }).filter(Boolean);
        var ageIdx = -1;
        for (var ti = 0; ti < texts.length; ti++) { if (parseRelHours(texts[ti]) !== null) { ageIdx = ti; break; } }
        if (ageIdx === -1) continue;
        pubTxt = texts[ageIdx];
        // Views and age sit in the same row, so the sibling part is the view count and no other part has to be guessed at.
        for (var vi = 0; vi < texts.length; vi++) { if (vi !== ageIdx && /\d/.test(texts[vi])) { viewsTxt = texts[vi]; break; } }
      }
    } catch(e) {}
    var lenTxt = '';
    try {
      var overlays = lockup.contentImage.thumbnailViewModel.overlays || [];
      overlays.forEach(function(ov) {
        var badges = (ov && ov.thumbnailBottomOverlayViewModel && ov.thumbnailBottomOverlayViewModel.badges) || [];
        badges.forEach(function(bd) {
          var t = String((bd && bd.thumbnailBadgeViewModel && bd.thumbnailBadgeViewModel.text) || '');
          if (!lenTxt && /^\d+(:\d\d)+$/.test(t)) lenTxt = t;
        });
      });
    } catch(e) {}
    var thumb = '';
    try {
      var sources = lockup.contentImage.thumbnailViewModel.image.sources || [];
      thumb = (sources.length ? (sources[sources.length - 1].url || sources[0].url) : '') || '';
    } catch(e) {}
    var channelId = '';
    try {
      var cmd = lockup.rendererContext.commandContext;
      channelId = (cmd && cmd.browseEndpoint && cmd.browseEndpoint.browseId) || '';
    } catch(e) {}
    out.push({
      videoId: videoId,
      title: title,
      viewsText: viewsTxt,
      publishedText: pubTxt,
      lengthText: lenTxt,
      channelName: '',
      channelId: channelId,
      channelUrl: channelId ? ('https://www.youtube.com/channel/' + channelId) : '',
      thumbnail: thumb,
      source: source || 'innertube'
    });
  }
  function walk(o, depth, source) {
    if (depth > 25 || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length; i++) walk(o[i], depth + 1, source);
      return;
    }
    if (o.videoRenderer) pushFromRenderer(o.videoRenderer, source);
    if (o.gridVideoRenderer) pushFromRenderer(o.gridVideoRenderer, source);
    if (o.compactVideoRenderer) pushFromRenderer(o.compactVideoRenderer, source);
    if (o.lockupViewModel) pushFromLockup(o.lockupViewModel, source);
    if (o.richItemRenderer && o.richItemRenderer.content) {
      if (o.richItemRenderer.content.videoRenderer) pushFromRenderer(o.richItemRenderer.content.videoRenderer, source);
      if (o.richItemRenderer.content.lockupViewModel) pushFromLockup(o.richItemRenderer.content.lockupViewModel, source);
    }
    var keys = Object.keys(o);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (key === 'videoRenderer' || key === 'gridVideoRenderer' || key === 'compactVideoRenderer' || key === 'lockupViewModel' || key === 'richItemRenderer') continue;
      walk(o[key], depth + 1, source);
    }
  }
  walk(data, 0, 'innertube');
  return out;
}

// Emit progress event to any extension page (broadcast).
function nspEmitProgress(payload) {
  try {
    chrome.runtime.sendMessage(Object.assign({ type: 'NSP_FEED_PROGRESS' }, payload), function() {
      // swallow lastError (no listeners is fine)
      try { var _ = chrome.runtime.lastError; } catch(e) {}
    });
  } catch(e) {}
}

// ── Main: fetch country faceless feed via InnerTube (trending + queries) ──
// Emits live progress events via NSP_FEED_PROGRESS messages.
var NSP_RECENCY_PARAMS = [
  { maxHours: 1, params: 'EgQIARAB' },
  { maxHours: 24, params: 'EgQIAhAB' },
  { maxHours: 168, params: 'EgQIAxAB' },
  { maxHours: 720, params: 'EgQIBBAB' },
  { maxHours: 8760, params: 'EgQIBRAB' }
];

var NSP_COUNTRY_FEED_PREFIX = 'nsp_country_feed_';

function nspHashQueries(queries) {
  var norm = (Array.isArray(queries) ? queries : [])
    .map(function(q) { return String(q || '').trim().toLowerCase(); })
    .filter(Boolean)
    .sort()
    .join('|');
  if (!norm) return 'noq';
  var h = 2166136261;
  for (var i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

// The searches are part of the key: the same market scanned with a different query list is a different answer, not a cache hit.
function nspCountryFeedCacheKey(gl, hl, maxAgeHours, queries) {
  return NSP_COUNTRY_FEED_PREFIX + String(gl || '').toUpperCase() + '_' + String(hl || '').toLowerCase() + '_' +
    (nspRecencyParams(maxAgeHours) || 'any') + '_' + nspHashQueries(queries);
}

function nspRecencyParams(maxAgeHours) {
  var h = Number(maxAgeHours) || 0;
  if (h <= 0) return '';
  for (var i = 0; i < NSP_RECENCY_PARAMS.length; i++) {
    if (h <= NSP_RECENCY_PARAMS[i].maxHours) return NSP_RECENCY_PARAMS[i].params;
  }
  return '';
}

function fetchCountryFacelessFeed(gl, hl, queries, maxAgeHours) {
  queries = (Array.isArray(queries) && queries.length) ? queries.slice(0, 18) : [];
  var opts = { gl: gl, hl: hl };
  var recency = nspRecencyParams(maxAgeHours);
  var sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  nspEmitProgress({ stage: 'session', status: 'start', sessionId: sessionId, gl: gl, hl: hl, totalSteps: queries.length });

  var stepErrors = [];

  function fetchStep(stageId, label, promise) {
    nspEmitProgress({ stage: stageId, status: 'start', sessionId: sessionId, label: label });
    return promise
      .then(function(d) {
        var videos = extractVideosFromInnertube(d).map(function(v) { v.source = stageId; return v; });
        nspEmitProgress({ stage: stageId, status: 'done', sessionId: sessionId, label: label, count: videos.length });
        return videos;
      })
      .catch(function(err) {
        var reason = String(err && err.message || err);
        stepErrors.push(label + ': ' + reason);
        nspEmitProgress({ stage: stageId, status: 'error', sessionId: sessionId, label: label, error: reason });
        return [];
      });
  }

  var jobs = [];
  queries.forEach(function(q, idx) {
    var stageId = 'search_' + idx;
    var body = { query: q };
    if (recency) body.params = recency;
    jobs.push(fetchStep(stageId, 'Search: "' + q + '"',
      innertubeFetch('search', body, opts)));
  });

  return Promise.all(jobs).then(function(arrays) {
    // Dedupe by videoId
    var merged = {};
    var rawTotal = 0;
    arrays.forEach(function(arr) {
      rawTotal += (arr || []).length;
      (arr || []).forEach(function(v) {
        if (!v || !v.videoId) return;
        if (!merged[v.videoId]) merged[v.videoId] = v;
      });
    });
    var list = Object.values(merged);
    if (!list.length && stepErrors.length) {
      var e = new Error('every_search_failed: ' + stepErrors[0]);
      e.stepErrors = stepErrors;
      throw e;
    }
    console.log('[NSP SW] InnerTube feed: ' + list.length + ' unique (from ' + rawTotal + ' raw) videos from ' + arrays.length + ' sources (gl=' + gl + ' hl=' + hl + ')');
    nspEmitProgress({ stage: 'merge', status: 'done', sessionId: sessionId, rawCount: rawTotal, uniqueCount: list.length });
    nspEmitProgress({ stage: 'session', status: 'done', sessionId: sessionId, count: list.length });
    return list;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Routes for 'policy:*' messages. Separate listener, and it only answers senders from this extension so no page can reach it.
// ════════════════════════════════════════════════════════════════════════════
var _nspPoliciesCache = null;
function nspPolicyLoadRules() {
  if (_nspPoliciesCache) return Promise.resolve(_nspPoliciesCache);
  return fetch(chrome.runtime.getURL('data/policies.json'))
    .then(function (r) { if (!r.ok) throw new Error('policies.json HTTP ' + r.status); return r.json(); })
    .then(function (j) { _nspPoliciesCache = j; return j; });
}
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || typeof msg.type !== 'string' || msg.type.indexOf('policy:') !== 0) return;
  if (!sender || sender.id !== chrome.runtime.id) { try { sendResponse({ ok: false, error: 'sender_not_allowed' }); } catch (eR) {} return; }
  if (msg.type === 'policy:rules') {
    nspPolicyLoadRules()
      .then(function (rules) { sendResponse({ ok: true, rules: rules }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
    return true;
  }
  if (msg.type === 'policy:evaluate') {
    if (typeof NSPPolicy === 'undefined' || !NSPPolicy || !NSPPolicy.evaluatePackage) {
      try { sendResponse({ ok: false, error: 'NSPPolicy is not loaded, importScripts failed' }); } catch (eR3) {}
      return;
    }
    NSPPolicy.evaluatePackage(msg.payload || {})
      .then(function (result) { sendResponse({ ok: true, result: result }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
    return true;
  }
  try { sendResponse({ ok: false, error: 'unknown_policy_route' }); } catch (eR2) {}
});

