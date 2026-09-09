import { pipeline, env } from './transformers.min.js';

var base;
try {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) base = chrome.runtime.getURL('lib/whisper/');
  else base = new URL('.', import.meta.url).href;
} catch (e) {
  base = new URL('.', import.meta.url).href;
}

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = base + 'models/';
try {
  env.backends.onnx.wasm.wasmPaths = base;
  env.backends.onnx.wasm.numThreads = 1;
} catch (eW) {}

var _pipe = null, _pipeP = null;

function ensurePipe(onProgress) {
  if (_pipe) return Promise.resolve(_pipe);
  if (_pipeP) return _pipeP;
  _pipeP = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
    quantized: true,
    progress_callback: onProgress || null
  }).then(function (p) { _pipe = p; return p; }).catch(function (e) { _pipeP = null; throw e; });
  return _pipeP;
}

function transcribeInline(float32_16k, opts) {
  opts = opts || {};
  return ensurePipe(opts.onModelProgress).then(function (pipe) {
    return pipe(float32_16k, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true
    });
  }).then(function (out) {
    var caps = [];
    if (out && Array.isArray(out.chunks)) {
      out.chunks.forEach(function (c) {
        if (!c || !c.timestamp) return;
        var s = Number(c.timestamp[0]);
        var e = Number(c.timestamp[1]);
        if (!isFinite(s)) s = 0;
        if (!isFinite(e) || e <= s) e = s + 2;
        var t = String(c.text || '').trim();
        if (t) caps.push({ text: t, start: s, end: e });
      });
    }
    return { text: (out && out.text) || '', caps: caps };
  });
}

// La transcripción corre en un WORKER (hilo aparte): la página nunca se congela mientras Whisper
// escucha audio largo. Si el worker no se puede crear o muere, se cae al camino inline clásico.
var _wk = null, _mid = 0, _pend = {};
try {
  _wk = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  _wk.onmessage = function (ev) {
    var m = ev.data || {};
    var h = _pend[m.id];
    if (!h) return;
    if (m.type === 'progress') { if (h.onProg) { try { h.onProg(m.p); } catch (eG) {} } return; }
    delete _pend[m.id];
    if (m.type === 'done') h.res(m.res);
    else h.rej(new Error(m.err || 'whisper worker error'));
  };
  _wk.onerror = function () {
    try { _wk.terminate(); } catch (eT) {}
    _wk = null;
    for (var k in _pend) { try { _pend[k].rej(new Error('whisper worker crashed')); } catch (eR) {} delete _pend[k]; }
  };
} catch (eWk) { _wk = null; }

function transcribeViaWorker(float32_16k, opts) {
  return new Promise(function (res, rej) {
    var id = ++_mid;
    _pend[id] = { res: res, rej: rej, onProg: opts && opts.onModelProgress };
    _wk.postMessage({ type: 'transcribe', id: id, pcm: float32_16k });
  });
}

function transcribe(float32_16k, opts) {
  if (_wk) {
    return transcribeViaWorker(float32_16k, opts).catch(function () {
      return transcribeInline(float32_16k, opts);
    });
  }
  return transcribeInline(float32_16k, opts);
}

window.NSP_WHISPER = {
  ready: true,
  loaded: function () { return !!_pipe; },
  workerAlive: function () { return !!_wk; },
  warm: function (onProgress) {
    if (_wk) return transcribeViaWorker(new Float32Array(1600), { onModelProgress: onProgress }).then(function () { return true; }).catch(function () { return false; });
    return ensurePipe(onProgress);
  },
  transcribe: transcribe
};
try { window.dispatchEvent(new Event('nsp-whisper-ready')); } catch (eE) {}
