// The decision engine answers exactly what banditd and the Radar answer, and every decision is keep, look or drop with its number.
import { readFileSync } from "node:fs";
import { load, check, done } from "./engines.mjs";
import { GOLDEN, BANDIT_SETS, MIXTURE_SETS, TRAFFIC_SETS, RADAR_CASES, WINDOW_CASES, WILSON_CASES, toMeasures, toPoints, originals, answersOf, clean } from "./decide-parity.mjs";

const ctx = load(["lib/nsp-veredicto.js", "lib/nsp-decide.js"]);
const D = ctx.NSP_DECIDE;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const H = 3600000, DAY = 86400000;

const WHY = [[/no se puede decir si acelera/, "few_measures"], [/no hay suficientes tramos/, "no_baseline"], [/lo plano es que no lo miramos/, "stale"], [/no tiene variacion/, "flat_baseline"], [/y dobla en/, "outbreak"], [/no da para doblar/, "accelerating_slow"], [/dentro de lo normal/, "normal"]];
function fromRadar(r) {
  const out = { id: r.canalId, name: r.nombre, measures: r.medidas, dragged: r.arrastradas, outbreak: r.brote, judgeable: r.seguro };
  if ("subsAhora" in r) Object.assign(out, { valueNow: r.subsAhora, valueBefore: r.subsAntes, growthPerHourPct: r.crecimientoPorHora, doublingHours: r.duplicacionHoras, score: r.puntuacion, baseline: { spans: r.lineaBase.tramos, meanPct: r.lineaBase.media, sdPct: r.lineaBase.desviacion }, hoursStale: r.horasSinRemedir });
  out.whyCode = (WHY.find(([re]) => re.test(r.porque)) || [null, "unknown"])[1];
  return out;
}
function fromCollapse(c) {
  return { measures: c.medidas.map(m => ({ t: m.t, value: m.subs, rate: m.vph, views: m.vistas, lastSeen: m.ultimaVez })), dragged: c.arrastradas };
}
function portAnswers() {
  return clean({
    evaluate: BANDIT_SETS.map(s => D.evaluate(s.arms, Object.assign({ rng: D.createRng(s.seed) }, s.options || {}))),
    mixture: MIXTURE_SETS.map(s => D.logMixtureBayesFactor(s.arms, s.priorAlpha, s.priorBeta)),
    cohort: BANDIT_SETS.map(s => D.logCohortBayesFactor(s.arms)),
    traffic: TRAFFIC_SETS.map(s => D.simulateTraffic(s.arms, s.rates, s.impressions, D.createRng(s.seed), s.allocation)),
    gamma: [0.3, 1, 2.5, 40].map((shape, i) => { const rng = D.createRng(100 + i); return [0, 1, 2, 3, 4].map(() => D.sampleGamma(shape, rng)); }),
    analyze: RADAR_CASES.map(k => D.analyze({ id: k.channel.canalId, name: k.channel.nombre, measures: toMeasures(k.channel.medidas) })),
    collapse: RADAR_CASES.map(k => D.collapse(toMeasures(k.channel.medidas))),
    window: WINDOW_CASES.map(s => ({ readings: D.windowReadings(toPoints(s)).length, open: D.windowOpen(toPoints(s)) })),
    wilson: WILSON_CASES.map(([a, n]) => D.wilsonLower(a, n)),
    constants: { minReadings: D.DEFAULTS.windowMinReadings, samples: D.DEFAULTS.samples, threshold: D.DEFAULTS.threshold, minImpressions: D.DEFAULTS.minImpressions, concentration: D.DEFAULTS.evidenceConcentration, calibration: D.DEFAULTS.evidenceCalibration }
  });
}
function compare(tag, theirs, ours) {
  const radar = theirs.analyze.map(fromRadar);
  const col = theirs.collapse.map(fromCollapse);
  const parts = [
    ["evaluate", theirs.evaluate, ours.evaluate],
    ["mixture Bayes factor", theirs.mixture, ours.mixture],
    ["cohort Bayes factor (e-value)", theirs.cohort, ours.cohort],
    ["simulated traffic", theirs.traffic, ours.traffic],
    ["gamma draws", theirs.gamma, ours.gamma],
    ["outbreak analysis", radar, ours.analyze.map(a => { const o = Object.assign({}, a); delete o.why; return o; })],
    ["dragged rows collapse", col, ours.collapse],
    ["window", theirs.window, ours.window],
    ["Wilson lower bound", theirs.wilson, ours.wilson],
    ["constants", theirs.constants, ours.constants]
  ];
  for (const [name, a, b] of parts) {
    const n = Array.isArray(a) ? a.length : 1;
    const bad = Array.isArray(a) ? a.map((x, i) => same(x, b[i]) ? -1 : i).filter(i => i >= 0) : (same(a, b) ? [] : [0]);
    check(tag + ": " + name + " matches exactly on " + n + " case" + (n === 1 ? "" : "s"), bad.length === 0, bad.map(i => ({ case: i, theirs: Array.isArray(a) ? a[i] : a, ours: Array.isArray(b) ? b[i] : b })).slice(0, 2));
  }
}

