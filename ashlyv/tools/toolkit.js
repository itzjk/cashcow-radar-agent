// ashlyv/tools/toolkit.js — helpers compartidos para las herramientas ZERACK.
// IA: Groq (rápido) → Gemini (fallback). Keys que el usuario puso en Opciones
// (nsp_groq_api_key / nsp_gemini_api_key). 100% en la página de extensión (host_permissions cubren ambas APIs).
(function () {
  'use strict';
  var TK = {};

  TK.keys = function () {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(['nsp_groq_api_key', 'nsp_gemini_api_key', 'nsp_groq_model', 'nsp_gemini_working_model'], function (r) {
          resolve({
            groq: r && r.nsp_groq_api_key ? String(r.nsp_groq_api_key).trim() : '',
            gemini: r && r.nsp_gemini_api_key ? String(r.nsp_gemini_api_key).trim() : '',
            groqModel: (r && r.nsp_groq_model) || 'llama-3.3-70b-versatile',
            geminiModel: (r && r.nsp_gemini_working_model) || ''
          });
        });
      } catch (e) { resolve({ groq: '', gemini: '', groqModel: 'llama-3.3-70b-versatile', geminiModel: '' }); }
    });
  };

  TK.groq = function (k, sys, user, temp) {
    var body = { model: k.groqModel || 'llama-3.3-70b-versatile', temperature: temp == null ? 0.7 : temp, messages: [] };
    if (sys) body.messages.push({ role: 'system', content: sys });
    body.messages.push({ role: 'user', content: user });
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + k.groq, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('Groq ' + r.status + ' ' + t.slice(0, 120)); }); return r.json(); })
      .then(function (j) { return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; });
  };

  TK.gemini = function (k, sys, user, temp) {
    var models = [];
    if (k.geminiModel) models.push(k.geminiModel);
    ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'].forEach(function (m) { if (models.indexOf(m) < 0) models.push(m); });
    var prompt = (sys ? sys + '\n\n' : '') + user, i = 0;
    return new Promise(function (resolve, reject) {
      (function tryM() {
        if (i >= models.length) return reject(new Error('Gemini sin modelos disponibles'));
        var m = models[i++];
        fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(k.gemini), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: temp == null ? 0.7 : temp } })
        }).then(function (r) { if (!r.ok) throw new Error('g' + r.status); return r.json(); })
          .then(function (j) { var t = ''; try { t = j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join(''); } catch (e) {} if (!t) return tryM(); resolve(t); })
          .catch(function () { tryM(); });
      })();
    });
  };

  // Orquestador: Groq → Gemini. Rechaza con 'NOKEYS' si no hay ninguna key.
  TK.ai = function (sys, user, temp) {
    return TK.keys().then(function (k) {
      if (!k.groq && !k.gemini) return Promise.reject(new Error('NOKEYS'));
      if (k.groq && /^gsk_/.test(k.groq)) return TK.groq(k, sys, user, temp).catch(function () { if (k.gemini) return TK.gemini(k, sys, user, temp); throw new Error('Groq falló y no hay Gemini'); });
      if (k.gemini) return TK.gemini(k, sys, user, temp);
      return Promise.reject(new Error('NOKEYS'));
    });
  };

  // Extrae el primer JSON válido del texto (tolera ```json, prosa alrededor, etc.).
  TK.json = function (text) {
    if (!text) return null;
    var t = String(text).replace(/```json/gi, '```').trim();
    var a = t.indexOf('```'); if (a >= 0) { var b = t.indexOf('```', a + 3); if (b > a) t = t.slice(a + 3, b); }
    var s = t.indexOf('{'), e = t.lastIndexOf('}'), sa = t.indexOf('['), ea = t.lastIndexOf(']');
    try { if (s >= 0 && e > s && (sa < 0 || s < sa)) return JSON.parse(t.slice(s, e + 1)); } catch (x) {}
    try { if (sa >= 0 && ea > sa) return JSON.parse(t.slice(sa, ea + 1)); } catch (x) {}
    try { return JSON.parse(t); } catch (x) {}
    return null;
  };

  TK.esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  TK.copy = function (text, btn) {
    try {
      navigator.clipboard.writeText(text);
      if (btn) { var o = btn.textContent; btn.textContent = '✓ Copiado'; setTimeout(function () { btn.textContent = o; }, 1300); }
    } catch (e) {}
  };

  TK.download = function (filename, text, type) {
    try {
      var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    } catch (e) {}
  };

  TK.status = function (el, msg, tone) {
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = tone === 'error' ? '#ff6b6b' : tone === 'ok' ? '#00DC82' : tone === 'busy' ? '#FFD93D' : 'rgba(255,255,255,.6)';
  };

  // Aviso estándar cuando faltan las API keys: muestra cómo activarlas.
  TK.needKeysHTML = function () {
    return '<div class="tk-need"><div class="tk-need-ic">🔑</div>' +
      '<div class="tk-need-t">Falta tu API key (gratis)</div>' +
      '<div class="tk-need-d">Estas herramientas usan IA. Agregá tu key de <b>Groq</b> o <b>Gemini</b> (gratis) en Opciones y volvé a intentar.</div>' +
      '<button class="tk-btn primary" id="tk-open-options">⚙️ Abrir Opciones</button></div>';
  };
  TK.wireNeedKeys = function (root) {
    var b = (root || document).querySelector('#tk-open-options');
    if (b) b.addEventListener('click', TK.openOptions);
  };

  TK.openOptions = function () {
    try { if (chrome.runtime && chrome.runtime.openOptionsPage) { chrome.runtime.openOptionsPage(); return; } } catch (e) {}
    try { window.open(chrome.runtime.getURL('options/options.html'), '_blank'); } catch (e) {}
  };

  // Navega de vuelta al hub ASHLYV.
  TK.backToHub = function () {
    try { location.href = chrome.runtime.getURL('ashlyv/ashlyv.html'); } catch (e) { history.back(); }
  };

  TK.toEditor = function (script) {
    try { if (script) localStorage.setItem('zerack_handoff_script', script); } catch (e) {}
    try { location.href = chrome.runtime.getURL('dashboard/dashboard.html'); } catch (e) { location.href = '../../dashboard/dashboard.html'; }
  };
  // Manda un guion a otra herramienta del flujo (voxforge / thumbnailforge / scriptforge).
  TK.toTool = function (page, script, topic) {
    try { if (script) localStorage.setItem('zerack_handoff_script', script); } catch (e) {}
    try { if (topic) localStorage.setItem('zerack_handoff_topic', topic); } catch (e) {}
    location.href = page;
  };

  // Monta la cabecera estándar (logo + título + volver). Espera #tk-head en el DOM.
  TK.mountHead = function (title, kicker) {
    var h = document.getElementById('tk-head'); if (!h) return;
    h.innerHTML =
      '<div class="tk-brand"><span class="tk-logo">🦇</span><div><div class="tk-kicker">' + TK.esc(kicker || 'ASHLYV · ZERACK') + '</div>' +
      '<div class="tk-title">' + TK.esc(title || '') + '</div></div></div>' +
      '<button class="tk-btn ghost" id="tk-back">← Volver al hub</button>';
    var b = h.querySelector('#tk-back'); if (b) b.addEventListener('click', TK.backToHub);
  };

  window.TK = TK;
})();
