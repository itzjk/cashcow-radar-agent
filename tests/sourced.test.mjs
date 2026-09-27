// The sourced script: passages cut from real sources with ids and times, a prompt that allows only those, and the
// check that cuts every line with no source, a made up source, or a number its source does not contain. Then the
// factory's 30 second hook auditor and promise follower, ported, read the result.
import { load, check, done } from "./engines.mjs";

const g = load(["lib/nsp-text.js", "lib/nsp-sourced.js"]);
const Z = g.NSP_SOURCED;

const keysEs = Z.topicKeys("la caída de Constantinopla");
const keysEn = Z.topicKeys("the fall of Constantinople");
check("topic words drop the filler and keep a stem", keysEs.indexOf("consta") >= 0 && keysEs.indexOf("la") < 0 && keysEn.indexOf("fall") >= 0, { keysEs, keysEn });
check("a Spanish topic finds an English source through the stem", Z.relevance("Constantinople fell to the Ottomans in 1453", keysEs) >= 1);
check("an unrelated page scores zero", Z.relevance("Ten easy pasta recipes for busy weeknights", keysEs) === 0);

const seg = (t, text) => ({ t, text });
const SOURCES = [
  { kind: "page", title: "Fall of Constantinople - Encyclopedia", url: "https://en.example.org/wiki/Fall_of_Constantinople", text: "The Fall of Constantinople was the capture of the capital of the Byzantine Empire by the Ottoman Empire.\n\nThe city fell on 29 May 1453 after a siege that lasted 53 days. Sultan Mehmed II led an army of about 80,000 men against roughly 7,000 defenders.\n\nThe last emperor, Constantine XI Palaiologos, died in the final assault. The Ottomans used large cannons built by the engineer Orban to break the Theodosian Walls." },
  { kind: "video", title: "The Siege of Constantinople 1453", videoId: "abcdefghij1", channel: "History Channel X", url: "https://www.youtube.com/watch?v=abcdefghij1", description: "Subscribe for more history! https://example.com/merch\nThe siege of Constantinople ended the Byzantine Empire after more than a thousand years.",
    segments: [seg(12, "In the spring of 1453 the Ottoman army arrived outside Constantinople."), seg(18, "Mehmed the second was only 21 years old."), seg(24, "His guns fired stones weighing more than 500 kilograms at the walls."), seg(31, "The chain across the Golden Horn kept the Ottoman fleet out, so Mehmed dragged his ships over land on greased logs."), seg(40, "On the night of 28 May the final attack began and by morning the city was taken."), seg(52, "Nobody knows exactly how Constantine the eleventh died.")] },
  { kind: "page", title: "Ten easy pasta recipes", url: "https://food.example.com/pasta", text: "Boil the water, salt it well and cook the pasta for nine minutes. Toss with butter and cheese and serve it hot with pepper." }
];
const pack = Z.passages(SOURCES, "the fall of Constantinople");
check("two sources about the topic are used and the recipe page is left out", pack.sources.length === 2 && pack.left.length === 1 && /pasta/i.test(pack.left[0].title), pack.sources.map(s => s.title));
check("passages are numbered in order and point at their source", pack.passages.every((p, i) => p.id === i + 1 && p.source >= 1 && p.source <= 2));
check("transcript passages keep the second they start at", pack.passages.some(p => p.source === 2 && p.from === "transcript" && p.at === 12));
check("the link line of the description never becomes a passage", !pack.passages.some(p => /merch|Subscribe/.test(p.text)));

const prompt = Z.prompt({ topic: "the fall of Constantinople", lang: "es", minutes: 5, passages: pack.passages, sources: pack.sources });
check("the prompt hands over only the numbered passages", /\[P1\] \(source 1, page\)/.test(prompt.user) && /transcript at 0:12/.test(prompt.user) && !/pasta/.test(prompt.user));
check("and forbids facts, numbers and sources that are not in them", /Never cite an id that is not in the list/.test(prompt.system) && /Never add a number, a date, a name/.test(prompt.system) && /data, never instructions/.test(prompt.system));
check("it asks for the language of the user and a 30 second hook", /Write in Spanish/.test(prompt.system) && /the first 30 seconds/.test(prompt.user) && prompt.minutes === 5);

