import { load, check, done } from "./engines.mjs";

const ctx = load(["lib/nsp-veredicto.js", "lib/nsp-rival-saturacion.js", "lib/nsp-rival-ventana.js"]);
const S = ctx.NSP_RIVAL_SATURACION;
const W = ctx.NSP_RIVAL_VENTANA;

function channel(name, days, certain, median, light) {
  return {
    ok: true, canal: { nombre: name, url: "https://youtube.com/@" + name },
    edad: { ok: true, diasMinimos: days, cierta: certain },
    cadencia: { ok: true, mediana: median, piso: median * 0.6, luz: light || "verde", cadenciaDias: 4 },
    etiqueta: "SIRVE"
  };
}

[0, 1, 4].forEach(n => {
  const list = []; for (let i = 0; i < n; i++) list.push(channel("c" + i, 60, true, 50000));
  const s = S.medir(list);
  check("with " + n + " channel(s) there is no saturation verdict", s.ok === false && s.motivo === "muestra_corta", s);
});
check("and from five on there is", S.medir([0, 1, 2, 3, 4].map(i => channel("c" + i, 60, true, 50000))).ok === true);

const mix = [
  channel("old-disguised-1", 60, false, 80000),
  channel("old-disguised-2", 50, false, 90000),
  channel("old-disguised-3", 40, false, 70000),
  channel("old-1", 900, true, 120000),
  channel("old-2", 800, true, 110000)
];
const sm = S.medir(mix);
check("the three of doubtful age do not count as young", sm.jovenes === 0, sm.jovenes);
check("and they are counted apart, not dropped", sm.edadDesconocida === 3, sm.edadDesconocida);
check("the sentence says nobody can be proven young", /Not one channel here can be proven/.test(sm.dice), sm.dice);
check("and says how many hide their date", /hide their real opening date/.test(sm.dice), sm.dice);
const vm = W.medir(sm);
check("with that the door is not declared open", vm.veredicto !== "SIRVE", vm.veredicto);
check("nor shut", vm.veredicto !== "NO SIRVE", vm.veredicto);
check("and the way out is to sweep newer channels", /Sweep more channels/.test(vm.accion), vm.accion);

const opens = W.medir(S.medir([
  channel("new-1", 30, true, 60000), channel("new-2", 40, true, 70000), channel("new-3", 50, true, 80000),
  channel("old-1", 900, true, 200000), channel("old-2", 800, true, 150000)
]));
check("three young channels that land open the door", opens.veredicto === "SIRVE", opens);
check("and it says to copy the youngest that landed, not the biggest", /youngest channel that landed/.test(opens.accion), opens.accion);
check("the label a person reads is English", opens.etiqueta === "KEEP", opens.etiqueta);

const few = W.medir(S.medir([
  channel("new-1", 30, true, 60000),
  channel("old-1", 900, true, 200000), channel("old-2", 800, true, 150000),
  channel("old-3", 700, true, 140000), channel("old-4", 600, true, 130000)
]));
check("one young channel that lands does not open the door", few.veredicto !== "SIRVE", few.veredicto);
check("and it says it may be one lucky operator", /one lucky operator/.test(few.razon), few.razon);

function bouncing(n) {
  const l = [];
  for (let i = 0; i < n; i++) l.push(channel("new" + i, 30 + i, true, 500));
  while (l.length < 5) l.push(channel("old" + l.length, 900, true, 200000));
  return W.medir(S.medir(l));
}
check("with four young channels bouncing it is not shut yet", bouncing(4).veredicto !== "NO SIRVE", bouncing(4).veredicto);
check("and it says five are needed", /5 are needed before that word is used/.test(bouncing(4).razon), bouncing(4).razon);
const shut = bouncing(5);
check("with five bouncing it is shut", shut.veredicto === "NO SIRVE", shut);
check("and the way out is to take the format elsewhere", /another language or another niche/.test(shut.accion), shut.accion);

const nothing = W.medir(null);
check("without a saturation reading it is neither open nor shut", nothing.ok === false && nothing.veredicto !== "SIRVE" && nothing.veredicto !== "NO SIRVE", nothing);
check("and it says why", /cannot be called open or shut/.test(nothing.razon), nothing.razon);
check("a failed saturation carries its own reason", /fewer than/.test(W.medir(S.medir([channel("a", 30, true, 1)])).razon));

const counted = S.medir([
  channel("a", 30, true, 60000), channel("b", 40, true, 200), channel("c", 50, true, 70000),
  channel("d", 900, true, 300000), channel("e", 800, true, 100)
]);
check("counts how many clear the floor", counted.aterrizan === 3, counted.aterrizan);
check("and how many of the young clear it", counted.jovenesQueAterrizan === 2 && counted.jovenes === 3, counted);
check("the niche median comes from the medians there are", counted.medianaDelNicho === 60000, counted.medianaDelNicho);
check("the sentence repeats those same numbers", counted.dice.indexOf("3 of 5") === 0 && /2 of 3/.test(counted.dice), counted.dice);

done("rival-ventana");
