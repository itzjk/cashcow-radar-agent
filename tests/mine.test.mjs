// Your channel, composed from measured numbers: what the requests route to, Wrapped with its publishing hours,
// the next video and its evidence, the title judge against the user's own titles, the thumbnail placed among
// winners at phone size, the three concepts, the check before upload and the money card.
import { load, check, done } from "./engines.mjs";

const g = load(["lib/nsp-veredicto.js", "lib/nsp-cadencia.js", "lib/nsp-packaging.js", "lib/nsp-rpm-tabla.js", "lib/nsp-rival-formula.js", "lib/nsp-rival-quiebre.js", "lib/nsp-rival-replicable.js", "lib/nsp-rival-expediente.js", "lib/nsp-rival-saturacion.js", "lib/nsp-rival-ventana.js", "lib/nsp-rival-duelo.js", "knowledge/reverse-engine.js", "lib/nsp-miniatura-motor.js", "lib/nsp-miniatura-cohorte.js", "lib/nsp-miniatura-mercado.js", "lib/nsp-titulos-senales.js", "lib/nsp-titulos-tabla.js", "lib/nsp-titulos-juicio.js", "lib/nsp-areas.js", "lib/nsp-text.js", "nsp-policy.js", "lib/nsp-dinero-rpm.js", "lib/nsp-dinero-equilibrio.js", "lib/nsp-dinero-riesgo.js", "lib/nsp-intel.js", "lib/nsp-mine.js"]);
const M = g.NSP_MINE, R = g.NspDineroRpm, POL = g.NSPPolicy, RISK = g.NspDineroRiesgo, MM = g.NspMiniatura, V = g.NSP_VEREDICTO;
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./sw-harness.mjs";
POL._setPoliciesForTest(JSON.parse(readFileSync(join(ROOT, "data/policies.json"), "utf8")));

const ROUTES = [
  ["My Wrapped", "wrapped"], ["mi wrapped", "wrapped"], ["resumen de mi canal", "wrapped"], ["show me my channel wrapped", "wrapped"],
  ["What is my next video?", "next"], ["¿cuál es mi próximo video?", "next"], ["qué video hago ahora", "next"], ["what should I make next", "next"],
  ["Judge this title: The Roman Legion That Vanished Overnight", "title"], ["juzga este título: La legión que desapareció", "title"],
  ["Judge my thumbnail", "thumb"], ["revisa mi miniatura", "thumb"],
  ["Thumbnail ideas for: The Roman Legion That Vanished", "thumbgen"], ["hazme miniaturas para: el oro de los aztecas", "thumbgen"],
  ["Check before upload", "policy"], ["¿esto se desmonetiza?: The autopsy footage", "policy"],
  ["Money calculator", "money"], ["cuánto gano con historia a 20 mil vistas por video", "money"], ["how much can I make with personal finance at 50k views", "money"],
  ["my channel is @kurzgesagt", "setmine"], ["este es mi canal", "setmine"], ["olvida mi canal", "forgetmine"]
];
const NOT_MINE = ["cuánto paga youtube por mil vistas", "mi canal está muerto", "no sé qué hacer con mi canal", "escríbeme cinco títulos para historia", "mi canal de youtube no crece", "qué opinas de este canal", "el segundo video era mejor", "why did this blow up", "compara este canal con kurzgesagt", "what does youtube pay", "no quiero mi wrapped", "my next video will be about rome", "the title of my video is long", "why did my video get demonetized last week", "Is my Roman legion camp title good, and what would the sleep niche pay me? Use your tools.", "tell me how much can I make if I post daily in the sleep niche and also what thumbnails and titles work best for it"];
{
  const miss = ROUTES.filter(([t, k]) => { const r = M.intent(t); return !r || r.kind !== k; });
  check("every own-channel request routes to its card", miss.length === 0, miss.map(([t, k]) => [t, k, M.intent(t)]));
  const loose = NOT_MINE.filter(t => M.intent(t));
  check("and sentences that are not a request stay out", loose.length === 0, loose.map(t => [t, M.intent(t)]));
  const t = M.intent("Judge this title: Why ROME Fell... In 3 Days?");
  check("a title keeps its case and punctuation for the judge", t.title === "Why ROME Fell... In 3 Days?", t);
  check("the request speaks the language of the user", M.intent("¿cuál es mi próximo video?").lang === "es" && M.intent("What is my next video?").lang === "en");
  const mo = M.intent("how much can I make with personal finance at 50k views, cost $40 per video");
  check("the money request reads the niche, the views and the cost", mo.niche === "personal finance" && mo.views === 50000 && mo.cost === 40, mo);
  check("amounts read in both languages", M.parseAmount("20 mil") === 20000 && M.parseAmount("1,5 millones") === 1500000 && M.parseAmount("25,000") === 25000 && M.parseAmount("12k") === 12000);
  const said = M.intent("ideas de miniatura para el oro de los aztecas");
  check("spoken without a colon, the thumbnail ideas still find the title", said && said.kind === "thumbgen" && said.title === "el oro de los aztecas", said);
  check("and a spoken next video question routes", M.intent("what should my next video be").kind === "next");
  const pol = M.intent("will this get demonetized: The autopsy showed the mutilated body. Then the police came.");
  check("a pasted script goes to the script field", pol.kind === "policy" && /autopsy/.test(pol.script) && !pol.title, pol);
}

