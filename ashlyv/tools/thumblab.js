(function () {
  'use strict';
  TK.mountHead('ThumbLab', 'DISCOVER · AI THUMBNAILS');
  var $ = function (id) { return document.getElementById(id); };
  var topicEl = $('topic'), marketEl = $('market'), statusEl = $('status'), resultEl = $('result'), go = $('go');
  var FAV_KEY = 'zerack_thumblab_favs';
  var _gkey = '', _vids = [], _view = 'discover', _sort = 'views', _label = '';

  var NICHES = [
    { n: 'Mystery', q: 'unsolved mystery documentary', i: '🔍' },
    { n: 'History', q: 'ancient history documentary', i: '🏛️' },
    { n: 'True Crime', q: 'true crime story', i: '🔪' },
    { n: 'Horror', q: 'scary horror story narration', i: '👻' },
    { n: 'Documentary', q: 'full documentary', i: '🎬' },
    { n: 'Finance', q: 'how to make money online', i: '💰' },
    { n: 'Motivation', q: 'stoicism discipline motivation', i: '🔥' },
    { n: 'Sleep / Relax', q: 'relaxing sleep music rain', i: '😴' },
    { n: 'Space and science', q: 'space universe explained', i: '🚀' },
    { n: 'Gaming', q: 'gaming gameplay edit', i: '🎮' },
    { n: 'Real Life', q: 'i spent 24 hours challenge', i: '📸' },
    { n: 'Anime / Cartoon', q: 'animated story explained', i: '🎨' }
  ];

  var _seed = '';
  try {
    var raw = localStorage.getItem('zerack_thumblab');
    if (raw) {
      localStorage.removeItem('zerack_thumblab');
      var hj = JSON.parse(raw);
      if (hj && hj.query) _seed = hj.query;
      if (hj && hj.market) { for (var o = 0; o < marketEl.options.length; o++) { if (marketEl.options[o].value === hj.market) { marketEl.selectedIndex = o; break; } } }
    } else {
      var t = localStorage.getItem('zerack_handoff_topic');
      if (t) { _seed = t; localStorage.removeItem('zerack_handoff_topic'); }
    }
  } catch (e) {}

  function parseViews(s) {
    if (!s) return 0;
    var t = String(s).toLowerCase().replace(/,/g, '').replace(/\s*(views?|vistas?|visualizaciones|aufrufe|vues|visualizações)\b.*/, '').trim();
    var mult = 1;
    if (/\bmill/.test(t) || /m$/.test(t)) { mult = 1e6; t = t.replace(/m.*$/, ''); }
    else if (/k$/.test(t) || /\bmil$/.test(t)) { mult = 1e3; t = t.replace(/k$/, '').replace(/mil$/, ''); }
    var n = parseFloat(t) || 0; return Math.round(n * mult);
  }
  function parseAgeHours(s) {
    if (!s) return null; s = String(s).toLowerCase();
    var m = s.match(/(\d+)\s*(second|segundo|min|hour|hora|day|d[ií]a|week|semana|month|mes|year|a[ñn]o)/);
    if (!m) return null; var n = +m[1], u = m[2];
    if (/sec|segun/.test(u)) return n / 3600;
    if (/min/.test(u)) return n / 60;
    if (/hour|hora/.test(u)) return n;
    if (/day|d[ií]a/.test(u)) return n * 24;
    if (/week|semana/.test(u)) return n * 168;
    if (/month|mes/.test(u)) return n * 720;
    if (/year|a[ñn]o/.test(u)) return n * 8760;
    return null;
  }
  function fmt(n) { if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M'; if (n >= 1e3) return Math.round(n / 1e3) + 'K'; return String(n || 0); }
  function thumbUrl(id) { return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }

  function ittSearch(query, gl, hl) {
    return new Promise(function (resolve, reject) {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) { reject(new Error('No extension runtime available')); return; }
        chrome.runtime.sendMessage({ type: 'NSP_AGENT_SEARCH_MARKET', query: query, gl: gl || 'US', hl: hl || 'en' }, function (resp) {
          if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
          if (!resp || !resp.ok) { reject(new Error((resp && resp.error) || 'The scanner did not answer. Reload the extension.')); return; }
          var out = [], seen = {};
          (resp.videos || []).forEach(function (v) {
            if (!v.videoId || seen[v.videoId]) return; seen[v.videoId] = 1;
            var vn = v.views || parseViews(v.viewsText), ageH = parseAgeHours(v.publishedText);
            out.push({ id: v.videoId, title: v.title || '', viewsTxt: v.viewsText || '', vn: vn, channel: v.channelName || '', ageH: ageH, vph: ageH ? vn / ageH : 0 });
          });
          resolve(out);
        });
      } catch (e) { reject(e); }
    });
  }

  function urlToB64(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('img'); return r.blob(); }).then(function (b) {
      return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.onerror = rej; fr.readAsDataURL(b); });
    });
  }
  function analyzePixels(dataUrl) {
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          try {
            var w = 96, h = 54, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
            var data = ctx.getImageData(0, 0, w, h).data, sumL = 0, sumL2 = 0, sumSat = 0, n = 0, buckets = {};
            for (var i = 0; i < data.length; i += 4) {
              var r = data[i], g = data[i + 1], b = data[i + 2], l = 0.299 * r + 0.587 * g + 0.114 * b;
              sumL += l; sumL2 += l * l;
              var mx = Math.max(r, g, b), mn = Math.min(r, g, b); sumSat += mx === 0 ? 0 : (mx - mn) / mx; n++;
              var key = (r >> 5) + '|' + (g >> 5) + '|' + (b >> 5); buckets[key] = (buckets[key] || 0) + 1;
            }
            var mean = sumL / n, contrast = Math.sqrt(Math.max(0, sumL2 / n - mean * mean));
            var pal = Object.keys(buckets).sort(function (a, c) { return buckets[c] - buckets[a]; }).slice(0, 6).map(function (k) { var p = k.split('|'); return [(+p[0]) * 32 + 16, (+p[1]) * 32 + 16, (+p[2]) * 32 + 16]; });
            resolve({ brightness: mean / 255, contrast: Math.min(1, contrast / 90), saturation: sumSat / n, palette: pal });
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = dataUrl;
      } catch (e) { resolve(null); }
    });
  }
  function rgbHex(a) { function h(x) { x = Math.max(0, Math.min(255, Math.round(x))).toString(16); return x.length < 2 ? '0' + x : x; } return '#' + h(a[0]) + h(a[1]) + h(a[2]); }
  function aggregatePixels(list) {
    list = (list || []).filter(Boolean); if (!list.length) return null;
    var b = 0, c = 0, s = 0, palAll = {};
    list.forEach(function (p) { b += p.brightness; c += p.contrast; s += p.saturation; (p.palette || []).forEach(function (rgb, idx) { var key = (rgb[0] >> 5) + '|' + (rgb[1] >> 5) + '|' + (rgb[2] >> 5); palAll[key] = (palAll[key] || 0) + (6 - idx); }); });
    var pal = Object.keys(palAll).sort(function (a, d) { return palAll[d] - palAll[a]; }).slice(0, 6).map(function (k) { var p = k.split('|'); return rgbHex([(+p[0]) * 32 + 16, (+p[1]) * 32 + 16, (+p[2]) * 32 + 16]); });
    return { brightness: b / list.length, contrast: c / list.length, saturation: s / list.length, palette: pal, n: list.length };
  }
  function genVision(key, prompt, imgs) {
    var parts = [{ text: prompt }]; imgs.forEach(function (b) { if (b) parts.push({ inlineData: { mimeType: 'image/jpeg', data: b } }); });
    var body = { contents: [{ parts: parts }], generationConfig: { temperature: 0.6 } };
    var models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'], i = 0;
    return new Promise(function (resolve, reject) {
      (function tryM() {
        if (i >= models.length) return reject(new Error('No vision model available'));
        var m = models[i++];
        fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (r) { if (!r.ok) throw new Error('g' + r.status); return r.json(); })
          .then(function (j) { var p = (((j.candidates || [])[0] || {}).content || {}).parts; var t = (p && p[0] && p[0].text) || ''; if (!t) return tryM(); resolve(t); })
          .catch(function () { tryM(); });
      })();
    });
  }
  function genImage(key, p) {
    var body = { contents: [{ parts: [{ text: 'Generate ONE image. ' + p + ' Absolutely NO text, letters, words or watermark inside the image.' }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
    var models = ['gemini-2.0-flash-preview-image-generation', 'gemini-2.5-flash-image-preview', 'gemini-2.5-flash-image'], i = 0;
    return new Promise(function (resolve, reject) {
      (function tryM() {
        if (i >= models.length) return reject(new Error('Gemini returned no image.'));
        var m = models[i++];
        fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (r) { if (!r.ok) throw new Error('g' + r.status); return r.json(); })
          .then(function (j) { var parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [], img = null; parts.forEach(function (pt) { var dd = pt.inlineData || pt.inline_data; if (dd && dd.data) img = 'data:' + ((dd.mimeType || dd.mime_type) || 'image/png') + ';base64,' + dd.data; }); if (!img) return tryM(); resolve(img); })
          .catch(function () { tryM(); });
      })();
    });
  }

  function favs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } }
  function setFavs(a) { try { localStorage.setItem(FAV_KEY, JSON.stringify(a.slice(0, 200))); } catch (e) {} }
  function isFav(id) { return favs().some(function (f) { return f.id === id; }); }
  function toggleFav(v) { var a = favs(), idx = a.map(function (f) { return f.id; }).indexOf(v.id); if (idx >= 0) a.splice(idx, 1); else a.unshift({ id: v.id, title: v.title, vn: v.vn, channel: v.channel, niche: _label }); setFavs(a); }

  function card(title) { var c = document.createElement('div'); c.className = 'tk-card'; if (title) { var h = document.createElement('h3'); h.textContent = title; c.appendChild(h); } return c; }
  function copyBtn(text, label) { var b = document.createElement('button'); b.className = 'tk-btn sm'; b.textContent = label || 'Copy'; b.addEventListener('click', function () { TK.copy(text, b); }); return b; }

  function cell(v, badge) {
    var d = document.createElement('div'); d.className = 'tl-cell';
    var tw = document.createElement('div'); tw.className = 'tl-tw';
    var im = document.createElement('img'); im.className = 'tl-thumb'; im.loading = 'lazy'; im.src = thumbUrl(v.id); im.alt = v.title;
    tw.appendChild(im);
    if (badge) { var bd = document.createElement('span'); bd.className = 'tl-badge'; bd.textContent = badge; tw.appendChild(bd); }
    var fv = document.createElement('button'); fv.className = 'tl-fav' + (isFav(v.id) ? ' on' : ''); fv.textContent = isFav(v.id) ? '♥' : '♡'; fv.title = 'Favorite';
    fv.addEventListener('click', function (e) { e.stopPropagation(); toggleFav(v); fv.className = 'tl-fav' + (isFav(v.id) ? ' on' : ''); fv.textContent = isFav(v.id) ? '♥' : '♡'; });
    tw.appendChild(fv);
    tw.addEventListener('click', function () { window.open('https://www.youtube.com/watch?v=' + v.id, '_blank'); });
    d.appendChild(tw);
    var info = document.createElement('div'); info.className = 'tl-info';
    var tt = document.createElement('div'); tt.className = 'tl-vt'; tt.textContent = v.title; info.appendChild(tt);
    var vm = document.createElement('div'); vm.className = 'tl-vm';
    var ch = document.createElement('span'); ch.textContent = v.channel || ''; ch.style.cssText = 'max-width:55%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
    var st = document.createElement('span'); st.innerHTML = '<span class="v">▶ ' + fmt(v.vn) + '</span>' + (v.vph ? ' · ⚡' + fmt(Math.round(v.vph)) + '/h' : '');
    vm.appendChild(ch); vm.appendChild(st); info.appendChild(vm);
    d.appendChild(info);
    return d;
  }

  function sortVids(vids) {
    var a = vids.slice();
    if (_sort === 'views') a.sort(function (x, y) { return y.vn - x.vn; });
    else if (_sort === 'vph') a.sort(function (x, y) { return (y.vph || 0) - (x.vph || 0); });
    else if (_sort === 'recent') a.sort(function (x, y) { return (x.ageH == null ? 1e9 : x.ageH) - (y.ageH == null ? 1e9 : y.ageH); });
    return a;
  }

  function renderGrid() {
    resultEl.innerHTML = '';
    var head = document.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;';
    var h = document.createElement('div'); h.style.cssText = 'font-size:17px;font-weight:900;color:#fff;'; h.textContent = (_label || 'Results') + ' · ' + _vids.length + ' real thumbnails'; head.appendChild(h);
    var ex = document.createElement('button'); ex.className = 'tk-btn'; ex.style.cssText = 'background:#0a0a0a;border:1px solid var(--neon);color:#fff;font-weight:900;'; ex.textContent = 'Extract the pattern and generate';
    ex.addEventListener('click', function () { extractAndGenerate(); }); head.appendChild(ex);
    resultEl.appendChild(head);
    var anchor = document.createElement('div'); anchor.id = 'tl-analysis'; resultEl.appendChild(anchor);
    var grid = document.createElement('div'); grid.className = 'tl-grid';
    sortVids(_vids).forEach(function (v) { grid.appendChild(cell(v, _label)); });
    resultEl.appendChild(grid);
  }

  function renderFavorites() {
    resultEl.innerHTML = '';
    var a = favs();
    var h = document.createElement('div'); h.style.cssText = 'font-size:17px;font-weight:900;color:#fff;margin-bottom:14px;'; h.textContent = 'Your favorites · ' + a.length; resultEl.appendChild(h);
    if (!a.length) { var e = document.createElement('div'); e.className = 'tk-scene-meta'; e.textContent = 'Nothing saved yet. Tap the heart on any thumbnail in Discover.'; resultEl.appendChild(e); return; }
    var grid = document.createElement('div'); grid.className = 'tl-grid';
    a.forEach(function (v) { grid.appendChild(cell(v, v.niche || '')); });
    resultEl.appendChild(grid);
  }

  function bar(label, val, color, valText) {
    var wrap = document.createElement('div'); wrap.style.cssText = 'margin-top:10px;';
    var top = document.createElement('div'); top.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:rgba(255,255,255,.85);margin-bottom:4px;';
    var l = document.createElement('span'); l.textContent = label; var vt = document.createElement('span'); vt.style.color = color; vt.textContent = valText; top.appendChild(l); top.appendChild(vt); wrap.appendChild(top);
    var track = document.createElement('div'); track.style.cssText = 'height:8px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;';
    var fill = document.createElement('div'); fill.style.cssText = 'height:100%;width:' + Math.round(Math.max(0, Math.min(1, val)) * 100) + '%;background:' + color + ';'; track.appendChild(fill); wrap.appendChild(track);
    return wrap;
  }
  function lvl(v) { return v >= 0.66 ? 'HIGH' : v >= 0.4 ? 'MEDIUM' : 'LOW'; }

  function renderExtraction(px, d, topic) {
    var c = card('Niche extraction: ' + topic);
    var sub = document.createElement('div'); sub.className = 'tk-scene-meta'; sub.textContent = 'Everything the winning thumbnails have in common: measured from the pixels and read by AI.'; c.appendChild(sub);
    if (px) {
      var mh = document.createElement('div'); mh.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#46d39a;margin-top:14px;'; mh.textContent = 'Measured on ' + px.n + ' thumbnails, real pixels'; c.appendChild(mh);
      c.appendChild(bar('Contrast', px.contrast, '#FFD93D', lvl(px.contrast)));
      c.appendChild(bar('Brightness', px.brightness, '#46d39a', lvl(px.brightness)));
      c.appendChild(bar('Saturation', px.saturation, '#A88FFF', lvl(px.saturation)));
      if (px.palette && px.palette.length) {
        var pl = document.createElement('div'); pl.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:14px;'; pl.textContent = 'Dominant palette, click to copy'; c.appendChild(pl);
        var sw = document.createElement('div'); sw.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;';
        px.palette.forEach(function (hex) { var chip = document.createElement('button'); chip.title = 'Copy ' + hex; chip.style.cssText = 'width:56px;height:56px;border-radius:10px;border:1px solid rgba(255,255,255,.18);cursor:pointer;position:relative;background:' + hex + ';'; var lab = document.createElement('span'); lab.style.cssText = 'position:absolute;left:0;right:0;bottom:0;font-size:8px;font-weight:800;background:rgba(0,0,0,.6);color:#fff;padding:2px 0;'; lab.textContent = hex; chip.appendChild(lab); chip.addEventListener('click', function () { TK.copy(hex, null); lab.textContent = '✓'; setTimeout(function () { lab.textContent = hex; }, 800); }); sw.appendChild(chip); });
        c.appendChild(sw);
      }
    }
    function row(label, val) { if (!val) return; var t = document.createElement('div'); t.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#46d39a;margin-top:14px;'; t.textContent = label; c.appendChild(t); var x = document.createElement('div'); x.style.cssText = 'font-size:12.5px;color:rgba(255,255,255,.88);line-height:1.55;margin-top:3px;'; x.textContent = val; c.appendChild(x); }
    function list(label, arr, color) { if (!arr || !arr.length) return; var t = document.createElement('div'); t.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:' + color + ';margin-top:14px;'; t.textContent = label; c.appendChild(t); arr.forEach(function (v) { var r = document.createElement('div'); r.style.cssText = 'font-size:12.5px;color:rgba(255,255,255,.85);margin-top:4px;'; r.textContent = '• ' + v; c.appendChild(r); }); }
    if (d) {
      row('CTR formula', d.formula); row('Faces', d.faces); row('Text on the thumbnail', d.text);
      row('Composition', d.composition); row('Emotion and hook', d.emotion); row('Contrast and color, read by AI', d.colors);
      list('Recurring elements', d.objects, '#A88FFF'); list('What works', d.do, '#46d39a'); list('What to avoid', d.avoid, '#ff6b6b');
    }
    return c;
  }

  function thumbCell(grid, masterPrompt, i) {
    var cell2 = document.createElement('div'); cell2.style.cssText = 'border:1px solid rgba(255,255,255,.10);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.03);';
    var holder = document.createElement('div'); holder.style.cssText = 'width:100%;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.55);background:#000;text-align:center;padding:8px;'; cell2.appendChild(holder);
    var b = document.createElement('div'); b.className = 'tk-row'; b.style.cssText = 'padding:8px 10px;gap:6px;'; cell2.appendChild(b); grid.appendChild(cell2);
    var prompt = masterPrompt + (i ? ' Variation ' + (i + 1) + ': different composition and angle, same style.' : '');
    function paint(dataUrl) {
      holder.innerHTML = ''; holder.style.padding = '0';
      var im = document.createElement('img'); im.src = dataUrl; im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'; holder.appendChild(im); b.innerHTML = '';
      var dl = document.createElement('button'); dl.className = 'tk-btn sm'; dl.textContent = 'Download'; dl.addEventListener('click', function () { var a = document.createElement('a'); a.href = dataUrl; a.download = 'thumblab-' + (i + 1) + '.png'; document.body.appendChild(a); a.click(); setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} }, 2000); });
      var re = document.createElement('button'); re.className = 'tk-btn sm'; re.textContent = '🔁'; re.title = 'Another variant'; re.addEventListener('click', gen);
      b.appendChild(dl); b.appendChild(re); b.appendChild(copyBtn(prompt, 'Prompt'));
    }
    function gen() { if (!_gkey) { holder.innerHTML = ''; holder.textContent = 'Gemini key missing'; b.innerHTML = ''; b.appendChild(copyBtn(prompt, 'Copy prompt')); return; } holder.innerHTML = '<span class="tk-spin"></span>'; b.innerHTML = ''; genImage(_gkey, prompt).then(paint).catch(function () { holder.innerHTML = ''; holder.textContent = 'Could not generate'; b.innerHTML = ''; b.appendChild(copyBtn(prompt, 'Copy prompt')); }); }
    gen();
  }

  function extractAndGenerate() {
    if (!_vids.length) return;
    var box = $('tl-analysis'); if (!box) return; box.innerHTML = '';
    TK.status(statusEl, 'Extracting the niche pattern: colors, contrast and an AI read', '');
    var top = _vids.slice(0, 8), dataUrls = [];
    Promise.all(top.map(function (v) { return urlToB64(thumbUrl(v.id)).then(function (b) { return b ? ('data:image/jpeg;base64,' + b) : null; }).catch(function () { return null; }); }))
      .then(function (urls) { dataUrls = urls.filter(Boolean); return Promise.all(dataUrls.map(analyzePixels)); })
      .then(function (pxList) {
        var px = aggregatePixels(pxList);
        if (!_gkey) return { px: px, d: {} };
        var imgs = dataUrls.map(function (u) { return u.split(',')[1]; });
        var vp = 'You are a YouTube art director who specializes in CTR. Here are the REAL thumbnails of the most watched videos in the "' + _label + '" niche. Extract everything they have in common and return ONLY valid JSON, all text in English:\n' +
          '{\n  "formula": "2-3 sentences: the shared winning pattern",\n  "faces": "use of faces: how many and the dominant expression, or whether they are faceless",\n  "text": "use of text: relative size, how many words, and 2 real examples",\n  "composition": "dominant composition",\n  "emotion": "emotion or psychological hook",\n  "colors": "color scheme and contrast level",\n  "objects": ["3-5 recurring visual elements"],\n  "do": ["5 things the winners do"],\n  "avoid": ["3 mistakes to avoid"],\n  "masterPrompt": "ONE detailed ENGLISH thumbnail image-gen prompt recreating the winning style (subject, composition, lighting, mood, palette, contrast); cinematic, ultra high CTR, sharp, 16:9"\n}';
        return genVision(_gkey, vp, imgs).then(function (txt) { return { px: px, d: TK.json(txt) || {} }; }, function () { return { px: px, d: {} }; });
      })
      .then(function (res) {
        var px = res.px, d = res.d || {};
        box.appendChild(renderExtraction(px, d, _label));
        var gc = card('Your thumbnails, cloning the winning style');
        if (_gkey) {
          var note = document.createElement('div'); note.className = 'tk-scene-meta'; note.textContent = 'Generated by AI from the niche formula, palette and contrast. Add the overlay text yourself.'; gc.appendChild(note);
          var ggrid = document.createElement('div'); ggrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:10px;'; gc.appendChild(ggrid);
          var mp = d.masterPrompt || ('Cinematic ultra high-CTR YouTube thumbnail for "' + _label + '", dramatic lighting, bold subject, rich colors, sharp, 16:9');
          if (px && px.palette && px.palette.length) mp += ' Dominant palette: ' + px.palette.slice(0, 4).join(', ') + '. ' + (px.contrast >= 0.6 ? 'Very high contrast.' : 'High contrast.');
          for (var i = 0; i < 3; i++) thumbCell(ggrid, mp, i);
        } else {
          var n2 = document.createElement('div'); n2.className = 'tk-scene-meta'; n2.textContent = 'Add your free Gemini key in Options for the AI read and to generate thumbnails in this style.'; gc.appendChild(n2);
        }
        box.appendChild(gc);
        TK.status(statusEl, 'Extraction complete.', 'ok');
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (e) { TK.status(statusEl, String(e && e.message || e), 'error'); });
  }

  function setActive(container, attr, val) { var bs = container.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('active', bs[i].getAttribute(attr) === val); }

  function loadQuery(query, label) {
    _label = label; _view = 'discover'; setActive($('tl-views'), 'data-view', 'discover');
    resultEl.innerHTML = ''; TK.status(statusEl, '', ''); statusEl.innerHTML = '<span class="tk-spin"></span>Loading the winning thumbnails in ' + label; statusEl.style.color = '#FFD93D';
    var mk = (marketEl.value || 'US|en').split('|');
    ittSearch(query, mk[0], mk[1]).then(function (list) {
      _vids = (list || []).filter(function (v) { return v.vn > 0; });
      if (!_vids.length) _vids = list || [];
      if (!_vids.length) { TK.status(statusEl, 'Nothing found for "' + label + '". Try another term or market.', 'error'); return; }
      renderGrid(); TK.status(statusEl, _vids.length + ' real thumbnails. Click one to open the video, the heart saves it, and Extract reads the pattern.', 'ok');
    }).catch(function (e) { TK.status(statusEl, String(e && e.message || e), 'error'); });
  }

  function renderSidebar() {
    var nv = $('tl-niches'); nv.innerHTML = '';
    NICHES.forEach(function (nn) {
      var b = document.createElement('button'); b.setAttribute('data-niche', nn.n); b.innerHTML = '<span>' + nn.i + '</span><span>' + nn.n + '</span>';
      b.addEventListener('click', function () { setActive(nv, 'data-niche', nn.n); loadQuery(nn.q, nn.n); });
      nv.appendChild(b);
    });
    $('tl-views').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var view = b.getAttribute('data-view'); setActive($('tl-views'), 'data-view', view); _view = view;
        if (view === 'favorites') renderFavorites(); else if (_vids.length) renderGrid(); else loadQuery(NICHES[0].q, NICHES[0].n);
      });
    });
    $('tl-sorts').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { _sort = b.getAttribute('data-sort'); setActive($('tl-sorts'), 'data-sort', _sort); if (_view === 'discover' && _vids.length) renderGrid(); });
    });
  }

  go.addEventListener('click', function () { var q = topicEl.value.trim(); if (q) loadQuery(q, q); });
  topicEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var q = topicEl.value.trim(); if (q) loadQuery(q, q); } });

  renderSidebar();
  TK.keys().then(function (k) { _gkey = (k && k.gemini && /^AIza/.test(k.gemini)) ? k.gemini : ''; }, function () { _gkey = ''; }).then(function () {
    if (_seed) { topicEl.value = _seed; loadQuery(_seed, _seed); }
    else { setActive($('tl-niches'), 'data-niche', NICHES[0].n); loadQuery(NICHES[0].q, NICHES[0].n); }
  });
})();
