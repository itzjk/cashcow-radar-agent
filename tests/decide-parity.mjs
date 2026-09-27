// Pinned cases for the decision engine; ZERACK_BANDIT and ZERACK_RADAR point at the originals, and --write records their answers.
import { writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const GOLDEN = join(HERE, "decide-parity.json");

export const BANDIT_SETS = [
  { name: "two arms, clear gap, 1,000 each", seed: 7, arms: [{ impressions: 1000, clicks: 50 }, { impressions: 1000, clicks: 80 }] },
  { name: "two arms under 200 impressions", seed: 42, arms: [{ impressions: 120, clicks: 6 }, { impressions: 130, clicks: 9 }] },
  { name: "three arms, 5,000 each", seed: 1234, arms: [{ impressions: 5000, clicks: 250 }, { impressions: 5000, clicks: 260 }, { impressions: 5000, clicks: 330 }] },
  { name: "two arms level", seed: 99, arms: [{ impressions: 4000, clicks: 200 }, { impressions: 4000, clicks: 201 }] },
  { name: "four arms, uneven traffic", seed: 2026, arms: [{ impressions: 800, clicks: 12 }, { impressions: 2400, clicks: 96 }, { impressions: 300, clicks: 3 }, { impressions: 1500, clicks: 45 }] },
  { name: "strong winner, 3,000 each", seed: 5, arms: [{ impressions: 3000, clicks: 60 }, { impressions: 3100, clicks: 124 }] },
  { name: "one arm under the floor", seed: 11, arms: [{ impressions: 150, clicks: 9 }] },
  { name: "no arms", seed: 3, arms: [] },
  { name: "posterior mean rule", seed: 8, arms: [{ impressions: 600, clicks: 30 }, { impressions: 640, clicks: 38 }], options: { candidateRule: "posteriorMean", samples: 5000 } },
  { name: "sampled rule with a lower bar", seed: 13, arms: [{ impressions: 900, clicks: 27 }, { impressions: 950, clicks: 40 }], options: { candidateRule: "sample", threshold: 0.9, minImpressions: 100, samples: 8000 } }
];

export const MIXTURE_SETS = [
  { arms: [{ impressions: 1000, clicks: 50 }, { impressions: 1000, clicks: 80 }], priorAlpha: 0.5, priorBeta: 0.5 },
  { arms: [{ impressions: 200, clicks: 10 }, { impressions: 210, clicks: 12 }, { impressions: 190, clicks: 30 }], priorAlpha: 1, priorBeta: 1 }
];

export const TRAFFIC_SETS = [
  { seed: 21, arms: [{ impressions: 0, clicks: 0 }, { impressions: 0, clicks: 0 }], rates: [0.04, 0.07], impressions: 600, allocation: "thompson" },
  { seed: 22, arms: [{ impressions: 10, clicks: 1 }, { impressions: 12, clicks: 0 }, { impressions: 9, clicks: 2 }], rates: [0.05, 0.02, 0.1], impressions: 450, allocation: "even" }
];

const radarSeries = m => ({ canalId: "UCprueba", nombre: "prueba", medidas: m });
const burst = [
  { t: 0, subs: 1000, vph: 100, vistas: 1000 },
  { t: 10, subs: 1200, vph: 110, vistas: 1200 },
  { t: 20, subs: 1440, vph: 120, vistas: 1400 },
  { t: 30, subs: 1730, vph: 130, vistas: 1600 },
  { t: 40, subs: 5200, vph: 400, vistas: 5000 }
];
const steady = [0, 10, 20, 30, 40].map((t, i) => ({ t, subs: Math.round(1000 * Math.pow(1.02, i * 10)), vph: 100, vistas: 1000 }));
const dragged = [
  { t: 0, subs: 1000, vph: 100, vistas: 1000 },
  { t: 10, subs: 1200, vph: 110, vistas: 1200 },
  { t: 20, subs: 1440, vph: 120, vistas: 1400 },
  { t: 30, subs: 5000, vph: 400, vistas: 5000 }
];
for (let i = 1; i <= 40; i++) dragged.push({ t: 30 + i * 4, subs: 5000, vph: 400, vistas: 5000 });
const flat = [0, 10, 20, 30, 40].map(t => ({ t, subs: 1000, vph: 100, vistas: 1000 }));
const noVariation = [
  { t: 0, subs: 1000, vph: 10, vistas: 10 },
  { t: 10, subs: 1100, vph: 10, vistas: 10 },
  { t: 20, subs: 1210, vph: 10, vistas: 10 },
  { t: 30, subs: 1331, vph: 10, vistas: 10 },
  { t: 40, subs: 9000, vph: 10, vistas: 10 }
];
const slowAcceleration = [0, 24, 48, 72, 96, 120].map((t, i) => ({ t, subs: [1000, 1010, 1019, 1030, 1040, 1080][i], vph: 5 + i, vistas: 100 + i }));
const unsorted = [burst[3], burst[0], burst[4], burst[2], burst[1]];

export const RADAR_CASES = [
  { name: "a real outbreak fires", channel: radarSeries(burst) },
  { name: "steady growth does not fire", channel: radarSeries(steady) },
  { name: "dragged rows collapse and read as stale", channel: radarSeries(dragged) },
  { name: "one reading is not judged", channel: radarSeries([{ t: 0, subs: 100, vph: 1, vistas: 1 }]) },
  { name: "a flat channel does not fire", channel: radarSeries(flat) },
  { name: "a baseline with no variation is not judged", channel: radarSeries(noVariation) },
  { name: "slow acceleration is not an outbreak", channel: radarSeries(slowAcceleration) },
  { name: "readings out of order are sorted first", channel: radarSeries(unsorted) }
];

const pairs = (...p) => p.map(([day, vph]) => ({ day, vph }));
export const WINDOW_CASES = [
  pairs([165324, 4], [165330, 3], [165335, 7], [165341, 12], [165346, 178], [165352, 292], [165357, 391], [165363, 433], [165368, 687], [165374, 673], [165375, 830]),
  pairs([165324, 964], [165331, 1138], [165339, 819], [165346, 1184], [165354, 785], [165361, 574], [165369, 477], [165374, 6651], [165375, 12821]),
  pairs([165320, 2058], [165328, 930], [165335, 1035], [165343, 1320], [165350, 761], [165358, 7692], [165365, 2584]),
  pairs([165324, 123], [165331, 124], [165339, 383], [165346, 333], [165354, 350], [165361, 5140], [165369, 77], [165374, 69], [165375, 69]),
  pairs([165370, 1958], [165374, 2298], [165375, 2038]),
  pairs([165360, 0], [165361, 0], [165362, 0], [165363, 0], [165364, 0], [165365, 0]),
  pairs([165360, 10], [165361, 20], [165362, 40], [165363, 80], [165364, 120], [165365, 120]),
  [{ day: 165360, vph: 5 }, { day: 165361, vph: 9 }, { day: null, vph: 30 }, { vph: 40 }, { day: 165364, vph: null }, { day: 165365, vph: 60 }]
];

export const WILSON_CASES = [[4, 5], [40, 50], [80, 100], [5, 5], [30, 30], [1, 3], [9, 10], [50, 50], [0, 7], [0, 0], [9, 3], ["x", null], [3, 4], [6, 8], [12, 16], [17, 200], [123, 456]];

export const toMeasures = medidas => medidas.map(m => ({ t: m.t, value: m.subs, rate: m.vph, views: m.vistas }));
export const toPoints = snaps => snaps.map(s => ({ t: s.day, value: s.vph }));

export async function originals() {
  const banditPath = process.env.ZERACK_BANDIT || "";
  const radarDir = process.env.ZERACK_RADAR || "";
  if (!banditPath || !radarDir || !existsSync(banditPath) || !existsSync(join(radarDir, "deteccion-temprana.mjs")) || !existsSync(join(radarDir, "criterio.mjs"))) return null;
  const bandit = await import(pathToFileURL(banditPath).href);
  const radar = await import(pathToFileURL(join(radarDir, "deteccion-temprana.mjs")).href);
  const criterio = await import(pathToFileURL(join(radarDir, "criterio.mjs")).href);
  return { bandit, radar, criterio };
}

export function clean(v) {
  return JSON.parse(JSON.stringify(v, (k, x) => (typeof x === "number" && !Number.isFinite(x) ? (Number.isNaN(x) ? "NaN" : (x > 0 ? "Infinity" : "-Infinity")) : x)));
}

export function answersOf(o) {
  const b = o.bandit, r = o.radar, c = o.criterio;
  return clean({
    evaluate: BANDIT_SETS.map(s => b.evaluate(s.arms, Object.assign({ rng: b.createRng(s.seed) }, s.options || {}))),
    mixture: MIXTURE_SETS.map(s => b.logMixtureBayesFactor(s.arms, s.priorAlpha, s.priorBeta)),
    cohort: BANDIT_SETS.map(s => b.logCohortBayesFactor(s.arms)),
    traffic: TRAFFIC_SETS.map(s => b.simulateTraffic(s.arms, s.rates, s.impressions, b.createRng(s.seed), s.allocation)),
    gamma: [0.3, 1, 2.5, 40].map((shape, i) => { const rng = b.createRng(100 + i); return [0, 1, 2, 3, 4].map(() => b.sampleGamma(shape, rng)); }),
    analyze: RADAR_CASES.map(k => r.analizar(k.channel)),
    collapse: RADAR_CASES.map(k => r.colapsarArrastradas(k.channel.medidas)),
    window: WINDOW_CASES.map(s => ({ readings: c.lecturasDeVentana(s).length, open: c.ventanaSigueAbriendo(s) })),
    wilson: WILSON_CASES.map(([a, n]) => c.confianzaProporcion(a, n)),
    constants: { minReadings: c.ORACULO_LECTURAS_MINIMAS, samples: b.DEFAULT_SAMPLES, threshold: b.DEFAULT_THRESHOLD, minImpressions: b.DEFAULT_MIN_IMPRESSIONS, concentration: b.DEFAULT_EVIDENCE_CONCENTRATION, calibration: b.EVIDENCE_CALIBRATION }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes("--write")) {
  const o = await originals();
  if (!o) { console.error("set ZERACK_BANDIT to banditd/lib/bandit.ts and ZERACK_RADAR to the ZerackRadar folder"); process.exit(1); }
  const answers = answersOf(o);
  writeFileSync(GOLDEN, JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), from: ["banditd lib/bandit.ts", "ZerackRadar deteccion-temprana.mjs", "ZerackRadar criterio.mjs"], answers }, null, 1) + "\n");
  console.log("wrote " + GOLDEN);
}
