var OLLAMA = 'http://127.0.0.1:11434';

var PULLABLE = [
  { name: 'llama3.2:3b', label: 'Llama 3.2 3B', size: 'about 2 GB', good: 'Light. Runs on almost any laptop.' },
  { name: 'qwen2.5:7b-instruct', label: 'Qwen 2.5 7B', size: 'about 4.7 GB', good: 'The best answers of the three if you have 16 GB of memory.' },
  { name: 'llama3.1:8b', label: 'Llama 3.1 8B', size: 'about 4.7 GB', good: 'Solid all rounder.' }
];

function el(id) { return document.getElementById(id); }

function setTag(id, text, tone) {
  var t = el(id);
  if (!t) return;
  t.textContent = text;
  t.className = 'tag' + (tone ? ' ' + tone : '');
}

function ollamaFetch(path, options) {
  return fetch(OLLAMA + path, options);
}

function listInstalled() {
  return ollamaFetch('/api/tags').then(function (r) {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }).then(function (d) {
    return (d && d.models ? d.models : []).map(function (m) { return m.name; });
  });
}

function renderModels(installed) {
  var box = el('model-list');
  box.textContent = '';
  PULLABLE.forEach(function (m) {
    var row = document.createElement('div');
    row.className = 'model';

    var left = document.createElement('div');
    var name = document.createElement('div');
    name.className = 'model-name';
    name.textContent = m.label;
    var meta = document.createElement('div');
    meta.className = 'model-meta';
    meta.textContent = m.size + '. ' + m.good;
    left.appendChild(name);
    left.appendChild(meta);

    var right = document.createElement('div');
    right.className = 'model-action';
    var have = installed.some(function (i) { return i === m.name || i.indexOf(m.name.split(':')[0] + ':') === 0; });
    var btn = document.createElement('button');
    btn.className = 'btn';

    if (have) {
      btn.textContent = 'Use this one';
      btn.addEventListener('click', function () { useLocal(m, btn); });
    } else {
      btn.textContent = 'Download';
      btn.addEventListener('click', function () { pull(m, btn, right); });
    }
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);
    box.appendChild(row);
  });
}

function useLocal(m, btn) {
  chrome.storage.local.set({
    nsp_ollama_enabled: true,
    nsp_ollama_url: OLLAMA,
    nsp_ollama_model: m.name,
    nsp_selected_model: 'ollama:local',
    nsp_preferred_provider: 'ollama'
  }, function () {
    btn.textContent = 'In use';
    btn.disabled = true;
    el('ollama-hint').textContent = 'The assistant will answer with ' + m.label + ' from now on. You can change it in the chat, under Model.';
  });
}

function pull(m, btn, holder) {
  btn.disabled = true;
  btn.textContent = 'Starting';
  var bar = document.createElement('div');
  bar.className = 'bar';
  var fill = document.createElement('div');
  fill.className = 'bar-fill';
  bar.appendChild(fill);
  var pct = document.createElement('div');
  pct.className = 'model-meta';
  holder.appendChild(bar);
  holder.appendChild(pct);

  ollamaFetch('/api/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: m.name, stream: true })
  }).then(function (res) {
    if (!res.ok || !res.body) throw new Error('http ' + res.status);
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function step() {
      return reader.read().then(function (chunk) {
        if (chunk.done) {
          btn.textContent = 'Use this one';
          btn.disabled = false;
          btn.onclick = null;
          btn.addEventListener('click', function () { useLocal(m, btn); });
          pct.textContent = 'Downloaded. Press Use this one.';
          fill.style.width = '100%';
          return;
        }
        buffer += decoder.decode(chunk.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(function (line) {
          if (!line.trim()) return;
          var data = null;
          try { data = JSON.parse(line); } catch (e) { return; }
          if (data.error) {
            pct.textContent = 'Ollama refused: ' + data.error;
            btn.textContent = 'Retry';
            btn.disabled = false;
            return;
          }
          if (data.total && data.completed) {
            var done = Math.round((data.completed / data.total) * 100);
            fill.style.width = done + '%';
            pct.textContent = data.status + ', ' + done + ' percent';
          } else if (data.status) {
            pct.textContent = data.status;
          }
        });
        return step();
      });
    }
    btn.textContent = 'Downloading';
    return step();
  }).catch(function (e) {
    pct.textContent = 'Could not download: ' + (e && e.message ? e.message : 'unknown error');
    btn.textContent = 'Retry';
    btn.disabled = false;
  });
}

