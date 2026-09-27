// The lead engine: caps shaped like ZerackCorreo's politica.json, a judge that says who to pitch or bid on and why, drafts that carry one true fact, the AI disclosure and the opt-out line, and the rules a send must pass.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done, htmlPage } from "./sw-harness.mjs";
import { load } from "./engines.mjs";
import { windowFor } from "./dom-lite.mjs";

const C = load(["lib/nsp-leads.js"], { URL });
const L = C.NSP_LEADS;
const EX = readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8");
const page = n => htmlPage(n);
const plain = o => JSON.parse(JSON.stringify(o));
async function rows(file, url) {
  const w = windowFor(page(file), url);
  const ctx = { document: w.document, location: w.location, URL, console };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(EX, ctx);
  return plain(await ctx.NSP_EXTRACT.read("", {}));
}
const at = (y, m, d, h) => new Date(y, m - 1, d, h, 0, 0).getTime();
const NOON = at(2026, 9, 27, 12);

check("the library cannot be replaced once loaded", Object.isFrozen(L));

{
  const p = L.policy(null);
  check("the default policy starts at 5 a day, adds 5 a day up to 30, sends 8:00 to 21:00 and stops at 3 bounces", p.on === true && p.start === 5 && p.step === 5 && p.max === 30 && p.hours.join() === "8,21" && p.bounces === 3, p);
  const r = L.setPolicy(p, { max: 500, start: 99, step: 40, bounces: 0, name: "Ana Ruiz", email: "not an email", hours: [22, 6] });
  check("caps have hard ceilings the model cannot pass", r.policy.max === 50 && r.policy.start === 20 && r.policy.step === 10 && r.policy.bounces === 1, r.policy);
  check("each clamp is reported", r.refused.length === 4 && r.refused.every(x => /ceiling|floor/.test(x.why)), r.refused);
  check("a bad email is dropped and a backwards schedule falls back to 8 to 21", r.policy.email === "" && r.policy.hours.join() === "8,21");
  check("only the fields that changed are named", r.changed.indexOf("name") >= 0 && r.changed.indexOf("email") < 0, r.changed);
  check("unknown fields are ignored", !("evil" in L.setPolicy(p, { evil: 1 }).policy));
  check("the cap ramps from the first send: 5, then 10 two... up to the ceiling", L.capToday(p, "", NOON) === 5 && L.capToday(p, "2026-09-26", NOON) === 10 && L.capToday(p, "2026-09-20", NOON) === 30 && L.capToday(p, "2026-09-01", NOON) === 30);
}

const POL = L.setPolicy(null, { name: "Ana Ruiz", business: "Ruiz Studio", address: "500 Main St, Austin, TX 78701", offer: "websites and review management for local businesses", skills: "React, TypeScript, Stripe", rate: 45 }).policy;

const maps = await rows("maps-results.html", "https://www.google.com/maps/search/dentist+austin/@30.26,-97.74,13z");
{
  const st = L.load(null);
  st.policy = POL;
  const found = L.find(st, maps.rows, "place", POL, "maps.results", NOON);
  const by = n => found.find(l => l.name === n);
  check("the judge reads all seven places", found.length === 7, found.map(l => l.name));
  check("a place with no website on its listing is a pitch for a website seller, reached by phone", by("Oakridge Family Dental").verdict === "pitch" && by("Oakridge Family Dental").route.kind === "call" && /No website/.test(by("Oakridge Family Dental").reasons[0].text), by("Oakridge Family Dental"));
  check("a low rating from few reviews with a website is a pitch through its contact form", by("Cedar Park Smiles").verdict === "pitch" && by("Cedar Park Smiles").route.kind === "form" && by("Cedar Park Smiles").route.url === "https://www.cedarparksmiles.test/", by("Cedar Park Smiles").reasons.map(r => r.text));
  check("a strong complete listing is Skip, with nothing to say as the reason", by("Mueller Dental Group").verdict === "skip" && by("Mueller Dental Group").nothing === true && /^Nothing to say/.test(by("Mueller Dental Group").reasons[0].text));
  check("a permanently closed place is skipped", by("Eastside Tooth Co.").verdict === "skip" && /closed/.test(by("Eastside Tooth Co.").reasons[0].text));
  check("pitches come first", found[0].verdict === "pitch" && found[found.length - 1].verdict === "skip");
  check("finding the same place twice keeps one lead", L.find(st, maps.rows, "place", POL, "maps.results", NOON).length === 7 && Object.keys(st.leads).length === 7);
  const webOnly = L.find(L.load(null), maps.rows, "place", L.setPolicy(POL, { offer: "websites for local businesses" }).policy, "maps.results", NOON);
  check("the offer changes the judge: selling only websites, the low-rated place with a site has nothing to pitch", webOnly.find(l => l.name === "Cedar Park Smiles").verdict === "skip" && webOnly.find(l => l.name === "Oakridge Family Dental").verdict === "pitch");
  const place = await rows("maps-place.html", "https://www.google.com/maps/place/Oakridge+Family+Dental/@30.2,-97.7,17z");
  const again = L.find(st, [{ name: place.place.name, rating: place.place.rating, reviews: place.place.reviews, address: place.place.address, phone: place.place.phone, hasWebsite: place.place.hasWebsite, url: place.place.url }], "place", POL, "maps.place", NOON);
  check("the place page is the same lead as its row in the results", again[0].id === by("Oakridge Family Dental").id, [again[0].id, by("Oakridge Family Dental").id]);
}

