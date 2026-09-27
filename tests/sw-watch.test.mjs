// Watch and predict inside the worker: the hourly outlier check against the channel median with its notification
// and the click that opens the X-ray, the morning brief on its alarm, sealed predictions and their 14 days,
// the language gaps from stored titles and the measure button, the comments read page by page with the ideas
// written by the user's provider, the model tools, and who may press the card buttons.
import { loadWorker, SENDERS, check, done, EXT } from "./sw-harness.mjs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const keep = setInterval(() => {}, 1000);
const HOUR = 3600000, DAY = 86400000;

function lockup(id, title, views, age) {
  return { richItemRenderer: { content: { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: id,
    metadata: { lockupMetadataViewModel: { title: { content: title }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: views } }, { text: { content: age } }] }] } } } } } } } };
}
function page(cid, name, handle, items) {
  return "<html><script>var ytInitialData = " + JSON.stringify({ metadata: { channelMetadataRenderer: { title: name, externalId: cid, vanityChannelUrl: "http://www.youtube.com/" + handle } }, contents: items }) + ";</script></html>";
}
function about(cid, name, joined, views) {
  return "<html><script>var ytInitialData = " + JSON.stringify({ metadata: { channelMetadataRenderer: { title: name, externalId: cid } }, onResponseReceivedEndpoints: [{ appendContinuationItemsAction: { continuationItems: [{ aboutChannelRenderer: { metadata: { aboutChannelViewModel: { channelId: cid, joinedDateText: { content: "Joined " + joined }, viewCountText: views.toLocaleString("en-US") + " views", subscriberCountText: "1.2K subscribers", videoCountText: "20 videos" } } } }] } }] }) + ";</script></html>";
}
const vid = (p, i) => (p + String(i).padStart(10, "0")).slice(0, 11);
const HIST = "UChhhhhhhhhhhhhhhhhhhhhh";
let histItems = Array.from({ length: 20 }, (_, i) => lockup(vid("h", i), "Old history upload " + i, (10000 + i * 100).toLocaleString("en-US") + " views", (i + 2) + " weeks ago"));
const NEW_HIT = lockup(vid("n", 1), "The legion that vanished overnight", "84,000 views", "19 hours ago");
const NEW_SMALL = lockup(vid("n", 2), "A quiet upload", "3,000 views", "5 hours ago");

