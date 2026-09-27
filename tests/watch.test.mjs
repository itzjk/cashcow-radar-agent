// Watch and predict, composed from measured numbers: what the requests route to, the outlier rule against the
// channel median, the morning brief, sealed predictions with their hash chain and evidence meter, the language
// gaps from stored titles, and the comment requests turned into a card.
import { load, check, done } from "./engines.mjs";
import { webcrypto } from "node:crypto";

const g = load(["lib/nsp-rpm-tabla.js", "lib/nsp-cadencia.js", "lib/nsp-intel.js", "lib/nsp-markets.js", "lib/nsp-watch.js"]);
const W = g.NSP_WATCH, T = g.NSP_RPM_TABLA;

const ROUTES = [
  ["Morning brief", "brief", "now"], ["show me my morning brief", "brief", "now"], ["dame el resumen de la mañana", "brief", "now"], ["what did my competitors do last night", "brief", "now"],
  ["qué hicieron mis competidores anoche", "brief", "now"], ["turn on the morning brief at 7", "brief", "on"], ["activa el resumen de la mañana a las 8", "brief", "on"],
  ["turn off the morning brief", "brief", "off"], ["apaga el resumen diario", "brief", "off"], ["Morning brief settings", "brief", "state"],
  ["watch this channel", "watch", "add"], ["vigila este canal", "watch", "add"], ["watch @kurzgesagt", "watch", "add"], ["alert me when this channel posts an outlier", "watch", "add"],
  ["avísame cuando este canal saque un bombazo", "watch", "add"], ["stop watching this channel", "watch", "remove"], ["deja de vigilar este canal", "watch", "remove"],
  ["which channels am I watching", "watch", "list"], ["canales vigilados", "watch", "list"],
  ["Show my predictions", "predict", "show"], ["predicciones", "predict", "show"], ["how are my predictions doing", "predict", "show"], ["cómo van mis predicciones", "predict", "show"],
  ["seal today's predictions", "predict", "seal"], ["sella las predicciones de hoy", "predict", "seal"], ["export my predictions as json", "predict", "export"],
  ["Language arbitrage", "arb", ""], ["arbitraje de idiomas", "arb", ""], ["language gaps in german", "arb", "de"], ["what wins in english but is missing in spanish", "arb", "es"],
  ["qué nichos ganan en inglés y faltan en portugués", "arb", "pt"],
  ["what are the comments asking for", "comments", ""], ["ideas from the comments", "comments", ""], ["read me the comments", "comments", ""], ["qué piden los comentarios", "comments", ""],
  ["léeme los comentarios", "comments", ""], ["ideas de los comentarios", "comments", ""], ["what do my viewers want", "comments", ""], ["qué dice mi audiencia", "comments", ""]
];
const NOT = ["make it brief", "be brief", "the brief was short", "watch a movie", "I watch this channel every day", "watch out", "vigila tu lenguaje", "my predictions for the election",
  "predict the weather", "what are predictions", "read the room", "how do I get more comments", "why are my comments turned off", "los comentarios son tóxicos", "ideas for a video about rome",
  "language learning channels", "what language is this", "english or spanish", "turn on the agent", "abre youtube", "resumen", "brief me on rome", "watch this channel grow", "stop watching tv",
  "the arbitrage was wrong", "comment on this video", "should I turn off comments", "what's the morning routine of successful creators"];
{
  const miss = ROUTES.filter(([t, k, op]) => { const r = W.intent(t); return !r || r.kind !== k || (k === "arb" ? (r.target || "") !== op : (op && r.op !== op)); });
  check("every watch request routes to its card", miss.length === 0, miss.map(([t, k, op]) => [t, k, op, W.intent(t)]));
  const loose = NOT.filter(t => W.intent(t));
  check("and sentences that are not a request stay out", loose.length === 0, loose.map(t => [t, W.intent(t)]));
  check("the brief hour is read, with pm and in words", W.intent("turn on the morning brief at 7").hour === 7 && W.intent("turn on the daily brief at 6 pm").hour === 18 && W.intent("activa el resumen de la mañana a las 8").hour === 8 && W.intent("activa el resumen de la mañana a las siete").hour === 7 && W.intent("turn on the morning brief at eight").hour === 8);
  check("a brief without an hour leaves it to the saved one", W.intent("turn on the morning brief").hour === null);
  check("requests speak the language of the user", W.intent("dame el resumen de la mañana").lang === "es" && W.intent("Morning brief").lang === "en" && W.intent("qué piden los comentarios").lang === "es");
  const h = W.intent("watch @kurzgesagt");
  check("a named channel is the one watched", h.who && h.who.handle === "@kurzgesagt", h);
  check("this channel means the tab", W.intent("watch this channel").who.tab === true);
  check("my comments means the user's own channel", W.intent("what do my viewers want").who.mine === true && W.intent("ideas from the comments").who.tab === true);
  const link = W.intent("ideas from the comments of https://www.youtube.com/watch?v=abcdefghijk");
  check("a video link is the video read", link && link.who && /watch\?v=abcdefghijk/.test(link.who.url), link);
}

