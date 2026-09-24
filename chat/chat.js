(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var MODE = /^(?:overlay|panel|window|tab)$/.test(params.get('mode') || '') ? params.get('mode') : 'tab';
  var TOKEN = (/(?:^#|&)t=([0-9a-f]{32})(?:&|$)/.exec(location.hash) || [])[1] || '';
  try { if (location.hash) history.replaceState(null, '', location.pathname + location.search); } catch (e) {}

  var STORE = self.NSP_CHAT_STORE, RENDER = self.NSP_CHAT_RENDER, MODELS = self.NSP_MODELS;
  var HOLD_MS = 250;
  var WATCH_MS = 15000;
  var SEEN_MS = 600;
  var VOICE_FRESH_MS = 120000;
  var PROVIDERS = [
    { id: 'openai', label: 'OpenAI' },
    { id: 'groq', label: 'Groq' },
    { id: 'gemini', label: 'Google' },
    { id: 'ollama', label: 'Local' }
  ];
  var ACTION_WORDS = {
    youtube: 'opened YouTube', search: 'searched YouTube', site: 'opened a site', page: 'opened a ZERACK page', back: 'went back', forward: 'went forward',
    reload: 'reloaded the tab', next_tab: 'moved to the next tab', prev_tab: 'moved to the previous tab', close_tab: 'closed the tab', new_tab: 'opened a new tab',
    scan: 'started a scan', result: 'opened a result', channel: 'opened a channel', save: 'saved', agent: 'switched the agent', wake: 'switched hands-free',
    hush: 'stopped talking', stop: 'stopped', hello: 'answered', assistant: 'asked the assistant'
  };
  var DROP_WORDS = {
    not_command: 'Ignored: not a command, and it did not start with oye, hey or Zerack.',
    audible: 'Ignored: a tab was playing sound, so a command needs oye, hey or Zerack first. Holding the bubble works too.',
    not_heard: 'Nothing was heard while you held it.',
    echo: 'Ignored: it was ZERACK\'s own voice.',
    noisy: 'Ignored: background speech. Hold the bubble or the mic to talk.'
  };
  var ERRORS = {
    no_provider_configured: 'No AI provider is set up yet. Add a key in Setup, or turn on a local model.',
    all_busy: 'Every AI provider is busy right now. Try again in a moment.',
    round_cap: 'Stopped after 10 model calls without a final answer.',
    empty_answer: 'The model sent back an empty answer.',
    stopped: 'Stopped.'
  };
  var GUARDED = { 'agent-pill': 'The Agent switch', hf: 'Hands-free', 'delete': 'Deleting', 'delete-all': 'Deleting', 'clear-voice': 'Clearing' };

  var $ = function (id) { return document.getElementById(id); };
  var S = {
    conv: null, convs: [], msgs: [], view: 'chat', busy: false, running: {}, agentOn: false, wake: false, voice: 'idle',
    configured: {}, localModel: '', selected: 'auto', host: '', els: {}, typing: null, mic: { down: 0, open: 0, seen: false, id: null },
    seen: {}, watch: 0, voiceSeen: 0, moves: 0
  };
  var channel = null;
  try { channel = new BroadcastChannel('zerack_chat'); } catch (e) {}

  function send(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          var err = chrome.runtime.lastError;
          resolve(err ? null : res);
        });
      } catch (e) { resolve(null); }
    });
  }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function lang() {
    return /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
  }

  function textLang(text) {
    var t = String(text || '').toLowerCase();
    if (/[áéíóúñ¿¡]/.test(t)) return 'es';
    var es = (t.match(/\b(?:que|como|el|la|los|las|de|del|mi|mis|un|una|para|por|con|es|en|y|abre|busca|cual|dame|quiero|nicho|canal)\b/g) || []).length;
    var en = (t.match(/\b(?:the|what|how|my|a|an|for|with|is|in|and|open|search|which|give|want|niche|channel|should|to|of)\b/g) || []).length;
    return es > en ? 'es' : (en > es ? 'en' : lang());
  }

  function modelLabel(provider, model) {
    var list = (MODELS && MODELS.list) || [];
    for (var i = 0; i < list.length; i++) if (list[i].provider === provider && list[i].model && list[i].model === model) return list[i].label;
    if (provider === 'ollama') return 'Local model' + (model ? ' ' + model : '');
    if (provider === 'gemini') return model || 'Gemini';
    if (provider === 'openai') return model || 'OpenAI';
    if (provider === 'groq') return model || 'Groq';
    return provider || 'model';
  }

  function scrollDown() {
    var t = $('thread');
    t.scrollTop = t.scrollHeight;
  }

  function nearBottom() {
    var t = $('thread');
    return t.scrollHeight - t.scrollTop - t.clientHeight < 120;
  }

  function announce(convId) {
    try { if (channel) channel.postMessage({ convId: convId || '' }); } catch (e) {}
  }

  function remember(convId) {
    try { chrome.storage.local.set({ nsp_chat_last: convId || '' }); } catch (e) {}
  }

  function paintBusy() {
    document.body.dataset.busy = S.busy ? '1' : '0';
    var sendBtn = $('send');
    sendBtn.title = S.busy ? 'Stop (Esc)' : 'Send (Enter)';
    sendBtn.setAttribute('aria-label', S.busy ? 'Stop' : 'Send');
    sendBtn.disabled = !S.busy && !$('input').value.trim();
  }

  function showTyping(on, label) {
    if (S.typing) { S.typing.remove(); S.typing = null; }
    if (!on) return;
    var t = node('div', 'typing');
    t.appendChild(node('i'));
    t.appendChild(node('i'));
    t.appendChild(node('i'));
    t.appendChild(node('span', '', label || 'Thinking'));
    S.typing = t;
    $('messages').appendChild(t);
    scrollDown();
  }

  function msgEl(row) {
    var box;
    if (row.role === 'user') {
      box = node('div', 'msg user');
      box.appendChild(node('div', 'bubble', row.text));
    } else if (row.role === 'assistant') {
      box = node('div', 'msg assistant');
      var body = node('div', 'body');
      body.appendChild(RENDER.render(row.text));
      box.appendChild(body);
      var m = row.meta || {};
      if (m.provider || m.model) {
        var bits = [modelLabel(m.provider, m.model)];
        if (m.ms) bits.push((m.ms / 1000).toFixed(1) + ' s');
        box.appendChild(node('div', 'meta', bits.join(' · ')));
      }
    } else if (row.role === 'action') {
      var meta = row.meta || {};
      box = node('div', 'card');
      box.dataset.status = meta.status === 'running' ? 'running' : (meta.status === 'failed' ? 'failed' : 'done');
      box.appendChild(node('span', 'dot'));
      var inner = node('div', 'card-text');
      inner.appendChild(node('div', 'what', row.text));
      if (meta.detail) inner.appendChild(node('div', 'detail', meta.detail));
      box.appendChild(inner);
    } else {
      box = node('div', 'msg error');
      var b = node('div', 'bubble', row.text);
      box.appendChild(b);
      if (row.meta && row.meta.fix === 'setup') {
        var fix = node('div', 'fix');
        var btn = node('button', 'linkish', 'Open Setup');
        btn.type = 'button';
        btn.addEventListener('click', function () { openPage('setup/setup.html'); });
        fix.appendChild(btn);
        box.appendChild(fix);
      }
    }
    return box;
  }

  function drawMsg(row) {
    var el = msgEl(row);
    var old = row.id != null ? S.els[row.id] : null;
    if (old && old.parentNode) old.parentNode.replaceChild(el, old);
    else if (S.typing) $('messages').insertBefore(el, S.typing);
    else $('messages').appendChild(el);
    if (row.id != null) S.els[row.id] = el;
    return el;
  }

  function drawThread() {
    var list = $('messages');
    while (list.firstChild) list.removeChild(list.firstChild);
    S.els = {};
    S.typing = null;
    S.msgs.forEach(drawMsg);
    var empty = S.view === 'chat' && !S.msgs.length;
    $('empty').hidden = !empty;
    list.hidden = S.view !== 'chat' || (empty && !S.busy);
    $('voice-view').hidden = S.view !== 'voice';
    if (empty) $('thread').scrollTop = 0;
    else scrollDown();
    if (S.busy && S.conv && S.view === 'chat') showTyping(true, S.running[S.conv.id] || 'Thinking');
  }

  function paintTitle() {
    var title = S.view === 'voice' ? 'Voice' : (S.conv ? S.conv.title : 'New chat');
    $('conv-title').textContent = title;
    document.title = S.view === 'voice' ? 'ZERACK Voice' : 'ZERACK Chat';
    $('voice-conv').classList.toggle('on', S.view === 'voice');
    $('hint').textContent = S.view === 'voice'
      ? 'Phrases stay in this Chrome session and are gone when Chrome closes. Typing here starts a new chat.'
      : 'History stays on this computer. Each answer names the provider it went to.';
  }

  function drawList() {
    var box = $('conv-list');
    while (box.firstChild) box.removeChild(box.firstChild);
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var group = '';
    S.convs.forEach(function (c) {
      var g = c.updatedAt >= start.getTime() ? 'Today' : 'Earlier';
      if (g !== group) { box.appendChild(node('div', 'group', g)); group = g; }
      var row = node('div', 'conv-row' + (S.view === 'chat' && S.conv && S.conv.id === c.id ? ' on' : ''));
      var open = node('button', 'conv');
      open.type = 'button';
      open.appendChild(node('span', 'conv-title', c.title || 'New chat'));
      open.addEventListener('click', function () { S.moves++; openConv(c.id); closeList(); });
      var trash = node('button', 'trash', 'Delete');
      trash.type = 'button';
      trash.title = 'Delete this chat';
      trash.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!trash.classList.contains('armed')) {
          trash.classList.add('armed');
          trash.textContent = 'Sure?';
          setTimeout(function () { trash.classList.remove('armed'); trash.textContent = 'Delete'; }, 3000);
          return;
        }
        deleteConv(c.id);
      });
      row.appendChild(open);
      row.appendChild(trash);
      box.appendChild(row);
    });
    $('voice-dot').hidden = !S.wake;
  }

  function loadList() {
    return STORE.listConversations().then(function (list) {
      S.convs = list;
      drawList();
      return list;
    }, function (e) {
      console.warn('[ZERACK chat] could not read the history:', e && e.message);
      S.convs = [];
      drawList();
      return [];
    });
  }

  function syncBusy() {
    S.busy = !!(S.conv && S.running[S.conv.id]);
    paintBusy();
  }

  function openConv(id) {
    S.view = 'chat';
    return STORE.getConversation(id).then(function (conv) {
      if (!conv) { newChat(); return; }
      S.conv = conv;
      remember(conv.id);
      return STORE.getMessages(conv.id).then(function (rows) {
        if (!S.conv || S.conv.id !== conv.id || S.view !== 'chat') return;
        S.msgs = rows;
        syncBusy();
        paintTitle();
        drawThread();
        drawList();
      });
    });
  }

  function newChat() {
    S.view = 'chat';
    S.conv = null;
    S.msgs = [];
    syncBusy();
    remember('');
    paintTitle();
    drawThread();
    drawList();
    $('input').focus();
  }

  function deleteConv(id) {
    halt({ convId: id, silent: true });
    STORE.deleteConversation(id).then(function () {
      if (S.conv && S.conv.id === id) newChat();
      announce(id);
      loadList();
    });
  }

  function ensureConv() {
    if (S.conv) return Promise.resolve(S.conv);
    return STORE.createConversation({}).then(function (conv) {
      S.conv = conv;
      remember(conv.id);
      return conv;
    });
  }

  function place(row) {
    if (!row || !S.conv || row.convId !== S.conv.id || S.view !== 'chat') return;
    var i = -1;
    for (var k = 0; k < S.msgs.length; k++) if (S.msgs[k].id === row.id) i = k;
    if (i >= 0) S.msgs[i] = row;
    else S.msgs.push(row);
    var stick = nearBottom();
    drawMsg(row);
    $('empty').hidden = true;
    $('messages').hidden = false;
    if (stick || row.role === 'user') scrollDown();
  }

  function append(role, text, meta) {
    var conv = S.conv;
    return STORE.appendMessage(conv.id, { role: role, text: text, meta: meta || null }).then(function (row) {
      if (!row) return null;
      place(row);
      if (role === 'user' && !conv.titled) { conv.title = String(text).replace(/\s+/g, ' ').trim().slice(0, 80); conv.titled = true; paintTitle(); }
      announce(conv.id);
      return row;
    });
  }

  function gone(convId) {
    delete S.running[convId];
    if (S.conv && S.conv.id === convId) newChat();
    loadList();
  }

  function submit(raw) {
    var text = String(raw == null ? $('input').value : raw).trim();
    if (!text || S.busy) return;
    S.moves++;
    $('input').value = '';
    autosize();
    if (S.view !== 'chat') { S.view = 'chat'; S.conv = null; S.msgs = []; paintTitle(); drawThread(); }
    ensureConv().then(function (conv) {
      S.running[conv.id] = 'Thinking';
      syncBusy();
      return append('user', text).then(function (row) {
        if (!row) { gone(conv.id); return null; }
        loadList();
        if (S.conv && S.conv.id === conv.id) showTyping(true, 'Thinking');
        return send({ type: 'NSP_CHAT_RUN', convId: conv.id, text: text, lang: textLang(text), tabLang: navigator.language || '' }).then(function (res) {
          if (res && res.ok === true) { watchRuns(); return; }
          delete S.running[conv.id];
          syncBusy();
          showTyping(false);
          if (S.conv && S.conv.id === conv.id) append('error', res && res.error === 'busy' ? 'This chat is still answering. Wait for it, or press Stop.' : 'ZERACK did not take the message. Try again.');
        });
      });
    }).catch(function (e) {
      if (S.conv) delete S.running[S.conv.id];
      syncBusy();
      showTyping(false);
      if (S.conv) append('error', 'Something went wrong: ' + String((e && e.message) || e));
    });
  }

  function runEvent(d) {
    var id = String(d.convId || '');
    var mine = !!(S.conv && S.conv.id === id && S.view === 'chat');
    if (d.row) { place(d.row); if (d.row.role !== 'action') loadList(); }
    if (typeof d.typing === 'string' && !d.done) {
      if (S.running[id] || mine) S.running[id] = d.typing || 'Thinking';
      if (mine) { syncBusy(); showTyping(!!d.typing, d.typing); }
    }
    if (d.done) {
      delete S.running[id];
      if (mine) { showTyping(false); syncBusy(); }
      loadList();
      if (MODE === 'overlay') send({ type: 'NSP_CHAT_OVERLAY', op: 'settled' });
    }
  }

  function readRuns() {
    return send({ type: 'NSP_CHAT_RUNS' }).then(function (res) {
      if (!res || !res.runs) return;
      var live = res.runs;
      Object.keys(S.running).forEach(function (id) { if (!live[id]) delete S.running[id]; });
      Object.keys(live).forEach(function (id) { S.running[id] = String(live[id] || 'Thinking'); });
      var was = S.busy;
      syncBusy();
      if (S.conv && S.view === 'chat') {
        if (S.busy) showTyping(true, S.running[S.conv.id]);
        else if (was) { showTyping(false); openConv(S.conv.id); }
      }
    });
  }

  function watchRuns() {
    clearInterval(S.watch);
    S.watch = setInterval(function () {
      if (!Object.keys(S.running).length) { clearInterval(S.watch); S.watch = 0; return; }
      readRuns();
    }, WATCH_MS);
  }

  function halt(opts) {
    var msg = { type: 'NSP_CHAT_HALT' };
    if (opts.all) msg.all = true;
    else msg.convId = opts.convId;
    if (opts.silent) msg.silent = true;
    if (opts.all) S.running = {};
    else delete S.running[opts.convId];
    syncBusy();
    showTyping(false);
    return send(msg);
  }

  function stopRun() {
    if (!S.conv || !S.running[S.conv.id]) return;
    halt({ convId: S.conv.id });
  }

  function autosize() {
    var t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(180, t.scrollHeight) + 'px';
    paintBusy();
  }

  function openPage(path) {
    try { chrome.tabs.create({ url: chrome.runtime.getURL(path) }); } catch (e) {}
  }

  function openList() {
    $('app').classList.add('list-open');
    $('scrim').hidden = false;
  }

  function closeList() {
    $('app').classList.remove('list-open');
    $('scrim').hidden = true;
  }

  function paintModel() {
    var entry = MODELS ? MODELS.byId(S.selected) : null;
    var label = entry ? entry.label : 'Auto';
    if (entry && entry.provider === 'ollama' && S.localModel) label = 'Local ' + S.localModel;
    $('model-label').textContent = label;
    $('model-pill').title = 'Model: ' + label;
  }

  function drawModelMenu() {
    var menu = $('model-menu');
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    if (!MODELS) return;
    var item = function (entry, enabled) {
      var b = node('button', 'menu-item' + (entry.id === S.selected ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', entry.id === S.selected ? 'true' : 'false');
      b.appendChild(node('span', '', entry.provider === 'ollama' && S.localModel ? 'Local model, ' + S.localModel : entry.label));
      b.appendChild(node('span', 'note', enabled ? entry.note : 'Add a key in Setup'));
      if (!enabled) b.disabled = true;
      b.addEventListener('click', function () {
        chrome.storage.local.set({ nsp_selected_model: entry.id, nsp_preferred_provider: entry.provider || 'auto' });
        S.selected = entry.id;
        paintModel();
        toggleModelMenu(false);
      });
      menu.appendChild(b);
    };
    item(MODELS.byId('auto'), true);
    PROVIDERS.forEach(function (p) {
      var list = MODELS.byProvider(p.id);
      if (!list.length) return;
      menu.appendChild(node('div', 'menu-head', p.label));
      list.forEach(function (entry) { item(entry, !!S.configured[p.id]); });
    });
  }

  function toggleModelMenu(on) {
    var menu = $('model-menu');
    var show = typeof on === 'boolean' ? on : menu.hidden;
    if (show) {
      toggleMore(false);
      send({ type: 'NSP_CHAT_PROVIDERS' }).then(function (res) {
        if (res && res.configured) { S.configured = res.configured; S.localModel = res.localModel || ''; }
        drawModelMenu();
      });
      drawModelMenu();
    }
    menu.hidden = !show;
    $('model-pill').setAttribute('aria-expanded', show ? 'true' : 'false');
  }

  function toggleMore(on) {
    var menu = $('more-menu');
    var show = typeof on === 'boolean' ? on : menu.hidden;
    if (show) {
      toggleModelMenu(false);
      var has = !!S.conv && S.view === 'chat';
      menu.querySelector('[data-act="rename"]').hidden = !has;
      menu.querySelector('[data-act="delete"]').hidden = !has;
      var hide = menu.querySelector('[data-act="hide-site"]');
      hide.hidden = MODE !== 'overlay' || !S.host;
      hide.textContent = 'Hide the bubble on ' + (S.host || 'this site');
      menu.querySelector('[data-act="close"]').hidden = MODE !== 'overlay';
      menu.querySelector('[data-act="clear-voice"]').hidden = S.view !== 'voice';
      Array.prototype.forEach.call(menu.querySelectorAll('.armed'), function (b) { b.classList.remove('armed'); });
      menu.querySelector('[data-act="delete-all"]').textContent = 'Delete all conversations';
      menu.querySelector('[data-act="delete"]').textContent = 'Delete this chat';
    }
    menu.hidden = !show;
    $('btn-more').setAttribute('aria-expanded', show ? 'true' : 'false');
  }

  function armed(btn, label) {
    if (btn.classList.contains('armed')) return true;
    btn.classList.add('armed');
    btn.textContent = label;
    return false;
  }

  function watchSeen(el, key) {
    if (MODE !== 'overlay' || !el || typeof IntersectionObserver !== 'function') return;
    try {
      var io = new IntersectionObserver(function (list) {
        list.forEach(function (en) {
          var ok = en.isVisible === true;
          S.seen[key] = ok ? (S.seen[key] || Date.now()) : 0;
        });
      }, { threshold: [1], trackVisibility: true, delay: 100 });
      io.observe(el);
    } catch (e) {}
  }

  function trusted(key, label) {
    if (MODE !== 'overlay') return true;
    var since = S.seen[key];
    if (since && Date.now() - since >= SEEN_MS) return true;
    var hint = $('hint');
    hint.textContent = (label || GUARDED[key] || 'This') + ' only works while the chat is fully in view. The page is covering it, so use the ZERACK button in the toolbar instead.';
    hint.classList.add('warn');
    setTimeout(function () { hint.classList.remove('warn'); paintTitle(); }, 5000);
    return false;
  }

  function moreAction(act, btn) {
    if (GUARDED[act] && !trusted('menu', GUARDED[act])) return;
    if (act === 'rename') { toggleMore(false); startRename(); return; }
    if (act === 'delete') {
      if (!armed(btn, 'Click again to delete this chat')) return;
      toggleMore(false);
      if (S.conv) deleteConv(S.conv.id);
      return;
    }
    if (act === 'delete-all') {
      if (!armed(btn, 'Click again to delete every chat')) return;
      toggleMore(false);
      halt({ all: true, silent: true });
      STORE.clearAll().then(function () { announce(''); newChat(); loadList(); });
      return;
    }
    if (act === 'clear-voice') {
      if (!armed(btn, 'Click again to clear the voice history')) return;
      toggleMore(false);
      try { chrome.storage.session.remove('nsp_voice_log', drawVoice); } catch (e) {}
      return;
    }
    toggleMore(false);
    if (act === 'hide-site') { send({ type: 'NSP_CHAT_OVERLAY', op: 'hide_site' }); return; }
    if (act === 'setup') { openPage('setup/setup.html'); return; }
    if (act === 'close') closeOverlay();
  }

  function startRename() {
    if (!S.conv || S.view !== 'chat') return;
    var input = $('title-edit');
    input.value = S.conv.title || '';
    $('conv-title').hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  }

  function endRename(save) {
    var input = $('title-edit');
    if (input.hidden) return;
    input.hidden = true;
    $('conv-title').hidden = false;
    var title = input.value.replace(/\s+/g, ' ').trim();
    if (!save || !title || !S.conv || title === S.conv.title) return;
    STORE.renameConversation(S.conv.id, title).then(function (conv) {
      if (conv && S.conv && S.conv.id === conv.id) S.conv = conv;
      paintTitle();
      announce(conv && conv.id);
      loadList();
    });
  }

  function closeOverlay() {
    if (MODE === 'overlay') send({ type: 'NSP_CHAT_OVERLAY', op: 'close' });
    else if (MODE === 'window') window.close();
  }

  function clock(ms) {
    var d = new Date(ms);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function voiceRowEl(row) {
    var acted = !!row.action;
    var box = node('div', 'vrow ' + (acted ? 'acted' : 'dropped'));
    box.appendChild(node('div', 'when', clock(row.at) + (row.ms ? '  ·  ' + (row.ms / 1000).toFixed(2) + ' s after you stopped' : '')));
    box.appendChild(node('div', row.text ? 'heard' : 'heard none', row.text ? '“' + row.text + '”' : 'Nothing heard'));
    var did;
    if (acted) {
      did = 'Did: ' + String(row.action).split('+').map(function (k) { return ACTION_WORDS[k] || k; }).join(', then ') + '.';
    } else {
      did = DROP_WORDS[row.reason] || ('Ignored: ' + String(row.reason || 'unknown reason') + '.');
    }
    box.appendChild(node('div', 'did', did));
    if (row.reply) box.appendChild(node('div', 'reply', row.reply));
    else if (row.error) box.appendChild(node('div', 'reply err', 'No answer: ' + (ERRORS[row.error] || row.error)));
    return box;
  }

  function drawVoice() {
    if (S.view !== 'voice') return;
    var view = $('voice-view');
    try {
      chrome.storage.session.get('nsp_voice_log', function (r) {
        var list = (!chrome.runtime.lastError && r && Array.isArray(r.nsp_voice_log)) ? r.nsp_voice_log : [];
        var stick = nearBottom();
        while (view.firstChild) view.removeChild(view.firstChild);
        if (!list.length) {
          view.appendChild(node('div', 'voice-empty', 'Nothing heard yet in this Chrome session. Hold the bubble or the mic and speak, or turn on Hands-free.'));
          return;
        }
        view.appendChild(node('div', 'voice-note', 'What ZERACK heard, what it did, and why it ignored a phrase. The last 100 phrases, newest at the bottom.'));
        list.forEach(function (row) { if (row && typeof row === 'object') view.appendChild(voiceRowEl(row)); });
        if (stick) scrollDown();
      });
    } catch (e) {}
  }

  function openVoice() {
    S.view = 'voice';
    S.conv = null;
    S.msgs = [];
    syncBusy();
    paintTitle();
    drawThread();
    drawList();
    drawVoice();
    closeList();
    scrollDown();
  }

  function paintVoice() {
    var mic = $('mic');
    var state = S.voice;
    if (S.mic.down && state !== 'hearing') state = 'listening';
    mic.dataset.state = state;
    mic.classList.toggle('down', !!S.mic.down);
    var hf = $('hf');
    hf.setAttribute('aria-checked', S.wake ? 'true' : 'false');
    $('voice-dot').hidden = !S.wake;
  }

  function micHeard(state) {
    if (!S.mic.open) return;
    if (state === 'listening' || state === 'hearing') S.mic.seen = true;
    else if (S.mic.seen || Date.now() - S.mic.open > 15000) { S.mic.open = 0; S.mic.seen = false; }
  }

  function micDown(e) {
    if (e.button !== 0 || !e.isTrusted) return;
    e.preventDefault();
    if (S.mic.open) {
      S.mic.open = 0;
      S.mic.seen = false;
      send({ type: 'NSP_VOICE_PTT_END' });
      paintVoice();
      return;
    }
    S.mic.down = Date.now();
    S.mic.id = e.pointerId;
    try { $('mic').setPointerCapture(e.pointerId); } catch (x) {}
    send({ type: 'NSP_VOICE_PTT_START' });
    paintVoice();
  }

  function micUp(e, cancelled) {
    if (!S.mic.down || e.pointerId !== S.mic.id) return;
    var held = Date.now() - S.mic.down >= HOLD_MS;
    S.mic.down = 0;
    S.mic.id = null;
    if (cancelled) send({ type: 'NSP_VOICE_PTT_END', cancel: true });
    else if (held) send({ type: 'NSP_VOICE_PTT_END' });
    else { S.mic.open = Date.now(); S.mic.seen = S.voice === 'listening' || S.voice === 'hearing'; send({ type: 'NSP_VOICE_PTT_START', auto: true }); }
    paintVoice();
  }

  function micCancel() {
    if (!S.mic.down && !S.mic.open) return false;
    S.mic.down = 0;
    S.mic.open = 0;
    S.mic.seen = false;
    send({ type: 'NSP_VOICE_PTT_END', cancel: true });
    paintVoice();
    return true;
  }

  function onEsc(e) {
    if (!$('title-edit').hidden) { endRename(false); return; }
    if (!$('model-menu').hidden || !$('more-menu').hidden) { toggleModelMenu(false); toggleMore(false); return; }
    if ($('app').classList.contains('list-open')) { closeList(); return; }
    if (micCancel()) return;
    if (S.busy) { stopRun(); return; }
    closeOverlay();
    e.preventDefault();
  }

  function bind() {
    var input = $('input');
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') onEsc(e); });
    $('send').addEventListener('click', function () { if (S.busy) stopRun(); else submit(); });
    $('btn-new').addEventListener('click', function () { S.moves++; newChat(); });
    $('side-new').addEventListener('click', function () { S.moves++; newChat(); closeList(); });
    $('voice-conv').addEventListener('click', function () { S.moves++; openVoice(); });
    $('btn-list').addEventListener('click', openList);
    $('side-close').addEventListener('click', closeList);
    $('scrim').addEventListener('click', closeList);
    $('btn-more').addEventListener('click', function (e) { e.stopPropagation(); toggleMore(); });
    $('model-pill').addEventListener('click', function (e) { e.stopPropagation(); toggleModelMenu(); });
    $('more-menu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) { e.stopPropagation(); moreAction(b.getAttribute('data-act'), b); }
    });
    $('model-menu').addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { toggleModelMenu(false); toggleMore(false); });
    $('agent-pill').addEventListener('click', function () {
      if (!trusted('agent-pill')) return;
      var next = !S.agentOn;
      chrome.storage.local.set({ nsp_agent_enabled: next });
      S.agentOn = next;
      paintAgent();
    });
    $('hf').addEventListener('click', function () {
      if (!trusted('hf')) return;
      S.wake = !S.wake;
      paintVoice();
      send({ type: 'NSP_VOICE_WAKE_TOGGLE' });
    });
    $('btn-close').addEventListener('click', closeOverlay);
    watchSeen($('agent-pill'), 'agent-pill');
    watchSeen($('hf'), 'hf');
    watchSeen($('more-menu'), 'menu');
    var mic = $('mic');
    mic.addEventListener('pointerdown', micDown);
    mic.addEventListener('pointerup', function (e) { micUp(e, false); });
    mic.addEventListener('pointercancel', function (e) { micUp(e, true); });
    mic.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (chip) {
      chip.addEventListener('click', function () { submit(chip.textContent); });
    });
    var title = $('title-edit');
    title.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); endRename(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endRename(false); }
    });
    title.addEventListener('blur', function () { endRename(true); });
    $('conv-title').addEventListener('dblclick', startRename);

    chrome.runtime.onMessage.addListener(function (msg, sender) {
      if (!msg || !sender || sender.id !== chrome.runtime.id) return false;
      if (msg.type === 'NSP_VOICE_STATE' && !msg.flash && typeof msg.state === 'string') {
        S.voice = msg.state;
        if (typeof msg.wake === 'boolean') S.wake = msg.wake;
        micHeard(msg.state);
        paintVoice();
      }
      return false;
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'session' && changes.nsp_voice_log) { drawVoice(); voiceAnswer(changes.nsp_voice_log.newValue); }
      if (area !== 'local') return;
      if (changes.nsp_agent_enabled) { S.agentOn = changes.nsp_agent_enabled.newValue === true; paintAgent(); }
      if (changes.nsp_selected_model) { S.selected = String(changes.nsp_selected_model.newValue || 'auto'); paintModel(); }
      if (changes.nsp_voice_wake) { S.wake = changes.nsp_voice_wake.newValue === true; paintVoice(); }
    });
    if (channel) {
      channel.onmessage = function (ev) {
        var d = (ev && ev.data) || {};
        if (d.row || d.done || typeof d.typing === 'string') { runEvent(d); return; }
        var id = d.convId;
        loadList();
        if (!S.busy && S.view === 'chat' && S.conv && (!id || id === S.conv.id)) openConv(S.conv.id);
      };
    }
  }

  function paintAgent() {
    var pill = $('agent-pill');
    pill.setAttribute('aria-checked', S.agentOn ? 'true' : 'false');
    $('agent-label').textContent = S.agentOn ? 'Agent on' : 'Agent off';
  }

  function freshVoice(list, since) {
    var rows = Array.isArray(list) ? list : [];
    for (var i = rows.length - 1; i >= 0; i--) {
      var row = rows[i];
      if (!row || row.action !== 'assistant') continue;
      var at = Number(row.at) || 0;
      return (row.reply || row.error) && at > since && Date.now() - at < VOICE_FRESH_MS ? at : 0;
    }
    return 0;
  }

  function voiceAnswer(list) {
    var at = freshVoice(list, S.voiceSeen);
    if (!at || S.busy || S.view !== 'chat' || S.msgs.length || $('input').value.trim()) return;
    S.voiceSeen = at;
    openVoice();
  }

  function start(hello) {
    S.host = (hello && hello.host) || '';
    document.body.dataset.mode = MODE;
    document.body.dataset.ready = '1';
    $('app').hidden = false;
    bind();
    paintBusy();
    chrome.storage.local.get(['nsp_agent_enabled', 'nsp_selected_model', 'nsp_voice_wake', 'nsp_chat_last', 'nsp_ollama_model'], function (r) {
      r = r || {};
      S.agentOn = r.nsp_agent_enabled === true;
      S.selected = typeof r.nsp_selected_model === 'string' ? r.nsp_selected_model : 'auto';
      S.wake = r.nsp_voice_wake === true;
      S.localModel = typeof r.nsp_ollama_model === 'string' ? r.nsp_ollama_model : '';
      paintAgent();
      paintModel();
      paintVoice();
      var moves = S.moves;
      loadList().then(function () {
        var last = typeof r.nsp_chat_last === 'string' ? r.nsp_chat_last : '';
        var conv = null;
        S.convs.forEach(function (c) { if (c.id === last) conv = c; });
        try {
          chrome.storage.session.get('nsp_voice_log', function (v) {
            if (S.moves !== moves) { readRuns(); return; }
            var at = freshVoice(!chrome.runtime.lastError && v ? v.nsp_voice_log : [], conv ? Number(conv.updatedAt) || 0 : 0);
            if (at) { S.voiceSeen = at; openVoice(); }
            else if (conv) openConv(last);
            else newChat();
            readRuns().then(function () { if (Object.keys(S.running).length) watchRuns(); });
          });
        } catch (e) {
          if (conv) openConv(last); else newChat();
        }
      });
    });
    send({ type: 'NSP_CHAT_PROVIDERS' }).then(function (res) {
      if (res && res.configured) { S.configured = res.configured; S.localModel = res.localModel || S.localModel; paintModel(); }
    });
    send({ type: 'NSP_VOICE_STATE_GET' }).then(function (res) {
      if (res && typeof res.state === 'string') { S.voice = res.state; S.wake = res.wake === true; paintVoice(); }
    });
    setTimeout(function () { $('input').focus(); }, 50);
  }

  if (!STORE || !RENDER) {
    console.warn('[ZERACK chat] a script did not load');
    return;
  }
  send({ type: 'NSP_CHAT_HELLO', token: TOKEN }).then(function (res) {
    if (res && res.ok === true) start(res);
    else document.body.dataset.ready = 'refused';
  });
})();
