(function () {
  'use strict';
  TK.mountHead('NicheMaster', 'NICHE INTELLIGENCE');
  var $ = function (id) { return document.getElementById(id); };
  var nicheEl = $('niche'), statusEl = $('status'), resultEl = $('result'), go = $('go');

  function sys() {
    return 'You are a niche strategist for faceless YouTube channels. You judge real opportunity on demand, RPM, saturation, ' +
      'how easy it is to produce faceless and how far it scales. You are honest: if a niche is bad, you say so. ' +
      'You return ONLY valid JSON, with no extra text and no markdown.';
  }
  function prompt(niche, lang) {
    return 'NICHE: ' + niche + '\nMARKET: ' + lang + '\n\n' +
      'Evaluate the niche and return this JSON, all text in English:\n' +
      '{\n' +
      '  "score": 0-100 (overall opportunity),\n' +
      '  "verdict": "1-2 sentences: enter or not, and why",\n' +
      '  "rpm": "estimated RPM range for this market",\n' +
      '  "demand": "high|medium|low plus one sentence",\n' +
      '  "saturation": "high|medium|low plus one sentence",\n' +
      '  "facelessFit": "how easy it is to produce faceless, one sentence",\n' +
      '  "subNiches": ["4-6 richest and least saturated sub-niches"],\n' +
      '  "videoIdeas": ["6-8 video titles ready to produce"],\n' +
      '  "monetization": ["monetization routes beyond AdSense"],\n' +
      '  "risks": ["2-4 risks or traps in this niche"]\n' +
      '}\nNOTHING outside the JSON.';
  }

  function run() {
    var n = nicheEl.value.trim();
    if (!n) { TK.status(statusEl, 'Type a niche first.', 'error'); return; }
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Evaluating the niche'; statusEl.style.color = '#FFD93D';
    TK.ai(sys(), prompt(n, $('lang').value), 0.55).then(function (txt) {
      var d = TK.json(txt); if (!d) throw new Error('The AI did not return a valid evaluation. Try again.');
      render(d, n); TK.status(statusEl, 'Evaluation ready.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, String(e && e.message || e), 'error');
    }).then(function () { go.disabled = false; });
  }

  function bullets(title, arr, sendable) {
    var card = document.createElement('div'); card.className = 'tk-card';
    var h = document.createElement('h3'); h.textContent = title; card.appendChild(h);
    (arr || []).forEach(function (g) {
      var row = document.createElement('div'); row.className = 'tk-scene'; row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.justifyContent = 'space-between'; row.style.gap = '10px';
      var t = document.createElement('div'); t.className = 'tk-scene-txt'; t.style.margin = '0'; t.textContent = g; row.appendChild(t);
      if (sendable) { var b = document.createElement('button'); b.className = 'tk-btn sm'; b.textContent = '→ ScriptPilot'; b.addEventListener('click', function () { try { localStorage.setItem('zerack_handoff_topic', g); } catch (e) {} location.href = 'scriptforge.html'; }); row.appendChild(b); }
      card.appendChild(row);
    });
    return card;
  }

  function render(d, niche) {
    resultEl.innerHTML = '';
    var grid = document.createElement('div'); grid.className = 'tk-grid';
    function stat(v, l, big) { var s = document.createElement('div'); s.className = 'tk-stat'; var vv = document.createElement('div'); vv.className = 'v'; vv.textContent = v; if (!big) vv.style.fontSize = '15px'; var ll = document.createElement('div'); ll.className = 'l'; ll.textContent = l; s.appendChild(vv); s.appendChild(ll); return s; }
    if (d.score != null) { var sc = stat(d.score + '/100', 'Opportunity', true); var col = d.score >= 70 ? '#00DC82' : d.score >= 45 ? '#FFD93D' : '#ff6b6b'; sc.querySelector('.v').style.color = col; grid.appendChild(sc); }
    if (d.rpm) grid.appendChild(stat(d.rpm, 'RPM'));
    if (d.demand) grid.appendChild(stat(String(d.demand).split(' ')[0], 'Demand'));
    if (d.saturation) grid.appendChild(stat(String(d.saturation).split(' ')[0], 'Saturation'));
    resultEl.appendChild(grid);

    if (d.verdict) { var vb = document.createElement('div'); vb.className = 'tk-block'; var vh = document.createElement('div'); vh.className = 'tk-block-h'; var vt = document.createElement('span'); vt.className = 'tk-bt'; vt.textContent = 'Verdict'; vh.appendChild(vt); vb.appendChild(vh); var bd = document.createElement('div'); bd.className = 'tk-block-b'; var txt = d.verdict; if (d.facelessFit) txt += '\n\nFaceless: ' + d.facelessFit; bd.textContent = txt; vb.appendChild(bd); resultEl.appendChild(vb); }

    if (d.subNiches && d.subNiches.length) resultEl.appendChild(bullets('Sub-niches worth taking', d.subNiches));
    if (d.videoIdeas && d.videoIdeas.length) resultEl.appendChild(bullets('Video ideas, click to open in ScriptPilot', d.videoIdeas, true));
    if (d.monetization && d.monetization.length) resultEl.appendChild(bullets('Monetization', d.monetization));
    if (d.risks && d.risks.length) resultEl.appendChild(bullets('Risks', d.risks));
  }

  go.addEventListener('click', run);
  nicheEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
})();
