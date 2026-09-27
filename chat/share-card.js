(function (root) {
  'use strict';

  var W = 1080;
  var H = 1350;
  var PAD = 72;
  var FONT = '"Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  var RED = '#ff2d2d';
  var WHITE = '#ffffff';
  var MUTED = 'rgba(255,255,255,0.58)';
  var FAINT = 'rgba(255,255,255,0.36)';
  var LINE = 'rgba(255,255,255,0.12)';
  var REPO = 'https://github.com/itzjk/cashcow-radar-agent';
  var REPO_SHORT = 'github.com/itzjk/cashcow-radar-agent';
  var ELLIPSIS = '\u2026';
  var markPromise = null;

  function font(weight, size) {
    return weight + ' ' + size + 'px ' + FONT;
  }

  function mark() {
    if (markPromise) return markPromise;
    markPromise = new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = (root.chrome && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('icons/zerack-mark.svg') : '../icons/zerack-mark.svg';
    });
    return markPromise;
  }

  function spacing(g, em) {
    try { g.letterSpacing = em; } catch (e) {}
  }

  function fit(g, text, max) {
    text = String(text == null ? '' : text);
    if (g.measureText(text).width <= max) return text;
    var lo = 0, hi = text.length;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (g.measureText(text.slice(0, mid).replace(/\s+$/, '') + ELLIPSIS).width <= max) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo).replace(/\s+$/, '') + ELLIPSIS;
  }

  function wrap(g, text, max, lines) {
    var words = String(text == null ? '' : text).replace(/\s+/g, ' ').trim().split(' ');
    var out = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var next = cur ? cur + ' ' + words[i] : words[i];
      if (g.measureText(next).width <= max || !cur) { cur = next; continue; }
      out.push(cur);
      cur = words[i];
      if (out.length === lines) break;
    }
    if (out.length < lines && cur) out.push(cur);
    var used = out.join(' ').split(' ').length;
    if (used < words.length || g.measureText(out[out.length - 1] || '').width > max) {
      out[out.length - 1] = fit(g, out[out.length - 1] + (used < words.length ? ' ' + words.slice(used).join(' ') : ''), max);
    }
    return out;
  }

  function sizeFor(g, text, weight, from, to, max) {
    for (var s = from; s >= to; s -= 4) {
      g.font = font(weight, s);
      if (g.measureText(text).width <= max) return s;
    }
    return to;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  function backdrop(g) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    var glow = g.createRadialGradient(W - 140, 120, 0, W - 140, 120, 760);
    glow.addColorStop(0, 'rgba(255,45,45,0.16)');
    glow.addColorStop(0.45, 'rgba(255,45,45,0.04)');
    glow.addColorStop(1, 'rgba(255,45,45,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 1;
    g.beginPath();
    for (var x = 0; x <= W; x += 60) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
    for (var y = 0; y <= H; y += 60) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    var fade = g.createLinearGradient(0, H - 420, 0, H);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = fade;
    g.fillRect(0, H - 420, W, 420);
  }

  function header(g, spec, img) {
    if (img) g.drawImage(img, PAD, 58, 76, 76);
    g.fillStyle = WHITE;
    g.textBaseline = 'middle';
    g.font = font(800, 30);
    spacing(g, '9px');
    g.fillText('ZERACK', PAD + (img ? 96 : 0), 97);
    spacing(g, '0px');
    var kind = String(spec.kind || '').toUpperCase();
    if (!kind) return;
    g.font = font(800, 24);
    spacing(g, '4px');
    var tw = g.measureText(kind).width;
    var pw = tw + 44, ph = 50, px = W - PAD - pw, py = 72;
    roundRect(g, px, py, pw, ph, 25);
    g.fillStyle = 'rgba(255,45,45,0.12)';
    g.fill();
    g.strokeStyle = 'rgba(255,45,45,0.75)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = RED;
    g.fillText(kind, px + 22 + 2, py + ph / 2 + 1);
    spacing(g, '0px');
  }

  var ROW_H = 80;
  var FOOT_TOP = H - 176;

  function isWord(v) {
    return !/^[\d.,:\s]+[xKMB%]?$/.test(String(v));
  }

  function plan(g, spec, heroMax) {
    var max = W - PAD * 2;
    var p = { title: [], hero: 0, heroLabel: [], quote: [], rows: [] };
    g.font = font(800, 68);
    p.title = wrap(g, spec.title, max, 2);
    var y = 212 + p.title.length * 72 + (spec.subtitle ? 50 : 0);
    var hero = spec.hero || {};
    if (hero.value) {
      p.hero = sizeFor(g, String(hero.value), 900, Math.min(heroMax, isWord(hero.value) ? 150 : heroMax), 72, max);
      y += Math.round(p.hero * 0.95) + 44 + 34;
      if (hero.label) {
        g.font = font(500, 34);
        p.heroLabel = wrap(g, hero.label, max, 2);
        y += 58 + (p.heroLabel.length - 1) * 44;
      }
    }
    p.rows = (spec.rows || []).filter(function (r) { return r && r.label && (r.value || r.pair); }).slice(0, 4);
    var rowsH = 40 + p.rows.length * ROW_H;
    if (spec.quote && spec.quote.text) {
      g.font = font(600, 40);
      var q = wrap(g, '\u201c' + spec.quote.text + '\u201d', max - 40, 3);
      var room = FOOT_TOP - y - rowsH - 62 - 14;
      var fitLines = Math.floor(room / 52);
      if (fitLines < q.length) q = fitLines >= 1 ? wrap(g, '\u201c' + spec.quote.text + '\u201d', max - 40, fitLines) : [];
      p.quote = q;
      if (q.length) y += 62 + q.length * 52;
    }
    p.fits = y + rowsH <= FOOT_TOP;
    return p;
  }

  function pairValue(g, pair, right, maxW, mid) {
    var parts = [
      { t: String(pair.a), c: pair.win === 'a' ? WHITE : MUTED, w: pair.win === 'a' ? 800 : 600 },
      { t: '  vs  ', c: FAINT, w: 500 },
      { t: String(pair.b), c: pair.win === 'b' ? WHITE : MUTED, w: pair.win === 'b' ? 800 : 600 }
    ];
    var size = 34, total = 0;
    for (; size >= 24; size -= 2) {
      total = 0;
      parts.forEach(function (p) { g.font = font(p.w, size); p.width = g.measureText(p.t).width; total += p.width; });
      if (total <= maxW) break;
    }
    var x = right - total;
    g.textAlign = 'left';
    parts.forEach(function (p) { g.font = font(p.w, size); g.fillStyle = p.c; g.fillText(p.t, x, mid); x += p.width; });
  }

  function body(g, spec) {
    var max = W - PAD * 2;
    var p = null;
    for (var hs = 230; hs >= 110; hs -= 10) { p = plan(g, spec, hs); if (p.fits) break; }
    var y = 212;
    g.textBaseline = 'alphabetic';
    g.fillStyle = WHITE;
    g.font = font(800, 68);
    p.title.forEach(function (t) { y += 72; g.fillText(t, PAD, y); });
    if (spec.subtitle) {
      y += 50;
      g.fillStyle = MUTED;
      g.font = font(500, 30);
      g.fillText(fit(g, spec.subtitle, max), PAD, y);
    }
    var hero = spec.hero || {};
    if (hero.value) {
      y += Math.round(p.hero * 0.95) + 44;
      g.font = font(900, p.hero);
      g.fillStyle = hero.tone === 'bad' ? RED : WHITE;
      g.fillText(fit(g, hero.value, max), PAD - 4, y);
      y += 34;
      g.fillStyle = RED;
      g.fillRect(PAD, y, 112, 8);
      if (p.heroLabel.length) {
        y += 58;
        g.fillStyle = MUTED;
        g.font = font(500, 34);
        p.heroLabel.forEach(function (t, i) { if (i) y += 44; g.fillText(t, PAD, y); });
      }
    }
    if (p.quote.length) {
      y += 62;
      g.fillStyle = FAINT;
      g.font = font(700, 22);
      spacing(g, '3px');
      g.fillText(String(spec.quote.label || '').toUpperCase(), PAD + 36, y);
      spacing(g, '0px');
      var qTop = y - 26;
      g.fillStyle = WHITE;
      g.font = font(600, 40);
      p.quote.forEach(function (t) { y += 52; g.fillText(t, PAD + 36, y); });
      g.fillStyle = RED;
      g.fillRect(PAD, qTop, 6, y - qTop + 14);
    }
    y += 40;
    var room = Math.max(0, Math.floor((FOOT_TOP - y) / ROW_H));
    p.rows.slice(0, room).forEach(function (r) {
      g.strokeStyle = LINE;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(PAD, y + 1);
      g.lineTo(W - PAD, y + 1);
      g.stroke();
      var mid = y + 52;
      g.font = font(500, 28);
      g.fillStyle = MUTED;
      var label = fit(g, r.label, max * 0.46);
      g.fillText(label, PAD, mid);
      var lw = g.measureText(label).width;
      if (r.pair) {
        pairValue(g, r.pair, W - PAD, max - lw - 36, mid);
      } else {
        g.textAlign = 'right';
        var vs = sizeFor(g, String(r.value), 700, 34, 24, max - lw - 36);
        g.font = font(700, vs);
        g.fillStyle = WHITE;
        g.fillText(fit(g, r.value, max - lw - 36), W - PAD, mid);
        g.textAlign = 'left';
      }
      y += ROW_H;
    });
  }

  function footer(g, spec, img) {
    var y = H - 150;
    g.strokeStyle = LINE;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(PAD, y);
    g.lineTo(W - PAD, y);
    g.stroke();
    g.textBaseline = 'middle';
    var foot = String(spec.foot || '').split(' \u00b7 ');
    g.font = font(500, 24);
    g.fillStyle = MUTED;
    g.fillText(fit(g, foot[0] || '', 500), PAD, y + 52);
    if (foot.length > 1) {
      g.font = font(500, 22);
      g.fillStyle = FAINT;
      g.fillText(fit(g, foot.slice(1).join(' \u00b7 '), 500), PAD, y + 90);
    }
    g.textAlign = 'right';
    g.font = font(700, 26);
    g.fillStyle = WHITE;
    var brand = 'ZERACK, open source';
    g.fillText(brand, W - PAD, y + 52);
    var bw = g.measureText(brand).width;
    if (img) g.drawImage(img, W - PAD - bw - 50, y + 32, 40, 40);
    g.font = font(500, 22);
    g.fillStyle = FAINT;
    g.fillText(REPO_SHORT, W - PAD, y + 90);
    g.textAlign = 'left';
  }

  function canvas() {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H);
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  }

  function toBlob(c) {
    if (c.convertToBlob) return c.convertToBlob({ type: 'image/png' });
    return new Promise(function (resolve, reject) { c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('no image')); }, 'image/png'); });
  }

  function render(spec) {
    spec = spec || {};
    return mark().then(function (img) {
      var c = canvas();
      var g = c.getContext('2d');
      backdrop(g);
      header(g, spec, img);
      body(g, spec);
      footer(g, spec, img);
      return toBlob(c);
    });
  }

  function slug(s) {
    return String(s || 'channel').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'channel';
  }

  function fileName(spec) {
    return 'zerack-' + slug(spec.kind) + '-' + slug(spec.title) + '.png';
  }

  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var done = function () { setTimeout(function () { URL.revokeObjectURL(url); }, 60000); };
    if (root.chrome && chrome.downloads && chrome.downloads.download) {
      return new Promise(function (resolve) {
        chrome.downloads.download({ url: url, filename: name, saveAs: false }, function (id) {
          var err = chrome.runtime.lastError;
          done();
          resolve(!err && !!id);
        });
      });
    }
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    done();
    return Promise.resolve(true);
  }

  function copy(blob) {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return Promise.resolve(false);
    try {
      return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () { return true; }, function (e) { console.warn('[ZERACK chat] the image was not copied:', e && e.message); return false; });
    } catch (e) { console.warn('[ZERACK chat] the image was not copied:', e && e.message); return Promise.resolve(false); }
  }

  function postUrl(text) {
    return 'https://x.com/intent/post?text=' + encodeURIComponent(String(text || '').slice(0, 230)) + '&url=' + encodeURIComponent(REPO);
  }

  root.NSP_SHARE_CARD = Object.freeze({ W: W, H: H, REPO: REPO, render: render, fileName: fileName, save: save, copy: copy, postUrl: postUrl });
})(typeof self !== 'undefined' ? self : this);
