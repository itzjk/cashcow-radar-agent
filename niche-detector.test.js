// Stress-test del detector de nicho de NicheScanner Pro.
// Extrae NICHE_RPM + NICHE_LABEL_QUERY REALES de content/nsp-bundle.js y corre la
// misma lógica de richNicheQuery (prioridad de formato + scoring) sobre blobs de
// canales diversos. Uso: node niche-detector.test.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'content', 'nsp-bundle.js'), 'utf8');
function grab(decl, endTok) { const s = src.indexOf(decl); const e = src.indexOf(endTok, s); return src.slice(s, e + endTok.length); }
eval(grab('var NICHE_RPM = [', '\n];'));
eval(grab('var NICHE_LABEL_QUERY = {', '\n};'));
function nicheLabelToQuery(label, useEs) { const m = NICHE_LABEL_QUERY[label]; if (!m) return ''; return (useEs && m.es) ? m.es : (m.en || m.es || ''); }

// Réplica EXACTA de la lógica de selección de richNicheQuery.
function detect(blob, detectedLang) {
  blob = String(blob || '').toLowerCase();
  if (!blob.replace(/\s/g, '')) return { label: '(empty)', query: '' };
  const esLike = /\b(que|los|las|para|por|con|una|este|esta|como|pero|sin|del|sus|muy|hasta)\b/.test(blob);
  const useEs = (detectedLang === 'es') || (detectedLang !== 'en' && esLike);
  function nrHits(e) { if (!e._reG) e._reG = new RegExp(e.re.source, 'gi'); return (blob.match(e._reG) || []).length; }
  let _fb = -1, _fs = 0;
  for (let f = 0; f < NICHE_RPM.length; f++) { if (!NICHE_RPM[f].format) continue; const fh = nrHits(NICHE_RPM[f]); if (fh >= 2 && fh > _fs) { _fs = fh; _fb = f; } }
  if (_fb >= 0) return { label: NICHE_RPM[_fb].label + ' [fmt]', query: nicheLabelToQuery(NICHE_RPM[_fb].label, useEs), score: _fs };
  let best = -1, bs = 0;
  for (let k = 0; k < NICHE_RPM.length; k++) { const h = nrHits(NICHE_RPM[k]); if (h > bs) { bs = h; best = k; } }
  return best >= 0 && bs > 0 ? { label: NICHE_RPM[best].label, query: nicheLabelToQuery(NICHE_RPM[best].label, useEs), score: bs } : { label: '(NONE)', query: '' };
}