const HOUR = 3600000, DAY = 86400000;
function up(i, views, hours, title) { return { videoId: ("v" + String(i).padStart(10, "0")).slice(0, 11), title: title || "Upload " + i, viewsNum: views, hours }; }
{
  const older = Array.from({ length: 20 }, (_, i) => up(i + 10, 10000 + i * 100, 200 + i * 24));
  const fresh = [up(1, 62000, 20, "The one that broke out"), up(2, 12000, 30), up(3, 49000, 50, "Almost there")];
  const o = W.outliers({ videos: fresh.concat(older), baseline: older.map(v => v.videoId), now: Date.now() });
  check("the median comes from uploads older than a week", o.ok && o.basisKind === "older" && o.basis === 20 && o.median === 10950, o);
  check("an upload at 5x the median is an outlier", o.hits.length === 1 && o.hits[0].title === "The one that broke out" && Math.abs(o.hits[0].multiple - 62000 / 10950) < 1e-9, o.hits);
  check("one at 4.5x is watched, not alerted", o.rows.some(r => r.title === "Almost there" && !r.outlier));
  const again = W.outliers({ videos: fresh.concat(older), baseline: older.map(v => v.videoId), alerted: [fresh[0].videoId] });
  check("an upload alerts once", again.hits.length === 0 && again.rows[0].alerted === true);
  const base = W.outliers({ videos: fresh.concat(older), baseline: fresh.concat(older).map(v => v.videoId) });
  check("what the baseline already held never alerts", base.hits.length === 0 && base.rows.length === 0);
  const small = W.outliers({ videos: [up(1, 2500, 48)].concat(Array.from({ length: 12 }, (_, i) => up(i + 5, 500, 300 + i * 30))), baseline: [] });
  check("a small channel at 5x its median alerts, whatever the views per hour", small.hits.length === 1 && small.median === 500, small);
  const big = W.outliers({ videos: [up(1, 15000, 48)].concat(Array.from({ length: 12 }, (_, i) => up(i + 5, 300000, 300 + i * 30))), baseline: [] });
  check("a big channel at a fraction of its median does not", big.hits.length === 0 && big.ok, big.rows);
  const young = W.outliers({ videos: [up(1, 900, 10), up(2, 100, 30), up(3, 110, 60), up(4, 90, 80), up(5, 120, 100), up(6, 100, 120), up(7, 95, 150)], baseline: [up(2).videoId, up(3).videoId, up(4).videoId, up(5).videoId, up(6).videoId, up(7).videoId] });
  check("a channel with no upload older than a week uses its other uploads", young.ok && young.basisKind === "others" && young.hits.length === 1, young);
  const tiny = W.outliers({ videos: [up(1, 900, 10), up(2, 100, 300)], baseline: [] });
  check("too few uploads is said, not guessed", tiny.ok === false && /Only 1 uploads/.test(tiny.reason), tiny);
  const aged = W.outliers({ videos: [up(1, 100, 400)].concat(older), baseline: older.map(v => v.videoId) });
  check("an upload older than a week leaves the watch and joins the baseline", aged.aged.length === 1 && aged.rows.length === 0, aged.aged);
  const txt = W.alertText({ name: "History Deep" }, o.hits[0], o.median, "en");
  check("the notification names the channel, the multiple, the views, the age and the median", /History Deep: an outlier at 5\.7x its median/.test(txt.title) && /62K views after 20 hours/.test(txt.message) && /median is 10K/.test(txt.message), txt);
}

