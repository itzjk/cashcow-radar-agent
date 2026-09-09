// VoxBatch Pro — divide el guion en escenas y las narra con la voz del navegador (speechSynthesis).
(function () {
  'use strict';
  TK.mountHead('VoxBatch Pro', 'VOICE ENGINE');
  var $ = function (id) { return document.getElementById(id); };
  var scriptEl = $('script'), voiceSel = $('voice'), rate = $('rate'), pitch = $('pitch'),
    statusEl = $('status'), resultEl = $('result');
  var scenes = [], voices = [];
  var synth = window.speechSynthesis || null;

  // handoff desde ScriptPilot
  try { var h = localStorage.getItem('zerack_handoff_script'); if (h && !scriptEl.value) { scriptEl.value = h; localStorage.removeItem('zerack_handoff_script'); } } catch (e) {}

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices() || [];
    // prioriza español, luego el resto
    voices.sort(function (a, b) {
      var pa = /^es/i.test(a.lang) ? 0 : 1, pb = /^es/i.test(b.lang) ? 0 : 1;
      return pa - pb || a.lang.localeCompare(b.lang);
    });
    voiceSel.innerHTML = '';
    if (!voices.length) { var o = document.createElement('option'); o.textContent = '(sin voces — usá otra plataforma)'; voiceSel.appendChild(o); return; }
    voices.forEach(function (v, i) { var o = document.createElement('option'); o.value = i; o.textContent = v.name + ' · ' + v.lang + (v.default ? ' (def)' : ''); voiceSel.appendChild(o); });
  }
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  else TK.status(statusEl, 'Tu navegador no soporta voz del sistema. Usá Chrome.', 'error');

  rate.addEventListener('input', function () { $('rateV').textContent = (+rate.value).toFixed(2); });
  pitch.addEventListener('input', function () { $('pitchV').textContent = (+pitch.value).toFixed(2); });

  function splitScenes(text) {
    var mode = $('chunk').value;
    text = String(text || '').replace(/\r/g, '').trim();
    if (!text) return [];
    if (mode === 'para') return text.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    // por frases
    var sents = text.replace(/\n+/g, ' ').match(/[^.!?…]+[.!?…]*/g) || [text];
    sents = sents.map(function (s) { return s.trim(); }).filter(Boolean);
    if (mode === 'sent') return sents;
    var per = parseInt(mode, 10) || 2, out = [];
    for (var i = 0; i < sents.length; i += per) out.push(sents.slice(i, i + per).join(' '));
    return out;
  }

  function estSecs(text) { var w = (text.match(/\S+/g) || []).length; return Math.max(1, Math.round(w / 2.6 / (+rate.value || 1))); }
  function fmt(s) { var m = Math.floor(s / 60), ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }

  function build() {
    scenes = splitScenes(scriptEl.value);
    if (!scenes.length) { TK.status(statusEl, 'Pegá un guion primero.', 'error'); return; }
    var total = scenes.reduce(function (a, s) { return a + estSecs(s); }, 0);
    TK.status(statusEl, '✓ ' + scenes.length + ' escenas · ~' + fmt(total) + ' de narración estimada.', 'ok');
    render();
  }

  function speak(text, onend) {
    // v4.43.0 FIX cola colgada: antes solo había u.onend. Si una escena ERRABA al hablar
    // ('interrupted' por un cancel, texto raro, motor de voz que falla) o synth.speak() tiraba,
    // onend NUNCA se llamaba y playAll quedaba COLGADO en esa escena para siempre (status atascado).
    // Ahora cualquier final —ok, error o excepción— avanza la cola EXACTAMENTE una vez (guard "once").
    // Camino feliz idéntico: onend dispara → fin() → onend original, una sola vez.
    var done = false;
    var fin = function () { if (done) return; done = true; if (onend) onend(); };
    if (!synth) { fin(); return; }
    try {
      var u = new SpeechSynthesisUtterance(text);
      var vi = parseInt(voiceSel.value, 10); if (voices[vi]) { u.voice = voices[vi]; u.lang = voices[vi].lang; }
      u.rate = +rate.value || 1; u.pitch = +pitch.value || 1;
      u.onend = fin;
      u.onerror = fin;
      synth.speak(u);
    } catch (e) { fin(); }
  }

  function highlight(idx) {
    var rows = resultEl.querySelectorAll('.tk-scene');
    rows.forEach(function (r, i) { r.style.borderColor = (i === idx) ? '#00DC82' : 'rgba(255,255,255,.10)'; r.style.boxShadow = (i === idx) ? '0 0 0 2px rgba(0,220,130,.18)' : 'none'; });
  }

  function playAll() {
    if (!scenes.length) build();
    if (!scenes.length || !synth) return;
    synth.cancel();
    var i = 0;
    (function next() {
      if (i >= scenes.length) { highlight(-1); TK.status(statusEl, '✓ Narración completa.', 'ok'); return; }
      highlight(i); TK.status(statusEl, '🔊 Reproduciendo escena ' + (i + 1) + '/' + scenes.length + '…', 'busy');
      speak(scenes[i], function () { i++; next(); });
    })();
  }

  function ssml() {
    var v = voices[parseInt(voiceSel.value, 10)];
    var lang = v ? v.lang : 'es-ES';
    var ratePct = Math.round((+rate.value) * 100) + '%';
    var s = '<?xml version="1.0"?>\n<speak version="1.0" xml:lang="' + lang + '">\n';
    scenes.forEach(function (sc, i) {
      s += '  <!-- escena ' + (i + 1) + ' -->\n  <prosody rate="' + ratePct + '" pitch="' + (((+pitch.value) - 1) * 10).toFixed(0) + 'st">' +
        TK.esc(sc) + '</prosody>\n  <break time="600ms"/>\n';
    });
    s += '</speak>\n';
    return s;
  }

  function render() {
    resultEl.innerHTML = '';
    var card = document.createElement('div'); card.className = 'tk-card';
    var h = document.createElement('h3'); h.textContent = '🎙️ Cola de narración (' + scenes.length + ' escenas)'; card.appendChild(h);
    scenes.forEach(function (sc, i) {
      var row = document.createElement('div'); row.className = 'tk-scene';
      var rh = document.createElement('div'); rh.className = 'tk-scene-h';
      var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'ESCENA ' + (i + 1) + ' · ~' + estSecs(sc) + 's'; rh.appendChild(n);
      var play = document.createElement('button'); play.className = 'tk-btn sm'; play.textContent = '▶ Escuchar';
      play.addEventListener('click', function () { if (synth) synth.cancel(); highlight(i); speak(sc, function () { highlight(-1); }); });
      rh.appendChild(play); row.appendChild(rh);
      var tx = document.createElement('div'); tx.className = 'tk-scene-txt'; tx.textContent = sc; row.appendChild(tx);
      card.appendChild(row);
    });
    resultEl.appendChild(card);
    var tip = document.createElement('div'); tip.className = 'tk-sub';
    tip.innerHTML = '💡 La voz suena en el navegador (no se puede guardar como archivo desde acá). Para narración final: grabá esta voz, usá tu motor TTS con el SSML exportado, o subí tu MP3 directo a <b>Monetize Studio</b>.';
    resultEl.appendChild(tip);
  }

  $('build').addEventListener('click', build);
  $('playAll').addEventListener('click', playAll);
  $('stop').addEventListener('click', function () { if (synth) synth.cancel(); highlight(-1); TK.status(statusEl, 'Detenido.', ''); });
  $('dlssml').addEventListener('click', function () { if (!scenes.length) build(); if (scenes.length) TK.download('narracion.ssml', ssml(), 'application/ssml+xml'); });
  if (scriptEl.value.trim()) build();
})();
