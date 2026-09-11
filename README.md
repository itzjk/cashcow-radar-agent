# cashcow-radar-agent

ZERACK is a Chrome extension (Manifest V3) that reads YouTube the way a channel owner needs it read: what is actually moving, whether the format is one you can reproduce without a camera, and whether the script you are about to publish will get the channel demonetized.

It runs in your browser. No server, no account, no telemetry. Every AI panel is optional and uses a key you paste yourself.

## What is here that is not anywhere else

**A demonetization policy engine.** `nsp-policy.js` is a rules engine over `data/policies.json`: it normalizes a script (diacritics folded, `ß` to `ss`, everything non-alphanumeric collapsed), matches the rule table in word or substring mode with an uppercase guard so `ss` does not fire inside *besser*, and maps every hit back to its index in the original text so you can see the exact phrase. It also keeps a per-channel corpus of top-400 token frequencies (never the raw script) and scores a new script against it, so a near-duplicate of your own back catalogue comes back yellow with the inauthentic-content reason instead of green. The service worker loads it and answers `policy:rules` and `policy:evaluate`, and the listener refuses any sender that is not this extension. **No surface calls it yet** (see Limits): today it is an engine with a message API and no button.

**A reverse engine for titles, built from your own scan.** `knowledge/reverse-engine.js` takes the videos a scan just measured, finds the outliers against that set's own median, and reports which title formats over-index inside the outliers versus the rest, which words live in them, how they open in the first two words, which channels own the niche, and a fill-in template drawn from the format that actually took off. It is wired into the coach prompt at `content/nsp-bundle.js:21302`. Nothing here is generic blog advice: every number comes from the videos on your screen.

**Faceless detection that looks at the thumbnail.** face-api.js `tinyFaceDetector` runs locally on each thumbnail, with the weights served from `lib/face-api/` through the bridge, and rejects a card when a face covers more than the area threshold. That is a measurement of the image, not a guess from the title.

**Growth measured from two readings or not shown at all.** The Command Center's *Measure growth* reads each saved channel's subscriber and view totals and stores a timestamped snapshot under `zerack_channel_snapshots_v1`. With fewer than two snapshots, or two less than half a day apart, `computeGrowth` returns no rate and the cell prints `-` with the title *Never measured*. There is no modelled growth anywhere.

**Discovery that costs no quota.** The country radar and the channel readers go through `https://www.youtube.com/youtubei/v1/`, the same private API the page itself calls, with the public WEB key YouTube ships in every page it serves and `credentials: 'omit'` so nothing is personalized to your account. No YouTube Data API units are spent to find anything.

## Install

```
git clone <this repo>
cd cashcow-radar-agent
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder. That is all: the scanner, the scan, the policy engine, the country radar and every panel work from a plain checkout.

`scripts/fetch-assets.sh` downloads four large binaries into `lib/whisper/`, each checked against the SHA-256 of the build this code shipped with. **You do not need to run it.** Nothing in the extension imports `lib/whisper/` today; the script is there for whoever wires local transcription back up.

## Models and where keys go

Open **Options**: the Settings button in the popup, or `chrome://extensions`, Details, Extension options. It opens in its own tab.

| Field | Storage key | What it is for |
|---|---|---|
| Groq API key (`gsk_…`) | `nsp_groq_api_key` | free tier, tried first for text |
| Gemini API key (`AIza…`) | `nsp_gemini_api_key` | Google, text and thumbnail vision |
| Enable Ollama, URL, model | `nsp_ollama_enabled`, `nsp_ollama_url`, `nsp_ollama_model` | a model on your own machine, no limits, offline |
| Assistant model | `nsp_selected_model` | the picker |
| Let a scan send thumbnails to the vision model | `nsp_vision_allowed` | off by default |

The **Assistant model** picker is the one catalog, `lib/nsp-models.js`, read by the options page, the service worker and the overlay. Picking an entry sets the preferred provider, it does not lock you to it: on a rate limit or a failure the service worker falls through to the next provider you have configured, in the order Groq, Ollama, Gemini. Picking *Auto* takes that order as it stands.

Keys live in `chrome.storage.local` and leave the browser only to reach the provider whose key you pasted. Without any key the metrics overlay, the scan, the tracking panel, the country radar, the niche index and the policy engine all still work; the AI panels say they have no provider.

**A stored key is not permission to spend it.** Sending a thumbnail to the vision model is a separate checkbox in Options, and the service worker refuses the call with `vision_not_allowed` when the flag is not exactly `true` (`background/service-worker.js:1160`). The in-page thumbnail analyzer asks the same question through `ashlyv_thumbnail_consent`.

## What each surface does

**On youtube.com** (`content/nsp-bundle.js`, the engine)
- A badge on every video card: views per hour, the multiplier against that channel's own average, a tier, an opportunity score, and a revenue estimate labelled `est.` because it is one. Each of the five can be switched off in Options.
- **SCAN** sweeps the feed you are on (home, search, a channel, trending), keeps the faceless videos with traction, and puts a niche read on top.
- A country selector that switches the feed's market and rescans it.
- A tracking panel for channels under watch, an ad-placement probe that reports monetized, likely, not monetized or cannot check, a thumbnail analyzer, a transcript reader and a comment reader.

**On studio.youtube.com** (`content/nsp-studio.js`) reads your own Studio page, recognizes which page it is, and scores title candidates against the titles that already worked, in the language the corpus is written in. Studio enforces Trusted Types, so this script builds DOM with `createElement` and `textContent` only.