const searches = [];
const models = [];
let ollamaUp = false;
let aboutViews = {};
const young = Array.from({ length: 14 }, (_, i) => "UCy" + String(i).padStart(21, "0"));
const COMMENT_VID = "cccccccccc1";
function commentsPage(n, next) {
  const muts = [];
  for (let i = 0; i < 20; i++) {
    const k = n * 20 + i;
    const text = k === 3 ? "Can you make a video about the Aztec empire?" : k === 7 ? "Part 2 please, the Byzantine side" : k === 25 ? "haz un video de los mayas por favor" : "Great video number " + k;
    muts.push({ payload: { commentEntityPayload: { properties: { commentId: "c" + k, content: { content: text }, replyLevel: 0 }, toolbar: { likeCountNotliked: k === 3 ? "1.2K" : k === 7 ? "340" : String(k) }, author: { displayName: "@viewer" + k } } } });
  }
  muts.push({ payload: { commentEntityPayload: { properties: { commentId: "r1", content: { content: "a reply that asks: can you make a video about this reply?" }, replyLevel: 1 }, toolbar: {} } } });
  const items = [{ commentThreadRenderer: {} }];
  if (next) items.push({ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: next } } } });
  return { onResponseReceivedEndpoints: [{ reloadContinuationItemsCommand: { continuationItems: items } }], frameworkUpdates: { entityBatchUpdate: { mutations: muts } } };
}
function fetchTable(url, init) {
  if (/\/@hist\/videos/.test(url) || /\/channel\/UChhhh[^/]*\/videos/.test(url)) return { status: 200, body: page(HIST, "History Deep", "@hist", histItems) };
  if (/\/@big\/videos/.test(url)) return { status: 200, body: page("UCbbbbbbbbbbbbbbbbbbbbbb", "Big Channel", "@big", [lockup(vid("b", 99), "Big but small upload", "15,000 views", "2 days ago")].concat(Array.from({ length: 15 }, (_, i) => lockup(vid("b", i), "Big old " + i, "300,000 views", (i + 2) + " weeks ago")))) };
  if (/\/@small\/videos/.test(url)) return { status: 200, body: page("UCssssssssssssssssssssss", "Small Channel", "@small", [lockup(vid("s", 99), "Small hit", "2,500 views", "2 days ago")].concat(Array.from({ length: 12 }, (_, i) => lockup(vid("s", i), "Small old " + i, "500 views", (i + 2) + " weeks ago")))) };
  const y = young.find(id => url.includes("/channel/" + id));
  if (y) {
    const i = young.indexOf(y);
    if (/\/about/.test(url)) return { status: 200, body: about(y, "Young " + i, i === 13 ? "Mar 3, 2019" : new Date(Date.now() - (60 + i) * DAY).toDateString().slice(4), aboutViews[y] || 100000) };
    const recent = i < 4 ? 70000 : 5000;
    return { status: 200, body: page(y, "Young " + i, "@young" + i, [lockup(vid("y" + i, 1), "Recent " + i, recent.toLocaleString("en-US") + " views", "3 days ago"), lockup(vid("y" + i, 2), "Older " + i, "30,000 views", "2 months ago")]) };
  }
  if (/feeds\/videos\.xml/.test(url)) return { status: 404, body: "" };
  if (/youtubei\/v1\/search/.test(url)) {
    const body = JSON.parse(init.body);
    searches.push({ q: body.query, params: body.params, gl: body.context.client.gl, hl: body.context.client.hl });
    const hl = body.context.client.hl;
    const titles = hl === "pt" ? ["A história do império romano antigo que ninguém conta", "Curiosidades do universo que você não sabia", "Mistérios sem solução do Brasil"] : ["Ancient Rome history documentary", "Ancient empire secrets of Rome"];
    return { status: 200, body: { contents: titles.map((t, i) => ({ videoRenderer: { videoId: vid(hl + "q", searches.length * 10 + i), title: { runs: [{ text: t }] }, viewCountText: { simpleText: (hl === "pt" ? "12 mil visualizações" : (4000 + i * 1000) + " views") }, publishedTimeText: { simpleText: hl === "pt" ? "há 2 dias" : (i + 1) + " days ago" }, ownerText: { runs: [{ text: "Ch" + i, navigationEndpoint: { browseEndpoint: { browseId: "UCq" + String(i).padStart(21, "0") } } }] } } })) } };
  }
  if (/youtubei\/v1\/player/.test(url)) return { status: 200, body: { videoDetails: { title: "The legion that vanished overnight", channelId: HIST, viewCount: "84000" } } };
  if (/youtubei\/v1\/next/.test(url)) {
    const body = JSON.parse(init.body);
    if (body.videoId === COMMENT_VID) return { status: 200, body: { contents: { twoColumnWatchNextResults: { results: { results: { contents: [
      { videoPrimaryInfoRenderer: { title: { runs: [{ text: "The Fall of Rome" }] } } },
      { videoSecondaryInfoRenderer: { owner: { videoOwnerRenderer: { title: { runs: [{ text: "History Deep" }] } } } } },
      { itemSectionRenderer: { sectionIdentifier: "comment-item-section", contents: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "tok-1" } } } }] } }
    ] } } } } } };
    if (body.continuation === "tok-1") return { status: 200, body: commentsPage(0, "tok-2") };
    if (body.continuation === "tok-2") return { status: 200, body: commentsPage(1, "") };
    return { status: 200, body: {} };
  }
  if (/localhost:11434\/api\/tags/.test(url)) return ollamaUp ? { status: 200, body: { models: [{ name: "mock:1b" }] } } : { status: 503, body: {} };
  if (ollamaUp && /localhost:11434\/v1\/chat\/completions/.test(url)) {
    models.push(JSON.parse(init.body));
    return { status: 200, body: { choices: [{ message: { content: JSON.stringify({ sentiment: { positive: 30, neutral: 8, negative: 2 }, themes: [{ label: "empires", count: 9, sentiment: "+" }], painPoints: [], requests: ["the Aztec empire", "a part two"], summary: "They want more empires.", ideas: [{ title: "The Aztec Empire Fell in 2 Years. Here Is How", answers: "a video about the Aztec empire", comments: 1 }, { title: "The Fall of Rome, Part 2: Byzantium", answers: "part 2 on the Byzantine side", comments: 1 }, { title: "Los mayas: la caída", answers: "los mayas", comments: 1 }] }) } }] } };
  }
  return null;
}
function fakeStore() {
  const rows = [];
  const convs = {};
  let id = 0;
  return {
    rows, convs,
    appendMessage: (convId, row) => { const r = Object.assign({ id: ++id, convId, at: Date.now() }, JSON.parse(JSON.stringify(row))); rows.push(r); return Promise.resolve(r); },
    updateMessage: (rid, patch) => { const r = rows.find(x => x.id === rid); if (r) Object.assign(r, JSON.parse(JSON.stringify(patch))); return Promise.resolve(true); },
    createConversation: o => { const c = { id: "c" + (++id), title: o.title }; convs[c.id] = c; return Promise.resolve(c); },
    getConversation: cid => Promise.resolve(convs[cid] || null),
    getMessages: convId => Promise.resolve(rows.filter(r => !convId || r.convId === convId).map(r => JSON.parse(JSON.stringify(r))))
  };
}
const until = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 20)); } return null; };
const CHAT = { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=tab" };
const PROVIDER = /chat\/completions|api\.groq|api\.openai|generativelanguage|\/api\/chat/;
function worker(local, opts) {
  const w = loadWorker(Object.assign({ fetch: fetchTable, local: local || {} }, opts || {}));
  const store = fakeStore();
  w.context.NSP_CHAT_STORE = store;
  w.context.nspIntelTabUrl = () => Promise.resolve("https://www.google.com/");
  return { w, store };
}
const run = (w, convId, text) => new Promise(r => w.context.nspChatRun({ convId, text }, CHAT, r));
const job = (w, convId, spec, text) => new Promise(r => w.context.nspWatchRunMsg({ convId, text: text || "job", job: spec }, CHAT, r));
const watching = urls => Object.fromEntries(urls.map(u => [u, { channelUrl: u, channelId: "", name: "", addedAt: Date.now() - DAY, lastChecked: 0, knownVideoIds: [] }]));
const notes = w => w.calls.filter(c => c.api === "notifications.create");

{
  const { w } = worker({ nsp_watching: watching(["https://www.youtube.com/@hist"]) });
  await w.context.nspWatchCheck(null);
  const entry = w.local.nsp_watching["https://www.youtube.com/@hist"];
  const st = w.local.nsp_watch_state["https://www.youtube.com/@hist"];
  check("the first pass only sets the baseline, from the reader", entry.knownVideoIds.length === 20 && entry.lastChecked > 0 && st.median === 10950 && st.baselineAt > 0 && notes(w).length === 0, { ids: entry.knownVideoIds.length, st });
  histItems = [NEW_HIT, NEW_SMALL].concat(histItems);
  const alerts = await w.context.nspWatchCheck(null);
  const n = notes(w);
  check("a new upload at 5x or more its channel median fires one notification", alerts.length === 1 && n.length === 1 && /^nsp-out-/.test(n[0].args[1]) && /History Deep: an outlier at 7\.7x its median/.test(n[0].args[0].title), n.map(x => x.args));
  check("the notification says the views, the age and the median", /84K views after 19 hours/.test(n[0].args[0].message) && /median is 10K/.test(n[0].args[0].message), n[0].args[0].message);
  check("the alert is kept for the brief and the click", w.local.nsp_outlier_alerts.length === 1 && w.local.nsp_outlier_alerts[0].videoId === vid("n", 1) && Math.round(w.local.nsp_outlier_alerts[0].multiple * 10) === 77, w.local.nsp_outlier_alerts);
  check("the small new upload stays watched, not in the baseline", !w.local.nsp_watching["https://www.youtube.com/@hist"].knownVideoIds.includes(vid("n", 2)));
  await w.context.nspWatchCheck(null);
  check("the same upload never alerts twice", notes(w).length === 1);
  check("no AI provider is ever called by the watch", !w.fetches.some(f => PROVIDER.test(f.url)));
  const tabs0 = w.calls.filter(c => c.api === "tabs.create").length;
  w.clickNotification(n[0].args[1]);
  const xray = await until(() => w.context.NSP_CHAT_STORE.rows.find(r => r.role === "intel" && r.meta.card.kind === "xray"), 15000);
  const created = w.calls.filter(c => c.api === "tabs.create").slice(tabs0);
  check("clicking it opens the video and the X-ray of that channel in the chat over it", created.length === 1 && created[0].args[0].url === "https://www.youtube.com/watch?v=" + vid("n", 1) && xray && xray.meta.card.channel.name === "History Deep", { created: created.map(c => c.args[0]), xray: xray && xray.meta.card.channel });
  check("the chat asks the right question first", w.context.NSP_CHAT_STORE.rows.some(r => r.role === "user" && /Why did "The legion that vanished overnight" blow up\?/.test(r.text)));
  check("and the chat reopens on that tab", w.local.nsp_chat_reopen && w.local.nsp_chat_reopen[9], w.local.nsp_chat_reopen);
  histItems = histItems.slice(2);
}

{
  const { w } = worker({ nsp_watching: watching(["https://www.youtube.com/@small", "https://www.youtube.com/@big"]) });
  await w.context.nspWatchCheck(null);
  check("a small channel's 5x upload is caught on the first pass the user was not there for", notes(w).length === 0, notes(w).map(x => x.args));
  const st = w.local.nsp_watch_state;
  check("both channels get a median from their older uploads", st["https://www.youtube.com/@small"].median === 500 && st["https://www.youtube.com/@big"].median === 300000, st);
  w.local.nsp_watching["https://www.youtube.com/@small"].knownVideoIds = w.local.nsp_watching["https://www.youtube.com/@small"].knownVideoIds.filter(id => id !== vid("s", 99));
  w.local.nsp_watching["https://www.youtube.com/@big"].knownVideoIds = w.local.nsp_watching["https://www.youtube.com/@big"].knownVideoIds.filter(id => id !== vid("b", 99));
  await w.context.nspWatchCheck(null);
  const n = notes(w);
  check("the rule is the multiple, not the views per hour: 2,500 on a 500 median alerts, 15,000 on a 300K median does not", n.length === 1 && /Small Channel/.test(n[0].args[0].title), n.map(x => x.args[0].title));
}

{
  const { w } = worker({ nsp_watching: watching(["https://www.youtube.com/@hist"]), nsp_brief: { on: true, hour: 7 } });
  await w.context.nspWatchAlarms();
  check("watching a channel sets the hourly check", w.alarms["nsp-trend-check"] && w.alarms["nsp-trend-check"].periodInMinutes === 60, w.alarms);
  const b = w.alarms["nsp-morning-brief"];
  check("the brief alarm is set for the next 07:00 local", b && new Date(b.scheduledTime).getHours() === 7 && new Date(b.scheduledTime).getMinutes() === 0 && b.scheduledTime > Date.now() && b.scheduledTime - Date.now() <= DAY, b && new Date(b.scheduledTime).toString());
  check("the daily prediction alarm is off until the user turns it on", !w.alarms["nsp-predict-daily"], Object.keys(w.alarms));
  w.local.nsp_predictions = { on: true };
  await w.context.nspWatchAlarms();
  check("and it is set once daily sealing is switched on", !!w.alarms["nsp-predict-daily"]);
  w.local.nsp_predictions = { off: true };
  await w.context.nspWatchAlarms();
  check("and cleared again when switched off", !w.alarms["nsp-predict-daily"]);
  w.local.nsp_watching = {};
  w.local.nsp_brief = { on: false, hour: 7 };
  await w.context.nspWatchAlarms();
  check("with nothing watched and the brief off, both alarms go", !w.alarms["nsp-trend-check"] && !w.alarms["nsp-morning-brief"], Object.keys(w.alarms));
  w.local.nsp_watching = { x: { channelUrl: "https://www.youtube.com/@old", knownVideoIds: ["abcdefghijk"] } };
  w.alarms["nsp-trend-check"] = { name: "nsp-trend-check", periodInMinutes: 360, scheduledTime: Date.now() + 5 * HOUR };
  await w.context.nspWatchAlarms();
  check("an old six hour alarm is replaced by the hourly one", w.alarms["nsp-trend-check"].periodInMinutes === 60);
}

{
  const { w } = worker({ nsp_watching: {} }, { changes: true });
  w.local.nsp_watching = {};
  w.context.chrome.storage.local.set({ nsp_watching: watching(["https://www.youtube.com/@hist"]) });
  const base = await until(() => { const e = w.local.nsp_watching["https://www.youtube.com/@hist"]; return e && e.knownVideoIds.length ? e : null; });
  check("turning alerts on sets the baseline at once, not six hours later", base && base.knownVideoIds.length === 20, base);
  const reads = w.fetches.filter(f => /\/@hist\/videos/.test(f.url)).length;
  await new Promise(r => setTimeout(r, 300));
  check("and the worker's own write does not start another read", w.fetches.filter(f => /\/@hist\/videos/.test(f.url)).length === reads, reads);
}

{
  const saved = [{ title: "Ancient Rome history documentary", niche: "History", channelName: "X", savedAt: Date.now() }];
  const { w, store } = worker({ nsp_watching: watching(["https://www.youtube.com/@hist"]), nsp_brief: { on: true, hour: 7 }, ashlyv_nichos: saved });
  await w.context.nspWatchCheck(null);
  histItems = [NEW_HIT].concat(histItems);
  await w.context.nspWatchCheck(null);
  searches.length = 0;
  w.fireAlarm("nsp-morning-brief");
  const row = await until(() => store.rows.find(r => r.role === "intel" && r.meta.card.kind === "brief"), 15000);
  const card = row && row.meta.card;
  check("the brief alarm leaves a brief in its own conversation", card && store.convs[row.convId] && store.convs[row.convId].title === "Morning brief" && w.local.nsp_brief.convId === row.convId, row && store.convs[row.convId]);
  check("it leads with the outlier of the night", card && card.hero.value === "1" && /History Deep has "The legion that vanished overnight" at 7\.7 times its median/.test(card.lead), card && card.lead);
  check("it reads the saved niche with one search of this week", searches.length === 1 && searches[0].params === "EgQIAxAB" && /history documentary/.test(searches[0].q), searches);
  const note = await until(() => notes(w).find(n => /^nsp-brief-/.test(n.args[1])));
  check("and leaves a notification", note && /ZERACK morning brief/.test(note.args[0].title) && /one outlier/.test(note.args[0].message), note && note.args);
  check("the niche median is kept for tomorrow's trend", w.local.nsp_brief.last > 0 && w.local.nsp_brief.niches.Historia.medianVph > 0, w.local.nsp_brief);
  check("and the next brief alarm is set again", await until(() => w.alarms["nsp-morning-brief"] && w.alarms["nsp-morning-brief"].scheduledTime > Date.now()));
  w.local.nsp_brief.niches.Historia.medianVph = 50;
  await w.context.nspBriefScheduled();
  const second = store.rows.filter(r => r.meta && r.meta.card && r.meta.card.kind === "brief")[1];
  check("the next morning a niche that sped up is tagged rising", second && second.meta.card.sections.find(s => s.id === "niches").rows[0].tag === "RISING" && second.convId === row.convId, second && second.meta.card.sections.find(s => s.id === "niches"));
  w.clickNotification(note.args[1]);
  check("clicking the brief notification opens the chat on it", await until(() => w.local.nsp_chat_last === row.convId && w.calls.some(c => c.api === "windows.create")) || w.local.nsp_chat_last === row.convId, w.local.nsp_chat_last);
  histItems = histItems.slice(1);
}

{
  const { w, store } = worker({});
  await run(w, "b-1", "turn on the morning brief at 8");
  const card = await until(() => { const r = store.rows.find(x => x.convId === "b-1" && x.role === "intel"); return r && r.meta.card; });
  check("typed, the brief switches on at the hour asked", card && card.kind === "brief_state" && w.local.nsp_brief.on === true && w.local.nsp_brief.hour === 8 && card.hero.value === "On", { card: card && card.hero, brief: w.local.nsp_brief });
  check("and its alarm follows", await until(() => w.alarms["nsp-morning-brief"] && new Date(w.alarms["nsp-morning-brief"].scheduledTime).getHours() === 8));
  await job(w, "b-1", { op: "brief_off" }, "Turn it off");
  check("the card's button turns it off", await until(() => w.local.nsp_brief.on === false && !w.alarms["nsp-morning-brief"]));
  await run(w, "b-2", "qué hicieron mis competidores anoche");
  const now = await until(() => { const r = store.rows.find(x => x.convId === "b-2" && x.role === "intel"); return r && r.meta.card; });
  check("asked in Spanish with nothing watched, it says what to do in English", now && now.kind === "brief" && /^Nothing to brief yet/.test(now.lead), now && now.lead);
}

{
  const { w, store } = worker({ nsp_all_channels: young.map((id, i) => ({ channelUrl: "https://www.youtube.com/channel/" + id, name: "Young " + i, channelAgeDays: i === 13 ? null : 60 + i })) });
  const out = await w.context.nspPredictSeal(null);
  const ledger = w.local.nsp_predictions;
  const b = ledger.batches[0];
  check("a seal reads the pool from the user's scans and keeps the young channels", out.ok && b.sealed.pool === 13 && b.sealed.read === 14, b.sealed);
  check("the picks are the four young channels whose last 14 days hold most of their views", b.sealed.picks.length === 4 && b.sealed.picks.every(p => /^Young [0-3]$/.test(p.name)) && b.sealed.picks.every(p => p.score >= 0.5), b.sealed.picks.map(p => [p.name, p.score]));
  check("ten random controls come from the rest of the same pool", b.sealed.controls.length === 9 && b.sealed.controls.every(c => !/^Young [0-3]$/.test(c.name) && c.name !== "Young 13"), b.sealed.controls.map(c => c.name));
  const again = Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(w.context.NSP_WATCH.canonical(b.sealed)))).toString("hex");
  check("the stored hash is the SHA-256 of the sealed batch", b.hash === again && /^[0-9a-f]{64}$/.test(b.hash), { stored: b.hash, again });
  check("the sealed baseline is each channel's total views from its About page", b.sealed.picks[0].views === 100000 && /^\d{4}-\d\d-\d\d$/.test(b.sealed.picks[0].joined));
  const second = await w.context.nspPredictSeal(null);
  check("channels still waiting are not sealed twice", second.ok === false && /None of the/.test(second.text), second);
  const { w: wq } = worker({ nsp_all_channels: young.slice(4, 13).map((id, i) => ({ channelUrl: "https://www.youtube.com/channel/" + id, name: "Young " + (i + 4), channelAgeDays: 70 })) });
  const quiet = await wq.context.nspPredictSeal(null);
  check("a day with no young channel at a doubling pace seals nothing, and says the best share it saw", quiet.ok === false && /None of the 9 young channels read from your scans runs at a doubling pace today/.test(quiet.text) && /holds 5% of its views/.test(quiet.text) && !(wq.local.nsp_predictions && wq.local.nsp_predictions.batches), quiet);
  const fake = Date.now() + 15 * DAY;
  vm.runInContext("(function(){ var real = Date.now; Date.now = function(){ return real() + " + 15 * DAY + "; }; })()", w.context);
  b.sealed.picks.forEach((p, i) => { aboutViews[p.id] = i < 3 ? 250000 : 120000; });
  b.sealed.controls.forEach((c, i) => { aboutViews[c.id] = i === 0 ? 210000 : 110000; });
  await run(w, "p-1", "how are my predictions doing");
  const card = await until(() => { const r = store.rows.find(x => x.convId === "p-1" && x.role === "intel"); return r && r.meta.card; }, 20000);
  const settled = w.local.nsp_predictions.batches[0].settled;
  check("after 14 days the batch settles by reading each channel again", settled && settled.picks.hits === 3 && settled.picks.n === 4 && settled.controls.hits === 1 && settled.controls.n === 9, settled && { p: settled.picks.hits, c: settled.controls.hits });
  check("the card shows picks against controls and an honest meter", card && card.hero.value === "75% vs 11%" && card.sections[0].meter.label === "Too little data" && card.sections[0].meter.level === 1, card && [card.hero, card.sections[0].meter]);
  check("the sealed part and its hash did not change when it settled", w.local.nsp_predictions.batches[0].hash === again);
  const ex = await job(w, "p-1", { op: "predict_export" }, "Export JSON");
  const dl = await until(() => w.calls.find(c => c.api === "downloads.download"));
  const json = dl && JSON.parse(decodeURIComponent(dl.args[0].url.replace(/^data:application\/json;charset=utf-8,/, "")));
  check("the export is a JSON file with every hash and the way to check it", ex.ok && json && json.batches[0].sha256 === again && /canonical/.test(json.verify) && /^zerack-predictions-\d{4}-\d\d-\d\d\.json$/.test(dl.args[0].filename), dl && dl.args[0].filename);
  const said = await until(() => store.rows.find(x => x.convId === "p-1" && x.role === "assistant" && /Saved zerack-predictions/.test(x.text)));
  check("and the chat says where it went", !!said, said);
  check("nothing was posted anywhere", !w.fetches.some(f => /x\.com|twitter|api\./.test(f.url)), w.fetches.filter(f => !/youtube/.test(f.url)).map(f => f.url));
  vm.runInContext("Date.now = (function(){ return function(){ return new Date().getTime(); }; })()", w.context);
}

