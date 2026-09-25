# cashcow-radar-agent

ZERACK is a Chrome extension (Manifest V3) that reads YouTube the way a channel owner needs it read: what is actually moving, whether the format is one you can reproduce without a camera, and whether the script you are about to publish will get the channel demonetized.

It runs in your browser. No server, no account, no telemetry. Every AI panel is optional and uses a key you paste yourself.

## What is here that is not anywhere else

**A demonetization policy engine.** `nsp-policy.js` is a rules engine over `data/policies.json`: it normalizes a script (diacritics folded, `ß` to `ss`, everything non-alphanumeric collapsed), matches the rule table in word or substring mode with an uppercase guard so `ss` does not fire inside *besser*, and maps every hit back to its index in the original text so you can see the exact phrase. It also keeps a per-channel corpus of top-400 token frequencies (never the raw script) and scores a new script against it, so a near-duplicate of your own back catalogue comes back yellow with the inauthentic-content reason instead of green. The service worker loads it and answers `policy:rules` and `policy:evaluate`, and the listener refuses any sender that is not this extension. **No surface calls it yet** (see Limits): today it is an engine with a message API and no button.

**A reverse engine for titles, built from your own scan.** `knowledge/reverse-engine.js` takes the videos a scan just measured, finds the outliers against that set's own median, and reports which title formats over-index inside the outliers versus the rest, which words live in them, how they open in the first two words, which channels own the niche, and a fill-in template drawn from the format that actually took off. It feeds the scan context of the YouTube panel's prompt. Nothing here is generic blog advice: every number comes from the videos on your screen.

**Faceless detection that looks at the thumbnail.** face-api.js `tinyFaceDetector` runs locally on each thumbnail, with the weights served from `lib/face-api/` through the bridge, and rejects a card when a face covers more than the area threshold. That is a measurement of the image, not a guess from the title.

**Growth measured from two readings or not shown at all.** The Command Center's *Measure growth* reads each saved channel's subscriber and view totals and stores a timestamped snapshot under `zerack_channel_snapshots_v1`. With fewer than two snapshots, or two less than half a day apart, `computeGrowth` returns no rate and the cell prints `-` with the title *Never measured*. There is no modelled growth anywhere.

**Discovery that costs no quota.** The country radar and the channel readers go through `https://www.youtube.com/youtubei/v1/`, the same private API the page itself calls, with the public WEB key YouTube ships in every page it serves and `credentials: 'omit'` so nothing is personalized to your account. No YouTube Data API units are spent to find anything.

## Install

```
git clone <this repo>
cd cashcow-radar-agent
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder. That is all: the scanner, the scan, the policy engine, the country radar and every panel work from a plain checkout.

`scripts/fetch-assets.sh` downloads four large binaries into `lib/whisper/`, each checked against the SHA-256 of the build this code shipped with. **You do not need to run it** unless those files are missing from your checkout: they are the local Whisper model the voice falls back to when Chrome's own speech recognition is not available.

## Models and where keys go

Open **Options**: the Settings button in the popup, or `chrome://extensions`, Details, Extension options. It opens in its own tab.

| Field | Storage key | What it is for |
|---|---|---|
| Groq API key (`gsk_…`) | `nsp_groq_api_key` | free tier, second in the cascade after OpenAI |
| Gemini API key (`AIza…`) | `nsp_gemini_api_key` | Google, text and thumbnail vision |
| Enable Ollama, URL, model | `nsp_ollama_enabled`, `nsp_ollama_url`, `nsp_ollama_model` | a model on your own machine, no limits, offline |
| Assistant model | `nsp_selected_model` | the picker |
| Let a scan send thumbnails to the vision model | `nsp_vision_allowed` | off by default |

The **Assistant model** picker is the one catalog, `lib/nsp-models.js`, read by the options page, the chat's model pill, the service worker and the overlay. Picking an entry sets the preferred provider, it does not lock you to it: on a rate limit or a failure the service worker falls through to the next provider you have configured, in the order OpenAI, Groq, Ollama, Gemini (the OpenAI key is pasted in Setup). Picking *Auto* takes that order as it stands.

Keys live in `chrome.storage.local` and leave the browser only to reach the provider whose key you pasted. Without any key the metrics overlay, the scan, the tracking panel, the country radar, the niche index and the policy engine all still work; the AI panels say they have no provider.

**A stored key is not permission to spend it.** Sending a thumbnail to the vision model is a separate checkbox in Options, only Options can write it, and the service worker refuses the call with `vision_not_allowed` when the flag is not exactly `true`. On youtube.com a second rule applies, see *Who can ask the service worker for what*.

## What each surface does