const jobs = await rows("upwork-jobs.html", "https://www.upwork.com/nx/search/jobs/?q=react");
{
  const st = L.load(null);
  const found = L.find(st, jobs.rows, "job", POL, "upwork.jobs", NOON);
  const by = s => found.find(l => l.name.startsWith(s));
  check("verified jobs with few proposals that match the skills are Bid", by("React developer").verdict === "bid" && by("Senior React").verdict === "bid", found.map(l => l.verdict + " " + l.name));
  check("payment not verified is Skip", by("Build a Next.js").verdict === "skip" && /not verified/.test(by("Build a Next.js").reasons[0].text));
  check("50 or more proposals is Skip", by("Logo for").verdict === "skip" && /50 or more/.test(by("Logo for").reasons[0].text));
  check("older than three days is Skip", by("React Native").verdict === "skip" && /days ago/.test(by("React Native").reasons[0].text));
  check("none of the skills is Skip", by("Fix bugs").verdict === "skip" && /None of your skills/.test(by("Fix bugs").reasons[0].text));
  check("a new client with no spend is Look at it", by("Help us add Stripe").verdict === "look" && /New client/.test(by("Help us add Stripe").reasons[0].text));
  check("the bid keeps the user's rate inside the client's range", by("React developer").price.bid === 45 && by("Senior React").price.bid === 50 && by("React developer").price.keepLow === 38.25, [by("React developer").price, by("Senior React").price]);
  check("the job listing and its proposal form are one lead", L.keysOf({ url: "https://www.upwork.com/jobs/React-dev_~021900000000000001/" })[0] === L.keysOf({ url: "https://www.upwork.com/ab/proposals/job/~021900000000000001/apply/" })[0]);
}

