// service-worker.js — NicheScanner Pro v2.6 (handlers completos)

// ── NSP POLICY ENGINE (Fase 1) ───────────────────────────────────────────────
// SW CLASSIC (el manifest NO declara "type":"module") → importScripts en la
// evaluación inicial es la vía correcta (un module-SW usaría import estático).
// Orden: primero la lib de texto, luego el motor (NSPPolicy depende de NSPText).
try { importScripts('../lib/nsp-text.js', '../nsp-policy.js'); } catch (eNspText) { console.warn('[NSP SW] importScripts policy engine:', eNspText && eNspText.message); }

// ── v3.7.3 RATE LIMITER (Gemini free tier 15 RPM) ─────────────────────────────
// Sliding window: array de timestamps de las últimas N requests a Gemini.
// Antes de cada fetch, si las últimas 14 caben dentro de 60s, esperamos hasta
// que la más vieja salga del window. Nunca pegamos 429 del lado del cliente.
var _nspGeminiCallTimes = []; // ms timestamps
var NSP_GEMINI_LIMIT_PER_MIN = 14; // 1 menos que el oficial 15 (buffer de seguridad)

function nspGeminiWaitForRateLimit() {
  return new Promise(function(resolve) {
    var now = Date.now();
    _nspGeminiCallTimes = _nspGeminiCallTimes.filter(function(t) { return (now - t) < 60000; });
    if (_nspGeminiCallTimes.length < NSP_GEMINI_LIMIT_PER_MIN) {
      _nspGeminiCallTimes.push(now);
      resolve(0);
      return;
    }
    var oldest = _nspGeminiCallTimes[0];
    var waitMs = (oldest + 60000) - now + 100;
    if (waitMs < 0) waitMs = 0;
    console.log('[NSP rate-limiter Gemini] ' + _nspGeminiCallTimes.length + '/' + NSP_GEMINI_LIMIT_PER_MIN + ' usadas — esperando ' + Math.ceil(waitMs / 1000) + 's');
    setTimeout(function() {
      var now2 = Date.now();
      _nspGeminiCallTimes = _nspGeminiCallTimes.filter(function(t) { return (now2 - t) < 60000; });
      _nspGeminiCallTimes.push(now2);
      resolve(waitMs);
    }, waitMs);
  });
}

// v3.8.1 — Rate limiter SEPARADO para Groq (límite oficial: 30 RPM, buffer 28).
// Antes Groq compartía el limiter de Gemini (14/min) y eso era absurdo.
var _nspGroqCallTimes = [];
var NSP_GROQ_LIMIT_PER_MIN = 28;

function nspGroqWaitForRateLimit() {
  return new Promise(function(resolve) {
    var now = Date.now();
    _nspGroqCallTimes = _nspGroqCallTimes.filter(function(t) { return (now - t) < 60000; });
    if (_nspGroqCallTimes.length < NSP_GROQ_LIMIT_PER_MIN) {
      _nspGroqCallTimes.push(now);
      resolve(0);
      return;
    }
    var oldest = _nspGroqCallTimes[0];
    var waitMs = (oldest + 60000) - now + 100;
    if (waitMs < 0) waitMs = 0;
    console.log('[NSP rate-limiter Groq] ' + _nspGroqCallTimes.length + '/' + NSP_GROQ_LIMIT_PER_MIN + ' usadas — esperando ' + Math.ceil(waitMs / 1000) + 's');
    setTimeout(function() {
      var now2 = Date.now();
      _nspGroqCallTimes = _nspGroqCallTimes.filter(function(t) { return (now2 - t) < 60000; });
      _nspGroqCallTimes.push(now2);
      resolve(waitMs);
    }, waitMs);
  });
}

// ── v3.8.0 — MULTI-PROVIDER AI HELPERS ───────────────────────────────────────
// Groq (OpenAI-compatible) y Ollama (OpenAI-compatible) usan formato unificado.
// Gemini tiene su propio formato. Estos helpers normalizan a {ok, text, functionCalls}.

// Convierte mensajes Gemini-style → OpenAI-style (Groq + Ollama lo entienden)
function nspMessagesToOpenAI(messages) {
  return (messages || []).map(function(m) {
    var role = m.role === 'assistant' || m.role === 'model' ? 'assistant' :
               m.role === 'function' || m.role === 'tool' ? 'tool' : 'user';
    var content = String(m.content || '');
    // Si hay functionCall/functionResponse en Gemini format, convertir
    if (role === 'tool' && m.functionResponse) {
      return { role: 'tool', tool_call_id: m.toolCallId || m.functionResponse.name || 'call', name: m.functionResponse.name, content: JSON.stringify(m.functionResponse.response || {}) };
    }
    if (m.functionCall) {
      return { role: 'assistant', content: null, tool_calls: [{ id: m.functionCall.id || 'call_' + Date.now(), type: 'function', function: { name: m.functionCall.name, arguments: JSON.stringify(m.functionCall.args || {}) } }] };
    }
    return { role: role, content: content };
  });
}

// Convierte tools Gemini format → OpenAI format
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

// Parsea response OpenAI-style → {ok, text, functionCalls}
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

// fetch con TIMEOUT (AbortController). CAUSA RAÍZ de "el chat se cuelga para siempre":
// un fetch de IA sin timeout que acepta la conexión pero nunca responde (TCP colgado,
// proxy, región) deja el handler con `return true` esperando eternamente → sendResponse
// nunca corre. Con timeout, el fetch RECHAZA y el catch hace fallthrough/responde error.
function nspFetchTimeout(url, opts, ms) {
  opts = opts || {};
  var ctrl = new AbortController();
  var to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 45000);
  opts.signal = ctrl.signal;
  return fetch(url, opts).finally(function () { clearTimeout(to); });
}