const DAY = 86400000, NOW = Date.UTC(2026, 8, 26, 20, 0, 0);
function channel(n, opts = {}) {
  return Array.from({ length: n }, (_, i) => {
    const hot = (opts.hot || []).includes(i);
    const at = NOW - (i + 1) * 3 * DAY;
    const hour = opts.hourOf ? opts.hourOf(i) : 15;
    const d = new Date(at); d.setUTCHours(hour, 0, 0, 0);
    return { videoId: ("v" + String(i).padStart(10, "0")).slice(0, 11), title: opts.titleOf ? opts.titleOf(i) : "The hidden history of the ancient empire part " + i, viewsNum: hot ? 90000 + i * 1000 : 10000 + (i % 5) * 700, published: ((i + 1) * 3) + " days ago", length: "18:2" + (i % 10), publishedAt: opts.untimed ? undefined : d.getTime() };
  });
}

{
  const vids = channel(30, { hot: [4, 9, 14], hourOf: i => (i % 3 === 1 ? 21 : (i % 3 === 2 ? 9 : 15)) });
  vids.forEach((v, i) => { if (i % 3 === 1) v.viewsNum *= 3; });
  const s = M.slotsOf(vids, 0);
  check("the best window is the one whose uploads beat their neighbors", s.state === "best" && s.hour.best.key === 7, s.hour);
  check("a window needs three uploads to count", s.slots.every(x => x.n >= 3));
  const one = M.slotsOf(channel(20), 0);
  check("a channel that always publishes at one hour gets no invented best hour", one.state === "one" && one.modeHour === 15, { state: one.state, mode: one.modeHour });
  const few = M.slotsOf(channel(20, { untimed: true }), 0);
  check("with no exact times the best hour is not measured", few.state === "few" && few.timed === 0);
  const tz = M.slotsOf(channel(12), 240);
  check("hours are shown in the user's time zone", tz.modeHour === 11 && tz.tz === "UTC-4", { mode: tz.modeHour, tz: tz.tz });
  const w = M.wrapped({ channel: { name: "History Deep", handle: "@hist", subs: 120000 }, videos: vids, offsetMin: 0, now: NOW }, "en");
  const sec = id => w.sections.find(x => x.id === id);
  const top = vids.slice().sort((a, b) => b.viewsNum - a.viewsNum)[0];
  check("Wrapped leads with the best video and its multiple over the median", w.kind === "wrapped" && /x$/.test(w.hero.value) && sec("best").rows[0].value.includes(top.title), [w.hero, top.title]);
  check("it names the best publishing window", sec("time").rows.some(r => r.tag === "BEST" && /^21:00 to 00:00$/.test(r.label)), sec("time").rows);
  check("the real niche is read title by title with its RPM stamped as an estimate", sec("niche").rows.some(r => /History in 30 of 30/.test(r.value)) && sec("niche").rows.some(r => r.tag === "ESTIMATE"), sec("niche").rows);
  check("the honest line says what was not measured", sec("numbers").rows.some(r => /Click-through rate/.test(r.value)));
  check("the share image carries four rows and the post names the tool", w.share.rows.length <= 4 && w.share.kind === "WRAPPED" && /ZERACK, open source/.test(w.share.post), w.share);
  const es = M.wrapped({ channel: { name: "History Deep" }, videos: vids, offsetMin: 0, now: NOW }, "es");
  check("spoken in Spanish when asked in Spanish", /tu mejor video/.test(es.say) && / a 00:00/.test(es.say), es.say);
}

