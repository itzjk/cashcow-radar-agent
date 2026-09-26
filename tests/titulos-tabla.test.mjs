import { writeFileSync } from "node:fs";
import { load, fixture, titleCorpus, note, check, done } from "./engines.mjs";

const ctx = load(["lib/nsp-rpm-tabla.js", "lib/nsp-packaging.js", "lib/nsp-titulos-senales.js", "lib/nsp-titulos-tabla.js"]);
const RPM = ctx.NSP_RPM_TABLA, SN = ctx.NSP_TITULOS_SENALES, PK = ctx.NSP_PACKAGING, T = ctx.NSP_TITULOS_TABLA;

const C = titleCorpus();
for (const v of C) { const r = RPM.resolver(v.titulo, {}); v.nicho = r.label; v.clasificado = r.clasificado; }
const CHANNELS = new Set(C.map(v => v.canal)).size;

const TAM = T.corpus.vistasMax, RAT = T.corpus.vphMin, MIN_D = T.corpus.minDuelos, MIN_Z = T.corpus.minZ;
const MIN_CAN_FRAC = T.corpus.minCanalesFrac, MIN_CAN_ABS = T.corpus.minCanalesAbs;

function pairDuels(l) {
  const p = {}; for (const v of l) (p[v.tema] = p[v.tema] || []).push(v);
  const D = [];
  for (const g of Object.values(p)) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = g[i], b = g[j];
    if (a.canal === b.canal) continue;
    if (Math.max(a.vistas, b.vistas) / Math.min(a.vistas, b.vistas) > TAM) continue;
    if (Math.max(a.vph, b.vph) / Math.min(a.vph, b.vph) < RAT) continue;
    D.push(a.vph > b.vph ? [a, b] : [b, a]);
  }
  return D;
}
function h32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); h ^= h >>> 13; } h = Math.imul(h ^ (h >>> 16), 2246822507); h ^= h >>> 13; return h >>> 0; }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

function channelsPerSignal(D) {
  const base = new Set(), per = {};
  for (const k of SN.CLAVES) per[k] = new Set();
  for (const [g, p] of D) {
    base.add(g.canal); base.add(p.canal);
    const ra = SN.rasgos(g.titulo), rb = SN.rasgos(p.titulo);
    for (const k of SN.CLAVES) {
      if (ra[k] === rb[k]) continue;
      per[k].add(g.canal); per[k].add(p.canal);
    }
  }
  return { base: base.size, per: per };
}
function severalHouses(table, D) {
  const c = channelsPerSignal(D);
  const bar = Math.max(MIN_CAN_ABS, Math.ceil(c.base * MIN_CAN_FRAC));
  const inside = {}, outside = [], count = {};
  for (const k of SN.CLAVES) count[k] = c.per[k] ? c.per[k].size : 0;
  for (const k of Object.keys(table)) {
    if (count[k] < bar) { outside.push(k + " in " + count[k] + " channels, " + bar + " needed"); continue; }
    inside[k] = Object.assign({}, table[k], { canales: count[k] });
  }
  return { tabla: inside, fuera: outside, base: c.base, bar: bar, por: count };
}

check("there is a real corpus", C.length >= 4000, C.length);
const D = pairDuels(C);
check("the duels come out with the size held", D.length >= 3000, D.length);
check("the table does not claim more data than there is", C.length >= T.corpus.videos, T.corpus.videos + " vs " + C.length);

const drift = Math.abs(C.length - T.corpus.videos) / T.corpus.videos;
const channelDrift = Math.abs(CHANNELS - T.corpus.canales) / T.corpus.canales;
check("and it has not fallen more than 20% behind", drift <= 0.20, T.corpus.videos + " videos in the table (" + T.generado + "), " + C.length + " in the fixture, " + (drift * 100).toFixed(1) + "% behind");
check("it declares how many channels it was built on, and that still holds", channelDrift <= 0.20, T.corpus.canales + " vs " + CHANNELS + ", " + (channelDrift * 100).toFixed(1) + "% apart");

const crude = SN.aprender(D, MIN_D, MIN_Z);
const houses = severalHouses(crude, D);
const general = houses.tabla;
note("house gate: " + houses.bar + " channels, " + Math.round(MIN_CAN_FRAC * 100) + "% of the " + houses.base + " that bring duels; " + Object.keys(general).length + " of " + Object.keys(crude).length + " signals pass");

const noHouses = Object.keys(T.general).filter(k => !(T.general[k] && T.general[k].canales > 0));
const weak = Object.keys(T.general).filter(k => T.general[k] && T.general[k].canales > 0 && houses.por[k] !== undefined && houses.por[k] < houses.bar);
check("every signal in the table declares its houses and still sits in several", noHouses.length === 0 && weak.length === 0, noHouses.concat(weak));

