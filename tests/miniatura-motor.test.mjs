import { load, source, fixture, check, done } from "./engines.mjs";

const ctx = load(["lib/nsp-areas.js", "lib/nsp-miniatura-motor.js", "lib/nsp-miniatura-cohorte.js"]);
const M = ctx.NspMiniatura, C = ctx.NspMiniaturaCohorte, A = ctx.NspAreas;
const IDX = fixture("feed-index.json");

function flat(w, h, r, g, b) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  return { data: d, w, h };
}
function halves(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = x < w / 2 ? 8 : 247, o = (y * w + x) * 4; d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255; }
  return { data: d, w, h };
}
function checker(w, h, side) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = ((Math.floor(x / side) + Math.floor(y / side)) % 2) ? 247 : 8, o = (y * w + x) * 4; d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255; }
  return { data: d, w, h };
}
function strokeBand(w, h, y0, y1, thick) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 90; if (y >= y0 && y < y1 && Math.floor(x / thick) % 2 === 0) v = 250; const o = (y * w + x) * 4; d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255; }
  return { data: d, w, h };
}
function tint(w, h, r, g, b) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const f = 0.55 + 0.45 * (x / w), o = (y * w + x) * 4; d[o] = r * f; d[o + 1] = g * f; d[o + 2] = b * f; d[o + 3] = 255; }
  return { data: d, w, h };
}

check("the thumbnail engine, the cohort and the area table load", !!M && !!C && !!A);
check("the sweep index fixture is read", !!(IDX && IDX.por && Object.keys(IDX.por).length > 100), IDX && Object.keys(IDX.por || {}).length);

const grey = flat(160, 90, 128, 128, 128);
const m = M.medirPixeles(grey.data, 160, 90);
check("a flat grey has no contrast and no colour", m.stdL < 1e-4 && m.meanSat === 0 && m.edgeAvg === 0, m);
const p = M.puntuar(m, 1280);
check("and its score stays in the low band", p.thumbScore < 40 && p.verdict === "HARD TO READ", p.thumbScore + " " + p.verdict);
check("with the five part breakdown intact", p.breakdown.length === 5 && p.breakdown[0].max === 30, p.breakdown);
check("every tip carries a stable code", p.tips.length === p.tipoCodigos.length && p.tipoCodigos.every(c => /^[a-z_]+$/.test(c)), p.tipoCodigos);
const high = M.puntuar({ stdL: 60, meanSat: 0.55, dynRange: 250, edgeAvg: 14, meanL: 130 }, 1280);
check("a thumbnail with everything going for it reaches the high band", high.thumbScore >= 75, high.thumbScore);
check("the score never passes 100", M.puntuar({ stdL: 999, meanSat: 9, dynRange: 999, edgeAvg: 14, meanL: 130 }, 1280).thumbScore <= 100);
check("a small image is called out, with its width", /Low resolution \(640px\)/.test(M.puntuar(m, 640).tips.join(" ")));

const edge = M.legibilidadFeed(halves(1280, 720).data, 1280, 720);
check("a clean edge reaches feed size whole", edge.retencion > 0.95, edge.retencion);
check("and it says which band of the winners it falls in", edge.estado === "alta", edge.estado);
const fine = M.legibilidadFeed(checker(1280, 720, 2).data, 1280, 720);
check("a 2 px texture is almost entirely lost", fine.retencion < 0.05, fine.retencion);
check("and that is said, not dressed up", fine.estado === "baja" && /bottom quarter/.test(fine.dice), fine.estado);
check("big blocks hold", M.legibilidadFeed(checker(1280, 720, 40).data, 1280, 720).retencion > 0.8);
const flatFeed = M.legibilidadFeed(flat(1280, 720, 128, 128, 128).data, 1280, 720);
check("a flat image does not count as lost detail", flatFeed.estado === "sin_bordes", flatFeed.estado);
check("and it explains it", /nearly flat/.test(flatFeed.dice), flatFeed.dice);
check("the feed size is what people see on a phone", edge.lado === "168x94", edge.lado);
check("and it says how much it shrinks", edge.reduccion === 7.6, edge.reduccion);

const band = M.bandasDeTrazo(strokeBand(1280, 720, 470, 560, 6).data, 1280, 720);
check("finds the stroke band that was planted", band.bandas.length === 1, band.bandas);
const expected = (560 - 470) / 720 * 94;
check("and its height at feed size lands where it should", Math.abs(band.altoFeedMax - expected) < 1.5, band.altoFeedMax + " vs " + expected.toFixed(1));
check("it says how much of the height it covers", Math.abs(band.cobertura - 12.5) < 2, band.cobertura);
const noBand = M.bandasDeTrazo(flat(1280, 720, 40, 90, 200).data, 1280, 720);
check("on a plain background it invents no band", noBand.bandas.length === 0, noBand.bandas);
check("and says so instead of staying quiet", /No dense stroke band/.test(noBand.dice), noBand.dice);
check("it does not call it text, which it cannot tell apart", !/\btext\b/i.test(band.dice) && /stroke band/.test(band.dice), band.dice);

