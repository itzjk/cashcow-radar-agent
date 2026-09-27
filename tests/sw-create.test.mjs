// Create and hands-free inside the worker: the caption reader (iOS player first, web player after it), the Shorts
// miner on real caption shapes and the most replayed graph, the sourced script end to end with the model, its refusal,
// the earnings card, the Studio package approved and filled only through its presses, the door, the voice routes.
import { loadWorker, SENDERS, check, done, EXT } from "./sw-harness.mjs";

const keep = setInterval(() => {}, 1000);
const VID = "n82XWvEa22Q";
const SRC = ["srcvideo001", "srcvideo002", "srcvideo003"];
const CH = "UCcccccccccccccccccccccc";
const players = [];
const models = [];
let iosDown = false;
let searchEmpty = false;

function asr(words, start) {
  const events = [{ tStartMs: 0, dDurationMs: 9999999, id: 1 }];
  let t = start || 0;
  for (let i = 0; i < words.length; i += 6) {
    const segs = words.slice(i, i + 6).map((w, k) => k ? { utf8: " " + w, tOffsetMs: k * 400 } : { utf8: w });
    events.push({ tStartMs: t, dDurationMs: 2800, segs });
    events.push({ tStartMs: t + 2390, dDurationMs: 400, aAppend: 1, segs: [{ utf8: "\n" }] });
    t += 2400 + (i % 30 === 24 ? 1400 : 0);
  }
  return { events };
}
const TALK = [];
const LINES = ["Nobody expected the legion to cross the river.", "They marched north with five thousand men!", "That is why the historians still argue about it.", "Um, anyway, subscribe to the channel.", "This was the worst winter in forty years!"];
for (let k = 0; k < 400; k++) TALK.push(...LINES[(k * 7) % LINES.length].split(" "));
const FACTS = {
  srcvideo001: ["Constantinople fell on 29 May 1453 after a siege of 53 days.", "Sultan Mehmed II was 21 years old when he took the city.", "His guns fired stones of more than 500 kilograms at the walls."],
  srcvideo002: ["The chain across the Golden Horn kept the Ottoman fleet out of the harbour.", "Mehmed dragged about 70 ships over land on greased logs.", "Nobody knows exactly how Constantine XI died in the final assault."],
  srcvideo003: []
};
function factsTalk(id) {
  const out = [];
  for (let k = 0; k < 12; k++) FACTS[id].forEach(f => out.push(...f.split(" ")));
  return out;
}
function markers(seconds) {
  return Array.from({ length: 100 }, (_, i) => ({ startMillis: String(Math.round(i * seconds * 10)), durationMillis: String(Math.round(seconds * 10)), intensityScoreNormalized: i >= 70 && i < 73 ? 1 : 0.15 }));
}
const SECONDS = Math.round(TALK.length / 6 * 2.4 + 60);
const lockup = (id, title, views, age, len) => ({ richItemRenderer: { content: { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: id,
  contentImage: { thumbnailViewModel: { overlays: [{ thumbnailBottomOverlayViewModel: { badges: [{ thumbnailBadgeViewModel: { text: len } }] } }] } },
  metadata: { lockupMetadataViewModel: { title: { content: title }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: views } }, { text: { content: age } }] }] } } } } } } } });
const CH_VIDEOS = Array.from({ length: 30 }, (_, i) => lockup(("e" + String(i).padStart(10, "0")).slice(0, 11), "Why the Roman legion vanished, part " + i, (50000 + i * 1000).toLocaleString("en-US") + " views", i < 5 ? (i * 5 + 1) + " days ago" : (i - 3) + " months ago", "22:0" + (i % 10)));
const channelPage = "<html><script>var ytInitialData = " + JSON.stringify({ header: { pageHeaderRenderer: { content: { pageHeaderViewModel: { metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: "@legionhistory" } }] }, { metadataParts: [{ text: { content: "310K subscribers" } }] }] } } } } } }, metadata: { channelMetadataRenderer: { title: "Legion History", externalId: CH, vanityChannelUrl: "http://www.youtube.com/@legionhistory" } }, contents: CH_VIDEOS }) + ";</script></html>";
const aboutPage = "<html><script>var ytInitialData = " + JSON.stringify({ metadata: { channelMetadataRenderer: { title: "Legion History", externalId: CH } }, x: { aboutChannelViewModel: { channelId: CH, joinedDateText: { content: "Joined Sep 27, 2022" }, subscriberCountText: "310K subscribers", viewCountText: "24,000,000 views", videoCountText: "120 videos" } } }) + ";</script></html>";

