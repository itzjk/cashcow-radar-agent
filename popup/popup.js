// popup.js

const TIER_CLASSES = {
  LEGENDARY: 'mc-legendary',
  EPIC: 'mc-epic',
  GOLD: 'mc-gold',
  SILVER: 'mc-silver',
  BRONZE: 'mc-bronze',
  DEAD: '',
};

let sessionData = null;
let watchlist = [];
let savedChannels = [];

//  Boot 
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindFooter();
  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  openOnClick('btn-command-center', 'dashboard/dashboard.html');
  openOnClick('btn-niche-index', 'niche-index/niche-index.html');
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
  // Read channels from chrome.storage.local (reliable, no tab dependency)
  chrome.storage.local.get('nsp_all_channels', (storageRes) => {
    savedChannels = storageRes.nsp_all_channels || [];
    renderChannels();
  });

  // Read session + watchlist from active YouTube tab's localStorage
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('youtube.com')) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          try {
            const s = localStorage.getItem('nsp_session');
            const w = localStorage.getItem('nsp_watchlist');
            return { session: s ? JSON.parse(s) : null, watchlist: w ? JSON.parse(w) : [] };
          } catch { return { session: null, watchlist: [] }; }
        },
      }, (results) => {
        if (chrome.runtime.lastError) { renderStats(null); renderTopVideos([]); renderWatchlist(); return; }
        const res = results?.[0]?.result || {};
        sessionData = res.session || null;
        watchlist = res.watchlist || [];
        renderStats(sessionData);
        renderTopVideos(sessionData?.topVideos || []);
        renderWatchlist();
      });
    } else {
      renderStats(null);
      renderTopVideos([]);
      renderWatchlist();
    }
  });
}

//  Stats 
function renderStats(session) {
  const analyzed = session?.analyzed || 0;
  const videos = session?.topVideos || [];
  const goldPlus = videos.filter(v => ['GOLD', 'EPIC', 'LEGENDARY'].includes(v.tier)).length;
  const legendary = videos.filter(v => v.tier === 'LEGENDARY').length;

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
    const multStr = v.multiplier !== null && v.multiplier !== undefined
      ? `<span class="metric-chip mc-mult">${formatMult(v.multiplier)}</span>` : '';
    const tierBadge = v.tier && v.tier !== 'DEAD'
      ? `<span class="metric-chip ${tierClass}">${v.tier}</span>` : '';

    item.innerHTML = `
      <div class="video-rank">#${i + 1}</div>
      <div class="video-info">
        <div class="video-title">${escHtml(v.title)}</div>
        <div class="video-channel">${escHtml(v.channelName)}</div>
        <div class="video-metrics">
          <span class="metric-chip mc-vph"> ${formatVPH(v.vph)} VPH</span>
          ${multStr}
          ${tierBadge}
          <span class="metric-chip" style="color:rgba(255,255,255,.8);background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2)">OS:${v.opportunityScore}</span>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${v.videoId}` });
    });

    list.appendChild(item);
  });
}

