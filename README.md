# NicheScanner Pro

A Chrome extension (Manifest V3) that puts real numbers on top of YouTube: views per hour, viral multiplier, tier, revenue estimate — on every card of every feed you browse. It also scans a feed for faceless niches, tracks channels, predicts titles inside YouTube Studio, and ships a browser-side video editor.

Everything runs locally in your browser. There is no server behind this, no account, and no telemetry. The AI features are optional and use **your own** API key.

## Install

```
git clone <this repo>
cd niche-scanner-pro
./scripts/fetch-assets.sh
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder.

`fetch-assets.sh` downloads five binary files that are not stored in the repo (onnxruntime, the Whisper tiny model, and the ffmpeg core). Each one is checked against a SHA-256 of the exact build this code was released with; a mismatch aborts. They are only needed by the video editor's local transcription and its "pro quality" MP4 export — the scanner itself works without them.

## API keys (optional)

Open the extension's **Options** page and paste either or both:

- **Groq** (`gsk_…`) — free tier, used first for text.
- **Gemini** (`AIza…`) — used as fallback, and for image work.

Keys are stored in `chrome.storage.local` and never leave your browser except to call the provider you pasted a key for. Without a key, the metrics overlay, the SCAN engine, tracking and the country feed all still work — only the AI panels go quiet.

Two extra AI paths exist and are off unless you set them up yourself: a local Ollama at `127.0.0.1:11434`, and an optional local backend at `127.0.0.1:8000` (see *Known rough edges*).

## What it does

**On youtube.com** (`content/nsp-bundle.js`, 24.5k lines, the core)
- A metrics overlay on every video card: views per hour, multiplier against the channel's own average, tier, RPM-based revenue estimate.
- 🦇 **SCAN** — sweeps the current feed (home, search, trending) and returns the faceless videos worth looking at, sorted by VPH, with a niche read on top.
- 🌍 **Country selector** — switches the feed to another market (gl/hl) and re-scans it.
- **Tracking panel** — keeps channels under watch and tells you what moved.
- Face detection on thumbnails (face-api.js, tinyFaceDetector, local) to separate faceless content from on-camera content.

**On studio.youtube.com** (`content/nsp-studio.js`) — reads your own Studio pages and scores title candidates against what already worked.

**Internal pages**
- `ashlyv/` — the hub: saved niches, thumbnail analyzer, intelligence panels, and 7 tools (AutoPilot, ScriptPilot, VoxBatch, MotionForge, RivalRadar, NicheMaster, Help).
- `dashboard/` — saved channels, bulk operations, CSV/JSON export.
- `country-feed/` — faceless feed by country through InnerTube.
- `niche-index/`, `niches/` — the niche tables with their RPM.
- `monetize-studio/` — browser video editor: images → video, Ken Burns, automatic captions from the voice track (Whisper running locally), niche templates, WebCodecs export to MP4.

**Background** (`background/service-worker.js`) — message hub, AI cascade (Groq → Ollama → Gemini), rate limiters, InnerTube proxy, periodic alarms.

## Architecture in one paragraph

Three content scripts. The heavy one runs in the **MAIN** world (the page's own context) because it needs YouTube's internal data; it has no access to `chrome.*`. A second, tiny one runs **ISOLATED** and bridges the two with `postMessage` plus DOM attributes (`content/ashlyv-bridge.js`). The third runs only on Studio. The service worker holds every privileged call. Extension pages have a CSP of `script-src 'self' 'wasm-unsafe-eval'` — no inline scripts, no eval, wasm allowed.

`docs/SYSTEM.md` is a full technical map of the codebase (file by file, world by world). `ZERACK-FUNCIONES.md` documents every feature surface by surface. Both are in Spanish.

## Permissions, and why

| Permission | Reason |
|---|---|
| `storage` | your keys, saved niches, tracked channels |
| `scripting`, `tabs` | injecting and re-injecting the overlay |
| `alarms` | periodic re-scan and trend check |
| `cookies` | the YouTube `PREF` cookie, to switch market |
| `downloads` | exporting CSV/JSON and the rendered video |
| `notifications`, `clipboardWrite` | results and copy buttons |
| host: youtube.com, studio.youtube.com | where it runs |
| host: googleapis.com, api.groq.com, pollinations.ai, api.openverse.org | the AI/image endpoints, only when you use them |
| host: localhost, 127.0.0.1 | optional local Ollama / local backend |

The only key hardcoded in the source is `AIzaSyAO_FJ2…`, the **public InnerTube key** YouTube itself ships in every page it serves. It is not a credential.

## Known rough edges

Honest list, so nobody has to discover them:

- `ashlyv/ashlyv-api.js:10` hardcodes `http://127.0.0.1:8000` for a local backend that is not part of this repo. Those specific panels will fail without it; the rest of the hub does not care.
- `content/nsp-bundle.js` is one 24,500-line file. It works, and it is not pleasant.
- Most UI strings and both documentation files are in Spanish.
- `icons/generate-icons.html` and `icons/make-icons.js` are one-shot dev tools, not part of the extension.
- `niche-detector.test.js` is a plain Node script (`node niche-detector.test.js`), not a test-runner suite.

## License

MIT. See `LICENSE`.

Not affiliated with, endorsed by, or connected to YouTube or Google. "YouTube" is a trademark of Google LLC. Use it on your own account, at your own risk, within YouTube's Terms of Service.
