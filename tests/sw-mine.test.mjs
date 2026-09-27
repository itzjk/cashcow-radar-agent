// Your channel inside the worker: remembering the user's channel (pasted or from Studio), Wrapped with the exact
// upload times, the next video with the hook written by the user's own provider, the title judge, the check before
// upload, the money card, the thumbnail concepts and the press that draws them, the model tools, and the door.
import { loadWorker, SENDERS, check, done, EXT, ROOT } from "./sw-harness.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const keep = setInterval(() => {}, 1000);
const ID = "UCmmmmmmmmmmmmmmmmmmmmmm";
const DAY = 86400000;
const NOW = Date.now();

function lockup(id, title, views, age, len) {
  return { richItemRenderer: { content: { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: id,
    contentImage: { thumbnailViewModel: { overlays: [{ thumbnailBottomOverlayViewModel: { badges: [{ thumbnailBadgeViewModel: { text: len } }] } }] } },
    metadata: { lockupMetadataViewModel: { title: { content: title }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: views } }, { text: { content: age } }] }] } } } } } } } };
}
function page(cid, name, handle, subs, items) {
  const rows = [{ metadataParts: [{ text: { content: handle } }] }, { metadataParts: [{ text: { content: subs } }] }];
  return "<html><script>var ytInitialData = " + JSON.stringify({
    header: { pageHeaderRenderer: { content: { pageHeaderViewModel: { metadata: { contentMetadataViewModel: { metadataRows: rows } } } } } },
    metadata: { channelMetadataRenderer: { title: name, externalId: cid, vanityChannelUrl: "http://www.youtube.com/" + handle } }, contents: items
  }) + ";</script></html>";
}
const IDS = Array.from({ length: 30 }, (_, i) => ("m" + String(i).padStart(10, "0")).slice(0, 11));
const TITLES = IDS.map((_, i) => i === 2 ? "The Lost Legion That Vanished in the Fog" : (i === 7 ? "Where the Lost Legion Marched Before It Vanished" : "Daily life in the ancient empire, part " + i));
const VIEWS = IDS.map((_, i) => i === 2 ? 180000 : (i === 7 ? 150000 : 12000 + (i % 4) * 500));
const HOUR = i => (i % 3 === 0 ? 21 : 14);
const AT = IDS.map((_, i) => { const d = new Date(NOW - (i + 1) * 3 * DAY); d.setUTCHours(HOUR(i), 5, 0, 0); return d.getTime(); });
IDS.forEach((_, i) => { if (i % 3 === 0 && i !== 2 && i !== 7) VIEWS[i] *= 2; });
const ITEMS = IDS.map((id, i) => lockup(id, TITLES[i], VIEWS[i].toLocaleString("en-US") + " views", ((i + 1) * 3) + " days ago", "21:1" + (i % 10)));
const FEED = '<?xml version="1.0"?><feed>' + IDS.slice(0, 15).map((id, i) => "<entry><yt:videoId>" + id + "</yt:videoId><title>" + TITLES[i] + "</title><published>" + new Date(AT[i]).toISOString() + "</published></entry>").join("") + "</feed>";
const POLICIES = readFileSync(join(ROOT, "data/policies.json"), "utf8");
const players = [];
const models = [];
const images = [];
let ollamaUp = false;
function fetchTable(url, init) {
  if (/\/@mine\/videos/.test(url) || /\/channel\/UCmmmm[^/]*\/videos/.test(url)) return { status: 200, body: page(ID, "History Deep", "@mine", "48.2K subscribers", ITEMS) };
  if (/feeds\/videos\.xml\?channel_id=UCmmmm/.test(url)) return { status: 200, body: FEED };
  if (/data\/policies\.json$/.test(url)) return { status: 200, body: JSON.parse(POLICIES) };
  if (/youtubei\/v1\/player/.test(url)) {
    const body = JSON.parse(init.body);
    players.push(body.videoId);
    const i = IDS.indexOf(body.videoId);
    return { status: 200, body: { videoDetails: { title: TITLES[i] || "x", channelId: ID }, microformat: { playerMicroformatRenderer: { publishDate: i >= 0 ? new Date(AT[i]).toISOString().replace(/\.\d+Z$/, "-00:00") : "2026-01-01" } } } };
  }
  if (/localhost:11434\/api\/tags/.test(url)) return ollamaUp ? { status: 200, body: { models: [{ name: "mock:1b" }] } } : { status: 503, body: {} };
  if (ollamaUp && /localhost:11434\/v1\/chat\/completions/.test(url)) {
    models.push(JSON.parse(init.body));
    return { status: 200, body: { choices: [{ message: { content: '{"title": "The Legion That Walked Into the Fog", "hook": "In the year 117 a whole legion marched north into the fog. Nobody ever saw it come back."}' } }] } };
  }
  if (/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash-image:generateContent/.test(url)) {
    images.push(JSON.parse(init.body));
    return { status: 200, body: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } }] } }] } };
  }
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
    getMessages: convId => Promise.resolve(rows.filter(r => !convId || r.convId === convId).map(r => JSON.parse(JSON.stringify(r))))
  };
}
const until = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 20)); } return null; };
const CHAT = { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=tab" };
const PROVIDER = /chat\/completions|api\.groq|api\.openai|generativelanguage|\/api\/chat/;
function worker(local) {
  const w = loadWorker({ fetch: fetchTable, local: local || {} });
  const store = fakeStore();
  w.context.NSP_CHAT_STORE = store;
  w.context.nspMineStudio = () => Promise.resolve("");
  w.context.nspMineStudioVideo = () => Promise.resolve("");
  w.context.nspIntelTabUrl = () => Promise.resolve("https://www.google.com/");
  return { w, store };
}
const run = (w, convId, text, lang) => new Promise(r => w.context.nspChatRun({ convId, text, lang: lang || "en" }, CHAT, r));
const job = (w, convId, jobSpec, text) => new Promise(r => w.context.nspMineRunMsg({ convId, text: text || "job", job: jobSpec, lang: "en" }, CHAT, r));

{
  const { w, store } = worker();
  await run(w, "c-1", "My Wrapped");
  const ask = await until(() => store.rows.find(r => r.convId === "c-1" && r.role === "intel"));
  check("with no channel known, Wrapped asks for it in a box", ask && ask.meta.card.kind === "ask" && ask.meta.card.form.op === "setmine" && ask.meta.card.then === "wrapped", ask && ask.meta.card);
  check("and reads nothing", !w.fetches.some(f => /youtube\.com/.test(f.url)));
  const res = await job(w, "c-1", { op: "setmine", ref: "@mine", then: "wrapped" }, "My channel is @mine");
  check("the box is accepted", res && res.ok === true, res);
  const card = await until(() => { const r = store.rows.find(x => x.convId === "c-1" && x.role === "intel" && x.meta.card.kind === "wrapped"); return r && r.meta.card; }, 15000);
  check("pasting the channel once saves it and goes on to Wrapped", card && w.local.nsp_my_channel && w.local.nsp_my_channel.id === ID && w.local.nsp_my_channel.from === "pasted", w.local.nsp_my_channel);
  const time = card && card.sections.find(s => s.id === "time");
  check("the feed gives exact times for 15 uploads and the player for the other 15, one at a time", players.length === 15 && time && /30 of the 30/.test(time.note), { players: players.length, note: time && time.note });
  check("the best publishing window is the one whose uploads beat their neighbors", time && time.rows.some(r => r.tag === "BEST"), time && time.rows);
  check("the best video and its multiple lead the card", card && /The Lost Legion That Vanished/.test(card.sections[0].rows[0].value) && /x$/.test(card.hero.value), card && card.hero);
  check("no AI provider was called for Wrapped", !w.fetches.some(f => PROVIDER.test(f.url)));
  await run(w, "c-2b", "my channel is @mine");
  const said = await until(() => store.rows.find(r => r.convId === "c-2b" && r.role === "assistant"));
  check("typed, my channel is saves it and says so", said && /History Deep is your channel from now on/.test(said.text) && !store.rows.some(r => r.convId === "c-2b" && r.role === "error"), said);
  players.length = 0;
  await run(w, "c-2", "resumen de mi canal", "es");
  const again = await until(() => store.rows.find(r => r.convId === "c-2" && r.role === "intel"));
  check("the saved channel is used the next time, in Spanish", again && again.meta.card.kind === "wrapped" && /tu mejor video/.test(again.text), again && again.text);
}

{
  const { w, store } = worker();
  w.context.nspMineStudio = () => Promise.resolve("https://www.youtube.com/channel/" + ID);
  await run(w, "c-3", "what is my next video?");
  const card = await until(() => { const r = store.rows.find(x => x.convId === "c-3" && x.role === "intel"); return r && r.meta.card.kind === "next" && r.meta.card; });
  check("an open YouTube Studio tab names the user's channel", card && w.local.nsp_my_channel && w.local.nsp_my_channel.from === "studio", w.local.nsp_my_channel);
  check("the next video follows the two outliers on one topic", card && /lost legion/i.test(card.hero.value), card && card.hero);
  const done1 = await until(() => { const r = store.rows.find(x => x.convId === "c-3" && x.role === "intel"); return r && r.meta.card.sections.find(s => s.id === "write").state === "done" && r; });
  check("without a provider the hook says it was not written, and no provider was called", done1 && done1.meta.card.sections.find(s => s.id === "write").rows.some(r => /no AI provider/.test(r.value)) && !w.fetches.some(f => PROVIDER.test(f.url)), done1 && done1.meta.card.sections.find(s => s.id === "write").rows);
}

{
  const corpus = Array.from({ length: 30 }, (_, i) => ({ t: i < 6 ? "The lost legion nobody found " + i : "Cooking at home " + i, v: i < 6 ? 5000 : 700, ts: NOW - DAY, n: "Historia", w: 1000, th: "" }));
  ollamaUp = true;
  const { w, store } = worker({ nsp_my_channel: { url: "https://www.youtube.com/channel/" + ID, id: ID, handle: "@mine", name: "History Deep", from: "pasted", at: NOW }, nsp_title_corpus: corpus, nsp_ollama_enabled: true, nsp_ollama_url: "http://localhost:11434", nsp_ollama_model: "mock:1b" });
  await run(w, "c-4", "¿cuál es mi próximo video?", "es");
  const row = await until(() => { const r = store.rows.find(x => x.convId === "c-4" && x.role === "intel"); return r && r.meta.card.sections.find(s => s.id === "write").state === "done" && r; }, 15000);
  const ev = row && row.meta.card.sections.find(s => s.id === "evidence");
  check("the user's own scans mark the topic as rising", ev && ev.rows.some(r => r.tag === "RISING"), ev && ev.rows.map(r => r.tag + " " + r.value));
  const wr = row && row.meta.card.sections.find(s => s.id === "write");
  check("the user's provider writes the title and the hook onto the card", wr && wr.rows[0].value === "The Legion That Walked Into the Fog" && wr.rows.some(r => r.label === "Hook" && /legion/.test(r.value)) && /local model/.test(wr.note), wr);
  const sent = JSON.stringify(models[0] || {});
  check("what the provider got is the evidence: titles and numbers, no page", models.length === 1 && /Lost Legion/.test(sent) && !/ytInitialData|<html/.test(sent), sent.slice(0, 200));
  ollamaUp = false;
}

{
  const { w, store } = worker({ nsp_my_channel: { url: "https://www.youtube.com/channel/" + ID, id: ID, handle: "@mine", name: "History Deep", from: "pasted", at: NOW } });
  await run(w, "c-5", "Judge this title: The Legion That Vanished Overnight");
  const t = await until(() => { const r = store.rows.find(x => x.convId === "c-5" && x.role === "intel"); return r && r.meta.card; });
  check("the title is judged against the user's own 30 titles", t && t.kind === "title" && t.sections[0].rows.some(r => /of your last 30 titles/.test(r.value)), t && t.sections[0].rows);
  await run(w, "c-6", "Check before upload");
  const box = await until(() => { const r = store.rows.find(x => x.convId === "c-6" && x.role === "intel"); return r && r.meta.card; });
  check("check before upload with nothing pasted opens the box", box && box.kind === "ask" && box.form.op === "policy", box);
  const before = w.fetches.length;
  await job(w, "c-6", { op: "policy", title: "The autopsy footage they hid", description: "", script: "The autopsy showed the mutilated body. This herb cures cancer." }, "Check before upload: The autopsy footage they hid");
  const pol = await until(() => { const r = store.rows.find(x => x.convId === "c-6" && x.role === "intel" && x.meta.card.kind === "policy"); return r && r.meta.card; });
  check("the check returns look at it with each flag", pol && pol.hero.value === "LOOK AT IT" && pol.sections.find(s => s.id === "flags").rows.filter(r => r.tag).length >= 2, pol && pol.sections.find(s => s.id === "flags").rows);
  check("and what was pasted never left the browser", !w.fetches.slice(before).some(f => !/data\/policies\.json$/.test(f.url)), w.fetches.slice(before).map(f => f.url));
  await run(w, "c-7", "cuánto gano con historia a 20 mil vistas por video, me cuesta 30 por video", "es");
  const m = await until(() => { const r = store.rows.find(x => x.convId === "c-7" && x.role === "intel"); return r && r.meta.card; });
  const pv = w.context.NspDineroRpm.porVideo({ tema: "historia", vistasPorVideo: 20000, idioma: "es" });
  check("the money card works out 8 videos at the table's RPM, in the market of the language asked in", m && m.kind === "money" && m.hero.value === "$" + (8 * pv.usdPorVideo).toFixed(2) && m.sections.find(s => s.id === "risk").rows.some(r => r.label === "Market" && /^ES, taken from the language you wrote in/.test(r.value)), [m && m.hero, pv.usdPorVideo]);
  check("and with a cost it says when a video pays itself back", m && m.sections.find(s => s.id === "breakeven").rows.some(r => r.label === "A video pays itself back at"));
  await run(w, "c-8", "Money calculator");
  const own = await until(() => { const r = store.rows.find(x => x.convId === "c-8" && x.role === "intel"); return r && r.meta.card; });
  check("the calculator alone uses the user's own niche and median", own && own.kind === "money" && /median of your last/.test(own.channel.line), own && own.channel);
}

{
  const { w, store } = worker({ nsp_my_channel: { url: "https://www.youtube.com/channel/" + ID, id: ID, handle: "@mine", name: "History Deep", from: "pasted", at: NOW } });
  await run(w, "c-9", "Thumbnail ideas for: The Legion That Vanished Overnight");
  const c = await until(() => { const r = store.rows.find(x => x.convId === "c-9" && x.role === "intel"); return r && r; });
  check("with no image key the ideas come as prompts and name the key that would draw them", c && c.meta.card.kind === "thumbgen" && !c.meta.card.draw && /Gemini key/.test(c.meta.card.keyNeeded), c && c.meta.card.keyNeeded);
  const res = await job(w, "c-9", { op: "draw", rowId: String(c.id) }, "Draw the 3 thumbnails");
  await until(() => !w.context._nspChat.runs["c-9"]);
  check("a draw press on a card with nothing to draw calls no provider", res.ok && !w.fetches.some(f => PROVIDER.test(f.url)) && store.rows.some(r => r.convId === "c-9" && /nothing left to draw/.test(r.text)));
}

{
  const { w, store } = worker({ nsp_my_channel: { url: "https://www.youtube.com/channel/" + ID, id: ID, handle: "@mine", name: "History Deep", from: "pasted", at: NOW }, nsp_gemini_api_key: "AIza" + "k".repeat(35) });
  w.context.nspMineShrink = (mime, b64) => Promise.resolve("data:image/jpeg;base64," + b64);
  await run(w, "c-10", "Thumbnail ideas for: The Legion That Vanished Overnight");
  const c = await until(() => store.rows.find(x => x.convId === "c-10" && x.role === "intel"));
  check("with a Gemini key the card offers the draw, and nothing is drawn yet", c && c.meta.card.draw && c.meta.card.draw.provider === "gemini" && images.length === 0 && !w.fetches.some(f => /generativelanguage/.test(f.url)), c && c.meta.card.draw);
  await until(() => !w.context._nspChat.runs["c-10"]);
  await job(w, "c-10", { op: "draw", rowId: String(c.id) }, "Draw the 3 thumbnails");
  const drawn = await until(() => { const r = store.rows.find(x => x.id === c.id); return r && r.meta.card.drawn && r; }, 15000);
  check("the press draws the three with the card's own prompts", drawn && images.length === 3 && images.every(b => /16:9/.test(b.contents[0].parts[0].text)) && drawn.meta.card.sections.filter(s => s.images && s.images[0] && s.images[0].big).length === 3, { images: images.length });
  check("the key goes to Google in the request and nowhere else", w.fetches.filter(f => /AIzakkkk/.test(f.url)).every(f => /^https:\/\/generativelanguage\.googleapis\.com\//.test(f.url)));
  check("a drawn card offers no second draw", !drawn.meta.card.draw);
  const bad = await new Promise(r => w.context.nspMineRunMsg({ convId: "c-11", text: "x", job: { op: "draw", rowId: "12; drop" } }, CHAT, r));
  check("a draw job must name a card row", bad.ok === false && bad.error === "bad_request", bad);
  const img = await new Promise(r => w.context.nspMineRunMsg({ convId: "c-12", text: "x", job: { op: "thumb", image: "javascript:alert(1)" } }, CHAT, r));
  check("a thumbnail job takes only an image data address", img.ok === false, img);
}

{
  const w = loadWorker();
  const route = t => w.context.nspVoiceRoute(t, "es");
  check("said out loud, my next video routes to the own-channel card", route("oye zerack cuál es mi próximo video").kind === "mine" && route("oye zerack cuál es mi próximo video").mine.kind === "next");
  check("so do Wrapped and the money question", route("mi wrapped").mine.kind === "wrapped" && route("cuánto gano con finanzas a 50 mil vistas").mine.kind === "money");
  check("the X-ray keeps its own route", route("por qué explotó esto").kind === "intel");
  check("everyday sentences are not commands", route("mi canal está muerto") === null && route("cuánto paga youtube por mil vistas") === null);
  const tools = n => w.context.NSP_BRAIN.tools(n, { agentOn: false })[0].functionDeclarations.map(d => d.name);
  const mine = ["zerackMyChannel", "zerackNextVideo", "zerackJudgeTitle", "zerackJudgeThumbnail", "zerackThumbnailIdeas", "zerackPolicyCheck", "zerackMoneyCalc"];
  check("the chat and the voice get the seven own-channel tools with the Agent switch off", mine.every(n => tools("chat").includes(n) && tools("voice").includes(n)));
  check("the YouTube panel does not", !mine.some(n => tools("youtube").includes(n)));
}

{
  const { w, store } = worker({ nsp_my_channel: { url: "https://www.youtube.com/channel/" + ID, id: ID, handle: "@mine", name: "History Deep", from: "pasted", at: NOW } });
  const r1 = { convId: "c-13", tabId: -1, stopped: false, gone: false, chain: Promise.resolve(), lang: "en" };
  const res = await new Promise(r => w.context.nspChatToolNow("zerackMoneyCalc", { niche: "personal finance", viewsPerVideo: 40000 }, { origin: "chat", lang: "en", chatRun: r1 }, r));
  check("the money tool shows the card and returns its numbers", res.ok && res.shownInChat && res.data.perMonth.length === 3 && store.rows.some(r => r.meta && r.meta.card && r.meta.card.kind === "money"), res);
  const n = await new Promise(r => w.context.nspChatToolNow("zerackNextVideo", {}, { origin: "chat", lang: "en", chatRun: r1 }, r));
  check("the next video tool returns the brief for the model and calls no provider itself", n.ok && n.brief && /Lost Legion/.test(JSON.stringify(n.brief)) && !w.fetches.some(f => PROVIDER.test(f.url)), n.brief);
  const th = await new Promise(r => w.context.nspChatToolNow("zerackJudgeThumbnail", {}, { origin: "chat", lang: "en", chatRun: r1 }, r));
  check("with no thumbnail anywhere the tool puts the drop box in the chat and says so", th.ok && th.card === "ask" && th.needsInput.includes("Thumbnail"), th);
}

{
  const w = loadWorker();
  let res = await w.send({ type: "NSP_MINE_RUN", convId: "x", text: "x", job: { op: "policy", title: "x" } }, SENDERS.youtube);
  check("youtube.com cannot run an own-channel job", res && res.error === "sender_not_allowed", res);
  res = await w.send({ type: "NSP_MINE_RUN", convId: "x", text: "x", job: { op: "policy", title: "x" } }, SENDERS.site);
  check("nor can another site", res && res.error === "sender_not_allowed", res);
  res = await w.send({ type: "NSP_MINE_RUN", convId: "x", text: "x", job: { op: "draw", rowId: "1" } }, { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=overlay", tab: { id: 21 }, frameId: 3, documentId: "doc-x" });
  check("a chat frame with no token cannot press draw", res && res.ok === false, res);
  w.local.nsp_my_channel = { url: "https://www.youtube.com/channel/" + ID, id: ID, handle: "@mine", name: "History Deep", from: "pasted", at: NOW };
  w.session.nsp_chat_docs = { "doc-1": { tabId: 21, at: Date.now() } };
  res = await w.send({ type: "NSP_INTEL_CONTEXT" }, { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=overlay", tab: { id: 21, url: "https://studio.youtube.com/channel/" + ID }, frameId: 3, documentId: "doc-1" });
  check("the chat learns the saved channel's handle and that Studio is open, never a URL", res && res.ok && res.mine && res.mine.handle === "@mine" && res.studio === true && !("url" in res.mine), res);
}

clearInterval(keep);
done("sw-mine");
