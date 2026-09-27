(function (root) {
  if (Object.prototype.hasOwnProperty.call(root, 'NSP_PAGE_AGENT')) return;

  var PRESS_MS = 120000;
  var EVIDENCE_MS = 4000;
  var STEP_MS = 45000;
  var LOAD_MS = 25000;
  var PLAN_MAX = 30;
  var HANDS_FILES = ['lib/nsp-gate.js', 'lib/nsp-hands.js'];
  var EXTRACT_FILES = ['lib/nsp-extract.js'];
  var EXTRACT_MAX = 250;
  var ACTIONS = {
    read: 'read', wait: 'read', scroll: 'read',
    click: 'act', press: 'act', tap: 'act',
    type: 'act', fill: 'act', paste: 'act', append: 'act',
    select: 'act', choose: 'act',
    navigate: 'act', 'goto': 'act', open: 'act'
  };
  var CLICKS = { click: 1, press: 1, tap: 1 };
  var TYPES = { type: 1, fill: 1, paste: 1, append: 1 };
  var NAVIGATES = { navigate: 1, 'goto': 1, open: 1 };
  var STEP_KEYS = ['action', 'target', 'text', 'option', 'selector', 'submit', 'direction', 'amount', 'timeoutMs'];
  var TYPED_MS = 30 * 60000;
  var TYPED_MAX = 8;
  var pending = {};
  var typedByTab = {};

  function sites() {
    return root.NSP_SITES;
  }

  function playbooks() {
    var P = root.NSP_PLAYBOOKS;
    return P && typeof P.forHost === 'function' ? P : null;
  }

  function where(url) {
    try {
      var u = new URL(String(url || ''));
      return { host: u.hostname.toLowerCase(), path: u.pathname || '/' };
    } catch (e) { return { host: '', path: '/' }; }
  }

  function playbookOf(url) {
    var P = playbooks();
    if (!P) return '';
    var w = where(url);
    return w.host ? P.forHost(w.host, w.path) : '';
  }

  function rulesFor(url) {
    var P = playbooks();
    if (!P) return null;
    var w = where(url);
    var r = P.gateRules(w.host, w.path);
    return r && (r.press.length || r.never.length) ? { press: r.press, never: r.never } : null;
  }

  function keptReadOnly(url) {
    var P = playbooks();
    if (!P || typeof P.readOnly !== 'function') return null;
    var w = where(url);
    return P.readOnly(w.host, w.path);
  }

  function privateOf(url) {
    var P = playbooks();
    if (!P || typeof P.privatePage !== 'function') return null;
    var w = where(url);
    return w.host ? P.privatePage(w.host, w.path) : null;
  }

  function remember(tabId, text) {
    var t = String(text || '');
    if (!t || !(tabId >= 0)) return;
    var now = Date.now();
    var list = (typedByTab[tabId] || []).filter(function (x) { return now - x.at < TYPED_MS; });
    list.push({ text: t.slice(0, 20000), at: now });
    typedByTab[tabId] = list.slice(-TYPED_MAX);
  }

  function typedOf(tabId) {
    var now = Date.now();
    return (typedByTab[tabId] || []).filter(function (x) { return now - x.at < TYPED_MS; }).map(function (x) { return { text: x.text }; });
  }

  function forget(tabId) {
    delete typedByTab[tabId];
  }

  function refusePrivate(host, priv) {
    return { ok: false, code: 'private', host: host, why: priv.why, error: 'ZERACK neither reads nor acts on this page of ' + host + ': ' + priv.why + '. Tell the user this page is theirs alone. Do not retry.' };
  }

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 3) + '...' : s;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function nonce() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function actionOf(a) {
    return String((a && a.action) || '').toLowerCase().trim();
  }

  function getTab(id) {
    return new Promise(function (resolve) {
      try {
        chrome.tabs.get(id, function (tab) { resolve(chrome.runtime.lastError ? null : tab || null); });
      } catch (e) { resolve(null); }
    });
  }

  function queryTabs(q) {
    return new Promise(function (resolve) {
      try {
        chrome.tabs.query(q, function (tabs) { resolve(chrome.runtime.lastError ? [] : tabs || []); });
      } catch (e) { resolve([]); }
    });
  }

  function isWeb(tab) {
    return !!(tab && tab.id >= 0 && sites().parse(String(tab.url || '')));
  }

  function findTab(where) {
    where = where || {};
    if (where.tabId >= 0) return getTab(where.tabId);
    var inWindow = where.windowId >= 0 ? queryTabs({ windowId: where.windowId, active: true }) : Promise.resolve([]);
    return inWindow.then(function (list) {
      var hit = list.filter(isWeb)[0];
      if (hit) return hit;
      return queryTabs({}).then(function (all) {
        var web = all.filter(isWeb);
        web.sort(function (a, b) { return (Number(b.lastAccessed) || 0) - (Number(a.lastAccessed) || 0) || (b.active ? 1 : 0) - (a.active ? 1 : 0); });
        return web[0] || null;
      });
    });
  }

  function chromeAllows(pattern) {
    return new Promise(function (resolve) {
      if (!pattern) { resolve(false); return; }
      try {
        chrome.permissions.contains({ origins: [pattern] }, function (has) { resolve(!chrome.runtime.lastError && has === true); });
      } catch (e) { resolve(false); }
    });
  }

  function accessFor(url) {
    var S = sites();
    var host = S.hostOf(url);
    var pattern = S.patternOf(url);
    if (!host) return Promise.resolve({ host: '', pattern: '', consent: 'none', chrome: false, access: 'none' });
    return Promise.all([S.load(), chromeAllows(pattern)]).then(function (r) {
      var consent = S.accessIn(r[0], host);
      return { host: host, pattern: pattern, consent: consent, chrome: r[1], access: r[1] ? consent : 'none' };
    });
  }

  function site(where) {
    return findTab(where).then(function (tab) {
      if (!tab) return null;
      var S = sites();
      var url = String(tab.url || '');
      return accessFor(url).then(function (acc) {
        return {
          tabId: tab.id,
          url: url,
          host: acc.host,
          pattern: acc.pattern,
          access: acc.access,
          consent: acc.consent,
          chrome: acc.chrome,
          youtube: S.isYouTube(acc.host),
          scriptable: S.scriptable(url),
          playbook: playbookOf(url) || S.playbookFor(acc.host)
        };
      });
    });
  }

  function bootHands(rules) {
    var p = self.__zerackPage;
    if (p && p.doc === document) return 'ready';
    if (!self.NSP_HANDS || typeof self.NSP_HANDS.create !== 'function') return 'missing';
    var state = { stop: false };
    var hands = self.NSP_HANDS.create({ hold: true, ledger: true, rules: rules || null, stopped: function () { return state.stop; } });
    self.__zerackPage = { doc: document, state: state, hands: hands };
    return 'ready';
  }

  function handsHere() {
    var p = self.__zerackPage;
    return p && p.doc === document ? 'here' : 'gone';
  }

  function handsStep(a) {
    var p = self.__zerackPage;
    if (!p || p.doc !== document) return { ok: false, code: 'no_hands' };
    p.state.stop = false;
    return p.hands.act(a);
  }

  function handsPress(handle) {
    var p = self.__zerackPage;
    if (!p || p.doc !== document) return { ok: false, code: 'expired', error: 'the page changed before the press, so nothing was done' };
    return p.hands.press(handle);
  }

  function handsRelease() {
    var p = self.__zerackPage;
    if (p && p.doc === document) p.hands.release();
    return true;
  }

  function handsStop() {
    var p = self.__zerackPage;
    if (p && p.doc === document) { p.state.stop = true; p.hands.release(); }
    return true;
  }

  function exec(tabId, func, args) {
    var timer = 0;
    var run = new Promise(function (resolve) {
      try {
        chrome.scripting.executeScript({ target: { tabId: tabId, frameIds: [0] }, world: 'ISOLATED', func: func, args: args || [] }).then(function (res) {
          resolve(res && res[0] ? { ok: true, value: res[0].result } : { ok: false, error: 'the page gave no answer' });
        }, function (e) { resolve({ ok: false, error: String((e && e.message) || e) }); });
      } catch (e) { resolve({ ok: false, error: String((e && e.message) || e) }); }
    });
    var late = new Promise(function (resolve) { timer = setTimeout(function () { resolve({ ok: false, late: true, error: 'the page did not answer within ' + Math.round(STEP_MS / 1000) + ' s' }); }, STEP_MS); });
    return Promise.race([run, late]).then(function (r) { clearTimeout(timer); return r; });
  }

  function inject(tabId, rules) {
    return new Promise(function (resolve) {
      try {
        chrome.scripting.executeScript({ target: { tabId: tabId, frameIds: [0] }, world: 'ISOLATED', files: HANDS_FILES }).then(function () {
          exec(tabId, bootHands, [rules || null]).then(function (r) { resolve(r.ok && r.value === 'ready' ? { ok: true } : { ok: false, error: r.error || 'the hands did not start on the page' }); });
        }, function (e) { resolve({ ok: false, error: String((e && e.message) || e) }); });
      } catch (e) { resolve({ ok: false, error: String((e && e.message) || e) }); }
    });
  }

  function denied(error) {
    return /cannot access|permission|must request|not allowed/i.test(String(error || ''));
  }

  function inPage(tabId, func, args, rules) {
    return exec(tabId, func, args).then(function (r) {
      if (!r.ok || !r.value || r.value.code !== 'no_hands') return r;
      return inject(tabId, rules).then(function (boot) {
        if (!boot.ok) return { ok: false, error: boot.error };
        return exec(tabId, func, args);
      });
    });
  }

  function settle(tabId, before, quick) {
    var start = Date.now();
    return sleep(quick ? 120 : 250).then(function poll() {
      return getTab(tabId).then(function (tab) {
        if (!tab) return null;
        var moving = tab.status === 'loading';
        if (!moving || Date.now() - start > LOAD_MS) {
          if (moving || tab.url === before || !tab.url) return tab;
          return sleep(300).then(function () { return getTab(tabId); });
        }
        return sleep(200).then(poll);
      });
    });
  }

  function cleanStep(a) {
    var out = {};
    STEP_KEYS.forEach(function (k) {
      var v = a[k];
      if (v == null || v === '') return;
      if (typeof v === 'string') out[k] = v.slice(0, k === 'text' ? 20000 : 500);
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    });
    return out;
  }

  function stepLabel(a) {
    var act = actionOf(a);
    var what = a.target ? clip(a.target, 70) : (a.url ? clip(a.url, 70) : '');
    if (act === 'type' || act === 'fill' || act === 'paste' || act === 'append') return (act === 'paste' || act === 'append' ? 'Paste' : 'Type') + ' "' + clip(a.text, 40) + '"' + (what ? ' into ' + what : '');
    if (act === 'select' || act === 'choose') return 'Choose "' + clip(a.text || a.option, 40) + '"' + (what ? ' in ' + what : '');
    if (act === 'read' && !what) return 'Read the page';
    if (act === 'scroll' && !what) return 'Scroll ' + String(a.direction || 'down');
    if (NAVIGATES[act] === 1) return 'Go to ' + (what || 'a page');
    return act.charAt(0).toUpperCase() + act.slice(1) + (what ? ' ' + what : '');
  }

  function notAllowed(ctx, info, need, url) {
    var readOnly = need === 'act' && info.access === 'read';
    var out = {
      ok: false,
      code: readOnly ? 'read_only' : 'site_not_allowed',
      host: info.host,
      error: (readOnly
        ? 'ZERACK may only read on ' + info.host + ', not act there.'
        : 'ZERACK is not allowed on ' + info.host + ' yet.') + ' The chat now shows the user an Allow button for this site. Tell them to press it, then ask again. Do not retry now.'
    };
    ctx.seen = ctx.seen || {};
    var key = info.host + '|' + need;
    if (ctx.seen[key]) return Promise.resolve(out);
    ctx.seen[key] = true;
    return Promise.resolve(ctx.add('allow', info.host, { status: 'waiting', host: info.host, pattern: info.pattern, need: need, url: clip(url, 300) })).then(function () { return out; });
  }

  function ledgerFor(ctx, info, a, r, extra) {
    extra = extra || {};
    var act = actionOf(a);
    var decision = extra.decision || (r && r.code === 'refused' ? 'refused' : 'auto');
    var fields = r && r.field ? [{ field: r.field, before: r.before, after: r.after }] : [];
    return Promise.resolve(ctx.ledger({
      convId: ctx.convId,
      host: info.host,
      url: extra.urlBefore || '',
      playbook: info.playbook,
      action: act,
      target: clip(a.target || a.url || '', 300),
      kind: extra.kind || (r && r.kind) || '',
      decision: decision,
      pressed: extra.pressedAt ? { by: 'user', at: extra.pressedAt } : null,
      fields: fields,
      urlBefore: extra.urlBefore || '',
      urlAfter: (r && r.nowAt) || extra.urlAfter || '',
      stateChanged: (r && r.stateChanged) || '',
      result: r && r.ok !== false ? 'done' : (extra.result || 'failed'),
      detail: clip((r && (r.error || r.clicked || r.typed || r.picked)) || '', 600),
      evidence: extra.evidence || null
    })).catch(function () { return null; });
  }

  function answered(x) {
    return !!(x && x.ok && x.value && typeof x.value === 'object');
  }

  function lost(a, tab, x, before) {
    var act = actionOf(a);
    if (x && x.ok) x = { ok: false, error: 'the page gave no answer' };
    return settle(tab.id, before).then(function (now) {
      var moved = !!(now && now.url && now.url !== before);
      if (moved && CLICKS[act] === 1) return { ok: true, clicked: clip(a.target || 'the element', 120), nowAt: now.url, note: 'the page moved to a new address right after the click' };
      if (moved && TYPES[act] === 1 && (a.submit === true || a.submit === 'true')) return { ok: true, typed: clip(a.target || 'the field', 120), submitted: true, nowAt: now.url, note: 'the page moved to a new address right after it was sent' };
      if (moved) return { ok: false, code: 'navigated', nowAt: now.url, error: 'the page moved to ' + now.url + ' during the step, so its answer was lost' };
      if (denied(x.error)) return { ok: false, code: 'site_not_allowed', error: 'Chrome did not let ZERACK into this page: ' + clip(x.error, 200) };
      var sent = CLICKS[act] === 1 || (TYPES[act] === 1 && (a.submit === true || a.submit === 'true'));
      var reloaded = sent && now && now.url ? exec(tab.id, handsHere, []) : Promise.resolve(null);
      return reloaded.then(function (h) {
        if (h && h.ok && h.value === 'gone') {
          if (CLICKS[act] === 1) return { ok: true, clicked: clip(a.target || 'the element', 120), nowAt: now.url, note: 'the page loaded again at the same address right after the click' };
          return { ok: true, typed: clip(a.target || 'the field', 120), submitted: true, nowAt: now.url, note: 'the page loaded again at the same address right after it was sent' };
        }
        if (x.late) return { ok: false, code: 'timeout', error: x.error };
        return { ok: false, error: 'the step could not run on the page: ' + clip(x.error, 200) };
      });
    });
  }

  function askPress(ctx, tab, info, a, first, before) {
    var id = nonce();
    var until = Date.now() + PRESS_MS;
    var row = null;
    var evidence = first.evidence || null;
    var leadLine = first.leadLine || '';
    return Promise.resolve(ctx.add('press', first.line, { status: 'waiting', pressId: id, kind: first.kind, host: info.host, until: until, evidence: evidence ? clip(evidence.line, 300) : '', lead: leadLine })).then(function (r) {
      row = r;
      if (!row) return 'gone';
      ctx.typing('Waiting for your press');
      return new Promise(function (resolve) {
        var over = false;
        var finish = function (how) {
          if (over) return;
          over = true;
          clearTimeout(timer);
          if (pending[ctx.convId] && pending[ctx.convId].id === id) delete pending[ctx.convId];
          resolve(how);
        };
        var timer = setTimeout(function () { finish('timeout'); }, PRESS_MS);
        pending[ctx.convId] = { id: id, finish: finish, tabId: tab.id };
        if (ctx.stopped()) finish('stopped');
      });
    }).then(function (how) {
      if (how !== 'yes') {
        return exec(tab.id, handsRelease, []).then(function () {
          var code = how === 'no' ? 'declined' : (how === 'timeout' ? 'timeout' : 'stopped');
          var words = { declined: 'The user declined, so it did not run: ', timeout: 'Nobody pressed within 120 s, so it did not run: ', stopped: 'The user stopped the chat, so it did not run: ' };
          var out = { ok: false, code: code, kind: first.kind, error: (words[code] || 'Not run: ') + first.line + '. Do not ask again unless the user asks.' };
          if (first.typed) out.typed = first.typed;
          var status = code === 'declined' ? 'declined' : (code === 'timeout' ? 'expired' : 'stopped');
          if (row) ctx.patch(row, { status: status, pressId: id, kind: first.kind, host: info.host, until: until, detail: '', evidence: evidence ? clip(evidence.line, 300) : '', lead: leadLine });
          ledgerFor(ctx, info, a, first.field ? { ok: false, field: first.field, before: first.before, after: first.after } : { ok: false }, { decision: code, kind: first.kind, urlBefore: before, result: code, evidence: evidence });
          return out;
        });
      }
      var pressedAt = Date.now();
      ctx.typing('Working');
      return getTab(tab.id).then(function (now) {
        if (!now || sameAddress(String(now.url || ''), before)) return exec(tab.id, handsPress, [first.handle]);
        return exec(tab.id, handsRelease, []).then(function () {
          return { ok: true, value: { ok: false, code: 'changed', error: 'the page moved to ' + clip(now.url, 200) + ' while the press waited, so nothing was done: ' + first.line } };
        });
      }).then(function (x) {
        if (answered(x)) return x.value;
        return lost({ action: 'click', target: a.target }, tab, x, before).then(function (r) {
          if (!r.ok) return r;
          var out = first.typed ? { ok: true, typed: first.typed, submitted: true, nowAt: r.nowAt } : r;
          out.confirmedByUser = true;
          return out;
        });
      }).then(function (r) {
        if (r && r.ok !== false && r.mayLeave) delete r.mayLeave;
        return settle(tab.id, before, true).then(function (now) {
          if (r && r.ok !== false && now && now.url && now.url !== before && !r.nowAt) r.nowAt = now.url;
          if (first.field && r && !r.field) { r.field = first.field; r.before = first.before; r.after = first.after; }
          ctx.patch(row, { status: r && r.ok !== false ? 'done' : 'failed', pressId: id, kind: first.kind, host: info.host, until: until, pressedAt: pressedAt, evidence: evidence ? clip(evidence.line, 300) : '', lead: leadLine, detail: clip(r && r.ok !== false ? (r.nowAt ? 'Done. The page is now at ' + r.nowAt : 'Done.') : (r && r.error) || 'It did not run.', 300) });
          ledgerFor(ctx, info, a, r, { decision: 'pressed', pressedAt: pressedAt, kind: first.kind, urlBefore: before, evidence: evidence });
          return r;
        });
      });
    });
  }

  function sameAddress(a, b) {
    var cut = function (u) {
      try {
        var x = new URL(u);
        return x.origin + x.pathname + x.search + (/^#[!\/]/.test(x.hash) ? x.hash : '');
      } catch (e) { return String(u || ''); }
    };
    return cut(a) === cut(b);
  }

  function spendCheck(ctx, tab, info, a, first, before) {
    var ask = typeof ctx.evidence === 'function' ? ctx.evidence(info.host, { url: before, what: first.line }) : null;
    var late = new Promise(function (resolve) { setTimeout(function () { resolve({ ok: false, missing: ['the decision store did not answer in time, so no evidence could be read'] }); }, EVIDENCE_MS); });
    var got = ask ? Promise.race([Promise.resolve(ask).then(null, function () { return { ok: false, missing: ['the decision store could not be read'] }; }), late]) : Promise.resolve({ ok: false, missing: ['no decision store is connected, so no evidence can be read'] });
    return got.then(function (ev) {
      if (ev && ev.ok === true) {
        first.evidence = { decision: Number(ev.decision) || 0, line: String(ev.line || '') };
        return askPress(ctx, tab, info, a, first, before);
      }
      return exec(tab.id, handsRelease, []).then(function () {
        var missing = ev && Array.isArray(ev.missing) && ev.missing.length ? ev.missing.slice(0, 5).map(function (m) { return clip(m, 300); }) : ['a measured test on ' + info.host];
        var out = {
          ok: false,
          code: 'needs_evidence',
          kind: 'Pay',
          missing: missing,
          error: 'Not offered: ' + first.line + '. ZERACK offers a press that puts money into ads, boosts or budgets only after a measured test on this site says what is being boosted wins. Missing: ' + missing.join('; ') + '. Tell the user what is missing and that they can still do it themselves on the page. Do not retry.'
        };
        if (ev && ev.line) out.evidence = clip(ev.line, 300);
        ledgerFor(ctx, info, a, { ok: false, error: 'Missing: ' + missing.join('; ') }, { decision: 'no_evidence', kind: 'Pay', urlBefore: before, result: 'no_evidence', evidence: ev && Number(ev.decision) > 0 && ev.line ? { decision: Number(ev.decision), line: ev.line } : null });
        return out;
      });
    });
  }

  function leadCheck(ctx, tab, info, a, first, before) {
    if (typeof ctx.leads !== 'function') return askPress(ctx, tab, info, a, first, before);
    var w = where(before);
    var typed = typedOf(tab.id);
    if (TYPES[actionOf(a)] === 1 && a.text) typed = typed.concat([{ text: String(a.text) }]);
    var failed = { ok: false, code: 'lead_store', why: 'the lead store did not answer in time, so no send is offered' };
    var late = new Promise(function (resolve) { setTimeout(function () { resolve(failed); }, EVIDENCE_MS); });
    var ask = Promise.resolve(ctx.leads({ host: info.host, path: w.path, url: before, lead: clip(a.lead || '', 40), typed: typed })).then(null, function () { return failed; });
    return Promise.race([ask, late]).then(function (v) {
      if (v && v.ok === true && !v.lead) return askPress(ctx, tab, info, a, first, before);
      if (v && v.ok === true) {
        first.leadLine = clip(v.line, 300);
        return askPress(ctx, tab, info, a, first, before).then(function (r) {
          if (r && r.ok !== false && typeof ctx.leadSent === 'function') {
            forget(tab.id);
            r.lead = v.lead.id;
            return Promise.resolve(ctx.leadSent(v.lead.id, info)).then(function () { return r; }, function () { return r; });
          }
          return r;
        });
      }
      return exec(tab.id, handsRelease, []).then(function () {
        var why = clip((v && v.why) || 'the lead rules said no', 400);
        var said = why.charAt(0).toUpperCase() + why.slice(1);
        var out = { ok: false, code: (v && v.code) || 'lead_blocked', kind: first.kind, why: said, error: 'Not offered: ' + first.line + '. ' + said + '.' + (v && v.hint ? ' To do it: ' + clip(v.hint, 200) + '.' : '') + ' Tell the user why in one line and do not retry.' };
        if (v && v.lead) out.lead = v.lead;
        ledgerFor(ctx, info, a, { ok: false, error: why }, { decision: 'lead_blocked', kind: first.kind, urlBefore: before, result: 'lead_blocked' });
        return out;
      });
    });
  }

  function navigate(ctx, tab, info, a) {
    var raw = String(a.url || '').trim();
    if (!raw && /^(https?:)?\/\//i.test(String(a.target || '').trim())) raw = String(a.target).trim();
    var u = null;
    try { u = new URL(raw, tab.url); } catch (e) {}
    if (!u || !sites().parse(u.href)) return Promise.resolve({ ok: false, error: 'navigate needs an http or https address' });
    var before = String(tab.url || '');
    return accessFor(u.href).then(function (dest) {
      var priv = privateOf(u.href);
      if (priv) return refusePrivate(dest.host, priv);
      if (!sites().allows(dest.access, 'read')) return notAllowed(ctx, dest, 'read', u.href);
      if (a.newTab === true || a.newTab === 'true') {
        return new Promise(function (resolve) {
          chrome.tabs.create({ url: u.href, active: false }, function (t) {
            var err = chrome.runtime.lastError;
            resolve(err || !t ? { ok: false, error: 'the new tab did not open' } : { ok: true, openedInNewTab: u.href, note: 'zerackPage keeps acting on the tab it started on, not on the new one' });
          });
        });
      }
      var paced = typeof ctx.pace === 'function' ? Promise.resolve(ctx.pace(dest.host, u.pathname)).then(null, function () { return 0; }) : Promise.resolve(0);
      return paced.then(function () {
        return new Promise(function (resolve) {
          chrome.tabs.update(tab.id, { url: u.href }, function () { resolve(!chrome.runtime.lastError); });
        });
      }).then(function (okNav) {
        if (!okNav) return { ok: false, error: 'the tab did not move to ' + u.href };
        return sleep(200).then(function () { return settle(tab.id, before); }).then(function (now) {
          var r = { ok: true, nowAt: now ? now.url : u.href };
          if (now && now.title) r.title = clip(now.title, 120);
          ledgerFor(ctx, info, a, r, { urlBefore: before });
          return r;
        });
      });
    });
  }

  function step(ctx, raw) {
    var a = raw && typeof raw === 'object' ? raw : {};
    var act = actionOf(a);
    var need = ACTIONS[act];
    if (!need) return Promise.resolve({ ok: false, error: 'unknown action "' + clip(a.action, 30) + '", use read, click, type, paste, select, scroll, wait or navigate' });
    if (ctx.stopped()) return Promise.resolve({ ok: false, code: 'stopped', error: 'not run, the user pressed Stop' });
    return Promise.resolve(ctx.agentOn()).then(function (on) {
      if (!on) return { ok: false, code: 'agent_off', error: 'not run: acting is switched off. Tell the user to turn on the Agent switch in the chat, then ask again. Do not retry.' };
      return getTab(ctx.tabId).then(function (tab) {
        if (!tab) return { ok: false, code: 'no_tab', error: 'the tab ZERACK was working on is closed' };
        var url = String(tab.url || '');
        if (!sites().scriptable(url)) return { ok: false, code: 'not_scriptable', error: 'ZERACK cannot work on this page (' + clip(url, 80) + '). Only web pages can be read and acted on.' };
        return accessFor(url).then(function (acc) {
          var info = { host: acc.host, pattern: acc.pattern, access: acc.access, playbook: playbookOf(url) || sites().playbookFor(acc.host) };
          if (sites().isYouTube(acc.host)) return { ok: false, code: 'youtube', error: 'this tab is on YouTube: hand YouTube work to zerackYouTubeAgent instead' };
          var priv = NAVIGATES[act] === 1 ? null : privateOf(url);
          if (priv) return refusePrivate(acc.host, priv);
          var kept = need === 'act' ? keptReadOnly(url) : null;
          if (kept && NAVIGATES[act] === 1) need = 'read';
          else if (kept) return { ok: false, code: 'kept_read_only', host: acc.host, error: 'ZERACK only reads ' + acc.host + ': ' + kept.why + '. Tell the user this step is theirs to do. Do not retry.' };
          if (!sites().allows(acc.access, need)) return notAllowed(ctx, info, need, url);
          if (NAVIGATES[act] === 1) return navigate(ctx, tab, info, a);
          var clean = cleanStep(a);
          var fromReply = String(a.textFrom || '').toLowerCase() === 'last_reply';
          return Promise.resolve(fromReply ? ctx.lastReply() : null).then(function (reply) {
            if (fromReply) {
              if (!reply) return { ok: false, error: 'there is no earlier reply in this chat to paste' };
              clean.text = String(reply).slice(0, 20000);
            }
            var before = url;
            return inPage(tab.id, handsStep, [clean], rulesFor(url)).then(function (x) {
              if (!answered(x)) {
                return lost(a, tab, x, before).then(function (r) {
                  if (r.code === 'site_not_allowed') return notAllowed(ctx, { host: info.host, pattern: info.pattern, access: 'none' }, need, url);
                  if (r.ok !== false && need === 'act') ledgerFor(ctx, info, a, r, { urlBefore: before });
                  return r;
                });
              }
              var r = x.value;
              if (TYPES[act] === 1 && clean.text && (r.ok !== false || r.code === 'needs_press')) remember(tab.id, clean.text);
              if (r.code === 'needs_press' && r.handle) {
                if (r.kind === 'Pay' && r.spend !== false && r.informed === true) return spendCheck(ctx, tab, info, a, r, before);
                if (r.kind === 'Send' || a.lead) return leadCheck(ctx, tab, info, a, r, before);
                return askPress(ctx, tab, info, a, r, before);
              }
              var wrote = need === 'act';
              var settled = wrote ? settle(tab.id, before, !r.mayLeave) : Promise.resolve(null);
              return settled.then(function (now) {
                if (r.mayLeave) delete r.mayLeave;
                if (now && now.url && now.url !== before && !r.nowAt) r.nowAt = now.url;
                if (fromReply && r.ok !== false) r.source = 'your last reply';
                if (wrote && (r.ok !== false || r.code === 'refused' || r.code === 'sensitive')) ledgerFor(ctx, info, a, r, { urlBefore: before, decision: r.code === 'refused' || r.code === 'sensitive' ? 'refused' : 'auto' });
                return r;
              });
            });
          });
        });
      });
    });
  }

  function plan(ctx, args) {
    var steps = Array.isArray(args && args.steps) ? args.steps.slice(0, PLAN_MAX) : [];
    if (!steps.length) return Promise.resolve({ ok: false, error: 'zerackPagePlan needs steps, each one an action with its target' });
    var done = [];
    return steps.reduce(function (chain, s, i) {
      return chain.then(function (stop) {
        if (stop) return true;
        if (ctx.stopped()) { done.push({ step: i + 1, did: stepLabel(s || {}), result: { ok: false, code: 'stopped', error: 'not run, the user pressed Stop' } }); return true; }
        if (ctx.progress) ctx.progress(i + 1, steps.length, stepLabel(s || {}));
        return step(ctx, s).then(function (r) {
          done.push({ step: i + 1, did: stepLabel(s || {}), result: r });
          return !r || r.ok === false;
        });
      });
    }, Promise.resolve(false)).then(function () {
      var failed = done.filter(function (d) { return !d.result || d.result.ok === false; })[0];
      var out = { ok: !failed, ran: done.length, of: steps.length, steps: done };
      if (failed) {
        out.stoppedAt = failed.step;
        out.error = 'step ' + failed.step + ' (' + failed.did + ') did not work: ' + String((failed.result && failed.result.error) || 'no answer');
        if (failed.result && failed.result.code) out.code = failed.result.code;
        if (failed.result && Array.isArray(failed.result.missing)) out.missing = failed.result.missing;
        if (failed.result && failed.result.why) out.why = failed.result.why;
      }
      if (steps.length < ((args && args.steps) || []).length) out.note = 'only the first ' + PLAN_MAX + ' steps run in one plan';
      return out;
    });
  }

  function extractStep(id, opts) {
    if (!self.NSP_EXTRACT || typeof self.NSP_EXTRACT.read !== 'function') return { ok: false, code: 'no_extract' };
    return self.NSP_EXTRACT.read(id, opts);
  }

  function injectExtract(tabId) {
    return new Promise(function (resolve) {
      try {
        chrome.scripting.executeScript({ target: { tabId: tabId, frameIds: [0] }, world: 'ISOLATED', files: EXTRACT_FILES }).then(function () { resolve({ ok: true }); }, function (e) { resolve({ ok: false, error: String((e && e.message) || e) }); });
      } catch (e) { resolve({ ok: false, error: String((e && e.message) || e) }); }
    });
  }

  function plainOpts(o) {
    var out = {};
    if (!o || typeof o !== 'object') return out;
    try { out = JSON.parse(JSON.stringify(o)); } catch (e) { out = {}; }
    return out;
  }

  function pickReader(pbId, url, args) {
    var P = playbooks();
    var w = where(url);
    var asked = String((args && args.reader) || '').trim().slice(0, 60);
    var limit = Number(args && args.limit);
    var withLimit = function (opts) {
      var o = plainOpts(opts);
      if (limit > 0) o.limit = Math.min(EXTRACT_MAX, Math.floor(limit));
      return o;
    };
    var found = null;
    if (asked && P) {
      found = pbId ? P.reader(pbId, asked) : null;
      if (!found) P.list().some(function (pb) { found = P.reader(pb.id, asked); return !!found; });
    }
    if (!found && !asked && P && pbId) found = P.readerFor(pbId, w.host, w.path);
    if (found) return { id: found.id, as: found.as, opts: withLimit(found.opts) };
    return { id: asked, as: asked || 'auto', opts: withLimit(null) };
  }

  function extract(ctx, args) {
    args = args && typeof args === 'object' ? args : {};
    if (ctx.stopped()) return Promise.resolve({ ok: false, code: 'stopped', error: 'not run, the user pressed Stop' });
    return Promise.resolve(ctx.agentOn()).then(function (on) {
      if (!on) return { ok: false, code: 'agent_off', error: 'not run: reading the page is switched off. Tell the user to turn on the Agent switch in the chat, then ask again. Do not retry.' };
      return getTab(ctx.tabId).then(function (tab) {
        if (!tab) return { ok: false, code: 'no_tab', error: 'the tab ZERACK was working on is closed' };
        var url = String(tab.url || '');
        if (!sites().scriptable(url)) return { ok: false, code: 'not_scriptable', error: 'ZERACK cannot read this page (' + clip(url, 80) + ').' };
        return accessFor(url).then(function (acc) {
          var pbId = playbookOf(url);
          var info = { host: acc.host, pattern: acc.pattern, access: acc.access, playbook: pbId || sites().playbookFor(acc.host) };
          if (sites().isYouTube(acc.host)) return { ok: false, code: 'youtube', error: 'this tab is on YouTube: hand YouTube work to zerackYouTubeAgent instead' };
          var priv = privateOf(url);
          if (priv) return refusePrivate(acc.host, priv);
          if (!sites().allows(acc.access, 'read')) return notAllowed(ctx, info, 'read', url);
          var pick = pickReader(pbId, url, args);
          var once = function () { return exec(tab.id, extractStep, [pick.id, pick.opts]); };
          return once().then(function (x) {
            if (x.ok && x.value && x.value.code === 'no_extract') {
              return injectExtract(tab.id).then(function (boot) { return boot.ok ? once() : { ok: false, error: boot.error }; });
            }
            return x;
          }).then(function (x) {
            if (!answered(x)) {
              if (denied(x.error)) return notAllowed(ctx, { host: info.host, pattern: info.pattern, access: 'none' }, 'read', url);
              return { ok: false, code: x.late ? 'timeout' : 'no_answer', error: 'the page did not answer the reader: ' + clip(x.error, 200) };
            }
            var r = x.value;
            r.host = info.host;
            r.playbook = pbId;
            if (pick.as && pick.as !== 'auto') r.asked = pick.as;
            return r;
          });
        });
      });
    });
  }

  function run(name, args, ctx) {
    args = args && typeof args === 'object' ? args : {};
    if (name === 'zerackPagePlan') return plan(ctx, args);
    if (name === 'zerackExtract') return extract(ctx, args);
    return step(ctx, args);
  }

  function confirm(convId, pressId, yes) {
    var p = pending[String(convId || '')];
    if (!p || !pressId || p.id !== String(pressId)) return false;
    p.finish(yes === true ? 'yes' : 'no');
    return true;
  }

  function halt(convId, tabId) {
    var p = pending[String(convId || '')];
    if (p) p.finish('stopped');
    if (tabId >= 0) exec(tabId, handsStop, []);
  }

  function waiting(convId) {
    return !!pending[String(convId || '')];
  }

  root.NSP_PAGE_AGENT = Object.freeze({
    pressMs: PRESS_MS,
    planMax: PLAN_MAX,
    site: site,
    accessFor: accessFor,
    playbookOf: playbookOf,
    rulesFor: rulesFor,
    privateOf: privateOf,
    run: run,
    confirm: confirm,
    halt: halt,
    waiting: waiting,
    stepLabel: stepLabel
  });
})(typeof self !== 'undefined' ? self : this);
