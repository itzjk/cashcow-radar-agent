// NSP Options — v3.5.4 — JS externo (MV3 CSP bloquea inline scripts)
console.log('[NSP Options] options.js cargado ✓');

// fetch con timeout: sin esto, "PROBAR CONEXIÓN" se colgaba para siempre (botón en
// "⏳ PROBANDO..." disabled) si la red aceptaba la conexión pero no respondía.
function nspFetchT(url, opts, ms) {
  opts = opts || {};
  var ctrl = new AbortController();
  var to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 12000);
  opts.signal = ctrl.signal;
  return fetch(url, opts).finally(function () { clearTimeout(to); });
}

function getSettings() {
  return {
    tiers: {
      LEGENDARY: { min: parseFloat(document.getElementById('t-legendary').value) || 50, label:'LEGENDARY', icon:'💎', class:'nsp-legendary' },
      EPIC:      { min: parseFloat(document.getElementById('t-epic').value) || 15,      label:'EPIC',      icon:'🔥', class:'nsp-epic'      },
      GOLD:      { min: parseFloat(document.getElementById('t-gold').value) || 5,       label:'GOLD',      icon:'🥇', class:'nsp-gold'      },
      SILVER:    { min: parseFloat(document.getElementById('t-silver').value) || 2,     label:'SILVER',    icon:'🥈', class:'nsp-silver'    },
      BRONZE:    { min: 0.5, label:'BRONZE', icon:'🥉', class:'nsp-bronze' },
      DEAD:      { min: 0,   label:'DEAD',   icon:'💀', class:'nsp-dead'   },
    },
    showVPH:   document.getElementById('show-vph').checked,
    showMult:  document.getElementById('show-mult').checked,
    showRev:   document.getElementById('show-rev').checked,
    showScore: document.getElementById('show-score').checked,
    showTier:  document.getElementById('show-tier').checked,
  };
}

function loadSettings() {
  chrome.storage.sync.get('nsp_settings', (res) => {
    const s = res.nsp_settings;
    if (!s) return;
    if (s.tiers && s.tiers.LEGENDARY) document.getElementById('t-legendary').value = s.tiers.LEGENDARY.min;
    if (s.tiers && s.tiers.EPIC)      document.getElementById('t-epic').value = s.tiers.EPIC.min;
    if (s.tiers && s.tiers.GOLD)      document.getElementById('t-gold').value = s.tiers.GOLD.min;
    if (s.tiers && s.tiers.SILVER)    document.getElementById('t-silver').value = s.tiers.SILVER.min;
    if (s.showVPH   !== undefined) document.getElementById('show-vph').checked = s.showVPH;
    if (s.showMult  !== undefined) document.getElementById('show-mult').checked = s.showMult;
    if (s.showRev   !== undefined) document.getElementById('show-rev').checked = s.showRev;
    if (s.showScore !== undefined) document.getElementById('show-score').checked = s.showScore;
    if (s.showTier  !== undefined) document.getElementById('show-tier').checked = s.showTier;
  });
}

