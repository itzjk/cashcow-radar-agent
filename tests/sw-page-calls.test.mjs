// What a YouTube tab may send through the relay besides storage: scan preferences, dashboard opens, opportunity
// history and alerts. Each value is rebuilt in the worker; alert and opportunity words come from the ASHLYV engine.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadWorker, SENDERS, check, done } from "./sw-harness.mjs";

// Scan preferences keep their shape.
{
  const w = loadWorker();
  await w.send({ type: "NSP_UI_PREFS_SET", prefs: { language: "es", market: "spain", depth: "deep", extra: "<b>x</b>" } }, SENDERS.youtube);
  check("scan preferences are stored with their shape", JSON.stringify(w.local.nsp_ui_prefs) === JSON.stringify({ language: "es", market: "spain", depth: "deep" }), JSON.stringify(w.local.nsp_ui_prefs));
  await w.send({ type: "NSP_UI_PREFS_SET", prefs: { language: "<script>", market: "a".repeat(400), depth: 7 } }, SENDERS.youtube);
  check("values outside the shape fall back to the defaults", JSON.stringify(w.local.nsp_ui_prefs) === JSON.stringify({ language: "auto", market: "global", depth: "balanced" }), JSON.stringify(w.local.nsp_ui_prefs));
}

// A YouTube tab opens the hub at a person's pace.
{
  const w = loadWorker();
  let res = await w.send({ type: "ASHLYV_OPEN", channel: "Veritasium", url: "https://evil.example/" }, SENDERS.youtube);
  const opened = w.calls.filter(c => c.api === "tabs.create");
  check("the hub opens with the channel and without a foreign address", res && res.ok === true && opened.length === 1 && /ashlyv\/ashlyv\.html\?channel=Veritasium$/.test(opened[0].args[0].url), opened[0] && opened[0].args[0].url);
  res = await w.send({ type: "ASHLYV_OPEN", channel: "again" }, SENDERS.youtube);
  check("a second open within 2 s is refused", res && res.error === "open_rate_limited" && w.calls.filter(c => c.api === "tabs.create").length === 1, res);
}

// Opportunity history: only engine niches and languages, words from the engine.
{
  const w = loadWorker();
  const res = await w.send({ type: "ASHLYV_OPPORTUNITY_HISTORY_PUSH", entries: [
    { languageCode: "en", nicheId: "history_documentary", opportunityScore: 8.4, estimatedRpm: 9.2, competitionScore: 3, saturationScore: 8, recommendedNiche: "<b>Phish</b>", why: "<script>x</script>" },
    { languageCode: "en", nicheId: "not-a-niche", opportunityScore: 9 },
    { languageCode: "xx", nicheId: "history_documentary", opportunityScore: 9 }
  ] }, SENDERS.youtube);
  const h = w.local.ashlyv_opportunity_history || [];
  check("only opportunities with an engine niche and language are kept", res && res.ok === true && h.length === 1, res);
  check("with the engine's name, bands and verdict, and no page text", h[0] && !/Phish|</.test(JSON.stringify(h[0])) && h[0].competitionLabel === "Low" && h[0].saturationLabel === "High" && h[0].verdict === "TEST" && !("why" in h[0]), JSON.stringify(h[0] || {}));
}

// Alerts: pushed from numbers, dismissed by signature.
{
  const w = loadWorker();
  w.local.ashlyv_alerts_unread = 2;
  let res = await w.send({ type: "ASHLYV_ALERT_PUSH", opportunity: { languageCode: "es", nicheId: "history_documentary", opportunityScore: 8.8, estimatedRpm: 7.5, competitionScore: 2, saturationScore: 3 }, alert: { title: "Your account is locked", message: "visit evil.example" } }, SENDERS.youtube);
  const a = (res && res.alert) || {};
  check("the alert is written by the worker with the engine", res && res.show === true && / - Spanish$/.test(a.title || "") && /^RPM \$8 \| Competition Low \| Score 8\.8$/.test(a.message || "") && !/locked|evil/.test(JSON.stringify(a)), a.title + " / " + a.message);
  check("it enters the history and adds one unread", (w.local.ashlyv_alert_history || []).length === 1 && w.local.ashlyv_alerts_unread === 3);
  res = await w.send({ type: "ASHLYV_ALERT_PUSH", opportunity: { languageCode: "es", nicheId: "history_documentary", opportunityScore: 8.8, estimatedRpm: 7.5 } }, SENDERS.youtube);
  check("the same alert is not repeated", res && res.show === false && w.local.ashlyv_alert_history.length === 1);
  res = await w.send({ type: "ASHLYV_ALERT_DISMISS", signature: a.signature }, SENDERS.youtube);
  check("dismissing marks it and takes one off unread", res && res.dismissed === true && w.local.ashlyv_alert_history[0].dismissed === true && w.local.ashlyv_alerts_unread === 2, res);
  res = await w.send({ type: "ASHLYV_ALERT_PUSH", opportunity: { languageCode: "en", nicheId: "not-a-niche", opportunityScore: 9 } }, SENDERS.youtube);
  check("an invented opportunity makes no alert", res && res.ok === false && w.local.ashlyv_alert_history.length === 1, res);
}

// The live alert card rendered with a helper that does not exist.
{
  const bundle = readFileSync(join(ROOT, "content/nsp-bundle.js"), "utf8");
  check("the live alert card has no undefined money helper", !/moneyLabel\(/.test(bundle));
  check("the scanner sends the opportunity, not a ready-made alert", /type: 'ASHLYV_ALERT_PUSH', opportunity: top/.test(bundle));
}

done("sw-page-calls");
