import { load, source, check, done } from "./engines.mjs";

const RE = load(["knowledge/reverse-engine.js"]).NSP_REVERSE_ENGINE;

const SEITEN = [
  "Wer war Trajan? | Der MÄCHTIGSTE Kaiser des Römischen Reiches | ANTIKES ROM",
  "Wer war Alarich? | Der GEFÜRCHTETSTE König der Westgoten, der ROM PLÜNDERTE | ANTIKES ROM",
  "Wer war Caligula? | Der VERRÜCKTESTE Kaiser des Römischen Reiches | ANTIKES ROM",
  "Wer war Scipio Africanus? | Der General, der Hannibal besiegte und Rom rettete | ANTIKES R"
];
const VELUMBRA = [
  "O iceberg DEFINITIVO de casos SOBRENATURAIS",
  "O Iceberg de CASOS MISTERIOSOS do MAR",
  "O estranho ICEBERG de TEORIAS DA CONSPIRAÇÃO",
  "O iceberg DEFINITIVO de casos SOBRENATURAIS pt.2"
];
const THREE = [
  "El segundo anillo más allá de las paredes de hielo: ¿Qué habitaba la Antártida Central?",
  "Los Monstruos de los Mapas Antárticos Eran Reales , Y Todavía Están Ahí Abajo",
  "La Vida Más Allá del Muro de Hielo: Lo Que Nos Espera Cuando el Cambio Climático Derrita e",
  "La niebla de Londres que mató a 12.000 personas en cinco días (1952)"
];

const s1 = RE.esqueletoDeTitulos(SEITEN);
check("a German channel of 4 titles with the same structure and closing mark gives a template", s1.ok === true, s1);
check("and it covers at least 3 of the 4", s1.encaja >= 3, s1.encaja);
check("the template keeps the fixed words and names the slots", /Wer war/.test(s1.plantilla) && /ANTIKES/.test(s1.plantilla) && s1.huecos.length > 0, s1.plantilla);
check("a channel whose only anchor is one word, with two titles of the same video, gives no formula", RE.esqueletoDeTitulos(VELUMBRA).ok === false);
check("a channel with no pattern can not invent a template", RE.esqueletoDeTitulos(THREE).ok === false);
check("titles that only share short words are not a template", RE.esqueletoDeTitulos(["El agua de la ciudad", "La casa de mi madre", "Un dia de lluvia en el norte", "La noche de los libros perdidos"]).ok === false);
check("a short sample says so with a stable code", RE.esqueletoDeTitulos(SEITEN.slice(0, 2)).motivo === "muestra_corta", RE.esqueletoDeTitulos(SEITEN.slice(0, 2)));
check("no repeated skeleton says so with a stable code", RE.esqueletoDeTitulos(THREE).motivo === "sin_esqueleto_repetido", RE.esqueletoDeTitulos(THREE));

const CAP = 16;
function withFormat(k) {
  const subj = ["Rieseninsekten", "Ersten Dinosaurier", "Trias", "Kreidezeit", "Eiszeit", "Urzeitmeere", "Kambrium", "Perm"];
  const tail = ["Komplette Dokumentation", "Prähistorische Dokumentation", "Doku", "Ganze Dokumentation", "Neue Dokumentation", "Lange Dokumentation", "Volle Doku", "Große Doku"];
  return Array.from({ length: k }, (_, i) => "Wie War Die Erde Während Der " + subj[i % subj.length] + "? | " + tail[i % tail.length]);
}
const FILL = [
  "Nach Den Dinosauriern: Wie Sah Die Erde Im Känozoikum Aus?", "Wie Die Tiefsee Giganten Hervorbrachte",
  "Der Ozean, den niemand je gesehen hat", "Fünf Tiere, die alles überlebt haben", "Das Ende der Megafauna",
  "Warum Bernstein so wertvoll ist", "Die Wüste, die einmal ein Meer war", "Was der Meteorit anrichtete",
  "Leben ohne Sonnenlicht", "Der längste Winter der Erdgeschichte", "Als Pilze die Welt beherrschten",
  "Die ersten Wälder", "Warum Insekten schrumpften", "Der Tag, an dem alles starb", "Spuren im Stein", "Das Rätsel der Urvögel"
];
const catalog = (k, n) => withFormat(k).concat(FILL.slice(0, n - k));
check("a channel with only 4 titles in format still gives a formula right at the cap of 16", RE.esqueletoDeTitulos(catalog(4, CAP)).ok === true);
check("above 16 the fraction takes over and that same channel gives none", RE.esqueletoDeTitulos(catalog(4, CAP + 4)).ok === false);

