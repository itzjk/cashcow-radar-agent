(typeof self !== 'undefined' ? self : this).NSP_YT_PLAYBOOK = {
  version: '1.3.0',
  updated: '2026-06-24',
  origen: 'deep research (111 agents, primary YouTube sources plus the leaked MrBeast document)',

  algoritmo: {
    confianza: 'high',
    principios: [
      'YouTube optimizes for viewer SATISFACTION, not raw watch time and not CTR on its own.',
      'Satisfaction is measured with in-product 1-5 star surveys (only 4 and 5 count as valued watchtime), likes and dislikes, clicks on "not interested", and whether the viewer comes back to YouTube afterwards.',
      'It is a pull system, not a push system: for EACH viewer it pulls what THAT viewer already enjoyed (their history, which videos get watched together, how much of a channel or topic they consume).',
      'The rule for a creator: ask "does MY audience like this?", not "does the algorithm like this?".',
      'Retention feeds ranking directly: average view duration and average percentage viewed are confirmed signals.',
      'How much each metric weighs depends on context: watch time counts for more on TV than on mobile, and more on podcasts than on music.',
      'Honest caveat: the pull model describes recommendations (home and suggested). Videos are still tested on small audiences and expanded on the signals they get. It is not absolute quality magic.'
    ],
    fuentes: [
      'https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/',
      'https://support.google.com/youtube/answer/11914225?hl=en',
      'https://www.youtube.com/watch?v=dhYIb72L1hU'
    ]
  },

  retencionYHooks: {
    confianza: 'medium',
    nota: 'Tactics documented by ONE top creator (leaked MrBeast document, September 2024, authenticity alleged). Not a platform rule, but the know-how is consistent across independent copies.',
    principios: [
      'Front-load minute one: as many visuals, music cues, effects and scene changes as you can from the opening second.',
      'Pay off the promise in the title and thumbnail IMMEDIATELY, and give away as much of the video as you can early on.',
      'Re-hook roughly every 3 minutes with something worth watching.',
      'Around the halfway mark (about minute 6), land a bigger re-hook, one that needs some explaining and pushes the story of the second half.',
      'General principle: never let the pace drop. Every stretch has to give a reason to keep watching.'
    ],
    fuentes: ['https://protunesone.com/blog/leaked-mrbeast-document-on-his-youtube-strategies/']
  },

  ctrTitulosYMiniaturas: {
    confianza: 'medium',
    principios: [
      'The title opens a curiosity gap and the thumbnail keeps that promise. Title and thumbnail promise, the video DELIVERS. If it does not, satisfaction drops and so do you.',
      'FACES ARE NOT a universal CTR boost (1of10 study, more than 300,000 viral videos in 2025): with or without a face, performance is broadly similar.',
      'Faces help only MODESTLY and mostly on large channels, and it depends on the niche (finance does better with faces, gaming and business barely move).',
      'Favour high contrast, one clear emotion, and FEW elements readable at a glance on a small screen.'
    ],
    fuentes: ['https://www.searchenginejournal.com/do-faces-help-youtube-thumbnails-heres-what-the-data-says/563944/'],
    pendiente: 'CTR benchmarks by niche and channel size, and title patterns (curiosity gap, numbers, negativity) with fresh QUANTITATIVE evidence. Not verified yet.'
  },

  antiDesmonetizacion: {
    confianza: 'high',
    critico: true,
    nota: 'YouTube policy of 15 July 2025: "repetitious content" was renamed "inauthentic content". This is the most important part for faceless channels. The penalty hits the WHOLE channel.',
    principios: [
      'YouTube does NOT penalize using AI. It penalizes templated, near identical output at scale, and reused material with nothing added.',
      'Examples that DO break the rule (YouTube verbatim): channels uploading narrative stories that differ only superficially from each other, and channels uploading slideshows that share the same narration.',
      'To monetize your own AI assisted content you must: (a) follow the policies, (b) add the creator original, authentic perspective or insight, (c) disclose when realistic content was altered or synthetic.',
      'Borrowed or reused footage (stock, clips, gameplay) has to be changed SIGNIFICANTLY: substantial original commentary, substantive edits, or real educational or entertainment value.',
      'Content has to be made for the viewer to enjoy or learn from, NOT for the sole purpose of collecting views.',
      'NEVER present fiction or AI output as real fact. The one removal on record (True Crime Case Files, 83K subs) was for presenting AI stories as fact, which is misinformation.',
      'ZERACK working rule: every video has to genuinely differ, carry its own angle, and add value. That is what separates automation that monetizes from AI slop that gets the channel taken down.'
    ],
    fuentes: [
      'https://support.google.com/youtube/answer/1311392?hl=en',
      'https://www.socialmediatoday.com/news/youtube-clarifies-monetization-update-inauthentic-repeated-content/752892/'
    ]
  },

  monetizacionYPP: {
    confianza: 'high',
    principios: [
      'Long form route: 1,000 subscribers plus 4,000 valid public watch hours in the last 12 months.',
      'Shorts route: 1,000 subscribers plus 10,000,000 valid public Shorts views in the last 90 days.',
      'On top of that: follow the monetization policies, live in a country where YPP is available, no active community guidelines strikes, two step verification on, advanced features enabled, and an AdSense account linked.',
      'There is a smaller early access tier (500 subs, 3,000 hours, 3M Shorts views) but it only unlocks fan funding, NOT full ad monetization.'
    ],
    fuentes: ['https://support.google.com/youtube/answer/72851?hl=en']
  },

  nichosYRpm: {
    confianza: 'medium',
    nota: 'There is no OFFICIAL RPM table by niche, but RPM CAN be estimated and a useful number should always be given: RPM = (niche base) x (audience geography factor). Mark it as an estimate, never refuse to estimate.',
    metodo: [
      '1) Detect the NICHE from the words in the title, channel and description.',
      '2) Take the BASE RPM for that niche (table rpmBasePorNicho_tier1, valid for a tier-1 audience, US English).',
      '3) Detect the LANGUAGE and the country of the channel, then infer the likely audience GEOGRAPHY.',
      '4) Multiply the base RPM by the geography factor.',
      '5) Give a concrete estimated RANGE (for example "$3-6 RPM estimated"). NEVER say the RPM cannot be known.'
    ],
    rpmBasePorNicho_tier1_USD: {
      'finanzas/inversion/cripto/dinero': '12-40',
      'negocios/make-money/emprender': '10-25',
      'legal/seguros/abogados': '12-35',
      'lujo/real-estate/inmuebles': '10-25',
      'tech/IA/software/gadgets': '8-18',
      'salud/fitness/nutricion': '6-15',
      'educacion/idiomas/podcasts-ingles': '8-15',
      'true-crime/historia/misterio/dark': '4-10',
      'sleep/ASMR/relax/ambient': '6-12',
      'recaps/manhwa/anime/peliculas': '5-12',
      'curiosidades/datos/listas/top': '3-7',
      'gaming/entretenimiento': '2-8',
      'musica/generico': '1-4'
    },
    multiplicadorGeografico: {
      'tier1 (USA, UK, Canada, Australia, Alemania, nordicos)': 1.0,
      'tier 2 (Spain, southern and eastern Europe, Japan, Korea)': 0.5,
      'tier3 (LATAM, India, Pakistan, Sudeste Asiatico, Africa, Brasil)': 0.18
    },
    idiomaAGeografia: [
      'English: defaults to a US and tier-1 mix (high), but a lot of English is tier-3 (India). If the channel is clearly US or UK use tier-1; if it is generic use a blend of about 0.6.',
      'German, French (France), Dutch, Nordic and Japanese: tier-1 or tier-2, roughly 0.7 to 1.0.',
      'Spanish: MIXED. Spain is tier-2 but most of the Spanish speaking audience is Latin America (tier-3). Use a low to mid factor, about 0.15 to 0.35. This matters for Spanish language channels.',
      'Portuguese (Brazil): tier-3, about 0.15. Hindi, Urdu, Arabic and Indonesian: tier-3, about 0.08 to 0.15.'
    ],
    ejemplo: 'Finance in US English: 12-40 x 1.0 = $12-40 estimated RPM. The SAME niche in Spanish for Latin America: 12-40 x about 0.2 = $2.40-8 RPM. Language plus geography moves RPM by up to 10x.',
    fuentes: ['market estimates (vendors, not audited) plus the Fortune case (Adavia Davis) plus first-party CPM from isthischannelmonetized (tier-1 vs tier-3 = 12 to 28x on CPM)']
  },

  produccionYEscala: {
    confianza: 'medium',
    nota: 'Tactics from real operators plus market data. Not official YouTube guidance, but the sources converge. This is the most actionable part for long form that both retains and monetizes.',
    retencionLongForm: [
      '2025 data: average retention about 23.7%; about 55% leave in the first 60 seconds; a strong hook in the first 15 seconds keeps about 65% through minute 3.',
      'Map a five act structure to timestamps BEFORE writing: hook or cold open, then setup, rising conflict, crisis, resolution. That is what kills mid video filler, the number one cause of the mid video drop.',
      'Hook (first 15 to 30 seconds): open with a provocative question, or reveal an unexpected result, or tease a twist. Confirm the viewer is in the right place, open a loop, promise a payoff.',
      'Open loops: plant a question early and hold the answer back. Pattern interrupt every 90 to 120 seconds (a cut, a graphic, an SFX, a change of pace).'
    ],
    midRolls: [
      'Only on videos of 8 minutes or more. Optimal count: 8-10min = 1, 10-14min = 2, 14-18min = 2-3, 18-25min = 3-4. More than 4 hurts satisfaction. Sweet spot is about one every 8 to 10 minutes.',
      'AVOID: a mid-roll right before the climax or a key piece of information (people leave and do NOT come back), inside the first 2 minutes, or more than one every 4 minutes.',
      'PLACE THEM: after an idea closes, at a moment of completeness, or between sections before the next topic. Trick: say what is coming next just before the first mid-roll.',
      'Impact: 10 minutes with 3 mid-rolls can earn 2 to 4x what 7 minutes with only a pre-roll earns, and completion barely moves (90% vs 92%) when they are placed well.'
    ],
    escalaYEquipo: [
      'A portfolio of channels is digital real estate. One operator runs 3 to 5 channels, because they do not film, edit or narrate, so that is not the bottleneck.',
      'Hiring order: 1) editor $25-50/h, 2) writer $30-60/h, 3) channel manager $20-40/h (uploads and optimization) covers 70% of the work. Add a research assistant at $5-15/h. A script runs $30-80, an edit $50-300 per video.',
      'Four minimum SOPs, written from your first 10 manual videos: video production brief, editor style guide, thumbnail brief, upload checklist. Keep them in Notion, followable without asking questions.'
    ],
    porQueFracasan: [
      'The set and forget myth: if nobody steers the ship, it drifts. Automation is NOT passive.',
      'TOTAL outsourcing: one channel with 60M views over 3 years outsourced everything and made only about $6,000. Do the creative work YOURSELF (idea, script, packaging) and outsource only what eats time (editing).',
      'Speed over quality gives generic, robotic output (static images, repeated stock, a flat voice), which means disengagement and a demonetization risk.',
      'Automating BEFORE validating (a weak title, thumbnail or format just means more weak videos), and burning out at month 4 to 6, right before the algorithm compounds (around month 8, at about 30 videos).'
    ],
    queHacenLosQueGanan: [
      'Strategic control: they automate selectively, not everything. The creative core stays in house.',
      'Every upload is a controlled experiment: change one variable, measure, keep what works.',
      'Long game: a 12 month business, not a 12 day side hustle. Research BEFORE producing (outliers, decode the title and thumbnail, find the gaps, write a strong script, then produce).',
      'Several income streams: not only AdSense, but affiliates, sponsors and your own products.'
    ],
    fuentes: ['2025 retention data plus operator and agency guides plus post-mortems (medium, lilys.ai) plus mid-roll guides (vidiq, fluxnote)']
  },

  nichosDetallados: {
    confianza: 'medium',
    nota: 'CPM and RPM figures and example channels by niche (converging market estimates, not official). Use them to recommend niches by profitability and to name channels worth imitating.',
    topPorCPM: {
      'Personal finance / inversion': 'CPM about 15-22, RPM about 15-30. Example: Alux. The most profitable of the lot.',
      'Make money online / IA tools': 'CPM about 15-20, RPM about 10-25. The 2026 twist: earning by using AI.',
      'Legal / court drama': 'CPM about 12-18.',
      'Digital marketing': 'CPM about 12-18.',
      'Real estate / lujo': 'CPM about 10-16.',
      'Tech reviews/tutorials': 'Mid CPM but HIGH affiliate income.',
      'Geography / educational': 'Example: RealLifeLore (distinctive thumbnails plus topics that hook).',
      'True crime / mystery': 'Example: Stories to Remember (143k subs, 35M views).',
      'Health / wellness': 'Angle: what the real research says. Supplement affiliates pay 2 to 3x the ad revenue.',
      'History': 'A safe evergreen niche, it rewards watch time. Pick a specific ANGLE (WWII naval, second century Rome, Cold War espionage), not "general history".'
    },
    reglas: [
      'Affiliates often BEAT AdSense on faceless channels: one high intent click pays $50-500. Do not live on ads alone.',
      'Pick a specific SUB-NICHE, not the broad category ("WWII naval" beats "history").',
      'Shorts plus long form grows a channel about 3x faster than either alone (YouTube data, 2026): Shorts to get discovered, long form to monetize.'
    ]
  },

  stackHerramientas: {
    confianza: 'medium',
    nota: 'The real 2026 operator toolset with prices. A basic stack totals about $25-70 a month.',
    guionYResearch: 'ChatGPT-4o or Claude for scripts; OverseerOS, 1of10 or OutlierKit for outlier research.',
    voz: 'ElevenLabs is the standard (the most natural voices, multilingual). Starter at $5 a month gives about 30k characters, roughly 25 minutes or 4 to 5 videos a month, and 3 custom voices. On a faceless channel the VOICE is everything, it is the only human thing the viewer hears.',
    visuales: 'Sora was DISCONTINUED on 26 April 2026. Run two models: Kling 3.0 for motion and B-roll (clips up to 3 minutes, about $6.99 a month) plus Nano Banana 2 (the top Google image model) for illustrations, infographics and art.',
    edicion: 'Descript ($24 a month, edit by TEXT and transcript with automatic captions) for tutorials and explainers; CapCut Pro ($9.99 a month) for cinematic, vertical and effects heavy work.',
    miniaturas: 'Nano Banana 2 for thumbnails with characters, products or scenes. Generate 5 variants, A/B test them (TubeBuddy or the native Test and Compare) over the first 48 hours, and keep the winner.',
    workflow: 'BATCH the work: produce 5 to 10 videos in one focused session, not one at a time. Always research first, produce second.'
  },

  metodoOutliers: {
    confianza: 'medium',
    nota: 'How to find ideas that ALREADY work before producing, which is what serious operators do. ZERACK already does this with its outlier scanner.',
    principios: [
      'Track videos doing about 10x the average or median of THEIR OWN CHANNEL. That shows what the algorithm is pushing right now, so copy it. The metric is a MULTIPLIER (views against the channel average), not absolute views.',
      'A strong outlier combines topic demand, clickable packaging, timing, audience fit and a good first 30 seconds.',
      'It is stronger when it shows up on SEVERAL channels in the same niche: that is repeatable demand, not one channel getting lucky.',
      'Outlier momentum lasts 2 to 6 weeks before saturation. You do not have to be first, but you do have to be in the FIRST WAVE, not the third.',
      'This is not the same as chasing trends: you identify what already works at scale, before it saturates.'
    ]
  },

  systemPrimer: [
    'You are the expert brain of ZERACK for making money with faceless and automated YouTube. Your knowledge comes from primary YouTube sources (2025-2026) and has been verified. You speak plainly, give something to act on, and never pad.',
    '',
    'ALGORITHM: YouTube rewards viewer SATISFACTION, not raw watch time and not CTR on its own (it measures 1-5 star surveys, likes, "not interested" clicks, and whether people come back). It is pull, not push: it recommends to each viewer what THAT viewer enjoys. The right question is "does MY audience like this?". Retention (average duration and average percentage viewed) feeds ranking.',
    '',
    'RETENTION: load minute one to the maximum and pay off the title and thumbnail promise straight away. Re-hook about every 3 minutes, and around minute 6 land a twist that pushes the second half. Never let the pace drop.',
    '',
    'CTR: the title is a curiosity gap, the thumbnail keeps that promise, and the video DELIVERS it. Faces are not a magic CTR boost (from more than 300k videos). Favour contrast, one emotion, and few readable elements.',
    '',
    'AVOIDING DEMONETIZATION (the most important part): YouTube does not punish using AI. It punishes templated, near identical output at scale and reused material with nothing added, and the penalty hits the WHOLE channel. Every video needs an original perspective, must genuinely differ from the last one, and must add real value. Never present AI fiction as fact.',
    '',
    'MONETIZATION: 1,000 subs plus 4,000 watch hours over 12 months (long form), OR 1,000 subs plus 10M Shorts views over 90 days, with no strikes, two step verification on and AdSense linked.',
    '',
    'PROFITABLE NICHES (estimated real CPM): the best payers are personal finance (CPM 15-22, example Alux), make money and AI (15-20), legal and court drama (12-18), real estate (10-16). Also strong: tech (high affiliate), geography (example RealLifeLore), true crime (example Stories to Remember, 143k subs and 35M views), health (angle: what the science says, plus supplement affiliates at 2 to 3x the ads), history (pick a SUB-angle such as "WWII naval", not "general history"). Affiliates often BEAT AdSense (one high intent click is $50-500), so do not live on ads alone.',
    '',
    'THE 2026 STACK (about $25-70 a month): scripts from ChatGPT or Claude; voice from ElevenLabs ($5 a month, it is the only human thing in the video, so look after it); visuals from Kling 3.0 (video and B-roll) plus Nano Banana 2 (images and thumbnails; note Sora was discontinued in 2026); editing in Descript or CapCut; produce in BATCHES of 5 to 10 videos per session. FINDING IDEAS (the outlier method): look for videos doing about 10x their own channel average AND showing up on SEVERAL channels in the niche, which means repeatable demand rather than luck. Get in during the first 2 to 6 weeks, the first wave, not the third. Always research before producing.',
    '',
    'LONG FORM PRODUCTION AND SCALE: retention comes from a strong hook in the first 15 seconds (55% leave within 60 seconds otherwise), a five act structure mapped to timestamps (this kills mid video filler), and a pattern interrupt every 90 to 120 seconds. MID-ROLLS (only on 8 minutes or more): 8-10min = 1, 10-14 = 2, 18-25 = 3-4, NEVER more than 4; never place one before the climax or inside the first 2 minutes; put them after an idea closes. 10 minutes with 3 mid-rolls earns 2 to 4x what 7 minutes earns. SCALE: one operator runs 3 to 5 channels; you do the creative work (idea, script, packaging) and outsource only the editing (total outsourcing fails: a channel with 60M views made only $6k that way). The algorithm compounds around month 8, at about 30 videos: this is a 12 month business, not a 12 day one. Diversify income (affiliates, sponsors, products), not just AdSense.',
    '',
    'NICHES AND RPM (ALWAYS GIVE THE NUMBER, never refuse): to estimate a channel RPM, detect the NICHE from its words, take the base RPM for that niche (finance 12-40, business and legal 10-35, tech 8-18, health and education 6-15, true crime and history 4-10, sleep 6-12, recaps 5-12, facts 3-7, gaming 2-8 USD for tier-1), detect the LANGUAGE and country, infer the audience GEOGRAPHY (tier-1 US and UK = x1.0; tier-2 Spain and Europe = x0.5; tier-3 Latin America, India and Brazil = x0.18), multiply, and GIVE A CONCRETE RANGE marked as an estimate. Example: finance in US English = $12-40; the same in Spanish for Latin America = $2-8. Language plus geography moves RPM by up to 10x. NEVER use "there is no official table" as an excuse not to estimate.'
  ].join('\n')
};
