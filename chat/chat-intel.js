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

  function row(r) {
    var box = el('div', 'ic-row');
    box.dataset.tone = tone(r.tone);
    if (r.busy) box.dataset.busy = '1';
    var href = safeLink(r.link);
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

  function section(s) {
    var box = el('section', 'ic-sec');
    if (s.state) box.dataset.state = String(s.state);
    box.appendChild(el('div', 'ic-sec-title', s.title));
    var rows = el('div', 'ic-rows');
    (s.rows || []).forEach(function (r) { if (r && (r.label || r.value)) rows.appendChild(row(r)); });
    box.appendChild(rows);
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
    (card.sections || []).forEach(function (s) { box.appendChild(section(s)); });
    var foot = el('footer', 'ic-foot');
    if (card.source) foot.appendChild(el('div', 'ic-source', card.source));
    var act = actions(card);
    foot.appendChild(act.box);
    foot.appendChild(act.note);
    box.appendChild(foot);
    wrap.appendChild(box);
    var next = chips(card, opts);
    if (next.childNodes.length) wrap.appendChild(next);
    return wrap;
  }

  root.NSP_CHAT_INTEL = Object.freeze({ render: render });
})(typeof self !== 'undefined' ? self : this);
