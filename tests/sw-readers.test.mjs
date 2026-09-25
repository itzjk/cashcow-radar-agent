// The worker's YouTube readers: what they return for the shapes YouTube serves today, and that a missing
// field comes back as missing, never as another number.
import { loadWorker, SENDERS, check, done, EXT_ID } from "./sw-harness.mjs";

const page = data => "<html><script>var ytInitialData = " + JSON.stringify(data) + ";</script></html>";
const about = {
  metadata: { channelMetadataRenderer: { title: "Veritasium", externalId: "UCHnyfMqiRRG1u-2MsSQLbXA" } },
  onResponseReceivedEndpoints: [{ showEngagementPanelEndpoint: { engagementPanel: { content: { aboutChannelRenderer: { metadata: { aboutChannelViewModel: {
    subscriberCountText: "21.3M subscribers", viewCountText: "4,589,393,495 views", videoCountText: "536 videos",
    joinedDateText: { content: "Joined Jul 21, 2010" }, country: "United States", channelId: "UCHnyfMqiRRG1u-2MsSQLbXA", description: "An element of truth"
  } } } } } } }],
  // A video elsewhere on the page carries its own view count, which a text search used to take for the channel's.
  contents: { videoRenderer: { viewCountText: { simpleText: "55,212,114 views" } } }
};

{
  const w = loadWorker({ fetch: url => /\/about/.test(url) ? { status: 200, body: page(about) } : null });
  const res = await w.send({ type: "NSP_AGENT_CHANNEL_STATS", channelUrl: "https://www.youtube.com/@veritasium" }, SENDERS.popup);
  check("channel stats read the About panel model", res && res.ok === true, res);
  check("subscribers, videos and views are the channel's", res.subscriberCount === 21300000 && res.videoCount === 536 && res.totalViews === 4589393495, res);
  check("the join date is a date", res.joinedDate === "2010-07-21" && res.joined === "Jul 21, 2010", res);
  check("the page is asked for in English so the figures parse", w.fetches.some(f => /\/about\?hl=en/.test(f.url)), w.fetches.map(f => f.url));
}
{
  const w = loadWorker({ fetch: url => /\/about/.test(url) ? { status: 200, body: page({ metadata: about.metadata, contents: about.contents }) } : null });
  const res = await w.send({ type: "NSP_AGENT_CHANNEL_STATS", channelUrl: "https://www.youtube.com/@veritasium" }, SENDERS.popup);
  check("with no About panel the reader says so instead of guessing", res && res.ok === false && res.error === "about_panel_not_found", res);
}
{
  const w = loadWorker();
  const res = await w.send({ type: "NSP_AGENT_CHANNEL_STATS", channelUrl: "https://evil.example/youtube.com" }, SENDERS.popup);
  check("a non YouTube address is refused before any fetch", res && res.error === "invalid_channel_url" && !w.fetches.some(f => /evil/.test(f.url)), res);
}

// The compact lockup layout shortens the visible text; the accessibility label keeps the words.
{
  const w = loadWorker();
  const lockup = { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: "JsBZOcqZerk", metadata: { lockupMetadataViewModel: {
    title: { content: "The Insane Real Engineering of the Enigma" },
    metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [
      { text: { content: "4,7 M" }, accessibilityLabel: "4,7 millones de visualizaciones" },
      { text: { content: "hace 3 d" }, accessibilityLabel: "hace 3 días" }
    ] }] } }
  } } } };
  const vids = w.context.extractVideosFromInnertube({ contents: [lockup] });
  check("a compact lockup still yields views and age", vids.length === 1 && /millones/.test(vids[0].viewsText) && /3 días/.test(vids[0].publishedText), vids);
}

// InnerTube refuses the extension's origin, so the worker installs the rule that drops it, for its own requests only.
{
  const w = loadWorker();
  await new Promise(r => setTimeout(r, 20));
  const call = w.calls.find(c => c.api === "dnr.updateSessionRules");
  const rule = call && call.args[0].addRules && call.args[0].addRules[0];
  check("the worker sets a session rule for youtubei", !!rule && /youtubei/.test(rule.condition.urlFilter), call);
  check("it removes the Origin header", rule && rule.action.type === "modifyHeaders" && rule.action.requestHeaders.some(h => h.header === "origin" && h.operation === "remove"), rule);
  check("and only on requests this extension starts", rule && JSON.stringify(rule.condition.initiatorDomains) === JSON.stringify([EXT_ID]), rule && rule.condition);
}

done("sw-readers");
