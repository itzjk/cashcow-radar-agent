import { load, rancho, check, done } from "./engines.mjs";

const ctx = load(["lib/nsp-cadencia.js", "lib/nsp-packaging.js", "lib/nsp-rival-formula.js", "lib/nsp-rival-quiebre.js"]);
const Q = ctx.NSP_RIVAL_QUIEBRE;

function channel(newestFirst) {
  return newestFirst.map((v, i) => ({ videoId: "v" + i, title: "Video " + i, viewsNum: v, published: "hace " + (3 + i * 2) + " dias" }));
}

const short = Q.medir(channel([100, 200, 300]));
check("with three videos it invents no break", short.ok === false && short.motivo === "sin_historia", short);
check("and it says how many are needed", /at least 14/.test(short.razon || ""), short.razon);
check("an empty list does not throw", Q.medir([]).ok === false);
check("the minimum is declared, not hidden", Q.MINIMO === 14, Q.MINIMO);

const flat = Q.medir(channel(Array.from({ length: 20 }, () => 10000)));
check("a flat channel has no break", flat.ok === true && flat.hubo === false, flat);
check("and it still gives the best lift it found", flat.salto >= 0, flat.salto);
check("and says what it has is its steady format", /no turning point/i.test(flat.dice), flat.dice);

const spike = Q.medir(channel([1000, 1000, 1000, 1000, 1000, 1000, 1000, 900000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]));
check("a 900,000 view video among 1,000 view videos is not a break", spike.ok && spike.hubo === false, spike.salto);
check("and the most viewed still comes back, so nobody has to look for it", spike.masVisto && spike.masVisto.views === 900000, spike.masVisto);

const lift = Q.medir(channel([30000, 28000, 34000, 31000, 29000, 33000, 27000, 32000, 1200, 900, 1100, 1000, 950, 1050, 980, 1020, 1010, 990]));
check("a floor that rises and stays up is a break", lift.ok && lift.hubo === true, lift.salto);
check("and it names the position", lift.posicion > 1 && lift.posicion <= lift.total, lift.posicion + " of " + lift.total);
check("with the median before and after, not one number", lift.medianaAntes > 0 && lift.medianaDespues > lift.medianaAntes, [lift.medianaAntes, lift.medianaDespues]);

const middle = Q.medir(channel([25000, 24000, 26000, 23000, 25000, 24000, 25000, 26000, 11000, 12000, 12500, 11500, 12000, 11800, 12200, 11900, 12100, 12000]));
check("a 2.1x lift is neither a break nor silence: it leans", middle.ok && middle.hubo === false && middle.apunta === true, middle.salto);
check("and it says how far it fell short", /under the 3x/.test(middle.dice), middle.dice);

const withOld = Q.cronologico(channel([58000, 46000, 31000, 27000, 24000, 16000, 15000, 14000, 12000, 11000, 664, 500, 400, 900, 700, 800]));
const run = Q.estabilidad(withOld);
check("the recent run ignores what came before the break", run.ok === true, run);
check("and its threshold comes from the cadence, not a copy", run.umbral === ctx.NSP_CADENCIA.VERDE, run.umbral);
check("the run starts after the old video", run.ok && run.piso >= 11000, run.piso);
const bouncing = Q.estabilidad(Q.cronologico(channel([100000, 500, 90000, 400, 80000, 300, 70000, 600, 60000, 200, 50000, 700, 40000, 800, 30000, 900])));
check("a bouncing channel has no run, and says so", bouncing.ok === false, bouncing.razon);
check("and no run is made up from fewer than eight videos", Q.estabilidad(Q.cronologico(channel([1000, 1100, 1200]))).ok === false);
check("the minimum run is declared", Q.MIN_RACHA === 8, Q.MIN_RACHA);

const q = Q.medir(rancho());
check("finds the turning point of the real channel", q.ok && q.hubo === true, q.salto + "x at " + q.posicion + " of " + q.total);
check("and names the video, not only the number", !!(q.video && q.video.title), q.video);
check("and says what was written differently afterwards", !!(q.queCambio && q.queCambio.ok), q.queCambio);
check("the real channel's recent run reads 5.8x", q.estable.ok && q.estable.ratio === 5.8, q.estable);
check("and it is ten videos, not twelve", q.estable.ok && q.estable.videos === 10, q.estable.videos);

const same = Array.from({ length: 16 }, (_, i) => ({ videoId: "x" + i, title: "T" + i, viewsNum: 40000 - i * 2000, published: "hace 1 mes" }));
const c = Q.cronologico(same);
check("with equal dates it keeps the sweep order", c[0].videoId === "x15" && c[15].videoId === "x0", [c[0].videoId, c[15].videoId]);
check("and the newest ends up last, not first", c[c.length - 1].views === 40000, c[c.length - 1].views);

done("rival-quiebre");
