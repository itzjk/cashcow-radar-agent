// The business playbooks: their shape, the sources behind every lesson, the fees they pin, the hosts they claim and the gate words they add.
import { load, check, done } from "./engines.mjs";

const C = load(["knowledge/playbooks/etsy.js", "knowledge/playbooks/shopify.js", "knowledge/playbooks/seo.js", "knowledge/playbooks/builders.js", "knowledge/playbooks/index.js", "lib/nsp-gate.js"], { URL });
const E = load(["lib/nsp-extract.js"], { URL, document: { querySelectorAll: () => [], querySelector: () => null, title: "" }, location: { href: "https://example.com/", hostname: "example.com", pathname: "/" } });
C.self = C;
const P = C.NSP_PLAYBOOKS, G = C.NSP_GATE;
const READERS = E.NSP_EXTRACT.readers;
const YT = /you ?tube|faceless|\bniches?\b|\bvph\b|thumbnail|\bchannels?\b|\bshorts\b|\bvideos?\b|views per hour/i;

check("four playbooks load, Etsy, Shopify, SEO and builders", JSON.stringify(P.list().map(p => p.id)) === '["etsy","shopify","seo","builders"]');

for (const pb of P.list()) {
  const lessons = pb.modules.flatMap(m => m.lessons.map(l => ({ m, l })));
  const ids = lessons.map(x => P.shortId(x.l.id));
  check(pb.id + ": every lesson has a unique short id under its module", ids.every(Boolean) && new Set(ids).size === ids.length && lessons.every(x => P.shortId(x.l.id).startsWith(x.m.id.split("-")[0] + "-")), ids);
  check(pb.id + ": every lesson has why, 3 to 5 steps, what to do now and how to check it", lessons.every(x => x.l.why.length > 60 && x.l.steps.length >= 3 && x.l.steps.length <= 5 && x.l.doNow && x.l.proof), lessons.filter(x => !(x.l.steps.length >= 3 && x.l.steps.length <= 5)).map(x => x.l.id));
  check(pb.id + ": every lesson cites at least one https source with its author", lessons.every(x => x.l.sources.length && x.l.sources.every(s => /^https:\/\//.test(s.url) && s.author && s.title)), lessons.filter(x => !x.l.sources.length).map(x => x.l.id));
  check(pb.id + ": every surface a lesson names has a tool line", lessons.every(x => x.l.surfaces.every(s => Object.prototype.hasOwnProperty.call(pb.surfaces, s))), lessons.map(x => x.l.surfaces));
  check(pb.id + ": every hint points at a lesson that exists", pb.hints.every(h => ids.includes(h[1])), pb.hints.map(h => h[1]));
  check(pb.id + ": every reader is one the page readers know", pb.readers.every(r => READERS.includes(r.id) && (r.id !== "table" || (r.opts && r.opts.columns && r.opts.need.every(f => r.opts.columns[f])))), pb.readers.map(r => r.id));
  check(pb.id + ": every gate word list compiles to the kinds the chat can show", pb.gate.press.every(p => P.kinds.includes(p.kind) && new RegExp(p.re.source)) && pb.gate.never.every(n => n.why && new RegExp(n.re.source)));
  check(pb.id + ": four starter asks in plain English that fit a chip", pb.chips.length === 4 && pb.chips.every(c => /^[A-Z][\x20-\x7e]+[a-z?]$/.test(c) && c.length <= 60), pb.chips);
  check(pb.id + ": the primer lists every lesson inside its cap", P.primer(pb).length <= 1900 && ids.every(id => P.primer(pb).includes(id)), P.primer(pb).length);
  check(pb.id + ": the identity names the method and the assumption is stated", /operator/.test(pb.identity) && pb.bottlenecks.length > 40 && /^assume /.test(pb.assume));
  const text = JSON.stringify(pb, (k, v) => v instanceof RegExp ? v.source : v);
  check(pb.id + ": no YouTube word anywhere in the playbook", !YT.test(text), (text.match(YT) || [])[0]);
  check(pb.id + ": no long dash in any text", !/\u2014/.test(text));
}

const hosts = [
  ["www.etsy.com", "/search", "etsy"], ["etsy.com", "/your/orders/sold", "etsy"], ["admin.shopify.com", "/store/x/orders", "shopify"],
  ["northwind.myshopify.com", "/collections/all", "shopify"], ["search.google.com", "/search-console/performance/search-analytics", "seo"],
  ["search.google.com", "/search", ""], ["blog.example.com", "/wp-admin/edit.php", "seo"], ["blog.example.com", "/2026/09/post", ""],
  ["dashboard.stripe.com", "/subscriptions", "builders"], ["github.com", "/owner/repo/issues", "builders"], ["www.producthunt.com", "/posts/x", "builders"],
  ["localhost", "/", "builders"], ["app.localhost", "/", "builders"], ["notetsy.com", "/", ""], ["etsy.com.evil.example", "/", ""], ["www.youtube.com", "/", ""], ["example.com", "/", ""]
];
const wrong = hosts.filter(([h, p, want]) => P.forHost(h, p) !== want);
check("each host and path lands on the right playbook, and look-alike hosts on none", wrong.length === 0, wrong.map(([h, p, w]) => h + p + " -> " + P.forHost(h, p) + " want " + w));
check("a URL finds its playbook too", P.forUrl("https://www.etsy.com/listing/1/x") === "etsy" && P.forUrl("chrome://extensions") === "");
check("a question that names the business finds its playbook with no page open",
  P.forQuery("How do I get more sales on my Etsy shop?") === "etsy" && P.forQuery("Mi tienda de Shopify no vende") === "shopify" && P.forQuery("My SaaS churn is 8% a month") === "builders" && P.forQuery("How do I rank on Google Search Console?") === "seo" && P.forQuery("What should I cook tonight?") === "" && P.forQuery("I run a team of home builders") === "" && P.forQuery("Employee onboarding checklist") === "");

const orders = P.readerFor("shopify", "admin.shopify.com", "/store/x/orders");
check("the Shopify orders list reads with the orders table columns", orders && orders.id === "table" && orders.as === "shopify.orders" && orders.opts.columns.fulfillment.includes("fulfillment status"), orders);
check("the Shopify admin never gets the storefront catalog reader", !P.readerFor("shopify", "admin.shopify.com", "/store/x/settings"), P.readerFor("shopify", "admin.shopify.com", "/store/x/settings"));
check("an Etsy listing, shop and search each get their own reader", P.readerFor("etsy", "www.etsy.com", "/listing/123/x").id === "etsy.listing" && P.readerFor("etsy", "www.etsy.com", "/shop/Northwind").id === "etsy.shop" && P.readerFor("etsy", "www.etsy.com", "/search").id === "etsy.grid");
check("a reader can be asked for by name, table readers included", P.reader("seo", "gsc.queries").opts.need.join() === "clicks,impressions,position" && P.reader("shopify", "shopify.products").id === "shopify.products");

const one = P.lookup("etsy", { lesson: "e1-l2" });
check("a lesson comes back with its steps, tools and sources", one.ok && one.lessons[0].id === "e1-l2" && one.lessons[0].sources[0].includes("https://www.etsy.com/seller-handbook/article/1399426136697") && one.lessons[0].youCanRun.some(t => /zerackPage/.test(t)), one);
check("a module id returns its first two lessons and names the rest", P.lookup("seo", { lesson: "g1" }).lessons.length === 2 && P.lookup("seo", { lesson: "g1" }).alsoRelevant.length === 1);
check("a query finds a lesson when no id fits", P.lookup("builders", { query: "failed payments retries" }).lessons[0].id === "b3-l1");
check("an unknown lesson says how to ask", P.lookup("etsy", { lesson: "e9-l9" }).ok === false && P.lookup("nothing", {}).ok === false);
check("the question picks the lessons: a title question on Etsy", P.lessonsFor("etsy", "Rewrite my listing title").map(l => l.id).join() === "e1-l2");
check("the question picks the lessons: page two on Search Console", P.lessonsFor("seo", "Which pages should I refresh to rank higher?").map(l => l.id).join() === "g1-l2");
check("the question picks the lessons: churn for builders", P.lessonsFor("builders", "Why is my churn so high?").map(l => l.id)[0] === "b3-l1");
check("a question no hint knows adds no lesson", P.lessonsFor("shopify", "hello there").length === 0);

const etsy = P.get("etsy").fees, shop = P.get("shopify").fees;
check("the Etsy fees are the published ones: $0.20, 6.5%, 3% plus $0.25, Offsite Ads 15% or 12% capped at $100",
  etsy.lines[0].fixed === 0.2 && etsy.lines[1].rate === 0.065 && etsy.lines[2].rate === 0.03 && etsy.lines[2].fixed === 0.25 && etsy.offsiteAds.rate === 0.15 && etsy.offsiteAds.bigRate === 0.12 && etsy.offsiteAds.cap === 100 && etsy.checked === "2026-09-26");
check("the Shopify rates are the published ones per plan, with third-party fees and plan prices",
  shop.plans.basic.rate === 0.029 && shop.plans.grow.rate === 0.027 && shop.plans.advanced.rate === 0.025 && shop.plans.plus.rate === 0.0225 && shop.plans.basic.fixed === 0.3 &&
  shop.plans.basic.thirdParty === 0.02 && shop.plans.grow.thirdParty === 0.01 && shop.plans.advanced.thirdParty === 0.006 && shop.plans.basic.monthly === 39 && shop.plans.basic.yearly === 29 && shop.plans.advanced.monthly === 399);
check("Search Console and builders carry no fee table, so no break-even is offered there", P.get("seo").fees === null && P.get("builders").fees === null);

function gate(host, path, name, extra) {
  const rules = P.gateRules(host, path);
  return G.check(Object.assign({ names: [name], host, path, what: 'click "' + name + '"', rules: G.compileRules(rules) }, extra || {}));
}
const kind = r => r.ok ? "free" : (r.code === "needs_press" ? r.kind : "refused");
const cases = [
  ["admin.shopify.com", "/store/x/orders/1001", "Fulfill items", "Fulfill"], ["admin.shopify.com", "/store/x/orders/1001", "Mark as fulfilled", "Fulfill"],
  ["admin.shopify.com", "/store/x/orders/1001", "Capture payment", "Pay"], ["admin.shopify.com", "/store/x/orders/1001", "Mark as paid", "Pay"],
  ["admin.shopify.com", "/store/x/orders/1001", "Send invoice", "Send"], ["admin.shopify.com", "/store/x/orders/1001", "Restock", "Delete"],
  ["admin.shopify.com", "/store/x/settings/account", "Add staff", "refused"], ["admin.shopify.com", "/store/x/products", "Export", "free"],
  ["www.etsy.com", "/your/orders/sold", "Complete order", "Fulfill"], ["www.etsy.com", "/your/orders/sold", "Get shipping labels", "Pay"],
  ["www.etsy.com", "/your/shops/me/tools/listings", "Activate", "Pay"], ["www.etsy.com", "/your/shops/me/tools/listings", "Renew", "Pay"],
  ["www.etsy.com", "/search", "Add to favorites", "free"],
  ["search.google.com", "/search-console/inspect", "Request indexing", "Send"], ["search.google.com", "/search-console/index", "Validate fix", "Send"],
  ["search.google.com", "/search-console/removals", "New request", "Delete"], ["search.google.com", "/search-console/disavow-links", "Disavow links", "refused"],
  ["search.google.com", "/search-console/users", "Add user", "refused"], ["search.google.com", "/search-console/performance", "Export", "free"],
  ["github.com", "/o/r/pull/5", "Merge pull request", "Publish"], ["github.com", "/o/r/issues/5", "Close issue", "Publish"], ["github.com", "/o/r/settings", "Delete this repository", "refused"],
  ["github.com", "/o/r/issues", "Label", "free"], ["www.producthunt.com", "/posts/x", "Upvote", "refused"], ["github.com", "/o/r", "Star", "refused"], ["github.com", "/o/r", "You must be signed in to star a repository", "refused"], ["github.com", "/o/r", "Star this repository (41)", "refused"], ["github.com", "/o/r", "Starred", "refused"], ["github.com", "/o/r", "Watch 3", "refused"], ["www.producthunt.com", "/products/x", "Follow Cashcow Radar", "refused"], ["www.producthunt.com", "/products/x", "Watch the demo", "free"], ["github.com", "/o/r", "Stars", "free"], ["github.com", "/someone", "Follow", "refused"], ["github.com", "/o/r", "Sponsor", "refused"],
  ["news.ycombinator.com", "/item", "add comment", "Send"], ["news.ycombinator.com", "/reply", "reply", "Send"], ["news.ycombinator.com", "/item", "upvote", "refused"], ["github.com", "/o/r/releases/new", "Publish release", "Publish"],
  ["github.com", "/o/r", "Fork", "Publish"], ["github.com", "/o/r/issues/new", "Submit new issue", "Send"], ["github.com", "/o/r/compare/main...x", "Create pull request", "Send"], ["github.com", "/o/r/releases/new", "Save draft", "free"], ["vercel.com", "/team/app", "Redeploy", "Publish"],
  ["x.com", "/messages", "DM", "Send"], ["www.linkedin.com", "/in/x", "Send direct message", "Send"], ["example-shop.com", "/admin/orders/1", "Mark as shipped", "Fulfill"]
];
const off = cases.filter(([h, p, n, want]) => kind(gate(h, p, n)) !== want);
check("each playbook's own words get the press they need, and the rest stay free", off.length === 0, off.map(([h, p, n, w]) => n + " on " + h + " -> " + kind(gate(h, p, n)) + " want " + w));
check("without the Etsy words, Complete order on a checkout is still a payment", kind(G.check({ names: ["Complete order"], host: "shop.example", path: "/checkout", what: "x" })) === "Pay");
check("a playbook never list refuses the link too when it moves money", kind(gate("admin.shopify.com", "/store/x", "Payouts", { link: true })) === "refused");
check("the gate words travel as plain strings, so the worker can hand them to the page", JSON.stringify(P.gateRules("admin.shopify.com", "/store/x")).length > 100 && P.gateRules("admin.shopify.com", "/store/x").press.every(p => typeof p.source === "string"));
check("a site with no playbook sends no words", P.gateRules("example.com", "/").press.length === 0 && P.gateRules("example.com", "/").never.length === 0);
check("Stripe stays read only for the builders playbook", P.readOnly("dashboard.stripe.com", "/subscriptions").playbook === "builders" && P.readOnly("github.com", "/o/r") === null);
check("the registry cannot be replaced or changed", (() => { try { C.NSP_PLAYBOOKS = null; } catch (e) {} try { P.get("etsy").fees.lines[1].rate = 0; } catch (e) {} return C.NSP_PLAYBOOKS === P && P.get("etsy").fees.lines[1].rate === 0.065; })());

done("playbooks");
