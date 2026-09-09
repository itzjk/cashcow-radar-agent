// NSP Faceless Niche Finder

var NICHES = [
  {
    id: 'ai-filmmaking',
    name: 'AI Short Films', icon: '🎬', rpm: 14, rpmTier: 'high',
    desc: '100% IA: Kling + Seedance generan el video, ElevenLabs pone la voz, ChatGPT escribe el guión. Sin cámara, sin cara, sin actores.',
    aiTools: ['Kling AI', 'Seedance', 'ElevenLabs', 'ChatGPT', 'CapCut'],
    formats: ['Cortos narrativos', 'Breakdowns de proceso', 'Fan Films'],
    potential: '$3K-$25K/mo',
    difficulty: '⭐⭐',
    searchQuery: 'kling ai short film 2025',
    exampleChannels: [
      { name: 'Lennard Smith', url: 'https://www.youtube.com/@LennardSmith_', subs: '4.76K', note: 'IA + faceless', static: true },
      { name: 'MossMan AI', url: 'https://www.youtube.com/@MossManAI', subs: '45K', note: 'IA + faceless', static: true },
    ],
  },
  {
    id: 'ai-automation',
    name: 'AI Automation (Sin Cara)', icon: '🤖', rpm: 15, rpmTier: 'high',
    desc: 'Solo pantalla grabada + voz ElevenLabs. Tutoriales de n8n, Make, Zapier con IA. Sin cara. Audiencia con dinero. RPM top.',
    aiTools: ['ElevenLabs (voz)', 'OBS / screen record', 'ChatGPT (script)', 'Canva (thumbnail)'],
    formats: ['Screen recording + voz AI', 'Workflows visuales', 'Case studies'],
    potential: '$5K-$40K/mo',
    difficulty: '⭐⭐',
    searchQuery: 'n8n automation tutorial faceless 2025',
    exampleChannels: [
      { name: 'AI Tidbits', url: 'https://www.youtube.com/@aitidbits', subs: '120K', note: 'Screen + AI voz', static: true },
      { name: 'Corbin Brown', url: 'https://www.youtube.com/@CorbinBrownAI', subs: '80K', note: 'Faceless AI tutorials', static: true },
    ],
  },
  {
    id: 'faceless-finance',
    name: 'Finanzas Faceless IA', icon: '💰', rpm: 20, rpmTier: 'high',
    desc: 'Script con ChatGPT, voz con ElevenLabs, imágenes/charts con Canva AI o Midjourney. El nicho $ más alto de YouTube.',
    aiTools: ['ChatGPT (script)', 'ElevenLabs (voz)', 'Midjourney (imágenes)', 'Canva AI (charts)'],
    formats: ['Explicaciones animadas', 'Stock footage + voz AI', 'Listas top'],
    potential: '$8K-$80K/mo',
    difficulty: '⭐⭐⭐',
    searchQuery: 'investing explained faceless ai voice 2025',
    exampleChannels: [
      { name: 'Magnates Media', url: 'https://www.youtube.com/@MagnatesMedia', subs: '3.1M', note: 'Stock + AI narración', static: true },
      { name: 'New Money', url: 'https://www.youtube.com/@NewMoneyYouTube', subs: '1.8M', note: 'Faceless + stock footage', static: true },
    ],
  },
  {
    id: 'ai-tools-review',
    name: 'AI Tools Reviews', icon: '🧰', rpm: 13, rpmTier: 'high',
    desc: 'Screen recording de la tool + voz AI explicando. Sin cara. Cada nuevo tool que sale = video viral. El contenido se crea solo.',
    aiTools: ['OBS (screen record)', 'ElevenLabs (voz)', 'ChatGPT (script)', 'Midjourney (thumbnail)'],
    formats: ['Screen demo + voz AI', 'Comparativas', 'Top listas'],
    potential: '$2K-$20K/mo',
    difficulty: '⭐',
    searchQuery: 'best ai tools review faceless 2025',
    exampleChannels: [
      { name: 'TheAIGRID', url: 'https://www.youtube.com/@TheAiGrid', subs: '720K', note: 'Faceless AI news/reviews', static: true },
      { name: 'AI Revolution', url: 'https://www.youtube.com/@AIRevolution0', subs: '200K', note: '100% faceless', static: true },
    ],
  },
  {
    id: 'dark-history-ai',
    name: 'Historia Oscura IA', icon: '🕵️', rpm: 9, rpmTier: 'mid',
    desc: 'ChatGPT escribe el guión, Kling/Runway genera escenas cinematográficas, ElevenLabs narra. Cero stock footage de pago.',
    aiTools: ['ChatGPT (guión)', 'Kling AI (video)', 'ElevenLabs (narración)', 'Suno AI (música)'],
    formats: ['Mini-documentales IA', 'Casos históricos', 'Misterios visuales'],
    potential: '$1K-$12K/mo',
    difficulty: '⭐⭐',
    searchQuery: 'dark history ai generated faceless 2025',
    exampleChannels: [
      { name: 'Bedtime Stories', url: 'https://www.youtube.com/@bedtimestorieschannel', subs: '3.6M', note: 'Stock + narración faceless', static: true },
      { name: 'Thoughty2', url: 'https://www.youtube.com/@Thoughty2', subs: '4.5M', note: 'Voz AI + B-roll', static: true },
    ],
  },
  {
    id: 'relatos-ia',
    name: 'Relatos con Voz IA', icon: '🔥', rpm: 5, rpmTier: 'mid',
    desc: 'ChatGPT genera la historia, ElevenLabs la narra, Kling genera el video. Viral en español. Farid Dieck style — todo IA.',
    aiTools: ['ChatGPT (historia)', 'ElevenLabs (voz clon)', 'Kling AI (video)', 'CapCut (edición)'],
    formats: ['Relato + video IA', 'Narración emocional', 'Historias cortas'],
    potential: '$500-$15K/mo',
    difficulty: '⭐',
    searchQuery: 'relatos ia voz artificial faceless 2025',
    exampleChannels: [
      { name: 'Farid Dieck', url: 'https://www.youtube.com/@FaridDieck', subs: '12.9M', note: 'Narración + IA visual', static: true },
      { name: 'Reflexiones de Vida', url: 'https://www.youtube.com/@ReflexionesDeVida', subs: '890K', note: '100% faceless español', static: true },
    ],
  },
  {
    id: 'ai-news-faceless',
    name: 'Noticias AI (Faceless)', icon: '📡', rpm: 12, rpmTier: 'high',
    desc: 'ChatGPT resume noticias de IA, ElevenLabs narra, Kling genera b-roll futurista. 1 video/día sin mostrarte. Consistencia = subs.',
    aiTools: ['ChatGPT (resumen noticias)', 'ElevenLabs (voz)', 'Kling AI (b-roll)', 'Canva (thumbnail)'],
    formats: ['Daily news recap', 'Breaking AI news', 'Weekly roundup'],
    potential: '$1K-$15K/mo',
    difficulty: '⭐⭐',
    searchQuery: 'ai news today faceless channel 2025',
    exampleChannels: [
      { name: 'TheAIGRID', url: 'https://www.youtube.com/@TheAiGrid', subs: '720K', note: 'Faceless AI news', static: true },
      { name: 'AI Chip', url: 'https://www.youtube.com/@AIChipChannel', subs: '180K', note: '100% IA sin cara', static: true },
    ],
  },
  {
    id: 'vibe-coding-faceless',
    name: 'Vibe Coding Faceless', icon: '💻', rpm: 12, rpmTier: 'high',
    desc: 'Screen recording de Cursor/Claude creando apps. Sin cara, solo pantalla. ChatGPT escribe el guión, ElevenLabs narra. Demanda brutal.',
    aiTools: ['Cursor AI (code)', 'OBS (screen)', 'ElevenLabs (voz)', 'ChatGPT (script)'],
    formats: ['Build en tiempo real', 'Speed runs', 'App completa en 1 video'],
    potential: '$2K-$18K/mo',
    difficulty: '⭐⭐',
    searchQuery: 'vibe coding cursor ai faceless build 2025',
    exampleChannels: [
      { name: 'IndieHackerNews', url: 'https://www.youtube.com/@IndieHackerNews', subs: '95K', note: 'Screen + AI voz', static: true },
      { name: 'Builders AI', url: 'https://www.youtube.com/@BuildersAI', subs: '60K', note: 'Faceless vibe coding', static: true },
    ],
  },
  {
    id: 'space-ai-generated',
    name: 'Espacio con IA', icon: '🚀', rpm: 8, rpmTier: 'mid',
    desc: 'Midjourney/Kling genera escenas espaciales cinematográficas. ChatGPT el guión científico. ElevenLabs narra. Cero filmación.',
    aiTools: ['Kling AI (video espacial)', 'Midjourney (imágenes)', 'ElevenLabs (voz)', 'ChatGPT (guión)'],
    formats: ['Documentales IA', 'Viajes espaciales generados', 'Explicaciones visuales'],
    potential: '$800-$10K/mo',
    difficulty: '⭐',
    searchQuery: 'space ai generated documentary faceless 2025',
    exampleChannels: [
      { name: 'AI Cosmos', url: 'https://www.youtube.com/@AICosmos', subs: '340K', note: 'IA generada 100%', static: true },
      { name: 'Voyage AI', url: 'https://www.youtube.com/@VoyageAI', subs: '120K', note: 'Kling + ElevenLabs', static: true },
    ],
  },
  {
    id: 'luxury-ai',
    name: 'Luxury Faceless IA', icon: '💎', rpm: 10, rpmTier: 'high',
    desc: 'Midjourney genera mansiones/yates/autos de lujo ultra-realistas. ElevenLabs narra. Sin stock de pago. Solo prompts.',
    aiTools: ['Midjourney (imágenes lujo)', 'Kling AI (tours animados)', 'ElevenLabs (voz lujosa)', 'ChatGPT (script)'],
    formats: ['Tours de mansiones IA', 'Top 10 lujos', 'Lifestyle billonario'],
    potential: '$1K-$12K/mo',
    difficulty: '⭐',
    searchQuery: 'luxury ai generated faceless channel 2025',
    exampleChannels: [
      { name: 'AI Luxury Life', url: 'https://www.youtube.com/@AILuxuryLife', subs: '280K', note: 'Midjourney + voz AI', static: true },
      { name: 'Faceless Wealth', url: 'https://www.youtube.com/@FacelessWealth', subs: '150K', note: '100% IA generado', static: true },
    ],
  },
  {
    id: 'health-ai-faceless',
    name: 'Salud IA Faceless', icon: '💪', rpm: 9, rpmTier: 'mid',
    desc: 'ChatGPT resume estudios científicos, ElevenLabs narra, Kling genera visualizaciones del cuerpo humano. Sin cara. Alto RPM.',
    aiTools: ['ChatGPT (research)', 'ElevenLabs (voz médica)', 'Kling AI (visualización)', 'Canva AI (infografías)'],
    formats: ['Explicaciones científicas IA', 'Protocolos visualizados', 'Research resumido'],
    potential: '$1K-$14K/mo',
    difficulty: '⭐⭐',
    searchQuery: 'health science ai faceless explained 2025',
    exampleChannels: [
      { name: 'Health Insight AI', url: 'https://www.youtube.com/@HealthInsightAI', subs: '420K', note: 'Faceless + AI voz', static: true },
      { name: 'Longevity AI', url: 'https://www.youtube.com/@LongevityAI', subs: '95K', note: 'ChatGPT + ElevenLabs', static: true },
    ],
  },
  {
    id: 'crypto-ai-faceless',
    name: 'Crypto/Web3 Faceless IA', icon: '₿', rpm: 22, rpmTier: 'high',
    desc: 'El CPM más alto de YouTube. ChatGPT analiza mercados, ElevenLabs narra, animaciones Canva AI. Sin cara. Audiencia con capital.',
    aiTools: ['ChatGPT (análisis)', 'ElevenLabs (voz)', 'Canva AI (gráficos)', 'Midjourney (thumbnail)'],
    formats: ['Análisis de mercado', 'Explicaciones de proyectos', 'Predicciones'],
    potential: '$5K-$60K/mo',
    difficulty: '⭐⭐⭐',
    searchQuery: 'crypto explained ai faceless channel 2025',
    exampleChannels: [
      { name: 'Coin Bureau', url: 'https://www.youtube.com/@CoinBureau', subs: '2.3M', note: 'Faceless + animaciones', static: true },
      { name: 'Benjamin Cowen', url: 'https://www.youtube.com/@IvanOnTech', subs: '780K', note: 'Screen + AI charts', static: true },
    ],
  },
];

