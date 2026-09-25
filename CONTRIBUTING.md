# Contributing

## Load it

```
git clone <this repo>
cd cashcow-radar-agent
```

`chrome://extensions`, **Developer mode** on, **Load unpacked**, pick this folder. Nothing to build, nothing to install, no dependencies. After an edit press the reload arrow on the extension card, then reload the YouTube tab: a content script does not re-inject on its own.

You only need `scripts/fetch-assets.sh` for the local voice fallback. It fetches four large binaries into `lib/whisper/` (they are in `.gitignore`); `offscreen/voice.js` loads that model only when Chrome's own speech recognition cannot run, and without the binaries the fallback says it is unavailable.

Three consoles, and a change can be invisible in the wrong one:

| Where | How to open it |
|---|---|
| the overlay, MAIN and ISOLATED | DevTools on the youtube.com tab |
| the service worker | `chrome://extensions`, Details, **service worker** |
| an extension page | DevTools on that tab |

## Verify a change

Run all three from the repo root. Green means green; there is no partial pass.

```
node --check <every file you touched>
node smoke.mjs
node niche-detector.test.js
```

`tests/*.test.mjs` load the real service worker and bridge in a Node `vm` with a fake `chrome` and send them the messages Chrome would, with the sender Chrome would pass. The smoke runs them all (check 18), so a green smoke includes them.

`node --check` on each file you touched, every time. A syntax error in the bundle takes the whole overlay down with nothing in the console but silence.

`node smoke.mjs` is the gate. It exits 0 green and 1 red, takes no arguments and no dependencies, and reads files only. It checks, in this order: syntax of every first party script; that the manifest declares nothing missing and that every `web_accessible_resources` pattern matches something; that every `src` and `href` in every page resolves on disk; that no page carries inline script or an inline `on*` handler, both of which the CSP kills silently; that the five entry points of the scan engine are still defined; that no string the user reads is in Spanish or carries an emoji; that every message a screen sends has a handler; that every storage key the page world touches is on the bridge allowlist and that no page-world script pulls a key out of `localStorage`; that the model catalog is loaded before everything that reads it; that no file starts with an underscore, which makes Chrome refuse the whole extension; that no script builds a server address out of `location`; that every host permission has a caller; that nothing registers a `default` Trusted Types policy; that no regex literal has an empty alternative, which matches every string; that every message the service worker routes names who may send it, tab control is for extension pages only and spending from youtube.com needs a grant; and that the behaviour tests in `tests/` pass. It also warns about pages nothing links to.

A GitHub Actions workflow for the same smoke is ready in `ci/smoke.yml` and is not active yet; see *Continuous integration* below.

`node niche-detector.test.js` replays the niche classifier over its fixtures and prints pass and fail counts.

Before you claim a change works, paste the command and its output. A claim without the output it came from is not a claim.

## Where things live

