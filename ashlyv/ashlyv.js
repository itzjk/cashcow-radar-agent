var engine = window.ASHLYVEngine || null;
var currentTranslated = '';
var currentBlueprintPrompt = '';
var currentRobaPrompt = '';
var currentRobaSnapshot = null;
var targetLang = 'en';
var currentChannelName = '';
var lastThumbnailAnalysisPayload = null;
var lastChannelAnalysisName = '';
var ashlyvToastCount = 0;
var ashlyvToastTimers = [];

var app = {
  state: engine && engine.normalizeGlobalState ? engine.normalizeGlobalState({}) : {
    selectedLanguage: 'auto',
    recentLanguages: [],
    pinnedLanguages: ['en', 'es', 'fr'],
    autoMix: true,
    filters: [],
    watchlist: []
  },
  savedNichos: [],
  savedChannels: [],
  mergedEntries: [],
  opportunityHistory: [],
  alertHistory: [],
  opportunities: [],
  allOpportunities: [],
  selectedOpportunity: null,
  languageSearch: '',
  comparisonSort: 'opportunity',
  currentBlueprintItem: null
};

var FILTER_HELP = {
  high_rpm: 'Keeps only niches with a high RPM.',
  low_comp: 'Favors markets with fewer strong channels competing.',
  low_sat: 'Looks for less saturated spaces.',
  fully_faceless: 'Only formats you can make without showing your face.',
  easy_scale: 'Repeatable niches you can publish at volume.',
  storytelling: 'Stories, documentaries and narrative.',
  sleep: 'Long content for sleep or background listening.',
  history: 'History, ancient mysteries and documentaries.',
  psychology: 'Psychology, mind, behavior and data.',
  mystery: 'Mysteries, secrets, paranormal and curiosity.',
  science: 'Science, space, technology and explainers.',
  survival: 'Survival, blackouts, prepping and crisis.',
  religion: 'Religion, philosophy and evergreen content.',
  trending: 'Niches with recent growth signals.',
  underserved: 'Languages with demand but little good supply.',
  outlier: 'Where small videos can break out hard.',
  saved_only: 'Only opportunities backed by data in your archive.',
  new_only: 'Fresh data only.',
  best_week: 'Strong signals saved this week.',
  best_month: 'Strong signals saved this month.'
};

var YOUTUBE_LOCALE_OVERRIDES = {
  auto: { gl: 'US', hl: 'en' },
  en: { gl: 'US', hl: 'en' },
  es: { gl: 'MX', hl: 'es' },
  pt: { gl: 'BR', hl: 'pt-BR' },
  fr: { gl: 'FR', hl: 'fr' },
  de: { gl: 'DE', hl: 'de' },
  it: { gl: 'IT', hl: 'it' },
  nl: { gl: 'NL', hl: 'nl' },
  pl: { gl: 'PL', hl: 'pl' },
  ro: { gl: 'RO', hl: 'ro' },
  cs: { gl: 'CZ', hl: 'cs' },
  sk: { gl: 'SK', hl: 'sk' },
  hu: { gl: 'HU', hl: 'hu' },
  sv: { gl: 'SE', hl: 'sv' },
  no: { gl: 'NO', hl: 'no' },
  da: { gl: 'DK', hl: 'da' },
  fi: { gl: 'FI', hl: 'fi' },
  tr: { gl: 'TR', hl: 'tr' },
  ar: { gl: 'SA', hl: 'ar' },
  he: { gl: 'IL', hl: 'he' },
  hi: { gl: 'IN', hl: 'hi' },
  ur: { gl: 'PK', hl: 'ur' },
  bn: { gl: 'BD', hl: 'bn' },
  ta: { gl: 'IN', hl: 'ta' },
  te: { gl: 'IN', hl: 'te' },
  ja: { gl: 'JP', hl: 'ja' },
  ko: { gl: 'KR', hl: 'ko' },
  'zh-cn': { gl: 'SG', hl: 'zh-CN' },
  'zh-tw': { gl: 'TW', hl: 'zh-TW' },
  yue: { gl: 'HK', hl: 'zh-HK' },
  th: { gl: 'TH', hl: 'th' },
  vi: { gl: 'VN', hl: 'vi' },
  id: { gl: 'ID', hl: 'id' },
  ms: { gl: 'MY', hl: 'ms' },
  tl: { gl: 'PH', hl: 'fil' },
  ru: { gl: 'RU', hl: 'ru' },
  uk: { gl: 'UA', hl: 'uk' },
  el: { gl: 'GR', hl: 'el' },
  sr: { gl: 'RS', hl: 'sr' },
  hr: { gl: 'HR', hl: 'hr' },
  bg: { gl: 'BG', hl: 'bg' },
  lt: { gl: 'LT', hl: 'lt' },
  lv: { gl: 'LV', hl: 'lv' },
  et: { gl: 'EE', hl: 'et' },
  ka: { gl: 'GE', hl: 'ka' },
  fa: { gl: 'US', hl: 'fa' },
  sw: { gl: 'KE', hl: 'sw' }
};

function getOpportunityKey(opportunity) {
  if (!opportunity) return '';
  return String(opportunity.languageCode || '') + '|' + String(opportunity.nicheId || '');
}

function toNumber(value) {
  var num = Number(value);
  return isFinite(num) ? num : 0;
}

function avg(list) {
  list = (list || []).map(toNumber).filter(function(n) { return isFinite(n); });
  if (!list.length) return 0;
  return list.reduce(function(sum, n) { return sum + n; }, 0) / list.length;
}

