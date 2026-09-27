// What the worker makes of the rows a page reader returns: the existing engines on product titles, launch dates and sales, with every number checked by hand.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done, htmlPage } from "./sw-harness.mjs";
import { load } from "./engines.mjs";
import { windowFor } from "./dom-lite.mjs";

const C = load(["knowledge/reverse-engine.js", "lib/nsp-cadencia.js", "lib/nsp-dinero-equilibrio.js", "lib/nsp-business.js", "knowledge/playbooks/etsy.js", "knowledge/playbooks/shopify.js", "knowledge/playbooks/seo.js", "knowledge/playbooks/builders.js", "knowledge/playbooks/index.js"], { URL });
const B = C.NSP_BUSINESS, P = C.NSP_PLAYBOOKS;
const ENGINES = { reverse: C.NSP_REVERSE_ENGINE, cadence: C.NSP_CADENCIA };
const SRC = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");

function read(name, url, id, opts, fetchImpl) {
  const w = windowFor(htmlPage(name), url);
  const ctx = { document: w.document, location: w.location, URL, console, fetch: fetchImpl };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx.NSP_EXTRACT.read(id, opts).then(r => JSON.parse(JSON.stringify(r)));
}
const tableOpts = (host, path) => JSON.parse(JSON.stringify(P.readerFor(P.forHost(host, path), host, path).opts));

check("the reverse engine ranks any row that carries a metric, not only videos", C.NSP_REVERSE_ENGINE.findOutliers([{ title: "a b", metric: 10 }, { title: "c d", metric: 10 }, { title: "e f", metric: 10 }, { title: "g h", metric: 90 }]).count === 1);
check("the cadence engine measures the gaps between any dates", JSON.stringify(C.NSP_CADENCIA.huecos([30, 2, 16, null, 9])) === JSON.stringify({ huecos: [7, 7, 14], cadenciaDias: 7 }));
check("the video cadence still reads the same", C.NSP_CADENCIA.medir([{ views: 10, dias: 1 }, { views: 20, dias: 8 }, { views: 30, dias: 15 }]).cadenciaDias === 7);

