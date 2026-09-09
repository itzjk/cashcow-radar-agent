# ZERACK · NicheScanner Pro — Documentación completa de funciones

**Versión:** v4.14.0 · Extensión Chrome (Manifest V3) · Procesamiento local + IA (Groq / Gemini / opcional backend local)

> Documento de referencia de TODAS las funciones de la extensión, organizado por superficie. Pensado para revisión y para generar un PDF.

---

## 0. Visión general

ZERACK (interfaz "NicheScanner Pro") es una suite completa para **YouTube faceless automation**: encontrar nichos virales, analizar competencia, generar guiones e ideas, producir voz y prompts visuales, y editar/blindar el video final contra la desmonetización — todo desde el navegador.

**Superficies (dónde vive cada cosa):**

| Superficie | Archivo principal | Dónde aparece |
|---|---|---|
| Scanner en YouTube | `content/nsp-bundle.js` (MAIN world) | Sobre youtube.com (overlay + botones) |
| Predictor de títulos | `content/nsp-studio.js` (ISOLATED) | Sobre studio.youtube.com |
| Hub ASHLYV | `ashlyv/ashlyv.html` + `ashlyv.js` | Página interna (pestaña) |
| Centro de herramientas | `ashlyv/tools/*` | Páginas internas (7 tools) |
| Editor de video | `monetize-studio/index.html` + `app.js` | Página interna |
| Popup | `popup/popup.html` | Click en el ícono |
| Dashboard de canales | `dashboard/dashboard.html` | Página interna |
| Country Feed | `country-feed/country-feed.html` | Página interna |
| Opciones | `options/options.html` | Configuración |
| Background | `background/service-worker.js` | Invisible (motor) |

**Requisitos de IA:** la mayoría de funciones inteligentes usan una **API key gratuita** que el usuario pega en **Opciones**: **Groq** (`gsk_…`) y/o **Gemini** (`AIza…`). El Hub ASHLYV además puede usar un **backend local opcional** (`127.0.0.1:8000`, Ollama) o una key de **Anthropic/Claude**.

---

## 1. Scanner en YouTube — `content/nsp-bundle.js`

Se inyecta sobre youtube.com. Es el corazón de descubrimiento de nichos. (El motor de SCAN está **bloqueado/estable — no se modifica**.)

### 1.1 Botones inyectados en la barra superior

| Botón | Acción |
|---|---|
| 🦇 **SCAN** | Escanea el feed actual (home / búsqueda / tendencias) y devuelve ~10 videos faceless virales del nicho, ordenados por VPH. |
| 🌍 **Control de país / mercado** | Desplegable con banderas (Global, España, Argentina, México, Colombia, Perú, USA, UK, Alemania, Francia, Italia, Brasil, etc.). Al elegir un país: fija el idioma/región (gl/hl), navega al feed de ese mercado y dispara un escaneo automático. |
| 🦇 **ASHLYV / Radar de competidores** | En zonas de canal: abre un radar que busca canales similares por keywords del nicho (IA). |

Los botones se reinyectan solos si YouTube los borra (MutationObserver).

### 1.2 Overlay de métricas sobre cada video

Debajo de cada miniatura aparece un badge expandible con:

- **⚡ VPH (Views Per Hour)** — velocidad de vistas por hora; el indicador clave de tracción. Formato compacto (ej. `1.2K/h`).
- **💎 Tier de viralidad** — clasificación por VPH: **MEGA / STRONG / GOOD / OK / SLOW / DEAD** (color según el tier).
- **👁 Vistas totales** — formato K/M.
- **💰 RPM estimado** — ingreso por mil vistas según el **nicho detectado** y el **mercado** (ej. RPM nórdico > RPM latino).
- **🎯 Nicho detectado** — categoría automática del video.
- **🏆 Outlier tier** — qué tan por encima del promedio del canal está ese video (multiplicador viral).
- **🔴 Duración** — corto (<2 min) / largo.

### 1.3 Badges especiales

- **💎 NEW & EXPLODING** — se inyecta **al lado del botón Suscribirse** del canal. Marca canales emergentes con tracción rápida (canal joven + crecimiento acelerado de subs o vistas medias altas). Señala oportunidad de nicho nuevo.
- **📌 Edad del canal** — pill con la antigüedad (ej. `3mo`, `1y`); se obtiene del `/about` del canal.
- **💳 Monetización del canal** — heurística que detecta membresías / tienda / botón "Unirse" para inferir si el canal está monetizado.