function fetchTable(url, init) {
  if (/youtubei\/v1\/player/.test(url)) {
    const body = JSON.parse(init.body);
    const client = body.context.client.clientName;
    players.push(client + ":" + body.videoId);
    if (client === "IOS" && iosDown) return { status: 403, body: {} };
    if (client === "WEB" && body.videoId !== VID) return { status: 200, body: { playabilityStatus: { status: "UNPLAYABLE" } } };
    const title = body.videoId === VID ? "Hawks Film Room Ep 55" : "Source " + body.videoId;
    return { status: 200, body: { playabilityStatus: { status: "OK" }, videoDetails: { title, author: "Some Channel", channelId: CH, lengthSeconds: String(SECONDS), shortDescription: body.videoId === "srcvideo003" ? "The walls of Constantinople were built in the 5th century and stood for 1,000 years." : "Follow us https://example.com" },
      captions: body.videoId === "srcvideo003" ? undefined : { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "https://www.youtube.com/api/timedtext?v=" + body.videoId + "&lang=en&kind=asr&fmt=srv3", languageCode: "en", kind: "asr" }] } } } };
  }
  if (/api\/timedtext\?v=/.test(url)) {
    const id = /v=([\w-]{11})/.exec(url)[1];
    if (!/fmt=json3/.test(url) || /fmt=srv3/.test(url)) return { status: 200, body: "<xml/>" };
    return { status: 200, body: JSON.stringify(id === VID ? asr(TALK) : asr(factsTalk(id), 5000)) };
  }
  if (/\/watch\?v=n82XWvEa22Q&hl=en/.test(url)) return { status: 200, body: "<html><script>var ytInitialData = " + JSON.stringify({ frameworkUpdates: { entityBatchUpdate: { mutations: [{ payload: { macroMarkersListEntity: { markersList: { markerType: "MARKER_TYPE_HEATMAP", markers: markers(SECONDS) } } } }] } } }) + ";</script></html>" };
  if (/youtubei\/v1\/search/.test(url)) {
    if (searchEmpty) return { status: 200, body: { contents: [] } };
    return { status: 200, body: { contents: SRC.map((id, i) => ({ videoRenderer: { videoId: id, title: { runs: [{ text: "The fall of Constantinople " + (i + 1) }] }, viewCountText: { simpleText: "1,200,000 views" }, lengthText: { simpleText: "18:3" + i }, publishedTimeText: { simpleText: "2 years ago" }, ownerText: { runs: [{ text: "History " + i }] } } })).concat([{ videoRenderer: { videoId: "livestream01", title: { runs: [{ text: "Live now" }] }, viewCountText: { simpleText: "5 watching" } } }]) } };
  }
  if (/localhost:11434\/api\/tags/.test(url)) return { status: 200, body: { models: [{ name: "mock:1b" }] } };
  if (/localhost:11434\/v1\/chat\/completions/.test(url)) {
    const body = JSON.parse(init.body);
    models.push(body);
    const user = body.messages.filter(m => m.role === "user").map(m => m.content).join("\n");
    const pid = needle => { const m = new RegExp("\\[P(\\d+)\\][^\\n]*" + needle).exec(user); return m ? m[1] : "99"; };
    const text = ["TITLE: The Night the City Fell", "HOOK:",
      "Constantinople fell on 29 May 1453 after 53 days. [P" + pid("53 days") + "]",
      "Nobody knows exactly how its last emperor died. [P" + pid("Nobody knows") + "]",
      "By the end you will know why the walls could not save it.",
      "SECTION: The guns", "His guns fired stones of more than 500 kilograms. [P" + pid("500 kilograms") + "]", "Mehmed II was 25 years old. [P" + pid("21 years") + "]", "The walls stood for 1,000 years. [P" + pid("1,000 years") + "]",
      "SECTION: The ships", "Mehmed dragged about 70 ships over land. [P" + pid("70 ships") + "]", "The Venetians sent 12 galleys. [P88]", "In the end the walls fell.", "END"].join("\n");
    return { status: 200, body: { choices: [{ message: { content: text } }] } };
  }
  if (/\/@legionhistory\/videos|\/channel\/UCcccc[^/]*\/videos/.test(url)) return { status: 200, body: channelPage };
  if (/\/@legionhistory\/about|\/channel\/UCcccc[^/]*\/about/.test(url)) return { status: 200, body: aboutPage };
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
    getMessages: convId => Promise.resolve(rows.filter(r => !convId || r.convId === convId).map(r => JSON.parse(JSON.stringify(r))))
  };
}
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 20)); } return null; };
const CHAT = { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=tab" };
const PROVIDER = /chat\/completions|api\.groq|api\.openai|generativelanguage|\/api\/chat/;
function worker(local, tabUrl) {
  const w = loadWorker({ fetch: fetchTable, local: local || {} });
  const store = fakeStore();
  w.context.NSP_CHAT_STORE = store;
  w.context.nspIntelTabUrl = () => Promise.resolve(tabUrl || "https://www.google.com/");
  return { w, store };
}
const run = (w, convId, text, lang) => new Promise(r => w.context.nspChatRun({ convId, text, lang: lang || "en" }, CHAT, r));
const job = (w, convId, jobSpec, text, lang) => new Promise(r => w.context.nspCreateRunMsg({ convId, text: text || "job", job: jobSpec, lang: lang || "en" }, CHAT, r));
const card = (store, convId, kind) => until(() => { const r = store.rows.filter(x => x.convId === convId && x.role === "intel" && (!kind || x.meta.card.kind === kind)).pop(); return r && r.meta.card; });

{
  const { w } = worker();
  const tr = await w.context.nspTranscriptRead(VID, { hl: "en" });
  check("captions are read through the iOS player first", tr.ok && tr.via === "ios" && players[0] === "IOS:" + VID && tr.kind === "asr" && tr.events.length > 100, { ok: tr.ok, via: tr.via, players: players.slice(0, 2) });
  const asked = w.fetches.find(f => /api\/timedtext/.test(f.url));
  check("the caption file is asked for as json3, whatever format the track named", asked && /fmt=json3$/.test(asked.url) && !/srv3/.test(asked.url), asked && asked.url);
  const again = players.length;
  await w.context.nspTranscriptRead(VID, { hl: "en" });
  check("a second read in the same minutes comes from memory", players.length === again);
  iosDown = true;
  const { w: w2 } = worker();
  const fb = await w2.context.nspTranscriptRead(VID, { hl: "en" });
  check("when the iOS player refuses, the web player is tried", fb.ok && fb.via === "web" && players.slice(-1)[0] === "WEB:" + VID, { via: fb.via, last: players.slice(-2) });
  iosDown = false;
  const res = await w.send({ type: "NSP_FETCH_TRANSCRIPT", videoId: VID }, SENDERS.popup);
  check("the old transcript message answers in its old shape from the same reader", res && res.ok && res.segments.length > 100 && typeof res.segments[0].start === "number" && res.kind === "asr" && res.text.length > 1000, res && { ok: res.ok, n: res.segments && res.segments.length });
  const tt = (lang, kind) => ({ languageCode: lang, kind, baseUrl: "https://www.youtube.com/api/timedtext?v=x&lang=" + lang + (kind ? "&kind=asr" : "") });
  const dubbed = [tt("ar", "asr"), tt("en"), tt("en", "asr"), tt("fr-FR", "asr"), tt("es-US", "asr")];
  const pickDub = w.context.nspCaptionTrack(dubbed, "es", { captionTracks: dubbed, audioTracks: [{ defaultCaptionTrackIndex: 1 }, { defaultCaptionTrackIndex: 1 }], defaultAudioTrackIndex: 1 });
  check("a dubbed video with an auto track per language reads the caption YouTube shows by default, not the first one", pickDub === dubbed[1], pickDub);
  check("with no default named, the channel's own captions beat an auto track of a dubbed voice", w.context.nspCaptionTrack(dubbed, "es", null) === dubbed[1] && w.context.nspCaptionTrack(dubbed.filter(x => x.kind), "es", null) === dubbed[4]);
  const plain = [tt("fr", "asr"), tt("en"), tt("fr")];
  check("one spoken language: the channel's own captions in it, over the auto ones", w.context.nspCaptionTrack(plain, "en", null) === plain[2]);
  const forged = [{ languageCode: "en", baseUrl: "https://evil.example/api/timedtext?v=x" }];
  check("a caption address off youtube.com is never fetched", w.context.nspCaptionTrack(forged, "en", null) === null);
  const bad = await w.send({ type: "NSP_FETCH_TRANSCRIPT", videoId: "x" }, SENDERS.popup);
  check("and still refuses a bad id before any fetch", bad && bad.error === "bad_video_id");
}

{
  const { w, store } = worker({}, "https://www.youtube.com/watch?v=" + VID);
  await run(w, "s-1", "find the shorts in this video");
  const c = await card(store, "s-1", "shorts");
  check("typed, the Shorts miner reads the video on screen", c && c.channel.name === "Hawks Film Room Ep 55" && c.sections.filter(s => /^clip/.test(s.id)).length >= 3, c && c.hero);
  const clips = c ? c.sections.filter(s => /^clip/.test(s.id)) : [];
  const hot = [SECONDS * 0.7, SECONDS * 0.73];
  const times = clips.map(s => (/t=(\d+)s/.exec(s.rows.find(r => r.link).link) || [])[1] * 1);
  check("each clip links to its second on YouTube", times.length && times.every(t => t > 0) && clips.every(s => /^https:\/\/www\.youtube\.com\/watch\?v=n82XWvEa22Q&t=\d+s$/.test(s.rows.find(r => r.link).link)), times);
  const best = clips.find(s => / best$/.test(s.title));
  const bestAt = best ? Number((/t=(\d+)s/.exec(best.rows.find(r => r.link).link) || [])[1]) : -1;
  check("the replayed stretch of the graph holds the best clip", best && bestAt < hot[1] && bestAt + 80 > hot[0], { bestAt, hot });
  check("the card says the replay graph was measured", c && /Measured/.test(c.sections.find(s => s.id === "how").rows[2].value));
  check("no AI provider was called for the Shorts", !w.fetches.some(f => PROVIDER.test(f.url)));
  const { w: w3, store: s3 } = worker({}, "https://www.youtube.com/@legionhistory");
  await run(w3, "s-2", "saca shorts de este video", "es");
  const told = await until(() => s3.rows.find(r => r.convId === "s-2" && r.role === "assistant"));
  check("on a page with no video it asks for one, in Spanish", told && /Abre un video de YouTube/.test(told.text), told && told.text);
}

{
  const { w, store } = worker({ nsp_ollama_enabled: true, nsp_ollama_url: "http://localhost:11434", nsp_ollama_model: "mock:1b" });
  await run(w, "w-1", "write a sourced script about the fall of Constantinople");
  const c = await card(store, "w-1", "script");
  check("one command writes a sourced script", c && c.hero.tone === "good" && c.script && c.script.title === "The Night the City Fell", c && c.hero);
  const src = c && c.sections.find(s => s.id === "sources");
  check("its sources are the videos YouTube returns for the topic, read one at a time", src && src.rows.length === 3 && src.rows.every(r => /^https:\/\/www\.youtube\.com\/watch\?v=srcvideo00\d$/.test(r.link)), src && src.rows.map(r => r.link));
  check("a live stream in the results is never a source", !players.some(p => /livestream01/.test(p)));
  const cut = c && c.sections.find(s => s.id === "cut").rows.map(r => r.value + " :: " + r.note);
  check("a number its passage does not hold is cut", cut && cut.some(x => /25 years old.*number 25/.test(x)), cut);
  check("a passage that does not exist is cut", cut && cut.some(x => /Venetians.*does not exist/.test(x)), cut);
  const guns = c && c.sections.find(s => s.title === "The guns");
  check("a backed line names its source and the second it came from", guns && guns.rows[0].note.indexOf("Source 1 at ") === 0, guns && guns.rows[0].note);
  check("a video with no captions can still be a source through its description", guns && guns.rows.some(r => /1,000 years/.test(r.value) && /Source 3/.test(r.note)), guns && guns.rows.map(r => r.note));
  const sent = JSON.stringify(models[0] || {});
  check("the model got only the passages, the rules and the topic", models.length === 1 && /\[P1\]/.test(sent) && /Never cite an id that is not in the list/.test(sent) && !/ytInitialData|<html/.test(sent));
  check("and was given time to write a long answer", models[0] && models[0].options && models[0].options.num_predict >= 1000);
  check("the Studio package action rides on the card", c && c.actions[0].job.op === "studio_pack");
  searchEmpty = true;
  const before = models.length;
  await run(w, "w-2", "escríbeme un guion con fuentes sobre la batalla de Zama", "es");
  const r = await card(store, "w-2", "script");
  check("with fewer than two readable sources it refuses and calls no model", r && r.model.refused === true && models.length === before && /no escribo el guion/.test(r.lead), r && r.lead);
  searchEmpty = false;
}

{
  const { w, store } = worker({}, "https://www.youtube.com/@legionhistory");
  await run(w, "e-1", "how much does this channel earn?");
  const c = await card(store, "e-1", "earn");
  check("typed, the earnings card reads the channel on screen and its About page", c && c.channel.name === "Legion History" && c.model.recentUploads === 5 && c.model.lifetimeViews === 24000000, c && c.model);
  check("it gives a range a month, stamped as an estimate", c && /^\$[\d,]+ to \$[\d,]+$/.test(c.hero.value) && c.model.stamp === "ESTIMATE", c && c.hero);
  check("no AI provider was called for it", !w.fetches.some(f => PROVIDER.test(f.url)));
}

{
  const { w, store } = worker({ nsp_ollama_enabled: true, nsp_ollama_url: "http://localhost:11434", nsp_ollama_model: "mock:1b" });
  await run(w, "p-1", "write a sourced script about the fall of Constantinople");
  const sc = await card(store, "p-1", "script");
  const scriptRow = store.rows.find(r => r.convId === "p-1" && r.role === "intel");
  await job(w, "p-1", { op: "studio_pack", rowId: String(scriptRow.id) }, "Make the Studio package");
  const form = await card(store, "p-1", "studio");
  check("the script becomes a package to review, not approved yet", sc && form && form.form.op === "studio_approve" && form.form.fields[0].value === "The Night the City Fell" && !w.local.nsp_studio_package, form && form.form.fields.map(f => f.id));
  check("its chapters are timed from the script", form && /^0:00 The guns\n\d+:\d\d The ships$/.test(form.form.fields[2].value), form && form.form.fields[2].value);
  const f = form.form.fields.reduce((o, x) => (o[x.id] = x.value, o), {});
  await job(w, "p-1", { op: "studio_approve", title: "x".repeat(120), description: f.description, chapters: f.chapters, tags: f.tags }, "Approve");
  const refused = await until(() => { const r = store.rows.filter(x => x.convId === "p-1" && x.role === "intel").pop(); return r && r.meta.card.notice && r.meta.card; });
  check("a title over 100 characters is not approved, and says why", refused && /100/.test(refused.notice) && !w.local.nsp_studio_package, refused && refused.notice);
  await job(w, "p-1", { op: "studio_approve", title: f.title, description: f.description, chapters: f.chapters.replace(/\n.*$/, "\n1:10 The ships\n2:30 The end"), tags: f.tags }, "Approve");
  const ok = await until(() => w.local.nsp_studio_package);
  check("approving stores the package with its chapters in the description", ok && ok.title === "The Night the City Fell" && /\n0:00 The guns\n1:10 The ships\n2:30 The end/.test(ok.description) && ok.chaptersEstimated === false, ok);
  const approved = await card(store, "p-1", "studio");
  check("the approved card offers Fill in Studio", approved && approved.actions && approved.actions[0].job.op === "studio_fill");

  const sent = [];
  w.context.chrome.windows = { getLastFocused: (o, cb) => setImmediate(() => cb({ id: 1 })) };
  w.context.chrome.tabs = {
    get: (id, cb) => setImmediate(() => cb({ id, url: "https://www.google.com/" })),
    query: (q, cb) => setImmediate(() => cb(q && q.url ? [{ id: 44, url: "https://studio.youtube.com/video/abcdefghijk/edit", lastAccessed: 5 }] : [{ id: 1, url: "https://www.google.com/", active: true }])),
    sendMessage: (id, msg, opts, cb) => { sent.push({ id, msg }); setImmediate(() => cb({ ok: true, title: true, description: true, tags: 3 })); }
  };
  await job(w, "p-1", { op: "studio_fill" }, "Fill in Studio");
  const filled = await card(store, "p-1", "studio_filled");
  check("filling sends the approved title, description and tags to the Studio tab", sent.length === 1 && sent[0].id === 44 && sent[0].msg.type === "NSP_STUDIO_FILL" && sent[0].msg.pkg.title === "The Night the City Fell" && /2:30 The end/.test(sent[0].msg.pkg.description), sent.map(s => s.msg.type));
  check("the message carries no save, publish or visibility order", sent.length === 1 && Object.keys(sent[0].msg).join() === "type,pkg" && Object.keys(sent[0].msg.pkg).join() === "title,description,tags");
  check("the report says it is filled and not saved", filled && filled.hero.value === "Filled" && filled.sections[0].rows.some(r => r.label === "Saved" && /^No\./.test(r.value)), filled && filled.hero);

  check("the first fill binds the package to the video it went into", w.local.nsp_studio_package.video === "abcdefghijk", w.local.nsp_studio_package.video);
  const peek = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "peek", videoId: "abcdefghijk" }, SENDERS.studio);
  check("the Studio page can see that a package is approved for its video", peek && peek.has === true && peek.bound === true && peek.title === "The Night the City Fell" && !peek.pkg);
  const other = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "peek", videoId: "zzzzzzzzzzz" }, SENDERS.studio);
  const otherPrep = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "prepare", videoId: "zzzzzzzzzzz" }, SENDERS.studio);
  check("another video's Details page is not offered that package, and cannot fetch it", other && other.has === false && other.video === "abcdefghijk" && otherPrep && !otherPrep.pkg, { other, otherPrep });
  const prep = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "prepare", videoId: "abcdefghijk" }, SENDERS.studio);
  check("and fetch it to fill on the user's press there", prep && prep.pkg && prep.pkg.title === "The Night the City Fell" && prep.timing === "script");
  const saved = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "saved", videoId: "abcdefghijk" }, SENDERS.studio);
  const after = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "peek", videoId: "abcdefghijk" }, SENDERS.studio);
  check("once Studio confirms the save the package is spent and not offered again", saved && saved.ok === true && after && after.has === false && after.spent === true, { saved, after });
  sent.length = 0;
  await job(w, "p-1", { op: "studio_fill" }, "Fill in Studio");
  check("and the chat will not fill a spent package into Studio again", sent.length === 0);
  const fromYt = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "prepare" }, SENDERS.youtube);
  const fromSite = await w.send({ type: "NSP_STUDIO_PACKAGE", op: "prepare" }, SENDERS.site);
  check("no other page can read the package", fromYt && fromYt.error === "sender_not_allowed" && fromSite && fromSite.error === "sender_not_allowed");
}