{
  const at = new Date(2026, 8, 26, 22, 10).getTime();
  const next = W.nextAt(7, at);
  check("the next brief is the coming 07:00", new Date(next).getHours() === 7 && next > at && next - at < DAY, new Date(next).toString());
  const early = new Date(2026, 8, 27, 6, 0).getTime();
  check("before the hour it is the same day", new Date(W.nextAt(7, early)).getDate() === 27);
}

{
  const now = Date.now();
  const ch = (name, rows, median, lastDays, ok = true) => ({ name, url: "https://www.youtube.com/@" + name.replace(/\s/g, ""), ok, median, rows, lastDays, error: ok ? "" : "timeout" });
  const card = W.briefCard({
    now, windowHours: 24,
    channels: [
      ch("History Deep", [{ videoId: "aaaaaaaaaaa", title: "The legion that vanished", views: 70000, hours: 9, multiple: 7 }, { videoId: "bbbbbbbbbbb", title: "Rome at night", views: 9000, hours: 20, multiple: 0.9 }], 10000, 0),
      ch("Quiet Sleep", [], 3000, 45),
      ch("Broken", [], null, null, false)
    ],
    niches: [{ label: "Historia", name: "History", ok: true, count: 14, medianVph: 320, prevMedianVph: 200, top: { videoId: "ccccccccccc", title: "Ancient Rome explained", vph: 2400, channel: "X" } }],
    alerts: [{ name: "History Deep", channelUrl: "https://www.youtube.com/@HistoryDeep", videoId: "aaaaaaaaaaa", title: "The legion that vanished", views: 52000, multiple: 5.2, hours: 5, median: 10000 }],
    predictions: { settled: 1, picks: 10, pickHits: 3, controls: 10, controlHits: 1 }
  }, "en");
  check("the brief counts one outlier even when the alarm already saw it, with the newest figure", card.hero.value === "1" && card.sections[0].rows.length === 1 && card.sections[0].rows[0].tag === "7x", card.sections[0]);
  check("it says the watched channels, the silent one and the one it could not read", card.sections[1].rows.length === 3 && /Silent: no upload in 45 days/.test(card.sections[1].rows[1].value) && /Could not be read/.test(card.sections[1].rows[2].value), card.sections[1].rows);
  check("a niche rising against the last brief is tagged", card.sections[2].rows[0].tag === "RISING" && /up from 200/.test(card.sections[2].rows[0].value), card.sections[2].rows);
  check("the lead reads like a brief", /^Morning brief: one outlier\. History Deep has "The legion that vanished" at 7 times its median\. 2 new uploads across 3 watched channels\. History is rising/.test(card.lead), card.lead);
  check("settled predictions ride along", card.sections.some(s => s.id === "predictions"));
  check("no model wrote it, and it says so", /No AI model/.test(card.source));
  check("the spoken brief stays short", card.say.split(" ").length <= 60, card.say);
  const es = W.briefCard({ now, channels: [ch("A", [], 1000, 2)], niches: [] }, "es");
  check("in Spanish too", /^Resumen de la mañana: noche tranquila/.test(es.lead), es.lead);
  const empty = W.briefCard({ now, channels: [], niches: [] }, "en");
  check("with nothing watched it says what to do", /Nothing to brief yet/.test(empty.lead) && /watch this channel/.test(JSON.stringify(empty.sections[1])));
  const st = W.briefState({ on: true, hour: 7, channels: 3, niches: 2, next: now + HOUR }, "en");
  check("the settings card offers other hours and a switch", st.hero.value === "On" && st.actions.some(a => a.job.op === "brief_off") && st.actions.some(a => a.job.op === "brief_on" && a.job.hour === 8));
}

