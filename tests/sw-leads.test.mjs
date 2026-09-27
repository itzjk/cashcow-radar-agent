// The lead tool in the worker: it judges what a Maps or Upwork read found, drafts one honest message, keeps the caps in the extension's own storage, and answers the page agent before any Send press on outreach.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadWorker, ROOT, check, done } from "./sw-harness.mjs";
import { makeIndexedDB, IDBKeyRange } from "./idb-lite.mjs";
import { windowFor } from "./dom-lite.mjs";

const page = n => readFileSync(join(ROOT, "tests/html", n), "utf8");
const plain = o => JSON.parse(JSON.stringify(o));
const call = (w, name, args, ctx) => new Promise(r => w.context.nspChatToolNow(name, args, ctx || {}, r));
const EX = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");
const MAPS = "https://www.google.com/maps/search/dentist+austin/@30.26,-97.74,13z";
const JOBS = "https://www.upwork.com/nx/search/jobs/?q=react";

async function readPage(file, url) {
  const win = windowFor(page(file), url);
  const ctx = { document: win.document, location: win.location, URL, console };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(EX, ctx);
  const r = plain(await ctx.NSP_EXTRACT.read("", {}));
  r.host = new URL(url).hostname;
  return r;
}

function worker(local) {
  const w = loadWorker({ local: Object.assign({ nsp_agent_enabled: true, nsp_agent_sites: {} }, local || {}) });
  w.context.indexedDB = makeIndexedDB();
  w.context.IDBKeyRange = IDBKeyRange;
  return w;
}

const SENDER = { name: "Ana Ruiz", business: "Ruiz Studio", address: "500 Main St, Austin, TX 78701", offer: "websites and review management for local businesses", skills: "React, TypeScript, Stripe", rate: 45, hoursFrom: 0, hoursTo: 24 };

{
  const w = worker();
  check("the worker loads the lead engine it calls", typeof w.context.NSP_LEADS.find === "function" && typeof w.context.nspLeads === "function");
  const bad = await call(w, "zerackLeads", { action: "blast" });
  check("an unknown action is refused with the list of actions", bad.ok === false && bad.code === "bad_action" && /find, draft, status, mark or policy/.test(bad.error), bad);
  const none = await call(w, "zerackLeads", { action: "find" });
  check("find with nothing read asks for a Maps or Upwork read, it never invents leads", none.ok === false && none.code === "missing" && /Google Maps search/.test(none.error), none);
  const st = await call(w, "zerackLeads", { action: "status" });
  check("status on a fresh install: 0 of 5 today, and the ramp", st.ok && st.status.cap === 5 && st.status.sent === 0 && /0 of 5 sent today, 5 left/.test(st.line) && /grows by 5 a day up to 30/.test(st.line), st.line);
  check("its card has no page markup, only numbers and names", st.card && st.card.kind === "status" && st.card.status.cap === 5);
}

