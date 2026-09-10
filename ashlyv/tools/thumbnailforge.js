(function () {
  'use strict';
  TK.mountHead('MotionForge Studio', 'VISUAL ENGINE');
  var $ = function (id) { return document.getElementById(id); };
  var scriptEl = $('script'), statusEl = $('status'), resultEl = $('result'), go = $('go');

  var _fromHandoff = false;
  try { var h = localStorage.getItem('zerack_handoff_script'); if (h && !scriptEl.value) { scriptEl.value = h; _fromHandoff = true; localStorage.removeItem('zerack_handoff_script'); } } catch (e) {}

  function sys() {
    return 'You are an art director for faceless YouTube channels. You turn a script into a coherent visual plan. ' +
      'You always write the image and video prompts in ENGLISH, because the generators work better with it, and you make them detailed: subject, setting, light, lens, mood. ' +
      'You return ONLY valid JSON, with no extra text and no markdown.';
  }
  function prompt(script, look, ar, max) {
    return 'SCRIPT:\n"""' + script.slice(0, 6000) + '"""\n\n' +
      'GLOBAL LOOK: ' + look + '\nASPECT RATIO: ' + ar + '\nMAX SCENES: ' + max + '\n\n' +
      'Return a JSON object with this shape:\n' +
      '{\n' +
      '  "style": "1-2 sentences of global art direction in English: palette, light, mood, lens",\n' +
      '  "scenes": [ { "n": 1, "summary": "what happens in the scene, short, in English", "imagePrompt": "detailed ENGLISH prompt, includes ' + ar + ' and the global aesthetic", "motion": "camera/animation note in English (e.g. slow push in)" } ],\n' +
      '  "thumbnails": [ { "concept": "the thumbnail idea, in English", "text": "large overlay TEXT, 4 words or fewer, in the language of the script", "prompt": "ENGLISH thumbnail image prompt, high CTR, bold, ' + ar + '" } ]\n' +
      '}\n' +
      'Write up to ' + max + ' scenes covering the script in order, and 3 thumbnails. Every imagePrompt must share the SAME look so the video stays coherent. NOTHING outside the JSON.';
  }

  function genImage(key, p) {
    var body = { contents: [{ parts: [{ text: 'Generate ONE image. ' + p + ' Absolutely NO text, letters, words or watermark inside the image.' }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
    var models = ['gemini-2.0-flash-preview-image-generation', 'gemini-2.5-flash-image-preview', 'gemini-2.5-flash-image'], i = 0;
    return new Promise(function (resolve, reject) {
      (function tryM() {
        if (i >= models.length) return reject(new Error('Gemini returned no image. That model is not available on your key.'));
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
    if (!script) { TK.status(statusEl, 'Paste a script or a niche first.', 'error'); return; }
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Designing the visual plan'; statusEl.style.color = '#FFD93D';
    TK.keys().then(function (k) {
      _gkey = (k && k.gemini && /^AIza/.test(k.gemini)) ? k.gemini : '';
      return TK.ai(sys(), prompt(script, $('look').value, $('ar').value, +$('max').value), 0.7);
    }).then(function (txt) {
      var d = TK.json(txt);
      if (!d || (!d.scenes && !d.thumbnails)) throw new Error('The AI did not return a valid plan. Try again.');
      render(d);
      TK.status(statusEl, 'Visual plan ready, ' + ((d.scenes || []).length) + ' scenes and ' + ((d.thumbnails || []).length) + ' thumbnails.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, String(e && e.message || e), 'error');
    }).then(function () { go.disabled = false; });
  }

  function copyBtn(text, label) {
    var b = document.createElement('button'); b.className = 'tk-btn sm'; b.textContent = label || 'Copy';
    b.addEventListener('click', function () { TK.copy(text, b); }); return b;
  }

  function thumbCard(card, t, i) {
    var row = document.createElement('div'); row.className = 'tk-scene';
    var rh = document.createElement('div'); rh.className = 'tk-scene-h';
    var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'OPTION ' + (i + 1); rh.appendChild(n);
    rh.appendChild(copyBtn(t.prompt || '', 'Copy prompt')); row.appendChild(rh);
    if (t.concept) { var cc = document.createElement('div'); cc.className = 'tk-scene-meta'; cc.textContent = t.concept; row.appendChild(cc); }
    if (t.text) { var tt = document.createElement('div'); tt.style.cssText = 'font-size:14px;font-weight:900;color:#fff;margin:4px 0;'; tt.textContent = 'OVERLAY TEXT: "' + t.text + '"'; row.appendChild(tt); }
    var holder = document.createElement('div');
    holder.style.cssText = 'width:100%;max-width:360px;aspect-ratio:16/9;border-radius:12px;margin:8px 0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.55);overflow:hidden;text-align:center;padding:8px;';
    row.appendChild(holder);
    var ctr = document.createElement('div'); ctr.className = 'tk-row'; row.appendChild(ctr);
    card.appendChild(row);
    var p = t.prompt || ('Cinematic high-CTR YouTube thumbnail background, ' + (t.concept || ''));
    function paint(dataUrl) {
      holder.innerHTML = ''; holder.style.padding = '0';
      var img = document.createElement('img'); img.src = dataUrl; img.alt = 'thumbnail'; img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      holder.appendChild(img); ctr.innerHTML = '';
      var dl = document.createElement('button'); dl.className = 'tk-btn sm'; dl.textContent = 'Download';
      dl.addEventListener('click', function () { var a = document.createElement('a'); a.href = dataUrl; a.download = 'thumbnail-' + (i + 1) + '.png'; document.body.appendChild(a); a.click(); setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} }, 2000); });
      var re = document.createElement('button'); re.className = 'tk-btn sm'; re.textContent = 'Another variant';
      re.addEventListener('click', function () { gen(); });
      ctr.appendChild(dl); ctr.appendChild(re); ctr.appendChild(copyBtn(p, 'Copy prompt'));
    }
    function promptOnly(msg) { holder.innerHTML = ''; holder.textContent = msg; ctr.innerHTML = ''; ctr.appendChild(copyBtn(p, 'Copy prompt')); }
    function gen() {
      if (!_gkey) { promptOnly('Add your Gemini key in Options to generate the image. In the meantime, copy the prompt.'); return; }
      holder.innerHTML = '<span class="tk-spin"></span> generating'; ctr.innerHTML = '';
      genImage(_gkey, p).then(paint).catch(function (e) { promptOnly((e && e.message || 'The image could not be generated') + '. Copy the prompt and run it in your own image AI.'); });
    }
    gen();
  }

  function render(d) {
    resultEl.innerHTML = '';
    if (d.style) {
      var sb = document.createElement('div'); sb.className = 'tk-block';
      var sh = document.createElement('div'); sh.className = 'tk-block-h'; var st = document.createElement('span'); st.className = 'tk-bt'; st.textContent = 'Art direction'; sh.appendChild(st); sb.appendChild(sh);
      var sbd = document.createElement('div'); sbd.className = 'tk-block-b'; sbd.textContent = d.style; sb.appendChild(sbd); resultEl.appendChild(sb);
    }
    if (d.scenes && d.scenes.length) {
      var card = document.createElement('div'); card.className = 'tk-card';
      var hh = document.createElement('h3'); hh.textContent = 'Prompts per scene (' + d.scenes.length + ')';
      var allBtn = document.createElement('button'); allBtn.className = 'tk-btn sm'; allBtn.textContent = 'Copy all'; allBtn.style.float = 'right';
      allBtn.addEventListener('click', function () { TK.copy(d.scenes.map(function (s, i) { return '#' + (s.n || i + 1) + ' ' + s.imagePrompt; }).join('\n\n'), allBtn); });
      hh.appendChild(allBtn); card.appendChild(hh);
      d.scenes.forEach(function (s, i) {
        var row = document.createElement('div'); row.className = 'tk-scene';
        var rh = document.createElement('div'); rh.className = 'tk-scene-h';
        var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'SCENE ' + (s.n || i + 1); rh.appendChild(n);
        rh.appendChild(copyBtn(s.imagePrompt || '')); row.appendChild(rh);
        if (s.summary) { var sm = document.createElement('div'); sm.className = 'tk-scene-meta'; sm.textContent = s.summary; row.appendChild(sm); }
        var tx = document.createElement('div'); tx.className = 'tk-scene-txt'; tx.style.fontSize = '12px'; tx.style.color = 'rgba(255,255,255,.82)'; tx.textContent = s.imagePrompt || ''; row.appendChild(tx);
        if (s.motion) { var mo = document.createElement('div'); mo.className = 'tk-scene-meta'; mo.textContent = 'Motion: ' + s.motion; row.appendChild(mo); }
        card.appendChild(row);
      });
      resultEl.appendChild(card);
    }
    if (d.thumbnails && d.thumbnails.length) {
      var tc = document.createElement('div'); tc.className = 'tk-card';
      var th = document.createElement('h3'); th.textContent = 'Thumbnails, generated with AI'; tc.appendChild(th);
      d.thumbnails.forEach(function (t, i) { thumbCard(tc, t, i); });
      var nt = document.createElement('div'); nt.className = 'tk-scene-meta';
      nt.textContent = _gkey ? 'Add the overlay text in the editor, the AI often misspells it. Ideal size: 1280x720.' : 'Add your Gemini key in Options and these are generated as images. Without a key you get the concepts and prompts only.';
      tc.appendChild(nt);
      resultEl.appendChild(tc);
    }
    var act = document.createElement('div'); act.className = 'tk-row'; act.style.marginTop = '4px';
    var dlj = document.createElement('button'); dlj.className = 'tk-btn'; dlj.textContent = 'Download plan (.json)';
    dlj.addEventListener('click', function () { TK.download('visual-plan.json', JSON.stringify(d, null, 2), 'application/json'); });
    var ed = document.createElement('button'); ed.className = 'tk-btn primary'; ed.textContent = 'Send to Command Center';
    ed.addEventListener('click', function () { TK.toEditor(scriptEl.value || ''); });
    var vx = document.createElement('button'); vx.className = 'tk-btn'; vx.textContent = 'Narrate in VoxBatch';
    vx.addEventListener('click', function () { TK.toTool('voxforge.html', scriptEl.value || ''); });
    act.appendChild(ed); act.appendChild(vx); act.appendChild(dlj); resultEl.appendChild(act);
  }

  go.addEventListener('click', run);
  if (_fromHandoff && scriptEl.value.trim()) { TK.status(statusEl, 'Niche loaded, generating', ''); run(); }
  else if (scriptEl.value.trim()) TK.status(statusEl, 'Script loaded from ScriptPilot. Press Generate.', '');
})();
