# cashcow-radar-agent

ZERACK is a Chrome extension (Manifest V3) with two jobs. On YouTube it reads channels the way an owner needs them read: why a channel blew up, what your own channel should do next, what moved overnight, and what to make. On any other site you allow, its chat works as an operator for the business in front of you: a store, a marketplace listing, a product you are building, a freelance job board, a newsletter. It reads the page, decides with measured numbers, and waits for your own click before anything is paid, published, sent or deleted.

It runs in your browser. No server, no account, no telemetry. The numbers on every card come from public pages and the engines in `lib/`, never from a model. A model only writes (titles, hooks, scripts, replies, drafts), and only with a provider you set up.

## AI agents

ZERACK is eleven AI agents, one per kind of work, each built from a sourced playbook, its page readers and the same safety gate. The chat picks the agent from the site in your tab and names it in its header. Click that name, or *See all 11 AI agents* in an empty chat, to see the roster and pick another agent for that site; *Pick by site* gives the choice back. The answer names the agent that wrote it.

Every agent reads the page you opened, decides with measured numbers and drafts the work. Paying, publishing, sending, deleting and fulfilling wait for your own press in the chat. On GitHub, Hugging Face, Hacker News, Product Hunt, TikTok and Instagram, stars, follows, votes and likes are never cast for you, and no MCP server is ever installed for you. Passwords, keys and payouts stay out of the chat's reach whichever agent you pick, because the gate and the readers go by the page, not by the agent.

- **YouTube agent** (youtube.com, YouTube Studio): reads public channels and your own; decides why a channel grew, your next video, titles, thumbnails and what a niche pays; drafts sourced scripts and the Studio package. Saving in Studio is your press.
- **Shopify agent** (admin.shopify.com, myshopify.com stores): reads the admin, the orders and any store's public catalog; finds where buyers drop, the orders still to fulfill and what an order leaves after fees. Fulfilling and paying are your press.
- **Etsy agent** (etsy.com): reads search, shops and listings; decides price and title with the numbers and what a sale leaves after fees and Offsite Ads. Publishing and renewing are your press.
- **Amazon agent** (Amazon stores, Seller Central, KDP): reads search, product pages and your reports; judges how hard a market is and what a sale or a book leaves; drafts listings and KDP keywords. Publishing and ad budgets are your press.
- **Creators agent** (TikTok, Instagram): reads the profiles and videos you open; finds the outliers against each profile's median; drafts hooks and captions. Posting is your press.
- **Freelance agent** (Upwork, Fiverr): reads the jobs and gigs you open; judges which jobs are worth a bid and prices for your take-home; drafts proposals. Sending is your press, inside the daily cap.
- **Local business agent** (Google Maps, Business Profile): reads results and places; compares a business with its neighbors; drafts review replies and honest pitches with an AI disclosure and an opt-out. Sending is your press, inside the daily cap.
- **SEO agent** (Search Console, WordPress admin): reads the Performance table and the posts list; picks the pages to refresh and the titles seen but not clicked; rewrites them with you. Saving is your press.
- **Newsletter agent** (Substack, beehiiv): reads archives and post stats; finds the topics that land, tests subject lines and prices a paid tier. Sending and publishing are your press.
- **Digital products agent** (Gumroad, Lemon Squeezy, Payhip): reads product pages and dashboards; works out what a sale leaves on each platform and tests prices with real sales. Publishing is your press.
- **Builders agent** (GitHub, Hugging Face, the MCP registries, Hacker News, Product Hunt, npm, PyPI, Stripe read only, your app on localhost): for SaaS founders and for people who build AI agents, MCP servers and models. Reads repositories and issues, Hugging Face models, Spaces, datasets and their discussions (likes, downloads last month, last update, whether a Space runs), the official MCP Registry and the GitHub MCP Registry (every server with its version or its stars), and names MCP servers and agent frameworks among repositories. Decides which request repeats across issues, Hub discussions and threads, which rival repositories, models, Spaces and MCP servers accelerate over their own baseline, and whether there is anything true to post today; drafts the post of the day, the changelog and the Product Hunt and Show HN kit. Posts, comments, commits, merges and releases are your press, Hacker News text is yours by hand, and publishing to the MCP Registry runs in your own terminal.

