// The Shorts miner: the factory's clip chooser (cortar_clips.py: frases, rasgos, puntuar, candidatas, elegir) ported
// to the browser, fed by YouTube's own timed captions and, when YouTube shows it, the most replayed graph.
import { load, check, done } from "./engines.mjs";

const g = load(["lib/nsp-shorts.js"]);
const S = g.NSP_SHORTS;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const SENT = [
  ["Nobody expected this move.", "He scored 18 points with 4 threes!", "So that is the thing about percentages.", "And then the coach said something wild.", "Um, anyway, subscribe to the channel.", "This was the best game of his career!"],
  ["The Romans built this road in 312 BC.", "Nobody knows why the legion vanished.", "He said it was the worst winter in forty years.", "They marched north with five thousand men.", "Look at the map for a second.", "That's why historians still argue about it!", "Welcome back to the channel, hey guys.", "I think the answer is simpler than that."]
];
function synth(c) {
  const r = rng(7 + c * 101); const sents = SENT[c % 2]; const words = []; let t = 0;
  const n = c === 2 ? 700 : 400;
  for (let k = 0; k < n; k++) {
    const s = sents[Math.floor(r() * sents.length)].split(" ");
    for (const w of s) { const d = 0.25 + r() * 0.2; words.push({ w, t0: Math.round(t * 100) / 100, t1: Math.round((t + d) * 100) / 100 }); t += d + 0.05 + r() * 0.1; }
    t += 0.2 + r() * 1.4;
  }
  const en = []; for (let i = 0; i < Math.floor(t / 0.5) + 2; i++) en.push(Math.round((-30 + r() * 10 + (c === 1 && i > 600 && i < 700 ? 8 : 0)) * 1000) / 1000);
  return { words, en: c === 2 ? [] : en, title: c === 1 ? ["romans", "legion"] : [] };
}

// What cortar_clips.py itself returns on these three inputs (candidatas + elegir(n=5)), run on 27 Sep 2026.
const PYTHON = [
  { n: 4228, frases: 400, chosen: [[204.46, 234.6, 5.477], [561.84, 593.87, 4.989], [899.47, 941.58, 6.384], [1104.37, 1156.52, 4.802], [1243.5, 1291.42, 4.881]] },
  { n: 3965, frases: 400, chosen: [[102.31, 150.54, 7.202], [216.41, 250, 7.495], [1113.7, 1162.43, 7.186], [1413.78, 1444.27, 7.732], [1576.33, 1626.82, 7.394]] },
  { n: 7854, frases: 700, chosen: [[146.75, 191.73, 7.06], [278.59, 328.38, 7.125], [469.57, 519.05, 6.616], [947.07, 978.51, 6.826], [2411.5, 2452.54, 7.311]] }
];
const PY_TOP = [
  { dur: 42.1, energia: -0.11, energia_alta: 0.23, nombres_min: 0, afirma: 9, numeros: 8, remate: 1, pausa_bordes: 2, palabras_s: 1.66 },
  { dur: 30.5, energia: 0.41, energia_alta: 0.31, nombres_min: 11.81, afirma: 4, numeros: 5, remate: 1, pausa_bordes: 2, palabras_s: 1.9 },
  { dur: 41, energia: 0, energia_alta: 1, nombres_min: 0, afirma: 4, numeros: 20, remate: 1, pausa_bordes: 2, palabras_s: 1.68 }
];

PYTHON.forEach((want, i) => {
  const c = synth(i);
  const got = S.candidates(c.words, c.en, { titleNames: c.title });
  check("case " + i + ": the same " + want.frases + " sentences as the factory", got.sentences.length === want.frases, got.sentences.length);
  check("case " + i + ": the same " + want.n + " candidate windows", got.list.length === want.n, got.list.length);
  const chosen = S.choose(got.list, 5).map(x => [x.t0, x.t1, x.punt]);
  check("case " + i + ": the same five clips, times and scores", JSON.stringify(chosen) === JSON.stringify(want.chosen), chosen);
  const top = got.list.slice().sort((a, b) => b.punt - a.punt)[0].rasgos;
  const off = Object.keys(PY_TOP[i]).filter(k => top[k] !== PY_TOP[i][k]);
  check("case " + i + ": the best window's traits match the factory's to the digit", off.length === 0, off.map(k => k + " " + top[k] + " vs " + PY_TOP[i][k]));
});

