// nsp-faces.js — ISOLATED world on www.youtube.com
//
// face-api.js and the tinyFaceDetector weights run here, not in the page world: the library and its TensorFlow
// runtime stay out of YouTube's globals, where any script could read or replace them. The page world asks with
// NSP_FACE_DETECT and a thumbnail address from i.ytimg.com; the answer is the face boxes and the image size.
(function () {
  if (window.__nspFaces) return;
  window.__nspFaces = true;

  var THUMB = /^https:\/\/i[0-9]?\.ytimg\.com\/vi(?:_webp)?\/[A-Za-z0-9_-]{11}\/[A-Za-z0-9_]+\.(?:jpg|webp)(?:\?[^\s]*)?$/;
  var loading = null;

  function reply(reqId, body) {
    try { window.postMessage(Object.assign({ type: 'NSP_FACE_RESULT', requestId: reqId }, body), window.location.origin); } catch (e) {}
  }

  function model() {
    if (typeof faceapi === 'undefined' || !faceapi.nets || !faceapi.nets.tinyFaceDetector) return Promise.resolve(false);
    if (faceapi.nets.tinyFaceDetector.params) return Promise.resolve(true);
    if (!loading) {
      loading = faceapi.nets.tinyFaceDetector.loadFromUri(chrome.runtime.getURL('lib/face-api/')).then(function () { return true; }, function (e) {
        console.warn('[NSP faces] model load failed:', e && e.message);
        loading = null;
        return false;
      });
    }
    return loading;
  }

  // Loaded with crossOrigin so the detector can read the pixels; i.ytimg.com sends Access-Control-Allow-Origin: *.
  function image(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var done = false;
      img.crossOrigin = 'anonymous';
      img.onload = function () { if (!done) { done = true; resolve(img); } };
      img.onerror = function () { if (!done) { done = true; reject(new Error('img load failed')); } };
      setTimeout(function () { if (!done) { done = true; reject(new Error('img load timeout 8s')); } }, 8000);
      img.src = src;
    });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (event.origin && event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.type !== 'NSP_FACE_DETECT') return;
    var reqId = String(data.requestId || '').slice(0, 80);
    if (!reqId) return;
    var src = String(data.src || '');
    if (!THUMB.test(src)) { reply(reqId, { ok: false, error: 'not_a_youtube_thumbnail' }); return; }
    var threshold = Math.max(0.1, Math.min(0.9, Number(data.scoreThreshold) || 0.5));
    model().then(function (ok) {
      if (!ok) { reply(reqId, { ok: false, supported: false, error: 'face_model_unavailable' }); return; }
      return image(src).then(function (img) {
        return faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: threshold })).then(function (found) {
          reply(reqId, {
            ok: true,
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
            faces: (Array.isArray(found) ? found : []).filter(function (d) { return d && d.box; }).map(function (d) {
              return { w: d.box.width || 0, h: d.box.height || 0, score: d.score || 0 };
            })
          });
        });
      });
    }).catch(function (e) {
      reply(reqId, { ok: false, supported: true, error: String((e && e.message) || e) });
    });
  });
})();