{
  const recs = [];
  for (let i = 0; i < 70; i++) recs.push({ t: i < 12 ? "Ancient history documentary of the lost empire " + i : "The funniest prank compilation of the year " + i, v: i < 12 ? 900 : 200, th: "https://i.ytimg.com/vi/" + vid("e", i) + "/hq.jpg", n: "x", w: 1000, ts: Date.now() });
  const esFeed = { videos: Array.from({ length: 64 }, (_, i) => ({ videoId: vid("x", i), title: i === 0 ? "La historia del imperio antiguo y sus secretos" : "Bromas graciosas para reír con los amigos " + i, viewsText: "12 mil vistas", publishedText: "hace 2 días" })), ts: Date.now() - HOUR, gl: "MX", hl: "es", queries: [] };
  const { w, store } = worker({ nsp_title_corpus: recs, nsp_country_feed_MX_es_EgQIBBAB_x: esFeed });
  await run(w, "a-1", "language arbitrage");
  const card = await until(() => { const r = store.rows.find(x => x.convId === "a-1" && x.role === "intel"); return r && r.meta.card; });
  const es = card && card.sections.find(s => s.id === "lang-es");
  check("the gaps come from the stored scans and the Country radar", card && card.kind === "arb" && es && es.rows.some(r => r.label === "History" && r.tag === "MISSING"), card && card.sections.map(s => [s.id, s.rows.map(r => r.label + ":" + (r.tag || r.value))]));
  check("the source says what was measured", card && /out of 70 stored from your scans and 64 from the Country radar \(MX 1h ago\)/.test(card.source), card && card.source);
  check("German and Portuguese are refused with the reason", card && card.sections.find(s => s.id === "lang-de").rows[0].label === "Not judged" && card.actions[0].job.langs.join() === "de,pt");
  check("and nothing was fetched to say it", !w.fetches.some(f => /youtube/.test(f.url)));
  w.local.nsp_country_feed_US_en_x_y = { videos: [{ videoId: vid("u", 1), title: "Top 10 Scariest Places on Earth", viewsText: "50,000 views", publishedText: "3 days ago" }, { videoId: vid("u", 2), title: "Misterios Sin Resolver Parte 2", viewsText: "9,000 views", publishedText: "3 days ago" }], ts: Date.now(), gl: "US", hl: "en", queries: [] };
  const got = await w.context.nspArbRecords();
  const u1 = got.records.find(r => r.videoId === vid("u", 1)), u2 = got.records.find(r => r.videoId === vid("u", 2));
  check("a plain title with no language marker from an English radar market counts as English, and says so", u1 && u1.lang === "en" && got.sources.byMarket >= 1, { u1, by: got.sources.byMarket });
  check("while a title with a marker of another language keeps that language", u2 && u2.lang !== "en", u2);
  delete w.local.nsp_country_feed_US_en_x_y;
  searches.length = 0;
  await job(w, "a-1", card.actions[0].job, card.actions[0].label);
  const after = await until(() => { const rows = store.rows.filter(x => x.convId === "a-1" && x.role === "intel"); return rows.length === 2 && rows[1].meta.card; }, 20000);
  check("the measure button runs the Country radar for German and Portuguese, one search at a time", searches.length === 24 && searches.slice(0, 12).every(s => s.gl === "DE" && s.hl === "de" && s.params === "EgQIBBAB") && searches.slice(12).every(s => s.gl === "BR" && s.hl === "pt"), searches.map(s => s.gl + s.hl).join(","));
  check("with the radar's own queries in Portuguese", searches.slice(12).map(s => s.q).includes("documentário história"));
  check("and stores them where the radar keeps its feeds", Object.keys(w.local).some(k => /^nsp_country_feed_BR_pt_EgQIBBAB_/.test(k)) && Object.keys(w.local).some(k => /^nsp_country_feed_DE_de_EgQIBBAB_/.test(k)));
  check("the card comes back with what was measured", after && /Measured just now: German: \d+ uploads; Portuguese: \d+ uploads/.test(after.notice), after && after.notice);
}