check("rounding follows Python, halves to even on exact ties", S._pyRound(0.125, 2) === 0.12 && S._pyRound(0.375, 2) === 0.38 && S._pyRound(63.15, 1) === 63.1 && S._pyRound(0.225, 2) === 0.23 && S._pyRound(2.5, 0) === 2);

const ASR = [
  { tStartMs: 0, dDurationMs: 999999, id: 1 },
  { tStartMs: 1120, dDurationMs: 4239, segs: [{ utf8: "Hello" }, { utf8: " everyone.", tOffsetMs: 240 }, { utf8: " Welcome", tOffsetMs: 719 }, { utf8: " back", tOffsetMs: 960 }] },
  { tStartMs: 2710, dDurationMs: 2649, aAppend: 1, segs: [{ utf8: "\n" }] },
  { tStartMs: 2720, dDurationMs: 4880, segs: [{ utf8: "episode" }, { utf8: " 55", tOffsetMs: 800 }, { utf8: " of", tOffsetMs: 1360 }] }
];
const aw = S.wordsFromJson3(ASR);
check("auto captions give one word per segment with its own time", aw.length === 7 && aw[1].w === "everyone." && aw[1].t0 === 1.36 && aw[4].w === "episode" && aw[4].t0 === 2.72, aw);
check("the line break events are not words", !aw.some(w => /\n/.test(w.w)));
check("a word ends where the next starts, and never lasts over 1.2 s", aw[0].t1 === 1.36 && aw[3].t1 === Math.min(2.72, aw[3].t0 + 1.2), aw.slice(0, 4));
const MANUAL = [{ tStartMs: 10000, dDurationMs: 4000, segs: [{ utf8: "The legion marched north in 117." }] }];
const mw = S.wordsFromJson3(MANUAL);
check("written captions spread their words over the line's time", mw.length === 6 && mw[0].t0 === 10 && mw[5].t0 > 13 && mw[5].t0 < 14, mw);

function flat(n, words) {
  const out = []; let t = 0;
  for (let k = 0; k < n; k++) for (const w of words[k % words.length].split(" ")) { out.push({ w, t0: +t.toFixed(2), t1: +(t + 0.3).toFixed(2) }); t += 0.4; }
  return out;
}
const BARE = flat(600, ["the legion crossed the river at dawn and nobody saw them again after that night"]);
for (let i = 13; i < BARE.length; i += 14) { BARE[i].t0 += 1.5; for (let j = i + 1; j < BARE.length; j++) { BARE[j].t0 += 1.5; BARE[j].t1 += 1.5; } BARE[i].t1 += 1.5; }
check("captions with no punctuation are read by their pauses", !S.punctuated(BARE));
const bare = S.mine({ words: BARE, heat: [], lang: "en", seconds: BARE[BARE.length - 1].t1 });
check("so they still give clips instead of none", bare.ok && bare.pauseEnds && bare.clips.length >= 3, { ok: bare.ok, n: bare.clips.length, reason: bare.reason });

const SAME = flat(700, ["The legion crossed the river at dawn.", "Nobody saw them again after that night."]);
const secs = SAME[SAME.length - 1].t1;
const markers = []; for (let i = 0; i < 100; i++) markers.push({ startMillis: String(Math.round(i * secs * 10)), durationMillis: String(Math.round(secs * 10)), intensityScoreNormalized: i >= 60 && i < 64 ? 1 : 0.1 });
const heat = S.heatSeries(markers, secs);
check("the most replayed graph becomes a series every half second", heat.length === Math.ceil(secs / 0.5) && Math.max(...heat) === 10 && Math.min(...heat) === 1, { len: heat.length, max: Math.max(...heat) });
const cold = S.mine({ words: SAME, heat: [], lang: "en", seconds: secs, n: 3 });
const hot = S.mine({ words: SAME, heat, lang: "en", seconds: secs, n: 3 });
const peak = [secs * 0.6, secs * 0.64];
check("with every sentence alike, the replayed stretch wins the best clip", hot.ok && hot.heat && hot.clips.some(c => c.t0 < peak[1] && c.t1 > peak[0] && c.score === Math.max(...hot.clips.map(x => x.score))), hot.clips.map(c => [c.t0, c.t1, c.score]));
check("and without the graph that stretch is nothing special", cold.ok && !cold.heat && !cold.clips.some(c => c.t0 < peak[1] && c.t1 > peak[0] && c.score > Math.max(...cold.clips.map(x => x.score)) - 0.01 && cold.clips.filter(x => x.score === c.score).length === 1));
check("clips never overlap and sit 60 seconds apart", hot.clips.every((c, i) => i === 0 || c.t0 >= hot.clips[i - 1].t1 + 60));
check("and never start in the first 45 seconds or end in the last 45", hot.clips.every(c => c.t0 >= 45 && c.t1 <= secs - 45));
check("each clip is 30 to 75 seconds", hot.clips.every(c => c.dur >= 30 && c.dur <= 75));