function compactNumber(value) {
  var num = toNumber(value);
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(num >= 10000000 ? 0 : 1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
  return String(Math.round(num));
}

function moneyLabel(value) {
  var num = toNumber(value);
  if (!num) return '$0';
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(num >= 10000000 ? 0 : 1) + 'M';
  if (num >= 1000) return '$' + (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
  return '$' + Math.round(num);
}

function rpmLabel(value) {
  return '$' + toNumber(value).toFixed(2);
}

function savedDateLabel(ts) {
  var time = toNumber(ts);
  if (!time) return 'NO DATE';
  var d = new Date(time);
  if (isNaN(d.getTime())) return 'NO DATE';
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return 'SAVE ' + y + '-' + m + '-' + day;
}

function relTime(ts) {
  var delta = Date.now() - toNumber(ts);
  if (delta <= 0) return 'now';
  var hours = Math.floor(delta / 3600000);
  if (hours < 1) return 'minutes ago';
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  if (days < 30) return days + 'd ago';
  var months = Math.floor(days / 30);
  return months + 'mo ago';
}

function isChannelEntry(entry) {
  if (!entry) return false;
  if (entry.source === 'channel-guardar') return true;
  if (entry.channelId && !entry.vidId && toNumber(entry.vph) === 0) return true;
  return false;
}

function getLanguageList() {
  return engine && engine.languageEngine && engine.languageEngine.list
    ? engine.languageEngine.list()
    : [
        { code: 'auto', label: 'Auto Mix', nativeLabel: 'Auto Mix' },
        { code: 'en', label: 'English', nativeLabel: 'English' },
        { code: 'es', label: 'Spanish', nativeLabel: 'Espanol' },
        { code: 'fr', label: 'French', nativeLabel: 'Francais' }
      ];
}

function getLanguageMeta(code) {
  if (engine && engine.languageEngine && engine.languageEngine.get) return engine.languageEngine.get(code || 'auto');
  var list = getLanguageList();
  return list.find(function(item) { return item.code === code; }) || list[0];
}

function getLanguageLabel(code) {
  var meta = getLanguageMeta(code);
  return meta ? (meta.label || meta.nativeLabel || code) : code;
}

function verdictLabel(verdict) {
  var raw = String(verdict || '').toUpperCase();
  if (raw === 'ENTER NOW') return 'ENTER NOW';
  if (raw === 'TEST') return 'TEST';
  if (raw === 'WATCH') return 'WATCH';
  if (raw === 'IGNORE') return 'IGNORE';
  return verdict || '';
}

function getYouTubeLocale(languageCode) {
  var code = String(languageCode || app.state.selectedLanguage || 'auto').toLowerCase();
  if (YOUTUBE_LOCALE_OVERRIDES[code]) return YOUTUBE_LOCALE_OVERRIDES[code];
  var meta = getLanguageMeta(code);
  var region = meta && meta.regions && meta.regions[0] && meta.regions[0].code ? String(meta.regions[0].code) : 'US';
  var gl = /^[A-Z]{2}$/.test(region) ? region : 'US';
  return { gl: gl, hl: code === 'auto' ? 'en' : code.split('-')[0] };
}

function buildYouTubeSearchUrl(query, languageCode) {
  var locale = getYouTubeLocale(languageCode);
  var params = new URLSearchParams();
  params.set('search_query', String(query || '').trim());
  params.set('gl', locale.gl);
  params.set('hl', locale.hl);
  params.set('persist_gl', '1');
  return 'https://www.youtube.com/results?' + params.toString();
}

function buildYouTubeHomeUrl(languageCode) {
  var locale = getYouTubeLocale(languageCode);
  return 'https://www.youtube.com/?gl=' + encodeURIComponent(locale.gl) + '&hl=' + encodeURIComponent(locale.hl) + '&persist_gl=1';
}

function detectDashboardLanguageFromText(text) {
  var raw = String(text || '');
  var lower = raw.toLowerCase();
  var folded = lower.normalize ? lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : lower;
  if (/\b(szokujacych|faktow|nowym|jorku|ktory|ktora|ktore|ludzkosc|powierzchni|ziemi|zniszczy|zmiecie|tajemnice|przetrwanie|naukowy|wulkan)\b/.test(folded)) return 'pl';
  if (/[ąćęłńóśźż]/i.test(raw) && /\b(historia|ziemi|wulkan|nauka|tajemnice|psychologia)\b/.test(folded)) return 'pl';
  if (/\b(warum|wir|fast|vom|von|glauben|abgefallen|sind|nicht|komplett|zerlegt|geschichte|geheimnisse)\b/.test(folded)) return 'de';
  if (engine && engine.languageEngine && engine.languageEngine.detectLanguage) {
    try {
      var detected = engine.languageEngine.detectLanguage(raw, 'unknown');
      if (detected && detected !== 'unknown') return detected;
    } catch(e) {}
  }
  return 'unknown';
}

function detectEntryLanguage(entry) {
  entry = entry || {};
  var text = [entry.title || '', entry.channelName || '', entry.channel || '', entry.channelUrl || '', entry.niche || ''].join(' ');
  var detected = detectDashboardLanguageFromText(text);
  if (detected && detected !== 'unknown') return detected;
  if (entry.language && entry.language !== 'unknown') return entry.language;
  if (engine && engine.nicheScoring && engine.nicheScoring.inferEntryLanguage) {
    return engine.nicheScoring.inferEntryLanguage(entry || {});
  }
  return entry.language || 'unknown';
}

function normalizeNichoEntry(item) {
  item = item || {};
  var language = detectEntryLanguage(item);
  return {
    title: String(item.title || item.name || 'Untitled').trim(),
    niche: String(item.niche || 'General').trim(),
    nicheId: String(item.nicheId || (engine && engine.nicheScoring ? engine.nicheScoring.inferNicheIdFromText((item.niche || '') + ' ' + (item.title || '')) : 'history_documentary')).trim(),
    tier: String(item.tier || '').trim().toUpperCase(),
    thumbUrl: String(item.thumbUrl || '').trim(),
    vidId: String(item.vidId || item.videoId || '').trim(),
    channelId: String(item.channelId || '').trim(),
    channelUrl: String(item.channelUrl || '').trim(),
    channelName: String(item.channelName || item.name || '').trim(),
    source: String(item.source || 'scan').trim(),
    language: language || 'unknown',
    subs: toNumber(item.subs),
    views: toNumber(item.views),
    vph: toNumber(item.vph),
    rpm: toNumber(item.rpm),
    os: Math.round(toNumber(item.os)),
    totalRev: toNumber(item.totalRev),
    revMonth: toNumber(item.revMonth),
    facelessScore: toNumber(item.facelessScore),
    facelessClassification: String(item.facelessClassification || '').trim(),
    savedAt: toNumber(item.savedAt) || Date.now()
  };
}

function mergeChannelIncome(entries, channels) {
  channels = (channels || []).slice();
  return (entries || []).map(function(raw) {
    var entry = normalizeNichoEntry(raw);
    if (entry.revMonth > 0 && entry.subs > 0) return entry;
    for (var i = 0; i < channels.length; i++) {
      var ch = channels[i] || {};
      var sameChannelId = entry.channelId && ch.channelId && entry.channelId === ch.channelId;
      var sameUrl = entry.channelUrl && ch.channelUrl && entry.channelUrl === ch.channelUrl;
      var sameTitle = entry.title && ch.name && entry.title.toLowerCase() === String(ch.name).toLowerCase();
      if (!sameChannelId && !sameUrl && !sameTitle) continue;
      if (!entry.revMonth && toNumber(ch.revMonth) > 0) entry.revMonth = toNumber(ch.revMonth);
      if (!entry.subs && toNumber(ch.subs) > 0) entry.subs = toNumber(ch.subs);
      if ((!entry.niche || entry.niche === 'General') && ch.niche) entry.niche = String(ch.niche);
      if ((!entry.language || entry.language === 'unknown') && ch.language) entry.language = ch.language;
      break;
    }
    return entry;
  });
}

function mergeDashboardEntries(nichos, channels) {
  var merged = mergeChannelIncome(nichos || [], channels || []);
  var seen = {};
  merged.forEach(function(entry) {
    var key = entry.channelId || entry.channelUrl || entry.vidId || entry.title;
    if (key) seen[key] = true;
  });
  (channels || []).forEach(function(channel) {
    var entry = normalizeNichoEntry({
      title: channel.name || 'Saved channel',
      channelName: channel.name || '',
      channelId: channel.channelId || '',
      channelUrl: channel.channelUrl || '',
      subs: channel.subs || 0,
      revMonth: channel.revMonth || 0,
      niche: channel.niche || 'General',
      language: channel.language || detectEntryLanguage(channel),
      source: 'channel-guardar',
      savedAt: channel.savedAt || Date.now()
    });
    var key = entry.channelId || entry.channelUrl || entry.title;
    if (!key || seen[key]) return;
    seen[key] = true;
    merged.push(entry);
  });
  return merged.sort(function(a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
}

function totalMonthlyVisible() {
  return app.mergedEntries.reduce(function(acc, item) {
    return acc + (item.revMonth || 0);
  }, 0);
}

function totalViralSaved() {
  return app.mergedEntries.filter(function(item) {
    return String(item.tier || '').toUpperCase() === 'VIRAL' || toNumber(item.os) >= 75;
  }).length;
}

function averageRpm() {
  if (!app.mergedEntries.length) return 0;
  return app.mergedEntries.reduce(function(acc, item) {
    return acc + (item.rpm || 0);
  }, 0) / app.mergedEntries.length;
}

function requestRuntimeMessage(message) {
  return new Promise(function(resolve) {
    try {
      chrome.runtime.sendMessage(message, function(res) { resolve(res || { ok: false }); });
    } catch (err) {
      resolve({ ok: false, error: err && err.message });
    }
  });
}

function requestAnthropicProxy(message) {
  return new Promise(function(resolve, reject) {
    try {
      chrome.runtime.sendMessage(message, function(res) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'runtime_error'));
          return;
        }
        if (!res) {
          reject(new Error('No response from the service worker'));
          return;
        }
        resolve(res);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function saveGlobalState() {
  return requestRuntimeMessage({
    type: 'ASHLYV_GLOBAL_STATE_PATCH',
    patch: app.state,
    filters: app.state.filters || [],
    watchlist: app.state.watchlist || []
  });
}

function pushOpportunityHistory(entries) {
  if (!entries || !entries.length) return Promise.resolve();
  return requestRuntimeMessage({
    type: 'ASHLYV_OPPORTUNITY_HISTORY_PUSH',
    entries: entries
  });
}

function computeEngineData() {
  var selectedLanguage = app.state.selectedLanguage || 'auto';
  var filters = app.state.filters || [];
  var previousSelectedKey = getOpportunityKey(app.selectedOpportunity);
  app.allOpportunities = engine && engine.nicheScoring
    ? engine.nicheScoring.buildLanguageMatrix(app.mergedEntries, 'auto', [], app.opportunityHistory)
    : [];
  app.opportunities = engine && engine.nicheScoring
    ? engine.nicheScoring.buildLanguageMatrix(app.mergedEntries, selectedLanguage, filters, app.opportunityHistory)
    : [];

  if (!app.opportunities.length && selectedLanguage !== 'auto' && engine && engine.nicheScoring) {
    app.opportunities = engine.nicheScoring.buildLanguageMatrix(app.mergedEntries, selectedLanguage, [], app.opportunityHistory);
  }
  var preserved = null;
  if (previousSelectedKey) {
    preserved = app.opportunities.find(function(item) { return getOpportunityKey(item) === previousSelectedKey; }) || null;
    if (!preserved && selectedLanguage === 'auto') {
      preserved = app.allOpportunities.find(function(item) { return getOpportunityKey(item) === previousSelectedKey; }) || null;
    }
  }
  app.selectedOpportunity = preserved || app.opportunities[0] || (selectedLanguage === 'auto' ? app.allOpportunities[0] : null) || null;
  if (!app.selectedOpportunity) return;

  if ((app.state.recentLanguages || []).indexOf(app.selectedOpportunity.languageCode) === -1 && app.selectedOpportunity.languageCode !== 'auto') {
    app.state.recentLanguages = [app.selectedOpportunity.languageCode].concat(app.state.recentLanguages || []).filter(function(code, index, arr) {
      return arr.indexOf(code) === index;
    }).slice(0, 6);
  }
}

function sortComparisonRows(rows, mode) {
  rows = (rows || []).slice();
  if (mode === 'rpm') rows.sort(function(a, b) { return b.estimatedRpm - a.estimatedRpm; });
  else if (mode === 'competition') rows.sort(function(a, b) { return a.competitionScore - b.competitionScore; });
  else if (mode === 'underserved') rows.sort(function(a, b) { return b.languageGapScore - a.languageGapScore; });
  else if (mode === 'faceless') rows.sort(function(a, b) { return b.facelessScore - a.facelessScore; });
  else if (mode === 'growth') rows.sort(function(a, b) { return b.velocity - a.velocity; });
  else rows.sort(function(a, b) { return b.opportunityScore - a.opportunityScore; });
  return rows;
}

function buildComparisonRows() {
  if (!app.selectedOpportunity || !engine || !engine.nicheScoring) return [];
  var selectedLanguage = app.state.selectedLanguage || 'auto';
  var base = selectedLanguage !== 'auto'
    ? (app.opportunities || [])
    : ((app.allOpportunities && app.allOpportunities.length) ? app.allOpportunities : (app.opportunities || []));
  var sorted = sortComparisonRows(base, app.comparisonSort);
  return diversifyOpportunityList(sorted, selectedLanguage !== 'auto' ? 10 : 12);
}

function buildOpportunityPrompt(opportunity) {
  if (!opportunity) return '';
  var regions = (opportunity.regions || []).map(function(region) {
    return '- ' + region.label + ': demand ' + region.demand + ', monetization ' + region.monetization + ', fit ' + region.nicheFit;
  }).join('\n');
  return [
    'You are a senior faceless YouTube strategist.',
    'Build an execution plan for this ASHLYV global niche opportunity.',
    '',
    'LANGUAGE',
    '- ' + opportunity.languageLabel,
    '',
    'RECOMMENDED NICHE',
    '- ' + opportunity.recommendedNiche,
    '',
    'SCORES',
    '- Opportunity score: ' + opportunity.opportunityScore + '/10',
    '- RPM: $' + opportunity.estimatedRpm,
    '- Demand: ' + opportunity.demandLabel + ' (' + opportunity.demandScore + ')',
    '- Competition: ' + opportunity.competitionLabel + ' (' + opportunity.competitionScore + ')',
    '- Saturation: ' + opportunity.saturationLabel + ' (' + opportunity.saturationScore + ')',
    '- Faceless suitability: ' + opportunity.facelessScore + '/10',
    '- Repeatability: ' + opportunity.repeatabilityScore + '/10',
    '- Language gap: ' + opportunity.languageGapScore + '/10',
    '',
    'WHY IT WORKS',
    opportunity.why,
    '',
    'BEST REGIONS',
    regions || '- none',
    '',
    'VERDICT',
    '- ' + opportunity.verdict,
    '',
    'Give me:',
    '1. Channel positioning.',
    '2. A 30-day faceless content system.',
    '3. 12 high-CTR title ideas.',
    '4. Thumbnail language and packaging.',
    '5. Monetization beyond AdSense.',
    '6. Risks, competition traps, and what to avoid.'
  ].join('\n');
}

function openOpportunityInChatGPT(opportunity) {
  var prompt = buildOpportunityPrompt(opportunity);
  currentBlueprintPrompt = prompt;
  try { navigator.clipboard.writeText(prompt); } catch (e) {}
  window.open('https://chatgpt.com/?q=' + encodeURIComponent(prompt), '_blank');
}

function buildRobaNichoPrompt(snapshot) {
  if (!snapshot) return '';
  var competitors = (snapshot.topCompetitors || []).map(function(item, idx) {
    return (idx + 1) + '. ' + item.channelLabel + ' | ' + compactNumber(item.avgVph) + '/h | RPM ' + rpmLabel(item.avgRpm) + ' | OS ' + item.avgOs + ' | ' + (item.leadTitle || 'unknown');
  }).join('\n');
  var works = (snapshot.whatWorks || []).map(function(item) { return '- ' + item; }).join('\n');
  var diffs = (snapshot.differenceSignals || []).map(function(item) { return '- ' + item; }).join('\n');
  var gaps = (snapshot.gapMoves || []).map(function(item) { return '- ' + item; }).join('\n');
  var weak = (snapshot.weakSignals || []).map(function(item) { return '- ' + item; }).join('\n');
  var titles = (snapshot.titleExamples || []).map(function(item, idx) { return (idx + 1) + '. ' + item; }).join('\n');
  return [
    'Act as a senior faceless YouTube operator who specializes in taking over competitive niches.',
    'I want to enter this niche with a better offer, not a cheap copy.',
    'Work only from the ASHLYV snapshot and say clearly where data is missing.',
    '',
    'NICHE SNAPSHOT',
    '- Language: ' + snapshot.languageLabel,
    '- Niche: ' + snapshot.nicheLabel,
    '- Attack query: ' + snapshot.searchQuery,
    '- Opportunity score: ' + snapshot.opportunityScore + '/10',
    '- RPM: ' + rpmLabel(snapshot.estimatedRpm),
    '- Competition: ' + snapshot.competitionLabel + ' / ' + snapshot.competitionScore,
    '- Saturation: ' + snapshot.saturationLabel + ' / ' + snapshot.saturationScore,
    '- Demand: ' + snapshot.demandLabel + ' / ' + snapshot.demandScore,
    '- Velocity proxy: ' + compactNumber(snapshot.velocity) + '/h',
    '- Visible samples: ' + snapshot.sampleCount,
    '- Visible competitors: ' + snapshot.competitorCount,
    '',
    'TOP COMPETITORS',
    competitors || '- unknown',
    '',
    'WHAT WORKS BEST',
    works || '- unknown',
    '',
    'WHAT THE WINNERS DO DIFFERENTLY',
    diffs || '- unknown',
    '',
    'WHAT LOOKS WEAK OR REPEATED',
    weak || '- unknown',
    '',
    'GAPS TO ENTER',
    gaps || '- unknown',
    '',
    'TITLES AND HOOKS TO STUDY',
    titles || '- unknown',
    '',
    'GIVE ME:',
    '1. A diagnosis of the niche and the real level of competition.',
    '2. Exactly what is working and why.',
    '3. What the winners do differently from the average channel.',
    '4. What I should not copy literally.',
    '5. A stronger, more scalable entry angle.',
    '6. A title and thumbnail system to enter with.',
    '7. 12 video ideas to attack this niche.',
    '8. Saturation risks and how to avoid them.'
  ].join('\n');
}

function fillRobaNichoPreview(snapshot) {
  currentRobaSnapshot = snapshot || null;
  currentRobaPrompt = buildRobaNichoPrompt(snapshot);
  document.getElementById('rn-summary').textContent = snapshot
    ? snapshot.languageLabel + ' | ' + snapshot.nicheLabel + ' | Competition ' + snapshot.competitionLabel + ' | Saturation ' + snapshot.saturationLabel + ' | Demand ' + snapshot.demandLabel + '.'
    : 'Pick a niche and pull its competitive intelligence.';
  document.getElementById('rn-query').textContent = snapshot ? snapshot.searchQuery : '-';
  document.getElementById('rn-score').textContent = snapshot ? (snapshot.opportunityScore + '/10') : '0/10';
  document.getElementById('rn-competitors').textContent = snapshot ? String(snapshot.competitorCount || 0) : '0';
  document.getElementById('rn-rpm').textContent = snapshot ? rpmLabel(snapshot.estimatedRpm) : '$0';
  document.getElementById('rn-vph').textContent = snapshot ? (compactNumber(snapshot.velocity) + '/h') : '0/h';

  function fillList(id, items) {
    var host = document.getElementById(id);
    host.innerHTML = '';
    (items && items.length ? items : ['Not enough data yet.']).forEach(function(item) {
      host.appendChild(el('div', 'rn-list-item', item));
    });
  }

  fillList('rn-works', snapshot ? snapshot.whatWorks : []);
  fillList('rn-diff', snapshot ? snapshot.differenceSignals : []);
  fillList('rn-gap', snapshot ? snapshot.gapMoves : []);
  fillList('rn-titles', snapshot ? snapshot.titleExamples : []);

  var chipHost = document.getElementById('rn-patterns');
  chipHost.innerHTML = '';
  ((snapshot && snapshot.winnerPatterns) || []).slice(0, 6).forEach(function(item) {
    chipHost.appendChild(el('div', 'rn-chip', item));
  });
  if (!chipHost.childNodes.length) chipHost.appendChild(el('div', 'rn-chip', 'NO DATA'));

  var competitorGrid = document.getElementById('rn-competitor-grid');
  competitorGrid.innerHTML = '';
  ((snapshot && snapshot.topCompetitors) || []).slice(0, 4).forEach(function(item) {
    var card = el('div', 'rn-competitor stack-item-link');
    bindClickableCard(card, function() {
      openYouTubeSearch(item.leadTitle || item.channelLabel || snapshot.searchQuery, snapshot.languageCode);
    });
    card.appendChild(el('div', 'rn-competitor-title', item.channelLabel));
    card.appendChild(el('div', 'rn-competitor-meta', compactNumber(item.avgVph) + '/h | RPM ' + rpmLabel(item.avgRpm) + ' | OS ' + item.avgOs + ' | ' + item.sampleCount + ' samples'));
    card.appendChild(el('div', 'rn-competitor-copy', item.leadTitle || 'No visible title'));
    competitorGrid.appendChild(card);
  });
  if (!competitorGrid.childNodes.length) {
    var empty = el('div', 'rn-competitor');
    empty.appendChild(el('div', 'rn-competitor-title', 'No visible competitors'));
    empty.appendChild(el('div', 'rn-competitor-copy', 'Save more niches or channels and ASHLYV will build a deeper competitive map.'));
    competitorGrid.appendChild(empty);
  }
}

function openRobaNicho(opportunity) {
  if (!opportunity || !engine || !engine.nicheScoring || !engine.nicheScoring.buildCompetitiveSnapshot) return;
  var snapshot = engine.nicheScoring.buildCompetitiveSnapshot(
    opportunity.languageCode || 'auto',
    opportunity.nicheId,
    app.mergedEntries,
    app.opportunityHistory
  );
  fillRobaNichoPreview(snapshot);
  document.getElementById('rn-modal').style.display = 'flex';
}

function closeRobaNicho() {
  document.getElementById('rn-modal').style.display = 'none';
}

function copyRobaPrompt() {
  if (!currentRobaPrompt) return;
  try { navigator.clipboard.writeText(currentRobaPrompt); } catch (e) {}
  var btn = document.getElementById('rn-btn-copy');
  btn.textContent = 'COPIED';
  setTimeout(function() { btn.textContent = 'Copy intel'; }, 1400);
}

function openRobaInChatGPT() {
  if (!currentRobaPrompt) return;
  window.open('https://chatgpt.com/?q=' + encodeURIComponent(currentRobaPrompt), '_blank');
}

function searchRobaOnYouTube() {
  if (!currentRobaSnapshot) return;
  openYouTubeSearch(currentRobaSnapshot.searchQuery || currentRobaSnapshot.nicheLabel, currentRobaSnapshot.languageCode);
}

function openYouTubeSearch(query, languageCode) {
  query = String(query || '').trim();
  if (!query) return;
  window.open(buildYouTubeSearchUrl(query, languageCode), '_blank');
}

function focusOpportunity(opportunity) {
  if (!opportunity) return;
  app.selectedOpportunity = opportunity;
  if (opportunity.languageCode && opportunity.languageCode !== 'auto') {
    app.state.selectedLanguage = opportunity.languageCode;
    app.state.autoMix = false;
    app.state.recentLanguages = [opportunity.languageCode].concat(app.state.recentLanguages || []).filter(function(code, index, arr) {
      return code && code !== 'auto' && arr.indexOf(code) === index;
    }).slice(0, 6);
    saveGlobalState();
    computeEngineData();
  }
  render();
}

function buildScopedOpportunityList() {
  var selectedLanguage = app.state.selectedLanguage || 'auto';
  var base = selectedLanguage !== 'auto'
    ? (app.opportunities || [])
    : ((app.opportunities && app.opportunities.length) ? app.opportunities : (app.allOpportunities || []));
  if ((!base || !base.length) && app.allOpportunities && app.allOpportunities.length) base = app.allOpportunities;
  return (base || []).slice(0, selectedLanguage !== 'auto' ? 6 : 4);
}

function getOpportunityQuery(opportunity) {
  if (!opportunity || !engine || !engine.languageEngine) return opportunity ? (opportunity.recommendedNiche || '') : '';
  var query = engine.languageEngine.buildQueryForNiche
    ? engine.languageEngine.buildQueryForNiche(opportunity.languageCode || 'auto', opportunity.nicheId)
    : '';
  if (!query) {
    var pool = engine.languageEngine.buildQueryPool(opportunity.languageCode || 'auto');
    query = (pool && pool[0]) || opportunity.recommendedNiche || '';
  }
  return query;
}

function diversifyOpportunityList(list, limit) {
  var source = (list || []).slice();
  var out = [];
  var seenKey = {};
  var seenNiche = {};
  var seenLanguage = {};

  function add(item, strict) {
    if (!item) return;
    var key = getOpportunityKey(item);
    if (!key || seenKey[key]) return;
    if (strict === 'language-and-niche' && (seenLanguage[item.languageCode] || seenNiche[item.nicheId])) return;
    if (strict === 'niche' && seenNiche[item.nicheId]) return;
    seenKey[key] = true;
    seenNiche[item.nicheId] = true;
    seenLanguage[item.languageCode] = true;
    out.push(item);
  }

  source.forEach(function(item) { if (out.length < limit) add(item, 'language-and-niche'); });
  source.forEach(function(item) { if (out.length < limit) add(item, 'niche'); });
  source.forEach(function(item) { if (out.length < limit) add(item, 'any'); });
  return out.slice(0, limit);
}

function bindActionButton(button, handler) {
  button.onclick = function(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    handler();
  };
}

function bindClickableCard(card, handler) {
  if (!card) return;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.onclick = function() { handler(); };
  card.onkeydown = function(ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      handler();
    }
  };
}

function buildOpportunityActionRow(opportunity, options) {
  options = options || {};
  var actions = el('div', 'subtle-actions');
  if (options.includeMasterplan !== false) {
    var gptBtn = el('button', 'subtle-btn' + (options.primaryMasterplan ? ' primary' : ''), 'Plan GPT');
    bindActionButton(gptBtn, function() { openOpportunityInChatGPT(opportunity); });
    actions.appendChild(gptBtn);
  }
  if (options.includeScan !== false) {
    var scanBtn = el('button', 'subtle-btn primary', 'Scan on YouTube');
    bindActionButton(scanBtn, function() { scanOpportunityOnYouTube(opportunity); });
    actions.appendChild(scanBtn);
  }
  if (options.includeSearch !== false) {
    var searchBtn = el('button', 'subtle-btn', 'Search niche');
    bindActionButton(searchBtn, function() { searchOpportunityOnYouTube(opportunity); });
    actions.appendChild(searchBtn);
  }
  if (options.includeSave !== false) {
    var saveBtn = el('button', 'subtle-btn', 'Save');
    bindActionButton(saveBtn, function() { saveOpportunity(opportunity); });
    actions.appendChild(saveBtn);
  }
  if (options.includeRoba) {
    var robaBtn = el('button', 'subtle-btn', 'Steal Niche');
    bindActionButton(robaBtn, function() { openRobaNicho(opportunity); });
    actions.appendChild(robaBtn);
  }
  if (options.includeWatch !== false) {
    var watchBtn = el('button', 'subtle-btn', (app.state.watchlist || []).indexOf(opportunity.languageCode + '|' + opportunity.nicheId) >= 0 ? 'Watching' : 'Watch');
    bindActionButton(watchBtn, function() { toggleWatchlist(opportunity); });
    actions.appendChild(watchBtn);
  }
  if (options.includeFocus) {
    var isFocused = getOpportunityKey(app.selectedOpportunity) === getOpportunityKey(opportunity);
    var focusBtn = el('button', 'subtle-btn' + (isFocused ? ' primary' : ''), isFocused ? 'In focus' : 'View this');
    bindActionButton(focusBtn, function() { focusOpportunity(opportunity); });
    actions.appendChild(focusBtn);
  }
  return actions;
}

function searchOpportunityOnYouTube(opportunity) {
  if (!opportunity || !engine || !engine.languageEngine) return;
  openYouTubeSearch(getOpportunityQuery(opportunity), opportunity.languageCode);
}

function scanOpportunityOnYouTube(opportunity) {
  if (!opportunity || !engine || !engine.languageEngine) return;
  var query = getOpportunityQuery(opportunity);
  if (!query) return;
  var pending = {
    query: query,
    nicheId: opportunity.nicheId || '',
    languageCode: opportunity.languageCode || 'auto',
    expiry: Date.now() + 240000
  };
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ ashlyv_pending_scan: pending }, function() {
      window.open(buildYouTubeSearchUrl(query, opportunity.languageCode), '_blank');
    });
  } else {
    window.open(buildYouTubeSearchUrl(query, opportunity.languageCode), '_blank');
  }
}

function searchTextOnYouTube(text, languageCode) {
  openYouTubeSearch(text, languageCode || app.state.selectedLanguage);
}

function searchSavedGroupOnYouTube(group) {
  if (!group) return;
  var topItem = group.items && group.items[0] ? group.items[0] : null;
  openYouTubeSearch((topItem && (topItem.title || topItem.niche || topItem.channelName)) || group.label, group.code);
}

function saveOpportunity(opportunity) {
  if (!opportunity || !chrome || !chrome.storage) return;
  var entry = normalizeNichoEntry({
    title: opportunity.recommendedNiche + ' - ' + opportunity.languageLabel,
    niche: opportunity.recommendedNiche,
    nicheId: opportunity.nicheId,
    language: opportunity.languageCode,
    revMonth: Math.round(opportunity.estimatedRpm * 340),
    rpm: opportunity.estimatedRpm,
    os: Math.round(opportunity.opportunityScore * 10),
    vph: opportunity.velocity,
    facelessScore: Math.round(opportunity.facelessScore * 10),
    source: 'global-engine',
    savedAt: Date.now()
  });
  chrome.storage.local.get(['ashlyv_nichos', 'ashlyv_nichos_backup'], function(res) {
    var base = Array.isArray(res.ashlyv_nichos) && res.ashlyv_nichos.length
      ? res.ashlyv_nichos
      : (Array.isArray(res.ashlyv_nichos_backup) ? res.ashlyv_nichos_backup : []);
    var saved = base.slice();
    saved.unshift(entry);
    var nextSaved = saved.slice(0, 240);
    chrome.storage.local.set({
      ashlyv_nichos: nextSaved,
      ashlyv_nichos_backup: nextSaved
    }, function() {
      app.savedNichos = nextSaved;
      app.mergedEntries = mergeDashboardEntries(app.savedNichos, app.savedChannels);
      computeEngineData();
      render();
    });
  });
}

function toggleWatchlist(opportunity) {
  if (!opportunity) return;
  var key = opportunity.languageCode + '|' + opportunity.nicheId;
  var watchlist = (app.state.watchlist || []).slice();
  var idx = watchlist.indexOf(key);
  var added = idx < 0;
  if (idx >= 0) watchlist.splice(idx, 1);
  else watchlist.unshift(key);
  app.state.watchlist = watchlist.slice(0, 100);
  saveGlobalState();
  if (added && engine && engine.nicheScoring && engine.nicheScoring.buildAlertCandidateFromOpportunity) {
    requestRuntimeMessage({
      type: 'ASHLYV_ALERT_PUSH',
      alert: engine.nicheScoring.buildAlertCandidateFromOpportunity(opportunity, 'watchlist')
    }).then(function(res) {
      if (res && res.alert) app.alertHistory = [res.alert].concat(app.alertHistory || []).slice(0, 120);
      renderEngine();
    });
  }
  renderEngine();
}

function renderStats() {
  document.getElementById('s-total').textContent = String(app.mergedEntries.length);
  document.getElementById('s-viral').textContent = String(totalViralSaved());
  document.getElementById('s-rpm').textContent = rpmLabel(averageRpm());
  document.getElementById('s-rev').textContent = moneyLabel(totalMonthlyVisible());
}

function getMostCommonNiche() {
  var counts = {};
  app.mergedEntries.forEach(function(item) {
    var key = item.niche || 'General';
    counts[key] = (counts[key] || 0) + 1;
  });
  var max = 0;
  var top = 'General';
  Object.keys(counts).forEach(function(key) {
    if (counts[key] > max) {
      top = key;
      max = counts[key];
    }
  });
  return top;
}

function updateHero() {
  var topNicheEl = document.getElementById('hero-top-niche');
  var potentialEl = document.getElementById('hero-potential');
  var titleEl = document.getElementById('hero-title');
  var descEl = document.getElementById('hero-desc');

  if (!app.selectedOpportunity) {
    topNicheEl.textContent = getMostCommonNiche();
    potentialEl.textContent = moneyLabel(totalMonthlyVisible());
    titleEl.textContent = 'Premium radar of global opportunities';
    descEl.textContent = 'ASHLYV cross-reads languages, faceless niches, RPM, saturation and live alerts without touching your current archive.';
    return;
  }

  topNicheEl.textContent = app.selectedOpportunity.languageLabel;
  potentialEl.textContent = moneyLabel(app.selectedOpportunity.estimatedRpm * 1000);
  titleEl.textContent = app.selectedOpportunity.recommendedNiche;
  descEl.textContent = app.selectedOpportunity.why + ' Verdict: ' + verdictLabel(app.selectedOpportunity.verdict) + '.';
}

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderLanguageSelectorShell() {
  var shell = el('div', 'engine-shell');
  var inner = el('div', 'engine-inner');
  shell.appendChild(inner);

  var head = el('div', 'engine-head');
  var headLeft = el('div');
  headLeft.appendChild(el('div', 'engine-kicker', 'Global Niche Engine'));
  headLeft.appendChild(el('div', 'engine-title', 'Language Opportunity Matrix'));
  headLeft.appendChild(el('div', 'engine-copy', 'Pick any language, compare the same faceless niche across markets, and isolate the cleanest gap with RPM, competition, saturation, demand and region heuristics.'));
  head.appendChild(headLeft);
  inner.appendChild(head);

  var grid = el('div', 'engine-grid-2');
  var left = el('div', 'engine-card');
  var right = el('div', 'engine-card');
  grid.appendChild(left);
  grid.appendChild(right);

  var toolbar = el('div', 'language-toolbar');
  var search = document.createElement('input');
  search.className = 'language-search';
  search.placeholder = 'Search language or native name';
  search.value = app.languageSearch || '';
  search.addEventListener('input', function() {
    app.languageSearch = search.value || '';
    renderEngine();
    setTimeout(function() {
      var input = document.querySelector('.language-search');
      if (!input) return;
      input.focus();
      input.value = app.languageSearch || '';
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }, 0);
  });
  toolbar.appendChild(search);

  if ((app.state.recentLanguages || []).length) {
    var recent = el('div', 'recent-row');
    (app.state.recentLanguages || []).forEach(function(code) {
      var recentBtn = el('button', 'chip-btn' + ((app.state.selectedLanguage || 'auto') === code ? ' active' : ''), getLanguageLabel(code));
      recentBtn.onclick = function() {
        app.state.selectedLanguage = code;
        app.state.autoMix = false;
        saveGlobalState();
        computeEngineData();
        render();
      };
      recent.appendChild(recentBtn);
    });
    toolbar.appendChild(recent);
  }

  var autoRow = el('div', 'chip-row');
  var autoMixBtn = el('button', 'chip-btn' + ((app.state.selectedLanguage || 'auto') === 'auto' ? ' active' : ''), 'Auto Mix');
  autoMixBtn.onclick = function() {
    app.state.selectedLanguage = 'auto';
    app.state.autoMix = true;
    saveGlobalState();
    computeEngineData();
    render();
  };
  autoRow.appendChild(autoMixBtn);
  toolbar.appendChild(autoRow);

  var languageGrid = el('div', 'language-list');
  var languageResults = engine && engine.languageEngine && engine.languageEngine.search
    ? engine.languageEngine.search(app.languageSearch || '', app.state.recentLanguages || [])
    : getLanguageList();
  languageResults.filter(function(language) { return language.code !== 'auto'; }).forEach(function(language) {
    var tile = el('button', 'language-tile' + ((app.state.selectedLanguage || 'auto') === language.code ? ' active' : ''));
    tile.type = 'button';
    tile.onclick = function() {
      app.state.selectedLanguage = language.code;
      app.state.autoMix = language.code === 'auto';
      app.state.recentLanguages = [language.code].concat(app.state.recentLanguages || []).filter(function(code, index, arr) {
        return code && arr.indexOf(code) === index;
      }).slice(0, 6);
      saveGlobalState();
      computeEngineData();
      render();
    };
    tile.appendChild(el('div', 'language-tile-name', language.label));
    tile.appendChild(el('div', 'language-tile-meta', (language.nativeLabel || language.label) + ' | ' + String(language.code || '').toUpperCase()));
    languageGrid.appendChild(tile);
  });
  toolbar.appendChild(languageGrid);
  left.appendChild(toolbar);

  if (!app.selectedOpportunity) {
    right.appendChild(el('div', 'language-empty', 'No opportunity snapshot yet. Save more niches or channels and ASHLYV will immediately surface the strongest language gap.'));
  } else {
    var opp = app.selectedOpportunity;
    var selectedLanguage = app.state.selectedLanguage || 'auto';
    var scopedOpportunities = buildScopedOpportunityList();
    var localQuery = getOpportunityQuery(opp);
    var locale = getYouTubeLocale(opp.languageCode);
    right.appendChild(el('div', 'engine-kicker', selectedLanguage !== 'auto' ? ('Top Niches In ' + opp.languageLabel) : 'Top Global Opportunities'));
    right.appendChild(el('div', 'engine-card-title', opp.languageLabel + ' - ' + localQuery));
    right.appendChild(el('div', 'stack-item-meta', 'Base niche: ' + opp.recommendedNiche + ' | YouTube ' + locale.gl + ' / ' + locale.hl));

    var scoreRow = el('div', 'score-verdict-row');
    var scoreEl = el('div', 'engine-card-value', opp.opportunityScore + '/10');
    var verdictEl = el('div', 'verdict-chip verdict-inline', verdictLabel(opp.verdict));
    scoreRow.appendChild(scoreEl);
    scoreRow.appendChild(verdictEl);
    right.appendChild(scoreRow);

    if (opp.estimatedMonthlyRevenueLow) {
      var revBanner = el('div', 'rev-estimate-banner');
      revBanner.appendChild(el('span', 'rev-label', 'Est. Monthly Revenue'));
      revBanner.appendChild(el('span', 'rev-value', '$' + opp.estimatedMonthlyRevenueLow + ' - $' + opp.estimatedMonthlyRevenueHigh));
      revBanner.appendChild(el('span', 'rev-sub', '(' + compactNumber(opp.estimatedMonthlyViews) + ' views/mo)'));
      right.appendChild(revBanner);
    }

    right.appendChild(el('div', 'engine-card-copy', opp.why));
    var badges = el('div', 'badge-row');
    (opp.badges || []).forEach(function(badge) {
      var chipClass = badge === 'FIRE' ? 'badge-chip badge-fire' : badge === 'PREMIUM RPM' ? 'badge-chip badge-premium' : badge === 'VIRGIN MARKET' ? 'badge-chip badge-virgin' : 'badge-chip';
      badges.appendChild(el('div', chipClass, badge));
    });
    right.appendChild(badges);

    var metricGrid = el('div', 'metric-grid');
    [
      ['Estimated RPM', rpmLabel(opp.estimatedRpm)],
      ['Estimated CPM', rpmLabel(opp.estimatedCpm || (opp.estimatedRpm * 1.45))],
      ['Monthly Search', compactNumber(opp.estimatedMonthlySearchVolume || opp.estimatedMonthlyViews || 0)],
      ['Demand', opp.demandLabel + ' / ' + opp.demandScore],
      ['Competition', opp.competitionLabel + ' / ' + opp.competitionScore],
      ['Saturation', opp.saturationLabel + ' / ' + opp.saturationScore],
      ['Faceless Score', opp.facelessScore + '/10'],
      ['Repeatability', opp.repeatabilityScore + '/10'],
      ['Velocity', compactNumber(opp.velocity) + '/h'],
      ['Language Gap', opp.languageGapScore + '/10']
    ].forEach(function(pair) {
      var mini = el('div', 'mini-metric');
      mini.appendChild(el('div', 'lbl', pair[0]));
      mini.appendChild(el('div', 'val', pair[1]));
      metricGrid.appendChild(mini);
    });
    right.appendChild(metricGrid);

    right.appendChild(buildOpportunityActionRow(opp, { primaryMasterplan: true, includeRoba: true }));

    if (scopedOpportunities.length > 1) {
      right.appendChild(el('div', 'mono-divider'));
      right.appendChild(el('div', 'engine-kicker', 'More Niches You Can Search'));
      right.appendChild(el('div', 'engine-copy', 'This language is no longer locked to one niche. Pick any of these and search it instantly on YouTube.'));

      var stack = el('div', 'opportunity-stack');
      scopedOpportunities.forEach(function(item) {
        var isFocused = getOpportunityKey(item) === getOpportunityKey(opp);
      var card = el('div', 'stack-item stack-item-link' + (isFocused ? ' active-opportunity-card' : ''));
        card.title = 'Use this niche as the focus';
        bindClickableCard(card, function() { focusOpportunity(item); });

        var headRow = el('div', 'stack-item-head');
        headRow.appendChild(el('div', 'stack-item-title', getOpportunityQuery(item)));
        headRow.appendChild(el('div', 'verdict-chip', verdictLabel(item.verdict)));
        card.appendChild(headRow);
        card.appendChild(el('div', 'stack-item-meta', 'Base ' + item.recommendedNiche + ' | Score ' + item.opportunityScore + '/10 | RPM ' + rpmLabel(item.estimatedRpm) + ' | VPH ' + compactNumber(item.velocity) + '/h | Gap ' + item.languageGapScore + '/10'));

        var badgeRow = el('div', 'badge-row');
        (item.badges || []).slice(0, 4).forEach(function(badge) {
          badgeRow.appendChild(el('div', 'badge-chip', badge));
        });
        card.appendChild(badgeRow);

        var note = el('div', 'muted-copy', item.why);
        note.style.marginTop = '10px';
        card.appendChild(note);

        var rowActions = buildOpportunityActionRow(item, {
          includeMasterplan: false,
          includeRoba: true,
          includeWatch: false,
          includeFocus: true
        });
        rowActions.style.marginTop = '12px';
        card.appendChild(rowActions);
        stack.appendChild(card);
      });
      right.appendChild(stack);
    }
  }

  inner.appendChild(grid);
  return shell;
}

function renderFiltersShell() {
  var shell = el('div', 'engine-shell');
  var inner = el('div', 'engine-inner');
  shell.appendChild(inner);

  var head = el('div', 'engine-head');
  var left = el('div');
  left.appendChild(el('div', 'engine-kicker', 'Smart filters'));
  left.appendChild(el('div', 'engine-title', 'Filter opportunities'));
  left.appendChild(el('div', 'engine-copy', 'Turn on filters to keep only the niches that meet the condition. Survival, for example, shows survival, blackout and prepping opportunities. High RPM keeps only the better paying markets.'));
  head.appendChild(left);
  inner.appendChild(head);

  var row = el('div', 'filter-row');
  var defs = engine && engine.filtersEngine ? engine.filtersEngine.defs : [];
  defs.forEach(function(filterDef) {
    var active = (app.state.filters || []).indexOf(filterDef.id) >= 0;
    var btn = el('button', 'filter-chip' + (active ? ' active' : ''), filterDef.label);
    btn.onclick = function() {
      var filters = (app.state.filters || []).slice();
      var idx = filters.indexOf(filterDef.id);
      if (idx >= 0) filters.splice(idx, 1);
      else filters.push(filterDef.id);
      app.state.filters = filters;
      saveGlobalState();
      computeEngineData();
      render();
    };
    row.appendChild(btn);
  });
  inner.appendChild(row);

  var activeFilters = (app.state.filters || []).slice();
  var summary = el('div', 'stack-item');
  summary.style.marginTop = '14px';
  if (!activeFilters.length) {
    summary.appendChild(el('div', 'stack-item-title', 'No active filters'));
    summary.appendChild(el('div', 'muted-copy', 'The engine is showing the full ranking for the selected language.'));
  } else {
    summary.appendChild(el('div', 'stack-item-title', 'Active filters'));
    activeFilters.forEach(function(filterId) {
      var def = defs.find(function(item) { return item.id === filterId; });
      summary.appendChild(el('div', 'stack-item-meta', (def ? def.label : filterId) + ': ' + (FILTER_HELP[filterId] || 'Refines the current ranking.')));
    });
    var clearBtn = el('button', 'subtle-btn', 'Clear filters');
    clearBtn.style.marginTop = '12px';
    bindActionButton(clearBtn, function() {
      app.state.filters = [];
      saveGlobalState();
      computeEngineData();
      render();
    });
    summary.appendChild(clearBtn);
  }
  inner.appendChild(summary);
  return shell;
}

function renderComparisonShell() {
  var shell = el('div', 'engine-shell');
  var inner = el('div', 'engine-inner');
  shell.appendChild(inner);

  var head = el('div', 'engine-head');
  var left = el('div');
  left.appendChild(el('div', 'engine-kicker', 'Opportunity comparison'));
  left.appendChild(el('div', 'engine-title', (app.state.selectedLanguage || 'auto') !== 'auto' ? ('Top niches in ' + getLanguageLabel(app.state.selectedLanguage)) : 'Diversified global top'));
  left.appendChild(el('div', 'engine-copy', 'Compare several niches, not just one. The table follows the selected language and every row searches the local YouTube for that country.'));
  head.appendChild(left);
  inner.appendChild(head);

  var sortRow = el('div', 'chip-row');
  [
    ['opportunity', 'Best opportunity'],
    ['rpm', 'Highest RPM'],
    ['competition', 'Lowest competition'],
    ['underserved', 'Biggest gap'],
    ['faceless', 'Most faceless'],
    ['growth', 'Fastest']
  ].forEach(function(def) {
    var btn = el('button', 'chip-btn' + (app.comparisonSort === def[0] ? ' active' : ''), def[1]);
    btn.onclick = function() {
      app.comparisonSort = def[0];
      renderEngine();
    };
    sortRow.appendChild(btn);
  });
  inner.appendChild(sortRow);

  var rows = buildComparisonRows();
  if (!rows.length) {
    inner.appendChild(el('div', 'language-empty', 'No comparison rows yet. Save more localized opportunities and ASHLYV will build a richer language matrix.'));
    return shell;
  }

  var table = el('table', 'comparison-table');
  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  ['Local niche', 'Score', 'RPM', 'Competition', 'Gap', 'Action'].forEach(function(label) {
    headRow.appendChild(el('th', '', label));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  var tbody = document.createElement('tbody');
  rows.forEach(function(row) {
    var tr = document.createElement('tr');
    [
      row.languageLabel + ' - ' + getOpportunityQuery(row),
      row.opportunityScore + '/10',
      rpmLabel(row.estimatedRpm),
      row.competitionLabel,
      row.languageGapScore + '/10'
    ].forEach(function(value) {
      tr.appendChild(el('td', '', value));
    });
    var actionCell = document.createElement('td');
    var btn = el('button', 'subtle-btn', 'Search');
    btn.style.minWidth = '92px';
    btn.style.height = '34px';
    bindActionButton(btn, function() { searchOpportunityOnYouTube(row); });
    actionCell.appendChild(btn);
    tr.appendChild(actionCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  inner.appendChild(table);
  return shell;
}

function renderDemandShell() {
  var shell = el('div', 'engine-shell');
  var inner = el('div', 'engine-inner');
  shell.appendChild(inner);

  var head = el('div', 'engine-head');
  var left = el('div');
  left.appendChild(el('div', 'engine-kicker', 'Demand by Country / Region'));
  left.appendChild(el('div', 'engine-title', app.selectedOpportunity ? app.selectedOpportunity.languageLabel + ' Demand Map' : 'Regional Demand'));
  left.appendChild(el('div', 'engine-copy', 'Heuristic region scoring keeps the engine tactical even when exact market APIs are unavailable.'));
  head.appendChild(left);
  inner.appendChild(head);

  var list = el('div', 'stack-list');
  var regions = app.selectedOpportunity ? (app.selectedOpportunity.regions || []) : [];
  if (!regions.length) {
    list.appendChild(el('div', 'language-empty', 'Select a language opportunity to see the best targeting regions and diaspora angles.'));
  } else {
    regions.forEach(function(region) {
      var card = el('div', 'stack-item');
      var cardHead = el('div', 'stack-item-head');
      cardHead.appendChild(el('div', 'stack-item-title', region.label));
      cardHead.appendChild(el('div', 'ghost-chip', region.demand));
      card.appendChild(cardHead);
      card.appendChild(el('div', 'stack-item-meta', 'Monetization ' + region.monetization + ' | Fit ' + region.nicheFit));
      card.appendChild(el('div', 'muted-copy', region.diaspora));
      list.appendChild(card);
    });
  }
  inner.appendChild(list);
  return shell;
}

function renderRadarShell() {
  var shell = el('div', 'engine-shell');
  var inner = el('div', 'engine-inner');
  shell.appendChild(inner);

  var grid = el('div', 'engine-grid-2');
  var left = el('div', 'engine-card');
  var right = el('div', 'engine-card');
  grid.appendChild(left);
  grid.appendChild(right);
  inner.appendChild(grid);

  left.appendChild(el('div', 'engine-kicker', (app.state.selectedLanguage || 'auto') !== 'auto' ? ('Gaps in ' + getLanguageLabel(app.state.selectedLanguage)) : 'Top Underserved Languages'));
  left.appendChild(el('div', 'engine-title', 'Language Gap Radar'));
  var radarBase = (app.state.selectedLanguage || 'auto') !== 'auto'
    ? (app.opportunities || [])
    : (app.allOpportunities || []);
  var underserved = engine && engine.nicheScoring
    ? diversifyOpportunityList(engine.nicheScoring.buildTopUnderserved(radarBase), 6)
    : [];
  if (!underserved.length) {
    left.appendChild(el('div', 'language-empty', 'No gap radar yet.'));
  } else {
    var list = el('div', 'stack-list');
    underserved.slice(0, 6).forEach(function(item) {
      var card = el('div', 'stack-item stack-item-link');
      card.title = 'Open niche on YouTube';
      bindClickableCard(card, function() { searchOpportunityOnYouTube(item); });
      card.appendChild(el('div', 'stack-item-title', item.languageLabel + ' - ' + getOpportunityQuery(item)));
      card.appendChild(el('div', 'stack-item-meta', 'Gap ' + item.languageGapScore + '/10 | Score ' + item.opportunityScore + '/10 | RPM ' + rpmLabel(item.estimatedRpm)));
      card.appendChild(el('div', 'muted-copy', item.comparisonNote));
      var actions = el('div', 'subtle-actions');
      actions.style.marginTop = '12px';
      var ytBtn = el('button', 'subtle-btn', 'View niche on YouTube');
      ytBtn.onclick = function(ev) {
        ev.stopPropagation();
        searchOpportunityOnYouTube(item);
      };
      actions.appendChild(ytBtn);
      card.appendChild(actions);
      list.appendChild(card);
    });
    left.appendChild(list);
  }

  right.appendChild(el('div', 'engine-kicker', 'Niche Velocity Monitor'));
  right.appendChild(el('div', 'engine-title', 'Fastest Signals'));
  var velocity = engine && engine.nicheScoring ? engine.nicheScoring.buildVelocityMonitor(app.mergedEntries, app.state.selectedLanguage === 'auto' ? null : app.state.selectedLanguage) : [];
  var watchKeys = {};
  (app.state.watchlist || []).forEach(function(key) { watchKeys[key] = true; });
  var signalRows = (velocity || []).map(function(item) {
    return {
      title: item.title,
      languageCode: item.languageCode,
      languageLabel: item.languageLabel,
      nicheLabel: item.nicheLabel,
      vph: item.vph,
      os: item.os,
      source: 'saved'
    };
  });
  (app.alertHistory || []).slice(0, 4).forEach(function(alert) {
    signalRows.push({
      title: alert.title || alert.recommendedNiche || 'Opportunity alert',
      languageCode: alert.languageCode || app.state.selectedLanguage,
      languageLabel: getLanguageLabel(alert.languageCode),
      nicheLabel: alert.nicheId || 'alert',
      vph: alert.opportunityScore ? Math.round(alert.opportunityScore * 45) : 0,
      os: Math.round((alert.opportunityScore || 0) * 10),
      source: 'alert'
    });
  });
  var signalBase = (app.state.selectedLanguage || 'auto') !== 'auto'
    ? (app.opportunities || [])
    : (app.opportunities || []).concat(app.allOpportunities || []);
  diversifyOpportunityList(signalBase, 8).forEach(function(item) {
    if (signalRows.length >= 8) return;
    var watched = !!watchKeys[getOpportunityKey(item)];
    signalRows.push({
      title: getOpportunityQuery(item),
      languageCode: item.languageCode,
      languageLabel: item.languageLabel,
      nicheLabel: item.recommendedNiche,
      vph: item.velocity,
      os: Math.round(item.opportunityScore * 10),
      source: watched ? 'watchlist' : 'engine'
    });
  });
  signalRows.sort(function(a, b) {
    return (toNumber(b.vph) - toNumber(a.vph)) || (toNumber(b.os) - toNumber(a.os));
  });
  if (!signalRows.length) {
    right.appendChild(el('div', 'language-empty', 'No saved velocity signals yet.'));
  } else {
    var velList = el('div', 'stack-list');
    signalRows.slice(0, 6).forEach(function(item) {
      var card = el('button', 'stack-item stack-item-link');
      card.type = 'button';
      card.title = 'Open signal on YouTube';
      card.onclick = function() { searchTextOnYouTube(item.title || item.nicheLabel, item.languageCode); };
      card.appendChild(el('div', 'stack-item-title', item.title));
      card.appendChild(el('div', 'stack-item-meta', item.languageLabel + ' | ' + item.nicheLabel + ' | ' + compactNumber(item.vph) + '/h | OS ' + item.os + ' | ' + item.source));
      velList.appendChild(card);
    });
    right.appendChild(velList);
  }
  return shell;
}

function renderAlertShell() {
  var shell = el('div', 'engine-shell');
  shell.id = 'engine-alert-history';
  var inner = el('div', 'engine-inner');
  shell.appendChild(inner);

  inner.appendChild(el('div', 'engine-kicker', 'Live Alert History'));
  inner.appendChild(el('div', 'engine-title', 'Recent Opportunity Alerts'));
  inner.appendChild(el('div', 'engine-copy', 'These alerts were generated while browsing YouTube. Success, opportunity, watchlist and warning states all stay persisted here.'));

  var list = el('div', 'alert-list');
  if (!app.alertHistory.length) {
    list.appendChild(el('div', 'language-empty', 'No live alerts yet. Once the overlay detects a strong niche while you browse, it will land here.'));
  } else {
    app.alertHistory.slice(0, 8).forEach(function(alert) {
      var card = el('button', 'alert-card stack-item-link');
      card.type = 'button';
      card.title = 'Open alert on YouTube';
      card.onclick = function() { searchTextOnYouTube(alert.title || alert.recommendedNiche || '', alert.languageCode); };
      card.appendChild(el('div', 'engine-card-title', String(alert.type || 'opportunity').toUpperCase()));
      card.appendChild(el('div', 'stack-item-title', alert.title || 'New niche detected'));
      card.appendChild(el('div', 'stack-item-meta', getLanguageLabel(alert.languageCode) + ' | ' + relTime(alert.createdAt)));
      card.appendChild(el('div', 'muted-copy', alert.message || 'Opportunity snapshot saved by the live engine.'));
      list.appendChild(card);
    });
  }
  inner.appendChild(list);
  return shell;
}

function renderSavedByLanguageShell() {
  var shell = el('div', 'engine-shell');
  var inner = el('div', 'engine-inner');
  shell.appendChild(inner);

  inner.appendChild(el('div', 'engine-kicker', 'Saved Opportunities Grouped by Language'));
  inner.appendChild(el('div', 'engine-title', 'Archive by Language'));
  inner.appendChild(el('div', 'engine-copy', 'Saved niches, channels and global opportunities grouped by language so you can see where the archive is getting crowded or where the monthly pool is still thin.'));

  var cards = el('div', 'saved-language-grid');
  var savedGroups = engine && engine.nicheScoring ? engine.nicheScoring.buildSavedByLanguage(app.mergedEntries) : [];
  if (!savedGroups.length) {
    cards.appendChild(el('div', 'language-empty', 'No saved language groups yet.'));
  } else {
    savedGroups.slice(0, 8).forEach(function(group) {
      var card = el('button', 'saved-language-card stack-item-link');
      card.type = 'button';
      card.title = 'Open saved language on YouTube';
      card.onclick = function() { searchSavedGroupOnYouTube(group); };
      card.appendChild(el('div', 'engine-card-title', group.label));
      card.appendChild(el('div', 'engine-card-value', String(group.total)));
      card.appendChild(el('div', 'engine-card-copy', 'Pool ' + moneyLabel(group.monthlyPool) + ' | Avg RPM ' + rpmLabel(group.avgRpm)));
      var items = el('div', 'stack-item-meta', group.items.slice(0, 2).map(function(item) { return item.title; }).join(' | '));
      card.appendChild(items);
      cards.appendChild(card);
    });
  }
  inner.appendChild(cards);

  var divider = el('div', 'mono-divider');
  inner.appendChild(divider);
  inner.appendChild(el('div', 'engine-kicker', 'Top Niches by Language'));
  var topByLanguage = {};
  (app.allOpportunities || []).forEach(function(item) {
    if (!item || !item.languageCode || topByLanguage[item.languageCode]) return;
    topByLanguage[item.languageCode] = item;
  });
  var topList = el('div', 'stack-list');
  Object.keys(topByLanguage).slice(0, 6).forEach(function(code) {
    var item = topByLanguage[code];
    var card = el('button', 'stack-item stack-item-link');
    card.type = 'button';
    card.title = 'Open top niche on YouTube';
    card.onclick = function() { searchOpportunityOnYouTube(item); };
    card.appendChild(el('div', 'stack-item-title', item.languageLabel + ' - ' + item.recommendedNiche));
    card.appendChild(el('div', 'stack-item-meta', 'Score ' + item.opportunityScore + '/10 | RPM ' + rpmLabel(item.estimatedRpm) + ' | ' + verdictLabel(item.verdict)));
    topList.appendChild(card);
  });
  inner.appendChild(topList);
  return shell;
}

function renderEngine() {
  var root = document.getElementById('engine-root');
  if (!root) return;
  root.innerHTML = '';
  root.appendChild(renderLanguageSelectorShell());
  root.appendChild(renderFiltersShell());

  var pairShell = el('div', 'engine-grid-2');
  pairShell.appendChild(renderComparisonShell());
  pairShell.appendChild(renderDemandShell());
  root.appendChild(pairShell);

  root.appendChild(renderRadarShell());

  var lowerPair = el('div', 'engine-grid-2');
  lowerPair.appendChild(renderAlertShell());
  lowerPair.appendChild(renderSavedByLanguageShell());
  root.appendChild(lowerPair);
}

function metricNode(text, cls) {
  var node = document.createElement('span');
  node.className = 'metric ' + cls;
  node.textContent = text;
  return node;
}

function metaChip(text) {
  var node = document.createElement('span');
  node.className = 'meta-chip';
  node.textContent = text;
  return node;
}

function renderEmptyState(content) {
  content.innerHTML = '';
  var empty = document.createElement('div');
  empty.className = 'empty';
  empty.innerHTML =
    '<div class="empty-bat"><svg viewBox="0 0 100 60" fill="#fff"><path d="M50 15 C45 5 30 2 18 8 C10 12 4 20 2 28 C8 24 16 22 22 26 C18 30 16 36 18 42 C22 36 28 32 34 33 C36 38 40 44 44 48 C46 44 48 38 50 35 C52 38 54 44 56 48 C60 44 64 38 66 33 C72 32 78 36 82 42 C84 36 82 30 78 26 C84 22 92 24 98 28 C96 20 90 12 82 8 C70 2 55 5 50 15 Z"/></svg></div>' +
    '<div class="empty-title">Nothing saved yet</div>' +
    '<div class="empty-sub">Open YouTube, save channels or niches, and the full archive shows up here next to the global language engine.</div>';
  content.appendChild(empty);
}

function calculateGrade(entry) {
  var score = 0;
  if ((entry.rpm || 0) > 10) score += 40; else if ((entry.rpm || 0) > 5) score += 20;
  if ((entry.os || 0) > 70) score += 30; else if ((entry.os || 0) > 40) score += 15;
  if ((entry.vph || 0) > 500) score += 30; else if ((entry.vph || 0) > 50) score += 15;
  if ((entry.revMonth || 0) > 2000) score += 15; else if ((entry.revMonth || 0) > 500) score += 8;
  if (score >= 95) return 'S';
  if (score >= 72) return 'A';
  if (score >= 50) return 'B';
  return 'C';
}

function getMonetizationMethods(niche) {
  var n = String(niche || '').toLowerCase();
  if (n.indexOf('finance') !== -1 || n.indexOf('crypto') !== -1 || n.indexOf('finanzas') !== -1) return ['AdSense Premium', 'Broker affiliates', 'Digital products'];
  if (n.indexOf('history') !== -1 || n.indexOf('historia') !== -1 || n.indexOf('science') !== -1 || n.indexOf('ciencia') !== -1) return ['Educational AdSense', 'App sponsorships', 'Memberships'];
  if (n.indexOf('health') !== -1 || n.indexOf('fitness') !== -1 || n.indexOf('salud') !== -1) return ['Health AdSense', 'Affiliates', 'Info products'];
  if (n.indexOf('survival') !== -1 || n.indexOf('hogar') !== -1 || n.indexOf('hvac') !== -1) return ['AdSense', 'Tool affiliates', 'Direct sponsors'];
  return ['Google AdSense', 'Amazon affiliates', 'Direct sponsors'];
}

function buildBlueprintPrompt(entry) {
  var grade = calculateGrade(entry);
  var methods = getMonetizationMethods(entry.niche).join(', ');
  return [
    'You are a senior faceless YouTube strategist.',
    'Build a tactical plan from this ASHLYV saved opportunity.',
    '',
    'DATA',
    '- Language: ' + getLanguageLabel(entry.language),
    '- Niche: ' + (entry.niche || 'General'),
    '- Title: ' + (entry.title || 'N/A'),
    '- Grade: ' + grade,
    '- RPM: ' + rpmLabel(entry.rpm),
    '- VPH: ' + compactNumber(entry.vph) + '/h',
    '- OS: ' + (entry.os || 0),
    '- Estimated monthly visible: ' + moneyLabel(entry.revMonth),
    '- Total visible: ' + moneyLabel(entry.totalRev),
    '- Suggested monetization: ' + methods,
    '',
    'Give me positioning, 30-day content system, title angles, thumbnail language, monetization stack, workflow and execution risks.'
  ].join('\n');
}

function fillBlueprintPreview(entry, prompt) {
  var methods = getMonetizationMethods(entry.niche);
  var grade = calculateGrade(entry);
  var list = document.getElementById('bp-monetization-list');
  list.innerHTML = '';
  methods.forEach(function(method) {
    var li = document.createElement('li');
    li.className = 'bp-monetization-item';
    li.textContent = method;
    list.appendChild(li);
  });
  document.getElementById('bp-grade').textContent = grade;
  document.getElementById('bp-potential-txt').textContent = 'Estimated monthly revenue: ' + moneyLabel(entry.revMonth) + ' / month';
  document.getElementById('bp-hook').textContent = 'Suggested hook: open with the strongest promise in "' + (entry.title || 'reference') + '" and a direct consequence for the viewer.';
  document.getElementById('bp-strategy').textContent = prompt;
  currentBlueprintPrompt = prompt;
}

function openBlueprint(entry) {
  var prompt = buildBlueprintPrompt(entry);
  fillBlueprintPreview(entry, prompt);
  document.getElementById('bp-modal').style.display = 'flex';
}

function renderArchive() {
  var content = document.getElementById('main-content');
  var count = document.getElementById('section-count');

  if (!app.mergedEntries.length) {
    renderEmptyState(content);
    count.textContent = '0 saved';
    return;
  }

  count.textContent = app.mergedEntries.length + ' saved';
  var grid = document.createElement('div');
  grid.className = 'nicho-grid';

  app.mergedEntries.forEach(function(entry, idx) {
    var card = document.createElement('div');
    var tierKey = (entry.tier || '').toUpperCase();
    var isViral = tierKey === 'VIRAL';
    var isHot = tierKey === 'HOT';
    var isOutlier = (entry.views > (entry.subs * 5) && entry.subs > 0) || (!entry.subs && entry.views > 100000);
    card.className = 'nicho-card ' + (isViral ? 'viral ' : isHot ? 'hot ' : '') + (isOutlier ? 'outlier' : '');

    if (entry.thumbUrl) {
      var thumbArea = document.createElement('div');
      thumbArea.className = 'card-thumb-area';
      var img = document.createElement('img');
      img.src = entry.thumbUrl;
      img.className = 'vid-thumb';
      thumbArea.appendChild(img);
      thumbArea.onclick = function(e) {
        e.stopPropagation();
        if (entry.vidId) {
          window.open('https://www.youtube.com/watch?v=' + encodeURIComponent(entry.vidId), '_blank');
          return;
        }
        if (entry.channelUrl) window.open(entry.channelUrl, '_blank');
      };
      card.appendChild(thumbArea);
    }

    var topRow = document.createElement('div');
    topRow.className = 'card-top';
    topRow.appendChild(el('div', 'card-rank', '#' + (idx + 1)));
    var tier = el('div', 'card-tier ' + (isViral ? 'tier-viral' : isHot ? 'tier-hot' : 'tier-other'), tierKey || (isChannelEntry(entry) ? 'CHANNEL' : 'N/A'));
    topRow.appendChild(tier);
    card.appendChild(topRow);

    card.appendChild(el('div', 'card-title', entry.title || 'Untitled'));
    card.appendChild(el('div', 'card-niche', entry.niche || 'General'));

    var meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.appendChild(metaChip(getLanguageLabel(entry.language).toUpperCase()));
    meta.appendChild(metaChip(isChannelEntry(entry) ? 'SAVED CHANNEL' : 'SAVED NICHE'));
    if (entry.subs > 0) meta.appendChild(metaChip(compactNumber(entry.subs) + ' SUBS'));
    meta.appendChild(metaChip(savedDateLabel(entry.savedAt)));
    card.appendChild(meta);

    var metrics = document.createElement('div');
    metrics.className = 'card-metrics';
    metrics.appendChild(metricNode(entry.revMonth > 0 ? 'MONTH ' + moneyLabel(entry.revMonth) : 'MONTH N/A', 'm-month'));
    metrics.appendChild(metricNode('VPH ' + compactNumber(entry.vph) + '/H', 'm-vph'));
    metrics.appendChild(metricNode(entry.totalRev > 0 ? 'TOTAL ' + moneyLabel(entry.totalRev) : 'TOTAL N/A', 'm-rev'));
    metrics.appendChild(metricNode('RPM ' + rpmLabel(entry.rpm), 'm-rpm'));
    metrics.appendChild(metricNode('OS ' + (entry.os || 0), 'm-os'));
    card.appendChild(metrics);

    var gradeBadge = el('div', 'card-grade-badge', 'GRADE ' + calculateGrade(entry));
    card.appendChild(gradeBadge);

    var actions = document.createElement('div');
    actions.className = 'card-actions';

    var masterBtn = el('button', 'card-btn primary', 'THUMB LAB');
    masterBtn.title = 'Study the winning thumbnails in the niche and generate your own';
    masterBtn.onclick = function(e) {
      e.stopPropagation();
      try {
        var nicheTxt = (entry.niche && String(entry.niche).toLowerCase() !== 'general') ? entry.niche : '';
        var query = entry.title || nicheTxt || entry.name || '';
        var L = String(entry.language || '').toLowerCase();
        var market = /span|mex|spain|^es$/.test(L) ? 'ES|es' : /port|bras|^pt$/.test(L) ? 'BR|pt' : /germ|^de$/.test(L) ? 'DE|de' : /fren|^fr$/.test(L) ? 'FR|fr' : 'US|en';
        var payload = { query: query, niche: entry.niche || '', title: entry.title || '', market: market };
        try { localStorage.setItem('zerack_thumblab', JSON.stringify(payload)); } catch (e2) {}
        location.href = chrome.runtime.getURL('ashlyv/tools/thumblab.html');
      } catch (err) {}
    };
    actions.appendChild(masterBtn);

    var langBtn = el('button', 'card-btn mini', 'LANG');
    langBtn.title = 'Translate';
    langBtn.onclick = function(e) {
      e.stopPropagation();
      openTransModal(entry.title || entry.niche || '');
    };
    actions.appendChild(langBtn);

    var deleteBtn = el('button', 'card-btn del', 'X');
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = function(e) {
      e.stopPropagation();
      removeSavedEntry(entry);
      app.mergedEntries = mergeDashboardEntries(app.savedNichos, app.savedChannels);
      computeEngineData();
      render();
    };
    actions.appendChild(deleteBtn);

    card.appendChild(actions);
    grid.appendChild(card);
  });

  content.innerHTML = '';
  content.appendChild(grid);
}

function saveNichos() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({
      ashlyv_nichos: app.savedNichos,
      ashlyv_nichos_backup: app.savedNichos
    });
  }
}

function removeSavedEntry(entry) {
  var matchKey = String(entry.channelId || entry.channelUrl || entry.vidId || entry.savedAt || entry.title || '');
  app.savedNichos = (app.savedNichos || []).filter(function(item) {
    var raw = normalizeNichoEntry(item);
    var key = String(raw.channelId || raw.channelUrl || raw.vidId || raw.savedAt || raw.title || '');
    return key !== matchKey;
  });
  app.savedChannels = (app.savedChannels || []).filter(function(item) {
    var key = String(item.channelId || item.channelUrl || item.savedAt || item.name || '');
    return key !== matchKey;
  });
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({
      ashlyv_nichos: app.savedNichos,
      ashlyv_nichos_backup: app.savedNichos,
      nsp_all_channels: app.savedChannels
    });
  }
}

function clearAll() {
  if (!chrome || !chrome.storage) return;
  app.savedNichos = [];
  app.savedChannels = [];
  chrome.storage.local.set({ ashlyv_nichos: [], ashlyv_nichos_backup: [], nsp_all_channels: [] }, function() {
    app.mergedEntries = mergeDashboardEntries(app.savedNichos, app.savedChannels);
    computeEngineData();
    render();
  });
}

function openTransModal(title) {
  document.getElementById('trans-original').textContent = title || '-';
  document.getElementById('trans-result').textContent = 'Pick a language and translate.';
  currentTranslated = '';

  var sel = document.getElementById('lang-select');
  sel.innerHTML = '';
  getLanguageList().filter(function(language) { return language.code !== 'auto'; }).forEach(function(language) {
    var opt = document.createElement('option');
    opt.value = language.code;
    opt.textContent = language.label;
    if (language.code === targetLang) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = function() { targetLang = this.value; };
  document.getElementById('trans-modal').style.display = 'flex';
}

function doTranslate() {
  var title = document.getElementById('trans-original').textContent;
  var resultEl = document.getElementById('trans-result');
  resultEl.textContent = 'Translating';
  fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(targetLang) + '&dt=t&q=' + encodeURIComponent(title))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var translated = '';
      if (data && data[0]) {
        data[0].forEach(function(chunk) {
          if (chunk && chunk[0]) translated += chunk[0];
        });
      }
      currentTranslated = translated || title;
      resultEl.textContent = getLanguageLabel(targetLang) + ': ' + currentTranslated;
    })
    .catch(function() {
      resultEl.textContent = 'Could not translate';
    });
}

function closeTransModal() {
  document.getElementById('trans-modal').style.display = 'none';
}

function searchTranslated() {
  if (currentTranslated) {
    openYouTubeSearch(currentTranslated, targetLang);
    closeTransModal();
    return;
  }
  doTranslate();
}

function copyTranslated() {
  if (!currentTranslated) return;
  try { navigator.clipboard.writeText(currentTranslated); } catch (e) {}
  var btn = document.getElementById('btn-trans-copy');
  btn.textContent = 'COPIED';
  setTimeout(function() { btn.textContent = 'Copy'; }, 1400);
}

function copyBlueprintPrompt() {
  if (!currentBlueprintPrompt) return;
  try { navigator.clipboard.writeText(currentBlueprintPrompt); } catch (e) {}
  var btn = document.getElementById('bp-btn-copy');
  btn.textContent = 'COPIED';
  setTimeout(function() { btn.textContent = 'Copy strategy'; }, 1400);
}

function openBlueprintInChatGPT() {
  if (!currentBlueprintPrompt) return;
  window.open('https://chatgpt.com/?q=' + encodeURIComponent(currentBlueprintPrompt), '_blank');
}

function normalizeAshlyVToolPageUrl(toolUrl) {
  var clean = String(toolUrl || '').trim();
  if (!clean) return '';
  if (/^(https?:|chrome-extension:)/i.test(clean)) return clean;
  clean = clean.replace(/^\/+/, '');
  if (clean.indexOf('tools/') === 0) clean = 'ashlyv/' + clean;
  return clean;
}

function _openToolTab(url) {
  try { if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) { chrome.tabs.create({ url: url }); return; } } catch (e) {}
  try { window.open(url, '_blank', 'noopener'); return; } catch (e) {}
  window.location.href = url;
}

// Checks the file exists first: many tools are not built yet, and Chrome's own
// "file not found" page is worse than showing a coming-soon panel.
function openAshlyVToolPage(toolUrl) {
  var clean = normalizeAshlyVToolPageUrl(toolUrl);
  if (!clean) return;
  closeToolsModal();
  if (/^https?:/i.test(clean)) { _openToolTab(clean); return; }
  var full = clean;
  try { if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL && !/^chrome-extension:/i.test(clean)) full = chrome.runtime.getURL(clean); } catch (e) {}
  try {
    fetch(full, { method: 'GET' }).then(function (r) {
      if (r && r.ok) _openToolTab(full);
      else showAshlyVToolComingSoon(toolUrl);
    }).catch(function () { showAshlyVToolComingSoon(toolUrl); });
  } catch (e) { showAshlyVToolComingSoon(toolUrl); }
}

function showAshlyVToolComingSoon(toolUrl) {
  var prev = document.getElementById('nsp-tool-soon'); if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
  var ov = document.createElement('div');
  ov.id = 'nsp-tool-soon';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;';
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.parentNode.removeChild(ov); });
  var box = document.createElement('div');
  box.style.cssText = 'width:min(440px,92vw);background:#0d1014;border:1px solid rgba(255,255,255,0.18);border-radius:16px;padding:26px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.6);';
  var ic = document.createElement('div'); ic.textContent = '🚧'; ic.style.cssText = 'font-size:40px;margin-bottom:10px;';
  var t = document.createElement('div'); t.textContent = 'Could not open that tool'; t.style.cssText = 'font-size:16px;font-weight:900;color:#00DC82;margin-bottom:9px;';
  var d = document.createElement('div'); d.textContent = 'If you just updated, reload the extension in chrome://extensions and try again.'; d.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.62);line-height:1.55;margin-bottom:16px;';
  var c = document.createElement('button'); c.textContent = 'Close'; c.style.cssText = 'display:block;margin:12px auto 0;background:transparent;border:none;color:rgba(255,255,255,0.4);font-size:11px;cursor:pointer;font-family:inherit;';
  c.addEventListener('click', function () { if (ov.parentNode) ov.parentNode.removeChild(ov); });
  box.appendChild(ic); box.appendChild(t); box.appendChild(d); box.appendChild(c);
  ov.appendChild(box); document.documentElement.appendChild(ov);
}

