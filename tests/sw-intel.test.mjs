// Channel intelligence inside the worker: the reader's header fields, typed and spoken requests, the chat card,
// the niche window read one channel at a time, the model tools, and who may ask for the tab's context.
import { loadWorker, SENDERS, check, done, EXT } from "./sw-harness.mjs";

const keep = setInterval(() => {}, 1000);
const ID = "UChhhhhhhhhhhhhhhhhhhhhh";
const NEAR = ["UCn1nnnnnnnnnnnnnnnnnnnn", "UCn2nnnnnnnnnnnnnnnnnnnn", "UCn3nnnnnnnnnnnnnnnnnnnn", "UCn4nnnnnnnnnnnnnnnnnnnn", "UCn5nnnnnnnnnnnnnnnnnnnn"];

function lockup(id, title, views, age, len) {
  return { richItemRenderer: { content: { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: id,
    contentImage: { thumbnailViewModel: { overlays: [{ thumbnailBottomOverlayViewModel: { badges: [{ thumbnailBadgeViewModel: { text: len } }] } }] } },
    metadata: { lockupMetadataViewModel: { title: { content: title }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: views } }, { text: { content: age } }] }] } } } } } } } };
}
function page(cid, name, handle, subs, count, items) {
  const rows = [{ metadataParts: [{ text: { content: handle } }] }, { metadataParts: [{ text: { content: subs } }, { text: { content: count } }] }];
  return "<html><script>var ytInitialData = " + JSON.stringify({
    header: { pageHeaderRenderer: { content: { pageHeaderViewModel: { metadata: { contentMetadataViewModel: { metadataRows: rows } } } } } },
    metadata: { channelMetadataRenderer: { title: name, externalId: cid, vanityChannelUrl: "http://www.youtube.com/" + handle } }, contents: items
  }) + ";</script></html>";
}
const SUBJECT = Array.from({ length: 30 }, (_, i) => {
  const n = 29 - i;
  const views = n < 12 ? 2000 + n * 100 : 40000 + n * 1000;
  return lockup(("h" + String(i).padStart(10, "0")).slice(0, 11), "The hidden history of the ancient empire part " + n, views.toLocaleString("en-US") + " views", (i + 1) + " weeks ago", "12:3" + (i % 10));
});
const YOUNG = k => Array.from({ length: 12 }, (_, i) => lockup(("y" + k + String(i).padStart(9, "0")).slice(0, 11), "Ancient empire secrets " + k + " " + i, "31,000 views", (i + 1) * 6 + " days ago", "10:00"));
const searches = [];
function fetchTable(url, init) {
  if (/\/@hist\/videos/.test(url) || /\/channel\/UChhhh/.test(url)) return { status: 200, body: page(ID, "History Deep", "@hist", "120K subscribers", "1.2K videos", SUBJECT) };
  const near = NEAR.find(id => url.includes("/channel/" + id + "/videos"));
  if (near) return { status: 200, body: page(near, "Young " + near.slice(2, 4), "@young" + near.slice(3, 4), "4.1K subscribers", "12 videos", YOUNG(near.slice(3, 4))) };
  if (/youtubei\/v1\/search/.test(url)) {
    const body = JSON.parse(init.body);
    searches.push(body);
    if (body.params === "EgIQAg==") return { status: 200, body: /nobody/.test(body.query) ? { contents: [] } : (/^(?:she|el)$/.test(body.query) ? { contents: [{ channelRenderer: { channelId: "UCssssssssssssssssssssss", title: { simpleText: "Sheet Music Daily" }, navigationEndpoint: { browseEndpoint: { canonicalBaseUrl: "/@sheetmusic" } } } }] } : { contents: [{ channelRenderer: { channelId: ID, title: { simpleText: "History Deep" }, navigationEndpoint: { browseEndpoint: { canonicalBaseUrl: "/@hist" } } } }] }) };
    return { status: 200, body: { contents: NEAR.concat([ID]).map((cid, i) => ({ videoRenderer: { videoId: "s" + String(i).padStart(10, "0"), title: { runs: [{ text: "Ancient empire secrets" }] }, ownerText: { runs: [{ text: "C", navigationEndpoint: { browseEndpoint: { browseId: cid } } }] } } })) } };
  }
  if (/feeds\/videos\.xml/.test(url)) return { status: 404, body: "" };
  return null;
}
function fakeStore() {
  const rows = [];
  let id = 0;
  return {
    rows,
    appendMessage: (convId, row) => { const r = Object.assign({ id: ++id, convId, at: Date.now() }, JSON.parse(JSON.stringify(row))); rows.push(r); return Promise.resolve(r); },
    updateMessage: (rid, patch) => { const r = rows.find(x => x.id === rid); if (r) Object.assign(r, JSON.parse(JSON.stringify(patch))); return Promise.resolve(true); },
    createConversation: o => Promise.resolve({ id: "c" + (++id), title: o.title }),
    getMessages: () => Promise.resolve(rows.slice())
  };
}
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 20)); } return null; };
const CHAT = { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=overlay", tab: { id: 21, url: "https://www.youtube.com/@hist/videos" }, frameId: 3, documentId: "doc-1" };

{
  const w = loadWorker({ fetch: fetchTable });
  const res = await w.context.nspReadChannelVideos("https://www.youtube.com/@hist", 30);
  check("the reader returns the handle, subscribers and channel id from the page header", res.handle === "@hist" && res.subscribers === 120000 && res.channelId === ID, { handle: res.handle, subs: res.subscribers, id: res.channelId });
  check("a rounded video count is not passed off as exact", res.videoCount === null, res.videoCount);
  check("every upload carries its duration", res.videos.every(v => /^12:3\d$/.test(v.length)), res.videos.slice(0, 3).map(v => v.length));
  const young = await w.context.nspReadChannelVideos("https://www.youtube.com/channel/" + NEAR[0], 30, { titles: false });
  check("an exact count is kept, and a numbers-only read skips the feed", young.videoCount === 12 && young.titleCheck.skipped === true && !w.fetches.some(f => /feeds\/videos\.xml\?channel_id=UCn1/.test(f.url)), { count: young.videoCount, check: young.titleCheck });
}

{
  const w = loadWorker();
  const route = t => w.context.nspVoiceRoute(t, "es");
  const r = route("oye zerack por qué explotó esto");
  check("said out loud, why did this blow up routes to an X-ray of the tab", r && r.kind === "intel" && r.intel.kind === "xray" && r.intel.who[0].tab === true && r.lang === "es", r);
  check("the other spoken cards route too", route("compara este canal con kurzgesagt").intel.kind === "duel" && route("clona la fórmula de este canal").intel.kind === "formula" && route("is this channel dead").intel.kind === "verdict");
  check("ordinary commands keep their routes", route("abre youtube").kind === "youtube" && route("busca historia de roma").kind === "search" && route("qué opinas de este canal") === null);
  check("a typed request is not sent through the spoken command runner", w.context.nspChatTyped("por que exploto esto", "es") === null);
  const tools = n => w.context.NSP_BRAIN.tools(n, { agentOn: false })[0].functionDeclarations.map(d => d.name);
  const intel = ["zerackXray", "zerackDuel", "zerackFormula", "zerackVerdict"];
  check("the chat and the voice get the four channel tools with the Agent switch off", intel.every(n => tools("chat").includes(n) && tools("voice").includes(n)), tools("chat"));
  check("the YouTube panel does not get them", !intel.some(n => tools("youtube").includes(n)));
}

{
  searches.length = 0;
  const w = loadWorker({ fetch: fetchTable });
  const store = fakeStore();
  w.context.NSP_CHAT_STORE = store;
  w.context.nspIntelTabUrl = () => Promise.resolve("https://www.youtube.com/@hist/videos");
  let answer = null;
  w.context.nspChatRun({ convId: "conv-1", text: "¿Por qué explotó este canal?", lang: "es" }, CHAT, r => { answer = r; });
  const row = await until(() => store.rows.find(r => r.role === "intel"));
  check("typed in the chat, the X-ray runs without a model and puts a card in the conversation", answer && answer.ok && row && row.meta.card.kind === "xray" && row.meta.card.hero.value === "20x", row && row.meta.card.hero);
  check("no AI provider was called", !w.fetches.some(f => /chat\/completions|api\.groq|api\.openai|generativelanguage|\/api\/chat/.test(f.url)), w.fetches.map(f => f.url));
  const patched = await until(() => row.meta.card.sections.find(s => s.id === "window").state === "done" && row, 15000);
  const win = patched && patched.meta.card.sections.find(s => s.id === "window");
  check("then it reads the niche and the window lands on the same card", win && win.rows[0].tag === "OPEN" && /4 of 4|5 of 5/.test(win.rows[0].value), win && win.rows.slice(0, 2));
  check("the niche search excludes the channel itself and asks for this month's uploads first", searches.some(s => s.params === "EgQIBBAB") && w.fetches.filter(f => /\/channel\/UCn\dn+\/videos/.test(f.url)).length === 5 && !w.fetches.some(f => /\/channel\/UChhhh.*\/videos/.test(f.url)), searches.map(s => s.params));
  check("the summary gains the window sentence in Spanish", /ventana está abierta/.test(patched.text), patched.text.slice(-120));
}

{
  const w = loadWorker({ fetch: fetchTable });
  const store = fakeStore();
  w.context.NSP_CHAT_STORE = store;
  w.context.nspIntelTabUrl = () => Promise.resolve("https://github.com/acme/widget");
  const thought = [];
  const think = w.context.nspChatThink;
  w.context.nspChatThink = run => { thought.push(run.text); return Promise.resolve(null); };
  for (const [i, t] of ["why did this blow up", "Is this dead?", "track this", "how much does she make"].entries()) w.context.nspChatRun({ convId: "conv-2" + i, text: t, lang: "en" }, CHAT, () => {});
  await until(() => thought.length === 4, 5000);
  check("off YouTube a phrase about this tab goes to the model, never to a YouTube card, and reads nothing on YouTube", thought.length === 4 && !store.rows.some(r => r.role === "intel" || /Open a YouTube channel/.test(r.text)) && !w.fetches.some(f => /youtube\.com/.test(f.url)), { thought, rows: store.rows.map(r => [r.role, String(r.text).slice(0, 60)]) });
  w.context.nspChatThink = think;
  w.context.nspIntelTabUrl = () => Promise.resolve("https://www.youtube.com/@hist/videos");
  w.context.nspChatRun({ convId: "conv-3", text: "compara este canal con nobody here", lang: "es" }, CHAT, () => {});
  const none = await until(() => store.rows.find(r => r.convId === "conv-3" && r.role === "assistant"));
  check("a name YouTube does not know is reported, not guessed", none && /No encontré un canal llamado nobody here/.test(none.text), none);
}

{
  const w = loadWorker({ fetch: fetchTable });
  const store = fakeStore();
  w.context.NSP_CHAT_STORE = store;
  const run = { convId: "conv-4", tabId: -1, stopped: false, gone: false, chain: Promise.resolve(), lang: "en" };
  const res = await new Promise(r => w.context.nspChatToolNow("zerackVerdict", { channel: "@hist" }, { origin: "chat", lang: "en", chatRun: run }, r));
  check("the model's verdict tool shows the card and returns its numbers", res.ok && res.shownInChat && res.data.verdict && store.rows.some(r => r.role === "intel" && r.meta.card.kind === "verdict"), res);
  const f = await new Promise(r => w.context.nspChatToolNow("zerackFormula", { channel: "History Deep" }, { origin: "chat", lang: "en", chatRun: run }, r));
  check("a channel named in words is found by a channel search", f.ok && f.data.channel === "History Deep", f);
  check("a search hit whose title and handle do not match the name is not taken", await w.context.nspIntelSearch("she") === "" && await w.context.nspIntelSearch("History Deep") === "https://www.youtube.com/@hist", null);
  check("a partial name that starts the channel title is taken", await w.context.nspIntelSearch("history") === "https://www.youtube.com/@hist");
  check("with no pixels to read, the thumbnail style is marked not measured", f.data.thumbnails === "not measured", f.data.thumbnails);
  const d = await new Promise(r => w.context.nspChatToolNow("zerackDuel", { channelA: "@hist" }, { origin: "chat", lang: "en", chatRun: run }, r));
  check("a duel with one side asks for the second channel", d.ok === false && /second channel/.test(d.error), d);
}

{
  const w = loadWorker({ fetch: fetchTable });
  const store = fakeStore();
  w.context.NSP_CHAT_STORE = store;
  w.context.nspIntelTabUrl = () => Promise.resolve("https://www.youtube.com/@hist");
  const run = { convId: "conv-5", tabId: 21, stopped: false, gone: false, chain: Promise.resolve(), lang: "en" };
  const p = w.context.nspIntelChat(run, { kind: "xray", who: [{ tab: true }] });
  run.stopped = true;
  await p;
  check("stopping before the card arrives leaves no card behind", !store.rows.length, store.rows);
}

{
  const w = loadWorker();
  let res = await w.send({ type: "NSP_INTEL_CONTEXT" }, SENDERS.youtube);
  check("youtube.com cannot ask which channel the tab shows", res && res.error === "sender_not_allowed", res);
  res = await w.send({ type: "NSP_INTEL_CONTEXT" }, SENDERS.site);
  check("nor can another site", res && res.error === "sender_not_allowed", res);
  res = await w.send({ type: "NSP_INTEL_CONTEXT" }, CHAT);
  check("a chat frame with no token is refused", res && res.ok === false, res);
  w.session.nsp_chat_docs = { "doc-1": { tabId: 21, at: Date.now() } };
  res = await w.send({ type: "NSP_INTEL_CONTEXT" }, CHAT);
  check("the chat in its own tab gets the handle of the channel on screen, not the address", res && res.ok && res.kind === "channel" && res.handle === "@hist" && !("url" in res), res);
}

clearInterval(keep);
done("sw-intel");