{
  const w = worker();
  const pol = await call(w, "zerackLeads", Object.assign({ action: "policy", max: 999 }, SENDER));
  check("policy saves the sender details and clamps the cap to its ceiling", pol.ok && pol.policy.name === "Ana Ruiz" && pol.policy.max === 50 && pol.refused.some(r => /ceiling for max is 50/.test(r.why)) && pol.missing.length === 0, pol);
  check("the policy lives in the extension's own storage, not in any page", w.local.nsp_leads && w.local.nsp_leads.policy.address === "500 Main St, Austin, TX 78701" && w.local.nsp_leads.policy.hours.join() === "0,24");
  check("the card shows the address only as saved", pol.card.policy.address === "saved" && !JSON.stringify(pol.card).includes("500 Main St"));

  const read = await w.context.nspBusinessRead(await readPage("maps-results.html", MAPS));
  check("a Maps read carries the verdicts for the saved offer in its line", /For your offer: 3 Pitch, 1 Look at it, 2 Skip\./.test(read.line), read.line);
  const found = await call(w, "zerackLeads", { action: "find" });
  check("find judges the places of that read, pitches first", found.ok && found.kind === "place" && found.leads.length === 7 && found.leads[0].verdict === "pitch" && /7 places judged: 3 Pitch, 1 Look at it, 3 Skip\. 5 of 5 sends left today\./.test(found.line), found.line);
  const cedar = found.leads.find(l => l.name === "Cedar Park Smiles");
  check("each lead carries its reason, its facts and how to reach it", cedar.route === "form" && cedar.website === "https://www.cedarparksmiles.test/" && cedar.reasons.join() === "Rated 3.6 from 14 reviews,Only 14 reviews" && cedar.facts[0] === "3.6 stars from 14 reviews", cedar);
  check("the find card lists the leads for the chat", found.card.kind === "leads" && found.card.leads.length === 7 && found.card.status.cap === 5);

  const d = await call(w, "zerackLeads", { action: "draft", lead: "Cedar Park Smiles" });
  check("draft by name writes the contact form note, every check passing, sendable now", d.ok && d.channel === "form" && d.checks.every(c => c.ok) && d.sendable === true && d.route === "https://www.cedarparksmiles.test/" && /It can go out now, send 1 of 5 today, after your press\./.test(d.line) && new RegExp("passing lead " + d.lead + " on every step").test(d.howToSend) && !/zerack/i.test(d.line), [d.line, d.howToSend]);
  check("the draft is stored with the lead, so the page agent can recognise it", w.local.nsp_leads.leads[d.lead].draft.body === d.body && w.local.nsp_leads.leads[d.lead].status === "found");
  check("the draft card carries the body, the checks and the cap", d.card.kind === "draft" && d.card.body === d.body && d.card.checks.length === 6 && d.card.status.left === 5 && d.card.blocked === "");

  const q = { host: "www.cedarparksmiles.test", path: "/contact", url: "https://www.cedarparksmiles.test/contact" };
  const plainSend = await w.context.nspLeadsGate(Object.assign({}, q, { typed: [{ text: "Hello, is the office open on Saturday?" }] }));
  check("a Send on an ordinary site with no draft typed is not a lead send", plainSend.ok === true && !plainSend.lead, plainSend);
  const typed = [{ text: "Ana Ruiz" }, { text: "ana@ruiz.test" }, { text: d.body }];
  const byText = await w.context.nspLeadsGate(Object.assign({}, q, { typed }));
  check("typing the draft makes the Send a lead send, inside the cap", byText.ok === true && byText.lead.id === d.lead && /Cedar Park Smiles: send 1 of 5 today/.test(byText.line), byText);
  const stripped = await w.context.nspLeadsGate(Object.assign({}, q, { lead: d.lead, typed: [{ text: d.body.replace(/If you would rather not hear from me.*$/m, "") }] }));
  check("a typed message that lost the opt-out line is refused", stripped.ok === false && stripped.code === "draft_changed" && /opt-out line/.test(stripped.why), stripped);
  const unknown = await w.context.nspLeadsGate(Object.assign({}, q, { lead: "Lnope" }));
  check("a lead id that was never drafted is refused", unknown.ok === false && unknown.code === "no_lead", unknown);
  const gmail = await w.context.nspLeadsGate({ host: "mail.google.com", path: "/mail/u/0/", typed: [{ text: "hi" }] });
  check("a Send in Gmail with no drafted lead is refused as outreach", gmail.ok === false && gmail.code === "lead_needed" && /a Gmail message/.test(gmail.why), gmail);

  await w.context.nspLeadsSent(d.lead, { host: "www.cedarparksmiles.test" });
  const again = await w.context.nspLeadsGate(Object.assign({}, q, { lead: d.lead, typed }));
  check("after the press, the same place is refused forever", again.ok === false && again.code === "repeat", again);
  const after = await call(w, "zerackLeads", { action: "status" });
  check("the send counts toward today's cap and starts the ramp", after.status.sent === 1 && after.status.left === 4 && w.local.nsp_leads.first === w.context.NSP_LEADS.dayOf(Date.now()), after.status);
  const refound = await call(w, "zerackLeads", { action: "find" });
  check("find marks the contacted place and sinks it to the bottom", refound.leads[refound.leads.length - 1].name === "Cedar Park Smiles" && refound.leads[refound.leads.length - 1].contacted === "repeat" && /1 already contacted/.test(refound.line), refound.line);

  const mark = await call(w, "zerackLeads", { action: "mark", lead: "Brightway Dental Care", outcome: "opted out" });
  check("mark records what the user reports; an opt-out is never written to again", mark.ok && mark.outcome === "opted_out" && /never writes to them again/.test(mark.line) && w.local.nsp_leads.never.length >= 1, mark);
  const badMark = await call(w, "zerackLeads", { action: "mark", lead: "Brightway Dental Care", outcome: "ignored" });
  check("an unknown outcome is refused", badMark.ok === false && badMark.code === "bad_outcome");
  const call1 = await call(w, "zerackLeads", { action: "draft", lead: "Oakridge Family Dental" });
  check("a place with only a phone gets a call script, never a send", call1.ok && call1.channel === "call" && call1.sendable === false && /Calls are yours to make/.test(call1.line) && call1.card.script === true, call1.line);
}

