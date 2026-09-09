// MotionForge Studio — convierte un guion en prompts visuales por escena + conceptos de miniatura.
(function () {
  'use strict';
  TK.mountHead('MotionForge Studio', 'VISUAL ENGINE');
  var $ = function (id) { return document.getElementById(id); };
  var scriptEl = $('script'), statusEl = $('status'), resultEl = $('result'), go = $('go');

  var _fromHandoff = false;
  try { var h = localStorage.getItem('zerack_handoff_script'); if (h && !scriptEl.value) { scriptEl.value = h; _fromHandoff = true; localStorage.removeItem('zerack_handoff_script'); } } catch (e) {}

  function sys() {
    return 'Sos director de arte de canales faceless de YouTube. Convertís un guion en un plan visual coherente. ' +
      'Los prompts de imagen/video los escribís SIEMPRE en INGLÉS (funcionan mejor en los generadores) y son detallados (sujeto, ambiente, luz, lente, mood). ' +
      'Devolvés EXCLUSIVAMENTE un JSON válido, sin texto extra ni markdown.';
  }
  function prompt(script, look, ar, max) {
    return 'GUION:\n"""' + script.slice(0, 6000) + '"""\n\n' +
      'ESTÉTICA GLOBAL: ' + look + '\nFORMATO: ' + ar + '\nMÁX ESCENAS: ' + max + '\n\n' +
      'Devolvé un JSON con esta forma:\n' +
      '{\n' +
      '  "style": "1-2 frases con la dirección de arte global (paleta, luz, mood, lente) — en español",\n' +
      '  "scenes": [ { "n": 1, "summary": "qué pasa en la escena (español, breve)", "imagePrompt": "detailed ENGLISH prompt, includes ' + ar + ' and the global aesthetic", "motion": "camera/animation note in English (e.g. slow push in)" } ],\n' +
      '  "thumbnails": [ { "concept": "idea de la miniatura (español)", "text": "TEXTO grande overlay (<=4 palabras, en el idioma del guion)", "prompt": "ENGLISH thumbnail image prompt, high CTR, bold, ' + ar + '" } ]\n' +
      '}\n' +
      'Generá hasta ' + max + ' escenas que cubran el guion en orden, y 3 thumbnails. Todos los imagePrompt deben compartir la MISMA estética para que el video sea coherente. NADA fuera del JSON.';
  }

  function genImage(key, p) {
    var body = { contents: [{ parts: [{ text: 'Generate ONE image. ' + p + ' Absolutely NO text, letters, words or watermark inside the image.' }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
    var models = ['gemini-2.0-flash-preview-image-generation', 'gemini-2.5-flash-image-preview', 'gemini-2.5-flash-image'], i = 0;
    return new Promise(function (resolve, reject) {
      (function tryM() {
        if (i >= models.length) return reject(new Error('Gemini no devolvió imagen (modelo no disponible en tu key).'));
        var m = models[i++];
        fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        }).then(function (r) { if (!r.ok) throw new Error('g' + r.status); return r.json(); })
          .then(function (j) {
            var parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
            var img = null;
            parts.forEach(function (pt) { var dd = pt.inlineData || pt.inline_data; if (dd && dd.data) img = 'data:' + ((dd.mimeType || dd.mime_type) || 'image/png') + ';base64,' + dd.data; });
            if (!img) return tryM();
            resolve(img);
          }).catch(function () { tryM(); });
      })();
    });
  }
  var _gkey = '';

  function run() {
    var script = scriptEl.value.trim();
    if (!script) { TK.status(statusEl, 'Pegá un guion o un nicho primero.', 'error'); return; }
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Diseñando el plan visual…'; statusEl.style.color = '#FFD93D';
    TK.keys().then(function (k) {
      _gkey = (k && k.gemini && /^AIza/.test(k.gemini)) ? k.gemini : '';
      return TK.ai(sys(), prompt(script, $('look').value, $('ar').value, +$('max').value), 0.7);
    }).then(function (txt) {
      var d = TK.json(txt);
      if (!d || (!d.scenes && !d.thumbnails)) throw new Error('La IA no devolvió un plan válido. Probá de nuevo.');
      render(d);
      TK.status(statusEl, '✓ Plan visual listo — ' + ((d.scenes || []).length) + ' escenas + ' + ((d.thumbnails || []).length) + ' miniaturas.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, '⚠ ' + (e && e.message || e), 'error');
    }).then(function () { go.disabled = false; });
  }

  function copyBtn(text, label) {
    var b = document.createElement('button'); b.className = 'tk-btn sm'; b.textContent = label || 'Copiar';
    b.addEventListener('click', function () { TK.copy(text, b); }); return b;
  }

  function thumbCard(card, t, i) {
    var row = document.createElement('div'); row.className = 'tk-scene';
    var rh = document.createElement('div'); rh.className = 'tk-scene-h';
    var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'OPCIÓN ' + (i + 1); rh.appendChild(n);
    rh.appendChild(copyBtn(t.prompt || '', 'Copiar prompt')); row.appendChild(rh);
    if (t.concept) { var cc = document.createElement('div'); cc.className = 'tk-scene-meta'; cc.textContent = t.concept; row.appendChild(cc); }
    if (t.text) { var tt = document.createElement('div'); tt.style.cssText = 'font-size:14px;font-weight:900;color:#fff;margin:4px 0;'; tt.textContent = 'TEXTO GRANDE: “' + t.text + '”'; row.appendChild(tt); }
    var holder = document.createElement('div');
    holder.style.cssText = 'width:100%;max-width:360px;aspect-ratio:16/9;border-radius:12px;margin:8px 0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.55);overflow:hidden;text-align:center;padding:8px;';
    row.appendChild(holder);
    var ctr = document.createElement('div'); ctr.className = 'tk-row'; row.appendChild(ctr);
    card.appendChild(row);
    var p = t.prompt || ('Cinematic high-CTR YouTube thumbnail background, ' + (t.concept || ''));
    function paint(dataUrl) {
      holder.innerHTML = ''; holder.style.padding = '0';
      var img = document.createElement('img'); img.src = dataUrl; img.alt = 'miniatura'; img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      holder.appendChild(img); ctr.innerHTML = '';
      var dl = document.createElement('button'); dl.className = 'tk-btn sm'; dl.textContent = '⬇ Descargar';
      dl.addEventListener('click', function () { var a = document.createElement('a'); a.href = dataUrl; a.download = 'miniatura-' + (i + 1) + '.png'; document.body.appendChild(a); a.click(); setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} }, 2000); });
      var re = document.createElement('button'); re.className = 'tk-btn sm'; re.textContent = '🔁 Otra variante';
      re.addEventListener('click', function () { gen(); });
      ctr.appendChild(dl); ctr.appendChild(re); ctr.appendChild(copyBtn(p, 'Copiar prompt'));
    }
    function promptOnly(msg) { holder.innerHTML = ''; holder.textContent = msg; ctr.innerHTML = ''; ctr.appendChild(copyBtn(p, 'Copiar prompt')); }
    function gen() {
      if (!_gkey) { promptOnly('🔑 Agregá tu key de Gemini en Opciones para generar la imagen. Mientras, copiá el prompt.'); return; }
      holder.innerHTML = '<span class="tk-spin"></span> generando…'; ctr.innerHTML = '';
      genImage(_gkey, p).then(paint).catch(function (e) { promptOnly('⚠ ' + (e && e.message || 'no se pudo generar') + ' — copiá el prompt y generalo en tu IA de imágenes.'); });
    }
    gen();
  }

  function render(d) {
    resultEl.innerHTML = '';
    if (d.style) {
      var sb = document.createElement('div'); sb.className = 'tk-block';
      var sh = document.createElement('div'); sh.className = 'tk-block-h'; var st = document.createElement('span'); st.className = 'tk-bt'; st.textContent = '🎨 Dirección de arte'; sh.appendChild(st); sb.appendChild(sh);
      var sbd = document.createElement('div'); sbd.className = 'tk-block-b'; sbd.textContent = d.style; sb.appendChild(sbd); resultEl.appendChild(sb);
    }
    // escenas
    if (d.scenes && d.scenes.length) {
      var card = document.createElement('div'); card.className = 'tk-card';
      var hh = document.createElement('h3'); hh.textContent = '🎞️ Prompts por escena (' + d.scenes.length + ')';
      var allBtn = document.createElement('button'); allBtn.className = 'tk-btn sm'; allBtn.textContent = 'Copiar TODOS'; allBtn.style.float = 'right';
      allBtn.addEventListener('click', function () { TK.copy(d.scenes.map(function (s, i) { return '#' + (s.n || i + 1) + ' ' + s.imagePrompt; }).join('\n\n'), allBtn); });
      hh.appendChild(allBtn); card.appendChild(hh);
      d.scenes.forEach(function (s, i) {
        var row = document.createElement('div'); row.className = 'tk-scene';
        var rh = document.createElement('div'); rh.className = 'tk-scene-h';
        var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'ESCENA ' + (s.n || i + 1); rh.appendChild(n);
        rh.appendChild(copyBtn(s.imagePrompt || '')); row.appendChild(rh);
        if (s.summary) { var sm = document.createElement('div'); sm.className = 'tk-scene-meta'; sm.textContent = s.summary; row.appendChild(sm); }
        var tx = document.createElement('div'); tx.className = 'tk-scene-txt'; tx.style.fontSize = '12px'; tx.style.color = 'rgba(255,255,255,.82)'; tx.textContent = s.imagePrompt || ''; row.appendChild(tx);
        if (s.motion) { var mo = document.createElement('div'); mo.className = 'tk-scene-meta'; mo.textContent = '🎥 ' + s.motion; row.appendChild(mo); }
        card.appendChild(row);
      });
      resultEl.appendChild(card);
    }
    // miniaturas (imágenes reales con Gemini)
    if (d.thumbnails && d.thumbnails.length) {
      var tc = document.createElement('div'); tc.className = 'tk-card';
      var th = document.createElement('h3'); th.textContent = '🖼️ Miniaturas (imágenes IA)'; tc.appendChild(th);
      d.thumbnails.forEach(function (t, i) { thumbCard(tc, t, i); });
      var nt = document.createElement('div'); nt.className = 'tk-scene-meta';
      nt.textContent = _gkey ? 'El texto grande agregalo en el editor — la IA a veces lo escribe mal. Tamaño ideal: 1280×720.' : '🔑 Agregá tu key de Gemini en Opciones y se generan como imágenes (gratis). Sin key te doy los conceptos + prompts.';
      tc.appendChild(nt);
      resultEl.appendChild(tc);
    }
    var act = document.createElement('div'); act.className = 'tk-row'; act.style.marginTop = '4px';
    var dlj = document.createElement('button'); dlj.className = 'tk-btn'; dlj.textContent = '⬇ Descargar plan (.json)';
    dlj.addEventListener('click', function () { TK.download('plan-visual.json', JSON.stringify(d, null, 2), 'application/json'); });
    var ed = document.createElement('button'); ed.className = 'tk-btn primary'; ed.textContent = '🛡️ Abrir en Monetize Studio';
    ed.addEventListener('click', function () { TK.toEditor(scriptEl.value || ''); });
    var vx = document.createElement('button'); vx.className = 'tk-btn'; vx.textContent = '🎙️ Narrar en VoxBatch';
    vx.addEventListener('click', function () { TK.toTool('voxforge.html', scriptEl.value || ''); });
    act.appendChild(ed); act.appendChild(vx); act.appendChild(dlj); resultEl.appendChild(act);
  }

  go.addEventListener('click', run);
  if (_fromHandoff && scriptEl.value.trim()) { TK.status(statusEl, 'Nicho cargado — generando…', ''); run(); }
  else if (scriptEl.value.trim()) TK.status(statusEl, 'Guion cargado desde ScriptPilot — dale a Generar.', '');
})();
