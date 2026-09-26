import { load, check, done, RIVAL } from "./engines.mjs";

const ctx = load(RIVAL.concat(["lib/nsp-rival-duelo.js"]));
const E = ctx.NSP_RIVAL_EXPEDIENTE;
const D = ctx.NSP_RIVAL_DUELO;

function channel(name, title, views, every) {
  const videos = views.map((v, i) => ({ videoId: name + i, title: title + " " + i, viewsNum: v, published: "hace " + (8 + i * (every || 2)) + " dias" }));
  const e = E.armar({ videos: videos, canal: { nombre: name, url: "https://www.youtube.com/@" + name } });
  e.swept = videos;
  return e;
}

const STORY = "SE RIERON DE LA VIUDA HASTA QUE el hacendado supo la verdad";
const big = channel("Grande", STORY, Array.from({ length: 20 }, (_, i) => 40000 + i * 500), 1);
const small = channel("Chico", STORY, Array.from({ length: 20 }, (_, i) => 3000 + i * 40), 7);

const none = D.comparar(null, small);
check("with one side empty it does not compare", none.ok === false && none.motivo === "sin_expediente", none);
check("and it says both are needed", /Both channels/i.test(none.razon || ""), none.razon);

const d = D.comparar(big, small, big.swept, small.swept);
check("compares and returns rows", d.ok === true && d.filas.length > 0, d.filas.length);
const floor = d.filas.find(f => f.id === "piso");
check("the floor separates the two", floor.estado === "separa", floor);
check("and the higher floor wins it", floor.gana === "a", floor.gana);
const cadence = d.filas.find(f => f.id === "cadencia");
check("cadence goes to the one that uploads more often, not the higher number", cadence.gana === "a", cadence);
check("and the summary counts the axes that separate", /axes separate them/.test(d.resumen), d.resumen);

const axis = D.EJES.find(x => x.id === "ratio");
check("the ratio axis says the low number wins", axis.mejor === "menos", axis.mejor);
const unstable = channel("Inestable", STORY, [400000, 5000, 4000, 6000, 5500, 4500, 5200, 4800, 5100, 4900, 5000, 5000, 4700, 5300, 4600, 5400, 4900, 5100, 5000, 5000], 2);
const dr = D.comparar(small, unstable, small.swept, unstable.swept);
const ratio = dr.filas.find(f => f.id === "ratio");
check("the channel with the runaway ratio loses that row", ratio.estado === "separa" && ratio.gana === "a", ratio);

const twin = channel("Gemelo", STORY, Array.from({ length: 20 }, (_, i) => 40000 + i * 500), 1);
const dt = D.comparar(big, twin, big.swept, twin.swept);
const separate = dt.filas.filter(f => f.estado === "separa");
check("two identical channels separate on no numeric axis", separate.length === 0, separate);
check("and the summary says so without inventing differences", /Nothing separates them/i.test(dt.resumen), dt.resumen);

const noDates = { ok: true, canal: { nombre: "Sin fechas" }, cadencia: { ok: false }, quiebre: { ok: false }, edad: { ok: false }, replicable: { ok: false }, nicho: { ok: false }, etiqueta: "LOOK AT IT" };
const dn = D.comparar(big, noDates, big.swept, []);
const unmeasured = dn.filas.filter(f => f.estado === "sin_medir");
check("axes without data come out unmeasured, not zero", unmeasured.length === D.EJES.length, unmeasured.length);
check("and none of them declares a winner", unmeasured.every(f => f.gana === null));
check("and they say which side was missing", /was not measured/i.test(unmeasured[0].razon || ""), unmeasured[0].razon);
check("the summary carries the unmeasured ones", /not measured/.test(dn.resumen), dn.resumen);

const other = channel("Fabrica", "Visitamos la fabrica de acero de", Array.from({ length: 20 }, () => 40000), 1);
const dd = D.comparar(big, other, big.swept, other.swept);
check("if the titles read as two niches it warns", dd.mismoNicho === false || dd.aviso.length > 0, dd.aviso);
check("two niches nobody could read are not the same niche", dd.mismoNicho !== true, dd.mismoNicho);
check("and it says the niche could not be read instead of staying quiet", /could not be read/i.test(dd.aviso), dd.aviso);
const rep = dd.palabras.find(f => f.id === "replicable");
check("and the rebuildable axis separates them", rep.estado === "separa", rep);

const dialogue = channel("Dialogo", '"VETE DE AQUI" grito la suegra a la viuda embarazada, sin saber', Array.from({ length: 20 }, () => 30000), 1);
const dl = D.comparar(dialogue, small, dialogue.swept, small.swept);
check("it also compares the titles of the two", !!(dl.titulos && dl.titulos.ok), dl.titulos);
const dia = dl.titulos.todos.find(x => x.id === "dialogo");
check("and sees that one uses dialogue and the other does not", dia && dia.fuerza === "probado", dia);

const history = channel("Historia", "The history of the Roman empire explained, part", Array.from({ length: 20 }, () => 30000), 1);
const finance = channel("Finanzas", "How to invest your money in stocks, lesson", Array.from({ length: 20 }, () => 30000), 1);
const dh = D.comparar(history, finance, history.swept, finance.swept);
check("two niches that were read are compared by key", dh.mismoNicho === false, dh.mismoNicho);
check("and the warning names them in English", /History against Finance/.test(dh.aviso), dh.aviso);
const nicheRow = dh.palabras.find(f => f.id === "nicho");
check("and the niche row shows English names", nicheRow.a === "History" && nicheRow.b === "Finance", nicheRow);

done("rival-duelo");
