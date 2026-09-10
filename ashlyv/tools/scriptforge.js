(function () {
  'use strict';
  TK.mountHead('ScriptPilot AI', 'SCRIPT ENGINE');
  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status'), resultEl = $('result'), go = $('go');
  var last = null;
  try { var ht = localStorage.getItem('zerack_handoff_topic'); if (ht) { $('topic').value = ht; localStorage.removeItem('zerack_handoff_topic'); } } catch (e) {}

  function sys() {
    return 'You are a scriptwriter for high retention faceless YouTube channels. ' +
      'You write hooks that land in the first 5 seconds, narration that flows with no filler, and a structure built for retention. ' +
      'You always answer in the language you are asked for. You return ONLY a valid JSON object, nothing before or after, no markdown.';
  }
  function prompt(o) {
    var nScenes = Math.max(3, Math.min(60, Math.round(o.mins * 1.4)));
    return 'Write a script for a faceless YouTube video.\n' +
      'TOPIC: ' + o.topic + '\nNICHE: ' + o.niche + '\nTARGET LENGTH: ' + o.mins + ' minutes\nLANGUAGE: ' + o.lang + '\nTONE: ' + o.tone + '\n\n' +
      'Return a JSON object with EXACTLY this shape, all of it written in ' + o.lang + ':\n' +
      '{\n' +
      '  "title": "YouTube title optimized for CTR, 70 characters or fewer",\n' +
      '  "hook": "the first 2-3 sentences that hook in the first 5 seconds",\n' +
      '  "scenes": [ { "n": 1, "narration": "what the voiceover says, 2-4 sentences", "visual": "what is on screen", "seconds": 12 } ],\n' +
      '  "fullScript": "the COMPLETE continuous narration script, ready to read or feed to TTS, with no stage directions",\n' +
      '  "cta": "call to action for the ending",\n' +
      '  "description": "YouTube description, 2-3 sentences plus 5 hashtags",\n' +
      '  "tags": ["tag1","tag2","..."]\n' +
      '}\n' +
      'Write about ' + nScenes + ' scenes that add up to roughly ' + o.mins + ' minutes. The fullScript must be substantial and match that length. NOTHING outside the JSON.';
  }

  function run() {
    var topic = $('topic').value.trim();
    if (!topic) { TK.status(statusEl, 'Type a topic first.', 'error'); return; }
    var o = { topic: topic, niche: $('niche').value, mins: +$('mins').value, lang: $('lang').value, tone: $('tone').value };
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Writing the script'; statusEl.style.color = '#FFD93D';
    TK.ai(sys(), prompt(o), 0.8).then(function (txt) {
      var data = TK.json(txt);
      if (!data || !data.fullScript) { throw new Error('The AI did not return a valid script. Try again.'); }
      last = data; render(data, o);
      TK.status(statusEl, 'Script ready, ' + ((data.scenes || []).length) + ' scenes.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, String(e && e.message || e), 'error');
    }).then(function () { go.disabled = false; });
  }

  function block(title, bodyText, mono) {
    var wrap = document.createElement('div'); wrap.className = 'tk-block';
    var h = document.createElement('div'); h.className = 'tk-block-h';
    var t = document.createElement('span'); t.className = 'tk-bt'; t.textContent = title; h.appendChild(t);
    var cp = document.createElement('button'); cp.className = 'tk-btn sm'; cp.textContent = 'Copy';
    cp.addEventListener('click', function () { TK.copy(bodyText, cp); }); h.appendChild(cp);
    var b = document.createElement('div'); b.className = 'tk-block-b' + (mono ? ' mono' : ''); b.textContent = bodyText;
    wrap.appendChild(h); wrap.appendChild(b); return wrap;
  }

  function render(d, o) {
    resultEl.innerHTML = '';
    if (d.title) resultEl.appendChild(block('Title', d.title));
    if (d.hook) resultEl.appendChild(block('Hook, first 5 seconds', d.hook));
    if (d.scenes && d.scenes.length) {
      var sc = document.createElement('div'); sc.className = 'tk-card';
      var hh = document.createElement('h3'); hh.textContent = 'Scene breakdown (' + d.scenes.length + ')'; sc.appendChild(hh);
      d.scenes.forEach(function (s, i) {
        var row = document.createElement('div'); row.className = 'tk-scene';
        var rh = document.createElement('div'); rh.className = 'tk-scene-h';
        var n = document.createElement('span'); n.className = 'tk-scene-n'; n.textContent = 'SCENE ' + (s.n || i + 1) + (s.seconds ? ' · ' + s.seconds + 's' : '');
        rh.appendChild(n); row.appendChild(rh);
        var tx = document.createElement('div'); tx.className = 'tk-scene-txt'; tx.textContent = s.narration || ''; row.appendChild(tx);
        if (s.visual) { var v = document.createElement('div'); v.className = 'tk-scene-meta'; v.textContent = 'Visual: ' + s.visual; row.appendChild(v); }
        sc.appendChild(row);
      });
      resultEl.appendChild(sc);
    }
    if (d.fullScript) resultEl.appendChild(block('Full script, for narration or TTS', d.fullScript));
    if (d.cta) resultEl.appendChild(block('Call to action', d.cta));
    if (d.description) resultEl.appendChild(block('YouTube description', d.description));
    if (d.tags && d.tags.length) {
      var tw = document.createElement('div'); tw.className = 'tk-block';
      var th = document.createElement('div'); th.className = 'tk-block-h';
      var tt = document.createElement('span'); tt.className = 'tk-bt'; tt.textContent = 'Tags'; th.appendChild(tt);
      var cp = document.createElement('button'); cp.className = 'tk-btn sm'; cp.textContent = 'Copy'; cp.addEventListener('click', function () { TK.copy(d.tags.join(', '), cp); }); th.appendChild(cp);
      var tb = document.createElement('div'); tb.className = 'tk-block-b'; var tags = document.createElement('div'); tags.className = 'tk-tags';
      d.tags.forEach(function (tg) { var sp = document.createElement('span'); sp.className = 'tk-tag'; sp.textContent = tg; tags.appendChild(sp); });
      tb.appendChild(tags); tw.appendChild(th); tw.appendChild(tb); resultEl.appendChild(tw);
    }
    var act = document.createElement('div'); act.className = 'tk-row'; act.style.marginTop = '4px';
    var dl = document.createElement('button'); dl.className = 'tk-btn'; dl.textContent = 'Download script (.txt)';
    dl.addEventListener('click', function () { TK.download((d.title || 'script').replace(/[^\w\s-]/g, '').slice(0, 50) + '.txt', d.fullScript || ''); });
    var dlj = document.createElement('button'); dlj.className = 'tk-btn'; dlj.textContent = 'Download package (.json)';
    dlj.addEventListener('click', function () { TK.download((d.title || 'script').replace(/[^\w\s-]/g, '').slice(0, 50) + '.json', JSON.stringify(d, null, 2), 'application/json'); });
    var mf = document.createElement('button'); mf.className = 'tk-btn'; mf.textContent = 'Send to MotionForge';
    mf.addEventListener('click', function () { TK.toTool('thumbnailforge.html', d.fullScript || ''); });
    var vx = document.createElement('button'); vx.className = 'tk-btn'; vx.textContent = 'Send to VoxBatch';
    vx.addEventListener('click', function () { TK.toTool('voxforge.html', d.fullScript || ''); });
    var ed = document.createElement('button'); ed.className = 'tk-btn primary'; ed.textContent = 'Send to Command Center';
    ed.addEventListener('click', function () { TK.toEditor(d.fullScript || ''); });
    act.appendChild(dl); act.appendChild(dlj); act.appendChild(vx); act.appendChild(mf); act.appendChild(ed);
    resultEl.appendChild(act);
  }

  go.addEventListener('click', run);
  $('topic').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
})();