There is no separate SaaS agent: SaaS, apps and extensions are the Builders agent's work, with Stripe read only. The roster is `lib/nsp-agents.js`; each agent's name, line and sites live in its playbook under `knowledge/playbooks/`, and your pick for a site is kept on this computer.

## On YouTube: 20 features in the chat

Each one is reached by typing in the chat (English or Spanish), by voice, from the chips of the empty chat, or by the model through a read-only tool it gets even with the Agent switch off. Most cards carry *Save PNG*, *Copy image* and *Share on X*, which opens X with the text; you attach the image and post it yourself.

**Any channel** (`lib/nsp-intel.js`)

1. **X-ray, why did this blow up.** Reads the last 30 public uploads: the video where views jumped and by how much, the channel median and best video, which title traits winners share against losers, whether AI can rebuild the format, the title template, and whether the niche window is still open (from up to 7 channels of the same niche, read one at a time). A channel with no break says *no clear turning point*.
2. **Duel.** Two channels on 7 measured axes (upload rhythm, floor, median, ceiling, steadiness, best lift, age), who wins each and why, and how their titles differ.
3. **Formula.** Title template from the real titles, winning traits, length, upload rhythm, format and the style of the 10 most viewed thumbnails.
4. **Verdict.** One lucky hit or real growth, how much of the views ride on one video, and whether the channel stopped uploading.

**Your channel** (`lib/nsp-mine.js`), read from an open YouTube Studio tab or saved once from *my channel is @handle*, kept on this computer

5. **My Wrapped.** Best video and its multiple over your median, your title skeleton, your publishing hour from exact upload times, and your real niche with its reference RPM.
6. **My next video.** Your outliers crossed with the rising signals stored in this browser, one topic with its evidence, and a title and hook written by your provider.
7. **Judge a title.** The calibrated judge's percentile, where it ranks among your last 30 titles, the niche's real winners, and a rewrite that keeps your skeleton.
8. **Judge my thumbnail.** From Studio, a link or a dropped file, shown at phone size next to the niche's winners, with what to change. It is not a click prediction.
9. **Thumbnail ideas.** Three concepts in your measured style with exact prompts; drawn only when you press *Draw them*, with a Gemini or OpenAI key you already saved.
10. **Check before upload.** The policy engine and the advertiser-friendly word screen over title, description and script. The text never leaves the browser.
11. **What it pays.** 4, 8 and 12 videos a month at the RPM table, break-even when you give a cost, and the risks, stamped as an estimate.

**Watch and predict** (`lib/nsp-watch.js`)

12. **Outlier alerts.** Watched channels are read every hour; one notification per new upload that reaches 5x the median of the channel's uploads older than a week. The click opens its X-ray.
13. **Morning brief.** Off by default. At your hour: new uploads, outliers and silent channels among the ones you watch, and your saved niches rising or cooling. It never calls a model.
14. **Sealed predictions.** Off until you turn on daily sealing on the card. Then once a day, young channels from your scans that look set to double in 14 days, next to random controls, stored with a SHA-256 chained to the previous batch. After 14 days they are read again and a one-sided Fisher test compares picks with controls, with no verdict under 20 settled calls a side.
15. **Language gaps.** Niches that win in English and are missing or weak in Spanish, German or Portuguese, with the counts behind each call; *Measure* runs the Country radar when data is short.
16. **Comments to ideas.** The top 100 public comments, the ones that ask for something sorted by likes, and three ideas from your provider.

**Create and hands-free** (`lib/nsp-sourced.js`, `lib/nsp-shorts.js`, `lib/nsp-create.js`)