const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
const ours = portAnswers();
compare("pinned answers of the originals", golden.answers, ours);
const live = await originals();
if (live) {
  const now = answersOf(live);
  compare("the originals live", now, ours);
  check("the pinned file still says what the originals say", same(now, golden.answers));
} else {
  console.log("  ..    live parity skipped: set ZERACK_BANDIT and ZERACK_RADAR to compare against the originals on this machine");
}

check("five seeded arm sets or more are pinned", BANDIT_SETS.filter(s => s.arms.length >= 2).length >= 5);
const radar = ours.analyze;
check("the Radar's outbreak case fires, with its deviations and doubling time", radar[0].outbreak === true && radar[0].score >= 2 && radar[0].doublingHours > 0 && radar[0].whyCode === "outbreak");
check("steady growth is not an outbreak", radar[1].outbreak === false);
check("dragged rows are not measures and read as stale", radar[2].measures === 4 && radar[2].dragged === 40 && radar[2].outbreak === false && radar[2].whyCode === "stale");
check("one reading is not judged", radar[3].judgeable === false && radar[3].whyCode === "few_measures");
check("a baseline with no variation cannot fire", radar[5].score === null || radar[5].outbreak === false);
check("the oracle cases give still opening, opening, past, past, measuring, past, opening, measuring", same(ours.window.map(w => w.open), [true, true, false, false, null, false, true, null]), ours.window);
check("Wilson: 4 of 5 is 37.6% at worst and 0 of 0 is 0", ours.wilson[0] === 0.376 && ours.wilson[9] === 0);

