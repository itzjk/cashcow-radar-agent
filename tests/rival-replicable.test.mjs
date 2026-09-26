import { load, source, check, done } from "./engines.mjs";

const ctx = load(["lib/nsp-veredicto.js", "lib/nsp-rival-replicable.js"]);
const R = ctx.NSP_RIVAL_REPLICABLE;
const V = ctx.NSP_VEREDICTO;

const channel = titles => titles.map(t => ({ title: t }));
const fill = (n, base) => Array.from({ length: n }, (_, i) => base + " " + i);

check("the single verdict gate is loaded", !!V && !!V.SIRVE);
const t = R.medir(channel(fill(12, "SE RIERON DE ELLA HASTA QUE volvio")));
check("the verdict comes from the three state vocabulary", [V.SIRVE, V.MIRARLO, V.NO_SIRVE].includes(t.veredicto), t.veredicto);
check("and its English label comes from the same gate", t.etiqueta === V.etiqueta(t.veredicto), t.etiqueta);
check("the logic reads the verdict words from the gate", /NSP_VEREDICTO/.test(source("lib/nsp-rival-replicable.js")));

const factory = R.medir(channel([
  "COMO SE FABRICA EL ACERO EN UNA FABRICA GIGANTE",
  "Inside the factory: production line of glass bottles",
  "FACTORY TOUR: como se hace el chocolate",
  "RESTAURACION de un motor de 1960",
  "I built a cabin alone in the forest",
  "Visitamos la mayor fabrica de papel del mundo",
  "Restoring a rusty axe",
  "Wir besuchten die groesste Fabrik der Welt",
  "Road trip por la costa de Noruega",
  "La historia del acero explicada"
]));
check("nine of ten on camera is DROP", factory.veredicto === V.NO_SIRVE, factory.camara + " of " + factory.titulos);
check("and the label on screen is DROP", factory.etiqueta === "DROP", factory.etiqueta);
check("and it says views do not change that", /no amount of views/i.test(factory.razon), factory.razon);
check("naming how many of how many", /9 of 10/.test(factory.razon), factory.razon);

const story = R.medir(channel([
  "SUS BUFALOS SE NEGABAN A CRUZAR EL RIO… HASTA QUE EL NIÑO HUERFANO VIO LO QUE HABIA DEBAJO",
  "SE RIERON DE LA PEONA SIN DINERO… HASTA QUE EL CURA REVELO QUIEN ERA",
  "LA ENGAÑARON Y SE QUEDARON CON SU TIERRA… PERO EL POZO GUARDABA UN SECRETO",
  "SE BURLARON DE SU MURO INUTIL HASTA QUE LLEGO LA SEQUIA",
  "SU TIO VENDIO LA CASA Y LA ECHO… SIN SABER EL SECRETO",
  "LA MADRASTRA LA ECHO DE LA FINCA… SIN SABER LO QUE VENIA",
  "NADIE SABIA POR QUE RECHAZABA LA CASA… HASTA QUE LA VIUDA HABLO",
  "SE BURLARON DE EL POR CASARSE CON UNA LAVANDERA… SIN SABER QUIEN ERA",
  "LLEGO CON ROPA ROTA Y TODOS SE RIERON… HASTA QUE FIRMO",
  "EL HACENDADO LA ABANDONO… Y LA REENCONTRO COSECHANDO SOLA"
]));
check("a narrated story channel is KEEP", story.veredicto === V.SIRVE, story.relato + " of " + story.titulos);
check("the word buffalo does not send it to camera", story.camara === 0, story.camara);
check("and the label on screen is KEEP", story.etiqueta === "KEEP", story.etiqueta);

const one = R.medir(channel(fill(29, "SE RIERON DE ELLA HASTA QUE volvio").concat(["Visitamos la mayor fabrica de papel del mundo"])));
check("one filmed video in thirty is still rebuildable", one.veredicto === V.SIRVE, one.camara + " of " + one.titulos);
const half = R.medir(channel(fill(15, "SE RIERON DE ELLA HASTA QUE volvio").concat(fill(15, "Visitamos la fabrica de"))));
check("fifteen of thirty on camera is not", half.veredicto === V.NO_SIRVE, half.camara + " of " + half.titulos);

const mute = R.medir(channel(fill(12, "Video numero")));
check("titles that say nothing are not rebuildable", mute.veredicto !== V.SIRVE, mute.veredicto);
check("nor ruled out", mute.veredicto !== V.NO_SIRVE, mute.veredicto);
check("they go to look at it", mute.veredicto === V.MIRARLO, mute.etiqueta);
check("and ask to open three videos and look", /look at what is on screen/i.test(mute.razon), mute.razon);

const few = R.medir(channel(["SE RIERON DE ELLA", "HASTA QUE VOLVIO", "SIN SABER QUE"]));
check("with three titles there is no verdict", few.ok === false && few.motivo === "pocos_titulos", few);
check("and what shows is look at it, never rebuildable", few.veredicto === V.MIRARLO, few.veredicto);
check("and it says how many are needed", /at least 8/.test(few.razon || ""), few.razon);
check("the minimum is declared", R.MINIMO === 8, R.MINIMO);

check("a factory tour is camera", R.deTitulo("FACTORY TOUR: como se hace el chocolate").clase === "camara");
check("a story is narration", R.deTitulo("SE RIERON DE ELLA HASTA QUE VOLVIO").clase === "relato");
check("a neutral title is mute, not narration", R.deTitulo("Video de la semana").clase === "mudo");
check("and the marks come with a name, not a code", R.etiquetaDe("proceso") !== "proceso", R.etiquetaDe("proceso"));

check("German", R.deTitulo("Wir besuchten die groesste Fabrik der Welt").clase === "camara");
check("French", R.deTitulo("Nous avons visite la plus grande usine").clase === "camara");
check("Danish", R.deTitulo("Vi besogte den storste fabrik").clase === "camara");
check("English", R.deTitulo("Inside the factory: production line").clase === "camara");
check("Spanish", R.deTitulo("Visitamos la mayor fabrica de papel").clase === "camara");

done("rival-replicable");
