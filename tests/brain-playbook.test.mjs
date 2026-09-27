// The brain loads the playbook of the business in front of the user: its identity, its method, its sourced lessons and its tools, with no YouTube text.
import { load, check, done } from "./engines.mjs";

const C = load(["knowledge/youtube-playbook.js", "knowledge/reverse-engine.js", "knowledge/course.js", "knowledge/playbooks/etsy.js", "knowledge/playbooks/shopify.js", "knowledge/playbooks/seo.js", "knowledge/playbooks/builders.js", "knowledge/playbooks/index.js", "lib/nsp-brain.js", "chat/chat-tools.js"], { URL });
const B = C.NSP_BRAIN, T = C.NSP_CHAT_TOOLS, P = C.NSP_PLAYBOOKS;
const YT = /you ?tube|faceless|\bniches?\b|subscri|\bvph\b|thumbnail|channel|shorts|video|views per hour/i;
const YT_BUILDERS = /you ?tube|faceless|\bniches?\b|\bvph\b|thumbnail|channel|shorts|video|views per hour/i;

function prompt(query, site, agentOn, playbook) {
  const parts = B.parts({ surface: "chat", query, site, playbook, pageTools: !!(site && site.web && agentOn), context: T.context({ surface: "chat", agentOn, lang: "en", site }) });
  const tools = B.tools("chat", { agentOn, site, query, playbook })[0].functionDeclarations;
  return { parts, tools, ids: parts.map(p => p.id), names: tools.map(t => t.name), text: JSON.stringify(parts) + JSON.stringify(tools), part: id => (parts.find(p => p.id === id) || {}).text || "" };
}