// Llamada a Groq (OpenAI-compatible) — v3.9.0 con detección de rate-limit + TPM-safe
// NOTA TPM: el free tier de Groq tiene un límite de tokens-por-minuto bajo (~6000 en
// llama-3.1-8b-instant). Un system prompt gigante (la biblia ZERACK ~6000 tokens) revienta
// el TPM en UNA sola request → 429 instantáneo. Por eso acá recortamos el system a ~9000
// chars (~2200 tokens) y limitamos la respuesta, para que un turno entero quepa bajo el TPM.
async function nspCallGroq(apiKey, model, payload, messages) {
  await nspGroqWaitForRateLimit(); // limiter propio de Groq (28/min) no el de Gemini
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
    // v4.41.0: timeout/red caída NO debe LANZAR — lanzaba y rompía el cascade de proveedores (en vez de
    // caer a Ollama/Gemini, daba error). Devuelve un fallo NORMAL {ok:false} (misma forma que los errores
    // de API de abajo) → el wrapper de retry y el cascade caen limpio al siguiente provider.
    console.warn('[NSP SW] Groq network/timeout:', eNet && eNet.message);
    return { ok: false, error: 'Groq network: ' + String((eNet && eNet.message) || eNet), rateLimited: false };
  }
  var elapsedMs = Date.now() - t0;
  console.log('[NSP SW] Groq ' + model + ' → ' + elapsedMs + 'ms, ' + (resp.ok ? 'OK' : 'FAIL ' + resp.status));
  if (!resp.ok) {
    var isRate = resp.status === 429;
    var retryAfter = 0;
    if (isRate) {
      // Groq manda el delay en el header retry-after, o en el message "try again in 4.5s"
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

// Wrapper de Groq con wait-and-retry en rate-limit corto (≤10s). Si el delay es largo
// o se agotan los reintentos, devuelve {ok:false, rateLimited:true} para que el handler
// haga fallthrough al siguiente provider.
async function nspCallGroqWithRetry(apiKey, model, payload, messages) {
  var attempts = 0;
  while (true) {
    var res = await nspCallGroq(apiKey, model, payload, messages);
    if (res.ok) return res;
    if (res.rateLimited && res.retryAfter > 0 && res.retryAfter <= 10 && attempts < 1) {
      console.log('[NSP SW] Groq rate limit, esperando ' + res.retryAfter + 's y reintentando...');
      await new Promise(function(r) { setTimeout(r, (res.retryAfter + 0.5) * 1000); });
      attempts++;
      continue;
    }
    return res;
  }
}

// Ping Ollama para detectar si está corriendo
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

// Llamada a Ollama (formato OpenAI-compatible via /v1/chat/completions)
async function nspCallOllama(url, model, payload, messages) {
  var openAIMessages = nspMessagesToOpenAI(messages);
  if (payload.system) openAIMessages.unshift({ role: 'system', content: String(payload.system).slice(0, 24000) });
  var body = {
    model: model,
    messages: openAIMessages,
    stream: false,
    options: {
      num_predict: Math.max(256, Math.min(8192, Number(payload.maxTokens) || 2048)),
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
    // v4.42.0: timeout/red de Ollama (local) NO debe LANZAR — devuelve fallo NORMAL {ok:false} para que
    // el cascade de proveedores caiga limpio al siguiente (Gemini). Mismo patrón que el fix de Groq (v4.41).
    console.warn('[NSP SW] Ollama network/timeout:', eNet && eNet.message);
    return { ok: false, error: 'Ollama network: ' + String((eNet && eNet.message) || eNet) };
  }
  if (!resp.ok) {
    return { ok: false, error: 'Ollama ' + resp.status + ': ' + JSON.stringify(data).slice(0, 200) };
  }
  return nspParseOpenAIResponse(data);
}

// Llamada a Gemini con fallback de modelos + retry-on-rate-limit. v3.9.0: extraído a
// función para poder usarlo en la cola de providers con fallthrough. Devuelve
// {ok, text, functionCalls, modelUsed, rateLimited, retryAfter, error, detail, triedModels}.
async function nspCallGemini(geminiKey, cachedModel, payload, messages) {
  var modelChain = [];
  if (cachedModel) modelChain.push(cachedModel);
  // Modelos en orden de probabilidad de funcionar en 2025 (Latam incluido)
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
        await nspGeminiWaitForRateLimit();
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

            // Delay corto y aún hay retries → esperar y reintentar MISMO modelo
            if (retryDelaySec > 0 && retryDelaySec <= 30 && retryCount < maxRetries) {
              console.log('[NSP SW] Rate limit en ' + modelName + ', esperando ' + retryDelaySec + 's...');
              await new Promise(function(res) { setTimeout(res, (retryDelaySec + 1) * 1000); });
              retryCount++;
              continue;
            }
            // Delay largo o sin retries → marcar rate-limit y pasar al próximo modelo
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
          // Otro error (500, etc) → fallar este provider de inmediato
          return { ok: false, error: errMsg, detail: data.error, triedModels: triedLog, rateLimited: false };
        }

        var text = '';
        var functionCalls = [];
        try {
          if (data && Array.isArray(data.candidates) && data.candidates.length) {
            var cand = data.candidates[0];
            if (cand && cand.content && Array.isArray(cand.content.parts)) {
              for (var i = 0; i < cand.content.parts.length; i++) {
                var part = cand.content.parts[i];
                if (part && typeof part.text === 'string') text += part.text;
                if (part && part.functionCall) functionCalls.push(part.functionCall);
              }
            }
            if (!text && !functionCalls.length && cand && cand.finishReason && cand.finishReason !== 'STOP') {
              triedLog.push(modelName + ' → finishReason=' + cand.finishReason);
              lastError = 'gemini_finished_' + cand.finishReason;
              lastDetail = cand;
              modelDone = true;
              break;
            }
          }
        } catch(e) {}
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
      await nspGeminiWaitForRateLimit();
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
    console.log('[NSP SW] trend-check starting —', new Date().toLocaleTimeString());
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
        // Update knownVideoIds
        w.knownVideoIds = (w.knownVideoIds || []).concat(res.newOutliers.map(function(o) { return o.vidId; })).slice(-100);
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
          title: '🔥 ' + (a.channel.name || 'Canal') + ' publicó un outlier',
          message: (top.title || 'video').slice(0, 80) + ' · ' + fmtViews(top.views) + ' views en ' + fmtHours(top.hoursOld),
          priority: 2
        });
      } catch(e) { console.warn('[NSP SW] notif fail:', e); }
    }
  }
  console.log('[NSP SW] trend-check done, alerts:', alerts.length);
}

