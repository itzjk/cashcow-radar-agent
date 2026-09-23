(function () {
  'use strict';

  var CLOSE_AFTER_MS = 2500;
  var status = document.getElementById('status');
  var retry = document.getElementById('retry');
  var closeBtn = document.getElementById('close');

  function show(text, bad) {
    status.textContent = text;
    status.classList.toggle('bad', !!bad);
  }
  function closeTab() {
    try {
      chrome.tabs.getCurrent(function (t) {
        if (chrome.runtime.lastError || !t) { window.close(); return; }
        chrome.tabs.remove(t.id, function () { void chrome.runtime.lastError; });
      });
    } catch (e) { window.close(); }
  }
  function allowed(already) {
    retry.hidden = true;
    show((already ? 'The microphone is already allowed.' : 'Allowed.') + ' Go back to the voice panel and hold the orb to talk. This tab closes in a moment.');
    setTimeout(closeTab, CLOSE_AFTER_MS);
  }
  function failed(err) {
    var name = (err && err.name) || 'Error';
    retry.hidden = false;
    if (name === 'NotAllowedError') {
      show('Chrome refused the microphone. If you blocked it before, Chrome remembers that: click the icon at the left of the address bar, set Microphone to Allow, then press Ask again.', true);
    } else if (name === 'NotFoundError') {
      show('Chrome found no microphone. Plug one in, or check the input device in your system sound settings, then press Ask again.', true);
    } else if (name === 'NotReadableError') {
      show('The microphone is there but another app is holding it, or it failed to start. Close that app and press Ask again.', true);
    } else {
      show('The microphone did not start (' + name + '). Press Ask again.', true);
    }
  }
  function ask() {
    retry.hidden = true;
    show('Asking Chrome...');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { failed({ name: 'NotSupportedError' }); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      allowed(false);
    }, failed);
  }

  retry.addEventListener('click', ask);
  closeBtn.addEventListener('click', closeTab);

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' }).then(function (st) {
      if (st.state === 'granted') allowed(true); else ask();
    }, ask);
  } else {
    ask();
  }
})();
