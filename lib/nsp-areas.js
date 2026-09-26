(function (raiz) {
  'use strict';

  var AREAS = [
    ['religion', /biblia|bible|jesus|jesús|cristo|christ|gospel|evangelio|god\b|dios\b|prophec|profec|salmo|psalm|apostol|sagrada|holy\b|catolic|cristian|christian/i],
    ['mitologia', /mitolog|mytholog|norse|nordic|griega|greek god|olimpo|olymp|hindu|vedic|ramayan|leyenda|legend|folklore/i],
    ['historia', /histori|history|histoire|geschichte|imperio|empire|roma\b|egipt|egypt|medieval|guerra mundial|world war|dinast|civilizac|civilizat|arqueolog|archaeolog/i],
    ['misterio', /misteri|myster|unsolved|paranormal|conspir|oculto|hidden truth|secreto|enigma|ovni|\bufo\b|alien/i],
    ['mente', /psicolog|psycholog|cerebro|brain|mente|mind\b|comportamien|behavior|manipulac|dark psychology|sesgo|bias/i],
    ['cuerpo', /cuerpo|\bbody\b|salud|health|sueño|sleep|dormir|anatom|medic|enfermedad|disease|nutric/i],
    ['espacio', /espacio|space|cosmos|universe|universo|planeta|planet|galax|nasa|astronom|black hole|agujero negro/i],
    ['naturaleza', /ocean|oceano|océano|deep sea|animal|wildlife|natur|selva|jungle|volcan|tierra|earth\b|geograf|geograph/i],
    ['crimen', /true crime|crimen|criminal|asesin|murder|caso\b|detective|forense|forensic|serial killer/i],
    ['dinero', /finanz|finance|dinero|money|riqueza|wealth|invers|invest|negocio|business|econom|millonar|cripto|crypto/i],
    ['tecnologia', /\bia\b|\bai\b|robot|tecnolog|technolog|futur|invento|invention|ingenier|engineer|maquina|machine/i]
  ];

  var NOMBRE = {
    religion: 'religion', mitologia: 'mythology', historia: 'history', misterio: 'mystery', mente: 'mind',
    cuerpo: 'body', espacio: 'space', naturaleza: 'nature', crimen: 'crime', dinero: 'money', tecnologia: 'technology', otros: 'other'
  };

  function nombreDe(area) {
    return NOMBRE[area] || String(area || '');
  }

  function areaDe(txt) {
    var s = String(txt || '');
    for (var i = 0; i < AREAS.length; i++) { if (AREAS[i][1].test(s)) return AREAS[i][0]; }
    return 'otros';
  }

  raiz.NspAreas = { AREAS: AREAS, NOMBRE: NOMBRE, areaDe: areaDe, nombreDe: nombreDe, total: AREAS.length };
})(typeof window !== 'undefined' ? window : this);