{
  const r = B.analyze(await read("etsy-grid.html", "https://www.etsy.com/c/home-and-living", "etsy.grid"), ENGINES);
  const a = r.analysis;
  check("the Etsy page gives the price spread of its 36 cards", a.listings === 36 && a.price.min === 6.6 && a.price.max === 1915 && a.price.median === 102.54, a.price);
  check("and the price where the most reviewed quarter sits", a.priceOfMostReviewed.n === 9 && a.priceOfMostReviewed.median === 24.99, a.priceOfMostReviewed);
  check("ads, Star Sellers and free shipping are counted, not guessed", a.ads.count === 12 && a.starSeller.count === 24 && a.freeShipping.count === 28 && a.reviewsNotShown === 0);
  check("the reverse engine names the words the most reviewed titles share", a.titles.leaders && a.titles.leaders.count === 12 && a.titles.leaders.wordsTheyShare.join() === "gift,wall" && a.titles.leaders.examples[0].metric === 61800, a.titles.leaders);
  check("the most reviewed card leads the list", a.mostReviewed[0].reviews === 61800 && a.mostReviewed[0].price === 14.62);
  check("the line the chat shows carries the numbers", r.line === "36 listings read, median price $102.54 (middle half $37.89 to $178.48, all $6.60 to $1915.00), 12 ads, 24 Star Sellers, the most reviewed quarter has a median price of $24.99.", r.line);
  check("the model gets 12 compact rows and knows 24 more exist", r.rows.length === 12 && r.moreRows === 24 && !("metric" in r.rows[0]) && !("bestseller" in r.rows[0]));
  check("the result fits what the brain passes on for this tool", JSON.stringify(r).length < 9000 && /^\{"ok":true,"reader":"etsy.grid","label":"Etsy listings","count":36,"url":"[^"]+","pageTitle":"[^"]+","line":/.test(JSON.stringify(r)));
}
{
  const r = B.analyze(await read("etsy-shop.html", "https://www.etsy.com/shop/NorthwindJewelry", "etsy.shop"), ENGINES);
  check("a shop gets its sales, opening year and sales per year", r.analysis.shop.sales === 3804382 && r.analysis.shop.since === 2014 && r.analysis.shop.salesPerYear === Math.round(3804382 / (new Date().getUTCFullYear() - 2014)), r.analysis.shop);
  check("the shop line leads with the shop", /^NorthwindJewelry: 3,804,382 sales since 2014; 10 listings read, median price \$33\.75/.test(r.line), r.line);
  check("its titles share a template the reverse engine pulls out", r.analysis.titles.template && /by Northwind Jewelry/.test(r.analysis.titles.template.pattern), r.analysis.titles.template);
  check("no review count was shown on the shop cards, and that is said, not zero", r.analysis.reviews === null && r.analysis.reviewsNotShown === 10);
}
{
  const catalog = htmlPage("shopify-products.json");
  const raw = await read("shopify-dawn-collection.html", "https://store.example/collections/all", "shopify.products", { limit: 250 }, async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => catalog }));
  const now = Date.now;
  Date.now = () => Date.parse("2026-09-26T12:00:00Z");
  C.Date = Date;
  const r = B.analyze(raw, ENGINES);
  Date.now = now;
  const L = r.analysis.launches;
  check("a store catalog gives its launch rhythm from the dates it publishes", L.dated === 120 && L.launchDays === 26 && L.last30 === 23 && L.last90 === 34 && L.daysBetweenLaunches === 14 && L.lastLaunchDaysAgo === 9, L);
  check("and its biggest drop: 26 products on June 24, 94 days back, as a second count in Python found", L.biggestDrop.products === 26 && L.biggestDrop.daysAgo === 94, L.biggestDrop);
  check("prices, sale items and sold out items are counted", r.analysis.price.median === 14 && r.analysis.onSale === 1 && r.analysis.soldOut === 16, r.analysis);
  check("the catalog line says what a rival launches and how often", /^120 products, median price \$14\.00, 23 launched in the last 30 days, a new batch every 14 days, the last one 9 days ago, 1 on sale\.$/.test(r.line), r.line);
}
{
  const gscRead = await read("gsc-performance.html", "https://search.google.com/search-console/performance/search-analytics", "table", tableOpts("search.google.com", "/search-console/x"));
  const gscRows = JSON.parse(JSON.stringify(gscRead.rows));
  const r = B.analyze(gscRead, ENGINES);
  const a = r.analysis;
  check("Search Console totals are the sum of the rows", a.clicks === 1778 && a.impressions === 69485 && a.ctr === 2.56, a);
  check("rows under 200 impressions are not judged", a.tooFewImpressions === 2 && a.judged === 16 && a.minimumImpressions === 200);
  check("page two lists positions 8 to 20 by impressions", a.pageTwo.map(x => x.name).join("|") === "personalized coffee mug|custom mug|custom mug gift for dad|large coffee mug 20 oz|speckled mug|birthday mug", a.pageTwo.map(x => x.name));
  check("seen and not clicked compares a row with this site's own rows at a similar position", a.seenNotClicked.length === 1 && a.seenNotClicked[0].name === "large coffee mug 20 oz" && a.seenNotClicked[0].ctr === 0.2 && a.seenNotClicked[0].ctrOfSimilar === 1.1, a.seenNotClicked);
  check("a query under 200 impressions at position 9.9 is never put on page two", !a.pageTwo.some(x => x.name === "blue glazed mug"));
  const bare = B.analyze({ ok: true, reader: "gsc.queries", rows: gscRows.map(x => ({ query: x.query, clicks: x.clicks, impressions: x.impressions })) }, ENGINES);
  check("with Average position off, the totals still read and the line says to turn it on", bare.analysis.clicks === 1778 && bare.analysis.positionShown === false && bare.analysis.pageTwo.length === 0 && /turn it on above the chart/.test(bare.line), bare.line);
}
{
  const r = B.analyze(await read("shopify-admin-orders.html", "https://admin.shopify.com/store/northwind-demo/orders", "table", tableOpts("admin.shopify.com", "/store/x/orders")), ENGINES);
  check("the orders list gives the paid orders still waiting, oldest last", r.analysis.paidNotFulfilled.map(x => x.order).join() === "#1024,#1023,#1018,#1017" && r.analysis.total === 553.5, r.analysis.paidNotFulfilled);
  check("a pending payment is not counted as waiting to ship", !r.analysis.paidNotFulfilled.some(x => x.order === "#1021"));
}
{
  const r = B.analyze(await read("stripe-subscriptions.html", "https://dashboard.stripe.com/subscriptions", "table", tableOpts("dashboard.stripe.com", "/subscriptions")), ENGINES);
  check("the past due subscriptions add up to $128 a month", r.analysis.pastDuePerMonth === 128 && r.analysis.pastDue.length === 2, r.analysis);
  check("a yearly plan counts a twelfth a month", r.analysis.activePerMonth === 181.17, r.analysis.activePerMonth);
}
{
  const r = B.analyze(await read("github-issues.html", "https://github.com/excalidraw/excalidraw/issues", "github.issues"), ENGINES);
  const g = r.analysis.repeated;
  check("the requests that repeat are grouped, and the repository name is not one of them", g[0].word === "text" && g[0].issues === 3 && g[0].comments === 96 && !g.some(x => x.word === "excalidraw"), g.slice(0, 3));
  check("the table request carries both its issues and 165 comments", g.some(x => x.word === "table" && x.issues === 2 && x.comments === 165 && x.numbers.includes(4847)));
  check("labels are counted", r.analysis.labels[0].name === "enhancement" && r.analysis.labels[0].count === 16);
}
{
  const etsy = P.get("etsy"), shop = P.get("shopify");
  const eq = C.NspDineroEquilibrio;
  const a = B.breakEven({ price: 30, cost: 9, shipCost: 4.5 }, etsy, eq);
  check("a $30 Etsy sale pays $0.20 + $1.95 + $1.15 in fees", a.ok && a.fees.map(f => f.amount).join() === "0.2,1.95,1.15" && a.feesTotal === 3.3, a.fees);
  check("and leaves $13.20 after $13.50 of cost, so an ad can cost $13.20 at most, a break-even ROAS of 2.27", a.marginPerSale === 13.2 && a.maxAdPerSale === 13.2 && a.breakEvenRoas === 2.27 && a.estimate === true, a);
  check("each fee names the page it comes from", a.fees.every(f => /^https:\/\/(www|help)\.etsy\.com\//.test(f.source)));
  const o = B.breakEven({ price: 30, cost: 9, shipCost: 4.5, offsiteAds: true }, etsy, eq);
  check("an Offsite Ads order adds 15% of the order", o.fees[3].amount === 4.5 && o.marginPerSale === 8.7);
  const capped = B.breakEven({ price: 1000, cost: 300, offsiteAds: true, bigShop: true }, etsy, eq);
  check("the Offsite Ads fee stops at $100 an order, 12% for a big shop", capped.fees[3].amount === 100, capped.fees[3]);
  const s = B.breakEven({ price: 40, cost: 14, shipCost: 6, salesPerMonth: 20 }, shop, eq);
  check("a $40 Shopify order on Basic pays 2.9% plus 30 cents", s.fees[0].amount === 1.46 && s.marginPerSale === 18.54 && s.breakEvenRoas === 2.16, s);
  check("the $39 plan is a fixed cost that 3 orders a month cover, and 20 orders leave $331.80", s.fixedMonthly === 39 && s.salesToCoverFixed === 3 && s.monthResult === 331.8 && s.covers === true, s);
  const same = eq.equilibrio({ ingresoPorVideo: 40, costePorVideo: 21.46, costeFijoMes: 39, videosPorMes: 20 });
  check("those numbers are the break-even engine's own", same.margenPorVideo === s.marginPerSale && same.videosParaCubrirFijo === s.salesToCoverFixed && same.resultadoMes === s.monthResult);
  const yearly = B.breakEven({ price: 40, cost: 14, plan: "grow", billing: "yearly" }, shop, eq);
  check("the Grow plan billed yearly is 2.7% and $79 a month", yearly.fees[0].amount === 1.38 && yearly.fixedMonthly === 79, yearly);
  const third = B.breakEven({ price: 40, cost: 14, thirdParty: true }, shop, eq);
  check("with a third-party provider and no rate given, it asks instead of counting that fee as zero", third.ok === false && third.code === "missing" && third.missing[0] === "providerRate", third);
  const withRate = B.breakEven({ price: 40, cost: 14, thirdParty: true, providerRate: 2.9, providerFixed: 0.3 }, shop, eq);
  check("with the provider rate it adds Shopify's 2% on top", withRate.fees.map(f => f.amount).join() === "0.8,1.46", withRate.fees);
  check("no price or no cost, no break-even", B.breakEven({ price: 30 }, etsy, eq).code === "missing" && B.breakEven({ cost: 3 }, etsy, eq).missing.join() === "price");
  check("a business with no fee table says so", B.breakEven({ price: 30, cost: 3 }, P.get("seo"), eq).code === "no_fees");
  const loss = B.breakEven({ price: 10, cost: 9 }, etsy, eq);
  check("a sale that loses money says so and allows no ad spend", loss.marginPerSale < 0 && loss.maxAdPerSale === 0 && loss.breakEvenRoas === null && /loses money before any ad/.test(loss.line), loss.line);
}
{
  const url = "https://www.etsy.com/search?q=oak+board&ref=search_bar&click_key=abc&page=2";
  check("a page is remembered by its reader and address, without tracking parameters", B.seriesKey(url, "etsy.grid") === "etsy.grid|https://www.etsy.com/search?page=2&q=oak%20board", B.seriesKey(url, "etsy.grid"));
  const first = await read("etsy-grid.html", url, "etsy.grid");
  first.host = "www.etsy.com"; first.playbook = "etsy";
  const a1 = B.analyze(first, ENGINES);
  const s1 = B.snapshot(first, a1, Date.parse("2026-09-20T10:00:00Z"));
  check("a read leaves a snapshot of its numbers and listing ids", s1.metrics.count === 36 && s1.metrics.priceMedian === 102.54 && s1.metrics.ads === 12 && s1.ids.length === 36 && s1.host === "www.etsy.com", s1.metrics);
  const later = await (async () => {
    const w = windowFor(htmlPage("etsy-grid.html").replace(/<li class="wt-list-unstyled[^>]*>\s*<div\s+class="js-merch-stash-check-listing v2-listing-card[\s\S]*?<\/li>/, "").replace(/<li class="wt-list-unstyled[^>]*>\s*<div\s+class="js-merch-stash-check-listing v2-listing-card[\s\S]*?<\/li>/, ""), url);
    const ctx = { document: w.document, location: w.location, URL, console };
    ctx.self = ctx; vm.createContext(ctx); vm.runInContext(SRC, ctx);
    return JSON.parse(JSON.stringify(await ctx.NSP_EXTRACT.read("etsy.grid", {})));
  })();
  const s2 = B.snapshot(later, B.analyze(later, ENGINES), Date.parse("2026-09-23T10:00:00Z"));
  const d = B.compare(s1, s2);
  check("the next read of the same page says what changed and when", d && d.when === "3 days ago" && d.changes.includes("rows 34 (was 36)") && d.changes.includes("2 gone") && d.changes.includes("ads 10 (was 12)"), d);
  check("its line starts with the time since the last read", /^Since the last read 3 days ago: /.test(d.line), d.line);
  check("an unchanged page says so", B.compare(s1, Object.assign({}, s1, { at: s1.at + 3600000 })).line === "Since the last read 1 hour ago: nothing changed.");
  check("two different pages are never compared", B.compare(s1, Object.assign({}, s1, { key: "etsy.grid|https://www.etsy.com/search?q=walnut" })) === null);
  const g1 = { ok: true, reader: "table", url: "https://search.google.com/search-console/performance?resource_id=x", rows: [{ query: "oak board", clicks: 10, impressions: 900, ctr: 1.1, position: 12.4 }, { query: "oak tray", clicks: 5, impressions: 300, ctr: 1.7, position: 6.1 }] };
  g1.reader = "gsc.queries";
  const g2 = JSON.parse(JSON.stringify(g1)); g2.rows[0].position = 8.2; g2.rows[0].clicks = 31;
  const gs1 = B.snapshot(g1, B.analyze(g1, ENGINES), 0), gs2 = B.snapshot(g2, B.analyze(g2, ENGINES), 7 * 86400000);
  const gd = B.compare(gs1, gs2);
  check("on Search Console it names the query that moved and by how much", gd.changes.some(c => c === '"oak board" position 8.2 (was 12.4)') && gd.changes.includes("clicks 36 (was 15)") && gd.when === "7 days ago", gd.changes);
  const out = B.analyze(first, ENGINES);
  out.sinceLast = d;
  check("the change reaches the model before the rows", JSON.stringify(out).indexOf('"sinceLast"') < JSON.stringify(out).indexOf('"rows"'));
}
check("a failed read passes through untouched", B.analyze({ ok: false, code: "drift", error: "x" }, ENGINES).code === "drift");

done("business");