{
  ollamaUp = true;
  const { w, store } = worker({ nsp_ollama_enabled: true, nsp_ollama_url: "http://localhost:11434", nsp_ollama_model: "mock:1b" });
  w.context.nspIntelTabUrl = () => Promise.resolve("https://www.youtube.com/watch?v=" + COMMENT_VID);
  await run(w, "m-1", "what are the comments asking for");
  const row = await until(() => { const r = store.rows.find(x => x.convId === "m-1" && x.role === "intel"); return r && r.meta.card.sections[0].rows.length === 3 && r; }, 15000);
  const card = row && row.meta.card;
  check("the comments are read page by page from YouTube, replies left out", card && card.model.commentsRead === 40 && w.fetches.filter(f => /youtubei\/v1\/next/.test(f.url)).length === 3, card && card.model.commentsRead);
  check("the asks are found by phrase and sorted by likes", card && card.hero.value === "3 of 40" && /Aztec/.test(card.sections[1].rows[0].value) && card.sections[1].rows[0].label === "1.2K likes", card && [card.hero, card.sections[1].rows.map(r => r.label)]);
  check("the user's provider writes three ideas onto the card", card && /Aztec Empire Fell/.test(card.sections[0].rows[0].value) && /Answers: a video about the Aztec empire/.test(card.sections[0].rows[0].note) && /local model/.test(card.sections[0].note), card && card.sections[0]);
  const sent = JSON.stringify(models[0] || {});
  check("the provider got the comments marked as asks and the title, never a page", models.length === 1 && /\[asks\] Can you make a video about the Aztec empire/.test(sent) && /The Fall of Rome/.test(sent) && !/ytInitialData|<html|frameworkUpdates/.test(sent), sent.slice(0, 300));
  check("and is told to write the ideas in English whatever language the comments use", /title in English, whatever language the comments are in/.test(sent), sent.slice(-400));
  check("the video is named on the card", card && card.channel.name === "The Fall of Rome" && /History Deep/.test(card.channel.line));
  ollamaUp = false;
  models.length = 0;
  const { w: w2, store: s2 } = worker({});
  const tool = await new Promise(r => w2.context.nspChatToolNow("zerackCommentIdeas", { video: "https://www.youtube.com/watch?v=" + COMMENT_VID }, { origin: "chat", chatRun: { convId: "t-1", tabId: -1, stopped: false, gone: false, chain: Promise.resolve() } }, r));
  check("the model's comment tool returns the asks and leaves the ideas to the answer", tool.ok && tool.data.topRequests.length === 3 && /Write three video ideas/.test(tool.note) && !w2.fetches.some(f => PROVIDER.test(f.url)), tool);
  const { w: w3, store: s3 } = worker({});
  w3.context.nspIntelTabUrl = () => Promise.resolve("https://www.youtube.com/watch?v=" + COMMENT_VID);
  await run(w3, "m-2", "ideas de los comentarios");
  const noAi = await until(() => { const r = s3.rows.find(x => x.convId === "m-2" && x.role === "intel"); return r && !r.meta.card.sections[0].rows.some(x => x.busy) && r.meta.card; }, 15000);
  check("without a provider the asks still come back and the ideas say why", noAi && /no AI provider is set up/.test(noAi.sections[0].note) && noAi.hero.value === "3 of 40" && /^3 of the 40 comments read ask for something/.test(noAi.lead), noAi && [noAi.sections[0].note, noAi.lead]);
}

