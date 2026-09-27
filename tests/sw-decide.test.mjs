// The worker decides and remembers: stored decisions, the alarm re-measure, firm lessons for the brain and the evidence a spend press needs.
import { loadWorker, SENDERS, check, done, EXT } from "./sw-harness.mjs";
import { makeIndexedDB, IDBKeyRange } from "./idb-lite.mjs";

const H = 3600000, DAY = 86400000;
const call = (w, name, args, ctx) => new Promise(r => w.context.nspChatToolNow(name, args, ctx, r));
const GSC = "https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Anorthwind";
const site = { host: "search.google.com", url: GSC };
const ctx = { site, playbook: "seo", convId: "c_1" };

function worker() {
  const w = loadWorker({ local: { nsp_agent_enabled: true } });
  w.context.indexedDB = makeIndexedDB();
  w.context.IDBKeyRange = IDBKeyRange;
  const alarms = [];
  w.context.chrome.alarms = {
    create: (name, info, cb) => { alarms.push({ op: "create", name, when: info.when }); if (cb) setImmediate(cb); },
    clear: (name, cb) => { alarms.push({ op: "clear", name }); if (cb) setImmediate(() => cb(true)); },
    onAlarm: { addListener() {} }
  };
  return { w, S: w.context.NSP_CHAT_STORE, alarms };
}

function gscSnap(at, per) {
  const clicks = Object.values(per).reduce((s, x) => s + x.clicks, 0);
  const impressions = Object.values(per).reduce((s, x) => s + x.impressions, 0);
  return { at, key: "gsc.queries|https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Anorthwind", host: "search.google.com", reader: "gsc.queries", playbook: "seo", metrics: { clicks, impressions }, ids: [], per };
}

{
  const { w } = worker();
  check("the worker loads the decision engine and the verdict words it answers with", typeof w.context.NSP_DECIDE.ab === "function" && w.context.NSP_VEREDICTO.etiqueta("SIRVE") === "KEEP" && w.context.nspDecideReady() === true);
  for (const who of ["site", "youtube", "popup"]) {
    const res = await w.send({ type: "NSP_DECIDE_NOW", id: 1 }, SENDERS[who]);
    check("Measure now from " + who + " is refused", res && /not_allowed/.test(String(res.error)), res);
  }
  const chat = await w.send({ type: "NSP_DECIDE_NOW", id: 1 }, { id: SENDERS.popup.id, url: EXT + "chat/chat.html?mode=panel" });
  check("even the chat page cannot press Measure now: only the activity page can", chat && chat.error === "not_allowed", chat);
  const framed = await w.send({ type: "NSP_DECIDE_NOW", id: 1 }, { id: SENDERS.popup.id, url: EXT + "activity/activity.html", tab: { id: 4 }, frameId: 2 });
  check("the activity page inside a frame is refused", framed && framed.error === "not_allowed", framed);
  const page = await w.send({ type: "NSP_DECIDE_NOW", id: 99 }, { id: SENDERS.popup.id, url: EXT + "activity/activity.html#decisions", tab: { id: 4 }, frameId: 0 });
  check("the activity page reaches it, and a missing decision says so", page && page.ok === false && page.error === "that decision is gone", page);
}

