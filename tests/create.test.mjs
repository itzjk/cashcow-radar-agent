// Create and hands-free: what the create requests route to, the channel earnings estimate with its math, and the
// Studio package: chapters, YouTube's field limits, chapter times from the video's own captions, and the cards.
import { load, check, done } from "./engines.mjs";

const g = load(["lib/nsp-text.js", "lib/nsp-rpm-tabla.js", "lib/nsp-dinero-rpm.js", "lib/nsp-intel.js", "lib/nsp-shorts.js", "lib/nsp-create.js"]);
const C = g.NSP_CREATE, S = g.NSP_SHORTS;

const ROUTES = [
  ["write a sourced script about the fall of Constantinople", "script", "the fall of Constantinople"],
  ["escríbeme un guion con fuentes sobre la caída de Constantinopla", "script", "la caída de Constantinopla"],
  ["write a 10 minute script about the Voynich manuscript", "script", "the Voynich manuscript"],
  ["hazme un guion de 8 minutos sobre el oro de los aztecas", "script", "el oro de los aztecas"],
  ["guion con fuentes: la peste negra", "script", "la peste negra"],
  ["find shorts in this video", "shorts"], ["saca shorts de este video", "shorts"], ["corta este video en shorts", "shorts"],
  ["qué partes de este video sirven para shorts", "shorts"], ["find the best shorts in https://www.youtube.com/watch?v=n82XWvEa22Q", "shorts"],
  ["fill studio", "studio_fill"], ["rellena studio", "studio_fill"], ["rellena los campos de studio", "studio_fill"], ["oye rellena estudio", "studio_fill"], ["rellena el estudio de youtube", "studio_fill"], ["fill in the studio fields", "studio_fill"],
  ["studio package", "studio_pack"], ["prepara el paquete para studio", "studio_pack"],
  ["how much does this channel earn", "earn"], ["cuánto gana este canal", "earn"], ["cuánto dinero gana @veritasium", "earn"], ["how much does MrBeast make", "earn"],
  ["cuánto gana el canal de kurzgesagt", "earn"], ["ingresos de este canal", "earn"], ["estimate the revenue of this channel", "earn"]
];
const NOT = ["write a python script to scrape youtube", "what is a script", "mi guion es largo", "escribe un guion", "the script about rome was bad", "no escribas un guion sobre roma",
  "cuánto gano yo al mes", "cuánto gana un youtuber", "how much do youtubers make", "cuánto paga youtube por mil vistas", "cuánto gano con historia a veinte mil vistas por video",
  "shorts are the future", "I love shorts", "studio ghibli is great", "el estudio de grabación", "how do I make money on youtube", "fill the form", "the next video is about rome"];
ROUTES.forEach(([t, kind, topic]) => {
  const r = C.intent(t);
  check("routes: " + t, r && r.kind === kind && (!topic || r.topic === topic), r);
});
NOT.forEach(t => check("stays with the model: " + t, C.intent(t) === null, C.intent(t)));
check("the length asked for is kept", C.intent("write a 10 minute script about the Voynich manuscript").minutes === 10);
check("a video link is the target of the Shorts miner", C.intent("find the best shorts in https://www.youtube.com/watch?v=n82XWvEa22Q").target.video === "n82XWvEa22Q");
check("a handle is the target of the earnings", C.intent("cuánto dinero gana @veritasium").who.handle === "@veritasium");
["how much does she make", "cuánto gana él", "cuánto gana este tipo", "how much does the guy make", "¿Cuánto gana este chico?", "cuánto gana ella"].forEach(t => check("a person on screen is the tab, never a channel search: " + t, (C.intent(t) || {}).who && C.intent(t).who.tab === true, C.intent(t)));
check("Spanish asks answer in Spanish", C.intent("cuánto gana este canal").lang === "es" && C.intent("how much does this channel earn").lang === "en");