{
  const st = L.load(null);
  st.policy = POL;
  const found = L.find(st, maps.rows, "place", POL, "maps.results", NOON);
  const cedar = found.find(l => l.name === "Cedar Park Smiles");
  const d = L.compose(cedar, POL, {});
  check("a contact form draft for the pitched place", d.ok && d.channel === "form" && d.subject === "Cedar Park Smiles: 3.6 stars on Google", d.subject);
  check("it names one true fact read from the page", /3\.6 stars from 14 reviews/.test(d.body) && d.used.length === 1, d.body);
  check("it says it is an offer of services, says an AI assistant helped, and how to say no", d.body.includes("This is an offer of services.") && d.body.includes("drafted this note with an AI assistant") && d.body.includes('reply "no" and I will not contact you again'));
  check("every check passes", d.checks.every(c => c.ok) && d.checks.map(c => c.rule).join() === "fact,disclosure,optout,sender,ad,subject", d.checks);
  check("no long dash in the draft", !/\u2014/.test(d.body + d.subject));
  const email = L.compose(Object.assign({}, cedar, { route: { kind: "email", email: "hi@cedarparksmiles.test" } }), POL, {});
  check("an email carries the postal address, as CAN-SPAM requires", email.ok && email.channel === "email" && email.body.includes("500 Main St, Austin, TX 78701") && email.checks.some(c => c.rule === "address" && c.ok));
  const noAddr = L.compose(Object.assign({}, cedar, { route: { kind: "email", email: "hi@x.test" } }), L.setPolicy(POL, { address: "" }).policy, {});
  check("an email with no postal address saved is not drafted, and says what to ask", noAddr.ok === false && noAddr.code === "missing" && noAddr.missing.join() === "address", noAddr);
  check("no offer saved, no pitch drafted", L.compose(cedar, L.setPolicy(POL, { offer: "" }).policy, {}).missing.join() === "offer");
  const call = L.compose(found.find(l => l.name === "Oakridge Family Dental"), POL, {});
  check("a place with only a phone gets a call script that discloses the assistant", call.ok && call.script === true && call.channel === "call" && /I use an AI assistant/.test(call.body) && /did not call again/.test(call.body) && call.checks.every(c => c.ok), call.body);
  check("a place with nothing read about it is not drafted", L.compose(Object.assign({}, cedar, { facts: [] }), POL, {}).code === "generic");
  const job = L.find(L.load(null), jobs.rows, "job", POL, "upwork.jobs", NOON)[0];
  const p = L.compose(job, POL, {});
  check("a proposal quotes the post, names the skills that match, asks one question, suggests a call and gives the rate", p.ok && p.channel === "proposal" && /You wrote: "We need a React developer/.test(p.body) && /It matches what I do: React, TypeScript\./.test(p.body) && /One question:/.test(p.body) && /Upwork Messages/.test(p.body) && /\$45 an hour/.test(p.body), p.body);
  check("and carries the disclosure and a way out, with no offer-of-services line", p.body.includes("drafted this proposal with an AI assistant") && p.body.includes("no reply is needed") && !p.body.includes("offer of services"));
}

{
  const st = L.load(null);
  st.policy = L.setPolicy(POL, { hours: [0, 24] }).policy;
  const found = L.find(st, maps.rows, "place", st.policy, "maps.results", NOON);
  const cedar = st.leads[found.find(l => l.name === "Cedar Park Smiles").id];
  check("with no draft, a send is refused", L.why(cedar, st, NOON).code === "no_draft");
  cedar.draft = L.compose(cedar, st.policy, {});
  cedar.draft.at = NOON;
  check("a checked draft inside the cap can be sent", L.why(cedar, st, NOON) === null, L.why(cedar, st, NOON));
  const typed = [{ text: cedar.draft.body }];
  check("the typed text is recognised as that lead's draft", L.fromTyped(st, typed, NOON + 60000).id === cedar.id);
  check("typed text that dropped the disclosure is caught", L.carries(cedar, [{ text: cedar.draft.body.replace(cedar.draft.disclosure, "") }]).missing.join() === "the AI disclosure line");
  check("typed text that dropped the opt-out is caught", L.carries(cedar, [{ text: cedar.draft.body.replace(cedar.draft.optOut, "") }]).missing.join() === "the opt-out line");
  check("the full draft carries everything", L.carries(cedar, typed).ok === true);
  L.record(st, cedar.id, "sent", NOON, { host: "www.cedarparksmiles.test", by: "user" });
  check("after it is sent, the same place is never written to again", L.why(cedar, st, NOON + 1000).code === "repeat");
  check("the first send starts the ramp", st.first === "2026-09-27" && L.status(st, NOON).sent === 1 && L.status(st, NOON).left === 4);
  const oak = st.leads[found.find(l => l.name === "Oakridge Family Dental").id];
  oak.route = { kind: "form", url: "https://oak.test/" };
  oak.draft = L.compose(oak, st.policy, {});
  oak.draft.at = NOON;
  L.record(st, oak.id, "opted_out", NOON, { by: "user" });
  check("someone who opted out is never written to again, even found under another listing", L.why(Object.assign({}, oak, { id: "Lzz", status: "found" }), st, NOON).code === "opted_out");
  const brand = st.leads[found.find(l => l.name === "Brightway Dental Care").id];
  brand.draft = L.compose(brand, st.policy, {});
  brand.draft.at = NOON;
  for (let i = 0; i < 4; i++) st.log.push({ id: "Lx" + i, event: "sent", at: NOON, day: "2026-09-27" });
  check("the fifth send of the first day hits the cap", L.why(brand, st, NOON).code === "cap" && /cap of 5/.test(L.why(brand, st, NOON).why), L.why(brand, st, NOON));
  check("the next day the cap is 10", L.why(brand, st, NOON + 86400000) === null && L.status(st, NOON + 86400000).cap === 10);
  for (let i = 0; i < 3; i++) st.log.push({ id: "Lb" + i, event: "bounced", at: NOON + 86400000, day: "2026-09-28" });
  check("three bounces in a day stop sending until tomorrow", L.why(brand, st, NOON + 86400000).code === "bounces" && L.why(brand, st, NOON + 2 * 86400000) === null);
  st.policy = L.setPolicy(st.policy, { on: false }).policy;
  check("the switch stops everything", L.why(brand, st, NOON + 2 * 86400000).code === "off");
  st.policy = L.setPolicy(st.policy, { on: true, hours: [8, 21] }).policy;
  check("outside sending hours it waits", L.why(brand, st, at(2026, 9, 29, 23)).code === "hours" && L.why(brand, st, at(2026, 9, 29, 10)) === null);
  const weak = Object.assign({}, brand, { verdict: "skip", reasons: [{ text: "Nothing to say" }] });
  check("a lead the judge skipped is not sent", L.why(weak, st, NOON + 2 * 86400000).code === "weak");
}

check("Gmail, Outlook and Upwork proposal forms are outreach that needs a drafted lead", L.outreach("mail.google.com", "/mail/u/0/") === "a Gmail message" && L.outreach("www.upwork.com", "/ab/proposals/job/~0123/apply/") === "an Upwork proposal" && L.outreach("www.upwork.com", "/nx/search/jobs/") === null && L.outreach("www.cedarparksmiles.test", "/contact") === null);
check("a lead is found by id or by name", (() => { const st = L.load(null); L.find(st, maps.rows, "place", POL, "m", NOON); const id = Object.keys(st.leads)[0]; return L.lookup(st, id).id === id && L.lookup(st, "cedar park smiles").name === "Cedar Park Smiles" && L.lookup(st, "nobody") === null; })());
check("the stored state is cleaned on load: bad ids and bad log rows are dropped", (() => { const s = L.load({ leads: { "../x": {}, Lok: { id: "Lok" } }, log: [null, { event: "sent" }], never: [1, "place:x|"], found: { ids: ["Lok", "bad id"], at: 5 } }); return Object.keys(s.leads).join() === "Lok" && s.log.length === 1 && s.never.join() === "place:x|" && s.found.ids.join() === "Lok"; })());

done("leads");
