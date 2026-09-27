(function () {
  'use strict';

  var STORE = self.NSP_CHAT_STORE, D = self.NSP_DECIDE;
  var TABS = { lessons: 1, decisions: 1, actions: 1 };
  var KIND_NAMES = { ab: 'A/B test', trend: 'Trend', window: 'Window', share: 'Rate' };
  var STATE_LABEL = { keep: 'KEEP', look: 'LOOK AT IT', drop: 'DROP' };
  var STATUS_WORDS = { open: 'Measuring', kept: 'Lesson kept', dropped: 'Measured false', expired: 'Never proven', forgotten: 'Forgotten' };
  var BY_WORDS = { chat: 'Measured in the chat', alarm: 'Measured on schedule', read: 'Measured when the page was read', you: 'Measured when you pressed Measure now' };
  var HOW = {
    auto: { text: 'Ran', cls: '' },
    pressed: { text: 'You pressed', cls: 'yes' },
    declined: { text: 'You cancelled', cls: '' },
    timeout: { text: 'Not pressed in time', cls: '' },
    stopped: { text: 'Stopped', cls: '' },
    refused: { text: 'Refused', cls: 'no' },
    no_evidence: { text: 'Not offered: no evidence', cls: 'no' }
  };
  var ASKED = { pressed: 1, declined: 1, timeout: 1, stopped: 1 };
  var ARM_MS = 3000;
  var S = { tab: 'lessons', site: '', ledger: [], decisions: [], timer: 0, notes: {} };

  function $(id) { return document.getElementById(id); }

  function node(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = String(text);
    return el;
  }

  function time(at) {
    return new Date(at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function dayOf(at) {
    return new Date(at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function stamp(at) {
    return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + time(at);
  }

  function dateOnly(at) {
    return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function address(u) {
    return String(u || '').replace(/^https?:\/\//, '');
  }

  function grouped(x) {
    return String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function send(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : (res || { ok: false }));
        });
      } catch (e) { resolve({ ok: false, error: String((e && e.message) || e) }); }
    });
  }

  function remembered() {
    try { var t = localStorage.getItem('zerack_activity_tab'); return TABS[t] === 1 ? t : ''; } catch (e) { return ''; }
  }

  function remember(t) {
    try { localStorage.setItem('zerack_activity_tab', t); } catch (e) {}
  }

  function inSite(host) {
    return !S.site || host === S.site;
  }

  function armed(btn, label, rest) {
    if (btn.classList.contains('armed')) return true;
    btn.classList.add('armed');
    btn.textContent = label;
    setTimeout(function () { btn.classList.remove('armed'); btn.textContent = rest; }, ARM_MS);
    return false;
  }

  function empty(title, text) {
    var box = node('div', 'empty-state');
    var img = node('img');
    img.src = '../icons/zerack-mark-small.svg';
    img.alt = '';
    box.appendChild(img);
    box.appendChild(node('h2', '', title));
    box.appendChild(node('p', '', text));
    return box;
  }

  function missingEl(list, foot) {
    var wrap = node('div', 'missing');
    wrap.appendChild(node('div', 'missing-head', 'Still missing'));
    var ul = node('ul', 'missing-list');
    list.forEach(function (m) { ul.appendChild(node('li', '', m && m.text ? m.text : String(m))); });
    wrap.appendChild(ul);
    if (foot) wrap.appendChild(node('div', 'missing-foot', foot));
    return wrap;
  }

  function box(tag, tagCls, text, why) {
    var b = node('div', 'box');
    b.appendChild(node('span', 'tag' + (tagCls ? ' ' + tagCls : ''), tag));
    var t = node('div', 'box-text', text);
    if (why) t.appendChild(node('span', 'why', why));
    b.appendChild(t);
    return b;
  }

  function forget(d, btn) {
    if (!armed(btn, 'Click again to forget', 'Forget')) return;
    btn.disabled = true;
    var row = JSON.parse(JSON.stringify(d));
    row.status = 'forgotten';
    row.dueAt = 0;
    row.lesson.state = 'deleted';
    row.lesson.why = 'You removed it on ' + dateOnly(Date.now()) + '.';
    STORE.putDecision(row).then(load, function () { btn.disabled = false; });
  }

  function measure(d, btn, noteEl) {
    btn.disabled = true;
    btn.textContent = 'Measuring...';
    noteEl.className = 'note';
    noteEl.textContent = 'Reading ' + address(d.source.url) + '...';
    noteEl.hidden = false;
    send({ type: 'NSP_DECIDE_NOW', id: d.id }).then(function (res) {
      if (res && res.ok && res.decision) {
        var r = res.decision.result || {};
        S.notes[d.id] = { bad: false, text: 'Measured just now: ' + (STATE_LABEL[r.state] || 'LOOK AT IT') + ', ' + (r.number || '') };
      } else {
        S.notes[d.id] = { bad: true, text: 'Not measured: ' + String((res && res.error) || 'no answer') };
      }
      load();
    });
  }

  function lessonCard(d, how) {
    var card = node('article', 'card lesson' + (how === 'firm' ? ' firm' : (how === 'gone' ? ' gone muted' : ' muted')));
    card.dataset.id = String(d.id);
    card.appendChild(node('div', 'lesson-text', d.lesson.text || d.question));
    var num = how === 'firm' ? (d.lesson.evidence || (d.result && d.result.number)) : (d.result && d.result.number);
    if (num) card.appendChild(node('div', 'lesson-num', num));
    var meta = node('div', 'lesson-meta');
    if (d.host) meta.appendChild(node('span', '', d.host));
    if (how === 'firm') {
      meta.appendChild(node('span', '', 'Kept ' + dateOnly(d.lesson.at || d.measuredAt || d.at)));
      if (d.dueAt) meta.appendChild(node('span', '', 'Checked again ' + dateOnly(d.dueAt)));
    } else if (how === 'wait') {
      meta.appendChild(node('span', '', d.dueAt ? 'Re-measure ' + dateOnly(d.dueAt) : 'Waiting for new numbers'));
    } else {
      meta.appendChild(node('span', '', STATUS_WORDS[d.status] || 'Dropped'));
    }
    card.appendChild(meta);
    if (how === 'gone' && d.lesson.why) card.appendChild(node('div', 'note', d.lesson.why.charAt(0).toUpperCase() + d.lesson.why.slice(1) + '.'));
    if (how !== 'gone') {
      var acts = node('div', 'actions');
      var btn = node('button', 'btn small', 'Forget');
      btn.type = 'button';
      btn.addEventListener('click', function (e) { if (e.isTrusted) forget(d, btn); });
      acts.appendChild(btn);
      card.appendChild(acts);
    }
    return card;
  }

  function drawLessons(list) {
    var panel = $('panel-lessons');
    panel.textContent = '';
    var firm = list.filter(function (d) { return d.lesson.state === 'firm' && d.status !== 'forgotten'; });
    var wait = list.filter(function (d) { return d.lesson.state === 'tentative' && d.status === 'open'; });
    var gone = list.filter(function (d) { return d.lesson.state === 'deleted' || d.status === 'forgotten'; });
    if (!firm.length && !wait.length && !gone.length) {
      panel.appendChild(empty('No lessons yet', 'Ask ZERACK which option wins on a page it can read, such as a Search Console table, or give it the numbers. It decides, books a re-measure, and keeps the lesson only if the numbers hold.'));
      return;
    }
    panel.appendChild(node('h2', 'group-head', firm.length ? 'Kept, the chat builds on these' : 'Nothing kept yet'));
    firm.forEach(function (d) { panel.appendChild(lessonCard(d, 'firm')); });
    if (!firm.length) panel.appendChild(node('p', 'sub', 'A lesson is kept only after a re-measure agrees with it.'));
    if (wait.length) {
      panel.appendChild(node('h2', 'group-head', 'Waiting for a re-measure'));
      wait.forEach(function (d) { panel.appendChild(lessonCard(d, 'wait')); });
    }
    if (gone.length) {
      panel.appendChild(node('h2', 'group-head', 'Measured false, never proven or removed'));
      gone.slice(0, 30).forEach(function (d) { panel.appendChild(lessonCard(d, 'gone')); });
    }
  }

  function armsTable(d) {
    var r = d.result || {};
    var arms = r.arms && r.arms.length ? r.arms : (d.input.arms || []);
    var labels = D.displayNames(arms.map(function (a) { return a.name; }));
    var t = node('table', 'arms');
    var head = node('tr');
    ['Option', 'Shown', 'Clicks', 'Rate', 'From'].forEach(function (h, i) { head.appendChild(node('th', i && i < 4 ? 'num' : '', h)); });
    var thead = node('thead');
    thead.appendChild(head);
    t.appendChild(thead);
    var body = node('tbody');
    arms.forEach(function (a, i) {
      var tr = node('tr', a.name === r.leader ? 'lead' : '');
      var name = node('td', 'name', labels[i]);
      name.title = a.name;
      tr.appendChild(name);
      tr.appendChild(node('td', 'num', a.impressions == null ? '' : grouped(a.impressions)));
      tr.appendChild(node('td', 'num', a.clicks == null ? '' : grouped(a.clicks)));
      tr.appendChild(node('td', 'num', a.impressions ? (a.clicks * 100 / a.impressions).toFixed(2) + '%' : ''));
      tr.appendChild(node('td', '', a.from === 'page' ? 'the page' : (a.from === 'chat' ? 'the conversation' : '')));
      body.appendChild(tr);
    });
    t.appendChild(body);
    return t;
  }

  function decisionCard(d) {
    var r = d.result || {};
    var state = STATE_LABEL[r.state] ? r.state : 'look';
    var card = node('article', 'card dec');
    card.dataset.state = state;
    card.dataset.id = String(d.id);
    var top = node('div', 'row');
    top.appendChild(node('span', 'pill ' + state, r.label || STATE_LABEL[state]));
    top.appendChild(node('span', 'chip', KIND_NAMES[d.kind] || d.kind));
    if (d.host) top.appendChild(node('span', 'chip', d.host));
    var status = STATUS_WORDS[d.status] || 'Measuring';
    if (d.status === 'open' && d.dueAt) status += ', re-measure ' + dateOnly(d.dueAt);
    if (d.status === 'kept' && d.dueAt) status += ', checked again ' + dateOnly(d.dueAt);
    top.appendChild(node('span', 'status', status));
    card.appendChild(top);
    card.appendChild(node('h3', 'dec-q', d.question));
    if (r.number) card.appendChild(node('div', 'dec-num', r.number));
    if (d.kind === 'ab') card.appendChild(armsTable(d));
    if (r.state === 'look' && r.missing && r.missing.length) card.appendChild(missingEl(r.missing, r.projection && r.projection.line ? 'That is ' + r.projection.line + '.' : ''));
    var lessonWord = d.lesson.state === 'firm' ? 'Kept' : (d.lesson.state === 'deleted' ? 'Deleted' : 'Waiting');
    var lessonWhy = d.lesson.why ? d.lesson.why.charAt(0).toUpperCase() + d.lesson.why.slice(1) + '.' : (d.lesson.state === 'tentative' ? 'Kept only if the re-measure agrees.' : '');
    card.appendChild(box('Lesson', d.lesson.state === 'firm' ? '' : (d.lesson.state === 'deleted' ? 'red' : 'dim'), (d.lesson.text || '') + ' (' + lessonWord.toLowerCase() + ')', lessonWhy));
    if (d.measures && d.measures.length) {
      var ul = node('ul', 'history');
      d.measures.slice().reverse().slice(0, 8).forEach(function (m) {
        var li = node('li');
        var head = node('div', 'h-head');
        head.appendChild(node('span', 'when', stamp(m.at)));
        head.appendChild(node('span', 'h-state ' + (STATE_LABEL[m.state] ? m.state : 'look'), STATE_LABEL[m.state] || 'LOOK AT IT'));
        if (m.number) head.appendChild(node('span', 'h-num', m.number));
        li.appendChild(head);
        var why = [BY_WORDS[m.by] || '', m.why ? m.why.charAt(0).toUpperCase() + m.why.slice(1) : ''].filter(Boolean).join('. ');
        if (why) li.appendChild(node('div', 'h-why', why + '.'));
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }
    if (d.source && d.source.url) card.appendChild(node('div', 'src', 'Numbers from ' + address(d.source.url)));
    else card.appendChild(node('div', 'src', 'Numbers given in the conversation, so ZERACK asks for fresh ones instead of reading them again'));
    if (d.waiting && (d.status === 'open' || d.status === 'kept')) card.appendChild(node('div', 'waiting', 'Waiting for ' + d.waiting));
    var note = node('div', 'note');
    note.hidden = true;
    if (S.notes[d.id]) { note.textContent = S.notes[d.id].text; note.className = 'note' + (S.notes[d.id].bad ? ' bad' : ''); note.hidden = false; }
    if (d.status === 'open' || d.status === 'kept') {
      var acts = node('div', 'actions');
      if (d.source && d.source.url) {
        var now = node('button', 'btn primary small', 'Measure now');
        now.type = 'button';
        now.addEventListener('click', function (e) { if (e.isTrusted) measure(d, now, note); });
        acts.appendChild(now);
      }
      var fg = node('button', 'btn small', 'Forget');
      fg.type = 'button';
      fg.addEventListener('click', function (e) { if (e.isTrusted) forget(d, fg); });
      acts.appendChild(fg);
      card.appendChild(acts);
    }
    card.appendChild(note);
    return card;
  }

  function drawDecisions(list) {
    var panel = $('panel-decisions');
    panel.textContent = '';
    if (!list.length) {
      panel.appendChild(empty('No decisions yet', 'When you ask which title, ad, price or subject line wins, or whether a number is growing, ZERACK answers KEEP, LOOK AT IT or DROP with the number behind it, and every answer shows up here.'));
      return;
    }
    list.forEach(function (d) { panel.appendChild(decisionCard(d)); });
  }

  function actionLine(e) {
    var act = String(e.action || 'act');
    var target = String(e.target || '');
    var head = act.charAt(0).toUpperCase() + act.slice(1);
    if (act === 'navigate' || act === 'goto' || act === 'open') return 'Go to ' + address(e.urlAfter || target);
    if (act === 'type' || act === 'fill' || act === 'paste' || act === 'append') return (act === 'paste' || act === 'append' ? 'Paste into ' : 'Type into ') + (target || 'a field');
    return head + (target ? ' ' + target : '');
  }

  function actionCard(e) {
    var how = HOW[e.decision] || HOW.auto;
    var result = e.decision === 'refused' ? 'refused' : (e.decision === 'no_evidence' ? 'no_evidence' : (e.result === 'done' ? 'done' : 'other'));
    var card = node('article', 'card act');
    card.dataset.result = result;
    card.appendChild(node('div', 'act-time', time(e.at)));
    var body = node('div', 'act-body');
    var line = node('div', 'row');
    if (e.kind) line.appendChild(node('span', 'chip kind' + (e.kind === 'Pay' ? ' pay' : ''), e.kind));
    line.appendChild(node('span', 'act-line', actionLine(e)));
    line.appendChild(node('span', 'chip how' + (how.cls ? ' ' + how.cls : ''), how.text));
    body.appendChild(line);
    body.appendChild(node('div', 'act-where', address(e.urlBefore || e.url || e.host)));
    if (e.evidence && e.evidence.line && e.decision !== 'no_evidence') body.appendChild(box('Evidence', '', e.evidence.line));
    else if (e.evidence && e.evidence.line) body.appendChild(box('Test so far', 'dim', e.evidence.line));
    if (e.fields && e.fields.length) {
      var f = node('div', 'fields');
      e.fields.forEach(function (x) {
        var row = node('div', 'field');
        row.appendChild(node('b', '', String(x.field || 'Field').replace(/^(?:textbox|searchbox|combobox|listbox) (?=")/, '')));
        row.appendChild(document.createTextNode(': now ' + (x.after ? '"' + x.after + '"' : 'empty') + ' '));
        row.appendChild(node('span', 'was', '(was ' + (x.before ? '"' + x.before + '"' : 'empty') + ')'));
        f.appendChild(row);
      });
      body.appendChild(f);
    }
    if (e.decision === 'refused' || e.decision === 'no_evidence') {
      if (e.detail) body.appendChild(node('div', 'note', e.detail));
    }
    var undo = D.undoText(e);
    var u = box('Undo', 'dim', undo);
    if (e.fields && e.fields.length && e.result === 'done') {
      var copy = node('button', 'btn small', 'Copy');
      copy.type = 'button';
      copy.addEventListener('click', function (ev) {
        if (!ev.isTrusted) return;
        var text = e.fields.map(function (x) { return String(x.before || ''); }).join('\n');
        Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(text)).then(function () { copy.textContent = 'Copied'; }, function () { copy.textContent = 'Copy failed'; });
        setTimeout(function () { copy.textContent = 'Copy'; }, 1800);
      });
      u.appendChild(copy);
    }
    body.appendChild(u);
    card.appendChild(body);
    return card;
  }

  function drawActions(list) {
    var panel = $('panel-actions');
    panel.textContent = '';
    if (!list.length) {
      panel.appendChild(empty('No actions yet', 'When ZERACK clicks, types or chooses on a site you allowed, each step lands here with what changed, who pressed, the evidence behind any spending and how to undo it.'));
      return;
    }
    var last = '';
    list.forEach(function (e) {
      var d = dayOf(e.at);
      if (d !== last) { panel.appendChild(node('h2', 'day', d)); last = d; }
      panel.appendChild(actionCard(e));
    });
  }

  function paintTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.setAttribute('aria-selected', b.dataset.tab === S.tab ? 'true' : 'false');
    });
    ['lessons', 'decisions', 'actions'].forEach(function (t) { $('panel-' + t).hidden = t !== S.tab; });
  }

  function paintSites() {
    var sel = $('site');
    var hosts = {};
    S.ledger.forEach(function (e) { if (e.host) hosts[e.host] = 1; });
    S.decisions.forEach(function (d) { if (d.host) hosts[d.host] = 1; });
    var list = Object.keys(hosts).sort();
    if (S.site && !hosts[S.site]) S.site = '';
    while (sel.options.length > 1) sel.remove(1);
    list.forEach(function (h) {
      var o = node('option', '', h);
      o.value = h;
      sel.appendChild(o);
    });
    sel.value = S.site;
  }

  function draw() {
    var decisions = S.decisions.filter(function (d) { return inSite(d.host); });
    var ledger = S.ledger.filter(function (e) { return inSite(e.host); }).slice().reverse();
    var firm = decisions.filter(function (d) { return d.lesson.state === 'firm' && d.status !== 'forgotten'; });
    var lessonsShown = decisions.filter(function (d) { return d.lesson && d.lesson.text; });
    $('n-lessons').textContent = grouped(firm.length);
    $('n-open').textContent = grouped(decisions.filter(function (d) { return d.status === 'open'; }).length);
    $('n-actions').textContent = grouped(ledger.length);
    $('n-presses').textContent = grouped(ledger.filter(function (e) { return ASKED[e.decision] === 1; }).length);
    $('c-lessons').textContent = grouped(firm.length);
    $('c-decisions').textContent = grouped(decisions.length);
    $('c-actions').textContent = grouped(ledger.length);
    drawLessons(lessonsShown);
    drawDecisions(decisions);
    drawActions(ledger);
    paintTabs();
  }

  function load() {
    return Promise.all([STORE.listLedger({ limit: 500 }), STORE.listDecisions({ limit: 1000 })]).then(function (got) {
      S.ledger = got[0] || [];
      S.decisions = got[1] || [];
      $('load-error').hidden = true;
      paintSites();
      draw();
      document.body.dataset.ready = '1';
    }, function (e) {
      $('load-error').textContent = 'The activity could not be read: ' + String((e && e.message) || e);
      $('load-error').hidden = false;
      document.body.dataset.ready = '1';
    });
  }

  function later() {
    clearTimeout(S.timer);
    S.timer = setTimeout(load, 300);
  }

  function boot() {
    var hash = String(location.hash || '').replace(/^#/, '');
    S.tab = TABS[hash] === 1 ? hash : (remembered() || 'lessons');
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.addEventListener('click', function () {
        S.tab = b.dataset.tab;
        remember(S.tab);
        paintTabs();
      });
    });
    $('site').addEventListener('change', function () { S.site = this.value; draw(); });
    try {
      var channel = new BroadcastChannel('zerack_chat');
      channel.onmessage = function (ev) {
        var d = ev && ev.data;
        if (d && (d.decision || d.row)) later();
      };
    } catch (e) {}
    window.addEventListener('focus', later);
    paintTabs();
    load();
  }

  boot();
})();