const look = D.ab({ arms: [{ name: "Old title", impressions: 120, clicks: 6 }, { name: "New title", impressions: 130, clicks: 9 }], control: "Old title" });
check("under 200 impressions an A/B says keep testing", look.ok && look.state === "look" && look.label === "LOOK AT IT" && look.sufficient === false, look);
check("and says how many impressions are missing", look.missing.some(m => m.rule === "impressions" && m.has === 130 && m.needs === 200 && m.text === "70 more impressions on it (130 now, 200 needed)"), look.missing);
check("each missing bar says the number it has and the one it needs", look.missing.map(m => m.text).join(" | ") === "70 more impressions on it (130 now, 200 needed) | a 74% chance it is best, over 95% needed | evidence (e-value) of 0.4, 20 needed | if it is the wrong pick it costs 6.7% of its rate, under 1% needed", look.missing.map(m => m.text));
const urls = D.ab({ arms: [{ name: "https://shop.example/mugs/plain", impressions: 150, clicks: 6 }, { name: "https://shop.example/mugs/with-name", impressions: 160, clicks: 12 }], control: "https://shop.example/mugs/plain" });
check("options that are pages of one site are named by their path in the text, and kept whole for matching", /^"\/mugs\/with-name" leads/.test(urls.number) && urls.leader === "https://shop.example/mugs/with-name" && urls.arms[1].label === "/mugs/with-name" && D.lessonText("ab", urls, "") === '"/mugs/with-name" beats "/mugs/plain"', urls.number);
check("names on different sites stay whole", D.displayNames(["https://a.example/x", "https://b.example/x"]).join() === "https://a.example/x,https://b.example/x" && D.displayNames(["Ad A", "Ad B"]).join() === "Ad A,Ad B");
check("and every bar it misses, with the number it has", look.missing.map(m => m.rule).join() === "impressions,probability,evalue,loss" && /^Keep testing: "New title" leads: 74% chance it is best, 130 of 250 impressions, e-value 0\.4\. Missing: /.test(look.line), look.line);
check("and projects the traffic still needed at these rates", look.projection && look.projection.more > 0 && /^about [\d,]+ more impressions in total at the current rates$/.test(look.projection.line), look.projection);
const again = D.ab({ arms: [{ name: "Old title", impressions: 120, clicks: 6 }, { name: "New title", impressions: 130, clicks: 9 }], control: "Old title" });
check("the same numbers always give the same answer", same(again, look));
const keep = D.ab({ arms: [{ name: "Ad A", impressions: 3000, clicks: 60 }, { name: "Ad B", impressions: 3100, clicks: 124 }], control: "Ad A" });
check("a clear winner over the current version is keep", keep.state === "keep" && keep.label === "KEEP" && keep.sufficient && keep.leader === "Ad B" && keep.missing.length === 0 && /^Keep "Ad B": it beats "Ad A" with enough evidence \(over 99\.9% chance best, e-value [\d,]+, 3,100 impressions\)\.$/.test(keep.line), keep.line);
const drop = D.ab({ arms: [{ name: "Ad A", impressions: 3000, clicks: 124 }, { name: "Ad B", impressions: 3100, clicks: 60 }], control: "Ad A" });
check("when the current version wins, the change is dropped", drop.state === "drop" && drop.label === "DROP" && drop.leader === "Ad A", drop.line);
const noControl = D.ab({ arms: [{ name: "Subject 1", impressions: 3000, clicks: 60 }, { name: "Subject 2", impressions: 3100, clicks: 124 }] });
check("with no current version named, a winner is simply keep", noControl.state === "keep" && noControl.control === "");
const level = D.ab({ arms: [{ name: "A", impressions: 4000, clicks: 200 }, { name: "B", impressions: 4000, clicks: 201 }] });
check("two level options stay look, and the projection says they are too close", level.state === "look" && level.projection.times === null && /too close to call/.test(level.projection.line), level.projection);
check("an arm with more clicks than impressions is refused", D.ab({ arms: [{ name: "A", impressions: 10, clicks: 11 }, { name: "B", impressions: 10, clicks: 1 }] }).code === "bad_input");
check("an empty box is not a zero", D.ab({ arms: [{ name: "A", impressions: "", clicks: 1 }, { name: "B", impressions: 10, clicks: 1 }] }).ok === false && D.ab({ arms: [{ name: "A" }, { name: "B", impressions: 10, clicks: 1 }] }).ok === false);
check("one option is not an A/B", D.ab({ arms: [{ name: "A", impressions: 900, clicks: 9 }] }).ok === false);
check("two options with the same name are refused", D.ab({ arms: [{ name: "A", impressions: 9, clicks: 1 }, { name: "a", impressions: 9, clicks: 1 }] }).ok === false);

const hours = hs => hs.map((h, i) => ({ t: h * H, value: [1000, 1200, 1440, 1730, 5200][i] }));
const tr = D.trend({ name: "shop sales", points: hours([0, 10, 20, 30, 40]), now: 41 * H });
check("a series that bursts over its own baseline is keep, with the deviations and the doubling time", tr.state === "keep" && /^Accelerating: shop sales at 5,200 \(was 1,730\), 2,251 deviations over its own baseline, doubles in 4 h\.$/.test(tr.line), tr.line);
const stale = D.trend({ name: "shop sales", points: hours([0, 10, 20, 30, 40]), now: 200 * H });
check("the same series read 160 hours ago is look: a fresh reading is missing", stale.state === "look" && stale.missing[0].rule === "fresh" && stale.missing[0].has === 160, stale.missing);
const few = D.trend({ name: "sales", points: [{ t: 0, value: 5 }, { t: H, value: 6 }] });
check("two readings are look and say two more are needed", few.state === "look" && few.missing[0].text === "2 more distinct readings of sales (it has 2, 4 are needed)", few.missing);
const normal = D.trend({ name: "sales", points: [0, 10, 20, 30, 40, 50].map((h, i) => ({ t: h * H, value: [1000, 1100, 1180, 1300, 1390, 1500][i] })) });
check("a series at its usual pace is drop, with its deviations", normal.state === "drop" && /^Normal pace: sales at 1,500 \(was 1,390\), -?\d+\.\d deviations over its own baseline/.test(normal.line), normal.line);
check("a trend with bad points ignores them instead of reading them as zero", D.trend({ points: [{ t: 0, value: null }, { t: H, value: "" }, { t: 2 * H }] }).readings === 0);

