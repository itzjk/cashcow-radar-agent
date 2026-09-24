(function () {
  if (window.top !== window || window.__zerackBubble) return;
  window.__zerackBubble = true;

  var SIZE = 52, EDGE = 12, DRAG_PX = 14, HOLD_MS = 250, CANCEL_PX = 90, GAP = 12;
  var PANEL_W = 400, PANEL_H = 640, PANEL_MIN_H = 320, YT_TOP = 64, SHORT_OBSTACLE = 160, REOPEN_MS = 180000;
  var KEYS = ['nsp_bubble_on', 'nsp_bubble_hidden_sites', 'nsp_bubble_pos', 'nsp_voice_wake', 'nsp_chat_reopen'];
  var YT_PANELS = ['nsp-coach-host', 'nsp-transcript-panel', 'nsp-comments-panel', 'nsp-similar-panel', 'nsp-titlelab-panel', 'nsp-thumblab-panel', 'nsp-transcript-btn-floating', 'nsp-comments-btn-floating'];
  var ROLES = { button: 1, link: 1, menuitem: 1, tab: 1, checkbox: 1, 'switch': 1, combobox: 1, searchbox: 1, textbox: 1 };
  var TAGS = { A: 1, BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, SUMMARY: 1 };
  var STATES = { idle: 1, listening: 1, hearing: 1, noisy: 1, thinking: 1, speaking: 1, error: 1 };
  var TITLES = {
    idle: 'ZERACK: click to chat, hold to talk',
    wake: 'ZERACK is listening hands-free. Click to chat, hold to talk',
    listening: 'ZERACK is listening',
    hearing: 'ZERACK hears you',
    noisy: 'Noisy room: hold the bubble to talk',
    thinking: 'ZERACK is thinking',
    speaking: 'ZERACK is speaking',
    error: 'The voice hit a problem',
    cancel: 'Release to cancel'
  };
  var CSS = [
    ':host { all: initial; }',
    '.bubble { all: unset; box-sizing: border-box; position: fixed; width: 52px; height: 52px; border-radius: 50%; background: #070707; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; box-shadow: 0 8px 26px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.10); transition: transform .15s ease, box-shadow .2s ease, opacity .2s ease; }',
    '.bubble:hover { transform: scale(1.05); box-shadow: 0 10px 30px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.22); }',
    '.bubble:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }',
    '.bubble.drag { cursor: grabbing; transform: scale(1.08); }',
    '.bubble img { display: block; width: 52px; height: 52px; border-radius: 50%; pointer-events: none; -webkit-user-drag: none; user-select: none; }',
    '.ring, .flash { position: absolute; inset: -4px; border-radius: 50%; pointer-events: none; box-sizing: border-box; }',
    '.ring { --c: 255,45,45; border: 2px solid transparent; transition: border-color .2s ease; }',
    '.flash { border: 2px solid #9a9a9a; outline: 1px solid rgba(0,0,0,.28); opacity: 0; }',
    '.bubble[data-wake="on"] .ring { border-color: rgba(255,45,45,.55); }',
    '.bubble[data-state="listening"] .ring { border-color: #ff2d2d; animation: zb-pulse 1.2s ease-out infinite; }',
    '.bubble[data-state="hearing"] .ring { border-color: #ff2d2d; border-width: 3px; animation: zb-pulse .65s ease-out infinite; }',
    '.bubble[data-state="noisy"] .ring { --c: 255,176,32; border-color: #ffb020; border-style: dashed; animation: zb-spin 5s linear infinite; }',
    '.bubble[data-state="thinking"] .ring { border-color: rgba(0,0,0,.4); border-top-color: #fff; border-right-color: rgba(255,255,255,.55); animation: zb-spin .8s linear infinite; }',
    '.bubble[data-state="speaking"] .ring { --c: 255,255,255; border-color: #fff; outline: 1px solid rgba(0,0,0,.35); animation: zb-pulse 1.4s ease-out infinite; }',
    '.bubble[data-state="error"] { animation: zb-shake .36s ease; }',
    '.bubble[data-state="error"] .ring { border-color: #ff2d2d; }',
    '.bubble[data-held="cancel"] .ring { border-color: rgba(255,255,255,.45); border-style: dashed; animation: none; }',
    '.bubble[data-flash="ignored"] .flash { animation: zb-flash .9s ease-out; }',
    '.panel { position: fixed; box-sizing: border-box; border-radius: 18px; overflow: hidden; background: #000; box-shadow: 0 24px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.12); opacity: 0; transform: translateY(14px) scale(.96); transition: opacity .18s ease, transform .24s cubic-bezier(.2,.8,.2,1), visibility 0s linear .24s; visibility: hidden; pointer-events: none; }',
    '.panel.open { opacity: 1; transform: none; visibility: visible; pointer-events: auto; transition: opacity .18s ease, transform .24s cubic-bezier(.2,.8,.2,1), visibility 0s; }',
    '.panel iframe { display: block; width: 100%; height: 100%; border: 0; background: #000; color-scheme: dark; }',
    '@keyframes zb-pulse { 0% { box-shadow: 0 0 0 0 rgba(var(--c),.55); } 100% { box-shadow: 0 0 0 11px rgba(var(--c),0); } }',
    '@keyframes zb-spin { to { transform: rotate(360deg); } }',
    '@keyframes zb-shake { 0%, 100% { translate: 0; } 25% { translate: -4px 0; } 75% { translate: 4px 0; } }',
    '@keyframes zb-flash { 0% { opacity: 0; } 20% { opacity: 1; } 45% { opacity: .15; } 65% { opacity: .9; } 100% { opacity: 0; } }',
    '@media (prefers-reduced-motion: reduce) { .bubble, .ring, .flash, .panel { animation: none !important; transition: none !important; } }'
  ].join('\n');

  var yt = /(^|\.)youtube\.com$/.test(location.hostname);
  var site = yt ? 'yt' : 'web';
  var prefs = { on: true, hidden: false, wake: false };
  var pos = { r: 24, b: yt ? 148 : 24 };
  var at = { r: pos.r, b: pos.b };
  var voiceState = 'idle';
  var press = null, open = false, panel = null, frame = null, asking = false, mounted = false, dead = false, loaded = false;
  var errTimer = 0, flashTimer = 0, hideTimer = 0, watchTimer = 0;

  var host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:0;bottom:0;width:0;height:0;display:none;';
  var root = host.attachShadow({ mode: 'closed' });
  var style = document.createElement('style');
  style.textContent = CSS;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bubble';
  btn.setAttribute('aria-label', 'ZERACK chat and voice');
  btn.dataset.state = 'idle';
  btn.dataset.wake = 'off';
  var img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.src = chrome.runtime.getURL('icons/zerack-bubble.svg');
  var ring = document.createElement('span');
  ring.className = 'ring';
  var flash = document.createElement('span');
  flash.className = 'flash';
  btn.appendChild(img);
  btn.appendChild(ring);
  btn.appendChild(flash);
  root.appendChild(style);
  root.appendChild(btn);

  function alive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }

  function teardown() {
    dead = true;
    clearTimeout(errTimer);
    clearTimeout(flashTimer);
    clearTimeout(hideTimer);
    clearInterval(watchTimer);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('focus', checkAlive);
    document.removeEventListener('fullscreenchange', refresh);
    document.removeEventListener('visibilitychange', onVisible);
    host.remove();
    mounted = false;
  }

  function checkAlive() {
    if (!dead && !alive()) teardown();
    return !dead;
  }

  function send(msg, cb) {
    try {
      chrome.runtime.sendMessage(msg, function (res) {
        var err = chrome.runtime.lastError;
        if (cb) cb(err ? null : res);
      });
    } catch (e) { teardown(); }
  }

  function shown() {
    return prefs.on && !prefs.hidden;
  }

  function stale(el) {
    if (el === host || el.tagName !== 'DIV' || el.shadowRoot || el.childElementCount) return false;
    var st = el.style;
    return st.position === 'fixed' && st.zIndex === '2147483647' && st.width === '0px' && st.height === '0px' && st.right === '0px' && st.bottom === '0px';
  }

  function mount() {
    if (mounted || dead) return;
    Array.prototype.slice.call(document.documentElement.children).forEach(function (el) { if (stale(el)) el.remove(); });
    document.documentElement.appendChild(host);
    mounted = true;
  }

  function unmount() {
    if (!mounted) return;
    host.remove();
    mounted = false;
    if (panel) { panel.remove(); panel = null; frame = null; }
  }

  function refresh() {
    if (dead) return;
    if (!shown() && !open) { unmount(); return; }
    mount();
    btn.style.display = shown() ? '' : 'none';
    host.style.display = document.fullscreenElement ? 'none' : '';
    place();
  }

  function clampTo(a) {
    a.r = Math.min(Math.max(EDGE, a.r), Math.max(EDGE, window.innerWidth - SIZE - EDGE));
    a.b = Math.min(Math.max(EDGE, a.b), Math.max(EDGE, window.innerHeight - SIZE - EDGE));
    return a;
  }

  function seen(el) {
    if (!el || !el.getBoundingClientRect) return null;
    var r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    var cs = getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 ? null : r;
  }

  function pinned(el) {
    for (var i = 0; el && i < 30; i++) {
      if (el.nodeType === 1) {
        var p = getComputedStyle(el).position;
        if (p === 'fixed' || p === 'sticky') return true;
      }
      el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
    }
    return false;
  }

  function clickable(el) {
    for (var i = 0; el && i < 5 && el !== document.body && el !== document.documentElement; i++) {
      if (TAGS[el.tagName] || ROLES[String(el.getAttribute && el.getAttribute('role') || '')] || el.isContentEditable) return el;
      el = el.parentElement;
    }
    return null;
  }

  function hits(r, box) {
    return r.left < box.right + 4 && r.right > box.left - 4 && r.top < box.bottom + 4 && r.bottom > box.top - 4;
  }

  function obstacle(a) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var box = { left: vw - a.r - SIZE, right: vw - a.r, top: vh - a.b - SIZE, bottom: vh - a.b };
    var list = [];
    if (yt) {
      YT_PANELS.forEach(function (id) { var el = document.getElementById(id); if (el) list.push(el); });
      var mini = document.querySelector('ytd-app[miniplayer-is-active] ytd-miniplayer');
      if (mini) list.push(mini);
    }
    for (var i = 0; i < list.length; i++) {
      var r = seen(list[i]);
      if (r && hits(r, box)) return r;
    }
    var still = (document.scrollingElement || document.documentElement).scrollHeight <= vh + 1;
    var pts = [[(box.left + box.right) / 2, (box.top + box.bottom) / 2], [box.left + 6, box.top + 6], [box.right - 6, box.top + 6], [box.left + 6, box.bottom - 6], [box.right - 6, box.bottom - 6]];
    for (var k = 0; k < pts.length; k++) {
      var under = document.elementsFromPoint(pts[k][0], pts[k][1]);
      for (var j = 0; j < under.length; j++) {
        var el = under[j];
        if (el === host || el === document.body || el === document.documentElement) continue;
        var c = clickable(el);
        if (c && (still || pinned(c))) { var cr = seen(c); if (cr) return cr; }
      }
    }
    return null;
  }

  function clear(a) {
    var vw = window.innerWidth, vh = window.innerHeight;
    for (var i = 0; i < 4; i++) {
      var r = obstacle(a);
      if (!r) break;
      var before = a.r + ',' + a.b;
      if (r.height <= SHORT_OBSTACLE) a.b = vh - r.top + GAP;
      else a.r = vw - r.left + GAP;
      clampTo(a);
      if (a.r + ',' + a.b === before) break;
    }
    return a;
  }

  function place() {
    if (!mounted) return;
    clampTo(pos);
    var dragging = press && press.mode === 'drag';
    if (open && !dragging) at = clampTo({ r: at.r, b: at.b });
    else if (dragging || btn.style.display === 'none') at = clampTo({ r: pos.r, b: pos.b });
    else at = clear(clampTo({ r: pos.r, b: pos.b }));
    btn.style.right = at.r + 'px';
    btn.style.bottom = at.b + 'px';
    if (panel) placePanel();
  }

  function placePanel() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var top0 = yt ? YT_TOP : EDGE;
    var w = Math.min(PANEL_W, vw - 2 * EDGE);
    var right = vw - at.r - SIZE / 2 > vw / 2;
    var below = vh - at.b - SIZE / 2 < vh / 2;
    var room = below ? at.b - GAP - EDGE : vh - at.b - SIZE - GAP - top0;
    var h = Math.max(160, Math.min(PANEL_H, Math.round(vh * 0.8), vh - top0 - EDGE));
    var ps = panel.style;
    ps.width = w + 'px';
    ps.left = ps.right = ps.top = ps.bottom = 'auto';
    if (btn.style.display === 'none') {
      ps.height = h + 'px';
      ps.right = EDGE + 'px';
      ps.bottom = EDGE + 'px';
      ps.transformOrigin = 'bottom right';
      return;
    }
    if (room >= PANEL_MIN_H) {
      if (right) ps.right = Math.max(EDGE, Math.min(at.r, vw - w - EDGE)) + 'px';
      else ps.left = Math.max(EDGE, Math.min(vw - at.r - SIZE, vw - w - EDGE)) + 'px';
      h = Math.min(h, room);
      if (below) ps.top = (vh - at.b + GAP) + 'px';
      else ps.bottom = (at.b + SIZE + GAP) + 'px';
      ps.transformOrigin = (below ? 'top ' : 'bottom ') + (right ? 'right' : 'left');
    } else {
      var side = right ? vw - at.r - SIZE - GAP - EDGE : at.r - GAP - EDGE;
      if (side >= w) {
        if (right) ps.right = (at.r + SIZE + GAP) + 'px';
        else ps.left = (vw - at.r + GAP) + 'px';
      } else if (right) ps.right = EDGE + 'px';
      else ps.left = EDGE + 'px';
      ps.bottom = EDGE + 'px';
      ps.transformOrigin = 'bottom ' + (right ? 'right' : 'left');
    }
    ps.height = h + 'px';
  }

  function paint() {
    var held = press && press.mode === 'hold';
    var state = voiceState;
    if (held && state !== 'hearing') state = 'listening';
    if (press && press.mode === 'pending') state = btn.dataset.state || 'idle';
    btn.dataset.state = STATES[state] ? state : 'idle';
    btn.dataset.wake = prefs.wake ? 'on' : 'off';
    if (held && press.cancel) btn.dataset.held = 'cancel';
    else delete btn.dataset.held;
    btn.title = held && press.cancel ? TITLES.cancel : (btn.dataset.state === 'idle' && prefs.wake ? TITLES.wake : TITLES[btn.dataset.state]);
  }

  function setVoice(state, wake) {
    clearTimeout(errTimer);
    voiceState = STATES[state] ? state : 'idle';
    if (typeof wake === 'boolean') prefs.wake = wake;
    if (voiceState === 'error') errTimer = setTimeout(function () { voiceState = 'idle'; paint(); }, 1400);
    paint();
  }

  function flashIgnored() {
    clearTimeout(flashTimer);
    delete btn.dataset.flash;
    void btn.offsetWidth;
    btn.dataset.flash = 'ignored';
    flashTimer = setTimeout(function () { delete btn.dataset.flash; }, 950);
  }

  function syncVoice() {
    if (!prefs.wake) return;
    send({ type: 'NSP_VOICE_STATE_GET' }, function (res) { if (res) setVoice(res.state, res.wake); });
  }

  function onKey(e) {
    if (e.key !== 'Escape' || !e.isTrusted) return;
    if (press && press.mode === 'hold') { endPress('cancel'); e.stopPropagation(); return; }
    if (open) { closeChat(); e.stopPropagation(); }
  }

  function watchKeys() {
    if (open || press) window.addEventListener('keydown', onKey, true);
    else window.removeEventListener('keydown', onKey, true);
  }

  function buildPanel(token) {
    panel = document.createElement('div');
    panel.className = 'panel';
    frame = document.createElement('iframe');
    frame.title = 'ZERACK chat';
    frame.src = chrome.runtime.getURL('chat/chat.html') + '?mode=overlay#t=' + encodeURIComponent(token);
    panel.appendChild(frame);
    root.appendChild(panel);
    placePanel();
  }

  function showPanel() {
    clearTimeout(hideTimer);
    open = true;
    refresh();
    if (!panel) return;
    placePanel();
    void panel.offsetWidth;
    panel.classList.add('open');
    frame.tabIndex = 0;
    setTimeout(function () { if (open) try { frame.focus(); } catch (e) {} }, 60);
    watchKeys();
  }

  function openChat() {
    if (open || dead) return;
    if (panel) { showPanel(); return; }
    if (asking) return;
    asking = true;
    send({ type: 'NSP_CHAT_TOKEN' }, function (res) {
      asking = false;
      if (!res || res.ok !== true || typeof res.token !== 'string') { flashIgnored(); return; }
      mount();
      buildPanel(res.token);
      showPanel();
    });
  }

  function closeChat() {
    if (!open) return;
    open = false;
    panel.classList.remove('open');
    frame.tabIndex = -1;
    try { if (root.activeElement === frame || document.activeElement === host) frame.blur(); } catch (e) {}
    hideTimer = setTimeout(refresh, 260);
    watchKeys();
  }

  function toggleChat() {
    if (open) closeChat(); else openChat();
  }

  function savePos() {
    try {
      chrome.storage.local.get('nsp_bubble_pos', function (r) {
        var saved = r && r.nsp_bubble_pos && typeof r.nsp_bubble_pos === 'object' ? r.nsp_bubble_pos : {};
        var next = { yt: saved.yt, web: saved.web };
        if (!next.web && isFinite(saved.r) && isFinite(saved.b)) next.web = { r: saved.r, b: saved.b };
        next[site] = { r: Math.round(pos.r), b: Math.round(pos.b) };
        chrome.storage.local.set({ nsp_bubble_pos: next });
      });
    } catch (e) {}
  }

  function endPress(how) {
    var p = press;
    if (!p) return;
    press = null;
    clearTimeout(p.timer);
    btn.classList.remove('drag');
    try { if (btn.hasPointerCapture(p.id)) btn.releasePointerCapture(p.id); } catch (e) {}
    watchKeys();
    if (p.mode === 'drag') { voiceState = p.before; savePos(); paint(); return; }
    if (p.mode === 'pending') {
      send({ type: 'NSP_VOICE_PTT_END', cancel: true });
      voiceState = p.before;
      paint();
      if (how === 'up') toggleChat();
      return;
    }
    if (how === 'up' && !p.cancel) send({ type: 'NSP_VOICE_PTT_END' });
    else { send({ type: 'NSP_VOICE_PTT_END', cancel: true }); if (voiceState === 'listening' || voiceState === 'hearing') voiceState = 'idle'; }
    paint();
  }

  btn.addEventListener('pointerover', checkAlive);
  btn.addEventListener('pointerdown', function (e) {
    if (!e.isTrusted || e.button !== 0 || press || !checkAlive()) return;
    e.preventDefault();
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, r: at.r, b: at.b, mode: 'pending', cancel: false, timer: 0, before: voiceState };
    try { btn.setPointerCapture(e.pointerId); } catch (x) {}
    send({ type: 'NSP_VOICE_PTT_START', tentative: true });
    press.timer = setTimeout(function () {
      if (!press || press.mode !== 'pending') return;
      press.mode = 'hold';
      send({ type: 'NSP_VOICE_PTT_CONFIRM' });
      paint();
    }, HOLD_MS);
    watchKeys();
  });

  btn.addEventListener('pointermove', function (e) {
    if (!press || e.pointerId !== press.id) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (press.mode === 'pending' && dist >= DRAG_PX) {
      clearTimeout(press.timer);
      press.mode = 'drag';
      btn.classList.add('drag');
      send({ type: 'NSP_VOICE_PTT_END', cancel: true });
    }
    if (press.mode === 'drag') {
      pos.r = press.r - dx;
      pos.b = press.b - dy;
      place();
      return;
    }
    if (press.mode === 'hold') {
      var cancel = dist >= CANCEL_PX;
      if (cancel !== press.cancel) { press.cancel = cancel; paint(); }
    }
  });

  btn.addEventListener('pointerup', function (e) {
    if (!press || e.pointerId !== press.id) return;
    endPress(e.isTrusted ? 'up' : 'cancel');
  });
  btn.addEventListener('pointercancel', function (e) {
    if (press && e.pointerId === press.id) endPress('cancel');
  });
  btn.addEventListener('lostpointercapture', function (e) {
    if (press && e.pointerId === press.id) endPress('cancel');
  });
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    if (e.isTrusted && e.detail === 0) toggleChat();
  });
  btn.addEventListener('contextmenu', function (e) { if (press) e.preventDefault(); });
  btn.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); });
  btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); });

  function applyPrefs(r) {
    if (!r) return;
    if ('nsp_bubble_on' in r) prefs.on = r.nsp_bubble_on !== false;
    if ('nsp_bubble_hidden_sites' in r) prefs.hidden = Array.isArray(r.nsp_bubble_hidden_sites) && r.nsp_bubble_hidden_sites.indexOf(location.hostname) >= 0;
    if ('nsp_voice_wake' in r) prefs.wake = r.nsp_voice_wake === true;
    var saved = r.nsp_bubble_pos;
    var p = saved && typeof saved === 'object' ? (saved[site] || (site === 'web' && isFinite(saved.r) && isFinite(saved.b) ? saved : null)) : null;
    if (p && isFinite(p.r) && isFinite(p.b) && !press) { pos.r = Number(p.r); pos.b = Number(p.b); }
    else if ('nsp_bubble_pos' in r && !press) { pos.r = 24; pos.b = yt ? 148 : 24; }
  }

  function reopen(r) {
    var box = r && r.nsp_chat_reopen;
    if (!box || typeof box !== 'object' || open) return;
    var fresh = Object.keys(box).some(function (k) { return box[k] && Date.now() - Number(box[k].at) < REOPEN_MS; });
    if (fresh) send({ type: 'NSP_CHAT_REOPEN' }, function (res) { if (res && res.open === true) openChat(); });
  }

  function onVisible() {
    if (!checkAlive()) return;
    if (document.visibilityState === 'visible') syncVoice();
  }

  function watch() {
    clearInterval(watchTimer);
    if (!yt) return;
    watchTimer = setInterval(function () {
      if (dead || !mounted || open || press || document.visibilityState !== 'visible') return;
      place();
    }, 1000);
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !sender || sender.id !== chrome.runtime.id || sender.tab) return false;
    if (msg.type === 'NSP_VOICE_STATE') {
      if (msg.flash) { if (msg.state === 'ignored') flashIgnored(); return false; }
      setVoice(String(msg.state || ''), typeof msg.wake === 'boolean' ? msg.wake : undefined);
      return false;
    }
    if (msg.type !== 'NSP_BUBBLE') return false;
    var op = String(msg.op || '');
    if (op === 'toggle') toggleChat();
    else if (op === 'open') openChat();
    else if (op === 'close') closeChat();
    sendResponse({ ok: true, open: open || asking });
    return false;
  });

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      var hit = {}, any = false;
      KEYS.forEach(function (k) { if (changes[k]) { hit[k] = changes[k].newValue; any = true; } });
      if (!any || dead) return;
      if (changes.nsp_bubble_on || changes.nsp_bubble_hidden_sites || changes.nsp_bubble_pos || changes.nsp_voice_wake) {
        applyPrefs(hit);
        refresh();
        paint();
      }
    });
  } catch (e) {}

  try {
    chrome.storage.local.get(KEYS, function (r) {
      r = chrome.runtime.lastError ? null : r;
      loaded = true;
      applyPrefs(r);
      refresh();
      paint();
      syncVoice();
      reopen(r);
      if (mounted) { setTimeout(place, 1500); setTimeout(place, 4000); }
      watch();
    });
  } catch (e) { teardown(); return; }

  window.addEventListener('resize', place);
  window.addEventListener('focus', checkAlive);
  document.addEventListener('fullscreenchange', refresh);
  document.addEventListener('visibilitychange', onVisible);
})();
