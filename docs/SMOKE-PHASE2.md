# SMOKE PHASE 2 — Verificación in-extension de `policy:rules` / `policy:evaluate`

**Objetivo:** probar la mensajería del Policy Engine desde un contexto REAL de la extensión (lo único que el harness headless de Fase 1 no pudo ejercitar: el listener del service worker + el sender check).
**Duración:** ~3 minutos. **No modifica nada** — solo lee.

---

## 0 · Prerrequisitos (1 vez)

1. `chrome://extensions` → verifica que la extensión cargada apunta a la carpeta **`niche-scanner-extension edit`** (⚠️ hay 5 copias en Downloads — si está cargada otra, este smoke falla con 404 de policies.json).
2. Pulsa **↻ (Actualizar)** en NicheScanner Pro — el service worker debe re-evaluarse para registrar el listener `policy:*` y el `importScripts` nuevo.
3. Deja abierta la consola del SW para diagnósticos: en la tarjeta de la extensión → **"Inspeccionar vistas: service worker"**. Si el import falló verás ahí una línea `[NSP SW] importScripts policy engine: …`. Si no hay errores rojos, sigue.

## 1 · Abrir un contexto de extensión real

- Clic en el icono de NicheScanner Pro → botón **🎬 Monetize Studio** (o navega directo a `chrome-extension://<ID-de-la-extensión>/monetize-studio/index.html`).
- En esa pestaña: clic derecho → **Inspeccionar** → pestaña **Console** (o `Cmd+Option+I` en Mac).
- (La página de Options sirve igual; cualquier página `chrome-extension://` propia pasa el sender check. Una pestaña de youtube.com NO sirve para este smoke.)

---

## 2 · Snippet (a) — `policy:rules` → `{ok, rules}` con 51 reglas

Pega en la consola:

```js
const r = await chrome.runtime.sendMessage({ type: 'policy:rules' });
console.log('ok =', r && r.ok, '· version =', r && r.rules && r.rules.version);
const g = r.rules.global, ch = r.rules.channels;
const total =
  g.childSafety.hardBlock.length +
  g.medicalClaims.softFlag.en.length + g.medicalClaims.softFlag.es.length + g.medicalClaims.softFlag.de.length +
  ch.de_history_main.hardBlock.length + ch.pl_gardening_main.softFlag.length;
console.log('TOTAL reglas =', total, '(esperado: 51 → cs 8 + mc 20 + §86 18 + pl 5)');
r;
```

**Forma esperada:**
```js
{ ok: true, rules: { version: 1, updated: "2026-06-10", _purpose: "…", engine: {…},
    global: { childSafety: { hardBlock: [8 reglas] },
              medicalClaims: { softFlag: { en: [7], es: [7], de: [6] } } },
    channels: { de_history_main: {…18 hardBlock…}, sleep_en_main: {…}, sleep_es_main: {…},
                sleep_de_main: {…}, pl_gardening_main: {…5 softFlag…} } } }
```
**PASS si:** `ok === true` y `TOTAL reglas = 51`.

---

## 3 · Snippet (b) — `policy:evaluate` paquete DE con "Waffen-SS" → red, sin override

```js
const red = await chrome.runtime.sendMessage({ type: 'policy:evaluate', payload: {
  channelKey: 'de_history_main', lang: 'de',
  script: 'Im Jahr 1943 marschierte die Waffen-SS durch das besetzte Gebiet, während die Bevölkerung schwieg.',
  title: 'Der lange Marsch von 1943',
  description: 'Ein historischer Bericht über die Besatzungszeit.'
}});
console.log('risk =', red.result.risk, '· overrideAllowed =', red.result.overrideAllowed);
console.log('regla disparada =', red.result.detail.matchedTerms.map(h => h.rule.id + '@' + h.field + ':' + h.index));
red.result;
```

**Forma esperada:**
```js
{ risk: "red", overrideAllowed: false, disclosureReminder: true,
  reasons: ["HARDBLOCK [de86-007] «waffen ss» en script (índice 29): … → ELIMINA O REESCRIBE este contenido — no existe workaround válido para un hardBlock."],
  similarity: { score: 0, nearest: [] },   // corpus vacío hoy — correcto
  detail: { hardBlocks: [1], softFlags: [], matchedTerms: [{ term:"waffen ss", index:29, field:"script", rule:{ id:"de86-007", … } }], … } }
```
**PASS si:** `risk === 'red'` **y** `overrideAllowed === false` **y** matchedTerms incluye `de86-007@script`.

---

## 4 · Snippet (c) — `policy:evaluate` paquete EN sleep limpio → green

```js
const grn = await chrome.runtime.sendMessage({ type: 'policy:evaluate', payload: {
  channelKey: 'sleep_en_main', lang: 'en',
  script: 'Tonight we drift across a quiet ocean under a blanket of stars. Each gentle wave rises and falls like your slow breathing while the moonlight glows on the calm water.',
  title: 'Ocean of silver moonlight',
  description: 'A calm sleep story for deep rest.'
}});
console.log('risk =', grn.result.risk, '· disclosureReminder =', grn.result.disclosureReminder);
grn.result;
```

**Forma esperada:**
```js
{ risk: "green", overrideAllowed: true, disclosureReminder: true,
  reasons: ["Sin términos de riesgo en script/título/descripción y similitud 0% bajo el umbral 55%."],
  similarity: { score: 0, nearest: [] },
  detail: { hardBlocks: [], softFlags: [], matchedTerms: [], lang: "en", channelKey: "sleep_en_main" } }
```
**PASS si:** `risk === 'green'` **y** `disclosureReminder === true`.

---

## 5 · Los 3 fallos más probables (diagnóstico de una línea)

| Síntoma | Diagnóstico |
|---|---|
| `undefined` o error **"Could not establish connection. Receiving end does not exist."** | **Listener no registrado** → el SW no se recargó tras el cambio (haz ↻ en chrome://extensions) o el SW murió al arrancar — mira errores rojos en "Inspeccionar service worker". |
| `{ ok: false, error: "sender_not_allowed" }` | **Sender rechazado** → estás ejecutando el snippet fuera de un contexto propio (p. ej. consola de youtube.com u otra extensión); ábrelo desde la pestaña `chrome-extension://` de Monetize Studio/Options. |
| `{ ok: false, error: "NSPPolicy no cargado (importScripts falló)" }` (rules sí responde, evaluate no) | **Error de ruta en importScripts** → en la consola del SW estará `[NSP SW] importScripts policy engine: <detalle>`; casi siempre es carpeta cargada equivocada o archivo `lib/nsp-text.js` / `nsp-policy.js` ausente en esa copia. |
| (bonus) `{ ok: false, error: "policies.json HTTP 404" }` en rules | La carpeta cargada en Chrome no es `niche-scanner-extension edit` (no tiene `data/policies.json`). |

---

## 6 · Reporte

Pega aquí los TRES outputs (a/b/c) tal cual salgan, o la fila de fallo de la tabla. Con 3× PASS arranca el STEP 1 del kickoff (diseño del panel pre-export).