### 1.4 Batman SCAN — escaneo faceless

Flujo completo al pulsar 🦇 SCAN:

1. **Recolección:** hace scroll automático del feed y junta cientos de tarjetas (título, URL, miniatura, vistas, antigüedad, canal, subs).
2. **Clasificación faceless (pipeline en passes):**
   - **Patrones de título** AI/faceless (rankings, "top X", "la historia de…", explicativos, etc.).
   - **Patrones de canal** + whitelist de canales faceless conocidos.
   - **Face-API** (si `face-api.min.js` está cargado): detecta rostros en la miniatura y rechaza caras.
   - **Junk filter** duro: descarta meta-contenido de YouTube ("cómo hacer un canal faceless", herramientas IA, análisis de algoritmo), reacciones, vlogs, drama personal, claymation, cortos musicales, biografías de personas, etc.
3. **Criterios virales:** mínimo de vistas (~10K), antigüedad máxima (~60 días), VPH mínimo, y "compatible con automation".
4. **Force-to-10:** si quedan menos de ~10, relaja criterios de forma progresiva (sin tocar el junk filter) hasta llegar a ~10.
5. **Resultados:** lista de ~10 videos ordenados por VPH con: badges VPH/RPM/tier + botones **Guardar al dashboard**, **Ver en YouTube** y **Asignar a nicho**. Muestra stats ("Escaneados: X → Y faceless") y botones de **Nuevo scan / Buscar otro FYP / Reescanear**.
6. **Variante Stealth (por país):** al elegir un mercado, hace un escaneo más liviano expandiendo por keywords del país vía InnerTube, con indicador de progreso.

### 1.5 Panel TRACKING (seguimiento de canales)

Overlay flotante y arrastrable que para un canal muestra:

- **Status** — EXPLODING / RISING / SATURATED / FLAT / DEAD.
- **Velocity** — subs ganados por semana.
- **Projection** — proyección a ~90 días si mantiene el ritmo.
- **Quick actions** — Ver videos · Analítica · Guardar · Notas (notas persistentes por canal).
- Guarda histórico en `chrome.storage.local`.

### 1.6 Agente IA del SCAN (Coach)

Botón **🤖 AGENT / ASHLYV** dentro del panel SCAN: chat conversacional que **lee los resultados del scan actual** y responde sobre nichos, competidores, ideas y viralidad. Multi-proveedor (Groq → Gemini → backend local), con sesiones e historial y limitador anti-429.

### 1.7 Country Feed (selector de país)

Al elegir un país inyecta gl/hl + cookie PREF, navega al `/feed/trending` del país y dispara auto-scan. Muestra un badge de estado (`🇪🇸 ES · es · Profundo · N filt`). *(El auto-scan al seleccionar país está confirmado/bloqueado por el usuario.)*

---

## 2. Predictor de títulos — `content/nsp-studio.js` (YouTube Studio)

Se inyecta en **studio.youtube.com** para predecir el rendimiento del título antes de publicar.

- **Detección de idioma** automática (ES / EN / PT / DE / FR) → `zDetectLang`.
- **Detección de nicho** (incluye "Historias / Drama", misterio, finanzas, etc.) → `zDetectNiche`.
- **Motor de análisis** `zTitleEngine.analyze`: combina similitud TF-IDF (coseno) contra un corpus de mercado, estructura del gancho (hook) y percentiles → **score de viralidad**.
- **RPM por nicho** (`ZNICHE_RPM`) y geo por idioma (`ZLANG_GEO`).
- **Títulos sugeridos** en el **mismo idioma** del título analizado (no fuerza inglés), con manejo léxico cross-idioma.

---

## 3. Hub ASHLYV — `ashlyv/ashlyv.html`

Centro de inteligencia de nichos. Tres modos + analizadores + el centro de herramientas.

### 3.1 Modos principales

| Modo | Color | Qué hace |
|---|---|---|
| **SCANNER** | Verde | Análisis 360° de un canal/URL: patrones, competidores, gaps de contenido, sub-nichos y estrategia (paneles de inteligencia). |
| **REPLICATOR** | Púrpura | Copia el modelo de éxito de un canal: patrones virales + plan de replicación en 4 pasos + sub-nichos + calendario de contenido (2 semanas). Botón "Generar guiones completos (IA)". |
| **BRAND BUILDER** | Dorado | Genera identidad de marca: nombres de canal, bio/about, paleta visual + concepto de logo, estrategia de contenido y proyección de ingresos. |

