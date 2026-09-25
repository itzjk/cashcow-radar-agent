console.log('[NSP Options] options.js loaded');

// Without a timeout the test button hangs forever when the network accepts the connection but never answers.
function nspFetchT(url, opts, ms) {
  opts = opts || {};
  var ctrl = new AbortController();
  var to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 12000);
  opts.signal = ctrl.signal;
  return fetch(url, opts).finally(function () { clearTimeout(to); });
}

// The provider cascade in background/service-worker.js accepts exactly this shape, so the page must not accept a key it would reject.
var NSP_GEMINI_KEY_RE = /^AIza[a-zA-Z0-9\-_]{30,50}$/;

function nspGeminiKeyProblem(raw) {
  raw = String(raw || '');
  if (!raw) return 'Paste a Gemini key first, starting with AIza.';
  if (raw.indexOf('AIza') !== 0) return 'Wrong format. A Gemini key starts with "AIza". Yours starts with "' + raw.slice(0, 6) + '".';
  if (raw.length < 34 || raw.length > 54) return 'Wrong length. The AI providers accept 34 to 54 characters. Yours is ' + raw.length + '.';
  if (!NSP_GEMINI_KEY_RE.test(raw)) return 'Unexpected characters. After AIza a key only uses letters, digits, hyphen and underscore.';
  return '';
}

function nspAssistantGroqModel() {
  var sel = document.getElementById('nsp-selected-model');
  var v = sel ? String(sel.value || '') : '';
  return v.indexOf('groq:') === 0 ? v.slice(5) : '';
}

function nspRenderGroqEffective(forcedFromStorage) {
  var el = document.getElementById('nsp-groq-effective');
  if (!el) return;
  var modelSel = document.getElementById('nsp-groq-model');
  var picked = (modelSel && modelSel.value) || 'llama-3.3-70b-versatile';
  var forced = forcedFromStorage || nspAssistantGroqModel();
  el.textContent = forced
    ? 'In force: ' + forced + ', set by the Assistant model above. The model picked here only applies while the Assistant model is Auto or on another provider.'
    : 'In force: ' + picked + '. The Assistant model above is not pinned to Groq, so every Groq request uses this one.';
}

function getSettings() {
  var read = function (id, dflt) {
    var el = document.getElementById(id);
    return el ? !!el.checked : dflt;
  };
  return {
    showVPH: read('show-vph', true),
    showMult: read('show-mult', true),
    showRev: read('show-rev', true),
    showScore: read('show-score', true),
    showTier: read('show-tier', true)
  };
}


function loadSettings() {
  chrome.storage.sync.get('nsp_settings', (res) => {
    const s = res.nsp_settings;
    if (!s) return;
    if (s.showVPH   !== undefined) document.getElementById('show-vph').checked = s.showVPH;
    if (s.showMult  !== undefined) document.getElementById('show-mult').checked = s.showMult;
    if (s.showRev   !== undefined) document.getElementById('show-rev').checked = s.showRev;
    if (s.showScore !== undefined) document.getElementById('show-score').checked = s.showScore;
    if (s.showTier  !== undefined) document.getElementById('show-tier').checked = s.showTier;
  });
}

