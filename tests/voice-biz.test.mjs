// Voice for the business agent: "read this page", "find clients here" and "how many can I send today" are routes of their own, they run the reader and the lead tool on the tab in front, and any other spoken question on a business page goes to a business agent that can read but never press.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadWorker, ROOT, check, done } from "./sw-harness.mjs";
import { makeIndexedDB, IDBKeyRange } from "./idb-lite.mjs";
import { windowFor } from "./dom-lite.mjs";

const w = loadWorker({ local: { nsp_agent_enabled: true, nsp_agent_sites: {} } });
w.context.indexedDB = makeIndexedDB();
w.context.IDBKeyRange = IDBKeyRange;
const route = (t, lang) => w.context.nspVoiceRoute(t, lang || "es");
const kind = (t, lang) => { const r = route(t, lang); return r ? r.kind + (r.biz ? ":" + r.biz : "") : null; };

const YES = [
  ["lee esta p\u00e1gina", "biz:read"], ["lee la p\u00e1gina", "biz:read"], ["analiza esta p\u00e1gina", "biz:read"], ["l\u00e9eme la tabla", "biz:read"], ["puedes leer la p\u00e1gina", "biz:read"], ["oye zerack lee esta p\u00e1gina", "biz:read"],
  ["read this page", "biz:read", "en"], ["analyze the page", "biz:read", "en"], ["read the page for me", "biz:read", "en"],
  ["busca clientes aqu\u00ed", "biz:leads"], ["b\u00fascame clientes en esta p\u00e1gina", "biz:leads"], ["encuentra clientes", "biz:leads"], ["dame los clientes de esta lista", "biz:leads"],
  ["find me leads on this page", "biz:leads", "en"], ["find clients here", "biz:leads", "en"], ["show me the leads", "biz:leads", "en"],
  ["cu\u00e1ntos mensajes me quedan hoy", "biz:status"], ["cu\u00e1ntas propuestas puedo mandar hoy", "biz:status"], ["estado de los env\u00edos", "biz:status"], ["how many emails do i have left today", "biz:status", "en"], ["how many proposals can i send today", "biz:status", "en"]
];
for (const [t, want, lang] of YES) check('"' + t + '" is the business command ' + want, kind(t, lang) === want, kind(t, lang));
const NO = ["busco clientes para mi negocio", "no leas esta p\u00e1gina", "qu\u00e9 dice esta p\u00e1gina", "a qui\u00e9n le escribo primero", "redacta la propuesta para el primero", "manda la propuesta", "env\u00eda el mensaje a cedar park smiles", "cu\u00e1ntos seguidores tiene este perfil", "busca clientes en google maps", "lee el correo", "qu\u00e9 trabajos me convienen", "marca que rebot\u00f3", "dale like a este video", "sigue esta cuenta", "retira mis ganancias de upwork"];
for (const t of NO) check('"' + t + '" is not a command: it goes to the business agent', kind(t) === null, kind(t));
for (const t of ["which jobs should I bid on", "who should I pitch first", "draft the proposal", "send it", "mark it as bounced", "what does this page say", "follow this account", "like this video"]) check('"' + t + '" is not a command', kind(t, "en") === null, kind(t, "en"));
check('"escanea esta p\u00e1gina" still scans YouTube', kind("escanea esta p\u00e1gina") === "scan");
check('"busca historia para dormir" still searches YouTube', kind("busca historia para dormir") === "search");
check("typed in the chat, a business command goes to the model with its page tools", w.context.nspChatTyped("lee esta p\u00e1gina", "es") === null && w.context.nspChatTyped("busca clientes aqu\u00ed", "es") === null);

const said = [];
const lines = [];
w.context.nspVoiceSay = t => said.push(t);
w.context.nspVoiceLine = (k, lang) => lines.push(k + ":" + lang);
const cascade = [];
w.context.nspChatCascade = (payload, cb) => { cascade.push(payload); setImmediate(() => cb({ ok: true, text: "Hay 7 lugares: 3 para contactar. El mejor es Oakridge Family Dental.", provider: "mock" })); };
const settle = () => new Promise(r => setTimeout(r, 30));

{
  w.context.nspVoiceBizSite = cb => cb(null);
  w.context._nspVoice.gen = 5;
  w.context.nspVoiceBiz({ kind: "biz", biz: "read", lang: "es" }, 5, (k, lang) => lines.push(k + ":" + lang));
  await settle();
  check("with no web page in front, it says to open the page first", lines.pop() === "biz_no_page:es", lines);
  check("that line exists in both languages", /Open the page/.test(w.context.NSP_VOICE_LINES.biz_no_page.en) && /Abre primero/.test(w.context.NSP_VOICE_LINES.biz_no_page.es));
}

{
  w.context._nspVoice.gen = 6;
  w.context.nspVoiceBiz({ kind: "biz", biz: "status", lang: "en" }, 6, (k, lang) => lines.push(k + ":" + lang));
  await settle();
  check("the status is spoken from the lead tool, with no page needed", /^0 of 5 sent today, 5 left/.test(said.pop() || ""), said);
}