const DAY = 86400000, NOW = Date.UTC(2026, 8, 27);
const videos = Array.from({ length: 30 }, (_, i) => ({ videoId: "v" + String(i).padStart(10, "0"), title: "The Roman Empire and its lost legions, part " + i, viewsNum: 40000 + i * 1000, published: i < 6 ? (i * 5 + 2) + " days ago" : (i - 4) + " months ago", length: "24:10" }));
const stats = { totalViews: 36000000, joinedDate: "2021-09-27", videoCount: 180 };
const earn = C.earnings({ channel: { name: "Rome Deep", handle: "@romedeep", url: "https://www.youtube.com/@romedeep", subs: 410000 }, videos, stats, language: "en", now: NOW }, "en");
const recentViews = videos.slice(0, 6).reduce((a, v) => a + v.viewsNum, 0);
const rpm = g.NspDineroRpm.proyeccion({ tema: videos.map(v => v.title).join(" . "), vistasMes: recentViews, duracionSegundos: 1450, idioma: "en" });
check("the recent floor counts only uploads of the last 30 days", earn.model.recentUploads === 6 && earn.model.recentViews === recentViews, earn.model);
check("it prices them at the niche RPM of the table", earn.model.rpmUsed === rpm.rpm && earn.model.niche === rpm.nombre && Math.round(rpm.usdMes) === earn.model.lowUsdMonth, { rpm: rpm.rpm, niche: rpm.nombre, low: earn.model.lowUsdMonth, usd: rpm.usdMes });
const months = (NOW - Date.parse("2021-09-27")) / (30.44 * DAY);
const life = g.NspDineroRpm.proyeccion({ tema: videos.map(v => v.title).join(" . "), vistasMes: 36000000 / months, duracionSegundos: 1450, idioma: "en" });
check("the lifetime average spreads every view over the months since it joined", earn.model.highUsdMonth === Math.round(life.usdMes) && earn.model.monthsActive === Math.round(months), { high: earn.model.highUsdMonth, life: life.usdMes });
check("the hero is the range and says it is an estimate", /^\$[\d,]+ to \$[\d,]+$/.test(earn.hero.value) && /estimated/.test(earn.hero.label) && earn.model.stamp === "ESTIMATE", earn.hero);
check("the math is on the card", earn.sections.find(s => s.id === "rate").rows.some(r => /per month/.test(r.value)));
check("it can be shared on X", earn.share && /With ZERACK, open source\.$/.test(earn.share.post));
const sparse = C.earnings({ channel: { name: "Quiet" }, videos: videos.map(v => Object.assign({}, v, { published: "2 years ago" })), stats: {}, now: NOW }, "es");
check("with no recent upload and no About figures it says not measured, in Spanish", sparse.hero.value === "Not measured" && /No pude ponerle número/.test(sparse.lead), sparse.lead);
const one = C.earnings({ channel: { name: "New" }, videos: videos.slice(0, 6), stats: {}, now: NOW }, "en");
check("with one way to count it gives one number", /^\$[\d,.]+$/.test(one.hero.value) && /makes about \$/.test(one.lead), one.hero);
const mixed = videos.map((v, i) => Object.assign({}, v, { title: i === 3 ? "How the rich invest their money" : v.title }));
const byAll = C.earnings({ channel: { name: "Rome Deep" }, videos: mixed, stats, language: "en", now: NOW }, "en");
const byVote = C.earnings({ channel: { name: "Rome Deep" }, videos: mixed, stats, language: "en", now: NOW, niche: { label: "Historia", name: "History", count: 29 } }, "en");
check("one finance title does not turn a history channel into finance when the niche is voted title by title", byAll.model.niche === "Finance" && byVote.model.niche === "History" && byVote.model.rpmUsed < byAll.model.rpmUsed && /29 of 30 uploads read as History/.test(byVote.sections.find(s => s.id === "rate").note), { all: byAll.model.niche, vote: byVote.model.niche });
{
  const T = g.NSP_RPM_TABLA;
  const spread = videos.map((v, i) => Object.assign({}, v, { title: i < 6 ? "AI agents and ChatGPT tricks, part " + i : (i < 8 ? "The physics of black holes and the universe " + i : "Weird stories people told me, episode " + i) }));
  const label = T.resolver(spread[0].title, {}).label;
  const vote = { label, name: T.nombreDe(label), count: 6, n: 30, mixed: true };
  const single = g.NspDineroRpm.proyeccion({ tema: spread.slice(0, 6).map(v => v.title).join(" . "), vistasMes: 1000, duracionSegundos: 1450, idioma: "en" });
  const m = C.earnings({ channel: { name: "Spread" }, videos: spread, stats, language: "en", now: NOW, niche: vote }, "en");
  check("a niche that holds 6 of 30 titles is not used to price the whole channel", m.model.rpmUsed < single.rpm && /mixed niche/.test(m.lead) && /holds only 6 of 30/.test(m.sections.find(s => s.id === "rate").note), { used: m.model.rpmUsed, single: single.rpm, lead: m.lead });
  const es = C.earnings({ channel: { name: "Spread" }, videos: spread, stats, language: "en", now: NOW, niche: vote }, "es");
  check("and in Spanish it says so too", /nicho mixto/.test(es.lead), es.lead);
}
check("ages parse to days", C.daysOf("3 weeks ago") === 21 && C.daysOf("2 days ago") === 2 && Math.round(C.daysOf("1 month ago")) === 30);