{
  const titles = i => i === 3 ? "The Lost Legion of Rome and the Fog of Scotland" : (i === 11 ? "Where the Lost Legion Marched Before It Vanished" : "Daily life in the ancient empire, part " + i);
  const vids = channel(30, { hot: [3, 11], titleOf: titles });
  const recent = NOW - 2 * DAY;
  const corpus = Array.from({ length: 30 }, (_, i) => ({ t: i < 5 ? "The lost legion nobody found " + i : "Random video about cooking " + i, v: i < 5 ? 4000 : 800, ts: recent, n: "Historia" }));
  const n = M.nextVideo({ channel: { name: "History Deep" }, videos: vids, signals: { corpus }, language: "en", now: NOW }, "en");
  const ev = n.sections.find(s => s.id === "evidence");
  check("the next video follows the outliers, not the channel-wide words", /legion/i.test(n.hero.value) && !/ancient|empire/i.test(n.hero.value), n.hero);
  check("both outliers on the topic are counted", /2 outliers/.test(ev.rows[0].value), ev.rows[0]);
  check("a topic running hot in the user's scans is marked rising", ev.rows.some(r => r.tag === "RISING" && /5 of 30/.test(r.value)), ev.rows.filter(r => r.tag));
  check("signals with no data say so instead of pretending", ev.rows.filter(r => r.tag === "NOT AVAILABLE").length === 3, ev.rows.map(r => r.tag));
  check("the hook waits for the writer", n.sections.find(s => s.id === "write").state === "pending");
  const hooked = M.withHook(n, { ok: true, title: "The Legion That Walked Into the Fog", hook: "In the year 117 a whole legion marched north. Nobody saw it come back.", by: "your local model" }, "en");
  const wr = hooked.sections.find(s => s.id === "write");
  check("the written title and hook land on the card with who wrote them", wr.state === "done" && wr.rows[0].value === "The Legion That Walked Into the Fog" && wr.rows.some(r => r.label === "Hook" && /legion/.test(r.value)) && /local model/.test(wr.note), wr);
  check("and the written title is judged too", /Judge percentile \d+/.test(wr.rows[0].note), wr.rows[0]);
  const none = M.withHook(n, { ok: false, reason: "Not written: no AI provider is set up." }, "en");
  check("without a provider the card says the hook was not written", none.sections.find(s => s.id === "write").rows.some(r => /no AI provider/.test(r.value)));
  const p = M.hookPrompt(n.brief);
  check("the writer gets the evidence, never a page", /legion/i.test(p.user) && /JSON only/.test(p.system) && !/http/.test(p.user), p.user.slice(0, 200));
  check("the answer is read as a title and a hook", M.parseHook('Sure: {"title": "A", "hook": "B"}').title === "A" && M.parseHook("no json") === null);
  const flat = M.nextVideo({ channel: { name: "Flat" }, videos: channel(20), signals: {}, now: NOW }, "en");
  check("a channel with no outlier gets no invented topic", flat.hero.value === "NO OUTLIER", flat.hero);
}

