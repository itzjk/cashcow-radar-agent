// The brain for the Phase 4 businesses: each playbook brings its own operator, lessons, readers, platform terms and tools, the lead tool comes with its rules, and a spoken turn gets reading tools only.
import { load, check, done } from "./engines.mjs";

const PB = ["etsy", "shopify", "seo", "builders", "creators", "freelance", "local", "amazon", "newsletter", "digital", "index"].map(f => "knowledge/playbooks/" + f + ".js");
const C = load(["knowledge/youtube-playbook.js", "knowledge/reverse-engine.js", "knowledge/course.js"].concat(PB, ["lib/nsp-brain.js", "chat/chat-tools.js"]), { URL });
const B = C.NSP_BRAIN, T = C.NSP_CHAT_TOOLS, P = C.NSP_PLAYBOOKS;
const YT = /you ?tube|faceless|\bniches?\b|\bvph\b|thumbnail|\bchannels?\b|shorts|views per hour/i;
const YT_VIDEO = /you ?tube|\bvph\b|thumbnail|views per hour/i;

function prompt(query, site, agentOn, playbook, extra) {
  const o = Object.assign({ surface: "chat", query, site, playbook, pageTools: !!(site && site.web && agentOn), context: T.context({ surface: "chat", agentOn, lang: "en", site }) }, extra || {});
  const parts = B.parts(o);
  const tools = B.tools("chat", Object.assign({ agentOn, site, query, playbook }, extra || {}))[0].functionDeclarations;
  return { parts, tools, ids: parts.map(p => p.id), names: tools.map(t => t.name), text: JSON.stringify(parts) + JSON.stringify(tools), part: id => (parts.find(p => p.id === id) || {}).text || "" };
}
const site = host => ({ host, web: true, access: "act" });

const CASES = [
  ["creators", "www.tiktok.com", "Which of my videos broke out?", /operator for creators on TikTok and Instagram/, true, false, false],
  ["freelance", "www.upwork.com", "Which jobs should I bid on today?", /operator for freelancers on Upwork and Fiverr/, true, true, true],
  ["local", "www.google.com", "Which of these dentists should I pitch?", /operator for local businesses on Google Maps/, true, true, false],
  ["amazon", "www.amazon.com", "Is this search worth entering?", /operator for Amazon sellers and KDP authors/, true, false, true],
  ["newsletter", "lenny.substack.com", "Which posts landed?", /operator for newsletter writers on Substack and beehiiv/, false, false, true],
  ["digital", "app.gumroad.com", "What does a $29 sale leave me?", /operator for creators who sell digital products/, false, false, true]
];
for (const [id, host, q, who, terms, leads, fees] of CASES) {
  const p = prompt(q, site(host), true, id);
  const pb = P.get(id);
  const hit = p.text.match(id === "creators" ? YT_VIDEO : YT);
  check(id + ": the prompt and the tools carry no YouTube text", !hit, hit && p.text.slice(Math.max(0, hit.index - 60), hit.index + 30));
  check(id + ": the identity is its own operator with its bottlenecks and method", who.test(p.part("identity")) && p.part("identity").includes(pb.bottlenecks) && /Find the bottleneck/.test(p.part("identity")));
  check(id + ": the course part lists every lesson of the playbook", /^PLAYBOOK, the method you apply on /.test(p.part("course")) && pb.modules.every(m => m.lessons.every(l => p.part("course").includes(P.shortId(l.id)))), p.part("course").slice(0, 200));
  check(id + ": the contract assumes the business instead of asking", p.part("contract").includes(pb.assume));
  check(id + ": the page part names its readers", pb.readers.every(r => p.part("page").includes((r.as || r.id) + ": ")), p.part("page").slice(-300));
  check(id + ": the platform terms come in " + (terms ? "with their source" : "only where a platform limits automation"), terms ? /^PLATFORM TERMS: .*Source: /.test(p.part("terms")) : p.part("terms") === "", p.part("terms"));
  check(id + ": the lead rules come in " + (leads ? "because this business finds clients" : "only when asked"), leads ? /^LEADS: /.test(p.part("leads")) : p.part("leads") === "");
  check(id + ": the tools read the page, open the playbook, decide and work leads" + (fees ? ", and work out the break-even" : ""), ["zerackExtract", "zerackPlaybook", "zerackDecide", "zerackLeads", "zerackPage"].every(n => p.names.includes(n)) && p.names.includes("zerackBreakEven") === fees, p.names);
  const local = B.layout(p.parts, 3200);
  check(id + ": with the local model's 3,200 characters the operator, the assumption and the playbook still fit", local.text.length <= 3200 && (who.test(local.text) || local.text.includes(pb.identityLean)) && local.text.includes(pb.assume) && /PLAYBOOK/.test(local.text), local.parts.map(x => x.id + ":" + x.mode));
}

