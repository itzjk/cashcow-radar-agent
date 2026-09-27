(function (root) {
  'use strict';

  var SHARE = root.NSP_SHARE_CARD || null;
  var TONES = { good: 1, bad: 1, muted: 1, plain: 1 };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function safeLink(href) {
    var u = null;
    try { u = new URL(String(href || '')); } catch (e) { return ''; }
    return u.protocol === 'https:' && /^(?:www\.)?youtube\.com$/.test(u.hostname) ? u.href : '';
  }

  function safeWeb(href) {
    var u = null;
    try { u = new URL(String(href || '')); } catch (e) { return ''; }
    return u.protocol === 'https:' && u.hostname && !/^(?:localhost|127\.|\[)/.test(u.hostname) ? u.href : '';
  }

  function anchor(text, href) {
    var a = el('a', '', text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function tone(v) {
    return TONES[v] === 1 ? v : 'plain';
  }

  var IMG_SRC = /^(?:https:\/\/i\.ytimg\.com\/vi(?:_webp)?\/[A-Za-z0-9_-]{11}\/[a-z0-9_]{2,20}\.(?:jpg|webp)|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+\/=]+)$/;
  var SIDES = { left: 1, top: 1, bottom: 1 };
  var FILE_TYPES = /^image\/(?:png|jpeg|webp)$/;
  var FILE_MAX = 20 * 1024 * 1024;

  function safeImg(src) {
    var s = String(src || '');
    return IMG_SRC.test(s) ? s : '';
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('the image did not load')); };
      img.src = src;
    });
  }

  function overlayLines(g, text, max) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [], cur = '';
    words.forEach(function (w) {
      var next = cur ? cur + ' ' + w : w;
      if (!cur || g.measureText(next).width <= max) cur = next;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  }

  function composeImage(src, ov) {
    return loadImage(src).then(function (img) {
      var c = document.createElement('canvas');
      c.width = 1280;
      c.height = 720;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, 1280, 720);
      if (ov && ov.text) {
        var side = SIDES[ov.side] ? ov.side : 'left';
        var size = side === 'left' ? 118 : 104;
        g.font = '900 ' + size + 'px "Impact", "Arial Black", "Helvetica Neue", Arial, sans-serif';
        g.lineJoin = 'round';
        var max = side === 'left' ? 520 : 1120;
        var lines = overlayLines(g, String(ov.text).toUpperCase(), max);
        var lh = size * 1.02;
        var total = lines.length * lh;
        var y0 = side === 'top' ? 56 : (side === 'bottom' ? 720 - 56 - total : (720 - total) / 2);
        g.textBaseline = 'top';
        g.textAlign = side === 'left' ? 'left' : 'center';
        var x = side === 'left' ? 64 : 640;
        lines.forEach(function (t, i) {
          g.lineWidth = 14;
          g.strokeStyle = '#000';
          g.strokeText(t, x, y0 + i * lh);
          g.fillStyle = i === lines.length - 1 && lines.length > 1 ? '#ffd21f' : '#fff';
          g.fillText(t, x, y0 + i * lh);
        });
      }
      return new Promise(function (resolve, reject) { c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('no image')); }, 'image/png'); });
    });
  }

  function figure(im) {
    var src = safeImg(im && im.src);
    if (!src) return null;
    var f = el('figure', 'ic-fig' + (im.phone ? ' phone' : '') + (im.big ? ' big' : '') + (im.mine ? ' mine' : ''));
    var frame = el('div', 'ic-frame');
    var img = document.createElement('img');
    img.alt = String(im.label || '');
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = src;
    var href = safeLink(im.link);
    if (href) {
      var a = el('a', 'ic-frame-link');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(img);
      frame.appendChild(a);
    } else {
      frame.appendChild(img);
    }
    if (im.overlay && im.overlay.text) {
      var ov = el('span', 'ic-ov', String(im.overlay.text).toUpperCase());
      ov.dataset.side = SIDES[im.overlay.side] ? im.overlay.side : 'left';
      frame.appendChild(ov);
    }
    f.appendChild(frame);
    if (im.label) f.appendChild(el('figcaption', '', im.label));
    if (im.save && SHARE) {
      var note = el('div', 'ic-status');
      var b = button('Save PNG', ICON_SAVE);
      b.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        b.disabled = true;
        composeImage(src, im.overlay).then(function (blob) { return SHARE.save(blob, String(im.save).replace(/[^a-z0-9._-]/gi, '-').slice(0, 60)); }).then(function (ok) {
          status(note, ok ? 'Saved to your Downloads folder.' : 'The download did not start.', ok ? 'ok' : 'err');
        }, function () { status(note, 'The image could not be saved.', 'err'); }).then(function () { b.disabled = false; });
      });
      var row = el('div', 'ic-fig-actions');
      row.appendChild(b);
      f.appendChild(row);
      f.appendChild(note);
    }
    return f;
  }

  function gallery(list) {
    var box = el('div', 'ic-gallery');
    (list || []).forEach(function (im) { var f = figure(im); if (f) box.appendChild(f); });
    return box.childNodes.length ? box : null;
  }

  function table(t) {
    if (!t || !Array.isArray(t.rows) || !t.rows.length) return null;
    var wrap = el('div', 'ic-table');
    if (Number(t.hi) >= 1 && Number(t.hi) <= 12) wrap.dataset.hi = String(Math.round(Number(t.hi)));
    var tbl = document.createElement('table');
    if (Array.isArray(t.head)) {
      var thead = document.createElement('thead');
      var tr = document.createElement('tr');
      t.head.forEach(function (h) { tr.appendChild(el('th', '', h)); });
      thead.appendChild(tr);
      tbl.appendChild(thead);
    }
    var tb = document.createElement('tbody');
    t.rows.slice(0, 12).forEach(function (r) {
      var row = document.createElement('tr');
      (Array.isArray(r) ? r : []).forEach(function (cell) { row.appendChild(el('td', '', cell)); });
      tb.appendChild(row);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    return wrap;
  }

  function copyButton(spec) {
    var box = el('div', 'ic-copy');
    var note = el('div', 'ic-status');
    var b = button(spec.label || 'Copy', ICON_COPY);
    b.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      var done = function (ok) { status(note, ok ? 'Copied.' : 'Copy was refused here. Select the text and copy it.', ok ? 'ok' : 'err'); };
      try { navigator.clipboard.writeText(String(spec.text || '')).then(function () { done(true); }, function () { done(false); }); } catch (x) { done(false); }
    });
    box.appendChild(b);
    box.appendChild(note);
    return box;
  }

  function row(r) {
    var box = el('div', 'ic-row' + (r.wide ? ' wide' : '') + (r.num ? ' num' : ''));
    box.dataset.tone = tone(r.tone);
    if (r.busy) box.dataset.busy = '1';
    var href = safeLink(r.link) || safeWeb(r.web);
    var onLabel = href && r.linkOn === 'label';
    var lab = el('div', 'ic-label');
    if (onLabel) lab.appendChild(anchor(r.label, href)); else lab.textContent = String(r.label == null ? '' : r.label);
    box.appendChild(lab);
    var val = el('div', 'ic-value' + (r.mono ? ' mono' : ''));
    if (href && !onLabel) {
      var a = el('a', '', r.value);
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      val.appendChild(a);
    } else {
      val.textContent = String(r.value == null ? '' : r.value);
    }
    if (r.note) val.appendChild(el('div', 'ic-why', r.note));
    box.appendChild(val);
    if (r.tag) {
      var tag = el('span', 'ic-tag', r.tag);
      tag.dataset.tone = tone(r.tone);
      box.appendChild(tag);
    }
    return box;
  }

  function meter(m) {
    var steps = Math.max(1, Math.min(10, Math.round(Number(m.steps) || 5)));
    var level = Math.max(0, Math.min(steps, Math.round(Number(m.level) || 0)));
    var box = el('div', 'ic-meter');
    box.dataset.tone = tone(m.tone);
    var bar = el('div', 'ic-meter-bar');
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(steps));
    bar.setAttribute('aria-valuenow', String(level));
    bar.setAttribute('aria-label', String(m.label || ''));
    for (var i = 0; i < steps; i++) {
      var seg = el('span', 'ic-meter-seg');
      if (i < level) seg.dataset.on = '1';
      bar.appendChild(seg);
    }
    box.appendChild(bar);
    var cap = el('div', 'ic-meter-cap');
    cap.appendChild(el('span', 'ic-meter-label', m.label || ''));
    cap.appendChild(el('span', 'ic-meter-count', level + ' / ' + steps));
    box.appendChild(cap);
    return box;
  }

  function section(s) {
    var box = el('section', 'ic-sec' + (s.concept ? ' concept' : ''));
    if (s.state) box.dataset.state = String(s.state);
    box.appendChild(el('div', 'ic-sec-title', s.title));
    if (s.meter) box.appendChild(meter(s.meter));
    var pics = gallery(s.images);
    if (pics) box.appendChild(pics);
    var grid = table(s.table);
    if (grid) box.appendChild(grid);
    var rows = el('div', 'ic-rows');
    (s.rows || []).forEach(function (r) { if (r && (r.label || r.value)) rows.appendChild(row(r)); });
    if (rows.childNodes.length) box.appendChild(rows);
    if (s.copy && s.copy.text) box.appendChild(copyButton(s.copy));
    if (s.note) box.appendChild(el('p', 'ic-note', s.note));
    return box;
  }

  function status(node, text, kind) {
    node.textContent = text || '';
    node.dataset.kind = kind || '';
  }

  function button(label, icon) {
    var b = el('button', 'ic-btn');
    b.type = 'button';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', icon);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    b.appendChild(svg);
    b.appendChild(el('span', '', label));
    return b;
  }

  var ICON_SAVE = 'M12 4v11M7 10l5 5 5-5M5 19h14';
  var ICON_COPY = 'M9 9h10v10H9zM5 15V5h10';
  var ICON_X = 'M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M12 3v12M7 8l5-5 5 5';
  var ICON_UP = 'M12 19V6M6 12l6-6 6 6';

  function readFile(file) {
    if (!file || !FILE_TYPES.test(String(file.type || ''))) return Promise.reject(new Error('Use a PNG, JPEG or WebP image.'));
    if (file.size > FILE_MAX) return Promise.reject(new Error('That image is over 20 MB.'));
    return createImageBitmap(file).then(function (bmp) {
      var w = Math.min(1280, bmp.width), h = Math.max(1, Math.round(bmp.height * w / bmp.width));
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.drawImage(bmp, 0, 0, w, h);
      var out = { data: c.toDataURL('image/jpeg', 0.92), w: bmp.width, h: bmp.height, name: String(file.name || 'image').slice(0, 60) };
      bmp.close();
      return out;
    });
  }

  function dropZone(image, onPick) {
    var zone = el('div', 'ic-drop');
    zone.tabIndex = 0;
    zone.setAttribute('role', 'button');
    zone.setAttribute('aria-label', 'Choose or drop a thumbnail');
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.hidden = true;
    var face = el('div', 'ic-drop-face');
    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '22');
    icon.setAttribute('height', '22');
    icon.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICON_UP);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    icon.appendChild(path);
    face.appendChild(icon);
    face.appendChild(el('div', 'ic-drop-title', 'Drop the thumbnail here'));
    face.appendChild(el('div', 'ic-drop-sub', 'or click to choose a file, or paste it. PNG, JPEG or WebP.'));
    var preview = el('div', 'ic-drop-preview');
    preview.hidden = true;
    zone.appendChild(face);
    zone.appendChild(preview);
    zone.appendChild(input);
    var take = function (file) {
      onPick('reading');
      readFile(file).then(function (got) {
        image.data = got.data;
        while (preview.firstChild) preview.removeChild(preview.firstChild);
        var img = document.createElement('img');
        img.alt = '';
        img.src = got.data;
        preview.appendChild(img);
        preview.appendChild(el('div', 'ic-drop-name', got.name + ', ' + got.w + ' x ' + got.h));
        preview.hidden = false;
        face.hidden = true;
        zone.dataset.full = '1';
        onPick('ok');
      }, function (e) { onPick('err', e && e.message); });
    };
    zone.addEventListener('click', function (e) { if (e.isTrusted) input.click(); });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { if (input.files && input.files[0]) take(input.files[0]); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.dataset.over = '1'; });
    zone.addEventListener('dragleave', function () { zone.dataset.over = ''; });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.dataset.over = '';
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) take(f);
    });
    zone.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && FILE_TYPES.test(items[i].type)) { e.preventDefault(); take(items[i].getAsFile()); return; }
      }
    });
    return zone;
  }

  function jobLabel(op, v) {
    var clipT = function (t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '\u2026' : t; };
    if (op === 'policy') return 'Check before upload: ' + clipT(v.title || v.script || v.description, 80);
    if (op === 'thumb') return 'Judge this thumbnail' + (v.title ? ': ' + clipT(v.title, 80) : '');
    if (op === 'money') return 'Money calculator: ' + clipT(v.niche, 60) + (v.views ? ', ' + v.views + ' views a video' : '') + (v.cost ? ', $' + v.cost + ' a video' : '');
    if (op === 'setmine') return 'My channel is ' + clipT(v.ref, 80);
    if (op === 'studio_approve') return 'Approve the Studio package: ' + clipT(v.title, 70);
    return 'Run it';
  }

  function form(card, opts) {
    var spec = card.form;
    var box = el('form', 'ic-form');
    box.noValidate = true;
    var inputs = {};
    var image = { data: '' };
    var note = el('div', 'ic-status');
    note.setAttribute('aria-live', 'polite');
    (spec.fields || []).forEach(function (f) {
      var wrap = el('div', 'ic-field');
      if (f.kind === 'file') {
        wrap.appendChild(dropZone(image, function (state, why) {
          if (state === 'reading') status(note, 'Reading the image', '');
          else if (state === 'ok') status(note, '', '');
          else status(note, why || 'That image could not be read.', 'err');
        }));
        box.appendChild(wrap);
        return;
      }
      var id = 'f-' + Math.random().toString(36).slice(2, 9);
      var lab = el('label', 'ic-flabel', f.label);
      lab.htmlFor = id;
      wrap.appendChild(lab);
      var input;
      if (f.kind === 'area') {
        input = document.createElement('textarea');
        input.rows = Math.max(2, Math.min(10, Number(f.rows) || 3));
      } else {
        input = document.createElement('input');
        input.type = 'text';
        if (f.kind === 'number') input.inputMode = 'decimal';
      }
      input.id = id;
      input.className = 'ic-input';
      if (f.max) input.maxLength = Number(f.max);
      if (f.placeholder) input.placeholder = String(f.placeholder);
      if (f.value) input.value = String(f.value);
      inputs[f.id] = input;
      wrap.appendChild(input);
      box.appendChild(wrap);
    });
    var go = button(spec.submit || 'Send', ICON_UP);
    go.type = 'submit';
    go.classList.add('primary');
    var bar = el('div', 'ic-form-bar');
    bar.appendChild(go);
    box.appendChild(bar);
    box.appendChild(note);
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!opts.job) return;
      if (spec.op === 'studio_approve' && !e.isTrusted) return;
      var v = {};
      Object.keys(inputs).forEach(function (k) { v[k] = inputs[k].value.trim(); });
      var job = { op: spec.op };
      if (spec.op === 'policy') {
        if (!v.title && !v.description && !v.script) { status(note, 'Paste at least a title, a description or a script.', 'err'); return; }
        job.title = v.title || ''; job.description = v.description || ''; job.script = v.script || '';
      } else if (spec.op === 'thumb') {
        if (!image.data) { status(note, 'Drop or choose the thumbnail first.', 'err'); return; }
        job.image = image.data; job.title = v.title || '';
      } else if (spec.op === 'money') {
        var views = Number(String(v.views || '').replace(/[,\s]/g, ''));
        if (!v.niche) { status(note, 'Type the niche or topic.', 'err'); return; }
        if (!(views > 0)) { status(note, 'Type the views a video gets. An empty box is not a zero.', 'err'); return; }
        job.niche = v.niche; job.views = views;
        var cost = Number(String(v.cost || '').replace(/[$,\s]/g, ''));
        if (v.cost && cost >= 0) job.cost = cost;
      } else if (spec.op === 'setmine') {
        if (!v.ref) { status(note, 'Paste your @handle or channel link.', 'err'); return; }
        job.ref = v.ref;
        if (card.then) job.then = card.then;
      } else if (spec.op === 'studio_approve') {
        if (!v.title) { status(note, 'Type a title first.', 'err'); return; }
        job.title = v.title; job.description = v.description || ''; job.chapters = v.chapters || ''; job.tags = v.tags || '';
      }
      go.disabled = true;
      status(note, 'Sent.', 'ok');
      Promise.resolve(opts.job(job, jobLabel(spec.op, job.op === 'money' ? { niche: job.niche, views: job.views, cost: job.cost } : v))).then(function (ok) {
        go.disabled = false;
        if (!ok) status(note, 'The chat is busy. Wait for the answer and press it again.', 'err');
      });
    });
    return box;
  }

  function drawBar(card, row, opts) {
    var box = el('div', 'ic-draw');
    var note = el('div', 'ic-status');
    note.setAttribute('aria-live', 'polite');
    if (card.draw) {
      var tip = el('span', 'ic-cost', (card.draw.cost ? card.draw.cost + ' ' : '') + 'Nothing is drawn until you press Draw them, above the message box.');
      box.appendChild(tip);
    } else if (card.keyNeeded) {
      box.appendChild(el('span', 'ic-cost', card.keyNeeded));
      if (opts.setup) {
        var s = el('button', 'ic-btn', 'Open Setup');
        s.type = 'button';
        s.addEventListener('click', function (e) { if (e.isTrusted) opts.setup(); });
        box.appendChild(s);
      }
    }
    box.appendChild(note);
    return box.childNodes.length > 1 ? box : null;
  }

  var JOB_OPS = /^(?:brief_now|brief_on|brief_off|brief_state|watch_remove|predict_seal|predict_export|predict_daily|arb_measure|studio_pack|studio_edit|studio_fill)$/;

  function cardJobs(card, opts, rowId) {
    var list = (Array.isArray(card.actions) ? card.actions : []).filter(function (a) { return a && a.label && a.job && JOB_OPS.test(String(a.job.op || '')); }).slice(0, 7);
    if (!list.length || !opts.job) return null;
    var box = el('div', 'ic-jobs');
    var row = el('div', 'ic-jobs-row');
    var note = el('div', 'ic-status');
    note.setAttribute('aria-live', 'polite');
    list.forEach(function (a) {
      var b = el('button', 'ic-job' + (a.primary ? ' primary' : ''), a.label);
      b.type = 'button';
      b.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        b.disabled = true;
        status(note, '', '');
        var job = {};
        Object.keys(a.job).forEach(function (k) { job[k] = a.job[k]; });
        if (job.op === 'studio_pack' && rowId != null) job.rowId = String(rowId);
        Promise.resolve(opts.job(job, String(a.label))).then(function (ok) {
          b.disabled = false;
          if (!ok) status(note, 'The chat is busy. Wait for the answer and press it again.', 'err');
        });
      });
      row.appendChild(b);
    });
    box.appendChild(row);
    box.appendChild(note);
    return box;
  }

  var PERM_ORIGIN = /^https:\/\/[a-z0-9.-]+\/\*$/i;

  function permission(card, opts) {
    var p = card.permission;
    if (!p || !Array.isArray(p.origins) || !p.job || !opts.job) return null;
    var origins = p.origins.filter(function (o) { return PERM_ORIGIN.test(String(o)); }).slice(0, 8);
    if (!origins.length) return null;
    var hosts = origins.map(function (o) { return o.replace(/^https:\/\//, '').replace(/\/\*$/, ''); });
    var box = el('div', 'ic-perm');
    box.appendChild(el('div', 'ic-perm-title', hosts.length === 1 ? 'A page you have open is about this topic' : hosts.length + ' pages you have open are about this topic'));
    box.appendChild(el('div', 'ic-perm-text', hosts.join(', ') + '. ZERACK reads a site only after you allow it here, sends its text only to the AI provider you chose, and stops when you press Stop ZERACK on that site.'));
    var row = el('div', 'ic-perm-row');
    var b = button(hosts.length === 1 ? 'Allow it and write again' : 'Allow them and write again', ICON_UP);
    b.classList.add('primary');
    var note = el('div', 'ic-status');
    note.setAttribute('aria-live', 'polite');
    b.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      b.disabled = true;
      var rerun = function () {
        var job = {};
        Object.keys(p.job).forEach(function (k) { job[k] = p.job[k]; });
        job.op = 'script';
        Promise.resolve(opts.job(job, 'Write it again with the pages I allowed: ' + String(p.job.topic || '').slice(0, 80))).then(function (ok) {
          b.disabled = false;
          if (!ok) status(note, 'The chat is busy. Wait for the answer and press it again.', 'err');
        });
      };
      var consent = (Array.isArray(p.sites) ? p.sites : []).filter(function (x) { return x && origins.indexOf(String(x.pattern)) >= 0 && x.consent === 'none'; });
      try {
        chrome.permissions.request({ origins: origins }, function (granted) {
          if (chrome.runtime.lastError || !granted) { b.disabled = false; status(note, 'Not allowed, so those pages stay unread.', 'err'); return; }
          if (!consent.length || !opts.allow) { rerun(); return; }
          Promise.all(consent.map(function (x) { return opts.allow(String(x.host), String(x.pattern)); })).then(function (res) {
            if (res.some(function (r) { return !r || r.ok !== true; })) { b.disabled = false; status(note, 'ZERACK could not save the permission. Try again.', 'err'); return; }
            rerun();
          });
        });
      } catch (x) {
        b.disabled = false;
        status(note, 'Chrome did not show the prompt here. Open the chat from the toolbar button and press it again.', 'err');
      }
    });
    row.appendChild(b);
    box.appendChild(row);
    box.appendChild(note);
    return box;
  }

  function actions(card) {
    var foot = el('div', 'ic-actions');
    var note = el('div', 'ic-status');
    note.setAttribute('aria-live', 'polite');
    if (!SHARE || !card.share) return { box: foot, note: note };
    var spec = card.share;
    var blob = null;
    var image = function () {
      if (blob) return Promise.resolve(blob);
      return SHARE.render(spec).then(function (b) { blob = b; return b; });
    };
    var busy = function (b, on) { b.disabled = !!on; b.dataset.busy = on ? '1' : ''; };
    var save = button('Save PNG', ICON_SAVE);
    var copy = button('Copy image', ICON_COPY);
    var post = button('Share on X', ICON_X);
    post.classList.add('primary');
    save.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      busy(save, true);
      status(note, 'Drawing the card', '');
      image().then(function (b) { return SHARE.save(b, SHARE.fileName(spec)); }).then(function (ok) {
        status(note, ok ? 'Saved to your Downloads folder.' : 'The download did not start.', ok ? 'ok' : 'err');
      }, function () { status(note, 'The card could not be drawn.', 'err'); }).then(function () { busy(save, false); });
    });
    copy.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      busy(copy, true);
      var pending = image();
      SHARE.copy(pending).then(function (ok) {
        status(note, ok ? 'Image copied. Paste it anywhere.' : 'Copy was refused here. Use Save PNG instead.', ok ? 'ok' : 'err');
      }).then(function () { busy(copy, false); });
    });
    post.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      busy(post, true);
      SHARE.copy(image()).then(function (ok) {
        window.open(SHARE.postUrl(spec.post), '_blank', 'noopener');
        status(note, ok ? 'X is open with the text. The image is copied: paste it into the post, then press Post.' : 'X is open with the text. Save the PNG and attach it to the post, then press Post.', 'ok');
      }).then(function () { busy(post, false); });
    });
    var warm = function () { image().catch(function () {}); foot.removeEventListener('pointerenter', warm); foot.removeEventListener('focusin', warm); };
    foot.addEventListener('pointerenter', warm);
    foot.addEventListener('focusin', warm);
    foot.appendChild(save);
    foot.appendChild(copy);
    foot.appendChild(post);
    return { box: foot, note: note };
  }

  function chips(card, opts) {
    var box = el('div', 'ic-next');
    (card.next || []).slice(0, 4).forEach(function (c) {
      if (!c || !c.label || !c.text) return;
      var b = el('button', 'chip', c.label);
      b.type = 'button';
      b.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        if (c.fill && opts.fill) opts.fill(c.text);
        else if (opts.submit) opts.submit(c.text);
      });
      box.appendChild(b);
    });
    return box;
  }

  function render(row, opts) {
    opts = opts || {};
    var card = (row && row.meta && row.meta.card) || {};
    var wrap = el('div', 'msg intel');
    var box = el('article', 'icard');
    box.dataset.kind = String(card.kind || '');
    var head = el('header', 'ic-head');
    head.appendChild(el('span', 'ic-kind', card.label || 'CHANNEL'));
    var who = el('div', 'ic-who');
    var ch = card.channel || {};
    var nameHref = safeLink(ch.url);
    if (nameHref) {
      var a = el('a', 'ic-name', ch.name || '');
      a.href = nameHref;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      who.appendChild(a);
    } else {
      who.appendChild(el('div', 'ic-name', ch.name || ''));
    }
    if (ch.line) who.appendChild(el('div', 'ic-line', ch.line));
    head.appendChild(who);
    box.appendChild(head);
    var hero = card.hero || {};
    if (hero.value) {
      var h = el('div', 'ic-hero');
      h.dataset.tone = tone(hero.tone);
      if (hero.word) h.dataset.word = '1';
      h.appendChild(el('div', 'ic-hero-value', hero.value));
      if (hero.label) h.appendChild(el('div', 'ic-hero-label', hero.label));
      box.appendChild(h);
    }
    if (row && row.text) box.appendChild(el('p', 'ic-lead', row.text));
    if (card.notice) box.appendChild(el('p', 'ic-notice', card.notice));
    if (card.form) box.appendChild(form(card, opts));
    (card.sections || []).forEach(function (s) { box.appendChild(section(s)); });
    var draw = drawBar(card, row, opts);
    if (draw) box.appendChild(draw);
    var perm = permission(card, opts);
    if (perm) box.appendChild(perm);
    var jobs = cardJobs(card, opts, row && row.id);
    if (jobs) box.appendChild(jobs);
    var act = actions(card);
    if (card.source || card.share) {
      var foot = el('footer', 'ic-foot');
      if (card.source) foot.appendChild(el('div', 'ic-source', card.source));
      if (card.share) { foot.appendChild(act.box); foot.appendChild(act.note); }
      box.appendChild(foot);
    }
    wrap.appendChild(box);
    var next = chips(card, opts);
    if (next.childNodes.length) wrap.appendChild(next);
    return wrap;
  }

  root.NSP_CHAT_INTEL = Object.freeze({ render: render });
})(typeof self !== 'undefined' ? self : this);
