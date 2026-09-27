// The builder page readers on captured and synthetic pages: repository, commit feed, releases, traffic, Hacker News, Reddit, Product Hunt, npm, PyPI, the Chrome Web Store and dashboard tiles. Each number is checked by hand against the saved page, and a changed page answers drift, never a zero.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done, htmlPage } from "./sw-harness.mjs";
import { load } from "./engines.mjs";
import { windowFor } from "./dom-lite.mjs";

const SRC = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");
const page = n => htmlPage(n);
const plain = o => JSON.parse(JSON.stringify(o));
const C = load(["lib/nsp-cadencia.js", "knowledge/reverse-engine.js", "lib/nsp-business.js", "knowledge/playbooks/etsy.js", "knowledge/playbooks/shopify.js", "knowledge/playbooks/seo.js", "knowledge/playbooks/builders.js", "knowledge/playbooks/index.js"], { URL });
const B = C.NSP_BUSINESS, P = C.NSP_PLAYBOOKS;
const ENGINES = { cadence: C.NSP_CADENCIA, reverse: C.NSP_REVERSE_ENGINE };

function reader(html, url, fetchImpl) {
  const w = windowFor(html, url);
  const ctx = { document: w.document, location: w.location, URL, console, fetch: fetchImpl };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "lib/nsp-extract.js" });
  return ctx.NSP_EXTRACT;
}
const read = async (html, url, id, opts, fetchImpl) => plain(await reader(html, url, fetchImpl).read(id, opts || {}));
const analyzed = (r, host) => { r.host = host; r.playbook = "builders"; const a = B.analyze(r, ENGINES); return { a, s: B.snapshot(r, a, Date.parse("2026-09-27T10:00:00Z")) }; };

const REPO = "https://github.com/itzjk/cashcow-radar-agent";
const ATOM = page("github-commits.atom");
const EMPTY_FEED = '<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Release notes from cashcow-radar-agent</title></feed>';
const asked = [];
function feeds(map) {
  return (url, init) => {
    asked.push({ url: String(url), init });
    const hit = Object.keys(map).find(k => String(url).endsWith(k));
    if (!hit) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("Not Found") });
    const v = map[hit];
    return Promise.resolve(typeof v === "number" ? { ok: false, status: v, text: () => Promise.resolve("") } : { ok: true, status: 200, text: () => Promise.resolve(v) });
  };
}