//  Channels 
function renderChannels() {
  if (!document.getElementById('channels-list')) return;

  const list  = document.getElementById('channels-list');
  const empty = document.getElementById('empty-channels');

  if (!savedChannels || !savedChannels.length) {
    list.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.style.display  = 'flex';
  list.innerHTML = '';

  savedChannels.forEach((ch, idx) => {
    const card = document.createElement('div');
    card.className = 'ch-card';

    // Avatar (clickable  open channel)
    const avatarWrap = document.createElement('a');
    avatarWrap.href = '#';
    avatarWrap.className = 'ch-avatar-wrap';
    avatarWrap.title = 'Abrir canal';
    avatarWrap.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: ch.channelUrl });
    });

    if (ch.avatarUrl) {
      const img = document.createElement('img');
      img.src = ch.avatarUrl;
      img.className = 'ch-avatar';
      img.alt = ch.name;
      img.onerror = function() { this.style.display = 'none'; avatarWrap.textContent = (ch.name || '?')[0].toUpperCase(); };
      avatarWrap.appendChild(img);
    } else {
      avatarWrap.textContent = (ch.name || '?')[0].toUpperCase();
      avatarWrap.style.cssText += 'display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;';
    }
    card.appendChild(avatarWrap);

    // Info
    const info = document.createElement('div');
    info.className = 'ch-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'ch-name';
    nameEl.textContent = ch.name || 'Canal';
    nameEl.title = 'Abrir canal';
    nameEl.addEventListener('click', () => chrome.tabs.create({ url: ch.channelUrl }));
    info.appendChild(nameEl);

    const meta = document.createElement('div');
    meta.className = 'ch-meta';

    if (ch.niche) {
      const nc = document.createElement('span');
      nc.className = 'ch-chip ch-chip-purple';
      nc.textContent = ch.niche;
      meta.appendChild(nc);
    }

    const subsChip = document.createElement('span');
    subsChip.className = 'ch-chip ch-chip-blue';
    subsChip.textContent = ' ' + formatN(ch.subs || 0);
    meta.appendChild(subsChip);

    if (ch.subGrowth !== null && ch.subGrowth !== undefined) {
      const gc = document.createElement('span');
      gc.className = 'ch-chip ' + (ch.subGrowth >= 0 ? 'ch-chip-green' : 'ch-chip-red');
      gc.textContent = (ch.subGrowth >= 0 ? '+' : '') + formatN(ch.subGrowth) + '/mo';
      meta.appendChild(gc);
    }

    if (ch.revMonth > 0) {
      const rv = document.createElement('span');
      rv.className = 'ch-chip ch-chip-green';
      rv.textContent = (ch.revMonth >= 1000 ? '$' + (ch.revMonth/1000).toFixed(1) + 'K' : '$' + ch.revMonth) + '/mo';
      meta.appendChild(rv);
    }

    const mon = document.createElement('span');
    if (ch.monetized === 'yes')    { mon.className = 'ch-chip ch-chip-green'; mon.textContent = ' Monetizado'; }
    else if (ch.monetized === 'likely') { mon.className = 'ch-chip ch-chip-yellow'; mon.textContent = ' Probable'; }
    else if (ch.monetized === 'no')  { mon.className = 'ch-chip ch-chip-red';   mon.textContent = ' No monetiz.'; }
    else                             { mon.className = 'ch-chip'; mon.textContent = ''; }
    meta.appendChild(mon);

    info.appendChild(meta);
    card.appendChild(info);

    // Remove button
    const rmBtn = document.createElement('button');
    rmBtn.className = 'ch-remove';
    rmBtn.textContent = '';
    rmBtn.title = 'Eliminar';
    rmBtn.addEventListener('click', () => {
      savedChannels.splice(idx, 1);
      saveChannels();
      renderChannels();
    });
    card.appendChild(rmBtn);

    list.appendChild(card);
  });
}

function saveChannels() {
  chrome.storage.local.set({ nsp_all_channels: savedChannels });
}

function formatN(n) {
  if (!n) return '0';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return '' + Math.round(n);
}

//  Watchlist 
function renderWatchlist() {
  if (!document.getElementById('watchlist-items')) return;

  const container = document.getElementById('watchlist-items');
  const empty = document.getElementById('empty-watchlist');

  if (!watchlist.length) {
    container.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.style.display = 'block';
  container.innerHTML = '';

  watchlist.forEach((keyword, idx) => {
    const item = document.createElement('div');
    item.className = 'wl-item';
    item.innerHTML = `
      <span class="wl-keyword">${escHtml(keyword)}</span>
      <button class="wl-search-btn" data-idx="${idx}" title="Search on YouTube"></button>
      <button class="wl-remove-btn" data-idx="${idx}" title="Remove"></button>
    `;
    item.querySelector('.wl-search-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}` });
    });
    item.querySelector('.wl-remove-btn').addEventListener('click', () => {
      watchlist.splice(idx, 1);
      saveWatchlist();
      renderWatchlist();
    });
    container.appendChild(item);
  });
}


function addKeyword() {
  const input = document.getElementById('wl-input');
  const val = input.value.trim();
  if (!val || watchlist.includes(val)) return;
  watchlist.push(val);
  saveWatchlist();
  input.value = '';
  renderWatchlist();
}

function saveWatchlist() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.url?.includes('youtube.com')) {
      const wl = JSON.stringify(watchlist);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: (data) => { localStorage.setItem('nsp_watchlist', data); },
        args: [wl],
      }, () => { if (chrome.runtime.lastError) { /* tab cerrada/sin permiso: queda en memoria+render, no persiste al tab */ } });
    }
  });
}

//  Tabs 

//  Footer 
function bindFooter() {
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  openOnClick('btn-country-feed', 'country-feed/country-feed.html');
  document.getElementById('btn-open-yt').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.youtube.com' });
  });
}

function exportCSV() {
  const videos = sessionData?.topVideos || [];
  if (!videos.length) return;

  const headers = ['Rank', 'Title', 'Channel', 'VideoID', 'VPH', 'Multiplier', 'Tier', 'OpportunityScore', 'RevenueEst'];
  const rows = videos.map((v, i) => [
    i + 1,
    csvEsc(v.title),
    csvEsc(v.channelName),
    v.videoId,
    v.vph,
    v.multiplier ?? '',
    v.tier || '',
    v.opportunityScore,
    v.revenueEst || '',
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nichescanner_${Date.now()}.csv`;
  // v4.44.0 FIX descarga CSV: antes se revocaba el object-URL JUSTO después de click(), lo que en
  // algunos navegadores cancela la descarga antes de que empiece a leer el Blob (CSV vacío / "Failed").
  // Diferir el revoke + adjuntar el <a> al DOM = patrón seguro ya usado en toolkit.js y country-feed.js.
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(url); }, 2000);
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