const scan = SEITEN.map((t, i) => ({ title: t, vph: [900, 800, 700, 600][i], channelName: "Seiten der Geschichte" }))
  .concat(["Warum Rom fiel", "Die Varusschlacht erklaert", "Der letzte Kaiser von Byzanz", "Hannibal ueber die Alpen"].map((t, i) => ({ title: t, vph: 100 + i, channelName: "Other" })));
const rep = RE.buildReport(scan, "Roman history");
check("the coach report is built from real titles", rep.ok === true && typeof rep.texto === "string" && rep.texto.length > 100, rep);
check("it opens in English", /^REVERSE ENGINEERING OF ROMAN HISTORY \(8 real videos from the scan\):/.test(rep.texto), rep.texto.split("\n")[0]);
check("it carries the derived template and the titles it came from", /TEMPLATE derived from these titles/.test(rep.texto) && /Real titles the template came from/.test(rep.texto), rep.texto);
check("every line a person or the model reads is English", !/[ñ¿¡]|\b(los|las|una|sus|titulos|plantilla|canales|mejor)\b/i.test(rep.texto.replace(/"[^"]*"/g, "")), rep.texto);
check("the template, coverage and slots come back as fields", rep.plantilla === rep.esqueleto.plantilla && rep.encaja >= 3 && rep.cobertura > 0 && Array.isArray(rep.huecos), rep);

const noSkel = RE.buildReport(THREE.map(t => ({ title: t, views: 1000 })), "Antarctica");
check("with no repeated skeleton it refuses instead of giving a generic template", noSkel.ok === false && !noSkel.plantilla, noSkel);
check("and says so in English, in the text and the note", /share no repeated skeleton/.test(noSkel.texto) && /No repeated title skeleton/.test(noSkel.nota), noSkel);
check("an empty scan gives no report", RE.buildReport([], "x").ok === false);

const out = RE.findOutliers([10, 12, 11, 9, 100, 13].map((v, i) => ({ title: "Titulo " + i + " sobre el caso", vph: v })));
check("the outliers are read against the median, 3x or more", out.count === 1 && out.ejemplos[0].metric === 100, out);
check("and a sample too short says so in English", RE.findOutliers([{ title: "a", vph: 1 }]).motivo === "too few rows carry a metric");
const readerRows = [10, 12, 11, 9, 100, 13].map((v, i) => ({ title: "Title " + i, views: v + " thousand views", viewsNum: v * 1000 }));
check("a row from the channel reader is measured by its number, not by the text", RE.findOutliers(readerRows).medianaMetric === 11500, RE.findOutliers(readerRows));

const bundle = source("content/nsp-bundle.js");
const used = [...new Set([...bundle.matchAll(/reRep\.([A-Za-z]+)/g)].map(m => m[1]))];
check("the scanner coach only reads fields the report returns", used.length > 0 && used.every(k => k in rep), used);
check("and it calls the report the same way", /NSP_REVERSE_ENGINE\.buildReport\(reVids, reNicho\)/.test(bundle));
check("the engine still loads in the YouTube page world before the scanner", (() => {
  const m = JSON.parse(source("manifest.json"));
  const main = (m.content_scripts || []).find(c => c.world === "MAIN" && (c.js || []).includes("content/nsp-bundle.js"));
  return !!main && main.js.indexOf("knowledge/reverse-engine.js") >= 0 && main.js.indexOf("knowledge/reverse-engine.js") < main.js.indexOf("content/nsp-bundle.js");
})());

done("reverse-engine");
