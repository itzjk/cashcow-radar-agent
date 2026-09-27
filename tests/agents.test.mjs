// The named AI agents: one per playbook plus YouTube, picked by host or by the user, and the brain's identity says which one is talking.
import { load, check, done } from "./engines.mjs";

const PB = ["etsy", "shopify", "seo", "builders", "creators", "freelance", "local", "amazon", "newsletter", "digital", "index"].map(f => "knowledge/playbooks/" + f + ".js");
const C = load(["knowledge/youtube-playbook.js", "knowledge/reverse-engine.js", "knowledge/course.js"].concat(PB, ["lib/nsp-agents.js", "lib/nsp-brain.js", "chat/chat-tools.js"]), { URL });
C.self = C;
const A = C.NSP_AGENTS, P = C.NSP_PLAYBOOKS, B = C.NSP_BRAIN, T = C.NSP_CHAT_TOOLS;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const list = A.list();
check("eleven agents in the roster order: YouTube, Shopify, Etsy, Amazon, Creators, Freelance, Local business, SEO, Newsletter, Digital products, Builders",
  JSON.stringify(list.map(a => a.name)) === '["YouTube agent","Shopify agent","Etsy agent","Amazon agent","Creators agent","Freelance agent","Local business agent","SEO agent","Newsletter agent","Digital products agent","Builders agent"]', list.map(a => a.name));
