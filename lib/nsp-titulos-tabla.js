(function (raiz) {
  'use strict';

  var DATOS =
    {
      "generado": "2026-09-26",
      "corpus": {
        "videos": 6872,
        "canales": 5308,
        "canalesDuelo": 3212,
        "duelos": 6247,
        "vistasMax": 1.6,
        "vphMin": 3,
        "minDuelos": 40,
        "minZ": 1.8,
        "minCanalesFrac": 0.1,
        "minCanalesAbs": 40
      },
      "calibracion": {
        "divisiones": 20,
        "acierto": 65.3,
        "min": 58.9,
        "max": 72.2,
        "azar": 50,
        "baseVistas": 56.4
      },
      "general": {
        "cifra": {
          "peso": -23,
          "duelos": 2542,
          "gana": 38.5,
          "canales": 2031
        },
        "numero_grande": {
          "peso": -46,
          "duelos": 1229,
          "gana": 26.9,
          "canales": 978
        },
        "anio": {
          "peso": -54,
          "duelos": 773,
          "gana": 22.6,
          "canales": 482
        },
        "guion_sep": {
          "peso": -50,
          "duelos": 2153,
          "gana": 24.8,
          "canales": 1172
        },
        "suspensivos": {
          "peso": 14,
          "duelos": 661,
          "gana": 57,
          "canales": 811
        },
        "comillas": {
          "peso": -16,
          "duelos": 288,
          "gana": 42,
          "canales": 368
        },
        "corchetes": {
          "peso": -49,
          "duelos": 1570,
          "gana": 25.5,
          "canales": 864
        },
        "exclamacion": {
          "peso": 34,
          "duelos": 1382,
          "gana": 67.1,
          "canales": 1162
        },
        "emoji": {
          "peso": 43,
          "duelos": 1499,
          "gana": 71.7,
          "canales": 826
        },
        "todo_mayusculas": {
          "peso": 52,
          "duelos": 1746,
          "gana": 75.8,
          "canales": 889
        },
        "largo_alto": {
          "peso": -16,
          "duelos": 2558,
          "gana": 41.8,
          "canales": 2006
        },
        "largo_corto": {
          "peso": 11,
          "duelos": 1410,
          "gana": 55.6,
          "canales": 933
        },
        "palabras_muchas": {
          "peso": -24,
          "duelos": 2780,
          "gana": 38,
          "canales": 1911
        },
        "negacion": {
          "peso": -32,
          "duelos": 779,
          "gana": 34.1,
          "canales": 765
        },
        "pregunta": {
          "peso": -20,
          "duelos": 1900,
          "gana": 40.2,
          "canales": 1851
        },
        "extremo": {
          "peso": 15,
          "duelos": 587,
          "gana": 57.4,
          "canales": 567
        },
        "revelacion": {
          "peso": -13,
          "duelos": 493,
          "gana": 43.6,
          "canales": 485
        },
        "segunda": {
          "peso": -16,
          "duelos": 907,
          "gana": 42,
          "canales": 912
        }
      },
      "segmentos": {
        "ES": {
          "acierto": 67,
          "general": 66.3,
          "divisiones": 20
        }
      },
      "nichoMotor": {
        "Melodrama campirano": {
          "motor": "NSP_PACKAGING",
          "fichero": "lib/nsp-packaging.js",
          "corpus": "tests/fixtures/rancho-channel.json",
          "acierto": 64.3,
          "general": 40.6,
          "duelos": 356,
          "canales": 1,
          "azar": 50,
          "puertaRadar": "8 of the 4490 radar titles pass the gate"
        }
      },
      "fuentes": [
        "the owner's radar sweeps, radar_feed.json, as of the generation date",
        "the owner's sweep index, feed-indice.json",
        "tests/fixtures/rancho-channel.json"
      ],
      "rechazados": [
        {
          "tipo": "mercado",
          "grupo": "EN",
          "videos": 1203,
          "duelos": 338,
          "motivo": "only 4 of 20 channel splits left enough held-out duels"
        },
        {
          "tipo": "mercado",
          "grupo": "PT",
          "videos": 882,
          "duelos": 1759,
          "motivo": "own table 71.1% does not beat the general table 75.6%"
        },
        {
          "tipo": "mercado",
          "grupo": "FR",
          "videos": 464,
          "duelos": 155,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Historia",
          "videos": 430,
          "duelos": 61,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Misterio Oscuro",
          "videos": 190,
          "duelos": 15,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Ciencia",
          "videos": 149,
          "duelos": 2,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Sleep y Relax",
          "videos": 145,
          "duelos": 9,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Finanzas",
          "videos": 137,
          "duelos": 5,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Religion e Historia",
          "videos": 128,
          "duelos": 11,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "IA y Tecnologia",
          "videos": 99,
          "duelos": 0,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Psicologia",
          "videos": 90,
          "duelos": 23,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Hogar y DIY",
          "videos": 89,
          "duelos": 2,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Naturaleza",
          "videos": 88,
          "duelos": 0,
          "motivo": "fewer than 200 duels in the owner's data"
        },
        {
          "tipo": "nicho",
          "grupo": "Autos",
          "videos": 80,
          "duelos": 20,
          "motivo": "fewer than 200 duels in the owner's data"
        }
      ],
      "referencia": {
        "Unclassified": {
          "n": 3649,
          "p10": -124,
          "p25": -83,
          "mediana": -40,
          "p75": -6,
          "p90": 20,
          "ganadores": [
            {
              "titulo": "How Fashion Industry is DESTROYING the World? | Microplastics in Your Clothes | Dhruv Rathee",
              "vph": 215898,
              "bruto": -76
            },
            {
              "titulo": "Last Cheater Standing Wins $10,000!",
              "vph": 211440,
              "bruto": -9
            },
            {
              "titulo": "Last To Leave Cybertruck Keeps It!",
              "vph": 77516,
              "bruto": 60
            },
            {
              "titulo": "A China encontrou algo melhor que o petr\u00f3leo",
              "vph": 60203,
              "bruto": 6
            },
            {
              "titulo": "\ud83d\udcbfRA\u00c7A NEGRA S\u00d3 RECORDA\u00c7\u00d5ES ANTIGAS AS MELHORES\ud83d\udcbf",
              "vph": 58827,
              "bruto": 95
            }
          ]
        },
        "Historia": {
          "n": 638,
          "p10": -110,
          "p25": -74,
          "mediana": -40,
          "p75": -12,
          "p90": 11,
          "ganadores": [
            {
              "titulo": "Scientists Can't Agree On The First Ancient City",
              "vph": 23912,
              "bruto": 15
            },
            {
              "titulo": "3 Hist\u00f3rias de Terror REAIS e Assustadoras na Colheita de Ma\u00e7\u00e3s",
              "vph": 17548,
              "bruto": -23
            },
            {
              "titulo": "3 historias de terror VER\u00cdDICAS sobre el primer d\u00eda de clases",
              "vph": 16696,
              "bruto": -8
            },
            {
              "titulo": "Richard Wolff: U.S. Empire COLLAPSING Fast, Trump's Iran 'D-Day BACKFIRES",
              "vph": 13838,
              "bruto": -16
            },
            {
              "titulo": "Plane Crash Bigger Than Any in History | Nitish Rajput",
              "vph": 12683,
              "bruto": 0
            }
          ]
        },
        "Finanzas": {
          "n": 240,
          "p10": -112,
          "p25": -78,
          "mediana": -40,
          "p75": -6,
          "p90": 14,
          "ganadores": [
            {
              "titulo": "O CORTE DA SELIC EST\u00c1 NOS DANDO UM AVISO! (se voc\u00ea entender, vai ganhar dinheiro)",
              "vph": 30077,
              "bruto": -55
            },
            {
              "titulo": "Testei a Forma MAIS PREGUI\u00c7OSA de Ganhar Dinheiro com IA",
              "vph": 24720,
              "bruto": 0
            },
            {
              "titulo": "As\u00ed es el MILLONARIO NEGOCIO de vender por AMAZON",
              "vph": 24349,
              "bruto": 0
            },
            {
              "titulo": "The Worlds Most Complicated Video Game Has A Wealth Inequality Problem",
              "vph": 23921,
              "bruto": 15
            },
            {
              "titulo": "Chica de monta\u00f1a salva hijo de multimillonario! Los Tang la adoptan; su medicina asombra!",
              "vph": 16320,
              "bruto": -6
            }
          ]
        },
        "Hogar y DIY": {
          "n": 110,
          "p10": -122,
          "p25": -85,
          "mediana": -49,
          "p75": -16,
          "p90": 14,
          "ganadores": [
            {
              "titulo": "LYNA y MANDARINA CONSTRUYEN la MEJOR CASA del \u00c1RBOL \ud83d\ude0d de Roblox",
              "vph": 30671,
              "bruto": 86
            },
            {
              "titulo": "3 Scary TRUE Garage Sale Horror Stories",
              "vph": 18256,
              "bruto": -12
            },
            {
              "titulo": "3 Terrifying TRUE New Home Horror Stories",
              "vph": 13771,
              "bruto": -12
            },
            {
              "titulo": "ME ESCOND\u00cd EN SECRETO EN NUESTRA CASA POR 24 HORAS!!",
              "vph": 9766,
              "bruto": 50
            },
            {
              "titulo": "I Ate The Entire Menu At Ghost Kitchens For 100 Hours",
              "vph": 9574,
              "bruto": -69
            }
          ]
        },
        "Sleep y Relax": {
          "n": 284,
          "p10": -113,
          "p25": -83,
          "mediana": -60,
          "p75": -32,
          "p90": 0,
          "ganadores": [
            {
              "titulo": "Experta en Inconsciente: Haz Esto Antes de Dormir y tu Doble Cu\u00e1ntico Resolver\u00e1 el Problema Por ti",
              "vph": 17763,
              "bruto": -56
            },
            {
              "titulo": "\u00bfComenzaste a Dormir con dos Almohadas? \u00a1Esto INDICA que tu Coraz\u00f3n est\u00e1 MUY Enfermo!",
              "vph": 7973,
              "bruto": -42
            },
            {
              "titulo": "As\u00ed VIVE a los 70 A\u00d1OS Tomando AGUA DE LLUVIA y SIN LUZ en PLENO MONTE CORDOB\u00c9S",
              "vph": 3746,
              "bruto": -43
            },
            {
              "titulo": "Betrayed by his girlfriend,a delivery guy gains X-ray vision,a sexy CEO begs to sleep with him",
              "vph": 3533,
              "bruto": -40
            },
            {
              "titulo": "A PLANTA que OS CAIPIRAS tem no quintal e faz DORMIR a noite inteira",
              "vph": 2620,
              "bruto": -44
            }
          ]
        },
        "Infantil": {
          "n": 60,
          "p10": -47,
          "p25": -26,
          "mediana": 0,
          "p75": 19,
          "p90": 37,
          "ganadores": [
            {
              "titulo": "I Let My Kids Control BACK TO SCHOOL Shopping!",
              "vph": 23781,
              "bruto": 34
            },
            {
              "titulo": "Diaper Change Went Wrong! Baby Care Song | Nursery Rhyme & Kids Song | Captain Jack",
              "vph": 14954,
              "bruto": -6
            },
            {
              "titulo": "Tres Labradores \ud83c\udf89 Dibujos Animados \ud83d\udd0dSheriff Labrador en Espa\u00f1ol",
              "vph": 7039,
              "bruto": 43
            },
            {
              "titulo": "\u00bfPara Qu\u00e9 Sirve el Ombligo? | Partes del Cuerpo para Ni\u00f1os",
              "vph": 4573,
              "bruto": 0
            },
            {
              "titulo": "When Does Rob Feel Angry, Sad & Happy? \ud83d\ude21\ud83d\ude22\ud83d\ude04 Feelings & Emotions | Rosoo Nursery Rhymes & Kids Songs",
              "vph": 3618,
              "bruto": -17
            }
          ]
        },
        "Salud y Fitness": {
          "n": 50,
          "p10": -113,
          "p25": -83,
          "mediana": -47,
          "p75": -17,
          "p90": -4,
          "ganadores": [
            {
              "titulo": "Medical TIkToks That Trigger Doctors",
              "vph": 50157,
              "bruto": 11
            },
            {
              "titulo": "Doctor Reacts To Daytime TV Medical Advice",
              "vph": 33185,
              "bruto": 11
            },
            {
              "titulo": "Why is my body like this \u201cPCOS, Endo, Anxiety, Dysmenorrhea\u201d - Shruti Haasan | Hormonal Health ",
              "vph": 5906,
              "bruto": -126
            },
            {
              "titulo": "Menopausia: entrenar fuerza abre tu farmacia interna | Boticaria Garc\u00eda, Doctora en Farmac",
              "vph": 5150,
              "bruto": -56
            },
            {
              "titulo": "\u00a1El m\u00e9dico que la atendi\u00f3 era el hombre con quien pas\u00f3 una noche; \u00a1\u00e9l se enamor\u00f3 a primera vista!",
              "vph": 4682,
              "bruto": -26
            }
          ]
        },
        "Misterio Oscuro": {
          "n": 233,
          "p10": -136,
          "p25": -79,
          "mediana": -40,
          "p75": -12,
          "p90": 13,
          "ganadores": [
            {
              "titulo": "ESCAPAMOS DE PEPPA PIG MALDITA EN MINECRAFT | Peppa Horror Mod",
              "vph": 48409,
              "bruto": 52
            },
            {
              "titulo": "COMPR\u00c9 LA CAJA MISTERIOSA DE DUMPLINGS M\u00c1S RARA DEL MUNDO! \ud83d\ude31",
              "vph": 35555,
              "bruto": 129
            },
            {
              "titulo": "\u00a1Minecraft con MONSTRUOS de TERROR! \ud83d\ude28\ud83d\udc80\ud83e\ude78 SILVIOGAMER MINECRAFT PERO",
              "vph": 20744,
              "bruto": 129
            },
            {
              "titulo": "Minecraft, But You Can Fuse SCARY MYTHS!",
              "vph": 20521,
              "bruto": 29
            },
            {
              "titulo": "3 Terrifying TRUE Mall Horror Stories",
              "vph": 17046,
              "bruto": -12
            }
          ]
        },
        "Gaming": {
          "n": 69,
          "p10": -63,
          "p25": -32,
          "mediana": 11,
          "p75": 40,
          "p90": 63,
          "ganadores": [
            {
              "titulo": "GTA5 Has Rivers You've Never Seen",
              "vph": 77669,
              "bruto": -60
            },
            {
              "titulo": "Jugu\u00e9 como BEB\u00c9 VERITY para TROLLEAR a Mis Amigos en Minecraft!",
              "vph": 47699,
              "bruto": 14
            },
            {
              "titulo": "We Ate EVERYTHING In ROBLOX MUKBANG.. W/ FOLTYN",
              "vph": 41862,
              "bruto": 52
            },
            {
              "titulo": "ROBLOX DRAW OR GET EATEN!",
              "vph": 40870,
              "bruto": 97
            },
            {
              "titulo": "MINECRAFT WONDERLAND",
              "vph": 37980,
              "bruto": 63
            }
          ]
        },
        "Religion e Historia": {
          "n": 172,
          "p10": -109,
          "p25": -72,
          "mediana": -43,
          "p75": -15,
          "p90": 11,
          "ganadores": [
            {
              "titulo": "O QUE OS GRINGOS PENSAM DO FOLCLORE BRASILEIRO? | #3CONTINENTES #138",
              "vph": 9432,
              "bruto": -37
            },
            {
              "titulo": "Papa konnte seinem Sohn den Roboter nicht kaufen... DANN passierte etwas Erstaunliches! \ud83d\ude31\ud83e\udd16 | Lang...",
              "vph": 7992,
              "bruto": 51
            },
            {
              "titulo": "EMOCIONANTE: AS CRIAN\u00c7AS EST\u00c3O VENDO JESUS E UM RECADO...",
              "vph": 6685,
              "bruto": 66
            },
            {
              "titulo": "World Religions Inspired By Aliens? | Ancient Aliens",
              "vph": 5743,
              "bruto": 0
            },
            {
              "titulo": "\ud83d\udea8 NOTICIAS COLOMBIA ALARMA EL VOLC\u00c1N PURAC\u00c9 PUEDE DESATAR EL INFIERNO",
              "vph": 4275,
              "bruto": 95
            }
          ]
        },
        "Geografia": {
          "n": 77,
          "p10": -115,
          "p25": -78,
          "mediana": -38,
          "p75": 0,
          "p90": 14,
          "ganadores": [
            {
              "titulo": "Top 5 pa\u00edses que JAM\u00c1S VOLVER\u00c9 \ud83e\udd2b",
              "vph": 14727,
              "bruto": 11
            },
            {
              "titulo": "Alemanha: \u201cdaremos uma resposta militar a R\u00fassia\u201d! Putin quer conflito na fronteira da Finl\u00e2ndia!",
              "vph": 10571,
              "bruto": -22
            },
            {
              "titulo": "Wo Wagenknecht die Grenze zur AfD zieht",
              "vph": 6606,
              "bruto": -9
            },
            {
              "titulo": "I Followed the World's Oldest Treasure Map into Egypt's Eastern Desert",
              "vph": 5322,
              "bruto": 0
            },
            {
              "titulo": "The Lost Continent of Zealandia: What Was Erased 10,000 Years Ago",
              "vph": 4099,
              "bruto": -89
            }
          ]
        },
        "Psicologia": {
          "n": 137,
          "p10": -104,
          "p25": -63,
          "mediana": -36,
          "p75": -11,
          "p90": 20,
          "ganadores": [
            {
              "titulo": "How Successful People Turn Daily Habits Into Extraordinary Results",
              "vph": 2081,
              "bruto": -20
            },
            {
              "titulo": "Immanuel Kant : A filosofia completa sobre a raz\u00e3o (pra ouvir enquanto faz outra coisa)",
              "vph": 1965,
              "bruto": -89
            },
            {
              "titulo": "NADIE TE CONTAR\u00c1 ESTO: La CALMA es la Verdadera Clave del \u00c9XITO | ESTOICISMO",
              "vph": 1296,
              "bruto": -36
            },
            {
              "titulo": "Die Psychologie von Lindsay Clancy \u2013 Kap. 1",
              "vph": 975,
              "bruto": -62
            },
            {
              "titulo": "ESTAS PALABRAS TE HAR\u00c1N M\u00c1S FUERTE QUE CUALQUIER TERAPIA PSICOL\u00d3GICA | ESTOICISMO",
              "vph": 972,
              "bruto": -24
            }
          ]
        },
        "Ciencia": {
          "n": 214,
          "p10": -112,
          "p25": -76,
          "mediana": -40,
          "p75": -14,
          "p90": 11,
          "ganadores": [
            {
              "titulo": "Deep Sea Mysteries That Science Can't Explain! | Dhruv Rathee",
              "vph": 166720,
              "bruto": 34
            },
            {
              "titulo": "Scientists Put a Time Limit on the End of the Universe",
              "vph": 16569,
              "bruto": 0
            },
            {
              "titulo": "CONFIRMED: SpaceX Unveiled Starship\u2019s Huge New Mission",
              "vph": 16180,
              "bruto": 0
            },
            {
              "titulo": "The Harsh Reality of NASA's Moon Base Plans",
              "vph": 16175,
              "bruto": 11
            },
            {
              "titulo": "SpaceX's Secret $100 Billion Starship Plan Revealed! The End Of Falcon 9?",
              "vph": 9650,
              "bruto": -88
            }
          ]
        },
        "Naturaleza": {
          "n": 155,
          "p10": -92,
          "p25": -56,
          "mediana": -26,
          "p75": 0,
          "p90": 27,
          "ganadores": [
            {
              "titulo": "WE GOT KIDNAPPED in Animal Hospital Anomaly..",
              "vph": 48755,
              "bruto": 11
            },
            {
              "titulo": "ABR\u00cd MI HOSPITAL DE ANIMALES \ud83d\ude0e",
              "vph": 28201,
              "bruto": 106
            },
            {
              "titulo": "Trolling FOLTYN With ANOMALIES ONLY in Animal Hospital..",
              "vph": 22983,
              "bruto": 15
            },
            {
              "titulo": "Dois-je tu*r mon chien virtuel ? R\u00e9sultats du vote.",
              "vph": 19706,
              "bruto": -16
            },
            {
              "titulo": "ESCAPA del TECLADO siendo GATO se VUELVE cada vez MAS RARO \ud83d\ude31",
              "vph": 16508,
              "bruto": 71
            }
          ]
        },
        "Cocina": {
          "n": 41,
          "p10": -111,
          "p25": -60,
          "mediana": -6,
          "p75": 12,
          "p90": 43,
          "ganadores": [
            {
              "titulo": "I TRIED TO BEAT YO SUSHI'S UNLIMITED SUSHI BELT BUFFET! | BeardMeatsFood",
              "vph": 144885,
              "bruto": 46
            },
            {
              "titulo": "As FESTAS onde sobrevivem os pratos que ningu\u00e9m mais cozinha",
              "vph": 9830,
              "bruto": -52
            },
            {
              "titulo": "Un D\u00eda Trabajando en Restaurante Mexicano",
              "vph": 4883,
              "bruto": 11
            },
            {
              "titulo": "Este BUFFET DE CENA en MUMBAI nos dej\u00f3 IMPACTADOS por completo.",
              "vph": 3357,
              "bruto": 0
            },
            {
              "titulo": "La vida acogedora en un pueblo mexicano \ud83c\udfe1 | chilaquiles rojos y nuevas repisas para mi cocina.",
              "vph": 3015,
              "bruto": 3
            }
          ]
        },
        "IA y Tecnologia": {
          "n": 173,
          "p10": -110,
          "p25": -86,
          "mediana": -49,
          "p75": -13,
          "p90": 11,
          "ganadores": [
            {
              "titulo": "\ud83d\udea8China Nostradamus Jiang Five\u00a0SHOCKING Future Predictions | AI Will CONTROL Humanity | VR Raja",
              "vph": 28716,
              "bruto": -10
            },
            {
              "titulo": "Si la IA ya te da miedo, mejor no veas esto",
              "vph": 22507,
              "bruto": 10
            },
            {
              "titulo": "How to lose $35 Billion Dollars Betting on AI",
              "vph": 20501,
              "bruto": -32
            },
            {
              "titulo": "We Turned AI Slop Into Real Keyboards (feat. Safiya Nygaard)",
              "vph": 20118,
              "bruto": -49
            },
            {
              "titulo": "DETENGAN LAS HISTORIAS CON IA! PARTE 10",
              "vph": 18774,
              "bruto": 74
            }
          ]
        },
        "Autos": {
          "n": 166,
          "p10": -129,
          "p25": -81,
          "mediana": -31,
          "p75": 0,
          "p90": 52,
          "ganadores": [
            {
              "titulo": "I DRAG RACED the World\u2019s COOLEST toy cars!",
              "vph": 27525,
              "bruto": 45
            },
            {
              "titulo": "Recebi uma grande quantia para colocar uma cole\u00e7\u00e3o de carros abandonados em funcionamento! Cada c...",
              "vph": 16981,
              "bruto": 8
            },
            {
              "titulo": "Surprising our SUBSCRIBER with his DREAM CAR BUILD! (Full Transformation) : Ford Focus ST",
              "vph": 10540,
              "bruto": -55
            },
            {
              "titulo": "The Original Saturn SL Was a New World of American Car",
              "vph": 8792,
              "bruto": -20
            },
            {
              "titulo": "Sharing is Caring Squishy | Can You Share | Race Car Song | Good Habits | Kids Songs | RoboSquad",
              "vph": 8068,
              "bruto": -56
            }
          ]
        },
        "Lujo": {
          "n": 50,
          "p10": -90,
          "p25": -72,
          "mediana": -42,
          "p75": -14,
          "p90": 12,
          "ganadores": [
            {
              "titulo": "Wir haben herausgefunden, was mit unserer KOSTENLOSEN verlassenen Yacht nicht stimmt...",
              "vph": 15699,
              "bruto": -22
            },
            {
              "titulo": "B\u00e4uerin ist die lang gesuchte Erbin des Reichsten, ihr Mann wirft sie raus, 10 Luxusautos holen sie",
              "vph": 14146,
              "bruto": -63
            },
            {
              "titulo": "Everyone in Billionaire Family Loved the Sweet Nanny\u2014Except the Cold CEO, Who Secretly Loved Her!\ud83d\ude31\u2764\ufe0f",
              "vph": 6861,
              "bruto": 17
            },
            {
              "titulo": "They Bullied the \u201cPoor Girl\u201d\u2014Then a Billionaire\u2019s Helicopter Landed at School | Full Movie",
              "vph": 5095,
              "bruto": -56
            },
            {
              "titulo": "Billionaire CRISIS: Welfare cheats, crime cover-ups and a debt bomb | MS NOW Highlights",
              "vph": 4566,
              "bruto": -40
            }
          ]
        },
        "Legal y Seguros": {
          "n": 49,
          "p10": -110,
          "p25": -76,
          "mediana": -48,
          "p75": -35,
          "p90": 0,
          "ganadores": [
            {
              "titulo": "O MENINO NEM ACREDITOU NO QUE A PATRICINHA FEZ EM BROOKHAVEN ",
              "vph": 20296,
              "bruto": 32
            },
            {
              "titulo": "Why a $90 Billion Bank Was Sold for $3 Billion in 48 Hours (Credit Suisse)",
              "vph": 5512,
              "bruto": -132
            },
            {
              "titulo": "MULHER USA AMANTE PARA MATAR O MARIDO E GANHAR SEGURO DE VIDA E CASA C/ O ASSASSINO - SR E SRA MORTE",
              "vph": 3753,
              "bruto": -38
            },
            {
              "titulo": "Legal Challenges: Lawyer Seeks Second Wife's Consent for Asghar's Release",
              "vph": 3738,
              "bruto": -16
            },
            {
              "titulo": "She Disguised as Her Brother to Serve in Court, But the Emperor Saw Through Her and Pamper Her!",
              "vph": 2506,
              "bruto": -6
            }
          ]
        },
        "Barcos": {
          "n": 54,
          "p10": -142,
          "p25": -109,
          "mediana": -56,
          "p75": -20,
          "p90": 0,
          "ganadores": [
            {
              "titulo": "Cient\u00edficos advierten que un volc\u00e1n submarino cerca de la costa de Oreg\u00f3n est\u00e1 despertando",
              "vph": 9708,
              "bruto": -60
            },
            {
              "titulo": "I Just Got PROMOTED to Run a 300-Meter Cargo Ship (It\u2019s HEAVY)",
              "vph": 7312,
              "bruto": -142
            },
            {
              "titulo": "Inside the Typhoon-Class Nuclear Submarine : The World's Largest Submarine | 3D Animation",
              "vph": 4540,
              "bruto": -63
            },
            {
              "titulo": "Uma Viagem de 180 km de Barco at\u00e9 a Fronteira | O Que Sei Sobre o Transporte de Arroz",
              "vph": 3858,
              "bruto": -129
            },
            {
              "titulo": "I Was a Navy SEAL - Then I Survived 30+ Years In Prison",
              "vph": 3423,
              "bruto": -117
            }
          ]
        },
        "Viajes": {
          "n": 50,
          "p10": -93,
          "p25": -69,
          "mediana": -40,
          "p75": 0,
          "p90": 34,
          "ganadores": [
            {
              "titulo": "Sinbad and the Seven Voyages \u2014 The Sea Beast and the Valley of Diamonds",
              "vph": 29164,
              "bruto": -90
            },
            {
              "titulo": " 45 MINUTOS DE AVENTURAS NA FAZENDINHA! | Desenho Infantil",
              "vph": 6454,
              "bruto": 63
            },
            {
              "titulo": "Wie der Kampf gegen hohe Preise zur Katastrophe werden kann",
              "vph": 5804,
              "bruto": -20
            },
            {
              "titulo": "Voyager 2 Discovered Something Strange at the Edge of Our Solar System",
              "vph": 5504,
              "bruto": -47
            },
            {
              "titulo": "\ud83e\udee3 ICH VERLIEBE MICH AUF DER REISE... \ud83d\ude82 DER FREMDE JUNGE \ud83d\udcba Camp der Liebe TEIL 1 \ud83c\udfd5\ufe0f TOCA BOCA DEUTSCH",
              "vph": 4824,
              "bruto": 46
            }
          ]
        }
      },
      "reparto": {
        "n": 6872,
        "min": -267,
        "max": 129,
        "escalones": [
          -267,
          -148,
          -117,
          -106,
          -90,
          -79,
          -69,
          -62,
          -58,
          -47,
          -40,
          -39,
          -26,
          -20,
          -16,
          -6,
          0,
          9,
          16,
          43,
          129
        ]
      },
      "margen": {
        "corte": 40,
        "acierto": 73.4,
        "cubre": 63,
        "sinCorte": 66.3,
        "azar": 50,
        "medidoEn": "2026-09-26",
        "medidoPor": "tests/titulos-juicio.test.mjs",
        "aviso": "Describes the weights above and the table test does not regenerate it. When the weights change it has to be measured again with the judge test, or it goes stale without a word."
      }
    };

  raiz.NSP_TITULOS_TABLA = DATOS;
})(typeof window !== 'undefined' ? window : globalThis);
