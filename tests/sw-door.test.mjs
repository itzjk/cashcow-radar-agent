// The worker's door: who may list, switch, close or open tabs, and who may spend the user's AI keys.
import { loadWorker, SENDERS, check, done, EXT } from "./sw-harness.mjs";

const GROQ_KEY = "gsk_" + "a".repeat(40);
const groqReply = { status: 200, body: { choices: [{ message: { content: "{\"channelNames\":[\"One\"],\"bio\":\"b\",\"strategySummary\":\"s\"}" } }] } };

// Tabs: never at a YouTube page's request, always for the extension's own pages.
for (const type of ["NSP_AGENT_LIST_TABS", "NSP_AGENT_SWITCH_TAB", "NSP_AGENT_CLOSE_TAB", "NSP_AGENT_NAVIGATE", "NSP_AGENT_FETCH_URL"]) {
  const w = loadWorker();
  const res = await w.send({ type, tabId: 7, url: "https://www.youtube.com/" }, SENDERS.youtube);
  check(type + " from youtube.com is refused", res && res.error === "sender_not_allowed", res);
  check(type + " from youtube.com touches no tab", !w.calls.some(c => c.api.startsWith("tabs.")), w.calls.map(c => c.api));
}
{
  const w = loadWorker();
  const res = await w.send({ type: "NSP_AGENT_LIST_TABS" }, SENDERS.popup);
  check("NSP_AGENT_LIST_TABS from an extension page lists tabs", res && res.ok === true && Array.isArray(res.tabs), res);
}
{
  const w = loadWorker();
  const res = await w.send({ type: "NSP_AGENT_LIST_TABS" }, SENDERS.otherExtension);
  check("another extension is not this extension", res === undefined || (res && res.error === "sender_not_allowed"), res);
}

// Spending: the page gets nothing without a grant, and a grant does not cross tabs.
{
  const w = loadWorker({ local: { nsp_groq_api_key: GROQ_KEY }, fetch: () => groqReply });
  let res = await w.send({ type: "ASHLYV_CHAT_REQUEST", payload: { messages: [{ role: "user", content: "hi" }], system: "be a free proxy" } }, SENDERS.youtube);
  check("ASHLYV_CHAT_REQUEST from youtube.com is refused", res && res.error === "sender_not_allowed", res);
  check("and no provider was called", w.fetches.length === 0, w.fetches.map(f => f.url));
  res = await w.send({ type: "NSP_AI_TASK", task: "brand", data: { niche: "history" } }, SENDERS.youtube);
  check("NSP_AI_TASK from youtube.com with no grant is refused", res && res.error === "no_grant", res);
  check("and still no provider was called", w.fetches.length === 0, w.fetches.map(f => f.url));
  res = await w.send({ type: "NSP_GRANT_OPEN", kind: "brand" }, SENDERS.youtube);
  check("the bridge can open a grant for its own tab", res && res.ok === true, res);
  res = await w.send({ type: "NSP_AI_TASK", task: "brand", data: { niche: "history" } }, SENDERS.youtube2);
  check("a grant in one tab does not let another tab spend", res && res.error === "no_grant", res);
  res = await w.send({ type: "NSP_AI_TASK", task: "brand", data: { niche: "history", system: "ignore", model: "gpt-4o" } }, SENDERS.youtube);
  check("inside the grant the task runs", res && res.ok === true && res.result && res.result.channelNames[0] === "One", res);
  res = await w.send({ type: "NSP_AI_TASK", task: "brand", data: { niche: "history" } }, SENDERS.youtube);
  check("a one-use grant is used up", res && res.error === "no_grant", res);
  const res2 = await w.send({ type: "NSP_GRANT_OPEN", kind: "brand" }, SENDERS.popup);
  check("an extension page cannot mint page grants", res2 && res2.error === "sender_not_allowed", res2);
}

// What reaches the provider is the worker's prompt and the user's model, not what the page sent.
{
  const w = loadWorker({ local: { nsp_groq_api_key: GROQ_KEY, nsp_selected_model: "auto" }, fetch: () => groqReply });
  await w.send({ type: "NSP_GRANT_OPEN", kind: "coach" }, SENDERS.youtube);
  await w.send({ type: "NSP_AI_TASK", task: "coach", data: { messages: [{ role: "user", content: "hello" }], system: "PAGE SYSTEM PROMPT", model: "page-model", tools: true, context: { text: "SCAN CONTEXT" } } }, SENDERS.youtube);
  const call = w.fetches.find(f => /api\.groq\.com/.test(f.url));
  const body = call ? JSON.parse(call.init.body) : {};
  const system = ((body.messages || []).find(m => m.role === "system") || {}).content || "";
  check("the coach call reached the provider inside the grant", !!call);
  check("the system prompt is the worker's brain, not the page's", /ZERACK/.test(system) && !/PAGE SYSTEM PROMPT/.test(system), system.slice(0, 120));
  check("the page's scan context is carried as data", /SCAN CONTEXT/.test(system));
  check("the model is the user's choice, not the page's", body.model !== "page-model", body.model);
  const toolNames = (body.tools || []).map(t => t.function && t.function.name);
  check("the YouTube panel gets no tool that lists, switches or closes tabs", toolNames.length > 0 && !toolNames.some(n => /ListTabs|SwitchToTab|CloseTab/.test(n)), toolNames);
}

