import { load, source, check, done } from "./engines.mjs";

const box = load(["lib/nsp-areas.js", "lib/nsp-miniatura-cohorte.js", "lib/nsp-miniatura-mercado.js"]);
const M = box.NspMiniaturaMercado;

check("the module loads", !!M);

function fakeFeed(opts) {
  opts = opts || {};
  const channels = [];
  for (let i = 0; i < (opts.canales || 10); i++) {
    const videos = [];
    for (let j = 0; j < 5; j++) videos.push({ id: "n" + i + "_" + j, title: "video normal " + j, views: 1000 + j * 10 });
    videos.push({ id: "sob" + i, title: opts.titulo || "misterio sin resolver " + i, views: 5100 });
    channels.push({ chId: "UC" + i, ch: "Channel " + i, videos: videos });
  }
  channels.push({ chId: "UCshort", ch: "Short channel", videos: [
    { id: "c1", title: "short one", views: 900 },
    { id: "c2", title: "short two", views: 1000 },
    { id: "c3", title: "short three", views: 90000 }
  ] });
  const agg = {};
  agg[(opts.mercado || "ES") + ":" + (opts.tema || "misterios sin resolver")] = {
    canales: channels.map(c => c.videos.map(v => ({ chId: c.chId, ch: c.ch, videoId: v.id, titulo: v.title, vistas: v.views }))).reduce((a, b) => a.concat(b), [])
  };
  return { history: [{ day: 1, agg: agg }] };
}
const feed = fakeFeed();

const a = M.sobresalientesDe(null);
check("without a feed it says so and returns no empty list", a.ok === false && a.motivo === "sin_feed", a);
const b = M.sobresalientesDe({ history: [{ day: 1, whatever: [] }] });
check("with a feed of another shape it warns about the shape, not about missing channels", b.ok === false && b.motivo === "feed_desconocido" && /shape/i.test(b.razon || ""), b);

const s = M.sobresalientesDe(feed);
check("finds the 10 that beat their own channel", s.ok && s.videos.length === 10, s.videos && s.videos.length);
check("and none comes from a channel under the minimum", s.ok && !s.videos.some(v => v.canalId === "UCshort"));
check("the ratio against its channel comes with the example", s.ok && s.videos[0].razon >= 5 && s.videos[0].medianaCanal > 0, s.videos[0]);
const loose = M.sobresalientesDe(feed, { minVideos: 3 });
check("lowering the minimum lets the short channel in: the gate is real", loose.ok && loose.videos.some(v => v.canalId === "UCshort"));
const zero = M.sobresalientesDe({ history: [{ agg: { "ES:x": { canales: [
  { chId: "UCz", ch: "Z", videoId: "z1", titulo: "no views", vistas: 0 },
  { chId: "UCz", ch: "Z", videoId: "z2", titulo: "no views", vistas: null }
] } } }] });
check("a video with no views does not count as read", zero.ok === false && zero.motivo === "feed_desconocido", zero);

const good = M.paraNicho({ titulo: "misterios sin resolver", mercado: "ES", tema: "ES:misterios sin resolver" }, feed);
check("with enough cases it answers and says the scope they come from", good.ok === true && good.alcance === "tema" && !!good.etiqueta, good);
check("and NEVER shows examples without the measured warning", good.ok && !!good.aviso && /588 duels/.test(good.aviso), good.aviso);
check("the examples carry their real thumbnail", good.ok && /^https:\/\/i\.ytimg\.com\/vi\/[^/]+\/maxresdefault\.jpg$/.test(good.ejemplos[0].url || ""), good.ejemplos && good.ejemplos[0].url);
check("sorted by how much they beat THEIR channel, not by raw views", good.ok && good.ejemplos.every((v, i, x) => i === 0 || x[i - 1].razon >= v.razon));
const other = M.paraNicho({ titulo: "recetas de cocina rapida", mercado: "PT", tema: "PT:receitas" }, feed);
check("for a niche with no cases it says it does not know THAT niche", other.ok === false && other.motivo === "nicho_sin_medir", other);
check("and it shows which scopes it tried before refusing", other.ok === false && (other.intentos || []).length === 3 && other.intentos.every(i => "encontrados" in i), other.intentos);
const few = M.paraNicho({ titulo: "misterios", mercado: "ES", tema: "ES:misterios sin resolver" }, fakeFeed({ canales: 2 }));
check("with two cases in the whole sweep it speaks about nothing", few.ok === false && few.motivo === "sin_casos", few);
check("and it says how many it found and how many are needed", few.ok === false && few.encontrados === 2 && few.minimo >= 8, few);

const byArea = M.paraNicho({ titulo: "misterios sin resolver", mercado: "XX", tema: "" }, feed);
check("with no topic and no market it falls back to the area and names it", byArea.ok === true && byArea.alcance === "area" && byArea.etiqueta === "misterio", byArea);
check("and the area comes from the nsp-areas table, not a copy", !!box.NspAreas && box.NspAreas.areaDe("misterios sin resolver") === "misterio");
check("the sentence names the area in English", byArea.ok && /area, mystery\./.test(byArea.dice), byArea.dice);