17. **Sourced script.** Written only from numbered passages of the top videos' captions and pages you allowed; every line without a real source, or with a number its passage lacks, is cut and listed. With fewer than two sources it refuses and calls no model.
18. **Shorts miner.** 3 to 5 clips from the public captions and the most replayed graph, with the hook line, why each was picked and a link at that second.
19. **Studio package.** Title, description with chapters and tags, stored only after *Approve*, filled into the video open in Studio from the chat, by voice or from the ZERACK bar there, and saved only on a real press on that bar. The first fill ties the package to that video and a confirmed save spends it, so it is never offered on another video. Visibility, audience and monetization are never touched.
20. **Hands-free.** Every card above by voice, plus *next*, *save this channel* and *how much does this channel earn*, each answered aloud.

## Off YouTube: the business agent

**Two yeses before it acts.** The Agent switch, and the site itself: the chat shows **Allow on** the site, which asks Chrome for that one site inside your click; the menu takes it back. It works in the tab's isolated world, one step per call (read, click, type, paste, select, scroll, plans of up to 30 steps across page loads), so the page can neither see its hands nor replace its safety gate. Off YouTube its prompt and tools carry no YouTube words unless you ask about YouTube.

**Your click, not its.** Paying, publishing, sending, deleting and fulfilling an order stop at a row in the chat that waits up to two minutes for your real click on **Pay**, **Publish**, **Send**, **Delete** or **Fulfill**. A script click does nothing, a page that covers the chat cannot get that click, and Stop cancels it. Moving money out, passwords and codes, card, bank and tax fields, API keys, closing the account, stars, follows, votes and sponsorships are refused even with a press, including when a page's own text asks for them. Stripe is read only. Every write goes to a local ledger with the field before and after and who pressed.

**Playbooks for ten kinds of business** (`knowledge/playbooks/`), each with lessons that cite the platform's own pages and page readers (`lib/nsp-extract.js`) that answer *drift* when a page changed, never a zero:
- **Etsy**: search, shop and listing pages, fees and Offsite Ads.
- **Shopify**: the admin, store pages, and rival stores through their public `/products.json`.
- **Search Console and WordPress**: the Performance table and the posts list.
- **Builders**: GitHub, Hacker News, Product Hunt, Reddit, npm, PyPI, the Chrome Web Store, Stripe and Plausible tiles, G2 reviews, Hugging Face models, Spaces, datasets and discussions, the official MCP Registry and the GitHub MCP Registry, and your app on localhost. Its lessons for agent builders cite the Hugging Face Hub docs, the Model Context Protocol docs and GitHub Docs.
- **Creators** on TikTok and Instagram, **freelancers** on Upwork and Fiverr, **local businesses** on Google Maps and the agencies that sell to them, **Amazon** sellers and KDP authors, **newsletters** on Substack and beehiiv, and **digital products** on Gumroad, Lemon Squeezy and Payhip.

**Decisions with numbers** (`lib/nsp-decide.js`). Every answer is KEEP, LOOK AT IT or DROP with its number and what is still missing: which title, ad, listing or price wins (A/B), whether a number accelerates, whether it is still rising, whether a rate clears a bar. Each decision books a re-measure; the lesson is kept only if a later reading of the page agrees, never on numbers typed in the chat, and kept lessons reach the model on the next question for that site as quoted data. Buying, ordering, renewing or upgrading waits for the Pay press; putting money into ads, boosts or budgets is offered only after an A/B test read from that page came back KEEP for what is boosted.

**The builders operator** (`lib/nsp-builders.js`). Requests that repeat across issues, Hugging Face discussions and threads, people asking for what you build, rivals that accelerate (a daily cookie-less read of public pages you allowed: repositories, packages, store listings, Hugging Face models, Spaces and datasets, and the GitHub MCP Registry, judged server by server), what to post today or *skip today*, the changelog in Keep a Changelog format with the next SemVer version, and the Product Hunt and Show HN kit. Hacker News text is written by hand, so ZERACK gives an outline and the facts, never finished text.

