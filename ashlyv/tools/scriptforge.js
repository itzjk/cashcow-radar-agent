// ScriptPilot AI — genera guion + escenas + metadata con IA (Groq/Gemini).
(function () {
  'use strict';
  TK.mountHead('ScriptPilot AI', 'SCRIPT ENGINE');
  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status'), resultEl = $('result'), go = $('go');
  var last = null;
  try { var ht = localStorage.getItem('zerack_handoff_topic'); if (ht) { $('topic').value = ht; localStorage.removeItem('zerack_handoff_topic'); } } catch (e) {}

  function sys() {
    return 'Sos un guionista experto en canales faceless de YouTube de alto retention. ' +
      'Escribís hooks que enganchan en los primeros 5 segundos, narración fluida sin relleno, y estructura con retención. ' +
      'Respondés SIEMPRE en el idioma pedido. Devolvés EXCLUSIVAMENTE un objeto JSON válido, sin texto antes ni después, sin markdown.';
  }
  function prompt(o) {
    var nScenes = Math.max(3, Math.min(60, Math.round(o.mins * 1.4)));
    return 'Generá un guion para un video faceless de YouTube.\n' +
      'TEMA: ' + o.topic + '\nNICHO: ' + o.niche + '\nDURACIÓN OBJETIVO: ' + o.mins + ' minutos\nIDIOMA: ' + o.lang + '\nTONO: ' + o.tone + '\n\n' +
      'Devolvé un JSON con EXACTAMENTE esta forma (todo en ' + o.lang + '):\n' +
      '{\n' +
      '  "title": "título de YouTube optimizado para CTR (<=70 chars)",\n' +
      '  "hook": "primeras 2-3 frases que enganchan en los primeros 5s",\n' +
      '  "scenes": [ { "n": 1, "narration": "lo que dice la voz en off (2-4 frases)", "visual": "qué se ve en pantalla", "seconds": 12 } ],\n' +
      '  "fullScript": "el guion COMPLETO y continuo de narración, listo para leer/TTS, sin acotaciones",\n' +
      '  "cta": "llamado a la acción para el final",\n' +
      '  "description": "descripción de YouTube con 2-3 frases + 5 hashtags",\n' +
      '  "tags": ["tag1","tag2","..."]\n' +
      '}\n' +
      'Hacé ~' + nScenes + ' escenas que sumadas den ~' + o.mins + ' minutos. El fullScript debe ser sustancioso (acorde a la duración). NADA fuera del JSON.';
  }

  function run() {
    var topic = $('topic').value.trim();
    if (!topic) { TK.status(statusEl, 'Escribí un tema primero.', 'error'); return; }
    var o = { topic: topic, niche: $('niche').value, mins: +$('mins').value, lang: $('lang').value, tone: $('tone').value };
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Escribiendo guion con IA…'; statusEl.style.color = '#FFD93D';
    TK.ai(sys(), prompt(o), 0.8).then(function (txt) {
      var data = TK.json(txt);
      if (!data || !data.fullScript) { throw new Error('La IA no devolvió un guion válido. Probá de nuevo.'); }
      last = data; render(data, o);
      TK.status(statusEl, '✓ Guion listo — ' + ((data.scenes || []).length) + ' escenas.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, '⚠ ' + (e && e.message || e), 'error');
    }).then(function () { go.disabled = false; });
  }

  function block(title, bodyText, mono) {
    var wrap = document.createElement('div'); wrap.className = 'tk-block';
    var h = document.createElement('div'); h.className = 'tk-block-h';
    var t = document.createElement('span'); t.className = 'tk-bt'; t.textContent = title; h.appendChild(t);
    var cp = document.createElement('button'); cp.className = 'tk-btn sm'; cp.textContent = 'Copiar';
    cp.addEventListener('click', function () { TK.copy(bodyText, cp); }); h.appendChild(cp);
    var b = document.createElement('div'); b.className = 'tk-block-b' + (mono ? ' mono' : ''); b.textContent = bodyText;
    wrap.appendChild(h); wrap.appendChild(b); return wrap;
  }

  function render(d, o) {
    resultEl.innerHTML = '';
    // título + hook
    if (d.title) resultEl.appendChild(block('🎬 Título', d.title));
    if (d.hook) resultEl.appendChild(block('🪝 Hook (primeros 5s)', d.hook));
    // escenas
    if (d.scenes && d.scenes.length) {
      var sc = document.createElement('div'); sc.className = 'tk-card';
      var hh = document.createElement('h3'); hh.textContent = '🎞️ Breakdown por escenas (' + d.scenes.length + ')'; sc.appendChild(hh);
      d.scenes.forEach(function (s, i) {
        var row = document.createElement('div'); row.className = 'tk-scene';
        var rh = document.createElement('div'); rh.className = 'tk-scene-h';
        var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'ESCENA ' + (s.n || i + 1) + (s.seconds ? ' · ' + s.seconds + 's' : '');
        rh.appendChild(n); row.appendChild(rh);
        var tx = document.createElement('div'); tx.className = 'tk-scene-txt'; tx.textContent = s.narration || ''; row.appendChild(tx);
        if (s.visual) { var v = document.createElement('div'); v.className = 'tk-scene-meta'; v.textContent = '🎨 ' + s.visual; row.appendChild(v); }
        sc.appendChild(row);
      });
      resultEl.appendChild(sc);
    }
    // guion completo
    if (d.fullScript) resultEl.appendChild(block('📜 Guion completo (para narrar / TTS)', d.fullScript));
    if (d.cta) resultEl.appendChild(block('📣 CTA', d.cta));
    if (d.description) resultEl.appendChild(block('📝 Descripción YouTube', d.description));
    // tags
    if (d.tags && d.tags.length) {
      var tw = document.createElement('div'); tw.className = 'tk-block';
      var th = document.createElement('div'); th.className = 'tk-block-h';
      var tt = document.createElement('span'); tt.className = 'tk-bt'; tt.textContent = '🏷️ Tags'; th.appendChild(tt);
      var cp = document.createElement('button'); cp.className = 'tk-btn sm'; cp.textContent = 'Copiar'; cp.addEventListener('click', function () { TK.copy(d.tags.join(', '), cp); }); th.appendChild(cp);
      var tb = document.createElement('div'); tb.className = 'tk-block-b'; var tags = document.createElement('div'); tags.className = 'tk-tags';
      d.tags.forEach(function (tg) { var sp = document.createElement('span'); sp.className = 'tk-tag'; sp.textContent = tg; tags.appendChild(sp); });
      tb.appendChild(tags); tw.appendChild(th); tw.appendChild(tb); resultEl.appendChild(tw);
    }
    // acciones globales
    var act = document.createElement('div'); act.className = 'tk-row'; act.style.marginTop = '4px';
    var dl = document.createElement('button'); dl.className = 'tk-btn'; dl.textContent = '⬇ Descargar guion (.txt)';
    dl.addEventListener('click', function () { TK.download((d.title || 'guion').replace(/[^\w\s-]/g, '').slice(0, 50) + '.txt', d.fullScript || ''); });
    var dlj = document.createElement('button'); dlj.className = 'tk-btn'; dlj.textContent = '⬇ Descargar paquete (.json)';
    dlj.addEventListener('click', function () { TK.download((d.title || 'guion').replace(/[^\w\s-]/g, '').slice(0, 50) + '.json', JSON.stringify(d, null, 2), 'application/json'); });
    var mf = document.createElement('button'); mf.className = 'tk-btn'; mf.textContent = '🎨 Mandar a MotionForge';
    mf.addEventListener('click', function () { TK.toTool('thumbnailforge.html', d.fullScript || ''); });
    var vx = document.createElement('button'); vx.className = 'tk-btn'; vx.textContent = '🎙️ Mandar a VoxBatch';
    vx.addEventListener('click', function () { TK.toTool('voxforge.html', d.fullScript || ''); });
    var ed = document.createElement('button'); ed.className = 'tk-btn primary'; ed.textContent = 'Send to Command Center';
    ed.addEventListener('click', function () { TK.toEditor(d.fullScript || ''); });
    act.appendChild(dl); act.appendChild(dlj); act.appendChild(vx); act.appendChild(mf); act.appendChild(ed);
    resultEl.appendChild(act);
  }

  go.addEventListener('click', run);
  $('topic').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
})();