function openVoxBatchTool() {
  openAshlyVToolPage('tools/voxforge.html');
}

function openExtensionOptions() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }
  } catch (e) {}
  try {
    window.open('options/options.html', '_blank');
  } catch (e2) {}
}

function closeAshlyVToolWorkspace() {
  var existing = document.getElementById('ashlyv-tool-workspace-modal');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

function buildAshlyVToolUrl(route) {
  var cleanRoute = String(route || '/nichemaster-os').trim();
  if (cleanRoute.charAt(0) !== '/') cleanRoute = '/' + cleanRoute;
  var base = '';
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      base = chrome.runtime.getURL('ashlyv/ashlyv.html');
    }
  } catch (e) {}
  if (!base) {
    base = 'ashlyv.html';
  }
  return base + '?tool=' + encodeURIComponent(cleanRoute);
}

function getAshlyVBaseDashboardUrl() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL('ashlyv/ashlyv.html');
    }
  } catch (e) {}
  return 'ashlyv.html';
}

function getAshlyVToolData() {
  var nichos = Array.isArray(app.savedNichos) ? app.savedNichos.slice() : [];
  var channels = Array.isArray(app.savedChannels) ? app.savedChannels.slice() : [];
  return { nichos: nichos, channels: channels };
}

function buildAshlyVKeywordStats(items) {
  var counts = Object.create(null);
  (items || []).forEach(function(item) {
    var title = String(item && item.title || '').toLowerCase().replace(/[^a-z0-9áéíóúñü\s]/gi, ' ');
    title.split(/\s+/).forEach(function(word) {
      if (!word || word.length < 4) return;
      if (/^(como|para|with|that|this|from|your|sobre|entre|porque|where|when|into|then|than|este|esta|estos|estas|also|just|have|were|been|seria|hacer|hacia|desde|after|before)$/i.test(word)) return;
      counts[word] = (counts[word] || 0) + 1;
    });
  });
  return Object.keys(counts).map(function(word) {
    return { word: word, count: counts[word] };
  }).sort(function(a, b) { return b.count - a.count; }).slice(0, 12);
}

