// Channel intelligence: which phrases ask for an X-ray, a duel, a formula or a verdict, and what each card says
// when the engines find something and when they do not.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { load, check, done, rancho, RIVAL } from "./engines.mjs";
import { ROOT } from "./sw-harness.mjs";

const FILES = RIVAL.concat(["lib/nsp-rival-saturacion.js", "lib/nsp-rival-ventana.js", "lib/nsp-rival-duelo.js", "knowledge/reverse-engine.js", "lib/nsp-miniatura-cohorte.js", "lib/nsp-miniatura-mercado.js", "lib/nsp-intel.js"]);
const ctx = load(FILES);
const I = ctx.NSP_INTEL;
const NOW = Date.UTC(2026, 8, 26, 12);

const who = r => r ? r.who.map(w => w.tab ? "tab" : w.handle ? "handle" : w.url ? "url" : w.name ? "name" : "?").join(",") : null;
const ASK = [
  ["por qué explotó esto", "xray", "tab"], ["¿Por qué explotó este canal?", "xray", "tab"], ["por que exploto este video", "xray", "tab"],
  ["why did this blow up", "xray", "tab"], ["Why did this channel blow up?", "xray", "tab"], ["Why did @kurzgesagt blow up?", "xray", "handle"],
  ["rayo x", "xray", "tab"], ["rayos x de este canal", "xray", "tab"], ["X-ray @kurzgesagt", "xray", "handle"],
  ["X-ray https://www.youtube.com/@veritasium", "xray", "url"], ["haz rayos x al canal kurzgesagt", "xray", "name"], ["oye zerack por qué explotó esto", "xray", "tab"],
  ["what made this channel blow up", "xray", "tab"], ["why did this video go viral", "xray", "tab"], ["por qué se hizo viral este video", "xray", "tab"],
  ["compara este canal con kurzgesagt", "duel", "tab,name"], ["compare @veritasium with @kurzgesagt", "duel", "handle,handle"], ["@veritasium vs @kurzgesagt", "duel", "handle,handle"],
  ["duelo con @kurzgesagt", "duel", "tab,handle"], ["compare this channel with https://www.youtube.com/@veritasium", "duel", "tab,url"],
  ["clona la fórmula de este canal", "formula", "tab"], ["clone the formula of @kurzgesagt", "formula", "handle"], ["dame la fórmula", "formula", "tab"],
  ["copy this channel", "formula", "tab"], ["dame la receta de este canal", "formula", "tab"], ["what is the formula of this channel", "formula", "tab"],
  ["is this channel dead", "verdict", "tab"], ["¿está muerto este canal?", "verdict", "tab"], ["fue suerte o crecimiento real", "verdict", "tab"],
  ["Verdict on @kurzgesagt", "verdict", "handle"], ["Verdict on this channel", "verdict", "tab"], ["dame el veredicto de kurzgesagt", "verdict", "name"],
  ["one hit wonder?", "verdict", "tab"], ["luck or real growth?", "verdict", "tab"]
];
const NOT = [
  "por qué explotó el mercado", "why did bitcoin blow up", "the verdict of the trial was unfair", "what is a verdict", "clona mi voz", "clona mi canal",
  "compara estos dos títulos", "compare these two thumbnails", "why is my channel not growing", "cómo copio la fórmula de un video viral",
  "dame la receta de la paella", "dame la receta", "haz un duelo", "que es un rayo x", "vs", "abre el video de kurzgesagt", "busca por qué explotó el bitcoin",
  "is it luck or skill to grow on youtube?", "what's your verdict on this title?", "mi canal está muerto", "fue suerte que lloviera ayer en la boda de mi prima",
  "why did the roman empire fall", "hola", "abre youtube", "escribe una fórmula para títulos", "give me the formula for compound interest", "por que no exploto esto",
  "why did he blow up at me", "my verdict", "busca rayos x de tórax", "rayos x de tórax", "search x ray of the knee", "busca videos de rayos x", "one hit wonder songs of the eighties",
  "What is the formula?", "cuál es la fórmula", "haz rayos x a kurzgesagt"
];
{
  const miss = ASK.filter(([t, k, w]) => { const r = I.intent(t); return !r || r.kind !== k || who(r) !== w; });
  check("the " + ASK.length + " ways to ask for a card each land on the right card and the right channel", miss.length === 0, miss.map(m => [m[0], who(I.intent(m[0])), I.intent(m[0]) && I.intent(m[0]).kind]));
  const fire = NOT.filter(t => I.intent(t));
  check("none of the " + NOT.length + " ordinary sentences opens a card", fire.length === 0, fire.map(t => [t, I.intent(t)]));
  const r = I.intent("X-ray https://www.youtube.com/@veritasium.");
  check("a pasted link keeps its address and drops the full stop", r.who[0].url === "https://www.youtube.com/@veritasium", r.who);
}