{
  const { w, S, alarms } = worker();
  const now = Date.now();
  const look = await call(w, "zerackDecide", { question: "Which title for the linen apron page?", kind: "ab", control: "Linen apron", arms: [{ name: "Linen apron", impressions: 120, clicks: 6 }, { name: "Linen apron, olive, 2026", impressions: 130, clicks: 9 }] }, ctx);
  check("an A/B with numbers typed in the chat answers LOOK AT IT with what is missing", look.ok && look.id === 1 && look.state === "look" && look.label === "LOOK AT IT" && look.from === "chat" && look.missing.length === 4 && look.missing[0] === "70 more impressions on it (130 now, 200 needed)", look);
  check("and books the re-measure in 7 days, keeping the lesson only if it agrees", look.status === "open" && look.dueAt >= now + 7 * DAY - 5000 && look.dueAt <= Date.now() + 7 * DAY && /kept only if the re-measure on \d{4}-\d{2}-\d{2} agrees/.test(look.note), look);
  const card = w.context.nspDecideCard(look);
  check("the chat card carries the state, the number, what is missing and the due date", card.state === "look" && card.number === look.number && card.missing.length === 4 && /^\d{4}-\d{2}-\d{2}$/.test(card.due) && card.lesson.length > 0, card);
  const stored = await S.listDecisions({});
  const d = stored[0];
  check("the decision is stored with its question, numbers, claim and a tentative lesson", stored.length === 1 && d.host === "search.google.com" && d.playbook === "seo" && d.claim.state === "keep" && d.claim.winner === "Linen apron, olive, 2026" && d.lesson.state === "tentative" && d.input.arms.length === 2 && d.measures.length === 1 && d.source === null, d);
  check("the alarm is set for the decision's due time", alarms.some(a => a.op === "create" && a.name === "nsp-decide" && a.when === d.dueAt), alarms);

  const same = await call(w, "zerackDecide", { question: "Which title for the linen apron page?", kind: "ab", control: "Linen apron", arms: [{ name: "Linen apron", impressions: 120, clicks: 6 }, { name: "Linen apron, olive, 2026", impressions: 130, clicks: 9 }] }, ctx);
  const d1 = (await S.listDecisions({}))[0];
  check("asking again with the same numbers is the same decision and judges nothing new", same.id === 1 && (await S.listDecisions({})).length === 1 && d1.measures.length === 2 && /nothing new to judge/.test(d1.measures[1].why) && d1.lesson.state === "tentative", d1.measures);
  const more = await call(w, "zerackDecide", { question: "Which title for the linen apron page?", kind: "ab", control: "Linen apron", arms: [{ name: "Linen apron", impressions: 3000, clicks: 60 }, { name: "Linen apron, olive, 2026", impressions: 3100, clicks: 124 }] }, ctx);
  const d2 = (await S.listDecisions({}))[0];
  check("fresh numbers that settle it make the lesson firm at once", more.id === 1 && more.state === "keep" && d2.status === "kept" && d2.lesson.state === "firm" && d2.lesson.at > 0 && d2.dueAt > Date.now() + 29 * DAY, { status: d2.status, lesson: d2.lesson });
  const memory = await w.context.nspDecideMemory("search.google.com", "seo");
  check("a firm lesson comes back for the brain, with its evidence", memory.length === 1 && /"Linen apron, olive, 2026" beats "Linen apron"/.test(memory[0].text) && /leads: over 99\.9% chance/.test(memory[0].evidence), memory);
  const other = await w.context.nspDecideMemory("www.etsy.com", "etsy");
  check("another business gets none of it", other.length === 0, other);
  const ev = await w.context.nspDecideEvidence("search.google.com");
  check("the settled test is the evidence a spend press asks for", ev.ok === true && ev.decision === 1 && /Which title for the linen apron page\?: "Linen apron, olive, 2026" leads/.test(ev.line), ev);
  const none = await w.context.nspDecideEvidence("shop.example");
  check("a site with no test has none, and says what is missing", none.ok === false && /^a measured A\/B test on shop\.example/.test(none.missing[0]), none);
  const bad = await call(w, "zerackDecide", { question: "q", kind: "ab", arms: [{ name: "A" }, { name: "B", impressions: 10, clicks: 1 }] }, ctx);
  check("an option with no numbers and no row on the page is refused, not read as zero", bad.ok === false && /no numbers for "A"/.test(bad.error), bad);
  const kind = await call(w, "zerackDecide", { question: "q", kind: "guess" }, ctx);
  check("an unknown kind is refused", kind.ok === false && kind.code === "bad_kind");
}

