(function (root) {
  var HELP = 'Etsy Help';
  var HANDBOOK = 'Etsy Seller Handbook';
  var RULES = 'Etsy House Rules';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    fees: src('Fees & Payments Policy', 'https://www.etsy.com/legal/fees/', RULES),
    feeBasics: src('Etsy Fee Basics', 'https://help.etsy.com/hc/en-us/articles/360035902374-Etsy-Fee-Basics', HELP),
    processing: src('What are Payment Processing Fees for Selling on Etsy?', 'https://help.etsy.com/hc/en-us/articles/115015628847-What-are-Payment-Processing-Fees-for-Selling-on-Etsy', HELP),
    offsite: src('How Etsy\'s Offsite Ads Work', 'https://help.etsy.com/hc/en-us/articles/360000338367-How-Etsy-s-Offsite-Ads-Work', HELP),
    searchWorks: src('How Etsy Search Works', 'https://www.etsy.com/seller-handbook/article/375461474487', HANDBOOK),
    titles: src('New Guidance for Listing Titles, and a Tool to Help', 'https://www.etsy.com/seller-handbook/article/1399426136697', HANDBOOK),
    keywords: src('Keywords 101: Everything You Need to Know', 'https://www.etsy.com/seller-handbook/article/382774281517', HANDBOOK),
    checklist: src('Checklist: Optimize Your Shop for Etsy Search', 'https://www.etsy.com/seller-handbook/article/366470356778', HANDBOOK),
    shippingSearch: src('We\'re Updating How Shipping Price Is Factored Into Search for US Domestic Listings', 'https://www.etsy.com/seller-handbook/article/1293023712519', HANDBOOK),
    freeShipping: src('Get Priority Placement in US Search with a Free Shipping Guarantee', 'https://www.etsy.com/seller-handbook/article/540244125961', HANDBOOK),
    visibility: src('How to Use the Etsy Search Visibility Page', 'https://help.etsy.com/hc/en-us/articles/25869947521175-How-to-Use-the-Etsy-Search-Visibility-Page', HELP),
    starSeller: src('What is the "Star Seller" Badge?', 'https://help.etsy.com/hc/en-us/articles/4403058372503-What-is-the-Star-Seller-Badge', HELP),
    anatomy: src('The Anatomy of a Well-Crafted Etsy Listing', 'https://www.etsy.com/seller-handbook/article/1347574487014', HANDBOOK)
  };

  var MODULES = [
    {
      id: 'e1-search',
      title: 'Get found in Etsy search',
      goal: 'Leave with a listing that matches the words buyers type and a shipping price that search rewards.',
      lessons: [
        {
          id: 'e1-l1-read-the-page',
          title: 'Read the search page before you list',
          why: 'Etsy search first matches the query against titles, tags, attributes and categories, then ranks the matches by how buyers acted on them: clicks, favorites and purchases after seeing a listing count toward its listing quality score.',
          steps: [
            'Search your product on etsy.com in the words a buyer would type, not the name you gave it.',
            'Read every card on the first page: price, review count, rating, Star Seller, free shipping and the Ad by Etsy seller label.',
            'Count the ads: those spots were bought, so they say what sellers pay for, not what buyers chose.',
            'Write the median price and the price of the three cards with the most reviews: that is the band buyers already trust.',
            'Decide where your listing sits against that band before you touch its title.'
          ],
          doNow: 'Read the search page for your main product and write the median price, the number of ads, and the three titles with the most reviews.',
          proof: 'One note with the median price, the ad count and three titles, dated today.',
          surfaces: ['an Etsy search or category page'],
          sources: [S.searchWorks, S.checklist]
        },
        {
          id: 'e1-l2-title',
          title: 'Write the title Etsy now asks for',
          why: 'Etsy asks for titles that clearly state the item with the most important traits first, and suggests fewer than 15 words; search engines show only the first 50 to 60 characters of a page title.',
          steps: [
            'Start with what the item is, in the words a buyer types: "ceramic mug", not "gift for her".',
            'Put the traits that decide the purchase next: color, material, size.',
            'Keep it under 15 words and check that the first 60 characters still say what the item is.',
            'Move the synonyms and occasions out of the title and into tags and attributes, which Etsy search also reads.',
            'Compare your new title with the titles of the cards with the most reviews on your search page.'
          ],
          doNow: 'Rewrite your weakest listing title with the item first and its three deciding traits next, under 15 words.',
          proof: 'The old and the new title side by side, with the new one under 15 words.',
          surfaces: ['an Etsy search or category page', 'the Etsy listing editor'],
          sources: [S.titles, S.keywords, S.searchWorks]
        },
        {
          id: 'e1-l3-tags',
          title: 'Use all 13 tags and every attribute',
          why: 'Etsy says that using all 13 tags, varying them, filling every relevant attribute and choosing the most specific category may help a listing match more queries; each tag holds up to 20 characters.',
          steps: [
            'List the phrases buyers use for the item, including the ones you took out of the title.',
            'Fill all 13 tags with multi word phrases of up to 20 characters, with no two tags saying the same thing.',
            'Fill every attribute Etsy offers for the category, such as color, material, occasion and size.',
            'Pick the deepest category that is true for the item.',
            'Re-read the tags against your search page: every tag should be a phrase a buyer would type.'
          ],
          doNow: 'Open one listing and fill any empty tag slots and attributes until all 13 tags are used.',
          proof: 'The listing with 13 tags and every attribute filled.',
          surfaces: ['the Etsy listing editor'],
          sources: [S.searchWorks, S.keywords, S.checklist]
        },
        {
          id: 'e1-l4-shipping-price',
          title: 'Price shipping the way search rewards it',
          why: 'Etsy prioritizes US listings whose domestic shipping price is under $6 in search, with exceptions such as calculated shipping, and gives priority placement in US search to items that ship free or shops with a free shipping guarantee on US orders of $35 or more.',
          steps: [
            'Check the domestic shipping price of every US listing.',
            'Where it is $6 or more, move part of the shipping cost into the item price; Etsy offers a tool for this on the Search visibility page.',
            'Work out whether a free shipping guarantee on orders of $35 or more still leaves a margin once the cost sits in the price.',
            'Re-check the result with the break-even numbers from the fees lesson before you save.'
          ],
          doNow: 'List every listing with domestic shipping of $6 or more and the item price it would need to ship for less.',
          proof: 'A list of listings with their current shipping and the new split of price and shipping.',
          surfaces: ['the Etsy listing editor', 'the Etsy Search visibility page'],
          sources: [S.shippingSearch, S.freeShipping, S.visibility]
        }
      ]
    },
    {
      id: 'e2-convert',
      title: 'Turn views into orders',
      goal: 'Leave with the listing quality and service record that search and buyers reward.',
      lessons: [
        {
          id: 'e2-l1-listing-quality',
          title: 'Fix what the Search visibility page flags',
          why: 'Etsy search weighs the shop, customer service and listing quality; a new listing missing photos or a return policy can lose visibility at once, and priority placement asks for a high resolution primary photo of about 2000 pixels or more showing the single finished item, not a collage.',
          steps: [
            'Open Shop Manager, then the Search visibility page, and list every listing it flags.',
            'Replace any primary photo under about 2000 pixels, or any collage, with one photo of the finished item.',
            'Add a return policy where one is missing.',
            'Fix the flagged listings with the most views first, since they lose the most orders.'
          ],
          doNow: 'Fix the first three listings the Search visibility page flags, starting with the one with the most views.',
          proof: 'Three listings no longer flagged on the Search visibility page.',
          surfaces: ['the Etsy Search visibility page', 'the Etsy listing editor'],
          sources: [S.visibility, S.anatomy]
        },
        {
          id: 'e2-l2-star-seller',
          title: 'Earn the Star Seller badge',
          why: 'Star Seller shows on listings and in search; Etsy grants it monthly to shops that answer 95% of first messages within 24 hours, ship 95% of orders on time with tracking, hold a 4.8 average rating, and have at least 5 orders and $300 in sales over three months.',
          steps: [
            'Read your Star Seller progress in Shop Manager: messages, shipping, rating, orders and sales.',
            'Find the one criterion that is short and fix that one first.',
            'For messages, answer every first message within 24 hours, even with a short holding reply.',
            'For shipping, buy labels on Etsy or add tracking and ship inside your stated processing time.',
            'Check again on the 1st of next month, when Etsy looks back over the last three months.'
          ],
          doNow: 'Write which Star Seller criterion your shop misses and by how much.',
          proof: 'One line with the criterion, the current number and the target.',
          surfaces: [],
          sources: [S.starSeller]
        }
      ]
    },
    {
      id: 'e3-margin',
      title: 'Keep the money',
      goal: 'Leave knowing what each sale leaves after Etsy fees and ads, and the price that covers it.',
      lessons: [
        {
          id: 'e3-l1-fees',
          title: 'Know what a sale leaves you',
          why: 'Each listing costs $0.20 and renews for another $0.20 when a sale leaves stock, every sale pays a 6.5% transaction fee on the total order including shipping and gift wrap, and in the US a payment processing fee of 3% plus $0.25; a price that ignores them loses money quietly.',
          steps: [
            'Write the item price, the shipping you charge, and what the item and its shipping cost you.',
            'Take 6.5% of price plus shipping, 3% plus $0.25 for processing, and $0.20 for the listing.',
            'Subtract fees and costs from what the buyer pays: that is your margin per sale.',
            'If you advertise, the most you can spend per sale is that margin; spend above it loses money on every order.'
          ],
          doNow: 'Work out the margin per sale of your best selling listing with the break-even tool.',
          proof: 'One line with price, fees, cost and margin per sale.',
          surfaces: ['the break-even tool'],
          sources: [S.fees, S.feeBasics, S.processing]
        },
        {
          id: 'e3-l2-offsite-ads',
          title: 'Count Offsite Ads before they count you',
          why: 'An order Etsy attributes to an Offsite Ad pays 15% of the order total, or 12% once the shop has sold $10,000 in any 365 days, capped at $100 per order; above $10,000 the program is mandatory.',
          steps: [
            'Check whether your shop has passed $10,000 in sales in any 365 day period.',
            'Add the Offsite Ads fee to the break-even for the share of orders that come through those ads.',
            'If you are under $10,000 and a 15% fee wipes out the margin, decide whether to stay in the program.',
            'Re-check after any price change.'
          ],
          doNow: 'Run the break-even for your best selling listing with and without the Offsite Ads fee.',
          proof: 'Two margins per sale, with and without the fee.',
          surfaces: ['the break-even tool'],
          sources: [S.offsite, S.fees]
        }
      ]
    }
  ];

  var PLAYBOOK = {
    id: 'etsy',
    name: 'Etsy',
    title: 'Sell on Etsy',
    agent: { name: 'Etsy agent', does: 'Reads Etsy search, shops and listings; decides price and title with the numbers and what a sale leaves after fees.', sites: ['etsy.com'] },
    business: 'an Etsy shop',
    sourceOwner: 'Etsy',
    updated: '2026-09-26',
    hosts: [{ host: /(^|\.)etsy\.com$/ }],
    named: /\betsy\b/,
    identity: 'You are the ZERACK Etsy agent, the operator for Etsy sellers. You read the search page, the listing and the shop in front of the user, and you work in the listing editor with them. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK\'s Etsy agent, a brutally honest operator for Etsy sellers who thinks in margin and search.',
    bottlenecks: 'search match (title, 13 tags, attributes, category), shipping price, price against the page, listing quality and reviews, or fees and ads eating the margin',
    assume: 'assume a small Etsy shop selling to US buyers in US dollars, and that the search or listing on screen is the market the user sells into',
    hints: [
      [/\b(?:titles?|titulos?)\b/, 'e1-l2'],
      [/\b(?:tags?|etiquetas?|keywords?|palabras clave|attributes?|atributos?)\b/, 'e1-l3'],
      [/\b(?:shipping|envio|envios|free shipping|envio gratis)\b/, 'e1-l4'],
      [/\b(?:search|busqueda|found|rank|ranking|visib)/, 'e1-l1'],
      [/\b(?:photos?|fotos?|return policy|quality|calidad|conversion|convierte|orders?|pedidos?|ventas|sales)\b/, 'e2-l1'],
      [/\bstar seller\b|\b(?:messages?|reviews?|resenas?)\b/, 'e2-l2'],
      [/\b(?:fees?|comision|comisiones|margin|margen|profit|ganancia|break.?even|price|precio)\b/, 'e3-l1'],
      [/\b(?:offsite|ads?|anuncios?)\b/, 'e3-l2']
    ],
    readers: [
      { id: 'etsy.listing', path: /^\/listing\/[0-9]+/, label: 'the listing on screen: price, original price, favorites, listed date and the shop rating and sales' },
      { id: 'etsy.shop', path: /^\/shop\//, label: 'a shop page: total sales, the year it opened, admirers, rating, and every listing card' },
      { id: 'etsy.grid', label: 'a search, category or market page: every listing card with price, discount, reviews, rating, shop, ad and badges' }
    ],
    surfaces: {
      'an Etsy search or category page': 'zerackExtract reads every listing card on it, and gives the price spread and the words the most reviewed titles share',
      'the Etsy listing editor': 'zerackPage types into the title, tags and description fields; publishing and renewing wait for the user press',
      'the Etsy Search visibility page': 'zerackPage read reads what it flags, when the user has it open',
      'the break-even tool': 'zerackBreakEven works out the fees, the margin per sale and the most an ad can cost per sale'
    },
    gate: {
      press: [
        { kind: 'Fulfill', re: /^(complete (the |this |my |your )?orders?|mark (it |this |the )?(order )?as (shipped|complete|completed|dispatched)|mark shipped|completar (el )?pedido|marcar como enviado)\b/ },
        { kind: 'Pay', re: /^(advertise( this listing)?|start advertising|turn on (etsy )?ads|(get|buy|purchase) (shipping )?labels?|activate( listings?| this listing)?|renew( listings?| now)?|anunciar|activar)\b/ },
        { kind: 'Send', re: /^(contact (the )?(buyer|customer)|message (the )?(buyer|customer)|send (a )?(message|convo)|reply to (the )?(buyer|customer|review))\b/ }
      ],
      never: []
    },
    readOnly: [],
    fees: {
      currency: 'USD',
      checked: '2026-09-26',
      note: 'US seller on Etsy Payments; other countries add a regulatory operating fee and different processing rates, and sales tax Etsy collects is left out.',
      lines: [
        { id: 'listing', label: 'Listing fee, renewed with each sale', fixed: 0.20, source: S.feeBasics },
        { id: 'transaction', label: 'Transaction fee, 6.5% of price plus shipping', rate: 0.065, source: S.fees },
        { id: 'processing', label: 'Payment processing, 3% plus $0.25', rate: 0.03, fixed: 0.25, source: S.processing }
      ],
      offsiteAds: { rate: 0.15, bigRate: 0.12, cap: 100, source: S.offsite }
    },
    chips: ['What sells on this page, and at what price?', 'Rewrite my listing title the way Etsy asks', 'What does a $30 sale leave me after fees?', 'What should I fix first to rank higher?'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_ETSY', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