const sat = M.veredictoDe("saturacion");
check("a blog rule answered with its measured figure", sat.estado === "medido_no_separa" && sat.duelos === M.MEDICION.duelos && sat.tasa < 0.5, sat);
const face = M.veredictoDe("cara");
check("the face is still NOT MEASURED, which is not the same as does not separate", face.estado === "no_medido" && /not the same thing/i.test(face.dice || ""), face);
check("and it does not sneak into the measured table", !M.HECHOS.some(h => h.codigo === "cara"));
check("a rule nobody tested says nobody tested it", M.veredictoDe("whatever").estado === "fuera_de_la_tabla");
check("the verdict is asked by code, not by the sentence", M.veredictoDe("brillo").estado === "medido_no_separa" && M.veredictoDe("brightness").estado === "fuera_de_la_tabla");

check("the 20 properties are all there", M.HECHOS.length === M.MEDICION.propiedades, M.HECHOS.length);
const widest = Math.max(...M.HECHOS.map(h => Math.abs(h.tasa - 0.5)));
check("none separates from chance more than was measured", Math.abs(widest - M.MEDICION.mayorSeparacion) < 0.0005, widest);
check("and with 20 properties chance gives that gap almost half the time", M.MEDICION.pFamiliar > 0.05, M.MEDICION.pFamiliar);
const cited = M.HECHOS.filter(h => /\d+ duels/.test(h.dice));
check("every sentence that cites duels cites the real number", cited.length > 0 && cited.every(h => h.dice.indexOf(String(M.MEDICION.duelos) + " duels") >= 0), cited.length);
check("the age confounder is declared next to the result", M.CONFUSORES.some(c => c.codigo === "edad_de_observacion" && /63\.9%/.test(c.dice)));
check("and grouping by niche tightens nothing either", /does not tighten/i.test(M.AGRUPACION.dice || ""));

const texts = [M.AVISO].concat(M.HECHOS.map(h => h.dice), M.NO_MEDIDO.map(n => n.razon), M.CONFUSORES.map(c => c.dice), [M.AGRUPACION.dice, M.AGRUPACION.grupos, M.MEDICION.sueloDeteccion]);
const promise = /\b(guarantee|guaranteed|will get|will boost|boost your|more clicks|higher ctr|increase your views|proven to)\b/i;
check("no sentence promises views or clicks", texts.filter(t => promise.test(t || "")).length === 0, texts.filter(t => promise.test(t || "")));
const advice = /\b(you should|make sure|use more|add a face|put a face|pick brighter)\b/i;
check("and none gives the blog order this module exists not to give", texts.filter(t => advice.test(t || "")).length === 0, texts.filter(t => advice.test(t || "")));
check("the warning says these are examples to look at, not a rule", /not a rule to copy/i.test(M.AVISO), M.AVISO);
check("every sentence here is English", texts.every(t => !/[áéíóúñ¿¡]|\b(de|los|las|una|sobre|grupos)\b/i.test(t || "")), texts.filter(t => /[áéíóúñ¿¡]|\b(de|los|las|una|sobre|grupos)\b/i.test(t || "")));

const Co = box.NspMiniaturaCohorte;
check("the cohort still publishes its minimum", !!(Co && Co.MINIMO), Co && Co.MINIMO);
check("and the example minimum is that same one, not a copy", !!Co && M.minimoEjemplos() === Co.MINIMO, M.minimoEjemplos());
check("the thumbnail url also comes from the cohort", !!(Co && Co.urlMiniatura) && M.sobresalientesDe(feed).videos[0].url === Co.urlMiniatura(M.sobresalientesDe(feed).videos[0].id));

const thin = M.perfilDe([{ contraste: 60 }, { contraste: 61 }]);
check("with two thumbnails no niche is described", thin.ok === false && thin.motivo === "pocos_medidos", thin);
const samples = [];
for (let i = 0; i < 12; i++) samples.push({ contraste: 50 + i, saturacion: 30 + i, brillo: 90 + i, retencion_feed: 0.5, nota: 70 });
const prof = M.perfilDe(samples);
check("with enough it does, and returns the measured band", prof.ok === true && prof.filas.length > 0, prof);
check("every row says it predicts NOTHING", prof.ok && prof.filas.every(f => f.estado === "descriptivo" && f.predice === false));
check("and every row carries the measured fact that denies it as a rule", prof.ok && prof.filas.every(f => typeof f.porQue === "string" && f.porQue.length > 20));
check("the profile carries the warning too", prof.ok && prof.aviso === M.AVISO);

check("the measurement names the file it came from", /radar_feed\.json$/.test(M.MEDICION.fuente || ""), M.MEDICION.fuente);
check("and how many thumbnails were read out of how many videos", M.MEDICION.miniaturasLeidas === 767 && M.MEDICION.videos === 804 && M.MEDICION.sinMaxres === 37);
check("the module declares its detection floor, which is what gives the no its value", /p=0\.0007/.test(M.MEDICION.sueloDeteccion || ""), M.MEDICION.sueloDeteccion);
check("and it is not in the manifest without anyone asking for it", !/nsp-miniatura-mercado/.test(source("manifest.json")));

done("miniatura-mercado");