function buildAshlyVToolModal(route, options) {
  options = options || {};
  route = String(route || '/nichemaster-os').trim();
  if (route.charAt(0) !== '/') route = '/' + route;
  if (route === '/voxbatch-pro') {
    openAshlyVToolPage('tools/voxforge.html');
    return document.createElement('div');
  }
  closeAshlyVToolWorkspace();
  var data = getAshlyVToolData();
  var nichos = data.nichos;
  var channels = data.channels;
  var overlay = document.createElement('div');
  overlay.id = 'ashlyv-tool-workspace-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
  var box = document.createElement('div');
  box.style.cssText = 'width:min(1080px,96vw);max-height:90vh;overflow:auto;background:#060606;border:1px solid rgba(255,255,255,.16);border-radius:28px;box-shadow:0 24px 80px rgba(0,0,0,.72);color:#fff;font-family:ui-monospace,monospace;';
  if (options.asPage) {
    overlay.style.alignItems = 'stretch';
    overlay.style.justifyContent = 'stretch';
    overlay.style.padding = '0';
    overlay.style.background = '#030303';
    box.style.width = '100vw';
    box.style.maxHeight = '100vh';
    box.style.height = '100vh';
    box.style.borderRadius = '0';
    box.style.border = 'none';
  }
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.08);';
  var left = document.createElement('div');
  var title = document.createElement('div');
  var subtitle = document.createElement('div');
  title.style.cssText = 'font-size:32px;font-weight:900;letter-spacing:.04em;';
  subtitle.style.cssText = 'margin-top:8px;font-size:13px;line-height:1.7;color:rgba(255,255,255,.68);max-width:780px;';
  left.appendChild(title);
  left.appendChild(subtitle);
  var close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'X';
  close.style.cssText = 'width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:#111;color:#fff;font-size:22px;font-weight:900;cursor:pointer;';
  close.onclick = function() {
    if (options.asPage) {
      try {
        window.location.href = getAshlyVBaseDashboardUrl();
        return;
      } catch (e) {}
    }
    closeAshlyVToolWorkspace();
  };
  hdr.appendChild(left);
  hdr.appendChild(close);
  box.appendChild(hdr);
  var body = document.createElement('div');
  body.style.cssText = 'padding:22px 24px 28px;';
  box.appendChild(body);
  overlay.appendChild(box);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeAshlyVToolWorkspace();
  });
  document.body.appendChild(overlay);

  function cardGrid() {
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:18px;';
    body.appendChild(grid);
    return grid;
  }
  function statCard(grid, label, value, sub) {
    var card = document.createElement('div');
    card.style.cssText = 'padding:18px;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);';
    card.appendChild(el('div', '', label));
    card.lastChild.style.cssText = 'font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);';
    card.appendChild(el('div', '', value));
    card.lastChild.style.cssText = 'font-size:28px;font-weight:900;margin-top:10px;';
    if (sub) {
      card.appendChild(el('div', '', sub));
      card.lastChild.style.cssText = 'font-size:12px;line-height:1.6;color:rgba(255,255,255,.62);margin-top:8px;';
    }
    grid.appendChild(card);
  }
  function toolButton(label, onClick, solid) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = 'padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,' + (solid ? '.24' : '.14') + ');background:' + (solid ? '#141414' : '#0b0b0b') + ';color:#fff;font-family:ui-monospace,monospace;font-size:10px;font-weight:900;letter-spacing:.08em;cursor:pointer;white-space:nowrap;';
    btn.onclick = onClick;
    return btn;
  }
  function actionBar(buttonDefs) {
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;';
    (buttonDefs || []).forEach(function(def, index) {
      if (!def || typeof def.onClick !== 'function') return;
      bar.appendChild(toolButton(def.label || 'ACTION', def.onClick, index === 0 || !!def.primary));
    });
    if (bar.childNodes.length) body.appendChild(bar);
  }
  function fallbackCopy(text, message) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    showAshlyVToast(message || 'Copied', 'success', 1800);
  }
  function copyToolText(text, message) {
    text = String(text || '').trim();
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          showAshlyVToast(message || 'Copied', 'success', 1800);
        }).catch(function() {
          fallbackCopy(text, message);
        });
      } else {
        fallbackCopy(text, message);
      }
    } catch (e) {
      fallbackCopy(text, message);
    }
  }
  function searchNicheTerm(text, languageCode) {
    closeAshlyVToolWorkspace();
    openYouTubeSearch(text, languageCode || 'es');
  }
  function openChannelTarget(channel) {
    if (!channel) return;
    var url = channel.channelUrl || '';
    if (url) {
      try { window.open(url, '_blank', 'noopener'); } catch (e) {}
      return;
    }
    searchNicheTerm(channel.name || channel.channelName || '', 'es');
  }
  function collectTopTitles(list, limit) {
    return (list || []).slice(0, limit || 5).map(function(item, index) {
      return (index + 1) + '. ' + String(item.title || item.niche || item.name || item.channelName || 'Untitled');
    }).join('\n');
  }
  function section(titleText, rows) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:18px;padding:18px;border-radius:22px;border:1px solid rgba(255,255,255,.10);background:#090909;';
    wrap.appendChild(el('div', '', titleText));
    wrap.lastChild.style.cssText = 'font-size:14px;font-weight:900;letter-spacing:.12em;margin-bottom:12px;';
    if (!rows || !rows.length) {
      wrap.appendChild(el('div', '', 'Not enough data yet. Save more niches and channels to feed this tool.'));
      wrap.lastChild.style.cssText = 'font-size:13px;line-height:1.7;color:rgba(255,255,255,.62);';
    } else {
      rows.forEach(function(row) {
        var item = document.createElement('div');
        item.style.cssText = 'display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:12px 0;border-top:1px solid rgba(255,255,255,.06);';
        var copy = document.createElement('div');
        copy.style.cssText = 'min-width:0;flex:1;';
        copy.appendChild(el('div', '', row.title));
        copy.lastChild.style.cssText = 'font-size:15px;font-weight:800;';
        if (row.meta) {
          copy.appendChild(el('div', '', row.meta));
          copy.lastChild.style.cssText = 'font-size:12px;color:rgba(255,255,255,.62);margin-top:6px;line-height:1.6;';
        }
        item.appendChild(copy);
        if (row.action || row.secondaryAction) {
          var actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;';
          if (row.secondaryAction) actions.appendChild(toolButton(row.secondaryLabel || 'COPY', row.secondaryAction));
          if (row.action) actions.appendChild(toolButton(row.actionLabel || 'OPEN', row.action, true));
          item.appendChild(actions);
        }
        wrap.appendChild(item);
      });
    }
    body.appendChild(wrap);
  }
  function buildRevenueInput() {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:18px;padding:18px;border-radius:22px;border:1px solid rgba(255,255,255,.10);background:#090909;';
    wrap.appendChild(el('div', '', 'QUICK SIMULATOR'));
    wrap.lastChild.style.cssText = 'font-size:14px;font-weight:900;letter-spacing:.12em;margin-bottom:12px;';
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;';
    var views = document.createElement('input');
    views.type = 'number';
    views.value = '250000';
    views.style.cssText = 'padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:#0c0c0c;color:#FFFFFF;font-family:ui-monospace,monospace;';
    var rpm = document.createElement('input');
    rpm.type = 'number';
    rpm.step = '0.1';
    rpm.value = String(avgRpm ? avgRpm.toFixed(1) : 4);
    rpm.style.cssText = views.style.cssText;
    var out = document.createElement('div');
    out.style.cssText = 'padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:#050505;color:#FFFFFF;font-size:20px;font-weight:900;';
    function recalc() {
      var monthly = (toNumber(views.value || 0) / 1000) * toNumber(rpm.value || 0);
      out.textContent = moneyLabel(monthly);
    }
    views.oninput = recalc;
    rpm.oninput = recalc;
    [
      { label: 'Monthly views', node: views },
      { label: 'Estimated RPM', node: rpm },
      { label: 'Projected revenue', node: out }
    ].forEach(function(entry) {
      var field = document.createElement('label');
      field.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      field.appendChild(el('span', '', entry.label));
      field.lastChild.style.cssText = 'font-size:11px;color:rgba(255,255,255,.68);font-weight:700;';
      field.appendChild(entry.node);
      grid.appendChild(field);
    });
    wrap.appendChild(grid);
    body.appendChild(wrap);
    recalc();
  }
  function buildWorkbench(titleText, subtitleText) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:18px;padding:18px;border-radius:22px;border:1px solid rgba(255,255,255,.10);background:#090909;';
    wrap.appendChild(el('div', '', titleText));
    wrap.lastChild.style.cssText = 'font-size:14px;font-weight:900;letter-spacing:.12em;margin-bottom:8px;';
    if (subtitleText) {
      wrap.appendChild(el('div', '', subtitleText));
      wrap.lastChild.style.cssText = 'font-size:12px;line-height:1.7;color:rgba(255,255,255,.62);margin-bottom:14px;';
    }
    body.appendChild(wrap);
    return wrap;
  }
  function buildPatternWorkbench() {
    var wrap = buildWorkbench('TITLE LAB', 'Combine a pattern, a niche and an angle to get ideas ready to search or copy.');
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;';
    var seed = document.createElement('input');
    seed.type = 'text';
    seed.value = keywordStats[0] ? keywordStats[0].word : 'history';
    seed.style.cssText = 'padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:#0c0c0c;color:#FFFFFF;font-family:ui-monospace,monospace;';
    var niche = document.createElement('input');
    niche.type = 'text';
    niche.value = topByRpm[0] ? (topByRpm[0].niche || topByRpm[0].title || '') : 'mysteries';
    niche.style.cssText = seed.style.cssText;
    var out = document.createElement('div');
    out.style.cssText = 'margin-top:14px;display:grid;gap:10px;';
    function renderTitles() {
      while (out.firstChild) out.removeChild(out.firstChild);
      var angles = ['nobody explains', 'that changes everything', 'almost nobody knows', 'that looks impossible', 'that can bring views fast'];
      angles.forEach(function(angle, index) {
        var titleText = 'How ' + String(seed.value || '').trim() + ' works in ' + String(niche.value || '').trim() + ': the part ' + angle;
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#050505;';
        var copy = document.createElement('div');
        copy.style.cssText = 'flex:1;font-size:13px;line-height:1.6;font-weight:800;';
        copy.textContent = (index + 1) + '. ' + titleText;
        row.appendChild(copy);
        row.appendChild(toolButton('COPY', function() { copyToolText(titleText, 'Idea copied'); }));
        row.appendChild(toolButton('SEARCH', function() { searchNicheTerm(titleText, 'es'); }, true));
        out.appendChild(row);
      });
    }
    [
      { label: 'Base pattern', node: seed },
      { label: 'Target niche', node: niche }
    ].forEach(function(entry) {
      var field = document.createElement('label');
      field.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      field.appendChild(el('span', '', entry.label));
      field.lastChild.style.cssText = 'font-size:11px;color:rgba(255,255,255,.68);font-weight:700;';
      field.appendChild(entry.node);
      grid.appendChild(field);
    });
    wrap.appendChild(grid);
    var controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;';
    controls.appendChild(toolButton('GENERATE TITLES', renderTitles, true));
    controls.appendChild(toolButton('COPY ALL', function() {
      var lines = [];
      out.querySelectorAll('div').forEach(function(node) {
        if (node && node.textContent && /^\d+\./.test(node.textContent.trim())) lines.push(node.textContent.trim());
      });
      copyToolText(lines.join('\n'), 'Pack copied');
    }));
    wrap.appendChild(controls);
    wrap.appendChild(out);
    renderTitles();
  }
  function buildMarketWorkbench() {
    var wrap = buildWorkbench('RPM FILTER', 'Filter the archive by minimum RPM and launch the best opportunity above that cut.');
    var input = document.createElement('input');
    input.type = 'range';
    input.min = '1';
    input.max = '20';
    input.step = '1';
    input.value = '6';
    input.style.cssText = 'width:100%;';
    var label = document.createElement('div');
    label.style.cssText = 'margin-top:10px;font-size:16px;font-weight:900;';
    var out = document.createElement('div');
    out.style.cssText = 'display:grid;gap:10px;margin-top:14px;';
    function renderMarket() {
      while (out.firstChild) out.removeChild(out.firstChild);
      var minRpm = toNumber(input.value || 0);
      label.textContent = 'Minimum RPM: ' + rpmLabel(minRpm);
      var matches = topByRpm.filter(function(item) { return toNumber(item.rpm || 0) >= minRpm; }).slice(0, 8);
      matches.forEach(function(item) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#050505;';
        var copy = document.createElement('div');
        copy.style.cssText = 'flex:1;font-size:13px;line-height:1.6;';
        copy.textContent = (item.title || 'Untitled') + ' | ' + rpmLabel(item.rpm || 0) + ' | ' + moneyLabel(item.revMonth || 0);
        row.appendChild(copy);
        row.appendChild(toolButton('SEARCH', function() { searchNicheTerm(item.title || item.niche || '', item.language || 'es'); }, true));
        out.appendChild(row);
      });
      if (!matches.length) {
        out.appendChild(el('div', '', 'No niche in the archive is above that RPM right now.'));
        out.lastChild.style.cssText = 'font-size:12px;color:rgba(255,255,255,.62);';
      }
    }
    input.oninput = renderMarket;
    wrap.appendChild(input);
    wrap.appendChild(label);
    wrap.appendChild(out);
    renderMarket();
  }
  function buildGapWorkbench(gaps) {
    var wrap = buildWorkbench('GAP LAUNCHER', 'Launch fresh searches from the cleanest gaps in the archive.');
    var select = document.createElement('select');
    select.style.cssText = 'width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:#0c0c0c;color:#FFFFFF;font-family:ui-monospace,monospace;';
    (gaps || []).slice(0, 12).forEach(function(item, index) {
      var opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = (item.niche || item.title || 'General') + ' | ' + rpmLabel(item.rpm || 0);
      select.appendChild(opt);
    });
    var buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;';
    buttons.appendChild(toolButton('SEARCH GAP', function() {
      var item = gaps[Number(select.value || 0)];
      if (item) searchNicheTerm(item.title || item.niche || '', item.language || 'es');
    }, true));
    buttons.appendChild(toolButton('COPY GAP', function() {
      var item = gaps[Number(select.value || 0)];
      if (item) copyToolText((item.title || item.niche || '') + ' | ' + rpmLabel(item.rpm || 0), 'Gap copied');
    }));
    wrap.appendChild(select);
    wrap.appendChild(buttons);
  }
  function clearNode(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }
  function renderJsonBlock(target, data) {
    var pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:#050505;color:rgba(255,255,255,.82);font-size:11px;line-height:1.55;';
    pre.textContent = JSON.stringify(data, null, 2);
    target.appendChild(pre);
  }
  function renderBackendRows(target, titleText, rows, mapper) {
    target.appendChild(el('div', '', titleText));
    target.lastChild.style.cssText = 'font-size:12px;font-weight:900;letter-spacing:.12em;margin:14px 0 8px;';
    if (!rows || !rows.length) {
      target.appendChild(el('div', '', 'No real results for this search.'));
      target.lastChild.style.cssText = 'font-size:12px;color:rgba(255,255,255,.62);';
      return;
    }
    rows.forEach(function(row, index) {
      var mapped = mapper(row, index) || {};
      var item = document.createElement('div');
      item.style.cssText = 'display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:11px 0;border-top:1px solid rgba(255,255,255,.06);';
      var copy = document.createElement('div');
      copy.style.cssText = 'min-width:0;flex:1;';
      copy.appendChild(el('div', '', mapped.title || ('Result ' + (index + 1))));
      copy.lastChild.style.cssText = 'font-size:13px;font-weight:900;line-height:1.45;';
      copy.appendChild(el('div', '', mapped.meta || ''));
      copy.lastChild.style.cssText = 'font-size:11px;color:rgba(255,255,255,.62);line-height:1.55;margin-top:5px;';
      item.appendChild(copy);
      if (mapped.search || mapped.copy || mapped.url) {
        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;';
        if (mapped.copy) actions.appendChild(toolButton('COPY', function() { copyToolText(mapped.copy, 'Result copied'); }));
        if (mapped.url) actions.appendChild(toolButton('OPEN', function() { try { window.open(mapped.url, '_blank', 'noopener'); } catch (e) {} }, true));
        if (mapped.search) actions.appendChild(toolButton('SEARCH', function() { searchNicheTerm(mapped.search, 'es'); }, true));
        item.appendChild(actions);
      }
      target.appendChild(item);
    });
  }
  function buildBackendRunner(titleText, subtitleText, defaultValue, buttonLabel, runFn, renderFn) {
    var wrap = buildWorkbench(titleText, subtitleText);
    var input = document.createElement('textarea');
    input.rows = 2;
    input.value = defaultValue || '';
    input.placeholder = 'keyword, @channel or URL';
    input.style.cssText = 'width:100%;resize:vertical;min-height:52px;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:#0c0c0c;color:#fff;font-family:ui-monospace,monospace;line-height:1.5;';
    var controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;';
    var out = document.createElement('div');
    out.style.cssText = 'margin-top:14px;';
    controls.appendChild(toolButton(buttonLabel || 'RUN FOR REAL', function() {
      clearNode(out);
      if (!window.AshlyVAPI) {
        out.appendChild(el('div', '', 'AshlyVAPI is not loaded on this page.'));
        return;
      }
      out.appendChild(el('div', '', 'Processing real data'));
      out.lastChild.style.cssText = 'font-size:12px;color:rgba(255,255,255,.62);';
      Promise.resolve(runFn(String(input.value || '').trim())).then(function(response) {
        clearNode(out);
        renderFn(out, response && response.data ? response.data : response);
      }).catch(function(error) {
        clearNode(out);
        out.appendChild(el('div', '', 'Backend error: ' + (error && error.message ? error.message : error)));
        out.lastChild.style.cssText = 'font-size:12px;color:#ff8f8f;line-height:1.6;';
      });
    }, true));
    controls.appendChild(toolButton('COPY INPUT', function() { copyToolText(input.value, 'Input copied'); }));
    wrap.appendChild(input);
    wrap.appendChild(controls);
    wrap.appendChild(out);
    return { wrap: wrap, input: input, out: out };
  }

  var nicheCount = nichos.length;
  var channelCount = channels.length;
  var avgRpm = nicheCount ? (nichos.reduce(function(sum, item) { return sum + toNumber(item.rpm || 0); }, 0) / nicheCount) : 0;
  var topByRpm = nichos.slice().sort(function(a, b) { return toNumber(b.rpm || 0) - toNumber(a.rpm || 0); });
  var recentNichos = nichos.slice().sort(function(a, b) { return toNumber(b.savedAt || 0) - toNumber(a.savedAt || 0); });
  var keywordStats = buildAshlyVKeywordStats(nichos);
  var topChannels = channels.slice().sort(function(a, b) {
    return toNumber(b.avgOS || b.topVPH || b.revMonth || 0) - toNumber(a.avgOS || a.topVPH || a.revMonth || 0);
  }).slice(0, 10);
  var langMap = Object.create(null);
  nichos.forEach(function(item) {
    var key = String(item.language || 'unknown').slice(0, 20);
    if (!langMap[key]) langMap[key] = { label: key, count: 0, rpm: 0 };
    langMap[key].count += 1;
    langMap[key].rpm += toNumber(item.rpm || 0);
  });
  var langRows = Object.keys(langMap).map(function(key) {
    return {
      title: key.toUpperCase(),
      meta: langMap[key].count + ' niches | avg RPM ' + rpmLabel(langMap[key].count ? (langMap[key].rpm / langMap[key].count) : 0)
    };
  }).sort(function(a, b) { return parseFloat((b.meta.match(/\$([\d.]+)/) || [0,0])[1]) - parseFloat((a.meta.match(/\$([\d.]+)/) || [0,0])[1]); });

  var routeConfig = {
    '/market-radar': {
      title: 'MARKET RADAR',
      subtitle: 'Reads your archive and lets you act on the best RPM without leaving the dashboard.',
      render: function() {
        actionBar([
          { label: 'SEARCH TOP RPM', primary: true, onClick: function() { if (topByRpm[0]) searchNicheTerm(topByRpm[0].title || topByRpm[0].niche || '', topByRpm[0].language || 'es'); } },
          { label: 'COPY TOP 5', onClick: function() { copyToolText(collectTopTitles(topByRpm, 5), 'Top RPM copied'); } },
          { label: 'OPEN SCAN', onClick: function() { closeAshlyVToolWorkspace(); openScanModal('channel'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Saved niches', String(nicheCount), 'Current analysis base');
        statCard(grid, 'Average RPM', rpmLabel(avgRpm), 'Archive average');
        statCard(grid, 'Best RPM', rpmLabel(topByRpm[0] && topByRpm[0].rpm || 0), topByRpm[0] ? topByRpm[0].title : 'No leader yet');
        section('TOP RPM', topByRpm.slice(0, 10).map(function(item) {
          return { title: item.title || 'Untitled', meta: (item.niche || 'General') + ' | ' + rpmLabel(item.rpm || 0) + ' | ' + moneyLabel(item.revMonth || 0), actionLabel: 'SEARCH', action: function() { searchNicheTerm(item.title || item.niche || '', item.language || 'es'); }, secondaryLabel: 'COPY', secondaryAction: function() { copyToolText(item.title || '', 'Title copied'); } };
        }));
        buildMarketWorkbench();
        buildBackendRunner(
          'REAL MARKET RADAR',
          'Searches real keywords on YouTube, scores demand and competition, and puts faceless first without leaning on saved data.',
          topByRpm[0] ? (topByRpm[0].niche || topByRpm[0].title || 'mystery documentary') : 'mystery documentary, hidden history, wild nature',
          'SCAN THE MARKET',
          function(value) {
            var seeds = value.split(/[\n,]+/).map(function(x) { return x.trim(); }).filter(Boolean);
            return window.AshlyVAPI.marketRadar(seeds, 'es', 10);
          },
          function(out, data) {
            renderBackendRows(out, 'REAL OPPORTUNITIES', data || [], function(item) {
              return {
                title: item.keyword || 'Keyword',
                meta: 'Sub ' + (item.subNiche || 'general') + ' | ' + (item.language || 'auto') + ' | vol ' + compactNumber(item.estimatedMonthlySearchVolume || 0) + '/mo | RPM ' + rpmLabel(item.estimatedRpm || 0) + ' | CPM ' + rpmLabel(item.estimatedCpm || 0) + ' | comp ' + (item.competitionLevel || Math.round(item.competitionScore || 0)) + ' | sat ' + (item.saturationLevel || Math.round(item.saturationScore || 0)) + ' | faceless ' + Math.round(item.facelessScore || 0) + ' | OS ' + Math.round(item.opportunityScore || 0),
                search: item.keyword,
                copy: JSON.stringify(item)
              };
            });
          }
        );
      }
    },
    '/language-radar': {
      title: 'LANGUAGE RADAR',
      subtitle: 'Compare languages and open the same topic in the language that pays best.',
      render: function() {
        actionBar([
          { label: 'SEARCH BEST LANGUAGE', primary: true, onClick: function() { if (langRows[0]) searchNicheTerm((topByRpm[0] && (topByRpm[0].niche || topByRpm[0].title)) || langRows[0].title, langRows[0].title.toLowerCase()); } },
          { label: 'COPY RANKING', onClick: function() { copyToolText(langRows.map(function(row, index) { return (index + 1) + '. ' + row.title + ' - ' + row.meta; }).join('\n'), 'Ranking copied'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Active languages', String(langRows.length), 'Languages visible in your archive');
        statCard(grid, 'Most repeated niche', recentNichos[0] ? String(recentNichos[0].niche || 'General') : 'N/A', 'Based on recent saves');
        statCard(grid, 'Best language RPM', langRows[0] ? langRows[0].meta.split('|')[1].trim() : '$0', langRows[0] ? langRows[0].title : 'No data');
        section('RANKING BY LANGUAGE', langRows.slice(0, 10).map(function(row) {
          return { title: row.title, meta: row.meta, actionLabel: 'EXPLORE', action: function() { searchNicheTerm((topByRpm[0] && (topByRpm[0].niche || topByRpm[0].title)) || row.title, row.title.toLowerCase()); } };
        }));
      }
    },
    '/competitor-map': {
      title: 'COMPETITOR MAP',
      subtitle: 'Shows the strongest channels and lets you open them or search their lane at once.',
      render: function() {
        actionBar([
          { label: 'OPEN TOP CHANNEL', primary: true, onClick: function() { if (topChannels[0]) openChannelTarget(topChannels[0]); } },
          { label: 'SEARCH COMPETITORS', onClick: function() { if (topChannels[0]) searchNicheTerm(topChannels[0].name || topChannels[0].channelName || '', 'es'); } },
          { label: 'COPY CHANNELS', onClick: function() { copyToolText(collectTopTitles(topChannels, 8), 'Channels copied'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Saved channels', String(channelCount), 'Current base');
        statCard(grid, 'Top channel', topChannels[0] ? String(topChannels[0].name || topChannels[0].channelName || 'N/A') : 'N/A', 'Sorted by visible score and size');
        statCard(grid, 'Linked niches', String(new Set(nichos.map(function(item) { return item.niche || 'General'; })).size), 'Lane diversity');
        section('PRIORITY CHANNELS', topChannels.map(function(item) {
          return { title: item.name || item.channelName || 'Channel', meta: 'Subs ' + compactNumber(item.subs || 0) + ' | Top VPH ' + compactNumber(item.topVPH || 0) + '/h | Rev ' + moneyLabel(item.revMonth || 0), actionLabel: item.channelUrl ? 'OPEN' : 'SEARCH', action: function() { openChannelTarget(item); }, secondaryLabel: 'COPY', secondaryAction: function() { copyToolText(item.channelUrl || item.name || item.channelName || '', 'Channel copied'); } };
        }));
        buildBackendRunner(
          'REAL COMPETITOR MAP',
          'Paste an @channel, a URL or a keyword. The backend finds real competitors on YouTube and sorts them into direct, emerging and adjacent.',
          topChannels[0] ? (topChannels[0].channelUrl || topChannels[0].name || topChannels[0].channelName || '') : 'mystery documentary',
          'MAP COMPETITORS',
          function(value) { return window.AshlyVAPI.competitorMap(value || 'mystery documentary', 'es'); },
          function(out, data) {
            renderBackendRows(out, 'REAL COMPETITORS', (data && data.competitors) || [], function(item) {
              return {
                title: (item.type ? item.type.toUpperCase() + ' | ' : '') + (item.name || 'Channel'),
                meta: 'score ' + Math.round(item.competitorScore || item.facelessSignal || 0) + ' | ' + (item.subscribersText || '') + ' | ' + (item.description || '').slice(0, 120),
                url: item.url,
                search: item.name,
                copy: item.url || item.name
              };
            });
          }
        );
      }
    },
    '/gap-finder': {
      title: 'GAP FINDER',
      subtitle: 'Isolates useful gaps and launches a fresh search on the best one with no copy and paste.',
      render: function() {
        var countMap = Object.create(null);
        nichos.forEach(function(item) {
          var key = String(item.niche || 'General');
          countMap[key] = (countMap[key] || 0) + 1;
        });
        var gaps = nichos.filter(function(item) {
          return countMap[String(item.niche || 'General')] <= 2 && (toNumber(item.rpm || 0) >= 6 || toNumber(item.os || 0) >= 60);
        }).sort(function(a, b) {
          return (toNumber(b.rpm || 0) * 8 + toNumber(b.os || 0)) - (toNumber(a.rpm || 0) * 8 + toNumber(a.os || 0));
        });
        actionBar([
          { label: 'SEARCH TOP GAP', primary: true, onClick: function() { if (gaps[0]) searchNicheTerm(gaps[0].title || gaps[0].niche || '', gaps[0].language || 'es'); } },
          { label: 'COPY GAPS', onClick: function() { copyToolText(collectTopTitles(gaps, 6), 'Gaps copied'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Gaps detected', String(gaps.length), 'Rarely repeated niche with a strong signal');
        statCard(grid, 'Best gap RPM', rpmLabel(gaps[0] && gaps[0].rpm || 0), gaps[0] ? gaps[0].title : 'No data');
        section('RECOMMENDED GAPS', gaps.slice(0, 10).map(function(item) {
          return { title: item.title || 'Untitled', meta: (item.niche || 'General') + ' | RPM ' + rpmLabel(item.rpm || 0) + ' | OS ' + Math.round(toNumber(item.os || 0)), actionLabel: 'SEARCH', action: function() { searchNicheTerm(item.title || item.niche || '', item.language || 'es'); } };
        }));
        buildGapWorkbench(gaps);
        buildBackendRunner(
          'REAL GAP FINDER',
          'Analyzes real videos for a keyword or channel and finds uncovered topics with an opportunity score.',
          gaps[0] ? (gaps[0].niche || gaps[0].title || 'hidden history') : 'hidden history',
          'FIND GAPS',
          function(value) { return window.AshlyVAPI.gapFinder(value || 'hidden history', 'es'); },
          function(out, data) {
            renderBackendRows(out, 'REAL GAPS', (data && data.gaps) || [], function(item) {
              return {
                title: item.topic || 'Gap',
                meta: 'OS ' + Math.round(item.opportunityScore || 0) + ' | demand ' + Math.round(item.demandScore || 0) + ' | competition ' + Math.round(item.competitionScore || 0),
                search: item.topic,
                copy: item.topic
              };
            });
          }
        );
      }
    },
    '/pattern-finder': {
      title: 'PATTERN FINDER',
      subtitle: 'Pulls repeated patterns and turns them into a content search right away.',
      render: function() {
        actionBar([
          { label: 'COPY PATTERNS', primary: true, onClick: function() { copyToolText(keywordStats.map(function(item, index) { return (index + 1) + '. ' + item.word + ' (' + item.count + ')'; }).join('\n'), 'Patterns copied'); } },
          { label: 'SEARCH TOP PATTERN', onClick: function() { if (keywordStats[0]) searchNicheTerm(keywordStats[0].word, 'es'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Titles analyzed', String(nicheCount), 'Base used for patterns');
        statCard(grid, 'Main pattern', keywordStats[0] ? keywordStats[0].word.toUpperCase() : 'N/A', keywordStats[0] ? (keywordStats[0].count + ' repeats') : 'No data');
        statCard(grid, 'Last saved', recentNichos[0] ? String(recentNichos[0].title || 'N/A').slice(0, 28) : 'N/A', recentNichos[0] ? rpmLabel(recentNichos[0].rpm || 0) : 'No data');
        section('REPEATED WORDS', keywordStats.map(function(item) {
          return { title: item.word, meta: item.count + ' appearances in saved titles', actionLabel: 'SEARCH', action: function() { searchNicheTerm(item.word, 'es'); } };
        }));
        buildPatternWorkbench();
        buildBackendRunner(
          'REAL PATTERN FINDER',
          'Takes a keyword or a channel, reads real videos and returns repeated hooks, best length and viral formats.',
          keywordStats[0] ? keywordStats[0].word : 'mystery',
          'DETECT PATTERNS',
          function(value) { return window.AshlyVAPI.patternFinder(value || 'mystery', 'es'); },
          function(out, data) {
            var patterns = data && data.patterns ? data.patterns : data;
            renderBackendRows(out, 'REPEATED HOOKS', (patterns && patterns.repeatedHooks) || [], function(item) {
              return { title: item.format || 'Format', meta: (item.matches || 0) + ' matches', search: item.format, copy: JSON.stringify(item) };
            });
            renderBackendRows(out, 'FORMULAS', (patterns && patterns.topTitleFormulas) || [], function(item) {
              return { title: String(item), meta: 'Formula detected from real titles', copy: String(item) };
            });
            renderJsonBlock(out, patterns || {});
          }
        );
      }
    },
    '/trend-analyzer': {
      title: 'TREND ANALYZER',
      subtitle: 'Turns your most recent saves into actions: search, copy or dig deeper right now.',
      render: function() {
        actionBar([
          { label: 'SEARCH MOST RECENT', primary: true, onClick: function() { if (recentNichos[0]) searchNicheTerm(recentNichos[0].title || recentNichos[0].niche || '', recentNichos[0].language || 'es'); } },
          { label: 'COPY RECENT', onClick: function() { copyToolText(collectTopTitles(recentNichos, 8), 'Recent copied'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Recent saves', String(recentNichos.slice(0, 20).length), 'Latest moves in the archive');
        statCard(grid, 'Best recent RPM', rpmLabel(recentNichos[0] && recentNichos[0].rpm || 0), recentNichos[0] ? recentNichos[0].title : 'N/A');
        statCard(grid, 'Visible pool', moneyLabel(recentNichos.slice(0, 20).reduce(function(sum, item) { return sum + toNumber(item.revMonth || 0); }, 0)), 'Sum of visible revenue');
        section('RECENT AND STRONG', recentNichos.slice(0, 12).map(function(item) {
          return { title: item.title || 'Untitled', meta: (item.niche || 'General') + ' | ' + rpmLabel(item.rpm || 0) + ' | ' + moneyLabel(item.revMonth || 0), actionLabel: 'SEARCH', action: function() { searchNicheTerm(item.title || item.niche || '', item.language || 'es'); } };
        }));
      }
    },
    '/revenue-calculator': {
      title: 'REVENUE CALCULATOR',
      subtitle: 'Calculate, copy and open the best lane by visible revenue and RPM from your own archive.',
      render: function() {
        var topRevenue = nichos.slice().sort(function(a, b) { return toNumber(b.revMonth || 0) - toNumber(a.revMonth || 0); });
        actionBar([
          { label: 'COPY TOP REVENUE', primary: true, onClick: function() { copyToolText(collectTopTitles(topRevenue, 8), 'Top revenue copied'); } },
          { label: 'SEARCH LEADER', onClick: function() { if (topRevenue[0]) searchNicheTerm(topRevenue[0].title || topRevenue[0].niche || '', topRevenue[0].language || 'es'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Total visible revenue', moneyLabel(nichos.reduce(function(sum, item) { return sum + toNumber(item.revMonth || 0); }, 0)), 'Archive total');
        statCard(grid, 'Average revenue', moneyLabel(nicheCount ? (nichos.reduce(function(sum, item) { return sum + toNumber(item.revMonth || 0); }, 0) / nicheCount) : 0), 'Average per save');
        statCard(grid, 'Average RPM', rpmLabel(avgRpm), 'Basis of the calculation');
        section('TOP MONTHLY REVENUE', topRevenue.slice(0, 10).map(function(item) {
          return { title: item.title || 'Untitled', meta: moneyLabel(item.revMonth || 0) + ' | ' + rpmLabel(item.rpm || 0) + ' | ' + (item.niche || 'General'), actionLabel: 'SEARCH', action: function() { searchNicheTerm(item.title || item.niche || '', item.language || 'es'); } };
        }));
        buildRevenueInput();
      }
    },
    '/nichemaster-os': {
      title: 'NICHEMASTER OS',
      subtitle: 'Operations hub: open a scan, launch ideas and find the next priority lane without leaving the system.',
      render: function() {
        actionBar([
          { label: 'OPEN SCAN', primary: true, onClick: function() { closeAshlyVToolWorkspace(); openScanModal('channel'); } },
          { label: 'OPEN IDEAS', onClick: function() { closeAshlyVToolWorkspace(); openThumbnailModal(); setTimeout(function() { thumbSetTab('ideas'); }, 40); } },
          { label: 'SEARCH TOP', onClick: function() { if (topByRpm[0]) searchNicheTerm(topByRpm[0].title || topByRpm[0].niche || '', topByRpm[0].language || 'es'); } }
        ]);
        var grid = cardGrid();
        statCard(grid, 'Niches', String(nicheCount), 'Saved in the archive');
        statCard(grid, 'Channels', String(channelCount), 'Local competitive map');
        statCard(grid, 'Top RPM', rpmLabel(topByRpm[0] && topByRpm[0].rpm || 0), topByRpm[0] ? topByRpm[0].niche : 'No data');
        statCard(grid, 'Languages', String(langRows.length), 'Current coverage');
        section('NEXT MOVE', [
          { title: topByRpm[0] ? ('Start with: ' + (topByRpm[0].niche || topByRpm[0].title || 'General')) : 'Save more niches first', meta: topByRpm[0] ? ('RPM ' + rpmLabel(topByRpm[0].rpm || 0) + ' | Visible revenue ' + moneyLabel(topByRpm[0].revMonth || 0)) : 'Not enough data to prioritize.', actionLabel: topByRpm[0] ? 'SEARCH' : '', action: topByRpm[0] ? function() { searchNicheTerm(topByRpm[0].title || topByRpm[0].niche || '', topByRpm[0].language || 'es'); } : null }
        ]);
      }
    },
    '/text-to-video': {
      title: 'AI CONTENT ENGINE',
      subtitle: 'Shortcut into Ideas and Scan. No loose text: jump straight into the production flow.',
      render: function() {
        actionBar([
          { label: 'OPEN IDEAS', primary: true, onClick: function() { closeAshlyVToolWorkspace(); openThumbnailModal(); setTimeout(function() { thumbSetTab('ideas'); }, 40); } },
          { label: 'OPEN SCAN', onClick: function() { closeAshlyVToolWorkspace(); openScanModal('channel'); } },
          { label: 'COPY TOP 5', onClick: function() { copyToolText(collectTopTitles(topByRpm, 5), 'Top copied'); } }
        ]);
        section('WHAT IT DOES', [
          { title: 'Generates titles, hooks and thumbnail concepts', meta: 'Everything runs from the internal panel, with no dependency on localhost:3000.', actionLabel: 'OPEN IDEAS', action: function() { closeAshlyVToolWorkspace(); openThumbnailModal(); setTimeout(function() { thumbSetTab('ideas'); }, 40); } },
          { title: 'Uses your local AI or Anthropic', meta: 'If Ollama is already running, the route stays inside the extension.', actionLabel: 'OPEN SCAN', action: function() { closeAshlyVToolWorkspace(); openScanModal('channel'); } }
        ]);
        buildBackendRunner(
          'REAL AI CONTENT ENGINE',
          'Generates a full script package from the backend with OpenAI, Claude or Ollama. With no AI provider it returns a real error.',
          topByRpm[0] ? (topByRpm[0].niche || topByRpm[0].title || 'faceless historical mysteries') : 'faceless historical mysteries',
          'GENERATE SCRIPT',
          function(value) { return window.AshlyVAPI.generateContentScript(value || 'faceless historical mysteries', 'documentary faceless', 8, 'es'); },
          function(out, data) {
            renderBackendRows(out, 'SCRIPT PACKAGE', [
              { title: data && data.title, meta: data && data.hook },
              { title: 'Thumbnail', meta: data && data.thumbnailConcept }
            ], function(item) {
              return { title: item.title || 'Result', meta: item.meta || '', copy: JSON.stringify(data || {}) };
            });
            renderJsonBlock(out, data || {});
          }
        );
      }
    }
  };

  var config = routeConfig[route] || routeConfig['/nichemaster-os'];
  title.textContent = config.title;
  subtitle.textContent = config.subtitle;
  config.render();
  return overlay;
}

function openDashboardToolRoute(route) {
  route = String(route || '/').trim() || '/';
  closeToolsModal();
  try {
    window.location.href = buildAshlyVToolUrl(route.charAt(0) === '/' ? route : '/' + route);
  } catch (e) {
    buildAshlyVToolModal(route.charAt(0) === '/' ? route : '/' + route);
  }
}

function openToolsModal() {
  var modal = document.getElementById('tools-modal');
  if (modal) modal.style.display = 'flex';
}

function closeToolsModal() {
  var modal = document.getElementById('tools-modal');
  if (modal) modal.style.display = 'none';
}

var THUMB_HISTORY_KEY = 'ashlyv_thumbnail_history';
var THUMB_CONSENT_KEY = 'ashlyv_thumbnail_consent';

function thumbClear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

function thumbStorageGet(key) {
  return new Promise(function(resolve) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) { resolve(null); return; }
      chrome.storage.local.get([key], function(res) { resolve(res ? res[key] : null); });
    } catch (e) {
      resolve(null);
    }
  });
}

function thumbStorageSet(key, value) {
  return new Promise(function(resolve) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) { resolve(false); return; }
      var payload = {};
      payload[key] = value;
      chrome.storage.local.set(payload, function() { resolve(!chrome.runtime.lastError); });
    } catch (e) {
      resolve(false);
    }
  });
}

function getApiKeyInput() {
  return document.getElementById('ashlyv-api-key-input') || document.getElementById('thumb-api-key-input');
}

function setThumbnailStatus(message, tone) {
  var status = document.getElementById('thumb-status');
  if (!status) return;
  status.textContent = String(message || '').trim();
  status.setAttribute('data-tone', tone || 'muted');
}

function showAshlyVToast(message, type, durationMs) {
  var container = document.getElementById('ashlyv-toast-host');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ashlyv-toast-host';
    container.style.position = 'fixed';
    container.style.right = '24px';
    container.style.bottom = '24px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }
  while (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }
  var toast = document.createElement('div');
  toast.style.minWidth = '220px';
  toast.style.maxWidth = '340px';
  toast.style.padding = '12px 14px';
  toast.style.borderRadius = '16px';
  toast.style.border = '1px solid rgba(255,255,255,.14)';
  toast.style.background = type === 'error' ? 'rgba(255,61,113,.14)' : type === 'success' ? 'rgba(0,220,130,.14)' : 'rgba(123,92,255,.14)';
  toast.style.color = '#fff';
  toast.style.boxShadow = '0 18px 34px rgba(0,0,0,.34)';
  toast.style.backdropFilter = 'blur(10px)';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  toast.style.transition = 'opacity .2s ease, transform .2s ease';
  toast.textContent = String(message || '');
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);
  var timer = setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 220);
  }, durationMs || 2400);
  ashlyvToastTimers.push(timer);
}

function showApiKeyError(message) {
  var box = document.getElementById('ashlyv-api-error');
  if (!box) return;
  box.textContent = String(message || 'API key error');
  box.style.display = 'block';
  setTimeout(function() {
    if (box.textContent === String(message || 'API key error')) {
      box.style.display = 'none';
    }
  }, 8000);
}

function clearApiKeyError() {
  var box = document.getElementById('ashlyv-api-error');
  if (!box) return;
  box.style.display = 'none';
  box.textContent = '';
}

function updateApiKeyStatusIndicator() {
  var dot = document.getElementById('ashlyv-api-status-dot');
  var textNode = document.getElementById('ashlyv-api-status-text');
  var input = getApiKeyInput();
  var validateBtn = document.getElementById('ashlyv-validate-api') || document.getElementById('thumb-save-api-btn');
  if (!dot || !textNode) return;
  if (!window.AshlyVAPI || typeof window.AshlyVAPI.getProviderStatus !== 'function') return;
  window.AshlyVAPI.getProviderStatus().then(function(status) {
    if (status && status.localAvailable) {
      dot.style.background = '#00DC82';
      dot.style.boxShadow = '0 0 12px rgba(0,220,130,.35)';
      textNode.textContent = 'Local Ollama running';
      if (validateBtn) validateBtn.textContent = 'OLLAMA';
      setThumbnailStatus('Local AI detected. Analysis runs with no credits.', 'success');
      return;
    }
    return window.AshlyVAPI.getApiKey().then(function(key) {
    if (key) {
      dot.style.background = '#00DC82';
      dot.style.boxShadow = '0 0 12px rgba(0,220,130,.35)';
      textNode.textContent = 'API key saved';
      if (validateBtn && validateBtn.textContent === 'OLLAMA') validateBtn.textContent = 'VALIDATE API';
      if (input && !input.value) input.value = key;
      setThumbnailStatus('API detected and ready to use.', 'success');
      return;
    }
    dot.style.background = '#FF3D71';
    dot.style.boxShadow = '0 0 12px rgba(255,61,113,.35)';
    textNode.textContent = 'API key required for AI analysis';
    if (validateBtn) validateBtn.textContent = 'VALIDATE API';
    setThumbnailStatus('Paste your key, validate it, then analyze.', 'muted');
    });
  });
}

function openThumbnailModal() {
  closeToolsModal();
  openScanModal('thumbnail');
  thumbSetTab('analyze');
  loadThumbnailHistory();
  updateApiKeyStatusIndicator();
}

function closeThumbnailModal() {
  closeScanModal();
}

function thumbSetTab(tab) {
  var analyzeTab = document.getElementById('thumb-tab-analyze');
  var historyTab = document.getElementById('thumb-tab-history');
  var ideasTab = document.getElementById('thumb-tab-ideas');
  var analyzePanel = document.getElementById('thumb-analyze-panel');
  var historyPanel = document.getElementById('thumb-history-panel');
  var ideasPanel = document.getElementById('thumb-ideas-panel');
  if (analyzeTab) analyzeTab.classList.toggle('active', tab === 'analyze');
  if (historyTab) historyTab.classList.toggle('active', tab === 'history');
  if (ideasTab) ideasTab.classList.toggle('active', tab === 'ideas');
  if (analyzePanel) analyzePanel.style.display = tab === 'analyze' ? 'block' : 'none';
  if (historyPanel) historyPanel.style.display = tab === 'history' ? 'block' : 'none';
  if (ideasPanel) ideasPanel.style.display = tab === 'ideas' ? 'block' : 'none';
  if (tab === 'history') loadThumbnailHistory();
  if (tab === 'analyze') updateApiKeyStatusIndicator();
}

function thumbFileToDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(String(reader.result || '')); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeImageDataUrl(dataUrl, maxDimension) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      try {
        var width = img.naturalWidth || img.width || 0;
        var height = img.naturalHeight || img.height || 0;
        if (!width || !height) {
          reject(new Error('Could not read the image.'));
          return;
        }
        var limit = Number(maxDimension) || 1568;
        var scale = Math.min(1, limit / Math.max(width, height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not prepare the image.'));
          return;
        }
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var chosen = canvas.toDataURL('image/png');
        resolve(chosen);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = function() {
      reject(new Error('Could not process the thumbnail.'));
    };
    img.src = String(dataUrl || '');
  });
}

function thumbBase64(dataUrl) {
  var raw = String(dataUrl || '');
  return raw.indexOf(',') >= 0 ? raw.split(',')[1] : raw;
}

function normalizeThumbnailResult(result) {
  result = result && typeof result === 'object' ? result : {};
  function num(value, max) {
    var n = Number(value);
    if (!isFinite(n)) n = 0;
    return Math.max(0, Math.min(max, n));
  }
  function list(value, max) {
    return Array.isArray(value) ? value.slice(0, max || 4).map(function(item) { return String(item || '').slice(0, 220); }) : [];
  }
  var verdict = String(result.verdict || 'NEEDS WORK').toUpperCase();
  if (!/^(VIRAL POTENTIAL|GOOD|NEEDS WORK|POOR)$/.test(verdict)) verdict = 'NEEDS WORK';
  return {
    ctrScore: num(result.ctrScore, 100),
    overallScore: num(result.overallScore, 100),
    facelessCompatible: result.facelessCompatible === true,
    verdict: verdict,
    emotionScore: num(result.emotionScore, 10),
    textReadability: num(result.textReadability, 10),
    colorContrast: num(result.colorContrast, 10),
    curiosityHook: num(result.curiosityHook, 10),
    strengths: list(result.strengths, 3),
    weaknesses: list(result.weaknesses, 3),
    improvements: list(result.improvements, 4),
    nicheRecommendation: String(result.nicheRecommendation || '').slice(0, 220)
  };
}

function normalizeChannelResult(result) {
  result = result && typeof result === 'object' ? result : {};
  function num(value, max) {
    var n = Number(value);
    if (!isFinite(n)) n = 0;
    return Math.max(0, Math.min(max, n));
  }
  function list(value) {
    return Array.isArray(value) ? value.slice(0, 4).map(function(item) { return String(item || '').slice(0, 220); }) : [];
  }
  function pickEnum(value, allowed, fallback) {
    value = String(value || '').toUpperCase();
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }
  return {
    facelessScore: num(result.facelessScore, 100),
    replicable: result.replicable === true,
    niche: String(result.niche || 'Niche not detected').slice(0, 160),
    rpmEstimate: num(result.rpmEstimate, 9999),
    monthlyRevenueEstimate: String(result.monthlyRevenueEstimate || '$0-$0').slice(0, 80),
    growthPotential: pickEnum(result.growthPotential, ['HIGH', 'MEDIUM', 'LOW'], 'MEDIUM'),
    facelessTechnique: String(result.facelessTechnique || 'No description').slice(0, 400),
    strengths: list(result.strengths),
    weaknesses: list(result.weaknesses),
    replicationStrategy: String(result.replicationStrategy || 'No strategy').slice(0, 500),
    contentGaps: list(result.contentGaps),
    recommendedPostingFrequency: String(result.recommendedPostingFrequency || '2 videos per week').slice(0, 120),
    competitionLevel: pickEnum(result.competitionLevel, ['HIGH', 'MEDIUM', 'LOW'], 'MEDIUM')
  };
}

function getScoreColor(score) {
  if (score >= 80) return '#00DC82';
  if (score >= 50) return '#FFD700';
  return '#FF3D71';
}

function createScoreCircle(score, label, size) {
  var safeScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  var color = getScoreColor(safeScore);
  var wrap = document.createElement('div');
  wrap.style.width = (size || 140) + 'px';
  wrap.style.height = (size || 140) + 'px';
  wrap.style.borderRadius = '50%';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.position = 'relative';
  wrap.style.background = 'conic-gradient(' + color + ' 0deg, rgba(255,255,255,.08) 0deg)';
  wrap.style.boxShadow = '0 18px 30px rgba(0,0,0,.28)';

  var inner = document.createElement('div');
  inner.style.width = (size ? size - 18 : 122) + 'px';
  inner.style.height = (size ? size - 18 : 122) + 'px';
  inner.style.borderRadius = '50%';
  inner.style.background = '#090909';
  inner.style.border = '1px solid rgba(255,255,255,.08)';
  inner.style.display = 'flex';
  inner.style.flexDirection = 'column';
  inner.style.alignItems = 'center';
  inner.style.justifyContent = 'center';

  var value = document.createElement('div');
  value.style.fontSize = size && size < 80 ? '18px' : '34px';
  value.style.fontWeight = '900';
  value.style.color = '#fff';
  value.textContent = '0';

  var caption = document.createElement('div');
  caption.style.marginTop = '4px';
  caption.style.fontSize = size && size < 80 ? '8px' : '10px';
  caption.style.letterSpacing = '.16em';
  caption.style.color = 'rgba(255,255,255,.62)';
  caption.textContent = String(label || 'OVERALL').toUpperCase();

  inner.appendChild(value);
  inner.appendChild(caption);
  wrap.appendChild(inner);

  var current = 0;
  var timer = setInterval(function() {
    current += Math.max(1, Math.ceil((safeScore - current) / 8));
    if (current >= safeScore) {
      current = safeScore;
      clearInterval(timer);
    }
    value.textContent = String(current);
    wrap.style.background = 'conic-gradient(' + color + ' ' + Math.round(current * 3.6) + 'deg, rgba(255,255,255,.08) 0deg)';
  }, 18);

  return wrap;
}

function createBadge(text, bg, fg, border) {
  var badge = document.createElement('span');
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.minHeight = '34px';
  badge.style.padding = '0 14px';
  badge.style.borderRadius = '999px';
  badge.style.border = '1px solid ' + (border || 'rgba(255,255,255,.12)');
  badge.style.background = bg || 'rgba(255,255,255,.06)';
  badge.style.color = fg || '#fff';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = '900';
  badge.style.letterSpacing = '.08em';
  badge.textContent = text;
  return badge;
}

function createProgressRow(label, score) {
  var row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '100px 1fr 44px';
  row.style.alignItems = 'center';
  row.style.gap = '10px';
  row.style.marginTop = '10px';

  var labelNode = document.createElement('div');
  labelNode.style.fontSize = '12px';
  labelNode.style.color = 'rgba(255,255,255,.78)';
  labelNode.textContent = label;

  var track = document.createElement('div');
  track.style.height = '10px';
  track.style.borderRadius = '999px';
  track.style.background = 'rgba(255,255,255,.08)';
  track.style.overflow = 'hidden';

  var fill = document.createElement('div');
  fill.style.height = '100%';
  fill.style.width = Math.max(0, Math.min(100, score * 10)) + '%';
  fill.style.borderRadius = '999px';
  fill.style.background = score >= 8 ? '#00DC82' : score >= 5 ? '#FFD700' : '#FF3D71';
  track.appendChild(fill);

  var value = document.createElement('div');
  value.style.fontSize = '12px';
  value.style.color = '#fff';
  value.style.textAlign = 'right';
  value.textContent = Math.round(score) + '/10';

  row.appendChild(labelNode);
  row.appendChild(track);
  row.appendChild(value);
  return row;
}

function showAnalysisLoading() {
  var host = document.getElementById('thumb-result-panel');
  if (!host) return;
  thumbClear(host);
  var wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.padding = '36px 18px';
  wrap.style.textAlign = 'center';

  var circle = document.createElement('div');
  circle.style.width = '132px';
  circle.style.height = '132px';
  circle.style.borderRadius = '50%';
  circle.style.background = 'rgba(255,255,255,.08)';
  circle.style.animation = 'blink 1.4s infinite';

  var spinner = document.createElement('div');
  spinner.style.width = '32px';
  spinner.style.height = '32px';
  spinner.style.marginTop = '20px';
  spinner.style.borderRadius = '50%';
  spinner.style.border = '3px solid rgba(255,255,255,.12)';
  spinner.style.borderTopColor = '#7B5CFF';
  spinner.style.animation = 'spin-it 1s linear infinite';

  var title = document.createElement('div');
  title.style.marginTop = '18px';
  title.style.fontSize = '16px';
  title.style.fontWeight = '900';
  title.textContent = 'Analyzing the thumbnail with AI';

  var sub = document.createElement('div');
  sub.style.marginTop = '8px';
  sub.style.fontSize = '12px';
  sub.style.color = 'rgba(255,255,255,.62)';
  sub.textContent = 'This takes 5 to 10 seconds';

  wrap.appendChild(circle);
  wrap.appendChild(spinner);
  wrap.appendChild(title);
  wrap.appendChild(sub);
  host.appendChild(wrap);
}

function displayThumbnailResults(data) {
  var host = document.getElementById('thumb-result-panel');
  if (!host) return;
  data = normalizeThumbnailResult(data);
  thumbClear(host);

  var header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '18px';
  header.style.flexWrap = 'wrap';
  header.appendChild(createScoreCircle(data.overallScore, 'OVERALL', 140));

  var right = document.createElement('div');
  right.style.display = 'flex';
  right.style.flexDirection = 'column';
  right.style.gap = '12px';
  var verdictColor = data.verdict === 'VIRAL POTENTIAL' ? '#7B5CFF' : data.verdict === 'GOOD' ? '#00DC82' : data.verdict === 'NEEDS WORK' ? '#FFD700' : '#FF3D71';
  right.appendChild(createBadge(data.verdict, 'rgba(255,255,255,.04)', verdictColor, verdictColor));
  right.appendChild(createBadge('CTR Score: ' + Math.round(data.ctrScore) + '/100', 'rgba(255,255,255,.05)', '#fff'));
  right.appendChild(createBadge(data.facelessCompatible ? 'FACELESS OK' : 'SHOWS A FACE', data.facelessCompatible ? 'rgba(0,220,130,.12)' : 'rgba(255,61,113,.12)', data.facelessCompatible ? '#00DC82' : '#FF3D71'));
  header.appendChild(right);
  host.appendChild(header);

  var subsWrap = document.createElement('div');
  subsWrap.style.marginTop = '20px';
  subsWrap.appendChild(createProgressRow('Emotion', data.emotionScore));
  subsWrap.appendChild(createProgressRow('Readability', data.textReadability));
  subsWrap.appendChild(createProgressRow('Contrast', data.colorContrast));
  subsWrap.appendChild(createProgressRow('Curiosity', data.curiosityHook));
  host.appendChild(subsWrap);

  function renderPills(title, items, color) {
    var section = document.createElement('div');
    section.style.marginTop = '20px';
    var heading = document.createElement('div');
    heading.style.fontSize = '12px';
    heading.style.letterSpacing = '.12em';
    heading.style.color = 'rgba(255,255,255,.62)';
    heading.textContent = title.toUpperCase();
    section.appendChild(heading);
    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '10px';
    row.style.marginTop = '12px';
    (items && items.length ? items : ['No data']).forEach(function(item) {
      row.appendChild(createBadge(item, color === 'green' ? 'rgba(0,220,130,.12)' : 'rgba(255,61,113,.12)', '#fff', color === 'green' ? 'rgba(0,220,130,.24)' : 'rgba(255,61,113,.24)'));
    });
    section.appendChild(row);
    host.appendChild(section);
  }

  renderPills('Strengths', data.strengths, 'green');
  renderPills('Weaknesses', data.weaknesses, 'red');

  var improveTitle = document.createElement('div');
  improveTitle.style.marginTop = '20px';
  improveTitle.style.fontSize = '12px';
  improveTitle.style.letterSpacing = '.12em';
  improveTitle.style.color = 'rgba(255,255,255,.62)';
  improveTitle.textContent = 'IMPROVEMENTS';
  host.appendChild(improveTitle);

  var improveList = document.createElement('ol');
  improveList.style.marginTop = '12px';
  improveList.style.paddingLeft = '18px';
  (data.improvements.length ? data.improvements : ['Run it again to get concrete improvements.']).forEach(function(item) {
    var li = document.createElement('li');
    li.style.marginTop = '10px';
    li.style.color = '#fff';
    li.textContent = item;
    improveList.appendChild(li);
  });
  host.appendChild(improveList);

  var niche = document.createElement('div');
  niche.style.marginTop = '20px';
  niche.style.padding = '14px 16px';
  niche.style.borderRadius = '18px';
  niche.style.background = 'rgba(123,92,255,.12)';
  niche.style.border = '1px solid rgba(123,92,255,.2)';
  niche.textContent = 'Recommended niche: ' + (data.nicheRecommendation || 'Not specified');
  host.appendChild(niche);
}

function showAnalysisError(message) {
  var host = document.getElementById('thumb-result-panel');
  if (!host) return;
  thumbClear(host);
  var wrap = document.createElement('div');
  wrap.style.padding = '18px 8px';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '14px';

  var icon = document.createElement('div');
  icon.style.fontSize = '26px';
  icon.textContent = 'ERROR';
  wrap.appendChild(icon);

  var text = document.createElement('div');
  text.style.color = '#fff';
  text.style.lineHeight = '1.6';
  text.textContent = String(message || 'Could not analyze the thumbnail');
  wrap.appendChild(text);

  var actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.flexWrap = 'wrap';

  var retry = document.createElement('button');
  retry.className = 'thumb-btn';
  retry.type = 'button';
  retry.textContent = 'Retry';
  retry.addEventListener('click', function() { handleThumbnailAnalyze(); });
  actions.appendChild(retry);

  if (String(message || '').toLowerCase().indexOf('api key') >= 0) {
    var config = document.createElement('button');
    config.className = 'thumb-btn secondary';
    config.type = 'button';
    config.textContent = 'Configure API key';
    config.addEventListener('click', openExtensionOptions);
    actions.appendChild(config);
  }

  wrap.appendChild(actions);
  host.appendChild(wrap);
}

function saveThumbnailHistory(imageBase64, parsedResults, mediaType) {
  chrome.storage.local.get(['ashlyv_thumbnail_history'], function(res) {
    var history = Array.isArray(res.ashlyv_thumbnail_history) ? res.ashlyv_thumbnail_history : [];
    history.unshift({
      timestamp: Date.now(),
      channelName: currentChannelName || '',
      mediaType: mediaType || 'image/jpeg',
      results: {
        overallScore: parsedResults.overallScore,
        verdict: parsedResults.verdict,
        ctrScore: parsedResults.ctrScore,
        facelessCompatible: parsedResults.facelessCompatible
      }
    });
    if (history.length > 10) history.length = 10;
    chrome.storage.local.set({ ashlyv_thumbnail_history: history });
  });
}

function loadThumbnailHistory() {
  var host = document.getElementById('thumb-history-list');
  if (!host) return;
  thumbClear(host);
  chrome.storage.local.get(['ashlyv_thumbnail_history'], function(res) {
    var history = Array.isArray(res.ashlyv_thumbnail_history) ? res.ashlyv_thumbnail_history : [];
    if (!history.length) {
      var empty = document.createElement('div');
      empty.className = 'scan-empty-sub';
      empty.textContent = 'No thumbnails analyzed yet.';
      host.appendChild(empty);
      return;
    }
    history.slice(0, 10).forEach(function(item) {
      var card = document.createElement('div');
      card.className = 'thumb-history-card';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.gap = '12px';
      card.style.padding = '14px';
      card.style.marginBottom = '12px';
      card.style.borderRadius = '18px';
      card.style.border = '1px solid rgba(255,255,255,.08)';
      card.style.background = 'rgba(255,255,255,.03)';

      var meta = document.createElement('div');
      meta.style.display = 'flex';
      meta.style.flexDirection = 'column';
      meta.style.gap = '6px';
      var timeNode = document.createElement('div');
      timeNode.style.fontSize = '11px';
      timeNode.style.color = 'rgba(255,255,255,.62)';
      timeNode.textContent = relTime(item.timestamp || Date.now());
      var channelNode = document.createElement('div');
      channelNode.style.fontWeight = '700';
      channelNode.textContent = item.channelName || 'Unnamed channel';
      meta.appendChild(timeNode);
      meta.appendChild(channelNode);

      var right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '10px';
      right.appendChild(createScoreCircle(item.results && item.results.overallScore, 'Score', 48));
      right.appendChild(createBadge(item.results && item.results.verdict ? item.results.verdict : 'N/A', 'rgba(255,255,255,.04)', '#fff'));
      var details = document.createElement('button');
      details.type = 'button';
      details.disabled = true;
      details.className = 'thumb-btn secondary';
      details.style.opacity = '.55';
      details.textContent = 'Re-analyze';
      details.title = 'Upload the image again to re-analyze it';
      right.appendChild(details);

      card.appendChild(meta);
      card.appendChild(right);
      host.appendChild(card);
    });
  });
}

function ensureThumbnailConsent() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([THUMB_CONSENT_KEY], function(res) {
      if (res && res[THUMB_CONSENT_KEY] === true) {
        resolve(true);
        return;
      }
      var existing = document.getElementById('ashlyv-thumb-consent-modal');
      if (existing) existing.remove();
      var overlay = document.createElement('div');
      overlay.id = 'ashlyv-thumb-consent-modal';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;';
      var card = document.createElement('div');
      card.style.cssText = 'width:min(520px,calc(100vw - 32px));background:#0c0c12;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:24px;';
      var title = document.createElement('div');
      title.style.cssText = 'font-size:24px;font-weight:800;margin-bottom:12px;';
      title.textContent = 'Sending an image to Anthropic';
      var body = document.createElement('div');
      body.style.cssText = 'line-height:1.7;color:rgba(255,255,255,.78);margin-bottom:20px;';
      body.textContent = 'This feature sends your thumbnail to the Anthropic API for AI analysis. No YouTube account data and no browsing history is sent.';
      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'thumb-btn secondary';
      cancel.textContent = 'CANCEL';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'thumb-btn';
      ok.textContent = 'CONTINUE';
      cancel.addEventListener('click', function() {
        overlay.remove();
        resolve(false);
      });
      ok.addEventListener('click', function() {
        chrome.storage.local.set((function() {
          var payload = {};
          payload[THUMB_CONSENT_KEY] = true;
          return payload;
        })(), function() {
          overlay.remove();
          resolve(true);
        });
      });
      actions.appendChild(cancel);
      actions.appendChild(ok);
      card.appendChild(title);
      card.appendChild(body);
      card.appendChild(actions);
      overlay.appendChild(card);
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
      document.body.appendChild(overlay);
    });
  });
}

function runThumbnailAnalysis(imageBase64, mediaType, channelName) {
  showAnalysisLoading();
  currentChannelName = channelName || '';

  var keepAliveInterval = setInterval(function() {
    chrome.runtime.sendMessage({ type: 'ASHLYV_PING' }, function() {
      if (chrome.runtime.lastError) {}
    });
  }, 20000);

  return window.AshlyVAPI.analyzeThumbnail(imageBase64, mediaType, channelName)
    .then(function(response) {
      clearInterval(keepAliveInterval);

      if (!response.success) {
        showAnalysisError(response.error || 'Could not connect to the API');
        return false;
      }

      var parsed = window.AshlyVAPI.parseApiJson(response.content);
      if (!parsed) {
        showAnalysisError('The AI returned an invalid response. Try again.');
        return false;
      }

      var normalized = normalizeThumbnailResult(parsed);
      displayThumbnailResults(normalized);
      saveThumbnailHistory(imageBase64, normalized, mediaType);
      loadThumbnailHistory();
      setThumbnailStatus('Analysis finished.', 'success');
      showAshlyVToast('Analysis finished', 'success', 2000);
      return true;
    })
    .catch(function(err) {
      clearInterval(keepAliveInterval);
      var msg = err.message || 'Unknown error';
      setThumbnailStatus(msg, 'error');
      if (msg.indexOf('API key') >= 0) {
        showAnalysisError(msg);
      } else if (msg.indexOf('timeout') >= 0) {
        showAnalysisError('The request took too long. Check your connection.');
      } else {
        showAnalysisError('Error: ' + msg + '. If it keeps happening, reload the extension and try another thumbnail.');
      }
      return false;
    });
}

function handleThumbnailAnalyze() {
  var fileInput = document.getElementById('thumb-file-input');
  var channelInput = document.getElementById('thumb-channel-input');
  var preview = document.getElementById('thumb-preview');
  var btn = document.getElementById('thumb-analyze-btn');
  var file = fileInput && fileInput.files && fileInput.files[0];
  var channelName = String(channelInput && channelInput.value || '').trim();
  clearApiKeyError();
  if (!channelName) {
    setThumbnailStatus('Enter the channel first.', 'error');
    showAnalysisError('Enter the channel name before analyzing.');
    if (channelInput) channelInput.focus();
    return;
  }
  if (!file) {
    setThumbnailStatus('Upload a thumbnail first.', 'error');
    showAnalysisError('Upload a thumbnail to continue.');
    return;
  }
  if (!/^image\//i.test(file.type || '') || file.size > 8 * 1024 * 1024) {
    setThumbnailStatus('Invalid file or too large. Maximum 8MB.', 'error');
    showAnalysisError('The file must be a valid image of 8MB or less.');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'ANALYZING';
  }
  setThumbnailStatus('Analyzing the thumbnail', 'busy');
  ensureThumbnailConsent()
    .then(function(allowed) {
      if (!allowed) throw new Error('Analysis cancelled by the user.');
      return thumbFileToDataUrl(file);
    })
    .then(function(dataUrl) {
      return normalizeImageDataUrl(dataUrl, 1024);
    })
    .then(function(dataUrl) {
      if (preview) {
        preview.src = dataUrl;
        preview.style.display = 'block';
      }
      lastThumbnailAnalysisPayload = {
        imageBase64: thumbBase64(dataUrl),
        mediaType: 'image/png',
        channelName: channelName
      };
      return runThumbnailAnalysis(lastThumbnailAnalysisPayload.imageBase64, lastThumbnailAnalysisPayload.mediaType, lastThumbnailAnalysisPayload.channelName);
    })
    .catch(function(err) {
      showAnalysisError(err && err.message ? err.message : 'Could not read the thumbnail.');
    })
    .then(function() {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'ANALYZE WITH AI';
      }
    });
}

function showChannelAnalysisLoading() {
  var host = document.getElementById('scan-content-area');
  if (!host) return;
  host.style.display = 'block';
  thumbClear(host);
  var wrap = document.createElement('div');
  wrap.className = 'scan-loading-state';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.padding = '42px 18px';
  var spinner = document.createElement('div');
  spinner.className = 'scan-spin';
  var title = document.createElement('div');
  title.className = 'scan-load-ttl';
  title.textContent = 'ANALYZING CHANNEL';
  var sub = document.createElement('div');
  sub.className = 'scan-load-sub';
  sub.textContent = 'The AI is scoring faceless potential, RPM, competition and strategy.';
  wrap.appendChild(spinner);
  wrap.appendChild(title);
  wrap.appendChild(sub);
  host.appendChild(wrap);
}

function showChannelAnalysisError(message) {
  var host = document.getElementById('scan-content-area');
  if (!host) return;
  thumbClear(host);
  var box = document.createElement('div');
  box.className = 'scan-empty-state';
  var icon = document.createElement('div');
  icon.className = 'scan-empty-icon';
  icon.textContent = 'X';
  var title = document.createElement('div');
  title.className = 'scan-empty-ttl';
  title.textContent = 'Could not analyze the channel';
  var sub = document.createElement('div');
  sub.className = 'scan-empty-sub';
  sub.textContent = String(message || 'Try again or check your API key.');
  box.appendChild(icon);
  box.appendChild(title);
  box.appendChild(sub);
  host.appendChild(box);
}

function displayChannelResults(data, channelName) {
  var host = document.getElementById('scan-content-area');
  if (!host) return;
  data = normalizeChannelResult(data);
  thumbClear(host);

  var card = document.createElement('div');
  card.style.padding = '22px';
  card.style.border = '1px solid rgba(255,255,255,.08)';
  card.style.borderRadius = '24px';
  card.style.background = 'linear-gradient(180deg, rgba(18,18,18,.96), rgba(4,4,4,.98))';

  var header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '18px';
  header.style.flexWrap = 'wrap';
  var left = document.createElement('div');
  var title = document.createElement('div');
  title.style.fontSize = '28px';
  title.style.fontWeight = '900';
  title.textContent = channelName;
  left.appendChild(title);
  left.appendChild(createBadge(data.niche, 'rgba(255,255,255,.06)', '#fff'));
  header.appendChild(left);
  header.appendChild(createScoreCircle(data.facelessScore, 'Face', 128));
  card.appendChild(header);

  var metrics = document.createElement('div');
  metrics.style.display = 'flex';
  metrics.style.flexWrap = 'wrap';
  metrics.style.gap = '10px';
  metrics.style.marginTop = '18px';
  metrics.appendChild(createBadge('RPM: $' + data.rpmEstimate.toFixed(2), 'rgba(0,220,130,.12)', '#00DC82'));
  metrics.appendChild(createBadge(data.monthlyRevenueEstimate, 'rgba(255,255,255,.06)', '#fff'));
  metrics.appendChild(createBadge(data.growthPotential, 'rgba(255,255,255,.05)', data.growthPotential === 'HIGH' ? '#00DC82' : data.growthPotential === 'MEDIUM' ? '#FFD700' : '#FF3D71'));
  metrics.appendChild(createBadge('Competition ' + data.competitionLevel, 'rgba(255,255,255,.05)', data.competitionLevel === 'LOW' ? '#00DC82' : data.competitionLevel === 'MEDIUM' ? '#FFD700' : '#FF3D71'));
  metrics.appendChild(createBadge(data.replicable ? 'REPLICABLE' : 'NO REPLICABLE', data.replicable ? 'rgba(0,220,130,.12)' : 'rgba(255,61,113,.12)', '#fff'));
  card.appendChild(metrics);

  var technique = document.createElement('div');
  technique.style.marginTop = '18px';
  technique.style.padding = '16px';
  technique.style.borderRadius = '18px';
  technique.style.border = '1px solid rgba(255,255,255,.08)';
  technique.style.background = 'rgba(255,255,255,.03)';
  technique.textContent = 'Faceless technique: ' + data.facelessTechnique;
  card.appendChild(technique);

  function appendPillSection(titleText, items, color) {
    var titleNode = document.createElement('div');
    titleNode.style.marginTop = '18px';
    titleNode.style.fontSize = '12px';
    titleNode.style.letterSpacing = '.12em';
    titleNode.style.color = 'rgba(255,255,255,.62)';
    titleNode.textContent = titleText.toUpperCase();
    card.appendChild(titleNode);
    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '10px';
    row.style.marginTop = '10px';
    (items.length ? items : ['No data']).forEach(function(item) {
      row.appendChild(createBadge(item, color === 'green' ? 'rgba(0,220,130,.12)' : 'rgba(255,61,113,.12)', '#fff'));
    });
    card.appendChild(row);
  }

  appendPillSection('Strengths', data.strengths, 'green');
  appendPillSection('Weaknesses', data.weaknesses, 'red');

  var strategyTitle = document.createElement('div');
  strategyTitle.style.marginTop = '18px';
  strategyTitle.style.fontSize = '12px';
  strategyTitle.style.letterSpacing = '.12em';
  strategyTitle.style.color = 'rgba(255,255,255,.62)';
  strategyTitle.textContent = 'REPLICATION STRATEGY';
  card.appendChild(strategyTitle);

  var strategy = document.createElement('div');
  strategy.style.marginTop = '10px';
  strategy.style.lineHeight = '1.7';
  strategy.textContent = data.replicationStrategy;
  card.appendChild(strategy);

  var gapsTitle = document.createElement('div');
  gapsTitle.style.marginTop = '18px';
  gapsTitle.style.fontSize = '12px';
  gapsTitle.style.letterSpacing = '.12em';
  gapsTitle.style.color = 'rgba(255,255,255,.62)';
  gapsTitle.textContent = 'CONTENT GAPS';
  card.appendChild(gapsTitle);

  var gaps = document.createElement('ul');
  gaps.style.marginTop = '10px';
  gaps.style.paddingLeft = '18px';
  (data.contentGaps.length ? data.contentGaps : ['No gaps detected.']).forEach(function(item) {
    var li = document.createElement('li');
    li.style.marginTop = '8px';
    li.textContent = item;
    gaps.appendChild(li);
  });
  card.appendChild(gaps);

  var footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';
  footer.style.gap = '12px';
  footer.style.flexWrap = 'wrap';
  footer.style.marginTop = '18px';
  footer.appendChild(createBadge(data.recommendedPostingFrequency, 'rgba(123,92,255,.12)', '#fff'));
  var ideasBtn = document.createElement('button');
  ideasBtn.type = 'button';
  ideasBtn.className = 'thumb-btn';
  ideasBtn.textContent = 'Generate content ideas';
  ideasBtn.addEventListener('click', function() {
    var nicheInput = document.getElementById('ideas-niche-input');
    if (nicheInput) nicheInput.value = data.niche;
    thumbSetTab('ideas');
  });
  footer.appendChild(ideasBtn);
  card.appendChild(footer);
  host.appendChild(card);
}

function runChannelAnalysis(channelName) {
  showChannelAnalysisLoading();
  lastChannelAnalysisName = channelName;

  var channelData = null;
  try {
    var stored = localStorage.getItem('nsp_session');
    if (stored) {
      var session = JSON.parse(stored);
      var match = (session.topVideos || []).find(function(v) {
        return (v.channelName || '').toLowerCase().indexOf(channelName.toLowerCase()) >= 0;
      });
      if (match) {
        channelData = {
          avgViews: match.vph ? match.vph * 24 * 30 : null,
          topics: [match.tier]
        };
      }
    }
  } catch (e) {}

  // Exit before the keep-alive interval is created: otherwise it leaks and the button stays stuck.
  if (!window.AshlyVAPI || typeof window.AshlyVAPI.analyzeChannel !== 'function') {
    showChannelAnalysisError('The AI client did not load. Reload the page with F5.');
    return Promise.resolve(false);
  }
  var keepAliveInterval = setInterval(function() {
    chrome.runtime.sendMessage({ type: 'ASHLYV_PING' }, function() {
      if (chrome.runtime.lastError) {}
    });
  }, 20000);

  try {
  return window.AshlyVAPI.analyzeChannel(channelName, channelData)
    .then(function(response) {
      clearInterval(keepAliveInterval);
      if (!response.success) {
        showChannelAnalysisError(response.error);
        return false;
      }
      var parsed = window.AshlyVAPI.parseApiJson(response.content);
      if (!parsed) {
        showChannelAnalysisError('Invalid response from the AI. Try again.');
        return false;
      }
      displayChannelResults(parsed, channelName);
      return true;
    })
    .catch(function(err) {
      clearInterval(keepAliveInterval);
      showChannelAnalysisError(err.message || 'Unknown error');
      return false;
    });
  } catch (eSync) {
    clearInterval(keepAliveInterval);
    showChannelAnalysisError((eSync && eSync.message) || 'Could not start the analysis');
    return Promise.resolve(false);
  }
}

function handleScanAnalyze() {
  var handle = (document.getElementById('scan-handle-input').value || '').trim().replace(/^@/, '');
  var btn = document.getElementById('scan-go-btn');
  if (!handle) {
    document.getElementById('scan-handle-input').focus();
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = 'ANALYZING';
  }
  runChannelAnalysis(handle);
  setTimeout(function() {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'ANALYZE';
    }
  }, 1200);
}

function render() {
  renderStats();
  updateHero();
  renderEngine();
  renderArchive();
}

/* ===============================================
   SCAN CHANNEL - CHANNEL INTELLIGENCE ENGINE
=============================================== */

// The API key is never hardcoded: anyone with the extension folder could read it. It comes from Options.
var GROQ_KEY = (function () { try { return localStorage.getItem('nsp_groq_api_key') || ''; } catch (e) { return ''; } })();
var scanCurrentMode = 'channel';
var scanCurrentTab = 'snapshot';
var scanSections = {};
var scanLastRealCompetitors = [];
var scanLastEstimatedCompetitors = [];
var scanLastScanMeta = null;

var SCAN_COMPETITOR_WEIGHTS = {
  nicheSimilarity: 0.35,
  formatSimilarity: 0.20,
  performanceScore: 0.20,
  recencyScore: 0.15,
  strategicValueScore: 0.10
};

var SCAN_HARD_FILTERS = {
  maxLastVideoDays: 90,
  minRecentAvgViews: 1000,
  minRecentVideos: 5,
  minNicheSimilarity: 55
};

var SCAN_STOPWORDS = {
  the:1, and:1, for:1, with:1, from:1, this:1, that:1, your:1, you:1, are:1, how:1, why:1, what:1, when:1, who:1,
  de:1, del:1, la:1, las:1, los:1, para:1, con:1, por:1, como:1, que:1, una:1, uno:1, este:1, esta:1, estos:1, esas:1,
  el:1, un:1, en:1, su:1, sus:1, mas:1, pero:1, sobre:1, todo:1, todos:1, youtube:1, channel:1, canal:1, oficial:1
};

function scanSetMode(mode) {
  scanCurrentMode = mode === 'thumbnail' ? 'thumbnail' : 'channel';
  var channelBtn = document.getElementById('scan-mode-channel');
  var thumbBtn = document.getElementById('scan-mode-thumbnail');
  var channelPane = document.getElementById('scan-mode-pane-channel');
  var thumbPane = document.getElementById('scan-mode-pane-thumbnail');
  var tabs = document.getElementById('scan-tabs-bar');
  var content = document.getElementById('scan-content-area');
  if (channelBtn) channelBtn.classList.toggle('active', scanCurrentMode === 'channel');
  if (thumbBtn) thumbBtn.classList.toggle('active', scanCurrentMode === 'thumbnail');
  if (channelPane) channelPane.style.display = scanCurrentMode === 'channel' ? 'block' : 'none';
  if (thumbPane) thumbPane.style.display = scanCurrentMode === 'thumbnail' ? 'block' : 'none';
  if (tabs) tabs.style.display = scanCurrentMode === 'channel' && tabs.getAttribute('data-has-results') === '1' ? 'flex' : 'none';
  if (content) content.style.display = scanCurrentMode === 'channel' ? 'block' : 'none';
  if (scanCurrentMode === 'thumbnail') loadThumbnailHistory();
}

function openScanModal(mode) {
  var m = document.getElementById('scan-modal');
  if (m) {
    m.style.display = 'flex';
    m.scrollTop = 0;
    var box = m.querySelector('.scan-box');
    if (box) box.scrollTop = 0;
  }
  scanSetMode(mode || 'channel');
}

function closeScanModal() {
  var m = document.getElementById('scan-modal');
  if (m) {
    m.style.display = 'none';
    m.scrollTop = 0;
  }
}

function scanSetTab(tab) {
  scanCurrentTab = tab;
  document.querySelectorAll('.scan-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });
  document.querySelectorAll('[id^="scan-panel-"]').forEach(function(p) {
    p.style.display = 'none';
    p.classList.remove('active');
  });
  var panel = document.getElementById('scan-panel-' + tab);
  if (panel) {
    panel.style.display = 'block';
    panel.classList.add('active');
  }
}

function scanShowState(state) {
  var empty = document.getElementById('scan-empty-state');
  var loading = document.getElementById('scan-loading-state');
  var results = document.getElementById('scan-results-wrap');
  var tabs = document.getElementById('scan-tabs-bar');
  if (empty) empty.style.display = state === 'empty' ? 'flex' : 'none';
  if (loading) loading.style.display = state === 'loading' ? 'flex' : 'none';
  if (results) results.style.display = state === 'results' ? 'block' : 'none';
  if (tabs) {
    tabs.setAttribute('data-has-results', state === 'results' ? '1' : '0');
    tabs.style.display = state === 'results' && scanCurrentMode === 'channel' ? 'flex' : 'none';
  }
}

/* Inline helpers */
function scanFmtInline(text) {
  return String(text)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
}

function extractField(text, key) {
  var re = new RegExp('(?:^|\\n)' + key + '\\s*:\\s*([^\\n]+)', 'i');
  var m = text.match(re);
  return m ? m[1].trim() : null;
}

function parseSubCount(str) {
  if (!str) return 0;
  var s = String(str).toLowerCase().replace(/,/g,'.').replace(/\s/g,'');
  var m = s.match(/(\d+(?:\.\d+)?)(k|m|mil|b|millones|millón|million|millions)?/);
  if (!m) return 0;
  var n = parseFloat(m[1]), u = m[2] || '';
  if (u==='k'||u==='mil') return n*1000;
  if (u==='m'||u==='millones'||u==='millón'||u==='million'||u==='millions') return n*1000000;
  if (u==='b') return n*1000000000;
  return n;
}

function scanParseViews(str) {
  if (!str) return 0;
  var raw = String(str).toLowerCase()
    .replace(/views|visualizaciones|vistas|reproducciones|visualizaç(?:õ|o)es|visualizações/g, '')
    .replace(/,/g, '.')
    .trim();
  var m = raw.match(/(\d+(?:\.\d+)?)\s*(k|m|b|mil|millones|millón|million|millions)?/i);
  if (!m) return 0;
  var n = parseFloat(m[1]);
  var unit = (m[2] || '').toLowerCase();
  if (unit === 'k' || unit === 'mil') return Math.round(n * 1000);
  if (unit === 'm' || unit === 'millones' || unit === 'millón' || unit === 'million' || unit === 'millions') return Math.round(n * 1000000);
  if (unit === 'b') return Math.round(n * 1000000000);
  return Math.round(n);
}

function scanAgeToDays(text) {
  var raw = String(text || '').toLowerCase();
  if (!raw) return 9999;
  if (/hour|hora|minute|minuto|today|hoy/.test(raw)) return 0;
  if (/yesterday|ayer/.test(raw)) return 1;
  var m = raw.match(/(\d+)\s*(second|minute|hour|day|week|month|year|segundo|minuto|hora|dia|día|semana|mes|ano|año|semanas|meses|anos|años|jours?|semaines?|mois|ans?)/i);
  if (!m) return 9999;
  var n = parseInt(m[1], 10) || 0;
  var u = m[2];
  if (/second|minute|hour|segundo|minuto|hora/.test(u)) return 0;
  if (/day|dia|día|jour/.test(u)) return n;
  if (/week|semana|semaine/.test(u)) return n * 7;
  if (/month|mes|mois/.test(u)) return n * 30;
  if (/year|ano|año|ans?/.test(u)) return n * 365;
  return 9999;
}

function scanCleanText(text) {
  return String(text || '')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/[^\w\s\u00C0-\u017F-]/g, ' ')
    .toLowerCase();
}

function scanTokens(text) {
  var seen = {};
  return scanCleanText(text).split(/\s+/).filter(function(token) {
    token = token.trim();
    if (!token || token.length < 3 || SCAN_STOPWORDS[token]) return false;
    if (/^\d+$/.test(token)) return false;
    if (seen[token]) return false;
    seen[token] = true;
    return true;
  });
}

function scanTokenSimilarity(aText, bText) {
  var a = scanTokens(aText);
  var b = scanTokens(bText);
  if (!a.length || !b.length) return 0;
  var bSet = {};
  b.forEach(function(t) { bSet[t] = true; });
  var hits = a.filter(function(t) { return bSet[t]; }).length;
  var overlap = hits / Math.max(Math.min(a.length, b.length), 1);
  var coverage = hits / Math.max(a.length, 1);
  return Math.round(Math.min(100, (overlap * 70) + (coverage * 30)));
}

function scanDetectFormats(text, videos) {
  var raw = scanCleanText([text].concat((videos || []).map(function(v) { return v.title || ''; })).join(' '));
  var formats = [];
  if (/\bshorts?\b|#shorts|shorts/.test(raw)) formats.push('shorts');
  if (/documental|documentary|docu|historia|history|histoire|geschichte/.test(raw)) formats.push('documental');
  if (/storytelling|historia|relato|cuento|narrat|story/.test(raw)) formats.push('storytelling');
  if (/explicad|explained|educativo|education|learn|facts|datos|science|ciencia|psicolog/.test(raw)) formats.push('educativo');
  if (/misterio|mystery|secret|secreto|hidden|oculto|forbidden|prohibid|dark/.test(raw)) formats.push('misterios');
  if (/reaction|reaccion|reacción|reacts?/.test(raw)) formats.push('reaccion');
  if (/podcast|entrevista|interview/.test(raw)) formats.push('podcast');
  if (/faceless|sin rostro|voz ia|ai voice|narrador|narration|narración/.test(raw)) formats.push('faceless');
  if (!formats.length) formats.push('evergreen');
  return formats.filter(function(item, idx, arr) { return arr.indexOf(item) === idx; });
}

function scanFormatSimilarity(aFormats, bFormats) {
  aFormats = aFormats || [];
  bFormats = bFormats || [];
  if (!aFormats.length || !bFormats.length) return 45;
  var bSet = {};
  bFormats.forEach(function(f) { bSet[f] = true; });
  var hits = aFormats.filter(function(f) { return bSet[f]; }).length;
  return Math.round(Math.min(100, 35 + (hits / Math.max(aFormats.length, bFormats.length)) * 65));
}

function scanDetectSelectedLanguage(lang, text) {
  if (!lang || lang === 'auto') return true;
  if (engine && engine.languageEngine && engine.languageEngine.detectLanguage) {
    var detected = engine.languageEngine.detectLanguage(text || '');
    if (detected && detected !== 'unknown' && detected !== 'auto') return detected === lang;
  }
  return true;
}

function scanPerformanceScore(avgViews, subs, videos) {
  var viewsScore = Math.min(100, Math.log10(Math.max(avgViews, 1)) * 18);
  var ratio = subs ? avgViews / Math.max(subs, 1) : 0.08;
  var ratioScore = Math.min(100, ratio * 220);
  var outlierScore = (videos || []).some(function(v) { return toNumber(v.views) >= avgViews * 2.2 && toNumber(v.views) >= 2500; }) ? 16 : 0;
  return Math.round(Math.min(100, (viewsScore * 0.58) + (ratioScore * 0.28) + outlierScore));
}

function scanRecencyScore(lastDays, videos) {
  var recentCount = (videos || []).filter(function(v) { return toNumber(v.ageDays) <= 90; }).length;
  var lastScore = lastDays <= 7 ? 100 : lastDays <= 30 ? 86 : lastDays <= 60 ? 68 : lastDays <= 90 ? 52 : 12;
  var freqScore = Math.min(100, recentCount * 17);
  return Math.round((lastScore * 0.68) + (freqScore * 0.32));
}

function scanStrategicValueScore(formats, videos, avgViews) {
  var formatText = (formats || []).join(' ');
  var clarity = /faceless|documental|storytelling|educativo|misterios/.test(formatText) ? 82 : 58;
  var repeatability = (videos || []).length >= 8 ? 88 : (videos || []).length >= 5 ? 72 : 45;
  var scale = /faceless|documental|educativo|misterios|evergreen/.test(formatText) ? 82 : 58;
  var proof = avgViews >= 10000 ? 86 : avgViews >= 2500 ? 70 : 50;
  return Math.round((clarity * 0.28) + (repeatability * 0.28) + (scale * 0.24) + (proof * 0.20));
}

function scanCompetitorType(score, subs, targetSubs, performanceScore, recencyScore, nicheSimilarity, formatSimilarity) {
  var bigger = targetSubs && subs >= targetSubs * 2.5;
  var fast = subs && subs < Math.max(targetSubs || 0, 250000) && performanceScore >= 72 && recencyScore >= 72;
  if (fast) return 'FAST GROWING';
  if (bigger && score >= 66) return 'ASPIRATIONAL';
  if (nicheSimilarity >= 72 && formatSimilarity >= 62) return 'DIRECT';
  if (nicheSimilarity >= 55) return 'ADJACENT';
  return '';
}

function scanStealPotential(score, strategicValueScore, type) {
  if (score >= 78 && strategicValueScore >= 74 && type !== 'ASPIRATIONAL') return 'HIGH';
  if (score >= 65) return 'MEDIUM';
  return 'LOW';
}

function scanWhyCompetitorMatters(c) {
  if (c.type === 'DIRECT') return 'Goes after the same audience with comparable niche and format signals.';
  if (c.type === 'FAST GROWING') return 'Small or mid channel with recent traction: useful for spotting packaging that is breaking out now.';
  if (c.type === 'ASPIRATIONAL') return 'Large channel that works as a blueprint for format, cadence and packaging.';
  return 'Nearby niche, useful for transferable angles, hooks and subtopics.';
}

function scanLearnFromCompetitor(c) {
  var format = (c.formats || []).slice(0, 2).join(' + ') || 'format';
  return 'Study its ' + format + ' structure, the repeated topics and how it turns curiosity into clicks.';
}

/* Markdown fallback renderer */
function scanRenderMd(text, container) {
  container.innerHTML = '';
  var lines = text.split('\n'), ul = null, p = null;
  function flushUl(){ if(ul){ container.appendChild(ul); ul=null; } }
  function flushP(){ if(p&&p.childNodes.length){ container.appendChild(p); p=null; } }
  lines.forEach(function(line){
    var s = line.trim();
    if(!s){ flushUl(); flushP(); return; }
    if(s.match(/^#{1,3} /)){ flushUl(); flushP(); var h=document.createElement('h3'); h.innerHTML=scanFmtInline(s.replace(/^#+\s+/,'')); container.appendChild(h); }
    else if(s.match(/^[-*-] /)){ flushP(); if(!ul) ul=document.createElement('ul'); var li=document.createElement('li'); li.innerHTML=scanFmtInline(s.replace(/^[-*-] /,'')); ul.appendChild(li); }
    else if(s.match(/^\d+\. /)){ flushP(); if(!ul||ul.tagName!=='OL'){ flushUl(); ul=document.createElement('ol'); } var oli=document.createElement('li'); oli.innerHTML=scanFmtInline(s.replace(/^\d+\. /,'')); ul.appendChild(oli); }
    else{ flushUl(); if(!p) p=document.createElement('p'); var sp=document.createElement('span'); sp.innerHTML=scanFmtInline(s)+' '; p.appendChild(sp); }
  });
  flushUl(); flushP();
}

/* SNAPSHOT renderer */
function renderSnapshot(text, container) {
  container.innerHTML = '';
  var oport  = extractField(text,'KEY_OPPORTUNITY') || extractField(text,'OPPORTUNITY');
  var posit  = extractField(text,'POSITIONING') || extractField(text,'PROPOSAL');
  var nicho  = extractField(text,'EXACT_NICHE');
  var model  = extractField(text,'CONTENT_MODEL');
  var growth = extractField(text,'GROWTH_PATTERN');
  if (!oport && !posit && !nicho) { scanRenderMd(text, container); return; }

  if (oport) {
    var h = document.createElement('div'); h.className = 'scan-hero-box';
    var hl = document.createElement('div'); hl.className = 'scan-hero-lbl'; hl.textContent = 'KEY OPPORTUNITY';
    var hv = document.createElement('div'); hv.className = 'scan-hero-txt'; hv.textContent = oport;
    h.appendChild(hl); h.appendChild(hv); container.appendChild(h);
  }

  if (nicho || growth) {
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px';
    if (nicho) {
      var nBox = document.createElement('div'); nBox.className = 'scan-hero-box'; nBox.style.flex = '1';
      var nLbl = document.createElement('div'); nLbl.className = 'scan-hero-lbl'; nLbl.textContent = 'EXACT NICHE';
      var nVal = document.createElement('div'); nVal.className = 'scan-hero-txt'; nVal.style.fontSize = '13px'; nVal.textContent = nicho;
      nBox.appendChild(nLbl); nBox.appendChild(nVal);
      if (model) { var mB = document.createElement('div'); mB.className = 'scan-model-badge'; mB.textContent = model.split('-')[0].split('/')[0].trim(); nBox.appendChild(mB); }
      row.appendChild(nBox);
    }
    if (growth) {
      var gBox = document.createElement('div'); gBox.className = 'scan-hero-box';
      var gLbl = document.createElement('div'); gLbl.className = 'scan-hero-lbl'; gLbl.textContent = 'GROWTH PATTERN';
      var gBase = growth.split('(')[0].split('-')[0].trim();
      var gLow = gBase.toLowerCase();
      var gCls = gLow.includes('explos') ? 'explosivo' : gLow.includes('decay') ? 'decayendo' : 'estable';
      var gBadge = document.createElement('div'); gBadge.className = 'scan-growth-badge ' + gCls; gBadge.textContent = gBase;
      var gRest = growth.replace(gBase,'').replace(/^[\s--(]/,'').replace(/\)$/,'').trim();
      gBox.appendChild(gLbl); gBox.appendChild(gBadge);
      if (gRest) { var gSub = document.createElement('div'); gSub.style.cssText = 'font-size:11px;color:var(--muted);margin-top:6px;line-height:1.55'; gSub.textContent = gRest; gBox.appendChild(gSub); }
      row.appendChild(gBox);
    }
    if (row.children.length) container.appendChild(row);
  }

  if (posit) {
    var pb = document.createElement('div'); pb.className = 'scan-hero-box';
    var pl = document.createElement('div'); pl.className = 'scan-hero-lbl'; pl.textContent = 'UNIQUE POSITIONING';
    var pv = document.createElement('div'); pv.className = 'scan-hero-txt'; pv.textContent = posit;
    pb.appendChild(pl); pb.appendChild(pv); container.appendChild(pb);
  }

  var SNAP_FIELDS = [
    {key:'AUDIENCE',lbl:'Target audience'},{key:'AUDIENCE_PSYCHOLOGY',lbl:'Audience psychology'},
    {key:'MONETIZATION',lbl:'Monetization and RPM'},{key:'STRENGTHS',lbl:'Strengths'},
    {key:'WEAKNESSES',lbl:'Weaknesses'},{key:'ETAPA',lbl:'Growth stage'},
    {key:'VIRAL_POTENCIAL',lbl:'Viral potential'}
  ];
  var grid = document.createElement('div'); grid.className = 'scan-info-grid';
  SNAP_FIELDS.forEach(function(f) {
    var val = extractField(text, f.key); if (!val) return;
    var card = document.createElement('div'); card.className = 'scan-info-card';
    var lbl = document.createElement('div'); lbl.className = 'scan-info-lbl'; lbl.textContent = f.lbl;
    var v = document.createElement('div'); v.className = 'scan-info-val'; v.textContent = val;
    card.appendChild(lbl); card.appendChild(v); grid.appendChild(card);
  });
  if (grid.children.length) container.appendChild(grid);
}

/* COMPETITORS renderer */
function makeCompCard(handle, name, subs, desc, threat, similarity, tag, growth) {
  var ytH = handle.startsWith('@') ? handle : '@' + handle;
  var ytUrl = 'https://www.youtube.com/' + ytH;
  var sim = parseInt(similarity) || 0;
  var card = document.createElement('div'); card.className = 'scan-comp-card';
  var left = document.createElement('div'); left.className = 'scan-comp-left';

  var topRow = document.createElement('div'); topRow.className = 'scan-comp-top-row';
  var ha = document.createElement('a'); ha.className = 'scan-comp-handle'; ha.href = ytUrl; ha.target = '_blank'; ha.textContent = ytH;
  topRow.appendChild(ha);
  if (tag) { var tg = document.createElement('div'); tg.className = 'scan-comp-tag'; tg.textContent = tag; topRow.appendChild(tg); }
  if (growth) {
    var gLow = (growth || '').toLowerCase();
    var grCls = gLow.includes('acelerado') || gLow.includes('explos') ? 'up' : gLow.includes('decay') ? 'down' : 'stable';
    var grIcon = grCls === 'up' ? 'up ' : grCls === 'down' ? 'down ' : '-> ';
    var gr = document.createElement('div'); gr.className = 'scan-comp-growth ' + grCls; gr.textContent = grIcon + growth.split('/')[0].trim();
    topRow.appendChild(gr);
  }
  left.appendChild(topRow);

  if (name && name !== handle && name !== ytH) { var nm = document.createElement('div'); nm.className = 'scan-comp-sub'; nm.textContent = name; left.appendChild(nm); }
  if (subs) { var sb = document.createElement('div'); sb.className = 'scan-comp-sub'; sb.style.marginTop = '3px'; sb.textContent = subs; left.appendChild(sb); }
  if (desc) { var ds = document.createElement('div'); ds.className = 'scan-comp-desc'; ds.textContent = desc; left.appendChild(ds); }

  if (sim > 0) {
    var sw = document.createElement('div'); sw.className = 'scan-sim-wrap';
    var sr = document.createElement('div'); sr.className = 'scan-sim-row';
    var sl = document.createElement('div'); sl.className = 'scan-sim-lbl'; sl.textContent = 'Niche similarity';
    var sp = document.createElement('div'); sp.className = 'scan-sim-pct'; sp.textContent = sim + '%';
    sr.appendChild(sl); sr.appendChild(sp); sw.appendChild(sr);
    var st = document.createElement('div'); st.className = 'scan-sim-track';
    var sf = document.createElement('div'); sf.className = 'scan-sim-fill'; sf.style.width = '0%';
    st.appendChild(sf); sw.appendChild(st); left.appendChild(sw);
    setTimeout(function() { sf.style.width = Math.min(sim, 100) + '%'; }, 200);
  }

  var right = document.createElement('div'); right.className = 'scan-comp-right';
  var tc = (threat || '').toLowerCase();
  var tcls = tc.includes('alto') ? 'alto' : tc.includes('bajo') ? 'bajo' : 'medio';
  var tb = document.createElement('div'); tb.className = 'scan-threat ' + tcls; tb.textContent = (threat || 'Medium').toUpperCase();
  var yb = document.createElement('a'); yb.className = 'scan-yt-link'; yb.href = ytUrl; yb.target = '_blank'; yb.textContent = '> View channel';
  right.appendChild(tb); right.appendChild(yb);
  card.appendChild(left); card.appendChild(right);
  return card;
}

function makeRichCompCard(c, ai) {
  c = c || {};
  ai = ai || {};
  var handle = c.handle || '';
  var ytH = handle ? (handle.startsWith('@') ? handle : '@' + handle) : '';
  var ytUrl = c.url || (ytH ? 'https://www.youtube.com/' + ytH : '#');
  var sim = parseInt(c.nicheSimilarity || ai.similarity || 0, 10) || 0;
  var score = parseInt(c.finalCompetitorScore || c.competitorScore || 0, 10) || 0;
  var type = c.type || ai.type || 'ADJACENT';
  var desc = ai.desc || c.whyMatters || c.desc || '';
  var card = document.createElement('div'); card.className = 'scan-comp-card';
  var left = document.createElement('div'); left.className = 'scan-comp-left';

  var topRow = document.createElement('div'); topRow.className = 'scan-comp-top-row';
  if (ytH) {
    var ha = document.createElement('a'); ha.className = 'scan-comp-handle'; ha.href = ytUrl; ha.target = '_blank'; ha.textContent = ytH;
    topRow.appendChild(ha);
  } else {
    var nmOnly = document.createElement('div'); nmOnly.className = 'scan-comp-handle'; nmOnly.textContent = c.name || 'Estimated space';
    topRow.appendChild(nmOnly);
  }
  var tg = document.createElement('div'); tg.className = 'scan-comp-tag'; tg.textContent = type; topRow.appendChild(tg);
  var sc = document.createElement('div'); sc.className = 'scan-comp-growth up'; sc.textContent = 'Score ' + score; topRow.appendChild(sc);
  left.appendChild(topRow);

  if (c.name && c.name !== ytH) { var nm = document.createElement('div'); nm.className = 'scan-comp-sub'; nm.textContent = c.name; left.appendChild(nm); }
  var meta = [
    c.subs ? c.subs : '',
    c.avgRecentViews ? 'Avg views ' + compactNumber(c.avgRecentViews) : '',
    c.lastVideoDays < 9999 ? 'Last video ' + c.lastVideoDays + 'd' : (c.activityLabel || ''),
    (c.formats || []).length ? (c.formats || []).slice(0, 3).join(' + ') : ''
  ].filter(Boolean).join(' | ');
  if (meta) { var sb = document.createElement('div'); sb.className = 'scan-comp-sub'; sb.style.marginTop = '3px'; sb.textContent = meta; left.appendChild(sb); }
  if (desc) { var ds = document.createElement('div'); ds.className = 'scan-comp-desc'; ds.textContent = desc; left.appendChild(ds); }

  var insight = [
    c.doesBetter ? 'Does better: ' + c.doesBetter : '',
    c.learn ? 'Learn: ' + c.learn : ''
  ].filter(Boolean).join(' ');
  if (insight) { var ins = document.createElement('div'); ins.className = 'scan-comp-desc'; ins.textContent = insight; left.appendChild(ins); }

  var sw = document.createElement('div'); sw.className = 'scan-sim-wrap';
  var sr = document.createElement('div'); sr.className = 'scan-sim-row';
  var sl = document.createElement('div'); sl.className = 'scan-sim-lbl'; sl.textContent = 'Niche similarity';
  var sp = document.createElement('div'); sp.className = 'scan-sim-pct'; sp.textContent = sim + '%';
  sr.appendChild(sl); sr.appendChild(sp); sw.appendChild(sr);
  var st = document.createElement('div'); st.className = 'scan-sim-track';
  var sf = document.createElement('div'); sf.className = 'scan-sim-fill'; sf.style.width = '0%';
  st.appendChild(sf); sw.appendChild(st); left.appendChild(sw);
  setTimeout(function() { sf.style.width = Math.min(sim, 100) + '%'; }, 200);

  var right = document.createElement('div'); right.className = 'scan-comp-right';
  var steal = c.stealPotential || 'MEDIUM';
  var tcls = steal === 'HIGH' ? 'alto' : steal === 'LOW' ? 'bajo' : 'medio';
  var tb = document.createElement('div'); tb.className = 'scan-threat ' + tcls; tb.textContent = 'STEAL ' + steal;
  right.appendChild(tb);
  if (ytH) {
    var yb = document.createElement('a'); yb.className = 'scan-yt-link'; yb.href = ytUrl; yb.target = '_blank'; yb.textContent = 'View channel';
    right.appendChild(yb);
  }
  card.appendChild(left); card.appendChild(right);
  return card;
}

function extractCompAiData(text, handle) {
  var cleanH = handle.replace(/^@/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var blockRe = new RegExp('CHANNEL:\\s*@?' + cleanH + '([\\s\\S]{0,800}?)(?=\\nCANAL:|\\n\\n##|$)', 'i');
  var bm = text.match(blockRe);
  if (!bm) return {};
  var block = bm[1];
  return {
    similarity: ((block.match(/SIMILITUD:\s*(\d+)/) || [])[1] || ''),
    growth:     ((block.match(/CRECIMIENTO:\s*([^\n]+)/) || [])[1] || '').trim(),
    tag:        ((block.match(/NICHO_TAG:\s*([^\n]+)/) || [])[1] || '').trim(),
    threat:     ((block.match(/AMENAZA:\s*([^\n]+)/) || [])[1] || 'Medio').trim(),
    desc:       ((block.match(/DESCRIPCION:\s*([^\n]+)/) || [])[1] || '').trim()
  };
}

function extractAiThreats(text) {
  var threats = {};
  if (!text) return threats;
  var re1 = /CANAL:\s*(@?[\w.-]+)[^\n]*?AMENAZA:\s*(Alto|Medio|Bajo)/gi;
  var m;
  while ((m = re1.exec(text)) !== null) threats[m[1].replace(/^@/,'').toLowerCase()] = m[2];
  var re2 = /@([\w.-]+)[^\n]{0,200}\b(Alto|Medio|Bajo)\b/gi;
  while ((m = re2.exec(text)) !== null) if (!threats[m[1].toLowerCase()]) threats[m[1].toLowerCase()] = m[2];
  return threats;
}

function extractAiDesc(text, handle) {
  if (!text) return '';
  var cleanH = handle.replace(/^@/,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  var re = new RegExp('@?' + cleanH + '([^\\n]{0,300})', 'i');
  var m = text.match(re);
  if (!m) return '';
  return m[1].replace(/^[^a-záéíóúñA-ZÁÉÍÓÚÑ]*/i,'').replace(/AMENAZA:.*$/i,'').replace(/-|-|[|]/g,'').trim().slice(0, 200);
}

function renderCompetitors(text, container) {
  container.innerHTML = '';
  var grid = document.createElement('div'); grid.className = 'scan-comp-grid';

  if (scanLastRealCompetitors && scanLastRealCompetitors.length > 0) {
    scanLastRealCompetitors.forEach(function(c) {
      var cleanH = (c.handle || '').replace(/^@/, '');
      var ai = extractCompAiData(text, cleanH);
      if (!ai.desc) ai.desc = extractAiDesc(text, cleanH);
      grid.appendChild(makeRichCompCard(c, ai));
    });
    if (grid.children.length) { container.appendChild(grid); return; }
  }

  if (scanLastEstimatedCompetitors && scanLastEstimatedCompetitors.length > 0) {
    var notice = document.createElement('div'); notice.className = 'scan-hero-box'; notice.style.marginBottom = '12px';
    var nl = document.createElement('div'); nl.className = 'scan-hero-lbl'; nl.textContent = 'NO STRONG VERIFIED COMPETITORS';
    var nv = document.createElement('div'); nv.className = 'scan-hero-txt'; nv.style.fontSize = '13px';
    nv.textContent = 'We found no strong verified competitors, but these nearby spaces showed up. They are listed apart because they fail some of the hard filters.';
    notice.appendChild(nl); notice.appendChild(nv); container.appendChild(notice);
    scanLastEstimatedCompetitors.forEach(function(c) { grid.appendChild(makeRichCompCard(c, {})); });
    container.appendChild(grid); return;
  }

  if (Array.isArray(scanLastRealCompetitors)) {
    var msg = document.createElement('div'); msg.className = 'scan-empty-state'; msg.style.padding = '30px 20px';
    var ico = document.createElement('div'); ico.className = 'scan-empty-icon'; ico.textContent = 'SC';
    var ttl = document.createElement('div'); ttl.className = 'scan-empty-ttl'; ttl.textContent = 'No verified competitors';
    var sub = document.createElement('div'); sub.className = 'scan-empty-sub';
    sub.textContent = 'No active channels were found for this niche on YouTube. The three parallel searches returned no active channel above 5K subscribers.';
    msg.appendChild(ico); msg.appendChild(ttl); msg.appendChild(sub);
    container.appendChild(msg); return;
  }
}

/* PATTERNS renderer */
var PAT_FIELDS = [
  {key:'VIDEO_FORMAT',  ico:'FV', lbl:'Video format'},
  {key:'HOOK_MODEL',    ico:'HK', lbl:'Hook model'},
  {key:'VOICE_TYPE',       ico:'VZ', lbl:'Voice and tone'},
  {key:'UPLOAD_DAY',     ico:'DY', lbl:'Publishing days'},
  {key:'UPLOAD_TIME',    ico:'HR', lbl:'Best hour'},
  {key:'OPTIMAL_LENGTH',ico:'DR', lbl:'Best length'},
  {key:'THUMBNAIL_STYLE',ico:'TH',lbl:'Thumbnail style'},
  {key:'TITLE_FORMULA', ico:'TT', lbl:'Title formula'},
  {key:'GANCHO_TIPO',    ico:'IN', lbl:'Hook and intro type'},
];
function renderPatterns(text, container) {
  container.innerHTML = '';
  var grid = document.createElement('div'); grid.className = 'scan-pat-grid';
  var hasCards = false;
  PAT_FIELDS.forEach(function(f) {
    var val = extractField(text, f.key); if (!val) return;
    hasCards = true;
    var card = document.createElement('div'); card.className = 'scan-pat-card';
    var ico = document.createElement('div'); ico.className = 'scan-pat-ico'; ico.textContent = f.ico;
    var lbl = document.createElement('div'); lbl.className = 'scan-pat-lbl'; lbl.textContent = f.lbl;
    var v = document.createElement('div'); v.className = 'scan-pat-val'; v.textContent = val;
    card.appendChild(ico); card.appendChild(lbl); card.appendChild(v); grid.appendChild(card);
  });
  if (hasCards) container.appendChild(grid);

  var hooksRaw = extractField(text,'HOOK_FORMULAS');
  if (hooksRaw) {
    var hookBox = document.createElement('div'); hookBox.className = 'scan-hook-box';
    var hookLbl = document.createElement('div'); hookLbl.className = 'scan-hero-lbl'; hookLbl.textContent = 'OPENING HOOKS THAT WORK';
    hookBox.appendChild(hookLbl);
    var hooksList = document.createElement('div'); hooksList.className = 'scan-hooks-list';
    hooksRaw.split('|').map(function(t){ return t.trim().replace(/^"+|"+$/g,''); }).filter(Boolean).forEach(function(t) {
      var hi = document.createElement('div'); hi.className = 'scan-hook-item'; hi.textContent = '"' + t + '"'; hooksList.appendChild(hi);
    });
    hookBox.appendChild(hooksList); container.appendChild(hookBox);
  }

  var titRaw = extractField(text,'VIRAL_TITLES') || extractField(text,'EXAMPLE_TITLES') || extractField(text,'TOP_TITLES');
  if (titRaw) {
    var titBox = document.createElement('div'); titBox.className = 'scan-hero-box'; titBox.style.marginTop = '14px';
    var titLbl = document.createElement('div'); titLbl.className = 'scan-hero-lbl'; titLbl.textContent = 'VIRAL TITLES FOR THIS NICHE';
    titBox.appendChild(titLbl);
    var titList = document.createElement('div'); titList.className = 'scan-titles-list';
    titRaw.split('|').map(function(t){ return t.trim().replace(/^"+|"+$/g,''); }).filter(Boolean).forEach(function(t) {
      var ti = document.createElement('div'); ti.className = 'scan-title-item'; ti.textContent = t; titList.appendChild(ti);
    });
    titBox.appendChild(titList); container.appendChild(titBox);
  }
  if (!hasCards && !hooksRaw && !titRaw) scanRenderMd(text, container);
}

/* GAPS renderer */
function renderGaps(text, container) {
  container.innerHTML='';
  var list=document.createElement('div'); list.className='scan-gap-list';
  var items=[], cur=null, num=0;
  text.split('\n').forEach(function(line){
    var s=line.trim(); if(!s) return;
    var nm=s.match(/^(\d+)\.\s*\*\*(.+?)\*\*[:\s]*(.*)/) || s.match(/^(\d+)\.\s*(.+)/);
    var bm=s.match(/^[-*-]\s+\*\*(.+?)\*\*[:\s]*(.*)/);
    if(nm){
      if(cur) items.push(cur);
      num=parseInt(nm[1]);
      cur={num:num, ttl: nm[2]||nm[2], why: nm[3]||''};
    } else if(bm && !cur){
      num++;
      if(cur) items.push(cur);
      cur={num:num, ttl:bm[1], why:bm[2]||''};
    } else if(cur && s && !s.match(/^#{1,3} /)){
      cur.why += (cur.why?' ':'')+s;
    }
  });
  if(cur) items.push(cur);
  if(!items.length){ scanRenderMd(text,container); return; }
  items.forEach(function(item){
    var card=document.createElement('div'); card.className='scan-gap-card';
    var nEl=document.createElement('div'); nEl.className='scan-gap-num'; nEl.textContent=item.num;
    var body=document.createElement('div'); body.className='scan-gap-body';
    var ttl=document.createElement('div'); ttl.className='scan-gap-ttl'; ttl.innerHTML=scanFmtInline(item.ttl);
    body.appendChild(ttl);
    if(item.why){ var why=document.createElement('div'); why.className='scan-gap-why'; why.textContent=item.why.replace(/^[:\s]+/,''); body.appendChild(why); }
    card.appendChild(nEl); card.appendChild(body); list.appendChild(card);
  });
  container.appendChild(list);
}

/* SUBNICHES renderer */
function renderSubniches(text, container) {
  container.innerHTML = '';
  var grid = document.createElement('div'); grid.className = 'scan-sub-grid';
  var blocks = text.split(/\n(?=NOMBRE:|---|\*\*\d|\d\.)/i);
  var hasCards = false;
  blocks.forEach(function(block) {
    var nombre = extractField(block,'NAME') || (block.match(/^\*\*([^*]+)\*\*/)||[])[1] || (block.match(/^\d+\.\s*\*\*([^*]+)\*\*/)||[])[1];
    if (!nombre) return;
    var pot   = extractField(block,'POTENTIAL') || '';
    var comp  = extractField(block,'COMPETITION') || '';
    var bar   = extractField(block,'BARRIER') || '';
    var trend = extractField(block,'TREND') || '';
    var why   = extractField(block,'WHY') || extractField(block,'WHY') || extractField(block,'DESCRIPTION') || '';
    var vid   = extractField(block,'FIRST_VIDEO') || '';
    hasCards = true;
    var card = document.createElement('div'); card.className = 'scan-sub-card';
    var nm = document.createElement('div'); nm.className = 'scan-sub-nm'; nm.textContent = nombre;
    var bRow = document.createElement('div'); bRow.className = 'scan-sub-badges';
    if (pot)  { var b  = document.createElement('div'); b.className  = 'scan-sub-badge pot';  b.textContent  = 'Pot: ' + pot;      bRow.appendChild(b);  }
    if (comp) { var b2 = document.createElement('div'); b2.className = 'scan-sub-badge comp'; b2.textContent = 'Comp: ' + comp;    bRow.appendChild(b2); }
    if (bar)  { var b3 = document.createElement('div'); b3.className = 'scan-sub-badge bar';  b3.textContent = 'Barrier: ' + bar;  bRow.appendChild(b3); }
    if (trend) {
      var b4 = document.createElement('div');
      var tLow = trend.toLowerCase();
      var tCls = tLow.includes('subiendo') ? 'trend-up' : tLow.includes('bajando') ? 'trend-down' : 'bar';
      var tIco = tLow.includes('subiendo') ? 'up ' : tLow.includes('bajando') ? 'down ' : '-> ';
      b4.className = 'scan-sub-badge ' + tCls; b4.textContent = tIco + trend; bRow.appendChild(b4);
    }
    card.appendChild(nm); card.appendChild(bRow);
    if (why) { var w = document.createElement('div'); w.className = 'scan-sub-why'; w.textContent = why; card.appendChild(w); }
    if (vid) { var v = document.createElement('div'); v.className = 'scan-sub-vid'; v.textContent = '> ' + vid; card.appendChild(v); }

    var savedNiches = (function(){ try { return JSON.parse(localStorage.getItem('ashlyv_saved_subniches') || '[]') || []; } catch(e){ return []; } })();
    var isSaved = savedNiches.some(function(s) { return s.nombre === nombre; });
    var saveBtn = document.createElement('button');
    saveBtn.className = 'scan-sub-save' + (isSaved ? ' saved' : '');
    saveBtn.textContent = isSaved ? 'SAVED' : '+ SAVE SUBNICHE';
    saveBtn.addEventListener('click', function() {
      var stored = (function(){ try { return JSON.parse(localStorage.getItem('ashlyv_saved_subniches') || '[]') || []; } catch(e){ return []; } })();
      var idx = stored.findIndex(function(s) { return s.nombre === nombre; });
      if (idx > -1) {
        stored.splice(idx, 1);
        saveBtn.className = 'scan-sub-save'; saveBtn.textContent = '+ SAVE SUBNICHE';
      } else {
        stored.push({ nombre: nombre, pot: pot, comp: comp, bar: bar, trend: trend, why: why, vid: vid, savedAt: Date.now() });
        saveBtn.className = 'scan-sub-save saved'; saveBtn.textContent = 'SAVED';
      }
      localStorage.setItem('ashlyv_saved_subniches', JSON.stringify(stored));
    });
    card.appendChild(saveBtn);
    grid.appendChild(card);
  });
  if (hasCards && grid.children.length) container.appendChild(grid);
  else scanRenderMd(text, container);
}

/* STRATEGY renderer */
function renderStrategy(text, container) {
  container.innerHTML = '';
  var MODES = [
    { key: 'SAFE_MODE',          label: 'SAFE',            cls: 'seguro',          ico: 'SG' },
    { key: 'AGGRESSIVE_MODE',        label: 'AGGRESSIVE',      cls: 'agresivo',        ico: 'AG' },
    { key: 'DIFFERENTIATION_MODE',  label: 'DIFFERENTIATION', cls: 'diferenciacion',  ico: 'DF' }
  ];
  var modeKeys = MODES.map(function(m){ return m.key; }).join('|');
  var modeRe = new RegExp('(' + modeKeys + '):\\s*', 'i');
  var found = false;

  if (modeRe.test(text)) {
    var grid = document.createElement('div'); grid.className = 'scan-strats-grid';
    MODES.forEach(function(mode) {
      var bRe = new RegExp(mode.key + ':\\s*([\\s\\S]{0,1400}?)(?=' + modeKeys.replace(/\|/g,':|') + ':|##|$)', 'i');
      var bm = text.match(bRe);
      if (!bm) return;
      found = true;
      var block = bm[1];
      var titulo = extractField(block,'TITLE') || mode.label;
      var descr  = extractField(block,'DESCRIPTION') || '';
      var riesgo = extractField(block,'RISK') || '';
      var recomp = extractField(block,'REWARD') || '';
      var tiempo = extractField(block,'TIME') || '';
      var acts = [];
      block.split('\n').forEach(function(line) {
        var s = line.trim();
        if (s.match(/^[-*-]\s/) && s.length > 10 && !s.match(/^(TITULO|DESCRIPCION|RIESGO|RECOMPENSA|TIEMPO):/i))
          acts.push(s.replace(/^[-*-]\s+/, ''));
      });
      var card = document.createElement('div'); card.className = 'scan-strat-card ' + mode.cls;
      var head = document.createElement('div'); head.className = 'scan-strat-head';
      var icoEl = document.createElement('div'); icoEl.className = 'scan-strat-ico'; icoEl.textContent = mode.ico;
      var hdrTxt = document.createElement('div'); hdrTxt.className = 'scan-strat-hdr-txt';
      var mLbl = document.createElement('div'); mLbl.className = 'scan-strat-mode-lbl ' + mode.cls; mLbl.textContent = 'MODE ' + mode.label;
      var tEl = document.createElement('div'); tEl.className = 'scan-strat-ttl'; tEl.textContent = titulo;
      hdrTxt.appendChild(mLbl); hdrTxt.appendChild(tEl);
      head.appendChild(icoEl); head.appendChild(hdrTxt); card.appendChild(head);
      if (descr) { var dc = document.createElement('div'); dc.className = 'scan-strat-desc'; dc.textContent = descr; card.appendChild(dc); }
      if (acts.length) {
        var ad = document.createElement('div'); ad.className = 'scan-strat-acts';
        acts.forEach(function(a) { var ac = document.createElement('div'); ac.className = 'scan-strat-act'; ac.textContent = a; ad.appendChild(ac); });
        card.appendChild(ad);
      }
      if (riesgo || recomp || tiempo) {
        var footer = document.createElement('div'); footer.className = 'scan-strat-footer';
        if (riesgo) { var rp = document.createElement('div'); rp.className = 'scan-strat-pill'; rp.textContent = 'Risk: ' + riesgo; footer.appendChild(rp); }
        if (recomp) { var rep = document.createElement('div'); rep.className = 'scan-strat-pill'; rep.textContent = 'Reward: ' + recomp; footer.appendChild(rep); }
        if (tiempo) { var tp = document.createElement('div'); tp.className = 'scan-strat-pill'; tp.textContent = tiempo; footer.appendChild(tp); }
        card.appendChild(footer);
      }
      grid.appendChild(card);
    });
    if (found) { container.appendChild(grid); return; }
  }

  // Fallback: legacy FASE_ format
  var list = document.createElement('div'); list.className = 'scan-phase-list';
  var phases = [], phaseBlocks = text.split(/\n(?=FASE_\d+:|FASE \d+:|Fase \d+:)/i);
  phaseBlocks.forEach(function(block, idx) {
    if (!block.match(/FASE_?\d+:|Fase \d+:/i) && idx !== 0) return;
    var ttl = extractField(block,'TITLE') || 'Phase ' + (idx+1);
    var dias = extractField(block,'DAYS') || '';
    var kpi = extractField(block,'KPI') || '';
    var acts = [];
    block.split('\n').forEach(function(line) {
      var s = line.trim();
      if (s.match(/^[-*-]\s/) && s.length > 12) acts.push(s.replace(/^[-*-]\s+/, ''));
    });
    if (acts.length || ttl) phases.push({ idx: idx+1, ttl: ttl.replace(/\*\*/g,''), dias, acts, kpi });
  });
  if (!phases.length) { scanRenderMd(text, container); return; }
  phases.forEach(function(ph) {
    var card = document.createElement('div'); card.className = 'scan-phase-card';
    var hd = document.createElement('div'); hd.className = 'scan-phase-head';
    var num = document.createElement('div'); num.className = 'scan-phase-num'; num.textContent = ph.idx;
    var tEl = document.createElement('div'); tEl.className = 'scan-phase-ttl'; tEl.textContent = ph.ttl;
    hd.appendChild(num); hd.appendChild(tEl);
    if (ph.dias) { var dEl = document.createElement('div'); dEl.className = 'scan-phase-days'; dEl.textContent = ph.dias; hd.appendChild(dEl); }
    card.appendChild(hd);
    if (ph.acts.length) {
      var ad = document.createElement('div'); ad.className = 'scan-phase-acts';
      ph.acts.forEach(function(a) { var ac = document.createElement('div'); ac.className = 'scan-phase-act'; ac.textContent = a; ad.appendChild(ac); });
      card.appendChild(ad);
    }
    if (ph.kpi) { var ke = document.createElement('div'); ke.className = 'scan-phase-kpi'; ke.textContent = 'KPI: ' + ph.kpi; card.appendChild(ke); }
    list.appendChild(card);
  });
  container.appendChild(list);
}

/* SCORES renderer */
var SCORE_LABELS = {
  POTENCIAL_NICHO:      'Niche Potential',
  NIVEL_COMPETENCIA:    'Competition Level',
  RENTABILIDAD:         'Profitability',
  VELOCIDAD_CRECIMIENTO:'Growth Speed',
  FACILIDAD_ENTRADA:    'Ease Of Entry',
  SATURACION:           'Market Saturation'
};
Object.assign(SCORE_LABELS, {
  MARKET_OPPORTUNITY_SCORE: 'Market Opportunity',
  COMPETITION_DIFFICULTY: 'Competition Difficulty',
  CONTENT_GAP_SCORE: 'Content Gap',
  FACELESS_SCALABILITY_SCORE: 'Faceless Scalability',
  GROWTH_POTENTIAL_SCORE: 'Growth Potential',
  MONETIZATION_POTENTIAL: 'Monetization Potential',
  EXECUTION_DIFFICULTY: 'Execution Difficulty'
});
function scanRenderScores(text, container) {
  container.innerHTML = '';
  var scores = {};
  text.split('\n').forEach(function(line) {
    var m = line.match(/^[-*-]?\s*(POTENCIAL_NICHO|NIVEL_COMPETENCIA|RENTABILIDAD|VELOCIDAD_CRECIMIENTO|FACILIDAD_ENTRADA|SATURACION|MARKET_OPPORTUNITY_SCORE|COMPETITION_DIFFICULTY|CONTENT_GAP_SCORE|FACELESS_SCALABILITY_SCORE|GROWTH_POTENTIAL_SCORE|MONETIZATION_POTENTIAL|EXECUTION_DIFFICULTY)\s*[:\-]\s*(\d+)/i);
    if (m) scores[m[1].toUpperCase()] = parseInt(m[2]);
    var v = line.match(/VEREDICTO\s*[:\-]\s*(.+)/i);
    if (v) scores.__VEREDICTO = v[1].trim();
  });
  var keys = ['MARKET_OPPORTUNITY_SCORE','COMPETITION_DIFFICULTY','CONTENT_GAP_SCORE','FACELESS_SCALABILITY_SCORE','GROWTH_POTENTIAL_SCORE','MONETIZATION_POTENTIAL','EXECUTION_DIFFICULTY','NICHE_POTENTIAL','COMPETITION_LEVEL','PROFITABILITY','GROWTH_SPEED','ENTRY_EASE','SATURATION'];
  var hasScores = keys.some(function(k){ return k in scores; });
  if (!hasScores) { scanRenderMd(text, container); return; }
  var grid = document.createElement('div'); grid.className = 'scan-score-grid';
  keys.forEach(function(key) {
    if (!(key in scores)) return;
    var val = scores[key];
    var card = document.createElement('div'); card.className = 'scan-score-card';
    var lbl = document.createElement('div'); lbl.className = 'scan-score-lbl'; lbl.textContent = SCORE_LABELS[key];
    var num = document.createElement('div'); num.className = 'scan-score-num'; num.textContent = val;
    var track = document.createElement('div'); track.className = 'scan-score-track';
    var fill = document.createElement('div'); fill.className = 'scan-score-fill'; fill.style.width = '0%';
    track.appendChild(fill); card.appendChild(lbl); card.appendChild(num); card.appendChild(track);
    grid.appendChild(card);
    setTimeout(function() { fill.style.width = val + '%'; }, 150);
  });
  container.appendChild(grid);
  if (scores.__VEREDICTO) {
    var vb = document.createElement('div'); vb.className = 'scan-verdict-box';
    var vl = document.createElement('div'); vl.className = 'scan-verdict-lbl'; vl.textContent = 'FINAL VERDICT';
    var vt = document.createElement('div'); vt.className = 'scan-verdict-txt'; vt.textContent = scores.__VEREDICTO;
    vb.appendChild(vl); vb.appendChild(vt); container.appendChild(vb);
  }
}

/* Section routing */
function scanParseSections(report) {
  var result={};
  report.split(/^## /m).forEach(function(part){
    var nl=part.indexOf('\n'); if(nl===-1) return;
    result[part.slice(0,nl).trim().toUpperCase()]=part.slice(nl+1).trim();
  });
  return result;
}
var SCAN_SECTION_MAP={
  snapshot:    ['SNAPSHOT','GENERAL','OVERVIEW','PANORAMA'],
  competitors: ['COMPETIDORES','COMPETITORS','COMPETITION'],
  patterns:    ['PATRONES','PATTERNS','CONTENIDO'],
  gaps:        ['GAPS','OPORTUNIDADES','GAP'],
  subniches:   ['SUBNICHOS','SUBNICHES','SUB-NICHOS'],
  strategy:    ['ESTRATEGIA','STRATEGY','PLAN'],
  scores:      ['SCORES','SCORE','EVALUACION','EVALUACIÓN']
};
function scanFindSection(sections, tabKey) {
  var aliases=SCAN_SECTION_MAP[tabKey]||[tabKey.toUpperCase()];
  for(var i=0;i<aliases.length;i++) for(var sk in sections) if(sk.indexOf(aliases[i])!==-1) return sections[sk];
  return null;
}

var SECTION_RENDERERS = {
  snapshot: renderSnapshot,
  competitors: renderCompetitors,
  patterns: renderPatterns,
  gaps: renderGaps,
  subniches: renderSubniches,
  strategy: renderStrategy,
  scores: scanRenderScores
};

function scanRenderResults(report) {
  scanSections = scanParseSections(report);
  ['snapshot','competitors','patterns','gaps','subniches','strategy','scores'].forEach(function(tab) {
    var content = scanFindSection(scanSections, tab);
    var el = document.getElementById('sc-' + tab);
    if (!content || !el) return;
    var renderer = SECTION_RENDERERS[tab] || scanRenderMd;
    renderer(content, el);
  });
  scanSetTab('snapshot');
  scanShowState('results');
}

function saveScanChannelReport(handle, lang, report) {
  var item = {
    handle: '@' + scanNormalizeHandle(handle),
    language: lang || 'auto',
    report: report || '',
    competitors: scanLastRealCompetitors || [],
    estimatedCompetitors: scanLastEstimatedCompetitors || [],
    meta: scanLastScanMeta || {},
    createdAt: Date.now()
  };
  try {
    var local = JSON.parse(localStorage.getItem('ashlyv_scan_reports_v1') || '[]');
    local.unshift(item);
    localStorage.setItem('ashlyv_scan_reports_v1', JSON.stringify(local.slice(0, 30)));
    localStorage.setItem('ashlyv_recent_languages_v1', JSON.stringify([lang].concat(JSON.parse(localStorage.getItem('ashlyv_recent_languages_v1') || '[]')).filter(function(code, idx, arr) { return code && arr.indexOf(code) === idx; }).slice(0, 12)));
  } catch (e) {}
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.get(['ashlyv_scan_reports_v1', 'ashlyv_channel_scan_history_v1'], function(res) {
        var reports = Array.isArray(res.ashlyv_scan_reports_v1) ? res.ashlyv_scan_reports_v1 : [];
        var history = Array.isArray(res.ashlyv_channel_scan_history_v1) ? res.ashlyv_channel_scan_history_v1 : [];
        reports.unshift(item);
        history.unshift({ handle: item.handle, language: item.language, createdAt: item.createdAt, competitorCount: item.competitors.length });
        chrome.storage.local.set({
          ashlyv_scan_reports_v1: reports.slice(0, 40),
          ashlyv_channel_scan_history_v1: history.slice(0, 80),
          ashlyv_competitor_favorites_v1: res.ashlyv_competitor_favorites_v1 || [],
          ashlyv_saved_gaps_v1: res.ashlyv_saved_gaps_v1 || [],
          ashlyv_generated_strategies_v1: res.ashlyv_generated_strategies_v1 || []
        });
      });
    } catch (e2) {}
  }
}

/* YouTube real-data extractors */

function scanSetLoadMsg(txt) {
  var el = document.getElementById('scan-load-sub-txt');
  if (el) el.textContent = txt;
}

function scanSetStage(idx) {
  for (var i = 0; i < 4; i++) {
    var el = document.getElementById('scan-stage-' + i);
    if (!el) continue;
    el.className = 'scan-stage' + (i < idx ? ' done' : i === idx ? ' active' : '');
    var dot = el.querySelector('.stage-dot');
    if (dot) dot.textContent = i < idx ? 'OK' : '.';
  }
}

function extractYtChannels(html, originalHandle) {
  var channels = [];
  var seen = new Set([('@' + originalHandle).toLowerCase()]);

  function addChannel(hdl, nm, sb, ds) {
    var key = hdl.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    channels.push({ handle: hdl, name: nm || hdl.slice(1), subs: sb || '', desc: (ds || '').slice(0, 130) });
  }

  // Phase 1: channelRenderer blocks (channel-filtered search results)
  var pos = 0;
  while (channels.length < 10) {
    var idx = html.indexOf('"channelRenderer":', pos);
    if (idx === -1) break;
    pos = idx + 20;
    // Grab a generous chunk - thumbnail arrays can be 5-8KB
    var chunk = html.slice(idx, idx + 12000);
    var hm = chunk.match(/"canonicalBaseUrl":"(\/@[\w.-]+)"/);
    if (!hm) continue;
    var nm = (chunk.match(/"title":\{"simpleText":"([^"]{1,80})"/) || [])[1] || '';
    var sb = (chunk.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/) || [])[1] || '';
    var ds = (chunk.match(/"descriptionSnippet":\{"runs":\[\{"text":"([^"]+)"/) || [])[1] || '';
    addChannel(hm[1].slice(1), nm, sb, ds);
  }

  // Phase 2: shortBylineText / ownerText in video renderers (plain video search)
  var vpos = 0;
  while (channels.length < 12) {
    var vi = html.indexOf('"shortBylineText":', vpos);
    if (vi === -1) vi = html.indexOf('"ownerText":', vpos);
    if (vi === -1) break;
    vpos = vi + 20;
    var vc = html.slice(vi, vi + 1200);
    var vm = vc.match(/"canonicalBaseUrl":"(\/@[\w.-]+)"/);
    if (!vm) continue;
    var vnm = (vc.match(/"text":"([^"]{2,80})"/) || [])[1] || '';
    addChannel(vm[1].slice(1), vnm, '', '');
  }

  return channels;
}

function scanExtractVideoData(html, limit) {
  var videos = [];
  var seen = {};
  var pos = 0;
  while (videos.length < (limit || 12)) {
    var idx = html.indexOf('"videoRenderer":', pos);
    if (idx === -1) break;
    pos = idx + 16;
    var chunk = html.slice(idx, idx + 9000);
    var title = (chunk.match(/"title":\{"runs":\[\{"text":"([^"]{6,160})"/) || [])[1]
      || (chunk.match(/"title":\{"simpleText":"([^"]{6,160})"/) || [])[1]
      || '';
    if (!title || title.indexOf('\\u') >= 0 || seen[title]) continue;
    seen[title] = true;
    var viewsText = (chunk.match(/"viewCountText":\{"simpleText":"([^"]+)"/) || [])[1]
      || (chunk.match(/"shortViewCountText":\{"simpleText":"([^"]+)"/) || [])[1]
      || '';
    var ageText = (chunk.match(/"publishedTimeText":\{"simpleText":"([^"]+)"/) || [])[1] || '';
    videos.push({
      title: title,
      viewsText: viewsText,
      views: scanParseViews(viewsText),
      ageText: ageText,
      ageDays: scanAgeToDays(ageText)
    });
  }
  return videos;
}

function scanBuildChannelUrl(handle) {
  var h = String(handle || '').trim();
  if (!h) return '';
  if (/^https?:\/\//i.test(h)) return h;
  h = h.replace(/^@/, '');
  return 'https://www.youtube.com/@' + encodeURIComponent(h);
}

function scanNormalizeHandle(input) {
  var raw = String(input || '').trim();
  var m = raw.match(/youtube\.com\/@([^/?#]+)/i);
  if (m) return m[1];
  return raw.replace(/^@/, '').replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').replace(/[/?#].*$/, '');
}

var youtubeProvider = {
  getChannelByUrl: async function(handleOrUrl, lang) {
    var handle = scanNormalizeHandle(handleOrUrl);
    var url = scanBuildChannelUrl(handle);
    var resp = await fetch(url, { headers: { 'Accept-Language': lang || 'es,en;q=0.8' } });
    var html = await resp.text();
    var name = (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || handle;
    var desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
    var subs = (html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/) || [])[1] || '';
    var vids = (html.match(/"videosCountText":\{"runs":\[\{"text":"([^"]+)"/) || [])[1] || '';
    var kwds = (html.match(/<meta name="keywords" content="([^"]+)"/) || [])[1] || '';
    var channelId = (html.match(/"channelId":"([^"]+)"/) || [])[1] || '';
    var videos = scanExtractVideoData(html, 18);
    return { handle: '@' + handle, url: url, name: name, desc: desc, subs: subs, subsNum: parseSubCount(subs), vids: vids, kwds: kwds, channelId: channelId, videos: videos, html: html };
  },
  getRecentVideos: async function(handleOrUrl, lang) {
    var handle = scanNormalizeHandle(handleOrUrl);
    var url = scanBuildChannelUrl(handle).replace(/\/$/, '') + '/videos';
    try {
      var resp = await fetch(url, { headers: { 'Accept-Language': lang || 'es,en;q=0.8' } });
      var html = await resp.text();
      return scanExtractVideoData(html, 18);
    } catch (e) {
      return [];
    }
  },
  searchChannels: async function(query, originalHandle, lang) {
    var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=EgIQAg%3D%3D';
    var resp = await fetch(url, { headers: { 'Accept-Language': lang || 'es,en;q=0.8' } });
    return extractYtChannels(await resp.text(), originalHandle || '');
  },
  searchVideos: async function(query, originalHandle, lang) {
    var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    var resp = await fetch(url, { headers: { 'Accept-Language': lang || 'es,en;q=0.8' } });
    return extractYtChannels(await resp.text(), originalHandle || '');
  },
  getVideoStats: function(video) {
    return {
      views: toNumber(video && video.views),
      ageDays: toNumber(video && video.ageDays)
    };
  }
};

function scanBuildNicheProfile(info, selectedLang) {
  info = info || {};
  var text = [info.name, info.desc, info.kwds].concat((info.videos || []).map(function(v) { return v.title; })).join(' ');
  var tokens = scanTokens(text).slice(0, 18);
  var formats = scanDetectFormats(text, info.videos || []);
  var languageCode = selectedLang || (engine && engine.languageEngine && engine.languageEngine.detectLanguage ? engine.languageEngine.detectLanguage(text) : 'auto');
  return {
    text: text,
    tokens: tokens,
    formats: formats,
    languageCode: languageCode,
    nicheId: engine && engine.nicheScoring ? engine.nicheScoring.inferNicheIdFromText(text) : 'general',
    queryCore: tokens.slice(0, 5).join(' ') || info.name || ''
  };
}

function scanBuildSearchQueries(info, profile, selectedLang) {
  var base = profile.queryCore || info.name || '';
  var nicheLabel = profile.nicheId && engine && engine.nicheScoring && engine.nicheScoring.getNiche
    ? ((engine.nicheScoring.getNiche(profile.nicheId) || {}).label || '')
    : '';
  var format = (profile.formats || []).filter(function(f) { return f !== 'evergreen'; }).slice(0, 2).join(' ');
  var queries = [
    base + ' channel',
    base + ' ' + format,
    nicheLabel + ' ' + format,
    base + ' documentary',
    base + ' faceless'
  ].map(function(q) { return q.trim().replace(/\s+/g, ' '); }).filter(Boolean);
  if (engine && engine.languageEngine && engine.languageEngine.buildQueryForNiche && profile.nicheId) {
    queries.push(engine.languageEngine.buildQueryForNiche(selectedLang || 'auto', profile.nicheId));
  }
  return queries.filter(function(item, idx, arr) { return item && arr.indexOf(item) === idx; }).slice(0, 7);
}

function scanScoreCompetitor(candidate, targetInfo, targetProfile, selectedLang, relaxLevel) {
  var videos = candidate.videos || [];
  var recentVideos = videos.filter(function(v) { return toNumber(v.ageDays) <= 90; });
  var avgRecentViews = Math.round(avg(recentVideos.map(function(v) { return toNumber(v.views); })));
  var lastVideoDays = videos.length ? Math.min.apply(null, videos.map(function(v) { return toNumber(v.ageDays) || 9999; })) : 9999;
  var compText = [candidate.name, candidate.desc, candidate.kwds].concat(videos.map(function(v) { return v.title; })).join(' ');
  var formats = scanDetectFormats(compText, videos);
  var nicheSimilarity = scanTokenSimilarity(targetProfile.text, compText);
  var formatSimilarity = scanFormatSimilarity(targetProfile.formats, formats);
  var performanceScore = scanPerformanceScore(avgRecentViews, candidate.subsNum, recentVideos);
  var recencyScore = scanRecencyScore(lastVideoDays, recentVideos);
  var strategicValueScore = scanStrategicValueScore(formats, recentVideos, avgRecentViews);
  var finalCompetitorScore = Math.round(
    nicheSimilarity * SCAN_COMPETITOR_WEIGHTS.nicheSimilarity +
    formatSimilarity * SCAN_COMPETITOR_WEIGHTS.formatSimilarity +
    performanceScore * SCAN_COMPETITOR_WEIGHTS.performanceScore +
    recencyScore * SCAN_COMPETITOR_WEIGHTS.recencyScore +
    strategicValueScore * SCAN_COMPETITOR_WEIGHTS.strategicValueScore
  );
  var languageOk = scanDetectSelectedLanguage(selectedLang, compText);
  var isNewFast = candidate.subsNum && candidate.subsNum < 50000 && avgRecentViews >= 3500 && performanceScore >= 70 && recencyScore >= 70;
  var minViews = relaxLevel ? 750 : SCAN_HARD_FILTERS.minRecentAvgViews;
  var minVideos = relaxLevel ? 3 : SCAN_HARD_FILTERS.minRecentVideos;
  var minSimilarity = relaxLevel ? 48 : SCAN_HARD_FILTERS.minNicheSimilarity;
  var rejectReasons = [];
  if (lastVideoDays > SCAN_HARD_FILTERS.maxLastVideoDays) rejectReasons.push('inactive_90d');
  if (recentVideos.length < minVideos) rejectReasons.push('low_recent_video_count');
  if (avgRecentViews < minViews && !isNewFast) rejectReasons.push('low_recent_views');
  if (!languageOk) rejectReasons.push('language_mismatch');
  if (nicheSimilarity < minSimilarity) rejectReasons.push('low_niche_similarity');
  if (!candidate.name && !candidate.handle) rejectReasons.push('unclear_channel');
  var type = rejectReasons.length ? '' : scanCompetitorType(finalCompetitorScore, candidate.subsNum, targetInfo.subsNum, performanceScore, recencyScore, nicheSimilarity, formatSimilarity);
  if (!type) rejectReasons.push('no_useful_category');
  return Object.assign({}, candidate, {
    videos: videos,
    recentVideos: recentVideos,
    avgRecentViews: avgRecentViews,
    lastVideoDays: lastVideoDays,
    nicheSimilarity: nicheSimilarity,
    formatSimilarity: formatSimilarity,
    performanceScore: performanceScore,
    recencyScore: recencyScore,
    strategicValueScore: strategicValueScore,
    finalCompetitorScore: finalCompetitorScore,
    competitorScore: finalCompetitorScore,
    type: type,
    formats: formats,
    languageOk: languageOk,
    stealPotential: scanStealPotential(finalCompetitorScore, strategicValueScore, type),
    whyMatters: '',
    doesBetter: '',
    learn: '',
    rejectReasons: rejectReasons,
    verified: rejectReasons.length === 0
  });
}

async function scanHydrateCandidate(candidate, selectedLang) {
  var handle = scanNormalizeHandle(candidate.handle || candidate.channelUrl || candidate.url || '');
  if (!handle) return null;
  try {
    var info = await youtubeProvider.getChannelByUrl(handle, selectedLang);
    var videos = info.videos && info.videos.length >= 5 ? info.videos : await youtubeProvider.getRecentVideos(handle, selectedLang);
    return Object.assign({}, candidate, info, { videos: videos, handle: info.handle || ('@' + handle), url: info.url || scanBuildChannelUrl(handle) });
  } catch (e) {
    return Object.assign({}, candidate, { handle: '@' + handle, url: scanBuildChannelUrl(handle), videos: [] });
  }
}

async function findUsefulCompetitors(targetInfo, selectedLang) {
  var targetProfile = scanBuildNicheProfile(targetInfo, selectedLang);
  var queries = scanBuildSearchQueries(targetInfo, targetProfile, selectedLang);
  var raw = [];
  var seen = {};
  var searchJobs = [];
  queries.forEach(function(query, idx) {
    searchJobs.push(youtubeProvider.searchChannels(query, scanNormalizeHandle(targetInfo.handle), selectedLang));
    if (idx < 4) searchJobs.push(youtubeProvider.searchVideos(query, scanNormalizeHandle(targetInfo.handle), selectedLang));
  });
  var results = await Promise.allSettled(searchJobs);
  results.forEach(function(res) {
    if (res.status !== 'fulfilled') return;
    (res.value || []).forEach(function(c) {
      var key = String(c.handle || '').toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      raw.push(c);
    });
  });

  var hydrated = [];
  for (var i = 0; i < raw.length && hydrated.length < 24; i++) {
    var item = await scanHydrateCandidate(raw[i], selectedLang);
    if (item) hydrated.push(item);
  }

  var scored = hydrated.map(function(c) { return scanScoreCompetitor(c, targetInfo, targetProfile, selectedLang, 0); });
  var verified = scored.filter(function(c) { return c.verified; });
  if (verified.length < 4) {
    verified = scored.map(function(c) { return scanScoreCompetitor(c, targetInfo, targetProfile, selectedLang, 1); }).filter(function(c) { return c.verified; });
  }
  verified = verified.sort(function(a, b) { return b.finalCompetitorScore - a.finalCompetitorScore; }).slice(0, 8).map(function(c) {
    c.whyMatters = scanWhyCompetitorMatters(c);
    c.doesBetter = c.performanceScore >= 72 ? 'Better proof of recent demand and packaging that earns more clicks.' : 'Clearer format or a better positioned subtopic.';
    c.learn = scanLearnFromCompetitor(c);
    return c;
  });

  var estimated = buildEstimatedCompetitorSpaces(targetInfo, targetProfile, selectedLang, scored, queries);
  return { verified: verified, estimated: estimated, rejected: scored.filter(function(c) { return !c.verified; }).slice(0, 12), profile: targetProfile, queries: queries };
}

function buildEstimatedCompetitorSpaces(targetInfo, targetProfile, selectedLang, rejected, queries) {
  var niche = targetProfile.nicheId && engine && engine.nicheScoring && engine.nicheScoring.getNiche
    ? ((engine.nicheScoring.getNiche(targetProfile.nicheId) || {}).label || targetProfile.queryCore)
    : targetProfile.queryCore;
  var formats = (targetProfile.formats || ['documental']).slice(0, 2).join(' + ');
  var related = (targetProfile.tokens || []).slice(0, 6);
  var candidates = [
    {
      name: niche + ' - active mid-size channels',
      handle: '',
      type: 'ESTIMATED',
      finalCompetitorScore: 62,
      nicheSimilarity: 58,
      formats: targetProfile.formats || [],
      activityLabel: 'not verified yet',
      avgRecentViews: 0,
      whyMatters: 'Not enough strong verified competitors were found. Search this nearby space with niche keywords.',
      doesBetter: 'Can reveal entry angles without polluting the verified list.',
      learn: 'Search: ' + (queries[0] || related.join(' ')),
      stealPotential: 'MEDIUM'
    },
    {
      name: formats + ' in ' + getLanguageLabel(selectedLang || 'auto'),
      handle: '',
      type: 'ESTIMATED',
      finalCompetitorScore: 59,
      nicheSimilarity: 55,
      formats: targetProfile.formats || [],
      activityLabel: 'similar format',
      avgRecentViews: 0,
      whyMatters: 'Useful for studying structure even when the exact niche has low visibility.',
      doesBetter: 'Check length, hooks and thumbnail before copying topics.',
      learn: 'Search similar formats with: ' + related.slice(0, 4).join(' '),
      stealPotential: 'LOW'
    }
  ];
  var nearMiss = (rejected || []).filter(function(c) {
    return c.nicheSimilarity >= 45 && c.recencyScore >= 45;
  }).sort(function(a, b) { return b.finalCompetitorScore - a.finalCompetitorScore; }).slice(0, 2).map(function(c) {
    return Object.assign({}, c, {
      type: 'ESTIMATED',
      verified: false,
      whyMatters: 'Close, but it fails some hard filters: ' + (c.rejectReasons || []).join(', ') + '.',
      stealPotential: 'LOW'
    });
  });
  return nearMiss.concat(candidates).slice(0, 4);
}

async function fetchYTRealData(handle) {
  var info = null;
  var competitors = [];
  var estimatedCompetitors = [];
  var videoTitles = [];
  var meta = null;

  try {
    scanSetStage(0);
    scanSetLoadMsg('Scanning @' + handle + ' on YouTube');
    var langCode = (document.getElementById('scan-lang-sel') || {}).value || 'auto';
    var locale = getYouTubeLocale(langCode);
    info = await youtubeProvider.getChannelByUrl(handle, locale.hl + ',en;q=0.8');
    if (!info.videos || info.videos.length < 5) {
      info.videos = await youtubeProvider.getRecentVideos(handle, locale.hl + ',en;q=0.8');
    }
    videoTitles = (info.videos || []).map(function(v) { return v.title; }).filter(Boolean).slice(0, 15);

    scanSetStage(1);
    scanSetLoadMsg('Filtering active competitors with hard scoring');
    var found = await findUsefulCompetitors(info, langCode);
    competitors = found.verified || [];
    estimatedCompetitors = found.estimated || [];
    meta = {
      profile: found.profile,
      queries: found.queries,
      rejectedCount: (found.rejected || []).length,
      verifiedCount: competitors.length,
      estimatedCount: estimatedCompetitors.length,
      demo: false
    };

    scanSetStage(2);
    scanSetLoadMsg('Extracting content patterns');
  } catch(e) { /* continue with whatever we got */ }

  return { info: info, competitors: competitors, estimatedCompetitors: estimatedCompetitors, videoTitles: videoTitles, meta: meta };
}
async function callGroqScan(handle, lang) {
  if (window.AshlyVAPI && typeof window.AshlyVAPI.scanChannel === 'function') {
    try {
      scanSetStage(1);
      scanSetLoadMsg('Connecting to the niche backend');
      var backend = await window.AshlyVAPI.scanChannel(handle, lang || 'es');
      if (backend && backend.ok && backend.data) {
        scanLastRealCompetitors = backend.data.competitors || [];
        scanLastEstimatedCompetitors = [];
        scanLastScanMeta = backend.data.source || null;
        scanSetStage(4);
        scanSetLoadMsg('Report built from YouTube and the niche engine.');
        document.dispatchEvent(new CustomEvent('ashlyv:scan-complete', { detail: backend.data }));
        return backend.data.reportMarkdown || JSON.stringify(backend.data, null, 2);
      }
    } catch (backendErr) {
      console.warn('[ASHLYV] Backend scan failed, using in-extension scanner fallback:', backendErr);
      scanSetLoadMsg('Backend unavailable, using the built-in scanner');
    }
  }

  var langName = getLanguageLabel(lang || 'auto');
  var real = await fetchYTRealData(handle);
  scanLastRealCompetitors = real.competitors || [];
  scanLastEstimatedCompetitors = real.estimatedCompetitors || [];
  scanLastScanMeta = real.meta || null;

  scanSetStage(3);
  scanSetLoadMsg('Generating intelligence with AI');

  var titlesCtx = (real.videoTitles && real.videoTitles.length > 0)
    ? '\nTítulos recientes del canal (para análisis de patrones):\n' +
      real.videoTitles.map(function(t, i){ return (i+1) + '. ' + t; }).join('\n') + '\n'
    : '';

  var chanCtx = real.info
    ? '\n\n=== DATOS REALES DEL CANAL (extraídos de YouTube) ===\n' +
      'Canal: @' + handle + '\n' +
      'Nombre: ' + real.info.name + '\n' +
      (real.info.subs ? 'Suscriptores: ' + real.info.subs + '\n' : '') +
      (real.info.vids ? 'Videos publicados: ' + real.info.vids + '\n' : '') +
      (real.info.desc ? 'Descripción: ' + real.info.desc.slice(0, 500) + '\n' : '') +
      (real.info.kwds ? 'Keywords: ' + real.info.kwds.slice(0, 300) + '\n' : '') +
      titlesCtx
    : '\nCanal: @' + handle + '\n';

  var compCtx = (real.competitors || []).length > 0
    ? '\n\nCANALES VERIFICADOS EN YOUTUBE - pasan filtros duros de actividad, idioma, similitud, views y recencia:\n' +
      real.competitors.map(function(c, i) {
        return (i+1) + '. ' + c.name + ' (' + c.handle + ')' +
          (c.subs ? ' - ' + c.subs : '') +
          '\n   TIPO: ' + c.type +
          '\n   SCORE_FINAL: ' + c.finalCompetitorScore +
          '\n   NICHE_SIMILARITY: ' + c.nicheSimilarity +
          '\n   FORMAT_SIMILARITY: ' + c.formatSimilarity +
          '\n   PERFORMANCE: ' + c.performanceScore +
          '\n   RECENCY: ' + c.recencyScore +
          '\n   STRATEGIC_VALUE: ' + c.strategicValueScore +
          '\n   ACTIVIDAD: ultimo video hace ' + c.lastVideoDays + ' dias, ' + c.recentVideos.length + ' videos recientes, avg views ' + compactNumber(c.avgRecentViews) +
          '\n   FORMATO_DETECTADO: ' + (c.formats || []).join(' + ') +
          '\n   STEAL_POTENTIAL: ' + c.stealPotential +
          (c.desc ? '\n   DESCRIPCION: "' + c.desc + '"' : '') +
          (c.recentVideos && c.recentVideos.length ? '\n   TITULOS_RECIENTES: ' + c.recentVideos.slice(0, 4).map(function(v) { return '"' + v.title + '"'; }).join(' | ') : '');
      }).join('\n') +
      '\n\nREGLA ABSOLUTA - COMPETIDORES: usa UNICAMENTE estos canales como competidores verificados. Respeta SCORE_FINAL, TIPO y handle exacto. NO inventes handles adicionales. NO subas la similitud por encima del dato provisto.\n'
    : '\n\nCOMPETIDORES: No se encontraron competidores verificados fuertes despues de filtros duros. Escribe: "No encontramos competidores verificados fuertes, pero detectamos estos espacios cercanos..." y usa solo espacios estimados, no handles inventados.\n';

  if ((!real.competitors || !real.competitors.length) && real.estimatedCompetitors && real.estimatedCompetitors.length) {
    compCtx += '\nESPACIOS CERCANOS ESTIMADOS (NO VERIFICADOS COMO COMPETENCIA DIRECTA):\n' +
      real.estimatedCompetitors.map(function(c, i) {
        return (i + 1) + '. ' + c.name + ' | similitud ' + (c.nicheSimilarity || 0) + ' | ' + (c.whyMatters || '');
      }).join('\n') + '\n';
  }
  var prompt = 'You are ZERACK channel intelligence. Surgical precision, no filler. Every answer is specific, actionable and grounded in the data you were given.' +
chanCtx + compCtx +
'\n\nWrite the full report for @' + handle + ' in ' + langName + '. Nothing generic: everything concrete and grounded in the channel data above.' +
'\n\nExact format, use ## for sections and the field names in capitals exactly as written:\n\n' +

'## SNAPSHOT\n' +
'EXACT_NICHE: [ultra specific niche, for example "faceless AI documentaries about Latin American historical mystery, made to fall asleep to"]\n' +
'CONTENT_MODEL: [Storytelling faceless / Educational faceless / Emotional narrative / Hybrid, describe the model in one sentence]\n' +
'POSITIONING: [what this channel does differently from everyone else, the unique angle, not a generic line]\n' +
'AUDIENCE: [precise demographics: age range, dominant gender, main countries, psychographic interests]\n' +
'AUDIENCE_PSYCHOLOGY: [the main emotion or driver behind watching: fear, curiosity, fear of missing out, relaxation, escapism, adrenaline, and explain it]\n' +
'GROWTH_PATTERN: [Explosive, more than 2x in six months / Steady / Declining, with a specific reason from the data]\n' +
'MONETIZATION: [estimated RPM in dollars for this niche and audience country, estimated monthly income, other revenue lines]\n' +
'STRENGTHS: [specific strength 1 | strength 2 | strength 3, concrete, not generic]\n' +
'WEAKNESSES: [exploitable weakness 1 | weakness 2 | weakness 3]\n' +
'KEY_OPPORTUNITY: [the single action with the most impact over the next 90 days, very specific]\n\n' +

'## COMPETITORS\n' +
'[For every channel in the verified list, one block in exactly this format:]\n' +
'CHANNEL: @[exact handle from the list]\n' +
'SIMILARITY: [number 0-100]%\n' +
'GROWTH: [Accelerating/Steady/Declining]\n' +
'NICHE_TAG: [specific tag, for example "Faceless horror ES" / "AI mystery" / "True crime Latam"]\n' +
'THREAT: [High/Medium/Low]\n' +
'DESCRIPTION: [why it competes directly and what it does differently, one or two concrete sentences]\n\n' +

'## PATTERNS\n' +
'VIDEO_FORMAT: [dominant format with a specific description of the production style]\n' +
'HOOK_MODEL: [Fear opening / Curiosity gap / In medias res / Shock claim / Transformation promise, with a description]\n' +
'VOICE_TYPE: [deep male / soft female / cloned AI narrator / duo, with the narration style and pace]\n' +
'UPLOAD_DAY: [the days that maximise views in the first 24 hours for this niche]\n' +
'UPLOAD_TIME: [specific hour, say the timezone]\n' +
'OPTIMAL_LENGTH: [the exact minute range that maximises watch time and retention in this niche]\n' +
'THUMBNAIL_STYLE: [precise visual description: colour palette, typography, visual elements, the text to image ratio that wins here]\n' +
'TITLE_FORMULA: [the exact formula with its structure, for example "[Shock number or adjective] + [Mysterious subject] + [Consequence or reveal]"]\n' +
'HOOK_FORMULAS: ["Opening example 1 that holds the viewer" | "Example 2" | "Example 3"]\n' +
'VIRAL_TITLES: ["Viral title 1" | "Viral title 2" | "Viral title 3" | "Viral title 4" | "Viral title 5"]\n\n' +

'## GAPS\n' +
'1. **[Very specific topic]**: [why real demand exists with no quality supply, name the concrete signals and the angle to attack it]\n' +
'2. **[Topic]**: [analysis with the differentiating angle]\n' +
'3. **[Topic]**: [analysis]\n' +
'4. **[Topic]**: [analysis]\n' +
'5. **[Topic]**: [analysis]\n' +
'6. **[Topic]**: [analysis]\n\n' +

'## SUBNICHES\n' +
'NAME: [very specific subniche 1]\n' +
'POTENTIAL: [High/Medium/Low]\n' +
'COMPETITION: [High/Medium/Low]\n' +
'BARRIER: [High/Medium/Low]\n' +
'TREND: [Rising/Steady/Falling]\n' +
'WHY: [why the opportunity is real right now, with concrete signals]\n' +
'FIRST_VIDEO: [the concrete title of the first video to publish in this subniche]\n' +
'---\n' +
'NAME: [subniche 2]\n' +
'POTENTIAL: [High/Medium/Low]\n' +
'COMPETITION: [High/Medium/Low]\n' +
'BARRIER: [High/Medium/Low]\n' +
'TREND: [Rising/Steady/Falling]\n' +
'WHY: [concrete reason]\n' +
'FIRST_VIDEO: [title]\n' +
'---\n' +
'[Repeat the same block until there are six subniches]\n\n' +

'## STRATEGY\n' +
'Include as well: five recommended video ideas, the recommended format, the title style, the thumbnail style and the publishing frequency.\n' +
'SAFE_MODE:\n' +
'TITLE: [name of this conservative strategy]\n' +
'DESCRIPTION: [who it is for, what it guarantees, what it gives up, concrete]\n' +
'ACTIONS:\n' +
'- [concrete action with a number, for example "Publish 2 videos a week, Tuesday and Friday"]\n' +
'- [concrete action with a number]\n' +
'- [concrete action with a number]\n' +
'- [concrete action]\n' +
'RISK: Low\n' +
'REWARD: Medium\n' +
'TIME: [X weeks or months to see results]\n\n' +
'AGGRESSIVE_MODE:\n' +
'TITLE: [name of this maximum growth strategy]\n' +
'DESCRIPTION: [who it is for, what it can win, what it can lose, concrete]\n' +
'ACTIONS:\n' +
'- [concrete action with a number]\n' +
'- [concrete action with a number]\n' +
'- [concrete action with a number]\n' +
'- [concrete action]\n' +
'RISK: High\n' +
'REWARD: High\n' +
'TIME: [X weeks]\n\n' +
'DIFFERENTIATION_MODE:\n' +
'TITLE: [name, the unique angle nobody is taking]\n' +
'DESCRIPTION: [the open water: which gap it exploits and how it differs radically from the market]\n' +
'ACTIONS:\n' +
'- [concrete action with a number]\n' +
'- [concrete action with a number]\n' +
'- [concrete action with a number]\n' +
'- [concrete action]\n' +
'RISK: Medium\n' +
'REWARD: Very high\n' +
'TIME: [X months]\n\n' +

'## SCORES\n' +
'[Score the real niche. The numbers must vary a lot between niches, never generic]\n' +
'MARKET_OPPORTUNITY_SCORE: [0-100]\n' +
'COMPETITION_DIFFICULTY: [0-100]\n' +
'CONTENT_GAP_SCORE: [0-100]\n' +
'FACELESS_SCALABILITY_SCORE: [0-100]\n' +
'GROWTH_POTENTIAL_SCORE: [0-100]\n' +
'MONETIZATION_POTENTIAL: [0-100]\n' +
'EXECUTION_DIFFICULTY: [0-100]\n' +
'NICHE_POTENTIAL: [0-100, market size and growth trend]\n' +
'COMPETITION_LEVEL: [0-100, how dense the active competing channels are]\n' +
'PROFITABILITY: [0-100, estimated RPM for this niche by audience country]\n' +
'GROWTH_SPEED: [0-100, how fast a new channel can grow here]\n' +
'ENTRY_EASE: [0-100, the barrier for a new creator]\n' +
'SATURATION: [0-100, how saturated the niche is with similar content]\n' +
'VERDICT: [ATTACK NOW / TEST CAREFULLY / WATCH ONLY / AVOID, plus a direct recommendation in two sentences]';

  var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.52,
      max_tokens: 6000
    })
  });
  if (!resp.ok) throw new Error('Groq error ' + resp.status);
  var data = await resp.json();
  return data.choices[0].message.content;
}

function handleScanAnalyze() {
  var handle = (document.getElementById('scan-handle-input').value || '').trim().replace(/^@/, '');
  var lang = document.getElementById('scan-lang-sel').value;
  if (!handle) {
    document.getElementById('scan-handle-input').focus();
    return;
  }
  var btn = document.getElementById('scan-go-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = 'ANALYZING';
  scanLastRealCompetitors = null; // reset - null means "fetch not done yet"
  scanLastEstimatedCompetitors = [];
  scanLastScanMeta = null;
  scanShowState('loading');
  scanSetLoadMsg('Starting the analysis of @' + handle);

  callGroqScan(handle, lang)
    .then(function(report) {
      scanRenderResults(report);
      saveScanChannelReport(handle, lang, report);
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'ANALYZE';
    })
    .catch(function(err) {
      scanShowState('empty');
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'ANALYZE';
      var emptyTitle = document.querySelector('.scan-empty-ttl');
      var emptySub = document.querySelector('.scan-empty-sub');
      if (emptyTitle) emptyTitle.textContent = 'Could not analyze the channel';
      if (emptySub) emptySub.textContent = 'Could not reach the AI engine. Check your connection and try again. (' + (err.message || 'Error') + ')';
    });
}

function initScanLanguageSelect() {
  var sel = document.getElementById('scan-lang-sel');
  if (!sel) return;
  var current = sel.value || 'es';
  var langs = getLanguageList().filter(function(item) { return item.code !== 'auto'; });
  if (!langs.length || sel.getAttribute('data-expanded') === '1') return;
  sel.innerHTML = '';
  langs.forEach(function(item) {
    var opt = document.createElement('option');
    opt.value = item.code;
    opt.textContent = item.label || item.nativeLabel || item.code;
    sel.appendChild(opt);
  });
  sel.value = langs.some(function(item) { return item.code === current; }) ? current : 'es';
  sel.setAttribute('data-expanded', '1');
}

function initScanEvents() {
  var btnScanHeader = document.getElementById('btn-scan-header');
  var btnScanClose = document.getElementById('scan-modal-close');
  var btnScanGo = document.getElementById('scan-go-btn');
  var scanModal = document.getElementById('scan-modal');
  var scanInput = document.getElementById('scan-handle-input');
  var nmOpenScan = document.getElementById('nm-open-scan');
  var modeChannel = document.getElementById('scan-mode-channel');
  var modeThumbnail = document.getElementById('scan-mode-thumbnail');
  initScanLanguageSelect();

  if (btnScanHeader) btnScanHeader.addEventListener('click', openScanModal);
  if (nmOpenScan) nmOpenScan.addEventListener('click', function() { closeToolsModal(); openScanModal(); });
  if (btnScanClose) btnScanClose.addEventListener('click', closeScanModal);
  if (btnScanGo) btnScanGo.addEventListener('click', handleScanAnalyze);
  if (modeChannel) modeChannel.addEventListener('click', function() { scanSetMode('channel'); });
  if (modeThumbnail) modeThumbnail.addEventListener('click', function() { scanSetMode('thumbnail'); });
  if (scanInput) {
    scanInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleScanAnalyze();
    });
  }
  if (scanModal) {
    scanModal.addEventListener('click', function(e) {
      if (e.target === scanModal) closeScanModal();
    });
  }
  document.querySelectorAll('.scan-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      scanSetTab(btn.getAttribute('data-tab'));
    });
  });
  document.querySelectorAll('.scan-ex-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var inp = document.getElementById('scan-handle-input');
      if (inp) inp.value = btn.getAttribute('data-h');
    });
  });
}

function initEvents() {
  document.getElementById('btn-clear-all').addEventListener('click', clearAll);
  document.getElementById('btn-footer-yt').addEventListener('click', function() {
    window.open(buildYouTubeHomeUrl(app.state.selectedLanguage || 'auto'), '_blank');
  });
  var liveBtn = document.getElementById('btn-live-alerts');
  if (liveBtn) {
    var openLiveAlerts = function() {
      var target = document.getElementById('engine-alert-history');
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    liveBtn.addEventListener('click', openLiveAlerts);
    liveBtn.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openLiveAlerts();
      }
    });
  }
  document.getElementById('btn-trans-cls').addEventListener('click', closeTransModal);
  document.getElementById('btn-trans-translate').addEventListener('click', doTranslate);
  document.getElementById('btn-trans-search').addEventListener('click', searchTranslated);
  document.getElementById('btn-trans-copy').addEventListener('click', copyTranslated);
  document.getElementById('bp-close').addEventListener('click', function() {
    document.getElementById('bp-modal').style.display = 'none';
  });
  document.getElementById('bp-btn-copy').addEventListener('click', copyBlueprintPrompt);
  document.getElementById('bp-btn-ai').addEventListener('click', openBlueprintInChatGPT);
  document.getElementById('rn-close').addEventListener('click', closeRobaNicho);
  document.getElementById('rn-btn-search').addEventListener('click', searchRobaOnYouTube);
  document.getElementById('rn-btn-copy').addEventListener('click', copyRobaPrompt);
  document.getElementById('rn-btn-ai').addEventListener('click', openRobaInChatGPT);
  var btnTH = document.getElementById('btn-tools-header');
  var btnTF = document.getElementById('btn-tools-footer');
  if (btnTH) btnTH.addEventListener('click', openToolsModal);
  if (btnTF) btnTF.addEventListener('click', openToolsModal);
  var toolsClose = document.getElementById('tools-close');
  var thumbOpen = document.getElementById('nm-open-thumbnail');
  var thumbApiInput = getApiKeyInput();
  var thumbSaveApi = document.getElementById('ashlyv-validate-api') || document.getElementById('thumb-save-api-btn');
  var thumbAnalyze = document.getElementById('thumb-analyze-btn');
  var thumbConfigureApi = document.getElementById('thumb-configure-api-btn');
  var thumbTabAnalyze = document.getElementById('thumb-tab-analyze');
  var thumbTabHistory = document.getElementById('thumb-tab-history');
  var thumbTabIdeas = document.getElementById('thumb-tab-ideas');
  var thumbChannel = document.getElementById('thumb-channel-input');
  var thumbFile = document.getElementById('thumb-file-input');
  var ideasBtn = document.getElementById('ideas-generate-btn');
  if (toolsClose) toolsClose.addEventListener('click', closeToolsModal);
  if (thumbOpen) thumbOpen.addEventListener('click', openThumbnailModal);
  // Old validate handler removed. The button is rebound below with a clean
  // service-worker-only flow so stale direct-browser code cannot run.
  if (thumbAnalyze) thumbAnalyze.addEventListener('click', handleThumbnailAnalyze);
  if (thumbConfigureApi) thumbConfigureApi.addEventListener('click', openExtensionOptions);
  if (thumbTabAnalyze) thumbTabAnalyze.addEventListener('click', function() { thumbSetTab('analyze'); });
  if (thumbTabHistory) thumbTabHistory.addEventListener('click', function() { thumbSetTab('history'); });
  if (thumbTabIdeas) thumbTabIdeas.addEventListener('click', function() { thumbSetTab('ideas'); });
  if (thumbChannel) thumbChannel.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleThumbnailAnalyze();
  });
  if (thumbApiInput) thumbApiInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && thumbSaveApi) {
      e.preventDefault();
      thumbSaveApi.click();
    }
  });
  if (thumbSaveApi && thumbSaveApi.parentNode) {
    var cleanValidateBtn = thumbSaveApi.cloneNode(true);
    thumbSaveApi.parentNode.replaceChild(cleanValidateBtn, thumbSaveApi);
    thumbSaveApi = cleanValidateBtn;
    thumbSaveApi.addEventListener('click', function() {
      var keyInput = getApiKeyInput();
      var key = keyInput ? keyInput.value.trim() : '';
      clearApiKeyError();
      thumbSaveApi.textContent = 'Validating';
      thumbSaveApi.disabled = true;
      thumbSaveApi.style.borderColor = '';
      thumbSaveApi.style.color = '';
      chrome.runtime.sendMessage({ type: 'ASHLYV_PING' }, function(swHealth) {
        if (chrome.runtime.lastError || !swHealth || !swHealth.pong) {
          thumbSaveApi.textContent = 'VALIDATE API';
          thumbSaveApi.disabled = false;
          showApiKeyError('The service worker is not responding. Reload the extension and try again.');
          return;
        }
        if (!window.AshlyVAPI || typeof window.AshlyVAPI.validateApiKey !== 'function') {
          thumbSaveApi.textContent = 'VALIDATE API';
          thumbSaveApi.disabled = false;
          showApiKeyError('The AI client did not load. Reload the extension.');
          return;
        }
        window.AshlyVAPI.validateApiKey(key)
          .then(function(res) {
            if (res.success && res.valid) {
              if (res.local) {
                thumbSaveApi.textContent = 'OLLAMA';
                thumbSaveApi.style.borderColor = '#FFFFFF';
                thumbSaveApi.style.color = '#FFFFFF';
                thumbSaveApi.disabled = false;
                updateApiKeyStatusIndicator();
                setThumbnailStatus('Local Ollama running and ready to use.', 'success');
                showAshlyVToast('Local AI connected', 'success', 2000);
                return;
              }
              chrome.storage.local.set({ ashlyv_api_key: key }, function() {
                thumbSaveApi.textContent = res.billingRequired ? 'NO CREDIT' : 'VALID';
                thumbSaveApi.style.borderColor = '#FFFFFF';
                thumbSaveApi.style.color = '#FFFFFF';
                thumbSaveApi.disabled = false;
                updateApiKeyStatusIndicator();
                if (res.billingRequired) {
                  setThumbnailStatus('API key is valid, but the account has no credit', 'error');
                  showApiKeyError(res.error || 'Your Anthropic account has no credit.');
                } else {
                  setThumbnailStatus('API key valid and saved', 'success');
                  showAshlyVToast('Saved', 'success', 2000);
                }
              });
            } else {
              thumbSaveApi.textContent = 'INVALID';
              thumbSaveApi.style.borderColor = '#FFFFFF';
              thumbSaveApi.style.color = '#FFFFFF';
              thumbSaveApi.disabled = false;
              showApiKeyError(res.error || 'Key rejected by Anthropic');
            }
          })
          .catch(function(err) {
            thumbSaveApi.textContent = 'VALIDATE API';
            thumbSaveApi.disabled = false;
            var msg = err && err.message ? err.message : 'Unknown error';
            if (msg.indexOf('dangerous-direct-browser-access') >= 0) {
              msg = 'Validation did not go through the service worker. Reload ZERACK and try again.';
            }
            showApiKeyError(msg);
          });
      });
    });
  }
  if (thumbFile) thumbFile.addEventListener('change', function() {
    var file = thumbFile.files && thumbFile.files[0];
    var preview = document.getElementById('thumb-preview');
    if (!file || !preview || !/^image\//i.test(file.type || '')) return;
    thumbFileToDataUrl(file).then(function(dataUrl) {
      preview.src = dataUrl;
      preview.style.display = 'block';
    }).catch(function() {});
  });
  if (ideasBtn) ideasBtn.addEventListener('click', handleIdeasGenerate);
  window.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'bp-modal') document.getElementById('bp-modal').style.display = 'none';
    if (e.target && e.target.id === 'trans-modal') document.getElementById('trans-modal').style.display = 'none';
    if (e.target && e.target.id === 'rn-modal') document.getElementById('rn-modal').style.display = 'none';
    if (e.target && e.target.id === 'tools-modal') closeToolsModal();
  });
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeAshlyVToolWorkspace();
      closeToolsModal();
      closeScanModal();
    }
  });
  document.querySelectorAll('[data-tool-url]').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target && e.target.closest && e.target.closest('[data-tool-help-url]')) return;
      openAshlyVToolPage(card.getAttribute('data-tool-url'));
    });
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openAshlyVToolPage(card.getAttribute('data-tool-url'));
      }
    });
    if (!card.getAttribute('tabindex')) card.setAttribute('tabindex', '0');
    if (!card.getAttribute('role')) card.setAttribute('role', 'button');
  });
  document.querySelectorAll('[data-tool-help-url]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openAshlyVToolPage(btn.getAttribute('data-tool-help-url'));
    });
  });
  initScanEvents();
}

function loadInlinePayload() {
  try {
    var params = new URLSearchParams(window.location.search);
    var d = params.get('d');
    if (!d) return false;
    app.savedNichos = JSON.parse(decodeURIComponent(atob(d).split('').map(function(c){return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2);}).join('')));
    app.savedChannels = [];
    app.alertHistory = [];
    app.opportunityHistory = [];
    app.mergedEntries = mergeDashboardEntries(app.savedNichos, app.savedChannels);
    computeEngineData();
    render();
    return true;
  } catch (e) {
    return false;
  }
}

function load() {
  if (loadInlinePayload()) return;
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.storage) {
    app.mergedEntries = [];
    computeEngineData();
    render();
    return;
  }

  requestRuntimeMessage({ type: 'ASHLYV_GLOBAL_STATE_GET' }).then(function(res) {
    if (!res || res.ok === false) throw new Error((res && res.error) || 'runtime_state_unavailable');
    app.state = res && res.state ? res.state : app.state;
    app.alertHistory = res && res.alertHistory ? res.alertHistory : [];
    app.opportunityHistory = res && res.opportunityHistory ? res.opportunityHistory : [];
    app.savedNichos = Array.isArray(res && res.savedNichos) ? res.savedNichos : [];
    app.savedChannels = Array.isArray(res && res.savedChannels) ? res.savedChannels : [];
    app.mergedEntries = mergeDashboardEntries(app.savedNichos, app.savedChannels);
    computeEngineData();
    render();
    if (typeof window.__ashlyvPopulateAdvancedScanNichos === 'function') window.__ashlyvPopulateAdvancedScanNichos();
    if (app.allOpportunities && app.allOpportunities.length) pushOpportunityHistory(app.allOpportunities.slice(0, 8));
  }).catch(function() {
    chrome.storage.local.get(['ashlyv_nichos', 'ashlyv_nichos_backup', 'nsp_all_channels'], function(res) {
      var fallbackNichos = Array.isArray(res.ashlyv_nichos) && res.ashlyv_nichos.length
        ? res.ashlyv_nichos
        : (Array.isArray(res.ashlyv_nichos_backup) ? res.ashlyv_nichos_backup : []);
      app.savedNichos = Array.isArray(fallbackNichos) ? fallbackNichos : [];
      app.savedChannels = Array.isArray(res.nsp_all_channels) ? res.nsp_all_channels : [];
      app.mergedEntries = mergeDashboardEntries(app.savedNichos, app.savedChannels);
      computeEngineData();
      render();
      if (typeof window.__ashlyvPopulateAdvancedScanNichos === 'function') window.__ashlyvPopulateAdvancedScanNichos();
    });
  });
}

function copyTextWithFallback(text) {
  text = String(text || '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function(resolve, reject) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(area);
      resolve();
    } catch (err) {
      document.body.removeChild(area);
      reject(err);
    }
  });
}

