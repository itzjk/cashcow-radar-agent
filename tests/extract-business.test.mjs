// The Phase 4 page readers on captured and synthetic pages: TikTok, Instagram, Upwork, Fiverr, Google Maps, Amazon, KDP, Seller Central, Substack, beehiiv, Gumroad, Lemon Squeezy and G2. Each number is checked against the saved page, and a changed page answers drift, never a zero.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done, htmlPage } from "./sw-harness.mjs";
import { load } from "./engines.mjs";
import { windowFor } from "./dom-lite.mjs";

const SRC = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");
const page = n => htmlPage(n);
const plain = o => JSON.parse(JSON.stringify(o));
const PB = ["etsy", "shopify", "seo", "builders", "creators", "freelance", "local", "amazon", "newsletter", "digital", "index"].map(f => "knowledge/playbooks/" + f + ".js");
const C = load(["lib/nsp-cadencia.js", "knowledge/reverse-engine.js", "lib/nsp-business.js", "lib/nsp-leads.js"].concat(PB), { URL });
const B = C.NSP_BUSINESS, P = C.NSP_PLAYBOOKS, L = C.NSP_LEADS;
const POL = L.setPolicy(null, { name: "Ana Ruiz", offer: "websites and review management for local businesses", skills: "React, TypeScript, Stripe", rate: 45 }).policy;
const ENG = { cadence: C.NSP_CADENCIA, reverse: C.NSP_REVERSE_ENGINE, leads: L, policy: POL };

function reader(html, url, fetchImpl) {
  const w = windowFor(html, url);
  const ctx = { document: w.document, location: w.location, URL, console, fetch: fetchImpl };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx.NSP_EXTRACT;
}
const read = async (html, url, id, opts, fetchImpl) => plain(await reader(html, url, fetchImpl).read(id, opts || {}));
const analyzed = (r, host) => { r.host = host; const a = B.analyze(r, ENG); return { a, s: B.snapshot(r, a, Date.parse("2026-09-27T12:00:00Z")) }; };
const viaPlaybook = async (file, url, html) => {
  const u = new URL(url);
  const pb = P.forHost(u.hostname, u.pathname);
  const r0 = P.readerFor(pb, u.hostname, u.pathname);
  return { pb, r0, r: await read(html || page(file), url, r0.id, plain(r0.opts)) };
};

const TT = "https://www.tiktok.com/@duolingo";
{
  const r = await read(page("tiktok-profile.html"), TT, "");
  check("a TikTok profile is detected and read from its page data", r.ok && r.reader === "tiktok.profile" && r.profile.via === "page data" && r.profile.followers === 15900000 && r.profile.likes === 409600000 && r.profile.videos === 661 && r.profile.following === 292, r.profile);
  check("every video on screen reads with its views, the pinned one marked", r.count === 12 && r.rows[0].pinned === true && r.rows[0].views === 1200000 && r.rows[0].viewsApprox === true && r.rows[1].views === 48300 && r.rows.filter(x => x.pinned).length === 1, r.rows.slice(0, 2));
  const { a, s } = analyzed(r, "www.tiktok.com");
  check("the outliers are at 3 times the median of the unpinned videos, pinned ones flagged", a.analysis.medianViews === 47000 && a.analysis.outliers.length === 3 && a.analysis.outliers[0].views === 2400000 && a.analysis.outliers.some(o => o.pinned) && a.analysis.outlierBar === 3, a.analysis.outliers);
  check("the line gives followers, likes, the median and the outliers", /^@duolingo: 15\.9M followers, 409\.6M likes\. 12 videos on screen, median 47K views; 3 at 3 times the median or more: "the owl at the office party" 2\.4M/.test(a.line), a.line);
  check("the rewards check says the followers bar is met and where the 30 day views come from", a.analysis.rewards.followers === "met" && /TikTok Studio/.test(a.analysis.rewards.views30));
  check("the snapshot keeps followers, likes and the outliers count for trends", s.metrics.followers === 15900000 && s.metrics.outliers === 3 && s.ids.length === 12, s.metrics);
  const moved = page("tiktok-profile.html").replace('"uniqueId": "duolingo"', '"uniqueId": "someoneelse"');
  const r2 = await read(moved, TT, "tiktok.profile");
  check("page data left from another profile is not trusted; the numbers on screen are read instead", r2.ok && r2.profile.via === "screen" && r2.profile.followers === 15900000 && r2.profile.approx === true, r2.profile);
  const drifted = page("tiktok-profile.html").replace(/data-e2e="video-views"/g, 'data-e2e="video-plays"');
  const r3 = await read(drifted, TT, "tiktok.profile");
  check("a grid whose view counts stop reading answers drift, never zero views", r3.ok === false && r3.code === "drift" && r3.seen === 12, r3);
  check("a TikTok page that is not a profile is not read as one", (await read(page("tiktok-profile.html"), "https://www.tiktok.com/foryou", "tiktok.profile")).code === "not_this_page");
}

