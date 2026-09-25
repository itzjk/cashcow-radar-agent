// popup.js

const TIER_CLASSES = {
  VIRAL: 'mc-legendary',
  HOT: 'mc-epic',
  RISING: 'mc-gold',
  ACTIVE: 'mc-silver',
  SLOW: 'mc-bronze',
};

let sessionData = null;

//  Boot 
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindFooter();
  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  openOnClick('btn-command-center', 'dashboard/dashboard.html');
  openOnClick('btn-niche-index', 'niche-index/niche-index.html');
  bindAgentSwitch();
  bindTalkButton();
  bindChat();
  bindBubbleSwitch();
});

function openOnClick(id, page) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL(page) });
    window.close();
  });
}

function loadData() {
  // The session lives in the localStorage of the active YouTube tab.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('youtube.com')) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          try {
            const s = localStorage.getItem('nsp_session');
            return { session: s ? JSON.parse(s) : null };
          } catch { return { session: null }; }
        },
      }, (results) => {
        if (chrome.runtime.lastError) { renderStats(null); renderTopVideos([]); return; }
        const res = results?.[0]?.result || {};
        sessionData = res.session || null;
        renderStats(sessionData);
        renderTopVideos(sessionData?.topVideos || []);
      });
    } else {
      renderStats(null);
      renderTopVideos([]);
    }
  });
}

//  Stats 
function renderStats(session) {
  const analyzed = session?.analyzed || 0;
  const videos = session?.topVideos || [];
  const goldPlus = videos.filter(v => ['RISING', 'HOT', 'VIRAL'].includes(v.tier)).length;
  const legendary = videos.filter(v => v.tier === 'VIRAL').length;

  document.getElementById('stat-analyzed').textContent = analyzed;
  document.getElementById('stat-gold').textContent = goldPlus;
  document.getElementById('stat-legendary').textContent = legendary;

  const query = session?.query;
  if (query) {
    document.getElementById('current-query-row').style.display = 'flex';
    document.getElementById('current-query').textContent = query;
  }
}

//  Top Videos 
function renderTopVideos(videos) {
  const list = document.getElementById('top-list');
  const empty = document.getElementById('empty-top');
  setExportState((videos && videos.length) || 0);

  if (!videos || !videos.length) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'flex';
  list.innerHTML = '';

  videos.slice(0, 20).forEach((v, i) => {
    const item = document.createElement('div');
    item.className = 'video-item';
    item.title = 'Open video';

    const tierClass = TIER_CLASSES[v.tier] || '';
    const multStr = v.outlierRatio !== null && v.outlierRatio !== undefined
      ? `<span class="metric-chip mc-mult">${escHtml(formatMult(v.outlierRatio))}</span>` : '';
    const tierBadge = v.tier && v.tier !== 'SLOW'
      ? `<span class="metric-chip ${tierClass}">${escHtml(v.tier)}</span>` : '';

    item.innerHTML = `
      <div class="video-rank">#${i + 1}</div>
      <div class="video-info">
        <div class="video-title">${escHtml(v.title)}</div>
        <div class="video-channel">${escHtml(v.channelName)}</div>
        <div class="video-metrics">
          <span class="metric-chip mc-vph">${escHtml(formatVPH(v.vph))} VPH</span>
          ${multStr}
          ${tierBadge}
          <span class="metric-chip" style="color:rgba(255,255,255,.8);background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2)">OS ${escHtml(v.os)}</span>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId || '')}` });
    });

    list.appendChild(item);
  });
}

//  Footer 
function bindFooter() {
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  openOnClick('btn-setup', 'setup/setup.html');
  openOnClick('btn-country-feed', 'country-feed/country-feed.html');
  document.getElementById('btn-open-yt').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.youtube.com' });
  });
}

function setExportState(count) {
  const btn = document.getElementById('btn-export');
  const note = document.getElementById('export-note');
  if (btn) {
    btn.disabled = !count;
    btn.title = count ? 'Export the ' + count + ' videos listed below as CSV' : 'Nothing to export yet';
  }
  if (note) note.textContent = count ? '' : 'Export needs a scan: open YouTube, hit SCAN, then come back.';
}

