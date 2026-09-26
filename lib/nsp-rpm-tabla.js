(function (raiz) {
  'use strict';

  var SIN_CLASIFICAR = 'Unclassified';

  var NSP_RPM_TABLA = {
    source: 'the calcScore chain of the scanner, unified with the niche table and the language detector of the Studio panel',
    updated: '2026-08-13',
    measured: false,
    note: 'Reference estimate per niche and market. It is not a measurement of the channel on screen: the real RPM only comes from the channel owner\'s YouTube Studio panel.',
    sinClasificar: 3.0,
    shortsRpm: 0.08,
    mercadoNeutro: 0.75,
    duracion: { minutos: 8, multiplicador: 1.2, excluye: /music|sleep|relax|ambient|drum|nordic|celtic|pagan|shamanic|heal|soundscape/ },
    mercados: { en: 1.00, de: 0.95, fr: 0.78, es: 0.48, pt: 0.45, ja: 0.50, ko: 0.50, el: 0.50, hi: 0.18, bn: 0.18, ar: 0.18, th: 0.18 },
    mercadoFuente: {
      en: 'calcScore chain', de: 'calcScore chain', fr: 'calcScore chain', es: 'calcScore chain', pt: 'calcScore chain',
      ja: 'tier 2 of knowledge/youtube-playbook.js', ko: 'tier 2 of knowledge/youtube-playbook.js', el: 'tier 2 of knowledge/youtube-playbook.js',
      hi: 'tier 3 of knowledge/youtube-playbook.js', bn: 'tier 3 of knowledge/youtube-playbook.js', ar: 'tier 3 of knowledge/youtube-playbook.js', th: 'tier 3 of knowledge/youtube-playbook.js',
      sinReferencia: 'zh, ru, he and any other language fall back to mercadoNeutro because there is no citable reference'
    },
    queries: {
      'Finanzas':            { es: 'finanzas personales inversión dinero', en: 'personal finance investing money' },
      'Negocios':            { es: 'negocios emprendimiento ingresos pasivos', en: 'business entrepreneurship passive income' },
      'IA y Tecnologia':     { es: 'inteligencia artificial programación tecnología', en: 'ai tools tech coding tutorial' },
      'Cripto':              { es: 'cripto bitcoin blockchain explicado', en: 'crypto bitcoin blockchain explained' },
      'Legal y Seguros':     { es: 'seguros hipoteca crédito explicado', en: 'insurance mortgage loan explained' },
      'Lujo':                { es: 'lujo mansiones yates millonarios', en: 'luxury mansions yachts billionaire' },
      'Barcos':              { es: 'barcos naufragios buques historia', en: 'ships shipwrecks navy history' },
      'Fotografia':          { es: 'fotografía edición cámara tutorial', en: 'photography editing camera tutorial' },
      'Bienes Raices':       { es: 'bienes raíces inversión inmobiliaria', en: 'real estate investing property' },
      'Hogar y DIY':         { es: 'hogar bricolaje reparaciones casa', en: 'home diy repair projects' },
      'Salud y Fitness':     { es: 'salud fitness ejercicio dieta', en: 'health fitness workout diet' },
      'Supervivencia':       { es: 'supervivencia bushcraft preparación', en: 'survival bushcraft prepper' },
      'Historia':            { es: 'historia documental misterios del pasado', en: 'history documentary ancient mysteries' },
      'Ciencia':             { es: 'ciencia espacio universo documentales', en: 'science space universe documentary' },
      'Naturaleza':          { es: 'naturaleza vida salvaje documental', en: 'nature wildlife documentary' },
      'Psicologia':          { es: 'psicología mentalidad estoicismo', en: 'psychology mindset stoicism' },
      'Religion e Historia': { es: 'religión biblia historia explicada', en: 'religion bible history explained' },
      'Sostenibilidad':      { es: 'jardín huerto cultivo autosuficiencia', en: 'gardening homestead self sufficiency' },
      'Viajes':              { es: 'viajes destinos guía turismo', en: 'travel destinations guide' },
      'Cocina':              { es: 'cocina recetas fáciles comida', en: 'cooking easy recipes food' },
      'Misterio Oscuro':     { es: 'misterios casos reales sin resolver', en: 'true crime unsolved mysteries dark' },
      'Sleep y Relax':       { es: 'historias para dormir cuentos relajación', en: 'sleep stories bedtime fall asleep' },
      'ASMR':                { es: 'asmr susurros triggers relajante', en: 'asmr whisper triggers tingles' },
      'Gaming':              { es: 'gameplay videojuegos guía trucos', en: 'gaming gameplay walkthrough' },
      'Autos':               { es: 'autos coches reseña motor', en: 'car review supercar engine' },
      'Idiomas':             { es: 'aprender idiomas gramática vocabulario', en: 'learn language grammar vocabulary' },
      'Musica':              { es: 'música lofi instrumental playlist', en: 'lofi music instrumental playlist' },
      'Belleza':             { es: 'maquillaje belleza skincare tutorial', en: 'makeup beauty skincare tutorial' },
      'Deportes':            { es: 'deportes fútbol resúmenes análisis', en: 'sports highlights football analysis' },
      'Infantil':            { es: 'canciones infantiles dibujos para niños', en: 'nursery rhymes kids cartoon songs' },
      'Geografia':           { es: 'geografía países mapas geopolítica', en: 'geography countries maps geopolitics' },
      'Anime':               { es: 'anime manga explicado review', en: 'anime manga explained review' },
      'Datos y Curiosidades':{ es: 'datos curiosos top sabías que', en: 'fun facts did you know top 10' },
      'Entretenimiento':     { es: 'recopilación top entretenimiento', en: 'top list compilation entertainment' }
    },
    rows: [
      { rpm: 10, label: 'Sleep y Relax', name: 'Sleep and Relax', re: /\bsleep|relax|meditat|ambient|\brain\b|thunder|binaural|\bheal(ing)?\b|soundscape|dormir|relajar|lluvia|sonidos|ruido.?blanco|schlaf|einschlafen|entspannung|bedtime|insomni|asleep|snooze|fall.?asleep|guided.?sleep|deep.?sleep|white.?noise|brown.?noise|adormecer|tormenta|sommeil|\bsono\b|relaxar|study.?music|music.?for.?stud|concentration.?music|focus.?music|deep.?(?:work|focus).?(?:music|playlist|beats)|m[uú]sica.?para.?(?:estudiar|concentrar)|para.?dormir|睡眠|快眠|安眠|助眠|寝る前|睡前|催眠|白噪音|ホワイトノイズ|雨音|雨聲|雨声|リラックス|瞑想|冥想|作業用|ヒーリング|療癒|治愈|수면|잠들기|백색소음|빗소리|명상|자장가/i, format: true },
      { rpm: 22, label: 'Finanzas', name: 'Finance', re: /finance|invest(?!igat)|trading|stock|\bmarket\b|budget|wealth|dividend|portfolio|finanzas|inversion|invertir|bolsa|acciones|riqueza|ahorro|presupuesto|dinero|rico|millonario|aktien|geld|verm[öo]gen|b[öo]rse|sparen|bourse|\bargent\b|riche|patrimoine|investir|[ée]pargne|\bmoney\b|millionair|forex|stock.?market|hedge.?fund|retire|deuda|impuesto|contabilidad|finanzen|finan[cç]as|dinheiro|finanza|\bsoldi\b|投資|投资|株式|資産|资产|貯金|節約|年金|金融|経済|经济|財富|财富|お金持ち|富裕|理財|理财|存錢|存钱|투자|주식|재테크|저축|연금|금융|경제|자산/i },
      { rpm: 18, label: 'Cripto', name: 'Crypto', re: /crypto|bitcoin|ethereum|\bnft\b|\bdefi\b|blockchain|\bcripto|criptomoneda|krypto|kryptow[äa]hrung|crypto.?monnaie|仮想通貨|暗号資産|ビットコイン|比特幣|比特币|加密貨幣|加密货币|암호화폐|비트코인/i },
      { rpm: 16, label: 'Negocios', name: 'Business', re: /business|entrepreneur|startup|marketing|ecommerce|dropship|passive.?income|negocio|emprend|marketing|ingresos.?pasivos|ganar.?dinero|ventas|vender|monetiz|unternehmen|gesch[äa]ft|verkauf|entreprise|vente|affaires|saas|dropshipping|amazon.?fba|make.?money|emprendedor|freelanc|monetizar|unternehmer|neg[oó]cio|empreendedor|imprenditore|起業|副業|経営|創業|ビジネス|商業|商业|创业|副业|行銷|营销|사업|창업|부업|마케팅/i },
      { rpm: 14, label: 'Legal y Seguros', name: 'Legal and Insurance', re: /legal|\blaw\b|attorney|lawsuit|court|judge|insurance|mortgage|loan|credit.?card|abogado|\bley\b|demanda|juicio|seguro|hipoteca|prestamo|credito|\brecht(?:s|e|lich)?\b|anw[äa]lt|gericht|versicherung|hypothek|kredit|avocat|\bloi\b|proc[èe]s|assurance|hypoth[èe]que|\bcr[ée]dit|保険|保险|保險|弁護士|訴訟|律師|律师|房貸|房贷|보험|변호사|재판|법률|대출/i },
      { rpm: 12, label: 'Bienes Raices', name: 'Real Estate', re: /real.?estate|property|\brent(?:s|al|als)?\b|apartment|bienes.?raices|inmueble|propiedad|alquiler|\brentas?\b|immobilien|wohnung|miete|immobilier|appartement|location|interior.?design|dise[ñn]o.?de.?interiores|不動産|不动产|不動產|賃貸|房地產|房地产|부동산|임대/i },
      { rpm: 13, label: 'IA y Tecnologia', name: 'AI and Tech', re: /artificial.?intelligence|machine.?learning|chatgpt|openai|gemini|midjourney|software|coding|programming|developer|python|tech|inteligencia.?artificial|automatizacion|programaci[oó]n|codigo|tecnolog[ií]a|k[üu]nstliche.?intelligenz|programmier|technologie|intelligence.?artificielle|\bia\b|programmation|technologie|\breact\b|\bnvidia\b|linux|\bgpu\b|ciberseguridad|cybersecurity|web.?dev|javascript|typescript|(?<!')\bai\b|\bllm\b|automation|automatiz|\bn8n\b|copilot|perplexity|deepseek|no.?code|\bprompts?\b|stable.?diffusion|faceless.?ai|人工知能|人工智能|人工智慧|半導体|半導體|半导体|プログラミング|科技|軟體|软件|소프트웨어|인공지능|반도체|프로그래밍/i, alemanSolo: /\bki\b/i },
      { rpm: 11, label: 'Lujo', name: 'Luxury', re: /luxury|billionaire|mansion|yacht|supercar|\blujo\b|millonario|mansi[oó]n|luxus|million[äa]r|reichtum|luxe|milliardaire|richesse|富豪|豪邸|億万長者|奢侈|豪宅|富翁|억만장자|명품|호화/i },
      { rpm: 8, label: 'Hogar y DIY', name: 'Home and DIY', re: /\bdiy\b|backyard|\bshed\b|home.?(improvement|repair|hack|tip)|how.?to.?(fix|clean|repair|unclog)|life.?hack|\bappliance|plumbing|\bmold\b|\bmould\b|clogged|\brust\b|\bleak\b|secret.?mode|hidden.?(feature|setting)|casero|caseros|del.?hogar|repar(ar|aci[oó]n|a.?tu)|arregl(ar|a.?tu)|\bmoho\b|\bgotera\b|\bfuga\b|desatasc|[oó]xido|electrodom|lavadora|nevera|refrigerador|televisor|control.?remoto|modo.?secreto|funci[oó]n.?oculta|el.?fabricante|truco.?(de|del|para|casero)|haushalt|reparieren|schimmel|fernseher|ger[äa]t|geheim(er)?.?modus|waschmaschine|k[üu]hlschrank|r[ée]parer|moisissure|astuce|t[ée]l[ée]viseur|mode.?secret|\bhouse\b|\bhome\b|\bvent\b|\bcasa\b|\bshade\b|\battic\b|\bduct\b|hvac|plumbing|electrical|cooling|\bheating\b|insulation|garage|furnace|air.?conditioner|air.?conditioning|\bwindow\b|kitchen|bathroom|hogar|reparacion|mejoras.?del.?hogar|bricolaje|修理|家電|修繕|維修|维修|家电|リフォーム|裝修|装修|수리|가전/i },
      { rpm: 7, label: 'Salud y Fitness', name: 'Health and Fitness', re: /health|fitness|workout|diet|nutrition|medical|salud|ejercicio|dieta|nutricion|m[eé]dic|bienestar|gesundheit|ern[äa]hrung|abnehmen|\bsant[ée](?![a-zà-öø-ÿ])|r[ée]gime|nutrition|sa[uú]de|ern[äa]hrung|weight.?loss|yoga|meditation|mental.?health|bajar.?de.?peso|meditacion|suplemento|vitamina|\bgym\b|entrena|alimentacion|medicina|treino|salute|allenamento|健康|筋トレ|ダイエット|栄養|医学|減肥|減重|營養|营养|醫學|건강|다이어트|운동|영양|의학/i },
      { rpm: 5, label: 'Religion e Historia', name: 'Religion and History', re: /religion|religión|jes[uú]s|cristo|\bdios\b|b[ií]blia|b[ií]blic|angel|[aá]ngel|infierno|\bcielo|concilio|papas?|emperador|teolog|religi|\bbible\b|bibel|b[ií]blic|mytholog|mitolog|mythos|mythes|folklore|folclore|g[öo]tter|\bgott\b|聖書|聖經|圣经|神話|神话|宗教|仏教|佛教|キリスト|성경|신화|종교|하나님|기독교/i },
      { rpm: 6, label: 'Historia', name: 'History', re: /history|ancient|\bwar(?:s|fare)?\b|empire|civil|medieval|nomad|pharaoh|\broman(?:o|os|a|as|e|es|i)?\b|viking|historia|antigu|imperio|guerra|civiliz|faraon|romano|vikingo|(?<!carros?)(?<!carros? )(?<!\bas )(?<!melhores )(?<!recorda[çc][õo]es )antig[oa]s?|antiqu(?:e|es|ity)|conquista|edad.?media|geschichte|krieg|\breich(?:es|s)?\b|kaiser|antike|mittelalter|histoire|guerre|empire|antiquit[ée]|m[ée]di[ée]val|hist[oó]ria|imp[eé]rio|unsolved|dynasty|arqueolog|historical|civilization|civilizacion|antigua|griego|greek|inquisicion|momia|r[oö]mer|pharao|m[eé]di[eé]val|歴史|歷史|历史|戦争|戰爭|战争|帝国|帝國|古代|王朝|文明|中世|遺跡|遗迹|考古|역사|전쟁|제국|고대|왕조|문명/i },
      { rpm: 6, label: 'Ciencia', name: 'Science', re: /science|physics|biology|chemistry|astronomy|space|universe|quantum|ciencia|fisica|biologia|quimica|astronomia|espacio|universo|espa[çc]o|spatial|d[ée]couvert|太空|planeta|cosmos|wissenschaft|physik|weltraum|universum|sterne|planet|science|physique|espace|astronomie|\bnasa\b|engineering|descubrimiento|experimento|ci[êe]ncia|cosmolog|teoria|laboratorio|scienza|宇宙|物理|化學|化学|生物学|生物學|天文|科学|科學|量子|ブラックホール|黑洞|進化|进化|銀河|银河|恐竜|恐龍|恐龙|우주|물리|화학|천문|과학|양자|블랙홀|공룡/i },
      { rpm: 5, label: 'Supervivencia', name: 'Survival', re: /survival|prepper|wilderness|outlaw|shtf|superviv|refugio|trampa|prepar|[üu]berleben|wildnis|survie|survivre|nature.?sauvage|emergency|off.?grid|bug.?out|camping|self.?reliance|preparedness|supervivencia|preparacion|emergencia|campamento|サバイバル|防災|避難|求生|재난/i },
      { rpm: 5, label: 'Naturaleza', name: 'Nature', re: /nature|wildlife|ocean|forest|naturaleza|animales|oceano|bosque|natur|\btiere\b|\btier(?!ra)|ozean|wald|\bmeer|nature|animaux|oc[ée]an|for[êe]t|conejo|kaninchen|lapin|\bhunde?\b|\bgatos?\b|katze|\bchats?\b|chien|perro|(?<![a-zà-öø-ÿ])r[ií]os?(?![a-zà-öø-ÿ])|floresta|\banimals?\b|\bmountains?\b|paisaje|ecosystem|monta[ñn]a|fauna|flora|vida.?salvaje|selva|desierto|cascada|tierwelt|faune|natureza|natura|foresta|自然|動物|动物|深海|海洋|森林|野生|生態|生态|자연|동물|심해|해양|생물/i },
      { rpm: 5, label: 'Psicologia', name: 'Psychology', re: /psychology|philosophy|sto[iï]c|motivation|success|psicolog[ií]a|filosofia|estoic|motivacion|exito|mentalidad|psychologie|philosophie|\berfolg(?:e|es)?\b|stoizismus|psychologie|philosophie|succ[èe]s|stoicisme|stoicism|mindset|productivity|estoicismo|productividad|habito|autoayuda|self.?help|desarrollo.?personal|denkweise|mentalidade|mentalit[aà]|心理学|心理學|哲学|哲學|心理|認知バイアス|認知偏差|斯多葛|스토아|심리학|철학|인지/i },
      { rpm: 4.5, label: 'Misterio Oscuro', name: 'Dark Mystery', re: /true.?crime|paranormal|horror|creepy|conspiracy|crimen|narco|terror|paranormal|conspiracion|misterio|verbrechen|mord|geheimnis|unheimlich|\bcrimes?\b|meurtre|myst[èe]re|effrayant|\baliens?\b|\bdark(?:est|er)?\b|\bmyster(?:y|ies)\b|\bovnis?\b|gruselig|crimine|unexplained|supernatural|scary|crimen.?real|sobrenatural|perturbador|espeluznante|ocultismo|leyenda.?urbana|extraterrestre|ungel[oö]st|mist[eé]rio|mistero|enigma|\bbruj|未解決|未解之謎|未解之谜|怖い話|都市伝説|怪談|恐怖|靈異|灵异|陰謀|阴谋|失踪|失蹤|奇談|詐欺|诈骗|殺人|杀人|미스터리|괴담|공포|음모|실종|사기|살인/i },
      { rpm: 4, label: 'Cocina', name: 'Cooking', re: /cooking|recipe|food|kitchen|cocina|receta|comida|gastronom|kochen|rezept|\bessen\b|k[üu]che|cuisine|recette|nourriture|\bcena\b|postre|gastronom|meal|baking|\bchefs?(?![a-zà-öø-ÿ])|gastronomy|platillo|restaurante|cocinar|ingrediente|desayuno|almuerzo|cozinha|receita|cucina|ricetta|料理|レシピ|美食|食譜|食谱|グルメ|요리|레시피|음식/i },
      { rpm: 4, label: 'Barcos', name: 'Ships', re: /\bships?\b|\bboats?\b|titanic|\bnavy\b|barco|naufragio|buque|(?<!raum)schiff|\bboote?\b|submarine|submarino|navire|bateau|naufrage|沈没|沉船|潜水艦|潛艇|潜艇|船舶|軍艦|军舰|침몰|잠수함/i },
      { rpm: 3.5, label: 'Gaming', name: 'Gaming', re: /gaming|minecraft|roblox|fortnite|gameplay|gta|videojuego|juego|spiel|videospiel|jeu.?vid[ée]o|walkthrough|esport|streamer|partida|trucos|ゲーム|実況|遊戲|游戏|マイクラ|게임|공략/i },
      { rpm: 2.5, label: 'Entretenimiento', name: 'Entertainment', re: /vlog|challenge|prank|reaction|meme|funny|\breto\b|reacci[oó]n|gracioso|ドッキリ|チャレンジ|惡搞|恶搞|몰카|리액션/i },
      { rpm: 9, label: 'Fotografia', name: 'Photography', re: /camera|photography|photo|video.?production|filmmaking|cinemat|lumix|canon|sony|nikon|drone|gear.?review|fotografia|camara|fotografo|retrato|lightroom|premiere|capcut|攝影|摄影/i },
      { rpm: 6, label: 'Idiomas', name: 'Languages', re: /learn.?(?:english|spanish|french|german|a.?language)|\bgrammar\b|vocabulary|pronunciation|\bfluent\b|duolingo|\bielts\b|\btoefl\b|aprender.?(?:ingl[eé]s|idioma|franc[eé]s)|gram[aá]tica|vocabulario|apprendre|\blangue\b|grammaire|vocabulaire|prononciation|sprache|vokabeln|grammatik|英語|文法|単語|語彙|영어|문법/i },
      { rpm: 5, label: 'Sostenibilidad', name: 'Gardening and Homesteading', re: /garden|gardening|homestead|permaculture|off.?grid|self.?sufficiency|farming|autosuficiencia|huerta|cosecha|invernadero|agricultura|sembrar|plantar|cultiv|compost|sustentable|sostenible|ogr[óo]d|ogrodnic|ro[śs]lin|warzyw|uprawa|dzia[łl]ka|garten|g[äa]rtner|pflanzen|gem[üu]se|jardin|jardinage|potager|plantes|giardino|\borto\b|piante|horta|家庭菜園|農業|农业|栽培|園藝|园艺|텃밭|농사|재배/i },
      { rpm: 5, label: 'Viajes', name: 'Travel', re: /travel|destination|explore|trip|airport|backpack|viaje|vuelo|turismo|mochila|hostel|itinerario|aventura|reise|urlaub|voyage|viagem|viajar|viaggio|旅行|観光|旅遊|旅游|여행|관광/i },
      { rpm: 5, label: 'Autos', name: 'Cars', re: /(?<![a-zà-öø-ÿ])cars?(?![a-zà-öø-ÿ])|automobile|vehicle|\bengine\b|horsepower|\bturbo\b|supercar|electric.?car|\btesla\b|motorcycle|coche|carro|autom[oó]vil|veh[ií]culo|\bmoto\b|\bautos?\b|\bmotor\b|fahrzeug|geschwindigkeit|voiture|moteur|macchina|motore|samoch[óo]d|automarke|automobil|automotriz|automotive|autom[oó]ve|自動車|クルマ|エンジン|汽車|汽车|引擎|車種|자동차|엔진/i },
      { rpm: 5, label: 'Geografia', name: 'Geography', re: /geography|geopolitic|\bmaps?\b|countries|continent|\bborders?\b|population.?of|capital.?cit|flag.?of|country.?(?:comparison|size)|why.?(?:no|nobody|almost).?(?:one|nobody)?.?lives|geograf[íi]a|geopol[íi]tica|pa[íi]ses|fronteras|\bmapa\b|continente|geografie|geographie|g[ée]ographie|\bgrenze|landkarte|fronti[èe]re|fronteira|地理|地圖|地图|国境|國境|지리|지도|국경/i },
      { rpm: 4, label: 'Belleza', name: 'Beauty', re: /\bmakeup\b|make-up|skincare|skin.?care|\bbeauty\b|cosmetics?|lipstick|mascara|haircare|maquillaje|belleza|cosm[eé]tic|cuidado.?de.?la.?piel|u[ñn]as|メイク|美妝|美妆|護膚|护肤|스킨케어|메이크업|화장품/i },
      { rpm: 4, label: 'Infantil', name: 'Kids', re: /nursery.?rhymes?|\bkids\b|cartoon.?for.?kids|toddler|preschool|baby.?songs?|learning.?colors|infantil|para.?ni[ñn]os|dibujos.?animados|canciones.?infantiles|童謡|童謠|童谣|兒童|儿童|子供向け|동요|어린이|유아/i },
      { rpm: 4, label: 'ASMR', name: 'ASMR', re: /\basmr\b|whisper|tingles?|trigger|tapping|mouth.?sounds?|ear.?to.?ear|roleplay|role.?play|scratching|brushing|crinkl|personal.?attention|susurr|囁き|耳かき|속삭임/i, format: true },
      { rpm: 3, label: 'Musica', name: 'Music', re: /\blofi\b|lo-fi|chillhop|instrumental.?music|study.?beats|guitar.?cover|piano.?cover|\bremix\b|music.?video|canci[oó]n|m[uú]sica\b|cover.?song|音楽|音樂|音乐|음악|연주/i },
      { rpm: 3, label: 'Deportes', name: 'Sports', re: /\bfootball\b|\bsoccer\b|basketball|\bnba\b|\bnfl\b|\bufc\b|\bmma\b|\btennis\b|\bcricket\b|sports?.?highlights|\bathlete\b|f[uú]tbol|baloncesto|deportes?|goles|partido.?de|サッカー|野球|足球|籃球|篮球|축구|야구|농구/i },
      { rpm: 3, label: 'Anime', name: 'Anime', re: /\banime\b|\bmanga\b|naruto|one.?piece|dragon.?ball|otaku|shonen|isekai|crunchyroll|jujutsu|demon.?slayer|attack.?on.?titan|アニメ|漫画|動漫|动漫|漫畫|애니|만화/i },
      { rpm: 3, label: 'Datos y Curiosidades', name: 'Facts and Trivia', re: /did.?you.?know|fun.?facts?|interesting.?facts|what.?(?:if|would.?happen)|top.?\d+.?(?:facts|things|reasons|moments)|infographic|sab[íi]as.?que|datos.?curiosos|curiosidades|qu[ée].?pasar[íi]a.?si|雑学|豆知識|冷知識|冷知识|トリビア|잡학|상식/i },
    ]
  };

  var ZSCRIPT_LANG = [
    [/[぀-ヿ]/, 'ja'], [/[가-힯]/, 'ko'], [/[一-鿿]/, 'zh'],
    [/[؀-ۿ]/, 'ar'], [/[֐-׿]/, 'he'], [/[ऀ-ॿ]/, 'hi'],
    [/[ঀ-৿]/, 'bn'], [/[฀-๿]/, 'th'], [/[Ͱ-Ͽ]/, 'el'],
    [/[Ѐ-ӿ]/, 'ru']
  ];
  var ZMARCAS = [
    { gl: 'de', acento: /[äöüß]/, peso: 4, marcas: /\b(der|die|das|und|den|dem|vom|zum|zur|auf|aus|f[üu]r|mit|dein|mein|sein|wie|warum|nicht|kein|eine?|ich|wir|leben|jeder|jede|geschichte|million[äa]r|reich|geld|jahre?|welt|mann|frau|krieg|gegen|wurde|hat|dass|sich|sind|oder|aber|noch|wenn|dann|mehr|ohne|unter|durch|nach|[üu]ber|schon|immer|diese[rsnm]?|wirklich|passiert|deutsch)\b/g },
    { gl: 'es', acento: /[ñ¿¡]/, peso: 4, marcas: /\b(el|sobre|c[óo]mo|qu[ée]|por|para|con|sin|los|las|una|uno|del|m[áa]s|a[ñn]os|dinero|ganar|vida|hombre|mujer|ni[ñn]o|guerra|mundo|historia|porque|cuando|este|esta|hasta|desde|pero|todo|todos|entre|donde|quien|siempre|nunca|tambi[ée]n|hacer|tiene|puede|mejor|contra|ellos|as[íi]|est[áa]|est[áa]n|nadie|nada|fue|hizo|dej[óo]|pas[óo])\b/g },
    { gl: 'fr', acento: /[èëîïùûœÿ]/, peso: 3, marcas: /\b(le|les|une|des|comment|pourquoi|votre|avec|sans|pour|argent|vie|histoire|guerre|monde|homme|femme|enfant|ans|plus|dans|cette|qui|est|sont|ont|mais|tout|tous|leur|[êe]tre|fait|chez|sous|ainsi|jamais|toujours|encore|aussi|tr[èe]s|peut|deux|elles|nous|vous|quoi|quand)\b/g },
    { gl: 'pt', acento: /[ãõ]/, peso: 4, marcas: /\b(voc[êe]|n[ãa]o|porque|dinheiro|vida|hist[óo]ria|guerra|mundo|homem|mulher|anos|mais|como|para|uma|seu|sua|isso|dos|das|ent[ãa]o|muito|tamb[ée]m|ainda|s[ãa]o|foi|tem|pelo|pela|nas|quem|fazer|ele|ela|eles|melhor|maior|coisa|aqui|depois|antes|nunca|sempre|onde|portugu[êe]s|brasil|todos|todas|meu|minha|meus|tudo|s[óo]|j[áa]|mas|ningu[ée]m|algu[ée]m|essa|esse|nossa|gente|vez|fez|era|tinha|ficou|virou|deu|contra)\b/g },
    { gl: 'it', acento: null, peso: 0, marcas: /\b(che|gli|degli|della|delle|nella|nello|anche|questo|questa|quello|quella|pi[ùu]|molto|essere|perch[ée]|dopo|senza|italiano|italia)\b/g },
    { gl: 'en', acento: null, peso: 0, marcas: /\b(the|how|why|what|who|of|to|with|your|best|make|money|life|story|world|man|woman|war|years|this|from|about|and|that|but|all|one|more|most|can|just|like|are|they|their|our|you|get|got|now|new|ever|never|into|over|after|before|first|last|real|true|its|when|where|which|than|then|out|only|still|every|know|think|made|take|look|found|behind|inside|actually|nobody|everyone|something|happened)\b/g }
  ];

  NSP_RPM_TABLA.idiomaDe = function (texto) {
    var raw0 = String(texto || '');
    for (var si = 0; si < ZSCRIPT_LANG.length; si++) {
      if (ZSCRIPT_LANG[si][0].test(raw0)) return { codigo: ZSCRIPT_LANG[si][1], seguro: true, fuente: 'script' };
    }
    var t = ' ' + raw0.toLowerCase().replace(/\s+/g, ' ') + ' ';
    var best = '', bv = 0, segundo = 0;
    for (var mi = 0; mi < ZMARCAS.length; mi++) {
      var m = ZMARCAS[mi];
      var hits = t.match(m.marcas);
      var v = 2 * (hits ? hits.length : 0);
      if (m.acento && m.acento.test(t)) v += m.peso;
      if (v > bv) { segundo = bv; bv = v; best = m.gl; }
      else if (v > segundo) { segundo = v; }
    }
    if (bv === 0) return { codigo: 'en', seguro: false, fuente: 'no language marker recognised', puntos: 0, ventaja: 0 };
    if (bv === segundo) return { codigo: 'en', seguro: false, fuente: 'two languages tied, neither wins', puntos: bv, ventaja: 0 };
    return { codigo: best, seguro: true, fuente: 'language markers', puntos: bv, ventaja: bv - segundo };
  };

  NSP_RPM_TABLA.detectarIdioma = function (text) {
    var d = NSP_RPM_TABLA.idiomaDe(text);
    NSP_RPM_TABLA.ultimaDeteccionSegura = d.seguro;
    return d.codigo;
  };

  NSP_RPM_TABLA.mercadoDe = function (texto) {
    NSP_RPM_TABLA.ultimaDeteccionSegura = true;
    var gl = NSP_RPM_TABLA.detectarIdioma(texto);
    if (!NSP_RPM_TABLA.ultimaDeteccionSegura) return { gl: '', mult: NSP_RPM_TABLA.mercadoNeutro, sinReferencia: true };
    var mult = NSP_RPM_TABLA.mercados[gl];
    if (typeof mult !== 'number') return { gl: gl, mult: NSP_RPM_TABLA.mercadoNeutro, sinReferencia: true };
    return { gl: gl, mult: mult, sinReferencia: false };
  };

  NSP_RPM_TABLA.resolver = function (texto, opciones) {
    var o = opciones || {};
    var t = String(texto || '').toLowerCase();
    var mercado = NSP_RPM_TABLA.mercadoDe(texto);
    var fila = null;
    for (var i = 0; i < NSP_RPM_TABLA.rows.length; i++) {
      var f = NSP_RPM_TABLA.rows[i];
      if (f.re.test(t)) { fila = f; break; }
      if (f.alemanSolo && mercado.gl === 'de' && f.alemanSolo.test(t)) { fila = f; break; }
    }
    var label = fila ? fila.label : SIN_CLASIFICAR;
    var base = fila ? fila.rpm : NSP_RPM_TABLA.sinClasificar;
    var rpm = base * mercado.mult;
    var largo = false;
    if (!o.isShort && o.durationSecs > 0 && (o.durationSecs / 60) >= NSP_RPM_TABLA.duracion.minutos && !NSP_RPM_TABLA.duracion.excluye.test(t)) {
      rpm = rpm * NSP_RPM_TABLA.duracion.multiplicador;
      largo = true;
    }
    if (o.isShort) rpm = NSP_RPM_TABLA.shortsRpm;
    return { label: label, name: fila ? fila.name : SIN_CLASIFICAR, clasificado: !!fila, medido: NSP_RPM_TABLA.measured === true, base: base, gl: mercado.gl, mercado: mercado.mult, sinReferencia: mercado.sinReferencia, largo: largo, rpm: parseFloat(rpm.toFixed(2)) };
  };

  NSP_RPM_TABLA.queryDe = function (label, useEs) {
    var m = NSP_RPM_TABLA.queries[label];
    if (!m) return '';
    return (useEs && m.es) ? m.es : (m.en || m.es || '');
  };

  NSP_RPM_TABLA.nombreDe = function (label) {
    for (var i = 0; i < NSP_RPM_TABLA.rows.length; i++) {
      if (NSP_RPM_TABLA.rows[i].label === label) return NSP_RPM_TABLA.rows[i].name;
    }
    return label === SIN_CLASIFICAR ? SIN_CLASIFICAR : String(label || '');
  };

  NSP_RPM_TABLA.etiquetaDe = function (texto) { return NSP_RPM_TABLA.resolver(texto, {}).label; };
  NSP_RPM_TABLA.rpmDe = function (texto, opciones) { return NSP_RPM_TABLA.resolver(texto, opciones).rpm; };
  NSP_RPM_TABLA.prosa = function () {
    var nichos = NSP_RPM_TABLA.rows.map(function (r) { return r.name + ' $' + r.rpm; }).join(', ');
    var mercados = Object.keys(NSP_RPM_TABLA.mercados).map(function (k) { return k + ' x' + NSP_RPM_TABLA.mercados[k]; }).join(', ');
    return 'Estimated RPM = the niche base times the market multiplier, and times ' + NSP_RPM_TABLA.duracion.multiplicador +
      ' when the video runs past ' + NSP_RPM_TABLA.duracion.minutos + ' minutes. Base per niche in USD for the top market: ' + nichos +
      '. ' + SIN_CLASIFICAR + ': $' + NSP_RPM_TABLA.sinClasificar + '. Multiplier per market: ' + mercados +
      '. Any language with no reference uses ' + NSP_RPM_TABLA.mercadoNeutro +
      '. These are unmeasured reference estimates, never the real RPM of a channel: that only comes from its YouTube Studio panel.';
  };

  NSP_RPM_TABLA.SIN_CLASIFICAR = SIN_CLASIFICAR;
  raiz.NSP_RPM_TABLA = NSP_RPM_TABLA;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