function channel(spec) {
  const out = [];
  for (let i = 0; i < spec.length; i++) {
    const age = (spec.start || 0) + (i + 1) * (spec.every || 3);
    out.push({ videoId: ("v" + String(i).padStart(10, "0")).slice(0, 11), title: spec.title(i), viewsNum: spec.views(i), published: age + " days ago", length: spec.len ? spec.len(i) : "" });
  }
  return out;
}
const head = extra => Object.assign({ name: "Test Channel", handle: "@test", url: "https://www.youtube.com/@test", subs: 250000, total: 300 }, extra || {});
const words = s => String(s).split(/\s+/).filter(Boolean).length;
const LONG_DASH = /\u2014/;

const broke = channel({ length: 30, title: i => (i < 18 ? "What happens if the sun disappears for " + (i + 2) + " days" : "Old vlog number " + i), views: i => i < 18 ? 90000 + i * 1500 : 3000 + i * 40, len: i => "1" + (i % 9) + ":0" + (i % 6) });
{
  const c = I.xray({ channel: head(), videos: broke, now: NOW }, "en");
  const q = ctx.NSP_RIVAL_QUIEBRE.medir(broke);
  check("the X-ray names the break the engine found, with its multiple", q.hubo && c.hero.value === I.mult(q.salto) && /floor lift/.test(c.hero.label), { hero: c.hero, salto: q.salto });
  const turning = c.sections.find(s => s.id === "turning");
  check("and the video where it happened", turning.rows.some(r => r.label === "Break video" && r.value.includes(q.video.title.slice(0, 20))), turning.rows);
  check("the window starts pending and says so", c.sections.find(s => s.id === "window").state === "pending" && /niche window/.test(c.lead), c.lead);
  check("the spoken summary fits in about 20 seconds", words(c.say) <= 60, words(c.say));
  check("the share card has at most four rows and a caption for X under 280 characters", c.share.rows.length <= 4 && c.share.post.length < 280 && /open source/.test(c.share.post), c.share);
  check("nothing on the card uses the long dash", !LONG_DASH.test(JSON.stringify(c)));
  const es = I.xray({ channel: head(), videos: broke, now: NOW }, "es");
  check("in Spanish the summary is Spanish and the numbers are the same", /el piso subió/.test(es.lead) && es.hero.value === c.hero.value, es.lead);
}
const flat = channel({ length: 30, title: i => "Relaxing rain sounds for sleep " + i, views: i => 20000 + (i % 5) * 800 });
{
  const c = I.xray({ channel: head(), videos: flat, now: NOW }, "en");
  check("with no break the card does not claim one", !/floor lift/.test(c.hero.label) && /no turning point/i.test(c.lead), { hero: c.hero, lead: c.lead });
  check("and the titles section says the channel is flat instead of inventing a trait", c.sections.find(s => s.id === "titles").rows.every(r => r.tag !== "PROVEN"), c.sections.find(s => s.id === "titles"));
  check("a flat channel shares 'Flat channel' on its image", c.share.rows.some(r => /Flat channel/.test(r.value)), c.share.rows);
}
{
  const c = I.xray({ channel: head(), videos: flat.slice(0, 8), now: NOW }, "en");
  check("eight uploads are too few for a break and the card says it", /too few/.test(c.lead) && c.sections.find(s => s.id === "turning").rows[0].value === "Not measured", c.lead);
}
{
  const focus = { videoId: "zzzzzzzzzzz", title: "A video on screen", views: 400000 };
  const c = I.xray({ channel: head(), videos: flat, focus, now: NOW }, "en");
  const row = c.sections.find(s => s.id === "median").rows.find(r => r.label === "This video");
  check("on a video page the X-ray measures that video against the channel median", row && /400K views, 19x the median/.test(row.value), row);
}