const etsySite = { host: "www.etsy.com", web: true, access: "act" };
{
  const p = prompt("How do I raise conversion on my Etsy shop?", etsySite, true, "etsy");
  const hit = p.text.match(YT);
  check("on Etsy the prompt and the tools carry no YouTube word", !hit, hit && p.text.slice(Math.max(0, hit.index - 80), hit.index + 40));
  check("the identity is the Etsy operator with the Etsy bottlenecks", /operator for Etsy sellers/.test(p.part("identity")) && /13 tags/.test(p.part("identity")) && /Find the bottleneck/.test(p.part("identity")));
  check("the course part is the Etsy playbook with every lesson id", /^PLAYBOOK, the method you apply on Etsy/.test(p.part("course")) && ["e1-l1", "e1-l4", "e2-l2", "e3-l2"].every(id => p.part("course").includes(id)));
  check("the contract assumes an Etsy shop instead of asking", /assume a small Etsy shop selling to US buyers/.test(p.part("contract")) && /what an item costs them/.test(p.part("contract")));
  check("the page part names the Etsy readers and what drift means", /Readers for Etsy: etsy\.listing: .*etsy\.shop: .*etsy\.grid:/.test(p.part("page")) && /drift/.test(p.part("page")));
  check("the Etsy lessons for the question come in with their sources", /ETSY PLAYBOOK LESSONS/.test(p.part("lessons")) && /e2-l1/.test(p.part("lessons")) && /help\.etsy\.com/.test(p.part("lessons")), p.part("lessons").slice(0, 200));
  check("the tools read the page as numbers, open the playbook and work out the break-even", ["zerackExtract", "zerackPlaybook", "zerackBreakEven", "zerackPage", "zerackPagePlan"].every(n => p.names.includes(n)), p.names);
  check("the YouTube tools and course stay out", !p.names.some(n => /^nsp(Get|Save|Fetch|Export|Add)|zerackCourse|zerackYouTubeAgent/.test(n)) && !/COURSE, the playbook you apply/.test(p.text), p.names);
  check("the course part points at the lesson for this question even when the lessons are left out", /For this question, start with e2-l1\./.test(p.part("course")));
  const cloud = B.layout(p.parts, 9000);
  check("with a cloud model's budget the full lessons come in too", cloud.parts.find(x => x.id === "lessons").mode === "full" && /Fix what the Search visibility page flags/.test(cloud.text), cloud.parts);
  const local = B.layout(p.parts, 3200);
  check("with the local model's 3,200 characters the Etsy identity, assumption and playbook still fit", local.text.length <= 3200 && /operator for Etsy sellers/.test(local.text) && /assume a small Etsy shop/.test(local.text) && /PLAYBOOK/.test(local.text) && /start with e2-l1/.test(local.text), local.parts);
  const lean = B.layout(p.parts, 4200);
  check("under a small budget the playbook leans instead of dropping", lean.parts.find(x => x.id === "course").mode !== "dropped" && lean.text.length <= 4200, lean.parts);
}
{
  const p = prompt("How do I raise conversion on my Etsy shop?", etsySite, false, "etsy");
  check("with the Agent switch off there is no page reading, but the playbook and the break-even stay", !p.names.includes("zerackExtract") && !p.names.includes("zerackPage") && p.names.includes("zerackPlaybook") && p.names.includes("zerackBreakEven"), p.names);
}
{
  const id = P.forQuery("How do I get more sales on my Etsy shop?");
  const p = prompt("How do I get more sales on my Etsy shop?", null, true, id);
  check("with no web tab, a question about Etsy still loads the Etsy playbook", id === "etsy" && /operator for Etsy sellers/.test(p.part("identity")) && !p.names.includes("zerackPage") && p.names.includes("zerackPlaybook"), p.names);
  check("and nothing of YouTube comes with it", !YT.test(p.text), (p.text.match(YT) || [])[0]);
}
{
  const p = prompt("Which pages should I refresh first?", { host: "search.google.com", web: true, access: "read" }, true, "seo");
  check("Search Console loads the SEO playbook with its table reader", /sites that live on Google search traffic/.test(p.part("identity")) && /gsc\.queries/.test(p.part("page")) && /g1-l2/.test(p.part("lessons")), p.part("page").slice(-300));
  check("SEO has no fee table, so no break-even tool", !p.names.includes("zerackBreakEven") && p.names.includes("zerackPlaybook"));
  check("no YouTube word on Search Console", !YT.test(p.text), (p.text.match(YT) || [])[0]);
}
{
  const p = prompt("Which feature request repeats most here?", { host: "github.com", web: true, access: "act" }, true, "builders");
  check("builders get the builders operator, their readers and lessons", /operator for builders/.test(p.part("identity")) && /github\.issues/.test(p.part("page")) && /b1-l2/.test(p.part("lessons")), p.part("lessons").slice(0, 120));
  check("no YouTube word for builders", !YT_BUILDERS.test(p.text), (p.text.match(YT_BUILDERS) || [])[0]);
  const local = prompt("Why do users drop off in my onboarding?", { host: "localhost", web: true, access: "act" }, true, P.forHost("localhost", "/"));
  check("an app running on localhost is the builder's own app", /operator for builders/.test(local.part("identity")) && /b2-l3/.test(local.part("lessons")));
  check("builders get the builder tool and the part that says when to call it", p.names.includes("zerackBuilder") && /zerackBuilder: requests for the request that repeats/.test(p.part("builder")) && /on Hacker News the user writes the text by hand/.test(p.part("builder")), p.names);
  check("the builder tool lists every action and says every post waits for the user press", /requests \| askers \| rivals \| watch \| unwatch \| post \| changelog \| launch \| check/.test(JSON.stringify(p.tools.find(t => t.name === "zerackBuilder"))) && /waits for the user press/.test(p.tools.find(t => t.name === "zerackBuilder").description));
  const post = prompt("What should I post today?", { host: "github.com", web: true, access: "act" }, true, "builders");
  check("the post question brings the build in public lesson", /b4-l2/.test(post.part("lessons")) && /280 characters/.test(post.part("lessons")), post.part("lessons").slice(0, 160));
  const lean = B.layout(post.parts, 3200);
  check("with the local model's 3,200 characters the builder part still fits", lean.text.length <= 3200 && lean.parts.some(x => x.id === "builder" && x.chars > 0), lean.parts);
  const etsy = prompt("How do I raise conversion on my Etsy shop?", etsySite, true, "etsy");
  check("the builder tool is only for builders", !etsy.names.includes("zerackBuilder") && !etsy.ids.includes("builder"), etsy.names);
  const ask = prompt("Write the changelog for my repo", null, false, P.forQuery("Write the changelog for my repo"));
  check("a builder question with no page open still gets the builder tool", P.forQuery("Write the changelog for my repo") === "builders" && ask.names.includes("zerackBuilder"), ask.names);
}
{
  const p = prompt("What niche should I start this week on YouTube?", etsySite, true, "etsy");
  check("a YouTube question on Etsy still gets the YouTube mentor and not the Etsy playbook", /YouTube/.test(p.part("identity")) && !/Etsy/.test(p.part("identity")) && !p.names.includes("zerackPlaybook"), p.names);
}
{
  const v = B.parts({ surface: "voice", query: "How do I sell more on Etsy?", playbook: "etsy" });
  const vt = B.tools("voice", { agentOn: true, playbook: "etsy" })[0].functionDeclarations.map(t => t.name);
  check("the voice surface is untouched by playbooks", !JSON.stringify(v).includes("PLAYBOOK, the method") && !vt.includes("zerackPlaybook"));
  const y = B.parts({ surface: "youtube", query: "sell on Etsy", playbook: "etsy" });
  check("the YouTube panel is untouched by playbooks", !JSON.stringify(y).includes("PLAYBOOK, the method"));
  const none = prompt("How do I raise conversion on this store?", { host: "shop.example.com", web: true, access: "act" }, true, "");
  check("a store with no playbook keeps the general operator", /any online business/.test(none.part("identity")) && !none.names.includes("zerackPlaybook") && none.names.includes("zerackExtract"));
  const bad = prompt("How do I raise conversion?", etsySite, true, "amazon");
  check("an unknown playbook id is ignored", /any online business/.test(bad.part("identity")) && !bad.names.includes("zerackPlaybook"));
}
{
  const summary = B.toolSummary([{ name: "zerackExtract", args: {}, result: { ok: true, line: "x", rows: Array.from({ length: 50 }, (_, i) => ({ title: "Title " + i + " x".repeat(60) })) } }], { stepsUsed: 1, maxSteps: 40 });
  check("a read of the page reaches the model with room for its numbers", B.resultChars.zerackExtract >= 6000 && summary.length > 5000, summary.length);
  check("the chat names the read by what it read", T.label("zerackExtract", { reader: "etsy.grid" }) === "Read the Etsy listings on the page" && T.label("zerackExtract", {}) === "Read the numbers on the page" && T.label("zerackBreakEven", { price: 30 }) === "Work out what a $30 sale leaves");
  check("the chat row says drift, hidden and read only in words", T.note({ ok: false, code: "drift" }).startsWith("The site changed this page") && T.note({ ok: false, code: "not_exposed" }) === "This site hides that data: hidden, not empty" && /only reads dashboard\.stripe\.com/.test(T.note({ ok: false, code: "kept_read_only", host: "dashboard.stripe.com" })) && T.note({ ok: true, line: "36 listings read." }) === "36 listings read.");
}

done("brain-playbook");