const chapters = C.parseChapters("0:00 The walls\n1:35 The guns\n(4:10) The chain\n12:05 - The last night\nnot a chapter");
check("chapter lines parse in the ways people write them", chapters.length === 4 && chapters[2].at === 250 && chapters[3].title === "The last night", chapters);
check("and print back as YouTube reads them", C.chapterLines(chapters) === "0:00 The walls\n1:35 The guns\n4:10 The chain\n12:05 The last night");
const desc = C.composeDescription("What happened in 1453.\n\nSources\n[1] Encyclopedia", chapters, "en");
check("the chapters go after the first paragraph of the description", desc === "What happened in 1453.\n\nChapters\n0:00 The walls\n1:35 The guns\n4:10 The chain\n12:05 The last night\n\nSources\n[1] Encyclopedia", desc);
check("old chapter lines are not doubled", C.composeDescription(desc, chapters, "en") === desc);
check("a clean package passes", C.check({ title: "The Night Constantinople Fell", description: desc, tags: ["history", "byzantium"], chapters }).ok);
const bad = C.check({ title: "x".repeat(101) + " <b>", description: "d".repeat(5001), tags: C.tagsOf(Array.from({ length: 30 }, (_, i) => "a long tag number " + i).join(",")), chapters: [{ at: 5, title: "A" }, { at: 9, title: "B" }] });
check("YouTube's limits are enforced with the reason", !bad.ok && bad.problems.length === 7 && bad.problems.some(p => /100/.test(p)) && bad.problems.some(p => /< and >/.test(p)) && bad.problems.some(p => /5000/.test(p)) && bad.problems.some(p => /500/.test(p)) && bad.problems.some(p => /3 or more/.test(p)) && bad.problems.some(p => /0:00/.test(p)) && bad.problems.some(p => /10 seconds/.test(p)), bad.problems);
check("tags with spaces count their quotes like Studio does", C.tagChars(["a b", "c"]) === 3 + 2 + 1 + 1);

const script = { title: "The Night Constantinople Fell", topic: "the fall of Constantinople", hook: [{ text: "On 29 May 1453 the city fell in one night." }, { text: "Nobody knows how its last emperor died." }], sections: [{ heading: "The siege", lines: [{ text: "The Theodosian Walls held against Mehmed II for weeks." }] }], chapters: [{ at: 0, title: "The siege", first: "The siege lasted 53 days." }, { at: 95, title: "The guns", first: "The guns fired stones of more than 500 kilograms." }, { at: 250, title: "The last night", first: "The final attack began on the night of 28 May." }], sources: [{ n: 1, title: "Fall of Constantinople", url: "https://en.example.org/wiki/Fall" }] };
const pkg = C.packFromScript(script, "en");
check("the package takes the title, the opening, the chapters and the sources from the script", pkg.title === script.title && /^On 29 May 1453/.test(pkg.description) && /Sources\n\[1\] Fall of Constantinople https:\/\/en\.example\.org/.test(pkg.description) && pkg.chapters.length === 3 && pkg.tags[0] === "fall of constantinople", pkg);
check("its tags are the topic and the names the script is about, never a filler word", pkg.tags.indexOf("theodosian walls") > 0 && pkg.tags.indexOf("mehmed ii") > 0 && !pkg.tags.some(x => /^(?:the|on|nobody|by)$/.test(x)) && C.tagChars(pkg.tags) <= 400, pkg.tags);
const flat = [];
let t = 0;
const said = "Welcome. The siege lasted 53 days and the walls held. Then the guns fired stones of more than 500 kilograms at the walls. Much later the final attack began on the night of 28 May and the city fell.".split(" ");
for (let k = 0; k < 200; k++) for (const w of said) { flat.push({ w, t0: +t.toFixed(2), t1: +(t + 0.3).toFixed(2) }); t += 0.4; }
const al = C.alignChapters(pkg.chapters, flat);
check("chapter times come from the video's own captions when it has them", al.ok && al.matched === 2 && al.chapters[0].at === 0 && al.chapters[1].at === Math.floor(flat[said.indexOf("guns") - 1].t0) && al.chapters[2].at > al.chapters[1].at, al.chapters.map(c => c.at));
check("and stay estimated when there are no captions", !C.alignChapters(pkg.chapters, []).ok);

const form = C.formCard(Object.assign({ chaptersEstimated: true }, pkg), "en", { from: "the sourced script" });
check("the package card is a form to review, with approve as its only action", form.form.op === "studio_approve" && form.form.submit === "Approve package" && form.form.fields.map(f => f.id).join() === "title,description,chapters,tags" && !form.actions);
check("the chapters field holds the times", form.form.fields[2].value.split("\n")[1] === "1:35 The guns");
check("it says what fill and save do and what is never touched", form.sections[0].rows.some(r => /never touched/.test(r.value)));
const approved = C.approvedCard(Object.assign({ approvedAt: NOW, description: desc, chapters }, pkg), "es");
check("the approved card offers Fill in Studio and says saving stays with the user", approved.actions[0].job.op === "studio_fill" && /Guardar sigue siendo cosa tuya/.test(approved.lead));
const filled = C.filledCard(pkg, { ok: true, title: true, description: true, tags: 4, timing: "captions", matched: 2, video: "abcdefghijk" }, "en");
check("the fill report says what went in and that nothing is saved", filled.hero.value === "Filled" && filled.sections[0].rows.some(r => r.label === "Saved" && /^No\./.test(r.value)) && /captions/.test(filled.sections[0].rows[3].value));
const failed = C.filledCard(pkg, { ok: false, error: "open the video in YouTube Studio (Details) first." }, "en");
check("a failed fill says why", failed.hero.value === "Not filled" && /Details/.test(failed.lead));
check("no long dash on any create card", !/\u2014/.test(JSON.stringify([earn, sparse, form, approved, filled, failed])));
void S;

done("create");
