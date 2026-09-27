// The page agent in the worker: consent, the Agent switch, isolated-world steps, the chat's press, Stop, navigation and the ledger.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { ROOT, check, done } from "./sw-harness.mjs";

const SCALE = 1000;
const wait = ms => new Promise(r => setTimeout(r, ms));

function fakeHands(page) {
  return function create(hooks) {
    let held = null;
    const acts = {
      click(a) {
        const t = String(a.target || "");
        if (/Add to cart/.test(t)) { page.cart++; return { ok: true, clicked: 'button "Add to cart"' }; }
        if (/Place your order/.test(t)) {
          held = { handle: "h" + (++page.holds), perform: () => { page.placed++; return { ok: true, clicked: 'button "Place your order"', confirmedByUser: true }; } };
          return { ok: false, code: "needs_press", kind: "Pay", line: 'Pay: click button "Place your order" on shop.test/checkout', handle: held.handle, error: "waiting for a press from the user" };
        }
        if (/Delete account/.test(t)) return { ok: false, code: "refused", error: "refused: click button \"Delete account\" on shop.test/settings: it deletes or closes the whole account" };
        if (/Next step/.test(t)) { page.go(page.url.replace(/\/one$/, "/two")); return { ok: true, clicked: 'link "Next step"', mayLeave: true }; }
        if (/Save and leave/.test(t)) { page.go(page.url + "?saved=1"); return undefined; }
        if (/Publish now/.test(t)) {
          held = { handle: "h" + (++page.holds), perform: () => { page.placed++; page.go(page.url + "?published=1"); return undefined; } };
          return { ok: false, code: "needs_press", kind: "Publish", line: 'Publish: click button "Publish now" on shop.test/admin', handle: held.handle, error: "waiting" };
        }
        return { ok: false, code: "not_found", error: "not found on the page: " + t };
      },
      type(a) {
        if (/Card number/.test(String(a.target))) return { ok: false, code: "sensitive", error: "refused: it asks for payment data" };
        const before = page.fields[a.target] || "";
        page.fields[a.target] = a.text;
        return { ok: true, typed: String(a.text).length + " characters into textbox", field: 'textbox "' + String(a.target).replace(/"/g, "") + '"', before, after: a.text, hooksSeen: { hold: hooks.hold, ledger: hooks.ledger } };
      },
      read() { return { ok: true, pageData: true, url: page.url, onScreen: ['button "Add to cart"'] }; }
    };
    acts.paste = acts.type;
    return {
      act(a) {
        page.steps.push(Object.assign({}, a));
        if (hooks.stopped()) return Promise.resolve({ ok: false, code: "stopped" });
        const f = acts[a.action];
        return Promise.resolve(f ? f(a) : { ok: false, error: "unknown" });
      },
      press(handle) {
        if (!held || held.handle !== handle) return Promise.resolve({ ok: false, code: "expired" });
        const h = held; held = null;
        return Promise.resolve(h.perform());
      },
      release() { page.released++; held = null; return true; }
    };
  };
}

function world(opts = {}) {
  const calls = [];
  const rows = [];
  const ledger = [];
  const local = { nsp_agent_sites: opts.sites || {} };
  const granted = new Set(opts.granted || []);
  const tabs = {};
  function newPage(id, url) {
    const page = {
      id, url, status: "complete", cart: 0, placed: 0, holds: 0, released: 0, fields: {}, steps: [], stopCalls: 0,
      doc: { n: Math.random() },
      go(next) { page.url = next; page.status = "loading"; page.doc = { n: Math.random() }; page.ctx = null; setTimeout(() => { page.status = "complete"; }, 5); }
    };
    tabs[id] = page;
    return page;
  }
  const chrome = {
    runtime: { lastError: undefined },
    storage: { local: { get(k, cb) { setImmediate(() => cb({ [k]: JSON.parse(JSON.stringify(local[k] || {})) })); } } },
    permissions: { contains(p, cb) { setImmediate(() => cb(p.origins.every(o => granted.has(o)))); } },
    tabs: {
      get(id, cb) { const p = tabs[id]; setImmediate(() => cb(p ? { id, url: p.url, status: p.status, title: "T" } : undefined)); },
      query(q, cb) { setImmediate(() => cb(Object.values(tabs).map(p => ({ id: p.id, url: p.url, status: p.status, active: true, windowId: 1, lastAccessed: p.id })))); },
      update(id, o, cb) { calls.push({ api: "tabs.update", url: o.url }); tabs[id].go(o.url); setImmediate(cb); },
      create(o, cb) { calls.push({ api: "tabs.create", url: o.url }); setImmediate(() => cb({ id: 99 })); }
    },
    scripting: {
      executeScript(inj) {
        const page = tabs[inj.target.tabId];
        calls.push({ api: "executeScript", world: inj.world, frameIds: inj.target.frameIds, files: inj.files || null, func: inj.func ? inj.func.name : null, doc: page.doc.n });
        if (!page) return Promise.reject(new Error("No tab with id"));
        if (!page.ctx || page.ctx.document !== page.doc) {
          page.ctx = { document: page.doc, console };
          page.ctx.self = page.ctx;
          vm.createContext(page.ctx);
        }
        if (inj.files) {
          if (inj.files.indexOf("lib/nsp-hands.js") >= 0) page.ctx.NSP_HANDS = Object.freeze({ create: fakeHands(page) });
          return Promise.resolve([{ result: undefined }]);
        }
        const fn = vm.runInContext("(" + inj.func.toString() + ")", page.ctx);
        return Promise.resolve(fn.apply(null, inj.args || [])).then(result => [{ result }]);
      }
    }
  };
  const ctx = { chrome, console, crypto: webcrypto, URL, Promise, Uint8Array, setTimeout: (fn, ms) => setTimeout(fn, (Number(ms) || 0) / SCALE), clearTimeout };
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ["lib/nsp-sites.js", "background/nsp-page-agent.js"]) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  let stopped = false;
  let agentOn = opts.agentOn !== false;
  let nextRow = 1;
  const run = (tabId, convId = "c1") => ({
    convId, tabId,
    stopped: () => stopped,
    agentOn: () => agentOn,
    add(role, text, meta) { const row = { id: nextRow++, role, text, meta: Object.assign({}, meta) }; rows.push(row); return Promise.resolve(row); },
    patch(row, meta) { row.meta = Object.assign({}, meta); return Promise.resolve(); },
    typing() {},
    progress() {},
    lastReply: () => Promise.resolve("Last answer text"),
    ledger(e) { ledger.push(e); return Promise.resolve(e); }
  });
  return { A: ctx.NSP_PAGE_AGENT, calls, rows, ledger, local, granted, tabs, newPage, run, stop: v => { stopped = v; }, setAgent: v => { agentOn = v; } };
}

const SHOP = "http://shop.test:8765";
const shopSite = { "shop.test": { mode: "act", playbook: "web", since: 1 } };

check("the library cannot be replaced once loaded", Object.isFrozen(world().A));

{
  const w = world({ granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/product");
  const r = await w.A.run("zerackPage", { action: "click", target: 'the "Add to cart" button' }, w.run(5));
  check("with no consent for the site the step answers site_not_allowed", r.ok === false && r.code === "site_not_allowed" && r.host === "shop.test", r);
  check("and nothing ran on the page", !w.calls.some(c => c.api === "executeScript") && w.tabs[5].cart === 0, w.calls);
  const allow = w.rows.filter(x => x.role === "allow");
  check("the chat gets one Allow row for that host, with the Chrome pattern", allow.length === 1 && allow[0].meta.host === "shop.test" && allow[0].meta.pattern === "http://shop.test/*" && allow[0].meta.status === "waiting", allow);
  const again = await w.A.run("zerackPage", { action: "read" }, w.run(5));
  check("reading needs the consent too", again.code === "site_not_allowed" && !w.calls.some(c => c.api === "executeScript"), again);
}

{
  const w = world({ sites: shopSite });
  w.newPage(5, SHOP + "/product");
  const r = await w.A.run("zerackPage", { action: "read" }, w.run(5));
  check("consent without Chrome's own permission is not access", r.code === "site_not_allowed" && !w.calls.some(c => c.api === "executeScript"), r);
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"], agentOn: false });
  w.newPage(5, SHOP + "/product");
  const r = await w.A.run("zerackPage", { action: "read" }, w.run(5));
  check("with the Agent switch off nothing runs, even on an allowed site", r.code === "agent_off" && !w.calls.some(c => c.api === "executeScript"), r);
}

{
  const w = world({ sites: { "shop.test": { mode: "read", since: 1 } }, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/product");
  const read = await w.A.run("zerackPage", { action: "read" }, w.run(5));
  check("read-only consent reads", read.ok === true && read.pageData === true, read);
  const click = await w.A.run("zerackPage", { action: "click", target: '"Add to cart"' }, w.run(5));
  check("and refuses to act, with its own code", click.code === "read_only" && w.tabs[5].cart === 0, click);
  check("the Allow row then asks to work, not to read", w.rows.filter(x => x.role === "allow").map(x => x.meta.need).join() === "act");
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*", "https://www.youtube.com/*"] });
  w.newPage(5, "https://www.youtube.com/watch?v=x");
  w.newPage(6, "chrome://settings/");
  const yt = await w.A.run("zerackPage", { action: "read" }, w.run(5));
  check("a YouTube tab goes to the YouTube agent", yt.code === "youtube", yt);
  const cr = await w.A.run("zerackPage", { action: "read" }, w.run(6));
  check("a Chrome page is never scripted", cr.code === "not_scriptable", cr);
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/product");
  const r = await w.A.run("zerackPage", { action: "click", target: 'the "Add to cart" button' }, w.run(5));
  check("an allowed site with the switch on acts", r.ok === true && w.tabs[5].cart === 1, r);
  const inj = w.calls.filter(c => c.api === "executeScript");
  check("every injection is the isolated world of the top frame", inj.length > 0 && inj.every(c => c.world === "ISOLATED" && JSON.stringify(c.frameIds) === "[0]"), inj);
  check("the gate and the hands are injected as files, the gate first", inj.some(c => c.files && c.files.join() === "lib/nsp-gate.js,lib/nsp-hands.js"), inj.map(c => c.files));
  check("each step is its own injected call", inj.filter(c => c.func === "handsStep").length === 2, inj.map(c => c.func));
  const r2 = await w.A.run("zerackPage", { action: "click", target: 'the "Add to cart" button' }, w.run(5));
  check("the hands stay on the page between steps", r2.ok === true && w.calls.filter(c => c.files).length === 1, w.calls.filter(c => c.files).length);
  check("clicks that write nothing leave a ledger row with no fields", w.ledger.length === 2 && w.ledger[0].decision === "auto" && w.ledger[0].fields.length === 0 && w.ledger[0].host === "shop.test", w.ledger[0]);
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/admin/products/1");
  const r = await w.A.run("zerackPage", { action: "type", target: '"Title"', text: "Linen apron, olive" }, w.run(5));
  check("typing reports the field", r.ok === true && r.field === 'textbox "Title"', r);
  check("the hands were made to hold and to report before and after", r.hooksSeen && r.hooksSeen.hold === true && r.hooksSeen.ledger === true, r.hooksSeen);
  const e = w.ledger[w.ledger.length - 1];
  check("the ledger keeps before and after of the field", e && e.fields.length === 1 && e.fields[0].before === "" && e.fields[0].after === "Linen apron, olive" && e.action === "type", e);
  await w.A.run("zerackPage", { action: "type", target: '"Title"', text: "Linen apron, sage" }, w.run(5));
  const e2 = w.ledger[w.ledger.length - 1];
  check("a second write keeps what the first one left", e2.fields[0].before === "Linen apron, olive" && e2.fields[0].after === "Linen apron, sage", e2.fields);
  const card = await w.A.run("zerackPage", { action: "type", target: '"Card number"', text: "4242" }, w.run(5));
  check("a refused field is written to the ledger as refused", card.code === "sensitive" && w.ledger[w.ledger.length - 1].decision === "refused", w.ledger[w.ledger.length - 1]);
  const pasted = await w.A.run("zerackPage", { action: "paste", target: '"Notes"', textFrom: "last_reply" }, w.run(5));
  check("paste from the last reply takes the chat's last answer", pasted.ok === true && w.tabs[5].fields['"Notes"'] === "Last answer text" && pasted.source === "your last reply", pasted);
}

async function pressCase(how) {
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/checkout");
  const run = w.run(5);
  const out = w.A.run("zerackPage", { action: "click", target: 'the "Place your order" button' }, run);
  let row = null;
  for (let i = 0; i < 200 && !row; i++) { await wait(2); row = w.rows.find(x => x.role === "press"); }
  return { w, run, out, row };
}

{
  const { w, out, row } = await pressCase();
  check("a Pay step shows a waiting press row with its line, kind and deadline", row && row.meta.status === "waiting" && row.meta.kind === "Pay" && /Place your order/.test(row.text) && row.meta.until > Date.now() && /^[0-9a-f]{32}$/.test(row.meta.pressId), row);
  check("while it waits nothing was placed", w.tabs[5].placed === 0 && w.A.waiting("c1") === true);
  check("a wrong press id confirms nothing", w.A.confirm("c1", "0".repeat(32), true) === false && w.tabs[5].placed === 0);
  check("another conversation cannot confirm it", w.A.confirm("c2", row.meta.pressId, true) === false && w.tabs[5].placed === 0);
  check("the right id from the chat is taken", w.A.confirm("c1", row.meta.pressId, true) === true);
  const r = await out;
  check("after the press it runs once and says the user pressed", r.ok === true && r.confirmedByUser === true && w.tabs[5].placed === 1, r);
  check("the row ends as done", row.meta.status === "done" && row.meta.pressedAt > 0, row.meta);
  const e = w.ledger[w.ledger.length - 1];
  check("the ledger records who pressed", e.decision === "pressed" && e.pressed && e.pressed.by === "user" && e.kind === "Pay", e);
  check("a second confirm of the same press does nothing", w.A.confirm("c1", row.meta.pressId, true) === false && w.tabs[5].placed === 1);
}

{
  const { w, out, row } = await pressCase();
  w.A.confirm("c1", row.meta.pressId, false);
  const r = await out;
  check("Cancel declines: nothing placed, the hold released", r.code === "declined" && w.tabs[5].placed === 0 && w.tabs[5].released === 1, r);
  check("the row ends as declined and the ledger says so", row.meta.status === "declined" && w.ledger[w.ledger.length - 1].decision === "declined");
}

{
  const { w, out, row } = await pressCase();
  const r = await out;
  check("with no press before the deadline it gives up", r.code === "timeout" && w.tabs[5].placed === 0 && row.meta.status === "expired", r);
  check("the deadline is two minutes", w.A.pressMs === 120000);
}

{
  const { w, run, out, row } = await pressCase();
  w.stop(true);
  w.A.halt(run.convId, 5);
  const r = await out;
  check("Stop cancels a waiting press", r.code === "stopped" && w.tabs[5].placed === 0 && row.meta.status === "stopped", r);
  check("and tells the page to stop", w.calls.some(c => c.func === "handsStop"), w.calls.map(c => c.func));
  const next = await w.A.run("zerackPage", { action: "click", target: '"Add to cart"' }, run);
  check("after Stop no further step runs", next.code === "stopped" && w.tabs[5].cart === 0, next);
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/admin");
  const r = await w.A.run("zerackPage", { action: "click", target: 'the "Save and leave" button' }, w.run(5));
  check("a click whose answer is lost because the page left counts by where the tab went", r.ok === true && r.nowAt === SHOP + "/admin?saved=1" && w.ledger.length === 1 && w.ledger[0].urlAfter === SHOP + "/admin?saved=1", { r, ledger: w.ledger });
  const run = w.run(5);
  const out = w.A.run("zerackPage", { action: "click", target: 'the "Publish now" button' }, run);
  let row = null;
  for (let i = 0; i < 200 && !row; i++) { await wait(2); row = w.rows.find(x => x.role === "press"); }
  w.A.confirm("c1", row.meta.pressId, true);
  const p = await out;
  check("a pressed click whose answer is lost to the new page still reports done", p.ok === true && p.confirmedByUser === true && /published=1/.test(p.nowAt) && row.meta.status === "done", { p, meta: row.meta });
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/settings");
  const r = await w.A.run("zerackPage", { action: "click", target: 'the "Delete account" button' }, w.run(5));
  check("a refusal from the gate comes back as refused, with no press row", r.code === "refused" && !w.rows.some(x => x.role === "press"), r);
  check("and is in the ledger as refused", w.ledger[w.ledger.length - 1].decision === "refused");
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/wizard/one");
  const r = await w.A.run("zerackPagePlan", { steps: [{ action: "click", target: 'the "Next step" link' }, { action: "type", target: '"Notes"', text: "hello" }] }, w.run(5));
  check("a plan carries on after a step loads a new page", r.ok === true && r.ran === 2 && r.of === 2 && w.tabs[5].url === SHOP + "/wizard/two" && w.tabs[5].fields['"Notes"'] === "hello", r);
  check("the first step reports where the page went", r.steps[0].result.nowAt === SHOP + "/wizard/two", r.steps[0].result);
  const files = w.calls.filter(c => c.files);
  check("the hands are injected again on the new document", files.length === 2 && files[0].doc !== files[1].doc, files);
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  w.newPage(5, SHOP + "/product");
  const run = w.run(5);
  const steps = [{ action: "click", target: '"Add to cart"' }, { action: "click", target: '"Add to cart"' }, { action: "click", target: '"Add to cart"' }];
  let n = 0;
  run.progress = () => { if (++n === 2) w.stop(true); };
  const r = await w.A.run("zerackPagePlan", { steps }, run);
  check("Stop in the middle of a plan ends it at the next step", r.ok === false && r.code === "stopped" && w.tabs[5].cart === 1, r);
  w.stop(false);
  const bad = await w.A.run("zerackPagePlan", { steps: [{ action: "click", target: '"Nothing here"' }, { action: "click", target: '"Add to cart"' }] }, w.run(5));
  check("a plan stops at the first failed step", bad.ok === false && bad.code === "not_found" && bad.stoppedAt === 1 && bad.ran === 1 && w.tabs[5].cart === 1, bad);
  const big = await w.A.run("zerackPagePlan", { steps: Array.from({ length: 40 }, () => ({ action: "read" })) }, w.run(5));
  check("a plan runs at most 30 steps", big.ran === 30 && /first 30/.test(big.note || ""), big.ran);
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*", "http://other.test/*"] });
  w.newPage(5, SHOP + "/product");
  const r = await w.A.run("zerackPage", { action: "navigate", url: "http://other.test/admin" }, w.run(5));
  check("navigating to a site with no consent is refused before the tab moves", r.code === "site_not_allowed" && r.host === "other.test" && !w.calls.some(c => c.api === "tabs.update"), r);
  const ok = await w.A.run("zerackPage", { action: "navigate", url: "/cart" }, w.run(5));
  check("navigating inside the allowed site moves the tab", ok.ok === true && ok.nowAt === SHOP + "/cart" && w.calls.some(c => c.api === "tabs.update"), ok);
  const js = await w.A.run("zerackPage", { action: "navigate", url: "javascript:alert(1)" }, w.run(5));
  check("only http and https addresses are opened", js.ok === false && !w.calls.some(c => c.api === "tabs.update" && /javascript/.test(c.url)), js);
}

{
  const w = world({ sites: shopSite, granted: ["http://shop.test/*"] });
  const unknown = await w.A.run("zerackPage", { action: "delete" }, w.run(5));
  check("an unknown action is named in the error", unknown.ok === false && /unknown action "delete"/.test(unknown.error), unknown);
  check("step labels read as plain words", w.A.stepLabel({ action: "type", text: "Linen apron", target: '"Title"' }) === 'Type "Linen apron" into "Title"' && w.A.stepLabel({ action: "navigate", url: "http://shop.test/cart" }) === "Go to http://shop.test/cart");
}

done("page-agent");
