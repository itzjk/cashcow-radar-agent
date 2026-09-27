(function (root) {
  'use strict';

  var NSP_FACELESS_QUERIES_BY_LANG = {
    en: ['top 10 facts', 'unbelievable stories', 'true crime stories', 'history documentary', 'space facts', 'mystery explained', 'finance tips', 'psychology facts', 'sleep meditation', 'satisfying compilation', 'mythology explained', 'ancient civilizations'],
    es: ['top 10 datos curiosos', 'historias increíbles', 'true crime español', 'documental historia', 'misterios sin resolver', 'datos del universo', 'finanzas personales', 'psicología explicada', 'meditación dormir', 'mitología explicada', 'civilizaciones antiguas', 'historias de terror'],
    pt: ['top 10 curiosidades', 'histórias incríveis', 'true crime português', 'documentário história', 'mistérios sem solução', 'fatos do universo', 'finanças pessoais', 'psicologia explicada', 'meditação para dormir', 'mitologia explicada', 'civilizações antigas', 'histórias de terror'],
    de: ['top 10 fakten', 'unglaubliche geschichten', 'true crime deutsch', 'geschichte dokumentation', 'mysterien erklärt', 'weltraum fakten', 'finanzen tipps', 'psychologie fakten', 'schlafmeditation', 'mythologie erklärt', 'antike zivilisationen', 'horror geschichten'],
    fr: ['top 10 faits', 'histoires incroyables', 'true crime français', 'documentaire histoire', 'mystères inexpliqués', 'faits espace', 'finances personnelles', 'psychologie expliquée', 'méditation sommeil', 'mythologie expliquée', 'civilisations anciennes', 'histoires horreur'],
    it: ['top 10 fatti', 'storie incredibili', 'true crime italiano', 'documentario storia', 'misteri irrisolti', 'fatti spazio', 'finanza personale', 'psicologia spiegata', 'meditazione sonno', 'mitologia spiegata', 'civiltà antiche', 'storie horror'],
    nl: ['top 10 feiten', 'ongelooflijke verhalen', 'true crime nederlands', 'documentaire geschiedenis', 'mysteries onopgelost', 'ruimte feiten', 'persoonlijke financiën', 'psychologie uitgelegd', 'slaap meditatie', 'mythologie uitgelegd', 'antieke beschavingen'],
    sv: ['top 10 fakta', 'otroliga berättelser', 'true crime svenska', 'historia dokumentär', 'mysterier olösta', 'rymdfakta', 'personlig ekonomi', 'psykologi förklarad', 'sömn meditation', 'mytologi förklarad', 'antika civilisationer'],
    no: ['topp 10 fakta', 'utrolige historier', 'true crime norsk', 'historie dokumentar', 'mysterier uløst', 'rom fakta', 'personlig økonomi', 'psykologi forklart', 'søvnmeditasjon', 'mytologi forklart', 'antikke sivilisasjoner'],
    da: ['top 10 fakta', 'utrolige historier', 'true crime dansk', 'historie dokumentar', 'mysterier uopklarede', 'rumfakta', 'personlig økonomi', 'psykologi forklaret', 'søvnmeditation', 'mytologi forklaret', 'antikke civilisationer'],
    ja: ['雑学 トップ10', '都市伝説', '怖い話', '歴史 ドキュメンタリー', '宇宙の謎', '不思議な話', '投資 初心者', '心理学 解説', '睡眠 瞑想', '神話 解説', '古代文明', 'ホラー 物語']
  };

  var ARBITRAGE_MARKETS = {
    en: { gl: 'US', hl: 'en', label: 'USA', language: 'English' },
    es: { gl: 'MX', hl: 'es', label: 'Mexico', language: 'Spanish' },
    de: { gl: 'DE', hl: 'de', label: 'Germany', language: 'German' },
    pt: { gl: 'BR', hl: 'pt', label: 'Brazil', language: 'Portuguese' }
  };

  function queriesFor(hl) {
    var code = String(hl || 'en').toLowerCase().split('-')[0];
    return (NSP_FACELESS_QUERIES_BY_LANG[code] || NSP_FACELESS_QUERIES_BY_LANG.en).slice();
  }

  root.NSP_FACELESS_QUERIES_BY_LANG = NSP_FACELESS_QUERIES_BY_LANG;
  root.NSP_MARKETS = { queries: NSP_FACELESS_QUERIES_BY_LANG, arbitrage: ARBITRAGE_MARKETS, queriesFor: queriesFor };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