function checkOllama() {
  setTag('ollama-state', 'checking');
  el('ollama-missing').hidden = true;
  el('ollama-ready').hidden = true;
  listInstalled().then(function (installed) {
    setTag('ollama-state', 'running', 'good');
    el('ollama-ready').hidden = false;
    renderModels(installed);
    chrome.storage.local.get(['nsp_ollama_model', 'nsp_selected_model'], function (r) {
      if (r && r.nsp_selected_model === 'ollama:local' && r.nsp_ollama_model) {
        el('ollama-hint').textContent = 'The assistant is answering with ' + r.nsp_ollama_model + ' right now.';
      } else if (installed.length) {
        el('ollama-hint').textContent = 'Ollama already has ' + installed.length + ' model(s). Press Use this one on any of them.';
      }
    });
  }).catch(function () {
    setTag('ollama-state', 'not running', 'bad');
    el('ollama-missing').hidden = false;
  });
}

var PROVIDER_FIELDS = {
  openai: { input: 'openai-key', status: 'openai-status', storeKey: 'nsp_openai_api_key', shape: /^sk-[A-Za-z0-9_-]{20,}$/, model: 'openai:gpt-4o-mini', label: 'GPT-4o mini', hint: 'That does not look like an OpenAI key. It starts with sk-.' },
  groq: { input: 'groq-key', status: 'groq-status', storeKey: 'nsp_groq_api_key', shape: /^gsk_[A-Za-z0-9_-]{30,}$/, model: 'groq:llama-3.3-70b-versatile', label: 'Llama 3.3 70B on Groq', hint: 'That does not look like a Groq key. It starts with gsk_ and is longer than this one.' },
  gemini: { input: 'gemini-key', status: 'gemini-status', storeKey: 'nsp_gemini_api_key', shape: /^AIza[A-Za-z0-9_-]{30,50}$/, model: 'gemini:gemini-2.0-flash', label: 'Gemini 2.0 Flash', hint: 'That does not look like a Gemini key. It starts with AIza.' }
};

function saveKey(which) {
  var cfg = PROVIDER_FIELDS[which];
  if (!cfg) return;
  var input = el(cfg.input);
  var status = el(cfg.status);
  var raw = (input.value || '').trim();
  var shape = cfg.shape;

  if (!raw) { status.textContent = 'Paste the key first.'; status.className = 'status bad'; return; }
  if (!shape.test(raw)) {
    status.textContent = cfg.hint;
    status.className = 'status bad';
    return;
  }

  var payload = {};
  payload[cfg.storeKey] = raw;
  payload.nsp_selected_model = cfg.model;
  payload.nsp_preferred_provider = which;

  chrome.storage.local.set(payload, function () {
    status.textContent = 'Saved. The assistant answers with ' + cfg.label + ' now.';
    status.className = 'status good';
    input.value = raw.slice(0, 6) + '...' + raw.slice(-4);
    input.disabled = true;
    refreshCloudTag();
  });
}

function refreshCloudTag() {
  chrome.storage.local.get(['nsp_groq_api_key', 'nsp_gemini_api_key', 'nsp_openai_api_key'], function (r) {
    var has = [];
    if (r && r.nsp_openai_api_key) has.push('OpenAI');
    if (r && r.nsp_groq_api_key) has.push('Groq');
    if (r && r.nsp_gemini_api_key) has.push('Gemini');
    if (has.length) setTag('cloud-state', has.join(' and ') + ' set', 'good');
    else setTag('cloud-state', 'no key yet');
  });
}

document.addEventListener('DOMContentLoaded', function () {
  checkOllama();
  refreshCloudTag();
  el('btn-recheck').addEventListener('click', checkOllama);
  el('save-openai').addEventListener('click', function () { saveKey('openai'); });
  el('save-groq').addEventListener('click', function () { saveKey('groq'); });
  el('save-gemini').addEventListener('click', function () { saveKey('gemini'); });

  document.querySelectorAll('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var src = el(b.dataset.copy);
      if (!src) return;
      navigator.clipboard.writeText(src.textContent).then(function () {
        var was = b.textContent;
        b.textContent = 'Copied';
        setTimeout(function () { b.textContent = was; }, 1400);
      });
    });
  });

  chrome.storage.local.get(['nsp_groq_api_key', 'nsp_gemini_api_key', 'nsp_openai_api_key'], function (r) {
    if (r && r.nsp_openai_api_key) {
      el('openai-key').value = r.nsp_openai_api_key.slice(0, 6) + '...' + r.nsp_openai_api_key.slice(-4);
      el('openai-key').disabled = true;
      el('openai-status').textContent = 'A key is already stored.';
      el('openai-status').className = 'status good';
    }
    if (r && r.nsp_groq_api_key) {
      el('groq-key').value = r.nsp_groq_api_key.slice(0, 6) + '...' + r.nsp_groq_api_key.slice(-4);
      el('groq-key').disabled = true;
      el('groq-status').textContent = 'A key is already stored.';
      el('groq-status').className = 'status good';
    }
    if (r && r.nsp_gemini_api_key) {
      el('gemini-key').value = r.nsp_gemini_api_key.slice(0, 6) + '...' + r.nsp_gemini_api_key.slice(-4);
      el('gemini-key').disabled = true;
      el('gemini-status').textContent = 'A key is already stored.';
      el('gemini-status').className = 'status good';
    }
  });
});

