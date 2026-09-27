// The builders engine: requests that repeat across issues and threads, people asking for the product, rivals that accelerate, the post of the day, the changelog and the launch kit, each with the rule behind it.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done, htmlPage } from "./sw-harness.mjs";
import { load } from "./engines.mjs";
import { windowFor } from "./dom-lite.mjs";

const C = load(["lib/nsp-cadencia.js", "knowledge/reverse-engine.js", "lib/nsp-business.js", "lib/nsp-veredicto.js", "lib/nsp-decide.js", "knowledge/playbooks/etsy.js", "knowledge/playbooks/shopify.js", "knowledge/playbooks/seo.js", "knowledge/playbooks/builders.js", "knowledge/playbooks/index.js", "lib/nsp-builders.js"], { URL, Intl });
const B = C.NSP_BUSINESS, K = C.NSP_BUILDERS, D = C.NSP_DECIDE, P = C.NSP_PLAYBOOKS;
const RULES = P.get("builders").rules;
const EX = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");
const page = n => htmlPage(n);
const H = 3600000, DAY = 86400000;
const plain = o => JSON.parse(JSON.stringify(o));

function reader(html, url, fetchImpl) {
  const w = windowFor(html, url);
  const ctx = { document: w.document, location: w.location, URL, console, fetch: fetchImpl };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(EX, ctx, { filename: "lib/nsp-extract.js" });
  return ctx.NSP_EXTRACT;
}

async function snap(name, url, id, host, at, fetchImpl) {
  const r = plain(await reader(page(name), url, fetchImpl).read(id, {}));
  r.host = host;
  r.playbook = "builders";
  return B.snapshot(r, B.analyze(r, { cadence: C.NSP_CADENCIA, reverse: C.NSP_REVERSE_ENGINE }), at);
}

const items = s => s.items.map(i => Object.assign({ host: s.host }, i));
const AT = Date.parse("2026-09-26T12:00:00Z");
const hn = await snap("hn-item.html", "https://news.ycombinator.com/item?id=41000100", "hn.item", "news.ycombinator.com", AT);
const ph = await snap("ph-product.html", "https://www.producthunt.com/products/cashcow-radar", "ph.product", "www.producthunt.com", AT);
const rd = await snap("reddit-thread.html", "https://www.reddit.com/r/NewTubers/comments/1xyzab/any_tool_for_views_per_hour/", "reddit.thread", "www.reddit.com", AT);
const gi = await snap("github-issues.html", "https://github.com/excalidraw/excalidraw/issues", "github.issues", "github.com", AT);
const ALL = items(hn).concat(items(ph), items(rd));

{
  check("x counts plain text one character each", K.xLength("Shipped the changelog today.") === 28);
  check("x counts every link as 23 characters, whatever its length", K.xLength("New: https://github.com/itzjk/cashcow-radar-agent/releases/tag/v0.1.0") === 5 + 23 && K.xLength("https://a.co") === 23);
  check("x counts Chinese, Japanese and Korean characters and emoji as two", K.xLength("\u65e5\u672c") === 4 && K.xLength("ok \ud83d\ude80") === 5 && K.xLength("caf\u00e9") === 4);
  check("x counts curly quotes and the en dash as one, as the published ranges say", K.xLength("\u201cyes\u201d \u2013 no") === 10);
}

