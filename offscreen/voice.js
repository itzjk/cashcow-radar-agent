(function () {
  'use strict';

  var RATE = 16000;
  var FRAME = 1024;
  var MIN_THR = 0.014;
  var NOISE_MULT = 3.2;
  var NOISE_START = 0.004;
  var NOISE_CAP = 0.06;
  var PREROLL_SAMPLES = RATE;
  var END_SILENCE_MS = 500;
  var MIN_SPEECH_MS = 250;
  var MAX_PHRASE_SAMPLES = RATE * 20;
  var NO_SPEECH_MS = 8000;
  var ECHO_TAIL_MS = 350;
  var CHIME_SKIP_MS = 400;
  var MIC_IDLE_CLOSE_MS = 15000;
  var CMD_WINDOW_MS = 10000;
  var WAKE_BACKLOG = 1;
  var PREFS_WAIT_MS = 300;
  var PREFS_TTL_MS = 30000;
  var LOCAL_TTL_MS = 60000;
  var TOKENS_BASE = 24;
  var TOKENS_PER_S = 8;
  var TOKENS_CAP = 224;
  var SPEAK_MAX = 1500;
  var CHUNK_MAX = 220;
  var CACHE_TEXT_MAX = 120;
  var TIMINGS_KEPT = 20;
  var REC_QUICK_END_MS = 1500;
  var REC_BACKOFF_MS = 2000;

  var K_ENGINE = 'nsp_voice_engine';
  var K_BROWSER = 'nsp_voice_browser_name';
  var K_LOCAL = 'nsp_voice_local_name';
  var K_LANG = 'nsp_voice_lang';
  var K_WAKE_WORD = 'nsp_voice_wake_word';
  var K_OPENAI = 'nsp_openai_api_key';
  var K_FISH_KEY = 'nsp_fish_api_key';
  var K_FISH_VOICE = 'nsp_fish_voice_id';
  var PREF_KEYS = [K_ENGINE, K_BROWSER, K_LOCAL, K_LANG, K_WAKE_WORD, K_OPENAI, K_FISH_KEY, K_FISH_VOICE];
  var MIRROR_KEY = 'nsp_voice_prefs';
  var ENGINES = ['browser', 'fish', 'openai', 'local'];
  var LANGS = ['auto', 'es', 'en'];

  var LOCAL_SERVER = 'http://127.0.0.1:7788';
  var FISH_TTS = 'https://api.fish.audio/v1/tts';
  var FISH_DEFAULT_VOICE = 'b7db3acd5f3f40a1b143f4e1ea95db8c';
  var OPENAI_TTS = 'https://api.openai.com/v1/audio/speech';
  var OPENAI_MODEL = 'gpt-4o-mini-tts';
  var OPENAI_VOICE = 'onyx';
  var OPENAI_INSTRUCTIONS = 'Speak as a calm, precise and confident assistant. Even pace, clear diction, a low and steady tone, no excitement and no filler.';
  var CACHE_DB = 'nsp_voice_cache';
  var CACHE_STORE = 'clips';
  var WHISPER_ASSETS = [
    'lib/whisper/ort-wasm.wasm',
    'lib/whisper/ort-wasm-simd.wasm',
    'lib/whisper/models/Xenova/whisper-tiny/onnx/encoder_model_quantized.onnx',
    'lib/whisper/models/Xenova/whisper-tiny/onnx/decoder_model_merged_quantized.onnx'
  ];

  // Mirrors the fixed lines of NSP_VOICE_LINES in background/service-worker.js and the confirmations in the voice brief; a SAY with cache: true is kept as well.
  var FIXED_LINES = /^(?:listening|voice off|te escucho|voz apagada|opening youtube|searching|searching youtube|going back|back|forward|scanning|done|i did not catch that|yes|opening it|reloading|next tab|previous tab|closed|new tab|saved|opening the channel|that did not work|there is only one tab|there is nowhere to go|the agent is on|the agent is off|hands free is off|dime|abro youtube|busco en youtube|lo abro|atras|adelante|recargo|siguiente pestana|pestana anterior|cerrada|pestana nueva|guardado|escaneando|abro el canal|no funciono|solo hay una pestana|no hay adonde ir|agente activado|agente apagado|manos libres apagado|no te entendi)$/;
  var STOP_RE = /^(?:never ?mind|forget it|thats all|thats it|stand down|go to sleep|cancel that|stop listening|nada|olvidalo|dejalo|no importa|cancela|cancelalo)$/;
  var NOT_SPEECH_RE = /^(?:you|thank you|thanks|thanks for watching|thank you for watching|bye|gracias|muchas gracias|gracias por ver(?: el video)?|suscribete|musica|subtitulos(?: realizados| hechos)? por .*|amara org.*)$/;
  var CALL_RE = /^(?:oye|hey|ey)$/;
  // Chrome's own recognizer: the answer comes back under a second after the phrase ends. These errors mean it cannot run here, so the local Whisper takes over.
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var REC_FALLBACK = { network: 1, 'service-not-allowed': 1, 'language-not-supported': 1, 'bad-grammar': 1 };
  var FILLER_RE = /\b(?:please|thanks|thank you|um|uh|uhm|erm|hmm|mmm|okay|ok|hey|yeah|por favor|eh|este|pues|bueno)\b/g;

  var prefs = readPrefs({});
  var prefsAt = 0;
  var wakeOn = false;
  var epoch = 0;
  var mutedUntil = 0;
  var skipUntil = 0;
  var cmdUntil = 0;
  var cmdTimer = 0;
  var pendingWake = 0;
  var assetsOk = null;
  var lastLang = '';
  var local = { voices: [], at: 0 };
  var told = {};
  var timings = [];
  var turn = null;
  var chimeCtx = null;

  var ear = {
    stream: null, ctx: null, src: null, node: null, opening: null, closeTimer: 0, mode: null,
    collecting: false, chunks: [], samples: 0, preroll: [], prerollSamples: 0,
    noise: NOISE_START, speechMs: 0, silenceMs: 0, minRms: 1, startedAt: 0
  };
  var voice = { token: 0, audio: null, abort: null, finish: null, speaking: false };
  var rec = { r: null, kind: null, gen: 0, startedAt: 0, quick: 0, got: false, err: '', paused: false, broken: '' };

  function now() { return performance.now(); }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function find(list, test) { for (var i = 0; i < list.length; i++) if (test(list[i])) return list[i]; return null; }

  function post(msg) {
    try { chrome.runtime.sendMessage(msg, function () { void chrome.runtime.lastError; }); } catch (e) {}
  }
  function setState(state, reason) {
    var msg = { type: 'NSP_VOICE_STATE', state: state };
    if (reason) msg.reason = reason;
    post(msg);
  }
  function note(reason) {
    if (told[reason]) return;
    told[reason] = true;
    console.warn('[ZERACK voice] ' + reason);
  }

  function newTurn(kind) {
    turn = { kind: kind, at: Date.now() };
    timings.push(turn);
    while (timings.length > TIMINGS_KEPT) timings.shift();
    return turn;
  }
  function mark(t, name) { if (t && t[name] == null) t[name] = Math.round(now()); }

  function readPrefs(r) {
    r = r || {};
    var fishVoice = str(r[K_FISH_VOICE]).trim();
    return {
      engine: ENGINES.indexOf(r[K_ENGINE]) >= 0 ? r[K_ENGINE] : 'browser',
      browserVoice: str(r[K_BROWSER]),
      localVoice: str(r[K_LOCAL]),
      lang: LANGS.indexOf(r[K_LANG]) >= 0 ? r[K_LANG] : 'auto',
      wakeWord: str(r[K_WAKE_WORD]).trim().slice(0, 40),
      openaiKey: str(r[K_OPENAI]).trim(),
      fishKey: str(r[K_FISH_KEY]).trim(),
      fishVoice: /^[a-f0-9]{32}$/.test(fishVoice) ? fishVoice : FISH_DEFAULT_VOICE
    };
  }
  function hasAny(r) { return !!r && typeof r === 'object' && PREF_KEYS.some(function (k) { return r[k] != null; }); }
  function fromStorage() {
    return new Promise(function (res) {
      try {
        if (!chrome.storage || !chrome.storage.local) { res(null); return; }
        chrome.storage.local.get(PREF_KEYS, function (r) { void chrome.runtime.lastError; res(r || null); });
      } catch (e) { res(null); }
    });
  }
  // An offscreen document has no chrome.storage, so the worker is asked for the keys, and Setup keeps a copy for when it does not answer.
  function fromWorker() {
    return new Promise(function (res) {
      var t = setTimeout(function () { res(null); }, PREFS_WAIT_MS);
      try {
        chrome.runtime.sendMessage({ type: 'NSP_VOICE_PREFS', keys: PREF_KEYS }, function (r) {
          void chrome.runtime.lastError;
          clearTimeout(t);
          res(hasAny(r) ? r : (r && hasAny(r.prefs) ? r.prefs : null));
        });
      } catch (e) { clearTimeout(t); res(null); }
    });
  }
  function fromMirror() {
    try { var r = JSON.parse(localStorage.getItem(MIRROR_KEY) || 'null'); return hasAny(r) ? r : null; } catch (e) { return null; }
  }
  function refreshPrefs(maxAgeMs) {
    if (prefsAt && now() - prefsAt < maxAgeMs) return Promise.resolve(prefs);
    return fromStorage().then(function (r) {
      return hasAny(r) ? r : fromWorker();
    }).then(function (r) {
      prefs = readPrefs(r || fromMirror() || {});
      prefsAt = now();
      return prefs;
    });
  }

  function strip(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, ''); }
  function bare(s) { return strip(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function cleanCmd(s) { return strip(s).replace(FILLER_RE, ' ').replace(/[?!.,;:¿¡]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function isStop(t) { var c = bare(cleanCmd(t)); return !!c && c.split(' ').length <= 4 && STOP_RE.test(c); }
  function cleanTranscript(text) {
    var t = String(text || '').replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/[\p{L}\p{N}]/u.test(t)) return '';
    return NOT_SPEECH_RE.test(bare(t)) ? '' : t;
  }

  function lev(a, b) {
    var m = a.length, n = b.length, prev = [], cur, i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // Spelling to sound, so "Zerack", "Serac" and "Cerak" compare equal: c before e or i and z and x are s, the other c, q, ck and a final g are k.
  function sound(w) {
    return w.replace(/h/g, '').replace(/y/g, 'i').replace(/ck|qu|q/g, 'k').replace(/c(?=[ei])/g, 's').replace(/c/g, 'k')
      .replace(/^x/, 's').replace(/z/g, 's').replace(/g$/, 'k').replace(/(.)\1+/g, '$1');
  }
  var WAKE_LEAD = /^(?:hey|hi|oye|ok|okay|hola|ey|oh|ah|eh)$/;
  var WAKE_STRONG = /^s[ea]r[aeiou]?k[aeiou]?s?$/;
  var WAKE_SOFT = /^s[ea]r[aeiou]?$/;
  function customMatch(words, i, custom) {
    if (!custom) return 0;
    var want = custom.split(' ');
    if (i + want.length > words.length) return 0;
    var got = sound(words.slice(i, i + want.length).join(''));
    var target = sound(want.join(''));
    var slack = target.length >= 5 ? 1 : 0;
    return got === target || (slack && lev(got, target) <= slack) ? want.length : 0;
  }
  // Returns the words after the wake word, or null. loose also takes the soft forms ("Zero.", "Sera,") that only count when Whisper set them apart.
  function wakeSplit(text, customWord, loose) {
    var raw = String(text || '').trim();
    var tokens = raw.split(/\s+/).filter(Boolean);
    var words = tokens.map(function (w) { return strip(w).replace(/[^a-z]/g, ''); });
    var custom = bare(customWord || '');
    var i = 0;
    if (words.length > 1 && WAKE_LEAD.test(words[0])) i = 1;
    var n = customMatch(words, i, custom);
    if (!n && words[i]) {
      var s = sound(words[i]);
      if (WAKE_STRONG.test(s)) n = 1;
      else if (loose && WAKE_SOFT.test(s) && (tokens.length === i + 1 || /[,.!?;:]$/.test(tokens[i]))) n = 1;
    }
    if (!n) return null;
    return tokens.slice(i + n).join(' ').replace(/^[\s,.;:!?-]+/, '').trim();
  }
  // A phrase is addressed when it starts with the name or with "oye" or "hey"; the words after it are returned, or null when it is not.
  function callSplit(text) {
    var named = wakeSplit(text, prefs.wakeWord, true);
    if (named != null) return named;
    var tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length || !CALL_RE.test(strip(tokens[0]).replace(/[^a-z]/g, ''))) return null;
    return tokens.slice(1).join(' ').replace(/^[\s,.;:!?-]+/, '').trim();
  }

  function to16k(input, rate) {
    if (rate === RATE) return new Float32Array(input);
    var ratio = rate / RATE, n = Math.floor(input.length / ratio), out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio)), s = 0;
      for (var j = a; j < b; j++) s += input[j];
      out[i] = b > a ? s / (b - a) : input[a];
    }
    return out;
  }
  function rmsOf(f) {
    var s = 0;
    for (var i = 0; i < f.length; i++) s += f[i] * f[i];
    return f.length ? Math.sqrt(s / f.length) : 0;
  }
  function joined() {
    var out = new Float32Array(ear.samples), at = 0;
    for (var i = 0; i < ear.chunks.length; i++) { out.set(ear.chunks[i], at); at += ear.chunks[i].length; }
    return out;
  }
  function keep(f) { ear.chunks.push(f); ear.samples += f.length; }
  function keepPreroll(f) {
    ear.preroll.push(f);
    ear.prerollSamples += f.length;
    while (ear.preroll.length > 1 && ear.prerollSamples - ear.preroll[0].length >= PREROLL_SAMPLES) ear.prerollSamples -= ear.preroll.shift().length;
  }
  function resetCapture() {
    ear.collecting = false;
    ear.chunks = []; ear.samples = 0;
    ear.preroll = []; ear.prerollSamples = 0;
    ear.speechMs = 0; ear.silenceMs = 0; ear.minRms = 1;
  }
  function muted() { return voice.speaking || Date.now() < mutedUntil; }
  function cmdOpen() { return Date.now() < cmdUntil; }

  function onAudio(input, rate) {
    if (!ear.mode) return;
    var f = to16k(input, rate);
    if (Date.now() < skipUntil) return;
    if (muted()) { resetCapture(); return; }
    var ms = f.length * 1000 / RATE;
    var rms = rmsOf(f);
    var thr = Math.max(MIN_THR, ear.noise * NOISE_MULT);
    if (!ear.collecting) {
      if (rms <= thr) {
        ear.noise = Math.min(NOISE_CAP, ear.noise * 0.95 + rms * 0.05);
        keepPreroll(f);
        if (ear.mode === 'listen' && Date.now() - ear.startedAt > NO_SPEECH_MS) {
          endListen();
          setState('idle', 'no_speech');
        }
        return;
      }
      ear.collecting = true;
      ear.chunks = ear.preroll; ear.samples = ear.prerollSamples;
      ear.preroll = []; ear.prerollSamples = 0;
      ear.speechMs = 0; ear.silenceMs = 0; ear.minRms = rms;
      ear.turn = newTurn(ear.mode === 'wake' && !cmdOpen() ? 'wake' : 'command');
      mark(ear.turn, 'speechStart');
    }
    keep(f);
    if (rms < ear.minRms) ear.minRms = rms;
    if (rms > thr) { ear.speechMs += ms; ear.silenceMs = 0; ear.turn.speechEnd = Math.round(now()); }
    else ear.silenceMs += ms;
    if (ear.silenceMs >= END_SILENCE_MS || ear.samples >= MAX_PHRASE_SAMPLES) {
      if (ear.speechMs < MIN_SPEECH_MS) {
        timings.pop();
        ear.collecting = false; ear.chunks = []; ear.samples = 0; ear.speechMs = 0; ear.silenceMs = 0; ear.minRms = 1;
        return;
      }
      endPhrase();
    }
  }

  function endPhrase() {
    var t = ear.turn, pcm = joined();
    var kind = ear.mode === 'wake' && !cmdOpen() ? 'wake' : 'command';
    mark(t, 'phraseEnd');
    ear.noise = Math.max(ear.noise, Math.min(NOISE_CAP, ear.minRms));
    if (ear.mode === 'listen') endListen(); else resetCapture();
    process(pcm, kind, t);
  }
  function endListen() {
    resetCapture();
    ear.mode = wakeOn && !rec.kind ? 'wake' : null;
    if (!ear.mode && !rec.kind) closeLater();
  }

  function wire(stream) {
    var ctx, src;
    try {
      ctx = new AudioContext({ sampleRate: RATE });
      src = ctx.createMediaStreamSource(stream);
    } catch (e) {
      try { if (ctx) ctx.close(); } catch (x) {}
      ctx = new AudioContext();
      src = ctx.createMediaStreamSource(stream);
    }
    var node = ctx.createScriptProcessor(FRAME, 1, 1);
    node.onaudioprocess = function (ev) { onAudio(ev.inputBuffer.getChannelData(0), ctx.sampleRate); };
    src.connect(node);
    node.connect(ctx.destination);
    ear.stream = stream; ear.ctx = ctx; ear.src = src; ear.node = node;
    ear.noise = NOISE_START;
    stream.getAudioTracks().forEach(function (t) { t.addEventListener('ended', micLost); });
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  }
  function micReason(err) {
    var name = (err && err.name) || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'mic_permission';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'mic_missing';
    if (name === 'NotReadableError' || name === 'AbortError') return 'mic_busy';
    return 'mic_failed';
  }
  function openMic() {
    clearTimeout(ear.closeTimer);
    if (ear.stream) {
      if (ear.ctx && ear.ctx.state === 'suspended') ear.ctx.resume().catch(function () {});
      return Promise.resolve('');
    }
    if (ear.opening) return ear.opening;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve('mic_failed');
    ear.opening = navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(function (stream) {
      try { wire(stream); return ''; }
      catch (e) {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (x) {} });
        return 'mic_failed';
      }
    }, micReason).then(function (why) { ear.opening = null; return why; });
    return ear.opening;
  }
  function closeMic() {
    clearTimeout(ear.closeTimer);
    stopRec();
    if (ear.node) { try { ear.node.onaudioprocess = null; ear.node.disconnect(); } catch (e) {} }
    if (ear.src) { try { ear.src.disconnect(); } catch (e) {} }
    if (ear.stream) ear.stream.getTracks().forEach(function (t) { t.removeEventListener('ended', micLost); try { t.stop(); } catch (e) {} });
    if (ear.ctx) { try { ear.ctx.close(); } catch (e) {} }
    ear.stream = null; ear.ctx = null; ear.src = null; ear.node = null;
    ear.mode = null;
    resetCapture();
  }
  function closeLater(ms) {
    clearTimeout(ear.closeTimer);
    ear.closeTimer = setTimeout(function () { if (!ear.mode && !rec.kind) closeMic(); }, ms == null ? MIC_IDLE_CLOSE_MS : ms);
  }
  function micLost() {
    var wasWake = wakeOn;
    wakeOn = false;
    closeMic();
    closeCmd();
    setState('error', wasWake ? 'mic_lost_wake' : 'mic_lost');
  }

  function checkAssets() {
    if (assetsOk !== null) return Promise.resolve(assetsOk);
    return Promise.all(WHISPER_ASSETS.map(function (p) {
      return fetch(chrome.runtime.getURL(p), { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.ok; }, function () { return false; });
    })).then(function (res) {
      assetsOk = res.every(Boolean);
      return assetsOk;
    });
  }
  function whisper() {
    if (window.NSP_WHISPER && typeof window.NSP_WHISPER.transcribe === 'function') return Promise.resolve(window.NSP_WHISPER);
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { window.removeEventListener('nsp-whisper-ready', on); rej(new Error('the local speech engine did not load')); }, 15000);
      function on() { clearTimeout(t); res(window.NSP_WHISPER); }
      window.addEventListener('nsp-whisper-ready', on, { once: true });
    });
  }
  function warm() {
    return checkAssets().then(function (ok) {
      if (!ok) return false;
      return refreshPrefs(0).then(function (p) {
        return whisper().then(function (w) { return w.warm(null, { language: p.lang === 'auto' ? '' : p.lang }); });
      });
    }).catch(function () { return false; });
  }
  function transcribe(pcm, lang, t) {
    var seconds = pcm.length / RATE;
    var opts = {
      language: lang === 'auto' ? '' : lang,
      timestamps: false,
      maxNewTokens: Math.min(TOKENS_CAP, Math.round(TOKENS_BASE + TOKENS_PER_S * seconds))
    };
    mark(t, 'txStart');
    return whisper().then(function (w) { return w.transcribe(pcm, opts); }).then(function (r) {
      mark(t, 'txDone');
      if (t) { t.txMs = r && r.ms; t.seconds = +seconds.toFixed(2); }
      return { text: cleanTranscript(r && r.text), language: str(r && r.language) || (lang === 'auto' ? '' : lang) };
    });
  }

  function process(pcm, kind, t) {
    var mine = epoch;
    if (kind === 'wake') {
      if (pendingWake >= WAKE_BACKLOG) { timings.pop(); return; }
      pendingWake++;
    } else setState('thinking');
    refreshPrefs(kind === 'wake' ? PREFS_TTL_MS : 0).then(function (p) {
      return transcribe(pcm, p.lang, t);
    }).then(function (r) {
      if (kind === 'wake') pendingWake--;
      if (mine !== epoch) return;
      if (t) t.text = r.text;
      if (kind === 'wake') { wakeRoute(r.text, r.language, t); return; }
      if (!r.text) { setState('idle', 'not_heard'); return; }
      var cmd = wakeSplit(r.text, prefs.wakeWord, false);
      heard(cmd == null || !cleanCmd(cmd) ? r.text : cmd, r.language, t);
    }, function (err) {
      if (kind === 'wake') pendingWake--;
      if (mine !== epoch) return;
      console.warn('[ZERACK voice] transcription failed:', err && err.message);
      assetsOk = null;
      checkAssets().then(function (ok) { setState('error', ok ? 'transcribe_failed' : 'model_missing'); });
    });
  }
  function heard(text, lang, t, addressed) {
    lastLang = lang || lastLang;
    mark(t, 'heard');
    if (t) t.addressed = addressed !== false;
    post({ type: 'NSP_VOICE_HEARD', text: text, lang: lang || '', addressed: addressed !== false });
    setState(cmdOpen() ? 'listening' : 'idle');
  }
  // With the voice on every phrase goes to the worker, which carries out a command and drops anything else that was not addressed.
  function wakeRoute(text, lang, t) {
    if (!text) { if (cmdOpen()) setState('listening', 'wake'); return; }
    if (cmdOpen()) {
      closeCmd();
      if (isStop(text)) { setState('idle'); return; }
      var again = callSplit(text);
      heard(again && cleanCmd(again) ? again : text, lang, t, true);
      return;
    }
    var cmd = callSplit(text);
    if (cmd == null) { heard(text, lang, t, false); return; }
    if (cleanCmd(cmd).length < 2) { chime(); openCmd(); return; }
    if (isStop(cmd)) return;
    heard(cmd, lang, t, true);
  }
  function openCmd() {
    cmdUntil = Date.now() + CMD_WINDOW_MS;
    clearTimeout(cmdTimer);
    cmdTimer = setTimeout(function () { cmdUntil = 0; if (!voice.speaking) setState('idle'); }, CMD_WINDOW_MS + 50);
    setState('listening', 'wake');
  }
  function closeCmd() { cmdUntil = 0; clearTimeout(cmdTimer); }
  function chime() {
    try {
      var ctx = ear.ctx || chimeCtx || (chimeCtx = new AudioContext());
      var o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(880, t0);
      o.frequency.exponentialRampToValueAtTime(1320, t0 + 0.12);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(t0 + 0.26);
      skipUntil = Date.now() + CHIME_SKIP_MS;
    } catch (e) {}
  }

  function useChrome() { return !!SR && !rec.broken; }
  function recLang(p) {
    var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en-US']).map(String);
    var want = p.lang === 'auto' ? '' : p.lang;
    if (!want) return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(list[0]) ? list[0] : 'en-US';
    return find(list, function (l) { return l.toLowerCase().split('-')[0] === want && l.indexOf('-') > 0; }) || (want === 'es' ? 'es-MX' : 'en-US');
  }
  function startRec(kind) {
    stopRec();
    var gen = rec.gen;
    var r;
    try { r = new SR(); } catch (e) { rec.kind = kind; recBroken('construct'); return; }
    r.lang = recLang(prefs);
    r.continuous = kind === 'wake';
    r.interimResults = false;
    r.maxAlternatives = 1;
    rec.r = r; rec.kind = kind; rec.startedAt = Date.now(); rec.got = false; rec.err = '';
    r.onresult = function (e) {
      if (gen !== rec.gen) return;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        rec.got = true;
        onRecText(e.results[i][0] && e.results[i][0].transcript, kind, r.lang);
      }
    };
    r.onerror = function (e) {
      if (gen !== rec.gen) return;
      var code = String((e && e.error) || '');
      if (REC_FALLBACK[code]) { recBroken(code); return; }
      rec.err = code;
    };
    r.onend = function () { if (gen === rec.gen) recEnded(kind); };
    // Handing it the open track keeps one microphone, with echo cancellation, for both recognizers.
    var track = ear.stream && ear.stream.getAudioTracks()[0];
    try { if (track) r.start(track); else r.start(); }
    catch (e) {
      try { r.start(); } catch (x) { recBroken('start'); }
    }
  }
  function stopRec() {
    rec.gen++;
    var r = rec.r;
    rec.r = null; rec.kind = null; rec.paused = false;
    if (r) { try { r.abort(); } catch (e) {} }
  }
  function recBroken(code) {
    var kind = rec.kind;
    note('chrome_speech_' + code);
    rec.broken = code;
    stopRec();
    if (kind === 'wake' && wakeOn) whisperWake();
    else if (kind === 'listen') whisperListen();
  }
  function recEnded(kind) {
    rec.r = null;
    var err = rec.err;
    rec.err = '';
    if (err === 'not-allowed' || err === 'audio-capture') {
      rec.kind = null;
      if (err === 'audio-capture' || wakeOn) { micLost(); return; }
      setState('error', 'mic_permission');
      closeLater(0);
      return;
    }
    if (kind === 'listen') {
      rec.kind = null;
      if (!rec.got && !voice.speaking) setState('idle', 'no_speech');
      if (wakeOn) startRec('wake'); else closeLater();
      return;
    }
    if (!wakeOn || rec.paused) return;
    var quick = Date.now() - rec.startedAt < REC_QUICK_END_MS;
    rec.quick = quick ? Math.min(rec.quick + 1, 5) : 0;
    var gen = rec.gen;
    setTimeout(function () { if (wakeOn && rec.gen === gen && !rec.r && !rec.paused) startRec('wake'); }, quick ? REC_BACKOFF_MS * rec.quick : 0);
  }
  // It hears the speakers too, so it is off while ZERACK talks and comes back after the echo.
  function recPause() {
    if (rec.kind === 'listen') { stopRec(); if (wakeOn) rec.kind = 'wake'; else closeLater(); }
    if (!rec.kind || rec.paused) return;
    rec.paused = true;
    var r = rec.r;
    rec.r = null;
    rec.gen++;
    if (r) { try { r.abort(); } catch (e) {} }
  }
  function recResume() {
    if (!rec.paused) return;
    rec.paused = false;
    if (rec.kind !== 'wake' || !wakeOn) { rec.kind = null; return; }
    var gen = rec.gen;
    setTimeout(function () { if (wakeOn && rec.gen === gen && rec.kind === 'wake' && !rec.r && !rec.paused) startRec('wake'); }, ECHO_TAIL_MS);
  }
  function onRecText(raw, kind, tag) {
    var text = cleanTranscript(raw);
    if (!text || muted()) return;
    var t = newTurn(kind === 'wake' && !cmdOpen() ? 'wake' : 'command');
    t.stt = 'chrome';
    t.text = text;
    mark(t, 'phraseEnd');
    var lang = String(tag || '').slice(0, 2).toLowerCase();
    if (kind === 'wake') { wakeRoute(text, lang, t); return; }
    var cmd = callSplit(text);
    heard(cmd && cleanCmd(cmd) ? cmd : text, lang, t, true);
  }

  function whisperListen() {
    checkAssets().then(function (ok) {
      if (!ok) { setState('error', 'model_missing'); if (!wakeOn) closeLater(0); return; }
      warm();
      resetCapture();
      ear.mode = 'listen';
      ear.startedAt = Date.now();
    });
  }
  function whisperWake() {
    checkAssets().then(function (ok) {
      if (!wakeOn) return;
      if (!ok) { wakeOn = false; setState('error', 'model_missing'); closeLater(0); return; }
      warm();
      if (!ear.mode) { resetCapture(); ear.mode = 'wake'; }
    });
  }
  function listen() {
    if (rec.kind === 'listen') { if (rec.r) { try { rec.r.stop(); } catch (e) {} } return; }
    if (ear.mode === 'listen') {
      if (ear.collecting && ear.speechMs >= MIN_SPEECH_MS) endPhrase();
      return;
    }
    if (voice.speaking) stopSpeaking();
    if (wakeOn && (rec.kind === 'wake' || ear.mode === 'wake')) { chime(); openCmd(); return; }
    closeCmd();
    rec.broken = '';
    setState('listening');
    refreshPrefs(0).then(function () { return openMic(); }).then(function (why) {
      if (why) { setState('error', why); if (!wakeOn) closeLater(0); return; }
      if (useChrome()) startRec('listen'); else whisperListen();
    });
  }
  function setWake(on) {
    wakeOn = !!on;
    if (!wakeOn) {
      closeCmd();
      if (rec.kind === 'wake') stopRec();
      if (ear.mode === 'wake') { ear.mode = null; resetCapture(); }
      if (!ear.mode && !rec.kind) closeLater(0);
      if (!voice.speaking) setState('idle');
      return;
    }
    rec.broken = '';
    refreshPrefs(0).then(function () { return openMic(); }).then(function (why) {
      if (why) { wakeOn = false; setState('error', why); closeLater(0); return; }
      if (!wakeOn) return;
      if (!useChrome()) { whisperWake(); return; }
      if (ear.mode === 'wake') { ear.mode = null; resetCapture(); }
      if (rec.kind) { if (rec.paused) rec.kind = 'wake'; return; }
      if (voice.speaking) { rec.kind = 'wake'; rec.paused = true; return; }
      startRec('wake');
    });
  }
  function stopAll() {
    epoch++;
    closeCmd();
    if (ear.mode === 'listen') endListen();
    else resetCapture();
    if (rec.kind === 'listen') {
      stopRec();
      if (wakeOn) startRec('wake'); else closeLater();
    }
    stopSpeaking();
    setState('idle');
  }

  function speakable(text) {
    var t = String(text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/^\s{0,3}(?:#{1,6}|>|[-*+])\s+/gm, '')
      .replace(/[*_~#|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (t.length <= SPEAK_MAX) return t;
    var cut = t.slice(0, SPEAK_MAX);
    var end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return (end > SPEAK_MAX / 2 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')).trim();
  }
  function chunksOf(t) {
    var parts = t.match(/[^.!?]+[.!?]*\s*/g) || [t], out = [], cur = '';
    parts.forEach(function (p) {
      while (p.length > CHUNK_MAX) {
        if (cur.trim()) { out.push(cur); cur = ''; }
        var i = p.lastIndexOf(' ', CHUNK_MAX);
        if (i < 60) i = CHUNK_MAX;
        out.push(p.slice(0, i));
        p = p.slice(i);
      }
      if ((cur + p).length > CHUNK_MAX) { if (cur.trim()) out.push(cur); cur = p; }
      else cur += p;
    });
    if (cur.trim()) out.push(cur);
    return out.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function textLang(t) {
    var s = ' ' + bare(t) + ' ';
    if (/[ñ¿¡]/i.test(t)) return 'es';
    var es = (s.match(/ (?:el|la|los|las|de|del|que|en|un|una|es|por|para|con|no|y|lo|te|se|hay|abro|busco) /g) || []).length;
    var en = (s.match(/ (?:the|a|an|and|is|are|to|of|in|it|you|that|this|on|for|with|i|opening|searching) /g) || []).length;
    return es > en ? 'es' : en > es ? 'en' : (lastLang === 'es' ? 'es' : 'en');
  }
  function cacheKey(text, engine, p, forced) {
    var norm = bare(text);
    if (!norm || norm.length > CACHE_TEXT_MAX || !(forced || FIXED_LINES.test(norm))) return '';
    var who = engine === 'fish' ? p.fishVoice : engine === 'openai' ? OPENAI_MODEL + '/' + OPENAI_VOICE : engine === 'local' ? localVoiceName(p) : '';
    return who ? engine + '|' + who + '|' + norm : '';
  }

  function say(text, cacheFlag) {
    var t = speakable(text);
    var token = ++voice.token;
    var trn = timings.length && timings[timings.length - 1].heard != null && timings[timings.length - 1].sayAt == null ? timings[timings.length - 1] : newTurn('say');
    if (ear.mode === 'listen') endListen();
    stopPlayback();
    if (!t) { afterSpeech(token); return; }
    recPause();
    voice.speaking = true;
    trn.sayAt = Math.round(now());
    trn.said = t.slice(0, 80);
    setState('speaking');
    refreshPrefs(0).then(function (p) {
      if (token !== voice.token) return;
      return engineFor(p).then(function (engine) {
        if (token !== voice.token) return;
        trn.engine = engine;
        var key = cacheKey(t, engine, p, cacheFlag);
        var run = engine === 'fish' ? speakFish : engine === 'openai' ? speakOpenAI : engine === 'local' ? speakLocal : speakBrowser;
        return run(t, token, p, key, trn);
      });
    }).catch(function (e) { console.warn('[ZERACK voice] speech failed:', e && e.message); }).then(function () { afterSpeech(token); });
  }
  function afterSpeech(token) {
    if (token !== voice.token) return;
    voice.speaking = false;
    mutedUntil = Date.now() + ECHO_TAIL_MS;
    recResume();
    setState(cmdOpen() ? 'listening' : 'idle', cmdOpen() ? 'wake' : '');
  }
  function stopPlayback() {
    if (voice.abort) { try { voice.abort.abort(); } catch (e) {} voice.abort = null; }
    if (voice.audio) { try { voice.audio.pause(); } catch (e) {} }
    if (voice.finish) voice.finish();
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  }
  function stopSpeaking() {
    voice.token++;
    stopPlayback();
    if (voice.speaking) { voice.speaking = false; mutedUntil = Date.now() + ECHO_TAIL_MS; }
    recResume();
  }
  function engineFor(p) {
    if (p.engine !== 'local') return Promise.resolve(p.engine);
    return probeLocal(false).then(function () {
      if (local.voices.length) return 'local';
      note('local_down');
      return 'browser';
    });
  }

  function browserVoices() {
    if (!window.speechSynthesis) return Promise.resolve([]);
    var list = speechSynthesis.getVoices();
    if (list.length) return Promise.resolve(list);
    return new Promise(function (res) {
      var t = setTimeout(function () { res(speechSynthesis.getVoices()); }, 1500);
      speechSynthesis.addEventListener('voiceschanged', function () { clearTimeout(t); res(speechSynthesis.getVoices()); }, { once: true });
    });
  }
  function langOf(v) { return String(v.lang || '').slice(0, 2).toLowerCase(); }
  function bestVoiceFor(list, lang) {
    var of = function (v) { return langOf(v) === lang; };
    return (lang === 'en' && find(list, function (v) { return v.name === 'Google UK English Male'; }))
      || find(list, function (v) { return /^Google\b/.test(v.name) && of(v); })
      || find(list, function (v) { return v.localService && of(v); })
      || find(list, of) || null;
  }
  function pickBrowserVoice(list, p, lang) {
    var mine = find(list, function (v) { return v.name === p.browserVoice; });
    if (mine && langOf(mine) === lang) return mine;
    return bestVoiceFor(list, lang) || mine || find(list, function (v) { return v.default; }) || list[0] || null;
  }
  function sayChunks(parts, v, token, trn) {
    return parts.reduce(function (acc, part) {
      return acc.then(function () {
        if (token !== voice.token) return;
        return new Promise(function (res, rej) {
          var u = new SpeechSynthesisUtterance(part);
          var guard = setTimeout(res, 4000 + part.length * 150);
          if (v) { u.voice = v; u.lang = v.lang; }
          u.rate = 1.02;
          u.onstart = function () { mark(trn, 'firstAudio'); };
          u.onend = function () { clearTimeout(guard); res(); };
          u.onerror = function (e) {
            clearTimeout(guard);
            var code = e && e.error;
            if (code === 'interrupted' || code === 'canceled') res();
            else rej(new Error(code || 'synthesis-failed'));
          };
          speechSynthesis.speak(u);
        });
      });
    }, Promise.resolve());
  }
  function speakBrowser(t, token, p, key, trn) {
    if (!window.speechSynthesis) return Promise.resolve();
    var lang = textLang(t);
    return browserVoices().then(function (list) {
      var v = pickBrowserVoice(list, p, lang);
      if (trn) trn.voice = v ? v.name : '';
      return sayChunks(chunksOf(t), v, token, trn).catch(function () {
        if (token !== voice.token || !v || v.localService) return;
        var offline = find(list, function (x) { return x.localService && langOf(x) === lang; }) || find(list, function (x) { return x.localService; });
        if (!offline) return;
        note('google_voice_failed');
        return sayChunks(chunksOf(t), offline, token, trn).catch(function () {});
      });
    });
  }

  function cacheDb() {
    if (cacheDb.p) return cacheDb.p;
    cacheDb.p = new Promise(function (res) {
      try {
        var rq = indexedDB.open(CACHE_DB, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore(CACHE_STORE); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return cacheDb.p;
  }
  function cacheGet(key) {
    if (!key) return Promise.resolve(null);
    return cacheDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try {
          var rq = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(key);
          rq.onsuccess = function () { res(rq.result instanceof Blob && rq.result.size ? rq.result : null); };
          rq.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
    });
  }
  function cachePut(key, blob) {
    if (!key || !blob || !blob.size) return;
    cacheDb().then(function (db) {
      if (!db) return;
      try { db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).put(blob, key); } catch (e) {}
    });
  }

  function playBlob(blob, token, trn) {
    return new Promise(function (res, rej) {
      if (token !== voice.token) { res(); return; }
      var url = URL.createObjectURL(blob);
      var a = new Audio(url);
      var over = false;
      function end(ok) {
        return function () {
          if (over) return;
          over = true;
          URL.revokeObjectURL(url);
          if (voice.audio === a) voice.audio = null;
          voice.finish = null;
          if (ok) res(); else rej({ play: true });
        };
      }
      voice.audio = a;
      voice.finish = end(true);
      a.addEventListener('playing', function () { mark(trn, 'firstAudio'); }, { once: true });
      a.onended = end(true);
      a.onerror = end(false);
      a.play().catch(end(false));
    });
  }
  function canStream(res) {
    var type = String(res.headers.get('content-type') || '').toLowerCase();
    return !!(res.body && window.MediaSource && MediaSource.isTypeSupported('audio/mpeg') && /mpeg|mp3|octet-stream/.test(type || 'audio/mpeg'));
  }
  // Plays the mp3 while it downloads; resolves with the whole file when the body was read to the end, for the cache.
  function playStream(res, token, trn, keepBytes) {
    return new Promise(function (resolve, reject) {
      if (token !== voice.token) { resolve(null); return; }
      var ms = new MediaSource();
      var url = URL.createObjectURL(ms);
      var a = new Audio(url);
      var reader = res.body.getReader();
      var queue = [], parts = [], sb = null, done = false, over = false, started = false;
      function finish(ok, err) {
        if (over) return;
        over = true;
        try { reader.cancel(); } catch (e) {}
        URL.revokeObjectURL(url);
        if (voice.audio === a) voice.audio = null;
        voice.finish = null;
        if (ok) resolve(done && keepBytes ? new Blob(parts, { type: 'audio/mpeg' }) : null);
        else reject(err || { play: true });
      }
      function pump() {
        if (over || !sb || sb.updating) return;
        if (queue.length) {
          try { sb.appendBuffer(queue.shift()); } catch (e) { finish(false, { play: true }); }
          return;
        }
        if (done && ms.readyState === 'open') { try { ms.endOfStream(); } catch (e) {} }
      }
      function read() {
        reader.read().then(function (r) {
          if (over) return;
          if (r.done) { done = true; pump(); return; }
          queue.push(r.value);
          if (keepBytes) parts.push(r.value);
          pump();
          if (!started && sb) { started = true; a.play().catch(function () { finish(false, { play: true }); }); }
          read();
        }, function (err) { if (!over) finish(false, err); });
      }
      ms.addEventListener('sourceopen', function () {
        try { sb = ms.addSourceBuffer('audio/mpeg'); sb.mode = 'sequence'; }
        catch (e) { finish(false, { play: true }); return; }
        sb.addEventListener('updateend', pump);
        pump();
        if (!started && queue.length) { started = true; a.play().catch(function () { finish(false, { play: true }); }); }
      }, { once: true });
      voice.audio = a;
      voice.finish = function () { finish(true); };
      a.addEventListener('playing', function () { mark(trn, 'firstAudio'); }, { once: true });
      a.onended = function () { finish(true); };
      a.onerror = function () { finish(false, { play: true }); };
      read();
    });
  }
  function fetchAudio(url, init, token, key, trn) {
    return cacheGet(key).then(function (hit) {
      if (token !== voice.token) return;
      if (hit) { if (trn) trn.cached = true; return playBlob(hit, token, trn); }
      var ac = new AbortController();
      voice.abort = ac;
      init.signal = ac.signal;
      mark(trn, 'fetchAt');
      return fetch(url, init).then(function (res) {
        if (!res.ok) throw { status: res.status };
        mark(trn, 'firstByte');
        if (canStream(res)) {
          if (trn) trn.streamed = true;
          return playStream(res, token, trn, !!key).then(function (blob) { cachePut(key, blob); });
        }
        return res.blob().then(function (blob) {
          if (key) cachePut(key, blob);
          return playBlob(blob, token, trn);
        });
      }).then(function (v) {
        if (voice.abort === ac) voice.abort = null;
        return v;
      }, function (err) {
        if (voice.abort === ac) voice.abort = null;
        throw err;
      });
    });
  }
  function failReason(prefix, err) {
    if (err && err.play) return prefix + '_play';
    if (err && err.status) return prefix + '_http_' + err.status;
    return prefix + '_unreachable';
  }
  function aborted(err, token) { return token !== voice.token || (err && err.name === 'AbortError'); }
  function speakFish(t, token, p, key, trn) {
    if (!p.fishKey) { note('fish_no_key'); return speakBrowser(t, token, p, '', trn); }
    return fetchAudio(FISH_TTS, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + p.fishKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t, reference_id: p.fishVoice, format: 'mp3' })
    }, token, key, trn).catch(function (err) {
      if (aborted(err, token)) return;
      var why = failReason('fish', err);
      note(why);
      setState('speaking', why);
      return speakBrowser(t, token, p, '', trn);
    });
  }
  function speakOpenAI(t, token, p, key, trn) {
    if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(p.openaiKey)) { note('openai_no_key'); return speakBrowser(t, token, p, '', trn); }
    return fetchAudio(OPENAI_TTS, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + p.openaiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OPENAI_MODEL, voice: OPENAI_VOICE, input: t, instructions: OPENAI_INSTRUCTIONS, response_format: 'mp3' })
    }, token, key, trn).catch(function (err) {
      if (aborted(err, token)) return;
      var why = failReason('openai', err);
      note(why);
      setState('speaking', why);
      return speakBrowser(t, token, p, '', trn);
    });
  }
  function localVoiceName(p) {
    var hit = find(local.voices, function (v) { return v.name === p.localVoice; })
      || find(local.voices, function (v) { return !v.engine; })
      || local.voices[0];
    return hit ? hit.name : '';
  }
  function speakLocal(t, token, p, key, trn) {
    var fd = new FormData();
    fd.append('text', t);
    fd.append('voice', localVoiceName(p));
    return fetchAudio(LOCAL_SERVER + '/tts', { method: 'POST', body: fd }, token, key, trn).catch(function (err) {
      if (aborted(err, token)) return;
      var why = failReason('local', err);
      note(why);
      setState('speaking', why);
      if (!err || !err.status) local.at = 0;
      return speakBrowser(t, token, p, '', trn);
    });
  }
  function parseVoices(data) {
    var list = Array.isArray(data) ? data : (data && Array.isArray(data.voices) ? data.voices : []);
    var out = [];
    list.forEach(function (v) {
      var name = (typeof v === 'string' ? v : (v && typeof v.name === 'string' ? v.name : '')).trim();
      if (!name || find(out, function (x) { return x.name === name; })) return;
      out.push({ name: name, engine: v && typeof v === 'object' && typeof v.engine === 'string' ? v.engine : '' });
    });
    return out;
  }
  function probeLocal(force) {
    if (!force && local.at && Date.now() - local.at < LOCAL_TTL_MS) return Promise.resolve(local.voices);
    var ac = new AbortController();
    var t = setTimeout(function () { ac.abort(); }, 2500);
    return fetch(LOCAL_SERVER + '/voices', { signal: ac.signal, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (data) {
        clearTimeout(t);
        local.voices = parseVoices(data);
        local.at = Date.now();
        return local.voices;
      });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender) {
    if (!msg || typeof msg.type !== 'string' || msg.type.indexOf('NSP_VOICE_') !== 0) return;
    if (!sender || sender.id !== chrome.runtime.id || sender.tab || String(sender.url || '').indexOf(chrome.runtime.getURL('')) !== 0) return;
    if (msg.type === 'NSP_VOICE_LISTEN') listen();
    else if (msg.type === 'NSP_VOICE_SAY') say(msg.text, msg.cache === true);
    else if (msg.type === 'NSP_VOICE_STOP') stopAll();
    else if (msg.type === 'NSP_VOICE_WAKE') setWake(msg.on === true);
  });

  window.NSP_VOICE = {
    timings: timings,
    wakeSplit: wakeSplit,
    callSplit: callSplit,
    recState: function () { return { kind: rec.kind, live: !!rec.r, paused: rec.paused, broken: rec.broken, lang: rec.r ? rec.r.lang : '' }; }
  };
  if (!SR) warm();
})();
