// Spoken business requests on a store page are not YouTube commands: they go to the assistant, and the niche save still works.
import { loadWorker, check, done } from "./sw-harness.mjs";

const w = loadWorker();
const route = (t, lang) => { const r = w.context.nspVoiceRoute(t, lang || "es"); return r ? r.kind : null; };
for (const t of ["guarda los cambios del producto", "save the product title", "guarda el borrador", "save changes to my store", "guarda el precio nuevo", "añade el delantal al carrito", "paga el pedido", "publica el producto", "borra mi cuenta", "retira mis fondos", "place my order", "add the apron to my cart"]) {
  check('"' + t + '" is not a browser command', route(t) === null, route(t));
}
for (const t of ["What should I post today?", "Which feature request repeats most?", "Write the changelog since my last release", "Build my Product Hunt and Show HN kit", "watch this repo", "stop watching this repo", "who is asking for what I build?", "which rivals are accelerating?", "post it on X", "open the show hn form", "star this repo", "follow this user", "merge the pull request", "publish the release", "reply to this comment", "read the issues", "check my stripe"]) {
  check('the builder ask "' + t + '" goes to the assistant', route(t, "en") === null, route(t, "en"));
}
for (const t of ["qué publico hoy", "vigila este repo", "deja de vigilar este repo", "escribe el changelog", "quién pide lo que hago", "qué rival acelera", "publica el post", "haz el kit de lanzamiento", "lee los issues"]) {
  check('the builder ask "' + t + '" goes to the assistant', route(t) === null, route(t));
}
for (const t of ["search github for rivals", "search product hunt for launches", "busca en github rivales", "search npm for chart libraries", "search hacker news for show hn"]) {
  check('"' + t + '" names another site, so it is not a YouTube search', route(t, "en") === null, route(t, "en"));
}
check('"search youtube for chess" still searches YouTube', route("search youtube for chess", "en") === "search");
for (const t of ["guarda este nicho", "save this niche", "guárdalo", "guarda el segundo"]) {
  check('"' + t + '" still saves the niche', route(t) === "save", route(t));
}
done("voice-business");
