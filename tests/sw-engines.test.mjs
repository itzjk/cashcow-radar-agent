import { loadWorker, SENDERS, check, done } from "./sw-harness.mjs";
import { source, RIVAL } from "./engines.mjs";

const GLOBALS = ["NSP_VEREDICTO", "NSP_CADENCIA", "NSP_PACKAGING", "NSP_RPM_TABLA", "NSP_RIVAL_FORMULA", "NSP_RIVAL_QUIEBRE", "NSP_RIVAL_REPLICABLE", "NSP_RIVAL_EXPEDIENTE", "NSP_RIVAL_SATURACION", "NSP_RIVAL_VENTANA", "NSP_RIVAL_DUELO", "NSP_TITULOS_SENALES", "NSP_TITULOS_TABLA", "NSP_TITULOS", "NspAreas", "NspMiniatura", "NspMiniaturaCohorte", "NspMiniaturaMercado", "NspDineroRpm", "NspDineroEquilibrio", "NspDineroCartera", "NspDineroCoste", "NspDineroRiesgo", "NSP_REVERSE_ENGINE"];

const EN_ID = "UCaaaaaaaaaaaaaaaaaaaaaa";
const ES_ID = "UCbbbbbbbbbbbbbbbbbbbbbb";

function lockup(id, title, views, age) {
  return { richItemRenderer: { content: { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: id, metadata: { lockupMetadataViewModel: {
    title: { content: title },
    metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: views } }, { text: { content: age } }] }] } }
  } } } } } };
}
function page(channelId, name, items) {
  return "<html><script>var ytInitialData = " + JSON.stringify({ metadata: { channelMetadataRenderer: { title: name, externalId: channelId } }, contents: items }) + ";</script></html>";
}
function feed(entries) {
  return '<?xml version="1.0" encoding="UTF-8"?><feed><title>Channel</title>' + entries.map(e => "<entry><id>yt:video:" + e[0] + "</id><yt:videoId>" + e[0] + "</yt:videoId><title>" + e[1] + "</title></entry>").join("") + "</feed>";
}
const header = init => String((init && init.headers && (init.headers["Accept-Language"] || init.headers["accept-language"])) || "");