### 3.2 Analizador de miniaturas

El usuario sube una miniatura (+ nombre del canal opcional) y la IA devuelve **scores**: CTR, impacto emocional, legibilidad del texto, contraste de color, gancho de curiosidad, si **detecta cara** (anti-faceless), veredicto (VIRAL / GOOD / NEEDS WORK / POOR), compatibilidad faceless, fortalezas y mejoras. Guarda **historial** de análisis. (Usa backend local Ollama-Vision o Claude/Gemini según disponibilidad.)

### 3.3 Paneles de inteligencia (modo Scanner)

- **Competidores** — lista clasificada (directo / emergente / adyacente) con subs, crecimiento, amenaza y % de similitud.
- **Patrones** — hooks más usados, estructura, duraciones que convierten, emojis/keywords recurrentes, CTAs.
- **Gaps** — keywords/formatos/sub-nichos sin explotar; antigüedad del contenido top.
- **Sub-nichos** — micro-nichos con potencial, competencia, barrera y RPM esperado.
- **Estrategia** — 3 planes de ataque: Seguro / Agresivo / Diferenciación.

### 3.4 Modales secundarios

- **Masterplan GPT** — estrategia base + hook + monetización de una oportunidad.
- **Roba Nicho** — snapshot competitivo de un nicho guardado.
- **Traducir Nicho** — traduce un nicho a otro idioma + búsqueda en YouTube + copiar.

### 3.5 Stats e insights

Barra superior: nichos guardados, # virales, RPM promedio, ingreso mensual estimado, top niche y pool mensual.

### 3.6 Proveedores de IA del Hub

Cadena de fallback: **Backend local (127.0.0.1:8000, Ollama)** → **Anthropic/Claude** (key) → **Gemini** → **Groq**. Si no hay backend local, varias funciones del Hub dependen de tener una API key válida. Keys en `chrome.storage.local`.

> ⚠️ **Nota:** el backend local `127.0.0.1:8000` es **opcional**. Sin él, las funciones del Hub que dependen de endpoints `/niche/*` quedan limitadas; las herramientas del punto 4 NO dependen de ese backend (usan Groq/Gemini directo).

---

## 4. Centro de herramientas — `ashlyv/tools/*`

Se abren desde el modal **TOOLS** del Hub. Todas usan tu key **Groq/Gemini** de Opciones, comparten el look **negro/neón** y **se encadenan entre sí** (cada una puede mandar su resultado a la siguiente).

### 4.1 🚀 AutoPilot (`autopilot.html`) — NUEVO

De **un solo tema** genera **todo el paquete en un clic**, con pasos en vivo:
- Guion completo + breakdown por escenas + metadata (título/descripción/tags).
- Prompts de imagen por escena + 3 conceptos de miniatura.
- Botones para mandar todo a **VoxBatch** (voz) o a **Monetize Studio** (editor). Descarga el paquete en `.json`.

### 4.2 📜 ScriptPilot AI (`scriptforge.html`)

Tema + nicho + duración + idioma + tono → **guion continuo** + **escenas** (narración + idea visual + segundos) + **título** + **hook** + **CTA** + **descripción** + **tags**. Botones: descargar `.txt`/`.json`, mandar a VoxBatch / MotionForge / Monetize Studio.

### 4.3 🎙️ VoxBatch Pro (`voxforge.html`)

Pega un guion → lo divide en **escenas** → lo **narra con voces del navegador** (gratis, sin créditos), con selección de voz, velocidad y tono. Reproduce escena por escena o todo seguido, resalta la escena activa, y exporta la **cola en SSML**. *(La voz suena en el navegador; para audio final se graba o se sube el MP3 a Monetize Studio.)*

### 4.4 🎨 MotionForge Studio (`thumbnailforge.html`)

Pega un guion + estética + formato (16:9 / 9:16 / 1:1) → genera **un prompt de imagen/video por escena** (en inglés, listos para Flow/Veo/Midjourney/Nano Banana) con estética **coherente** entre escenas, + 3 **conceptos de miniatura** de alto CTR. Copiar por escena o todos; descargar plan `.json`; mandar al editor/VoxBatch.