{
  const w = loadWorker({ fetch: fetchTable });
  for (const s of ["youtube", "studio", "site"]) {
    const r = await w.send({ type: "NSP_CREATE_RUN", convId: "x", text: "Fill in Studio", job: { op: "studio_fill" } }, SENDERS[s]);
    check("a page on " + s + " cannot run a create job", r && r.error === "sender_not_allowed", r);
  }
  const hub = await w.send({ type: "NSP_CREATE_RUN", convId: "x", text: "Fill in Studio", job: { op: "studio_fill" } }, SENDERS.hub);
  check("an extension page that is not the chat is turned away too", hub && hub.error === "not_allowed", hub);
  const J = w.context.nspCreateJobOf;
  check("only known create jobs are taken, and only with their own fields", J({ op: "studio_publish" }) === null && J({ op: "script" }) === null && J({ op: "studio_fill", visibility: "public" }).visibility === undefined && J({ op: "studio_pack", rowId: "12; drop" }).rowId === "");
  const route = t => w.context.nspVoiceRoute(t, "es");
  check("voice: next and siguiente open the next one", ["siguiente", "el siguiente", "next", "next video", "siguiente video", "pon el siguiente", "next result"].every(t => (route(t) || {}).kind === "next"));
  check("voice: next tab and next page keep their own meaning", route("siguiente pestaña").kind === "next_tab" && route("next page").kind === "forward");
  check("voice: how much does this channel earn becomes the earnings card", route("cuánto gana este canal").kind === "create" && route("cuánto gana este canal").create.kind === "earn");
  check("voice: the create commands route", ["escríbeme un guion con fuentes sobre roma", "saca shorts de este video", "rellena studio", "prepara el paquete para studio"].every(t => (route(t) || {}).kind === "create"));
  check("voice: find shorts is no longer a YouTube search", route("find shorts in this video").kind === "create");
  check("voice: talk about the next thing is not an order", route("el siguiente paso es difícil") === null && route("next time I will do it") === null);
  check("the next spoken lines exist in both languages", ["next_result", "next_video", "no_more_results", "nothing_next", "create_script", "create_shorts", "create_studio"].every(k => w.context.NSP_VOICE_LINES[k] && w.context.NSP_VOICE_LINES[k].en && w.context.NSP_VOICE_LINES[k].es));
  const B = w.context.NSP_BRAIN;
  const names = B.tools("chat", { agentOn: false })[0].functionDeclarations.map(d => d.name);
  check("the model can call the four create tools even with Agent off", ["zerackSourcedScript", "zerackShortsMiner", "zerackChannelEarnings", "zerackStudioPackage"].every(n => names.indexOf(n) >= 0));
  check("and has no tool that approves, fills, saves or publishes Studio", !names.some(n => /approve|fill|publish|studiosave|upload/i.test(n)) && names.filter(n => /studio/i.test(n)).join() === "zerackStudioPackage", names.filter(n => /studio|approve|fill|publish/i.test(n)));
}

