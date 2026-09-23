(function () {
  'use strict';

  var RATE = 16000;
  var FRAME = 2048;
  var MIN_THR = 0.014;
  var NOISE_MULT = 3.2;
  var NOISE_START = 0.004;
  var NOISE_CAP = 0.06;
  var PREROLL_SAMPLES = RATE;
  var END_SILENCE_MS = 800;
  var MIN_SPEECH_MS = 250;
  var MAX_PHRASE_SAMPLES = RATE * 20;
  var TAP_NO_SPEECH_MS = 8000;
  var HOLD_MS = 300;
  var MIN_HOLD_MS = 400;
  var ECHO_TAIL_MS = 350;
  var CHIME_SKIP_MS = 400;
  var MIC_IDLE_CLOSE_MS = 15000;
  var CMD_WINDOW_MS = 20000;
  var ASK_TIMEOUT_MS = 200000;
  var SPEAK_MAX = 1500;
  var CHUNK_MAX = 220;

  var K_ENGINE = 'nsp_voice_engine';
  var K_BROWSER = 'nsp_voice_browser_name';
  var K_LOCAL = 'nsp_voice_local_name';
  var K_WAKE = 'nsp_voice_wake';
  var K_OPENAI = 'nsp_openai_api_key';
  var K_FISH_KEY = 'nsp_fish_api_key';
  var K_FISH_VOICE = 'nsp_fish_voice_id';
  var ENGINES = ['browser', 'fish', 'openai', 'local'];

  var LOCAL_SERVER = 'http://127.0.0.1:7788';
  var FISH_TTS = 'https://api.fish.audio/v1/tts';
  var FISH_DEFAULT_VOICE = 'b7db3acd5f3f40a1b143f4e1ea95db8c';
  var OPENAI_TTS = 'https://api.openai.com/v1/audio/speech';
  var OPENAI_MODEL = 'gpt-4o-mini-tts';
  var OPENAI_VOICE = 'onyx';
  var OPENAI_INSTRUCTIONS = 'Speak as a calm, precise and confident assistant. Even pace, clear diction, a low and steady tone, no excitement and no filler.';
  var FETCH_CMD = 'sh scripts/fetch-assets.sh';
  var MIC_PAGE = 'sidepanel/mic.html';
  var WHISPER_ASSETS = [
    'lib/whisper/ort-wasm.wasm',
    'lib/whisper/ort-wasm-simd.wasm',
    'lib/whisper/models/Xenova/whisper-tiny/onnx/encoder_model_quantized.onnx',
    'lib/whisper/models/Xenova/whisper-tiny/onnx/decoder_model_merged_quantized.onnx'
  ];

  var STOP = ['never mind', 'nevermind', 'forget it', 'thats all', 'thats it', 'stand down', 'go to sleep', 'cancel that', 'stop listening'];
  var NOT_SPEECH = ['you', 'thank you', 'thanks for watching', 'thank you for watching', 'bye'];

  var LABELS = { idle: 'Ready', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' };
  var HINTS = {
    idle: 'Hold to talk, or hold Space. Esc stops.',
    wake: 'Say "Zerack", or hold to talk. Esc stops.',
    hold: 'Release to send. Esc cancels.',
    tap: 'Speak now. It sends when you pause, or tap again.',
    thinking: 'Working on it.',
    speaking: 'Tap the orb or press Esc to stop.'
  };

  var ERRORS = {
    timeout: 'The extension gave no answer in ' + Math.round(ASK_TIMEOUT_MS / 1000) + ' seconds.',
    no_provider_configured: 'No AI provider is set up. Add a key in Options, or enable Ollama.',
    all_busy: 'Every AI provider is busy right now. Try again in a few seconds.',
    all_providers_failed: 'Every configured AI provider failed.'
  };

  function $(id) { return document.getElementById(id); }
  var orb = $('orb'), stateLabel = $('state-label'), hint = $('hint'), badge = $('wake-badge');
  var notice = $('notice'), noticeText = $('notice-text'), noticeCmd = $('notice-cmd');
  var exchange = $('exchange'), youText = $('you-text'), botText = $('bot-text'), exMeta = $('exchange-meta');
  var engineSel = $('engine'), subField = $('sub-field'), subLabel = $('sub-label'), subSel = $('sub-voice');
  var engineNote = $('engine-note'), wakeBox = $('wake');

  var prefs = { engine: 'browser', browserVoice: '', localVoice: '', wake: false };
  var ui = { state: 'idle' };
  var assets = { ok: true, missing: [] };
  var local = { voices: [] };
  var told = {};
  var asking = null;
  var mutedUntil = 0;
  var skipUntil = 0;
  var cmdUntil = 0;
  var cmdTimer = 0;
  var resumeWake = false;
  var chimeCtx = null;
  var whisperWarm = null;

  var ear = {
    stream: null, ctx: null, src: null, node: null, opening: null,
    mode: null, press: null, closeTimer: 0,
    collecting: false, chunks: [], samples: 0, preroll: [], prerollSamples: 0,
    noise: NOISE_START, speechMs: 0, silenceMs: 0, minRms: 1, startedAt: 0
  };

  var voice = { token: 0, audio: null, abort: null, finish: null, utter: null };

  function store(obj) {
    try { chrome.storage.local.set(obj, function () { void chrome.runtime.lastError; }); } catch (e) {}
  }
  function load(keys) {
    return new Promise(function (res) {
      try { chrome.storage.local.get(keys, function (r) { void chrome.runtime.lastError; res(r || {}); }); }
      catch (e) { res({}); }
    });
  }
  function one(key, value) { var o = {}; o[key] = value; return o; }
  function find(list, test) { for (var i = 0; i < list.length; i++) if (test(list[i])) return list[i]; return null; }

  function setNotice(text, cmd, bad) {
    if (!text) { notice.hidden = true; return; }
    noticeText.textContent = text;
    noticeCmd.textContent = cmd || '';
    noticeCmd.hidden = !cmd;
    notice.classList.toggle('bad', !!bad);
    notice.hidden = false;
  }
  function tellOnce(key, text) {
    if (told[key]) return;
    told[key] = true;
    setNotice(text);
  }
  function showMissing() { setNotice('The local speech model is missing. Run this in the extension folder:', FETCH_CMD, true); }

  function wakeLive() { return prefs.wake && !!ear.stream; }
  function cmdOpen() { return Date.now() < cmdUntil; }

  function paintWake() {
    badge.hidden = !wakeLive();
    orb.classList.toggle('armed', wakeLive() && ui.state === 'idle');
  }
  function setState(s, label, hintText) {
    ui.state = s;
    orb.dataset.state = s;
    orb.setAttribute('aria-pressed', s === 'listening' ? 'true' : 'false');
    stateLabel.textContent = label || LABELS[s];
    hint.textContent = hintText || HINTS[s] || HINTS.idle;
    if (s !== 'listening') orb.style.setProperty('--lvl', '0');
    paintWake();
  }
  function settle() {
    if (asking) { setState('thinking', 'Thinking'); return; }
    if (ear.mode === 'hold') { setState('listening', 'Listening', HINTS.hold); return; }
    if (ear.mode === 'tap') { setState('listening', 'Listening', HINTS.tap); return; }
    if (cmdOpen() && ear.mode === 'wake') { setState('listening', 'Go ahead', 'Say what you need, or "never mind".'); return; }
    setState('idle', 'Ready', ear.mode === 'wake' ? HINTS.wake : HINTS.idle);
  }

  function strip(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019`]/g, ''); }
  function cleanCmd(s) { return strip(s).replace(/\b(please|thanks|thank you|um|uh|uhm|erm|hmm|mmm|okay|ok|hey|yeah|i mean|kind of|sort of)\b/g, ' ').replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) d[i] = [i];
    for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  // Word boundaries on both sides: without them "so right now" and "his regular job" woke it, 21 of 34 plain phrases in replay.
  var WAKE_RE = /(?:^|[^a-z])(?:[szx][aeiou]r[aeiou][ckqg][kht]?s?|(?:z|s|x|ze|zee|se|xe|zi)[ -]r[aeiou][ckqg][kht]?s?)(?![a-z])/;
  var CANDS = ['zerack', 'zerak', 'zerac', 'zerach', 'zeract', 'zerrack', 'zerrick', 'zeerack', 'serack', 'serak', 'serac', 'seract', 'sirack', 'sirac', 'zirack', 'zirac', 'xerack', 'xerac', 'z rack', 'zee rack', 'zero rack'];
  var CAND_RES = CANDS.filter(function (c) { return c.length >= 5; }).map(function (c) { return new RegExp('(?:^|[^a-z])' + c + '(?![a-z])'); });
  // Whisper tiny writes the name as "Zero", "Zeryt", "Zerry", "Hazerate" or "Zerub", so the wake listener also accepts that shape as the first word.
  var LEAD_RE = /^[\s"'.,!?-]*(?:(?:hey|hi|okay|ok|oh|ah)[\s,.!-]+)?(?:ha|he)?[zx]err?[aeiouy][a-z]{0,3}(?![a-z])/;
  function wakeWord(t) {
    var words = t.split(/[^a-z]+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length < 5 || w.length > 9 || /^[^szx]/.test(w)) continue;
      for (var c = 0; c < CANDS.length; c++) {
        var cand = CANDS[c];
        if (cand.indexOf(' ') >= 0 || Math.abs(w.length - cand.length) > 1) continue;
        if (lev(w, cand) <= 1) return w;
      }
    }
    return null;
  }
  function wakeEnd(s, loose) {
    var lead = loose ? s.match(LEAD_RE) : null;
    if (lead) return lead[0].length;
    var m = s.match(WAKE_RE);
    if (m) return m.index + m[0].length;
    for (var c = 0; c < CAND_RES.length; c++) { var k = s.match(CAND_RES[c]); if (k) return k.index + k[0].length; }
    var w = wakeWord(s);
    if (w) { var mm = s.match(new RegExp('(?:^|[^a-z])' + w + '(?![a-z])')); if (mm) return mm.index + mm[0].length; }
    return -1;
  }
  function wakeHit(t, loose) { return wakeEnd(strip(t), loose) >= 0; }
  function wordsBeforeWake(t, loose) {
    var s = strip(t), end = wakeEnd(s, loose);
    return end < 0 ? -1 : s.slice(0, end).trim().split(/\s+/).filter(Boolean).length;
  }
  function afterWake(t, loose) {
    var n = wordsBeforeWake(t, loose);
    if (n < 0) return '';
    return String(t || '').trim().split(/\s+/).slice(n).join(' ').replace(/^[\s,.;:!?-]+/, '').trim();
  }
  function dropLeadingWake(t) {
    var n = wordsBeforeWake(t);
    if (n < 0 || n > 3) return t;
    return afterWake(t) || t;
  }
  function isStop(t) {
    var c = cleanCmd(t);
    if (!c || c.split(' ').length > 4) return false;
    c = ' ' + c + ' ';
    return STOP.some(function (s) { return c.indexOf(' ' + s + ' ') >= 0; });
  }
  function cleanTranscript(text) {
    var t = String(text || '').replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/[\p{L}\p{N}]/u.test(t)) return '';
    var bare = strip(t).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    return NOT_SPEECH.indexOf(bare) >= 0 ? '' : t;
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
  function muted() { return !!asking || ui.state === 'speaking' || Date.now() < mutedUntil; }
  function showLevel(x) {
    if (ui.state !== 'listening') return;
    orb.style.setProperty('--lvl', String(Math.max(0, Math.min(1, (x - 0.5) / 2.5)).toFixed(3)));
  }

  function onAudio(input, rate) {
    if (!ear.mode) return;
    var f = to16k(input, rate);
    if (Date.now() < skipUntil) return;
    if (ear.mode === 'wake' && muted()) { resetCapture(); return; }
    var ms = f.length * 1000 / RATE;
    var rms = rmsOf(f);
    var thr = Math.max(MIN_THR, ear.noise * NOISE_MULT);
    showLevel(rms / thr);
    if (ear.mode === 'hold') {
      keep(f);
      if (ear.samples >= MAX_PHRASE_SAMPLES) { ear.press = null; finishHold(); }
      return;
    }
    if (!ear.collecting) {
      if (rms <= thr) {
        ear.noise = Math.min(NOISE_CAP, ear.noise * 0.95 + rms * 0.05);
        keepPreroll(f);
        if (ear.mode === 'tap' && Date.now() - ear.startedAt > TAP_NO_SPEECH_MS) {
          cancelCapture();
          setNotice('Nothing heard. Hold the orb, or tap it, and speak.');
        }
        return;
      }
      ear.collecting = true;
      ear.chunks = ear.preroll; ear.samples = ear.prerollSamples;
      ear.preroll = []; ear.prerollSamples = 0;
      ear.speechMs = 0; ear.silenceMs = 0; ear.minRms = rms;
      if (ear.mode === 'wake' && cmdOpen()) setState('listening', 'Listening', 'Say what you need, or "never mind".');
    }
    keep(f);
    if (rms < ear.minRms) ear.minRms = rms;
    if (rms > thr) { ear.speechMs += ms; ear.silenceMs = 0; } else ear.silenceMs += ms;
    if (ear.silenceMs >= END_SILENCE_MS || ear.samples >= MAX_PHRASE_SAMPLES) {
      if (ear.speechMs < MIN_SPEECH_MS) {
        ear.collecting = false; ear.chunks = []; ear.samples = 0; ear.speechMs = 0; ear.silenceMs = 0; ear.minRms = 1;
        return;
      }
      endPhrase();
    }
  }

  function endPhrase() {
    var mode = ear.mode, pcm = joined();
    ear.noise = Math.max(ear.noise, Math.min(NOISE_CAP, ear.minRms));
    if (mode === 'tap') endCaptureMode(); else resetCapture();
    heard(pcm, mode === 'wake' ? 'wake' : 'talk');
  }
  function endCaptureMode() {
    resetCapture();
    ear.mode = wakeLive() ? 'wake' : null;
    if (!ear.mode) closeLater();
  }
  function cancelCapture() { endCaptureMode(); settle(); }
  function beginHold() {
    resetCapture();
    ear.mode = 'hold';
    ear.collecting = true;
    ear.startedAt = Date.now();
    setState('listening', 'Listening', HINTS.hold);
  }
  function beginTap() {
    resetCapture();
    ear.mode = 'tap';
    ear.startedAt = Date.now();
    setState('listening', 'Listening', HINTS.tap);
  }
  function holdToTap() {
    var pre = ear.chunks;
    resetCapture();
    ear.mode = 'tap';
    ear.startedAt = Date.now();
    for (var i = 0; i < pre.length; i++) keepPreroll(pre[i]);
    setState('listening', 'Listening', HINTS.tap);
  }
  function finishHold() {
    var ms = ear.samples * 1000 / RATE, pcm = joined();
    endCaptureMode();
    if (ms < MIN_HOLD_MS) { settle(); setNotice('Hold the orb while you talk, then let go.'); return; }
    heard(pcm, 'talk');
  }
  function finishTap() {
    if (ear.collecting && ear.speechMs >= MIN_SPEECH_MS) { endPhrase(); return; }
    cancelCapture();
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
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {}).then(function () {
        if (ctx.state !== 'suspended') return;
        setNotice('Click anywhere in this panel to start the microphone.');
        document.addEventListener('pointerdown', function () { ctx.resume().catch(function () {}); setNotice(''); }, { once: true });
      });
    }
    paintWake();
  }
  function openMic() {
    if (ear.stream) {
      if (ear.ctx && ear.ctx.state === 'suspended') ear.ctx.resume().catch(function () {});
      return Promise.resolve(true);
    }
    if (ear.opening) return ear.opening;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setNotice('This browser gives the panel no microphone access.', '', true);
      return Promise.resolve(false);
    }
    ear.opening = navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(function (stream) {
      try { wire(stream); }
      catch (e) {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (x) {} });
        setNotice('The microphone opened but its audio could not be read (' + ((e && e.name) || 'Error') + ').', '', true);
        return false;
      }
      return true;
    }, function (err) {
      micFailed(err);
      return false;
    }).then(function (ok) { ear.opening = null; return ok; });
    return ear.opening;
  }
  function closeMic() {
    clearTimeout(ear.closeTimer);
    if (ear.node) { try { ear.node.onaudioprocess = null; ear.node.disconnect(); } catch (e) {} }
    if (ear.src) { try { ear.src.disconnect(); } catch (e) {} }
    if (ear.stream) ear.stream.getTracks().forEach(function (t) { t.removeEventListener('ended', micLost); try { t.stop(); } catch (e) {} });
    if (ear.ctx) { try { ear.ctx.close(); } catch (e) {} }
    ear.stream = null; ear.ctx = null; ear.src = null; ear.node = null;
    ear.mode = null;
    resetCapture();
    paintWake();
  }
  function closeLater(ms) {
    clearTimeout(ear.closeTimer);
    ear.closeTimer = setTimeout(function () { if (!ear.mode && !ear.press) closeMic(); }, ms == null ? MIC_IDLE_CLOSE_MS : ms);
  }
  function micLost() {
    var wasWake = prefs.wake;
    ear.press = null;
    closeMic();
    if (wasWake) setWakePref(false);
    settle();
    setNotice('The microphone stopped. It was unplugged or another app took it.', '', true);
  }
  function micFailed(err) {
    var name = (err && err.name) || 'Error';
    if (name === 'NotAllowedError' || name === 'NotFoundError') {
      openMicTab();
      setNotice(name === 'NotFoundError'
        ? 'Chrome reports no microphone to this panel. A tab opened to check it.'
        : 'Chrome needs your permission for the microphone. A tab opened to ask once.', '', true);
      return;
    }
    setNotice('The microphone did not start (' + name + ').', '', true);
  }
  function openMicTab() {
    var url = chrome.runtime.getURL(MIC_PAGE);
    function create() {
      chrome.tabs.query({ active: true, currentWindow: true }, function (act) {
        void chrome.runtime.lastError;
        var opts = { url: url, active: true };
        var t = act && act[0];
        if (t && t.id != null) { opts.openerTabId = t.id; opts.index = t.index + 1; opts.windowId = t.windowId; }
        chrome.tabs.create(opts, function () { void chrome.runtime.lastError; });
      });
    }
    try {
      chrome.tabs.query({ url: url }, function (tabs) {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) { create(); return; }
        chrome.tabs.update(tabs[0].id, { active: true }, function () { void chrome.runtime.lastError; });
        chrome.windows.update(tabs[0].windowId, { focused: true }, function () { void chrome.runtime.lastError; });
      });
    } catch (e) { create(); }
  }
  function watchPermission() {
    if (!navigator.permissions || !navigator.permissions.query) return;
    navigator.permissions.query({ name: 'microphone' }).then(function (st) {
      st.onchange = function () {
        if (st.state !== 'granted') return;
        setNotice('Microphone allowed. Hold the orb to talk.');
        if (resumeWake) { resumeWake = false; setWake(true); }
      };
    }).catch(function () {});
  }
  function micGranted() {
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(false);
    return navigator.permissions.query({ name: 'microphone' }).then(function (st) { return st.state === 'granted'; }, function () { return false; });
  }

  function whisper() {
    if (window.NSP_WHISPER && typeof window.NSP_WHISPER.transcribe === 'function') return Promise.resolve(window.NSP_WHISPER);
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { window.removeEventListener('nsp-whisper-ready', on); rej(new Error('the local speech engine did not load')); }, 15000);
      function on() { clearTimeout(t); res(window.NSP_WHISPER); }
      window.addEventListener('nsp-whisper-ready', on, { once: true });
    });
  }
  function modelProgress(p) {
    if (!p || p.status !== 'progress' || typeof p.progress !== 'number') return;
    if (ui.state === 'thinking') stateLabel.textContent = 'Loading speech model ' + Math.round(p.progress) + '%';
  }
  function warmWhisper() {
    if (whisperWarm || !assets.ok) return;
    whisperWarm = whisper().then(function (w) { return w.warm ? w.warm(modelProgress) : true; }).catch(function () { whisperWarm = null; });
  }
  function transcribe(pcm) {
    return whisper().then(function (w) {
      return w.transcribe(pcm, { onModelProgress: modelProgress });
    }).then(function (out) { return cleanTranscript(out && out.text); });
  }

  var queue = Promise.resolve(), queued = 0;
  function heard(pcm, kind) {
    if (kind === 'wake' && queued > 1) return;
    queued++;
    if (kind === 'talk' || cmdOpen()) setState('thinking', 'Transcribing');
    queue = queue.then(function () { return transcribe(pcm); }).then(function (text) {
      queued--;
      route(text, kind);
    }, function (err) {
      queued--;
      var why = String((err && err.message) || err || 'unknown error');
      checkAssets().then(function () {
        if (!assets.ok) { showMissing(); return; }
        setNotice('Local transcription failed: ' + why, '', true);
      });
      if (!asking && ui.state !== 'speaking') settle();
    });
  }

  function route(text, kind) {
    if (asking || ui.state === 'speaking') return;
    if (kind === 'wake') {
      if (!text) { settle(); return; }
      var woke = wakeHit(text, true);
      if (!woke && !cmdOpen()) { settle(); return; }
      var cmd = woke ? afterWake(text, true) : text;
      closeCmdWindow();
      if (cleanCmd(cmd).length < 2) {
        chime();
        openCmdWindow();
        return;
      }
      if (isStop(cmd)) { settle(); return; }
      ask(cmd);
      return;
    }
    if (!text) { settle(); setNotice('I did not catch that. Hold the orb and try again.'); return; }
    ask(dropLeadingWake(text));
  }
  function openCmdWindow() {
    cmdUntil = Date.now() + CMD_WINDOW_MS;
    clearTimeout(cmdTimer);
    cmdTimer = setTimeout(function () { cmdUntil = 0; if (ui.state === 'listening' && ear.mode === 'wake' && !ear.collecting) settle(); }, CMD_WINDOW_MS + 50);
    settle();
  }
  function closeCmdWindow() { cmdUntil = 0; clearTimeout(cmdTimer); }

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

  function showExchange(you, bot, meta, failed) {
    exchange.hidden = false;
    if (you != null) youText.textContent = you;
    botText.textContent = bot || '...';
    botText.style.color = bot ? (failed ? 'var(--red)' : '') : 'var(--ink-3)';
    exMeta.textContent = meta || '';
  }
  function humanError(code) {
    if (!/^[a-z0-9_]+$/.test(code)) return code;
    var s = code.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }
  function ask(text) {
    var id = 'voice-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    var settled = false;
    asking = id;
    setNotice('');
    showExchange(text, '', '');
    setState('thinking', 'Thinking');
    var timer = setTimeout(function () { done({ ok: false, error: 'timeout' }); }, ASK_TIMEOUT_MS);
    function done(reply) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (asking !== id) return;
      asking = null;
      answer(reply);
    }
    try {
      chrome.runtime.sendMessage({ type: 'NSP_VOICE_ASK', text: text, requestId: id }, function (reply) {
        var err = chrome.runtime.lastError;
        if (err) { done({ ok: false, error: 'no_reply', detail: err.message }); return; }
        done(reply);
      });
    } catch (e) { done({ ok: false, error: 'no_reply', detail: String((e && e.message) || e) }); }
  }
  function answer(reply) {
    var r = reply || { ok: false, error: 'no_reply' };
    var body = r.ok ? String(r.answer == null ? '' : r.answer).trim() : '';
    if (body) {
      var meta = r.actedOnTab === true ? 'Went through the assistant on your YouTube tab.'
        : r.actedOnTab === false ? 'No YouTube tab was ready, so it answered directly.' : '';
      showExchange(null, body, meta);
      speak(body);
      return;
    }
    var code = r.ok ? 'empty_answer' : String(r.error || 'no_reply');
    var msg = code === 'no_reply' ? 'The extension did not answer' + (r.detail ? ' (' + r.detail + ').' : '.')
      : code === 'empty_answer' ? 'The assistant returned an empty answer.'
      : (ERRORS[code] || humanError(code));
    showExchange(null, msg, '', true);
    speak(msg);
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

  function effectiveEngine() {
    if (prefs.engine === 'local' && !local.voices.length) {
      tellOnce('local_down', 'The local voice server is not answering, so answers use the free browser voice.');
      return 'browser';
    }
    return prefs.engine;
  }
  function speak(text) {
    var t = speakable(text);
    var token = ++voice.token;
    if (!t) { afterSpeech(); return Promise.resolve(); }
    setState('speaking', 'Speaking');
    var engine = effectiveEngine();
    var run = engine === 'fish' ? speakFish : engine === 'openai' ? speakOpenAI : engine === 'local' ? speakLocal : speakBrowser;
    return run(t, token).catch(function () {}).then(function () {
      if (token === voice.token) afterSpeech();
    });
  }
  function afterSpeech() {
    mutedUntil = Date.now() + ECHO_TAIL_MS;
    settle();
  }
  function stopSpeaking() {
    voice.token++;
    if (voice.abort) { try { voice.abort.abort(); } catch (e) {} voice.abort = null; }
    if (voice.audio) { try { voice.audio.pause(); } catch (e) {} }
    if (voice.finish) voice.finish();
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    mutedUntil = Date.now() + ECHO_TAIL_MS;
    if (ui.state === 'speaking') settle();
  }

  function browserVoices() {
    if (!window.speechSynthesis) return Promise.resolve([]);
    var now = speechSynthesis.getVoices();
    if (now.length) return Promise.resolve(now);
    return new Promise(function (res) {
      var t = setTimeout(function () { res(speechSynthesis.getVoices()); }, 1500);
      speechSynthesis.addEventListener('voiceschanged', function () { clearTimeout(t); res(speechSynthesis.getVoices()); }, { once: true });
    });
  }
  function isEnglish(v) { return /^en/i.test(v.lang || ''); }
  function bestBrowserVoice(list) {
    return find(list, function (v) { return v.name === 'Google UK English Male'; })
      || find(list, function (v) { return /^Google\b/.test(v.name) && isEnglish(v); })
      || find(list, function (v) { return v.default; })
      || find(list, isEnglish)
      || list[0] || null;
  }
  function pickBrowserVoice(list) {
    return find(list, function (v) { return v.name === prefs.browserVoice; }) || bestBrowserVoice(list);
  }
  function bestOfflineVoice(list) {
    return find(list, function (v) { return v.localService && isEnglish(v); }) || find(list, function (v) { return v.localService; });
  }
  function sayChunks(parts, v, token) {
    return parts.reduce(function (p, part) {
      return p.then(function () {
        if (token !== voice.token) return;
        return new Promise(function (res, rej) {
          var u = new SpeechSynthesisUtterance(part);
          var guard = setTimeout(res, 4000 + part.length * 150);
          if (v) { u.voice = v; u.lang = v.lang; }
          u.rate = 1.02;
          u.onend = function () { clearTimeout(guard); res(); };
          u.onerror = function (e) {
            clearTimeout(guard);
            var code = e && e.error;
            if (code === 'interrupted' || code === 'canceled') res();
            else rej(new Error(code || 'synthesis-failed'));
          };
          voice.utter = u;
          speechSynthesis.speak(u);
        });
      });
    }, Promise.resolve());
  }
  function speakBrowser(t, token) {
    if (!window.speechSynthesis) return Promise.resolve();
    return browserVoices().then(function (list) {
      var v = pickBrowserVoice(list);
      return sayChunks(chunksOf(t), v, token).catch(function () {
        if (token !== voice.token || !v || v.localService) return;
        var offline = bestOfflineVoice(list);
        if (!offline) return;
        tellOnce('google_offline', 'Google could not read that voice, so this answer used ' + offline.name + ', which runs on this computer.');
        return sayChunks(chunksOf(t), offline, token).catch(function () {});
      });
    });
  }
  function playBlob(blob, token) {
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
      a.onended = end(true);
      a.onerror = end(false);
      a.play().catch(end(false));
    });
  }
  function fetchAudio(url, init, token) {
    var ac = new AbortController();
    voice.abort = ac;
    init.signal = ac.signal;
    return fetch(url, init).then(function (res) {
      if (!res.ok) throw { status: res.status };
      return res.blob();
    }).then(function (blob) {
      if (voice.abort === ac) voice.abort = null;
      return playBlob(blob, token);
    }, function (err) {
      if (voice.abort === ac) voice.abort = null;
      throw err;
    });
  }
  function speakFish(t, token) {
    return load([K_FISH_KEY, K_FISH_VOICE]).then(function (r) {
      if (token !== voice.token) return;
      var key = typeof r[K_FISH_KEY] === 'string' ? r[K_FISH_KEY].trim() : '';
      var ref = typeof r[K_FISH_VOICE] === 'string' && /^[a-f0-9]{32}$/.test(r[K_FISH_VOICE]) ? r[K_FISH_VOICE] : FISH_DEFAULT_VOICE;
      if (!key) {
        tellOnce('fish_key', 'There is no Fish Audio key in Setup, so this answer used the free browser voice.');
        return speakBrowser(t, token);
      }
      return fetchAudio(FISH_TTS, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t, reference_id: ref, format: 'mp3' })
      }, token).catch(function (err) {
        if (token !== voice.token || (err && err.name === 'AbortError')) return;
        var s = err && err.status;
        var why = err && err.play ? 'The Fish Audio voice would not play'
          : s === 401 ? 'Fish Audio refused the key (HTTP 401)'
          : s === 402 ? 'Fish Audio says the account has no credit left (HTTP 402)'
          : s === 403 ? 'Fish Audio will not let this key use that voice (HTTP 403)'
          : s === 429 ? 'Fish Audio is rate limiting this key (HTTP 429)'
          : s ? 'Fish Audio answered HTTP ' + s
          : 'Fish Audio could not be reached';
        tellOnce('fish_' + (err && err.play ? 'play' : (s || 'net')), why + ', so this answer used the free browser voice.');
        return speakBrowser(t, token);
      });
    });
  }
  function speakOpenAI(t, token) {
    return load([K_OPENAI]).then(function (r) {
      if (token !== voice.token) return;
      var key = typeof r[K_OPENAI] === 'string' ? r[K_OPENAI].trim() : '';
      if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(key)) {
        tellOnce('openai_key', 'There is no valid OpenAI key in Options, so this answer used the free browser voice.');
        return speakBrowser(t, token);
      }
      return fetchAudio(OPENAI_TTS, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OPENAI_MODEL, voice: OPENAI_VOICE, input: t, instructions: OPENAI_INSTRUCTIONS, response_format: 'mp3' })
      }, token).catch(function (err) {
        if (token !== voice.token || (err && err.name === 'AbortError')) return;
        var s = err && err.status;
        var why = err && err.play ? 'The OpenAI audio would not play'
          : s === 401 ? 'OpenAI refused the key (HTTP 401)'
          : s === 429 ? 'OpenAI is rate limiting this key or it has no credit left (HTTP 429)'
          : s ? 'OpenAI answered HTTP ' + s
          : 'OpenAI could not be reached';
        tellOnce('openai_' + (err && err.play ? 'play' : (s || 'net')), why + ', so this answer used the free browser voice.');
        return speakBrowser(t, token);
      });
    });
  }
  function localVoiceName() {
    var hit = find(local.voices, function (v) { return v.name === prefs.localVoice; })
      || find(local.voices, function (v) { return !v.engine; })
      || local.voices[0];
    return hit ? hit.name : '';
  }
  function speakLocal(t, token) {
    var name = localVoiceName();
    var fd = new FormData();
    fd.append('text', t);
    fd.append('voice', name);
    return fetchAudio(LOCAL_SERVER + '/tts', { method: 'POST', body: fd }, token).catch(function (err) {
      if (token !== voice.token || (err && err.name === 'AbortError')) return;
      var s = err && err.status;
      var why = err && err.play ? 'The local voice audio would not play'
        : s === 402 ? 'The local voice server will not use "' + name + '" because it is a paid voice and no spend permission is open there'
        : s ? 'The local voice server answered HTTP ' + s
        : 'The local voice server stopped answering';
      tellOnce('local_' + (err && err.play ? 'play' : (s || 'net')), why + ', so this answer used the free browser voice.');
      if (!s) probeLocal();
      return speakBrowser(t, token);
    });
  }

  function parseVoices(data) {
    var list = Array.isArray(data) ? data : (data && Array.isArray(data.voices) ? data.voices : []);
    var out = [];
    list.forEach(function (v) {
      var name = typeof v === 'string' ? v : (v && typeof v.name === 'string' ? v.name : '');
      name = name.trim();
      if (!name || find(out, function (x) { return x.name === name; })) return;
      out.push({ name: name, engine: v && typeof v === 'object' && typeof v.engine === 'string' ? v.engine : '' });
    });
    return out;
  }
  function probeLocal() {
    var ac = new AbortController();
    var t = setTimeout(function () { ac.abort(); }, 2500);
    return fetch(LOCAL_SERVER + '/voices', { signal: ac.signal, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (data) {
        clearTimeout(t);
        local.voices = parseVoices(data);
        paintEngine();
      });
  }
  function localLabel(v) {
    if (!v.engine) return v.name + ' (on this computer)';
    if (v.engine === 'fish') return v.name + ' (paid, through Fish Audio)';
    return v.name + ' (' + v.engine + ')';
  }
  function fillSelect(sel, items, selected) {
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it.value;
      o.textContent = it.label;
      sel.appendChild(o);
    });
    if (selected != null) sel.value = selected;
  }
  function paintEngine() {
    var localOpt = engineSel.querySelector('option[value="local"]');
    var hasLocal = local.voices.length > 0;
    localOpt.hidden = !hasLocal;
    localOpt.disabled = !hasLocal;
    var eff = prefs.engine === 'local' && !hasLocal ? 'browser' : prefs.engine;
    engineSel.value = eff;
    engineNote.classList.remove('paid');
    if (eff === 'fish') {
      subField.hidden = true;
      engineNote.textContent = 'Paid. Every spoken answer is billed to your Fish Audio key, in the ZERACK voice. Pick the browser voice to stop.';
      engineNote.classList.add('paid');
      return;
    }
    if (eff === 'openai') {
      subField.hidden = true;
      engineNote.textContent = 'Paid. Every spoken answer is billed to your OpenAI key. Pick the browser voice to stop.';
      engineNote.classList.add('paid');
      return;
    }
    if (eff === 'local') {
      var name = localVoiceName();
      subLabel.textContent = 'Server voice';
      fillSelect(subSel, local.voices.map(function (v) { return { value: v.name, label: localLabel(v) }; }), name);
      subField.hidden = false;
      var v = find(local.voices, function (x) { return x.name === name; });
      var paid = !!(v && v.engine === 'fish');
      engineNote.textContent = paid
        ? 'Paid. The server bills this voice through Fish Audio, and refuses it unless you opened a spend permission there.'
        : 'Runs on the voice server on this computer. Free.';
      if (paid) engineNote.classList.add('paid');
      return;
    }
    subLabel.textContent = 'Browser voice';
    browserVoices().then(function (list) {
      if (engineSel.value !== 'browser') return;
      var v = pickBrowserVoice(list);
      var sorted = list.slice().sort(function (a, b) {
        var ea = isEnglish(a) ? 0 : 1, eb = isEnglish(b) ? 0 : 1;
        return ea - eb || a.name.localeCompare(b.name);
      });
      fillSelect(subSel, sorted.map(function (x) {
        return { value: x.name, label: x.name + ' (' + x.lang + (x.localService ? '' : ', online') + ')' };
      }), v ? v.name : null);
      subField.hidden = !list.length;
      engineNote.textContent = !v ? 'Chrome exposes no voice here, so answers are shown and not spoken.'
        : v.localService ? 'Free, and runs on this computer.'
        : 'Free. Google reads this voice on its servers: the answer text is sent, never your microphone.';
    });
  }

  function checkAssets() {
    return Promise.all(WHISPER_ASSETS.map(function (p) {
      return fetch(chrome.runtime.getURL(p), { cache: 'no-store' }).then(function (r) {
        var ok = r.ok;
        try { if (r.body) r.body.cancel(); } catch (e) {}
        return ok;
      }, function () { return false; });
    })).then(function (res) {
      assets.missing = WHISPER_ASSETS.filter(function (p, i) { return !res[i]; });
      assets.ok = !assets.missing.length;
      if (!assets.ok) showMissing();
      return assets.ok;
    });
  }

  function setWakePref(on) {
    prefs.wake = on;
    wakeBox.checked = on;
    store(one(K_WAKE, on));
    paintWake();
  }
  function setWake(on) {
    if (!on) {
      resumeWake = false;
      closeCmdWindow();
      setWakePref(false);
      if (ear.mode === 'wake') { ear.mode = null; resetCapture(); }
      if (!ear.mode && !ear.press) closeLater(0);
      settle();
      return;
    }
    if (!assets.ok) { setWakePref(false); showMissing(); return; }
    setWakePref(true);
    openMic().then(function (ok) {
      if (!ok) { resumeWake = true; setWakePref(false); settle(); return; }
      if (!prefs.wake) return;
      clearTimeout(ear.closeTimer);
      if (!ear.mode) { resetCapture(); ear.mode = 'wake'; }
      warmWhisper();
      settle();
    });
  }

  function press() {
    if (ear.press) return;
    if (asking) { hint.textContent = 'Still working on the last one.'; return; }
    if (!assets.ok) { showMissing(); return; }
    if (ear.mode === 'tap') { finishTap(); return; }
    var p = { at: Date.now(), releasedAt: 0, interrupted: ui.state === 'speaking' };
    if (p.interrupted) stopSpeaking();
    ear.press = p;
    closeCmdWindow();
    clearTimeout(ear.closeTimer);
    warmWhisper();
    openMic().then(function (ok) {
      if (ear.press !== p) return;
      if (!ok) { ear.press = null; settle(); return; }
      if (p.releasedAt) {
        ear.press = null;
        if (p.interrupted && p.releasedAt - p.at < HOLD_MS) { endCaptureMode(); settle(); return; }
        beginTap();
        return;
      }
      beginHold();
    });
  }
  function release() {
    var p = ear.press;
    if (!p || p.releasedAt) return;
    p.releasedAt = Date.now();
    if (ear.mode !== 'hold') return;
    ear.press = null;
    if (p.releasedAt - p.at < HOLD_MS) {
      if (p.interrupted) { cancelCapture(); return; }
      holdToTap();
      return;
    }
    finishHold();
  }
  function escape() {
    if (ui.state === 'speaking') { stopSpeaking(); return; }
    if (ear.press || ear.mode === 'hold' || ear.mode === 'tap') { ear.press = null; cancelCapture(); return; }
    if (cmdOpen()) { closeCmdWindow(); settle(); }
  }
  function typing(el) {
    if (!el || el === document.body) return false;
    var tag = el.tagName;
    return tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' || !!el.isContentEditable;
  }
  function isSpace(e) { return e.code === 'Space' || e.key === ' '; }

  function bind() {
    orb.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      try { orb.setPointerCapture(e.pointerId); } catch (x) {}
      press();
    });
    orb.addEventListener('pointerup', release);
    orb.addEventListener('pointercancel', release);
    orb.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.repeat) return;
      e.preventDefault();
      press();
      release();
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { escape(); return; }
      if (!isSpace(e) || typing(e.target)) return;
      e.preventDefault();
      if (!e.repeat) press();
    });
    window.addEventListener('keyup', function (e) {
      if (!isSpace(e) || typing(e.target)) return;
      e.preventDefault();
      release();
    });
    window.addEventListener('blur', function () { if (ear.press) release(); });
    engineSel.addEventListener('change', function () {
      var v = engineSel.value;
      if (ENGINES.indexOf(v) < 0) return;
      prefs.engine = v;
      store(one(K_ENGINE, v));
      paintEngine();
    });
    subSel.addEventListener('change', function () {
      if (engineSel.value === 'browser') { prefs.browserVoice = subSel.value; store(one(K_BROWSER, subSel.value)); }
      else if (engineSel.value === 'local') { prefs.localVoice = subSel.value; store(one(K_LOCAL, subSel.value)); }
      paintEngine();
    });
    wakeBox.addEventListener('change', function () { setWake(wakeBox.checked); });
    if (window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', function () { if (engineSel.value === 'browser') paintEngine(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') probeLocal(); });
  }

  function boot() {
    bind();
    settle();
    watchPermission();
    load([K_ENGINE, K_BROWSER, K_LOCAL, K_WAKE]).then(function (r) {
      prefs.engine = ENGINES.indexOf(r[K_ENGINE]) >= 0 ? r[K_ENGINE] : 'browser';
      prefs.browserVoice = typeof r[K_BROWSER] === 'string' ? r[K_BROWSER] : '';
      prefs.localVoice = typeof r[K_LOCAL] === 'string' ? r[K_LOCAL] : '';
      paintEngine();
      probeLocal();
      return checkAssets().then(function (ok) {
        if (r[K_WAKE] !== true) return;
        if (!ok) { setWakePref(false); return; }
        return micGranted().then(function (granted) {
          if (granted) setWake(true); else setWakePref(false);
        });
      });
    });
  }

  boot();
})();