function nspGuardarGeminiKey() {
  console.log('[NSP Options] GUARDAR clicked');
  const input = document.getElementById('nsp-gemini-key');
  const status = document.getElementById('nsp-gemini-status');
  if (!input) { console.error('[NSP Options] input element missing'); alert('Error: input no encontrado'); return; }
  if (!status) { console.error('[NSP Options] status element missing'); alert('Error: status no encontrado'); return; }

  const raw = (input.value || '').trim();
  console.log('[NSP Options] key length:', raw.length, 'starts with:', raw.slice(0, 4));

  if (!raw) {
    // NO borrar la key si el campo está vacío y YA hay una guardada. Antes, apretar el
    // botón grande "GUARDAR CONFIGURACIÓN" con el input vacío BORRABA la API key buena.
    chrome.storage.local.get('nsp_gemini_api_key', (r) => {
      if (r && r.nsp_gemini_api_key) {
        status.textContent = '✓ Key conservada (el campo estaba vacío, no la borré)';
        status.style.color = 'rgba(234,240,255,.6)';
      } else {
        status.textContent = '⊘ Sin key (campo vacío)';
        status.style.color = 'rgba(234,240,255,.6)';
      }
    });
    return;
  }

  if (!raw.startsWith('AIza')) {
    status.textContent = '❌ Formato inválido — debe empezar con "AIza". Tu key empieza con: "' + raw.slice(0, 6) + '"';
    status.style.color = '#FF4F8E';
    return;
  }

  if (raw.length < 30 || raw.length > 60) {
    status.textContent = '❌ Largo inválido — debe tener entre 30-60 chars. Tu key tiene: ' + raw.length;
    status.style.color = '#FF4F8E';
    return;
  }

  status.textContent = '⏳ Guardando...';
  status.style.color = 'rgba(234,240,255,.6)';

  chrome.storage.local.set({ nsp_gemini_api_key: raw }, () => {
    if (chrome.runtime.lastError) {
      const errMsg = chrome.runtime.lastError.message || 'error desconocido';
      status.textContent = '❌ Error al guardar: ' + errMsg;
      status.style.color = '#FF4F8E';
      console.error('[NSP Options] storage set failed:', chrome.runtime.lastError);
      return;
    }
    status.textContent = '✅ GUARDADO ✓ (' + raw.slice(0, 10) + '... · ' + raw.length + ' chars) — Click 🧪 PROBAR para verificar';
    status.style.color = '#2EE9FF';
    console.log('[NSP Options] Key guardada OK');

    chrome.storage.local.get('nsp_gemini_api_key', r => {
      const stored = r && r.nsp_gemini_api_key;
      if (stored === raw) {
        console.log('[NSP Options] verify OK — storage tiene la key exacta');
      } else {
        console.warn('[NSP Options] verify FAIL — stored:', String(stored).slice(0, 10), 'expected:', raw.slice(0, 10));
        status.textContent = '⚠ Guardado reportado OK pero readback diferente. Recarga la página.';
        status.style.color = '#FFD93D';
      }
    });
  });
}

