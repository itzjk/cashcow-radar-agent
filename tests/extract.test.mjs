// The page readers on captured and anonymized pages: the numbers they return, checked by hand against the saved HTML, and drift instead of zero rows when the page changes.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done, htmlPage } from "./sw-harness.mjs";
import { windowFor } from "./dom-lite.mjs";

const SRC = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");
const page = name => htmlPage(name);

function reader(html, url, fetchImpl) {
  const w = windowFor(html, url);
  const ctx = { document: w.document, location: w.location, URL, console, fetch: fetchImpl };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "lib/nsp-extract.js" });
  return ctx.NSP_EXTRACT;
}

const read = (name, url, id, opts, fetchImpl, mutate) => {
  let html = page(name);
  if (mutate) html = mutate(html);
  return reader(html, url, fetchImpl).read(id, opts).then(r => JSON.parse(JSON.stringify(r)));
};

const PLAYBOOKS = (() => {
  const ctx = { URL, console };
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ["etsy", "shopify", "seo", "builders", "index"]) vm.runInContext(readFileSync(join(ROOT, "knowledge/playbooks", f + ".js"), "utf8"), ctx);
  return ctx.NSP_PLAYBOOKS;
})();
const opts = (host, path) => { const p = PLAYBOOKS.readerFor(PLAYBOOKS.forHost(host, path), host, path); return JSON.parse(JSON.stringify(p.opts)); };