function nspGuardarGeminiKey() {
  console.log('[NSP Options] save clicked');
  const input = document.getElementById('nsp-gemini-key');
  const status = document.getElementById('nsp-gemini-status');
  if (!input) { console.error('[NSP Options] input element missing'); alert('Error: input element not found'); return; }
  if (!status) { console.error('[NSP Options] status element missing'); alert('Error: status element not found'); return; }

  const raw = (input.value || '').trim();
  console.log('[NSP Options] key length:', raw.length, 'starts with:', raw.slice(0, 4));

  if (!raw) {
    // An empty field must not wipe a stored key: hitting Save with the box empty used to delete a good one.
    chrome.storage.local.get('nsp_gemini_api_key', (r) => {
      if (r && r.nsp_gemini_api_key) {
        status.textContent = 'Key kept. The field was empty, so nothing was deleted.';
        status.style.color = 'rgba(234,240,255,.6)';
      } else {
        status.textContent = 'No key set. The field is empty.';
        status.style.color = 'rgba(234,240,255,.6)';
      }
    });
    return;
  }

  var problem = nspGeminiKeyProblem(raw);
  if (problem) {
    status.textContent = problem;
    status.style.color = '#FF4F8E';
    return;
  }

  status.textContent = 'Saving';
  status.style.color = 'rgba(234,240,255,.6)';

  chrome.storage.local.set({ nsp_gemini_api_key: raw }, () => {
    if (chrome.runtime.lastError) {
      const errMsg = chrome.runtime.lastError.message || 'unknown error';
      status.textContent = 'Could not save: ' + errMsg;
      status.style.color = '#FF4F8E';
      console.error('[NSP Options] storage set failed:', chrome.runtime.lastError);
      return;
    }
    status.textContent = 'Saved: ' + raw.slice(0, 10) + '... · ' + raw.length + ' characters. Hit Test connection to check it.';
    status.style.color = '#2EE9FF';
    console.log('[NSP Options] key saved');

    chrome.storage.local.get('nsp_gemini_api_key', r => {
      const stored = r && r.nsp_gemini_api_key;
      if (stored === raw) {
        console.log('[NSP Options] verify OK, storage holds the exact key');
      } else {
        console.warn('[NSP Options] verify FAIL, stored:', String(stored).slice(0, 10), 'expected:', raw.slice(0, 10));
        status.textContent = 'The save reported success but the readback differs. Reload the page.';
        status.style.color = '#FFD93D';
      }
    });
  });
}