// [nombre, blob, lang, expectedLabelSubstr | 'GAP' (nicho fuera de los 21)]
const CASES = [
  ['sleep/boring-history', 'The Snoozetorian boring history for sleep | Boring History for Sleep. a sleep channel to help you fall asleep relax bedtime', 'en', 'Sleep'],
  ['asmr-pure', 'ASMR whisper triggers tingles tapping mouth sounds ear to ear roleplay', 'en', 'ASMR'],
  ['cooking', 'easy cooking recipes pasta chicken dinner food kitchen chef baking', 'en', 'Cocina'],
  ['gaming', 'minecraft gameplay walkthrough fortnite roblox gaming let us play', 'en', 'Gaming'],
  ['travel', 'budget travel destinations backpacking trip airport tourism guide', 'en', 'Viajes'],
  ['true-crime', 'true crime unsolved murder case disturbing conspiracy serial killer', 'en', 'Misterio'],
  ['gardening', 'gardening tips vegetable garden compost permaculture homestead harvest', 'en', 'Sostenib'],
  ['finance', 'stock market investing dividends portfolio crypto money finance retire', 'en', 'Finanzas'],
  ['business', 'business entrepreneur startup marketing dropshipping passive income agency', 'en', 'Negocios'],
  ['ai', 'chatgpt openai midjourney ai tools automation prompt machine learning', 'en', 'IA'],
  ['tech/coding', 'python javascript coding programming software developer react cybersecurity', 'en', 'Tecnolog'],
  ['photography', 'photography camera canon sony lightroom portrait filmmaking gear review', 'en', 'Fotograf'],
  ['realestate', 'real estate property rental apartment investing mortgage construction', 'en', 'Bienes'],
  ['home-diy', 'hvac home repair plumbing electrical install window garage furnace duct', 'en', 'Hogar'],
  ['fitness', 'health fitness workout diet nutrition weight loss yoga gym training', 'en', 'Fitness'],
  ['survival', 'survival prepper wilderness bushcraft off grid bug out camping emergency', 'en', 'Superviv'],
  ['history', 'history ancient medieval war empire civilization roman greek viking dynasty', 'en', 'Historia'],
  ['science', 'science physics biology chemistry astronomy space universe quantum nasa', 'en', 'Ciencia'],
  ['nature', 'nature wildlife ocean forest mountain animal ecosystem fauna', 'en', 'Naturaleza'],
  ['psychology', 'psychology philosophy stoic mindset motivation productivity self help habits', 'en', 'Psicolog'],
  ['religion', 'religion jesus christ god bible angel heaven hell theology council', 'en', 'Religion'],
  ['entertainment', 'vlog challenge prank reaction meme funny compilation', 'en', 'Entreten'],
  // multilingüe
  ['history-DE', 'Geschichte Dokumentation antike Roemer Krieg Imperium mittelalter', 'de', 'Historia'],
  ['cooking-ES', 'recetas faciles de cocina comida casera postres cocinar para la cena', 'es', 'Cocina'],
  ['finance-PT', 'financas investimento dinheiro bolsa acoes renda passiva economia', 'pt', 'Finanzas'],
  // ambiguos / mixtos
  ['finance-vs-business', 'make money online passive income business finance investing side hustle', 'en', null],
  ['sparse-name-only', 'MrBeast', 'en', 'GAP'],
  // nichos NUEVOS (Fase 1) — antes caían a NONE
  ['cars', 'car review engine horsepower turbo supercar test drive automobile', 'en', 'Autos'],
  ['language-learning', 'learn english grammar vocabulary lessons speak fluent pronunciation', 'en', 'Idiomas'],
  ['music', 'guitar covers acoustic songs music video playlist remix piano cover', 'en', 'Musica'],
  ['beauty', 'makeup tutorial skincare routine beauty cosmetics foundation lipstick', 'en', 'Belleza'],
  ['sports', 'football soccer basketball highlights nba tennis cricket athlete', 'en', 'Deportes'],
  ['kids', 'nursery rhymes for kids cartoon baby songs preschool learning colors', 'en', 'Infantil'],
  // multilingüe faceless (Fase 2)
  ['history-DE2', 'Geschichte Doku antike Roemer Krieg Kaiser Imperium mittelalter', 'de', 'Historia'],
  ['sleep-DE', 'Einschlafen Geschichten zum Schlafen ruhige Stimme Entspannung schlaf', 'de', 'Sleep'],
  ['cooking-FR', 'recettes de cuisine cuisiner pâtisserie chef plats gastronomie', 'fr', 'Cocina'],
  ['finance-DE', 'Finanzen Geld investieren Aktien Börse Vermögen sparen', 'de', 'Finanzas'],
  ['science-DE', 'Wissenschaft Physik Weltraum Universum Dokumentation Forschung', 'de', 'Ciencia'],
  ['nature-IT', 'natura documentario fauna foresta animali selvatici montagna', 'it', 'Naturaleza'],
  ['mystery-FR', 'mystère crime paranormal effrayant enquête non résolu', 'fr', 'Misterio'],
  ['psych-DE', 'Psychologie Philosophie Denkweise Motivation Stoizismus Erfolg', 'de', 'Psicolog'],
  ['travel-DE', 'Reise Urlaub Reisen Abenteuer Reiseziele entdecken', 'de', 'Viajes'],
  ['health-PT', 'saúde fitness treino nutrição emagrecer exercício dieta', 'pt', 'Fitness'],
  ['business-FR', 'entreprise entrepreneur business vendre marketing startup', 'fr', 'Negocios'],
  // ronda 3: idiomas/nichos aún no cubiertos + polaco (encontrar fallos)
  ['tech-FR', 'programmation développeur logiciel code python tutoriel informatique', 'fr', 'Tecnolog'],
  ['autos-DE', 'Auto Test Motor PS Geschwindigkeit Fahrzeug Verbrennung', 'de', 'Autos'],
  ['idiomas-FR', 'apprendre anglais grammaire vocabulaire prononciation langue', 'fr', 'Idiomas'],
  ['gaming-DE', 'Gaming Gameplay Minecraft Roblox deutsches Lets Play Spiel', 'de', 'Gaming'],
  ['cooking-DE', 'Kochen Rezepte Essen Küche Backen einfache Gerichte', 'de', 'Cocina'],
  ['fitness-FR', 'fitness musculation nutrition perte de poids entraînement santé', 'fr', 'Fitness'],
  ['beauty-ES', 'maquillaje belleza cuidado de la piel cosméticos rutina', 'es', 'Belleza'],
  ['science-FR', 'science physique espace univers documentaire astronomie', 'fr', 'Ciencia'],
  ['gardening-PL', 'ogród ogrodnictwo rośliny warzywa uprawa kompost działka', 'pl', 'Sostenib'],
  ['history-PL', 'historia starożytny Rzym wojna imperium średniowiecze bitwa', 'pl', 'Historia'],
  // ronda 4: blobs REALISTAS (marca + títulos naturales) → observar dónde cae
  ['r-geography', 'RealLifeLore why almost nobody lives in this giant region maps geography population of countries explained', 'en', 'Geografia'],
  ['r-biz-docs', 'Magnates Media the dark story of how this billionaire built his business empire tycoon', 'en', null],
  ['r-tech-docs', 'ColdFusion the rise and fall of this tech company innovation startup story', 'en', null],
  ['r-mystery', 'LEMMINO the mystery that was never solved strange unexplained disappearance', 'en', 'Misterio'],
  ['r-space', 'how the universe works black holes galaxies cosmos space documentary', 'en', 'Ciencia'],
  ['r-sleep', 'Sleep Cove guided sleep meditation hypnosis to fall asleep fast and calm your mind', 'en', 'Sleep'],
  ['r-facts', 'The Infographics Show what would happen if this crazy scenario facts compared infographic', 'en', 'Datos'],
  ['r-horror', 'Mr Nightmare 3 scary true horror stories that actually happened at night creepy', 'en', 'Misterio'],
  ['r-money', 'how to build wealth in your 20s passive income side hustle financial freedom invest', 'en', 'Finanzas'],
  ['r-animals', 'most dangerous predators in the world wildlife animals nature documentary', 'en', 'Naturaleza'],
  ['r-crypto', 'bitcoin ethereum crypto market analysis altcoins blockchain investing', 'en', 'Finanzas'],
  ['r-anime', 'anime explained manga review season episode characters story arc naruto', 'en', 'Anime'],
  // ronda 5: realistas en OTROS idiomas (frases naturales, no keywords)
  ['r-de-sleep', 'Einschlafgeschichten zum Einschlafen ruhige Gutenachtgeschichten für Erwachsene entspannen', 'de', 'Sleep'],
  ['r-de-history', 'Geschichte einfach erklärt das Römische Reich und der Untergang Doku antike', 'de', 'Historia'],
  ['r-de-truecrime', 'Wahre Verbrechen ungelöste Kriminalfälle und mysteriöse Morde Doku', 'de', 'Misterio'],
  ['r-de-tech', 'Technik Tutorials Programmierung Python und Software Entwicklung erklärt', 'de', 'Tecnolog'],
  ['r-fr-cooking', 'Recettes faciles et rapides pour le dîner cuisine maison du chef plats', 'fr', 'Cocina'],
  ['r-fr-science', 'La science expliquée espace trous noirs et univers documentaire physique', 'fr', 'Ciencia'],
  ['r-es-finance', 'Finanzas personales cómo invertir en bolsa y ganar dinero ahorro acciones', 'es', 'Finanzas'],
  ['r-es-psych', 'Psicología y filosofía estoicismo mentalidad hábitos y desarrollo personal', 'es', 'Psicolog'],
  ['r-pt-gaming', 'Gameplay de Minecraft e Free Fire dicas truques e novidades dos jogos', 'pt', 'Gaming'],
  ['r-it-cooking', 'Ricette italiane facili pasta e dolci cucina della nonna ingredienti', 'it', 'Cocina'],
  // ronda 6: COLISIONES (palabras compartidas entre nichos) — fijadas como regresión
  ['c-cooking-relax', 'relax and enjoy easy cooking recipes comfort food for dinner kitchen', 'en', 'Cocina'],
  ['c-finance-hacks', 'money saving life hacks budget tips how to save and invest wealth', 'en', 'Finanzas'],
  ['c-dark-history', 'the dark history of ancient rome the brutal truth of the empire war', 'en', 'Historia'],
  ['c-space-facts', 'space facts you did not know about black holes and the universe science', 'en', 'Ciencia'],
  ['c-travel-maps', 'best countries to visit travel guide maps of the world trip destinations', 'en', 'Viajes'],
  ['c-gaming-relax', 'relaxing minecraft gameplay no commentary chill building survival game', 'en', 'Gaming'],
  ['c-diy-garden', 'how to build a garden shed diy backyard home project with tools', 'en', 'Hogar'],
  ['c-study-music', 'study music to focus concentration lofi beats deep work playlist', 'en', 'Musica'],
  ['c-bible-history', 'the history of early christianity biblical events and jesus explained', 'en', 'Religion'],
  ['c-meditation-fit', 'morning yoga and fitness workout routine for energy health and diet', 'en', 'Fitness'],
  ['c-anime-facts', 'top 10 anime facts you did not know about naruto and one piece manga', 'en', 'Anime'],
];

let pass = 0, fail = 0, gaps = [];
console.log('NICHO DETECTOR — stress test\n' + '='.repeat(70));
for (const [name, blob, lang, exp] of CASES) {
  const r = detect(blob, lang);
  if (exp === 'GAP' || exp === null) {
    const tag = exp === 'GAP' ? 'GAP?' : 'AMBIG';
    console.log(`  [${tag}] ${name.padEnd(22)} → ${r.label} (score ${r.score || 0}) :: ${r.query}`);
    if (exp === 'GAP') gaps.push([name, r.label, r.query]);
    continue;
  }
  const ok = r.label.toLowerCase().includes(exp.toLowerCase());
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name.padEnd(22)} → ${r.label} (esperaba ~"${exp}") :: ${r.query}`);
  ok ? pass++ : fail++;
}
console.log('='.repeat(70));
console.log(`RESULTADO: ${pass} PASS / ${fail} FAIL  ·  ${gaps.length} fuera-de-21 (revisar si vale agregarlos)`);
process.exit(fail > 0 ? 1 : 0);
