import { load, source, check, done } from "./engines.mjs";

const g = load(["lib/nsp-text.js", "nsp-policy.js", "lib/nsp-veredicto.js", "lib/nsp-dinero-riesgo.js"]);
const POL = g.NSPPolicy, RISK = g.NspDineroRiesgo, V = g.NSP_VEREDICTO;
POL._setPoliciesForTest(JSON.parse(source("data/policies.json")));
const RISK_SRC = source("lib/nsp-dinero-riesgo.js");

{
  const card = await POL.evaluatePackage({ script: "", title: "adjustment card", description: "" });
  check("a package with no narration can not come out green", card.risk === "yellow", card.risk);
  check("and the reason names the policy that sanctions the whole channel", card.reasons.some(x => /Inauthentic content/.test(x)), card.reasons);
  check("it says it cleared nothing, not that it is clean", card.reasons.some(x => /NOTHING TO AUDIT/.test(x)), card.reasons);
  check("the engine counts zero words and carries it in the result", card.evidence && card.evidence.words === 0 && card.evidence.hasText === false, card.evidence);
  const good = await POL.evaluatePackage({ script: "The Roman aqueducts moved water across the empire for six hundred years, and this is how the engineers kept the slope constant over eighty kilometres.", title: "Roman aqueducts", description: "" });
  check("a real script can come out green", good.risk === "green", good.risk);
  check("and the green says how many words it read", /over \d+ words of script/.test(good.reasons.join(" ")), good.reasons);
  check("and says what it did NOT look at, so nobody reads it as a yes from YouTube", good.reasons.some(x => /SCOPE:/.test(x) && /not a YouTube decision/.test(x)), good.reasons);
}
{
  check("the policy engine exports the rule", typeof POL.evidenceOfNarration === "function");
  check("and the money module keeps no copy of that count", !/split\(\/\\s\+\//.test(RISK_SRC));
  check("the module asks the engine for it by name", /evidenceOfNarration/.test(RISK_SRC));
  const noEngine = load(["lib/nsp-veredicto.js", "lib/nsp-dinero-riesgo.js"]);
  const ne = noEngine.NspDineroRiesgo.evaluarGuion({ texto: "hola" });
  check("without the engine loaded it refuses to judge, it does not guess", ne.ok === false && ne.motivo === "sin_motor", ne.porque);
}
{
  const pol = await POL.evaluatePackage({ script: "", title: "", description: "" });
  const empty = RISK.evaluarGuion({ texto: "", titulo: "adjustment card", politica: pol });
  check("an empty script is never KEEP", empty.ok && empty.veredicto === V.MIRARLO, empty.veredicto);
  check("and the reason brings the inauthentic content policy", empty.razones.some(x => /Inauthentic content/.test(x)), empty.razones);
  const gore = RISK.evaluarGuion({ texto: "The autopsy showed the mutilated body of the victim before the beheading was filmed.", titulo: "case file", politica: await POL.evaluatePackage({ script: "x", title: "y" }) });
  check("a shocking content term raises its hand", gore.ok && gore.veredicto === V.MIRARLO, gore.veredicto);
  check("with the policy written out in full, not a loose code", gore.razones.some(x => /Advertiser-friendly content guidelines, Shocking content/.test(x)), gore.razones);
  check("and it says it is a keyword screen, not YouTube's classifier", gore.razones.some(x => /keyword screen, not YouTube's classifier/.test(x)), gore.razones);
  check("the finding says which field it was in", gore.hallazgos.length > 0 && gore.hallazgos[0].campo === "script", gore.hallazgos);
  const clean = RISK.evaluarGuion({ texto: "The Roman aqueducts moved water across the empire for six hundred years and the engineers kept the slope constant over eighty kilometres of stone.", titulo: "Roman aqueducts explained", politica: await POL.evaluatePackage({ script: "The Roman aqueducts moved water across the empire.", title: "Roman aqueducts explained" }) });
  check("a clean script is KEEP", clean.ok && clean.veredicto === V.SIRVE, clean.veredicto + " / " + clean.etiqueta);
  check("but the reason does not sell it as a YouTube permit", /not YouTube saying yes/.test(clean.porque), clean.porque);
  const hard = RISK.evaluarGuion({ texto: "sexo con menores en el caso", titulo: "x", politica: await POL.evaluatePackage({ script: "sexo con menores en el caso", title: "x" }) });
  check("what the engine marks red falls in DROP", hard.ok && hard.veredicto === V.NO_SIRVE, hard.veredicto);
  check("and the remove or rewrite guidance comes out, no way around it", hard.razones.some(x => /Remove or rewrite/i.test(x)), hard.razones);
}
{
  check("the word MONETIZATION SAFE does not exist in the module", !/MONETIZATION SAFE/.test(RISK_SRC));
  const clean = RISK.evaluarGuion({ texto: "A quiet history of the Roman aqueducts and the engineers who built them.", titulo: "t", politica: null });
  check("nor does it show in a clean output", !/MONETIZATION SAFE/.test(JSON.stringify(clean)));
  check("CTR and retention are on the list of what it never looks at", /click-through/.test(clean.fueraDeAlcance.join(" ")) && /retention/.test(clean.fueraDeAlcance.join(" ")), clean.fueraDeAlcance);
  const i = RISK_SRC.indexOf("var FUERA_DE_ALCANCE");
  const j = RISK_SRC.indexOf("];", i);
  const rest = RISK_SRC.slice(0, i) + RISK_SRC.slice(j + 2);
  check("outside that list the word retention does not appear in the module", i >= 0 && j > i && !/retention|retenci|\bctr\b/i.test(rest));
  check("the three verdict words come from the single judge, not a copy", !/'SIRVE'|'NO SIRVE'|'HAY QUE MIRARLO'/.test(RISK_SRC) && /NSP_VEREDICTO/.test(RISK_SRC));
}
{
  const dead = RISK.evaluarCanal({ videos: [
    { titulo: "Top 10 facts about Rome", guion: "", plantilla: "auto" },
    { titulo: "Top 10 facts about Egypt", guion: "", plantilla: "auto" },
    { titulo: "Top 10 facts about Greece", guion: "", plantilla: "auto" }
  ] });
  check("a channel where no video carries narration falls in DROP", dead.ok && dead.veredicto === V.NO_SIRVE, dead.veredicto);
  check("and counts it as X of Y, with no percentages", /3 of 3 videos/.test(dead.razones.join(" ")), dead.razones);
  check("names the inauthentic content policy", dead.razones.some(x => /Inauthentic content/.test(x)), dead.razones);
  check("and says the sanction is on the channel, not the video", /lands on the channel/.test(dead.porque), dead.porque);
  const templated = RISK.evaluarCanal({ videos: [
    { titulo: "Top 10 facts about Rome", guion: "Rome was founded on seven hills and the story starts here.", plantilla: "auto" },
    { titulo: "Top 10 facts about Egypt", guion: "Egypt built its first pyramid for a king who wanted a stair to the sky.", plantilla: "auto" },
    { titulo: "The forgotten siege of Malta", guion: "In 1565 a small island held off an empire for four months.", plantilla: "auto" }
  ] });
  check("with narration but copied titles it is LOOK AT IT", templated.ok && templated.veredicto === V.MIRARLO, templated.veredicto);
  check("and it says how many titles repeat out of how many", /2 of 3 titles/.test(templated.razones.join(" ")), templated.razones);
  check("and warns about the single template", templated.razones.some(x => /same edit template/.test(x)), templated.razones);
  const healthy = RISK.evaluarCanal({ videos: [
    { titulo: "The forgotten siege of Malta", guion: "In 1565 a small island held off an empire for four months.", plantilla: "auto" },
    { titulo: "Why Rome stopped building roads", guion: "The last miles of imperial road were laid by men who knew the money had run out.", plantilla: "docu" }
  ] });
  check("a channel with different scripts and titles is KEEP", healthy.ok && healthy.veredicto === V.SIRVE, healthy.veredicto);
  check("and still says it never watched a frame", healthy.razones.some(x => /never watched a single frame/.test(x)), healthy.razones);
  const none = RISK.evaluarCanal({ videos: [] });
  check("a channel with no videos is not called clean, it is called unread", none.ok === false && none.motivo === "sin_videos", none.porque);
}

done("dinero-politica");