{
  const { w, store } = worker({}, "https://www.youtube.com/watch?v=" + VID);
  const res = await new Promise(r => w.context.nspChatToolNow("zerackShortsMiner", { video: VID }, { origin: "chat", lang: "en", chatRun: { convId: "t-1", tabId: -1, stopped: false, gone: false, chain: Promise.resolve() } }, r));
  check("the model tool shows the Shorts card and returns the cuts", res && res.ok && res.card === "shorts" && res.data.clips.length >= 3 && store.rows.some(r => r.convId === "t-1" && r.meta.card.kind === "shorts"), res && res.data);
}

{
  const TABS = [
    { id: 61, url: "https://mail.proton.me/u/0/inbox", title: "Inbox: The fall of Constantinople notes" },
    { id: 62, url: "https://app.hubspot.com/contacts/1/record/0-1/5", title: "Constantinople fall contact" },
    { id: 63, url: "https://github.com/settings/tokens", title: "Personal access tokens: fall of Constantinople" },
    { id: 64, url: "https://en.wikipedia.org/wiki/Fall_of_Constantinople", title: "Fall of Constantinople - Wikipedia" }
  ];
  const TEXT = { 61: "Secret mail about the fall of Constantinople in 1453, token 1234", 62: "Contact record: fall of Constantinople customer", 63: "ghp_abcdefghijklmnopqrstuvwxyz0123456789 fall of Constantinople", 64: "The Fall of Constantinople was the capture of the Byzantine capital by the Ottoman Empire in 1453." };
  const boot = sites => {
    const w = loadWorker({ allSites: true, local: sites ? { nsp_agent_sites: sites } : {} });
    const read = [];
    w.context.chrome.tabs = { query: (q, cb) => setImmediate(() => cb(TABS)) };
    w.context.chrome.scripting = { executeScript: inj => { read.push(inj.target.tabId); const t = TABS.find(x => x.id === inj.target.tabId); return Promise.resolve([{ result: { title: t.title, url: t.url, lang: "en", text: TEXT[t.id], password: false } }]); } };
    return { w, read };
  };
  const a = boot(null);
  const none = await a.w.context.nspCreatePages("the fall of Constantinople");
  check("with Chrome's blanket grant from the bubble switch but no consent in ZERACK, no open tab is read", a.read.length === 0 && none.pages.length === 0, { read: a.read, pages: none.pages.map(p => p.url) });
  check("the tabs about the topic are asked for instead, one site at a time, never a mail inbox or a CRM", none.origins.join() === "https://en.wikipedia.org/*" && none.sites.every(x => x.consent === "none"), none.origins);
  check("a settings, tokens or keys page is never read nor asked for", !none.origins.includes("https://github.com/*") && !a.read.includes(63) && none.tried.some(t => /private page/.test(t.why)), none.tried);
  const now = Date.now();
  const b = boot({ "en.wikipedia.org": { mode: "read", playbook: "web", since: now }, "github.com": { mode: "act", playbook: "builders", since: now } });
  const got = await b.w.context.nspCreatePages("the fall of Constantinople");
  check("a site the user allowed is read, and only that one", b.read.join() === "64" && got.pages.length === 1 && /Byzantine capital/.test(got.pages[0].text), { read: b.read, pages: got.pages.map(p => p.url) });
  check("an allowed site's private page stays unread", !b.read.includes(63) && !got.pages.some(p => /ghp_/.test(p.text)));
  const c = boot({});
  await c.w.context.nspCreatePages("the fall of Constantinople");
  check("after Stop ZERACK on a site removes its consent, the Chrome grant alone reads nothing", c.read.length === 0, c.read);
}

clearInterval(keep);
done("sw-create");