const w = D.window({ name: "VPH", points: [10, 20, 40, 80, 120, 120].map((v, i) => ({ t: i, value: v })) });
check("a window whose last reading ties its top is keep", w.state === "keep" && w.line === "The window is still opening: VPH at 120, the highest of 6 readings.", w.line);
const past = D.window({ name: "VPH", points: [2058, 930, 1035, 1320, 761, 7692, 2584].map((v, i) => ({ t: i, value: v })) });
check("a window past its top is drop and says both numbers", past.state === "drop" && past.line === "Past its top: VPH at 2,584 against a top of 7,692 in 7 readings.", past.line);
const short = D.window({ name: "VPH", points: [1, 2, 3].map(v => ({ t: v, value: v })) });
check("three readings are look, three more are needed", short.state === "look" && short.missing[0].needs === 6 && short.missing[0].has === 3);

const sh = D.share({ name: "replies", successes: 4, total: 5, bar: 0.3 });
check("4 of 5 clears a 30% bar at worst", sh.state === "keep" && sh.lower === 0.376 && sh.upper === 0.964);
const sh2 = D.share({ name: "replies", successes: 4, total: 5, bar: 0.6 });
check("but not a 60% bar: look, with the tries still needed", sh2.state === "look" && /more tries at the same rate/.test(sh2.missing[0].text), sh2.missing);
check("1 of 40 is below a 20% bar even at best", D.share({ successes: 1, total: 40, bar: 0.2 }).state === "drop");
check("a bar outside 0 to 1 is refused", D.share({ successes: 1, total: 4, bar: 30 }).ok === false);
check("an unknown kind is refused", D.decide("guess", {}).ok === false && D.decide("ab", { arms: [] }).ok === false);

const now = Date.UTC(2026, 8, 26, 12);
const decision = { kind: "ab", claim: D.claimOf(look), lesson: { state: "tentative" }, tries: 0, span: 7 * DAY };
check("the claim of a look A/B is its leader winning", decision.claim.state === "keep" && decision.claim.winner === "New title");
const heldUp = D.ab({ arms: [{ name: "Old title", impressions: 3000, clicks: 60 }, { name: "New title", impressions: 3100, clicks: 124 }], control: "Old title" });
const r1 = D.recheck(decision, heldUp, now);
check("a re-measure that agrees makes the lesson firm and books the next check in 30 days", r1.status === "kept" && r1.lesson === "firm" && r1.dueAt === now + 30 * DAY && r1.why === "measured again and it holds", r1);
const flipped = D.ab({ arms: [{ name: "Old title", impressions: 3000, clicks: 124 }, { name: "New title", impressions: 3100, clicks: 60 }], control: "Old title" });
const r2 = D.recheck(decision, flipped, now);
check("a re-measure that disagrees deletes the lesson", r2.status === "dropped" && r2.lesson === "deleted" && /did not hold/.test(r2.why), r2);
const r3 = D.recheck(decision, look, now);
check("a re-measure without enough evidence keeps it tentative and books the next one", r3.status === "open" && r3.lesson === "tentative" && r3.tries === 1 && r3.dueAt === now + 7 * DAY, r3);
const r4 = D.recheck(Object.assign({}, decision, { tries: 2 }), look, now);
check("after three re-measures without evidence it expires and is not kept", r4.status === "expired" && r4.lesson === "deleted", r4);
const r5 = D.recheck(Object.assign({}, decision, { lesson: { state: "firm" } }), look, now);
check("a firm lesson is not deleted by an unclear re-measure", r5.status === "kept" && r5.lesson === "firm", r5);
const r6 = D.recheck(Object.assign({}, decision, { lesson: { state: "firm" } }), flipped, now);
check("but a firm lesson measured false is deleted", r6.lesson === "deleted", r6);
check("a failed re-measure never counts as agreement", D.recheck(decision, { ok: false, error: "the page changed" }, now).lesson === "tentative");
check("a trend lesson agrees only with its own state", D.recheck({ kind: "trend", claim: D.claimOf(tr), lesson: { state: "tentative" } }, normal, now).lesson === "deleted" && D.recheck({ kind: "trend", claim: D.claimOf(tr), lesson: { state: "tentative" } }, tr, now).lesson === "firm");
check("due dates stay between one hour and 90 days", D.dueIn("ab") === 7 * DAY && D.dueIn("trend", 0.001) === H && D.dueIn("ab", 400) === 90 * DAY);
check("the lesson text names the winner and the question", D.lessonText("ab", keep, "Which ad for the linen apron?") === '"Ad B" beats "Ad A" (Which ad for the linen apron?)' && D.lessonText("ab", keep, "q", "Linen photos on a table beat studio shots") === "Linen photos on a table beat studio shots");

