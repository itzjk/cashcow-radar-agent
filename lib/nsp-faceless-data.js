var NSP_SHARED_FACELESS = true;
var AI_FACELESS_TITLE_PATTERNS = [
  // Listicle formats — top N facts/things
  /^(top\s*\d+|die\s*top\s*\d+|los\s*\d+|le\s*\d+|i\s*\d+|\d+\s*(facts?|fakten|datos|hechos|things|cosas|sachen|choses|fatti|secretos|secrets|geheimnisse))/i,
  // "What if" / "What happened" hypotheticals — typical AI script
  /^(what if|what happened|qué pasaría|qué pasó|was wäre wenn|was passierte|et si|cosa succederebbe|もし)/i,
  // "Why did/is X" explainer format
  /^(why (did|is|are|do)|por qué|warum|pourquoi|perché)/i,
  // "How X works/happened" explainer
  /^(how (it|this|they) (works?|happened|did)|cómo (funciona|pasó|hicieron)|wie (funktioniert|geschah)|comment (cela )?fonctionn)/i,
  // "The story of" / "X explained" formats
  /(the story of|la historia de|die geschichte von|l'histoire de|la storia di)\s/i,
  /\b(explained|explicad|erklärt|expliqué|spiegato)(\s+in)?\b/i,
  // "Hidden/Secret X" curiosity bait
  /\b(hidden|secret|forbidden|oculto|secreto|prohibido|verboten|geheim|caché|nascosto)\s+(of|del|de|von|du|di)/i,
  // "X you didn't know" — classic AI factory format
  /(you (didn'?t|never) (know|knew|hear|heard)|nunca (supiste|escuchaste)|du nie wusstest)/i,
  // Iceberg / ranking / countdown formats
  /\b(iceberg|ranking|countdown|tier list)\b/i,
  // "Things that ___ for ___ years/decades"
  /(for \d+\s*(years?|decades?|centuries)|durante \d+\s*(años|décadas|siglos))/i,
  // "X minutes" duration in title
  /\bin\s*\d+\s*(minutes?|min|minuten|minutos)\b/i,
  // Direct AI mentions in title
  /\b(ai generated|ai-generated|chatgpt|midjourney|stable diffusion|ia generada)\b/i,
  // Mythology / ancient civilization explainers
  /(ancient|antiguo|antigua|antike|antike?n)\s+(civilization|history|empire|mystery|world|civilización|imperio)/i,
  // "Did you know" curiosity opener
  /^(did you know|sabías que|wusstest du|saviez-vous)/i,
  // Documentary-style "Inside X" / "The truth about X"
  /^(inside|la verdad sobre|la verità su|die wahrheit über|dentro de)/i
];

var AI_FACELESS_CHANNEL_PATTERNS = [
  // Knowledge/facts factories
  /\b(facts?\s*(tv|hub|hq|world|verse|land|tube|today))\b/i,
  /\b(\w+\s*facts?|knowledge\s*\w+|info\s*\w+|brain\s*\w+|wisdom\s*\w+)\b/i,
  // History/story brands
  /\b(history\s*(tv|hub|verse|land|tube|world|chronicles|hd))\b/i,
  /\b(\w*stories?\s*(tv|world|verse|hub|land|tube|chronicles))\b/i,
  /\b(chronicles?\s*of|tales?\s*of|legends?\s*of)\b/i,
  // Mystery / unsolved
  /\b(mystery|mysterious|unsolved|paranormal|unexplained)\s*\w*/i,
  /\b(\w*\s*mysteries?|hidden\s*\w+|secret\s*\w+)\b/i,
  // Ancient / antiquity
  /\b(ancient|antique|antiquity|primordial)\s*(\w+\s*)?(tv|hd|hub)?\b/i,
  // AI explicit
  /\b(ai\s+\w+|\w+\s+ai|gpt|chatgpt|generated|synthetic|neural)/i,
  // Documentary brands
  /\b(\w*\s*docs?|documentary|documentaries|docs\s*\w+)\b/i,
  // Top X / Listicle
  /\b(top\s*\d*\s*\w+|listverse|\w+\s*list)\b/i,
  // Sleep / meditation faceless
  /\b(sleep\s*\w+|relaxing\s*\w+|meditation\s*\w+|asmr\s*\w+|lofi)/i,
  // Common faceless suffixes
  /\b(\w+\s*(hub|hq|tv|hd|verse|world|chronicles|stories|tales|insights|explained|matters|now|daily))\b/i
];

var CHANNEL_NAME_HUMAN_FACE_PENALTY = /^(@?[a-z]+\s*(vlogs?|cooks?|reviews?|reacts?|gaming|tv\s+show|live)|talk show|podcast con|with\s+[a-z]+|by\s+[a-z]+)/i;


var AI_FACELESS_CHANNEL_WHITELIST = [
  // English mega-faceless brands
  'fern', 'kurzgesagt', 'asapscience', 'veritasium', 'real engineering',
  'topfives', 'top5s', 'top 5s', 'top10', 'top 10', 'thefinestmoments',
  'be amazed', 'beamazed', 'mind warehouse', 'mindwarehouse',
  'the infographics show', 'infographics show', 'simple history',
  'history channel', 'history time', 'historymarche', 'kings and generals',
  'epic history tv', 'oversimplified', 'extra credits', 'extra history',
  'world history encyclopedia', 'crash course', 'thoughty2',
  'scishow', 'sci show', 'cgp grey', 'in a nutshell',
  'lemmino', 'mr beast facts', 'wendover', 'half as interesting',
  'practical engineering', 'real life lore', 'reallifelore',
  // Faceless story/mystery brands
  'mr ballen', 'mrballen', 'ballen studios', 'the why files', 'whyfiles',
  'fascinating horror', 'wartime stories', 'unsolved mysteries',
  'macabre archive', 'top tenz', 'toptenz', 'top trending',
  // Spanish faceless
  'imperio cosmico', 'el robot de platón', 'date un voltio', 'date un vlog',
  'curiosamente', 'la nave del misterio', 'el misterioso topo',
  'el rincón de giorgio', 'pero eso es otra historia', 'memorias de pez',
  'biotremendous', 'plano sin fin', 'mira la ciencia',
  // German faceless
  'mai labor', 'maithink', 'simpleclub', 'doktor whatson', 'breaking lab',
  'galileo', 'welt', 'terra x', 'history hub',
  // French
  'nota bene', 'dirty biology', 'string theory', 'science 4 all',
  // Japanese
  '雑学', '怖い話', '都市伝説',
  // Faceless cash cow / AI generated brands
  'ai stories', 'ai history', 'ai facts', 'ai documentaries',
  'generated', 'synthetic', 'neural narrator',
  // Generic faceless TV brands
  'wisdomvines', 'wisdom vines', 'better ideas', 'aperture'
];

var NICHE_RPM = [
  { rpm: 22, label: 'Finanzas',          re: /finance|invest|trading|crypto|bitcoin|ethereum|stock.?market|forex|wealth|retire|dividend|hedge.?fund|portfolio|inversion|bolsa|acciones|finanzas|dinero|riqueza|presupuesto|ahorro|deuda|hipoteca|impuesto|contabilidad|money|millionair|finanzen|\bgeld\b|aktien|\bargent\b|bourse|finan[çc]as|dinheiro|finanza|\bsoldi\b/i },
  { rpm: 16, label: 'Negocios',           re: /business|entrepreneur|startup|marketing|saas|ecommerce|dropshipping|amazon.?fba|passive.?income|make.?money|negocio|emprendedor|ingresos.?pasivos|ganar.?dinero|vender|freelanc|agencia|cliente|ventas|monetizar|gesch[äa]ft|unternehmer|entreprise|neg[óo]cio|empreendedor|imprenditore/i },
  { rpm: 13, label: 'IA y Automatizacion',re: /artificial.?intelligence|machine.?learning|chatgpt|openai|gemini|midjourney|stable.?diffusion|no.?code|prompt|inteligencia.?artificial|automatizacion|canal.?ia|ia.?canal|faceless.?ai|video.?ai/i },
  { rpm: 10, label: 'Tecnologia',         re: /software|coding|programming|developer|web.?dev|react|python|javascript|typescript|tech.?review|cybersecurity|cloud|aws|gpu|nvidia|programacion|codigo|tecnologia|hack|ciberseguridad|linux|arduino/i },
  { rpm: 9,  label: 'Fotografia',         re: /camera|photography|photo|video.?production|filmmaking|cinemat|lumix|canon|sony|nikon|drone|gear.?review|fotografia|camara|fotografo|retrato|lightroom|premiere|capcut/i },
  { rpm: 8,  label: 'Bienes Raices',      re: /real.?estate|bienes.?raices|inmueble|propiedad|alquiler|renta|departamento|construccion|arquitectura|interior|diseno/i },
  { rpm: 7,  label: 'Hogar y DIY',        re: /hvac|house|home|wall|roof|plumbing|electrical|cooling|heating|insulation|garage|furnace|air.?conditioner|air.?conditioning|duct|vent|repair|replace|install|window|shade|attic|kitchen|bathroom|tool|hogar|casa|reparacion|mejoras.?del.?hogar|bricolaje/i },
  { rpm: 7,  label: 'Salud y Fitness',    re: /health|fitness|workout|diet|nutrition|weight.?loss|yoga|meditation|mental.?health|medical|salud|ejercicio|dieta|nutricion|bajar.?de.?peso|meditacion|suplemento|vitamina|gym|entrena|alimentacion|bienestar|medicina|gesundheit|ern[äa]hrung|sant[ée]|sa[úu]de|treino|salute|allenamento/i },
  { rpm: 6,  label: 'Supervivencia',      re: /survival|prepper|wilderness|emergency|off.?grid|bug.?out|camping|self.?reliance|preparedness|supervivencia|preparacion|emergencia|campamento/i },
  { rpm: 6,  label: 'Historia',           re: /history|historical|ancient|medieval|war|empire|civilization|dynasty|pharaoh|roman|greek|viking|unsolved|historia|antiguo|antigua|guerra|imperio|civilizacion|misterio|oculto|faraon|romano|griego|vikingo|conquista|inquisicion|momia|arqueolog|geschichte|antike|krieg|mittelalter|kaiser|r[öo]mer|roemer|pharao|histoire|guerre|m[eé]di[eé]val|hist[oó]ria|imp[eé]rio/i },
  { rpm: 6,  label: 'Ciencia',            re: /science|physics|biology|chemistry|astronomy|space|universe|quantum|engineering|ciencia|fisica|biologia|quimica|astronomia|espacio|universo|planeta|teoria|descubrimiento|experimento|laboratorio|nasa|cosmolog|wissenschaft|weltraum|physik|physique|ci[êe]ncia|scienza|fisica/i },
  { rpm: 5,  label: 'Naturaleza',         re: /nature|wildlife|ocean|forest|mountain|animal|ecosystem|naturaleza|animales|oceano|bosque|montana|fauna|flora|vida.?salvaje|selva|desierto|rio|cascada|paisaje|natur|tierwelt|faune|for[êe]t|natureza|floresta|natura|foresta/i },
  { rpm: 5,  label: 'Psicologia',         re: /psychology|philosophy|stoic|stoicism|mindset|motivation|success|productivity|psicologia|filosofia|estoicismo|mentalidad|motivacion|exito|productividad|habito|autoayuda|self.?help|desarrollo.?personal|psychologie|denkweise|philosophie|mentalidade|mentalit[àa]/i },
  { rpm: 5,  label: 'Religion e Historia',re: /religion|religión|jes[uú]s|cristo|dios|biblia|b[ií]blic|angel|[aá]ngel|infierno|cielo|concilio|papas?|emperador|teolog/i },
  { rpm: 5,  label: 'Sostenibilidad',     re: /garden|gardening|diy|homestead|permaculture|off.?grid|self.?sufficiency|farming|autosuficiencia|huerta|cosecha|invernadero|agricultura|sembrar|plantar|cultiv|compost|sustentable|sostenible|ogr[óo]d|ogrodnic|ro[śs]lin|warzyw|uprawa|dzia[łl]ka|garten|g[äa]rtner|pflanzen|gem[üu]se|jardin|jardinage|potager|plantes|giardino|\borto\b|piante|horta/i },
  { rpm: 5,  label: 'Viajes',             re: /travel|destination|explore|trip|airport|backpack|viaje|destino|explorar|pais|ciudad|vuelo|turismo|mochila|hostel|itinerario|ruta|aventura|reise|urlaub|voyage|viagem|viajar|viaggio/i },
  { rpm: 4,  label: 'Cocina',             re: /cooking|recipe|food|kitchen|meal|baking|chef|gastronomy|cocina|receta|comida|platillo|gastronomia|restaurante|cocinar|ingrediente|postre|desayuno|almuerzo|cena|kochen|rezept|k[üu]che|cuisine|recette|cozinha|receita|cucina|ricetta/i },
  { rpm: 4,  label: 'Misterio Oscuro',    re: /true.?crime|paranormal|supernatural|horror|dark|creepy|scary|conspiracy|crimen.?real|sobrenatural|terror|perturbador|espeluznante|ocultismo|magia|bruj|leyenda.?urbana|extraterrestre|ovni|alien|ungel[öo]st|gruselig|geheimnis|myst[èe]re|mist[ée]rio|mistero|crimine|\bmystery\b|mysteries|unexplained|enigma/i },
  { rpm: 4,  format: true, label: 'Sleep', re: /sleep|asleep|bedtime|snooze|insomni|boring.?history|fall.?asleep|guided.?sleep|deep.?sleep|\brelax\b|\bcalm\b|\brain\b|thunder|ambient|soundscape|white.?noise|brown.?noise|binaural|dormir|relajar|adormecer|lluvia|tormenta|ruido.?blanco|schlaf|einschlafen|entspannung|sommeil|\bsono\b|relaxar|para.?dormir/i },
  { rpm: 4,  format: true, label: 'ASMR',  re: /\basmr\b|whisper|tingles?|trigger|tapping|mouth.?sounds?|ear.?to.?ear|roleplay|role.?play|scratching|brushing|crinkl|personal.?attention|susurr/i },
  { rpm: 3,  label: 'Gaming',             re: /gaming|gameplay|walkthrough|minecraft|roblox|fortnite|gta|esport|streamer|juego|videojuego|partida|trucos/i },
  { rpm: 5,  label: 'Autos',              re: /\bcars?\b|automobile|vehicle|\bengine\b|horsepower|\bturbo\b|supercar|electric.?car|\btesla\b|motorcycle|coche|carro|autom[oó]vil|veh[ií]culo|\bmoto\b|\bauto\b|\bmotor\b|fahrzeug|geschwindigkeit|voiture|moteur|macchina|motore|samoch[óo]d/i },
  { rpm: 6,  label: 'Idiomas',            re: /learn.?(?:english|spanish|french|german|a.?language)|\bgrammar\b|vocabulary|pronunciation|\bfluent\b|duolingo|\bielts\b|\btoefl\b|aprender.?(?:ingl[eé]s|idioma|franc[eé]s)|gram[aá]tica|vocabulario|apprendre|\blangue\b|grammaire|vocabulaire|prononciation|sprache|vokabeln|grammatik/i },
  { rpm: 3,  label: 'Musica',             re: /\blofi\b|lo-fi|chillhop|instrumental.?music|\bplaylist\b|study.?beats|guitar.?cover|piano.?cover|\bremix\b|music.?video|canci[oó]n|m[uú]sica\b|cover.?song/i },
  { rpm: 4,  label: 'Belleza',            re: /\bmakeup\b|make-up|skincare|skin.?care|\bbeauty\b|cosmetics?|lipstick|mascara|haircare|maquillaje|belleza|cosm[eé]tic|cuidado.?de.?la.?piel|u[ñn]as/i },
  { rpm: 3,  label: 'Deportes',           re: /\bfootball\b|\bsoccer\b|basketball|\bnba\b|\bnfl\b|\bufc\b|\bmma\b|\btennis\b|\bcricket\b|sports?.?highlights|\bathlete\b|f[uú]tbol|baloncesto|deportes?|goles|partido.?de/i },
  { rpm: 4,  label: 'Infantil',           re: /nursery.?rhymes?|\bkids\b|cartoon.?for.?kids|toddler|preschool|baby.?songs?|learning.?colors|infantil|para.?ni[ñn]os|dibujos.?animados|canciones.?infantiles/i },
  { rpm: 5,  label: 'Geografia',          re: /geography|geopolitic|\bmaps?\b|countries|continent|\bborders?\b|population.?of|capital.?cit|flag.?of|country.?(?:comparison|size)|why.?(?:no|nobody|almost).?(?:one|nobody)?.?lives|geograf[íi]a|geopol[íi]tica|pa[íi]ses|fronteras|\bmapa\b|continente/i },
  { rpm: 3,  label: 'Anime',              re: /\banime\b|\bmanga\b|naruto|one.?piece|dragon.?ball|otaku|shonen|isekai|crunchyroll|jujutsu|demon.?slayer|attack.?on.?titan/i },
  { rpm: 3,  label: 'Datos y Curiosidades', re: /did.?you.?know|fun.?facts?|interesting.?facts|what.?(?:if|would.?happen)|top.?\d+.?(?:facts|things|reasons|moments)|infographic|sab[íi]as.?que|datos.?curiosos|curiosidades|qu[ée].?pasar[íi]a.?si/i },
  { rpm: 2,  label: 'Entretenimiento',    re: /vlog|challenge|prank|reaction|meme|funny|familia|ninos|bebe|reto|reaccion/i }
];
