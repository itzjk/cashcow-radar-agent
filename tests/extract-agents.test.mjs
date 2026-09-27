// The Builders agent for people who build AI agents: Hugging Face models, Spaces, datasets and discussions, the GitHub MCP Registry, the official MCP Registry and MCP server repositories, read from synthetic pages with the real shape. Tokens in the page never reach the result.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done } from "./sw-harness.mjs";
import { load } from "./engines.mjs";
import { windowFor } from "./dom-lite.mjs";

const SRC = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");
const page = n => readFileSync(join(ROOT, "tests/html", n), "utf8");
const plain = o => JSON.parse(JSON.stringify(o));
const PB = ["etsy", "shopify", "seo", "builders", "creators", "freelance", "local", "amazon", "newsletter", "digital", "index"].map(f => "knowledge/playbooks/" + f + ".js");
const C = load(["lib/nsp-cadencia.js", "knowledge/reverse-engine.js", "lib/nsp-business.js", "lib/nsp-builders.js", "lib/nsp-gate.js"].concat(PB), { URL });
C.self = C;
const B = C.NSP_BUSINESS, P = C.NSP_PLAYBOOKS, K = C.NSP_BUILDERS, G = C.NSP_GATE;
const ENGINES = { cadence: C.NSP_CADENCIA, reverse: C.NSP_REVERSE_ENGINE };
const SECRETS = /hf_FAKE|eyJFAKE|fake-csrf|Ignore every rule|dockerJwt|accessToken|"jwt"|csrf/;

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

