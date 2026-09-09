// ════════════════════════════════════════════════════════════════════════════
// NSP STUDIO AGENT — Agente conversacional dentro de YouTube Studio (v3.12.0)
// ════════════════════════════════════════════════════════════════════════════
// ISOLATED world sobre studio.youtube.com. chrome.runtime + chrome.storage + DOM.
// Es el MISMO agente que el del scan (function calling vía SW ASHLYV_CHAT_REQUEST),
// pero con tools para TODAS las áreas de Studio: analytics, contenido, comentarios,
// dashboard, monetización. Conversación persistente (sobrevive recargas al navegar).
// NO toca el scanner. Trusted Types compliant (solo createElement/textContent).
// ════════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';
  if (window.__nspStudioLoaded) return;
  window.__nspStudioLoaded = true;
  console.log('[NSP Studio] v4.1.0 — predictor multi-idioma (DE/ES/FR/PT/EN) + nicho Historias/Drama. Cargado en', window.location.href);

  // ── Estado ──────────────────────────────────────────────────────────────────
  var S = {
    messages: [],       // historial de conversación (formato Gemini-ish)
    pending: false,
    panelOpen: false,
    loaded: false
  };
  var CONV_KEY = 'nsp_studio_conv';
  var MAX_ITERS = 6;

  // ── Page type ─────────────────────────────────────────────────────────────
  function channelId() { return (window.location.href.match(/\/channel\/(UC[\w-]+)/) || [])[1] || ''; }
  function videoId() { return (window.location.href.match(/\/video\/([\w-]+)/) || [])[1] || ''; }
  function pageType() {
    var u = window.location.href;
    if (/\/video\/[^/]+\/analytics/i.test(u)) return 'video-analytics';
    if (/\/video\/[^/]+\/comments/i.test(u)) return 'video-comments';
    if (/\/video\/[^/]+\/edit/i.test(u)) return 'video-edit';
    if (/\/analytics/i.test(u)) return 'channel-analytics';
    if (/\/comments/i.test(u)) return 'comments';
    if (/\/videos\//i.test(u) || /\/content/i.test(u)) return 'content-list';
    if (/\/monetization/i.test(u)) return 'monetization';
    if (/\/channel\/[^/]+\/?$/i.test(u)) return 'channel-dashboard';
    return 'other';
  }
  function pageLabel(t) {
    return ({
      'video-analytics': 'Analíticas del Video', 'video-comments': 'Comentarios del Video',
      'video-edit': 'Edición del Video', 'channel-analytics': 'Analíticas del Canal',
      'comments': 'Comentarios', 'content-list': 'Contenido', 'monetization': 'Monetización',
      'channel-dashboard': 'Dashboard', 'other': 'YouTube Studio'
    })[t] || 'YouTube Studio';
  }

  // ── Extracción de datos del DOM ──────────────────────────────────────────────
  function readPage() {
    var data = { pageType: pageType(), pageLabel: pageLabel(pageType()), url: window.location.href, videoTitle: '', metrics: [], text: '' };
    try {
      var titleEl = document.querySelector('#entity-name, .video-title, ytcp-video-metadata-editor #title-textarea, [id="title"] #textbox, h1.page-title');
      if (titleEl) data.videoTitle = (titleEl.textContent || titleEl.value || '').trim().slice(0, 200);
      if (!data.videoTitle) { var h1 = document.querySelector('h1, ytcp-entity-page h1'); if (h1) data.videoTitle = (h1.textContent || '').trim().slice(0, 200); }
    } catch(e) {}
    try {
      var sels = ['ytcp-analytics-metric', '.metric-card', 'yta-key-metric-card', 'yta-latest-activity-card', '.key-metric', '[class*="metric"]'];
      var seen = {};
      sels.forEach(function(s) { try { document.querySelectorAll(s).forEach(function(el2) {
        var t = (el2.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length > 2 && t.length < 200 && !seen[t]) { seen[t] = 1; data.metrics.push(t); }
      }); } catch(e) {} });
    } catch(e) {}
    try {
      var main = document.querySelector('#main-container, ytcp-app, #content, ytcp-entity-page, main') || document.body;
      data.text = (main.innerText || main.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim().slice(0, 6000);
    } catch(e) {}
    return data;
  }

  function readVideosList() {
    var vids = [];
    try {
      var rows = document.querySelectorAll('ytcp-video-row, #video-row, [id="row-container"], ytcp-video-list-cell-video');
      Array.prototype.slice.call(rows, 0, 30).forEach(function(row) {
        var t = (row.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length > 5) vids.push(t.slice(0, 240));
      });
    } catch(e) {}
    if (!vids.length) {
      // fallback: texto del área de contenido
      var d = readPage();
      return { ok: true, source: 'page-text', count: 0, raw: d.text.slice(0, 4000) };
    }
    return { ok: true, source: 'rows', count: vids.length, videos: vids };
  }

  function readComments() {
    var comments = [];
    try {
      var nodes = document.querySelectorAll('ytcp-comment, #comment, ytcp-comment-thread, [id="content-text"]');
      Array.prototype.slice.call(nodes, 0, 40).forEach(function(n) {
        var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length > 3) comments.push(t.slice(0, 300));
      });
    } catch(e) {}
    if (!comments.length) {
      var d = readPage();
      return { ok: true, source: 'page-text', count: 0, raw: d.text.slice(0, 4000) };
    }
    return { ok: true, source: 'nodes', count: comments.length, comments: comments };
  }

  // ── Tools del agente Studio ───────────────────────────────────────────────────
  function studioToolDefs() {
    return [{
      functionDeclarations: [
        { name: 'studioReadCurrentPage', description: 'Lee la página actual de Studio: tipo, título del video (si aplica), métricas detectadas y texto crudo de analytics. ÚSALA SIEMPRE primero para tener contexto real antes de responder.', parameters: { type:'object', properties:{}, required:[] } },
        { name: 'studioNavigateTo', description: 'Navega a una sección de Studio. La página RECARGA (la conversación se conserva). section: dashboard | content | analytics | comments | monetization', parameters: { type:'object', properties:{ section:{ type:'string', description:'dashboard|content|analytics|comments|monetization' } }, required:['section'] } },
        { name: 'studioGetVideosList', description: 'Lee la lista de videos del canal con sus métricas. Solo útil si estás en la página de Contenido (si no, navegá ahí primero).', parameters: { type:'object', properties:{}, required:[] } },
        { name: 'studioGetComments', description: 'Lee los comentarios visibles (de un video o del inbox de comentarios).', parameters: { type:'object', properties:{}, required:[] } },
        { name: 'studioDeepAnalysis', description: 'Genera un REPORTE VISUAL estructurado del video/página actual (virality score, métricas con benchmark, fortalezas, debilidades, plan de acción). Devolvé esto cuando el usuario pida "analizá", "reporte", "diagnóstico".', parameters: { type:'object', properties:{}, required:[] } }
      ]
    }];
  }

  function studioExecTool(name, args) {
    args = args || {};
    try {
      if (name === 'studioReadCurrentPage') {
        var d = readPage();
        return Promise.resolve({ ok: true, pageType: d.pageType, pageLabel: d.pageLabel, videoTitle: d.videoTitle, metrics: d.metrics.slice(0, 30), text: d.text.slice(0, 4500) });
      }
      if (name === 'studioGetVideosList') return Promise.resolve(readVideosList());
      if (name === 'studioGetComments') return Promise.resolve(readComments());
      if (name === 'studioDeepAnalysis') {
        // Marca especial: el loop la maneja con render visual aparte
        return Promise.resolve({ ok: true, _deepAnalysis: true, data: readPage() });
      }
      if (name === 'studioNavigateTo') {
        var ch = channelId();
        if (!ch) return Promise.resolve({ ok: false, error: 'No detecté el channelId en la URL. Andá manualmente a una sección de Studio.' });
        var sec = String(args.section || '').toLowerCase();
        var paths = {
          dashboard: '/channel/' + ch,
          content: '/channel/' + ch + '/videos/upload',
          analytics: '/channel/' + ch + '/analytics/tab-overview/period-default',
          comments: '/channel/' + ch + '/comments/inbox',
          monetization: '/channel/' + ch + '/monetization'
        };
        if (!paths[sec]) return Promise.resolve({ ok: false, error: 'Sección desconocida: ' + sec + '. Válidas: dashboard, content, analytics, comments, monetization' });
        // Persistir conversación + flag para auto-continuar
        saveConv(true);
        setTimeout(function() { window.location.href = 'https://studio.youtube.com' + paths[sec]; }, 400);
        return Promise.resolve({ ok: true, navigatedTo: sec, note: 'Navegando a ' + sec + '. La página recarga; la conversación se conserva y vas a poder seguir.' });
      }
      return Promise.resolve({ ok: false, error: 'tool desconocida: ' + name });
    } catch(e) { return Promise.resolve({ ok: false, error: String(e && e.message || e) }); }
  }

  // ── System prompt ─────────────────────────────────────────────────────────────
  function systemPrompt() {
    return 'Sos ZERACK — el mentor de YouTube más letal del mundo, ahora DENTRO del YouTube Studio del usuario. Construiste y vendiste canales de 7 cifras. Tu única misión: convertir a esta persona en alguien que genera millones con YouTube, SÍ O SÍ. No sos un asistente — sos su socio estratégico exigente.\n\n'
      + 'CONTEXTO ACTUAL: el usuario está en "' + pageLabel(pageType()) + '"' + (videoId() ? ' (un video específico)' : '') + '.\n\n'
      + 'TENÉS CONTROL de Studio vía tools:\n'
      + '→ studioReadCurrentPage: lee analytics/datos REALES de la página actual. USALA SIEMPRE primero, nunca estimes a ojo.\n'
      + '→ studioNavigateTo(section): navega a dashboard/content/analytics/comments/monetization (recarga, la conversación se conserva).\n'
      + '→ studioGetVideosList: lista de videos del canal (estar en Contenido).\n'
      + '→ studioGetComments: lee comentarios (señal de engagement + ideas de contenido).\n'
      + '→ studioDeepAnalysis: reporte visual estructurado (cuando piden "analizá"/"reporte"/"diagnóstico").\n\n'
      + 'TU CONOCIMIENTO (aplicalo con los datos reales del usuario):\n'
      + 'PACKAGING decide 80%: título + thumbnail SON el producto. CTR <4% = el video muere. RETENCIÓN = el algoritmo: primeros 30s (hook) deciden todo, >50% retención = YouTube te empuja. CTR <2% pobre / 4-6% bueno / >6% excelente. Tráfico browse/home = empuje masivo (la meta). Monetización en capas: AdSense → sponsors ($15-50 CPM) → afiliados → producto propio (lo que hace millonario). RPM por nicho: finanzas $15-40, negocios $12-25, tech $8-15, historia/misterio $4-8.\n\n'
      + 'METODOLOGÍA (diagnóstico → prescripción): 1) leé DATOS REALES con las tools. 2) Encontrá el CUELLO DE BOTELLA (¿packaging? ¿retención? ¿nicho? ¿consistencia?). 3) Prescribí la acción de MAYOR impacto primero. 4) Terminá SIEMPRE con el PRÓXIMO PASO concreto ("Ahora hacé X"). Sos un mentor exigente: empujá a la acción, sé brutalmente honesto, conectá todo a DINERO.\n\n'
      + 'FORMATO: texto plano, SIN markdown (sin ** ## - ni "1."). Usá flechas "→" o "1)". MAYÚSCULAS para enfatizar. Específico con números reales, accionable, nunca genérico. Español.';
  }

  // ── AI call con tools (vía SW) ─────────────────────────────────────────────────
  function callAI(messages, withTools) {
    return new Promise(function(resolve, reject) {
      if (typeof chrome === 'undefined' || !chrome.runtime) { reject(new Error('chrome.runtime no disponible')); return; }
      var to = setTimeout(function() { reject(new Error('Timeout 90s — el provider AI no respondió')); }, 90000);
      var payload = { messages: messages, system: systemPrompt(), maxTokens: 2048 };
      if (withTools) payload.tools = studioToolDefs();
      chrome.runtime.sendMessage({ type: 'ASHLYV_CHAT_REQUEST', payload: payload }, function(res) {
        clearTimeout(to);
        var err = chrome.runtime && chrome.runtime.lastError;
        if (err) { reject(new Error(String(err.message || err))); return; }
        if (!res || res.ok !== true) { reject(new Error((res && (res.error || res.detail)) || 'AI error')); return; }
        resolve({ text: String(res.text || ''), functionCalls: res.functionCalls || [], provider: res.provider || 'ai' });
      });
    });
  }

  // ── Agent loop multi-turn ──────────────────────────────────────────────────────
  function agentTurn(userText, bodyEl) {
    if (S.pending) return;
    S.messages.push({ role: 'user', content: userText });
    renderMessages(bodyEl);
    saveConv();
    S.pending = true;
    setSending(true);

    function step(iter) {
      if (iter > MAX_ITERS) {
        S.messages.push({ role: 'assistant', content: '(alcancé el máximo de pasos. Preguntame de nuevo más específico.)' });
        S.pending = false; setSending(false); renderMessages(bodyEl); saveConv();
        return;
      }
      // Construye mensajes API (sólo role+content+functionCall/Response)
      var apiMsgs = S.messages.filter(function(m) { return m.role !== 'tool-status' && m.role !== 'error'; });
      callAI(apiMsgs, true).then(function(res) {
        if (res.functionCalls && res.functionCalls.length) {
          var fc = res.functionCalls[0];
          // muestra "ejecutando"
          S.messages.push({ role: 'tool-status', content: '⚙ ' + fc.name + (fc.args && Object.keys(fc.args).length ? ' (' + JSON.stringify(fc.args) + ')' : '') });
          renderMessages(bodyEl);
          studioExecTool(fc.name, fc.args).then(function(result) {
            // caso especial: deep analysis → render visual + termina turn
            if (result && result._deepAnalysis) {
              runDeepAnalysis(bodyEl);
              // registra en historial que se generó el reporte
              S.messages.push({ role: 'assistant', content: '(generé el reporte visual de análisis arriba ↑)', functionCall: fc });
              S.messages.push({ role: 'function', functionResponse: { name: fc.name, response: { ok: true, rendered: true } } });
              S.pending = false; setSending(false); saveConv();
              return;
            }
            // turno assistant con functionCall + functionResponse
            S.messages.push({ role: 'assistant', content: '', functionCall: fc });
            S.messages.push({ role: 'function', functionResponse: { name: fc.name, response: result } });
            saveConv();
            step(iter + 1);
          }).catch(function(err) {   // antes faltaba: si el tool rechazaba, el chat quedaba "..." colgado para siempre
            S.messages.push({ role: 'error', content: '❌ Falló la herramienta ' + fc.name + ': ' + (err && err.message || err) });
            S.pending = false; setSending(false); renderMessages(bodyEl); saveConv();
          });
        } else {
          // respuesta final de texto
          S.messages.push({ role: 'assistant', content: cleanMd(res.text) || '(respuesta vacía)', provider: res.provider });
          S.pending = false; setSending(false); renderMessages(bodyEl); saveConv();
        }
      }).catch(function(err) {
        var msg = String(err && err.message || err);
        if (/missing_or_invalid|no_provider|not_configured/i.test(msg)) msg = 'No hay provider AI configurado. Abrí Options → configurá Groq (gratis).';
        else if (/all_busy|rate|quota|RESOURCE_EXHAUSTED/i.test(msg)) msg = 'Tus providers están saturados un momento. Reintentá en ~15s (ZERACK ya intentó saltar entre Groq/Gemini). Tip: configurá AMBOS en Options para no quedarte sin turno.';
        else if (/all_providers_failed/i.test(msg)) msg = 'Ningún provider pudo responder. Verificá tu key de Groq/Gemini en Options con PROBAR CONEXIÓN.';
        S.messages.push({ role: 'error', content: '❌ ' + msg });
        S.pending = false; setSending(false); renderMessages(bodyEl); saveConv();
      });
    }
    step(0);
  }

  function cleanMd(t) {
    if (!t) return '';
    return String(t).replace(/^#{1,6}\s+/gm, '').replace(/\*\*\*(.+?)\*\*\*/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ── Deep analysis estructurado (reporte visual) ─────────────────────────────────
  function buildDeepPrompt(data) {
    var sys = 'Eres analista senior de agencia YouTube. Respondé SOLO JSON válido (sin markdown, sin ```). Esquema:\n'
      + '{"viralityScore":<0-100>,"scoreLabel":"<VIRAL POTENTIAL|SÓLIDO|NECESITA TRABAJO|BAJO RENDIMIENTO>","headline":"<1 línea max 90 chars>","metrics":[{"name":"CTR","value":"4.2%","verdict":"good|ok|bad","note":"<5-8 palabras>"}],"strengths":["<con número>"],"weaknesses":["<con número>"],"actions":[{"priority":"high|medium|low","action":"<específica>","impact":"<qué mejora>"}]}\n'
      + 'Benchmarks: CTR <2% pobre/4-6% bueno/>6% excelente. Retención <30% pobre/>50% bueno. 3-5 metrics, 2-4 strengths, 2-4 weaknesses, 3-5 actions. Solo números reales, no inventes.';
    var u = 'Página: ' + data.pageLabel + '.\n' + (data.videoTitle ? 'Video: "' + data.videoTitle + '"\n' : '') + '\n';
    if (data.metrics.length) u += 'MÉTRICAS:\n' + data.metrics.slice(0, 40).join('\n') + '\n\n';
    u += 'TEXTO CRUDO:\n' + data.text + '\n\nDevolvé SOLO el JSON.';
    return { sys: sys, u: u };
  }

  function runDeepAnalysis(bodyEl) {
    var data = readPage();
    if (!data.text || data.text.length < 50) {
      appendMsgBubble(bodyEl, 'assistant', '⚠ No hay suficientes datos en esta página. Andá a Analíticas de un video y reintentá.');
      return;
    }
    var holder = appendReportHolder(bodyEl);
    holder.textContent = '⚙ Generando reporte visual...';
    var pr = buildDeepPrompt(data);
    callAI([{ role: 'user', content: pr.u }], false).then(function(res) {
      // re-call with deep system prompt: usamos un mensaje system inline via user (el callAI usa systemPrompt() general)
      // Para forzar JSON usamos el prompt en el user message + parse robusto
      var report = parseJson(res.text);
      if (report && (report.viralityScore != null || report.strengths || report.actions)) {
        renderReport(holder, report, res.provider);
      } else {
        holder.textContent = cleanMd(res.text);
      }
    }).catch(function(err) {
      holder.textContent = '❌ ' + String(err && err.message || err);
    });
  }

  // Deep analysis necesita su propio system → hacemos call directo al SW con system custom
  function runDeepAnalysisDirect(bodyEl) {
    var data = readPage();
    var holder = appendReportHolder(bodyEl);
    holder.textContent = '⚙ Generando reporte visual...';
    var pr = buildDeepPrompt(data);
    // Guard: sin chrome.runtime (extensión recargada/contexto huérfano) NO dejar el holder colgado.
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) { holder.textContent = '❌ Extensión no disponible — recargá la página (F5).'; return; }
    var to = setTimeout(function() { holder.textContent = '❌ Timeout — reintentá.'; }, 90000);
    try {
    chrome.runtime.sendMessage({ type: 'ASHLYV_CHAT_REQUEST', payload: { messages: [{ role: 'user', content: pr.u }], system: pr.sys, maxTokens: 2048 } }, function(res) {
      clearTimeout(to);
      var err = chrome.runtime && chrome.runtime.lastError;
      if (err) { holder.textContent = '❌ ' + err.message; return; }
      if (!res || res.ok !== true) { holder.textContent = '❌ ' + ((res && (res.error || res.detail)) || 'error'); return; }
      var report = parseJson(res.text);
      if (report && (report.viralityScore != null || report.strengths || report.actions)) renderReport(holder, report, res.provider || 'ai');
      else holder.textContent = cleanMd(res.text || '(vacío)');
    });
    } catch (e) { clearTimeout(to); holder.textContent = '❌ ' + (e && e.message || e); }
  }

  function parseJson(text) {
    if (!text) return null;
    var t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a > -1 && b > a) t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch(e) { return null; }
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────────
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function scoreColor(s) { s = Number(s) || 0; return s >= 75 ? '#00DC82' : s >= 55 ? '#7FE3B5' : s >= 35 ? '#FFD93D' : '#FF6B6B'; }
  function verdictColor(v) { return ({ good: '#00DC82', ok: '#FFD93D', bad: '#FF6B6B' })[v] || 'rgba(255,255,255,0.5)'; }
  function verdictDot(v) { return ({ good: '🟢', ok: '🟡', bad: '🔴' })[v] || '⚪'; }
  function priMeta(p) { return ({ high: { l: 'ALTA', c: '#FF6B6B' }, medium: { l: 'MEDIA', c: '#FFD93D' }, low: { l: 'BAJA', c: '#7FE3B5' } })[p] || { l: 'MEDIA', c: '#FFD93D' }; }

  var _shadow = null, _bodyEl = null, _sendBtn = null, _input = null;

  function renderReport(holder, report, provider) {
    while (holder.firstChild) holder.removeChild(holder.firstChild);
    var score = Math.max(0, Math.min(100, Number(report.viralityScore) || 0)), col = scoreColor(score);
    var hero = el('div', 'nsp-hero');
    var g = el('div', 'nsp-gauge'); g.style.borderColor = col; g.style.color = col;
    g.appendChild(el('div', 'nsp-gauge-num', String(score))); g.appendChild(el('div', 'nsp-gauge-max', '/100'));
    var hr = el('div', 'nsp-hero-right');
    hr.appendChild(el('div', 'nsp-hero-tag', 'VIRALITY SCORE'));
    var sl = el('div', 'nsp-score-label', report.scoreLabel || '—'); sl.style.color = col; hr.appendChild(sl);
    hr.appendChild(el('div', 'nsp-headline', report.headline || ''));
    hero.appendChild(g); hero.appendChild(hr); holder.appendChild(hero);
    if (Array.isArray(report.metrics) && report.metrics.length) {
      var grid = el('div', 'nsp-metric-grid');
      report.metrics.slice(0, 6).forEach(function(m) {
        var c = el('div', 'nsp-metric-card'); c.style.borderColor = verdictColor(m.verdict) + '55';
        var top = el('div', 'nsp-metric-top');
        top.appendChild(el('span', 'nsp-metric-name', String(m.name || '').toUpperCase()));
        top.appendChild(el('span', 'nsp-metric-dot', verdictDot(m.verdict)));
        var v = el('div', 'nsp-metric-val', String(m.value || '—')); v.style.color = verdictColor(m.verdict);
        c.appendChild(top); c.appendChild(v);
        if (m.note) c.appendChild(el('div', 'nsp-metric-note', String(m.note)));
        grid.appendChild(c);
      });
      holder.appendChild(grid);
    }
    function sec(title, color, items, mark) {
      if (!Array.isArray(items) || !items.length) return;
      var s = el('div', 'nsp-section'); var h = el('div', 'nsp-sec-title'); h.style.color = color; h.textContent = title; s.appendChild(h);
      items.slice(0, 5).forEach(function(it) {
        var r = el('div', 'nsp-bullet'); var mk = el('span', 'nsp-bullet-mark', mark); mk.style.color = color; r.appendChild(mk);
        r.appendChild(el('span', 'nsp-bullet-txt', String(it))); s.appendChild(r);
      });
      holder.appendChild(s);
    }
    sec('✓ FORTALEZAS', '#00DC82', report.strengths, '→');
    sec('✗ DEBILIDADES', '#FF6B6B', report.weaknesses, '→');
    if (Array.isArray(report.actions) && report.actions.length) {
      var as = el('div', 'nsp-section'); var ah = el('div', 'nsp-sec-title'); ah.style.color = '#00DC82'; ah.textContent = '⚡ PLAN DE ACCIÓN'; as.appendChild(ah);
      var order = { high: 0, medium: 1, low: 2 };
      report.actions.slice(0, 6).sort(function(a, b) { return (order[a.priority] != null ? order[a.priority] : 1) - (order[b.priority] != null ? order[b.priority] : 1); }).forEach(function(a) {
        var pm = priMeta(a.priority); var c = el('div', 'nsp-action-card'); c.style.borderLeftColor = pm.c;
        var head = el('div', 'nsp-action-head'); var b = el('span', 'nsp-pri-badge', pm.l); b.style.background = pm.c; head.appendChild(b);
        head.appendChild(el('span', 'nsp-action-txt', String(a.action || ''))); c.appendChild(head);
        if (a.impact) c.appendChild(el('div', 'nsp-action-impact', '↳ ' + String(a.impact)));
        as.appendChild(c);
      });
      holder.appendChild(as);
    }
    var tag = el('div', 'nsp-report-tag', '✦ ' + String(provider || 'AI').toUpperCase() + ' · NSP Studio Analyst');
    holder.appendChild(tag);
    scrollBottom();
  }

  function appendReportHolder(bodyEl) {
    var wrap = el('div', 'nsp-msg nsp-report');
    bodyEl.appendChild(wrap); scrollBottom();
    return wrap;
  }
  function appendMsgBubble(bodyEl, role, text) {
    var b = el('div', 'nsp-msg ' + role, text); bodyEl.appendChild(b); scrollBottom(); return b;
  }
  function scrollBottom() { if (_bodyEl) _bodyEl.scrollTop = _bodyEl.scrollHeight; }
  function setSending(on) { if (_sendBtn) { _sendBtn.disabled = on; _sendBtn.textContent = on ? '...' : 'ENVIAR'; } }

  function renderMessages(bodyEl) {
    while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
    if (!S.messages.length) {
      var hint = el('div', 'nsp-empty');
      hint.appendChild(el('div', 'nsp-empty-t', '⚡ ZERACK · STUDIO'));
      hint.appendChild(el('div', 'nsp-empty-s', 'Te ayudo con todo tu canal. Ejemplos:'));
      ['Analizá este video y dame un reporte', '¿Qué video rinde mejor este mes?', 'Leé los comentarios y dame el sentiment', '¿Qué debería mejorar para crecer?', 'Comparame mis últimos videos'].forEach(function(ex) {
        var c = el('button', 'nsp-chip', ex);
        c.onclick = function() { if (_input) { _input.value = ex; _input.focus(); } };
        hint.appendChild(c);
      });
      bodyEl.appendChild(hint);
      return;
    }
    S.messages.forEach(function(m) {
      if (m.role === 'user') appendMsgBubble(bodyEl, 'user', m.content);
      else if (m.role === 'assistant' && m.content) appendMsgBubble(bodyEl, 'assistant', m.content);
      else if (m.role === 'tool-status') appendMsgBubble(bodyEl, 'tool', m.content);
      else if (m.role === 'error') appendMsgBubble(bodyEl, 'error', m.content);
    });
    scrollBottom();
  }

  // ── Persistencia de conversación ─────────────────────────────────────────────────
  function saveConv(navFlag) {
    try {
      var payload = { messages: S.messages.slice(-40), ts: Date.now() };
      if (navFlag) payload.resumeAfterNav = true;
      chrome.storage.local.set({ 'nsp_studio_conv': payload });
    } catch(e) {}
  }
  function loadConv(cb) {
    try {
      chrome.storage.local.get(['nsp_studio_conv'], function(r) {
        var c = r && r.nsp_studio_conv;
        if (c && Array.isArray(c.messages) && (Date.now() - (c.ts || 0) < 1800000)) { // 30 min
          S.messages = c.messages;
        }
        cb && cb(c && c.resumeAfterNav);
      });
    } catch(e) { cb && cb(false); }
  }

  // ── Panel ─────────────────────────────────────────────────────────────────────────
  function showPanel() {
    var existing = document.getElementById('nsp-studio-panel-host');
    if (existing) { existing.style.display = 'block'; S.panelOpen = true; return existing; }
    var host = document.createElement('div');
    host.id = 'nsp-studio-panel-host';
    host.style.cssText = 'all:initial;position:fixed;top:64px;right:24px;z-index:2147483647;width:460px;height:80vh;font-family:ui-monospace,monospace;';
    document.documentElement.appendChild(host);
    var shadow = host.attachShadow({ mode: 'open' });
    _shadow = shadow;
    var st = document.createElement('style');
    st.textContent = [
      ':host{ all:initial; } *{ box-sizing:border-box; }',
      '#p{ width:100%; height:100%; display:flex; flex-direction:column; background:#08070d; border:1px solid rgba(0,220,130,0.3); border-radius:18px; overflow:hidden; box-shadow:0 24px 80px rgba(0,0,0,0.9),0 0 60px rgba(0,220,130,0.12); color:#fff; font-family:ui-monospace,Menlo,monospace; opacity:0; transform:translateY(16px); animation:in 220ms ease forwards; }',
      '@keyframes in{ to{ opacity:1; transform:translateY(0); } }',
      '#h{ padding:14px 16px; background:linear-gradient(135deg,#0d2a1d,#0a1812 60%,#08070d); border-bottom:1px solid rgba(0,220,130,0.22); display:flex; align-items:flex-start; justify-content:space-between; cursor:move; flex-shrink:0; }',
      '#ht{ font-size:13px; font-weight:900; letter-spacing:0.14em; background:linear-gradient(90deg,#fff,#00DC82); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }',
      '#hs{ font-size:9px; color:rgba(0,220,130,0.9); margin-top:4px; letter-spacing:0.09em; font-weight:700; text-transform:uppercase; }',
      '#hbtns{ display:flex; gap:6px; align-items:center; }',
      '.hb{ background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); border-radius:7px; color:rgba(255,255,255,0.8); font-family:ui-monospace,monospace; font-size:9px; font-weight:900; padding:5px 8px; cursor:pointer; letter-spacing:0.06em; }',
      '.hb:hover{ background:rgba(255,255,255,0.13); color:#fff; }',
      '#x{ background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); border-radius:7px; width:26px; height:26px; color:rgba(255,255,255,0.7); font-size:15px; cursor:pointer; }',
      '#body{ flex:1; overflow-y:auto; padding:14px; background:#06050b; display:flex; flex-direction:column; gap:9px; }',
      '#body::-webkit-scrollbar{ width:7px; } #body::-webkit-scrollbar-thumb{ background:rgba(0,220,130,0.3); border-radius:4px; }',
      '.nsp-msg{ padding:10px 13px; border-radius:12px; font-size:12px; line-height:1.55; max-width:90%; word-wrap:break-word; white-space:pre-wrap; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }',
      '.nsp-msg.user{ background:rgba(0,220,130,0.18); border:1px solid rgba(0,220,130,0.35); align-self:flex-end; }',
      '.nsp-msg.assistant{ background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.10); align-self:flex-start; color:rgba(255,255,255,0.92); }',
      '.nsp-msg.tool{ background:rgba(0,220,130,0.07); border:1px solid rgba(0,220,130,0.22); align-self:flex-start; color:#7FE3B5; font-size:10px; font-family:ui-monospace,monospace; }',
      '.nsp-msg.error{ background:rgba(255,80,80,0.08); border:1px solid rgba(255,80,80,0.3); align-self:flex-start; color:#ff9090; }',
      '.nsp-msg.nsp-report{ max-width:100%; align-self:stretch; background:rgba(255,255,255,0.02); border:1px solid rgba(0,220,130,0.2); padding:14px; }',
      // Report styles
      '.nsp-hero{ display:flex; gap:14px; align-items:center; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.06); margin-bottom:13px; }',
      '.nsp-gauge{ width:76px; height:76px; border-radius:50%; border:4px solid; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 0 22px currentColor; }',
      '.nsp-gauge-num{ font-size:27px; font-weight:950; line-height:1; } .nsp-gauge-max{ font-size:9px; opacity:0.6; }',
      '.nsp-hero-right{ flex:1; min-width:0; } .nsp-hero-tag{ font-size:8.5px; letter-spacing:0.18em; color:rgba(255,255,255,0.4); font-weight:800; }',
      '.nsp-score-label{ font-size:16px; font-weight:950; margin:3px 0 5px; } .nsp-headline{ font-size:11px; line-height:1.5; color:rgba(255,255,255,0.82); font-family:-apple-system,sans-serif; }',
      '.nsp-metric-grid{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:7px; margin-bottom:14px; }',
      '.nsp-metric-card{ background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:9px; }',
      '.nsp-metric-top{ display:flex; align-items:center; justify-content:space-between; } .nsp-metric-name{ font-size:8px; letter-spacing:0.07em; color:rgba(255,255,255,0.5); font-weight:800; } .nsp-metric-dot{ font-size:9px; }',
      '.nsp-metric-val{ font-size:18px; font-weight:950; margin-top:5px; line-height:1; } .nsp-metric-note{ font-size:8px; color:rgba(255,255,255,0.45); margin-top:4px; line-height:1.3; }',
      '.nsp-section{ margin-bottom:14px; } .nsp-sec-title{ font-size:11px; font-weight:950; letter-spacing:0.1em; margin-bottom:8px; }',
      '.nsp-bullet{ display:flex; gap:7px; padding:4px 0; align-items:flex-start; } .nsp-bullet-mark{ font-weight:900; flex-shrink:0; }',
      '.nsp-bullet-txt{ font-size:11px; line-height:1.5; color:rgba(255,255,255,0.85); font-family:-apple-system,sans-serif; }',
      '.nsp-action-card{ background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-left:3px solid; border-radius:8px; padding:9px 10px; margin-bottom:7px; }',
      '.nsp-action-head{ display:flex; gap:8px; align-items:flex-start; } .nsp-pri-badge{ font-size:7.5px; font-weight:950; color:#000; padding:3px 6px; border-radius:5px; flex-shrink:0; margin-top:1px; }',
      '.nsp-action-txt{ font-size:11px; line-height:1.4; font-weight:600; font-family:-apple-system,sans-serif; } .nsp-action-impact{ font-size:9.5px; color:rgba(0,220,130,0.85); margin-top:5px; font-family:-apple-system,sans-serif; }',
      '.nsp-report-tag{ margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.07); font-size:8.5px; color:rgba(255,255,255,0.4); }',
      // Empty / chips
      '.nsp-empty{ padding:20px 8px; text-align:center; } .nsp-empty-t{ font-size:14px; font-weight:900; margin-bottom:5px; } .nsp-empty-s{ font-size:10.5px; color:rgba(255,255,255,0.55); margin-bottom:12px; }',
      '.nsp-chip{ display:block; width:100%; padding:9px 11px; margin:5px 0; background:rgba(0,220,130,0.08); border:1px solid rgba(0,220,130,0.25); border-radius:9px; color:rgba(255,255,255,0.88); font-size:11px; cursor:pointer; font-family:-apple-system,sans-serif; text-align:left; transition:background .15s; }',
      '.nsp-chip:hover{ background:rgba(0,220,130,0.18); }',
      // Input
      '#inwrap{ padding:11px 12px; border-top:1px solid rgba(255,255,255,0.08); background:#08070d; display:flex; gap:8px; align-items:flex-end; flex-shrink:0; }',
      '#in{ flex:1; min-height:38px; max-height:120px; padding:10px; border-radius:9px; background:rgba(255,255,255,0.05); border:1px solid rgba(0,220,130,0.28); color:#fff; font-family:-apple-system,sans-serif; font-size:12px; resize:none; outline:none; }',
      '#in:focus{ border-color:rgba(0,220,130,0.6); }',
      '#send{ padding:10px 15px; border-radius:9px; border:none; background:linear-gradient(135deg,#00DC82,#00b86b); color:#04140d; font-family:ui-monospace,monospace; font-size:10px; font-weight:900; cursor:pointer; letter-spacing:0.08em; } #send:disabled{ opacity:0.4; }'
    ].join('\n');
    shadow.appendChild(st);

    var p = el('div'); p.id = 'p';
    var h = el('div'); h.id = 'h';
    var hl = el('div');
    hl.appendChild(function(){ var t = el('div'); t.id = 'ht'; t.textContent = '⚡ ZERACK · STUDIO'; return t; }());
    var hs = el('div'); hs.id = 'hs'; hs.textContent = pageLabel(pageType());
    hl.appendChild(hs);
    var hbtns = el('div'); hbtns.id = 'hbtns';
    var newBtn = el('button', 'hb', '+ NUEVO');
    newBtn.onclick = function() { S.messages = []; saveConv(); renderMessages(_bodyEl); };
    var x = el('button'); x.id = 'x'; x.textContent = '×';
    x.onclick = function() { host.style.display = 'none'; S.panelOpen = false; };
    hbtns.appendChild(newBtn); hbtns.appendChild(x);
    h.appendChild(hl); h.appendChild(hbtns); p.appendChild(h);

    var body = el('div'); body.id = 'body'; _bodyEl = body; p.appendChild(body);

    var inwrap = el('div'); inwrap.id = 'inwrap';
    var input = document.createElement('textarea'); input.id = 'in'; input.placeholder = 'Preguntá sobre tu canal, video, comentarios...'; input.rows = 1; _input = input;
    var send = el('button'); send.id = 'send'; send.textContent = 'ENVIAR'; _sendBtn = send;
    function doSend() { var v = (input.value || '').trim(); if (!v || S.pending) return; input.value = ''; input.style.height = 'auto'; agentTurn(v, body); }
    send.onclick = doSend;
    input.onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } };
    input.oninput = function() { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; };
    inwrap.appendChild(input); inwrap.appendChild(send); p.appendChild(inwrap);

    shadow.appendChild(p);
    S.panelOpen = true;

    (function() { var d = false, sx = 0, sy = 0, ox = 0, oy = 0;
      h.addEventListener('mousedown', function(e) { d = true; sx = e.clientX; sy = e.clientY; var r = host.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
      document.addEventListener('mousemove', function(e) { if (!d) return; host.style.left = (ox + e.clientX - sx) + 'px'; host.style.top = (oy + e.clientY - sy) + 'px'; host.style.right = 'auto'; });
      document.addEventListener('mouseup', function() { d = false; });
    })();

    renderMessages(body);
    setTimeout(function() { input.focus(); }, 60);
    return host;
  }

  // Patch: usar runDeepAnalysisDirect (con system propio) en vez del runDeepAnalysis general
  runDeepAnalysis = runDeepAnalysisDirect;

  // ════════════════════════════════════════════════════════════════════════════
  // v3.21.0 — PREDICTOR DE VIRALIDAD (título) + ANALIZADOR DE MINIATURA (CTR)
  // EN EL MOMENTO DE SUBIR: botones inyectados al lado del TÍTULO y de la MINIATURA
  // en la página de subir/editar video de Studio. Sin chat, análisis directo.
  // ════════════════════════════════════════════════════════════════════════════
  // Cada nicho: rpm, label, `q` (query EN para buscar ganadores reales en YouTube) y `re`.
  var ZNICHE_RPM = [
    { rpm: 22, label: 'Finanzas',           q: 'how to make money investing finance explained',
      re: /finance|invest|trading|crypto|bitcoin|ethereum|stock.?market|forex|wealth|retire|dividend|hedge.?fund|portfolio|inversion|invertir|bolsa|acciones|finanzas|dinero|riqueza|presupuesto|ahorr|deuda|hipoteca|impuesto|contabilidad|money|millionair|million|mill[oó]n|millones|d[oó]lar|d[oó]lares|\busd\b|euros?|ingresos?|rico|fortuna|patrimonio|rentab/i },
    { rpm: 16, label: 'Negocios',           q: 'how to start a business and make money online',
      re: /business|entrepreneur|startup|marketing|saas|ecommerce|e-commerce|dropshipping|amazon.?fba|passive.?income|make.?money|side.?hustle|negocio|emprend|ingresos.?pasivos|ganar.?dinero|vender|ventas?|freelanc|agencia|clientes?|monetiz|escalar|facturar/i },
    { rpm: 13, label: 'IA y Automatizacion',q: 'best ai tools tutorial how to use',
      re: /artificial.?intelligence|machine.?learning|chat.?gpt|openai|claude|anthropic|gemini|copilot|midjourney|stable.?diffusion|dall.?e|\bgrok\b|perplexity|deepseek|llama|\bllm\b|no.?code|prompts?|inteligencia.?artificial|\bia\b|\bai\b|automatiz|agente.?ia|agentes|faceless|generativ/i },
    { rpm: 10, label: 'Tecnologia',         q: 'tech explained review tutorial',
      re: /software|coding|programming|developer|web.?dev|react|python|javascript|tech.?review|cybersecurity|cloud|programacion|codigo|tecnologia|hacke|ciberseguridad|linux|gadget/i },
    { rpm: 9,  label: 'Fotografia',         q: 'photography filmmaking tips',
      re: /camera|photography|photo|filmmaking|cinemat|canon|sony|nikon|drone|fotografia|camara|fotografo|lightroom|premiere|capcut|edicion.?de.?video/i },
    { rpm: 8,  label: 'Bienes Raices',      q: 'real estate investing explained',
      re: /real.?estate|bienes.?raices|inmueble|propiedad|alquiler|renta|departamento|construccion|arquitectura/i },
    { rpm: 7,  label: 'Hogar y DIY',        q: 'home diy repair how to',
      re: /hvac|house|home|plumbing|electrical|repair|install|kitchen|bathroom|hogar|casa|reparacion|bricolaje/i },
    { rpm: 7,  label: 'Salud y Fitness',    q: 'health fitness workout science',
      re: /health|fitness|workout|diet|nutrition|weight.?loss|yoga|meditation|mental.?health|salud|ejercicio|dieta|nutricion|\bgym\b|bienestar|medicina|adelgazar/i },
    { rpm: 6,  label: 'Supervivencia',      q: 'survival skills wilderness documentary',
      re: /survival|prepper|wilderness|emergency|off.?grid|camping|supervivencia|preparacion|emergencia|campamento/i },
    { rpm: 6,  label: 'Historia',           q: 'history documentary explained',
      re: /history|historical|ancient|medieval|war|empire|civilization|dynasty|pharaoh|roman|greek|viking|unsolved|historia|antiguo|guerra|imperio|civilizacion|misterio|faraon|romano|griego|vikingo|arqueolog/i },
    { rpm: 6,  label: 'Ciencia',            q: 'science space documentary explained',
      re: /science|physics|biology|chemistry|astronomy|space|universe|quantum|engineering|ciencia|fisica|biologia|quimica|astronomia|espacio|universo|planeta|nasa|cosmolog/i },
    { rpm: 5,  label: 'Naturaleza',         q: 'nature wildlife 4k documentary',
      re: /nature|wildlife|ocean|forest|mountain|animal|naturaleza|animales|oceano|bosque|montana|fauna|vida.?salvaje|selva|desierto|paisaje/i },
    { rpm: 5,  label: 'Psicologia',         q: 'stoicism psychology motivation mindset',
      re: /psychology|philosophy|stoic|stoicism|mindset|motivation|success|productivity|psicologia|filosofia|estoicismo|mentalidad|motivacion|exito|habito|autoayuda|self.?help|disciplina/i },
    { rpm: 5,  label: 'Religion e Historia',q: 'bible story explained',
      re: /religion|religión|jes[uú]s|cristo|dios|biblia|b[ií]blic|angel|[aá]ngel|infierno|cielo|teolog|or[aá]ci[oó]n/i },
    { rpm: 5,  label: 'Viajes',             q: 'travel destination guide',
      re: /travel|destination|explore|trip|backpack|viaje|destino|explorar|\bpais\b|ciudad|turismo|aventura/i },
    { rpm: 4,  label: 'Cocina',             q: 'easy recipe cooking',
      re: /cooking|recipe|food|kitchen|meal|baking|chef|cocina|receta|comida|gastronomia|cocinar|postre/i },
    { rpm: 4,  label: 'Misterio Oscuro',    q: 'unsolved mystery scary documentary',
      re: /true.?crime|paranormal|supernatural|horror|\bdark\b|creepy|scary|conspiracy|crimen.?real|sobrenatural|terror|espeluznante|ocultismo|leyenda.?urbana|extraterrestre|\bovni\b|alien/i },
    { rpm: 4,  label: 'ASMR y Relax',       q: 'relaxing ambient sleep sounds',
      re: /asmr|relax|sleep|rain|ambient|soundscape|white.?noise|binaural|lofi|dormir|relajar|lluvia|ruido.?blanco/i },
    { rpm: 3,  label: 'Gaming',             q: 'gameplay walkthrough gaming',
      re: /gaming|gameplay|walkthrough|minecraft|roblox|fortnite|\bgta\b|esport|juego|videojuego|trucos/i },
    { rpm: 5,  label: 'Historias / Drama',  q: 'true story life rags to riches narrated',
      re: /\bstory\b|stories|storytime|true.?story|based.?on.?a.?true|biograf|rags.?to.?riches|tellerw[äa]scher|million[äa]r|lebensgeschichte|\bleben\b|\bvida\b|\bvie\b|the (man|woman|boy|girl|kid|child) who|el (hombre|ni[ñn]o|chico) que|la (mujer|ni[ñn]a|chica) que|der (mann|junge) der|what happened to|qu[eé] (le )?pas[oó]|de pobre a|from rags|vom .{0,24} zum|de la nada|de cero a|von null/i },
    { rpm: 2,  label: 'Entretenimiento',    q: 'viral challenge reaction',
      re: /vlog|challenge|prank|reaction|meme|funny|reto|reaccion/i }
  ];

  // Detecta el IDIOMA del título (de/es/fr/pt/en) → sugerencias en ese idioma + corpus localizado + léxico justo.
  function zDetectLang(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    function cnt(re) { var m = t.match(re); return m ? m.length : 0; }
    var sc = { de: 0, es: 0, fr: 0, pt: 0, en: 0 };
    if (/[äöüß]/.test(t)) sc.de += 4;
    sc.de += 2 * cnt(/\b(der|die|das|und|den|dem|vom|zum|zur|auf|aus|für|mit|dein|mein|sein|wie|warum|nicht|kein|eine?|du|ich|wir|leben|jeder|jede|geschichte|million[äa]r|reich|geld|jahre?|welt|mann|frau|krieg|gegen|wurde|hat)\b/g);
    if (/ñ|¿|¡/.test(t)) sc.es += 4;
    sc.es += 2 * cnt(/\b(cómo|qué|por|para|con|sin|los|las|una|uno|del|más|años|dinero|ganar|vida|hombre|mujer|niño|guerra|mundo|historia|porque|cuando|este|esta|hasta|desde)\b/g);
    if (/[àâçèêëîïôûœ]/.test(t)) sc.fr += 3;
    sc.fr += 2 * cnt(/\b(le|la|les|un|une|des|comment|pourquoi|votre|avec|sans|pour|argent|vie|histoire|guerre|monde|homme|femme|enfant|ans|plus|dans|cette)\b/g);
    if (/[ãõ]/.test(t)) sc.pt += 4;
    sc.pt += 2 * cnt(/\b(você|voce|não|nao|porque|dinheiro|vida|história|guerra|mundo|homem|mulher|anos|mais|como|para|uma|seu|sua|isso)\b/g);
    sc.en += 2 * cnt(/\b(the|how|why|what|who|of|to|with|your|best|make|money|life|story|world|man|woman|war|years|this|from|about)\b/g);
    var best = 'en', bv = 0; ['de', 'es', 'fr', 'pt', 'en'].forEach(function (k) { if (sc[k] > bv) { bv = sc[k]; best = k; } });
    return bv === 0 ? 'en' : best;
  }
  // gl/hl para buscar ganadores en el mercado del idioma del título (corpus localizado).
  var ZLANG_GEO = { de: { gl: 'DE', hl: 'de' }, es: { gl: 'ES', hl: 'es' }, fr: { gl: 'FR', hl: 'fr' }, pt: { gl: 'BR', hl: 'pt' }, en: { gl: 'US', hl: 'en' } };

  // Scoring: cuenta cuántas señales del nicho aparecen y elige el de MÁS hits.
  // Empate → gana el de mayor RPM (el array está ordenado por RPM desc).
  // Esto evita el bug "todo es General": "ganar un millón de USD con Claude" ahora
  // dispara Finanzas (millón/USD) e IA (Claude) y se queda con el de más señales.
  function zDetectNiche(text) {
    var t = String(text || '').toLowerCase();
    var best = null, bestHits = 0;
    for (var i = 0; i < ZNICHE_RPM.length; i++) {
      var m = t.match(new RegExp(ZNICHE_RPM[i].re.source, 'gi'));
      // Cuenta señales DISTINTAS (no repeticiones) para no premiar regex con muchas
      // alternativas comunes. Empate → gana el de mayor RPM (array ordenado desc).
      var uniq = {}; if (m) for (var k = 0; k < m.length; k++) uniq[m[k].toLowerCase()] = 1;
      var hits = m ? Object.keys(uniq).length : 0;
      if (hits > bestHits) { bestHits = hits; best = ZNICHE_RPM[i]; }
    }
    if (best) return { label: best.label, rpm: best.rpm, q: best.q, hits: bestHits };
    return { label: 'General', rpm: 3, q: '', hits: 0 };
  }

  function zPredictLocalTitle(title, nicheHint) {
    title = String(title || '').trim();
    var t = title.toLowerCase();
    var s = 0, signals = [];
    if (/\b\d+\b/.test(t)) { s += 8; signals.push('número/lista (+8)'); }
    if (/\b(top|mejores|peores|biggest|craziest|worst|best)\b/.test(t)) { s += 6; signals.push('ranking (+6)'); }
    if (/\b(why|por qué|porque|how|cómo|what happened|qué pasó|secret|secreto|truth|verdad|nobody|nadie|reason|razón)\b/.test(t)) { s += 9; signals.push('curiosidad (+9)'); }
    if (/\b(shocking|insane|increíble|unbelievable|no vas a creer|won'?t believe|dark|oscuro|forbidden|prohibido|disturbing|terrifying|aterrador)\b/.test(t)) { s += 8; signals.push('emoción fuerte (+8)'); }
    if (/\b(exposed|revealed|revelado|expuesto|finally|por fin|ultimate|definitiv|never|nunca|always|siempre)\b/.test(t)) { s += 5; signals.push('power words (+5)'); }
    if (/\b(mystery|misterio|unsolved|sin resolver|conspiracy|conspiración|hidden|oculto|lost|perdido|ancient|antiguo|banned|censored)\b/.test(t)) { s += 7; signals.push('intriga (+7)'); }
    var len = title.length;
    if (len >= 35 && len <= 70) { s += 6; signals.push('longitud óptima (+6)'); }
    else if (len < 20) { s -= 4; signals.push('muy corto (-4)'); }
    else if (len > 95) { s -= 3; signals.push('muy largo (-3)'); }
    s = Math.max(0, Math.min(45, s));
    var niche = zDetectNiche((nicheHint || '') + ' ' + title);
    var rpmScore = Math.min(30, Math.round((niche.rpm / 22) * 30));
    return {
      title: title, niche: niche.label, nicheRpm: niche.rpm,
      breakdown: {
        titulo: { score: s, max: 45, signals: signals },
        nicho: { label: niche.label, rpm: niche.rpm, score: rpmScore, max: 30 }
      }
    };
  }

  function zCompareWinners(title, winners) {
    var t = String(title || '').toLowerCase();
    var gaps = [];
    if (!winners || !winners.length) return { gaps: [], winnerAvgLen: 0 };
    var withNum = 0, withCur = 0, totalLen = 0;
    var curRe = /\b(why|por qué|how|cómo|secret|secreto|truth|verdad|nobody|nadie|what happened|qué pasó|never|nunca)\b/i;
    winners.forEach(function(w) { var wt = String(w.t || ''); if (/\d/.test(wt)) withNum++; if (curRe.test(wt)) withCur++; totalLen += wt.length; });
    var n = winners.length, pctNum = withNum / n, pctCur = withCur / n, avgLen = Math.round(totalLen / n);
    if (pctNum >= 0.4 && !/\d/.test(t)) gaps.push('El ' + Math.round(pctNum * 100) + '% de los ganadores usa NÚMEROS — el tuyo no. Agregá uno (ej "7", "Top 10").');
    if (pctCur >= 0.4 && !curRe.test(t)) gaps.push('El ' + Math.round(pctCur * 100) + '% usa gancho de curiosidad (por qué/cómo/secreto) — el tuyo no.');
    if (title.length < avgLen - 20) gaps.push('Tu título es más corto (' + title.length + ') que el promedio ganador (' + avgLen + '). Dale más intriga.');
    if (title.length > avgLen + 30) gaps.push('Tu título es más largo (' + title.length + ') que el promedio ganador (' + avgLen + '). Cortalo, lo importante adelante.');
    return { gaps: gaps, winnerAvgLen: avgLen };
  }

  // Genera TÍTULOS SUGERIDOS a partir del tema del usuario + fórmulas ganadoras del nicho.
  // Extrae el núcleo del tema, la entidad propia (ej "Claude") y el monto ($), y arma
  // variaciones con números, gancho de curiosidad, power words y transformación.
  function zSuggestTitles(title, niche) {
    var raw = String(title || '').trim();
    if (!raw) return [];
    var lo = raw.toLowerCase();
    var lang = zDetectLang(raw);   // de/es/fr/pt/en → sugiere en el MISMO idioma del título (antes solo es/en)
    // Entidad propia tipo "Claude" (Mixed-case, no acrónimos tipo USD, no la 1ª palabra)
    // Antes exigía raw.indexOf(w) > 1, lo que DESCARTABA la entidad cuando iba al inicio
    // (caso típico "Claude: ..."). Ahora solo filtra palabras vacías/interrogativas.
    var mixed = (raw.match(/\b[A-ZÁÉÍÓÚ][a-záéíóú][\wáéíóúñ]*\b/g) || []).filter(function(w) {
      return !/^(c[oó]mo|como|qu[eé]|por|porque|how|why|what|the|el|la|los|las|un|una|este|esta)$/i.test(w);
    });
    var entity = mixed.length ? mixed[0] : '';
    // Monto de dinero (con dígito) o "millón" como fallback
    var moneyM = raw.match(/\$\s?\d[\d.,]*\s?(k|m|mil|millones|mill[oó]n|million)?|\d[\d.,]*\s?(d[oó]lares|usd|euros)/i);
    var money = moneyM ? moneyM[0].trim() : (/(mill[oó]n|million)/i.test(lo) ? '$1.000.000' : '');
    // Núcleo del tema: quita signos e interrogativos iniciales
    var core = raw.replace(/[¿?¡!]/g, '').replace(/^\s*(c[oó]mo|como|por\s?qu[eé]|porque|qu[eé]|how\s?to|how|why|what)\s+/i, '').trim();
    if (core.length < 3) core = raw.replace(/[¿?¡!]/g, '').trim();
    var coreLo = core.charAt(0).toLowerCase() + core.slice(1);
    var out = [], ent = entity ? entity + ': ' : '';
    if (lang === 'es') {
      out.push('Cómo ' + coreLo + ' — paso a paso (2026)', '7 formas de ' + coreLo, 'La verdad sobre ' + coreLo + ' que NADIE te dice', ent + 'el método que ' + (money ? 'me hizo ' + money : 'sí funciona') + ' (real)', 'Por qué ' + coreLo + ' lo cambia TODO');
      if (money) out.push('De $0 a ' + money + (entity ? ' con ' + entity : '') + ' — el método exacto');
    } else if (lang === 'de') {
      out.push('Wie ' + coreLo + ' — Schritt für Schritt (2026)', '7 Wege, um ' + coreLo, 'Die Wahrheit über ' + coreLo + ', die NIEMAND sagt', ent + 'die Methode, die ' + (money ? 'mir ' + money + ' brachte' : 'wirklich funktioniert'), 'Warum ' + coreLo + ' ALLES verändert');
      if (money) out.push('Von 0 auf ' + money + (entity ? ' mit ' + entity : '') + ' — die genaue Methode');
    } else if (lang === 'fr') {
      out.push('Comment ' + coreLo + ' — étape par étape (2026)', '7 façons de ' + coreLo, 'La vérité sur ' + coreLo + ' que PERSONNE ne dit', ent + 'la méthode qui ' + (money ? 'm\'a rapporté ' + money : 'marche vraiment'), 'Pourquoi ' + coreLo + ' change TOUT');
      if (money) out.push('De 0 à ' + money + (entity ? ' avec ' + entity : '') + ' — la méthode exacte');
    } else if (lang === 'pt') {
      out.push('Como ' + coreLo + ' — passo a passo (2026)', '7 formas de ' + coreLo, 'A verdade sobre ' + coreLo + ' que NINGUÉM conta', ent + 'o método que ' + (money ? 'me deu ' + money : 'realmente funciona'), 'Por que ' + coreLo + ' muda TUDO');
      if (money) out.push('De 0 a ' + money + (entity ? ' com ' + entity : '') + ' — o método exato');
    } else {
      out.push('How to ' + coreLo + ' — step by step (2026)', '7 ways to ' + coreLo, 'The truth about ' + coreLo + ' nobody tells you', ent + 'the method that ' + (money ? 'made me ' + money : 'actually works'), 'Why ' + coreLo + ' changes everything');
      if (money) out.push('From $0 to ' + money + (entity ? ' with ' + entity : '') + ' — exact method');
    }
    var seen = {}, clean = [];
    out.forEach(function(s) {
      s = s.replace(/\s+/g, ' ').trim();
      s = s.charAt(0).toUpperCase() + s.slice(1);
      var k = s.toLowerCase();
      if (s.length >= 12 && s.length <= 100 && k !== lo && !seen[k]) { seen[k] = 1; clean.push(s); }
    });
    return clean.slice(0, 6);
  }

  // Lee el corpus de mercado (chrome.storage, accesible directo en mundo ISOLATED)
  function zReadCorpus(nicheLabel, limit) {
    return new Promise(function(resolve) {
      var done = false;
      function finish(res) { if (done) return; done = true; resolve(res); }
      var empty = { winners: [], nicheTotal: 0, corpusTotal: 0 };
      // Guard: sin chrome.storage (contexto inválido) NO colgar el botón PREDECIR.
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) { finish(empty); return; }
      // Timeout: si el callback de storage nunca llega (extensión recargada), resolvemos vacío.
      var to = setTimeout(function() { finish(empty); }, 5000);
      try {
        chrome.storage.local.get('nsp_title_corpus', function(r) {
          clearTimeout(to);
          var all = (r && Array.isArray(r.nsp_title_corpus)) ? r.nsp_title_corpus : [];
          var matches = all.filter(function(x) { return x && x.n === nicheLabel; });
          matches.sort(function(a, b) { return (b.v || 0) - (a.v || 0); });
          finish({ winners: matches.slice(0, limit || 20), nicheTotal: matches.length, corpusTotal: all.length });
        });
      } catch (e) { clearTimeout(to); finish(empty); }
    });
  }

  // Búsqueda activa en YouTube (vía SW InnerTube) cuando el corpus del nicho está flaco
  function zSearchMarket(query, geo) {
    geo = geo || { gl: 'US', hl: 'en' };
    return new Promise(function(resolve) {
      try {
        var to = setTimeout(function() { resolve([]); }, 12000);
        chrome.runtime.sendMessage({ type: 'NSP_AGENT_SEARCH_MARKET', query: String(query || '').slice(0, 120), gl: geo.gl, hl: geo.hl }, function(res) {
          clearTimeout(to);
          if ((chrome.runtime && chrome.runtime.lastError) || !res || !res.ok) { resolve([]); return; }
          resolve(res.videos || []);
        });
      } catch (e) { resolve([]); }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // zTitleEngine — scoring de títulos: SIMILITUD LÉXICA (TF-IDF+coseno, pond. VPH) +
  // estructura del HOOK + PERCENTIL calibrado vs el corpus del nicho. Puro JS, sin libs.
  // ════════════════════════════════════════════════════════════════════════════
  var zTitleEngine = (function () {
    var MIN_N = 25;  // <25 ganadores → sin percentil ni léxico fuerte (baja confianza)
    var RE = {
      curio: { es: /\b(por\s?qu[eé]|c[oó]mo|qu[eé]|qui[eé]n|cu[aá]l|cu[aá]ndo|secreto|verdad|nadie|raz[oó]n|pas[oó]|nunca)\b/i,
               en: /\b(why|how|what|who|which|when|did|secret|truth|nobody|reason|never|happened)\b/i,
               de: /\b(warum|wieso|weshalb|wie|was|wer|welche|wann|geheimnis|wahrheit|niemand|grund|nie|niemals|passiert(e)?)\b/i,
               fr: /\b(pourquoi|comment|quoi|qui|quel|quelle|quand|secret|v[ée]rit[ée]|personne|jamais|raison|arriv[ée])\b/i,
               pt: /\b(por\s?que|porque|como|que|quem|qual|quando|segredo|verdade|ningu[ée]m|nunca|raz[ãa]o|aconteceu)\b/i },
      power: { es: /\b(incre[ií]ble|impactante|prohibid|oscur|aterrador|brutal|jam[aá]s|definitiv|revelad|expuest|por\s?fin|[uú]ltim|peor|mejor)\b/i,
               en: /\b(shocking|insane|forbidden|dark|terrifying|brutal|ultimate|revealed|exposed|finally|worst|best|craziest|biggest)\b/i,
               de: /\b(schockierend|unglaublich|verboten|dunkel|dunkle|erschreckend|brutal|endlich|schlimmste|beste|gr[öo][ßs]te|geheim|verr[üu]ckt|krass|niemals)\b/i,
               fr: /\b(choquant|incroyable|interdit|sombre|terrifiant|brutal|enfin|pire|meilleur|secret|fou|jamais|ultime)\b/i,
               pt: /\b(chocante|incr[ií]vel|proibido|sombrio|aterrorizante|brutal|finalmente|pior|melhor|segredo|louco|jamais)\b/i },
      survive: { es: /\b(c[oó]mo|por\s?qu[eé])\b[\s\S]*\b(logr|sobrevivi|consigui|pudo|hizo|venci|termin)\w*/i,
                 en: /\b(how|why)\b[\s\S]*\b(did|does|could|can|do)\b[\s\S]*\b(surviv|becom|beat|escap|win|won|made|happen)\w*/i,
                 de: /\b(wie|warum)\b[\s\S]*\b([üu]berlebt|wurde|schaffte|besiegt|gewann|gelang|geschafft|schaffte)\w*/i,
                 fr: /\b(comment|pourquoi)\b[\s\S]*\b(surv[ée]cu|devenu|battu|gagn[ée]|r[ée]ussi)\w*/i,
                 pt: /\b(como|por\s?que)\b[\s\S]*\b(sobreviveu|tornou|venceu|ganhou|conseguiu)\w*/i }
    };
    function pick(map, lang) { return map[lang] || map.en; }
    // ── Núcleo TF-IDF → lib compartida lib/nsp-text.js (el manifest la carga ANTES
    // en este mismo bloque). MISMA implementación, salida verificada byte-idéntica.
    // buildIdf ahora recibe LISTAS DE TOKENS (ver call-site en analyze()).
    // Si la lib no cargó, analyze() lanza y zRunTitlePrediction cae a su motor
    // fallback existente (try/catch propio) — sin romper el resto de Studio.
    var _NT = (typeof NSPText !== 'undefined' && NSPText) || null;
    function _noLib() { throw new Error('NSPText (lib/nsp-text.js) no cargada — revisa el orden del manifest'); }
    var tokenize = _NT ? _NT.tokenize : _noLib;
    var buildIdf = _NT ? _NT.buildIdf : _noLib;
    var tfidf = _NT ? _NT.tfidf : _noLib;
    var norm = _NT ? _NT.norm : _noLib;
    var cosine = _NT ? _NT.cosineSimilarity : _noLib;
    function weightOf(rec) {  // ajuste #5: nunca 0/undefined
      var v = Number(rec && rec.v); if (isFinite(v) && v > 0) return v;
      var w = Number(rec && rec.w); if (isFinite(w) && w > 0) return Math.max(1, w / 720);
      return 1;
    }
    var lexAgg = _NT ? _NT.weightedCosineAgg : _noLib;  // coseno pond. por VPH; exclude = leave-one-out (#2) — lib compartida
    function hookScore(title, lang) {
      var t = String(title || ''), lo = t.toLowerCase(), len = t.length;
      function mk(hit, max) { return { hit: !!hit, pts: hit ? max : 0, max: max }; }
      var parts = { number: mk(/\b\d+\b/.test(lo), 18), brackets: mk(/[\[\]\(\)\|►▶]/.test(t), 10), pattern: mk(pick(RE.survive, lang).test(lo), 16), length: mk(len >= 30 && len <= 70, 14), curiosity: mk(pick(RE.curio, lang).test(lo), 24), power: mk(pick(RE.power, lang).test(lo), 18) };
      var got = 0, max = 0, weak = [], k;
      for (k in parts) { got += parts[k].pts; max += parts[k].max; if (!parts[k].hit) weak.push(k); }
      return { score: Math.round(got / max * 100), parts: parts, weak: weak };
    }
    function blend(lex01, hook100, low) {  // ajuste #1: MISMO blend p/ título nuevo y ganadores
      var lex100 = lex01 * 100;
      return low ? Math.round(0.85 * hook100 + 0.15 * lex100) : Math.round(0.55 * lex100 + 0.45 * hook100);
    }
    var percentileOf = _NT ? _NT.percentileOf : _noLib;  // percentil 1-99 vs distribución — lib compartida
    function guessCorpusLang(winners) {
      var es = 0, en = 0, i, s;
      for (i = 0; i < Math.min(winners.length, 80); i++) { s = ' ' + String(winners[i].t || '').toLowerCase() + ' '; if (/[áéíóúñ¿¡]|\b(de|la|el|que|c[oó]mo|por|los|las|un|una|con|para)\b/.test(s)) es++; if (/\b(the|how|why|what|of|to|in|is|your|did|this|best)\b/.test(s)) en++; }
      return es > en ? 'es' : 'en';
    }
    function coreTopic(title) { var s = String(title || '').replace(/[¿?¡!]/g, '').trim(); s = s.replace(/^\s*(c[oó]mo|como|por\s?qu[eé]|porque|qu[eé]|how\s?to|how|why|what|the|el|la|los|las)\s+/i, ''); return s.trim() || String(title || '').trim(); }
    function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
    function skeletonize(winT, lang) {
      var t = String(winT || '').trim(), num = (t.match(/\b(\d{1,3})\b/) || [])[1];
      if (num) return { kind: 'num', n: num };
      if (pick(RE.survive, lang).test(t.toLowerCase())) return { kind: 'survive' };
      if (/^\s*(how|c[oó]mo)\b/i.test(t)) return { kind: 'how' };
      if (/^\s*(why|por\s?qu[eé])\b/i.test(t)) return { kind: 'why' };
      if (/:/.test(t)) return { kind: 'colon', head: t.split(':')[0].trim() };
      if (pick(RE.power, lang).test(t.toLowerCase())) return { kind: 'power', word: (t.match(pick(RE.power, lang)) || [''])[0] };
      return null;
    }
    function fillSkeleton(sk, topic, lang) {
      if (!sk) return ''; var T = topic, Tc = cap(topic);
      var L = {
        es: { num: T + ' (lo que no sabías)', survive: '¿Cómo logró sobrevivir ' + T + '?', how: 'Cómo ' + topic + ' (la verdad)', why: 'Por qué ' + topic + ' lo cambia todo' },
        en: { num: Tc, survive: 'How Did ' + Tc + ' Survive?', how: 'How ' + Tc + ' (The Truth)', why: 'Why ' + Tc + ' Changes Everything' },
        de: { num: Tc, survive: 'Wie hat ' + Tc + ' überlebt?', how: 'Wie ' + topic + ' (die Wahrheit)', why: 'Warum ' + topic + ' alles verändert' },
        fr: { num: Tc, survive: 'Comment ' + Tc + ' a survécu ?', how: 'Comment ' + topic + ' (la vérité)', why: 'Pourquoi ' + topic + ' change tout' },
        pt: { num: Tc, survive: 'Como ' + Tc + ' sobreviveu?', how: 'Como ' + topic + ' (a verdade)', why: 'Por que ' + topic + ' muda tudo' }
      };
      var m = L[lang] || L.en;
      var NUM = { es: ' cosas que no sabías sobre ', en: ' things you didn\'t know about ', de: ' Dinge, die du über ', fr: ' choses que tu ignorais sur ', pt: ' coisas que você não sabia sobre ' };
      switch (sk.kind) {
        case 'num': return sk.n + (NUM[lang] || NUM.en) + T + (lang === 'de' ? ' nicht wusstest' : '');
        case 'survive': return m.survive;
        case 'how': return m.how;
        case 'why': return m.why;
        case 'colon': return cap(sk.head) + ': ' + Tc;
        case 'power': return cap(sk.word) + ': ' + Tc;
      }
      return '';
    }
    function rewritesFromSkeletons(title, winners, weights, lang) {
      var idx = winners.map(function (_, i) { return i; }).sort(function (a, b) { return weights[b] - weights[a]; }).slice(0, 8);
      var topic = coreTopic(title), out = [], seen = {}, i, f, k;
      for (i = 0; i < idx.length && out.length < 3; i++) { f = fillSkeleton(skeletonize(winners[idx[i]].t, lang), topic, lang); k = f.toLowerCase(); if (f && f.length >= 12 && f.length <= 100 && !seen[k] && k !== String(title).toLowerCase()) { seen[k] = 1; out.push(f); } }
      var GEN = {
        es: ['7 verdades sobre ' + topic, 'La verdad sobre ' + topic + ' que nadie cuenta', 'Por qué ' + topic + ' lo cambia todo'],
        en: ['7 truths about ' + topic, 'The truth about ' + topic + ' nobody tells you', 'Why ' + topic + ' changes everything'],
        de: ['7 Wahrheiten über ' + topic, 'Die Wahrheit über ' + topic + ', die niemand erzählt', 'Warum ' + topic + ' alles verändert'],
        fr: ['7 vérités sur ' + topic, 'La vérité sur ' + topic + ' que personne ne dit', 'Pourquoi ' + topic + ' change tout'],
        pt: ['7 verdades sobre ' + topic, 'A verdade sobre ' + topic + ' que ninguém conta', 'Por que ' + topic + ' muda tudo']
      };
      var gen = GEN[lang] || GEN.en;
      for (i = 0; i < gen.length && out.length < 3; i++) { k = gen[i].toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(cap(gen[i])); } }
      return out.slice(0, 3);
    }
    function pickWeakest(dims, low) {
      var lbl = { number: 'sin número/lista', brackets: 'sin brackets [ ] o separador |', pattern: 'sin patrón pregunta-gancho ("cómo logró…")', length: 'largo fuera del sweet spot (30-70)', curiosity: 'sin curiosity gap (cómo/por qué/secreto)', power: 'sin power words' };
      var weak = dims.hook.weak || [];
      if (weak.length) return lbl[weak[0]] || weak[0];
      if (!low && dims.lexical.score < 45) return 'poco parecido a los ganadores del nicho (léxico bajo)';
      return 'nada crítico — alineado con los ganadores';
    }
    function analyze(title, winners, opts) {
      title = String(title || '').trim();
      winners = (Array.isArray(winners) ? winners : []).filter(function (w) { return w && w.t && String(w.t).length >= 6; });
      if (!title || !winners.length) return { ok: false };
      var corpusLang = guessCorpusLang(winners);
      var titleLang = (opts && opts.titleLang) || zDetectLang(title);
      var crossLang = titleLang !== corpusLang;   // título en idioma distinto a los ganadores → el léxico NO aplica
      var winToks = winners.map(function (w) { return tokenize(w.t); });            // tokeniza 1x (lib)
      var idf = buildIdf(winToks);                                                  // buildIdf de la lib recibe LISTAS DE TOKENS
      var vecs = winToks.map(function (t) { return tfidf(t, idf); });               // cache 1x (#4)
      var weights = winners.map(weightOf);                                          // (#5)
      var low = winners.length < MIN_N;                                             // (#3)
      var lexLow = low || crossLang;   // léxico de baja confianza si hay pocos datos O distinto idioma → el blend se apoya en el gancho
      var lowReason = low ? ('solo ' + winners.length + ' ganadores del nicho (mín ' + MIN_N + ' para percentil + léxico fuerte)') : (crossLang ? ('tu título está en ' + titleLang.toUpperCase() + ' y los ganadores en ' + corpusLang.toUpperCase() + ' — comparo por ESTRUCTURA (el parecido de palabras no aplica entre idiomas)') : null);
      var qv = tfidf(tokenize(title), idf);
      var lex01 = lexAgg(qv, vecs, weights, -1);
      var hook = hookScore(title, titleLang);
      var score = blend(lex01, hook.score, lexLow);
      var percentile = null;
      if (!low) {
        var dist = [], i;
        for (i = 0; i < winners.length; i++) { var l = lexAgg(vecs[i], vecs, weights, i); dist.push(blend(l, hookScore(winners[i].t, corpusLang).score, lexLow)); }  // LOO (#2) + MISMO blend (#1)
        dist.sort(function (a, b) { return a - b; });
        percentile = percentileOf(score, dist);
      }
      var dims = {
        lexical: { score: Math.round(lex01 * 100), lowConf: lexLow, note: crossLang ? ('título en ' + titleLang.toUpperCase() + ' vs ganadores en ' + corpusLang.toUpperCase() + ' — el parecido de palabras no aplica entre idiomas; comparo por estructura') : (low ? ('pocos datos (' + winners.length + ') — léxico de baja confianza') : ('coseno TF-IDF vs ' + winners.length + ' ganadores, ponderado por VPH')) },
        hook: { score: hook.score, parts: hook.parts, weak: hook.weak, note: 'estructura del gancho' }
      };
      return { ok: true, confidence: low ? 'low' : 'high', crossLang: crossLang, lowReason: lowReason, score: score, percentile: percentile, lang: titleLang, dims: dims, weakest: pickWeakest(dims, lexLow), rewrites: rewritesFromSkeletons(title, winners, weights, titleLang) };
    }
    function zRewriteWithZerack(titulos) { return Promise.resolve(Array.isArray(titulos) ? titulos.slice(0, 3) : []); }  // STUB, no conectado a UI
    return { analyze: analyze, rewrite: zRewriteWithZerack };
  })();

  function zRunTitlePrediction(title) {
    title = String(title || '').trim();
    var niche = zDetectNiche(title);
    var titleLang = zDetectLang(title);   // idioma del título → corpus localizado + sugerencias + léxico justo

    function finalize(winners, nicheTotal, corpusTotal) {
      var eng = null;
      try { eng = zTitleEngine.analyze(title, winners, { nicheLabel: niche.label, titleLang: titleLang }); } catch (e) { eng = null; }
      if (eng && eng.ok) return finalizeEngine(eng, winners, nicheTotal, corpusTotal);
      return finalizeFallback(winners, nicheTotal, corpusTotal);  // 0 ganadores o excepción → motor viejo
    }
    function finalizeEngine(eng, winners, nicheTotal, corpusTotal) {
      var verdict, color;
      if (eng.score >= 75) { verdict = 'POTENCIAL VIRAL'; color = '#00DC82'; }
      else if (eng.score >= 58) { verdict = 'SÓLIDO'; color = '#7FE3B5'; }
      else if (eng.score >= 40) { verdict = 'NECESITA TRABAJO'; color = '#FFD93D'; }
      else { verdict = 'BAJO POTENCIAL'; color = '#FF6B6B'; }
      var rec, st;
      if (eng.confidence === 'low') { rec = 'BAJA CONFIANZA — ' + (eng.lowReason || 'pocos ganadores') + '. El score se apoya en la estructura del gancho (corpus-independiente). Escaneá más este nicho para activar percentil + léxico.\nLo más flojo: ' + eng.weakest + '.'; st = 'lowdata'; }
      else if (eng.percentile != null && eng.percentile >= 70) { rec = 'FUERTE — percentil ' + eng.percentile + ' vs los ganadores reales del nicho. Lo más flojo: ' + eng.weakest + '.'; st = 'publish'; }
      else { rec = 'MEJORABLE — percentil ' + (eng.percentile != null ? eng.percentile : '—') + ' del nicho. Atacá: ' + eng.weakest + '.'; st = 'improve'; }
      return {
        title: title, niche: niche.label, nicheRpm: niche.rpm, usedEngine: true,
        viralScore: eng.score, percentile: eng.percentile, confidence: eng.confidence, lowReason: eng.lowReason,
        verdict: verdict, color: color, engine: eng,
        moneyPotentialIndex: Math.round((eng.score / 100) * niche.rpm * 10) / 10,
        marketData: { nicheTitlesInCorpus: nicheTotal || winners.length, corpusTotal: corpusTotal || 0, topWinners: winners.slice(0, 8).map(function (w) { return { title: w.t, vph: w.v, views: w.w }; }) },
        suggestions: eng.rewrites, recommendation: rec, recommendStatus: st
      };
    }
    function finalizeFallback(winners, nicheTotal, corpusTotal) {
      var base = zPredictLocalTitle(title, niche.label);
      var n = winners.length;
      var avgV = n ? Math.round(winners.reduce(function(s, w) { return s + (w.v || 0); }, 0) / n) : 0;
      var heat = Math.min(15, Math.round((avgV / 4000) * 15));
      var sat = n >= 12 ? 4 : n >= 6 ? 7 : 10;
      base.breakdown.mercado = { score: heat, max: 15, note: n + ' ganadores del nicho · VPH prom ' + avgV };
      base.breakdown.saturacion = { score: sat, max: 10, note: n >= 12 ? 'alta competencia' : n >= 6 ? 'media' : 'espacio para entrar' };
      var total = Math.max(0, Math.min(100, base.breakdown.titulo.score + base.breakdown.nicho.score + heat + sat));
      var verdict, color;
      if (total >= 75) { verdict = 'POTENCIAL VIRAL'; color = '#00DC82'; }
      else if (total >= 58) { verdict = 'SÓLIDO'; color = '#7FE3B5'; }
      else if (total >= 40) { verdict = 'NECESITA TRABAJO'; color = '#FFD93D'; }
      else { verdict = 'BAJO POTENCIAL'; color = '#FF6B6B'; }
      var cmp = zCompareWinners(title, winners);
      base.viralScore = total; base.verdict = verdict; base.color = color;
      base.moneyPotentialIndex = Math.round((total / 100) * niche.rpm * 10) / 10;
      base.marketData = { nicheTitlesInCorpus: nicheTotal || n, corpusTotal: corpusTotal || 0, topWinners: winners.slice(0, 8).map(function(w) { return { title: w.t, vph: w.v, views: w.w }; }), comparison: cmp };
      if (n < 4) { base.recommendation = 'POCA DATA del nicho "' + niche.label + '" (solo ' + n + ' títulos). El score se basa en señales del título. Escaneá ese nicho en YouTube para comparar contra más competidores reales.'; base.recommendStatus = 'lowdata'; }
      else if (cmp.gaps.length === 0 && total >= 60) { base.recommendation = 'LISTO PARA PUBLICAR ✓ — tu título está al nivel de los ' + n + ' ganadores del nicho (score ' + total + '/100). Publicalo.'; base.recommendStatus = 'publish'; }
      else if (cmp.gaps.length) { base.recommendation = 'MEJORAR ANTES DE PUBLICAR — comparado con los ' + n + ' ganadores reales del nicho:\n' + cmp.gaps.map(function(g, i) { return (i + 1) + ') ' + g; }).join('\n'); base.recommendStatus = 'improve'; }
      else { base.recommendation = 'ACEPTABLE (score ' + total + '/100) pero podés empujarlo más mirando los títulos ganadores de arriba.'; base.recommendStatus = 'acceptable'; }
      base.suggestions = zSuggestTitles(title, niche);
      return base;
    }

    return zReadCorpus(niche.label, 150).then(function(q1) {   // 150 (no 20) → distribución real para el percentil
      if (q1.winners.length >= 8) return finalize(q1.winners, q1.nicheTotal, q1.corpusTotal);
      // Query de mercado por NICHO (en inglés, donde está el volumen real de ganadores
      // faceless). Antes para "General" buscaba el título literal → traía basura random.
      var sq = niche.q || (niche.label !== 'General' ? niche.label : title.split(/\s+/).slice(0, 5).join(' '));
      return zSearchMarket(sq, ZLANG_GEO[titleLang] || ZLANG_GEO.en).then(function(vids) {
        var extra = (vids || []).map(function(v) {
          return { t: String(v.title || ''), n: niche.label, v: Math.round((Number(v.views) || 0) / 720), w: Number(v.views) || 0 };
        }).filter(function(x) { return x.t.length >= 8; });
        var merged = q1.winners.concat(extra);
        var seen = {}, dedup = [];
        merged.forEach(function(x) { var k = x.t.toLowerCase().slice(0, 80); if (!seen[k]) { seen[k] = 1; dedup.push(x); } });
        dedup.sort(function(a, b) { return (b.v || 0) - (a.v || 0); });
        return finalize(dedup.slice(0, 20), dedup.length, q1.corpusTotal + extra.length);
      });
    });
  }

  // ── Analizador LOCAL de miniatura (canvas, sin AI) ──────────────────────────
  function zScoreThumb(img) {
    try {
      var W = 160, H = 90, canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      var data;
      try { data = ctx.getImageData(0, 0, W, H).data; }
      catch (e) { return { error: 'No pude leer los píxeles (la imagen es de otro dominio / CORS). Subí el archivo en vez de usar la vista previa.' }; }
      var n = W * H, sumL = 0, sumL2 = 0, sumSat = 0, minL = 255, maxL = 0, lum = new Float32Array(n);
      for (var i = 0, p = 0; i < data.length; i += 4, p++) {
        var r = data[i], g = data[i + 1], b = data[i + 2];
        var L = 0.299 * r + 0.587 * g + 0.114 * b;
        lum[p] = L; sumL += L; sumL2 += L * L;
        if (L < minL) minL = L; if (L > maxL) maxL = L;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        sumSat += (mx === 0 ? 0 : (mx - mn) / mx);
      }
      var meanL = sumL / n, stdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL)), meanSat = sumSat / n, dynRange = maxL - minL;
      var edgeSum = 0, edgeCount = 0;
      for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
        var idx = y * W + x, gx = lum[idx + 1] - lum[idx - 1], gy = lum[idx + W] - lum[idx - W];
        edgeSum += Math.sqrt(gx * gx + gy * gy); edgeCount++;
      }
      var edgeAvg = edgeCount ? edgeSum / edgeCount : 0;
      var cl = function(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
      var sC = Math.round(cl(stdL / 55 * 30, 0, 30)), sS = Math.round(cl(meanSat / 0.5 * 22, 0, 22));
      var sD = Math.round(cl(dynRange / 220 * 16, 0, 16)), sComp = Math.round(cl(22 - Math.abs(edgeAvg - 14) * 1.3, 0, 22));
      var sB = Math.round(cl(10 - Math.abs(meanL - 130) / 12, 0, 10));
      var total = cl(sC + sS + sD + sComp + sB, 0, 100);
      var verdict, color;
      if (total >= 75) { verdict = 'POTENCIAL VIRAL'; color = '#00DC82'; }
      else if (total >= 58) { verdict = 'SÓLIDA'; color = '#7FE3B5'; }
      else if (total >= 40) { verdict = 'NECESITA TRABAJO'; color = '#FFD93D'; }
      else { verdict = 'BAJO CTR'; color = '#FF6B6B'; }
      var tips = [];
      if (sC < 20) tips.push('Subí el CONTRASTE — separá el sujeto del fondo con luz/sombra o un borde de color.');
      if (sS < 14) tips.push('Más COLOR — saturá naranjas/amarillos/rojos, resaltan en el feed.');
      if (sD < 10) tips.push('Te faltan negros puros y blancos puros — agregá profundidad.');
      if (edgeAvg > 24) tips.push('Está MUY cargada — quitá elementos, dejá UN solo punto focal.');
      else if (edgeAvg < 7) tips.push('Está plana/aburrida — agregá un elemento de intriga (flecha, círculo, contraste).');
      if (meanL < 80) tips.push('Está OSCURA — en mobile (80% de tus views) no se ve. Subí exposición.');
      else if (meanL > 185) tips.push('Está QUEMADA de luz — bajá las altas luces.');
      var nw = img.naturalWidth || 0;
      if (nw && nw < 1000) tips.push('Resolución baja (' + nw + 'px) — exportá en 1280×720 para que se vea nítida.');
      if (!tips.length) tips.push('Sólida. Probala con el A/B test de thumbnails nativo de YouTube contra una variante.');
      return {
        thumbScore: total, verdict: verdict, color: color,
        breakdown: [
          { label: 'Contraste', score: sC, max: 30, note: 'std luminancia ' + Math.round(stdL) },
          { label: 'Color / vibración', score: sS, max: 22, note: Math.round(meanSat * 100) + '% saturación' },
          { label: 'Rango dinámico', score: sD, max: 16, note: Math.round(dynRange) + '/255' },
          { label: 'Composición (1 foco)', score: sComp, max: 22, note: 'clutter ' + edgeAvg.toFixed(1) },
          { label: 'Brillo (mobile)', score: sB, max: 10, note: 'luma media ' + Math.round(meanL) }
        ],
        tips: tips
      };
    } catch (e) { return { error: 'Error analizando: ' + (e && e.message || e) }; }
  }

  // ── Helpers visuales ────────────────────────────────────────────────────────
  function zHexA(hex, a) {
    try { hex = String(hex || '#00DC82').replace('#', ''); if (hex.length === 3) hex = hex.split('').map(function(c) { return c + c; }).join(''); var n = parseInt(hex, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
    catch (e) { return 'rgba(0,220,130,' + a + ')'; }
  }
  function zFmt(n) { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return Math.round(n / 1e3) + 'K'; return String(n); }

  function zModal(titleText) {
    var prev = document.getElementById('nsp-z-modal'); if (prev) prev.remove();
    var overlay = document.createElement('div');
    overlay.id = 'nsp-z-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;font-family:Roboto,Arial,sans-serif;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    var box = document.createElement('div');
    box.style.cssText = 'width:min(560px,94vw);max-height:90vh;overflow-y:auto;background:#0a0c0f;border:1px solid rgba(0,220,130,0.32);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,0.7);';
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;background:#0a0c0f;z-index:2;';
    var ht = document.createElement('div'); ht.textContent = titleText; ht.style.cssText = 'font-weight:900;font-size:14px;letter-spacing:0.06em;color:#00DC82;';
    var cb = document.createElement('button'); cb.textContent = '✕'; cb.style.cssText = 'background:transparent;border:none;color:rgba(255,255,255,0.5);font-size:18px;cursor:pointer;line-height:1;padding:2px 6px;'; cb.onclick = function() { overlay.remove(); };
    hdr.appendChild(ht); hdr.appendChild(cb); box.appendChild(hdr);
    var body = document.createElement('div'); body.style.cssText = 'padding:18px;'; box.appendChild(body);
    overlay.appendChild(box); document.documentElement.appendChild(overlay);
    return { overlay: overlay, body: body };
  }

  // Render del motor nuevo: percentil (o aviso baja confianza) + barras léxico/hook +
  // chips de las partes del gancho + lo más flojo. 100% createElement/textContent (TT-safe).
  function zRenderEngineDims(container, pred) {
    var e = pred.engine || {}, dims = e.dims || {};
    var box = document.createElement('div');
    if (e.confidence === 'high' && e.percentile != null) {
      box.style.cssText = 'display:flex;align-items:baseline;gap:8px;padding:10px 13px;border-radius:11px;background:rgba(0,220,130,0.08);border:1px solid rgba(0,220,130,0.4);margin-bottom:12px;';
      var pn = document.createElement('span'); pn.textContent = 'Percentil ' + e.percentile; pn.style.cssText = 'font-size:21px;font-weight:900;color:#00DC82;line-height:1;';
      var pl = document.createElement('span'); pl.textContent = 'vs ' + ((pred.marketData || {}).nicheTitlesInCorpus || '') + ' ganadores reales del nicho'; pl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.62);';
      box.appendChild(pn); box.appendChild(pl);
    } else {
      box.style.cssText = 'padding:10px 13px;border-radius:11px;background:rgba(154,166,178,0.1);border:1px solid rgba(154,166,178,0.4);margin-bottom:12px;';
      var w1 = document.createElement('div'); w1.textContent = '⚠ Baja confianza por datos insuficientes'; w1.style.cssText = 'font-size:12px;font-weight:800;color:#cdd6df;';
      var w2 = document.createElement('div'); w2.textContent = e.lowReason || 'pocos ganadores en el nicho'; w2.style.cssText = 'font-size:10.5px;color:rgba(255,255,255,0.55);margin-top:3px;line-height:1.4;';
      box.appendChild(w1); box.appendChild(w2);
    }
    container.appendChild(box);
    function bar(label, score, note, dim) {
      var line = document.createElement('div'); line.style.cssText = 'margin-bottom:9px;' + (dim ? 'opacity:0.5;' : '');
      var top = document.createElement('div'); top.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;';
      var lb = document.createElement('span'); lb.textContent = label; lb.style.cssText = 'color:rgba(255,255,255,0.78);';
      var vl = document.createElement('span'); vl.textContent = score + '/100'; vl.style.cssText = 'color:#00DC82;font-weight:700;';
      top.appendChild(lb); top.appendChild(vl);
      var tr = document.createElement('div'); tr.style.cssText = 'height:6px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden;';
      var fl = document.createElement('div'); fl.style.cssText = 'height:100%;width:' + Math.max(0, Math.min(100, score)) + '%;border-radius:4px;background:linear-gradient(90deg,#00b86b,#00DC82);';
      tr.appendChild(fl); line.appendChild(top); line.appendChild(tr);
      if (note) { var ne = document.createElement('div'); ne.textContent = note; ne.style.cssText = 'font-size:9.5px;color:rgba(255,255,255,0.42);margin-top:3px;'; line.appendChild(ne); }
      container.appendChild(line);
    }
    if (dims.lexical) bar('Similitud léxica con ganadores', dims.lexical.score, dims.lexical.note, dims.lexical.lowConf);
    if (dims.hook) {
      bar('Estructura del gancho', dims.hook.score, dims.hook.note, false);
      var chips = document.createElement('div'); chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin:-3px 0 11px;';
      var lblmap = { number: 'número', brackets: 'brackets', pattern: 'patrón ?', length: 'largo', curiosity: 'curiosidad', power: 'power' };
      var parts = dims.hook.parts || {}, k;
      for (k in parts) {
        var hit = parts[k].hit, ch = document.createElement('span');
        ch.textContent = (hit ? '✓ ' : '✗ ') + (lblmap[k] || k);
        ch.style.cssText = 'font-size:9.5px;font-weight:700;padding:3px 7px;border-radius:6px;' + (hit ? 'background:rgba(0,220,130,0.14);color:#00DC82;border:1px solid rgba(0,220,130,0.4);' : 'background:rgba(255,107,107,0.12);color:#FF6B6B;border:1px solid rgba(255,107,107,0.35);');
        chips.appendChild(ch);
      }
      container.appendChild(chips);
    }
    if (e.weakest) { var wk = document.createElement('div'); wk.textContent = '🎯 Lo más flojo: ' + e.weakest; wk.style.cssText = 'font-size:11px;color:#FFD93D;font-weight:600;margin-bottom:10px;'; container.appendChild(wk); }
  }

  function zRenderTitlePred(container, pred) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var hero = document.createElement('div');
    hero.style.cssText = 'display:flex;align-items:center;gap:16px;padding:16px;border-radius:13px;background:#0e1217;border:1px solid ' + zHexA(pred.color, 0.45) + ';margin-bottom:14px;';
    var ring = document.createElement('div');
    ring.style.cssText = 'flex:0 0 auto;width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:conic-gradient(' + pred.color + ' ' + (pred.viralScore * 3.6) + 'deg, rgba(255,255,255,0.08) 0deg);';
    var ri = document.createElement('div'); ri.style.cssText = 'width:66px;height:66px;border-radius:50%;background:#0e1217;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    var sn = document.createElement('div'); sn.textContent = String(pred.viralScore); sn.style.cssText = 'font-size:26px;font-weight:900;color:' + pred.color + ';line-height:1;';
    var sm = document.createElement('div'); sm.textContent = '/100'; sm.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4);margin-top:1px;';
    ri.appendChild(sn); ri.appendChild(sm); ring.appendChild(ri);
    var ht = document.createElement('div');
    var vd = document.createElement('div'); vd.textContent = pred.verdict; vd.style.cssText = 'font-size:16px;font-weight:900;color:' + pred.color + ';letter-spacing:0.03em;';
    var nl = document.createElement('div'); nl.textContent = 'Nicho: ' + pred.niche + '  ·  RPM ~$' + pred.nicheRpm; nl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.62);margin-top:5px;';
    var ml = document.createElement('div'); ml.textContent = '💰 Índice de $: ' + pred.moneyPotentialIndex; ml.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.62);margin-top:2px;';
    ht.appendChild(vd); ht.appendChild(nl); ht.appendChild(ml); hero.appendChild(ring); hero.appendChild(ht); container.appendChild(hero);
    if (pred.usedEngine && pred.engine) { try { zRenderEngineDims(container, pred); } catch (e) {} }   // motor nuevo: percentil + dims; el viejo breakdown queda vacío (no rompe)
    var bd = pred.breakdown || {};
    [{ l: 'Título (clickabilidad)', d: bd.titulo }, { l: 'Nicho + monetización', d: bd.nicho }, { l: 'Heat del mercado', d: bd.mercado }, { l: 'Anti-saturación', d: bd.saturacion }].forEach(function(row) {
      if (!row.d) return;
      var line = document.createElement('div'); line.style.cssText = 'margin-bottom:9px;';
      var top = document.createElement('div'); top.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;';
      var lb = document.createElement('span'); lb.textContent = row.l; lb.style.cssText = 'color:rgba(255,255,255,0.75);';
      var vl = document.createElement('span'); vl.textContent = row.d.score + '/' + row.d.max; vl.style.cssText = 'color:#00DC82;font-weight:700;';
      top.appendChild(lb); top.appendChild(vl);
      var tr = document.createElement('div'); tr.style.cssText = 'height:6px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden;';
      var fl = document.createElement('div'); fl.style.cssText = 'height:100%;width:' + (row.d.max ? Math.round(row.d.score / row.d.max * 100) : 0) + '%;border-radius:4px;background:linear-gradient(90deg,#00b86b,#00DC82);';
      tr.appendChild(fl); line.appendChild(top); line.appendChild(tr);
      var note = row.d.note || (row.d.signals && row.d.signals.length ? row.d.signals.join(' · ') : '');
      if (note) { var ne = document.createElement('div'); ne.textContent = note; ne.style.cssText = 'font-size:9.5px;color:rgba(255,255,255,0.42);margin-top:3px;'; line.appendChild(ne); }
      container.appendChild(line);
    });
    var md = pred.marketData || {}; var st = pred.recommendStatus || 'acceptable';
    var rc = st === 'publish' ? '#00DC82' : st === 'improve' ? '#FFD93D' : st === 'lowdata' ? '#9aa6b2' : '#7FE3B5';
    var rec = document.createElement('div'); rec.style.cssText = 'margin-top:8px;margin-bottom:13px;padding:12px 13px;border-radius:11px;background:' + zHexA(rc, 0.09) + ';border:1px solid ' + zHexA(rc, 0.42) + ';';
    var rt = document.createElement('div'); rt.textContent = st === 'publish' ? '✅ LISTO PARA PUBLICAR' : st === 'improve' ? '🔧 MEJORAR ANTES DE PUBLICAR' : st === 'lowdata' ? 'ℹ POCA DATA DE MERCADO' : '➜ VEREDICTO'; rt.style.cssText = 'font-size:10px;font-weight:900;letter-spacing:0.08em;color:' + rc + ';margin-bottom:5px;';
    var rx = document.createElement('div'); rx.textContent = pred.recommendation || ''; rx.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5;white-space:pre-wrap;';
    rec.appendChild(rt); rec.appendChild(rx); container.appendChild(rec);
    // ── Títulos sugeridos (basados en tu tema + nicho) ──
    var sugg = pred.suggestions || [];
    if (sugg.length) {
      var sh = document.createElement('div'); sh.textContent = '💡 TÍTULOS SUGERIDOS PARA TU NICHO (' + pred.niche + ')'; sh.style.cssText = 'font-size:10px;font-weight:900;letter-spacing:0.05em;color:#00DC82;margin:4px 0 8px;'; container.appendChild(sh);
      sugg.forEach(function(s) {
        var sr = document.createElement('div'); sr.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px 10px;margin-bottom:6px;border-radius:9px;background:rgba(0,220,130,0.06);border:1px solid rgba(0,220,130,0.22);';
        var sx = document.createElement('div'); sx.textContent = s; sx.style.cssText = 'flex:1;font-size:11.5px;color:#fff;line-height:1.35;';
        var cp = document.createElement('button'); cp.textContent = 'Copiar'; cp.style.cssText = 'flex:0 0 auto;background:rgba(0,220,130,0.15);border:1px solid rgba(0,220,130,0.45);color:#00DC82;font-size:10px;font-weight:800;padding:5px 9px;border-radius:7px;cursor:pointer;';
        cp.onclick = function() { try { navigator.clipboard.writeText(s); cp.textContent = '✓ Copiado'; setTimeout(function() { cp.textContent = 'Copiar'; }, 1200); } catch (e) {} };
        sr.appendChild(sx); sr.appendChild(cp); container.appendChild(sr);
      });
    }
    var winners = md.topWinners || [];
    if (winners.length) {
      var wh = document.createElement('div'); wh.textContent = '🏆 GANADORES REALES DEL NICHO (' + (md.nicheTitlesInCorpus || winners.length) + ')'; wh.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:0.04em;color:rgba(255,255,255,0.55);margin:4px 0 6px;'; container.appendChild(wh);
      winners.slice(0, 6).forEach(function(w) {
        var wr = document.createElement('div'); wr.style.cssText = 'display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-top:1px solid rgba(255,255,255,0.05);';
        var wt = document.createElement('div'); wt.textContent = w.title; wt.style.cssText = 'flex:1;font-size:11px;color:rgba(255,255,255,0.8);line-height:1.35;';
        var wv = document.createElement('div'); wv.textContent = w.vph ? (zFmt(w.vph) + ' VPH') : (w.views ? (zFmt(w.views) + ' v') : ''); wv.style.cssText = 'flex:0 0 auto;font-size:10px;font-weight:700;color:#00DC82;white-space:nowrap;';
        wr.appendChild(wt); wr.appendChild(wv); container.appendChild(wr);
      });
    }
  }

  function zRenderThumb(container, img, scored) {
    while (container.firstChild) container.removeChild(container.firstChild);
    if (!scored) return;
    if (scored.error) { var er = document.createElement('div'); er.textContent = '⚠ ' + scored.error; er.style.cssText = 'color:#FFD93D;font-size:12px;line-height:1.5;padding:8px 0;'; container.appendChild(er); return; }
    var hero = document.createElement('div'); hero.style.cssText = 'display:flex;gap:14px;align-items:center;padding:14px;border-radius:13px;background:#0e1217;border:1px solid ' + zHexA(scored.color, 0.45) + ';margin-bottom:14px;';
    var th = document.createElement('img'); th.src = img.src; th.style.cssText = 'width:128px;height:72px;object-fit:cover;border-radius:8px;flex:0 0 auto;border:1px solid rgba(255,255,255,0.1);';
    var info = document.createElement('div');
    var sl = document.createElement('div'); sl.style.cssText = 'display:flex;align-items:baseline;gap:5px;';
    var sn = document.createElement('span'); sn.textContent = String(scored.thumbScore); sn.style.cssText = 'font-size:28px;font-weight:900;color:' + scored.color + ';line-height:1;';
    var sm = document.createElement('span'); sm.textContent = '/100 CTR'; sm.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);';
    sl.appendChild(sn); sl.appendChild(sm);
    var vd = document.createElement('div'); vd.textContent = scored.verdict; vd.style.cssText = 'font-size:14px;font-weight:900;color:' + scored.color + ';margin-top:4px;letter-spacing:0.03em;';
    info.appendChild(sl); info.appendChild(vd); hero.appendChild(th); hero.appendChild(info); container.appendChild(hero);
    (scored.breakdown || []).forEach(function(row) {
      var line = document.createElement('div'); line.style.cssText = 'margin-bottom:9px;';
      var top = document.createElement('div'); top.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;';
      var lb = document.createElement('span'); lb.textContent = row.label; lb.style.cssText = 'color:rgba(255,255,255,0.75);';
      var vl = document.createElement('span'); vl.textContent = row.score + '/' + row.max; vl.style.cssText = 'color:#00DC82;font-weight:700;';
      top.appendChild(lb); top.appendChild(vl);
      var tr = document.createElement('div'); tr.style.cssText = 'height:6px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden;';
      var fl = document.createElement('div'); fl.style.cssText = 'height:100%;width:' + (row.max ? Math.round(row.score / row.max * 100) : 0) + '%;border-radius:4px;background:linear-gradient(90deg,#00b86b,#00DC82);';
      tr.appendChild(fl); var ne = document.createElement('div'); ne.textContent = row.note || ''; ne.style.cssText = 'font-size:9.5px;color:rgba(255,255,255,0.42);margin-top:3px;';
      line.appendChild(top); line.appendChild(tr); line.appendChild(ne); container.appendChild(line);
    });
    var th2 = document.createElement('div'); th2.textContent = '🔧 CÓMO SUBIR EL CTR'; th2.style.cssText = 'font-size:10px;font-weight:900;letter-spacing:0.08em;color:rgba(255,255,255,0.55);margin:10px 0 7px;'; container.appendChild(th2);
    (scored.tips || []).forEach(function(tip) {
      var t = document.createElement('div'); t.style.cssText = 'display:flex;gap:8px;font-size:11.5px;color:rgba(255,255,255,0.82);line-height:1.45;margin-bottom:6px;';
      var dot = document.createElement('span'); dot.textContent = '→'; dot.style.cssText = 'color:#00DC82;flex:0 0 auto;font-weight:900;';
      var tx = document.createElement('span'); tx.textContent = tip; t.appendChild(dot); t.appendChild(tx); container.appendChild(t);
    });
  }

  // ── Panel: predecir TÍTULO ──────────────────────────────────────────────────
  function zShowTitlePredictor(prefill) {
    var m = zModal('🔮 PREDECIR VIRALIDAD DEL TÍTULO');
    var sub = document.createElement('div'); sub.textContent = 'Comparo tu título contra los ganadores REALES del nicho (tu base de mercado + búsqueda activa en YouTube) y te digo si publicar o mejorar.'; sub.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);line-height:1.5;margin-bottom:13px;'; m.body.appendChild(sub);
    var ta = document.createElement('textarea'); ta.value = prefill || ''; ta.placeholder = 'Tu título…'; ta.style.cssText = 'width:100%;box-sizing:border-box;min-height:54px;resize:vertical;background:#11151a;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;padding:11px 13px;font-size:13px;font-family:inherit;line-height:1.4;outline:none;'; m.body.appendChild(ta);
    var btn = document.createElement('button'); btn.textContent = '⚡ PREDECIR'; btn.style.cssText = 'width:100%;margin-top:13px;padding:13px;border:none;border-radius:11px;background:linear-gradient(135deg,#00DC82,#00b86b);color:#04140d;font-weight:900;font-size:13px;letter-spacing:0.05em;cursor:pointer;font-family:inherit;'; m.body.appendChild(btn);
    var res = document.createElement('div'); res.style.cssText = 'margin-top:16px;'; m.body.appendChild(res);
    function run() {
      var title = String(ta.value || '').trim();
      while (res.firstChild) res.removeChild(res.firstChild);
      if (title.length < 6) { var w = document.createElement('div'); w.textContent = 'Escribí un título de al menos 6 caracteres.'; w.style.cssText = 'color:#FFD93D;font-size:12px;padding:8px 0;'; res.appendChild(w); return; }
      btn.disabled = true; btn.textContent = '🔎 Analizando mercado…'; btn.style.opacity = '0.7';
      var ld = document.createElement('div'); ld.textContent = 'Consultando tu base de mercado + buscando ganadores del nicho…'; ld.style.cssText = 'color:rgba(0,220,130,0.8);font-size:12px;padding:10px 0;'; res.appendChild(ld);
      zRunTitlePrediction(title).then(function(pred) { btn.disabled = false; btn.textContent = '⚡ PREDECIR DE NUEVO'; btn.style.opacity = '1'; zRenderTitlePred(res, pred); })
        .catch(function(err) { btn.disabled = false; btn.textContent = '⚡ PREDECIR'; btn.style.opacity = '1'; while (res.firstChild) res.removeChild(res.firstChild); var e = document.createElement('div'); e.textContent = '❌ ' + (err && err.message || err); e.style.cssText = 'color:#FF6B6B;font-size:12px;'; res.appendChild(e); });
    }
    btn.onclick = run;
    ta.onkeydown = function(e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); } };
    setTimeout(function() { try { ta.focus(); } catch (e) {} }, 50);
    if (prefill && prefill.length >= 6) run();
  }

  // Busca la miniatura ya cargada en el editor de Studio
  function zFindStudioThumbSrc() {
    var sels = ['ytcp-thumbnail-uploader img', '#custom-thumbnail-image img', 'ytcp-video-thumbnail-editor img', '.still-cell img', '#still-picker img', 'ytcp-thumbnails-compact-editor img'];
    for (var i = 0; i < sels.length; i++) {
      var im = document.querySelector(sels[i]);
      if (im && im.src && /^(blob:|data:|https:)/.test(im.src) && ((im.naturalWidth || im.width || 0) > 50)) return im.src;
    }
    return '';
  }

  // ── Panel: analizar MINIATURA ───────────────────────────────────────────────
  function zShowThumbAnalyzer() {
    var m = zModal('🖼 ANALIZAR MINIATURA (CTR)');
    var res = document.createElement('div'); res.style.cssText = 'margin-top:4px;';
    function analyze(src, cross, isRetry) {
      while (res.firstChild) res.removeChild(res.firstChild);
      var ld = document.createElement('div'); ld.textContent = 'Analizando píxeles…'; ld.style.cssText = 'color:rgba(0,220,130,0.8);font-size:12px;padding:8px 0;'; res.appendChild(ld);
      var img = new Image(); if (cross) img.crossOrigin = 'anonymous';
      img.onload = function() { zRenderThumb(res, img, zScoreThumb(img)); };
      img.onerror = function() {
        // Si falló CON crossOrigin (CDN sin CORS), reintenta SIN crossOrigin: al menos
        // carga la imagen; si el canvas queda tainted, zScoreThumb avisa con un mensaje limpio.
        if (cross && !isRetry) { analyze(src, false, true); return; }
        while (res.firstChild) res.removeChild(res.firstChild); var e = document.createElement('div'); e.textContent = '⚠ No pude cargar la imagen. Subí el archivo abajo.'; e.style.cssText = 'color:#FFD93D;font-size:12px;'; res.appendChild(e);
      };
      img.src = src;
    }
    var studioSrc = zFindStudioThumbSrc();
    var info = document.createElement('div');
    info.textContent = studioSrc ? 'Detecté tu miniatura subida. La analizo automáticamente — o subí otra abajo.' : 'No detecté una miniatura subida. Subí el archivo para analizarlo (contraste, color, composición, brillo → score de CTR).';
    info.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);line-height:1.5;margin-bottom:12px;'; m.body.appendChild(info);
    var drop = document.createElement('label');
    drop.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:18px;border:1.5px dashed rgba(0,220,130,0.4);border-radius:12px;background:rgba(0,220,130,0.04);cursor:pointer;text-align:center;margin-bottom:6px;';
    var di = document.createElement('div'); di.textContent = '🖼'; di.style.cssText = 'font-size:24px;';
    var dt = document.createElement('div'); dt.textContent = 'Subí tu miniatura (PNG/JPG)'; dt.style.cssText = 'font-size:12px;font-weight:700;color:#00DC82;';
    var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
    drop.appendChild(di); drop.appendChild(dt); drop.appendChild(fi); m.body.appendChild(drop);
    m.body.appendChild(res);
    fi.onchange = function() { var f = fi.files && fi.files[0]; if (!f) return; dt.textContent = f.name.slice(0, 30); var rd = new FileReader(); rd.onload = function(ev) { analyze(String(ev.target.result), false); }; rd.readAsDataURL(f); };
    drop.ondragover = function(e) { e.preventDefault(); drop.style.background = 'rgba(0,220,130,0.12)'; };
    drop.ondragleave = function() { drop.style.background = 'rgba(0,220,130,0.04)'; };
    drop.ondrop = function(e) { e.preventDefault(); drop.style.background = 'rgba(0,220,130,0.04)'; var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return; dt.textContent = f.name.slice(0, 30); var rd = new FileReader(); rd.onload = function(ev) { analyze(String(ev.target.result), false); }; rd.readAsDataURL(f); };
    if (studioSrc) analyze(studioSrc, !/^blob:|^data:/.test(studioSrc));
  }

  // ── Inyección de botones al lado del TÍTULO y la MINIATURA ──────────────────
  function zGetTitleEl() {
    return document.querySelector('ytcp-social-suggestions-textbox#title-textarea #textbox, #title-textarea #textbox, ytcp-mention-textbox#title-textarea #textbox');
  }
  function zChipStyle() {
    return 'display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 14px;border-radius:8px;border:1px solid rgba(0,220,130,0.5);background:rgba(0,220,130,0.10);color:#00DC82;font-size:12px;font-weight:800;cursor:pointer;font-family:Roboto,Arial,sans-serif;letter-spacing:0.02em;';
  }
  function injectTitlePredictorBtn() {
    var titleEl = zGetTitleEl();
    var container = document.querySelector('ytcp-video-metadata-editor #title-textarea, #title-textarea');
    if (!container && titleEl) container = titleEl.closest('ytcp-social-suggestions-textbox, ytcp-mention-textbox');
    if (!container || !container.parentNode) return;
    // Re-inyectar si quedó huérfano tras navegación SPA (mismo bug que el de miniatura).
    var exTi = document.getElementById('nsp-title-predict-btn');
    if (exTi) { if (exTi.parentNode === container.parentNode) return; try { exTi.remove(); } catch (e) {} }
    var btn = document.createElement('button');
    btn.id = 'nsp-title-predict-btn'; btn.type = 'button';
    btn.textContent = '🔮 Predecir viralidad del título';
    btn.style.cssText = zChipStyle();
    btn.onmouseenter = function() { btn.style.background = 'rgba(0,220,130,0.2)'; };
    btn.onmouseleave = function() { btn.style.background = 'rgba(0,220,130,0.10)'; };
    btn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); var el = zGetTitleEl(); var txt = el ? (el.textContent || '').trim() : ''; zShowTitlePredictor(txt); };
    container.parentNode.insertBefore(btn, container.nextSibling);
  }
  function injectThumbAnalyzerBtn() {
    var ed = document.querySelector('ytcp-video-thumbnail-editor, ytcp-thumbnails-compact-editor, #thumbnail-image-picker, #still-picker');
    if (!ed || !ed.parentNode) return;
    // Re-inyectar si el botón quedó huérfano tras una navegación SPA de Studio (antes el
    // guard global lo daba por presente y nunca lo volvía a poner → desaparecía).
    var exTh = document.getElementById('nsp-thumb-analyze-btn');
    if (exTh) { if (exTh.parentNode === ed.parentNode) return; try { exTh.remove(); } catch (e) {} }
    var btn = document.createElement('button');
    btn.id = 'nsp-thumb-analyze-btn'; btn.type = 'button';
    btn.textContent = '🖼 Analizar miniatura (CTR)';
    btn.style.cssText = zChipStyle();
    btn.onmouseenter = function() { btn.style.background = 'rgba(0,220,130,0.2)'; };
    btn.onmouseleave = function() { btn.style.background = 'rgba(0,220,130,0.10)'; };
    btn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); zShowThumbAnalyzer(); };
    ed.parentNode.insertBefore(btn, ed.nextSibling);
  }

  // ── Botón flotante ────────────────────────────────────────────────────────────────
  function injectButton() {
    if (document.getElementById('nsp-studio-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'nsp-studio-btn';
    btn.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:2147483646;display:flex;align-items:center;gap:9px;height:48px;padding:0 20px;border-radius:24px;background:linear-gradient(135deg,#0a0c0f,#11161b);border:1.5px solid rgba(0,220,130,0.6);color:#00DC82;font-size:13px;font-weight:900;cursor:pointer;font-family:Roboto,Arial,sans-serif;letter-spacing:0.05em;box-shadow:0 8px 28px rgba(0,220,130,0.32);transition:all 0.2s;';
    var ic = document.createElement('span'); ic.style.fontSize = '18px'; ic.textContent = '🧠';
    var lb = document.createElement('span'); lb.textContent = 'ZERACK';
    btn.appendChild(ic); btn.appendChild(lb);
    btn.onmouseenter = function() { btn.style.transform = 'translateY(-2px) scale(1.04)'; };
    btn.onmouseleave = function() { btn.style.transform = 'none'; };
    btn.onclick = function() { showPanel(); };
    document.documentElement.appendChild(btn);
  }

  function tick() {
    try { injectButton(); } catch(e) {}
    try { injectTitlePredictorBtn(); } catch(e) {}   // v3.21.0 — botón al lado del título
    try { injectThumbAnalyzerBtn(); } catch(e) {}    // v3.21.0 — botón al lado de la miniatura
    try { var host = document.getElementById('nsp-studio-panel-host'); if (host && host.shadowRoot && S.panelOpen) { var hs = host.shadowRoot.getElementById('hs'); if (hs) hs.textContent = pageLabel(pageType()); } } catch(e) {}
  }

  // Carga conversación previa + auto-resume tras navegación
  loadConv(function(resumeAfterNav) {
    S.loaded = true;
    if (resumeAfterNav && S.messages.length) {
      // Limpia el flag y abre el panel para continuar
      try { chrome.storage.local.set({ 'nsp_studio_conv': { messages: S.messages, ts: Date.now() } }); } catch(e) {}
      setTimeout(function() {
        var host = showPanel();
        var body = host.shadowRoot && host.shadowRoot.getElementById('body');
        // Continúa el loop automáticamente: el agente lee la nueva página
        if (body && !S.pending) {
          S.messages.push({ role: 'tool-status', content: '⚙ Página recargada — leyendo nueva sección...' });
          renderMessages(body);
          // re-inyecta una continuación
          var data = readPage();
          var navResp = { ok: true, arrivedAt: data.pageLabel, page: { pageType: data.pageType, videoTitle: data.videoTitle, metrics: data.metrics.slice(0, 20), text: data.text.slice(0, 3000) } };
          // Garantizar el par functionCall→functionResponse: si la navegación cortó dejando
          // un functionCall huérfano lo completamos; si no, empareja call+response nuevos.
          // (Antes se empujaba un functionResponse suelto y el provider rechazaba el historial.)
          var lastMsg = S.messages[S.messages.length - 1];
          if (lastMsg && lastMsg.functionCall && !lastMsg.functionResponse) {
            S.messages.push({ role: 'function', functionResponse: { name: lastMsg.functionCall.name || 'studioNavigateTo', response: navResp } });
          } else {
            S.messages.push({ role: 'assistant', content: '', functionCall: { name: 'studioNavigateTo', args: {} } });
            S.messages.push({ role: 'function', functionResponse: { name: 'studioNavigateTo', response: navResp } });
          }
          S.pending = true; setSending(true);
          (function continueStep(iter) {
            var apiMsgs = S.messages.filter(function(m) { return m.role !== 'tool-status' && m.role !== 'error'; });
            callAI(apiMsgs, true).then(function(res) {
              if (res.functionCalls && res.functionCalls.length && iter < MAX_ITERS) {
                var fc = res.functionCalls[0];
                S.messages.push({ role: 'tool-status', content: '⚙ ' + fc.name });
                renderMessages(body);
                studioExecTool(fc.name, fc.args).then(function(result) {
                  if (result && result._deepAnalysis) { runDeepAnalysis(body); S.pending = false; setSending(false); saveConv(); return; }
                  S.messages.push({ role: 'assistant', content: '', functionCall: fc });
                  S.messages.push({ role: 'function', functionResponse: { name: fc.name, response: result } });
                  continueStep(iter + 1);
                }).catch(function(err) { S.messages.push({ role: 'error', content: '❌ ' + (err && err.message || err) }); S.pending = false; setSending(false); renderMessages(body); saveConv(); });
              } else {
                S.messages.push({ role: 'assistant', content: cleanMd(res.text) || '(listo)' });
                S.pending = false; setSending(false); renderMessages(body); saveConv();
              }
            }).catch(function(err) { S.messages.push({ role: 'error', content: '❌ ' + (err.message || err) }); S.pending = false; setSending(false); renderMessages(body); saveConv(); });
          })(0);
        }
      }, 2000);
    }
  });

  setTimeout(tick, 1500);
  setTimeout(tick, 3500);
  setInterval(tick, 4000);
  var _lastUrl = window.location.href;
  setInterval(function() { if (window.location.href !== _lastUrl) { _lastUrl = window.location.href; setTimeout(tick, 800); } }, 1000);
})();