const ES_WORDS = flat(400, ["Pero nadie volvi\u00f3 a ver a la legi\u00f3n.", "La legi\u00f3n cruz\u00f3 el r\u00edo al amanecer con cinco mil hombres."]);
const at = ES_WORDS.findIndex((w, i) => i > 700 && /^La$/.test(w.w));
["Suscr\u00edbete", "y", "dale", "like", "al", "video."].forEach((w, k) => { ES_WORDS[at + k].w = w; });
for (let k = at + 6; k < ES_WORDS.length && !/\.$/.test(ES_WORDS[k - 1].w); k++) ES_WORDS[k].w = "ya.";
const es = S.candidates(ES_WORDS, [], { lang: "es" });
const startsPero = es.list.filter(c => /^Pero/.test(ES_WORDS[c.i0].w));
const startsLa = es.list.filter(c => /^La/.test(ES_WORDS[c.i0].w));
check("in Spanish a clip that opens on 'pero' is marked as opening mid thought", startsPero.length > 0 && startsPero.every(c => c.rasgos.conector === 1) && startsLa.every(c => c.rasgos.conector === 0));
const withCta = es.list.filter(c => c.rasgos.cta > 0), without = es.list.filter(c => c.rasgos.cta === 0);
check("and a call to subscribe pulls its windows below the rest", withCta.length > 0 && without.length > 0 && Math.max(...withCta.map(c => c.punt)) < Math.max(...without.map(c => c.punt)) - 2, { cta: Math.max(...withCta.map(c => c.punt)), clean: Math.max(...without.map(c => c.punt)) });
check("Spanish numbers count as numbers", es.list.some(c => c.rasgos.numeros > 0));

check("3 clips under 10 minutes, 4 under 20, 5 from 20 minutes up", S.howMany(300) === 3 && S.howMany(700) === 4 && S.howMany(1300) === 5 && S.howMany(21265) === 5);
check("the clock prints hours only when there are hours", S.clock(65) === "1:05" && S.clock(3725) === "1:02:05");

const card = S.card({ result: hot, video: { id: "n82XWvEa22Q", title: "Hawks Film Room Ep 55", channel: "Hawks" }, captions: "en, auto-generated" });
const links = card.sections.flatMap(s => s.rows || []).filter(r => r.link).map(r => r.link);
check("the card lists every clip with a link that opens the video at its start", card.kind === "shorts" && links.length === hot.clips.length && links.every((l, i) => l === "https://www.youtube.com/watch?v=n82XWvEa22Q&t=" + Math.floor(hot.clips[i].t0) + "s"), links);
check("each clip names its hook line and why it was picked", card.sections.filter(s => /^clip/.test(s.id)).every(s => s.rows[0].label === "Hook line" && s.rows[1].label === "Why" && s.rows[1].value.length > 3));
check("the card says the replay graph was used", /Measured/.test(card.sections.find(s => s.id === "how").rows[2].value));
check("it can be copied as a cut list and shared", card.sections.find(s => s.id === "how").copy.text.split("\n").length === hot.clips.length + 1 && card.share && /ZERACK, open source/.test(card.share.post));
const es2 = S.card({ result: hot, video: { id: "n82XWvEa22Q", title: "Ep 55" }, captions: "es, auto-generated" });
check("the lead is spoken in English even for a video in Spanish", /^I found \d moments/.test(es2.lead) && !("lang" in es2), es2.lead);
const none = S.card({ result: { ok: false, reason: "no_captions" }, video: { id: "n82XWvEa22Q", title: "Ep 55" } });
check("a video with no captions says so and guesses nothing", none.hero.value === "No clean cut" && /no captions/.test(none.lead) && !none.sections.length && !none.share);
const short = S.mine({ words: flat(30, ["The legion crossed the river at dawn."]), heat: [], seconds: 80 });
check("a video too short for a clip says why", !short.ok && short.reason === "too_short", short);
const all = JSON.stringify([card, es2, none]);
check("no long dash anywhere on the cards", !/\u2014/.test(all));

done("shorts");