{
  const vids = channel(30, { hot: [2, 5], titleOf: i => i === 2 ? "Rome's Last Legion Vanished in One Night" : (i === 5 ? "The Legion Rome Tried to Forget" : "A Quiet Walk Through the Roman Forum: Part " + i) });
  const t = M.titleJudge({ title: "The Roman Legion That Vanished Overnight", channel: { name: "History Deep", handle: "@hist" }, videos: vids, now: NOW }, "en");
  const own = t.sections.find(s => s.id === "own");
  check("the title judge places the new title among the user's own titles", own.rows.some(r => /^Above \d+ of your last 30 titles$/.test(r.value)), own.rows);
  check("and shows the user's closest earlier videos by topic", own.rows.filter(r => r.label === "Closest of yours").length >= 1 && own.rows.some(r => /Legion/.test(r.value)), own.rows);
  check("the hero is the calibrated percentile", /^P\d+$/.test(t.hero.value), t.hero);
  const city = M.titleJudge({ title: "Why the First Ancient City Was Abandoned", now: NOW }, "en");
  check("the niche reference shows real winners on the same topic", city.sections.find(s => s.id === "niche").rows.some(r => /^Real winner/.test(r.label) && /Ancient City/.test(r.value)), city.sections.find(s => s.id === "niche").rows);
  check("and leaves out winners on another topic or in another language", !city.sections.find(s => s.id === "niche").rows.some(r => /Histórias|historias/.test(r.value)));
  check("it says the judge was not validated inside one channel", /not a promise that it beats them/.test(own.note));
  const cut = M.titleJudge({ title: "Ancient Rome - The Complete History of the Empire From Its Rise to Its Fall in One Film" }, "en");
  const rw = cut.sections.find(s => s.id === "rewrite");
  check("a rewrite never ends on a dangling connector", rw && !/\b(?:the|of|to|a|in|from)$/i.test(rw.rows[0].value), rw && rw.rows[0]);
  const topics = ["Daily Life In Ancient Egypt", "What Romans Ate For Breakfast", "How Vikings Spent The Winter", "The Strange Jobs Of Medieval London", "Why Samurai Wrote Poems", "Life On A Pirate Ship", "The Plague Doctors Of Venice", "Inside A Castle At Night", "How Monks Made Books", "The Last Day Of Pompeii"];
  const brand = channel(30, { titleOf: i => topics[i % 10] + (i >= 10 ? " Part " + Math.floor(i / 10) : "") + " | Boring History For Sleep" });
  const kept = M.titleJudge({ title: "What It Would Be Like To Sleep In A Roman Legion Camp On The Rhine | Boring History For Sleep", channel: { name: "History Deep" }, videos: brand, now: NOW }, "en");
  const krw = kept.sections.find(s => s.id === "rewrite");
  const prop = krw && krw.rows[0].value;
  check("a rewrite keeps the fixed part of the user's own skeleton and every word it did not need to drop", /\| Boring History For Sleep$/.test(prop) && /RHINE|Rhine/.test(prop) || /^Leave it/.test(prop), prop);
  check("and the proposal is judged before it is offered", /^Leave it/.test(prop) || /^Scores P\d+ against P\d+/.test(krw.rows[0].note), krw && krw.rows[0]);
  const empty = M.titleJudge({ title: "" }, "en");
  check("no title, no verdict", empty.hero.value === "NO TITLE");
}