**Popup** (`popup/`) session counters, the session's top videos, a CSV export, and the doors to the Command Center, the Niche Index, the country radar and Options.

**Command Center** (`dashboard/`) every saved channel with filters by source, niche and age, seven sort orders, a card and a table view, *Measure growth*, and export to CSV, JSON or the clipboard. Each summary tile prints *not measured* rather than a number when there is nothing measured behind it.

**ZERACK hub** (`ashlyv/`) saved niches and their monetization radar, the channel intelligence engine, the thumbnail analyzer and the idea panels, plus nine tool pages under `ashlyv/tools/` (ThumbLab and VoxBatch are the two the hub links today; see Limits).

**Country radar** (`country-feed/`) pick a market, get the faceless feed for that language through InnerTube, export it.

**Niche Index** (`niche-index/`) the niche table your own scans have filled in, with its RPM, and a CSV export.

**Service worker** (`background/service-worker.js`) the one place with privileges: the message hub, the provider cascade with its rate limiters, the InnerTube calls, the channel and transcript readers, the cookie write that switches market, the alarms, and the `policy:*` routes.

## Architecture in one paragraph

Three content scripts. The heavy one runs in the **MAIN** world, the page's own context, because it needs YouTube's internal data, and there it has no `chrome.*` at all: no storage, no messaging, no `runtime.getURL`. A small script in the **ISOLATED** world, `content/ashlyv-bridge.js`, is its only way out, and it is a relay with two explicit allowlists: `NSP_RELAY_CALLS` names the sixteen message types the page world may forward to the service worker, and `NSP_RELAY_KEYS` names the storage keys it may read or write, with a second rule that refuses any key whose name contains *key*, *token*, *secret*, *password* or *auth* even if it were listed. The third content script runs only on Studio. The service worker holds every privileged call: network, cookies, tabs, notifications, alarms, and the policy engine loaded with `importScripts`. Extension pages run under `script-src 'self' 'wasm-unsafe-eval'`, so there is no inline script and no inline handler anywhere, and `node smoke.mjs` fails if one appears.

## Permissions, and why

| Permission | Reason |
|---|---|
| `storage` | your keys, saved niches, tracked channels, growth snapshots, the niche index |
| `scripting` | the popup reads the live session out of the open YouTube tab's MAIN world |
| `tabs` | opening the hub, the Command Center and a market search, and knowing which tab is active |
| `alarms` | the periodic rescan and trend check |
| `cookies` | writing YouTube's `PREF` cookie, the only way to switch market |
| `notifications` | the scan and alert notifications |
| `clipboardWrite` | the copy buttons that go through `document.execCommand('copy')` |
| `downloads` | declared and not called: the CSV and JSON exports use a blob and `<a download>`. Drop it |
| `https://www.youtube.com/*`, `https://*.youtube.com/*` | where the overlay runs, and the InnerTube endpoint |
| `https://studio.youtube.com/*` | the Studio agent |
| `https://www.googleapis.com/*` | the YouTube Data API, for comments and channel reads |
| `https://generativelanguage.googleapis.com/*` | Gemini, when you have pasted a Gemini key |
| `https://api.groq.com/*` | Groq, when you have pasted a Groq key |
| `https://translate.googleapis.com/*` | translating a foreign-language title before scoring it |
| `https://i.ytimg.com/*`, `https://img.youtube.com/*` | reading thumbnail pixels for the face and contrast checks |
| `http://localhost/*`, `http://127.0.0.1/*` | Ollama running on your own machine, if you enable it |
| `https://image.pollinations.ai/*`, `https://*.pollinations.ai/*`, `https://api.openverse.org/*` | declared and not called by any file in this repo. Drop them before publishing |

`AIzaSyAO_FJ2…` in `background/service-worker.js:1593` and `content/nsp-bundle.js:16085` is the public InnerTube WEB key that YouTube itself ships in every page it serves. It is not a credential and it is not ours.

## Limits

Run `node smoke.mjs` for the machine-checkable list. These are the ones a checker cannot see:

- **The policy engine has no button.** `nsp-policy.js` and `data/policies.json` are loaded and reachable at `policy:evaluate`, and no page in this build sends that message. The engine is real, the surface is missing.
- **`content/nsp-bundle.js` is one file of about 24,400 lines.** It works. It is not pleasant.
- **The YouTube Data API key has no opt-in and no home.** `content/nsp-bundle.js:7286` reads `nsp_yt_data_api_key` out of `localStorage` on youtube.com, where any script on the page can read it, Options has no field to set it, and the three call sites that use it spend quota with no gate. Leave it empty until that is rebuilt.
- **The popup's tier counters and its *Analyzed* number have different denominators.** `Analyzed` counts every card scored; `RISING+` and `VIRAL` are counted over the session's top 20, so they stop climbing at 20.
- **Five of the nine tool pages have no link.** `autopilot`, `brandforge`, `competitorfinder`, `help` and `nichemaster` under `ashlyv/tools/` only open if you type the address.
- **Strings are not all English yet.** `node smoke.mjs` names every file with Spanish or emoji left in a string the user reads. Spanish inside search queries, YouTube DOM matchers and language detection tables is data and stays; the smoke exempts those tables by name.
- **`lib/whisper/` ships for a transcription path that no screen reaches today.** It stays because the model files are already vendored, but nothing in the interface calls it yet.

## License

MIT. See `LICENSE`. Copyright (c) 2026 ZERACK.

Not affiliated with, endorsed by, or connected to YouTube or Google. "YouTube" is a trademark of Google LLC. Use it on your own account, at your own risk, within YouTube's Terms of Service.