{
  const w = loadWorker();
  const route = t => w.context.nspVoiceRoute(t);
  check("said out loud, the five features route", route("dame el resumen de la mañana").watch.kind === "brief" && route("vigila este canal").watch.op === "add" && route("cómo van mis predicciones").watch.kind === "predict" && route("arbitraje de idiomas").watch.kind === "arb" && route("léeme los comentarios").watch.kind === "comments");
  check("ordinary commands keep their routes", route("abre youtube").kind === "youtube" && route("mi wrapped").kind === "mine" && route("por qué explotó esto").kind === "intel");
  check("a typed request is not sent through the spoken command runner", w.context.nspChatTyped("resumen de la mañana") === null);
  const tools = n => w.context.NSP_BRAIN.tools(n, { agentOn: false })[0].functionDeclarations.map(d => d.name);
  const four = ["zerackBrief", "zerackPredictions", "zerackLanguageGaps", "zerackCommentIdeas"];
  check("the chat and the voice get the four tools with the Agent switch off", four.every(n => tools("chat").includes(n) && tools("voice").includes(n)));
  check("the YouTube panel does not", !four.some(n => tools("youtube").includes(n)));
}

{
  const w = loadWorker();
  let res = await w.send({ type: "NSP_WATCH_RUN", convId: "x", text: "Seal", job: { op: "predict_seal" } }, SENDERS.youtube);
  check("youtube.com cannot press a card button", res && res.error === "sender_not_allowed", res);
  res = await w.send({ type: "NSP_WATCH_RUN", convId: "x", text: "Seal", job: { op: "predict_seal" } }, SENDERS.site);
  check("nor can another site", res && res.error === "sender_not_allowed", res);
  res = await w.send({ type: "NSP_WATCH_RUN", convId: "x", text: "Seal", job: { op: "predict_seal" } }, { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=overlay", tab: { id: 21 }, frameId: 3, documentId: "doc-9" });
  check("a chat frame with no token is refused", res && res.ok === false && res.error === "not_allowed", res);
  check("a job outside the list is refused", w.context.nspWatchJobOf({ op: "draw" }) === null && w.context.nspWatchJobOf({ op: "watch_remove", url: "https://evil.example/@x" }) === null && w.context.nspWatchJobOf({ op: "arb_measure", langs: ["fr", "zz"] }) === null);
  check("and a good one is read with its bounds", w.context.nspWatchJobOf({ op: "brief_on", hour: 31 }).hour === null && w.context.nspWatchJobOf({ op: "arb_measure", langs: ["pt", "pt", "de"] }).langs.join() === "pt,de");
}

clearInterval(keep);
done("sw-watch");