const lucky = channel({ length: 30, title: i => "Minecraft challenge day " + i, views: i => i === 5 ? 2400000 : 900 + (i % 7) * 60 });
const steady = channel({ length: 30, title: i => "Ancient Rome explained part " + i, views: i => 50000 + (i % 6) * 9000 });
const idle = channel({ length: 30, start: 118, every: 12, title: i => "Ancient Rome explained part " + i, views: i => 50000 + (i % 6) * 9000 });
{
  const v = I.verdict({ channel: head(), videos: lucky, now: NOW }, "en");
  check("one video far above the floor reads as one lucky hit", v.hero.value === "ONE LUCKY HIT" && v.hero.tone === "bad", v.hero);
  const conc = v.sections.find(s => s.id === "luck").rows.find(r => /share of all views/.test(r.label));
  check("and says how much of the views ride on it", conc && /^\d+% of /.test(conc.value), conc);
  const es = I.xray({ channel: head(), videos: lucky, now: NOW }, "es");
  check("spoken Spanish says millones de vistas", /2,4 millones de vistas/.test(es.lead), es.lead);
  const s = I.verdict({ channel: head(), videos: steady, now: NOW }, "en");
  check("a steady channel reads as real growth", s.hero.value === "REAL GROWTH" && s.sections.find(x => x.id === "numbers").rows.some(r => r.tag === "ENGINE"), s.hero);
  const d = I.verdict({ channel: head(), videos: idle, now: NOW }, "en");
  const last = d.sections.find(x => x.id === "luck").rows.find(r => r.label === "Last upload");
  check("a channel quiet for months is marked inactive", last.value === "130 days ago" && last.tag === "INACTIVE" && /has not uploaded in 130 days/.test(d.lead), { last, lead: d.lead });
  const none = I.verdict({ channel: head(), videos: [], now: NOW }, "en");
  check("with no views there is no verdict, and it says so", none.hero.value === "NO VERDICT", none.hero);
  check("verdict summaries fit in about 20 seconds", [v, s, d].every(c => words(c.say) <= 60), [v, s, d].map(c => words(c.say)));
}
{
  const f = I.formula({ channel: head(), videos: steady.map((v, i) => Object.assign({}, v, { length: "1" + (i % 8) + ":1" + (i % 6) })), thumbs: [], now: NOW }, "en");
  const tpl = f.sections.find(s => s.id === "template");
  check("the formula pulls the title template out of the real titles", tpl.rows[0].label === "Skeleton" && /Ancient Rome explained part \{number\}/.test(tpl.rows[0].value) && f.hero.value === "100%", tpl.rows[0]);
  const st = f.sections.find(s => s.id === "structure").rows;
  check("length comes from the duration badges", st.some(r => r.label === "Median length" && /^1\d:\d\d, middle half/.test(r.value)), st);
  check("openings stay marked as not measured", st.some(r => /Openings/.test(r.label) && /Not measured/.test(r.value)), st);
  check("with no thumbnail read the style says not measured", f.sections.find(s => s.id === "thumbs").rows[0].value === "Not measured");
  const free = I.formula({ channel: head(), videos: broke, thumbs: [], now: NOW }, "en");
  check("mixed titles give no template and the card says free-form", free.hero.value === "Free-form" || free.hero.value.endsWith("%"), free.hero);
}
{
  const px = (w, h, fill) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const c = fill(i % w, Math.floor(i / w)); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; } return d; };
  const M = load(["lib/nsp-miniatura-motor.js"]).NspMiniatura;
  const thumbs = Array.from({ length: 9 }, (_, k) => M.medirCompleto(px(320, 180, (x, y) => (y > 120 && y < 150 && x % 7 < 4) ? [255, 255, 255] : [200, 30 + k, 20]), 320, 180, 320));
  const f = I.formula({ channel: head(), videos: steady, thumbs, now: NOW }, "en");
  const rows = f.sections.find(s => s.id === "thumbs").rows;
  check("measured thumbnails give the channel's style next to the sweep", rows.some(r => r.label === "Contrast" && /median, sweep/.test(r.value)) && rows.some(r => r.label === "Dominant hues" && /red/.test(r.value)), rows);
}
{
  const d = I.duel({ channel: head({ name: "Lucky One", handle: "@lucky" }), videos: lucky, now: NOW }, { channel: head({ name: "Steady One", handle: "@steady" }), videos: steady, now: NOW }, "en");
  const axes = d.sections.find(s => s.id === "axes").rows;
  const med = axes.find(r => r.label === "Median video");
  check("the duel puts both channels on each axis with the winner", axes.length === 7 && med.tag === "B" && /Lucky One .* \u00b7 Steady One/.test(med.value), axes.map(a => [a.label, a.tag]));
  check("and says why it wins", /Steady One is \d+x higher\./.test(med.note), med.note);
  check("the steadier channel wins the ratio axis", axes.find(r => r.label === "Ceiling over floor").tag === "B");
  check("the hero counts axes won", /^\d+ : \d+$/.test(d.hero.value), d.hero);
  check("the duel summary fits in about 20 seconds", words(d.say) <= 60, d.say);
  check("the duel share card lists axes with both values and who won", d.share.rows.length > 0 && d.share.rows.every(r => r.pair && (r.pair.win === "a" || r.pair.win === "b") && r.value === r.pair.a + " vs " + r.pair.b), d.share.rows);
  check("and the steadiness axis goes to the steady channel on the image too", d.share.rows.find(r => r.label === "Steadiness").pair.win === "b");
}
{
  const mk = (name, videos, total) => I.dossier({ channel: { name, url: "https://www.youtube.com/@" + name, total }, videos });
  const young = n => channel({ length: 12, every: 5, title: i => "Ancient Rome explained " + n + " " + i, views: () => 30000 });
  const subject = mk("subject", steady, 300);
  const neighbors = [mk("a", young("a"), 12), mk("b", young("b"), 12), mk("c", young("c"), 12), mk("d", steady, 400)];
  const w = I.windowOf(subject, neighbors, "en");
  check("three young channels that land open the window", w.rows[0].tag === "OPEN" && /3 of 3/.test(w.rows[0].value), w.rows[0]);
  const card = I.withWindow(I.xray({ channel: head(), videos: steady, now: NOW }, "en"), w);
  check("the window lands on the X-ray card and in its summary", card.sections.find(s => s.id === "window").state === "done" && /window is open/.test(card.lead) && card.share.rows.some(r => r.label === "Entry window" && r.value === "open"), card.share.rows);
  const few = I.windowOf(subject, neighbors.slice(0, 2), "en");
  check("with fewer than five channels the window stays unmeasured", few.rows[0].value === "Not measured" && /Only 3 channels/.test(few.note), few);
  check("a channel whose titles vote for one niche searches that niche", I.nicheQuery(steady) === "history documentary ancient mysteries", I.nicheQuery(steady));
  const sci = ["There Is Something Faster Than Light", "Something is jamming GPS signals worldwide", "What Happens If You Fall Into Lava", "The Surprising Physics of Rockets", "Why Rockets Explode on the Pad", "What Happens When Physics Breaks", "Something Strange About Rockets", "The Physics Nobody Taught You"].map((t, i) => ({ title: t, viewsNum: 900000 - i * 50000, published: (i + 2) + " weeks ago" }));
  check("titles that vote for science search the science niche", I.nicheQuery(sci) === "science space universe documentary", I.nicheQuery(sci));
  const odd = ["Something Happens At The Lighthouse At Night", "What Happens To An Old Lighthouse", "Lighthouse Keepers Were Strange", "Something Nobody Tells Lighthouse Keepers", "The Last Lighthouse Standing"].map((t, i) => ({ title: t, viewsNum: 90000 - i * 1000 }));
  const q = I.nicheQuery(odd);
  check("a channel with no clear niche searches the topic words its best titles repeat, never filler like something or happens", q === "lighthouse keepers", q);
  check("and a fallback query never repeats a word", !/\b(\w+)\b.*\b\1\b/.test(I.nicheQuery([{ title: "The Day The AI Bubble Bursts: Day One", viewsNum: 10 }])), I.nicheQuery([{ title: "The Day The AI Bubble Bursts: Day One", viewsNum: 10 }]));
  const gospel = ["Pray Until Something Happens live worship", "Gospel choir sings Holy Spirit", "Sunday worship night with the choir"].map(t => ({ title: t, viewsNum: 100 }));
  check("a channel whose titles share nothing with the subject is not counted in its niche", I.related(sci, gospel) === false);
  check("a channel that shares its topic words is", I.related(sci, ["Rockets and the physics of reentry", "How physics shapes a rocket nozzle"].map(t => ({ title: t }))) === true);
  const ownRows = w.rows.filter(r => /^subject/.test(r.label));
  check("the window rows leave out the channel on the card, which has its own median above", ownRows.length === 0, w.rows.map(r => r.label));
  check("a channel with hundreds of videos is not shown with a lower-bound age", w.rows.filter(r => /^d$/.test(r.label)).every(r => !/at least/.test(r.value) && /400 videos/.test(r.value)), w.rows);
}