function renderIdeasResults(data) {
  var host = document.getElementById('ideas-result-panel');
  if (!host) return;
  thumbClear(host);
  data = data && typeof data === 'object' ? data : {};

  function makeCopyButton(text) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb-btn secondary';
    btn.style.marginTop = '0';
    btn.textContent = 'COPY';
    btn.addEventListener('click', function() {
      copyTextWithFallback(text).then(function() {
        var original = btn.textContent;
        btn.textContent = 'OK';
        showAshlyVToast('Copied to clipboard', 'success', 2000);
        setTimeout(function() { btn.textContent = original; }, 2000);
      });
    });
    return btn;
  }

  function appendListSection(title, items, copyable) {
    var section = document.createElement('div');
    section.style.marginBottom = '18px';
    var heading = document.createElement('div');
    heading.style.fontSize = '16px';
    heading.style.fontWeight = '900';
    heading.style.marginBottom = '10px';
    heading.textContent = title;
    section.appendChild(heading);
    (Array.isArray(items) ? items : []).forEach(function(item, index) {
      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'flex-start';
      row.style.justifyContent = 'space-between';
      row.style.gap = '12px';
      row.style.padding = '12px';
      row.style.marginBottom = '8px';
      row.style.borderRadius = '16px';
      row.style.background = 'rgba(255,255,255,.03)';
      row.style.border = '1px solid rgba(255,255,255,.08)';
      var text = document.createElement('div');
      text.style.lineHeight = '1.6';
      text.textContent = (index + 1) + '. ' + String(item || '');
      row.appendChild(text);
      if (copyable) row.appendChild(makeCopyButton(String(item || '')));
      section.appendChild(row);
    });
    host.appendChild(section);
  }

  appendListSection('Video titles', data.titles || [], true);
  appendListSection('Opening hooks', data.hooks || [], true);
  appendListSection('Thumbnail concepts', data.thumbnailConcepts || [], false);

  var freq = document.createElement('div');
  freq.style.marginBottom = '18px';
  freq.style.padding = '14px';
  freq.style.borderRadius = '16px';
  freq.style.background = 'rgba(123,92,255,.12)';
  freq.style.border = '1px solid rgba(123,92,255,.2)';
  freq.textContent = 'Upload frequency: ' + String(data.uploadSchedule || 'No data');
  host.appendChild(freq);

  var tipsTitle = document.createElement('div');
  tipsTitle.style.fontSize = '16px';
  tipsTitle.style.fontWeight = '900';
  tipsTitle.style.marginBottom = '10px';
  tipsTitle.textContent = 'Monetization tips';
  host.appendChild(tipsTitle);

  var tips = document.createElement('ol');
  tips.style.paddingLeft = '18px';
  (data.monetizationTips || []).forEach(function(item) {
    var li = document.createElement('li');
    li.style.marginBottom = '10px';
    li.textContent = String(item || '');
    tips.appendChild(li);
  });
  host.appendChild(tips);

  var copyAll = document.createElement('button');
  copyAll.type = 'button';
  copyAll.className = 'thumb-btn';
  copyAll.style.marginTop = '18px';
  copyAll.textContent = 'COPY ALL TITLES';
  copyAll.addEventListener('click', function() {
    copyTextWithFallback((data.titles || []).map(function(item, index) {
      return (index + 1) + '. ' + String(item || '');
    }).join('\n')).then(function() {
      var original = copyAll.textContent;
      copyAll.textContent = 'Copied';
      showAshlyVToast('Copied to clipboard', 'success', 2000);
      setTimeout(function() { copyAll.textContent = original; }, 2000);
    });
  });
  host.appendChild(copyAll);
}