{
  const p = prompt("How do I grow a faceless account to 10K followers?", site("www.tiktok.com"), true, "creators");
  check("faceless and followers on TikTok stay with the creators operator", /operator for creators/.test(p.part("identity")) && p.names.includes("zerackPlaybook"));
  const n = prompt("How do I get more subscribers?", site("lenny.substack.com"), true, "newsletter");
  check("subscribers on Substack stay with the newsletter operator", /operator for newsletter writers/.test(n.part("identity")) && n.names.includes("zerackPlaybook"));
  const y = prompt("How do I get more subscribers on my YouTube channel?", site("lenny.substack.com"), true, "newsletter");
  check("a question that names YouTube still goes to the YouTube mentor", !/operator for newsletter/.test(y.part("identity")) && !y.names.includes("zerackPlaybook"));
  const e = prompt("How do I get more subscribers?", site("www.etsy.com"), true, "etsy");
  check("on other playbooks the old YouTube words keep their meaning", !e.names.includes("zerackPlaybook"));
}

{
  const g = prompt("Find me clients on this page", site("shop.example.com"), true, "");
  check("on a site with no playbook, asking for clients brings the lead rules and the lead tool", /^LEADS: /.test(g.part("leads")) && g.names.includes("zerackLeads"));
  const s = prompt("What should I change on this page?", site("shop.example.com"), true, "");
  check("and a question about something else does not", s.part("leads") === "" && s.names.includes("zerackLeads"));
  const d = s.tools.find(t => t.name === "zerackLeads");
  check("the lead tool lists its actions and says Send waits for the user press inside the cap", /find judges/.test(d.description) && /the press waits for the user/.test(d.description) && /refused past the cap, to the same place twice, or without the disclosure and opt-out lines/.test(d.description) && d.parameters.properties.action && d.parameters.properties.max);
  const step = s.tools.find(t => t.name === "zerackPage");
  check("a page step can carry the lead id of the message it types or sends", step.parameters.properties.lead && /drafted by zerackLeads/.test(step.parameters.properties.lead.description));
  const yt = prompt("Find clients for my channel", { host: "www.youtube.com", web: false, access: "none" }, true, "");
  check("YouTube keeps its own tools, with no lead tool", !yt.names.includes("zerackLeads"));
}

{
  const v = prompt("Which of these dentists should I pitch?", site("www.google.com"), true, "local", { readOnly: true, spoken: true });
  check("a spoken business turn reads the page but has no tool that clicks, types or sends", v.names.includes("zerackExtract") && v.names.includes("zerackLeads") && !v.names.includes("zerackPage") && !v.names.includes("zerackPagePlan"), v.names);
  check("and its instructions say the chat does the steps with the user's press", /This turn is spoken, so nothing on the page can be clicked, typed or sent/.test(v.part("page")) && !/zerackPagePlan runs several/.test(v.part("page")) && v.ids.includes("spoken"));
}

{
  check("the chat names the lead work by its action", T.label("zerackLeads", { action: "find" }) === "Judge who to contact" && T.label("zerackLeads", { action: "draft" }) === "Draft the message" && T.label("zerackLeads", { action: "mark", outcome: "opted_out" }) === "Record what happened: opted out" && T.label("zerackLeads", {}) === "Work the leads");
  check("the chat names every new read", T.label("zerackExtract", { reader: "maps.results" }) === "Read the places on the map" && T.label("zerackExtract", { reader: "upwork.jobs" }) === "Read the jobs on the page" && T.label("zerackExtract", { reader: "tiktok.profile" }) === "Read the TikTok profile" && T.label("zerackExtract", { reader: "amazon.product" }) === "Read the Amazon product");
  check("a refused send says why in the chat row, in words for the user", T.note({ ok: false, code: "cap", why: "Today's cap of 5 is used up; it rises by 5 each day up to 30", error: "Not offered: x. To do it: y. Tell the user why." }) === "Not offered: Today's cap of 5 is used up; it rises by 5 each day up to 30" && /needs a drafted lead/.test(T.note({ ok: false, code: "lead_needed" })));
  check("the lead tool's result gets room in the model's context", B.resultChars.zerackLeads >= 5000);
}

done("brain-business");