{
  const r = K.requests(ALL, { own: ["cashcow-radar-agent", "itzjk"] });
  const [first, second, third] = r.clusters;
  check("the request that repeats most across the threads is Firefox: 3 asks from Hacker News and Product Hunt", first && first.label === "Firefox" && first.count === 3 && first.sources["Hacker News"] === 2 && first.sources["Product Hunt"] === 1 && first.people === 3, first);
  check("CSV export comes next with 3 asks, the long one about Google Sheets included", second && second.label === "CSV" && second.count === 3 && second.examples.some(e => /Google Sheets/.test(e.text)), second);
  check("dark mode repeats twice, the dark theme reply included", third && third.label === "dark" && third.count === 2 && third.examples.some(e => /dark theme/.test(e.text)), third);
  check("every example keeps its link and source", r.clusters.every(c => c.examples.every(e => /^https:\/\/(news\.ycombinator|www\.producthunt|www\.reddit)\.com\//.test(e.url) && e.source)), r.clusters.map(c => c.examples.map(e => e.url)));
  check("a question about how it works is not counted as a request", !r.clusters.some(c => c.examples.some(e => /faceless detection work/.test(e.text))));
  check("the line names the leader, its count and sources, and what was asked once", /^The request that repeats most is "Firefox": 3 times from Hacker News 2, Product Hunt 1; then "CSV" 3 times\. \d+ requests were asked once\.$/.test(r.line), r.line);
  const issues = K.requests(items(gi), { own: ["excalidraw"] });
  check("on a real issues list, two titles that only share a common word are not merged", issues.clusters.length === 1 && issues.clusters[0].label === "code + block" && issues.clusters[0].count === 2, issues.clusters.map(c => [c.label, c.count]));
  check("an issue labeled as a bug is left aside, and said so", issues.bugsSkipped >= 1 && /bug reports left aside/.test(issues.line), issues);
  const mixed = K.requests(items(gi).concat(ALL), { own: ["excalidraw"] });
  check("issues and threads group together: the leader keeps its 3 asks when an issues list is added", mixed.clusters[0].label === "Firefox" && mixed.clusters[0].count === 3, mixed.clusters.slice(0, 2));
  check("with nothing read the answer says to read first", K.requests([], {}).line === "Nothing read yet: read the issues list and the launch threads first.");
  const once = K.requests([{ kind: "issue", title: "Add Firefox support", host: "github.com", url: "https://github.com/o/r/issues/1" }, { kind: "issue", title: "Export to PDF", host: "github.com", url: "https://github.com/o/r/issues/2" }], {});
  check("two different asks are two single requests, not a group", once.clusters.length === 0 && once.askedOnce === 2 && /none repeats/.test(once.line), once);
}

{
  const desc = "Real YouTube intelligence in your browser: views per hour, viral multiplier, faceless detection with a local vision model, a demonetization policy engine, and an agent that answers with your own scan data. Free, MIT, no account, no credits.";
  const a = K.askers(ALL, { keywords: [desc], name: "cashcow-radar-agent", url: "https://github.com/itzjk/cashcow-radar-agent", what: desc, rules: RULES, now: AT });
  const who = a.matches.map(m => m.source + ":" + m.by);
  check("people asking for a tool like it are found on Reddit and Hacker News", a.ok && who.includes("Hacker News:tidepool") && who.includes("Hacker News:lowtide") && who.includes("Reddit:gridwalker") && who.includes("Reddit:shortform_sam"), who);
  check("one row per person and thread, however often they asked", who.filter(x => x === "Reddit:gridwalker").length === 1, who);
  check("a question about how it works, a feature ask and a compliment are not leads", !who.some(x => /orbit9|kestrel_dev|priyan|anaruiz/.test(x)), who);
  const t = a.matches.find(m => m.by === "tidepool"), r = a.matches.find(m => m.by === "shortform_sam");
  check("each lead says what it asked and which words of the product it matched", /Is there a tool/.test(t.excerpt) && t.matched.includes("hour") && t.matched.includes("faceless"), t);
  check("on Hacker News the reply is an outline to write by hand, with the moderator's rule", t.handwrite === true && !t.reply.draft && t.reply.outline.length === 4 && /you are the maker/.test(t.reply.outline[1]) && /no language model/.test(t.reply.rule) && t.reply.source.url === "https://news.ycombinator.com/item?id=22336638", t.reply);
  check("elsewhere the reply is a short draft that says the maker is writing", r.handwrite === false && /I built cashcow-radar-agent for this/.test(r.reply.draft) && /I am the maker/.test(r.reply.draft) && /https:\/\/github\.com\/itzjk\/cashcow-radar-agent/.test(r.reply.draft), r.reply);
  check("the answer carries the rule against using the site mainly for promotion", a.rule && /primarily for promotion/.test(a.rule.rule) && a.rule.source.url === "https://news.ycombinator.com/newsguidelines.html");
  check("a thread older than two weeks is marked closed to replies", K.askers(ALL, { keywords: [desc], rules: RULES, now: AT + 20 * DAY }).matches.filter(m => m.handwrite).every(m => m.closed));
  check("with no keywords it asks what the product does", K.askers(ALL, { keywords: [] }).code === "missing");
}

{
  const t0 = Date.parse("2026-09-20T09:00:00Z");
  const series = (vals, step) => vals.map((v, i) => ({ t: t0 + i * (step || DAY), value: v }));
  const now = t0 + 5 * DAY + 2 * H;
  const r = K.rivals([
    { url: "https://github.com/acme/steady", reader: "github.repo", name: "acme/steady", points: series([50, 51, 52, 53, 54, 55]) },
    { url: "https://github.com/acme/rocket", reader: "github.repo", name: "acme/rocket", points: series([100, 102, 103, 105, 106, 140]) },
    { url: "https://github.com/acme/fresh", reader: "github.repo", name: "acme/fresh", points: series([12]), watched: true },
    { url: "https://github.com/me/mine", reader: "github.repo", name: "me/mine", points: series([5, 6, 8, 11, 15, 40]) }
  ], { decide: D, now, mine: "https://github.com/me/mine" });
  const by = n => r.rows.find(x => x.name === n);
  check("a rival that jumps over its own baseline is accelerating: KEEP, first in the list", r.rows[0].name === "acme/rocket" && by("acme/rocket").state === "keep" && by("acme/rocket").label === "KEEP", r.rows.map(x => [x.name, x.state]));
  check("a rival at its normal pace is DROP", by("acme/steady").state === "drop", by("acme/steady"));
  check("a rival with one reading is not judged and says how many readings it still needs", by("acme/fresh").state === "look" && /3 more distinct readings/.test(by("acme/fresh").missing[0]) && by("acme/fresh").watched === true, by("acme/fresh"));
  check("the user's own repository goes last and is marked", r.rows[r.rows.length - 1].name === "me/mine" && r.rows[r.rows.length - 1].mine === true);
  check("growth a day is measured from the first to the last reading", by("acme/rocket").perDay === 8 && by("acme/rocket").readings === 6, by("acme/rocket"));
  check("the line names the accelerating rival with its number", /^1 accelerating over their own baseline: acme\/rocket \(140 stars, \+8 a day\)\./.test(r.line), r.line);
  check("a stale reading is not judged: fresh numbers are needed", K.rivals([{ url: "u", reader: "github.repo", name: "x", points: series([100, 102, 103, 105, 106, 140]) }], { decide: D, now: now + 10 * DAY }).rows[0].state === "look");
  check("with nothing read or watched it says how to start", /^No rival is watched or read yet/.test(K.rivals([], { decide: D }).line));
}

const repoHtml = page("github-repo.html");
const atom = page("github-commits.atom");
const E = reader(repoHtml, "https://github.com/itzjk/cashcow-radar-agent");
const REPO = E.text.githubRepo(repoHtml, "https://github.com/itzjk/cashcow-radar-agent").repo;
const COMMITS = E.text.commits(E.text.atom(atom)).map(c => ({ kind: "commit", id: c.sha, title: c.subject, text: c.body, url: c.url, at: Date.parse(c.at), by: c.author }));

{
  const now = Date.parse("2026-09-25T20:00:00Z");
  const p = K.post({ repo: { name: "cashcow-radar-agent", url: REPO.url, created: REPO.created }, commits: COMMITS, stars: [{ t: now - 30 * H, value: 3 }, { t: now - 2 * H, value: 5 }], now, rules: RULES.x });
  check("with 12 commits in the last 24 hours the decision is to post", p.decision === "post" && p.kind === "shipped" && p.why === "12 commits landed in the last 24 hours", p);
  const d = p.drafts[0];
  check("the draft says the day, what shipped and the real star count", /^Day 15 building cashcow-radar-agent: shipped 12 changes today\.\n\n- Saved channels and scan memory keep their shape\n- YouTube sends numbers and the worker writes the alert\n/.test(d.text) && /5 stars \(\+2 today\)\.\nhttps:\/\/github\.com\/itzjk\/cashcow-radar-agent$/.test(d.text), d.text);
  check("every draft fits in 280 characters counted the way X counts them", p.drafts.length === 2 && p.drafts.every(x => x.chars <= 280 && x.chars === K.xLength(x.text) && x.fits), p.drafts.map(x => x.chars));
  check("each draft says which facts it used", d.uses.join() === "commits,stars,day" && p.facts.map(f => f.id).join() === "commits,stars,day");
  check("each draft opens in the X composer with its text, and nothing is posted by ZERACK", d.intent === "https://x.com/intent/tweet?text=" + encodeURIComponent(d.text));
  check("the rule and its source travel with the answer", p.rule.source.url === "https://docs.x.com/fundamentals/counting-characters" && p.rule.intentSource.url === "https://docs.x.com/x-for-websites/web-intents/overview");
  const later = K.post({ repo: { name: "x", url: REPO.url, created: REPO.created }, commits: COMMITS, stars: [{ t: now, value: 5 }], now: now + 3 * DAY, rules: RULES.x });
  check("with no commit, release or new star in 24 hours the answer is to skip, and why", later.decision === "skip" && later.drafts.length === 0 && /^no commit, release or new star in the last 24 hours \(the last commit is from 2026-09-25\), so there is nothing true to post today$/.test(later.why), later.why);
  const stars = K.post({ repo: { name: "x", url: REPO.url }, commits: [], stars: [{ t: now - 26 * H, value: 40 }, { t: now - H, value: 47 }], now, rules: RULES.x });
  check("stars alone make a thank-you post with the real numbers", stars.decision === "post" && stars.kind === "stars" && /^x got 7 new stars since yesterday, 47 in total\./.test(stars.drafts[0].text), stars.drafts);
  const rel = K.post({ repo: { name: "x", url: REPO.url }, commits: COMMITS.slice(0, 2), releases: [{ kind: "release", title: "v0.2.0", labels: ["v0.2.0"], at: now - H, url: REPO.url + "/releases/tag/v0.2.0" }], now, rules: RULES.x });
  check("a release today leads the post", rel.kind === "release" && /^x v0\.2\.0 is out\./.test(rel.drafts[0].text) && /releases\/tag\/v0\.2\.0$/.test(rel.drafts[0].text), rel.drafts[0]);
  const long = K.post({ repo: { name: "x", url: REPO.url }, commits: Array.from({ length: 9 }, (_, i) => ({ title: "Add a much longer feature name number " + i + " that goes on and on about what it does in detail", at: now - H, url: "" })), now, rules: RULES.x });
  check("bullets that do not fit are dropped, never cut into a draft over the limit", long.drafts.every(x => x.chars <= 280) && long.drafts[0].text.split("\n- ").length < 5, long.drafts.map(x => x.chars));
}

{
  const now = Date.parse("2026-09-27T12:00:00Z");
  const conv = [
    { title: "feat: watch rival repositories daily", at: now - 2 * DAY, id: "a1a1a1a" },
    { title: "fix(chat): the press row keeps its timer", at: now - 3 * DAY, id: "b2b2b2b" },
    { title: "docs: explain the watch list", at: now - 3 * DAY, id: "c3c3c3c" },
    { title: "chore: bump fixtures", at: now - 4 * DAY, id: "d4d4d4d" },
    { title: "Merge pull request #12 from x/y", at: now - 4 * DAY, id: "e5e5e5e" },
    { title: "feat!: drop the old storage keys", text: "", at: now - 5 * DAY, id: "f6f6f6f" },
    { title: "feat: an older change", at: now - 30 * DAY, id: "0a0a0a0" }
  ];
  const release = [{ kind: "release", title: "v1.2.3", labels: ["v1.2.3"], at: now - 10 * DAY }];
  const c = K.changelog({ repo: { url: "https://github.com/o/r", branch: "main" }, commits: conv, releases: release, now, rules: RULES });
  check("only commits after the last release count, and merges, docs and chores are left out as noise", c.commits === 6 && c.noise.docs === 1 && c.noise.chore === 1 && c.noise.merge === 1 && c.groups.Added.length === 2 && c.groups.Fixed.length === 1, c);
  check("a breaking change moves the major number: v1.2.3 to v2.0.0", c.version.from === "v1.2.3" && c.version.to === "v2.0.0" && /1 breaking change/.test(c.version.why), c.version);
  check("the changelog follows Keep a Changelog: version, date, groups in order, short ids", c.markdown === "## [2.0.0] - 2026-09-27\n\n### Added\n- Watch rival repositories daily (a1a1a1a)\n- Drop the old storage keys (breaking) (f6f6f6f)\n\n### Fixed\n- The press row keeps its timer (b2b2b2b)\n", c.markdown);
  check("the release notes link the full comparison from the last tag", /\*\*Added\*\*/.test(c.releaseNotes) && /Full list: https:\/\/github\.com\/o\/r\/compare\/v1\.2\.3\.\.\.v2\.0\.0/.test(c.releaseNotes), c.releaseNotes);
  const minor = K.changelog({ repo: {}, commits: conv.filter(x => !/!/.test(x.title)), releases: release, now, rules: RULES });
  check("new features without breaking move the minor number", minor.version.to === "v1.3.0");
  const patch = K.changelog({ repo: {}, commits: [{ title: "fix: a typo in the chip", at: now - DAY }], releases: release, now, rules: RULES });
  check("only fixes move the patch number", patch.version.to === "v1.2.4");
  const zero = K.changelog({ repo: {}, commits: [{ title: "feat!: new store", at: now - DAY }], releases: [{ kind: "tag", title: "v0.4.1", labels: ["v0.4.1"], at: now - 9 * DAY }], now, rules: RULES });
  check("in 0.y.z a breaking change moves the minor number", zero.version.to === "v0.5.0", zero.version);
  const first = K.changelog({ repo: { url: "https://github.com/itzjk/cashcow-radar-agent", branch: "main" }, commits: COMMITS, releases: [], totalCommits: 40, now, rules: RULES });
  check("with no release yet the version is 0.1.0, as SemVer suggests, and the reason says when 1.0.0 fits", first.version.to === "v0.1.0" && /SemVer suggests starting at 0\.1\.0/.test(first.version.why) && /should probably already be 1\.0\.0/.test(first.version.why));
  check("prose commit subjects are sorted by what they say: removals, fixes and privilege changes", first.groups.Removed.length === 1 && /^Drop MobileNet/.test(first.groups.Removed[0].text) && first.groups.Fixed.some(x => /^Undo what the emoji purge broke/.test(x.text)) && first.groups.Security.some(x => /can no longer use the extension's privileges/.test(x.text)), first.groups);
  check("and it says the feed holds only the last 20 of 40 commits", first.feedNote === "the public feed holds the last 20 of 40 commits, so older ones are not in this changelog", first.feedNote);
  check("every rule it followed comes with its source", first.rules.map(r => r.source.url).join() === "https://keepachangelog.com/en/1.1.0/,https://semver.org/,https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes");
  check("no commit since the release says there is nothing to release", /^No commit since v1\.2\.3/.test(K.changelog({ repo: {}, commits: conv.slice(-1), releases: release, now, rules: RULES }).line));
}

{
  const now = Date.parse("2026-09-25T20:00:00Z");
  const kit = K.launch({ repo: REPO, now, rules: RULES });
  const ph = kit.producthunt, hn = kit.showhn;
  check("the Product Hunt name is the repository name only", ph.name.text === "cashcow-radar-agent" && /name only/.test(ph.name.why) && ph.name.source.url === "https://www.producthunt.com/launch/preparing-for-launch");
  check("three taglines from the user's own description, each within 60 characters", ph.taglines.length === 3 && ph.taglines.every(t => t.fits && t.chars <= 60) && ph.taglines[0].text === "Real YouTube intelligence in your browser" && ph.taglines[2].text === "Views per hour, viral multiplier", ph.taglines);
  check("the description is the user's own and within 500 characters", ph.description.fits && ph.description.chars === 240 && ph.description.rule === "Description of 500 characters at most: what the product is and does");
  check("gallery captions come from the README sections, never from install or license", ph.gallery.captions.map(g => g.caption).join(" | ") === "What is here that is not anywhere else | Models and where keys go | What each surface does" && ph.gallery.enough && ph.gallery.size === "1270x760");
  check("the first comment is an outline to write in the user's words, with the 70% fact", ph.firstComment.outline.length === 4 && /^Why you built it/.test(ph.firstComment.outline[0]) && /70% of products/.test(ph.firstComment.rule));
  check("the next Product Hunt day starts at 12:01 am Pacific Time, 07:01 UTC in summer time", ph.timing.next === "2026-09-26 00:01 Pacific Time" && ph.timing.at === "2026-09-26T07:01:00.000Z", ph.timing);
  const winter = K.launch({ repo: REPO, now: Date.parse("2026-12-01T20:00:00Z"), rules: RULES });
  check("and 08:01 UTC in winter", winter.producthunt.timing.at === "2026-12-02T08:01:00.000Z", winter.producthunt.timing);
  check("the Show HN title begins with Show HN, from the user's own words, with no problems", hn.title.text === "Show HN: cashcow-radar-agent \u2013 Real YouTube intelligence in your browser" && hn.title.problems.length === 0, hn.title);
  check("the Show HN text is the user's to write by hand, with the moderator's rule and what to cover", hn.handwrite === true && /no language model/.test(hn.handwriteRule.rule) && hn.cover.length === 5 && !("text" in hn), hn);
  check("the facts to cover come from the repository read", hn.facts.map(f => f.what).join() === "What it is,How to try it,Where it stands" && /0 stars, 40 commits since 2026-09-11/.test(hn.facts[2].value), hn.facts);
  check("the submit form opens with the link and title filled in, for the user to press", hn.submit === "https://news.ycombinator.com/submitlink?u=" + encodeURIComponent("https://github.com/itzjk/cashcow-radar-agent") + "&t=" + encodeURIComponent(hn.title.text));
  check("asking for votes is named as against the rules on both sites", /cannot ask people directly to upvote/.test(ph.votes.rule) && /Do not ask friends to upvote/.test(hn.votes.rule));
  const again = K.launch({ repo: REPO, threads: [{ title: "Show HN: Cashcow Radar", url: "https://github.com/itzjk/cashcow-radar-agent" }], now, rules: RULES });
  check("an earlier Show HN of the same link is found, with the rule for posting again", again.showhn.repeat && /significantly different/.test(again.showhn.repeat.rule) && again.showhn.facts.some(f => f.what === "Earlier Show HN"));
  check("with no repository read it asks for one", K.launch({ repo: {}, rules: RULES }).code === "missing");
}

{
  const c = K.check({ tagline: "The fastest, smartest, most complete analytics suite for creators", name: "Radar \u2013 niche finder", description: "x".repeat(501), firstComment: "We just launched! Please upvote and share.", title: "Show HN: The BEST tool EVER!", post: "y".repeat(281) }, RULES);
  const f = n => c.checks.find(x => x.field === n);
  check("a tagline over 60 characters fails with its count", !f("tagline").ok && f("tagline").what === "65 characters", f("tagline"));
  check("a name that carries a description fails", !f("name").ok && /more than the name/.test(f("name").what));
  check("a description over 500 characters fails", !f("description").ok);
  check("a first comment that asks for upvotes fails with Product Hunt's rule", !f("firstComment").ok && /cannot ask people directly to upvote/.test(f("firstComment").rule));
  check("a Show HN title with capitals, an exclamation point and a boast fails on each", !f("title").ok && /exclamation point/.test(f("title").what) && /BEST, EVER/.test(f("title").what) && /"BEST"/.test(f("title").what), f("title"));
  check("a post over 280 characters fails with its count", !f("post").ok && f("post").what === "281 of 280 characters");
  check("the line counts what fails", c.failed === 6 && /^6 of 6 fail/.test(c.line), c.line);
  const ok = K.check({ tagline: "Real YouTube intelligence in your browser", title: "Show HN: Cashcow Radar \u2013 niche signals from the numbers on the page", firstComment: "I built it because I kept doing the math by hand." }, RULES);
  check("clean drafts pass, acronyms like API or MIT are not shouting", ok.failed === 0 && K.check({ title: "Show HN: An MIT-licensed API for RSS" }, RULES).failed === 0, ok);
  check("a title without the prefix fails", K.check({ title: "Cashcow Radar, niche signals" }, RULES).failed === 1);
}

{
  const src = readFileSync(join(ROOT, "lib/nsp-builders.js"), "utf8");
  check("the engine is plain ES5: no arrows, let, const, classes or template strings", !/=>|\b(?:let|const)\s+[A-Za-z_$][\w$]*\s*[=;,]|\bclass\s+[A-Z]|`/.test(src));
  check("no lookbehind or other regex syntax newer than the rest of the libraries", !/\(\?<[=!]/.test(src));
  check("no raw non-ASCII character in the source", !/[^\x00-\x7e]/.test(src));
  check("nothing in the engine reaches the network, the page or storage", !/fetch\(|XMLHttpRequest|document\.|chrome\.|localStorage|indexedDB/.test(src));
  check("the engine cannot be replaced once loaded", Object.isFrozen(K) && (() => { try { C.NSP_BUILDERS = null; } catch (e) {} return C.NSP_BUILDERS === K; })());
}

done("builders");
