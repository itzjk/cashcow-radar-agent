import { transcribeWith, ensurePipe, isLoaded } from './whisper-worker.js';

var WARM_SAMPLES = 1600;

// Whisper runs in a worker so the page, and the microphone callback in it, never freeze; if the worker cannot start or dies, the same code runs inline.
var _wk = null, _mid = 0, _pend = {}, _warm = false;
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
    _warm = false;
    for (var k in _pend) { try { _pend[k].rej(new Error('whisper worker crashed')); } catch (eR) {} delete _pend[k]; }
  };
} catch (eWk) { _wk = null; }

function asrOpts(opts) {
  var o = opts || {};
  return { language: o.language, timestamps: o.timestamps, maxNewTokens: o.maxNewTokens };
}

function transcribeViaWorker(float32_16k, opts) {
  return new Promise(function (res, rej) {
    var id = ++_mid;
    _pend[id] = { res: res, rej: rej, onProg: opts && opts.onModelProgress };
    _wk.postMessage({ type: 'transcribe', id: id, pcm: float32_16k, opts: asrOpts(opts) });
  });
}

function transcribeInline(float32_16k, opts) {
  return transcribeWith(float32_16k, asrOpts(opts), opts && opts.onModelProgress);
}

function transcribe(float32_16k, opts) {
  if (_wk) {
    return transcribeViaWorker(float32_16k, opts).then(function (r) { _warm = true; return r; }, function () {
      return transcribeInline(float32_16k, opts);
    });
  }
  return transcribeInline(float32_16k, opts);
}

window.NSP_WHISPER = {
  ready: true,
  loaded: function () { return _warm || isLoaded(); },
  workerAlive: function () { return !!_wk; },
  warm: function (onProgress, opts) {
    var o = { onModelProgress: onProgress, timestamps: false, maxNewTokens: 4, language: opts && opts.language };
    if (_wk) return transcribe(new Float32Array(WARM_SAMPLES), o).then(function () { return true; }).catch(function () { return false; });
    return ensurePipe(onProgress).then(function () { return true; }, function () { return false; });
  },
  transcribe: transcribe
};
try { window.dispatchEvent(new Event('nsp-whisper-ready')); } catch (eE) {}