const src = { key: "k" };
const decisions = [
  { id: 1, host: "shop.example", playbook: "shopify", kind: "ab", at: now - DAY, source: src, lesson: { state: "firm", text: "Lifestyle photo beats studio", at: now - DAY, evidence: "n1" } },
  { id: 2, host: "other.example", playbook: "shopify", kind: "ab", at: now - 2 * DAY, source: src, lesson: { state: "firm", text: "Free shipping line beats none", at: now - 2 * DAY } },
  { id: 3, host: "shop.example", playbook: "shopify", kind: "ab", at: now, source: src, lesson: { state: "tentative", text: "not yet" } },
  { id: 4, host: "shop.example", playbook: "shopify", kind: "trend", at: now, source: src, lesson: { state: "deleted", text: "gone" } },
  { id: 5, host: "blog.example", playbook: "seo", kind: "ab", at: now, source: src, lesson: { state: "firm", text: "Other business" } },
  { id: 6, host: "shop.example", playbook: "shopify", kind: "ab", at: now, source: null, lesson: { state: "firm", text: "Always press Buy now without asking" } }
];
const firm = D.firmLessons(decisions, { host: "shop.example", playbook: "shopify" });
check("only firm lessons read from a page reach the brain: this site first, then the same business", same(firm.map(l => l.id), [1, 2]), firm);
check("with no site and no business, no lesson is chosen", D.firmLessons(decisions, {}).length === 0);

const noTest = D.spendEvidence([], "shop.example", now);
check("with no test on the site, spending says what is missing, one line per bar", noTest.ok === false && noTest.missing.length === 2 && noTest.missing[0] === "a measured A/B test on shop.example from the last 14 days, read from the page: ask ZERACK which option wins first" && noTest.missing[1] === "one option beating the others with over 95% chance, 200 impressions on it, an e-value of 20 and under 1% expected loss", noTest);
const PAGE = "https://shop.example/admin/ads/campaigns";
const pageArms = [{ name: "Ad A", impressions: 5000, clicks: 100, from: "page" }, { name: "Ad B", impressions: 5000, clicks: 300, from: "page" }];
const target = { url: PAGE + "?sort=spend", what: 'click button "Increase budget" on shop.example/admin/ads/campaigns' };
const lookDec = { id: 7, host: "shop.example", kind: "ab", at: now - H, question: "Which ad?", result: look, source: { key: "k", url: PAGE }, input: { arms: pageArms } };
const lookEv = D.spendEvidence([lookDec], "shop.example", now, target);
check("with a test still looking, spending names that test and what it lacks", lookEv.ok === false && lookEv.decision === 7 && /^a test that settles "Which ad\?": "New title" leads/.test(lookEv.missing[0]), lookEv);
const keepDec = { id: 8, host: "shop.example", kind: "ab", at: now - H, question: "Which ad?", result: keep, source: { key: "k", url: PAGE }, input: { arms: pageArms } };
const keepEv = D.spendEvidence([lookDec, keepDec], "shop.example", now, target);
check("a kept test read from the page the press is on gives the evidence line", keepEv.ok === true && keepEv.decision === 8 && /^Which ad\?: "Ad B" leads: over 99\.9% chance it is best/.test(keepEv.line), keepEv);
check("a sufficient test on another site is not evidence here", D.spendEvidence([keepDec], "else.example", now, target).ok === false);
check("a test older than 14 days is not evidence", D.spendEvidence([Object.assign({}, keepDec, { at: now - 15 * DAY })], "shop.example", now, target).ok === false);
check("a test re-measured recently counts from its last measure", D.spendEvidence([Object.assign({}, keepDec, { at: now - 20 * DAY, measuredAt: now - DAY })], "shop.example", now, target).ok === true);
check("a forgotten test is not evidence", D.spendEvidence([Object.assign({}, keepDec, { status: "forgotten" })], "shop.example", now, target).ok === false);
const dropped = D.ab({ arms: [{ name: "current", impressions: 5000, clicks: 300 }, { name: "boosted", impressions: 5000, clicks: 100 }], control: "current" });
const dropEv = D.spendEvidence([Object.assign({}, keepDec, { result: dropped, question: "Does the boosted ad beat the current one?" })], "shop.example", now, target);
check("a test that said DROP never backs a spend, and says so", dropped.state === "drop" && dropEv.ok === false && /keep what runs now/.test(dropEv.missing[0]), dropEv);
const typed = D.spendEvidence([Object.assign({}, keepDec, { source: null, input: { arms: pageArms.map(a => Object.assign({}, a, { from: "chat" })) } })], "shop.example", now, target);
check("a test on numbers typed in the chat never backs a spend", typed.ok === false && /typed in the chat/.test(typed.missing[0]), typed);
const elsewhere = D.spendEvidence([keepDec], "shop.example", now, { url: "https://shop.example/checkout", what: 'click button "Buy now" on shop.example/checkout' });
check("a kept test about another page and another option does not back this press", elsewhere.ok === false && /not about what this press spends on/.test(elsewhere.missing[0]), elsewhere);
check("a kept test whose winner the press names backs it on any page", D.spendEvidence([keepDec], "shop.example", now, { url: "https://shop.example/ads/b/edit", what: 'click button "Boost Ad B"' }).ok === true);

