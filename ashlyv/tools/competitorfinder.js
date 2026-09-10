(function () {
  'use strict';
  TK.mountHead('RivalRadar Pro', 'COMPETITOR RADAR');
  var $ = function (id) { return document.getElementById(id); };
  var kw = $('kw'), statusEl = $('status'), resultEl = $('result'), go = $('go');

  // The opened searches must force gl/hl, otherwise YouTube answers in the browser region and ignores the chosen market.
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
    return 'You are a competition analyst for faceless YouTube channels. You know VPH, RPM, retention and saturation per niche. ' +
      'You are concrete and actionable, with no filler. You return ONLY valid JSON, with no extra text and no markdown.';
  }
  function prompt(kw, lang) {
    return 'NICHE/KEYWORD: ' + kw + '\nMARKET/LANGUAGE: ' + lang + '\n\n' +
      'IMPORTANT: focus everything on the ' + lang + ' market. The "searchQueries" must be written in that market language and point at channels and creators from that country. Do not mix other languages and do not fall back to the Spanish market.\n' +
      'Analyze the competition and return this JSON, prose in English and queries in the market language:\n' +
      '{\n' +
      '  "searchQueries": ["8-10 concrete YouTube searches to study the niche"],\n' +
      '  "formats": [ { "name": "format that is working", "why": "why it retains and works", "example": "example title" } ],\n' +
      '  "gaps": ["3-5 gaps or angles nobody is using that you could take"],\n' +
      '  "angles": ["3-5 monetization angles or sub-topics with good RPM"],\n' +
      '  "rpm": "estimated RPM range for this niche and market",\n' +
      '  "saturation": "low|medium|high plus one sentence on why",\n' +
      '  "verdict": "1-2 sentences: is it worth entering and how to stand out"\n' +
      '}\nNOTHING outside the JSON.';
  }

  function run() {
    var q = kw.value.trim();
    if (!q) { TK.status(statusEl, 'Type a niche or keyword first.', 'error'); return; }
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Scanning the competition'; statusEl.style.color = '#FFD93D';
    TK.ai(sys(), prompt(q, $('lang').value), 0.6).then(function (txt) {
      var d = TK.json(txt); if (!d) throw new Error('The AI did not return a valid analysis. Try again.');
      render(d); TK.status(statusEl, 'Analysis ready.', 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, String(e && e.message || e), 'error');
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
    var grid = document.createElement('div'); grid.className = 'tk-grid';
    function stat(v, l) { var s = document.createElement('div'); s.className = 'tk-stat'; var vv = document.createElement('div'); vv.className = 'v'; vv.textContent = v; vv.style.fontSize = '15px'; var ll = document.createElement('div'); ll.className = 'l'; ll.textContent = l; s.appendChild(vv); s.appendChild(ll); return s; }
    if (d.rpm) grid.appendChild(stat(d.rpm, 'Estimated RPM'));
    if (d.saturation) grid.appendChild(stat(String(d.saturation).split(' ')[0], 'Saturation'));
    if (grid.children.length) resultEl.appendChild(grid);
    if (d.verdict) { var vb = document.createElement('div'); vb.className = 'tk-block'; var vh = document.createElement('div'); vh.className = 'tk-block-h'; var vt = document.createElement('span'); vt.className = 'tk-bt'; vt.textContent = 'Verdict'; vh.appendChild(vt); vb.appendChild(vh); var vbd = document.createElement('div'); vbd.className = 'tk-block-b'; vbd.textContent = d.verdict + (typeof d.saturation === 'string' && d.saturation.indexOf(' ') > 0 ? '\n\nSaturation: ' + d.saturation : ''); vb.appendChild(vbd); resultEl.appendChild(vb); }

    if (d.searchQueries && d.searchQueries.length) {
      resultEl.appendChild(listBlock('Searches to study the niche, click to open YouTube', d.searchQueries, function (q) {
        var row = document.createElement('div'); row.className = 'tk-scene'; row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.justifyContent = 'space-between'; row.style.gap = '10px';
        var t = document.createElement('div'); t.className = 'tk-scene-txt'; t.style.margin = '0'; t.textContent = q; row.appendChild(t);
        var b = document.createElement('button'); b.className = 'tk-btn sm'; b.textContent = 'YouTube';
        b.addEventListener('click', function () { var url = ytSearchUrl(q); try { chrome.tabs ? chrome.tabs.create({ url: url }) : window.open(url, '_blank'); } catch (e) { window.open(url, '_blank'); } });
        row.appendChild(b); return row;
      }));
    }
    if (d.formats && d.formats.length) {
      resultEl.appendChild(listBlock('Formats that work', d.formats, function (f) {
        var row = document.createElement('div'); row.className = 'tk-scene';
        var n = document.createElement('div'); n.className = 'tk-scene-n'; n.textContent = f.name || ''; row.appendChild(n);
        if (f.why) { var w = document.createElement('div'); w.className = 'tk-scene-txt'; w.textContent = f.why; row.appendChild(w); }
        if (f.example) { var ex = document.createElement('div'); ex.className = 'tk-scene-meta'; ex.textContent = 'Example: ' + f.example; row.appendChild(ex); }
        return row;
      }));
    }
    function bullets(title, arr) {
      return listBlock(title, arr, function (g) { var row = document.createElement('div'); row.className = 'tk-scene-meta'; row.style.fontSize = '13px'; row.style.color = 'rgba(255,255,255,.88)'; row.style.marginTop = '8px'; row.textContent = '• ' + g; return row; });
    }
    if (d.gaps && d.gaps.length) resultEl.appendChild(bullets('Gaps nobody is filling', d.gaps));
    if (d.angles && d.angles.length) resultEl.appendChild(bullets('Monetization angles', d.angles));
  }

  go.addEventListener('click', run);
  kw.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
})();
