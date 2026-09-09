# SYSTEM.md — Mapa técnico completo · NicheScanner Pro (ZERACK)

**Versión auditada:** 4.34.0 · **Fecha:** 2026-06-10 · **Modo:** discovery READ-ONLY (ningún archivo existente fue modificado)
**Cómo leer:** las referencias `archivo:línea` son del estado v4.34.0 y son **≈ aproximadas** — este codebase mueve líneas con cada versión (cada fix inserta bloques). Buscar siempre por **nombre de función**, no por número.
**Convención de mundos:** `MAIN` = página youtube.com (sin chrome.*, con Trusted Types), `ISOLATED` = content script con chrome.runtime, `EXT` = páginas chrome-extension:// (chrome.* completo, innerHTML permitido), `SW` = service worker.

---

## STEP 1 — INVENTARIO GLOBAL

### 1.1 Archivos vivos (cargados por manifest o por un HTML vivo)

| Archivo | Tamaño / líneas | Rol |
|---|---|---|
| `manifest.json` | 2.6K / 104 | MV3: SW + 3 content scripts + popup + options + WAR |
| `content/nsp-bundle.js` | **1.33MB / 24,070** | NÚCLEO. Scanner completo en MAIN world: overlay métricas, SCAN faceless, monetización, competidores, paneles, predictor viralidad, coach ZERACK in-page |
| `ashlyv/ashlyv-engine.js` | 107K / 2,132 | Librería MAIN world: 45+ idiomas, 115+ nichos con RPM, filtros "god", scoring de oportunidades. Exporta `window.ASHLYVEngine` |
| `lib/face-api/face-api.min.js` (+ modelos tiny + ssd shards) | 664K + ~5.8MB | Detección de caras en thumbnails (MAIN world) |
| `content/ashlyv-bridge.js` | 30K / 549 | Puente ISOLATED: postMessage↔chrome.runtime, corpus de títulos, sesiones coach, atributos DOM para MAIN |
| `content/nsp-studio.js` | 115K / 1,397 | Agente ZERACK en studio.youtube.com (ISOLATED): lee páginas Studio, análisis profundo, chat |
| `background/service-worker.js` | 75K / 1,645 | Hub de mensajes (35+ tipos), cascada IA Groq→Ollama→Gemini, rate limiters, InnerTube proxy, alarms (auto-scan 2h, trend-check 6h), cookies PREF |
| `monetize-studio/app.js` + `index.html` + `app.css` | 374K / 4,743 | Editor de video completo (EXT page): render canvas, keyframes, Ken Burns, builder imágenes→MP4, export WebCodecs |
| `monetize-studio/vendor/mp4-muxer.min.js` | 32K | Muxer MP4 (la vía principal de export) |
| `monetize-studio/vendor/ffmpeg*.js + ffmpeg-core.wasm` | **32MB** | Cargado en index.html:205-206; usado en UNA sola ruta (`loadFFmpeg()` app.js≈3155, invocado ≈3170 para conversión "calidad pro" con fallback WebM). El export turbo NO lo usa |
| `lib/mobilenet/` (tf.min.js 1.5MB + modelo 15MB) | ~16.7MB | Clasificación local de imágenes del builder (gratis, sin key) |
| `ashlyv/ashlyv.html/.js/.css` | 315K js / 6,625 | Dashboard ASHLYV (EXT): nichos guardados, coach, herramientas |
| `ashlyv/ashlyv-api.js` | 14K / 347 | Cliente IA local-first: Ollama (127.0.0.1:11434) → Anthropic; **backend hardcodeado http://127.0.0.1:8000** para scan-channel/market-radar/etc |
| `ashlyv/tools/*` (toolkit + 7 tools) | ~50K | ScriptForge, VoxForge, ThumbnailForge, RivalRadar, NicheMaster, Autopilot, Help — helpers IA compartidos en `toolkit.js` (TK.ai: Groq→Gemini) |
| `dashboard/` | 83K | Dashboard de canales guardados (bulk ops, export CSV/JSON) |
| `country-feed/` | 70K | Feed faceless por país vía InnerTube (SW proxy, caché 15 min) |
| `popup/`, `options/`, `niches/` | ~95K | Popup (stats sesión + lanzadores), Options (keys IA + tiers), página nichos |
| `icons/` | — | Iconos 16/48/128 |

### 1.2 Archivos MUERTOS / huérfanos (confirmado: nada los carga)

| Archivo | Evidencia |
|---|---|
| `content/content.js`, `content/filters.js`, `content/injector.js`, `content/overlay.js`, `content/scorer.js`, `content/ytdata.js` | No aparecen en manifest.json ni en ningún `<script>` de ningún HTML. Restos de la arquitectura pre-bundle |
| `content/styles.css` | No referenciado por manifest (los estilos van inline en JS) |
| `content/nsp-bundle.js.bak-*` (×4) + `.before-restore` | ~6.2MB de backups históricos dentro del árbol |
| `options/options.html.bak`, `ashlyv/tools/competitorfinder.js.bak-*` | backups sueltos |
| `niche-detector.test.js` (raíz) | test de Node suelto (se ejecuta manual, no es parte de la extensión) |
| `icons/generate-icons.html`, `icons/make-icons.js` | herramientas one-shot de generación de iconos |
| `ZERACK-Guia-Socios*.pdf`, `ZERACK-FUNCIONES.md` | documentación, no código |

> ⚠️ Para empaquetar/publicar: los `.bak` (~6.3MB) + ffmpeg (32MB si no se usa esa ruta) + ssd shards (5.6MB si solo se usa tiny) son los candidatos obvios a excluir.

### 1.3 manifest.json a fondo (L1-104)

- **permissions:** storage, scripting, clipboardWrite, tabs, alarms, notifications, cookies, downloads.
- **host_permissions:** youtube.com + *.youtube.com + studio.youtube.com, translate.googleapis.com, www.googleapis.com, generativelanguage.googleapis.com, api.groq.com, i.ytimg.com, img.youtube.com, pollinations.ai, api.openverse.org, localhost/127.0.0.1.
- **content_scripts:**
  1. `youtube.com` **MAIN** world, document_idle: `face-api.min.js` → `ashlyv-engine.js` → `nsp-bundle.js` (el orden importa: bundle consume `faceapi` y `window.ASHLYVEngine`).
  2. `youtube.com` **ISOLATED**: `ashlyv-bridge.js` (corre en paralelo; planta atributos DOM que MAIN lee).
  3. `studio.youtube.com` **ISOLATED**: `nsp-studio.js`.
