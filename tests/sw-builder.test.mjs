// The builder tool in the worker: it works from the reads the chat stored, keeps the user's repository, watches public pages once a day only where the user allowed reading, and shows cards that carry no page markup.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadWorker, ROOT, check, done } from "./sw-harness.mjs";
import { makeIndexedDB, IDBKeyRange } from "./idb-lite.mjs";
import { windowFor } from "./dom-lite.mjs";

const H = 3600000, DAY = 86400000;
const page = n => readFileSync(join(ROOT, "tests/html", n), "utf8");
const plain = o => JSON.parse(JSON.stringify(o));
const call = (w, name, args, ctx) => new Promise(r => w.context.nspChatToolNow(name, args, ctx, r));
const REPO = "https://github.com/itzjk/cashcow-radar-agent";
const EX = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");

function reader(html, url, fetchImpl) {
  const win = windowFor(html, url);
  const ctx = { document: win.document, location: win.location, URL, console, fetch: fetchImpl };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(EX, ctx);
  return ctx.NSP_EXTRACT;
}

function worker(opts = {}) {
  const w = loadWorker({ local: Object.assign({ nsp_agent_enabled: true, nsp_agent_sites: {} }, opts.local || {}), allSites: opts.allSites, fetch: opts.fetch });
  w.context.indexedDB = makeIndexedDB();
  w.context.IDBKeyRange = IDBKeyRange;
  const alarms = [];
  w.context.chrome.alarms = {
    create: (name, info, cb) => { alarms.push({ op: "create", name, info }); if (cb) setImmediate(cb); },
    clear: (name, cb) => { alarms.push({ op: "clear", name }); if (cb) setImmediate(() => cb(true)); },
    get: (name, cb) => setImmediate(() => cb(alarms.some(a => a.op === "create" && a.name === name) ? { name } : undefined)),
    onAlarm: { addListener() {} }
  };
  return { w, S: w.context.NSP_CHAT_STORE, B: w.context.NSP_BUSINESS, alarms };
}

async function store(w, name, url, id, host, at, fetchImpl) {
  const r = plain(await reader(page(name), url, fetchImpl).read(id, {}));
  r.host = host;
  r.playbook = "builders";
  const B = w.context.NSP_BUSINESS;
  const snap = B.snapshot(r, B.analyze(r, { cadence: w.context.NSP_CADENCIA, reverse: w.context.NSP_REVERSE_ENGINE }), at);
  return w.context.NSP_CHAT_STORE.addSeries(snap);
}

const ATOM = page("github-commits.atom");
const feeds = url => Promise.resolve(/commits\.atom$/.test(url) ? { ok: true, status: 200, text: () => Promise.resolve(ATOM) } : { ok: false, status: 404, text: () => Promise.resolve("") });

{
  const { w } = worker();
  check("the worker loads the builder engine and the page parsers it calls", typeof w.context.NSP_BUILDERS.requests === "function" && typeof w.context.NSP_EXTRACT.text.githubRepo === "function" && w.context.nspBuilderReady() === true);
  const bad = await call(w, "zerackBuilder", { action: "tweet" }, {});
  check("an unknown action is refused with the list of actions", bad.ok === false && bad.code === "bad_action" && /requests, askers, rivals, watch/.test(bad.error), bad);
  const none = await call(w, "zerackBuilder", { action: "post" }, {});
  check("post with no repository read asks for the read first, it never guesses", none.ok === false && none.code === "missing" && /zerackExtract reader github\.repo/.test(none.error), none);
  const empty = await call(w, "zerackBuilder", { action: "requests" }, {});
  check("requests with nothing read says to read first", empty.ok === true && /^Nothing read yet/.test(empty.line), empty);
}