var ZERACK_DEFAULT_VOICE = 'b7db3acd5f3f40a1b143f4e1ea95db8c';

function maskKey(raw) {
  return raw.length > 12 ? raw.slice(0, 5) + '...' + raw.slice(-4) : '...';
}

function lockField(inputId, statusId, raw, message) {
  var input = el(inputId);
  input.value = maskKey(raw);
  input.disabled = true;
  var st = el(statusId);
  st.textContent = message;
  st.className = 'status good';
}

function saveFish() {
  var raw = (el('fish-key').value || '').trim();
  var voice = (el('fish-voice').value || '').trim() || ZERACK_DEFAULT_VOICE;
  var st = el('fish-status');
  if (!raw) { st.textContent = 'Paste the key first.'; st.className = 'status bad'; return; }
  if (raw === voice) { st.textContent = 'That is the voice id, not the key. The key is under API Keys in Fish.'; st.className = 'status bad'; return; }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(raw)) { st.textContent = 'That does not look like a Fish Audio key.'; st.className = 'status bad'; return; }
  if (!/^[a-f0-9]{32}$/.test(voice)) { st.textContent = 'The voice id should be 32 letters and numbers, from the voice page in Fish.'; st.className = 'status bad'; return; }
  chrome.storage.local.set({ nsp_fish_api_key: raw, nsp_fish_voice_id: voice, nsp_voice_engine: 'fish' }, function () {
    lockField('fish-key', 'fish-status', raw, 'Saved. The assistant will speak with this voice.');
  });
}

function saveTypesafe() {
  var raw = (el('typesafe-key').value || '').trim();
  var st = el('typesafe-status');
  if (!raw) { st.textContent = 'Paste the key first.'; st.className = 'status bad'; return; }
  if (raw.length < 20 || /\s/.test(raw)) { st.textContent = 'That does not look like a TypeSafe key.'; st.className = 'status bad'; return; }
  chrome.storage.local.set({ nsp_typesafe_api_key: raw }, function () {
    lockField('typesafe-key', 'typesafe-status', raw, 'Saved. Commands will be routed through Jev.');
  });
}

function saveGateway() {
  var raw = (el('gateway-key').value || '').trim();
  var st = el('gateway-status');
  if (!raw) { st.textContent = 'Paste the key first.'; st.className = 'status bad'; return; }
  if (raw.length < 20 || /\s/.test(raw)) { st.textContent = 'That does not look like a Vercel AI Gateway key.'; st.className = 'status bad'; return; }
  chrome.storage.local.set({ nsp_ai_gateway_api_key: raw }, function () {
    lockField('gateway-key', 'gateway-status', raw, 'Saved. Commands will be routed through Jev on Vercel.');
  });
}

function loadExtraKeys() {
  chrome.storage.local.get(['nsp_fish_api_key', 'nsp_fish_voice_id', 'nsp_typesafe_api_key', 'nsp_ai_gateway_api_key'], function (r) {
    r = r || {};
    el('fish-voice').value = r.nsp_fish_voice_id || ZERACK_DEFAULT_VOICE;
    if (r.nsp_fish_api_key) lockField('fish-key', 'fish-status', r.nsp_fish_api_key, 'A key is already stored.');
    if (r.nsp_typesafe_api_key) lockField('typesafe-key', 'typesafe-status', r.nsp_typesafe_api_key, 'A key is already stored.');
    if (r.nsp_ai_gateway_api_key) lockField('gateway-key', 'gateway-status', r.nsp_ai_gateway_api_key, 'A key is already stored.');
  });
}

document.addEventListener('DOMContentLoaded', function () {
  el('save-fish').addEventListener('click', saveFish);
  el('save-typesafe').addEventListener('click', saveTypesafe);
  el('save-gateway').addEventListener('click', saveGateway);
  loadExtraKeys();
});