const WORKER_CODE = source("background/service-worker.js").split("\n").filter(l => !/importScripts\(/.test(l)).join("\n");
{
  const w = loadWorker();
  check("the worker loads the RPM table its title check reads", w.context.NSP_RPM_TABLA && typeof w.context.NSP_RPM_TABLA.idiomaDe === "function");
  const idle = GLOBALS.concat(["NSP_GATE", "NSP_HANDS"]).filter(k => w.context[k] && !new RegExp("\\b" + k + "\\b").test(WORKER_CODE));
  check("every engine the worker loads is one the worker calls", idle.length === 0, idle);
  check("the policy engine in the worker carries the narration check", typeof w.context.NSPPolicy.evidenceOfNarration === "function");
}

const EN_VIDEOS = Array.from({ length: 30 }, (_, i) => ["en" + String(i).padStart(9, "0"), "Why the Roman Empire Really Fell, Part " + i, (i === 12 ? "4,512,338" : String(20000 + i * 1000)) + " views", (i + 1) + " weeks ago"]);
{
  const w = loadWorker({ fetch: (url, init) => {
    if (/\/@english\/videos/.test(url)) return { status: 200, body: page(EN_ID, "English channel", EN_VIDEOS.map(v => lockup(v[0], v[1], v[2], v[3]))) };
    if (/feeds\/videos\.xml\?channel_id=/.test(url)) return { status: 200, body: feed(EN_VIDEOS.slice(0, 15).map(v => [v[0], v[1].replace("&", "&amp;")])) };
    return null;
  } });
  const res = await w.send({ type: "NSP_AGENT_CHANNEL_VIDEOS", channelUrl: "https://www.youtube.com/@english" }, SENDERS.popup);
  const first = w.fetches.find(f => /\/@english\/videos/.test(f.url));
  check("the reader answers", res && res.ok === true, res);
  check("the channel page is asked for in English, by header and by hl", first && /\/videos\?hl=en&gl=US$/.test(first.url) && header(first.init) === "en-US,en", first && { url: first.url, lang: header(first.init) });
  check("no request asks YouTube for Spanish titles", !w.fetches.some(f => /(^|,)\s*es\b/.test(header(f.init))), w.fetches.map(f => header(f.init)));
  check("the agent tool keeps its 15 uploads", res.count === 15 && res.videos.length === 15, res.count);
  check("every upload carries its view count as a number", res.videos.every(v => typeof v.viewsNum === "number" && v.viewsNum > 0), res.videos.map(v => v.viewsNum));
  check("and the text it came from", res.videos[0].views === "20000 views" && res.videos[0].viewsNum === 20000, res.videos[0]);
  check("an English channel is not read again in another language", w.fetches.filter(f => /\/@english\/videos/.test(f.url)).length === 1, w.fetches.map(f => f.url));
  check("the titles are the originals the feed carries", res.titleCheck && res.titleCheck.source === "feed" && res.titleCheck.fromFeed === 15 && res.titleCheck.language === "en", res.titleCheck);

  const thirty = await w.context.nspReadChannelVideos("https://www.youtube.com/@english", 30);
  check("a caller that needs the history can ask for 30", thirty.ok && thirty.count === 30, thirty.count);
  check("and never more than 30", (await w.context.nspReadChannelVideos("https://www.youtube.com/@english", 500)).count === 30);
  check("a grouped count parses whole", thirty.videos[12].viewsNum === 4512338, thirty.videos[12]);

  w.context.importScripts(...RIVAL.map(f => "../" + f));
  const Q = w.context.NSP_RIVAL_QUIEBRE, F = w.context.NSP_RIVAL_FORMULA, E = w.context.NSP_RIVAL_EXPEDIENTE;
  const q = Q.medir(thirty.videos);
  check("the break engine runs on what the reader returns", q.ok === true && q.total === 30, q);
  const f = F.medir(thirty.videos);
  check("the formula engine runs on it too", f.ok === true && f.cuantos === 10, f);
  const e = E.armar({ videos: thirty.videos, canal: { nombre: thirty.name, url: thirty.channelUrl } });
  check("and the dossier puts every piece together", e.ok === true && e.cadencia.ok && e.quiebre.ok && e.formula.ok && e.replicable.ok && e.nicho.ok, e.faltan);
}

const ES_ORIGINAL = Array.from({ length: 30 }, (_, i) => "La verdadera historia del imperio romano que nadie te conto, parte " + i);
const ES_ON_EN_PAGE = ES_ORIGINAL.map((t, i) => i % 2 ? "The true story of the Roman empire that nobody told you, part " + i : t);
{
  const pages = [];
  const w = loadWorker({ fetch: (url, init) => {
    if (/\/@espanol\/videos/.test(url)) {
      pages.push(header(init));
      const titles = header(init) === "es" ? ES_ORIGINAL : ES_ON_EN_PAGE;
      return { status: 200, body: page(ES_ID, "Canal", titles.map((t, i) => lockup("es" + String(i).padStart(9, "0"), t, String(5000 + i * 100) + " views", (i + 1) + " days ago"))) };
    }
    if (/feeds\/videos\.xml/.test(url)) return { status: 200, body: feed(ES_ORIGINAL.slice(0, 15).map((t, i) => ["es" + String(i).padStart(9, "0"), t])) };
    return null;
  } });
  const res = await w.context.nspReadChannelVideos("https://www.youtube.com/@espanol", 30);
  check("a Spanish channel shown with English titles is caught by its own feed", res.titleCheck.language === "es" && res.titleCheck.localized > 0, res.titleCheck);
  check("the uploads the feed covers get their original title", res.videos.slice(0, 15).every((v, i) => v.title === ES_ORIGINAL[i]), res.videos.slice(0, 15).map(v => v.title));
  check("the older ones are read again in the channel's language", pages.length === 2 && pages[1] === "es" && res.titleCheck.fromNativePage === 15, { pages, check: res.titleCheck });
  check("so all 30 titles come back in Spanish", res.videos.every((v, i) => v.title === ES_ORIGINAL[i]), res.videos.map(v => v.title));
  check("while the numbers still come from the English page", res.videos.every((v, i) => v.viewsNum === 5000 + i * 100), res.videos.map(v => v.viewsNum));
}
{
  const w = loadWorker({ fetch: url => {
    if (/\/@nofeed\/videos/.test(url)) return { status: 200, body: page(EN_ID, "No feed", EN_VIDEOS.slice(0, 5).map(v => lockup(v[0], v[1], v[2], v[3]))) };
    if (/feeds\/videos\.xml/.test(url)) return { status: 404, body: "not found" };
    return null;
  } });
  const res = await w.context.nspReadChannelVideos("https://www.youtube.com/@nofeed");
  check("when the feed is down the page titles stay and it says where they came from", res.ok && res.count === 5 && res.titleCheck.source === "page" && res.videos[0].title === EN_VIDEOS[0][1], res);
}
{
  const w = loadWorker();
  const parsed = w.context.nspFeedTitles(feed([["abc", "Tom &amp; Jerry&#39;s &quot;Last&quot; Chase &#x2014; Part 2"], ["def", "Plain"]]));
  check("feed titles decode their entities", parsed.abc === "Tom & Jerry's \"Last\" Chase \u2014 Part 2" && parsed.def === "Plain", parsed);
  check("a feed with no entries gives no titles instead of guessing", Object.keys(w.context.nspFeedTitles("<feed><title>Channel</title></feed>")).length === 0);
}
{
  const w = loadWorker();
  const res = await w.context.nspReadChannelVideos("https://evil.example/@x");
  check("a non YouTube address is refused before any fetch", res.error === "invalid_channel_url" && w.fetches.length === 0, res);
}

done("sw-engines");
