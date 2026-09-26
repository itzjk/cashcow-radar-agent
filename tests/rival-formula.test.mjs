import { load, source, fixture, check, done } from "./engines.mjs";

const F = load(["lib/nsp-packaging.js", "lib/nsp-rival-formula.js"]).NSP_RIVAL_FORMULA;

const withTraits = F.rasgos('"NO VUELVAS NUNCA" — LE DIJO EL SUEGRO A LA NUERA… SIN SABER QUIEN LLEGABA');
check("sees quoted dialogue", withTraits.includes("dialogo"), withTraits);
check("sees the ellipsis hinge", withTraits.includes("bisagra_puntos"), withTraits);
check("sees the family role", withTraits.includes("parentesco"), withTraits);
const neutral = F.rasgos("Video normal sobre nada en particular");
check("a neutral title drags in no topic trait", !neutral.includes("parentesco") && !neutral.includes("dialogo"), neutral);
check("an empty title does not throw", Array.isArray(F.rasgos("")));

const src = source("lib/nsp-rival-formula.js");
check("the module keeps no farming word list of its own", !src.includes("'zanja'") && !src.includes('"zanja"'));
check("it borrows the list from the packaging table by name", /PRESTADOS[\s\S]{0,200}AGRO/.test(src));
check("with packaging loaded it sees the farming premise", F.rasgos("SE RIERON DE LA ABUELA QUE CAVO ZANJAS EN ZIGZAG").includes("agro"));
const alone = load(["lib/nsp-rival-formula.js"]).NSP_RIVAL_FORMULA;
check("without the table that trait is not guessed", !alone.rasgos("CAVO ZANJAS EN ZIGZAG").includes("agro"));
const unmeasured = alone.diferenciar(["Uno", "Dos"], ["Tres", "Cuatro"]);
check("and it says which one went unmeasured", unmeasured.sinMedir.length === 1, unmeasured.sinMedir);

const flat = F.medir(Array.from({ length: 20 }, (_, i) => ({ title: "Titulo numero " + i, viewsNum: 10000 + i * 10 })));
check("with top and bottom close together it does not split the channel", flat.ok && flat.plano === true, flat.brecha);
check("and says why, with the number", /flat/i.test(flat.razon) && /x apart/.test(flat.razon), flat.razon);
check("the minimum gap is declared", F.BRECHA_MINIMA === 3, F.BRECHA_MINIMA);

const few = F.medir(Array.from({ length: 6 }, (_, i) => ({ title: "T" + i, viewsNum: 1000 * (i + 1) })));
check("with six videos nothing is split", few.ok === false && few.motivo === "pocos_videos", few);
check("and it says how many are needed", /at least 10/.test(few.razon || ""), few.razon);
check("a title without views does not count as a video", F.medir([{ title: "solo titulo" }]).ok === false);

const proven = F.diferenciar(Array.from({ length: 20 }, (_, i) => 'EL HACENDADO le grito "vete de aqui" a la viuda ' + i), Array.from({ length: 20 }, (_, i) => "Video sobre cosas varias numero " + i));
check("twenty against zero comes out proven", proven.separa === true, proven.razon);
check("with its z above two", proven.probados[0] && Math.abs(proven.probados[0].z) >= F.Z_PROBADO, proven.probados[0]);
check("and says which side it sits on", proven.probados[0] && proven.probados[0].lado === "gana", proven.probados[0]);

const chance = F.diferenciar(
  ["Titulo con numero 1", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal"],
  ["Titulo con numero 1", "Titulo con numero 2", "Titulo con numero 3", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal", "Titulo normal"]);
check("one against three over ten is not called a formula", chance.separa === false, chance.razon);
check("but it is not thrown away either", chance.todos.length > 0, chance.todos.length);
check("and the text asks for more sample instead of calling it good", /Nothing is proven|No title trait/.test(chance.razon), chance.razon);

const house = F.diferenciar(Array.from({ length: 12 }, (_, i) => "TITULO ENTERO EN MAYUSCULAS NUMERO " + i), Array.from({ length: 12 }, (_, i) => "OTRO TITULO ENTERO EN MAYUSCULAS NUMERO " + i));
check("capitals on both sides are marked as house style", house.comunes.some(c => c.id === "gritado"), house.comunes);
check("and do not sneak in as a separating trait", !house.separan.some(s => s.id === "gritado"), house.separan);

const empty = F.diferenciar(["Uno"], []);
check("without one side it compares nothing", empty.ok === false && empty.motivo === "sin_lados", empty);
check("and says which side is missing", /empty/i.test(empty.razon || ""), empty.razon);

const real = F.medir(fixture("rancho-channel.json").map(v => ({ title: v.title, viewsNum: v.views })));
check("splits the real channel ten against ten", real.ok && real.cuantos === 10, real.muestra);
check("and the gap between halves is wide, not flat", real.plano === false && real.brecha > 20, real.brecha);
const agro = real.todos.find(x => x.id === "agro");
check("the farming premise sits with the worst ones", agro && agro.lado === "pierde", agro);
check("and with thirty videos it is not proven yet, and says so", real.separa === false && real.apunta === true, real.razon);

done("rival-formula");
