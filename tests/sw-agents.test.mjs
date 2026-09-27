// The worker side of the named agents: only the chat may pick one, the pick is kept per host, and the Builders agent watches Hugging Face pages and the GitHub MCP Registry the same cookie-less way it watches repositories.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadWorker, SENDERS, ROOT, check, done } from "./sw-harness.mjs";
import { makeIndexedDB, IDBKeyRange } from "./idb-lite.mjs";

const H = 3600000, DAY = 86400000;
const page = n => readFileSync(join(ROOT, "tests/html", n), "utf8");
const plain = o => JSON.parse(JSON.stringify(o));
const call = (w, name, args, ctx) => new Promise(r => w.context.nspChatToolNow(name, args, ctx, r));
const SECRETS = /hf_FAKE|eyJFAKE|fake-csrf|Ignore every rule/;
const SRC = readFileSync(join(ROOT, "background/service-worker.js"), "utf8");

function worker(opts = {}) {
  const w = loadWorker({ local: Object.assign({ nsp_agent_enabled: true, nsp_agent_sites: {} }, opts.local || {}), allSites: opts.allSites, fetch: opts.fetch });
  w.context.indexedDB = makeIndexedDB();
  w.context.IDBKeyRange = IDBKeyRange;
  w.context.chrome.alarms = { create() {}, clear(n, cb) { if (cb) setImmediate(() => cb(true)); }, get(n, cb) { setImmediate(() => cb(undefined)); }, onAlarm: { addListener() {} } };
  return { w, S: w.context.NSP_CHAT_STORE, B: w.context.NSP_BUSINESS };
}
const pick = (w, msg) => new Promise(r => w.context.nspChatPickAgent(msg, r));