| Path | What it is |
|---|---|
| `manifest.json` | MV3. Four content script blocks, the side panel, the CSP, the web accessible resources |
| `content/nsp-bundle.js` | the engine. MAIN world, about 24,000 lines. Scoring, badges, the scan, every in-page panel |
| `content/ashlyv-bridge.js` | ISOLATED world. The only way out of MAIN, and it speaks for any script on youtube.com: a fixed list of forwarded messages rebuilt field by field, the relay allowlists `NSP_RELAY_CALLS` and `NSP_RELAY_KEYS`, and the grant requests it sends only on a trusted press |
| `content/nsp-faces.js` | ISOLATED world on youtube.com. face-api.js and its weights; answers `NSP_FACE_DETECT` with face boxes for i.ytimg.com thumbnails |
| `content/nsp-studio.js` | ISOLATED world on studio.youtube.com. Title scoring against your own corpus |
| `content/zerack-bubble.js` | ISOLATED world, top frame of YouTube and Studio, and of every http and https page once the user grants that access from the popup. The bubble: click opens the chat overlay, hold talks, drag moves. Reads nothing on the page |
| `chat/` | the private chat. `chat.js` the page (the service worker runs each turn and writes it to the store, so an answer survives the page under the chat navigating), `chat-tools.js` the answer loop and tool labels the service worker runs, `chat-render.js` the safe markdown-lite renderer |
| `background/service-worker.js` | every privileged call: messages, providers, InnerTube, cookies, tabs, alarms, the `policy:*` routes |
| `nsp-policy.js` | the demonetization engine. Pure functions, no DOM. Attaches to `globalThis` |
| `data/policies.json` | the rule table the engine reads. Editable data, not code |
| `knowledge/reverse-engine.js` | extracts the title formula out of a scan's own videos |
| `knowledge/youtube-playbook.js` | the verified primer the assistant prompt carries when it fits; the course outranks it |
| `knowledge/course.js` | the course the assistant applies: 33 sourced lessons, `primer()` for the prompt and `lookup()` behind the `zerackCourse` tool. Frozen, and loaded in the page world, the service worker and extension pages |
| `lib/nsp-brain.js` | the one brain: the system prompt as parts per surface (youtube, chat, voice), `fit()` to each provider cap, the tool declarations and the tool result summary |
| `lib/nsp-models.js` | the one model catalog. Read by options, the chat, the service worker and the overlay |
| `lib/nsp-chat-store.js` | the chat history in IndexedDB `zerack_chat`: conversations and messages, shared by the chat pages and the service worker |
| `lib/nsp-data-tools.js` | the saved niches, extension data, tracking and export reads and writes, shared by the bridge and the service worker |
| `lib/nsp-text.js` | text helpers shared by the policy engine and Studio |
| `lib/nsp-faceless-data.js` | niche matchers and their RPM, and the faceless title patterns |
| `lib/face-api/` | face-api.js and the `tinyFaceDetector` weights, run in the isolated world by `content/nsp-faces.js` |
| `lib/whisper/` | local transcription, the voice's fallback when Chrome's recognizer cannot run; its binaries come from `scripts/fetch-assets.sh` |
| `popup/` | the popup: session counters, top videos, the doors to every other surface |
| `options/` | keys, the model picker, the paid-call opt-in, the RPM table, the badge switches |
| `dashboard/` | Command Center: saved channels, filters, *Measure growth*, exports |
| `ashlyv/` | the hub. `ashlyv.js` is the page, `ashlyv-engine.js` the niche tables, `ashlyv-api.js` the local client |
| `ashlyv/tools/` | nine tool pages over the shared `toolkit.js` and `tools.css` |
| `country-feed/` | the faceless feed for one market through InnerTube |
| `niche-index/` | the niche table your own scans filled in |
| `icons/` | the three PNGs, and the logo marks and the bubble as SVG |
| `smoke.mjs` | the gate |
| `tests/` | behaviour tests of the service worker door, the bridge, the YouTube readers and the hub client, run by the smoke |
| `niche-detector.test.js` | the niche classifier fixtures |

## Four rules that are not negotiable

**No comments.** Delete one rather than write one. The exception is a single line of plain English recording *why* something non-obvious is done: why `credentials: 'omit'` is there, why Studio needs `createElement` instead of `innerHTML`, why a threshold is that number. Never a line that restates the code underneath it.

**Every string the user reads is English.** Sentence case, no emoji, no em-dash. Say what happened and what to do about it: not `Error 3`, but `Groq answered 429. Add a Gemini key in Options or wait a minute.` Spanish inside a search query, a YouTube DOM matcher, a language detection table or a stored value is **data**: it stays exactly as it is. `smoke.mjs` exempts those tables by name in `DATA_TABLES`, and if you add one, add it to that list with the one-line reason next to it.

**A number on screen is a number that was measured.** If it cannot be measured, print nothing and say why. `-` with *Never measured*, or *not enough scores*, is a correct answer; a plausible substitute is not. An estimate is allowed and says so in the label, the way the revenue badge prints `est.`. Growth needs two readings; with one, `computeGrowth` returns no rate and the cell stays empty on purpose. Do not compute a rate from one reading, do not default a score to 50, and do not count two numbers over different denominators and show them side by side.

**Anything that spends money or quota needs an opt-in the user can see and switch off.** A stored key is not permission to spend it. The pattern here is a stored flag read immediately before the call, and a call that refuses when the flag is not exactly `true`, like `nsp_vision_allowed` in the service worker's vision judge; the page world may read such a flag and never write it. On youtube.com a paid call also needs a grant (see the README), so a new paid control there is made with `nspGrantControl(kind, tag)` and its kind is listed in both the bridge and `NSP_GRANT_KINDS`. A new paid path gets its own flag, its own checkbox in Options, and a refusal that names the flag. Never a fallback that quietly reaches a billed provider after a free one failed.

## Renaming

Do not rename an identifier, a CSS class, an element id, a storage key, a message type or a URL unless the rename is the fix. Then change every side in the same commit and say so in the message. A storage key that changes name orphans everything the user had saved; a message type that changes on one side only turns a button into a control that answers and does nothing, which is exactly what check 8 of the smoke looks for.

## Continuous integration

`ci/smoke.yml` is a GitHub Actions workflow that runs `node smoke.mjs` on every push and
pull request. It lives here rather than under `.github/workflows/` because the token used
for the first push did not carry the `workflow` scope. To enable it:

```bash
gh auth refresh -s workflow
mkdir -p .github/workflows && git mv ci/smoke.yml .github/workflows/smoke.yml
git commit -m "Enable the smoke workflow" && git push
```