async function nspProbarGeminiKey() {
  console.log('[NSP Options] PROBAR clicked');
  const input = document.getElementById('nsp-gemini-key');
  const status = document.getElementById('nsp-gemini-status');
  const testBtn = document.getElementById('nsp-gemini-test-btn');
  if (!input || !status) { alert('DOM faltante'); return; }

  const raw = (input.value || '').trim();
  if (!raw || !raw.startsWith('AIza')) {
    status.textContent = '⚠ Pega una key válida primero (AIza...)';
    status.style.color = '#FFD93D';
    return;
  }

  if (testBtn) { testBtn.disabled = true; testBtn.textContent = '⏳ PROBANDO...'; }
  status.style.color = 'rgba(234,240,255,.6)';

  // Auto-discovery: prueba modelos en orden hasta que uno funcione
  const modelChain = [
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
  const triedLog = [];

  for (const modelName of modelChain) {
    status.textContent = '⏳ Probando ' + modelName + '... (' + (triedLog.length + 1) + '/' + modelChain.length + ')';
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(raw);
    const body = {
      contents: [{ role: 'user', parts: [{ text: 'di hola en 1 palabra' }] }],
      generationConfig: { maxOutputTokens: 12 }
    };
    try {
      const resp = await nspFetchT(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 12000);
      const data = await resp.json();
      console.log('[NSP Options] ' + modelName + ' →', data);
      if (data && data.error) {
        const code = data.error.code || 0;
        const msg = data.error.message || '';
        triedLog.push(modelName + ': ' + (data.error.status || code));
        if (code === 404 || code === 400 || code === 429 || code === 403 ||
            /not found|not supported|exceeded.*quota|limit:\s*0|permission/i.test(msg)) {
          continue; // siguiente modelo
        }
        // Error fatal → reportar
        if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR CONEXIÓN'; }
        status.textContent = '❌ Error fatal con ' + modelName + ': ' + msg;
        status.style.color = '#FF4F8E';
        return;
      }
      if (data && Array.isArray(data.candidates) && data.candidates.length) {
        const reply = (((data.candidates[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
        if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR CONEXIÓN'; }
        // Cachear el modelo ganador
        chrome.storage.local.set({ nsp_gemini_working_model: modelName }, () => {
          console.log('[NSP Options] Modelo cacheado:', modelName);
        });
        status.textContent = '✅ MODELO OK: ' + modelName + ' — respondió: "' + reply.slice(0, 40) + '"';
        status.style.color = '#2EE9FF';
        return;
      }
    } catch (err) {
      console.error('[NSP Options] ' + modelName + ' fetch threw:', err);
      triedLog.push(modelName + ': fetch_error');
      continue;
    }
  }
  // Si llegamos aquí, ningún modelo funcionó
  if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR CONEXIÓN'; }
  status.textContent = '❌ Ningún modelo Gemini disponible para tu key. Probado: ' + triedLog.slice(0, 3).join(', ') + '...';
  status.style.color = '#FF4F8E';
  console.warn('[NSP Options] Todos los modelos fallaron:', triedLog);
}

// Boot — esperar DOMContentLoaded para garantizar que los elementos existen
function nspOptionsBoot() {
  console.log('[NSP Options] DOM ready, attaching listeners');

  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      console.log('[NSP Options] save-btn (grande) clicked');
      chrome.storage.sync.set({ nsp_settings: getSettings() }, () => {
        const msg = document.getElementById('saved-msg');
        if (msg) {
          msg.classList.add('show');
          setTimeout(() => msg.classList.remove('show'), 2500);
        }
      });
      try { nspGuardarGeminiKey(); } catch(e) { console.error('[NSP Options] gemini save threw:', e); }
    });
    console.log('[NSP Options] save-btn listener attached ✓');
  } else {
    console.warn('[NSP Options] save-btn NOT found');
  }

  const gSaveBtn = document.getElementById('nsp-gemini-save-btn');
  if (gSaveBtn) {
    gSaveBtn.addEventListener('click', nspGuardarGeminiKey);
    console.log('[NSP Options] nsp-gemini-save-btn listener attached ✓');
  } else {
    console.warn('[NSP Options] nsp-gemini-save-btn NOT found');
  }

  const gTestBtn = document.getElementById('nsp-gemini-test-btn');
  if (gTestBtn) {
    gTestBtn.addEventListener('click', nspProbarGeminiKey);
    console.log('[NSP Options] nsp-gemini-test-btn listener attached ✓');
  } else {
    console.warn('[NSP Options] nsp-gemini-test-btn NOT found');
  }

  const gKeyInput = document.getElementById('nsp-gemini-key');
  if (gKeyInput) {
    gKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nspGuardarGeminiKey(); }
    });
  }

  chrome.storage.local.get('nsp_gemini_api_key', (res) => {
    const k = res && res.nsp_gemini_api_key;
    const statusEl = document.getElementById('nsp-gemini-status');
    if (k && typeof k === 'string' && /^AIza[a-zA-Z0-9\-_]{20,}$/.test(k)) {   // tolerante: antes {30,50} no repoblaba keys de 55-60 chars que SÍ se guardaron
      const inputEl = document.getElementById('nsp-gemini-key');
      if (inputEl) inputEl.value = k;
      if (statusEl) {
        statusEl.textContent = '✅ Gemini API key configurada (' + k.slice(0, 8) + '... — ' + k.length + ' chars)';
        statusEl.style.color = 'var(--accentC)';
      }
      console.log('[NSP Options] Gemini key cargada desde storage');
    } else if (statusEl) {
      statusEl.textContent = '⊘ No hay API key configurada. Pega una arriba y dale GUARDAR.';
      statusEl.style.color = 'var(--muted)';
    }
  });

  // ═════════ v3.8.0 — GROQ ═════════
  function nspGuardarGroqKey() {
    const input = document.getElementById('nsp-groq-key');
    const modelSel = document.getElementById('nsp-groq-model');
    const status = document.getElementById('nsp-groq-status');
    if (!input || !status) return;
    const raw = (input.value || '').trim();
    if (!raw) {
      chrome.storage.local.remove(['nsp_groq_api_key'], () => {
        status.textContent = '⊘ Groq key eliminada';
        status.style.color = 'rgba(234,240,255,.6)';
      });
      return;
    }
    if (!/^gsk_[A-Za-z0-9_\-]{30,}$/.test(raw)) {
      status.textContent = '❌ Formato inválido — debe empezar con "gsk_". Tu input: "' + raw.slice(0, 8) + '..."';
      status.style.color = '#FF4F8E';
      return;
    }
    status.textContent = '⏳ Guardando Groq key...';
    status.style.color = 'rgba(234,240,255,.6)';
    chrome.storage.local.set({ nsp_groq_api_key: raw, nsp_groq_model: modelSel ? modelSel.value : 'llama-3.3-70b-versatile' }, () => {
      if (chrome.runtime.lastError) {
        status.textContent = '❌ Error: ' + chrome.runtime.lastError.message;
        status.style.color = '#FF4F8E';
        return;
      }
      status.textContent = '✅ Groq guardado (' + raw.slice(0, 10) + '... · modelo ' + (modelSel ? modelSel.value : '') + ') — click PROBAR para verificar';
      status.style.color = '#FF6B6B';
    });
  }

  async function nspProbarGroqKey() {
    const input = document.getElementById('nsp-groq-key');
    const modelSel = document.getElementById('nsp-groq-model');
    const status = document.getElementById('nsp-groq-status');
    const testBtn = document.getElementById('nsp-groq-test-btn');
    if (!input || !status) return;
    const raw = (input.value || '').trim();
    if (!raw || !raw.startsWith('gsk_')) {
      status.textContent = '⚠ Pega una key Groq válida primero (gsk_...)';
      status.style.color = '#FFD93D';
      return;
    }
    const model = (modelSel && modelSel.value) || 'llama-3.3-70b-versatile';
    if (testBtn) { testBtn.disabled = true; testBtn.textContent = '⏳ PROBANDO...'; }
    status.textContent = '⏳ Probando Groq con ' + model + '...';
    status.style.color = 'rgba(234,240,255,.6)';
    try {
      const t0 = Date.now();
      const resp = await nspFetchT('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + raw },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'di "hola" en 1 palabra' }],
          max_tokens: 16
        })
      }, 12000);
      const elapsed = Date.now() - t0;
      const data = await resp.json();
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR GROQ'; }
      if (data.error) {
        status.textContent = '❌ Groq rechazó: ' + (data.error.message || JSON.stringify(data.error)).slice(0, 200);
        status.style.color = '#FF4F8E';
        return;
      }
      const reply = (((data.choices && data.choices[0]) || {}).message || {}).content || '';
      status.textContent = '✅ GROQ OK (' + elapsed + 'ms) — respondió: "' + reply.slice(0, 50) + '"';
      status.style.color = '#FF6B6B';
    } catch (err) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR GROQ'; }
      status.textContent = '❌ Error red: ' + (err.message || err);
      status.style.color = '#FF4F8E';
    }
  }

  const _groqSaveBtn = document.getElementById('nsp-groq-save-btn');
  if (_groqSaveBtn) _groqSaveBtn.addEventListener('click', nspGuardarGroqKey);
  const _groqTestBtn = document.getElementById('nsp-groq-test-btn');
  if (_groqTestBtn) _groqTestBtn.addEventListener('click', nspProbarGroqKey);

  // Cargar Groq al abrir
  chrome.storage.local.get(['nsp_groq_api_key', 'nsp_groq_model'], (res) => {
    const k = res && res.nsp_groq_api_key;
    const m = res && res.nsp_groq_model;
    const status = document.getElementById('nsp-groq-status');
    if (k) {
      const inputEl = document.getElementById('nsp-groq-key');
      if (inputEl) inputEl.value = k;
      const modelSel = document.getElementById('nsp-groq-model');
      if (modelSel && m) modelSel.value = m;
      if (status) {
        status.textContent = '✅ Groq configurado (' + k.slice(0, 10) + '... · ' + (m || 'default') + ')';
        status.style.color = '#FF6B6B';
      }
    } else if (status) {
      status.textContent = '⊘ Groq no configurado. Es opcional pero muy rápido.';
      status.style.color = 'var(--muted)';
    }
  });

  // ═════════ v3.8.0 — OLLAMA ═════════
  function nspGuardarOllama() {
    const enabled = document.getElementById('nsp-ollama-enabled');
    const urlEl = document.getElementById('nsp-ollama-url');
    const modelEl = document.getElementById('nsp-ollama-model');
    const status = document.getElementById('nsp-ollama-status');
    if (!status) return;
    const url = (urlEl && urlEl.value || 'http://localhost:11434').trim().replace(/\/$/, '');
    const model = (modelEl && modelEl.value || 'llama3.2:3b').trim();
    const isOn = !!(enabled && enabled.checked);
    status.textContent = '⏳ Guardando config Ollama...';
    status.style.color = 'rgba(234,240,255,.6)';
    chrome.storage.local.set({
      nsp_ollama_enabled: isOn,
      nsp_ollama_url: url,
      nsp_ollama_model: model
    }, () => {
      if (chrome.runtime.lastError) {
        status.textContent = '❌ Error: ' + chrome.runtime.lastError.message;
        status.style.color = '#FF4F8E';
        return;
      }
      status.textContent = '✅ Ollama guardado: ' + (isOn ? 'HABILITADO' : 'deshabilitado') + ' · ' + url + ' · ' + model;
      status.style.color = '#A88FFF';
    });
  }

  async function nspProbarOllama() {
    const urlEl = document.getElementById('nsp-ollama-url');
    const modelEl = document.getElementById('nsp-ollama-model');
    const status = document.getElementById('nsp-ollama-status');
    const testBtn = document.getElementById('nsp-ollama-test-btn');
    if (!status) return;
    const url = (urlEl && urlEl.value || 'http://localhost:11434').trim().replace(/\/$/, '');
    const model = (modelEl && modelEl.value || 'llama3.2:3b').trim();
    if (testBtn) { testBtn.disabled = true; testBtn.textContent = '⏳ PROBANDO...'; }
    status.textContent = '⏳ Pingeando Ollama en ' + url + '...';
    status.style.color = 'rgba(234,240,255,.6)';

    // Step 1: ping
    let pingOk = false;
    let tags = [];
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      const pingResp = await fetch(url + '/api/tags', { signal: ctrl.signal });
      clearTimeout(tid);
      if (pingResp.ok) {
        pingOk = true;
        const tagsData = await pingResp.json();
        tags = (tagsData.models || []).map(m => m.name);
      }
    } catch (e) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR OLLAMA'; }
      status.textContent = '❌ Ollama no responde en ' + url + '. ¿Está corriendo Ollama? Abre la app o ejecuta `ollama serve` en Terminal.';
      status.style.color = '#FF4F8E';
      return;
    }
    if (!pingOk) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR OLLAMA'; }
      status.textContent = '❌ Ollama no responde en ' + url + '. ¿Está corriendo?';
      status.style.color = '#FF4F8E';
      return;
    }

    // Step 2: verificar que el modelo existe
    if (tags.indexOf(model) === -1 && tags.indexOf(model + ':latest') === -1) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR OLLAMA'; }
      status.textContent = '⚠ Ollama corre OK pero modelo "' + model + '" no está descargado. Modelos disponibles: ' + (tags.slice(0, 5).join(', ') || 'ninguno') + '. Ejecuta: ollama pull ' + model;
      status.style.color = '#FFD93D';
      return;
    }

    // Step 3: enviar una request real
    status.textContent = '⏳ Ollama responde, enviando chat de prueba...';
    try {
      const t0 = Date.now();
      const chatResp = await fetch(url + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'di "hola" en 1 palabra' }],
          stream: false,
          options: { num_predict: 16 }
        })
      });
      const data = await chatResp.json();
      const elapsed = Date.now() - t0;
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR OLLAMA'; }
      if (data.error) {
        status.textContent = '❌ Ollama rechazó: ' + JSON.stringify(data.error).slice(0, 200);
        status.style.color = '#FF4F8E';
        return;
      }
      const reply = (((data.choices && data.choices[0]) || {}).message || {}).content || '';
      status.textContent = '✅ OLLAMA OK (' + elapsed + 'ms) — modelo "' + model + '" respondió: "' + reply.slice(0, 50) + '"';
      status.style.color = '#A88FFF';
    } catch (err) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 PROBAR OLLAMA'; }
      status.textContent = '❌ Error: ' + (err.message || err);
      status.style.color = '#FF4F8E';
    }
  }

  const _ollamaSaveBtn = document.getElementById('nsp-ollama-save-btn');
  if (_ollamaSaveBtn) _ollamaSaveBtn.addEventListener('click', nspGuardarOllama);
  const _ollamaTestBtn = document.getElementById('nsp-ollama-test-btn');
  if (_ollamaTestBtn) _ollamaTestBtn.addEventListener('click', nspProbarOllama);

  // Cargar Ollama config al abrir
  chrome.storage.local.get(['nsp_ollama_enabled', 'nsp_ollama_url', 'nsp_ollama_model'], (res) => {
    const enabledEl = document.getElementById('nsp-ollama-enabled');
    const urlEl = document.getElementById('nsp-ollama-url');
    const modelEl = document.getElementById('nsp-ollama-model');
    const status = document.getElementById('nsp-ollama-status');
    if (enabledEl) enabledEl.checked = !!(res && res.nsp_ollama_enabled);
    if (urlEl && res && res.nsp_ollama_url) urlEl.value = res.nsp_ollama_url;
    if (modelEl && res && res.nsp_ollama_model) modelEl.value = res.nsp_ollama_model;
    if (status) {
      if (res && res.nsp_ollama_enabled) {
        status.textContent = '✅ Ollama habilitado: ' + (res.nsp_ollama_url || 'localhost:11434') + ' · ' + (res.nsp_ollama_model || 'llama3.2:3b');
        status.style.color = '#A88FFF';
      } else {
        status.textContent = '⊘ Ollama deshabilitado. Marca el checkbox y guarda.';
        status.style.color = 'var(--muted)';
      }
    }
  });

  loadSettings();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', nspOptionsBoot);
} else {
  nspOptionsBoot();
}

(function initModelPicker() {
  var sel = document.getElementById('nsp-selected-model');
  if (!sel || !window.NSP_MODELS) return;
  window.NSP_MODELS.list.forEach(function (entry) {
    var opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = entry.note ? entry.label + ' — ' + entry.note : entry.label;
    sel.appendChild(opt);
  });
  chrome.storage.local.get(['nsp_selected_model'], function (res) {
    sel.value = (res && res.nsp_selected_model) || 'auto';
  });
  sel.addEventListener('change', function () {
    var entry = window.NSP_MODELS.byId(sel.value);
    chrome.storage.local.set({ nsp_selected_model: sel.value, nsp_preferred_provider: entry.provider || 'auto' });
  });
})();
