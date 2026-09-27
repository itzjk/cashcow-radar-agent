(function (root) {
  var MAX_ROUNDS = 10;
  var MAX_STEPS = 40;
  var HISTORY = 12;
  var OLD_RESULT_CHARS = 900;

  var LABELS = {
    nspGetSavedNiches: 'Read your saved niches',
    nspSaveNiche: 'Save a niche',
    nspListTabs: 'List your open tabs',
    nspFetchUrl: 'Read a page',
    nspGetChannelStats: 'Read channel stats',
    nspGetChannelVideos: 'Read channel uploads',
    nspExportNiches: 'Export saved niches',
    nspAddToTracking: 'Track a channel',
    zerackGetExtensionData: 'Read ZERACK data',
    zerackCourse: 'Read the course',
    zerackBrowser: 'Browser',
    zerackOpenPage: 'Open a ZERACK page',
    zerackYouTubeAgent: 'Ask the YouTube agent',
    zerackPage: 'On the page',
    zerackPagePlan: 'On the page'
  };

  var BROWSER_LABELS = {
    open_url: 'Open', search_youtube: 'Search YouTube for', youtube: 'Open YouTube', back: 'Go back', forward: 'Go forward',
    reload: 'Reload the tab', new_tab: 'Open a new tab', close_tab: 'Close the tab', next_tab: 'Next tab', prev_tab: 'Previous tab', switch_tab: 'Switch to tab'
  };

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function pageStep(a) {
    a = a && typeof a === 'object' ? a : {};
    var act = String(a.action || '').toLowerCase();
    var what = a.target ? clip(a.target, 60) : (a.url ? clip(String(a.url).replace(/^https?:\/\//, ''), 60) : '');
    if (act === 'type' || act === 'fill' || act === 'paste' || act === 'append') {
      var val = String(a.textFrom || '').toLowerCase() === 'last_reply' ? 'your last reply' : '"' + clip(a.text, 36) + '"';
      return (act === 'paste' || act === 'append' ? 'Paste ' : 'Type ') + val + (what ? ' into ' + what : '');
    }
    if (act === 'select' || act === 'choose') return 'Choose "' + clip(a.text || a.option, 36) + '"' + (what ? ' in ' + what : '');
    if (act === 'read') return what ? 'Read ' + what : 'Read the page';
    if (act === 'scroll' && !what) return 'Scroll ' + String(a.direction || 'down');
    if (act === 'navigate' || act === 'goto' || act === 'open') return 'Go to ' + (what || 'a page');
    if (act === 'wait') return 'Wait for ' + (what || 'the page');
    return (act ? act.charAt(0).toUpperCase() + act.slice(1) : 'Act') + (what ? ' ' + what : '');
  }

  function label(name, args) {
    args = args && typeof args === 'object' ? args : {};
    if (name === 'zerackPage') return pageStep(args);
    if (name === 'zerackPagePlan') {
      var n = Array.isArray(args.steps) ? args.steps.length : 0;
      return n === 1 ? pageStep(args.steps[0]) : 'Run ' + n + ' steps on the page';
    }
    if (name === 'zerackBrowser') {
      var head = BROWSER_LABELS[String(args.action || '')] || 'Browser';
      var what = args.query || args.url || (args.tabId != null && args.tabId !== '' ? String(args.tabId) : '');
      return what ? head + ' ' + clip(what, 60) : head;
    }
    var base = LABELS[name] || name;
    var d = args.lesson || args.query || args.url || args.channelUrl || args.page || args.area || args.instruction || args.channelName || args.title || args.format || '';
    return d ? base + ' ' + clip(d, 60) : base;
  }

  var PAGE_ENDS = { stopped: 'Stopped before it ran', declined: 'You cancelled it, so nothing was done', timeout: 'Nobody pressed within 2 minutes, so nothing was done' };

  function roleless(s) {
    return String(s || '').replace(/^(?:button|link|tab|textbox|searchbox|combobox|listbox|checkbox|switch|radio|option|menuitem|menuitemradio|menuitemcheckbox|heading) (?=")/, '');
  }

  function address(u) {
    return String(u || '').replace(/^https?:\/\//, '');
  }

  function change(result) {
    if (!result.field) return '';
    var before = clip(result.before, 40), after = clip(result.after, 40);
    return clip(roleless(result.field), 50) + ' was ' + (before ? '"' + before + '"' : 'empty') + ', now ' + (after ? '"' + after + '"' : 'empty');
  }

  function note(result) {
    if (!result || typeof result !== 'object') return '';
    if (result.ok === false && result.code === 'agent_off') return 'Not run: the Agent switch is off';
    if (result.ok === false && result.code === 'site_not_allowed') return 'Not allowed on ' + (result.host || 'this site') + ' yet';
    if (result.ok === false && result.code === 'read_only') return 'Only reading is allowed on ' + (result.host || 'this site');
    if (result.ok === false && result.code === 'refused' && result.why) return clip('Refused: ' + result.why + '. Only you can do this', 160);
    if (result.ok === false && result.code === 'sensitive') return 'Refused: this field is yours to fill in';
    if (result.ok === false && PAGE_ENDS[result.code]) return PAGE_ENDS[result.code];
    if (result.ok === false) return clip(result.error || result.code || 'failed', 160);
    if (typeof result.ran === 'number' && typeof result.of === 'number') return result.ran + ' of ' + result.of + ' steps done';
    if (result.field) return change(result);
    if (result.clicked || result.picked) {
      var did = result.picked ? 'Picked ' + roleless(result.picked) : 'Done';
      if (result.confirmedByUser) did += ' after your press';
      if (result.nowAt) did += ', now at ' + address(result.nowAt);
      else if (result.stateChanged) did += ' (' + result.stateChanged + ')';
      return clip(did, 160);
    }
    var page = result.typed || result.found || result.scrolledTo || result.openedInNewTab || '';
    if (page) return clip(page + (result.nowAt ? ', now at ' + address(result.nowAt) : ''), 160);
    if (result.pageData) return clip(result.read ? 'Read ' + roleless(result.read) : (result.title ? 'Read "' + result.title + '"' : 'Read ' + address(result.url || 'the page')), 160);
    if (result.nowAt) return clip('Now at ' + address(result.nowAt), 160);
    if (typeof result.line === 'string' && result.line) return clip(result.line, 160);
    if (typeof result.answer === 'string' && result.answer) return clip(result.answer, 160);
    if (typeof result.count === 'number') return result.count + ' items';
    if (typeof result.exported === 'number') return result.exported + ' exported';
    if (Array.isArray(result.lessons)) return result.lessons.map(function (l) { return l.id; }).join(', ');
    if (typeof result.status === 'number') return 'HTTP ' + result.status;
    return 'ok';
  }

  function history(list) {
    return (list || []).filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && String(m.text || m.content || '').trim();
    }).map(function (m) {
      return { role: m.role, content: String(m.text != null ? m.text : m.content) };
    }).slice(-HISTORY);
  }

  function compact(list) {
    var toolIdx = [];
    list.forEach(function (m, i) { if (m.tool) toolIdx.push(i); });
    var keep = toolIdx.slice(-2);
    return list.map(function (m, i) {
      var c = String(m.content || '');
      if (m.tool && keep.indexOf(i) === -1 && c.length > OLD_RESULT_CHARS) c = c.slice(0, OLD_RESULT_CHARS) + '\n[older tool results trimmed]';
      return { role: m.role, content: c };
    });
  }

  function summary(results, steps, maxSteps) {
    var brain = root.NSP_BRAIN;
    if (brain && typeof brain.toolSummary === 'function') return brain.toolSummary(results, { stepsUsed: steps, maxSteps: maxSteps });
    return 'Results of the tools you just called:\n' + results.map(function (r) { return r.name + ': ' + JSON.stringify(r.result).slice(0, 1500); }).join('\n');
  }

  var ACCESS = {
    act: 'ZERACK is allowed to read and act on that site, so zerackPage works there.',
    read: 'ZERACK may only read that site: zerackPage reads it, and acting answers read_only until the user allows it from the chat.',
    none: 'ZERACK is not allowed on that site yet: zerackPage answers site_not_allowed and the chat shows the user an Allow button.'
  };

  function context(o) {
    o = o || {};
    var day = new Date(Number(o.now) || Date.now()).toISOString().slice(0, 10);
    var lang = o.lang === 'es' ? 'Spanish' : (o.lang === 'en' ? 'English' : 'the language of their message');
    var site = o.site && typeof o.site === 'object' && o.site.web === true && o.site.host ? o.site : null;
    return 'CONTEXT: today is ' + day + '. The user ' + (o.surface === 'voice' ? 'speaks' : 'writes') + ' ' + lang + '; answer in that language. '
      + (o.agentOn === true
        ? 'The Agent switch is on, so the tools that act in the browser are in your list.'
        : 'The Agent switch is off, so the tools that change things (opening pages, browser actions, saving, tracking, exporting, acting on the page) are not in your list. When the user asks for one, say that the Agent switch in the chat or in the ZERACK popup turns them on.')
      + (site ? ' The tab next to this chat is on ' + site.host + '. ' + (o.agentOn === true ? (ACCESS[site.access] || ACCESS.none) : '') : '');
  }

  function loop(o) {
    var maxRounds = Number(o.maxRounds) > 0 ? Number(o.maxRounds) : MAX_ROUNDS;
    var maxSteps = Number(o.maxSteps) > 0 ? Number(o.maxSteps) : MAX_STEPS;
    var api = (o.messages || []).map(function (m) { return { role: m.role, content: String(m.content || '') }; });
    var rounds = 0, steps = 0, last = null, texts = [];
    var stopped = function () { return typeof o.stopped === 'function' && o.stopped(); };

    function end(out) {
      out.rounds = rounds;
      out.steps = steps;
      out.provider = last ? String(last.provider || '') : '';
      out.model = last ? String(last.modelUsed || '') : '';
      out.text = out.text || texts[texts.length - 1] || '';
      if (out.text && out.error === 'empty_answer') { out.ok = true; out.error = ''; }
      return out;
    }

    function round() {
      if (stopped()) return Promise.resolve(end({ ok: false, error: 'stopped' }));
      if (rounds >= maxRounds) return Promise.resolve(end({ ok: texts.length > 0, error: 'round_cap' }));
      rounds++;
      var capReached = steps >= maxSteps;
      if (capReached) api.push({ role: 'user', content: 'The cap of ' + maxSteps + ' steps is used up and no more tools can run. Tell the user which steps ran and which did not, using only the results above.' });
      var payload = { messages: compact(api), systemParts: o.systemParts, maxTokens: o.maxTokens || 1200 };
      if (!capReached && o.tools) payload.tools = o.tools;
      return Promise.resolve(o.ask(payload)).then(function (res) {
        if (stopped()) return end({ ok: false, error: 'stopped' });
        if (!res || res.ok !== true) return end({ ok: false, error: String((res && res.error) || 'no_answer'), detail: res && res.detail ? String(res.detail) : '' });
        last = res;
        var text = String(res.text || '').trim();
        var calls = Array.isArray(res.functionCalls) ? res.functionCalls : [];
        if (text) {
          texts.push(text);
          api.push({ role: 'assistant', content: text });
          if (o.onText) o.onText(text, res, calls.length > 0 && !capReached);
        }
        if (!calls.length || capReached) return end({ ok: !!text, error: text ? '' : 'empty_answer', text: text });
        var results = [];
        return calls.reduce(function (chain, call) {
          return chain.then(function () {
            var name = String((call && call.name) || '');
            var args = call && call.args && typeof call.args === 'object' ? call.args : {};
            if (stopped()) { results.push({ name: name, args: args, result: { ok: false, code: 'stopped', error: 'not run, the user pressed Stop' } }); return; }
            if (steps >= maxSteps) { results.push({ name: name, args: args, result: { ok: false, code: 'step_cap', error: 'not run, the cap of ' + maxSteps + ' steps is used up' } }); return; }
            steps++;
            var handle = o.onToolStart ? o.onToolStart(name, args) : null;
            return Promise.resolve(o.run(name, args)).then(function (result) {
              return result && typeof result === 'object' ? result : { ok: false, error: 'no result' };
            }, function (e) {
              return { ok: false, error: String((e && e.message) || e) };
            }).then(function (result) {
              results.push({ name: name, args: args, result: result });
              if (o.onToolEnd) o.onToolEnd(handle, name, args, result);
            });
          });
        }, Promise.resolve()).then(function () {
          api.push({ role: 'user', content: summary(results, steps, maxSteps), tool: true });
          return round();
        });
      });
    }
    return round();
  }

  root.NSP_CHAT_TOOLS = Object.freeze({
    maxRounds: MAX_ROUNDS,
    maxSteps: MAX_STEPS,
    label: label,
    note: note,
    history: history,
    context: context,
    loop: loop
  });
})(typeof self !== 'undefined' ? self : this);
