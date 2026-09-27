(function (root) {
  var UP = 'Upwork Help';
  var FV = 'Fiverr Help Center';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    connects: src('Understanding and using Connects', 'https://support.upwork.com/hc/en-us/articles/211062898-Understanding-and-using-Connects', UP),
    fee: src('Learn about the Freelancer Service Fee', 'https://support.upwork.com/hc/en-us/articles/211062538-Learn-about-the-Freelancer-Service-Fee', UP),
    proposal: src('How to submit a proposal on Upwork', 'https://support.upwork.com/hc/en-us/articles/211062998-How-to-submit-a-proposal-on-Upwork', UP),
    terms: src('Terms of Use', 'https://www.upwork.com/legal#terms-of-use', 'Upwork'),
    gig: src('Creating a Gig', 'https://help.fiverr.com/hc/en-us/articles/360010451397', FV),
    levels: src('Understanding Fiverr\'s freelancer levels', 'https://help.fiverr.com/hc/en-us/articles/360010560118-Understanding-Fiverr-s-freelancer-levels', FV)
  };

  var MODULES = [
    {
      id: 'f1-jobs',
      title: 'Bid only where you can win',
      goal: 'Leave with the few jobs worth your Connects today, a price that keeps your rate, and a proposal written to each post.',
      lessons: [
        {
          id: 'f1-l1-connects',
          title: 'Spend Connects only on jobs you can win',
          why: 'Connects cost $0.15 each, the number a job asks for varies and can change while it is posted, and they are not returned when the client rejects you, picks someone else or lets the job expire without a hire.',
          steps: [
            'Open your job search and read it with ZERACK: budget or rate, proposals so far, payment verified, what the client spent, when it was posted and the skills asked.',
            'Skip what the judge skips: payment not verified, 50 or more proposals, older than three days, none of your skills.',
            'Look twice at new clients with no spend and at jobs that ask for 20 Connects or more.',
            'Bid on the rest, best first, and stop when the Connects you set aside for the day are spent.'
          ],
          doNow: 'Read one page of jobs and bid only on the ones ZERACK marks Bid.',
          proof: 'The jobs read, the ones you bid on and the Connects spent.',
          surfaces: ['an Upwork job search'],
          sources: [S.connects]
        },
        {
          id: 'f1-l2-rate',
          title: 'Price for what you keep',
          why: 'The Freelancer Service Fee ranges from 0% to 15% per contract, you see it when you submit a proposal or get an offer, and it stays fixed once the contract starts; to take home $20 an hour at a 10% fee you charge $22.22.',
          steps: [
            'Decide what you want to take home per hour or per project.',
            'Read the fee shown on the proposal form before you set the rate.',
            'Divide what you want to keep by one minus the fee: that is the rate to bid.',
            'Add the Connects the job asks for to your cost of winning it.'
          ],
          doNow: 'Work out the rate that keeps your target with the break-even tool.',
          proof: 'Your target, the fee, the rate you bid and the Connects cost.',
          surfaces: ['the break-even tool'],
          sources: [S.fee, S.connects]
        },
        {
          id: 'f1-l3-proposal',
          title: 'Write the proposal to their post',
          why: 'Upwork asks for a cover letter that describes what you can do for the client, asks questions about the project and suggests next steps such as a chat on Upwork Messages, and it warns against contacting a client again and again before a contract begins.',
          steps: [
            'Start with their words: what they need, quoted from the post.',
            'Say what you can do for them, with one proof that fits this job.',
            'Ask one question about the project and answer their screening questions first.',
            'Suggest the next step, then proofread and press Send yourself.',
            'Write once. If they do not answer, do not write again.'
          ],
          doNow: 'Draft the proposal for the best job with ZERACK and send it after you read it.',
          proof: 'The proposal you sent and the job it answers.',
          surfaces: ['an Upwork proposal form'],
          sources: [S.proposal]
        }
      ]
    },
    {
      id: 'f2-gigs',
      title: 'Build Fiverr gigs that sell',
      goal: 'Leave with a gig built the way Fiverr asks, priced against the gigs next to it, and the numbers for your next level.',
      lessons: [
        {
          id: 'f2-l1-gig',
          title: 'Build the gig the way Fiverr asks',
          why: 'A gig has a title that starts with I will, up to three packages (Basic, Standard and Premium) each with a delivery time, revisions and a price, a description of up to 1,200 characters and one to three images, 1280 x 769 pixels recommended.',
          steps: [
            'Write a title that starts with I will and says exactly what the client gets.',
            'Build three packages that differ in what is delivered, not only in price.',
            'Write the description in 1,200 characters or less: what is included and what is not.',
            'Add images you own, one of them a sample of your work.'
          ],
          doNow: 'Rewrite your gig title and the three packages.',
          proof: 'The new title and the three packages with delivery time, revisions and price.',
          surfaces: [],
          sources: [S.gig]
        },
        {
          id: 'f2-l2-price',
          title: 'Price against the gigs next to yours',
          why: 'Fiverr shows your level to clients on gig cards, gig pages and your profile, and every package carries its own price in US dollars, so a client sees yours next to the gigs around it.',
          steps: [
            'Search your service the way a client would and read the page with ZERACK.',
            'Write the price band of sellers at your level and the review counts that lead the page.',
            'Set your Basic package inside that band and let Standard and Premium carry the extra value.',
            'Read the same search again in two weeks to see who moved.'
          ],
          doNow: 'Read the search for your main service and write the price band at your level.',
          proof: 'The band, the median reviews and the price you set.',
          surfaces: ['a Fiverr search page'],
          sources: [S.gig, S.levels]
        },
        {
          id: 'f2-l3-levels',
          title: 'Climb to the next level',
          why: 'Level 1 asks for a success score of 5 or more, a 4.4 rating, an 80% response rate, 5 orders, 3 unique clients and $400 earned; Level 2 asks for 7, 4.6, 90%, 20 orders, 10 clients and $2,000; Top Rated adds a manual review on top of 9, 4.7, 90%, 40 orders, 20 clients and $10,000.',
          steps: [
            'Open your Level Overview and write the six numbers.',
            'Find the one furthest from the next level.',
            'Work on that one first, and keep the other five from slipping while you do.',
            'Level 1 unlocks more gigs and Fiverr Ads; plan them for when you get there.'
          ],
          doNow: 'Write your six numbers and the one furthest from the next level.',
          proof: 'The six numbers and the gap on each.',
          surfaces: [],
          sources: [S.levels]
        }
      ]
    }
  ];

  var PLAYBOOK = {
    id: 'freelance',
    name: 'Freelance',
    title: 'Win work on Upwork and Fiverr',
    business: 'a freelance service sold on Upwork or Fiverr',
    sourceOwner: 'Upwork and Fiverr',
    updated: '2026-09-27',
    hosts: [{ host: /^(www\.)?upwork\.com$/ }, { host: /^(www\.)?fiverr\.com$/ }],
    named: /\b(?:upwork|fiverr|freelanc\w*|connects|propuestas? de trabajo|gigs?)\b/,
    identity: 'You are ZERACK, the operator for freelancers on Upwork and Fiverr. You read the job search, the job and the gigs on screen, judge which jobs are worth a proposal, price for what the user keeps, and draft proposals written to each post. The user presses Send. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for freelancers who thinks in Connects spent, win rate and take-home rate.',
    bottlenecks: 'bidding on jobs nobody wins, a rate that loses the fee, generic proposals, gigs priced outside their band, or a level held back by one number',
    assume: 'assume a freelancer with a few reviews who bids from the Upwork job search or sells gigs on Fiverr, in US dollars',
    hints: [
      [/\b(?:connects|which jobs?|que trabajos?|worth|vale la pena|bid|pujar|apply|aplicar)\b/, 'f1-l1'],
      [/\b(?:rate|tarifa|price|precio|charge|cobrar|fee|comision|take home|keep)\b/, 'f1-l2'],
      [/\b(?:proposals?|propuestas?|cover letter|carta)\b/, 'f1-l3'],
      [/\b(?:gig|gigs|packages?|paquetes?|title|titulo)\b/, 'f2-l1'],
      [/\b(?:compare|comparar|competitors?|competencia|band|rango)\b/, 'f2-l2'],
      [/\b(?:levels?|nivel\w*|top rated|success score)\b/, 'f2-l3']
    ],
    readers: [
      { id: 'upwork.job', host: /^(www\.)?upwork\.com$/, path: /^\/(nx\/)?(jobs|freelance-jobs\/apply)\/|^\/ab\/proposals\/job\/|^\/nx\/proposals\/job\//, label: 'an Upwork job or its proposal form: budget or rate, the Connects it asks, proposals so far and the client' },
      { id: 'upwork.jobs', host: /^(www\.)?upwork\.com$/, label: 'the Upwork job search or feed: every job with its budget or rate, proposals, payment verified, client spend, age and skills, judged Bid, Look at it or Skip' },
      { id: 'fiverr.gigs', host: /^(www\.)?fiverr\.com$/, path: /^\/(search|categories)\//, label: 'a Fiverr search or category page: every gig with its price from, rating, reviews and seller level' }
    ],
    surfaces: {
      'an Upwork job search': 'zerackExtract with reader upwork.jobs reads the jobs on screen, then zerackLeads find judges each one Bid, Look at it or Skip with its reasons',
      'an Upwork proposal form': 'zerackLeads draft writes the cover letter to the post with the AI disclosure; zerackPage types it and Send waits for the user press, inside the daily cap',
      'a Fiverr search page': 'zerackExtract with reader fiverr.gigs reads price from, rating, reviews and level of every gig on screen',
      'the break-even tool': 'zerackBreakEven works out the rate to bid for a take-home target at the fee shown, and the Connects cost'
    },
    gate: {
      press: [
        { kind: 'Fulfill', re: /^(deliver( now| order| work)?|submit (the )?(work|deliverables?)( for payment)?)\b/ },
        { kind: 'Pay', re: /^(boost( (your|this|the))? proposal|buy connects|get (more )?connects|set (your )?bid|place (a )?bid|upgrade( to)? freelancer plus|subscribe to freelancer plus)\b/ },
        { kind: 'Send', re: /^(submit( a)? proposal|send( for [0-9]+ connects)?|apply( now)?|send (a |an )?(message|offer|custom offer|proposal|quote)|accept (the |this )?(offer|contract|invitation))\b/ }
      ],
      never: [
        { why: 'it moves your earnings or ends the contract, which is yours to do by hand', re: /^(withdraw( funds| earnings| now| balance)?|get paid now|release( payment| funds| escrow)?|end (the )?contract|close (the )?contract|request (a )?refund|issue (a )?refund)\b/, link: true },
        { why: 'feedback and ratings are yours to give by hand', re: /^(give|leave|submit) (public |private )?(feedback|rating|review)\b/ }
      ]
    },
    readOnly: [],
    private: [
      { host: /^(www\.)?upwork\.com$/, path: /^\/nx\/(settings|wallet|withdraw|payments|billing|deposit|reports\/tax)|^\/freelancers\/settings|^\/ab\/(account-security|settings)/, why: 'settings, earnings and tax pages stay with you' },
      { host: /^(www\.)?fiverr\.com$/, path: /^\/users\/[^\/]+\/(settings|manage_earnings|billing)|^\/(earnings|settings)(\/|$)/, why: 'settings and earnings stay with you' }
    ],
    terms: { pace: true, rule: 'Upwork forbids robots, spiders and scrapers on its site, so ZERACK reads only the page you have open, when you ask, never walks through jobs on its own, and you press Send yourself', source: S.terms },
    leads: 'job',
    fees: {
      model: 'freelance',
      currency: 'USD',
      checked: '2026-09-27',
      note: 'Upwork sets the Freelancer Service Fee per contract between 0% and 15% and shows it on the proposal form; the 10% used when none is given is the example on Upwork\'s own page. Fiverr\'s seller commission was not on a page ZERACK could open, so it is not guessed.',
      upwork: { min: 0, max: 0.15, example: 0.10, source: S.fee },
      connect: { price: 0.15, source: S.connects }
    },
    chips: ['Which of these jobs are worth my Connects?', 'Draft a proposal for the best one', 'What should I charge to keep $40 an hour?', 'How do my gig prices compare?'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_FREELANCE', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