**Leads** (`lib/nsp-leads.js`). Places or jobs judged Pitch or Bid, Look at it or Skip, with the fact behind each. Every draft carries one specific fact, an AI disclosure and an opt-out line, and emails the ad line and postal address US anti-spam law asks for. It sends only on your press, inside a daily cap that starts at 5 and rises to 30 (never above 50), 8:00 to 21:00, stops after 3 bounces, and never writes twice to the same place or to anyone who opted out: any Send on a lead's own site, with or without its lead id, goes through those rules. On TikTok, Instagram, Upwork, Fiverr, Maps and Amazon, whose terms limit automation, it reads only the page you opened, 12 seconds apart, and never in the daily watch.

**Activity page** (`activity/`, *Activity, decisions and lessons* in the chat menu): every action with who pressed and how to undo it, every decision with its history, kept and deleted lessons, *Measure now* and *Forget*. By voice: *read this page*, *find clients here* and *how many can I send today*; any other spoken question on a business page goes to that playbook's agent, which can read but not click, type or send.

## Install

```
git clone <this repo>
cd cashcow-radar-agent
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder. Nothing to build. `scripts/fetch-assets.sh` downloads the local Whisper model the voice falls back to when Chrome's own speech recognition cannot run; you only need it if those files are missing.

## Models and where keys go

Open **Options** (the Settings button in the popup). The OpenAI key and the voice keys go in **Setup**.

| Field | Storage key | What it is for |
|---|---|---|
| Groq API key (`gsk_…`) | `nsp_groq_api_key` | free tier, second in the cascade after OpenAI |
| Gemini API key (`AIza…`) | `nsp_gemini_api_key` | Google, text, thumbnail vision and thumbnail drawing |
| Enable Ollama, URL, model | `nsp_ollama_enabled`, `nsp_ollama_url`, `nsp_ollama_model` | a model on your own machine, no limits, offline |
| Assistant model | `nsp_selected_model` | the picker |
| Let a scan send thumbnails to the vision model | `nsp_vision_allowed` | off by default |

The picker is one catalog, `lib/nsp-models.js`. On a rate limit or a failure the service worker falls through to the next provider you configured, in the order OpenAI, Groq, Ollama, Gemini. Keys live in `chrome.storage.local` and leave the browser only to reach their provider. Without any key the scan, the metrics overlay, every measured card, the policy engine and the page readers still work; only the writing needs a provider. A stored key is not permission to spend it: vision has its own switch in Options, drawing needs a press, and on youtube.com a paid call also needs a grant (below).

## The other surfaces

- **On youtube.com** (`content/nsp-bundle.js`): a badge on every video card (views per hour, multiplier over the channel average, tier, opportunity, revenue labelled `est.`), **SCAN** for faceless videos with traction and a niche read, a market selector, tracking, an ad-placement probe, a thumbnail check, a transcript reader, a Title Lab and a comment reader.
- **On studio.youtube.com** (`content/nsp-studio.js`): title scoring against your own titles, and the ZERACK bar that fills an approved package and saves it only on a real press, from a closed shadow root the page cannot reach. It builds DOM with `createElement` only, because Studio enforces Trusted Types.
- **The bubble** (`content/zerack-bubble.js`): the round ZERACK button on YouTube, Studio, and other sites once you switch *Bubble on every site* on. Click opens the chat over the page, hold talks, drag moves. It reads nothing on the page. **Alt+X** opens the chat; on `chrome://` pages it opens in the side panel.
- **Voice** (`offscreen/voice.js`, routed in the service worker): hold the bubble or the chat's mic, or turn on Hands-free. Browser commands run as soon as they are heard; anything else in Hands-free needs *oye*, *hey* or *Zerack*, and while a tab plays sound every command needs the name. Speech to text is Chrome's recognizer, with local Whisper as a slow fallback; the last 100 phrases stay in session storage until Chrome closes.
- **Popup**, **Command Center** (`dashboard/`), **ZERACK hub** (`ashlyv/`), **Country radar** (`country-feed/`) and **Niche Index** (`niche-index/`): the doors, saved channels with *Measure growth* (no rate from a single reading), saved niches, the faceless feed per market through InnerTube, and the niche table your scans filled in.

