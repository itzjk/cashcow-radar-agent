(function () {
  var model = null, loading = null;
  function ensure() {
    if (model) return Promise.resolve(model);
    if (loading) return loading;
    loading = Promise.resolve().then(function () { return tf.ready(); }).then(function () {
      return mobilenet.load({ version: 2, alpha: 1.0, modelUrl: new URL('model2.json', location.href).href });
    }).then(function (m) { model = m; return m; }).catch(function (e) { loading = null; throw e; });
    return loading;
  }
  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent || ev.origin !== location.origin) return;
    var d = ev.data;
    if (!d || d.nsp !== 'mnet') return;
    if (d.type === 'ping') {
      ensure().then(function () {
        window.parent.postMessage({ nsp: 'mnet', type: 'ready' }, location.origin);
      }).catch(function (e) {
        window.parent.postMessage({ nsp: 'mnet', type: 'dead', err: String(e && e.message || e).slice(0, 160) }, location.origin);
      });
      return;
    }
    if (d.type === 'classify') {
      ensure().then(function (m) {
        var img = d.img, cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        cv.getContext('2d').putImageData(img, 0, 0);
        return m.classify(cv, 3);
      }).then(function (preds) {
        var labels = (preds || []).map(function (p) { return p.className || ''; }).join(', ');
        window.parent.postMessage({ nsp: 'mnet', type: 'labels', id: d.id, labels: labels }, location.origin);
      }).catch(function (e) {
        window.parent.postMessage({ nsp: 'mnet', type: 'labels', id: d.id, labels: '', err: String(e && e.message || e).slice(0, 160) }, location.origin);
      });
    }
  });
})();
