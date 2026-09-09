# Mejoras pendientes — listas para tu OK

Actualizado en v4.85.1 (2026-07-06). De los 4 ítems originales, **3 ya están aplicados y verificados en el código** — solo queda 1 decisión tuya.

---

## 1. ⭐ Voz del avatar perdida en el export — NIVEL 1 (aviso) ✅ BAJO RIESGO — ÚNICO PENDIENTE
**Archivo:** `monetize-studio/app.js` (`encodeAudioThenFinish`)

**Problema:** subís un avatar `.mp4` con voz + activás "🔊 Incluir voz del avatar" → el video sale SIN esa voz y SIN aviso. Causa: `decodeAudioData()` corre sobre el `.mp4` de VIDEO entero; Chrome suele rechazarlo y el `.catch(()=>null)` lo anula en silencio.

**Parche Nivel 1 (aditivo, solo avisa en el fallo):**
```js
Promise.all([_voiceP, wantAvatar ? decodeUrl(_avatarObjUrl) : Promise.resolve(null)]).then(function (bufs) {
  var voiceBuf = bufs[0], avatarBuf = bufs[1];
  if (wantAvatar && !avatarBuf) {
    try { nspEdToast('⚠ No pude extraer el audio del .mp4 del avatar — subí su voz como MP3 aparte; el video saldrá sin la voz del avatar.', 'error', 7000); } catch (e) {}
    try { $('footNote').textContent = '⚠ Avatar sin audio (el .mp4 no se pudo decodificar).'; } catch (e) {}
  }
```
**Riesgo:** mínimo (solo un toast en el path de fallo). **NIVEL 2 (fix real):** capturar el audio en realtime y cachearlo — requiere prueba con avatar real.

---

## Resueltos desde la versión anterior de este doc
- **Dead-code `renderCard`** — eliminado al reescribirse `country-feed.js` (el archivo nuevo no lo contiene).
- **Auto-refresh pisando la multi-selección** — aplicado y MÁS fuerte que lo propuesto: `dashboard.js` L1154 saltea el reload con pestaña oculta Y con selección activa; `niches.js` L416 con guardia de visibilidad.
- **`ASHLYV_OPEN` sin validar URL** — aplicado en `service-worker.js` L830: solo URLs internas de la extensión o youtube.com.

## Otros pendientes de tu OK (no-código)
- **5 MB de archivos `.bak` muertos** en la carpeta (4 respaldos del bundle de junio + `options.html.bak` + `competitorfinder.js.bak`): viajan al socio por Dropbox como peso muerto. Con tu OK los muevo FUERA de la carpeta compartida (no los borro).