async function checkChannelForNewOutliers(w) {
  var url = w.channelUrl.replace(/\/+$/, '').split('?')[0] + '/videos';
  var resp = await fetch(url, { method: 'GET', credentials: 'omit' });
  var html = await resp.text();
  if (!html) return null;
  var m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) m = html.match(/window\["ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  var data;
  try { data = JSON.parse(m[1]); } catch(e) { return null; }

  var videos = [];
  function walk(o, depth) {
    if (depth > 25 || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], depth + 1); return; }
    var v = o.videoRenderer || o.gridVideoRenderer;
    if (v && v.videoId) {
      try {
        var title = (v.title && (v.title.simpleText || (v.title.runs && v.title.runs[0] && v.title.runs[0].text))) || '';
        var viewsTxt = (v.viewCountText && (v.viewCountText.simpleText || (v.viewCountText.runs && v.viewCountText.runs[0] && v.viewCountText.runs[0].text))) || '';
        if (!viewsTxt && v.shortViewCountText) viewsTxt = v.shortViewCountText.simpleText || (v.shortViewCountText.runs && v.shortViewCountText.runs[0] && v.shortViewCountText.runs[0].text) || '';
        var pubTxt = (v.publishedTimeText && (v.publishedTimeText.simpleText || (v.publishedTimeText.runs && v.publishedTimeText.runs[0] && v.publishedTimeText.runs[0].text))) || '';
        if (title) videos.push({
          vidId: v.videoId,
          title: title,
          views: parseViews(viewsTxt),
          hoursOld: parseRelHours(pubTxt)
        });
      } catch(e) {}
    }
    var keys = Object.keys(o);
    for (var k = 0; k < keys.length; k++) {
      if (keys[k] === 'videoRenderer' || keys[k] === 'gridVideoRenderer') continue;
      walk(o[keys[k]], depth + 1);
    }
  }
  walk(data, 0);

  // Filter: new videos (not in knownVideoIds) + outlier criteria (VPH >= 100 OR >50K views in <72h)
  var known = w.knownVideoIds || [];
  var threshold_vph = 100;
  var newOutliers = videos.filter(function(v) {
    if (known.indexOf(v.vidId) !== -1) return false;
    if (!v.views || !v.hoursOld || v.hoursOld < 0.5) return false;
    var vph = v.views / v.hoursOld;
    if (vph >= threshold_vph) return true;
    if (v.hoursOld < 72 && v.views >= 50000) return true;
    return false;
  });

  // If first time checking (knownVideoIds empty), don't fire — just baseline
  if (!known.length) {
    w.knownVideoIds = videos.map(function(v) { return v.vidId; }).slice(0, 50);
    return { newOutliers: [] };
  }

  return { newOutliers: newOutliers.slice(0, 5) };
}

function parseViews(t) {
  if (!t) return 0;
  t = String(t).replace(/[^\d.kKmMbB]/g, '');
  if (/k$/i.test(t)) return Math.round(parseFloat(t) * 1000);
  if (/m$/i.test(t)) return Math.round(parseFloat(t) * 1000000);
  if (/b$/i.test(t)) return Math.round(parseFloat(t) * 1000000000);
  return parseInt(t.replace(/[.,]/g, ''), 10) || 0;
}

