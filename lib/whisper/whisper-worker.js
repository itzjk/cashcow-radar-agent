import { pipeline, env } from './transformers.min.js';

var base = new URL('.', self.location.href).href;

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

self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.type !== 'transcribe') return;
  var id = m.id;
  ensurePipe(function (p) {
    try { self.postMessage({ type: 'progress', id: id, p: { status: p && p.status, file: p && p.file, progress: p && p.progress } }); } catch (eP) {}
  }).then(function (pipe) {
    return pipe(m.pcm, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
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
    self.postMessage({ type: 'done', id: id, res: { text: (out && out.text) || '', caps: caps } });
  }).catch(function (e) {
    self.postMessage({ type: 'error', id: id, err: String(e && e.message || e) });
  });
};