{
  const now = Date.parse("2026-09-26T04:00:00Z");
  const s = W.scoreOf({ totalViews: 100000, videos: [{ viewsNum: 30000, hours: 50 }, { viewsNum: 25000, hours: 300 }, { viewsNum: 40000, hours: 400 }] });
  check("the score is the share of all views the last 14 days of uploads hold", s.recent === 55000 && Math.abs(s.score - 0.55) < 1e-9 && s.recentUploads === 2, s);
  check("a channel's age comes from its joined date", W.ageDays("2026-03-01", now) === 209 && W.ageDays("", now) === null);
  const scored = Array.from({ length: 30 }, (_, i) => ({ id: "UC" + String(i).padStart(22, "x"), name: "C" + i, url: "https://www.youtube.com/channel/UC" + String(i).padStart(22, "x"), views: 10000 + i, recent: 1000 * i, score: i / 30, ageDays: i < 28 ? 100 : 900 }));
  let seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const p = W.pick(scored, rand);
  check("only young channels are eligible", p.eligible === 28);
  check("picks are the young channels at a doubling pace, best first", p.picks.length === 13 - 0 - 3 && p.picks.every(x => x.score >= 0.5 && x.ageDays <= 365) && p.picks[0].score > p.picks[9].score, p.picks.map(x => x.score));
  check("controls come from the same pool and never repeat a pick", p.controls.length === 10 && p.controls.every(c => !p.picks.some(x => x.id === c.id) && c.ageDays <= 365));
  const sealed = W.sealable({ now, pool: 28, read: 30, picks: p.picks, controls: p.controls, prev: "" });
  check("a sealed batch states the claim, the rule and the due date", sealed.dueAt === "2026-10-10T04:00:00.000Z" && /twice its total channel views within 14 days/.test(sealed.claim) && sealed.picks.length === 10);
  const c1 = W.canonical(sealed), c2 = W.canonical(JSON.parse(JSON.stringify(sealed)));
  check("the canonical form does not depend on key order", c1 === c2 && c1 === W.canonical(Object.fromEntries(Object.entries(sealed).reverse())));
  const hash = Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(c1))).toString("hex");
  check("and hashes to a SHA-256 anyone can recompute", /^[0-9a-f]{64}$/.test(hash));
  const batch = { hash, sealed };
  const readings = sealed.picks.map((e, i) => ({ id: e.id, ok: i !== 9, views: i < 4 ? e.views * 2 + 1 : e.views + 10 })).concat(sealed.controls.map((e, i) => ({ id: e.id, ok: true, views: i === 0 ? e.views * 3 : e.views })));
  const settled = W.settleOf(batch, readings, now + 14 * DAY);
  check("settling marks a channel that doubled as a hit", settled.picks.hits === 4 && settled.picks.n === 9 && settled.picks.gone === 1 && settled.controls.hits === 1 && settled.controls.n === 10, settled);
  check("an unreadable channel is left out of both counts, not scored a miss", settled.picks.rows[9].gone === true && settled.picks.rows[9].hit === false);
  check("Fisher gives the textbook one-sided value", Math.abs(W.fisher(4, 9, 1, 10) - 0.1192) < 0.0005 && W.fisher(0, 10, 5, 10) > 0.99 && W.fisher(10, 10, 0, 10) < 0.0001, [W.fisher(4, 9, 1, 10)]);
  const ledger = { batches: [Object.assign({ settled }, batch)] };
  const ev = W.evidence(ledger, "en");
  check("one settled batch is too little data, whatever the gap", ev.key === "thin" && ev.level === 1 && ev.picks.hits === 4, ev);
  const many = { batches: [0, 1, 2].map(k => ({ hash: "h" + k, sealed, settled: { at: "", picks: { n: 10, hits: 5, gone: 0, rows: [] }, controls: { n: 10, hits: 1, gone: 0, rows: [] } } })) };
  const ev3 = W.evidence(many, "en");
  check("with 30 settled a side and 50 against 10 percent, the edge is strong", ev3.key === "strong" && ev3.level === 5 && ev3.p < 0.01, ev3);
  const flat = { batches: [0, 1, 2].map(k => ({ hash: "h" + k, sealed, settled: { at: "", picks: { n: 10, hits: 2, gone: 0, rows: [] }, controls: { n: 10, hits: 2, gone: 0, rows: [] } } })) };
  check("picks that only tie the controls show no edge", W.evidence(flat, "en").key === "noedge");
  const card = W.predictCard(ledger, "en", now + 15 * DAY);
  check("the card carries the meter, the settled table and the rule", card.sections[0].meter.level === 1 && card.sections[0].meter.label === "Too little data" && card.sections.some(s => s.id === "settled" && s.table.rows.length === 20) && card.sections.some(s => s.id === "rule"));
  check("it offers today's seal, the export and the daily switch", card.actions.map(a => a.job.op).join(",") === "predict_seal,predict_export,predict_daily", card.actions);
  check("the share image says picks against controls, never a bare hit rate", /44% vs 10%/.test(card.share.hero.value) && /random controls/.test(card.share.hero.label) && /controls/.test(card.share.post), card.share);
  const fresh = W.predictCard({ batches: [{ hash, sealed }] }, "en", now + HOUR, { sealedNow: sealed });
  check("a fresh seal says when it settles, once", /^Sealed 10 picks and 10 controls from 28 young channels\. They settle on 10 Oct\.$/.test(fresh.lead) && !fresh.actions.some(a => a.job.op === "predict_seal"), fresh.lead);
  const exp = W.exportOf(ledger, now);
  check("the export explains how to verify each hash", exp.batches[0].sha256 === hash && /canonical/.test(exp.verify) && exp.evidence.picks.hits === 4);
  const none = W.predictCard({ batches: [] }, "es", now);
  check("with no batch it says so and offers to seal", /Todavía no hay predicciones/.test(none.lead) && none.actions[0].job.op === "predict_seal" && !none.share);
}

