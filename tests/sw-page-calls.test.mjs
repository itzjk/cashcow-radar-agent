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

// Saved channels, scan memory and the country feed are rebuilt against their shape.
{
  const w = loadWorker();
  let res = await w.send({ type: "NSP_SAVE_CHANNEL", data: { channelUrl: "https://www.youtube.com/@deep", name: "<img src=x onerror=alert(1)>Deep", subs: 5e12, blocked: true, avatarUrl: "https://evil.example/a.png", extra: "x" } }, SENDERS.youtube);
  const c = (w.local.nsp_all_channels || [])[0] || {};
  check("a saved channel loses markup, gets bounded numbers and a YouTube-only avatar", res && res.ok === true && c.name === "img src=x onerror=alert(1)Deep" && c.subs === 1e10 && c.avatarUrl === "" && !("extra" in c), JSON.stringify(c));
  check("and the page cannot block hub channels", !("blocked" in c));
  res = await w.send({ type: "NSP_SAVE_CHANNEL", data: { channelUrl: "https://evil.example/@x", name: "x" } }, SENDERS.youtube);
  check("a channel outside YouTube is not saved", res && res.ok === false && w.local.nsp_all_channels.length === 1, res);
  await w.send({ type: "NSP_SCAN_MARK_SEEN", entries: [{ title: "<b>Title</b>", videoId: "abcdefghijk", channelUrl: "javascript:x", nicheLabel: "Space" }] }, SENDERS.youtube);
  const m = w.local.nsp_scan_memory || {};
  check("scan memory keeps only shaped fields", (m.seenTitles || [])[0] === "btitle/b" && (m.seenVideoIds || [])[0] === "abcdefghijk" && !(m.seenChannelUrls || []).length, JSON.stringify(m));
  await w.send({ type: "NSP_FETCH_COUNTRY_FACELESS_FEED", gl: "X/../", hl: "<>", queries: ["space facts"] }, SENDERS.youtube);
  await new Promise(r => setTimeout(r, 50));
  const keys = Object.keys(w.local).filter(k => k.startsWith("nsp_country_feed_"));
  check("the country feed cannot name odd storage keys", keys.every(k => /^nsp_country_feed_[A-Z]{2}_[a-z-]+$/.test(k)), keys.join(","));
}

// The page world has no chrome.runtime: nothing in the bundle may still call it directly.
{
  const bundle = readFileSync(join(ROOT, "content/nsp-bundle.js"), "utf8");
  const live = bundle.split("\n").filter(l => /chrome\.runtime\.sendMessage\(|chrome\.storage\.local\.(get|set|remove)\(/.test(l) && !/^\s*\/\//.test(l));
  check("no direct chrome.runtime or chrome.storage call is left in the page-world bundle", live.length === 0, live.join(" | ").slice(0, 200));
}

done("sw-page-calls");