const weight = x => (x && typeof x === "object" ? x.peso : x) || 0;
const today = Object.keys(general).sort();
const lost = Object.keys(T.general).filter(k => today.indexOf(k) < 0);
const moved = today.filter(k => T.general[k] !== undefined && Math.abs(weight(T.general[k]) - weight(general[k])) > 15);
const fresh = today.filter(k => T.general[k] === undefined);
check("no signal in the table has lost the data behind it", lost.length === 0, lost);
check("and none moved more than 15 points of weight", moved.length === 0, moved.map(k => k + " " + weight(T.general[k]) + " -> " + weight(general[k])));
if (fresh.length) note("the fixture backs signal(s) the table does not carry yet: " + fresh.join(", "));
const flipped = today.filter(k => T.general[k] !== undefined && Math.sign(weight(T.general[k])) !== 0 && Math.sign(weight(general[k])) !== 0 && Math.sign(weight(T.general[k])) !== Math.sign(weight(general[k])));
check("no signal flipped its sign", flipped.length === 0, flipped);

function validate(list, own, minT, seed) {
  const cl = [...new Set(list.map(v => v.canal))], pn = [], pg = [], bs = [];
  for (let s = 1; s <= 20; s++) {
    const train = new Set(cl.filter(c => h32(seed + s + c) % 2 === 0));
    const A = list.filter(v => train.has(v.canal)), B = list.filter(v => !train.has(v.canal));
    const DA = pairDuels(A);
    const w = severalHouses(SN.aprender(DA, own ? 25 : MIN_D, own ? 1.6 : MIN_Z), DA).tabla;
    let a1 = 0, t1 = 0, a2 = 0, t2 = 0, bo = 0, bn = 0;
    for (const [g, p] of pairDuels(B)) {
      const x = SN.puntuarCon(g.titulo, w).bruto, y = SN.puntuarCon(p.titulo, w).bruto;
      if (x !== y) { t1++; if (x > y) a1++; }
      const u = SN.puntuarCon(g.titulo, general).bruto, v2 = SN.puntuarCon(p.titulo, general).bruto;
      if (u !== v2) { t2++; if (u > v2) a2++; }
      if (g.vistas !== p.vistas) { bn++; if (g.vistas > p.vistas) bo++; }
    }
    if (t1 >= minT && t2 >= minT) { pn.push(a1 / t1); pg.push(a2 / t2); bs.push(bo / bn); }
  }
  return { pn, pg, bs };
}
const gv = validate(C, false, 60, "g");
const accuracy = +(mean(gv.pn) * 100).toFixed(1), sizeBase = +(mean(gv.bs) * 100).toFixed(1);
note("calibration: table " + T.calibracion.acierto + "% over " + T.calibracion.divisiones + " splits, fixture " + accuracy + "% over " + gv.pn.length);
check("the recorded calibration holds without degrading", accuracy >= T.calibracion.acierto - 5.0, T.calibracion.acierto + " vs " + accuracy);
check("it beats chance with room to spare", accuracy >= 60, accuracy);
check("it beats 'the bigger video wins'", accuracy > sizeBase, accuracy + " vs " + sizeBase);
check("no split falls below chance", +(Math.min(...gv.pn) * 100).toFixed(1) >= 50, (Math.min(...gv.pn) * 100).toFixed(1));

const groups = {};
for (const v of C) {
  (groups["mercado:" + v.mercado] = groups["mercado:" + v.mercado] || []).push(v);
  if (v.clasificado) (groups["nicho:" + v.nicho] = groups["nicho:" + v.nicho] || []).push(v);
}
const admitted = {};
for (const [k, l] of Object.entries(groups)) {
  const name = k.slice(k.indexOf(":") + 1);
  if (!name) continue;
  if (pairDuels(l).length < 200) continue;
  const v = validate(l, true, 25, "m");
  if (v.pn.length < 10) continue;
  const a = +(mean(v.pn) * 100).toFixed(1), g = +(mean(v.pg) * 100).toFixed(1);
  if (a <= g) continue;
  admitted[name] = { acierto: a, general: g, divisiones: v.pn.length };
}
const kept = Object.keys(T.segmentos).filter(k => admitted[k]);
check("no segment the table carries has disappeared", kept.length === Object.keys(T.segmentos).length, Object.keys(admitted));
const degraded = Object.keys(admitted).filter(k => T.segmentos[k] && admitted[k].acierto < T.segmentos[k].acierto - 5.0);
note("segments on the fixture: " + Object.keys(admitted).map(k => k + " " + admitted[k].acierto + "% against general " + admitted[k].general + "%").join(" | "));
check("and no recorded segment has degraded", degraded.length === 0, degraded);
check("every admitted segment beats the general table", Object.keys(admitted).every(k => admitted[k].acierto > admitted[k].general), admitted);
check("the gate really rejects, not only admits", T.rechazados.some(x => x.grupo === "PT") && T.rechazados.length >= 5, T.rechazados.length);
check("no niche gets in without data behind it", Object.keys(T.segmentos).filter(k => T.segmentos[k].tipo === "nicho").length === 0, T.segmentos);