const ETSY_GRID = "https://www.etsy.com/c/home-and-living";
{
  const r = await read("etsy-grid.html", ETSY_GRID, "etsy.grid");
  const first = r.rows[0];
  check("the Etsy grid reads all 36 cards of the captured page", r.ok && r.count === 36 && r.onPage === 36 && r.via === "primary", { count: r.count, onPage: r.onPage });
  check("the first card matches the saved HTML by hand: title, price, sale, rating, reviews, ad, free shipping",
    first.title.startsWith("Blind Psychic Reading, No Questions Asked") && first.price === 6.6 && first.originalPrice === 12 && first.discountPct === 45 && first.rating === 4.87 && first.reviews === 6824 && first.ad === true && first.freeShipping === true && first.currency === "$", first);
  check("an ad card has no shop name, and the metric the engines rank on is its review count", first.shop === "" && first.metric === 6824);
  const sixth = r.rows[5];
  check("a Star Seller card from a named shop reads its shop, badge and numbers", sixth.shop === "ShopB" && sixth.starSeller === true && sixth.price === 535.53 && sixth.reviews === 1362 && sixth.ad === false, sixth);
  check("every card has a title, a listing link and a price", r.rows.every(x => x.title && /^https:\/\/www\.etsy\.com\/listing\/\d+\//.test(x.url) && typeof x.price === "number"), r.blanks);
  check("the listing links keep no tracking query", r.rows.every(x => !/[?#]/.test(x.url)));
  check("12 ads and 24 Star Sellers, as counted in the HTML", r.rows.filter(x => x.ad).length === 12 && r.rows.filter(x => x.starSeller).length === 24);
  check("a card title that says 7 minutes or 20% off is never read as a number", r.rows.every(x => x.discountPct === null || (x.originalPrice > x.price)));
}
{
  const renamed = await read("etsy-grid.html", ETSY_GRID, "etsy.grid", null, null, h => h.replace(/v2-listing-card/g, "v3-product-tile").replace(/data-listing-id=/g, "data-item-id="));
  check("a renamed card class answers drift, never zero rows", renamed.ok === false && renamed.code === "drift" && renamed.seen === 36 && !renamed.rows, renamed);
  const fallback = await read("etsy-grid.html", ETSY_GRID, "etsy.grid", null, null, h => h.replace(/v2-listing-card/g, "v3-product-tile"));
  check("when only the class changed, the second shape still reads every card and says which one fired", fallback.ok && fallback.count === 36 && fallback.via === "fallback", { count: fallback.count, via: fallback.via });
  const noTitles = await read("etsy-grid.html", ETSY_GRID, "etsy.grid", null, null, h => h.replace(/v2-listing-card__title/g, "x-title").replace(/<h3/g, "<div").replace(/<\/h3>/g, "</div>").replace(/ title="[^"]*"/g, ""));
  check("cards that lose their titles answer drift", noTitles.ok === false && noTitles.code === "drift", noTitles.error);
  const noPrice = await read("etsy-grid.html", ETSY_GRID, "etsy.grid", null, null, h => h.replace(/currency-value/g, "amount-x"));
  check("cards whose price no longer reads are flagged partial, not priced at zero", noPrice.ok && noPrice.partial && noPrice.partial[0] === "price" && noPrice.rows.every(x => x.price === null), { partial: noPrice.partial, price: noPrice.rows[0].price });
  const elsewhere = await read("gsc-performance.html", "https://www.etsy.com/your/shops/me/stats", "etsy.grid");
  check("a page with no listings says it is not this page", elsewhere.ok === false && elsewhere.code === "not_this_page", elsewhere);
}
{
  const r = await read("etsy-shop.html", "https://www.etsy.com/shop/NorthwindJewelry", "etsy.shop");
  check("the shop page reads its exact sales, opening year, admirers, rating and badge", r.ok && r.shop.sales === 3804382 && r.shop.salesApprox === false && r.shop.since === 2014 && r.shop.admirers === 520635 && r.shop.rating === 4.8 && r.shop.starSeller === true && r.shop.name === "NorthwindJewelry", r.shop);
  check("the same listing shown twice on the shop page is read once", r.count === 10 && new Set(r.rows.map(x => x.id)).size === 10, r.count);
  const approx = await read("etsy-shop.html", "https://www.etsy.com/shop/NorthwindJewelry", "etsy.shop", null, null, h => h.replace(/3804382 Sales/, "").replace(/Sales\s*<span class="wt-text-title-larger wt-display-block">3,804,382<\/span>/, ""));
  check("with only the rounded highlight left, sales read as 3.8M and are marked approximate", approx.ok && approx.shop.sales === 3800000 && approx.shop.salesApprox === true, approx.shop);
  const gone = await read("etsy-shop.html", "https://www.etsy.com/shop/NorthwindJewelry", "etsy.shop", null, null, h => h.replace(/Sales/g, "Ventas").replace(/On Etsy since/g, "Desde").replace(/data-highlight="sales"/g, 'data-highlight="x"'));
  check("a shop page whose sales and year no longer read answers drift", gone.ok === false && gone.code === "drift", gone.error);
}
{
  const r = await read("etsy-listing.html", "https://www.etsy.com/listing/7000000001/marquise-diamond-necklace", "etsy.listing");
  const x = r.rows[0];
  check("the listing reads price, original price, favorites and listed date from the page", r.ok && x.price === 33.75 && x.originalPrice === 45 && x.favorites === 51694 && x.listedOn === "Jul 20, 2026" && r.via === "dom", x);
  check("the seller block reads rating 4.8, about 746k reviews, about 3.8M sales and 11 years", x.shopRating === 4.8 && x.shopReviews === 746000 && x.shopReviewsApprox && x.shopSales === 3800000 && x.shopSalesApprox && x.shopYears === 11, x);
  check("the item review count is not on the saved page, so it stays unknown", x.reviews === null);
  const ld = '<script type="application/ld+json">{"@type":"Product","name":"Oak board","offers":{"@type":"Offer","price":"41.00","priceCurrency":"USD"},"aggregateRating":{"ratingValue":"4.9","reviewCount":3033}}</script>';
  const withLd = await read("etsy-listing.html", "https://www.etsy.com/listing/7000000001/x", "etsy.listing", null, null, h => h.replace("</head>", ld + "</head>"));
  check("when the page carries product data, the reader takes it first and says so", withLd.ok && withLd.via === "jsonld" && withLd.rows[0].price === 41 && withLd.rows[0].reviews === 3033 && withLd.rows[0].title === "Oak board", withLd.rows[0]);
  const broken = await read("etsy-listing.html", "https://www.etsy.com/listing/7000000001/x", "etsy.listing", null, null, h => h.replace(/data-buy-box-region="price"/g, "data-x"));
  check("a listing whose price box is gone answers drift", broken.ok === false && broken.code === "drift", broken.error);
}
{
  const r = await read("shopify-dawn-collection.html", "https://theme-dawn-demo.myshopify.com/collections/all", "shopify.grid");
  const deco = r.rows.find(x => x.title === "Art Deco");
  check("the Dawn demo collection reads 16 product cards", r.ok && r.count === 16 && r.onPage === 16, r.count);
  check("a sale card reads its sale price, the struck price and the currency, as in the saved HTML", deco && deco.price === 165 && deco.compareAt === 375 && deco.onSale && deco.currency === "CAD", deco);
  check("the sold out card is flagged", r.rows.filter(x => x.soldOut).length === 1);
  const drift = await read("shopify-dawn-collection.html", "https://theme-dawn-demo.myshopify.com/collections/all", "shopify.grid", null, null, h => h.replace(/card-wrapper/g, "tile").replace(/card__heading/g, "tile-name").replace(/<li\b/g, "<div").replace(/<\/li>/g, "</div>"));
  check("a store whose card markup changed answers drift", drift.ok === false && drift.code === "drift" && drift.seen === 16, drift);
}
{
  const catalog = htmlPage("shopify-products.json");
  const asked = [];
  const ok = async (u, init) => { asked.push({ u, init }); return { ok: true, status: 200, headers: { get: () => "application/json; charset=utf-8" }, text: async () => catalog }; };
  const r = await read("shopify-dawn-collection.html", "https://store.example/collections/all", "shopify.products", { limit: 250 }, ok);
  check("the catalog reader asks the same store for /products.json without cookies", asked.length === 1 && asked[0].u === "https://store.example/products.json?limit=250" && asked[0].init.credentials === "omit", asked);
  check("it reads 120 products with price, launch date and availability", r.ok && r.count === 120 && r.rows.every(x => x.title && x.created && typeof x.price === "number"), r.count);
  const first = r.rows[0];
  check("the first product matches the saved catalog by hand", first.title === "Carry the Universe" && first.price === 62 && first.created === "2026-09-17T16:35:38-07:00" && first.url === "https://store.example/products/product-1", first);
  const hidden = await read("shopify-dawn-collection.html", "https://store.example/", "shopify.products", null, async () => ({ ok: false, status: 404, headers: { get: () => "text/html" }, text: async () => "" }));
  check("a 404 means the catalog is hidden, not empty", hidden.ok === false && hidden.code === "not_exposed" && /hidden, not empty/.test(hidden.error), hidden);
  const html = await read("shopify-dawn-collection.html", "https://store.example/", "shopify.products", null, async () => ({ ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "<html></html>" }));
  check("a web page where the catalog should be is not a Shopify catalog", html.ok === false && html.code === "not_exposed", html);
  const shape = await read("shopify-dawn-collection.html", "https://store.example/", "shopify.products", null, async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => '{"items":[]}' }));
  check("a catalog without a product list answers drift", shape.ok === false && shape.code === "drift", shape);
  const empty = await read("shopify-dawn-collection.html", "https://store.example/", "shopify.products", null, async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => '{"products":[]}' }));
  check("an empty catalog is a real zero the store published", empty.ok === true && empty.count === 0, empty);
}
{
  const o = opts("search.google.com", "/search-console/performance/search-analytics");
  const r = await read("gsc-performance.html", "https://search.google.com/search-console/performance/search-analytics?resource_id=x", "table", o);
  const row = r.rows.find(x => x.query === "personalized coffee mug");
  check("the Search Console table reads 18 query rows with typed numbers", r.ok && r.count === 18 && r.reader === "gsc.queries", r.count);
  check("one row matches the fixture: 188 clicks, 14,020 impressions, 1.3% CTR, position 9.4", row && row.clicks === 188 && row.impressions === 14020 && row.ctr === 1.3 && row.position === 9.4, row);
  const moved = await read("gsc-performance.html", "https://search.google.com/search-console/performance/search-analytics", "table", o, null, h => h.replace(">Impressions<", ">Views<").replace(">Position<", ">Rank<"));
  check("a table whose columns were renamed answers drift and names what is missing", moved.ok === false && moved.code === "drift" && moved.missing.join() === "impressions" && moved.headersSeen.includes("views"), moved);
  const plain = await read("gsc-performance.html", "https://search.google.com/search-console/performance/search-analytics", "table", o, null, h => h.replace(/<th[^>]*>(?:(?!<\/th>)[\s\S])*?<span>CTR<\/span>(?:(?!<\/th>)[\s\S])*?<\/th>/, "").replace(/<th[^>]*>(?:(?!<\/th>)[\s\S])*?<span>Position<\/span>(?:(?!<\/th>)[\s\S])*?<\/th>/, "").replace(/(<tr[^>]*>(?:\s*<td[^>]*>[\s\S]*?<\/td>){3})(?:\s*<td[^>]*>[\s\S]*?<\/td>){2}/g, "$1"));
  check("the default Performance view, clicks and impressions only, reads its rows instead of drift", plain.ok === true && plain.count === 18 && plain.columns.length === 3 && plain.rows.every(x => typeof x.impressions === "number" && x.position == null), plain.ok ? { cols: plain.columns, row: plain.rows[0] } : plain);
}
{
  const r = await read("shopify-admin-orders.html", "https://admin.shopify.com/store/northwind-demo/orders", "table", opts("admin.shopify.com", "/store/northwind-demo/orders"));
  const o = r.rows.find(x => x.order === "#1021");
  check("the admin orders table reads 8 orders with totals as numbers and the hidden Status word left out", r.ok && r.count === 8 && o.total === 76 && o.payment === "Payment pending" && o.fulfillment === "Unfulfilled", o);
  check("each order keeps its link", r.rows.every(x => /^https:\/\/admin\.shopify\.com\/store\/northwind-demo\/orders\/\d+$/.test(x.url)), r.rows[0]);
}
{
  const r = await read("wp-posts.html", "https://northwind.example/wp-admin/edit.php", "table", opts("northwind.example", "/wp-admin/edit.php"));
  check("the WordPress posts list reads titles without the Edit, Trash and View links", r.ok && r.count === 4 && r.rows[0].title === "How to glaze a mug at home" && r.rows[0].author === "editor", r.rows[0]);
}
{
  const r = await read("stripe-subscriptions.html", "https://dashboard.stripe.com/subscriptions", "table", opts("dashboard.stripe.com", "/subscriptions"));
  check("the Stripe list, an ARIA grid, reads 8 subscriptions with status and amount", r.ok && r.count === 8 && r.rows[1].status === "Past due" && r.rows[1].amount === "$29.00 / month", r.rows[1]);
}
{
  const r = await read("github-issues.html", "https://github.com/excalidraw/excalidraw/issues", "github.issues");
  const top = r.rows[0];
  check("the GitHub list reads 25 issues", r.ok && r.count === 25 && r.onPage === 25, r.count);
  check("the first issue matches the saved page: number, 147 comments, label, date, open", top.number === 4847 && top.comments === 147 && top.labels.join() === "enhancement" && top.created === "2022-02-26T15:37:53.000Z" && top.state === "open", top);
  const drift = await read("github-issues.html", "https://github.com/excalidraw/excalidraw/issues", "github.issues", null, null, h => h.replace(/issue-pr-title-link/g, "title-anchor"));
  check("an issue list whose title marker changed answers drift", drift.ok === false && drift.code === "drift" && drift.seen === 25, drift);
}
{
  const X = reader(page("etsy-grid.html"), ETSY_GRID);
  check("on an Etsy search page the reader picks itself", JSON.stringify(X.detect()) === '["etsy.grid"]');
  check("the number parser keeps absence apart from zero", X.parse.num("(6,824)") === 6824 && X.parse.num("3.8M") === 3800000 && X.parse.num("") === null && X.parse.money("$1,234.50 CAD") === 1234.5 && X.parse.money("12,50 \u20ac") === 12.5 && X.parse.money("free") === null);
  const none = await reader("<html><body><p>hello</p></body></html>", "https://example.com/").read("", {});
  check("a page no reader knows answers no_reader with the list", none.ok === false && none.code === "no_reader" && none.readers.includes("etsy.grid"), none);
  const unknown = await X.read("amazon.bsr", {});
  check("an unknown reader id is refused", unknown.ok === false && unknown.code === "no_reader");
  const w = windowFor(page("etsy-grid.html"), ETSY_GRID);
  const planted = Object.create({ NSP_EXTRACT: { read: () => Promise.resolve({ ok: true, rows: [{ title: "planted" }] }) } });
  Object.assign(planted, { document: w.document, location: w.location, URL, console });
  planted.self = planted;
  vm.createContext(planted);
  vm.runInContext(SRC, planted);
  const own = Object.prototype.hasOwnProperty.call(planted, "NSP_EXTRACT") ? await planted.NSP_EXTRACT.read("etsy.grid", {}) : null;
  check("an element named NSP_EXTRACT on the page cannot stand in for the reader", own && own.ok && own.count === 36, own && own.rows && own.rows[0]);
  check("the reader writes no markup: it may read the page source, never set it", !/\b(?:innerHTML|outerHTML)\s*\+?=(?!=)|insertAdjacentHTML|document\.write|createContextualFragment|DOMParser/.test(SRC) && (SRC.match(/outerHTML/g) || []).length === 2);
}
{
  const fixtures = ["etsy-grid.html", "etsy-shop.html", "etsy-listing.html", "github-issues.html", "shopify-dawn-collection.html", "gsc-performance.html", "shopify-admin-orders.html", "stripe-subscriptions.html", "wp-posts.html"];
  const leaks = fixtures.filter(f => /CaitlynMinimalist|Kate Kim|10204022|masoudshab|etsystatic|click_key|<script(?![^>]*src)[^>]*>[^<]/.test(page(f)));
  check("every fixture says where it came from, and none keeps a real seller, user, image or script", leaks.length === 0 && fixtures.every(f => /<meta name="zerack-fixture" content="(Captured|Synthetic)/.test(page(f))), leaks);
  const catalog = page("shopify-products.json");
  check("the store catalog says where it came from and keeps no brand name, description or image", /^Captured/.test(JSON.parse(catalog).zerackFixture) && !/colourpop|bt21|fourth ray|body_html|cdn\.shopify/i.test(catalog));
}

done("extract");