{
  const recs = [];
  let k = 0;
  const add = (lang, n, title, vph) => { for (let i = 0; i < n; i++) recs.push({ title: title + " " + i, vph, lang, videoId: "id" + (k++) }); };
  add("en", 12, "Ancient history documentary of the empire", 900);
  add("en", 10, "Sleep story for deep sleep", 300);
  add("en", 60, "Funny prank compilation", 250);
  add("es", 1, "Historia del imperio antiguo", 200);
  add("es", 20, "Historias para dormir y relajarse", 120);
  add("es", 50, "Broma graciosa compilación", 100);
  add("de", 30, "Geschichte des alten Reiches", 50);
  const card = W.arbitrage({ records: recs, sources: { corpus: 40, feed: 143 } }, "en");
  const es = card.sections.find(s => s.id === "lang-es");
  check("history wins in English at over 1.2x the English median", card.sections[0].rows[0].label === "History" && /12 uploads at 3.6x/.test(card.sections[0].rows[0].value), card.sections[0].rows);
  check("and is missing in Spanish with 1 upload of 71", es.rows.some(r => r.label === "History" && r.tag === "MISSING" && /Only 1 Spanish upload of 71/.test(r.value)), es.rows);
  check("a missing niche carries the reference RPM of that market as an estimate", es.rows.find(r => r.label === "History").note.includes("$2.88") && /estimate/.test(es.rows.find(r => r.label === "History").note));
  check("German with 30 titles is refused with the reason", card.sections.find(s => s.id === "lang-de").rows[0].label === "Not judged" && /Only 30 German uploads/.test(card.sections.find(s => s.id === "lang-de").rows[0].value));
  check("the refused markets are offered a measurement", card.actions[0].job.op === "arb_measure" && card.actions[0].job.langs.join() === "de,pt", card.actions);
  check("the lead names the gap and the counts behind it", /^Measured from 183 titles: 82 English, 71 Spanish, 30 German, 0 Portuguese\. History wins in English and is missing in Spanish\./.test(card.lead), card.lead);
  const thin = W.arbitrage({ records: recs.filter(r => r.lang !== "en").concat(recs.filter(r => r.lang === "en").slice(0, 20)) }, "es");
  check("with under 60 English titles it refuses in Spanish too, with the counts in Spanish", thin.hero.value === "Too little data" && /Muy pocos datos/.test(thin.lead) && /20 inglés, 71 español, 30 alemán, 0 portugués/.test(thin.lead), thin.lead);
  const guessed = W.arbitrage({ records: [{ title: "Top 10 facts", vph: 100 }, { title: "La historia de los romanos y el imperio", vph: 50 }] }, "en");
  check("an unmarked title is left out instead of being called English", guessed.model.pools.en === 0 && guessed.model.pools.es === 1 && /1 titles with no clear language/.test(guessed.source), guessed.model);
}