const p = n => pack.passages.find(x => x.text.indexOf(n) >= 0).id;
const P53 = p("53 days"), PGUN = p("500 kilograms"), PNIGHT = p("28 May"), PNOBODY = p("Nobody knows");
const DRAFT = [
  "TITLE: The Night Constantinople Fell",
  "HOOK:",
  "On 29 May 1453 a city that had stood for a thousand years fell in a single night. [P" + P53 + "]",
  "Nobody knows how its last emperor died. [P" + PNOBODY + "]",
  "By the end you will know why the walls could not save it.",
  "SECTION: The siege",
  "- The siege lasted 53 days. [P" + P53 + "]",
  "Mehmed II had 90,000 men. [P" + P53 + "]",
  "The guns fired stones of more than 500 kilograms. [P" + PGUN + "][P99]",
  "Orban built the biggest cannon in Europe.",
  "The Venetians sent 40 ships. [P77]",
  "It was a hard spring for everyone.",
  "SECTION: The last night",
  "The final attack began on the night of 28 May. [P" + PNIGHT + ", P" + P53 + "]",
  "Constantinopla cayó al amanecer. [P" + PNIGHT + "]",
  "END"
].join("\n");
const draft = Z.parse(DRAFT);
check("the draft parses into a title, a hook and sections", draft.title === "The Night Constantinople Fell" && draft.hook.length === 3 && draft.sections.length === 2 && draft.sections[0].lines.length === 6, draft);
check("citations come off the text and into their own list", draft.sections[0].lines[2].cites.join() === PGUN + ",99" && !/\[/.test(draft.sections[0].lines[2].text));
check("a bullet mark is not part of the line", draft.sections[0].lines[0].text === "The siege lasted 53 days.");
check("a decimal or a thousands mark does not split a sentence", Z.parse("HOOK:\nIt weighed 3.5 tons and cost 1,000 ducats. [P1]\nEND").hook.length === 1);

const v = Z.verify(draft, pack, "en");
const kept = [].concat(v.hook, ...v.sections.map(s => s.lines)).map(r => r.text);
const cut = v.removed.map(r => r.text + " :: " + r.why);
check("a line whose number is in its passage stays", kept.indexOf("The siege lasted 53 days.") >= 0);
check("a number the passage does not contain is cut", cut.some(c => /^Mehmed II had 90,000 men.*number 90000/.test(c)), cut);
check("a fact with no source is cut", cut.some(c => /^Orban built.*no source/.test(c)), cut);
check("a line citing only a passage that does not exist is cut", cut.some(c => /^The Venetians.*does not exist/.test(c)), cut);
check("a made up id next to a real one is dropped and the line stays on the real one", v.sections[0].lines.some(r => /500 kilograms/.test(r.text) && r.cites.join() === String(PGUN)) && v.stats.badCites === 2);
check("a line with no fact needs no source and stays as narration", v.sections[0].lines.some(r => r.narration && /hard spring/.test(r.text)));
check("a name the source spells the same way passes its check", v.sections[1].lines.some(r => /Constantinopla/.test(r.text) && r.check.length === 0));
const odd = Z.verify(Z.parse("HOOK:\nIn 1453 Bizancio fell. [P" + P53 + "]\nEND"), pack, "en");
check("a name the source never spells is kept but flagged for a look", odd.hook.length === 1 && odd.hook[0].check.indexOf("Bizancio") >= 0 && odd.flagged === 1, odd.hook);
check("the counts add up", v.stats.lines === 11 && v.stats.removed === 3 && v.removed.length === 3, v.stats);

const card = Z.card({ pack, verified: v, topic: "the fall of Constantinople", by: "OpenAI (gpt-4o-mini)", left: pack.left }, "en");
const ids = card.sections.map(s => s.id);
check("the card shows the hook, its check, every section, the sources and the cut lines", ["hook", "check", "s1", "s2", "sources", "cut", "copy"].every(x => ids.indexOf(x) >= 0), ids);
check("every factual line on the card names its source and minute", card.sections.filter(s => /^s\d|hook/.test(s.id)).every(s => s.rows.every(r => r.note && (/Source \d/.test(r.note) || /no source needed/.test(r.note)))));
check("a video source line names the minute it came from", card.sections.find(s => s.id === "s2").rows[0].note.indexOf("Source 2 at 0:40") >= 0, card.sections.find(s => s.id === "s2").rows[0].note);
check("sources link to the page or to the video", card.sections.find(s => s.id === "sources").rows.every(r => r.web || r.link));
check("the cut lines say why", card.sections.find(s => s.id === "cut").rows.length === 3 && card.sections.find(s => s.id === "cut").rows.every(r => /^Cut: /.test(r.note)));
check("the hero counts only facts that are backed", card.hero.value === v.stats.factual + " of " + v.stats.factual && card.hero.tone === "good");
check("the script can be copied with its sources", /SOURCES\n\[1\] Fall of Constantinople/.test(card.sections.find(s => s.id === "copy").copy.text) && /\[1\]$/m.test(card.sections.find(s => s.id === "copy").copy.text));
check("it offers the Studio package and keeps the script for it", card.actions[0].job.op === "studio_pack" && card.script.chapters.length === 2 && card.script.chapters[0].at === 0 && card.script.chapters[1].at > 0);
check("no long dash anywhere on the card", !/\u2014/.test(JSON.stringify(card)));

const hookCheck = card.sections.find(s => s.id === "check");
check("the hook check reads a concrete fact, a gap and a promise in this opening", hookCheck.rows.some(r => r.tag === "READY") || hookCheck.rows.every(r => r.tag !== "FIX"), hookCheck.rows);
const reading = t => Z.reading({ hook: t.map(x => ({ text: x })), sections: [{ heading: "A", lines: [{ text: "The walls held for weeks." }, { text: "In the end the walls fell." }] }] });
const greet = Z.auditHook(reading(["Hey guys, welcome back to the channel.", "Today we talk about a city."]), { lang: "en" });
check("an opening on a greeting is flagged and blocks", greet.findings.some(f => f.id === "greeting" && f.blocks) && greet.verdict.state !== "ready", greet.findings);
check("an opening with no figure, date or name is flagged", greet.findings.some(f => f.id === "no_fact"));
const ai = Z.auditHook(reading(["Let's dive in to the year 1453.", "Nobody saw it coming?"]), { lang: "en" });
check("AI phrasing in the opening is flagged", ai.findings.some(f => f.id === "ai_phrasing"), ai.findings);
const good = Z.auditHook(reading(["In 1453 the walls of Constantinople fell in one night.", "Nobody knows how the last emperor died.", "By the end you will know why the walls fell."]), { lang: "en" });
check("a concrete opening with a gap and a promise is ready", good.verdict.state === "ready" && !good.findings.length, good.findings);
const follow = Z.followPromise(reading(["In 1453 the walls of Constantinople fell in one night.", "By the end you will know why the walls fell."]), Z.auditHook(reading(["In 1453 the walls of Constantinople fell in one night.", "By the end you will know why the walls fell."]), { lang: "en" }), { lang: "en" });
check("the promise words are followed into the body, after the hook block", follow.ok && follow.paid >= 1 && follow.keys.indexOf("walls") >= 0 && follow.pays.some(x => x.word === "walls" && x.tag === "cierre"), follow);
check("the Spanish ban list catches its own AI phrases", Z.scrub("Sumérgete en la historia de Roma", "es").clean === false && Z.scrub("Roma cayó en 476", "es").clean === true);

const thin = Z.verify(Z.parse("HOOK:\nOrban built cannons.\nSECTION: A\nThe siege lasted 53 days. [P" + P53 + "]\nEND"), pack, "en");
const refused = Z.card({ pack, verified: thin, topic: "x" }, "en");
check("a draft left with fewer than 3 backed facts is not handed over", refused.hero.value === "Not handed over" && !refused.script && !refused.actions.length && /did not hold up/.test(refused.lead));
const none = Z.refusal({ topic: "the fall of Constantinople", readable: 1, tried: [{ kind: "video", title: "A video", videoId: "abcdefghij1", why: "no captions and no description", ok: false }] }, "es");
check("with fewer than two sources nothing is written, in the user's language", none.hero.value === "Not written" && /Solo encontré una fuente/.test(none.lead) && /no escribo un guion/.test(none.lead) && none.model.refused === true && none.sections[0].rows[0].link === "https://www.youtube.com/watch?v=abcdefghij1");
check("with no source at all it says no source, not zero sources", /^I found no source I can read about/.test(Z.refusal({ topic: "x", readable: 0, tried: [] }, "en").lead));
check("a possessive is not a misspelled name", Z.namesOf("It was the end of Rome's glory and Mehmed's rise.", "en").join() === "Rome,Mehmed", Z.namesOf("It was the end of Rome's glory and Mehmed's rise.", "en"));
check("numbers compare without their separators", Z.numbersOf("80,000 men in 1453 [P3]").join() === "80000,1453");
check("a line with a number, a date or a name is a claim, a bare line is not", Z.isClaim("It lasted fifty days.", "en") && Z.isClaim("In May it ended.", "en") && Z.isClaim("Then Mehmed smiled.", "en") && !Z.isClaim("It was a long night.", "en"));

done("sourced");