{
  const { w, S } = worker();
  const now = Date.now();
  await store(w, "hn-item.html", "https://news.ycombinator.com/item?id=41000100", "hn.item", "news.ycombinator.com", now - 2 * H);
  await store(w, "ph-product.html", "https://www.producthunt.com/products/cashcow-radar", "ph.product", "www.producthunt.com", now - H);
  await store(w, "hn-item.html", "https://news.ycombinator.com/item?id=41000100", "hn.item", "news.ycombinator.com", now - 30 * 60000);
  const r = await call(w, "zerackBuilder", { action: "requests" }, { site: { host: "news.ycombinator.com", url: "https://news.ycombinator.com/item?id=41000100" } });
  check("requests groups the asks across the stored reads of two sites", r.ok && r.clusters[0].label === "Firefox" && r.clusters[0].count === 3 && r.clusters[0].sources["Product Hunt"] === 1, r.clusters && r.clusters[0]);
  check("a thread read twice counts once: only the latest read of each page is used", r.clusters[0].count === 3 && r.clusters[1].count === 3, r.clusters.map(c => c.count));
  check("the chat card rides on the result without being sent to the model", r.card && r.card.kind === "requests" && !Object.keys(r).includes("card") && !/"card"/.test(JSON.stringify(r)), Object.keys(r));
  check("the card keeps the label, the count, the sources and linked examples", r.card.clusters[0].label === "Firefox" && r.card.clusters[0].count === 3 && r.card.clusters[0].sources.length === 2 && r.card.clusters[0].examples.every(e => /^https:\/\//.test(e.url)), r.card.clusters[0]);
  const a = await call(w, "zerackBuilder", { action: "askers", keywords: "views per hour, faceless, YouTube niches" }, {});
  check("askers finds the people asking for the product from the keywords given", a.ok && a.matches.some(m => m.by === "tidepool" && m.handwrite === true) && a.card.kind === "askers" && a.card.matches[0].outline.length > 0, a.matches && a.matches.map(m => m.by));
  const noKeys = await call(w, "zerackBuilder", { action: "askers" }, {});
  check("with no keywords and no repository read, askers asks what the product does", noKeys.ok === false && noKeys.code === "missing", noKeys);
}

{
  const { w, S, B } = worker();
  const now = Date.now();
  const r = plain(await reader(page("github-repo.html"), REPO, feeds).read("github.repo", {}));
  r.host = "github.com";
  r.playbook = "builders";
  const shift = now - Date.parse("2026-09-25T08:00:00Z");
  r.rows.forEach(c => { c.at = new Date(Date.parse(c.at) + shift).toISOString(); });
  const snap = B.snapshot(r, B.analyze(r, {}), now - H);
  snap.metrics.stars = 5;
  const old = Object.assign({}, snap, { at: now - 26 * H, metrics: Object.assign({}, snap.metrics, { stars: 3 }), items: [] });
  await S.addSeries(old);
  await S.addSeries(snap);
  const p = await call(w, "zerackBuilder", { action: "post" }, { site: { host: "github.com", url: REPO } });
  check("post works from the stored read of the repository in the tab: commits of the last 24 hours and the star count", p.ok && p.decision === "post" && /^\d+ commits? landed in the last 24 hours$/.test(p.why) && /5 stars \(\+2 today\)/.test(p.drafts[0].text), p);
  check("the post card has the drafts with their counts and the X composer link, and nothing else to send", p.card.kind === "post" && p.card.drafts.length >= 1 && p.card.drafts.every(d => d.chars <= 280 && /^https:\/\/x\.com\/intent\/tweet\?text=/.test(d.intent)) && p.card.source.url === "https://docs.x.com/fundamentals/counting-characters", p.card);
  check("the result for the model carries the drafts, not the links to post them", !/intent/.test(JSON.stringify(p)), Object.keys(p));
  check("the repository becomes the user's own for the next questions", w.local.nsp_builder_repo === REPO, w.local.nsp_builder_repo);
  const c = await call(w, "zerackBuilder", { action: "changelog" }, {});
  check("changelog uses the user's repository: 0.1.0 with no release yet, and the feed limit", c.ok && c.version.to === "v0.1.0" && /20 of 40 commits/.test(c.feedNote) && /^## \[0\.1\.0\] - \d{4}-\d{2}-\d{2}\n/.test(c.markdown), c);
  check("the changelog card links the new release form of that repository", c.card.kind === "changelog" && c.card.repo === REPO && c.card.sources.length === 3, c.card);
  const k = await call(w, "zerackBuilder", { action: "launch", tagline: "The fastest, smartest, most complete analytics suite for creators" }, {});
  check("launch builds the kit from the read and checks a draft the model proposes", k.ok && k.producthunt.taglines[0].text === "Real YouTube intelligence in your browser" && k.check[0].field === "tagline" && k.check[0].ok === false && /1 of 1 fail/.test(k.line), k.line);
  check("the launch card has the Show HN form link for the user to submit, and the rule to write it by hand", /^https:\/\/news\.ycombinator\.com\/submitlink\?u=https%3A%2F%2Fgithub\.com%2Fitzjk%2Fcashcow-radar-agent&t=Show%20HN/.test(k.card.submit) && /by hand/.test(k.card.handwrite) && k.card.checks[0].ok === false, k.card);
  const other = await call(w, "zerackBuilder", { action: "post", repo: "someone/else" }, {});
  check("asking for a repository that was never read is refused, not answered with another one", other.ok === false && other.code === "missing", other);
}

{
  const { w, S } = worker();
  const now = Date.now();
  const add = (key, vals, name) => Promise.all(vals.map((v, i) => S.addSeries({ at: now - (vals.length - 1 - i) * DAY - H, key: "github.repo|" + key, host: "github.com", reader: "github.repo", playbook: "builders", metrics: { stars: v }, facts: { owner: name.split("/")[0], repo: name.split("/")[1], url: key } })));
  await add("https://github.com/acme/rocket", [100, 102, 103, 105, 106, 140], "acme/rocket");
  await add("https://github.com/acme/steady", [50, 51, 52, 53, 54, 55], "acme/steady");
  await add(REPO, [0, 0, 1], "itzjk/cashcow-radar-agent");
  w.local.nsp_builder_repo = REPO;
  w.local.nsp_watch = [{ url: "https://github.com/acme/rocket", reader: "github.repo", host: "github.com", since: now - 6 * DAY, lastAt: now - H, lastOk: true }];
  const r = await call(w, "zerackBuilder", { action: "rivals" }, {});
  check("rivals judges each read over days: the jump is KEEP, the steady one DROP, the user's own last", r.ok && r.rows[0].name === "acme/rocket" && r.rows[0].state === "keep" && r.rows.find(x => x.name === "acme/steady").state === "drop" && r.rows[r.rows.length - 1].mine === true, r.rows && r.rows.map(x => [x.name, x.state, x.mine]));
  check("the watched rival is marked, and the card shows state, number and pace", r.rows[0].watched === true && r.card.rows[0].label === "KEEP" && r.card.rows[0].now === 140 && r.card.rows[0].perDay === 8 && r.card.watching === 1, r.card.rows[0]);
}

{
  const html = page("github-repo.html").replace(/title="0"( data-view-component="true" class="Counter js-social-count")/, 'title="12"$1').replace('"stargazerCount":0', '"stargazerCount":12');
  const fetched = [];
  const fetchStub = (url, init) => { if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) fetched.push({ url, init }); return /github\.com\/acme\/rocket$/.test(url) ? { status: 200, body: html.replace(/itzjk\/cashcow-radar-agent/g, "acme/rocket") } : { status: 404, body: "" }; };
  const off = worker({ local: { nsp_agent_enabled: false } });
  const r0 = await call(off.w, "zerackBuilder", { action: "watch", url: "https://github.com/acme/rocket" }, {});
  check("watching needs the Agent switch", r0.ok === false && r0.code === "agent_off", r0);

  const deny = worker({ allSites: false, fetch: fetchStub });
  const rows = [];
  const r1 = await call(deny.w, "zerackBuilder", { action: "watch", url: "https://github.com/acme/rocket/issues" }, { allow: (host, pattern, url) => rows.push({ host, pattern, url }) });
  check("a site the user has not allowed is not read: the chat gets its Allow row", r1.ok === false && r1.code === "site_not_allowed" && rows.length === 1 && rows[0].host === "github.com" && rows[0].pattern === "https://github.com/*" && rows[0].url === "https://github.com/acme/rocket", { r1, rows });
  check("and nothing was fetched", fetched.length === 0, fetched);

  const { w, S, alarms } = worker({ allSites: true, fetch: fetchStub, local: { nsp_agent_sites: { "github.com": { mode: "read", since: 1 } } } });
  const r2 = await call(w, "zerackBuilder", { action: "watch", url: "https://github.com/acme/rocket/pulls?q=is%3Aopen" }, {});
  check("with reading allowed, watch keeps the repository home and reads it once now", r2.ok && /^Watching acme\/rocket: first reading today, 12 stars, 0 forks/.test(r2.line) && r2.watching === 1, r2);
  check("the read is a plain public fetch of that one page, without cookies", fetched.length === 1 && fetched[0].url === "https://github.com/acme/rocket" && fetched[0].init.credentials === "omit" && fetched[0].init.cache === "no-store", fetched);
  const series = await S.listSeries({ readers: ["github.repo"] });
  check("the reading is stored as the repository's series, stars included", series.length === 1 && series[0].key === "github.repo|https://github.com/acme/rocket" && series[0].metrics.stars === 12 && series[0].host === "github.com", series);
  check("the watch list is saved and a daily check is scheduled", w.local.nsp_watch.length === 1 && w.local.nsp_watch[0].lastOk === true && w.local.nsp_watch[0].name === "acme/rocket" && alarms.some(a => a.op === "create" && a.name === "nsp-watch" && a.info.periodInMinutes === 360), { list: w.local.nsp_watch, alarms });
  check("the watch card lists what is watched", r2.card.kind === "watch" && r2.card.list[0].name === "acme/rocket" && r2.card.list[0].ok === true);
  const alive = setInterval(() => {}, 20);
  await w.context.nspWatchTick();
  check("the scheduled check skips a page read less than a day ago", fetched.length === 1, fetched.length);
  w.local.nsp_watch[0].lastAt = Date.now() - 25 * H;
  await w.context.nspWatchTick();
  check("and reads it again once it is a day old", fetched.length === 2 && (await S.listSeries({ readers: ["github.repo"] })).length === 2, fetched.length);
  clearInterval(alive);
  const bad = await call(w, "zerackBuilder", { action: "watch", url: "https://example.com/pricing" }, {});
  check("a page that is not a repository, package or store listing cannot be watched", bad.ok === false && bad.code === "not_watchable", bad);
  const cws = await call(w, "zerackBuilder", { action: "watch", url: "https://chromewebstore.google.com/detail/x/abcdefghijklmnopabcdefghijklmnop" }, {});
  check("a store listing on a site the user has not allowed is refused, not fetched", cws.ok === false && cws.code === "site_not_allowed" && fetched.length === 2, cws);
  const stop = await call(w, "zerackBuilder", { action: "unwatch", url: "https://github.com/acme/rocket" }, {});
  check("unwatch removes it and clears the schedule", stop.ok && stop.watching === 0 && w.local.nsp_watch.length === 0 && alarms.some(a => a.op === "clear" && a.name === "nsp-watch"), stop);
  const signin = worker({ allSites: true, fetch: () => ({ status: 200, body: "<html><head><title>Sign in to GitHub</title></head><body><form></form></body></html>" }), local: { nsp_agent_sites: { "github.com": { mode: "read", since: 1 } } } });
  const r3 = await call(signin.w, "zerackBuilder", { action: "watch", url: "https://github.com/acme/rocket" }, {});
  check("a page that answers with something else is recorded as not read, and nothing is stored", r3.ok && /the first reading failed/.test(r3.line) && (await signin.S.listSeries({})).length === 0 && signin.w.local.nsp_watch[0].lastOk === false, r3.line);
}

{
  const { w } = worker();
  const c = await call(w, "zerackBuilder", { action: "check", title: "Show HN: The BEST tool EVER!", post: "x".repeat(300) }, {});
  check("check answers each draft with the rule and its source", c.ok && c.failed === 2 && c.card.kind === "check" && c.card.checks.every(x => x.source && /^https:\/\//.test(x.source.url)), c);
}

{
  const src = readFileSync(join(ROOT, "background/service-worker.js"), "utf8");
  check("the worker loads the builder files next to the code that calls them", /importScripts\('\.\.\/lib\/nsp-extract\.js', '\.\.\/lib\/nsp-builders\.js'\)/.test(src) && /NSP_BUILDERS\.|self\.NSP_BUILDERS/.test(src));
  check("the watch fetch never sends cookies and only reads what the user allowed", /credentials: 'omit'/.test(src.slice(src.indexOf("function nspWatchSample"), src.indexOf("function nspWatchTick"))) && /nspWatchAllowed\(entry\.url\)/.test(src));
  check("the builder card is not enumerable, so the model never gets the links that post", /Object\.defineProperty\(result, 'card', \{ value: card, enumerable: false/.test(src));
}

done("sw-builder");
