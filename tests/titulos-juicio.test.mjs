import { load, titleCorpus, check, done, TITLES } from "./engines.mjs";

const ctx = load(TITLES);
const N = ctx.NSP_TITULOS, T = ctx.NSP_TITULOS_TABLA;

const C = titleCorpus();
check("there is a real corpus to measure", C.length >= 4000, C.length);

const D = [];
{
  const p = {}; for (const v of C) (p[v.tema] = p[v.tema] || []).push(v);
  for (const g of Object.values(p)) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = g[i], b = g[j];
    if (a.canal === b.canal) continue;
    if (Math.max(a.vistas, b.vistas) / Math.min(a.vistas, b.vistas) > T.corpus.vistasMax) continue;
    if (Math.max(a.vph, b.vph) / Math.min(a.vph, b.vph) < T.corpus.vphMin) continue;
    D.push(a.vph > b.vph ? [a, b] : [b, a]);
  }
}
check("there are real duels with the size held", D.length >= 3000, D.length);

let right = 0, total = 0, called = 0, calledRight = 0, look = 0;
for (const [g, p] of D) {
  const a = N.puntuar(g.titulo).bruto, b = N.puntuar(p.titulo).bruto;
  if (a !== b) { total++; if (a > b) right++; }
  const c = N.comparar(g.titulo, p.titulo);
  if (c.estado === "llamado") { called++; if (c.gana === "a") calledRight++; }
  else if (c.estado === "mirar") look++;
}
const rate = right / total * 100, calledRate = calledRight / called * 100;
console.log("  ..    score: " + rate.toFixed(1) + "% of " + total + " duels; compare: " + calledRate.toFixed(1) + "% of the " + called + " it calls, " + look + " left to look at");
check("scoring separates winner from loser inside the sample", rate >= 65, rate.toFixed(1));
check("compare is right more often when it dares to call", calledRate > rate, calledRate.toFixed(1));
check("and it stays quiet on the close ones", look > 0 && look / D.length < 0.4, look + " of " + D.length);
check("the recorded coverage matches the measured one", Math.abs(called / D.length * 100 - T.margen.cubre) <= 6, T.margen.cubre + " vs " + (called / D.length * 100).toFixed(0));

const A = "Su Tío Vendió la Casa y la Echó—Sin Saber el Secreto que el gato Escondía…";
const B = "TODOS SE RIERON DEL VIEJO POR REGAR CENIZA EN SU MILPA… 3 COSECHAS DESPUÉS, LE PIDIERON PERDÓN";
const pa = N.puntuar(A), pb = N.puntuar(B, { nicho: "Melodrama campirano" });
check("the melodrama title goes to its niche engine", pa.motor === "melodrama", pa.motor);
check("and the 537,000 view one beats the 494 view one", pa.puntos > pb.puntos, [pa.puntos, pb.puntos]);
check("the melodrama reasons are English, keyed by stable ids", pa.aFavor.length > 0 && pa.aFavor.every(x => /^[a-z_]+$/.test(x.clave) && /^[a-z0-9 ,]+$/i.test(x.etiqueta)), pa.aFavor);
const duel = N.comparar(A, B, { nicho: "Melodrama campirano" });
check("the duel is called and gives its reasons", duel.estado === "llamado" && duel.gana === "a" && duel.motivos.length > 0, duel.estado);

const doc = "The Roman Empire Explained | Full Documentary - Part 3 (2024)";
const c1 = N.contra(doc);
check("what counts against comes with its duels", c1.enContra.length >= 3 && c1.enContra.every(x => x.duelos > 0 && x.peso < 0), c1.enContra);
check("and it is sorted by what it costs", c1.enContra[0].peso <= c1.enContra[c1.enContra.length - 1].peso, c1.enContra.map(x => x.peso));
const clean = N.contra("SIN SABER QUE SU HIJA ERA LA DUEÑA");
check("a title with no dead weight says so and invents no negatives", clean.enContra.length === 0 || clean.coste < c1.coste, clean.enContra);

check("a calibrated market switches table", N.puntuar(doc, { mercado: "ES" }).motor === "segmento" && N.puntuar(doc, { mercado: "ES" }).segmento === "ES");
check("an uncalibrated market falls to the general table and says so", N.puntuar(doc, { mercado: "PT" }).motor === "general" && N.puntuar(doc, { mercado: "PT" }).segmento === "");
check("a niche with no engine of its own is marked", N.puntuar(doc, { nicho: "Historia" }).sinTablaDeNicho === true);
check("an empty title returns no number", N.puntuar("  ").vacio === true && N.contra("").vacio === true);

const ref = N.contraGanadores(doc, { nicho: "Lujo" });
check("against the niche winners it names the niche in English", ref.hayReferencia === true && /median/.test(ref.razon), ref.razon);
const RPM = ctx.NSP_RPM_TABLA;
const thin = RPM.rows.map(r => r.label).find(l => l && !T.referencia[l]);
const noRef = thin ? N.contraGanadores(doc, { nicho: thin }) : null;
check("a niche with too few titles is named in English and refuses", !!noRef && noRef.hayReferencia === false && noRef.razon.indexOf("for " + RPM.nombreDe(thin) + ",") >= 0, thin + ": " + (noRef && noRef.razon));
const axis = N.ejePackaging("SIN SABER QUE SU HIJA ERA LA DUEÑA DEL RANCHO", doc);
check("the packaging axis names engines in English", axis.estado === "sin_medir" && /ranch melodrama/.test(axis.razon) && !/segmento/.test(axis.razon), axis.razon);

done("titulos-juicio");