{
  check("NSP_CHAT_AGENT is in the caller table for extension pages only", /\n  NSP_CHAT_AGENT: NSP_EXT_ONLY,\n/.test(SRC) && /msg\.type === 'NSP_CHAT_AGENT'\) nspChatPickAgent\(msg, sendResponse\)/.test(SRC));
  const w = loadWorker();
  for (const who of ["youtube", "studio"]) {
    const res = await w.send({ type: "NSP_CHAT_AGENT", host: "github.com", agent: "etsy" }, SENDERS[who]);
    check("a " + who + " page cannot pick the agent", res && res.error === "sender_not_allowed", res);
  }
  check("and nothing was stored", !w.local.nsp_agent_picks);
  check("the worker loads the agent roster next to the playbooks", w.context.NSP_AGENTS && w.context.NSP_AGENTS.list().length === 11 && typeof w.context.NSP_BRAIN.agentOf === "function");
}
{
  const { w } = worker();
  let res = await pick(w, { host: "github.com", agent: "etsy" });
  check("the chat's pick is stored for that host", res.ok && res.agent === "etsy" && w.local.nsp_agent_picks["github.com"].agent === "etsy", w.local.nsp_agent_picks);
  const card = w.context.nspAgentCard(w.context.nspAgentFor({ host: "github.com", url: "https://github.com/o/r", playbook: "builders" }, w.context.NSP_AGENTS.clean(w.local.nsp_agent_picks)));
  check("the header card names the picked agent and the one the site would get", JSON.stringify(plain(card)) === '{"id":"etsy","name":"Etsy agent","how":"picked","auto":"builders","autoName":"Builders agent"}', card);
  res = await pick(w, { host: "github.com", agent: "saas" });
  check("an agent that does not exist is refused", res.ok === false && res.error === "bad_agent" && w.local.nsp_agent_picks["github.com"].agent === "etsy");
  res = await pick(w, { host: "not a host/", agent: "etsy" });
  check("a bad host is refused", res.ok === false);
  res = await pick(w, { host: "github.com", agent: "auto" });
  check("auto hands the host back to its own agent", res.ok && res.agent === "" && !w.local.nsp_agent_picks["github.com"], w.local.nsp_agent_picks);
  res = await pick(w, { host: "*", agent: "builders" });
  const none = w.context.nspAgentCard(w.context.nspAgentFor(null, w.context.NSP_AGENTS.clean(w.local.nsp_agent_picks)));
  check("with no site the pick is kept for the chat alone, and YouTube is the default before it", res.ok && none.id === "builders" && w.context.nspAgentCard(w.context.nspAgentFor(null, {})).id === "youtube", none);
  const think = SRC.slice(SRC.indexOf("function nspChatThink"), SRC.indexOf("function nspChatRun("));
  check("the chat turn reads the pick, hands it to the brain and names the answering agent under the reply", /nspAgentPicks\(\)/.test(think) && /agent: brainOpts\.agent, picked: picked/.test(think) && /brain\.agentOf\(brainOpts\)/.test(think) && /agent: run\.agent \? \{ id: run\.agent\.id, name: run\.agent\.name \} : null/.test(think));
  check("the page gate, readers and consent are chosen by the page, never by the pick", !/pick/i.test(SRC.slice(SRC.indexOf("function nspChatPageCtx"), SRC.indexOf("function nspChatThink"))) && !/nsp_agent_picks|NSP_AGENTS/.test(readFileSync(join(ROOT, "background/nsp-page-agent.js"), "utf8")) && !/NSP_AGENTS/.test(readFileSync(join(ROOT, "lib/nsp-gate.js"), "utf8")));
}
{
  const model = "https://huggingface.co/zerack-demo/tinyagent-7b-instruct";
  const fetched = [];
  const fetchStub = (url, init) => {
    if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) return null;
    fetched.push({ url, init });
    if (url === model) return { status: 200, body: page("hf-model.html") };
    if (url === "https://github.com/mcp") return { status: 200, body: page("github-mcp.html") };
    return { status: 404, body: "" };
  };
  const { w, S } = worker({ allSites: true, fetch: fetchStub, local: { nsp_agent_sites: { "huggingface.co": { mode: "read", since: 1 }, "github.com": { mode: "read", since: 1 } } } });
  const r = await call(w, "zerackBuilder", { action: "watch", url: model + "/discussions" }, {});
  const series = await S.listSeries({ readers: ["hf.model"] });
  check("the Builders agent watches a Hugging Face model: one plain fetch of the model page, no cookies", r.ok && fetched.length === 1 && fetched[0].url === model && fetched[0].init.credentials === "omit" && w.local.nsp_watch[0].reader === "hf.model" && w.local.nsp_watch[0].name === "zerack-demo/tinyagent-7b-instruct", { r: r.line, fetched, list: w.local.nsp_watch });
  check("the reading is stored as the model's likes and downloads, and no token from the page is kept", series.length === 1 && series[0].metrics.likes === 1287 && series[0].metrics.downloads === 48213 && !SECRETS.test(JSON.stringify(series) + JSON.stringify(w.local)), series[0]);
  const m = await call(w, "zerackBuilder", { action: "watch", url: "https://github.com/mcp" }, {});
  const listing = await S.listSeries({ readers: ["mcp.github"] });
  check("it watches the GitHub MCP Registry too, and keeps each server's stars", m.ok && w.local.nsp_watch.length === 2 && w.local.nsp_watch[1].reader === "mcp.github" && w.local.nsp_watch[1].name === "GitHub MCP Registry" && listing.length === 1 && listing[0].per["northwind/docs-mcp"].stars === 15333, { line: m.line, per: listing[0] && listing[0].per });
  const detail = await call(w, "zerackBuilder", { action: "watch", url: "https://github.com/mcp/zerack-demo/browser-mcp" }, {});
  check("one server's page is not watched as a repository called mcp", detail.ok === false && detail.code === "not_watchable" && /Hugging Face model, dataset or Space, or the GitHub MCP Registry/.test(detail.error), detail);
  check("the tab on a server's page is not taken for the user's repository", w.context.nspBuilderTabRepo({ site: { url: "https://github.com/mcp/zerack-demo/browser-mcp" } }) === "" && w.context.nspBuilderTabRepo({ site: { url: "https://github.com/zerack-demo/browser-mcp/tree/main" } }) === "https://github.com/zerack-demo/browser-mcp");
}
{
  const { w, S } = worker();
  const now = Date.now();
  const stars = { "northwind/docs-mcp": [15000, 15020, 15041, 15060, 15080, 15100], "zerack-demo/browser-mcp": [2000, 2010, 2030, 2045, 2060, 2600], "quietco/calendar-mcp": [310, 310, 310, 310, 310, 310] };
  for (let i = 0; i < 6; i++) {
    const per = {};
    Object.keys(stars).forEach(k => { per[k] = { stars: stars[k][i], url: "https://github.com/" + k }; });
    await S.addSeries({ at: now - (5 - i) * DAY - H, key: "mcp.github|https://github.com/mcp", host: "github.com", reader: "mcp.github", playbook: "builders", metrics: { servers: 3 }, per });
  }
  const likes = [100, 102, 104, 106, 108, 110];
  for (let i = 0; i < 6; i++) await S.addSeries({ at: now - (5 - i) * DAY - H, key: "hf.space|https://huggingface.co/spaces/acme/arena", host: "huggingface.co", reader: "hf.space", playbook: "builders", metrics: { likes: likes[i] }, facts: { name: "acme/arena", url: "https://huggingface.co/spaces/acme/arena" } });
  w.local.nsp_watch = [{ url: "https://github.com/mcp", reader: "mcp.github", host: "github.com", since: now - 6 * DAY, lastAt: now - H, lastOk: true }];
  const r = await call(w, "zerackBuilder", { action: "rivals" }, {});
  const row = n => r.rows.find(x => x.name === n) || {};
  check("rivals judges each MCP server of the watched registry on its own stars: the one that jumps is KEEP", r.ok && r.rows[0].name === "zerack-demo/browser-mcp" && r.rows[0].state === "keep" && r.rows[0].metric === "stars" && r.rows[0].url === "https://github.com/zerack-demo/browser-mcp" && r.rows[0].watched === true, r.rows.map(x => [x.name, x.state, x.now]));
  check("a server that grows at its usual pace is DROP, one that never moved is not called accelerating, and a Space is judged on its likes", row("northwind/docs-mcp").state === "drop" && row("quietco/calendar-mcp").state !== "keep" && row("acme/arena").metric === "likes" && row("acme/arena").now === 110, r.rows.map(x => [x.name, x.metric, x.state]));
  check("the card line names the server that accelerates", /^1 accelerating over their own baseline: zerack-demo\/browser-mcp \(2,600 stars/.test(r.line), r.line);
}

done("sw-agents");