function img(w, h, fn) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g2, b] = fn(x, y); const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g2; d[i + 2] = b; d[i + 3] = 255; }
  return d;
}
{
  const winners = Array.from({ length: 10 }, (_, k) => {
    const d = img(480, 270, (x, y) => (y > 40 && y < 110 && (Math.floor(x / (6 + k % 3)) % 2 === 0)) ? [255, 255, 255] : (x > 300 ? [230, 120, 20] : [20, 30, 60 + k * 3]));
    const m = MM.medirCompleto(d, 480, 270, 1280);
    m.id = "w" + k;
    return m;
  });
  const flat = MM.medirCompleto(img(480, 270, () => [120, 120, 125]), 480, 270, 1280);
  const cohort = { ok: true, dice: "10 winners", videos: winners.map((m, k) => ({ id: ("abcdefghij" + k).slice(0, 11), titulo: "x", vph: 1000 - k })), measured: winners };
  const c = M.thumbJudge({ mine: flat, preview: "data:image/jpeg;base64,AAAA", cohort, title: "The Legion", now: NOW }, "en");
  check("a flat grey thumbnail reads worse at phone size than the winners", /^\d+\/100$/.test(c.hero.value) && parseInt(c.hero.value, 10) <= 20, c.hero);
  const change = c.sections.find(s => s.id === "change").rows.map(r => r.value).join(" ");
  check("and the card says what to change, with the winners' numbers", /text or a logo band/.test(change) && /winners’ median/.test(change), change);
  check("the missing text leads the list", /text or a logo band/.test(c.sections.find(s => s.id === "change").rows[0].value), c.sections.find(s => s.id === "change").rows[0]);
  check("yours is shown at phone size next to the winners", c.sections[0].images[0].phone && c.sections[0].images[0].mine && c.sections[0].images.length === 8, c.sections[0].images.length);
  check("it says a pixel score is not a click prediction", c.sections.some(s => s.id === "honest" && /588/.test(s.note)));
  const scores = winners.map(w => parseInt(M.thumbJudge({ mine: w, cohort, now: NOW }, "en").hero.value, 10)).sort((a, b) => a - b);
  check("the winners themselves spread around the middle of their own cohort", scores[5] >= 25 && scores[5] <= 75 && scores[9] > scores[0], scores);
  const none = M.thumbJudge({ mine: flat, cohort: { ok: false, razon: "Only 3 winners." }, now: NOW }, "en");
  check("with no cohort it is not placed", none.hero.value === "NOT PLACED");
  const es = M.thumbJudge({ mine: flat, preview: "data:image/jpeg;base64,AAAA", cohort, title: "La Legión", now: NOW }, "es");
  check("asked in Spanish, the first change is spoken in Spanish too", /Primer cambio: \d+ de 10 ganadores llevan texto/.test(es.lead) && !/winners|yours|carry/.test(es.lead), es.lead);
  check("while the card rows stay in English", /text or a logo band/.test(es.sections.find(s => s.id === "change").rows[0].value));
  const plain = Array.from({ length: 10 }, (_, k) => { const m = MM.medirCompleto(img(480, 270, x => (x > 240 ? [230, 120 + k, 20] : [20, 30, 160 + k * 3])), 480, 270, 1280); m.id = "p" + k; return m; });
  const noBands = { ok: true, dice: "10 winners", videos: plain.map((m, k) => ({ id: ("klmnopqrst" + k).slice(0, 11), titulo: "x", vph: 900 - k })), measured: plain };
  const fine = MM.medirCompleto(img(480, 270, (x, y) => (y > 40 && y < 110 && x % 2 === 0) ? [255, 255, 255] : (x > 300 ? [230, 120, 20] : [20, 30, 60])), 480, 270, 1280);
  const leads = [flat, fine].map(m => M.thumbJudge({ mine: m, cohort: noBands, now: NOW }, "es").lead);
  check("a measured first change is spoken in Spanish as well", /Primer cambio: Sube el contraste/.test(leads[0]) && /Primer cambio: El color es más apagado/.test(leads[1]) && !/winners|yours|against/.test(leads.join(" ")), leads);
}

{
  const c = M.concepts({ title: "The Roman Legion That Vanished Overnight", style: { hues: ["orange", "blue"], bands: 7, measured: 10, brightness: 70 }, niche: "Historia", provider: "", now: NOW }, "en");
  const concepts = c.sections.filter(s => s.concept);
  check("three concepts, each with a precise prompt", concepts.length === 3 && concepts.every(s => /16:9/.test(s.copy.text) && /Do not draw any text/.test(s.copy.text)), concepts.map(s => s.title));
  check("in the user's measured style", concepts.every(s => /orange and blue/.test(s.copy.text) && /dark, low key/.test(s.copy.text)));
  check("with the hook text when most of their thumbnails carry text", concepts.every(s => s.overlay && s.overlay.text === "VANISHED OVERNIGHT"), concepts.map(s => s.overlay));
  check("with no image key there is no draw button, and it says which key would draw", !c.draw && /Gemini key/.test(c.keyNeeded) && /A Gemini or OpenAI key/.test(c.lead), c.keyNeeded);
  const k = M.concepts({ title: "x y z legion", style: null, provider: "gemini", now: NOW }, "en");
  check("with a key the draw spec holds the three prompts and the cost", k.draw && k.draw.prompts.length === 3 && /3 images/.test(k.draw.cost));
  const drawn = M.withDrawn(k, [{ id: "close", src: "data:image/jpeg;base64,AAAA" }, { id: "wide", error: "quota" }], "drawn with Gemini");
  check("drawn images replace the button and failures are named", !drawn.draw && drawn.sections.find(s => s.id === "concept-close").images[0].big && drawn.sections.find(s => s.id === "concept-wide").rows.some(r => /quota/.test(r.value)), drawn.hero);
}