function handleIdeasGenerate() {
  var nicheInput = document.getElementById('ideas-niche-input');
  var languageSelect = document.getElementById('ideas-language-select');
  var rpmInput = document.getElementById('ideas-rpm-input');
  var button = document.getElementById('ideas-generate-btn');
  var niche = String(nicheInput && nicheInput.value || '').trim();
  var language = languageSelect ? languageSelect.value : 'Español';
  var rpmTarget = rpmInput ? rpmInput.value : '8';
  if (!niche) {
    showAshlyVToast('Enter a niche before generating ideas.', 'error', 2400);
    if (nicheInput) nicheInput.focus();
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = 'GENERATING';
  }
  window.AshlyVAPI.generateNicheIdeas(niche, language, rpmTarget)
    .then(function(response) {
      if (!response.success) throw new Error(response.error || 'Could not generate ideas');
      var parsed = window.AshlyVAPI.parseApiJson(response.content);
      if (!parsed) throw new Error('The AI returned an invalid response.');
      renderIdeasResults(parsed);
    })
    .catch(function(err) {
      var host = document.getElementById('ideas-result-panel');
      if (host) {
        thumbClear(host);
        var title = document.createElement('div');
        title.className = 'scan-empty-ttl';
        title.textContent = 'Could not generate ideas';
        var sub = document.createElement('div');
        sub.className = 'scan-empty-sub';
        sub.style.textAlign = 'left';
        sub.style.maxWidth = 'none';
        sub.textContent = err && err.message ? err.message : 'Try again.';
        host.appendChild(title);
        host.appendChild(sub);
      }
    })
    .then(function() {
      if (button) {
        button.disabled = false;
        button.textContent = 'GENERATE IDEAS WITH AI';
      }
    });
}

