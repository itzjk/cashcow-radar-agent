import { load, source, check, done } from "./engines.mjs";

const g = load(["lib/nsp-rpm-tabla.js", "lib/nsp-veredicto.js", "lib/nsp-dinero-rpm.js", "lib/nsp-dinero-coste.js", "lib/nsp-dinero-equilibrio.js", "lib/nsp-dinero-cartera.js"]);
const RPM = g.NspDineroRpm, COST = g.NspDineroCoste, EQ = g.NspDineroEquilibrio, CART = g.NspDineroCartera, V = g.NSP_VEREDICTO, TABLE = g.NSP_RPM_TABLA;

{
  const p = RPM.proyeccion({ tema: "ancient rome history documentary", idioma: "de", vistasMes: 120000, duracionSegundos: 900 });
  check("a projection comes out", p.ok === true, p);
  const last = p.ok ? p.cuenta[p.cuenta.length - 1] : "";
  check("the last line is the whole multiplication, not only the result", /120000 views \/ 1000 x \$[\d.]+ = \$[\d.]+ per month/.test(last), last);
  check("the working names the niche base and the market multiplier", p.ok && p.cuenta.some(x => /base \$/.test(x)) && p.cuenta.some(x => /Market de x/.test(x)), p.cuenta);
  check("the niche it names is in English", p.ok && p.cuenta[0].indexOf("Niche read as History") === 0 && p.nombre === "History", p.cuenta[0]);
  const sum = p.ok ? Math.round(p.vistasMes / 1000 * p.rpm * 100) / 100 : -1;
  check("the number on screen is the number in the working", p.ok && Math.abs(sum - p.usdMes) < 0.01, sum + " vs " + p.usdMes);
}
{
  const p = RPM.proyeccion({ tema: "personal finance investing", idioma: "en", vistasMes: 50000 });
  check("the RPM table still declares itself unmeasured", TABLE.measured !== true, TABLE.measured);
  check("and the result is stamped as an estimate", p.ok && p.sello === "ESTIMATE" && p.estimacion === true, p.sello);
  check("the reason says so in full", p.ok && /ESTIMATE/.test(p.porque) && /YouTube Studio/.test(p.porque), p.porque);
  const before = TABLE.measured;
  TABLE.measured = true;
  const q = RPM.proyeccion({ tema: "personal finance investing", idioma: "en", vistasMes: 50000 });
  TABLE.measured = before;
  check("the stamp follows the table and is not written by hand", q.ok && q.sello === "MEASURED" && q.estimacion === false, q.sello);
  check("and it goes back to estimate when the table does", RPM.proyeccion({ tema: "x", idioma: "en", vistasMes: 1 }).sello === "ESTIMATE");
}
{
  const p = RPM.proyeccion({ tema: "history", idioma: "en", vistasMes: "" });
  check("without views it returns no zero dollars, it refuses", p.ok === false && p.motivo === "sin_vistas", p.porque);
  const q = RPM.proyeccion({ tema: "", idioma: "en", vistasMes: 1000 });
  check("without a topic it picks no rate on its own", q.ok === false && q.motivo === "sin_tema", q.porque);
}
{
  const p = RPM.proyeccion({ tema: "history documentary", idioma: "da", vistasMes: 10000 });
  check("Danish has no citable multiplier and is marked", p.ok && p.sinReferenciaDeMercado === true && p.multiplicadorMercado === TABLE.mercadoNeutro, p.multiplicadorMercado);
  check("and the working writes it on the market line", p.ok && p.cuenta.some(x => /no citable reference/.test(x)), p.cuenta);
}
{
  const p = RPM.proyeccion({ tema: "history", idioma: "en", vistasMes: 10000 });
  const fields = p.ok ? Object.keys(p).join(" ").toLowerCase() : "";
  check("no field of the result is a CTR or a retention", !/ctr|retenc|retention|clickthrough|click_through/.test(fields), fields);
  check("and the list of what is not estimated names both", p.ok && /click-through/.test(p.noEstimamos.join(" ")) && /retention/.test(p.noEstimamos.join(" ")), p.noEstimamos);
  const files = ["lib/nsp-dinero-rpm.js", "lib/nsp-dinero-coste.js", "lib/nsp-dinero-equilibrio.js", "lib/nsp-dinero-cartera.js", "lib/nsp-dinero-riesgo.js"];
  const dirty = files.filter(f => /['"][^'"]*\d\s*%[^'"]*['"]|['"]\s*%\s*['"]/.test(source(f)));
  check("no money module spits out a loose percentage", dirty.length === 0, dirty);
}
{
  const use = { caracteresNarracion: 9000, imagenes: 40, segundosVideo: 0 };
  const fish = COST.costeCarril("voz_fish", use, { moneda: "USD" });
  check("a paid lane with no rate returns nothing, not zero", fish.usd === null && fish.sinTarifa === true, fish.cuenta);
  const local = COST.costeCarril("voz_local", use, { moneda: "USD" });
  check("the local lane costs zero because no money leaves, and says so", local.usd === 0 && local.gratis === true, local.cuenta);
  const t = { fish_por_1000_caracteres: 0.15, gemini_por_imagen: 0.04, gemini_por_segundo_video: null, moneda: "USD" };
  const rated = COST.costeCarril("voz_fish", use, t);
  check("with a rate the working is the visible multiplication", /9000 \/ 1000 x \$0.15 = \$1.35/.test(rated.cuenta), rated.cuenta);
  check("and the number adds up", Math.abs(rated.usd - 1.35) < 1e-9, rated.usd);
  const total = COST.costePorVideo({ elegidas: ["voz_fish", "imagen_gemini", "video_gemini"], consumo: { caracteresNarracion: 9000, imagenes: 40, segundosVideo: 30 }, tarifas: t });
  check("if a chosen lane has no rate there is NO partial total dressed as a total", total.ok && total.usdPorVideo === null && total.incompleto === true, total.porque);
  const good = COST.costePorVideo({ elegidas: ["voz_fish", "imagen_gemini", "video_ninguno"], consumo: use, tarifas: t });
  check("with every lane rated there is a total", good.ok && Math.abs(good.usdPorVideo - (1.35 + 1.6)) < 1e-9, good.usdPorVideo);
  check("an unknown lane is refused, not priced", COST.costeCarril("voz_otra", use, t).ok === false);
}
{
  const t = { fish_por_1000_caracteres: 0.15, gemini_por_imagen: 0.04, gemini_por_segundo_video: 0.2 };
  const c = COST.costePorVideo({ elegidas: ["voz_fish", "imagen_gemini"], consumo: { caracteresNarracion: 1000, imagenes: 1 }, tarifas: t });
  check("the result never carries permission to spend", c.gastoPermitido === false);
  check("and it warns that a saved key opens nothing", /not permission to spend/i.test(c.avisoGasto), c.avisoGasto);
  check("it names the spend gates the chosen lanes would need", c.puertasDeGasto.length === 2 && c.puertasDeGasto.indexOf("vision") >= 0, c.puertasDeGasto);
  const cmp = COST.comparar({ consumo: { caracteresNarracion: 9000, imagenes: 40, segundosVideo: 30 }, tarifas: { fish_por_1000_caracteres: 0.15 } });
  check("compare leaves the lanes with no rate out of the ranking, not at the top", cmp.conocidas.every(x => x.usd !== null) && cmp.desconocidas.length > 0 && cmp.desconocidas.every(x => x.usd === null), cmp.porque);
}
{
  const measured = EQ.equilibrio({ ingresoPorVideo: 12, costePorVideo: 3, costeFijoMes: 90, medidas: [{ vistas: 1000, rpm: 5 }] });
  check("with a real measured reading it refuses to estimate", measured.ok === false && measured.motivo === "hay_medicion", measured.porque);
  check("and it hands over to the measured engine by its stable code", measured.usar === "NSPSaludCanales.salud", measured.usar);
  check("without naming an internal engine to the person", !/NSPSaludCanales/.test(measured.porque), measured.porque);
  const e = EQ.equilibrio({ ingresoPorVideo: 12, costePorVideo: 3, costeFijoMes: 90, videosPorMes: 30, rpm: 6, medidas: [] });
  check("without a measurement it estimates, stamped", e.ok === true && e.sello === "ESTIMATE", e.margenPorVideo);
  check("videos to cover the fixed cost = fixed / margin", e.ok && e.videosParaCubrirFijo === Math.ceil(90 / 9), e.videosParaCubrirFijo);
  check("the working is written, not only the result", e.ok && e.cuenta.some(x => /Fixed cost \$90.00 per month \/ margin \$9.00 = 10 videos/.test(x)), e.cuenta);
  const bad = EQ.equilibrio({ ingresoPorVideo: 2, costePorVideo: 5, costeFijoMes: 90, medidas: [] });
  check("with a negative margin no volume covers anything, and it says so", bad.ok && bad.videosParaCubrirFijo === null && /more output is more loss/.test(bad.porque), bad.margenPorVideo);
  const missing = EQ.equilibrio({ ingresoPorVideo: 12, costePorVideo: null, medidas: [] });
  check("without a cost per video none is invented", missing.ok === false && missing.motivo === "faltan_datos", missing.porque);
}
{
  const h = CART.porHora([
    { nombre: "DE history", usdMes: 900, horasMes: 30 },
    { nombre: "FR mystery", usdMes: 400, horasMes: 40 },
    { nombre: "DA sleep", usdMes: 250, horasMes: null }
  ]);
  check("ranks by dollars per hour", h.ok && h.mejor.nombre === "DE history" && h.mejor.usdPorHora === 30, h.mejor);
  check("the channel with no hours stays out of the ranking, not at zero", h.ok && h.filas.length === 2 && h.sinDato.length === 1 && h.sinDato[0].nombre === "DA sleep", h.sinDato);
  check("and the reason says X of Y", h.ok && /2 of 3 channels/.test(h.porque), h.porque);
}
{
  const d = CART.dineroEnRiesgo([
    { nombre: "DE history", usdMes: 900, veredicto: V.SIRVE },
    { nombre: "FR mystery", usdMes: 400, veredicto: V.MIRARLO },
    { nombre: "EN crime", usdMes: 300, veredicto: V.NO_SIRVE },
    { nombre: "ES sleep", usdMes: null, veredicto: V.MIRARLO },
    { nombre: "PT facts", usdMes: 100, veredicto: "" }
  ]);
  check("adds up what is exposed in the two states that are not KEEP", d.ok && d.expuesto === 700, d.expuesto);
  check("a channel with a verdict and no figure adds no zero, it stays apart", d.ok && d.sinDinero.length === 1 && d.sinDinero[0].nombre === "ES sleep", d.sinDinero);
  check("a channel with no verdict is counted in no bucket", d.ok && d.sinVeredicto.length === 1, d.sinVeredicto);
  check("it speaks with the house labels", d.ok && d.porque.includes(V.ETIQUETA[V.MIRARLO]) && d.porque.includes(V.ETIQUETA[V.NO_SIRVE]), d.porque);
}
{
  const c = CART.caminoAlObjetivo([{ nombre: "a", usdMes: 900 }, { nombre: "b", usdMes: 400 }, { nombre: "c", usdMes: 300 }, { nombre: "d", usdMes: null }], 10000);
  check("adds up the estimate and says how much is missing", c.ok && c.total === 1600 && c.falta === 8400, c.falta);
  check("the median drives how many channels are missing", c.ok && c.mediana === 400 && c.canalesQueFaltan === Math.ceil(8400 / 400), c.canalesQueFaltan);
  check("it says over how many channels it worked", c.ok && /3 of 4 channels/.test(c.cuenta.join(" ")), c.cuenta);
  check("stamped as an estimate", c.ok && c.sello === "ESTIMATE" && /ESTIMATE/.test(c.porque), c.porque);
  const none = CART.caminoAlObjetivo([{ nombre: "a", usdMes: null }], 10000);
  check("without a single estimate it refuses to measure the distance", none.ok === false && none.motivo === "sin_estimacion", none.porque);
}

done("dinero-cuenta");
