#!/usr/bin/env node
// Contract test for the Ashlyv hub: the page only calls client methods that exist, the client
// speaks the service worker's message shapes, and the emoji sweep and the ?d= door stay closed.
// Run: node tests/hub-api.test.mjs   (HUB_API_FILE=path points it at another copy of the client)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_FILE = process.env.HUB_API_FILE ? resolve(process.env.HUB_API_FILE) : join(ROOT, "ashlyv/ashlyv-api.js");
const PAGE_FILE = join(ROOT, "ashlyv/ashlyv.js");
const read = p => readFileSync(p, "utf8");

let failures = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push("  ok    " + name); }
  catch (e) { failures++; results.push("  FAIL  " + name + "\n        " + String(e && e.message || e).split("\n").join("\n        ")); }
}

// A fresh client in its own context. respond(message) returns what the service worker would send
// back, or a function that receives the callback when the test needs to control the timing.
function loadClient({ respond = () => ({ ok: true }), storage = {}, lastError = null } = {}) {
  const sent = [];
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        sent.push(JSON.parse(JSON.stringify(message)));
        const answer = respond(message);
        setTimeout(() => {
          chrome.runtime.lastError = lastError;
          if (typeof answer === "function") answer(callback);
          else callback(answer);
          chrome.runtime.lastError = null;
        }, 0);
      }
    },
    storage: { local: { get(keys, cb) { const out = {}; [].concat(keys).forEach(k => { if (k in storage) out[k] = storage[k]; }); cb(out); } } }
  };
  const context = { window: {}, chrome, console, setTimeout, clearTimeout, Intl, Promise };
  vm.createContext(context);
  vm.runInContext(read(API_FILE), context, { filename: API_FILE });
  return { API: context.window.AshlyVAPI, sent };
}

const chatAnswer = obj => ({ ok: true, text: JSON.stringify(obj), provider: "groq", modelUsed: "test-model" });

