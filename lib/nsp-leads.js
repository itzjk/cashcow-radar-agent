(function (root) {
  var owns = Object.prototype.hasOwnProperty;
  if (owns.call(root, 'NSP_LEADS')) return;

  var KEY = 'nsp_leads';
  var DAY = 86400000;
  var CEIL = { start: [1, 20], step: [0, 10], max: [1, 50], bounces: [1, 5] };
  var DEFAULTS = { on: true, start: 5, step: 5, max: 30, hours: [8, 21], bounces: 3, name: '', business: '', address: '', email: '', offer: '', skills: '', rate: null, budget: null, proof: '' };
  var TEXT_MAX = { name: 80, business: 100, address: 200, email: 120, offer: 240, skills: 240, proof: 300 };
  var CHANNELS = { email: 1, form: 1, dm: 1, proposal: 1, call: 1 };
  var COLD = { email: 1, form: 1, dm: 1 };
  var LEADS_MAX = 300;
  var LOG_MAX = 2000;
  var NEVER_MAX = 5000;
  var DRAFT_FRESH_MS = DAY;
  var JOB_STALE_MIN = 72 * 60;
  var CONNECT_PRICE = 0.15;
  var OUTREACH = [
    { host: /^mail\.google\.com$/, what: 'a Gmail message' },
    { host: /^outlook\.(live|office|office365)\.com$/, what: 'an Outlook message' },
    { host: /(^|\.)upwork\.com$/, path: /\/(proposals\/job|ab\/proposals|nx\/proposals)(\/|$)|\/apply(\/|$)/, what: 'an Upwork proposal' },
    { host: /(^|\.)fiverr\.com$/, path: /^\/inbox(\/|$)|\/contact_me(\/|$)|^\/briefs?(\/|$)/, what: 'a Fiverr message' }
  ];
  var SOURCES = {
    canSpam: { title: 'CAN-SPAM Act: A Compliance Guide for Business', url: 'https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business', author: 'Federal Trade Commission' },
    upworkFee: { title: 'Learn about the Freelancer Service Fee', url: 'https://support.upwork.com/hc/en-us/articles/211062538-Learn-about-the-Freelancer-Service-Fee', author: 'Upwork Help' },
    connects: { title: 'Understanding and using Connects', url: 'https://support.upwork.com/hc/en-us/articles/211062898-Understanding-and-using-Connects', author: 'Upwork Help' },
    proposal: { title: 'How to submit a proposal on Upwork', url: 'https://support.upwork.com/hc/en-us/articles/211062998-How-to-submit-a-proposal-on-Upwork', author: 'Upwork Help' }
  };

  function text(v, n) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  }

  function fold(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
  }

  function num(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function clampInt(v, r, d) {
    var n = Math.round(Number(v));
    if (v == null || v === '' || !isFinite(n)) return d;
    return Math.max(r[0], Math.min(r[1], n));
  }

  function money(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    return '$' + (Math.round(n) === n ? String(n) : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  function hash(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36);
  }

  function policy(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var p = {};
    p.on = raw.on !== false;
    p.start = clampInt(raw.start, CEIL.start, DEFAULTS.start);
    p.step = clampInt(raw.step, CEIL.step, DEFAULTS.step);
    p.max = clampInt(raw.max, CEIL.max, DEFAULTS.max);
    if (p.start > p.max) p.start = p.max;
    p.bounces = clampInt(raw.bounces, CEIL.bounces, DEFAULTS.bounces);
    var h = Array.isArray(raw.hours) ? raw.hours : DEFAULTS.hours;
    var h0 = clampInt(h[0], [0, 23], DEFAULTS.hours[0]), h1 = clampInt(h[1], [1, 24], DEFAULTS.hours[1]);
    p.hours = h0 < h1 ? [h0, h1] : DEFAULTS.hours.slice();
    Object.keys(TEXT_MAX).forEach(function (k) { p[k] = text(raw[k], TEXT_MAX[k]); });
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) p.email = '';
    var rate = num(raw.rate), budget = num(raw.budget);
    p.rate = rate != null && rate > 0 ? Math.round(rate * 100) / 100 : null;
    p.budget = budget != null && budget > 0 ? Math.round(budget * 100) / 100 : null;
    return p;
  }

  function setPolicy(current, patch) {
    var cur = policy(current);
    patch = patch && typeof patch === 'object' ? patch : {};
    var next = {};
    Object.keys(cur).forEach(function (k) { next[k] = cur[k]; });
    var changed = [], refused = [];
    Object.keys(patch).forEach(function (k) {
      if (!owns.call(DEFAULTS, k)) return;
      var v = patch[k];
      if (owns.call(CEIL, k)) {
        var n = Math.round(Number(v));
        if (!isFinite(n)) { refused.push({ field: k, why: 'not a number' }); return; }
        if (n > CEIL[k][1]) refused.push({ field: k, why: 'the ceiling for ' + k + ' is ' + CEIL[k][1] + ', so it was set to ' + CEIL[k][1] });
        if (n < CEIL[k][0]) refused.push({ field: k, why: 'the floor for ' + k + ' is ' + CEIL[k][0] + ', so it was set to ' + CEIL[k][0] });
      }
      next[k] = v;
      changed.push(k);
    });
    var out = policy(next);
    return { policy: out, changed: changed.filter(function (k) { return JSON.stringify(out[k]) !== JSON.stringify(cur[k]); }), refused: refused };
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function dayOf(ms) {
    var d = new Date(Number(ms) || Date.now());
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function hourOf(ms) {
    return new Date(Number(ms) || Date.now()).getHours();
  }

  function daysBetween(a, b) {
    var pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(a || '')), pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b || ''));
    if (!pa || !pb) return 0;
    return Math.round((Date.UTC(+pb[1], +pb[2] - 1, +pb[3]) - Date.UTC(+pa[1], +pa[2] - 1, +pa[3])) / DAY);
  }

  function capToday(pol, first, now) {
    pol = policy(pol);
    if (!first) return pol.start;
    var days = Math.max(0, daysBetween(first, dayOf(now)));
    return Math.min(pol.max, pol.start + pol.step * days);
  }

  function blank() {
    return { v: 1, policy: policy(null), first: '', leads: {}, log: [], never: [], found: null };
  }

  function load(raw) {
    var s = raw && typeof raw === 'object' ? raw : {};
    var out = blank();
    out.policy = policy(s.policy);
    out.first = /^\d{4}-\d{2}-\d{2}$/.test(String(s.first || '')) ? String(s.first) : '';
    if (s.leads && typeof s.leads === 'object') Object.keys(s.leads).forEach(function (id) { var l = s.leads[id]; if (l && typeof l === 'object' && /^L[0-9a-z]+$/.test(id)) out.leads[id] = l; });
    out.log = Array.isArray(s.log) ? s.log.filter(function (e) { return e && typeof e === 'object' && e.event; }).slice(-LOG_MAX) : [];
    out.never = Array.isArray(s.never) ? s.never.filter(function (k) { return typeof k === 'string' && k; }).slice(-NEVER_MAX) : [];
    var f = s.found;
    out.found = f && typeof f === 'object' && Array.isArray(f.ids) ? { at: Number(f.at) || 0, url: String(f.url || '').slice(0, 600), reader: String(f.reader || '').slice(0, 40), kind: f.kind === 'job' ? 'job' : 'place', ids: f.ids.filter(function (id) { return typeof id === 'string' && /^L[0-9a-z]+$/.test(id); }).slice(0, 60) } : null;
    return out;
  }

  function prune(state) {
    var ids = Object.keys(state.leads);
    if (ids.length > LEADS_MAX) {
      var keep = ids.map(function (id) { return state.leads[id]; }).sort(function (a, b) {
        var sa = a.status === 'sent' || a.status === 'replied' ? 1 : 0, sb = b.status === 'sent' || b.status === 'replied' ? 1 : 0;
        return sb - sa || (b.at || 0) - (a.at || 0);
      }).slice(0, LEADS_MAX);
      state.leads = {};
      keep.forEach(function (l) { state.leads[l.id] = l; });
    }
    if (state.log.length > LOG_MAX) state.log = state.log.slice(-LOG_MAX);
    if (state.never.length > NEVER_MAX) state.never = state.never.slice(-NEVER_MAX);
    return state;
  }

  function norm(s) {
    return fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function domainOf(url) {
    try { return new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function street(address) {
    return norm(String(address || '').split(',')[0]);
  }

  function keysOf(x) {
    var keys = [];
    if (x.email) keys.push('mail:' + fold(x.email));
    var url = String(x.url || '');
    var u = null;
    try { u = new URL(url); } catch (e) {}
    if (u) {
      var job = /~0[0-9a-z]+/i.exec(u.pathname);
      if (/(^|\.)upwork\.com$/.test(u.hostname) && job) keys.push('upwork:' + job[0].toLowerCase());
      else if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && /\/maps\//.test(u.pathname)) keys.push('place:' + norm(x.name) + '|' + street(x.address));
      else keys.push('url:' + u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, ''));
    }
    if (!u && x.name) keys.push('place:' + norm(x.name) + '|' + street(x.address));
    var site = domainOf(x.website);
    if (site) keys.push('site:' + site);
    return keys.filter(function (k, i) { return k && k.length > 6 && keys.indexOf(k) === i; });
  }

  function focusOf(offer) {
    var o = norm(offer);
    var f = {
      web: /\b(web|website|websites|site|sites|landing|wordpress|shopify|pagina|paginas)\b/.test(o),
      reviews: /\b(reviews?|reputation|ratings?|resenas?|opiniones)\b/.test(o),
      seo: /\b(seo|google|maps|rank|ranking|posicionamiento)\b/.test(o),
      ads: /\b(ads?|advertising|marketing|social|publicidad|anuncios)\b/.test(o)
    };
    if (!f.web && !f.reviews && !f.seo && !f.ads) return { web: true, reviews: true, seo: true, ads: true, any: true };
    return f;
  }

  function cityOf(address) {
    var parts = String(address || '').split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2].replace(/\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/, '').replace(/\s+\d{5}(-\d{4})?$/, '').trim();
    return '';
  }

  function judgePlace(row, pol) {
    row = row || {};
    pol = policy(pol);
    var f = focusOf(pol.offer);
    var reasons = [], facts = [];
    var rating = num(row.rating), reviews = num(row.reviews);
    var name = text(row.name, 120);
    if (rating != null && reviews != null) facts.push({ what: 'rating', value: rating + ' stars from ' + plural(reviews, 'review', 'reviews') });
    else if (reviews != null) facts.push({ what: 'reviews', value: plural(reviews, 'review', 'reviews') });
    if (row.category) facts.push({ what: 'category', value: text(row.category, 80) });
    if (row.closed) {
      return { verdict: 'skip', score: 0, reasons: [{ text: 'Google marks it ' + (String(row.closed) === 'temporarily' ? 'temporarily' : 'permanently') + ' closed', weight: 0 }], facts: facts, route: { kind: 'none' }, nothing: true, name: name };
    }
    var knownSite = row.hasWebsite === true || row.hasWebsite === false;
    if (knownSite && row.hasWebsite === false) {
      facts.push({ what: 'website', value: 'no website on the Google listing' });
      if (f.web || f.seo) reasons.push({ text: 'No website on its Google listing', weight: 3, why: 'web' });
    }
    if (rating != null && reviews != null && rating < 4 && reviews >= 10 && (f.reviews || f.seo)) reasons.push({ text: 'Rated ' + rating + ' from ' + plural(reviews, 'review', 'reviews'), weight: 2, why: 'reviews' });
    if (reviews != null && reviews < 20 && (f.reviews || f.seo)) reasons.push({ text: 'Only ' + plural(reviews, 'review', 'reviews'), weight: 1, why: 'reviews' });
    if (row.sponsored === true && f.ads) { reasons.push({ text: 'Already pays for ads on Maps', weight: 1, why: 'ads' }); facts.push({ what: 'ads', value: 'runs a sponsored listing on Maps' }); }
    var score = reasons.reduce(function (s, r) { return s + r.weight; }, 0);
    var route;
    if (row.email) route = { kind: 'email', email: text(row.email, 120) };
    else if (row.website) route = { kind: 'form', url: String(row.website).slice(0, 400) };
    else if (row.phone) route = { kind: 'call', phone: text(row.phone, 40) };
    else route = { kind: 'none' };
    var verdict = score >= 3 ? 'pitch' : (score >= 1 ? 'look' : 'skip');
    if (route.kind === 'none' && verdict === 'pitch') { verdict = 'look'; reasons.push({ text: 'No website and no phone on the listing, so there is no way to reach it from here', weight: 0 }); }
    var nothing = score === 0;
    if (nothing) reasons.push({ text: 'Nothing to say: ' + (knownSite ? (row.hasWebsite ? 'it has a website' : 'no website') : 'website unknown') + (rating != null ? ', rated ' + rating : '') + (reviews != null ? ' from ' + plural(reviews, 'review', 'reviews') : ''), weight: 0 });
    return { verdict: verdict, score: score, reasons: reasons, facts: facts, route: route, nothing: nothing, name: name };
  }

  function skillList(s) {
    return String(s || '').split(/[,;\n]+/).map(function (x) { return { k: norm(x), label: text(x, 40) }; }).filter(function (x) { return x.k.length > 1; }).slice(0, 30);
  }

  function judgeJob(row, pol, now) {
    row = row || {};
    pol = policy(pol);
    var reasons = [], facts = [], stop = null, look = [];
    var title = text(row.title, 160);
    facts.push({ what: 'job', value: title });
    var type = row.type === 'hourly' || row.type === 'fixed' ? row.type : '';
    var rmin = num(row.rateMin), rmax = num(row.rateMax), budget = num(row.budget);
    if (type === 'hourly' && (rmin != null || rmax != null)) facts.push({ what: 'rate', value: (rmin != null ? money(rmin) : '') + (rmax != null && rmax !== rmin ? (rmin != null ? ' to ' : 'up to ') + money(rmax) : '') + ' an hour' });
    if (type === 'fixed' && budget != null) facts.push({ what: 'budget', value: money(budget) + ' fixed' });
    var p = row.proposals && typeof row.proposals === 'object' ? row.proposals : null;
    var pmin = p ? num(p.min) : null;
    var ptext = p && p.text ? 'Proposals: ' + text(p.text, 40) : '';
    if (ptext) facts.push({ what: 'proposals', value: ptext });
    var spent = num(row.spent);
    if (row.verified === true) facts.push({ what: 'client', value: 'payment verified' + (spent != null ? ', ' + money(spent) + '+ spent' : '') });
    var age = num(row.postedMin);
    if (row.verified === false) stop = 'Payment method not verified';
    else if (pmin != null && pmin >= 50) stop = 'Already 50 or more proposals';
    else if (age != null && age > JOB_STALE_MIN) stop = 'Posted ' + Math.round(age / 1440) + ' days ago';
    var mine = skillList(pol.skills);
    var hay = ' ' + norm([title, (row.skills || []).join(' '), row.text || ''].join(' ')) + ' ';
    var matched = mine.filter(function (s) { return hay.indexOf(' ' + s.k + ' ') >= 0; }).map(function (s) { return s.label; });
    if (!stop && mine.length && !matched.length) stop = 'None of your skills (' + mine.slice(0, 4).map(function (s) { return s.label; }).join(', ') + ') appears in the post';
    if (matched.length) facts.push({ what: 'skills', value: matched.slice(0, 5).join(', ') });
    if (!stop && type === 'fixed' && budget != null && pol.budget != null && budget < pol.budget) stop = 'Budget ' + money(budget) + ' is under your floor of ' + money(pol.budget);
    if (!stop && type === 'hourly' && rmax != null && pol.rate != null && rmax < pol.rate) stop = 'The top of the range, ' + money(rmax) + ' an hour, is under your rate of ' + money(pol.rate);
    if (!stop) {
      if (row.verified == null) look.push('Payment verification not shown');
      if (spent == null || spent === 0) look.push('New client, no spend shown yet');
      if (pmin != null && pmin >= 20) look.push(ptext + ' already');
      if (!mine.length) look.push('Your skills are not set, so the fit is not checked');
      if (row.connects != null && num(row.connects) >= 20) look.push(num(row.connects) + ' Connects to apply');
    }
    var verdict = stop ? 'skip' : (look.length ? 'look' : 'bid');
    if (stop) reasons.push({ text: stop, weight: 0 });
    look.forEach(function (t) { reasons.push({ text: t, weight: 0 }); });
    if (!stop && !look.length) {
      reasons.push({ text: 'Payment verified' + (spent ? ', ' + money(spent) + '+ spent' : ''), weight: 1 });
      if (ptext) reasons.push({ text: ptext, weight: 1 });
      if (matched.length) reasons.push({ text: 'Matches ' + matched.slice(0, 3).join(', '), weight: 1 });
    }
    var score = (row.verified === true ? 2 : 0) + (spent ? Math.min(3, Math.log(1 + spent) / Math.log(10)) : 0) + (pmin != null ? Math.max(0, 3 - pmin / 10) : 1) + (age != null ? Math.max(0, 2 - age / 1440) : 0) + matched.length;
    var price = null;
    if (type === 'hourly') {
      var bid = Math.max(pol.rate || 0, rmin || 0) || rmax || null;
      if (bid != null && rmax != null && bid > rmax) bid = rmax;
      if (bid) price = { per: 'hour', bid: bid, keepLow: Math.round(bid * 85) / 100, keepHigh: bid };
    } else if (type === 'fixed' && budget != null) {
      price = { per: 'project', bid: budget, keepLow: Math.round(budget * 85) / 100, keepHigh: budget };
    }
    var connects = num(row.connects);
    return { verdict: verdict, score: Math.round(score * 100) / 100, reasons: reasons, facts: facts, route: { kind: 'proposal', url: String(row.url || '').slice(0, 400) }, price: price, connects: connects, connectsCost: connects != null ? Math.round(connects * CONNECT_PRICE * 100) / 100 : null, matched: matched, name: title };
  }

  function sentence(s) {
    s = text(s, 400);
    if (!s) return '';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return /[.!?]$/.test(s) ? s : s + '.';
  }

  function firstSentence(s, n) {
    var t = text(s, 600);
    var m = /^(.{20,}?[.!?])(\s|$)/.exec(t);
    t = m ? m[1] : t;
    if (t.length > n) t = t.slice(0, n).replace(/\s+\S*$/, '') + '...';
    return t;
  }

  function disclosureFor(kind) {
    if (kind === 'job') return 'I found your post and drafted this proposal with an AI assistant, and I reviewed it before sending.';
    return 'I found your listing and drafted this note with an AI assistant, and I reviewed it before sending.';
  }

  function optOutFor(channel) {
    if (channel === 'proposal') return 'If it is not a fit, no reply is needed and I will not follow up.';
    if (channel === 'call') return 'If you would rather I did not call again, just say so and I will not.';
    return 'If you would rather not hear from me, reply "no" and I will not contact you again.';
  }

  var AD_LINE = 'This is an offer of services.';

  function placeLead(row, pol, source, now) {
    var j = judgePlace(row, pol);
    var keys = keysOf({ name: row.name, address: row.address, url: row.url, website: row.website, email: row.email });
    if (!keys.length) return null;
    return {
      id: 'L' + hash(keys[0]),
      kind: 'place',
      keys: keys,
      name: j.name,
      url: String(row.url || '').slice(0, 600),
      website: String(row.website || '').slice(0, 400),
      phone: text(row.phone, 40),
      address: text(row.address, 200),
      category: text(row.category, 80),
      rating: num(row.rating),
      reviews: num(row.reviews),
      hasWebsite: row.hasWebsite === true ? true : (row.hasWebsite === false ? false : null),
      source: text(source, 60),
      verdict: j.verdict,
      score: j.score,
      reasons: j.reasons,
      facts: j.facts,
      route: j.route,
      nothing: j.nothing,
      status: 'found',
      at: Number(now) || Date.now()
    };
  }

  function jobLead(row, pol, source, now) {
    var j = judgeJob(row, pol, now);
    var keys = keysOf({ url: row.url, name: row.title });
    if (!keys.length) return null;
    return {
      id: 'L' + hash(keys[0]),
      kind: 'job',
      keys: keys,
      name: j.name,
      url: String(row.url || '').slice(0, 600),
      type: row.type || '',
      text: text(row.text, 600),
      skills: (row.skills || []).slice(0, 12).map(function (s) { return text(s, 40); }),
      source: text(source, 60),
      verdict: j.verdict,
      score: j.score,
      reasons: j.reasons,
      facts: j.facts,
      route: j.route,
      price: j.price,
      connects: j.connects,
      connectsCost: j.connectsCost,
      matched: j.matched,
      status: 'found',
      at: Number(now) || Date.now()
    };
  }

  function mergeFound(state, lead) {
    var prev = state.leads[lead.id];
    if (prev) {
      ['status', 'draft', 'sentAt', 'outcome', 'channel'].forEach(function (k) { if (prev[k] != null) lead[k] = prev[k]; });
      if (prev.status && prev.status !== 'found') lead.status = prev.status;
      if (prev.connects != null && lead.connects == null) { lead.connects = prev.connects; lead.connectsCost = prev.connectsCost; }
    }
    state.leads[lead.id] = lead;
    return lead;
  }

  function contacted(state, lead) {
    var never = state.never || [];
    var hit = null;
    (lead.keys || []).some(function (k) {
      if (never.indexOf(k) >= 0) { hit = 'opted_out'; return true; }
      return false;
    });
    if (hit) return hit;
    Object.keys(state.leads).some(function (id) {
      var l = state.leads[id];
      if (!l || (l.status !== 'sent' && l.status !== 'replied' && l.status !== 'bounced' && l.status !== 'complained' && l.status !== 'opted_out')) return false;
      if (id === lead.id || (l.keys || []).some(function (k) { return (lead.keys || []).indexOf(k) >= 0; })) { hit = 'repeat'; return true; }
      return false;
    });
    return hit;
  }

  function channelFor(lead, want) {
    if (want && CHANNELS[want] === 1) return want;
    if (lead.kind === 'job') return 'proposal';
    var r = lead.route || {};
    if (r.kind === 'email') return 'email';
    if (r.kind === 'form') return 'form';
    if (r.kind === 'call') return 'call';
    return '';
  }

  function topFact(lead) {
    var byWhy = {};
    (lead.reasons || []).forEach(function (r) { if (r.why && !byWhy[r.why]) byWhy[r.why] = r; });
    if (byWhy.web) return 'web';
    if (byWhy.reviews && lead.rating != null && lead.rating < 4) return 'rating';
    if (byWhy.reviews) return 'few';
    if (byWhy.ads) return 'ads';
    return '';
  }

  function placeFactSentence(lead) {
    var top = topFact(lead);
    var stars = lead.rating != null && lead.reviews != null ? lead.rating + ' stars from ' + plural(lead.reviews, 'review', 'reviews') : '';
    if (top === 'web') return stars ? 'Your listing shows ' + stars + ', but no website link, so people who find you there have nowhere to click through.' : 'Your listing has no website link, so people who find you there have nowhere to click through.';
    if (top === 'rating') return 'Your listing shows ' + stars + '.';
    if (top === 'few') return 'Your listing has ' + plural(lead.reviews, 'review', 'reviews') + ' so far.';
    if (top === 'ads') return 'You already run a sponsored listing on Maps.';
    return '';
  }

  function placeSubject(lead) {
    var top = topFact(lead);
    var short = top === 'web' ? 'no website on your Google listing' : (top === 'rating' ? lead.rating + ' stars on Google' : (top === 'few' ? plural(lead.reviews, 'review', 'reviews') + ' on Google' : (top === 'ads' ? 'your Maps ads' : 'your Google listing')));
    return text(lead.name, 70) + ': ' + short;
  }

  function signature(pol, withAddress) {
    var lines = [];
    var who = [pol.name, pol.business].filter(Boolean).join(', ');
    if (who) lines.push(who);
    if (withAddress && pol.address) lines.push(pol.address);
    return lines.join('\n');
  }

  function compose(lead, pol, opts) {
    opts = opts || {};
    pol = policy(pol);
    if (!lead) return { ok: false, code: 'no_lead', error: 'no such lead' };
    var channel = channelFor(lead, opts.channel);
    var missing = [];
    if (!channel) return { ok: false, code: 'no_route', error: 'there is no way to reach ' + lead.name + ' from what was read: no email, no website and no phone' };
    if (!(lead.facts || []).length) return { ok: false, code: 'generic', error: 'nothing specific about ' + lead.name + ' was read, and a message that fits anyone is not sent' };
    if (lead.kind === 'place' && !pol.offer) missing.push('offer');
    if (!pol.name) missing.push('name');
    if (channel === 'email' && !pol.address) missing.push('address');
    if (missing.length) return { ok: false, code: 'missing', missing: missing, error: 'the draft needs ' + missing.map(function (m) { return m === 'offer' ? 'what you sell, in one line' : (m === 'name' ? 'your name' : 'your postal address (commercial email must carry it)'); }).join(', ') + '. Ask the user once and save it with zerackLeads policy.' };
    var disclosure = disclosureFor(lead.kind);
    var optOut = optOutFor(channel);
    var body = [], subject = '', used = [];
    if (lead.kind === 'job') {
      var need = firstSentence(lead.text, 170);
      body.push('Hi,');
      var quoted = need ? need.replace(/"/g, "'") : '';
      body.push('I read your post for ' + text(lead.name, 120).replace(/[.\s]+$/, '') + (quoted ? '. You wrote: "' + quoted + '"' + (/[.!?]$/.test(quoted) ? '' : '.') : '.'));
      used.push('job');
      if ((lead.matched || []).length) { body.push('It matches what I do: ' + lead.matched.slice(0, 4).join(', ') + '.'); used.push('skills'); }
      if (pol.proof) body.push(sentence(pol.proof));
      body.push('How I would start: confirm the scope and what you already have, deliver a first version you can review, then adjust it with your feedback until it is done.');
      body.push(lead.type === 'fixed' ? 'One question: do you have a deadline in mind?' : 'One question: how many hours a week do you expect this to take?');
      body.push('If it helps, we can talk it through in a short call on Upwork Messages.');
      if (lead.price && lead.price.bid) body.push(lead.price.per === 'hour' ? 'My rate for this is ' + money(lead.price.bid) + ' an hour.' : 'I can do it for ' + money(lead.price.bid) + '.');
      if (signature(pol, false)) body.push(signature(pol, false));
      body.push([disclosure, optOut].join('\n'));
    } else if (channel === 'call') {
      var fs = placeFactSentence(lead);
      disclosure = 'I use an AI assistant to find local businesses, and I am calling myself.';
      body.push('Hi, is this ' + text(lead.name, 80) + '? My name is ' + pol.name + (pol.business ? ', from ' + pol.business : '') + '.');
      body.push(disclosure);
      if (fs) { body.push(fs.replace(/^Your listing/, 'I saw that your Google listing').replace(/^You already/, 'I saw that you already')); used.push(topFact(lead) || 'listing'); }
      body.push('I help with exactly this: ' + pol.offer.replace(/[.\s]+$/, '') + '.');
      body.push('Would a short example for ' + text(lead.name, 80) + ' be useful? I can send it wherever you prefer.');
      body.push(optOut);
      return finish(lead, pol, channel, '', body, used, disclosure, optOut, true);
    } else {
      var city = cityOf(lead.address);
      var factLine = placeFactSentence(lead);
      body.push('Hi ' + text(lead.name, 80) + ' team,');
      body.push('I came across ' + text(lead.name, 80) + ' on Google Maps' + (city ? ' while looking at ' + (lead.category ? lead.category.toLowerCase() + 's' : 'businesses') + ' in ' + city : '') + '. ' + factLine);
      used.push(topFact(lead) || 'listing');
      body.push('I help with exactly this: ' + pol.offer.replace(/[.\s]+$/, '') + '.');
      body.push('If it would help, reply and I will send a short example made for ' + text(lead.name, 80) + '.');
      if (signature(pol, channel === 'email')) body.push(signature(pol, channel === 'email'));
      body.push([AD_LINE, disclosure, optOut].join('\n'));
      subject = placeSubject(lead);
    }
    return finish(lead, pol, channel, subject, body, used, disclosure, optOut, false);
  }

  function finish(lead, pol, channel, subject, body, used, disclosure, optOut, script) {
    var joined = body.join(script ? '\n' : '\n\n');
    var out = {
      ok: true,
      lead: lead.id,
      channel: channel,
      script: script === true,
      subject: subject,
      body: joined,
      disclosure: disclosure,
      optOut: optOut,
      adLine: COLD[channel] === 1 ? AD_LINE : '',
      used: used,
      chars: joined.length,
      sig: fold(joined).slice(0, 80)
    };
    out.checks = check(out, lead, pol);
    return out;
  }

  function has(hay, needle) {
    return !!needle && fold(hay).indexOf(fold(needle)) >= 0;
  }

  function check(d, lead, pol) {
    pol = policy(pol);
    var list = [];
    var body = String(d.body || '');
    var cold = COLD[d.channel] === 1;
    list.push({ rule: 'fact', ok: (d.used || []).length > 0, what: 'Says something true and specific about ' + (lead ? lead.name : 'them') + ' from the page read', source: 'ZERACK: a message that fits anyone is not sent' });
    list.push({ rule: 'disclosure', ok: has(body, d.disclosure), what: 'Says an AI assistant helped draft it', source: 'ZERACK: honest AI disclosure' });
    list.push({ rule: 'optout', ok: has(body, d.optOut), what: 'Tells them how to say no', source: cold ? SOURCES.canSpam.author + ': ' + SOURCES.canSpam.title : 'ZERACK: an easy way out' });
    if (d.script) return list;
    list.push({ rule: 'sender', ok: !!pol.name && has(body, pol.name), what: 'Names who is writing', source: cold ? SOURCES.canSpam.author + ': ' + SOURCES.canSpam.title : 'ZERACK' });
    if (cold) list.push({ rule: 'ad', ok: has(body, AD_LINE), what: 'Says it is an offer of services', source: SOURCES.canSpam.author + ': ' + SOURCES.canSpam.title });
    if (d.channel === 'email') list.push({ rule: 'address', ok: !!pol.address && has(body, pol.address), what: 'Carries your postal address', source: SOURCES.canSpam.author + ': ' + SOURCES.canSpam.title });
    if (d.subject) list.push({ rule: 'subject', ok: !!lead && has(d.subject, lead.name), what: 'The subject says what the message is about', source: SOURCES.canSpam.author + ': ' + SOURCES.canSpam.title });
    return list;
  }

  function sentToday(state, now) {
    var today = dayOf(now);
    return state.log.filter(function (e) { return e.event === 'sent' && e.day === today; }).length;
  }

  function bouncesToday(state, now) {
    var today = dayOf(now);
    return state.log.filter(function (e) { return (e.event === 'bounced' || e.event === 'complained') && e.day === today; }).length;
  }

  function status(state, now) {
    state = state && state.log ? state : load(state);
    now = Number(now) || Date.now();
    var pol = state.policy;
    var cap = capToday(pol, state.first, now);
    var sent = sentToday(state, now);
    var b = bouncesToday(state, now);
    var h = hourOf(now);
    var inHours = h >= pol.hours[0] && h < pol.hours[1];
    return { on: pol.on, cap: cap, sent: sent, left: Math.max(0, cap - sent), bounces: b, stopAt: pol.bounces, stopped: b >= pol.bounces, hours: pol.hours.slice(), inHours: inHours, first: state.first, day: dayOf(now), ramp: { start: pol.start, step: pol.step, max: pol.max } };
  }

  function why(lead, state, now, draft) {
    state = state && state.log ? state : load(state);
    now = Number(now) || Date.now();
    if (!lead) return { code: 'no_lead', why: 'no lead with that id was found or drafted' };
    var pol = state.policy;
    var c = contacted(state, lead);
    if (c === 'opted_out') return { code: 'opted_out', why: lead.name + ' asked not to be contacted, or complained, so ZERACK never writes to them again' };
    if (c === 'repeat') return { code: 'repeat', why: lead.name + ' was already contacted, and ZERACK never writes twice to the same place or post' };
    if (!(lead.facts || []).length) return { code: 'generic', why: 'nothing specific about ' + lead.name + ' was read, so the message would fit anyone' };
    if (lead.verdict === 'skip') return { code: 'weak', why: 'the judge says skip ' + lead.name + ': ' + ((lead.reasons || [])[0] || {}).text };
    var d = draft || lead.draft;
    if (!d || !d.body) return { code: 'no_draft', why: 'there is no checked draft for ' + lead.name + ' yet: draft it with zerackLeads first' };
    var failing = check(d, lead, pol).filter(function (x) { return !x.ok; });
    if (failing.length) return { code: 'draft_incomplete', why: 'the draft does not pass: ' + failing.map(function (x) { return x.what.toLowerCase(); }).join('; ') };
    var s = status(state, now);
    if (s.sent >= s.cap) return { code: 'cap', why: 'today\'s cap of ' + s.cap + ' is used up; it rises by ' + pol.step + ' each day up to ' + pol.max };
    if (s.stopped) return { code: 'bounces', why: s.bounces + ' bounces or complaints today, so sending stops until tomorrow' };
    if (!pol.on) return { code: 'off', why: 'lead sending is switched off' };
    if (!s.inHours) return { code: 'hours', why: 'sending runs from ' + pol.hours[0] + ':00 to ' + pol.hours[1] + ':00 your time' };
    return null;
  }

  function carries(lead, typed) {
    var d = lead && lead.draft;
    if (!d) return { ok: false, missing: ['the draft'] };
    var all = (typed || []).map(function (t) { return String(t && t.text != null ? t.text : t); }).join('\n');
    var miss = [];
    if (!has(all, d.disclosure)) miss.push('the AI disclosure line');
    if (!has(all, d.optOut)) miss.push('the opt-out line');
    if (d.adLine && !has(all, d.adLine)) miss.push('the offer-of-services line');
    return { ok: !miss.length, missing: miss };
  }

  function fromTyped(state, typed, now) {
    now = Number(now) || Date.now();
    var texts = (typed || []).map(function (t) { return fold(t && t.text != null ? t.text : t); }).filter(Boolean);
    if (!texts.length) return null;
    var hit = null;
    Object.keys(state.leads).some(function (id) {
      var l = state.leads[id];
      var d = l && l.draft;
      if (!d || !d.sig || !(now - (d.at || 0) < DRAFT_FRESH_MS)) return false;
      var head = d.sig.slice(0, 50);
      if (texts.some(function (t) { return t.indexOf(head) >= 0; })) { hit = l; return true; }
      return false;
    });
    return hit;
  }

  function siteKeyOf(host) {
    var h = String(host || '').toLowerCase().replace(/^www\./, '');
    return h ? 'site:' + h : '';
  }

  function byHost(state, host) {
    var k = siteKeyOf(host);
    if (!k || !state || !state.leads) return null;
    var hit = null;
    Object.keys(state.leads).some(function (id) {
      var l = state.leads[id];
      if (l && (l.keys || []).indexOf(k) >= 0) { hit = l; return true; }
      return false;
    });
    return hit;
  }

  function outreach(host, path) {
    host = String(host || '').toLowerCase();
    path = String(path || '/');
    var hit = null;
    OUTREACH.some(function (o) {
      if (o.host.test(host) && (!o.path || o.path.test(path))) { hit = o.what; return true; }
      return false;
    });
    return hit;
  }

  function record(state, id, event, now, extra) {
    now = Number(now) || Date.now();
    var l = state.leads[id];
    if (!l) return null;
    var ok = { drafted: 1, sent: 1, replied: 1, bounced: 1, complained: 1, opted_out: 1, skipped: 1 };
    if (ok[event] !== 1) return null;
    if (event !== 'drafted') l.status = event;
    if (event === 'sent') { l.sentAt = now; if (!state.first) state.first = dayOf(now); }
    if (event === 'replied' || event === 'bounced' || event === 'complained' || event === 'opted_out') l.outcome = event;
    if (event === 'complained' || event === 'opted_out') (l.keys || []).forEach(function (k) { if (state.never.indexOf(k) < 0) state.never.push(k); });
    state.log.push({ id: id, event: event, at: now, day: dayOf(now), channel: l.channel || '', host: text(extra && extra.host, 120), by: extra && extra.by === 'user' ? 'user' : 'zerack' });
    prune(state);
    return l;
  }

  function find(state, rows, kind, pol, source, now) {
    var out = [];
    (rows || []).forEach(function (r) {
      var l = kind === 'job' ? jobLead(r, pol, source, now) : placeLead(r, pol, source, now);
      if (!l) return;
      l = mergeFound(state, l);
      var c = contacted(state, l);
      if (c) l.contacted = c;
      else delete l.contacted;
      out.push(l);
    });
    var rank = { pitch: 0, bid: 0, look: 1, skip: 2 };
    out.sort(function (a, b) { return (a.contacted ? 1 : 0) - (b.contacted ? 1 : 0) || rank[a.verdict] - rank[b.verdict] || b.score - a.score; });
    prune(state);
    return out;
  }

  function lookup(state, ref) {
    ref = String(ref || '').trim();
    if (!ref) return null;
    if (state.leads[ref]) return state.leads[ref];
    var r = norm(ref);
    var hit = null;
    Object.keys(state.leads).some(function (id) {
      var l = state.leads[id];
      if (l && norm(l.name) === r) { hit = l; return true; }
      return false;
    });
    if (hit) return hit;
    Object.keys(state.leads).some(function (id) {
      var l = state.leads[id];
      if (l && r.length >= 4 && norm(l.name).indexOf(r) >= 0) { hit = l; return true; }
      return false;
    });
    return hit;
  }

  root.NSP_LEADS = Object.freeze({
    key: KEY,
    ceilings: CEIL,
    defaults: policy(null),
    connectPrice: CONNECT_PRICE,
    sources: SOURCES,
    adLine: AD_LINE,
    policy: policy,
    setPolicy: setPolicy,
    load: load,
    dayOf: dayOf,
    capToday: capToday,
    keysOf: keysOf,
    judgePlace: judgePlace,
    judgeJob: judgeJob,
    find: find,
    lookup: lookup,
    compose: compose,
    check: check,
    status: status,
    why: why,
    carries: carries,
    fromTyped: fromTyped,
    byHost: byHost,
    siteKeyOf: siteKeyOf,
    outreach: outreach,
    record: record,
    contacted: contacted
  });
})(typeof self !== 'undefined' ? self : this);