{
  const w = worker();
  await call(w, "zerackLeads", Object.assign({ action: "policy" }, SENDER));
  await w.context.nspBusinessRead(await readPage("upwork-jobs.html", JOBS));
  const found = await call(w, "zerackLeads", { action: "find" });
  check("an Upwork read is judged as jobs: Bid, Look at it and Skip for the saved skills", found.ok && found.kind === "job" && /7 jobs judged: 2 Bid, 1 Look at it, 4 Skip/.test(found.line), found.line);
  check("a job lead carries the bid that keeps the user's rate", found.leads[0].price.bid === 45 || found.leads[0].price.bid === 50, found.leads[0].price);
  const apply = await readPage("upwork-apply.html", "https://www.upwork.com/ab/proposals/job/~021900000000000001/apply/");
  await w.context.nspBusinessRead(apply);
  const d = await call(w, "zerackLeads", { action: "draft", lead: "React developer for analytics dashboard (TypeScript, charts)" });
  check("the proposal form read adds the Connects to the same lead, and the draft says so", d.ok && d.channel === "proposal" && d.connects.needed === 16 && d.connects.cost === 2.4 && d.card.connects === 16, d.connects);
  check("the proposal draft is sendable only through the press, with its lead id", d.sendable === true && /after your press/.test(d.line) && /the user presses Send in the chat/.test(d.howToSend) && d.howToSend.includes(d.lead));
  const q = { host: "www.upwork.com", path: "/ab/proposals/job/~021900000000000001/apply/" };
  const noLead = await w.context.nspLeadsGate(Object.assign({}, q, { typed: [{ text: "Hi, I can do this." }] }));
  check("a proposal typed by hand, not the checked draft, is refused on the proposal form, with a reason for the user and a hint for the model", noLead.ok === false && noLead.code === "lead_needed" && /an Upwork proposal, and only a message ZERACK drafted and checked goes out here/.test(noLead.why) && !/zerackLeads/.test(noLead.why) && /zerackLeads/.test(noLead.hint), noLead);
  const ok = await w.context.nspLeadsGate(Object.assign({}, q, { lead: d.lead, typed: [{ text: "45" }, { text: d.body }] }));
  check("the checked draft with its lead id may be sent", ok.ok === true && ok.lead.id === d.lead, ok);
}

{
  const w = worker();
  await call(w, "zerackLeads", Object.assign({ action: "policy" }, SENDER, { hoursFrom: 8, hoursTo: 21 }));
  await w.context.nspBusinessRead(await readPage("maps-results.html", MAPS));
  await call(w, "zerackLeads", { action: "find" });
  const L = w.context.NSP_LEADS;
  const d = await call(w, "zerackLeads", { action: "draft", lead: "Cedar Park Smiles" });
  const h = new Date().getHours();
  check("outside sending hours the draft says it is held and why", h >= 8 && h < 21 ? d.sendable === true : (d.sendable === false && d.blocked.code === "hours" && /sending runs from 8:00 to 21:00/i.test(d.card.blocked)), [h, d.blocked]);
  const st = L.load(w.local.nsp_leads);
  const today = L.dayOf(Date.now());
  for (let i = 0; i < 5; i++) st.log.push({ id: "Lx" + i, event: "sent", at: Date.now(), day: today });
  st.policy = L.setPolicy(st.policy, { hours: [0, 24] }).policy;
  w.local.nsp_leads = st;
  const capped = await w.context.nspLeadsGate({ host: "www.cedarparksmiles.test", path: "/contact", lead: d.lead, typed: [{ text: d.body }] });
  check("the sixth send of the first day is refused by the cap", capped.ok === false && capped.code === "cap" && /cap of 5 is used up/.test(capped.why), capped);
}

{
  const w = worker();
  const code = readFileSync(join(ROOT, "background/service-worker.js"), "utf8");
  check("the lead tool is not a message type: nothing outside the worker can call it", !/NSP_LEADS_[A-Z]+\s*:/.test(code.slice(code.indexOf("var NSP_MESSAGE_CALLERS"), code.indexOf("var NSP_SELF_SENDER"))));
  check("zerackLeads runs only as a chat tool and its card goes to the chat", /name === 'zerackLeads'\) \{ lib\(nspLeads\(args, ctx\)\)/.test(code) && /meta\.leads = result\.card/.test(code));
  check("the page agent's chat context carries the lead gate and the sent hook", /leads: nspLeadsGate,\s*leadSent: nspLeadsSent/.test(code));
  const waited = await w.context.nspPaceWait("www.upwork.com");
  check("reads on a site whose terms limit automation are spaced at human pace: the next read waits 12 s", waited === 0 && w.context._nspPace["www.upwork.com"] > 0 && w.context.NSP_PACE_MS === 12000);
  check("sites with no such terms are not slowed", (await w.context.nspPaceWait("github.com")) === 0 && !w.context._nspPace["github.com"]);
}

done("sw-leads");
