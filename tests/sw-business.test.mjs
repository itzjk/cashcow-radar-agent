// The worker with the business playbooks loaded: the chat's new tools answer through the real dispatcher, and the Agent switch still guards reading the page.
import { loadWorker, check, done } from "./sw-harness.mjs";

const call = (w, fn, name, args, ctx) => new Promise(r => w.context[fn](name, args, ctx, r));

{
  const w = loadWorker();
  const P = w.context.NSP_PLAYBOOKS;
  check("the worker loads the ten playbooks and the business engine", P && P.list().map(p => p.id).join() === "etsy,shopify,seo,builders,creators,freelance,local,amazon,newsletter,digital" && typeof w.context.NSP_BUSINESS.analyze === "function");
  check("the worker loads the engines the business reads call", !!(w.context.NSP_REVERSE_ENGINE && w.context.NSP_CADENCIA && w.context.NspDineroEquilibrio));
  check("a saved site now records its playbook", w.context.NSP_SITES.playbookFor("www.etsy.com") === "etsy" && w.context.NSP_SITES.playbookFor("example.com") === "web" && w.context.NSP_SITES.playbookFor("www.youtube.com") === "youtube");

  const be = await call(w, "nspChatToolNow", "zerackBreakEven", { price: 30, cost: 9, shipCost: 4.5 }, { playbook: "etsy" });
  check("the break-even tool answers with the Etsy fees", be.ok && be.feesTotal === 3.3 && be.marginPerSale === 13.2 && /^A \$30\.00 sale leaves \$13\.20/.test(be.line), be);
  const noPb = await call(w, "nspChatToolNow", "zerackBreakEven", { price: 30, cost: 9 }, {});
  check("with no playbook loaded it says there is no fee table", noPb.ok === false && noPb.code === "no_fees", noPb);
  const lesson = await call(w, "nspChatToolNow", "zerackPlaybook", { lesson: "s3-l2" }, { playbook: "shopify" });
  check("the playbook tool returns the Shopify lesson with its source", lesson.ok && lesson.lessons[0].id === "s3-l2" && /help\.shopify\.com/.test(lesson.lessons[0].sources[0]), lesson);
  const off = await call(w, "nspChatTool", "zerackExtract", {}, { page: null });
  check("reading the page is refused while the Agent switch is off", off.ok === false && off.code === "agent_off", off);
}
{
  const w = loadWorker({ local: { nsp_agent_enabled: true } });
  const noTurn = await call(w, "nspChatTool", "zerackExtract", {}, { page: null });
  check("with the switch on, reading the page still needs a chat turn and its tab", noTurn.ok === false && /runs only inside a chat turn/.test(noTurn.error), noTurn);
  const drift = w.context.nspBusinessRead({ ok: false, code: "drift", error: "x" });
  check("a drift answer reaches the model untouched", drift.code === "drift");
  const good = await w.context.nspBusinessRead({ ok: true, reader: "github.issues", count: 2, pageTitle: "Issues", rows: [{ title: "Export to PDF", number: 1, comments: 3, labels: [] }, { title: "PDF export broken", number: 2, comments: 5, labels: [] }] });
  check("a read the worker understands comes back with its line and analysis", good.ok && /2 issues read/.test(good.line) && good.analysis.repeated[0].word === "export" && good.analysis.repeated[0].comments === 8, good.line);
  const saved = [];
  w.context.NSP_CHAT_STORE = { lastSeries: key => Promise.resolve(saved.filter(x => x.key === key).pop() || null), addSeries: e => { saved.push(JSON.parse(JSON.stringify(e))); return Promise.resolve(e); } };
  const page = n => ({ ok: true, reader: "github.issues", url: "https://github.com/o/r/issues?utm_source=x", host: "github.com", playbook: "builders", count: n, pageTitle: "Issues", rows: Array.from({ length: n }, (_, i) => ({ title: "Export to PDF " + i, number: i + 1, comments: i, labels: [] })) });
  const r1 = await w.context.nspBusinessRead(page(3));
  check("the first read of a page is remembered and says nothing about change", r1.ok && !r1.sinceLast && saved.length === 1 && saved[0].key === "github.issues|https://github.com/o/r/issues" && saved[0].ids.join() === "1,2,3", saved[0]);
  const r2 = await w.context.nspBusinessRead(page(5));
  check("the next read of the same page says what changed", r2.sinceLast && /^Since the last read 1 minute ago: rows 5 \(was 3\), 2 new\.$/.test(r2.sinceLast.line) && saved.length === 2, r2.sinceLast);
  w.context.NSP_CHAT_STORE = { lastSeries: () => new Promise(() => {}), addSeries: () => new Promise(() => {}) };
  const t0 = Date.now();
  const alive = setTimeout(() => {}, 5000);
  const r3 = await w.context.nspBusinessRead(page(2));
  clearTimeout(alive);
  check("a stuck database never holds the answer back", r3.ok && r3.count === 2 && Date.now() - t0 < 1500, Date.now() - t0);
  const pick = w.context.nspChatPlaybook;
  check("the chat turn takes the playbook of the tab first", pick({ web: true, playbook: "etsy" }, "shopify question") === "etsy");
  check("then the business the question names", pick({ web: true, playbook: "web" }, "How do I grow my Shopify store?") === "shopify" && pick(null, "My SaaS churn") === "builders");
  check("and none when neither says", pick({ web: true, playbook: "web" }, "hello") === "" && pick({ web: false, playbook: "youtube" }, "what niche") === "");
}

done("sw-business");
