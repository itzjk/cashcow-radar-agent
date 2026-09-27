(function (root) {
  var owns = Object.prototype.hasOwnProperty;
  if (owns.call(root, 'NSP_EXTRACT')) return;

  var MAX_ROWS = 250;
  var DEFAULT_ROWS = 120;
  var MIN_PROBE = 3;

  function doc() {
    return root.document;
  }

  function here() {
    return root.location;
  }

  function all(sel, from) {
    try { return Array.prototype.slice.call((from || doc()).querySelectorAll(sel)); } catch (e) { return []; }
  }

  function one(from, sel) {
    try { return from.querySelector(sel); } catch (e) { return null; }
  }

  function squash(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function txt(el) {
    return el ? squash(el.textContent) : '';
  }

  function attr(el, name) {
    if (!el) return '';
    var v = el.getAttribute(name);
    return v == null ? '' : String(v);
  }

  function num(s) {
    var t = squash(s).toLowerCase().replace(/^\(|\)$/g, '');
    var m = /^([0-9][0-9,]*(?:\.[0-9]+)?)\s*([kmb])?\b/.exec(t);
    if (!m) return null;
    var n = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(n)) return null;
    if (m[2] === 'k') n *= 1e3;
    else if (m[2] === 'm') n *= 1e6;
    else if (m[2] === 'b') n *= 1e9;
    return Math.round(n * 100) / 100;
  }

  function approx(s) {
    return /[0-9]\s*[kmb]\b/i.test(squash(s));
  }

  function money(s) {
    var t = squash(s);
    var m = /(-?[0-9][0-9.,\s]*)/.exec(t);
    if (!m) return null;
    var raw = m[1].replace(/\s/g, '');
    var lastDot = raw.lastIndexOf('.'), lastComma = raw.lastIndexOf(',');
    var clean;
    if (lastDot >= 0 && lastComma >= 0) clean = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else if (lastComma >= 0) clean = /,[0-9]{2}$/.test(raw) && raw.split(',').length === 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
    else clean = raw;
    var n = parseFloat(clean);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  function currencyOf(s) {
    var t = squash(s);
    var code = /(?:^|[^A-Za-z])(USD|CAD|AUD|NZD|EUR|GBP|JPY|MXN|BRL|INR|CHF|SEK|NOK|DKK|PLN)(?![A-Za-z])/.exec(t);
    if (code) return code[1];
    var sym = /(US\$|CA\$|A\$|\$|\u20ac|\u00a3|\u00a5|\u20b9)/.exec(t);
    return sym ? sym[1] : '';
  }

  function pct(s) {
    var m = /(-?[0-9]+(?:[.,][0-9]+)?)\s*%/.exec(squash(s));
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }

  function absUrl(href, keepQuery) {
    if (!href) return '';
    try {
      var u = new URL(String(href), here().href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return keepQuery ? u.href : u.origin + u.pathname;
    } catch (e) { return ''; }
  }

  function leaves(from, skip) {
    var out = [];
    all('*', from).forEach(function (el) {
      if (skip && skip(el)) return;
      if (el.children && el.children.length) return;
      var t = txt(el);
      if (t) out.push({ el: el, text: t });
    });
    return out;
  }

  function inside(el, box) {
    var n = el;
    while (n) { if (n === box) return true; n = n.parentNode; }
    return false;
  }

  function leafText(from, re, skip) {
    var hit = null;
    leaves(from, skip).some(function (l) { var m = re.exec(l.text); if (m) { hit = m; return true; } return false; });
    return hit;
  }

  function limitOf(opts) {
    var n = Number(opts && opts.limit);
    return n > 0 ? Math.min(MAX_ROWS, Math.floor(n)) : DEFAULT_ROWS;
  }

  function blanks(rows, fields) {
    var out = {};
    fields.forEach(function (f) {
      var n = 0;
      rows.forEach(function (r) { if (r[f] == null || r[f] === '') n++; });
      if (n) out[f] = n;
    });
    return out;
  }

  function page() {
    var d = doc(), l = here();
    return { url: absUrl(l.href, true), title: squash(d.title).slice(0, 200) };
  }

  function done(reader, label, rows, extra) {
    var out = { ok: true, reader: reader, label: label, count: rows.length, rows: rows };
    var p = page();
    out.url = p.url;
    out.pageTitle = p.title;
    Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  function drift(reader, label, seen, why, extra) {
    var out = { ok: false, code: 'drift', reader: reader, seen: seen, error: label + ': ' + why + ' The site changed this page, so ZERACK reports nothing from it instead of a wrong number.' };
    Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  function notHere(reader, why) {
    return { ok: false, code: 'not_this_page', reader: reader, error: why };
  }

  function listingIds(from) {
    var seen = {};
    all('a[href*="/listing/"]', from).forEach(function (a) {
      var m = /\/listing\/([0-9]+)/.exec(attr(a, 'href'));
      if (m) seen[m[1]] = 1;
    });
    return Object.keys(seen);
  }

  function outermost(list) {
    return list.filter(function (el) {
      return !list.some(function (other) { return other !== el && inside(el, other); });
    });
  }

  function etsyCards() {
    var primary = all('.v2-listing-card');
    if (primary.length) return { list: primary, via: 'primary' };
    var fallback = outermost(all('div[data-listing-id]'));
    return { list: fallback, via: fallback.length ? 'fallback' : 'none' };
  }

  var ETSY_BADGES = { 'star seller': 'starSeller', bestseller: 'bestseller', 'popular now': 'popularNow', "etsy's pick": 'etsyPick', 'free shipping': 'freeShipping' };

  function etsyRow(card) {
    var link = one(card, 'a.listing-link') || one(card, 'a[href*="/listing/"]');
    var titleEl = one(card, '.v2-listing-card__title') || one(card, 'h3') || one(card, 'h2');
    var title = titleEl ? txt(titleEl) : attr(link, 'title');
    var id = attr(card, 'data-listing-id');
    if (!id && link) { var mid = /\/listing\/([0-9]+)/.exec(attr(link, 'href')); if (mid) id = mid[1]; }
    var priceEl = one(card, '.lc-price .currency-value') || one(card, '[class*="price"] .currency-value');
    var symEl = one(card, '.lc-price .currency-symbol') || one(card, '.currency-symbol');
    var origEl = one(card, '.wt-text-strikethrough .currency-value');
    var skipTitle = function (el) { return !!titleEl && inside(el, titleEl); };
    var off = leafText(card, /^\((\d{1,2})% off\)$/, skipTitle);
    var ratingEl = one(card, 'input[name="rating"]');
    var rating = ratingEl ? num(attr(ratingEl, 'value')) : null;
    var reviews = null;
    var stars = one(card, '[data-stars-svg-container]');
    var starBox = stars ? stars.parentNode : null;
    if (starBox) { var rc = leafText(starBox, /^\(([0-9][0-9.,]*[kKmM]?)\)$/); if (rc) reviews = num(rc[1]); }
    if (reviews == null) {
      var aria = all('[aria-label]', card).map(function (e) { return attr(e, 'aria-label'); }).join(' | ');
      var ar = /([0-9.]+) out of 5 stars,\s*([0-9][0-9,.]*[kKmM]?) reviews/.exec(aria);
      if (ar) { reviews = num(ar[2]); if (rating == null) rating = num(ar[1]); }
    }
    var seller = txt(one(card, '[data-seller-name-container]'));
    var shop = '';
    var sm = /From shop ([^\s]+)/.exec(seller);
    if (sm) shop = sm[1];
    var row = {
      id: id,
      title: title,
      url: link ? absUrl(attr(link, 'href')) : '',
      price: priceEl ? money(txt(priceEl)) : null,
      currency: symEl ? txt(symEl) : '',
      originalPrice: origEl ? money(txt(origEl)) : null,
      discountPct: off ? Number(off[1]) : null,
      rating: rating,
      reviews: reviews,
      shop: shop,
      ad: /\bAd (?:by|from) Etsy seller\b/i.test(seller),
      starSeller: false, bestseller: false, popularNow: false, etsyPick: false, freeShipping: false
    };
    leaves(card, skipTitle).forEach(function (l) {
      var key = ETSY_BADGES[l.text.toLowerCase()];
      if (key) row[key] = true;
    });
    row.metric = row.reviews;
    return row;
  }

  function etsyGrid(opts, reader, label) {
    var got = etsyCards();
    var probe = listingIds().length;
    var ids = {};
    var rows = got.list.map(etsyRow).filter(function (r) {
      if (!r.id) return true;
      if (ids[r.id]) return false;
      ids[r.id] = 1;
      return true;
    }).slice(0, limitOf(opts));
    if (!rows.length) {
      if (probe >= MIN_PROBE) return drift(reader, label, probe, 'the page links to ' + probe + ' listings and none of them reads as a listing card.', { via: got.via });
      return null;
    }
    var named = rows.filter(function (r) { return r.title && r.url; });
    if (named.length < Math.ceil(rows.length / 2)) return drift(reader, label, rows.length, 'only ' + named.length + ' of ' + rows.length + ' listing cards carry a title and a link.', { via: got.via });
    var gaps = blanks(named, ['price', 'reviews', 'rating']);
    var extra = { via: got.via, onPage: probe, blanks: gaps };
    if ((gaps.price || 0) > named.length / 2) extra.partial = ['price'];
    return done(reader, label, named, extra);
  }

  function readEtsyGrid(opts) {
    return etsyGrid(opts, 'etsy.grid', 'Etsy listings') || notHere('etsy.grid', 'no Etsy listing cards on this page');
  }

  function shopFacts() {
    var facts = { name: '', sales: null, salesApprox: false, since: null, admirers: null, rating: null, starSeller: false };
    var h1 = one(doc(), 'h1.shop-name') || one(doc(), 'h1');
    facts.name = txt(h1);
    var body = doc().body || doc();
    var exact = leafText(body, /^([0-9][0-9,]*)\s+Sales$/i);
    if (exact) facts.sales = num(exact[1]);
    if (facts.sales == null) {
      all('div,span,p', body).some(function (el) {
        var kids = el.children || [];
        if (kids.length !== 1) return false;
        var own = squash(String(el.textContent || '').replace(kids[0].textContent, ''));
        if (!/^Sales$/i.test(own)) return false;
        var v = txt(kids[0]);
        if (/^[0-9][0-9,]*$/.test(v)) { facts.sales = num(v); return true; }
        return false;
      });
    }
    if (facts.sales == null) {
      var hl = one(doc(), '[data-highlight="sales"] .highlight__primary-content');
      if (hl && num(txt(hl)) != null) { facts.sales = num(txt(hl)); facts.salesApprox = approx(txt(hl)); }
    }
    all('div,span,p', body).some(function (el) {
      var kids = el.children || [];
      if (kids.length !== 1 || !/^On Etsy since/i.test(squash(el.textContent))) return false;
      var y = /^((?:19|20)[0-9]{2})$/.exec(txt(kids[0]));
      if (y) { facts.since = Number(y[1]); return true; }
      return false;
    });
    var adm = leafText(body, /^([0-9][0-9,]*)\s+Admirers$/i);
    if (adm) facts.admirers = num(adm[1]);
    var rated = one(doc(), '[data-highlight="rating"] [data-rating]') || one(doc(), '[data-review-ratings-count][data-rating]');
    if (rated) facts.rating = num(attr(rated, 'data-rating'));
    facts.starSeller = !!one(doc(), '.star-seller-badge');
    return facts;
  }

  function readEtsyShop(opts) {
    var facts = shopFacts();
    var grid = etsyGrid(opts, 'etsy.shop', 'Etsy shop');
    var readSomething = facts.sales != null || facts.since != null;
    if (grid && grid.ok === false) return grid;
    if (!readSomething && !grid) {
      if (/^\/shop\//.test(here().pathname) && listingIds().length >= MIN_PROBE) return drift('etsy.shop', 'Etsy shop', listingIds().length, 'this is a shop page and neither its sales, its opening year nor its listings could be read.');
      return notHere('etsy.shop', 'this is not an Etsy shop page');
    }
    if (!readSomething && /^\/shop\//.test(here().pathname)) {
      return drift('etsy.shop', 'Etsy shop', grid ? grid.count : 0, 'the listings read, but the shop sales and opening year did not.');
    }
    var out = grid || done('etsy.shop', 'Etsy shop', [], {});
    out.shop = facts;
    return out;
  }

  function ldProduct() {
    var found = null;
    all('script[type="application/ld+json"]').some(function (s) {
      var data;
      try { data = JSON.parse(s.textContent || 'null'); } catch (e) { return false; }
      var list = [].concat(data && data['@graph'] ? data['@graph'] : data);
      return list.some(function (d) {
        if (d && (d['@type'] === 'Product' || (Array.isArray(d['@type']) && d['@type'].indexOf('Product') >= 0))) { found = d; return true; }
        return false;
      });
    });
    return found;
  }

  function readEtsyListing() {
    var label = 'Etsy listing';
    var row = { title: '', url: absUrl(here().href), price: null, currency: '', originalPrice: null, favorites: null, listedOn: '', reviews: null, rating: null, shopRating: null, shopReviews: null, shopReviewsApprox: false, shopSales: null, shopSalesApprox: false, shopYears: null };
    var via = 'none';
    var ld = ldProduct();
    if (ld) {
      via = 'jsonld';
      row.title = squash(ld.name);
      var offer = [].concat(ld.offers || [])[0] || {};
      row.price = money(offer.price);
      row.currency = String(offer.priceCurrency || '');
      if (ld.aggregateRating) { row.rating = num(ld.aggregateRating.ratingValue); row.reviews = num(ld.aggregateRating.reviewCount); }
    }
    var h1 = one(doc(), 'h1[data-buy-box-listing-title]') || one(doc(), 'h1');
    if (!row.title && h1) { row.title = txt(h1); via = via === 'none' ? 'dom' : via; }
    var box = one(doc(), '[data-buy-box-region="price"]');
    if (box) {
      var first = one(box, 'p');
      var shown = first ? txt(first).replace(/^(?:Sale )?Price:?\s*/i, '') : '';
      if (row.price == null && shown) { row.price = money(shown); via = via === 'none' ? 'dom' : via; }
      if (!row.currency && shown) row.currency = currencyOf(shown);
      var orig = one(box, '.wt-text-strikethrough');
      if (orig) row.originalPrice = money(txt(orig));
    }
    var meta = attr(one(doc(), 'meta[name="description"]'), 'content');
    var fav = /has ([0-9][0-9,]*) favorites/.exec(meta);
    if (fav) row.favorites = num(fav[1]);
    var listed = /Listed on ([A-Z][a-z]{2,9} [0-9]{1,2}, [0-9]{4})/.exec(meta);
    if (listed) row.listedOn = listed[1];
    var avg = one(doc(), '.rating-and-reviews-count__avg-rating');
    if (avg) row.shopRating = num(txt(avg));
    var cnt = one(doc(), '.rating-and-reviews-count__reviews-count');
    if (cnt) { row.shopReviews = num(txt(cnt)); row.shopReviewsApprox = approx(txt(cnt)); }
    var body = doc().body || doc();
    var sales = leafText(body, /^([0-9][0-9.,]*[kKmM]?)\s+sales$/i);
    if (sales) { row.shopSales = num(sales[1]); row.shopSalesApprox = approx(sales[1]); }
    var years = leafText(body, /^([0-9]{1,2})\s+years? on Etsy$/i);
    if (years) row.shopYears = Number(years[1]);
    var onListing = /^\/listing\/[0-9]+/.test(here().pathname);
    if (!row.title && !onListing) return notHere('etsy.listing', 'this is not an Etsy listing page');
    if (!row.title || row.price == null) return drift('etsy.listing', label, 1, 'the listing ' + (row.title ? 'price' : 'title') + ' did not read.', { via: via });
    row.metric = row.reviews;
    return done('etsy.listing', label, [row], { via: via });
  }

  function productLinks() {
    var seen = {};
    all('a[href*="/products/"]').forEach(function (a) {
      var m = /\/products\/([^\/?#]+)/.exec(attr(a, 'href'));
      if (m) seen[m[1]] = 1;
    });
    return Object.keys(seen);
  }

  function shopifyCardRow(card) {
    var link = one(card, '.card__content .card__heading a') || one(card, '.card__heading a') || one(card, 'a[href*="/products/"]');
    var title = link ? txt(link) : '';
    var price = null, compare = null, shown = '';
    var sale = one(card, '.price--on-sale .price-item--sale');
    if (sale) { shown = txt(sale); price = money(shown); var was = one(card, '.price--on-sale s.price-item--regular'); if (was) compare = money(txt(was)); }
    if (price == null) { var reg = one(card, '.price__regular .price-item--regular') || one(card, '.price-item'); if (reg) { shown = txt(reg); price = money(shown); } }
    var soldOut = !!one(card, '.price--sold-out') || leaves(card).some(function (l) { return /^sold out$/i.test(l.text); });
    var onSale = !!one(card, '.price--on-sale') || leaves(card).some(function (l) { return /^sale$/i.test(l.text); });
    return { title: title, url: link ? absUrl(attr(link, 'href')) : '', price: price, currency: currencyOf(shown), compareAt: compare, onSale: onSale, soldOut: soldOut };
  }

  function readShopifyGrid(opts) {
    var label = 'Store products';
    var primary = all('.card-wrapper');
    var via = 'primary';
    var list = primary;
    if (!list.length) {
      via = 'fallback';
      list = outermost(all('li').filter(function (li) { return !!one(li, 'a[href*="/products/"]') && /[0-9]/.test(txt(li)); }));
    }
    var probe = productLinks().length;
    var rows = list.slice(0, limitOf(opts)).map(shopifyCardRow).filter(function (r) { return r.title && r.url; });
    if (!rows.length) {
      if (probe >= MIN_PROBE) return drift('shopify.grid', label, probe, 'the page links to ' + probe + ' products and none of them reads as a product card.', { via: via });
      return notHere('shopify.grid', 'no product cards on this page');
    }
    var gaps = blanks(rows, ['price']);
    var extra = { via: via, onPage: probe, blanks: gaps };
    if ((gaps.price || 0) > rows.length / 2) extra.partial = ['price'];
    return done('shopify.grid', label, rows, extra);
  }

  function productRow(p, origin) {
    var variants = Array.isArray(p.variants) ? p.variants : [];
    var prices = variants.map(function (v) { return money(v && v.price); }).filter(function (n) { return n != null; });
    var compares = variants.map(function (v) { return money(v && v.compare_at_price); }).filter(function (n) { return n != null && n > 0; });
    var known = variants.filter(function (v) { return v && typeof v.available === 'boolean'; });
    return {
      title: squash(p.title),
      url: p.handle ? origin + '/products/' + encodeURIComponent(String(p.handle)) : '',
      price: prices.length ? Math.min.apply(null, prices) : null,
      compareAt: compares.length ? Math.max.apply(null, compares) : null,
      available: known.length ? known.some(function (v) { return v.available === true; }) : null,
      type: squash(p.product_type),
      vendor: squash(p.vendor),
      created: String(p.created_at || ''),
      published: String(p.published_at || ''),
      variants: variants.length
    };
  }

  function readShopifyProducts(opts) {
    var label = 'Store catalog';
    var origin = here().origin || (here().protocol + '//' + here().host);
    var n = limitOf(opts);
    var fetcher = root.fetch;
    if (typeof fetcher !== 'function') return Promise.resolve({ ok: false, code: 'not_exposed', reader: 'shopify.products', error: 'this page cannot fetch its own catalog' });
    return Promise.resolve(fetcher.call(root, origin + '/products.json?limit=' + n, { credentials: 'omit', headers: { Accept: 'application/json' } })).then(function (res) {
      var type = res && res.headers && typeof res.headers.get === 'function' ? String(res.headers.get('content-type') || '') : '';
      if (!res || !res.ok) return { ok: false, code: 'not_exposed', reader: 'shopify.products', status: res ? res.status : 0, error: 'this store does not publish its catalog at /products.json (HTTP ' + (res ? res.status : 0) + '). That means hidden, not empty.' };
      if (type && !/json/i.test(type)) return { ok: false, code: 'not_exposed', reader: 'shopify.products', status: res.status, error: 'this site answers /products.json with a web page, not a Shopify catalog. That means hidden or not Shopify, not empty.' };
      return res.text().then(function (body) {
        var data;
        try { data = JSON.parse(body); } catch (e) { return { ok: false, code: 'not_exposed', reader: 'shopify.products', status: res.status, error: 'this site answers /products.json with something that is not a catalog' }; }
        if (!data || !Array.isArray(data.products)) return drift('shopify.products', label, 1, 'the catalog answered without a product list.');
        var rows = data.products.slice(0, n).map(function (p) { return productRow(p || {}, origin); }).filter(function (r) { return r.title; });
        if (data.products.length && !rows.length) return drift('shopify.products', label, data.products.length, data.products.length + ' products came back and none carries a title.');
        return done('shopify.products', label, rows, { via: 'json', listed: data.products.length, capped: data.products.length >= n, blanks: blanks(rows, ['price', 'created']) });
      });
    }, function (e) {
      return { ok: false, code: 'not_exposed', reader: 'shopify.products', error: 'the catalog could not be fetched: ' + squash(e && e.message || e).slice(0, 120) };
    });
  }

  function norm(s) {
    return squash(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9%#$ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cellText(cell, strip) {
    if (!strip) return txt(cell);
    var parts = [];
    (function walk(node) {
      Array.prototype.forEach.call(node.childNodes || [], function (c) {
        if (c.nodeType === 3) { parts.push(c.textContent); return; }
        if (c.nodeType !== 1) return;
        try { if (c.matches(strip)) return; } catch (e) {}
        walk(c);
      });
    })(cell);
    return squash(parts.join(' '));
  }

  function gridParts(t) {
    var isTable = String(t.tagName || '').toLowerCase() === 'table';
    var heads, rows;
    if (isTable) {
      heads = all('thead th, thead td', t);
      if (!heads.length) { var firstRow = one(t, 'tr'); heads = firstRow ? all('th', firstRow) : []; }
      rows = all('tr', t).filter(function (tr) { return !tr.closest || !tr.closest('thead'); }).filter(function (tr) { return all('td', tr).length > 0; });
      return { heads: heads, rows: rows.map(function (tr) { return all('td, th', tr); }) };
    }
    heads = all('[role="columnheader"]', t);
    rows = all('[role="row"]', t).filter(function (r) { return all('[role="cell"], [role="gridcell"], [role="rowheader"]', r).length > 0; });
    return { heads: heads, rows: rows.map(function (r) { return all('[role="cell"], [role="gridcell"], [role="rowheader"]', r); }) };
  }

  function mapHeads(heads, spec, strip) {
    var texts = heads.map(function (h) { return norm(cellText(h, strip)); });
    var map = {};
    Object.keys(spec).forEach(function (field) {
      var syn = [].concat(spec[field]).map(norm).filter(Boolean);
      var best = -1, rank = 9;
      texts.forEach(function (t, i) {
        syn.forEach(function (s) {
          var r = t === s ? 0 : (t.indexOf(s + ' ') === 0 || t.slice(-s.length - 1) === ' ' + s ? 1 : (t.indexOf(s) >= 0 ? 2 : 9));
          if (r < rank) { rank = r; best = i; }
        });
      });
      if (best >= 0 && rank < 9) map[field] = best;
    });
    return { map: map, texts: texts };
  }

  function typed(value, type) {
    if (type === 'int' || type === 'num') return num(value.replace(/[^0-9.,kKmMbB()-]/g, ''));
    if (type === 'pct') return pct(value);
    if (type === 'money') return money(value);
    return value;
  }

  function readTable(opts, reader, label) {
    opts = opts || {};
    reader = reader || 'table';
    label = label || 'Table';
    var spec = opts.columns && typeof opts.columns === 'object' ? opts.columns : null;
    if (!spec) return notHere(reader, 'no column names were given for the table');
    var need = Array.isArray(opts.need) && opts.need.length ? opts.need : Object.keys(spec);
    var types = opts.types || {};
    var strip = typeof opts.strip === 'string' && opts.strip ? opts.strip : '';
    var cands = outermost(all('table, [role="grid"], [role="table"], [role="treegrid"]'));
    var best = null;
    var seenHeads = [];
    var withRows = 0;
    cands.forEach(function (t) {
      var parts = gridParts(t);
      if (!parts.rows.length) return;
      withRows++;
      var m = mapHeads(parts.heads, spec, strip);
      seenHeads = seenHeads.concat(m.texts.filter(Boolean)).slice(0, 24);
      var hits = need.filter(function (f) { return owns.call(m.map, f); }).length;
      var score = hits * 100000 + parts.rows.length;
      if (!best || score > best.score) best = { score: score, hits: hits, map: m.map, rows: parts.rows, heads: m.texts };
    });
    if (!best) return notHere(reader, 'no table with rows on this page');
    if (best.hits < need.length) {
      var missing = need.filter(function (f) { return !owns.call(best.map, f); });
      return drift(reader, label, withRows, 'a table is on the page but its columns do not match; missing ' + missing.join(', ') + '.', { headersSeen: seenHeads, missing: missing });
    }
    var rows = best.rows.slice(0, limitOf(opts)).map(function (cells) {
      var r = {};
      Object.keys(best.map).forEach(function (f) {
        var cell = cells[best.map[f]];
        var v = cell ? cellText(cell, strip) : '';
        r[f] = v === '' ? null : typed(v, types[f]);
        if (f === (opts.linkField || '') && cell) { var a = one(cell, 'a[href]'); if (a) r.url = absUrl(attr(a, 'href'), true); }
      });
      return r;
    }).filter(function (r) { return need.some(function (f) { return r[f] != null; }); });
    if (!rows.length) return drift(reader, label, best.rows.length, 'the table has ' + best.rows.length + ' rows and none of them reads.');
    return done(reader, label, rows, { columns: best.heads, blanks: blanks(rows, Object.keys(best.map)) });
  }

  function issueRow(li) {
    var link = one(li, 'a[data-testid="issue-pr-title-link"]') || one(li, 'a.js-navigation-open') || one(li, 'a[id^="issue_"]');
    var href = attr(link, 'href');
    var m = /\/(?:issues|pull)\/([0-9]+)/.exec(href);
    var cm = one(li, '[data-testid="list-row-comments"]');
    var comments = null;
    if (cm) {
      var c = /([0-9][0-9,]*)\s+comments?/.exec(attr(cm, 'aria-label') + ' ' + txt(cm));
      comments = c ? num(c[1]) : 0;
    } else {
      var legacy = one(li, 'a[aria-label$="comments"], a[aria-label$="comment"]');
      if (legacy) { var lc = /([0-9][0-9,]*)/.exec(attr(legacy, 'aria-label')); comments = lc ? num(lc[1]) : null; }
    }
    var labels = all('[data-listview-component="trailing-badge"] a, a.IssueLabel', li).map(function (a) {
      var inner = one(a, '[data-component="Text"]');
      return inner ? txt(inner) : txt(a);
    }).filter(Boolean);
    var time = one(li, 'relative-time[datetime]') || one(li, 'time[datetime]');
    var sr = all('.sr-only', li).map(txt).join(' ');
    var state = /Status: ([A-Za-z ]+)\./.exec(sr);
    return {
      title: link ? txt(link) : '',
      url: link ? absUrl(href) : '',
      number: m ? Number(m[1]) : null,
      comments: comments,
      labels: labels,
      created: attr(time, 'datetime'),
      state: state ? state[1].toLowerCase() : ''
    };
  }

  function readIssues(opts) {
    var label = 'GitHub issues';
    var list = all('[role="listitem"]').filter(function (li) { return !!one(li, 'a[data-testid="issue-pr-title-link"]'); });
    var via = 'primary';
    if (!list.length) { via = 'fallback'; list = all('div.js-issue-row, div[id^="issue_"]'); }
    var seen = {};
    all('a[href*="/issues/"]').forEach(function (a) { var mm = /\/issues\/([0-9]+)$/.exec(attr(a, 'href')); if (mm) seen[mm[1]] = 1; });
    var probe = Object.keys(seen).length;
    var rows = list.slice(0, limitOf(opts)).map(issueRow).filter(function (r) { return r.title && r.url; });
    if (!rows.length) {
      if (probe >= MIN_PROBE) return drift('github.issues', label, probe, 'the page links to ' + probe + ' issues and none of them reads as an issue row.', { via: via });
      return notHere('github.issues', 'no issue list on this page');
    }
    rows.forEach(function (r) { r.metric = r.comments; });
    return done('github.issues', label, rows, { via: via, onPage: probe, blanks: blanks(rows, ['comments', 'created']) });
  }

  var ATOM_MAX = 40;
  var XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  var GH_RESERVED = /^(settings|orgs|organizations|topics|marketplace|explore|notifications|login|logout|join|signup|sponsors|features|pricing|about|collections|trending|search|new|codespaces|issues|pulls|dashboard|site|security|enterprise|readme|apps|customer-stories|team|contact|account|stars|watching)$/;

  function unescapeXml(s) {
    return String(s == null ? '' : s).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, function (m, e) {
      if (e.charAt(0) === '#') {
        var n = e.charAt(1) === 'x' || e.charAt(1) === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        if (!isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return m;
        return String.fromCodePoint(n);
      }
      var k = e.toLowerCase();
      return owns.call(XML_ENT, k) ? XML_ENT[k] : m;
    });
  }

  function attrIn(tag, name) {
    var m = new RegExp('\\s' + name + '\\s*=\\s*"([^"]*)"', 'i').exec(String(tag || ''));
    if (!m) m = new RegExp('\\s' + name + "\\s*=\\s*'([^']*)'", 'i').exec(String(tag || ''));
    return m ? unescapeXml(m[1]) : null;
  }

  function inner(block, name) {
    var m = new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>', 'i').exec(String(block || ''));
    return m ? m[1] : '';
  }

  function lines(html) {
    var t = String(html || '')
      .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|pre|tr|section|header|footer|dt|dd|td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    return unescapeXml(t).split('\n').map(function (l) { return l.replace(/[ \t\r\f\v\u00a0]+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').trim(); }).filter(Boolean);
  }

  function plain(html) {
    return lines(html).join('\n');
  }

  function isoOf(s) {
    var t = Date.parse(String(s || ''));
    return isFinite(t) ? new Date(t).toISOString() : '';
  }

  function atom(xml) {
    var out = [];
    var re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g;
    var m;
    while ((m = re.exec(String(xml || ''))) && out.length < ATOM_MAX) {
      var e = m[1];
      var link = /<link\b[^>]*\brel="alternate"[^>]*>/.exec(e) || /<link\b[^>]*>/.exec(e);
      out.push({
        id: squash(unescapeXml(inner(e, 'id'))),
        title: squash(unescapeXml(inner(e, 'title'))),
        at: isoOf(squash(inner(e, 'updated'))),
        url: link ? attrIn(link[0], 'href') || '' : '',
        author: squash(unescapeXml(inner(inner(e, 'author'), 'name'))),
        text: plain(unescapeXml(inner(e, 'content')))
      });
    }
    return out;
  }

  function commitRows(entries) {
    return entries.map(function (e) {
      var ls = String(e.text || '').split('\n').filter(Boolean);
      var subject = ls[0] || e.title.replace(/\u2026$/, '');
      var sha = /\/commit\/([0-9a-f]{7,40})/.exec(e.url || '') || /Commit\/([0-9a-f]{7,40})/.exec(e.id || '');
      return {
        sha: sha ? sha[1].slice(0, 7) : '',
        subject: subject.slice(0, 300),
        body: ls.slice(1).join(' ').slice(0, 400),
        at: e.at,
        author: e.author,
        url: e.url,
        merge: /^Merge (pull request|branch|remote-tracking)\b/.test(subject)
      };
    }).filter(function (c) { return c.subject; });
  }

  function releaseRows(entries) {
    return entries.map(function (e) {
      var tag = /\/releases\/tag\/([^\/?#]+)/.exec(e.url || '');
      return { name: e.title, tag: tag ? decodeURIComponent(tag[1]) : '', at: e.at, url: e.url, notes: String(e.text || '').replace(/\n/g, ' ').slice(0, 400) };
    }).filter(function (r) { return r.name || r.tag; });
  }

  function counterTitle(html, id) {
    var m = new RegExp('<[a-z][a-z0-9-]*\\b[^>]*\\bid="' + id + '"[^>]*>', 'i').exec(html);
    if (!m) return undefined;
    var t = attrIn(m[0], 'title');
    return t == null || t === '' ? null : num(t);
  }

  function jsonAt(html, key) {
    var i = html.indexOf('"' + key + '":{');
    if (i < 0) return null;
    var start = i + key.length + 3;
    var depth = 0, str = false, esc = false;
    for (var j = start; j < html.length && j < start + 300000; j++) {
      var c = html.charAt(j);
      if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
      if (c === '"') str = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(start, j + 1)); } catch (e) { return null; } } }
    }
    return null;
  }

  function repoPath(url) {
    var u;
    try { u = new URL(String(url || '')); } catch (e) { return null; }
    if (u.hostname.toLowerCase() !== 'github.com') return null;
    var p = u.pathname.split('/').filter(Boolean);
    if (p.length < 2 || GH_RESERVED.test(p[0].toLowerCase())) return null;
    return { owner: p[0], repo: p[1].replace(/\.git$/, ''), rest: p.slice(2), origin: u.origin, base: u.origin + '/' + p[0] + '/' + p[1].replace(/\.git$/, '') };
  }

  function githubRepoFromHtml(html, url) {
    html = String(html || '');
    var where = repoPath(url);
    if (!where) return { ok: false, code: 'not_this_page', error: 'this is not a GitHub repository page' };
    var side = jsonAt(html, 'sidebarAbout') || {};
    var stars = counterTitle(html, 'repo-stars-counter-star');
    var forks = counterTitle(html, 'repo-network-counter');
    var issues = counterTitle(html, 'issues-repo-tab-count');
    var pulls = counterTitle(html, 'pull-requests-repo-tab-count');
    if (stars == null && typeof side.stargazerCount === 'number') stars = side.stargazerCount;
    if (forks == null && typeof side.forksCount === 'number') forks = side.forksCount;
    var watchers = typeof side.watcherCount === 'number' ? side.watcherCount : null;
    if (watchers == null) { var w = /<strong>([0-9][0-9.,]*[kKmM]?)<\/strong>\s*watching/.exec(html); if (w) watchers = num(w[1]); }
    var commits = /"commitCount":"([0-9][0-9,]*)"/.exec(html) || />\s*([0-9][0-9,]*)\s+Commits\s*</.exec(html);
    var meta = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html);
    var home = !where.rest.length || where.rest[0] === 'tree';
    var desc = typeof side.description === 'string' && side.description ? side.description : (meta && home ? unescapeXml(meta[1]).replace(new RegExp('\\s+-\\s+' + where.owner + '/' + where.repo + '\\s*$', 'i'), '') : '');
    var topics = Array.isArray(side.topics) ? side.topics.map(function (t) { return typeof t === 'string' ? t : (t && (t.name || t.topic)) || ''; }).filter(Boolean) : [];
    if (!topics.length) { var tre = /href="\/topics\/([a-z0-9-]+)"/g, tm, seenT = {}; while ((tm = tre.exec(html)) && topics.length < 20) { if (!seenT[tm[1]]) { seenT[tm[1]] = 1; topics.push(tm[1]); } } }
    var spdx = /"spdxId":"([^"]+)"/.exec(html);
    var homepage = /"homepageUrl":"([^"]+)"/.exec(html);
    var branch = /"defaultBranch":"([^"]+)"/.exec(html);
    var created = /"repo":\{"id":[0-9]+,[^{}]*?"createdAt":"([^"]+)"/.exec(html);
    var sections = side.sections && typeof side.sections === 'object' ? side.sections : {};
    var rel = sections.releases && typeof sections.releases === 'object' ? sections.releases : null;
    var contrib = /href="\/[^"\/]+\/[^"\/]+\/graphs\/contributors"[^>]*>[\s\S]{0,500}?(?:class="Counter[^"]*"|data-component="CounterLabel")[^>]*>\s*([0-9][0-9,]*)\s*</.exec(html);
    var langs = [];
    var lre = /role="progressbar"[^>]*aria-label="([^":]{1,40}): ([0-9]+(?:\.[0-9]+)?)%"/g, lm;
    while ((lm = lre.exec(html)) && langs.length < 6) langs.push({ name: unescapeXml(lm[1]), pct: Number(lm[2]) });
    var headings = [];
    var art = /<article\b[^>]*class="[^"]*markdown-body[^"]*"[^>]*>([\s\S]*?)<\/article>/.exec(html);
    if (art) {
      var hre = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/g, hm;
      while ((hm = hre.exec(art[1])) && headings.length < 12) { var ht = squash(plain(hm[2])); if (ht) headings.push({ level: Number(hm[1]), text: ht.slice(0, 120) }); }
    }
    var facts = {
      owner: where.owner,
      repo: where.repo,
      url: where.base,
      description: squash(desc).slice(0, 600),
      stars: stars == null ? null : stars,
      forks: forks == null ? null : forks,
      watchers: watchers,
      openIssues: issues === undefined ? null : issues,
      openPulls: pulls === undefined ? null : pulls,
      issuesOff: issues === undefined,
      commits: commits ? num(commits[1]) : null,
      releases: rel && typeof rel.releaseCount === 'number' ? rel.releaseCount : null,
      tags: rel && typeof rel.tagCount === 'number' ? rel.tagCount : null,
      contributors: contrib ? num(contrib[1]) : null,
      languages: langs,
      topics: topics.slice(0, 20),
      license: spdx ? spdx[1] : (/\bMIT license\b/.test(html) ? 'MIT' : ''),
      homepage: homepage ? homepage[1] : '',
      branch: branch ? branch[1] : '',
      created: created ? isoOf(created[1]) : '',
      headings: headings
    };
    if (facts.stars == null && facts.forks == null && facts.commits == null) return { ok: false, code: 'drift', reader: 'github.repo', seen: 1, error: 'GitHub repository: neither the stars, the forks nor the commit count read on ' + where.owner + '/' + where.repo + '. The site changed this page, so ZERACK reports nothing from it instead of a wrong number.' };
    return { ok: true, repo: facts };
  }

  function cwsFromHtml(html, url) {
    html = String(html || '');
    var ls = lines(html);
    var text = ls.join('\n');
    var after = function (label) { var i = ls.indexOf(label); return i >= 0 && i + 1 < ls.length ? ls[i + 1] : ''; };
    var users = /(?:^|[\n (])([0-9][0-9,.]*\s*[KMB]?)\+?\s+users\b/i.exec(text);
    var rating = /(?:^|\n)([0-5](?:\.[0-9])?) out of 5\b/.exec(text);
    var ratings = /(?:^|[\n (])([0-9][0-9,.]*\s*[KMB]?) ratings?\b/i.exec(text);
    var og = /<meta\s+property="og:title"\s+content="([^"]*)"/i.exec(html);
    var title = inner(html, 'title');
    var name = squash(unescapeXml(og ? og[1] : title)).replace(/\s+-\s+Chrome Web Store\s*$/i, '');
    var id = /\/detail\/(?:[^\/]+\/)?([a-p]{32})(?:[\/?#]|$)/.exec(String(url || ''));
    var updated = after('Updated');
    var out = {
      name: name,
      id: id ? id[1] : '',
      users: users ? num(users[1].replace(/\s+/g, '')) : null,
      usersApprox: users ? /[KMB]|\+/i.test(users[0]) : false,
      rating: rating ? Number(rating[1]) : null,
      ratings: ratings ? num(ratings[1].replace(/\s+/g, '')) : null,
      ratingsApprox: ratings ? /[KMB]/i.test(ratings[1]) : false,
      version: after('Version').slice(0, 40),
      updated: isoOf(updated) ? isoOf(updated).slice(0, 10) : '',
      featured: ls.indexOf('Featured') >= 0,
      offeredBy: after('Offered by').slice(0, 80)
    };
    if (!out.name && out.users == null) return { ok: false, code: 'not_this_page', error: 'this is not a Chrome Web Store listing' };
    if (out.users == null && out.rating == null) return { ok: false, code: 'drift', reader: 'cws.listing', seen: 1, error: 'Chrome Web Store listing: the page opened but neither its users nor its rating read. The site changed this page, so ZERACK reports nothing from it instead of a wrong number.' };
    return { ok: true, listing: out };
  }

  function npmFromHtml(html, url) {
    html = String(html || '');
    var label = function (name, value) {
      var m = new RegExp('>\\s*' + name + '\\s*</h3>[\\s\\S]{0,900}?<p\\b[^>]*>\\s*' + value + '\\s*</p>', 'i').exec(html);
      return m ? unescapeXml(m[1]) : null;
    };
    var name = /\/package\/((?:@[^\/]+\/)?[^\/?#]+)/.exec(String(url || ''));
    var weekly = label('Weekly Downloads', '([0-9][0-9,]*)');
    var published = /Last publish\s*<\/h3>[\s\S]{0,400}?<time\b[^>]*\bdatetime="([^"]+)"/i.exec(html);
    var tab = function (word) { var m = new RegExp('>\\s*([0-9][0-9,]*)\\s*' + word + '\\s*<').exec(html); return m ? num(m[1]) : null; };
    var out = {
      name: name ? decodeURIComponent(name[1]) : '',
      weeklyDownloads: weekly == null ? null : num(weekly),
      version: (label('Version', '([^<]{1,40}?)') || '').trim(),
      license: (label('License', '([^<]{1,40}?)') || '').trim(),
      unpackedSize: (label('Unpacked Size', '([^<]{1,20}?)') || '').trim(),
      files: num(label('Total Files', '([0-9][0-9,]*)') || ''),
      lastPublish: published ? isoOf(published[1]) : '',
      dependencies: tab('Dependenc(?:y|ies)'),
      dependents: tab('Dependents'),
      versions: tab('Versions')
    };
    if (!out.name) return { ok: false, code: 'not_this_page', error: 'this is not an npm package page' };
    if (out.weeklyDownloads == null && !out.version) return { ok: false, code: 'drift', reader: 'npm.package', seen: 1, error: 'npm package ' + out.name + ': neither the weekly downloads nor the version read. The site changed this page, so ZERACK reports nothing from it instead of a wrong number.' };
    return { ok: true, pkg: out };
  }

  function pypiFromHtml(html, url) {
    html = String(html || '');
    var h1 = /<h1\b[^>]*class="[^"]*package-header__name[^"]*"[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    var head = h1 ? squash(plain(h1[1])) : '';
    var name = /\/project\/([^\/?#]+)/.exec(String(url || ''));
    var released = /package-header__date[\s\S]{0,300}?datetime="([^"]+)"/i.exec(html);
    var summary = /<p\b[^>]*class="[^"]*package-description__summary[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    var cards = [];
    var cre = /<a\b[^>]*class="[^"]*release__card[^"]*"[^>]*>([\s\S]*?)<\/a>/g, cm;
    while ((cm = cre.exec(html)) && cards.length < 400) {
      var v = /release__version"?[^>]*>([\s\S]*?)<\/p>/.exec(cm[1]);
      var d = /datetime="([^"]+)"/i.exec(cm[1]);
      var pre = /pre-release|yanked/i.test(cm[1]);
      if (v) cards.push({ version: squash(plain(v[1])).split(' ')[0], at: d ? isoOf(d[1]) : '', pre: pre });
    }
    var out = {
      name: name ? decodeURIComponent(name[1]) : head.split(' ')[0],
      version: head.split(' ').slice(1).join(' '),
      summary: summary ? squash(plain(summary[1])).slice(0, 300) : '',
      released: released ? isoOf(released[1]) : '',
      releases: cards.length,
      history: cards.slice(0, 60)
    };
    if (!head && !cards.length) return { ok: false, code: /\/project\//.test(String(url || '')) ? 'drift' : 'not_this_page', reader: 'pypi.package', seen: 1, error: /\/project\//.test(String(url || '')) ? 'PyPI project: neither its name nor its release history read. The site changed this page, so ZERACK reports nothing from it instead of a wrong number.' : 'this is not a PyPI project page' };
    return { ok: true, pkg: out };
  }

  function pageHtml() {
    var el = doc().documentElement;
    return el && typeof el.outerHTML === 'string' ? el.outerHTML : '';
  }

  function sameOrigin(path) {
    var fetcher = root.fetch;
    if (typeof fetcher !== 'function') return Promise.resolve({ ok: false, status: 0, text: '' });
    return Promise.resolve(fetcher.call(root, path, { credentials: 'omit', headers: { Accept: 'application/atom+xml, application/xml;q=0.9, */*;q=0.1' } })).then(function (res) {
      if (!res || !res.ok) return { ok: false, status: res ? res.status : 0, text: '' };
      return res.text().then(function (t) { return { ok: true, status: res.status, text: String(t || '') }; });
    }, function () { return { ok: false, status: 0, text: '' }; });
  }

  function feedOf(where, kind) {
    var branch = kind === 'commits' && where.rest[0] === 'commits' && where.rest[1] ? '/' + where.rest.slice(1).join('/') : '';
    var path = where.base + (kind === 'commits' ? '/commits' + branch + '.atom' : '/' + kind + '.atom');
    return sameOrigin(path).then(function (r) {
      if (!r.ok) return { ok: false, status: r.status, rows: [] };
      if (!/<feed\b/.test(r.text)) return { ok: false, status: r.status, rows: [], drift: true };
      return { ok: true, rows: atom(r.text) };
    });
  }

  function readGithubRepo(opts) {
    var url = here().href;
    var got = githubRepoFromHtml(pageHtml(), url);
    if (!got.ok) return Promise.resolve(got.code === 'drift' ? got : notHere('github.repo', got.error));
    var where = repoPath(url);
    return Promise.all([feedOf(where, 'commits'), feedOf(where, 'releases')]).then(function (feeds) {
      var commits = feeds[0].ok ? commitRows(feeds[0].rows).slice(0, limitOf(opts)) : [];
      var releases = feeds[1].ok ? releaseRows(feeds[1].rows) : [];
      var extra = { repo: got.repo, releaseList: releases.slice(0, 10), feeds: { commits: feeds[0].ok ? 'read' : 'not public (HTTP ' + feeds[0].status + ')', releases: feeds[1].ok ? 'read' : 'not public (HTTP ' + feeds[1].status + ')' } };
      if (feeds[0].drift) extra.feeds.commits = 'changed shape';
      return done('github.repo', 'GitHub repository', commits, extra);
    });
  }

  function readGithubFeed(kind) {
    return function (opts) {
      var where = repoPath(here().href);
      var reader = 'github.' + kind;
      if (!where) return notHere(reader, 'this is not a GitHub repository page');
      return feedOf(where, kind).then(function (f) {
        if (f.drift) return drift(reader, 'GitHub ' + kind, 1, 'the ' + kind + ' feed answered with something that is not a feed.');
        if (!f.ok) return { ok: false, code: 'not_exposed', reader: reader, status: f.status, error: 'the ' + kind + ' feed of ' + where.owner + '/' + where.repo + ' is not public (HTTP ' + f.status + '). That means hidden, not empty.' };
        var rows = kind === 'commits' ? commitRows(f.rows) : releaseRows(f.rows);
        if (kind === 'releases' && !rows.length) {
          return feedOf(where, 'tags').then(function (t) {
            var tags = t.ok ? releaseRows(t.rows).map(function (r) { r.name = r.name || r.tag; r.tagOnly = true; return r; }) : [];
            return done(reader, 'GitHub releases', tags, { repo: { owner: where.owner, repo: where.repo, url: where.base }, releases: 0, note: tags.length ? 'no releases are published; these are the tags' : 'no releases and no tags are published yet' });
          });
        }
        return done(reader, kind === 'commits' ? 'GitHub commits' : 'GitHub releases', rows.slice(0, limitOf(opts)), { repo: { owner: where.owner, repo: where.repo, url: where.base } });
      });
    };
  }

  function pairs(labels, box) {
    var out = {};
    leaves(box || doc().body || doc()).forEach(function (l) {
      var t = l.text.toLowerCase();
      Object.keys(labels).forEach(function (k) {
        if (out[k] != null) return;
        if (labels[k].indexOf(t) < 0) return;
        var n = l.el.parentNode, hops = 0;
        while (n && hops < 3 && out[k] == null) {
          var vals = leaves(n).filter(function (x) { return x.el !== l.el && /^[0-9][0-9,.]*\s*[kKmM]?$/.test(x.text); });
          if (vals.length) out[k] = num(vals[0].text);
          n = n.parentNode;
          hops++;
        }
      });
    });
    return out;
  }

  function readGithubTraffic(opts) {
    var label = 'GitHub traffic';
    var where = repoPath(here().href);
    if (!where || where.rest.join('/') !== 'graphs/traffic') return notHere('github.traffic', 'this is not the traffic page of a repository');
    var totals = pairs({ clones: ['clones'], cloners: ['unique cloners'], views: ['views'], visitors: ['unique visitors'] });
    var refs = readTable({ columns: { site: ['site', 'referring site'], views: ['views'], unique: ['unique visitors'] }, need: ['site', 'views'], types: { views: 'int', unique: 'int' } }, 'github.traffic', label);
    var content = null;
    var tables = outermost(all('table'));
    if (tables.length > 1) {
      content = tables.slice(1).map(function (t) {
        var parts = gridParts(t);
        var m = mapHeads(parts.heads, { content: ['content', 'path'], views: ['views'], unique: ['unique visitors'] }, '');
        if (!owns.call(m.map, 'content') || !owns.call(m.map, 'views')) return null;
        return parts.rows.map(function (cells) {
          var a = one(cells[m.map.content], 'a[href]');
          return { content: txt(cells[m.map.content]), url: a ? absUrl(attr(a, 'href')) : '', views: num(txt(cells[m.map.views])), unique: owns.call(m.map, 'unique') ? num(txt(cells[m.map.unique])) : null };
        });
      }).filter(Boolean)[0] || null;
    }
    var read = Object.keys(totals).length;
    if (!read && !(refs && refs.ok)) return drift('github.traffic', label, 1, 'this is the traffic page and neither its totals nor its referring sites read.');
    return done('github.traffic', label, refs && refs.ok ? refs.rows : [], { totals: totals, popular: (content || []).slice(0, 10), repo: { owner: where.owner, repo: where.repo, url: where.base }, note: 'GitHub keeps 14 days of traffic, in UTC' });
  }

  function hnAge(el) {
    var age = el ? one(el, 'span.age[title]') : null;
    var t = age ? attr(age, 'title').split(' ')[0] : '';
    return t ? isoOf(/Z|[+-][0-9]{2}:?[0-9]{2}$/.test(t) ? t : t + 'Z') : '';
  }

  function hnSub(row) {
    var sub = row && row.nextElementSibling ? one(row.nextElementSibling, '.subtext') : null;
    var score = sub ? one(sub, 'span.score') : null;
    var user = sub ? one(sub, 'a.hnuser') : null;
    var cm = sub ? all('a', sub).map(txt).filter(function (t) { return /^([0-9]+)\s*comments?$|^discuss$/.test(t.replace(/\u00a0/g, ' ')); })[0] : '';
    var cnum = cm && /^([0-9]+)/.exec(cm.replace(/\u00a0/g, ' '));
    return { points: score ? num(txt(score)) : null, by: user ? txt(user) : '', at: hnAge(sub), comments: cm ? (cnum ? Number(cnum[1]) : 0) : null };
  }

  function hnStory(row) {
    var a = one(row, '.titleline > a') || one(row, 'a.titlelink') || one(row, '.title a');
    var site = one(row, '.sitestr');
    var s = hnSub(row);
    var rank = one(row, 'span.rank');
    return { id: attr(row, 'id'), rank: rank ? num(txt(rank)) : null, title: a ? txt(a) : '', url: a ? absUrl(attr(a, 'href'), true) : '', site: site ? txt(site) : '', points: s.points, by: s.by, at: s.at, comments: s.comments, item: absUrl('item?id=' + attr(row, 'id'), true) };
  }

  function readHnList(opts) {
    var label = 'Hacker News list';
    var rows = all('tr.athing').filter(function (tr) { return !tr.classList.contains('comtr'); });
    var probe = all('a[href*="item?id="]').length;
    var out = rows.slice(0, limitOf(opts)).map(hnStory).filter(function (r) { return r.title && r.id; });
    if (!out.length) {
      if (probe >= MIN_PROBE) return drift('hn.list', label, probe, 'the page links to ' + probe + ' items and none of them reads as a story row.');
      return notHere('hn.list', 'no Hacker News story list on this page');
    }
    out.forEach(function (r) { r.metric = r.points; });
    return done('hn.list', label, out, { blanks: blanks(out, ['points', 'comments']) });
  }

  function readHnItem(opts) {
    var label = 'Hacker News thread';
    var top = one(doc(), 'table.fatitem');
    var head = top ? one(top, 'tr.athing') : null;
    var comments = all('tr.athing.comtr');
    if (!head) {
      if (comments.length) return drift('hn.item', label, comments.length, 'the thread has comments and its story row did not read.');
      return notHere('hn.item', 'this is not a Hacker News thread');
    }
    var story = hnStory(head);
    var toptext = one(top, '.toptext');
    story.text = toptext ? txt(toptext) : '';
    var rows = comments.slice(0, limitOf(opts)).map(function (tr) {
      var ind = one(tr, 'td.ind');
      var depth = ind && attr(ind, 'indent') !== '' ? Number(attr(ind, 'indent')) : (ind && one(ind, 'img') ? Math.round(Number(attr(one(ind, 'img'), 'width')) / 40) : 0);
      var user = one(tr, 'a.hnuser');
      var body = one(tr, '.commtext');
      return { id: attr(tr, 'id'), by: user ? txt(user) : '', at: hnAge(tr), depth: isFinite(depth) ? depth : 0, text: body ? txt(body).slice(0, 1200) : '', url: absUrl('item?id=' + attr(tr, 'id'), true) };
    }).filter(function (r) { return r.id && r.text; });
    if (comments.length && !rows.length) return drift('hn.item', label, comments.length, 'the thread shows ' + comments.length + ' comments and none of them reads.');
    story.text = story.text.slice(0, 1500);
    return done('hn.item', label, rows, { story: story, showHn: /^show hn\b/i.test(story.title), askHn: /^ask hn\b/i.test(story.title), onPage: comments.length });
  }

  function redditTime(el) {
    var t = el ? one(el, 'faceplate-timeago[ts], time[datetime]') : null;
    return t ? isoOf(attr(t, 'ts') || attr(t, 'datetime')) : '';
  }

  function readReddit(opts) {
    var label = 'Reddit thread';
    var post = one(doc(), 'shreddit-post');
    var story = null, rows = [], seen = 0;
    if (post) {
      story = {
        title: attr(post, 'post-title'),
        by: attr(post, 'author'),
        points: num(attr(post, 'score')),
        comments: num(attr(post, 'comment-count')),
        at: isoOf(attr(post, 'created-timestamp')),
        community: attr(post, 'subreddit-prefixed-name'),
        url: absUrl(attr(post, 'permalink')),
        text: txt(one(post, '[slot="text-body"]')).slice(0, 1500)
      };
      var list = all('shreddit-comment');
      seen = list.length;
      rows = list.slice(0, limitOf(opts)).map(function (c) {
        var body = all('[slot="comment"]', c).filter(function (s) { return s.closest && s.closest('shreddit-comment') === c; })[0];
        return { id: attr(c, 'thingid'), by: attr(c, 'author'), depth: num(attr(c, 'depth')) || 0, points: num(attr(c, 'score')), at: redditTime(c), text: body ? txt(body).slice(0, 1200) : '', url: absUrl(attr(c, 'permalink')) };
      });
    } else {
      var link = one(doc(), '#siteTable .thing.link') || one(doc(), '.thing.link');
      if (link) {
        story = {
          title: txt(one(link, 'a.title')),
          by: attr(link, 'data-author'),
          points: num(attr(link, 'data-score')),
          comments: num(attr(link, 'data-comments-count')),
          at: attr(link, 'data-timestamp') ? new Date(Number(attr(link, 'data-timestamp'))).toISOString() : '',
          community: attr(link, 'data-subreddit-prefixed'),
          url: absUrl(attr(link, 'data-permalink')),
          text: txt(one(link, '.usertext-body .md')).slice(0, 1500)
        };
        var old = all('.thing.comment');
        seen = old.length;
        rows = old.slice(0, limitOf(opts)).map(function (c) {
          var body = all('.usertext-body .md', c).filter(function (s) { return s.closest && s.closest('.thing.comment') === c; })[0];
          var sc = one(c, '.tagline .score.unvoted');
          var depth = 0, p = c.parentNode;
          while (p) { if (p.classList && p.classList.contains('comment')) depth++; p = p.parentNode; }
          return { id: attr(c, 'data-fullname'), by: attr(c, 'data-author'), depth: depth, points: sc ? num(attr(sc, 'title') || txt(sc)) : null, at: redditTime(c), text: body ? txt(body).slice(0, 1200) : '', url: absUrl(attr(c, 'data-permalink')) };
        });
      }
    }
    if (!story) return /\/comments\//.test(here().pathname) ? drift('reddit.thread', label, 1, 'this is a thread and its post did not read.') : notHere('reddit.thread', 'this is not a Reddit thread');
    rows = rows.filter(function (r) { return r.text; });
    if (seen && !rows.length) return drift('reddit.thread', label, seen, 'the thread shows ' + seen + ' comments and none of them reads.');
    return done('reddit.thread', label, rows, { story: story, onPage: seen, note: seen < (story.comments || 0) ? 'only the comments loaded on screen were read (' + seen + ' of ' + story.comments + ')' : '' });
  }

  function ldProductAny() {
    var found = null;
    all('script[type="application/ld+json"]').some(function (s) {
      var data;
      try { data = JSON.parse(s.textContent || 'null'); } catch (e) { return false; }
      return [].concat(data && data['@graph'] ? data['@graph'] : data).some(function (d) {
        var t = d && d['@type'];
        if ((t === 'Product' || (Array.isArray(t) && t.indexOf('Product') >= 0)) && d.name) { found = d; return true; }
        return false;
      });
    });
    return found;
  }

  function readProductHunt(opts) {
    var label = 'Product Hunt page';
    var ld = ldProductAny();
    var h1 = one(doc(), 'h1');
    var body = doc().body || doc();
    var vote = one(doc(), '[data-test="vote-button"]');
    var voteText = vote ? txt(vote) : '';
    var pts = /([0-9][0-9,.]*[kK]?)\s*points?/.exec(voteText) || /([0-9][0-9,.]*[kK]?)\s*$/.exec(voteText);
    var rankBox = all('div').filter(function (el) { return /^#\s*[0-9]+\s*Day Rank$/i.test(txt(el)); }).pop();
    var rank = rankBox ? Number(/^#\s*([0-9]+)/.exec(txt(rankBox))[1]) : null;
    var reviewsLeaf = leafText(body, /^([0-9][0-9,.]*[kKmM]?)\s+reviews?$/i);
    var followersLeaf = leafText(body, /^([0-9][0-9,.]*[kKmM]?)\s+followers?$/i);
    var tagline = '';
    if (h1) {
      var sib = h1.nextElementSibling || (h1.parentNode && h1.parentNode.nextElementSibling);
      var t = sib ? txt(sib) : '';
      if (t && t.length <= 80) tagline = t;
    }
    var name = ld && ld.name ? squash(ld.name) : (h1 ? txt(h1) : '');
    var comments = all('[data-test^="comment-"]').filter(function (c) { return /^comment-[0-9]+$/.test(attr(c, 'data-test')); });
    var rows = comments.slice(0, limitOf(opts)).map(function (c) {
      var who = one(c, 'a[href*="/@"]:not([data-test])') || one(c, 'a[href*="/@"]');
      var prose = one(c, '.prose') || one(c, '[class*="richText"]');
      var up = one(c, '[data-test="action-bar-vote-button"]');
      var t = one(c, 'time[datetime]');
      var um = up ? /\(([0-9][0-9,]*)\)/.exec(txt(up)) : null;
      return { id: attr(c, 'data-test').replace('comment-', ''), by: who ? txt(who) : '', text: prose ? txt(prose).slice(0, 1200) : '', points: um ? num(um[1]) : null, at: t ? isoOf(attr(t, 'datetime')) : '', url: absUrl(here().pathname + '#' + attr(c, 'data-test'), true) };
    }).filter(function (r) { return r.text; });
    var ar = ld && ld.aggregateRating ? ld.aggregateRating : null;
    var product = {
      name: name,
      tagline: tagline,
      description: ld && ld.description ? squash(ld.description).slice(0, 600) : '',
      upvotes: pts ? num(pts[1]) : null,
      dayRank: rank,
      reviews: ar && ar.ratingCount != null ? num(String(ar.ratingCount)) : (reviewsLeaf ? num(reviewsLeaf[1]) : null),
      rating: ar && ar.ratingValue != null ? num(String(ar.ratingValue)) : null,
      followers: followersLeaf ? num(followersLeaf[1]) : null,
      followersApprox: followersLeaf ? approx(followersLeaf[1]) : false,
      launched: ld && ld.datePublished ? isoOf(ld.datePublished) : ''
    };
    if (!name) return /^\/(products|posts)\//.test(here().pathname) ? drift('ph.product', label, 1, 'this is a product page and its name did not read.') : notHere('ph.product', 'this is not a Product Hunt product page');
    if (product.upvotes == null && product.reviews == null && product.followers == null && !comments.length) return drift('ph.product', label, 1, 'the product name read, and none of its upvotes, reviews, followers or comments did.');
    if (comments.length && !rows.length) return drift('ph.product', label, comments.length, 'the page shows ' + comments.length + ' comments and none of them reads.');
    return done('ph.product', label, rows, { product: product, onPage: comments.length });
  }

  function readNpm() {
    var got = npmFromHtml(pageHtml(), here().href);
    if (!got.ok) return got.code === 'drift' ? got : notHere('npm.package', got.error);
    return done('npm.package', 'npm package', [], { pkg: got.pkg });
  }

  function readPypi() {
    var got = pypiFromHtml(pageHtml(), here().href);
    if (!got.ok) return got.code === 'drift' ? got : notHere('pypi.package', got.error);
    return done('pypi.package', 'PyPI project', got.pkg.history.slice(0, 40), { pkg: { name: got.pkg.name, version: got.pkg.version, summary: got.pkg.summary, released: got.pkg.released, releases: got.pkg.releases } });
  }

  function duration(s) {
    var t = squash(s).toLowerCase();
    var m = /^(?:([0-9]+)\s*h)?\s*(?:([0-9]+)\s*m(?:in)?)?\s*(?:([0-9]+)\s*s(?:ec)?)?$/.exec(t);
    if (!m || !(m[1] || m[2] || m[3])) return null;
    return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  }

  function tileValue(text, type) {
    if (type === 'duration') return duration(text);
    if (type === 'pct') return /%/.test(text) ? pct(text) : null;
    if (type === 'money') return /[0-9]/.test(text) && /[$\u20ac\u00a3\u00a5]|\b[A-Z]{3}\b/.test(text) ? money(text) : null;
    return /^[-+]?[0-9][0-9,.]*\s*[kKmMbB]?$/.test(text) ? num(text.replace(/^[+]/, '')) : null;
  }

  function readTiles(opts, reader, label) {
    opts = opts || {};
    reader = reader || 'tiles';
    label = label || 'Dashboard tiles';
    var spec = opts.tiles && typeof opts.tiles === 'object' ? opts.tiles : null;
    if (!spec) return notHere(reader, 'no tile names were given');
    var types = opts.types || {};
    var syn = {};
    Object.keys(spec).forEach(function (k) { syn[k] = [].concat(spec[k]).map(norm); });
    var isLabel = function (t) { var n = norm(t); return Object.keys(syn).some(function (k) { return syn[k].indexOf(n) >= 0; }); };
    var body = doc().body || doc();
    var all0 = leaves(body);
    var out = {}, approxOf = {}, found = 0;
    Object.keys(syn).forEach(function (k) {
      var hit = null;
      all0.some(function (l) {
        if (syn[k].indexOf(norm(l.text)) < 0) return false;
        found++;
        var n = l.el.parentNode, hops = 0;
        while (n && hops < 4) {
          var inside = leaves(n);
          var others = inside.filter(function (x) { return x.el !== l.el && isLabel(x.text); });
          if (others.length) break;
          var at = inside.map(function (x) { return x.el; }).indexOf(l.el);
          var after = inside.slice(at + 1).concat(inside.slice(0, at));
          for (var i = 0; i < after.length; i++) {
            var v = tileValue(after[i].text, types[k]);
            if (v != null) { hit = { v: v, raw: after[i].text }; break; }
          }
          if (hit) return true;
          n = n.parentNode;
          hops++;
        }
        return false;
      });
      if (hit) { out[k] = hit.v; approxOf[k] = approx(hit.raw); }
    });
    var read = Object.keys(out);
    var need = Array.isArray(opts.need) && opts.need.length ? opts.need : [];
    if (!read.length) return found ? drift(reader, label, found, 'the tile names are on the page and none of their numbers reads.') : notHere(reader, 'none of the tiles ' + Object.keys(spec).slice(0, 6).join(', ') + ' is on this page');
    var missing = need.filter(function (k) { return !owns.call(out, k); });
    if (missing.length) return drift(reader, label, found, 'the tiles ' + missing.join(', ') + ' did not read.', { missing: missing, tiles: out });
    var range = leafText(body, /^(Last|Past) [0-9]+ (days|hours|weeks|months)$/i) || leafText(body, /^(Today|Yesterday|This (week|month))$/i);
    return done(reader, label, [], { tiles: out, approx: approxOf, notShown: Object.keys(spec).filter(function (k) { return !owns.call(out, k); }), range: range ? range[0] : '' });
  }

  function dayIso(s) {
    var t = Date.parse(String(s || ''));
    if (!isFinite(t)) return '';
    var d = new Date(t);
    return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
  }

  function numK(s) {
    var t = squash(s).replace(/[$\u20ac\u00a3,+\s]/g, '');
    var m = /^([0-9]+(?:\.[0-9]+)?)([kKmMbB])?/.exec(t);
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    var k = (m[2] || '').toLowerCase();
    if (k === 'k') n *= 1e3;
    else if (k === 'm') n *= 1e6;
    else if (k === 'b') n *= 1e9;
    return Math.round(n * 100) / 100;
  }

  function minutesAgo(s) {
    var t = squash(s).toLowerCase();
    if (/\b(just now|moments? ago|hace un momento)\b/.test(t)) return 0;
    if (/\byesterday\b/.test(t)) return 1440;
    var m = /\b([0-9]+|an?|one)\s+(second|minute|hour|day|week|month|year)s?\s+ago\b/.exec(t);
    if (!m) return null;
    var n = /^[0-9]+$/.test(m[1]) ? Number(m[1]) : 1;
    var per = { second: 1 / 60, minute: 1, hour: 60, day: 1440, week: 10080, month: 43200, year: 525600 };
    return Math.round(n * per[m[2]]);
  }

  function innermost(list) {
    return list.filter(function (el) {
      return !list.some(function (other) { return other !== el && inside(other, el); });
    });
  }

  function rehydrate() {
    var s = one(doc(), 'script#__UNIVERSAL_DATA_FOR_REHYDRATION__');
    if (!s) return null;
    try {
      var d = JSON.parse(s.textContent || 'null');
      return d && d.__DEFAULT_SCOPE__ && typeof d.__DEFAULT_SCOPE__ === 'object' ? d.__DEFAULT_SCOPE__ : null;
    } catch (e) { return null; }
  }

  function handleOf(path) {
    var m = /^\/@([^\/?#]+)/.exec(String(path || ''));
    if (!m) return '';
    try { return decodeURIComponent(m[1]).toLowerCase(); } catch (e) { return m[1].toLowerCase(); }
  }

  function statNum(v) {
    return v == null || v === '' ? null : num(String(v));
  }

  function tiktokHeader(handle) {
    var scope = rehydrate();
    var ui = scope && scope['webapp.user-detail'] && scope['webapp.user-detail'].userInfo;
    var u = ui && ui.user;
    var st = ui && (ui.stats || ui.statsV2);
    if (u && st && String(u.uniqueId || '').toLowerCase() === handle) {
      return { via: 'page data', handle: String(u.uniqueId), name: squash(u.nickname).slice(0, 80), verified: u.verified === true, followers: statNum(st.followerCount), following: statNum(st.followingCount), likes: statNum(st.heartCount != null ? st.heartCount : st.heart), videos: statNum(st.videoCount), approx: false };
    }
    var f = one(doc(), '[data-e2e="followers-count"]'), g = one(doc(), '[data-e2e="following-count"]'), l = one(doc(), '[data-e2e="likes-count"]');
    if (!f && !l) return null;
    var title = one(doc(), '[data-e2e="user-title"]');
    var shown = title ? txt(title).replace(/^@/, '').toLowerCase() : '';
    if (shown && shown !== handle) return null;
    return { via: 'screen', handle: handle, name: txt(one(doc(), '[data-e2e="user-subtitle"]')).slice(0, 80), verified: null, followers: f ? num(txt(f)) : null, following: g ? num(txt(g)) : null, likes: l ? num(txt(l)) : null, videos: null, approx: approx(txt(f) + ' ' + txt(l)) };
  }

  function readTiktokProfile(opts) {
    var label = 'TikTok profile';
    var handle = handleOf(here().pathname);
    if (!handle) return notHere('tiktok.profile', 'this is not a TikTok profile');
    var header = tiktokHeader(handle);
    var items = all('[data-e2e="user-post-item"]');
    var rows = items.slice(0, limitOf(opts)).map(function (it) {
      var a = one(it, 'a[href*="/video/"]') || one(it, 'a[href*="/photo/"]');
      var href = attr(a, 'href');
      var id = (/\/(?:video|photo)\/([0-9]+)/.exec(href) || [])[1] || '';
      var v = one(it, '[data-e2e="video-views"]');
      var vt = v ? txt(v) : '';
      var badge = one(it, '[data-e2e="video-card-badge"]');
      var img = one(it, 'img[alt]');
      var views = vt ? num(vt) : null;
      return { id: id, url: absUrl(href), views: views, viewsApprox: approx(vt), pinned: /\b(pinned|fijado)\b/i.test(txt(badge)), title: img ? squash(attr(img, 'alt')).slice(0, 200) : '', metric: views };
    }).filter(function (r) { return r.id; });
    if (!header && !rows.length) return drift('tiktok.profile', label, items.length || 1, 'this is a profile page and neither its numbers nor its videos read.');
    if (items.length >= MIN_PROBE && !rows.some(function (r) { return r.views != null; })) return drift('tiktok.profile', label, items.length, items.length + ' videos are on screen and none of their view counts reads.', { profile: header });
    return done('tiktok.profile', label, rows, { profile: header, onPage: items.length, blanks: blanks(rows, ['views']) });
  }

  function readTiktokVideo() {
    var label = 'TikTok video';
    var m = /^\/@([^\/]+)\/(?:video|photo)\/([0-9]+)/.exec(here().pathname);
    if (!m) return notHere('tiktok.video', 'this is not a TikTok video page');
    var scope = rehydrate();
    var d = scope && scope['webapp.video-detail'] && scope['webapp.video-detail'].itemInfo && scope['webapp.video-detail'].itemInfo.itemStruct;
    var video = null;
    if (d && String(d.id) === m[2]) {
      var st = d.stats || d.statsV2 || {};
      var tags = [];
      (d.textExtra || []).forEach(function (t) { if (t && t.hashtagName && tags.indexOf(t.hashtagName) < 0) tags.push(String(t.hashtagName)); });
      (d.challenges || []).forEach(function (c) { if (c && c.title && tags.indexOf(c.title) < 0) tags.push(String(c.title)); });
      video = {
        via: 'page data', id: m[2], author: d.author && d.author.uniqueId ? String(d.author.uniqueId) : m[1], text: squash(d.desc).slice(0, 600),
        at: d.createTime ? new Date(Number(d.createTime) * 1000).toISOString() : '', seconds: d.video && Number(d.video.duration) > 0 ? Number(d.video.duration) : null,
        views: statNum(st.playCount), likes: statNum(st.diggCount), comments: statNum(st.commentCount), shares: statNum(st.shareCount), saves: statNum(st.collectCount),
        sound: d.music ? { title: squash(d.music.title).slice(0, 120), author: squash(d.music.authorName).slice(0, 80), original: d.music.original === true } : null,
        hashtags: tags.slice(0, 30), approx: false
      };
    } else {
      var pick = function (sel) { var el = one(doc(), sel); return el ? txt(el) : ''; };
      var likes = pick('[data-e2e="like-count"]'), comments = pick('[data-e2e="comment-count"]'), shares = pick('[data-e2e="share-count"]'), saves = pick('[data-e2e="undefined-count"]');
      if (!likes && !comments && !shares) return drift('tiktok.video', label, 1, 'this is a video page and none of its counts reads.');
      var desc = one(doc(), '[data-e2e="browse-video-desc"]') || one(doc(), '[data-e2e="video-desc"]');
      var music = one(doc(), '[data-e2e="browse-music"]') || one(doc(), '[data-e2e="video-music"]');
      video = {
        via: 'screen', id: m[2], author: m[1], text: desc ? txt(desc).slice(0, 600) : '', at: '', seconds: null,
        views: null, likes: likes ? num(likes) : null, comments: comments ? num(comments) : null, shares: shares ? num(shares) : null, saves: saves ? num(saves) : null,
        sound: music ? { title: txt(music).slice(0, 120), author: '', original: /original sound|sonido original/i.test(txt(music)) } : null,
        hashtags: all('a[href*="/tag/"]', desc || doc()).map(function (a) { return txt(a).replace(/^#/, ''); }).filter(Boolean).slice(0, 30),
        approx: approx([likes, comments, shares, saves].join(' '))
      };
    }
    return done('tiktok.video', label, [], { video: video });
  }

  function readInstagramProfile(opts) {
    var label = 'Instagram profile';
    var seg = (/^\/([A-Za-z0-9._]+)\/(reels\/)?$/.exec(here().pathname) || []);
    if (!seg[1] || /^(explore|reels|direct|accounts|p|reel|stories)$/.test(seg[1])) return notHere('instagram.profile', 'this is not an Instagram profile');
    var handle = seg[1].toLowerCase();
    var meta = attr(one(doc(), 'meta[property="og:description"]'), 'content') || attr(one(doc(), 'meta[name="description"]'), 'content');
    var mm = /([0-9][0-9.,]*[KMB]?)\s+Followers?,\s*([0-9][0-9.,]*[KMB]?)\s+Following,\s*([0-9][0-9.,]*[KMB]?)\s+Posts?/i.exec(meta);
    var who = /\(@([A-Za-z0-9._]+)\)/.exec(meta);
    var header = null;
    if (mm && (!who || who[1].toLowerCase() === handle)) {
      var nm = /from (.+?) \(@/.exec(meta) || /- (.+?) \(@/.exec(meta);
      header = { via: 'page meta', handle: who ? who[1] : handle, name: nm ? squash(nm[1]).slice(0, 80) : '', followers: numK(mm[1]), following: numK(mm[2]), posts: numK(mm[3]), approx: approx(mm[1]) || approx(mm[3]) };
    } else {
      var box = one(doc(), 'header') || doc();
      var stat = function (re) { var h = leafText(box, re); return h ? { n: numK(h[1]), ap: approx(h[1]) } : null; };
      var fo = stat(/^([0-9][0-9.,]*[KMB]?)\s+followers?$/i), fw = stat(/^([0-9][0-9.,]*[KMB]?)\s+following$/i), po = stat(/^([0-9][0-9.,]*[KMB]?)\s+posts?$/i);
      if (fo || po) header = { via: 'screen', handle: handle, name: '', followers: fo ? fo.n : null, following: fw ? fw.n : null, posts: po ? po.n : null, approx: !!((fo && fo.ap) || (po && po.ap)) };
    }
    var reelsTab = !!seg[2];
    var pathOf = function (a) { try { var u = new URL(attr(a, 'href'), here().href); return /(^|\.)instagram\.com$/.test(u.hostname) ? u.pathname : ''; } catch (e) { return ''; } };
    var links = outermost(all('a[href*="/reel/"], a[href*="/p/"]').filter(function (a) { return /^\/(?:[^\/]+\/)?(reel|p)\/[A-Za-z0-9_-]+\/?$/.test(pathOf(a)); }));
    var rows = links.slice(0, limitOf(opts)).map(function (a) {
      var href = pathOf(a);
      var k = /\/(reel|p)\/([A-Za-z0-9_-]+)/.exec(href);
      var count = null, raw = '';
      leaves(a).some(function (l) { if (/^[0-9][0-9.,]*\s*[KMB]?$/i.test(l.text)) { raw = l.text; count = numK(l.text); return true; } return false; });
      var img = one(a, 'img[alt]');
      return { id: k ? k[2] : '', url: absUrl(href), kind: k && k[1] === 'reel' ? 'reel' : 'post', views: count, viewsApprox: approx(raw), title: img ? squash(attr(img, 'alt')).slice(0, 200) : '', metric: count };
    }).filter(function (r) { return r.id; });
    if (!header && !rows.length) return drift('instagram.profile', label, 1, 'this is a profile page and neither its numbers nor its posts read.');
    if (reelsTab && rows.length >= MIN_PROBE && !rows.some(function (r) { return r.views != null; })) return drift('instagram.profile', label, rows.length, rows.length + ' reels are on screen and none of their play counts reads.', { profile: header });
    return done('instagram.profile', label, rows, { profile: header, reelsTab: reelsTab, onPage: links.length, blanks: blanks(rows, ['views']) });
  }

  var PROPOSAL_TIERS = { 'less than 5': [0, 4], '5 to 10': [5, 10], '10 to 15': [10, 15], '15 to 20': [15, 20], '20 to 50': [20, 50], '50+': [50, null] };

  function upworkFacts(text) {
    var t = squash(text);
    var out = {};
    var hr = /Hourly(?:\s*:\s*|\s+)\$([0-9][0-9.,]*)(?:\s*-\s*\$([0-9][0-9.,]*))?/i.exec(t);
    if (hr) { out.type = 'hourly'; out.rateMin = numK(hr[1]); out.rateMax = hr[2] ? numK(hr[2]) : out.rateMin; }
    else if (/\bHourly\b/i.test(t)) out.type = 'hourly';
    if (/\bFixed[- ]price\b/i.test(t)) out.type = out.type || 'fixed';
    var bud = /(?:Est\.?\s*budget|Budget)\s*:?\s*\$([0-9][0-9.,]*[kK]?)/i.exec(t);
    if (bud) { out.budget = numK(bud[1]); if (!out.type) out.type = 'fixed'; }
    var lvl = /\b(Entry level|Intermediate|Expert)\b/i.exec(t);
    if (lvl) out.level = lvl[1];
    var pr = /Proposals\s*:?\s*(Less than 5|5 to 10|10 to 15|15 to 20|20 to 50|50\+)/i.exec(t);
    if (pr) { var tier = PROPOSAL_TIERS[pr[1].toLowerCase()]; out.proposals = { text: pr[1], min: tier[0], max: tier[1] }; }
    if (/Payment (method )?verified/i.test(t) && !/Payment (method )?(un|not )verified/i.test(t)) out.verified = true;
    else if (/Payment (method )?(un|not )verified/i.test(t)) out.verified = false;
    var sp = /\$([0-9][0-9.,]*[kKmM]?)\+?\s*(?:total\s+)?spent/i.exec(t);
    if (sp) out.spent = numK(sp[1]);
    else if (/\$0\s+spent|no spend/i.test(t)) out.spent = 0;
    var po = /Posted\s+((?:[0-9]+|an?|one)\s+(?:second|minute|hour|day|week|month)s?\s+ago|yesterday|just now)/i.exec(t);
    if (po) out.postedMin = minutesAgo(po[1]);
    var cn = /(?:Send a proposal for|Required Connects to submit a proposal|This proposal requires|Connects to submit|requires)\s*:?\s*([0-9]+)\s*Connects?/i.exec(t) || /([0-9]+)\s+Connects\s+(?:required|to apply|needed)/i.exec(t);
    if (cn) out.connects = Number(cn[1]);
    var av = /Available Connects\s*:?\s*([0-9]+)/i.exec(t);
    if (av) out.available = Number(av[1]);
    var fee = /([0-9]{1,2}(?:\.[0-9]+)?)\s*%\s*(?:Freelancer\s+)?Service Fee|Service Fee\s*\(?\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*%/i.exec(t);
    if (fee) out.feePct = Number(fee[1] || fee[2]);
    var jp = /([0-9]+)\s+jobs? posted/i.exec(t);
    if (jp) out.jobsPosted = Number(jp[1]);
    var hire = /([0-9]{1,3})%\s+hire rate/i.exec(t);
    if (hire) out.hireRate = Number(hire[1]);
    return out;
  }

  function upworkTiles() {
    var list = outermost(all('[data-test="JobTile"], [data-test="job-tile"], article.job-tile, section.job-tile, [data-ev-label="search_results_impression"]'));
    if (list.length) return { list: list, via: 'primary' };
    var links = all('a[href*="/jobs/"]').filter(function (a) { return /~0[0-9a-z]+/i.test(attr(a, 'href')); });
    var boxes = [];
    links.forEach(function (a) {
      var box = (a.closest && (a.closest('article') || a.closest('section') || a.closest('li'))) || null;
      if (box && boxes.indexOf(box) < 0) boxes.push(box);
    });
    return { list: outermost(boxes), via: boxes.length ? 'fallback' : 'none', probe: links.length };
  }

  function upworkRow(tile) {
    var link = one(tile, 'a[data-test="job-tile-title-link"]') || one(tile, 'h2 a[href*="/jobs/"]') || one(tile, 'h3 a[href*="/jobs/"]') || one(tile, 'h4 a[href*="/jobs/"]') || one(tile, 'a[href*="/jobs/"]');
    var f = upworkFacts(leafJoin(tile));
    var skills = all('[data-test="token"], [data-test="attr-item"], .air3-token', tile).map(txt).filter(function (s) { return s && s.length <= 40; });
    var descEl = one(tile, '[data-test="UpCLineClamp JobDescription"]') || one(tile, '[data-test="job-description-text"]') || one(tile, 'p');
    var loc = one(tile, '[data-test="location"]') || one(tile, '[data-test="client-country"]');
    return {
      title: link ? txt(link) : '',
      url: link ? absUrl(attr(link, 'href')) : '',
      type: f.type || '',
      rateMin: f.rateMin != null ? f.rateMin : null,
      rateMax: f.rateMax != null ? f.rateMax : null,
      budget: f.budget != null ? f.budget : null,
      level: f.level || '',
      proposals: f.proposals || null,
      verified: f.verified != null ? f.verified : null,
      spent: f.spent != null ? f.spent : null,
      postedMin: f.postedMin != null ? f.postedMin : null,
      connects: f.connects != null ? f.connects : null,
      country: loc ? txt(loc).replace(/^Location\s*/i, '').slice(0, 60) : '',
      skills: skills.slice(0, 15),
      text: descEl ? txt(descEl).slice(0, 700) : ''
    };
  }

  function readUpworkJobs(opts) {
    var label = 'Upwork jobs';
    var got = upworkTiles();
    var rows = got.list.slice(0, limitOf(opts)).map(upworkRow).filter(function (r) { return r.title && r.url; });
    if (!rows.length) {
      var probe = got.probe != null ? got.probe : all('a[href*="/jobs/"]').length;
      if (got.list.length || probe >= MIN_PROBE) return drift('upwork.jobs', label, got.list.length || probe, 'the page shows ' + (got.list.length || probe) + ' jobs and none of them reads as a job with a title and a link.', { via: got.via });
      return notHere('upwork.jobs', 'no job list on this page');
    }
    if (!rows.some(function (r) { return r.type || r.proposals || r.verified != null; })) return drift('upwork.jobs', label, rows.length, rows.length + ' job titles read and none of their budgets, proposals or client facts did.', { via: got.via });
    rows.forEach(function (r) { r.metric = r.proposals ? r.proposals.min : null; });
    return done('upwork.jobs', label, rows, { via: got.via, blanks: blanks(rows, ['type', 'proposals', 'verified', 'spent', 'postedMin']) });
  }

  function readUpworkJob() {
    var label = 'Upwork job';
    var body = doc().body || doc();
    var f = upworkFacts(leafJoin(body));
    var h = one(doc(), '[data-test="job-title"]') || one(doc(), 'h1') || one(doc(), 'h4');
    var title = h ? txt(h).slice(0, 200) : '';
    var skills = all('[data-test="Skill"] a, [data-test="token"], .air3-token', body).map(txt).filter(function (s) { return s && s.length <= 40; });
    var letter = all('textarea').filter(function (t) { return /cover letter/i.test(attr(t, 'aria-label') + ' ' + attr(t, 'name') + ' ' + attr(t, 'id') + ' ' + attr(t, 'placeholder')) || (t.id && one(doc(), 'label[for="' + t.id + '"]') && /cover letter/i.test(txt(one(doc(), 'label[for="' + t.id + '"]')))); }).length > 0;
    var descEl = one(doc(), '[data-test="Description"]') || one(doc(), '[data-test="description"]');
    if (!title) return drift('upwork.job', label, 1, 'this is a job page and its title did not read.');
    if (!f.type && f.connects == null && !f.proposals && f.verified == null) return drift('upwork.job', label, 1, 'the job title read, and none of its budget, Connects, proposals or client facts did.');
    var job = { title: title, url: absUrl(here().href), skills: skills.slice(0, 15), text: descEl ? txt(descEl).slice(0, 1200) : '', proposalForm: letter };
    Object.keys(f).forEach(function (k) { job[k] = f[k]; });
    return done('upwork.job', label, [], { job: job });
  }

  var FIVERR_LEVELS = /^(level 1|level 2|level one|level two|top rated|pro|new seller|vetted pro)$/i;

  function readFiverrGigs(opts) {
    var label = 'Fiverr gigs';
    var cards = outermost(all('.gig-card-layout'));
    var via = 'primary';
    if (!cards.length) { cards = outermost(all('[data-gig-id]')); via = cards.length ? 'fallback' : 'none'; }
    var rows = cards.slice(0, limitOf(opts)).map(function (c) {
      var h = one(c, 'h3') || one(c, '.gig-header');
      var titleLink = h && h.closest ? h.closest('a[href]') : null;
      var title = h ? (attr(h, 'title') || txt(h)) : '';
      var sellerA = one(c, 'a[href*="source=gig_cards"]');
      var seller = sellerA ? (attr(one(sellerA, '[title]'), 'title') || txt(sellerA)) : '';
      var level = '';
      leaves(c).some(function (l) { if (FIVERR_LEVELS.test(l.text)) { level = l.text; return true; } return false; });
      var score = one(c, '.rating-score');
      var cnt = one(c, '.rating-count-number') || one(c, '.ratings-count');
      var cntText = cnt ? txt(cnt).replace(/[()]/g, '') : '';
      var priceBox = null;
      all('a, span, div', c).some(function (el) { var t = txt(el); if (/^(From|Starting at)\s*[$\u20ac\u00a3]\s*[0-9]/i.test(t) && t.length < 30) { priceBox = t; return true; } return false; });
      var ad = leaves(c).some(function (l) { return /^(ad|ad by|promoted)$/i.test(l.text); });
      var href = titleLink ? attr(titleLink, 'href') : attr(one(c, 'a[aria-label="Go to gig"]'), 'href');
      var reviews = cntText ? numK(cntText) : null;
      return { title: squash(title).slice(0, 200), url: absUrl(href), seller: squash(seller).slice(0, 60), level: level, rating: score ? num(txt(score)) : null, reviews: reviews, reviewsApprox: /k|\+/i.test(cntText), price: priceBox ? money(priceBox) : null, currency: priceBox ? currencyOf(priceBox) : '', ad: ad, metric: reviews };
    }).filter(function (r) { return r.title && r.url; });
    if (!rows.length) {
      if (cards.length) return drift('fiverr.gigs', label, cards.length, 'the page shows ' + cards.length + ' gig cards and none of them reads.', { via: via });
      return notHere('fiverr.gigs', 'no gigs on this page');
    }
    if (!rows.some(function (r) { return r.price != null; })) return drift('fiverr.gigs', label, rows.length, rows.length + ' gig titles read and none of their prices did.', { via: via });
    return done('fiverr.gigs', label, rows, { via: via, blanks: blanks(rows, ['price', 'rating', 'reviews', 'level']) });
  }

  var PHONE = /^\+?[0-9(][0-9\s().-]{6,}[0-9]$/;
  var OPEN_STATE = /^(open|closed|opens|closes|open 24 hours|temporarily closed|permanently closed|abierto|cerrado)\b/i;

  function starsOf(box) {
    var hit = null;
    all('[role="img"][aria-label]', box).some(function (el) {
      var m = /([0-9](?:[.,][0-9])?)\s+stars?(?:\s+([0-9][0-9,.]*[KkMm]?)\s+reviews?)?/i.exec(attr(el, 'aria-label'));
      if (m) { hit = { rating: parseFloat(m[1].replace(',', '.')), reviews: m[2] ? numK(m[2]) : null, approx: m[2] ? approx(m[2]) : false }; return true; }
      return false;
    });
    if (hit && hit.reviews == null) {
      var paren = leafText(box, /^\(([0-9][0-9,.]*[KkMm]?)\)$/);
      if (paren) { hit.reviews = numK(paren[1]); hit.approx = approx(paren[1]); }
    }
    return hit;
  }

  function ownDot(el) {
    return Array.prototype.some.call(el.childNodes || [], function (c) { return c.nodeType === 3 && String(c.textContent).indexOf('\u00b7') >= 0; });
  }

  function dotParts(box, name) {
    var lines = [];
    all('*', box).forEach(function (el) {
      if (!ownDot(el)) return;
      var n = el, hops = 0;
      while (n && n !== box && n.nodeType === 1 && hops < 3) {
        var nt = txt(n);
        if (name && nt.indexOf(name) >= 0) return;
        var i = nt.indexOf('\u00b7');
        if (i > 0 && squash(nt.slice(0, i)) && squash(nt.slice(i + 1))) { if (lines.indexOf(n) < 0) lines.push(n); return; }
        n = n.parentNode;
        hops++;
      }
    });
    return lines.map(function (el) {
      return txt(el).split('\u00b7').map(function (p) { return squash(p); }).filter(Boolean);
    });
  }

  function leafJoin(el) {
    var parts = [];
    (function walk(node) {
      Array.prototype.forEach.call(node.childNodes || [], function (c) {
        if (c.nodeType === 3) { var t = squash(c.textContent); if (t) parts.push(t); return; }
        if (c.nodeType !== 1) return;
        var tag = String(c.tagName || '').toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'template') return;
        walk(c);
      });
    })(el);
    return parts.join(' ');
  }

  function mapsCard(a) {
    var box = (a.closest && a.closest('[role="article"]')) || a.parentNode || a;
    var name = attr(a, 'aria-label') || txt(one(box, '[role="heading"]')) || txt(one(box, '.fontHeadlineSmall'));
    var stars = starsOf(box);
    var site = one(box, 'a[data-value="Website"]') || one(box, 'a[aria-label^="Visit"][href]');
    var actions = all('a[data-value], button[data-value], a[aria-label^="Directions"], button[aria-label^="Directions"]', box).length;
    var row = { name: squash(name).slice(0, 120), url: absUrl(attr(a, 'href')), rating: stars ? stars.rating : null, reviews: stars ? stars.reviews : null, reviewsApprox: stars ? stars.approx : false, category: '', address: '', phone: '', website: '', hasWebsite: null, sponsored: false, closed: '' };
    if (site) { row.website = absUrl(attr(site, 'href'), true); row.hasWebsite = true; }
    else if (actions) row.hasWebsite = false;
    var first = true;
    dotParts(box, row.name).forEach(function (parts) {
      parts.forEach(function (p) {
        if (/^[0-9](?:[.,][0-9])?$/.test(p) || /^\(?[0-9][0-9,.]*[KkMm]?\)?$/.test(p) || /^[$\u20ac\u00a3]+(?:[\u2013-][$\u20ac\u00a3]+)?$/.test(p)) return;
        if (PHONE.test(p)) { if (!row.phone) row.phone = p; return; }
        if (OPEN_STATE.test(p)) { if (/permanently closed/i.test(p)) row.closed = 'permanently'; else if (/temporarily closed/i.test(p)) row.closed = 'temporarily'; return; }
        if (/[0-9]/.test(p) && !row.address) { row.address = p.slice(0, 160); return; }
        if (first && !row.category && !/[0-9]/.test(p) && p.length <= 60) row.category = p;
      });
      first = false;
    });
    leaves(box).forEach(function (l) {
      if (/^sponsored$|^patrocinado$/i.test(l.text)) row.sponsored = true;
      if (/^permanently closed$/i.test(l.text)) row.closed = 'permanently';
      if (/^temporarily closed$/i.test(l.text)) row.closed = row.closed || 'temporarily';
      if (!row.phone && PHONE.test(l.text)) row.phone = l.text;
    });
    row.metric = row.reviews;
    return row;
  }

  function readMapsResults(opts) {
    var label = 'Google Maps results';
    var feed = one(doc(), '[role="feed"]') || doc();
    var seen = {};
    var anchors = all('a[href*="/maps/place/"]', feed).filter(function (a) {
      var k = attr(a, 'aria-label') + '|' + attr(a, 'href').split('?')[0];
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });
    var rows = anchors.slice(0, limitOf(opts)).map(mapsCard).filter(function (r) { return r.name; });
    if (!rows.length) {
      if (anchors.length >= MIN_PROBE) return drift('maps.results', label, anchors.length, 'the list links to ' + anchors.length + ' places and none of them reads.');
      return notHere('maps.results', 'no list of places on this page');
    }
    if (rows.length >= MIN_PROBE && !rows.some(function (r) { return r.rating != null || r.category || r.address; })) return drift('maps.results', label, rows.length, rows.length + ' place names read and none of their ratings, categories or addresses did.');
    return done('maps.results', label, rows, { query: squash(decodeURIComponent((/\/maps\/search\/([^\/@?]+)/.exec(here().pathname) || [])[1] || '').replace(/\+/g, ' ')).slice(0, 120), blanks: blanks(rows, ['rating', 'reviews', 'category', 'address', 'hasWebsite']) });
  }

  function readMapsPlace(opts) {
    var label = 'Google Maps place';
    var panel = one(doc(), '[role="main"][aria-label]') || doc();
    var h1 = one(panel, 'h1') || one(doc(), 'h1');
    var name = h1 ? txt(h1) : attr(panel, 'aria-label');
    if (!name) return notHere('maps.place', 'this is not a Google Maps place');
    var stars = starsOf(panel);
    if (stars && stars.reviews == null) {
      var btn = null;
      all('button[aria-label], [role="button"][aria-label], span[aria-label]', panel).some(function (b) { var m = /([0-9][0-9,.]*)\s+reviews?/i.exec(attr(b, 'aria-label')); if (m) { btn = m; return true; } return false; });
      if (btn) stars.reviews = numK(btn[1]);
    }
    var addrEl = one(panel, '[data-item-id="address"]');
    var siteEl = one(panel, 'a[data-item-id="authority"]');
    var phoneEl = one(panel, '[data-item-id^="phone:tel:"]');
    var catEl = one(panel, 'button[jsaction*="category"]');
    var hours = !!(one(panel, '[data-item-id="oh"]') || one(panel, '[aria-label*="Hours"]') || one(panel, '[aria-label*="hours"]'));
    var place = {
      name: squash(name).slice(0, 120),
      rating: stars ? stars.rating : null,
      reviews: stars ? stars.reviews : null,
      category: catEl ? txt(catEl).slice(0, 80) : '',
      address: addrEl ? squash(attr(addrEl, 'aria-label') || txt(addrEl)).replace(/^Address:\s*/i, '').slice(0, 200) : '',
      website: siteEl ? absUrl(attr(siteEl, 'href'), true) : '',
      hasWebsite: siteEl ? true : (addrEl ? false : null),
      phone: phoneEl ? (attr(phoneEl, 'data-item-id').replace(/^phone:tel:/, '') || squash(attr(phoneEl, 'aria-label')).replace(/^Phone:\s*/i, '')) : '',
      hasHours: hours,
      url: absUrl(here().href)
    };
    var seen = {};
    var cards = all('[data-review-id]', panel).filter(function (c) {
      var id = attr(c, 'data-review-id');
      if (!id || seen[id]) return false;
      seen[id] = 1;
      return !(c.parentNode && c.parentNode.closest && c.parentNode.closest('[data-review-id="' + id + '"]'));
    });
    var rows = cards.slice(0, limitOf(opts)).map(function (c) {
      var st = null;
      all('[role="img"][aria-label]', c).some(function (el) { var m = /^([0-9])\s+stars?$/i.exec(squash(attr(el, 'aria-label'))); if (m) { st = Number(m[1]); return true; } return false; });
      var body = one(c, '.wiI7pd') || one(c, '[data-expandable-section]');
      var texts = leaves(c).map(function (l) { return l.text; });
      var text = body ? txt(body) : texts.slice().sort(function (a, b) { return b.length - a.length; })[0] || '';
      var when = '';
      texts.some(function (t) { if (/^(?:[0-9]+|an?)\s+(?:day|week|month|year)s?\s+ago$|^(?:yesterday|today)$/i.test(t)) { when = t; return true; } return false; });
      var owner = /response from the owner|respuesta del propietario/i.test(txt(c));
      var who = one(c, '[aria-label^="Photo of"]');
      return { id: attr(c, 'data-review-id'), stars: st, text: squash(text).slice(0, 800), when: when, ageMin: when ? minutesAgo(when) : null, answered: owner, by: who ? squash(attr(who, 'aria-label')).replace(/^Photo of\s*/i, '').slice(0, 60) : '' };
    }).filter(function (r) { return r.id; });
    if (place.rating == null && !place.address && !rows.length) return drift('maps.place', label, 1, 'the place name read, and none of its rating, address or reviews did.');
    if (cards.length && !rows.some(function (r) { return r.stars != null; })) return drift('maps.place', label, cards.length, cards.length + ' reviews are on screen and none of their stars reads.', { place: place });
    return done('maps.place', label, rows, { place: place, onPage: cards.length, blanks: blanks(rows, ['stars', 'when']) });
  }

  var AMAZON_RETAIL = /(^|\.)amazon\.(com|ca|co\.uk|de|fr|it|es|nl|se|pl|ie|com\.mx|com\.au|com\.br|co\.jp|in|com\.be)$/;

  function readAmazonSearch(opts) {
    var label = 'Amazon search';
    var cards = all('[data-component-type="s-search-result"]').filter(function (c) { return /^[A-Z0-9]{10}$/.test(attr(c, 'data-asin')); });
    var rows = cards.slice(0, limitOf(opts)).map(function (c) {
      var h2 = one(c, 'h2');
      var title = h2 ? (attr(h2, 'aria-label') || txt(h2)) : '';
      var adTitle = /^Sponsored Ad\s*[\u2013-]\s*/i.test(title);
      title = title.replace(/^Sponsored Ad\s*[\u2013-]\s*/i, '');
      var link = one(c, '[data-cy="title-recipe"] a[href]') || (h2 && h2.closest ? h2.closest('a[href]') : null) || one(c, 'h2 a[href]') || one(c, 'a[href*="/dp/"]');
      var asin = attr(c, 'data-asin');
      var priceEl = one(c, '[data-cy="price-recipe"] .a-price:not(.a-text-price) .a-offscreen') || one(c, '.a-price:not(.a-text-price) .a-offscreen');
      var rateEl = one(c, '.a-icon-alt');
      var rm = rateEl ? /([0-9](?:[.,][0-9])?)\s+out of 5/.exec(txt(rateEl)) : null;
      var cntEl = one(c, 'a[aria-label$=" ratings"]') || one(c, 'a[aria-label$=" rating"]');
      var cnt = cntEl ? /([0-9][0-9,.]*[KkMm]?)/.exec(attr(cntEl, 'aria-label')) : null;
      var bought = leafText(c, /^([0-9][0-9.,]*[KkMm]?\+?)\s+bought in past month$/i);
      var sponsored = adTitle || !!one(c, '.puis-sponsored-label-text') || leaves(c).some(function (l) { return /^sponsored$/i.test(l.text); });
      var badge = one(c, '.a-badge-text');
      var href = link ? attr(link, 'href') : '';
      var clean = /\/dp\/[A-Z0-9]{10}/.test(href) ? (/^(.*?\/dp\/[A-Z0-9]{10})/.exec(href) || [])[1] : '/dp/' + asin;
      var ratings = cnt ? numK(cnt[1]) : null;
      return { asin: asin, title: squash(title).slice(0, 240), url: absUrl(clean), price: priceEl ? money(txt(priceEl)) : null, currency: priceEl ? currencyOf(txt(priceEl)) : '', rating: rm ? parseFloat(rm[1].replace(',', '.')) : null, ratings: ratings, bought: bought ? numK(bought[1]) : null, boughtText: bought ? bought[0] : '', sponsored: sponsored, badge: badge ? txt(badge).slice(0, 40) : '', metric: ratings };
    }).filter(function (r) { return r.title; });
    if (!rows.length) {
      if (cards.length) return drift('amazon.search', label, cards.length, 'the page shows ' + cards.length + ' results and none of them reads.');
      return notHere('amazon.search', 'no search results on this page');
    }
    if (rows.length >= MIN_PROBE && !rows.some(function (r) { return r.price != null || r.rating != null; })) return drift('amazon.search', label, rows.length, rows.length + ' titles read and none of their prices or ratings did.');
    return done('amazon.search', label, rows, { query: squash(new URL(here().href).searchParams.get('k') || '').slice(0, 120), blanks: blanks(rows, ['price', 'rating', 'ratings', 'bought']) });
  }

  function detailValue(re) {
    var out = '';
    all('li, tr, div.rpi-attribute-content, .a-section').some(function (el) {
      if (el.children && el.children.length > 12) return false;
      var t = txt(el);
      if (t.length > 300) return false;
      var m = re.exec(t);
      if (m) { out = squash(m[1]); return true; }
      return false;
    });
    return out;
  }

  function readAmazonProduct() {
    var label = 'Amazon product';
    var titleEl = one(doc(), '#productTitle');
    if (!titleEl) return /\/(dp|gp\/product)\//.test(here().pathname) ? drift('amazon.product', label, 1, 'this is a product page and its title did not read.') : notHere('amazon.product', 'this is not an Amazon product page');
    var asinM = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/.exec(here().pathname);
    var pop = one(doc(), '#acrPopover');
    var rm = pop ? /([0-9](?:[.,][0-9])?)\s+out of 5/.exec(attr(pop, 'title') || txt(pop)) : null;
    var cntEl = one(doc(), '#acrCustomerReviewText');
    var cm = cntEl ? /([0-9][0-9,.]*)/.exec(attr(cntEl, 'aria-label') || txt(cntEl)) : null;
    var priceEl = one(doc(), '#corePrice_feature_div .a-offscreen') || one(doc(), '.priceToPay .a-offscreen') || one(doc(), '#price') || one(doc(), '#kindle-price');
    var priceText = priceEl ? txt(priceEl) : '';
    var bsr = [];
    var bsrBox = null;
    all('li, tr').some(function (el) {
      var t = txt(el);
      if (/Best Sellers Rank/i.test(t) && t.length < 600) { bsrBox = el; return true; }
      return false;
    });
    if (bsrBox) {
      var re = /#\s?([0-9][0-9,]*)\s+in\s+([^#(]+?)(?=\s*\(|\s*#|$)/g, m;
      var t = txt(bsrBox);
      while ((m = re.exec(t)) && bsr.length < 6) bsr.push({ rank: Number(m[1].replace(/,/g, '')), category: squash(m[2]).replace(/\s*See Top 100.*$/i, '').slice(0, 80) });
    }
    var sub = one(doc(), '#productSubtitle');
    var released = detailValue(/(?:Publication date|Release date|Date First Available)\s*:?\s*(?:\u200f|\u200e|:|\s)*([A-Z][a-z]+ [0-9]{1,2},? [0-9]{4}|[0-9]{1,2} [A-Z][a-z]+ [0-9]{4})/);
    if (!released) {
      var rpi = all('.rpi-attribute-content').filter(function (el) { return /Publication date/i.test(txt(one(el, '.rpi-attribute-label'))); })[0];
      if (rpi) released = txt(one(rpi, '.rpi-attribute-value'));
    }
    var by = one(doc(), '#bylineInfo');
    var bought = one(doc(), '#social-proofing-faceout-title-tk_bought');
    var product = {
      asin: asinM ? asinM[1] : attr(one(doc(), 'input#ASIN'), 'value'),
      title: txt(titleEl).slice(0, 300),
      format: sub ? txt(sub).split(/\s[\u2013-]\s/)[0].slice(0, 40) : '',
      by: by ? txt(by).replace(/\s*\(Author\)|Visit the | Store/g, ' ').replace(/\s+/g, ' ').replace(/^by\s+/i, '').trim().slice(0, 120) : '',
      price: priceText ? money(priceText) : null,
      currency: priceText ? currencyOf(priceText) : '',
      rating: rm ? parseFloat(rm[1].replace(',', '.')) : null,
      ratings: cm ? num(cm[1]) : null,
      ranks: bsr,
      released: released ? dayIso(released) || released : '',
      bought: bought ? txt(bought).slice(0, 60) : '',
      url: absUrl(here().href)
    };
    if (product.rating == null && product.price == null && !bsr.length) return drift('amazon.product', label, 1, 'the title read, and none of the price, rating or rank did.');
    return done('amazon.product', label, bsr.map(function (b) { return { rank: b.rank, category: b.category, metric: b.rank }; }), { product: product, rankFound: !!bsrBox });
  }

  function substackSignals() {
    return /(^|\.)substack\.com$/.test(String(here().hostname || '').toLowerCase()) || !!one(doc(), 'link[href*="substackcdn.com"], script[src*="substackcdn.com"], meta[content*="substackcdn.com"]');
  }

  function readSubstackArchive(opts) {
    var label = 'Substack archive';
    var host = String(here().hostname || '').toLowerCase();
    if (!substackSignals() || host === 'substack.com' || host === 'www.substack.com') return Promise.resolve(notHere('substack.archive', 'this is not a Substack publication'));
    var fetcher = root.fetch;
    if (typeof fetcher !== 'function') return Promise.resolve({ ok: false, code: 'not_exposed', reader: 'substack.archive', error: 'this page cannot fetch its own archive' });
    var n = Math.min(50, limitOf(opts));
    var origin = here().origin || (here().protocol + '//' + here().host);
    return Promise.resolve(fetcher.call(root, origin + '/api/v1/archive?sort=new&offset=0&limit=' + n, { credentials: 'omit', headers: { Accept: 'application/json' } })).then(function (res) {
      var type = res && res.headers && typeof res.headers.get === 'function' ? String(res.headers.get('content-type') || '') : '';
      if (!res || !res.ok) return { ok: false, code: 'not_exposed', reader: 'substack.archive', status: res ? res.status : 0, error: 'this publication does not answer its archive (HTTP ' + (res ? res.status : 0) + '). That means hidden, not empty.' };
      if (type && !/json/i.test(type)) return { ok: false, code: 'not_exposed', reader: 'substack.archive', status: res.status, error: 'this site answers the archive with a web page, not posts. That means hidden or not Substack, not empty.' };
      return res.text().then(function (body) {
        var data;
        try { data = JSON.parse(body); } catch (e) { return { ok: false, code: 'not_exposed', reader: 'substack.archive', error: 'the archive answered with something that is not a post list' }; }
        if (!Array.isArray(data)) return drift('substack.archive', label, 1, 'the archive answered without a post list.');
        var rows = data.slice(0, n).map(function (p) {
          p = p || {};
          var likes = typeof p.reaction_count === 'number' ? p.reaction_count : null;
          return { id: String(p.id || ''), title: squash(p.title).slice(0, 240), subtitle: squash(p.subtitle).slice(0, 240), url: absUrl(p.canonical_url || (p.slug ? '/p/' + p.slug : ''), false), date: isoOf(p.post_date), likes: likes, comments: typeof p.comment_count === 'number' ? p.comment_count : null, restacks: typeof p.restacks === 'number' ? p.restacks : null, audience: p.audience === 'everyone' ? 'free' : (p.audience ? 'paid' : ''), words: typeof p.wordcount === 'number' ? p.wordcount : null, type: squash(p.type).slice(0, 20), metric: likes };
        }).filter(function (r) { return r.title; });
        if (data.length && !rows.length) return drift('substack.archive', label, data.length, data.length + ' posts came back and none carries a title.');
        return done('substack.archive', label, rows, { via: 'json', listed: data.length, publication: squash(attr(one(doc(), 'meta[property="og:site_name"]'), 'content') || doc().title).slice(0, 120), blanks: blanks(rows, ['likes', 'comments', 'date']) });
      });
    }, function (e) {
      return { ok: false, code: 'not_exposed', reader: 'substack.archive', error: 'the archive could not be fetched: ' + squash(e && e.message || e).slice(0, 120) };
    });
  }

  function readGumroadProduct() {
    var label = 'Gumroad product';
    var holder = one(doc(), '[data-page]');
    var data = null;
    if (holder) { try { data = JSON.parse(attr(holder, 'data-page')); } catch (e) { data = null; } }
    var p = data && data.props && data.props.product;
    if (data && data.component && data.component !== 'Products/Show' && !/^\/l\//.test(here().pathname)) return notHere('gumroad.product', 'this Gumroad page is not a product page');
    if (!p || !p.name) {
      if (holder || /^\/l\//.test(here().pathname)) return drift('gumroad.product', label, 1, 'this is a product page and its product data did not read.');
      return notHere('gumroad.product', 'this is not a Gumroad product page');
    }
    var cur = String(p.currency_code || data.props.currency_code || '').toUpperCase();
    var base = typeof p.price_cents === 'number' ? p.price_cents / 100 : null;
    var r = p.ratings && typeof p.ratings === 'object' ? p.ratings : null;
    var tiers = (Array.isArray(p.options) ? p.options : []).slice(0, 12).map(function (o) {
      o = o || {};
      var diff = typeof o.price_difference_cents === 'number' ? o.price_difference_cents / 100 : 0;
      return { name: squash(o.name).slice(0, 80), price: base != null ? Math.round((base + diff) * 100) / 100 : null, metric: null };
    }).filter(function (t) { return t.name; });
    var product = {
      name: squash(p.name).slice(0, 200),
      url: absUrl(p.long_url || here().href, false),
      price: base,
      currency: cur,
      payWhatYouWant: !!p.pwyw,
      ratings: r && typeof r.count === 'number' ? r.count : null,
      average: r && typeof r.average === 'number' ? r.average : null,
      fiveStarPct: r && Array.isArray(r.percentages) && r.percentages.length === 5 ? r.percentages[4] : null,
      sales: typeof p.sales_count === 'number' ? p.sales_count : null,
      recurring: p.is_recurring_billing === true,
      type: squash(p.native_type).slice(0, 30),
      seller: p.seller && p.seller.name ? squash(p.seller.name).slice(0, 80) : ''
    };
    return done('gumroad.product', label, tiers, { product: product });
  }

  function g2Split(text) {
    var t = squash(text);
    var like = /What do you like best about [^?]+\?\s*(.*?)(?=What do you dislike about|What problems is|Recommendations to others|$)/i.exec(t);
    var dislike = /What do you dislike about [^?]+\?\s*(.*?)(?=What problems is|Recommendations to others|What do you like best|$)/i.exec(t);
    return { likes: like ? squash(like[1]).slice(0, 800) : '', dislikes: dislike ? squash(dislike[1]).slice(0, 800) : '' };
  }

  function readG2Reviews(opts) {
    var label = 'G2 reviews';
    var cards = outermost(all('[itemprop="review"]'));
    var via = 'primary';
    if (!cards.length) {
      via = 'fallback';
      var heads = all('*').filter(function (el) { return /^What do you dislike about /i.test(txt(el)) && !(el.children && el.children.length); });
      cards = outermost(heads.map(function (h) { return (h.closest && (h.closest('article') || h.closest('[class*="review"]'))) || h.parentNode; }).filter(Boolean));
    }
    var product = txt(one(doc(), 'h1')).slice(0, 120);
    var rows = cards.slice(0, limitOf(opts)).map(function (c, i) {
      var rv = one(c, '[itemprop="ratingValue"]');
      var stars = rv ? num(attr(rv, 'content') || txt(rv)) : null;
      if (stars == null) { var sr = /([0-9](?:\.[0-9])?)\s*(?:\/|out of)\s*5/.exec(txt(c)); if (sr) stars = parseFloat(sr[1]); }
      var nm = all('[itemprop="name"]', c).filter(function (el) { return !(el.closest && el.closest('[itemprop="author"]')); })[0] || null;
      var body = one(c, '[itemprop="reviewBody"]') || c;
      var parts = g2Split(txt(body));
      var date = one(c, '[itemprop="datePublished"]');
      var who = one(c, '[itemprop="author"]');
      var id = attr(c, 'id') || attr(c, 'data-review-id') || String(i + 1);
      return { id: id, stars: stars, title: nm ? squash(attr(nm, 'content') || txt(nm)).replace(/^"|"$/g, '').slice(0, 200) : '', likes: parts.likes, dislikes: parts.dislikes, at: date ? isoOf(attr(date, 'content') || txt(date)) : '', by: who ? squash(attr(one(who, '[itemprop="name"]'), 'content') || txt(who)).slice(0, 60) : '', url: absUrl(here().pathname + '#' + id, true), metric: stars };
    }).filter(function (r) { return r.likes || r.dislikes || r.title; });
    if (!rows.length) {
      if (cards.length) return drift('g2.reviews', label, cards.length, 'the page shows ' + cards.length + ' reviews and none of them reads.', { via: via });
      return notHere('g2.reviews', 'no reviews on this page');
    }
    if (!rows.some(function (r) { return r.dislikes || r.likes; })) return drift('g2.reviews', label, rows.length, rows.length + ' reviews read and none of their likes or dislikes did.', { via: via });
    return done('g2.reviews', label, rows, { product: product, via: via, blanks: blanks(rows, ['stars', 'dislikes', 'at']) });
  }

  function shopifySignals() {
    return !!(one(doc(), 'link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"], meta[name="shopify-digital-wallet"], meta[name="shopify-checkout-api-token"], [id^="shopify-section"], .shopify-section'));
  }

  function detect() {
    var host = String(here().hostname || '').toLowerCase();
    var path = String(here().pathname || '/');
    var out = [];
    if (/(^|\.)etsy\.com$/.test(host)) {
      if (/^\/listing\/[0-9]+/.test(path)) out.push('etsy.listing');
      if (/^\/shop\//.test(path)) out.push('etsy.shop');
      if (listingIds().length >= MIN_PROBE) out.push('etsy.grid');
    }
    if (host === 'github.com' && /^\/[^\/]+\/[^\/]+\/issues\/?$/.test(path)) out.push('github.issues');
    var gh = host === 'github.com' ? repoPath(here().href) : null;
    if (gh) {
      var rest = gh.rest.join('/');
      if (rest === 'graphs/traffic') out.push('github.traffic');
      else if (/^releases(\/|$)|^tags\/?$/.test(rest)) out.push('github.releases');
      else if (/^commits(\/|$)/.test(rest)) out.push('github.commits');
      else if (!rest || /^tree\//.test(rest)) out.push('github.repo');
    }
    if (host === 'news.ycombinator.com') {
      if (path === '/item') out.push('hn.item');
      else if (/^\/(news|newest|show|shownew|ask|front|best|active|pool)?$/.test(path)) out.push('hn.list');
    }
    if (/(^|\.)reddit\.com$/.test(host) && /^\/r\/[^\/]+\/comments\//.test(path)) out.push('reddit.thread');
    if (/(^|\.)producthunt\.com$/.test(host) && /^\/(products|posts)\/[^\/]+/.test(path)) out.push('ph.product');
    if (/(^|\.)npmjs\.com$/.test(host) && /^\/package\//.test(path)) out.push('npm.package');
    if (host === 'pypi.org' && /^\/project\/[^\/]+/.test(path)) out.push('pypi.package');
    if (/^(www\.|m\.)?tiktok\.com$/.test(host)) {
      if (/^\/@[^\/]+\/(video|photo)\/[0-9]+/.test(path)) out.push('tiktok.video');
      else if (/^\/@[^\/]+\/?$/.test(path)) out.push('tiktok.profile');
    }
    if (/^(www\.)?instagram\.com$/.test(host) && /^\/[A-Za-z0-9._]+\/(reels\/)?$/.test(path)) out.push('instagram.profile');
    if (/^(www\.)?upwork\.com$/.test(host)) {
      if (/^\/(nx\/)?(jobs|freelance-jobs\/apply)\/|^\/(ab|nx)\/proposals\/job\//.test(path)) out.push('upwork.job');
      else out.push('upwork.jobs');
    }
    if (/^(www\.)?fiverr\.com$/.test(host) && /^\/(search|categories)\//.test(path)) out.push('fiverr.gigs');
    if (/^(www\.|maps\.)?google\.[a-z.]+$/.test(host) && /^\/maps(\/|$)/.test(path)) out.push(/^\/maps\/place\//.test(path) ? 'maps.place' : 'maps.results');
    if (AMAZON_RETAIL.test(host)) {
      if (/\/(dp|gp\/product)\/[A-Z0-9]{10}/.test(path)) out.push('amazon.product');
      else if (/^\/s(\/|$)/.test(path)) out.push('amazon.search');
    }
    if (/(^|\.)gumroad\.com$/.test(host) && /"component":\s*"Products\/Show"/.test(attr(one(doc(), '[data-page]'), 'data-page'))) out.push('gumroad.product');
    if (/^(www\.)?g2\.com$/.test(host) && /^\/products\/[^\/]+\/reviews/.test(path)) out.push('g2.reviews');
    if (substackSignals() && host !== 'substack.com' && host !== 'www.substack.com') out.push('substack.archive');
    if (shopifySignals() || /\.myshopify\.com$/.test(host)) {
      if (productLinks().length >= MIN_PROBE) out.push('shopify.grid');
      out.push('shopify.products');
    }
    return out;
  }

  var READERS = {
    'etsy.grid': readEtsyGrid,
    'etsy.shop': readEtsyShop,
    'etsy.listing': readEtsyListing,
    'shopify.grid': readShopifyGrid,
    'shopify.products': readShopifyProducts,
    'github.issues': readIssues,
    'github.repo': readGithubRepo,
    'github.commits': readGithubFeed('commits'),
    'github.releases': readGithubFeed('releases'),
    'github.traffic': readGithubTraffic,
    'hn.item': readHnItem,
    'hn.list': readHnList,
    'reddit.thread': readReddit,
    'ph.product': readProductHunt,
    'npm.package': readNpm,
    'pypi.package': readPypi,
    'tiktok.profile': readTiktokProfile,
    'tiktok.video': readTiktokVideo,
    'instagram.profile': readInstagramProfile,
    'upwork.jobs': readUpworkJobs,
    'upwork.job': readUpworkJob,
    'fiverr.gigs': readFiverrGigs,
    'maps.results': readMapsResults,
    'maps.place': readMapsPlace,
    'amazon.search': readAmazonSearch,
    'amazon.product': readAmazonProduct,
    'substack.archive': readSubstackArchive,
    'gumroad.product': readGumroadProduct,
    'g2.reviews': readG2Reviews,
    'table': function (opts) { return readTable(opts, String((opts && opts.as) || 'table'), String((opts && opts.label) || 'Table')); },
    'tiles': function (opts) { return readTiles(opts, String((opts && opts.as) || 'tiles'), String((opts && opts.label) || 'Dashboard tiles')); }
  };

  function read(id, opts) {
    var name = String(id || '');
    if (!name) {
      var found = detect();
      if (!found.length) return Promise.resolve({ ok: false, code: 'no_reader', readers: Object.keys(READERS), error: 'no reader knows this page. Read it with zerackPage read instead.' });
      name = found[0];
    }
    if (!owns.call(READERS, name)) return Promise.resolve({ ok: false, code: 'no_reader', readers: Object.keys(READERS), error: 'unknown reader ' + name.slice(0, 40) });
    var out;
    try { out = READERS[name](opts || {}); } catch (e) { out = { ok: false, code: 'drift', reader: name, error: 'the reader broke on this page: ' + squash(e && e.message || e).slice(0, 160) }; }
    return Promise.resolve(out).then(function (r) {
      if (r && r.ok) r.detected = detect();
      return r;
    });
  }

  root.NSP_EXTRACT = Object.freeze({
    version: 1,
    readers: Object.keys(READERS),
    detect: detect,
    read: read,
    parse: Object.freeze({ num: num, numK: numK, money: money, pct: pct, currencyOf: currencyOf, duration: duration, minutesAgo: minutesAgo }),
    text: Object.freeze({ atom: atom, commits: commitRows, releases: releaseRows, githubRepo: githubRepoFromHtml, cws: cwsFromHtml, npm: npmFromHtml, pypi: pypiFromHtml, lines: lines })
  });
})(typeof self !== 'undefined' ? self : this);
