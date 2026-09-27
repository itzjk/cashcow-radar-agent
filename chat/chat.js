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
  var GUARDED = { 'agent-pill': 'The Agent switch', hf: 'Hands-free', 'delete': 'Deleting', 'delete-all': 'Deleting', 'clear-voice': 'Clearing', 'site-allow': 'Allowing a site', 'site-forget': 'Changing a site' };
  var PRESS_MIN_MS = 500;
  var ROLE_SUFFIX = { button: '', link: ' link', textbox: ' field', searchbox: ' search box', combobox: ' menu', listbox: ' list', tab: ' tab', checkbox: ' checkbox', 'switch': ' switch', radio: ' option', option: '', menuitem: '', menuitemradio: '', menuitemcheckbox: '' };
  var PRESS_VERBS = { Pay: 'Pay', Publish: 'Publish', Send: 'Send', Delete: 'Delete', Fulfill: 'Fulfill' };
  var PRESS_WHY = { Pay: 'It moves money.', Publish: 'It changes what the public sees.', Send: 'It sends something in your name.', Delete: 'It removes something for good.', Fulfill: 'It tells the buyer the order is on its way.' };
  var PRESS_DONE = {
    done: 'You pressed it and it ran.',
    failed: 'You pressed it, but it did not run.',
    declined: 'You cancelled it. Nothing was done.',
    expired: 'Nobody pressed within 2 minutes. Nothing was done.',
    stopped: 'The chat was stopped. Nothing was done.'
  };
  var WEB_CHIPS = ['What can you do on this page?', 'Read this page and tell me what to fix first', 'Improve the text on this page', 'Open YouTube'];
  var YT_CHIPS = ['Open YouTube', 'What niche should I start this week?', 'Read my saved niches and pick the best one', 'How do I raise my click-through rate?'];

  var $ = function (id) { return document.getElementById(id); };
  var S = {
    conv: null, convs: [], msgs: [], view: 'chat', busy: false, running: {}, agentOn: false, wake: false, voice: 'idle',
    configured: {}, localModel: '', selected: 'auto', host: '', els: {}, typing: null, mic: { down: 0, open: 0, seen: false, id: null },
    seen: {}, watch: 0, voiceSeen: 0, moves: 0, windowId: -1, site: null, drawn: {}, clock: 0, gates: 0
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

  function mmss(ms) {
    var sec = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }

  function humanRoles(s) {
    return s.replace(/\b([a-z]+) ("[^"]*")/g, function (all, role, name) {
      return ROLE_SUFFIX.hasOwnProperty(role) ? name + ROLE_SUFFIX[role] : all;
    });
  }

  function splitLine(line) {
    var m = /^([A-Za-z]+): (.+) on (\S+)$/.exec(String(line || ''));
    if (!m) return { what: String(line || ''), where: '' };
    var what = m[2];
    var typed = /^send what was typed in (.+)$/.exec(what);
    var picked = /^pick (".*") in (.+)$/.exec(what);
    if (typed) what = 'Send what ZERACK typed in the ' + humanRoles(typed[1]);
    else if (picked) what = 'Choose ' + picked[1] + ' in the ' + humanRoles(picked[2]);
    else what = humanRoles(what).replace(/^click /, 'Click ').replace(/^pick /, 'Choose ');
    return { what: what, where: m[3] };
  }

  function pressLive(row) {
    var m = row.meta || {};
    return m.status === 'waiting' && Number(m.until) > Date.now() && !!m.pressId;
  }

  function watchGate(el, key) {
    if (MODE !== 'overlay' || !el || typeof IntersectionObserver !== 'function') return;
    watchSeen(el, key);
  }

  function pressable(key, rowId) {
    var drawn = S.drawn[rowId] || 0;
    if (!drawn || Date.now() - drawn < PRESS_MIN_MS) return false;
    return trusted(key, 'The press');
  }

  function answerPress(row, yes, box) {
    var m = row.meta || {};
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.disabled = true; });
    box.dataset.sending = '1';
    send({ type: 'NSP_CHAT_CONFIRM', convId: row.convId, pressId: m.pressId, yes: yes }).then(function (res) {
      if (res && res.ok === true) return;
      var meta = Object.assign({}, m, { status: 'expired', detail: 'This press is no longer waiting, so nothing was done.' });
      row.meta = meta;
      STORE.updateMessage(row.id, { meta: meta }).then(function () { place(row); });
    });
  }

  function pressEl(row) {
    var m = row.meta || {};
    var live = pressLive(row);
    var status = live ? 'waiting' : (m.status === 'waiting' ? 'expired' : String(m.status || 'expired'));
    var kind = PRESS_VERBS[m.kind] ? m.kind : 'Act';
    var parts = splitLine(row.text);
    var box = node('div', 'gate press');
    box.dataset.status = status;
    box.dataset.kind = kind.toLowerCase();
    var head = node('div', 'gate-head');
    head.appendChild(node('span', 'gate-kind', kind));
    head.appendChild(node('span', 'gate-title', live ? 'Needs your press' : (status === 'done' ? 'Pressed' : 'Not done')));
    if (live) head.appendChild(node('span', 'gate-clock', mmss(Number(m.until) - Date.now())));
    box.appendChild(head);
    box.appendChild(node('div', 'gate-what', parts.what));
    if (parts.where) box.appendChild(node('div', 'gate-where', parts.where));
    if (m.evidence) {
      var ev = node('div', 'gate-evidence');
      ev.appendChild(node('span', 'gate-evidence-tag', 'Evidence'));
      ev.appendChild(node('span', 'gate-evidence-text', String(m.evidence)));
      box.appendChild(ev);
    }
    if (m.lead) {
      var ld = node('div', 'gate-evidence lead');
      ld.appendChild(node('span', 'gate-evidence-tag', 'Lead'));
      ld.appendChild(node('span', 'gate-evidence-text', String(m.lead)));
      box.appendChild(ld);
    }
    if (live) {
      var acts = node('div', 'gate-actions');
      var go = node('button', 'gate-go', PRESS_VERBS[m.kind] || 'Do it');
      go.type = 'button';
      var no = node('button', 'gate-no', 'Cancel');
      no.type = 'button';
      var key = 'gate-' + row.id + '-' + (++S.gates);
      go.addEventListener('click', function (e) {
        if (!e.isTrusted || !pressable(key, row.id)) return;
        answerPress(row, true, box);
      });
      no.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        answerPress(row, false, box);
      });
      acts.appendChild(go);
      acts.appendChild(no);
      box.appendChild(acts);
      box.appendChild(node('div', 'gate-note', (PRESS_WHY[m.kind] ? PRESS_WHY[m.kind] + ' ' : '') + 'ZERACK does it only after you press, and gives up when the countdown ends.'));
      watchGate(go, key);
    } else {
      var note = PRESS_DONE[status] || PRESS_DONE.expired;
      if (status === 'failed' && m.detail) note = 'You pressed it, but it did not run: ' + m.detail;
      else if (status === 'done' && m.detail) note = m.detail.indexOf('Done.') === 0 ? 'You pressed it. ' + m.detail : note;
      box.appendChild(node('div', 'gate-note', note));
    }
    return box;
  }

  function askSite(row, mode, box) {
    var m = row.meta || {};
    var pattern = String(m.pattern || '');
    var buttons = box.querySelectorAll('button');
    Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
    var fail = function (why) {
      Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
      var n = box.querySelector('.gate-note');
      if (n) n.textContent = why;
    };
    var granted;
    try { granted = chrome.permissions.request({ origins: [pattern] }); } catch (e) { fail('Chrome did not ask for access: ' + String((e && e.message) || e)); return; }
    Promise.resolve(granted).then(function (ok) {
      if (ok !== true) { fail('Chrome access was not given, so ZERACK stays off ' + m.host + '.'); return; }
      return send({ type: 'NSP_CHAT_ALLOW_SITE', host: m.host, pattern: pattern, mode: mode }).then(function (res) {
        if (!res || res.ok !== true) { fail('ZERACK could not save the permission. Try again.'); return; }
        var meta = Object.assign({}, m, { status: mode === 'read' ? 'read' : 'allowed' });
        row.meta = meta;
        return STORE.updateMessage(row.id, { meta: meta }).then(function () { place(row); announce(row.convId); });
      });
    }, function (e) { fail('Chrome did not ask for access: ' + String((e && e.message) || e)); });
  }

  function allowEl(row) {
    var m = row.meta || {};
    var host = String(m.host || row.text || 'this site');
    var status = m.status === 'allowed' || m.status === 'read' ? m.status : 'waiting';
    var box = node('div', 'gate allow');
    box.dataset.status = status;
    var head = node('div', 'gate-head');
    var mark = node('img', 'gate-mark');
    mark.src = '../icons/zerack-mark-small.svg';
    mark.alt = '';
    head.appendChild(mark);
    head.appendChild(node('span', 'gate-title', status === 'waiting' ? (m.need === 'act' && m.status !== 'read' ? 'Let ZERACK work on ' + host + '?' : 'Let ZERACK read ' + host + '?') : (status === 'allowed' ? 'ZERACK can work on ' + host : 'ZERACK can read ' + host)));
    box.appendChild(head);
    if (status === 'waiting') {
      box.appendChild(node('div', 'gate-what', 'It reads this site and clicks, types and chooses on it for you. Saving, publishing, sending, deleting and paying still wait for your press here, and moving money out is never done.'));
      var acts = node('div', 'gate-actions');
      var go = node('button', 'gate-go', 'Allow on ' + host);
      go.type = 'button';
      var alt = node('button', 'gate-no', 'Read only');
      alt.type = 'button';
      var key = 'allow-' + row.id + '-' + (++S.gates);
      go.addEventListener('click', function (e) {
        if (!e.isTrusted || !pressable(key, row.id)) return;
        askSite(row, 'act', box);
      });
      alt.addEventListener('click', function (e) {
        if (!e.isTrusted || !pressable(key, row.id)) return;
        askSite(row, 'read', box);
      });
      acts.appendChild(go);
      if (m.need !== 'act') acts.appendChild(alt);
      box.appendChild(acts);
      box.appendChild(node('div', 'gate-note', 'You can take it back any time from the menu at the top.'));
      watchGate(go, key);
    } else {
      box.appendChild(node('div', 'gate-what', status === 'allowed' ? 'Saving, publishing, sending, deleting and paying still wait for your press.' : 'It can read this site but not act on it.'));
      if (!m.continued) {
        var more = node('div', 'gate-actions');
        var cont = node('button', 'gate-go', 'Continue');
        cont.type = 'button';
        cont.addEventListener('click', function (e) {
          if (!e.isTrusted || S.busy) return;
          var meta = Object.assign({}, m, { continued: true });
          row.meta = meta;
          STORE.updateMessage(row.id, { meta: meta }).then(function () { place(row); });
          submit('Continue');
        });
        more.appendChild(cont);
        box.appendChild(more);
      }
    }
    return box;
  }

  var DECIDE_STATES = { keep: 'KEEP', look: 'LOOK AT IT', drop: 'DROP' };

  function missingEl(parent, list, head, foot) {
    var wrap = node('div', 'missing');
    wrap.appendChild(node('div', 'missing-head', head));
    var ul = node('ul', 'missing-list');
    list.slice(0, 5).forEach(function (t) { ul.appendChild(node('li', '', String(t))); });
    wrap.appendChild(ul);
    if (foot) wrap.appendChild(node('div', 'missing-foot', foot));
    parent.appendChild(wrap);
  }

  function decisionEl(parent, d, card) {
    var state = DECIDE_STATES[d.state] ? d.state : 'look';
    card.classList.add('decide');
    card.dataset.state = state;
    var head = node('div', 'decide-head');
    head.appendChild(node('span', 'state-pill', d.label || DECIDE_STATES[state]));
    head.appendChild(node('span', 'decide-num', String(d.number || '')));
    parent.appendChild(head);
    if (Array.isArray(d.missing) && d.missing.length) missingEl(parent, d.missing, 'Still missing', d.projection ? 'That is ' + d.projection + '.' : '');
    var foot = [];
    var due = /^\d{4}-\d{2}-\d{2}$/.test(String(d.due || '')) ? new Date(d.due + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
    if (d.lessonState === 'firm') foot.push('Lesson kept');
    else if (due) foot.push('Re-measure ' + due);
    if (d.from) foot.push('from the ' + (d.from === 'chat' ? 'conversation' : d.from));
    var row = node('div', 'decide-foot');
    row.appendChild(node('span', '', foot.join(' \u00b7 ')));
    var link = node('button', 'decide-link', 'All decisions');
    link.type = 'button';
    link.addEventListener('click', function (e) { if (e.isTrusted) openPage('activity/activity.html#decisions'); });
    row.appendChild(link);
    parent.appendChild(row);
  }

  var BUILD_KICKERS = { requests: 'Repeated requests', askers: 'People asking for it', rivals: 'Rivals', watch: 'Watching', post: 'What to post today', changelog: 'Changelog', launch: 'Launch kit', check: 'Rule check' };
  var OPEN_OK = /^https?:\/\/[^\s]+$/i;
  var INTENT_OK = /^https:\/\/x\.com\/intent\/tweet\?text=/;
  var SUBMIT_OK = /^https:\/\/news\.ycombinator\.com\/submitlink\?u=/;

  function openUrl(url, ok) {
    url = String(url || '');
    if (!(ok || OPEN_OK).test(url)) return;
    try { chrome.tabs.create({ url: url }); } catch (e) {}
  }

  function copyText(text) {
    text = String(text || '');
    var viaArea = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return ok;
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return viaArea(); });
    } catch (e) {}
    return Promise.resolve(viaArea());
  }

  function bldBtn(label, cls, onClick) {
    var b = node('button', 'bld-btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', function (e) { if (e.isTrusted) onClick(b); });
    return b;
  }

  function copyBtn(label, text) {
    return bldBtn(label, '', function (b) {
      copyText(text).then(function (ok) {
        b.textContent = ok ? 'Copied' : 'Copy failed';
        b.classList.toggle('done', !!ok);
        setTimeout(function () { b.textContent = label; b.classList.remove('done'); }, 1600);
      });
    });
  }

  function linkBtn(label, url, ok, cls) {
    return bldBtn(label, cls || '', function () { openUrl(url, ok); });
  }

  function bldHead(parent, kicker, line) {
    var head = node('div', 'bld-head');
    head.appendChild(node('span', 'bld-kicker', kicker));
    parent.appendChild(head);
    if (line) parent.appendChild(node('div', 'bld-line', line));
  }

  function bldSection(parent, title) {
    var sec = node('div', 'bld-sec');
    if (title) sec.appendChild(node('div', 'bld-sec-title', title));
    parent.appendChild(sec);
    return sec;
  }

  function bldSources(parent, list) {
    list = (list || []).filter(function (s) { return s && s.url; });
    if (!list.length) return;
    var foot = node('div', 'bld-sources');
    foot.appendChild(node('span', 'bld-sources-head', 'Sources'));
    list.slice(0, 5).forEach(function (s) {
      var a = node('button', 'bld-src', s.text);
      a.type = 'button';
      a.title = s.url;
      a.addEventListener('click', function (e) { if (e.isTrusted) openUrl(s.url); });
      foot.appendChild(a);
    });
    parent.appendChild(foot);
  }

  function statePill(state, label) {
    var p = node('span', 'state-pill ' + (state === 'keep' ? 'is-keep' : (state === 'drop' ? 'is-drop' : 'is-look')), label || DECIDE_STATES[state] || 'LOOK AT IT');
    return p;
  }

  function bldNum(n) {
    return typeof n === 'number' && isFinite(n) ? n.toLocaleString('en-US') : '';
  }

  function builderEl(parent, b, card) {
    card.classList.add('build');
    card.dataset.kind = String(b.kind || '');
    bldHead(parent, BUILD_KICKERS[b.kind] || 'Builder', b.kind === 'post' || b.kind === 'launch' || (b.kind === 'changelog' && b.markdown) ? '' : b.line);
    if (b.kind === 'requests') {
      (b.clusters || []).forEach(function (c) {
        var row = node('div', 'bld-row');
        var top = node('div', 'bld-row-top');
        top.appendChild(node('span', 'bld-count', String(c.count)));
        top.appendChild(node('span', 'bld-name', c.label));
        row.appendChild(top);
        var chips = node('div', 'bld-chips');
        (c.sources || []).forEach(function (s) { chips.appendChild(node('span', 'bld-chip', s.name + ' ' + s.n)); });
        if (c.people) chips.appendChild(node('span', 'bld-chip ghost', c.people + (c.people === 1 ? ' person' : ' people')));
        row.appendChild(chips);
        (c.examples || []).slice(0, 2).forEach(function (e) {
          var q = node('div', 'bld-quote');
          q.appendChild(node('span', 'bld-quote-text', e.text));
          if (e.url) q.appendChild(linkBtn('Open', e.url, null, 'mini'));
          row.appendChild(q);
        });
        parent.appendChild(row);
      });
      if (!(b.clusters || []).length) parent.appendChild(node('div', 'bld-empty', 'No request repeats yet. Read more issues or threads, then ask again.'));
    } else if (b.kind === 'rivals') {
      (b.rows || []).forEach(function (r) {
        var row = node('div', 'bld-row rival');
        var top = node('div', 'bld-row-top');
        top.appendChild(statePill(r.state, r.label));
        top.appendChild(node('span', 'bld-name', r.name + (r.mine ? ' (yours)' : '')));
        row.appendChild(top);
        var bits = [];
        if (r.now != null) bits.push(bldNum(r.now) + ' ' + r.metric);
        if (r.perDay != null) bits.push((r.perDay >= 0 ? '+' : '') + r.perDay + ' a day');
        bits.push(r.readings + (r.readings === 1 ? ' reading' : ' readings'));
        if (r.watched) bits.push('watched daily');
        row.appendChild(node('div', 'bld-sub', bits.join(' · ')));
        if (r.missing && r.missing[0]) row.appendChild(node('div', 'bld-miss', 'Needs ' + r.missing[0]));
        if (r.url) { var act = node('div', 'bld-actions'); act.appendChild(linkBtn('Open', r.url, null, 'mini')); row.appendChild(act); }
        parent.appendChild(row);
      });
    } else if (b.kind === 'watch') {
      (b.list || []).forEach(function (w) {
        var row = node('div', 'bld-row');
        var top = node('div', 'bld-row-top');
        top.appendChild(node('span', 'bld-dot' + (w.ok ? '' : ' off')));
        top.appendChild(node('span', 'bld-name', w.name));
        row.appendChild(top);
        row.appendChild(node('div', 'bld-sub', w.lastAt ? 'Last read ' + new Date(w.lastAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + (w.ok ? '' : ': ' + w.error) : 'Not read yet'));
        parent.appendChild(row);
      });
    } else if (b.kind === 'post') {
      var decision = node('div', 'bld-decision ' + (b.decision === 'post' ? 'go' : 'skip'));
      decision.appendChild(node('span', 'state-pill ' + (b.decision === 'post' ? 'is-keep' : 'is-look'), b.decision === 'post' ? 'POST' : 'SKIP TODAY'));
      decision.appendChild(node('span', 'bld-why', b.why));
      parent.appendChild(decision);
      if ((b.facts || []).length) {
        var fl = node('ul', 'bld-facts');
        b.facts.forEach(function (f) { fl.appendChild(node('li', '', f)); });
        parent.appendChild(fl);
      }
      (b.drafts || []).forEach(function (d, i) {
        var box = node('div', 'bld-draft');
        box.appendChild(node('div', 'bld-draft-text', d.text));
        var foot = node('div', 'bld-draft-foot');
        var meter = node('span', 'bld-meter' + (d.chars > d.max ? ' over' : ''), d.chars + ' / ' + d.max);
        foot.appendChild(meter);
        var acts = node('div', 'bld-actions');
        acts.appendChild(copyBtn('Copy', d.text));
        if (d.intent && INTENT_OK.test(d.intent)) acts.appendChild(linkBtn(i === 0 ? 'Post on X' : 'Open in X', d.intent, INTENT_OK, i === 0 ? 'primary' : ''));
        foot.appendChild(acts);
        box.appendChild(foot);
        parent.appendChild(box);
      });
      if (b.decision === 'post') parent.appendChild(node('div', 'bld-note', 'X opens with the text filled in. Nothing is posted until you press Post there.'));
      bldSources(parent, [b.source]);
    } else if (b.kind === 'changelog') {
      var ver = node('div', 'bld-version');
      ver.appendChild(node('span', 'bld-tag', b.version && b.version.to ? b.version.to : ''));
      ver.appendChild(node('span', 'bld-why', b.version ? 'Next version' + (b.version.from ? ' after ' + b.version.from : '') + ': ' + b.version.why + '.' : ''));
      parent.appendChild(ver);
      var gchips = node('div', 'bld-chips');
      if (b.commits) gchips.appendChild(node('span', 'bld-chip ghost', b.commits + (b.commits === 1 ? ' commit' : ' commits')));
      (b.groups || []).forEach(function (g) { gchips.appendChild(node('span', 'bld-chip', g.name + ' ' + g.n)); });
      if (b.noise) gchips.appendChild(node('span', 'bld-chip ghost', b.noise + ' left out as noise'));
      parent.appendChild(gchips);
      if (b.feedNote) parent.appendChild(node('div', 'bld-note', b.feedNote));
      if (b.markdown) {
        var pre = node('pre', 'bld-md', b.markdown);
        parent.appendChild(pre);
        var ca = node('div', 'bld-actions');
        ca.appendChild(copyBtn('Copy changelog', b.markdown));
        if (b.notes) ca.appendChild(copyBtn('Copy release notes', b.notes));
        if (b.repo) ca.appendChild(linkBtn('New release', b.repo + '/releases/new', null, 'primary'));
        parent.appendChild(ca);
        parent.appendChild(node('div', 'bld-note', 'Publishing the release on GitHub waits for your press.'));
      }
      bldSources(parent, b.sources);
    } else if (b.kind === 'launch') {
      parent.appendChild(node('div', 'bld-line', b.line));
      var ph = bldSection(parent, 'Product Hunt');
      var tl = node('div', 'bld-kv');
      tl.appendChild(node('span', 'bld-k', 'Name'));
      tl.appendChild(node('span', 'bld-v', b.name));
      ph.appendChild(tl);
      (b.taglines || []).forEach(function (t) {
        var r = node('div', 'bld-pick');
        r.appendChild(node('span', 'bld-pick-text', t.text));
        r.appendChild(node('span', 'bld-meter' + (t.fits ? '' : ' over'), t.chars + ' / 60'));
        r.appendChild(copyBtn('Copy', t.text));
        ph.appendChild(r);
      });
      if (b.description && b.description.text) {
        var dr = node('div', 'bld-pick');
        dr.appendChild(node('span', 'bld-pick-text muted', b.description.text));
        dr.appendChild(node('span', 'bld-meter', b.description.chars + ' / 500'));
        dr.appendChild(copyBtn('Copy', b.description.text));
        ph.appendChild(dr);
      }
      if ((b.gallery || []).length) {
        ph.appendChild(node('div', 'bld-label', 'Gallery, 1270x760, one image each'));
        var gl = node('ol', 'bld-list');
        b.gallery.forEach(function (g) { gl.appendChild(node('li', '', g)); });
        ph.appendChild(gl);
      }
      ph.appendChild(node('div', 'bld-label', 'First comment, in your words'));
      var cl = node('ul', 'bld-list');
      (b.comment || []).forEach(function (c) { cl.appendChild(node('li', '', c)); });
      ph.appendChild(cl);
      var when = node('div', 'bld-kv');
      when.appendChild(node('span', 'bld-k', 'Launch'));
      when.appendChild(node('span', 'bld-v', b.timing + (b.timingAt ? ', ' + new Date(b.timingAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' your time' : '')));
      ph.appendChild(when);
      ph.appendChild(node('div', 'bld-note', b.votesRule));
      var hn = bldSection(parent, 'Show HN');
      var title = node('div', 'bld-pick');
      title.appendChild(node('span', 'bld-pick-text strong', b.title ? b.title.text : ''));
      title.appendChild(node('span', 'bld-meter', (b.title ? b.title.chars : 0) + ' chars'));
      title.appendChild(copyBtn('Copy', b.title ? b.title.text : ''));
      hn.appendChild(title);
      (b.title && b.title.problems || []).forEach(function (p) { hn.appendChild(node('div', 'bld-miss', 'Fix: ' + p)); });
      var hand = node('div', 'bld-hand');
      hand.appendChild(node('span', 'bld-hand-mark', 'By hand'));
      hand.appendChild(node('span', '', b.handwrite));
      hn.appendChild(hand);
      hn.appendChild(node('div', 'bld-label', 'Cover, in your own words'));
      var cv = node('ul', 'bld-list');
      (b.cover || []).forEach(function (c) { cv.appendChild(node('li', '', c)); });
      hn.appendChild(cv);
      (b.facts || []).forEach(function (f) {
        var kv = node('div', 'bld-kv');
        kv.appendChild(node('span', 'bld-k', f.what));
        kv.appendChild(node('span', 'bld-v', f.value));
        hn.appendChild(kv);
      });
      hn.appendChild(node('div', 'bld-note', b.tryable));
      if (b.submit && SUBMIT_OK.test(b.submit)) {
        var ha = node('div', 'bld-actions');
        ha.appendChild(linkBtn('Open the Show HN form', b.submit, SUBMIT_OK, 'primary'));
        hn.appendChild(ha);
        hn.appendChild(node('div', 'bld-note', 'Hacker News opens with the link and title filled in. You write the text and press submit there.'));
      }
      if ((b.checks || []).length) {
        var ck = bldSection(parent, 'Your drafts');
        b.checks.forEach(function (c) {
          var r = node('div', 'bld-check' + (c.ok ? ' ok' : ' bad'));
          r.appendChild(node('span', 'bld-check-mark', c.ok ? 'Pass' : 'Fix'));
          r.appendChild(node('span', '', c.field + ': ' + c.what));
          ck.appendChild(r);
        });
      }
      bldSources(parent, b.sources);
    } else if (b.kind === 'askers') {
      (b.matches || []).forEach(function (m) {
        var row = node('div', 'bld-row');
        var top = node('div', 'bld-row-top');
        top.appendChild(node('span', 'bld-chip', m.source));
        top.appendChild(node('span', 'bld-name', m.by || 'someone'));
        if (m.at) top.appendChild(node('span', 'bld-date', m.at));
        row.appendChild(top);
        row.appendChild(node('div', 'bld-quote-text block', m.excerpt));
        if ((m.matched || []).length) {
          var mc = node('div', 'bld-chips');
          m.matched.forEach(function (w) { mc.appendChild(node('span', 'bld-chip ghost', w)); });
          row.appendChild(mc);
        }
        if (m.handwrite) {
          var h = node('div', 'bld-hand');
          h.appendChild(node('span', 'bld-hand-mark', 'By hand'));
          h.appendChild(node('span', '', m.closed ? 'This thread is older than two weeks, so Hacker News no longer takes replies there.' : 'Write this reply yourself:'));
          row.appendChild(h);
          if (!m.closed) {
            var ol = node('ul', 'bld-list');
            (m.outline || []).forEach(function (o) { ol.appendChild(node('li', '', o)); });
            row.appendChild(ol);
          }
        } else if (m.draft) {
          row.appendChild(node('div', 'bld-draft-text small', m.draft));
        }
        var ra = node('div', 'bld-actions');
        if (m.draft && !m.handwrite) ra.appendChild(copyBtn('Copy reply', m.draft));
        if (m.url) ra.appendChild(linkBtn('Open thread', m.url, null, 'primary'));
        row.appendChild(ra);
        parent.appendChild(row);
      });
      if (b.rule) parent.appendChild(node('div', 'bld-note', b.rule.text));
      if (b.rule) bldSources(parent, [b.rule.source]);
    } else if (b.kind === 'check') {
      (b.checks || []).forEach(function (c) {
        var r = node('div', 'bld-check' + (c.ok ? ' ok' : ' bad'));
        r.appendChild(node('span', 'bld-check-mark', c.ok ? 'Pass' : 'Fix'));
        r.appendChild(node('span', '', c.field + ': ' + c.what + (c.ok ? '' : '. ' + c.rule)));
        parent.appendChild(r);
      });
      bldSources(parent, (b.checks || []).map(function (c) { return c.source; }));
    }
  }

  var LEAD_KICKERS = { leads: 'Who to contact', draft: 'Draft', status: 'Sending today', policy: 'Your sender details' };
  var LEAD_PILLS = { pitch: ['Pitch', 'is-keep'], bid: ['Bid', 'is-keep'], look: ['Look at it', 'is-look'], skip: ['Skip', 'is-drop'] };
  var LEAD_CHANNELS = { proposal: 'Proposal', email: 'Email', form: 'Contact form', dm: 'Message', call: 'Call script' };

  function capEl(parent, s) {
    if (!s || !(s.cap > 0)) return;
    var box = node('div', 'lead-cap');
    box.appendChild(node('span', 'lead-cap-num', s.sent + ' / ' + s.cap));
    var bar = node('div', 'lead-cap-bar');
    var fill = node('div', 'lead-cap-fill');
    fill.style.width = Math.min(100, Math.round(s.sent * 100 / s.cap)) + '%';
    bar.appendChild(fill);
    box.appendChild(bar);
    var bits = [s.left + ' left today'];
    if (s.bounces) bits.push(s.bounces + (s.bounces === 1 ? ' bounce' : ' bounces'));
    if (s.on === false) bits.push('switched off');
    else if (s.inHours === false && s.hours) bits.push('sends ' + s.hours[0] + ':00 to ' + s.hours[1] + ':00');
    box.appendChild(node('span', 'lead-cap-text', bits.join(' \u00b7 ')));
    parent.appendChild(box);
  }

  function leadsEl(parent, c, card) {
    card.classList.add('build', 'leads');
    card.dataset.kind = String(c.kind || '');
    bldHead(parent, c.kind === 'draft' ? (LEAD_CHANNELS[c.channel] || 'Draft') + (c.name ? ' for ' + c.name : '') : (LEAD_KICKERS[c.kind] || 'Leads'), c.kind === 'draft' ? '' : c.line);
    if (c.kind === 'leads') {
      capEl(parent, c.status);
      (c.leads || []).forEach(function (l) {
        var row = node('div', 'bld-row lead-row');
        row.dataset.verdict = String(l.verdict || '');
        var top = node('div', 'bld-row-top');
        var pill = LEAD_PILLS[l.verdict] || LEAD_PILLS.look;
        top.appendChild(node('span', 'state-pill ' + pill[1], pill[0]));
        top.appendChild(node('span', 'bld-name', l.name));
        if (l.contacted) top.appendChild(node('span', 'bld-chip ghost', l.contacted === 'opted_out' ? 'Asked not to' : 'Contacted'));
        row.appendChild(top);
        var sub = (l.facts || []).slice(0, 3);
        if (l.price && l.price.bid) sub.push((l.price.per === 'hour' ? 'bid $' + l.price.bid + ' an hour' : 'bid $' + l.price.bid));
        if (l.connects != null) sub.push(l.connects + ' Connects');
        if (sub.length) row.appendChild(node('div', 'bld-sub', sub.join(' \u00b7 ')));
        (l.reasons || []).slice(0, 2).forEach(function (r) { row.appendChild(node('div', l.verdict === 'skip' ? 'bld-sub lead-why' : 'bld-miss', r)); });
        var acts = node('div', 'bld-actions');
        if (l.url) acts.appendChild(linkBtn(l.kind === 'job' ? 'Open job' : 'Open on Maps', l.url, null, 'mini'));
        if (l.website) acts.appendChild(linkBtn('Website', l.website, null, 'mini'));
        if (acts.childNodes.length) row.appendChild(acts);
        parent.appendChild(row);
      });
      if (!(c.leads || []).length) parent.appendChild(node('div', 'bld-empty', 'Nothing was judged yet. Read a Google Maps search or an Upwork job search first.'));
      parent.appendChild(node('div', 'bld-note', 'Verdicts come from the numbers on the page and your saved offer. Nothing is sent from here.'));
    } else if (c.kind === 'draft') {
      if (c.subject) {
        var kv = node('div', 'bld-kv');
        kv.appendChild(node('span', 'bld-k', 'Subject'));
        kv.appendChild(node('span', 'bld-v', c.subject));
        parent.appendChild(kv);
      }
      var box = node('div', 'bld-draft');
      box.appendChild(node('div', 'bld-draft-text', c.body));
      var foot = node('div', 'bld-draft-foot');
      foot.appendChild(node('span', 'bld-meter', (c.chars || 0) + ' chars'));
      var acts = node('div', 'bld-actions');
      acts.appendChild(copyBtn(c.script ? 'Copy script' : 'Copy', (c.subject ? c.subject + '\n\n' : '') + c.body));
      if (c.route) acts.appendChild(linkBtn(c.channel === 'proposal' ? 'Open job' : 'Open their site', c.route, null, c.blocked ? '' : 'primary'));
      foot.appendChild(acts);
      box.appendChild(foot);
      parent.appendChild(box);
      (c.checks || []).forEach(function (x) {
        var r = node('div', 'bld-check' + (x.ok ? ' ok' : ' bad'));
        r.appendChild(node('span', 'bld-check-mark', x.ok ? 'Pass' : 'Fix'));
        r.appendChild(node('span', '', x.what));
        parent.appendChild(r);
      });
      if (c.script) parent.appendChild(node('div', 'bld-note', 'Calls are yours to make' + (c.phone ? ': ' + c.phone : '') + '. Tell ZERACK how it went and it records it.'));
      else if (c.blocked) {
        var hb = node('div', 'bld-hand');
        hb.appendChild(node('span', 'bld-hand-mark', 'Held'));
        hb.appendChild(node('span', '', c.blocked));
        parent.appendChild(hb);
      } else parent.appendChild(node('div', 'bld-note', 'ZERACK can type it on their page; Send waits for your press, inside today\'s cap.' + (c.connects != null ? ' Applying costs ' + c.connects + ' Connects.' : '')));
      capEl(parent, c.status);
    } else if (c.kind === 'status') {
      capEl(parent, c.status);
      (c.recent || []).forEach(function (r) {
        var row = node('div', 'bld-kv');
        row.appendChild(node('span', 'bld-k', r.at ? new Date(r.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''));
        row.appendChild(node('span', 'bld-v', r.name + ', ' + String(r.status || '').replace(/_/g, ' ')));
        parent.appendChild(row);
      });
    } else if (c.kind === 'policy') {
      var p = c.policy || {};
      [['Name', p.name], ['Business', p.business], ['Address', p.address ? 'Saved' : ''], ['Offer', p.offer], ['Skills', p.skills], ['Rate', p.rate ? '$' + p.rate + ' an hour' : ''], ['Cap', p.cap ? p.cap.start + ' a day, +' + p.cap.step + ' a day, up to ' + p.cap.max : ''], ['Hours', p.hours ? p.hours[0] + ':00 to ' + p.hours[1] + ':00' : '']].forEach(function (x) {
        if (!x[1]) return;
        var r = node('div', 'bld-kv');
        r.appendChild(node('span', 'bld-k', x[0]));
        r.appendChild(node('span', 'bld-v', String(x[1])));
        parent.appendChild(r);
      });
    }
  }

  function msgEl(row) {
    var box;
    if (row.role === 'press') return pressEl(row);
    if (row.role === 'allow') return allowEl(row);
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
      if (meta.decision && typeof meta.decision === 'object') decisionEl(inner, meta.decision, box);
      else if (meta.builder && typeof meta.builder === 'object' && meta.status !== 'running') builderEl(inner, meta.builder, box);
      else if (meta.leads && typeof meta.leads === 'object' && meta.status !== 'running') leadsEl(inner, meta.leads, box);
      else if (meta.detail) inner.appendChild(node('div', 'detail', meta.detail));
      if (Array.isArray(meta.missing) && meta.missing.length) missingEl(inner, meta.missing, 'Missing before ZERACK offers to spend', 'You can still do it yourself on the page.');
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
    if (row.id != null && !S.drawn[row.id]) S.drawn[row.id] = Date.now();
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
    if (S.msgs.some(function (r) { return r.role === 'press' && pressLive(r); })) watchPresses();
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
    if (row.role === 'press' && pressLive(row)) watchPresses();
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
        return send({ type: 'NSP_CHAT_RUN', convId: conv.id, text: text, lang: textLang(text), tabLang: navigator.language || '', windowId: S.windowId }).then(function (res) {
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
      paintSiteItems();
      readSite().then(paintSiteItems);
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
          if (!en.target.isConnected) { io.disconnect(); delete S.seen[key]; return; }
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
    if (act === 'site-allow') { menuAllow(); return; }
    if (act === 'site-forget') { if (S.site && S.site.host) send({ type: 'NSP_CHAT_FORGET_SITE', host: S.site.host }).then(readSite); return; }
    if (act === 'hide-site') { send({ type: 'NSP_CHAT_OVERLAY', op: 'hide_site' }); return; }
    if (act === 'setup') { openPage('setup/setup.html'); return; }
    if (act === 'activity') { openPage('activity/activity.html'); return; }
    if (act === 'close') closeOverlay();
  }

  function readSite() {
    return send({ type: 'NSP_CHAT_SITE', windowId: S.windowId }).then(function (res) {
      S.site = res && res.ok === true && res.host ? res : null;
      paintChips();
      return S.site;
    });
  }

  function paintSiteItems() {
    var menu = $('more-menu');
    var allow = menu.querySelector('[data-act="site-allow"]');
    var forget = menu.querySelector('[data-act="site-forget"]');
    var site = S.site && S.site.web ? S.site : null;
    allow.hidden = !site || site.access === 'act';
    forget.hidden = !site || site.consent === 'none';
    if (site) {
      allow.textContent = 'Let ZERACK work on ' + site.host;
      forget.textContent = 'Stop ZERACK on ' + site.host;
    }
  }

  function menuAllow() {
    var site = S.site;
    if (!site || !site.pattern) return;
    var granted;
    try { granted = chrome.permissions.request({ origins: [site.pattern] }); } catch (e) { return; }
    Promise.resolve(granted).then(function (ok) {
      if (ok !== true) return null;
      return send({ type: 'NSP_CHAT_ALLOW_SITE', host: site.host, pattern: site.pattern, mode: 'act' }).then(readSite);
    }, function () { return null; });
  }

  function paintChips() {
    var pb = S.site && S.site.web && S.site.playbook && Array.isArray(S.site.playbook.chips) ? S.site.playbook : null;
    var list = pb && pb.chips.length ? pb.chips : (S.site && S.site.web ? WEB_CHIPS : YT_CHIPS);
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (chip, i) {
      if (list[i]) chip.textContent = String(list[i]).slice(0, 80);
    });
    var tag = $('empty-tag');
    if (tag) {
      tag.hidden = !pb;
      $('empty-tag-text').textContent = pb ? String(pb.name).slice(0, 30) + ' playbook' : '';
    }
  }

  function tickPresses() {
    var live = false;
    S.msgs.forEach(function (row) {
      if (row.role !== 'press' || !row.meta || row.meta.status !== 'waiting') return;
      var el = S.els[row.id];
      if (!el) return;
      if (pressLive(row)) {
        live = true;
        var c = el.querySelector('.gate-clock');
        if (c) c.textContent = mmss(Number(row.meta.until) - Date.now());
      } else if (el.dataset.status === 'waiting') {
        drawMsg(row);
      }
    });
    if (!live && S.clock) { clearInterval(S.clock); S.clock = 0; }
  }

  function watchPresses() {
    if (S.clock) return;
    S.clock = setInterval(tickPresses, 1000);
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
    try {
      if (MODE !== 'overlay' && chrome.windows && chrome.windows.getCurrent) chrome.windows.getCurrent(function (w) { if (!chrome.runtime.lastError && w && w.id >= 0) S.windowId = w.id; readSite(); });
    } catch (e) {}
    if (MODE === 'overlay') readSite();
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
