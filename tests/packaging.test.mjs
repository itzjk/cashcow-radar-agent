import { load, fixture, check, done } from "./engines.mjs";

const P = load(["lib/nsp-packaging.js"]).NSP_PACKAGING;

const WINNER = "Su Tío Vendió la Casa y la Echó—Sin Saber el Secreto que el gato Escondía…";
const LOSER = "TODOS SE RIERON DEL VIEJO POR REGAR CENIZA EN SU MILPA… 3 COSECHAS DESPUÉS, LE PIDIERON PERDÓN";
const g = P.puntuar(WINNER), p = P.puntuar(LOSER);

check("a title in the winning shape scores high", g.packagingScore >= 40, g.packagingScore);
check("a title carrying three dead weights scores low", p.packagingScore <= 10, p.packagingScore);
check("and the gap between them is wide", g.packagingScore - p.packagingScore >= 30, g.packagingScore - p.packagingScore);

const neg = p.negativas.map(x => x.id);
check("fires the collective villain", neg.includes("villano_colectivo"), neg);
check("fires the farming premise", neg.includes("premisa_agro"), neg);
check("fires the number that is not the payload", neg.includes("cifra_fuera_de_carga"), neg);
check("those three and no invented extra", p.negativas.length === 3, p.negativas);
check("the winner fires no negative", g.negativas.length === 0, g.negativas);
check("every signal carries a stable id and an English label", g["señales"].concat(p.negativas).every(x => /^[a-z_]+$/.test(x.id) && /^[a-z0-9 ,]+$/i.test(x["señal"])), g["señales"].concat(p.negativas));

function days(s) { const m = /(\d+)\s*(d[ií]a|semana|mes|a[nñ]o)/.exec(s); if (!m) return null; const n = +m[1], u = m[2]; return n * (u.startsWith("d") ? 1 : u.startsWith("sem") ? 7 : u.startsWith("mes") ? 30 : 365); }
const V = fixture("rancho-channel.json").map(c => ({ score: P.puntuar(c.title).packagingScore, d: days(c.cuando), v: c.views })).filter(x => x.d).map(x => ({ score: x.score, vpd: x.v / x.d }));
check("there is a real corpus to measure", V.length >= 25, V.length);

let right = 0, total = 0;
for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
  if (V[i].vpd === V[j].vpd || V[i].score === V[j].score) continue;
  total++; if ((V[i].vpd > V[j].vpd) === (V[i].score > V[j].score)) right++;
}
check("beats chance over 30 real titles", right / total > 0.58, (right / total * 100).toFixed(1) + "% of " + total);

const order = [...V].sort((a, b) => b.vpd - a.vpd);
const half = Math.floor(V.length / 2);
const mean = a => a.reduce((s, x) => s + x.score, 0) / a.length;
check("the top half scores above the bottom half", mean(order.slice(0, half)) > mean(order.slice(-half)), [mean(order.slice(0, half)), mean(order.slice(-half))]);

done("packaging");
