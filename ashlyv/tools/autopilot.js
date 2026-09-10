(function () {
  'use strict';
  TK.mountHead('AutoPilot', 'PRODUCTION AUTOFACTORY');
  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status'), stepsEl = $('steps'), resultEl = $('result'), go = $('go');
  var bundle = null;

  try { var ht = localStorage.getItem('zerack_handoff_topic'); if (ht) { $('topic').value = ht; localStorage.removeItem('zerack_handoff_topic'); } } catch (e) {}

  function setStep(i, state, label) {
    var rows = stepsEl.querySelectorAll('.tk-scene');
    var r = rows[i]; if (!r) return;
    var dot = r.querySelector('.st-dot'), tx = r.querySelector('.st-tx');
    if (state === 'busy') { dot.innerHTML = '<span class="tk-spin" style="margin:0"></span>'; r.style.borderColor = '#FFD93D'; }
    else if (state === 'ok') { dot.textContent = '✓'; dot.style.color = '#00DC82'; r.style.borderColor = 'rgba(0,220,130,.4)'; }
    else if (state === 'err') { dot.textContent = '✕'; dot.style.color = '#ff6b6b'; r.style.borderColor = 'rgba(255,107,107,.4)'; }
    else { dot.textContent = '•'; dot.style.color = 'rgba(255,255,255,.4)'; }
    if (label) tx.textContent = label;
  }
  function mountSteps() {
    stepsEl.innerHTML = '';
    ['Writing the script, scenes and metadata', 'Designing the visual prompts and thumbnails'].forEach(function (t) {
      var r = document.createElement('div'); r.className = 'tk-scene'; r.style.display = 'flex'; r.style.alignItems = 'center'; r.style.gap = '10px'; r.style.marginTop = '8px';
      var d = document.createElement('span'); d.className = 'st-dot'; d.style.cssText = 'width:18px;text-align:center;font-weight:900;color:rgba(255,255,255,.4)'; d.textContent = '•';
      var x = document.createElement('span'); x.className = 'st-tx tk-scene-txt'; x.style.margin = '0'; x.textContent = t;
      r.appendChild(d); r.appendChild(x); stepsEl.appendChild(r);
    });
  }

  function scriptSys() { return 'You are a scriptwriter for high retention faceless YouTube channels. You answer in the language you are asked for. You return ONLY valid JSON, no markdown.'; }
  function scriptPrompt(o) {
    var n = Math.max(3, Math.min(40, Math.round(o.mins * 1.4)));
    return 'Write a faceless script.\nTOPIC: ' + o.topic + '\nNICHE: ' + o.niche + '\nLENGTH: ' + o.mins + ' min\nLANGUAGE: ' + o.lang + '\n\n' +
      'JSON, all of it written in ' + o.lang + ': {"title":"...", "hook":"...", "scenes":[{"n":1,"narration":"...","visual":"...","seconds":12}], "fullScript":"the complete continuous narration script", "cta":"...", "description":"description plus 5 hashtags", "tags":["..."]}\n' +
      'Write about ' + n + ' scenes, roughly ' + o.mins + ' minutes. NOTHING outside the JSON.';
  }
  function visualSys() { return 'You are an art director for faceless channels. You write the image prompts in ENGLISH, detailed and consistent with each other. You return ONLY valid JSON, no markdown.'; }
  function visualPrompt(script, look, max) {
    return 'SCRIPT:\n"""' + script.slice(0, 5000) + '"""\nLOOK: ' + look + '\nMAX SCENES: ' + max + '\n\n' +
      'JSON: {"style":"global art direction, in English","scenes":[{"n":1,"summary":"in English","imagePrompt":"detailed ENGLISH prompt, 16:9, shared aesthetic"}],"thumbnails":[{"concept":"in English","text":"overlay text, 4 words or fewer","prompt":"ENGLISH thumbnail prompt"}]}\nNOTHING outside the JSON.';
  }

  function run() {
    var topic = $('topic').value.trim();
    if (!topic) { TK.status(statusEl, 'Type a topic first.', 'error'); return; }
    var o = { topic: topic, niche: $('niche').value, mins: +$('mins').value, lang: $('lang').value, look: $('look').value };
    go.disabled = true; resultEl.innerHTML = ''; mountSteps();
    TK.status(statusEl, 'Working, keep this tab open.', 'busy');
    setStep(0, 'busy');
    TK.ai(scriptSys(), scriptPrompt(o), 0.8).then(function (txt) {
      var script = TK.json(txt);
      if (!script || !script.fullScript) throw new Error('SCRIPT');
      setStep(0, 'ok', 'Script: ' + ((script.scenes || []).length) + ' scenes');
      setStep(1, 'busy');
      var maxV = Math.min(16, (script.scenes || []).length || 10);
      return TK.ai(visualSys(), visualPrompt(script.fullScript, o.look, maxV), 0.7).then(function (vtxt) {
        var visual = TK.json(vtxt) || {};
        setStep(1, 'ok', 'Visual: ' + ((visual.scenes || []).length) + ' prompts and ' + ((visual.thumbnails || []).length) + ' thumbnails');
        bundle = { meta: o, script: script, visual: visual };
        render(bundle);
        TK.status(statusEl, 'Full package ready.', 'ok');
      });
    }).catch(function (e) {
      var m = String(e && e.message);
      if (m === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); setStep(0, 'err'); }
      else { setStep(m === 'SCRIPT' ? 0 : 1, 'err'); TK.status(statusEl, m === 'SCRIPT' ? 'The script could not be generated. Try again.' : String(e && e.message || e), 'error'); }
    }).then(function () { go.disabled = false; });
  }

  function block(title, text, extraBtn) {
    var w = document.createElement('div'); w.className = 'tk-block';
    var h = document.createElement('div'); h.className = 'tk-block-h';
    var t = document.createElement('span'); t.className = 'tk-bt'; t.textContent = title; h.appendChild(t);
    if (extraBtn) h.appendChild(extraBtn);
    var c = document.createElement('button'); c.className = 'tk-btn sm'; c.textContent = 'Copy'; c.addEventListener('click', function () { TK.copy(text, c); }); h.appendChild(c);
    var b = document.createElement('div'); b.className = 'tk-block-b'; b.textContent = text;
    w.appendChild(h); w.appendChild(b); return w;
  }

  function render(B) {
    resultEl.innerHTML = '';
    var s = B.script, v = B.visual;
    if (s.title) resultEl.appendChild(block('Title', s.title));
    if (s.hook) resultEl.appendChild(block('Hook', s.hook));
    if (s.fullScript) resultEl.appendChild(block('Full script', s.fullScript));
    if (s.scenes && s.scenes.length) {
      var card = document.createElement('div'); card.className = 'tk-card';
      var hh = document.createElement('h3'); hh.textContent = 'Scenes, narration and visual'; card.appendChild(hh);
      s.scenes.forEach(function (sc, i) {
        var vp = (v.scenes && v.scenes[i]) ? v.scenes[i] : null;
        var row = document.createElement('div'); row.className = 'tk-scene';
        var rh = document.createElement('div'); rh.className = 'tk-scene-h';
        var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'SCENE ' + (sc.n || i + 1) + (sc.seconds ? ' · ' + sc.seconds + 's' : ''); rh.appendChild(n);
        if (vp && vp.imagePrompt) { var cb = document.createElement('button'); cb.className = 'tk-btn sm'; cb.textContent = 'Copy prompt'; cb.addEventListener('click', function () { TK.copy(vp.imagePrompt, cb); }); rh.appendChild(cb); }
        row.appendChild(rh);
        var tx = document.createElement('div'); tx.className = 'tk-scene-txt'; tx.textContent = sc.narration || ''; row.appendChild(tx);
        if (vp && vp.imagePrompt) { var pm = document.createElement('div'); pm.className = 'tk-scene-meta'; pm.textContent = vp.imagePrompt; row.appendChild(pm); }
        card.appendChild(row);
      });
      resultEl.appendChild(card);
    }
    if (v.thumbnails && v.thumbnails.length) {
      var tc = document.createElement('div'); tc.className = 'tk-card'; var th = document.createElement('h3'); th.textContent = 'Thumbnails'; tc.appendChild(th);
      v.thumbnails.forEach(function (t, i) {
        var row = document.createElement('div'); row.className = 'tk-scene';
        var rh = document.createElement('div'); rh.className = 'tk-scene-h'; var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'OPTION ' + (i + 1) + (t.text ? ' · "' + t.text + '"' : ''); rh.appendChild(n);
        var cb = document.createElement('button'); cb.className = 'tk-btn sm'; cb.textContent = 'Copy'; cb.addEventListener('click', function () { TK.copy(t.prompt || '', cb); }); rh.appendChild(cb); row.appendChild(rh);
        var tx = document.createElement('div'); tx.className = 'tk-scene-meta'; tx.textContent = t.prompt || ''; row.appendChild(tx); tc.appendChild(row);
      });
      resultEl.appendChild(tc);
    }
    if (s.description) resultEl.appendChild(block('Description', s.description));
    if (s.tags && s.tags.length) resultEl.appendChild(block('Tags', s.tags.join(', ')));

    var act = document.createElement('div'); act.className = 'tk-row'; act.style.marginTop = '6px';
    var ed = document.createElement('button'); ed.className = 'tk-btn primary'; ed.textContent = 'Send to Command Center';
    ed.addEventListener('click', function () { TK.toEditor(s.fullScript || ''); });
    var vx = document.createElement('button'); vx.className = 'tk-btn'; vx.textContent = 'Narrate in VoxBatch';
    vx.addEventListener('click', function () { TK.toTool('voxforge.html', s.fullScript || ''); });
    var dl = document.createElement('button'); dl.className = 'tk-btn'; dl.textContent = 'Download package (.json)';
    dl.addEventListener('click', function () { TK.download((s.title || 'package').replace(/[^\w\s-]/g, '').slice(0, 40) + '.json', JSON.stringify(B, null, 2), 'application/json'); });
    act.appendChild(ed); act.appendChild(vx); act.appendChild(dl); resultEl.appendChild(act);
  }

  go.addEventListener('click', run);
  $('topic').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
})();