- **action:** popup/popup.html · **options_ui:** options/options.html (tab).
- **CSP extension_pages:** `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; object-src 'self'` → sin eval (por eso TF.js a veces protesta), wasm OK (ffmpeg/face-api).
- **web_accessible_resources:** popup/*, ashlyv/* (+tools), country-feed/*, monetize-studio/*, lib/face-api/*, lib/mobilenet/* para `<all_urls>`.

---

## STEP 2 — MAPA DE ARQUITECTURA

### 2.1 Contextos y canales

```
                    ┌──────────────────────────────────────────┐
                    │  SW (service-worker.js)                  │
                    │  hub onMessage 35+ tipos · IA cascade ·  │
                    │  InnerTube proxy (credentials:omit) ·    │
                    │  alarms · cookies PREF · storage hub     │
                    └───────▲──────────────▲───────────▲───────┘
            chrome.runtime  │              │           │ chrome.runtime
                            │              │           │
        ┌───────────────────┴───┐   ┌──────┴─────┐  ┌──┴──────────────────────┐
        │ ISOLATED youtube.com  │   │ EXT pages  │  │ ISOLATED studio.youtube │
        │ ashlyv-bridge.js      │   │ popup/opt/ │  │ nsp-studio.js (agente)  │
        └─────────▲─────────────┘   │ dashboards │  └─────────────────────────┘
   window.post-   │  + atributos    │ editor ... │
   Message con    │  DOM (faceapi   └────────────┘
   requestId      │  url, ext id)
        ┌─────────┴─────────────┐
        │ MAIN youtube.com      │
        │ nsp-bundle.js +       │
        │ ashlyv-engine + faceapi│
        └───────────────────────┘
```

- **MAIN ↔ ISOLATED (el canal crítico):** `window.postMessage` con **correlación por `requestId`** (`req-<uuid>`); MAIN guarda callbacks pendientes (`_nspCoachPendingResponses[reqId]`), el bridge responde con `NSP_COACH_RESPONSE` / `NSP_COACH_STORAGE_RESULT`. Timeouts típicos 8-12s por tool.
- **Truco del atributo DOM** (`ashlyv-bridge.js:7-11`): el bridge (ISOLATED) escribe `data-nsp-faceapi-url` y `data-nsp-ext-id` en `<html>`; MAIN (sin chrome.runtime) los lee para construir URLs chrome-extension:// (carga de modelos face-api).
- **chrome.storage como bus:** `nsp_pending_action` (dashboard→bundle: lanzar ThumbLab/TitleLab/Competidores en un canal, expira 5 min), `ashlyv_pending_scan` (dashboard→bridge→MAIN dispara `ASHLYV_TRIGGER_SCAN`), `zerack_handoff_script` (tools→editor vía localStorage del origen EXT).

### 2.2 Catálogo de mensajes del SW (onMessage, ≈L657-1200)

Grupos (lista completa con emisor/receptor en el reporte de mensajería):
- **Datos canal/nicho:** `NSP_FETCH_YT_CHANNELS` (YT Data API batch 50), `NSP_SAVE_CHANNEL`, `ASHLYV_SAVE_NICHO`, `ASHLYV_GLOBAL_STATE_GET/SET/PATCH`, `ASHLYV_OPPORTUNITY_HISTORY_PUSH`, `ASHLYV_ALERT_PUSH/DISMISS/READ`.
- **Scan:** `NSP_SCAN_CONTEXT_GET / NSP_SCAN_MARK_SEEN / NSP_SCAN_MEMORY_CLEAR` (dedupe entre sesiones), `NSP_FETCH_COUNTRY_FACELESS_FEED` (InnerTube + caché 15 min `nsp_country_feed_${gl}_${hl}`).
- **Prefs/locale:** `NSP_UI_PREFS_GET/SET`, `NSP_SET_YT_COOKIE` (cookie PREF gl/hl).
- **IA:** `ASHLYV_CHAT_REQUEST` (cascada Groq→Ollama→Gemini con rate limiters sliding-window L3-57), `ASHLYV_ANTHROPIC_REQUEST` (visión thumbnails vía api.anthropic.com), `ASHLYV_OLLAMA_*`.
- **Agente (tools del coach):** `NSP_AGENT_OPEN_TAB / NAVIGATE / LIST_TABS / SWITCH_TAB / CLOSE_TAB / FETCH_URL / SEARCH_MARKET / CHANNEL_STATS / CHANNEL_VIDEOS`.
- **Infra:** `ASHLYV_PING`, `ASHLYV_OPEN`, `NSP_OPEN_TAB`.

### 2.3 Protocolo del bridge (ashlyv-bridge.js, L63-549)

MAIN→bridge tipos: `ASHLYV_OPEN_URL` (guardar nichos + abrir dashboard; valida `ashlyvInternal === chrome.runtime.id`), `NSP_COACH_SEND` (chat→SW), `NSP_COACH_TOOL_*` (13 tools→SW), `NSP_COACH_STORAGE_GET/SET` + `NSP_COACH_SESSIONS_GET/SET` + `NSP_COACH_KEY_CHECK` + `NSP_COACH_PROVIDER_CHECK` + `NSP_COACH_(GET|SET)_PREFERRED_PROVIDER` (storage del coach), `NSP_CORPUS_INGEST/QUERY/STATS` (corpus títulos).

### 2.4 Entry points de cada superficie

| Superficie | Se abre desde | Init |
|---|---|---|
| Overlay scanner (youtube.com) | inyección manifest | banner versión L8; listeners `yt-navigate-finish` (limpieza ≈18478 + reapertura stats panel), mutation/scroll; botones Batman SCAN / Globe / pills |
| Popup | icono toolbar | `popup.js` DOMContentLoaded → storage canales + `chrome.scripting.executeScript({world:'MAIN'})` para leer localStorage de la pestaña YT |
| Options | menú extensión | carga `nsp_settings` (sync) + handlers guardar/PROBAR keys (Gemini con cadena de 9 modelos) |
| Dashboard ASHLYV | botón popup / `ASHLYV_OPEN` | `ashlyv.js` → `ASHLYV_GLOBAL_STATE_GET` + sesiones coach |
| Dashboard canales | popup | `dashboard.js` → storage + bulk ops |
| Country Feed | popup / dropdown mercado en YT | `NSP_FETCH_COUNTRY_FACELESS_FEED` |
| Monetize Studio | popup / TK.toEditor(handoff) | `app.js` → `freshProject()`, sin mensajería externa; lee `zerack_handoff_script` |
| Studio Agent | inyección en studio.youtube.com | `pageType()` (≈L24-45) + chat persistido `nsp_studio_conv` |

---

## STEP 3 — CAPA DE DATOS

### 3.1 chrome.storage.local (claves principales — schema, escritor→lector)

| Clave | Schema | Escribe | Lee | Límite/TTL |
|---|---|---|---|---|
| `nsp_all_channels` | [{channelUrl, channelId, name, avatarUrl, subs, revMonth, avgOS, topVPH, topTier, niche, savedAt, source, blocked}] | SW:≈720 | dashboard, popup, bundle | 500 entradas |
| `ashlyv_nichos` (+`_backup`) | [{title, niche, nicheId, language, channelUrl, vidId, thumbUrl, subs, views, vph, rpm, os, facelessScore, facelessClassification, savedAt, source}] | bridge:≈77-95, SW:≈738 | dashboards | 240 entradas / ~102KB |
| **`nsp_title_corpus`** | **[{t: título ≤160ch, n: nicho, v: VPH, w: views, th: thumb ≤300ch, c: canal ≤60ch, ts}]** — dedupe por `t.toLowerCase().slice(0,80)`, conserva mayor VPH | bridge:≈194 (`NSP_CORPUS_INGEST`) | bridge `NSP_CORPUS_QUERY/STATS` → predictor | cap 3000 |
| `nsp_scan_memory` | {seenTitles/videos/channels/niches, blocked} | SW:≈904 | bundle (dedupe scans) | manual clear |
| `nsp_watching` | {channelUrl: {knownVideoIds[], lastChecked,…}} | SW trend-check:≈483, dashboard | alarm 6h | sin límite |
| `nsp_ui_prefs` | {language, market, depth} | SW:≈777 | bundle | — |
| `nsp_gemini_api_key` / `nsp_groq_api_key` / `nsp_groq_model` / `nsp_gemini_working_model` / `nsp_ollama_{enabled,url,model}` / `nsp_preferred_provider` | strings/bool — **texto plano** | options.js / bridge | SW, toolkit.js, studio | — |
| `nsp_coach_history` (legacy) / `nsp_coach_sessions` | mensajes {role, content} / sesiones {id, title, messages[], lastActivity} | bridge | bundle (coach) | 50 msgs / sin límite |
| `nsp_studio_conv` | {messages[], ts} | nsp-studio | nsp-studio | — |
| `nsp_ms_presets` / `nsp_ms_styles` | presets export / estilos Style Lab | app.js | app.js | — |
| `ashlyv_global_state` / `ashlyv_alert_history` (50) / `ashlyv_alerts_unread` / `ashlyv_opportunity_history` (80) / `ashlyv_niche_stats` / `ashlyv_rpm_baselines` / `ashlyv_recent_scan_runs_v1` / `ashlyv_channel_scan_history_v1` / `ashlyv_thumbnail_*` | estado dashboard/alertas/históricos | SW + dashboards | dashboards + coach tool EXT_DATA | caps indicados |
| `nsp_country_feed_${gl}_${hl}` | {videos[], ts} | SW | SW | TTL 15 min |
| `nsp_pending_action` / `ashlyv_pending_scan` | triggers cross-superficie | dashboard / ashlyv | bundle / bridge | expiran (5 min / corto) |
| `nsp_channel_cache_v2` | {channelId: {data, lastFetch}} | bundle | bundle | 7 días |
| **`nsp_script_corpus`** (Policy F1/F2) | {channelKey: [{t ≤120, ts, **ng** (régimen tokenizado), vec: top-400 tf}]} — NUNCA el guion crudo | motor `addScriptToCorpus` (hook post-export del editor) | motor `getCorpus`/`scriptSimilarity` (guard: ng≠actual se descarta con warn) | 25/canal FIFO · **same-title**: ≥98% sim→solo ts; <98%→REPLACE in-place |
| **`nsp_policy_overrides`** (Policy F2) | [{ts, channelKey, risk:'yellow'\|'engine_error', reasons, similarityScore, note?, videoName, exportCfg}] | editor: override amarillo confirmado / fail-open engine_error. **El rojo JAMÁS escribe (no hay ruta)** | auditoría (UI futura) | cap 200 FIFO |
| **`nsp_policy_last_eval`** (Policy F2) | {channelKey\|'_global': {risk, score, similarity, ts}} | editor en CADA evaluación completada | futuro 2b (enriquecer advertiserRisk vía SW) | sobrescritura por canal |
| **`nsp_policy_calib_log`** (Policy F2) | [{ts, channelKey, rawScore, corpusSize, risk}] | editor en cada evaluación (+console.log) | recalibración del umbral 55 con datos reales | cap 10 FIFO |

### 3.2 chrome.storage.sync
- `nsp_settings` — umbrales de tiers (LEGENDARY/EPIC/GOLD/SILVER/BRONZE), escrito/leído por options.js.

### 3.3 localStorage (⚠ DOS orígenes distintos)
- **Origen youtube.com (MAIN):** `nsp_session` (stats de sesión que lee el popup vía executeScript), `nsp_watchlist`, `nsp_yt_data_api_key` (key YT Data API — **texto plano en el origen de YouTube**), `nsp_profit_costs` (calculadora), `nsp_groq_api_key` (coach in-page), flags de auto-scan por país, `nsp_tracking_pos`.
- **Origen chrome-extension:// (editor/tools):** `zerack_handoff_script`, `nsp_tl_collapsed`, `nsp_ms_exportcfg` {res, rate, codec, fmt, fps}, **`nsp_ms_policy_channel`** {channelKey, lang} (canal/idioma elegidos en el panel 🛡️ POLICY CHECK, persisten entre sesiones).

### 3.4 sessionStorage (youtube.com)
- `nsp_reopen_stats` — persistencia panel VER STATS: {ch{name,channelUrl,channelId,channelKey,subs,avatarUrl,videoCount,channelAgeDays}, subGrowth, revMonth, rangeKey, ts}; lo limpian 5 rutas de cierre; expira 45 min; reabre `nspMaybeReopenStatsPanel()` (≈18452, hooks: carga +2.6s y navegación +1.6s).
- `nsp_faceless_payload` — payload de scan en vuelo.

### 3.5 Otros
- **chrome.alarms:** `nsp-auto-scan` (120 min → runAutoScan, ≈SW:610), `nsp-trend-check` (360 min → runTrendCheck, ≈SW:455 → notificaciones + `ASHLYV_ALERT_PUSH`).
- **chrome.cookies:** PREF de youtube.com (gl/hl) vía `NSP_SET_YT_COOKIE` (SW ≈787-850).
- **IndexedDB / Cache API / OPFS:** **NO se usan** (verificado por grep).
- **Caches en memoria:** `_monetCache` (TTL 1h, solo cachea verdicts monetized/demonetized), `_channelAgeCache`, rate-limiters `_nspGeminiCallTimes`/`_nspGroqCallTimes` (ventana 60s), `window._ashlyv_last_top_results` (pool del último scan que consume el predictor).

---

## STEP 4 — DEEP-DIVES POR MÓDULO

### 4a. Scanner + clasificación de canales (nsp-bundle.js + ashlyv-engine.js)

**Pipeline faceless (Batman SCAN):**
1. **Chokepoint global** `nspIsMetaContentReject()` — mata meta-YouTube (algorithm/how I make/eleven labs/tts/course…) antes de todo.
2. `AshlyVFaceless.analyzeItem(item)` (engine) → `_facelessScore` + `_facelessAnalysis{classification}`; clases duras rechazadas: face-cam, vlog, gameplay-streamer, podcast, interview, reaction, livestream, hard_reject.
3. **Pases progresivos** (force-to-10): `isAshlyVGoodFacelessResultCandidate` (score≥50 + title≥4, ≈6094) → `isAshlyVSafeFacelessFillCandidate` (≥38, topics documentary/facts/top-N/iceberg/history/mystery, ≈6126) → emergency/absolute/forceFromPool/guaranteed (≈8680-8700) — el junk filter (`nspIsUserReportedJunk`) se aplica SIEMPRE, incluso tras los fallbacks (chokepoint final antes del render ≈8706-8725).
4. **face-api post-filter** `nspApplyFaceApiFilter` (≈622-660): tinyFaceDetector inputSize 320, umbrales `NSP_FACE_CONFIDENCE_THRESHOLD`≈0.5 y `NSP_FACE_AREA_THRESHOLD`≈12% del frame; whitelist cartoon (`nspIsCartoonFacelessItem`); resultado en `item._nspFaceApi{hasFace,faceArea,confidence,faceCount,supported,unknown}`. Carga de modelo: `nspLoadFaceApiModel()` con promise única + URL del atributo DOM; imágenes vía `img.crossOrigin='anonymous'` (i.ytimg sirve CORS *), timeout 8s; batch `nspBatchDetectFaces(items, concurrency=4)`.

**Monetización — árbol de decisión EXACTO (`verifyChannelMonetizationReal`, ≈15885):**
```
0) GUARD pre-todo (v4.29): subs>0 && subs<1000 && sin Join/Shop
   → 'demonetized' score 4, reasons ['below_ypp_threshold'] (ni caché ni probe)
1) caché _monetCache (TTL 1h; solo guarda monetized/demonetized)
2) señales DOM detectChannelDomMonetSignals(): joinButton (ytd-sponsor-button-renderer
   + aria-labels), shopTab (regex shop|store|tienda|merch en tabs), verified
3) probe de ads probeVideoForAds(videoId) sobre ≤8 vids recientes
   (getRecentChannelVideoIds: _allScored → fallback DOM):
   POST youtubei/v1/player con TVHTML5_SIMPLY_EMBEDDED_PLAYER (useEmbed) y
   fallback WEB credentials:'omit'; key = YT_WEB_INNERTUBE_KEY (clave PÚBLICA del
   cliente web de YouTube, no secreto). "hasAds" = adPlacements|adSlots|playerAds|
   adBreakHeartbeatParams|daiConfig; playabilityStatus 'OK' = resultado fiable.
4) VEREDICTO (prioridad, v4.30):
   P1 join||shop                  → 'monetized' 95   (✅ MONETIZADO · verde)
   P2 probeCount≥4 && adsFound=0  → 'demonetized' 8  (❌ NO MONETIZADO · "SIN ADS en N")
   P3 adsFound>0 (sin join/shop)  → 'ads_unconfirmed' 50 (🟡 CAN'T CHECK · "sirve ads
        pero sin prueba directa de YPP (¿Content-ID?)") — NUNCA se cachea
   P4 probeCount≥1                → 'unknown' 35 (⚠️ CAN'T CHECK)
   P5 sin probes                  → 'unknown' 30 (⚠️ CAN'T CHECK / probe_unavailable)
```
Comentario clave en código (≈15936): *"adPlacements también aparecen por reclamos Content-ID de TERCEROS… así que ads≠monetización del creador"*.

**Scoring (`calcScore(views, hoursOld, isShort, title, durationSecs)` ≈3001):** VPH=views/h; RPM por nicho (tabla regex ES+EN, 22 finanzas → 3 default; ×geo: EN 1.0, DE .95, FR .78, ES .48, PT .45; ×1.2 si ≥8min no-music); tiers VIRAL≥5000 VPH / HOT≥500 / RISING≥50 / ACTIVE≥5 / SLOW; revenue proyectado (95% vistas /1000 × RPM con proyección 30d o cola larga); OS = log(vph)·70 + freshBonus (≤100).
**Nicho:** `NICHE_RPM` (~31 entradas {re, rpm, label}) + `detectNicheLabel` + **detector rico** `richNicheQuery`/`NSP_NICHE_SEEDS` (v4.27: títulos+nombre+descripción+hashtags vs 6 semillas temáticas ES/EN) + cadena `getChannelNicheQuery` (rich → label → nombre limpio → keywords → watch fallback, con ensanche para idiomas no ES/EN).
**NEW & EXPLODING (`isNewAndExploding` ≈14047):** 4 paths por edad/subs/VPH con guard anti-falso-positivo (avgViews<3000 && subsPerMonth<1000 && subs<1000 → false).
**Competidores (`findSimilarChannels` ≈17527):** 4 fuentes paralelas (búsqueda por nicho en videos `sp=CAMSAhAB`, por canales `sp=EgQQAhoB`, featured, watch-next) → merge por channelId con hits → pre-filtro tracción → enrich `fetchChannelQuickStats` (5 en paralelo; monetized: join/shop→yes, ≥10K subs→likely, ≥1K+10vids→likely) → quality gate → relevancia de nicho (`candidateMatchesNiche`, stems) → idioma/script → `rankCompetitorsByFaceless` (≤3 thumbnails por candidato, face-api; **v4.32: `_faceless===false` SE ELIMINA SIEMPRE**, null pasa) → top 20 + metadatos `_nicheQuery/_totalFound/_totalKept`.
**Panel VER STATS (`buildChannelStatsPanel` ≈14928):** chips de rango m0/m1/q/all **capados a la edad del canal** (`ch.channelAgeDays` extraído de joinedDate del /about, caché `_channelAgeCache`), filtrado por `s.hoursOld`, persistencia sessionStorage (ver 3.4), Net Profit Calculator (DOM puro tras fix Trusted Types v4.30.2), verificador de monetización inline.

### 4b. Predictor de viralidad (título) — y qué es reusable para guiones

**NO existe TF-IDF real.** El "vectorizado" es heurístico: regex + conteos sobre conjuntos de keywords.
- **Núcleo:** `zerackPredictViralityLocal(title, nicheHint, marketPool)` (≈21138-21227) → `{viralScore 0-100, verdict, niche, nicheRpm, moneyPotentialIndex, breakdown{titulo≤45, nicho≤30, mercado≤15, saturacion≤10}}`. Señales de título: números/listas +8, ranking +6, curiosity (why/how/secret) +9, intensidad emocional +8, power words +5, misterio +7, longitud 35-70ch +6 (corto −4 / largo −3).
- **Calibración:** NO hay percentiles del corpus — 4 bandas fijas (≥75 POTENCIAL VIRAL / 58-74 SÓLIDO / 40-57 NECESITA TRABAJO / <40 BAJO). "Mercado" = matches+avgVPH del pool (`window._ashlyv_last_top_results` o corpus); "saturación" invertida por nº de competidores con stem compartido.
- **Corpus:** `nsp_title_corpus` (schema en 3.1) alimentado por `nspCorpusCollectFromScan` (≈21237, todos los títulos del scan) + `nspIngestMarketVideos` (≈21287, VPH proxy views/720) + búsqueda activa InnerTube `nspFetchMarketData` (≈21274 → tool SEARCH_MARKET, v3.17). `zerackRunPrediction` (≈21345) consulta 20 winners del nicho (si <8 dispara búsqueda activa) y `zerackCompareToWinners` (≈21318) genera gaps (uso de números %, curiosity %, longitud media).
- **Acoplamiento título-específico vs reusable:**

| Pieza | ¿Reusable para guiones/otro texto? |
|---|---|
| Longitud 35-70ch, power words, curiosity hooks | NO — convenciones de título YouTube |
| `zerackDetectNiche`/NICHE_RPM regex | PARCIAL — los regex funcionan sobre cualquier texto, el RPM map es directamente reusable |
| Fórmula RPM→score `min(30, rpm/22*30)` | SÍ — métrica de valor genérica |
| Heat/saturación sobre pool VPH | SÍ — estadística de mercado independiente del texto |
| Corpus (schema t/v/n) + compareToWinners | NO sin nueva schema — todo asume metadatos de VIDEO (título, thumb, canal) |
| `zKeyMoments` del editor (años/fechas/dinero/números) | SÍ — ya opera sobre texto libre (es la pieza más "guión-ready" del repo) |

- **Capa ZERACK:** Biblia 11 secciones `nspZerackKnowledge()` (≈20945, ~2KB) + system prompt (≈21033) + 17-19 tools function-calling (scan/nichos, navegación/tabs, DOM, fetch, predict, ext data) ejecutados vía bridge→SW. Proveedores: cascada SW Groq→Ollama→Gemini (con `nsp_gemini_working_model` como caché de modelo y cadena de fallback 2.0-flash→2.5-flash→1.5-flash→flash-latest); `toolkit.js` TK.ai replica Groq→Gemini para las tools EXT.
- **Studio Analyst (nsp-studio.js):** pageType() por URL, lectores DOM (readPage/readVideosList ×30/readComments ×40), 5 tools studio*, informe "Deep Analysis", conversación persistida.

### 4c. Monetize Studio (editor) — monetize-studio/app.js

- **Estado:** `ST` (≈34: name/dur/vw/vh/ready/playing/rendering/activeTool) y `P=freshProject()` (≈36-71): trim/speed; kenBurns+kbIntensity, pulse/pulseEvery, zooms[], shotMode/shotSecs/shotTrans(+Kind)/_autoTouchedShot/_slideshowPerImg; tracks{scale,panX,panY,rotation,opacity}+_kf+tracksEdited; grade/vignette/grain/shake/flashes/fx{letterbox,lightLeak,chroma}; texts[]/captions[]/capStyle/annos[]/callout; music{buffer,vol,origVol}; avatar{kind,pos,scale,shape,mode,segs,audio,audioVol}; breath; face{mode,zoom,hold,shots[]}; brand; progressBar; intro/outro; liveFilm/embers; transition/transEvery.
- **Render `drawAt(t)` (≈1568-1631), orden:** stage cover-fit → frame video → Ken Burns+pulse+keyframes (`evalTransform` compone scale/panX/panY/rotation/opacity) → grade (filter+wash) → liveFilm/embers → intro/outro → transiciones → vignette/grain/shake/flash → captions → texts → annos (flechas/emojis) → avatar PiP → face-ring → brand → HUD monetización en vivo.
- **Motor keyframes:** tracks = [{t,value,easing}]; `evalProp` (hold antes/después, ≈812), `zEase` (linear/ease/bezier), `zRebuildTracks` (≈848-946) regenera SOLO scale/panX/panY (rotation/opacity son del usuario; respeta `tracksEdited`), `kfAdd` (≈1807). Determinista → preview y export idénticos.
- **Ken Burns:** pan sinusoidal (X: sin 2πt, Y: cos 1.4πt, amplitud ∝ kbIntensity) + breathing (zoom 0.07+…·sin) + pulse (burst cada pulseEvery, duty 18%). **shotMode** (sleep stories v4.11): Ken Burns REINICIA por toma cada shotSecs; `zShotBounds/zShotCount`; cortes duros en fronteras.
- **Key moments (`zKeyMoments` ≈2065):** años(100) > fechas(95) > dinero(90) > millones(85) > %(80) > dígitos largos(70) > números deletreados ES/FR/DE(60-90); alimenta `captionHighlight` (énfasis en subtítulo), `applyCallouts` (máx/gap configurables, no pisa textos manuales `_gen`) y `applyArrowCallouts` (emoji 📅💰📈, máx 8, 10s gap).
- **Builder imágenes→MP4 (`buildVideoFromImages` ≈288-559):** orden natural por nombre → bitmaps → duración por imagen (narración/Nimgs clamp 2.5-6s, ciclando imágenes para llenar TODO el audio; sin narración: por guion ~2.5 w/s) → canvas 1920×1080 cover → VideoEncoder avc1.640028 (14Mbps, prefer-hardware, keyframe por toma) → **matching imagen↔voz**: `getTextTimeline` (transcripción real `_pendingAudioCaptionsP` o guion repartido) + MobileNet local (`ensureMobilenet`/`classifyImagesLocal` 224px center-crop) + traducción gratis translate.googleapis (`detectTextLang/translateWords/imgKwFromLabels`) + `planImageSlots` (overlap de keywords por slot) — **blindado v4.33**: goStep de un disparo, tope 30s, botón "⏭ SALTAR análisis IA", fallback Gemini solo si hay key → audio `encodeNarration` AAC en bloques de 1s con backpressure → **colector `_parts`/`_writePart`** (v4.33: fast-path O(1) si position≥_writeEnd; parches seek-back con spanning; `StreamTarget{chunked:true}` + fastStart:false; fallback ArrayBufferTarget) → `finishMux` ordena por pos y arma `File('slideshow.mp4')` (nombre activa export por SEEK) → `loadFile`.
- **Export (`runExportNow` ≈3297):** GATE `computeMonetScore()` ≥72 directo, <72 modal `confirmExportGate`. **Turbo `_startExportFastBody`:** HEVC opcional vía isConfigSupported; bitrate `exportBitrate(W,H)` con **tope por duración** (v4.34: archivo ≤3.5GB con StreamTarget, ≤600MB en fallback legacy; mínimo 2.5Mbps); slideshow → **export por SEEK** (`seekExact` frame a frame, v4.22), video normal → playback adaptativo 5-16× + requestVideoFrameCallback + guardas anti-negro (readyState) + reuse-last-frame + `endWatch`; **salida por segmentos-Blob `_segs`/`_exWrite`** (v4.34: cada trozo → Blob inmediato, parches con Blob.slice, concat final solo-metadata); **audio:** ≤25 min OfflineAudioContext, >25 min `mixChunkedAndEncode` (≈3465: mezcla manual 1s, interpolación lineal, voz+música loop+avatar con mismos gains/trim/speed); `finalizeMux` idempotente (flag `finalized` — FIX comentado: antes ReferenceError → export clavado en 0%); `fallbackToRealtime` BLOQUEADO para span>150s (mensaje "deja la pestaña al frente"); realtime = MediaRecorder+captureStream solo clips cortos; descarga `dlBlob` → chrome.downloads con revoke al completar (red de seguridad 3 min). **ffmpeg.wasm:** cargado (index.html:205) pero solo en la ruta `loadFFmpeg()`≈3155/3170 (conversión "pro"); el flujo principal NO lo toca.
- **Style Lab / extractor:** `swTranscript` (transcripción YT), `analyzeStoryboard` (mide ritmo real de cortes/movimiento), `buildCustomGrade` (paleta medida → filter+wash), `styleToRecipe` (estilo → campos de P), `fetchOpenverse` (stock CC sin key), plantillas `TEMPLATES` (15+ nichos con recetas completas).
- **IA del editor:** `getAIKeys` (storage), `transcribeGroq` (whisper-large-v3) → `transcribeGemini` fallback, `describeImagesGemini` (batch 5, cadena de modelos).

### 4d. Código de COMPLIANCE / policy / riesgo EXISTENTE (inventario completo)

Esto es lo que un sistema de policy-compliance puede aprovechar HOY:

| Pieza | Dónde | Qué hace | Estado |
|---|---|---|---|
| **`computeMonetScore()`** | app.js ≈2321-2353 | Score 0-100 de "monetizabilidad" del VIDEO en edición. 7 factores: narración ≥50% (+22) / 30-50% (+15) / solo captions (+12); subtítulos (+12); movimiento KB/pulse/zooms (+20); grade (+8); hook ≤3s (+8); efectos liveFilm (+10) o menores (+6); marca (+4). Flags de riesgo por cada ausencia. Bandas: ≥72 MONETIZABLE / 50-71 RIESGO MEDIO / <50 ALTO RIESGO | VIVO — es el GATE del export (`confirmExportGate`) + HUD en vivo |
| **`estimateDeepMonetization(niche, scored, description)`** | nsp-bundle.js ≈20296 | Advertiser-friendliness de un CANAL/nicho: base 62; +12 finanzas/negocios/IA/tech; +6 historia/ciencia/naturaleza/psicología; **−18 crypto/casino/gambling/adult/nsfw/blood/killer/violent; −8 crime/horror/war/dark**; clamp 15-95; labels 'high / advertiser-friendly' ≥75, 'moderate / execution-sensitive' ≥55, 'caution / sensitive topic mix' <55 | VIVO en el análisis profundo (PRO) |
| **`advertiserRisk: null`** | nsp-bundle.js ≈11992 y ≈12920 | Campo RESERVADO en dos objetos de análisis — **nunca se llena** | HUECO listo para el sistema nuevo |
| **Verificador de monetización** | 4a | Estado YPP real de canales de terceros (evidencia: Join/Shop/ads-probe) | VIVO |
| **Filtros faceless/junk como policy de contenido** | 4a | nspIsMetaContentReject + HARD_REJECT families + automation-friendly + face-api = un motor de "clasificación de formato permitido" reutilizable | VIVO |
| **Generador de música "libre de copyright"** | app.js ≈3018-3021 | Síntesis local: *"Sin copyright = sin strikes = monetización segura"* — única mención operativa a copyright | VIVO (herramienta) |
| **Comentario Content-ID** | nsp-bundle ≈15936 | Conocimiento codificado: ads de terceros ≠ monetización propia | doc en código |

| **Policy Engine (Fase 1-2, v4.35)** | `nsp-policy.js` + `data/policies.json` + `lib/nsp-text.js` + panel en app.js | Motor puro (globalThis, SW+páginas): 51 reglas versionadas (§86 DE con case-guard de mayúsculas y word multi-token, childSafety global, medical claims en/es/de, PL gardening) + similitud de guiones por canal (TF-IDF unigramas top-400, umbral **55 provisional**, exclusión same-title en eval). **Panel 🛡️ POLICY CHECK = PRIMERA compuerta apilada en `runExportNow` ANTES del gate legacy (72/50 byte-intactos)**: red=bloqueado sin override (guía fija "elimina o reescribe"), yellow=override auditado, green=continúa; **fail-open LOGUEADO** (engine_error a `nsp_policy_overrides` + advertencia visible en el gate legacy). Rutas SW `policy:rules`/`policy:evaluate` con sender check | VIVO |

**Semántica del corpus de guiones** (anti-inflación por iteración): mismo título normalizado = mismo video → sim ≥98% solo refresca ts (re-export), <98% REEMPLAZA vec+ts+ng in-place (iteración); jamás dos entradas same-title. En evaluación, el título del paquete se EXCLUYE de la similitud (un video vs su propia versión anterior no es señal de plantilla; los falsos yellows entrenan overrides por fatiga). Calibrar el umbral SOLO con truncación top-400 y recalibrar con guiones reales (log `nsp_policy_calib_log`).

**⚠️ 2b DIFERIDO — advertiserRisk vía SW (NO cablear ingenuamente):** los campos `advertiserRisk/monetizationRisk/reusedContentRisk` de los `nichoEntry` (nsp-bundle ≈11992/12920) describen canales AJENOS escaneados; `nsp_policy_last_eval` describe NUESTRO contenido. Un enriquecimiento ciego estamparía nuestro riesgo sobre datos de canales de terceros. 2b requiere **matching de identidad de canal** (enriquecer solo cuando el canal escaneado ES uno nuestro) y tiene su propio GO.

**Lo que NO existe hoy (tras Fase 2):** análisis de guión/audio contra advertiser-friendly guidelines más allá de las listas de términos, escaneo de assets (imágenes/música subidas) por derechos, y señales de "reused content" basadas en la PROPORCIÓN de stock/transformación (la similitud actual solo mide repetición contra tus propios guiones).

---

## STEP 5 — TOUCHPOINTS EXTERNOS

| Dominio | Uso | Contexto | Credenciales/Key | host_perm |
|---|---|---|---|---|
| `www.youtube.com` (HTML + `/youtubei/v1/*`) | scraping páginas (/videos, /about, results), InnerTube player/search/browse | MAIN (fetch directo con `ashlyv_safeFetch` timeout) + **SW proxy** (`fetchInnertube` credentials:'omit' — sin personalización) | `YT_WEB_INNERTUBE_KEY` = clave **pública** del cliente web de YouTube (no es secreto del usuario) | ✅ |
| `i.ytimg.com` / `img.youtube.com` | thumbnails (face-api con crossOrigin anonymous) | MAIN | — | ✅ |
| `www.googleapis.com` (YouTube Data API v3) | batch channels (validación SCAN) | SW (`NSP_FETCH_YT_CHANNELS`) | `nsp_yt_data_api_key` (localStorage de youtube.com) | ✅ |
| `generativelanguage.googleapis.com` | Gemini chat/visión/transcripción (cadena de modelos) | SW + EXT pages | `nsp_gemini_api_key` (storage.local, texto plano) | ✅ |
| `api.groq.com` | chat (llama-3.3-70b / 8b-instant) + whisper-large-v3 | SW + EXT + MAIN(coach via bridge) | `nsp_groq_api_key` | ✅ |
| `api.anthropic.com` | visión thumbnails / chat (ASHLYV_ANTHROPIC_*) | SW + ashlyv-api | `ashlyv_api_key` | ❌ **NO está en host_permissions** — funciona desde SW (los SW no aplican CORS igual) pero es frágil/incoherente |
| `http://localhost:11434` (Ollama) | IA local opcional | SW | — | ✅ (localhost) |
| `http://127.0.0.1:8000` | **backend hardcodeado** en ashlyv-api.js (scan-channel, market-radar, gap-finder…) | EXT | — | ✅ pero el backend NO existe en el repo |
| `translate.googleapis.com` (endpoint gtx gratuito) | detectar idioma + traducir keywords (matching imágenes) | EXT (editor) | sin key | ✅ |
| `api.openverse.org` | stock CC para URL→video | EXT | sin key | ✅ |
| `image.pollinations.ai` | imágenes IA (Style Lab/handoffs) | EXT | sin key | ✅ |
| `chatgpt.com`, `socialblade.com`, unpkg/jsdelivr | solo links/headers informativos, no fetch de runtime | — | — | n/a |

**Estrategias CORS:** (1) SW como proxy para InnerTube con `credentials:'omit'` (evita personalización Y CORS); (2) fetch directo MAIN world a youtube.com (mismo origen — OK); (3) face-api/builder usan `crossOrigin='anonymous'` sobre i.ytimg (sirve ACAO:*); (4) **pendiente conocido** (task #125): mover los fetch de YT Data API del MAIN world al SW.
**Manejo de keys:** todas en texto plano (storage.local o localStorage); entrada por Options con test real (cadena de 9 modelos Gemini); cero keys personales hardcodeadas (verificado; lo que parece key es texto de ayuda).

---

## STEP 6 — INFORME DE SALUD

**Muerto/peso:** 6 archivos `content/*` huérfanos + styles.css huérfano; 5 backups `.bak/.before-restore` (~6.3MB) dentro del árbol; `options.html.bak`; test suelto en raíz; PDFs de socios en raíz; **ffmpeg-core.wasm 32MB** cargado en el HTML del editor pero usado solo por una ruta secundaria; shards `ssd_mobilenetv1` (5.6MB) presentes para el retry híbrido de face-api (verificar si el retry sigue activo antes de excluir).

**TODOs/FIXME/HACK:** 43 en código propio. Hotspots de console.warn/error que delatan rutas frágiles: carga de face-api (orden de scripts / bridge no corrió / modelo falló / WebGL read), overlay render, validación API sin channelIds, fallback realtime del export.

**Duplicaciones:** helper `el(tag,css,text)` definido 3× en nsp-bundle (≈14292/18541/19134) + `mk()` del calculador; lógica Groq→Gemini repetida en SW y toolkit.js; dos rate-limiters; patrones de panel (header+X+drag) repetidos en ~6 paneles.

**Puntos frágiles que el build grande NO debe apoyar sin red:**
1. **Trusted Types en youtube.com** — nada de innerHTML en MAIN (ya mordió 2 veces: v3.4.4, v4.30.2). Quedan ~40 innerHTML en nsp-bundle que solo se ejecutan en paneles EXT-like; CUALQUIER ruta nueva en MAIN debe ser DOM API puro.
2. **Selectores del DOM de YouTube** (los más load-bearing): `ytd-sponsor-button-renderer` (Join), tabs por texto (Shop), `ytd-thumbnail img`/`a#thumbnail img`, `ytd-rich-grid-media`, `joinedDateText` en ytInitialData, `yt-navigate-finish`. Un rediseño de YT rompe monetización/edad/overlays silenciosamente.
3. **InnerTube no documentado:** clave pública + clientes (TVHTML5_SIMPLY_EMBEDDED_PLAYER) pueden cambiar sin aviso; el probe de ads es heurístico (Content-ID).
4. **MAIN world sin chrome.runtime:** TODO pasa por el bridge postMessage + atributos DOM; cualquier feature nueva en YT debe diseñar su requestId/timeout desde el día 1.
5. **nsp-bundle.js = 24k líneas en un archivo** sin módulos ni build: los números de línea derivan, los nombres globales colisionan fácil; tres sitios de versión (manifest + banner L8 + APP_VER) que hay que tocar juntos.
6. **Almacenamiento partido por origen** (storage.local vs localStorage YT vs localStorage EXT vs sessionStorage) — fácil leer la clave correcta en el lugar equivocado.
7. **Límites de memoria del editor** ya golpeados 3 veces (v4.31/33/34): cualquier feature nueva de export debe usar los colectores por segmentos, no buffers contiguos.
8. **api.anthropic.com sin host_permission** y **backend 127.0.0.1:8000 inexistente** en ashlyv-api.js — rutas que parecen vivas pero fallan en frío.
9. **chatgpt.com/socialblade** y CDNs aparecen en strings — no son fetch de runtime, no construir sobre ellos.

---

## PREGUNTAS QUE EL CÓDIGO NO PUEDE RESPONDER (para el dueño, antes de diseñar el sistema de compliance)

1. **Alcance:** ¿el sistema de policy-compliance evalúa (a) el VIDEO que se está editando antes de exportar, (b) CANALES/nichos ajenos durante el scan, (c) guiones/títulos antes de producir — o las tres superficies?
2. **Fuente de verdad de las políticas:** ¿reglas locales escritas por ti (tabla versionada en el repo) o verificación con IA (Groq/Gemini) contra las políticas de YouTube? ¿Debe funcionar 100% gratis/sin key como exigiste para el matching de imágenes?
3. **"Reused content":** ¿qué evidencia consideras suficiente para marcar riesgo (proporción de assets de stock, falta de narración propia, similitud con videos fuente del Style Lab)? Hoy NO hay ninguna señal de esto.
4. **Bloqueo vs aviso:** ¿el gate debe poder IMPEDIR el export (hard block) o solo avisar como hoy (score <72 → modal y el usuario decide)? ¿Quién puede saltárselo (tú vs el socio/clientes)?
5. **Persistencia/auditoría:** ¿hay que guardar un historial de compliance por video exportado (score, flags, fecha, quién exportó) para enseñárselo al socio/clientes? ¿Dónde — storage local o un backend que hoy no existe?
6. **Umbrales de negocio:** computeMonetScore usa 72/50 y estimateDeepMonetization 75/55 — ¿esos números son tuyos o heredados? ¿El sistema nuevo define una escala única?
7. **Idiomas:** ¿las políticas se evalúan solo ES/EN o en los 45+ idiomas que el scanner ya soporta?
8. **El backend 127.0.0.1:8000** de ashlyv-api.js: ¿existe en algún lado, está planeado, o se elimina del diseño?
9. **Presupuesto de peso:** ¿el sistema nuevo puede añadir modelos locales (como MobileNet, +MB) o debe ser regex/heurística pura?
10. **Partner build:** ¿el compliance debe correr también en la build ofuscada del socio (ZERACK-partner-build quedó en v4.22) y sincronizarse, o solo en tu copia?