{
  asked.length = 0;
  const r = await read(page("github-repo.html"), REPO, "github.repo", {}, feeds({ "/commits.atom": ATOM, "/releases.atom": EMPTY_FEED }));
  const f = r.repo;
  check("the repository reads its counts as the page shows them: 0 stars, 0 forks, 0 watchers, 0 open issues and pull requests, 40 commits", r.ok && f.stars === 0 && f.forks === 0 && f.watchers === 0 && f.openIssues === 0 && f.openPulls === 0 && f.commits === 40 && f.issuesOff === false, f);
  check("a zero on the page is read as zero, not as unknown", f.stars === 0 && f.stars !== null);
  check("it reads the description, license, branch, creation date and that no release is published", /^Real YouTube intelligence in your browser: views per hour/.test(f.description) && f.license === "MIT" && f.branch === "main" && f.created === "2026-09-11T03:34:54.000Z" && f.releases === 0 && f.tags === 0, f);
  check("it reads the README headings in order", f.headings.length === 10 && f.headings[0].text === "cashcow-radar-agent" && f.headings[0].level === 1 && f.headings[9].text === "License", f.headings);
  check("the commits come from the public feed of the same repository: 20, newest first", r.count === 20 && r.rows[0].sha === "258ae02" && /^Saved channels and scan memory keep their shape/.test(r.rows[0].subject) && r.rows[0].at === "2026-09-25T06:39:32.000Z" && r.rows[0].author === "itzjk", r.rows[0]);
  check("the full commit message is read, not the feed's cut title", r.rows[0].subject.endsWith("stops calling chrome.runtime") && r.rows[0].body.length > 200);
  check("the feeds are asked for on the same site, without cookies", asked.length === 2 && asked.every(a => a.url.startsWith(REPO + "/") && a.init.credentials === "omit"), asked.map(a => a.url));
  check("the page says which feeds it read", r.feeds.commits === "read" && r.feeds.releases === "read" && r.releaseList.length === 0);
  check("the repository page is detected as a repository", reader(page("github-repo.html"), REPO).detect().join() === "github.repo");
  const { a, s } = analyzed(r, "github.com");
  check("the analysis line gives the counts, the pace of commits and the release state", /^itzjk\/cashcow-radar-agent: 0 stars, 0 forks, 0 open issues, 0 open pull requests, 40 commits, \d+ commits in the last 7 days, the last \d+ days ago, no release published yet\.$/.test(a.line), a.line);
  check("the snapshot keeps stars, forks, watchers, issues, pull requests and commits as numbers", JSON.stringify(s.metrics) === '{"stars":0,"forks":0,"watchers":0,"openIssues":0,"openPulls":0,"commits":40}', s.metrics);
  check("and the repository facts and the commits as items for the builder work", s.facts.url === REPO && s.facts.license === "MIT" && /What is here that is not anywhere else/.test(s.facts.headings) && s.items.length === 20 && s.items[0].kind === "commit" && s.items[0].id === "258ae02", s.facts);
  const noIssues = await read(page("github-repo.html").replace(/<span[^>]*id="issues-repo-tab-count"[^>]*>[^<]*<\/span>/, ""), REPO, "github.repo", {}, feeds({}));
  check("a repository with issues switched off says so instead of zero", noIssues.ok && noIssues.repo.openIssues === null && noIssues.repo.issuesOff === true && /issues switched off/.test(B.analyze(Object.assign(noIssues, { host: "github.com" }), ENGINES).line), noIssues.repo);
  check("feeds that are not public are said to be hidden", noIssues.feeds.commits === "not public (HTTP 404)" && noIssues.count === 0);
  const drifted = await read(page("github-repo.html").replace(/repo-stars-counter-star|repo-network-counter/g, "x-counter").replace(/"sidebarAbout"|"commitCount"/g, '"other"'), REPO, "github.repo", {}, feeds({}));
  check("a repository page whose counters and data are gone answers drift, never zeros", drifted.ok === false && drifted.code === "drift" && !drifted.repo, drifted);
  const sub = await read(page("github-repo.html").replace(/"sidebarAbout":\{"description":"[^"]*",/, '"sidebarAbout":{'), REPO + "/issues", "github.repo", {}, feeds({}));
  check("on a subpage the description is not taken from the page's meta text", sub.ok && sub.repo.description === "", sub.repo && sub.repo.description);
  const hydrated = page("github-repo.html").replace("</main>", '<div><h2><span><a data-component="Link" href="/itzjk/cashcow-radar-agent/graphs/contributors" data-discover="true"><span>Contributors</span></a><span aria-hidden="true" data-variant="secondary" data-component="CounterLabel" class="ml-1">1</span></span></h2></div><div><h2><span>Languages</span></h2><span data-component="ProgressBar.Item" role="progressbar" aria-label="JavaScript: 91.4%"></span><span data-component="ProgressBar.Item" role="progressbar" aria-label="HTML: 5.1%"></span></div></main>');
  const h = await read(hydrated, REPO, "github.repo", {}, feeds({}));
  check("once the sidebar has loaded, the contributors and languages read too (markup of the live page of 2026-09-27)", h.ok && h.repo.contributors === 1 && JSON.stringify(h.repo.languages) === '[{"name":"JavaScript","pct":91.4},{"name":"HTML","pct":5.1}]', h.repo && { c: h.repo.contributors, l: h.repo.languages });
  check("before it loads they stay unknown, not zero", r.repo.contributors === null && r.repo.languages.length === 0);
  const elsewhere = await read("<html><body><h1>Pricing</h1></body></html>", "https://github.com/pricing", "github.repo");
  check("a GitHub page that is not a repository says so", elsewhere.code === "not_this_page", elsewhere);
}

{
  asked.length = 0;
  const r = await read(page("github-repo.html"), REPO + "/commits/main", "github.commits", {}, feeds({ "/commits/main.atom": ATOM }));
  check("the commits page reads the feed of its own branch", r.ok && r.count === 20 && asked[0].url === REPO + "/commits/main.atom", asked.map(a => a.url));
  const hidden = await read(page("github-repo.html"), REPO + "/commits/main", "github.commits", {}, feeds({}));
  check("a private repository's feed answers not_exposed: hidden, not empty", hidden.ok === false && hidden.code === "not_exposed" && /hidden, not empty/.test(hidden.error), hidden);
  const html = await read(page("github-repo.html"), REPO + "/commits/main", "github.commits", {}, feeds({ "/commits/main.atom": "<html><body>Sign in</body></html>" }));
  check("a feed address that answers with a web page is drift", html.ok === false && html.code === "drift", html);
  const { a, s } = analyzed(r, "github.com");
  check("the commits analysis counts by day and names the last one", /^20 commits read, \d+ in the last 24 hours and \d+ in the last 7 days, the last "Saved channels and scan memory/.test(a.line) && s.items.length === 20 && s.facts.repo === "cashcow-radar-agent", a.line);
}

{
  const rel = '<?xml version="1.0"?><feed><entry><id>tag:github.com,2008:Repository/1/v0.3.0</id><updated>2026-09-17T10:00:00Z</updated><link rel="alternate" type="text/html" href="https://github.com/zerack-demo/clipmeter/releases/tag/v0.3.0"/><title>v0.3.0</title><content type="html">&lt;p&gt;Rivals and &lt;b&gt;watch&lt;/b&gt;.&lt;/p&gt;</content><author><name>maker</name></author></entry><entry><id>x</id><updated>2026-09-01T10:00:00Z</updated><link rel="alternate" type="text/html" href="https://github.com/zerack-demo/clipmeter/releases/tag/v0.2.0"/><title>v0.2.0</title><content type="html">First.</content></entry></feed>';
  const r = await read("<html><body></body></html>", "https://github.com/zerack-demo/clipmeter/releases", "github.releases", {}, feeds({ "/releases.atom": rel }));
  check("releases read their name, tag, date and notes as text", r.ok && r.count === 2 && r.rows[0].tag === "v0.3.0" && r.rows[0].at === "2026-09-17T10:00:00.000Z" && r.rows[0].notes === "Rivals and watch.", r.rows[0]);
  const tags = await read("<html><body></body></html>", "https://github.com/zerack-demo/clipmeter/releases", "github.releases", {}, feeds({ "/releases.atom": EMPTY_FEED, "/tags.atom": rel.replace(/releases\/tag/g, "releases/tag") }));
  check("with no release published the tags stand in, and say so", tags.ok && tags.rows.length === 2 && tags.rows.every(x => x.tagOnly) && /no releases are published; these are the tags/.test(tags.note), tags);
  const none = await read("<html><body></body></html>", REPO + "/releases", "github.releases", {}, feeds({ "/releases.atom": EMPTY_FEED, "/tags.atom": EMPTY_FEED }));
  check("with neither it says no release and no tag yet", none.ok && none.count === 0 && /no releases and no tags are published yet/.test(none.note) && B.analyze(Object.assign(none, { host: "github.com" }), ENGINES).line === "No releases and no tags are published yet.");
}

{
  const r = await read(page("github-traffic.html"), "https://github.com/zerack-demo/clipmeter/graphs/traffic", "github.traffic");
  check("the traffic page reads clones, cloners, views and unique visitors", r.ok && JSON.stringify(r.totals) === '{"clones":48,"cloners":21,"views":1204,"visitors":388}', r.totals);
  check("and the referring sites and popular content with their counts", r.rows.length === 4 && r.rows[0].site === "news.ycombinator.com" && r.rows[0].views === 610 && r.rows[0].unique === 220 && r.popular.length === 2 && r.popular[0].views === 702, r);
  const { a, s } = analyzed(r, "github.com");
  check("the traffic line names the 14 days, the totals and the top referrer", a.line === "In the last 14 days: 1,204 views from 388 unique visitors, 48 clones by 21 unique cloners, top referrer news.ycombinator.com (610 views).", a.line);
  check("the snapshot keeps the four totals", JSON.stringify(s.metrics) === '{"views":1204,"visitors":388,"clones":48,"cloners":21}');
  const gone = await read("<html><body><h2>Traffic</h2><p>Loading</p></body></html>", "https://github.com/o/r/graphs/traffic", "github.traffic");
  check("a traffic page that shows no number is drift", gone.code === "drift");
}

{
  const r = await read(page("hn-item.html"), "https://news.ycombinator.com/item?id=41000100", "hn.item");
  check("a Show HN thread reads the story: title, link, points, author, age and comment count", r.ok && r.showHn === true && r.story.points === 87 && r.story.comments === 11 && r.story.by === "radar_maker" && r.story.at === "2026-09-25T14:40:00.000Z" && r.story.url === "https://github.com/itzjk/cashcow-radar-agent" && r.story.site === "github.com/itzjk", r.story);
  check("and the maker's text under it", /^I built this to see which niches are moving/.test(r.story.text));
  check("every comment reads with its author, time, depth, text and link", r.count === 11 && r.rows[0].by === "kestrel_dev" && r.rows[0].depth === 0 && r.rows[1].depth === 1 && r.rows[0].url === "https://news.ycombinator.com/item?id=41000101" && /Any plans for Firefox support\?/.test(r.rows[0].text), r.rows.slice(0, 2));
  const { a, s } = analyzed(r, "news.ycombinator.com");
  check("the thread line counts points, comments, asks and questions", /^Show HN thread "Show HN: Cashcow Radar .* 87 points, 11 comments; 11 comments read, \d+ ask for something and \d+ end in a question\.$/.test(a.line), a.line);
  check("the snapshot keeps points and comments, the story and the comments as items", s.metrics.points === 87 && s.metrics.comments === 11 && s.items[0].kind === "story" && s.items.length === 12 && s.facts.showHn === "yes" && s.facts.url === "https://github.com/itzjk/cashcow-radar-agent", s.facts);
  const drifted = await read(page("hn-item.html").replace(/commtext/g, "ctext"), "https://news.ycombinator.com/item?id=41000100", "hn.item");
  check("comments that no longer read answer drift", drifted.code === "drift" && drifted.seen === 11, drifted);
}

{
  const r = await read(page("hn-list.html"), "https://news.ycombinator.com/show", "hn.list");
  check("a Show HN list reads every story with rank, points, comments and link", r.ok && r.count === 5 && r.rows[2].rank === 3 && r.rows[2].points === 87 && r.rows[2].comments === 11 && r.rows[2].item === "https://news.ycombinator.com/item?id=41000100", r.rows[2]);
  check("the list line gives the median points and how many are Show HN", B.analyze(Object.assign(r, { host: "news.ycombinator.com" }), ENGINES).line === "5 stories on screen, median 87 points, 5 of them Show HN.");
  const drifted = await read(page("hn-list.html").replace(/titleline/g, "tline").replace(/class="title"/g, 'class="t"'), "https://news.ycombinator.com/show", "hn.list");
  check("a list whose rows no longer read answers drift", drifted.code === "drift", drifted);
}

{
  const r = await read(page("reddit-thread.html"), "https://www.reddit.com/r/NewTubers/comments/1xyzab/any_tool_for_views_per_hour/", "reddit.thread");
  check("a Reddit thread reads the post: title, score, comments, community and author", r.ok && r.story.title === "Any tool for views per hour on YouTube?" && r.story.points === 58 && r.story.comments === 4 && r.story.community === "r/NewTubers" && r.story.by === "gridwalker", r.story);
  check("each comment reads its own text, not its replies, with depth and score", r.count === 4 && r.rows[1].by === "shortform_sam" && !/ideally/.test(r.rows[1].text) && r.rows[2].depth === 1 && r.rows[2].points === 6, r.rows);
  const drifted = await read(page("reddit-thread.html").replace(/slot="comment"/g, 'slot="body"'), "https://www.reddit.com/r/NewTubers/comments/1xyzab/x/", "reddit.thread");
  check("comments whose text no longer reads answer drift", drifted.code === "drift", drifted);
}

{
  const r = await read(page("ph-product.html"), "https://www.producthunt.com/products/cashcow-radar", "ph.product");
  const p = r.product;
  check("a Product Hunt page reads name, tagline, upvotes, day rank, reviews, rating and followers", r.ok && p.name === "Cashcow Radar" && p.tagline === "Real YouTube intelligence in your browser" && p.upvotes === 264 && p.dayRank === 4 && p.reviews === 14 && p.rating === 4.79 && p.followers === 312, p);
  check("and every comment with its author, votes, time and anchor", r.count === 5 && r.rows[1].by === "Ana Ruiz" && r.rows[1].points === 4 && r.rows[1].at === "2026-09-26T09:14:00.000Z" && /#comment-9100002$/.test(r.rows[1].url), r.rows[1]);
  const { a, s } = analyzed(r, "www.producthunt.com");
  check("the line and the snapshot keep the launch numbers", a.line === "Cashcow Radar, 264 upvotes, day rank #4, 14 reviews at 4.79, 312 followers, 5 comments read." && s.metrics.upvotes === 264 && s.items.length === 5 && s.items[1].n === 4, a.line);
  const drifted = await read(page("ph-product.html").replace(/prose|richText/g, "x"), "https://www.producthunt.com/products/cashcow-radar", "ph.product");
  check("comments without their text answer drift", drifted.code === "drift", drifted);
}

{
  const r = await read(page("npm-package.html"), "https://www.npmjs.com/package/react", "npm.package");
  check("an npm page reads weekly downloads, version, license, size, files, last publish, dependents and versions", r.ok && JSON.stringify(r.pkg) === '{"name":"react","weeklyDownloads":82157965,"version":"19.2.4","license":"MIT","unpackedSize":"172 kB","files":27,"lastPublish":"2026-02-25T16:39:15.198Z","dependencies":0,"dependents":206431,"versions":2735}', r.pkg);
  check("the npm line gives the downloads and the dependents", B.analyze(Object.assign(r, { host: "www.npmjs.com" }), ENGINES).line === "react: 82,157,965 weekly downloads, version 19.2.4 published 2026-02-25, 206,431 dependents.");
  const drifted = await read(page("npm-package.html").replace(/Weekly Downloads/g, "Downloads").replace(/>Version</g, ">Release<"), "https://www.npmjs.com/package/react", "npm.package");
  check("an npm page whose labels changed answers drift", drifted.code === "drift", drifted);
}

{
  const r = await read(page("pypi-project.html"), "https://pypi.org/project/requests/", "pypi.package");
  check("a PyPI page reads name, version, summary, release date and the release history", r.ok && r.pkg.name === "requests" && r.pkg.version === "2.32.5" && r.pkg.summary === "Python HTTP for Humans." && r.pkg.released === "2025-08-18T20:46:00.000Z" && r.count === 24 && r.rows[0].version === "2.32.5", r.pkg);
  check("the PyPI line gives the release pace", /^requests 2\.32\.5 released 2025-08-18, 24 releases, one every \d+ days lately\.$/.test(B.analyze(Object.assign(r, { host: "pypi.org" }), ENGINES).line));
}

{
  const E = reader("<html></html>", "https://example.com/");
  const c = E.text.cws(page("cws-listing.html"), "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh");
  check("a Chrome Web Store listing reads users, rating, ratings, version, update date and publisher from its text", c.ok && JSON.stringify(c.listing) === '{"name":"uBlock Origin Lite","id":"ddkjiahejlhfcafbddmgiahcphecmpfh","users":21000000,"usersApprox":false,"rating":4.5,"ratings":3600,"ratingsApprox":true,"version":"2026.920.1710","updated":"2026-09-21","featured":true,"offeredBy":"Raymond Hill (gorhill)"}', c.listing);
  check("the rating of a related item further down is not taken", c.listing.rating === 4.5 && c.listing.users === 21000000);
  check("a store page with neither users nor rating is drift", E.text.cws("<html><head><title>X - Chrome Web Store</title></head><body><div>Something</div></body></html>", "https://chromewebstore.google.com/detail/x/abcdefghijklmnopabcdefghijklmnop").code === "drift");
  const r = { ok: true, reader: "cws.listing", label: "Chrome Web Store listing", rows: [], count: 0, listing: c.listing, url: "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh", host: "chromewebstore.google.com" };
  const { a, s } = analyzed(r, "chromewebstore.google.com");
  check("the listing line and snapshot keep users and ratings", a.line === "uBlock Origin Lite: 21,000,000 users, 4.5 out of 5 from about 3,600 ratings, version 2026.920.1710 updated 2026-09-21." && s.metrics.users === 21000000, a.line);
}

{
  const opts = plain(P.readerFor("builders", "dashboard.stripe.com", "/test/dashboard").opts);
  const r = await read(page("stripe-home.html"), "https://dashboard.stripe.com/test/dashboard", "tiles", opts);
  check("the Stripe-like home reads every tile by its label: volumes, MRR, customers, subscribers, churn, failed payments, revenue per user", r.ok && r.reader === "stripe.home" && JSON.stringify(r.tiles) === '{"grossVolume":12480,"netVolume":11902.35,"mrr":3140,"newCustomers":38,"activeSubscribers":212,"churnRate":4.2,"failedPayments":7,"arpu":14.81}' && r.range === "Last 30 days", r);
  const { a, s } = analyzed(r, "dashboard.stripe.com");
  check("the tiles line reads like the dashboard", a.line === "Stripe overview, last 30 days: gross volume $12480.00, net volume $11902.35, MRR $3140.00, new customers 38, active subscribers 212, churn rate 4.2%, failed payments 7, revenue per user $14.81." && s.metrics.mrr === 3140, a.line);
  const partial = await read(page("stripe-home.html").replace("Churn rate", "Churn"), "https://dashboard.stripe.com/test/dashboard", "tiles", opts);
  check("a tile whose label is not on screen is listed as not shown, never zero", partial.ok && partial.tiles.churnRate === undefined && partial.notShown.includes("churnRate"), partial.notShown);
  const noNumbers = await read(page("stripe-home.html").replace(/<div class="v">[^<]*<\/div>/g, '<div class="v">Loading</div>'), "https://dashboard.stripe.com/test/dashboard", "tiles", opts);
  check("labels with no numbers next to them answer drift", noNumbers.code === "drift", noNumbers);
  check("a page with none of the labels says it is not this page", (await read("<html><body><p>Hello</p></body></html>", "https://dashboard.stripe.com/test/dashboard", "tiles", opts)).code === "not_this_page");
  const need = await read(page("stripe-home.html").replace("MRR", "Recurring"), "https://dashboard.stripe.com/test/dashboard", "tiles", Object.assign({}, opts, { need: ["mrr"] }));
  check("a tile the caller needs that does not read is drift", need.code === "drift" && need.missing[0] === "mrr", need);
}

{
  const E = reader("<html></html>", "https://example.com/");
  check("the parsers are shared as text functions for the worker", ["atom", "commits", "releases", "githubRepo", "cws", "npm", "pypi", "lines"].every(k => typeof E.text[k] === "function"));
  const commits = E.text.commits(E.text.atom(ATOM));
  check("the Atom parser reads entries, links and escaped content", commits.length === 20 && commits.every(c => /^[0-9a-f]{7}$/.test(c.sha) && /^https:\/\/github\.com\/itzjk\/cashcow-radar-agent\/commit\//.test(c.url)) && !commits.some(c => /&lt;|&amp;|<pre/.test(c.subject + c.body)), commits.slice(0, 2));
  check("merge commits are marked", E.text.commits(E.text.atom('<feed><entry><id>Grit::Commit/abcdef1234</id><title>Merge pull request #3 from a/b</title><updated>2026-09-01T00:00:00Z</updated><link rel="alternate" href="https://github.com/o/r/commit/abcdef1234"/><content type="html">Merge pull request #3 from a/b</content></entry></feed>'))[0].merge === true);
  check("entities decode, and a surrogate or out-of-range number stays as written", E.text.lines("<p>a &amp; b &#x1F680; &#55357; &#x110000;</p>")[0] === "a & b 🚀 &#55357; &#x110000;");
  const detect = (u, h) => reader(h || "<html></html>", u).detect().join();
  check("detection maps each page to its reader", detect("https://news.ycombinator.com/item?id=1") === "hn.item" && detect("https://news.ycombinator.com/show") === "hn.list" && detect("https://news.ycombinator.com/") === "hn.list" && detect("https://www.reddit.com/r/x/comments/1/y/") === "reddit.thread" && detect("https://www.producthunt.com/products/x") === "ph.product" && detect("https://www.npmjs.com/package/x") === "npm.package" && detect("https://pypi.org/project/x/") === "pypi.package" && detect("https://github.com/o/r/graphs/traffic") === "github.traffic" && detect("https://github.com/o/r/releases") === "github.releases" && detect("https://github.com/o/r/tree/main/lib") === "github.repo" && detect("https://github.com/settings/tokens") === "" && detect("https://github.com/o/r/pulls") === "");
}

{
  const fixtures = ["github-repo.html", "hn-item.html", "hn-list.html", "reddit-thread.html", "ph-product.html", "npm-package.html", "pypi-project.html", "cws-listing.html", "stripe-home.html", "github-traffic.html"];
  const leaks = fixtures.filter(f => /<script(?![^>]*(?:src|type="application\/(?:ld\+)?json"))[^>]*>[^<]|avatars\.githubusercontent|ph-avatars|<img[^>]+src="https?:/.test(page(f)));
  check("every new fixture says where it came from, runs no inline script and carries no avatar or remote image", leaks.length === 0 && fixtures.every(f => /<meta name="zerack-fixture" content="(Captured|Synthetic)/.test(page(f))), leaks);
  check("the commit feed fixture says where it came from and keeps no avatar", /zerack-fixture: Captured 2026-09-27 signed out from github\.com\/itzjk\/cashcow-radar-agent\/commits\.atom/.test(ATOM) && !/media:thumbnail|avatars\./.test(ATOM));
}

done("extract-builders");
