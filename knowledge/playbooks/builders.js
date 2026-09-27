(function (root) {
  var YC = 'Y Combinator Startup Library';
  var PG = 'Paul Graham';
  var STRIPE = 'Stripe Docs';
  var GH = 'GitHub Docs';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    talk: src('How to talk to users, Eric Migicovsky', 'https://www.ycombinator.com/library/Iq-how-to-talk-to-users', YC),
    growth: src('Startup = Growth', 'https://paulgraham.com/growth.html', PG),
    unscalable: src('Do Things that Don\'t Scale', 'https://paulgraham.com/ds.html', PG),
    pmf: src('How Superhuman Built an Engine to Find Product/Market Fit', 'https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit/', 'First Round Review, Rahul Vohra'),
    issues: src('About issues', 'https://docs.github.com/en/issues/tracking-your-work-with-issues/about-issues', GH),
    sorting: src('Sorting search results, by reactions and comments', 'https://docs.github.com/en/search-github/getting-started-with-searching-on-github/sorting-search-results', GH),
    retries: src('Automate payment retries: Smart Retries', 'https://docs.stripe.com/billing/revenue-recovery/smart-retries', STRIPE),
    recovery: src('Revenue recovery', 'https://docs.stripe.com/billing/revenue-recovery', STRIPE),
    analytics: src('Billing analytics', 'https://docs.stripe.com/billing/subscriptions/analytics', STRIPE),
    launch: src('Product Hunt Launch Guide', 'https://www.producthunt.com/launch', 'Product Hunt')
  };

  var MODULES = [
    {
      id: 'b1-demand',
      title: 'Find what users actually want',
      goal: 'Leave with the one problem users repeat most, in their words, with the evidence next to it.',
      lessons: [
        {
          id: 'b1-l1-talk',
          title: 'Talk to users about their problem, not your product',
          why: 'Eric Migicovsky teaches that a user interview is for getting information out of the person, not for pitching them, and that it works when it asks for specifics about the problem and the last time they hit it.',
          steps: [
            'Ask what the hardest part of the task is, and tell me about the last time you ran into that.',
            'Ask why it was hard, what they did to solve it, and what they dislike about what they tried.',
            'Do not describe your product until the end, and never ask whether they would use it.',
            'Write down their words, not your summary, and the number of people who said the same thing.'
          ],
          doNow: 'Write five interview questions about the problem your product solves, none of them about your product.',
          proof: 'Five questions and the names of three users you will ask this week.',
          surfaces: [],
          sources: [S.talk]
        },
        {
          id: 'b1-l2-repeated-requests',
          title: 'Count the requests that repeat',
          why: 'Issues collect feedback, ideas and bugs in one list, and GitHub can sort them by reactions and comments, so the request most people push for rises to the top instead of the loudest one.',
          steps: [
            'Open the issues list sorted by reactions, or by comments when few people react.',
            'Read the first page with ZERACK and group the titles that ask for the same thing in different words.',
            'Count each group by issues, comments and labels, and keep the evidence links.',
            'Build the most repeated request that serves the user you are building for, and say no to the rest in writing.'
          ],
          doNow: 'Read your issues sorted by reactions and write the three most repeated requests with their counts.',
          proof: 'Three requests, each with its number of issues and comments and one link.',
          surfaces: ['a GitHub issues list'],
          sources: [S.issues, S.sorting]
        }
      ]
    },
    {
      id: 'b2-growth',
      title: 'Measure growth and fit',
      goal: 'Leave with one weekly growth number and a fit score you measure the same way every month.',
      lessons: [
        {
          id: 'b2-l1-weekly-growth',
          title: 'Pick one number and grow it every week',
          why: 'Paul Graham writes that a good growth rate during Y Combinator is 5 to 7% a week, 10% a week is exceptional, and 1% a week means the company has not figured out what it is doing yet; revenue is the number to use once there is revenue, active users before that.',
          steps: [
            'Pick the number: revenue if you charge, active users if you do not yet.',
            'Write last week\'s value and this week\'s, and the growth rate between them.',
            'Set the weekly rate you aim for between 5 and 7%.',
            'Each week, change the one thing most likely to move that number, and nothing else first.'
          ],
          doNow: 'Write this week\'s growth rate of your one number.',
          proof: 'Two weekly values and the rate between them.',
          surfaces: ['the Stripe dashboard'],
          sources: [S.growth]
        },
        {
          id: 'b2-l2-forty-percent',
          title: 'Run the 40% test for product fit',
          why: 'Superhuman measured fit by asking users how they would feel if they could no longer use the product: when 40% or more answer very disappointed, the product is near fit; Superhuman started at 22%.',
          steps: [
            'Ask active users one question: how would you feel if you could no longer use the product? Very disappointed, somewhat disappointed, not disappointed.',
            'Count the share that answers very disappointed.',
            'Read what the very disappointed users love, and what holds back the somewhat disappointed ones.',
            'Build for the second group what the first group already loves, then ask again next month.'
          ],
          doNow: 'Send the one question survey to your active users.',
          proof: 'The share that answered very disappointed, with the number of answers.',
          surfaces: [],
          sources: [S.pmf]
        },
        {
          id: 'b2-l3-unscalable',
          title: 'Recruit the first users by hand',
          why: 'Paul Graham\'s advice is that most startups have to recruit their first users by hand and give them an unusually good experience, instead of waiting for users to arrive.',
          steps: [
            'List twenty people who have the problem and write to each one personally.',
            'Onboard each new user yourself, and write down where they get stuck.',
            'Fix the place where most of them get stuck before you write to more people.'
          ],
          doNow: 'Write the list of twenty people and send the first five messages yourself.',
          proof: 'Twenty names and five sent messages.',
          surfaces: [],
          sources: [S.unscalable]
        }
      ]
    },
    {
      id: 'b3-revenue',
      title: 'Keep the revenue and launch',
      goal: 'Leave with failed payments recovered and a launch that follows the rules of the place it happens.',
      lessons: [
        {
          id: 'b3-l1-failed-payments',
          title: 'Recover failed payments before they churn',
          why: 'Stripe can retry failed subscription payments automatically; its recommended Smart Retries default is 8 tries within 2 weeks, and when retries run out the subscription is canceled, marked unpaid or left past due as you set it.',
          steps: [
            'Read the subscriptions list with ZERACK and count the ones past due and the money they hold.',
            'In Stripe, open Billing, then Revenue recovery, then Retries, and check that Smart Retries is on.',
            'Choose what happens after the last retry: cancel, mark unpaid or leave past due.',
            'ZERACK reads Stripe and never changes it: the settings and the refunds stay with you.'
          ],
          doNow: 'Count the past due subscriptions and the monthly revenue they carry.',
          proof: 'One line with the count and the amount at risk.',
          surfaces: ['the Stripe dashboard'],
          sources: [S.retries, S.recovery, S.analytics]
        },
        {
          id: 'b3-l2-launch',
          title: 'Launch by the rules of the place',
          why: 'Product Hunt suggests 12:01 am Pacific Time for makers planning ahead and says you cannot ask people directly to upvote your product; you can ask them to visit and comment.',
          steps: [
            'Pick the day you are most prepared, starting at 12:01 am Pacific Time.',
            'Write the launch post and the first comment explaining why you built it.',
            'Tell your users the launch is live and ask them to visit and comment, never to upvote.',
            'Answer every comment on launch day; ZERACK drafts replies and waits for your press to post.'
          ],
          doNow: 'Write the first comment of your launch in five sentences.',
          proof: 'The comment, with no request for upvotes in it.',
          surfaces: [],
          sources: [S.launch]
        }
      ]
    }
  ];

  var SUBS = { customer: ['customer'], status: ['status'], product: ['product', 'plan'], amount: ['amount', 'price', 'mrr'], created: ['created', 'date', 'started'] };
  var PAYMENTS = { amount: ['amount'], status: ['status'], description: ['description'], customer: ['customer'], date: ['date', 'created'] };

  var PLAYBOOK = {
    id: 'builders',
    name: 'Builders',
    title: 'Build a product people pay for',
    business: 'the SaaS or app the user is building',
    sourceOwner: 'platform and founder',
    updated: '2026-09-26',
    hosts: [
      { host: /^dashboard\.stripe\.com$/ },
      { host: /^github\.com$/ },
      { host: /(^|\.)producthunt\.com$/ },
      { host: /^(www\.)?indiehackers\.com$/ },
      { host: /^news\.ycombinator\.com$/ },
      { host: /^vercel\.com$/ },
      { host: /^(us|eu|app)\.posthog\.com$/ },
      { host: /^plausible\.io$/ },
      { host: /^appstoreconnect\.apple\.com$/ },
      { host: /^play\.google\.com$/, path: /^\/console/ },
      { host: /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/ }
    ],
    named: /\b(?:saas|startups?|my app|mi app|mi aplicacion|side project|mrr|churn|product hunt|indie hackers?|paying users|usuarios de pago|product.?market fit)\b/,
    identity: 'You are ZERACK, the operator for builders: founders and makers shipping a SaaS or an app. You read their issues, their billing and their launch pages in front of them, and you work on their own app with them. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for builders shipping a SaaS or an app, who thinks in users, revenue and weekly growth.',
    bottlenecks: 'nobody has the problem, users who sign up and never reach the first useful moment, a weekly growth rate under 5%, revenue lost to failed payments, or a launch nobody hears about',
    assume: 'assume a small team with one product and a few paying users in US dollars, and that the page on screen is their own product or its billing',
    hints: [
      [/\b(?:interview\w*|entrevist\w*|talk to users|hablar con usuarios|customer development)\b/, 'b1-l1'],
      [/\b(?:feature requests?|requests?|peticiones|issues?|feedback|roadmap)\b/, 'b1-l2'],
      [/\b(?:growth|crecimiento|weekly|semanal|metrics?|metricas?)\b/, 'b2-l1'],
      [/\b(?:product.?market fit|pmf|fit|survey|encuesta)\b/, 'b2-l2'],
      [/\b(?:first users|primeros usuarios|onboarding|recruit|captar)\b/, 'b2-l3'],
      [/\b(?:churn|failed payments?|pagos fallidos|past due|dunning|retries|mrr|revenue|ingresos)\b/, 'b3-l1'],
      [/\b(?:launch|lanzamiento|lanzar|product hunt|upvotes?)\b/, 'b3-l2']
    ],
    readers: [
      { id: 'github.issues', host: /^github\.com$/, path: /^\/[^\/]+\/[^\/]+\/issues\/?$/, label: 'a GitHub issues list: every issue with its title, comments, labels and date, and the requests that repeat' },
      { id: 'table', as: 'stripe.subscriptions', host: /^dashboard\.stripe\.com$/, path: /subscriptions/, label: 'the Stripe subscriptions list, read only: customer, status, product, amount and date', opts: { as: 'stripe.subscriptions', label: 'Stripe subscriptions', columns: SUBS, need: ['status'] } },
      { id: 'table', as: 'stripe.payments', host: /^dashboard\.stripe\.com$/, path: /payments/, label: 'the Stripe payments list, read only: amount, status, customer and date', opts: { as: 'stripe.payments', label: 'Stripe payments', columns: PAYMENTS, need: ['amount', 'status'], types: { amount: 'money' } } }
    ],
    surfaces: {
      'a GitHub issues list': 'zerackExtract with reader github.issues reads the list and groups the requests that repeat',
      'the Stripe dashboard': 'zerackExtract with reader stripe.subscriptions or stripe.payments reads the list on screen; ZERACK never changes anything on Stripe'
    },
    gate: {
      press: [
        { kind: 'Publish', re: /^(merge( pull request)?|confirm merge|squash and merge|rebase and merge|close (the |this )?(issue|pull request)|close as (completed|not planned|duplicate)|close with comment|reopen( issue)?|deploy|redeploy|promote to production|roll ?back|launch( now)?|schedule (the )?launch|upvote|repost|retweet|tweet|publish release|create release)\b/ },
        { kind: 'Send', re: /^(dm|direct message|send (a )?(dm|direct message)|message|invite( member| collaborator)?)\b/ }
      ],
      never: [
        { why: 'it deletes or hands over a whole project', re: /^(delete (this |the )?(repository|project|app|organization|team)|transfer (this |the )?(repository|project|app|ownership))\b/, link: true },
        { why: 'it changes who can reach the code or the deploys', re: /^(add (a )?collaborator|add people|manage access|change (the )?visibility|make (this repository )?public)\b/ }
      ]
    },
    readOnly: [{ host: /^dashboard\.stripe\.com$/, why: 'Stripe holds the money, the prices and the refunds, so ZERACK only reads it' }],
    fees: null,
    chips: ['Which feature request repeats most here?', 'How much revenue is past due?', 'Is my weekly growth rate good?', 'Write five interview questions for my users'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_BUILDERS', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