{
  const script = "The autopsy showed the mutilated body of the victim. This herb cures cancer, stop chemotherapy.";
  const pol = await POL.evaluatePackage({ script, title: "The case file", description: "" });
  const risk = RISK.evaluarGuion({ texto: script, titulo: "The case file", descripcion: "", politica: pol });
  const c = M.policy({ title: "The case file", script, pol, risk, now: NOW }, "en");
  const flags = c.sections.find(s => s.id === "flags").rows;
  check("the check names each flag with its policy and field", flags.some(r => r.label === "Shocking content" && /in the script/.test(r.value)) && flags.some(r => r.label === "Demonetising misinformation"), flags.map(r => r.label + ": " + r.value));
  check("the verdict is look at it, never a promise from YouTube", c.hero.value === "LOOK AT IT" && !/MONETIZATION SAFE/.test(JSON.stringify(c)), c.hero);
  const empty = M.policy({ title: "Roman aqueducts", pol: await POL.evaluatePackage({ script: "", title: "Roman aqueducts" }), risk: RISK.evaluarGuion({ texto: "", titulo: "Roman aqueducts", politica: await POL.evaluatePackage({ script: "", title: "Roman aqueducts" }) }), now: NOW }, "en");
  check("a title with no script is marked unaudited", empty.sections[0].rows.some(r => r.tag === "UNAUDITED") && empty.hero.value === "LOOK AT IT", empty.sections[0].rows);
  const form = M.ask("policy", "en");
  check("the empty request is a box with title, description and script", form.form.op === "policy" && form.form.fields.map(f => f.id).join() === "title,description,script");
}

{
  const c = M.money({ niche: "ancient history documentary", views: 20000, now: NOW }, "en");
  const pv = R.porVideo({ tema: "ancient history documentary", vistasPorVideo: 20000 });
  const t = c.sections.find(s => s.id === "month").table;
  const dollars = s => Number(String(s).replace(/[$,]/g, ""));
  check("4, 8 and 12 videos a month at the table's RPM", t.rows.map(r => r[0]).join() === "4,8,12" && Math.abs(dollars(t.rows[1][2]) - 8 * pv.usdPorVideo) < 0.01, t.rows);
  check("stamped as an estimate", c.hero.label.includes("estimate") && c.sections.find(s => s.id === "rate").rows[0].tag === "ESTIMATE");
  check("with no cost it gives the views that pay back each ten dollars, and invents no margin", c.sections.find(s => s.id === "breakeven").rows.some(r => /Not given/.test(r.value)));
  const cost = M.money({ niche: "personal finance", views: 50000, cost: 40, own: { floor: 20000, ceiling: 200000 }, topicRisk: RISK.evaluarTema("personal finance", null), now: NOW }, "en");
  const be = cost.sections.find(s => s.id === "breakeven").rows;
  check("with a cost the margin and the pay back views appear", be.some(r => r.label === "Margin a video") && be.some(r => r.label === "A video pays itself back at"), be);
  check("the user's own spread is a risk row", cost.sections.find(s => s.id === "risk").rows.some(r => r.label === "Your spread" && /20K to 200K/.test(r.value)));
  check("the own floor adds a column", cost.sections.find(s => s.id === "month").table.head.includes("At your floor"));
  const bad = M.money({ niche: "history", views: null, now: NOW }, "en");
  check("no views, no number: the card asks", bad.hero.value === "NO NUMBER" && bad.form && bad.form.op === "money");
  const es1 = M.money({ niche: "historia", views: 1e6, now: NOW }, "es");
  const es2 = M.money({ niche: "historia", views: 2e6, cost: 9000, now: NOW }, "es");
  const es3 = M.money({ niche: "historia", views: 20000, now: NOW }, "es");
  check("in Spanish a million views reads un millón de vistas", /a un millón de vistas por video/.test(es1.lead) && /a 2 millones de vistas por video/.test(es2.lead) && /a 20 mil vistas por video/.test(es3.lead), [es1.lead, es2.lead, es3.lead]);
  check("a Spanish answer names the niche in Spanish, not with the English table name", /^Historia a un millón/.test(es1.lead) && !/History/.test(es1.lead), es1.lead);
  check("and the pay back views keep the same grammar", /se paga a las .*vistas/.test(es2.lead) && !/(millones|millón) vistas/.test(es1.lead + es2.lead), es2.lead);
}