function exportCSV() {
  const note = document.getElementById('export-note');
  const videos = sessionData?.topVideos || [];
  if (!videos.length) {
    if (note) note.textContent = 'Nothing to export. Open YouTube, hit SCAN, then come back.';
    return;
  }

  const headers = ['Rank', 'Title', 'Channel', 'VideoID', 'VPH', 'Multiplier', 'Tier', 'OpportunityScore', 'RevenueEst'];
  const rows = videos.map((v, i) => [
    i + 1,
    csvEsc(v.title),
    csvEsc(v.channelName),
    v.videoId,
    v.vph,
    v.outlierRatio ?? '',
    v.tier || '',
    v.os,
    v.rev || '',
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nichescanner_${Date.now()}.csv`;
  // Revoking the object URL right after click() cancels the download in some browsers, so defer it.
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(url); }, 2000);
  if (note) note.textContent = 'Exported ' + videos.length + ' videos to ' + a.download + '.';
}

//  Helpers 
function formatVPH(v) {
  if (!v) return '0';
  if (v >= 10000) return (v / 1000).toFixed(1) + 'K';
  if (v >= 1000) return (v / 1000).toFixed(2) + 'K';
  return v.toFixed(1);
}

function formatMult(m) {
  if (m === null || m === undefined) return '?x';
  if (m >= 1000) return (m / 1000).toFixed(1) + 'Kx';
  if (m >= 100) return Math.round(m) + 'x';
  return m.toFixed(1) + 'x';
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function csvEsc(str) {
  return '"' + String(str || '').replace(/"/g, '""') + '"';
}

function paintAgentSwitch(on) {
  const btn = document.getElementById('btn-agent');
  const hint = document.getElementById('agent-hint');
  if (!btn) return;
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  if (hint) {
    hint.textContent = on
      ? 'On. The assistant can click, type and navigate on YouTube. It still stops to ask before it publishes, deletes or sends anything.'
      : 'Off. The assistant only reads and answers.';
  }
}

function bindTalkButton() {
  const btn = document.getElementById('btn-talk');
  if (!btn) return;
  let shortcut = '';
  const paint = (on) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = (on ? 'Voice on, listening. Click to turn it off' : 'Voice off. Click to turn it on') + (shortcut ? '. ' + shortcut + ' talks once: press it, speak, press it again to send' : '');
  };
  chrome.commands.getAll((list) => {
    const talk = (list || []).find((c) => c.name === 'talk');
    if (talk && talk.shortcut) shortcut = talk.shortcut;
    paint(btn.getAttribute('aria-pressed') === 'true');
  });
  chrome.runtime.sendMessage({ type: 'NSP_VOICE_STATE_GET' }, (res) => {
    void chrome.runtime.lastError;
    if (res && typeof res.wake === 'boolean') paint(res.wake);
  });
  btn.addEventListener('click', () => {
    paint(btn.getAttribute('aria-pressed') !== 'true');
    chrome.runtime.sendMessage({ type: 'NSP_VOICE_WAKE_TOGGLE' }, () => { void chrome.runtime.lastError; });
  });
}

function bindAgentSwitch() {
  const btn = document.getElementById('btn-agent');
  if (!btn) return;
  chrome.storage.local.get('nsp_agent_enabled', (r) => paintAgentSwitch(!!(r && r.nsp_agent_enabled === true)));
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    chrome.storage.local.set({ nsp_agent_enabled: next }, () => paintAgentSwitch(next));
  });
}

const NO_CONTENT_SCRIPT = /^https:\/\/(?:chromewebstore\.google\.com|chrome\.google\.com\/webstore)(?:[\/?#]|$)/;

function bindChat() {
  const btn = document.getElementById('btn-chat');
  if (!btn) return;
  btn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const url = (tab && tab.url) || '';
      const inPanel = () => {
        const done = () => window.close();
        const inTab = () => { chrome.tabs.create({ url: 'chrome-extension://' + chrome.runtime.id + '/chat/chat.html?mode=tab' }); done(); };
        if (!tab) { inTab(); return; }
        chrome.sidePanel.open({ windowId: tab.windowId }).then(done, inTab);
      };
      if (!tab || !/^https?:\/\//.test(url) || NO_CONTENT_SCRIPT.test(url)) { inPanel(); return; }
      chrome.tabs.sendMessage(tab.id, { type: 'NSP_BUBBLE', op: 'open' }, { frameId: 0 }, (res) => {
        if (chrome.runtime.lastError || !res || res.ok !== true) { inPanel(); return; }
        window.close();
      });
    });
  });
}

function bindBubbleSwitch() {
  const btn = document.getElementById('btn-bubble');
  const hint = document.getElementById('bubble-hint');
  const here = document.getElementById('bubble-here');
  if (!btn) return;
  let host = '';
  let scriptable = true;
  let key = 'Alt+X';
  const paint = (on, hidden) => {
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    const hiddenHere = on && host && hidden.indexOf(host) >= 0;
    if (hint) hint.textContent = !on ? 'Off. ' + key + ' still opens the chat.' : (!scriptable ? 'Chrome keeps the bubble off this page. ' + key + ' or CHAT opens the chat here.' : (hiddenHere ? 'Hidden on ' + host + '.' : 'Click it to chat, hold it to talk.'));
    if (here) here.hidden = !hiddenHere;
  };
  chrome.commands.getAll((list) => {
    const chat = (list || []).find((c) => c.name === 'chat');
    if (chat && chat.shortcut) { key = chat.shortcut; read(); }
  });
  const read = () => chrome.storage.local.get(['nsp_bubble_on', 'nsp_bubble_hidden_sites'], (r) => {
    paint(!(r && r.nsp_bubble_on === false), (r && Array.isArray(r.nsp_bubble_hidden_sites)) ? r.nsp_bubble_hidden_sites : []);
  });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    const url = (tab && tab.url) || '';
    try { host = new URL(url).hostname; } catch (e) { host = ''; }
    scriptable = /^https?:\/\//.test(url) && !NO_CONTENT_SCRIPT.test(url);
    read();
    if (!scriptable || !tab) return;
    chrome.tabs.sendMessage(tab.id, { type: 'NSP_BUBBLE', op: 'ping' }, { frameId: 0 }, (res) => {
      if (!chrome.runtime.lastError && res && res.ok === true) return;
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/zerack-bubble.js'] }).catch(() => {});
    });
  });
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    chrome.storage.local.set({ nsp_bubble_on: next }, read);
  });
  if (here) here.addEventListener('click', () => {
    chrome.storage.local.get('nsp_bubble_hidden_sites', (r) => {
      const list = (r && Array.isArray(r.nsp_bubble_hidden_sites)) ? r.nsp_bubble_hidden_sites.filter((h) => h !== host) : [];
      chrome.storage.local.set({ nsp_bubble_hidden_sites: list }, read);
    });
  });
}