{
  check("asks are found in four languages", ["Can you make a video about the Aztecs?", "please do one on Byzantium", "Part 2 please!!", "haz un video de los mayas por favor", "me encantaría ver uno sobre Roma", "bitte mehr Videos über Rom", "faz um video sobre o Brasil"].every(t => W.asks(t)));
  check("and praise is not an ask", !["Great video, thanks!", "Me encantó", "I watched this twice", "Can't believe this is real", "¿Alguien en 2026?", "who else is here after the trailer"].some(t => W.asks(t)));
  const REAL_ASKS = ["What about the plants, charts, and other drawings?", "How about one of the older Hebrew encryptions?", "They should try to translate it using music notes and see what happens", "i'm way more interested in the illustrations.  Going to look for a video about them!", "¿Y qué tal un video sobre los mayas?", "Deberías hacer uno sobre Egipto", "Was ist mit den Pyramiden?"];
  const REAL_NOT = ["What if it's numbers. What if it's more like source code?", "Is there way to obtain a copy of the entire document?", "I wonder, what is the music playing in the middle of the video?", "This doesn't indicate what, if anything, GROK contributed", "Why are we acting like AI isn't just a better google search?", "The comments just saved me 16:45. Thanks, y'all!", "what about it"];
  check("real asks read from a Voynich video's comments are found", REAL_ASKS.every(t => W.asks(t)), REAL_ASKS.filter(t => !W.asks(t)));
  check("while its theories, questions and jokes are not", !REAL_NOT.some(t => W.asks(t)), REAL_NOT.filter(t => W.asks(t)));
  const d = W.digest([{ text: "Can you make a video about the Aztecs?", likes: 1200 }, { text: "Great video", likes: 5000 }, { text: "Part 2 please", likes: 300 }, { text: "Why is this so good?", likes: 2 }, { text: "", likes: 9 }]);
  check("the digest counts, sorts by likes and skips empty comments", d.read === 4 && d.asks === 2 && d.requests[0].likes === 1200 && d.questions === 1, d);
  const card = W.commentsCard({ video: { id: "abcdefghijk", title: "The fall of Rome", channel: "History Deep" }, digest: d, ai: { ok: true, by: "your local model", result: { ideas: [{ title: "The Aztec Empire in 30 minutes", answers: "a video about the Aztecs", comments: 1 }, { title: "The fall of Rome, part 2", answers: "part 2", comments: 1 }, { title: "Byzantium", answers: "", comments: 0 }], sentiment: { positive: 3, neutral: 1, negative: 0 }, summary: "They want more empires." } }, pages: 1 }, "en");
  check("the card leads with what the audience asks", card.hero.value === "2 of 4" && /^2 of the 4 comments read ask for something\. The most liked ask: "Can you make a video about the Aztecs\?"\. Three ideas: 1, The Aztec Empire in 30 minutes/.test(card.lead), card.lead);
  check("the ideas come with what they answer and a copy button", card.sections[0].rows.length === 3 && /Answers: a video about the Aztecs/.test(card.sections[0].rows[0].note) && card.sections[0].copy.text.split("\n").length === 3);
  check("the asks show verbatim with their likes", card.sections[1].rows[0].label === "1.2K likes" && /Aztecs/.test(card.sections[1].rows[0].value));
  check("the share image carries the thumbnail and the ideas", card.share.image === "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg" && card.share.rows.length === 3);
  const noAi = W.commentsCard({ video: { id: "abcdefghijk", title: "x" }, digest: d, ai: { ok: false, reason: "Not written: no AI provider is set up." } }, "en");
  check("without a provider the asks still show and the ideas say why", /no AI provider/.test(noAi.sections[0].note) && noAi.sections[1].rows.length === 2);
  const none = W.commentsCard({ video: { id: "abcdefghijk", title: "x" }, digest: W.digest([]) }, "es");
  check("no comments is said plainly", none.hero.value === "No comments" && /no muestra comentarios/.test(none.lead));
}

done("watch");