**On youtube.com** (`content/nsp-bundle.js`, the engine)
- A badge on every video card: views per hour, the multiplier against that channel's own average, a tier, an opportunity score, and a revenue estimate labelled `est.` because it is one. Each of the five can be switched off in Options.
- **SCAN** sweeps the feed you are on (home, search, a channel, trending), keeps the faceless videos with traction, and puts a niche read on top.
- A country selector that switches the feed's market and rescans it.
- A tracking panel for channels under watch, an ad-placement probe that reports monetized, likely, not monetized or cannot check, a thumbnail check that measures faces, contrast and brightness in the browser, a transcript reader, a Title Lab that asks the model to rank your title variants against the outliers you saved, and a comment reader that asks the model about the comments YouTube has loaded on the page.

**On studio.youtube.com** (`content/nsp-studio.js`) reads your own Studio page, recognizes which page it is, and scores title candidates against the titles that already worked, in the language the corpus is written in. Studio enforces Trusted Types, so this script builds DOM with `createElement` and `textContent` only.

**The bubble and the chat** (`content/zerack-bubble.js`, `chat/`) the ZERACK logo in a small round button in the bottom-right corner of every http and https page. Click it and the chat opens over the page; click it again, press Esc or use the close button to close it. A click only opens the chat: what ZERACK is saying keeps playing, Hands-free keeps listening, and nothing heard is kept or acted on. Press and hold it to talk: the ring turns red while it listens, and letting go sends the phrase, even if the pointer has left the bubble; drag it far away or press Esc to cancel. Drag it without holding to move it, and it stays where you put it, with one place on YouTube and one everywhere else. At its own spot it steps aside for ZERACK's panels on YouTube, the miniplayer and buttons that sit under it. The ring also shows the voice: a thin red ring while Hands-free is on, a white arc while thinking, a white pulse while speaking, a dashed amber ring when background speech makes Hands-free unreliable, and a short grey flash when a phrase was ignored. It hides in fullscreen, on every site with the popup switch *Bubble on every site*, or on one site from the chat's menu; switched off or hidden, it is not on the page at all. It reads nothing on the page: it only draws itself.

The chat is a private assistant with the same brain as the YouTube panel and the voice. A short typed instruction that is plainly a browser command (eight words or fewer, such as *abre youtube* or *busca gatos*) runs straight away with no model call; one that mentions your own data (my, saved, niche, scan, title, idea) or points at the last answer goes to the model. Anything else goes to the model you pick in the pill under the box, with the tools that read your saved niches, your tabs, channel stats and uploads, a YouTube page and the course. With the **Agent** pill on, it can also act: open pages and sites, search YouTube, go back, reload, switch tabs, save a niche, track a channel, export your niches, and hand work that needs the YouTube page itself (a scan, reading the screen) to the agent in a YouTube tab; with it off those tools are not even offered to the model and the service worker refuses them. The answer is worked out in the service worker, so it still lands in the conversation when the page under the chat navigates, and the chat opens again on the new page. The mic button works like the bubble (hold to talk, or tap to start and tap again to send), with a Hands-free switch next to it. **Alt+X** opens or closes the chat on the page you are on; where no content script can run, such as `chrome://` pages, it opens in Chrome's side panel instead. The *Voice* conversation lists what the voice heard, what it did and why it ignored a phrase.

The chat page runs in the extension's own origin, so the website under it cannot read it or script it. Over a page, the Agent and Hands-free switches and the delete items only work once the chat has been fully in view for a moment, so a page that hides or covers the chat cannot steer a click onto them. A page cannot open it either: the bubble asks the service worker for a one-time token, and the chat shows nothing until the service worker has checked that token against the tab it was issued for.

Where the history lives: conversations are in IndexedDB (`zerack_chat`) in the extension's storage on this computer, never synced, with a delete button on each conversation and *Delete all conversations* in the menu. Each turn sends only the last twelve messages of the open conversation to the provider the answer names under it. The voice history is the last 100 phrases in Chrome's session storage, gone when Chrome closes.

**Popup** (`popup/`) the CHAT door first, then the Command Center and the Niche Index, the Agent switch, the *Bubble on every site* switch, session counters, the session's top videos, a CSV export, and the doors to the country radar and Options.

**Command Center** (`dashboard/`) every saved channel with filters by source, niche and age, seven sort orders, a card and a table view, *Measure growth*, and export to CSV, JSON or the clipboard. Each summary tile prints *not measured* rather than a number when there is nothing measured behind it.

**ZERACK hub** (`ashlyv/`) saved niches and their monetization radar, the channel intelligence engine, the thumbnail analyzer and the idea panels, plus nine tool pages under `ashlyv/tools/` (ThumbLab and VoxBatch are the two the hub links today; see Limits).

**Country radar** (`country-feed/`) pick a market, get the faceless feed for that language through InnerTube, export it.