function days(s) { const m = /(\d+)\s*(d[ií]a|semana|mes|a[nñ]o)/.exec(s || ""); if (!m) return null; const n = +m[1], u = m[2]; return n * (u.startsWith("d") ? 1 : u.startsWith("sem") ? 7 : u.startsWith("mes") ? 30 : 365); }
const V = fixture("rancho-channel.json").map(c => ({ t: c.title, d: days(c.cuando), v: c.views })).filter(x => x.d).map(x => ({ t: x.t, vpd: x.v / x.d }));
function rate(f) {
  let ok = 0, tot = 0;
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    const a = f(V[i].t), b = f(V[j].t);
    if (V[i].vpd === V[j].vpd || a === b) continue; tot++;
    if ((V[i].vpd > V[j].vpd) === (a > b)) ok++;
  }
  return +(ok / tot * 100).toFixed(1);
}
const tPk = rate(t => PK.puntuar(t).packagingScore);
const tGen = rate(t => SN.puntuarCon(t, T.general).bruto);
check("there is a reference channel corpus", V.length >= 25, V.length);
check("the recorded melodrama engine reproduces", tPk === T.nichoMotor["Melodrama campirano"].acierto && tGen === T.nichoMotor["Melodrama campirano"].general, tPk + " vs " + tGen);
check("and there the general table is worse than chance, which is why the niche engine exists", tGen < 50, tGen);

function quantile(sorted, q) { return sorted[Math.round(q * (sorted.length - 1))]; }
function measureSpread(weights) {
  const all = C.map(v => SN.puntuarCon(v.titulo, weights).bruto).sort((a, b) => a - b);
  const reparto = { n: all.length, min: all[0], max: all[all.length - 1], escalones: [] };
  for (let i = 0; i <= 20; i++) reparto.escalones.push(quantile(all, i / 20));
  const byNiche = {};
  for (const v of C) (byNiche[v.nicho] = byNiche[v.nicho] || []).push(v);
  const referencia = {};
  for (const [niche, list] of Object.entries(byNiche)) {
    if (!niche || list.length < 40) continue;
    const scored = list.map(v => ({ titulo: v.titulo, vph: v.vph, bruto: SN.puntuarCon(v.titulo, weights).bruto }));
    const b = scored.map(x => x.bruto).sort((x, y) => x - y);
    referencia[niche] = {
      n: list.length, p10: quantile(b, 0.10), p25: quantile(b, 0.25), mediana: quantile(b, 0.50), p75: quantile(b, 0.75), p90: quantile(b, 0.90),
      ganadores: scored.sort((x, y) => y.vph - x.vph).slice(0, 5)
    };
  }
  return { reparto, referencia };
}
const spread = measureSpread(T.general);
const stepsOff = spread.reparto.escalones.filter((x, i) => Math.abs(x - T.reparto.escalones[i]) > 3).length;
check("the recorded score distribution matches these weights on this corpus", T.reparto.n === C.length && stepsOff === 0, T.reparto.n + " vs " + C.length + " titles, " + stepsOff + " of 21 steps off by more than 3");
const refOff = Object.keys(spread.referencia).filter(k => !T.referencia[k] || Math.abs(T.referencia[k].mediana - spread.referencia[k].mediana) > 3 || T.referencia[k].n !== spread.referencia[k].n);
const refGone = Object.keys(T.referencia).filter(k => !spread.referencia[k]);
check("every niche reference matches these weights and this corpus", refOff.length === 0 && refGone.length === 0, refOff.concat(refGone));

if (process.env.ZERACK_REGENERATE_TABLE === "1") {
  const fresh = measureSpread(general);
  const out = Object.assign({}, T, {
    generado: new Date().toISOString().slice(0, 10),
    corpus: Object.assign({}, T.corpus, { videos: C.length, canales: CHANNELS, canalesDuelo: houses.base, duelos: D.length }),
    calibracion: Object.assign({}, T.calibracion, {
      acierto: accuracy, divisiones: gv.pn.length,
      min: +(Math.min(...gv.pn) * 100).toFixed(1), max: +(Math.max(...gv.pn) * 100).toFixed(1), baseVistas: sizeBase
    }),
    general: general,
    segmentos: admitted,
    reparto: fresh.reparto,
    referencia: fresh.referencia,
    nichoMotor: Object.assign({}, T.nichoMotor, {
      "Melodrama campirano": Object.assign({}, T.nichoMotor["Melodrama campirano"], { acierto: tPk, general: rate(t => SN.puntuarCon(t, general).bruto) })
    })
  });
  writeFileSync(new URL("./.regenerated-table.json", import.meta.url), JSON.stringify(out, null, 2));
  note("regenerated into tests/.regenerated-table.json: " + C.length + " videos, " + D.length + " duels, " + accuracy + "% over " + gv.pn.length + " splits");
}

done("titulos-tabla (table " + (drift * 100).toFixed(1) + "% behind this fixture)");
