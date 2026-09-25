// What the extension asks Chrome for and runs where: the bubble on other sites only with the user's permission,
// localhost on the two ports it uses, face-api out of the page world, no API keys copied into localStorage, and
// HTML written to pages through allow lists or as text.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadWorker, check, done } from "./sw-harness.mjs";

const read = f => readFileSync(join(ROOT, f), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const scripts = manifest.content_scripts || [];
const ALL = ["http://*/*", "https://*/*", "<all_urls>", "*://*/*"];

// 4. The bubble and localhost.
check("no content script runs on every site from the manifest", !scripts.some(c => c.matches.some(m => ALL.includes(m))), scripts.map(c => c.matches));
check("every site is an optional permission", JSON.stringify(manifest.optional_host_permissions) === JSON.stringify(["http://*/*", "https://*/*"]), manifest.optional_host_permissions);
check("the bubble still runs on YouTube and Studio", scripts.some(c => c.js.includes("content/zerack-bubble.js") && c.matches.includes("https://www.youtube.com/*") && c.matches.includes("https://studio.youtube.com/*")));
const local = manifest.host_permissions.filter(h => /localhost|127\.0\.0\.1/.test(h));
check("localhost only on the ports the extension calls", JSON.stringify(local) === JSON.stringify(["http://localhost:11434/*", "http://127.0.0.1:11434/*", "http://127.0.0.1:7788/*"]), local);
{
  const models = {};
  vm.runInNewContext(read("lib/nsp-models.js"), { self: models });
  const M = models.NSP_MODELS;
  check("an Ollama address on another port or host is refused", M.ollamaUrl("http://localhost:11434/") === "http://localhost:11434" && M.ollamaUrl("http://localhost:8080") === "" && M.ollamaUrl("http://192.168.1.5:11434") === "");
}
{
  const w = loadWorker({ allSites: true });
  await new Promise(r => setTimeout(r, 30));
  w.context.nspBubbleSync();
  await new Promise(r => setTimeout(r, 30));
  const reg = w.registered.find(r => r.id === "zerack-bubble-everywhere");
  check("with the permission the worker registers the bubble for every site", !!reg && reg.js.join() === "content/zerack-bubble.js" && reg.world === "ISOLATED", reg);
  const w2 = loadWorker({ allSites: false, registered: [{ id: "zerack-bubble-everywhere" }] });
  w2.context.nspBubbleSync();
  await new Promise(r => setTimeout(r, 30));
  check("without it the registration is removed", !w2.registered.length && w2.calls.some(c => c.api === "scripting.unregisterContentScripts"), w2.registered);
}
{
  const popup = read("popup/popup.js");
  check("the popup asks for every site from the click itself", /btn\.addEventListener\('click', \(\) => \{\s*const next = [^\n]*\n\s*if \(next\) askEverywhere\(\);/.test(popup) && /chrome\.permissions\.request\(BUBBLE_EVERYWHERE/.test(popup));
}

// 7. face-api runs in the isolated world.
const mainJs = scripts.filter(c => c.world === "MAIN").flatMap(c => c.js);
const isoJs = scripts.filter(c => c.world !== "MAIN" && c.matches.includes("https://www.youtube.com/*")).flatMap(c => c.js);
check("face-api is not loaded into youtube.com's page world", !mainJs.some(f => /face-api/.test(f)), mainJs);
check("it runs in the isolated world with its reader", isoJs.indexOf("lib/face-api/face-api.min.js") >= 0 && isoJs.indexOf("lib/face-api/face-api.min.js") < isoJs.indexOf("content/nsp-faces.js"), isoJs);
check("the page world no longer calls faceapi", !/faceapi\./.test(read("content/nsp-bundle.js")));
check("the bridge loads before the page world", scripts.findIndex(c => c.js.includes("content/ashlyv-bridge.js")) < scripts.findIndex(c => c.world === "MAIN"));

// 5. Setup keeps API keys out of localStorage and drops the fields nothing reads.
{
  const ls = new Map([["nsp_voice_prefs", JSON.stringify({ nsp_openai_api_key: "sk-old", nsp_fish_api_key: "fish-old", nsp_voice_engine: "fish" })]]);
  const localStorage = { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)) };
  const store = { nsp_openai_api_key: "sk-" + "a".repeat(30), nsp_fish_api_key: "f".repeat(30), nsp_voice_engine: "fish", nsp_voice_lang: "es" };
  const el = () => ({ addEventListener() {}, value: "", textContent: "", className: "", appendChild() {}, style: {} });
  const ctx = {
    localStorage, console: { log() {}, warn() {} }, setTimeout, clearTimeout,
    document: { addEventListener() {}, getElementById: el, createElement: el },
    chrome: { runtime: { lastError: null, sendMessage() {}, getURL: p => p }, storage: { local: { get: (k, cb) => cb(Object.fromEntries([].concat(k).filter(x => x in store).map(x => [x, store[x]]))), set: (o, cb) => cb && cb() }, onChanged: { addListener() {} } } },
    fetch: () => Promise.reject(new Error("offline"))
  };
  vm.createContext(ctx);
  vm.runInContext(read("setup/setup.js"), ctx);
  ctx.voiceMirror();
  const copy = JSON.parse(ls.get("nsp_voice_prefs"));
  check("Setup's preferences copy keeps the voice and drops the keys", copy.nsp_voice_engine === "fish" && !("nsp_openai_api_key" in copy) && !("nsp_fish_api_key" in copy), copy);
  const html = read("setup/setup.html"), js = read("setup/setup.js");
  check("the TypeSafe and Vercel AI Gateway fields are gone", !/typesafe|gateway/i.test(html) && !/typesafe|gateway/i.test(js));
  check("the voice document removes copies an older Setup left", /scrubMirror/.test(read("offscreen/voice.js")) && /delete r\.nsp_openai_api_key/.test(read("offscreen/voice.js")));
}

// 6. The HTML setter works from allow lists, and error text is text.
{
  const bundle = read("content/nsp-bundle.js");
  const tags = (bundle.match(/var TAGS = \{([^}]*)\}/) || [])[1] || "";
  check("the sanitizer keeps an allow list of tags", tags.length > 0 && /DIV: 1/.test(tags), tags.slice(0, 80));
  check("STYLE, SVG, ANIMATE, SET, USE, SCRIPT and IFRAME are not on it", !/\b(?:STYLE|SVG|ANIMATE|SET|USE|SCRIPT|IFRAME|OBJECT|EMBED)\b/.test(tags), tags);
  check("an unlisted tag is removed, not kept", /if \(TAGS\[tag\] !== 1\) \{ kid\.remove\(\); return; \}/.test(bundle) && !/var DROP = \{/.test(bundle));
  check("style attributes cannot load URLs", /url\\s\*\\\(/.test(bundle));
  check("the dashboard writes error messages as text", !/innerHTML\s*=[^;]*err\.message/.test(read("dashboard/dashboard.js")));
  check("ThumbLab writes its status label as text", !/statusEl\.innerHTML\s*=[^;]*label/.test(read("ashlyv/tools/thumblab.js")));
}

done("surface");
