var engine = window.ASHLYVEngine || null;
var currentTranslated = '';
var currentBlueprintPrompt = '';
var currentRobaPrompt = '';
var currentRobaSnapshot = null;
var targetLang = 'en';
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
  var fields = Object.assign({}, message);
  var type = fields.type;
  delete fields.type;
  return window.AshlyVAPI.sendToSW(type, fields).catch(function(err) {
    return { ok: false, error: err && err.reason ? err.reason : 'runtime_error', detail: err && err.message ? err.message : String(err) };
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
      opportunity: opportunity,
      source: 'watchlist'
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
  var t = document.createElement('div'); t.textContent = 'Could not open that tool'; t.style.cssText = 'font-size:16px;font-weight:900;color:#00DC82;margin-bottom:9px;';
  var d = document.createElement('div'); d.textContent = 'If you just updated, reload the extension in chrome://extensions and try again.'; d.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.62);line-height:1.55;margin-bottom:16px;';
  var c = document.createElement('button'); c.textContent = 'Close'; c.style.cssText = 'display:block;margin:12px auto 0;background:transparent;border:none;color:rgba(255,255,255,0.4);font-size:11px;cursor:pointer;font-family:inherit;';
  c.addEventListener('click', function () { if (ov.parentNode) ov.parentNode.removeChild(ov); });
  box.appendChild(t); box.appendChild(d); box.appendChild(c);
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
  function renderResultRows(target, titleText, rows, mapper) {
    target.appendChild(el('div', '', titleText));
    target.lastChild.style.cssText = 'font-size:12px;font-weight:900;letter-spacing:.12em;margin:14px 0 8px;';
    if (!rows || !rows.length) {
      target.appendChild(el('div', '', 'Nothing to show for this search.'));
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
      var url = /^https:\/\/(?:www\.)?youtube\.com\//i.test(String(mapped.url || '')) ? mapped.url : '';
      if (mapped.search || mapped.copy || url) {
        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;';
        if (mapped.copy) actions.appendChild(toolButton('COPY', function() { copyToolText(mapped.copy, 'Copied'); }));
        if (url) actions.appendChild(toolButton('OPEN', function() { try { window.open(url, '_blank', 'noopener'); } catch (e) {} }, true));
        if (mapped.search) actions.appendChild(toolButton('SEARCH', function() { searchNicheTerm(mapped.search, app.state.selectedLanguage || 'auto'); }, true));
        item.appendChild(actions);
      }
      target.appendChild(item);
    });
  }
  function toolNote(target, text) {
    target.appendChild(el('div', '', text));
    target.lastChild.style.cssText = 'font-size:12px;color:rgba(255,255,255,.62);line-height:1.6;margin-bottom:6px;';
  }
  function toolLocale() {
    return getYouTubeLocale(app.state.selectedLanguage || 'auto');
  }
  function toolLanguage() {
    var code = String(app.state.selectedLanguage || 'auto');
    return code === 'auto' ? 'en' : code;
  }
  function buildLiveRunner(titleText, subtitleText, defaultValue, buttonLabel, runFn, renderFn) {
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
    controls.appendChild(toolButton(buttonLabel || 'RUN', function() {
      clearNode(out);
      if (!window.AshlyVAPI) {
        out.appendChild(el('div', '', 'The data client did not load on this page. Reload it.'));
        return;
      }
      out.appendChild(el('div', '', 'Working, this reads YouTube live'));
      out.lastChild.style.cssText = 'font-size:12px;color:rgba(255,255,255,.62);';
      Promise.resolve().then(function() {
        return runFn(String(input.value || '').trim());
      }).then(function(response) {
        clearNode(out);
        renderFn(out, response);
      }).catch(function(error) {
        clearNode(out);
        out.appendChild(el('div', '', 'Error: ' + (error && error.message ? error.message : error)));
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
        buildLiveRunner(
          'MARKET RADAR, LIVE',
          'Searches each keyword on YouTube and measures what ranks: views, how many channels share the results and how much of it is recent. Separate keywords with commas.',
          topByRpm[0] ? (topByRpm[0].niche || topByRpm[0].title || 'mystery documentary') : 'mystery documentary, hidden history, wild nature',
          'SCAN THE MARKET',
          function(value) {
            var seeds = value.split(/[\n,]+/).map(function(x) { return x.trim(); }).filter(Boolean);
            return window.AshlyVAPI.marketRadar(seeds, toolLocale());
          },
          function(out, rows) {
            renderResultRows(out, 'MEASURED IN YOUTUBE SEARCH', rows || [], function(item) {
              if (item.error) return { title: item.keyword, meta: 'Error: ' + item.error };
              return {
                title: item.keyword,
                meta: item.results + ' results | median views ' + hubCount(item.medianViews) + ' | top ' + hubCount(item.topViews) + ' | ' + item.distinctChannels + ' channels, the biggest holds ' + hubPct(item.leadChannelShare) + ' of the views | ' + item.recentCount + ' from the last 30 days' + (item.recentCount ? ', median ' + hubCount(item.recentMedianViews) : ''),
                search: item.keyword,
                copy: item.keyword
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
        buildLiveRunner(
          'COMPETITOR MAP, LIVE',
          'Paste an @channel, a channel link or a keyword. A channel is searched by the words its titles repeat most; the channels that rank for them are grouped and ranked by views in the results.',
          topChannels[0] ? (topChannels[0].channelUrl || topChannels[0].name || topChannels[0].channelName || '') : 'mystery documentary',
          'MAP COMPETITORS',
          function(value) { return window.AshlyVAPI.competitorMap(value || 'mystery documentary', toolLocale()); },
          function(out, data) {
            toolNote(out, data.basis === 'channel'
              ? 'Searched "' + data.query + '", built from the titles of ' + data.channel + '. ' + data.sample + ' results, that channel left out.'
              : data.sample + ' results for "' + data.query + '".');
            renderResultRows(out, 'CHANNELS IN THE RESULTS', data.competitors, function(item) {
              return {
                title: item.name || 'Channel',
                meta: item.videosInResults + ' videos in the results | ' + hubCount(item.totalViews) + ' views across them | median ' + hubCount(item.medianViews) + (item.topVideo ? ' | top: ' + item.topVideo.title : ''),
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
        buildLiveRunner(
          'GAP FINDER, LIVE',
          'Searches a keyword on YouTube and lists the words that few of the ranking videos use but that pull at least twice the median views of the search.',
          gaps[0] ? (gaps[0].niche || gaps[0].title || 'hidden history') : 'hidden history',
          'FIND GAPS',
          function(value) { return window.AshlyVAPI.gapFinder(value || 'hidden history', toolLocale()); },
          function(out, data) {
            toolNote(out, 'Median views across ' + data.sample + ' results for "' + data.query + '": ' + hubCount(data.overallMedianViews) + '. A small sample, so read these as leads to check.');
            renderResultRows(out, 'UNDER-SERVED WORDS', data.gaps, function(item) {
              return {
                title: item.term,
                meta: 'in ' + item.videos + ' of ' + data.sample + ' results | median views ' + hubCount(item.medianViews) + ' | ' + item.lift.toFixed(1) + 'x the search median',
                search: data.query + ' ' + item.term,
                copy: item.term
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
        buildLiveRunner(
          'PATTERN FINDER, LIVE',
          'Takes a keyword or a channel, reads the real titles and measures their length, the devices they use and the words they repeat, next to the views they got.',
          keywordStats[0] ? keywordStats[0].word : 'mystery',
          'DETECT PATTERNS',
          function(value) { return window.AshlyVAPI.patternFinder(value || 'mystery', toolLocale()); },
          function(out, data) {
            var p = data.patterns;
            toolNote(out, 'Measured on ' + p.sample + ' titles from ' + (data.source === 'channel' ? 'the channel ' + data.label : 'the search "' + data.label + '"') + '. Average ' + (p.avgWords === null ? '?' : p.avgWords.toFixed(1)) + ' words.');
            renderResultRows(out, 'TITLE DEVICES', p.features, function(f) {
              return {
                title: hubPct(f.share) + ' use ' + f.feature,
                meta: f.medianViewsWith !== null && f.medianViewsWithout !== null ? 'median views with it ' + hubCount(f.medianViewsWith) + ', without it ' + hubCount(f.medianViewsWithout) : 'too few titles on one side to compare views'
              };
            });
            renderResultRows(out, 'REPEATED WORDS', p.topTerms, function(t) {
              return { title: t.term, meta: t.count + ' titles | median views ' + hubCount(t.medianViews), search: t.term, copy: t.term };
            });
            renderResultRows(out, 'TOP VIDEOS', data.top, function(v) {
              return { title: v.title, meta: (v.viewsText || hubCount(v.views)) + (v.publishedText ? ' | ' + v.publishedText : ''), url: v.url, copy: v.title };
            });
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
          { title: 'Generates titles, hooks and thumbnail concepts', meta: 'Runs inside the extension, no server needed.', actionLabel: 'OPEN IDEAS', action: function() { closeAshlyVToolWorkspace(); openThumbnailModal(); setTimeout(function() { thumbSetTab('ideas'); }, 40); } },
          { title: 'Uses the AI provider you pick in Options', meta: 'OpenAI, Groq, Gemini or a local Ollama, always through the extension.', actionLabel: 'OPEN SCAN', action: function() { closeAshlyVToolWorkspace(); openScanModal('channel'); } }
        ]);
        buildLiveRunner(
          'AI CONTENT ENGINE',
          'Writes a title, a hook and an outline with the AI provider you set in Options. It is a suggestion to edit, not a finished script.',
          topByRpm[0] ? (topByRpm[0].niche || topByRpm[0].title || 'faceless historical mysteries') : 'faceless historical mysteries',
          'GENERATE OUTLINE',
          function(value) { return window.AshlyVAPI.generateContentScript(value || 'faceless historical mysteries', { language: toolLanguage(), minutes: 8 }); },
          function(out, data) {
            toolNote(out, 'AI suggestion' + (data.provider ? ' by ' + [data.provider, data.model].filter(Boolean).join(' ') : '') + '. Check it before you record.');
            var rows = [{ title: data.title || 'Title', meta: data.hook }].concat(data.outline.map(function(s) {
              return { title: hubTextOf(s.section), meta: hubTextOf(s.summary) };
            }));
            if (data.thumbnailConcept) rows.push({ title: 'Thumbnail', meta: data.thumbnailConcept });
            var full = rows.map(function(r) { return r.title + (r.meta ? '\n' + r.meta : ''); }).join('\n\n');
            renderResultRows(out, 'SCRIPT OUTLINE', rows, function(item) {
              return { title: item.title, meta: item.meta || '', copy: full };
            });
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
// YouTube's published thumbnail guidance: 1280x720 recommended, 640 px minimum width, 16:9, under 2 MB, JPG, PNG or GIF.
var THUMB_GUIDE = { width: 1280, height: 720, minWidth: 640, maxBytes: 2 * 1024 * 1024, types: /^image\/(?:jpeg|png|gif)$/i };
// The size YouTube uses for thumbnails in side lists and search on desktop.
var THUMB_LIST_SIZE = { width: 168, height: 94 };

function thumbClear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
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

// Names the providers the cascade will try, never the keys.
function updateAiStatus() {
  var box = document.getElementById('ai-provider-status');
  if (!box || !window.AshlyVAPI) return;
  window.AshlyVAPI.getProviderStatus().then(function(status) {
    if (status.configured) {
      box.textContent = 'AI provider ready: ' + status.providers.join(', ') + '. Model: ' + (status.selectedModel === 'auto' ? 'automatic' : status.selectedModel) + '.';
      box.setAttribute('data-tone', 'success');
    } else {
      box.textContent = 'No AI provider configured. Add an OpenAI, Groq or Gemini key, or enable Ollama, in Options.';
      box.setAttribute('data-tone', 'warning');
    }
  });
}

function openThumbnailModal() {
  closeToolsModal();
  openScanModal('thumbnail');
  thumbSetTab('analyze');
}

function thumbSetTab(tab) {
  var tabs = { analyze: 'thumb-analyze-panel', history: 'thumb-history-panel', ideas: 'thumb-ideas-panel' };
  Object.keys(tabs).forEach(function(name) {
    var btn = document.getElementById('thumb-tab-' + name);
    var panel = document.getElementById(tabs[name]);
    if (btn) btn.classList.toggle('active', tab === name);
    if (panel) panel.style.display = tab === name ? 'block' : 'none';
  });
  if (tab === 'history') loadThumbnailHistory();
  if (tab === 'ideas') updateAiStatus();
}

function thumbFileToDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(String(reader.result || '')); };
    reader.onerror = function() { reject(new Error('Could not read the file.')); };
    reader.readAsDataURL(file);
  });
}

function thumbLoadImage(dataUrl) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('The image has no readable size.'));
      else resolve(img);
    };
    img.onerror = function() { reject(new Error('The browser could not decode this image.')); };
    img.src = dataUrl;
  });
}

function thumbPixels(img, width, height) {
  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

// Pure pixel statistics over RGBA data. Contrast is the RMS contrast of luma, colorfulness the
// Hasler and Suesstrunk metric, detail the share of pixels on a strong luma edge.
function measurePixels(data, width, height) {
  var n = width * height;
  var luma = new Float32Array(n);
  var sumL = 0, sumL2 = 0, sumSat = 0, clipped = 0;
  var sumRg = 0, sumRg2 = 0, sumYb = 0, sumYb2 = 0;
  var buckets = {};
  for (var i = 0, p = 0; p < n; i += 4, p++) {
    var r = data[i], g = data[i + 1], b = data[i + 2];
    var l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[p] = l;
    sumL += l;
    sumL2 += l * l;
    if (l < 8 || l > 247) clipped++;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sumSat += mx ? (mx - mn) / mx : 0;
    var rg = r - g, yb = 0.5 * (r + g) - b;
    sumRg += rg; sumRg2 += rg * rg; sumYb += yb; sumYb2 += yb * yb;
    var key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
    buckets[key] = (buckets[key] || 0) + 1;
  }
  var meanL = sumL / n;
  var sdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
  var mRg = sumRg / n, mYb = sumYb / n;
  var sdRg = Math.sqrt(Math.max(0, sumRg2 / n - mRg * mRg));
  var sdYb = Math.sqrt(Math.max(0, sumYb2 / n - mYb * mYb));
  var edges = 0, cells = 0;
  for (var y = 1; y < height - 1; y++) {
    for (var x = 1; x < width - 1; x++) {
      var c = y * width + x;
      var gx = luma[c + 1] - luma[c - 1];
      var gy = luma[c + width] - luma[c - width];
      if (Math.sqrt(gx * gx + gy * gy) > 60) edges++;
      cells++;
    }
  }
  var palette = Object.keys(buckets).sort(function(a, b) { return buckets[b] - buckets[a]; }).slice(0, 5).map(function(k) {
    return '#' + k.split(',').map(function(v) {
      var hex = ((+v) * 32 + 16).toString(16);
      return hex.length < 2 ? '0' + hex : hex;
    }).join('');
  });
  return {
    brightness: meanL / 255,
    contrast: sdL / 255,
    saturation: sumSat / n,
    colorfulness: Math.sqrt(sdRg * sdRg + sdYb * sdYb) + 0.3 * Math.sqrt(mRg * mRg + mYb * mYb),
    detail: cells ? edges / cells : 0,
    clipped: clipped / n,
    palette: palette
  };
}

function measureThumbnailFile(file) {
  return thumbFileToDataUrl(file).then(function(dataUrl) {
    return thumbLoadImage(dataUrl).then(function(img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      var workW = 320, workH = Math.max(1, Math.round(320 * h / w));
      return {
        dataUrl: dataUrl,
        name: String(file.name || ''),
        type: String(file.type || ''),
        bytes: file.size,
        width: w,
        height: h,
        full: measurePixels(thumbPixels(img, workW, workH), workW, workH),
        list: measurePixels(thumbPixels(img, THUMB_LIST_SIZE.width, THUMB_LIST_SIZE.height), THUMB_LIST_SIZE.width, THUMB_LIST_SIZE.height)
      };
    });
  });
}

function thumbBand(value, low, high, words) {
  return value < low ? words[0] : value < high ? words[1] : words[2];
}

// Hasler and Suesstrunk published these bands for their colorfulness metric.
function thumbColorfulnessBand(m) {
  if (m < 15) return 'not colorful';
  if (m < 33) return 'slightly colorful';
  if (m < 45) return 'moderately colorful';
  if (m < 59) return 'averagely colorful';
  if (m < 82) return 'quite colorful';
  if (m < 109) return 'highly colorful';
  return 'extremely colorful';
}

function thumbChecks(m) {
  var ratio = m.width / m.height;
  var sizeState = m.width >= THUMB_GUIDE.width && m.height >= THUMB_GUIDE.height ? 'good' : m.width >= THUMB_GUIDE.minWidth ? 'warn' : 'bad';
  return [
    { label: 'Resolution', value: m.width + ' x ' + m.height, state: sizeState, hint: 'YouTube recommends 1280 x 720 and accepts 640 px wide at least.' },
    { label: 'Aspect ratio', value: ratio.toFixed(2) + ':1', state: Math.abs(ratio - 16 / 9) <= 0.04 ? 'good' : 'bad', hint: 'YouTube shows thumbnails at 16:9 (1.78:1) and crops or pads the rest.' },
    { label: 'File size', value: (m.bytes / 1024 / 1024).toFixed(2) + ' MB', state: m.bytes <= THUMB_GUIDE.maxBytes ? 'good' : 'bad', hint: 'YouTube rejects thumbnails over 2 MB.' },
    { label: 'Format', value: m.type || 'unknown', state: THUMB_GUIDE.types.test(m.type) ? 'good' : 'bad', hint: 'YouTube takes JPG, PNG or GIF.' }
  ];
}

var THUMB_STATE_STYLE = { good: { text: 'OK', color: '#00DC82' }, warn: { text: 'LOW', color: '#FFD93D' }, bad: { text: 'FIX', color: '#FF6B6B' } };

function displayThumbnailMeasurements(m) {
  var host = document.getElementById('thumb-result-panel');
  if (!host) return;
  thumbClear(host);
  host.appendChild(hubNode('div', 'font-size:16px;font-weight:900;margin-bottom:4px;', 'Measured from the pixels'));
  host.appendChild(hubNode('div', 'font-size:11px;color:rgba(255,255,255,.55);margin-bottom:10px;line-height:1.5;', 'These are measurements, not a click prediction. Compare them with the thumbnails that win in your niche in ThumbLab.'));

  thumbChecks(m).forEach(function(check) {
    var style = THUMB_STATE_STYLE[check.state];
    var row = hubNode('div', 'display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12px;');
    var left = hubNode('div', '', check.label + ': ' + check.value);
    left.appendChild(hubNode('div', 'font-size:10px;color:rgba(255,255,255,.5);margin-top:2px;', check.hint));
    row.appendChild(left);
    row.appendChild(hubNode('span', 'font-weight:900;color:' + style.color + ';', style.text));
    host.appendChild(row);
  });

  var f = m.full, s = m.list;
  var rows = [
    ['Brightness', Math.round(f.brightness * 100) + '%, ' + thumbBand(f.brightness, 0.25, 0.6, ['dark', 'balanced', 'bright'])],
    ['Contrast (RMS)', Math.round(f.contrast * 100) + '%, ' + thumbBand(f.contrast, 0.15, 0.25, ['low', 'medium', 'high'])],
    ['Contrast at list size (168 x 94)', Math.round(s.contrast * 100) + '%'],
    ['Saturation', Math.round(f.saturation * 100) + '%'],
    ['Colorfulness', Math.round(f.colorfulness) + ', ' + thumbColorfulnessBand(f.colorfulness)],
    ['Detail (pixels on a strong edge)', Math.round(f.detail * 100) + '%'],
    ['Pure black or white pixels', Math.round(f.clipped * 100) + '%']
  ];
  host.appendChild(hubNode('div', 'font-size:12px;letter-spacing:.12em;color:rgba(255,255,255,.62);margin-top:16px;', 'MEASUREMENTS'));
  rows.forEach(function(r) {
    var row = hubNode('div', 'display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12px;');
    row.appendChild(hubNode('span', 'color:rgba(255,255,255,.75);', r[0]));
    row.appendChild(hubNode('span', 'font-weight:800;', r[1]));
    host.appendChild(row);
  });

  if (f.palette.length) {
    host.appendChild(hubNode('div', 'font-size:12px;letter-spacing:.12em;color:rgba(255,255,255,.62);margin-top:16px;', 'DOMINANT COLORS'));
    var sw = hubNode('div', 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;');
    f.palette.forEach(function(hex) {
      var chip = hubNode('div', 'text-align:center;font-size:9px;');
      chip.appendChild(hubNode('div', 'width:44px;height:44px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:' + hex + ';'));
      chip.appendChild(hubNode('div', 'margin-top:3px;opacity:.7;', hex));
      sw.appendChild(chip);
    });
    host.appendChild(sw);
  }
}

function saveThumbnailHistory(m) {
  chrome.storage.local.get([THUMB_HISTORY_KEY], function(res) {
    var history = Array.isArray(res && res[THUMB_HISTORY_KEY]) ? res[THUMB_HISTORY_KEY] : [];
    history.unshift({
      timestamp: Date.now(),
      fileName: m.name.slice(0, 120),
      measured: {
        width: m.width,
        height: m.height,
        brightness: m.full.brightness,
        contrast: m.full.contrast,
        colorfulness: m.full.colorfulness
      }
    });
    if (history.length > 10) history.length = 10;
    var payload = {};
    payload[THUMB_HISTORY_KEY] = history;
    chrome.storage.local.set(payload, loadThumbnailHistory);
  });
}

// Entries saved before thumbnails were measured hold AI scores with no measurement behind them, so they are not shown.
function loadThumbnailHistory() {
  var host = document.getElementById('thumb-history-list');
  if (!host) return;
  chrome.storage.local.get([THUMB_HISTORY_KEY], function(res) {
    thumbClear(host);
    var history = (Array.isArray(res && res[THUMB_HISTORY_KEY]) ? res[THUMB_HISTORY_KEY] : []).filter(function(item) {
      return item && item.measured && typeof item.measured.width === 'number';
    });
    if (!history.length) {
      var empty = hubNode('div', '', 'No thumbnails measured yet.');
      empty.className = 'scan-empty-sub';
      host.appendChild(empty);
      return;
    }
    history.forEach(function(item) {
      var m = item.measured;
      var card = hubNode('div', 'padding:14px;margin-bottom:12px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);');
      card.appendChild(hubNode('div', 'font-size:11px;color:rgba(255,255,255,.62);', relTime(item.timestamp || Date.now())));
      card.appendChild(hubNode('div', 'font-weight:700;margin-top:4px;', item.fileName || 'Thumbnail'));
      card.appendChild(hubNode('div', 'font-size:12px;margin-top:4px;color:rgba(255,255,255,.8);', m.width + ' x ' + m.height + ' | brightness ' + Math.round(m.brightness * 100) + '% | contrast ' + Math.round(m.contrast * 100) + '% | colorfulness ' + Math.round(m.colorfulness)));
      host.appendChild(card);
    });
  });
}

function handleThumbnailAnalyze() {
  var fileInput = document.getElementById('thumb-file-input');
  var preview = document.getElementById('thumb-preview');
  var btn = document.getElementById('thumb-analyze-btn');
  var file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) {
    setThumbnailStatus('Pick a thumbnail file first.', 'error');
    return;
  }
  if (!/^image\//i.test(file.type || '')) {
    setThumbnailStatus('That file is not an image.', 'error');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'MEASURING';
  }
  setThumbnailStatus('Measuring the pixels', 'busy');
  measureThumbnailFile(file).then(function(m) {
    if (preview) {
      preview.src = m.dataUrl;
      preview.style.display = 'block';
    }
    displayThumbnailMeasurements(m);
    saveThumbnailHistory(m);
    setThumbnailStatus('Measured. Nothing was uploaded anywhere.', 'success');
  }).catch(function(err) {
    setThumbnailStatus(err && err.message ? err.message : 'Could not measure the thumbnail.', 'error');
  }).then(function() {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'MEASURE THUMBNAIL';
    }
  });
}

function render() {
  renderStats();
  updateHero();
  renderEngine();
  renderArchive();
}

/* ===============================================
   SCAN CHANNEL
   The snapshot, competitors and title patterns are measured from YouTube through the
   service worker. The AI read comes last and only interprets those numbers.
=============================================== */

var scanCurrentMode = 'channel';
var scanCurrentTab = 'snapshot';
var SCAN_REPORT_TABS = ['snapshot', 'competitors', 'patterns', 'ai'];
var SCAN_VIRAL_THRESHOLD = 100000;

function hubNode(tag, css, text) {
  var node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function hubClear(host) {
  while (host && host.firstChild) host.removeChild(host.firstChild);
  return host;
}

var HUB_TONE_COLOR = { error: '#FF6B6B', busy: '#FFD93D', good: '#00DC82', plain: 'rgba(255,255,255,0.62)' };

function hubMessage(host, text, tone) {
  if (!host) return host;
  hubClear(host);
  host.appendChild(hubNode('div', 'color:' + (HUB_TONE_COLOR[tone] || HUB_TONE_COLOR.plain) + ';font-size:12px;line-height:1.6;', text));
  return host;
}

function hubCount(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '?';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.0', '') + 'K';
  return String(Math.round(n));
}

function hubPct(share) {
  return typeof share === 'number' && isFinite(share) ? Math.round(share * 100) + '%' : '?';
}

function hubLink(url, text, css) {
  var safe = /^https:\/\/(?:www\.)?youtube\.com\//i.test(String(url || ''));
  if (!safe) return hubNode('span', css, text);
  var a = hubNode('a', (css || '') + 'color:inherit;text-decoration:underline;text-underline-offset:2px;', text);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function hubStatGrid(host, cells) {
  var grid = hubNode('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:8px 0;');
  cells.forEach(function (cell) {
    var box = hubNode('div', 'padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;');
    box.appendChild(hubNode('div', 'font-size:18px;font-weight:800;color:' + (cell.color || '#fff') + ';overflow-wrap:anywhere;', cell.value));
    box.appendChild(hubNode('div', 'font-size:10px;opacity:0.6;margin-top:2px;', cell.label));
    grid.appendChild(box);
  });
  host.appendChild(grid);
  return grid;
}

function hubHeading(host, text, color) {
  host.appendChild(hubNode('div', 'font-size:12px;font-weight:700;color:' + (color || '#2EE9FF') + ';margin:12px 0 4px;', text));
}

function hubList(host, items, render) {
  (items || []).forEach(function (item, index) {
    var row = hubNode('div', 'padding:6px 8px;margin:3px 0;background:rgba(0,0,0,0.2);border-radius:6px;font-size:12px;line-height:1.5;');
    render(row, item, index);
    host.appendChild(row);
  });
}

function hubNote(host, text) {
  if (text) host.appendChild(hubNode('div', 'font-size:11px;color:rgba(255,255,255,0.5);margin-top:6px;line-height:1.5;', text));
}

function hubAiLabel(host, provider, model) {
  var who = [provider, model].filter(Boolean).join(' ');
  host.appendChild(hubNode('div', 'font-size:11px;color:#B388FF;margin:0 0 8px;', 'AI suggestion' + (who ? ' by ' + who : '') + '. It reads the data shown here and can be wrong: check it before you act on it.'));
}

function hubTextOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(hubTextOf).filter(Boolean).join('\n');
  if (typeof value === 'object') return Object.keys(value).map(function (k) { return hubTextOf(value[k]); }).filter(Boolean).join('\n');
  return '';
}

// Each badge carries a tone identifier; the color comes from the table, never from the label.
function hubBadges(host, badges) {
  var row = hubNode('div', 'display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;');
  badges.forEach(function (b) {
    var color = HUB_TONE_COLOR[b.tone] || HUB_TONE_COLOR.plain;
    row.appendChild(hubNode('span', 'padding:5px 10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid ' + color + ';font-size:11px;font-weight:700;color:' + color + ';', b.label));
  });
  host.appendChild(row);
}

function hubFailure(host) {
  return function (err) { hubMessage(host, 'Error: ' + (err && err.message ? err.message : err), 'error'); };
}

function scanSetMode(mode) {
  scanCurrentMode = mode === 'thumbnail' ? 'thumbnail' : 'channel';
  var channelBtn = document.getElementById('scan-mode-channel');
  var thumbBtn = document.getElementById('scan-mode-thumbnail');
  var channelPane = document.getElementById('scan-mode-pane-channel');
  var thumbPane = document.getElementById('scan-mode-pane-thumbnail');
  var tabs = document.getElementById('scan-tabs-bar');
  var content = document.getElementById('scan-content-area');
  var channel = scanCurrentMode === 'channel';
  if (channelBtn) channelBtn.classList.toggle('active', channel);
  if (thumbBtn) thumbBtn.classList.toggle('active', !channel);
  if (channelPane) channelPane.style.display = channel ? 'block' : 'none';
  if (thumbPane) thumbPane.style.display = channel ? 'none' : 'block';
  if (tabs) tabs.style.display = channel ? 'flex' : 'none';
  if (content) content.style.display = channel ? 'block' : 'none';
  if (!channel) {
    loadThumbnailHistory();
    updateAiStatus();
  }
}

function openScanModal(mode) {
  var m = document.getElementById('scan-modal');
  if (m) {
    m.style.display = 'flex';
    m.scrollTop = 0;
    var box = m.querySelector('.scan-box');
    if (box) box.scrollTop = 0;
  }
  switchAshlyvMode('scanner');
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
  scanCurrentTab = tab === 'advanced' || SCAN_REPORT_TABS.indexOf(tab) >= 0 ? tab : 'snapshot';
  document.querySelectorAll('.scan-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === scanCurrentTab);
  });
  var report = document.getElementById('scan-report-area');
  var advanced = document.getElementById('scan-panel-advanced');
  if (report) report.style.display = scanCurrentTab === 'advanced' ? 'none' : 'block';
  if (advanced) advanced.classList.toggle('active', scanCurrentTab === 'advanced');
  SCAN_REPORT_TABS.forEach(function (name) {
    var panel = document.getElementById('scan-panel-' + name);
    if (panel) panel.classList.toggle('active', name === scanCurrentTab);
  });
  if (scanCurrentTab === 'advanced' && typeof window.__ashlyvPopulateAdvancedScanNichos === 'function') window.__ashlyvPopulateAdvancedScanNichos();
}

function scanShowState(state) {
  var empty = document.getElementById('scan-empty-state');
  var loading = document.getElementById('scan-loading-state');
  var results = document.getElementById('scan-results-wrap');
  if (empty) empty.style.display = state === 'empty' ? 'flex' : 'none';
  if (loading) loading.style.display = state === 'loading' ? 'flex' : 'none';
  if (results) results.style.display = state === 'results' ? 'block' : 'none';
}

function scanShowError(title, message) {
  scanShowState('empty');
  var t = document.getElementById('scan-empty-ttl');
  var s = document.getElementById('scan-empty-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = message;
}

function scanSetLoadMsg(txt) {
  var node = document.getElementById('scan-load-sub-txt');
  if (node) node.textContent = txt;
}

function scanSetStage(idx) {
  for (var i = 0; i < 4; i++) {
    var stage = document.getElementById('scan-stage-' + i);
    if (!stage) continue;
    stage.className = 'scan-stage' + (i < idx ? ' done' : i === idx ? ' active' : '');
    var dot = stage.querySelector('.stage-dot');
    if (dot) dot.textContent = i < idx ? 'OK' : '.';
  }
}

function renderScanSnapshot(scan) {
  var host = hubClear(document.getElementById('sc-snapshot'));
  if (!host) return;
  var s = scan.stats || {};
  var m = scan.summary;
  var head = hubNode('div', 'font-size:20px;font-weight:900;margin-bottom:4px;');
  head.appendChild(hubLink(scan.url, s.name || scan.url));
  host.appendChild(head);
  var facts = [s.country ? 'Country: ' + s.country : '', s.joinedText ? 'Joined: ' + s.joinedText : ''].filter(Boolean).join(' | ');
  if (facts) host.appendChild(hubNode('div', 'font-size:12px;opacity:0.6;', facts));

  var badges = [];
  if (typeof s.monthsOld === 'number') badges.push({ label: s.monthsOld <= 6 ? 'NEW CHANNEL, ' + s.monthsOld + ' MONTHS' : s.monthsOld + ' MONTHS OLD', tone: s.monthsOld <= 6 ? 'good' : 'plain' });
  if (m.withViews) badges.push({ label: m.viralCount + ' OF ' + m.withViews + ' RECENT UPLOADS OVER ' + hubCount(m.viralThreshold), tone: m.viralCount > 0 ? 'good' : 'plain' });
  if (m.withAge) badges.push({ label: m.uploadsLast30Days + ' UPLOADS IN THE LAST 30 DAYS', tone: m.uploadsLast30Days > 0 ? 'good' : 'plain' });
  if (badges.length) hubBadges(host, badges);

  hubStatGrid(host, [
    { value: s.subscribersText || '?', label: 'Subscribers', color: '#2EE9FF' },
    { value: s.videoCountText || '?', label: 'Videos on the channel' },
    { value: s.totalViewsText || '?', label: 'Total views' },
    { value: hubCount(m.medianViews), label: 'Median views, last ' + m.analyzed + ' uploads', color: '#00DC82' },
    { value: hubCount(m.medianViewsPerDay), label: 'Median views per day since upload', color: '#FFD93D' },
    { value: m.medianDaysBetweenUploads === null ? '?' : Math.round(m.medianDaysBetweenUploads) + ' d', label: 'Median gap between uploads' }
  ]);

  var unread = (s.unreadable || []).slice();
  if (m.unreadableViews) unread.push('views of ' + m.unreadableViews + ' of ' + m.analyzed + ' videos');
  if (m.unreadableAge) unread.push('upload date of ' + m.unreadableAge + ' of ' + m.analyzed + ' videos');
  if (unread.length) hubNote(host, 'Could not read: ' + unread.join(', ') + '. Those cells show ? instead of a guess.');
  if (scan.statsError) hubNote(host, 'The channel page could not be read: ' + scan.statsError);
  if (scan.videosError) hubNote(host, 'The recent videos could not be read: ' + scan.videosError);
  hubNote(host, 'YouTube rounds upload dates ("3 months ago"), so per day figures and gaps are approximate.');

  if (m.topVideos.length) {
    hubHeading(host, 'Most viewed of the recent uploads', '#FF6B6B');
    hubList(host, m.topVideos, function (row, v) {
      row.appendChild(hubLink(v.url, v.title));
      row.appendChild(hubNode('span', 'opacity:0.55;', ' | ' + (v.viewsText || hubCount(v.views)) + (v.publishedText ? ' | ' + v.publishedText : '')));
    });
  }
}

function renderScanCompetitors(result) {
  var host = hubClear(document.getElementById('sc-competitors'));
  if (!host) return;
  if (!result.ok) { hubMessage(host, 'Competitor search failed: ' + result.error.message, 'error'); return; }
  var data = result.value;
  hubNote(host, 'Searched YouTube for "' + data.query + '", built from the most repeated words in this channel\'s titles. ' + data.sample + ' results; this channel is left out.');
  if (!data.competitors.length) { hubMessage(host.appendChild(hubNode('div')), 'No other channel showed up in those results.', 'plain'); return; }
  hubList(host, data.competitors, function (row, c) {
    var name = hubNode('div', 'font-weight:700;');
    name.appendChild(hubLink(c.url, c.name || 'Channel'));
    row.appendChild(name);
    row.appendChild(hubNode('div', 'opacity:0.6;font-size:11px;', c.videosInResults + ' of the results | ' + hubCount(c.totalViews) + ' views across them | median ' + hubCount(c.medianViews)));
    if (c.topVideo) {
      var top = hubNode('div', 'opacity:0.75;font-size:11px;', 'Top: ');
      top.appendChild(hubLink(c.topVideo.url, c.topVideo.title));
      row.appendChild(top);
    }
  });
}

function renderTitlePatterns(host, p) {
  if (!p || p.sample < 3) { hubMessage(host.appendChild(hubNode('div')), 'Fewer than 3 titles were read, too few to measure patterns.', 'plain'); return; }
  hubStatGrid(host, [
    { value: String(p.sample), label: 'Titles measured' },
    { value: p.avgWords === null ? '?' : p.avgWords.toFixed(1), label: 'Average words' },
    { value: p.avgChars === null ? '?' : String(Math.round(p.avgChars)), label: 'Average characters' }
  ]);
  hubHeading(host, 'How often titles use each device', '#FFD93D');
  hubList(host, p.features, function (row, f) {
    var views = f.medianViewsWith !== null && f.medianViewsWithout !== null
      ? ' | median views with it ' + hubCount(f.medianViewsWith) + ', without it ' + hubCount(f.medianViewsWithout)
      : ' | too few titles on one side to compare views';
    row.textContent = hubPct(f.share) + ' have ' + f.feature + views;
  });
  if (p.topTerms.length) {
    hubHeading(host, 'Most repeated words', '#2EE9FF');
    var chips = hubNode('div', 'display:flex;flex-wrap:wrap;gap:4px;');
    p.topTerms.forEach(function (t) {
      chips.appendChild(hubNode('span', 'padding:3px 8px;background:rgba(46,233,255,0.12);border-radius:4px;font-size:11px;', t.term + ' (' + t.count + (t.medianViews !== null ? ', median ' + hubCount(t.medianViews) : '') + ')'));
    });
    host.appendChild(chips);
  }
  if (p.topPairs.length) {
    hubHeading(host, 'Repeated word pairs', '#B388FF');
    hubNote(host, p.topPairs.map(function (t) { return t.term + ' (' + t.count + ')'; }).join(' | '));
  }
}

function renderScanPatterns(scan) {
  var host = hubClear(document.getElementById('sc-patterns'));
  if (!host) return;
  hubNote(host, 'Measured on the ' + scan.patterns.sample + ' most recent titles of the channel.');
  renderTitlePatterns(host, scan.patterns);
}

function renderScanAi(ai) {
  var host = hubClear(document.getElementById('sc-ai'));
  if (!host) return;
  hubAiLabel(host, ai.provider, ai.model);
  if (ai.niche) host.appendChild(hubNode('div', 'font-size:16px;font-weight:800;margin-bottom:4px;', ai.niche));
  if (ai.format) host.appendChild(hubNode('div', 'font-size:12px;opacity:0.75;margin-bottom:8px;', ai.format));
  [['Strengths', ai.strengths, '#00DC82'], ['Weaknesses', ai.weaknesses, '#FF6B6B'], ['Content gaps', ai.contentGaps, '#FFD93D'], ['Next steps', ai.nextSteps, '#2EE9FF']].forEach(function (group) {
    if (!group[1].length) return;
    hubHeading(host, group[0], group[2]);
    hubList(host, group[1], function (row, text) { row.textContent = text; });
  });
  if (ai.subniches.length) {
    hubHeading(host, 'Subniches', '#B388FF');
    hubList(host, ai.subniches, function (row, sn) {
      row.appendChild(hubNode('div', 'font-weight:700;', String(sn.name)));
      if (sn.why) row.appendChild(hubNode('div', 'opacity:0.7;', String(sn.why)));
      if (sn.firstVideo) row.appendChild(hubNode('div', 'opacity:0.55;font-size:11px;', 'First video: ' + String(sn.firstVideo)));
    });
  }
}

function handleScanAnalyze() {
  var API = window.AshlyVAPI;
  var input = document.getElementById('scan-handle-input');
  var btn = document.getElementById('scan-go-btn');
  var raw = String(input && input.value || '').trim();
  if (!raw) { if (input) input.focus(); return; }
  if (!API) { scanShowError('Could not start the scan', 'The data client did not load. Reload the page.'); return; }
  if (!API.normalizeChannelUrl(raw)) {
    scanShowError('That is not a channel', 'Use an @handle, a youtube.com/@handle link or a youtube.com/channel/UC... link.');
    return;
  }
  var lang = (document.getElementById('scan-lang-sel') || {}).value || 'en';
  var locale = getYouTubeLocale(lang);
  function busy(on) {
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.textContent = on ? 'ANALYZING' : 'ANALYZE';
  }
  busy(true);
  scanSetTab('snapshot');
  scanShowState('loading');
  scanSetStage(0);
  scanSetLoadMsg('Reading ' + raw + ' on YouTube');
  API.scanChannelFull(raw, { viralThreshold: SCAN_VIRAL_THRESHOLD }).then(function (scan) {
    scanSetStage(1);
    scanSetLoadMsg('Searching YouTube for the same topic');
    return API.competitorMap(scan.url, locale).then(function (value) { return { ok: true, value: value }; }, function (error) { return { ok: false, error: error }; }).then(function (competitors) {
      scanSetStage(2);
      renderScanSnapshot(scan);
      renderScanCompetitors(competitors);
      renderScanPatterns(scan);
      scanSetStage(3);
      hubMessage(document.getElementById('sc-ai'), 'Asking your AI provider for a read of this data', 'busy');
      scanShowState('results');
      busy(false);
      return API.analyzeChannel(scan, lang).then(renderScanAi, function (err) {
        hubMessage(document.getElementById('sc-ai'), 'No AI read: ' + err.message, 'error');
      });
    });
  }).catch(function (err) {
    busy(false);
    scanShowError('Could not read the channel', err && err.message ? err.message : String(err));
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
  var thumbAnalyze = document.getElementById('thumb-analyze-btn');
  var aiConfigure = document.getElementById('ai-configure-btn');
  var thumbFile = document.getElementById('thumb-file-input');
  var ideasBtn = document.getElementById('ideas-generate-btn');
  if (toolsClose) toolsClose.addEventListener('click', closeToolsModal);
  if (thumbOpen) thumbOpen.addEventListener('click', openThumbnailModal);
  if (thumbAnalyze) thumbAnalyze.addEventListener('click', handleThumbnailAnalyze);
  if (aiConfigure) aiConfigure.addEventListener('click', openExtensionOptions);
  ['analyze', 'history', 'ideas'].forEach(function(name) {
    var tab = document.getElementById('thumb-tab-' + name);
    if (tab) tab.addEventListener('click', function() { thumbSetTab(name); });
  });
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

function load() {
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
  hubAiLabel(host, data.provider, data.model);

  function makeCopyButton(text) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb-btn secondary';
    btn.style.marginTop = '0';
    btn.style.width = 'auto';
    btn.style.padding = '0 12px';
    btn.textContent = 'COPY';
    btn.addEventListener('click', function() {
      copyTextWithFallback(text).then(function() {
        btn.textContent = 'COPIED';
        showAshlyVToast('Copied to clipboard', 'success', 2000);
        setTimeout(function() { btn.textContent = 'COPY'; }, 2000);
      });
    });
    return btn;
  }

  function appendListSection(title, items, copyable) {
    if (!items.length) return;
    var section = document.createElement('div');
    section.style.marginBottom = '18px';
    section.appendChild(hubNode('div', 'font-size:16px;font-weight:900;margin-bottom:10px;', title));
    items.forEach(function(item, index) {
      var row = hubNode('div', 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px;margin-bottom:8px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);');
      row.appendChild(hubNode('div', 'line-height:1.6;', (index + 1) + '. ' + item));
      if (copyable) row.appendChild(makeCopyButton(item));
      section.appendChild(row);
    });
    host.appendChild(section);
  }

  appendListSection('Video titles', data.titles, true);
  appendListSection('Opening hooks', data.hooks, true);
  appendListSection('Thumbnail concepts', data.thumbnailConcepts, false);
  if (!data.titles.length && !data.hooks.length && !data.thumbnailConcepts.length) {
    host.appendChild(hubNode('div', 'color:rgba(255,255,255,.62);', 'The AI returned no ideas. Try again.'));
    return;
  }
  if (data.titles.length) {
    var copyAll = document.createElement('button');
    copyAll.type = 'button';
    copyAll.className = 'thumb-btn';
    copyAll.textContent = 'COPY ALL TITLES';
    copyAll.addEventListener('click', function() {
      copyTextWithFallback(data.titles.map(function(item, index) { return (index + 1) + '. ' + item; }).join('\n')).then(function() {
        copyAll.textContent = 'COPIED';
        showAshlyVToast('Copied to clipboard', 'success', 2000);
        setTimeout(function() { copyAll.textContent = 'COPY ALL TITLES'; }, 2000);
      });
    });
    host.appendChild(copyAll);
  }
}

function handleIdeasGenerate() {
  var nicheInput = document.getElementById('ideas-niche-input');
  var languageSelect = document.getElementById('ideas-language-select');
  var button = document.getElementById('ideas-generate-btn');
  var host = document.getElementById('ideas-result-panel');
  var niche = String(nicheInput && nicheInput.value || '').trim();
  if (!niche) {
    showAshlyVToast('Enter a niche before generating ideas.', 'error', 2400);
    if (nicheInput) nicheInput.focus();
    return;
  }
  if (!window.AshlyVAPI) {
    hubMessage(host, 'The AI client did not load. Reload the page.', 'error');
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = 'GENERATING';
  }
  hubMessage(host, 'Asking your AI provider', 'busy');
  window.AshlyVAPI.generateNicheIdeas(niche, languageSelect ? languageSelect.value : 'en')
    .then(renderIdeasResults)
    .catch(function(err) {
      hubMessage(host, 'Could not generate ideas: ' + (err && err.message ? err.message : 'try again.'), 'error');
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
  function showBanner(on) { if (banner) banner.style.display = on ? 'block' : 'none'; }
  if (!window.AshlyVAPI) { showBanner(true); return; }
  window.AshlyVAPI.sendToSW('ASHLYV_PING', {}, 3000).then(function(response) {
    showBanner(!(response && response.pong));
  }, function() { showBanner(true); });
  updateAiStatus();
  var close = document.getElementById('ashlyv-sw-banner-close');
  if (close) close.addEventListener('click', function() { showBanner(false); });
}

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

// PRO tools. Every number here is read from YouTube through the service worker; the sub-niche
// generator is the only AI part and is labelled as a suggestion.
(function initAdvancedPanel() {
  var panel = document.getElementById('scan-panel-advanced');
  var API = window.AshlyVAPI;
  if (!panel || !API) return;

  function byId(id) { return document.getElementById(id); }

  function advScanList() {
    return Array.isArray(app.savedNichos) ? app.savedNichos.filter(function(item) {
      return item && (item.niche || item.title || item.channelUrl || item.vidId);
    }) : [];
  }

  function advSelectedNicho() {
    var select = byId('adv-scan-nicho-select');
    var list = advScanList();
    var idx = select ? parseInt(select.value, 10) : 0;
    return list[isFinite(idx) ? idx : 0] || null;
  }

  function advNichoText(item) {
    item = item || advSelectedNicho() || {};
    return String(item.niche || item.title || '').replace(/[^\p{L}\p{N}\s\-&.,]/gu, '').replace(/\s+/g, ' ').trim();
  }

  function advChannelText(item) {
    item = item || advSelectedNicho() || {};
    return String(item.channelUrl || item.channelId || '').trim();
  }

  function advLanguageText(item) {
    item = item || advSelectedNicho() || {};
    return String(item.language || app.state.selectedLanguage || 'en').slice(0, 8);
  }

  function advSetLockedInput(id, value) {
    var input = byId(id);
    if (!input) return;
    input.value = value || '';
    input.readOnly = true;
    input.title = 'Locked to the niche selected from the scan';
  }

  function populateAdvancedScanNichos() {
    var select = byId('adv-scan-nicho-select');
    if (!select) return;
    var old = select.value;
    hubClear(select);
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
    var summary = byId('adv-scan-nicho-summary');
    advSetLockedInput('adv-channel-age-input', channel);
    advSetLockedInput('adv-viral-input', channel);
    advSetLockedInput('adv-title-input', niche);
    advSetLockedInput('adv-subniche-input', niche);
    advSetLockedInput('adv-subniche-channel', channel);
    var batch = byId('adv-batch-input');
    if (batch) {
      batch.value = advScanList().map(function(n) { return advChannelText(n); }).filter(Boolean).join('\n');
      batch.readOnly = true;
      batch.title = 'Batch built only from channels in the scanned list';
    }
    ['adv-check-age-btn', 'adv-viral-btn'].forEach(function(id) {
      var btn = byId(id);
      if (btn) btn.disabled = !channel;
    });
    ['adv-title-btn', 'adv-subniche-btn'].forEach(function(id) {
      var btn = byId(id);
      if (btn) btn.disabled = !niche;
    });
    var batchBtn = byId('adv-batch-btn');
    if (batchBtn) batchBtn.disabled = !advScanList().some(function(n) { return !!advChannelText(n); });
    if (summary) {
      summary.textContent = item
        ? 'Selected: ' + (item.niche || 'Niche') + ' | ' + (item.title || 'scanned result') + ' | ' + advLanguageText(item).toUpperCase()
        : 'No scanned niches. Run a scan and open PRO again.';
    }
  }

  function viralThreshold() {
    var n = parseInt((byId('adv-viral-threshold') || {}).value, 10);
    return n > 0 ? n : 100000;
  }

  function on(id, handler) {
    var btn = byId(id);
    if (!btn) return;
    btn.addEventListener('click', function() {
      if (btn.disabled) return;
      btn.disabled = true;
      Promise.resolve().then(handler).then(function() { btn.disabled = false; }, function() { btn.disabled = false; });
    });
  }

  var advSelect = byId('adv-scan-nicho-select');
  if (advSelect) advSelect.addEventListener('change', syncAdvancedScanTools);
  var advRefresh = byId('adv-refresh-nichos-btn');
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

  var AGE_VERDICT = { pass: { text: 'PASS', tone: 'good' }, fail: { text: 'FAIL', tone: 'error' } };

  on('adv-check-age-btn', function() {
    var channel = advChannelText();
    var maxMonths = parseInt(byId('adv-max-months').value, 10);
    var out = byId('adv-age-result');
    if (!channel) { hubMessage(out, 'The selected niche has no channel link.', 'error'); return; }
    hubMessage(out, 'Reading the channel page', 'busy');
    return API.channelAge(channel, maxMonths).then(function(d) {
      var who = d.name || d.url;
      if (d.monthsOld === null) {
        hubMessage(out, 'Could not read the join date of ' + who + (d.joinedText ? ' (YouTube shows "' + d.joinedText + '")' : '') + ', so the age filter cannot be checked.', 'error');
        return;
      }
      var verdict = AGE_VERDICT[d.passesFilter ? 'pass' : 'fail'];
      hubMessage(out, verdict.text + ': ' + who + ' is ' + d.monthsOld + ' months old, joined ' + d.joinedDate + '. Limit: ' + maxMonths + ' months.', verdict.tone);
    }).catch(hubFailure(out));
  });

  on('adv-viral-btn', function() {
    var channel = advChannelText();
    var threshold = viralThreshold();
    var out = byId('adv-viral-result');
    if (!channel) { hubMessage(out, 'The selected niche has no channel link.', 'error'); return; }
    hubMessage(out, 'Reading the latest uploads', 'busy');
    return API.viralMetrics(channel, { viralThreshold: threshold }).then(function(d) {
      var m = d.metrics;
      hubClear(out);
      hubStatGrid(out, [
        { value: m.withViews ? m.viralCount + ' of ' + m.withViews : '?', label: 'Uploads over ' + hubCount(threshold) + ' views', color: m.viralCount ? '#00DC82' : '#FF6B6B' },
        { value: hubCount(m.medianViews), label: 'Median views' },
        { value: hubCount(m.medianViewsPerDay), label: 'Median views per day', color: '#2EE9FF' },
        { value: m.withAge ? String(m.uploadsLast30Days) : '?', label: 'Uploads in the last 30 days', color: '#FFD93D' }
      ]);
      var unread = [];
      if (m.unreadableViews) unread.push('views of ' + m.unreadableViews + ' videos');
      if (m.unreadableAge) unread.push('upload date of ' + m.unreadableAge + ' videos');
      hubNote(out, 'Measured on the ' + m.analyzed + ' most recent uploads.' + (unread.length ? ' Could not read: ' + unread.join(', ') + '.' : '') + ' Upload dates are rounded by YouTube.');
      if (m.topVideos.length) {
        hubHeading(out, 'Most viewed', '#FF6B6B');
        hubList(out, m.topVideos.slice(0, 3), function(row, v) {
          row.appendChild(hubLink(v.url, v.title));
          row.appendChild(hubNode('span', 'opacity:0.55;', ' | ' + hubCount(v.views)));
        });
      }
    }).catch(hubFailure(out));
  });

  on('adv-title-btn', function() {
    var keywords = advNichoText();
    var out = byId('adv-title-result');
    if (!keywords) { hubMessage(out, 'The selected niche has no keywords.', 'error'); return; }
    var locale = getYouTubeLocale(advLanguageText());
    hubMessage(out, 'Searching YouTube', 'busy');
    return API.searchTitles(keywords, { sortBy: byId('adv-title-sort').value, gl: locale.gl, hl: locale.hl }).then(function(d) {
      hubClear(out);
      hubNote(out, d.sample + ' results for "' + d.query + '" in YouTube search (' + locale.gl + ').' + (d.unreadableViews ? ' Views unreadable on ' + d.unreadableViews + '.' : ''));
      if (d.channels.length) {
        hubHeading(out, 'Channels in the results', '#2EE9FF');
        hubList(out, d.channels.slice(0, 8), function(row, c) {
          row.appendChild(hubLink(c.url, c.name || 'Channel'));
          row.appendChild(hubNode('span', 'opacity:0.55;', ' | ' + c.videosInResults + ' videos | ' + hubCount(c.totalViews) + ' views in the results'));
        });
      }
      hubHeading(out, 'Videos', '#00DC82');
      hubList(out, d.videos.slice(0, 10), function(row, v) {
        row.appendChild(hubLink(v.url, v.title));
        row.appendChild(hubNode('span', 'opacity:0.55;', ' | ' + (v.viewsText || hubCount(v.views)) + (v.publishedText ? ' | ' + v.publishedText : '') + ' | ' + v.channelName));
      });
      if (d.patterns.topTerms.length) {
        hubHeading(out, 'Most repeated words in these titles', '#FFD93D');
        hubNote(out, d.patterns.topTerms.map(function(t) { return t.term + ' (' + t.count + ')'; }).join(' | '));
      }
    }).catch(hubFailure(out));
  });

  on('adv-subniche-btn', function() {
    var niche = advNichoText();
    var channel = advChannelText() || null;
    var out = byId('adv-subniche-result');
    if (!niche) { hubMessage(out, 'The selected niche has no keywords.', 'error'); return; }
    hubMessage(out, 'Asking your AI provider, this can take 15 to 30 seconds', 'busy');
    return API.generateSubniches(niche, { channel: channel, language: advLanguageText() }).then(function(d) {
      hubClear(out);
      hubAiLabel(out, d.provider, d.model);
      if (d.channelNote) hubNote(out, d.channelNote);
      else if (d.basedOnTitles) hubNote(out, 'Built on ' + d.basedOnTitles + ' real titles of the reference channel.');
      hubList(out, d.subNiches, function(row, sn, i) {
        row.appendChild(hubNode('div', 'font-weight:700;color:#B388FF;', (i + 1) + '. ' + String(sn.name)));
        if (sn.angle) row.appendChild(hubNode('div', 'opacity:0.75;', String(sn.angle)));
        var titles = Array.isArray(sn.exampleTitles) ? sn.exampleTitles.map(String).slice(0, 3) : [];
        if (titles.length) row.appendChild(hubNode('div', 'opacity:0.5;font-size:11px;', 'Titles: ' + titles.join(' | ')));
      });
      if (d.replicationIdeas.length) {
        hubHeading(out, 'Replication ideas', '#FFD93D');
        hubList(out, d.replicationIdeas, function(row, idea) {
          row.appendChild(hubNode('div', 'opacity:0.6;font-size:11px;', 'Based on: ' + String(idea.basedOn)));
          if (idea.twist) row.appendChild(hubNode('div', '', String(idea.twist)));
          if (idea.exampleTitle) row.appendChild(hubNode('div', 'opacity:0.6;font-size:11px;', 'Example: ' + String(idea.exampleTitle)));
        });
      }
      if (d.avoid.length) {
        hubHeading(out, 'Avoid', '#FF6B6B');
        hubNote(out, d.avoid.join(' | '));
      }
      if (!d.subNiches.length && !d.replicationIdeas.length) hubNote(out, 'The AI returned no sub-niches. Try again.');
    }).catch(hubFailure(out));
  });

  var BATCH_STATE = { pass: { text: 'PASSES', color: '#00DC82' }, fail: { text: 'FILTERED OUT', color: '#FF6B6B' }, unknown: { text: 'CANNOT CHECK', color: '#FFD93D' } };

  on('adv-batch-btn', function() {
    var channels = advScanList().map(function(item) { return advChannelText(item); }).filter(Boolean);
    var out = byId('adv-batch-result');
    if (!channels.length) { hubMessage(out, 'None of the saved niches has a channel link.', 'error'); return; }
    var ageValue = byId('adv-batch-age').value;
    var opts = {
      maxMonths: ageValue ? parseInt(ageValue, 10) : null,
      minViralVideos: parseInt(byId('adv-batch-viral').value, 10) || 0,
      viralThreshold: viralThreshold()
    };
    hubMessage(out, 'Scanning ' + Math.min(channels.length, 20) + ' channels, one at a time', 'busy');
    return API.batchScan(channels, opts, function(done, total, input) {
      hubMessage(out, 'Scanning ' + done + ' of ' + total + ': ' + input, 'busy');
    }).then(function(d) {
      hubClear(out);
      hubNote(out, 'Scanned ' + d.scanned + ', ' + d.passing + ' pass every filter, ' + d.errors.length + ' could not be read. Viral means over ' + hubCount(d.viralThreshold) + ' views among the last uploads.');
      hubList(out, d.rows, function(row, r, i) {
        var state = r.passesAll ? 'pass' : (r.ageOk === false || r.viralOk === false ? 'fail' : 'unknown');
        var head = hubNode('div', 'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;');
        var name = hubNode('span', 'font-weight:700;', (i + 1) + '. ');
        name.appendChild(hubLink(r.url, r.name));
        head.appendChild(name);
        head.appendChild(hubNode('span', 'font-weight:800;color:' + BATCH_STATE[state].color + ';', BATCH_STATE[state].text));
        row.appendChild(head);
        row.appendChild(hubNode('div', 'opacity:0.6;font-size:11px;', [
          r.subscribersText ? r.subscribersText + ' subscribers' : 'subscribers unreadable',
          r.monthsOld === null ? 'age unreadable' : r.monthsOld + ' months old',
          r.withViews ? r.viralCount + ' of ' + r.withViews + ' uploads viral' : 'views unreadable',
          'median ' + hubCount(r.medianViewsPerDay) + ' views per day'
        ].join(' | ')));
        if (r.problems.length) row.appendChild(hubNode('div', 'opacity:0.5;font-size:10px;', r.problems.join(' | ')));
      });
      if (d.errors.length) {
        hubHeading(out, 'Could not read', '#FF6B6B');
        hubNote(out, d.errors.map(function(e) { return e.input + ': ' + e.error; }).join(' | '));
      }
    }).catch(hubFailure(out));
  });
})();

function switchAshlyvMode(mode) {
  var containers = { replicator: 'replicator-container', brand: 'brand-container' };
  var buttons = { scanner: ['mode-scanner', '#00DC82'], replicator: ['mode-replicator', '#B388FF'], brand: ['mode-brand', '#FFD93D'] };
  var current = containers[mode] ? mode : 'scanner';
  Object.keys(containers).forEach(function(name) {
    var box = document.getElementById(containers[name]);
    if (box) box.style.display = name === current ? 'block' : 'none';
  });
  Object.keys(buttons).forEach(function(name) {
    var b = document.getElementById(buttons[name][0]);
    if (!b) return;
    b.style.background = name === current ? buttons[name][1] : 'rgba(255,255,255,0.05)';
    b.style.color = name === current ? '#000' : 'rgba(255,255,255,0.5)';
  });
  if (current === 'scanner') {
    scanSetMode(scanCurrentMode);
  } else {
    var tabs = document.getElementById('scan-tabs-bar');
    var content = document.getElementById('scan-content-area');
    if (tabs) tabs.style.display = 'none';
    if (content) content.style.display = 'none';
  }
}

// Wired here instead of inline onclick: the MV3 page CSP blocks inline handlers.
(function wireAshlyvModeSwitcher() {
  [['mode-scanner', 'scanner'], ['mode-replicator', 'replicator'], ['mode-brand', 'brand']].forEach(function(pair) {
    var b = document.getElementById(pair[0]);
    if (b) b.addEventListener('click', function() { switchAshlyvMode(pair[1]); });
  });
})();

(function initReplicator() {
  var btn = document.getElementById('rep-analyze-btn');
  var API = window.AshlyVAPI;
  if (!btn || !API) return;

  btn.addEventListener('click', function() {
    var input = document.getElementById('rep-input-url').value.trim();
    var lang = document.getElementById('rep-language').value;
    var loading = document.getElementById('rep-loading');
    var results = document.getElementById('rep-results');
    var progress = document.getElementById('rep-progress');
    var overview = document.getElementById('rep-overview-content');
    var patterns = document.getElementById('rep-patterns-content');
    var plan = document.getElementById('rep-plan-content');
    if (!input) return;
    if (!API.normalizeChannelUrl(input)) {
      results.style.display = 'block';
      hubMessage(overview, 'Use an @handle, a youtube.com/@handle link or a youtube.com/channel/UC... link.', 'error');
      hubClear(patterns);
      hubClear(plan);
      return;
    }
    btn.disabled = true;
    loading.style.display = 'block';
    results.style.display = 'none';
    progress.textContent = '1 of 2: reading the channel on YouTube';

    API.scanChannelFull(input, { viralThreshold: 100000 }).then(function(scan) {
      var s = scan.stats || {};
      var m = scan.summary;
      hubClear(overview);
      var head = hubNode('div', 'font-size:16px;font-weight:800;margin-bottom:4px;');
      head.appendChild(hubLink(scan.url, s.name || scan.url));
      overview.appendChild(head);
      hubStatGrid(overview, [
        { value: s.subscribersText || '?', label: 'Subscribers', color: '#2EE9FF' },
        { value: typeof s.monthsOld === 'number' ? s.monthsOld + ' mo' : '?', label: 'Channel age', color: '#00DC82' },
        { value: hubCount(m.medianViews), label: 'Median views, last ' + m.analyzed },
        { value: m.withViews ? m.viralCount + ' of ' + m.withViews : '?', label: 'Uploads over 100K views', color: '#FF6B6B' },
        { value: m.withAge ? String(m.uploadsLast30Days) : '?', label: 'Uploads in the last 30 days', color: '#FFD93D' }
      ]);
      var unread = (s.unreadable || []).slice();
      if (m.unreadableViews) unread.push('views of ' + m.unreadableViews + ' videos');
      if (m.unreadableAge) unread.push('upload date of ' + m.unreadableAge + ' videos');
      if (unread.length) hubNote(overview, 'Could not read: ' + unread.join(', ') + '.');
      if (scan.statsError) hubNote(overview, 'The channel page could not be read: ' + scan.statsError);
      if (scan.videosError) hubNote(overview, 'The recent videos could not be read: ' + scan.videosError);

      hubClear(patterns);
      if (m.topVideos.length) {
        hubHeading(patterns, 'Most viewed recent uploads', '#FF6B6B');
        hubList(patterns, m.topVideos, function(row, v) {
          row.appendChild(hubLink(v.url, v.title));
          row.appendChild(hubNode('span', 'opacity:0.55;', ' | ' + (v.viewsText || hubCount(v.views))));
        });
      }
      renderTitlePatterns(patterns, scan.patterns);

      loading.style.display = 'none';
      results.style.display = 'block';
      hubMessage(plan, 'Asking your AI provider for ideas built on these videos', 'busy');
      progress.textContent = '2 of 2: writing replication ideas with AI';
      return API.replicate(scan.url, lang).then(function(r) {
        hubClear(plan);
        hubAiLabel(plan, r.provider, r.model);
        if (r.basedOn.length) hubNote(plan, 'Built on these real titles: ' + r.basedOn.slice(0, 6).join(' | '));
        if (!r.videos.length) { hubNote(plan, 'The AI returned no ideas. Try again.'); return; }
        hubList(plan, r.videos, function(row, v, i) {
          row.appendChild(hubNode('div', 'font-weight:700;color:#00DC82;', (i + 1) + '. ' + String(v.title)));
          if (v.hook) row.appendChild(hubNode('div', 'opacity:0.75;margin-top:2px;', 'Hook: ' + String(v.hook)));
        });
      }, hubFailure(plan));
    }).catch(function(err) {
      loading.style.display = 'none';
      results.style.display = 'block';
      hubFailure(overview)(err);
      hubClear(patterns);
      hubClear(plan);
    }).then(function() {
      btn.disabled = false;
    });
  });
})();

(function initBrandBuilder() {
  var btn = document.getElementById('brand-generate-btn');
  var API = window.AshlyVAPI;
  if (!btn || !API) return;

  btn.addEventListener('click', function() {
    var niche = document.getElementById('brand-niche-input').value.trim();
    var tone = document.getElementById('brand-tone').value;
    var lang = document.getElementById('brand-language').value;
    var names = document.getElementById('brand-names-content');
    var bio = document.getElementById('brand-bio-content');
    var strategy = document.getElementById('brand-strategy-content');
    var loading = document.getElementById('brand-loading');
    var results = document.getElementById('brand-results');
    if (!niche) return;
    btn.disabled = true;
    loading.style.display = 'block';
    results.style.display = 'none';

    API.buildBrand(niche, tone, lang).then(function(d) {
      hubClear(names);
      hubAiLabel(names, d.provider, d.model);
      hubNote(names, 'Check that a name and its handle are free on YouTube before you use them.');
      hubList(names, d.channelNames, function(row, n) {
        if (n && typeof n === 'object') {
          row.appendChild(hubNode('div', 'font-size:15px;font-weight:800;color:#FFD93D;', hubTextOf(n.name)));
          var extra = [n.handle, n.reasoning || n.why].map(hubTextOf).filter(Boolean).join(' | ');
          if (extra) row.appendChild(hubNode('div', 'opacity:0.6;font-size:11px;', extra));
        } else {
          row.appendChild(hubNode('div', 'font-size:15px;font-weight:800;color:#FFD93D;', hubTextOf(n)));
        }
      });
      if (!d.channelNames.length) hubNote(names, 'The AI returned no names. Try again.');
      hubClear(bio);
      bio.appendChild(hubNode('div', 'font-size:13px;line-height:1.6;white-space:pre-wrap;', hubTextOf(d.bio) || 'No bio returned.'));
      hubClear(strategy);
      strategy.appendChild(hubNode('div', 'font-size:13px;line-height:1.6;white-space:pre-wrap;', hubTextOf(d.strategySummary) || 'No strategy returned.'));
    }).catch(function(err) {
      hubFailure(names)(err);
      hubClear(bio);
      hubClear(strategy);
    }).then(function() {
      btn.disabled = false;
      loading.style.display = 'none';
      results.style.display = 'block';
    });
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
