(function (root) {
  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    gumroad: src('Gumroad\'s fees', 'https://gumroad.com/help/article/66-gumroads-fees', 'Gumroad Help Center'),
    ratings: src('Product ratings and reviews', 'https://gumroad.com/help/article/222-product-ratings-on-gumroad', 'Gumroad Help Center'),
    lemon: src('Pricing', 'https://www.lemonsqueezy.com/pricing', 'Lemon Squeezy'),
    payhip: src('Pricing', 'https://payhip.com/pricing', 'Payhip'),
    stripe: src('Pricing and fees', 'https://stripe.com/pricing', 'Stripe'),
    talk: src('How to talk to users, Eric Migicovsky', 'https://www.ycombinator.com/library/Iq-how-to-talk-to-users', 'Y Combinator Startup Library')
  };

  var MODULES = [
    {
      id: 'd1-price',
      title: 'Price a digital product',
      goal: 'Leave with the platform and plan that keep the most at your volume, and a price chosen by a test.',
      lessons: [
        {
          id: 'd1-l1-fees',
          title: 'Know what each platform keeps',
          why: 'Gumroad charges 10% plus $0.50 per sale on its own site, card processing of 2.9% plus $0.30 on top, and a flat 30% on sales that come through its Discover marketplace; Lemon Squeezy charges 5% plus 50 cents per transaction; Payhip charges 5% on the free plan, 2% on Plus at $29 a month and nothing on Pro at $99 a month, with PayPal or Stripe fees on top.',
          steps: [
            'Write your price and how many sales you make in a month.',
            'Work out what one sale leaves on each platform with the break-even tool.',
            'On Payhip, Plus pays for itself once the 3% it saves covers $29 a month, about $967 of sales; Pro beats Plus once 2% covers the extra $70, about $3,500.',
            'Move only when the difference is worth the switch.'
          ],
          doNow: 'Work out what one sale leaves on your platform and on one other.',
          proof: 'Both amounts at your price and your monthly sales.',
          surfaces: ['the break-even tool'],
          sources: [S.gumroad, S.lemon, S.payhip, S.stripe]
        },
        {
          id: 'd1-l2-test',
          title: 'Test the price with views and sales',
          why: 'A price is right when it earns more per visitor, and the dashboards show views and sales for each product, so two prices can be compared by sales per view and by what each sale leaves.',
          steps: [
            'Run one price for a set period, then the other for the same length of time.',
            'Read the views and sales of each period from the dashboard with ZERACK.',
            'Compare them with ZERACK: it says when there are enough views to trust the result.',
            'Keep the price that leaves more per visitor, not the one that sells more copies.'
          ],
          doNow: 'Write the views and sales of your product for the last 30 days.',
          proof: 'Views, sales and sales per view.',
          surfaces: ['the price test', 'a sales dashboard'],
          sources: [S.gumroad]
        }
      ]
    },
    {
      id: 'd2-sell',
      title: 'Sell the next product',
      goal: 'Leave with the proof a rival page shows and the next product people are already asking for.',
      lessons: [
        {
          id: 'd2-l1-proof',
          title: 'Read the proof on a rival page',
          why: 'Gumroad shows ratings on the product page and the profile, customers can rate a product within one year of buying it, and a creator can choose to hide ratings, so a page with many ratings shows buyers, and a page without them may have hidden them.',
          steps: [
            'Open the rival product and read it with ZERACK: price, ratings, the average and the tiers.',
            'Read three rivals in the same topic.',
            'Write the price band and what the best rated one includes that the others do not.',
            'Build your next product around what is missing, not around a lower price.'
          ],
          doNow: 'Read three rival products and write the price band.',
          proof: 'The band, the rating counts and the one thing the best rated includes.',
          surfaces: ['a Gumroad product page'],
          sources: [S.ratings]
        },
        {
          id: 'd2-l2-demand',
          title: 'Build what people already ask for',
          why: 'Eric Migicovsky teaches to ask people about the problem and the last time they hit it, not about your product; the requests people repeat in threads and reviews are that problem in their own words, and ZERACK counts them across every thread you read.',
          steps: [
            'Read the threads where your buyers ask questions: Reddit, Hacker News or the comments of a rival.',
            'Ask ZERACK which request repeats.',
            'Write the next product as the answer to the request with the most people behind it.',
            'Answer the people asking once, by hand, when your product is ready.'
          ],
          doNow: 'Read two threads in your topic and ask which request repeats.',
          proof: 'The request, its count and two links.',
          surfaces: ['a launch thread'],
          sources: [S.talk]
        }
      ]
    }
  ];

  var GUMROAD_TILES = { sales: ['sales'], views: ['views'], revenue: ['total', 'revenue', 'net total', 'gross'], conversion: ['conversion', 'conversion rate'] };
  var GUMROAD_TYPES = { sales: 'int', views: 'int', revenue: 'money', conversion: 'pct' };
  var LEMON_TILES = { revenue: ['total revenue', 'revenue'], orders: ['orders', 'sales'], customers: ['customers', 'new customers'], mrr: ['mrr', 'monthly recurring revenue'], refunds: ['refunds'] };
  var LEMON_TYPES = { revenue: 'money', orders: 'int', customers: 'int', mrr: 'money', refunds: 'int' };

  var PLAYBOOK = {
    id: 'digital',
    name: 'Digital products',
    title: 'Sell digital products on Gumroad, Lemon Squeezy or Payhip',
    agent: { name: 'Digital products agent', does: 'Reads Gumroad, Lemon Squeezy and Payhip; works out what each sale leaves per platform and tests prices with real sales.', sites: ['gumroad.com', 'lemonsqueezy.com', 'payhip.com'] },
    business: 'digital products sold on Gumroad, Lemon Squeezy or Payhip',
    sourceOwner: 'Gumroad, Lemon Squeezy, Payhip and Stripe',
    updated: '2026-09-27',
    hosts: [{ host: /(^|\.)gumroad\.com$/ }, { host: /(^|\.)lemonsqueezy\.com$/ }, { host: /^(www\.)?payhip\.com$/ }],
    named: /\b(?:gumroad|lemon ?squeezy|payhip|digital products?|productos? digitales?|notion templates?|plantillas de notion)\b/,
    identity: 'You are the ZERACK Digital products agent, the operator for creators who sell digital products on Gumroad, Lemon Squeezy or Payhip. You read the product pages and dashboards on screen, work out what each sale leaves on each platform, test prices with real views and sales, and find the next product people ask for. The user presses Publish. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK\'s Digital products agent, a brutally honest operator for digital product sellers who thinks in sales per view and what each sale leaves.',
    bottlenecks: 'a page nobody visits, visitors who do not buy, a price chosen by guess, a platform that keeps too much at this volume, or a next product nobody asked for',
    assume: 'assume a solo creator selling a template, a guide or a course in US dollars, and that the page on screen is their product, their dashboard or a rival',
    hints: [
      [/\b(?:fees?|comision\w*|platform|plataforma|keeps?|se queda|plan|payhip|lemon)\b/, 'd1-l1'],
      [/\b(?:price|precio|pricing|test|prueba|conversion)\b/, 'd1-l2'],
      [/\b(?:rivals?|competitors?|competencia|ratings?|valoraciones)\b/, 'd2-l1'],
      [/\b(?:next product|siguiente producto|what to build|que crear|demand|demanda|requests?)\b/, 'd2-l2']
    ],
    readers: [
      { id: 'tiles', as: 'gumroad.analytics', host: /^(app\.)?gumroad\.com$/, path: /^\/(analytics|dashboard|sales)/, label: 'the Gumroad analytics dashboard: views, sales, conversion and revenue', opts: { as: 'gumroad.analytics', label: 'Gumroad analytics', tiles: GUMROAD_TILES, types: GUMROAD_TYPES } },
      { id: 'tiles', as: 'lemonsqueezy.home', host: /^app\.lemonsqueezy\.com$/, label: 'the Lemon Squeezy dashboard: revenue, orders, customers, MRR and refunds', opts: { as: 'lemonsqueezy.home', label: 'Lemon Squeezy dashboard', tiles: LEMON_TILES, types: LEMON_TYPES } },
      { id: 'gumroad.product', host: /(^|\.)gumroad\.com$/, path: /^\/l\/|^\/[^\/]+\/p\//, label: 'a Gumroad product page, yours or a rival: price, pay what you want, ratings and their average, tiers and sales when shown' }
    ],
    surfaces: {
      'the break-even tool': 'zerackBreakEven works out what one sale leaves on Gumroad, Gumroad Discover, Lemon Squeezy or each Payhip plan',
      'the price test': 'zerackDecide with kind ab compares two prices by views and sales and says when there is enough to trust',
      'a sales dashboard': 'zerackExtract with reader gumroad.analytics or lemonsqueezy.home reads the dashboard numbers on screen',
      'a Gumroad product page': 'zerackExtract with reader gumroad.product reads price, ratings and tiers from the page data',
      'a launch thread': 'zerackExtract with reader reddit.thread or hn.item reads it; zerackBuilder requests groups what repeats'
    },
    gate: {
      press: [
        { kind: 'Publish', re: /^(publish( and continue)?|save and continue|save changes|update product|create (a |the )?(discount|offer code|coupon)|add (a )?(discount|offer code|coupon)|save (the )?(discount|offer code))\b/ },
        { kind: 'Send', re: /^(send (an? )?(email|update|post|workflow)|email (your )?(customers|followers|audience)|publish (and|&) send)\b/ }
      ],
      never: [
        { why: 'it changes where your earnings are paid or closes the account', re: /^(payout settings|payment settings|delete (my |your )?account|deactivate (my |your )?account)\b/, link: true }
      ]
    },
    readOnly: [],
    private: [
      { host: /(^|\.)gumroad\.com$/, path: /^\/settings(\/|$)/, why: 'payouts, password and settings stay with you' },
      { host: /^app\.lemonsqueezy\.com$/, path: /^\/settings(\/|$)/, why: 'payouts, API keys and settings stay with you' },
      { host: /^(www\.)?payhip\.com$/, path: /^\/account(\/|$)|^\/settings(\/|$)/, why: 'payouts and settings stay with you' }
    ],
    fees: {
      model: 'plans',
      currency: 'USD',
      checked: '2026-09-27',
      note: 'Card sales in US dollars on a US account; PayPal, other currencies and taxes can add fees.',
      defaultPlan: 'gumroad',
      plans: {
        gumroad: { label: 'Gumroad, direct sale', monthly: 0, lines: [
          { label: 'Gumroad, 10% plus $0.50', rate: 0.10, fixed: 0.50, source: S.gumroad },
          { label: 'Card processing, 2.9% plus $0.30', rate: 0.029, fixed: 0.30, source: S.gumroad }
        ] },
        discover: { label: 'Gumroad, sale from Discover', monthly: 0, lines: [
          { label: 'Gumroad Discover, flat 30% including processing', rate: 0.30, source: S.gumroad }
        ] },
        lemonsqueezy: { label: 'Lemon Squeezy', monthly: 0, lines: [
          { label: 'Lemon Squeezy, 5% plus 50 cents', rate: 0.05, fixed: 0.50, source: S.lemon }
        ] },
        payhip: { label: 'Payhip Free', monthly: 0, lines: [
          { label: 'Payhip Free, 5%', rate: 0.05, source: S.payhip },
          { label: 'Stripe card fee, 2.9% plus $0.30', rate: 0.029, fixed: 0.30, source: S.stripe }
        ] },
        'payhip-plus': { label: 'Payhip Plus', monthly: 29, lines: [
          { label: 'Payhip Plus, 2%', rate: 0.02, source: S.payhip },
          { label: 'Stripe card fee, 2.9% plus $0.30', rate: 0.029, fixed: 0.30, source: S.stripe }
        ] },
        'payhip-pro': { label: 'Payhip Pro', monthly: 99, lines: [
          { label: 'Payhip Pro, no transaction fee', rate: 0, source: S.payhip },
          { label: 'Stripe card fee, 2.9% plus $0.30', rate: 0.029, fixed: 0.30, source: S.stripe }
        ] }
      }
    },
    chips: ['What does a $29 sale leave on each platform?', 'Which Payhip plan pays off at my sales?', 'What do rival products charge?', 'Is my new price working?'],
    modules: MODULES,
    sources: S
  };

  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
    }
    return o;
  }

  Object.defineProperty(root, 'NSP_PLAYBOOK_DIGITAL', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
