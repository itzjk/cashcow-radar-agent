// Loads background/service-worker.js in a Node vm with a fake chrome API, so the tests call the real message
// router with the senders Chrome would pass. Nothing here talks to the network: fetch answers from a table.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EXT_ID = "abcdefghijklmnopabcdefghijklmnop";
export const EXT = "chrome-extension://" + EXT_ID + "/";

// Any property read on it is another stub and any call returns one, so the worker's startup wiring runs untouched.
function stub() {
  const fn = function () { return stub(); };
  return new Proxy(fn, {
    get(t, k) { if (k === "then") return undefined; if (k === Symbol.toPrimitive) return () => ""; return stub(); },
    apply() { return stub(); }
  });
}

function area(store) {
  return {
    get(keys, cb) {
      const out = {};
      const list = keys == null ? Object.keys(store) : (Array.isArray(keys) ? keys : (typeof keys === "string" ? [keys] : Object.keys(keys)));
      for (const k of list) if (k in store) out[k] = JSON.parse(JSON.stringify(store[k]));
      if (typeof cb === "function") { setImmediate(() => cb(out)); return undefined; }
      return Promise.resolve(out);
    },
    set(items, cb) {
      Object.assign(store, JSON.parse(JSON.stringify(items)));
      if (typeof cb === "function") { setImmediate(cb); return undefined; }
      return Promise.resolve();
    },
    remove(keys, cb) {
      for (const k of [].concat(keys)) delete store[k];
      if (typeof cb === "function") { setImmediate(cb); return undefined; }
      return Promise.resolve();
    }
  };
}

export function loadWorker(opts = {}) {
  const calls = [];
  const listeners = [];
  const local = Object.assign({}, opts.local || {});
  const session = {};
  const fetches = [];
  const tabs = new Proxy({}, {
    get(t, name) {
      if (name === "onRemoved" || name === "onUpdated" || name === "onActivated") return { addListener() {}, removeListener() {}, hasListener() { return false; } };
      return function (...args) {
        calls.push({ api: "tabs." + String(name), args });
        const cb = args.find(a => typeof a === "function");
        const answer = name === "query" ? [{ id: 7, url: "https://example.com/private", title: "Private tab", active: true }] : { id: 9 };
        if (cb) setImmediate(() => cb(answer));
        return Promise.resolve(answer);
      };
    }
  });
  const chrome = new Proxy({
    runtime: new Proxy({
      id: EXT_ID,
      getURL: p => EXT + String(p || "").replace(/^\//, ""),
      lastError: undefined,
      onMessage: { addListener: fn => listeners.push(fn), removeListener() {}, hasListener() { return false; } },
      getPlatformInfo: cb => cb && cb({}),
      getContexts: () => Promise.resolve([])
    }, { get(t, k) { return k in t ? t[k] : stub(); } }),
    storage: { local: area(local), session: area(session), sync: area({}), onChanged: { addListener() {} } },
    declarativeNetRequest: { updateSessionRules: rules => { calls.push({ api: "dnr.updateSessionRules", args: [rules] }); return Promise.resolve(); } },
    tabs
  }, { get(t, k) { return k in t ? t[k] : stub(); } });

  const context = {
    chrome,
    console: opts.verbose ? console : { log() {}, warn() {}, info() {}, debug() {}, error() {} },
    setTimeout: (fn, ms) => { const h = setTimeout(fn, Math.min(Number(ms) || 0, 50)); h.unref && h.unref(); return h; },
    clearTimeout, setInterval: () => 0, clearInterval() {}, setImmediate,
    crypto: webcrypto, navigator: { language: "en-US", userAgent: "node" },
    URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, Blob,
    btoa: s => Buffer.from(s, "binary").toString("base64"), atob: s => Buffer.from(s, "base64").toString("binary"),
    indexedDB: stub(),
    fetch: async (url, init) => {
      fetches.push({ url: String(url), init });
      const reply = (opts.fetch && opts.fetch(String(url), init)) || { status: 404, body: {} };
      return {
        ok: reply.status >= 200 && reply.status < 300, status: reply.status,
        headers: { get: () => null },
        json: async () => reply.body, text: async () => typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body),
        arrayBuffer: async () => new ArrayBuffer(8)
      };
    }
  };
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  context.importScripts = (...paths) => {
    for (const p of paths) {
      const file = join(ROOT, "background", p);
      vm.runInContext(readFileSync(file, "utf8"), context, { filename: file });
    }
  };
  const swFile = join(ROOT, "background/service-worker.js");
  vm.runInContext(readFileSync(swFile, "utf8"), context, { filename: swFile });

  // Sends one message the way Chrome does: every listener sees it, the first answer wins.
  function send(msg, sender) {
    return new Promise(resolve => {
      let answered = false, pending = false;
      const respond = r => { if (!answered) { answered = true; resolve(r); } };
      for (const fn of listeners) {
        const keep = fn(msg, sender, respond);
        if (keep === true) pending = true;
      }
      if (!pending) setTimeout(() => respond(undefined), 30);
    });
  }
  return { context, calls, local, session, fetches, send };
}

export const SENDERS = {
  popup: { id: EXT_ID, url: EXT + "popup/popup.html" },
  hub: { id: EXT_ID, url: EXT + "ashlyv/ashlyv.html", tab: { id: 3 }, frameId: 0 },
  youtube: { id: EXT_ID, url: "https://www.youtube.com/watch?v=abcdefghijk", tab: { id: 11, url: "https://www.youtube.com/" }, frameId: 0 },
  youtube2: { id: EXT_ID, url: "https://www.youtube.com/", tab: { id: 12, url: "https://www.youtube.com/" }, frameId: 0 },
  studio: { id: EXT_ID, url: "https://studio.youtube.com/channel/UCx", tab: { id: 13 }, frameId: 0 },
  site: { id: EXT_ID, url: "https://example.com/", tab: { id: 14 }, frameId: 0 },
  otherExtension: { id: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz", url: "chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz/x.html" }
};

let failures = 0;
export function check(name, cond, detail) {
  if (cond) console.log("  ok    " + name);
  else { failures++; console.log("  FAIL  " + name + (detail !== undefined ? " :: " + JSON.stringify(detail).slice(0, 300) : "")); }
}
export function done(label) {
  console.log(failures ? label + ": " + failures + " failure(s)" : label + ": all passed");
  process.exit(failures ? 1 : 0);
}