Conversations live in IndexedDB (`zerack_chat`) on this computer, never synced, with the ledger, decisions and lessons next to them; *Delete all conversations* removes those too. Each turn sends only the last twelve messages of the open conversation to the provider named under the answer.

## Architecture in one paragraph

The heavy content script runs in YouTube's **MAIN** world because it needs YouTube's internal data, and there it has no `chrome.*`; `content/ashlyv-bridge.js` in the **ISOLATED** world is its only way out. Studio, face detection and the bubble run in isolated worlds. The service worker holds every privileged call: network, cookies, tabs, alarms, notifications, the chat's turns, the page agent (`background/nsp-page-agent.js`, which injects `lib/nsp-gate.js` and `lib/nsp-hands.js` into the isolated world of an allowed site) and the engines loaded with `importScripts`. Extension pages run under `script-src 'self' 'wasm-unsafe-eval'`, so there is no inline script anywhere, and `node smoke.mjs` fails if one appears.

## Who can ask the service worker for what

- **The door.** `NSP_MESSAGE_CALLERS` names, for each of the 77 message types, who may send it: an extension page, the bridge on youtube.com, the Studio script, or the bubble. Anything else is answered `sender_not_allowed` before a handler runs. The chat's card buttons and page-agent messages are extension-only and pass the chat's trust check.
- **Tabs are never the page's.** Listing, switching and closing tabs, reading other sites and acting on them are for extension pages only (the chat, with its Agent switch and the site's consent).
- **Spending needs a grant.** A YouTube tab can spend your AI keys only inside a grant opened by the worker, or on a real press (`isTrusted`) on a control the bridge created itself. A grant belongs to one tab and runs out by count and time.
- **The prompt is the worker's.** A page sends a task name and data; the system prompt, the tools and the model are chosen in the worker.
- **HTML into youtube.com goes through one sanitizer** (`nspSetHTML`), and no `default` Trusted Types policy is registered.
- **Storage.** The page world writes only the keys on `NSP_RELAY_KEYS`, rebuilt against their shape by the worker.

## Permissions, and why

| Permission | Reason |
|---|---|
| `storage` | keys, saved niches, watched channels, snapshots, site consents, the prediction ledger |
| `scripting` | reading the live session out of a YouTube tab, putting the bubble back after an update, and injecting the page agent's gate and hands into a site you allowed |
| `activeTab` | the bubble on the tab you are on when you open the popup or press Alt+X after an update |
| `declarativeNetRequestWithHostAccess` | one rule that removes the `Origin` header from this extension's own InnerTube requests, which YouTube answers `403` otherwise |
| `tabs` | opening pages, knowing the active tab, and the page agent's tab |
| `sidePanel` | the chat where no content script can run |
| optional `http://*/*`, `https://*/*` | the bubble on other sites, a page you allowed as a script source, and the business agent on a site you allowed. Never asked at install: Chrome asks inside your click, one site at a time. Chrome's grant alone reads nothing: a site is read only while ZERACK's own consent for it stands, and *Stop ZERACK on this site* ends it |
| `alarms` | the rescan, the hourly outlier check, the morning brief, the daily prediction seal, decision re-measures and the builders' daily watch |
| `cookies` | writing YouTube's `PREF` cookie, the only way to switch market |
| `notifications` | scans, outlier alerts, the morning brief and settled predictions |
| `clipboardWrite` | the copy buttons |
| `downloads` | the niche and prediction exports |
| `https://www.youtube.com/*`, `https://*.youtube.com/*`, `https://studio.youtube.com/*` | the overlay, InnerTube and Studio |
| `https://www.googleapis.com/*` | the YouTube Data API, off until it has a key (see Limits) |
| `https://generativelanguage.googleapis.com/*`, `https://api.groq.com/*` | Gemini and Groq, when you pasted their keys |
| `https://translate.googleapis.com/*` | translating a foreign title before scoring it |
| `https://i.ytimg.com/*`, `https://img.youtube.com/*` | thumbnail pixels for the face, contrast and phone-size checks |
| `http://localhost:11434/*`, `http://127.0.0.1:11434/*` | Ollama on your own machine, if you enable it |
| `http://127.0.0.1:7788/*` | the local voice server, if you run it |

