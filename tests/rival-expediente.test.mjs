import { load, rancho, check, done, RIVAL } from "./engines.mjs";

const ctx = load(RIVAL);
const E = ctx.NSP_RIVAL_EXPEDIENTE;
const V = ctx.NSP_VEREDICTO;
const REAL = rancho();

function channel(title, views, days) {
  return views.map((v, i) => ({ videoId: "v" + i, title: title + " " + i, viewsNum: v, published: "hace " + (days ? days[i] : 3 + i * 2) + " dias" }));
}

const empty = E.armar({ videos: [] });
check("an empty sweep gives no verdict", empty.ok === false && empty.motivo === "sin_barrido", empty);
check("and what shows is look at it, never KEEP", empty.veredicto === V.MIRARLO, empty.veredicto);
check("and it says nothing was measured", /Nothing was measured/i.test(empty.razon), empty.razon);

const age = E.edadDe(REAL, {});
check("without the video total the age is a floor", age.ok && age.cierta === false, age);
check("and the text says at least, not a date", /at least/i.test(age.dice), age.dice);
check("and the 120 day rule is declared not applicable", age.dentroDeLaRegla === null, age.reglaDice);
const exact = E.edadDe(REAL, { totalVideos: 30 });
check("with 30 videos swept out of 30 the age is certain", exact.cierta === true, exact);
check("and then the 120 day rule applies", exact.dentroDeLaRegla === true, exact.reglaDice);
const old = E.edadDe(channel("T", Array.from({ length: 20 }, () => 5000), Array.from({ length: 20 }, (_, i) => 200 + i)), { totalVideos: 20 });
check("a 219 day old channel is outside the rule, and says so", old.dentroDeLaRegla === false, old.reglaDice);
check("the rule is 120 and declared", E.MAX_DIAS_DUENO === 120, E.MAX_DIAS_DUENO);
const noDate = E.edadDe([{ title: "sin fecha", viewsNum: 100 }], {});
check("without dates it returns could not, not zero", noDate.ok === false, noDate);
const impossible = E.edadDe(REAL, { totalVideos: 20 });
check("a total below what was swept is marked impossible, not taken as certain", impossible.cuentaImposible === true && impossible.cierta === false, impossible);

const blowsUp = E.armar({ videos: channel("Visitamos la fabrica de", Array.from({ length: 20 }, () => 500000)), canal: { nombre: "Factory channel" } });
check("a camera channel with half a million views is DROP", blowsUp.veredicto === V.NO_SIRVE, blowsUp.veredicto);
check("and it says the camera rule decided, not the numbers", /camera rule/i.test(blowsUp.razon), blowsUp.razon);
check("and the label on screen is DROP", blowsUp.etiqueta === "DROP", blowsUp.etiqueta);

const noDates = E.armar({ videos: Array.from({ length: 20 }, (_, i) => ({ videoId: "v" + i, title: "SE RIERON DE ELLA HASTA QUE volvio " + i, viewsNum: 10000 + i * 100 })) });
check("without dates the verdict drops to look at it", noDates.veredicto === V.MIRARLO, noDates.veredicto);
check("and it names what was missing", noDates.faltan.length > 0, noDates.faltan);
check("and says so in the reason", /could not be measured/i.test(noDates.razon), noDates.razon);

const luck = E.armar({ videos: channel("SE RIERON DE ELLA HASTA QUE volvio", [900, 1100, 1000, 950, 900000, 1050, 980, 1020, 1010, 990, 1000, 1000, 970, 1030, 960, 1040, 990, 1010, 1000, 1000]) });
check("a ceiling 900x over the floor is DROP", luck.veredicto === V.NO_SIRVE, luck.cadencia.ratio);
check("and it says one lucky video, not an engine", /lucky video/i.test(luck.razon), luck.razon);

const e = E.armar({ videos: REAL, canal: { nombre: "Rancho reference", url: "https://www.youtube.com/@example" } });
check("the last twelve read red", e.cadencia.luz === "rojo", e.cadencia.ratio);
check("but the recent run holds at 5.8x", e.quiebre.estable.ok && e.quiebre.estable.ratio === 5.8, e.quiebre.estable);
check("and the run decides: the channel is KEEP", e.veredicto === V.SIRVE, e.veredicto);
check("with both numbers in view", /5.8x/.test(e.razon) && /87.3x/.test(e.razon), e.razon);

check("brings the cadence", e.cadencia.ok === true, e.cadencia);
check("brings the break", e.quiebre.ok === true && e.quiebre.hubo === true, e.quiebre.posicion);
check("brings the formula", e.formula.ok === true, e.formula.muestra);
check("brings the rebuildable verdict", e.replicable.ok === true, e.replicable.etiqueta);
check("brings the niche and its reference RPM", e.nicho.ok === true, e.nicho);
check("a niche that holds only 3 of 30 titles reads as mixed, not as that niche", e.nicho.clasificado === false && e.nicho.nombre === "Mixed" && /3 of 30/.test(e.nicho.dice), e.nicho.dice);
check("and it says the RPM is unknown, not low", e.nicho.medido === false && /unknown/i.test(e.nicho.dice), e.nicho.dice);
{
  const fin = E.armar({ videos: channel("How the stock market really works", Array(30).fill(0).map((x, i) => 10000 + i)).map((v, i) => i % 3 ? Object.assign({}, v, { title: ["A quiet walk in the forest", "My morning coffee routine"][i % 2] + " " + i }) : v) });
  check("a niche that holds 10 of 30 titles is read title by title as that niche", fin.nicho.clasificado === true && fin.nicho.voto.count === 10 && /title by title as [A-Z]/.test(fin.nicho.dice), fin.nicho);
  const court = channel("Rockets and the physics of flight", Array(30).fill(0).map((x, i) => 10000 + i));
  court[3] = Object.assign({}, court[3], { title: "The wrong science in court for 50 years" });
  const c = E.armar({ videos: court });
  check("one title about a court does not make a science channel a legal niche", !(c.nicho.clasificado && /legal/i.test(c.nicho.nicho)), c.nicho);
}
check("the summary has one line per piece", e.resumen.length === 7, e.resumen.length);
check("and no summary line is empty", e.resumen.every(l => l && l.length > 10), e.resumen);
check("declares zero quota", e.cuota === 0, e.cuota);
check("and where the data came from", /zero YouTube Data API quota/i.test(e.fuente), e.fuente);

done("rival-expediente");
