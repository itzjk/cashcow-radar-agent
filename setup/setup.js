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

function saveKey(which) {
  var isGroq = which === 'groq';
  var input = el(isGroq ? 'groq-key' : 'gemini-key');
  var status = el(isGroq ? 'groq-status' : 'gemini-status');
  var raw = (input.value || '').trim();
  var shape = isGroq ? /^gsk_[A-Za-z0-9_-]{30,}$/ : /^AIza[A-Za-z0-9_-]{30,50}$/;

  if (!raw) { status.textContent = 'Paste the key first.'; status.className = 'status bad'; return; }
  if (!shape.test(raw)) {
    status.textContent = isGroq
      ? 'That does not look like a Groq key. It starts with gsk_ and is longer than this one.'
      : 'That does not look like a Gemini key. It starts with AIza.';
    status.className = 'status bad';
    return;
  }

  var payload = {};
  payload[isGroq ? 'nsp_groq_api_key' : 'nsp_gemini_api_key'] = raw;
  payload.nsp_selected_model = isGroq ? 'groq:llama-3.3-70b-versatile' : 'gemini:gemini-2.0-flash';
  payload.nsp_preferred_provider = isGroq ? 'groq' : 'gemini';

  chrome.storage.local.set(payload, function () {
    status.textContent = 'Saved. The assistant answers with ' + (isGroq ? 'Llama 3.3 70B on Groq' : 'Gemini 2.0 Flash') + ' now.';
    status.className = 'status good';
    input.value = raw.slice(0, 6) + '...' + raw.slice(-4);
    input.disabled = true;
    refreshCloudTag();
  });
}

function refreshCloudTag() {
  chrome.storage.local.get(['nsp_groq_api_key', 'nsp_gemini_api_key'], function (r) {
    var has = [];
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

  chrome.storage.local.get(['nsp_groq_api_key', 'nsp_gemini_api_key'], function (r) {
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
