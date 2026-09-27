// Voice "next" on youtube.com: after a result opened by voice it opens the one after it, on a watch page with no
// voice result it presses YouTube's own next button, and it does nothing with the Agent switch off.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, EXT_ID, check, done } from "./sw-harness.mjs";

function load(opts) {
  const clicks = [];
  const assigned = [];
  const store = { nsp_agent_enabled: opts.agent !== false };
  const link = id => ({ href: "https://www.youtube.com/watch?v=" + id, click() { clicks.push(id); }, closest() { return null; } });
  const rows = (opts.rows || []).map(id => ({ getAttribute: k => (k === "data-video-id" ? id : null), querySelector: () => null }));
  const shadow = { querySelectorAll: () => rows };
  const nextButton = opts.nextButton ? { getAttribute: k => (k === "aria-disabled" ? (opts.nextDisabled ? "true" : "false") : (k === "href" ? "https://www.youtube.com/watch?v=ccccccccccc" : null)), getBoundingClientRect: () => ({ width: opts.nextHidden ? 0 : 36, height: 36 }), click() { clicks.push("ytp-next"); } } : null;
  const document = {
    documentElement: { setAttribute() {}, getAttribute() { return null; } },
    getElementById: id => (id === "nsp-shadow-host" && rows.length ? { shadowRoot: shadow } : null),
    querySelector: sel => {
      if (sel === ".ytp-next-button") return nextButton;
      const m = /watch\?v=([A-Za-z0-9_-]{11})/.exec(sel);
      return m ? link(m[1]) : null;
    },
    querySelectorAll: () => [],
    body: { appendChild() {}, removeChild() {} },
    createElement: () => ({ appendChild() {}, setAttribute() {} })
  };
  const win = { location: { origin: "https://www.youtube.com", href: "https://www.youtube.com" + opts.path, pathname: opts.path.split("?")[0], assign: u => assigned.push(u) }, addEventListener() {}, postMessage() {} };
  const chrome = {
    runtime: { id: EXT_ID, lastError: undefined, getURL: p => p, sendMessage(m, cb) { if (cb) setImmediate(() => cb({})); }, onMessage: { addListener() {} } },
    storage: { local: { get(keys, cb) { const out = {}; [].concat(keys).forEach(k => { if (k in store) out[k] = store[k]; }); setImmediate(() => cb(out)); }, set(i, cb) { Object.assign(store, i); if (cb) setImmediate(cb); } } }
  };
  const context = { chrome, window: win, location: win.location, document, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setImmediate, URL, Blob };
  context.self = context;
  vm.createContext(context);
  for (const f of ["lib/nsp-data-tools.js", "content/ashlyv-bridge.js"]) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), context, { filename: f });
  const act = (action, n) => new Promise(r => context.nspVoiceAct({ type: "NSP_VOICE_ACT", action, n: n || 0 }, r));
  const settle = () => new Promise(r => setTimeout(r, 60));
  return { act, clicks, assigned, settle };
}

const IDS = ["aaaaaaaaaa1", "aaaaaaaaaa2", "aaaaaaaaaa3"];
{
  const b = load({ rows: IDS, path: "/watch?v=aaaaaaaaaa2", nextButton: true });
  const r1 = await b.act("result", 2);
  await b.settle();
  const r2 = await b.act("next");
  await b.settle();
  check("after opening result 2 by voice, next opens result 3", r1.code === "open" && r2.ok && r2.code === "next_result" && b.clicks.join() === "aaaaaaaaaa2,aaaaaaaaaa3", { r1, r2, clicks: b.clicks });
  const r3 = await b.act("next");
  check("after the last result it says so and opens nothing", r3.ok === false && r3.code === "no_more_results" && b.clicks.length === 2, r3);
}
{
  const b = load({ rows: [], path: "/watch?v=bbbbbbbbbbb", nextButton: true });
  const r = await b.act("next");
  check("on a watch page with no voice result, next presses YouTube's next button", r.ok && r.code === "next_video" && b.clicks.join() === "ytp-next", r);
}
{
  const b = load({ rows: [], path: "/watch?v=bbbbbbbbbbb", nextButton: true, nextHidden: true });
  const r = await b.act("next");
  await b.settle();
  check("when YouTube hides its next button, next follows the video that button points to", r.ok && r.code === "next_video" && b.clicks.join() === "ccccccccccc", { r, clicks: b.clicks });
}
{
  const b = load({ rows: [], path: "/watch?v=bbbbbbbbbbb", nextButton: true, nextDisabled: true });
  const r = await b.act("next");
  check("a disabled next button is not pressed", r.ok === false && r.code === "nothing_next" && !b.clicks.length, r);
}
{
  const b = load({ rows: IDS, path: "/results?search_query=rome" });
  const r = await b.act("next");
  await b.settle();
  check("with results and none opened yet, next opens the first", r.ok && r.code === "next_result" && b.clicks.join() === "aaaaaaaaaa1", r);
}
{
  const b = load({ rows: [], path: "/" });
  const r = await b.act("next");
  check("on the home page with nothing to follow it says so", r.ok === false && r.code === "nothing_next", r);
}
{
  const b = load({ rows: IDS, path: "/watch?v=aaaaaaaaaa2", nextButton: true, agent: false });
  const r = await b.act("next");
  check("with the Agent switch off nothing is pressed", r.ok === false && r.code === "agent_needed" && !b.clicks.length, r);
}

done("bridge-next");
