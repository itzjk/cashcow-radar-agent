(function (root) {
  if (Object.prototype.hasOwnProperty.call(root, 'NSP_BUILDERS')) return;
  var owns = Object.prototype.hasOwnProperty;
  var DAY = 86400000;
  var HOUR = 3600000;
  var X_ONE = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
  var URL_RE = /\bhttps?:\/\/[^\s]+/gi;
  var SOURCE_NAMES = { 'github.com': 'GitHub', 'news.ycombinator.com': 'Hacker News', 'www.reddit.com': 'Reddit', 'old.reddit.com': 'Reddit', 'reddit.com': 'Reddit', 'www.producthunt.com': 'Product Hunt', 'producthunt.com': 'Product Hunt', 'huggingface.co': 'Hugging Face' };

  var STOP = {};
  ('a about above after again against all almost also am an and any anyone anything are around as at be because been before being below between both but by can cannot could did do does doing done dont down during each either else even ever every few for from further get gets getting go going got had has have having he her here hers him his how i id if im in into is isnt it its itself ive just know let like lot lots make makes many may maybe me might mine more most much must my myself need needs new nice no nor not now of off on once one only or other our ours out over own please pretty quite rather really same see seems she should so some something still such than thank thanks that thats the their theirs them then there these they thing things think this those though through to too under until up us use used uses using very via want wants was way we well were what whats when where which while who whom why will wish with without would yes yet you your youre yours yourself ' +
    'add added adding ability able allow allows app awesome better cool currently easier easy feature features great hope idea ideas included include issue issues love option options project request requests support supported supports tool tools work works working great good cool nice suggestion enhancement plan plans possible possibility sometimes someday soon today ' +
    'hn show ask thread post comment comments reply lol thx per same here honestly pay paid version versions right hand last year week day time put numbers eyes'.split(' ').join(' ')).split(' ').forEach(function (w) { if (w) STOP[w] = 1; });

  var SYN = { mozilla: 'firefox', ff: 'firefox', chromium: 'chrome', android: 'mobile', ios: 'mobile', iphone: 'mobile', ipad: 'mobile', phone: 'mobile', csv: 'export', exports: 'export', exporting: 'export', xlsx: 'export', excel: 'export', translation: 'language', translations: 'language', translate: 'language', i18n: 'language', localization: 'language', languages: 'language', darkmode: 'dark', night: 'dark', selfhost: 'selfhosted', selfhosting: 'selfhosted', docker: 'selfhosted', api: 'api', webhook: 'api', webhooks: 'api', sso: 'login', oauth: 'login', signin: 'login' };

  var BUG_LABEL = /^(bug|defect|regression|crash|type: ?bug|kind\/bug)$/i;
  var WANT_LABEL = /(enhancement|feature|request|idea|proposal|suggestion|wishlist)/i;
  var BUG_WORDS = /\b(bug|crash(es|ed|ing)?|error|errors|broken|breaks|fails?|failing|failed|exception|doesn'?t work|does not work|not working|can'?t|cannot|won'?t|undefined|null|404|500|regression|stuck|freez(e|es)|wrong)\b/i;
  var WANT_WORDS = /\b(please|would love|would be (great|nice|cool|awesome|useful|helpful)|it would help|wish (it|there|you|i could)|please (add|support|make|consider)|feature request|any plans?|plans? (to|for) (add|support)|can (it|you) (add|support)|could (it|you) (add|support)|does it support|is there (a|an|any) way|support for|add (a |an )?(support|option|way|setting|mode|button)|missing|i'?d pay|would pay|integrat(e|ion) with|export (to|as)|option to|ability to|allow (me|us|users) to|let (me|us|users))\b/i;
  var ASK_WORDS = /\b(is there (a|an|any) (tool|app|extension|service|way|site|plugin|library)|are there any (tools?|apps?|extensions?|services?|alternatives?)|does anyone know (of |a |an |any )?|anyone know (of|a|an|any)|looking for (a|an|some|something|any)|recommend(ations?)? (for|a|an|me|any)|any (good )?(tools?|apps?|extensions?|alternatives?|recommendations?)|alternatives? to|what do you (use|all use) (for|to)|how do you (find|track|keep track|know|measure|check|analy[sz]e|monitor|spot)|i wish there (was|were)|i'?d pay for|would pay for|need a (tool|way|app|service))\b/i;
  var MARKETING = /\b(best|amazing|revolutionary|ultimate|incredible|awesome|game.?changing|world.?class|cutting.?edge|groundbreaking|blazing|insane|next.?gen|unbelievable|stunning|powerful)\b/i;
  var ACRONYM = /^(API|APIS|AI|ML|LLM|LLMS|MIT|CSS|HTML|JSON|URL|URLS|SQL|CLI|GPU|CPU|SDK|UI|UX|OSS|SAAS|MRR|CSV|PDF|RSS|HTTP|HTTPS|SSH|DNS|AWS|GCP|IOS|MCP|RAG|OCR|TTS|STT|JS|TS|NPM|PYPI|USA|EU|UK|FAQ|DIY|IDE|VPN|GDPR|SEO|CRM|ERP|B2B|B2C)$/;
  var NOISE_TYPES = { docs: 1, test: 1, tests: 1, chore: 1, ci: 1, build: 1, style: 1, wip: 1 };
  var CONV_MAP = { feat: 'Added', feature: 'Added', fix: 'Fixed', bugfix: 'Fixed', hotfix: 'Fixed', perf: 'Changed', refactor: 'Changed', revert: 'Changed', security: 'Security', deprecate: 'Deprecated', remove: 'Removed' };
  var GROUP_ORDER = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
  var SHORT_ASK = 2;
  var HEAD_SKIP = /^(install(ation|ing)?|license|licence|contributing|contributors?|table of contents|contents|credits|acknowledg(e)?ments?|changelog|faq|support|sponsors?|development|build|building|tests?|testing|limits|permissions.*|setup|getting started|usage|requirements|who can .*|architecture.*|docs|documentation|links|authors?|thanks)$/i;

  function fold(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function squash(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function clip(s, n) {
    s = squash(s);
    return s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s;
  }

  function grouped(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function stem(w) {
    if (owns.call(SYN, w)) return SYN[w];
    if (w.length > 5 && /ies$/.test(w)) w = w.slice(0, -3) + 'y';
    else if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
    else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    return owns.call(SYN, w) ? SYN[w] : w;
  }

  function tokens(text, own) {
    var out = [], seen = {};
    fold(text).replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9+#]+/g, ' ').split(' ').forEach(function (raw) {
      if (!raw || raw.length < 3 && !/^(ui|ux|ai|pdf|csv|api)$/.test(raw) || /^[0-9]+$/.test(raw) || owns.call(STOP, raw)) return;
      var w = stem(raw);
      if (!w || owns.call(STOP, w) || (own && owns.call(own, w)) || seen[w]) return;
      seen[w] = 1;
      out.push({ stem: w, raw: raw });
    });
    return out;
  }

  function ownWords(texts) {
    var own = {};
    (texts || []).forEach(function (t) { tokens(t).forEach(function (x) { own[x.stem] = 1; }); });
    return own;
  }

  function sentences(text) {
    return String(text || '').replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map(squash).filter(Boolean);
  }

  function sourceName(host) {
    return SOURCE_NAMES[String(host || '').toLowerCase()] || String(host || 'the page');
  }

  function isBug(it) {
    var labels = (it.labels || []).map(String);
    if (labels.some(function (l) { return BUG_LABEL.test(l); })) return true;
    if (labels.some(function (l) { return WANT_LABEL.test(l); })) return false;
    return BUG_WORDS.test(it.title || '') && !WANT_WORDS.test(it.title || '');
  }

  function requestText(it) {
    if (it.kind === 'issue') return it.title || '';
    if (it.kind === 'story' || it.kind === 'commit' || it.kind === 'release' || it.kind === 'tag') return '';
    var hits = sentences(it.text).filter(function (s) { return WANT_WORDS.test(s); });
    return hits.length ? hits.slice(0, 2).join(' ') : '';
  }

  function requests(items, opts) {
    opts = opts || {};
    var own = ownWords(opts.own || []);
    var seen = {};
    var bugs = 0, considered = 0;
    var reqs = [];
    (items || []).forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      var key = (it.url || '') + '|' + (it.id || '') + '|' + (it.title || it.text || '').slice(0, 60);
      if (seen[key]) return;
      seen[key] = 1;
      if (it.kind !== 'issue' && it.kind !== 'comment') return;
      considered++;
      if (it.kind === 'issue' && isBug(it)) { bugs++; return; }
      var text = requestText(it);
      if (!text) return;
      var toks = tokens(text, own);
      if (!toks.length) return;
      reqs.push({ it: it, text: text, toks: toks, weight: 1 + Math.max(0, Number(it.n) || 0) });
    });
    var df = {};
    reqs.forEach(function (r) { r.toks.forEach(function (t) { df[t.stem] = (df[t.stem] || 0) + 1; }); });
    var cap = reqs.length >= 6 ? Math.max(2, Math.floor(reqs.length * 0.5)) : Infinity;
    var informative = function (s) { return df[s] >= 2 && df[s] <= cap; };
    reqs.sort(function (a, b) { return ((a.toks.length <= SHORT_ASK ? 0 : 1) - (b.toks.length <= SHORT_ASK ? 0 : 1)) || b.weight - a.weight; });
    var clusters = [];
    reqs.forEach(function (r) {
      var mine = r.toks.map(function (t) { return t.stem; }).filter(informative);
      var short = r.toks.length <= SHORT_ASK;
      var best = null, bestScore = 0;
      clusters.forEach(function (c) {
        var shared = mine.filter(function (s) { return c.counts[s] >= 1; });
        if (!shared.length) return;
        var anchored = shared.some(function (s) { return c.anchors[s] === 1; });
        if (shared.length < 2 && !short && !anchored) return;
        var score = shared.length + shared.length / Math.max(1, Math.min(mine.length, Object.keys(c.counts).length));
        if (score > bestScore) { best = c; bestScore = score; }
      });
      if (!best) { best = { members: [], counts: {}, raw: {}, anchors: {} }; clusters.push(best); }
      best.members.push(r);
      if (short) r.toks.forEach(function (t) { best.anchors[t.stem] = 1; });
      r.toks.forEach(function (t) {
        best.counts[t.stem] = (best.counts[t.stem] || 0) + 1;
        best.raw[t.stem] = best.raw[t.stem] || {};
        best.raw[t.stem][t.raw] = (best.raw[t.stem][t.raw] || 0) + 1;
      });
    });
    var surface = function (c, s) {
      var m = c.raw[s] || {};
      var raw = Object.keys(m).sort(function (a, b) { return m[b] - m[a] || a.length - b.length; })[0] || s;
      var word = raw.replace(/[^a-z0-9]/g, '');
      if (!word) return raw;
      var forms = {};
      c.members.forEach(function (x) { (String(x.text).match(new RegExp('\\b' + word + '[a-z0-9]*', 'gi')) || []).forEach(function (f) { f = f.slice(0, word.length); forms[f] = (forms[f] || 0) + 1; }); });
      if (forms[word]) return word;
      var caps = Object.keys(forms).filter(function (f) { return f === f.toUpperCase(); });
      if (caps.length) return caps[0];
      return Object.keys(forms).sort(function (a, b) { return forms[b] - forms[a]; })[0] || raw;
    };
    var out = clusters.filter(function (c) { return c.members.length >= 2; }).map(function (c) {
      var keys = Object.keys(c.counts).filter(function (s) { return c.counts[s] >= 2; }).sort(function (a, b) { return c.counts[b] - c.counts[a] || df[a] - df[b]; });
      var counted = {};
      c.members.forEach(function (m) { var n = sourceName(m.it.host); counted[n] = (counted[n] || 0) + 1; });
      var sources = {};
      Object.keys(counted).sort(function (a, b) { return counted[b] - counted[a] || (a < b ? -1 : 1); }).forEach(function (k) { sources[k] = counted[k]; });
      var people = {};
      c.members.forEach(function (m) { if (m.it.by) people[m.it.by] = 1; });
      return {
        label: keys.slice(0, 2).map(function (s) { return surface(c, s); }).join(' + '),
        words: keys.slice(0, 4).map(function (s) { return surface(c, s); }),
        count: c.members.length,
        people: Object.keys(people).length,
        weight: c.members.reduce(function (s, m) { return s + m.weight; }, 0),
        sources: sources,
        examples: c.members.slice(0, 6).map(function (m) {
          return { source: sourceName(m.it.host), kind: m.it.kind, text: clip(m.it.kind === 'issue' ? m.it.title : m.text, 160), url: m.it.url || '', n: m.it.n, by: m.it.by || '' };
        })
      };
    }).sort(function (a, b) { return b.count - a.count || Object.keys(b.sources).length - Object.keys(a.sources).length || b.weight - a.weight; }).slice(0, 8);
    var singles = clusters.filter(function (c) { return c.members.length < 2; }).length;
    var line;
    if (!reqs.length) line = considered ? 'None of the ' + considered + ' issues and comments read asks for a feature' + (bugs ? ' (' + bugs + ' bug reports left aside)' : '') + '.' : 'Nothing read yet: read the issues list and the launch threads first.';
    else if (!out.length) line = reqs.length + ' requests read and none repeats: each one was asked once' + (bugs ? '; ' + bugs + ' bug reports left aside' : '') + '.';
    else line = 'The request that repeats most is "' + out[0].label + '": ' + out[0].count + ' times from ' + Object.keys(out[0].sources).map(function (k) { return k + ' ' + out[0].sources[k]; }).join(', ') + (out[1] ? '; then "' + out[1].label + '" ' + out[1].count + ' times' : '') + '. ' + singles + ' requests were asked once' + (bugs ? ', ' + bugs + ' bug reports left aside' : '') + '.';
    return { ok: true, considered: considered, requests: reqs.length, bugsSkipped: bugs, clusters: out, askedOnce: singles, line: line };
  }

  function codeUnits(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (c > 0xffff) i++;
      out.push(c);
    }
    return out;
  }

  function xLength(text, rules) {
    var perUrl = rules && rules.url ? rules.url : 23;
    var s = String(text == null ? '' : text).normalize('NFC');
    var urls = 0;
    s = s.replace(URL_RE, function () { urls++; return ''; });
    var n = 0;
    codeUnits(s).forEach(function (cp) {
      n += X_ONE.some(function (r) { return cp >= r[0] && cp <= r[1]; }) ? 1 : 2;
    });
    return n + urls * perUrl;
  }

  function dayNumber(created, now) {
    var t = Date.parse(String(created || ''));
    if (!isFinite(t)) return null;
    return Math.max(1, Math.floor((now - t) / DAY) + 1);
  }

  function valueAround(points, when) {
    var best = null;
    (points || []).forEach(function (p) {
      if (!p || typeof p.value !== 'number' || !(p.t <= when)) return;
      if (!best || p.t > best.t) best = p;
    });
    return best;
  }

  function shortSubject(s, n) {
    s = squash(s).replace(/^(feat|feature|fix|bugfix|hotfix|perf|refactor|revert|security|deprecate|remove|docs|test|tests|chore|ci|build|style)(\([^)]*\))?!?:\s*/i, '');
    if (/^[a-z]/.test(s) && !/^[a-z]+[-_.][a-z]/i.test(s.split(' ')[0])) s = s.charAt(0).toUpperCase() + s.slice(1);
    if (s.length <= n) return s;
    var cut = /^(.{12,}?)(?:,\s+(?:and|but|so|while)\s|;\s|:\s|\s+-\s)/.exec(s);
    if (cut && cut[1].length <= n) return cut[1];
    var comma = s.slice(0, n + 1).lastIndexOf(', ');
    if (comma >= 20) return s.slice(0, comma);
    return clip(s, n);
  }

  function fit(lines, max, rules) {
    var keep = lines.slice();
    var text = keep.filter(function (l) { return l != null; }).join('\n');
    while (xLength(text, rules) > max && keep.length) {
      var idx = -1;
      for (var i = keep.length - 1; i >= 0; i--) { if (keep[i] && /^- /.test(keep[i])) { idx = i; break; } }
      if (idx < 0) break;
      keep.splice(idx, 1);
      text = keep.filter(function (l) { return l != null; }).join('\n');
    }
    return text.replace(/\n{3,}/g, '\n\n');
  }

  function post(input) {
    input = input || {};
    var rules = input.rules || {};
    var max = rules.max || 280;
    var now = Number(input.now) || Date.now();
    var repo = input.repo || {};
    var name = repo.name || repo.repo || 'the project';
    var url = repo.url || '';
    var commits = (input.commits || []).filter(function (c) { return c && c.at && !/^Merge (pull request|branch)\b/.test(c.title || ''); });
    var today = commits.filter(function (c) { return now - c.at <= DAY && now - c.at >= -HOUR; });
    var rels = (input.releases || []).filter(function (r) { return r && r.at && now - r.at <= DAY; });
    var stars = input.stars || [];
    var starNow = valueAround(stars, now);
    var starThen = starNow ? valueAround(stars, now - 20 * HOUR) : null;
    var starDelta = starNow && starThen && starThen.t < starNow.t ? starNow.value - starThen.value : null;
    var day = dayNumber(repo.created, now);
    var facts = [];
    if (today.length) facts.push({ id: 'commits', text: today.length + ' commit' + (today.length === 1 ? '' : 's') + ' in the last 24 hours', list: today.slice(0, 6).map(function (c) { return { title: c.title, url: c.url }; }) });
    if (rels.length) facts.push({ id: 'release', text: 'release ' + (rels[0].labels && rels[0].labels[0] || rels[0].title) + ' published today', url: rels[0].url });
    if (starNow) facts.push({ id: 'stars', text: grouped(starNow.value) + ' stars' + (starDelta != null ? ' (' + (starDelta >= 0 ? '+' : '') + starDelta + ' since ' + new Date(starThen.t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC)' : ''), value: starNow.value, delta: starDelta });
    if (day) facts.push({ id: 'day', text: 'day ' + day + ' since the repository was created on ' + String(repo.created).slice(0, 10), value: day });
    var why = '';
    var kind = '';
    if (rels.length) { kind = 'release'; why = 'a release went out today, the strongest true thing to post'; }
    else if (today.length) { kind = 'shipped'; why = today.length + ' commit' + (today.length === 1 ? '' : 's') + ' landed in the last 24 hours'; }
    else if (starDelta != null && starDelta > 0) { kind = 'stars'; why = 'no commit today, and the star count moved by ' + starDelta; }
    if (!kind) {
      return { ok: true, decision: 'skip', why: 'no commit, release or new star in the last 24 hours' + (commits.length ? ' (the last commit is from ' + new Date(commits[0].at).toISOString().slice(0, 10) + ')' : '') + ', so there is nothing true to post today', facts: facts, drafts: [], rule: { text: rules.rule || '', source: rules.source || null }, line: 'Nothing to post today: no commit, release or new star in the last 24 hours.' };
    }
    var head = day ? 'Day ' + day + ' building ' + name : 'Building ' + name;
    var drafts = [];
    var bullets = today.slice(0, 4).map(function (c) { return '- ' + shortSubject(c.title, 64); });
    var starLine = starNow ? grouped(starNow.value) + ' star' + (starNow.value === 1 ? '' : 's') + (starDelta ? ' (' + (starDelta > 0 ? '+' : '') + starDelta + ' today)' : '') + '.' : '';
    if (kind === 'release') {
      var tag = rels[0].labels && rels[0].labels[0] ? rels[0].labels[0] : rels[0].title;
      drafts.push({ kind: 'release', text: fit([name + ' ' + tag + ' is out.', '', bullets.length ? 'In it:' : null].concat(bullets).concat(['', rels[0].url || url]), max, rules), uses: ['release'].concat(bullets.length ? ['commits'] : []) });
    }
    if (today.length) {
      var tail = (starLine ? [starLine] : []).concat(url ? [url] : []);
      drafts.push({ kind: 'shipped', text: fit([head + ': shipped ' + today.length + ' change' + (today.length === 1 ? '' : 's') + ' today.', ''].concat(bullets).concat(tail.length ? [''].concat(tail) : []), max, rules), uses: ['commits'].concat(starNow ? ['stars'] : []).concat(day ? ['day'] : []) });
      drafts.push({ kind: 'short', text: fit([name + ' today: ' + shortSubject(today[0].title, 70) + (today.length > 1 ? ', plus ' + (today.length - 1) + ' more' : '') + '.', starLine, url].filter(Boolean), max, rules), uses: ['commits'].concat(starNow ? ['stars'] : []) });
    }
    if (kind === 'stars') {
      drafts.push({ kind: 'stars', text: fit([name + ' got ' + starDelta + ' new star' + (starDelta === 1 ? '' : 's') + ' since yesterday, ' + grouped(starNow.value) + ' in total.', 'Thank you. What should I build next?', url].filter(Boolean), max, rules), uses: ['stars'] });
    }
    var intent = rules.intent || 'https://x.com/intent/tweet';
    drafts.forEach(function (d) {
      d.text = d.text.replace(/\n{3,}/g, '\n\n').trim();
      d.chars = xLength(d.text, rules);
      d.max = max;
      d.fits = d.chars <= max;
      d.intent = intent + '?text=' + encodeURIComponent(d.text);
    });
    return { ok: true, decision: 'post', kind: kind, why: why, facts: facts, drafts: drafts.filter(function (d) { return d.fits; }).slice(0, 3), rule: { text: rules.rule || '', source: rules.source || null, intentSource: rules.intentSource || null }, line: 'Post today: ' + why + '. ' + drafts.length + ' draft' + (drafts.length === 1 ? '' : 's') + ' built only from those numbers.' };
  }

  function classify(subject, body) {
    var s = squash(subject);
    var conv = /^([a-z]+)(\([^)]*\))?(!)?:\s*(.+)$/i.exec(s);
    var breaking = !!(conv && conv[3]) || /BREAKING[ -]CHANGE/.test(String(body || ''));
    if (/^Merge (pull request|branch|remote-tracking)\b/.test(s)) return { group: '', noise: 'merge', breaking: false, text: s };
    if (conv) {
      var type = conv[1].toLowerCase();
      if (owns.call(NOISE_TYPES, type) && !breaking) return { group: '', noise: type, breaking: false, text: conv[4] };
      return { group: CONV_MAP[type] || 'Changed', breaking: breaking, text: conv[4], type: type };
    }
    var f = fold(s);
    if (/^(wip|typo|bump|release|version|v?[0-9]+\.[0-9]+(\.[0-9]+)?$|update readme|readme|docs?\b|lint|format(ting)?\b|tests?\b|ci\b)/.test(f)) return { group: '', noise: 'housekeeping', breaking: false, text: s };
    if (/\b(security|vulnerab\w*|cve-[0-9]+|xss|csrf|injection|leak\w*|privileges?|credentials?|secrets?)\b/.test(f)) return { group: 'Security', breaking: breaking, text: s };
    if (/^(undo|revert)\b.*\b(broke|broken|bug|regression)\b/.test(f)) return { group: 'Fixed', breaking: breaking, text: s };
    if (/^(add|adds|added|new|introduce[sd]?|create[sd]?|implement(s|ed)?|enable[sd]?)\b/.test(f)) return { group: 'Added', breaking: breaking, text: s };
    if (/^(fix|fixes|fixed|repair(s|ed)?|resolve[sd]?|correct(s|ed)?|patch(es|ed)?)\b/.test(f)) return { group: 'Fixed', breaking: breaking, text: s };
    if (/^(remove[sd]?|delete[sd]?|drop(s|ped)?)\b/.test(f)) return { group: 'Removed', breaking: breaking, text: s };
    if (/^(deprecate[sd]?)\b/.test(f)) return { group: 'Deprecated', breaking: breaking, text: s };
    return { group: 'Changed', breaking: breaking, text: s };
  }

  function semverOf(tag) {
    var m = /v?([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(String(tag || ''));
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }

  function changelog(input) {
    input = input || {};
    var now = Number(input.now) || Date.now();
    var rules = input.rules || {};
    var repo = input.repo || {};
    var releases = (input.releases || []).filter(function (r) { return r && (r.title || (r.labels && r.labels[0])); }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    var last = releases[0] || null;
    var lastTag = last ? (last.labels && last.labels[0]) || last.title : '';
    var commits = (input.commits || []).filter(function (c) { return c && c.title; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    var since = last && last.at ? commits.filter(function (c) { return c.at > last.at; }) : commits;
    var groups = {};
    var noise = {};
    var breaking = 0;
    since.forEach(function (c) {
      var k = classify(c.title, c.text);
      if (!k.group) { noise[k.noise] = (noise[k.noise] || 0) + 1; return; }
      if (k.breaking) breaking++;
      (groups[k.group] = groups[k.group] || []).push({ text: shortSubject(k.text, 160) + (k.breaking ? ' (breaking)' : ''), sha: c.id ? String(c.id).slice(0, 7) : '', url: c.url || '' });
    });
    var base = semverOf(lastTag);
    var next = '', bumpWhy = '';
    if (!base) {
      next = '0.1.0';
      bumpWhy = last ? 'the last tag ' + lastTag + ' is not a version number, so this starts at 0.1.0 as SemVer suggests' : 'no release yet, and SemVer suggests starting at 0.1.0; if people already use it in production, SemVer says it should probably already be 1.0.0';
    } else if (breaking) {
      next = base[0] === 0 ? '0.' + (base[1] + 1) + '.0' : (base[0] + 1) + '.0.0';
      bumpWhy = breaking + ' breaking change' + (breaking === 1 ? '' : 's') + (base[0] === 0 ? ', and a 0.y.z version moves its minor number' : ', so the major number moves');
    } else if (groups.Added && groups.Added.length) {
      next = base[0] + '.' + (base[1] + 1) + '.0';
      bumpWhy = groups.Added.length + ' new feature' + (groups.Added.length === 1 ? '' : 's') + ' and nothing breaking, so the minor number moves';
    } else {
      next = base[0] + '.' + base[1] + '.' + (base[2] + 1);
      bumpWhy = 'only changes and fixes, so the patch number moves';
    }
    var prefix = /^v/.test(lastTag) || !base ? 'v' : '';
    var date = new Date(now).toISOString().slice(0, 10);
    var md = '## [' + next + '] - ' + date + '\n';
    var notes = '## What changed\n';
    var total = 0;
    GROUP_ORDER.forEach(function (g) {
      var list = groups[g];
      if (!list || !list.length) return;
      total += list.length;
      md += '\n### ' + g + '\n' + list.map(function (x) { return '- ' + x.text + (x.sha ? ' (' + x.sha + ')' : ''); }).join('\n') + '\n';
      notes += '\n**' + g + '**\n' + list.map(function (x) { return '- ' + x.text; }).join('\n') + '\n';
    });
    var compare = repo.url ? (lastTag ? repo.url + '/compare/' + encodeURIComponent(lastTag) + '...' + encodeURIComponent(prefix + next) : repo.url + '/commits/' + encodeURIComponent(repo.branch || 'main')) : '';
    if (compare) notes += '\n' + (lastTag ? 'Full list: ' : 'All commits: ') + compare + '\n';
    var noiseCount = Object.keys(noise).reduce(function (s, k) { return s + noise[k]; }, 0);
    var line = !since.length ? 'No commit since ' + (lastTag ? lastTag : 'the start of the feed') + ', so there is nothing to release.' : since.length + ' commit' + (since.length === 1 ? '' : 's') + ' since ' + (lastTag || 'the start of the feed') + ': ' + GROUP_ORDER.filter(function (g) { return groups[g]; }).map(function (g) { return groups[g].length + ' ' + g.toLowerCase(); }).join(', ') + (noiseCount ? ', ' + noiseCount + ' left out as noise' : '') + '. Next version ' + prefix + next + ': ' + bumpWhy + '.';
    return {
      ok: true,
      since: lastTag || '',
      sinceAt: last && last.at ? new Date(last.at).toISOString().slice(0, 10) : '',
      commits: since.length,
      feedLimited: !last && commits.length >= 20,
      feedNote: !last && typeof input.totalCommits === 'number' && input.totalCommits > commits.length ? 'the public feed holds the last ' + commits.length + ' of ' + grouped(input.totalCommits) + ' commits, so older ones are not in this changelog' : '',
      groups: groups,
      noise: noise,
      version: { from: lastTag || '', to: prefix + next, why: bumpWhy },
      markdown: total ? md : '',
      releaseNotes: total ? notes : '',
      compare: compare,
      rules: [{ text: rules.changelog ? rules.changelog.rule : '', source: rules.changelog ? rules.changelog.source : null }, { text: rules.semver ? rules.semver.rule : '', source: rules.semver ? rules.semver.source : null }, { text: rules.releaseNotes ? rules.releaseNotes.rule : '', source: rules.releaseNotes ? rules.releaseNotes.source : null }].filter(function (r) { return r.text; }),
      line: line
    };
  }

  function words(s) {
    return squash(s).split(' ').filter(Boolean);
  }

  var TAIL = /\s+(a|an|the|with|and|or|of|for|to|in|on|at|by|from|that|your|its|as)$/i;

  function cutAt(s, max) {
    s = squash(s);
    if (s.length <= max) return s;
    var cut = s.slice(0, max + 1);
    var comma = cut.lastIndexOf(', ');
    var space = cut.lastIndexOf(' ');
    var i = comma > max * 0.5 ? comma : space;
    var out = (i > max * 0.4 ? cut.slice(0, i) : s.slice(0, max)).replace(/[,;:\s]+$/, '');
    while (TAIL.test(out)) out = out.replace(TAIL, '');
    return out;
  }

  function taglines(desc, name, max) {
    var d = squash(desc).replace(/\s*[-|]\s*[^\s\/]+\/[^\s\/]+\s*$/, '');
    if (!d) return [];
    var out = [];
    var add = function (t, from) {
      t = squash(t).replace(/[.;:,]+$/, '');
      if (!t) return;
      t = t.charAt(0).toUpperCase() + t.slice(1);
      if (fold(t) === fold(name)) return;
      if (out.some(function (x) { return fold(x.text) === fold(t); })) return;
      out.push({ text: t, chars: t.length, fits: t.length <= max, from: from });
    };
    var parts = d.split(/:\s+/);
    var firstSentence = sentences(d)[0] || d;
    if (parts.length > 1) add(parts[0], 'the part of your description before the colon');
    add(cutAt(firstSentence, max), firstSentence.length <= max ? 'your first sentence' : 'your first sentence, cut at a word');
    if (parts.length > 1) add(cutAt(sentences(parts.slice(1).join(': '))[0] || '', max), 'the part after the colon, cut at a word');
    return out.slice(0, 3);
  }

  function nameOf(repo) {
    var h1 = (repo.headings || []).filter(function (h) { return h.level === 1; })[0];
    var n = h1 && h1.text.length <= 40 ? h1.text : (repo.repo || repo.name || '');
    return squash(n);
  }

  function pacificLaunch(now, zone) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone || 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch (e) { return null; }
    var parts = {};
    fmt.formatToParts(new Date(now)).forEach(function (p) { parts[p.type] = p.value; });
    var localNow = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    var offset = localNow - Math.floor(now / 60000) * 60000;
    var nextDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1, 0, 1);
    var at = nextDay - offset;
    return { at: at, iso: new Date(at).toISOString(), pacific: new Date(nextDay).toISOString().slice(0, 10) + ' 00:01 Pacific Time', offsetHours: Math.round(offset / HOUR) };
  }

  function checkTitle(title, hn) {
    var out = [];
    var t = squash(title);
    if (!/^Show HN\b/.test(t)) out.push({ ok: false, what: 'the title', rule: hn.prefix.rule, source: hn.prefix.source });
    if (/!/.test(t)) out.push({ ok: false, what: 'an exclamation point', rule: hn.title.rule, source: hn.title.source });
    var shout = words(t.replace(/^Show HN:?\s*/, '')).map(function (w) { return w.replace(/[^A-Za-z]/g, ''); }).filter(function (c) { return c.length >= 4 && c === c.toUpperCase() && !ACRONYM.test(c); });
    if (shout.length) out.push({ ok: false, what: 'words in capitals: ' + shout.slice(0, 3).join(', '), rule: hn.title.rule, source: hn.title.source });
    var m = MARKETING.exec(t);
    if (m) out.push({ ok: false, what: 'the word "' + m[0] + '"', rule: hn.title.rule, source: hn.title.source });
    return out;
  }

  function launch(input) {
    input = input || {};
    var rules = input.rules || {};
    var ph = rules.ph || {}, hn = rules.hn || {};
    var repo = input.repo || {};
    var now = Number(input.now) || Date.now();
    if (!repo.description && !repo.repo) return { ok: false, code: 'missing', missing: ['a repository read'], error: 'no repository read yet: open the repository and read it with zerackExtract github.repo first' };
    var name = nameOf(repo);
    var tagMax = ph.tagline && ph.tagline.max ? ph.tagline.max : 60;
    var descMax = ph.description && ph.description.max ? ph.description.max : 500;
    var tags = taglines(repo.description || '', name, tagMax);
    var desc = squash(repo.description || '');
    var heads = (repo.headings || []).filter(function (h) { return h.level >= 2 && !HEAD_SKIP.test(h.text); }).map(function (h) { return cutAt(h.text, 60); });
    var gallery = heads.slice(0, 5).map(function (t, i) { return { n: i + 1, caption: t, chars: t.length, from: 'README heading' }; });
    var tryUrl = repo.homepage || repo.url || '';
    var when = pacificLaunch(now, ph.timing && ph.timing.zone);
    var shortTag = tags.filter(function (t) { return t.fits; })[0];
    var hnTitle = 'Show HN: ' + name + (shortTag ? ' \u2013 ' + shortTag.text : '');
    var previous = (input.threads || []).filter(function (t) { return t && /^show hn\b/i.test(t.title || '') && ((repo.url && String(t.url || '').indexOf(repo.url) === 0) || (repo.homepage && String(t.url || '').indexOf(repo.homepage) === 0)); });
    var facts = [];
    if (desc) facts.push({ what: 'What it is', value: clip(desc, 240) });
    if (tryUrl) facts.push({ what: 'How to try it', value: tryUrl + (repo.license ? ', ' + repo.license + ' license' : '') });
    if (typeof repo.stars === 'number') facts.push({ what: 'Where it stands', value: grouped(repo.stars) + ' stars' + (typeof repo.commits === 'number' ? ', ' + grouped(repo.commits) + ' commits' : '') + (repo.created ? ' since ' + String(repo.created).slice(0, 10) : '') });
    if (previous.length) facts.push({ what: 'Earlier Show HN', value: previous[0].url || previous[0].item || '' });
    var src = function (r) { return r && r.source ? r.source : null; };
    var kit = {
      ok: true,
      name: name,
      producthunt: {
        name: { text: name, chars: name.length, why: 'your repository title, as the rule asks for the name only', rule: ph.name ? ph.name.rule : '', source: src(ph.name) },
        taglines: tags.map(function (t) { return { text: t.text, chars: t.chars, fits: t.fits, why: 'from ' + t.from + ', ' + t.chars + ' of ' + tagMax + ' characters' }; }),
        taglineRule: { rule: ph.tagline ? ph.tagline.rule : '', source: src(ph.tagline) },
        description: { text: cutAt(desc, descMax), chars: Math.min(desc.length, descMax), fits: desc.length <= descMax, why: 'your own GitHub description', rule: ph.description ? ph.description.rule : '', source: src(ph.description) },
        gallery: { captions: gallery, needs: ph.gallery ? ph.gallery.min : 2, size: ph.gallery ? ph.gallery.size : '1270x760', enough: gallery.length >= (ph.gallery ? ph.gallery.min : 2), why: gallery.length ? 'one image per section your README already explains' : 'your README has no section headings to caption, so pick 2 screens yourself', rule: ph.gallery ? ph.gallery.rule : '', source: src(ph.gallery) },
        firstComment: { outline: ['Why you built it, in your own words', 'What it does: ' + clip(desc, 160), 'How to try it: ' + (tryUrl || 'the link') + (repo.license ? ' (' + repo.license + ')' : ''), 'What you want feedback on'], why: 'the first comment is where the maker explains, and Product Hunt ties it to the products that win', rule: ph.firstComment ? ph.firstComment.rule : '', source: src(ph.firstComment) },
        timing: { next: when ? when.pacific : '12:01 am Pacific Time', at: when ? when.iso : '', why: 'the day you are most prepared, at the start of the Pacific day', rule: ph.timing ? ph.timing.rule : '', source: src(ph.timing) },
        votes: { rule: ph.votes ? ph.votes.rule : '', source: src(ph.votes) }
      },
      showhn: {
        title: { text: hnTitle, chars: hnTitle.length, problems: checkTitle(hnTitle, hn), why: 'your repository name and your own description, not written by a model', rule: hn.prefix ? hn.prefix.rule : '', source: src(hn.prefix) },
        handwrite: true,
        handwriteRule: { rule: hn.handwrite ? hn.handwrite.rule : '', source: src(hn.handwrite) },
        cover: ['How you came to build it', 'What is different about it', 'A clear statement of what it is and does', 'How to try it now, without a signup', 'Links to earlier threads about it, if any'],
        coverRule: { rule: hn.backstory ? hn.backstory.rule : '', source: src(hn.backstory) },
        facts: facts,
        tryable: { url: tryUrl, rule: hn.tryable ? hn.tryable.rule : '', source: src(hn.tryable), ask: 'Can people try it now without signing up? If not, wait with the Show HN.' },
        repeat: previous.length ? { url: previous[0].url || '', rule: hn.releases ? hn.releases.rule : '', source: src(hn.releases) } : null,
        votes: { rule: hn.votes ? hn.votes.rule : '', source: src(hn.votes) },
        submit: tryUrl && hn.submit ? hn.submit + '?u=' + encodeURIComponent(tryUrl) + '&t=' + encodeURIComponent(hnTitle) : ''
      }
    };
    var fitsTag = tags.filter(function (t) { return t.fits; }).length;
    kit.line = 'Launch kit for ' + name + ': ' + fitsTag + ' tagline' + (fitsTag === 1 ? '' : 's') + ' within ' + tagMax + ' characters, ' + gallery.length + ' gallery caption' + (gallery.length === 1 ? '' : 's') + ', the Product Hunt day starts ' + (when ? when.pacific : 'at 12:01 am Pacific Time') + '; the Show HN title is ready and its text is yours to write by hand' + (kit.showhn.title.problems.length ? ', with ' + kit.showhn.title.problems.length + ' title problem' + (kit.showhn.title.problems.length === 1 ? '' : 's') : '') + '.';
    return kit;
  }

  function check(drafts, rules) {
    drafts = drafts || {};
    rules = rules || {};
    var ph = rules.ph || {}, hn = rules.hn || {}, x = rules.x || {};
    var out = [];
    var add = function (field, value, ok, rule, source, what) { out.push({ field: field, value: clip(value, 300), ok: ok, what: what || '', rule: rule || '', source: source || null }); };
    if (drafts.tagline != null) {
      var t = squash(drafts.tagline);
      add('tagline', t, t.length <= (ph.tagline ? ph.tagline.max : 60), ph.tagline && ph.tagline.rule, ph.tagline && ph.tagline.source, t.length + ' characters');
    }
    if (drafts.name != null) {
      var n = squash(drafts.name);
      var extra = /[\u2600-\u27ff]|[\ud83c-\ud83e][\udc00-\udfff]/.test(n) || /[:|,]|\s[-\u2013]\s/.test(n) || words(n).length > 5;
      add('name', n, !extra, ph.name && ph.name.rule, ph.name && ph.name.source, extra ? 'it carries more than the name' : 'name only');
    }
    if (drafts.description != null) {
      var d = squash(drafts.description);
      add('description', d, d.length <= (ph.description ? ph.description.max : 500), ph.description && ph.description.rule, ph.description && ph.description.source, d.length + ' characters');
    }
    if (drafts.firstComment != null) {
      var c = String(drafts.firstComment);
      var begs = /\b(upvote|up-vote|vote for|support us with|please vote)\b/i.test(c);
      add('firstComment', c, !begs, ph.votes && ph.votes.rule, ph.votes && ph.votes.source, begs ? 'it asks for votes' : 'no request for votes');
    }
    if (drafts.title != null) {
      var probs = checkTitle(drafts.title, hn);
      var first = probs[0] || hn.prefix || {};
      add('title', drafts.title, !probs.length, first.rule, first.source, probs.length ? probs.map(function (p) { return p.what; }).join('; ') : 'begins with Show HN, no shouting');
    }
    if (drafts.post != null) {
      var len = xLength(drafts.post, x);
      add('post', drafts.post, len <= (x.max || 280), x.rule, x.source, len + ' of ' + (x.max || 280) + ' characters');
    }
    return { ok: true, checks: out, passed: out.filter(function (c) { return c.ok; }).length, failed: out.filter(function (c) { return !c.ok; }).length, line: out.length ? out.filter(function (c) { return !c.ok; }).length + ' of ' + out.length + ' fail: ' + (out.filter(function (c) { return !c.ok; }).map(function (c) { return c.field + ' (' + c.what + ')'; }).join(', ') || 'none') + '.' : 'Nothing to check: pass the tagline, name, description, first comment, title or post.' };
  }

  function askers(items, opts) {
    opts = opts || {};
    var rules = opts.rules || {};
    var keys = {};
    (opts.keywords || []).forEach(function (k) { tokens(k).forEach(function (t) { keys[t.stem] = t.raw; }); });
    var keyList = Object.keys(keys);
    if (!keyList.length) return { ok: false, code: 'missing', missing: ['what the product does, in a few words'], error: 'no keywords: read the repository first or say in a few words what the product does' };
    var now = Number(opts.now) || Date.now();
    var seen = {};
    var found = [];
    (items || []).forEach(function (it) {
      if (!it || (it.kind !== 'comment' && it.kind !== 'story')) return;
      var text = it.kind === 'story' ? squash((it.title || '') + '. ' + (it.text || '')) : squash(it.text);
      var rt = /\/comments\/([a-z0-9]+)/i.exec(String(it.url || ''));
      var thread = rt ? rt[1] : String(it.url || '').replace(/[?#].*$/, '');
      var key = it.by ? String(it.host || '') + '|' + it.by + '|' + (/ycombinator/.test(String(it.host || '')) ? '' : thread) : (it.url || '') + '|' + text.slice(0, 80);
      if (seen[key] || !text) return;
      var ask = ASK_WORDS.exec(text);
      if (!ask) return;
      var hit = tokens(text).filter(function (t) { return owns.call(keys, t.stem); });
      var need = keyList.length >= 4 ? 2 : 1;
      if (hit.length < need) return;
      seen[key] = 1;
      var at = text.toLowerCase().indexOf(ask[0].toLowerCase());
      var start = Math.max(0, at - 80);
      var excerpt = (start ? '...' : '') + text.slice(start, start + 260) + (text.length > start + 260 ? '...' : '');
      var host = String(it.host || '');
      var hn = /ycombinator\.com$/.test(host);
      var ageDays = it.at ? Math.round((now - it.at) / DAY) : null;
      found.push({
        source: sourceName(host),
        by: it.by || '',
        url: it.url || '',
        at: it.at ? new Date(it.at).toISOString().slice(0, 10) : '',
        excerpt: excerpt,
        asks: ask[0],
        matched: hit.map(function (t) { return t.raw; }).slice(0, 5),
        score: hit.length * 2 + (it.kind === 'story' ? 1 : 0) + (ageDays != null && ageDays <= 14 ? 1 : 0),
        closed: hn && ageDays != null && ageDays > 14,
        handwrite: hn,
        reply: hn
          ? { outline: ['Answer their question first, in one or two sentences of your own', 'Say plainly that you built ' + (opts.name || 'it') + ' and that you are the maker', 'Say what it does for exactly this case: ' + hit.map(function (t) { return t.raw; }).slice(0, 3).join(', '), 'One link: ' + (opts.url || 'your link')], rule: rules.hn && rules.hn.handwrite ? rules.hn.handwrite.rule : '', source: rules.hn && rules.hn.handwrite ? rules.hn.handwrite.source : null }
          : { draft: 'I built ' + (opts.name || 'a tool') + ' for this: ' + clip(opts.what || '', 140) + (opts.url ? ' ' + opts.url : '') + ' (I am the maker, so I am biased.)', outline: ['Answer their question first', 'Say you are the maker', 'One link'] }
      });
    });
    found.sort(function (a, b) { return b.score - a.score; });
    var top = found.slice(0, 8);
    return {
      ok: true,
      keywords: keyList.map(function (k) { return keys[k]; }),
      matches: top,
      more: Math.max(0, found.length - top.length),
      rule: rules.hn && rules.hn.promotion ? { rule: rules.hn.promotion.rule, source: rules.hn.promotion.source } : null,
      line: top.length ? top.length + ' ' + (top.length === 1 ? 'person asks' : 'people ask') + ' for what you build: ' + top.slice(0, 3).map(function (m) { return (m.by || 'someone') + ' on ' + m.source; }).join(', ') + '. Every reply waits for your press, and on Hacker News you write it by hand.' : 'Nobody in what was read asks for a tool like yours with the words ' + keyList.slice(0, 5).map(function (k) { return keys[k]; }).join(', ') + '.'
    };
  }

  var METRIC_BY_READER = { 'github.repo': 'stars', 'npm.package': 'weeklyDownloads', 'cws.listing': 'users', 'ph.product': 'followers', 'pypi.package': 'releases', 'hn.item': 'points', 'hf.model': 'likes', 'hf.space': 'likes', 'hf.dataset': 'likes', 'mcp.github': 'stars' };

  function rivals(groups, opts) {
    opts = opts || {};
    var D = opts.decide;
    var now = Number(opts.now) || Date.now();
    var mine = String(opts.mine || '');
    var rows = (groups || []).map(function (g) {
      var metric = g.metric || METRIC_BY_READER[g.reader] || 'count';
      var points = (g.points || []).filter(function (p) { return p && typeof p.value === 'number' && isFinite(p.value) && p.t; }).sort(function (a, b) { return a.t - b.t; });
      var first = points[0], last = points[points.length - 1];
      var spanDays = first && last ? (last.t - first.t) / DAY : 0;
      var perDay = spanDays >= 0.5 ? Math.round((last.value - first.value) / spanDays * 10) / 10 : null;
      var verdict = D && typeof D.trend === 'function' ? D.trend({ name: (g.name || g.url) + ' ' + metric, points: points, now: now }) : null;
      return {
        name: g.name || g.url,
        url: g.url,
        reader: g.reader,
        metric: metric,
        now: last ? last.value : null,
        first: first ? first.value : null,
        readings: points.length,
        spanDays: Math.round(spanDays * 10) / 10,
        perDay: perDay,
        state: verdict && verdict.ok ? verdict.state : 'look',
        label: verdict && verdict.ok ? verdict.label : 'LOOK AT IT',
        line: verdict && verdict.ok ? verdict.line : '',
        missing: verdict && verdict.ok ? (verdict.missing || []).map(function (m) { return m.text; }) : [],
        mine: !!mine && String(g.url || '').indexOf(mine) === 0,
        watched: g.watched === true
      };
    });
    var rank = { keep: 0, look: 1, drop: 2 };
    rows.sort(function (a, b) { return (a.mine ? 1 : 0) - (b.mine ? 1 : 0) || rank[a.state] - rank[b.state] || (b.perDay || 0) - (a.perDay || 0); });
    var accel = rows.filter(function (r) { return r.state === 'keep' && !r.mine; });
    var waiting = rows.filter(function (r) { return r.state === 'look'; });
    return {
      ok: true,
      rows: rows.slice(0, 12),
      accelerating: accel.length,
      line: !rows.length ? 'No rival is watched or read yet: open a rival repository, package, store listing, Hugging Face page or the GitHub MCP Registry and ask ZERACK to watch it.' : (accel.length ? accel.length + ' accelerating over their own baseline: ' + accel.slice(0, 3).map(function (r) { return r.name + ' (' + grouped(r.now) + ' ' + r.metric + (r.perDay != null ? ', ' + (r.perDay >= 0 ? '+' : '') + r.perDay + ' a day' : '') + ')'; }).join(', ') + '.' : 'Nobody accelerates over their own baseline yet.') + (waiting.length ? ' ' + waiting.length + ' still need more daily readings to be judged.' : '')
    };
  }

  Object.defineProperty(root, 'NSP_BUILDERS', { writable: false, configurable: false, value: Object.freeze({
    version: 1,
    requests: requests,
    askers: askers,
    rivals: rivals,
    post: post,
    changelog: changelog,
    launch: launch,
    check: check,
    xLength: xLength,
    classify: classify,
    tokens: function (text) { return tokens(text).map(function (t) { return t.stem; }); },
    metricFor: function (reader) { return METRIC_BY_READER[reader] || 'count'; }
  }) });
})(typeof self !== 'undefined' ? self : this);
