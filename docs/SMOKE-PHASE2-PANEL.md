# SMOKE PHASE 2 — Panel 🛡️ POLICY CHECK (matriz manual de UI, 12 casos)

**Objetivo:** verificar el panel pre-export end-to-end en el editor real. 12/12 PASS = **Fase 2 formalmente cerrada**.
**No modifica código** — solo usas la UI + lees storage con los snippets de abajo.

---

## 0 · Prerrequisitos (mismos de SMOKE-PHASE2.md)

1. `chrome://extensions` → la extensión cargada apunta a **`niche-scanner-extension edit`** (hay 5 copias en Downloads; carpeta equivocada = todo falla).
2. **↻ Actualizar** la extensión.
3. Abre el editor: icono NSP → **🎬 Monetize Studio** → verifica **`v4.35.0`** arriba a la derecha (si no, no recargó).
4. DevTools de la pestaña del editor: clic derecho → Inspeccionar → **Console** (aquí corren los snippets y aparecen las líneas `[POLICY …]`).
5. Deja también abierta la consola del SW ("Inspeccionar vistas: service worker") por si algo huele a importScripts.
6. Material: un video corto (~1 min) o 2-3 imágenes + un guion de ~120-150 palabras pegado en el cajón de guion de la pantalla de carga.

### Snippets de lectura de storage (pegar en la Console del editor — nunca adivines)

```js
// overrides (amarillos + engine_error) — cap 200
(await chrome.storage.local.get('nsp_policy_overrides')).nsp_policy_overrides
// última evaluación por canal
(await chrome.storage.local.get('nsp_policy_last_eval')).nsp_policy_last_eval
// log de calibración — cap 10
(await chrome.storage.local.get('nsp_policy_calib_log')).nsp_policy_calib_log
// corpus de guiones (vec = top-400 frecuencias, jamás el guion)
(await chrome.storage.local.get('nsp_script_corpus')).nsp_script_corpus
// canal persistido del panel
localStorage.getItem('nsp_ms_policy_channel')
```

**Formato esperado de la línea de calibración** (una por CADA evaluación, también re-evals):
```
[POLICY calib] canal=<channelKey|(global)> raw=<n>% corpus=<n> risk=<green|yellow|red>
```

---

## La matriz (marca ☑ por caso)

### ☐ 1 · RED — bloqueado sin ruta de export
**Pasos:** pega en el guion: `Im Jahr 1943 marschierte die Waffen-SS durch das besetzte Gebiet.` → carga el video → 🎬 Exportar → ⬇ Exportar → en el panel elige canal **de_history_main** → **↻ Re-evaluar**.
**Esperado:** semáforo **● BLOQUEADO** rojo · reason `HARDBLOCK [de86-007] «waffen ss» en script…` · tarjeta `[script]` con el extracto resaltando **exactamente `Waffen-SS`** (endIndex — ni un carácter más ni menos) · guía fija "⛔ … ELIMINA O REESCRIBE …" · **UN solo botón** "← Volver a arreglar" · **no existe ningún elemento que exporte** · clic FUERA del modal = vuelve (no exporta).

### ☐ 2 · YELLOW — override auditado con nota
**Pasos:** quita el término del guion (guion limpio) → exporta de nuevo → canal **sleep_en_main** → en **Descripción** escribe `this video cures insomnia forever` → ↻ Re-evaluar → escribe una nota en "motivo del override (opcional)" → **"Anular y continuar →"**.
**Esperado:** semáforo **● REVISAR** amarillo · chip `[description] «cures insomnia» · regla mc-en-001` · tras Anular: aparece el **gate legacy** (el viejo modal 🛡️ si score<72) · snippet de overrides muestra **+1 entrada** `{risk:'yellow', reasons, similarityScore, note:"<tu nota>", videoName, exportCfg:{res,fps,fmt}}`.

### ☐ 3 · GREEN — paso limpio
**Pasos:** borra la descripción → ↻ Re-evaluar.
**Esperado:** **● OK** verde · reason "Sin términos de riesgo…" · botón único **"Continuar →"** → entra al flujo legacy.

### ☐ 4 · LEGACY INTACTO ≥72 — export directo
**Pasos:** aplica **⚡ EDICIÓN AUTOMÁTICA** (o 🚀 PRO) hasta que el HUD marque **≥72** → exporta → panel green → Continuar.
**Esperado:** el export **ARRANCA DIRECTO** (barra de progreso), **sin segundo modal** — el camino ≥72 quedó byte-idéntico.

### ☐ 5 · LEGACY INTACTO <72 — el escudo viejo aparece igual
**Pasos:** recarga la página, carga el video SIN aplicar AUTO (HUD <72) → exporta → green → Continuar.
**Esperado:** aparece el **viejo modal "🛡️ ESCUDO ANTI-DESMONETIZACIÓN"** exactamente como siempre (score/100, factores ✗, "Exportar igual →" / "← Volver a arreglar").

