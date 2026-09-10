(function () {
  'use strict';
  TK.mountHead('BrandForge', 'AI BRANDING');
  var $ = function (id) { return document.getElementById(id); };
  var nicheEl = $('niche'), styleEl = $('style'), langEl = $('lang'), statusEl = $('status'), resultEl = $('result'), go = $('go');

  try { var hp = localStorage.getItem('zerack_handoff_topic'); if (hp && !nicheEl.value) { nicheEl.value = hp; localStorage.removeItem('zerack_handoff_topic'); } } catch (e) {}

  function sys() {
    return 'You are a brand strategist for faceless YouTube channels that earn at scale. You create identities that are memorable, brandable and monetizable. ' +
      'You return ONLY valid JSON, with no extra text and no markdown.';
  }
  function aiPrompt(niche, lang) {
    return 'CHANNEL NICHE: "' + niche.slice(0, 500) + '"\nLANGUAGE of the visible text: ' + lang + '\n\n' +
      'Return a JSON object with this EXACT shape:\n' +
      '{\n' +
      '  "names": ["8 short channel names, memorable and brandable, never generic, in ' + lang + '"],\n' +
      '  "handles": ["6 handles like @name, no spaces, derived from the names"],\n' +
      '  "tagline": "one short, strong tagline in ' + lang + '",\n' +
      '  "bio": "channel description in ' + lang + ', 2-3 sentences: hook, what they will find, soft call to action",\n' +
      '  "palette": [{"hex":"#RRGGBB","use":"what it is for: background, accent or text"}],\n' +
      '  "pillars": ["5 content pillars or series for the channel, in ' + lang + '"],\n' +
      '  "logoIdea": "ENGLISH visual concept for the channel logo icon (object + mood, no text)",\n' +
      '  "bannerIdea": "ENGLISH visual concept for the channel banner (scene + atmosphere, no text)"\n' +
      '}\nThe palette must have 5 colors that match the niche. NOTHING outside the JSON.';
  }

  function genImage(key, prompt) {
    var body = { contents: [{ parts: [{ text: 'Generate ONE image. ' + prompt + ' Absolutely NO text, letters, words or watermark inside the image.' }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
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
            parts.forEach(function (p) { var d = p.inlineData || p.inline_data; if (d && d.data) img = 'data:' + ((d.mimeType || d.mime_type) || 'image/png') + ';base64,' + d.data; });
            if (!img) return tryM();
            resolve(img);
          }).catch(function () { tryM(); });
      })();
    });
  }

  var _gkey = '';

  function run() {
    var niche = nicheEl.value.trim();
    if (!niche) { TK.status(statusEl, 'Type the channel niche or topic first.', 'error'); return; }
    go.disabled = true; resultEl.innerHTML = '';
    statusEl.innerHTML = '<span class="tk-spin"></span>Building your brand identity'; statusEl.style.color = '#FFD93D';
    TK.keys().then(function (k) {
      _gkey = (k.gemini && /^AIza/.test(k.gemini)) ? k.gemini : '';
      return TK.ai(sys(), aiPrompt(niche, langEl.value), 0.85);
    }).then(function (txt) {
      var d = TK.json(txt);
      if (!d || !d.names) throw new Error('The AI did not return a valid brand. Try again.');
      render(d, niche, styleEl.value);
      TK.status(statusEl, 'Identity ready' + (_gkey ? ', generating the logo and banner with Gemini' : '. Add your Gemini key in Options to generate the logo and banner.'), 'ok');
    }).catch(function (e) {
      if (String(e && e.message) === 'NOKEYS') { resultEl.innerHTML = TK.needKeysHTML(); TK.wireNeedKeys(resultEl); TK.status(statusEl, '', ''); }
      else TK.status(statusEl, String(e && e.message || e), 'error');
    }).then(function () { go.disabled = false; });
  }

  function copyBtn(text, label) {
    var b = document.createElement('button'); b.className = 'tk-btn sm'; b.textContent = label || 'Copy';
    b.addEventListener('click', function () { TK.copy(text, b); });
    return b;
  }
  function block(title) {
    var card = document.createElement('div'); card.className = 'tk-card';
    var h = document.createElement('h3'); h.textContent = title; card.appendChild(h);
    return card;
  }
  function lineList(card, items, withCopyAll) {
    if (withCopyAll && items.length) {
      var all = document.createElement('button'); all.className = 'tk-btn sm'; all.style.float = 'right'; all.textContent = 'Copy all';
      all.addEventListener('click', function () { TK.copy(items.join('\n'), all); });
      card.querySelector('h3').appendChild(all);
    }
    items.forEach(function (it) {
      var row = document.createElement('div'); row.className = 'tk-scene';
      var rh = document.createElement('div'); rh.className = 'tk-scene-h';
      var n = document.createElement('span'); n.className = 'tk-scene-n'; n.style.textTransform = 'none'; n.style.letterSpacing = '0'; n.textContent = it;
      rh.appendChild(n); rh.appendChild(copyBtn(it));
      row.appendChild(rh); card.appendChild(row);
    });
  }

  function imgCard(card, title, prompt, isBanner, fname) {
    var row = document.createElement('div'); row.className = 'tk-scene';
    var n = document.createElement('div'); n.className = 'tk-scene-n'; n.textContent = title; row.appendChild(n);

    var holder = document.createElement('div');
    holder.style.cssText = 'width:100%;max-width:' + (isBanner ? '460px' : '190px') + ';aspect-ratio:' + (isBanner ? '16/9' : '1/1')
      + ';border-radius:12px;margin:8px 0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);'
      + 'display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,.55);overflow:hidden;text-align:center;padding:8px;';
    row.appendChild(holder);

    var ctr = document.createElement('div'); ctr.className = 'tk-row';
    row.appendChild(ctr);
    card.appendChild(row);

    function paint(dataUrl) {
      holder.innerHTML = ''; holder.style.padding = '0';
      var img = document.createElement('img'); img.src = dataUrl; img.alt = title;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      holder.appendChild(img);
      ctr.innerHTML = '';
      var dl = document.createElement('button'); dl.className = 'tk-btn sm'; dl.textContent = 'Download';
      dl.addEventListener('click', function () { var a = document.createElement('a'); a.href = dataUrl; a.download = fname; document.body.appendChild(a); a.click(); setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} }, 2000); });
      var re = document.createElement('button'); re.className = 'tk-btn sm'; re.textContent = 'Another variant';
      re.addEventListener('click', function () { gen(); });
      ctr.appendChild(dl); ctr.appendChild(re); ctr.appendChild(copyBtn(prompt, 'Copy prompt'));
    }
    function promptOnly(msg) {
      holder.innerHTML = ''; holder.textContent = msg;
      ctr.innerHTML = ''; ctr.appendChild(copyBtn(prompt, 'Copy prompt'));
    }
    function gen() {
      if (!_gkey) { promptOnly('Add your Gemini key in Options to generate the image. In the meantime, copy the prompt.'); return; }
      holder.innerHTML = '<span class="tk-spin"></span> generating'; ctr.innerHTML = '';
      genImage(_gkey, prompt).then(paint).catch(function (e) { promptOnly((e && e.message || 'The image could not be generated') + '. Copy the prompt and run it in your own image AI.'); });
    }
    gen();
  }

  function render(d, niche, styleHint) {
    resultEl.innerHTML = '';

    var nc = block('Channel names');
    lineList(nc, (d.names || []).map(String), true);
    if (d.handles && d.handles.length) {
      var hh = document.createElement('div'); hh.className = 'tk-scene-meta'; hh.style.marginTop = '6px';
      hh.textContent = 'Handles: ' + d.handles.join('  ·  ');
      nc.appendChild(hh);
    }
    resultEl.appendChild(nc);

    if (d.tagline || d.bio) {
      var bc = block('Tagline and bio');
      if (d.tagline) { var tg = document.createElement('div'); tg.className = 'tk-scene'; var tgn = document.createElement('div'); tgn.style.cssText = 'font-size:15px;font-weight:900;color:#fff;margin-bottom:4px;'; tgn.textContent = d.tagline; tg.appendChild(tgn); tg.appendChild(copyBtn(d.tagline)); bc.appendChild(tg); }
      if (d.bio) { var bo = document.createElement('div'); bo.className = 'tk-scene'; var bot = document.createElement('div'); bot.style.cssText = 'font-size:12px;color:rgba(255,255,255,.85);line-height:1.6;margin-bottom:6px;'; bot.textContent = d.bio; bo.appendChild(bot); bo.appendChild(copyBtn(d.bio)); bc.appendChild(bo); }
      resultEl.appendChild(bc);
    }

    if (d.palette && d.palette.length) {
      var pc = block('Brand palette');
      var sw = document.createElement('div'); sw.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;';
      d.palette.forEach(function (c) {
        var hex = (c && c.hex) || (typeof c === 'string' ? c : '#000000');
        var chip = document.createElement('button');
        chip.title = 'Copy ' + hex + (c && c.use ? ' (' + c.use + ')' : '');
        chip.style.cssText = 'width:64px;height:64px;border-radius:12px;border:1px solid rgba(255,255,255,.18);cursor:pointer;position:relative;background:' + hex + ';';
        var lab = document.createElement('span'); lab.style.cssText = 'position:absolute;left:0;right:0;bottom:0;font-size:8px;font-weight:800;background:rgba(0,0,0,.55);color:#fff;padding:2px 0;border-radius:0 0 11px 11px;'; lab.textContent = hex;
        chip.appendChild(lab);
        chip.addEventListener('click', function () { TK.copy(hex, null); lab.textContent = '✓'; setTimeout(function () { lab.textContent = hex; }, 900); });
        sw.appendChild(chip);
      });
      pc.appendChild(sw); resultEl.appendChild(pc);
    }

    var ic = block('Logo and banner, generated with Gemini');
    var logoP = 'Square 1:1 minimalist YouTube channel LOGO ICON: ' + (d.logoIdea || (niche + ' symbol')) + '. Style: ' + styleHint + '. Centered emblem, bold, flat, high contrast, clean.';
    var bannerP = 'Wide 16:9 cinematic YouTube channel BANNER art: ' + (d.bannerIdea || niche) + '. Style: ' + styleHint + '. Atmospheric, professional, empty space in the center for the channel name.';
    imgCard(ic, 'LOGO · variant 1', logoP, false, 'logo-1.png');
    imgCard(ic, 'LOGO · variant 2', logoP, false, 'logo-2.png');
    imgCard(ic, 'BANNER (16:9)', bannerP, true, 'banner.png');
    var note = document.createElement('div'); note.className = 'tk-scene-meta';
    note.textContent = 'The ideal YouTube banner is 2560x1440. For full resolution, copy the prompt and generate it large in the image AI you prefer.';
    ic.appendChild(note);
    resultEl.appendChild(ic);

    var act = document.createElement('div'); act.className = 'tk-row'; act.style.marginTop = '4px';
    var dlk = document.createElement('button'); dlk.className = 'tk-btn'; dlk.textContent = 'Download brand kit (.txt)';
    dlk.addEventListener('click', function () {
      var kit = 'BRAND KIT: ' + niche + '\n\nNAMES:\n' + (d.names || []).join('\n')
        + '\n\nHANDLES:\n' + (d.handles || []).join('\n')
        + '\n\nTAGLINE: ' + (d.tagline || '') + '\n\nBIO:\n' + (d.bio || '')
        + '\n\nPALETTE:\n' + (d.palette || []).map(function (c) { return (c.hex || c) + ': ' + (c.use || ''); }).join('\n')
        + '\n\nCONTENT PILLARS:\n' + (d.pillars || []).join('\n')
        + '\n\nLOGO PROMPT:\n' + logoP + '\n\nBANNER PROMPT:\n' + bannerP;
      TK.download('brand-kit.txt', kit);
    });
    act.appendChild(dlk);
    resultEl.appendChild(act);

    if (d.pillars && d.pillars.length) {
      var plc = block('Content pillars');
      lineList(plc, d.pillars.map(String), true);
      resultEl.appendChild(plc);
    }
  }

  go.addEventListener('click', run);
  if (nicheEl.value.trim()) TK.status(statusEl, 'Niche loaded. Press Generate.', '');
})();
