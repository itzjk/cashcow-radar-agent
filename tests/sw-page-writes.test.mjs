// What a YouTube page may make the worker store, choose or show: each key has a shape, the model takes a real
// press, and a notification is the worker's words with the page's numbers, a few per tab.
import { loadWorker, SENDERS, check, done } from "./sw-harness.mjs";

// Storage writes from the page go through NSP_PAGE_STORE_SET and are rebuilt against each key's shape.
{
  const w = loadWorker();
  let res = await w.send({ type: "NSP_PAGE_STORE_SET", items: {
    ashlyv_alerts_unread: "7",
    ashlyv_niche_stats: { "Space <b>facts</b>": { avgRpm: 99999, trend: "<img onerror=x>", rpmHistory: [1, 2, 3, 4, 5, 6, 7], extra: "x" } },
    nsp_watching: { a: { channelUrl: "javascript:alert(1)" }, b: { channelUrl: "https://www.youtube.com/@x", name: "<i>X</i>", knownVideoIds: ["abcdefghijk", "bad"] } }
  } }, SENDERS.youtube);
  check("a page write is accepted when it fits", res && res.ok === true, res);
  check("numbers are numbers and bounded", w.local.ashlyv_alerts_unread === 7 && w.local.ashlyv_niche_stats["Space bfacts/b"].avgRpm === 1000, JSON.stringify(w.local.ashlyv_niche_stats));
  check("ids from a list, lists capped, unknown fields dropped", w.local.ashlyv_niche_stats["Space bfacts/b"].trend === "new" && w.local.ashlyv_niche_stats["Space bfacts/b"].rpmHistory.length === 5 && !("extra" in w.local.ashlyv_niche_stats["Space bfacts/b"]));
  check("a watched channel needs a YouTube address, and loses its markup", !w.local.nsp_watching.a && w.local.nsp_watching.b.name === "iX/i" && w.local.nsp_watching.b.knownVideoIds.join() === "abcdefghijk", JSON.stringify(w.local.nsp_watching));

  for (const key of ["nsp_selected_model", "nsp_pending_action", "ashlyv_nichos", "nsp_agent_enabled", "nsp_vision_allowed", "nsp_openai_api_key"]) {
    const before = JSON.stringify(w.local[key]);
    res = await w.send({ type: "NSP_PAGE_STORE_SET", items: { [key]: key === "ashlyv_nichos" ? [{ title: "<img src=x onerror=alert(1)>" }] : "gpt-4o" } }, SENDERS.youtube);
    check(key + " is not writable from the page", res && res.ok === false && JSON.stringify(w.local[key]) === before && res.refused && res.refused[0].reason === "not writable from the page", res);
  }
  res = await w.send({ type: "NSP_PAGE_STORE_SET", items: { ashlyv_rpm_baselines: Object.fromEntries(Array.from({ length: 300 }, (_, i) => ["n" + i, i])) } }, SENDERS.youtube);
  check("maps are capped", res && res.ok === true && Object.keys(w.local.ashlyv_rpm_baselines).length === 200);
  res = await w.send({ type: "NSP_PAGE_STORE_SET", items: { nsp_channel_faceless_v2: Object.fromEntries(Array.from({ length: 5000 }, (_, i) => ["UC" + "x".repeat(40) + i, { score: 50, ts: 1 }])) } }, SENDERS.youtube);
  check("a value over the size cap is refused with the reason", res && res.ok === false && /larger than/.test(res.refused[0].reason), res && res.refused);
  res = await w.send({ type: "NSP_PAGE_STORE_SET", items: { ashlyv_alerts_unread: 1 } }, SENDERS.site);
  check("another site has no seat on page writes", res && res.error === "sender_not_allowed", res);
}

// The model decides what a turn costs: from YouTube it takes a real press, and only a catalog entry.
{
  const w = loadWorker();
  let res = await w.send({ type: "NSP_MODEL_SELECT", id: "openai:gpt-4o" }, SENDERS.youtube);
  check("choosing the model from YouTube needs a press", res && res.error === "no_grant" && w.local.nsp_selected_model === undefined, res);
  await w.send({ type: "NSP_GRANT_OPEN", kind: "model" }, SENDERS.youtube);
  res = await w.send({ type: "NSP_MODEL_SELECT", id: "groq:not-a-model" }, SENDERS.youtube);
  check("a model outside the catalog is refused", res && res.error === "unknown_model", res);
  await w.send({ type: "NSP_GRANT_OPEN", kind: "model" }, SENDERS.youtube);
  res = await w.send({ type: "NSP_MODEL_SELECT", id: "groq:llama-3.3-70b-versatile" }, SENDERS.youtube);
  check("after a press a catalog model is saved with its provider", res && res.ok === true && w.local.nsp_selected_model === "groq:llama-3.3-70b-versatile" && w.local.nsp_preferred_provider === "groq", res);
}

// Notifications: a code and numbers from the page, the words from the worker, three per tab per quarter hour.
{
  const w = loadWorker();
  let res = await w.send({ type: "ASHLYV_SHOW_NOTIFICATION", title: "Your account is locked", message: "Sign in at evil.example", iconUrl: "https://evil.example/i.png" }, SENDERS.youtube);
  check("a notice with the page's own title and text is refused", res && res.ok === false && res.error === "unknown_notice" && !w.calls.some(c => c.api === "notifications.create"), res);
  res = await w.send({ type: "ASHLYV_SHOW_NOTIFICATION", code: "niche_new", niche: "Account locked: visit evil.example", rpm: 5 }, SENDERS.youtube);
  check("a niche name that carries an address or punctuation is refused", res && res.ok === false, res);
  res = await w.send({ type: "ASHLYV_SHOW_NOTIFICATION", code: "niche_rising", niche: "Space facts", rpmBefore: 3, rpmAfter: 5.5 }, SENDERS.youtube);
  const shown = (w.calls.find(c => c.api === "notifications.create") || { args: [{}] }).args[0];
  check("a known notice is written by the worker", res && res.ok === true && shown.title === "Niche on the rise: Space facts" && /\$3\.00 to \$5\.50/.test(shown.message) && /icons\/icon128\.png$/.test(shown.iconUrl), shown);
  for (let i = 0; i < 3; i++) res = await w.send({ type: "ASHLYV_SHOW_NOTIFICATION", code: "niche_new", niche: "Space facts", rpm: 4 }, SENDERS.youtube);
  check("the fourth notice in a quarter hour from one tab is refused", res && res.error === "notice_rate_limited", res);
  res = await w.send({ type: "ASHLYV_SHOW_NOTIFICATION", code: "niche_new", niche: "Space facts", rpm: 4 }, SENDERS.youtube2);
  check("another tab has its own allowance", res && res.ok === true, res);
}

done("sw-page-writes");