`AIzaSyAO_FJ2…` in `background/service-worker.js` and `content/nsp-bundle.js` is the public InnerTube WEB key YouTube ships in every page. It is not a credential and it is not ours.

## Limits

Run `node smoke.mjs` for the machine-checkable list. These are the ones a checker cannot see:

- **Many page readers were never run on a live page.** The Shopify admin, Search Console, Stripe, WordPress, KDP, Seller Central, Upwork, Google Maps, Reddit, npm, PyPI, Product Hunt and the TikTok and Instagram grids were read from archived or synthetic pages, because they need a sign-in or block automated reads. If the real layout differs, they answer *drift*, not a number.
- **The Hugging Face and MCP registry readers were checked on pages read signed out on 2026-09-27** and are tested on synthetic copies of their shape; a signed-in Hub page or a new layout answers *drift*. Smithery, Glama, mcp.so and PulseMCP belong to the Builders agent but have no reader, so they are read as plain page text. Hub downloads count every request to a model's config file, CI runs included, so the agent reads them next to likes.
- **Nobody has clicked through Chrome's real site-permission dialog yet.** The Allow button opens it inside the click; the tests ran on a copy that already had access.
- **Fees are US only**, and Fiverr's commission is not stated because it could not be checked on Fiverr's own pages.
- **Only an A/B result read from the page counts as evidence for ad spend**, and only for what it measured. Today only the Search Console reader keeps per-row impressions and clicks, so a Boost on a store's own ad table is not offered from the chat and stays the user's to press. Purchases, Join and Super Thanks wait for a press with no test.
- **One daily cap for all leads**, and bounces and replies are marked by hand. Rival trends need 4 daily readings.
- **Voice drives the business agent only to read.** Clicking, typing and sending on other sites happen from the chat.
- **The YouTube panel's own agent still runs in the page's world**, so a page could tamper with it; the business agent on other sites cannot be reached that way.
- **The X-ray's niche window is only as good as its search**: the niche's own query when the titles vote for one niche, otherwise the topic words the best titles repeat. Channels whose titles share nothing with the subject are left out, so it often comes back unmeasured. Upload rhythm comes from exact times or from the dates YouTube shows, and is left unmeasured when those are too coarse. Video openings and section rhythm are not measured, because public pages do not show them.
- **Language gaps move near their thresholds**: with 130 to 240 titles a language, a borderline gap can appear or vanish between runs.
- **Image drawing and Studio fill were tested against a mock and a stub.** Real Gemini and OpenAI image calls, and the real signed-in Studio, were not exercised.
- **Shorts cut at pauses** when captions carry no punctuation, so a clip can start mid-phrase; the card says so. Earnings are only as good as the RPM table.
- **The policy check is a keyword screen**, not YouTube's classifier; it never looks at footage, music, the thumbnail or the audio.
- **`content/nsp-bundle.js` is one file of about 24,000 lines**, and the YouTube Data API path in it is off (`YT_API_KEY` is empty).
- **Five of the nine tool pages under `ashlyv/tools/` have no link**, and local Whisper is slow on a busy machine.

## License

MIT. See `LICENSE`. Copyright (c) 2026 ZERACK.

Not affiliated with, endorsed by, or connected to YouTube, Google, Etsy, Shopify, GitHub, Amazon or any other platform named here. Their names are trademarks of their owners. Use it on your own accounts, at your own risk, within each platform's terms.