**Niche Index** (`niche-index/`) the niche table your own scans have filled in, with its RPM, and a CSV export.

**Voice** (`offscreen/voice.js`, routed in `background/service-worker.js`) hold the bubble, or the chat's mic, and talk: the phrase is addressed to ZERACK, so it needs no wake word and works with a video playing. Alt+Z talks once: press it, speak, then press it again or pause to send. Hands-free, switched from the dot in the popup, the chat, or by saying *escúchame siempre* and *deja de escuchar*, keeps the microphone open in an offscreen document and turns every phrase into text. A browser command (open YouTube or one of about forty other sites, search YouTube for a topic, scan, open result two, save it, go back, reload, next tab) runs as soon as it is heard, in Spanish or English, with no wake word, and a visible action answers with a short tone instead of a sentence. Anything else is ignored in Hands-free unless it starts with *oye*, *hey* or the name *Zerack*. A phrase meant for ZERACK that is not a command is answered by the same brain as the chat, from the service worker, with the tools it can run there; it hands work to the agent in a YouTube tab only when the question needs that page. While any tab is playing sound, Hands-free commands need the name too, so a video cannot give orders; holding the bubble always works. Every ignored phrase gets a soft low tone and a grey flash on the bubble, and shows in the chat's *Voice* conversation with the reason. The answer is spoken in the browser voice for free, or in the ZERACK voice on Fish Audio or OpenAI's voice when you add those keys in Setup.

Where the audio goes: speech to text is Chrome's speech recognition, the same service behind voice typing in Chrome, handed the extension's own microphone track. When Chrome cannot run it, the local Whisper model in `lib/whisper/` does the job on your machine instead, slower. The switch is off until you turn it on. The last 100 phrases it heard, with what it did or why it ignored each one, are kept in Chrome's session storage on your computer and are gone when Chrome closes.

**Service worker** (`background/service-worker.js`) the one place with privileges: the message hub, the provider cascade with its rate limiters, the InnerTube calls, the channel and transcript readers, the cookie write that switches market, the alarms, and the `policy:*` routes.

## Architecture in one paragraph

Four content scripts. The heavy one runs in the **MAIN** world, the page's own context, because it needs YouTube's internal data, and there it has no `chrome.*` at all: no storage, no messaging, no `runtime.getURL`. A small script in the **ISOLATED** world, `content/ashlyv-bridge.js`, is its only way out. The third runs only on Studio. The fourth, `content/zerack-bubble.js`, runs in the ISOLATED world of the top frame of every http and https page and does nothing but draw the bubble in a closed shadow root and frame the chat when you open it. The service worker holds every privileged call: network, cookies, tabs, notifications, alarms, and the policy engine loaded with `importScripts`. Extension pages run under `script-src 'self' 'wasm-unsafe-eval'`, so there is no inline script and no inline handler anywhere, and `node smoke.mjs` fails if one appears.

## Who can ask the service worker for what

Any script on youtube.com can post to the page, not only this extension's, so the bridge treats every page message as a request from the page and the service worker checks every message again at its own door.

- **The door.** `NSP_MESSAGE_CALLERS` in `background/service-worker.js` names, for each of the 64 message types, who may send it: an extension page (`chrome-extension://` of this extension), the bridge on youtube.com, the Studio script, or the bubble. Anything else is answered `sender_not_allowed` before a handler runs.
- **Tabs are never the page's.** Listing, switching and closing tabs, navigating the active tab and reading other sites are for extension pages only (the chat, with its Agent switch). The YouTube panel can open a youtube.com or studio.youtube.com tab, and the worker checks the host and the Agent switch itself.
- **Spending needs a grant.** A YouTube tab can spend your AI keys only inside a grant. The worker opens one when it hands the tab a turn from the chat or the voice; the bridge asks for one only when it sees a real press (`isTrusted`, which no page script can fake) on a control it created itself and keeps in a map no page script can reach, while that control is shown and under the pointer. An attribute or an id counts for nothing. A grant belongs to one tab, runs out by count and by time (45 model calls for the agent, 12 thumbnails for the vision check, one call for a panel), and asking again restarts it, it never adds up.
- **The prompt is the worker's.** The page sends a task name and data (`NSP_AI_TASK`: `coach`, `titles`, `comments`, `replicate`, `brand`). The system prompt, the tool list and the model are chosen in the worker, so a page can shape what the model reads but never turn your key into a free endpoint. The hub calls the same tasks.
- **HTML into youtube.com goes through one sanitizer.** YouTube enforces Trusted Types. `nspSetHTML` parses markup inert, keeps only an allow list of tags and attributes (no scripts, frames, SVG or `<style>`, no event handlers, no `javascript:` links, no `url()` in styles), and moves clean nodes in. No `default` policy is registered, so YouTube's own protection stays on.
- **Storage.** The page world writes only the keys on `NSP_RELAY_KEYS`, and not directly: the worker rebuilds each value against that key's shape (`NSP_PAGE_STORE`) and refuses what does not fit. The switches, the consents, the chosen model, the saved niches and the dashboard's hand-off are read only from there; the model changes on a real press of the model menu (`NSP_MODEL_SELECT`), and saved niches go through `ASHLYV_SAVE_NICHO`.
- **Notifications.** The page names what happened (`niche_rising`, `niche_new`) and the numbers; the title and text are the worker's, with a limit of three per tab per quarter hour.