function initAshlyVPageHealth() {
  var banner = document.getElementById('ashlyv-sw-banner');
  var resolved = false;
  var timeout = setTimeout(function() {
    if (!resolved && banner) banner.style.display = 'block';
  }, 3000);
  try {
    chrome.runtime.sendMessage({ type: 'ASHLYV_PING' }, function(response) {
      resolved = true;
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        if (banner) banner.style.display = 'block';
        return;
      }
      if (response && response.pong && banner) banner.style.display = 'none';
      else if (banner) banner.style.display = 'block';
      updateApiKeyStatusIndicator();
    });
  } catch (e) {
    if (banner) banner.style.display = 'block';
  }
  var close = document.getElementById('ashlyv-sw-banner-close');
  if (close) {
    close.onclick = function() {
      if (banner) banner.style.display = 'none';
    };
  }
}

handleScanAnalyze = function() {
  var handle = (document.getElementById('scan-handle-input').value || '').trim().replace(/^@/, '');
  var btn = document.getElementById('scan-go-btn');
  if (!handle) {
    document.getElementById('scan-handle-input').focus();
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = 'ANALYZING';
  }
  runChannelAnalysis(handle).then(function() {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'ANALYZE';
    }
  });
};

document.addEventListener('DOMContentLoaded', function() {
  initAshlyVPageHealth();
  initEvents();
  load();
  setTimeout(function() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var toolRoute = params.get('tool');
      if (toolRoute) buildAshlyVToolModal(toolRoute, { asPage: true });
    } catch (e) {}
  }, 120);
});

// ── Advanced Panel Logic (refactor 2025-05) ─────────────────────────

function renderQuickFilters(quickFilters) {
  if (!quickFilters) return '';
  var v = quickFilters.verdict;
  var verdictColors = { ATTACK: '#00DC82', WATCH: '#FFD93D', SKIP: '#FF6B6B' };
  var verdictColor = verdictColors[v] || '#888';

  return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;padding:10px;background:rgba(0,0,0,0.2);border-radius:10px;border:1px solid ' + verdictColor + '33;">'
    // Verdict badge
    + '<div style="padding:6px 14px;border-radius:8px;background:' + verdictColor + '22;border:1px solid ' + verdictColor + ';font-weight:800;font-size:14px;color:' + verdictColor + ';">'
    + (v === 'ATTACK' ? '🎯' : v === 'WATCH' ? '👀' : '⛔') + ' ' + v + '</div>'
    // Age badge
    + '<div style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.05);font-size:11px;color:' + (quickFilters.isNewChannel ? '#00DC82' : 'rgba(255,255,255,0.5)') + ';">'
    + '🕐 ' + (quickFilters.monthsOld !== null ? quickFilters.monthsOld + 'mo' : '?') + (quickFilters.isNewChannel ? ' ✓ NEW' : '') + '</div>'
    // Viral count badge
    + '<div style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.05);font-size:11px;color:' + (quickFilters.hasEnoughVirals ? '#FF6B6B' : 'rgba(255,255,255,0.5)') + ';">'
    + '🔥 ' + quickFilters.viralVideoCount + ' viral' + (quickFilters.hasEnoughVirals ? ' ✓' : '') + '</div>'
    // Velocity badge
    + '<div style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.05);font-size:11px;color:#2EE9FF;">'
    + '📈 ' + quickFilters.velocityTier + '</div>'
    + '</div>';
}

// Auto-populate quick filters when scan data arrives
var _origScanHandler = window._onScanResult || null;
document.addEventListener('ashlyv:scan-complete', function(e) {
  var container = document.getElementById('quick-filters-container');
  if (container && e.detail && e.detail.quickFilters) {
    container.innerHTML = renderQuickFilters(e.detail.quickFilters);
  }
  setTimeout(function() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['ashlyv_nichos', 'ashlyv_nichos_backup'], function(res) {
        var latest = Array.isArray(res.ashlyv_nichos) && res.ashlyv_nichos.length ? res.ashlyv_nichos : (Array.isArray(res.ashlyv_nichos_backup) ? res.ashlyv_nichos_backup : []);
        if (latest.length) app.savedNichos = latest;
        if (typeof window.__ashlyvPopulateAdvancedScanNichos === 'function') window.__ashlyvPopulateAdvancedScanNichos();
      });
    } else if (typeof window.__ashlyvPopulateAdvancedScanNichos === 'function') {
      window.__ashlyvPopulateAdvancedScanNichos();
    }
  }, 250);
});

