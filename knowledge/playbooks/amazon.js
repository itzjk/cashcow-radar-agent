(function (root) {
  var KDP = 'KDP Help';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    bsr: src('Amazon Best Sellers Rank', 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GGGMZK378RQPATDJ', 'Amazon Customer Service'),
    conditions: src('Conditions of Use', 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GLSBYFE9MGKKQXXM', 'Amazon'),
    pricing: src('How much does it cost to sell on Amazon?', 'https://sell.amazon.com/pricing', 'Sell on Amazon'),
    keywords: src('Make Your Book More Discoverable with Keywords', 'https://kdp.amazon.com/en_US/help/topic/G201298500', KDP),
    ebook: src('eBook Royalties', 'https://kdp.amazon.com/en_US/help/topic/G200644210', KDP),
    ebookPrice: src('eBook List Price Requirements', 'https://kdp.amazon.com/en_US/help/topic/G200634560', KDP),
    paperback: src('Paperback Royalty', 'https://kdp.amazon.com/en_US/help/topic/G201834330', KDP)
  };

  var MODULES = [
    {
      id: 'a1-market',
      title: 'Read a market before you enter',
      goal: 'Leave knowing how hard a search is to enter, read from the products that lead it.',
      lessons: [
        {
          id: 'a1-l1-rank',
          title: 'Read the Best Sellers Rank for what it is',
          why: 'Amazon calculates the Best Sellers Rank from Amazon sales, updates it frequently from recent and historical sales, and shows category and subcategory ranks where an item stands out, so a rank compares items, it is not a count of sales.',
          steps: [
            'Open the products that lead your search and read each one with ZERACK: rank, category ranks, rating, ratings and release date.',
            'Compare ranks only inside the same subcategory.',
            'Read the same products again next week: a rank that keeps its place is steady demand, one that jumps may be a single promotion.',
            'Treat every sales figure ZERACK derives from a rank as an estimate.'
          ],
          doNow: 'Read the top five products of your search and write their subcategory ranks.',
          proof: 'Five products with rank, subcategory and date read.',
          surfaces: ['an Amazon product page'],
          sources: [S.bsr]
        },
        {
          id: 'a1-l2-room',
          title: 'Find room next to the leaders',
          why: 'The search page shows for every result its price, its rating, its number of ratings and, when Amazon shows it, how many bought it in the past month, so it tells apart a market held by a few products with thousands of ratings from one where young products still sell.',
          steps: [
            'Read the search with ZERACK: price band, ratings, the bought-in-past-month labels and the sponsored results.',
            'Count the results that sell with few ratings: that is the room left.',
            'Leave aside sponsored results when you judge demand; they are paid placement.',
            'Enter where products with under a few hundred ratings still show purchase labels.'
          ],
          doNow: 'Read one search and write how many results sell with fewer than 500 ratings.',
          proof: 'The count, the price band and the three best-selling young products.',
          surfaces: ['an Amazon search'],
          sources: [S.bsr]
        }
      ]
    },
    {
      id: 'a2-kdp',
      title: 'Publish with Kindle Direct Publishing',
      goal: 'Leave with seven keywords readers type and a price that keeps the higher royalty.',
      lessons: [
        {
          id: 'a2-l1-keywords',
          title: 'Pick the seven keywords readers type',
          why: 'KDP takes up to seven keywords or short phrases, asks you to think like a reader and test them in Amazon search, and lists what to avoid: words already in the title or categories, claims of quality, time-sensitive words, brands you do not own and program names like Kindle Unlimited.',
          steps: [
            'Write twenty phrases a reader would type: setting, character types, roles, themes and tone.',
            'Cross out every word already in your title or categories.',
            'Search each phrase on Amazon and keep the ones whose results look like your book.',
            'Fill the seven boxes; then press Save and Continue and Publish yourself.'
          ],
          doNow: 'Write twenty phrases, test them, and keep seven.',
          proof: 'The seven keywords and the search you tested each one with.',
          surfaces: [],
          sources: [S.keywords]
        },
        {
          id: 'a2-l2-royalty',
          title: 'Price for the royalty',
          why: 'An eBook earns 35% or 70% of the list price; since July 7, 2026 the 70% option covers list prices from $2.99 to $12.99 on Amazon.com and subtracts a delivery cost that averages $0.06; a paperback earns 60% at $9.99 or more and 50% below, minus printing, so a $15, 333-page black ink paperback leaves (0.60 x $15) - $5.00 = $4.00.',
          steps: [
            'Choose the format and the list price.',
            'For an eBook, stay inside $2.99 to $12.99 to keep the 70% option.',
            'For a paperback, take the printing cost from the KDP calculator.',
            'Work out what each sale leaves with the break-even tool before you publish.'
          ],
          doNow: 'Work out the royalty of your book at two prices with the break-even tool.',
          proof: 'The two prices and what each sale leaves.',
          surfaces: ['the break-even tool'],
          sources: [S.ebook, S.ebookPrice, S.paperback]
        }
      ]
    },
    {
      id: 'a3-seller',
      title: 'Sell as a seller, inside the rules',
      goal: 'Leave knowing what the selling plan costs you and what ZERACK will and will not do on Amazon.',
      lessons: [
        {
          id: 'a3-l1-plan',
          title: 'Know what the selling plan costs',
          why: 'Amazon charges $0.99 per item sold on the Individual plan or $39.99 a month on the Professional plan, plus a referral fee per item that depends on the product category, a percentage of the total price or a minimum amount, whichever is greater.',
          steps: [
            'Count the items you sell a month: above about 40, the Professional plan costs less than $0.99 each.',
            'Look up the referral fee of your category on the pricing page.',
            'Give ZERACK your price, cost and referral fee: it works out what each sale leaves.',
            'Add advertising only after the margin is known.'
          ],
          doNow: 'Work out your cost per sale on both plans.',
          proof: 'Items a month, the plan that costs less, and the margin per sale.',
          surfaces: ['the break-even tool'],
          sources: [S.pricing]
        },
        {
          id: 'a3-l2-rules',
          title: 'Stay inside Amazon\'s rules',
          why: 'Amazon\'s Conditions of Use exclude any use of data mining, robots or similar data gathering and extraction tools, so ZERACK reads only the page you have open, when you ask, never walks through listings on its own, and you press Publish, Launch or Buy yourself.',
          steps: [
            'Open each product or search yourself.',
            'Ask ZERACK to read that page once.',
            'Keep what it read; it compares the next time you read the same page.',
            'Every publish, campaign and purchase waits for your press.'
          ],
          doNow: 'Read one product this way and keep the reading.',
          proof: 'The saved reading with its date.',
          surfaces: ['an Amazon product page'],
          sources: [S.conditions]
        }
      ]
    }
  ];

  var KDP_REPORT = { title: ['title'], asin: ['asin', 'asin/isbn', 'isbn'], units: ['units sold', 'net units sold', 'units', 'orders'], kenp: ['kenp read', 'kenp', 'kindle edition normalized pages'], royalty: ['royalty', 'estimated royalty'], marketplace: ['marketplace'] };
  var KDP_TYPES = { units: 'int', kenp: 'int', royalty: 'money' };
  var BUSINESS = { asin: ['(child) asin', 'child asin', 'asin', '(parent) asin'], title: ['title'], sessions: ['sessions - total', 'sessions', 'sessions total'], unitSession: ['unit session percentage', 'unit session percentage - b2b'], units: ['units ordered'], sales: ['ordered product sales'] };
  var BUSINESS_TYPES = { sessions: 'int', unitSession: 'pct', units: 'int', sales: 'money' };

  var RETAIL = /(^|\.)amazon\.(com|ca|co\.uk|de|fr|it|es|nl|se|pl|ie|com\.mx|com\.au|com\.br|co\.jp|in|com\.be)$/;

  var PLAYBOOK = {
    id: 'amazon',
    name: 'Amazon',
    title: 'Sell on Amazon and publish on KDP',
    business: 'a product or a book sold on Amazon',
    sourceOwner: 'Amazon',
    updated: '2026-09-27',
    hosts: [
      { host: /^kdp\.amazon\.com$/ },
      { host: /^sellercentral(-europe|-japan)?\.amazon\.[a-z.]+$/ },
      { host: /^advertising\.amazon\.com$/ },
      { host: RETAIL }
    ],
    named: /\b(?:amazon|kdp|kindle direct|best sellers? rank|bsr|seller central|fba|asin)\b/,
    identity: 'You are ZERACK, the operator for Amazon sellers and KDP authors. You read the search, the product pages and the reports the user opens, judge how hard a market is to enter, work out what each sale leaves, and prepare listings and keywords. The user presses Publish. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for Amazon sellers and KDP authors who thinks in rank, room in the market and royalty per sale.',
    bottlenecks: 'a market held by products with thousands of ratings, keywords readers never type, a price outside the higher royalty band, a margin eaten by fees, or ads bought before the margin is known',
    assume: 'assume a small seller or a self-published author selling on Amazon.com in US dollars, and that the page on screen is their market or their own report',
    hints: [
      [/\b(?:bsr|best sellers? rank|rank\w*|ranking)\b/, 'a1-l1'],
      [/\b(?:niche|nicho|market|mercado|enter|entrar|competition|competencia|room|saturad\w*)\b/, 'a1-l2'],
      [/\b(?:keywords?|palabras clave|seven|siete|categor\w*)\b/, 'a2-l1'],
      [/\b(?:royalt\w*|regalias?|price|precio|paperback|ebook|kindle)\b/, 'a2-l2'],
      [/\b(?:fees?|comision|referral|plan|professional|individual|margin|margen)\b/, 'a3-l1'],
      [/\b(?:rules|reglas|terms|scrap\w*|bots?)\b/, 'a3-l2']
    ],
    readers: [
      { id: 'amazon.product', host: RETAIL, path: /\/(dp|gp\/product)\/[A-Z0-9]{10}/, label: 'an Amazon product page: price, rating, ratings, Best Sellers Rank with its categories, release date and the bought-in-past-month label' },
      { id: 'amazon.search', host: RETAIL, path: /^\/s(\/|$)/, label: 'an Amazon search: every result with its price, rating, ratings, bought-in-past-month label and whether it is sponsored' },
      { id: 'table', as: 'kdp.reports', host: /^kdp\.amazon\.com$/, path: /report/, label: 'a KDP report table: title, units, pages read and royalty', opts: { as: 'kdp.reports', label: 'KDP report', columns: KDP_REPORT, need: ['title'], types: KDP_TYPES, linkField: 'title' } },
      { id: 'table', as: 'seller.business', host: /^sellercentral(-europe|-japan)?\.amazon\.[a-z.]+$/, label: 'a Seller Central business report: ASIN, sessions, unit session percentage, units ordered and sales', opts: { as: 'seller.business', label: 'Business report', columns: BUSINESS, need: ['asin'], types: BUSINESS_TYPES, linkField: 'asin' } }
    ],
    surfaces: {
      'an Amazon product page': 'zerackExtract with reader amazon.product reads price, rating, ratings, the Best Sellers Rank with its categories and the release date',
      'an Amazon search': 'zerackExtract with reader amazon.search reads every result and says how much room young products still have',
      'the break-even tool': 'zerackBreakEven works out the KDP royalty of an eBook or paperback, or the seller margin with the plan and the referral fee'
    },
    gate: {
      press: [
        { kind: 'Publish', re: /^(publish( your)?( kindle)?( ebook| paperback| hardcover| book)?|save and publish|submit for review|update (the |your )?listing)\b/ },
        { kind: 'Pay', re: /^(launch campaign|create campaign|set (the |your )?(daily )?budget|increase (the )?bid|buy now)\b/ }
      ],
      never: [
        { why: 'it moves money out or closes the selling account', re: /^(request (a )?(disbursement|transfer|payment)|disburse( funds)?|close (my |your |the )?(account|selling account))\b/, link: true }
      ]
    },
    readOnly: [],
    private: [
      { host: RETAIL, path: /^\/gp\/(css|your-account|buy|cart)|^\/your-orders|^\/cpe\/yourpayments|^\/ap\/|^\/hz\/mycd|^\/a\/addresses/, why: 'your orders, payments, addresses and sign-in stay with you' },
      { host: /^sellercentral(-europe|-japan)?\.amazon\.[a-z.]+$/, path: /^\/(payments|tax|settings|sw\/AccountInfo|account-info)/i, why: 'payments, tax and account settings stay with you' },
      { host: /^kdp\.amazon\.com$/, path: /\/(account|payments|tax)(\/|$|\?)/, why: 'payments, tax and account settings stay with you' }
    ],
    terms: { pace: true, rule: 'Amazon\'s Conditions of Use exclude data mining, robots and similar data gathering and extraction tools, so ZERACK reads only the page you have open, when you ask, and never walks through listings on its own', source: S.conditions },
    fees: {
      model: 'amazon',
      currency: 'USD',
      checked: '2026-09-27',
      note: 'Amazon.com. Referral fees depend on the category and are not guessed: the user gives the percentage from the pricing page. Rank-based sales are estimates.',
      plans: { individual: { label: 'Individual', perItem: 0.99, monthly: 0 }, professional: { label: 'Professional', perItem: 0, monthly: 39.99 } },
      ebook: { low: 0.35, high: 0.70, band: [2.99, 12.99], delivery: 0.06, source: S.ebook, bandSource: S.ebookPrice },
      paperback: { low: 0.50, high: 0.60, threshold: 9.99, source: S.paperback },
      source: S.pricing
    },
    chips: ['Is this search worth entering?', 'What does my book leave per sale?', 'Give me 7 KDP keywords for my book', 'How do these products compare?'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_AMAZON', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
