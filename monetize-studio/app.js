/* ZERACK · Monetize Studio v2 — editor profesional (estilo CapCut), 100% local.
 * Motor de render por frames (canvas) que potencia preview en vivo + export.
 * Modos AUTO / MANUAL · recorte · texto animado · zoom keyframes · grados de color ·
 * efectos (viñeta/grain/shake/flash/pulse) · subtítulos automáticos · música · análisis.
 */
(function () {
  'use strict';
  var APP_VER = 'v4.92.1';   // ⬅ se muestra arriba-derecha; si NO ves este número, la extensión no se recargó (chrome://extensions → ↻)
  var $ = function (id) { return document.getElementById(id); };
  var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

  // ── CAJA NEGRA del armado: cada fase se persiste al instante. Si la página muere a mitad del
  // build (memoria / kill de Chrome), al reabrir el editor un banner dice EXACTO dónde murió y
  // con qué versión — se acabó adivinar. Se marca 'done' al terminar bien.
  var _bboxLastPhase = '';
  function bbox(phase, detail) {
    try {
      if (phase === _bboxLastPhase && phase !== 'done') {
        var prev = JSON.parse(localStorage.getItem('nsp_build_blackbox') || '{}');
        prev.detail = String(detail || ''); prev.ts = Date.now();
        localStorage.setItem('nsp_build_blackbox', JSON.stringify(prev));
        return;
      }
      _bboxLastPhase = phase;
      localStorage.setItem('nsp_build_blackbox', JSON.stringify({ v: APP_VER, phase: String(phase || ''), detail: String(detail || ''), ts: Date.now() }));
    } catch (eBB) {}
  }
  function _memTag() {
    try { var m = performance.memory; return m ? (' · ' + Math.round(m.usedJSHeapSize / 1048576) + '/' + Math.round(m.jsHeapSizeLimit / 1048576) + 'MB') : ''; } catch (eM) { return ''; }
  }
  function _pcm16Window(p, startSec, durSec) {
    var sr = p.sampleRate, a = Math.max(0, Math.floor(startSec * sr));
    var b = durSec == null ? p.length : Math.min(p.length, a + Math.ceil(durSec * sr));
    var n = Math.max(1, b - a), ab = ensureAudio().createBuffer(1, n, sr), d = ab.getChannelData(0), s = p.i16;
    for (var i = 0; i < n; i++) d[i] = (s[a + i] || 0) / 32768;
    return ab;
  }
  function bboxCheckCrash() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem('nsp_build_blackbox') || 'null'); } catch (eBC) {}
    if (!d || d.phase === 'done' || !d.phase) return;
    if (d.v && d.v !== APP_VER) {
      try { localStorage.removeItem('nsp_build_blackbox'); } catch (eOV) {}
      console.log('[caja negra] registro de la versión anterior (' + d.v + ') descartado — ya corrés ' + APP_VER + ' con ese problema atendido.');
      return;
    }
    var bar = el('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#2a0505;color:#ffd7d7;border-bottom:2px solid #ff4d4d;padding:10px 44px 10px 14px;font:13px "Aptos","Segoe UI",Arial;line-height:1.5;';
    var when = d.ts ? new Date(d.ts).toLocaleTimeString() : '?';
    bar.appendChild(el('b', null, '⚠ El armado anterior se cortó a mitad de camino. '));
    bar.appendChild(el('span', null, 'Murió en la fase: "' + d.phase + (d.detail ? ' — ' + d.detail : '') + '" · versión ' + (d.v || '?') + ' · ' + when + '. Pasale este dato exacto a Claude.'));
    var x = el('button', null, '✕');
    x.style.cssText = 'position:absolute;right:10px;top:8px;background:none;border:1px solid #ff4d4d;color:#ffd7d7;border-radius:4px;cursor:pointer;padding:2px 8px;';
    x.addEventListener('click', function () { bar.remove(); try { localStorage.removeItem('nsp_build_blackbox'); } catch (eX) {} });
    bar.appendChild(x);
    document.body.appendChild(bar);
  }
  try { bboxCheckCrash(); } catch (eBI) {}

  // ── DOM ──
  var fileInput = $('fileInput'), drop = $('drop'), scriptInput = $('scriptInput');
  var loadView = $('loadView'), editorView = $('editorView');
  var srcVideo = $('srcVideo'), stage = $('stage'), ctx = stage.getContext('2d');
  var avatarVid = $('avatarVid');   // overlay de avatar (video talking-head o imagen) encima de las imágenes
  var _avatarObjUrl = null, _avatarImg = null, _avatarReady = false;
  var btnPlay = $('btnPlay'), curTime = $('curTime'), durTime = $('durTime'), scrub = $('scrub');
  var tlRuler = $('tlRuler'), tlPlayhead = $('tlPlayhead'), tlTrack = $('tlTrack'), trimInfo = $('trimInfo');
  var toolTabs = $('toolTabs'), toolPanel = $('toolPanel'), modeBadge = $('modeBadge');
  var btnModeAuto = $('btnModeAuto'), btnModeManual = $('btnModeManual');
  var btnExport = $('btnExport'), renderProgress = $('renderProgress'), rpFill = $('rpFill'), rpText = $('rpText');
  var btnAnalyze = $('btnAnalyze'), btnReset = $('btnReset');
  var analyzerModal = $('analyzerModal'), analyzerClose = $('analyzerClose'), report = $('report');
  var monetHud = $('monetHud'), mhScore = $('mhScore'), mhVerdict = $('mhVerdict'), mhFactors = $('mhFactors'), mhRing = $('mhRing'), mhAnalyze = $('mhAnalyze');
  var musicAudio = $('musicAudio');
  var templatesView = $('templatesView'), btnTemplates = $('btnTemplates'), btnTplBack = $('btnTplBack');
  var tplGrid = $('tplGrid'), btnScanAll = $('btnScanAll'), tplScanStatus = $('tplScanStatus');
  $('ver').textContent = APP_VER;
  // HANDOFF desde las herramientas ZERACK (ScriptPilot / MotionForge / AutoPilot): si mandaron un guion, lo precargo.
  try { var _ho = localStorage.getItem('zerack_handoff_script'); if (_ho && scriptInput && !scriptInput.value.trim()) { scriptInput.value = _ho; localStorage.removeItem('zerack_handoff_script'); if (typeof footNote !== 'undefined') {} setTimeout(function () { try { $('footNote').textContent = '✓ Guion recibido de ZERACK — subí tus imágenes/audio para crear el video.'; } catch (e) {} }, 300); } } catch (e) {}
  var pendingTemplate = null, _tplBuilt = false;

  // ── Estado del proyecto ──
  var ST = { name: '', dur: 0, vw: 0, vh: 0, ready: false, playing: false, rendering: false, activeTool: 'auto' };
  var P = null;
  function freshProject() {
    return {
      mode: 'auto', trimStart: 0, trimEnd: ST.dur, aspect: 'src',
      kenBurns: true, kbIntensity: 0.55, pulse: true, pulseEvery: 22,
      // POR-IMAGEN (slideshow): el video se arma con N imágenes fijas de igual duración.
      // shotMode=true ⇒ Ken Burns REINICIA en cada imagen (movimiento fresco y variado por toma);
      // shotMode=false ⇒ una sola rampa en todo el video (comportamiento original = FALLBACK).
      shotMode: false, shotSecs: 4, shotTrans: true, shotTransKind: 'mix',
      zooms: [], grade: 'cinematic',
      tracks: null, _kf: false,   // motor de keyframes: tracks=pistas animables; _kf=true cuando el motor está activo (si no, fallback al look viejo)
      // tracksEdited[prop]=true ⇒ "el generador YA NO POSEE esta pista" (NO verdad permanente; deja la puerta abierta a override).
      // rotation/opacity nacen poseídas-por-el-usuario (el generador nunca las emite).
      tracksEdited: { scale: false, panX: false, panY: false, rotation: true, opacity: true },
      vignette: false, grain: false, shake: false, flashes: [],
      // CALLOUTS de momento clave (fechas/cifras): capa de énfasis sparse sobre P.texts.
      callout: { on: false, max: 6, gapSecs: 12, color: '#FFE14D', pos: 0.80 },
      // CINE VIVO: convierte imágenes estáticas en "video filmado" — deriva de cámara + parallax + partículas
      // atmosféricas + luz volumétrica en movimiento. Cada frame distinto = NO se lee como foto reusada.
      liveFilm: { on: false, intensity: 0.6, secs: 0, particles: true, lightRay: false, dust: true },
      embers: { on: false, intensity: 0.6 },   // brasas/cenizas de fuego que suben (nicho "historias para dormir" / chimenea)
      avatar: { on: false, kind: null, name: '', pos: 'br', scale: 0.30, shape: 'rect', round: 16, border: true, opacity: 1, mode: 'always', onSecs: 8, offSecs: 6, segs: [], audio: false, audioVol: 1 },   // overlay de avatar (audio: incluir su voz en el export)
      // BREATHING: zoom infinito que nunca para — acerca y retrocede en bucle (siempre activo en AUTO).
      breath: { on: false, amt: 0.06, period: 5 },
      // SEGUIR PERSONAJE: detección de caras (face-api local) → zoom a la cara + flecha + anillo.
      // faceShots = [{t, x, y, w, h}] en coords 0..1 del frame; se rellena al escanear.
      face: { on: false, mode: 'both', zoom: 1.7, hold: 2.2, scanned: false, shots: [] },
      // SEÑALAR (anotaciones manuales): flechas / círculos / cajas que VOS colocás clickeando el canvas.
      // annos = [{id, kind:'arrow'|'circle'|'box', x,y (0..1 destino), ang (flecha), r (tamaño), start, end, color}]
      annos: [],
      transition: 'mix', transEvery: 4, transitions: [], fx: { letterbox: false, lightLeak: false, chroma: false },
      texts: [], captions: [], capStyle: { size: 1, color: '#FFFFFF', box: true, posY: 0.86, hi: true, hiColor: '#FFD93D', tpl: 'clasico', font: 'black', upper: false, boxStyle: 'solid', stroke: 0.16, glow: null },
      speed: 1, music: { name: '', buffer: null, vol: 0.28, origVol: 1.0 },
      brand: { text: '', logo: null, pos: 'br', opacity: 0.85, size: 1 }, progressBar: false, progressColor: '#00DC82',
      intro: { on: false, title: '', sub: '', secs: 2.5 },
      outro: { on: false, title: 'SUSCRÍBETE 🔔', sub: 'Mirá el próximo video →', secs: 4 }
    };
  }

  var GRADES = {
    none: { label: 'Ninguno', filter: 'none', wash: null },
    cinematic: { label: 'Cine', filter: 'contrast(1.22) saturate(1.06) brightness(1.03)', wash: 'rgba(12,28,52,0.16)' },
    vibrant: { label: 'Vibrante', filter: 'saturate(1.45) contrast(1.12)', wash: null },
    warm: { label: 'Cálido', filter: 'saturate(1.2) sepia(0.18) brightness(1.03)', wash: 'rgba(255,150,40,0.08)' },
    cold: { label: 'Frío', filter: 'saturate(1.1) hue-rotate(-8deg) contrast(1.05)', wash: 'rgba(40,120,255,0.08)' },
    vintage: { label: 'Vintage', filter: 'sepia(0.4) contrast(0.95) brightness(1.02)', wash: 'rgba(120,90,40,0.10)' },
    noir: { label: 'B/N', filter: 'grayscale(1) contrast(1.15)', wash: null },
    punch: { label: 'Punch', filter: 'saturate(1.3) contrast(1.25) brightness(1.04)', wash: null }
  };

  // ── Utils ──
  function fmt(s) { s = Math.max(0, Math.round(s || 0)); var m = Math.floor(s / 60); return m + ':' + ('0' + (s % 60)).slice(-2); }
  function fmtB(b) { if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB'; if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB'; return Math.round(b / 1e3) + ' KB'; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function uid() { return 'x' + (Math.floor((performance.now() % 1e7) * 1000) % 1e9).toString(36); }

  // ── Carga de archivo ──
  var _srcObjUrl = null;
  var _slideshowPerImg = 0;   // >0 cuando el video actual se armó desde imágenes (segundos por foto)
  var _isSlideshow = false;   // el video cargado es un slideshow nuestro (slideshow.mp4) → export por SEEK (no por reproducción)
  var _exDiskStream = null;   // FileSystemWritableFileStream: escribir el MP4 DIRECTO a disco (videos largos 7h+) sin llenar la RAM
  var _slideshowSecPer = 0;   // segundos por imagen del slideshow cargado (para el export por seek)
  var _slideshowTimeline = null;   // tramos {start,end,img} REALES del build preciso — el export por seek y los cortes/Ken Burns los respetan; null = rejilla clásica
  var _slideshowFresh = false;   // true SOLO entre finishMux y su loadFile: distingue el build recién armado de un slideshow.mp4 cargado a mano
  var _pendingAudioFile = null, _pendingAudioBuf = null;   // narración (voz en off) para el modo imágenes→video
  var _audioDecoding = false;   // true mientras los audios se leen/unen — CREAR espera a que termine (si no, el video salía MUDO en silencio)
  var _scriptAutoFilled = false;   // el guion lo puse YO desde una transcripción — al cambiar de audio se limpia solo (guion viejo = subtítulos de OTRO audio)
  var _capsInFlight = false;   // el motor de voz sigue escuchando en el worker — EXPORTAR avisa antes de sacar un MP4 sin subtítulos que estaban por llegar
  var _txProgressHook = null;   // durante el plan de CREAR apunta a safePct: el progreso de la transcripción que arrancó AL SUBIR mantiene vivo el plazo del plan
  var _pendingAudioCaptionsP = null;   // Promise → subtítulos transcritos de la voz (Groq Whisper)
  // Audio LARGO transcrito por ventanas (sparse): cada ventana de ~12 s trae un bloque de texto.
  // Como subtítulo un bloque de 12 s es ilegible → se parte en frases repartidas DENTRO de su ventana
  // (proporcional por palabras; en CJK por caracteres). Entre ventanas no se inventa nada.
  function splitSparseCaps(caps) {
    var out = [];
    (caps || []).forEach(function (c) {
      var span = Math.max(0.6, (Number(c.end) || 0) - (Number(c.start) || 0));
      var sents = String(c.text || '').split(/(?<=[.!?…])\s+|(?<=[。！？])\s*|\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!sents.length) return;
      function wgt(s) { return /[぀-ヿ㐀-鿿가-힯]/.test(s) ? s.length : (s.split(/\s+/).length || 1); }
      var totalW = sents.reduce(function (a, s) { return a + wgt(s); }, 0) || 1;
      var t = Number(c.start) || 0;
      sents.forEach(function (s) {
        var d = span * (wgt(s) / totalW);
        out.push({ text: s, start: t, end: Math.min((Number(c.start) || 0) + span, t + d) });
        t += d;
      });
    });
    return out.length ? out : (caps || []);
  }
  function loadFile(file) {
    if (!file) return;
    if (/^audio\//.test(file.type) || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(file.name || '')) { setNarration([file]); return; }
    if (!/^video\//.test(file.type)) { alert('Ese archivo no es un video. La narración (MP3/WAV) va en el recuadro 1 y las fotos en el recuadro 2.'); return; }
    stopPlay();
    if (_srcObjUrl) { try { URL.revokeObjectURL(_srcObjUrl); } catch (e) {} }   // liberar el video anterior (sin fugas de memoria)
    ST.name = file.name; ST.ready = false;
    _isSlideshow = /slideshow\.mp4$/i.test(file.name || '');   // nuestro slideshow → export por SEEK (no por reproducción, que salta)
    // El timeline preciso pertenece SOLO al build recién armado en esta sesión: un slideshow cargado a
    // mano (archivo viejo) no trae mapa de cortes → rejilla clásica, jamás el timeline de otro video.
    if (!_isSlideshow || !_slideshowFresh) _slideshowTimeline = null;
    _slideshowFresh = false;
    _srcObjUrl = URL.createObjectURL(file);
    srcVideo.src = _srcObjUrl;
    srcVideo.onloadedmetadata = function () {
      ST.dur = srcVideo.duration || 0; ST.vw = srcVideo.videoWidth || 1280; ST.vh = srcVideo.videoHeight || 720; ST.ready = true;
      if (_slideshowTimeline && _slideshowTimeline.length && Math.abs(_slideshowTimeline[_slideshowTimeline.length - 1].end - ST.dur) > 2) _slideshowTimeline = null;
      P = freshProject(); P.trimEnd = ST.dur;   // crear P ANTES de medir el lienzo (si no, hereda el aspect del video anterior)
      computeStageSize();
      btnAnalyze.disabled = false; btnReset.hidden = false;
      durTime.textContent = fmt(ST.dur);
      // RED DE SEGURIDAD: si el video base se armó MÁS CORTO que tu narración, avisar AHORA (no tras exportar 36 min).
      try {
        if (_isSlideshow && _pendingAudioBuf && _pendingAudioBuf.duration > 0.5 && ST.dur > 0 && ST.dur < _pendingAudioBuf.duration * 0.8) {
          var _vmin = Math.round(ST.dur / 60), _amin = Math.round(_pendingAudioBuf.duration / 60);
          $('footNote').textContent = '⚠ El video base salió de ' + _vmin + ' min pero tu audio dura ' + _amin + ' min — recargá y volvé a armar.';
          alert('⚠ OJO antes de exportar:\n\nEl video base se armó de ~' + _vmin + ' min, pero tu narración dura ~' + _amin + ' min. Si exportás así, saldría cortado.\n\nRecargá la extensión (chrome://extensions → ↻) y volvé a armar. Si vuelve a pasar, avisame con estos dos números.');
        }
      } catch (e) {}
      // SLIDESHOW: si el video lo armamos desde imágenes, alinear el corte por-imagen con la duración real de cada foto.
      if (_slideshowPerImg > 0) { P.shotMode = true; P._autoTouchedShot = true; P.shotSecs = Math.round(_slideshowPerImg * 10) / 10; }
      applyMode('auto');
      // SLIDESHOW · SUBTÍTULOS: 1º la transcripción REAL de tu voz (sincronizada con timestamps);
      // si no hay (sin API key / falló), uso el guion pegado. La transcripción llega async → al resolver, repinto.
      if (_slideshowPerImg > 0) {
        if (_pendingAudioCaptionsP) {
          _pendingAudioCaptionsP.then(function (resTx) {
            if (resTx && resTx.caps && resTx.caps.length) {
              P.captions = resTx.sparse ? splitSparseCaps(resTx.caps) : resTx.caps;
              if (resTx.text && !(scriptInput.value || '').trim()) {   // el texto transcrito habilita carteles + flechas también
                scriptInput.value = resTx.text;
                _scriptAutoFilled = true;
                try { applyCallouts(); applyArrowCallouts(); } catch (e) {}
              }
              try { var _fnCaps = $('footNote'); if (_fnCaps) _fnCaps.textContent = '✓ ' + P.captions.length + ' subtítulos desde tu voz (timestamps reales).'; } catch (eFc) {}
            } else if ((scriptInput.value || '').trim() && !P.captions.length) {
              if (!(P.captions && P.captions.length)) P.captions = genCaptions();
            }
            try { zRebuildTracks(); } catch (e) {}
            try { renderTimeline(); repaint(); updateMonetHud(); } catch (e) {}
          });
        } else if ((scriptInput.value || '').trim() && !P.captions.length) {
          if (!(P.captions && P.captions.length)) P.captions = genCaptions();
        }
      }
      _slideshowPerImg = 0;   // reset (la próxima carga normal de video no lo usa)
      seekTo(P.trimStart);
      setTool('auto');
      renderTimeline();
      showView('editor');
      updateMonetHud();
      if (pendingTemplate) { var pt = pendingTemplate; pendingTemplate = null; applyTemplate(pt); }
    };
    srcVideo.onerror = function () { alert('No pude leer ese video. Probá con MP4.'); };
  }

  // ── CUADRAR IMÁGENES CON LA VOZ: la IA "mira" cada imagen y la pone cuando la narración habla de eso ──
  function _imgToB64(bm) {
    var W = 256, H = Math.max(1, Math.round(W * (bm.height || 9) / (bm.width || 16)));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    try { c.getContext('2d').drawImage(bm, 0, 0, W, H); return c.toDataURL('image/jpeg', 0.7).split(',')[1] || ''; } catch (e) { return ''; }
  }
  var _STOP_KW = { para: 1, como: 1, este: 1, esta: 1, esto: 1, pero: 1, porque: 1, cuando: 1, donde: 1, sobre: 1, entre: 1, desde: 1, hasta: 1, todo: 1, todos: 1, todas: 1, mas: 1, the: 1, that: 1, with: 1, this: 1, from: 1, into: 1, your: 1, they: 1, have: 1, will: 1, ellos: 1, ellas: 1, unos: 1, unas: 1, hacia: 1, segun: 1, aunque: 1, tambien: 1 };
  function _kwSet(s) {
    var o = {};
    String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).forEach(function (w) {
      if (!w) return;
      if (/[぀-ヿ㐀-鿿가-힯豈-﫿]/.test(w)) {
        if (w.length === 1) { o[w] = 1; return; }
        for (var i = 0; i < w.length - 1; i++) o[w.slice(i, i + 2)] = 1;
      } else if (w.length > 3 && !_STOP_KW[w]) o[w] = 1;
    });
    return o;
  }
  function _kwOverlap(a, b) { var n = 0; for (var k in a) { if (b[k]) n++; } return n; }
  // Gemini describe TODAS las imágenes (en lotes de 5) → array de strings de keywords (qué muestra cada una).
  function describeImagesGemini(bmps, key, prog, lang) {
    var BATCH = 5, out = new Array(bmps.length).fill(''), bstart = 0;
    return new Promise(function (resolve) {
      (function nextBatch() {
        if (bstart >= bmps.length) { resolve(out); return; }
        if (prog) prog(bstart, bmps.length);
        var slice = bmps.slice(bstart, bstart + BATCH), base = bstart, parts = [];
        slice.forEach(function (bm) { var d = _imgToB64(bm); if (d) parts.push({ inline_data: { mime_type: 'image/jpeg', data: d } }); });
        if (!parts.length) { bstart += BATCH; nextBatch(); return; }
        var kwLang = (lang && lang !== 'auto') ? String(lang).slice(0, 8) : 'es';
        parts.push({ text: 'Son ' + slice.length + ' imágenes EN ORDEN. Para CADA una devolvé 4-6 palabras clave de QUÉ muestra (objetos, lugar, acción, tema), escritas en el idioma de código ISO "' + kwLang + '". Devolvé SOLO un JSON array de strings (una por imagen, mismo orden). Ej: ["castillo medieval, noche, niebla","bosque, río, sol"]' });
        var body = { contents: [{ parts: parts }], generationConfig: { temperature: 0.2 } };
        var models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'], mi = 0;
        (function tryM() {
          if (mi >= models.length) { bstart += BATCH; nextBatch(); return; }   // lote falló → seguir (esas quedan sin kw)
          var m = models[mi++];
          fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), 45000, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { if (!r.ok) throw 0; return r.json(); })
            .then(function (j) {
              var t = ''; try { t = j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join(''); } catch (e) {}
              var arr = null, mm = t.match(/\[[\s\S]*\]/); if (mm) { try { arr = JSON.parse(mm[0]); } catch (e) {} }
              if (arr && arr.length) { for (var k = 0; k < arr.length && (base + k) < out.length; k++) out[base + k] = String(arr[k] || ''); bstart += BATCH; nextBatch(); }
              else tryM();
            }).catch(function () { tryM(); });
        })();
      })();
    });
  }
  // Plan: por cada tramo de tiempo (slot de ~secPer), elige la imagen que MEJOR cuadra con lo que se dice ahí.
  function planImageSlots(nImgs, caps, imgKw, secPer, totalDurSec) {
    var nSlots = Math.max(nImgs, Math.ceil(totalDurSec / Math.max(0.5, secPer)));
    var imgSets = (imgKw || []).map(_kwSet);
    if (!imgSets.some(function (s) { return Object.keys(s).length; })) return null;   // la IA no describió nada útil → ciclo normal
    var assign = new Array(nSlots), used = new Array(nImgs).fill(0), prev = -1, rr = 0, matched = 0, prevFiller = false;
    for (var s = 0; s < nSlots; s++) {
      var a = s * secPer, b = a + secPer, txt = '';
      (caps || []).forEach(function (c) { if (c.end > a && c.start < b) txt += ' ' + (c.text || ''); });
      var sk = _kwSet(txt), best = -1, bestSc = 0;
      for (var i = 0; i < nImgs; i++) {
        var sc = _kwOverlap(imgSets[i], sk);
        if (sc <= 0) continue;
        if (used[i] === 0) sc += 0.6;   // prioriza que TODAS aparezcan al menos una vez
        if (i === prev && !prevFiller) sc -= 2;   // no repetir la misma seguida (salvo que la anterior fuera relleno)
        sc -= used[i] * 0.08;           // suaviza el sobre-uso
        if (sc > bestSc) { bestSc = sc; best = i; }
      }
      if (best < 0) { best = rr % nImgs; rr++; if (best === prev && nImgs > 1) { best = rr % nImgs; rr++; } prevFiller = true; }   // sin match → round-robin
      else { matched++; prevFiller = false; }
      assign[s] = best; used[best]++; prev = best;
    }
    assign._matched = matched;
    assign._total = nSlots;
    return assign;
  }
  // SINCRONIZACIÓN PRECISA: en vez de rejilla fija, la imagen corta EXACTAMENTE donde la voz cambia
  // de tema (timestamps reales de la transcripción). Cada frase manda; si el tema sigue, la imagen sigue.
  function planImageTimeline(nImgs, caps, imgKw, totalDurSec) {
    if (!caps || !caps.length || nImgs < 2 || !(totalDurSec > 1)) return null;
    var imgSets = (imgKw || []).map(_kwSet);
    if (!imgSets.some(function (s) { return Object.keys(s).length; })) return null;
    var MIN_SHOT = 2.5;
    var sorted = caps.slice().sort(function (a, b) { return (Number(a.start) || 0) - (Number(b.start) || 0); });
    var rawSegs = [];
    for (var i = 0; i < sorted.length; i++) {
      var st = i === 0 ? 0 : Math.max(0, Number(sorted[i].start) || 0);
      var en = i < sorted.length - 1 ? Math.max(st, Number(sorted[i + 1].start) || st) : totalDurSec;
      if (en - st < 0.2) continue;
      rawSegs.push({ start: st, end: en, text: String(sorted[i].text || '') });
    }
    if (!rawSegs.length) return null;
    rawSegs[rawSegs.length - 1].end = Math.max(rawSegs[rawSegs.length - 1].end, totalDurSec);
    var segs = [], cur = null;
    rawSegs.forEach(function (s) {
      if (!cur) { cur = { start: s.start, end: s.end, text: s.text }; return; }
      if ((cur.end - cur.start) < MIN_SHOT) { cur.end = s.end; cur.text += ' ' + s.text; return; }
      segs.push(cur); cur = { start: s.start, end: s.end, text: s.text };
    });
    if (cur) {
      if (segs.length && (cur.end - cur.start) < MIN_SHOT) { segs[segs.length - 1].end = cur.end; segs[segs.length - 1].text += ' ' + cur.text; }
      else segs.push(cur);
    }
    if (!segs.length) return null;
    var used = new Array(nImgs).fill(0), prev = -1, rr = 0, matched = 0;
    var tl = segs.map(function (s) {
      var sk = _kwSet(s.text), best = -1, bestSc = 0;
      for (var k = 0; k < nImgs; k++) {
        var sc = _kwOverlap(imgSets[k], sk);
        if (sc <= 0) continue;
        if (used[k] === 0) sc += 0.6;
        if (k === prev) sc += 0.4;
        sc -= used[k] * 0.08;
        if (sc > bestSc) { bestSc = sc; best = k; }
      }
      if (best >= 0) matched++;
      else { best = rr % nImgs; rr++; if (best === prev && nImgs > 1) { best = rr % nImgs; rr++; } }
      used[best]++; prev = best;
      return { start: s.start, end: s.end, img: best };
    });
    tl._matched = matched;
    tl._total = tl.length;
    return tl;
  }

  // ── MODELO LOCAL GRATIS (MobileNet / TensorFlow.js): entiende cada imagen SIN API key, SIN costo ──
  // Se carga SOLO cuando se usa (lazy) para no pesar en la edición normal ni chocar con face-api.
  // La visión local corre en un IFRAME propio: face-api (index.html) trae SU TensorFlow embebido
  // y registra el motor global — MobileNet encima de ese motor viejo revienta ("n is not a function").
  // En ventana aparte cada librería vive con su propio tf y no chocan. Mismo modelo, mismos pesos.
  var _mnetFrame = null, _mnetFrameP = null, _mnetDead = false, _mnetPend = {}, _mnetSeq = 0;
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.nsp !== 'mnet' || d.type !== 'labels') return;
    if (!_mnetFrame || ev.source !== _mnetFrame.contentWindow) return;
    var cb = _mnetPend[d.id];
    delete _mnetPend[d.id];
    if (cb) cb(String(d.labels || ''));
  });
  function ensureMnetFrame() {
    if (_mnetFrame) return Promise.resolve(_mnetFrame);
    if (_mnetDead) return Promise.reject(new Error('vision local no disponible'));
    if (_mnetFrameP) return _mnetFrameP;
    var base = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('lib/mobilenet/') : '../lib/mobilenet/';
    _mnetFrameP = new Promise(function (res, rej) {
      var fr = document.createElement('iframe');
      fr.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0';
      var done = false;
      var to = setTimeout(function () { fin(new Error('vision local: timeout de carga')); }, 30000);
      function fin(err) {
        if (done) return;
        done = true;
        clearTimeout(to);
        window.removeEventListener('message', onMsg);
        if (err) {
          _mnetDead = true;
          _mnetFrameP = null;
          try { fr.remove(); } catch (eR) {}
          console.log('[ZERACK editor] IA visual local no disponible — matching por keywords/Gemini. Motivo: ' + String(err && err.message || err).slice(0, 160));
          rej(err);
        } else {
          _mnetFrame = fr;
          res(fr);
        }
      }
      function onMsg(ev) {
        if (ev.source !== fr.contentWindow) return;
        var d = ev.data;
        if (!d || d.nsp !== 'mnet') return;
        if (d.type === 'ready') fin(null);
        else if (d.type === 'dead') fin(new Error(d.err || 'vision local murió al cargar'));
      }
      window.addEventListener('message', onMsg);
      fr.onload = function () { try { fr.contentWindow.postMessage({ nsp: 'mnet', type: 'ping' }, '*'); } catch (eP) { fin(new Error('vision local: sin acceso al frame')); } };
      fr.onerror = function () { fin(new Error('vision local: el frame no cargó')); };
      fr.src = base + 'mnet-frame.html';
      document.body.appendChild(fr);
    });
    return _mnetFrameP;
  }
  // clasifica cada bitmap → string de keywords EN INGLÉS (clases de ImageNet)
  function classifyImagesLocal(bmps, prog) {
    return ensureMnetFrame().then(function (fr) {
      var cv = document.createElement('canvas'), cx = cv.getContext('2d'), out = [];
      function one(i) {
        if (i >= bmps.length) return Promise.resolve(out);
        if (prog) prog(i, bmps.length);
        var bm = bmps[i], S = 224; cv.width = S; cv.height = S;
        var cover = Math.max(S / (bm.width || 1), S / (bm.height || 1)), dw = (bm.width || 1) * cover, dh = (bm.height || 1) * cover;
        cx.drawImage(bm, (S - dw) / 2, (S - dh) / 2, dw, dh);
        var img = cx.getImageData(0, 0, S, S);
        return new Promise(function (res) {
          var id = ++_mnetSeq;
          var to = setTimeout(function () { delete _mnetPend[id]; res(''); }, 20000);
          _mnetPend[id] = function (labels) { clearTimeout(to); res(labels); };
          try { fr.contentWindow.postMessage({ nsp: 'mnet', type: 'classify', id: id, img: img }, '*'); }
          catch (eS) { clearTimeout(to); delete _mnetPend[id]; res(''); }
        }).then(function (labels) { out[i] = labels; return one(i + 1); });
      }
      return one(0);
    });
  }
  // ── Traducción GRATIS (endpoint público de Google Translate, ya permitido) para alinear idiomas ──
  function _gtx(q, sl, tl) {
    return fetchWithTimeout('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=' + tl + '&dt=t&q=' + encodeURIComponent(q), 15000).then(function (r) { return r.json(); });
  }
  function detectTextLang(sample) {
    return _gtx(String(sample || '').slice(0, 280), 'auto', 'en').then(function (j) { try { return j[2] || 'en'; } catch (e) { return 'en'; } }).catch(function () { return 'en'; });
  }
  function translateWords(words, tl) {   // words inglés → tl, en una sola llamada (unidas por \n)
    if (!words.length || tl === 'en') return Promise.resolve(words.slice());
    return _gtx(words.join('\n'), 'en', tl).then(function (j) {
      try { var t = j[0].map(function (seg) { return seg[0]; }).join(''); var p = t.split('\n'); return p.length === words.length ? p : words.slice(); } catch (e) { return words.slice(); }
    }).catch(function () { return words.slice(); });
  }
  // Línea de tiempo del texto: de la transcripción real, o del GUION pegado repartido por la duración (sin key).
  // Resamplea un AudioBuffer (cualquier sample rate) a Float32 mono 16 kHz — formato que pide Whisper.
  function resampleTo16k(buf) {
    if (!buf) return null;
    var isI = !!buf.i16, SC = isI ? (1 / 32768) : 1;
    var src = isI ? buf.i16 : buf.getChannelData(0), srcRate = buf.sampleRate || 22050, dstRate = 16000;
    if (srcRate === dstRate && !isI) return src.slice ? src.slice(0) : new Float32Array(src);
    var ratio = srcRate / dstRate, dstLen = Math.max(1, Math.floor(src.length / ratio)), out = new Float32Array(dstLen);
    for (var i = 0; i < dstLen; i++) { var t = i * ratio, k = t | 0, fr = t - k; out[i] = ((src[k] || 0) * (1 - fr) + (src[k + 1] || 0) * fr) * SC; }
    return out;
  }
  // Transcribe la voz 100% LOCAL con Whisper (sin API, sin key). Late cada 2 s para no cortarse por el tope de tiempo.
  var _whisperCapsP = null;
  var _audioGen = 0;
  function whenWhisperReady(ms, onProgress) {
    if (window.NSP_WHISPER && typeof window.NSP_WHISPER.transcribe === 'function') return Promise.resolve(true);
    if (onProgress) onProgress('Cargando el motor de voz local…');
    return new Promise(function (resolve) {
      var done = false, waited = 0;
      function fin(ok) {
        if (done) return;
        done = true;
        try { window.removeEventListener('nsp-whisper-ready', onReady); } catch (eRm) {}
        clearInterval(tick);
        resolve(ok);
      }
      function onReady() { fin(true); }
      try { window.addEventListener('nsp-whisper-ready', onReady); } catch (eAd) {}
      var tick = setInterval(function () {
        waited += 500;
        if (window.NSP_WHISPER && typeof window.NSP_WHISPER.transcribe === 'function') { fin(true); return; }
        if (onProgress && waited % 2000 === 0) onProgress('Cargando el motor de voz local… ' + Math.round(waited / 1000) + 's');
        if (waited >= ms) fin(false);
      }, 500);
    });
  }
  function transcribeLocalWhisper(buf, onProgress, hintImgs, shouldStop) {
    if (_whisperCapsP) return _whisperCapsP;
    if (!(buf && buf.duration > 0.5)) return Promise.resolve(null);
    if (!window.NSP_WHISPER || typeof window.NSP_WHISPER.transcribe !== 'function') {
      return whenWhisperReady(25000, onProgress).then(function (ok) {
        if (!ok || (shouldStop && shouldStop())) return null;
        return transcribeLocalWhisper(buf, onProgress, hintImgs, shouldStop);
      });
    }
    var dur = buf.duration, SR = 16000;
    // Sin worker vivo, Whisper correría en el hilo principal: con audio largo son MINUTOS de página
    // congelada (Chrome la mata). Antes que eso, se salta la transcripción: el video se arma igual
    // (reparto clásico + guion si hay) y la página NUNCA muere. Audio corto (≤90s) inline es tolerable.
    var _wkOk = !!(window.NSP_WHISPER.workerAlive && window.NSP_WHISPER.workerAlive());
    if (!_wkOk && dur > 90) return Promise.resolve(null);
    var modelProg = function (p) { if (onProgress && p && p.status === 'progress' && p.file) onProgress('Cargando motor de voz local ' + Math.round(p.progress || 0) + '% (solo la 1ª vez)…'); };
    if (dur <= 600) {
      var pcm = resampleTo16k(buf);
      if (!pcm || !pcm.length) return Promise.resolve(null);
      var beat = null;
      if (onProgress) { var n = 0; beat = setInterval(function () { n++; onProgress('Escuchando tu audio (IA local, 0 API) ' + (n * 2) + 's…'); }, 2000); }
      _whisperCapsP = window.NSP_WHISPER.transcribe(pcm, { onModelProgress: modelProg }).then(function (res) {
        if (beat) clearInterval(beat);
        return (res && res.caps && res.caps.length) ? res : null;
      }).catch(function (e) {
        if (beat) clearInterval(beat);
        console.warn('[whisper-local]', e && e.message);
        _whisperCapsP = null;
        return null;
      });
      return _whisperCapsP;
    }
    // AUDIO LARGO (>10 min): no se transcribe entero (tardaría horas) — se ESCUCHAN ventanas de 12 s
    // repartidas por TODO el audio (≈ una por imagen): suficiente para saber de qué habla cada tramo, en minutos.
    // Cada ventana se remuestrea DIRECTO del buffer fuente (antes se materializaba el audio ENTERO a
    // 16 kHz: 2 h = ~460 MB de golpe en RAM justo al arrancar el armado — pico que mataba la pestaña).
    var _isI = !!buf.i16, _SC = _isI ? (1 / 32768) : 1;
    var srcCh = _isI ? buf.i16 : buf.getChannelData(0), srcRate = buf.sampleRate || 22050;
    function sliceTo16k(stSec, lenSec) {
      var a = Math.max(0, Math.floor(stSec * srcRate));
      var b = Math.min(srcCh.length, Math.floor((stSec + lenSec) * srcRate));
      var n = b - a;
      if (n <= 0) return new Float32Array(0);
      var ratio = srcRate / SR, outN = Math.max(1, Math.floor(n / ratio)), out = new Float32Array(outN);
      for (var i = 0; i < outN; i++) { var t = i * ratio, k = t | 0, fr = t - k; out[i] = ((srcCh[a + k] || 0) * (1 - fr) + (srcCh[a + k + 1] || 0) * fr) * _SC; }
      return out;
    }
    // COBERTURA COMPLETA (hasta 4 h): con el worker vivo se escucha TODO el audio en tramos
    // CONTIGUOS de 20 s — subtitulado continuo de punta a punta, sin huecos. El motor midió
    // ~3.7× tiempo real: 3 h de voz ≈ ~50-60 min de escucha en segundo plano, que arranca AL SUBIR.
    // De cada tramo se usan los timestamps REALES por FRASE que Whisper devuelve. Si el worker
    // muere a mitad, se entrega lo acumulado (parcial honesto) — la página NUNCA se congela.
    // Más de 4 h → muestreo repartido (tope 240 tramos, el triple que antes) como red de seguridad.
    var full = _wkOk && dur <= 14400;
    var winLen = full ? 20 : 15;
    var nWin;
    if (full) {
      nWin = Math.max(1, Math.ceil(dur / winLen));
    } else {
      nWin = Math.round(Math.min(3600, Math.max(240, dur * 0.35)) / winLen);
      if (hintImgs > 0) nWin = Math.max(nWin, Math.min(240, hintImgs + 4));
      nWin = Math.min(240, Math.max(20, nWin));
      if (nWin > Math.floor(dur / winLen)) nWin = Math.max(2, Math.floor(dur / winLen));
    }
    var caps = [], texts = [], wi = 0, genLoop = _audioGen;
    function finRes() { return caps.length ? { text: texts.join(' '), caps: caps, sparse: true, full: full } : null; }
    function oneWin() {
      if ((shouldStop && shouldStop()) || _audioGen !== genLoop) { _whisperCapsP = null; return Promise.resolve(null); }
      if (wi >= nWin) return Promise.resolve(finRes());
      if (full && wi > 0 && !(window.NSP_WHISPER.workerAlive && window.NSP_WHISPER.workerAlive())) {
        full = false;
        return Promise.resolve(finRes());
      }
      var st = full ? Math.min(wi * winLen, Math.max(0, dur - 1)) : ((dur - winLen) * (nWin > 1 ? wi / (nWin - 1) : 0));
      if (onProgress) onProgress(full
        ? ('Escuchando TODO tu audio (cobertura completa, IA local) — tramo ' + (wi + 1) + '/' + nWin + '…')
        : ('Escuchando tu audio (IA local, 0 API) — tramo ' + (wi + 1) + '/' + nWin + '…'));
      bbox('escuchando-local', 'tramo ' + (wi + 1) + '/' + nWin + (full ? ' (completa)' : ' (muestreo)') + _memTag());
      if (full && wi > 0 && wi % 10 === 0) {
        try {
          var pmem = performance.memory;
          if (pmem && pmem.usedJSHeapSize > 0.8 * pmem.jsHeapSizeLimit) { full = false; return Promise.resolve(finRes()); }
        } catch (eGm) {}
      }
      wi++;
      return window.NSP_WHISPER.transcribe(sliceTo16k(st, winLen), { onModelProgress: modelProg }).then(function (res) {
        if (res && res.caps && res.caps.length) {
          res.caps.forEach(function (c) {
            var cs = st + Math.max(0, Math.min(winLen, Number(c.start) || 0));
            var ce = st + Math.max(0, Math.min(winLen, Number(c.end) || 0));
            if (ce <= cs) ce = Math.min(st + winLen, cs + 2);
            if (cs >= dur) return;
            if (ce > dur) ce = dur;
            var tx = String(c.text || '').trim();
            if (tx) { caps.push({ text: tx, start: cs, end: ce }); texts.push(tx); }
          });
        } else {
          var t = res && String(res.text || '').trim();
          if (t) { caps.push({ text: t, start: st, end: st + winLen }); texts.push(t); }
        }
        return oneWin();
      }).catch(function () { return oneWin(); });
    }
    _whisperCapsP = oneWin().then(function (res) {
      if (!res) { _whisperCapsP = null; return null; }
      return res;
    });
    return _whisperCapsP;
  }
  function getTextTimeline(narrDur, onProgress, hintImgs, shouldStop) {
    return (_pendingAudioCaptionsP || Promise.resolve(null)).then(function (tx) {
      if (tx && tx.caps && tx.caps.length) return tx.caps;
      var script = (scriptInput && scriptInput.value || '').trim();
      if (script && narrDur > 0.5) {
        var sents = script.split(/\n+|(?<=[.!?])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!sents.length) sents = [script];
        var totalW = sents.reduce(function (a, s) { return a + s.split(/\s+/).length; }, 0) || 1, t = 0, caps = [];
        sents.forEach(function (s) { var w = s.split(/\s+/).length, d = narrDur * (w / totalW); caps.push({ text: s, start: t, end: t + d }); t += d; });
        return caps;
      }
      // SIN guion pegado NI transcripción por API → Whisper LOCAL escucha la voz (cualquier idioma, sin key).
      // La promesa se publica EN VUELO (no al terminar): loadFile la engancha al cerrar el build y los
      // subtítulos LLEGAN SOLOS cuando el worker termina — antes se publicaba al final y loadFile veía
      // null → los subs completos se perdían en el primer armado.
      if (_pendingAudioBuf && _pendingAudioBuf.duration > 0.5) {
        var genW = _audioGen;
        _capsInFlight = true;
        var pw = transcribeLocalWhisper(_pendingAudioBuf, onProgress, hintImgs, shouldStop).then(function (res) {
          _capsInFlight = false;
          return (res && res.caps && res.caps.length) ? res : null;
        }).catch(function () { _capsInFlight = false; return null; });
        if (genW === _audioGen && !_pendingAudioCaptionsP) { try { _pendingAudioCaptionsP = pw; } catch (eC) {} }
        return pw.then(function (res) { return res ? res.caps : null; });
      }
      return null;
    }).catch(function () { return null; });
  }
  // engLabels[] (por imagen) + idioma del texto → keywords por imagen (inglés + traducido) para matchear
  function imgKwFromLabels(engLabels, lang) {
    var uniq = {};
    engLabels.forEach(function (lab) { String(lab).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).forEach(function (w) { if (w.length > 3) uniq[w] = 1; }); });
    var arr = Object.keys(uniq);
    return translateWords(arr, lang).then(function (tr) {
      var map = {}; arr.forEach(function (w, i) { map[w] = tr[i] || w; });
      return engLabels.map(function (lab) {
        var ws = String(lab).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; });
        return ws.concat(ws.map(function (w) { return map[w] || w; })).join(' ');   // inglés + traducido
      });
    });
  }

  // ════════════════ IMÁGENES → VIDEO AUTOMÁTICO ════════════════
  // Codifica un array de imágenes a un MP4 (WebCodecs + Mp4Muxer, ya cargados para el export turbo)
  // y lo carga como cualquier video → todo el motor (AUTO, zoom, slidedown, emojis, subs) funciona igual.
  // El guion reparte cuánto dura cada imagen; sin guion, todas duran lo mismo.
  function imgsSupported() { return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof Mp4Muxer !== 'undefined' && Mp4Muxer.Muxer; }
  function buildVideoFromImages(files) {
    if (!files || !files.length) return;
    var imgFiles = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
    if (!imgFiles.length) { alert('Esos archivos no son imágenes. Subí JPG / PNG / WEBP.'); return; }
    imgFiles.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }); });   // orden natural por nombre (1,2,…,10)
    if (!imgsSupported()) { alert('Tu navegador no soporta crear video desde imágenes (necesita WebCodecs). Usá Chrome actualizado.'); return; }

    var script = (scriptInput.value || '').trim();
    var narr = _pendingAudioBuf;   // AudioBuffer de la narración (si el usuario la subió)
    bbox('inicio', imgFiles.length + ' fotos' + (narr && narr.duration > 0.5 ? ' + audio ' + Math.round(narr.duration / 60) + ' min' : ' sin audio'));
    var perImg;
    if (narr && narr.duration > 0.5) {
      // CON NARRACIÓN: el video dura EXACTO lo que la voz → reparto la voz entre las fotos (sin tope superior).
      perImg = Math.max(2, narr.duration / imgFiles.length);
    } else {
      // SIN narración: por guion (~2.5 palabras/seg) repartido entre imágenes, mín 2.5s, máx 6s c/u.
      var words = script ? script.split(/\s+/).length : 0;
      var totalSecs = words ? Math.max(imgFiles.length * 2.5, words / 2.5) : imgFiles.length * 4;
      perImg = clamp(totalSecs / imgFiles.length, 2.5, 6);
    }
    var FPS = 30, W = 1920, H = 1080;   // canvas de armado a 1080p

    // overlay de progreso
    var ov = document.createElement('div');
    ov.id = 'nspBuildOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(5,8,12,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#e7ecf2;font:14px ui-monospace,monospace;';
    ov.appendChild(el('div', null, 'Creando tu video desde ' + imgFiles.length + ' imágenes…')).style.cssText = 'font-weight:900;font-size:16px;color:#fff;';
    var bar = el('div'); bar.style.cssText = 'width:60%;max-width:420px;height:10px;background:rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;';
    var fill = el('div'); fill.style.cssText = 'height:100%;width:0%;background:#fff;transition:width .15s;'; bar.appendChild(fill); ov.appendChild(bar);
    var pct = el('div', null, '0%'); ov.appendChild(pct);
    document.body.appendChild(ov);
    function prog(p) { fill.style.width = Math.round(p * 100) + '%'; pct.textContent = Math.round(p * 100) + '% — ' + (p < 0.85 ? 'componiendo cuadros' : 'cerrando MP4'); bbox('componiendo', Math.round(p * 100) + '%'); }
    function fail(msg) { bbox('fallo', String(msg || '').slice(0, 140)); try { document.body.removeChild(ov); } catch (e) {} alert('No pude crear el video: ' + msg); }

    // 1) decodificar las imágenes a bitmaps — EN SECUENCIA y CON TOPE de resolución.
    // Antes: todas en paralelo a resolución completa (100 fotos 4K ≈ 3.3 GB retenidos todo el build).
    // Ahora: una a la vez, y las que superan lo que el lienzo 1080p + zoom Ken Burns usa de verdad
    // (headroom 1.4×) se re-encogen al decodificar → misma nitidez en pantalla, fracción de la RAM.
    function decodeCapped(f) {
      return createImageBitmap(f).then(function (bm) {
        var r = Math.max((W * 1.4) / bm.width, (H * 1.4) / bm.height);
        if (r >= 1) return bm;
        var w2 = Math.max(2, Math.round(bm.width * r));
        return createImageBitmap(bm, { resizeWidth: w2, resizeQuality: 'high' }).then(
          function (small) { try { bm.close(); } catch (eB) {} return small; },
          function () { return bm; }
        );
      }).catch(function () { return null; });
    }
    imgFiles.reduce(function (p, f, i) {
      return p.then(function (acc) {
        pct.textContent = 'leyendo foto ' + (i + 1) + '/' + imgFiles.length + '…';
        bbox('leyendo-foto', (i + 1) + '/' + imgFiles.length);
        return decodeCapped(f).then(function (bm) { acc[i] = bm; return acc; });
      });
    }, Promise.resolve(new Array(imgFiles.length)))
      .then(function (bmps) {
        bmps = bmps.filter(Boolean); if (!bmps.length) return fail('no pude leer las imágenes');
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c2 = cv.getContext('2d');
        var muxer, vEnc;
        // SALIDA POR TROZOS (clave para videos largos): en vez de armar el MP4 entero en UN ArrayBuffer contiguo
        // gigante (lo que daba "Array buffer allocation failed" al cerrar), el muxer ENTREGA trozos y los juntamos
        // en una lista. Al final se hace UN solo File/Blob de la lista (lo respalda el navegador, NO el heap de JS).
        // Con fastStart:false mp4-muxer reescribe algún tamaño de caja al final (seek-back) → se parchea sobre el
        // trozo que contiene esa posición. Si llegan en orden, igual; al final se ordenan por posición.
        // Cada trozo del muxer se vuelve YA un Blob (lo respalda el disco del navegador, NO el heap de JS).
        // Antes se guardaban Uint8Array en heap → 2 h a 14 Mbps pedía >10 GB y la página moría a los ~7 min
        // (el slideshow salía cortado). Con Blobs el heap queda mínimo → videos de horas. Patrón del export.
        var _parts = [], _writeEnd = 0;   // [{pos, len, blob}], se ordenan por posición al cerrar
        function _writePart(data, position) {
          var b = new Blob([data]);
          if (position >= _writeEnd) { _parts.push({ pos: position, len: b.size, blob: b }); _writeEnd = position + b.size; return; }
          var newEnd = position + b.size, keep = [];   // seek-back (parche de tamaños de caja al cerrar): recortar con Blob.slice
          for (var i = 0; i < _parts.length; i++) {
            var p = _parts[i], pEnd = p.pos + p.len;
            if (pEnd <= position || p.pos >= newEnd) { keep.push(p); continue; }
            if (p.pos < position) keep.push({ pos: p.pos, len: position - p.pos, blob: p.blob.slice(0, position - p.pos) });
            if (pEnd > newEnd) keep.push({ pos: newEnd, len: pEnd - newEnd, blob: p.blob.slice(p.len - (pEnd - newEnd)) });
          }
          keep.push({ pos: position, len: b.size, blob: b });
          _parts = keep;
          if (newEnd > _writeEnd) _writeEnd = newEnd;
        }
        try {
          var muxCfg;
          if (Mp4Muxer.StreamTarget) {
            // chunked:true → el muxer junta internamente y entrega POCOS trozos grandes (no miles diminutos)
            muxCfg = { target: new Mp4Muxer.StreamTarget({ onData: _writePart, chunked: true }), video: { codec: 'avc', width: W, height: H }, fastStart: false };
          } else {
            muxCfg = { target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory' };   // librería vieja → modo en-memoria
          }
          if (narr && narr.duration > 0.5) muxCfg.audio = { codec: 'aac', numberOfChannels: 2, sampleRate: (narr.sampleRate === 44100 || narr.sampleRate === 48000) ? narr.sampleRate : 44100 };   // el AAC de Chrome solo acepta 44100/48000 (el buffer a 22050 se remuestrea al encodear)
          muxer = new Mp4Muxer.Muxer(muxCfg);
          vEnc = new VideoEncoder({ output: function (ch, meta) { muxer.addVideoChunk(ch, meta); }, error: function (e) { fail(e.message); } });
          // Bitrate capado por duración: el archivo intermedio queda ≤ ~3 GB (el export final re-codifica igual).
          var _vds = (narr && narr.duration > 0.5) ? narr.duration : (perImg * bmps.length);
          var _bbr = clamp(Math.floor(3000 * 1024 * 1024 * 8 / Math.max(1, _vds)), 2200000, 14000000);
          vEnc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: _bbr, framerate: FPS, latencyMode: 'quality', hardwareAcceleration: 'prefer-hardware' });
        } catch (e) { return fail('WebCodecs: ' + (e && e.message || e)); }

        var fdurUs = Math.round(1e6 / FPS);
        // El video dura TODO el audio (o perImg×fotos si no hay audio). Para que NINGUNA foto quede ETERNA
        // en pantalla (estirar 100 fotos sobre 2 h = 72 s c/u = parece trabado), cada foto se muestra un
        // tiempo RAZONABLE (2.5–6 s) y las fotos SE REPITEN/ciclan (0,1,…,N-1,0,1,…) hasta llenar TODO. Sin huecos.
        var vidDurSec = (narr && narr.duration > 0.5) ? narr.duration : (perImg * bmps.length);
        var totalFrames = Math.max(bmps.length, Math.round(vidDurSec * FPS));
        var secPer = clamp((narr && narr.duration > 0.5) ? (narr.duration / Math.max(1, bmps.length)) : perImg, 2.5, 6);
        var framesPerSlot = Math.max(1, Math.round(secPer * FPS));   // cuadros que dura cada foto antes de cambiar
        var fi = 0, slot = 0, frameInSlot = 0, _imgPlan = null;   // _imgPlan[slot] = índice de imagen que cuadra con la voz en ese tramo
        var _imgTimeline = null, _tlIdx = 0, _tlLast = -1, _tlCut = false;   // modo PRECISO: cortes en los timestamps reales de la voz
        // dibuja la imagen i en cover-fit (llena 1920x1080 sin deformar)
        function paint(bmp) {
          c2.fillStyle = '#000'; c2.fillRect(0, 0, W, H);
          var iw = bmp.width, ih = bmp.height, cover = Math.max(W / iw, H / ih), dw = iw * cover, dh = ih * cover;
          c2.drawImage(bmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
        }
        // cierre del MP4: finalize → blob → cargar en el editor (todo el motor AUTO/export lo trata como un video normal)
        function finishMux() {
          bbox('mux', '');
          try { muxer.finalize(); } catch (e) { return fail('cerrar MP4: ' + (e && e.message || e)); }
          var file;
          try {
            var parts;
            if (_parts && _parts.length) {
              _parts.sort(function (a, b) { return a.pos - b.pos; });   // ordenar por posición real en el archivo
              parts = _parts.map(function (p) { return p.blob; });      // Blobs (respaldados por disco) → cero buffer gigante
              _parts = null;
            } else {
              parts = [muxer.target.buffer];   // modo en-memoria (librería vieja sin StreamTarget)
            }
            // loadFile EXIGE type 'video/...' y nombre que termine en 'slideshow.mp4' (activa el export por SEEK).
            // El File se arma de Blobs (solo metadata, sin copia contigua) → soporta horas sin reventar memoria.
            file = new File(parts, 'slideshow.mp4', { type: 'video/mp4' });
          } catch (e) { return fail('armar MP4: ' + (e && e.message || e)); }
          prog(1); bbox('done', ''); _slideshowPerImg = secPer; _slideshowSecPer = secPer;   // seg/foto (alinea el corte AUTO + el export por seek)
          _slideshowTimeline = (_imgTimeline && _imgTimeline.length > 1)
            ? _imgTimeline.map(function (sg) { return { start: Number(sg.start) || 0, end: Number(sg.end) || 0, img: sg.img }; })
            : null;
          _slideshowFresh = true;
          setTimeout(function () { try { document.body.removeChild(ov); } catch (e) {} loadFile(file); }, 150);
        }
        // narración → AAC, muxeada como pista de audio. CODIFICA EN BLOQUES de 1 s leyendo directo del
        // AudioBuffer (sin OfflineAudioContext ni un AudioData gigante). Esto es CLAVE para audio largo
        // (6 audios unidos = horas): un solo Float32Array de >1GB fallaba calladito y el video salía MUDO.
        // Recorta a la duración del video; si la voz es más corta, el resto queda en silencio.
        function encodeNarration(videoDurSec, done) {
          var finished = false; function finish() { if (finished) return; finished = true; done(); }
          try {
            if (!narr || !narr.length) { finish(); return; }
            bbox('cerrando-audio', Math.round(videoDurSec / 60) + ' min');
            var sr = narr.sampleRate || 44100;
            // El AAC de Chrome SOLO acepta 44100/48000 — nuestro buffer de voz vive a 22050 (mitad de RAM).
            // Antes se configuraba a 22050 → el encoder rechazaba y el slideshow salía MUDO (el catch se lo
            // tragaba). Ahora se REMUESTREA al vuelo por bloques (22050→44100 = interpolación 2× exacta).
            var outSr = (sr === 44100 || sr === 48000) ? sr : 44100;
            var UP = outSr / sr;
            var isI = !!narr.i16, SC = isI ? (1 / 32768) : 1;
            var L = isI ? narr.i16 : narr.getChannelData(0);
            var R = isI ? L : (narr.numberOfChannels > 1 ? narr.getChannelData(1) : L);
            var totalLen = Math.min(narr.length, Math.max(1, Math.ceil(videoDurSec * sr)));   // recorta a la duración del video
            var aEnc = new AudioEncoder({
              output: function (chunk, meta) { muxer.addAudioChunk(chunk, meta); },
              error: function (e) { console.warn('[slideshow audio]', e && e.message); finish(); }
            });
            aEnc.configure({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: outSr, bitrate: 160000 });
            var CHUNK = sr, pos = 0;   // 1 segundo (en muestras FUENTE) por bloque
            function pump() {
              try {
                var guard = 0;
                while (pos < totalLen) {
                  if (aEnc.encodeQueueSize > 48) { setTimeout(pump, 12); return; }   // backpressure del encoder
                  if (guard++ > 120) { setTimeout(pump, 0); return; }                // cede el hilo (no congela la UI en audios largos)
                  var n = Math.min(CHUNK, totalLen - pos);
                  var m = Math.round(n * UP);
                  var inter = new Float32Array(m * 2);
                  for (var j = 0; j < m; j++) {
                    var t = pos + j / UP, k = t | 0, fr = t - k, k1 = (k + 1 < totalLen) ? k + 1 : k;
                    inter[j * 2] = ((L[k] || 0) * (1 - fr) + (L[k1] || 0) * fr) * SC;
                    inter[j * 2 + 1] = ((R[k] || 0) * (1 - fr) + (R[k1] || 0) * fr) * SC;
                  }
                  var ts = Math.round(pos / sr * 1e6);
                  var ad = new AudioData({ format: 'f32', sampleRate: outSr, numberOfFrames: m, numberOfChannels: 2, timestamp: ts, data: inter });
                  aEnc.encode(ad); ad.close();
                  pos += n;
                }
                aEnc.flush().then(finish).catch(finish);
              } catch (e) { finish(); }
            }
            pump();
          } catch (e) { finish(); }
        }
        function step() {
          if (fi >= totalFrames) {   // llenamos TODO el audio (con repetición de fotos) → cerrar
            vEnc.flush().then(function () {
              try { bmps.forEach(function (b) { try { b.close(); } catch (e) {} }); } catch (e) {}   // recién acá liberamos (se reusan al ciclar)
              if (narr && narr.duration > 0.5) { pct.textContent = 'cerrando audio (voz en off)…'; encodeNarration(totalFrames / FPS, finishMux); }   // audio a la duración EXACTA del video
              else finishMux();
            }).catch(function (e) { fail('flush video: ' + e.message); });
            return;
          }
          if (_imgTimeline && _imgTimeline.length) {
            var tlSec = fi / FPS;
            while (_tlIdx < _imgTimeline.length - 1 && tlSec >= _imgTimeline[_tlIdx].end) _tlIdx++;
            var tlImg = _imgTimeline[_tlIdx].img;
            if (tlImg !== _tlLast) { paint(bmps[tlImg]); _tlLast = tlImg; _tlCut = true; }
          } else if (frameInSlot === 0) paint(bmps[(_imgPlan && _imgPlan[slot] != null) ? _imgPlan[slot] : (slot % bmps.length)]);   // plan IA (cuadra con la voz) o, si no hay, ciclo normal
          try {
            var frame = new VideoFrame(cv, { timestamp: fi * fdurUs, duration: fdurUs });
            vEnc.encode(frame, { keyFrame: (frameInSlot === 0 || _tlCut) }); frame.close();
            _tlCut = false;
          } catch (e) { return fail('encode: ' + e.message); }
          fi++; frameInSlot++;
          if (frameInSlot >= framesPerSlot) { frameInSlot = 0; slot++; }   // cambia de foto cada ~secPer s (repite si hacen falta más)
          if (fi % 6 === 0) prog(fi / totalFrames);
          // si el encoder se satura, esperar; si no, seguir rápido
          if (vEnc.encodeQueueSize > 60) setTimeout(step, 8); else Promise.resolve().then(step);
        }
        // CUADRAR CON LA VOZ: si hay narración + transcripción + key de Gemini, la IA entiende cada imagen y
        // arma un plan para mostrar cada una CUANDO la narración habla de eso. Si algo falta o falla → ciclo normal.
        function planThenStep() {
          if (!(narr && narr.duration > 0.5) || bmps.length < 2) { step(); return; }
          bbox('sincronizando-voz', bmps.length + ' fotos');
          // BLINDAJE (v4.33): cuadrar imágenes con la voz es OPCIONAL — el video se arma igual sin eso.
          // goStep() dispara UNA sola vez; tope duro de 30 s + botón SALTAR para no quedar NUNCA colgado
          // (con muchas imágenes la IA local tarda minutos, y si TensorFlow no carga, antes se quedaba eterno).
          var planDone = false;
          var planDeadline = Date.now() + 30000;
          var skipBtn = document.createElement('button');
          function goStep() {
            if (planDone) return;
            planDone = true;
            _txProgressHook = null;
            try { clearInterval(planWatch); } catch (eW) {}
            try { skipBtn.remove(); } catch (eSk) {}
            step();
          }
          function safePct(t) { if (!planDone) { pct.textContent = t; planDeadline = Date.now() + 30000; } }   // cada señal de progreso extiende el plazo (y que un callback tardío no pise el % real)
          skipBtn.textContent = 'SALTAR análisis IA (armar ya)';
          skipBtn.style.cssText = 'margin-top:6px;padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.2);'
            + 'background:rgba(255,255,255,.06);color:#e7ecf2;font:12px ui-monospace,monospace;cursor:pointer;';
          skipBtn.onclick = function () { _imgPlan = null; _imgTimeline = null; goStep(); };
          ov.appendChild(skipBtn);
          var planWatch = setInterval(function () {
            if (planDone) { clearInterval(planWatch); return; }
            if (Date.now() > planDeadline) { clearInterval(planWatch); _imgPlan = null; _imgTimeline = null; goStep(); }
          }, 1000);   // tope: 30 s SIN señales de vida (el progreso extiende el plazo)
          // shouldStop = null A PROPÓSITO: la transcripción SOBREVIVE al plan. Antes moría con planDone
          // (con 6 audios Whisper jamás terminaba en los 30 s del plan → lo mataban → CERO subtítulos
          // de la voz). Ahora el plan arranca a tiempo igual, y los subtítulos llegan solos al terminar
          // (loadFile ya los recibe tarde y repinta). El aborto real es por cambio de audio (_audioGen).
          _txProgressHook = safePct;
          getTextTimeline(narr.duration, safePct, bmps.length, null).then(function (caps) {
            if (planDone) return;
            if (!caps || !caps.length) { goStep(); return; }   // sin transcripción NI guion pegado → no hay con qué cuadrar → ciclo normal
            var sample = caps.map(function (c) { return c.text; }).join(' ').slice(0, 280);
            function finishPlan(imgKw, motor) {
              if (planDone) return;
              try { _imgPlan = planImageSlots(bmps.length, caps, imgKw, secPer, totalFrames / FPS); } catch (ePl) { _imgPlan = null; }
              try { _imgTimeline = planImageTimeline(bmps.length, caps, imgKw, totalFrames / FPS); } catch (eTl) { _imgTimeline = null; }
              if (_imgTimeline && _imgTimeline._total) {
                console.log('[SYNC imagen-voz] PRECISO motor=' + motor + ' | cortes en los timestamps de la voz: ' + _imgTimeline._total + ' | con match real: ' + _imgTimeline._matched);
                safePct('✓ Sincronización PRECISA: ' + _imgTimeline._total + ' cortes alineados a la voz (' + motor + ') — armando…');
              } else if (_imgPlan && _imgPlan._total) {
                console.log('[SYNC imagen-voz] motor=' + motor + ' | tramos con match real: ' + _imgPlan._matched + '/' + _imgPlan._total);
                safePct('✓ Imágenes sincronizadas con la voz: ' + _imgPlan._matched + '/' + _imgPlan._total + ' tramos (' + motor + ') — armando…');
              } else {
                safePct(_imgPlan ? '✓ Imágenes cuadradas con la voz — armando…' : 'componiendo cuadros…');
              }
              goStep();
            }
            function viaLocal(next) {
              safePct('Entendiendo las imágenes (IA local, gratis)…');
              classifyImagesLocal(bmps, function (d, n) { safePct('Entendiendo imágenes ' + d + '/' + n + ' (local) — o dale SALTAR…'); })
                .then(function (engLabels) {
                  if (planDone) return;
                  if (!engLabels || !engLabels.some(Boolean)) throw new Error('local sin labels');
                  return detectTextLang(sample).then(function (lang) {
                    return imgKwFromLabels(engLabels, lang).then(function (imgKw) { finishPlan(imgKw, 'local'); });
                  });
                })
                .catch(function () { if (!planDone) next(); });
            }
            function viaGemini(gkey, next) {
              detectTextLang(sample).then(function (lang) {
                if (planDone) return;
                safePct('Entendiendo imágenes (IA visión)…');
                describeImagesGemini(bmps, gkey, function (d, n) { safePct('Entendiendo imágenes ' + d + '/' + n + ' (visión) — o dale SALTAR…'); }, lang)
                  .then(function (imgKw) {
                    if (planDone) return;
                    if (!imgKw || !imgKw.some(Boolean)) throw new Error('gemini sin labels');
                    finishPlan(imgKw, 'visión');
                  })
                  .catch(function () { if (!planDone) next(); });
              }).catch(function () { if (!planDone) next(); });
            }
            getAIKeys().then(function (keys) {
              if (planDone) return;
              var gkey = (keys && keys.gemini && /^AIza/.test(keys.gemini)) ? keys.gemini : '';
              viaLocal(function () {
                if (gkey) viaGemini(gkey, function () { _imgPlan = null; _imgTimeline = null; goStep(); });
                else { _imgPlan = null; _imgTimeline = null; goStep(); }
              });
            }).catch(function () {
              viaLocal(function () { _imgPlan = null; _imgTimeline = null; goStep(); });
            });
          }).catch(function () { goStep(); });
        }
        planThenStep();
      })
      .catch(function (e) { fail(String(e && e.message || e)); });
  }
  var imgsInput = $('imgsInput');
  var _stagedImgs = [];
  function stageImages(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return f && /^image\//.test(f.type); });
    if (!list.length) { alert('Esos archivos no son imágenes. Subí JPG / PNG / WEBP.'); return; }
    _stagedImgs = list;
    var di = $('dropImgs');
    if (di) di.classList.add('loaded');
    var t = di ? di.querySelector('.drop-title') : null;
    if (t) t.textContent = '✓ ' + list.length + ' fotos listas';
    var h = $('imgsHint');
    if (h) h.textContent = 'Agregá narración y guion con calma (en el orden que quieras). Cuando tengas todo, tocá el botón CREAR VIDEO. Si soltás otras fotos, reemplazan estas.';
    var b = $('btnBuildNow');
    if (b) { b.hidden = false; b.textContent = 'CREAR VIDEO con ' + list.length + ' fotos'; }
  }
  function resetStagedImgs() {
    _stagedImgs = [];
    if (imgsInput) { try { imgsInput.value = ''; } catch (e) {} }
    var di = $('dropImgs');
    if (di) di.classList.remove('loaded');
    var t = di ? di.querySelector('.drop-title') : null;
    if (t) t.textContent = '2) Soltá las fotos — quedan preparadas (nada se crea todavía)';
    var h = $('imgsHint');
    if (h && _IMGS_HINT0) h.textContent = _IMGS_HINT0;
    var b = $('btnBuildNow');
    if (b) b.hidden = true;
  }
  if (imgsInput) imgsInput.addEventListener('change', function () { if (imgsInput.files && imgsInput.files.length) stageImages(imgsInput.files); });
  var dropImgs = $('dropImgs');
  if (dropImgs) {
    dropImgs.addEventListener('dragover', function (e) { e.preventDefault(); dropImgs.classList.add('drag'); });
    dropImgs.addEventListener('dragleave', function () { dropImgs.classList.remove('drag'); });
    dropImgs.addEventListener('drop', function (e) { e.preventDefault(); dropImgs.classList.remove('drag'); if (e.dataTransfer.files && e.dataTransfer.files.length) stageImages(e.dataTransfer.files); });
  }
  var btnBuildNow = $('btnBuildNow');
  if (btnBuildNow) btnBuildNow.addEventListener('click', function () {
    if (document.getElementById('nspBuildOv')) return;
    if (_audioDecoding) { alert('Tus audios todavía se están leyendo (mirá el % en el recuadro 1). Esperá a que aparezca el ✓ y volvé a dar CREAR — si no, el video saldría sin voz.'); return; }
    if (!_stagedImgs.length) { alert('Primero soltá tus fotos en el recuadro 2.'); return; }
    buildVideoFromImages(_stagedImgs);
  });

  // ── SUBIR VARIOS GUIONES (.txt) → se unen en orden (compilaciones largas tipo sleep stories de 2 h) ──
  var scriptsInput = $('scriptsInput'), btnScripts = $('btnScripts'), scriptsInfo = $('scriptsInfo');
  if (btnScripts && scriptsInput) btnScripts.addEventListener('click', function () { scriptsInput.click(); });
  if (scriptsInput) scriptsInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(scriptsInput.files || []).filter(function (f) { return /\.(txt|md|srt)$/i.test(f.name || '') || /text\//.test(f.type); });
    if (!files.length) { if (scriptsInfo) scriptsInfo.textContent = '⚠ Subí archivos de texto (.txt).'; return; }
    files.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }); });   // orden natural (1,2,…,10)
    if (scriptsInfo) scriptsInfo.textContent = 'Leyendo ' + files.length + ' guion(es)…';
    Promise.all(files.map(function (f) { return (f.text ? f.text() : new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(String(r.result || '')); }; r.onerror = function () { res(''); }; r.readAsText(f); })); }))
      .then(function (texts) {
        var clean = texts.map(function (t) { return String(t || '').replace(/^\d+\s*$|\d{2}:\d{2}:\d{2}[\.,]\d{3}.*$/gm, '').replace(/\r/g, '').trim(); }).filter(Boolean);   // limpia numeración/timestamps de .srt
        var combined = clean.join('\n\n');
        var cur = (scriptInput.value || '').trim();
        scriptInput.value = cur ? (cur + '\n\n' + combined) : combined;
        var words = combined.split(/\s+/).filter(Boolean).length, mins = Math.round(words / 150);   // ~150 palabras/min narración
        var dur = mins >= 60 ? (Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm') : (mins + 'm');
        if (scriptsInfo) scriptsInfo.textContent = '✓ ' + files.length + ' guion(es) unidos · ' + words.toLocaleString() + ' palabras · ≈ ' + dur + ' de narración';
        try { scriptsInput.value = ''; } catch (e) {}
      });
  });

  // ── NARRACIÓN (voz en off) para el modo imágenes→video ──
  var audioInput = $('audioInput'), dropAudio = $('dropAudio'), audioLabel = $('audioLabel'), imgsHint = $('imgsHint');
  var _AUDIO_LABEL0 = '1) Narración / voz en off (opcional) — subí UNO o VARIOS MP3/WAV (los uno en orden): el video dura lo que tu voz y te transcribo los subtítulos solo.';
  var _IMGS_HINT0 = imgsHint ? imgsHint.textContent : '';

  // ── TRANSCRIPCIÓN: voz → subtítulos (Groq Whisper con timestamps; fallback Gemini solo-texto) ──
  function getAIKeys() {
    return new Promise(function (res) {
      try {
        chrome.storage.local.get(['nsp_groq_api_key', 'nsp_gemini_api_key'], function (r) {
          res({
            groq: r && r.nsp_groq_api_key ? String(r.nsp_groq_api_key).trim() : '',
            gemini: r && r.nsp_gemini_api_key ? String(r.nsp_gemini_api_key).trim() : ''
          });
        });
      } catch (e) { res({ groq: '', gemini: '' }); }
    });
  }
  // parte una frase larga en trozos cortos (≤6 palabras / ≤40 chars) repartiendo su tiempo por nº de palabras
  function chunkSeg(text, start, end) {
    var s = (text || '').trim(); if (!s) return [];
    var words = s.split(/\s+/), chunks = [], cur = [];
    words.forEach(function (w) { cur.push(w); var j = cur.join(' '); if (cur.length >= 6 || j.length >= 40) { chunks.push(j); cur = []; } });
    if (cur.length) chunks.push(cur.join(' '));
    var totalW = chunks.reduce(function (a, c) { return a + c.split(/\s+/).length; }, 0) || 1;
    var span = Math.max(0.4, (end || start) - start), tcur = start, out = [];
    chunks.forEach(function (c) { var w = c.split(/\s+/).length, dur = span * (w / totalW); out.push({ text: c, start: tcur, end: tcur + Math.max(0.4, dur) - 0.03, key: captionHighlight(c) }); tcur += dur; });
    return out;
  }
  function captionsFromSegments(segs) {
    var caps = [];
    (segs || []).forEach(function (sg) {
      var st = +sg.start || 0, en = +sg.end || st;
      if (en <= st) en = st + Math.max(1, ((sg.text || '').split(/\s+/).length) / 2.5);
      caps.push.apply(caps, chunkSeg(sg.text, st, en));
    });
    return caps;
  }
  // Groq Whisper: transcripción CON timestamps reales (lo mejor para subtítulos). {caps,text} o null.
  function transcribeGroq(file, key) {
    var fd = new FormData();
    fd.append('file', file, file.name || 'narration.mp3');
    fd.append('model', 'whisper-large-v3-turbo');   // rápido y gratis
    fd.append('response_format', 'verbose_json');   // trae segmentos con timestamps
    fd.append('temperature', '0');
    return fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: fd })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('Groq ' + r.status + ' ' + t.slice(0, 140)); }); return r.json(); })
      .then(function (j) {
        var segs = (j && j.segments) || [];
        if (!segs.length && j && j.text) segs = [{ start: 0, end: 0, text: j.text }];
        return { caps: captionsFromSegments(segs), text: (j && j.text) || '' };
      });
  }
  // Gemini: solo texto (sin timestamps) → reparto el tiempo por palabras sobre la duración de la voz.
  function transcribeGemini(file, key, dur) {
    if (file.size > 18 * 1024 * 1024) return Promise.resolve(null);   // límite de inline_data
    return new Promise(function (resolve) {
      var fr = new FileReader();
      fr.onload = function () {
        var b64 = String(fr.result).split(',')[1] || ''; if (!b64) return resolve(null);
        var body = { contents: [{ parts: [{ inline_data: { mime_type: file.type || 'audio/mpeg', data: b64 } }, { text: 'Transcribe este audio palabra por palabra. Devolvé SOLO la transcripción, sin comillas ni comentarios.' }] }] };
        var models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'], i = 0;
        (function tryModel() {
          if (i >= models.length) return resolve(null);
          var m = models[i++];
          fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { if (!r.ok) throw new Error('g' + r.status); return r.json(); })
            .then(function (j) {
              var txt = ''; try { txt = j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join(' ').trim(); } catch (e) {}
              if (!txt) return tryModel();
              resolve({ caps: chunkSeg(txt, 0, dur || 1), text: txt });
            }).catch(function () { tryModel(); });
        })();
      };
      fr.onerror = function () { resolve(null); };
      fr.readAsDataURL(file);
    });
  }
  // Orquestador: Groq (mejor) → Gemini (fallback) → null (sin keys → se usa el guion pegado).
  function transcribeNarration(file, dur) {
    return getAIKeys().then(function (k) {
      if (k.groq && /^gsk_/.test(k.groq)) return transcribeGroq(file, k.groq).catch(function () { return k.gemini ? transcribeGemini(file, k.gemini, dur) : null; });
      if (k.gemini && /^AIza/.test(k.gemini)) return transcribeGemini(file, k.gemini, dur);
      return null;
    }).catch(function () { return null; });
  }

  // Une varios AudioBuffer en uno solo (en orden). Todos vienen del MISMO AudioContext → mismo sampleRate.
  // El nº de canales del resultado = el máximo (mono se duplica a estéreo si hace falta).
  function concatAudioBuffers(ctx, buffers) {
    buffers = (buffers || []).filter(Boolean);
    if (!buffers.length) return null;
    if (buffers.length === 1) return buffers[0];
    var ch = buffers.reduce(function (a, b) { return Math.max(a, b.numberOfChannels); }, 1);
    var sr = buffers[0].sampleRate;
    var total = buffers.reduce(function (a, b) { return a + b.length; }, 0);
    var out = ctx.createBuffer(ch, total, sr);
    for (var c = 0; c < ch; c++) {
      var od = out.getChannelData(c), off = 0;
      buffers.forEach(function (b) {
        var src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));   // mono → se copia a ambos canales
        od.set(src, off); off += b.length;
      });
    }
    return out;
  }
  // Transcribe CADA audio por separado (cada uno bajo el límite de Groq ~25MB) y corre los timestamps
  // por la duración acumulada de los anteriores → subtítulos sincronizados a lo largo de todo el combinado.
  function transcribeMany(files, buffers) {
    var offsets = [], acc = 0;
    buffers.forEach(function (b) { offsets.push(acc); acc += (b && b.duration) || 0; });
    return Promise.all(files.map(function (f, i) {
      return transcribeNarration(f, (buffers[i] && buffers[i].duration) || 1).then(function (res) {
        if (!res || !res.caps) return { caps: [], text: res && res.text || '' };
        var off = offsets[i];
        var caps = res.caps.map(function (c) { return { text: c.text, start: c.start + off, end: c.end + off, key: c.key }; });
        return { caps: caps, text: res.text || '' };
      }).catch(function () { return { caps: [], text: '' }; });
    })).then(function (parts) {
      var caps = [], texts = [];
      parts.forEach(function (p) { caps.push.apply(caps, p.caps); if (p.text) texts.push(p.text); });
      return { caps: caps, text: texts.join('\n\n') };
    });
  }

  // Segmento de un AudioBuffer → WAV 16-bit PCM mono 16 kHz (lo que Whisper usa por dentro): ~1.9 MB/min,
  // así un trozo de varios minutos entra holgado en el límite de archivo de Groq (~25 MB).
  function bufferSliceToWav16kMono(buf, a0, a1) {
    var sr = buf.sampleRate, n0 = Math.max(0, Math.floor(a0 * sr)), n1 = Math.min(buf.length, Math.floor(a1 * sr));
    var len = Math.max(1, n1 - n0), mono;
    if (buf.i16) {
      var si = buf.i16;
      mono = new Float32Array(len);
      for (var ii = 0; ii < len; ii++) mono[ii] = (si[n0 + ii] || 0) / 32768;
    } else {
      var ch = buf.numberOfChannels;
      mono = new Float32Array(len);
      for (var c = 0; c < ch; c++) { var d = buf.getChannelData(c); for (var i = 0; i < len; i++) mono[i] += d[n0 + i] / ch; }
    }
    var TR = 16000, outLen = Math.max(1, Math.round(len * TR / sr)), out = new Float32Array(outLen);
    for (var j = 0; j < outLen; j++) { var t = j * sr / TR, k = t | 0, f = t - k; out[j] = (mono[k] || 0) * (1 - f) + (mono[k + 1] || 0) * f; }
    var bytes = 44 + outLen * 2, abf = new ArrayBuffer(bytes), v = new DataView(abf);
    function ws(o, s) { for (var x = 0; x < s.length; x++) v.setUint8(o + x, s.charCodeAt(x)); }
    ws(0, 'RIFF'); v.setUint32(4, bytes - 8, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, TR, true); v.setUint32(28, TR * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, outLen * 2, true);
    for (var p = 0; p < outLen; p++) { var sm = Math.max(-1, Math.min(1, out[p])); v.setInt16(44 + p * 2, sm < 0 ? sm * 0x8000 : sm * 0x7FFF, true); }
    return new Blob([abf], { type: 'audio/wav' });
  }
  // Transcribe un audio LARGO (hasta horas) troceándolo: trozos de ~8 min a 16 kHz mono (cada uno entra en
  // Groq), con timestamps corridos por la duración acumulada → subtítulos sincronizados de todo el video.
  function transcribeLongAudio(buf) {
    return getAIKeys().then(function (k) {
      var hasGroq = k.groq && /^gsk_/.test(k.groq), hasGem = k.gemini && /^AIza/.test(k.gemini);
      if (!hasGroq && !hasGem) return null;
      var dur = buf.duration, CHUNK = 480, parts = Math.ceil(dur / CHUNK), idx = 0, allCaps = [], allText = [];
      function pushCaps(caps, off) { (caps || []).forEach(function (c) { allCaps.push({ text: c.text, start: c.start + off, end: c.end + off, key: c.key }); }); }
      // FALLBACK: cuando Groq se queda sin cuota (corta a los ~30 min), Gemini transcribe ESE trozo → cubre las 2h.
      function geminiPart(file, off, segdur) {
        if (!hasGem) return next();
        return transcribeGemini(file, k.gemini, segdur).then(function (g) { if (g) { pushCaps(g.caps, off); if (g.text) allText.push(g.text); } return next(); }).catch(function () { return next(); });
      }
      function next() {
        if (idx >= parts) { bbox('done', 'transcripción API completa ' + parts + ' partes'); return Promise.resolve({ caps: allCaps, text: allText.join(' ') }); }
        var a0 = idx * CHUNK, a1 = Math.min(dur, a0 + CHUNK), off = a0, segdur = a1 - a0;
        bbox('transcribiendo-api', 'parte ' + (idx + 1) + '/' + parts + _memTag());
        var file = new File([bufferSliceToWav16kMono(buf, a0, a1)], 'part' + idx + '.wav', { type: 'audio/wav' });
        if (audioLabel) audioLabel.textContent = 'Transcribiendo subtítulos… parte ' + (idx + 1) + '/' + parts + ' (' + fmt(Math.round(dur)) + ' de voz)';
        idx++;
        if (!hasGroq) return geminiPart(file, off, segdur);
        return transcribeGroq(file, k.groq).then(function (res) {
          if (res && res.caps && res.caps.length) { pushCaps(res.caps, off); if (res.text) allText.push(res.text); return next(); }
          return geminiPart(file, off, segdur);   // Groq sin resultado (cuota agotada) → Gemini
        }).catch(function () { return geminiPart(file, off, segdur); });   // Groq error/429 → Gemini
      }
      return next();
    }).catch(function () { return null; });
  }

  function setNarration(files) {
    // Acepta 1 archivo o VARIOS (FileList/array). Se unen en orden natural por nombre (1,2,…,10).
    var list = (files && files.length != null && typeof files !== 'string') ? Array.prototype.slice.call(files) : (files ? [files] : []);
    list = list.filter(function (f) { return f && (/^audio\//.test(f.type) || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(f.name || '')); });
    if (!list.length) { alert('Eso no es un audio. Subí MP3 / WAV / M4A.'); return; }
    list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }); });
    var multi = list.length > 1;
    _pendingAudioFile = list[0]; _pendingAudioBuf = null; _pendingAudioCaptionsP = null; _whisperCapsP = null; _audioGen++;
    _audioDecoding = true;
    if (_scriptAutoFilled) { try { scriptInput.value = ''; } catch (eSc) {} _scriptAutoFilled = false; }
    if (audioLabel) audioLabel.textContent = multi ? ('Leyendo y uniendo ' + list.length + ' audios…') : ('Leyendo "' + list[0].name + '"…');
    var actx = ensureAudio();
    // DECODIFICA UNO A UNO (no en paralelo: no apila horas de audio descomprimido en RAM) y arma un único
    // buffer MONO 22050 Hz — la voz suena igual y pesa ~1/4, así soporta 2h+ sin quedarse sin memoria.
    // Un archivo ilegible se SALTA (antes Promise.all tumbaba los 6 con uno solo malo → video MUDO).
    var _TSR = 22050, _segs = [];
    // Decodificar contra un contexto a 22050 Hz: el navegador remuestrea NATIVO al decodificar,
    // así el buffer decodificado pesa la MITAD en RAM (audios largos ya no matan la pestaña) y el
    // bucle de abajo degenera en mezcla de canales pura. Si el contexto no se puede crear → camino clásico.
    var _dctx = null;
    try { _dctx = new OfflineAudioContext(1, 1, _TSR); } catch (eDc) { _dctx = null; }
    function _decMono(f, i) {
      return f.arrayBuffer().then(function (ab) { return (_dctx || actx).decodeAudioData(ab); }).then(function (buf) {
        // El remuestreo son DECENAS de millones de muestras: se procesa en trozos que SUELTAN el hilo.
        // Antes era un solo bucle síncrono → con audios largos la página quedaba congelada minutos,
        // Chrome la marcaba "no responde" y la mataba (te sacaba del editor a mitad de la carga).
        var ch = buf.numberOfChannels, sr = buf.sampleRate, outLen = Math.max(1, Math.round(buf.length * _TSR / sr)), out = new Int16Array(outLen), ds = [];
        for (var c = 0; c < ch; c++) ds.push(buf.getChannelData(c));
        var STEP = 2000000;
        return new Promise(function (resolve) {
          var j0 = 0;
          function chunk() {
            var jEnd = Math.min(outLen, j0 + STEP);
            for (var j = j0; j < jEnd; j++) { var t = j * sr / _TSR, k = t | 0, fr = t - k, s0 = 0, s1 = 0; for (var c2 = 0; c2 < ch; c2++) { s0 += ds[c2][k] || 0; s1 += ds[c2][k + 1] || 0; } var vf = ((s0 / ch) * (1 - fr) + (s1 / ch) * fr) * 32767; out[j] = vf > 32767 ? 32767 : (vf < -32768 ? -32768 : vf | 0); }
            j0 = jEnd;
            if (j0 < outLen) {
              if (audioLabel) audioLabel.textContent = 'Leyendo audio ' + (i + 1) + '/' + list.length + '… ' + Math.round(100 * j0 / outLen) + '%';
              bbox('leyendo-audio', (i + 1) + '/' + list.length + ' ' + Math.round(100 * j0 / outLen) + '%');
              setTimeout(chunk, 0);
              return;
            }
            _segs[i] = out;
            resolve();
          }
          chunk();
        });
      }).catch(function () { _segs[i] = null; });   // ese audio falla → se salta, no tumba los demás
    }
    list.reduce(function (p, f, i) {
      return p.then(function () { if (audioLabel) audioLabel.textContent = 'Leyendo audio ' + (i + 1) + '/' + list.length + '…'; return _decMono(f, i); });
    }, Promise.resolve()).then(function () {
      var good = _segs.filter(Boolean), total = good.reduce(function (a, s) { return a + s.length; }, 0);
      if (!total) throw new Error('sin audio');
      var i16all = new Int16Array(total), off = 0;
      good.forEach(function (s) { i16all.set(s, off); off += s.length; });
      _segs.length = 0;
      var combined = { isPcm16: true, sampleRate: _TSR, numberOfChannels: 1, length: total, duration: total / _TSR, i16: i16all };
      _pendingAudioBuf = combined;
      _audioDecoding = false;
      bbox('done', 'audio listo');
      // Precalentar el motor de voz YA (en su worker, sin tocar esta página): cuando el usuario le dé
      // CREAR, el modelo ya está cargado y el plan de sincronización no pierde sus 30 s en la descarga.
      getAIKeys().then(function (kW) {
        var hasApi = (kW && kW.groq && /^gsk_/.test(kW.groq)) || (kW && kW.gemini && /^AIza/.test(kW.gemini));
        if (!hasApi) { try { if (window.NSP_WHISPER && NSP_WHISPER.warm) NSP_WHISPER.warm(null); } catch (eWm) {} }
      }).catch(function () {
        try { if (window.NSP_WHISPER && NSP_WHISPER.warm) NSP_WHISPER.warm(null); } catch (eW2) {}
      });
      if (dropAudio) dropAudio.classList.add('loaded');
      var dur = combined.duration, head = multi ? ('✓ ' + list.length + ' audios unidos') : ('✓ Narración: ' + list[0].name);
      if (audioLabel) audioLabel.textContent = head + ' (' + fmt(dur) + '). Transcribiendo subtítulos…';
      if (imgsHint) imgsHint.textContent = 'Con narración (' + fmt(dur) + '): reparto las fotos por toda la voz. Soltá las fotos para crear.';
      // arranca la transcripción en paralelo (no bloquea el armado del video). Con varios audios → transcribeMany.
      // Sin key de API, el motor de voz LOCAL arranca AQUÍ MISMO (antes recién en CREAR): mientras el
      // usuario acomoda las fotos, la voz ya se está escuchando — al darle CREAR los subtítulos suelen
      // estar listos y el plan cuadra las imágenes con la voz en el PRIMER armado, no en el segundo.
      var genK = _audioGen;
      _pendingAudioCaptionsP = transcribeLongAudio(combined).then(function (resTx) {
        if (resTx && resTx.caps && resTx.caps.length) {
          if (audioLabel && _audioGen === genK) audioLabel.textContent = head + ' + ' + resTx.caps.length + ' subtítulos automáticos desde tu voz (' + fmt(dur) + ').';
          return resTx;
        }
        if (_audioGen !== genK) return null;
        _capsInFlight = true;
        return transcribeLocalWhisper(combined, function (t) {
          if (_audioGen !== genK) return;
          if (audioLabel) audioLabel.textContent = t;
          try { if (_txProgressHook) _txProgressHook(t); } catch (eH) {}
        }, 0, null).then(function (res) {
          _capsInFlight = false;
          if (_audioGen !== genK) return null;
          if (res && res.caps && res.caps.length) {
            if (audioLabel) audioLabel.textContent = head + ' + ✓ ' + res.caps.length + ' subtítulos desde tu voz'
              + (res.full ? ' — COBERTURA COMPLETA' : (res.sparse ? ' (tramos repartidos)' : ''))
              + ' (IA local, 0 API) (' + fmt(dur) + '). Ya podés CREAR.';
            bbox('done', 'subtítulos locales listos: ' + res.caps.length + (res.full ? ' (completa)' : ''));
            return res;
          }
          if (audioLabel) audioLabel.textContent = head + ' (' + fmt(dur) + '). No pude sacar subtítulos de la voz esta vez — el video se arma igual; pegá el guion abajo solo si querés subtítulos.';
          bbox('done', 'sin subtítulos de la voz (flujo sigue)');
          return null;
        }).catch(function (eL) {
          _capsInFlight = false;
          console.warn('[whisper-upload]', eL && eL.message);
          return null;
        });
      }).catch(function (e) {
        console.warn('[transcribe]', e && e.message);
        if (audioLabel && _audioGen === genK) audioLabel.textContent = head + ' (' + fmt(dur) + '). No pude transcribir; los subtítulos saldrán del guion si lo pegás.';
        return null;
      });
    }).catch(function () {
      _pendingAudioFile = null; _pendingAudioBuf = null; _pendingAudioCaptionsP = null; _whisperCapsP = null; _audioGen++;
      if (dropAudio) dropAudio.classList.remove('loaded');
      _audioDecoding = false;
      if (audioLabel) audioLabel.textContent = '⚠ No pude leer ' + (multi ? 'esos audios' : 'ese audio') + '. Probá con MP3 o WAV.';
    });
  }
  function resetNarration() {
    _pendingAudioFile = null; _pendingAudioBuf = null; _pendingAudioCaptionsP = null; _whisperCapsP = null; _audioGen++;
    _audioDecoding = false;
    if (audioInput) { try { audioInput.value = ''; } catch (e) {} }
    if (imgsInput) { try { imgsInput.value = ''; } catch (e) {} }
    if (dropAudio) dropAudio.classList.remove('loaded');
    if (audioLabel) audioLabel.textContent = _AUDIO_LABEL0;
    if (imgsHint && _IMGS_HINT0) imgsHint.textContent = _IMGS_HINT0;
  }
  if (audioInput) audioInput.addEventListener('change', function () { if (audioInput.files && audioInput.files.length) setNarration(audioInput.files); });
  if (dropAudio) {
    dropAudio.addEventListener('dragover', function (e) { e.preventDefault(); dropAudio.classList.add('drag'); });
    dropAudio.addEventListener('dragleave', function () { dropAudio.classList.remove('drag'); });
    dropAudio.addEventListener('drop', function (e) { e.preventDefault(); dropAudio.classList.remove('drag'); if (e.dataTransfer.files && e.dataTransfer.files.length) setNarration(e.dataTransfer.files); });
  }

  fileInput.addEventListener('change', function () { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault(); drop.classList.remove('drag');
    var fs = e.dataTransfer.files; if (!fs || !fs.length) return;
    var f0 = fs[0];
    if (/^audio\//.test(f0.type) || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(f0.name || '')) { setNarration(fs); return; }
    if (/^image\//.test(f0.type)) { stageImages(fs); return; }
    loadFile(f0);
  });
  btnReset.addEventListener('click', function () { stopPlay(); btnReset.hidden = true; btnAnalyze.disabled = true; resetNarration(); resetStagedImgs(); showView('load'); });

  // ── Cambio de vista (carga / editor / plantillas) ──
  function showView(v) {
    loadView.hidden = v !== 'load';
    editorView.hidden = v !== 'editor';
    templatesView.hidden = v !== 'templates';
    var sv = $('styleView'); if (sv) sv.hidden = v !== 'style';
  }

  var ASPECTS = { 'src': null, '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1080, 1080], '4:5': [1080, 1350] };
  function computeStageSize() {
    var a = (P && P.aspect) || 'src';
    var dims = ASPECTS[a] || [ST.vw || 1280, ST.vh || 720];
    var w = dims[0], h = dims[1];
    var maxW = 1280, maxH = 1280;
    var sc = Math.min(1, maxW / w, maxH / h);
    stage.width = Math.round(w * sc / 2) * 2 || 1280;
    stage.height = Math.round(h * sc / 2) * 2 || 720;
  }

  // ════════════════════ MOTOR DE RENDER ════════════════════
  var _grain = null;
  function grainCanvas() {
    if (_grain) return _grain;
    var g = document.createElement('canvas'); g.width = 120; g.height = 68; var gx = g.getContext('2d');
    var im = gx.createImageData(g.width, g.height);
    for (var i = 0; i < im.data.length; i += 4) { var v = 120 + Math.floor((((i * 1103515245 + 12345) >>> 16) % 130)); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    gx.putImageData(im, 0, 0); _grain = g; return g;
  }
  var _vig = null, _vigKey = '';
  function vigGrad(W, H) { var k = W + 'x' + H; if (_vig && _vigKey === k) return _vig; var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); _vig = g; _vigKey = k; return g; }

  // ════════════════════════════════════════════════════════════════════════════
  // MOTOR DE KEYFRAMES (zKF) — anima scale/panX/panY/rotation/opacity por clip.
  // Evaluador PURO y determinista (manejado por el t explícito del frame → preview==export).
  // Reemplaza el cálculo de zoom/pan; computeZoom + pan inline quedan de FALLBACK.
  // ════════════════════════════════════════════════════════════════════════════
  // Solver de cubic-bezier que INVERTE x: dado p (fracción de TIEMPO, eje x), resuelve por
  // Newton-Raphson el parámetro s con bezierX(s)=p (bisección de respaldo) y RECIÉN evalúa bezierY(s).
  function cubicBezier(x1, y1, x2, y2) {
    if (x1 === y1 && x2 === y2) return function (p) { return p; };  // linear
    function bz(c1, c2, s) { var u = 1 - s; return 3 * u * u * s * c1 + 3 * u * s * s * c2 + s * s * s; }
    function dbz(c1, c2, s) { var u = 1 - s; return 3 * u * u * c1 + 6 * u * s * (c2 - c1) + 3 * s * s * (1 - c2); }
    return function (p) {
      if (p <= 0) return 0; if (p >= 1) return 1;
      var s = p, i, x, d;
      for (i = 0; i < 8; i++) {                       // Newton-Raphson sobre x
        x = bz(x1, x2, s) - p; if (Math.abs(x) < 1e-6) break;
        d = dbz(x1, x2, s); if (Math.abs(d) < 1e-6) break;   // derivada chica → corta a bisección
        s = s - x / d;
      }
      if (s < 0 || s > 1 || Math.abs(bz(x1, x2, s) - p) > 1e-4) {  // respaldo: bisección
        var lo = 0, hi = 1, m = p, j, xm;
        for (j = 0; j < 32; j++) { m = (lo + hi) / 2; xm = bz(x1, x2, m); if (Math.abs(xm - p) < 1e-6) break; if (xm < p) lo = m; else hi = m; }
        s = m;
      }
      return bz(y1, y2, s);                            // recién ahora Y
    };
  }
  var ZEASE_PTS = {  // presets = solo puntos de control; un SOLO solver detrás
    linear: [0, 0, 1, 1],
    easeInQuad: [0.11, 0, 0.5, 0], easeOutQuad: [0.5, 1, 0.89, 1], easeInOutQuad: [0.45, 0, 0.55, 1],
    easeInCubic: [0.32, 0, 0.67, 0], easeOutCubic: [0.33, 1, 0.68, 1], easeInOutCubic: [0.65, 0, 0.35, 1]
  };
  var _zEaseCache = {};  // cachea el solver compilado por preset / bezier custom
  function zEaseSolver(easing) {
    var pts, key;
    if (Object.prototype.toString.call(easing) === '[object Array]' && easing.length === 4) { key = 'b:' + easing.join(','); pts = easing; }
    else { key = String(easing || 'linear'); pts = ZEASE_PTS[key] || ZEASE_PTS.linear; }
    if (!_zEaseCache[key]) _zEaseCache[key] = cubicBezier(pts[0], pts[1], pts[2], pts[3]);
    return _zEaseCache[key];
  }
  function zEase(easing, p) { return zEaseSolver(easing)(p); }
  // PURA: interpola UNA pista en tiempo LOCAL al clip. Bordes: 0 kf→def, 1 kf→constante,
  // antes del 1º→hold, después del último→hold. easing del kf que SALE gobierna el segmento.
  function evalProp(track, tLocal, def) {
    if (!track || !track.length) return def;            // guard ANTES de .length (#4)
    var n = track.length;
    if (n === 1) return track[0].value;
    if (tLocal <= track[0].t) return track[0].value;
    if (tLocal >= track[n - 1].t) return track[n - 1].value;
    var i = 0; while (i < n - 1 && track[i + 1].t <= tLocal) i++;
    var a = track[i], b = track[i + 1], dur = b.t - a.t;
    if (dur <= 0) return b.value;
    return a.value + (b.value - a.value) * zEase(a.easing, (tLocal - a.t) / dur);
  }
  function zHasKf(tk) { return tk && tk.length > 0; }
  // Global→local y evalúa todas las pistas. Devuelve null si no hay keyframes (→ fallback).
  // pan en FRACCIÓN del lienzo (drawAt lo multiplica por W/H); pan SIN clampear (el clamp vive en cover-fit).
  function evalTransform(t) {
    var tr = P.tracks;
    if (!tr || !(zHasKf(tr.scale) || zHasKf(tr.panX) || zHasKf(tr.panY) || zHasKf(tr.rotation) || zHasKf(tr.opacity))) return null;
    var tl = t - P.trimStart;
    return { scale: evalProp(tr.scale, tl, 1), panX: evalProp(tr.panX, tl, 0), panY: evalProp(tr.panY, tl, 0), rotation: evalProp(tr.rotation, tl, 0), opacity: evalProp(tr.opacity, tl, 1) };
  }
  // ── LÍMITES DE TOMA (slideshow de imágenes fijas, duración igual) ──
  // Boundaries EXACTOS por aritmética: cada imagen dura shotSecs ⇒ corte en k*shotSecs.
  // Cero detección/cero error (el usuario confirmó duración fija por imagen).
  // Devuelve segmentos [{a,b}] en tiempo LOCAL (0 = trimStart), o null si shotMode off / inválido.
  function zShotBounds() {
    if (!P.shotMode) return null;
    var dur = Math.max(0.1, P.trimEnd - P.trimStart), sec = +P.shotSecs;
    if (_isSlideshow && _slideshowTimeline && _slideshowTimeline.length > 1) {
      // Slideshow PRECISO: los cortes reales están en los timestamps de la voz, no en k*shotSecs.
      var out = [];
      for (var ti = 0; ti < _slideshowTimeline.length; ti++) {
        var sg = _slideshowTimeline[ti];
        var la = Math.max(0, sg.start - P.trimStart), lb = Math.min(dur, sg.end - P.trimStart);
        if (lb - la > 0.05) out.push({ a: la, b: lb });
      }
      if (out.length > 1) return out;
    }
    if (!(sec > 0.2) || sec >= dur) return null;     // 1 sola toma → no tiene sentido
    var segs = [], a = 0;
    while (a < dur - 0.05) { var b = Math.min(dur, a + sec); segs.push({ a: a, b: b }); a = b; }
    return segs.length > 1 ? segs : null;
  }
  function zShotCount() { var s = zShotBounds(); return s ? s.length : 0; }

  // ── GENERADORES (migración): Ken Burns + punch-ins + zooms manuales → keyframes ──
  // Un solo motor. Solo se llama al RE-activar (no auto-migra proyectos viejos).
  function zRebuildTracks() {
    var prev = P.tracks || {};
    var ed = P.tracksEdited || (P.tracksEdited = { scale: false, panX: false, panY: false, rotation: true, opacity: true });
    var dur = Math.max(0.1, P.trimEnd - P.trimStart), I = P.kbIntensity || 0;
    var kb = !!P.kenBurns, hasZooms = !!(P.zooms && P.zooms.length), pulse = !!(P.pulse && P.pulseEvery > 0);
    // ── pistas GENERADAS (scale/pan) desde Ken Burns + punch-ins + zooms manuales ──
    var genScale = [], genPanX = [], genPanY = [];
    var shots = (kb ? zShotBounds() : null);   // por-imagen SOLO con Ken Burns activo (mueve stills, no la rampa global)
    if (shots) {
      // ── KEN BURNS POR TOMA: cada imagen recibe un movimiento FRESCO y VARIADO ──
      // Reinicia scale+pan en cada corte. Alterna zoom-in / zoom-out y rota la dirección
      // del paneo por toma → 100 imágenes no se ven monótonas. Epsilon antes de cada
      // boundary para no crear keyframes de t duplicado (evalProp colapsa dur<=0).
      var EPS = 0.04;
      // MOVIMIENTO FUERTE por toma (quita lo "estático" de un slideshow): zoom ~10-22% + pan ~4-8% DENTRO de cada imagen.
      var z0 = 1 + 0.06 + 0.04 * I, zdBase = 0.10 + 0.12 * I;   // base y delta del zoom por toma (más agresivo que antes)
      var pamp = 0.04 + 0.045 * I;                               // amplitud de paneo por toma (fracción de lienzo)
      var DIRS = [[1, 0.4], [-1, -0.4], [0.5, 1], [-0.5, -1], [1, -0.5], [-1, 0.5]];  // direcciones de paneo rotadas
      var ZPAT = [1, 1, 0, 1, 0, 0, 0, 1];   // patrón de zoom no robótico
      var zVar = function (k) { return 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(k * 1.7)); };   // 0.8..1.2 (varía profundidad por toma)
      // HELPER PURO: valor del scale-ramp por toma en tiempo local tl (NO lee el array → arregla el bug de lectura desordenada del pulse).
      function shotBaseAt(tl) {
        for (var i = 0; i < shots.length; i++) {
          var sg = shots[i]; if (tl <= sg.b || i === shots.length - 1) {
            var a = sg.a, b = Math.max(a + 0.1, sg.b), kk = clamp((tl - a) / (b - a), 0, 1);
            var zin = (ZPAT[i % ZPAT.length] === 1), zd = zdBase * zVar(i);
            var sA = zin ? z0 : (z0 + zd), sB = zin ? (z0 + zd) : z0;
            return sA + (sB - sA) * kk;
          }
        }
        return z0;
      }
      shots.forEach(function (sg, k) {
        var a = sg.a, b = Math.max(a + 0.1, sg.b), zin = (ZPAT[k % ZPAT.length] === 1);
        var zd = zdBase * zVar(k);
        var sA = zin ? z0 : (z0 + zd), sB = zin ? (z0 + zd) : z0;
        var d = DIRS[k % DIRS.length], dx = d[0] * pamp, dy = d[1] * pamp;
        var bb = b - (k < shots.length - 1 ? EPS : 0);
        genScale.push({ t: a, value: sA, easing: 'easeInOutQuad' });
        genScale.push({ t: bb, value: sB, easing: 'linear' });
        genPanX.push({ t: a, value: -dx * 0.5, easing: 'easeInOutQuad' });
        genPanX.push({ t: bb, value: dx * 0.5, easing: 'linear' });
        genPanY.push({ t: a, value: -dy * 0.5, easing: 'easeInOutQuad' });
        genPanY.push({ t: bb, value: dy * 0.5, easing: 'linear' });
      });
      // punch-ins horneados SOBRE el ramp por toma — base ANALÍTICA (shotBaseAt), no lectura de array desordenado.
      if (pulse) {
        var wS = 0.18 * P.pulseEvery, pkS = 0.07 + 0.10 * I, tpS;
        for (tpS = P.pulseEvery; tpS < dur - 0.05; tpS += P.pulseEvery) {
          genScale.push({ t: tpS, value: shotBaseAt(tpS), easing: 'easeOutQuad' });
          genScale.push({ t: tpS + wS * 0.5, value: shotBaseAt(tpS) + pkS, easing: 'easeInQuad' });
          genScale.push({ t: tpS + wS, value: shotBaseAt(tpS + wS), easing: 'linear' });
        }
      }
      (P.zooms || []).forEach(function (z) {
        var zl = z.t - P.trimStart; if (zl < 0 || zl > dur) return; var amt = (z.scale - 1);
        genScale.push({ t: Math.max(0, zl - 0.6), value: shotBaseAt(zl - 0.6), easing: 'easeOutQuad' });
        genScale.push({ t: zl, value: shotBaseAt(zl) + amt, easing: 'easeInQuad' });
        genScale.push({ t: Math.min(dur, zl + 0.6), value: shotBaseAt(zl + 0.6), easing: 'linear' });
      });
      genScale.sort(function (a, b) { return a.t - b.t; });
      genPanX.sort(function (a, b) { return a.t - b.t; });
      genPanY.sort(function (a, b) { return a.t - b.t; });
    } else if (kb || pulse || hasZooms) {
      // FIX: el ramp global era ~9%→18% en TODO el video = casi imperceptible ("muy bajo").
      // Subido a ~10%→32% de travel para que el zoom se LEA de verdad.
      var s0 = kb ? (1 + 0.08 + 0.03 * I) : 1, s1 = kb ? (s0 + 0.12 + 0.14 * I) : 1;
      var rampAt = function (tl) { return s0 + (s1 - s0) * clamp(tl / dur, 0, 1); };   // rampa lineal Ken Burns
      genScale.push({ t: 0, value: s0, easing: 'linear' });                            // 2 kf linear = parity EXACTA del ramp
      if (pulse) {  // punch-ins: bump eased por cada pulso, horneado sobre la rampa
        var w = 0.18 * P.pulseEvery, peak = 0.07 + 0.10 * I, tp;
        for (tp = P.pulseEvery; tp < dur - 0.05; tp += P.pulseEvery) {
          genScale.push({ t: tp, value: rampAt(tp), easing: 'easeOutQuad' });
          genScale.push({ t: tp + w * 0.5, value: rampAt(tp) + peak, easing: 'easeInQuad' });
          genScale.push({ t: tp + w, value: rampAt(tp + w), easing: 'linear' });
        }
      }
      (P.zooms || []).forEach(function (z) {  // zooms MANUALES: global→local
        var zl = z.t - P.trimStart; if (zl < 0 || zl > dur) return; var amt = (z.scale - 1);
        genScale.push({ t: Math.max(0, zl - 0.6), value: rampAt(zl - 0.6), easing: 'easeOutQuad' });
        genScale.push({ t: zl, value: rampAt(zl) + amt, easing: 'easeInQuad' });
        genScale.push({ t: Math.min(dur, zl + 0.6), value: rampAt(zl + 0.6), easing: 'linear' });
      });
      genScale.push({ t: dur, value: s1, easing: 'linear' });
      genScale.sort(function (a, b) { return a.t - b.t; });
      // FIX: pan era 0.012*I (~0.66% del ancho) = deriva sub-pixel invisible. Subido a ~3-5% (ahora hay headroom por el scale mayor).
      if (kb) {
        // PANEO VARIADO sin tomas por imagen: parte la duración en bloques y ROTA la dirección por
        // bloque (zHash determinista) → ya no es "siempre a la derecha". Bloque grande en videos largos (perf).
        var amp = 0.03 + 0.035 * I, BLK = clamp(dur / 24, 7, 25);
        var DIRG = [[1, 0.4], [-1, -0.5], [0.6, 1], [-0.7, 0.5], [1, -0.6], [-0.6, -1], [0.5, 0.8], [-1, 0.3]];
        genPanX = []; genPanY = [];
        for (var bi = 0, tb = 0; tb < dur - 0.05; tb += BLK, bi++) {
          var te = Math.min(dur, tb + BLK), di = DIRG[Math.floor(zHash(bi + 3) * DIRG.length) % DIRG.length];
          genPanX.push({ t: tb, value: -di[0] * amp * 0.5, easing: 'easeInOutQuad' });
          genPanX.push({ t: te, value: di[0] * amp * 0.5, easing: 'linear' });
          genPanY.push({ t: tb, value: -di[1] * amp * 0.5, easing: 'easeInOutQuad' });
          genPanY.push({ t: te, value: di[1] * amp * 0.5, easing: 'linear' });
        }
      }
    }
    // ── ensamblado: si una pista está EDITADA, el generador NO la pisa (la conserva). #5 ──
    P.tracks = {
      scale: ed.scale ? (prev.scale || []) : genScale,
      panX:  ed.panX  ? (prev.panX  || []) : genPanX,
      panY:  ed.panY  ? (prev.panY  || []) : genPanY,
      rotation: prev.rotation || [],   // el generador nunca posee rotation/opacity (su estado AUTO = vacío/def)
      opacity:  prev.opacity  || []
    };
  }

  // Test de bordes del evaluador — corré zKFSelfTest() en la consola del editor.
  // (preview==export es trivial: evalProp es PURO en t; mismo t → mismo valor. Sin pixel-diff todavía.)
  function zKFSelfTest() {
    var lin = [{ t: 1, value: 1, easing: 'linear' }, { t: 3, value: 2, easing: 'linear' }];
    var cub = [{ t: 0, value: 0, easing: 'easeInOutCubic' }, { t: 1, value: 100, easing: 'easeInOutCubic' }];
    var a25 = evalProp(cub, 0.25, 0), a50 = evalProp(cub, 0.5, 0), a75 = evalProp(cub, 0.75, 0);
    var L = [   // ESPEJO EXACTO del harness de Node (12 casos) — esta consola es la fuente de verdad
      ['0kf->def(1)', evalProp([], 5, 1) === 1],
      ['0kf null->def(0.5)', evalProp(null, 5, 0.5) === 0.5],
      ['1kf->constante', evalProp([{ t: 2, value: 1.3 }], 99, 9) === 1.3],
      ['antes del 1o->hold(1)', evalProp(lin, 0, 9) === 1],
      ['despues del ultimo->hold(2)', evalProp(lin, 10, 9) === 2],
      ['t EXACTO sobre kf interior->su valor', evalProp([{ t: 0, value: 0, easing: 'linear' }, { t: 2, value: 5, easing: 'linear' }, { t: 4, value: 9 }], 2, 0) === 5],
      ['linear medio->1.5', evalProp(lin, 2, 9) === 1.5],
      ['easeInOutCubic simetrico@0.5 (~50)', Math.abs(a50 - 50) < 2],
      ['ease-in: a0.25 < lineal(25)', a25 < 25],
      ['ease-out: a0.75 > lineal(75)', a75 > 75],
      ['bezier invierte X (a0.25 != ~15.6)', Math.abs(a25 - 15.6) > 3],
      ['determinista (misma t=misma salida)', evalProp(cub, 0.42, 0) === evalProp(cub, 0.42, 0)]
    ];
    var pass = 0; L.forEach(function (r) { if (r[1]) pass++; console.log((r[1] ? '✓' : '✗ FALLO') + ' ' + r[0]); });
    console.log('[zKF] ' + pass + '/' + L.length + ' OK  (a25=' + a25.toFixed(2) + ' a50=' + a50.toFixed(2) + ' a75=' + a75.toFixed(2) + ')'); return pass === L.length;
  }
  try { if (typeof window !== 'undefined') window.zKFSelfTest = zKFSelfTest; } catch (e) {}

  // ── HARNESS DE DEV: valida rotation/opacity en FRAME REAL (preview + export) ──
  // NO es feature de usuario. AUTO/plantillas solo generan scale/pan; rotation/opacity
  // nunca estuvieron en un frame renderizado real, solo en el self-test sintético. Esto cierra
  // ese loop. zRebuildTracks ahora preserva rotation/opacity, así sobreviven a los repaints.
  function zKFEnsure() { if (!P) return false; if (!P.tracks) zRebuildTracks(); P._kf = true; return true; }
  function zKFInjectRot(deg) {  // rampa de rotación 0→deg a lo largo del clip (animada)
    if (!zKFEnsure()) return; var dur = Math.max(0.1, P.trimEnd - P.trimStart);
    P.tracks.rotation = [{ t: 0, value: 0, easing: 'easeInOutCubic' }, { t: dur, value: (deg || 360) * Math.PI / 180, easing: 'linear' }]; repaint();
  }
  function zKFInjectFade(secs) {  // fade in/out de opacity (animado)
    if (!zKFEnsure()) return; var dur = Math.max(0.1, P.trimEnd - P.trimStart), s = Math.min(secs || 0.8, dur / 2);
    P.tracks.opacity = [{ t: 0, value: 0, easing: 'easeOutQuad' }, { t: s, value: 1, easing: 'linear' }, { t: dur - s, value: 1, easing: 'easeInQuad' }, { t: dur, value: 0, easing: 'linear' }]; repaint();
  }
  function zKFConstRot(deg) { if (!zKFEnsure()) return; P.tracks.rotation = [{ t: 0, value: (deg || 0) * Math.PI / 180 }]; repaint(); }       // rotación CONSTANTE (eyeball estático)
  function zKFConstOpacity(v) { if (!zKFEnsure()) return; P.tracks.opacity = [{ t: 0, value: clamp(v == null ? 1 : v, 0, 1) }]; repaint(); }   // opacity CONSTANTE
  function zKFClearFx() { if (P && P.tracks) { P.tracks.rotation = []; P.tracks.opacity = []; repaint(); } }
  function zKFDevPanel() {
    var ex = document.getElementById('zkf-dev'); if (ex) { ex.remove(); return; }
    var b = document.createElement('div'); b.id = 'zkf-dev';
    b.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:99999;background:#0a0c0f;border:1px solid rgba(255,255,255,0.22);border-radius:10px;padding:10px 12px;width:212px;font:11px/1.4 ui-monospace,monospace;color:#cdd6df;box-shadow:0 8px 28px rgba(0,0,0,.6);';
    function row(label, min, max, val, on) { var r = document.createElement('div'); r.style.cssText = 'margin:6px 0;'; var l = document.createElement('div'); l.textContent = label; l.style.color = '#cdd6df'; var i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.value = val; i.style.width = '100%'; i.addEventListener('input', function () { on(+i.value); }); r.appendChild(l); r.appendChild(i); return r; }
    function btn(t, on) { var x = document.createElement('button'); x.textContent = t; x.style.cssText = 'width:100%;margin-top:6px;padding:6px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.09);color:#e7ecf2;border-radius:7px;cursor:pointer;font:inherit;'; x.addEventListener('click', on); return x; }
    var h = document.createElement('div'); h.textContent = '🔧 KF DEV · rotation/opacity'; h.style.cssText = 'font-weight:800;color:#fff;margin-bottom:2px;'; b.appendChild(h);
    b.appendChild(row('Rotación constante (°)', -180, 180, 0, zKFConstRot));
    b.appendChild(row('Opacidad constante (%)', 0, 100, 100, function (v) { zKFConstOpacity(v / 100); }));
    b.appendChild(btn('▶ Ramp rotación 0→360', function () { zKFInjectRot(360); try { startPlay(); } catch (e) {} }));
    b.appendChild(btn('▶ Fade opacity in/out', function () { zKFInjectFade(0.8); try { startPlay(); } catch (e) {} }));
    b.appendChild(btn('Limpiar FX (rot+opacity)', zKFClearFx));
    b.appendChild(btn('Correr zKFSelfTest()', function () { zKFSelfTest(); }));
    (document.body || document.documentElement).appendChild(b);
  }
  try {
    if (typeof window !== 'undefined') {
      window.zKFInjectRot = zKFInjectRot; window.zKFInjectFade = zKFInjectFade; window.zKFConstRot = zKFConstRot; window.zKFConstOpacity = zKFConstOpacity; window.zKFClearFx = zKFClearFx; window.zKFDevPanel = zKFDevPanel;
      if (/[?&]kfdev=1/.test(location.search || '')) setTimeout(zKFDevPanel, 900);   // auto-abre el panel solo con ?kfdev=1
    }
  } catch (e) {}

  function computeZoom(t) {
    var span = Math.max(0.1, P.trimEnd - P.trimStart), prog = clamp((t - P.trimStart) / span, 0, 1);
    var s = 1;
    // Ken Burns VISIBLE: punch-in base claro (~9%) que deriva hasta ~19%. Antes era
    // 1 + 0.04*0.6 = 1.024 (2.4%) → invisible en un frame estático ("no aplica un zoom").
    if (P.kenBurns) s += 0.07 + 0.04 * P.kbIntensity + (0.05 + 0.08 * P.kbIntensity) * prog;
    // Punch-ins (pulse) más marcados y un poco más largos para que se noten al reproducir.
    if (P.pulse && P.pulseEvery > 0) { var cyc = (t % P.pulseEvery) / P.pulseEvery; if (cyc < 0.18) s += (0.07 + 0.10 * P.kbIntensity) * Math.sin(cyc / 0.18 * Math.PI); }
    for (var i = 0; i < P.zooms.length; i++) { var d = Math.abs(t - P.zooms[i].t); if (d < 0.6) s += (P.zooms[i].scale - 1) * (1 - d / 0.6); }
    return s;
  }

  // Parte el texto en líneas que entren en maxW (asume ctx.font seteado)
  function wrapLines(text, maxW) {
    var words = String(text || '').split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) { var test = cur ? cur + ' ' + words[i] : words[i]; if (ctx.measureText(test).width <= maxW || !cur) cur = test; else { lines.push(cur); cur = words[i]; } }
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  }
  // Ajusta el tamaño de fuente + envuelve para que SIEMPRE entre en el cuadro
  function fitWrap(text, baseFs, maxW, weight) {
    var fs = baseFs;
    for (var g = 0; g < 26; g++) {
      ctx.font = (weight || '900') + ' ' + fs + 'px Arial, sans-serif';
      var lines = wrapLines(text, maxW), mw = 0;
      for (var i = 0; i < lines.length; i++) mw = Math.max(mw, ctx.measureText(lines[i]).width);
      if (mw <= maxW || fs <= 14) return { fs: fs, lines: lines };
      fs -= 2;
    }
    return { fs: fs, lines: wrapLines(text, maxW) };
  }
  // Como fitWrap pero achica la fuente hasta que el texto entre en `maxLines` líneas
  // (no solo en ancho). Evita que el subtítulo se trunque y PIERDA palabras.
  function fitWrapMax(text, baseFs, maxW, weight, maxLines, fam) {
    var fs = baseFs, ff = fam || 'Arial, sans-serif';
    for (var g = 0; g < 30; g++) {
      ctx.font = (weight || '800') + ' ' + fs + 'px ' + ff;
      var lines = wrapLines(text, maxW), mw = 0;
      for (var i = 0; i < lines.length; i++) mw = Math.max(mw, ctx.measureText(lines[i]).width);
      if ((mw <= maxW && lines.length <= maxLines) || fs <= 13) return { fs: fs, lines: lines.slice(0, maxLines) };
      fs -= 2;
    }
    return { fs: fs, lines: wrapLines(text, maxW).slice(0, maxLines) };
  }
  function drawText(o, t, W, H) {
    var local = t - o.start, a = 1, pop = 1, dx = 0;
    if (o.anim === 'fade') a = Math.min(1, local / 0.4) * Math.min(1, (o.end - t) / 0.4);
    if (o.anim === 'pop' && local < 0.3) pop = 0.65 + 0.35 * (local / 0.3);
    if (o.anim === 'slide' && local < 0.4) dx = -(1 - local / 0.4) * W * 0.28;
    if (o.anim === 'callout') {   // énfasis sobrio: entra con scale+opacity eased (reusa zEase), sale con fade
        var IN = 0.32, OUT = 0.3, rem = o.end - t;
        var pin = local < IN ? zEase('easeOutCubic', clamp(local / IN, 0, 1)) : 1;
        pop = 0.86 + 0.14 * pin;                                  // 0.86→1.0 (sutil, no rebote chillón)
        a = (local < IN ? pin : 1) * (rem < OUT ? clamp(rem / OUT, 0, 1) : 1);
    }
    var fw = fitWrap(o.text, Math.round(H * 0.055 * (o.size || 1)), W * 0.86, '900');
    var fs = fw.fs, lines = fw.lines, lh = fs * 1.16, totalH = lines.length * lh;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = '900 ' + fs + 'px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(W / 2 + dx, H * (o.posY || 0.12)); ctx.scale(pop, pop);
    var startY = -totalH / 2 + lh / 2, bw = 0; for (var i = 0; i < lines.length; i++) bw = Math.max(bw, ctx.measureText(lines[i]).width);
    if (o.box) { ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(-bw / 2 - 16, -totalH / 2 - fs * 0.16, bw + 32, totalH + fs * 0.32); }
    ctx.lineWidth = Math.max(3, fs * 0.15); ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    for (var s = 0; s < lines.length; s++) ctx.strokeText(lines[s], 0, startY + s * lh);
    ctx.fillStyle = o.color || '#FFE14D';
    for (var s2 = 0; s2 < lines.length; s2++) ctx.fillText(lines[s2], 0, startY + s2 * lh);
    ctx.restore();
  }
  // ════════════════ TIPOGRAFÍAS + PLANTILLAS DE SUBTÍTULOS (estilo CapCut) ════════════════
  // Fuentes del sistema (existen en Windows/Mac) → tipografías visualmente distintas sin descargar nada.
  var CAP_FONTS = [
    { id: 'black',   name: 'Arial Black', stack: "'Arial Black','Arial Bold',Arial,sans-serif" },
    { id: 'impact',  name: 'Impact',      stack: "Impact,'Haettenschweiler','Arial Narrow Bold',sans-serif" },
    { id: 'trebu',   name: 'Trebuchet',   stack: "'Trebuchet MS','Segoe UI',Arial,sans-serif" },
    { id: 'verdana', name: 'Verdana',     stack: "Verdana,Geneva,sans-serif" },
    { id: 'tahoma',  name: 'Tahoma',      stack: "Tahoma,Geneva,sans-serif" },
    { id: 'georgia', name: 'Georgia',     stack: "Georgia,'Times New Roman',serif" },
    { id: 'mono',    name: 'Mono',        stack: "'Courier New',Consolas,monospace" },
    { id: 'comic',   name: 'Redondeada',  stack: "'Comic Sans MS','Chalkboard SE','Segoe UI',sans-serif" },
    { id: 'avenir',  name: 'Condensada Pro (viral)', stack: "'Avenir Next Condensed','Arial Narrow','Roboto Condensed',sans-serif" },
    { id: 'futura',  name: 'Futura (moderna)', stack: "Futura,'Century Gothic','Trebuchet MS',sans-serif" },
    { id: 'helv',    name: 'Helvetica (limpia)', stack: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
    { id: 'gill',    name: 'Gill Sans (docu BBC)', stack: "'Gill Sans','Gill Sans MT',Calibri,sans-serif" },
    { id: 'rock',    name: 'Slab (documental)', stack: "Rockwell,'Roboto Slab','Courier New',serif" },
    { id: 'copper',  name: 'Épica (historia)', stack: "Copperplate,'Copperplate Gothic Bold','Trajan Pro',serif" },
    { id: 'typew',   name: 'Máquina (true crime)', stack: "'American Typewriter','Courier New',monospace" },
    { id: 'didot',   name: 'Elegante (lujo)', stack: "Didot,'Bodoni MT','Playfair Display',Georgia,serif" }
  ];
  function capFontStack(id) { for (var i = 0; i < CAP_FONTS.length; i++) if (CAP_FONTS[i].id === id) return CAP_FONTS[i].stack; return CAP_FONTS[0].stack; }
  // Plantillas: cada una = tipografía + color + resaltado + tipo de caja + MAYÚS + posición + contorno + glow.
  var CAP_TEMPLATES = [
    { id: 'capcut',   name: 'CapCut',     font: 'black',   color: '#FFFFFF', hiColor: '#FFE14D', boxStyle: 'word',  upper: true,  posY: 0.84, stroke: 0.16, glow: 'rgba(255,255,255,0.5)' },
    { id: 'karaoke',  name: 'Karaoke',    font: 'black',   color: '#FFFFFF', hiColor: '#FFE14D', boxStyle: 'word',  upper: false, posY: 0.85, stroke: 0.16, glow: null },
    { id: 'hormozi',  name: 'Hormozi',    font: 'black',   color: '#FFFFFF', hiColor: '#00DC82', boxStyle: 'word',  upper: true,  posY: 0.82, stroke: 0.18, glow: null },
    { id: 'mrbeast',  name: 'MrBeast',    font: 'impact',  color: '#FFFFFF', hiColor: '#FFE14D', boxStyle: 'none',  upper: true,  posY: 0.82, stroke: 0.24, glow: null },
    { id: 'clasico',  name: 'Clásico',    font: 'black',   color: '#FFFFFF', hiColor: '#FFD93D', boxStyle: 'solid', upper: false, posY: 0.86, stroke: 0.16, glow: null },
    { id: 'neon',     name: 'Neón',       font: 'black',   color: '#00DC82', hiColor: '#9CFFD6', boxStyle: 'none',  upper: false, posY: 0.85, stroke: 0.10, glow: '#00DC82' },
    { id: 'doc',      name: 'Documental', font: 'georgia', color: '#FFFFFF', hiColor: '#FFD93D', boxStyle: 'solid', upper: false, posY: 0.88, stroke: 0.12, glow: null },
    { id: 'tiktok',   name: 'TikTok',     font: 'trebu',   color: '#FFFFFF', hiColor: '#FF5A5A', boxStyle: 'round', upper: false, posY: 0.74, stroke: 0.04, glow: null },
    { id: 'noticias', name: 'Noticias',   font: 'verdana', color: '#FFFFFF', hiColor: '#4FC3F7', boxStyle: 'bar',   upper: false, posY: 0.90, stroke: 0.0,  glow: null },
    { id: 'retro',    name: 'Retro',      font: 'mono',    color: '#FFB000', hiColor: '#FFE14D', boxStyle: 'solid', upper: true,  posY: 0.86, stroke: 0.10, glow: null }
  ];
  function applyCapTemplate(id) {
    var t = null; for (var i = 0; i < CAP_TEMPLATES.length; i++) if (CAP_TEMPLATES[i].id === id) t = CAP_TEMPLATES[i];
    if (!t || !P.capStyle) return;
    var cs = P.capStyle;
    cs.tpl = t.id; cs.font = t.font; cs.color = t.color; cs.hiColor = t.hiColor;
    cs.boxStyle = t.boxStyle; cs.box = (t.boxStyle !== 'none'); cs.upper = t.upper;
    cs.posY = t.posY; cs.stroke = t.stroke; cs.glow = t.glow;
  }
  function roundRect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ── ESTILO CAPCUT: resaltado PALABRA POR PALABRA (karaoke) ──
  // Píldora oscura redondeada + la palabra "activa" en caja de color que avanza con el tiempo del subtítulo.
  function drawCaptionWord(c, W, H, t, cs) {
    var stack = capFontStack(cs.font || 'black');
    var sizeMul = (cs.size || 1);
    var txt = cs.upper ? (c.text || '').toUpperCase() : (c.text || '');
    var fw = fitWrapMax(txt, Math.round(H * 0.05 * sizeMul), W * 0.84, '900', 2, stack);
    var fs = fw.fs, lines = fw.lines, lh = fs * 1.24, totalH = lines.length * lh;
    ctx.save(); ctx.font = '900 ' + fs + 'px ' + stack; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    var baseY = H * (cs.posY || 0.84), startY = baseY - totalH / 2 + lh / 2, spaceW = ctx.measureText(' ').width;
    // palabra activa: avanza con el progreso del subtítulo (efecto karaoke de CapCut)
    var allWords = txt.split(/\s+/).filter(Boolean);
    var prog = clamp((t - c.start) / Math.max(0.3, c.end - c.start), 0, 0.9999);
    var activeIdx = Math.min(allWords.length - 1, Math.floor(prog * allWords.length));
    var hi = cs.hiColor || '#FFE14D', baseCol = cs.color || '#FFFFFF';
    // medir cada línea para centrar
    var layout = [], maxLW = 0;
    for (var li = 0; li < lines.length; li++) {
      var ws = lines[li].split(/\s+/).filter(Boolean), widths = [], lw = 0;
      for (var k = 0; k < ws.length; k++) { var ww = ctx.measureText(ws[k]).width; widths.push(ww); lw += ww; }
      lw += spaceW * Math.max(0, ws.length - 1); layout.push({ words: ws, widths: widths, lineW: lw, y: startY + li * lh }); if (lw > maxLW) maxLW = lw;
    }
    // píldora de fondo
    var padX = fs * 0.5, padY = fs * 0.30;
    var pillX = W / 2 - maxLW / 2 - padX, pillY = baseY - totalH / 2 - padY, pillW = maxLW + padX * 2, pillH = totalH + padY * 2;
    if (cs.glow) { ctx.shadowColor = cs.glow; ctx.shadowBlur = fs * 0.7; } else { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = fs * 0.35; }
    ctx.fillStyle = 'rgba(8,10,14,0.86)'; roundRect(ctx, pillX, pillY, pillW, pillH, fs * 0.42); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    // dibujar palabra por palabra
    ctx.textAlign = 'left';
    var gi = 0;
    for (var L = 0; L < layout.length; L++) {
      var ln = layout[L], x = W / 2 - ln.lineW / 2;
      for (var w2 = 0; w2 < ln.words.length; w2++) {
        var word = ln.words[w2], wid = ln.widths[w2];
        if (gi === activeIdx) {   // palabra activa → caja de color + texto oscuro
          ctx.fillStyle = hi; roundRect(ctx, x - fs * 0.14, ln.y - lh / 2 + fs * 0.05, wid + fs * 0.28, lh - fs * 0.10, fs * 0.20); ctx.fill();
          ctx.fillStyle = '#0A0A0A'; ctx.fillText(word, x, ln.y);
        } else {                  // resto → blanco con contorno negro
          ctx.lineWidth = Math.max(3, fs * 0.16); ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.strokeText(word, x, ln.y);
          ctx.fillStyle = baseCol; ctx.fillText(word, x, ln.y);
        }
        x += wid + spaceW; gi++;
      }
    }
    ctx.restore();
  }

  function drawCaption(c, W, H, t) {
    var cs = P.capStyle;
    var boxStyle0 = cs.boxStyle || (cs.box ? 'solid' : 'none');
    if (boxStyle0 === 'word') { drawCaptionWord(c, W, H, t == null ? c.start : t, cs); return; }   // estilo CapCut palabra-por-palabra
    var isKey = !!(c.key && cs.hi !== false);   // dato importante (fecha/cifra) + resaltado activado
    var sizeMul = (cs.size || 1) * (isKey ? 1.16 : 1);   // los clave salen un poco más grandes
    var stack = capFontStack(cs.font || 'black');
    var boxStyle = cs.boxStyle || (cs.box ? 'solid' : 'none');   // compat con proyectos viejos (box booleano)
    var txt = cs.upper ? (c.text || '').toUpperCase() : c.text;
    var fw = fitWrapMax(txt, Math.round(H * 0.046 * sizeMul), (boxStyle === 'bar' ? W * 0.95 : W * 0.9), '900', 2, stack);
    var fs = fw.fs, lines = fw.lines, lh = fs * 1.16, totalH = lines.length * lh;
    ctx.save(); ctx.font = "900 " + fs + "px " + stack; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var x = W / 2, baseY = H * (cs.posY || 0.86), startY = baseY - totalH / 2 + lh / 2, bw = 0;
    for (var i = 0; i < lines.length; i++) bw = Math.max(bw, ctx.measureText(lines[i]).width);
    var fill = (isKey ? (cs.hiColor || '#FFD93D') : (cs.color || '#FFFFFF'));
    var padX = 14, padY = fs * 0.13, bx = x - bw / 2 - padX, by = baseY - totalH / 2 - padY, bwid = bw + padX * 2, bhei = totalH + padY * 2;
    // ── FONDO según la plantilla ──
    if (boxStyle === 'bar') { ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, by, W, bhei); }
    else if (boxStyle === 'round') { ctx.fillStyle = isKey ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.62)'; roundRect(ctx, bx, by, bwid, bhei, fs * 0.45); ctx.fill(); }
    else if (boxStyle === 'solid') {
      ctx.fillStyle = isKey ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bwid, bhei);
      if (isKey) { ctx.strokeStyle = fill; ctx.lineWidth = Math.max(2, fs * 0.06); ctx.strokeRect(bx, by, bwid, bhei); }
    } else if (boxStyle === 'keybox' && isKey) {   // Hormozi: solo el dato clave va en caja de color
      ctx.fillStyle = fill; roundRect(ctx, bx, by, bwid, bhei, fs * 0.18); ctx.fill(); fill = '#0A0A0A';
    }
    // ── GLOW (neón) ──
    if (cs.glow) { ctx.shadowColor = cs.glow; ctx.shadowBlur = fs * 0.5; }
    // ── CONTORNO + TEXTO ──
    var strokeR = (cs.stroke == null ? 0.16 : cs.stroke);
    if (strokeR > 0) {
      ctx.lineWidth = Math.max(3, fs * strokeR * (isKey ? 1.3 : 1)); ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.lineJoin = 'round';
      for (var s = 0; s < lines.length; s++) ctx.strokeText(lines[s], x, startY + s * lh);
    }
    ctx.fillStyle = fill;
    for (var s2 = 0; s2 < lines.length; s2++) ctx.fillText(lines[s2], x, startY + s2 * lh);
    ctx.restore();
  }

  // ── TRANSICIONES entre cortes (capa de video, debajo de texto/subs) ───────────
  // El video es una sola toma, así que SIMULAMOS cortes: cada transEvery segundos
  // disparamos una transición real (flash, fundido a negro, zoom-blur, whip, glitch, RGB).
  var TRANS_KINDS = ['flash', 'dip', 'zoomblur', 'whip', 'glitch', 'rgb', 'slidedown'];
  var TRANS_LABEL = { flash: 'Flash', dip: 'Fundido', zoomblur: 'Zoom blur', whip: 'Whip', glitch: 'Glitch', rgb: 'RGB split', slidedown: 'Baja (slide)' };
  var TRANS_ICON = { flash: '', dip: '◐', zoomblur: '◎', whip: '»', glitch: '▦', rgb: '◑', slidedown: '' };
  // Genera instancias de transición en los cortes (cada transEvery seg) según el estilo elegido.
  // Cada instancia es un CLIP en la línea de tiempo: se ve, se arrastra y se borra (estilo CapCut).
  function genTransitions() {
    var out = []; if (!P.transition || P.transition === 'none') return out;
    var span = Math.max(1, P.trimEnd - P.trimStart);
    var every = P.transEvery > 0 ? P.transEvery : 4, MAX = 40;
    if (span / every > MAX) every = span / MAX;   // en videos largos ensancha el espaciado → máx 40 clips (timeline usable)
    var i = 1;
    for (var t = P.trimStart + every; t < P.trimEnd - 0.15 && out.length < MAX; t += every) {
      out.push({ t: t, kind: P.transition === 'mix' ? TRANS_KINDS[(i - 1) % TRANS_KINDS.length] : P.transition });
      i++;
    }
    return out;
  }
  // Transiciones EN LOS CORTES REALES (un corte por imagen) cuando shotMode está activo.
  // Reusa P.transitions {t,kind}: una transición sutil en cada boundary de toma.
  function genShotTransitions() {
    var segs = zShotBounds(); if (!segs || !P.shotTrans) return [];
    var kind = P.shotTransKind || 'mix', out = [], MAX = 200;   // 1 por imagen; tope alto pero acotado
    for (var k = 1; k < segs.length && out.length < MAX; k++) {   // empieza en el 2º (no hay corte antes de la 1ª imagen)
      var tg = P.trimStart + segs[k].a;   // a = inicio de toma en local → global
      out.push({ t: tg, kind: kind === 'mix' ? TRANS_KINDS[(k - 1) % TRANS_KINDS.length] : kind });
    }
    return out;
  }
  function renderTransition(kind, bell, dt, W, H) {
    ctx.save();
    try {
      if (kind === 'flash') { ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * bell) + ')'; ctx.fillRect(0, 0, W, H); }
      else if (kind === 'dip') { ctx.fillStyle = 'rgba(0,0,0,' + (0.95 * bell) + ')'; ctx.fillRect(0, 0, W, H); }
      else if (kind === 'zoomblur') { var zs = 1 + 0.2 * bell; ctx.globalAlpha = 0.6 * bell; ctx.filter = 'blur(' + (9 * bell) + 'px)'; var dw = W * zs, dh = H * zs; ctx.drawImage(stage, (W - dw) / 2, (H - dh) / 2, dw, dh); }
      else if (kind === 'whip') { var off = (dt < 0 ? -1 : 1) * W * 0.4 * (1 - bell); ctx.globalAlpha = 0.5 * bell; ctx.filter = 'blur(' + (6 * bell) + 'px)'; ctx.drawImage(stage, off, 0, W, H); }
      else if (kind === 'glitch') {
        var sl = 8; for (var i = 0; i < sl; i++) { var sy = (i / sl) * H, sh = H / sl, ox = (Math.random() - 0.5) * W * 0.14 * bell; ctx.drawImage(stage, 0, sy, W, sh, ox, sy, W, sh); }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16 * bell; ctx.fillStyle = '#ff0044'; ctx.fillRect(0, 0, W, H * 0.5); ctx.fillStyle = '#00e6ff'; ctx.fillRect(0, H * 0.5, W, H * 0.5);
      }
      else if (kind === 'rgb') { var s2 = W * 0.014 * bell; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.34 * bell; ctx.drawImage(stage, -s2, 0, W, H); ctx.drawImage(stage, s2, 0, W, H); }
      else if (kind === 'slidedown') {
        // La imagen "baja" hacia la siguiente: copia el frame y lo desliza de arriba hacia abajo
        // con un leve desenfoque de movimiento. Pico en el centro de la ventana (bell≈1).
        var dy = (1 - bell) * H * (dt < 0 ? -1 : 1) * -1;   // antes del corte sube, después baja (sensación de scroll)
        dy = (dt < 0 ? -(1 - bell) * H : (1 - bell) * H);   // simple: entra desde arriba bajando
        ctx.globalAlpha = Math.min(1, 0.85 + bell * 0.15); ctx.filter = 'blur(' + (3 * bell) + 'px)';
        try { ctx.drawImage(stage, 0, dy, W, H); } catch (e) {}
      }
    } catch (e) {}
    ctx.restore();
  }
  function drawTransitions(t, W, H) {
    var arr = P.transitions || [], win = 0.34;
    for (var i = 0; i < arr.length; i++) {
      var dt = t - arr[i].t; if (Math.abs(dt) > win) continue;
      var bell = Math.max(0, Math.sin(((dt + win) / (2 * win)) * Math.PI));
      renderTransition(arr[i].kind, bell, dt, W, H);
    }
  }
  // ── EFECTOS continuos: letterbox cine, light leak (fuga de luz), aberración cromática ──
  function drawFx(t, W, H) {
    var fx = P.fx || {};
    if (fx.chroma) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.13; try { ctx.drawImage(stage, -W * 0.004, 0, W, H); ctx.drawImage(stage, W * 0.004, 0, W, H); } catch (e) {} ctx.restore(); }
    if (fx.lightLeak) {
      var prog = (((t - P.trimStart) % 7) / 7);
      var cx = W * (0.12 + 0.76 * prog), cy = H * (0.18 + 0.1 * Math.sin(prog * 6.28));
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
      g.addColorStop(0, 'rgba(255,170,70,0.24)'); g.addColorStop(0.6, 'rgba(255,120,60,0.08)'); g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (fx.letterbox) { var bar = Math.round(H * 0.11); ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); ctx.restore(); }
  }

  // ════════════════ CINE VIVO ════════════════
  // Convierte imágenes estáticas en "video filmado": deriva de cámara orgánica (no robótica) +
  // partículas atmosféricas en movimiento + luz volumétrica que barre. 100% determinista
  // (solo depende de t) → el preview es idéntico al export, frame por frame. Sin IA, sin costo.
  function zHash(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }   // pseudo-aleatorio fijo por índice
  function zLiveGate(t) {   // amplitud 0..1 según "solo primeros N seg" (0 = todo el video), con fade out de 1s
    var L = P.liveFilm; if (!L || !L.on) return 0;
    if (!L.secs || L.secs <= 0) return 1;
    var rel = t - P.trimStart; if (rel > L.secs) return 0;
    return rel > L.secs - 1 ? Math.max(0, L.secs - rel) : 1;
  }
  function zLiveDrift(t) {   // deriva de cámara: suma de senos a frecuencias inconmensurables = movimiento humano, no loop robótico
    var amp = zLiveGate(t); if (!amp) return null;
    var I = P.liveFilm.intensity == null ? 0.6 : P.liveFilm.intensity, k = I * amp;
    return {
      dx: (Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.91 + 1.3) * 0.4) * 0.020 * k,
      dy: (Math.cos(t * 0.29 + 0.7) * 0.6 + Math.sin(t * 0.67 + 2.1) * 0.4) * 0.016 * k,
      ds: 1 + (Math.sin(t * 0.23) * 0.5 + 0.5) * 0.05 * k,
      I: I, amp: amp
    };
  }
  function drawLiveFilm(t, W, H) {   // capa atmosférica: rayo de luz + polvo flotante (determinista)
    var amp = zLiveGate(t); if (!amp) return;
    var L = P.liveFilm, I = L.intensity == null ? 0.6 : L.intensity;
    ctx.save();
    if (L.lightRay) {   // luz volumétrica que barre lento de lado a lado
      var sweep = Math.sin(t * 0.16) * 0.5 + 0.5, cx = W * (0.12 + sweep * 0.76);
      var g = ctx.createLinearGradient(cx - W * 0.28, 0, cx + W * 0.28, H);
      g.addColorStop(0, 'rgba(255,242,214,0)'); g.addColorStop(0.5, 'rgba(255,242,214,' + (0.06 * I * amp) + ')'); g.addColorStop(1, 'rgba(255,242,214,0)');
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    }
    if (L.dust) {   // partículas de polvo: cada una flota con deriva diagonal lenta + bob senoidal + parpadeo
      var N = Math.round(34 * I) + 14;
      for (var i = 0; i < N; i++) {
        var sx = zHash(i), sy = zHash(i + 99), ss = zHash(i + 7), spd = 0.05 + zHash(i + 33) * 0.13;
        var px = ((sx + t * spd * 0.03) % 1) * W;
        var py = ((((sy - t * spd * 0.05) % 1) + 1) % 1) * H + Math.sin(t * spd * 2 + i) * 7;
        var r = 0.6 + ss * 1.9, a = (0.12 + 0.5 * (Math.sin(t * spd * 3 + i * 1.7) * 0.5 + 0.5)) * I * amp;
        ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = 'rgba(255,250,236,1)';
        ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ── BRASAS / CENIZAS DE FUEGO (nicho "historias para dormir" / chimenea) ──
  // Partículas naranjas que SUBEN con vaivén + parpadeo, glow aditivo. 100% determinista (zHash + t) → frame-exacto en export.
  function drawEmbers(t, W, H) {
    var E = P.embers; if (!E || !E.on) return;
    var I = E.intensity == null ? 0.6 : E.intensity;
    var N = Math.round(80 * I) + 24;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';   // brillo aditivo (las brasas iluminan)
    for (var i = 0; i < N; i++) {
      var sx = zHash(i), sy = zHash(i + 51), ss = zHash(i + 17), spd = 0.06 + zHash(i + 91) * 0.17;
      var prog = (((sy + t * spd * 0.07) % 1) + 1) % 1;          // 0→1 en bucle (recorrido de abajo hacia arriba)
      var py = H * (1.05 - prog * 1.10);                          // nace abajo, sube y sale por arriba
      var sway = Math.sin(t * (0.5 + ss) + i * 1.3) * (W * 0.013);
      var px = ((sx + t * spd * 0.012) % 1) * W + sway;
      var r = (0.9 + ss * 2.3) * (0.7 + I * 0.6);
      var flick = 0.45 + 0.55 * (Math.sin(t * (3 + ss * 4) + i * 2.1) * 0.5 + 0.5);   // parpadeo de brasa
      var fade = Math.sin(prog * Math.PI);                        // aparece y se apaga (más brillante a media altura)
      var a = clamp(0.6 * flick * fade * I, 0, 0.92);
      if (a < 0.02) continue;
      var grd = ctx.createRadialGradient(px, py, 0, px, py, r * 3.4);
      grd.addColorStop(0, 'rgba(255,238,190,' + a + ')');         // núcleo cálido
      grd.addColorStop(0.4, 'rgba(255,150,40,' + (a * 0.72) + ')'); // naranja brasa
      grd.addColorStop(1, 'rgba(255,90,20,0)');                   // se disuelve
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(px, py, r * 3.4, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // ════════════════ AVATAR (overlay encima de las imágenes — video talking-head o imagen) ════════════════
  function avatarSrcDims() {
    if (P.avatar.kind === 'video') return [avatarVid.videoWidth || 16, avatarVid.videoHeight || 9];
    if (_avatarImg) return [_avatarImg.naturalWidth || _avatarImg.width || 16, _avatarImg.naturalHeight || _avatarImg.height || 9];
    return [16, 9];
  }
  // ¿se ve el avatar en el tiempo t? — siempre / por tramos (intermitente) / segmentos manuales ("a ratos / cortado")
  function avatarVisibleAt(t) {
    var A = P.avatar; if (!A || !A.on) return false;
    if (A.mode === 'intervals') { var per = Math.max(1, (A.onSecs || 8) + (A.offSecs || 6)); var ph = (((t - P.trimStart) % per) + per) % per; return ph < (A.onSecs || 8); }
    if (A.mode === 'segments') { var s = A.segs || []; for (var i = 0; i < s.length; i++) if (t >= s[i][0] && t <= s[i][1]) return true; return false; }
    return true;   // 'always' = siempre encima de las imágenes
  }
  function drawAvatar(t, W, H) {
    var A = P.avatar; if (!A || !A.on || !_avatarReady) return;
    if (!avatarVisibleAt(t)) return;
    var srcEl = (A.kind === 'video') ? avatarVid : _avatarImg; if (!srcEl) return;
    var sd = avatarSrcDims(), ar = sd[0] / sd[1];
    var w = Math.max(48, W * (A.scale || 0.3)), h = w / ar, m = W * 0.03;
    var x, y;
    switch (A.pos) {
      case 'tl': x = m; y = m; break;
      case 'tr': x = W - w - m; y = m; break;
      case 'bl': x = m; y = H - h - m; break;
      case 'bc': x = (W - w) / 2; y = H - h - m; break;
      case 'cc': x = (W - w) / 2; y = (H - h) / 2; break;
      default:   x = W - w - m; y = H - h - m; break;   // 'br' por defecto
    }
    ctx.save();
    ctx.globalAlpha = clamp(A.opacity == null ? 1 : A.opacity, 0, 1);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = w * 0.06; ctx.shadowOffsetY = h * 0.02;
    if (A.shape === 'circle') {
      var d = Math.min(w, h), cx = x + w / 2, cy = y + h / 2;
      ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, 6.283); ctx.closePath(); ctx.save(); ctx.clip();
      var cov = Math.max(d / sd[0], d / sd[1]), dw = sd[0] * cov, dh = sd[1] * cov;
      try { ctx.drawImage(srcEl, cx - dw / 2, cy - dh / 2, dw, dh); } catch (e) {}
      ctx.restore();
      if (A.border) { ctx.shadowBlur = 0; ctx.lineWidth = Math.max(2, d * 0.02); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, 6.283); ctx.stroke(); }
    } else {
      var r = A.round || 0;
      roundRect(ctx, x, y, w, h, r); ctx.save(); ctx.clip();
      var cov2 = Math.max(w / sd[0], h / sd[1]), dw2 = sd[0] * cov2, dh2 = sd[1] * cov2;
      try { ctx.drawImage(srcEl, x + (w - dw2) / 2, y + (h - dh2) / 2, dw2, dh2); } catch (e) {}
      ctx.restore();
      if (A.border) { ctx.shadowBlur = 0; ctx.lineWidth = Math.max(2, w * 0.012); ctx.strokeStyle = 'rgba(255,255,255,0.92)'; roundRect(ctx, x, y, w, h, r); ctx.stroke(); }
    }
    ctx.restore();
  }
  // SINCRONÍA: el avatar-video sigue al video principal por eventos → anda igual en preview, export turbo (16x) y export compatible.
  function avatarMirror() {
    if (!P.avatar || !P.avatar.on || P.avatar.kind !== 'video' || !_avatarReady) return;
    try {
      var dur = avatarVid.duration || 0;
      var at = dur ? clamp(srcVideo.currentTime, 0, Math.max(0, dur - 0.05)) : 0;
      if (Math.abs((avatarVid.currentTime || 0) - at) > 0.4) { try { avatarVid.currentTime = at; } catch (e) {} }
      try { avatarVid.playbackRate = srcVideo.playbackRate || 1; } catch (e) {}
      // VOZ: suena en preview si el usuario activó "incluir voz"; durante el export va mudo (su audio se mezcla aparte en el MP4).
      try { avatarVid.muted = ST.rendering ? true : !P.avatar.audio; avatarVid.volume = clamp(P.avatar.audioVol == null ? 1 : P.avatar.audioVol, 0, 1); } catch (e) {}
      if (!srcVideo.paused) { if (avatarVid.paused) avatarVid.play().catch(function () {}); }
      else { if (!avatarVid.paused) avatarVid.pause(); }
    } catch (e) {}
  }
  // Ventanas [inicio,fin] (tiempo de video) donde el avatar se ve → se usa para que su VOZ suene sólo cuando aparece.
  function avatarVisibleWindows(t0, t1) {
    var A = P.avatar; if (!A || !A.on) return [];
    if (A.mode === 'segments') { return (A.segs || []).map(function (s) { return [Math.max(t0, s[0]), Math.min(t1, s[1])]; }).filter(function (s) { return s[1] > s[0]; }); }
    if (A.mode === 'intervals') {
      var per = Math.max(1, (A.onSecs || 8) + (A.offSecs || 6)), out = [];
      var startPhase = (((t0 - P.trimStart) % per) + per) % per, cur = t0 - startPhase;
      for (; cur < t1; cur += per) { var ws = Math.max(t0, cur), we = Math.min(t1, cur + (A.onSecs || 8)); if (we > ws) out.push([ws, we]); }
      return out;
    }
    return [[t0, t1]];   // always
  }
  srcVideo.addEventListener('play', avatarMirror);
  srcVideo.addEventListener('pause', function () { try { if (!avatarVid.paused) avatarVid.pause(); } catch (e) {} });
  srcVideo.addEventListener('seeked', avatarMirror);
  srcVideo.addEventListener('ratechange', avatarMirror);

  // ════════════════ SEGUIR PERSONAJE (detección de caras) ════════════════
  // Usa face-api (local, ya incluido). Escanea el video tomando muestras cada ~0.5s, detecta la cara
  // más prominente en cada muestra y guarda su caja. Después, en cada frame, interpola hacia la cara
  // más cercana en el tiempo y aplica zoom + flecha + anillo. 100% determinista (las cajas quedan fijas).
  var _faceModelP = null;
  function faceLoadModel() {
    if (_faceModelP) return _faceModelP;
    if (typeof faceapi === 'undefined') { _faceModelP = Promise.resolve(false); return _faceModelP; }
    var url = '';
    try { if (chrome && chrome.runtime && chrome.runtime.getURL) url = chrome.runtime.getURL('lib/face-api/'); } catch (e) {}
    if (!url) url = '../lib/face-api/';
    _faceModelP = faceapi.nets.tinyFaceDetector.loadFromUri(url).then(function () { return true; }).catch(function (e) { console.warn('[face] load fail', e); _faceModelP = null; return false; });
    return _faceModelP;
  }
  function faceScan(onProgress) {
    return faceLoadModel().then(function (ok) {
      if (!ok) return { ok: false, err: 'no-model' };
      var span = Math.max(0.1, P.trimEnd - P.trimStart);
      var step = Math.min(0.6, Math.max(0.35, span / 60));   // ~0.35–0.6s por muestra, máx ~100 muestras
      var times = []; for (var tt = P.trimStart; tt <= P.trimEnd; tt += step) times.push(tt);
      var shots = [], i = 0, opt = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
      var wasPlaying = ST.playing; try { stopPlay(); } catch (e) {}
      function seekP(time) { return new Promise(function (res) { function on() { srcVideo.removeEventListener('seeked', on); setTimeout(res, 20); } srcVideo.addEventListener('seeked', on); try { srcVideo.currentTime = time; } catch (e) { res(); } }); }
      return (function loop() {
        if (i >= times.length) return Promise.resolve({ ok: true, shots: shots });
        var time = times[i++];
        if (onProgress) onProgress(i / times.length);
        return seekP(time).then(function () {
          return faceapi.detectAllFaces(srcVideo, opt).then(function (dets) {
            if (dets && dets.length) {
              dets.sort(function (a, b) { return (b.box.width * b.box.height) - (a.box.width * a.box.height); });
              var bx = dets[0].box, vw = srcVideo.videoWidth || 1, vh = srcVideo.videoHeight || 1;
              shots.push({ t: time, x: (bx.x + bx.width / 2) / vw, y: (bx.y + bx.height / 2) / vh, w: bx.width / vw, h: bx.height / vh });
            }
            return loop();
          }).catch(function () { return loop(); });
        });
      })();
    });
  }
  function faceActiveAt(t) {   // cara vigente en t (la más cercana dentro de su ventana "hold"), interpolada suave
    var F = P.face; if (!F || !F.on || !F.shots || !F.shots.length) return null;
    var hold = F.hold || 2.2, best = null, bd = 1e9;
    for (var i = 0; i < F.shots.length; i++) { var d = Math.abs(F.shots[i].t - t); if (d < bd) { bd = d; best = F.shots[i]; } }
    if (!best || bd > hold) return null;
    var edge = 0.4, amp = bd > hold - edge ? Math.max(0, (hold - bd) / edge) : 1;   // fade en los bordes de la ventana
    return { x: best.x, y: best.y, w: best.w, h: best.h, amp: amp };
  }
  function drawFaceFx(t, W, H) {   // flecha + anillo señalando la cara (el zoom se aplica en el transform)
    var F = P.face; if (!F || !F.on || F.mode === 'zoom') return;
    var fa = faceActiveAt(t); if (!fa) return;
    var cx = fa.x * W, cy = fa.y * H, rw = Math.max(fa.w * W, fa.h * H) * 0.62, a = fa.amp;
    ctx.save();
    // anillo de resalte
    ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = '#00DC82'; ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.shadowColor = 'rgba(0,220,130,0.8)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(cx, cy, rw, 0, 6.283); ctx.stroke();
    ctx.shadowBlur = 0;
    // flecha animada que apunta a la cara desde arriba-izquierda (bob suave)
    var bob = Math.sin(t * 3) * (W * 0.012);
    var tipX = cx - rw * 0.75, tipY = cy - rw * 0.75 + bob;     // punta cerca del anillo
    var tailX = tipX - W * 0.085, tailY = tipY - H * 0.085;     // cola arriba-izq
    ctx.globalAlpha = a; ctx.strokeStyle = '#00DC82'; ctx.fillStyle = '#00DC82';
    ctx.lineWidth = Math.max(3, W * 0.006); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(tipX, tipY); ctx.stroke();
    var ang = Math.atan2(tipY - tailY, tipX - tailX), hl = W * 0.026;   // cabeza de flecha
    ctx.beginPath(); ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - hl * Math.cos(ang - 0.5), tipY - hl * Math.sin(ang - 0.5));
    ctx.lineTo(tipX - hl * Math.cos(ang + 0.5), tipY - hl * Math.sin(ang + 0.5));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ════════════════ SEÑALAR (flechas DIBUJADAS A MANO) ════════════════
  // El usuario hace click en el canvas y coloca una flecha. Se DIBUJA SOLA (trazo progresivo) con
  // leve temblor = como si una persona la dibujara con marcador. Determinista (solo depende de t).
  // Traza una polilínea revelando la fracción `prog` (0..1) — la "mano" dibujando.
  function sketchStroke(pts, prog) {
    if (!pts || pts.length < 2) return;
    var n = pts.length - 1, lastF = clamp(prog, 0, 1) * n;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var s = 1; s <= n; s++) {
      if (s <= lastF) { ctx.lineTo(pts[s][0], pts[s][1]); }
      else { var f = lastF - (s - 1); if (f > 0) ctx.lineTo(pts[s - 1][0] + (pts[s][0] - pts[s - 1][0]) * f, pts[s - 1][1] + (pts[s][1] - pts[s - 1][1]) * f); break; }
    }
    ctx.stroke();
  }
  // Línea con temblor perpendicular (cero en los extremos) = trazo de mano, no recta de regla.
  function wobblyLine(x0, y0, x1, y1, amp, seed) {
    var dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    var segs = Math.max(6, Math.round(len / 16)), out = [];
    for (var s = 0; s <= segs; s++) { var f = s / segs; var w = (Math.sin(f * 5.3 + seed) * 0.55 + (zHash(seed + s) - 0.5)) * amp * Math.sin(f * Math.PI); out.push([x0 + dx * f + nx * w, y0 + dy * f + ny * w]); }
    return out;
  }
  function drawAnnos(t, W, H) {
    if (!P.annos || !P.annos.length) return;
    var animating = ST.playing || ST.rendering;                       // anima el "dibujado" solo al reproducir/exportar
    for (var i = 0; i < P.annos.length; i++) {
      var an = P.annos[i]; if (t < an.start || t > an.end) continue;
      var draw = animating ? clamp((t - an.start) / 0.45, 0, 1) : 1;   // PAUSADO ⇒ flecha COMPLETA (la ves al colocarla)
      var fade = (an.end - t < 0.3) ? Math.max(0, (an.end - t) / 0.3) : 1;
      var col = an.color || '#00DC82', cx = an.x * W, cy = an.y * H, R = (an.r || 0.09) * Math.min(W, H);
      // EMOJI (👉 automático en momentos clave): se dibuja con fillText + pop + bob, NO con líneas.
      if (an.kind === 'emoji') {
        var loc = t - an.start, popE = (animating && loc < 0.3) ? (0.55 + 0.45 * (loc / 0.3)) : 1;   // entra con un "pop"
        var sz = R * 2.2 * popE, seedE = (an.id ? an.id.length : i) * 1.7;
        var bobE = Math.sin(t * 3 + seedE) * (R * 0.10);   // rebote para que llame la atención
        ctx.save(); ctx.globalAlpha = fade;
        ctx.font = sz + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
        try { ctx.fillText(an.emoji || '👉', cx, cy + bobE); } catch (e) {}
        ctx.restore();
        continue;
      }
      var seed = (an.id ? (an.id.charCodeAt(an.id.length - 1) + an.id.length) : i) * 1.7;
      var bob = Math.sin(t * 2.6 + seed) * (R * 0.04);               // bob sutil tras dibujarse
      // Geometría de la flecha: punta en (cx,cy), cola sale según el ángulo (default arriba-izq)
      var ang = (an.ang == null ? 2.356 : an.ang), len = R * 2.1;
      var tipX = cx, tipY = cy + bob, tailX = cx + Math.cos(ang) * len, tailY = cy + Math.sin(ang) * len + bob;
      var lw = Math.max(3.5, W * 0.0075), amp = lw * 1.4;            // grosor de marcador + temblor de mano
      ctx.save(); ctx.globalAlpha = fade; ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2;
      // El asta se dibuja en el primer 75% del trazo; la punta en el 25% final.
      var shaftP = clamp(draw / 0.75, 0, 1);
      sketchStroke(wobblyLine(tailX, tailY, tipX, tipY, amp, seed), shaftP);
      if (draw > 0.72) {
        var headP = clamp((draw - 0.72) / 0.28, 0, 1);
        var hl = R * 0.78, ha = Math.atan2(tipY - tailY, tipX - tailX);
        var bx = tipX - hl * Math.cos(ha - 0.42), by = tipY - hl * Math.sin(ha - 0.42);   // ala 1
        var dx2 = tipX - hl * Math.cos(ha + 0.42), dy2 = tipY - hl * Math.sin(ha + 0.42); // ala 2
        sketchStroke(wobblyLine(bx, by, tipX, tipY, amp * 0.7, seed + 3), headP);
        if (headP > 0) sketchStroke(wobblyLine(tipX, tipY, dx2, dy2, amp * 0.7, seed + 6), headP);
      }
      ctx.restore();
    }
  }

  function drawAt(t) {
    var W = stage.width, H = stage.height;
    ctx.save(); ctx.clearRect(0, 0, W, H);
    var sx = 0, sy = 0;
    if (P.shake) { sx = (Math.random() - 0.5) * W * 0.012; sy = (Math.random() - 0.5) * H * 0.012; }
    var span = Math.max(0.1, P.trimEnd - P.trimStart), prog = clamp((t - P.trimStart) / span, 0, 1);
    // ── transform por frame: motor de keyframes (evalTransform) si hay P.tracks; si no, FALLBACK al look viejo ──
    var T = evalTransform(t), scale, panXpx, panYpx, rot = 0, alpha = 1;
    if (T) { scale = T.scale; panXpx = T.panX * W; panYpx = T.panY * H; rot = T.rotation || 0; alpha = (T.opacity == null ? 1 : T.opacity); }
    else { scale = computeZoom(t); panXpx = P.kenBurns ? Math.sin(prog * Math.PI * 2) * 0.012 * W * P.kbIntensity : 0; panYpx = P.kenBurns ? Math.cos(prog * Math.PI * 1.4) * 0.01 * H * P.kbIntensity : 0; }
    // CINE VIVO: deriva orgánica de cámara sumada al transform (hace que la imagen "respire" como video filmado)
    var LD = drawLiveFilm._lastDrift = zLiveDrift(t);
    if (LD) { panXpx += LD.dx * W; panYpx += LD.dy * H; scale *= LD.ds; }
    // BREATHING: zoom infinito que nunca para — coseno suave acerca/retrocede sin fin (siempre activo en AUTO).
    if (P.breath && P.breath.on) {
      var per = Math.max(1, P.breath.period || 5), am = (P.breath.amt == null ? 0.06 : P.breath.amt);
      scale *= 1 + am * (0.5 - 0.5 * Math.cos((t - P.trimStart) / per * Math.PI * 2));   // 0..2*am, en bucle
    }
    // SEGUIR PERSONAJE: si hay cara vigente y el modo incluye zoom, encuadra la cara (zoom + recentrado)
    var FA = (P.face && P.face.on && P.face.mode !== 'arrow') ? faceActiveAt(t) : null;
    if (FA) {
      var fz = 1 + ((P.face.zoom || 1.7) - 1) * FA.amp;   // zoom suave según ventana
      scale *= fz;
      // centra la cara: lleva su posición (0..1) hacia el centro. pan en px sobre el frame ya escalado.
      panXpx += (0.5 - FA.x) * W * fz * FA.amp;
      panYpx += (0.5 - FA.y) * H * fz * FA.amp;
    }
    // headroom: cobertura mínima (shake siempre; Ken Burns solo en fallback — en keyframes se respeta el scale autorado)
    if (P.shake || LD || (!T && P.kenBurns)) { var need = 1 + (P.shake ? 0.03 : 0) + (LD ? 0.06 : 0) + (P.kenBurns ? 0.03 * (P.kbIntensity || 0) : 0); if (scale < need) scale = need; }
    var g = GRADES[P.grade] || GRADES.none;
    // cover-fit: el video llena el lienzo sin deformarse (recorta el excedente). Sirve para 16:9, 9:16 Shorts, 1:1, etc.
    var vw = ST.vw || W, vh = ST.vh || H;
    var cover = Math.max(W / vw, H / vh);
    var dw = vw * cover * scale, dh = vh * cover * scale;
    // CLAMP del pan contra el headroom del scale actual (se queda acá, en el cover-fit; evalProp es puro)
    var maxX = Math.max(0, (dw - W) / 2), maxY = Math.max(0, (dh - H) / 2);
    panXpx = clamp(panXpx, -maxX, maxX); panYpx = clamp(panYpx, -maxY, maxY);
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    if (rot) { ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.translate(-W / 2, -H / 2); }   // rotación con pivote CENTRAL (#3)
    ctx.filter = g.filter || 'none';
    try { ctx.drawImage(srcVideo, (W - dw) / 2 + panXpx + sx, (H - dh) / 2 + panYpx + sy, dw, dh); } catch (e) {}
    ctx.filter = 'none';
    ctx.restore();
    if (g.wash) { ctx.fillStyle = g.wash; ctx.fillRect(0, 0, W, H); }
    if (P.grain) { ctx.globalAlpha = 0.11; ctx.drawImage(grainCanvas(), (Math.random() * 20) | 0, (Math.random() * 12) | 0, W, H); ctx.globalAlpha = 1; }
    if (P.vignette) { ctx.fillStyle = vigGrad(W, H); ctx.fillRect(0, 0, W, H); }
    for (var f = 0; f < P.flashes.length; f++) { var d = Math.abs(t - P.flashes[f]); if (d < 0.12) { ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - d / 0.12)) + ')'; ctx.fillRect(0, 0, W, H); } }
    drawLiveFilm(t, W, H);      // CINE VIVO: partículas atmosféricas + luz volumétrica (encima del video, debajo de textos)
    drawEmbers(t, W, H);        // BRASAS / CENIZAS DE FUEGO (nicho historias para dormir)
    drawFaceFx(t, W, H);        // SEGUIR PERSONAJE: flecha + anillo señalando la cara
    drawFx(t, W, H);            // efectos continuos (letterbox / light leak / chroma)
    drawTransitions(t, W, H);   // transiciones en los cortes (flash/dip/zoomblur/whip/glitch/rgb)
    ctx.restore();
    drawAvatar(t, W, H);        // AVATAR encima de las imágenes (debajo de textos/subtítulos para que se lean)
    for (var i = 0; i < P.texts.length; i++) { var o = P.texts[i]; if (t >= o.start && t <= o.end) drawText(o, t, W, H); }
    for (var c = 0; c < P.captions.length; c++) { if (t >= P.captions[c].start && t <= P.captions[c].end) { drawCaption(P.captions[c], W, H, t); break; } }
    drawAnnos(t, W, H);        // SEÑALAR: flechas / círculos / cajas manuales (encima de todo)
    drawBrand(t, W, H);
    drawIntroOutro(t, W, H);
  }

  // Tarjetas de Intro (hook) y Outro (end screen) con fade — retención + session time
  function fitFont(text, baseFs, maxW) { var fs = baseFs; ctx.font = '900 ' + fs + 'px Arial, sans-serif'; while (ctx.measureText(text).width > maxW && fs > 14) { fs -= 2; ctx.font = '900 ' + fs + 'px Arial, sans-serif'; } return fs; }
  function drawCard(W, H, title, sub, alpha) {
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = 'rgba(5,8,12,0.7)'; ctx.fillRect(0, 0, W, H);
    if (title) {
      var fs = fitFont(title, Math.round(H * 0.085), W * 0.86);
      ctx.font = '900 ' + fs + 'px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, fs * 0.1); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(title, W / 2, H * 0.44);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(title, W / 2, H * 0.44);
    }
    if (sub) {
      var ss = Math.round(H * 0.04); ctx.font = '700 ' + ss + 'px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00DC82'; ctx.fillText(sub, W / 2, H * 0.44 + (H * 0.085) * 0.75);
    }
    ctx.restore();
  }
  function drawIntroOutro(t, W, H) {
    if (P.intro && P.intro.on && P.intro.secs > 0) {
      var s0 = P.trimStart, e0 = s0 + P.intro.secs;
      if (t >= s0 && t <= e0) { var k = (t - s0) / P.intro.secs; var a = k < 0.7 ? 1 : (1 - (k - 0.7) / 0.3); drawCard(W, H, P.intro.title || '', P.intro.sub || '', a); }
    }
    if (P.outro && P.outro.on && P.outro.secs > 0) {
      var e1 = P.trimEnd, s1 = e1 - P.outro.secs;
      if (t >= s1 && t <= e1) { var k2 = (t - s1) / P.outro.secs; var a2 = k2 < 0.3 ? (k2 / 0.3) : 1; drawCard(W, H, P.outro.title || '', P.outro.sub || '', a2); }
    }
  }

  // Watermark del canal + logo + barra de progreso (marca/originalidad + retención)
  function drawBrand(t, W, H) {
    var b = P.brand || {};
    var pad = Math.round(W * 0.025);
    // barra de progreso (truco de retención: "ver la barra llenarse")
    if (P.progressBar) {
      var span = Math.max(0.1, P.trimEnd - P.trimStart), pr = clamp((t - P.trimStart) / span, 0, 1);
      var bh = Math.max(3, Math.round(H * 0.008));
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, H - bh, W, bh);
      ctx.fillStyle = P.progressColor || '#00DC82'; ctx.fillRect(0, H - bh, W * pr, bh);
    }
    // watermark texto (handle del canal)
    if (b.text || b.logo) {
      ctx.save(); ctx.globalAlpha = (b.opacity != null ? b.opacity : 0.85);
      var corner = b.pos || 'br';
      if (b.logo) {
        try {
          var lw = Math.round(W * 0.10 * (b.size || 1)), lh = lw * ((b.logo.naturalHeight || 1) / (b.logo.naturalWidth || 1));
          var lx = (corner === 'tl' || corner === 'bl') ? pad : (W - lw - pad);
          var ly = (corner === 'tl' || corner === 'tr') ? pad : (H - lh - pad);
          ctx.drawImage(b.logo, lx, ly, lw, lh);
        } catch (e) {}
      }
      if (b.text) {
        var fs = Math.round(H * 0.034 * (b.size || 1));
        ctx.font = '800 ' + fs + 'px Arial, sans-serif';
        ctx.textBaseline = (corner === 'tl' || corner === 'tr') ? 'top' : 'bottom';
        ctx.textAlign = (corner === 'tl' || corner === 'bl') ? 'left' : 'right';
        var tx = (corner === 'tl' || corner === 'bl') ? pad : (W - pad);
        var ty = (corner === 'tl' || corner === 'tr') ? pad : (H - pad);
        ctx.lineWidth = Math.max(2, fs * 0.12); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(b.text, tx, ty);
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(b.text, tx, ty);
      }
      ctx.restore();
    }
  }

  // ── Preview / transporte ──
  var _raf = 0;
  function seekTo(t) { t = clamp(t, P.trimStart, P.trimEnd); try { srcVideo.currentTime = t; } catch (e) {} drawAt(t); updateTransport(t); }
  function updateTransport(t) {
    curTime.textContent = fmt(t - P.trimStart);
    var span = Math.max(0.1, P.trimEnd - P.trimStart);
    scrub.value = String(Math.round(clamp((t - P.trimStart) / span, 0, 1) * 1000));
    var lp = (clamp(t / Math.max(0.1, ST.dur), 0, 1) * 100) + '%';
    tlPlayhead.style.left = lp;
    var gp = document.getElementById('tlGridPh'); if (gp) gp.style.left = lp;   // playhead que cruza los carriles
  }
  // Programa el próximo dibujo: usa requestVideoFrameCallback (frame-exacto, no se
  // entrecorta aunque la pestaña pierda foco) y cae a requestAnimationFrame si no existe.
  function scheduleDraw(fn) {
    if (srcVideo.requestVideoFrameCallback) { try { srcVideo.requestVideoFrameCallback(function () { fn(); }); return; } catch (e) {} }
    _raf = requestAnimationFrame(fn);
  }
  function playLoop() {
    if (!ST.playing) return;
    var t = srcVideo.currentTime;
    if (t >= P.trimEnd) { stopPlay(); seekTo(P.trimStart); return; }
    drawAt(t); updateTransport(t);
    scheduleDraw(playLoop);
  }
  function startPlay() {
    if (!ST.ready || ST.rendering) return;
    if (_monGain) _monGain.gain.value = 1;   // por si un export anterior falló antes de restaurar
    if (srcVideo.currentTime < P.trimStart || srcVideo.currentTime >= P.trimEnd) { try { srcVideo.currentTime = P.trimStart; } catch (e) {} }
    srcVideo.muted = false; srcVideo.playbackRate = P.speed || 1;
    ST.playing = true; btnPlay.textContent = '⏸';
    startPreviewMusicLive(); startPreviewVoiceLive();
    srcVideo.play().then(function () { playLoop(); }).catch(function () { stopPlay(); });
  }
  function stopPlay() { ST.playing = false; btnPlay.textContent = '▶'; try { srcVideo.pause(); } catch (e) {} cancelAnimationFrame(_raf); stopPreviewMusicLive(); stopPreviewVoiceLive(); }
  // Música en la PREVIEW (sincronizada) — para escuchar el mix mientras editás
  var _pmCtx = null, _pmSrc = null;
  function startPreviewMusicLive() {
    if (!P.music.buffer) return; stopPreviewMusicLive();
    try {
      _pmCtx = new (window.AudioContext || window.webkitAudioContext)();
      _pmSrc = _pmCtx.createBufferSource(); _pmSrc.buffer = P.music.buffer; _pmSrc.loop = true;
      var g = _pmCtx.createGain(); g.gain.value = clamp(P.music.vol != null ? P.music.vol : 0.28, 0, 1); _pmSrc.connect(g); g.connect(_pmCtx.destination);
      var off = ((srcVideo.currentTime - P.trimStart) % P.music.buffer.duration); if (!(off >= 0)) off = 0;
      _pmSrc.start(0, off);
    } catch (e) {}
  }
  function stopPreviewMusicLive() { try { if (_pmSrc) _pmSrc.stop(); } catch (e) {} try { if (_pmCtx) _pmCtx.close(); } catch (e) {} _pmSrc = null; _pmCtx = null; }
  // NARRACIÓN en la PREVIEW (sincronizada con el playhead) — para ESCUCHAR la voz mientras editás.
  // Antes solo se oía en el export; ahora suena al darle play (sirve para verificar sin exportar 2h).
  var _pvCtx = null, _pvSrc = null;
  function startPreviewVoiceLive() {
    if (!_pendingAudioBuf) return; stopPreviewVoiceLive();
    try {
      _pvCtx = new (window.AudioContext || window.webkitAudioContext)();
      var off = (srcVideo.currentTime || 0) - P.trimStart; if (!(off >= 0)) off = 0;
      var pb = _pendingAudioBuf, startAt = Math.min(off, Math.max(0, pb.duration - 0.05));
      if (pb.i16) { pb = _pcm16Window(pb, startAt, 600); startAt = 0; }
      _pvSrc = _pvCtx.createBufferSource(); _pvSrc.buffer = pb;
      var g = _pvCtx.createGain(); g.gain.value = 1; _pvSrc.connect(g); g.connect(_pvCtx.destination);
      _pvSrc.start(0, startAt);
    } catch (e) {}
  }
  function stopPreviewVoiceLive() { try { if (_pvSrc) _pvSrc.stop(); } catch (e) {} try { if (_pvCtx) _pvCtx.close(); } catch (e) {} _pvSrc = null; _pvCtx = null; }
  window.addEventListener('beforeunload', function (eBU) {
    if (_pendingAudioBuf || _capsInFlight || (typeof ST !== 'undefined' && ST && ST.rendering)) { eBU.preventDefault(); eBU.returnValue = ''; }
  });
  // Ráfaga de preview: tras aplicar una edición, reproduce ~3s EN SILENCIO para que se VEA
  // el zoom moverse + el color + los subtítulos. Un frame estático no muestra el movimiento,
  // por eso parecía que "no se aplicaba nada". Al terminar queda en un frame punch-in.
  var _burstTimer = null;
  function previewBurst() {
    if (!ST.ready || ST.rendering) return;
    if (_burstTimer) { clearTimeout(_burstTimer); _burstTimer = null; }
    try { stopPlay(); } catch (e) {}
    var wasMuted = srcVideo.muted; srcVideo.muted = true;
    try { srcVideo.currentTime = P.trimStart; } catch (e) {}
    srcVideo.playbackRate = P.speed || 1;
    ST.playing = true; btnPlay.textContent = '⏸';
    srcVideo.play().then(function () { playLoop(); }).catch(function () { ST.playing = false; btnPlay.textContent = '▶'; });
    _burstTimer = setTimeout(function () {
      _burstTimer = null; try { stopPlay(); } catch (e) {}
      srcVideo.muted = wasMuted;
      seekTo(P.trimStart + (P.trimEnd - P.trimStart) * 0.22);
    }, 3000);
  }
  btnPlay.addEventListener('click', function () { if (ST.playing) stopPlay(); else startPlay(); });
  // ── Atajos de teclado (estilo editor pro) — no interfieren al escribir en inputs ──
  document.addEventListener('keydown', function (e) {
    if (!P || editorView.hidden) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === ' ') { e.preventDefault(); if (ST.playing) stopPlay(); else startPlay(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); stopPlay(); seekTo((srcVideo.currentTime || P.trimStart) - (e.shiftKey ? 5 : 1 / 30)); }
    else if (k === 'ArrowRight') { e.preventDefault(); stopPlay(); seekTo((srcVideo.currentTime || P.trimStart) + (e.shiftKey ? 5 : 1 / 30)); }
    else if (k === 'Home') { e.preventDefault(); stopPlay(); seekTo(P.trimStart); }
    else if (k === 'End') { e.preventDefault(); stopPlay(); seekTo(P.trimEnd); }
  });
  scrub.addEventListener('input', function () { stopPlay(); var span = Math.max(0.1, P.trimEnd - P.trimStart); seekTo(P.trimStart + (scrub.value / 1000) * span); });
  tlRuler.addEventListener('click', function (e) { var r = tlRuler.getBoundingClientRect(); var t = ((e.clientX - r.left) / r.width) * ST.dur; stopPlay(); seekTo(t); });
  // ── Colapsar/mostrar la línea de tiempo (recuerda el estado) ──
  (function () {
    var tg = $('tlToggle'), tl = document.querySelector('.timeline');
    if (!tg || !tl) return;
    function apply(collapsed) { tl.classList.toggle('tl-collapsed', collapsed); tg.textContent = (collapsed ? '▸' : '▾') + ' Línea de tiempo'; }
    var saved = false; try { saved = localStorage.getItem('nsp_tl_collapsed') === '1'; } catch (e) {}
    apply(saved);
    tg.addEventListener('click', function () { var c = !tl.classList.contains('tl-collapsed'); apply(c); try { localStorage.setItem('nsp_tl_collapsed', c ? '1' : '0'); } catch (e) {} });
  })();

  // ── Timeline ──
  // Si una lista tiene demasiados items para el timeline, muestra una muestra (los datos
  // reales quedan intactos para el export). Evita miles de divs en videos largos.
  function capList(arr, max) { if (!arr || arr.length <= max) return arr || []; var step = arr.length / max, out = []; for (var i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]); return out; }
  // ── Timeline PRO multi-carril (estilo CapCut/Premiere) ──
  // ════════════════ TIMELINE UI DE KEYFRAMES (editor de diamantes) ════════════════
  // Edita P.tracks — los MISMOS datos que evalProp/evalTransform ya consumen. NO toca el motor.
  var KF_PROPS = [
    { k: 'scale', ic: '', label: 'Escala', step: 0.01, dec: 2 },
    { k: 'panX', ic: '↔', label: 'Pan X', step: 0.005, dec: 3 },
    { k: 'panY', ic: '↕', label: 'Pan Y', step: 0.005, dec: 3 },
    { k: 'rotation', ic: '⟳', label: 'Rotación', step: 0.02, dec: 3 },
    { k: 'opacity', ic: '◐', label: 'Opacidad', step: 0.05, dec: 2 }
  ];
  var _kfOpen = false, _kfSel = null, _kfGenAsked = false;
  function kfGenerable(prop) { return prop === 'scale' || prop === 'panX' || prop === 'panY'; }   // las que el generador puede emitir
  function kfDef(prop) { return (prop === 'scale' || prop === 'opacity') ? 1 : 0; }
  function kfHas(prop) { return !!(P.tracks && P.tracks[prop] && P.tracks[prop].length); }
  function kfEnsure() { if (!P.tracksEdited) P.tracksEdited = { scale: false, panX: false, panY: false, rotation: true, opacity: true }; if (!P.tracks) zRebuildTracks(); }
  function kfMarkEdited(prop) { kfEnsure(); P.tracksEdited[prop] = true; _kfGenAsked = false; }   // tocar a mano ⇒ el generador deja de poseerla; rearma el confirm del slider
  function kfAdd(prop, tGlobal) {
    kfEnsure(); if (!P.tracks[prop]) P.tracks[prop] = [];
    var dur = Math.max(0.1, P.trimEnd - P.trimStart), tl = clamp((tGlobal == null ? srcVideo.currentTime : tGlobal) - P.trimStart, 0, dur);
    var kf = { t: tl, value: evalProp(P.tracks[prop], tl, kfDef(prop)), easing: 'linear' };   // valor = el evaluado actual → no salta
    P.tracks[prop].push(kf); P.tracks[prop].sort(function (a, b) { return a.t - b.t; });
    kfMarkEdited(prop); _kfSel = { prop: prop, kf: kf }; _kfOpen = true;
    renderTimeline(); repaint();
  }
  function kfDel(prop, kf) {
    if (!P.tracks || !P.tracks[prop]) return;
    P.tracks[prop] = P.tracks[prop].filter(function (x) { return x !== kf; });
    if (_kfSel && _kfSel.kf === kf) _kfSel = null;
    // vaciar pista GENERABLE → vuelve a GENERADO (no la dejes []-congelada). #2
    if (P.tracks[prop].length === 0 && kfGenerable(prop)) { kfEnsure(); P.tracksEdited[prop] = false; zRebuildTracks(); }
    else kfMarkEdited(prop);   // rotation/opacity vacíos = su estado AUTO (def); siguen "poseídas por el usuario"
    renderTimeline(); repaint();
  }
  function kfResetLane(prop) {   // ↺ AUTO: el generador vuelve a poseer la pista. #4
    kfEnsure(); P.tracksEdited[prop] = false;
    if (!kfGenerable(prop) && P.tracks) P.tracks[prop] = [];   // rotation/opacity: su AUTO es vacío
    zRebuildTracks(); _kfSel = null; renderTimeline(); repaint();
  }
  // Sliders generadores (intensidad/pulse) son DESTRUCTIVOS: si scale/pan están editadas, confirmá antes de pisar. #1
  function kfGenOnIn(setFn) {
    return function (v) {
      kfEnsure();
      var edited = P.tracksEdited.scale || P.tracksEdited.panX || P.tracksEdited.panY;
      if (edited && !_kfGenAsked) {
        _kfGenAsked = true;
        if (!confirm('Ajustar Ken Burns / Punch va a REESCRIBIR tus keyframes de escala y pan hechos a mano. ¿Continuar?')) return;  // cancela → siguen editadas → el rebuild las preserva
        P.tracksEdited.scale = false; P.tracksEdited.panX = false; P.tracksEdited.panY = false;  // el generador vuelve a poseerlas
        _kfSel = null;
      }
      setFn(v); repaint();
    };
  }
  // Renderiza la sección de keyframes (colapsable) dentro de renderTimeline. createElement (sin Trusted Types acá).
  function zRenderKfLanes(pc, span) {
    kfEnsure();
    var present = KF_PROPS.filter(function (p) { return kfHas(p.k); });
    var dur = Math.max(0.1, P.trimEnd - P.trimStart);
    var hd = el('div', 'tl-kf-head', (_kfOpen ? '▾' : '▸') + ' Animación (' + present.length + ')');
    hd.addEventListener('click', function () { _kfOpen = !_kfOpen; renderTimeline(); });
    tlTrack.appendChild(hd);
    if (!_kfOpen) return;
    present.forEach(function (pp) {
      var row = el('div', 'tl-lane tl-kf-lane');
      row.appendChild(el('span', 'tl-lane-lbl', pp.ic + ' ' + pp.label));
      var trk = el('div', 'tl-lane-trk');
      trk.addEventListener('click', function (ev) { if (ev.target !== trk) return; var r = trk.getBoundingClientRect(); kfAdd(pp.k, (ev.clientX - r.left) / r.width * span); });
      (P.tracks[pp.k] || []).forEach(function (kf) {
        var d = el('div', 'tl-kf-dot' + (_kfSel && _kfSel.kf === kf ? ' sel' : ''), '◆');
        d.style.left = pc(P.trimStart + kf.t) + '%';
        d.title = pp.label + ' @ ' + kf.t.toFixed(2) + 's = ' + (+kf.value).toFixed(pp.dec) + '  ·  arrastrá=tiempo · click=editar · dbl=borrar';
        d.addEventListener('mousedown', function (ev) {
          ev.preventDefault(); ev.stopPropagation(); d.classList.add('drag');
          function mv(e2) { var r = trk.getBoundingClientRect(); var tl = clamp((e2.clientX - r.left) / r.width * span - P.trimStart, 0, dur); kf.t = tl; kfMarkEdited(pp.k); d.style.left = pc(P.trimStart + tl) + '%'; repaint(); }
          function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); d.classList.remove('drag'); if (P.tracks[pp.k]) P.tracks[pp.k].sort(function (a, b) { return a.t - b.t; }); renderTimeline(); }
          document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        d.addEventListener('click', function (ev) { ev.stopPropagation(); _kfSel = { prop: pp.k, kf: kf }; renderTimeline(); });
        d.addEventListener('dblclick', function (ev) { ev.stopPropagation(); kfDel(pp.k, kf); });
        trk.appendChild(d);
      });
      row.appendChild(trk);
      if (kfGenerable(pp.k)) { var rb = el('button', 'tl-kf-rst', '↺'); rb.title = 'Volver a AUTO (regenera esta pista)'; rb.addEventListener('click', function (ev) { ev.stopPropagation(); kfResetLane(pp.k); }); row.appendChild(rb); }
      tlTrack.appendChild(row);
    });
    var avail = KF_PROPS.filter(function (p) { return !kfHas(p.k); });   // "+" solo ofrece pistas SIN keyframes. #3
    if (avail.length) {
      var addRow = el('div', 'tl-kf-add');
      var sel = document.createElement('select'); sel.appendChild(new Option('+ pista…', ''));
      avail.forEach(function (p) { sel.appendChild(new Option(p.ic + ' ' + p.label, p.k)); });
      sel.addEventListener('change', function () { if (sel.value) kfAdd(sel.value, srcVideo.currentTime); });
      addRow.appendChild(sel); tlTrack.appendChild(addRow);
    }
    if (_kfSel && _kfSel.kf && kfHas(_kfSel.prop) && P.tracks[_kfSel.prop].indexOf(_kfSel.kf) >= 0) {
      var pp2 = KF_PROPS.filter(function (p) { return p.k === _kfSel.prop; })[0] || { dec: 2, step: 0.01, label: _kfSel.prop };
      var edr = el('div', 'tl-kf-editor');
      edr.appendChild(el('span', 'tl-kf-ed-lbl', '◆ ' + pp2.label + ' @ ' + _kfSel.kf.t.toFixed(2) + 's'));
      var vi = document.createElement('input'); vi.type = 'number'; vi.step = pp2.step; vi.value = (+_kfSel.kf.value).toFixed(pp2.dec); vi.className = 'tl-kf-val';
      vi.addEventListener('input', function () { var nv = parseFloat(vi.value); if (isFinite(nv)) { _kfSel.kf.value = nv; kfMarkEdited(_kfSel.prop); repaint(); } });
      edr.appendChild(vi);
      var es = document.createElement('select'); es.className = 'tl-kf-ease';
      ['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic'].forEach(function (e) { var o = new Option(e, e); if (_kfSel.kf.easing === e) o.selected = true; es.appendChild(o); });
      es.addEventListener('change', function () { _kfSel.kf.easing = es.value; kfMarkEdited(_kfSel.prop); repaint(); });
      edr.appendChild(es);
      var db = el('button', 'tl-kf-del', '🗑'); db.title = 'Borrar keyframe'; db.addEventListener('click', function () { kfDel(_kfSel.prop, _kfSel.kf); }); edr.appendChild(db);
      tlTrack.appendChild(edr);
    }
  }

  function renderTimeline() {
    tlTrack.textContent = '';
    var span = Math.max(0.1, ST.dur);
    var pc = function (t) { return clamp(t / span, 0, 1) * 100; };
    function lane(icon, label, o) {
      o = o || {};
      var row = el('div', 'tl-lane');
      var lb = el('span', 'tl-lane-lbl', icon); lb.title = label;   // solo ícono — el texto estorbaba sobre los clips
      if (o.tool) { lb.className += ' clk'; lb.title = 'Abrir ' + label; lb.addEventListener('click', function (ev) { ev.stopPropagation(); setTool(o.tool); }); }
      row.appendChild(lb);
      var trk = el('div', 'tl-lane-trk');
      trk.addEventListener('click', function (ev) { var r = trk.getBoundingClientRect(); stopPlay(); seekTo((ev.clientX - r.left) / r.width * span); });
      row.appendChild(trk);
      if (o.add || o.clear) {   // controles por carril: + (agregar en el playhead) / ✕ (quitar todo)
        var ctl = el('div', 'tl-lane-ctl');
        if (o.add) { var ab = el('button', 'tl-lane-btn', '+'); ab.title = 'Agregar en el playhead'; ab.addEventListener('click', function (ev) { ev.stopPropagation(); o.add(); }); ctl.appendChild(ab); }
        if (o.clear) { var clb = el('button', 'tl-lane-btn clr', '✕'); clb.title = 'Quitar todo de este carril'; clb.addEventListener('click', function (ev) { ev.stopPropagation(); o.clear(); }); ctl.appendChild(clb); }
        row.appendChild(ctl);
      }
      tlTrack.appendChild(row); return trk;
    }
    function laneRefresh() { renderTimeline(); repaint(); }
    function chip(trk, t, kind, txt, o) {
      o = o || {};
      var c = el('div', 'tl-clip ' + kind); c.style.left = pc(t) + '%';
      if (o.end != null) c.style.width = Math.max(1.2, pc(o.end) - pc(t)) + '%';
      c.textContent = txt || ''; c.title = (o.title || txt || '') + (o.drag ? '  ·  arrastrá para mover · ✕ para borrar' : (o.onDel ? '  ·  ✕ para borrar' : ''));
      if (o.drag) {
        c.addEventListener('mousedown', function (ev) {
          ev.preventDefault(); ev.stopPropagation(); c.classList.add('drag');
          function mv(e2) { var r = trk.getBoundingClientRect(); var nt = clamp((e2.clientX - r.left) / r.width * span, P.trimStart, P.trimEnd); o.onMove(nt); c.style.left = pc(nt) + '%'; }
          function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); c.classList.remove('drag'); repaint(); }
          document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
      } else {
        c.addEventListener('click', function (ev) { ev.stopPropagation(); stopPlay(); seekTo(t); });
      }
      if (o.onDel) {
        c.addEventListener('dblclick', function (ev) { ev.stopPropagation(); o.onDel(); renderTimeline(); repaint(); });
        c.classList.add('dx');   // muestra una ✕ al pasar el mouse para borrar ESTE item solo
        var xb = el('div', 'tl-clip-x', '✕'); xb.title = 'Borrar este';
        xb.addEventListener('mousedown', function (ev) { ev.stopPropagation(); ev.preventDefault(); });
        xb.addEventListener('click', function (ev) { ev.stopPropagation(); o.onDel(); renderTimeline(); repaint(); });
        c.appendChild(xb);
      }
      trk.appendChild(c); return c;
    }
    // VIDEO (bloque de recorte)
    var vt = lane('', 'Video', { tool: 'trim' });
    var vb = el('div', 'tl-clip vid'); vb.style.left = pc(P.trimStart) + '%'; vb.style.width = Math.max(2, pc(P.trimEnd) - pc(P.trimStart)) + '%'; vb.textContent = (ST.name || 'clip'); vt.appendChild(vb);
    // TRANSICIONES (draggables + borrables)
    var tt = lane('', 'Trans', { tool: 'trans', add: function () { P.transitions = P.transitions || []; var k = (P.transition && P.transition !== 'none' && P.transition !== 'mix') ? P.transition : 'flash'; P.transitions.push({ t: srcVideo.currentTime, kind: k }); laneRefresh(); }, clear: (P.transitions && P.transitions.length) ? function () { P.transitions = []; laneRefresh(); } : null });
    (P.transitions || []).forEach(function (tr) { chip(tt, tr.t, 'tr pt', (TRANS_ICON[tr.kind] || '◆'), { drag: true, title: (TRANS_LABEL[tr.kind] || tr.kind), onMove: function (nt) { tr.t = nt; }, onDel: function () { P.transitions = P.transitions.filter(function (x) { return x !== tr; }); } }); });
    // 🔤 TEXTO (bloques start→end)
    var xt = lane('🔤', 'Texto', { tool: 'text', add: function () { var t0 = srcVideo.currentTime; P.texts.push({ id: uid(), text: 'TEXTO', start: t0, end: Math.min(P.trimEnd, t0 + 3), posY: 0.12, size: 1, color: '#FFE14D', box: false, anim: 'pop' }); laneRefresh(); }, clear: P.texts.length ? function () { P.texts = []; laneRefresh(); } : null });
    P.texts.forEach(function (ob) { chip(xt, ob.start, 'txt', ob.text, { end: ob.end, onDel: function () { P.texts = P.texts.filter(function (x) { return x !== ob; }); } }); });
    // 💬 SUBS
    var ct = lane('💬', 'Subs', { tool: 'caption', add: function () { P.captions = genCaptions(); if (!P.captions.length) $('footNote').textContent = 'Pegá el guion en la pantalla de carga para generar subtítulos'; laneRefresh(); }, clear: P.captions.length ? function () { P.captions = []; laneRefresh(); } : null });
    capList(P.captions, 120).forEach(function (cp) { chip(ct, cp.start, 'cap', cp.text, { end: cp.end }); });
    // ZOOM
    var zt = lane('', 'Zoom', { tool: 'zoom', add: function () { P.zooms.push({ t: srcVideo.currentTime, scale: 1.3 }); laneRefresh(); }, clear: (P.zooms && P.zooms.length) ? function () { P.zooms = []; laneRefresh(); } : null });
    capList(P.zooms, 120).forEach(function (z) { chip(zt, z.t, 'zm', '+' + Math.round((z.scale - 1) * 100) + '%', { onDel: function () { P.zooms = P.zooms.filter(function (x) { return x !== z; }); } }); });
    // ✨ FX (flashes)
    var ft = lane('✨', 'FX', { tool: 'fx', add: function () { P.flashes.push(srcVideo.currentTime); laneRefresh(); }, clear: (P.flashes && P.flashes.length) ? function () { P.flashes = []; laneRefresh(); } : null });
    capList(P.flashes, 120).forEach(function (f) { chip(ft, f, 'fx pt', '✦', { title: 'Flash', onDel: function () { P.flashes = P.flashes.filter(function (x) { return x !== f; }); } }); });
    // PERSONAJE (apariciones de caras detectadas)
    if (P.face && P.face.shots && P.face.shots.length) {
      var fct = lane('', 'Personaje', { tool: 'face' });
      capList(P.face.shots, 120).forEach(function (sh) { chip(fct, sh.t, 'fc pt', '🙂', { title: 'Cara detectada', onDel: function () { P.face.shots = P.face.shots.filter(function (x) { return x !== sh; }); } }); });
    }
    // 🖍️ SEÑALAR (flechas/círculos/cajas manuales) — bloques arrastrables
    var ant = lane('🖍️', 'Señalar', { tool: 'anno', clear: (P.annos && P.annos.length) ? function () { P.annos = []; laneRefresh(); } : null });
    (P.annos || []).forEach(function (an) {
      var ic = an.kind === 'emoji' ? (an.emoji || '👉') : an.kind === 'circle' ? '⭕' : an.kind === 'box' ? '▢' : '➤';
      chip(ant, an.start, 'ann', ic, { end: an.end, drag: true, title: an.kind, onMove: function (nt) { var dur = an.end - an.start; an.start = nt; an.end = Math.min(P.trimEnd, nt + dur); }, onDel: function () { P.annos = P.annos.filter(function (x) { return x !== an; }); } });
    });
    // 🎵 AUDIO
    var at = lane('🎵', 'Audio', { tool: 'audio', clear: (P.music && P.music.buffer) ? function () { try { stopPreviewMusic(); } catch (e) {} P.music.buffer = null; P.music.name = ''; laneRefresh(); } : null });
    if (P.music && P.music.buffer) { var ab = el('div', 'tl-clip aud'); ab.style.left = pc(P.trimStart) + '%'; ab.style.width = Math.max(2, pc(P.trimEnd) - pc(P.trimStart)) + '%'; ab.textContent = '♪ ' + (P.music.name || 'música IA'); at.appendChild(ab); }
    // carriles de KEYFRAMES (sección Animación, colapsable) — diamantes arrastrables
    zRenderKfLanes(pc, span);
    // playhead que cruza TODOS los carriles
    var ph = el('div', 'tl-ph'); ph.id = 'tlGridPh'; ph.style.left = pc(srcVideo.currentTime || P.trimStart) + '%'; tlTrack.appendChild(ph);
    // timecodes en la regla
    Array.prototype.slice.call(tlRuler.querySelectorAll('.tl-tc')).forEach(function (n) { n.remove(); });
    for (var i = 0; i < 6; i++) { var tc = el('div', 'tl-tc', fmt((i / 6) * ST.dur)); tc.style.left = (i / 6 * 100) + '%'; tlRuler.appendChild(tc); }
    trimInfo.textContent = 'Dura: ' + fmt(P.trimEnd - P.trimStart);
    updateMonetHud();
  }

  // ── Modo AUTO / MANUAL ──
  function applyMode(mode) {
    P.mode = mode; modeBadge.textContent = mode === 'auto' ? 'AUTO' : 'MANUAL';
    btnModeAuto.classList.toggle('active', mode === 'auto'); btnModeManual.classList.toggle('active', mode === 'manual');
    if (mode === 'auto') {
      P.kenBurns = true; P.kbIntensity = 0.6; P.pulse = true; P.pulseEvery = 10; P.grade = 'cinematic'; P.vignette = false; P.grain = false;   // viñeta y grano APAGADOS en AUTO — el usuario odia las manchas/"rayas" tipo película vieja; quedan como toggles en Efectos
      // CLAVE anti-estático: AUTO enciende MODO POR IMAGEN → cada foto recibe su propio movimiento + un corte en cada cambio.
      // Es lo que des-estatiza un slideshow (un slideshow con 1 sola rampa sigue pareciendo fotos quietas).
      if (P.shotMode == null || !P._autoTouchedShot) { P.shotMode = true; P._autoTouchedShot = true; }
      if (!P.shotSecs) P.shotSecs = 4;
      if (!P.liveFilm) P.liveFilm = { on: false, intensity: 0.6, secs: 0, particles: true, lightRay: false, dust: true };
      P.liveFilm.on = false; P.liveFilm.lightRay = false;   // Cine Vivo DESACTIVADO en AUTO — el usuario odia las "rayas" del barrido de luz (efecto horrible). Queda como toggle manual en Efectos.
      // BREATHING SIEMPRE ACTIVO: zoom que acerca/retrocede sin parar en todo el video.
      if (!P.breath) P.breath = { on: false, amt: 0.06, period: 5 };
      P.breath.on = true; P.breath.amt = 0.06; P.breath.period = 5;
      // TRANSICIÓN "baja a la siguiente imagen": AUTO usa slidedown en cada corte de imagen.
      P.transition = 'slidedown'; P.shotTransKind = 'slidedown'; if (!P.transEvery) P.transEvery = 4; if (P.shotTrans == null) P.shotTrans = true;
      P.transitions = P.shotMode ? genShotTransitions() : genTransitions();   // por-imagen → corte real en cada cambio de foto
      if (P.fx) { P.fx.lightLeak = false; P.fx.chroma = false; P.fx.letterbox = false; }   // sin fuga de luz, sin aberración cromática y sin barras de cine en AUTO (el usuario odia las "rayas"/barrido de luz). Quedan como toggles manuales en Efectos.
      // ZOOM DE ARRANQUE: golpe de movimiento en el primer ~1s (hook visual — "algo que lo movió" al empezar).
      // Se hornea como un punch en P.zooms, que zRebuildTracks ya consume. No duplica si AUTO se re-corre.
      if (!P.zooms) P.zooms = [];
      if (!P.zooms.some(function (z) { return z._intro; })) {
        P.zooms.unshift({ t: P.trimStart + 0.5, scale: 1.34, _intro: true });
      }
      if (!P.captions.length) P.captions = genCaptions();
      // AUTO también coloca los CARTELES de momento clave (si hay guion). Solo si no hay ya carteles
      // auto-generados (no pisa ni duplica) y NO toca textos manuales del usuario (_gen!=='callout').
      try {
        if (!P.callout) P.callout = { on: false, max: 6, gapSecs: 12, color: '#FFE14D', pos: 0.80 };
        var hasAutoCallouts = (P.texts || []).some(function (o) { return o._gen === 'callout'; });
        if ((scriptInput.value || '').trim() && !hasAutoCallouts) { var nc = applyCallouts(); P.callout.on = nc > 0; }   // FIX: on=true solo si realmente colocó (antes el flag mentía con 0 carteles)
        // FLECHAS EMOJI automáticas en momentos clave (si hay guion y no hay ya autogeneradas)
        var hasAutoArrows = (P.annos || []).some(function (a) { return a._gen === 'arrow'; });
        if ((scriptInput.value || '').trim() && !hasAutoArrows) { applyArrowCallouts(); }
      } catch (e) {}
    } else {
      P.kenBurns = false; P.pulse = false; P.grade = 'none'; P.vignette = false; P.grain = false; P.shake = false;
      P.transitions = []; if (P.fx) { P.fx.lightLeak = false; P.fx.chroma = false; P.fx.letterbox = false; }
    }
    P._kf = (mode === 'auto'); try { zRebuildTracks(); } catch (e) {}   // AUTO → motor de keyframes; MANUAL → tracks vacío (fallback)
    drawAt(srcVideo.currentTime || P.trimStart); renderTimeline(); updateMonetHud();   // refrescar el score al togglear AUTO/MANUAL
  }
  btnModeAuto.addEventListener('click', function () { applyMode('auto'); setTool('auto'); });
  btnModeManual.addEventListener('click', function () { applyMode('manual'); setTool('trim'); });

  // ── DETECTOR DE DATO IMPORTANTE ──────────────────────────────────────────────
  // Marca un subtítulo como "clave" si contiene una fecha, año, cifra grande, %, dinero,
  // o un patrón de nombre propio. Los subtítulos clave se pintan con estilo destacado.
  var MESES_RE = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|june|july|august|september|october|november|december)';
  function captionHighlight(text) {
    var t = ' ' + text + ' ';
    // año de 4 dígitos (1994, 2023…) — el caso que pediste
    if (/\b(1[5-9]\d{2}|20\d{2})\b/.test(t)) return true;
    // mes + número/año ("diciembre de 1994", "12 de marzo")
    if (new RegExp('\\b' + MESES_RE + '\\b', 'i').test(t) && /\d/.test(t)) return true;
    // dinero / cifras grandes / porcentajes / múltiplos
    if (/[$€£]\s?\d|\d[\d.,]*\s?(millones?|mil|billones?|million|billion|k|m\b)/i.test(t)) return true;
    if (/\b\d+\s?%/.test(t) || /\b\d{4,}\b/.test(t)) return true;             // 35% · 10000+
    // número escrito grande
    if (/\b(mil|millones?|miles|cientos|docenas)\b/i.test(t)) return true;
    return false;
  }

  // ════════════════ FEATURE 2 — CALLOUTS DE MOMENTO CLAVE ════════════════
  // Detecta SOLO datos fuertes y bien definidos (fechas, años, cifras, dinero, %),
  // en forma de DÍGITOS y ESCRITOS (ES/DE/FR). Devuelve frases con un puntaje de
  // relevancia para rankear. Conservador a propósito: dato > "importancia" difusa.
  // Palabras-número escritas por idioma (unidades, decenas, cientos, magnitudes).
  var ZNUMWORDS = {
    es: '(cero|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci(?:s[eé]is|siete|ocho|nueve)|veinte|veinti\\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|mill[oó]n|millones|mil millones|billones?)',
    de: '(null|eins|zwei|drei|vier|f[üu]nf|sechs|sieben|acht|neun|zehn|elf|zw[öo]lf|drei[sß]ig|vierzig|f[üu]nfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend|million(?:en)?|milliarde(?:n)?)',
    fr: '(z[ée]ro|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|septante|quatre-vingts?|nonante|cent|cents|mille|millions?|milliards?)'
  };
  var ZMONTHS = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|januar|februar|m[äa]rz|mai|juni|juli|oktober|dezember|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)';
  // Encuentra "momentos clave" en un texto. Devuelve [{text(frase), score, kind}].
  function zKeyMoments(text) {
    if (!text) return [];
    var out = [], seen = {};
    function push(m, score, kind) { var k = (m || '').trim(); if (!k || seen[k.toLowerCase()]) return; seen[k.toLowerCase()] = 1; out.push({ text: k, score: score, kind: kind }); }
    // 1) AÑOS dígito (1500-2099) → muy relevante
    (text.match(/\b(1[5-9]\d{2}|20\d{2})\b/g) || []).forEach(function (m) { push(m, 100, 'year'); });
    // 2) FECHAS con mes (mes + número, "12 de marzo", "diciembre de 1994")
    var reMonth = new RegExp('(\\d{1,2}\\s+(?:de\\s+)?)?' + ZMONTHS + '(\\s+(?:de\\s+)?\\d{1,4})?', 'gi');
    (text.match(reMonth) || []).forEach(function (m) { if (/\d/.test(m)) push(m, 95, 'date'); });
    // 3) DINERO ($ € £ + cifra, o cifra + millones/mil/billón…)
    (text.match(/[$€£]\s?\d[\d.,]*\s?(?:millones?|mil(?:lones)?|billones?|million|billion|k|m\b)?/gi) || []).forEach(function (m) { push(m, 90, 'money'); });
    (text.match(/\b\d[\d.,]*\s?(?:millones?|mil millones|mil|billones?|million|billion)\b/gi) || []).forEach(function (m) { push(m, 85, 'bignum'); });
    // 4) PORCENTAJES
    (text.match(/\b\d[\d.,]*\s?%/g) || []).forEach(function (m) { push(m, 80, 'pct'); });
    // 5) CIFRAS GRANDES en dígito (4+)
    (text.match(/\b\d{4,}\b/g) || []).forEach(function (m) { push(m, 70, 'num'); });
    // 6) NÚMEROS ESCRITOS ES/FR: secuencias de palabras-número (ej. "mil novecientos treinta y cuatro")
    ['es', 'fr'].forEach(function (lang) {
      var unit = ZNUMWORDS[lang];
      var chain = new RegExp('\\b' + unit + '(?:[\\s\\-]+(?:y|et|de)?[\\s\\-]*' + unit + ')+\\b', 'gi');
      (text.match(chain) || []).forEach(function (m) {
        var words = m.trim().split(/[\s\-]+/).length;
        if (words >= 2) push(m, 60 + Math.min(30, words * 4), 'spelled');   // más palabras = número mayor = más relevante
      });
    });
    // 6b) NÚMEROS ESCRITOS DE (alemán concatena en UNA palabra: "dreitausend",
    //     "eintausendneunhundertvierunddreißig") → token único con morfemas de número.
    var deTok = /\b\w*(?:tausend|hundert|million(?:en)?|milliarde(?:n)?|und(?:zwanzig|drei[sß]ig|vierzig|f[üu]nfzig|sechzig|siebzig|achtzig|neunzig))\w*\b/gi;
    (text.match(deTok) || []).forEach(function (m) {
      if (m.length >= 6) push(m, 60 + Math.min(30, Math.floor(m.length / 3)), 'spelled');   // más largo = número mayor
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  function genCaptions() {
    var s = (scriptInput.value || '').trim(); if (!s) return [];
    // 1) cortar en frases por puntuación, 2) trozos cortos (≤6 palabras / ≤40 chars)
    var phrases = s.replace(/\s+/g, ' ').split(/([.!?…]+|[,;:]\s)/).filter(function (x) { return x && x.trim() && !/^[.!?…,;:]+\s?$/.test(x); });
    if (!phrases.length) phrases = [s];
    var chunks = [];
    phrases.forEach(function (ph) {
      var w = ph.trim().split(/\s+/), cur = [];
      w.forEach(function (word) { cur.push(word); var j = cur.join(' '); if (cur.length >= 6 || j.length >= 40) { chunks.push(j); cur = []; } });
      if (cur.length) chunks.push(cur.join(' '));
    });
    chunks = chunks.filter(function (c) { return c && c.trim(); });
    if (!chunks.length) return [];
    // tiempo PONDERADO por nº de palabras → los subtítulos largos duran más
    var totalW = chunks.reduce(function (a, c) { return a + c.split(/\s+/).length; }, 0) || 1;
    var span = Math.max(1, P.trimEnd - P.trimStart);
    var minDur = Math.min(0.8, span / chunks.length);   // el piso NO puede exceder el reparto justo (antes 0.8 fijo desbordaba el trim → últimos subs invisibles)
    var tcur = P.trimStart, caps = [];
    chunks.forEach(function (c) {
      var w = c.split(/\s+/).length, dur = Math.max(minDur, span * (w / totalW));
      caps.push({ text: c, start: tcur, end: tcur + dur - 0.04, key: captionHighlight(c) }); tcur += dur;   // key=true ⇒ dato importante (fecha/cifra)
    });
    // red de seguridad: si igual se pasó del trim, re-escalá todo dentro de [trimStart, trimEnd]
    if (tcur > P.trimEnd + 0.01) {
      var k = span / (tcur - P.trimStart);
      caps.forEach(function (it) { it.start = P.trimStart + (it.start - P.trimStart) * k; it.end = P.trimStart + (it.end - P.trimStart) * k; });
    }
    return caps;
  }

  // ── GENERADOR DE CALLOUTS: coloca textos de énfasis (sparse) en P.texts ──
  // TIMING: reusa la línea de tiempo de genCaptions() (mejor fuente disponible hoy;
  // aprox por conteo de palabras — se podrá cambiar por timings reales de Fish luego).
  // SALIENCIA + RATE-LIMIT: rankea por score, respeta separación mínima y tope.
  // P.callout = { on, max, gapSecs, color, pos } configurable.
  function genCallouts() {
    if (!P.callout) P.callout = { on: true, max: 6, gapSecs: 12, color: '#FFE14D', pos: 0.80 };
    var s = (scriptInput.value || '').trim(); if (!s) return [];
    var caps = genCaptions(); if (!caps.length) return [];
    // 1) detectar momentos clave en cada chunk con su tiempo (el del chunk que lo contiene)
    var cand = [];
    caps.forEach(function (c) {
      var hits = zKeyMoments(c.text); if (!hits.length) return;
      var best = hits[0];   // el de mayor score dentro del chunk
      cand.push({ text: best.text, score: best.score, kind: best.kind, t: c.start, end: c.end });
    });
    if (!cand.length) return [];
    // 2) ranking por salience, luego rate-limit por separación mínima + tope
    cand.sort(function (a, b) { return b.score - a.score; });
    var gap = Math.max(2, +P.callout.gapSecs || 12), cap = Math.max(1, +P.callout.max || 6);
    var chosen = [];
    cand.forEach(function (it) {
      if (chosen.length >= cap) return;
      for (var i = 0; i < chosen.length; i++) { if (Math.abs(chosen[i].t - it.t) < gap) return; }   // muy cerca de otro → descartar
      chosen.push(it);
    });
    chosen.sort(function (a, b) { return a.t - b.t; });
    // 3) construir objetos de texto (capa de énfasis: animación 'callout', lower-third)
    var col = P.callout.color || '#FFE14D', posY = P.callout.pos || 0.80, span = Math.max(1, P.trimEnd - P.trimStart);
    var hold = clamp(span * 0.02, 1.6, 3.2);   // duración legible, acotada
    return chosen.map(function (it) {
      var label = it.text.toUpperCase();
      return { id: uid(), text: label, start: it.t, end: Math.min(P.trimEnd, it.t + hold), posY: posY, size: 1.35, color: col, box: true, anim: 'callout', _gen: 'callout' };
    });
  }
  // Aplica callouts a P.texts respetando generado-vs-editado:
  // borra SOLO los auto previos no tocados (_gen==='callout'), conserva los manuales/editados.
  function applyCallouts() {
    var manual = (P.texts || []).filter(function (o) { return o._gen !== 'callout'; });
    var gen = genCallouts();
    P.texts = manual.concat(gen);
    return gen.length;
  }

  // ── FLECHAS EMOJI AUTOMÁTICAS en momentos clave (👉 hacia el centro, sin dibujar a mano) ──
  // Reusa zKeyMoments + el timing de los subtítulos. Coloca pocas (rate-limit) y desde lados alternos.
  var EMOJI_BY_KIND = { year: '📅', date: '📅', money: '', pct: '📈', bignum: '🔥', num: '👉', spelled: '👉' };
  function genArrowCallouts() {
    var s = (scriptInput.value || '').trim(); if (!s) return [];
    var caps = genCaptions(); if (!caps.length) return [];
    var cand = [];
    caps.forEach(function (c) { var hits = zKeyMoments(c.text); if (hits.length) cand.push({ t: c.start, score: hits[0].score, kind: hits[0].kind }); });
    if (!cand.length) return [];
    cand.sort(function (a, b) { return b.score - a.score; });
    var gap = 10, cap = 8, chosen = [];   // pocas y espaciadas (no saturar)
    cand.forEach(function (it) { if (chosen.length >= cap) return; for (var i = 0; i < chosen.length; i++) if (Math.abs(chosen[i].t - it.t) < gap) return; chosen.push(it); });
    chosen.sort(function (a, b) { return a.t - b.t; });
    var span = Math.max(1, P.trimEnd - P.trimStart), hold = clamp(span * 0.015, 1.4, 2.6);
    return chosen.map(function (it, k) {
      var leftSide = (k % 2 === 0);   // alterna lados → apunta al centro desde izq/der
      return {
        id: uid(), kind: 'emoji', emoji: EMOJI_BY_KIND[it.kind] || '👉',
        x: leftSide ? 0.30 : 0.70, y: 0.42,
        start: it.t, end: Math.min(P.trimEnd, it.t + hold), _gen: 'arrow'
      };
    });
  }
  function applyArrowCallouts() {
    if (!P.annos) P.annos = [];
    var manual = P.annos.filter(function (a) { return a._gen !== 'arrow'; });   // conserva las que pusiste a mano
    var gen = genArrowCallouts();
    P.annos = manual.concat(gen);
    return gen.length;
  }

  // ════════════════════ PANELES DE HERRAMIENTAS ════════════════════
  function setTool(tool) {
    ST.activeTool = tool;
    if (tool !== 'anno') { _annoPlace = null; try { stage.style.cursor = ''; } catch (e) {} }   // salir de Señalar → cursor normal
    try { stopPreviewMusic(); } catch (e) {}   // corta la preview de música IA al cambiar de panel (antes seguía sonando sin botón para pararla + fuga de AudioContext)
    Array.prototype.forEach.call(toolTabs.children, function (b) { b.classList.toggle('active', b.getAttribute('data-tool') === tool); });
    toolPanel.textContent = '';
    ({ auto: panelAuto, trim: panelTrim, text: panelText, zoom: panelZoom, color: panelColor, fx: panelFx, face: panelFace, anno: panelAnno, trans: panelTransitions, caption: panelCaption, audio: panelAudio, format: panelFormat, avatar: panelAvatar, brand: panelBrand, intro: panelIntro, thumb: panelThumb, preset: panelPreset }[tool] || panelAuto)();
  }
  toolTabs.addEventListener('click', function (e) { var b = e.target.closest('.tt'); if (b) setTool(b.getAttribute('data-tool')); });

  function rowRange(label, min, max, step, val, fmtFn, onIn) {
    var r = el('div', 'row'); r.appendChild(el('span', 'lab', label));
    var inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val; r.appendChild(inp);
    var v = el('span', 'val', fmtFn(val)); r.appendChild(v);
    inp.addEventListener('input', function () { v.textContent = fmtFn(+inp.value); onIn(+inp.value); });
    return r;
  }
  function rowToggle(label, checked, onChange) {
    var r = el('div', 'row toggle'); r.appendChild(el('span', 'lab', label));
    var inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = checked; r.appendChild(inp);
    inp.addEventListener('change', function () { onChange(inp.checked); }); return r;
  }
  function repaint() { if (P && P._kf) { try { zRebuildTracks(); } catch (e) {} } drawAt(srcVideo.currentTime || P.trimStart); updateMonetHud(); }

  // ════════════════════ MINIATURA (CTR) — agregado v3.44.0 ════════════════════
  // Genera la miniatura del video (lo que más mueve el CTR → más views → más ingresos).
  // Usa el fotograma actual + un titular grande, reutilizando el motor de canvas.
  // 100% aditivo: no toca ninguna función existente.
  var THUMB = { headline: '', sub: '', color: '#FFE14D', pos: 'bottom', box: true, shade: true };
  function drawThumbInto(cv) {
    var W = cv.width, H = cv.height, c2 = cv.getContext('2d');
    c2.clearRect(0, 0, W, H);
    // Fondo: fotograma actual del video, cover-fit (sin deformar), con el grade del proyecto.
    var vw = ST.vw || srcVideo.videoWidth || 16, vh = ST.vh || srcVideo.videoHeight || 9;
    var cover = Math.max(W / vw, H / vh), dw = vw * cover, dh = vh * cover;
    var g = GRADES[P.grade] || GRADES.none;
    c2.filter = g.filter || 'none';
    try { c2.drawImage(srcVideo, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { c2.fillStyle = '#11151a'; c2.fillRect(0, 0, W, H); }
    c2.filter = 'none';
    if (THUMB.shade) {
      if (THUMB.pos === 'center') { c2.fillStyle = 'rgba(0,0,0,0.36)'; c2.fillRect(0, 0, W, H); }
      else {
        var grd = c2.createLinearGradient(0, 0, 0, H);
        if (THUMB.pos === 'top') { grd.addColorStop(0, 'rgba(0,0,0,0.74)'); grd.addColorStop(0.5, 'rgba(0,0,0,0)'); }
        else { grd.addColorStop(0.45, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.8)'); }
        c2.fillStyle = grd; c2.fillRect(0, 0, W, H);
      }
    }
    var head = (THUMB.headline || '').trim(), sub = (THUMB.sub || '').trim();
    if (!head && !sub) return;
    var fw = head ? fitWrapMax(head, Math.round(H * 0.17), W * 0.9, '900', 3) : { fs: 0, lines: [] };
    var hfs = fw.fs, lines = fw.lines, hlh = hfs * 1.12, headH = lines.length * hlh;
    var sfs = sub ? Math.round(H * 0.072) : 0, gap = (head && sub) ? H * 0.03 : 0;
    var groupH = (sub ? sfs * 1.3 : 0) + gap + headH;
    var y = THUMB.pos === 'top' ? H * 0.07 : THUMB.pos === 'center' ? (H - groupH) / 2 : H * 0.93 - groupH;
    c2.save(); c2.textAlign = 'center'; c2.textBaseline = 'top'; c2.lineJoin = 'round';
    if (sub) {
      c2.font = '800 ' + sfs + 'px Arial, sans-serif'; c2.lineWidth = Math.max(3, sfs * 0.18); c2.strokeStyle = 'rgba(0,0,0,0.9)';
      c2.strokeText(sub, W / 2, y); c2.fillStyle = '#FFFFFF'; c2.fillText(sub, W / 2, y);
      y += sfs * 1.3 + gap;
    }
    if (head) {
      c2.font = '900 ' + hfs + 'px Arial, sans-serif';
      if (THUMB.box) { var bw = 0; for (var i = 0; i < lines.length; i++) bw = Math.max(bw, c2.measureText(lines[i]).width); c2.fillStyle = 'rgba(0,0,0,0.5)'; c2.fillRect(W / 2 - bw / 2 - W * 0.018, y - hfs * 0.1, bw + W * 0.036, headH + hfs * 0.2); }
      c2.lineWidth = Math.max(5, hfs * 0.16); c2.strokeStyle = 'rgba(0,0,0,0.92)';
      for (var s = 0; s < lines.length; s++) c2.strokeText(lines[s], W / 2, y + s * hlh);
      c2.fillStyle = THUMB.color || '#FFE14D';
      for (var s2 = 0; s2 < lines.length; s2++) c2.fillText(lines[s2], W / 2, y + s2 * hlh);
    }
    c2.restore();
  }
  function panelThumb() {
    toolPanel.appendChild(el('div', 'tp-title', 'MINIATURA (CTR)'));
    toolPanel.appendChild(el('div', 'tp-desc', 'La miniatura es lo que MÁS sube el CTR (→ más views → más ingresos). Tomá el fotograma actual, ponele un titular grande y exportá 1280×720 listo para YouTube.'));
    var pv = document.createElement('canvas'); pv.width = 320; pv.height = 180;
    pv.style.cssText = 'width:100%;height:auto;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:#000;display:block;margin-bottom:10px;';
    toolPanel.appendChild(pv);
    function refresh() { try { drawThumbInto(pv); } catch (e) {} }
    var cap = el('button', 'mini-btn sec', '📸 Capturar el fotograma actual'); toolPanel.appendChild(cap);
    cap.addEventListener('click', function () { refresh(); cap.textContent = 'Frame capturado'; setTimeout(function () { cap.textContent = '📸 Capturar el fotograma actual'; }, 1400); });
    toolPanel.appendChild(el('div', 'hintline', 'Tip: mové el playhead al mejor momento y tocá "Capturar".'));
    var lblH = el('div', 'hintline', 'Titular (grande)'); lblH.style.marginTop = '8px'; toolPanel.appendChild(lblH);
    var ta = document.createElement('textarea'); ta.value = THUMB.headline; ta.placeholder = 'EJ: NADIE SABE ESTO';
    ta.style.cssText = 'width:100%;box-sizing:border-box;min-height:46px;resize:vertical;background:#11151a;border:1px solid rgba(255,255,255,0.12);border-radius:9px;color:#fff;padding:9px 11px;font-size:13px;font-family:inherit;'; toolPanel.appendChild(ta);
    ta.addEventListener('input', function () { THUMB.headline = ta.value; refresh(); });
    var si = document.createElement('input'); si.type = 'text'; si.value = THUMB.sub; si.placeholder = 'Línea chica (opcional)';
    si.style.cssText = 'width:100%;box-sizing:border-box;margin-top:8px;background:#11151a;border:1px solid rgba(255,255,255,0.12);border-radius:9px;color:#fff;padding:9px 11px;font-size:12px;font-family:inherit;'; toolPanel.appendChild(si);
    si.addEventListener('input', function () { THUMB.sub = si.value; refresh(); });
    var cr = el('div', 'row'); cr.appendChild(el('span', 'lab', 'Color'));
    var sw = el('div'); sw.style.cssText = 'display:flex;gap:6px;';
    ['#FFE14D', '#FFFFFF', '#00DC82', '#FF6B6B', '#2EE9FF'].forEach(function (col) {
      var b = document.createElement('button'); b.style.cssText = 'width:22px;height:22px;border-radius:6px;border:2px solid ' + (THUMB.color === col ? '#fff' : 'transparent') + ';background:' + col + ';cursor:pointer;padding:0;';
      b.addEventListener('click', function () { THUMB.color = col; Array.prototype.forEach.call(sw.children, function (x) { x.style.borderColor = 'transparent'; }); b.style.borderColor = '#fff'; refresh(); });
      sw.appendChild(b);
    });
    cr.appendChild(sw); toolPanel.appendChild(cr);
    var pr = el('div', 'row'); pr.appendChild(el('span', 'lab', 'Posición'));
    var psel = document.createElement('select');
    [['bottom', 'Abajo'], ['center', 'Centro'], ['top', 'Arriba']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (THUMB.pos === o[0]) op.selected = true; psel.appendChild(op); });
    psel.addEventListener('change', function () { THUMB.pos = psel.value; refresh(); }); pr.appendChild(psel); toolPanel.appendChild(pr);
    toolPanel.appendChild(rowToggle('Caja detrás del texto', THUMB.box, function (v) { THUMB.box = v; refresh(); }));
    toolPanel.appendChild(rowToggle('Sombra (legibilidad)', THUMB.shade, function (v) { THUMB.shade = v; refresh(); }));
    var dl = el('button', 'mini-btn', 'Descargar miniatura 1280×720'); dl.style.marginTop = '10px'; toolPanel.appendChild(dl);
    dl.addEventListener('click', function () {
      try {
        var off = document.createElement('canvas'); off.width = 1280; off.height = 720; drawThumbInto(off);
        off.toBlob(function (blob) { if (blob) dlBlob(blob, 'png'); else $('footNote').textContent = 'No pude generar la miniatura'; }, 'image/png');
        $('footNote').textContent = 'Miniatura PNG descargada ✓';
      } catch (e) { $('footNote').textContent = 'Error generando miniatura'; }
    });
    refresh();
  }

  // ── HUD de monetización EN VIVO (recalcula con cada edición) ──────────────
  // Norte de toda la app: que el video quede MONETIZABLE. Cada función mueve esto.
  function computeMonetScore() {
    var s = 30, f = [];
    var scriptTxt = (scriptInput.value || '').trim();
    var words = scriptTxt ? scriptTxt.split(/\s+/).length : 0;
    var dur = Math.max(1, (P ? (P.trimEnd - P.trimStart) : ST.dur));
    var cov = words ? Math.min(1, (words / 2.5) / dur) : 0;
    // 1) Narración (lo que más pesa en la política inauthentic/reused)
    if (cov >= 0.5) { s += 22; f.push([true, 'Narración ' + Math.round(cov * 100) + '%']); }
    else if (cov >= 0.3) { s += 15; f.push([true, 'Narración ' + Math.round(cov * 100) + '%']); }
    else if (P.captions.length) { s += 12; f.push([true, 'Subs = narración']); }
    else { f.push([false, 'Narración <30%']); }
    // 2) Subtítulos
    if (P.captions.length) { s += 12; f.push([true, 'Subtítulos (' + P.captions.length + ')']); } else { f.push([false, 'Sin subtítulos']); }
    // 3) Movimiento / zoom (anti-slideshow)
    if (P.kenBurns || P.pulse || P.zooms.length) { s += 20; f.push([true, 'Movimiento/zoom']); } else { s += 2; f.push([false, 'Sin movimiento']); }
    // 4) Color
    if (P.grade && P.grade !== 'none') { s += 8; f.push([true, 'Color ' + (GRADES[P.grade] ? GRADES[P.grade].label : '')]); } else { f.push([false, 'Sin color']); }
    // 5) Hook en los primeros 3s
    var hasHook = (P.intro && P.intro.on) || P.texts.some(function (t) { return t.start <= P.trimStart + 1.6; });
    if (hasHook) { s += 8; f.push([true, 'Hook inicial']); } else { f.push([false, 'Sin hook 0-3s']); }
    // 6) Variación / efectos
    var liveOn = !!(P.liveFilm && P.liveFilm.on);
    if (liveOn) { s += 10; f.push([true, 'Cine Vivo (video real)']); }
    else if (P.vignette || P.grain || P.shake || P.flashes.length) { s += 6; f.push([true, 'Efectos/variación']); } else { f.push([false, 'Sin efectos']); }
    // 7) Marca / branding (señal de canal original y consistente)
    if (P.brand && (P.brand.text || P.brand.logo)) { s += 4; f.push([true, 'Marca/watermark']); } else { f.push([false, 'Sin marca']); }
    s = clamp(Math.round(s), 0, 100);
    var verdict, color;
    if (s >= 72) { verdict = 'MONETIZABLE'; color = '#fff'; }
    else if (s >= 50) { verdict = 'RIESGO MEDIO'; color = '#e7ecf2'; }
    else { verdict = 'ALTO RIESGO'; color = '#FF6B6B'; }
    return { score: s, factors: f, verdict: verdict, color: color };
  }
  function updateMonetHud() {
    if (!P || editorView.hidden) return;
    var r = computeMonetScore();
    mhScore.textContent = r.score; mhScore.style.color = r.color;
    mhRing.style.background = 'conic-gradient(' + r.color + ' ' + (r.score * 3.6) + 'deg, rgba(255,255,255,0.08) 0deg)';
    mhVerdict.textContent = r.verdict; mhVerdict.style.color = r.color;
    mhFactors.textContent = '';
    r.factors.forEach(function (x) { var c = el('span', 'mh-chip ' + (x[0] ? 'ok' : 'no')); c.textContent = (x[0] ? '✓ ' : '✗ ') + x[1]; mhFactors.appendChild(c); });
  }

  function panelAuto() {
    _kfGenAsked = false;   // rearma el confirm destructivo de los sliders generadores al abrir el panel
    toolPanel.appendChild(el('div', 'tp-title', 'EDICIÓN AUTOMÁTICA'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Un click le mete todo lo que necesita un faceless para no parecer "AI slop": zoom dinámico, color cine, subtítulos del guion, hook y efectos. Después podés ajustar todo en MANUAL.'));
    var b = el('button', 'mini-btn', '✨ APLICAR EDICIÓN AUTOMÁTICA'); toolPanel.appendChild(b);
    b.addEventListener('click', function () {
      var tpl = (typeof TEMPLATES !== 'undefined' && sel && TEMPLATES[+sel.value]) ? TEMPLATES[+sel.value] : null;
      if (tpl) {   // preset COMPLETO del nicho elegido: color, zoom, chispas, subtítulos, intro/outro, barra
        applyProPreset(tpl);
      } else {     // sin nicho → AUTO genérico
        applyMode('auto');
        P.kbIntensity = 0.6; P.pulseEvery = 20; P.grade = 'cinematic'; P.vignette = false; P.grain = false;
        if (!(P.captions && P.captions.length)) P.captions = genCaptions();
        var s = (scriptInput.value || '').trim();
        if (!P.texts.length && s) { var hook = s.split(/[.!?\n]/)[0].split(/\s+/).slice(0, 6).join(' '); if (hook) P.texts.push({ id: uid(), text: hook.toUpperCase(), start: P.trimStart, end: P.trimStart + 3, posY: 0.12, size: 1.1, color: '#FFE14D', box: false, anim: 'pop' }); }
        P.flashes = []; var _fspan = Math.max(1, P.trimEnd - P.trimStart), _fstep = Math.max(P.pulseEvery, _fspan / 16);
        for (var t = P.trimStart + _fstep; t < P.trimEnd && P.flashes.length < 16; t += _fstep) P.flashes.push(t);
        repaint(); renderTimeline(); previewBurst();
        var _ms = computeMonetScore();
        $('footNote').textContent = '✨ Edición AUTO aplicada — efectividad ' + _ms.score + '/100 (' + _ms.verdict + ')';
      }
      b.textContent = 'APLICADO — mirá la preview ▶';
      setTimeout(function () { b.textContent = '✨ APLICAR DE NUEVO'; }, 2600);
    });
    toolPanel.appendChild(rowRange('Intensidad', 0, 100, 1, Math.round(P.kbIntensity * 100), function (v) { return v + '%'; }, kfGenOnIn(function (v) { P.kbIntensity = v / 100; })));
    toolPanel.appendChild(rowRange('Punch cada', 6, 45, 1, P.pulseEvery, function (v) { return v + 's'; }, kfGenOnIn(function (v) { P.pulseEvery = v; renderTimeline(); })));
    toolPanel.appendChild(el('div', 'hintline', 'Tip: el "Punch" son los acercamientos periódicos (pattern interrupts) que suben la retención.'));

    // ── 1-CLICK PRO POR NICHO: deja TODO listo (color + zoom + subs + intro + outro + barra) ──
    var hr = el('div', 'hintline', '———'); hr.style.opacity = '0.3'; toolPanel.appendChild(hr);
    toolPanel.appendChild(el('div', 'tp-title', '1-CLICK PRO POR NICHO'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Elegí tu nicho y dejá el video listo de una: color de cine, zoom dinámico, subtítulos del guion, intro hook, outro CTA y barra de progreso. Edición de canal ganador en un click.'));
    var selRow = el('div', 'row'); selRow.appendChild(el('span', 'lab', 'Nicho'));
    var sel = document.createElement('select');
    (typeof TEMPLATES !== 'undefined' ? TEMPLATES : []).forEach(function (t, i) { var o = document.createElement('option'); o.value = String(i); o.textContent = t.emoji + ' ' + t.niche; sel.appendChild(o); });
    // APENAS ELEGÍS el nicho ya se aplican sus efectos de ambiente (ej. "Historias para dormir" → chispas/brasas de
    // fuego), sin esperar a ningún botón → "cuando lo seleccione, se aplica". El burst lo muestra moviéndose.
    sel.addEventListener('change', function () {
      var t = (typeof TEMPLATES !== 'undefined' && TEMPLATES[+sel.value]) ? TEMPLATES[+sel.value] : null; if (!t) return;
      var r = t.recipe || {};
      P.embers = P.embers || { on: false, intensity: 0.6 };
      P.embers.on = !!r.embers; if (r.embersInt) P.embers.intensity = r.embersInt;
      if (r.embers && $('footNote')) $('footNote').textContent = '🔥 Chispas de fuego activadas para "' + t.niche + '". Aplicá el preset o exportá.';
      try { repaint(); } catch (e) {}
      try { previewBurst(); } catch (e) {}
    });
    selRow.appendChild(sel); toolPanel.appendChild(selRow);
    toolPanel.appendChild(el('div', 'hintline', 'Elegí el nicho y usá "✨ APLICAR EDICIÓN AUTOMÁTICA" arriba: deja color, zoom, chispas, subtítulos e intro/outro de ese estilo en un click.'));
  }

  // Aplica el paquete PRO completo de un nicho (combina plantilla + intro/outro + barra)
  function applyProPreset(tpl) {
    var r = tpl.recipe || {};
    applyMode('auto');
    P.texts = []; P.flashes = []; P.zooms = [];   // limpiar elementos manuales viejos (antes quedaban fantasma sobre el preset nuevo, fuera de tiempo)
    if (r.grade) P.grade = r.grade;
    if (typeof r.kenBurns === 'boolean') P.kenBurns = r.kenBurns;
    if (r.kbIntensity != null) P.kbIntensity = r.kbIntensity;
    if (typeof r.pulse === 'boolean') P.pulse = r.pulse;
    if (r.pulseEvery != null) P.pulseEvery = r.pulseEvery;
    P.vignette = !!r.vignette; P.grain = !!r.grain;
    // CHISPAS / BRASAS DE FUEGO: el nicho lo pide en su receta (ej. "Historias para dormir") → se activa solo.
    P.embers = P.embers || { on: false, intensity: 0.6 };
    P.embers.on = !!r.embers; if (r.embersInt) P.embers.intensity = r.embersInt;
    P.breath = P.breath || { on: false, amt: 0.06, period: 5 }; P.breath.on = !!r.breath;
    if (r.capStyle) { if (r.capStyle.size) P.capStyle.size = r.capStyle.size; if (r.capStyle.posY) P.capStyle.posY = r.capStyle.posY; if (typeof r.capStyle.box === 'boolean') P.capStyle.box = r.capStyle.box; }
    if (r.captions !== false && !(P.captions && P.captions.length)) P.captions = genCaptions();
    P.progressBar = true;
    var s = (scriptInput.value || '').trim();
    var hook = s ? s.split(/[.!?\n]/)[0].split(/\s+/).slice(0, 7).join(' ') : tpl.niche;
    P.intro = { on: true, title: (hook || tpl.niche).toUpperCase(), sub: 'quedate hasta el final', secs: 2.5 };
    P.outro = { on: true, title: 'SUSCRÍBETE 🔔', sub: 'Mirá el próximo video →', secs: 4 };
    modeBadge.textContent = 'AUTO';
    repaint(); renderTimeline();
    var _ms = computeMonetScore();
    $('footNote').textContent = 'Preset PRO aplicado — efectividad ' + _ms.score + '/100 (' + _ms.verdict + ')';
    previewBurst();
  }

  function panelTrim() {
    toolPanel.appendChild(el('div', 'tp-title', 'RECORTAR'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Definí dónde empieza y termina el video final. Mové el playhead y fijá inicio/fin.'));
    var info = el('div', 'row'); info.appendChild(el('span', 'lab', 'Selección')); var sp = el('span', null, fmt(P.trimStart) + ' → ' + fmt(P.trimEnd)); info.appendChild(sp); toolPanel.appendChild(info);
    var b1 = el('button', 'mini-btn sec', '⏮ Fijar INICIO en el playhead'); toolPanel.appendChild(b1);
    var b2 = el('button', 'mini-btn sec', 'Fijar FIN en el playhead'); b2.style.marginTop = '8px'; toolPanel.appendChild(b2);
    var b3 = el('button', 'mini-btn sec', '↺ Resetear recorte'); b3.style.marginTop = '8px'; toolPanel.appendChild(b3);
    b1.addEventListener('click', function () { P.trimStart = clamp(srcVideo.currentTime, 0, P.trimEnd - 0.5); sp.textContent = fmt(P.trimStart) + ' → ' + fmt(P.trimEnd); renderTimeline(); });
    b2.addEventListener('click', function () { P.trimEnd = clamp(srcVideo.currentTime, P.trimStart + 0.5, ST.dur); sp.textContent = fmt(P.trimStart) + ' → ' + fmt(P.trimEnd); renderTimeline(); });
    b3.addEventListener('click', function () { P.trimStart = 0; P.trimEnd = ST.dur; sp.textContent = fmt(P.trimStart) + ' → ' + fmt(P.trimEnd); renderTimeline(); });
    toolPanel.appendChild(rowRange('Velocidad', 50, 200, 5, Math.round(P.speed * 100), function (v) { return (v / 100).toFixed(2) + 'x'; }, function (v) { P.speed = v / 100; }));
  }

  function panelText() {
    toolPanel.appendChild(el('div', 'tp-title', '🔤 TEXTO'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Agregá títulos/hooks animados. Aparecen en el momento del playhead por 3s (editable).'));
    var r1 = el('div', 'row'); r1.appendChild(el('span', 'lab', 'Texto')); var inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'LO QUE NADIE TE CONTÓ'; r1.appendChild(inp); toolPanel.appendChild(r1);
    var pos = el('div', 'chip-row'); var posVal = 0.12;
    [['Arriba', 0.12], ['Centro', 0.5], ['Abajo', 0.85]].forEach(function (p, i) { var c = el('button', 'chip' + (i === 0 ? ' active' : ''), p[0]); c.addEventListener('click', function () { posVal = p[1]; Array.prototype.forEach.call(pos.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); }); pos.appendChild(c); }); toolPanel.appendChild(pos);
    var anim = el('div', 'chip-row'); var animVal = 'pop';
    [['Pop', 'pop'], ['Fade', 'fade'], ['Slide', 'slide'], ['Fijo', 'none']].forEach(function (p) { var c = el('button', 'chip' + (p[1] === 'pop' ? ' active' : ''), p[0]); c.addEventListener('click', function () { animVal = p[1]; Array.prototype.forEach.call(anim.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); }); anim.appendChild(c); }); toolPanel.appendChild(anim);
    var add = el('button', 'mini-btn', '+ Agregar texto en el playhead'); toolPanel.appendChild(add);
    var list = el('div', 'item-list'); toolPanel.appendChild(list);
    function refresh() {
      list.textContent = ''; if (!P.texts.length) { list.appendChild(el('div', 'empty-mini', 'Sin textos todavía.')); return; }
      P.texts.forEach(function (o) {
        var it = el('div', 'item'); var tx = el('span', 'it-txt', o.text); var tm = el('span', 'it-time', fmt(o.start)); var del = el('button', 'it-del', '✕');
        del.addEventListener('click', function () { P.texts = P.texts.filter(function (z) { return z !== o; }); refresh(); renderTimeline(); repaint(); });
        it.appendChild(tx); it.appendChild(tm); it.appendChild(del); list.appendChild(it);
      });
    }
    add.addEventListener('click', function () {
      var v = (inp.value || '').trim(); if (!v) { inp.focus(); return; }
      var st = srcVideo.currentTime; P.texts.push({ id: uid(), text: v, start: st, end: Math.min(P.trimEnd, st + 3), posY: posVal, size: 1, color: '#FFE14D', box: posVal === 0.5, anim: animVal });
      inp.value = ''; refresh(); renderTimeline(); repaint();
    });
    // ── CALLOUTS DE MOMENTO CLAVE (auto, desde el guion) ──
    if (!P.callout) P.callout = { on: false, max: 6, gapSecs: 12, color: '#FFE14D', pos: 0.80 };
    var coBox = el('div'); coBox.style.cssText = 'border:1px solid rgba(255,225,77,0.3);background:rgba(255,225,77,0.05);border-radius:10px;padding:10px 11px;margin:11px 0;';
    coBox.appendChild(el('div', null, '✦ MOMENTOS CLAVE (auto)')).style.cssText = 'font-weight:900;font-size:11px;color:#FFE14D;letter-spacing:.03em;margin-bottom:3px;';
    coBox.appendChild(el('div', null, 'Lee el guion, detecta fechas, años, cifras, dinero y % (en dígitos Y escritos: ES/DE/FR) y coloca pocos carteles grandes y animados en el momento que se dicen. Editables/borrables como cualquier texto.')).style.cssText = 'font-size:10px;color:var(--mut);line-height:1.5;margin-bottom:8px;';
    coBox.appendChild(rowRange('Máximo de carteles', 1, 20, 1, P.callout.max, function (v) { return v + ''; }, function (v) { P.callout.max = v; }));
    coBox.appendChild(rowRange('Separación mínima', 4, 40, 1, P.callout.gapSecs, function (v) { return v + 's'; }, function (v) { P.callout.gapSecs = v; }));
    var apc = el('button', 'mini-btn', '✦ Detectar y colocar carteles'); coBox.appendChild(apc);
    var coInfo = el('div', 'hintline', ''); coBox.appendChild(coInfo);
    function coUpd(n) {
      var cur = (P.texts || []).filter(function (o) { return o._gen === 'callout'; }).length;
      coInfo.textContent = (n == null ? (cur ? (cur + ' carteles colocados.') : 'Pegá el guion en la pantalla de carga, luego detectá.') : ('✦ ' + n + ' carteles colocados en sus momentos.'));
    }
    apc.addEventListener('click', function () {
      if (!(scriptInput.value || '').trim()) { alert('Pegá primero el guion (pantalla de carga) para detectar momentos clave.'); return; }
      P.callout.on = true; var n = applyCallouts(); coUpd(n); refresh(); renderTimeline(); repaint();
    });
    var coClr = el('button', 'mini-btn sec', 'Quitar carteles auto'); coClr.style.marginTop = '8px'; coBox.appendChild(coClr);
    coClr.addEventListener('click', function () { P.texts = (P.texts || []).filter(function (o) { return o._gen !== 'callout'; }); P.callout.on = false; coUpd(0); refresh(); renderTimeline(); repaint(); });
    toolPanel.appendChild(coBox); coUpd();
    // CTA "Suscríbete" en los últimos 5s (sube session time / retención → monetización)
    var cta = el('button', 'mini-btn sec', '📣 CTA "Suscríbete" (últimos 5s)'); cta.style.marginTop = '8px'; toolPanel.appendChild(cta);
    cta.addEventListener('click', function () {
      var endT = P.trimEnd;
      P.texts.push({ id: uid(), text: 'SUSCRÍBETE 🔔', start: Math.max(P.trimStart, endT - 5), end: endT, posY: 0.85, size: 1.1, color: '#00FF88', box: true, anim: 'pop' });
      refresh(); renderTimeline(); repaint();
    });
    refresh();
  }

  function panelZoom() {
    _kfGenAsked = false;   // rearma el confirm destructivo de los generadores al abrir el panel
    toolPanel.appendChild(el('div', 'tp-title', 'ZOOM'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Ken Burns (zoom lento continuo) + punch-ins manuales en momentos clave.'));
    toolPanel.appendChild(rowToggle('Ken Burns', P.kenBurns, kfGenOnIn(function (v) { P.kenBurns = v; })));
    toolPanel.appendChild(rowRange('Intensidad', 0, 100, 1, Math.round(P.kbIntensity * 100), function (v) { return v + '%'; }, kfGenOnIn(function (v) { P.kbIntensity = v / 100; })));
    // ── POR IMAGEN (slideshow): movimiento fresco por cada foto + corte en cada cambio ──
    var shotBox = el('div'); shotBox.style.cssText = 'border:1px solid rgba(0,220,130,0.3);background:rgba(0,220,130,0.05);border-radius:10px;padding:10px 11px;margin:4px 0 11px;';
    shotBox.appendChild(el('div', null, 'MODO POR IMAGEN')).style.cssText = 'font-weight:900;font-size:11px;color:#fff;letter-spacing:.03em;margin-bottom:3px;';
    shotBox.appendChild(el('div', null, 'Si tu video se arma con muchas fotos fijas de igual duración: cada foto recibe un Ken Burns propio (alterna acercar/alejar y dirección) + un corte en cada cambio. No más una sola rampa en todo el video.')).style.cssText = 'font-size:10px;color:var(--mut);line-height:1.5;margin-bottom:8px;';
    var shotInfo = el('div', 'hintline', '');
    function shotUpd() { var n = zShotCount(); shotInfo.textContent = P.shotMode ? (n > 1 ? ('✓ ' + n + ' imágenes detectadas (' + P.shotSecs + 's c/u) → ' + n + ' movimientos + ' + (n - 1) + ' cortes') : '⚠ Con esa duración sale 1 sola toma. Bajá los segundos por imagen.') : 'Apagado — una sola rampa en todo el video.'; }
    function shotSyncTrans() { if (P.mode === 'auto') { P.transitions = P.shotMode ? genShotTransitions() : genTransitions(); renderTimeline(); } }
    shotBox.appendChild(rowToggle('Activar modo por imagen', !!P.shotMode, kfGenOnIn(function (v) { P.shotMode = v; shotSyncTrans(); shotUpd(); })));
    shotBox.appendChild(rowRange('Segundos por imagen', 1, 15, 1, P.shotSecs || 4, function (v) { return v + 's'; }, kfGenOnIn(function (v) { P.shotSecs = v; shotSyncTrans(); shotUpd(); })));
    shotBox.appendChild(rowToggle('Corte en cada imagen', P.shotTrans !== false, function (v) { P.shotTrans = v; if (P.mode === 'auto') { P.transitions = P.shotMode ? genShotTransitions() : genTransitions(); } renderTimeline(); repaint(); shotUpd(); }));
    shotBox.appendChild(shotInfo); shotUpd();
    toolPanel.appendChild(shotBox);
    toolPanel.appendChild(rowToggle('Punch auto', P.pulse, kfGenOnIn(function (v) { P.pulse = v; })));
    toolPanel.appendChild(rowRange('Punch cada', 6, 45, 1, P.pulseEvery, function (v) { return v + 's'; }, kfGenOnIn(function (v) { P.pulseEvery = v; })));
    var scaleVal = 1.18;
    toolPanel.appendChild(rowRange('Fuerza punch', 105, 145, 1, Math.round(scaleVal * 100), function (v) { return '+' + (v - 100) + '%'; }, function (v) { scaleVal = v / 100; }));
    var add = el('button', 'mini-btn', '+ Punch-in en el playhead'); toolPanel.appendChild(add);
    var list = el('div', 'item-list'); toolPanel.appendChild(list);
    function refresh() { list.textContent = ''; if (!P.zooms.length) { list.appendChild(el('div', 'empty-mini', 'Sin punch-ins manuales.')); return; } P.zooms.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (z) { var it = el('div', 'item'); it.appendChild(el('span', 'it-txt', 'Punch +' + Math.round((z.scale - 1) * 100) + '%')); it.appendChild(el('span', 'it-time', fmt(z.t))); var del = el('button', 'it-del', '✕'); del.addEventListener('click', function () { P.zooms = P.zooms.filter(function (x) { return x !== z; }); refresh(); renderTimeline(); repaint(); }); it.appendChild(del); list.appendChild(it); }); }
    add.addEventListener('click', function () { P.zooms.push({ t: srcVideo.currentTime, scale: scaleVal }); refresh(); renderTimeline(); repaint(); });
    refresh();
  }

  function panelColor() {
    toolPanel.appendChild(el('div', 'tp-title', 'COLOR / FILTRO'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Grados de color profesionales. El "pop" y el cine son los que más resaltan en el feed.'));
    var row = el('div', 'chip-row');
    Object.keys(GRADES).forEach(function (k) { var c = el('button', 'chip' + (P.grade === k ? ' active' : ''), GRADES[k].label); c.addEventListener('click', function () { P.grade = k; Array.prototype.forEach.call(row.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); repaint(); }); row.appendChild(c); });
    toolPanel.appendChild(row);
  }

  var _annoPlace = null;   // {color, ang, r, secs} mientras el usuario va a clickear el canvas para colocar
  var _annoPick = { color: '#FFD93D', ang: 2.356, r: 0.1, secs: 2.5 };   // últimos ajustes elegidos (persisten entre clicks)
  // Direcciones desde donde "entra" la flecha (ángulo de la cola respecto a la punta)
  var ANNO_DIRS = [['↘', 2.356], ['↙', 0.785], ['→', 3.1416], ['←', 0], ['↓', -1.5708], ['↑', 1.5708]];
  function panelAnno() {
    if (!P.annos) P.annos = [];
    var pick = _annoPick;   // ajustes persistentes (no se pierden entre flechas)
    toolPanel.appendChild(el('div', 'tp-title', '🖍️ SEÑALAR (flechas)'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Elegí dirección/color y hacé CLICK EN EL VIDEO donde querés la flecha. Se dibuja a mano (la ves completa al pausar; se traza sola al reproducir). Cada flecha aparece en su carril abajo para moverla o borrarla.'));
    var colors = ['#00DC82', '#FFD93D', '#FF5A5A', '#4FC3F7', '#FFFFFF'];
    // dirección de la flecha (desde dónde apunta)
    var dr = el('div', 'row'); dr.appendChild(el('span', 'lab', 'Apunta desde'));
    var dwrap = el('div'); dwrap.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;';
    ANNO_DIRS.forEach(function (d) { var b = el('button', 'chip' + (pick.ang === d[1] ? ' active' : ''), d[0]); b.style.cssText += 'min-width:34px;font-size:15px;'; b.addEventListener('click', function () { pick.ang = d[1]; Array.prototype.forEach.call(dwrap.children, function (x) { x.classList.remove('active'); }); b.classList.add('active'); }); dwrap.appendChild(b); });
    dr.appendChild(dwrap); toolPanel.appendChild(dr);
    // color
    var cr = el('div', 'row'); cr.appendChild(el('span', 'lab', 'Color'));
    var sw = el('div'); sw.style.cssText = 'display:flex;gap:6px;';
    colors.forEach(function (col) { var b = document.createElement('button'); b.style.cssText = 'width:22px;height:22px;border-radius:6px;border:2px solid ' + (pick.color === col ? '#fff' : 'transparent') + ';background:' + col + ';cursor:pointer;padding:0;'; b.addEventListener('click', function () { pick.color = col; Array.prototype.forEach.call(sw.children, function (x) { x.style.borderColor = 'transparent'; }); b.style.borderColor = '#fff'; }); sw.appendChild(b); });
    cr.appendChild(sw); toolPanel.appendChild(cr);
    // tamaño + duración
    toolPanel.appendChild(rowRange('Tamaño', 5, 22, 1, Math.round(pick.r * 100), function (v) { return v + '%'; }, function (v) { pick.r = v / 100; }));
    toolPanel.appendChild(rowRange('Duración', 1, 6, 1, Math.round(pick.secs), function (v) { return v + 's'; }, function (v) { pick.secs = v; }));
    // banner: estando en este panel, cualquier click en el video coloca la flecha (sin botón previo)
    var bn = el('div', 'hintline', '👉 Hacé CLICK directo en el video para poner una flecha. El cursor es una cruz mientras estés acá.');
    bn.style.cssText += 'background:rgba(255,217,61,0.1);border:1px solid rgba(255,217,61,0.35);border-radius:8px;padding:8px 10px;color:#fff;';
    toolPanel.appendChild(bn);
    _annoPlace = pick; stage.style.cursor = 'crosshair';   // modo colocar SIEMPRE activo en este panel
    // lista de flechas existentes
    var list = el('div', 'item-list'); toolPanel.appendChild(list);
    function refresh() {
      list.textContent = '';
      if (!P.annos.length) { list.appendChild(el('div', 'empty-mini', 'Sin flechas. Elegí dirección y clickeá el video.')); return; }
      P.annos.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (an) {
        var it = el('div', 'item');
        it.appendChild(el('span', 'it-txt', '➤ Flecha'));
        it.appendChild(el('span', 'it-time', fmt(an.start) + '–' + fmt(an.end)));
        var del = el('button', 'it-del', '✕'); del.addEventListener('click', function () { P.annos = P.annos.filter(function (x) { return x !== an; }); refresh(); renderTimeline(); repaint(); }); it.appendChild(del);
        list.appendChild(it);
      });
    }
    panelAnno._refresh = refresh;
    refresh();
  }
  // Click en el canvas para colocar la flecha (activo SOLO mientras estás en el panel 🖍️ Señalar)
  stage.addEventListener('click', function (e) {
    if (!_annoPlace || !P || ST.activeTool !== 'anno') return;
    if (ST.playing) { try { stopPlay(); } catch (er) {} }   // pausar para que la veas completa al colocar
    var r = stage.getBoundingClientRect();
    var x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp((e.clientY - r.top) / r.height, 0, 1);
    var t0 = srcVideo.currentTime || P.trimStart, secs = _annoPlace.secs || 2.5;
    P.annos.push({ id: uid(), kind: 'arrow', x: x, y: y, ang: _annoPlace.ang, r: _annoPlace.r || 0.1, start: t0, end: Math.min(P.trimEnd, t0 + secs), color: _annoPlace.color });
    // NO desarmamos _annoPlace: podés poner varias flechas seguidas sin re-tocar nada.
    if (panelAnno._refresh) panelAnno._refresh();
    renderTimeline(); repaint();
    $('footNote').textContent = '✓ Flecha agregada (' + P.annos.length + '). Mirá su carril 🖍️ en la línea de tiempo.';
  });

  function panelFace() {
    if (!P.face) P.face = { on: false, mode: 'both', zoom: 1.7, hold: 2.2, scanned: false, shots: [] };
    toolPanel.appendChild(el('div', 'tp-title', 'SEGUIR PERSONAJE'));
    toolPanel.appendChild(el('div', 'tp-desc', 'La IA detecta las caras del video (100% local) y, donde aparece un personaje, le hace ZOOM a la cara + le pone una FLECHA y un anillo señalándolo. Sube retención y transforma el video.'));
    if (typeof faceapi === 'undefined') {
      var w = el('div'); w.style.cssText = 'border:1px solid rgba(255,217,61,0.35);background:rgba(255,217,61,0.08);border-radius:10px;padding:12px;color:#fff;font-size:11px;line-height:1.6;';
      w.appendChild(el('div', null, '⚠ El detector de caras automático no cargó.')).style.fontWeight = '800';
      w.appendChild(el('div', null, 'Recargá la extensión en chrome://extensions (botón ↻) y reabrí el Studio.'));
      w.appendChild(el('div', null, '👉 Mientras tanto, podés señalar a mano con la pestaña 🖍️ Señalar (no necesita IA y funciona siempre).')).style.marginTop = '8px';
      toolPanel.appendChild(w); return;
    }
    var scanBtn = el('button', 'mini-btn', P.face.scanned ? ('🔁 Re-escanear caras (' + P.face.shots.length + ' detectadas)') : 'Escanear caras del video');
    toolPanel.appendChild(scanBtn);
    var status = el('div', 'hintline', P.face.scanned ? ('✓ ' + P.face.shots.length + ' apariciones detectadas.') : 'Tip: escaneá primero; el análisis tarda unos segundos.');
    toolPanel.appendChild(status);
    // controles (se habilitan tras escanear)
    var wrap = el('div'); toolPanel.appendChild(wrap);
    function buildControls() {
      wrap.textContent = '';
      wrap.appendChild(rowToggle('Activar seguimiento', P.face.on, function (v) { P.face.on = v; repaint(); }));
      var mr = el('div', 'row'); mr.appendChild(el('span', 'lab', 'Estilo'));
      var sel = document.createElement('select');
      [['both', 'Zoom + flecha'], ['zoom', 'Solo zoom a la cara'], ['arrow', '➤ Solo flecha + anillo']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (P.face.mode === o[0]) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', function () { P.face.mode = sel.value; repaint(); }); mr.appendChild(sel); wrap.appendChild(mr);
      wrap.appendChild(rowRange('Fuerza del zoom', 120, 240, 1, Math.round((P.face.zoom || 1.7) * 100), function (v) { return '+' + (v - 100) + '%'; }, function (v) { P.face.zoom = v / 100; repaint(); }));
      wrap.appendChild(rowRange('Duración por cara', 1, 5, 1, Math.round(P.face.hold || 2.2), function (v) { return v + 's'; }, function (v) { P.face.hold = v; repaint(); }));
    }
    if (P.face.scanned && P.face.shots.length) buildControls();
    scanBtn.addEventListener('click', function () {
      scanBtn.disabled = true; status.textContent = 'Cargando detector…';
      faceScan(function (p) { status.textContent = 'Analizando… ' + Math.round(p * 100) + '%'; }).then(function (res) {
        scanBtn.disabled = false;
        if (!res.ok) { status.textContent = '⚠ No se pudo cargar el detector. Recargá la extensión.'; return; }
        P.face.shots = res.shots; P.face.scanned = true;
        if (!res.shots.length) { status.textContent = '😕 No se detectaron caras en este video.'; renderTimeline(); return; }
        P.face.on = true;
        status.textContent = '✓ ' + res.shots.length + ' apariciones detectadas. ¡Listo!';
        scanBtn.textContent = '🔁 Re-escanear caras (' + res.shots.length + ' detectadas)';
        buildControls(); renderTimeline(); seekTo(P.trimStart); repaint();
      }).catch(function () { scanBtn.disabled = false; status.textContent = '⚠ Error en el escaneo.'; });
    });
  }

  function panelFx() {
    if (!P.liveFilm) P.liveFilm = { on: false, intensity: 0.6, secs: 0, particles: true, lightRay: false, dust: true };
    toolPanel.appendChild(el('div', 'tp-title', '✨ EFECTOS'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Capa visual que transforma el video (lo que YouTube mira para no marcarlo como reusado).'));
    // ── CINE VIVO: convierte imágenes en "video filmado" (lo más fuerte contra desmonetización) ──
    var lf = el('div'); lf.style.cssText = 'border:1px solid rgba(0,220,130,0.32);background:rgba(0,220,130,0.06);border-radius:11px;padding:11px;margin-bottom:13px;';
    lf.appendChild(el('div', null, 'CINE VIVO')).style.cssText = 'font-weight:900;font-size:11.5px;color:#fff;letter-spacing:.04em;margin-bottom:3px;';
    lf.appendChild(el('div', null, 'Convierte imágenes estáticas en VIDEO REAL: la cámara respira + polvo y luz que flotan. Cada frame es distinto → YouTube no lo marca como foto reusada. Lo más potente contra la desmonetización.')).style.cssText = 'font-size:10px;color:var(--mut);line-height:1.5;margin-bottom:9px;';
    lf.appendChild(rowToggle('Activar Cine Vivo', P.liveFilm.on, function (v) { P.liveFilm.on = v; repaint(); }));
    lf.appendChild(rowRange('Intensidad', 20, 100, 1, Math.round(P.liveFilm.intensity * 100), function (v) { return v + '%'; }, function (v) { P.liveFilm.intensity = v / 100; repaint(); }));
    lf.appendChild(rowRange('Solo primeros', 0, 60, 1, P.liveFilm.secs || 0, function (v) { return v === 0 ? 'todo' : v + 's'; }, function (v) { P.liveFilm.secs = v; repaint(); }));
    lf.appendChild(rowToggle('Polvo flotante', P.liveFilm.dust, function (v) { P.liveFilm.dust = v; repaint(); }));
    lf.appendChild(rowToggle('Rayo de luz', P.liveFilm.lightRay, function (v) { P.liveFilm.lightRay = v; repaint(); }));
    toolPanel.appendChild(lf);

    // ── BRASAS / CENIZAS DE FUEGO (historias para dormir / chimenea) ──
    if (!P.embers) P.embers = { on: false, intensity: 0.6 };
    var em = el('div'); em.style.cssText = 'border:1px solid rgba(255,140,40,0.34);background:rgba(255,140,40,0.06);border-radius:11px;padding:11px;margin-bottom:13px;';
    em.appendChild(el('div', null, '🔥 BRASAS / CENIZAS')).style.cssText = 'font-weight:900;font-size:11.5px;color:#ff9a3c;letter-spacing:.04em;margin-bottom:3px;';
    em.appendChild(el('div', null, 'Brasas naranjas que suben con parpadeo, vibe chimenea/fogata. Ideal para "historias para dormir", terror o relax. Suma capa de movimiento → des-estatiza.')).style.cssText = 'font-size:10px;color:var(--mut);line-height:1.5;margin-bottom:9px;';
    em.appendChild(rowToggle('Activar brasas', P.embers.on, function (v) { P.embers.on = v; repaint(); }));
    em.appendChild(rowRange('Intensidad', 20, 100, 1, Math.round((P.embers.intensity || 0.6) * 100), function (v) { return v + '%'; }, function (v) { P.embers.intensity = v / 100; repaint(); }));
    toolPanel.appendChild(em);
    toolPanel.appendChild(rowToggle('Viñeta cine', P.vignette, function (v) { P.vignette = v; repaint(); }));
    toolPanel.appendChild(rowToggle('Grano de film', P.grain, function (v) { P.grain = v; repaint(); }));
    toolPanel.appendChild(rowToggle('Shake (cámara viva)', P.shake, function (v) { P.shake = v; repaint(); }));
    var add = el('button', 'mini-btn', 'Flash en el playhead'); toolPanel.appendChild(add);
    var clr = el('button', 'mini-btn sec', 'Quitar todos los flashes'); clr.style.marginTop = '8px'; toolPanel.appendChild(clr);
    var list = el('div', 'item-list'); toolPanel.appendChild(list);
    function refresh() { list.textContent = ''; if (!P.flashes.length) { list.appendChild(el('div', 'empty-mini', 'Sin flashes.')); return; } P.flashes.slice().sort(function (a, b) { return a - b; }).forEach(function (f) { var it = el('div', 'item'); it.appendChild(el('span', 'it-txt', 'Flash')); it.appendChild(el('span', 'it-time', fmt(f))); var del = el('button', 'it-del', '✕'); del.addEventListener('click', function () { P.flashes = P.flashes.filter(function (x) { return x !== f; }); refresh(); renderTimeline(); }); it.appendChild(del); list.appendChild(it); }); }
    add.addEventListener('click', function () { P.flashes.push(srcVideo.currentTime); refresh(); renderTimeline(); });
    clr.addEventListener('click', function () { P.flashes = []; refresh(); renderTimeline(); });
    refresh();
  }

  function panelTransitions() {
    if (!P.fx) P.fx = { letterbox: false, lightLeak: false, chroma: false };
    if (P.transition == null) P.transition = 'mix';
    if (!P.transEvery) P.transEvery = 4;
    if (!P.transitions) P.transitions = [];
    toolPanel.appendChild(el('div', 'tp-title', 'TRANSICIONES Y EFECTOS'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Cada transición es un CLIP en la línea de tiempo (abajo): la ves, la ARRASTRÁS para moverla y DOBLE-CLICK para borrarla — igual que CapCut. Si una te parece exagerada, la sacás.'));
    var sr = el('div', 'row'); sr.appendChild(el('span', 'lab', 'Estilo'));
    var sel = document.createElement('select');
    [['mix', '🎲 Mix (variado)'], ['flash', 'Flash'], ['dip', 'Fundido a negro'], ['zoomblur', 'Zoom blur'], ['whip', 'Whip (barrido)'], ['glitch', 'Glitch'], ['rgb', 'RGB split']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (P.transition === o[0]) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { P.transition = sel.value; });
    sr.appendChild(sel); toolPanel.appendChild(sr);
    toolPanel.appendChild(rowRange('Corte cada', 2, 10, 1, P.transEvery, function (v) { return v + 's'; }, function (v) { P.transEvery = v; }));
    var gen = el('button', 'mini-btn', '🎲 Generar en todos los cortes'); toolPanel.appendChild(gen);
    var addP = el('button', 'mini-btn sec', '➕ Agregar en el playhead'); addP.style.marginTop = '8px'; toolPanel.appendChild(addP);
    var clr = el('button', 'mini-btn sec', '🗑 Quitar todas'); clr.style.marginTop = '8px'; toolPanel.appendChild(clr);
    var list = el('div', 'item-list'); toolPanel.appendChild(list);
    function refresh() {
      list.textContent = '';
      var arr = (P.transitions || []).slice().sort(function (a, b) { return a.t - b.t; });
      if (!arr.length) { list.appendChild(el('div', 'empty-mini', 'Sin transiciones. Tocá "Generar en todos los cortes".')); return; }
      arr.forEach(function (tr) {
        var it = el('div', 'item');
        it.appendChild(el('span', 'it-txt', (TRANS_LABEL[tr.kind] || tr.kind)));
        it.appendChild(el('span', 'it-time', fmt(tr.t)));
        var del = el('button', 'it-del', '✕'); del.addEventListener('click', function () { P.transitions = P.transitions.filter(function (x) { return x !== tr; }); refresh(); renderTimeline(); repaint(); });
        it.appendChild(del); list.appendChild(it);
      });
    }
    gen.addEventListener('click', function () { P.transitions = genTransitions(); refresh(); renderTimeline(); previewBurst(); });
    addP.addEventListener('click', function () { var kind = P.transition === 'mix' ? TRANS_KINDS[(P.transitions.length) % TRANS_KINDS.length] : P.transition; if (kind === 'none' || !kind) kind = 'flash'; P.transitions.push({ t: clamp(srcVideo.currentTime, P.trimStart, P.trimEnd), kind: kind }); refresh(); renderTimeline(); repaint(); });
    clr.addEventListener('click', function () { P.transitions = []; refresh(); renderTimeline(); repaint(); });
    var hr = el('div', 'hintline', '———'); hr.style.opacity = '0.3'; toolPanel.appendChild(hr);
    toolPanel.appendChild(el('div', 'tp-title', '✨ EFECTOS DE CINE (toda la toma)'));
    toolPanel.appendChild(rowToggle('Barras de cine (letterbox)', P.fx.letterbox, function (v) { P.fx.letterbox = v; repaint(); }));
    toolPanel.appendChild(rowToggle('Fuga de luz (light leak)', P.fx.lightLeak, function (v) { P.fx.lightLeak = v; previewBurst(); }));
    toolPanel.appendChild(rowToggle('Aberración cromática', P.fx.chroma, function (v) { P.fx.chroma = v; repaint(); }));
    var see = el('button', 'mini-btn', '▶ Ver en movimiento'); see.style.marginTop = '10px'; toolPanel.appendChild(see);
    see.addEventListener('click', function () { previewBurst(); });
    toolPanel.appendChild(el('div', 'hintline', 'En la línea de tiempo: arrastrá una transición para moverla, doble-click para borrarla.'));
    refresh();
  }

  function panelCaption() {
    toolPanel.appendChild(el('div', 'tp-title', '💬 SUBTÍTULOS'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Los subtítulos suben retención Y cuentan como "narración/valor original" para YouTube. Se generan del guion.'));
    var gen = el('button', 'mini-btn', '✨ Generar subtítulos del guion'); toolPanel.appendChild(gen);
    var clr = el('button', 'mini-btn sec', 'Quitar subtítulos'); clr.style.marginTop = '8px'; toolPanel.appendChild(clr);

    // ── PLANTILLAS DE SUBTÍTULO (estilo CapCut) ──
    var hrT = el('div', 'hintline', '———'); hrT.style.opacity = '0.3'; toolPanel.appendChild(hrT);
    toolPanel.appendChild(el('div', 'tp-title', 'PLANTILLA / TIPOGRAFÍA'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Elegí el estilo del subtítulo: cambia la fuente, el color, el resaltado y la caja. Como las plantillas de CapCut.'));
    var grid = el('div'); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:4px 0 10px;';
    function refreshTplSel() { Array.prototype.forEach.call(grid.children, function (b) { b.style.outline = (b._tpl === (P.capStyle.tpl || 'clasico')) ? '2px solid #00DC82' : '2px solid transparent'; }); }
    function syncFontUpper() { try { fontSel.value = P.capStyle.font || 'black'; var inp = upRow.querySelector('input'); if (inp) inp.checked = !!P.capStyle.upper; } catch (e) {} }
    CAP_TEMPLATES.forEach(function (t) {
      var b = document.createElement('button'); b._tpl = t.id; b.textContent = t.name;
      var bg = t.boxStyle === 'none' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.55)';
      b.style.cssText = 'padding:11px 4px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:' + bg + ';color:' + t.color + ';cursor:pointer;font-weight:900;font-size:12px;font-family:' + capFontStack(t.font) + ';' + (t.upper ? 'text-transform:uppercase;' : '') + 'text-shadow:0 1px 3px rgba(0,0,0,0.95);outline:2px solid transparent;transition:outline .1s;';
      b.addEventListener('click', function () { applyCapTemplate(t.id); refreshTplSel(); syncFontUpper(); renderTimeline(); repaint(); });
      grid.appendChild(b);
    });
    toolPanel.appendChild(grid);
    // Fuente (override de tipografía sobre la plantilla)
    var fr = el('div', 'row'); fr.appendChild(el('span', 'lab', 'Fuente'));
    var fontSel = document.createElement('select');
    fontSel.style.cssText = 'flex:1;background:#10151c;color:#e7ecf2;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:5px 6px;font-size:12px;cursor:pointer;';
    CAP_FONTS.forEach(function (f) { var op = document.createElement('option'); op.value = f.id; op.textContent = f.name; try { op.style.fontFamily = f.stack; } catch (e) {} if ((P.capStyle.font || 'black') === f.id) op.selected = true; fontSel.appendChild(op); });
    fontSel.addEventListener('change', function () { P.capStyle.font = fontSel.value; repaint(); });
    fr.appendChild(fontSel); toolPanel.appendChild(fr);
    // MAYÚSCULAS
    var upRow = rowToggle('MAYÚSCULAS', !!P.capStyle.upper, function (v) { P.capStyle.upper = v; repaint(); });
    toolPanel.appendChild(upRow);
    refreshTplSel();

    var hrS = el('div', 'hintline', '———'); hrS.style.opacity = '0.3'; toolPanel.appendChild(hrS);
    toolPanel.appendChild(rowRange('Tamaño', 70, 150, 5, Math.round(P.capStyle.size * 100), function (v) { return v + '%'; }, function (v) { P.capStyle.size = v / 100; repaint(); }));
    toolPanel.appendChild(rowRange('Altura', 60, 95, 1, Math.round(P.capStyle.posY * 100), function (v) { return v + '%'; }, function (v) { P.capStyle.posY = v / 100; repaint(); }));
    toolPanel.appendChild(rowToggle('Caja de fondo', P.capStyle.box, function (v) { P.capStyle.box = v; repaint(); }));
    // ── RESALTADO AUTOMÁTICO DE DATOS CLAVE (fechas, cifras, dinero) ──
    var hr = el('div', 'hintline', '———'); hr.style.opacity = '0.3'; toolPanel.appendChild(hr);
    toolPanel.appendChild(el('div', 'tp-title', '🔆 RESALTAR DATOS CLAVE'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Detecta solo los subtítulos con fechas ("diciembre de 1994"), años, cifras, dinero o % y los pinta más grandes, en negrita y con su color + borde. El espectador no se pierde el dato importante.'));
    toolPanel.appendChild(rowToggle('Resaltado automático', P.capStyle.hi !== false, function (v) { P.capStyle.hi = v; repaint(); }));
    var cr = el('div', 'row'); cr.appendChild(el('span', 'lab', 'Color del dato'));
    var sw = el('div'); sw.style.cssText = 'display:flex;gap:6px;';
    ['#FFD93D', '#00DC82', '#FF5A5A', '#4FC3F7', '#FFFFFF'].forEach(function (col) {
      var b = document.createElement('button'); b.style.cssText = 'width:22px;height:22px;border-radius:6px;border:2px solid ' + ((P.capStyle.hiColor || '#FFD93D') === col ? '#fff' : 'transparent') + ';background:' + col + ';cursor:pointer;padding:0;';
      b.addEventListener('click', function () { P.capStyle.hiColor = col; Array.prototype.forEach.call(sw.children, function (x) { x.style.borderColor = 'transparent'; }); b.style.borderColor = '#fff'; repaint(); });
      sw.appendChild(b);
    });
    cr.appendChild(sw); toolPanel.appendChild(cr);
    var count = el('div', 'hintline', ''); toolPanel.appendChild(count);
    function upd() {
      if (!P.captions.length) { count.textContent = 'Sin subtítulos. Pegá el guion en la pantalla de carga y generá.'; return; }
      var keys = P.captions.filter(function (c) { return c.key; }).length;
      count.textContent = P.captions.length + ' subtítulos · ' + keys + ' con dato clave resaltado 🔆';
    }
    gen.addEventListener('click', function () { P.captions = genCaptions(); if (!P.captions.length) alert('Pegá primero el guion (botón "↺ Otro video" → pantalla de carga, o recargá el video con guion).'); upd(); renderTimeline(); repaint(); });
    clr.addEventListener('click', function () { P.captions = []; upd(); renderTimeline(); repaint(); });
    upd();
  }

  function textRow(label, val, ph, onIn) {
    var r = el('div', 'row'); r.appendChild(el('span', 'lab', label));
    var i = document.createElement('input'); i.type = 'text'; i.value = val || ''; i.placeholder = ph || '';
    i.addEventListener('input', function () { onIn(i.value); }); r.appendChild(i); return r;
  }

  // ── PRESET DE CANAL: guardar/aplicar el ESTILO (no el video) para cada video nuevo ──
  function loadPresets(cb) { try { if (chrome && chrome.storage) { chrome.storage.local.get('nsp_ms_presets', function (r) { cb((r && r.nsp_ms_presets) || []); }); return; } } catch (e) {} cb([]); }
  function savePresets(arr, cb) { try { if (chrome && chrome.storage) { chrome.storage.local.set({ nsp_ms_presets: arr }, cb || function () {}); return; } } catch (e) {} if (cb) cb(); }
  function currentStyle() {
    return {
      grade: P.grade, kenBurns: P.kenBurns, kbIntensity: P.kbIntensity, pulse: P.pulse, pulseEvery: P.pulseEvery,
      vignette: P.vignette, grain: P.grain, shake: P.shake,
      capStyle: { size: P.capStyle.size, posY: P.capStyle.posY, box: P.capStyle.box, tpl: P.capStyle.tpl, font: P.capStyle.font, upper: P.capStyle.upper, boxStyle: P.capStyle.boxStyle, stroke: P.capStyle.stroke, glow: P.capStyle.glow, color: P.capStyle.color, hiColor: P.capStyle.hiColor },
      brandText: P.brand.text, brandPos: P.brand.pos, brandOpacity: P.brand.opacity, brandSize: P.brand.size, brandLogo: (P.brand.logo && P.brand.logo.src) || '',
      progressBar: P.progressBar, progressColor: P.progressColor,
      intro: { on: P.intro.on, title: P.intro.title, sub: P.intro.sub, secs: P.intro.secs },
      outro: { on: P.outro.on, title: P.outro.title, sub: P.outro.sub, secs: P.outro.secs },
      aspect: P.aspect, speed: P.speed, musicVol: P.music.vol, origVol: P.music.origVol
    };
  }
  function applyStyle(st) {
    if (!st) return;
    P.grade = st.grade || 'none'; P.kenBurns = !!st.kenBurns; P.kbIntensity = st.kbIntensity != null ? st.kbIntensity : 0.5;
    P.pulse = !!st.pulse; P.pulseEvery = st.pulseEvery || 22; P.vignette = !!st.vignette; P.grain = !!st.grain; P.shake = !!st.shake;
    if (st.capStyle) {
      P.capStyle.size = st.capStyle.size || 1; P.capStyle.posY = st.capStyle.posY || 0.86; P.capStyle.box = !!st.capStyle.box;
      if (st.capStyle.tpl) P.capStyle.tpl = st.capStyle.tpl;
      if (st.capStyle.font) P.capStyle.font = st.capStyle.font;
      if (typeof st.capStyle.upper === 'boolean') P.capStyle.upper = st.capStyle.upper;
      if (st.capStyle.boxStyle) P.capStyle.boxStyle = st.capStyle.boxStyle;
      if (st.capStyle.stroke != null) P.capStyle.stroke = st.capStyle.stroke;
      if (st.capStyle.glow !== undefined) P.capStyle.glow = st.capStyle.glow;
      if (st.capStyle.color) P.capStyle.color = st.capStyle.color;
      if (st.capStyle.hiColor) P.capStyle.hiColor = st.capStyle.hiColor;
    }
    P.brand.text = st.brandText || ''; P.brand.pos = st.brandPos || 'br'; P.brand.opacity = st.brandOpacity != null ? st.brandOpacity : 0.85; P.brand.size = st.brandSize || 1;
    if (st.brandLogo) { var img = new Image(); img.onload = function () { P.brand.logo = img; repaint(); }; img.src = st.brandLogo; } else { P.brand.logo = null; }
    P.progressBar = !!st.progressBar; P.progressColor = st.progressColor || '#00DC82';
    if (st.intro) P.intro = { on: !!st.intro.on, title: st.intro.title || '', sub: st.intro.sub || '', secs: st.intro.secs || 2.5 };
    if (st.outro) P.outro = { on: !!st.outro.on, title: st.outro.title || 'SUSCRÍBETE 🔔', sub: st.outro.sub || '', secs: st.outro.secs || 4 };
    if (st.aspect) { P.aspect = st.aspect; computeStageSize(); }
    if (st.speed && !_isSlideshow) P.speed = st.speed;
    else if (st.speed && _isSlideshow) console.log('[ZERACK editor] el estilo pedía velocidad ' + st.speed + 'x — IGNORADA en slideshow: la voz ES la línea de tiempo (acelerarla = voz robótica + subtítulos corridos).');
    if (st.musicVol != null) P.music.vol = st.musicVol; if (st.origVol != null) P.music.origVol = st.origVol;
    repaint(); renderTimeline();
  }
  function panelPreset() {
    toolPanel.appendChild(el('div', 'tp-title', '💾 PRESET DE CANAL'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Guardá tu ESTILO (color, zoom, marca, intro/outro, formato) y aplicalo a CADA video nuevo del canal en 1 click. Consistencia = canal pro = monetización más estable.'));
    var nr = el('div', 'row'); nr.appendChild(el('span', 'lab', 'Nombre'));
    var nm = document.createElement('input'); nm.type = 'text'; nm.placeholder = 'Mi canal de historia'; nr.appendChild(nm); toolPanel.appendChild(nr);
    var sb = el('button', 'mini-btn', '💾 Guardar estilo actual'); toolPanel.appendChild(sb);
    var list = el('div', 'item-list'); toolPanel.appendChild(list);
    function refresh() {
      loadPresets(function (arr) {
        list.textContent = '';
        if (!arr.length) { list.appendChild(el('div', 'empty-mini', 'Sin presets. Guardá tu primer estilo.')); return; }
        arr.forEach(function (p, idx) {
          var it = el('div', 'item'); it.appendChild(el('span', 'it-txt', p.name || ('Preset ' + (idx + 1))));
          var ap = el('button', 'it-del'); ap.textContent = '✓'; ap.style.color = '#fff'; ap.title = 'Aplicar';
          ap.addEventListener('click', function () { applyStyle(p.style); });
          var del = el('button', 'it-del', '✕'); del.title = 'Borrar';
          del.addEventListener('click', function () { arr.splice(idx, 1); savePresets(arr, refresh); });
          it.appendChild(ap); it.appendChild(del); list.appendChild(it);
        });
      });
    }
    sb.addEventListener('click', function () {
      var name = (nm.value || '').trim() || ('Preset ' + new Date().toLocaleDateString());
      loadPresets(function (arr) { arr.unshift({ name: name, style: currentStyle() }); savePresets(arr.slice(0, 30), function () { nm.value = ''; refresh(); }); });
    });
    refresh();
  }

  function panelIntro() {
    toolPanel.appendChild(el('div', 'tp-title', 'INTRO / OUTRO'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Tarjeta de hook al inicio (sube retención) y end-screen "Suscríbete + próximo video" al final (sube session time). Las dos con fade automático.'));
    toolPanel.appendChild(rowToggle('Activar INTRO', P.intro.on, function (v) { P.intro.on = v; repaint(); }));
    toolPanel.appendChild(textRow('Título intro', P.intro.title, 'LO QUE NADIE TE CONTÓ', function (v) { P.intro.title = v; repaint(); }));
    toolPanel.appendChild(textRow('Subtítulo', P.intro.sub, 'quedate hasta el final', function (v) { P.intro.sub = v; repaint(); }));
    toolPanel.appendChild(rowRange('Dur. intro', 10, 60, 1, Math.round((P.intro.secs || 2.5) * 10), function (v) { return (v / 10).toFixed(1) + 's'; }, function (v) { P.intro.secs = v / 10; repaint(); }));
    toolPanel.appendChild(rowToggle('Activar OUTRO', P.outro.on, function (v) { P.outro.on = v; repaint(); }));
    toolPanel.appendChild(textRow('Título outro', P.outro.title, 'SUSCRÍBETE 🔔', function (v) { P.outro.title = v; repaint(); }));
    toolPanel.appendChild(textRow('Subtítulo', P.outro.sub, 'Mirá el próximo video →', function (v) { P.outro.sub = v; repaint(); }));
    toolPanel.appendChild(rowRange('Dur. outro', 20, 90, 1, Math.round((P.outro.secs || 4) * 10), function (v) { return (v / 10).toFixed(1) + 's'; }, function (v) { P.outro.secs = v / 10; repaint(); }));
    toolPanel.appendChild(el('div', 'hintline', 'Tip: el hook en los primeros 3s es lo que más decide la retención (y la monetización). Un outro con loop al próximo video sube el session time.'));
  }

  function setAvatar(file) {
    if (!file) return;
    var isVid = /^video\//.test(file.type) || /\.(mp4|webm|mov|m4v)$/i.test(file.name || '');
    var isImg = /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name || '');
    if (!isVid && !isImg) { alert('El avatar debe ser un VIDEO (MP4/WebM/MOV) o una IMAGEN (PNG/JPG/WEBP).'); return; }
    if (_avatarObjUrl) { try { URL.revokeObjectURL(_avatarObjUrl); } catch (e) {} }
    _avatarObjUrl = URL.createObjectURL(file); _avatarReady = false; _avatarImg = null;
    if (!P.avatar) P.avatar = { on: false, kind: null, name: '', pos: 'br', scale: 0.30, shape: 'rect', round: 16, border: true, opacity: 1, mode: 'always', onSecs: 8, offSecs: 6, segs: [], audio: false };
    P.avatar.on = true; P.avatar.name = file.name || (isVid ? 'avatar.mp4' : 'avatar.png');
    if (isVid) {
      P.avatar.kind = 'video';
      avatarVid.src = _avatarObjUrl; avatarVid.loop = true; avatarVid.muted = true;
      avatarVid.onloadeddata = function () { _avatarReady = true; try { avatarVid.currentTime = clamp(srcVideo.currentTime || 0, 0, (avatarVid.duration || 1) - 0.05); } catch (e) {} repaint(); setTool('avatar'); };
      avatarVid.onerror = function () { alert('No pude leer ese video de avatar. Probá MP4.'); };
    } else {
      P.avatar.kind = 'image';
      var im = new Image();
      im.onload = function () { _avatarImg = im; _avatarReady = true; repaint(); setTool('avatar'); };
      im.onerror = function () { alert('No pude leer esa imagen de avatar.'); };
      im.src = _avatarObjUrl;
    }
  }
  function panelAvatar() {
    if (!P.avatar) P.avatar = { on: false, kind: null, name: '', pos: 'br', scale: 0.30, shape: 'rect', round: 16, border: true, opacity: 1, mode: 'always', onSecs: 8, offSecs: 6, segs: [], audio: false };
    var A = P.avatar;
    toolPanel.appendChild(el('div', 'tp-title', '👤 AVATAR'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Pega tu avatar (video talking-head o imagen) ENCIMA de las imágenes. Elegí dónde, tamaño y CUÁNDO aparece: siempre, a ratos (intermitente) o en tramos que vos marcás.'));
    var up = el('button', 'mini-btn', A.name ? ('🔁 Cambiar (' + A.name + ')') : '⬆ Subir avatar (video o imagen)');
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,image/*'; inp.style.display = 'none';
    up.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () { if (inp.files && inp.files[0]) setAvatar(inp.files[0]); });
    toolPanel.appendChild(up); toolPanel.appendChild(inp);
    if (!A.kind) { toolPanel.appendChild(el('div', 'hintline', 'Aún no subiste avatar. Subí un MP4 (talking head de HeyGen/D-ID) o un PNG (personaje).')); return; }
    toolPanel.appendChild(rowToggle('Mostrar avatar', A.on, function (v) { A.on = v; if (v) avatarMirror(); repaint(); }));
    if (A.kind === 'video') {
      toolPanel.appendChild(rowToggle('🔊 Incluir voz del avatar', !!A.audio, function (v) { A.audio = v; try { avatarMirror(); } catch (e) {} }));
      toolPanel.appendChild(rowRange('Volumen de la voz', 0, 100, 1, Math.round((A.audioVol == null ? 1 : A.audioVol) * 100), function (v) { return v + '%'; }, function (v) { A.audioVol = v / 100; try { avatarVid.volume = v / 100; } catch (e) {} }));
      toolPanel.appendChild(el('div', 'hintline', 'Si tu avatar es un talking-head, su voz se mezcla en el MP4 exportado (suena sólo cuando el avatar aparece).'));
    }
    // POSICIÓN
    var pr = el('div', 'row'); pr.appendChild(el('span', 'lab', 'Posición'));
    var pg = el('div'); pg.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1;justify-content:flex-end;';
    [['br', 'Abajo der'], ['bl', 'Abajo izq'], ['tr', 'Arriba der'], ['tl', 'Arriba izq'], ['bc', 'Abajo centro'], ['cc', 'Centro']].forEach(function (o) {
      var c = el('button', 'chip' + (A.pos === o[0] ? ' active' : ''), o[1]);
      c.addEventListener('click', function () { A.pos = o[0]; Array.prototype.forEach.call(pg.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); repaint(); });
      pg.appendChild(c);
    });
    pr.appendChild(pg); toolPanel.appendChild(pr);
    // TAMAÑO / OPACIDAD / FORMA
    toolPanel.appendChild(rowRange('Tamaño', 12, 70, 1, Math.round((A.scale || 0.3) * 100), function (v) { return v + '%'; }, function (v) { A.scale = v / 100; repaint(); }));
    toolPanel.appendChild(rowRange('Opacidad', 30, 100, 1, Math.round((A.opacity == null ? 1 : A.opacity) * 100), function (v) { return v + '%'; }, function (v) { A.opacity = v / 100; repaint(); }));
    var sr = el('div', 'row'); sr.appendChild(el('span', 'lab', 'Forma'));
    var sg = el('div'); sg.style.cssText = 'display:flex;gap:5px;flex:1;justify-content:flex-end;';
    [['rect', '▭ Rectángulo'], ['circle', '⬤ Círculo']].forEach(function (o) {
      var c = el('button', 'chip' + ((A.shape || 'rect') === o[0] ? ' active' : ''), o[1]);
      c.addEventListener('click', function () { A.shape = o[0]; Array.prototype.forEach.call(sg.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); repaint(); });
      sg.appendChild(c);
    });
    sr.appendChild(sg); toolPanel.appendChild(sr);
    toolPanel.appendChild(rowToggle('Borde blanco', A.border !== false, function (v) { A.border = v; repaint(); }));

    // ── CUÁNDO APARECE ──
    var hr = el('div', 'hintline', '———'); hr.style.opacity = '0.3'; toolPanel.appendChild(hr);
    toolPanel.appendChild(el('div', 'tp-title', '⏱ CUÁNDO APARECE'));
    var mr = el('div', 'row'); mr.appendChild(el('span', 'lab', 'Modo'));
    var mg = el('div'); mg.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1;justify-content:flex-end;';
    var modeWrap = el('div');   // contenedor de controles dependientes del modo
    [['always', 'Siempre'], ['intervals', 'A ratos'], ['segments', 'Tramos']].forEach(function (o) {
      var c = el('button', 'chip' + ((A.mode || 'always') === o[0] ? ' active' : ''), o[1]);
      c.addEventListener('click', function () { A.mode = o[0]; Array.prototype.forEach.call(mg.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); renderModeCtrls(); repaint(); });
      mg.appendChild(c);
    });
    mr.appendChild(mg); toolPanel.appendChild(mr); toolPanel.appendChild(modeWrap);
    function renderModeCtrls() {
      modeWrap.textContent = '';
      if (A.mode === 'intervals') {
        modeWrap.appendChild(el('div', 'hintline', 'Aparece y desaparece en bucle (intermitente).'));
        modeWrap.appendChild(rowRange('Visible', 1, 30, 1, A.onSecs || 8, function (v) { return v + 's'; }, function (v) { A.onSecs = v; repaint(); }));
        modeWrap.appendChild(rowRange('Oculto', 1, 30, 1, A.offSecs || 6, function (v) { return v + 's'; }, function (v) { A.offSecs = v; repaint(); }));
      } else if (A.mode === 'segments') {
        modeWrap.appendChild(el('div', 'hintline', 'Marcá los tramos donde querés que SALGA el avatar (el resto del video no se ve).'));
        var add = el('button', 'mini-btn', '➕ Aparece desde aquí (4s)');
        add.addEventListener('click', function () { var t0 = srcVideo.currentTime || P.trimStart; A.segs = A.segs || []; A.segs.push([t0, Math.min(P.trimEnd, t0 + 4)]); A.segs.sort(function (a, b) { return a[0] - b[0]; }); renderModeCtrls(); renderTimeline(); repaint(); });
        modeWrap.appendChild(add);
        var clr = el('button', 'mini-btn sec', 'Limpiar tramos'); clr.style.marginTop = '7px';
        clr.addEventListener('click', function () { A.segs = []; renderModeCtrls(); renderTimeline(); repaint(); });
        modeWrap.appendChild(clr);
        var list = el('div'); list.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:4px;';
        (A.segs || []).forEach(function (sg2, idx) {
          var rowi = el('div'); rowi.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;background:rgba(255,255,255,0.05);border-radius:6px;padding:5px 8px;';
          rowi.appendChild(el('span', null, '👤 ' + fmt(sg2[0]) + ' → ' + fmt(sg2[1])));
          var del = el('button', null, '✕'); del.style.cssText = 'background:none;border:none;color:#FF6B6B;cursor:pointer;font-weight:900;';
          del.addEventListener('click', function () { A.segs.splice(idx, 1); renderModeCtrls(); renderTimeline(); repaint(); });
          rowi.appendChild(del); list.appendChild(rowi);
        });
        modeWrap.appendChild(list);
        if (!(A.segs || []).length) modeWrap.appendChild(el('div', 'hintline', 'Sin tramos aún → poné el cursor donde quieras y tocá "Aparece desde aquí".'));
      } else {
        modeWrap.appendChild(el('div', 'hintline', 'El avatar se ve durante TODO el video, encima de las imágenes.'));
      }
    }
    renderModeCtrls();
  }
  function panelBrand() {
    toolPanel.appendChild(el('div', 'tp-title', '🏷️ MARCA / BRANDING'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Tu marca en pantalla = señal de canal original y consistente. Watermark + logo + barra de progreso (truco de retención: la gente se queda a ver la barra llenarse).'));
    var r1 = el('div', 'row'); r1.appendChild(el('span', 'lab', 'Watermark'));
    var inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = '@tucanal'; inp.value = P.brand.text || '';
    inp.addEventListener('input', function () { P.brand.text = inp.value; repaint(); }); r1.appendChild(inp); toolPanel.appendChild(r1);
    toolPanel.appendChild(el('div', 'hintline', 'Posición'));
    var pr = el('div', 'chip-row');
    [['tl', '↖ Arriba izq'], ['tr', '↗ Arriba der'], ['bl', '↙ Abajo izq'], ['br', '↘ Abajo der']].forEach(function (o) {
      var c = el('button', 'chip' + (((P.brand.pos || 'br') === o[0]) ? ' active' : ''), o[1]);
      c.addEventListener('click', function () { P.brand.pos = o[0]; Array.prototype.forEach.call(pr.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); repaint(); });
      pr.appendChild(c);
    });
    toolPanel.appendChild(pr);
    toolPanel.appendChild(rowRange('Tamaño', 60, 180, 5, Math.round((P.brand.size || 1) * 100), function (v) { return v + '%'; }, function (v) { P.brand.size = v / 100; repaint(); }));
    toolPanel.appendChild(rowRange('Opacidad', 20, 100, 5, Math.round((P.brand.opacity != null ? P.brand.opacity : 0.85) * 100), function (v) { return v + '%'; }, function (v) { P.brand.opacity = v / 100; repaint(); }));
    var pick = el('label', 'mini-btn sec'); pick.textContent = 'Subir logo (PNG)'; var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none'; pick.appendChild(fi); toolPanel.appendChild(pick);
    var ln = el('div', 'hintline', P.brand.logo ? 'Logo cargado ✓' : 'Sin logo.');
    fi.addEventListener('change', function () { var f = fi.files && fi.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function (ev) { var img = new Image(); img.onload = function () { P.brand.logo = img; ln.textContent = 'Logo cargado ✓'; repaint(); }; img.src = String(ev.target.result); }; rd.readAsDataURL(f); });
    toolPanel.appendChild(ln);
    if (P.brand.logo) { var rm = el('button', 'mini-btn sec', 'Quitar logo'); rm.style.marginTop = '6px'; rm.addEventListener('click', function () { P.brand.logo = null; ln.textContent = 'Sin logo.'; repaint(); setTool('brand'); }); toolPanel.appendChild(rm); }
    toolPanel.appendChild(rowToggle('Barra de progreso', P.progressBar, function (v) { P.progressBar = v; repaint(); }));
  }

  function panelFormat() {
    toolPanel.appendChild(el('div', 'tp-title', '📐 FORMATO / RELACIÓN'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Convertí el MISMO video a varios formatos para repurposear y multiplicar la monetización: 9:16 para Shorts (paga aparte), 1:1 para feed, 16:9 normal. El video se recorta sin deformarse.'));
    var row = el('div', 'chip-row');
    [['src', 'Original'], ['16:9', '16:9 · YouTube'], ['9:16', '9:16 · Shorts'], ['1:1', '1:1 · Cuadrado'], ['4:5', '4:5 · Feed']].forEach(function (o) {
      var c = el('button', 'chip' + (((P.aspect || 'src') === o[0]) ? ' active' : ''), o[1]);
      c.addEventListener('click', function () { P.aspect = o[0]; Array.prototype.forEach.call(row.children, function (x) { x.classList.remove('active'); }); c.classList.add('active'); computeStageSize(); repaint(); });
      row.appendChild(c);
    });
    toolPanel.appendChild(row);
    toolPanel.appendChild(el('div', 'hintline', 'Workflow pro: exportá una vez en 16:9 para el video largo, y otra en 9:16 recortando el mejor momento → un Short. 2 uploads, 2 fuentes de monetización del mismo material.'));
  }

  function panelAudio() {
    toolPanel.appendChild(el('div', 'tp-title', '🎵 AUDIO'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Música de fondo (sube la producción). Se mezcla con tu audio original al exportar.'));
    var pick = el('label', 'mini-btn'); pick.textContent = '🎵 Cargar música (MP3/WAV)'; var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'audio/*'; fi.style.display = 'none'; pick.appendChild(fi); toolPanel.appendChild(pick);
    var nm = el('div', 'hintline', P.music.name ? ('Música: ' + P.music.name) : 'Sin música cargada.'); toolPanel.appendChild(nm);
    toolPanel.appendChild(rowRange('Vol. música', 0, 100, 1, Math.round(P.music.vol * 100), function (v) { return v + '%'; }, function (v) { P.music.vol = v / 100; }));
    toolPanel.appendChild(rowRange('Vol. original', 0, 100, 1, Math.round(P.music.origVol * 100), function (v) { return v + '%'; }, function (v) { P.music.origVol = v / 100; }));
    fi.addEventListener('change', function () {
      var f = fi.files && fi.files[0]; if (!f) return; nm.textContent = 'Decodificando ' + f.name + '…';
      f.arrayBuffer().then(function (ab) { var actx = ensureAudio(); return actx.decodeAudioData(ab); }).then(function (buf) { P.music.buffer = buf; P.music.name = f.name; nm.textContent = 'Música: ' + f.name + ' (' + fmt(buf.duration) + ')'; }).catch(function () { nm.textContent = 'No pude leer ese audio. Probá MP3.'; });
    });

    // ── 🤖 GENERADOR DE MÚSICA CON IA (síntesis local, libre de copyright) ──
    var ghr = el('div', 'hintline', '———'); ghr.style.opacity = '0.3'; toolPanel.appendChild(ghr);
    toolPanel.appendChild(el('div', 'tp-title', '🤖 GENERAR MÚSICA CON IA'));
    toolPanel.appendChild(el('div', 'tp-desc', 'Escribí un prompt (mood/género) y genero una pista ORIGINAL libre de copyright. Sin copyright = sin strikes = monetización segura.'));
    var pgr = el('div', 'row'); pgr.appendChild(el('span', 'lab', 'Prompt'));
    var pin = document.createElement('input'); pin.type = 'text'; pin.placeholder = 'ej: épico cinematográfico tenso'; pgr.appendChild(pin); toolPanel.appendChild(pgr);
    var gchips = el('div', 'chip-row');
    [['épico cinematográfico', 'Épico'], ['lofi chill relax', 'Lofi'], ['oscuro misterio tenso', 'Oscuro'], ['upbeat energético', 'Upbeat'], ['ambiental espacial', 'Ambiental'], ['trap beat', 'Trap']].forEach(function (o) { var c = el('button', 'chip', o[1]); c.addEventListener('click', function () { pin.value = o[0]; }); gchips.appendChild(c); });
    toolPanel.appendChild(gchips);
    var gDur = 20;
    toolPanel.appendChild(rowRange('Duración', 10, 40, 1, gDur, function (v) { return v + 's'; }, function (v) { gDur = v; }));
    var genBtn = el('button', 'mini-btn', '✨ GENERAR MÚSICA'); toolPanel.appendChild(genBtn);
    var gStat = el('div', 'hintline', ''); toolPanel.appendChild(gStat);
    var prevBtn = el('button', 'mini-btn sec', '▶ Escuchar'); prevBtn.style.marginTop = '6px'; prevBtn.style.display = 'none'; toolPanel.appendChild(prevBtn);
    var lastBuf = null;
    genBtn.addEventListener('click', function () {
      var prompt = (pin.value || '').trim() || 'cinematográfico';
      genBtn.disabled = true; genBtn.textContent = '🎼 Generando…'; gStat.textContent = 'Sintetizando pista original…';
      generateMusic(prompt, gDur).then(function (res) {
        lastBuf = res.buffer; P.music.buffer = res.buffer; P.music.name = 'IA: ' + res.name;
        nm.textContent = 'Música: ' + P.music.name + ' · ' + fmt(res.buffer.duration);
        genBtn.disabled = false; genBtn.textContent = '✨ GENERAR DE NUEVO';
        gStat.textContent = 'Lista y puesta como música del video (' + res.bpm + ' BPM). Se mezcla al exportar.';
        prevBtn.style.display = 'block'; prevBtn.textContent = '▶ Escuchar';
      }).catch(function (e) { genBtn.disabled = false; genBtn.textContent = '✨ GENERAR MÚSICA'; gStat.textContent = '❌ ' + (e && e.message || e); });
    });
    prevBtn.addEventListener('click', function () {
      if (!lastBuf) return;
      if (prevBtn.textContent.indexOf('▶') >= 0) { playBuffer(lastBuf, function () { prevBtn.textContent = '▶ Escuchar'; }); prevBtn.textContent = '⏹ Detener'; }
      else { stopPreviewMusic(); prevBtn.textContent = '▶ Escuchar'; }
    });
  }

  // ── Preview de audio (buffer) ──
  var _prevCtx = null, _prevSrc = null;
  function playBuffer(buf, onEnd) {
    stopPreviewMusic();
    try {
      _prevCtx = new (window.AudioContext || window.webkitAudioContext)();
      _prevSrc = _prevCtx.createBufferSource(); _prevSrc.buffer = buf;
      var g = _prevCtx.createGain(); g.gain.value = 0.85; _prevSrc.connect(g); g.connect(_prevCtx.destination);
      _prevSrc.onended = function () { if (onEnd) onEnd(); };
      _prevSrc.start();
    } catch (e) {}
  }
  function stopPreviewMusic() { try { if (_prevSrc) _prevSrc.stop(); } catch (e) {} try { if (_prevCtx) _prevCtx.close(); } catch (e) {} _prevSrc = null; _prevCtx = null; }

  // ── 🤖 SÍNTESIS DE MÚSICA POR PROMPT (OfflineAudioContext, 100% local, original) ──
  function parseMusicPrompt(p) {
    p = (p || '').toLowerCase();
    var m = { scale: 'minor', bpm: 90, prog: [0, 5, 3, 4], drums: true, arp: true, name: 'Cinematográfico' };
    if (/epic|cinemat|trailer|orchest|emotional|inspir|épic|cinemato/.test(p)) { m.scale = 'minor'; m.bpm = 82; m.prog = [0, 5, 3, 4]; m.name = 'Épico'; }
    else if (/lofi|lo-fi|chill|relax|study|calm|sleep|tranqui/.test(p)) { m.scale = 'minor'; m.bpm = 74; m.prog = [0, 3, 4, 3]; m.name = 'Lofi/Chill'; }
    else if (/dark|horror|tension|scary|suspense|mystery|creepy|terror|misterio|oscur|tenso/.test(p)) { m.scale = 'minor'; m.bpm = 70; m.prog = [0, 6, 5, 0]; m.drums = false; m.name = 'Oscuro/Tenso'; }
    else if (/upbeat|happy|energetic|corporate|pop|motivat|workout|fiesta|alegre|energ/.test(p)) { m.scale = 'major'; m.bpm = 120; m.prog = [0, 4, 5, 3]; m.name = 'Upbeat'; }
    else if (/ambient|space|dream|ethereal|meditat|nature|ambiental|espac/.test(p)) { m.scale = 'major'; m.bpm = 60; m.prog = [0, 5, 3, 4]; m.drums = false; m.arp = false; m.name = 'Ambiental'; }
    else if (/trap|hip.?hop|beat|drill|rap/.test(p)) { m.scale = 'minor'; m.bpm = 140; m.prog = [0, 0, 5, 3]; m.name = 'Trap/Beat'; }
    var bm = p.match(/(\d{2,3})\s*bpm/); if (bm) { var b = +bm[1]; if (b >= 50 && b <= 200) m.bpm = b; }
    return m;
  }
  function generateMusic(prompt, dur) {
    return new Promise(function (resolve, reject) {
      try {
        var m = parseMusicPrompt(prompt), sr = 44100;
        var SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
        var scale = SCALES[m.scale], rootMidi = 57; // A3
        var spb = 60 / m.bpm, bpbar = 4, barDur = spb * bpbar;
        var bars = Math.max(4, Math.ceil((dur || 20) / barDur)), total = bars * barDur;
        var octx = new OfflineAudioContext(2, Math.ceil(sr * total), sr);
        var master = octx.createGain(); master.gain.value = 0.85;
        var comp = octx.createDynamicsCompressor(); master.connect(comp); comp.connect(octx.destination);
        function mf(n) { return 440 * Math.pow(2, (n - 69) / 12); }
        function degMidi(deg, oct) { var i = ((deg % 7) + 7) % 7, w = Math.floor(deg / 7); return rootMidi + scale[i] + 12 * (w + oct); }
        function triad(deg, oct) { return [degMidi(deg, oct), degMidi(deg + 2, oct), degMidi(deg + 4, oct)]; }
        function tone(type, freq, t0, len, vol, atk, rel, dest, det) {
          var o = octx.createOscillator(); o.type = type; o.frequency.value = freq; if (det) o.detune.value = det;
          var g = octx.createGain(); var a = atk || 0.01, r = rel || 0.1;
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + a); g.gain.setValueAtTime(vol, t0 + Math.max(a, len - r)); g.gain.linearRampToValueAtTime(0, t0 + len);
          o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + len + 0.02);
        }
        function hat(t0, len, vol) {
          var n = octx.createBufferSource(), b = octx.createBuffer(1, Math.ceil(sr * len), sr), d = b.getChannelData(0);
          for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b;
          var f = octx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
          var g = octx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
          n.connect(f); f.connect(g); g.connect(master); n.start(t0); n.stop(t0 + len);
        }
        function kick(t0) { var o = octx.createOscillator(), g = octx.createGain(); o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12); g.gain.setValueAtTime(0.9, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.2); }
        var padG = octx.createGain(); padG.gain.value = 0.16; padG.connect(master);
        var bassG = octx.createGain(); bassG.gain.value = 0.3; bassG.connect(master);
        var arpG = octx.createGain(); arpG.gain.value = 0.12; arpG.connect(master);
        var leadG = octx.createGain(); leadG.gain.value = 0.2; leadG.connect(master);
        // Reverb/eco (delay con feedback + lowpass) — le da espacio/profundidad pro
        var delay = octx.createDelay(1.0); delay.delayTime.value = Math.min(0.9, spb * 0.75);
        var fb = octx.createGain(); fb.gain.value = 0.32; var wet = octx.createGain(); wet.gain.value = 0.28;
        var lpf = octx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 3200;
        delay.connect(fb); fb.connect(delay); delay.connect(lpf); lpf.connect(wet); wet.connect(master);
        arpG.connect(delay); leadG.connect(delay);
        var leadScale = (m.scale === 'major') ? [0, 2, 4, 7, 9] : [0, 2, 3, 5, 7];
        for (var bar = 0; bar < bars; bar++) {
          var t = bar * barDur, deg = m.prog[bar % m.prog.length], ch = triad(deg, 0);
          // PAD (base armónica) — siempre
          ch.forEach(function (mid) { var f = mf(mid); tone('sawtooth', f, t, barDur, 0.5, 0.45, 0.5, padG, -7); tone('sawtooth', f, t, barDur, 0.5, 0.45, 0.5, padG, 7); });
          // BASS — siempre
          var bf = mf(degMidi(deg, -1));
          for (var be = 0; be < bpbar; be++) tone('triangle', bf, t + be * spb, spb * 0.9, 0.6, 0.01, 0.08, bassG);
          // ARP — entra en el bar 1 (intro que construye)
          if (m.arp && bar >= 1) for (var e = 0; e < bpbar * 2; e++) { var nf = mf(ch[e % ch.length] + 12); tone('square', nf, t + e * (spb / 2), spb * 0.42, 0.4, 0.005, 0.06, arpG); }
          // DRUMS — entran en el bar 1, full a partir del 2
          if (m.drums && bar >= 1) { for (var k = 0; k < bpbar; k++) kick(t + k * spb); for (var h = 0; h < bpbar * 2; h++) hat(t + h * (spb / 2), 0.04, bar >= 2 ? 0.13 : 0.08); }
          // LEAD melódica — entra en el bar 2 (frase de 4 notas en pentatónica)
          if (bar >= 2) for (var ln = 0; ln < 4; ln++) { var step = leadScale[(bar * 3 + ln * 2) % leadScale.length]; tone('triangle', mf(rootMidi + step + 12), t + ln * spb, spb * (ln % 2 ? 0.5 : 0.9), 0.5, 0.01, 0.12, leadG); }
        }
        octx.startRendering().then(function (buf) { resolve({ buffer: buf, name: m.name, bpm: m.bpm }); }).catch(reject);
      } catch (e) { reject(e); }
    });
  }

  // ════════════════════ AUDIO GRAPH + EXPORT ════════════════════
  var _actx = null, _srcNode = null, _dest = null, _origGain = null, _monGain = null;
  function ensureAudio() {
    if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
    if (!_srcNode) {
      _srcNode = _actx.createMediaElementSource(srcVideo);
      _dest = _actx.createMediaStreamDestination();
      _origGain = _actx.createGain(); _origGain.gain.value = 1;
      _srcNode.connect(_origGain); _origGain.connect(_dest);
      // Monitor → altavoces. Una vez que createMediaElementSource captura el <video>,
      // su audio SOLO suena por este nodo. Por eso queda en 1 (no 0): si no, la
      // preview se queda MUDA después del primer export. Se baja a 0 solo al renderizar.
      _monGain = _actx.createGain(); _monGain.gain.value = 1; _srcNode.connect(_monGain); _monGain.connect(_actx.destination);
    }
    return _actx;
  }

  // ── ffmpeg.wasm: export MP4 real (calidad pro) con fallback a WebM ──────────
  var _ffmpeg = null;
  function loadFFmpeg() {
    return new Promise(function (resolve, reject) {
      if (_ffmpeg) { resolve(_ffmpeg); return; }
      if (typeof FFmpegWASM === 'undefined' || !FFmpegWASM.FFmpeg) { reject(new Error('ffmpeg_no_disponible')); return; }
      var base = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('monetize-studio/vendor/') : 'vendor/';
      try {
        var inst = new FFmpegWASM.FFmpeg();
        var to = setTimeout(function () { reject(new Error('ffmpeg_timeout')); }, 60000);
        inst.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm', classWorkerURL: base + '814.ffmpeg.js' })
          .then(function () { clearTimeout(to); _ffmpeg = inst; resolve(inst); })
          .catch(function (e) { clearTimeout(to); reject(e); });
      } catch (e) { reject(e); }
    });
  }
  function transcodeToMp4(webmBlob, onProg) {
    return loadFFmpeg().then(function (ff) {
      if (ff.on) { try { ff.on('progress', function (ev) { if (onProg && ev && typeof ev.progress === 'number') onProg(ev.progress); }); } catch (e) {} }
      var getData = (typeof FFmpegUtil !== 'undefined' && FFmpegUtil.fetchFile) ? FFmpegUtil.fetchFile(webmBlob) : webmBlob.arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
      return Promise.resolve(getData)
        .then(function (data) { return ff.writeFile('in.webm', data); })
        .then(function () { return ff.exec(['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'out.mp4']); })
        .then(function () { return ff.readFile('out.mp4'); })
        .then(function (out) { try { ff.deleteFile('in.webm'); ff.deleteFile('out.mp4'); } catch (e) {} var buf = (out && out.buffer) ? out.buffer : out; return new Blob([buf], { type: 'video/mp4' }); });
    });
  }
  function dlBlob(blob, ext) {
    if (!blob || blob.size < 1024) {   // archivo vacío/roto → avisar en vez de "descargar" basura
      try { $('footNote').textContent = '⚠ El archivo salió vacío (' + (blob ? blob.size : 0) + ' bytes). Reintentá el export.'; } catch (e) {}
      console.warn('[dl] blob vacío/diminuto:', blob && blob.size); return;
    }
    var fname = 'monetized-' + (ST.name || 'video').replace(/\.[^.]+$/, '') + '.' + ext;
    var url = URL.createObjectURL(blob);
    console.log('[dl] descargando', fname, fmtB(blob.size));
    // 1) chrome.downloads — la vía fiable en una extensión: NO requiere gesto del usuario (el export es async)
    //    y mantiene vivo el blob hasta terminar (no se corta como con el <a> + revoke temprano).
    try {
      if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download({ url: url, filename: fname, saveAs: false }, function (id) {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('[dl] chrome.downloads falló → ancla:', chrome.runtime.lastError.message);
            anchorDownload(url, fname); return;
          }
          if (chrome.downloads.onChanged) {   // revocar el blob recién cuando la descarga COMPLETA
            var onCh = function (d) { if (d && d.id === id && d.state && d.state.current === 'complete') { try { URL.revokeObjectURL(url); } catch (e) {} try { chrome.downloads.onChanged.removeListener(onCh); } catch (e) {} } };
            chrome.downloads.onChanged.addListener(onCh);
          }
          setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 180000);   // red de seguridad 3 min
        });
        return;
      }
    } catch (e) { console.warn('[dl] excepción chrome.downloads → ancla:', e); }
    anchorDownload(url, fname);   // 2) fallback: ancla clásica (revoke a 60s, no 1.5s, para no cortar archivos grandes)
  }
  function anchorDownload(url, fname) {
    var a = document.createElement('a'); a.href = url; a.download = fname; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
  }
  function endExport(fmt, size, note) {
    rpFill.style.width = '100%';
    rpText.textContent = 'Listo — ' + fmt.toUpperCase() + ' descargado (' + fmtB(size) + ')' + (note ? ' · ' + note : '');
    try { _policyCorpusOnExportSuccess(); } catch (ePc3) {}   // POLICY 2B: corpus hook — sitio REALTIME (exclusión mutua vía flag)
    ST.rendering = false; btnExport.disabled = false; btnExport.textContent = 'Exportar MP4';
    if (_monGain) _monGain.gain.value = 1;   // restaurar audio de preview
    try { srcVideo.playbackRate = P.speed || 1; } catch (e) {}
    try { restoreStageSize(); } catch (e) {}
    $('footNote').textContent = 'Exportado ✓ ' + fmt.toUpperCase();
  }
  function finishExport(webmBlob) {
    if (typeof FFmpegWASM === 'undefined') { dlBlob(webmBlob, 'webm'); endExport('webm', webmBlob.size); return; }
    rpText.textContent = 'Convirtiendo a MP4 (calidad pro)… puede tardar 1-3 min';
    transcodeToMp4(webmBlob, function (p) { rpText.textContent = 'Convirtiendo a MP4… ' + Math.round(p * 100) + '%'; })
      .then(function (mp4) { dlBlob(mp4, 'mp4'); endExport('mp4', mp4.size); })
      .catch(function (err) { console.warn('[MonetizeStudio] ffmpeg falló, export WebM:', err); dlBlob(webmBlob, 'webm'); endExport('webm', webmBlob.size, 'MP4 no disponible, usé WebM'); });
  }

  // Restaura el estado de la UI si el export aborta — antes esto NO existía y el
  // botón quedaba "⏺ Renderizando…" disabled PARA SIEMPRE (con ST.rendering=true,
  // que además bloqueaba play/seek/otro export).
  function failExport(msg) {
    ST.rendering = false; btnExport.disabled = false; btnExport.textContent = 'Exportar MP4';
    if (_monGain) _monGain.gain.value = 1;
    try { srcVideo.pause(); } catch (e) {}
    try { srcVideo.playbackRate = P.speed || 1; } catch (e) {}
    try { restoreStageSize(); } catch (e) {}
    rpFill.style.width = '0%';
    rpText.textContent = msg || 'Export cancelado.';
    $('footNote').textContent = 'Export falló';
    console.warn('[MonetizeStudio] export abortado:', msg || '');
  }
  // ════════════════ AJUSTES DE EXPORTACIÓN (estilo CapCut) ════════════════
  var exportCfg = (function () {
    var d = { res: 1080, rate: 'rec', codec: 'h264', fmt: 'mp4', fps: 30 };
    try { var s = JSON.parse(localStorage.getItem('nsp_ms_exportcfg') || '{}'); return { res: +s.res || d.res, rate: s.rate || d.rate, codec: s.codec || d.codec, fmt: s.fmt || d.fmt, fps: +s.fps || d.fps }; } catch (e) { return d; }
  })();
  function saveExportCfg() { try { localStorage.setItem('nsp_ms_exportcfg', JSON.stringify(exportCfg)); } catch (e) {} }
  // Calcula la resolución de salida desde el aspecto del proyecto + la "p" elegida (el lado corto = la p).
  function exportDims() {
    var a = (P && P.aspect) || 'src';
    var dims = ASPECTS[a] || [ST.vw || 1280, ST.vh || 720];
    var w = dims[0] || 1280, h = dims[1] || 720, S = exportCfg.res || 1080, ow, oh;
    if (w <= h) { ow = S; oh = Math.round(S * h / w); } else { oh = S; ow = Math.round(S * w / h); }
    return [Math.max(2, Math.round(ow / 2) * 2), Math.max(2, Math.round(oh / 2) * 2)];
  }
  function exportRateFactor() { return exportCfg.rate === 'low' ? 0.10 : exportCfg.rate === 'high' ? 0.30 : 0.18; }
  function exportBitrate(W, H) { return Math.max(4000000, Math.min(40000000, Math.round(W * H * (exportCfg.fps || 30) * exportRateFactor()))); }
  function restoreStageSize() { try { computeStageSize(); drawAt(srcVideo.currentTime || P.trimStart); } catch (e) {} }

  function openExportSettings() {
    if (ST.rendering || !ST.ready) return;
    var prev = document.getElementById('exportCfgModal'); if (prev) try { prev.remove(); } catch (e) {}
    var ov = el('div', 'modal'); ov.id = 'exportCfgModal';
    var box = el('div', 'modal-box');
    var hdr = el('div', 'modal-hdr'); hdr.appendChild(el('span', '', 'EXPORTAR VIDEO'));
    var xb = el('button', 'modal-close', '✕'); xb.addEventListener('click', function () { try { ov.remove(); } catch (e) {} }); hdr.appendChild(xb); box.appendChild(hdr);
    var body = el('div', 'modal-body');
    function row(label, opts, cur, on) {
      var r = el('div'); r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;';
      var lb = el('span', '', label); lb.style.cssText = 'font-weight:700;min-width:150px;font-size:13.5px;'; r.appendChild(lb);
      var s = document.createElement('select'); s.style.cssText = 'flex:1;background:#10151c;color:#e7ecf2;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:9px 10px;font-size:14px;cursor:pointer;';
      opts.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (String(cur) === String(o[0])) op.selected = true; s.appendChild(op); });
      s.addEventListener('change', function () { on(s.value); });
      r.appendChild(s); body.appendChild(r); return s;
    }
    row('Resolución', [['720', '720P (HD)'], ['1080', '1080P (Full HD)'], ['1440', '1440P (2K)'], ['2160', '2160P (4K)']], exportCfg.res, function (v) { exportCfg.res = +v; saveExportCfg(); upd(); });
    row('Tasa de bits', [['low', 'Baja · liviano'], ['rec', 'Recomendada'], ['high', 'Alta · máxima calidad']], exportCfg.rate, function (v) { exportCfg.rate = v; saveExportCfg(); upd(); });
    row('Codec', [['h264', 'H.264 (compatible)'], ['h265', 'H.265 / HEVC (más liviano)']], exportCfg.codec, function (v) { exportCfg.codec = v; saveExportCfg(); });
    row('Formato', [['mp4', 'MP4'], ['mov', 'MOV']], exportCfg.fmt, function (v) { exportCfg.fmt = v; saveExportCfg(); });
    row('Cuadros por segundo', [['24', '24 fps (cine)'], ['30', '30 fps'], ['60', '60 fps (fluido)']], exportCfg.fps, function (v) { exportCfg.fps = +v; saveExportCfg(); upd(); });
    var est = el('div', '', ''); est.style.cssText = 'margin:2px 0 16px;opacity:.82;font-size:12.5px;line-height:1.4;'; body.appendChild(est);
    function upd() {
      var d = exportDims(), br = exportBitrate(d[0], d[1]);
      var dur = Math.max(1, (P.trimEnd - P.trimStart) / (P.speed || 1));
      var mb = Math.round(br * dur / 8 / 1e6);
      est.textContent = '📐 Salida: ' + d[0] + '×' + d[1] + ' · ' + (exportCfg.fps || 30) + 'fps · ~' + (br / 1e6).toFixed(1) + ' Mbps · ≈ ' + mb + ' MB';
    }
    upd();
    var btns = el('div'); btns.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    var cancel = el('button', 'btn-ghost sm', 'Cancelar'); cancel.addEventListener('click', function () { try { ov.remove(); } catch (e) {} });
    var go = el('button', 'btn-primary', 'Exportar'); go.addEventListener('click', function () { try { ov.remove(); } catch (e) {} _exDiskStream = null; runExportNow(); });
    btns.appendChild(cancel); btns.appendChild(go); body.appendChild(btns);
    box.appendChild(body); ov.appendChild(box); document.body.appendChild(ov);
  }
  // ════════════════ POLICY CHECK — compuerta pre-export (Fase 2) ════════════════
  // PRIMERA compuerta, apilada ANTES del gate legacy. El motor (nsp-policy.js) es puro;
  // esta UI es solo consumidora. CERO innerHTML (incidentes Trusted Types en el historial).
  //   red (§86/childSafety) → export BLOQUEADO, guía fija "elimina o reescribe", SIN override.
  //   yellow → override permitido (el log a nsp_policy_overrides llega en STEP 2B).
  //   green → continúa. Después SIEMPRE corre el gate legacy 72/50, INTACTO.
  // FAIL-OPEN (decisión del dueño): si el motor falla, se puede exportar IGUAL pero con
  // advertencia visible en el gate legacy (+ registro de auditoría en 2B).
  var _policyCtx = { channelKey: '', lang: 'en', title: '', description: '' };
  try {
    var _pcSaved = JSON.parse(localStorage.getItem('nsp_ms_policy_channel') || 'null');
    if (_pcSaved && typeof _pcSaved === 'object') { _policyCtx.channelKey = _pcSaved.channelKey || ''; _policyCtx.lang = _pcSaved.lang || 'en'; }
  } catch (ePc) {}
  function _policyDefaultTitle() { return (ST.name || 'video').replace(/\.[^.]+$/, ''); }
  function _policyPersistChannel() {
    try { localStorage.setItem('nsp_ms_policy_channel', JSON.stringify({ channelKey: _policyCtx.channelKey, lang: _policyCtx.lang })); } catch (eP) {}
  }
  function _legacyExportGate() {
    // ← GATE LEGACY, movido VERBATIM desde runExportNow — computeMonetScore y 72/50 intactos
    var r = computeMonetScore();
    if (r.score >= 72) { startExportFast(); return; }
    confirmExportGate(r).then(function (go) { if (go) startExportFast(); });
  }
  function _legacyExportGateWithWarn(warnLabel) {
    // fail-open: mismo gate legacy pero SIEMPRE muestra el modal, con la advertencia visible
    var r = computeMonetScore();
    r.factors = r.factors.concat([[false, warnLabel]]);
    confirmExportGate(r).then(function (go) { if (go) startExportFast(); });
  }
  function _policyEngineError(detail) {
    console.warn('[POLICY] motor no disponible → fail-open:', detail);
    // AUDITORÍA del fail-open: queda registro de que salió un export sin auditar (2B)
    try { _policyLogOverride({ ts: Date.now(), risk: 'engine_error', reason: String(detail).slice(0, 200), videoName: ST.name || '' }); } catch (eLO) {}
    _legacyExportGateWithWarn('⚠ Policy engine no disponible (export sin auditar)');
  }
  function _policyPreExportGate() {
    if (typeof NSPPolicy === 'undefined' || !NSPPolicy || !NSPPolicy.evaluatePackage) { _policyEngineError('NSPPolicy no cargado'); return; }
    if (!_policyCtx.title) _policyCtx.title = _policyDefaultTitle();
    var pkg = {
      channelKey: _policyCtx.channelKey || undefined,
      lang: _policyCtx.lang || undefined,
      script: (scriptInput.value || '').trim(),
      title: _policyCtx.title,
      description: _policyCtx.description || ''
    };
    NSPPolicy.evaluatePackage(pkg)
      .then(function (ev) {
        _policyCtx.lastEval = ev; _policyCtx.lastPkg = pkg;
        try { _policyAfterEval(pkg, ev); } catch (eAE) { console.warn('[POLICY] afterEval:', eAE && eAE.message); }   // last_eval + calib_log (2B)
        showPolicyPanel(ev, pkg);
      })
      .catch(function (e) { _policyEngineError(String(e && e.message || e)); });
  }
  var POLICY_RISK_META = {
    red: { label: '● BLOQUEADO', color: '#fff' },
    yellow: { label: '● REVISAR', color: '#fff' },
    green: { label: '● OK', color: '#fff' }
  };
  function _policyExcerpt(srcText, index, termLen) {
    // extracto ~40 chars de contexto por lado, término resaltado — DOM puro (sin innerHTML)
    var s = String(srcText || ''), a = Math.max(0, index - 40), b = Math.min(s.length, index + termLen + 40);
    var wrap = el('div', 'pol-excerpt');
    if (a > 0) wrap.appendChild(el('span', '', '…'));
    wrap.appendChild(el('span', '', s.slice(a, index)));
    var hl = el('span', 'pol-mark', s.slice(index, Math.min(s.length, index + termLen)));
    wrap.appendChild(hl);
    wrap.appendChild(el('span', '', s.slice(Math.min(s.length, index + termLen), b)));
    if (b < s.length) wrap.appendChild(el('span', '', '…'));
    return wrap;
  }
  function showPolicyPanel(ev, pkg) {
    var prev = document.getElementById('policyGateModal'); if (prev) try { prev.remove(); } catch (e) {}
    var meta = POLICY_RISK_META[ev.risk] || POLICY_RISK_META.green;
    var ov = el('div', 'modal'); ov.id = 'policyGateModal';
    var box = el('div', 'modal-box');
    var hdr = el('div', 'modal-hdr'); hdr.appendChild(el('span', '', 'POLICY CHECK — pre-export'));
    var light = el('span', 'pol-light', meta.label); light.style.color = meta.color;
    hdr.appendChild(light); box.appendChild(hdr);
    var body = el('div', 'modal-body');

    // ── Paquete: canal + idioma + título + descripción + re-evaluar
    var cfg = el('div', 'pol-cfg');
    var rowCh = el('div', 'pol-cfg-row');
    rowCh.appendChild(el('span', 'lab', 'Canal'));
    var selCh = document.createElement('select'); selCh.style.cssText = 'flex:1;min-width:170px;';
    var optG = document.createElement('option'); optG.value = ''; optG.textContent = '— solo reglas globales —'; selCh.appendChild(optG);
    rowCh.appendChild(selCh);
    rowCh.appendChild(el('span', 'lab', 'Idioma'));
    var selLang = document.createElement('select');
    ['en', 'es', 'de', 'pl'].forEach(function (L) { var o = document.createElement('option'); o.value = L; o.textContent = L.toUpperCase(); selLang.appendChild(o); });
    selLang.value = _policyCtx.lang || 'en';
    rowCh.appendChild(selLang);
    cfg.appendChild(rowCh);
    NSPPolicy.loadPolicies().then(function (pol) {
      Object.keys((pol && pol.channels) || {}).forEach(function (k) {
        var c = pol.channels[k]; var o = document.createElement('option'); o.value = k;
        o.textContent = k + ' (' + (c.lang || '?') + ' · ' + (c.niche || '—') + ')';
        selCh.appendChild(o);
      });
      selCh.value = _policyCtx.channelKey || '';
      selCh.addEventListener('change', function () {
        var c = (pol.channels || {})[selCh.value];
        if (c && c.lang) selLang.value = c.lang;   // el idioma sigue al canal elegido
      });
    }).catch(function (eLP) { console.warn('[POLICY] loadPolicies en panel:', eLP && eLP.message); });
    var inTitle = document.createElement('input'); inTitle.type = 'text'; inTitle.placeholder = 'Título del video (se escanea con las reglas)';
    inTitle.value = pkg.title || '';
    var inDesc = document.createElement('textarea'); inDesc.rows = 2; inDesc.placeholder = 'Descripción (opcional, también se escanea)';
    inDesc.value = pkg.description || ''; inDesc.style.cssText = 'resize:vertical;';
    cfg.appendChild(inTitle); cfg.appendChild(inDesc);
    var reBtn = el('button', 'btn-ghost sm', '↻ Re-evaluar con estos datos');
    reBtn.addEventListener('click', function () {
      _policyCtx.channelKey = selCh.value || '';
      _policyCtx.lang = selLang.value || 'en';
      _policyCtx.title = (inTitle.value || '').trim();
      _policyCtx.description = (inDesc.value || '').trim();
      _policyPersistChannel();
      try { ov.remove(); } catch (e) {}
      _policyPreExportGate();
    });
    cfg.appendChild(reBtn);
    body.appendChild(cfg);

    // ── Razones del veredicto (textuales del motor)
    var rl = el('div', 'pol-reasons');
    (ev.reasons || []).forEach(function (rz) {
      var li = el('div', 'pol-reason', rz);
      li.style.color = ev.risk === 'red' ? '#FF6B6B' : (ev.risk === 'yellow' ? '#FFD93D' : 'rgba(231,236,242,.85)');
      rl.appendChild(li);
    });
    body.appendChild(rl);

    // ── Términos detectados, con extracto del texto ORIGINAL del campo
    var hits = (ev.detail && ev.detail.matchedTerms) || [];
    if (hits.length) {
      var ht = el('div', 'pol-hits');
      hits.forEach(function (h) {
        var row = el('div', 'pol-hit');
        var tag = el('div', 'pol-hit-tag', '[' + h.field + '] «' + h.term + '» · regla ' + h.rule.id + ' (' + h.rule.severity + ')');
        row.appendChild(tag);
        var src = h.field === 'script' ? pkg.script : (h.field === 'title' ? pkg.title : pkg.description);
        // endIndex EXACTO del motor (2C); fallback term.length por si llega un hit antiguo
        var tlen = (h.endIndex != null) ? (h.endIndex - h.index) : h.term.length;
        row.appendChild(_policyExcerpt(src, h.index, tlen));
        ht.appendChild(row);
      });
      body.appendChild(ht);
    }

    // ── Similitud con guiones previos del canal
    var simBox = el('div', 'pol-sim');
    var simScore = (ev.similarity && ev.similarity.score) || 0;
    var thr = (typeof NSPPolicy !== 'undefined' && NSPPolicy.ENGINE) ? NSPPolicy.ENGINE.SIMILARITY_YELLOW : 55;
    var simHead = el('div', 'pol-sim-head', '📐 Similitud con tus guiones previos: ' + simScore + '% (umbral ' + thr + '%)');
    simHead.style.color = simScore >= thr ? '#FFD93D' : 'rgba(231,236,242,.8)';
    simBox.appendChild(simHead);
    var near = (ev.similarity && ev.similarity.nearest) || [];
    if (near.length) {
      near.forEach(function (n) {
        var when = n.ts ? new Date(n.ts).toLocaleDateString() : '';
        simBox.appendChild(el('div', '', '· «' + n.title + '» — ' + Math.round((n.sim || 0) * 100) + '%' + (when ? ' — ' + when : '')));
      });
    } else {
      simBox.appendChild(el('div', '', 'corpus vacío para este canal — primera evaluación'));
    }
    body.appendChild(simBox);

    // ── Recordatorio de disclosure (SIEMPRE visible)
    var disc = el('div', 'pol-disc', '📢 Recordatorio: marcá la casilla "contenido alterado o sintético" al subir este video a YouTube.');
    body.appendChild(disc);

    // ── Guía fija cuando hay hardBlock (sin ruta de export)
    if (ev.risk === 'red') {
      body.appendChild(el('div', 'pol-guide', '⛔ EXPORT BLOQUEADO: ELIMINA O REESCRIBE el contenido marcado. No existe workaround válido para un hardBlock (líneas legales: §86 / childSafety).'));
    }
    box.appendChild(body);

    // ── Footer según riesgo
    var ftr = el('div', 'pol-ftr');
    function close() { try { ov.remove(); } catch (e) {} }
    if (ev.risk === 'red') {
      var fixR = el('button', 'btn-primary', '← Volver a arreglar'); fixR.style.width = 'auto';
      fixR.addEventListener('click', close);
      ftr.appendChild(fixR);   // ÚNICO botón: en red NO existe ruta de export ni override
    } else if (ev.risk === 'yellow') {
      var note = document.createElement('input'); note.type = 'text'; note.placeholder = 'motivo del override (opcional)';
      note.className = 'pol-note';
      var fixY = el('button', 'btn-primary', '← Volver a arreglar'); fixY.style.width = 'auto';
      var goY = el('button', 'btn-ghost sm', 'Anular y continuar →');
      fixY.addEventListener('click', close);
      goY.addEventListener('click', function () {
        // AUDITORÍA: el override amarillo SIEMPRE deja registro (2B)
        try {
          _policyLogOverride({
            ts: Date.now(), channelKey: _policyCtx.channelKey || '', risk: 'yellow',
            reasons: ev.reasons || [], similarityScore: (ev.similarity && ev.similarity.score) || 0,
            note: (note.value || '').trim() || undefined,
            videoName: ST.name || '', exportCfg: { res: exportCfg.res, fps: exportCfg.fps, fmt: exportCfg.fmt }
          });
        } catch (eLO) {}
        _policyCtx.corpusPending = true;   // arma el hook de corpus para ESTE export
        close();
        _legacyExportGate();
      });
      ftr.appendChild(note); ftr.appendChild(fixY); ftr.appendChild(goY);
    } else {
      var goG = el('button', 'btn-primary', 'Continuar →'); goG.style.width = 'auto';
      goG.addEventListener('click', function () { _policyCtx.corpusPending = true; close(); _legacyExportGate(); });   // green también arma el hook de corpus
      ftr.appendChild(goG);
    }
    box.appendChild(ftr);
    ov.appendChild(box);
    (document.getElementById('app') || document.body).appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });   // click fuera = volver (nunca exporta)
  }
  // ════════ POLICY — capa de storage (STEP 2B) · funciones SIN DOM (extraíbles p/ dry-run) ════════
  // nsp_policy_overrides → array cap 200 FIFO. Escriben SOLO: override amarillo confirmado y
  //   engine_error (fail-open auditado). El ROJO jamás escribe — no existe ruta.
  // nsp_policy_last_eval → { <channelKey|'_global'>: {risk, score, similarity, ts} } — sobrescrito
  //   en CADA evaluación completada (re-evals incluidas).
  // nsp_policy_calib_log → array cap 10 FIFO {ts, channelKey, rawScore, corpusSize, risk} en cada
  //   evaluación + console.log — ventana de calibración real del umbral 55.
  // [2B-STORE-BEGIN]
  function _policyStoreGet(key) { return new Promise(function (res) { try { chrome.storage.local.get(key, function (r) { res((r && r[key]) || null); }); } catch (e) { res(null); } }); }
  function _policyStoreSet(key, val) { return new Promise(function (res) { try { var o = {}; o[key] = val; chrome.storage.local.set(o, function () { res(true); }); } catch (e) { res(false); } }); }
  function _policyLogOverride(entry) {
    return _policyStoreGet('nsp_policy_overrides').then(function (list) {
      list = Array.isArray(list) ? list : [];
      list.push(entry);
      while (list.length > 200) list.shift();          // cap 200 FIFO
      return _policyStoreSet('nsp_policy_overrides', list).then(function () { return list.length; });
    });
  }
  function _policyAfterEval(pkg, ev) {
    var key = pkg.channelKey || '_global';
    var p1 = _policyStoreGet('nsp_policy_last_eval').then(function (map) {
      map = (map && typeof map === 'object') ? map : {};
      map[key] = { risk: ev.risk, score: (ev.similarity && ev.similarity.score) || 0, similarity: ev.similarity, ts: Date.now() };
      return _policyStoreSet('nsp_policy_last_eval', map);
    });
    var p2 = NSPPolicy.getCorpus(pkg.channelKey || '').then(function (c) { return c.length; }).catch(function () { return 0; })
      .then(function (corpusSize) {
        var row = { ts: Date.now(), channelKey: pkg.channelKey || '', rawScore: (ev.similarity && ev.similarity.score) || 0, corpusSize: corpusSize, risk: ev.risk };
        console.log('[POLICY calib] canal=' + (row.channelKey || '(global)') + ' raw=' + row.rawScore + '% corpus=' + corpusSize + ' risk=' + ev.risk);
        return _policyStoreGet('nsp_policy_calib_log').then(function (list) {
          list = Array.isArray(list) ? list : [];
          list.push(row);
          while (list.length > 10) list.shift();       // cap 10 FIFO (ventana de calibración)
          return _policyStoreSet('nsp_policy_calib_log', list);
        });
      });
    return Promise.all([p1, p2]);
  }
  function _policyCorpusOnExportSuccess(ctx, st) {
    // ctx/st inyectables para el dry-run; en producción se invoca sin args → (_policyCtx, ST).
    ctx = ctx || _policyCtx; st = st || ST;
    // EXCLUSIÓN MUTUA por export: el flag se consume ANTES de cualquier async → de los DOS
    // sitios de éxito (finalizeMux turbo · endExport realtime) solo el primero escribe.
    // Exports fail-open (sin evaluación) NUNCA arman el flag → no escriben nada.
    if (!ctx.corpusPending) return Promise.resolve({ skipped: 'no_pending' });
    ctx.corpusPending = false;
    if (!ctx.channelKey) return Promise.resolve({ skipped: 'sin_canal' });
    var script = (ctx.lastPkg && ctx.lastPkg.script || '').trim();
    if (!script) return Promise.resolve({ skipped: 'guion_vacio' });
    return NSPPolicy.addScriptToCorpus({ channelKey: ctx.channelKey, title: ctx.title || st.name || 'video', scriptText: script, ts: Date.now() })
      .then(function (r) {
        console.log('[POLICY corpus] ' + (r.deduped ? 're-export detectado → ts actualizado, SIN duplicar (count=' + r.count + ')' : 'guion añadido al corpus del canal (count=' + r.count + ')'));
        return r;
      })
      .catch(function (e) { console.warn('[POLICY corpus] no se pudo guardar:', e && e.message); return { error: true }; });
  }
  // [2B-STORE-END]
  function runExportNow() {
    if (ST.rendering || !ST.ready) return;
    _policyPreExportGate();   // 1ª compuerta: Policy Engine (Fase 2). El gate legacy 72/50 corre después, INTACTO (_legacyExportGate).
  }

  // ════════════════ EXPORT TURBO (WebCodecs) ════════════════
  // En vez de grabar reproduciendo en tiempo real (40min=40min), procesa los frames lo más
  // rápido que el encoder de hardware permita y muxea a MP4. Un video largo baja de horas a minutos.
  // El audio se extrae del original con OfflineAudioContext (instantáneo) y se codifica con AudioEncoder.
  function turboSupported() {
    return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' &&
           typeof Mp4Muxer !== 'undefined' && Mp4Muxer.Muxer && Mp4Muxer.ArrayBufferTarget;
  }
  var _exportStartMs = 0;
  function startExportFast() {
    if (ST.rendering || !ST.ready) return;
    if (!turboSupported()) { return startExportRealtime(); }   // navegador viejo → método clásico (tiempo real)
    // Resolver codec: HEVC sólo si el navegador lo soporta; si no, H.264 (la mayoría de los casos).
    if (exportCfg.codec === 'h265' && typeof VideoEncoder !== 'undefined' && VideoEncoder.isConfigSupported) {
      var d0 = exportDims();
      VideoEncoder.isConfigSupported({ codec: 'hvc1.1.6.L120.90', width: d0[0], height: d0[1], bitrate: 8000000, framerate: exportCfg.fps || 30 })
        .then(function (s) { _startExportFastBody(!!(s && s.supported)); }).catch(function () { _startExportFastBody(false); });
    } else { _startExportFastBody(false); }
  }
  function _startExportFastBody(useHevc) {
    // ── PRE-FLIGHT DE MEMORIA (v4.35.2): nunca más quemar HORAS para morir al 100%. ──
    // El único camino que aún ingiere el audio del archivo COMPLETO (decodeUrl → ArrayBuffer
    // entero + PCM entero en heap) es: video largo SIN narración del build en memoria
    // (p.ej. recargaste un slideshow.mp4 viejo desde disco). El flujo normal — armar el
    // slideshow y exportar EN LA MISMA SESIÓN — reusa _pendingAudioBuf y NO entra aquí.
    var _spanChk = Math.max(0.1, (P ? (P.trimEnd - P.trimStart) : ST.dur));
    if (_spanChk > 1500 && !(_isSlideshow && _pendingAudioBuf)) {
      var _estGB = (_spanChk * 44100 * 2 * 4 / 1e9).toFixed(1);
      var _goRisky = confirm('⚠️ AVISO DE MEMORIA (antes de empezar, no después de horas)\n\n' +
        'Este video dura ~' + Math.round(_spanChk / 60) + ' min y para ponerle audio habría que cargar el archivo COMPLETO en RAM (~' + _estGB + ' GB extra al llegar al 100%). Eso es lo que tumbaba la página con "error 5".\n\n' +
        'CAMINO SEGURO: arma el slideshow (imágenes + audios) y exporta EN ESTA MISMA SESIÓN, sin recargar la página — así el audio se reusa de memoria y no hay riesgo.\n\n' +
        '¿Exportar igual bajo tu riesgo?');
      if (!_goRisky) return;   // aún no se mutó nada (ni ST.rendering ni botones) → salir limpio
    }
    if (_isSlideshow && _capsInFlight && !(P.captions && P.captions.length)) {
      var _goSinSubs = confirm('El motor de voz TODAVÍA está escuchando tus audios (mirá el avance abajo).\n\n' +
        'Si exportás AHORA, el MP4 sale SIN los subtítulos de tu voz — estaban por llegar.\n\n' +
        'Aceptar = exportar sin subtítulos · Cancelar = esperar a que abajo diga "✓ subtítulos desde tu voz" y exportar después.');
      if (!_goSinSubs) return;
    }
    stopPlay(); ST.rendering = true; btnExport.disabled = true;
    btnExport.textContent = '⏺ Exportando…';
    bbox('export-inicio', Math.round(Math.max(0.1, P.trimEnd - P.trimStart) / 60) + ' min');
    _exportStartMs = Date.now();   // cronómetro: para reportar cuánto tardó
    renderProgress.hidden = false; rpFill.style.width = '0%'; rpText.textContent = 'Export rápido — dejá ESTA pestaña al frente (si te cambias de pestaña, Chrome lo frena)…';

    var dims = exportDims(); var W = dims[0], H = dims[1];   // resolución de salida elegida (720/1080/1440/4K)
    if (stage.width !== W) stage.width = W;                  // renderizo a esa resolución; restoreStageSize() la repone al terminar
    if (stage.height !== H) stage.height = H;
    var FPS = exportCfg.fps || 30, fdurUs = Math.round(1e6 / FPS);
    var t0 = P.trimStart, t1 = P.trimEnd, span = Math.max(0.1, t1 - t0);
    var totalFrames = Math.ceil(span * FPS);

    function fail(msg) { bbox('fallo-export', String(msg || '').slice(0, 140)); aborted = true; try { if (_exDiskStream) { (_exDiskStream.abort ? _exDiskStream.abort() : _exDiskStream.close()); _exDiskStream = null; } } catch (e) {} try { if (endWatch) { clearInterval(endWatch); endWatch = null; } } catch (e) {} try { srcVideo.pause(); } catch (e) {} try { srcVideo.playbackRate = P.speed || 1; } catch (e) {} try { restoreStageSize(); } catch (e) {} ST.rendering = false; btnExport.disabled = false; btnExport.textContent = 'Exportar MP4'; rpText.textContent = msg; $('footNote').textContent = 'Export falló'; console.warn('[Export]', msg); }

    var muxer, vEnc, aEnc;
    // SALIDA POR SEGMENTOS-BLOB (v4.34): antes el MP4 entero se armaba EN RAM (ArrayBufferTarget +
    // fastStart in-memory) → un export de horas pedía GB contiguos al cerrar → "Error code 5" (la página
    // moría sin memoria) y de paso caía al modo lento. Ahora cada trozo que entrega el muxer se convierte
    // YA en un Blob (memoria del NAVEGADOR, se vuelca a disco) y el archivo final es la concatenación de
    // esos blobs (solo metadata, sin copia gigante). El heap de JS nunca acumula el video completo.
    var _segs = null, _segsEnd = 0;
    function _exWrite(data, position) {
      var b = new Blob([data]);   // copia inmediata (el muxer reutiliza su buffer interno)
      if (position >= _segsEnd) { _segs.push({ pos: position, len: b.size, blob: b }); _segsEnd = position + b.size; return; }
      // re-emisión / parche al finalizar (tamaños de cajas): recortar lo tapado con Blob.slice (sin leer datos)
      var newEnd = position + b.size, keep = [];
      for (var si = 0; si < _segs.length; si++) {
        var s = _segs[si], sEnd = s.pos + s.len;
        if (sEnd <= position || s.pos >= newEnd) { keep.push(s); continue; }
        if (s.pos < position) keep.push({ pos: s.pos, len: position - s.pos, blob: s.blob.slice(0, position - s.pos) });
        if (sEnd > newEnd) keep.push({ pos: newEnd, len: sEnd - newEnd, blob: s.blob.slice(s.len - (sEnd - newEnd)) });
      }
      keep.push({ pos: position, len: b.size, blob: b });
      _segs = keep;
      if (newEnd > _segsEnd) _segsEnd = newEnd;
    }
    try {
      var _exTarget;
      if (_exDiskStream && Mp4Muxer.FileSystemWritableFileStreamTarget) {
        _exTarget = new Mp4Muxer.FileSystemWritableFileStreamTarget(_exDiskStream, { chunked: true });   // MP4 directo a disco → videos de HORAS sin llenar RAM
      } else if (Mp4Muxer.StreamTarget) {
        _segs = []; _segsEnd = 0;
        _exTarget = new Mp4Muxer.StreamTarget({ onData: _exWrite, chunked: true });   // pocos trozos grandes
      } else {
        _exTarget = new Mp4Muxer.ArrayBufferTarget();   // librería vieja → modo en-memoria (como antes)
      }
      muxer = new Mp4Muxer.Muxer({
        target: _exTarget,
        video: { codec: (useHevc ? 'hevc' : 'avc'), width: W, height: H },
        audio: P.music.buffer || true ? { codec: 'aac', numberOfChannels: 2, sampleRate: 44100 } : undefined,
        fastStart: (_exDiskStream || _segs) ? false : 'in-memory'
      });
      vEnc = new VideoEncoder({
        output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); },
        error: function (e) { fail('Encoder de video falló: ' + e.message); }
      });
      // CALIDAD: bitrate según el preset elegido (Baja/Recomendada/Alta) escalado por resolución y fps.
      var bitrate = exportBitrate(W, H);
      // TOPE POR DURACIÓN: con la salida por segmentos-blob (v4.34) el archivo YA NO vive en el heap de JS,
      // así que el techo sube de 600 MB a ~3.5 GB (sigue habiendo tope para no parir archivos monstruosos).
      // Con la librería vieja (sin StreamTarget) se mantiene el techo conservador de 600 MB.
      var _maxBytes = (_exDiskStream ? 200000 : (_segs ? 3500 : 600)) * 1024 * 1024, _capBr = Math.floor(_maxBytes * 8 / Math.max(1, span));
      if (span > 120 && _capBr < bitrate) bitrate = Math.max(2500000, _capBr);
      // 'quality' (no 'realtime'): el modo realtime sacrifica calidad por latencia → en export queremos calidad.
      var cfg = { codec: (useHevc ? 'hvc1.1.6.L120.90' : 'avc1.640028'), width: W, height: H, bitrate: bitrate, framerate: FPS, latencyMode: 'quality', hardwareAcceleration: 'prefer-hardware' };
      try { vEnc.configure(cfg); }
      catch (e1) { cfg.hardwareAcceleration = 'no-preference'; vEnc.configure(cfg); }   // fallback si el HW no soporta esa combo
    } catch (e) { fail('No pude iniciar WebCodecs: ' + (e && e.message || e)); return; }

    // ── 1) Render de video acelerado: avanzo el <video> frame a frame y lo dibujo en el canvas ──
    var savedTool = ST.activeTool;
    function seekExact(time) {
      return new Promise(function (res) {
        function on() { srcVideo.removeEventListener('seeked', on); res(); }
        srcVideo.addEventListener('seeked', on);
        try { srcVideo.currentTime = time; } catch (e) { res(); }
      });
    }
    var aborted = false, finalized = false;   // FIX: 'finalized' se usaba en onVF pero NUNCA se declaraba → ReferenceError en strict mode → export colgado en 0% para siempre
    function fallbackToRealtime(msg) {   // WebCodecs no sirvió → grabación MediaRecorder (lenta pero infalible)
      console.warn('[Export] fallback realtime:', msg);
      try { if (endWatch) { clearInterval(endWatch); endWatch = null; } } catch (e) {}
      try { srcVideo.pause(); srcVideo.playbackRate = P.speed || 1; } catch (e) {}
      try { vEnc.close(); } catch (e) {}
      // El modo compatible reproduce en TIEMPO REAL (1x): un video de 20 min tarda 20+ min, y si la
      // pestaña no está al frente Chrome lo frena aún más. NO lo lanzamos para videos largos — es lo que
      // hacía que tardara "media hora" y se colgara. Mejor avisar y que reintente con la pestaña visible.
      if (span > 150) {
        try { restoreStageSize(); } catch (e) {}
        ST.rendering = false; btnExport.disabled = false; btnExport.textContent = 'Exportar MP4';
        rpFill.style.width = '0%';
        rpText.textContent = '⚠ El render rápido se frenó. Dejá ESTA pestaña al frente (no cambies de pestaña) y dale Exportar otra vez — los videos largos necesitan la pestaña visible para ir rápido.';
        $('footNote').textContent = 'Reintentá con la pestaña al frente';
        return;
      }
      ST.rendering = false;   // permite que startExportRealtime arranque (solo clips cortos)
      rpText.textContent = 'Cambiando a modo de exportación compatible…';
      setTimeout(function () { try { startExportRealtime(); } catch (e) { fail('No pude exportar: ' + (e && e.message || e)); } }, 80);
    }
    function finalizeMux() {
      if (finalized) return; finalized = true;   // idempotente: evita doble-finalize si un rVFC tardío entra
      bbox('export-mux', '');
      try { if (endWatch) { clearInterval(endWatch); endWatch = null; } } catch (e) {}
      if (!encoded) { return fallbackToRealtime('0 frames capturados (decoderConfig nulo)'); }   // sin frames → el muxer crashearía en colorSpace
      try { muxer.finalize(); } catch (e) { return fallbackToRealtime('muxer.finalize: ' + (e && e.message || e)); }
      var ext = (exportCfg.fmt === 'mov') ? 'mov' : 'mp4';
      var mime = (ext === 'mov') ? 'video/quicktime' : 'video/mp4';
      if (_exDiskStream) {   // MODO DISCO: el MP4 ya quedó escrito en el archivo; solo cerrarlo (cero Blob en RAM → soporta horas)
        var _ds = _exDiskStream; _exDiskStream = null;
        try { restoreStageSize(); } catch (e) {}
        _ds.close().then(function () {
          try { _policyCorpusOnExportSuccess(); } catch (ePc2) {}
          ST.rendering = false; btnExport.disabled = false; btnExport.textContent = 'Exportar MP4';
          rpFill.style.width = '100%';
          var tk = _exportStartMs ? Math.max(1, Math.round((Date.now() - _exportStartMs) / 1000)) : 0;
          var tS = tk ? (tk >= 60 ? (Math.floor(tk / 60) + 'm ' + (tk % 60) + 's') : (tk + 's')) : '';
          rpText.textContent = 'Listo en ' + tS + ' — MP4 guardado en tu disco · ábrelo en CapCut para seguir editando';
          bbox('done', 'export ' + tS);
          $('footNote').textContent = 'Exportado a disco ✓ · ' + tS;
          try { srcVideo.pause(); srcVideo.playbackRate = P.speed || 1; } catch (e) {}
          setTool(savedTool);
        }).catch(function (e) { fail('No pude cerrar el archivo en disco: ' + (e && e.message || e)); });
        return;
      }
      var blob;
      if (_segs) {
        // concatenación de blobs = solo METADATA (cero copia gigante) → cerrar un export de horas no pide RAM
        _segs.sort(function (a, b) { return a.pos - b.pos; });
        blob = new Blob(_segs.map(function (s) { return s.blob; }), { type: mime });
        _segs = null;
      } else {
        blob = new Blob([muxer.target.buffer], { type: mime });
      }
      restoreStageSize();   // reponer el lienzo al tamaño de preview (se había agrandado para exportar en alta resolución)
      dlBlob(blob, ext);
      try { _policyCorpusOnExportSuccess(); } catch (ePc2) {}   // POLICY 2B: corpus hook — sitio TURBO (exclusión mutua vía flag)
      ST.rendering = false; btnExport.disabled = false; btnExport.textContent = 'Exportar MP4';
      rpFill.style.width = '100%';
      var took = _exportStartMs ? Math.max(1, Math.round((Date.now() - _exportStartMs) / 1000)) : 0;
      var tStr = took ? (took >= 60 ? (Math.floor(took / 60) + 'm ' + (took % 60) + 's') : (took + 's')) : '';
      rpText.textContent = 'Listo en ' + tStr + ' — MP4 (' + fmtB(blob.size) + ') · ábrelo en CapCut para seguir editando';
      bbox('done', 'export ' + tStr);
      $('footNote').textContent = 'Exportado ✓ MP4 · ' + tStr;
      try { srcVideo.pause(); srcVideo.playbackRate = P.speed || 1; } catch (e) {}
      setTool(savedTool);
    }
    function encodeAudioThenFinish() {
      var wantAvatar = !!(_avatarObjUrl && P.avatar && P.avatar.on && P.avatar.kind === 'video' && P.avatar.audio);
      // ── 2) Audio: mezcla VOZ del video + música (+ voz del avatar) respetando trim y velocidad → render offline ──
      rpText.textContent = 'Turbo: audio (voz + música' + (wantAvatar ? ' + avatar' : '') + ')…';
      var sr = 44100, ch = 2, spd = P.speed || 1;
      var outSpan = span / spd;                                   // si hay speed, el audio dura menos
      var frames = Math.max(1, Math.ceil(outSpan * sr));
      function decodeUrl(url) {
        if (!url) return Promise.resolve(null);
        return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
          var tmp = new (window.AudioContext || window.webkitAudioContext)();
          return tmp.decodeAudioData(ab).then(function (buf) { try { tmp.close(); } catch (e) {} return buf; });
        }).catch(function () { return null; });
      }
      // MEZCLA MANUAL POR BLOQUES (v4.34, videos largos): OfflineAudioContext renderiza TODA la mezcla en
      // RAM (2 h ≈ 2.5 GB) — era el otro motivo del "Error code 5". Aquí se mezcla a mano 1 s a la vez
      // (voz + música en loop + avatar, interpolación lineal, mismos gains/trim/speed) sin buffer gigante.
      // AUTO-DUCKING (v4.38.0): la música BAJA sola cuando hay voz, para que la narración se entienda,
      // y vuelve a su nivel en los silencios. CONSERVADOR: nunca sube por encima del volumen que pusiste.
      // Devuelve {hop, levels, n} en tiempo de SALIDA, o null (→ sin ducking, gain estático de siempre).
      function nspVoiceDuckEnvelope(voiceBuf2, t0b, spdb, outSpanb) {
        try {
          if (!voiceBuf2 || !(outSpanb > 0)) return null;
          var vsr = voiceBuf2.sampleRate, vlen = voiceBuf2.length;
          var isI2 = !!voiceBuf2.i16, SC2 = isI2 ? (1 / 32768) : 1;
          var Lc = isI2 ? voiceBuf2.i16 : voiceBuf2.getChannelData(0);
          var Rc = isI2 ? Lc : (voiceBuf2.numberOfChannels > 1 ? voiceBuf2.getChannelData(1) : Lc);
          var hop = 0.05, n = Math.max(2, Math.ceil(outSpanb / hop) + 1), raw = new Float32Array(n), THRESH = 0.04;
          for (var k = 0; k < n; k++) {
            var srcT = t0b + (k * hop) * spdb, i0 = Math.floor(srcT * vsr), w = Math.max(1, Math.floor(hop * vsr)), sum = 0, cnt = 0;
            for (var j = 0; j < w; j += 4) { var idx = i0 + j; if (idx < 0 || idx >= vlen) continue; var s = (Lc[idx] + Rc[idx]) * 0.5 * SC2; sum += s * s; cnt++; }
            var rms = cnt ? Math.sqrt(sum / cnt) : 0;
            raw[k] = rms > THRESH ? Math.min(1, (rms - THRESH) / 0.12) : 0;
          }
          var lev = new Float32Array(n), prev = 0, has = false;
          for (var a = 0; a < n; a++) { var tg = raw[a], al = tg > prev ? 0.6 : 0.06; prev = prev + al * (tg - prev); lev[a] = prev; if (prev > 0.02) has = true; }
          return has ? { hop: hop, levels: lev, n: n } : null;
        } catch (e) { return null; }
      }
      function nspDuckMul(env, tOut, depth) {
        if (!env) return 1;
        var f = tOut / env.hop, i0 = f | 0; if (i0 < 0) i0 = 0; if (i0 >= env.n) i0 = env.n - 1;
        var i1 = (i0 + 1 < env.n) ? i0 + 1 : i0, fr = f - (f | 0);
        var lvl = env.levels[i0] + (env.levels[i1] - env.levels[i0]) * fr;
        return 1 - depth * lvl;   // depth 0.55 → la música baja hasta 45% bajo la voz plena
      }
      var NSP_DUCK_DEPTH = 0.55;

      function mixChunkedAndEncode(voiceBuf, avatarBuf) {
        var musB = (P.music && P.music.buffer) || null;
        if (!voiceBuf && !musB && !avatarBuf) return finalizeMux();   // nada que mezclar → video sin audio
        try {
          aEnc = new AudioEncoder({
            output: function (chunk, meta) { muxer.addAudioChunk(chunk, meta); },
            error: function (e) { console.warn('[Turbo audio mix]', e && e.message); finalizeMux(); }
          });
          aEnc.configure({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: sr, bitrate: 160000 });
        } catch (eA) { return finalizeMux(); }
        var vL = null, vR = null, vSr = 0, vLen = 0, vGain = (P.music && P.music.origVol != null) ? P.music.origVol : 1;
        if (voiceBuf) {
          vSr = voiceBuf.sampleRate; vLen = voiceBuf.length;
          if (voiceBuf.i16) { vL = voiceBuf.i16; vR = vL; vGain = vGain / 32768; }
          else { vL = voiceBuf.getChannelData(0); vR = voiceBuf.numberOfChannels > 1 ? voiceBuf.getChannelData(1) : vL; }
        }
        var mL = null, mR = null, mSr = 0, mLen = 0, mGain = (P.music && P.music.vol != null) ? P.music.vol : 0.28;
        if (musB) { mSr = musB.sampleRate; mLen = musB.length; mL = musB.getChannelData(0); mR = musB.numberOfChannels > 1 ? musB.getChannelData(1) : mL; }
        var _duckEnv = (musB && voiceBuf) ? nspVoiceDuckEnvelope(voiceBuf, t0, spd, outSpan) : null;   // auto-ducking
        if (_duckEnv) console.log('[Turbo audio] auto-ducking ON — la música baja bajo la voz');
        var aL = null, aR = null, aSr2 = 0, aLen = 0, aOff = 0, aGain = 0;
        if (avatarBuf) {
          var adur = avatarBuf.duration || 0; aOff = Math.min(t0, Math.max(0, adur - 0.05));
          if (adur > aOff + 0.05) {
            aSr2 = avatarBuf.sampleRate; aLen = avatarBuf.length; aGain = clamp(P.avatar.audioVol == null ? 1 : P.avatar.audioVol, 0, 1);
            aL = avatarBuf.getChannelData(0); aR = avatarBuf.numberOfChannels > 1 ? avatarBuf.getChannelData(1) : aL;
          }
        }
        function lin(arr, len, idx) { var i0 = idx | 0; if (i0 < 0 || i0 >= len) return 0; var fr = idx - i0, i1 = (i0 + 1 < len) ? i0 + 1 : i0; return arr[i0] + (arr[i1] - arr[i0]) * fr; }
        var CHUNK = sr, apos = 0, total = frames;
        (function pumpM() {
          try {
            var guard = 0;
            while (apos < total) {
              if (aEnc.encodeQueueSize > 48) { setTimeout(pumpM, 12); return; }   // backpressure del encoder
              if (guard++ > 40) { setTimeout(pumpM, 0); return; }                  // cede el hilo (mezcla pesada)
              var n = Math.min(CHUNK, total - apos);
              var inter = new Float32Array(n * 2);
              for (var i = 0; i < n; i++) {
                var t = (apos + i) / sr;       // tiempo en el audio de SALIDA
                var srcT = t0 + t * spd;       // tiempo en la FUENTE (respeta trim + velocidad)
                var l = 0, rr = 0;
                if (vL) { var vi = srcT * vSr; l += lin(vL, vLen, vi) * vGain; rr += lin(vR, vLen, vi) * vGain; }
                if (mL) { var mt = (t * spd) % (mLen / mSr); var mi = mt * mSr; var mdg = mGain * (_duckEnv ? nspDuckMul(_duckEnv, t, NSP_DUCK_DEPTH) : 1); l += lin(mL, mLen, mi) * mdg; rr += lin(mR, mLen, mi) * mdg; }
                if (aL) { var ai = (aOff + t * spd) * aSr2; if (ai < aLen) { l += lin(aL, aLen, ai) * aGain; rr += lin(aR, aLen, ai) * aGain; } }
                inter[i * 2] = l > 1 ? 1 : (l < -1 ? -1 : l);
                inter[i * 2 + 1] = rr > 1 ? 1 : (rr < -1 ? -1 : rr);
              }
              var ts = Math.round(apos / sr * 1e6);
              var ad = new AudioData({ format: 'f32', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: ts, data: inter });
              aEnc.encode(ad); ad.close();
              apos += n;
              if (apos % (sr * 60) === 0) { rpText.textContent = 'Turbo: audio ' + Math.round(apos / total * 100) + '%…'; bbox('export-audio', Math.round(apos / total * 100) + '%'); }
            }
            aEnc.flush().then(finalizeMux).catch(finalizeMux);
          } catch (eP) { finalizeMux(); }
        })();
      }
      // decodifica EN PARALELO el audio del video principal y (si toca) el del avatar
      // SLIDESHOW (v4.35.1 — FIX error code 5 al 100%): la narración YA está decodificada en
      // _pendingAudioBuf desde el build (no se limpia en toda la sesión). Volver a ingerir el
      // slideshow ENTERO (fetch→ArrayBuffer del archivo completo + decodeAudioData del PCM completo)
      // duplicaba 2-5 GB de heap justo al terminar el video → la página moría "al finalizar".
      // Con el buffer del build se reusa lo que ya está en memoria: CERO asignación nueva.
      var _voiceP = (_isSlideshow && _pendingAudioBuf) ? Promise.resolve(_pendingAudioBuf) : decodeUrl(_srcObjUrl);
      if (_isSlideshow && _pendingAudioBuf) console.log('[Export audio] slideshow → reuso la narración del build (sin re-decodificar el archivo: 0 bytes nuevos)');
      Promise.all([_voiceP, wantAvatar ? decodeUrl(_avatarObjUrl) : Promise.resolve(null)]).then(function (bufs) {
        var voiceBuf = bufs[0], avatarBuf = bufs[1];
        if (voiceBuf && voiceBuf.i16 && !(outSpan > 1500)) { try { voiceBuf = _pcm16Window(voiceBuf, 0, null); } catch (eWv) { voiceBuf = null; } }
        if (wantAvatar && !avatarBuf) {
          try { if (typeof nspEdToast === 'function') nspEdToast('⚠ No pude extraer el audio del .mp4 del avatar — subí su voz como MP3 aparte; el video saldrá sin la voz del avatar.', 'error', 7000); } catch (e) {}
          try { var _fnAv = document.getElementById('footNote'); if (_fnAv) _fnAv.textContent = '⚠ Avatar sin audio (el .mp4 no se pudo decodificar) — subí su voz como MP3 aparte.'; } catch (e) {}
        }
        // VIDEOS LARGOS (>25 min): mezclar a mano por bloques — sin el render gigante en RAM.
        if (outSpan > 1500) { return mixChunkedAndEncode(voiceBuf, avatarBuf); }
        var off;
        try { off = new OfflineAudioContext(ch, frames, sr); } catch (e) { return finalizeMux(); }
        var any = false;
        // VOZ original (recortada al trim, con la velocidad del proyecto)
        if (voiceBuf) {
          try {
            var vn = off.createBufferSource(); vn.buffer = voiceBuf; vn.playbackRate.value = spd;
            var vg = off.createGain(); vg.gain.value = (P.music && P.music.origVol != null) ? P.music.origVol : 1;
            vn.connect(vg); vg.connect(off.destination);
            vn.start(0, t0, span);   // arranca leyendo desde trimStart, dura 'span' del original
            any = true;
          } catch (e) {}
        }
        // MÚSICA del proyecto (loop)
        if (P.music && P.music.buffer) {
          try {
            var mn = off.createBufferSource(); mn.buffer = P.music.buffer; mn.loop = true; mn.playbackRate.value = spd;
            var mg = off.createGain(); var _mvol = P.music.vol != null ? P.music.vol : 0.28;
            // AUTO-DUCKING: curva de volumen de la música que baja bajo la voz. Si algo falla → gain estático.
            var _de = voiceBuf ? nspVoiceDuckEnvelope(voiceBuf, t0, spd, outSpan) : null;
            var _ducked = false;
            if (_de && _de.n >= 2 && outSpan > 0.1) {
              try {
                var curve = new Float32Array(_de.n);
                for (var ci = 0; ci < _de.n; ci++) { var g = _mvol * (1 - NSP_DUCK_DEPTH * _de.levels[ci]); curve[ci] = (isFinite(g) && g >= 0) ? g : _mvol; }
                mg.gain.setValueCurveAtTime(curve, 0, outSpan);
                _ducked = true;
                console.log('[Turbo audio] auto-ducking ON (offline) — la música baja bajo la voz');
              } catch (eDuck) { _ducked = false; }
            }
            if (!_ducked) mg.gain.value = _mvol;   // fallback: comportamiento de siempre
            mn.connect(mg); mg.connect(off.destination); mn.start(0); any = true;
          } catch (e) {}
        }
        // VOZ DEL AVATAR (talking-head), alineada al timeline (avatar t = video t), volumen propio
        if (avatarBuf) {
          try {
            var adur = avatarBuf.duration || 0, off0 = Math.min(t0, Math.max(0, adur - 0.05));
            if (adur > off0 + 0.05) {
              var an = off.createBufferSource(); an.buffer = avatarBuf; an.playbackRate.value = spd;
              var ag = off.createGain(); ag.gain.value = clamp(P.avatar.audioVol == null ? 1 : P.avatar.audioVol, 0, 1);
              an.connect(ag); ag.connect(off.destination);
              an.start(0, off0, Math.min(span, Math.max(0.1, adur - off0))); any = true;
            }
          } catch (e) {}
        }
        if (!any) { return finalizeMux(); }   // ni voz ni música ni avatar → video sin audio
        off.startRendering().then(function (rendered) {
        try {
          var aSr = rendered.sampleRate, aCh = rendered.numberOfChannels;
          aEnc = new AudioEncoder({
            output: function (chunk, meta) { muxer.addAudioChunk(chunk, meta); },
            error: function (e) { console.warn('[Turbo audio]', e.message); finalizeMux(); }
          });
          aEnc.configure({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: aSr, bitrate: 160000 });
          // CODIFICA EN BLOQUES de 1 s (no un AudioData gigante): en videos largos (2 h) interleavear todo
          // en un Float32Array de >1GB hacía fallar el encode → export MUDO. Lee directo del render mezclado.
          var L = rendered.getChannelData(0), R = aCh > 1 ? rendered.getChannelData(1) : L;
          var total = rendered.length, CHUNK = aSr, apos = 0;
          (function pumpA() {
            try {
              var guard = 0;
              while (apos < total) {
                if (aEnc.encodeQueueSize > 48) { setTimeout(pumpA, 12); return; }   // backpressure del encoder
                if (guard++ > 120) { setTimeout(pumpA, 0); return; }                // cede el hilo (no congela la UI)
                var n = Math.min(CHUNK, total - apos);
                var inter = new Float32Array(n * 2);
                for (var i = 0; i < n; i++) { inter[i * 2] = L[apos + i]; inter[i * 2 + 1] = R[apos + i]; }
                var ts = Math.round(apos / aSr * 1e6);
                var ad = new AudioData({ format: 'f32', sampleRate: aSr, numberOfFrames: n, numberOfChannels: 2, timestamp: ts, data: inter });
                aEnc.encode(ad); ad.close();
                apos += n;
              }
              aEnc.flush().then(finalizeMux).catch(finalizeMux);
            } catch (e) { finalizeMux(); }
          })();
        } catch (e) { finalizeMux(); }
        }).catch(finalizeMux);   // cierra off.startRendering()
      }).catch(finalizeMux);     // cierra el fetch(_srcObjUrl).then(decode).then(voiceBuf)
    }

    // ── Motor RÁPIDO: reproduce el video ACELERADO (8x) y captura cada frame real con
    //    requestVideoFrameCallback. NADA de seek (el seek por-frame es lentísimo). El timestamp
    //    real (mediaTime) se usa para el encode → el MP4 sale con la duración correcta aunque
    //    lo procesemos acelerado. Limitado por lo que el HW decode+encode aguante (varios x).
    // 16x es lo más rápido, pero en videos LARGOS el decoder no llega y se capturan frames NEGROS.
    // Bajamos la velocidad según la duración → el decoder siempre tiene el cuadro listo (cero negro).
    var RATE = (span > 600 ? 5 : span > 240 ? 8 : 16), encoded = 0;
    var videoDone = false, lastProgMs = 0, endWatch = null, _hadFrame = false;
    var frameDt = 1 / FPS, nextEncT = t0;   // CADENCIA FIJA 30fps: emitimos un frame cada 1/30s recalculando el zoom,
    // aunque el navegador a 16x presente frames salteados. Así el movimiento (Ken Burns/breathing) sale FLUIDO y no "pegado".
    srcVideo.muted = true;
    try { srcVideo.currentTime = t0; } catch (e) {}
    try { srcVideo.playbackRate = RATE; } catch (e) {}
    // ── CIERRE DEL VIDEO: lo llamamos por mt>=t1, por el evento 'ended', o por watchdog (anti-cuelgue al 100%). ──
    // BUG arreglado: el chequeo de "terminó" vivía SOLO dentro de onVF, pero al acabar el video el
    // requestVideoFrameCallback deja de dispararse → onVF no se vuelve a llamar → se quedaba pegado en 100%.
    function endVideoPhase() {
      if (videoDone || aborted || finalized) return; videoDone = true;
      if (endWatch) { try { clearInterval(endWatch); } catch (e) {} endWatch = null; }
      try { srcVideo.removeEventListener('ended', onEnded); } catch (e) {}
      try { srcVideo.pause(); } catch (e) {}
      if (!encoded) { finalizeMux(); return; }   // 0 frames → directo a finalizeMux (que cae al modo compatible)
      rpText.textContent = 'Cerrando video…';
      vEnc.flush().then(encodeAudioThenFinish).catch(function (e) { fallbackToRealtime('flush video: ' + (e && e.message || e)); });
    }
    function onEnded() {
      if (videoDone || aborted || finalized) return;
      // si 'ended' llega ANTES de cubrir todo (buffer agotado a alta velocidad = "salta al 50%"), NO truncamos:
      // rellenamos el resto hasta t1 con drainTail (force reusa el último cuadro) en vez de cerrar a medias.
      if (nextEncT < t1 - 0.5) { try { srcVideo.pause(); } catch (e) {} drainTail(); return; }
      endVideoPhase();
    }
    // Emite TODOS los frames de salida (a 30fps) cuyo tiempo ya cubrió el source, recalculando drawAt en cada uno.
    // Devuelve true si quedó pendiente por saturación del encoder (hay que reintentar).
    function emitUpTo(targetT, force) {
      var guard = 0;
      while (nextEncT <= targetT + 1e-6 && !videoDone && !aborted && !finalized) {
        if (vEnc.encodeQueueSize > 90) return true;   // encoder lleno → frená y seguimos en la próxima vuelta
        if (guard++ > 240) return true;               // tope de seguridad por llamada (8s de video) → cede el hilo
        // ANTI-NEGRO ROBUSTO: si hay cuadro decodificado (readyState>=2) lo dibujamos; si NO (típico a alta
        // velocidad en videos largos) NO dibujamos negro — REUSAMOS el último cuadro bueno (el canvas lo
        // conserva) y seguimos. Así el export NUNCA sale negro NI se frena/rinde. Solo esperamos al ARRANQUE
        // (antes del primer cuadro) para no encodear un negro inicial.
        if (force || srcVideo.readyState >= 2) { drawAt(nextEncT); _hadFrame = true; }
        else if (!_hadFrame) { return false; }   // todavía no hubo ningún cuadro → esperá al primer rVFC (sin negro)
        var ts = Math.max(0, Math.round((nextEncT - t0) * 1e6));
        var frame = new VideoFrame(stage, { timestamp: ts, duration: fdurUs });
        vEnc.encode(frame, { keyFrame: (encoded % 60 === 0) });
        frame.close(); encoded++; lastProgMs = Date.now();
        nextEncT += frameDt;
      }
      return false;
    }
    function onVF(now, meta) {
      if (aborted || finalized || videoDone) return;
      var mt = (meta && meta.mediaTime != null) ? meta.mediaTime : srcVideo.currentTime;
      var atEnd = (mt >= t1 - 0.02 || srcVideo.ended);
      var cap = atEnd ? Math.min(t1, mt) : mt;
      var saturated;
      try { saturated = emitUpTo(cap); } catch (e) { fail('encode: ' + (e && e.message || e)); return; }
      var pct = clamp((nextEncT - t0) / span, 0, 1) * 100;
      rpFill.style.width = Math.min(99, pct) + '%';
      rpText.textContent = 'Exportando ' + Math.round(pct) + '% — ' + fmt(nextEncT - t0) + ' / ' + fmt(span);
      if (atEnd) { try { srcVideo.pause(); } catch (e) {} drainTail(); return; }   // llegó al final → drená el resto con timers (no depende del rVFC)
      // si el encoder se saturó (o quedó backlog), frená el video hasta que drene y reintentá
      if (saturated || vEnc.encodeQueueSize > 60) { try { srcVideo.pause(); } catch (e) {} setTimeout(function () { if (videoDone || aborted || finalized) return; try { srcVideo.play(); } catch (e) {} if (srcVideo.requestVideoFrameCallback) srcVideo.requestVideoFrameCallback(onVF); }, 20); return; }
      if (srcVideo.requestVideoFrameCallback) srcVideo.requestVideoFrameCallback(onVF);
    }
    // drena los frames de salida que falten hasta t1 (cola final) sin depender del rVFC, que deja de dispararse al terminar
    function drainTail() {
      if (videoDone || aborted || finalized) return;
      var sat;
      try { sat = emitUpTo(t1, true); } catch (e) { fail('encode: ' + (e && e.message || e)); return; }   // force: en el cierre el video está pausado en el último cuadro
      rpFill.style.width = Math.min(99, clamp((nextEncT - t0) / span, 0, 1) * 100) + '%';
      if (nextEncT > t1 - 1e-6 && !sat) { endVideoPhase(); return; }
      setTimeout(drainTail, 15);
    }
    // ── EXPORT POR SEEK (slideshows) ──────────────────────────────────────────────
    // Para NUESTROS slideshows no reproducimos: a alta velocidad el <video> dispara 'ended' al ~50% y el
    // export se cortaba ("salta y no carga lo demás"). Buscamos (seek) el cuadro de cada imagen y renderizamos
    // sus frames con drawAt (efectos por-cuadro sobre el mismo decode). Imposible saltar/terminar antes → SIEMPRE completo.
    function runSeekCapture() {
      var secPer = (_slideshowSecPer > 0.3 ? _slideshowSecPer : 4);
      var dur = srcVideo.duration || t1;
      // Slideshow PRECISO: los cortes reales viven en _slideshowTimeline (timestamps de la voz).
      // Se exporta TRAMO POR TRAMO (seek al centro de cada uno) para que el corte del MP4 final
      // caiga EXACTO donde cambia la voz. Sin timeline → rejilla clásica de secPer (idéntica a antes).
      var tlSlots = null;
      if (_slideshowTimeline && _slideshowTimeline.length > 1) {
        tlSlots = [];
        for (var si = 0; si < _slideshowTimeline.length; si++) {
          var sg = _slideshowTimeline[si];
          var sa = Math.max(t0, sg.start), sb = Math.min(t1, sg.end);
          if (sb - sa > 0.04) tlSlots.push({ a: sa, b: sb });
        }
        if (tlSlots.length) { tlSlots[0].a = t0; tlSlots[tlSlots.length - 1].b = t1; }
        else tlSlots = null;
      }
      var tlIdx = 0;
      function seekTo(time) {
        return new Promise(function (res) {
          var done = false;
          function on() { if (done) return; done = true; try { srcVideo.removeEventListener('seeked', on); } catch (e) {} res(); }
          srcVideo.addEventListener('seeked', on);
          setTimeout(function () { if (!done) { done = true; try { srcVideo.removeEventListener('seeked', on); } catch (e) {} res(); } }, 1500);   // anti-cuelgue por si 'seeked' no llega
          try { srcVideo.currentTime = Math.max(0, Math.min(time, dur - 0.02)); } catch (e) { res(); }
        });
      }
      try { srcVideo.muted = true; srcVideo.pause(); } catch (e) {}
      function doSlot(slotStart) {
        if (videoDone || aborted || finalized) return;
        if (slotStart >= t1 - 1e-3) { endVideoPhase(); return; }   // cubrimos TODO el video → cerrar
        var slotEnd, seekT;
        if (tlSlots) {
          while (tlIdx < tlSlots.length - 1 && tlSlots[tlIdx].b <= slotStart + 1e-6) tlIdx++;
          var cur = tlSlots[tlIdx];
          slotEnd = Math.max(slotStart + 0.04, Math.min(t1, cur.b));
          seekT = Math.min(t1 - 0.05, (Math.max(cur.a, slotStart) + slotEnd) / 2);
        } else {
          slotEnd = Math.min(t1, slotStart + secPer);
          seekT = Math.min(t1 - 0.05, slotStart + secPer * 0.5);
        }
        seekTo(seekT).then(function () {
          _hadFrame = true;
          (function fill() {
            if (videoDone || aborted || finalized) return;
            try { emitUpTo(slotEnd, true); } catch (e) { return fail('encode: ' + (e && e.message || e)); }   // force: dibuja el cuadro buscado sí o sí
            var pct = clamp((nextEncT - t0) / span, 0, 1) * 100;
            rpFill.style.width = Math.min(99, pct) + '%';
            rpText.textContent = 'Exportando ' + Math.round(pct) + '% — ' + fmt(nextEncT - t0) + ' / ' + fmt(span);
            bbox('export-video', Math.round(pct) + '%');
            if (nextEncT < slotEnd - 1e-6) { setTimeout(fill, vEnc.encodeQueueSize > 60 ? 16 : 0); return; }   // encoder lleno → seguí el MISMO tramo
            setTimeout(function () { doSlot(slotEnd); }, 0);
          })();
        });
      }
      doSlot(t0);
    }
    if (_isSlideshow) { runSeekCapture(); return; }   // slideshow → SEEK (no reproducción, que salta al 50%)
    if (!srcVideo.requestVideoFrameCallback) { fail('Tu navegador no soporta captura rápida de frames. Usá Chrome actualizado.'); return; }
    srcVideo.addEventListener('ended', onEnded);   // red 1: el video terminó (caso export completo)
    var reKicks = 0;   // cuántas veces re-empujamos la reproducción tras un freno
    function reKickPlay() { try { srcVideo.playbackRate = RATE; srcVideo.play(); if (srcVideo.requestVideoFrameCallback) srcVideo.requestVideoFrameCallback(onVF); } catch (e) {} lastProgMs = Date.now(); }
    srcVideo.play().then(function () {
      lastProgMs = Date.now();
      srcVideo.requestVideoFrameCallback(onVF);
      // red 2: watchdog — si el rVFC deja de dispararse, decide qué hacer según DÓNDE pasó.
      endWatch = setInterval(function () {
        if (videoDone || aborted || finalized) return;
        if (srcVideo.ended) { try { srcVideo.pause(); } catch (e) {} drainTail(); return; }   // terminó → emite el resto y cierra
        var stall = lastProgMs ? (Date.now() - lastProgMs) : 0;
        if (encoded > 0 && stall > 2500) {
          // ¿estamos casi al final? entonces drená la cola y cerrá. Si NO (freno a mitad, típico de
          // pestaña en 2º plano), re-empujá la reproducción: drenar a mitad CONGELARÍA el resto del video.
          if (nextEncT >= t1 - 0.5) { try { srcVideo.pause(); } catch (e) {} drainTail(); }
          else { reKickPlay(); }
        }
        else if (encoded === 0 && stall > 4000 && reKicks < 3) { reKicks++; reKickPlay(); }   // arranque lento (archivo grande) → re-empujar antes de rendirse
        else if (encoded === 0 && stall > 14000) endVideoPhase();   // nunca arrancó → cerrar (avisa que la pestaña debe estar al frente)
      }, 600);
    }).catch(function () { fail('No pude reproducir el video para exportar.'); });
  }

  function startExportRealtime() {
    if (ST.rendering || !ST.ready) return;
    stopPlay(); ST.rendering = true; btnExport.disabled = true;
    renderProgress.hidden = false; rpFill.style.width = '0%'; rpText.textContent = 'Preparando audio + lienzo…';
    var _rtDims = exportDims(); if (stage.width !== _rtDims[0]) stage.width = _rtDims[0]; if (stage.height !== _rtDims[1]) stage.height = _rtDims[1];   // respetar la resolución elegida (se restaura en endExport/failExport)
    var actx;
    try { actx = ensureAudio(); _origGain.gain.value = P.music.origVol; if (_monGain) _monGain.gain.value = 0; }
    catch (e) { failExport('No pude iniciar el audio. Recargá la página y reintentá.'); return; }
    (actx.state === 'suspended' ? actx.resume() : Promise.resolve()).then(function () {
      var musicNode = null, watchdog = null, finalized = false;
      function finalizeOk(blob) { if (finalized) return; finalized = true; if (watchdog) { clearInterval(watchdog); watchdog = null; } finishExport(blob); }
      function finalizeFail(msg) { if (finalized) return; finalized = true; if (watchdog) { clearInterval(watchdog); watchdog = null; } try { if (musicNode) musicNode.stop(); } catch (e) {} failExport(msg); }
      function stopRec(rec) { try { rec.stop(); } catch (e) {} try { srcVideo.pause(); } catch (e) {} }
      try {
        var cstream = stage.captureStream(exportCfg.fps || 30); var mixed = new MediaStream();
        cstream.getVideoTracks().forEach(function (t) { mixed.addTrack(t); });
        try { _dest.stream.getAudioTracks().forEach(function (t) { mixed.addTrack(t); }); } catch (e) {}
        var musicGain = null;
        if (P.music.buffer) { musicNode = actx.createBufferSource(); musicNode.buffer = P.music.buffer; musicNode.loop = true; try { musicNode.playbackRate.value = P.speed || 1; } catch (e) {} musicGain = actx.createGain(); musicGain.gain.value = P.music.vol; musicNode.connect(musicGain); musicGain.connect(_dest); }
        var mime = 'video/webm;codecs=vp9,opus';
        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
        var rec; try { rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 12000000 }); } catch (e) { rec = new MediaRecorder(mixed); }
        var chunks = []; rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = function () { finalizeFail('La grabación falló (memoria/codec). Probá un recorte más corto.'); };
        rec.onstop = function () {
          try { if (musicNode) musicNode.stop(); } catch (e) {}
          if (!chunks.length) { finalizeFail('No se grabó nada. Reintentá.'); return; }
          finalizeOk(new Blob(chunks, { type: 'video/webm' }));   // → MP4 (ffmpeg) o WebM fallback
        };
        srcVideo.muted = false; srcVideo.playbackRate = P.speed || 1;
        try { srcVideo.currentTime = P.trimStart; } catch (e) {}
        // Watchdog INDEPENDIENTE del loop de render: si el video se atasca (rVFC deja
        // de disparar) el loop no corre y no podría auto-cortar; este timer sí.
        var wdLast = -1, wdStall = 0;
        watchdog = setInterval(function () {
          if (finalized) { clearInterval(watchdog); return; }
          var ct = srcVideo.currentTime;
          // FIX CUELGUE AL 100%: al llegar al final, rVFC deja de dispararse y loop() ya no corre,
          // así que ES ESTE timer el que tiene que cerrar la grabación. Antes hacía 'return' y el
          // botón se quedaba "Renderizando…" para siempre en 20:13/20:13.
          if (ct >= P.trimEnd - 0.05 || srcVideo.ended) { stopRec(rec); return; }
          if (Math.abs(ct - wdLast) < 0.01) { wdStall++; if (wdStall >= 6) stopRec(rec); }  // ~6s congelado → cortar
          else { wdStall = 0; wdLast = ct; }
        }, 1000);
        function loop() {
          if (!ST.rendering || finalized) return;
          var t = srcVideo.currentTime;
          if (t >= P.trimEnd || srcVideo.ended) { stopRec(rec); return; }
          drawAt(t); var pct = clamp((t - P.trimStart) / Math.max(0.1, P.trimEnd - P.trimStart), 0, 1) * 100;
          rpFill.style.width = Math.min(99, pct) + '%'; rpText.textContent = 'Renderizando ' + fmt(t - P.trimStart) + ' / ' + fmt(P.trimEnd - P.trimStart) + ' (frame-exacto)';
          scheduleDraw(loop);
        }
        rec.start(1000); if (musicNode) try { musicNode.start(); } catch (e) {}
        btnExport.textContent = '⏺ Renderizando…';
        srcVideo.onended = function () { stopRec(rec); };   // red extra anti-cuelgue: el <video> terminó → cerrar grabación (no depende del loop/rVFC que muere al final)
        srcVideo.play().then(function () { loop(); }).catch(function () { loop(); });
      } catch (e) { finalizeFail('Error preparando el render: ' + (e && e.message || e)); }
    }).catch(function () { failExport('El navegador bloqueó el audio. Hacé click en la página y reintentá.'); });
  }

  // ── ESCUDO ANTI-DESMONETIZACIÓN ────────────────────────────────────────────
  // Justo antes de exportar revisa el score de monetización. Si el video está
  // sub-optimizado (riesgo de que YouTube lo marque como "inauténtico/reusado")
  // muestra QUÉ falta arreglar. Nunca bloquea: siempre podés "Exportar igual".
  function confirmExportGate(r) {
    return new Promise(function (resolve) {
      var prev = document.getElementById('exportGateModal'); if (prev) try { prev.remove(); } catch (e) {}
      var bad = (r.factors || []).filter(function (x) { return !x[0]; }).map(function (x) { return x[1]; });
      var ov = el('div', 'modal'); ov.id = 'exportGateModal';
      var box = el('div', 'modal-box');
      var hdr = el('div', 'modal-hdr'); hdr.appendChild(el('span', '', 'ESCUDO ANTI-DESMONETIZACIÓN')); box.appendChild(hdr);
      var body = el('div', 'modal-body');
      var sc = el('div', '', r.score + '/100 · ' + r.verdict);
      sc.style.cssText = 'font-size:24px;font-weight:800;margin:0 0 6px;'; sc.style.color = r.color; body.appendChild(sc);
      var msg = el('div', '', r.score < 50
        ? 'ALTO RIESGO: YouTube puede marcar este video como contenido "inauténtico/reusado" y NO monetizarlo. Conviene arreglar esto antes de subir:'
        : 'Casi listo. Le falta poco para ser sólido ante la política de monetización. Mejorá esto para asegurar los anuncios:');
      msg.style.cssText = 'opacity:.85;line-height:1.5;margin-bottom:12px;'; body.appendChild(msg);
      if (bad.length) {
        var ul = el('div', ''); ul.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px;';
        bad.forEach(function (b) { var li = el('div', '', '✗ ' + b); li.style.cssText = 'color:#FF6B6B;font-weight:600;font-size:13px;'; ul.appendChild(li); });
        body.appendChild(ul);
      }
      var tip = el('div', '', 'Tip: usá AUTO o 1-CLICK PRO y el editor lo arregla solo en un click.');
      tip.style.cssText = 'opacity:.7;font-size:12px;background:rgba(255,255,255,.05);padding:8px 10px;border-radius:8px;'; body.appendChild(tip);
      box.appendChild(body);
      var ftr = el('div', ''); ftr.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;padding:14px 18px;border-top:1px solid rgba(255,255,255,.08);';
      var go = el('button', 'btn-ghost sm', 'Exportar igual →');
      var fix = el('button', 'btn-primary', '← Volver a arreglar');
      ftr.appendChild(go); ftr.appendChild(fix); box.appendChild(ftr);
      ov.appendChild(box); (document.getElementById('app') || document.body).appendChild(ov);
      function close(v) { try { ov.remove(); } catch (e) {} resolve(v); }
      fix.addEventListener('click', function () { close(false); });
      go.addEventListener('click', function () { close(true); });
      ov.addEventListener('click', function (e) { if (e.target === ov) close(false); });
    });
  }
  // UN SOLO botón Exportar: usa el motor RÁPIDO (WebCodecs acelerado) si el navegador lo soporta,
  // y cae al método clásico (tiempo real) solo en navegadores viejos. startExportFast ya hace ese fallback.
  function doExport() {
    if (ST.rendering || !ST.ready) return;
    openExportSettings();   // abre el panel CapCut (resolución/bitrate/codec/formato/fps) → "Exportar" corre runExportNow()
  }
  btnExport.addEventListener('click', doExport);

  // ════════════════ RED DE SEGURIDAD DEL EDITOR (v4.37.0) ════════════════
  // 100% ADITIVO: NO toca el render ni el export. Solo OBSERVA y AVISA. Dos cosas:
  //  (1) Fallos visibles: si algo se rompe (error no capturado), sale un aviso — en vez de
  //      "no hace nada" y que no sepas por qué.
  //  (2) Botón DESTRABAR: aparece SOLO mientras exportas; si la página se traba, destraba la
  //      interfaz sin tener que matar la pestaña a ciegas. (Tu trauma de "se traba y se cae".)
  function nspEdToast(msg, kind, ms) {
    try {
      var t = el('div', '', String(msg || ''));
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483600;'
        + 'max-width:520px;padding:12px 18px;border-radius:12px;font:13px/1.5 ui-monospace,monospace;text-align:center;'
        + 'box-shadow:0 12px 40px rgba(0,0,0,.5);color:#fff;'
        + (kind === 'warn' ? 'background:rgba(200,120,0,.96);' : kind === 'err' ? 'background:rgba(200,45,45,.96);' : 'background:rgba(20,30,45,.97);border:1px solid rgba(255,255,255,.16);');
      document.body.appendChild(t);
      setTimeout(function () { try { t.remove(); } catch (e) {} }, ms || 4800);
    } catch (e) {}
  }
  var _nspEdLastErr = 0;
  function _nspEdReportErr(detail) {
    try {
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      if (now - _nspEdLastErr < 2500) return;   // throttle: no inundar de toasts
      _nspEdLastErr = now;
      console.warn('[ZERACK editor] fallo:', detail);
      if (document.getElementById('nspBuildOv')) bbox('error-js', String(detail || 'error').slice(0, 140));
      nspEdToast('⚠ Algo falló: ' + String(detail || 'error').slice(0, 130) + ' — mirá la consola (F12). Si se queda raro, recargá la pestaña.', 'err', 6500);
    } catch (e) {}
  }
  window.addEventListener('error', function (ev) { try { _nspEdReportErr(ev && (ev.message || (ev.error && ev.error.message))); } catch (e) {} });
  window.addEventListener('unhandledrejection', function (ev) { try { _nspEdReportErr(ev && ev.reason && (ev.reason.message || ev.reason)); } catch (e) {} });

  // Botón DESTRABAR — reset SOLO de la interfaz (no detiene el encoder; por eso aconseja recargar).
  function nspUnstickExport() {
    try { ST.rendering = false; } catch (e) {}
    try { btnExport.disabled = false; btnExport.textContent = 'Exportar MP4'; } catch (e) {}
    try { if (renderProgress) renderProgress.hidden = true; if (rpFill) rpFill.style.width = '0%'; } catch (e) {}
    try { srcVideo.pause(); if (P) srcVideo.playbackRate = P.speed || 1; } catch (e) {}
    try { if (typeof restoreStageSize === 'function') restoreStageSize(); } catch (e) {}
    nspEdToast('Editor destrabado. Si el export seguía corriendo por dentro, recargá la pestaña (F5) para arrancar 100% limpio.', 'warn', 7000);
  }
  var _nspUnstickBtn = el('button', '', '⟲ ¿Trabado? Destrabar editor');
  _nspUnstickBtn.hidden = true;
  _nspUnstickBtn.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483600;padding:9px 14px;border-radius:10px;'
    + 'border:1px solid rgba(255,170,40,.6);background:rgba(60,40,0,.92);color:#ffd98a;font:12px ui-monospace,monospace;'
    + 'font-weight:800;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.5);';
  _nspUnstickBtn.addEventListener('click', nspUnstickExport);
  try { document.body.appendChild(_nspUnstickBtn); } catch (e) {}
  // Solo OBSERVA ST.rendering y togglea el botón. No interviene el export en absoluto.
  setInterval(function () { try { _nspUnstickBtn.hidden = !ST.rendering; } catch (e) {} }, 1200);

  // ════════════════════ PLANTILLAS DE EDICIÓN POR NICHO ════════════════════
  // Cada plantilla = el estilo de edición real que usan los canales ganadores de ese
  // nicho. La receta mapea al motor (color, zoom, captions, efectos). "Escanear" trae
  // ejemplos REALES del mercado vía InnerTube (SW). "Aplicar" carga la receta al editor.
  var TEMPLATES = [
    { emoji: '📜', niche: 'Historia / Documental', rpm: 'RPM ~$6', searchQ: 'history documentary explained',
      sig: 'Zoom lento sobre imágenes y pinturas (Ken Burns), color cálido cinematográfico, viñeta + grano de film y subtítulos discretos. Música épica de fondo.',
      chips: ['Cine cálido', 'Ken Burns', 'Viñeta + grano'],
      recipe: { grade: 'warm', kenBurns: true, kbIntensity: 0.5, pulse: false, pulseEvery: 24, vignette: false, grain: false, captions: true, capStyle: { size: 0.95, posY: 0.88, box: true } } },
    { emoji: '', niche: 'Finanzas / Negocios', rpm: 'RPM ~$22', searchQ: 'how to make money finance explained',
      sig: 'Cortes rápidos, subtítulos GRANDES animados, números en pantalla, color punch saturado y ritmo alto con punch-ins cada ~10s.',
      chips: ['Punch saturado', 'Subs grandes', 'Ritmo rápido'],
      recipe: { grade: 'punch', kenBurns: true, kbIntensity: 0.5, pulse: true, pulseEvery: 10, vignette: false, grain: false, captions: true, capStyle: { size: 1.25, posY: 0.8, box: true } } },
    { emoji: '🔦', niche: 'Misterio / Terror', rpm: 'RPM ~$4', searchQ: 'unsolved mystery scary documentary',
      sig: 'Atmósfera oscura, viñeta fuerte, color frío, zoom lento tenso, grano de film y flashes en las revelaciones.',
      chips: ['Frío / oscuro', 'Flashes', 'Tenso'],
      recipe: { grade: 'cold', kenBurns: true, kbIntensity: 0.45, pulse: false, pulseEvery: 22, vignette: false, grain: false, captions: true, capStyle: { size: 1, posY: 0.86, box: true } } },
    { emoji: '🗿', niche: 'Motivación / Estoicismo', rpm: 'RPM ~$5', searchQ: 'stoicism motivation speech',
      sig: 'Color blanco y negro o cine, zoom lento, frases grandes centradas y música épica en crescendo.',
      chips: ['Épico B&N', 'Texto centrado', 'Zoom lento'],
      recipe: { grade: 'noir', kenBurns: true, kbIntensity: 0.55, pulse: false, pulseEvery: 24, vignette: false, grain: false, captions: true, capStyle: { size: 1.1, posY: 0.85, box: false } } },
    { emoji: '🎮', niche: 'Reddit / Historias TTS', rpm: 'RPM ~$3', searchQ: 'reddit stories narrated',
      sig: 'Gameplay de fondo (Minecraft/Subway), subtítulos palabra-por-palabra GIGANTES centrados, ritmo marcado por la voz TTS.',
      chips: ['Subs gigantes', 'Gameplay BG', 'TTS'],
      recipe: { grade: 'vibrant', kenBurns: false, kbIntensity: 0.3, pulse: false, pulseEvery: 22, vignette: false, grain: false, captions: true, capStyle: { size: 1.4, posY: 0.5, box: true } } },
    { emoji: '🌌', niche: 'Ciencia / Espacio', rpm: 'RPM ~$6', searchQ: 'space science documentary explained',
      sig: 'Visuals tipo 4K, zoom lento, color frío cinematográfico, música ambiental y subtítulos limpios.',
      chips: ['Frío cine', 'Ambiental', 'Ken Burns'],
      recipe: { grade: 'cold', kenBurns: true, kbIntensity: 0.5, pulse: false, pulseEvery: 24, vignette: false, grain: false, captions: true, capStyle: { size: 0.95, posY: 0.88, box: true } } },
    { emoji: '🕵️', niche: 'True Crime', rpm: 'RPM ~$7', searchQ: 'true crime case documentary',
      sig: 'Serio, color frío desaturado, viñeta, fotos con zoom lento, subtítulos y música tensa.',
      chips: ['Desaturado', 'Serio', 'Zoom fotos'],
      recipe: { grade: 'cold', kenBurns: true, kbIntensity: 0.45, pulse: false, pulseEvery: 24, vignette: false, grain: false, captions: true, capStyle: { size: 1, posY: 0.87, box: true } } },
    { emoji: '🔟', niche: 'Top 10 / Listas', rpm: 'RPM ~$5', searchQ: 'top 10 facts countdown',
      sig: 'Un punch-in por cada item, números grandes, subtítulos, ritmo medio-alto y color vibrante.',
      chips: ['Punch x item', 'Vibrante', 'Números'],
      recipe: { grade: 'vibrant', kenBurns: true, kbIntensity: 0.5, pulse: true, pulseEvery: 9, vignette: false, grain: false, captions: true, capStyle: { size: 1.15, posY: 0.82, box: true } } },
    { emoji: '🤖', niche: 'Tech / IA', rpm: 'RPM ~$13', searchQ: 'ai tools tech explained',
      sig: 'Limpio y moderno, color vibrante, screen recordings con zoom suave y subtítulos modernos.',
      chips: ['Vibrante', 'Limpio', 'Moderno'],
      recipe: { grade: 'vibrant', kenBurns: true, kbIntensity: 0.4, pulse: true, pulseEvery: 14, vignette: false, grain: false, captions: true, capStyle: { size: 1.05, posY: 0.84, box: true } } },
    { emoji: '💎', niche: 'Lujo / Lifestyle', rpm: 'RPM ~$12', searchQ: 'luxury lifestyle billionaire',
      sig: 'Color cálido cinematográfico, zoom muy suave, mínimo texto y música lujosa.',
      chips: ['Cálido cine', 'Suave', 'Minimal'],
      recipe: { grade: 'warm', kenBurns: true, kbIntensity: 0.4, pulse: false, pulseEvery: 24, vignette: false, grain: false, captions: false, capStyle: { size: 1, posY: 0.88, box: false } } },
    { emoji: '🌊', niche: 'Naturaleza / ASMR', rpm: 'RPM ~$5', searchQ: 'relaxing nature 4k ambient',
      sig: 'Color vibrante, zoom muy lento, sin efectos agresivos y sin subtítulos (experiencia ambiental).',
      chips: ['Vibrante', 'Muy lento', 'Sin efectos'],
      recipe: { grade: 'vibrant', kenBurns: true, kbIntensity: 0.3, pulse: false, pulseEvery: 24, vignette: false, grain: false, captions: false, capStyle: { size: 1, posY: 0.88, box: true } } },
    { emoji: '🌙', niche: 'Historias para dormir', rpm: 'RPM ~$8', searchQ: 'sleep stories calm bedtime',
      sig: 'Ken Burns MUY lento sobre imágenes cálidas, brasas/cenizas de fuego que suben (vibe chimenea), color cálido suave, viñeta marcada y poco contraste para relajar. Sin pulsos ni cortes bruscos. Música ambiental.',
      chips: ['Brasas de fuego', 'Ken Burns lento', 'Cálido + viñeta'],
      recipe: { grade: 'warm', kenBurns: true, kbIntensity: 0.5, pulse: false, pulseEvery: 30, vignette: false, grain: false, embers: false, embersInt: 1, liveFilm: false, liveInt: 0.4, breath: true, transition: 'dip', captions: true, capStyle: { size: 1, posY: 0.86, box: true } } },
    { emoji: '✝️', niche: 'Religión / Biblia', rpm: 'RPM ~$5', searchQ: 'bible story explained',
      sig: 'Color cálido sereno, zoom lento, texto de versículos y música suave.',
      chips: ['Cálido sereno', 'Versículos', 'Zoom lento'],
      recipe: { grade: 'warm', kenBurns: true, kbIntensity: 0.45, pulse: false, pulseEvery: 24, vignette: false, grain: false, captions: true, capStyle: { size: 1.05, posY: 0.85, box: true } } }
  ];

  function openTab(url) { try { if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) { chrome.tabs.create({ url: url }); return; } } catch (e) {} try { window.open(url, '_blank', 'noopener'); } catch (e) {} }

  function renderExamples(slot, vids) {
    slot.textContent = '';
    var g = el('div', 'ex-grid');
    vids.forEach(function (v) {
      var it = el('div', 'ex-item');
      var img = document.createElement('img'); img.src = v.thumbnail || ''; img.loading = 'lazy'; img.alt = '';
      var meta = el('div', 'ex-meta'); meta.appendChild(el('div', 'ex-title', v.title || ''));
      var n = Number(v.views) || 0; var vv = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M views' : n >= 1e3 ? Math.round(n / 1e3) + 'K views' : (n ? n + ' views' : '');
      meta.appendChild(el('div', 'ex-views', vv));
      it.appendChild(img); it.appendChild(meta);
      it.addEventListener('click', function () { var id = ''; try { var m = String(v.thumbnail || '').match(/\/vi\/([^/]+)/); if (m) id = m[1]; } catch (e) {} openTab(id ? ('https://www.youtube.com/watch?v=' + id) : ('https://www.youtube.com/results?search_query=' + encodeURIComponent(v.title || ''))); });
      g.appendChild(it);
    });
    slot.appendChild(g);
  }

  function scanExamples(tpl, slot, btn, cb) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) { slot.textContent = ''; slot.appendChild(el('div', 'ex-loading', 'Escaneo no disponible (abrí esta app desde la extensión).')); if (cb) cb(); return; }
    slot.textContent = ''; slot.appendChild(el('div', 'ex-loading', '🛰️ Escaneando el mercado…')); if (btn) btn.disabled = true;
    try {
      chrome.runtime.sendMessage({ type: 'NSP_AGENT_SEARCH_MARKET', query: tpl.searchQ, gl: 'US', hl: 'en' }, function (res) {
        if (btn) btn.disabled = false;
        if ((chrome.runtime && chrome.runtime.lastError) || !res || !res.ok || !res.videos || !res.videos.length) { slot.textContent = ''; slot.appendChild(el('div', 'ex-loading', 'No se pudieron traer ejemplos ahora. Reintentá.')); }
        else renderExamples(slot, res.videos.slice(0, 4));
        if (cb) cb();
      });
    } catch (e) { if (btn) btn.disabled = false; slot.textContent = ''; slot.appendChild(el('div', 'ex-loading', 'Error de escaneo.')); if (cb) cb(); }
  }

  function scanAllMarket() {
    if (typeof chrome === 'undefined' || !chrome.runtime) { tplScanStatus.textContent = 'Abrí la app desde la extensión para escanear.'; return; }
    btnScanAll.disabled = true; var i = 0;
    function next() {
      if (i >= TEMPLATES.length) { tplScanStatus.textContent = 'Mercado escaneado (' + TEMPLATES.length + ' nichos)'; btnScanAll.disabled = false; return; }
      tplScanStatus.textContent = 'Escaneando ' + (i + 1) + '/' + TEMPLATES.length + ' — ' + TEMPLATES[i].niche + '…';
      var slot = $('exslot-' + i);
      if (!slot) { i++; next(); return; }
      scanExamples(TEMPLATES[i], slot, null, function () { i++; setTimeout(next, 350); });
    }
    next();
  }

  function buildTemplatesView() {
    if (_tplBuilt) return; _tplBuilt = true;
    tplGrid.textContent = '';
    TEMPLATES.forEach(function (tpl, idx) {
      var card = el('div', 'tpl-card'); card.setAttribute('data-tpl-idx', idx);
      var head = el('div', 'tpl-card-head'); head.appendChild(el('div', 'tpl-emoji', tpl.emoji));
      var hd = el('div'); hd.appendChild(el('div', 'tpl-niche', tpl.niche)); hd.appendChild(el('div', 'tpl-rpm', tpl.rpm)); head.appendChild(hd); card.appendChild(head);
      card.appendChild(el('div', 'tpl-sig', tpl.sig));
      var chips = el('div', 'tpl-chips'); tpl.chips.forEach(function (c) { chips.appendChild(el('span', 'tpl-chip', c)); }); card.appendChild(chips);
      var slot = el('div'); slot.id = 'exslot-' + idx; card.appendChild(slot);
      var act = el('div', 'tpl-actions');
      var bScan = el('button', 'tpl-scan-btn', '🔎 Ejemplos reales'); bScan.addEventListener('click', function () { scanExamples(tpl, slot, bScan); });
      var bApply = el('button', 'tpl-apply-btn', '✨ Aplicar'); bApply.addEventListener('click', function () { applyTemplate(tpl); });
      act.appendChild(bScan); act.appendChild(bApply); card.appendChild(act);
      tplGrid.appendChild(card);
    });
  }

  function applyTemplate(tpl) {
    if (!ST.ready) {
      pendingTemplate = tpl; showView('load');
      try { var t = drop.querySelector('.drop-title'); if (t) t.textContent = 'Subí tu video — se aplica la plantilla "' + tpl.niche + '"'; } catch (e) {}
      return;
    }
    var r = tpl.recipe;
    P.mode = 'auto'; P._kf = true;   // motor de keyframes ON (repaint() al final regenera P.tracks)
    P.texts = []; P.flashes = []; P.zooms = [];   // limpiar elementos manuales viejos antes de aplicar la plantilla
    P.grade = r.grade; P.kenBurns = r.kenBurns; P.kbIntensity = r.kbIntensity; P.pulse = r.pulse; P.pulseEvery = r.pulseEvery;
    // GRADE A MEDIDA: si la receta trae el color REAL medido del video extraído, lo registramos y lo usamos
    // (en vez de un preset genérico). Esto es lo que hace que el estilo extraído SE PAREZCA al original.
    if (r.customGrade && r.customGrade.filter) { GRADES.custom = { label: 'A medida', filter: r.customGrade.filter, wash: r.customGrade.wash || null }; P.grade = 'custom'; }
    P.vignette = !!r.vignette; P.grain = !!r.grain; P.shake = !!r.shake;
    P.embers = P.embers || { on: false, intensity: 0.6 };   // defensivo: proyectos viejos pueden no tenerlo
    P.embers.on = !!r.embers; if (r.embersInt) P.embers.intensity = r.embersInt;   // brasas/cenizas (historias para dormir)
    if (r.liveFilm) { P.liveFilm = P.liveFilm || { on: false, intensity: 0.6, secs: 0, particles: true, lightRay: false, dust: true }; P.liveFilm.on = true; P.liveFilm.lightRay = false; P.liveFilm.intensity = r.liveInt || 0.5; }   // dust/cenizas SÍ (sleep stories), pero rayo de luz NO ("rayas" que el usuario odia)
    // KEN BURNS visible: respiración (zoom lento continuo que nunca para) + movimiento por-toma. Sin esto el Ken Burns
    // queda tan sutil que "no se nota". Clave en sleep stories (lentas). Solo si la receta lo pide (r.breath).
    P.breath = P.breath || { on: false, amt: 0.06, period: 5 };
    P.breath.on = !!r.breath; if (r.breath) { P.breath.amt = 0.05; P.breath.period = 6; }   // respiración suave y lenta (relax)
    // RITMO DEL EDIT: si la receta trae el ritmo de cortes del video fuente (shotSecs), lo aplicamos →
    // el Ken Burns y las transiciones ocurren a ESE ritmo (rápido o lento) = replica el pacing del edit.
    if (r.kenBurns) { P.shotMode = true; P._autoTouchedShot = true; if (r.shotSecs && r.shotSecs >= 1.2) P.shotSecs = r.shotSecs; else if (!P.shotSecs) P.shotSecs = 5; }
    P.transition = r.transition || 'mix';
    P.shotTrans = true; P.shotTransKind = (r.transition && r.transition !== 'mix') ? r.transition : 'mix';   // transición EN CADA corte, del tipo del video fuente
    P.transEvery = (r.shotSecs && r.shotSecs >= 1.2) ? Math.max(2, Math.round(r.shotSecs)) : (P.transEvery || 4);
    P.transitions = P.shotMode ? genShotTransitions() : genTransitions();   // por-corte al ritmo del fuente (o global si no hay shotMode)
    if (P.fx) { P.fx.lightLeak = false; }   // las plantillas no encienden la fuga de luz (el usuario odia las "rayas"); queda como toggle manual en Efectos
    if (r.capStyle) { if (r.capStyle.size) P.capStyle.size = r.capStyle.size; if (r.capStyle.posY) P.capStyle.posY = r.capStyle.posY; if (typeof r.capStyle.box === 'boolean') P.capStyle.box = r.capStyle.box; }
    if (r.capTpl) { try { applyCapTemplate(r.capTpl); } catch (e) {} if (r.capFont) P.capStyle.font = r.capFont; if (typeof r.capUpper === 'boolean') P.capStyle.upper = r.capUpper; if (r.capColor && P.capStyle) P.capStyle.color = r.capColor; }   // estilo extraído: plantilla + color de subtítulos del video fuente
    P.captions = r.captions ? genCaptions() : [];
    modeBadge.textContent = 'AUTO'; btnModeAuto.classList.add('active'); btnModeManual.classList.remove('active');
    showView('editor'); setTool('auto'); repaint(); renderTimeline();
    var _ms = computeMonetScore();
    $('footNote').textContent = '✨ Plantilla "' + tpl.niche + '" aplicada — efectividad ' + _ms.score + '/100 (' + _ms.verdict + ')';
    previewBurst();
  }

  // ════════════════════ STYLE LAB — EXTRACTOR DE ESTILO POR URL ════════════════════
  // Pegás el link de un video → leo miniatura (paleta/contraste/look) + título (nicho/gancho) + IA visión (Gemini)
  // → armo una plantilla de edición (grade, subtítulos, transición, ritmo) que aplicás a tus videos.
  var _curStyle = null;
  function setStyleStatus(m) { var s = $('styleStatus'); if (s) s.textContent = m || ''; }
  function parseYtId(url) {
    url = String(url || '').trim();
    // todos los formatos: watch?v=, youtu.be/, shorts/, embed/, live/, /v/ y el de YouTube Studio (/video/ID/edit)
    var m = url.match(/(?:youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|\/v\/|\/video\/|[?&]v=)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;   // ID pelado
    // último recurso: cualquier token de 11 chars en un link de YouTube que NO sea de canal
    if (/youtu/i.test(url) && !/\/(@|channel\/|c\/|user\/)/i.test(url)) { var a = url.match(/[A-Za-z0-9_-]{11}/); if (a) return a[0]; }
    return '';
  }
  function swFetchText(url) {
    return new Promise(function (res) {
      try { chrome.runtime.sendMessage({ type: 'NSP_AGENT_FETCH_URL', url: url }, function (r) { if (chrome.runtime && chrome.runtime.lastError) return res(null); res(r && r.ok ? r.text : null); }); }
      catch (e) { res(null); }
    });
  }
  // Trae la TRANSCRIPCIÓN (subtítulos) del video vía el service worker → {ok, segments, text, lang, title} o null.
  function swTranscript(id) {
    return new Promise(function (res) {
      try { chrome.runtime.sendMessage({ type: 'NSP_FETCH_TRANSCRIPT', videoId: id }, function (r) { if (chrome.runtime && chrome.runtime.lastError) return res(null); res(r && r.ok ? r : null); }); }
      catch (e) { res(null); }
    });
  }
  function swStoryboard(id) {
    return new Promise(function (res) {
      try { chrome.runtime.sendMessage({ type: 'NSP_FETCH_STORYBOARD', videoId: id }, function (r) { if (chrome.runtime && chrome.runtime.lastError) return res(null); res(r && r.ok ? r : null); }); }
      catch (e) { res(null); }
    });
  }
  // MIDE EL EDIT desde el storyboard de YouTube (decenas de fotogramas reales de TODO el video):
  // ritmo de cortes (frame-diff por encima del promedio = corte) + movimiento. → {cutSeconds, motion} o null.
  function analyzeStoryboard(id) {
    return swStoryboard(id).then(function (sb) {
      if (!sb || !sb.sprites || !sb.sprites.length) return null;
      return Promise.all(sb.sprites.map(function (u) { return fetchOneImg(u).then(function (r) { return r.bitmap; }).catch(function () { return null; }); }))
        .then(function (bmps) {
          bmps = bmps.filter(Boolean); if (!bmps.length) return null;
          var SW = 16, SH = 9, cv = document.createElement('canvas'); cv.width = SW; cv.height = SH; var cx = cv.getContext('2d');
          var sigs = [];
          bmps.forEach(function (bm) {
            for (var ry = 0; ry < sb.rows; ry++) for (var ci = 0; ci < sb.cols; ci++) {
              if (sigs.length >= sb.total) break;
              try { cx.drawImage(bm, ci * sb.tileW, ry * sb.tileH, sb.tileW, sb.tileH, 0, 0, SW, SH); sigs.push(new Uint8ClampedArray(cx.getImageData(0, 0, SW, SH).data)); } catch (e) {}
            }
          });
          if (sigs.length < 5) return null;
          function fdiff(a, b) { var s = 0, n = a.length / 4; for (var i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / n / 3; }
          var diffs = []; for (var i = 1; i < sigs.length; i++) diffs.push(fdiff(sigs[i - 1], sigs[i]));
          var avg = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length, thr = Math.max(16, avg * 1.7);
          var cuts = diffs.filter(function (d) { return d > thr; }).length;
          var spanSec = (sigs.length * (sb.interval || 2000)) / 1000;
          var cutSeconds = cuts > 0 ? clamp(spanSec / cuts, 1.2, 10) : 0;
          var nonCut = diffs.filter(function (d) { return d <= thr; });
          var mAvg = nonCut.length ? nonCut.reduce(function (a, b) { return a + b; }, 0) / nonCut.length : avg;
          var motion = mAvg < 4 ? 'bajo' : mAvg > 11 ? 'alto' : 'medio';
          return { cutSeconds: Math.round(cutSeconds * 10) / 10, motion: motion, cuts: cuts, frames: sigs.length };
        });
    }).catch(function () { return null; });
  }
  function blobToDataUrl(b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(b); }); }
  function fetchOneImg(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (b) {
      if (b.size < 1800) throw 0;   // placeholder gris diminuto
      return Promise.all([createImageBitmap(b), blobToDataUrl(b)]).then(function (a) { return { bitmap: a[0], dataUrl: a[1], url: url }; });
    });
  }
  // ESCANEA EL VIDEO POR DENTRO: portada + 3 fotogramas reales (inicio/medio/final que YouTube expone como hq1/2/3.jpg).
  function fetchFrames(id) {
    var cover = ['https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg', 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'];
    var inside = ['https://i.ytimg.com/vi/' + id + '/hq1.jpg', 'https://i.ytimg.com/vi/' + id + '/hq2.jpg', 'https://i.ytimg.com/vi/' + id + '/hq3.jpg'];
    function firstOk(list, k) { if (k >= list.length) return Promise.resolve(null); return fetchOneImg(list[k]).catch(function () { return firstOk(list, k + 1); }); }
    return firstOk(cover, 0).then(function (cov) {
      return Promise.all(inside.map(function (u) { return fetchOneImg(u).catch(function () { return null; }); })).then(function (ins) {
        var frames = []; if (cov) frames.push(cov); ins.forEach(function (f) { if (f) frames.push(f); });
        return frames;   // [portada, frame25%, frame50%, frame75%] (los que existan)
      });
    });
  }
  function paletteOfFrames(frames) {
    // combina la paleta/look de TODOS los fotogramas (representa el video, no solo la portada)
    var buckets = {}, sumL = 0, sumL2 = 0, sumS = 0, n = 0;
    frames.forEach(function (fr) {
      var bm = fr.bitmap, W = 100, H = Math.max(40, Math.round(W * (bm.height || 9) / (bm.width || 16)));
      var c = document.createElement('canvas'); c.width = W; c.height = H; var cx = c.getContext('2d'); cx.drawImage(bm, 0, 0, W, H);
      var d; try { d = cx.getImageData(0, 0, W, H).data; } catch (e) { return; }
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2], L = 0.299 * r + 0.587 * g + 0.114 * b;
        sumL += L; sumL2 += L * L; var mx = Math.max(r, g, b), mn = Math.min(r, g, b); sumS += mx ? (mx - mn) / mx : 0; n++;
        var key = (r >> 6) + ',' + (g >> 6) + ',' + (b >> 6);
        if (!buckets[key]) buckets[key] = { c: 0, r: 0, g: 0, b: 0 };
        var bk = buckets[key]; bk.c++; bk.r += r; bk.g += g; bk.b += b;
      }
    });
    if (!n) return { palette: [], brightness: 128, contrast: 0, sat: 0 };
    var arr = Object.keys(buckets).map(function (k) { var bk = buckets[k]; return { c: bk.c, r: Math.round(bk.r / bk.c), g: Math.round(bk.g / bk.c), b: Math.round(bk.b / bk.c) }; }).sort(function (a, b) { return b.c - a.c; }).slice(0, 6);
    var hex = function (v) { return ('0' + v.toString(16)).slice(-2); };
    var pal = arr.map(function (x) { return '#' + hex(x.r) + hex(x.g) + hex(x.b); });
    var meanL = sumL / n, stdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
    return { palette: pal, brightness: Math.round(meanL), contrast: Math.round(stdL), sat: Math.round(sumS / n * 100) };
  }
  function paletteOf(bitmap) {
    var W = 120, H = Math.max(40, Math.round(W * (bitmap.height || 9) / (bitmap.width || 16)));
    var c = document.createElement('canvas'); c.width = W; c.height = H; var cx = c.getContext('2d'); cx.drawImage(bitmap, 0, 0, W, H);
    var d; try { d = cx.getImageData(0, 0, W, H).data; } catch (e) { return { palette: [], brightness: 128, contrast: 0, sat: 0 }; }
    var buckets = {}, sumL = 0, sumL2 = 0, sumS = 0, n = W * H;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], L = 0.299 * r + 0.587 * g + 0.114 * b;
      sumL += L; sumL2 += L * L; var mx = Math.max(r, g, b), mn = Math.min(r, g, b); sumS += mx ? (mx - mn) / mx : 0;
      var key = (r >> 6) + ',' + (g >> 6) + ',' + (b >> 6);
      if (!buckets[key]) buckets[key] = { c: 0, r: 0, g: 0, b: 0 };
      var bk = buckets[key]; bk.c++; bk.r += r; bk.g += g; bk.b += b;
    }
    var arr = Object.keys(buckets).map(function (k) { var bk = buckets[k]; return { c: bk.c, r: Math.round(bk.r / bk.c), g: Math.round(bk.g / bk.c), b: Math.round(bk.b / bk.c) }; }).sort(function (a, b) { return b.c - a.c; }).slice(0, 6);
    var hex = function (v) { return ('0' + v.toString(16)).slice(-2); };
    var pal = arr.map(function (x) { return '#' + hex(x.r) + hex(x.g) + hex(x.b); });
    var meanL = sumL / n, stdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
    return { palette: pal, brightness: Math.round(meanL), contrast: Math.round(stdL), sat: Math.round(sumS / n * 100) };
  }
  function gradeFromLook(look) {
    if (look.brightness < 80) return 'noir';
    if (look.sat > 45 && look.brightness > 120) return 'vibrant';
    if (look.brightness > 155) return 'warm';
    return 'cinematic';
  }
  function hexToRgb(h) {
    h = String(h || '').replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16); return isFinite(n) ? { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 } : { r: 128, g: 128, b: 128 };
  }
  // GRADE A MEDIDA: en vez de un preset genérico, reproduce el COLOR REAL medido del video fuente
  // (brillo/contraste/saturación) + un tinte del color dominante. Esto es lo que hace que el estilo
  // extraído de verdad SE PAREZCA al video, no que salga un "Cine" genérico.
  function buildCustomGrade(look) {
    if (!look) return null;
    var br = look.brightness == null ? 128 : look.brightness;
    var ct = look.contrast == null ? 40 : look.contrast;
    var sat = look.sat == null ? 30 : look.sat;
    var bright = clamp(0.84 + (br - 110) / 255 * 0.55, 0.78, 1.18);
    var contrast = clamp(0.96 + (ct - 38) / 55 * 0.50, 0.90, 1.50);
    var saturate = clamp(0.85 + (sat - 28) / 55 * 0.85, 0.55, 1.70);
    var filter = 'brightness(' + bright.toFixed(3) + ') contrast(' + contrast.toFixed(3) + ') saturate(' + saturate.toFixed(3) + ')';
    var pal = look.palette || [], wash = null;
    if (pal.length) {
      var a = hexToRgb(pal[0]), b = pal[1] ? hexToRgb(pal[1]) : a;
      var rr = Math.round((a.r + b.r) / 2), gg = Math.round((a.g + b.g) / 2), bb = Math.round((a.b + b.b) / 2);
      var amt = clamp(0.05 + (sat / 100) * 0.13, 0.04, 0.20);   // más tinte si la fuente está más coloreada
      wash = 'rgba(' + rr + ',' + gg + ',' + bb + ',' + amt.toFixed(3) + ')';
    }
    return { label: 'A medida', filter: filter, wash: wash };
  }
  // IA VISIÓN sobre VARIOS fotogramas del video → analiza CÓMO ESTÁ EDITADO por dentro.
  function styleVision(geminiKey, dataUrls, title, look) {
    var parts = [];
    (dataUrls || []).slice(0, 4).forEach(function (du) { var b64 = String(du || '').split(',')[1]; if (b64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } }); });
    if (!parts.length) return Promise.resolve(null);
    var meas = look ? ('\nMEDIDAS REALES de color (ya calculadas de los píxeles, usalas como verdad): brillo=' + look.brightness + '/255, contraste=' + look.contrast + ', saturación=' + look.sat + '%, paleta dominante=' + (look.palette || []).slice(0, 4).join(' ') + '.') : '';
    parts.push({ text: 'Estos son FOTOGRAMAS REALES de un mismo video de YouTube (portada + momentos del inicio/medio/final) y su TÍTULO.' + meas + '\nAnalizá CÓMO ESTÁ EDITADO POR DENTRO (el EDIT, no solo el color) y devolvé SOLO un JSON (sin texto extra):\n' +
      '{"niche":"","vibe":"","footage":"ai-images|stock|gameplay|talking-head|text-cards|mixed","grade":"cinematic|warm|cold|vibrant|noir|punch","captionTemplate":"capcut|karaoke|hormozi|mrbeast|clasico|neon|doc|tiktok|noticias|retro","captionSize":"chico|medio|grande","capColor":"#RRGGBB del texto de los subtítulos","font":"black|impact|trebu|verdana|georgia|mono","upper":true,"transition":"slidedown|dip|flash|zoomblur|whip|mix","pacing":"lento|medio|rapido","cutSeconds":3.0,"motion":"bajo|medio|alto","embers":false,"liveFilm":true,"hookFormula":""}\n' +
      '"cutSeconds" = cada cuántos segundos aprox. cambia la imagen/corte (estimá: lento 5-8, medio 3-4, rápido 1.5-2.5). "motion" = cuánto se mueve la cámara/zoom. "capColor" = color del texto de los subtítulos en hex. Fijate de verdad en los subtítulos (tamaño/posición/color), el tipo de material y el ritmo de cortes. Título: "' + String(title || '').slice(0, 140) + '"' });
    var body = { contents: [{ parts: parts }], generationConfig: { temperature: 0.3 } };
    var models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'], i = 0;
    return new Promise(function (resolve) {
      (function tryM() {
        if (i >= models.length) return resolve(null);
        var m = models[i++];
        fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(geminiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (j) { var t = ''; try { t = j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join(''); } catch (e) {} var jm = t.match(/\{[\s\S]*\}/); if (!jm) return tryM(); try { resolve(JSON.parse(jm[0])); } catch (e) { tryM(); } })
          .catch(function () { tryM(); });
      })();
    });
  }
  function buildStyle(id, meta, frames, look, ai) {
    ai = ai || {};
    var inList = function (v, arr, def) { return arr.indexOf(v) >= 0 ? v : def; };
    var capSize = ai.captionSize === 'chico' ? 0.8 : ai.captionSize === 'grande' ? 1.25 : 1;
    return {
      id: 'st_' + id, src: id, title: meta.title || '', author: meta.author_name || '',
      thumb: (frames[0] && frames[0].dataUrl) || '', frames: frames.map(function (f) { return f.dataUrl; }),
      look: look, niche: ai.niche || '', vibe: ai.vibe || '', footage: ai.footage || '',
      grade: inList(ai.grade, ['cinematic', 'warm', 'cold', 'vibrant', 'noir', 'punch'], gradeFromLook(look)),
      captionTemplate: inList(ai.captionTemplate, ['capcut', 'karaoke', 'hormozi', 'mrbeast', 'clasico', 'neon', 'doc', 'tiktok', 'noticias', 'retro'], 'capcut'),
      capSize: capSize, font: inList(ai.font, ['black', 'impact', 'trebu', 'verdana', 'tahoma', 'georgia', 'mono', 'comic'], 'black'),
      transition: inList(ai.transition, ['slidedown', 'dip', 'flash', 'zoomblur', 'whip', 'mix'], 'slidedown'),
      upper: ai.upper !== false, pacing: inList(ai.pacing, ['lento', 'medio', 'rapido'], 'medio'),
      cutSeconds: (typeof ai.cutSeconds === 'number' && ai.cutSeconds > 0) ? ai.cutSeconds : 0,
      motion: inList(ai.motion, ['bajo', 'medio', 'alto'], ''),
      capColor: (/^#?[0-9a-fA-F]{6}$/.test(String(ai.capColor || '')) ? (String(ai.capColor)[0] === '#' ? ai.capColor : '#' + ai.capColor) : ''),
      embers: !!ai.embers, liveFilm: ai.liveFilm !== false, hookFormula: ai.hookFormula || '', ai: !!ai.niche
    };
  }
  function styleToRecipe(s) {
    // movimiento de cámara: según lo detectado (motion) o el pacing
    var kb = s.motion === 'alto' ? 0.62 : s.motion === 'bajo' ? 0.30 : (s.pacing === 'lento' ? 0.32 : s.pacing === 'rapido' ? 0.6 : 0.45);
    var pulse = s.pacing === 'rapido' || s.motion === 'alto';
    // ritmo de cortes REAL → segundos por toma (lo que hace que el EDIT calce, no solo el color)
    var cut = (s.cutSeconds && s.cutSeconds > 0.8) ? clamp(s.cutSeconds, 1.5, 8) : (s.pacing === 'lento' ? 5 : s.pacing === 'rapido' ? 2 : 3.5);
    var cg = null; try { cg = buildCustomGrade(s.look); } catch (e) {}   // grade A MEDIDA con el color real medido
    return {
      grade: cg ? 'custom' : s.grade, customGrade: cg, shotSecs: Math.round(cut * 10) / 10,
      kenBurns: true, kbIntensity: kb, pulse: pulse, pulseEvery: pulse ? 10 : 24,
      vignette: (s.grade === 'noir' || s.grade === 'cinematic' || s.grade === 'warm'), grain: s.grade !== 'vibrant',
      embers: !!s.embers, embersInt: 0.7, liveFilm: !!s.liveFilm, liveInt: 0.5,
      transition: (s.transition === 'mix' ? 'mix' : s.transition), captions: true,
      capStyle: { size: (s.capSize || 1), posY: 0.84, box: true }, capTpl: s.captionTemplate, capFont: s.font, capUpper: s.upper, capColor: s.capColor || ''
    };
  }
  // ── IA de TEXTO (Groq → Gemini) para escribir guion + título en el estilo extraído ──
  function aiTextGemini(key, prompt) {
    if (!key || !/^AIza/.test(key)) return Promise.resolve('');
    var models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'], i = 0;
    return new Promise(function (resolve) {
      (function t() {
        if (i >= models.length) return resolve('');
        var m = models[i++];
        fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.85 } }) })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (j) { var tx = ''; try { tx = j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join(''); } catch (e) {} if (!tx) return t(); resolve(tx); })
          .catch(function () { t(); });
      })();
    });
  }
  function aiText(prompt) {
    return getAIKeys().then(function (k) {
      if (k.groq && /^gsk_/.test(k.groq)) {
        return fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + k.groq, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', temperature: 0.85, messages: [{ role: 'user', content: prompt }] }) })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (j) { return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; })
          .catch(function () { return aiTextGemini(k.gemini, prompt); });
      }
      return aiTextGemini(k.gemini, prompt);
    });
  }
  function aiGenerateScript(style, topic) {
    var prompt = 'Sos guionista de YouTube faceless de un canal estilo "' + (style.niche || 'general') + '"' + (style.vibe ? (' (' + style.vibe + ')') : '') + '.\n' +
      'Gancho del canal: ' + (style.hookFormula || 'enganchar fuerte en los primeros 3 segundos') + '.\n' +
      'TEMA del video: "' + topic + '".\n' +
      'La NARRACIÓN ("t") va en el MISMO idioma del TEMA. El "img" es un PROMPT EN INGLÉS para generar la imagen de esa escena: describila visualmente, cinematográfica, concreta, SIN texto.\n' +
      'Devolvé SOLO JSON válido, sin texto adicional:\n' +
      '{"title":"título viral corto con gancho","items":[{"t":"frase de narración (gancho)","img":"english cinematic image prompt"},{"t":"…","img":"…"}]}  — entre 10 y 16 items, frases cortas (una idea por frase).';
    return aiText(prompt).then(function (t) {
      var jm = String(t || '').match(/\{[\s\S]*\}/); if (!jm) throw new Error('La IA no devolvió un guion (¿tenés API key de Groq o Gemini en Opciones?).');
      var o; try { o = JSON.parse(jm[0]); } catch (e) { throw new Error('No pude leer el guion de la IA. Reintentá.'); }
      var items = o.items || o.scenes || [], scenes = [], imgs = [];
      items.forEach(function (it) {
        if (typeof it === 'string') { var s = it.trim(); if (s) { scenes.push(s); imgs.push(''); } }
        else if (it && it.t) { scenes.push(String(it.t).trim()); imgs.push(String(it.img || '').trim()); }
      });
      if (!scenes.length) throw new Error('La IA no generó escenas. Reintentá.');
      return { title: String(o.title || topic).trim(), scenes: scenes, imgs: imgs };
    });
  }
  // REMAKE: toma la TRANSCRIPCIÓN real del video y la REESCRIBE en el estilo (mismo tema/estructura/ritmo,
  // pero con otras palabras — NO copia textual, así evita strike/desmonetización). Es lo que hacen las apps
  // tipo Kapwing: el "secreto" es el guion del video, no clonar el corte exacto.
  function aiRemakeScript(style) {
    var tr = style.transcript;
    if (!tr || !tr.text) return Promise.reject(new Error('Este video no tiene subtítulos/transcripción disponibles para remakear. Probá con otro video (o escribí un tema).'));
    var src = String(tr.text).slice(0, 8000);
    var prompt = 'Sos guionista de YouTube faceless. Te paso la TRANSCRIPCIÓN de un video que funciona; hacé un REMAKE en el MISMO tema, estructura y ritmo PERO REESCRITO con tus propias palabras (NO copies frases textuales: reformulá todo, mismo mensaje y orden de ideas). Estilo del canal: ' + (style.niche || 'general') + (style.vibe ? (' (' + style.vibe + ')') : '') + '.\n' +
      'La narración ("t") va en el MISMO idioma de la transcripción. El "img" es un PROMPT EN INGLÉS, cinematográfico y concreto, SIN texto, para generar la imagen de esa escena.\n' +
      'TRANSCRIPCIÓN ORIGINAL:\n"""' + src + '"""\n\n' +
      'Devolvé SOLO JSON válido: {"title":"título viral nuevo (no el original)","items":[{"t":"narración reescrita (frase corta)","img":"english cinematic image prompt, no text"}]}. Entre 12 y 20 items. NADA fuera del JSON.';
    return aiText(prompt).then(function (t) {
      var jm = String(t || '').match(/\{[\s\S]*\}/); if (!jm) throw new Error('La IA no devolvió el remake (¿tenés API key de Groq o Gemini en Opciones?).');
      var o; try { o = JSON.parse(jm[0]); } catch (e) { throw new Error('No pude leer el remake. Reintentá.'); }
      var items = o.items || o.scenes || [], scenes = [], imgs = [];
      items.forEach(function (it) { if (typeof it === 'string') { var s = it.trim(); if (s) { scenes.push(s); imgs.push(''); } } else if (it && it.t) { scenes.push(String(it.t).trim()); imgs.push(String(it.img || '').trim()); } });
      if (!scenes.length) throw new Error('El remake salió vacío. Reintentá.');
      return { title: String(o.title || style.title || 'Remake').trim(), scenes: scenes, imgs: imgs };
    });
  }
  // ── TARJETAS DE TEXTO: una imagen 1080p por frase, con la paleta del canal → video sin material propio ──
  function wrapTextCanvas(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function makeOneCard(txt, style, i) {
    var pal = (style.look && style.look.palette && style.look.palette.length) ? style.look.palette : ['#0b0f14', '#1a2230'];
    var c1 = pal[0] || '#0b0f14', c2 = pal[Math.min(2, pal.length - 1)] || '#1a2230';
    var fontStack = capFontStack(style.font || 'black');
    return new Promise(function (res) {
      var W = 1920, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
      var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, W, H);
      var rg = x.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
      var t = style.upper ? String(txt).toUpperCase() : String(txt);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      var fs = 72, lines;   // moderado (antes 110 = gigante a toda pantalla)
      for (var k = 0; k < 50; k++) { x.font = '900 ' + fs + 'px ' + fontStack; lines = wrapTextCanvas(x, t, W * 0.78); if (lines.length * fs * 1.25 <= H * 0.5 || fs <= 30) break; fs -= 3; }
      var lh = fs * 1.2, total = lines.length * lh, sy = H / 2 - total / 2 + lh / 2;
      lines.forEach(function (ln, li) { var yy = sy + li * lh; x.lineWidth = Math.max(4, fs * 0.14); x.strokeStyle = 'rgba(0,0,0,0.9)'; x.strokeText(ln, W / 2, yy); x.fillStyle = '#ffffff'; x.fillText(ln, W / 2, yy); });
      cv.toBlob(function (b) { res(new File([b], 'card' + ('00' + (i + 1)).slice(-3) + '.png', { type: 'image/png' })); }, 'image/png');
    });
  }
  function makeTextCards(scenes, style) { return Promise.all(scenes.map(function (t, i) { return makeOneCard(t, style, i); })); }

  // ── IMÁGENES POR IA (Pollinations — texto→imagen, GRATIS y sin API key) ──
  function styleImageHint(style) {
    var moods = { cinematic: 'cinematic, dramatic lighting, depth of field', warm: 'warm golden tones, cozy', cold: 'cold blue tones, moody', vibrant: 'vibrant saturated colors', noir: 'black and white, high contrast, film noir', punch: 'bold high-contrast, vivid' };
    var bits = [moods[style.grade] || 'cinematic', 'highly detailed', 'photorealistic'];
    if (style.vibe) bits.push(style.vibe);
    if (style.niche) bits.push(style.niche);
    bits.push('no text, no watermark, no caption');
    return bits.join(', ');
  }
  function fetchWithTimeout(url, ms, opts) { return new Promise(function (res, rej) { var to = setTimeout(function () { rej(new Error('timeout')); }, ms); fetch(url, opts || {}).then(function (r) { clearTimeout(to); res(r); }, function (e) { clearTimeout(to); rej(e); }); }); }
  function b64ToFile(b64, mime, idx) { var bin = atob(b64), arr = new Uint8Array(bin.length); for (var z = 0; z < bin.length; z++) arr[z] = bin.charCodeAt(z); return new File([arr], 'img' + ('00' + (idx + 1)).slice(-3) + (/png/.test(mime || '') ? '.png' : '.jpg'), { type: mime || 'image/png' }); }
  // GENERADOR PRINCIPAL: Gemini (con tu key) → modelo de imágenes. Devuelve File o rechaza.
  var _lastImgErr = '';   // último error de generación de imagen (para diagnóstico en pantalla)
  function genImageGemini(key, prompt, style, idx) {
    var full = (prompt + ', ' + styleImageHint(style)).replace(/\s+/g, ' ').trim().slice(0, 500);
    var body = { contents: [{ parts: [{ text: 'Generate ONE 16:9 cinematic image (no text or letters inside the image). ' + full }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
    // orden: el preview de 2.0 suele estar habilitado en el tier gratis; luego los 2.5 (Nano Banana)
    var models = ['gemini-2.0-flash-preview-image-generation', 'gemini-2.5-flash-image-preview', 'gemini-2.5-flash-image'], i = 0, lastErr = '';
    return new Promise(function (resolve, reject) {
      (function tryM() {
        if (i >= models.length) { _lastImgErr = lastErr || 'sin imagen'; return reject(new Error(_lastImgErr)); }
        var m = models[i++];
        fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), 45000, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (r) { if (!r.ok) return r.text().then(function (tx) { lastErr = m + ' → HTTP ' + r.status + ': ' + tx.replace(/\s+/g, ' ').slice(0, 180); throw new Error(lastErr); }); return r.json(); })
          .then(function (j) {
            var parts = []; try { parts = j.candidates[0].content.parts || []; } catch (e) {}
            var img = null; parts.forEach(function (p) { var d = p.inlineData || p.inline_data; if (d && d.data) img = { data: d.data, mime: d.mimeType || d.mime_type }; });
            if (!img) { lastErr = m + ' → respondió sin imagen'; return tryM(); }
            resolve(b64ToFile(img.data, img.mime, idx));
          }).catch(function (e) { if (!lastErr) lastErr = m + ' → ' + (e && e.message || e); tryM(); });
      })();
    });
  }
  // RESPALDO: Pollinations (gratis pero limitado a 1 req/IP, suele dar 402 → por eso es solo fallback).
  function genImagePollinations(prompt, style, idx) {
    var full = (prompt + ', ' + styleImageHint(style)).replace(/\s+/g, ' ').trim().slice(0, 420);
    var url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(full) + '?width=1280&height=720&nologo=true&referrer=zerack&seed=' + (1234 + idx * 7);
    return fetchWithTimeout(url, 45000).then(function (r) { if (!r.ok) throw new Error('poll ' + r.status); return r.blob(); })
      .then(function (b) { if (!b || b.size < 3000 || /json/.test(b.type || '')) throw new Error('img vacía'); return new File([b], 'img' + ('00' + (idx + 1)).slice(-3) + '.jpg', { type: 'image/jpeg' }); });
  }
  // FOOTAGE DE STOCK (Openverse) — GRATIS y SIN API KEY. Devuelve fotos reales por keyword.
  // Esto es lo que hace que "URL → video" SIEMPRE arme el video aunque la IA de imágenes falle.
  function stockKeywords(s) {
    return String(s || '').toLowerCase()
      .replace(/[^\w\sáéíóúñü]/gi, ' ')
      .replace(/\b(un|una|el|la|los|las|de|del|que|con|por|para|the|a|an|of|in|on|and|to|is|cinematic|video|imagen|escena|foto)\b/gi, ' ')
      .split(/\s+/).filter(Boolean).slice(0, 5).join(' ').trim();
  }
  function stockImage(query, idx) {
    var q = stockKeywords(query) || 'cinematic landscape';
    var api = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(q) + '&page_size=10&mature=false&license_type=commercial,modification';
    return fetchWithTimeout(api, 20000).then(function (r) { if (!r.ok) throw new Error('openverse ' + r.status); return r.json(); })
      .then(function (j) {
        var res = (j && j.results) || []; if (!res.length) throw new Error('sin stock');
        var pick = res[idx % res.length] || res[0];
        var u = pick.thumbnail || pick.url; if (!u) throw new Error('sin url');   // thumbnail va por el proxy de openverse (mismo dominio, con permiso)
        return fetchWithTimeout(u, 25000).then(function (r2) { if (!r2.ok) throw new Error('img ' + r2.status); return r2.blob(); })
          .then(function (b) { if (!b || b.size < 2500 || /json/.test(b.type || '')) throw new Error('img vacía'); return new File([b], 'stock' + ('00' + (idx + 1)).slice(-3) + '.jpg', { type: b.type || 'image/jpeg' }); });
      });
  }
  function genOneImage(keys, prompt, scene, style, idx) {
    var chain;
    // Gemini (si hay key) → si falla, STOCK real (Openverse) → stock por el texto de la escena → tarjeta de texto.
    // Así el video NUNCA queda sin footage real (antes, si Gemini fallaba, salía pura tarjeta o nada).
    if (keys && keys.gemini && /^AIza/.test(keys.gemini)) chain = genImageGemini(keys.gemini, prompt, style, idx).catch(function () { return stockImage(prompt, idx); });
    else chain = stockImage(prompt, idx);
    return chain
      .catch(function () { return stockImage(scene, idx); })
      .catch(function () { return makeOneCard(scene, style, idx); });   // último recurso (el video nunca queda sin escena)
  }
  function genAllImages(scenes, imgs, style, keys, prog) {
    var hasGem = !!(keys && keys.gemini && /^AIza/.test(keys.gemini));
    var CONC = hasGem ? 2 : 3;   // stock (Openverse) aguanta varias en paralelo → más rápido
    var out = new Array(scenes.length), done = 0, i = 0;
    return new Promise(function (resolve) {
      function launch() {
        if (i >= scenes.length) return;
        var idx = i++, prompt = (imgs && imgs[idx]) ? imgs[idx] : scenes[idx];
        genOneImage(keys, prompt, scenes[idx], style, idx)
          .then(function (f) { out[idx] = f; }, function () {})
          .then(function () { done++; if (prog) prog(done, scenes.length); if (i < scenes.length) launch(); else if (done >= scenes.length) resolve(out.filter(Boolean)); });
      }
      var n = Math.min(CONC, scenes.length); if (!n) return resolve([]); for (var k = 0; k < n; k++) launch();
    });
  }
  function genOverlay(text) {
    var ov = el('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(5,8,12,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#e7ecf2;font:14px ui-monospace,monospace;';
    var t = el('div', null, text); t.style.cssText = 'font-weight:900;font-size:17px;color:#fff;text-align:center;padding:0 20px;'; ov.appendChild(t);
    var bar = el('div'); bar.style.cssText = 'width:60%;max-width:420px;height:10px;background:rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;'; var fill = el('div'); fill.style.cssText = 'height:100%;width:0%;background:#fff;transition:width .25s;'; bar.appendChild(fill); ov.appendChild(bar);
    var sub = el('div', null, 'Las imágenes se crean en la nube (gratis). Tardan ~1-2 min.'); sub.style.cssText = 'font-size:12px;color:var(--mut);'; ov.appendChild(sub);
    document.body.appendChild(ov);
    return { update: function (m, p) { t.textContent = m; if (p != null) fill.style.width = Math.round(p * 100) + '%'; }, close: function () { try { document.body.removeChild(ov); } catch (e) {} } };
  }
  function generateStyledVideo(style, gen, mode) {
    var rec = styleToRecipe(style);
    if (mode === 'images') {
      pendingTemplate = { emoji: '', niche: 'Estilo: ' + (style.author || 'extraído'), recipe: rec };
      try { scriptInput.value = gen.scenes.join(' '); } catch (e) {}   // guion → subtítulos + ritmo
      setStyleStatus('✓ Guion y estilo listos. Soltá tus imágenes y armo el video con este estilo.');
      showView('load');
      try { var dt = drop.querySelector('.drop-title'); if (dt) dt.textContent = 'Soltá tus imágenes — armo el video con el estilo + guion ya cargados'; } catch (e) {}
    } else if (mode === 'cards') {
      rec.captions = false;   // el texto va en la tarjeta → sin subtítulos duplicados
      pendingTemplate = { emoji: '', niche: 'Estilo: ' + (style.author || 'extraído'), recipe: rec };
      try { scriptInput.value = ''; } catch (e) {}
      setStyleStatus('Generando las tarjetas de texto…');
      makeTextCards(gen.scenes, style).then(function (files) { buildVideoFromImages(files); })
        .catch(function (e) { setStyleStatus('No pude armar las tarjetas: ' + (e && e.message || e)); });
    } else {   // 'ai' — el flujo CREA las imágenes con IA y arma el video solo
      pendingTemplate = { emoji: '', niche: 'Estilo: ' + (style.author || 'extraído'), recipe: rec };
      try { scriptInput.value = gen.scenes.join(' '); } catch (e) {}   // narración → subtítulos sincronizados
      getAIKeys().then(function (keys) {
        var hasGem = !!(keys && keys.gemini && /^AIza/.test(keys.gemini));
        if (!hasGem) setStyleStatus('Sin key de Gemini → uso footage de STOCK real (gratis, sin key). El video se arma igual.');
        _lastImgErr = '';
        var ov = genOverlay((hasGem ? '🤖 Creando imágenes con IA' : 'Buscando footage de stock') + '…  0/' + gen.scenes.length);
        genAllImages(gen.scenes, gen.imgs, style, keys, function (d, n) { ov.update((hasGem ? '🤖 Creando imágenes con IA' : 'Buscando footage de stock') + '…  ' + d + '/' + n, d / n); })
          .then(function (files) {
            ov.close();
            if (!files.length) { setStyleStatus('No pude generar imágenes.' + (_lastImgErr ? ' Gemini: ' + _lastImgErr : '')); return; }
            if (_lastImgErr) setStyleStatus('⚠ Algunas imágenes IA fallaron → usé tarjetas en esas. Gemini dice: ' + _lastImgErr + ' (probá "Probar 1 imagen").');
            buildVideoFromImages(files);   // arma el MP4 + aplica el estilo + subtítulos
          })
          .catch(function (e) { ov.close(); setStyleStatus('Error generando imágenes: ' + (e && e.message || e)); });
      });
    }
  }

  function extractStyleFromUrl(url) {
    var id = parseYtId(url);
    if (!id) {
      var isCh = /\/(@|channel\/|c\/|user\/)/i.test(url);
      return Promise.reject(new Error(isCh ? 'Eso es un link de CANAL. Pegá el link de un VIDEO (abrí un video del canal y copiá su link).' : 'No reconocí el link. Pegá un link de VIDEO de YouTube (watch?v=…, youtu.be/…, /shorts/… o el de Studio /video/…).'));
    }
    setStyleStatus('Escaneando el video por dentro (fotogramas + ritmo del edit + transcripción)…');
    return Promise.all([
      swFetchText('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)),
      fetchFrames(id),
      swTranscript(id),       // ← el GUION real (para remakear)
      analyzeStoryboard(id)   // ← MIDE el edit real: ritmo de cortes + movimiento (decenas de fotogramas)
    ]).then(function (arr) {
      var meta = {}; try { meta = JSON.parse(arr[0] || '{}'); } catch (e) {}
      var frames = arr[1] || []; if (!frames.length) throw new Error('No pude leer los fotogramas de ese video (¿link correcto?).');
      var tr = arr[2], edit = arr[3];   // edit = {cutSeconds, motion} medido del storyboard, o null
      var look = paletteOfFrames(frames);
      setStyleStatus('Analizando la edición con IA (' + frames.length + ' fotogramas' + (edit ? ' + ritmo medido ✓' : '') + (tr && tr.text ? ' + transcripción ✓' : '') + ')…');
      return getAIKeys().then(function (k) {
        var visP = (k.gemini && /^AIza/.test(k.gemini)) ? styleVision(k.gemini, frames.map(function (f) { return f.dataUrl; }), meta.title, look) : Promise.resolve(null);
        return visP.then(function (ai) {
          var st = buildStyle(id, meta, frames, look, ai);
          // el ritmo MEDIDO del storyboard manda sobre la adivinanza de la IA
          if (edit && edit.cutSeconds > 0) { st.cutSeconds = edit.cutSeconds; st.editMeasured = true; st.editCuts = edit.cuts; }
          if (edit && edit.motion) { st.motion = edit.motion; st.pacing = (edit.cutSeconds <= 2.4 ? 'rapido' : edit.cutSeconds >= 4.5 ? 'lento' : 'medio'); }
          if (tr && tr.text) st.transcript = { text: tr.text, segments: tr.segments || [], lang: tr.lang || '', count: (tr.segments || []).length };
          return st;
        });
      });
    });
  }

  // ── RENDER del resultado (Visual References + Visual Style + Visual Lab) ──
  var GRADE_OPTS = [['cinematic', 'Cinematográfico'], ['warm', 'Cálido'], ['cold', 'Frío'], ['vibrant', 'Vibrante'], ['noir', 'Noir B/N'], ['punch', 'Punch']];
  var TPL_OPTS = [['capcut', 'CapCut'], ['karaoke', 'Karaoke'], ['hormozi', 'Hormozi'], ['mrbeast', 'MrBeast'], ['clasico', 'Clásico'], ['neon', 'Neón'], ['doc', 'Documental'], ['tiktok', 'TikTok'], ['noticias', 'Noticias'], ['retro', 'Retro']];
  var FONT_OPTS = [['black', 'Arial Black'], ['impact', 'Impact'], ['trebu', 'Trebuchet'], ['verdana', 'Verdana'], ['georgia', 'Georgia'], ['mono', 'Mono'], ['comic', 'Redondeada']];
  var TRANS_OPTS = [['slidedown', 'Baja (slide)'], ['dip', 'Fundido'], ['flash', 'Flash'], ['zoomblur', 'Zoom blur'], ['whip', 'Whip'], ['mix', 'Variado']];
  var PACE_OPTS = [['lento', 'Lento (relax/dormir)'], ['medio', 'Medio'], ['rapido', 'Rápido (viral)']];
  function styleSelect(label, opts, cur, on) {
    var r = el('div', 'style-row'); r.appendChild(el('span', 'lab', label));
    var s = document.createElement('select');
    opts.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (String(cur) === String(o[0])) op.selected = true; s.appendChild(op); });
    s.addEventListener('change', function () { on(s.value); });
    r.appendChild(s); return r;
  }
  function renderStyle(s) {
    _curStyle = s;
    var box = $('styleResult'); if (!box) return; box.textContent = '';
    // VISUAL REFERENCES
    var ref = el('div', 'style-card');
    ref.appendChild(el('h4', null, 'VISUAL REFERENCES (fotogramas del video)'));
    var frames = (s.frames && s.frames.length) ? s.frames : (s.thumb ? [s.thumb] : []);
    var fg = el('div'); fg.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;';
    frames.forEach(function (du) { var im = document.createElement('img'); im.src = du; im.style.cssText = 'width:100%;border-radius:8px;display:block;'; fg.appendChild(im); });
    ref.appendChild(fg);
    if (s.title) ref.appendChild(el('div', null, s.title)).style.cssText = 'font-weight:700;font-size:13px;margin-bottom:2px;';
    if (s.author) ref.appendChild(el('div', null, s.author)).style.cssText = 'font-size:11.5px;color:var(--mut);margin-bottom:8px;';
    var pal = el('div', 'style-pal');
    (s.look.palette || []).forEach(function (hx) { var sw = el('div', 'style-sw'); sw.style.background = hx; sw.appendChild(el('span', null, hx)); pal.appendChild(sw); });
    ref.appendChild(pal);
    ref.appendChild(el('div', null, '🔆 Brillo ' + s.look.brightness + '/255 · Contraste ' + s.look.contrast + ' · Saturación ' + s.look.sat + '%')).style.cssText = 'font-size:11px;color:var(--mut);margin-top:20px;';
    box.appendChild(ref);
    // VISUAL STYLE (chips)
    var vs = el('div', 'style-card');
    vs.appendChild(el('h4', null, 'VISUAL STYLE' + (s.ai ? ' (IA)' : ' (auto)')));
    var chips = el('div', 'style-chips');
    var add = function (t) { if (t) chips.appendChild(el('span', 'style-chip', t)); };
    if (s.niche) add('Nicho: ' + s.niche);
    if (s.footage) add('Material: ' + s.footage);
    if (s.vibe) add('Vibe: ' + s.vibe);
    add('Color: ' + (GRADE_OPTS.filter(function (o) { return o[0] === s.grade; })[0] || [, s.grade])[1]);
    add('Subs: ' + (TPL_OPTS.filter(function (o) { return o[0] === s.captionTemplate; })[0] || [, s.captionTemplate])[1] + (s.capSize < 0.9 ? ' (chicos)' : s.capSize > 1.1 ? ' (grandes)' : ''));
    add('Ritmo: ' + s.pacing);
    if (s.editMeasured && s.cutSeconds) add('Corta cada ' + s.cutSeconds + 's (MEDIDO del video)');
    if (s.motion) add('Movimiento: ' + s.motion);
    if (s.embers) add('Brasas 🔥'); if (s.liveFilm) add('Cine Vivo');
    vs.appendChild(chips);
    if (s.hookFormula) { var hf = el('div', null, '🎣 Gancho: ' + s.hookFormula); hf.style.cssText = 'font-size:12px;color:var(--mut);margin-top:10px;line-height:1.5;'; vs.appendChild(hf); }
    box.appendChild(vs);
    // VISUAL LAB (editable)
    var lab = el('div', 'style-card full');
    lab.appendChild(el('h4', null, '🧪 VISUAL LAB — retocá el estilo'));
    var grid = el('div'); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0 18px;';
    grid.appendChild(styleSelect('Color (grade)', GRADE_OPTS, s.grade, function (v) { s.grade = v; }));
    grid.appendChild(styleSelect('Plantilla subs', TPL_OPTS, s.captionTemplate, function (v) { s.captionTemplate = v; }));
    grid.appendChild(styleSelect('Tipografía', FONT_OPTS, s.font, function (v) { s.font = v; }));
    grid.appendChild(styleSelect('Transición', TRANS_OPTS, s.transition, function (v) { s.transition = v; }));
    grid.appendChild(styleSelect('Ritmo', PACE_OPTS, s.pacing, function (v) { s.pacing = v; }));
    grid.appendChild(styleSelect('MAYÚSCULAS subs', [['1', 'Sí'], ['0', 'No']], s.upper ? '1' : '0', function (v) { s.upper = v === '1'; }));
    grid.appendChild(styleSelect('Brasas de fuego', [['0', 'No'], ['1', 'Sí']], s.embers ? '1' : '0', function (v) { s.embers = v === '1'; }));
    grid.appendChild(styleSelect('Cine Vivo', [['1', 'Sí'], ['0', 'No']], s.liveFilm ? '1' : '0', function (v) { s.liveFilm = v === '1'; }));
    lab.appendChild(grid);
    var acts = el('div', 'style-actions');
    var bSave = el('button', 'btn-ghost sm', '💾 Guardar plantilla'); bSave.addEventListener('click', function () { saveStyleTemplate(s); });
    var bUse = el('button', 'btn-primary', 'Crear video con este estilo'); bUse.addEventListener('click', function () { useStyle(s); });
    var bPub = el('button', 'btn-ghost sm', '⬆ Publicar (abrir subidor)'); bPub.addEventListener('click', function () { try { window.open('https://www.youtube.com/upload', '_blank'); } catch (e) {} });
    acts.appendChild(bSave); acts.appendChild(bUse); acts.appendChild(bPub); lab.appendChild(acts);
    box.appendChild(lab);

    // ── ⚙️ GENERAR VIDEO CON IA (guion + título en este estilo) ──
    var gv = el('div', 'style-card full');
    gv.appendChild(el('h4', null, '⚙️ CREAR VIDEO CON ESTE ESTILO'));
    var hasTr = !!(s.transcript && s.transcript.text);
    gv.appendChild(el('div', null, 'Escribí el tema. La IA escribe el guion + título en este estilo y arma el video solo.')).style.cssText = 'font-size:12px;color:var(--mut);line-height:1.5;margin-bottom:10px;';
    if (hasTr) { var trn = el('div', null, 'Detecté la TRANSCRIPCIÓN de este video (' + (s.transcript.count || '') + ' líneas). Dejá el tema VACÍO y dale "Crear video" para REMAKEAR su guion en este estilo (reescrito, sin copiar textual).'); trn.style.cssText = 'font-size:12px;color:#fff;font-weight:700;line-height:1.5;margin-bottom:10px;'; gv.appendChild(trn); }
    var tin = document.createElement('input'); tin.type = 'text'; tin.className = 'style-url'; tin.placeholder = hasTr ? 'Tema (opcional — VACÍO = remake del guion de este video)' : 'Tema del video (ej: "el hombre que perdió todo y lo recuperó")'; tin.style.cssText = 'width:100%;margin-bottom:8px;';
    gv.appendChild(tin);
    var row = el('div'); row.style.cssText = 'display:flex;gap:10px;align-items:center;';
    var modeSel = document.createElement('select'); modeSel.style.cssText = 'flex:1;background:#10151c;color:#e7ecf2;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:10px;font-size:14px;cursor:pointer;';
    [['ai', '🤖 Imágenes con IA (automático)'], ['images', 'Voy a poner mis imágenes'], ['cards', '📝 Tarjetas de texto (sin imágenes)']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; modeSel.appendChild(op); });
    var bGo = el('button', 'btn-primary', 'Crear video'); bGo.style.cssText = 'white-space:nowrap;';
    row.appendChild(modeSel); row.appendChild(bGo); gv.appendChild(row);
    var gOut = el('div'); gOut.style.cssText = 'margin-top:8px;'; gv.appendChild(gOut);
    bGo.addEventListener('click', function () {
      var topic = (tin.value || '').trim();
      var remake = (!topic && !!(s.transcript && s.transcript.text));   // sin tema + hay transcripción → REMAKE del guion del video
      if (!topic && !remake) { setStyleStatus('Escribí un tema (o pegá un video CON subtítulos para remakear su guion).'); return; }
      var mode = modeSel.value;
      bGo.disabled = true; var ot = bGo.textContent; bGo.textContent = remake ? 'Remakeando el guion…' : 'Escribiendo guion…';
      setStyleStatus(remake ? 'Reescribiendo el guion ORIGINAL del video en este estilo…' : 'La IA está escribiendo el guion en este estilo…'); gOut.textContent = '';
      (remake ? aiRemakeScript(s) : aiGenerateScript(s, topic)).then(function (gen) {
        var ti = el('div', null, (remake ? 'REMAKE · ' : '') + gen.title); ti.style.cssText = 'font-weight:800;font-size:14px;margin:4px 0;color:#fff;'; gOut.appendChild(ti);
        setStyleStatus('✓ Guion listo (' + gen.scenes.length + ' escenas) — armando el video…');
        generateStyledVideo(s, gen, mode);
      }).catch(function (e) { setStyleStatus('⚠ ' + (e && e.message || e)); })
        .then(function () { bGo.disabled = false; bGo.textContent = ot; });
    });
    box.appendChild(gv);
  }
  function useStyle(s) {
    applyTemplate({ emoji: '', niche: (s.author ? 'Estilo: ' + s.author : 'Estilo extraído'), recipe: styleToRecipe(s) });
  }
  // ── Guardar / listar plantillas de estilo (chrome.storage) ──
  function saveStyleTemplate(s) {
    var item = { id: s.id, ts: Date.now(), title: s.title, author: s.author, thumb: s.thumb, recipe: styleToRecipe(s), style: { grade: s.grade, captionTemplate: s.captionTemplate, font: s.font, transition: s.transition, pacing: s.pacing, upper: s.upper, embers: s.embers, liveFilm: s.liveFilm, niche: s.niche } };
    try {
      chrome.storage.local.get('nsp_ms_styles', function (r) {
        var arr = (r && Array.isArray(r.nsp_ms_styles)) ? r.nsp_ms_styles : [];
        arr = arr.filter(function (x) { return x && x.id !== item.id; }); arr.unshift(item); arr = arr.slice(0, 30);
        chrome.storage.local.set({ nsp_ms_styles: arr }, function () { setStyleStatus('✓ Plantilla guardada. La ves abajo en "Mis estilos".'); renderSavedStyles(); });
      });
    } catch (e) { setStyleStatus('No pude guardar: ' + (e && e.message || e)); }
  }
  function renderSavedStyles() {
    var box = $('styleSaved'); if (!box) return; box.textContent = '';
    try {
      chrome.storage.local.get('nsp_ms_styles', function (r) {
        var arr = (r && Array.isArray(r.nsp_ms_styles)) ? r.nsp_ms_styles : [];
        if (!arr.length) return;
        box.appendChild(el('h4', null, 'MIS ESTILOS GUARDADOS')).style.cssText = 'font-size:12px;color:#fff;font-weight:900;margin:18px 0 6px;letter-spacing:.05em;';
        arr.forEach(function (it) {
          var row = el('div', 'style-saved-item');
          var left = el('div'); left.style.cssText = 'display:flex;align-items:center;gap:10px;';
          if (it.thumb) { var im = document.createElement('img'); im.src = it.thumb; im.style.cssText = 'width:64px;height:36px;object-fit:cover;border-radius:5px;'; left.appendChild(im); }
          left.appendChild(el('span', null, (it.author ? it.author + ' · ' : '') + (it.style ? it.style.grade + '/' + it.style.captionTemplate : '')));
          row.appendChild(left);
          var btns = el('div'); btns.style.cssText = 'display:flex;gap:6px;';
          var use = el('button', 'btn-primary', 'Usar'); use.style.cssText = 'padding:5px 12px;font-size:12px;';
          use.addEventListener('click', function () { applyTemplate({ emoji: '', niche: (it.author ? 'Estilo: ' + it.author : 'Estilo guardado'), recipe: it.recipe }); });
          var del = el('button', null, '✕'); del.style.cssText = 'background:none;border:none;color:#FF6B6B;cursor:pointer;font-weight:900;';
          del.addEventListener('click', function () { var rest = arr.filter(function (x) { return x.id !== it.id; }); chrome.storage.local.set({ nsp_ms_styles: rest }, renderSavedStyles); });
          btns.appendChild(use); btns.appendChild(del); row.appendChild(btns); box.appendChild(row);
        });
      });
    } catch (e) {}
  }
  if ($('btnStyle')) $('btnStyle').addEventListener('click', function () { showView('style'); renderSavedStyles(); });
  if ($('btnStyleBack')) $('btnStyleBack').addEventListener('click', function () { showView(ST.ready ? 'editor' : 'load'); });
  if ($('btnExtractStyle')) $('btnExtractStyle').addEventListener('click', function () {
    var u = ($('styleUrl') && $('styleUrl').value) || '';
    var btn = $('btnExtractStyle'); btn.disabled = true; var old = btn.textContent; btn.textContent = 'Extrayendo…';
    extractStyleFromUrl(u).then(function (s) { setStyleStatus('✓ Estilo extraído' + (s.ai ? ' con IA.' : ' (sin API key de Gemini: usé paleta + heurística. Cargá la key en Opciones para análisis IA).')); renderStyle(s); })
      .catch(function (e) { setStyleStatus('⚠ ' + (e && e.message || e)); })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  });
  if ($('styleUrl')) $('styleUrl').addEventListener('keydown', function (e) { if (e.key === 'Enter' && $('btnExtractStyle')) $('btnExtractStyle').click(); });

  btnTemplates.addEventListener('click', function () { buildTemplatesView(); showView('templates'); });
  btnTplBack.addEventListener('click', function () { showView(ST.ready ? 'editor' : 'load'); });
  btnScanAll.addEventListener('click', scanAllMarket);

  // ════════════════════ ANALIZADOR (mejorado) ════════════════════
  function sampleFrames(video, count) {
    return new Promise(function (resolve) {
      var dur = video.duration || 0; if (!dur) { resolve([]); return; }
      var cw = 80, ch = 45, c = document.createElement('canvas'); c.width = cw; c.height = ch; var cx = c.getContext('2d', { willReadFrequently: true });
      var pts = []; for (var i = 0; i < count; i++) pts.push(dur * ((i + 0.5) / count)); var samples = [], idx = 0;
      var _wd = null;
      function clearWd() { if (_wd) { clearTimeout(_wd); _wd = null; } }
      function finish() { clearWd(); video.removeEventListener('seeked', onSeeked); resolve(samples); }
      function onSeeked() {
        clearWd();
        try { cx.drawImage(video, 0, 0, cw, ch); var d = cx.getImageData(0, 0, cw, ch).data, n = cw * ch, lum = new Float32Array(n), sl = 0, sl2 = 0, ss = 0;
          for (var i = 0, p = 0; i < d.length; i += 4, p++) { var L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; lum[p] = L; sl += L; sl2 += L * L; var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); ss += mx === 0 ? 0 : (mx - mn) / mx; }
          var mL = sl / n; samples.push({ lum: lum, meanL: mL, std: Math.sqrt(Math.max(0, sl2 / n - mL * mL)), sat: ss / n });
        } catch (e) { samples.push(null); }
        idx++; nx();
      }
      function nx() {
        if (idx >= pts.length) { finish(); return; }
        // watchdog: si 'seeked' no dispara (seek a un valor casi igual / video raro), avanzá
        // igual a los 1.5s para no colgar el análisis (antes quedaba pendiente para siempre).
        clearWd(); _wd = setTimeout(function () { samples.push(null); idx++; nx(); }, 1500);
        try { video.currentTime = pts[idx]; } catch (e) { finish(); }
      }
      video.addEventListener('seeked', onSeeked); nx();
    });
  }
  function analyzeProduction(s) {
    var v = s.filter(Boolean); if (!v.length) return null; var motion = 0, mc = 0;
    for (var i = 1; i < s.length; i++) if (s[i] && s[i - 1]) { var d = 0, a = s[i].lum, b = s[i - 1].lum; for (var p = 0; p < a.length; p++) d += Math.abs(a[p] - b[p]); motion += d / a.length; mc++; }
    var avg = function (k) { return v.reduce(function (x, y) { return x + y[k]; }, 0) / v.length; };
    return { motion: mc ? motion / mc : 0, meanL: avg('meanL'), std: avg('std'), sat: avg('sat') };
  }
  function hexA(h, a) { h = h.replace('#', ''); var n = parseInt(h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  function buildDiagnosis(prod) {
    var s = (scriptInput.value || '').trim(); var words = s ? s.split(/\s+/).length : 0; var narr = words / 2.5;
    var cov = (s && ST.dur) ? Math.min(1, narr / ST.dur) : 0;
    var score = 50, og = [], pr = [], plan = [];
    // originalidad
    if (!s && !P.captions.length) { og.push(['warn', 'Narración no verificable', 'No hay guion ni subtítulos. Pegá el guion o generá subtítulos para demostrar valor original.']); }
    else if (cov >= 0.5) { score += 24; og.push(['ok', 'Narración sólida', Math.round(cov * 100) + '% del video. Muy por encima del 30% que exige YouTube.']); }
    else if (cov >= 0.3) { score += 14; og.push(['ok', 'Narración OK', Math.round(cov * 100) + '% — pasa el umbral, pero sumale más.']); plan.push('Subí la narración hacia 50%+.'); }
    else if (s) { score += 4; og.push(['bad', 'Narración insuficiente', 'Solo ' + Math.round(cov * 100) + '%. YouTube marca <30% como reusado.']); plan.push('CRÍTICO: agregá más voz en off / comentario.'); }
    if (P.captions.length) { score += 10; og.push(['ok', 'Subtítulos activos', P.captions.length + ' subtítulos = narración visible + retención + valor original.']); }
    else { plan.push('Generá subtítulos (pestaña 💬) — suman valor original y retención.'); }
    if (P.texts.length) { score += 4; og.push(['ok', 'Texto/hook agregado', P.texts.length + ' overlay(s) — muestra intención creativa.']); }
    // PRODUCCIÓN — el puntaje sale de TU EDICIÓN (100% determinista). Antes dependía del
    // muestreo de frames del video crudo (prod.motion/std); ese muestreo descartaba frames
    // por timeout y daba números distintos en cada corrida → el score "saltaba" ~20% sin
    // tocar nada e ignoraba lo que aplicabas. Ahora: misma edición = mismo score, y aplicar
    // una plantilla/AUTO baja el riesgo de inmediato.
    var dynamicEdit = P.kenBurns || P.pulse || P.zooms.length;
    if (dynamicEdit) {
      score += 22; pr.push(['ok', 'Video dinámico', 'Tu edición agrega zoom/movimiento — ya no parece slideshow.']);
    } else {
      score += 2; pr.push(['bad', 'Sin movimiento (slideshow)', 'Patrón #1 de desmonetización. Aplicá AUTO o activá Ken Burns + punch-ins (pestaña ).']); plan.push('CRÍTICO: aplicá AUTO o activá Ken Burns + punch-ins (pestaña ).');
    }
    if (GRADES[P.grade] && P.grade !== 'none') { score += 7; pr.push(['ok', 'Color trabajado', 'Grado "' + GRADES[P.grade].label + '" aplicado.']); }
    else { pr.push(['warn', 'Color plano', 'Aplicá un grado de color (pestaña ).']); plan.push('Aplicá un grado de color (Cine o Punch).'); }
    if (P.vignette || P.grain) { score += 4; pr.push(['ok', 'Efectos cine', 'Viñeta/grano activos — look más profesional.']); }
    // Nota informativa del metraje crudo (NO suma ni resta puntos — solo contexto):
    if (prod && !dynamicEdit && prod.motion >= 15) pr.push(['warn', 'Tu metraje crudo ya se mueve', 'Aun así, aplicá zoom: para YouTube lo que cuenta es la transformación que VOS agregás.']);
    score = clamp(Math.round(score), 0, 100);
    var verdict, color, sub;
    if (score >= 72) { verdict = 'MONETIZACIÓN SEGURA'; color = '#fff'; sub = 'Tu video cumple el bar de originalidad + transformación. Exportalo.'; }
    else if (score >= 50) { verdict = 'RIESGO MEDIO'; color = '#e7ecf2'; sub = 'Aplicá el plan antes de publicar para blindarlo.'; }
    else { verdict = 'ALTO RIESGO'; color = '#FF6B6B'; sub = 'Tiene el perfil que YouTube tumba en 2026. Usá las herramientas del editor.'; }
    if (!plan.length) plan.push('Estás bien. Exportá y subí con confianza.');
    return { score: score, verdict: verdict, color: color, sub: sub, og: og, pr: pr, plan: plan };
  }
  function renderReport(d) {
    report.textContent = '';
    var hero = el('div', 'hero'); hero.style.border = '1px solid ' + hexA(d.color, 0.45);
    var ring = el('div', 'ring'); ring.style.background = 'conic-gradient(' + d.color + ' ' + (d.score * 3.6) + 'deg, rgba(255,255,255,0.08) 0deg)';
    var ri = el('div', 'ring-inner'); var rn = el('div', 'ring-num', String(d.score)); rn.style.color = d.color; ri.appendChild(rn); ri.appendChild(el('div', 'ring-max', '/100 SEGURO')); ring.appendChild(ri);
    var ht = el('div'); var hv = el('div', 'hero-verdict', d.verdict); hv.style.color = d.color; ht.appendChild(hv); ht.appendChild(el('div', 'hero-sub', d.sub));
    hero.appendChild(ring); hero.appendChild(ht); report.appendChild(hero);
    function grp(t, rows) { if (!rows.length) return; var g = el('div', 'diag-group'); g.appendChild(el('div', 'diag-h', t)); rows.forEach(function (r) { var row = el('div', 'diag-row'); row.appendChild(el('div', 'diag-ic', r[0] === 'ok' ? '' : r[0] === 'bad' ? '❌' : '⚠️')); var b = el('div'); b.appendChild(el('div', 'diag-title', r[1])); b.appendChild(el('div', 'diag-note', r[2])); row.appendChild(b); g.appendChild(row); }); report.appendChild(g); }
    grp('ORIGINALIDAD (lo que más pesa)', d.og); grp('PRODUCCIÓN VISUAL', d.pr);
    var plan = el('div', 'plan'); plan.appendChild(el('div', 'plan-h', 'PLAN DE ACCIÓN')); d.plan.forEach(function (p, i) { var pi = el('div', 'plan-item'); pi.appendChild(el('span', 'n', (i + 1) + ')')); pi.appendChild(el('span', null, p)); plan.appendChild(pi); }); report.appendChild(plan);
  }
  btnAnalyze.addEventListener('click', function () {
    if (!ST.ready) return; stopPlay(); btnAnalyze.disabled = true; btnAnalyze.textContent = '🔎 Analizando…';
    var wm = srcVideo.muted; srcVideo.muted = true;
    sampleFrames(srcVideo, 14).then(function (s) {
      srcVideo.muted = wm; renderReport(buildDiagnosis(analyzeProduction(s)));
      analyzerModal.hidden = false; btnAnalyze.disabled = false; btnAnalyze.textContent = 'Analizar riesgo';
      seekTo(P.trimStart);   // vuelve al inicio Y redibuja el canvas (antes quedaba en un frame intermedio/negro)
    }).catch(function (err) {
      srcVideo.muted = wm; btnAnalyze.disabled = false; btnAnalyze.textContent = 'Analizar riesgo';
      seekTo(P.trimStart); console.warn('[MonetizeStudio] análisis falló:', err);
    });
  });
  if (mhAnalyze) mhAnalyze.addEventListener('click', function () { btnAnalyze.click(); });
  analyzerClose.addEventListener('click', function () { analyzerModal.hidden = true; });
  analyzerModal.addEventListener('click', function (e) { if (e.target === analyzerModal) analyzerModal.hidden = true; });

  // ══════════════ MONOCROMO TOTAL DE EMOJIS ══════════════
  // Los emojis son multicolor por naturaleza: ningún color CSS los cambia. La única forma de
  // volverlos blanco/negro es envolverlos y aplicarles filter:grayscale. Esto recorre el DOM,
  // envuelve cada emoji en <span class="zico"> y vuelve a hacerlo cuando se generan paneles/timeline.
  var ZEMOJI = /(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*|[←-⇿⌀-➿⬀-⯿])/gu;
  function zMonoNode(root) {
    try {
      var skip = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CANVAS: 1 };
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || !ZEMOJI.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
          if (skip[p.nodeName]) return NodeFilter.FILTER_REJECT;
          if (p.classList && (p.classList.contains('zico') || p.classList.contains('tt-ic') || p.classList.contains('logo'))) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var hits = [], n; while ((n = w.nextNode())) hits.push(n);
      hits.forEach(function (node) {
        var txt = node.nodeValue; ZEMOJI.lastIndex = 0;
        if (!ZEMOJI.test(txt)) return;
        var frag = document.createDocumentFragment(), last = 0, m; ZEMOJI.lastIndex = 0;
        while ((m = ZEMOJI.exec(txt))) {
          if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
          var s = document.createElement('span'); s.className = 'zico'; s.textContent = m[0]; frag.appendChild(s);
          last = m.index + m[0].length;
        }
        if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
        if (node.parentNode) node.parentNode.replaceChild(frag, node);
      });
    } catch (e) {}
  }
  var _zmT = null;
  function zMonoSoon() { if (_zmT) return; _zmT = setTimeout(function () { _zmT = null; zMonoNode(document.body); }, 60); }
  zMonoNode(document.body);
  try {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { zMonoSoon(); break; } }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
})();