### 4.5 🛰️ RivalRadar Pro (`competitorfinder.html`)

Nicho/keyword + mercado → **búsquedas listas** que **abren YouTube con un clic**, **formatos** que funcionan (con ejemplos), **huecos** sin explotar, **ángulos de monetización**, **RPM** estimado y nivel de **saturación** + veredicto.

### 4.6 📊 NicheMaster (`nichemaster.html`)

Nicho + mercado → **score de oportunidad (0-100)**, RPM, demanda, saturación, **fit faceless**, **sub-nichos** jugosos, **ideas de video** (clic → ScriptPilot), vías de **monetización** y **riesgos**.

### 4.7 Guía (`help.html`)

Explica el flujo recomendado y cómo usar cada herramienta + botón directo a Opciones (para la API key). *(Reemplaza los antiguos "en construcción".)*

### 4.8 Flujo conectado

```
NicheMaster (valida idea) → ScriptPilot (guion) → MotionForge (visual)
                                     ↓
                  VoxBatch (voz)  ·  🛡️ Monetize Studio (video)
   ── o todo de una con 🚀 AutoPilot ──
```

---

## 5. Monetize Studio — editor de video (`monetize-studio/`)

Editor profesional anti-desmonetización, 100% local. Convierte imágenes + audio en un video editado y blindado.

### 5.1 Imágenes → video automático

- Subís **1–200 fotos** (JPG/PNG/WEBP) → arma un MP4 1080p: las ordena, las encuadra (cover-fit), reparte los cuadros **exactos** para llenar **todo el audio sin huecos**, y aplica movimiento y transiciones.
- **Narración multi-audio:** subís **uno o varios** MP3/WAV; los **une en orden** y el video dura **exactamente** lo que la voz combinada (audio incluido). Codifica el audio en bloques (robusto para horas).

### 5.2 Subtítulos automáticos desde la voz

Transcribe la narración con **Groq Whisper** (timestamps reales) o **Gemini** y genera subtítulos sincronizados. Con varios audios, transcribe cada uno y **corre los tiempos** para que todo calce.

- **Plantillas estilo CapCut:** 10 plantillas + 8 tipografías + MAYÚSCULAS + **karaoke** (palabra por palabra) + estilos de caja (sólido/redondo/barra/keybox/ninguno).

### 5.3 Modo AUTO + herramientas manuales

- **AUTO** aplica de un toque: movimiento **Ken Burns**, respiración (zoom continuo), transiciones por imagen, color, hook de arranque, y subtítulos.
- **Rail de herramientas manuales:** Recortar · Formato (16:9 / 9:16 / 1:1 / 4:5) · Zoom · Color · Efectos · Transiciones · Personaje (seguir cara) · Señalar (flechas) · Texto · Subs · Audio/Música · **Avatar** · Marca · Intro/Outro · Miniatura · Preset.

### 5.4 Plantillas por nicho

Aplica de un click el "look" del nicho (color, Ken Burns, transiciones, subtítulos). Incluye **"Historias para dormir"**: cálido + viñeta + **brasas/cenizas de fuego** 🔥 + Ken Burns lento (intensidad + respiración) — **sin** el "rayo de luz" (efecto de rayas, quitado a pedido).

### 5.5 Avatar (talking-head)

Superpone un **avatar** (video o imagen) sobre las imágenes: posición, forma, modos de visibilidad (siempre / a ratos / por segmentos) y **mezcla de la voz del avatar** en el export.

### 5.6 HUD de monetización + escudo

- **Efectividad de monetización** (score 0-100) que recalcula con cada edición, con factores (narración, subtítulos, movimiento, color, efectos, marca, hook).
- **Escudo anti-desmonetización:** antes de exportar avisa qué falta para no caer como "inauténtico/reutilizado" (nunca bloquea: "Exportar igual").

### 5.7 Exportación

- **Panel estilo CapCut:** resolución (720/1080/1440/4K), tasa de bits, codec (H.264/H.265), formato (MP4/MOV) y FPS (24/30/60).
- **Export turbo (WebCodecs)** rápido para videos largos, con cierre robusto (no se cuelga al 100%); fallback a grabación compatible. Descarga vía `chrome.downloads`.

