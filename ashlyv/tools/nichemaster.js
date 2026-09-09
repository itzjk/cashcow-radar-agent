// NicheMaster — valida un nicho: score de oportunidad, RPM, saturación, sub-nichos, ideas, monetización.
(function () {
  'use strict';
  TK.mountHead('NicheMaster', 'NICHE INTELLIGENCE');
  var $ = function (id) { return document.getElementById(id); };
  var nicheEl = $('niche'), statusEl = $('status'), resultEl = $('result'), go = $('go');

  function sys() {
    return 'Sos estratega de nichos de YouTube faceless. Evaluás oportunidad real con criterio: demanda, RPM, saturación, ' +
      'facilidad de producción faceless y escalabilidad. Sos honesto (si un nicho es malo, lo decís). ' +
      'Devolvés EXCLUSIVAMENTE un JSON válido, sin texto extra ni markdown.';
  }
  function prompt(niche, lang) {
    return 'NICHO: ' + niche + '\nMERCADO: ' + lang + '\n\n' +
      'Evaluá el nicho y devolvé este JSON (textos en español):\n' +
      '{\n' +
      '  "score": 0-100 (oportunidad global),\n' +
      '  "verdict": "1-2 frases: ¿entrar o no, y por qué?",\n' +
      '  "rpm": "rango de RPM estimado para este mercado",\n' +
      '  "demand": "alta|media|baja + 1 frase",\n' +
      '  "saturation": "alta|media|baja + 1 frase",\n' +
      '  "facelessFit": "qué tan fácil es producirlo faceless (1 frase)",\n' +
      '  "subNiches": ["4-6 sub-nichos más jugosos / menos saturados"],\n' +
      '  "videoIdeas": ["6-8 títulos de video listos para producir"],\n' +
      '  "monetization": ["vías de monetización además de AdSense"],\n' +
      '  "risks": ["2-4 riesgos o trampas del nicho"]\n' +
      '}\nNADA fuera del JSON.';
  }

  function run() {
    var n = nicheEl.value.trim();
    if (!n) { TK.status(statusEl, 'Escribí un nicho.', 'error'); return; }
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Evaluando el nicho…'; statusEl.style.color = '#FFD93D';
    TK.ai(sys(), prompt(n, $('lang').value), 0.55).then(function (txt) {
      var d = TK.json(txt); if (!d) throw new Error('La IA no devolvió evaluación válida. Probá de nuevo.');
      render(d, n); TK.status(statusEl, '✓ Evaluación lista.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, '⚠ ' + (e && e.message || e), 'error');
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
    if (d.score != null) { var sc = stat(d.score + '/100', 'Oportunidad', true); var col = d.score >= 70 ? '#00DC82' : d.score >= 45 ? '#FFD93D' : '#ff6b6b'; sc.querySelector('.v').style.color = col; grid.appendChild(sc); }
    if (d.rpm) grid.appendChild(stat(d.rpm, 'RPM'));
    if (d.demand) grid.appendChild(stat(String(d.demand).split(' ')[0], 'Demanda'));
    if (d.saturation) grid.appendChild(stat(String(d.saturation).split(' ')[0], 'Saturación'));
    resultEl.appendChild(grid);

    if (d.verdict) { var vb = document.createElement('div'); vb.className = 'tk-block'; var vh = document.createElement('div'); vh.className = 'tk-block-h'; var vt = document.createElement('span'); vt.className = 'tk-bt'; vt.textContent = '🎯 Veredicto'; vh.appendChild(vt); vb.appendChild(vh); var bd = document.createElement('div'); bd.className = 'tk-block-b'; var txt = d.verdict; if (d.facelessFit) txt += '\n\n🎭 Faceless: ' + d.facelessFit; bd.textContent = txt; vb.appendChild(bd); resultEl.appendChild(vb); }

    if (d.subNiches && d.subNiches.length) resultEl.appendChild(bullets('🌱 Sub-nichos jugosos', d.subNiches));
    if (d.videoIdeas && d.videoIdeas.length) resultEl.appendChild(bullets('🎬 Ideas de video (clic → ScriptPilot)', d.videoIdeas, true));
    if (d.monetization && d.monetization.length) resultEl.appendChild(bullets('💰 Monetización', d.monetization));
    if (d.risks && d.risks.length) resultEl.appendChild(bullets('⚠️ Riesgos', d.risks));
  }

  go.addEventListener('click', run);
  nicheEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
})();
