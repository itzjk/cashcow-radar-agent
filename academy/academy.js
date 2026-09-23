(function () {
  var SURFACES = [
    { names: ['command center', 'dashboard'], label: 'Command Center', page: 'dashboard/dashboard.html' },
    { names: ['niche index'], label: 'Niche Index', page: 'niche-index/niche-index.html' },
    { names: ['country radar', 'country feed'], label: 'Country radar', page: 'country-feed/country-feed.html' },
    { names: ['setup page', 'setup'], label: 'Setup', page: 'setup/setup.html' },
    { names: ['settings, assistant model'], label: 'Settings: Assistant model', page: 'options/options.html#nsp-selected-model' },
    { names: ['settings', 'options'], label: 'Settings', page: 'options/options.html' },
    { names: ['assistant workspace', 'ashlyv'], label: 'the assistant workspace', page: 'ashlyv/ashlyv.html' },
    { names: ['nichemaster, in the assistant workspace', 'nichemaster'], label: 'NicheMaster', page: 'ashlyv/tools/nichemaster.html' },
    { names: ['rivalradar pro, in the assistant workspace', 'rivalradar pro'], label: 'RivalRadar Pro', page: 'ashlyv/tools/competitorfinder.html' },
    { names: ['scriptpilot ai, in the assistant workspace', 'scriptpilot ai'], label: 'ScriptPilot AI', page: 'ashlyv/tools/scriptforge.html' },
    { names: ['thumblab, in the assistant workspace', 'thumblab'], label: 'ThumbLab', page: 'ashlyv/tools/thumblab.html' },
    { names: ['motionforge studio, in the assistant workspace', 'motionforge studio'], label: 'MotionForge Studio', page: 'ashlyv/tools/thumbnailforge.html' },
    { names: ['scan button on youtube', 'scanner', 'youtube'], label: 'YouTube, where the SCAN button lives', url: 'https://www.youtube.com/' },
    { names: ['youtube studio', 'studio'], label: 'YouTube Studio', url: 'https://studio.youtube.com/' },
    { names: ['policy engine'], missing: 'The policy engine has no screen in this build yet, so there is nothing to open for it.' }
  ];

  var modules = [];
  var lessons = [];
  var done = {};
  var storageKey = '';
  var storageError = '';
  var currentId = '';
  var doneUi = null;

  document.addEventListener('DOMContentLoaded', function () {
    try {
      boot();
    } catch (e) {
      showState('The course page stopped with an error', [
        (e && e.message ? e.message : String(e)) + '.',
        'Reload this page. If it happens again, report it with the line above.'
      ]);
      setCount(0, 0);
    }
  });

  function boot() {
    var raw = window.NSP_CURRICULUM;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.modules)) {
      showState('The course did not load', [
        'academy/curriculum.js is missing, or it failed to parse, so this page has no lessons to show.',
        'Open chrome://extensions, reload ZERACK and open this page again. If it keeps happening, the file is not in the folder you loaded.'
      ]);
      setCount(0, 0);
      return;
    }

    var course = raw.course && typeof raw.course === 'object' ? raw.course : {};
    if (text(course.title)) document.getElementById('course-title').textContent = text(course.title);
    modules = normalize(raw.modules);
    lessons = [];
    modules.forEach(function (m) { m.lessons.forEach(function (l) { lessons.push(l); }); });

    if (!lessons.length) {
      showState('The course is empty', [
        'The course file loaded but lists no lessons.',
        'Reload or update the extension. If you built it yourself, check academy/curriculum.js.'
      ]);
      setCount(0, 0);
      return;
    }

    storageKey = typeof raw.storageKey === 'string' ? raw.storageKey.trim() : '';
    loadProgress(function (map, error) {
      done = map;
      storageError = error;
      if (error) showNotice('Your progress is not being saved: ' + error + '. The lessons still work.', true);
      hideState();
      document.getElementById('page').hidden = false;
      currentId = firstUndone();
      renderRail();
      renderLesson();
      renderCount();
      watchProgress();
    });
  }

  function normalize(list) {
    var seen = {};
    var out = [];
    list.forEach(function (mod, mi) {
      if (!mod || typeof mod !== 'object') return;
      var title = text(mod.title) || 'Module ' + (mi + 1);
      var built = [];
      arrayOf(mod.lessons).forEach(function (lesson, li) {
        if (!lesson || typeof lesson !== 'object') return;
        var id = text(lesson.id);
        var unique = !!id && !seen[id];
        if (id) seen[id] = true;
        built.push({
          key: unique ? id : 'untracked:' + mi + ':' + li,
          id: unique ? id : '',
          title: text(lesson.title) || 'Untitled lesson',
          why: text(lesson.why),
          steps: arrayOf(lesson.steps).map(text).filter(Boolean),
          doNow: text(lesson.doNow) || text(lesson.action),
          proof: text(lesson.proof),
          sources: arrayOf(lesson.sources),
          surfaces: arrayOf(lesson.surfaces).concat(lesson.surface ? [lesson.surface] : []),
          moduleTitle: title
        });
      });
      out.push({ title: title, goal: text(mod.goal), lessons: built });
    });
    return out;
  }

  function text(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && isFinite(value)) return String(value);
    return '';
  }

  function arrayOf(value) { return Array.isArray(value) ? value : []; }

  function loadProgress(cb) {
    if (!window.chrome || !chrome.storage || !chrome.storage.local) { cb({}, 'this page is not running inside the extension'); return; }
    if (!storageKey) { cb({}, 'the course file names no storage key'); return; }
    try {
      chrome.storage.local.get(storageKey, function (res) {
        var err = chrome.runtime && chrome.runtime.lastError;
        if (err) { cb({}, err.message || 'the extension storage did not answer'); return; }
        cb(readDone(res && res[storageKey]), '');
      });
    } catch (e) {
      cb({}, e && e.message ? e.message : 'the extension storage did not answer');
    }
  }

  function readDone(stored) {
    var map = {};
    if (stored && typeof stored === 'object' && stored.done && typeof stored.done === 'object') {
      Object.keys(stored.done).forEach(function (id) { if (stored.done[id]) map[id] = stored.done[id]; });
    }
    return map;
  }

  // Read, change one id, write back: two open course tabs would otherwise overwrite each other's marks.
  function writeOne(id, makeDone, cb) {
    try {
      chrome.storage.local.get(storageKey, function (res) {
        var err = chrome.runtime && chrome.runtime.lastError;
        if (err) { cb(err.message || 'the extension storage did not answer'); return; }
        var map = readDone(res && res[storageKey]);
        if (makeDone) map[id] = new Date().toISOString();
        else delete map[id];
        var payload = {};
        payload[storageKey] = { version: 1, done: map };
        chrome.storage.local.set(payload, function () {
          var setErr = chrome.runtime && chrome.runtime.lastError;
          if (setErr) { cb(setErr.message || 'the write was refused'); return; }
          done = map;
          cb('');
        });
      });
    } catch (e) {
      cb(e && e.message ? e.message : 'the write was refused');
    }
  }

  function watchProgress() {
    if (storageError || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[storageKey]) return;
      done = readDone(changes[storageKey].newValue);
      renderRail();
      renderCount();
      paintDone();
    });
  }

  function trackable() {
    return lessons.filter(function (l) { return !!l.id; });
  }

  function firstUndone() {
    var list = trackable();
    for (var i = 0; i < list.length; i++) if (!done[list[i].id]) return list[i].key;
    return lessons[0].key;
  }

  function byKey(key) {
    for (var i = 0; i < lessons.length; i++) if (lessons[i].key === key) return lessons[i];
    return null;
  }

  function renderCount() {
    var list = trackable();
    if (storageError) { setCount(0, 0, list.length + ' lessons, progress not saved'); return; }
    setCount(list.filter(function (l) { return !!done[l.id]; }).length, list.length);
  }

  function setCount(doneN, total, label) {
    document.getElementById('progress-count').textContent = label || (total ? doneN + ' of ' + total + ' lessons done' : 'No lessons');
    document.getElementById('progress-bar').style.width = total ? Math.round((doneN / total) * 100) + '%' : '0';
  }

  function renderRail() {
    var host = document.getElementById('module-list');
    host.textContent = '';
    modules.forEach(function (mod) {
      var box = el('div', 'module');
      box.appendChild(el('div', 'module-title', mod.title));
      if (mod.goal) box.appendChild(el('div', 'module-note', mod.goal));
      if (!mod.lessons.length) box.appendChild(el('div', 'module-note', 'No lessons in this module yet.'));
      mod.lessons.forEach(function (lesson) {
        var isDone = !!(lesson.id && done[lesson.id]);
        var btn = el('button', 'lesson-btn' + (lesson.key === currentId ? ' active' : '') + (isDone ? ' done' : ''));
        btn.type = 'button';
        if (lesson.key === currentId) btn.setAttribute('aria-current', 'page');
        btn.appendChild(el('span', 'lesson-name', lesson.title));
        btn.appendChild(el('span', 'tick', 'Done'));
        btn.addEventListener('click', function () {
          currentId = lesson.key;
          renderRail();
          renderLesson();
          document.getElementById('lesson-pane').scrollIntoView({ block: 'start' });
        });
        box.appendChild(btn);
      });
      host.appendChild(box);
    });
  }

  function renderLesson() {
    var pane = document.getElementById('lesson-pane');
    pane.textContent = '';
    doneUi = null;
    var lesson = byKey(currentId);
    if (!lesson) {
      var none = el('div', 'card');
      none.appendChild(el('h2', '', 'Pick a lesson'));
      none.appendChild(el('p', '', 'Choose one from the list to open it.'));
      pane.appendChild(none);
      return;
    }

    var head = el('div', 'card');
    head.appendChild(el('div', 'eyebrow', lesson.moduleTitle));
    head.appendChild(el('h1', 'lesson-title', lesson.title));
    if (lesson.why) head.appendChild(el('p', 'lesson-why', lesson.why));
    pane.appendChild(head);

    var stepsCard = el('div', 'card');
    stepsCard.appendChild(el('h2', '', 'Steps'));
    if (lesson.steps.length) {
      var ol = el('ol', 'steps');
      lesson.steps.forEach(function (step) { ol.appendChild(el('li', '', step)); });
      stepsCard.appendChild(ol);
    } else {
      stepsCard.appendChild(el('p', 'muted', 'This lesson lists no steps yet.'));
    }
    pane.appendChild(stepsCard);

    if (lesson.doNow || lesson.surfaces.length) pane.appendChild(buildActionCard(lesson));

    if (lesson.proof) {
      var proofCard = el('div', 'card');
      proofCard.appendChild(el('h2', '', 'How you know it worked'));
      proofCard.appendChild(el('p', '', lesson.proof));
      pane.appendChild(proofCard);
    }

    pane.appendChild(buildSourcesCard(lesson));
    pane.appendChild(buildDoneCard(lesson));
  }

  function buildActionCard(lesson) {
    var card = el('div', 'card');
    card.appendChild(el('h2', '', lesson.doNow ? 'Do this now' : 'Where to do it'));
    if (lesson.doNow) card.appendChild(el('p', '', lesson.doNow));
    var row = el('div', 'surface-row');
    var notes = [];
    lesson.surfaces.forEach(function (value) {
      var surface = resolveSurface(value);
      if (!surface) return;
      if (!surface.target) { notes.push(surface.note); return; }
      var btn = el('button', 'btn', 'Open ' + surface.label);
      btn.type = 'button';
      btn.addEventListener('click', function () { openTarget(surface.target); });
      row.appendChild(btn);
    });
    if (row.childNodes.length) card.appendChild(row);
    notes.forEach(function (note) { card.appendChild(el('p', 'muted note', note)); });
    return card;
  }

  function buildSourcesCard(lesson) {
    var card = el('div', 'card');
    card.appendChild(el('h2', '', 'Sources'));
    var ul = el('ul', 'sources');
    lesson.sources.forEach(function (source) {
      if (!source || typeof source !== 'object') return;
      var li = document.createElement('li');
      var href = safeUrl(source.url);
      var title = text(source.title) || href || 'Untitled source';
      if (href) {
        var a = el('a', '', title);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
      } else {
        li.appendChild(el('span', '', title));
      }
      var meta = [text(source.author), href ? hostOf(href) : 'the course file gives no working link for this one'].filter(Boolean);
      if (meta.length) li.appendChild(el('div', 'source-meta', meta.join(', ')));
      ul.appendChild(li);
    });
    if (ul.childNodes.length) card.appendChild(ul);
    else card.appendChild(el('p', 'muted', 'This lesson cites no sources, so read its steps as the course author\'s advice, not as documented fact.'));
    return card;
  }

  function buildDoneCard(lesson) {
    var card = el('div', 'card');
    var row = el('div', 'done-row');
    var btn = el('button', 'btn');
    btn.type = 'button';
    var status = el('span', 'status');
    row.appendChild(btn);
    row.appendChild(status);
    card.appendChild(row);

    var reason = '';
    if (!lesson.id) reason = 'This lesson has no unique id in the course file, so its progress cannot be saved.';
    else if (storageError) reason = 'Progress cannot be saved here: ' + storageError + '.';
    if (reason) card.appendChild(el('p', 'muted note', reason));

    var ui = { lesson: lesson, btn: btn, status: status, locked: !!reason, busy: false };
    doneUi = ui;
    paintDone();

    btn.addEventListener('click', function () {
      if (ui.locked || ui.busy) return;
      ui.busy = true;
      paintDone();
      writeOne(lesson.id, !done[lesson.id], function (error) {
        ui.busy = false;
        renderRail();
        renderCount();
        if (doneUi !== ui) return;
        paintDone();
        if (error) {
          ui.status.textContent = 'Not saved: ' + error + '. Try again.';
          ui.status.className = 'status bad';
        }
      });
    });
    return card;
  }

  function paintDone() {
    var ui = doneUi;
    if (!ui) return;
    var value = ui.lesson.id ? done[ui.lesson.id] : null;
    ui.btn.textContent = value ? 'Mark as not done' : 'Mark as done';
    ui.btn.disabled = ui.locked || ui.busy;
    ui.status.className = 'status';
    if (ui.busy) { ui.status.textContent = 'Saving'; return; }
    if (!value) { ui.status.textContent = 'Not done yet.'; return; }
    var when = typeof value === 'string' ? new Date(value) : null;
    ui.status.textContent = when && !isNaN(when.getTime()) ? 'Done on ' + when.toLocaleDateString() + '.' : 'Done.';
  }

  function resolveSurface(value) {
    var raw = typeof value === 'string' ? value.trim() : (value && typeof value === 'object' ? text(value.id) || text(value.name) : '');
    if (!raw) return null;
    var key = raw.toLowerCase().replace(/[-_\s]+/g, ' ').replace(/^the /, '').trim();
    for (var i = 0; i < SURFACES.length; i++) {
      var hit = SURFACES[i];
      if (hit.names.indexOf(key) === -1) continue;
      if (hit.missing) return { note: hit.missing };
      return { label: hit.label, target: hit.url || pageUrl(hit.page) };
    }
    return { note: 'This lesson points at "' + raw + '", which is not a screen this page knows how to open.' };
  }

  function pageUrl(page) {
    return window.chrome && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL(page) : '../' + page;
  }

  function openTarget(url) {
    if (window.chrome && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: url });
    else window.open(url, '_blank', 'noopener');
  }

  function safeUrl(value) {
    var url = text(value);
    return /^https?:\/\/\S+$/i.test(url) ? url : '';
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function showNotice(message, bad) {
    var box = document.getElementById('notice');
    box.textContent = message;
    box.className = bad ? 'notice bad' : 'notice';
    box.hidden = false;
  }

  function showState(title, paragraphs) {
    var box = document.getElementById('state');
    box.textContent = '';
    box.appendChild(el('h2', '', title));
    paragraphs.forEach(function (line) { box.appendChild(el('p', '', line)); });
    box.hidden = false;
    document.getElementById('page').hidden = true;
  }

  function hideState() { document.getElementById('state').hidden = true; }

  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
  }
})();