### ☐ 6 · FALLO DEL MOTOR — fail-open auditado (simulación NO destructiva)
**Pasos:** en la Console del editor pega:
```js
NSPPolicy.evaluatePackage = () => Promise.reject(new Error('SIM'))
```
→ exporta (idealmente con HUD ≥72 del caso 4).
**Esperado:** el panel policy NO aparece; se abre el **gate legacy INCLUSO con ≥72**, mostrando el factor extra `✗ ⚠ Policy engine no disponible (export sin auditar)` · console: `[POLICY] motor no disponible → fail-open: SIM` · snippet de overrides muestra **+1 evento** `{risk:'engine_error', reason:'SIM', videoName}` · "Exportar igual →" **sí exporta** (fail-open).
**Restaurar:** **recarga la página del editor** (F5) — el parche del console vive solo en esa sesión de página.

### ☐ 7 · HUD LIMPIO tras restaurar
**Pasos:** tras el F5 del caso 6, mira el HUD del medidor (arriba) y aplica AUTO si quieres refrescarlo.
**Esperado:** solo los **7 factores normales** — el factor ⚠ inyectado era display-only del modal y **no persistió** en HUD ni en storage (verifica que overrides solo tiene el evento engine_error, nada más raro).

### ☐ 8 · ESCRITURA DE CORPUS en export real
**Pasos:** canal **sleep_en_main** + guion ≥50 palabras + título en el panel (déjalo o edítalo) → green/yellow → continúa → completa un export PEQUEÑO (resolución mínima del panel CapCut para que sea rápido).
**Esperado:** al terminar: console `[POLICY corpus] guion añadido al corpus del canal (count=1)` · snippet de corpus: `sleep_en_main: [{t:"<tu título>", ts, ng:1, vec:{...}}]` (+1 entrada, `ng:1`, y `vec` son tokens→números, NUNCA el guion).

### ☐ 9 · RE-EXPORT sin cambios — dedupe
**Pasos:** sin tocar nada, exporta el MISMO video otra vez (mismo título).
**Esperado:** console `[POLICY corpus] re-export detectado → ts actualizado, SIN duplicar (count=1)` · snippet: **count igual**, `ts` más nuevo.

### ☐ 10 · ITERACIÓN end-to-end (Enmiendas A/B)
**Pasos:** edita ~15% de las palabras del guion (sinónimos, un par de frases), **MISMO título** → exporta → en el panel ↻ Re-evaluar.
**Esperado:** similitud **BAJA** (su propia versión queda EXCLUIDA del cálculo — no hay falso yellow) → **green** → continúa y completa el export → snippet de corpus: **count SIN subir**, `ts` nuevo, y la similitud de una evaluación posterior contra este guion refleja la versión NUEVA (vec reemplazado in-place).
*Nota esperada (cosmética, no es fallo):* en el replace el console dice "guion añadido al corpus (count=1)" aunque técnicamente REEMPLAZÓ — el count sin subir es la prueba real. Pulido del texto queda para Fase 3.

### ☐ 11 · REACTIVIDAD del Re-evaluar
**Pasos:** en el panel, pega en Descripción `replaces medication` → ↻ Re-evaluar → luego bórrala → ↻ Re-evaluar.
**Esperado:** flip a **yellow** con chip `[description]` → flip de vuelta a **green**. Cada Re-evaluar emite su línea `[POLICY calib] …` (el log de calibración crece, cap 10).

### ☐ 12 · PERSISTENCIA + DISCLOSURE
**Pasos:** con un canal elegido, **F5** a la página del editor → exporta de nuevo.
**Esperado:** el panel abre con **el mismo canal preseleccionado** (snippet: `localStorage.getItem('nsp_ms_policy_channel')` → `{"channelKey":"…","lang":"…"}`) · la línea **"📢 … contenido alterado o sintético …" está visible en LOS TRES estados** (revísala en los casos 1, 2 y 3).

---

## Reporte final

Pega aquí: (a) los checkboxes 1-12, (b) el output de los 4 snippets de storage al terminar, (c) las líneas `[POLICY calib]` y `[POLICY corpus]` de tu consola. **12/12 PASS = Fase 2 CERRADA.**

**Carry-overs ya registrados (no son parte de este smoke):**
- Recalibración del umbral 55 con las primeras ~10 entradas reales de `nsp_policy_calib_log`.
- Sub-paso 2b (advertiserRisk vía SW) con **matching de identidad de canal** — GO propio (ver warning en SYSTEM.md: nichoEntry = canales ajenos).
