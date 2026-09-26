import { load, source, titleCorpus, check, done } from "./engines.mjs";

const box = load(["lib/nsp-rpm-tabla.js"]);
const T = box.NSP_RPM_TABLA;

const es = T.resolver("carros raros de los 80", {});
const de = T.resolver("vergessene deutsche Autos der 80er", {});
check("the same topic in Spanish and German lands on the same row", es.label === de.label && es.label === "Autos", es.label + " / " + de.label);
check("and German no longer falls to the unclassified rate", de.clasificado === true && de.base === 5, de);
check("German pays more than Spanish, because the market does", de.rpm > es.rpm, de.rpm + " vs " + es.rpm);

const inside = ["proceso automatico de fabricacion", "automatizacion con n8n explicada", "wie automatisch sortiert wird", "el autor del crimen", "viaje en autobus por europa"];
const hijacked = inside.filter(t => T.resolver(t, {}).label === "Autos");
check("autos does not sneak inside automatico, autor or autobus", hijacked.length === 0, hijacked);
check("automatizacion is still technology", T.resolver("automatizacion con n8n explicada", {}).label === "IA y Tecnologia", T.resolver("automatizacion con n8n explicada", {}).label);
check("but automotriz and automovil are cars", T.resolver("ingenieria automotriz explicada", {}).label === "Autos" && T.resolver("el automovil que arruino a su fabrica", {}).label === "Autos");

const EIGHT = [
  { row: "Autos", t: { es: "los autos raros de los 80", en: "weird 80s cars nobody remembers", de: "vergessene deutsche Autos der 80er", pt: "carros estranhos dos anos 80", fr: "les voitures oubliees des annees 80", ja: "消えた自動車メーカー なぜ", ko: "사라진 자동차 브랜드", zh: "十款可靠性近乎完美的汽車" } },
  { row: "Historia", t: { es: "historia del imperio romano", en: "ancient rome documentary", de: "antikes rom dokumentation", pt: "roma antiga documentario", fr: "rome antique documentaire", ja: "古代ローマ ドキュメンタリー", ko: "고대 로마 역사", zh: "古羅馬 歷史" } },
  { row: "Ciencia", t: { es: "descubrimientos del espacio y el universo", en: "space discoveries explained", de: "weltraum entdeckungen", pt: "descobertas do espaco", fr: "decouvertes spatiales", ja: "宇宙の発見 解説", ko: "우주 발견", zh: "太空發現" } },
  { row: "Psicologia", t: { es: "filosofia estoica y mentalidad", en: "stoic philosophy mindset", de: "stoische philosophie", pt: "filosofia estoica", fr: "philosophie stoicienne", ja: "ストア哲学 心理学", ko: "스토아 철학", zh: "斯多葛 哲學" } },
  { row: "Geografia", t: { es: "geografia y fronteras del mundo", en: "geography facts maps", de: "geografie fakten landkarte", pt: "fatos de geografia fronteira", fr: "faits de geographie frontiere", ja: "地理 の話", ko: "지리 이야기", zh: "地理 冷知識" } },
  { row: "Religion e Historia", t: { es: "historias de la biblia explicadas", en: "bible stories explained", de: "bibelgeschichten erklaert", pt: "historias da biblia explicadas", fr: "chaque livre de la bible explique", ja: "聖書 物語 解説", ko: "성경 이야기 해설", zh: "聖經故事 解說" } },
  { row: "Sleep y Relax", t: { es: "historias para dormir con lluvia", en: "bedtime stories with rain sounds", de: "einschlafgeschichten regen", pt: "historias para dormir com chuva", fr: "histoires pour s endormir sous la pluie", ja: "睡眠導入 雨音 物語", ko: "수면 유도 빗소리 이야기", zh: "睡前故事 雨聲" } },
  { row: "Finanzas", t: { es: "como invertir tu dinero en bolsa", en: "how to invest your money in stocks", de: "wie du dein geld in aktien anlegst", pt: "como investir seu dinheiro", fr: "comment investir votre argent", ja: "株式 投資 解説", ko: "주식 투자 방법", zh: "投資 理財 解說" } }
];
for (const c of EIGHT) {
  const bad = Object.keys(c.t).filter(gl => T.resolver(c.t[gl], {}).label !== c.row);
  check("'" + c.row + "' is recognised in all 8 languages", bad.length === 0, bad.map(gl => gl + "=" + T.resolver(c.t[gl], {}).label));
}
const cjk = ["古代ローマ ドキュメンタリー", "고대 로마 역사", "古羅馬 歷史", "深海生物 解説", "심해 생물", "未解之謎 解說"];
check("Japanese, Korean and Chinese no longer all fall to unclassified", cjk.filter(t => !T.resolver(t, {}).clasificado).length === 0, cjk.filter(t => !T.resolver(t, {}).clasificado));

const x = T.resolver("carros raros de los 80", {});
check("resolver still returns clasificado, the stable field", x.clasificado === true);
check("and it says the RPM is an estimate, not a measurement", x.medido === false && T.measured === false, x.medido);
const none = T.resolver("aaaa bbbb cccc", {});
check("unclassified still says it did not classify", none.clasificado === false && none.label === T.SIN_CLASIFICAR, none);
const ru = T.resolver("почему это произошло на самом деле", {});
check("a language with no citable multiplier says so", ru.sinReferencia === true && ru.mercado === T.mercadoNeutro, ru);

check("every row has an English name a person reads", T.rows.every(r => r.name && /^[A-Z][A-Za-z ]+$/.test(r.name)), T.rows.filter(r => !/^[A-Z][A-Za-z ]+$/.test(r.name || "")).map(r => r.label));
check("resolver hands back the English name next to the stable label", x.label === "Autos" && x.name === "Cars" && T.nombreDe("Historia") === "History", [x.label, x.name]);
check("every row keys a search query in both languages", T.rows.every(r => T.queryDe(r.label, false) && T.queryDe(r.label, true)));
check("the explanation a person reads is English", /^Estimated RPM/.test(T.prosa()) && !/[áéíóúñ]/.test(T.prosa()), T.prosa().slice(0, 80));
check("it does not overwrite the scanner's own NICHE_RPM", typeof box.NICHE_RPM === "undefined" && !/NICHE_RPM/.test(source("lib/nsp-rpm-tabla.js")));
check("its helpers stay private to the library", typeof box.ZMARCAS === "undefined" && typeof box.ZSCRIPT_LANG === "undefined");

const expected = { EN: "en", US: "en", DE: "de", ES: "es", MX: "es", FR: "fr", PT: "pt", BR: "pt" };
let right = 0, wrong = 0, classified = 0;
const corpus = titleCorpus();
for (const v of corpus) {
  if (T.resolver(v.titulo, {}).clasificado) classified++;
  const e = expected[String(v.mercado).toUpperCase()];
  if (!e) continue;
  const g = T.idiomaDe(v.titulo);
  if (!g.seguro) continue;
  if (g.codigo === e) right++; else wrong++;
}
const judged = right + wrong;
console.log("  ..    " + classified + " of " + corpus.length + " real titles classified; language right " + right + " of " + judged + " it dared to judge");
check("it classifies more than 4 in 10 real titles", classified / corpus.length > 0.40, (classified / corpus.length * 100).toFixed(1));
check("when it dares to name the language it is right more than 9 in 10", right / judged > 0.90, (right / judged * 100).toFixed(1));

done("rpm-table");