## Permissions, and why

| Permission | Reason |
|---|---|
| `storage` | your keys, saved niches, tracked channels, growth snapshots, the niche index |
| `scripting` | the popup reads the live session out of the open YouTube tab's MAIN world, and the bubble is put back into open tabs after an install or update |
| `activeTab` | putting the bubble back into the tab you are on when you open the popup or press Alt+X there after an update |
| `declarativeNetRequestWithHostAccess` | one session rule that removes the `Origin` header from this extension's own InnerTube requests: YouTube answers `403` to `chrome-extension://`, and a service worker cannot drop that header itself. It never touches the page's requests |
| `tabs` | opening the hub, the Command Center and a market search, and knowing which tab is active |
| `sidePanel` | the chat in Chrome's side panel, where no content script can run (Alt+X on a `chrome://` page, or CHAT in the popup there) |
| content script on `http://*/*`, `https://*/*` | the bubble. It draws itself and reads nothing on the page; Chrome still lists it as access to every site |
| `alarms` | the periodic rescan and trend check |
| `cookies` | writing YouTube's `PREF` cookie, the only way to switch market |
| `notifications` | the scan and alert notifications |
| `clipboardWrite` | the copy buttons that go through `document.execCommand('copy')` |
| `downloads` | the chat's niche export; the other CSV and JSON exports use a blob and `<a download>` |
| `https://www.youtube.com/*`, `https://*.youtube.com/*` | where the overlay runs, and the InnerTube endpoint |
| `https://studio.youtube.com/*` | the Studio agent |
| `https://www.googleapis.com/*` | the YouTube Data API, a path that is off until it has a key (see Limits) |
| `https://generativelanguage.googleapis.com/*` | Gemini, when you have pasted a Gemini key |
| `https://api.groq.com/*` | Groq, when you have pasted a Groq key |
| `https://translate.googleapis.com/*` | translating a foreign-language title before scoring it |
| `https://i.ytimg.com/*`, `https://img.youtube.com/*` | reading thumbnail pixels for the face and contrast checks |
| `http://localhost/*`, `http://127.0.0.1/*` | Ollama running on your own machine, if you enable it |

`AIzaSyAO_FJ2…` in `background/service-worker.js` and `content/nsp-bundle.js` is the public InnerTube WEB key that YouTube itself ships in every page it serves. It is not a credential and it is not ours.

## Limits

Run `node smoke.mjs` for the machine-checkable list. These are the ones a checker cannot see:

- **The policy engine has no button.** `nsp-policy.js` and `data/policies.json` are loaded and reachable at `policy:evaluate`, and no page in this build sends that message. The engine is real, the surface is missing.
- **`content/nsp-bundle.js` is one file of about 24,000 lines.** It works. It is not pleasant.
- **The YouTube Data API path is off.** `YT_API_KEY` in `content/nsp-bundle.js` is empty and Options has no field for it, so the scan validates channels with its local filters and the comment reader reads the comments on the page. A key for it needs an Options field, an opt-in and a route through the service worker first.
- **The popup's tier counters and its *Analyzed* number have different denominators.** `Analyzed` counts every card scored; `RISING+` and `VIRAL` are counted over the session's top 20, so they stop climbing at 20.
- **Five of the nine tool pages have no link.** `autopilot`, `brandforge`, `competitorfinder`, `help` and `nichemaster` under `ashlyv/tools/` only open if you type the address.
- **Strings are not all English yet.** `node smoke.mjs` names every file with Spanish or emoji left in a string the user reads. Spanish inside search queries, YouTube DOM matchers and language detection tables is data and stays; the smoke exempts those tables by name.
- **Local Whisper is slow on a busy machine.** It is only the fallback for when Chrome's recognizer cannot run, and on a loaded laptop it takes seconds per phrase and loads for about twenty seconds the first time.

## License

MIT. See `LICENSE`. Copyright (c) 2026 ZERACK.

Not affiliated with, endorsed by, or connected to YouTube or Google. "YouTube" is a trademark of Google LLC. Use it on your own account, at your own risk, within YouTube's Terms of Service.
