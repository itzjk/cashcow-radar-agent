// Off YouTube the chat is a business operator: no YouTube words in its prompt or tools, and the page tools only with the switch on.
import { load, check, done } from "./engines.mjs";

const C = load(["knowledge/youtube-playbook.js", "knowledge/reverse-engine.js", "knowledge/course.js", "lib/nsp-agents.js", "lib/nsp-brain.js", "chat/chat-tools.js"], { URL });
const B = C.NSP_BRAIN, T = C.NSP_CHAT_TOOLS;
const YT = /you ?tube|faceless|niches?\b|subscri|vph|thumbnail|channel|shorts|video|views per hour/i;

function prompt(query, site, agentOn) {
  const parts = B.parts({ surface: "chat", query, site, pageTools: !!(site && site.web && agentOn), context: T.context({ surface: "chat", agentOn, lang: "en", site }) });
  const tools = B.tools("chat", { agentOn, site, query })[0].functionDeclarations;
  return { parts, tools, ids: parts.map(p => p.id), names: tools.map(t => t.name), text: JSON.stringify(parts) + JSON.stringify(tools) };
}

const shop = { host: "admin.shopify.com", web: true, access: "act" };
const asks = ["How do I raise conversion on this store?", "Rewrite the title of this product", "What should I fix first on my SaaS landing page?", "Que cambio primero en esta tienda?"];
for (const q of asks) {
  const p = prompt(q, shop, true);
  const hit = p.text.match(YT);
  check('on a store, "' + q + '" gets no YouTube word in prompt or tools', !hit, hit && p.text.slice(Math.max(0, hit.index - 80), hit.index + 40));
  check('on a store, "' + q + '" gets the page tools and the page rules', p.names.includes("zerackPage") && p.names.includes("zerackPagePlan") && p.ids.includes("page"), p.names);
}
{
  const p = prompt("How do I raise conversion on this store?", shop, true);
  const identity = p.parts.find(x => x.id === "identity").text;
  check("the generic identity names stores and what builders build", /store/.test(identity) && /SaaS or an app the user is building/.test(identity), identity.slice(0, 200));
  check("the course and lessons stay out on a store", !p.ids.includes("course") && !p.ids.includes("lessons") && !p.ids.includes("playbook"), p.ids);
  check("the context names the site and what access it has", /on admin\.shopify\.com/.test(p.text) && /allowed to read and act/.test(p.text));
  const browser = p.tools.find(t => t.name === "zerackBrowser");
  check("the browser tool off YouTube has no YouTube actions", browser && !/youtube|search/i.test(JSON.stringify(browser)), browser);
}
{
  const p = prompt("How do I raise conversion on this store?", shop, false);
  check("with the switch off there are no page tools and no page rules", !p.names.includes("zerackPage") && !p.ids.includes("page"), p.names);
  check("and the context says the switch is off", /Agent switch is off/.test(p.text));
}
{
  const p = prompt("How do I raise conversion on this store?", { host: "shop.example.com", web: true, access: "none" }, true);
  check("on a site with no consent the context says so and points to the Allow button", /not allowed on that site yet/.test(p.text) && /Allow button/.test(p.text));
}
{
  const p = prompt("What niche should I start this week?", shop, true);
  check("a YouTube question on another site still gets the YouTube mentor", /YouTube/.test(p.parts.find(x => x.id === "identity").text) && p.names.includes("zerackYouTubeAgent"), p.names);
}
check("niche with a store word stays generic", B.youtubeTopic("What niche should my Etsy shop go into?") === false && B.youtubeTopic("Sell more shorts in my store") === false);
check("YouTube words switch to the mentor", ["how do I grow my channel", "ideas para mi canal", "faceless ideas", "what niche should I start"].every(q => B.youtubeTopic(q)));
{
  const p = prompt("How do I raise conversion?", null, true);
  check("with no web tab next to the chat it is the YouTube mentor, without page tools", /YouTube/.test(p.parts.find(x => x.id === "identity").text) && !p.names.includes("zerackPage"), p.names);
  const yt = prompt("How do I raise conversion?", { host: "www.youtube.com", web: false, access: "none" }, true);
  check("a YouTube tab gets no page tools", !yt.names.includes("zerackPage"), yt.names);
}

done("brain-web");
