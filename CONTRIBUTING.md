# Contributing

## Load it

```
git clone <this repo>
cd cashcow-radar
```

`chrome://extensions`, **Developer mode** on, **Load unpacked**, pick this folder. Nothing to build, nothing to install, no dependencies. After an edit press the reload arrow on the extension card, then reload the YouTube tab: a content script does not re-inject on its own.

You do not need `scripts/fetch-assets.sh`. It fetches four large binaries into `lib/whisper/`, which nothing in the extension imports today.

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

`node --check` on each file you touched, every time. A syntax error in the bundle takes the whole overlay down with nothing in the console but silence.

`node smoke.mjs` is the gate. It exits 0 green and 1 red, takes no arguments and no dependencies, and reads files only. It checks, in this order: syntax of every first party script; that the manifest declares nothing missing and that every `web_accessible_resources` pattern matches something; that every `src` and `href` in every page resolves on disk; that no page carries inline script or an inline `on*` handler, both of which the CSP kills silently; that the five entry points of the scan engine are still defined; that no string the user reads is in Spanish or carries an emoji; that every message a screen sends has a handler; that every storage key the page world touches is on the bridge allowlist and that no page-world script pulls a key out of `localStorage`; that the model catalog is loaded before everything that reads it; that no file starts with an underscore, which makes Chrome refuse the whole extension; that no script builds a server address out of `location`; and that every host permission has a caller. It also warns about pages nothing links to.

The same smoke runs on every push and pull request through `.github/workflows/smoke.yml`.

`node niche-detector.test.js` replays the niche classifier over its fixtures and prints pass and fail counts.

Before you claim a change works, paste the command and its output. A claim without the output it came from is not a claim.

## Where things live

| Path | What it is |
|---|---|
| `manifest.json` | MV3. Three content script blocks, the CSP, the web accessible resources |
| `content/nsp-bundle.js` | the engine. MAIN world, about 24,400 lines. Scoring, badges, the scan, every in-page panel |
| `content/ashlyv-bridge.js` | ISOLATED world. The only way out of MAIN. Two allowlists: `NSP_RELAY_CALLS`, `NSP_RELAY_KEYS` |
| `content/nsp-studio.js` | ISOLATED world on studio.youtube.com. Title scoring against your own corpus |
| `background/service-worker.js` | every privileged call: messages, providers, InnerTube, cookies, tabs, alarms, the `policy:*` routes |
| `nsp-policy.js` | the demonetization engine. Pure functions, no DOM. Attaches to `globalThis` |
| `data/policies.json` | the rule table the engine reads. Editable data, not code |
| `knowledge/reverse-engine.js` | extracts the title formula out of a scan's own videos |
| `knowledge/youtube-playbook.js` | the primer injected into the assistant prompt |
| `lib/nsp-models.js` | the one model catalog. Read by options, the service worker and the overlay |
| `lib/nsp-text.js` | text helpers shared by the policy engine and Studio |
| `lib/nsp-faceless-data.js` | niche matchers and their RPM, and the faceless title patterns |
| `lib/face-api/` | face-api.js and the `tinyFaceDetector` weights, served through the bridge |
| `lib/mobilenet/` | TensorFlow.js and MobileNet, in the frame at `lib/mobilenet/mnet-frame.html` |
| `lib/whisper/` | local transcription, imported by nothing today |
| `popup/` | the popup: session counters, top videos, the doors to every other surface |
| `options/` | keys, the model picker, the paid-call opt-in, the RPM table, the badge switches |
| `dashboard/` | Command Center: saved channels, filters, *Measure growth*, exports |
| `ashlyv/` | the hub. `ashlyv.js` is the page, `ashlyv-engine.js` the niche tables, `ashlyv-api.js` the local client |
| `ashlyv/tools/` | nine tool pages over the shared `toolkit.js` and `tools.css` |
| `country-feed/` | the faceless feed for one market through InnerTube |
| `niche-index/` | the niche table your own scans filled in |
| `icons/` | the three PNGs, plus two one-shot dev tools that are not part of the extension |
| `smoke.mjs` | the gate |
| `niche-detector.test.js` | the niche classifier fixtures |

## Four rules that are not negotiable

**No comments.** Delete one rather than write one. The exception is a single line of plain English recording *why* something non-obvious is done: why `credentials: 'omit'` is there, why Studio needs `createElement` instead of `innerHTML`, why a threshold is that number. Never a line that restates the code underneath it.

**Every string the user reads is English.** Sentence case, no emoji, no em-dash. Say what happened and what to do about it: not `Error 3`, but `Groq answered 429. Add a Gemini key in Options or wait a minute.` Spanish inside a search query, a YouTube DOM matcher, a language detection table or a stored value is **data**: it stays exactly as it is. `smoke.mjs` exempts those tables by name in `DATA_TABLES`, and if you add one, add it to that list with the one-line reason next to it.

**A number on screen is a number that was measured.** If it cannot be measured, print nothing and say why. `-` with *Never measured*, or *not enough scores*, is a correct answer; a plausible substitute is not. An estimate is allowed and says so in the label, the way the revenue badge prints `est.`. Growth needs two readings; with one, `computeGrowth` returns no rate and the cell stays empty on purpose. Do not compute a rate from one reading, do not default a score to 50, and do not count two numbers over different denominators and show them side by side.

**Anything that spends money or quota needs an opt-in the user can see and switch off.** A stored key is not permission to spend it. The pattern here is a stored flag read immediately before the call, and a call that refuses when the flag is not exactly `true`: `nsp_vision_allowed` in `background/service-worker.js:1160`, `ashlyv_thumbnail_consent` in the in-page analyzer. A new paid path gets its own flag, its own checkbox in Options, and a refusal that names the flag. Never a fallback that quietly reaches a billed provider after a free one failed.

## Renaming

Do not rename an identifier, a CSS class, an element id, a storage key, a message type or a URL unless the rename is the fix. Then change every side in the same commit and say so in the message. A storage key that changes name orphans everything the user had saved; a message type that changes on one side only turns a button into a control that answers and does nothing, which is exactly what check 8 of the smoke looks for.