{
  const { w, S } = worker();
  const t0 = Date.now() - 2 * DAY;
  await S.addSeries(gscSnap(t0, { "linen apron": { position: 6.1, clicks: 5, impressions: 140 }, "olive linen apron": { position: 7.2, clicks: 9, impressions: 150 } }));
  const r = await call(w, "zerackDecide", { question: "Does the new olive page title beat the old one?", kind: "ab", control: "linen apron", arms: [{ name: "Linen Apron", impressions: 9999, clicks: 9999 }, { name: "olive linen apron", impressions: 1, clicks: 1 }] }, ctx);
  const d = (await S.listDecisions({}))[0];
  check("options named like rows of the last read take the page's numbers, not the model's", r.ok && r.from === "page" && d.input.arms[0].impressions === 140 && d.input.arms[1].clicks === 9 && d.input.arms.every(a => a.from === "page"), d.input.arms);
  check("a Search Console table under 200 impressions says keep testing", r.state === "look" && r.missing.some(m => /^\d+ more impressions on it \(150 now, 200 needed\)$/.test(m)) && /^"olive linen apron" leads/.test(r.number), { missing: r.missing, number: r.number });
  check("the decision remembers which page and rows to read again", d.source && d.source.reader === "gsc.queries" && d.source.url === GSC && d.source.rows.join() === "linen apron,olive linen apron", d.source);

  await S.putDecision(Object.assign(d, { dueAt: Date.now() - 1000 }));
  await w.context.nspDecideTick();
  const waiting = (await S.listDecisions({}))[0];
  check("due with no new reading of the page: it waits, says what it needs, and tries again in 6 hours", waiting.status === "open" && waiting.tries === 0 && /no new reading of the page: open https:\/\/search\.google\.com/.test(waiting.waiting) && waiting.dueAt > Date.now() + 5 * H, { status: waiting.status, waiting: waiting.waiting });

  await S.putDecision(Object.assign(waiting, { dueAt: Date.now() - 1000 }));
  await S.addSeries(gscSnap(Date.now(), { "linen apron": { position: 6.0, clicks: 60, impressions: 3000 }, "olive linen apron": { position: 6.8, clicks: 124, impressions: 3100 } }));
  await w.context.nspDecideTick();
  const kept = (await S.listDecisions({}))[0];
  const last = kept.measures[kept.measures.length - 1];
  check("the alarm re-measures from the newer reading and keeps the lesson when it agrees", kept.status === "kept" && kept.lesson.state === "firm" && kept.result.state === "keep" && last.by === "alarm" && /holds/.test(last.why), { status: kept.status, lesson: kept.lesson.state, last });
  check("a kept lesson is checked again in 30 days", kept.dueAt > Date.now() + 29 * DAY);
  check("the re-measured options still say their numbers came from the page", kept.result.arms.length === 2 && kept.result.arms.every(a => a.from === "page") && kept.input.arms.every(a => a.from === "page"), kept.result.arms);
}

{
  const { w, S } = worker();
  await S.addSeries(gscSnap(Date.now() - DAY, { "linen apron": { position: 6.1, clicks: 5, impressions: 140 }, "olive linen apron": { position: 7.2, clicks: 9, impressions: 150 } }));
  await call(w, "zerackDecide", { question: "Olive title?", kind: "ab", control: "linen apron", arms: [{ name: "linen apron" }, { name: "olive linen apron" }] }, ctx);
  const d = (await S.listDecisions({}))[0];
  await S.putDecision(Object.assign(d, { dueAt: Date.now() - 1000 }));
  const flipped = gscSnap(Date.now(), { "linen apron": { position: 6.0, clicks: 124, impressions: 3000 }, "olive linen apron": { position: 6.8, clicks: 60, impressions: 3100 } });
  await S.addSeries(flipped);
  w.context.nspDecideAfterRead(flipped);
  let gone = null;
  for (let i = 0; i < 100; i++) { await new Promise(r => setTimeout(r, 5)); gone = (await S.listDecisions({}))[0]; if (gone.status !== "open") break; }
  check("a page read of a due decision re-measures it at once, and a lesson measured false is deleted", gone.status === "dropped" && gone.lesson.state === "deleted" && gone.measures[gone.measures.length - 1].by === "read" && /did not hold/.test(gone.lesson.why), { status: gone.status, waiting: gone.waiting, measures: gone.measures, due: gone.dueAt - Date.now() });
  const memory = await w.context.nspDecideMemory("search.google.com", "seo");
  check("and it never reaches the brain", memory.length === 0, memory);
}

