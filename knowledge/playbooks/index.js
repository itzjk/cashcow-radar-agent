(function (root) {
  var owns = Object.prototype.hasOwnProperty;
  var IDS = ['etsy', 'shopify', 'seo', 'builders', 'creators', 'freelance', 'local', 'amazon', 'newsletter', 'digital'];
  var PRIMER_MAX = 1900;
  var LOOKUP_MAX = 2;
  var KINDS = { Publish: 1, Delete: 1, Send: 1, Pay: 1, Fulfill: 1 };

  function get(id) {
    id = String(id || '').toLowerCase();
    if (IDS.indexOf(id) < 0) return null;
    var key = 'NSP_PLAYBOOK_' + id.toUpperCase();
    var pb = owns.call(root, key) ? root[key] : null;
    return pb && pb.id === id ? pb : null;
  }

  function list() {
    return IDS.map(get).filter(Boolean);
  }

  function clean(host, path) {
    return { host: String(host || '').toLowerCase().replace(/\.$/, ''), path: String(path || '/') || '/' };
  }

  function ruleHits(rule, host, path) {
    if (!rule || !rule.host || !rule.host.test(host)) return false;
    return !rule.path || rule.path.test(path);
  }

  function forHost(host, path) {
    var c = clean(host, path);
    if (!c.host) return '';
    var hit = '';
    list().some(function (pb) {
      if ((pb.hosts || []).some(function (r) { return ruleHits(r, c.host, c.path); })) { hit = pb.id; return true; }
      return false;
    });
    return hit;
  }

  function forUrl(url) {
    try {
      var u = new URL(String(url || ''));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return forHost(u.hostname, u.pathname);
    } catch (e) { return ''; }
  }

  function fold(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function forQuery(text) {
    var q = fold(text);
    if (!q) return '';
    var hit = '';
    list().some(function (pb) {
      if (pb.named && pb.named.test(q)) { hit = pb.id; return true; }
      return false;
    });
    return hit;
  }

  function shortId(id) {
    var m = /^([a-z]\d+)-(l\d+)/.exec(String(id || ''));
    return m ? m[1] + '-' + m[2] : '';
  }

  function tag(m) {
    return m.id.split('-')[0].toUpperCase();
  }

  function primer(pb, maxChars) {
    if (!pb) return '';
    var cap = Math.min(PRIMER_MAX, Math.max(240, Number(maxChars) || PRIMER_MAX));
    var head = 'PLAYBOOK, the method you apply on ' + pb.name + ' (' + pb.title + ', checked ' + pb.updated + '). Every lesson cites its ' + pb.sourceOwner + ' sources, and it outranks any other knowledge here. Place the user on a stage and apply its lesson yourself.\n';
    var full = head + pb.modules.map(function (m) {
      return tag(m) + ' ' + m.title + ': ' + m.lessons.map(function (l) { return shortId(l.id) + ' ' + l.title; }).join('; ') + '\n';
    }).join('');
    if (full.length <= cap) return full;
    var out = 'PLAYBOOK for ' + pb.name + ', sourced, apply it yourself.\n';
    pb.modules.forEach(function (m) {
      var line = tag(m) + ' ' + m.title + ' (' + shortId(m.lessons[0].id) + ' to ' + shortId(m.lessons[m.lessons.length - 1].id) + ')\n';
      if (out.length + line.length <= cap) out += line;
    });
    return out;
  }

  function words(s) {
    return fold(s).replace(/[^a-z0-9%]+/g, ' ').split(' ').filter(function (w) { return w.length > 2; });
  }

  function render(pb, mod, l) {
    var tools = pb.surfaces || {};
    return {
      id: shortId(l.id),
      playbook: pb.name,
      module: mod.title,
      title: l.title,
      why: l.why,
      steps: l.steps,
      doNow: l.doNow,
      proof: l.proof,
      youCanRun: (l.surfaces || []).map(function (s) { return owns.call(tools, s) ? s + ': ' + tools[s] : s + ': no tool reaches it, name it to the user'; }),
      sources: l.sources.map(function (s) { return s.author + ', ' + s.title + ', ' + s.url; })
    };
  }

  function entries(pb) {
    var out = [];
    pb.modules.forEach(function (m) { m.lessons.forEach(function (l) { out.push({ m: m, l: l }); }); });
    return out;
  }

  function lookup(id, args) {
    var pb = typeof id === 'string' ? get(id) : id;
    if (!pb) return { ok: false, error: 'no business playbook is loaded for this page' };
    args = args && typeof args === 'object' ? args : {};
    var all = entries(pb);
    var asked = [].concat(args.lesson || []).join(',').toLowerCase().split(/[\s,]+/).filter(Boolean);
    var hits = [];
    asked.forEach(function (w) {
      all.forEach(function (e) {
        var sid = shortId(e.l.id);
        var match = e.l.id === w || sid === w || (/^[a-z]\d+$/.test(w) && sid.indexOf(w + '-') === 0);
        if (match && hits.indexOf(e) < 0) hits.push(e);
      });
    });
    var by = 'id';
    if (!hits.length && args.query) {
      by = 'query';
      var q = words(args.query);
      hits = all.map(function (e) {
        var title = words(e.l.title), body = words(e.l.why + ' ' + e.l.steps.join(' '));
        var score = 0;
        q.forEach(function (w) { score += title.indexOf(w) >= 0 ? 3 : (body.indexOf(w) >= 0 ? 1 : 0); });
        return { e: e, score: score };
      }).filter(function (x) { return x.score >= 2; }).sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.e; });
    }
    if (!hits.length) return { ok: false, error: 'no ' + pb.name + ' lesson matched ' + JSON.stringify(asked.length ? asked : String(args.query || '')) + '. Use an id from the PLAYBOOK list in your instructions.' };
    return {
      ok: true,
      playbook: pb.id,
      matchedBy: by,
      howToUse: 'The steps are written to the owner of the business. Run the ones a tool in youCanRun can do yourself, and hand the user only the rest. Name the source when you rely on it.',
      lessons: hits.slice(0, LOOKUP_MAX).map(function (e) { return render(pb, e.m, e.l); }),
      alsoRelevant: hits.slice(LOOKUP_MAX, LOOKUP_MAX + 4).map(function (e) { return shortId(e.l.id) + ' ' + e.l.title; })
    };
  }

  function lessonsFor(id, query) {
    var pb = typeof id === 'string' ? get(id) : id;
    if (!pb || !query) return [];
    var q = fold(query);
    var ids = [];
    (q.match(/\b[a-z]\d-l\d\b/g) || []).forEach(function (x) { if (ids.indexOf(x) < 0) ids.push(x); });
    (pb.hints || []).forEach(function (h) { if (h[0].test(q) && ids.indexOf(h[1]) < 0) ids.push(h[1]); });
    if (!ids.length) return [];
    var r = lookup(pb, { lesson: ids.slice(0, LOOKUP_MAX).join(',') });
    return r.ok ? r.lessons : [];
  }

  function gateRules(host, path) {
    var c = clean(host, path);
    var out = { playbook: '', press: [], never: [] };
    var id = forHost(c.host, c.path);
    var pb = get(id);
    if (!pb || !pb.gate) return out;
    out.playbook = pb.id;
    (pb.gate.press || []).forEach(function (p) {
      if (KINDS[p.kind] === 1 && p.re && p.re.source) out.press.push({ kind: p.kind, source: p.re.source });
    });
    (pb.gate.never || []).forEach(function (n) {
      if (n.re && n.re.source && n.why) out.never.push({ why: String(n.why), source: n.re.source, link: n.link === true });
    });
    return out;
  }

  function readOnly(host, path) {
    var c = clean(host, path);
    var pb = get(forHost(c.host, c.path));
    if (!pb) return null;
    var hit = null;
    (pb.readOnly || []).some(function (r) {
      if (ruleHits(r, c.host, c.path)) { hit = { playbook: pb.id, name: pb.name, why: String(r.why || '') }; return true; }
      return false;
    });
    return hit;
  }

  function privatePage(host, path) {
    var c = clean(host, path);
    var hit = null;
    list().some(function (pb) {
      return (pb.private || []).some(function (r) {
        if (ruleHits(r, c.host, c.path)) { hit = { playbook: pb.id, name: pb.name, why: String(r.why || '') }; return true; }
        return false;
      });
    });
    return hit;
  }

  function terms(host, path) {
    var c = clean(host, path);
    var pb = get(forHost(c.host, c.path));
    if (!pb || !pb.terms || !pb.terms.rule) return null;
    return { playbook: pb.id, name: pb.name, rule: String(pb.terms.rule), pace: pb.terms.pace === true, source: pb.terms.source ? pb.terms.source.author + ', ' + pb.terms.source.title + ', ' + pb.terms.source.url : '' };
  }

  function leadsKind(id) {
    var pb = typeof id === 'string' ? get(id) : id;
    return pb && (pb.leads === 'place' || pb.leads === 'job') ? pb.leads : '';
  }

  function readerFor(id, host, path) {
    var pb = typeof id === 'string' ? get(id) : id;
    if (!pb) return null;
    var c = clean(host, path);
    var hit = null;
    (pb.readers || []).some(function (r) {
      if (r.host && !r.host.test(c.host)) return false;
      if (r.path && !r.path.test(c.path)) return false;
      hit = r;
      return true;
    });
    return hit ? { id: hit.id, as: hit.as || hit.id, label: hit.label, opts: hit.opts || null } : null;
  }

  function reader(id, name) {
    var pb = typeof id === 'string' ? get(id) : id;
    if (!pb) return null;
    var hit = null;
    (pb.readers || []).some(function (r) { if ((r.as || r.id) === name || r.id === name) { hit = r; return true; } return false; });
    return hit ? { id: hit.id, as: hit.as || hit.id, label: hit.label, opts: hit.opts || null } : null;
  }

  function readersText(id) {
    var pb = typeof id === 'string' ? get(id) : id;
    if (!pb) return '';
    return (pb.readers || []).map(function (r) { return (r.as || r.id) + ': ' + r.label; }).join('; ');
  }

  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
    }
    return o;
  }

  Object.defineProperty(root, 'NSP_PLAYBOOKS', {
    value: freeze({
      ids: IDS.slice(),
      kinds: Object.keys(KINDS),
      get: get,
      list: list,
      forHost: forHost,
      forUrl: forUrl,
      forQuery: forQuery,
      shortId: shortId,
      primer: primer,
      lookup: lookup,
      lessonsFor: lessonsFor,
      gateRules: gateRules,
      readOnly: readOnly,
      privatePage: privatePage,
      terms: terms,
      leadsKind: leadsKind,
      readerFor: readerFor,
      reader: reader,
      readersText: readersText
    }),
    writable: false,
    configurable: false
  });
})(typeof self !== 'undefined' ? self : this);
