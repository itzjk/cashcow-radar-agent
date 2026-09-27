import { load, rancho, check, done } from "./engines.mjs";

const C = load(["lib/nsp-cadencia.js"]).NSP_CADENCIA;

function channel(views, days) {
  return views.map((v, i) => ({ viewsNum: v, published: "hace " + (days ? days[i] : 20 + i * 3) + " dias" }));
}

const luck = C.medir(channel([645000, 1000, 1200, 1500, 1100]));
const engine = C.medir(channel([34000, 10000, 15000, 22000, 18000]));
check("a 645x ratio is red", luck.luz === "rojo", luck);
check("a 3.4x ratio is green", engine.luz === "verde", engine);
check("red says why, not only the colour", /lucky hit/i.test(luck.dice), luck.dice);
check("green says why too", /engine/i.test(engine.dice), engine.dice);

const middle = C.medir(channel([120000, 10000, 12000, 14000, 11000]));
check("a 12x ratio is neither green nor red", middle.luz === "ambar", middle);
check("and it says to look at it", /look/i.test(middle.dice), middle.dice);

check("exactly 6x is green, not amber", C.medir(channel([60000, 10000, 10000, 10000, 10000])).luz === "verde");
check("exactly 20x is amber, not red", C.medir(channel([200000, 10000, 10000, 10000, 10000])).luz === "ambar");
check("20.1x is red", C.medir(channel([201000, 10000, 10000, 10000, 10000])).luz === "rojo");

const withNew = C.medir(channel([34000, 10000, 15000, 22000, 18000, 40], [30, 40, 25, 35, 45, 1]));
check("a video from yesterday does not sink the floor", withNew.luz === "verde", withNew);
check("and the dropped count is reported", withNew.recortadosPorNuevos === 1, withNew.recortadosPorNuevos);

const mostlyNew = C.medir(channel([1000, 900, 800, 700], [1, 2, 3, 4]));
check("when almost all are new, all of them are used", mostlyNew.ok && mostlyNew.usados === 4, mostlyNew);

const noViews = C.medir([{ published: "hace 3 dias" }, { published: "hace 9 dias" }]);
check("without views there is no verdict, and it says so", noViews.ok === false && noViews.motivo === "sin_vistas", noViews);
check("and the reason is written for a person", /view counts/i.test(noViews.razon || ""), noViews.razon);
check("an empty list does not throw", C.medir([]).ok === false);

check("reads 'hace 2 semanas'", C.diasDe("hace 2 semanas") === 14, C.diasDe("hace 2 semanas"));
check("reads '3 months ago'", C.diasDe("3 months ago") === 90, C.diasDe("3 months ago"));
check("reads 'hace 5 horas' as 0 days", C.diasDe("hace 5 horas") === 0, C.diasDe("hace 5 horas"));
check("a text with no date returns null, not 0", C.diasDe("sin fecha") === null, C.diasDe("sin fecha"));

const real = C.medir(rancho());
check("measures the real reference channel", real.ok === true, real);
check("only the last 12 count, not the 30", real.ventana === 12, real.ventana);
check("and it reads the upload cadence", real.cadenciaDias !== null, real.cadenciaDias);

{
  const now = Date.UTC(2026, 8, 26, 12), D = 86400000;
  const ex = d => ({ viewsNum: 1e6, publishedAt: now - d * D }), tx = a => ({ viewsNum: 1e6, published: a });
  const months = ["5 days ago", "1 month ago", "1 month ago", "2 months ago", "2 months ago", "3 months ago", "3 months ago", "3 months ago", "3 months ago", "4 months ago", "4 months ago", "5 months ago"].map(tx);
  const m = C.medir(months);
  check("uploads dated only in months give an average gap over the span, never 0", m.cadenciaDias > 10 && m.cadenciaDias < 20 && m.cadenciaMetodo === "tramo", m);
  const mixed = C.medir([ex(5.2), ex(40), ex(55), tx("2 months ago"), ex(63)].concat(months.slice(5)), { now });
  check("exact publish times give the median gap between neighbours, with a coarse date placed at its middle", mixed.cadenciaDias === 15 && mixed.cadenciaMetodo === "exacto", mixed);
  const years = C.medir(Array(9).fill("1 year ago").concat(["2 years ago", "2 years ago", "3 years ago"]).map(tx));
  check("uploads dated only in years leave the rhythm unmeasured, and say why", years.cadenciaDias === null && /too coarse/.test(years.cadenciaRazon), years);
  const daily = C.medir(Array.from({ length: 12 }, (_, i) => tx((i + 1) + " days ago")));
  check("uploads a day apart read as one a day", daily.cadenciaDias === 1, daily.cadenciaDias);
  check("the verdict needs four uploads older than a week", C.medir(months.slice(0, 3)).suficiente === false && m.suficiente === true);
}

done("cadencia");
