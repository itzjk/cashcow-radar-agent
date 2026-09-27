(function (root) {
  var HELP = 'Shopify Help Center';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    pricing: src('Shopify Pricing: plans, card rates and third-party fees', 'https://www.shopify.com/pricing', 'Shopify'),
    plans: src('Pricing plans and billing overview', 'https://help.shopify.com/en/manual/intro-to-shopify/pricing-plans/pricing-overview', HELP),
    thirdParty: src('Third-party transaction fees on your Shopify bills', 'https://help.shopify.com/en/manual/your-account/manage-billing/billing-charges/types-of-charges/third-party-charges/third-party-transaction-fees', HELP),
    behavior: src('Behavior reports: the conversion rate breakdown', 'https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/behaviour-reports', HELP),
    sessions: src('Changes to sessions and conversion rate in Shopify Analytics', 'https://help.shopify.com/en/manual/reports-and-analytics/discrepancies/session-measurement-update', HELP),
    abandoned: src('Recovering abandoned checkouts', 'https://help.shopify.com/en/manual/promoting-marketing/create-marketing/abandoned-checkouts', HELP),
    keywords: src('Adding keywords for SEO to your Shopify store', 'https://help.shopify.com/en/manual/promoting-marketing/seo/adding-keywords', HELP),
    product: src('Product details page', 'https://help.shopify.com/en/manual/products/details/product-details-page', HELP),
    fulfill: src('Fulfilling your own orders individually', 'https://help.shopify.com/en/manual/fulfillment/fulfilling-orders/single-fulfillment', HELP),
    notifications: src('Setting up customer notifications', 'https://help.shopify.com/en/manual/fulfillment/setup/notifications/customer-notifications', HELP)
  };

  var MODULES = [
    {
      id: 's1-funnel',
      title: 'Find where the store loses buyers',
      goal: 'Leave with the one step of the funnel that loses the most buyers, measured on the new session baseline.',
      lessons: [
        {
          id: 's1-l1-funnel',
          title: 'Find the step where the funnel leaks',
          why: 'The conversion rate breakdown report shows sessions, sessions that added to cart, sessions that reached checkout and sessions that completed checkout; the step with the biggest drop is the page to fix first.',
          steps: [
            'Open Analytics, then Reports, filter to Behavior reports and open the conversion rate breakdown.',
            'Write the four numbers: sessions, added to cart, reached checkout, completed checkout.',
            'Find the biggest drop: few adds to cart points at the product page, carts that never reach checkout point at the cart and shipping costs, checkouts that never complete point at the checkout itself.',
            'Shopify changed how it counts sessions between September 21 and 23, 2026: compare periods from after the update only, and read orders and sales next to sessions.',
            'Fix the leaking step before you buy more traffic.'
          ],
          doNow: 'Write the four funnel numbers for the last 30 days after the session update and name the step with the biggest drop.',
          proof: 'Four numbers and one named step.',
          surfaces: ['the Shopify admin'],
          sources: [S.behavior, S.sessions]
        },
        {
          id: 's1-l2-abandoned',
          title: 'Recover abandoned checkouts',
          why: 'Shopify counts a checkout as abandoned when it stays incomplete for more than ten minutes after the customer gave an email, and an automated email with a link back to the cart can recover it.',
          steps: [
            'Open Orders, then Abandoned checkouts, and count the last 30 days.',
            'In Messaging, open Automations and turn on the abandoned checkout email.',
            'Choose in Send after how long to wait before the email goes out.',
            'Read the Recovery status of each checkout a week later to see what came back.'
          ],
          doNow: 'Count the abandoned checkouts of the last 30 days and check that the recovery email is on.',
          proof: 'The count and a screenshot of the automation switched on.',
          surfaces: ['the Shopify admin'],
          sources: [S.abandoned]
        }
      ]
    },
    {
      id: 's2-product',
      title: 'Product pages that sell and get found',
      goal: 'Leave with product pages whose search listing and words match what buyers look for.',
      lessons: [
        {
          id: 's2-l1-search-listing',
          title: 'Write the search engine listing of each product',
          why: 'Shopify lets a page title hold up to 70 characters and suggests keeping it to 60 so search results do not cut it, with about 160 characters of meta description and the most important keywords near the start of the title.',
          steps: [
            'Open the product and its search engine listing preview.',
            'Write a page title of 60 characters or fewer that starts with what the product is.',
            'Write a meta description of about 160 characters that says who it is for and why it is different.',
            'Give every image alt text that describes it with the words of that page.',
            'Make each description unique: no two products should share the same paragraph.'
          ],
          doNow: 'Rewrite the search engine listing of your best selling product within 60 and 160 characters.',
          proof: 'The new title and description with their character counts.',
          surfaces: ['the Shopify admin'],
          sources: [S.keywords, S.product]
        },
        {
          id: 's2-l2-read-rivals',
          title: 'Read a rival store before you price',
          why: 'A price is only high or low against the store next to it: the catalog on screen shows what a rival sells, at what price, how often it lands new products and which ones it puts on sale.',
          steps: [
            'Open the rival store and read its catalog with ZERACK: every product, price, compare-at price and launch date it publishes.',
            'If the store hides its catalog, read the collection page on screen instead: that is hidden, not empty.',
            'Write the price band of the products closest to yours and how often the store launches.',
            'Price inside the band unless you can say in one line why yours is worth more.'
          ],
          doNow: 'Read the catalog of one rival and write its price band and how often it launches.',
          proof: 'One line with the band and the launch rhythm, with the store named.',
          surfaces: ['a Shopify storefront'],
          sources: [S.product]
        }
      ]
    },
    {
      id: 's3-margin',
      title: 'Keep the margin and ship on time',
      goal: 'Leave knowing what an order leaves after card fees and plan, and with every paid order fulfilled.',
      lessons: [
        {
          id: 's3-l1-fees',
          title: 'Know what an order leaves you',
          why: 'Shopify Payments charges 2.9% plus 30 cents per online card sale on Basic, 2.7% on Grow, 2.5% on Advanced and 2.25% on Plus, a third-party payment provider adds 2%, 1%, 0.6% or 0.2% on top, and the plan costs $39, $105 or $399 a month billed monthly.',
          steps: [
            'Write the price, the shipping you charge, and what the product and its shipping cost you.',
            'Take the card rate of your plan, plus the third-party fee if you do not use Shopify Payments.',
            'The margin per order is what the buyer pays minus fees and costs; the plan price is a fixed cost to cover each month.',
            'The most an ad can cost per order is that margin: the break-even return on ad spend is the order value divided by it.'
          ],
          doNow: 'Work out the margin per order and the break-even return on ad spend of your best seller with the break-even tool.',
          proof: 'One line with order value, fees, cost, margin and break-even return on ad spend.',
          surfaces: ['the break-even tool'],
          sources: [S.pricing, S.thirdParty, S.plans]
        },
        {
          id: 's3-l2-fulfill',
          title: 'Fulfill with a tracking number',
          why: 'Marking an order fulfilled can email the customer a shipping confirmation with the tracking number, which is why ZERACK waits for your press before it fulfills anything.',
          steps: [
            'Read the orders list and pull out every paid order that is still unfulfilled, oldest first.',
            'For each one, add the tracking number from your carrier before you fulfill.',
            'Keep Send a notification to the customer on when you have their email.',
            'Press Fulfill yourself in the chat when ZERACK asks.'
          ],
          doNow: 'List the paid and unfulfilled orders and the age of the oldest one.',
          proof: 'The list, with the oldest unfulfilled order and its age in days.',
          surfaces: ['the Shopify orders list'],
          sources: [S.fulfill, S.notifications]
        }
      ]
    }
  ];

  var ORDERS = { order: ['order'], date: ['date'], customer: ['customer'], total: ['total'], payment: ['payment status', 'payment'], fulfillment: ['fulfillment status', 'fulfillment'], items: ['items'] };
  var PRODUCTS = { product: ['product', 'title'], status: ['status'], inventory: ['inventory'], type: ['type', 'category'], vendor: ['vendor'] };
  var HIDDEN = '[class*="visuallyHidden"], [class*="VisuallyHidden"], .sr-only';

  var PLAYBOOK = {
    id: 'shopify',
    name: 'Shopify',
    title: 'Run a Shopify store',
    agent: { name: 'Shopify agent', does: 'Reads the admin, the storefront and rival catalogs; finds where buyers drop, the orders to fulfill and what an order leaves.', sites: ['admin.shopify.com', 'myshopify.com'] },
    business: 'a Shopify store',
    sourceOwner: 'Shopify',
    updated: '2026-09-26',
    hosts: [{ host: /^admin\.shopify\.com$/ }, { host: /\.myshopify\.com$/ }],
    named: /\bshopify\b/,
    identity: 'You are the ZERACK Shopify agent, the operator for Shopify merchants. You read the admin, the storefront and rival stores in front of the user, and you work in the admin with them. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK\'s Shopify agent, a brutally honest operator for Shopify merchants who thinks in margin and conversion.',
    bottlenecks: 'traffic, the step of the funnel that leaks (product page, cart or checkout), the price against rival stores, the margin after card fees and ads, or orders left unfulfilled',
    assume: 'assume a small Shopify store on the Basic plan with Shopify Payments, selling in US dollars, and that the admin or store on screen is theirs or a rival they compete with',
    hints: [
      [/\b(?:conversion|convierte|funnel|embudo|sessions?|sesiones)\b/, 's1-l1'],
      [/\b(?:abandon\w*|carrito abandonado|checkouts?)\b/, 's1-l2'],
      [/\b(?:seo|meta description|page title|search engine|google)\b/, 's2-l1'],
      [/\b(?:rivals?|competitors?|competencia|catalog|catalogo|launch|lanza)\b/, 's2-l2'],
      [/\b(?:fees?|comision|comisiones|margin|margen|profit|ganancia|roas|break.?even|ads?|anuncios?)\b/, 's3-l1'],
      [/\b(?:fulfill\w*|ship|shipping|envio|enviar pedidos?|tracking|unfulfilled|pendientes?)\b/, 's3-l2']
    ],
    readers: [
      { id: 'table', as: 'shopify.orders', host: /^admin\.shopify\.com$|\.myshopify\.com$/, path: /\/orders\/?$/, label: 'the orders list in the admin: order, date, customer, total, payment and fulfillment status', opts: { as: 'shopify.orders', label: 'Shopify orders', columns: ORDERS, need: ['order', 'total'], types: { total: 'money' }, strip: HIDDEN, linkField: 'order' } },
      { id: 'table', as: 'shopify.admin-products', host: /^admin\.shopify\.com$|\.myshopify\.com$/, path: /\/products\/?$/, label: 'the products list in the admin: product, status, inventory, type and vendor', opts: { as: 'shopify.admin-products', label: 'Shopify products', columns: PRODUCTS, need: ['product'], strip: HIDDEN, linkField: 'product' } },
      { id: 'shopify.grid', host: /\.myshopify\.com$/, path: /^\/(?:collections|search|products)?/, label: 'a storefront collection or search page: every product card with price, compare-at price and sold out' },
      { id: 'shopify.products', host: /^(?!admin\.shopify\.com$)/, label: 'any Shopify storefront, including rivals on their own domain: the published catalog with prices, compare-at prices and launch dates; a hidden catalog answers not_exposed' }
    ],
    surfaces: {
      'the Shopify admin': 'zerackPage reads and fills the admin page on screen; saving waits for the user press',
      'the Shopify orders list': 'zerackExtract with reader shopify.orders reads every order row, and Fulfill waits for the user press',
      'a Shopify storefront': 'zerackExtract with reader shopify.products reads the published catalog, and shopify.grid reads the cards on screen',
      'the break-even tool': 'zerackBreakEven works out card fees, margin per order and the break-even return on ad spend for the plan'
    },
    gate: {
      press: [
        { kind: 'Fulfill', re: /^(fulfill( items| order| orders| selected( orders)?)?|mark (as )?fulfilled|marcar como preparado|preparar pedido)\b/ },
        { kind: 'Pay', re: /^(capture( payment)?|mark as paid|collect payment|charge (the )?customer|approve (the )?(charge|subscription|app charge)|install( app)?|(buy|create|purchase) (a |the )?shipping labels?|start (a )?campaign)\b/ },
        { kind: 'Send', re: /^(send (the |an )?invoice|send (a |the )?(notification|email|receipt)|resend|email (the )?customer|contact (the )?customer)\b/ },
        { kind: 'Delete', re: /^(void( authorization)?|archive( orders?| order| product| products)?|restock)\b/ },
        { kind: 'Publish', re: /^(set (as )?active|make (it )?available|add to (the )?online store)\b/ }
      ],
      never: [
        { why: 'it changes who can reach the store admin', re: /^(add staff|invite staff|remove staff|staff accounts?|accept (the )?collaborator|collaborator request)\b/ },
        { why: 'it changes where the store money is paid out', re: /^(payout|payouts|change (the )?payment provider|deactivate shopify payments)\b/, link: true }
      ]
    },
    readOnly: [],
    fees: {
      currency: 'USD',
      checked: '2026-09-26',
      note: 'US online card rates with Shopify Payments; a third-party payment provider adds its own rate on top of the Shopify fee shown here.',
      plans: {
        basic: { label: 'Basic', rate: 0.029, fixed: 0.30, thirdParty: 0.02, monthly: 39, yearly: 29 },
        grow: { label: 'Grow', rate: 0.027, fixed: 0.30, thirdParty: 0.01, monthly: 105, yearly: 79 },
        advanced: { label: 'Advanced', rate: 0.025, fixed: 0.30, thirdParty: 0.006, monthly: 399, yearly: 299 },
        plus: { label: 'Plus', rate: 0.0225, fixed: 0.30, thirdParty: 0.002, monthly: 2300, yearly: null }
      },
      defaultPlan: 'basic',
      source: S.pricing,
      thirdPartySource: S.thirdParty
    },
    chips: ['Where does this store lose buyers?', 'Which orders still need fulfilling?', 'What does a $40 order leave me on Basic?', 'How often does this store launch products?'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_SHOPIFY', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