{
  for (const [t, v] of [["cuánto gano con historia a 1 millón de vistas por video", 1e6], ["cuánto gano con historia a 2 millones de visitas", 2e6], ["cuánto gano con historia a 1,5 millones de vistas", 1.5e6], ["cuánto gano con historia a un millón de vistas", 1e6], ["cuánto gano con historia a 20 mil de vistas", 20000]]) {
    const r = M.intent(t);
    check('"' + t + '" reads ' + v + " views and keeps the niche clean", r && r.kind === "money" && r.views === v && r.niche === "historia", r);
  }
  const loose = M.intent("cuánto gano con historia a 1 millón");
  check("an amount with no views word is left out of the niche instead of polluting it", loose && loose.niche === "historia" && loose.views === null, loose);
  const mk = hours => hours.map((h, i) => ({ videoId: ("v" + String(i).padStart(10, "0")).slice(0, 11), title: "Some history video " + i, viewsNum: 1000 + (i % 5) * 300, publishedAt: Date.UTC(2026, 7, 1 + i * 2, h), published: (40 - i * 2) + " days ago" }));
  const spread = M.wrapped({ channel: { name: "X" }, videos: mk([15, 16, 17, 0, 1, 3, 4, 6, 7, 9, 12, 21]), offsetMin: 0, now: Date.UTC(2026, 8, 27) }, "en");
  check("uploads spread across the day are not called a fixed habit", !/almost every time/.test(spread.lead) && /spread across the day/.test(spread.lead) && !spread.share.rows.some(r => /Publishes/.test(r.label)), spread.lead);
  const habit = M.wrapped({ channel: { name: "X" }, videos: mk([22, 22, 22, 22, 22, 23, 22, 22, 21, 22, 10, 22]), offsetMin: 0, now: Date.UTC(2026, 8, 27) }, "en");
  check("a real habit names its window and how many uploads it holds", /between 21:00 and 00:00 almost every time, 11 of 12/.test(habit.lead), habit.lead);
  const titles = ["What It Would Be Like To Time Travel To Medieval England | Boring History For Sleep", "Why New Orleans Was America's Craziest City | Boring History For Sleep"].concat(Array.from({ length: 20 }, (_, i) => "Life In A Medieval Village Part " + i + " | Boring History For Sleep"));
  const vids = titles.map((t, i) => ({ videoId: ("n" + String(i).padStart(10, "0")).slice(0, 11), title: t, viewsNum: i === 0 ? 16000 : (i === 1 ? 9700 : 3000 + (i % 4) * 100), published: (i + 1) * 3 + " days ago" }));
  const nv = M.nextVideo({ channel: { name: "History & Sleep" }, videos: vids, signals: {}, language: "en", now: Date.UTC(2026, 8, 27) }, "en");
  check("the next topic reads as a phrase from the real title, not a lowercase keyword string", /^Time Travel To Medieval England$/.test(nv.hero.value) && /Your next video: Time Travel To Medieval England\./.test(nv.lead), { hero: nv.hero.value, lead: nv.lead });
  const w = nv.sections.find(x => x.id === "write").rows[0];
  check("the skeleton row never carries a judge score for a filled slot, and nothing is spoken as the title before the writer answers", (w.label === "Your skeleton" || /slot suggestion/.test(w.note)) && !/percentile/i.test(JSON.stringify(nv.sections.find(x => x.id === "write"))) && !/Title:/.test(nv.say + nv.lead), w);
  const tpl = M.nextVideo({ channel: { name: "T" }, videos: vids.map((v, i) => Object.assign({}, v, { title: i === 0 ? v.title : "The Strange Story Of Topic " + i + " | Boring History For Sleep" })), signals: {}, language: "en", now: Date.UTC(2026, 8, 27) }, "en");
  const tw = tpl.sections.find(x => x.id === "write").rows[0];
  check("when the titles repeat a skeleton it is filled with the readable phrase and labelled as a slot suggestion", tw.label === "Your skeleton" || (/Time Travel To Medieval England/.test(tw.value) && /slot suggestion/.test(tw.note)), tw);
}

done("mine");