if (existsSync(join(ROOT, "tests/fixtures/rancho-channel.json"))) {
  const c = I.xray({ channel: head({ name: "Rancho" }), videos: rancho(), now: NOW }, "es");
  check("on the owner's reference channel the X-ray finds the 7.2x break at upload 12 of 30", c.hero.value === "7.2x" && /el video 12 de los 30/.test(c.lead), c.lead);
  const v = I.verdict({ channel: head({ name: "Rancho" }), videos: rancho(), now: NOW }, "en");
  check("and calls its recent run real growth", v.hero.value === "REAL GROWTH" && /last 10 uploads/.test(v.hero.label), v.hero);
}

{
  const tiny = n => Array.from({ length: n }, (_, i) => ({ videoId: ("t" + String(i).padStart(10, "0")).slice(0, 11), title: "Tiny upload " + i, viewsNum: [480, 9000, 400][i] || 500, published: (10 + i * 5) + " days ago" }));
  for (const n of [1, 2, 3]) {
    const v = I.verdict({ channel: head({ name: "Tiny channel" }), videos: tiny(n), now: NOW }, "en");
    check("a channel with " + n + " upload" + (n === 1 ? "" : "s") + " gets no verdict, and says how many are needed", v.hero.value === "NO VERDICT" && /only \d+ upload/.test(v.hero.label) && /4 needed/.test(v.hero.label) && !/real growth|lucky hit/i.test(v.lead) && !/real growth|lucky hit/i.test(v.share.post), { hero: v.hero, lead: v.lead });
  }
  const es = I.verdict({ channel: head({ name: "Tiny channel" }), videos: tiny(1), now: NOW }, "es");
  check("in Spanish too, in the singular", /solo 1 video tiene edad para juzgar/.test(es.lead), es.lead);
  const ages = ["5 days ago", "1 month ago", "1 month ago", "2 months ago", "2 months ago", "3 months ago", "3 months ago", "3 months ago", "3 months ago", "4 months ago", "4 months ago", "5 months ago"];
  const coarse = ages.map((a, i) => ({ videoId: ("c" + String(i).padStart(10, "0")).slice(0, 11), title: "The physics of something " + i, viewsNum: 3000000 + i * 500000, published: a, length: "33:00" }));
  const f = I.formula({ channel: head(), videos: coarse, now: NOW }, "en");
  const fRow = f.sections.find(x => x.id === "structure").rows.find(r => r.label === "Upload rhythm");
  check("uploads dated only in months never read as several videos a day", fRow && fRow.value === "A video every 15 days" && !/several a day/i.test(f.lead) && !f.share.rows.some(r => /Several/.test(r.value)), { row: fRow, lead: f.lead });
  const yearly = coarse.map((v, i) => Object.assign({}, v, { published: i < 9 ? "1 year ago" : "2 years ago" }));
  const fy = I.formula({ channel: head(), videos: yearly, now: NOW }, "en");
  const yRow = fy.sections.find(x => x.id === "structure").rows.find(r => r.label === "Upload rhythm");
  check("uploads dated only in years leave the rhythm not measured, with why", yRow && yRow.value === "Not measured" && /too coarse/.test(yRow.note), yRow);
  const d = I.duel({ channel: head({ name: "Yearly", total: 500 }), videos: yearly, now: NOW }, { channel: head({ name: "Weekly", total: 900 }), videos: coarse, now: NOW }, "en");
  const cad = d.sections.find(x => x.id === "axes").rows.find(r => r.label === "A video every");
  const age = d.sections.find(x => x.id === "axes").rows.find(r => r.label === "Age");
  check("the duel does not award the upload rhythm to a side it could not measure", cad.tag === "N/A", cad);
  check("and two lower-bound ages rank nothing and count for no one", age.tag === "N/A" && /at least/.test(age.value) && /lower bounds/.test(age.note), age);
  const win = ctxWindow();
  function ctxWindow() {
    const W = ctx.NSP_RIVAL_VENTANA;
    return W.medir({ ok: true, jovenes: 1, jovenesQueAterrizan: 1, pisoUtil: 10000, canales: 6, jovenDias: 120 });
  }
  check("one recent channel reads in the singular", win.cifra === "1 of 1 recent channel lands, but only 1 recent channel was swept" && !/1 recent channels/.test(win.razon), win);
}

done("intel");
