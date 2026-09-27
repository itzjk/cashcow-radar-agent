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
    var code = /\b(USD|CAD|AUD|NZD|EUR|GBP|JPY|MXN|BRL|INR|CHF|SEK|NOK|DKK|PLN)\b/.exec(t);
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
    'table': function (opts) { return readTable(opts, String((opts && opts.as) || 'table'), String((opts && opts.label) || 'Table')); }
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
    parse: Object.freeze({ num: num, money: money, pct: pct, currencyOf: currencyOf })
  });
})(typeof self !== 'undefined' ? self : this);
