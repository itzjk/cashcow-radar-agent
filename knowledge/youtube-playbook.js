// ZERACK — Base de conocimiento "YouTube Playbook" v1.0.0 (2026-06-24)
// Activo de datos para la IA experta. NO cableado todavía: setea una global y no toca ninguna función.
// Origen: deep-research verificado adversarialmente (24/25 claims confirmados, mayoría fuente PRIMARIA de YouTube).
// Honestidad: cada bloque trae su nivel de confianza y fuentes. Lo que NO se pudo verificar va en `pendiente` — NO inventar.

window.NSP_YT_PLAYBOOK = {
  version: '1.3.0',
  updated: '2026-06-24',
  origen: 'deep-research (111 agentes, fuentes primarias YouTube + doc filtrado MrBeast)',

  algoritmo: {
    confianza: 'alta',
    principios: [
      'YouTube optimiza por SATISFACCION del espectador, no por watch time crudo ni CTR aislado.',
      'La satisfaccion se mide con: encuestas in-product 1-5 estrellas (solo 4-5 cuentan como "valued watchtime"), likes/dislikes, clics en "no me interesa", y si el espectador vuelve a YouTube despues.',
      'Es un sistema "pull, no push": para CADA espectador extrae lo que ESE espectador ya disfruto (su historial, que videos se ven juntos, cuanto consume de un canal/tema).',
      'Regla de oro del creador: preguntate "le gusta esto a MI audiencia?", NO "le gusta al algoritmo?".',
      'La retencion alimenta el ranking directamente: average view duration (duracion media vista) y average % viewed (porcentaje medio visto) son senales confirmadas.',
      'El peso de cada metrica depende del contexto: el watch time pesa mas en TV que en movil, mas en podcasts que en musica.',
      'Matiz honesto: el modelo "pull" describe las recomendaciones (home/sugeridos); los videos igual se testean en audiencias chicas y se expanden segun senales. No es magia de calidad absoluta.'
    ],
    fuentes: [
      'https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/',
      'https://support.google.com/youtube/answer/11914225?hl=en',
      'https://www.youtube.com/watch?v=dhYIb72L1hU'
    ]
  },

  retencionYHooks: {
    confianza: 'media',
    nota: 'Tactica documentada de UN top-creator (doc filtrado MrBeast, sept 2024, autenticidad "alleged"). No es regla de plataforma, pero es know-how consistente entre copias independientes.',
    principios: [
      'Front-load del minuto 1: maximo de visuales, musica, efectos y cambios de escena rapidos desde el arranque.',
      'Cumplir YA la promesa del titulo/miniatura ("match the clickbait expectations") y dar la mayor cantidad de info del video posible al inicio.',
      'Re-enganches periodicos ~cada 3 minutos: un "espectaculo" que mantenga la atencion.',
      'Hacia la mitad (~minuto 6): un re-enganche mayor, mas interesante, que requiere algo de explicacion y empuja la historia de la segunda mitad.',
      'Principio general: nunca dejar caer el ritmo; cada tramo debe dar una razon para seguir mirando.'
    ],
    fuentes: ['https://protunesone.com/blog/leaked-mrbeast-document-on-his-youtube-strategies/']
  },

  ctrTitulosYMiniaturas: {
    confianza: 'media',
    principios: [
      'El titulo debe abrir un "gap de curiosidad"; la miniatura debe cumplir esa promesa. Titulo + miniatura prometen, el video ENTREGA (si no, cae la satisfaccion y te hundis).',
      'Las CARAS NO son un boost universal de CTR (estudio 1of10, 300.000+ videos virales 2025): rinden parecido con o sin cara en general.',
      'Las caras ayudan solo MODESTAMENTE y sobre todo a canales grandes; es dependiente del nicho (Finanzas mejor con caras; Gaming/Business casi nulo).',
      'Priorizar contraste alto, una emocion clara y POCOS elementos legibles de un vistazo (en pantalla chica).'
    ],
    fuentes: ['https://www.searchenginejournal.com/do-faces-help-youtube-thumbnails-heres-what-the-data-says/563944/'],
    pendiente: 'Benchmarks de CTR por nicho/tamano de canal y patrones de titulo (curiosity gap, numeros, negatividad) con evidencia CUANTITATIVA fresca — no verificado aun.'
  },

  antiDesmonetizacion: {
    confianza: 'alta',
    critico: true,
    nota: 'Politica de YouTube del 15-jul-2025: "repetitious content" renombrado a "inauthentic content". Lo MAS importante para faceless. Sancion a NIVEL DE CANAL COMPLETO.',
    principios: [
      'YouTube NO penaliza usar IA. Penaliza el contenido PLANTILLIZADO/masivo casi identico y el reusado sin valor.',
      'Ejemplos que SI violan (verbatim YouTube): canales que suben historias narrativas con solo diferencias superficiales entre si; canales que suben slideshows que comparten la misma narracion.',
      'Para monetizar contenido propio con IA hay que: (a) seguir las politicas, (b) anadir la perspectiva/insight ORIGINAL y autentico del creador, (c) divulgar cuando contenido realista fue alterado/sintetico.',
      'Contenido prestado/reusado (stock, clips, gameplay): cambiarlo SIGNIFICATIVAMENTE — comentario original sustancial, modificaciones sustantivas, o valor educativo/entretenimiento real.',
      'El contenido debe hacerse para el disfrute o educacion del espectador, NO con el unico fin de conseguir views.',
      'NUNCA presentar ficcion/IA como hechos reales (el unico caso de remocion citado, True Crime Case Files 83K subs, fue por presentar historias con IA como hechos = misinformacion).',
      'Regla operativa ZERACK: cada video debe variar de verdad (no plantilla), llevar un angulo propio, y aportar valor — eso es lo que separa "automation que monetiza" de "AI slop que te tumban el canal".'
    ],
    fuentes: [
      'https://support.google.com/youtube/answer/1311392?hl=en',
      'https://www.socialmediatoday.com/news/youtube-clarifies-monetization-update-inauthentic-repeated-content/752892/'
    ]
  },

  monetizacionYPP: {
    confianza: 'alta',
    principios: [
      'Ruta videos largos: 1.000 suscriptores + 4.000 horas de visionado publico valido en los ultimos 12 meses.',
      'Ruta Shorts: 1.000 suscriptores + 10.000.000 de views publicas validas de Shorts en los ultimos 90 dias.',
      'Ademas: seguir las politicas de monetizacion, residir en pais con YPP disponible, sin strikes activos de normas, verificacion en 2 pasos (2FA), funciones avanzadas activas y cuenta de AdSense vinculada.',
      'Existe un tier "early access" menor (500 subs / 3.000 hrs / 3M views Shorts) pero solo habilita fan-funding, NO la monetizacion completa con anuncios.'
    ],
    fuentes: ['https://support.google.com/youtube/answer/72851?hl=en']
  },

  nichosYRpm: {
    confianza: 'media',
    nota: 'NO hay tabla OFICIAL de RPM por nicho, pero el RPM SE ESTIMA y SIEMPRE se debe dar un numero util: RPM = (base del nicho) x (factor de la geografia de la audiencia). Marcar como estimacion, nunca negarse a estimar.',
    metodo: [
      '1) Detecta el NICHO por las palabras del titulo/canal/descripcion.',
      '2) Toma el RPM BASE del nicho (tabla rpmBasePorNicho_tier1, valida para audiencia tier-1 / ingles USA).',
      '3) Detecta el IDIOMA y el pais del canal -> infiere la GEOGRAFIA probable de la audiencia.',
      '4) Multiplica el RPM base por el factor geografico.',
      '5) Da un RANGO estimado concreto (ej. "$3-6 RPM estimado"). NUNCA digas "no se puede saber el RPM".'
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
      'tier2 (Espana, Europa sur/este, Japon, Corea)': 0.5,
      'tier3 (LATAM, India, Pakistan, Sudeste Asiatico, Africa, Brasil)': 0.18
    },
    idiomaAGeografia: [
      'Ingles: por defecto mezcla USA/tier-1 (alto); pero mucho ingles es tier-3 (India) -> si el canal es claramente US/UK usar tier-1, si es generico usar una mezcla (~0.6).',
      'Aleman, frances (Francia), holandes, nordico, japones: tier-1/2 (~0.7-1.0).',
      'Espanol: MIXTO -> Espana es tier-2 pero la mayoria de la audiencia hispana es LATAM (tier-3). Usar factor bajo-medio (~0.15-0.35). CLAVE para canales en espanol.',
      'Portugues (Brasil): tier-3 (~0.15). Hindi/urdu/arabe/indonesio: tier-3 (~0.08-0.15).'
    ],
    ejemplo: 'Finanzas en INGLES US -> 12-40 x 1.0 = $12-40 RPM estimado. El MISMO nicho en ESPANOL/LATAM -> 12-40 x ~0.2 = $2.4-8 RPM. El idioma+geografia cambia el RPM hasta ~10x.',
    fuentes: ['estimaciones de mercado (vendors, no auditadas) + caso Fortune (Adavia Davis) + CPM first-party isthischannelmonetized (tier-1 vs tier-3 = 12-28x en CPM)']
  },

  produccionYEscala: {
    confianza: 'media',
    nota: 'Tacticas de operadores reales + data de mercado (no oficial de YouTube, pero convergente). Lo mas accionable para producir long-form que retiene Y monetiza.',
    retencionLongForm: [
      'Data 2025: retencion promedio ~23.7%; ~55% se va en los primeros 60s; un hook fuerte en los primeros 15s retiene ~65% hasta el minuto 3.',
      'Estructura de 5 actos mapeada a timestamps ANTES de escribir: gancho/cold-open -> exposicion -> conflicto creciente -> crisis -> resolucion. Evita el "filler del medio" (causa #1 de drop a mitad).',
      'Hook (primeros 15-30s): abri con pregunta provocadora, o revela un resultado inesperado, o teasea un giro. Confirma que estas en el lugar correcto + abre un loop + promete payoff.',
      'Open loops: planta una pregunta temprano y reten la respuesta. Pattern interrupt cada 90-120s (corte, grafico, SFX, cambio de ritmo).'
    ],
    midRolls: [
      'Solo en videos de 8+ min. Numero optimo: 8-10min=1, 10-14min=2, 14-18min=2-3, 18-25min=3-4. Mas de 4 daNa la satisfaccion. Sweet spot ~1 cada 8-10 min.',
      'EVITAR: mid-roll justo antes del climax o info clave (la gente se va y NO vuelve); en los primeros 2 min; mas de 1 cada 4 min.',
      'COLOCAR: despues de un cierre de idea / momento de "completitud" / entre secciones antes del proximo tema. Truco: anuncia "ya viene: ..." antes del primer mid-roll.',
      'Impacto: 10 min con 3 mid-rolls puede ganar 2-4x vs 7 min con solo pre-roll; la completion casi no baja (90% vs 92%) si estan bien colocados.'
    ],
    escalaYEquipo: [
      'Cartera de canales = digital real estate. 1 operador corre 3-5 canales (no filma/edita/narra -> no es el cuello).',
      'Contratacion: 1) editor $25-50/h, 2) guionista $30-60/h, 3) channel manager $20-40/h (uploads+optimizacion) = 70% del trabajo. + Research VA $5-15/h. Guion $30-80, edicion $50-300/video.',
      '4 SOPs minimas (de los primeros 10 videos manuales): Video Production Brief, Editor Style Guide, Thumbnail Brief, Upload Checklist. En Notion, seguibles sin preguntar.'
    ],
    porQueFracasan: [
      'Mito "set and forget": si nadie maneja el barco, deriva. La automatizacion NO es pasiva.',
      'Outsourcing TOTAL: un canal con 60M views en 3 anos tercerizo TODO y gano solo ~$6.000. Hace VOS lo creativo (idea/guion/packaging); terceriza solo lo time-consuming (edicion).',
      'Velocidad sobre calidad -> generico/robotico (imagenes estaticas, stock repetido, voz monotona) = desengagement + riesgo de desmonetizacion.',
      'Automatizar ANTES de validar (titulo/thumbnail/formato debil = mas videos debiles); y quemarse al mes 4-6 justo antes de que el algoritmo componga (~mes 8 con ~30 videos).'
    ],
    queHacenLosQueGanan: [
      'Control estrategico: automatizan inteligentemente, no todo. Nucleo creativo propio.',
      'Cada upload = experimento controlado: cambian 1 variable, miden, siguen con lo que funciona.',
      'Long game: negocio de 12 MESES, no side hustle de 12 dias. Research ANTES de producir (outliers, decodificar titulo/thumbnail, gaps -> guion fuerte -> producir).',
      'Multiples fuentes de ingreso: no solo AdSense -> afiliados, sponsors, productos propios.'
    ],
    fuentes: ['data retencion 2025 + guias de operadores/agencias + post-mortems (medium, lilys.ai) + guias de mid-roll (vidiq, fluxnote)']
  },

  nichosDetallados: {
    confianza: 'media',
    nota: 'CPM/RPM y ejemplos de canales por nicho (estimaciones de mercado convergentes, no oficiales). Para recomendar nichos por rentabilidad y dar ejemplos a imitar.',
    topPorCPM: {
      'Personal finance / inversion': 'CPM ~15-22, RPM ~15-30. Ej: Alux. El mas rentable.',
      'Make money online / IA tools': 'CPM ~15-20, RPM ~10-25. Twist 2026: ganar usando IA.',
      'Legal / court drama': 'CPM ~12-18.',
      'Digital marketing': 'CPM ~12-18.',
      'Real estate / lujo': 'CPM ~10-16.',
      'Tech reviews/tutorials': 'CPM medio + ALTO afiliado.',
      'Geography / educational': 'Ej: RealLifeLore (miniaturas unicas + temas enganchosos).',
      'True crime / mystery': 'Ej: Stories to Remember (143k subs, 35M views).',
      'Health / wellness': 'Angulo "que dice la investigacion real" + afiliados de suplementos 2-3x el ad revenue.',
      'History': 'Nicho seguro perenne (premia watch time). Elegi ANGULO especifico (WWII naval, Roma s.II, espionaje Guerra Fria), NO "historia general".'
    },
    reglas: [
      'Afiliados a menudo SUPERAN AdSense en faceless: 1 clic de alta intencion paga $50-500. No vivas solo de ads.',
      'Elegi SUB-NICHO especifico, no la categoria amplia ("WWII naval" > "historia").',
      'Shorts + long-form crece el canal ~3x mas rapido que un solo formato (data YT 2026): Shorts para descubrir, long-form para monetizar.'
    ]
  },

  stackHerramientas: {
    confianza: 'media',
    nota: 'Toolset real de operadores 2026 con precios. Stack basico total: ~$25-70/mes.',
    guionYResearch: 'ChatGPT-4o / Claude para guion; OverseerOS / 1of10 / OutlierKit para research de outliers.',
    voz: 'ElevenLabs = el estandar (voces mas naturales, multilingue). Starter $5/mes = ~30k chars (~25 min, 4-5 videos/mes), 3 voces custom. En faceless la VOZ es TODO (lo unico humano que se oye).',
    visuales: 'Sora se DISCONTINUO (26-abr-2026). Stack de 2 modelos: Kling 3.0 para movimiento/B-roll (clips hasta 3 min, ~$6.99/mes) + Nano Banana 2 (modelo de imagen #1 de Google) para ilustraciones/infografias/arte.',
    edicion: 'Descript ($24/mes, edicion por TEXTO/transcripcion + captions auto) para tutoriales/explainers; CapCut Pro ($9.99/mes) para cinematografico/vertical/efectos.',
    miniaturas: 'Nano Banana 2 para miniaturas con personajes/productos/escenas. Generar 5 variantes -> A/B test (TubeBuddy / Test&Compare nativo) las primeras 48h -> quedarse con el ganador.',
    workflow: 'BATCH: producir 5-10 videos en UNA sesion enfocada, no de a uno. Siempre RESEARCH primero, produccion despues.'
  },

  metodoOutliers: {
    confianza: 'media',
    nota: 'Como encontrar ideas que YA funcionan ANTES de producir (lo que hacen los operadores serios). ZERACK ya hace esto (scanner de outliers).',
    principios: [
      'Trackea videos que rinden ~10x sobre el promedio/mediana del CANAL -> muestra que empuja el algoritmo AHORA -> replicalo. La metrica es un MULTIPLICADOR (views vs promedio del canal), no views absolutos.',
      'Un outlier fuerte combina: demanda del tema + packaging clickeable + timing + audience fit + buenos primeros 30s.',
      'Mas fuerte si aparece en VARIOS canales del mismo nicho = demanda repetible, no suerte de un canal.',
      'Momentum del outlier: 2-6 semanas antes de saturarse. No tenes que ser el primero, pero si estar en la PRIMERA OLA (no la tercera).',
      'Distinto de perseguir tendencias: identificas lo que YA funciona a escala antes de la saturacion.'
    ]
  },

  systemPrimer: [
    'Eres el cerebro experto de ZERACK para ganar dinero con YouTube faceless/automation. Tu conocimiento se basa en fuentes primarias de YouTube (2025-2026), verificado. Hablas claro, accionable y sin humo.',
    '',
    'ALGORITMO: YouTube premia la SATISFACCION del espectador, no el watch time crudo ni el CTR aislado (mide encuestas 1-5 estrellas, likes, "no me interesa", retorno). Es "pull, no push": recomienda a cada espectador lo que ESE espectador disfruta. La pregunta correcta es "le gusta a MI audiencia?". La retencion (duracion media y % medio visto) alimenta el ranking.',
    '',
    'RETENCION: carga el minuto 1 al maximo y cumpli la promesa del titulo/miniatura de una. Re-engancha ~cada 3 min y a la mitad (~min 6) mete un giro que empuje la segunda mitad. No dejes caer el ritmo.',
    '',
    'CTR: titulo = gap de curiosidad; miniatura cumple esa promesa; el video la ENTREGA. Las caras NO son boost magico de CTR (dato de 300k+ videos); priorizar contraste, una emocion y pocos elementos legibles.',
    '',
    'ANTI-DESMONETIZACION (lo mas importante): YouTube NO castiga usar IA; castiga lo PLANTILLIZADO/casi-identico en masa y lo reusado sin valor, y la sancion es a TODO el canal. Cada video necesita perspectiva original, variar de verdad entre videos, y aportar valor real. Nunca presentar ficcion IA como hechos.',
    '',
    'MONETIZACION: 1.000 subs + 4.000 horas/12 meses (largos) O 1.000 subs + 10M views Shorts/90 dias, sin strikes, 2FA y AdSense.',
    '',
    'NICHOS RENTABLES (CPM real estimado): los que mas pagan -> personal finance (CPM 15-22, ej Alux), make-money/IA (15-20), legal/court-drama (12-18), real estate (10-16). Tambien fuertes: tech (alto afiliado), geography (ej RealLifeLore), true-crime (ej Stories to Remember 143k/35M), health (angulo "que dice la ciencia" + afiliados de suplementos 2-3x los ads), history (elegi SUB-angulo tipo "WWII naval", NO "historia general"). Los afiliados often SUPERAN AdSense (1 clic de alta intencion = $50-500): no vivas solo de ads.',
    '',
    'STACK 2026 (~$25-70/mes): guion ChatGPT/Claude; voz ElevenLabs ($5/mo, es lo unico humano -> cuidala); visuales Kling 3.0 (video/B-roll) + Nano Banana 2 (imagenes/miniaturas; OJO Sora se discontinuo en 2026); edicion Descript o CapCut; produci en BATCH (5-10 videos por sesion). ENCONTRAR IDEAS (metodo outliers): busca videos que rindan ~10x el promedio del canal Y que aparezcan en VARIOS canales del nicho (= demanda repetible, no suerte); meteti en las primeras 2-6 semanas (primera ola, no la tercera). Research SIEMPRE antes de producir.',
    '',
    'PRODUCCION LONG-FORM Y ESCALA: retencion -> hook fuerte en los primeros 15s (55% se va en 60s si no), estructura de 5 actos mapeada a timestamps (mata el filler del medio), pattern interrupt cada 90-120s. MID-ROLLS (solo 8+ min): 8-10min=1, 10-14=2, 18-25=3-4, NUNCA mas de 4; JAMAS un mid-roll antes del climax ni en los primeros 2 min; ponlos despues de cerrar una idea. 10min con 3 mid-rolls gana 2-4x vs 7min. ESCALA: 1 operador = 3-5 canales; haces VOS lo creativo (idea/guion/packaging) y tercerizas solo edicion (el outsourcing TOTAL fracasa: un canal de 60M views gano solo $6k asi). El algoritmo COMPONE ~mes 8 con ~30 videos: es negocio de 12 meses, no de 12 dias. Diversifica ingresos (afiliados/sponsors/productos), no solo AdSense.',
    '',
    'NICHOS/RPM (SIEMPRE DA EL NUMERO, nunca te niegues): para estimar el RPM de un canal -> detecta el NICHO por sus palabras -> toma el RPM base del nicho (finanzas 12-40, negocios/legal 10-35, tech 8-18, salud/educacion 6-15, true-crime/historia 4-10, sleep 6-12, recaps 5-12, curiosidades 3-7, gaming 2-8 USD para tier-1) -> detecta IDIOMA y pais -> infiere la GEOGRAFIA de la audiencia (tier-1 USA/UK = x1.0; tier-2 Espana/Europa = x0.5; tier-3 LATAM/India/Brasil = x0.18) -> multiplica -> DA UN RANGO concreto marcado como estimacion. Ej: finanzas en ingles US = $12-40; el mismo en espanol/LATAM = $2-8. El idioma+geografia cambia el RPM hasta 10x. NUNCA digas "no hay tabla oficial" como excusa para no estimar.'
  ].join('\n')
};
