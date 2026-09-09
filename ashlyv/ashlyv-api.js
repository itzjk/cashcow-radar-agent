// ashlyv-api.js - Local-first AI client for Ashlyv extension pages
// Prefers Ollama local via service worker, falls back to Anthropic when needed.

window.AshlyVAPI = (function() {
  'use strict';

  var SW_TIMEOUT_MS = 30000;
  var OLLAMA_TEXT_MODEL = 'qwen2.5:7b';
  var OLLAMA_VISION_MODEL = 'qwen2.5vl:7b';
  var BACKEND_BASE_URL = 'http://127.0.0.1:8000';

  function keepAlive() {
    chrome.runtime.sendMessage({ type: 'ASHLYV_PING' }, function() {
      if (chrome.runtime.lastError) {}
    });
  }

  function sendToSW(message, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var timeout = setTimeout(function() {
        reject(new Error('Service worker timeout despues de ' + ((timeoutMs || SW_TIMEOUT_MS) / 1000) + 's'));
      }, timeoutMs || SW_TIMEOUT_MS);

      try {
        chrome.runtime.sendMessage(message, function(response) {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(new Error('Sin respuesta del service worker'));
            return;
          }
          resolve(response);
        });
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  function getApiKey() {
    return new Promise(function(resolve) {
      chrome.storage.local.get(['ashlyv_api_key'], function(res) {
        var key = res && res.ashlyv_api_key;
        if (!key || typeof key !== 'string' || key.length < 20) resolve(null);
        else resolve(key);
      });
    });
  }

  function getLocalStatus() {
    return sendToSW({ type: 'ASHLYV_OLLAMA_HEALTH' }, 7000).catch(function() {
      return { success: false, available: false, provider: 'ollama' };
    });
  }

  function getProviderStatus() {
    return Promise.all([getLocalStatus(), getApiKey()]).then(function(values) {
      var local = values[0] || {};
      var key = values[1];
      return {
        localAvailable: !!(local && local.success && local.available),
        localModels: local && local.models ? local.models : [],
        anthropicKeyConfigured: !!key,
        preferred: local && local.success && local.available ? 'ollama' : (key ? 'anthropic' : 'none')
      };
    });
  }

  function validateApiKey(apiKey) {
    return getLocalStatus().then(function(local) {
      if (local && local.success && local.available) {
        return {
          success: true,
          valid: true,
          local: true,
          provider: 'ollama',
          model: OLLAMA_TEXT_MODEL
        };
      }
      return sendToSW({
        type: 'ASHLYV_ANTHROPIC_VALIDATE',
        apiKey: apiKey
      }, 15000);
    });
  }

  function analyzeThumbnail(imageBase64, mediaType, channelName) {
    return analyzeThumbnailBackend(imageBase64, mediaType, null).then(function(backend) {
      var d = backend && backend.data ? backend.data : {};
      var scores = d.scores || {};
      var overall = Number(scores.overall || 0);
      return {
        success: true,
        provider: 'ashlyv-backend',
        content: JSON.stringify({
          ctrScore: overall,
          overallScore: overall,
          facelessCompatible: d.facelessCompatible !== false,
          verdict: overall >= 80 ? 'VIRAL POTENTIAL' : (overall >= 65 ? 'GOOD' : (overall >= 45 ? 'NEEDS WORK' : 'POOR')),
          emotionScore: Math.max(1, Math.min(10, Math.round((scores.curiosity || overall) / 10))),
          textReadability: Math.max(1, Math.min(10, Math.round((scores.readability || overall) / 10))),
          colorContrast: Math.max(1, Math.min(10, Math.round((scores.contrast || overall) / 10))),
          curiosityHook: Math.max(1, Math.min(10, Math.round((scores.curiosity || overall) / 10))),
          faceDetected: d.faceDetected === true,
          strengths: ['Contraste medido: ' + (d.contrast || 0), 'Brillo medido: ' + (d.brightness || 0)],
          weaknesses: d.improvements || [],
          improvements: d.improvements || [],
          nicheRecommendation: channelName ? ('Validar contra el estilo del canal ' + channelName) : 'Compatible con validacion faceless basada en miniatura.'
        })
      };
    }).catch(function() {
      return getProviderStatus().then(function(provider) {
      keepAlive();

      var systemPrompt = 'Eres un experto en YouTube thumbnails para canales faceless. Responde solo en espanol neutro. Analizas miniaturas con criterio de CTR, claridad, contraste y viralidad. Responde unicamente con JSON valido, sin markdown ni texto extra.';
      var userPrompt = 'Analiza esta miniatura de YouTube' + (channelName ? ' del canal ' + channelName : '') + ' y devuelve EXACTAMENTE este JSON: {"ctrScore": <numero 1-100>, "overallScore": <numero 1-100>, "facelessCompatible": <true o false>, "verdict": <"VIRAL POTENTIAL" o "GOOD" o "NEEDS WORK" o "POOR">, "emotionScore": <numero 1-10>, "textReadability": <numero 1-10>, "colorContrast": <numero 1-10>, "curiosityHook": <numero 1-10>, "faceDetected": <true o false>, "strengths": [<string>, <string>, <string maximo>], "weaknesses": [<string>, <string>, <string maximo>], "improvements": [<string>, <string>, <string>, <string maximo>], "nicheRecommendation": <string>}';

      if (provider.localAvailable) {
        return sendToSW({
          type: 'ASHLYV_OLLAMA_VISION',
          model: OLLAMA_VISION_MODEL,
          imageBase64: imageBase64,
          mediaType: mediaType || 'image/jpeg',
          systemPrompt: systemPrompt,
          userPrompt: userPrompt
        }, 180000).then(function(res) {
          if (!res || !res.success) {
            throw new Error((res && res.error) || 'Error local con Ollama Vision');
          }
          return res;
        });
      }

      if (!provider.anthropicKeyConfigured) throw new Error('No hay IA local activa ni API key configurada.');

      return getApiKey().then(function(apiKey) {
        return sendToSW({
          type: 'ASHLYV_ANTHROPIC_VISION',
          apiKey: apiKey,
          imageBase64: imageBase64,
          mediaType: mediaType || 'image/jpeg',
          systemPrompt: systemPrompt,
          userPrompt: userPrompt
        }, 30000);
      });
      });
    });
  }

  function analyzeChannel(channelName, channelData) {
    return getProviderStatus().then(function(provider) {
      keepAlive();

      var systemPrompt = 'Eres un experto en canales de YouTube faceless. Responde solo en espanol neutro y unicamente con JSON valido, sin texto extra.';
      var contextStr = channelData ? JSON.stringify({
        subscribers: channelData.subs,
        totalViews: channelData.views,
        videoCount: channelData.videoCount,
        avgViews: channelData.avgViews,
        topTopics: channelData.topics
      }) : 'datos no disponibles';
      var userPrompt = 'Analiza el canal de YouTube llamado "' + channelName + '". Datos disponibles: ' + contextStr + '. Devuelve EXACTAMENTE este JSON: {"facelessScore": <numero 1-100>, "replicable": <true o false>, "niche": <string>, "rpmEstimate": <numero en USD>, "monthlyRevenueEstimate": <string>, "growthPotential": <"HIGH" o "MEDIUM" o "LOW">, "facelessTechnique": <string>, "strengths": [<string>, <string>], "weaknesses": [<string>, <string>], "replicationStrategy": <string>, "contentGaps": [<string>, <string>], "recommendedPostingFrequency": <string>, "competitionLevel": <"HIGH" o "MEDIUM" o "LOW">}';

      if (provider.localAvailable) {
        return sendToSW({
          type: 'ASHLYV_OLLAMA_CHAT',
          model: OLLAMA_TEXT_MODEL,
          systemPrompt: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        }, 120000).then(function(res) {
          if (!res || !res.success) {
            throw new Error((res && res.error) || 'Error local con Ollama Chat');
          }
          return res;
        });
      }

      if (!provider.anthropicKeyConfigured) throw new Error('No hay IA local activa ni API key configurada.');

      return getApiKey().then(function(apiKey) {
        return sendToSW({
          type: 'ASHLYV_ANTHROPIC_CHAT',
          apiKey: apiKey,
          systemPrompt: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          maxTokens: 1000
        }, 30000);
      });
    });
  }

  function generateNicheIdeas(niche, language, rpmTarget) {
    return getProviderStatus().then(function(provider) {
      keepAlive();

      var systemPrompt = 'Eres un experto en YouTube faceless. Responde solo en espanol neutro y unicamente con JSON valido.';
      var userPrompt = 'Genera ideas de contenido faceless para el nicho "' + niche + '" en idioma ' + (language || 'espanol') + ' con RPM objetivo de $' + (rpmTarget || 8) + '+. Devuelve EXACTAMENTE este JSON: {"titles": [<10 titulos de videos>], "hooks": [<5 hooks de apertura>], "thumbnailConcepts": [<5 conceptos de miniatura sin cara>], "uploadSchedule": <string>, "monetizationTips": [<3 tips para maximizar RPM>]}';

      if (provider.localAvailable) {
        return sendToSW({
          type: 'ASHLYV_OLLAMA_CHAT',
          model: OLLAMA_TEXT_MODEL,
          systemPrompt: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        }, 120000).then(function(res) {
          if (!res || !res.success) {
            throw new Error((res && res.error) || 'Error local con Ollama Chat');
          }
          return res;
        });
      }

      if (!provider.anthropicKeyConfigured) throw new Error('No hay IA local activa ni API key configurada.');

      return getApiKey().then(function(apiKey) {
        return sendToSW({
          type: 'ASHLYV_ANTHROPIC_CHAT',
          apiKey: apiKey,
          systemPrompt: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          maxTokens: 1500
        }, 30000);
      });
    });
  }

  function parseApiJson(content) {
    if (!content || typeof content !== 'string') return null;
    try {
      var clean = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var start = clean.indexOf('{');
      var end = clean.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      return JSON.parse(clean.slice(start, end + 1));
    } catch (e) {
      console.error('[ASHLYV API] JSON parse error:', e.message, '| Raw:', content.slice(0, 200));
      return null;
    }
  }

  function backendPost(path, payload, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var controller = null;
      var timer = null;
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        timer = setTimeout(function() {
          try { controller.abort(); } catch (e) {}
          reject(new Error('Backend timeout en ' + path));
        }, timeoutMs || 90000);
      }
      fetch(BACKEND_BASE_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal: controller ? controller.signal : undefined
      }).then(function(res) {
        if (timer) clearTimeout(timer);
        return res.json().catch(function() { return {}; }).then(function(data) {
          if (!res.ok) {
            throw new Error((data && (data.detail || data.error)) || ('Backend HTTP ' + res.status));
          }
          resolve(data);
        });
      }).catch(function(error) {
        if (timer) clearTimeout(timer);
        reject(error);
      });
    });
  }

  function scanChannel(channel, language) {
    return backendPost('/niche/scan-channel', { channel: channel, language: language || 'es' }, 120000);
  }

  function analyzeThumbnailBackend(imageBase64, mediaType, imageUrl) {
    return backendPost('/niche/thumbnail/analyze', {
      imageBase64: imageBase64 || null,
      imageUrl: imageUrl || null,
      mediaType: mediaType || 'image/jpeg'
    }, 90000);
  }

  function generateContentScript(niche, style, targetDurationMinutes, language) {
    return backendPost('/niche/content-engine', {
      niche: niche,
      style: style || 'documentary faceless',
      targetDurationMinutes: targetDurationMinutes || 8,
      language: language || 'es'
    }, 180000);
  }

  function marketRadar(seedKeywords, language, maxResults) {
    return backendPost('/niche/market-radar', {
      seedKeywords: Array.isArray(seedKeywords) ? seedKeywords : [seedKeywords].filter(Boolean),
      language: language || 'es',
      maxResults: maxResults || 8
    }, 120000);
  }

  function competitorMap(channelOrQuery, language) {
    var text = String(channelOrQuery || '').trim();
    var payload = { language: language || 'es', maxResults: 10 };
    if (/^https?:\/\/|^@|^UC[A-Za-z0-9_-]{10,}/.test(text)) payload.channel = text;
    else payload.query = text;
    return backendPost('/niche/competitor-map', payload, 120000);
  }

  function gapFinder(input, language) {
    var text = String(input || '').trim();
    var payload = { language: language || 'es' };
    if (/^https?:\/\/|^@|^UC[A-Za-z0-9_-]{10,}/.test(text)) payload.channel = text;
    else payload.seed = text;
    return backendPost('/niche/gap-finder', payload, 120000);
  }

  function patternFinder(input, language) {
    var text = String(input || '').trim();
    var payload = { language: language || 'es' };
    if (/^https?:\/\/|^@|^UC[A-Za-z0-9_-]{10,}/.test(text)) payload.channel = text;
    else payload.seed = text;
    return backendPost('/niche/pattern-finder', payload, 120000);
  }

  return {
    validateApiKey: validateApiKey,
    analyzeThumbnail: analyzeThumbnail,
    analyzeThumbnailBackend: analyzeThumbnailBackend,
    analyzeChannel: analyzeChannel,
    scanChannel: scanChannel,
    generateContentScript: generateContentScript,
    marketRadar: marketRadar,
    competitorMap: competitorMap,
    gapFinder: gapFinder,
    patternFinder: patternFinder,
    generateNicheIdeas: generateNicheIdeas,
    parseApiJson: parseApiJson,
    getApiKey: getApiKey,
    getLocalStatus: getLocalStatus,
    getProviderStatus: getProviderStatus
  };
})();
// ASHLYV API CLIENT - ROUTES VIA SERVICE WORKER
