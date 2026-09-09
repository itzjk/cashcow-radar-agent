// RivalRadar Pro — análisis de competencia por IA + búsquedas abribles en YouTube.
(function () {
  'use strict';
  TK.mountHead('RivalRadar Pro', 'COMPETITOR RADAR');
  var $ = function (id) { return document.getElementById(id); };
  var kw = $('kw'), statusEl = $('status'), resultEl = $('result'), go = $('go');

  // Mercado → locale de YouTube (gl/hl). Las búsquedas que abrimos deben FORZAR
  // el país/idioma del mercado elegido; si no, YouTube responde en la región del
  // navegador y "no respeta el mercado".
  var MARKET_LOCALE = {
    'español': { gl: 'ES', hl: 'es' },
    'inglés (US)': { gl: 'US', hl: 'en' },
    'portugués (BR)': { gl: 'BR', hl: 'pt' },
    'alemán': { gl: 'DE', hl: 'de' },
    'francés': { gl: 'FR', hl: 'fr' }
  };
  function ytSearchUrl(query) {
    var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=CAMSAhAB';
    try {
      var loc = MARKET_LOCALE[(($('lang') && $('lang').value) || '')];
      if (loc && loc.gl && loc.hl) url += '&gl=' + loc.gl + '&hl=' + loc.hl + '&persist_gl=1&persist_hl=1';
    } catch (e) {}
    return url;
  }

  function sys() {
    return 'Sos analista de competencia de YouTube faceless. Conocés VPH, RPM, retención y saturación por nicho. ' +
      'Sos concreto y accionable, sin relleno. Devolvés EXCLUSIVAMENTE un JSON válido, sin texto extra ni markdown.';
  }
  function prompt(kw, lang) {
    return 'NICHO/KEYWORD: ' + kw + '\nMERCADO/IDIOMA: ' + lang + '\n\n' +
      'IMPORTANTE: enfocá TODO en el mercado ' + lang + '. Las "searchQueries" deben estar escritas en el idioma de ese mercado y apuntar a canales/creadores de ESE país; NO mezcles otros idiomas ni caigas al mercado hispano por defecto.\n' +
      'Analizá la competencia y devolvé este JSON (textos en ' + lang + ', queries en el idioma del mercado):\n' +
      '{\n' +
      '  "searchQueries": ["8-10 búsquedas concretas de YouTube para espiar el nicho"],\n' +
      '  "formats": [ { "name": "formato que está funcionando", "why": "por qué retiene/funciona", "example": "ejemplo de título" } ],\n' +
      '  "gaps": ["3-5 huecos/ángulos poco explotados que podrías atacar"],\n' +
      '  "angles": ["3-5 ángulos de monetización / sub-temas con buen RPM"],\n' +
      '  "rpm": "rango estimado de RPM para este nicho/mercado",\n' +
      '  "saturation": "baja|media|alta + 1 frase de por qué",\n' +
      '  "verdict": "1-2 frases: ¿vale la pena entrar y cómo diferenciarte?"\n' +
      '}\nNADA fuera del JSON.';
  }

  function run() {
    var q = kw.value.trim();
    if (!q) { TK.status(statusEl, 'Escribí un nicho o keyword.', 'error'); return; }
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Escaneando la competencia…'; statusEl.style.color = '#FFD93D';
    TK.ai(sys(), prompt(q, $('lang').value), 0.6).then(function (txt) {
      var d = TK.json(txt); if (!d) throw new Error('La IA no devolvió análisis válido. Probá de nuevo.');
      render(d); TK.status(statusEl, '✓ Análisis listo.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, '⚠ ' + (e && e.message || e), 'error');
    }).then(function () { go.disabled = false; });
  }

  function listBlock(title, items, render) {
    var card = document.createElement('div'); card.className = 'tk-card';
    var h = document.createElement('h3'); h.textContent = title; card.appendChild(h);
    (items || []).forEach(function (it) { card.appendChild(render(it)); });
    return card;
  }

  function render(d) {
    resultEl.innerHTML = '';
    // stats
    var grid = document.createElement('div'); grid.className = 'tk-grid';
    function stat(v, l) { var s = document.createElement('div'); s.className = 'tk-stat'; var vv = document.createElement('div'); vv.className = 'v'; vv.textContent = v; vv.style.fontSize = '15px'; var ll = document.createElement('div'); ll.className = 'l'; ll.textContent = l; s.appendChild(vv); s.appendChild(ll); return s; }
    if (d.rpm) grid.appendChild(stat(d.rpm, 'RPM estimado'));
    if (d.saturation) grid.appendChild(stat(String(d.saturation).split(' ')[0], 'Saturación'));
    if (grid.children.length) resultEl.appendChild(grid);
    if (d.verdict) { var vb = document.createElement('div'); vb.className = 'tk-block'; var vh = document.createElement('div'); vh.className = 'tk-block-h'; var vt = document.createElement('span'); vt.className = 'tk-bt'; vt.textContent = '🎯 Veredicto'; vh.appendChild(vt); vb.appendChild(vh); var vbd = document.createElement('div'); vbd.className = 'tk-block-b'; vbd.textContent = d.verdict + (typeof d.saturation === 'string' && d.saturation.indexOf(' ') > 0 ? '\n\nSaturación: ' + d.saturation : ''); vb.appendChild(vbd); resultEl.appendChild(vb); }

    // search queries → abren YouTube
    if (d.searchQueries && d.searchQueries.length) {
      resultEl.appendChild(listBlock('🔎 Búsquedas para espiar (clic = abre YouTube)', d.searchQueries, function (q) {
        var row = document.createElement('div'); row.className = 'tk-scene'; row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.justifyContent = 'space-between'; row.style.gap = '10px';
        var t = document.createElement('div'); t.className = 'tk-scene-txt'; t.style.margin = '0'; t.textContent = q; row.appendChild(t);
        var b = document.createElement('button'); b.className = 'tk-btn sm'; b.textContent = '↗ YouTube';
        b.addEventListener('click', function () { var url = ytSearchUrl(q); try { chrome.tabs ? chrome.tabs.create({ url: url }) : window.open(url, '_blank'); } catch (e) { window.open(url, '_blank'); } });
        row.appendChild(b); return row;
      }));
    }
    // formats
    if (d.formats && d.formats.length) {
      resultEl.appendChild(listBlock('🧩 Formatos que funcionan', d.formats, function (f) {
        var row = document.createElement('div'); row.className = 'tk-scene';
        var n = document.createElement('div'); n.className = 'tk-scene-n'; n.textContent = f.name || ''; row.appendChild(n);
        if (f.why) { var w = document.createElement('div'); w.className = 'tk-scene-txt'; w.textContent = f.why; row.appendChild(w); }
        if (f.example) { var ex = document.createElement('div'); ex.className = 'tk-scene-meta'; ex.textContent = '📌 ' + f.example; row.appendChild(ex); }
        return row;
      }));
    }
    // gaps + angles
    function bullets(title, arr) {
      return listBlock(title, arr, function (g) { var row = document.createElement('div'); row.className = 'tk-scene-meta'; row.style.fontSize = '13px'; row.style.color = 'rgba(255,255,255,.88)'; row.style.marginTop = '8px'; row.textContent = '• ' + g; return row; });
    }
    if (d.gaps && d.gaps.length) resultEl.appendChild(bullets('🕳️ Huecos sin explotar', d.gaps));
    if (d.angles && d.angles.length) resultEl.appendChild(bullets('💰 Ángulos de monetización', d.angles));
  }

  go.addEventListener('click', run);
  kw.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
})();
