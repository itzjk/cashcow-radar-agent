(function(root) {
  var owns = Object.prototype.hasOwnProperty;
  if (owns.call(root, 'NSP_HANDS')) return;
  var G = owns.call(root, 'NSP_GATE') ? root.NSP_GATE : null;
  if (!G || typeof G.check !== 'function') return;

  var CANDIDATES = 'a[href],button,input:not([type="hidden"]),textarea,select,summary,label,[role],[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],[aria-label],[title],[placeholder],[tabindex="0"]';
  var EDITABLE = 'input:not([type="hidden"]),textarea,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]';
  var CLICKABLE = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"],[role="checkbox"],[role="switch"],[role="radio"]';
  var ROLE_WORDS = {
    button: 'button', btn: 'button', boton: 'button',
    link: 'link', enlace: 'link',
    tab: 'tab', chip: 'tab', pestana: 'tab',
    field: 'textbox', box: 'textbox', input: 'textbox', textbox: 'textbox', textarea: 'textbox', searchbox: 'textbox', campo: 'textbox', caja: 'textbox',
    checkbox: 'checkbox', toggle: 'switch', 'switch': 'switch',
    dropdown: 'combobox', combobox: 'combobox',
    option: 'option', opcion: 'option',
    heading: 'heading'
  };
  var ROLE_GROUPS = {
    button: ['button', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'switch', 'tab', 'option', 'link', 'checkbox'],
    link: ['link', 'button', 'menuitem', 'tab'],
    tab: ['tab', 'button', 'option', 'link', 'menuitem'],
    textbox: ['textbox', 'searchbox', 'combobox'],
    checkbox: ['checkbox', 'switch', 'menuitemcheckbox', 'button'],
    'switch': ['switch', 'checkbox', 'button'],
    combobox: ['combobox', 'listbox', 'button'],
    option: ['option', 'menuitem', 'menuitemradio', 'menuitemcheckbox', 'tab', 'radio', 'link', 'button'],
    heading: ['heading']
  };
  var STOPWORDS = {
    the: 1, a: 1, an: 1, 'this': 1, that: 1, on: 1, 'in': 1, of: 1, to: 1, 'for': 1, 'with': 1, at: 1, by: 1, from: 1, into: 1,
    my: 1, your: 1, its: 1, it: 1, is: 1, and: 1, or: 1, page: 1, screen: 1, element: 1, item: 1, called: 1, named: 1,
    labeled: 1, labelled: 1, says: 1, saying: 1, titled: 1, which: 1,
    el: 1, la: 1, los: 1, las: 1, un: 1, una: 1, de: 1, del: 1, en: 1, que: 1, con: 1, para: 1, por: 1
  };
  var ORDINALS = {
    first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5, last: -1,
    primer: 1, primero: 1, primera: 1, segundo: 2, segunda: 2, tercer: 3, tercero: 3, tercera: 3, ultimo: -1, ultima: -1
  };
  var HOLD_MS = 130000;
  var SNAPSHOT_ROLES = { button: 1, link: 1, tab: 1, textbox: 1, searchbox: 1, combobox: 1, checkbox: 1, 'switch': 1, menuitem: 1, menuitemcheckbox: 1, menuitemradio: 1, option: 1, radio: 1, heading: 1, listbox: 1, slider: 1 };

  var WEB = {
    id: 'web',
    candidates: '',
    tagRoles: {},
    dialog: '[role="dialog"],[role="alertdialog"],dialog',
    main: 'main,[role="main"]',
    nav: '',
    openDialogs: '[role="dialog"],[role="alertdialog"],dialog[open]',
    sendBoxes: '',
    hostAlias: {}
  };
  var PROFILES = {
    youtube: {
      id: 'youtube',
      hosts: /(^|\.)youtube\.com$/,
      candidates: 'tp-yt-paper-item,tp-yt-paper-tab,yt-tab-shape,yt-chip-cloud-chip-renderer,ytd-menu-service-item-renderer,ytd-compact-link-renderer',
      tagRoles: { 'tp-yt-paper-item': 'menuitem', 'ytd-menu-service-item-renderer': 'menuitem', 'ytd-compact-link-renderer': 'menuitem', 'yt-chip-cloud-chip-renderer': 'tab', 'tp-yt-paper-tab': 'tab', 'yt-tab-shape': 'tab' },
      dialog: '[role="dialog"],[role="alertdialog"],tp-yt-paper-dialog,dialog,ytd-popup-container,tp-yt-iron-dropdown',
      main: 'ytd-page-manager,main,[role="main"]',
      nav: '#guide,ytd-guide-renderer,ytd-mini-guide-renderer,tp-yt-app-drawer',
      openDialogs: '[role="dialog"],[role="alertdialog"],tp-yt-paper-dialog,dialog[open]',
      sendBoxes: 'ytd-commentbox, ytd-comment-simplebox-renderer, ytd-comment-reply-dialog-renderer, ytd-backstage-post-dialog-renderer, yt-live-chat-message-input-renderer',
      hostAlias: { 'youtube.com': 'www.youtube.com' }
    }
  };

  var norm = G.norm;

  function profileFor(host) {
    host = String(host || '').toLowerCase();
    for (var k in PROFILES) {
      if (PROFILES.hasOwnProperty(k) && PROFILES[k].hosts.test(host)) return PROFILES[k];
    }
    return WEB;
  }

  function words(s) {
    return ' ' + norm(s).replace(/[^a-z0-9#@\u00df-\u1fff\u2070-\uffff]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 3) + '...' : s;
  }

  function flag(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function create(hooks) {
    hooks = hooks || {};
    var P = (hooks.profile && PROFILES[hooks.profile]) || profileFor(window.location.hostname);
    var RULES = typeof G.compileRules === 'function' && hooks.rules ? G.compileRules(hooks.rules) : null;
    var CANDIDATES_HERE = CANDIDATES + (P.candidates ? ',' + P.candidates : '');
    var own = { misses: 0 };
    var held = null;

    function stopped() {
      return typeof hooks.stopped === 'function' && !!hooks.stopped();
    }

    function excluded() {
      return typeof hooks.exclude === 'function' ? hooks.exclude() : null;
    }

    function bumpMiss() {
      if (typeof hooks.onMiss === 'function') return Number(hooks.onMiss()) || 0;
      return ++own.misses;
    }

    function inExcluded(el) {
      var coach = excluded();
      if (!coach || !el) return false;
      try {
        var node = el;
        while (node) {
          if (node === coach) return true;
          node = node.parentNode || (node.host || null);
        }
      } catch (e) {}
      return false;
    }

    function collect(sel, limit) {
      var out = [];
      var coach = excluded();
      var roots = [document];
      var visited = 0;
      while (roots.length && out.length < limit && visited < 80) {
        var rt = roots.shift();
        visited++;
        var found;
        try { found = rt.querySelectorAll(sel); } catch (e) { return { list: [], error: 'the selector ' + sel + ' is not valid CSS' }; }
        for (var i = 0; i < found.length && out.length < limit; i++) {
          if (coach && (found[i] === coach || coach.contains(found[i]))) continue;
          out.push(found[i]);
        }
        var all = rt.querySelectorAll('*');
        for (var j = 0; j < all.length; j++) {
          if (all[j].shadowRoot && all[j] !== coach) roots.push(all[j].shadowRoot);
        }
      }
      return { list: out };
    }

    function visible(el) {
      try {
        if (!el || !el.isConnected) return false;
        if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
        var r = el.getBoundingClientRect();
        return r.width >= 2 && r.height >= 2;
      } catch (e) { return false; }
    }

    function inView(el) {
      try {
        var r = el.getBoundingClientRect();
        return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
      } catch (e) { return false; }
    }

    function editable(el) {
      if (!el || !el.tagName) return false;
      var tag = String(el.tagName).toLowerCase();
      if (tag === 'textarea') return !el.disabled && !el.readOnly;
      if (tag === 'input') {
        var t = String(el.type || 'text').toLowerCase();
        return /^(text|search|url|email|tel|number)$/.test(t) && !el.disabled && !el.readOnly;
      }
      return !!el.isContentEditable;
    }

    function isPassword(el) {
      return !!(el && String(el.type || '').toLowerCase() === 'password');
    }

    function roleOf(el) {
      var explicit = String((el.getAttribute && el.getAttribute('role')) || '').toLowerCase().split(/\s+/)[0];
      if (explicit && explicit !== 'presentation' && explicit !== 'none') return explicit;
      var tag = String(el.tagName || '').toLowerCase();
      if (tag === 'a') return el.hasAttribute('href') ? 'link' : 'generic';
      if (tag === 'button' || tag === 'summary') return 'button';
      if (tag === 'select') return 'combobox';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'input') {
        var t = String(el.type || 'text').toLowerCase();
        if (t === 'checkbox' || t === 'radio') return t;
        if (t === 'button' || t === 'submit' || t === 'reset' || t === 'image') return 'button';
        if (t === 'search') return 'searchbox';
        if (t === 'range') return 'slider';
        return 'textbox';
      }
      if (el.isContentEditable) return 'textbox';
      if (/^h[1-6]$/.test(tag)) return 'heading';
      if (P.tagRoles.hasOwnProperty(tag)) return P.tagRoles[tag];
      if (tag === 'option') return 'option';
      if (tag === 'label') return 'label';
      if (el.getAttribute && el.getAttribute('tabindex') === '0') return 'button';
      return tag;
    }

    function roleFits(role, hint) {
      return (ROLE_GROUPS[hint] || [hint]).indexOf(role) !== -1;
    }

    function labelText(el) {
      var out = [];
      try {
        var ids = String(el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
        var rt = el.getRootNode ? el.getRootNode() : document;
        ids.forEach(function(id) {
          var n = (rt && rt.getElementById) ? rt.getElementById(id) : document.getElementById(id);
          if (n) out.push(n.textContent || '');
        });
        if (el.labels) Array.prototype.forEach.call(el.labels, function(l) { out.push(l.textContent || ''); });
      } catch (e) {}
      return out.join(' ').replace(/\s+/g, ' ').trim();
    }

    function info(el) {
      function attr(n) { try { return String(el.getAttribute(n) || ''); } catch (e) { return ''; } }
      var tag = String(el.tagName || '').toLowerCase();
      var edit = editable(el) || isPassword(el);
      var aria = attr('aria-label');
      var labelled = labelText(el);
      var ph = attr('placeholder') || attr('aria-placeholder');
      var title = attr('title');
      var alt = attr('alt');
      var val = (tag === 'input' && /^(button|submit|reset)$/i.test(el.type || '')) ? String(el.value || '') : '';
      var text = '';
      if (!edit && tag !== 'select' && el.childElementCount <= 40) text = String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      var name = labelled || aria || (edit ? ph : '') || text || title || alt || val || ph || '';
      name = name.replace(/\s+/g, ' ').trim().slice(0, 200);
      var all = [name, aria, labelled, ph, title, alt, val, text, attr('name'), el.id || ''].join(' ');
      return {
        el: el,
        tag: tag,
        role: roleOf(el),
        name: name,
        nameN: norm(name),
        nameW: words(name),
        allW: words(all),
        labelText: labelled,
        editable: edit,
        native: /^(a|button|input|textarea|select|summary)$/.test(tag) || !!el.isContentEditable
      };
    }

    function describe(inf) {
      return inf.role + ' "' + clip(inf.name, 70) + '"';
    }

    function parseTarget(desc, relaxed) {
      var raw = String(desc || '').slice(0, 300);
      var phrases = [];
      var rest = raw.replace(/["\u201c\u201d\u00ab\u00bb]([^"\u201c\u201d\u00ab\u00bb]{1,160})["\u201c\u201d\u00ab\u00bb]/g, function(m, p) { phrases.push(p); return ' '; });
      rest = rest.replace(/(^|[\s(])[\u2018']([^'\u2018\u2019]{1,160})[\u2019'](?=$|[\s),.;:!?])/g, function(m, pre, p) { phrases.push(p); return pre + ' '; });
      var role = '';
      var ordinal = 0;
      var ws = [];
      words(rest).trim().split(' ').forEach(function(w) {
        if (!w) return;
        if (ROLE_WORDS[w]) { if (!role) role = ROLE_WORDS[w]; return; }
        if (ORDINALS[w]) { ordinal = ORDINALS[w]; return; }
        if (STOPWORDS[w]) return;
        ws.push(w);
      });
      var phraseW = phrases.length ? words(phrases[0]).trim() : ws.join(' ');
      return {
        phraseW: phraseW,
        quoted: phrases.length > 0,
        tokens: phrases.length ? phraseW.split(' ').filter(Boolean) : ws.slice(),
        extra: phrases.length ? ws.slice() : [],
        role: relaxed ? '' : role,
        roleHint: role,
        ordinal: ordinal,
        relaxed: !!relaxed
      };
    }

    function score(inf, q) {
      var name = inf.nameW;
      var all = inf.allW;
      var p = q.phraseW;
      var s = 0;
      var hit = false;
      if (p) {
        var pw = ' ' + p + ' ';
        if (name === pw) { s += 100; hit = true; }
        else if (name.indexOf(pw) === 0) { s += 75; hit = true; }
        else if (name.indexOf(pw) !== -1) { s += 60; hit = true; }
        else if (name.indexOf(' ' + p) !== -1) { s += 50; hit = true; }
        else if (all.indexOf(' ' + p) !== -1) { s += 40; hit = true; }
      }
      if (!q.quoted && !hit && q.tokens.length) {
        var nameWords = name.trim().split(' ').filter(function(w) { return w && !STOPWORDS[w]; });
        if (nameWords.length && nameWords.length <= 6 && nameWords.every(function(w) { return q.tokens.indexOf(w) !== -1; })) { s += 70; hit = true; }
      }
      if (q.tokens.length) {
        var n = 0;
        q.tokens.forEach(function(t) { if (all.indexOf(' ' + t) !== -1) n++; });
        if (n) hit = true;
        s += Math.round(40 * n / q.tokens.length);
      }
      if (!hit) return 0;
      if (q.extra.length) {
        var e = 0;
        q.extra.forEach(function(t) { if (all.indexOf(' ' + t) !== -1) e++; });
        s += Math.min(9, e * 3);
      }
      if (q.role) s += roleFits(inf.role, q.role) ? 20 : -15;
      if (inf.native) s += 4;
      if (p && name.length > p.length * 3 + 60) s -= 8;
      return s;
    }

    function kindOk(el, kind) {
      if (kind === 'edit') return editable(el) || isPassword(el);
      if (kind === 'option') return /^(option|menuitem|menuitemradio|menuitemcheckbox|tab|radio|listitem|link|button)$/.test(roleOf(el));
      return true;
    }

    function rank(list, q, kind, visibleKnown) {
      var min = q.relaxed ? 40 : 55;
      var roleOnly = !q.phraseW && !q.tokens.length;
      var scored = [];
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (!kindOk(el, kind)) continue;
        var inf = info(el);
        var s;
        if (roleOnly) {
          if (q.roleHint && !roleFits(inf.role, q.roleHint)) continue;
          s = 60 + (inf.native ? 4 : 0);
        } else {
          s = score(inf, q);
          if (s <= 0) continue;
        }
        scored.push({ info: inf, s: s, i: i });
      }
      scored.sort(function(a, b) { return b.s - a.s || a.i - b.i; });
      var vis = [];
      for (var k = 0; k < scored.length && vis.length < 40; k++) {
        if (visibleKnown || visible(scored[k].info.el)) {
          scored[k].view = inView(scored[k].info.el);
          vis.push(scored[k]);
        }
      }
      var nearest = [];
      vis.forEach(function(c) {
        var row = describe(c.info);
        if (c.info.name && nearest.indexOf(row) === -1 && nearest.length < 6) nearest.push(row);
      });
      var top = vis.filter(function(c) { return c.s >= min; });
      if (!top.length) return { el: null, code: 'not_found', nearest: nearest };
      var bestScore = top[0].s;
      var group = top.filter(function(c) { return c.s >= bestScore - (q.ordinal ? 10 : 0); });
      group = group.filter(function(c) {
        return !group.some(function(d) { return d !== c && c.info.el.contains(d.info.el); });
      });
      var best = group[0];
      if (q.ordinal) {
        group.sort(function(a, b) { return a.i - b.i; });
        best = q.ordinal === -1 ? group[group.length - 1] : group[q.ordinal - 1];
        if (!best) return { el: null, code: 'ordinal', message: 'asked for number ' + q.ordinal + ' but only ' + group.length + ' matched', nearest: nearest };
      } else {
        if (roleOnly && group.length > 1) return { el: null, code: 'vague', message: group.length + ' elements fit that description, name it by its visible words', nearest: nearest };
        var onScreen = group.filter(function(c) { return c.view; });
        if (onScreen.length) best = onScreen[0];
      }
      var also = 0;
      top.forEach(function(c) {
        if (c !== best && c.s >= best.s - 5 && !c.info.el.contains(best.info.el) && !best.info.el.contains(c.info.el)) also++;
      });
      return { el: best.info.el, info: best.info, score: best.s, alsoMatched: also, loose: q.relaxed };
    }

    function resolve(desc, sel, kind, relaxed) {
      var q = parseTarget(desc, relaxed);
      var hasWords = !!(q.phraseW || q.tokens.length || q.roleHint || q.ordinal);
      if (sel) {
        var c = collect(sel, 400);
        if (c.error) return { el: null, code: 'bad_selector', message: c.error, nearest: [] };
        var vis = c.list.filter(visible);
        if (vis.length && !hasWords) {
          var fit = vis.filter(function(e) { return kindOk(e, kind); });
          var first = fit[0] || vis[0];
          return { el: first, info: info(first), score: 100, bySelector: true, alsoMatched: vis.length - 1 };
        }
        if (vis.length) {
          var r0 = rank(vis, q, kind === 'edit' ? 'any' : kind, true);
          if (r0.el) { r0.bySelector = true; return r0; }
        }
        if (!hasWords) return { el: null, code: 'not_found', message: 'nothing visible matches the selector ' + sel, nearest: [] };
      }
      if (!hasWords) return { el: null, code: 'no_target', message: 'no target was given', nearest: [] };
      var pool = collect(CANDIDATES_HERE + (kind === 'read' ? ',h1,h2,h3,h4' : ''), 8000).list;
      var r = rank(pool, q, kind, false);
      if (!r.el && (kind === 'edit' || kind === 'option')) {
        var r2 = rank(pool, q, 'any', false);
        if (r2.el) { r2.opener = true; return r2; }
        if (!r.nearest.length) r.nearest = r2.nearest;
      }
      return r;
    }

    function find(a, kind) {
      var desc = String(a.target || '');
      var sel = String(a.selector || '').slice(0, 500);
      var start = Date.now();
      return new Promise(function(done) {
        (function attempt() {
          if (stopped()) { done({ el: null, code: 'stopped', nearest: [] }); return; }
          var r = resolve(desc, sel, kind, false);
          if (r.el || r.code === 'no_target' || r.code === 'bad_selector' || r.code === 'vague' || r.code === 'ordinal') { done(r); return; }
          if (Date.now() - start < 2500) { setTimeout(attempt, 350); return; }
          var loose = resolve(desc, sel, kind, true);
          if (loose.el) { loose.loose = true; done(loose); return; }
          if (!loose.nearest || !loose.nearest.length) loose.nearest = r.nearest || [];
          if (!loose.message) loose.message = r.message;
          done(loose);
        })();
      });
    }

    function region(el) {
      try {
        if (P.dialog && el.closest(P.dialog)) return 0;
        if (P.main && el.closest(P.main)) return 1;
        if (P.nav && el.closest(P.nav)) return 3;
      } catch (e) {}
      return 2;
    }

    function snapshot(max) {
      max = max || 45;
      var list = collect(CANDIDATES_HERE + ',h1,h2,h3', 8000).list;
      var seen = {};
      var rows = [];
      for (var i = 0; i < list.length && rows.length < 400; i++) {
        var el = list[i];
        if (!SNAPSHOT_ROLES[roleOf(el)]) continue;
        var inf = info(el);
        if (!inf.name) continue;
        var key = inf.role + '|' + inf.nameN.slice(0, 60);
        if (seen[key] || !visible(el)) continue;
        seen[key] = 1;
        rows.push({ text: inf.role + ' "' + clip(inf.name, 70) + '"', view: inView(el), region: region(el), i: i });
      }
      rows.sort(function(a, b) { return a.region - b.region || a.i - b.i; });
      var onScreen = rows.filter(function(r) { return r.view; }).slice(0, max);
      var offScreen = rows.filter(function(r) { return !r.view; }).slice(0, Math.max(0, max - onScreen.length));
      var out = {
        url: window.location.href,
        title: clip(document.title, 120),
        onScreen: onScreen.map(function(r) { return r.text; }),
        offScreen: offScreen.map(function(r) { return r.text; })
      };
      var active = deepActive();
      if (active && active !== document.body && !inExcluded(active)) out.focused = describe(info(active));
      var dialogs = collect(P.openDialogs, 20).list.filter(visible);
      if (dialogs.length) out.openDialog = clip(info(dialogs[0]).name || 'a dialog', 90);
      return out;
    }

    function deepActive() {
      var a = document.activeElement;
      try { while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; } catch (e) {}
      return a;
    }

    function firstEditable(rt) {
      if (!rt || !rt.querySelectorAll) return null;
      var list = rt.querySelectorAll(EDITABLE);
      for (var i = 0; i < list.length; i++) {
        if ((editable(list[i]) || isPassword(list[i])) && visible(list[i]) && !inExcluded(list[i])) return list[i];
      }
      return null;
    }

    function clickable(el) {
      try {
        if (el.matches && el.matches(CLICKABLE)) return el;
        var up = el.closest && el.closest(CLICKABLE);
        if (up && up !== document.body && up !== document.documentElement) return up;
        var down = el.querySelector && el.querySelector(CLICKABLE);
        if (down && visible(down)) return down;
      } catch (e) {}
      return el;
    }

    function fire(el) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
      var r = { left: 0, top: 0, width: 0, height: 0 };
      try { r = el.getBoundingClientRect(); } catch (e) {}
      var base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
      var ptr = Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, base);
      try { el.dispatchEvent(new PointerEvent('pointerdown', ptr)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', base)); } catch (e) {}
      try { if (typeof el.focus === 'function') el.focus({ preventScroll: true }); } catch (e) {}
      try { el.dispatchEvent(new PointerEvent('pointerup', ptr)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseup', base)); } catch (e) {}
      el.click();
    }

    function ariaState(el) {
      var out = {};
      ['aria-pressed', 'aria-checked', 'aria-expanded', 'aria-selected'].forEach(function(k) {
        try { var v = el.getAttribute(k); if (v != null) out[k] = v; } catch (e) {}
      });
      if (typeof el.checked === 'boolean') out.checked = String(el.checked);
      return out;
    }

    function ariaDiff(before, after) {
      var parts = [];
      Object.keys(after).forEach(function(k) {
        if (before[k] !== after[k]) parts.push(k + ' ' + (before[k] == null ? 'unset' : before[k]) + ' to ' + after[k]);
      });
      return parts.join(', ');
    }

    function pageFacts() {
      var card = false;
      var frame = false;
      try {
        var ac = document.querySelectorAll('[autocomplete*="cc-"]');
        for (var i = 0; i < ac.length && !card; i++) {
          if (/(^|\s)cc-/.test(String(ac[i].getAttribute('autocomplete') || '').toLowerCase())) card = true;
        }
      } catch (e) {}
      try {
        var frames = document.querySelectorAll('iframe[src]');
        for (var j = 0; j < frames.length && !frame; j++) {
          if (!G.paymentFrame(frames[j].src) || !visible(frames[j])) continue;
          var r = frames[j].getBoundingClientRect();
          if (r.width >= 30 && r.height >= 15) frame = true;
        }
      } catch (e) {}
      return { cardFields: card, payFrame: frame };
    }

    function gateFacts(el, what, kind, field) {
      var chain = [];
      var node = el;
      while (node && node.nodeType === 1 && chain.length < 4) {
        chain.push(node);
        node = node.parentElement || ((node.getRootNode && node.getRootNode().host) || null);
      }
      var names = [el ? info(el).nameN : ''];
      for (var j = 1; j < chain.length; j++) {
        try {
          names.push(norm(chain[j].getAttribute('aria-label') || ''));
          names.push(norm(chain[j].getAttribute('title') || ''));
        } catch (e) {}
      }
      var tag = String((el && el.tagName) || '').toLowerCase();
      var href = '';
      if (tag === 'a' || tag === 'area') { try { href = String(el.getAttribute('href') || '').trim(); } catch (e) {} }
      var type = String((el && el.type) || '').toLowerCase();
      var form = null;
      try { form = (el && el.form && el.form.nodeType === 1) ? el.form : null; } catch (e) {}
      var submit = field ? !!form : !!form && ((tag === 'button' && type === 'submit') || (tag === 'input' && (type === 'submit' || type === 'image')));
      var method = '';
      if (form) { try { method = String((!field && el.getAttribute('formmethod')) || form.getAttribute('method') || 'get').toLowerCase(); } catch (e) {} }
      var page = pageFacts();
      return {
        what: what,
        names: names,
        ids: chain.map(function(n) { return String(n.id || '').toLowerCase(); }),
        link: !!href && !/^(#|javascript:)/i.test(href),
        field: !!field,
        submit: submit,
        method: method,
        kind: kind || '',
        host: window.location.hostname,
        path: window.location.pathname,
        where: window.location.host + window.location.pathname,
        cardFields: page.cardFields,
        payFrame: page.payFrame,
        rules: RULES
      };
    }

    function decide(el, what, kind, field) {
      try { return G.check(gateFacts(el, what, kind, field)); } catch (e) { return { ok: false, code: 'refused', reason: what + ': the safety check failed (' + String(e && e.message || e) + ')' }; }
    }

    function refusal(d) {
      return { ok: false, code: 'refused', why: d.why || '', error: 'refused: ' + d.reason + '. ZERACK never does this, not even with a press from the user; the user has to do it.' };
    }

    function hold(el, d, what, kind, field, perform) {
      var handle = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      held = { handle: handle, el: el, name: info(el).nameN, value: field ? fieldValue(el) : null, what: what, kind: kind || '', field: !!field, line: d.line, perform: perform, until: Date.now() + HOLD_MS };
      var out = { ok: false, code: 'needs_press', kind: d.kind, line: d.line, handle: handle, error: 'waiting for a press from the user: ' + d.line };
      if (d.kind === 'Pay') out.spend = d.spend !== false;
      return out;
    }

    function noEvidence(d, ev) {
      var missing = ev && Array.isArray(ev.missing) && ev.missing.length ? ev.missing.slice(0, 5).map(function(m) { return clip(m, 300); }) : ['a measured A/B test on this site: ask the ZERACK chat which option wins first'];
      return { ok: false, code: 'needs_evidence', kind: 'Pay', missing: missing, error: 'not offered: ' + d.line + '. A press that spends money waits for a measured test with enough evidence, and none was found here. Missing: ' + missing.join('; ') + '. Tell the user what is missing and that they can still do it themselves. Do not retry.' };
    }

    function gate(el, what, kind, field, perform) {
      var d = decide(el, what, kind, field);
      if (d.ok) return Promise.resolve(perform(false));
      if (d.code === 'refused') return Promise.resolve(refusal(d));
      if (typeof hooks.confirm === 'function') {
        var spends = d.kind === 'Pay' && d.spend !== false;
        var evidence = !spends ? Promise.resolve({ ok: true }) : (typeof hooks.evidence === 'function' ? Promise.resolve(hooks.evidence(d)).then(null, function() { return null; }) : Promise.resolve(null));
        return evidence.then(function(ev) {
          if (!ev || ev.ok !== true) return noEvidence(d, ev);
          return Promise.resolve(hooks.confirm(d)).then(function(g) {
            if (g && g.ok) return perform(true);
            return (g && g.result) ? g.result : { ok: false, code: 'declined', error: 'the user did not confirm, so it did not run: ' + d.line };
          });
        });
      }
      if (hooks.hold === true) return Promise.resolve(hold(el, d, what, kind, field, perform));
      return Promise.resolve({ ok: false, code: 'needs_press', kind: d.kind, line: d.line, error: 'not run, it needs a press from the user: ' + d.line });
    }

    function press(handle) {
      var h = held;
      if (!h || h.handle !== String(handle || '')) return Promise.resolve({ ok: false, code: 'expired', error: 'that press is no longer waiting on this page, so nothing was done' });
      held = null;
      if (Date.now() > h.until) return Promise.resolve({ ok: false, code: 'expired', error: 'the press came too late, so nothing was done: ' + h.line });
      if (!h.el.isConnected || !visible(h.el)) return Promise.resolve({ ok: false, code: 'changed', error: 'the element went away before the press, so nothing was done: ' + h.line });
      if (info(h.el).nameN !== h.name) return Promise.resolve({ ok: false, code: 'changed', error: 'the element changed its label before the press, so nothing was done: ' + h.line });
      if (h.field && fieldValue(h.el) !== h.value) return Promise.resolve({ ok: false, code: 'changed', error: 'the text in the field changed before the press, so nothing was sent: ' + h.line });
      var d = decide(h.el, h.what, h.kind, h.field);
      if (!d.ok && d.code === 'refused') return Promise.resolve(refusal(d));
      return Promise.resolve(h.perform(true)).then(function(r) {
        if (r && typeof r === 'object' && r.ok !== false) r.confirmedByUser = true;
        return r;
      });
    }

    function release() {
      var had = !!held;
      held = null;
      return had;
    }

    function fieldIsSensitive(el) {
      if (!el) return false;
      try {
        var inf = info(el);
        return G.sensitiveField({
          type: el.type,
          autocomplete: (el.getAttribute && el.getAttribute('autocomplete')) || '',
          hint: [el.name || '', el.id || '', inf.name, el.getAttribute('aria-label') || '', el.getAttribute('placeholder') || '', inf.labelText].join(' ')
        });
      } catch (e) { return true; }
    }

    function sendContext(el, inf) {
      try {
        if (P.sendBoxes && el.closest && el.closest(P.sendBoxes)) return true;
      } catch (e) {}
      return /\b(comment|reply|message|chat|post|comentario|respuesta|mensaje|kommentar|antwort|nachricht|commentaire|reponse)/.test(inf.allW);
    }

    function fieldValue(el) {
      var tag = String(el.tagName || '').toLowerCase();
      return (tag === 'input' || tag === 'textarea') ? String(el.value || '') : String(el.innerText || el.textContent || '');
    }

    function write(el, text, mode) {
      var tag = String(el.tagName || '').toLowerCase();
      var isField = tag === 'input' || tag === 'textarea';
      try { el.focus(); } catch (e) {}
      var inserted = false;
      try {
        if (isField) {
          if (mode === 'replace') el.select();
          else { var n = String(el.value || '').length; el.setSelectionRange(n, n); }
        } else {
          var range = document.createRange();
          range.selectNodeContents(el);
          if (mode !== 'replace') range.collapse(false);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        inserted = text ? document.execCommand('insertText', false, text) : document.execCommand('delete', false);
      } catch (e) { inserted = false; }
      if (!inserted) {
        var next;
        if (isField) {
          var proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          var d = Object.getOwnPropertyDescriptor(proto, 'value');
          next = mode === 'replace' ? text : String(el.value || '') + text;
          try { if (d && d.set) d.set.call(el, next); else el.value = next; } catch (e2) { el.value = next; }
        } else {
          el.textContent = mode === 'replace' ? text : String(el.textContent || '') + text;
        }
        try { el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text })); } catch (e3) {}
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e4) {}
      }
      return inserted ? 'insertText' : 'value';
    }

    function pressEnter(el) {
      var o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
      var handled = false;
      try { handled = !el.dispatchEvent(new KeyboardEvent('keydown', o)); } catch (e) {}
      try { el.dispatchEvent(new KeyboardEvent('keypress', o)); } catch (e) {}
      try { el.dispatchEvent(new KeyboardEvent('keyup', o)); } catch (e) {}
      if (!handled && el.form && typeof el.form.requestSubmit === 'function') {
        try { el.form.requestSubmit(); } catch (e) {}
      }
    }

    function miss(a, r) {
      if (r && r.code === 'stopped') return { ok: false, code: 'stopped', error: 'stopped by the user' };
      if (r && r.code === 'no_target') return { ok: false, code: 'no_target', error: 'no target was given, describe the element in target' };
      var streak = bumpMiss();
      var looked = String(a.target || '') + (a.selector ? ' [selector ' + a.selector + ']' : '');
      var out = {
        ok: false,
        code: 'not_found',
        error: ((r && r.message) || 'not found on the page') + ': ' + clip(looked, 120),
        lookedFor: looked,
        foundInstead: (r && r.nearest) || [],
        page: snapshot(25)
      };
      out.next = streak >= 3
        ? 'Three misses in a row. Stop acting and tell the user what you looked for and what the page showed instead.'
        : 'Pick a description from foundInstead or page.onScreen and try again, or read the page first.';
      return out;
    }

    function editTarget(el) {
      if (editable(el) || isPassword(el)) return Promise.resolve({ field: el });
      if (el.control && (editable(el.control) || isPassword(el.control))) return Promise.resolve({ field: el.control });
      var inner = firstEditable(el);
      if (inner) return Promise.resolve({ field: inner });
      var opener = clickable(el);
      var openerInfo = info(opener);
      if (!decide(opener, 'click ' + describe(openerInfo)).ok) return Promise.resolve({ field: null, why: 'it is a ' + describe(openerInfo) + ', not a text field, and pressing it would act' });
      fire(opener);
      var start = Date.now();
      return new Promise(function(done) {
        (function look() {
          var act = deepActive();
          if (act && (editable(act) || isPassword(act)) && !inExcluded(act)) { done({ field: act }); return; }
          var inside = firstEditable(el) || (el.parentElement && firstEditable(el.parentElement));
          if (inside) { done({ field: inside }); return; }
          if (Date.now() - start > 1500) { done({ field: null, why: 'it takes no text, and clicking it opened no text field' }); return; }
          setTimeout(look, 150);
        })();
      });
    }

    function leaves(el) {
      try {
        var tag = String(el.tagName || '').toLowerCase();
        if (tag === 'a' || tag === 'area') {
          var href = String(el.getAttribute('href') || '').trim();
          return !!href && !/^(#|javascript:)/i.test(href) && String(el.getAttribute('target') || '').toLowerCase() !== '_blank';
        }
        var type = String(el.type || '').toLowerCase();
        return !!el.form && ((tag === 'button' && type === 'submit') || (tag === 'input' && (type === 'submit' || type === 'image')));
      } catch (e) { return false; }
    }

    function click(a) {
      return find(a, 'click').then(function(r) {
        if (!r.el) return miss(a, r);
        var target = clickable(r.el);
        var inf = info(target);
        if (!inf.name) inf = r.info;
        var label = describe(inf);
        return gate(target, 'click ' + label, '', false, function(confirmed) {
          if (!target.isConnected) return { ok: false, error: 'the ' + label + ' went away before it could be clicked' };
          var before = window.location.href;
          var stateBefore = ariaState(target);
          var away = hooks.hold === true && leaves(target);
          fire(target);
          return sleep(away ? 60 : 700).then(function() {
            var out = { ok: true, clicked: label };
            if (confirmed) out.confirmedByUser = true;
            if (away) out.mayLeave = true;
            if (window.location.href !== before) out.nowAt = window.location.href;
            if (target.isConnected) {
              var diff = ariaDiff(stateBefore, ariaState(target));
              if (diff) out.stateChanged = diff;
              var nameAfter = info(target).name;
              if (nameAfter && norm(nameAfter) !== inf.nameN) out.nowReads = clip(nameAfter, 80);
            }
            if (r.loose) out.matchedLoosely = true;
            if (r.alsoMatched) out.alsoMatched = r.alsoMatched + ' other elements matched as well; the one on screen was used';
            return out;
          });
        });
      });
    }

    function type(a, mode) {
      var fromReply = String(a.textFrom || '').toLowerCase() === 'last_reply';
      var text = fromReply ? (typeof hooks.lastReply === 'function' ? String(hooks.lastReply() || '') : '') : String(a.text == null ? '' : a.text);
      if (fromReply && !text) return Promise.resolve({ ok: false, error: 'there is no earlier reply in this chat to paste' });
      if (text.length > 20000) text = text.slice(0, 20000);
      return find(a, 'edit').then(function(r) {
        if (!r.el) return miss(a, r);
        var label = describe(r.info);
        return editTarget(r.el).then(function(t) {
          var field = t.field;
          if (!field) return { ok: false, error: 'found ' + label + ' but ' + t.why };
          if (fieldIsSensitive(field)) {
            return { ok: false, code: 'sensitive', error: 'refused: ' + label + ' asks for a password, a one time code, payment, bank or tax data, or an API key. ZERACK never types there, the user has to fill it in.' };
          }
          var finfo = info(field);
          var flabel = finfo.name ? describe(finfo) : label;
          var was = fieldValue(field);
          var how = write(field, text, mode);
          var now = fieldValue(field);
          var want = norm(text);
          var got = norm(now);
          var landed = mode === 'replace' ? got === want : (want === '' || got.indexOf(want) !== -1);
          if (!landed) {
            return { ok: false, error: 'typed into ' + flabel + ' but the field now reads something else', fieldNow: clip(now, 200), expected: clip(text, 200), method: how };
          }
          var out = { ok: true, typed: text.length + ' characters into ' + flabel, verified: true };
          if (fromReply) out.source = 'your last reply';
          if (r.loose) out.matchedLoosely = true;
          if (hooks.ledger === true) { out.field = flabel; out.before = clip(was, 2000); out.after = clip(now, 2000); }
          if (!flag(a.submit)) return out;
          var sent = null;
          return gate(field, 'send what was typed in ' + flabel, sendContext(field, finfo) ? 'Send' : '', true, function(confirmed) {
            sent = Object.assign({}, out);
            var before = window.location.href;
            pressEnter(field);
            return sleep(800).then(function() {
              sent.submitted = true;
              if (confirmed) sent.confirmedByUser = true;
              if (window.location.href !== before) sent.nowAt = window.location.href;
              return sent;
            });
          }).then(function(g) {
            if (g === sent) return g;
            var failed = Object.assign({}, out, { ok: false, submitted: false, error: 'typed, but not sent: ' + g.error });
            ['code', 'kind', 'line', 'handle'].forEach(function(k) { if (g[k] != null) failed[k] = g[k]; });
            return failed;
          });
        });
      });
    }

    function select(a) {
      var want = String(a.text != null && a.text !== '' ? a.text : (a.option || '')).trim();
      if (!want) return Promise.resolve({ ok: false, error: 'select needs the option to pick, in text' });
      return find(a, 'select').then(function(r) {
        if (!r.el) return miss(a, r);
        var el = r.el;
        var label = describe(r.info);
        if (String(el.tagName || '').toLowerCase() === 'select') {
          if (fieldIsSensitive(el)) {
            return { ok: false, code: 'sensitive', error: 'refused: ' + label + ' asks for payment, bank or tax data. ZERACK never fills it in, the user has to.' };
          }
          var wn = norm(want);
          var opts = Array.prototype.slice.call(el.options || []);
          var pick = opts.filter(function(o) { return norm(o.textContent) === wn || norm(o.value) === wn; })[0]
            || opts.filter(function(o) { return norm(o.textContent).indexOf(wn) !== -1; })[0];
          if (!pick) return { ok: false, error: 'no option "' + want + '" in ' + label, options: opts.slice(0, 30).map(function(o) { return clip(o.textContent, 60); }) };
          var prior = el.selectedIndex >= 0 && el.options[el.selectedIndex] ? clip(el.options[el.selectedIndex].textContent, 200) : '';
          var sends = /submit\s*\(/i.test(String(el.getAttribute('onchange') || ''));
          return gate(pick, 'pick "' + clip(pick.textContent, 60) + '" in ' + label, '', sends, function(confirmed) {
            el.value = pick.value;
            try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
            try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            if (el.value !== pick.value) return { ok: false, error: 'the dropdown did not keep "' + want + '"' };
            var out = { ok: true, picked: clip(pick.textContent, 60), in: label };
            if (confirmed) out.confirmedByUser = true;
            if (hooks.ledger === true) { out.field = label; out.before = prior; out.after = clip(pick.textContent, 200); }
            return out;
          });
        }
        var opener = clickable(el);
        var openerInfo = info(opener);
        if (!decide(opener, 'click ' + describe(openerInfo)).ok) return { ok: false, error: 'found ' + label + ' but opening it would act, so pick the option with a click the user can confirm' };
        fire(opener);
        var q = parseTarget('"' + want.replace(/["\u201c\u201d]/g, '') + '"', false);
        var start = Date.now();
        return new Promise(function(done) {
          (function look() {
            var pool = collect(CANDIDATES_HERE, 8000).list.filter(function(x) { return x !== opener && !opener.contains(x); });
            var o = rank(pool, q, 'option', false);
            if (!o.el) o = rank(pool, q, 'any', false);
            if (o.el || Date.now() - start > 2500) { done(o); return; }
            setTimeout(look, 300);
          })();
        }).then(function(o) {
          if (!o.el) return miss({ target: 'option "' + want + '" after opening ' + label }, o);
          var optEl = clickable(o.el);
          var olabel = describe(info(optEl).name ? info(optEl) : o.info);
          return gate(optEl, 'pick ' + olabel, '', false, function(confirmed) {
            fire(optEl);
            return sleep(600).then(function() {
              var out = { ok: true, opened: label, picked: olabel };
              if (confirmed) out.confirmedByUser = true;
              if (hooks.ledger === true) { out.field = label; out.before = clip(openerInfo.name, 200); out.after = clip(opener.isConnected ? info(opener).name : olabel, 200); }
              return out;
            });
          });
        });
      });
    }

    function read(a) {
      if (!a.target && !a.selector) return Promise.resolve(Object.assign({ ok: true, pageData: true }, snapshot(45)));
      return find(a, 'read').then(function(r) {
        if (!r.el) return miss(a, r);
        var el = r.el;
        if (r.info.role === 'heading' && el.parentElement) el = el.parentElement;
        var text = String(el.innerText || el.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        return { ok: true, pageData: true, read: describe(r.info), text: text.slice(0, 6000), truncated: text.length > 6000 };
      });
    }

    function wait(a) {
      var hasTarget = !!(a.target || a.selector);
      var ms = Math.max(100, Math.min(15000, Number(a.timeoutMs) || (hasTarget ? 8000 : 1500)));
      if (!hasTarget) return sleep(ms).then(function() { return { ok: true, waitedMs: ms }; });
      var start = Date.now();
      return new Promise(function(done) {
        (function poll() {
          if (stopped()) { done({ ok: false, code: 'stopped', error: 'stopped by the user' }); return; }
          var r = resolve(String(a.target || ''), String(a.selector || ''), 'any', false);
          if (r.el) { done({ ok: true, found: describe(r.info), afterMs: Date.now() - start }); return; }
          if (r.code === 'bad_selector' || Date.now() - start >= ms) {
            if (!r.message) r.message = 'did not appear within ' + ms + ' ms';
            done(miss(a, r));
            return;
          }
          setTimeout(poll, 300);
        })();
      });
    }

    function scroll(a) {
      if (a.target || a.selector) {
        var tries = 0;
        return new Promise(function(done) {
          (function look() {
            if (stopped()) { done({ ok: false, code: 'stopped', error: 'stopped by the user' }); return; }
            var r = resolve(String(a.target || ''), String(a.selector || ''), 'any', false);
            if (r.el) {
              try { r.el.scrollIntoView({ block: 'center' }); } catch (e) {}
              done({ ok: true, scrolledTo: describe(r.info), scrollY: Math.round(window.scrollY) });
              return;
            }
            if (r.code === 'bad_selector' || tries >= 8) { done(miss(a, r)); return; }
            tries++;
            window.scrollBy(0, Math.round(window.innerHeight * 0.85));
            setTimeout(look, 600);
          })();
        });
      }
      var dir = String(a.direction || 'down').toLowerCase();
      var amt = Math.max(50, Math.min(20000, Number(a.amount) || 600));
      var y0 = Math.round(window.scrollY);
      if (dir === 'top') window.scrollTo(0, 0);
      else if (dir === 'bottom') window.scrollTo(0, document.documentElement.scrollHeight);
      else if (dir === 'up') window.scrollBy(0, -amt);
      else window.scrollBy(0, amt);
      return sleep(250).then(function() {
        return { ok: true, direction: dir, scrollYBefore: y0, scrollYAfter: Math.round(window.scrollY) };
      });
    }

    function navigate(a) {
      a = (a && typeof a === 'object') ? a : {};
      var raw = String(a.url || '').trim();
      if (!raw && /^(https?:)?\/\//i.test(String(a.target || '').trim())) raw = String(a.target).trim();
      if (!raw) return Promise.resolve({ ok: false, error: 'navigate needs a url' });
      var u;
      try { u = new URL(raw, window.location.href); } catch (e) { return Promise.resolve({ ok: false, error: 'not a valid address: ' + clip(raw, 120) }); }
      if (u.protocol !== 'https:') return Promise.resolve({ ok: false, error: 'only https addresses can be opened' });
      var alias = profileFor(u.hostname).hostAlias;
      if (alias && alias.hasOwnProperty(u.hostname)) u.hostname = alias[u.hostname];
      var refusal = typeof hooks.checkHost === 'function' ? String(hooks.checkHost(u.hostname) || '') : (u.hostname === window.location.hostname ? '' : 'refused: ' + u.hostname + ' is not the site this page is on');
      if (refusal) return Promise.resolve({ ok: false, code: 'host', error: refusal });
      var newTab = flag(a.newTab);
      if (newTab || u.host !== window.location.host) {
        if (typeof hooks.openTab !== 'function') return Promise.resolve({ ok: false, error: 'the new tab did not open: this page cannot open tabs' });
        return Promise.resolve(hooks.openTab(u.href)).then(function(res) {
          if (!res || !res.ok) return { ok: false, error: 'the new tab did not open: ' + ((res && res.error) || 'no answer') };
          var out = { ok: true, openedInNewTab: u.href, note: 'nspAct keeps acting on the tab this panel is open on, not on the new tab.' };
          if (res.tabId != null) out.tabId = res.tabId;
          if (!newTab) out.why = u.host + ' opened in a new tab because this assistant runs on ' + window.location.host + ' and would close if this tab left it.';
          return out;
        });
      }
      if (u.href.split('#')[0] === window.location.href.split('#')[0] && u.hash) {
        window.location.hash = u.hash;
        return Promise.resolve({ ok: true, nowAt: window.location.href });
      }
      if (typeof hooks.go !== 'function') return Promise.resolve({ ok: false, error: 'this tab cannot navigate from here' });
      return Promise.resolve(hooks.go(u.href));
    }

    function act(a) {
      a = (a && typeof a === 'object') ? a : {};
      var action = norm(a.action);
      var run;
      if (action === 'navigate' || action === 'goto' || action === 'open') run = navigate(a);
      else if (action === 'read') run = read(a);
      else if (action === 'wait') run = wait(a);
      else if (action === 'scroll') run = scroll(a);
      else if (action === 'click' || action === 'press' || action === 'tap') run = click(a);
      else if (action === 'type' || action === 'fill') run = type(a, 'replace');
      else if (action === 'paste' || action === 'append') run = type(a, 'insert');
      else if (action === 'select' || action === 'choose') run = select(a);
      else return Promise.resolve({ ok: false, error: 'unknown action "' + clip(a.action, 30) + '", use click, type, paste, select, scroll, navigate, wait or read' });
      if (typeof hooks.onMiss === 'function') return run;
      return run.then(function(r) {
        if (r && r.ok !== false) own.misses = 0;
        return r;
      });
    }

    return {
      profile: P.id,
      act: act,
      press: press,
      release: release,
      navigate: navigate,
      snapshot: snapshot,
      decide: function(el, what) { return decide(el, String(what || 'click')); },
      sensitive: fieldIsSensitive
    };
  }

  root.NSP_HANDS = Object.freeze({
    version: 2,
    create: create,
    clip: clip,
    profileFor: function(host) { return profileFor(host).id; }
  });
})(typeof self !== 'undefined' ? self : this);