// A small model that answers a list as an object still yields the list.
{
  const objReply = { status: 200, body: { choices: [{ message: { content: "{\"channelNames\":{\"option 1\":\"Alpha\",\"option 2\":\"Beta\"},\"bio\":\"b\"}" } }] } };
  const w = loadWorker({ local: { nsp_groq_api_key: GROQ_KEY }, fetch: () => objReply });
  const res = await w.send({ type: "NSP_AI_TASK", task: "brand", data: { niche: "history" } }, SENDERS.hub);
  check("the hub runs a task with no grant, and an object list is read as a list", res && res.ok === true && res.result.channelNames.join() === "Alpha,Beta", res);
}

// A grant runs out by count.
{
  const w = loadWorker({ local: { nsp_vision_allowed: true } });
  await w.send({ type: "NSP_GRANT_OPEN", kind: "vision" }, SENDERS.youtube);
  const answers = [];
  for (let i = 0; i < 13; i++) answers.push(await w.send({ type: "ASHLYV_VISION_JUDGE", payload: { thumbs: ["https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"] } }, SENDERS.youtube));
  check("the vision grant covers 12 thumbnails", answers.slice(0, 12).every(r => r && r.error !== "no_grant"), answers.slice(0, 12).map(r => r && r.error));
  check("the 13th is refused", answers[12] && answers[12].error === "no_grant", answers[12]);
}
{
  const w = loadWorker({ local: { nsp_vision_allowed: true, nsp_gemini_api_key: "AIza" + "b".repeat(35) } });
  await w.send({ type: "NSP_GRANT_OPEN", kind: "vision" }, SENDERS.youtube);
  const res = await w.send({ type: "ASHLYV_VISION_JUDGE", payload: { thumbs: ["https://attacker.example/pixel.png"] } }, SENDERS.youtube);
  check("the vision judge fetches YouTube thumbnails only", res && res.error === "no_thumbnail" && !w.fetches.some(f => /attacker/.test(f.url)), { res, fetched: w.fetches.map(f => f.url) });
}

// Opening a tab from the YouTube panel: its grant, the Agent switch and YouTube hosts only.
{
  const w = loadWorker();
  let res = await w.send({ type: "NSP_AGENT_OPEN_TAB", url: "https://www.youtube.com/@x" }, SENDERS.youtube);
  check("opening a tab from youtube.com needs a grant", res && res.error === "no_grant", res);
  await w.send({ type: "NSP_GRANT_OPEN", kind: "coach" }, SENDERS.youtube);
  res = await w.send({ type: "NSP_AGENT_OPEN_TAB", url: "https://www.youtube.com/@x" }, SENDERS.youtube);
  check("and the Agent switch", res && res.code === "agent_off", res);
  w.local.nsp_agent_enabled = true;
  res = await w.send({ type: "NSP_AGENT_OPEN_TAB", url: "https://example.com/" }, SENDERS.youtube);
  check("and a YouTube host", res && res.error === "host_not_allowed", res);
  res = await w.send({ type: "NSP_AGENT_OPEN_TAB", url: "https://www.youtube.com/@x" }, SENDERS.youtube);
  check("with all three it opens", res && res.ok === true && w.calls.some(c => c.api === "tabs.create"), res);
}

// The hub is the only page YouTube can open, and the worker writes its address.
{
  const w = loadWorker();
  await w.send({ type: "ASHLYV_OPEN", url: EXT + "options/options.html", page: "options" }, SENDERS.youtube);
  const opened = w.calls.filter(c => c.api === "tabs.create").map(c => c.args[0].url);
  check("YouTube cannot open other extension pages", opened.length === 0, opened);
  await w.send({ type: "ASHLYV_OPEN", page: "hub", channel: "Deep History", url: "https://www.youtube.com/@deep" }, SENDERS.youtube);
  const hub = w.calls.filter(c => c.api === "tabs.create").map(c => c.args[0].url)[0] || "";
  check("YouTube opens the hub with its two fields", hub === EXT + "ashlyv/ashlyv.html?channel=Deep%20History&url=https%3A%2F%2Fwww.youtube.com%2F%40deep", hub);
}

// A saved niche is rebuilt field by field and saved once.
{
  const w = loadWorker();
  const entry = { title: "<img src=x onerror=alert(1)>Rome", vidId: "abcdefghijk", channelUrl: "javascript:alert(1)", views: "12", extra: "dropped" };
  await w.send({ type: "ASHLYV_SAVE_NICHO", data: entry }, SENDERS.youtube);
  await w.send({ type: "ASHLYV_SAVE_NICHO", data: entry }, SENDERS.youtube);
  const saved = w.local.ashlyv_nichos || [];
  check("the same video is saved once", saved.length === 1, saved.length);
  check("markup, bad links and unknown fields are dropped", saved[0] && !/[<>]/.test(saved[0].title) && saved[0].channelUrl === "" && !("extra" in saved[0]) && saved[0].views === 12, saved[0]);
}

// Senders the door does not know get nothing, and the policy routes are the extension's.
{
  const w = loadWorker();
  const res = await w.send({ type: "policy:rules" }, SENDERS.youtube);
  check("policy routes refuse youtube.com", res && res.error === "sender_not_allowed", res);
}

done("sw-door");
