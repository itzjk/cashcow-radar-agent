// Retired models are never called, the caller never picks the model, and a partial radar says it is partial.
import { loadWorker, SENDERS, check, done } from "./sw-harness.mjs";

const GROQ_KEY = "gsk_" + "a".repeat(40);
const GEMINI_KEY = "AIza" + "c".repeat(35);
const ok = { status: 200, body: { choices: [{ message: { content: "hi" } }] } };
const ask = { type: "ASHLYV_CHAT_REQUEST", payload: { messages: [{ role: "user", content: "hi" }], model: "gemini-1.5-flash" } };

for (const [label, local] of [
  ["a retired model saved in the picker", { nsp_groq_api_key: GROQ_KEY, nsp_selected_model: "groq:llama-3.1-70b-versatile" }],
  ["a retired Groq model saved by an older build", { nsp_groq_api_key: GROQ_KEY, nsp_groq_model: "mixtral-8x7b-32768" }]
]) {
  const w = loadWorker({ local, fetch: () => ok });
  await w.send(ask, SENDERS.popup);
  const call = w.fetches.find(f => /api\.groq\.com/.test(f.url));
  const model = call ? JSON.parse(call.init.body).model : "";
  check(label + " falls back to a live model", model === "llama-3.3-70b-versatile", model);
}
{
  const w = loadWorker({ local: { nsp_gemini_api_key: GEMINI_KEY, nsp_gemini_working_model: "gemini-1.5-flash" }, fetch: () => ({ status: 404, body: { error: { code: 404, message: "not found" } } }) });
  await w.send(ask, SENDERS.popup);
  const tried = w.fetches.filter(f => /generativelanguage/.test(f.url)).map(f => (f.url.match(/models\/([^:]+):/) || [])[1]);
  check("Gemini is asked for live models only", tried.length > 0 && !tried.some(m => /1\.5|-exp$/.test(m)), tried);
  check("and never for the model the caller named", !tried.includes("gemini-1.5-flash"), tried);
}

// The radar: one failed search out of three is reported, and a shape nobody reads is not "no videos".
const video = id => ({ videoRenderer: { videoId: id, title: { runs: [{ text: "Video " + id }] }, viewCountText: { simpleText: "1,234 views" }, publishedTimeText: { simpleText: "2 days ago" } } });
{
  let n = 0;
  const w = loadWorker({ fetch: url => {
    if (!/youtubei\/v1\/search/.test(url)) return null;
    n++;
    return n === 1 ? { status: 500, body: {} } : { status: 200, body: { contents: [video("aaaaaaaaaa" + n)] } };
  } });
  const res = await w.send({ type: "NSP_FETCH_COUNTRY_FACELESS_FEED", gl: "US", hl: "en", queries: ["a", "b", "c"], force: true }, SENDERS.popup);
  check("a partial radar says how many searches failed", res && res.ok === true && res.partial === true && res.failedSearches === 1 && res.searches === 3 && res.videos.length === 2, res);
  check("and names the error", res && Array.isArray(res.errors) && /500/.test(res.errors[0]), res && res.errors);
  check("and is not cached as the whole market", !Object.keys(w.local).some(k => /country/i.test(k)), Object.keys(w.local));
}
{
  const w = loadWorker({ fetch: url => /youtubei\/v1\/search/.test(url) ? { status: 200, body: { contents: [{ somethingNew: {} }] } } : null });
  const res = await w.send({ type: "NSP_FETCH_COUNTRY_FACELESS_FEED", gl: "US", hl: "en", queries: ["a", "b"], force: true }, SENDERS.popup);
  check("answers in an unknown shape are reported as that, not as an empty market", res && res.ok === false && /no_renderers_recognized/.test(res.error), res);
}

done("sw-models");
