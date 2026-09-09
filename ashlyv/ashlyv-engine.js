(function(global) {
  'use strict';

  var ENGINE_VERSION = '3.0.0';

  var STORAGE_KEYS = {
    globalState: 'ashlyv_global_state_v1',
    alertHistory: 'ashlyv_alert_history_v1',
    opportunityHistory: 'ashlyv_opportunity_history_v1',
    watchlist: 'ashlyv_watchlist_v1',
    savedFilters: 'ashlyv_saved_filters_v1',
    dismissedAlerts: 'ashlyv_dismissed_alerts_v1',
    cooldowns: 'ashlyv_alert_cooldowns_v1'
  };

  var SCORE_WEIGHTS = {
    rpm: 0.25,
    demand: 0.20,
    saturationInverse: 0.15,
    competitionInverse: 0.15,
    faceless: 0.10,
    repeatability: 0.10,
    languageGap: 0.05
  };

  var GOD_FILTERS = [
    { id: 'high_rpm', label: 'High RPM' },
    { id: 'low_comp', label: 'Low Competition' },
    { id: 'low_sat', label: 'Low Saturation' },
    { id: 'fully_faceless', label: 'Fully Faceless' },
    { id: 'easy_scale', label: 'Easy to Scale' },
    { id: 'storytelling', label: 'Storytelling' },
    { id: 'sleep', label: 'Sleep' },
    { id: 'history', label: 'History' },
    { id: 'psychology', label: 'Psychology' },
    { id: 'mystery', label: 'Mystery' },
    { id: 'science', label: 'Science' },
    { id: 'survival', label: 'Survival' },
    { id: 'religion', label: 'Religion / Philosophy' },
    { id: 'trending', label: 'Trending' },
    { id: 'underserved', label: 'Underserved Language' },
    { id: 'outlier', label: 'Outlier' },
    { id: 'saved_only', label: 'Saved only' },
    { id: 'new_only', label: 'New only' },
    { id: 'best_week', label: 'Best this week' },
    { id: 'best_month', label: 'Best this month' }
  ];

  var LANGUAGE_DEFS = [
    {
      code: 'auto',
      label: 'Auto Mix',
      nativeLabel: 'Auto Mix',
      family: 'global',
      audienceWeight: 1.05,
      rpmBias: 1.02,
      underservedBias: 0.55,
      regions: [
        { code: 'GLB', label: 'Global Mix', demand: 0.92, rpm: 1.02, fit: 'Cross-language discovery and diaspora reach', diaspora: 'Great when a niche can scale with localized voiceovers.' }
      ],
      queries: ['ancient mysteries for sleep', 'psychology facts faceless', 'history documentary mystery', 'survival without electricity']
    },
    {
      code: 'en',
      label: 'English',
      nativeLabel: 'English',
      family: 'western',
      audienceWeight: 1.30,
      rpmBias: 1.28,
      underservedBias: 0.20,
      detect: ['the', 'with', 'history', 'explained', 'mystery', 'sleep', 'science', 'survival'],
      regions: [
        { code: 'US', label: 'United States', demand: 0.96, rpm: 1.35, fit: 'High-value ad market', diaspora: 'Excellent for long-form evergreen faceless content.' },
        { code: 'UK', label: 'United Kingdom', demand: 0.74, rpm: 1.16, fit: 'Strong documentary and history appetite', diaspora: 'Pairs well with US inventory.' },
        { code: 'CA', label: 'Canada', demand: 0.58, rpm: 1.12, fit: 'Premium CPM support', diaspora: 'Great as a secondary monetization region.' }
      ],
      queries: ['ancient mysteries for sleep', 'psychology facts for sleep', 'dark history documentary', 'survival without electricity', 'religion and philosophy explained']
    },
    {
      code: 'es',
      label: 'Spanish',
      nativeLabel: 'Espanol',
      family: 'romance',
      audienceWeight: 1.15,
      rpmBias: 0.92,
      underservedBias: 0.48,
      detect: ['el', 'la', 'los', 'historia', 'misterio', 'psicologia', 'ciencia', 'supervivencia'],
      regions: [
        { code: 'MX', label: 'Mexico', demand: 0.92, rpm: 0.88, fit: 'Massive demand for curiosity niches', diaspora: 'Excellent volume for storytelling and mystery.' },
        { code: 'ES', label: 'Spain', demand: 0.66, rpm: 1.08, fit: 'Higher-value RPM for educational content', diaspora: 'Strong for philosophy and history.' },
        { code: 'USH', label: 'US Hispanic', demand: 0.82, rpm: 1.14, fit: 'Hybrid audience with strong ad value', diaspora: 'Best when packaging feels premium and neutral-accent.' }
      ],
      queries: ['historia para dormir', 'misterios antiguos', 'datos de psicologia', 'supervivencia sin electricidad', 'filosofia y religion']
    },
    {
      code: 'pt',
      label: 'Portuguese',
      nativeLabel: 'Portugues',
      family: 'romance',
      audienceWeight: 1.02,
      rpmBias: 0.90,
      underservedBias: 0.54,
      detect: ['para', 'historia', 'misterio', 'psicologia', 'ciencia', 'sobrevivencia'],
      regions: [
        { code: 'BR', label: 'Brazil', demand: 0.93, rpm: 0.86, fit: 'Huge scale for faceless educational channels', diaspora: 'Works well with dramatic curiosity thumbnails.' },
        { code: 'PT', label: 'Portugal', demand: 0.36, rpm: 1.01, fit: 'Smaller but cleaner monetization', diaspora: 'Good complement for Brazilian uploads.' }
      ],
      queries: ['historia para dormir', 'misterios antigos', 'fatos de psicologia', 'documentario de ciencia', 'sobrevivencia sem eletricidade']
    },
    {
      code: 'fr',
      label: 'French',
      nativeLabel: 'Francais',
      family: 'romance',
      audienceWeight: 0.90,
      rpmBias: 1.03,
      underservedBias: 0.62,
      detect: ['le', 'la', 'les', 'histoire', 'mystere', 'psychologie', 'science', 'survie'],
      regions: [
        { code: 'FR', label: 'France', demand: 0.74, rpm: 1.05, fit: 'Documentary-friendly market with lower creator density', diaspora: 'Strong for premium faceless channels.' },
        { code: 'BE', label: 'Belgium', demand: 0.24, rpm: 1.01, fit: 'High-value secondary region', diaspora: 'Best when paired with France.' },
        { code: 'CAF', label: 'Francophone Africa', demand: 0.68, rpm: 0.78, fit: 'Rising demand and cheaper competition', diaspora: 'Useful for scaling views volume.' }
      ],
      queries: ['histoire pour dormir', 'mysteres antiques', 'faits de psychologie', 'documentaire de science', 'survie sans electricite']
    },
    {
      code: 'de',
      label: 'German',
      nativeLabel: 'Deutsch',
      family: 'germanic',
      audienceWeight: 0.84,
      rpmBias: 1.10,
      underservedBias: 0.57,
      detect: ['der', 'die', 'das', 'geschichte', 'mysterien', 'psychologie', 'wissenschaft', 'uberleben'],
      regions: [
        { code: 'DE', label: 'Germany', demand: 0.72, rpm: 1.12, fit: 'Excellent RPM for structured educational niches', diaspora: 'Great for engineering and history.' },
        { code: 'AT', label: 'Austria', demand: 0.20, rpm: 1.04, fit: 'High-value secondary region', diaspora: 'Supports premium CPM blends.' },
        { code: 'CH', label: 'German-speaking Switzerland', demand: 0.16, rpm: 1.18, fit: 'Very strong monetization quality', diaspora: 'Ideal for long-form documentary packaging.' }
      ],
      queries: ['geschichte zum einschlafen', 'antike mysterien', 'psychologie fakten', 'wissenschaft dokumentation', 'uberleben ohne strom']
    },
    {
      code: 'it',
      label: 'Italian',
      nativeLabel: 'Italiano',
      family: 'romance',
      audienceWeight: 0.70,
      rpmBias: 0.94,
      underservedBias: 0.60,
      detect: ['il', 'la', 'storia', 'mistero', 'psicologia', 'scienza', 'sopravvivenza'],
      regions: [
        { code: 'IT', label: 'Italy', demand: 0.63, rpm: 0.98, fit: 'Good gap for faceless history and mystery', diaspora: 'Low creator density in premium packaging.' }
      ],
      queries: ['storia per dormire', 'misteri antichi', 'fatti di psicologia', 'documentario di scienza', 'sopravvivenza senza elettricita']
    },
    {
      code: 'nl',
      label: 'Dutch',
      nativeLabel: 'Nederlands',
      family: 'germanic',
      audienceWeight: 0.46,
      rpmBias: 1.02,
      underservedBias: 0.66,
      detect: ['het', 'een', 'geschiedenis', 'mysterie', 'psychologie', 'wetenschap'],
      regions: [
        { code: 'NL', label: 'Netherlands', demand: 0.42, rpm: 1.03, fit: 'Low competition and clean ad market', diaspora: 'Good for faceless explainers.' },
        { code: 'BEF', label: 'Flemish Belgium', demand: 0.19, rpm: 1.00, fit: 'Useful secondary demand', diaspora: 'Improves language reach.' }
      ]
    },
    {
      code: 'pl',
      label: 'Polish',
      nativeLabel: 'Polski',
      family: 'slavic',
      audienceWeight: 0.56,
      rpmBias: 0.82,
      underservedBias: 0.70,
      detect: ['historia', 'tajemnice', 'psychologia', 'nauka', 'przetrwanie', 'ktory', 'ktora', 'ktore', 'ludzkosc', 'powierzchni', 'ziemi', 'wulkan', 'zniszczy', 'zmiecie'],
      regions: [
        { code: 'PL', label: 'Poland', demand: 0.57, rpm: 0.84, fit: 'Underserved for polished faceless niches', diaspora: 'Great for mystery and survival.' }
      ]
    },
    {
      code: 'ro',
      label: 'Romanian',
      nativeLabel: 'Romana',
      family: 'romance',
      audienceWeight: 0.38,
      rpmBias: 0.76,
      underservedBias: 0.78,
      detect: ['istorie', 'mistere', 'psihologie', 'stiinta', 'supravietuire'],
      regions: [
        { code: 'RO', label: 'Romania', demand: 0.46, rpm: 0.79, fit: 'Low saturation for premium educational content', diaspora: 'Strong gap if scripts are localized well.' }
      ]
    },
    {
      code: 'cs',
      label: 'Czech',
      nativeLabel: 'Cestina',
      family: 'slavic',
      audienceWeight: 0.28,
      rpmBias: 0.86,
      underservedBias: 0.80,
      detect: ['historie', 'tajemstvi', 'psychologie', 'veda', 'preziti'],
      regions: [
        { code: 'CZ', label: 'Czech Republic', demand: 0.31, rpm: 0.90, fit: 'Small but clean niche gap', diaspora: 'Best for evergreen long-form.' }
      ]
    },
    {
      code: 'sk',
      label: 'Slovak',
      nativeLabel: 'Slovencina',
      family: 'slavic',
      audienceWeight: 0.18,
      rpmBias: 0.83,
      underservedBias: 0.84,
      detect: ['historia', 'zahady', 'psychologia', 'veda', 'prezitie'],
      regions: [
        { code: 'SK', label: 'Slovakia', demand: 0.22, rpm: 0.86, fit: 'Very underserved language pocket', diaspora: 'Good when cloning proven formats.' }
      ]
    },
    {
      code: 'hu',
      label: 'Hungarian',
      nativeLabel: 'Magyar',
      family: 'uralic',
      audienceWeight: 0.24,
      rpmBias: 0.82,
      underservedBias: 0.82,
      detect: ['tortenelem', 'rejtely', 'pszichologia', 'tudomany', 'tuleles'],
      regions: [
        { code: 'HU', label: 'Hungary', demand: 0.26, rpm: 0.85, fit: 'Underserved educational market', diaspora: 'High gap for mystery/history packaging.' }
      ]
    },
    {
      code: 'sv',
      label: 'Swedish',
      nativeLabel: 'Svenska',
      family: 'germanic',
      audienceWeight: 0.22,
      rpmBias: 1.02,
      underservedBias: 0.76,
      detect: ['historia', 'mysterier', 'psykologi', 'vetenskap'],
      regions: [
        { code: 'SE', label: 'Sweden', demand: 0.24, rpm: 1.04, fit: 'Small audience but premium monetization', diaspora: 'Works for faceless explainers and sleep.' }
      ]
    },
    {
      code: 'no',
      label: 'Norwegian',
      nativeLabel: 'Norsk',
      family: 'germanic',
      audienceWeight: 0.18,
      rpmBias: 1.03,
      underservedBias: 0.79,
      detect: ['historie', 'mysterier', 'psykologi', 'vitenskap'],
      regions: [
        { code: 'NO', label: 'Norway', demand: 0.20, rpm: 1.06, fit: 'Premium CPM and weak faceless competition', diaspora: 'Good for narrow but profitable channels.' }
      ]
    },
    {
      code: 'da',
      label: 'Danish',
      nativeLabel: 'Dansk',
      family: 'germanic',
      audienceWeight: 0.17,
      rpmBias: 1.01,
      underservedBias: 0.78,
      detect: ['historie', 'mysterier', 'psykologi', 'videnskab'],
      regions: [
        { code: 'DK', label: 'Denmark', demand: 0.19, rpm: 1.04, fit: 'Strong monetization quality for small channels', diaspora: 'Pairs well with Swedish/Norwegian cloning.' }
      ]
    },
    {
      code: 'fi',
      label: 'Finnish',
      nativeLabel: 'Suomi',
      family: 'uralic',
      audienceWeight: 0.16,
      rpmBias: 1.00,
      underservedBias: 0.82,
      detect: ['historia', 'mysteeri', 'psykologia', 'tiede'],
      regions: [
        { code: 'FI', label: 'Finland', demand: 0.17, rpm: 1.02, fit: 'High gap and decent RPM quality', diaspora: 'Useful for faceless documentary testing.' }
      ]
    },
    {
      code: 'tr',
      label: 'Turkish',
      nativeLabel: 'Turkce',
      family: 'turkic',
      audienceWeight: 0.66,
      rpmBias: 0.68,
      underservedBias: 0.75,
      detect: ['tarih', 'gizem', 'psikoloji', 'bilim', 'hayatta kalma'],
      regions: [
        { code: 'TR', label: 'Turkey', demand: 0.71, rpm: 0.70, fit: 'High volume with weaker premium supply', diaspora: 'Great for scalable faceless storytelling.' }
      ],
      queries: ['uyku icin tarih', 'antik gizemler', 'psikoloji gercekleri', 'bilim belgeseli', 'elektriksiz hayatta kalma']
    },
    {
      code: 'ar',
      label: 'Arabic',
      nativeLabel: 'العربية',
      family: 'semitic',
      audienceWeight: 0.96,
      rpmBias: 0.86,
      underservedBias: 0.83,
      script: 'arabic',
      regions: [
        { code: 'SA', label: 'Saudi Arabia', demand: 0.62, rpm: 1.00, fit: 'Higher-value Arabic RPM pocket', diaspora: 'Great for premium informational channels.' },
        { code: 'EG', label: 'Egypt', demand: 0.95, rpm: 0.70, fit: 'Massive reach and lower competition', diaspora: 'Excellent for story-heavy faceless content.' },
        { code: 'MENA', label: 'Gulf + MENA Diaspora', demand: 0.68, rpm: 0.90, fit: 'Strong hybrid audience potential', diaspora: 'Works best with neutral Arabic voiceover.' }
      ],
      queries: ['تاريخ للنوم', 'الغاز قديمة', 'حقائق علم النفس', 'وثائقي علمي', 'البقاء بدون كهرباء']
    },
    {
      code: 'he',
      label: 'Hebrew',
      nativeLabel: 'עברית',
      family: 'semitic',
      audienceWeight: 0.18,
      rpmBias: 1.02,
      underservedBias: 0.80,
      script: 'hebrew',
      regions: [
        { code: 'IL', label: 'Israel', demand: 0.22, rpm: 1.03, fit: 'Premium CPM with low faceless density', diaspora: 'Good for focused educational channels.' }
      ],
      queries: ['היסטוריה לשינה', 'תעלומות עתיקות', 'עובדות פסיכולוגיה', 'מדע דוקומנטרי']
    },
    {
      code: 'hi',
      label: 'Hindi',
      nativeLabel: 'हिन्दी',
      family: 'indo-aryan',
      audienceWeight: 1.04,
      rpmBias: 0.62,
      underservedBias: 0.74,
      script: 'devanagari',
      regions: [
        { code: 'IN', label: 'India', demand: 0.98, rpm: 0.64, fit: 'Huge audience and strong growth velocity', diaspora: 'Great for scalable faceless narratives.' },
        { code: 'INDIASP', label: 'Indian diaspora', demand: 0.52, rpm: 0.90, fit: 'Higher-value hybrid audience', diaspora: 'Best when packaging feels premium.' }
      ],
      queries: ['नींद के लिए इतिहास', 'प्राचीन रहस्य', 'मनोविज्ञान तथ्य', 'विज्ञान डॉक्यूमेंट्री']
    },
    {
      code: 'ur',
      label: 'Urdu',
      nativeLabel: 'اردو',
      family: 'indo-aryan',
      audienceWeight: 0.52,
      rpmBias: 0.58,
      underservedBias: 0.82,
      script: 'arabic',
      regions: [
        { code: 'PK', label: 'Pakistan', demand: 0.63, rpm: 0.60, fit: 'Underserved faceless knowledge niche', diaspora: 'Good for mystery, history, and religion.' }
      ],
      queries: ['سونے کے لئے تاریخ', 'قدیم راز', 'نفسیات کے حقائق', 'سائنس ڈاکیومنٹری']
    },
    {
      code: 'bn',
      label: 'Bengali',
      nativeLabel: 'বাংলা',
      family: 'indo-aryan',
      audienceWeight: 0.62,
      rpmBias: 0.55,
      underservedBias: 0.85,
      script: 'bengali',
      regions: [
        { code: 'BD', label: 'Bangladesh', demand: 0.68, rpm: 0.56, fit: 'Low competition and strong view potential', diaspora: 'Promising for storytelling formats.' }
      ],
      queries: ['ঘুমের জন্য ইতিহাস', 'প্রাচীন রহস্য', 'মনোবিজ্ঞান তথ্য', 'বিজ্ঞান ডকুমেন্টারি']
    },
    {
      code: 'ta',
      label: 'Tamil',
      nativeLabel: 'தமிழ்',
      family: 'dravidian',
      audienceWeight: 0.41,
      rpmBias: 0.57,
      underservedBias: 0.84,
      script: 'tamil',
      regions: [
        { code: 'TN', label: 'Tamil Nadu', demand: 0.54, rpm: 0.59, fit: 'Strong storytelling audience and low polished faceless supply', diaspora: 'Good for history, mystery, and religion.' }
      ],
      queries: ['தூக்கத்திற்கு வரலாறு', 'பழமையான மர்மங்கள்', 'மனோதத்துவ உண்மைகள்', 'அறிவியல் ஆவணப்படம்']
    },
    {
      code: 'te',
      label: 'Telugu',
      nativeLabel: 'తెలుగు',
      family: 'dravidian',
      audienceWeight: 0.39,
      rpmBias: 0.57,
      underservedBias: 0.84,
      script: 'telugu',
      regions: [
        { code: 'APTS', label: 'Andhra Pradesh + Telangana', demand: 0.51, rpm: 0.59, fit: 'Good gap for educational faceless channels', diaspora: 'Works best with dramatic packaging.' }
      ],
      queries: ['నిద్ర కోసం చరిత్ర', 'ప్రాచీన రహస్యాలు', 'మనోవిజ్ఞాన విషయాలు', 'సైన్స్ డాక్యుమెంటరీ']
    },
    {
      code: 'ja',
      label: 'Japanese',
      nativeLabel: '日本語',
      family: 'east-asian',
      audienceWeight: 0.64,
      rpmBias: 1.12,
      underservedBias: 0.76,
      script: 'japanese',
      regions: [
        { code: 'JP', label: 'Japan', demand: 0.66, rpm: 1.14, fit: 'Premium RPM and low faceless density in several niches', diaspora: 'Strong for sleep + history + mystery hybrids.' }
      ],
      queries: ['眠るための歴史', '古代の謎', '心理学の事実', '科学ドキュメンタリー', '電気なしで生き残る']
    },
    {
      code: 'ko',
      label: 'Korean',
      nativeLabel: '한국어',
      family: 'east-asian',
      audienceWeight: 0.46,
      rpmBias: 0.98,
      underservedBias: 0.73,
      script: 'korean',
      regions: [
        { code: 'KR', label: 'South Korea', demand: 0.50, rpm: 1.02, fit: 'Good ad quality with moderate creator density', diaspora: 'Best for polished educational narratives.' }
      ],
      queries: ['잠을 위한 역사', '고대의 미스터리', '심리학 사실', '과학 다큐멘터리']
    },
    {
      code: 'zh-cn',
      label: 'Mandarin Chinese',
      nativeLabel: '简体中文',
      family: 'east-asian',
      audienceWeight: 0.72,
      rpmBias: 0.76,
      underservedBias: 0.72,
      script: 'han',
      regions: [
        { code: 'CN', label: 'Mainland Chinese diaspora on YouTube', demand: 0.74, rpm: 0.78, fit: 'Interesting gap for overseas Mandarin audiences', diaspora: 'Works best with simplified Chinese packaging.' },
        { code: 'SG', label: 'Singapore', demand: 0.24, rpm: 1.08, fit: 'High-value Mandarin inventory', diaspora: 'Excellent monetization boost.' }
      ],
      queries: ['睡前历史', '古代谜团', '心理学事实', '科学纪录片']
    },
    {
      code: 'zh-tw',
      label: 'Traditional Chinese',
      nativeLabel: '繁體中文',
      family: 'east-asian',
      audienceWeight: 0.38,
      rpmBias: 0.90,
      underservedBias: 0.74,
      script: 'han',
      regions: [
        { code: 'TW', label: 'Taiwan', demand: 0.42, rpm: 0.94, fit: 'Premium educational audience', diaspora: 'Strong for history and psychology.' },
        { code: 'HK', label: 'Hong Kong', demand: 0.18, rpm: 1.06, fit: 'Higher monetization quality', diaspora: 'Good for hybrid Cantonese/Traditional Chinese testing.' }
      ],
      queries: ['睡前歷史', '古代謎團', '心理學事實', '科學紀錄片']
    },
    {
      code: 'yue',
      label: 'Cantonese',
      nativeLabel: '廣東話',
      family: 'east-asian',
      audienceWeight: 0.22,
      rpmBias: 0.98,
      underservedBias: 0.82,
      script: 'han',
      regions: [
        { code: 'HK', label: 'Hong Kong', demand: 0.26, rpm: 1.08, fit: 'Underserved and premium local market', diaspora: 'Great for faceless localized explainers.' },
        { code: 'YUE-DIAS', label: 'Cantonese diaspora', demand: 0.20, rpm: 1.00, fit: 'High-value diaspora pocket', diaspora: 'Good for mystery and documentary niches.' }
      ],
      queries: ['瞓覺歷史', '古代謎團', '心理學事實', '科學紀錄片']
    },
    {
      code: 'th',
      label: 'Thai',
      nativeLabel: 'ไทย',
      family: 'tai-kadai',
      audienceWeight: 0.48,
      rpmBias: 0.68,
      underservedBias: 0.80,
      script: 'thai',
      regions: [
        { code: 'TH', label: 'Thailand', demand: 0.55, rpm: 0.70, fit: 'Good demand and low premium supply', diaspora: 'Strong for mystery and survival.' }
      ],
      queries: ['ประวัติศาสตร์ก่อนนอน', 'ปริศนาโบราณ', 'ข้อเท็จจริงทางจิตวิทยา', 'สารคดีวิทยาศาสตร์']
    },
    {
      code: 'vi',
      label: 'Vietnamese',
      nativeLabel: 'Tieng Viet',
      family: 'austroasiatic',
      audienceWeight: 0.60,
      rpmBias: 0.64,
      underservedBias: 0.82,
      detect: ['lich su', 'tam ly', 'khoa hoc', 'sinh ton', 'bi an'],
      regions: [
        { code: 'VN', label: 'Vietnam', demand: 0.66, rpm: 0.66, fit: 'Good growth velocity and low faceless saturation', diaspora: 'Promising for evergreen curiosity niches.' }
      ],
      queries: ['lich su de ngu', 'bi an co dai', 'su that tam ly', 'phim tai lieu khoa hoc']
    },
    {
      code: 'id',
      label: 'Indonesian',
      nativeLabel: 'Bahasa Indonesia',
      family: 'austronesian',
      audienceWeight: 0.88,
      rpmBias: 0.60,
      underservedBias: 0.80,
      detect: ['sejarah', 'misteri', 'psikologi', 'sains', 'bertahan hidup'],
      regions: [
        { code: 'ID', label: 'Indonesia', demand: 0.90, rpm: 0.62, fit: 'Huge scalable demand with weaker premium supply', diaspora: 'Great for story-heavy faceless formats.' }
      ],
      queries: ['sejarah untuk tidur', 'misteri kuno', 'fakta psikologi', 'dokumenter sains']
    },
    {
      code: 'ms',
      label: 'Malay',
      nativeLabel: 'Bahasa Melayu',
      family: 'austronesian',
      audienceWeight: 0.26,
      rpmBias: 0.72,
      underservedBias: 0.82,
      detect: ['sejarah', 'misteri', 'psikologi', 'sains'],
      regions: [
        { code: 'MY', label: 'Malaysia', demand: 0.32, rpm: 0.76, fit: 'Cleaner monetization than neighboring markets', diaspora: 'Good for documentary and religion.' }
      ],
      queries: ['sejarah untuk tidur', 'misteri kuno', 'fakta psikologi', 'dokumentari sains']
    },
    {
      code: 'tl',
      label: 'Filipino',
      nativeLabel: 'Filipino',
      family: 'austronesian',
      audienceWeight: 0.54,
      rpmBias: 0.58,
      underservedBias: 0.78,
      detect: ['kasaysayan', 'hiwaga', 'sikolohiya', 'agham'],
      regions: [
        { code: 'PH', label: 'Philippines', demand: 0.62, rpm: 0.60, fit: 'Strong curiosity demand and low premium faceless saturation', diaspora: 'Works for mystery and religion channels.' }
      ],
      queries: ['kasaysayan para matulog', 'sinaunang hiwaga', 'mga katotohanan sa sikolohiya', 'dokumentaryong agham']
    },
    {
      code: 'ru',
      label: 'Russian',
      nativeLabel: 'Русский',
      family: 'slavic',
      audienceWeight: 0.42,
      rpmBias: 0.64,
      underservedBias: 0.76,
      script: 'cyrillic',
      regions: [
        { code: 'RU-DIAS', label: 'Russian-speaking diaspora', demand: 0.48, rpm: 0.74, fit: 'Useful diaspora audience on YouTube', diaspora: 'Best for educational and survival niches.' }
      ],
      queries: ['история для сна', 'древние тайны', 'факты психологии', 'научный документальный фильм']
    },
    {
      code: 'uk',
      label: 'Ukrainian',
      nativeLabel: 'Українська',
      family: 'slavic',
      audienceWeight: 0.24,
      rpmBias: 0.62,
      underservedBias: 0.86,
      script: 'cyrillic',
      regions: [
        { code: 'UA', label: 'Ukraine + diaspora', demand: 0.30, rpm: 0.66, fit: 'Very underserved knowledge niche supply', diaspora: 'Good candidate for localized faceless channels.' }
      ],
      queries: ['історія для сну', 'стародавні таємниці', 'факти психології', 'науковий документальний фільм']
    },
    {
      code: 'el',
      label: 'Greek',
      nativeLabel: 'Ελληνικα',
      family: 'hellenic',
      audienceWeight: 0.20,
      rpmBias: 0.84,
      underservedBias: 0.80,
      script: 'greek',
      regions: [
        { code: 'GR', label: 'Greece', demand: 0.23, rpm: 0.88, fit: 'Underserved for polished faceless history channels', diaspora: 'Strong cultural angle for mythology.' }
      ],
      queries: ['ιστορια για υπνο', 'αρχαια μυστηρια', 'γεγονοτα ψυχολογιας', 'επιστημονικο ντοκιμαντερ']
    },
    {
      code: 'sr',
      label: 'Serbian',
      nativeLabel: 'Srpski',
      family: 'slavic',
      audienceWeight: 0.18,
      rpmBias: 0.66,
      underservedBias: 0.84,
      detect: ['istorija', 'misterije', 'psihologija', 'nauka'],
      regions: [
        { code: 'RS', label: 'Serbia', demand: 0.21, rpm: 0.68, fit: 'Small but underserved premium gap', diaspora: 'Good for cloned faceless formats.' }
      ]
    },
    {
      code: 'hr',
      label: 'Croatian',
      nativeLabel: 'Hrvatski',
      family: 'slavic',
      audienceWeight: 0.15,
      rpmBias: 0.72,
      underservedBias: 0.86,
      detect: ['povijest', 'misterije', 'psihologija', 'znanost'],
      regions: [
        { code: 'HR', label: 'Croatia', demand: 0.18, rpm: 0.74, fit: 'Very low saturation for educational faceless niches', diaspora: 'Useful for niche testing.' }
      ]
    },
    {
      code: 'bg',
      label: 'Bulgarian',
      nativeLabel: 'Български',
      family: 'slavic',
      audienceWeight: 0.14,
      rpmBias: 0.64,
      underservedBias: 0.88,
      script: 'cyrillic',
      regions: [
        { code: 'BG', label: 'Bulgaria', demand: 0.18, rpm: 0.66, fit: 'Underserved language pocket', diaspora: 'Good for mystery and history.' }
      ]
    },
    {
      code: 'lt',
      label: 'Lithuanian',
      nativeLabel: 'Lietuviu',
      family: 'baltic',
      audienceWeight: 0.11,
      rpmBias: 0.78,
      underservedBias: 0.90,
      detect: ['istorija', 'paslaptys', 'psichologija', 'mokslas'],
      regions: [
        { code: 'LT', label: 'Lithuania', demand: 0.14, rpm: 0.82, fit: 'Very low competition faceless pocket', diaspora: 'Good for small but high-gap launches.' }
      ]
    },
    {
      code: 'lv',
      label: 'Latvian',
      nativeLabel: 'Latviesu',
      family: 'baltic',
      audienceWeight: 0.09,
      rpmBias: 0.78,
      underservedBias: 0.91,
      detect: ['vesture', 'misterijas', 'psihologija', 'zinatne'],
      regions: [
        { code: 'LV', label: 'Latvia', demand: 0.11, rpm: 0.80, fit: 'Very underserved niche supply', diaspora: 'Works for premium localized faceless tests.' }
      ]
    },
    {
      code: 'et',
      label: 'Estonian',
      nativeLabel: 'Eesti',
      family: 'uralic',
      audienceWeight: 0.08,
      rpmBias: 0.82,
      underservedBias: 0.92,
      detect: ['ajalugu', 'musteeriumid', 'psuhholoogia', 'teadus'],
      regions: [
        { code: 'EE', label: 'Estonia', demand: 0.10, rpm: 0.84, fit: 'Tiny but highly underserved', diaspora: 'Good for experimentation only.' }
      ]
    },
    {
      code: 'ka',
      label: 'Georgian',
      nativeLabel: 'ქართული',
      family: 'kartvelian',
      audienceWeight: 0.09,
      rpmBias: 0.60,
      underservedBias: 0.92,
      script: 'georgian',
      regions: [
        { code: 'GE', label: 'Georgia', demand: 0.11, rpm: 0.62, fit: 'Very low competition educational market', diaspora: 'Good for strong templates.' }
      ],
      queries: ['ისტორია ძილისთვის', 'უძველესი საიდუმლოებები', 'ფსიქოლოგიის ფაქტები', 'სამეცნიერო დოკუმენტური']
    },
    {
      code: 'fa',
      label: 'Persian',
      nativeLabel: 'فارسی',
      family: 'iranian',
      audienceWeight: 0.34,
      rpmBias: 0.66,
      underservedBias: 0.82,
      script: 'arabic',
      regions: [
        { code: 'IR-DIAS', label: 'Persian-speaking diaspora', demand: 0.38, rpm: 0.78, fit: 'Good diaspora monetization opportunity', diaspora: 'Best for philosophy and history.' }
      ],
      queries: ['تاریخ برای خواب', 'رازهای باستانی', 'حقایق روانشناسی', 'مستند علمی']
    },
    {
      code: 'sw',
      label: 'Swahili',
      nativeLabel: 'Kiswahili',
      family: 'bantu',
      audienceWeight: 0.22,
      rpmBias: 0.50,
      underservedBias: 0.90,
      detect: ['historia', 'siri', 'saikolojia', 'sayansi'],
      regions: [
        { code: 'EA', label: 'East Africa', demand: 0.28, rpm: 0.52, fit: 'Very underserved faceless knowledge gap', diaspora: 'Strong growth potential if localized well.' }
      ]
    }
  ];

  var QUERY_TEMPLATES = [
    { nicheId: 'sleep_history', parts: ['history', 'sleep'], connector: ' ' },
    { nicheId: 'ancient_mysteries', parts: ['ancient', 'mystery'], connector: ' ' },
    { nicheId: 'psychology_sleep', parts: ['psychology', 'sleep'], connector: ' ' },
    { nicheId: 'science_mystery', parts: ['science', 'mystery'], connector: ' ' },
    { nicheId: 'survival_blackout', parts: ['survival', 'blackout'], connector: ' ' },
    { nicheId: 'religion_philosophy', parts: ['religion', 'philosophy'], connector: ' ' },
    { nicheId: 'history_documentary', parts: ['history', 'documentary'], connector: ' ' },
    { nicheId: 'finance_crypto', parts: ['crypto', 'finance'], connector: ' ' },
    { nicheId: 'true_crime', parts: ['true', 'crime'], connector: ' ' },
    { nicheId: 'health_wellness', parts: ['health', 'wellness'], connector: ' ' },
    { nicheId: 'ai_tech', parts: ['AI', 'technology'], connector: ' ' },
    { nicheId: 'mythology', parts: ['mythology', 'legends'], connector: ' ' },
    { nicheId: 'motivation_stoicism', parts: ['stoicism', 'motivation'], connector: ' ' },
    { nicheId: 'conspiracy_paranormal', parts: ['conspiracy', 'paranormal'], connector: ' ' },
    { nicheId: 'natural_disasters', parts: ['natural', 'disasters'], connector: ' ' },
    { nicheId: 'meditation_mindfulness', parts: ['meditation', 'mindfulness'], connector: ' ' },
    { nicheId: 'wealth_secrets', parts: ['wealth', 'secrets'], connector: ' ' }
  ];

  var NICHE_LIBRARY = [
    {
      id: 'sleep_history',
      label: 'Sleep History / Ancient Mysteries',
      tags: ['fully_faceless', 'easy_scale', 'storytelling', 'sleep', 'history', 'mystery'],
      baseRpm: 7.8,
      baseDemand: 7.6,
      baseCompetition: 4.2,
      baseSaturation: 3.6,
      facelessBase: 9.4,
      repeatabilityBase: 9.1,
      outlierBias: 0.55,
      why: 'Night listening, long-form curiosity, and low on-camera dependency create durable faceless demand.'
    },
    {
      id: 'ancient_mysteries',
      label: 'Ancient Mysteries',
      tags: ['fully_faceless', 'easy_scale', 'storytelling', 'history', 'mystery', 'science'],
      baseRpm: 6.6,
      baseDemand: 7.8,
      baseCompetition: 4.8,
      baseSaturation: 4.1,
      facelessBase: 9.0,
      repeatabilityBase: 8.8,
      outlierBias: 0.70,
      why: 'Ancient curiosity niches travel well across languages and thrive on narration + archive visuals.'
    },
    {
      id: 'psychology_sleep',
      label: 'Psychology for Sleep',
      tags: ['fully_faceless', 'easy_scale', 'sleep', 'psychology', 'storytelling'],
      baseRpm: 8.4,
      baseDemand: 7.2,
      baseCompetition: 4.0,
      baseSaturation: 3.8,
      facelessBase: 9.2,
      repeatabilityBase: 8.9,
      outlierBias: 0.62,
      why: 'High retention format for narrated facts, calm delivery, and repeatable themed series.'
    },
    {
      id: 'science_mystery',
      label: 'Science Mysteries',
      tags: ['fully_faceless', 'easy_scale', 'science', 'mystery', 'storytelling'],
      baseRpm: 7.9,
      baseDemand: 7.4,
      baseCompetition: 4.6,
      baseSaturation: 4.3,
      facelessBase: 8.7,
      repeatabilityBase: 8.1,
      outlierBias: 0.64,
      why: 'Explainer-style science mystery packaging converts well without on-camera talent.'
    },
    {
      id: 'survival_blackout',
      label: 'Survival Without Electricity',
      tags: ['fully_faceless', 'easy_scale', 'survival', 'storytelling', 'trending'],
      baseRpm: 6.9,
      baseDemand: 8.0,
      baseCompetition: 4.8,
      baseSaturation: 4.0,
      facelessBase: 8.5,
      repeatabilityBase: 8.3,
      outlierBias: 0.80,
      why: 'Survival anxieties create spikes in CTR and strong packaging opportunities with no face required.'
    },
    {
      id: 'religion_philosophy',
      label: 'Religion / Philosophy Explained',
      tags: ['fully_faceless', 'easy_scale', 'religion', 'storytelling'],
      baseRpm: 6.2,
      baseDemand: 7.0,
      baseCompetition: 3.8,
      baseSaturation: 3.2,
      facelessBase: 8.9,
      repeatabilityBase: 8.7,
      outlierBias: 0.52,
      why: 'Timeless ideas and public-domain sources make this niche cheap to produce and easy to localize.'
    },
    {
      id: 'dark_history',
      label: 'Dark History',
      tags: ['fully_faceless', 'easy_scale', 'history', 'mystery', 'storytelling'],
      baseRpm: 6.7,
      baseDemand: 7.9,
      baseCompetition: 4.9,
      baseSaturation: 4.4,
      facelessBase: 8.8,
      repeatabilityBase: 8.5,
      outlierBias: 0.74,
      why: 'High-CTR thumbnails and strong narrative arcs make dark history highly repeatable.'
    },
    {
      id: 'space_documentary',
      label: 'Space Documentary',
      tags: ['fully_faceless', 'easy_scale', 'science', 'storytelling'],
      baseRpm: 7.1,
      baseDemand: 7.1,
      baseCompetition: 4.7,
      baseSaturation: 4.6,
      facelessBase: 8.6,
      repeatabilityBase: 8.2,
      outlierBias: 0.58,
      why: 'Space content benefits from archive visuals, dramatic narration, and global curiosity demand.'
    },
    {
      id: 'psychology_facts',
      label: 'Psychology Facts',
      tags: ['fully_faceless', 'easy_scale', 'psychology', 'storytelling', 'trending'],
      baseRpm: 7.4,
      baseDemand: 7.7,
      baseCompetition: 5.1,
      baseSaturation: 4.8,
      facelessBase: 8.6,
      repeatabilityBase: 9.0,
      outlierBias: 0.68,
      why: 'Short repeatable hooks and list formats scale fast across many languages.'
    },
    {
      id: 'history_documentary',
      label: 'History Documentary',
      tags: ['fully_faceless', 'easy_scale', 'history', 'storytelling'],
      baseRpm: 6.3,
      baseDemand: 6.9,
      baseCompetition: 4.3,
      baseSaturation: 4.1,
      facelessBase: 8.7,
      repeatabilityBase: 8.0,
      outlierBias: 0.49,
      why: 'Classic documentary packaging stays monetizable and easy to reproduce with narration.'
    },
    {
      id: 'finance_crypto',
      label: 'Finance & Crypto',
      tags: ['fully_faceless', 'easy_scale', 'trending', 'finance'],
      baseRpm: 12.4,
      baseDemand: 8.8,
      baseCompetition: 6.2,
      baseSaturation: 5.8,
      facelessBase: 8.8,
      repeatabilityBase: 9.2,
      outlierBias: 0.85,
      why: 'Finance and crypto niches command the highest RPMs on YouTube; screen-recording and AI narration make it fully faceless.'
    },
    {
      id: 'true_crime',
      label: 'True Crime',
      tags: ['fully_faceless', 'easy_scale', 'storytelling', 'mystery', 'trending'],
      baseRpm: 7.6,
      baseDemand: 9.1,
      baseCompetition: 5.6,
      baseSaturation: 5.2,
      facelessBase: 9.0,
      repeatabilityBase: 9.3,
      outlierBias: 0.78,
      why: 'True crime has the highest watch-time retention of any storytelling niche and scales effortlessly with narration.'
    },
    {
      id: 'health_wellness',
      label: 'Health & Wellness',
      tags: ['fully_faceless', 'easy_scale', 'health'],
      baseRpm: 9.2,
      baseDemand: 8.4,
      baseCompetition: 5.4,
      baseSaturation: 5.0,
      facelessBase: 8.4,
      repeatabilityBase: 8.6,
      outlierBias: 0.60,
      why: 'Health anxiety content drives huge search volume; evergreen demand with high ad rates from pharma and supplement brands.'
    },
    {
      id: 'ai_tech',
      label: 'AI & Technology',
      tags: ['fully_faceless', 'easy_scale', 'science', 'trending'],
      baseRpm: 10.4,
      baseDemand: 9.0,
      baseCompetition: 5.8,
      baseSaturation: 5.5,
      facelessBase: 9.2,
      repeatabilityBase: 9.0,
      outlierBias: 0.90,
      why: 'AI is the fastest-growing topic on YouTube with extremely high RPMs from tech advertisers; screencasting makes it 100% faceless.'
    },
    {
      id: 'mythology',
      label: 'Mythology & Legends',
      tags: ['fully_faceless', 'easy_scale', 'history', 'mystery', 'storytelling'],
      baseRpm: 6.8,
      baseDemand: 7.5,
      baseCompetition: 3.9,
      baseSaturation: 3.5,
      facelessBase: 9.3,
      repeatabilityBase: 8.8,
      outlierBias: 0.65,
      why: 'Low competition with inexhaustible public-domain mythology source material across every culture and language.'
    },
    {
      id: 'motivation_stoicism',
      label: 'Motivation & Stoicism',
      tags: ['fully_faceless', 'easy_scale', 'psychology', 'storytelling'],
      baseRpm: 8.8,
      baseDemand: 8.6,
      baseCompetition: 5.5,
      baseSaturation: 5.1,
      facelessBase: 9.1,
      repeatabilityBase: 9.4,
      outlierBias: 0.72,
      why: 'Motivational content with Stoic philosophy is evergreen, endlessly repeatable, and thrives with cinematic B-roll + narration.'
    },
    {
      id: 'conspiracy_paranormal',
      label: 'Conspiracy & Paranormal',
      tags: ['fully_faceless', 'easy_scale', 'mystery', 'storytelling'],
      baseRpm: 6.4,
      baseDemand: 8.2,
      baseCompetition: 4.5,
      baseSaturation: 4.2,
      facelessBase: 9.4,
      repeatabilityBase: 9.1,
      outlierBias: 0.82,
      why: 'Conspiracy and paranormal niches generate insane CTR from curiosity titles and are fully narration-based.'
    },
    {
      id: 'natural_disasters',
      label: 'Natural Disasters',
      tags: ['fully_faceless', 'easy_scale', 'science', 'survival', 'storytelling'],
      baseRpm: 7.2,
      baseDemand: 7.8,
      baseCompetition: 3.6,
      baseSaturation: 3.3,
      facelessBase: 8.9,
      repeatabilityBase: 8.4,
      outlierBias: 0.68,
      why: 'Disaster footage and dramatic narration create compelling faceless content; low competition outside English.'
    },
    {
      id: 'meditation_mindfulness',
      label: 'Meditation & Mindfulness',
      tags: ['fully_faceless', 'easy_scale', 'sleep', 'psychology'],
      baseRpm: 7.8,
      baseDemand: 7.3,
      baseCompetition: 4.1,
      baseSaturation: 3.9,
      facelessBase: 9.6,
      repeatabilityBase: 9.5,
      outlierBias: 0.55,
      why: 'Meditation content is among the most faceless-friendly formats; background music + AI voice requires zero editing skill.'
    },
    {
      id: 'wealth_secrets',
      label: 'Wealth & Hidden Secrets',
      tags: ['fully_faceless', 'easy_scale', 'trending', 'psychology'],
      baseRpm: 11.2,
      baseDemand: 8.9,
      baseCompetition: 5.9,
      baseSaturation: 5.4,
      facelessBase: 8.8,
      repeatabilityBase: 9.1,
      outlierBias: 0.88,
      why: 'Wealth and financial secrets content attracts premium ad spend and is among the top-earning faceless formats available.'
    }
  ];

  var SCRIPT_RE = {
    arabic: /[\u0600-\u06FF]/,
    devanagari: /[\u0900-\u097F]/,
    bengali: /[\u0980-\u09FF]/,
    tamil: /[\u0B80-\u0BFF]/,
    telugu: /[\u0C00-\u0C7F]/,
    hebrew: /[\u0590-\u05FF]/,
    cyrillic: /[\u0400-\u04FF]/,
    greek: /[\u0370-\u03FF]/,
    georgian: /[\u10A0-\u10FF]/,
    thai: /[\u0E00-\u0E7F]/,
    han: /[\u4E00-\u9FFF]/,
    japanese: /[\u3040-\u30FF]/,
    korean: /[\uAC00-\uD7AF]/
  };

  var NICHE_KEYWORDS = {
    sleep_history: ['sleep', 'history', 'dormir', 'historia', 'sommeil', 'histoire', 'geschichte', 'schlafen', '眠', '睡', 'تاريخ', 'sleep'],
    ancient_mysteries: ['ancient', 'mystery', 'antique', 'ancien', 'misterio', 'mystere', 'gizem', '谜', 'misteri', 'тайны', 'راز'],
    psychology_sleep: ['psychology', 'psicologia', 'psychologie', 'psykologi', 'psikologi', '睡', 'mind', 'mental'],
    science_mystery: ['science', 'ciencia', 'wissenschaft', 'science', 'nauka', 'علم', '科学'],
    survival_blackout: ['survival', 'supervivencia', 'survie', 'uberleben', 'blackout', 'electricity', 'strom', 'electri', 'electricidad', 'survive'],
    religion_philosophy: ['religion', 'philosophy', 'filosofia', 'stoic', 'stoicism', 'faith', 'dios', 'god', 'religious'],
    dark_history: ['dark history', 'historia oscura', 'histoire sombre', 'dunkle geschichte', 'secret history'],
    space_documentary: ['space', 'universe', 'astronomy', 'espacio', 'weltraum', '宇宙', 'فضاء'],
    psychology_facts: ['psychology facts', 'facts', 'datos', 'fatos', 'faits', 'fakten', '心理学', 'حقائق'],
    history_documentary: ['documentary', 'documental', 'documentaire', 'dokumentation', 'docu', '纪录片'],
    finance_crypto: ['crypto', 'bitcoin', 'finance', 'investing', 'finanzas', 'finances', 'dinero', 'money', 'argent', 'geld', '加密', 'مال', 'invest'],
    true_crime: ['true crime', 'crimen real', 'crime réel', 'wahre verbrechen', 'crimine', 'crime', 'murder', 'killer', 'unsolved'],
    health_wellness: ['health', 'wellness', 'salud', 'santé', 'gesundheit', 'سلامت', '健康', 'saúde', 'medical', 'body'],
    ai_tech: ['artificial intelligence', 'AI', 'inteligencia artificial', 'technologie', 'technology', 'tech', '人工智能', 'robot', 'automation'],
    mythology: ['mythology', 'mitologia', 'mythologie', 'mythologie', 'mito', '神話', 'أسطورة', 'legend', 'gods', 'legends'],
    motivation_stoicism: ['stoicism', 'estoicismo', 'stoïcisme', 'motivation', 'motivacion', 'motivación', 'success', 'mindset', 'discipline'],
    conspiracy_paranormal: ['conspiracy', 'conspiración', 'complot', 'paranormal', 'ufo', 'alien', 'illuminati', 'secret', 'hidden truth'],
    natural_disasters: ['natural disaster', 'desastre natural', 'catastrophe', 'earthquake', 'volcano', 'hurricane', 'tsunami', 'disaster'],
    meditation_mindfulness: ['meditation', 'meditación', 'méditation', 'mindfulness', 'calm', 'relax', 'sleep music', 'anxiety relief'],
    wealth_secrets: ['wealth', 'riqueza', 'richesse', 'reichtum', 'millionaire', 'millonario', 'secret wealth', 'how to get rich', 'passive income']
  };

  var LANGUAGE_INDEX = {};
  var NICHE_INDEX = {};

  LANGUAGE_DEFS.forEach(function(entry) {
    LANGUAGE_INDEX[entry.code] = entry;
  });
  NICHE_LIBRARY.forEach(function(entry) {
    NICHE_INDEX[entry.id] = entry;
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toNumber(value) {
    var num = Number(value);
    return isFinite(num) ? num : 0;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function avg(list) {
    var filtered = (list || []).filter(function(value) { return isFinite(Number(value)); }).map(Number);
    if (!filtered.length) return 0;
    var total = filtered.reduce(function(sum, value) { return sum + value; }, 0);
    return total / filtered.length;
  }

  function unique(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function(item) {
      var key = String(item || '').trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  function normalizeText(text) {
    var raw = String(text || '').toLowerCase();
    if (raw.normalize) raw = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return raw.replace(/\s+/g, ' ').trim();
  }

  function slugify(text) {
    return normalizeText(text).replace(/[^a-z0-9\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u0980-\u09ff\u0b80-\u0bff\u0c00-\u0c7f\u10a0-\u10ff\u0e00-\u0e7f\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function compactNumber(value) {
    var num = toNumber(value);
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(num >= 10000000 ? 0 : 1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
    return String(Math.round(num));
  }

  function compactMoney(value) {
    var num = toNumber(value);
    if (!num) return '$0';
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(num >= 10000000 ? 0 : 1) + 'M';
    if (num >= 1000) return '$' + (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
    return '$' + Math.round(num);
  }

  function bandLabel(score) {
    if (score >= 7.5) return 'High';
    if (score >= 4.5) return 'Medium';
    return 'Low';
  }

  function verdictForScore(score) {
    if (score >= 8.6) return 'ENTER NOW';
    if (score >= 7.2) return 'TEST';
    if (score >= 5.8) return 'WATCH';
    return 'IGNORE';
  }

  function resolveLanguage(code) {
    return LANGUAGE_INDEX[code] || LANGUAGE_INDEX.auto;
  }

  function listLanguages() {
    return clone(LANGUAGE_DEFS);
  }

  function detectByScript(text) {
    if (!text) return null;
    if (SCRIPT_RE.japanese.test(text)) return 'ja';
    if (SCRIPT_RE.korean.test(text)) return 'ko';
    if (SCRIPT_RE.thai.test(text)) return 'th';
    if (SCRIPT_RE.tamil.test(text)) return 'ta';
    if (SCRIPT_RE.telugu.test(text)) return 'te';
    if (SCRIPT_RE.bengali.test(text)) return 'bn';
    if (SCRIPT_RE.devanagari.test(text)) return 'hi';
    if (SCRIPT_RE.hebrew.test(text)) return 'he';
    if (SCRIPT_RE.georgian.test(text)) return 'ka';
    if (SCRIPT_RE.arabic.test(text)) return /[پچژگ]/.test(text) ? 'fa' : (/[ٹڈڑںھ]/.test(text) ? 'ur' : 'ar');
    if (SCRIPT_RE.greek.test(text)) return 'el';
    if (SCRIPT_RE.cyrillic.test(text)) {
      if (/і|ї|є|ґ/.test(text)) return 'uk';
      if (/ъ|ь|щ/.test(text)) return 'bg';
      return 'ru';
    }
    if (SCRIPT_RE.han.test(text)) {
      if (/廣|東|粵/.test(text)) return 'yue';
      if (/體|歷|學/.test(text)) return 'zh-tw';
      return 'zh-cn';
    }
    return null;
  }

  function detectLatinLanguageByScore(text, normalized) {
    var raw = String(text || '').toLowerCase();
    var folded = normalized || normalizeText(raw);
    var scores = { en: 0, es: 0, de: 0, fr: 0, pt: 0, it: 0, pl: 0, nl: 0, sv: 0, no: 0, da: 0 };
    function add(code, re, weight) {
      var hits = folded.match(re);
      if (hits && hits.length) scores[code] += hits.length * (weight || 1);
    }
    if (/[ąćęłńóśźż]/i.test(raw)) scores.pl += 3;
    if (/[äöüß]/i.test(raw)) scores.de += 2.5;
    if (/[àâçéèêëîïôûùüÿœ]/i.test(raw)) scores.fr += 2;
    if (/[ãõ]/i.test(raw)) scores.pt += 2.5;
    if (/[ñ¿¡áéíóú]/i.test(raw)) scores.es += 2;
    if (/[åäö]/i.test(raw)) scores.sv += 1.5;
    if (/[æøå]/i.test(raw)) { scores.no += 1.2; scores.da += 1.2; }

    add('pl', /\b(szokujacych|faktow|nowym|jorku|ktory|ktora|ktore|ludzkosc|powierzchni|ziemi|zniszczy|zmiecie|tajemnice|przetrwal|pojscie|samo|dno|wulkan|dlaczego|jest|nie|czy|dla|przez|oraz)\b/g, 2);
    add('de', /\b(warum|wir|fast|vom|von|glauben|abgefallen|sind|nicht|komplett|zerlegt|geschichte|geheimnisse|dokumentation|uber|ueber|fur|fuer|der|die|das|und|mit|ist|eine|einer|zum|zur)\b/g, 2);
    add('es', /\b(que|porque|por|para|con|los|las|del|una|como|historia|misterio|datos|ciencia|supervivencia|dormir|nuevo|nueva|sobre|este|esta)\b/g, 1.4);
    add('en', /\b(the|and|with|from|into|story|stories|explained|documentary|history|facts|mystery|science|survival|why|how|did|during|sleep|brutal|winter|winters|vikings|longhouses|what|new|about|this|that)\b/g, 1.4);
    add('fr', /\b(pourquoi|avec|dans|des|les|une|histoire|mystere|documentaire|science|survie|nouveau|nouvelle|faits|sur)\b/g, 1.5);
    add('pt', /\b(porque|com|para|uma|historia|misterio|documentario|ciencia|sobrevivencia|novo|nova|fatos|sobre)\b/g, 1.5);
    add('it', /\b(perche|con|per|una|storia|mistero|documentario|scienza|sopravvivenza|nuovo|nuova|fatti)\b/g, 1.5);
    add('nl', /\b(waarom|wij|we|het|een|van|met|geschiedenis|mysterie|wetenschap|feiten|nieuw)\b/g, 1.8);
    add('sv', /\b(varfor|och|att|som|for|historia|mysterier|vetenskap|fakta|ny|nya)\b/g, 1.8);
    add('no', /\b(hvorfor|og|som|for|historie|mysterier|vitenskap|fakta|ny|nye)\b/g, 1.8);
    add('da', /\b(hvorfor|og|som|for|historie|mysterier|videnskab|fakta|ny|nye)\b/g, 1.8);

    var best = 'unknown', bestScore = 0, secondScore = 0;
    Object.keys(scores).forEach(function(code) {
      var score = scores[code] || 0;
      if (score > bestScore) {
        secondScore = bestScore;
        bestScore = score;
        best = code;
      } else if (score > secondScore) {
        secondScore = score;
      }
    });
    return bestScore >= 2.5 && (bestScore - secondScore >= 1 || bestScore >= 5) ? best : null;
  }

  function detectLanguage(text, fallbackCode) {
    var scriptHit = detectByScript(String(text || ''));
    if (scriptHit) return scriptHit;

    var normalized = normalizeText(text);
    if (!normalized) return fallbackCode || 'unknown';
    var scoredLang = detectLatinLanguageByScore(text || '', normalized);
    if (scoredLang) return scoredLang;

    var bestCode = 'unknown';
    var bestScore = 0;
    LANGUAGE_DEFS.forEach(function(language) {
      if (!language.detect || !language.detect.length) return;
      var score = 0;
      language.detect.forEach(function(token) {
        if (normalized.indexOf(normalizeText(token)) !== -1) score += 1;
      });
      if (language.nativeLabel && normalized.indexOf(normalizeText(language.nativeLabel)) !== -1) score += 0.5;
      if (language.label && normalized.indexOf(normalizeText(language.label)) !== -1) score += 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestCode = language.code;
      }
    });

    return bestScore >= 2 ? bestCode : (fallbackCode || 'unknown');
  }

  function searchLanguages(query, recentCodes) {
    var normalized = normalizeText(query);
    var recentRank = {};
    (recentCodes || []).forEach(function(code, index) { recentRank[code] = index; });
    return listLanguages().filter(function(language) {
      if (!normalized) return true;
      return normalizeText(language.label).indexOf(normalized) !== -1
        || normalizeText(language.nativeLabel).indexOf(normalized) !== -1
        || normalizeText(language.code).indexOf(normalized) !== -1;
    }).sort(function(a, b) {
      var ar = recentRank.hasOwnProperty(a.code) ? recentRank[a.code] : 999;
      var br = recentRank.hasOwnProperty(b.code) ? recentRank[b.code] : 999;
      if (ar !== br) return ar - br;
      return a.label.localeCompare(b.label);
    });
  }

  var NICHE_QUERY_TRANSLATIONS = {
    sleep_history:         { en:'ancient history for sleep', es:'historia antigua para dormir', pt:'historia antiga para dormir', fr:'histoire ancienne pour dormir', de:'alte geschichte zum einschlafen', it:'storia antica per dormire', ar:'تاريخ قديم للنوم', hi:'नींद के लिए इतिहास', ja:'眠れる歴史話', 'zh-cn':'睡前历史故事', ru:'история для сна', id:'sejarah untuk tidur', tr:'uyku için tarih', ko:'잠자리 역사 이야기', pl:'historia do zasypiania' },
    ancient_mysteries:     { en:'ancient mysteries documentary', es:'misterios antiguos documental', pt:'misterios antigos documentario', fr:'mysteres antiques documentaire', de:'antike mysterien dokumentation', it:'misteri antichi documentario', ar:'أسرار قديمة وثائقي', hi:'प्राचीन रहस्य', ja:'古代の謎ドキュメンタリー', 'zh-cn':'古代谜团纪录片', ru:'древние тайны документальный', id:'misteri kuno dokumenter', tr:'antik gizemler belgesel', ko:'고대 미스터리 다큐', pl:'starożytne tajemnice' },
    psychology_sleep:      { en:'psychology for sleep facts', es:'psicologia para dormir', pt:'psicologia para dormir', fr:'psychologie pour dormir', de:'psychologie schlaf fakten', it:'psicologia per dormire', ar:'علم النفس للنوم', hi:'नींद के लिए मनोविज्ञान', ja:'眠れる心理学', 'zh-cn':'心理学助眠事实', ru:'психология для сна', id:'psikologi untuk tidur', tr:'uyku psikolojisi', ko:'수면 심리학', pl:'psychologia dla snu' },
    science_mystery:       { en:'science mystery explained', es:'misterio cientifico explicado', pt:'misterio da ciencia explicado', fr:'mystere scientifique explique', de:'wissenschaft mysterium erklart', it:'mistero scientifico spiegato', ar:'غموض علمي موضح', hi:'विज्ञान रहस्य', ja:'科学の謎解説', 'zh-cn':'科学未解之谜', ru:'научная тайна объяснено', id:'misteri ilmu pengetahuan', tr:'bilim gizemi', ko:'과학 미스터리', pl:'zagadka naukowa' },
    survival_blackout:     { en:'survival without electricity', es:'supervivencia sin electricidad', pt:'sobrevivencia sem eletricidade', fr:'survie sans electricite', de:'uberleben ohne strom', it:'sopravvivenza senza elettricita', ar:'البقاء بدون كهرباء', hi:'बिजली के बिना जीना', ja:'停電サバイバル', 'zh-cn':'断电求生技巧', ru:'выживание без электричества', id:'bertahan tanpa listrik', tr:'elektriksiz hayatta kalma', ko:'정전 생존법', pl:'przetrwanie bez pradu' },
    religion_philosophy:   { en:'religion and philosophy explained', es:'religion y filosofia explicada', pt:'religiao e filosofia explicada', fr:'religion et philosophie expliquee', de:'religion und philosophie erklart', it:'religione e filosofia spiegata', ar:'الدين والفلسفة موضح', hi:'धर्म और दर्शन', ja:'宗教と哲学解説', 'zh-cn':'宗教与哲学解说', ru:'религия и философия', id:'agama dan filsafat', tr:'din ve felsefe', ko:'종교와 철학', pl:'religia i filozofia' },
    dark_history:          { en:'dark history secrets', es:'historia oscura secretos', pt:'historia sombria segredos', fr:'histoire sombre secrets', de:'dunkle geschichte geheimnisse', it:'storia oscura segreti', ar:'تاريخ مظلم اسرار', hi:'अंधेरा इतिहास रहस्य', ja:'闇の歴史の秘密', 'zh-cn':'黑暗历史秘密', ru:'мрачная история тайны', id:'sejarah gelap rahasia', tr:'karanlik tarih sirlari', ko:'어두운 역사의 비밀', pl:'mroczna historia tajemnice' },
    space_documentary:     { en:'space documentary universe', es:'documental del espacio', pt:'documentario do espaco', fr:'documentaire espace univers', de:'weltraum dokumentation', it:'documentario spazio universo', ar:'وثائقي الفضاء', hi:'अंतरिक्ष दस्तावेज़ी', ja:'宇宙ドキュメンタリー', 'zh-cn':'太空宇宙纪录片', ru:'документальный о космосе', id:'dokumenter luar angkasa', tr:'uzay belgeseli', ko:'우주 다큐멘터리', pl:'dokumentalny kosmos' },
    psychology_facts:      { en:'psychology facts mind', es:'datos de psicologia mente', pt:'fatos de psicologia mente', fr:'faits de psychologie esprit', de:'psychologie fakten geist', it:'fatti di psicologia mente', ar:'حقائق علم النفس', hi:'मनोविज्ञान तथ्य', ja:'心理学ファクト', 'zh-cn':'心理学惊人事实', ru:'факты психологии', id:'fakta psikologi', tr:'psikoloji gercekleri', ko:'심리학 사실', pl:'fakty psychologii' },
    history_documentary:   { en:'history documentary faceless', es:'documental de historia', pt:'documentario de historia', fr:'documentaire histoire', de:'geschichtsdokumentation', it:'documentario storia', ar:'وثائقي التاريخ', hi:'इतिहास दस्तावेज़ी', ja:'歴史ドキュメンタリー', 'zh-cn':'历史纪录片', ru:'исторический документальный', id:'dokumenter sejarah', tr:'tarih belgeseli', ko:'역사 다큐멘터리', pl:'dokumentalny historia' },
    finance_crypto:        { en:'crypto investing faceless channel', es:'cripto inversion canal', pt:'cripto investimento canal', fr:'investissement crypto chaine', de:'krypto investieren kanal', it:'cripto investimento canale', ar:'استثمار عملات رقمية', hi:'क्रिप्टो निवेश चैनल', ja:'仮想通貨投資チャンネル', 'zh-cn':'加密货币投资频道', ru:'крипто инвестиции', id:'investasi kripto', tr:'kripto yatirim kanali', ko:'암호화폐 투자', pl:'kryptowaluty inwestycje' },
    true_crime:            { en:'true crime documentary unsolved', es:'crimen real documental', pt:'crime real documentario', fr:'crime reel documentaire', de:'true crime dokumentation', it:'true crime documentario', ar:'جرائم حقيقية وثائقي', hi:'सच्चा अपराध दस्तावेज़ी', ja:'トゥルークライムドキュメンタリー', 'zh-cn':'真实犯罪纪录片', ru:'настоящее преступление документальный', id:'kriminal nyata dokumenter', tr:'gercek suc belgeseli', ko:'실제 범죄 다큐', pl:'prawdziwe zbrodnie dokumentalny' },
    health_wellness:       { en:'health wellness tips faceless', es:'salud bienestar consejos', pt:'saude bem estar dicas', fr:'sante bien-etre conseils', de:'gesundheit wellness tipps', it:'salute benessere consigli', ar:'الصحة والعافية نصائح', hi:'स्वास्थ्य और कल्याण', ja:'健康ウェルネス', 'zh-cn':'健康养生技巧', ru:'здоровье и велнес советы', id:'kesehatan tips', tr:'saglik iyilik ipuclari', ko:'건강 웰니스 팁', pl:'zdrowie i dobre samopoczucie' },
    ai_tech:               { en:'artificial intelligence explained faceless', es:'inteligencia artificial explicada', pt:'inteligencia artificial explicada', fr:'intelligence artificielle expliquee', de:'kuenstliche intelligenz erklart', it:'intelligenza artificiale spiegata', ar:'الذكاء الاصطناعي شرح', hi:'आर्टिफिशियल इंटेलिजेंस', ja:'人工知能解説', 'zh-cn':'人工智能解说频道', ru:'искусственный интеллект объяснение', id:'kecerdasan buatan penjelasan', tr:'yapay zeka anlat', ko:'인공지능 설명', pl:'sztuczna inteligencja wyjasniona' },
    mythology:             { en:'mythology legends stories', es:'mitologia leyendas historias', pt:'mitologia lendas historias', fr:'mythologie legendes histoires', de:'mythologie legenden geschichten', it:'mitologia leggende storie', ar:'الاساطير والتراث قصص', hi:'पौराणिक कथाएं और किंवदंतियां', ja:'神話と伝説の物語', 'zh-cn':'神话传说故事', ru:'мифология и легенды', id:'mitologi legenda cerita', tr:'mitoloji efsane hikayeleri', ko:'신화와 전설 이야기', pl:'mitologia legendy opowiesci' },
    motivation_stoicism:   { en:'stoicism motivation discipline', es:'estoicismo motivacion disciplina', pt:'estoicismo motivacao disciplina', fr:'stoicisme motivation discipline', de:'stoizismus motivation disziplin', it:'stoicismo motivazione disciplina', ar:'الرواقية والتحفيز', hi:'स्टोइसिज्म प्रेरणा', ja:'ストア哲学とモチベーション', 'zh-cn':'斯多葛主义励志', ru:'стоицизм мотивация', id:'stoikisme motivasi', tr:'stoacilik motivasyon', ko:'스토아철학 동기부여', pl:'stoicyzm motywacja dyscyplina' },
    conspiracy_paranormal: { en:'conspiracy theory documentary secrets', es:'conspiracion teoria documental', pt:'conspiracao teoria documentario', fr:'theorie du complot documentaire', de:'verschworungstheorie dokumentation', it:'complotto teoria documentario', ar:'نظرية المؤامرة وثائقي', hi:'षड्यंत्र सिद्धांत दस्तावेज़ी', ja:'陰謀論ドキュメンタリー', 'zh-cn':'阴谋论纪录片真相', ru:'теория заговора документальный', id:'teori konspirasi dokumenter', tr:'komplo teorisi belgesel', ko:'음모론 다큐멘터리', pl:'teoria spiskow dokumentalny' },
    natural_disasters:     { en:'natural disasters documentary', es:'desastres naturales documental', pt:'desastres naturais documentario', fr:'catastrophes naturelles documentaire', de:'naturkatastrophen dokumentation', it:'catastrofi naturali documentario', ar:'الكوارث الطبيعية وثائقي', hi:'प्राकृतिक आपदाएं दस्तावेज़ी', ja:'自然災害ドキュメンタリー', 'zh-cn':'自然灾害纪录片', ru:'стихийные бедствия документальный', id:'bencana alam dokumenter', tr:'dogal afetler belgesel', ko:'자연재해 다큐멘터리', pl:'kleski zywiolowe dokumentalny' },
    meditation_mindfulness:{ en:'meditation sleep music mindfulness', es:'meditacion musica para dormir', pt:'meditacao musica para dormir', fr:'meditation musique sommeil', de:'meditation schlafmusik achtsamkeit', it:'meditazione musica per dormire', ar:'تأمل موسيقى النوم', hi:'ध्यान नींद संगीत', ja:'瞑想ヒーリングミュージック', 'zh-cn':'冥想睡眠音乐', ru:'медитация музыка для сна', id:'meditasi musik tidur', tr:'meditasyon uyku muzigi', ko:'명상 수면 음악', pl:'medytacja muzyka do snu' },
    wealth_secrets:        { en:'wealth secrets millionaire mindset', es:'secretos de riqueza millonario', pt:'segredos da riqueza milionario', fr:'secrets richesse millionnaire', de:'reichtum geheimnisse milliionar', it:'segreti ricchezza milionario', ar:'اسرار الثروة المليونير', hi:'करोड़पति धन रहस्य', ja:'富の秘密億万長者', 'zh-cn':'财富秘诀百万富翁', ru:'секреты богатства миллионер', id:'rahasia kekayaan jutawan', tr:'zenginlik sirlari milyoner', ko:'부의 비밀 백만장자', pl:'sekrety bogactwa milioner' }
  };

  var LANGUAGE_QUERY_TERMS = {
    da: { history:'historie', sleep:'sovn', ancient:'oldtidens', mystery:'mysterier', psychology:'psykologi', science:'videnskab', survival:'overlevelse', blackout:'stromafbrydelse', religion:'religion', philosophy:'filosofi', documentary:'dokumentar', crypto:'krypto', finance:'finans', true:'virkelige', crime:'kriminalitet', health:'sundhed', wellness:'velvaere', AI:'kunstig intelligens', technology:'teknologi', mythology:'mytologi', legends:'legender', stoicism:'stoicisme', motivation:'motivation', conspiracy:'konspiration', paranormal:'paranormal', natural:'natur', disasters:'katastrofer', meditation:'meditation', mindfulness:'mindfulness', wealth:'rigdom', secrets:'hemmeligheder' },
    vi: { history:'lich su', sleep:'de ngu', ancient:'co dai', mystery:'bi an', psychology:'tam ly hoc', science:'khoa hoc', survival:'sinh ton', blackout:'mat dien', religion:'ton giao', philosophy:'triet hoc', documentary:'phim tai lieu', crypto:'tien dien tu', finance:'tai chinh', true:'co that', crime:'toi pham', health:'suc khoe', wellness:'song khoe', AI:'tri tue nhan tao', technology:'cong nghe', mythology:'than thoai', legends:'truyen thuyet', stoicism:'chu nghia khac ky', motivation:'dong luc', conspiracy:'am muu', paranormal:'sieu nhien', natural:'thien nhien', disasters:'tham hoa', meditation:'thien', mindfulness:'chanh niem', wealth:'giau co', secrets:'bi mat' },
    hr: { history:'povijest', sleep:'spavanje', ancient:'drevne', mystery:'misterije', psychology:'psihologija', science:'znanost', survival:'prezivljavanje', blackout:'nestanak struje', religion:'religija', philosophy:'filozofija', documentary:'dokumentarac', crypto:'kripto', finance:'financije', true:'stvarni', crime:'kriminal', health:'zdravlje', wellness:'dobrobit', AI:'umjetna inteligencija', technology:'tehnologija', mythology:'mitologija', legends:'legende', stoicism:'stoicizam', motivation:'motivacija', conspiracy:'zavjera', paranormal:'paranormalno', natural:'prirodne', disasters:'katastrofe', meditation:'meditacija', mindfulness:'svjesnost', wealth:'bogatstvo', secrets:'tajne' },
    et: { history:'ajalugu', sleep:'uni', ancient:'iidsed', mystery:'musteeriumid', psychology:'psuhholoogia', science:'teadus', survival:'ellujaamine', blackout:'elektrikatkestus', religion:'religioon', philosophy:'filosoofia', documentary:'dokumentaal', crypto:'krupto', finance:'rahandus', true:'tosielu', crime:'kuriteod', health:'tervis', wellness:'heaolu', AI:'tehisintellekt', technology:'tehnoloogia', mythology:'mutoloogia', legends:'legendid', stoicism:'stoitsism', motivation:'motivatsioon', conspiracy:'vandenou', paranormal:'paranormaalne', natural:'loodus', disasters:'katastroofid', meditation:'meditatsioon', mindfulness:'teadvelolek', wealth:'rikkus', secrets:'saladused' },
    bn: { history:'itihash', sleep:'ghum', ancient:'prachin', mystery:'rohoshyo', psychology:'monobiggan', science:'biggan', survival:'tike thaka', blackout:'bidyut nei', religion:'dhormo', philosophy:'dorshon', documentary:'totthochitro', crypto:'crypto', finance:'ortho', true:'shotto', crime:'oporadh', health:'shastho', wellness:'susthota', AI:'kritrim buddhimotta', technology:'projukti', mythology:'puran', legends:'kingbodonti', stoicism:'stoicism', motivation:'onuprerona', conspiracy:'sorojontro', paranormal:'paranormal', natural:'prakritik', disasters:'durjog', meditation:'dhyan', mindfulness:'mindfulness', wealth:'sampad', secrets:'gopon' }
  };

  function buildGeneratedQueryMap(language) {
    var code = language.code || 'auto';
    var detect = (language.detect || []).slice();
    var termMap = LANGUAGE_QUERY_TERMS[code] || {};
    var map = {
      history: detect[0] || 'history',
      mystery: detect[1] || detect[0] || 'mystery',
      psychology: detect[2] || 'psychology',
      science: detect[3] || 'science',
      survival: detect[4] || 'survival',
      sleep: (language.queries && language.queries[0]) ? String(language.queries[0]).split(/\s+/)[0] : (detect[0] || 'sleep'),
      ancient: detect[0] || 'ancient',
      blackout: 'blackout',
      religion: 'religion',
      philosophy: 'philosophy',
      documentary: 'documentary',
      crypto: 'crypto',
      finance: 'finance',
      AI: 'AI',
      technology: 'technology',
      crime: 'crime',
      health: 'health',
      wellness: 'wellness',
      mythology: 'mythology',
      legends: 'legends',
      stoicism: 'stoicism',
      motivation: 'motivation',
      conspiracy: 'conspiracy',
      paranormal: 'paranormal',
      natural: 'natural',
      disasters: 'disasters',
      meditation: 'meditation',
      mindfulness: 'mindfulness',
      wealth: 'wealth',
      secrets: 'secrets'
    };
    return QUERY_TEMPLATES.reduce(function(acc, template, index) {
      // Use curated translation if available, otherwise build from parts
      if (NICHE_QUERY_TRANSLATIONS[template.nicheId] && NICHE_QUERY_TRANSLATIONS[template.nicheId][code]) {
        acc[template.nicheId] = NICHE_QUERY_TRANSLATIONS[template.nicheId][code];
      } else if (Object.keys(termMap).length && template.parts.every(function(part) { return termMap[part]; })) {
        acc[template.nicheId] = template.parts.map(function(part) { return termMap[part]; }).join(template.connector || ' ');
      } else if (language.queries && language.queries.length) {
        acc[template.nicheId] = language.queries[index % language.queries.length];
      } else {
        acc[template.nicheId] = template.parts.map(function(part) {
          return map[part] || map.history;
        }).join(template.connector || ' ');
      }
      return acc;
    }, {});
  }

function buildGeneratedQueries(language) {
    var queryMap = buildGeneratedQueryMap(language);
    return QUERY_TEMPLATES.map(function(template) {
      return queryMap[template.nicheId];
    });
  }

  function buildQueryPool(code) {
    if (!code || code === 'auto') {
      var autoCodes = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ja', 'ar', 'hi', 'id'];
      return unique(autoCodes.reduce(function(list, langCode) {
        return list.concat(buildQueryPool(langCode).slice(0, 3));
      }, []));
    }
    var language = resolveLanguage(code);
    var pool = [];
    if (language.queries && language.queries.length) pool = pool.concat(language.queries);
    if (pool.length < 6) pool = pool.concat(buildGeneratedQueries(language));
    return unique(pool.filter(Boolean));
  }

  function buildQueryForNiche(code, nicheId) {
    var langCode = code || 'auto';
    var pool = buildQueryPool(langCode);
    if (!nicheId) return pool[0] || '';

    var language = resolveLanguage(langCode);
    var generatedMap = buildGeneratedQueryMap(language);
    if (generatedMap[nicheId]) pool.unshift(generatedMap[nicheId]);

    var niche = NICHE_INDEX[nicheId] || null;
    var tokens = unique(
      []
        .concat(String(nicheId || '').split('_'))
        .concat(niche && niche.label ? normalizeText(niche.label).split(/\s+/) : [])
        .concat(niche && niche.tags ? niche.tags : [])
    ).filter(Boolean);

    var bestQuery = pool[0] || '';
    var bestScore = -1;
    pool.forEach(function(query, index) {
      var normalized = normalizeText(query);
      var score = 0;
      tokens.forEach(function(token) {
        if (!token) return;
        if (normalized.indexOf(normalizeText(token)) !== -1) score += token.length > 5 ? 2 : 1;
      });
      if (generatedMap[nicheId] && normalizeText(generatedMap[nicheId]) === normalized) score += 1.5;
      if (index === 0) score += 0.05;
      if (score > bestScore) {
        bestScore = score;
        bestQuery = query;
      }
    });

    return bestQuery || pool[0] || '';
  }

  function inferNicheIdFromText(text) {
    var normalized = normalizeText(text);
    var bestId = 'history_documentary';
    var bestScore = 0;
    Object.keys(NICHE_KEYWORDS).forEach(function(nicheId) {
      var score = 0;
      NICHE_KEYWORDS[nicheId].forEach(function(token) {
        if (normalized.indexOf(normalizeText(token)) !== -1) score += 1;
      });
      if (score > bestScore) {
        bestId = nicheId;
        bestScore = score;
      }
    });
    return bestId;
  }

  function inferEntryLanguage(entry) {
    entry = entry || {};
    var detected = detectLanguage([entry.title || '', entry.channelName || '', entry.channelUrl || '', entry.niche || ''].join(' '), 'unknown');
    return detected && detected !== 'unknown' ? detected : (entry.language || 'unknown');
  }

  function inferEntryFreshnessHours(entry) {
    if (entry.hoursOld !== undefined && entry.hoursOld !== null) return Math.max(0, toNumber(entry.hoursOld));
    if (entry.ageHours !== undefined && entry.ageHours !== null) return Math.max(0, toNumber(entry.ageHours));
    if (entry.savedAt) return Math.max(0, (Date.now() - toNumber(entry.savedAt)) / 3600000);
    return null;
  }

  function hydrateEntry(raw) {
    raw = raw || {};
    var title = String(raw.title || raw.name || 'Unknown').trim();
    var channelName = String(raw.channelName || raw.channel || raw.name || '').trim();
    var nicheId = raw.nicheId || inferNicheIdFromText([raw.niche || '', title, channelName].join(' '));
    var languageCode = inferEntryLanguage(raw);
    var freshnessHours = inferEntryFreshnessHours(raw);
    var facelessScore = toNumber(raw.facelessScore);
    if (!facelessScore) {
      var text = normalizeText([title, raw.niche || '', channelName].join(' '));
      facelessScore = /history|mystery|psychology|science|survival|documentary|story|dormir|sleep|historia|misterio|philosophy|religion|crypto|bitcoin|finance|investing|true crime|crime|health|wellness|salud|ai|artificial intelligence|technology|mythology|mitologia|stoicism|motivation|conspiracy|paranormal|disaster|meditation|mindfulness|wealth|riqueza/.test(text) ? 84 : 56;
    }
    return {
      title: title,
      channelName: channelName,
      channelUrl: String(raw.channelUrl || '').trim(),
      channelId: String(raw.channelId || '').trim(),
      source: String(raw.source || '').trim(),
      language: languageCode,
      nicheId: nicheId,
      nicheLabel: String(raw.niche || (NICHE_INDEX[nicheId] ? NICHE_INDEX[nicheId].label : 'General')).trim(),
      views: toNumber(raw.views),
      subs: toNumber(raw.subs),
      vph: toNumber(raw.vph),
      rpm: toNumber(raw.rpm),
      os: toNumber(raw.os),
      totalRev: toNumber(raw.totalRev || raw.revMonth),
      revMonth: toNumber(raw.revMonth),
      savedAt: toNumber(raw.savedAt) || Date.now(),
      freshnessHours: freshnessHours,
      facelessScore: facelessScore,
      facelessClassification: raw.facelessClassification || (facelessScore >= 72 ? 'faceless' : facelessScore >= 58 ? 'borderline' : 'mixed'),
      isNew: freshnessHours !== null ? freshnessHours <= 168 : false,
      isMonthFresh: freshnessHours !== null ? freshnessHours <= 24 * 30 : false,
      isQuarterFresh: freshnessHours !== null ? freshnessHours <= 24 * 90 : false
    };
  }

  function hydrateEntries(rawList) {
    return (rawList || []).map(hydrateEntry);
  }

  function getNicheLabel(nicheId) {
    return NICHE_INDEX[nicheId] ? NICHE_INDEX[nicheId].label : 'Unknown Niche';
  }

  function opportunityBadges(metrics) {
    var badges = [];
    if (metrics.opportunityScore >= 8.6) badges.push('FIRE');
    if (metrics.estimatedRpm >= 10) badges.push('PREMIUM RPM');
    else if (metrics.estimatedRpm >= 8) badges.push('HIGH RPM');
    if (metrics.competitionScore <= 3.9) badges.push('LOW COMP');
    if (metrics.facelessScore >= 8.8) badges.push('FULL FACELESS');
    else if (metrics.facelessScore >= 8.2) badges.push('FACELESS');
    if (metrics.repeatabilityScore >= 9.0) badges.push('INFINITELY SCALABLE');
    else if (metrics.repeatabilityScore >= 7.8) badges.push('EASY SCALE');
    if (metrics.languageGapScore >= 8.0) badges.push('VIRGIN MARKET');
    else if (metrics.languageGapScore >= 7.0) badges.push('UNDERSERVED');
    if (metrics.outlierRate >= 0.22) badges.push('OUTLIER PRONE');
    if (metrics.trendingRate >= 0.28) badges.push('TRENDING');
    if (metrics.saturationScore <= 3.5) badges.push('CLEAN SPACE');
    return badges;
  }

  function estimateMonthlyRevenue(rpmValue, demandScore, saturationScore) {
    var baseViews = 40000 + (demandScore * 22000) - (saturationScore * 8000);
    var views = Math.max(15000, Math.round(baseViews / 1000) * 1000);
    var low = Math.round(views * (rpmValue * 0.75) / 1000);
    var high = Math.round(views * (rpmValue * 1.4) / 1000);
    return { views: views, low: Math.max(50, low), high: Math.max(120, high) };
  }

  function estimateMonthlySearchVolume(demandScore, saturationScore, avgVph, entryCount, language, niche) {
    var observedVelocity = Math.max(0, toNumber(avgVph || 0));
    var observedDemand = observedVelocity ? observedVelocity * 24 * 30 * 0.32 : 0;
    var modelDemand = (demandScore * 5200) + ((10 - saturationScore) * 1800) + (entryCount * 950);
    var languageMultiplier = language && language.audienceWeight ? language.audienceWeight : 1;
    var nicheMultiplier = niche && niche.outlierBias ? (0.86 + niche.outlierBias) : 1;
    var volume = Math.max(modelDemand, observedDemand) * languageMultiplier * nicheMultiplier;
    return Math.max(1000, Math.round(volume / 100) * 100);
  }

  function buildRegions(languageCode, nicheId, demandScore, rpmValue) {
    var language = resolveLanguage(languageCode);
    var niche = NICHE_INDEX[nicheId] || NICHE_INDEX.history_documentary;
    return (language.regions || []).slice(0, 3).map(function(region) {
      var demandValue = clamp((region.demand * 10) + (demandScore - 5) * 0.45, 0, 10);
      var rpmValueRegion = Math.max(0.5, rpmValue * (region.rpm || 1));
      return {
        code: region.code,
        label: region.label,
        demand: bandLabel(demandValue),
        monetization: rpmValueRegion >= 8 ? 'High' : rpmValueRegion >= 5 ? 'Medium' : 'Low',
        nicheFit: niche.tags.indexOf('storytelling') !== -1 ? 'Narrative-friendly' : 'Evergreen-friendly',
        diaspora: region.diaspora || ('Useful for ' + language.label + ' diaspora audiences.'),
        score: round1(demandValue)
      };
    });
  }

  function round1(value) {
    return Math.round(toNumber(value) * 10) / 10;
  }

  function computeOpportunityFromBucket(languageCode, nicheId, entries, historyEntries) {
    var language = resolveLanguage(languageCode);
    var niche = NICHE_INDEX[nicheId] || NICHE_INDEX.history_documentary;
    var bucket = (entries || []).filter(function(entry) {
      return entry.language === languageCode && entry.nicheId === nicheId;
    });
    var allLanguageEntries = (entries || []).filter(function(entry) {
      return entry.language === languageCode;
    });
    var nicheGlobalEntries = (entries || []).filter(function(entry) {
      return entry.nicheId === nicheId;
    });

    var entryCount = bucket.length;
    var recentEntries = bucket.filter(function(entry) { return entry.isQuarterFresh; });
    var weekEntries = bucket.filter(function(entry) { return entry.isNew; });
    var avgRpm = avg(bucket.map(function(entry) { return entry.rpm; }));
    var avgVph = avg(bucket.map(function(entry) { return entry.vph; }));
    var avgFaceless = avg(bucket.map(function(entry) { return entry.facelessScore; })) / 10;
    var avgSubs = avg(bucket.map(function(entry) { return entry.subs; }));
    var repeatedChannels = {};
    bucket.forEach(function(entry) {
      var key = entry.channelId || entry.channelUrl || entry.channelName || entry.title;
      repeatedChannels[key] = (repeatedChannels[key] || 0) + 1;
    });
    var repeatedDensity = entryCount ? (Object.keys(repeatedChannels).filter(function(key) { return repeatedChannels[key] > 1; }).length / entryCount) : 0;
    var outlierRate = entryCount ? bucket.filter(function(entry) {
      return entry.subs > 0 ? entry.views > entry.subs * 4 : entry.views >= 150000;
    }).length / entryCount : niche.outlierBias;
    var trendingRate = entryCount ? weekEntries.length / Math.max(entryCount, 1) : 0.18;

    var rpmValue = avgRpm || (niche.baseRpm * language.rpmBias);
    var rpmScore = clamp((rpmValue / 12) * 10, 0, 10);
    var demandScore = clamp(
      niche.baseDemand * 0.58
      + clamp(avgVph / 160, 0, 4.2)
      + clamp(recentEntries.length * 0.4, 0, 1.4)
      + (language.audienceWeight * 1.2),
      0,
      10
    );
    var saturationScore = clamp(
      niche.baseSaturation * 0.7
      + clamp(entryCount * 0.45, 0, 3.6)
      + clamp(nicheGlobalEntries.length * 0.08, 0, 1.6),
      0,
      10
    );
    var competitionScore = clamp(
      niche.baseCompetition * 0.72
      + repeatedDensity * 4.0
      + clamp(avgSubs / 250000, 0, 2.4),
      0,
      10
    );
    var facelessScore = clamp(
      (niche.facelessBase * 0.68) + (avgFaceless * 0.32),
      0,
      10
    );
    var repeatabilityScore = clamp(
      niche.repeatabilityBase * 0.72
      + clamp(entryCount * 0.18, 0, 1.4)
      + (bucket.filter(function(entry) { return entry.facelessClassification === 'faceless'; }).length / Math.max(entryCount, 1)) * 1.4,
      0,
      10
    );
    var languageGapScore = clamp(
      (language.underservedBias * 6.4)
      + clamp((demandScore - saturationScore) * 0.65, 0, 2.4)
      - clamp(allLanguageEntries.length * 0.03, 0, 1.6),
      0,
      10
    );

    var finalScore =
      (rpmScore * SCORE_WEIGHTS.rpm) +
      (demandScore * SCORE_WEIGHTS.demand) +
      ((10 - saturationScore) * SCORE_WEIGHTS.saturationInverse) +
      ((10 - competitionScore) * SCORE_WEIGHTS.competitionInverse) +
      (facelessScore * SCORE_WEIGHTS.faceless) +
      (repeatabilityScore * SCORE_WEIGHTS.repeatability) +
      (languageGapScore * SCORE_WEIGHTS.languageGap);

    var score = round1(clamp(finalScore, 0, 10));
    var revEstimate = estimateMonthlyRevenue(rpmValue, demandScore, saturationScore);
    var estimatedMonthlySearchVolume = estimateMonthlySearchVolume(demandScore, saturationScore, avgVph, entryCount, language, niche);
    var regions = buildRegions(languageCode, nicheId, demandScore, rpmValue);
    var why = niche.why
      + ' In ' + language.label + ', the gap is '
      + (languageGapScore >= 7 ? 'still underserved' : languageGapScore >= 5 ? 'open enough to test' : 'more contested') + '.';
    var comparisonNote = languageGapScore >= 7
      ? language.label + ' has a cleaner gap than the crowded core markets.'
      : language.label + ' competes harder and needs better packaging to win.';

    return {
      languageCode: languageCode,
      languageLabel: language.label,
      languageNativeLabel: language.nativeLabel,
      nicheId: nicheId,
      recommendedNiche: niche.label,
      opportunityScore: score,
      estimatedRpm: round1(rpmValue),
      estimatedCpm: round1(rpmValue * 1.45),
      estimatedMonthlySearchVolume: estimatedMonthlySearchVolume,
      estimatedMonthlyRevenueLow: revEstimate.low,
      estimatedMonthlyRevenueHigh: revEstimate.high,
      estimatedMonthlyViews: revEstimate.views,
      rpmScore: round1(rpmScore),
      demandScore: round1(demandScore),
      demandLabel: bandLabel(demandScore),
      saturationScore: round1(saturationScore),
      saturationLabel: bandLabel(saturationScore),
      competitionScore: round1(competitionScore),
      competitionLabel: bandLabel(competitionScore),
      facelessScore: round1(facelessScore),
      repeatabilityScore: round1(repeatabilityScore),
      languageGapScore: round1(languageGapScore),
      velocity: Math.round(avgVph || (demandScore * 45)),
      entryCount: entryCount,
      recentCount: recentEntries.length,
      savedCount: entryCount,
      weekCount: weekEntries.length,
      regions: regions,
      why: why,
      comparisonNote: comparisonNote,
      verdict: verdictForScore(score),
      badges: opportunityBadges({
        opportunityScore: score,
        estimatedRpm: round1(rpmValue),
        competitionScore: competitionScore,
        saturationScore: saturationScore,
        facelessScore: facelessScore,
        repeatabilityScore: repeatabilityScore,
        languageGapScore: languageGapScore,
        outlierRate: outlierRate,
        trendingRate: trendingRate
      }),
      tags: niche.tags.slice(),
      isTrending: trendingRate >= 0.28,
      isOutlierHeavy: outlierRate >= 0.22,
      isUnderserved: languageGapScore >= 7,
      isNew: recentEntries.length > 0,
      updatedAt: Date.now(),
      historySample: (historyEntries || []).filter(function(entry) {
        return entry.languageCode === languageCode && entry.nicheId === nicheId;
      }).slice(-6)
    };
  }

  function buildLanguageMatrix(entries, selectedLanguage, activeFilters, historyEntries) {
    var hydrated = hydrateEntries(entries);
    var languages = selectedLanguage && selectedLanguage !== 'auto'
      ? [selectedLanguage]
      : LANGUAGE_DEFS.filter(function(language) { return language.code !== 'auto'; }).map(function(language) { return language.code; });
    var opportunities = [];
    languages.forEach(function(languageCode) {
      NICHE_LIBRARY.forEach(function(niche) {
        opportunities.push(computeOpportunityFromBucket(languageCode, niche.id, hydrated, historyEntries || []));
      });
    });
    opportunities.sort(function(a, b) { return b.opportunityScore - a.opportunityScore; });
    return filtersEngine.apply(opportunities, activeFilters).slice(0, selectedLanguage && selectedLanguage !== 'auto' ? 24 : 60);
  }

  function compareNicheAcrossLanguages(nicheId, entries, languageCodes, historyEntries) {
    var hydrated = hydrateEntries(entries);
    var codes = (languageCodes && languageCodes.length ? languageCodes : ['en', 'es', 'fr', 'de', 'ja', 'ar']).filter(function(code) {
      return code && code !== 'auto';
    });
    return codes.map(function(code) {
      return computeOpportunityFromBucket(code, nicheId, hydrated, historyEntries || []);
    }).sort(function(a, b) { return b.opportunityScore - a.opportunityScore; });
  }

  function buildTopUnderserved(opportunities) {
    return (opportunities || []).slice().sort(function(a, b) {
      return (b.languageGapScore - a.languageGapScore) || (b.opportunityScore - a.opportunityScore);
    }).slice(0, 10);
  }

  function buildVelocityMonitor(entries, selectedLanguage) {
    var hydrated = hydrateEntries(entries);
    var filtered = selectedLanguage && selectedLanguage !== 'auto'
      ? hydrated.filter(function(entry) { return entry.language === selectedLanguage; })
      : hydrated.slice();
    return filtered.sort(function(a, b) {
      return (b.vph - a.vph) || (b.os - a.os);
    }).slice(0, 8).map(function(entry) {
      return {
        title: entry.title,
        languageCode: entry.language,
        languageLabel: resolveLanguage(entry.language).label,
        nicheLabel: getNicheLabel(entry.nicheId),
        vph: entry.vph,
        rpm: entry.rpm,
        os: entry.os,
        savedAt: entry.savedAt,
        source: entry.source
      };
    });
  }

  function buildSavedByLanguage(entries) {
    var hydrated = hydrateEntries(entries);
    var grouped = {};
    hydrated.forEach(function(entry) {
      var code = entry.language || 'unknown';
      if (!grouped[code]) grouped[code] = [];
      grouped[code].push(entry);
    });
    return Object.keys(grouped).map(function(code) {
      var list = grouped[code].slice().sort(function(a, b) { return b.savedAt - a.savedAt; });
      return {
        code: code,
        label: resolveLanguage(code).label,
        total: list.length,
        monthlyPool: list.reduce(function(sum, entry) { return sum + (entry.revMonth || 0); }, 0),
        avgRpm: avg(list.map(function(entry) { return entry.rpm; })),
        items: list.slice(0, 6)
      };
    }).sort(function(a, b) {
      return (b.total - a.total) || (b.monthlyPool - a.monthlyPool);
    });
  }

  var TITLE_STOPWORDS = {
    the: 1, and: 1, for: 1, with: 1, from: 1, into: 1, this: 1, that: 1, your: 1, you: 1, are: 1, how: 1, why: 1,
    what: 1, when: 1, who: 1, de: 1, del: 1, la: 1, las: 1, los: 1, para: 1, con: 1, por: 1, como: 1, que: 1,
    una: 1, uno: 1, des: 1, les: 1, avec: 1, pour: 1, sur: 1, une: 1, und: 1, mit: 1, der: 1, die: 1, das: 1,
    den: 1, unaa: 1, paraa: 1, sem: 1, com: 1, nel: 1, per: 1, gli: 1, una: 1, unoo: 1
  };

  function titleTokens(text) {
    return slugify(text || '').split('-').filter(function(token) {
      return token && token.length >= 3 && !TITLE_STOPWORDS[token];
    });
  }

  function classifyTitlePatterns(title) {
    var raw = normalizeText(title || '');
    var labels = [];
    if (!raw) return ['descriptive evergreen'];
    if (/^\d+|\b\d+\b/.test(raw)) labels.push('numbers / list hooks');
    if (/[?]/.test(String(title || '')) || /\b(how|why|what|who|when|como|por que|porque|cuando|quien|que pasa|comment|pourquoi|wie|warum|cual|cuanto)\b/.test(raw)) {
      labels.push('question-led curiosity');
    }
    if (/\b(secret|secrets|hidden|forbidden|untold|mystery|mysteries|dark|ancient|myth|legend|misterio|misterios|mystere|secretos|oculto|prohibid|enigma|conspir|misteri|zahad|tajem|gizem)\b/.test(raw)) {
      labels.push('secret / forbidden hook');
    }
    if (/\b(explained|explain|documentary|documentaire|documental|dokumentation|docu|history|historia|histoire|geschichte|philosophy|religion|science|ciencia|scienza|psychology|psicologia|psychologie)\b/.test(raw)) {
      labels.push('explainer / documentary');
    }
    if (/\b(sleep|dormir|sommeil|schlaf|relax|calm|ambient)\b/.test(raw)) labels.push('sleep / calm utility');
    if (/\b(survival|survie|superviv|blackout|electricity|guide|tips|without electricity|sin electricidad|prepper)\b/.test(raw)) labels.push('practical / survival');
    if (/\b(vs|versus|ranked|ranking|best|top|mejor|mejores|greatest|compare|comparison)\b/.test(raw)) labels.push('comparison / ranking');
    if (!labels.length) labels.push('descriptive evergreen');
    return unique(labels);
  }

  function countTitlePatterns(entries) {
    var counts = {};
    (entries || []).forEach(function(entry) {
      classifyTitlePatterns(entry.title || '').forEach(function(label) {
        counts[label] = (counts[label] || 0) + 1;
      });
    });
    return counts;
  }

  function topPatternLabels(entries, limit) {
    var counts = countTitlePatterns(entries);
    return Object.keys(counts).sort(function(a, b) {
      return (counts[b] - counts[a]) || a.localeCompare(b);
    }).slice(0, limit || 4);
  }

  function topTitleTerms(entries, limit) {
    var counts = {};
    (entries || []).forEach(function(entry) {
      titleTokens(entry.title || '').forEach(function(token) {
        counts[token] = (counts[token] || 0) + 1;
      });
    });
    return Object.keys(counts).sort(function(a, b) {
      return (counts[b] - counts[a]) || a.localeCompare(b);
    }).slice(0, limit || 8);
  }

  function avgTitleLength(entries) {
    return avg((entries || []).map(function(entry) {
      return String((entry && entry.title) || '').trim().length;
    }));
  }

  function patternRate(entries, label) {
    if (!(entries || []).length) return 0;
    return (entries || []).filter(function(entry) {
      return classifyTitlePatterns(entry.title || '').indexOf(label) >= 0;
    }).length / Math.max((entries || []).length, 1);
  }

  function buildCompetitorGroups(entries) {
    var grouped = {};
    (entries || []).forEach(function(entry) {
      var key = entry.channelId || entry.channelUrl || entry.channelName || entry.title;
      if (!key) return;
      if (!grouped[key]) grouped[key] = {
        key: key,
        channelLabel: entry.channelName || entry.title || 'Unknown channel',
        channelId: entry.channelId || '',
        channelUrl: entry.channelUrl || '',
        entries: []
      };
      grouped[key].entries.push(entry);
    });
    return Object.keys(grouped).map(function(key) {
      var group = grouped[key];
      var list = group.entries.slice().sort(function(a, b) {
        return (b.vph - a.vph) || (b.os - a.os) || (b.revMonth - a.revMonth);
      });
      return {
        key: key,
        channelLabel: group.channelLabel,
        channelId: group.channelId,
        channelUrl: group.channelUrl,
        sampleCount: list.length,
        avgVph: Math.round(avg(list.map(function(entry) { return entry.vph; }))),
        avgRpm: round1(avg(list.map(function(entry) { return entry.rpm; }))),
        avgOs: round1(avg(list.map(function(entry) { return entry.os; }))),
        avgFaceless: round1(avg(list.map(function(entry) { return entry.facelessScore; }))),
        totalViews: Math.round(list.reduce(function(sum, entry) { return sum + toNumber(entry.views); }, 0)),
        leadTitle: list[0] ? list[0].title : 'unknown',
        dominantPatterns: topPatternLabels(list, 2),
        topTerms: topTitleTerms(list, 4)
      };
    }).sort(function(a, b) {
      return (b.avgVph - a.avgVph) || (b.avgOs - a.avgOs) || (b.sampleCount - a.sampleCount);
    });
  }

  function buildCompetitiveDifferenceSignals(winners, rest) {
    var lines = [];
    var winnerPatterns = topPatternLabels(winners, 4);
    var restPatterns = topPatternLabels(rest, 4);
    if (winnerPatterns.length) lines.push('Los ganadores repiten ' + winnerPatterns.join(' | ') + '.');
    if (patternRate(winners, 'numbers / list hooks') - patternRate(rest, 'numbers / list hooks') >= 0.18) {
      lines.push('Los outliers usan mas titulos con numeros y listas que el resto del nicho.');
    }
    if (patternRate(winners, 'secret / forbidden hook') - patternRate(rest, 'secret / forbidden hook') >= 0.14) {
      lines.push('Los videos fuertes meten mas curiosidad prohibida, secreto o misterio en el hook.');
    }
    if (patternRate(winners, 'explainer / documentary') - patternRate(rest, 'explainer / documentary') >= 0.14) {
      lines.push('La competencia que gana empaqueta mejor como documental / explicado y no solo como titulo descriptivo.');
    }
    var titleGap = avgTitleLength(winners) - avgTitleLength(rest);
    if (titleGap >= 8) lines.push('Los ganadores tienden a titulos mas largos y descriptivos, con promesa mas clara.');
    else if (titleGap <= -8) lines.push('Los ganadores tienden a titulos mas cortos y filosos, sin tanto relleno.');

    var facelessGap = avg((winners || []).map(function(entry) { return entry.facelessScore; })) - avg((rest || []).map(function(entry) { return entry.facelessScore; }));
    if (facelessGap >= 8) lines.push('Los mejores canales se ven mas faceless y sistematizados; menos personalidad, mas formato replicable.');

    var winnerTerms = topTitleTerms(winners, 6);
    var restTerms = topTitleTerms(rest, 6);
    var exclusiveWinnerTerms = winnerTerms.filter(function(token) { return restTerms.indexOf(token) === -1; }).slice(0, 4);
    if (exclusiveWinnerTerms.length) lines.push('Palabras que aparecen mas en winners: ' + exclusiveWinnerTerms.join(', ') + '.');

    if (!lines.length && restPatterns.length) lines.push('El nicho se mueve entre ' + restPatterns.join(' | ') + ', pero aun falta una propuesta mas pulida para romper.');
    return unique(lines).slice(0, 6);
  }

  function buildCompetitiveGapMoves(opportunity, competitors, winners, rest) {
    var lines = [];
    var winnerTerms = topTitleTerms(winners, 6);
    var competitorLead = competitors[0] || null;
    if (winnerTerms.length) {
      lines.push('Entrar usando el sistema ganador de hooks: ' + winnerTerms.slice(0, 4).join(', ') + ', pero con una promesa mas premium y limpia.');
    }
    if (opportunity && opportunity.competitionScore <= 4.2) {
      lines.push('La competencia aun no esta blindada; hay espacio para clonar formato y mejorar empaque desde el primer lote.');
    }
    if (opportunity && opportunity.languageGapScore >= 7) {
      lines.push('El idioma sigue subatendido: puedes entrar rapido antes de que la densidad de canales se cierre.');
    }
    if (competitorLead && competitorLead.sampleCount >= 3) {
      lines.push('No copies al lider 1:1: toma su patron principal y muerdelo por subnicho, ritmo o promesa para no quedar como clon barato.');
    }
    if (avg((winners || []).map(function(entry) { return entry.vph; })) > avg((rest || []).map(function(entry) { return entry.vph; })) * 1.45) {
      lines.push('Los winners estan muy por encima del baseline: conviene entrar con un piloto de 5 a 8 videos antes de escalar fuerte.');
    }
    return unique(lines).slice(0, 5);
  }

  function buildCompetitiveSnapshot(languageCode, nicheId, entries, historyEntries) {
    var hydrated = hydrateEntries(entries);
    var opportunity = computeOpportunityFromBucket(languageCode, nicheId, hydrated, historyEntries || []);
    var bucket = hydrated.filter(function(entry) {
      return entry.language === languageCode && entry.nicheId === nicheId;
    }).sort(function(a, b) {
      return (b.vph - a.vph) || (b.os - a.os) || (b.revMonth - a.revMonth);
    });
    var competitors = buildCompetitorGroups(bucket);
    var winnerCount = Math.max(3, Math.min(8, Math.ceil(bucket.length * 0.35)));
    var winners = bucket.slice(0, winnerCount);
    var rest = bucket.slice(winnerCount);
    var titleExamples = winners.slice(0, 5).map(function(entry) { return entry.title; });
    var winnerPatterns = topPatternLabels(winners, 4);
    var baselinePatterns = topPatternLabels(bucket, 5);
    var winnerTerms = topTitleTerms(winners, 8);
    var restTerms = topTitleTerms(rest, 8);
    var competitionShare = competitors.length ? round1((competitors[0].sampleCount / Math.max(bucket.length, 1)) * 10) : 0;
    var historyMatches = (historyEntries || []).filter(function(entry) {
      return entry && entry.languageCode === languageCode && entry.nicheId === nicheId;
    });
    var trendDelta = historyMatches.length >= 2
      ? round1(toNumber(historyMatches[historyMatches.length - 1].opportunityScore) - toNumber(historyMatches[0].opportunityScore))
      : 0;

    return {
      languageCode: opportunity.languageCode,
      languageLabel: opportunity.languageLabel,
      nicheId: opportunity.nicheId,
      nicheLabel: opportunity.recommendedNiche,
      searchQuery: buildQueryForNiche(languageCode, nicheId),
      opportunityScore: opportunity.opportunityScore,
      estimatedRpm: opportunity.estimatedRpm,
      competitionLabel: opportunity.competitionLabel,
      competitionScore: opportunity.competitionScore,
      saturationLabel: opportunity.saturationLabel,
      saturationScore: opportunity.saturationScore,
      demandLabel: opportunity.demandLabel,
      demandScore: opportunity.demandScore,
      velocity: opportunity.velocity,
      sampleCount: bucket.length,
      competitorCount: competitors.length,
      recentCount: opportunity.recentCount,
      avgOs: round1(avg(bucket.map(function(entry) { return entry.os; }))),
      avgFaceless: round1(avg(bucket.map(function(entry) { return entry.facelessScore; }))),
      winnerPatterns: winnerPatterns,
      baselinePatterns: baselinePatterns,
      winnerTerms: winnerTerms,
      loserTerms: restTerms.slice(0, 6),
      topCompetitors: competitors.slice(0, 6),
      titleExamples: titleExamples,
      differenceSignals: buildCompetitiveDifferenceSignals(winners, rest),
      gapMoves: buildCompetitiveGapMoves(opportunity, competitors, winners, rest),
      whatWorks: unique([
        winnerPatterns.length ? 'Patrones que mas convierten: ' + winnerPatterns.join(' | ') + '.' : '',
        winnerTerms.length ? 'Hooks / palabras ganadoras: ' + winnerTerms.slice(0, 6).join(', ') + '.' : '',
        competitors[0] ? 'Competidor visible mas fuerte: ' + competitors[0].channelLabel + ' con ' + compactNumber(competitors[0].avgVph) + '/h promedio.' : '',
        opportunity.why || ''
      ].filter(Boolean)).slice(0, 5),
      weakSignals: unique([
        rest.length ? 'Los rezagados repiten mas ' + (topPatternLabels(rest, 3).join(' | ') || 'titulos flojos') + ' sin una promesa potente.' : '',
        restTerms.length ? 'Palabras mas presentes en la cola: ' + restTerms.slice(0, 5).join(', ') + '.' : ''
      ].filter(Boolean)).slice(0, 4),
      competitionShare: competitionShare,
      trendDelta: trendDelta,
      verdict: opportunity.verdict,
      regions: opportunity.regions,
      historyMatches: historyMatches.slice(-6)
    };
  }

  function normalizeFilters(filters) {
    var filterSet = {};
    (filters || []).forEach(function(filterId) { filterSet[String(filterId)] = true; });
    return Object.keys(filterSet);
  }

  var filtersEngine = {
    defs: GOD_FILTERS.slice(),
    normalize: normalizeFilters,
    apply: function(opportunities, filters) {
      var active = normalizeFilters(filters);
      if (!active.length) return (opportunities || []).slice();
      return (opportunities || []).filter(function(item) {
        return active.every(function(filterId) {
          if (filterId === 'high_rpm') return item.estimatedRpm >= 8;
          if (filterId === 'low_comp') return item.competitionScore <= 4.2;
          if (filterId === 'low_sat') return item.saturationScore <= 4.3;
          if (filterId === 'fully_faceless') return item.facelessScore >= 8;
          if (filterId === 'easy_scale') return item.repeatabilityScore >= 7.8;
          if (filterId === 'storytelling') return item.tags.indexOf('storytelling') !== -1;
          if (filterId === 'sleep') return item.tags.indexOf('sleep') !== -1;
          if (filterId === 'history') return item.tags.indexOf('history') !== -1;
          if (filterId === 'psychology') return item.tags.indexOf('psychology') !== -1;
          if (filterId === 'mystery') return item.tags.indexOf('mystery') !== -1;
          if (filterId === 'science') return item.tags.indexOf('science') !== -1;
          if (filterId === 'survival') return item.tags.indexOf('survival') !== -1;
          if (filterId === 'religion') return item.tags.indexOf('religion') !== -1;
          if (filterId === 'trending') return !!item.isTrending;
          if (filterId === 'underserved') return !!item.isUnderserved;
          if (filterId === 'outlier') return !!item.isOutlierHeavy;
          if (filterId === 'saved_only') return item.savedCount > 0;
          if (filterId === 'new_only') return !!item.isNew;
          if (filterId === 'best_week') return item.weekCount > 0 && item.opportunityScore >= 7.4;
          if (filterId === 'best_month') return item.recentCount > 0 && item.opportunityScore >= 7.0;
          return true;
        });
      });
    }
  };

  function normalizeAlert(alert) {
    alert = alert || {};
    return {
      id: String(alert.id || slugify((alert.languageCode || '') + '-' + (alert.nicheId || '') + '-' + (alert.title || alert.recommendedNiche || '')) || ('alert-' + Date.now())),
      type: String(alert.type || 'opportunity'),
      languageCode: String(alert.languageCode || 'auto'),
      languageLabel: resolveLanguage(alert.languageCode || 'auto').label,
      nicheId: String(alert.nicheId || inferNicheIdFromText(alert.recommendedNiche || alert.title || '')),
      title: String(alert.title || alert.recommendedNiche || 'New Niche Detected'),
      message: String(alert.message || ''),
      opportunityScore: round1(alert.opportunityScore),
      rpm: round1(alert.rpm),
      competition: String(alert.competition || bandLabel(10 - toNumber(alert.competitionScore))),
      saturation: String(alert.saturation || bandLabel(toNumber(alert.saturationScore))),
      source: String(alert.source || 'live'),
      createdAt: toNumber(alert.createdAt) || Date.now(),
      meta: alert.meta || {}
    };
  }

  function alertSignature(alert) {
    var normalized = normalizeAlert(alert);
    return [normalized.type, normalized.languageCode, normalized.nicheId, slugify(normalized.title).slice(0, 42)].join('|');
  }

  function normalizeGlobalState(raw) {
    raw = raw || {};
    return {
      version: raw.version || ENGINE_VERSION,
      selectedLanguage: LANGUAGE_INDEX[raw.selectedLanguage] ? raw.selectedLanguage : 'auto',
      recentLanguages: unique((raw.recentLanguages || []).filter(function(code) { return LANGUAGE_INDEX[code]; })).slice(0, 6),
      pinnedLanguages: unique((raw.pinnedLanguages || ['en', 'es', 'fr']).filter(function(code) { return LANGUAGE_INDEX[code]; })).slice(0, 8),
      autoMix: raw.autoMix !== false,
      filters: normalizeFilters(raw.filters || []),
      watchlist: unique(raw.watchlist || []).slice(0, 100)
    };
  }

  function mergeGlobalState(base, patch) {
    return normalizeGlobalState(Object.assign({}, normalizeGlobalState(base), patch || {}));
  }

  function buildAlertCandidateFromOpportunity(opportunity, source) {
    if (!opportunity) return null;
    var localTitle = buildQueryForNiche(opportunity.languageCode, opportunity.nicheId) || opportunity.recommendedNiche;
    return normalizeAlert({
      type: opportunity.opportunityScore >= 8.6 ? 'success' : opportunity.opportunityScore >= 7.6 ? 'opportunity' : 'watchlist',
      languageCode: opportunity.languageCode,
      nicheId: opportunity.nicheId,
      title: localTitle + ' - ' + opportunity.languageLabel,
      message: 'RPM ' + compactMoney(opportunity.estimatedRpm) + ' | Competition ' + opportunity.competitionLabel + ' | Score ' + opportunity.opportunityScore,
      opportunityScore: opportunity.opportunityScore,
      rpm: opportunity.estimatedRpm,
      competition: opportunity.competitionLabel,
      saturation: opportunity.saturationLabel,
      source: source || 'live',
      meta: {
        verdict: opportunity.verdict,
        regions: opportunity.regions || []
      }
    });
  }

  var dashboardRenderer = {
    compactNumber: compactNumber,
    compactMoney: compactMoney,
    scoreTone: function(score) {
      if (score >= 8.6) return 'enter';
      if (score >= 7.2) return 'test';
      if (score >= 5.8) return 'watch';
      return 'ignore';
    },
    badgeTone: function(badge) {
      if (/HIGH RPM|OUTLIER|TRENDING/.test(badge)) return 'bright';
      if (/LOW COMP|UNDERSERVED/.test(badge)) return 'soft';
      return 'ghost';
    }
  };

  var api = {
    version: ENGINE_VERSION,
    storageKeys: STORAGE_KEYS,
    weights: SCORE_WEIGHTS,
    languageEngine: {
      list: listLanguages,
      get: resolveLanguage,
      detectLanguage: detectLanguage,
      search: searchLanguages,
      buildQueryPool: buildQueryPool,
      buildQueryForNiche: buildQueryForNiche
    },
    nicheScoring: {
      listNiches: function() { return clone(NICHE_LIBRARY); },
      getNiche: function(id) { return NICHE_INDEX[id] ? clone(NICHE_INDEX[id]) : null; },
      hydrateEntries: hydrateEntries,
      inferEntryLanguage: inferEntryLanguage,
      inferNicheIdFromText: inferNicheIdFromText,
      buildLanguageMatrix: buildLanguageMatrix,
      compareNicheAcrossLanguages: compareNicheAcrossLanguages,
      buildTopUnderserved: buildTopUnderserved,
      buildVelocityMonitor: buildVelocityMonitor,
      buildSavedByLanguage: buildSavedByLanguage,
      buildCompetitiveSnapshot: buildCompetitiveSnapshot,
      computeOpportunityFromBucket: computeOpportunityFromBucket,
      buildAlertCandidateFromOpportunity: buildAlertCandidateFromOpportunity
    },
    filtersEngine: filtersEngine,
    countryDemandEngine: {
      analyze: buildRegions
    },
    alertEngine: {
      normalizeAlert: normalizeAlert,
      signature: alertSignature
    },
    dashboardRenderer: dashboardRenderer,
    normalizeGlobalState: normalizeGlobalState,
    mergeGlobalState: mergeGlobalState
  };

  global.ASHLYVEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
