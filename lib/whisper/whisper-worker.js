import { pipeline, env, spectrogram, Tensor } from './transformers.min.js';

var base = new URL('.', import.meta.url).href;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = base + 'models/';
try {
  env.backends.onnx.wasm.wasmPaths = base;
  env.backends.onnx.wasm.numThreads = 1;
} catch (eW) {}

var MODEL = 'Xenova/whisper-tiny';
var RATE = 16000;
var WINDOW_S = 30;
var STRIDE_S = 5;
var LANG_CODE = /^[a-z]{2,3}$/;
var LANG_TOKEN = /^<\|([a-z]{2,3})\|>$/;

var LOG_FLOOR = -10;

var _pipe = null, _pipeP = null, _line = Promise.resolve();

// Whisper pads every clip to 30 s and every padding frame comes out the same value, so only the frames that hold audio are computed.
function quickFeatures(fe) {
  var full = fe._call.bind(fe);
  fe._call = function (audio) {
    var c = fe.config;
    if (!(audio instanceof Float32Array) || !c.mel_filters || !fe.window || audio.length > c.n_samples - 2 * c.n_fft) return full(audio);
    var wave = new Float32Array(audio.length + c.n_fft + c.hop_length);
    wave.set(audio);
    var s = spectrogram(wave, fe.window, c.n_fft, c.hop_length, { power: 2, mel_filters: c.mel_filters, log_mel: 'log10' });
    var bins = s.dims[0], have = s.dims[1], frames = c.nb_max_frames, data = s.data;
    var top = -Infinity;
    for (var i = 0; i < data.length; i++) if (data[i] > top) top = data[i];
    var floor = top - 8;
    var pad = (Math.max(LOG_FLOOR, floor) + 4) / 4;
    var out = new Float32Array(bins * frames);
    for (var m = 0; m < bins; m++) {
      var row = m * frames, src = m * have, n = Math.min(have, frames), f = 0;
      for (; f < n; f++) out[row + f] = (Math.max(data[src + f], floor) + 4) / 4;
      for (; f < frames; f++) out[row + f] = pad;
    }
    return Promise.resolve({ input_features: new Tensor('float32', out, [1, bins, frames]) });
  };
}

export function ensurePipe(onProgress) {
  if (_pipe) return Promise.resolve(_pipe);
  if (_pipeP) return _pipeP;
  _pipeP = pipeline('automatic-speech-recognition', MODEL, {
    quantized: true,
    progress_callback: onProgress || null
  }).then(function (p) {
    try { quickFeatures(p.processor.feature_extractor); } catch (eQ) {}
    _pipe = p;
    return p;
  }).catch(function (e) { _pipeP = null; throw e; });
  return _pipeP;
}

export function isLoaded() { return !!_pipe; }

function languageOf(pipe, tokens) {
  if (!tokens) return '';
  for (var i = 0; i < tokens.length && i < 4; i++) {
    var m = LANG_TOKEN.exec(pipe.tokenizer.decode([Number(tokens[i])]));
    if (m) return m[1];
  }
  return '';
}

function captions(out) {
  var caps = [];
  if (!out || !Array.isArray(out.chunks)) return caps;
  out.chunks.forEach(function (c) {
    if (!c || !c.timestamp) return;
    var s = Number(c.timestamp[0]);
    var e = Number(c.timestamp[1]);
    if (!isFinite(s)) s = 0;
    if (!isFinite(e) || e <= s) e = s + 2;
    var t = String(c.text || '').trim();
    if (t) caps.push({ text: t, start: s, end: e });
  });
  return caps;
}

// opts: language ('es', 'en', anything else means detect), timestamps (default true), maxNewTokens.
export function transcribeWith(pcm, opts, onProgress) {
  var o = opts || {};
  var lang = typeof o.language === 'string' && LANG_CODE.test(o.language) ? o.language : null;
  var first = null;
  var args = {
    task: 'transcribe',
    return_timestamps: o.timestamps !== false,
    chunk_callback: function (c) { if (!first && c && c.tokens) first = c.tokens; }
  };
  if (lang) args.language = lang;
  if (pcm.length > RATE * WINDOW_S) { args.chunk_length_s = WINDOW_S; args.stride_length_s = STRIDE_S; }
  if (o.maxNewTokens > 0) args.max_new_tokens = Math.floor(o.maxNewTokens);
  var job = _line.then(function () {
    return ensurePipe(onProgress).then(function (pipe) {
      var t0 = performance.now();
      return pipe(pcm, args).then(function (out) {
        return {
          text: (out && out.text) || '',
          caps: captions(out),
          language: lang || languageOf(pipe, first),
          ms: Math.round(performance.now() - t0)
        };
      });
    });
  });
  _line = job.catch(function () {});
  return job;
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.type !== 'transcribe') return;
    var id = m.id;
    transcribeWith(m.pcm, m.opts, function (p) {
      try { self.postMessage({ type: 'progress', id: id, p: { status: p && p.status, file: p && p.file, progress: p && p.progress } }); } catch (eP) {}
    }).then(function (res) {
      self.postMessage({ type: 'done', id: id, res: res });
    }).catch(function (e) {
      self.postMessage({ type: 'error', id: id, err: String(e && e.message || e) });
    });
  };
}
