(function (raiz) {
  'use strict';

  var FUERA_DE_ALCANCE = [
    'your footage and whether it is yours to use',
    'music rights and Content ID',
    'the thumbnail',
    'the audio track',
    'click-through rate and audience retention, which are not public and are never estimated here'
  ];

  var POLITICAS = {
    inauthentic_content: 'YouTube Inauthentic content policy (mass-produced and repetitious content). Enforced against the whole channel.',
    reused_content: 'YouTube Reused content rules of the Partner Programme. Enforced against the whole channel.',
    inappropriate_language: 'Advertiser-friendly content guidelines, Inappropriate language.',
    adult_content: 'Advertiser-friendly content guidelines, Adult content.',
    shocking_content: 'Advertiser-friendly content guidelines, Shocking content.',
    harmful_dangerous: 'Advertiser-friendly content guidelines, Harmful or dangerous acts.',
    hateful_derogatory: 'Advertiser-friendly content guidelines, Hateful and derogatory content.',
    recreational_drugs: 'Advertiser-friendly content guidelines, Recreational drugs and drug-related content.',
    firearms: 'Advertiser-friendly content guidelines, Firearms-related content.',
    controversial_issues: 'Advertiser-friendly content guidelines, Controversial issues and sensitive events.',
    tobacco: 'Advertiser-friendly content guidelines, Tobacco-related content.',
    misinformation: 'Advertiser-friendly content guidelines, Demonetising misinformation.'
  };

  var TERMINOS = [
    { id: 'shocking_content', re: /\b(gore|mutilat\w*|decapitat\w*|beheading|dismember\w*|corpse|autops(?:y|ies)|decapitaci[oó]n|mutilaci[oó]n|cad[aá]ver|autopsia|enthaupt\w*|verst[uü]mmel\w*|leiche|d[eé]capitation|mutilation|cadavre|halshugning|lemlæstelse|lig)\b/i },
    { id: 'harmful_dangerous', re: /\b(suicid\w*|self.?harm|anorexi\w*|bulimi\w*|how to make a bomb|bomb.?making|selbstmord|suizid|selbstverletzung|autolesi[oó]n|suicidio|suicide|automutilation|selvmord|selvskade)\b/i },
    { id: 'firearms', re: /\b(assault rifle|ammunition|gun ?(?:build|mod|kit)|silencer|3d.?printed gun|fusil de asalto|munici[oó]n|silenciador|sturmgewehr|munition|schalld[aä]mpfer|fusil d.assaut|munitions|silencieux|skydev[aå]ben|ammunition)\b/i },
    { id: 'recreational_drugs', re: /\b(cocaine|heroin|meth(?:amphetamine)?|fentanyl|\bmdma\b|how to grow (?:weed|cannabis)|coca[ií]na|hero[ií]na|metanfetamina|kokain|heroin|methamphetamin|coca[ïi]ne|h[ée]ro[ïi]ne|kokain|heroin)\b/i },
    { id: 'tobacco', re: /\b(vap(?:e|ing)|e.?cigarette|nicotine pouch|cigarrillo electr[oó]nico|nicotina|e.?zigarette|nikotin|cigarette [ée]lectronique|nikotin)\b/i },
    { id: 'adult_content', re: /\b(pornograph\w*|porno\w*|onlyfans|escort service|prostituci[oó]n|prostitution|prostitutionen)\b/i },
    { id: 'inappropriate_language', re: /\b(fuck\w*|shit|motherfucker|cunt|puta madre|hijo de puta|gilipollas|scheisse|scheiße|wichser|hurensohn|encul[ée]|salope|fissefjæs|for helvede)\b/i },
    { id: 'hateful_derogatory', re: /\b(white power|racial ?slur|subhuman|untermensch|infrahumano|racially inferior|raza inferior|rassisch minderwertig|sous.?homme|undermenneske)\b/i },
    { id: 'controversial_issues', re: /\b(terror(?:ist|ism) attack|school shooting|mass shooting|genocid\w*|ethnic cleansing|atentado terrorista|tiroteo (?:escolar|masivo)|genocidio|limpieza [eé]tnica|terroranschlag|amoklauf|v[oö]lkermord|ethnische s[aä]uberung|attentat terroriste|fusillade|g[ée]nocide|nettoyage ethnique|terrorangreb|folkedrab)\b/i },
    { id: 'misinformation', re: /\b(vaccines? cause|plandemic|stolen election|flat earth|chemtrails|las vacunas causan|elecci[oó]n robada|tierra plana|impfungen verursachen|gestohlene wahl|flache erde|les vaccins causent|terre plate|vacciner forårsager|flad jord|cures? (?:your |the )?cancer|cure for cancer|miracle cure|stop (?:your |taking )?(?:chemo(?:therapy)?|insulin|medication)|cura (?:el|tu) c[aá]ncer|cura milagrosa|deja (?:la )?quimio(?:terapia)?|heilt krebs|wundermittel|gu[eé]rit le cancer|rem[eè]de miracle)\b/i }
  ];

  function motor() {
    var p = raiz.NSPPolicy;
    return (p && typeof p.evidenceOfNarration === 'function') ? p : null;
  }

  function vocabulario() {
    var v = raiz.NSP_VEREDICTO;
    return (v && v.SIRVE) ? v : null;
  }

  function palabras() {
    var v = vocabulario();
    if (v) return { sirve: v.SIRVE, mirarlo: v.MIRARLO, noSirve: v.NO_SIRVE, etiqueta: v.etiqueta };
    return null;
  }

  function buscar(texto, campo) {
    var t = String(texto || '');
    if (!t) return [];
    var out = [];
    for (var i = 0; i < TERMINOS.length; i++) {
      var m = t.match(TERMINOS[i].re);
      if (m) out.push({ politica: TERMINOS[i].id, nombre: POLITICAS[TERMINOS[i].id], termino: m[0], campo: campo, indice: m.index });
    }
    return out;
  }

  function evaluarGuion(entrada) {
    var e = entrada || {};
    var P = motor();
    var W = palabras();
    if (!P) return { ok: false, motivo: 'sin_motor', porque: 'The policy engine (nsp-policy.js) is not loaded on this page. I will not judge a script with half an engine.' };
    if (!W) return { ok: false, motivo: 'sin_vocabulario', porque: 'lib/nsp-veredicto.js is not loaded, so there is no house wording to answer in.' };

    var guion = String(e.texto == null ? '' : e.texto);
    var evidencia = P.evidenceOfNarration({ script: guion });

    var hallazgos = []
      .concat(buscar(guion, 'script'))
      .concat(buscar(e.titulo, 'title'))
      .concat(buscar(e.descripcion, 'description'));

    var pol = e.politica || null;
    var duro = !!(pol && pol.risk === 'red');
    var blando = !!(pol && pol.risk === 'yellow');

    var razones = [];
    var pendientes = 0;
    var estado;

    if (duro) estado = W.noSirve;
    else if (!evidencia.hasText || hallazgos.length || blando) estado = W.mirarlo;
    else estado = W.sirve;

    if (pol && (duro || blando)) (pol.reasons || []).forEach(function (r) { razones.push(r); pendientes++; });
    if (!evidencia.hasText) { razones.push(evidencia.reason); pendientes++; }
    hallazgos.forEach(function (h) {
      razones.push('FLAG [' + h.politica + '] "' + h.termino + '" in the ' + h.campo + ' -> ' + h.nombre + ' This is a keyword screen, not YouTube\'s classifier: read the passage and decide.');
      pendientes++;
    });
    if (estado === W.sirve) razones.push('Nothing in the ' + evidencia.words + ' words you handed over matched a policy this screen knows.');

    razones.push('SCOPE: what this never looked at: ' + FUERA_DE_ALCANCE.join('; ') + '.');

    return {
      ok: true,
      veredicto: estado,
      etiqueta: W.etiqueta(estado),
      palabras: evidencia.words,
      hallazgos: hallazgos,
      politicaMotor: pol ? pol.risk : null,
      razones: razones,
      fueraDeAlcance: FUERA_DE_ALCANCE.slice(),
      porque: estado === W.noSirve
        ? 'A hard rule fired. Delete or rewrite it, there is no workaround.'
        : (estado === W.mirarlo
          ? pendientes + ' thing(s) need your eyes before you produce this.'
          : 'No match on this screen. That is not YouTube saying yes, it is this screen saying it found nothing in the words it read.')
    };
  }

  function evaluarTema(tema, politica) {
    return evaluarGuion({ texto: String(tema || ''), titulo: '', descripcion: '', politica: politica || null });
  }

  function esqueleto(titulo) {
    var t = String(titulo || '').toLowerCase();
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    t = t.replace(/[0-9]+/g, '#').replace(/[^a-z#\s]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.split(' ').slice(0, 3).join(' ');
  }

  function evaluarCanal(entrada) {
    var e = entrada || {};
    var P = motor();
    var W = palabras();
    if (!P) return { ok: false, motivo: 'sin_motor', porque: 'The policy engine (nsp-policy.js) is not loaded on this page.' };
    if (!W) return { ok: false, motivo: 'sin_vocabulario', porque: 'lib/nsp-veredicto.js is not loaded, so there is no house wording to answer in.' };

    var videos = Array.isArray(e.videos) ? e.videos : [];
    if (!videos.length) {
      return { ok: false, motivo: 'sin_videos', porque: 'No videos handed over. A channel with nothing in it is not a clean channel, it is an unread one.' };
    }

    var total = videos.length;
    var sinNarracion = 0, cuentaEsqueleto = {}, plantillas = {};
    for (var i = 0; i < total; i++) {
      var v = videos[i] || {};
      if (!P.evidenceOfNarration({ script: v.guion }).hasText) sinNarracion++;
      var sk = esqueleto(v.titulo);
      if (sk) cuentaEsqueleto[sk] = (cuentaEsqueleto[sk] || 0) + 1;
      var pl = String(v.plantilla || '').trim();
      if (pl) plantillas[pl] = (plantillas[pl] || 0) + 1;
    }

    var repetidos = 0;
    Object.keys(cuentaEsqueleto).forEach(function (k) { if (cuentaEsqueleto[k] > 1) repetidos += cuentaEsqueleto[k]; });
    var nPlantillas = Object.keys(plantillas).length;

    var senales = [];
    if (sinNarracion) senales.push({ id: 'inauthentic_content', porque: sinNarracion + ' of ' + total + ' videos carry no narration text at all.' });
    if (repetidos > 1) senales.push({ id: 'reused_content', porque: repetidos + ' of ' + total + ' titles share their first three words with another video on the channel.' });
    if (nPlantillas === 1 && total > 1) senales.push({ id: 'inauthentic_content', porque: 'All ' + total + ' videos run the same edit template "' + Object.keys(plantillas)[0] + '".' });

    var estado;
    if (sinNarracion === total) estado = W.noSirve;
    else if (senales.length) estado = W.mirarlo;
    else estado = W.sirve;

    var razones = senales.map(function (s) { return 'CHANNEL [' + s.id + '] ' + s.porque + ' -> ' + POLITICAS[s.id]; });
    if (!razones.length) razones.push('Every one of the ' + total + ' videos carries narration text, and no title skeleton repeats.');
    razones.push('SCOPE: this reads the titles, scripts and template names you handed over. It never watched a single frame.');

    return {
      ok: true,
      veredicto: estado,
      etiqueta: W.etiqueta(estado),
      total: total,
      sinNarracion: sinNarracion,
      titulosRepetidos: repetidos,
      plantillasDistintas: nPlantillas,
      senales: senales,
      razones: razones,
      porque: estado === W.noSirve
        ? 'Not one of the ' + total + ' videos has narration. That is the whole-channel shape the inauthentic content policy describes, and the sanction lands on the channel, not on a video.'
        : (estado === W.mirarlo
          ? senales.length + ' channel-level signal(s) to look at before you keep publishing.'
          : 'Nothing on this screen fired over the ' + total + ' videos read.')
    };
  }

  raiz.NspDineroRiesgo = {
    POLITICAS: POLITICAS,
    TERMINOS: TERMINOS,
    FUERA_DE_ALCANCE: FUERA_DE_ALCANCE,
    evaluarGuion: evaluarGuion,
    evaluarTema: evaluarTema,
    evaluarCanal: evaluarCanal,
    _esqueleto: esqueleto
  };
})(typeof window !== 'undefined' ? window : globalThis);