{
  const url = "https://www.tiktok.com/@duolingo/video/7470000000012000036";
  const r = await read(page("tiktok-video.html"), url, "");
  const v = r.video;
  check("a TikTok video reads its counts, sound and hashtags from the page data", r.reader === "tiktok.video" && v.via === "page data" && v.views === 1200000 && v.likes === 184000 && v.comments === 2310 && v.shares === 9120 && v.saves === 15400 && v.sound.original === true && v.hashtags.join() === "duolingo,languagelearning,streak" && v.seconds === 21, v);
  const { a } = analyzed(r, "www.tiktok.com");
  check("the line gives the rates and says 21 seconds is under the minute the rewards program pays for", /184K likes \(15\.33%\)/.test(a.line) && /under the one minute/.test(a.line), a.line);
  const other = await read(page("tiktok-video.html"), "https://www.tiktok.com/@duolingo/video/7470000000099999999", "tiktok.video");
  check("page data for another video is not trusted; the counters on screen are read", other.video.via === "screen" && other.video.likes === 184000 && other.video.saves === 15400 && other.video.views === null && other.video.approx === true, other.video);
}

{
  const url = "https://www.instagram.com/nasa/reels/";
  const r = await read(page("instagram-reels.html"), url, "");
  check("an Instagram profile reads its counts from the description the page carries", r.reader === "instagram.profile" && r.profile.followers === 104000000 && r.profile.following === 95 && r.profile.posts === 4786 && r.profile.name === "NASA" && r.profile.approx === true, r.profile);
  check("the reels tab reads a play count for every reel", r.count === 9 && r.rows.every(x => x.kind === "reel" && x.views > 0) && r.rows[6].views === 12700000, r.rows.map(x => x.views));
  const { a } = analyzed(r, "www.instagram.com");
  check("the outliers of the reels are found the same way", a.analysis.medianViews === 410000 && a.analysis.outliers.length === 3 && /median 410K plays/.test(a.line), a.line);
  const noCounts = page("instagram-reels.html").replace(/<span><span>[0-9.]+[KM]<\/span><\/span>/g, "");
  const d = await read(noCounts, url, "instagram.profile");
  check("reels on screen with no play counts answer drift", d.code === "drift" && d.seen === 9, d);
  const grid = await read(noCounts.replace(/\/reel\//g, "/p/"), "https://www.instagram.com/nasa/", "instagram.profile");
  const g = analyzed(grid, "www.instagram.com").a;
  check("the posts grid has no play counts by design, so the line says to open the Reels tab", grid.ok && grid.rows.every(x => x.views === null) && /open the Reels tab/.test(g.line), g.line);
  check("another account's description is not taken for this one", (await read(page("instagram-reels.html"), "https://www.instagram.com/esa/reels/", "instagram.profile")).profile === null);
}

const JOBS = "https://www.upwork.com/nx/search/jobs/?q=react";
{
  const r = await read(page("upwork-jobs.html"), JOBS, "");
  const j = r.rows[0];
  check("an Upwork job search reads seven jobs", r.reader === "upwork.jobs" && r.count === 7, r.count);
  check("a job reads its rate, level, proposals, payment, spend, age, skills and text", j.type === "hourly" && j.rateMin === 35 && j.rateMax === 60 && j.level === "Intermediate" && j.proposals.min === 5 && j.proposals.max === 10 && j.verified === true && j.spent === 12000 && j.postedMin === 120 && j.skills.join() === "React,TypeScript,Chart.js,Tailwind CSS" && /analytics dashboard/.test(j.text), j);
  check("a fixed-price job reads its budget, an unverified one says so, 50+ proposals has no top", r.rows[1].type === "fixed" && r.rows[1].budget === 150 && r.rows[2].verified === false && r.rows[4].proposals.min === 50 && r.rows[4].proposals.max === null && r.rows[4].spent === 0, [r.rows[1], r.rows[2].verified, r.rows[4].proposals]);
  const { a, s } = analyzed(r, "www.upwork.com");
  check("the line says how many to bid on for the user's skills", /^7 jobs read: 4 hourly, 3 fixed price, 6 with payment verified, 1 with 50 or more proposals; .* For you: 2 Bid, 1 Look at it, 4 Skip\.$/.test(a.line), a.line);
  check("the snapshot keeps the jobs and the bids", s.metrics.jobs === 7 && s.metrics.bid === 2, s.metrics);
  const bare = page("upwork-jobs.html").replace(/<ul data-test="JobInfo"[\s\S]*?<\/ul>|<ul data-test="JobInfoClient"[\s\S]*?<\/ul>|<ul class="proposals">[\s\S]*?<\/ul>/g, "");
  const d = await read(bare, JOBS, "upwork.jobs");
  check("titles with none of their budgets, proposals or client facts answer drift", d.code === "drift" && d.seen === 7, d);
  const noTiles = page("upwork-jobs.html").replace(/data-test="JobTile"/g, 'data-test="Card"').replace(/class="job-tile"/g, 'class="card"');
  const f = await read(noTiles, JOBS, "upwork.jobs");
  check("when the tile hook changes, the job links still find their tiles", f.ok && f.via === "fallback" && f.count === 7, f.via);
}

{
  const url = "https://www.upwork.com/ab/proposals/job/~021900000000000001/apply/";
  const r = await read(page("upwork-apply.html"), url, "");
  const j = r.job;
  check("the proposal form reads the Connects it asks, the Connects left and the fee shown", r.reader === "upwork.job" && j.connects === 16 && j.available === 84 && j.feePct === 10 && j.proposalForm === true && j.rateMin === 35, j);
  const { a } = analyzed(r, "www.upwork.com");
  check("its line prices the Connects", /16 Connects to apply \(\$2\.40\), 84 available/.test(a.line) && /\$12,000\+ spent/.test(a.line), a.line);
}

{
  const url = "https://www.fiverr.com/categories/graphics-design/creative-logo-design";
  const r = await read(page("fiverr-gigs.html"), url, "");
  const g = r.rows[0];
  check("a Fiverr category reads its 8 gigs as served", r.reader === "fiverr.gigs" && r.count === 8 && r.via === "primary", r.count);
  check("a gig reads its title, seller, level, rating, reviews and price from", g.title === "I will do modern minimalist business logo design for your brand" && g.seller === "Seller A" && g.level === "Level 2" && g.rating === 4.8 && g.reviews === 202 && g.price === 15 && g.currency === "$", g);
  const { a } = analyzed(r, "www.fiverr.com");
  check("the line gives the price band, the reviews and the levels", /^8 gigs read, from \$10\.00 to \$55\.00, median \$20\.00; median 220 reviews; 8 at Level 2, median \$20\.00\.$/.test(a.line), a.line);
  const d = await read(page("fiverr-gigs.html").replace(/From(&#xa0;| )<span>\$[0-9]+<\/span>/g, ""), url, "fiverr.gigs");
  check("gigs with no price that reads answer drift", d.code === "drift", d);
}

const MAPS = "https://www.google.com/maps/search/dentist+austin/@30.26,-97.74,13z";
{
  const r = await read(page("maps-results.html"), MAPS, "");
  const by = n => r.rows.find(x => x.name === n);
  check("a Google Maps search reads its seven places and the query", r.reader === "maps.results" && r.count === 7 && r.query === "dentist austin", r.query);
  check("a place reads its rating, reviews, category, street, phone and whether it has a website", by("Oakridge Family Dental").rating === 4.6 && by("Oakridge Family Dental").reviews === 212 && by("Oakridge Family Dental").category === "Dentist" && by("Oakridge Family Dental").address === "1200 Oak St" && by("Oakridge Family Dental").phone === "(512) 555-0142" && by("Oakridge Family Dental").hasWebsite === false, by("Oakridge Family Dental"));
  check("a website link is read as the site, sponsored and closed are marked", by("Cedar Park Smiles").website === "https://www.cedarparksmiles.test/" && by("Brightway Dental Care").sponsored === true && by("Eastside Tooth Co.").closed === "permanently" && by("Eastside Tooth Co.").rating === null, [by("Brightway Dental Care").sponsored, by("Eastside Tooth Co.")]);
  const { a, s } = analyzed(r, "www.google.com");
  check("the line counts places without a website and the verdicts for the offer", /^7 places read for "dentist austin": 2 without a website on the listing, 2 rated under 4, median rating 4\.65 from a median 137 reviews, 1 sponsored, 1 closed\. For your offer: 3 Pitch, 1 Look at it, 2 Skip\.$/.test(a.line), a.line);
  check("the snapshot keeps places, the ones without a website and the pitches", s.metrics.places === 7 && s.metrics.noWebsite === 2 && s.metrics.pitch === 3, s.metrics);
  const drifted = page("maps-results.html").replace(/ stars [0-9,]+ Reviews/g, "").replace(/<span>(Dentist|Cosmetic dentist|Pediatric dentist)<\/span>/g, "<span></span>").replace(/<span>[0-9]+ [A-Z][^<]*(St|Ln|Rd|Ave|Blvd)<\/span>/g, "<span></span>");
  const d = await read(drifted, MAPS, "maps.results");
  check("names with none of their ratings, categories or addresses answer drift", d.code === "drift" && d.seen === 7, d);
  check("a Maps page with no list is not a results page", (await read("<html><body><div role='feed'></div></body></html>", MAPS, "maps.results")).code === "not_this_page");
}

{
  const url = "https://www.google.com/maps/place/Oakridge+Family+Dental/@30.2,-97.7,17z";
  const r = await read(page("maps-place.html"), url, "");
  check("a Maps place reads its rating, reviews count, category, address, phone and hours", r.reader === "maps.place" && r.place.rating === 4.6 && r.place.reviews === 212 && r.place.category === "Dentist" && r.place.address === "1200 Oak St, Austin, TX 78701" && r.place.phone === "5125550142" && r.place.hasHours === true && r.place.hasWebsite === false, r.place);
  check("every review reads its stars, age, text and whether the owner answered", r.count === 5 && r.rows[0].stars === 1 && r.rows[0].ageMin === 2880 && r.rows[1].answered === true && r.rows.filter(x => x.answered).length === 1 && /Delta Dental/.test(r.rows[4].text), r.rows.map(x => [x.stars, x.when, x.answered]));
  const { a } = analyzed(r, "www.google.com");
  check("negative reviews come first, newest first, then questions", a.analysis.answerFirst.map(x => x.by).join() === "Dana P.,Priya S.,Ana G." && a.analysis.unanswered === 4, a.analysis.answerFirst);
  check("it works out the five-star reviews to the next tenth, as an estimate", a.analysis.nextStep.rating === 4.7 && a.analysis.nextStep.fiveStarReviews === 71 && /About 71 new five-star reviews would lift the average to 4\.7 \(an estimate/.test(a.line), a.line);
  const d = await read(page("maps-place.html").replace(/aria-label="[1-5] stars?"/g, 'aria-label="rating"'), url, "maps.place");
  check("reviews whose stars stop reading answer drift", d.code === "drift" && d.seen === 5, d);
}

{
  const url = "https://www.amazon.com/s?k=standing+desk";
  const r = await read(page("amazon-search.html"), url, "");
  const x = r.rows[1];
  check("an Amazon search reads its 16 results as served", r.reader === "amazon.search" && r.count === 16 && r.query === "standing desk", r.count);
  check("a result reads its title, price, rating, ratings, purchases and sponsored mark", x.asin === "B0BZ7GXM4M" && /^Claiks Electric Standing Desk/.test(x.title) && x.price === 99.98 && x.rating === 4.5 && x.ratings === 3895 && x.bought === 3000 && x.sponsored === true && x.url === "https://www.amazon.com/dp/B0BZ7GXM4M", x);
  check("sponsored titles lose their Sponsored Ad prefix", !r.rows.some(y => /^Sponsored/.test(y.title)) && r.rows.filter(y => y.sponsored).length === 8, r.rows.filter(y => y.sponsored).length);
  const { a } = analyzed(r, "www.amazon.com");
  check("the line says whether young products still sell here", /^16 results read for "standing desk", 8 sponsored; prices \$54\.98 to \$899\.00, median \$124\.99; organic results have a median of 2,546 ratings; 2 organic results with fewer than 500 ratings still show purchases in the past month, so there is a little room\.$/.test(a.line), a.line);
  const d = await read(page("amazon-search.html").replace(/class="a-offscreen"/g, 'class="gone"').replace(/class="a-icon-alt"/g, 'class="gone"'), url, "amazon.search");
  check("results with no price or rating that reads answer drift", d.code === "drift" && d.seen === 16, d);
}

{
  const url = "https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299";
  const r = await read(page("amazon-product.html"), url, "");
  const p = r.product;
  check("an Amazon product reads its title, format, author, rating, ratings, price and release", r.reader === "amazon.product" && /^Atomic Habits/.test(p.title) && p.format === "Hardcover" && p.by === "James Clear" && p.rating === 4.8 && p.ratings === 147324 && p.price === 15.54 && p.currency === "EUR" && p.released === "2018-10-16" && p.asin === "0735211299", p);
  check("the Best Sellers Rank reads with every category", p.ranks.length === 4 && p.ranks[0].rank === 39 && p.ranks[0].category === "Books" && p.ranks[1].category === "Popular Social Psychology & Interactions" && r.rankFound === true, p.ranks);
  const { a, s } = analyzed(r, "www.amazon.com");
  check("the line gives the ranks and keeps the currency it saw", /#39 in Books, #1 in Popular Social Psychology & Interactions/.test(a.line) && /15\.54 EUR/.test(a.line) && /rank compares items/i.test(a.analysis.rankNote), a.line);
  check("the snapshot follows the main rank", s.metrics.bestRank === 39 && s.metrics.reviews === 147324, s.metrics);
  const d = await read(page("amazon-product.html").replace(/id="acrPopover"/g, 'id="x1"').replace(/Best Sellers Rank/g, "Ranking").replace(/class="a-offscreen"/g, 'class="x"'), url, "amazon.product");
  check("a title with no price, rating or rank that reads answers drift", d.code === "drift", d);
}

{
  const url = "https://www.lennysnewsletter.com/archive";
  const asked = [];
  const ok = (u, init) => { asked.push({ u, init }); return Promise.resolve({ ok: true, status: 200, headers: { get: () => "application/json; charset=utf-8" }, text: () => Promise.resolve(page("substack-archive.json")) }); };
  const r = await read(page("substack-archive.html"), url, "", {}, ok);
  check("a Substack publication on its own domain is detected by its CDN and reads its archive", r.reader === "substack.archive" && r.count === 12 && r.publication === "Lenny's Newsletter", r.count);
  check("the archive is asked on the same site, without cookies", asked.length === 1 && asked[0].u === "https://www.lennysnewsletter.com/api/v1/archive?sort=new&offset=0&limit=50" && asked[0].init.credentials === "omit", asked);
  check("a post reads its title, date, likes, comments, restacks, audience and length", r.rows[0].likes === 310 && r.rows[0].comments === 2 && r.rows[0].restacks === 14 && r.rows[0].audience === "paid" && r.rows[0].words === 3807 && r.rows[0].date === "2026-09-22T12:45:14.998Z", r.rows[0]);
  const { a } = analyzed(r, "www.lennysnewsletter.com");
  check("the line gives the median likes, the paid share, the rhythm and the most liked posts", /^Lenny's Newsletter: 12 posts read, median 456 likes, 10 for paid subscribers, one every 7 days; most liked: "How to turn your AI into a world-class designer" \(1,033\)/.test(a.line), a.line);
  const hidden = await read(page("substack-archive.html"), url, "substack.archive", {}, () => Promise.resolve({ ok: false, status: 404, headers: { get: () => "text/html" }, text: () => Promise.resolve("") }));
  check("an archive that does not answer is hidden, not empty", hidden.code === "not_exposed" && /hidden, not empty/.test(hidden.error), hidden);
  const html = await read(page("substack-archive.html"), url, "substack.archive", {}, () => Promise.resolve({ ok: true, status: 200, headers: { get: () => "text/html" }, text: () => Promise.resolve("<html></html>") }));
  check("an archive answered with a web page is not taken as posts", html.code === "not_exposed", html);
  const blank = await read(page("substack-archive.html"), url, "substack.archive", {}, () => Promise.resolve({ ok: true, status: 200, headers: { get: () => "application/json" }, text: () => Promise.resolve('[{"id":1},{"id":2}]') }));
  check("posts that come back without titles answer drift", blank.code === "drift" && blank.seen === 2, blank);
  check("a page with no Substack sign is not read as one", (await read("<html><head><title>x</title></head><body></body></html>", "https://example.com/archive", "substack.archive", {}, ok)).code === "not_this_page");
}

{
  const url = "https://taskspaces.gumroad.com/l/essentialbundle";
  const r = await read(page("gumroad-product.html"), url, "");
  const p = r.product;
  check("a Gumroad product reads its page data: price, pay what you want, ratings and the seller", r.reader === "gumroad.product" && p.name === "Notion - Essential Template Bundle" && p.price === 0 && p.payWhatYouWant === true && p.ratings === 157 && p.average === 4.9 && p.fiveStarPct === 97 && p.sales === null && p.seller === "Taskspaces", p);
  const { a } = analyzed(r, "taskspaces.gumroad.com");
  check("a hidden sales count stays unknown, never zero", /^"Notion - Essential Template Bundle" by Taskspaces: pay what you want from \$0\.00, 157 ratings at 4\.9, 97% five stars\.$/.test(a.line) && !/sales shown/.test(a.line), a.line);
  const d = await read(page("gumroad-product.html").replace(/data-page="[^"]*"/, 'data-page="{}"'), url, "gumroad.product");
  check("a product page whose data stopped reading answers drift", d.code === "drift", d);
  const dash = page("gumroad-product.html").replace("Products/Show", "Dashboard/Index");
  const other = reader(dash, "https://app.gumroad.com/dashboard");
  check("a Gumroad page that is not a product, such as the dashboard, is not read as one", other.detect().indexOf("gumroad.product") < 0 && (await other.read("gumroad.product", {})).code === "not_this_page");
}

{
  const url = "https://www.g2.com/products/notion/reviews";
  const r = await read(page("g2-reviews.html"), url, "");
  check("a G2 reviews page reads every review with its stars, title, likes and dislikes", r.reader === "g2.reviews" && r.count === 4 && r.rows[0].stars === 4.5 && r.rows[0].title === "Great for docs, weak offline" && /Offline mode is unreliable/.test(r.rows[0].dislikes) && /templates save us hours/.test(r.rows[0].likes) && r.rows[0].by === "Maya R.", r.rows[0]);
  const { a, s } = analyzed(r, "www.g2.com");
  check("the dislikes become items the builder request grouping reads", s.items.length === 4 && s.items.every(i => i.kind === "comment" && i.text) && /Offline mode/.test(s.items[0].text) && a.analysis.withDislikes === 4, s.items.map(i => i.text.slice(0, 20)));
  const d = await read(page("g2-reviews.html").replace(/What do you (like best|dislike) about/g, "About"), url, "g2.reviews");
  check("reviews whose likes and dislikes stop reading answer drift", d.code === "drift" && d.seen === 4, d);
}

{
  const cases = [
    ["kdp-reports.html", "https://kdp.amazon.com/en_US/reports-new/orders", "amazon", "kdp.reports", r => r.count === 3 && r.rows[0].units === 42 && r.rows[0].kenp === 3120 && r.rows[0].royalty === 96.18, /^3 titles: 60 units, 3,530 pages read, \$155\.58 royalty; the top earner is "The Quiet Garden" with \$96\.18\.$/],
    ["seller-business.html", "https://sellercentral.amazon.com/business-reports/ref=xx_sitemetric_dnav_xx", "amazon", "seller.business", r => r.count === 3 && r.rows[2].sessions === 2410 && r.rows[2].unitSession === 11.3 && r.rows[2].sales === 9517.28, /best unit session percentage 11\.3% on B0E1000003, worst 4\.1% on B0E1000002 with 861 sessions/],
    ["substack-stats.html", "https://example.substack.com/publish/posts", "newsletter", "substack.stats", r => r.count === 4 && r.rows[1].openRate === 52 && r.rows[1].clicks === 520 && r.rows[1].sent === 4105, /^4 posts read, median open rate 50%, median click rate [0-9.]+%; most clicked: "The 3 emails that sold out our course"/],
    ["beehiiv-posts.html", "https://app.beehiiv.com/posts", "newsletter", "beehiiv.posts", r => r.count === 3 && r.rows[2].clickRate === 7.4 && r.rows[0].sent === 9812, /most clicked: "Issue 86: the cold email that worked" at 7\.4%/],
    ["gumroad-analytics.html", "https://app.gumroad.com/analytics", "digital", "gumroad.analytics", r => r.tiles.views === 3480 && r.tiles.sales === 87 && r.tiles.revenue === 2523 && r.tiles.conversion === 2.5, /; 2\.5 sales per 100 views\.$/],
    ["lemonsqueezy-home.html", "https://app.lemonsqueezy.com/dashboard", "digital", "lemonsqueezy.home", r => r.tiles.revenue === 4120 && r.tiles.orders === 142 && r.tiles.mrr === 610 && r.tiles.refunds === 3, /MRR \$610\.00/]
  ];
  for (const [file, url, pbWant, as, ok, line] of cases) {
    const { pb, r0, r } = await viaPlaybook(file, url);
    const { a } = analyzed(r, new URL(url).hostname);
    check(file + " reads through the " + pbWant + " playbook as " + as, pb === pbWant && r0.as === as && r.ok && ok(r), [pb, r0 && r0.as, r.error, r.rows && r.rows[0], r.tiles]);
    check(file + " has its line", line.test(a.line), a.line);
  }
}

{
  const want = [["tiktok-profile.html", TT, "tiktok.profile"], ["instagram-reels.html", "https://www.instagram.com/nasa/reels/", "instagram.profile"], ["upwork-jobs.html", JOBS, "upwork.jobs"], ["upwork-apply.html", "https://www.upwork.com/ab/proposals/job/~021900000000000001/apply/", "upwork.job"], ["fiverr-gigs.html", "https://www.fiverr.com/categories/graphics-design/creative-logo-design", "fiverr.gigs"], ["maps-results.html", MAPS, "maps.results"], ["maps-place.html", "https://www.google.com/maps/place/Oakridge+Family+Dental/@30.2,-97.7,17z", "maps.place"], ["amazon-search.html", "https://www.amazon.com/s?k=standing+desk", "amazon.search"], ["amazon-product.html", "https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299", "amazon.product"], ["gumroad-product.html", "https://taskspaces.gumroad.com/l/essentialbundle", "gumroad.product"], ["g2-reviews.html", "https://www.g2.com/products/notion/reviews", "g2.reviews"], ["substack-archive.html", "https://www.lennysnewsletter.com/archive", "substack.archive"]];
  const wrong = want.filter(([f, u, id]) => reader(page(f), u).detect()[0] !== id);
  check("every Phase 4 page is detected as its own reader", wrong.length === 0, wrong.map(w => w[0] + " -> " + reader(page(w[0]), w[1]).detect().join()));
  check("every Phase 4 reader has its analysis", ["tiktok.profile", "tiktok.video", "instagram.profile", "upwork.jobs", "upwork.job", "fiverr.gigs", "maps.results", "maps.place", "amazon.search", "amazon.product", "kdp.reports", "seller.business", "substack.archive", "substack.stats", "beehiiv.posts", "gumroad.product", "gumroad.analytics", "lemonsqueezy.home", "g2.reviews"].every(r => B.readers.includes(r)));
}

{
  const contact = reader(page("local-contact.html"), "https://www.cedarparksmiles.test/contact");
  check("a local business's own contact page is not a page of numbers: no reader claims it", contact.detect().length === 0);
  check("and asking for a reader there says to read it as a page instead", (await contact.read("", {})).code === "no_reader");
}

done("extract-business");