### 5.8 Style Lab (extractor de estilo por URL)

Pegás el link de un video → lee miniatura (paleta/contraste/look) + título (nicho/gancho) + **visión IA** (Gemini, multi-frame con cuadros reales del video) → arma una **plantilla de edición** y puede **generar videos en ese estilo** (modos: imágenes IA / imágenes propias / tarjetas), generando guion e imágenes con Gemini.

### 5.9 Multi-guion

Subís varios `.txt` que se **unen en orden** (ideal para compilaciones de ~2 h tipo sleep stories), limpiando numeración/timestamps.

---

## 6. Páginas auxiliares

- **Popup** (`popup/popup.html`) — acceso rápido: abrir el Hub, Country Feed, dashboard, opciones.
- **Dashboard de canales** (`dashboard/dashboard.html`) — "Channel Hub": unifica canales guardados (manual + scout), filtros por nicho/RPM/edad/status, **export CSV/JSON**, búsqueda.
- **Country Feed** (`country-feed/country-feed.html`) — dashboard standalone de nichos por mercado (datos cacheados ~15 min vía Service Worker).
- **Niches** (`niches/niches.html`) — listado curado de nichos faceless con RPM, herramientas y canales de ejemplo.
- **Opciones** (`options/options.html`) — pega y **prueba** tus API keys de **Gemini** y **Groq**, tabla de RPM por nicho, ajustes de tiers/visualización.

---

## 7. Background / Service Worker (`background/service-worker.js`)

Motor invisible:

- **Alarma de auto-scan** periódica que recorre búsquedas faceless y alimenta los canales guardados.
- **InnerTube fetch** (sin credenciales) para los feeds por país + caché.
- **Proxy de IA / fetch** para las páginas (Groq, Gemini, traducción, fetch de texto de URLs).
- **Handlers de mensajes:** guardar canal/nicho (con dedup y tope), abrir pestañas, set de cookie PREF (país), salud de Ollama, validación de keys, broadcast de progreso.

---

## 8. Almacenamiento (claves principales)

- `chrome.storage.local`: `nsp_all_channels`, `ashlyv_nichos`, `nsp_gemini_api_key`, `nsp_groq_api_key`, `ashlyv_api_key` (Claude), historial del coach, tracking de canales.
- `chrome.storage.sync`: `nsp_settings` (tiers, RPM, toggles).
- `localStorage` (compartido entre páginas de la extensión): flags de auto-scan, `zerack_handoff_script` / `zerack_handoff_topic` (handoff entre tools y editor), config de export del editor.

---

## 9. Requisitos y notas

- **Chrome** (Manifest V3). Para crear/exportar video se necesita **WebCodecs** (Chrome actualizado).
- **API keys (gratis):** Groq y/o Gemini en **Opciones** — habilitan tools, coach, subtítulos y Style Lab. Las keys **las pone el usuario** (no vienen incluidas).
- **Backend local opcional** (`127.0.0.1:8000`, Ollama) — solo para algunas funciones del Hub; nada del editor ni de las 7 tools depende de él.
- **Voz IA** de VoxBatch: usa el sintetizador del navegador (no se guarda como archivo desde ahí).
- Tras actualizar: **recargar la extensión** en `chrome://extensions` (↻), no F5.

---

## 10. Resumen de capacidades (de idea a video publicado)

1. **Descubrir** nicho/idea → Scanner YouTube (🦇 SCAN, Country Feed) + NicheMaster + RivalRadar.
2. **Validar** competencia → Hub ASHLYV (competidores, gaps, patrones) + RivalRadar.
3. **Guionizar** → ScriptPilot / AutoPilot (guion + escenas + metadata).
4. **Producir voz** → VoxBatch (o subir MP3 propio).
5. **Producir visuales** → MotionForge (prompts por escena) + generadores de imagen.
6. **Editar y blindar** → Monetize Studio (imágenes + audio → video con Ken Burns, subtítulos, plantillas, avatar, escudo anti-desmonetización, export).
7. **Predecir el título** → Predictor en YouTube Studio antes de publicar.
8. **Seguir** el crecimiento → Tracking + Dashboard de canales.

---

*Documento generado para revisión. Versión de la extensión: v4.14.0. El motor de SCAN del scanner está estable/bloqueado y no se modifica.*