{
  const MAPS = "https://www.google.com/maps/search/dentist+austin/@30.26,-97.74,13z";
  const win = windowFor(readFileSync(join(ROOT, "tests/html/maps-results.html"), "utf8"), MAPS);
  const ctx = { document: win.document, location: win.location, URL, console };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, "lib/nsp-extract.js"), "utf8"), ctx);
  const read = JSON.parse(JSON.stringify(await ctx.NSP_EXTRACT.read("", {})));
  read.host = "www.google.com";
  w.context.nspVoiceBizSite = cb => cb({ tabId: 7, windowId: 1, host: "www.google.com", url: MAPS, playbook: "local", access: "act", web: true });
  const ran = [];
  w.context.NSP_PAGE_AGENT = Object.assign({}, w.context.NSP_PAGE_AGENT, { run: (name, args, page) => { ran.push({ name, tabId: page.tabId, add: typeof page.add, leads: typeof page.leads }); return Promise.resolve(read); } });
  w.context._nspVoice.gen = 7;
  w.context.nspVoiceBiz({ kind: "biz", biz: "leads", lang: "en" }, 7, (k, lang) => lines.push(k + ":" + lang));
  for (let i = 0; i < 50 && !said.length; i++) await settle();
  const line = said.pop() || "";
  check("find clients here reads the page in front and judges it", ran.length === 1 && ran[0].name === "zerackExtract" && ran[0].tabId === 7 && ran[0].leads === "function", ran);
  check("and speaks the count and the best lead with its reason, every angle counting while no offer is saved", /^7 places judged: 4 Pitch, 0 Look at it, 3 Skip/.test(line) && /No offer saved yet/.test(line) && /Best: Austin Kids Teeth, because no website on its Google listing\./.test(line), line);
  w.context._nspVoice.gen = 8;
  w.context.nspVoiceBiz({ kind: "biz", biz: "read", lang: "es" }, 8, (k, lang) => lines.push(k + ":" + lang));
  for (let i = 0; i < 50 && !said.length; i++) await settle();
  const es = said.pop() || "";
  const ask = cascade[cascade.length - 1];
  check("in Spanish the English line is turned into Spanish by the model, numbers kept", es === "Hay 7 lugares: 3 para contactar. El mejor es Oakridge Family Dental." && /^Say this to the user in Spanish/.test(ask.messages[0].content) && /7 places read for "dentist austin"/.test(ask.messages[0].content) && !ask.tools, ask.messages[0].content.slice(0, 160));
  w.context.NSP_PAGE_AGENT.run = () => Promise.resolve({ ok: false, code: "site_not_allowed", host: "www.google.com" });
  w.context._nspVoice.gen = 9;
  w.context.nspVoiceBiz({ kind: "biz", biz: "read", lang: "en" }, 9, (k, lang) => lines.push(k + ":" + lang));
  await settle();
  check("a site not allowed yet says to allow it from the chat", lines.pop() === "biz_allow:en", lines);
  w.context.NSP_PAGE_AGENT.run = () => Promise.resolve({ ok: false, code: "drift", error: "x" });
  w.context._nspVoice.gen = 10;
  w.context.nspVoiceBiz({ kind: "biz", biz: "read", lang: "es" }, 10, (k, lang) => lines.push(k + ":" + lang));
  await settle();
  check("a page that changed says so instead of a number", lines.pop() === "biz_drift:es");
}

{
  cascade.length = 0;
  let answer = null;
  w.context.nspVoiceBizSite = cb => cb({ tabId: 7, windowId: 1, host: "www.upwork.com", url: "https://www.upwork.com/nx/search/jobs/?q=react", playbook: "freelance", access: "act", web: true });
  w.context.nspAssistVoice("\u00bfQu\u00e9 trabajos me convienen hoy?", "es", r => { answer = r; });
  for (let i = 0; i < 50 && !answer; i++) await settle();
  const p = cascade[0];
  const names = p.tools[0].functionDeclarations.map(t => t.name);
  const sys = JSON.stringify(p.systemParts);
  check("a spoken question on a business page goes to the business agent of that playbook", answer && answer.ok && /operator for freelancers on Upwork and Fiverr/.test(sys) && /PLATFORM TERMS: Upwork forbids robots/.test(sys), sys.slice(0, 200));
  check("it can read the page and work the leads, and has no tool that clicks, types or sends", names.includes("zerackExtract") && names.includes("zerackLeads") && names.includes("zerackPlaybook") && !names.includes("zerackPage") && !names.includes("zerackPagePlan"), names);
  check("its answer is short enough to be spoken", /This turn is spoken/.test(sys) && p.systemParts.some(x => x.id === "spoken"));
  cascade.length = 0;
  answer = null;
  w.context.nspVoiceBizSite = cb => cb(null);
  let ytAsked = 0;
  w.context.nspAssistVoiceAll = (t, l, cb) => { ytAsked++; cb({ ok: true, answer: "yt" }); };
  w.context.nspAssistVoice("\u00bfQu\u00e9 nicho empiezo esta semana?", "es", r => { answer = r; });
  await settle();
  check("with no business page in front, the question goes to the YouTube assistant as before", ytAsked === 1 && answer.answer === "yt");
}

done("voice-biz");