async function nspProbarGeminiKey() {
  console.log('[NSP Options] test clicked');
  const input = document.getElementById('nsp-gemini-key');
  const status = document.getElementById('nsp-gemini-status');
  const testBtn = document.getElementById('nsp-gemini-test-btn');
  if (!input || !status) { alert('Page elements missing'); return; }

  const raw = (input.value || '').trim();
  const problem = nspGeminiKeyProblem(raw);
  if (problem) {
    status.textContent = problem + ' A key outside that shape is never used, even if Google answers it.';
    status.style.color = '#FFD93D';
    return;
  }

  if (testBtn) { testBtn.disabled = true; testBtn.textContent = 'TESTING'; }
  status.style.color = 'rgba(234,240,255,.6)';

  // Tries each model in order until one answers, since availability varies per key.
  const modelChain = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite'
  ];
  const triedLog = [];

  for (const modelName of modelChain) {
    status.textContent = 'Testing ' + modelName + ' (' + (triedLog.length + 1) + '/' + modelChain.length + ')';
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(raw);
    const body = {
      contents: [{ role: 'user', parts: [{ text: 'say hello in one word' }] }],
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
          continue;
        }
        if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST CONNECTION'; }
        status.textContent = 'Fatal error on ' + modelName + ': ' + msg;
        status.style.color = '#FF4F8E';
        return;
      }
      if (data && Array.isArray(data.candidates) && data.candidates.length) {
        const reply = (((data.candidates[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
        if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST CONNECTION'; }
        chrome.storage.local.set({ nsp_gemini_working_model: modelName }, () => {
          console.log('[NSP Options] cached model:', modelName);
        });
        status.textContent = 'Model works: ' + modelName + '. It answered "' + reply.slice(0, 40) + '".';
        status.style.color = '#2EE9FF';
        return;
      }
    } catch (err) {
      console.error('[NSP Options] ' + modelName + ' fetch threw:', err);
      triedLog.push(modelName + ': fetch_error');
      continue;
    }
  }
  if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST CONNECTION'; }
  status.textContent = 'No Gemini model is available for this key. Tried: ' + triedLog.slice(0, 3).join(', ') + '.';
  status.style.color = '#FF4F8E';
  console.warn('[NSP Options] every model failed:', triedLog);
}

function nspOptionsBoot() {
  console.log('[NSP Options] DOM ready, attaching listeners');

  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      console.log('[NSP Options] save-btn clicked');
      chrome.storage.sync.set({ nsp_settings: getSettings() }, () => {
        const msg = document.getElementById('saved-msg');
        if (msg) {
          msg.classList.add('show');
          setTimeout(() => msg.classList.remove('show'), 2500);
        }
      });
      try { nspGuardarGeminiKey(); } catch(e) { console.error('[NSP Options] gemini save threw:', e); }
    });
    console.log('[NSP Options] save-btn listener attached');
  } else {
    console.warn('[NSP Options] save-btn NOT found');
  }

  const gSaveBtn = document.getElementById('nsp-gemini-save-btn');
  if (gSaveBtn) {
    gSaveBtn.addEventListener('click', nspGuardarGeminiKey);
    console.log('[NSP Options] nsp-gemini-save-btn listener attached');
  } else {
    console.warn('[NSP Options] nsp-gemini-save-btn NOT found');
  }

  const gTestBtn = document.getElementById('nsp-gemini-test-btn');
  if (gTestBtn) {
    gTestBtn.addEventListener('click', nspProbarGeminiKey);
    console.log('[NSP Options] nsp-gemini-test-btn listener attached');
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
    const inputEl = document.getElementById('nsp-gemini-key');
    if (!k || typeof k !== 'string') {
      if (statusEl) {
        statusEl.textContent = 'No API key set. Paste one above and hit Save key.';
        statusEl.style.color = 'var(--muted)';
      }
      return;
    }
    if (inputEl) inputEl.value = k;
    if (NSP_GEMINI_KEY_RE.test(k)) {
      if (statusEl) {
        statusEl.textContent = 'Gemini API key set: ' + k.slice(0, 8) + '... · ' + k.length + ' characters';
        statusEl.style.color = 'var(--accentC)';
      }
      console.log('[NSP Options] Gemini key loaded from storage');
    } else if (statusEl) {
      statusEl.textContent = 'The stored key is not usable: ' + nspGeminiKeyProblem(k) + ' No request will use it until you paste a valid one and hit Save key.';
      statusEl.style.color = '#FF4F8E';
    }
  });

  function nspGuardarGroqKey() {
    const input = document.getElementById('nsp-groq-key');
    const modelSel = document.getElementById('nsp-groq-model');
    const status = document.getElementById('nsp-groq-status');
    if (!input || !status) return;
    const raw = (input.value || '').trim();
    if (!raw) {
      chrome.storage.local.remove(['nsp_groq_api_key'], () => {
        status.textContent = 'Groq key removed.';
        status.style.color = 'rgba(234,240,255,.6)';
      });
      return;
    }
    if (!/^gsk_[A-Za-z0-9_\-]{30,}$/.test(raw)) {
      status.textContent = 'Wrong format. A Groq key starts with "gsk_". Yours starts with "' + raw.slice(0, 8) + '".';
      status.style.color = '#FF4F8E';
      return;
    }
    status.textContent = 'Saving the Groq key';
    status.style.color = 'rgba(234,240,255,.6)';
    const picked = modelSel ? modelSel.value : 'llama-3.3-70b-versatile';
    chrome.storage.local.set({ nsp_groq_api_key: raw, nsp_groq_model: picked }, () => {
      if (chrome.runtime.lastError) {
        status.textContent = 'Error: ' + chrome.runtime.lastError.message;
        status.style.color = '#FF4F8E';
        return;
      }
      const forced = nspAssistantGroqModel();
      let line = 'Groq saved: ' + raw.slice(0, 10) + '... · model ' + picked + '.';
      if (forced && forced !== picked) {
        line += ' The Assistant model above is pinned to ' + forced + ' and that one wins, so requests run ' + forced + '. Set the Assistant model to Auto to use ' + picked + '.';
      }
      status.textContent = line + ' Hit Test Groq to check it.';
      status.style.color = '#FF6B6B';
      nspRenderGroqEffective();
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
      status.textContent = 'Paste a valid Groq key first, starting with gsk_.';
      status.style.color = '#FFD93D';
      return;
    }
    const forced = nspAssistantGroqModel();
    const model = forced || (modelSel && modelSel.value) || 'llama-3.3-70b-versatile';
    if (testBtn) { testBtn.disabled = true; testBtn.textContent = 'TESTING'; }
    status.textContent = 'Testing Groq with ' + model + (forced ? ', the model the Assistant setting pins' : '');
    status.style.color = 'rgba(234,240,255,.6)';
    try {
      const t0 = Date.now();
      const resp = await nspFetchT('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + raw },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'say hello in one word' }],
          max_tokens: 16
        })
      }, 12000);
      const elapsed = Date.now() - t0;
      const data = await resp.json();
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST GROQ'; }
      if (data.error) {
        status.textContent = 'Groq refused: ' + (data.error.message || JSON.stringify(data.error)).slice(0, 200);
        status.style.color = '#FF4F8E';
        return;
      }
      const reply = (((data.choices && data.choices[0]) || {}).message || {}).content || '';
      status.textContent = 'Groq works, ' + elapsed + 'ms. It answered "' + reply.slice(0, 50) + '".';
      status.style.color = '#FF6B6B';
    } catch (err) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST GROQ'; }
      status.textContent = 'Network error: ' + (err.message || err);
      status.style.color = '#FF4F8E';
    }
  }

  const _groqSaveBtn = document.getElementById('nsp-groq-save-btn');
  if (_groqSaveBtn) _groqSaveBtn.addEventListener('click', nspGuardarGroqKey);
  const _groqTestBtn = document.getElementById('nsp-groq-test-btn');
  if (_groqTestBtn) _groqTestBtn.addEventListener('click', nspProbarGroqKey);
  const _groqModelSel = document.getElementById('nsp-groq-model');
  if (_groqModelSel) _groqModelSel.addEventListener('change', function () { nspRenderGroqEffective(); });

  chrome.storage.local.get(['nsp_groq_api_key', 'nsp_groq_model', 'nsp_selected_model'], (res) => {
    const k = res && res.nsp_groq_api_key;
    const m = res && res.nsp_groq_model;
    const sel = String((res && res.nsp_selected_model) || 'auto');
    const forced = sel.indexOf('groq:') === 0 ? sel.slice(5) : '';
    const status = document.getElementById('nsp-groq-status');
    if (k) {
      const inputEl = document.getElementById('nsp-groq-key');
      if (inputEl) inputEl.value = k;
      const modelSel = document.getElementById('nsp-groq-model');
      if (modelSel && m) modelSel.value = m;
      if (status) {
        status.textContent = 'Groq is set up: ' + k.slice(0, 10) + '... · ' + (forced || m || 'llama-3.3-70b-versatile');
        status.style.color = '#FF6B6B';
      }
    } else if (status) {
      status.textContent = 'Groq is not set up. It is optional, but it is the fastest option.';
      status.style.color = 'var(--muted)';
    }
    nspRenderGroqEffective(forced);
  });

  function nspGuardarOllama() {
    const enabled = document.getElementById('nsp-ollama-enabled');
    const urlEl = document.getElementById('nsp-ollama-url');
    const modelEl = document.getElementById('nsp-ollama-model');
    const status = document.getElementById('nsp-ollama-status');
    if (!status) return;
    const url = (urlEl && urlEl.value || 'http://localhost:11434').trim().replace(/\/$/, '');
    const model = (modelEl && modelEl.value || 'llama3.2:3b').trim();
    const isOn = !!(enabled && enabled.checked);
    status.textContent = 'Saving the Ollama settings';
    status.style.color = 'rgba(234,240,255,.6)';
    chrome.storage.local.set({
      nsp_ollama_enabled: isOn,
      nsp_ollama_url: url,
      nsp_ollama_model: model
    }, () => {
      if (chrome.runtime.lastError) {
        status.textContent = 'Error: ' + chrome.runtime.lastError.message;
        status.style.color = '#FF4F8E';
        return;
      }
      status.textContent = 'Ollama saved: ' + (isOn ? 'enabled' : 'disabled') + ' · ' + url + ' · ' + model;
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
    if (testBtn) { testBtn.disabled = true; testBtn.textContent = 'TESTING'; }
    status.textContent = 'Pinging Ollama at ' + url;
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
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST OLLAMA'; }
      status.textContent = 'Ollama is not answering at ' + url + '. Open the app or run `ollama serve` in a terminal.';
      status.style.color = '#FF4F8E';
      return;
    }
    if (!pingOk) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST OLLAMA'; }
      status.textContent = 'Ollama is not answering at ' + url + '. Is it running?';
      status.style.color = '#FF4F8E';
      return;
    }

    // Step 2: check the model exists
    if (tags.indexOf(model) === -1 && tags.indexOf(model + ':latest') === -1) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST OLLAMA'; }
      status.textContent = 'Ollama is running, but the model "' + model + '" is not downloaded. Available: ' + (tags.slice(0, 5).join(', ') || 'none') + '. Run: ollama pull ' + model;
      status.style.color = '#FFD93D';
      return;
    }

    // Step 3: send a real request
    status.textContent = 'Ollama answered. Sending a test message';
    try {
      const t0 = Date.now();
      const chatResp = await fetch(url + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'say hello in one word' }],
          stream: false,
          options: { num_predict: 16 }
        })
      });
      const data = await chatResp.json();
      const elapsed = Date.now() - t0;
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST OLLAMA'; }
      if (data.error) {
        status.textContent = 'Ollama refused: ' + JSON.stringify(data.error).slice(0, 200);
        status.style.color = '#FF4F8E';
        return;
      }
      const reply = (((data.choices && data.choices[0]) || {}).message || {}).content || '';
      status.textContent = 'Ollama works, ' + elapsed + 'ms. Model "' + model + '" answered "' + reply.slice(0, 50) + '".';
      status.style.color = '#A88FFF';
    } catch (err) {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'TEST OLLAMA'; }
      status.textContent = 'Error: ' + (err.message || err);
      status.style.color = '#FF4F8E';
    }
  }

  const _ollamaSaveBtn = document.getElementById('nsp-ollama-save-btn');
  if (_ollamaSaveBtn) _ollamaSaveBtn.addEventListener('click', nspGuardarOllama);
  const _ollamaTestBtn = document.getElementById('nsp-ollama-test-btn');
  if (_ollamaTestBtn) _ollamaTestBtn.addEventListener('click', nspProbarOllama);

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
        status.textContent = 'Ollama is enabled: ' + (res.nsp_ollama_url || 'localhost:11434') + ' · ' + (res.nsp_ollama_model || 'llama3.2:3b');
        status.style.color = '#A88FFF';
      } else {
        status.textContent = 'Ollama is disabled. Tick the checkbox and save.';
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
    nspRenderGroqEffective();
  });
  sel.addEventListener('change', function () {
    var entry = window.NSP_MODELS.byId(sel.value);
    chrome.storage.local.set({ nsp_selected_model: sel.value, nsp_preferred_provider: entry.provider || 'auto' });
    nspRenderGroqEffective();
  });
})();

(function initVisionConsent() {
  var box = document.getElementById('nsp-vision-allowed');
  if (!box) return;
  chrome.storage.local.get(['nsp_vision_allowed'], function (res) {
    box.checked = !!(res && res.nsp_vision_allowed === true);
  });
  box.addEventListener('change', function () {
    chrome.storage.local.set({ nsp_vision_allowed: !!box.checked });
  });
})();