function parseRelHours(text) {
  if (!text) return null;
  // FIX: ahora ES/EN/DE/FR/PT/IT. Antes solo ES/EN → videos alemanes ("vor 2 Tagen") daban null
  // y el filtro de edad los descartaba TODOS (Country Feed = 0 resultados / rojo en Germany).
  var t = String(text).toLowerCase()
    .replace(/^(hace|premiered|streamed|vor|il y a|há|fa)\s*/i, '')   // prefijos: ES/DE/FR/PT/IT
    .trim();
  var m = t.match(/(\d+)\s*(second|segundo|sekund|seconde|minut|min|hora|hour|hr|stunde|heure|ora|d[ií]a|day|tag|jour|giorno|dia|semana|week|woche|semaine|settiman|month|mes|monat|mois|mese|year|a[ñn]o|jahr|an[s]?|anno|ann)/);
  if (!m) {
    // formas "ayer/hoy/yesterday/gestern/hier" → ~1 día / ~0h
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

  // — NSP YouTube Data API: fetch channel snippet+statistics (batch hasta 50 ids)
  // Hecho desde service-worker para evitar CORS issues del content script MAIN world
  if (msg.type === 'NSP_FETCH_YT_CHANNELS') {
    var ids = (msg.channelIds || []).filter(function(id) {
      return typeof id === 'string' && /^[A-Za-z0-9_\-]{20,80}$/.test(id);
    }).slice(0, 50);
    if (!ids.length) { sendResponse({ ok: false, error: 'no ids' }); return false; }
    var apiKey = (msg.apiKey || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 50);
    if (!apiKey) { sendResponse({ ok: false, error: 'no key' }); return false; }
    var url = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id='
      + ids.join(',') + '&key=' + apiKey;
    // v4.40.0: con timeout (15s) — sin esto, si la YouTube Data API se colgaba, el SW y quien lo
    // llamó esperaban para siempre y sendResponse nunca llegaba (port colgado). El AbortController
    // del helper rechaza al expirar → cae al .catch de abajo → responde error en vez de colgarse.
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
    chrome.storage.local.get('nsp_all_channels', function(res) {
      var all = res.nsp_all_channels || [];
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
        prev.savedAt = Date.now();
      } else {
        entry.savedAt = Date.now();
        all.unshift(entry);
      }
      if (all.length > 500) all.length = 500;
      chrome.storage.local.set({ nsp_all_channels: all }, function() {
        sendResponse({ ok: true, total: all.length });
      });
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

  // — Open dashboard tab (URL validada: solo interna de la extensión o youtube.com, mismo criterio que NSP_OPEN_TAB)
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
      sendResponse({ ok: true, prefs: r.nsp_ui_prefs || { language: 'auto', market: 'global', depth: 'balanced' } });
    });
    return true;
  }
  if (msg.type === 'NSP_UI_PREFS_SET') {
    chrome.storage.local.set({ nsp_ui_prefs: msg.prefs || {} }, function() {
      sendResponse({ ok: true, prefs: msg.prefs });
    });
    return true;
  }

  // — Set YouTube PREF cookie to force gl/hl for the user's session.
  //   Called by content script when the user picks a market with gl/hl set.
  //   This is the "soft" persistence layer — pages loaded AFTER this call
  //   will respect the new locale. Current pages still need a reload to apply.
  if (msg.type === 'NSP_SET_YT_COOKIE') {
    var gl = String(msg.gl || '').trim();
    var hl = String(msg.hl || '').trim();
    if (!chrome.cookies) {
      sendResponse({ ok: false, error: 'chrome.cookies API not available' });
      return false;
    }
    // gl/hl empty -> CLEAR the cookie (reverting to YT default for global market)
    if (!gl && !hl) {
      chrome.cookies.remove({
        url: 'https://www.youtube.com/',
        name: 'PREF'
      }, function(removed) {
        var err = chrome.runtime && chrome.runtime.lastError;
        if (err) sendResponse({ ok: false, error: err.message });
        else sendResponse({ ok: true, cleared: !!removed });
      });
      return true;
    }
    // YouTube PREF cookie format: f6=400 (enable persist) + hl + gl
    var prefValue = 'f6=400&hl=' + encodeURIComponent(hl) + '&gl=' + encodeURIComponent(gl);
    var expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180; // 180d
    chrome.cookies.set({
      url: 'https://www.youtube.com/',
      domain: '.youtube.com',
      name: 'PREF',
      value: prefValue,
      path: '/',
      secure: true,
      sameSite: 'no_restriction',
      expirationDate: expiration
    }, function(cookie) {
      var err = chrome.runtime && chrome.runtime.lastError;
      if (err) {
        sendResponse({ ok: false, error: err.message });
        return;
      }
      sendResponse({ ok: true, cookie: cookie ? { value: cookie.value, gl: gl, hl: hl } : null });
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
    var cacheKey = 'nsp_country_feed_' + gl + '_' + hl;
    var TTL = 15 * 60 * 1000; // 15 min

    function returnCached(cached, source) {
      sendResponse({ ok: true, videos: cached.videos || [], cached: true, ts: cached.ts, source: source });
    }
    function returnFresh(videos) {
      try {
        var payload = { videos: videos, ts: Date.now(), gl: gl, hl: hl };
        var setObj = {}; setObj[cacheKey] = payload;
        chrome.storage.local.set(setObj);
      } catch(e) {}
      sendResponse({ ok: true, videos: videos, cached: false, ts: Date.now() });
    }

    chrome.storage.local.get(cacheKey, function(r) {
      var cached = r && r[cacheKey];
      if (!force && cached && cached.videos && (Date.now() - cached.ts) < TTL) {
        returnCached(cached, 'cache-fresh');
        return;
      }
      // Fetch fresh
      fetchCountryFacelessFeed(gl, hl, queries)
        .then(returnFresh)
        .catch(function(err) {
          console.warn('[NSP SW] InnerTube fetch error:', err && err.message);
          if (cached && cached.videos) returnCached(cached, 'cache-stale-fallback');
          else sendResponse({ ok: false, error: String(err && err.message || err), videos: [] });
        });
    });
    return true; // async
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
      sendResponse({
        ok: true,
        memory: mem,
        blockedDashboardChannelUrls: dashboardChannels.map(function(c) { return c.channelUrl; }).filter(Boolean),
        blockedDashboardChannelKeys: dashboardChannels.map(function(c) { return c.channelKey; }).filter(Boolean)
      });
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
  // PATCH: merge parcial del estado del dashboard. Antes NO existía este handler →
  // el dashboard mandaba ASHLYV_GLOBAL_STATE_PATCH (idioma, filtros, watchlist, focus,
  // auto-mix) y se perdía: nada persistía al recargar. Ahora hace merge y guarda.
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

  // — Anthropic proxy (server-side, uses stored API key)
  if (msg.type === 'ASHLYV_ANTHROPIC_REQUEST') {
    chrome.storage.local.get('ashlyv_api_key', async function(r) {
      var apiKey = r && typeof r.ashlyv_api_key === 'string' ? r.ashlyv_api_key : '';
      if (!apiKey || !/^sk-ant-[a-zA-Z0-9\-_]{20,180}$/.test(apiKey)) {
        sendResponse({ ok: false, error: 'missing_or_invalid_api_key' });
        return;
      }
      var payload = msg.payload || {};
      try {
        var body = {
          model: payload.model || 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this YouTube thumbnail. Return strict JSON: {"ctrScore":0-100,"overallScore":0-100,"verdict":"VIRAL POTENTIAL|GOOD|NEEDS WORK|POOR","strengths":["..."],"weaknesses":["..."],"improvements":["..."],"facelessCompatible":true,"emotionScore":0-10,"textReadability":0-10,"colorContrast":0-10,"curiosityHook":0-10}' },
              { type: 'image', source: { type: 'base64', media_type: payload.mediaType || 'image/png', data: payload.imageBase64 || '' } }
            ]
          }]
        };
        var resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': apiKey
          },
          body: JSON.stringify(body)
        });
        var data = await resp.json();
        if (data && data.error) sendResponse({ ok: false, error: data.error.message });
        else sendResponse({ ok: true, data: data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    });
    return true;
  }

  if (msg.type === 'ASHLYV_VISION_JUDGE') {
    chrome.storage.local.get(['nsp_gemini_api_key', 'nsp_gemini_working_model'], async function (r) {
      try {
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
        var system = 'Eres un clasificador EXPERTO de canales "faceless" de YouTube (automatizacion). FACELESS = el canal NO depende de una persona real frente a camara: usa voz en off + imagenes/stock/IA, gameplay, compilaciones, texto, ilustraciones o b-roll. NO ES FACELESS: un presentador o persona recurrente a camara, un vlogger, un noticiero o medio (reporteros, logos de TV, eventos reales), reacciones, o un artista musical. Respondes SOLO con JSON valido, sin texto extra.';
        var prompt = 'Mira la(s) miniatura(s) de este canal de YouTube y decide si es FACELESS (automatizacion) o no.\nTitulo del video: "' + title + '"\nCanal: "' + channel + '"\n\nDevuelve EXACTAMENTE este JSON: {"faceless": true|false, "confidence": 0-100, "type": "AI"|"compilation"|"narration"|"gameplay"|"news"|"vlog"|"person"|"music"|"other", "reason": "max 12 palabras"}';
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

  // — v3.8.0 — Multi-provider AI cascade ───────────────────────────────────
  // Cascade: 1) Groq (cloud, 750-1000 tok/s, 30 RPM)
  //          2) Ollama local (M-series Mac, sin límites, sin internet)
  //          3) Gemini (fallback final)
  // Cada provider traduce su formato a la respuesta unificada {ok, text, functionCalls}.
  if (msg.type === 'ASHLYV_CHAT_REQUEST') {
    chrome.storage.local.get([
      'nsp_gemini_api_key', 'nsp_gemini_working_model',
      'nsp_groq_api_key', 'nsp_groq_model',
      'nsp_ollama_url', 'nsp_ollama_model', 'nsp_ollama_enabled',
      'nsp_provider_priority',
      'nsp_preferred_provider'  // v3.8.3: si está set y no es 'auto', usa solo ese
    ], async function(r) {
      try {   // defensa: cualquier throw acá adentro (callback async + return true) colgaría el canal para siempre
      var payload = msg.payload || {};
      var messages = Array.isArray(payload.messages) ? payload.messages : [];
      if (!messages.length) { sendResponse({ ok: false, error: 'no_messages' }); return; }

      // Read all provider configs
      var groqKey = r && typeof r.nsp_groq_api_key === 'string' ? r.nsp_groq_api_key.trim() : '';
      var groqValid = groqKey && /^gsk_[A-Za-z0-9_\-]{30,}$/.test(groqKey);
      var groqModel = (r && r.nsp_groq_model) || 'llama-3.1-8b-instant';

      var ollamaEnabled = r && r.nsp_ollama_enabled === true;
      var ollamaUrl = (r && r.nsp_ollama_url) || 'http://localhost:11434';
      var ollamaModel = (r && r.nsp_ollama_model) || 'llama3.2:3b';

      var geminiKey = r && typeof r.nsp_gemini_api_key === 'string' ? r.nsp_gemini_api_key.trim() : '';
      var geminiValid = geminiKey && /^AIza[a-zA-Z0-9\-_]{30,50}$/.test(geminiKey);

      var cachedModel = r && typeof r.nsp_gemini_working_model === 'string' ? r.nsp_gemini_working_model : '';

      // v3.9.0 — COLA DE PROVIDERS CON FALLTHROUGH AUTOMÁTICO EN RATE-LIMIT.
      // El "preferred provider" (el selector de abajo del chat) ya NO es exclusivo:
      // define la PRIORIDAD, pero si ese provider tira rate-limit (429), no responde
      // o falla, pasamos AUTOMÁTICAMENTE al siguiente configurado. Resultado: el
      // usuario NUNCA ve un error de rate-limit mientras haya UN provider libre.
      var preferredProvider = (r && r.nsp_preferred_provider) || 'auto';
      var order = [];
      function pushProv(name) { if (order.indexOf(name) === -1) order.push(name); }
      if (preferredProvider === 'groq' || preferredProvider === 'ollama' || preferredProvider === 'gemini') {
        pushProv(preferredProvider);            // el elegido va PRIMERO (prioridad)
      }
      pushProv('groq'); pushProv('ollama'); pushProv('gemini'); // el resto = fallback automático
      // Filtrar a los que realmente están configurados / habilitados
      var queue = order.filter(function(p) {
        if (p === 'groq') return !!groqValid;
        if (p === 'ollama') return !!ollamaEnabled;
        if (p === 'gemini') return !!geminiValid;
        return false;
      });

      if (!queue.length) {
        sendResponse({ ok: false, error: 'no_provider_configured', detail: 'No hay proveedor de IA configurado. Agregá tu key de Groq o Gemini en Options (o habilitá Ollama).' });
        return;
      }

      var lastErr = '';
      var anyAttempted = false;   // ¿algún provider llegó a llamar de verdad?
      var allRateLimited = true;  // ¿TODOS los fallos fueron por rate-limit?

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
            console.warn('[NSP SW] Groq agotado → fallthrough:', lastErr);
          } else if (prov === 'ollama') {
            var alive = await nspPingOllama(ollamaUrl);
            if (!alive) {
              lastErr = 'Ollama no responde en ' + ollamaUrl;
              allRateLimited = false; // no responder no es rate-limit
              console.warn('[NSP SW] Ollama no reachable → fallthrough');
              continue;
            }
            anyAttempted = true;
            console.log('[NSP SW] Provider → ollama', ollamaModel);
            var orr = await nspCallOllama(ollamaUrl, ollamaModel, payload, messages);
            if (orr.ok) { sendResponse(Object.assign({ provider: 'ollama', modelUsed: ollamaModel }, orr)); return; }
            lastErr = 'Ollama: ' + (orr.error || 'unknown');
            allRateLimited = false; // un fallo de Ollama es local, no rate-limit
            console.warn('[NSP SW] Ollama agotado → fallthrough:', lastErr);
          } else if (prov === 'gemini') {
            anyAttempted = true;
            console.log('[NSP SW] Provider → gemini');
            var ge = await nspCallGemini(geminiKey, cachedModel, payload, messages);
            if (ge.ok) { sendResponse(Object.assign({ provider: 'gemini' }, ge)); return; }
            lastErr = 'Gemini: ' + (ge.error || 'unknown');
            if (!ge.rateLimited) allRateLimited = false;
            console.warn('[NSP SW] Gemini agotado → fallthrough:', lastErr);
          }
        } catch (e) {
          lastErr = prov + ' exception: ' + (e && e.message || e);
          allRateLimited = false;
          console.warn('[NSP SW] ' + prov + ' exception:', e);
        }
      }

      // Se agotaron TODOS los providers de la cola.
      if (anyAttempted && allRateLimited) {
        // Caso raro: todos saturados a la vez. Mensaje suave, sin "rate limit" agresivo.
        sendResponse({ ok: false, error: 'all_busy', detail: 'Los proveedores de IA están saturados ahora mismo. Esperá unos segundos y reintentá.', lastError: lastErr });
      } else {
        sendResponse({ ok: false, error: 'all_providers_failed', detail: lastErr || 'Ningún proveedor disponible' });
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

  // v3.17.0 — Búsqueda activa de mercado vía InnerTube (alimenta el corpus del predictor)
  if (msg.type === 'NSP_AGENT_SEARCH_MARKET') {
    var mq = String(msg.query || '').slice(0, 120);
    if (!mq) { sendResponse({ ok: false, error: 'no_query' }); return false; }
    try {
      innertubeFetch('search', { query: mq }, { gl: msg.gl || 'US', hl: msg.hl || 'en' })
        .then(function(data) {
          var vids = (extractVideosFromInnertube(data) || []).slice(0, 45);
          // Parsear views numéricas para que el corpus tenga señal real
          var parsed = vids.map(function(v) {
            var viewsNum = 0;
            try {
              var vt = String(v.viewsText || '').replace(/[^0-9.,KMBkmb]/g, '');
              var mult = /M/i.test(vt) ? 1e6 : /B/i.test(vt) ? 1e9 : /K/i.test(vt) ? 1e3 : 1;
              var nRaw = vt.replace(/[KMBkmb]/g, '');
              var decimalComma = mult > 1 && /,\d{1,2}$/.test(nRaw) && nRaw.indexOf('.') === -1;
              var parsedNum = decimalComma
                ? parseFloat(nRaw.replace(',', '.').replace(/[^0-9.]/g, ''))
                : parseFloat(nRaw.replace(/,/g, '').replace(/[^0-9.]/g, ''));
              viewsNum = Math.round((parsedNum || 0) * mult);
            } catch(e) {}
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
        var resp = await fetch(fUrl, { method: 'GET', credentials: 'omit' });
        var text = await resp.text();
        sendResponse({ ok: true, status: resp.status, text: String(text || '').slice(0, 8000), truncated: text.length > 8000 });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  // ── NSP_FETCH_TRANSCRIPT: trae la transcripción/subtítulos de un video de YouTube ──
  // Es LA pieza que faltaba para "remakear" el estilo: con el guion real (+ tiempos = ritmo)
  // se regenera el video. Usa InnerTube player (sin cookies) → captionTracks → timedtext json3.
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
        // preferí: idioma pedido no-asr → cualquier no-asr → idioma pedido asr → el primero
        var hl = String(msg.hl || 'en').toLowerCase().slice(0, 2);
        function score(t) { var lc = String(t.languageCode || '').toLowerCase().slice(0, 2); return (lc === hl ? 0 : 2) + (t.kind === 'asr' ? 1 : 0); }
        tracks.sort(function (a, b) { return score(a) - score(b); });
        var track = tracks[0], url = String(track.baseUrl || '');
        if (!url) { sendResponse({ ok: false, error: 'no_track_url', title: title, author: author }); return; }
        if (url.indexOf('fmt=') < 0) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'fmt=json3';
        var r = await fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store' });
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

  // ── NSP_FETCH_STORYBOARD: spec del storyboard (decenas de fotogramas de TODO el video) ──
  // Sirve para MEDIR el edit real: ritmo de cortes, movimiento y color a lo largo del video.
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
        var idx = levels.length - 1, L = levels[idx];   // nivel de mayor detalle (más fotogramas)
        var per = L.cols * L.rows, sheets = Math.max(1, Math.ceil(L.total / per)), sprites = [];
        for (var n = 0; n < Math.min(sheets, 8); n++) {   // tope 8 sprites: suficiente para medir, no satura
          var u = String(base).split('$L').join(idx).split('$N').join(L.name).split('$M').join(n);
          u += (u.indexOf('?') >= 0 ? '&' : '?') + 'sigh=' + L.sigh;
          sprites.push(u);
        }
        sendResponse({ ok: true, tileW: L.tileW, tileH: L.tileH, cols: L.cols, rows: L.rows, total: L.total, interval: L.interval, sprites: sprites });
      } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    })();
    return true;
  }

  // — v3.9.0 GOD-TIER: stats reales de canal (parsea /about) ───────────────
  if (msg.type === 'NSP_AGENT_CHANNEL_STATS') {
    (async function() {
      try {
        var chUrl = String(msg.channelUrl || '').split('?')[0].replace(/\/$/, '');
        if (!/youtube\.com/i.test(chUrl)) { sendResponse({ ok: false, error: 'invalid_channel_url' }); return; }
        var aboutUrl = chUrl + '/about';
        var resp = await fetch(aboutUrl, { method: 'GET', credentials: 'omit', headers: { 'Accept-Language': 'es,en' } });
        var html = await resp.text();
        // Parsea desde el ytInitialData embebido o meta tags
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
          subscribers: subsRaw || 'desconocido',
          videoCount: videoCountRaw || 'desconocido',
          totalViews: viewsRaw || 'desconocido',
          joined: joinedRaw || 'desconocido',
          country: countryRaw || 'desconocido',
          description: (descRaw || '').slice(0, 300),
          note: subsRaw ? '' : 'Parsing parcial — YouTube cambió su HTML. Datos pueden faltar.'
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  // — v3.9.0 GOD-TIER: videos recientes de un canal (parsea /videos) ────────
  if (msg.type === 'NSP_AGENT_CHANNEL_VIDEOS') {
    (async function() {
      try {
        var cvUrl = String(msg.channelUrl || '').split('?')[0].replace(/\/$/, '');
        if (!/youtube\.com/i.test(cvUrl)) { sendResponse({ ok: false, error: 'invalid_channel_url' }); return; }
        var videosUrl = cvUrl + '/videos';
        var resp = await fetch(videosUrl, { method: 'GET', credentials: 'omit', headers: { 'Accept-Language': 'es,en' } });
        var html = await resp.text();
        // Extrae títulos + viewCountText + publishedTime de los richItemRenderer
        var videos = [];
        var re = /"videoRenderer":\{"videoId":"([^"]+)"[^}]*?"title":\{"runs":\[\{"text":"([^"]+)"\}\][^}]*?(?:"viewCountText":\{"simpleText":"([^"]*)"\})?[^}]*?(?:"publishedTimeText":\{"simpleText":"([^"]*)"\})?/g;
        var m, guard = 0;
        while ((m = re.exec(html)) !== null && guard < 20) {
          guard++;
          videos.push({
            videoId: m[1],
            title: (m[2] || '').replace(/\\u0026/g, '&').slice(0, 200),
            views: m[3] || '',
            published: m[4] || '',
            url: 'https://www.youtube.com/watch?v=' + m[1]
          });
        }
        // Fallback simple si el regex grande no matcheó
        if (!videos.length) {
          var reSimple = /"videoId":"([^"]+)"[^}]{0,400}?"text":"([^"]{4,120})"/g;
          var m2, g2 = 0, seen = {};
          while ((m2 = reSimple.exec(html)) !== null && g2 < 30) {
            g2++;
            if (seen[m2[1]]) continue; seen[m2[1]] = 1;
            videos.push({ videoId: m2[1], title: (m2[2] || '').slice(0, 200), url: 'https://www.youtube.com/watch?v=' + m2[1] });
            if (videos.length >= 15) break;
          }
        }
        sendResponse({ ok: true, channelUrl: cvUrl, count: videos.length, videos: videos.slice(0, 15) });
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
  // FIX: en un service-worker MV3, headers como Origin/Referer/X-YouTube-* son "forbidden"
  // y el navegador los descarta o falla la request → daba err en todo. Solo Content-Type
  // (lo que sí funciona, verificado contra youtubei/v1). gl/hl viajan dentro del context.
  return fetch(url, {
    method: 'POST',
    credentials: 'omit', // CRITICAL: no user cookies → no personalization
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullBody)
  }).then(function(r) {
    if (!r.ok) throw new Error('InnerTube HTTP ' + r.status);
    return r.json();
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
  function walk(o, depth, source) {
    if (depth > 25 || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length; i++) walk(o[i], depth + 1, source);
      return;
    }
    if (o.videoRenderer) pushFromRenderer(o.videoRenderer, source);
    if (o.gridVideoRenderer) pushFromRenderer(o.gridVideoRenderer, source);
    if (o.compactVideoRenderer) pushFromRenderer(o.compactVideoRenderer, source);
    if (o.richItemRenderer && o.richItemRenderer.content && o.richItemRenderer.content.videoRenderer) {
      pushFromRenderer(o.richItemRenderer.content.videoRenderer, source);
    }
    var keys = Object.keys(o);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (key === 'videoRenderer' || key === 'gridVideoRenderer' || key === 'compactVideoRenderer' || key === 'richItemRenderer') continue;
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
function fetchCountryFacelessFeed(gl, hl, queries) {
  queries = (Array.isArray(queries) && queries.length) ? queries.slice(0, 18) : [];
  var opts = { gl: gl, hl: hl };
  var sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  nspEmitProgress({ stage: 'session', status: 'start', sessionId: sessionId, gl: gl, hl: hl, totalSteps: 2 + queries.length });

  function fetchStep(stageId, label, promise) {
    nspEmitProgress({ stage: stageId, status: 'start', sessionId: sessionId, label: label });
    return promise
      .then(function(d) {
        var videos = extractVideosFromInnertube(d).map(function(v) { v.source = stageId; return v; });
        nspEmitProgress({ stage: stageId, status: 'done', sessionId: sessionId, label: label, count: videos.length });
        return videos;
      })
      .catch(function(err) {
        nspEmitProgress({ stage: stageId, status: 'error', sessionId: sessionId, label: label, error: String(err && err.message || err) });
        return [];
      });
  }

  var jobs = [];
  jobs.push(fetchStep('home_fresh', 'FEwhat_to_watch (home fresh-user)',
    innertubeFetch('browse', { browseId: 'FEwhat_to_watch' }, opts)));
  // FIX: FEtrending/FEexplore devuelven HTTP 400 (YouTube los deprecó) → daba err siempre.
  // Lo reemplazo por una BÚSQUEDA ordenada por subidas recientes (search SÍ funciona), que da
  // contenido fresco del país igual de útil para el radar.
  jobs.push(fetchStep('trending', 'Trending (search reciente)',
    innertubeFetch('search', { query: 'tendencias', params: 'CAI%3D' }, opts)));
  queries.forEach(function(q, idx) {
    var stageId = 'search_' + idx;
    jobs.push(fetchStep(stageId, 'Search: "' + q + '"',
      innertubeFetch('search', { query: q }, opts)));
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
    console.log('[NSP SW] InnerTube feed: ' + list.length + ' unique (from ' + rawTotal + ' raw) videos from ' + arrays.length + ' sources (gl=' + gl + ' hl=' + hl + ')');
    nspEmitProgress({ stage: 'merge', status: 'done', sessionId: sessionId, rawCount: rawTotal, uniqueCount: list.length });
    nspEmitProgress({ stage: 'session', status: 'done', sessionId: sessionId, count: list.length });
    return list;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// NSP POLICY ENGINE (Fase 1) — rutas de mensajes 'policy:*'
// Listener PROPIO y aditivo (no toca el hub existente; los tipos no colisionan).
// Seguridad: SOLO responde a remitentes de ESTA extensión (content scripts y
// páginas propias → sender.id === chrome.runtime.id). Cualquier otro origen
// recibe rechazo sin datos. policies.json se sirve con caché en memoria.
// 'policy:evaluate' se conecta en STEP 3 (requiere nsp-policy.js).
// ════════════════════════════════════════════════════════════════════════════
var _nspPoliciesCache = null;
function nspPolicyLoadRules() {
  if (_nspPoliciesCache) return Promise.resolve(_nspPoliciesCache);
  return fetch(chrome.runtime.getURL('data/policies.json'))
    .then(function (r) { if (!r.ok) throw new Error('policies.json HTTP ' + r.status); return r.json(); })
    .then(function (j) { _nspPoliciesCache = j; return j; });
}
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || typeof msg.type !== 'string' || msg.type.indexOf('policy:') !== 0) return;  // no es nuestro → lo ven los demás listeners
  if (!sender || sender.id !== chrome.runtime.id) { try { sendResponse({ ok: false, error: 'sender_not_allowed' }); } catch (eR) {} return; }
  if (msg.type === 'policy:rules') {
    nspPolicyLoadRules()
      .then(function (rules) { sendResponse({ ok: true, rules: rules }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
    return true;  // respuesta async
  }
  if (msg.type === 'policy:evaluate') {
    // Evalúa un paquete {channelKey, lang, script, title, description} con el motor.
    // Disponible para CUALQUIER contexto propio (content scripts vía bridge, páginas).
    if (typeof NSPPolicy === 'undefined' || !NSPPolicy || !NSPPolicy.evaluatePackage) {
      try { sendResponse({ ok: false, error: 'NSPPolicy no cargado (importScripts falló)' }); } catch (eR3) {}
      return;
    }
    NSPPolicy.evaluatePackage(msg.payload || {})
      .then(function (result) { sendResponse({ ok: true, result: result }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
    return true;  // respuesta async
  }
  try { sendResponse({ ok: false, error: 'unknown_policy_route' }); } catch (eR2) {}
});