check("every playbook is an agent and every business agent has its playbook, so no agent is invented", P.list().every(pb => A.get(pb.id) && A.get(pb.id).playbook === pb.id) && list.filter(a => a.id !== "youtube").every(a => P.get(a.id)), list.map(a => a.id));
check("there is no SaaS agent without a playbook: SaaS lives in the Builders agent", !A.get("saas") && /SaaS/.test(P.get("builders").business) && /SaaS/.test(P.get("builders").identity));
for (const a of list) {
  check(a.name + ": one line of what it decides and does, and the sites it works on", a.does.length >= 60 && a.does.length <= 170 && /[.]$/.test(a.does) && a.sites.length >= 1 && a.sites.every(s => /^[a-z0-9.\/*-]+$/.test(s)), a);
  check(a.name + ": no emoji and no long dash in what the user reads", !EMOJI.test(a.name + a.does + a.sites.join(" ")) && !/\u2014/.test(a.name + a.does + a.sites.join(" ")));
}
check("the roster sent to the chat carries at most six sites and says how many more", A.roster().find(a => a.id === "builders").sites.length === 6 && A.roster().find(a => a.id === "builders").more === 3 && A.roster().find(a => a.id === "etsy").more === 0);
check("an agent's full name is ZERACK plus its name", A.title("shopify") === "ZERACK Shopify agent" && A.title("nothing") === "ZERACK");
check("the registry cannot be replaced or changed", (() => { try { C.NSP_AGENTS = null; } catch (e) {} try { A.list()[0].name = "x"; } catch (e) {} return C.NSP_AGENTS === A && A.get("youtube").name === "YouTube agent"; })());

const site = (host, url, playbook) => ({ host, url: url || "https://" + host + "/", playbook: playbook || "" });
const autos = [
  [site("www.etsy.com", "https://www.etsy.com/listing/1/x"), "etsy"], [site("www.youtube.com"), "youtube"], [site("studio.youtube.com"), "youtube"],
  [site("github.com", "https://github.com/o/r"), "builders"], [site("huggingface.co", "https://huggingface.co/o/m"), "builders"], [site("registry.modelcontextprotocol.io"), "builders"],
  [site("admin.shopify.com", "https://admin.shopify.com/store/x/orders"), "shopify"], [site("www.google.com", "https://www.google.com/maps/search/dentist"), "local"], [site("www.google.com", "https://www.google.com/search?q=x"), ""],
  [site("blog.example.com", "https://blog.example.com/wp-admin/edit.php"), "seo"], [site("example.com"), ""], [null, "youtube"], [site("www.etsy.com", "https://www.etsy.com/", "etsy"), "etsy"], [site("example.com", "https://example.com/", "web"), ""]
];
const bad = autos.filter(([s, want]) => A.auto(s) !== want);
check("the agent for the site is picked by host and path, YouTube with no site, none on a site no playbook knows", bad.length === 0, bad.map(([s, w]) => (s ? s.url : "no site") + " -> " + A.auto(s) + " want " + w));

let picks = A.withPick({}, "github.com", "etsy", 5);
check("a pick is kept per host", A.pickIn(picks, "github.com") === "etsy" && A.pickIn(picks, "GitHub.com.") === "etsy" && A.pickIn(picks, "www.etsy.com") === "", picks);
check("a pick wins over the host, and says so", JSON.stringify(A.resolve(site("github.com", "https://github.com/o/r"), picks)) === '{"id":"etsy","how":"picked","auto":"builders"}');
check("without a pick the host decides", JSON.stringify(A.resolve(site("www.etsy.com", "https://www.etsy.com/search"), picks)) === '{"id":"etsy","how":"site","auto":"etsy"}' && JSON.stringify(A.resolve(site("example.com"), picks)) === '{"id":"","how":"none","auto":""}');
picks = A.withPick(picks, "github.com", "auto", 6);
check("auto takes the pick back", A.pickIn(picks, "github.com") === "" && Object.keys(picks).length === 0);
picks = A.withPick(picks, "", "builders", 7);
check("the chat with no site keeps its pick under its own key", A.pickIn(picks, "") === "builders" && A.pickIn(picks, "*") === "builders" && A.resolve(null, picks).id === "builders");
check("an unknown agent or a bad host is not stored", Object.keys(A.withPick({}, "github.com", "saas", 1)).length === 0 && Object.keys(A.withPick({}, "bad host/x", "etsy", 1)).length === 0 && Object.keys(A.clean({ "github.com": { agent: "nope" }, "x y": { agent: "etsy" }, "ok.example": { agent: "Etsy" } })).join() === "ok.example");
let many = {};
for (let i = 0; i < 305; i++) many = A.withPick(many, "h" + i + ".example", "etsy", i + 1);
check("picks are capped at 300 hosts, the oldest dropped", Object.keys(many).length === 300 && !many["h0.example"] && !!many["h304.example"]);

function prompt(opts) {
  const o = Object.assign({ surface: "chat", query: "What should I fix first?", context: T.context({ surface: "chat", agentOn: true, site: opts.site || null }) }, opts);
  const parts = B.parts(o);
  const tools = B.tools("chat", Object.assign({ agentOn: true }, o))[0].functionDeclarations.map(t => t.name);
  return { parts, tools, part: id => parts.filter(p => p.id === id).map(p => p.text).join("\n"), agent: B.agentOf(o) };
}
const web = host => ({ host, web: true, access: "act" });

for (const pb of P.list()) {
  const p = prompt({ site: web("x." + pb.id + ".example"), playbook: pb.id, pageTools: true });
  const name = A.get(pb.id).name;
  check(pb.id + ": the identity says it is the ZERACK " + name + " and keeps its method", p.part("identity").startsWith("You are the ZERACK " + name + ", the operator for") && /Find the bottleneck/.test(p.part("identity")) && p.agent === pb.id, p.part("identity").slice(0, 90));
  check(pb.id + ": the lean identity names the agent too", pb.identityLean.startsWith("You are ZERACK's " + name + ", "));
  check(pb.id + ": the contract, the page rules and the gate stay in the prompt", /ANSWER CONTRACT/.test(p.part("contract")) && /wait for the user to press a button in this chat/.test(p.part("page")) && /site_not_allowed/.test(p.part("page")));
}
{
  const y = prompt({ surface: "chat", site: null, query: "Why did this channel blow up?" });
  check("the YouTube agent names itself in its identity", /^You are the ZERACK YouTube agent, the sharpest YouTube automation mentor/.test(y.part("identity")) && y.agent === "youtube");
  const panel = B.parts({ surface: "youtube", query: "scan" }).find(x => x.id === "identity");
  check("and so does the panel on youtube.com", /^You are the ZERACK YouTube agent/.test(panel.text) && /^You are the ZERACK YouTube agent/.test(panel.lean));
  const roster = y.parts.find(x => x.id === "agents");
  check("a fill part names the other agents and says to point the user at the right one, without claiming their tools", roster && roster.need === "fill" && /you are the YouTube agent, one of the AI agents in the chat header/.test(roster.text) && /Shopify, Etsy, Amazon, Creators, Freelance, Local business, SEO, Newsletter, Digital products, Builders/.test(roster.text) && /never claim its tools/.test(roster.text), roster);
}
{
  const etsy = web("www.etsy.com");
  const auto = prompt({ site: etsy, playbook: "etsy", pageTools: true, query: "How do I grow my YouTube channel?" });
  check("by site, a YouTube question on Etsy still goes to the YouTube agent", auto.agent === "youtube" && /ZERACK YouTube agent/.test(auto.part("identity")));
  const pinned = prompt({ site: etsy, playbook: "etsy", pageTools: true, agent: "etsy", picked: true, query: "How do I grow my YouTube channel?" });
  const biz = prompt({ site: etsy, playbook: "etsy", pageTools: true });
  check("off YouTube the roster part names the other business agents and never YouTube, so the business prompt stays free of YouTube words", /you are the Etsy agent, one of the AI agents in the chat header/.test(biz.part("agents")) && /Shopify, Amazon, Creators/.test(biz.part("agents")) && !/YouTube/.test(biz.part("agents")), biz.part("agents"));
  check("once the user picks the Etsy agent, it answers even when the question names YouTube", pinned.agent === "etsy" && /ZERACK Etsy agent/.test(pinned.part("identity")) && pinned.tools.includes("zerackPlaybook") && !pinned.tools.includes("zerackXray"), pinned.tools);
  const yt = prompt({ site: etsy, playbook: "", pageTools: true, agent: "youtube", picked: true, query: "What should I fix first on this listing?" });
  check("picking the YouTube agent on Etsy gives the YouTube identity and its channel tools, and keeps the page gate", yt.agent === "youtube" && /ZERACK YouTube agent/.test(yt.part("identity")) && yt.tools.includes("zerackXray") && yt.tools.includes("zerackPage") && /wait for the user to press a button in this chat/.test(yt.part("page")), yt.tools);
  const shop = prompt({ site: web("github.com"), playbook: "shopify", pageTools: true, agent: "shopify", picked: true });
  check("the Shopify agent picked on GitHub brings its own break-even tool and lessons", shop.agent === "shopify" && /ZERACK Shopify agent/.test(shop.part("identity")) && shop.tools.includes("zerackBreakEven") && /PLAYBOOK, the method you apply on Shopify/.test(shop.part("course")));
  const none = prompt({ site: web("example.com"), playbook: "", pageTools: true });
  check("a site no agent knows keeps the general operator and says the user can pick an agent", none.agent === "" && /any online business/.test(none.part("identity")) && /the user can pick one of the AI agents/.test(none.part("agents")) && !/YouTube/.test(none.part("agents")));
  const local = B.layout(prompt({ site: etsy, playbook: "etsy", pageTools: true, agent: "etsy", picked: true }).parts, 3200);
  check("with the local model's 3,200 characters the Etsy agent still names itself", local.text.length <= 3200 && /ZERACK's Etsy agent|ZERACK Etsy agent/.test(local.text), local.parts);
}

done("agents");