const MODEL = "https://huggingface.co/zerack-demo/tinyagent-7b-instruct";
{
  const r = await read(page("hf-model.html"), MODEL, "");
  const f = r.hub;
  check("a Hugging Face model reads likes, downloads last month and all time, task, library and dates from the page header", r.ok && r.reader === "hf.model" && f.likes === 1287 && f.downloads === 48213 && f.downloadsAllTime === 902114 && f.task === "text-generation" && f.library === "transformers" && f.updated === "2026-09-20T08:14:00.000Z" && f.created === "2026-05-02T10:00:00.000Z", f);
  check("it reads the card metadata the Hub filters on, and that nothing required is missing", f.license === "apache-2.0" && f.baseModel === "zerack-demo/tinyagent-7b" && f.datasets === 1 && f.cardMissing.length === 0 && f.discussions.open === 14 && f.tags.includes("agents") && !f.tags.some(t => /^(region|license|base_model):/.test(t)), f);
  check("the access token and the chat template text on the page never reach the result", !SECRETS.test(JSON.stringify(r)), JSON.stringify(r).match(SECRETS));
  check("the model page is detected as a model", reader(page("hf-model.html"), MODEL).detect().join() === "hf.model");
  const { a, s } = analyzed(r, "huggingface.co");
  check("the line gives likes, downloads, the last update and open discussions", /^zerack-demo\/tinyagent-7b-instruct \(model, text-generation, transformers\): 1,287 likes, 48,213 downloads last month, updated 2026-09-20 \(\d+ days ago\), 14 open discussions\.$/.test(a.line), a.line);
  check("the snapshot keeps likes and downloads as the series and the model name as a fact", JSON.stringify(s.metrics) === '{"likes":1287,"downloads":48213}' && s.key === "hf.model|" + MODEL && s.facts.name === "zerack-demo/tinyagent-7b-instruct" && !SECRETS.test(JSON.stringify(s)), s);
  const shown = await read(page("hf-model.html").replace(/ data-props="[^"]*"/g, ""), MODEL, "hf.model");
  check("without the header data it falls back to the visible like count and downloads, and says the dates are missing", shown.ok && shown.hub.likes === 1290 && shown.hub.downloads === 48213 && shown.hub.visibleOnly === true && /read from the visible page only/.test(B.analyze(Object.assign(shown, { host: "huggingface.co" }), ENGINES).line), shown.hub);
  const gone = await read(page("hf-model.html").replace(/ data-props="[^"]*"/g, "").replace(/<dl[\s\S]*?<\/dl>/, "").replace(/title="See users who liked this repository"/, ""), MODEL, "hf.model");
  check("with neither, it answers drift, never a zero", gone.ok === false && gone.code === "drift", gone);
  const T = reader("<html></html>", "https://example.com/").text;
  const raw = T.hf(page("hf-model.html"), MODEL);
  check("the worker's parser reads the same numbers from the raw page", raw.ok && raw.hub.likes === 1287 && raw.hub.downloads === 48213 && !SECRETS.test(JSON.stringify(raw)), raw);
  check("only model, dataset and Space pages count: docs, settings and one-part paths do not", T.hfWhere("https://huggingface.co/docs/hub/model-cards") === null && T.hfWhere("https://huggingface.co/settings/tokens") === null && T.hfWhere("https://huggingface.co/gpt2") === null && T.hfWhere("https://huggingface.co/spaces/a/b/tree/main").kind === "space");
}
{
  const url = "https://huggingface.co/spaces/zerack-demo/agent-arena";
  const r = await read(page("hf-space.html"), url, "");
  check("a Space reads its likes, SDK, state and dates, with no downloads", r.ok && r.reader === "hf.space" && r.hub.likes === 342 && r.hub.sdk === "gradio" && r.hub.stage === "SLEEPING" && r.hub.downloads === null && r.hub.title === "Agent Arena", r.hub);
  check("the Space's docker token, session token and CSRF token never reach the result", !SECRETS.test(JSON.stringify(r)));
  const { a } = analyzed(r, "huggingface.co");
  check("the line says the Space is asleep, so a visitor waits", /^zerack-demo\/agent-arena \(Space, gradio\): 342 likes, updated 2026-09-24 .*; the Space is sleeping, so a visitor waits or sees nothing\.$/.test(a.line), a.line);
}
{
  const url = "https://huggingface.co/datasets/zerack-demo/tool-calls-10k";
  const r = await read(page("hf-dataset.html"), url, "");
  const { a } = analyzed(r, "huggingface.co");
  check("a dataset reads likes and downloads, and names the card field it lacks", r.ok && r.reader === "hf.dataset" && r.hub.likes === 88 && r.hub.downloads === 5120 && JSON.stringify(r.hub.cardMissing) === '["language"]' && /the card lacks language\.$/.test(a.line), a.line);
}
{
  const url = MODEL + "/discussions";
  const r = await read(page("hf-discussions.html"), url, "");
  check("the Community tab reads every discussion and pull request with its comments and date", r.ok && r.reader === "hf.discussions" && r.count === 8 && r.rows[0].number === 19 && r.rows[0].url === MODEL + "/discussions/19" && r.rows[0].comments === 6 && r.rows.filter(x => x.pr).length === 1 && r.total === 19, r.rows[0]);
  const { a, s } = analyzed(r, "huggingface.co");
  check("the line counts discussions and pull requests and names the most commented one", /^zerack-demo\/tinyagent-7b-instruct: 19 discussions and pull requests \(5 closed\); 8 read, 7 discussions and 1 pull requests, the most commented "Tool calling template is missing from the tokenizer config" \(9 comments\)/.test(a.line), a.line);
  const reqs = K.requests(s.items.map(x => Object.assign({ host: "huggingface.co" }, x)), {});
  check("the discussion titles group into the requests that repeat: GGUF three times, tool calling twice", reqs.clusters[0] && /gguf/i.test(reqs.clusters[0].label) && reqs.clusters[0].count === 3 && reqs.clusters.some(c => /tool|calling|template/i.test(c.label) && c.count === 2) && reqs.clusters[0].sources["Hugging Face"] === 3, reqs.clusters.map(c => [c.label, c.count, c.sources]));
}
{
  const url = "https://github.com/mcp";
  const r = await read(page("github-mcp.html"), url, "");
  check("the GitHub MCP Registry reads every server with its stars, language and last push", r.ok && r.reader === "mcp.github" && r.count === 6 && r.total === 288 && r.rows[0].name === "zerack-demo/browser-mcp" && r.rows[0].stars === 2418 && r.rows[0].url === "https://github.com/zerack-demo/browser-mcp" && r.rows[0].pushed === "2026-09-26T21:03:34.000Z", r.rows[0]);
  const { a, s } = analyzed(r, "github.com");
  check("the line names the most starred servers", /^6 servers on screen of 288 in the GitHub MCP Registry; the most starred northwind\/docs-mcp \(15,333\), acme-labs\/sql-mcp \(9,120\), orbit-ai\/search-mcp \(4,410\); \d+ pushed in the last 7 days\./.test(a.line), a.line);
  check("the snapshot keeps each server's stars, so a later read can say which one accelerates", s.per["northwind/docs-mcp"].stars === 15333 && s.per["zerack-demo/browser-mcp"].url === "https://github.com/zerack-demo/browser-mcp" && s.metrics.servers === 6 && s.ids.length === 6, s.per);
  const one = await read(page("github-mcp-server.html"), "https://github.com/mcp/zerack-demo/browser-mcp", "");
  check("a server's own page reads that server, and is not taken for a repository called mcp", one.ok && one.reader === "mcp.github" && one.count === 1 && one.detail === true && reader(page("github-mcp-server.html"), "https://github.com/mcp/zerack-demo/browser-mcp").detect().join() === "mcp.github" && !/secret/.test(JSON.stringify(one)), one);
  const broken = await read(page("github-mcp.html").replace(/"stargazer_count":\d+/g, '"stars":1'), url, "mcp.github");
  check("servers without star counts answer drift", broken.ok === false && broken.code === "drift", broken);
}
{
  const url = "https://registry.modelcontextprotocol.io/?q=browser";
  const asked = [];
  const api = page("mcp-registry.json");
  const fetchJson = (u, init) => { asked.push({ u: String(u), init }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(api)) }); };
  const r = await read(page("mcp-registry.html"), url, "", {}, fetchJson);
  check("the official MCP Registry reads the servers from its own API, the way the page loads them, without cookies", r.ok && r.reader === "mcp.registry" && r.count === 5 && asked.length === 1 && asked[0].u === "/v0.1/servers?limit=100&version=latest&search=browser" && asked[0].init.credentials === "omit" && r.search === "browser", asked);
  check("each server keeps its version, status, repository, packages and last update", r.rows[0].name === "io.github.zerack-demo/browser-mcp" && r.rows[0].version === "1.4.0" && r.rows[0].status === "active" && r.rows[0].repo === "https://github.com/zerack-demo/browser-mcp" && r.rows[0].packages[0] === "npm:@zerack-demo/browser-mcp" && r.rows[2].remotes === 1, r.rows[0]);
  const { a } = analyzed(r, "registry.modelcontextprotocol.io");
  check("the line says how many shipped lately and on which package registries", /^5 servers read from the official MCP Registry for "browser"; \d+ updated in the last 7 days, the newest io\.github\.zerack-demo\/browser-mcp v1\.4\.0 on 2026-09-26; 2 npm, 1 oci, 1 remote, 1 pypi\.$/.test(a.line), a.line);
  const cards = await read(page("mcp-registry.html"), url, "", {}, () => Promise.resolve({ ok: false, status: 503 }));
  check("when the API does not answer, the cards on the page are read instead", cards.ok && cards.count === 2 && cards.via === "the cards on the page" && cards.rows[1].name === "io.github.acme-labs/sql-mcp" && cards.rows[1].version === "0.9.2", cards.rows);
  const direct = await read("<html><body><pre>" + api.replace(/</g, "&lt;") + "</pre></body></html>", "https://registry.modelcontextprotocol.io/v0.1/servers?search=x", "", {}, () => { throw new Error("no fetch on the API page"); });
  check("the API page itself is read as it is shown", direct.ok && direct.count === 5 && direct.via === "the API page", direct.via);
}
{
  const url = "https://github.com/zerack-demo/browser-mcp";
  const r = await read(page("github-mcp-repo.html"), url, "github.repo", {}, () => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") }));
  const { a } = analyzed(r, "github.com");
  check("an MCP server repository reads as a repository, and the line says it is an MCP server", r.ok && r.repo.stars === 2418 && r.repo.topics.includes("mcp-server") && /^zerack-demo\/browser-mcp \(an MCP server\): 2,418 stars/.test(a.line), a.line);
  check("an agent framework is named from its topics or description, and a plain repository is not", B.analyze({ ok: true, reader: "github.repo", repo: { owner: "o", repo: "r", topics: ["agent-framework"], stars: 1 }, rows: [] }, ENGINES).analysis.builds === "an agent framework" && B.analyze({ ok: true, reader: "github.repo", repo: { owner: "o", repo: "r", topics: ["cli"], description: "A tool for agents of change in real estate", stars: 1 }, rows: [] }, ENGINES).analysis.builds === "");
}
{
  const hosts = [["huggingface.co", "/zerack-demo/tinyagent-7b-instruct", "hf.model"], ["huggingface.co", "/spaces/zerack-demo/agent-arena", "hf.space"], ["huggingface.co", "/datasets/zerack-demo/tool-calls-10k", "hf.dataset"], ["huggingface.co", "/zerack-demo/tinyagent-7b-instruct/discussions", "hf.discussions"], ["huggingface.co", "/spaces/a/b/discussions", "hf.discussions"], ["github.com", "/mcp", "mcp.github"], ["github.com", "/mcp/zerack-demo/browser-mcp", "mcp.github"], ["registry.modelcontextprotocol.io", "/", "mcp.registry"], ["github.com", "/zerack-demo/browser-mcp", "github.repo"]];
  const off = hosts.filter(([h, p, want]) => { const r = P.readerFor("builders", h, p); return !r || r.as !== want; });
  check("the Builders agent picks the reader for each Hub, registry and repository page", off.length === 0, off);
  check("docs pages on the Hub get no model reader", P.readerFor("builders", "huggingface.co", "/docs/hub/model-cards") === null);
  check("the Hub, the official registry and the MCP listings the user opens belong to the Builders agent", ["huggingface.co", "registry.modelcontextprotocol.io", "smithery.ai", "glama.ai|/mcp/servers", "mcp.so", "www.pulsemcp.com"].every(x => P.forHost.apply(null, x.split("|")) === "builders") && P.forHost("glama.ai", "/") === "" && P.forQuery("How do I get more likes on my Hugging Face model?") === "builders" && P.forQuery("Which MCP servers are growing?") === "builders");
  check("Hub tokens and Space secrets stay private", P.privatePage("huggingface.co", "/settings/tokens").playbook === "builders" && !!P.privatePage("huggingface.co", "/spaces/a/b/settings") && P.privatePage("huggingface.co", "/a/b") === null);
  const gate = (host, path, name, extra) => { const r = G.check(Object.assign({ names: [name], host, path, what: 'click "' + name + '"', rules: G.compileRules(P.gateRules(host, path)) }, extra || {})); return r.ok ? "free" : (r.code === "needs_press" ? r.kind : "refused"); };
  const cases = [["huggingface.co", "/a/b", "Like", "refused"], ["huggingface.co", "/a/b", "Like 1.29k", "refused"], ["huggingface.co", "/a/b", "Unlike", "refused"], ["huggingface.co", "/a/b", "See users who liked this repository", "free"], ["huggingface.co", "/a/b", "Follow", "refused"],
    ["github.com", "/mcp/zerack-demo/browser-mcp", "Install in VS Code", "refused"], ["github.com", "/mcp", "Install in Cursor", "refused"], ["smithery.ai", "/server/x", "Install server", "refused"], ["huggingface.co", "/a/b/edit/main/README.md", "Commit changes to main", "Publish"],
    ["huggingface.co", "/spaces/a/b", "Restart this Space", "Publish"], ["huggingface.co", "/a/b/discussions", "New discussion", "Send"], ["huggingface.co", "/a/b/discussions/3", "Comment", "Send"], ["huggingface.co", "/a/b/settings", "Delete this model", "refused"], ["huggingface.co", "/a/b", "Use this model", "free"]];
  const bad = cases.filter(([h, p, n, want]) => gate(h, p, n) !== want);
  check("likes, installs and deletions are refused, commits and restarts wait for a Publish press, discussions for a Send press", bad.length === 0, bad.map(([h, p, n, w]) => n + " -> " + gate(h, p, n) + " want " + w));
  check("the install refusal holds on the link too", gate("github.com", "/mcp/x/y", "Install in VS Code", { link: true }) === "refused");
  const lesson = q => P.lessonsFor("builders", q).map(l => l.id);
  check("agent builders get their lessons by question", lesson("How do I publish my MCP server to the official registry?").includes("b5-l2") && lesson("Which rival agents are growing?").includes("b5-l4") && lesson("How do I describe my MCP tools?").includes("b5-l3") && lesson("Read my Hugging Face model card").includes("b5-l1") && lesson("What do people ask in my discussions?").includes("b5-l5"));
  const l2 = P.lookup("builders", { lesson: "b5-l2" }).lessons[0];
  check("each agent lesson cites the platform's own docs", l2.sources.every(s => /https:\/\/modelcontextprotocol\.io\/registry\//.test(s)) && P.lookup("builders", { lesson: "b5-l1" }).lessons[0].sources.every(s => /https:\/\/huggingface\.co\/docs\/hub\//.test(s)) && P.lookup("builders", { lesson: "b5-l4" }).lessons[0].sources.some(s => /https:\/\/docs\.github\.com\//.test(s)), l2.sources);
  check("the rivals metric for the Hub is likes and for the MCP listing stars", K.metricFor("hf.model") === "likes" && K.metricFor("hf.space") === "likes" && K.metricFor("mcp.github") === "stars");
}

done("extract-agents");