(function initAdvancedPanel() {
  // Tab switching
  var tabBtn = document.getElementById('tab-advanced');
  var panel = document.getElementById('panel-advanced');
  if (!tabBtn || !panel) return; // panel not in DOM yet

  tabBtn.addEventListener('click', function() {
    // Hide all other panels — find siblings
    var allPanels = panel.parentElement ? panel.parentElement.querySelectorAll('[id^="scan-panel-"], [id="panel-advanced"]') : [];
    allPanels.forEach(function(p) { p.style.display = 'none'; });
    panel.style.display = 'block';
    // Update tab active states
    var allTabs = tabBtn.parentElement ? tabBtn.parentElement.querySelectorAll('.scan-tab-btn') : [];
    allTabs.forEach(function(t) { t.classList.remove('active'); });
    tabBtn.classList.add('active');
  });

  var API = window.AshlyVAPI;
  if (!API) { console.warn('AshlyVAPI not loaded'); return; }

  function advScanList() {
    return Array.isArray(app.savedNichos) ? app.savedNichos.filter(function(item) {
      return item && (item.niche || item.title || item.channelUrl || item.vidId);
    }) : [];
  }

  function advSelectedNicho() {
    var select = document.getElementById('adv-scan-nicho-select');
    var list = advScanList();
    var idx = select ? parseInt(select.value, 10) : 0;
    return list[isFinite(idx) ? idx : 0] || null;
  }

  function advNichoText(item) {
    item = item || advSelectedNicho() || {};
    return String(item.niche || item.title || '').replace(/[^\w\s\-&.,]/g, '').replace(/\s+/g, ' ').trim();
  }

  function advChannelText(item) {
    item = item || advSelectedNicho() || {};
    return String(item.channelUrl || item.channelId || '').trim();
  }

  function advLanguageText(item) {
    item = item || advSelectedNicho() || {};
    return String(item.language || app.state.selectedLanguage || 'es').slice(0, 8);
  }

  function advSetLockedInput(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value || '';
    el.readOnly = true;
    el.title = 'Locked to the niche selected from the scan';
  }

  function populateAdvancedScanNichos() {
    var select = document.getElementById('adv-scan-nicho-select');
    if (!select) return;
    var old = select.value;
    select.innerHTML = '';
    var list = advScanList();
    if (!list.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No scanned niches yet';
      select.appendChild(empty);
    } else {
      list.forEach(function(item, idx) {
        var opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = '#' + (idx + 1) + ' | ' + (item.niche || 'Niche') + (item.title ? ' | ' + String(item.title).slice(0, 70) : '');
        select.appendChild(opt);
      });
      if (old && list[parseInt(old, 10)]) select.value = old;
    }
    syncAdvancedScanTools();
  }

  function syncAdvancedScanTools() {
    var item = advSelectedNicho();
    var niche = advNichoText(item);
    var channel = advChannelText(item);
    var summary = document.getElementById('adv-scan-nicho-summary');
    advSetLockedInput('adv-channel-age-input', channel);
    advSetLockedInput('adv-viral-input', channel);
    advSetLockedInput('adv-title-input', niche);
    advSetLockedInput('adv-subniche-input', niche);
    advSetLockedInput('adv-subniche-channel', channel);
    advSetLockedInput('adv-global-niche-input', niche);
    var batch = document.getElementById('adv-batch-input');
    if (batch) {
      batch.value = advScanList().map(function(n) { return advChannelText(n); }).filter(Boolean).join('\n');
      batch.readOnly = true;
      batch.title = 'Batch built only from channels in the scanned list';
    }
    ['adv-check-age-btn', 'adv-viral-btn'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.disabled = !channel;
    });
    ['adv-title-btn', 'adv-subniche-btn', 'adv-global-score-btn'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.disabled = !niche;
    });
    var batchBtn = document.getElementById('adv-batch-btn');
    if (batchBtn) batchBtn.disabled = !advScanList().some(function(n) { return !!advChannelText(n); });
    if (summary) {
      summary.textContent = item
        ? 'Selected: ' + (item.niche || 'Niche') + ' | ' + (item.title || 'scanned result') + ' | ' + advLanguageText(item).toUpperCase()
        : 'No scanned niches. Run a scan and open PRO again.';
    }
  }

  var advSelect = document.getElementById('adv-scan-nicho-select');
  if (advSelect) advSelect.addEventListener('change', syncAdvancedScanTools);
  var advRefresh = document.getElementById('adv-refresh-nichos-btn');
  if (advRefresh) advRefresh.addEventListener('click', function() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      populateAdvancedScanNichos();
      return;
    }
    chrome.storage.local.get(['ashlyv_nichos', 'ashlyv_nichos_backup'], function(res) {
      var latest = Array.isArray(res.ashlyv_nichos) && res.ashlyv_nichos.length ? res.ashlyv_nichos : (Array.isArray(res.ashlyv_nichos_backup) ? res.ashlyv_nichos_backup : []);
      app.savedNichos = latest;
      populateAdvancedScanNichos();
    });
  });
  window.__ashlyvPopulateAdvancedScanNichos = populateAdvancedScanNichos;
  populateAdvancedScanNichos();

  // 1. Channel Age
  document.getElementById('adv-check-age-btn').addEventListener('click', async function() {
    var channel = advChannelText();
    var maxMonths = parseInt(document.getElementById('adv-max-months').value, 10);
    var resultEl = document.getElementById('adv-age-result');
    if (!channel) { resultEl.textContent = 'Enter a channel'; return; }
    resultEl.innerHTML = '<span style="color:#FFD93D;">⏳ Checking...</span>';
    try {
      var data = await API.apiChannelAge(channel, maxMonths);
      var pass = data.passesFilter;
      var months = data.monthsOld;
      var created = data.createdDate || 'unknown';
      var color = pass ? '#00DC82' : '#FF6B6B';
      var icon = pass ? '✅' : '❌';
      resultEl.innerHTML = '<span style="color:' + color + ';">' + icon + ' Channel is <b>' + months + ' months old</b> (created ' + created + '). '
        + (pass ? 'PASSES filter (≤' + maxMonths + 'mo)' : 'FAILS filter (>' + maxMonths + 'mo)') + '</span>'
        + (data.rawText ? '<br><span style="opacity:0.5;font-size:11px;">Raw: ' + data.rawText + '</span>' : '');
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
    }
  });

  // 2. Viral Metrics
  document.getElementById('adv-viral-btn').addEventListener('click', async function() {
    var channel = advChannelText();
    var threshold = parseInt(document.getElementById('adv-viral-threshold').value, 10) || 100000;
    var resultEl = document.getElementById('adv-viral-result');
    if (!channel) { resultEl.textContent = 'Enter a channel'; return; }
    resultEl.innerHTML = '<span style="color:#FFD93D;">⏳ Analyzing viral metrics...</span>';
    try {
      var data = await API.apiViralMetrics(channel, { viralThreshold: threshold });
      var m = data.viralMetrics;
      var pass = data.passesFilter;
      var color = pass ? '#00DC82' : '#FF6B6B';
      resultEl.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:24px;font-weight:800;color:' + color + ';">' + m.viralVideoCount + '</div>'
        + '<div style="font-size:10px;opacity:0.6;">Viral Videos (≥' + (threshold/1000) + 'K)</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:24px;font-weight:800;color:#2EE9FF;">' + m.velocityTier + '</div>'
        + '<div style="font-size:10px;opacity:0.6;">Velocity (' + Math.round(m.weeklyViewVelocity/1000) + 'K/week)</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:24px;font-weight:800;color:#FFD93D;">' + (m.viralRatio * 100).toFixed(1) + '%</div>'
        + '<div style="font-size:10px;opacity:0.6;">Viral Ratio</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:24px;font-weight:800;">' + data.videosAnalyzed + '</div>'
        + '<div style="font-size:10px;opacity:0.6;">Videos Analyzed</div></div>'
        + '</div>'
        + (m.viralVideos && m.viralVideos.length ? '<div style="margin-top:10px;font-size:11px;opacity:0.6;">Top viral: ' + m.viralVideos.slice(0,3).map(function(v){return v.title.slice(0,50)+'... ('+Math.round(v.views/1000)+'K)';}).join(' | ') + '</div>' : '');
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
    }
  });

  // 3. Search by Title
  document.getElementById('adv-title-btn').addEventListener('click', async function() {
    var keywords = advNichoText();
    var sortBy = document.getElementById('adv-title-sort').value;
    var resultEl = document.getElementById('adv-title-result');
    if (!keywords) { resultEl.textContent = 'Enter keywords'; return; }
    resultEl.innerHTML = '<span style="color:#FFD93D;">⏳ Searching titles...</span>';
    try {
      var data = await API.apiSearchTitles(keywords, { sortBy: sortBy });
      var html = '<div style="margin-bottom:8px;opacity:0.6;">' + data.totalResults + ' results | Niche: ' + data.subNiche + ' | RPM: $' + data.estimatedRpm + '</div>';
      if (data.channels && data.channels.length) {
        html += '<div style="font-size:12px;font-weight:700;color:#2EE9FF;margin:8px 0 4px;">Channels found:</div>';
        data.channels.slice(0, 8).forEach(function(ch) {
          html += '<div style="padding:6px 8px;margin:3px 0;background:rgba(0,0,0,0.2);border-radius:6px;display:flex;justify-content:space-between;">'
            + '<span>' + ch.channelName + ' <span style="opacity:0.4;">(' + ch.videoCount + ' videos)</span></span>'
            + '<span style="color:#00DC82;">' + Math.round(ch.totalViews/1000) + 'K views | Faceless: ' + ch.avgFaceless + '%</span>'
            + '</div>';
        });
      }
      if (data.titlePatterns && data.titlePatterns.length) {
        html += '<div style="font-size:12px;font-weight:700;color:#FFD93D;margin:10px 0 4px;">Common keywords:</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        data.titlePatterns.slice(0, 12).forEach(function(kw) {
          html += '<span style="padding:3px 8px;background:rgba(255,217,61,0.15);border-radius:4px;font-size:11px;">' + kw.term + ' (' + kw.count + ')</span>';
        });
        html += '</div>';
      }
      resultEl.innerHTML = html;
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
    }
  });

  // 4. Sub-Niche Generator
  document.getElementById('adv-subniche-btn').addEventListener('click', async function() {
    var niche = advNichoText();
    var channel = advChannelText() || null;
    var resultEl = document.getElementById('adv-subniche-result');
    if (!niche) { resultEl.textContent = 'Enter a niche'; return; }
    resultEl.innerHTML = '<span style="color:#FFD93D;">⏳ Generating sub-niches with AI... (this may take 15-30s)</span>';
    try {
      var data = await API.apiGenerateSubniches(niche, { channel: channel });
      var html = '';
      if (data.subNiches && data.subNiches.length) {
        data.subNiches.forEach(function(sn, i) {
          var diffColor = sn.difficulty === 'EASY' ? '#00DC82' : sn.difficulty === 'MEDIUM' ? '#FFD93D' : '#FF6B6B';
          html += '<div style="padding:12px;margin:8px 0;background:rgba(0,0,0,0.25);border-radius:10px;border-left:3px solid ' + diffColor + ';">'
            + '<div style="font-weight:700;color:#B388FF;font-size:13px;">' + (i+1) + '. ' + sn.name + '</div>'
            + '<div style="font-size:11px;opacity:0.7;margin:4px 0;">' + sn.angle + '</div>'
            + '<div style="font-size:11px;margin:4px 0;"><span style="color:' + diffColor + ';font-weight:600;">' + sn.difficulty + '</span> | RPM ~$' + sn.estimatedRpm + ' | ' + sn.contentFrequency + '</div>'
            + '<div style="font-size:11px;opacity:0.5;margin:4px 0;">Strategy: ' + sn.replicationStrategy + '</div>';
          if (sn.exampleTitles && sn.exampleTitles.length) {
            html += '<div style="font-size:10px;opacity:0.4;margin-top:4px;">Titles: ' + sn.exampleTitles.slice(0,3).join(' | ') + '</div>';
          }
          html += '</div>';
        });
      }
      if (data.replicationIdeas && data.replicationIdeas.length) {
        html += '<div style="font-size:12px;font-weight:700;color:#FFD93D;margin:12px 0 6px;">Replication Ideas:</div>';
        data.replicationIdeas.forEach(function(ri) {
          html += '<div style="padding:8px;margin:4px 0;background:rgba(255,217,61,0.08);border-radius:8px;font-size:11px;">'
            + '<b>' + ri.originalConcept + '</b> → ' + ri.yourTwist
            + '<br><span style="opacity:0.5;">Example: ' + ri.exampleTitle + '</span></div>';
        });
      }
      if (data.avoidList && data.avoidList.length) {
        html += '<div style="font-size:11px;color:#FF6B6B;margin-top:10px;opacity:0.6;">⚠️ Avoid: ' + data.avoidList.join(' | ') + '</div>';
      }
      if (data.marketTiming) {
        html += '<div style="font-size:11px;color:#00DC82;margin-top:6px;opacity:0.7;">📊 Timing: ' + data.marketTiming + '</div>';
      }
      resultEl.innerHTML = html || '<span style="opacity:0.5;">No results generated</span>';
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
    }
  });

  // 5. Global Niche Score
  document.getElementById('adv-global-score-btn').addEventListener('click', async function() {
    var niche = advNichoText();
    var resultEl = document.getElementById('adv-global-score-result');
    if (!niche) { resultEl.textContent = 'Enter a niche'; return; }
    resultEl.innerHTML = '<span style="color:#FFD93D;">⏳ Scoring across 15 languages... (this may take 30-60s)</span>';
    try {
      var data = await API.apiScoreByLanguage(niche);
      var html = '<div style="margin-bottom:10px;padding:10px;background:rgba(255,217,61,0.1);border-radius:8px;">'
        + '<span style="font-size:16px;font-weight:800;color:#FFD93D;">Best: ' + data.bestLanguage.toUpperCase() + '</span>'
        + ' <span style="font-size:14px;color:#00DC82;">' + data.bestScore + '/10 | ' + data.bestVerdict + '</span></div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">';
      data.results.forEach(function(r) {
        var vColor = r.verdict === 'ATTACK NOW' ? '#00DC82' : r.verdict === 'TEST CAREFULLY' ? '#FFD93D' : r.verdict === 'WATCH ONLY' ? '#FF9F43' : '#FF6B6B';
        html += '<div style="padding:10px;background:rgba(0,0,0,0.25);border-radius:8px;border-left:3px solid ' + vColor + ';">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-weight:700;font-size:13px;">' + r.language.toUpperCase() + '</span>'
          + '<span style="font-weight:800;font-size:15px;color:' + vColor + ';">' + r.overallScore + '</span></div>'
          + '<div style="font-size:10px;color:' + vColor + ';margin:2px 0;">' + r.verdict + '</div>'
          + '<div style="font-size:10px;opacity:0.5;">RPM $' + r.adjustedRpm + '</div>'
          + '<div style="display:flex;gap:2px;margin-top:4px;flex-wrap:wrap;">';
        var dims = r.dimensions;
        var dimLabels = {rpm:'💰',demand:'📊',saturation:'🏷️',competition:'⚔️',faceless:'👤',repeatability:'🔄',languageGap:'🌐'};
        Object.keys(dims).forEach(function(k) {
          var val = dims[k];
          var c = val >= 7 ? '#00DC82' : val >= 4 ? '#FFD93D' : '#FF6B6B';
          html += '<span title="' + k + ': ' + val + '" style="font-size:9px;padding:1px 4px;border-radius:3px;background:' + c + '22;color:' + c + ';">' + (dimLabels[k]||'') + val + '</span>';
        });
        html += '</div></div>';
      });
      html += '</div>';
      resultEl.innerHTML = html;
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
    }
  });

  // 6. Batch Scanner
  document.getElementById('adv-batch-btn').addEventListener('click', async function() {
    var raw = advScanList().map(function(item) { return advChannelText(item); }).filter(Boolean).join('\n');
    var maxMonths = document.getElementById('adv-batch-age').value;
    var minViral = parseInt(document.getElementById('adv-batch-viral').value, 10) || 0;
    var resultEl = document.getElementById('adv-batch-result');
    if (!raw) { resultEl.textContent = 'Paste at least one channel'; return; }

    var channels = raw.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    if (channels.length > 20) { resultEl.textContent = 'Maximum 20 channels'; return; }

    resultEl.innerHTML = '<span style="color:#FFD93D;">⏳ Scanning ' + channels.length + ' channels... this may take ' + (channels.length * 15) + '-' + (channels.length * 30) + ' seconds</span>';

    try {
      var data = await API.apiBatchScan(channels, {
        maxMonths: maxMonths ? parseInt(maxMonths, 10) : null,
        minViralVideos: minViral,
      });

      var html = '<div style="margin-bottom:10px;padding:8px;background:rgba(0,220,130,0.08);border-radius:8px;display:flex;gap:12px;font-size:12px;">'
        + '<span>Scanned: <b>' + data.totalScanned + '</b></span>'
        + '<span style="color:#00DC82;">Passing: <b>' + data.passingFilters + '</b></span>'
        + '<span style="color:#FF6B6B;">Errors: <b>' + data.totalErrors + '</b></span></div>';

      if (data.ranking && data.ranking.length) {
        html += '<div style="display:flex;flex-direction:column;gap:6px;">';
        data.ranking.forEach(function(r, i) {
          var vc = {GOLD:'#FFD700',SILVER:'#C0C0C0',BRONZE:'#CD7F32',SKIP:'#FF6B6B'};
          var color = vc[r.verdict] || '#888';
          var passStyle = r.passesAllFilters ? 'border-left:3px solid #00DC82;' : 'border-left:3px solid #FF6B6B;opacity:0.6;';
          html += '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;' + passStyle + 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">'
            + '<div style="flex:1;min-width:150px;">'
            + '<div style="font-weight:700;font-size:13px;">' + (i+1) + '. ' + r.channel + '</div>'
            + '<div style="font-size:10px;opacity:0.5;">' + r.handle + ' | ' + r.subscribers + ' subs | ' + (r.monthsOld !== null ? r.monthsOld + 'mo' : '?') + '</div></div>'
            + '<div style="display:flex;gap:6px;align-items:center;">'
            + '<span style="font-size:10px;color:#FF6B6B;">🔥' + r.viralVideoCount + '</span>'
            + '<span style="font-size:10px;color:#2EE9FF;">📈' + r.velocityTier + '</span>'
            + '<span style="font-size:10px;color:rgba(255,255,255,0.5);">👤' + Math.round(r.facelessAvg) + '%</span>'
            + '<div style="padding:4px 10px;border-radius:6px;background:' + color + '22;color:' + color + ';font-weight:800;font-size:13px;">'
            + r.opportunityScore + ' ' + r.verdict + '</div></div></div>';
        });
        html += '</div>';
      }

      if (data.errors && data.errors.length) {
        html += '<div style="margin-top:8px;font-size:10px;color:#FF6B6B;opacity:0.6;">Errors: ' + data.errors.map(function(e) { return e.channel + ': ' + e.error; }).join(' | ') + '</div>';
      }

      resultEl.innerHTML = html;
    } catch (err) {
      resultEl.innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
    }
  });
})();

// ── Mode Switcher + Replicator Logic (refactor 2025-05) ─────────────

function switchAshlyvMode(mode) {
  var scanTabs = document.querySelector('.scan-tabs-bar') || document.getElementById('scan-tabs-bar');
  var scanContent = document.getElementById('scan-content-area');
  var repContainer = document.getElementById('replicator-container');
  var brandContainer = document.getElementById('brand-container');
  var btnScanner = document.getElementById('mode-scanner');
  var btnReplicator = document.getElementById('mode-replicator');
  var btnBrand = document.getElementById('mode-brand');

  // Hide all
  if (scanTabs) scanTabs.style.display = 'none';
  if (scanContent) scanContent.style.display = 'none';
  if (repContainer) repContainer.style.display = 'none';
  if (brandContainer) brandContainer.style.display = 'none';

  // Reset all buttons
  var allBtns = [btnScanner, btnReplicator, btnBrand];
  allBtns.forEach(function(b) {
    if (b) { b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = 'rgba(255,255,255,0.5)'; }
  });

  if (mode === 'replicator') {
    if (repContainer) repContainer.style.display = 'block';
    if (btnReplicator) { btnReplicator.style.background = '#B388FF'; btnReplicator.style.color = '#000'; }
  } else if (mode === 'brand') {
    if (brandContainer) brandContainer.style.display = 'block';
    if (btnBrand) { btnBrand.style.background = '#FFD93D'; btnBrand.style.color = '#000'; }
  } else {
    // scanner (default)
    if (scanTabs) scanTabs.style.display = '';
    if (scanContent) scanContent.style.display = '';
    if (btnScanner) { btnScanner.style.background = '#00DC82'; btnScanner.style.color = '#000'; }
  }
}
window.switchAshlyvMode = switchAshlyvMode;

// Wired here instead of inline onclick: the MV3 page CSP blocks inline handlers, which left
// REPLICATOR and BRAND unreachable.
(function wireAshlyvModeSwitcher() {
  var modes = [['mode-scanner', 'scanner'], ['mode-replicator', 'replicator'], ['mode-brand', 'brand']];
  modes.forEach(function (pair) {
    var b = document.getElementById(pair[0]);
    if (b) b.addEventListener('click', function () { switchAshlyvMode(pair[1]); });
  });
})();

// Replicator analyze button
(function initReplicator() {
  var btn = document.getElementById('rep-analyze-btn');
  if (!btn) return;
  var API = window.AshlyVAPI;
  if (!API) return;

  btn.addEventListener('click', async function() {
    var url = document.getElementById('rep-input-url').value.trim();
    var lang = document.getElementById('rep-language').value;
    if (!url) return;

    var loading = document.getElementById('rep-loading');
    var results = document.getElementById('rep-results');
    var progress = document.getElementById('rep-progress');
    loading.style.display = 'block';
    results.style.display = 'none';

    try {
      // Step 1: Full scan
      progress.textContent = '1/4 Scanning channel';
      var scan = await API.apiScanChannelFull(url, { language: lang, maxVideos: 100 });

      // Step 2: Viral metrics
      progress.textContent = '2/4 Analyzing viral patterns';
      var viral = scan.viralMetrics || {};

      // Step 3: Sub-niches
      progress.textContent = '3/4 Generating replication angles';
      var channelName = (scan.channel && scan.channel.name) || url;
      var niche = (scan.analysis && scan.analysis.topKeywords && scan.analysis.topKeywords.length)
        ? scan.analysis.topKeywords.slice(0, 3).map(function(k) { return typeof k === 'string' ? k : k.term || k; }).join(' ')
        : channelName;
      var subniches = await API.apiGenerateSubniches(niche, { language: lang, channel: url });

      // Step 4: Render
      progress.textContent = '4/4 Building replication plan';

      // Overview
      var ch = scan.channel || {};
      var qf = scan.quickFilters || {};
      document.getElementById('rep-overview-content').innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:800;">' + (ch.name || url) + '</div>'
        + '<div style="font-size:10px;opacity:0.5;">Channel</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:800;color:#2EE9FF;">' + (ch.subscriberCount || '?') + '</div>'
        + '<div style="font-size:10px;opacity:0.5;">Subscribers</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:800;color:#00DC82;">' + (qf.monthsOld || '?') + 'mo</div>'
        + '<div style="font-size:10px;opacity:0.5;">Channel Age</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:800;color:#FF6B6B;">' + (viral.viralVideoCount || 0) + '</div>'
        + '<div style="font-size:10px;opacity:0.5;">Viral Videos</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:800;color:#FFD93D;">' + (viral.velocityTier || '?') + '</div>'
        + '<div style="font-size:10px;opacity:0.5;">Velocity</div></div>'
        + '</div>';

      // Patterns
      var patterns = scan.patterns || {};
      var patHtml = '';
      if (patterns.hookPatterns && patterns.hookPatterns.length) {
        patHtml += '<div style="font-size:12px;font-weight:600;color:#FFD93D;margin:6px 0;">Hook patterns:</div>';
        patterns.hookPatterns.slice(0, 5).forEach(function(p) {
          patHtml += '<div style="padding:4px 8px;margin:2px 0;background:rgba(0,0,0,0.2);border-radius:6px;font-size:11px;">' + (typeof p === 'string' ? p : JSON.stringify(p)) + '</div>';
        });
      }
      if (patterns.titleFormulas && patterns.titleFormulas.length) {
        patHtml += '<div style="font-size:12px;font-weight:600;color:#2EE9FF;margin:8px 0 4px;">Title formulas:</div>';
        patterns.titleFormulas.slice(0, 5).forEach(function(f) {
          patHtml += '<div style="padding:4px 8px;margin:2px 0;background:rgba(0,0,0,0.2);border-radius:6px;font-size:11px;">' + (typeof f === 'string' ? f : JSON.stringify(f)) + '</div>';
        });
      }
      if (viral.viralVideos && viral.viralVideos.length) {
        patHtml += '<div style="font-size:12px;font-weight:600;color:#FF6B6B;margin:8px 0 4px;">Top viral videos:</div>';
        viral.viralVideos.slice(0, 5).forEach(function(v) {
          patHtml += '<div style="padding:4px 8px;margin:2px 0;background:rgba(0,0,0,0.2);border-radius:6px;font-size:11px;display:flex;justify-content:space-between;">'
            + '<span>' + v.title.slice(0, 60) + '</span><span style="color:#FF6B6B;">' + Math.round(v.views / 1000) + 'K</span></div>';
        });
      }
      document.getElementById('rep-patterns-content').innerHTML = patHtml || '<span style="opacity:0.4;">No patterns detected</span>';

      // Replication Plan from subniches
      var planHtml = '';
      if (subniches.replicationIdeas && subniches.replicationIdeas.length) {
        subniches.replicationIdeas.forEach(function(ri, i) {
          planHtml += '<div style="padding:10px;margin:6px 0;background:rgba(0,220,130,0.06);border-radius:8px;border-left:3px solid #00DC82;">'
            + '<div style="font-weight:700;font-size:12px;color:#00DC82;">' + (i + 1) + '. ' + ri.originalConcept + '</div>'
            + '<div style="font-size:11px;margin:4px 0;">Your twist: <span style="color:#2EE9FF;">' + ri.yourTwist + '</span></div>'
            + '<div style="font-size:11px;opacity:0.5;">Differentiator: ' + ri.differentiator + '</div>'
            + '<div style="font-size:11px;margin-top:4px;color:#FFD93D;">Example: ' + ri.exampleTitle + '</div></div>';
        });
      }
      document.getElementById('rep-plan-content').innerHTML = planHtml || '<span style="opacity:0.4;">No replication ideas generated</span>';

      // Sub-niches
      var anglesHtml = '';
      if (subniches.subNiches && subniches.subNiches.length) {
        subniches.subNiches.forEach(function(sn, i) {
          var dc = sn.difficulty === 'EASY' ? '#00DC82' : sn.difficulty === 'MEDIUM' ? '#FFD93D' : '#FF6B6B';
          anglesHtml += '<div style="padding:10px;margin:6px 0;background:rgba(0,0,0,0.2);border-radius:8px;border-left:3px solid ' + dc + ';">'
            + '<div style="font-weight:700;font-size:12px;color:#2EE9FF;">' + sn.name + '</div>'
            + '<div style="font-size:11px;margin:3px 0;"><span style="color:' + dc + ';">' + sn.difficulty + '</span> | RPM ~$' + sn.estimatedRpm + ' | ' + sn.contentFrequency + '</div>'
            + '<div style="font-size:11px;opacity:0.6;">' + sn.angle + '</div></div>';
        });
      }
      document.getElementById('rep-angles-content').innerHTML = anglesHtml || '<span style="opacity:0.4;">No angles generated</span>';

      // Content Calendar
      var calHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      var days = ['Mon', 'Wed', 'Fri', 'Mon', 'Wed', 'Fri'];
      var weekLabels = ['Week 1', 'Week 1', 'Week 1', 'Week 2', 'Week 2', 'Week 2'];
      var allTitles = [];
      if (subniches.subNiches) {
        subniches.subNiches.forEach(function(sn) {
          if (sn.exampleTitles) allTitles = allTitles.concat(sn.exampleTitles);
        });
      }
      for (var d = 0; d < 6; d++) {
        var title = allTitles[d] || 'Video ' + (d + 1);
        calHtml += '<div style="padding:8px;background:rgba(255,217,61,0.06);border-radius:8px;">'
          + '<div style="font-size:10px;opacity:0.4;">' + weekLabels[d] + ', ' + days[d] + '</div>'
          + '<div style="font-size:11px;font-weight:600;margin-top:3px;">' + title + '</div></div>';
      }
      calHtml += '</div>';
      document.getElementById('rep-calendar-content').innerHTML = calHtml;

      loading.style.display = 'none';
      results.style.display = 'block';

    } catch (err) {
      loading.style.display = 'none';
      document.getElementById('rep-overview-content').innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
      results.style.display = 'block';
    }
  });

  // Full Replication with scripts
  var fullBtn = document.getElementById('rep-full-replicate-btn');
  if (fullBtn) {
    fullBtn.addEventListener('click', async function() {
      var url = document.getElementById('rep-input-url').value.trim();
      var lang = document.getElementById('rep-language').value;
      if (!url) return;

      var loading = document.getElementById('rep-loading');
      var results = document.getElementById('rep-results');
      var progress = document.getElementById('rep-progress');
      loading.style.display = 'block';
      results.style.display = 'none';

      try {
        progress.textContent = 'Generating full replication scripts with AI, 30 to 90 seconds';
        var data = await API.apiReplicateContent(url, { language: lang, targetVideos: 5 });

        var plans = data.replicationPlans || [];
        var strategy = data.channelStrategy || {};
        var meta = data.metadata || {};
        var srcAnalysis = data.sourceAnalysis || {};

        // Overview
        document.getElementById('rep-overview-content').innerHTML =
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">'
          + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
          + '<div style="font-size:16px;font-weight:800;">' + (meta.sourceChannel || url) + '</div>'
          + '<div style="font-size:10px;opacity:0.5;">Source</div></div>'
          + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
          + '<div style="font-size:16px;font-weight:800;color:#2EE9FF;">' + meta.videosAnalyzed + '</div>'
          + '<div style="font-size:10px;opacity:0.5;">Analyzed</div></div>'
          + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
          + '<div style="font-size:16px;font-weight:800;color:#FF6B6B;">' + meta.viralVideosFound + '</div>'
          + '<div style="font-size:10px;opacity:0.5;">Viral</div></div>'
          + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
          + '<div style="font-size:16px;font-weight:800;color:#00DC82;">' + plans.length + '</div>'
          + '<div style="font-size:10px;opacity:0.5;">Scripts Ready</div></div></div>';

        // Replication Plans (scripts)
        var planHtml = '';
        plans.forEach(function(plan, i) {
          var script = plan.script || {};
          var thumb = plan.thumbnailConcept || {};
          var prod = plan.productionNotes || {};
          planHtml += '<div style="padding:14px;margin:10px 0;background:rgba(0,220,130,0.04);border-radius:10px;border:1px solid rgba(0,220,130,0.15);">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
            + '<span style="font-size:15px;font-weight:800;color:#00DC82;">Video ' + plan.videoNumber + ': ' + plan.title + '</span></div>'
            + '<div style="font-size:11px;opacity:0.5;margin-bottom:8px;">Inspired by: ' + (plan.originalInspiration || '').slice(0, 60) + ' | Angle: ' + (plan.differentiationAngle || '') + '</div>';

          // Title variants
          if (plan.titleVariants && plan.titleVariants.length) {
            planHtml += '<div style="margin:6px 0;"><span style="font-size:10px;font-weight:700;color:#FFD93D;">Alt titles: </span><span style="font-size:10px;opacity:0.5;">' + plan.titleVariants.join(' | ') + '</span></div>';
          }

          // Thumbnail
          planHtml += '<div style="margin:8px 0;padding:8px;background:rgba(179,136,255,0.08);border-radius:6px;">'
            + '<div style="font-size:11px;font-weight:700;color:#B388FF;">\ud83d\uddbc\ufe0f Thumbnail</div>'
            + '<div style="font-size:10px;margin:3px 0;">Visual: ' + (thumb.mainVisual || '') + '</div>'
            + '<div style="font-size:10px;">Text: "' + (thumb.textOverlay || '') + '" | Colors: ' + (thumb.colorScheme || '') + '</div>'
            + '<div style="font-size:10px;opacity:0.4;">AI Prompt: ' + (thumb.aiPrompt || '') + '</div></div>';

          // Script
          planHtml += '<div style="margin:8px 0;padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;">'
            + '<div style="font-size:11px;font-weight:700;color:#2EE9FF;">\ud83d\udcdd Script</div>'
            + '<div style="font-size:11px;color:#FF6B6B;margin:4px 0;"><b>Hook:</b> ' + (script.hook || '') + '</div>'
            + '<div style="font-size:11px;margin:4px 0;"><b>Intro:</b> ' + (script.intro || '') + '</div>';
          if (script.sections && script.sections.length) {
            script.sections.forEach(function(sec) {
              planHtml += '<div style="margin:4px 0;padding:4px 6px;border-left:2px solid rgba(255,255,255,0.1);">'
                + '<div style="font-size:10px;font-weight:600;">' + sec.sectionTitle + ' (' + sec.durationSeconds + 's)</div>'
                + '<div style="font-size:10px;opacity:0.7;">' + (sec.script || '').slice(0, 200) + '</div>'
                + '<div style="font-size:9px;opacity:0.4;">Visual: ' + (sec.visualNotes || '') + '</div></div>';
            });
          }
          planHtml += '<div style="font-size:11px;margin:4px 0;"><b>Outro:</b> ' + (script.outro || '') + '</div>'
            + '<div style="font-size:10px;opacity:0.4;">Duration: ' + (script.totalEstimatedDuration || '') + '</div></div>';

          // Production notes
          planHtml += '<div style="margin:6px 0;font-size:10px;opacity:0.5;">'
            + 'Voice: ' + (prod.voiceStyle || '') + ' | Music: ' + (prod.musicMood || '') + ' | Edit: ' + (prod.editingStyle || '')
            + '</div>';

          // Tags
          if (plan.tags && plan.tags.length) {
            planHtml += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin:4px 0;">';
            plan.tags.slice(0, 10).forEach(function(tag) {
              planHtml += '<span style="font-size:9px;padding:2px 6px;background:rgba(255,255,255,0.06);border-radius:3px;">#' + tag + '</span>';
            });
            planHtml += '</div>';
          }

          planHtml += '</div>';
        });
        document.getElementById('rep-plan-content').innerHTML = planHtml || '<span style="opacity:0.4;">No plans generated</span>';

        // Strategy
        var stratHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
          + '<div style="padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;"><div style="font-size:10px;opacity:0.5;">Upload Frequency</div><div style="font-size:12px;font-weight:600;">' + (strategy.uploadFrequency || '?') + '</div></div>'
          + '<div style="padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;"><div style="font-size:10px;opacity:0.5;">First Month Goal</div><div style="font-size:12px;font-weight:600;">' + (strategy.firstMonthGoal || '?') + '</div></div>'
          + '<div style="padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;"><div style="font-size:10px;opacity:0.5;">Differentiator</div><div style="font-size:12px;font-weight:600;">' + (strategy.keyDifferentiator || '?') + '</div></div>'
          + '<div style="padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;"><div style="font-size:10px;opacity:0.5;">Audience Overlap</div><div style="font-size:12px;font-weight:600;">' + (strategy.audienceOverlap || '?') + '</div></div></div>';
        document.getElementById('rep-angles-content').innerHTML = stratHtml;

        // Clear calendar and patterns since this mode replaces them
        document.getElementById('rep-patterns-content').innerHTML = '<span style="opacity:0.4;">See full scripts above</span>';
        document.getElementById('rep-calendar-content').innerHTML = '<span style="opacity:0.4;">Follow the strategy grid above</span>';

        loading.style.display = 'none';
        results.style.display = 'block';

      } catch (err) {
        loading.style.display = 'none';
        document.getElementById('rep-overview-content').innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
        results.style.display = 'block';
      }
    });
  }
})();

// Brand Builder Logic
(function initBrandBuilder() {
  var btn = document.getElementById('brand-generate-btn');
  if (!btn) return;
  var API = window.AshlyVAPI;
  if (!API) return;

  btn.addEventListener('click', async function() {
    var niche = document.getElementById('brand-niche-input').value.trim();
    var tone = document.getElementById('brand-tone').value;
    var lang = document.getElementById('brand-language').value;
    if (!niche) return;

    document.getElementById('brand-loading').style.display = 'block';
    document.getElementById('brand-results').style.display = 'none';

    try {
      var data = await API.apiBuildBrand(niche, { language: lang, tone: tone });

      // Names
      var namesHtml = '';
      if (data.channelNames && data.channelNames.length) {
        data.channelNames.forEach(function(n) {
          var seoColor = n.seoScore === 'HIGH' ? '#00DC82' : n.seoScore === 'MEDIUM' ? '#FFD93D' : '#FF6B6B';
          namesHtml += '<div style="padding:10px;margin:6px 0;background:rgba(0,0,0,0.2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">'
            + '<div><div style="font-size:16px;font-weight:800;color:#FFD93D;">' + n.name + '</div>'
            + '<div style="font-size:11px;opacity:0.5;">' + n.handle + ' | ' + n.reasoning + '</div></div>'
            + '<div style="display:flex;gap:4px;">'
            + '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:' + seoColor + '22;color:' + seoColor + ';">SEO: ' + n.seoScore + '</span>'
            + '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(179,136,255,0.2);color:#B388FF;">Memo: ' + n.memorability + '</span>'
            + '</div></div>';
        });
      }
      document.getElementById('brand-names-content').innerHTML = namesHtml;

      // Bio
      var bio = data.bio || {};
      var bioHtml = '<div style="font-size:14px;font-weight:700;color:#B388FF;margin-bottom:4px;">"' + (bio.short || '') + '"</div>'
        + '<div style="font-size:12px;opacity:0.7;margin:8px 0;padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;white-space:pre-wrap;">' + (bio.full || '') + '</div>';
      if (bio.keywords && bio.keywords.length) {
        bioHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        bio.keywords.forEach(function(k) {
          bioHtml += '<span style="font-size:10px;padding:2px 6px;background:rgba(255,255,255,0.06);border-radius:3px;">' + k + '</span>';
        });
        bioHtml += '</div>';
      }
      document.getElementById('brand-bio-content').innerHTML = bioHtml;

      // Visual Identity
      var vis = data.visualIdentity || {};
      var visHtml = '';
      if (vis.colorPalette && vis.colorPalette.length) {
        visHtml += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">';
        vis.colorPalette.forEach(function(c) {
          visHtml += '<div style="text-align:center;"><div style="width:50px;height:50px;border-radius:8px;background:' + c.hex + ';border:1px solid rgba(255,255,255,0.1);"></div>'
            + '<div style="font-size:9px;margin-top:3px;">' + c.name + '</div><div style="font-size:8px;opacity:0.4;">' + c.hex + '</div></div>';
        });
        visHtml += '</div>';
      }
      var thumb = vis.thumbnailStyle || {};
      visHtml += '<div style="padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;margin:6px 0;">'
        + '<div style="font-size:11px;font-weight:600;color:#2EE9FF;">Thumbnail Style</div>'
        + '<div style="font-size:10px;opacity:0.7;">Layout: ' + (thumb.layout || '') + '</div>'
        + '<div style="font-size:10px;opacity:0.7;">Recurring: ' + (thumb.recurringElements || '') + '</div>'
        + '<div style="font-size:9px;opacity:0.4;margin-top:3px;">AI Prompt: ' + (thumb.examplePrompt || '') + '</div></div>';
      var avatar = vis.avatarConcept || {};
      visHtml += '<div style="padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;margin:6px 0;">'
        + '<div style="font-size:11px;font-weight:600;color:#B388FF;">Avatar / Logo</div>'
        + '<div style="font-size:10px;opacity:0.7;">' + (avatar.description || '') + '</div>'
        + '<div style="font-size:9px;opacity:0.4;">AI Prompt: ' + (avatar.aiPrompt || '') + '</div></div>';
      document.getElementById('brand-visual-content').innerHTML = visHtml;

      // Strategy
      var strat = data.contentStrategy || {};
      var stratHtml = '<div style="margin-bottom:8px;font-size:12px;"><b>Upload:</b> ' + (strat.uploadSchedule || '?') + '</div>';
      if (strat.pillarTopics) {
        stratHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;">';
        strat.pillarTopics.forEach(function(p) {
          stratHtml += '<span style="font-size:10px;padding:3px 8px;background:rgba(0,220,130,0.12);border-radius:4px;color:#00DC82;">' + p + '</span>';
        });
        stratHtml += '</div>';
      }
      if (strat.firstMonth && strat.firstMonth.length) {
        stratHtml += '<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
        strat.firstMonth.forEach(function(w) {
          stratHtml += '<div style="padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;">'
            + '<div style="font-size:10px;font-weight:700;color:#FFD93D;">Week ' + w.week + '</div>';
          if (w.videos) {
            w.videos.forEach(function(v) { stratHtml += '<div style="font-size:10px;opacity:0.7;margin:2px 0;">\u25b8 ' + v + '</div>'; });
          }
          stratHtml += '</div>';
        });
        stratHtml += '</div>';
      }
      document.getElementById('brand-strategy-content').innerHTML = stratHtml;

      // Monetization
      var mon = data.monetization || {};
      document.getElementById('brand-money-content').innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:800;color:#00DC82;">$' + (mon.estimatedRpm || '?') + '</div>'
        + '<div style="font-size:10px;opacity:0.5;">RPM</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:800;color:#FFD93D;">' + (mon.revenueAt100kViews || '?') + '</div>'
        + '<div style="font-size:10px;opacity:0.5;">per 100K views</div></div>'
        + '<div style="padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">'
        + '<div style="font-size:14px;font-weight:800;color:#2EE9FF;">' + (mon.timeToMonetization || '?') + '</div>'
        + '<div style="font-size:10px;opacity:0.5;">to monetize</div></div></div>';

      document.getElementById('brand-loading').style.display = 'none';
      document.getElementById('brand-results').style.display = 'block';

    } catch (err) {
      document.getElementById('brand-loading').style.display = 'none';
      document.getElementById('brand-names-content').innerHTML = '<span style="color:#FF6B6B;">Error: ' + err.message + '</span>';
      document.getElementById('brand-results').style.display = 'block';
    }
  });
})();

// ASHLYV DASHBOARD - ALL FEATURES ACTIVE

// A MutationObserver re-registers new cards because the dashboard re-renders several times.
(function () {
  try {
    if (!('IntersectionObserver' in window) || !document.body) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('nsp-in'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    function register() {
      var els = document.querySelectorAll('.stats-bar:not(.nsp-rev), .insights-hero:not(.nsp-rev), .engine-root > *:not(.nsp-rev), .section-hdr:not(.nsp-rev), .nicho-grid > div:not(.nsp-rev), .tool-card:not(.nsp-rev), .stack-item:not(.nsp-rev)');
      for (var i = 0; i < els.length; i++) { els[i].classList.add('nsp-rev'); io.observe(els[i]); }
    }
    function failsafe() { var p = document.querySelectorAll('.nsp-rev:not(.nsp-in)'); for (var i = 0; i < p.length; i++) p[i].classList.add('nsp-in'); }
    register();
    var raf = null, ft = null;
    var mo = new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(function () { raf = null; register(); }); if (ft) clearTimeout(ft); ft = setTimeout(failsafe, 9000); });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(failsafe, 9000);
  } catch (e) {}
})();
