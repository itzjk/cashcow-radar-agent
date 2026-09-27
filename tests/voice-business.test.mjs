// Spoken business requests on a store page are not YouTube commands: they go to the assistant, and the niche save still works.
import { loadWorker, check, done } from "./sw-harness.mjs";

const w = loadWorker();
const route = (t, lang) => { const r = w.context.nspVoiceRoute(t, lang || "es"); return r ? r.kind : null; };
for (const t of ["guarda los cambios del producto", "save the product title", "guarda el borrador", "save changes to my store", "guarda el precio nuevo", "añade el delantal al carrito", "paga el pedido", "publica el producto", "borra mi cuenta", "retira mis fondos", "place my order", "add the apron to my cart"]) {
  check('"' + t + '" is not a browser command', route(t) === null, route(t));
}
for (const t of ["guarda este nicho", "save this niche", "guárdalo", "guarda el segundo"]) {
  check('"' + t + '" still saves the niche', route(t) === "save", route(t));
}
done("voice-business");