{
  const { w, S } = worker();
  const base = Date.now() - 50 * H;
  for (const [i, v] of [1000, 1200, 1440, 1730, 5200].entries()) await S.addSeries({ at: base + i * 10 * H, key: "etsy.shop|https://www.etsy.com/shop/rival", host: "www.etsy.com", reader: "etsy.shop", playbook: "etsy", metrics: { sales: v, count: 30 }, ids: [], per: {} });
  const ectx = { site: { host: "www.etsy.com", url: "https://www.etsy.com/shop/rival?ref=x" }, playbook: "etsy", convId: "c_2" };
  const t = await call(w, "zerackDecide", { question: "Is this rival shop taking off?", kind: "trend", metric: "sales" }, ectx);
  check("a trend on a stored number of this page answers from the series store", t.ok && t.state === "keep" && /^rival|sales at 5,200 \(was 1,730\)/.test(t.number) && t.from === "page", t);
  const wrong = await call(w, "zerackDecide", { question: "q", kind: "trend", metric: "revenue" }, ectx);
  check("a metric the page never had is refused with the ones it has", wrong.ok === false && /sales, count|count, sales/.test(wrong.error), wrong);
  const win = await call(w, "zerackDecide", { question: "Still rising?", kind: "window", metric: "sales" }, ectx);
  check("a window needs six readings and says so", win.ok && win.state === "look" && /1 more reading/.test(win.missing[0]), win);
  const share = await call(w, "zerackDecide", { question: "Do my replies land?", kind: "share", name: "replies that got an answer", successes: 4, total: 5, bar: 0.3 }, ectx);
  check("a rate against a bar answers with its worst case", share.ok && share.state === "keep" && /at worst 37\.6%/.test(share.number), share);
}

{
  const { w, S } = worker();
  const d = await S.addDecision({ host: "a.example", kind: "ab", question: "q", status: "open", dueAt: Date.now() + 3 * H, result: { ok: true, state: "look" } });
  await S.addDecision({ host: "a.example", kind: "ab", question: "q2", status: "open", dueAt: Date.now() + 1 * H, result: { ok: true, state: "look" } });
  await S.addDecision({ host: "a.example", kind: "ab", question: "q3", status: "dropped", dueAt: Date.now() + 60000, result: { ok: true, state: "look" } });
  const alarms = [];
  w.context.chrome.alarms = { create: (n, i, cb) => { alarms.push({ n, when: i.when }); cb && cb(); }, clear: (n, cb) => { alarms.push({ n, clear: true }); cb && cb(); } };
  await w.context.nspDecideSchedule();
  check("one alarm, set for the earliest open decision, and a dropped one does not count", alarms.length === 1 && alarms[0].n === "nsp-decide" && Math.abs(alarms[0].when - (Date.now() + H)) < 5000, alarms);
  const row = await S.getDecision(d.id);
  check("the store keeps decisions in shape: a bad state reads as look and the status as given", row.result.state === "look" && row.status === "open" && row.lesson.state === "tentative");
  await S.putDecision(Object.assign(row, { status: "nonsense" }));
  check("a status the store does not know is read as open", (await S.getDecision(d.id)).status === "open");
  await S.addLedger({ host: "a.example", action: "click", decision: "pressed", result: "done", kind: "Pay", evidence: { decision: 7, line: "q: \"B\" leads" } });
  const led = await S.listLedger({ host: "a.example" });
  check("a ledger row keeps the evidence of a spend", led.length === 1 && led[0].evidence.decision === 7 && /B/.test(led[0].evidence.line), led);
  await S.clearAll();
  check("deleting everything also deletes decisions", (await S.listDecisions({})).length === 0);
}

{
  const { w, S } = worker();
  await call(w, "zerackDecide", { question: "Subject line A or B?", kind: "ab", arms: [{ name: "A", impressions: 150, clicks: 20 }, { name: "B", impressions: 160, clicks: 31 }] }, ctx);
  for (let i = 1; i <= 3; i++) {
    const d = (await S.listDecisions({}))[0];
    await S.putDecision(Object.assign(d, { dueAt: Date.now() - 1000 }));
    await w.context.nspDecideTick();
    const after = (await S.listDecisions({}))[0];
    if (i < 3) check("numbers typed in the chat cannot be read again: check " + i + " asks the user for fresh ones", after.status === "open" && after.tries === i && /^new numbers from you/.test(after.waiting), { status: after.status, tries: after.tries, waiting: after.waiting });
    else check("and after three checks with nothing new it expires and keeps no lesson", after.status === "expired" && after.lesson.state === "deleted" && after.dueAt === 0 && /no new numbers came in 3 checks/.test(after.lesson.why), { status: after.status, lesson: after.lesson });
  }
}

done("sw-decide");