const orange = M.paleta(tint(1280, 720, 255, 120, 20).data, 1280, 720);
check("finds the dominant hue of an orange tint", orange.dominantes.length === 1 && orange.dominantes[0].grado === 15, orange.dominantes);
const blue = M.paleta(tint(1280, 720, 20, 90, 255).data, 1280, 720);
check("and of a blue one, a different bucket", blue.dominantes[0].grado === 225, blue.dominantes);
const greyPal = M.paleta(flat(1280, 720, 128, 128, 128).data, 1280, 720);
check("a grey has no dominant hue", greyPal.dominantes.length === 0, greyPal.dominantes);
check("and its measured saturation is zero", greyPal.saturacion === 0, greyPal.saturacion);
check("the twelve buckets add up to the whole", Math.abs(orange.tonos.reduce((a, b) => a + b.peso, 0) - 100) < 0.5);
const full = M.medirCompleto(halves(1280, 720).data, 1280, 720, 1280);
check("the full measurement bundles score, feed, stroke and palette", full.ok && full.puntuacion && full.feed && full.trazo && full.paleta, Object.keys(full));
check("without a canvas the image readers refuse instead of throwing", M.analizarImagen({}).error && M.pixelesDeImagen({}).ok === false, M.pixelesDeImagen({}));

const noIndex = C.cohorteDe(null, "roman empire");
check("without an index there is nothing to compare, and it says so", noIndex.ok === false && noIndex.motivo === "sin_indice", noIndex.motivo);
const religion = C.cohorteDe(IDX, "la biblia y las profecias", { areaDe: A.areaDe });
check("a title from an area with winners gets a cohort", religion.ok === true, religion);
check("and the cohort comes from the area, not the market", religion.ok && religion.clave === "area", religion.clave);
check("capped at the top " + C.TOPE + " winners", religion.ok && religion.videos.length <= C.TOPE, religion.videos && religion.videos.length);
check("sorted by measured views per hour", religion.ok && religion.videos.every((v, i) => i === 0 || religion.videos[i - 1].vph >= v.vph));
check("and it says how many they came from", religion.ok && religion.total >= religion.videos.length, religion.total);
check("the sentence names the area in English", religion.ok && /area, religion,/.test(religion.dice), religion.dice);
const crime = C.cohorteDe(IDX, "serial killer forensic case", { areaDe: A.areaDe });
check("an area with a single winner gives no cohort", crime.ok === false && crime.motivo === "cohorte_corta", crime.motivo);
check("and it says how many it found and how many are needed", /has 1/.test(crime.razon) && new RegExp(C.MINIMO + " are needed").test(crime.razon), crime.razon);
check("the area it names is in English", /area "crime"/.test(crime.razon), crime.razon);
const withMarket = C.cohorteDe(IDX, "serial killer forensic case", { areaDe: A.areaDe, mercado: "PT" });
check("with the video's market there is someone to compare with", withMarket.ok === true && withMarket.clave === "mercado", withMarket);
check("and it records that the area was tried first", withMarket.ok && withMarket.intentos[0].clave === "area", withMarket.intentos);
const own = Object.keys(IDX.por).find(id => A.areaDe(IDX.por[id].titulo) === "religion");
const noSelf = C.cohorteDe(IDX, IDX.por[own].titulo, { areaDe: A.areaDe, excluir: own });
check("a thumbnail is not compared with itself", noSelf.ok && !noSelf.videos.some(v => v.id === own), own);

const pc = C.percentil(50, [10, 20, 30, 40, 60, 70]);
check("the percentile counts how many sit below", pc.ok && pc.porDebajo === 4 && pc.de === 6, pc);
check("without a sample no percentile is computed", C.percentil(5, []).ok === false);
const fake = (c, s, l, ret, tall) => ({
  medidas: { stdL: c, meanSat: s / 100, meanL: l, dynRange: 200, edgeAvg: 14 },
  feed: { retencion: ret, contrasteFeed: c * 0.9 },
  trazo: { altoFeedMax: tall },
  paleta: { tonos: Array.from({ length: 12 }, (_, i) => ({ tono: i, grado: i * 30 + 15, peso: i === 0 ? 40 : 5 })), saturacion: s, luma: l, contraste: c }
});
const winners = Array.from({ length: 12 }, (_, i) => fake(40 + i * 2, 40 + i, 90 + i * 3, 0.5 + i * 0.01, 8 + i));
const mine = fake(70, 70, 150, 0.75, 30);
const cmp = C.comparar(mine, winners);
check("a thumbnail is placed inside the winners' distribution", cmp.ok && cmp.filas.length === C.METRICAS.length, cmp);
check("and the sentence gives the number, not a promise", cmp.ok && /above 12 of 12/.test(cmp.filas[0].dice), cmp.filas && cmp.filas[0].dice);
check("with fewer measured winners than the minimum it refuses", C.comparar(mine, winners.slice(0, 3)).ok === false);
check("and it says how many there were and how many are needed", /Only 3 winner/.test(C.comparar(mine, winners.slice(0, 3)).razon));
const shared = C.paletaComun(winners);
check("the shared palette comes from the winners, not a constant", shared.ok && shared.compartidos.length === 1, shared);
check("and that hue is in all of them", shared.ok && shared.compartidos[0].presencia === 100, shared.compartidos);
check("with a short sample nothing is called shared", C.paletaComun(winners.slice(0, 4)).ok === false);
const noOrange = fake(70, 70, 150, 0.75, 30);
noOrange.paleta.tonos[0].peso = 1;
const gap = C.brechaDePaleta(noOrange.paleta, shared);
check("and it says which hue the winners share and yours lacks", gap.ok && gap.faltan.length === 1, gap.dice);

const text = source("lib/nsp-miniatura-motor.js") + source("lib/nsp-miniatura-cohorte.js");
const PROMISES = [/VIRAL POTENTIAL/i, /\bLOW CTR\b/i, /\bHIGH CTR\b/i, /click ?through rate of/i, /will get \d/i, /guarantee/i, /\bmore views\b/i, /predicted/i];
check("no thumbnail note promises a result", PROMISES.filter(r => r.test(text)).length === 0, PROMISES.filter(r => r.test(text)).map(String));
check("the 80% of views on mobile that nobody measured is gone", !/80% of your views/.test(text));

done("miniatura-motor");