var allDiscovered = [];
var activeRpm = 'ALL';
var searchVal = '';

function fmtN(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n/1000) + 'K';
  return '' + Math.round(n);
}

function load() {
  chrome.storage.local.get('nsp_all_channels', function(res) {
    allDiscovered = res.nsp_all_channels || [];
    var badge = document.getElementById('disc-badge');
    var count = document.getElementById('disc-count');
    if (allDiscovered.length > 0) {
      if (badge) badge.style.display = 'inline-flex';
      if (count) count.textContent = allDiscovered.length;
    }
    render();
  });
}

function getDiscoveredForNiche(niche) {
  // Match discovered channels to this niche by niche label or keywords
  return allDiscovered.filter(function(ch) {
    if (!ch.niche) return false;
    var nicheLabel = niche.icon + ' ' + niche.name;
    if (ch.niche === nicheLabel) return true;
    // partial match on icon or name
    var chNiche = ch.niche.toLowerCase();
    var nicheName = niche.name.toLowerCase();
    return chNiche.includes(nicheName.split(' ')[0]) || nicheName.includes(chNiche.split(' ').slice(1).join(' '));
  }).slice(0, 3);
}

function render() {
  var filtered = NICHES.filter(function(n) {
    if (activeRpm === 'high' && n.rpm < 10) return false;
    if (activeRpm === 'mid'  && (n.rpm < 5 || n.rpm >= 10)) return false;
    if (activeRpm === 'low'  && n.rpm >= 5) return false;
    if (searchVal) {
      var q = searchVal.toLowerCase();
      if (!n.name.toLowerCase().includes(q) && !n.desc.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  var grid = document.getElementById('grid');
  grid.innerHTML = '';

  filtered.forEach(function(niche) {
    var discovered = getDiscoveredForNiche(niche);
    var hasViral = discovered.some(function(c) { return c.topTier === 'VIRAL' || c.topTier === 'HOT'; });

    var card = document.createElement('div');
    card.className = 'niche-card' + (hasViral ? ' has-viral' : '');
    card.dataset.rpmTier = niche.rpmTier;

    // Image area
    var imgWrap = document.createElement('div');
    imgWrap.className = 'niche-img-wrap';

    // Use discovered channel avatar as bg image if available
    var bgSet = false;
    for (var di = 0; di < discovered.length; di++) {
      if (discovered[di].avatarUrl) {
        imgWrap.style.cssText = 'position:relative;width:100%;height:160px;overflow:hidden;'
          + 'background:url(' + discovered[di].avatarUrl + ') center/cover;filter:brightness(.6) blur(2px);';
        bgSet = true; break;
      }
    }
    if (!bgSet) {
      var pl = document.createElement('div');
      pl.className = 'niche-img-placeholder';
      pl.textContent = niche.icon;
      imgWrap.appendChild(pl);
    }

    // RPM badge
    var rpmBadge = document.createElement('span');
    rpmBadge.className = 'rpm-badge rpm-' + niche.rpmTier;
    rpmBadge.textContent = '$' + niche.rpm + ' RPM';
    imgWrap.appendChild(rpmBadge);

    // Viral badge
    var viralBadge = document.createElement('span');
    viralBadge.className = 'viral-badge';
    viralBadge.textContent = '🔴 VIRAL AHORA';
    imgWrap.appendChild(viralBadge);

    card.appendChild(imgWrap);

    // Body
    var body = document.createElement('div');
    body.className = 'niche-body';

    // Title row
    var titleRow = document.createElement('div');
    titleRow.className = 'niche-title-row';
    var iconName = document.createElement('div');
    iconName.className = 'niche-icon-name';
    var ico = document.createElement('span');
    ico.className = 'niche-icon';
    ico.textContent = niche.icon;
    var nm = document.createElement('span');
    nm.className = 'niche-name';
    nm.textContent = niche.name;
    iconName.appendChild(ico);
    iconName.appendChild(nm);
    var rpmLbl = document.createElement('span');
    rpmLbl.className = 'niche-rpm-label';
    rpmLbl.textContent = niche.potential;
    titleRow.appendChild(iconName);
    titleRow.appendChild(rpmLbl);
    body.appendChild(titleRow);

    // Description
    var desc = document.createElement('p');
    desc.className = 'niche-desc';
    desc.textContent = niche.desc;
    body.appendChild(desc);

    // Stats
    var stats = document.createElement('div');
    stats.className = 'niche-stats';
    function stat(txt, cls) { var s=document.createElement('span'); s.className='nstat '+cls; s.textContent=txt; return s; }
    stats.appendChild(stat('$' + niche.rpm + ' RPM', 'nstat-green'));
    stats.appendChild(stat('🎯 ' + niche.difficulty, 'nstat-yellow'));
    for (var fi = 0; fi < Math.min(niche.formats.length, 2); fi++) {
      stats.appendChild(stat(niche.formats[fi], 'nstat-purple'));
    }
    body.appendChild(stats);

    // AI Tools needed
    if (niche.aiTools && niche.aiTools.length) {
      var toolsLabel = document.createElement('div');
      toolsLabel.className = 'channels-label';
      toolsLabel.textContent = '🧰 Tools para crearlo';
      body.appendChild(toolsLabel);
      var toolsRow = document.createElement('div');
      toolsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
      for (var ti = 0; ti < niche.aiTools.length; ti++) {
        var tl = document.createElement('span');
        tl.className = 'nstat nstat-blue';
        tl.textContent = niche.aiTools[ti];
        toolsRow.appendChild(tl);
      }
      body.appendChild(toolsRow);
    }

    // Example channels
    var allExamples = niche.exampleChannels.concat(
      discovered.map(function(c) { return { name: c.name, url: c.channelUrl, avatarUrl: c.avatarUrl, subs: fmtN(c.subs), discovered: true, avgOS: c.avgOS, topVPH: c.topVPH }; })
    ).slice(0, 4);

    if (allExamples.length > 0) {
      var chLabel = document.createElement('div');
      chLabel.className = 'channels-label';
      chLabel.textContent = '📺 Canales de ejemplo';
      body.appendChild(chLabel);

      var chList = document.createElement('div');
      chList.className = 'ch-examples';

      allExamples.forEach(function(ch) {
        var link = document.createElement('a');
        link.className = 'ch-example';
        link.href = '#';
        link.addEventListener('click', function(e) { e.preventDefault(); chrome.tabs.create({ url: ch.url }); });

        var av = document.createElement('div');
        av.className = 'ch-ex-av';
        if (ch.avatarUrl) {
          var avImg = document.createElement('img');
          avImg.src = ch.avatarUrl;
          avImg.onerror = function() { av.innerHTML = ''; var pl=document.createElement('span'); pl.className='ch-ex-av-pl'; pl.textContent=(ch.name||'?')[0]; av.appendChild(pl); };
          av.appendChild(avImg);
        } else {
          var avPl = document.createElement('span');
          avPl.className = 'ch-ex-av-pl';
          avPl.textContent = (ch.name || '?')[0].toUpperCase();
          av.appendChild(avPl);
        }
        link.appendChild(av);

        var info = document.createElement('div');
        info.className = 'ch-ex-info';
        var chName = document.createElement('div');
        chName.className = 'ch-ex-name';
        chName.textContent = ch.name;
        var chMeta = document.createElement('div');
        chMeta.className = 'ch-ex-meta';
        chMeta.textContent = (ch.subs ? '👥 ' + ch.subs : '') + (ch.note ? '  · ' + ch.note : '') + (ch.avgOS ? '  OS:' + ch.avgOS : '');
        info.appendChild(chName);
        info.appendChild(chMeta);
        link.appendChild(info);

        if (ch.discovered) {
          var disc = document.createElement('span');
          disc.className = 'ch-ex-disc';
          disc.textContent = '🔭 Scout';
          link.appendChild(disc);
        }

        chList.appendChild(link);
      });
      body.appendChild(chList);
    }

    // Search button
    var searchBtn = document.createElement('button');
    searchBtn.className = 'niche-search-btn';
    searchBtn.textContent = '🔍 Buscar este nicho en YouTube';
    searchBtn.addEventListener('click', function() {
      chrome.tabs.create({ url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(niche.searchQuery) });
    });
    body.appendChild(searchBtn);

    card.appendChild(body);
    grid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  load();

  document.querySelectorAll('.fpill').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.fpill').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeRpm = btn.dataset.rpm;
      render();
    });
  });

  document.getElementById('search').addEventListener('input', function() {
    searchVal = this.value.trim();
    render();
  });

  setInterval(function () { if (document.visibilityState !== 'hidden') load(); }, 6000);
});