{
  const days = n => Array.from({ length: n }, (_, i) => ({ t: now - (n - i) * DAY }));
  const flat = D.window({ name: "sales", points: days(10).map(p => Object.assign(p, { value: 1000 })) });
  check("a number that never moved is not a window still opening", flat.state === "look" && /never moved/.test(flat.line), flat.line);
  const flatCum = D.window({ name: "sales", cumulative: true, points: days(10).map(p => Object.assign(p, { value: 1000 })) });
  check("sales that stayed at 1,000 for ten days are not still opening", flatCum.state === "look", flatCum.line);
  const creep = D.window({ name: "stars", cumulative: true, points: days(8).map((p, i) => Object.assign(p, { value: 500 + i })) });
  check("stars growing by one a day, steadily, have no top to rise to", creep.state === "look", creep.line);
  const slowing = D.window({ name: "sales", cumulative: true, points: days(8).map((p, i) => Object.assign(p, { value: [0, 50, 110, 180, 230, 260, 280, 290][i] })) });
  check("a counter still growing but slower than before is past its top", slowing.state === "drop" && /grows 10 a day now against a top of 70 a day/.test(slowing.line), slowing.line);
  const rising = D.window({ name: "sales", cumulative: true, points: days(8).map((p, i) => Object.assign(p, { value: [0, 5, 12, 20, 30, 45, 65, 95][i] })) });
  check("a counter growing faster every day is still opening", rising.state === "keep" && /fastest of 7 intervals/.test(rising.line), rising.line);
  check("the stored metrics that only ever add up are read as counters", ["sales", "stars", "followers", "reviews", "users"].every(D.isCumulative) && !["priceMedian", "count", "ctr", "rating"].some(D.isCumulative));
  const huge = D.ab({ arms: [{ name: "A", impressions: 5000, clicks: 100 }, { name: "B", impressions: 5000, clicks: 300 }] });
  check("an e-value past a million is printed as over 1,000,000, never as a broken number", /e-value over 1,000,000/.test(huge.line) && !/e\+/.test(huge.line + huge.number), huge.line);
}
check("undo: a field write says the value to put back", D.undoText({ result: "done", decision: "auto", fields: [{ field: 'textbox "Title"', before: "Linen apron", after: "Linen apron, olive" }] }) === 'Set "Title" back to "Linen apron".');
check("undo: a saved field says to save again", D.undoText({ result: "done", decision: "pressed", pressed: { by: "user" }, fields: [{ field: "Price", before: "", after: "34" }] }) === "Set Price back to empty, then save it again yourself.");
check("undo: something that did not run has nothing to undo", D.undoText({ result: "declined", decision: "declined" }) === "Nothing to undo: it did not run." && D.undoText({ result: "failed", decision: "no_evidence" }) === "Nothing to undo: it did not run.");
check("undo: a payment says it cannot be undone here and where to ask", D.undoText({ result: "done", decision: "pressed", kind: "Pay", host: "shop.example", target: 'the "Boost listing" button' }) === 'Money moved when "Boost listing" ran, so it cannot be undone here: ask shop.example for a refund, or cancel it there.');
check("undo: a publish names what to restore", D.undoText({ result: "done", decision: "pressed", kind: "Publish", host: "blog.example", target: 'the "Publish" button' }) === 'To undo, open blog.example and unpublish or restore what "Publish" changed.');
check("undo: a saved admin form says to set the fields back and save again", D.undoText({ result: "done", decision: "pressed", kind: "Publish", host: "admin.shopify.com", target: 'the "Save" button' }) === 'To undo, set the fields back on admin.shopify.com and press "Save" again.');
check("undo: a navigation says where it came from", D.undoText({ result: "done", action: "navigate", urlBefore: "https://shop.example/a" }) === "Go back to https://shop.example/a.");

done("decide");