await test("1. every AshlyVAPI method the hub calls is exported by the client", () => {
  const { API } = loadClient();
  assert.ok(API && typeof API === "object", "ashlyv-api.js did not define window.AshlyVAPI");
  const page = read(PAGE_FILE);
  const called = new Set([...page.matchAll(/\b(?:API|AshlyVAPI)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  assert.ok(called.size > 10, "found only " + called.size + " calls in ashlyv.js, the scan itself is broken");
  const missing = [...called].filter(name => typeof API[name] !== "function");
  assert.deepEqual(missing, [], "ashlyv.js calls methods the client does not export: " + missing.join(", "));
});

await test("2a. AI calls send ASHLYV_CHAT_REQUEST with payload.messages and read ok/text", async () => {
  const cases = [
    ["generateNicheIdeas", API => API.generateNicheIdeas("ancient history", "es"), { titles: ["t1"], hooks: ["h1"], thumbnailConcepts: ["c1"] }, r => assert.deepEqual([...r.titles], ["t1"])],
    ["generateContentScript", API => API.generateContentScript("lost cities", { language: "en" }), { title: "T", hook: "H", outline: [{ section: "S", summary: "x" }], thumbnailConcept: "C" }, r => assert.equal(r.title, "T")],
    ["generateSubniches", API => API.generateSubniches("dark history", { language: "en" }), { subNiches: [{ name: "N", angle: "A", exampleTitles: ["x"] }], avoid: [] }, r => assert.equal(r.subNiches[0].name, "N")],
    ["analyzeChannel", API => API.analyzeChannel({ url: "https://www.youtube.com/@x", stats: { name: "X" }, videos: [{ title: "v", viewsText: "1K views", publishedText: "1 day ago" }] }, "en"), { niche: "N", strengths: ["s"] }, r => assert.equal(r.niche, "N")]
  ];
  for (const [name, call, answer, check] of cases) {
    const { API, sent } = loadClient({ respond: () => chatAnswer(answer) });
    const result = await call(API);
    const msg = sent.find(m => m.type === "ASHLYV_CHAT_REQUEST");
    assert.ok(msg, name + " did not send ASHLYV_CHAT_REQUEST");
    assert.ok(msg.payload && Array.isArray(msg.payload.messages) && msg.payload.messages.length, name + ": payload.messages missing");
    assert.equal(msg.payload.messages[0].role, "user", name + ": first message is not the user turn");
    assert.equal(typeof msg.payload.messages[0].content, "string", name + ": message content is not text");
    assert.equal(typeof msg.payload.system, "string", name + ": payload.system missing");
    assert.equal(typeof msg.payload.maxTokens, "number", name + ": payload.maxTokens missing");
    for (const stray of ["model", "systemPrompt", "messages", "imageBase64", "apiKey"]) {
      assert.ok(!(stray in msg), name + " still sends top level " + stray + ", which the service worker never reads");
    }
    assert.ok(!("model" in msg.payload), name + " picks a model; the user picks it in Options");
    check(result);
    assert.equal(result.provider, "groq", name + " lost the provider");
    assert.equal(result.model, "test-model", name + " lost modelUsed");
  }
});

await test("2b. a chat failure is read from ok/error, and the old success shape is not taken as success", async () => {
  const none = loadClient({ respond: () => ({ ok: false, error: "no_provider_configured", detail: "x" }) });
  await assert.rejects(none.API.generateNicheIdeas("n", "en"), e => e.reason === "no_provider_configured" && /Options/.test(e.message));
  const legacy = loadClient({ respond: () => ({ success: true, content: '{"titles":["x"]}' }) });
  await assert.rejects(legacy.API.generateNicheIdeas("n", "en"), e => e.reason === "failed");
  const prose = loadClient({ respond: () => ({ ok: true, text: "Sure! Here are some ideas.", provider: "groq" }) });
  await assert.rejects(prose.API.generateNicheIdeas("n", "en"), e => e.reason === "unparsed_answer");
});

await test("2c. transport failures reject with an explicit reason", async () => {
  const broken = loadClient({ lastError: { message: "Could not establish connection" }, respond: () => undefined });
  await assert.rejects(broken.API.channelStats("@someone"), e => e.reason === "runtime_error" && /Could not establish connection/.test(e.message));
  const silent = loadClient({ respond: () => undefined });
  await assert.rejects(silent.API.searchVideos("mystery"), e => e.reason === "no_response");
  const late = loadClient({ respond: () => () => {} });
  await assert.rejects(late.API.sendToSW("ASHLYV_PING", {}, 20), e => e.reason === "timeout");
});

await test("2d. replicate and brand go through NSP_AI_TASK with the service worker's prompt", async () => {
  const { API, sent } = loadClient({ respond: m => m.task === "replicate"
    ? { ok: true, task: "replicate", result: { source: { name: "X", url: "u" }, basedOn: ["real title"], videos: [{ title: "New", hook: "Hook" }] }, provider: "groq", model: "m" }
    : { ok: true, task: "brand", result: { channelNames: ["Name"], bio: "Bio", strategySummary: "Plan" }, provider: "groq", model: "m" } });
  const rep = await API.replicate("@SomeChannel", "es");
  const brand = await API.buildBrand("dark history", "drama", "en");
  assert.deepEqual(sent.map(m => [m.type, m.task]), [["NSP_AI_TASK", "replicate"], ["NSP_AI_TASK", "brand"]]);
  assert.equal(sent[0].data.channelUrl, "https://www.youtube.com/@SomeChannel");
  assert.equal(sent[0].data.language, "es");
  assert.deepEqual({ ...sent[1].data }, { niche: "dark history", tone: "drama", language: "en" });
  assert.equal(rep.videos[0].title, "New");
  assert.equal(brand.bio, "Bio");
  const unparsed = loadClient({ respond: () => ({ ok: false, error: "unparsed_answer", detail: "raw" }) });
  await assert.rejects(unparsed.API.buildBrand("x", "pro", "en"), e => e.reason === "unparsed_answer");
});

await test("2e. real data calls use the NSP_AGENT_* shapes and report unreadable fields instead of zero", async () => {
  const { API, sent } = loadClient({ respond: m => {
    if (m.type === "NSP_AGENT_CHANNEL_STATS") return { ok: true, channelUrl: m.channelUrl, name: "X", subscribers: "1,2 M", videoCount: "unknown", totalViews: "unknown", joined: "Mar 3", country: "unknown", description: "", note: "" };
    if (m.type === "NSP_AGENT_CHANNEL_VIDEOS") return { ok: true, count: 2, videos: [{ videoId: "a", title: "One", views: "1.2M views", published: "3 days ago" }, { videoId: "b", title: "Two", views: "", published: "hace 2 semanas" }] };
    return { ok: false, error: "unexpected" };
  } });
  const scan = await API.scanChannelFull("https://www.youtube.com/@Xyz/videos");
  assert.deepEqual(sent.map(m => m.type).sort(), ["NSP_AGENT_CHANNEL_STATS", "NSP_AGENT_CHANNEL_VIDEOS"]);
  assert.ok(sent.every(m => m.channelUrl === "https://www.youtube.com/@Xyz"), "channelUrl was not normalized");
  assert.equal(scan.stats.subscribers, 1200000);
  assert.equal(scan.stats.videoCount, null, "an unknown count became a number");
  assert.equal(scan.stats.monthsOld, null, "a join date with no year produced an age");
  assert.ok(scan.stats.unreadable.some(f => /join date/.test(f)), "the unreadable join date is not reported");
  assert.equal(scan.videos[1].views, null, "an empty views text became a number");
  assert.equal(scan.summary.unreadableViews, 1);
  assert.equal(scan.summary.medianViews, 1200000);
  await assert.rejects(API.channelStats("https://www.youtube.com/c/legacy"), e => e.reason === "bad_channel");
});

await test("2f. the provider status names providers and never returns a key", async () => {
  const keys = { nsp_groq_api_key: "gsk_" + "x".repeat(40), nsp_gemini_api_key: "AIza" + "y".repeat(35), nsp_ollama_enabled: false, nsp_selected_model: "auto" };
  const { API } = loadClient({ storage: keys });
  const status = await API.getProviderStatus();
  assert.deepEqual([...status.providers], ["Groq", "Gemini"]);
  const dump = JSON.stringify(status);
  assert.ok(!dump.includes(keys.nsp_groq_api_key) && !dump.includes(keys.nsp_gemini_api_key), "a key leaked into the status");
});

await test("3. no ternary with two empty branches left by the emoji sweep", () => {
  const files = ["ashlyv/ashlyv.js", "ashlyv/ashlyv-api.js", "ashlyv/ashlyv-engine.js", "ashlyv/tools/thumblab.js"];
  const EMPTY = /\?\s*(?:''|"")\s*:\s*(?:''|"")|===\s*(?:''|"")\s*\|\|/;
  const hits = [];
  for (const f of files) read(join(ROOT, f)).split("\n").forEach((line, i) => { if (EMPTY.test(line)) hits.push(f + ":" + (i + 1) + "  " + line.trim().slice(0, 100)); });
  assert.deepEqual(hits, [], "empty ternaries:\n" + hits.join("\n"));
});

await test("4. the hub does not read a ?d= payload from its URL", () => {
  const page = read(PAGE_FILE);
  assert.ok(!/\.get\(\s*['"]d['"]\s*\)/.test(page), "ashlyv.js reads the d query parameter");
  assert.ok(!/\batob\s*\(/.test(page), "ashlyv.js still decodes base64 from somewhere");
  assert.ok(!/loadInlinePayload/.test(page), "loadInlinePayload is still there");
});

await test("5. innerHTML in ashlyv.js never receives a value built from data", () => {
  const page = read(PAGE_FILE);
  const bad = [];
  for (const m of page.matchAll(/\.innerHTML\s*\+?=\s*([\s\S]*?);\s*\n/g)) {
    const rest = m[1].replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "").replace(/[\s+]/g, "");
    if (rest) bad.push(page.slice(0, m.index).split("\n").length + ": " + m[0].trim().slice(0, 90));
  }
  assert.deepEqual(bad, [], "innerHTML built from values:\n" + bad.join("\n"));
});

await test("6. the count, age and date parsers read the formats YouTube serves", () => {
  const { API } = loadClient();
  const counts = { "1.2M views": 1200000, "1,2 M de visualizaciones": 1200000, "12 mil visualizaciones": 12000, "1.234.567 visualizaciones": 1234567, "1,234,567 views": 1234567, "No views": 0, "2,5 mi de visualizações": 2500000, "unknown": null, "views": null };
  for (const [text, want] of Object.entries(counts)) assert.equal(API.parseCount(text), want, "parseCount(" + JSON.stringify(text) + ")");
  const ages = { "3 days ago": 3, "hace 2 semanas": 14, "a year ago": 365.25, "vor 5 Tagen": 5, "": null, "Premiere soon": null };
  for (const [text, want] of Object.entries(ages)) assert.equal(API.parseAgeDays(text), want, "parseAgeDays(" + JSON.stringify(text) + ")");
  assert.deepEqual({ ...API.parseJoinedDate("Se unió el 3 mar 2021") }, { year: 2021, month: 2, day: 3 });
  assert.equal(API.parseJoinedDate("Mar 3"), null);
  assert.equal(API.normalizeChannelUrl("youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA"), "https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA");
  assert.equal(API.normalizeChannelUrl("mystery documentary"), null);
});

console.log("hub-api.test.mjs  (client: " + API_FILE.replace(ROOT + "/", "") + ")");
console.log(results.join("\n"));
console.log(failures ? "\n" + failures + " failed" : "\nall passed");
process.exit(failures ? 1 : 0);
