(function (root) {
  var YC = 'Y Combinator Startup Library';
  var PG = 'Paul Graham';
  var STRIPE = 'Stripe Docs';
  var GH = 'GitHub Docs';
  var HN = 'Hacker News';
  var PH = 'Product Hunt';
  var CWS = 'Chrome for Developers';
  var X = 'X Developer Platform';

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
    traffic: src('Viewing traffic to a repository', 'https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-traffic-to-a-repository', GH),
    topics: src('Classifying your repository with topics', 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics', GH),
    releaseNotes: src('Automatically generated release notes', 'https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes', GH),
    changelog: src('Keep a Changelog 1.1.0', 'https://keepachangelog.com/en/1.1.0/', 'Olivier Lacan, Keep a Changelog'),
    semver: src('Semantic Versioning 2.0.0', 'https://semver.org/', 'Tom Preston-Werner, SemVer'),
    retries: src('Automate payment retries: Smart Retries', 'https://docs.stripe.com/billing/revenue-recovery/smart-retries', STRIPE),
    recovery: src('Revenue recovery', 'https://docs.stripe.com/billing/revenue-recovery', STRIPE),
    analytics: src('Billing analytics', 'https://docs.stripe.com/billing/subscriptions/analytics', STRIPE),
    launch: src('Product Hunt Launch Guide', 'https://www.producthunt.com/launch', PH),
    preparing: src('Preparing for launch', 'https://www.producthunt.com/launch/preparing-for-launch', PH),
    showhn: src('Show HN Guidelines', 'https://news.ycombinator.com/showhn.html', HN),
    showTips: src('Tips for a Show HN, by the moderator dang', 'https://news.ycombinator.com/item?id=22336638', HN),
    guidelines: src('Hacker News Guidelines', 'https://news.ycombinator.com/newsguidelines.html', HN),
    faq: src('Hacker News FAQ', 'https://news.ycombinator.com/newsfaq.html', HN),
    listing: src('Creating a great listing page', 'https://developer.chrome.com/docs/webstore/best-listing', CWS),
    counting: src('Counting characters', 'https://docs.x.com/fundamentals/counting-characters', X),
    intents: src('Web Intents', 'https://docs.x.com/x-for-websites/web-intents/overview', X),
    npmCounts: src('Download counts', 'https://github.com/npm/registry/blob/main/docs/download-counts.md', 'npm registry docs')
  };

  var MODULES = [
    {
      id: 'b1-demand',
      title: 'Find what users want',
      goal: 'Leave with the request users repeat most, in their words, with the evidence next to it.',
      lessons: [
        {
          id: 'b1-l1-talk',
          title: 'Talk to users about their problem',
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
          why: 'Issues collect feedback, ideas and bugs in one list, and GitHub can sort them by reactions and comments, so the request most people push for rises to the top instead of the loudest one. Launch threads carry the same requests in other words.',
          steps: [
            'Open the issues list sorted by reactions, and your launch threads on Hacker News or Product Hunt.',
            'Read each one with ZERACK, then ask which request repeats: it groups the same ask in different words across all of them.',
            'Take the group with the most people, with its count and links, and leave the bugs to their own list.',
            'Build the most repeated request that serves the user you are building for, and say no to the rest in writing.'
          ],
          doNow: 'Read your issues and your last launch thread, then ask ZERACK which request repeats.',
          proof: 'Three requests, each with its count, its sources and one link.',
          surfaces: ['a GitHub issues list', 'a launch thread'],
          sources: [S.issues, S.sorting]
        },
        {
          id: 'b1-l3-askers',
          title: 'Answer people who ask for it',
          why: 'Hacker News asks members not to use the site primarily for promotion, while it is fine to post your own work part of the time; its moderator adds that text posted there should be written by hand, not by a language model.',
          steps: [
            'Read the threads where your users talk with ZERACK, and ask who is asking for what you build.',
            'Pick the few where your product answers their exact question, not the ones that only share a word.',
            'Reply by hand: answer the question first, say you are the maker, then link once.',
            'Every reply waits for your press; never reply to more people than you would by hand.'
          ],
          doNow: 'Read one thread about your problem and answer the best match by hand.',
          proof: 'One reply that answers the question and says you built the product.',
          surfaces: ['a launch thread'],
          sources: [S.guidelines, S.showTips]
        }
      ]
    },
    {
      id: 'b2-growth',
      title: 'Measure growth and fit',
      goal: 'Leave with one weekly growth number, a fit score and the rivals that are pulling ahead.',
      lessons: [
        {
          id: 'b2-l1-weekly-growth',
          title: 'Grow one number every week',
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
          title: 'Run the 40% fit test',
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
        },
        {
          id: 'b2-l4-traffic',
          title: 'Read your repository traffic',
          why: 'GitHub shows anyone with push access the clones, the visitors of the past 14 days, the referring sites and the popular content, ordered by views and unique visitors; clones and visitors update hourly, referrers and content daily, all in UTC.',
          steps: [
            'Open Insights, then Traffic, on your repository while signed in.',
            'Read it with ZERACK: views, unique visitors, clones and the referring sites.',
            'Find the referrer that sends the most unique visitors and do more of what brought them.',
            'Read it again in a week: GitHub keeps only 14 days, so ZERACK keeps the series for you.'
          ],
          doNow: 'Read your traffic page and name the top referrer.',
          proof: 'Views, unique visitors and the top referrer with its count.',
          surfaces: ['the repository traffic page'],
          sources: [S.traffic]
        },
        {
          id: 'b2-l5-rivals',
          title: 'Watch the rivals that accelerate',
          why: 'Package and store numbers move by day: npm counts downloads by UTC day, and the Chrome Web Store ranks with ratings and usage together. A rival that accelerates over its own baseline tells you where the demand is moving before a launch post does.',
          steps: [
            'Open each rival repository, package or store listing and ask ZERACK to watch it.',
            'ZERACK reads each public page once a day at human pace and keeps the numbers.',
            'After four readings it says who accelerates over their own baseline and who holds a normal pace.',
            'Read what the accelerating one shipped that week before you copy anything.'
          ],
          doNow: 'Watch three rivals today.',
          proof: 'Three watched pages and the date of their fourth reading.',
          surfaces: ['a rival repository or package'],
          sources: [S.npmCounts, S.listing]
        }
      ]
    },
    {
      id: 'b3-revenue',
      title: 'Keep revenue and launch',
      goal: 'Leave with failed payments recovered and a launch that follows the rules of the place it happens.',
      lessons: [
        {
          id: 'b3-l1-failed-payments',
          title: 'Recover failed payments',
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
          title: 'Launch on Product Hunt',
          why: 'Product Hunt caps the tagline at 60 characters and the description at 500, wants 2 or more gallery images at 1270x760, reports that 70% of products of the day, week or month had a first comment by the maker, suggests 12:01 am Pacific Time, and forbids asking people directly to upvote.',
          steps: [
            'Ask ZERACK for a launch kit: it builds the name, tagline and description from your own repository text and checks each limit.',
            'Write the first comment in your words from its outline: why you built it, what it does, what is free.',
            'Pick the day you are most prepared, starting at 12:01 am Pacific Time.',
            'Tell your users the launch is live and ask them to visit and comment, never to upvote.'
          ],
          doNow: 'Ask for the launch kit and fix every limit it flags.',
          proof: 'A tagline under 60 characters, 2 or more gallery captions and your first comment.',
          surfaces: [],
          sources: [S.preparing, S.launch]
        },
        {
          id: 'b3-l3-show-hn',
          title: 'Post a Show HN',
          why: 'A Show HN is for something people can try, ideally without signups; landing pages, fundraisers and reading material are off topic, the title begins with Show HN, and friends must not be asked to upvote or comment. The moderator asks for a backstory and a clear statement of what it is, written by hand.',
          steps: [
            'Check that people can try it now without a signup; if not, wait.',
            'Ask ZERACK for the Show HN checklist: a title from your own description and the facts to cover.',
            'Write the text yourself: how you came to build it, what is different, how to try it, no marketing words.',
            'Submit it yourself, then stay in the thread to answer questions.'
          ],
          doNow: 'Make the product try-able without a signup, then write your backstory by hand.',
          proof: 'A title that begins with Show HN and a text you wrote yourself.',
          surfaces: [],
          sources: [S.showhn, S.showTips, S.faq]
        },
        {
          id: 'b3-l4-store-listing',
          title: 'Fix the extension listing',
          why: 'The Chrome Web Store asks for a title that reflects the core function, a summary of 132 characters or less, at least one and preferably five screenshots at 1280x800 or 640x400, and ranks items by a heuristic that uses ratings and usage.',
          steps: [
            'Read your listing and your rivals with ZERACK: users, rating, number of ratings, last update.',
            'Rewrite the summary to say the core function in under 132 characters.',
            'Add screenshots until there are five, each at 1280x800.',
            'Ask happy users to rate it; the rating and usage both feed the ranking.'
          ],
          doNow: 'Rewrite your summary under 132 characters.',
          proof: 'The new summary with its character count.',
          surfaces: ['a rival repository or package'],
          sources: [S.listing]
        }
      ]
    },
    {
      id: 'b4-ship',
      title: 'Ship in public',
      goal: 'Leave with a changelog people read and posts made only of true numbers.',
      lessons: [
        {
          id: 'b4-l1-changelog',
          title: 'Write the changelog and release notes',
          why: 'Keep a Changelog groups changes as Added, Changed, Deprecated, Removed, Fixed and Security, says changelogs are for humans and that raw commit logs are full of noise; GitHub can generate notes from merged pull requests; SemVer bumps MAJOR for incompatible changes, MINOR for new features, PATCH for fixes, and starts at 0.1.0.',
          steps: [
            'Read your commits and releases with ZERACK.',
            'Ask for the changelog: it sorts the commits since the last release into those groups and drops the noise.',
            'Check the version it proposes against what changed, then edit the lines into plain words.',
            'Publishing the release waits for your press.'
          ],
          doNow: 'Ask ZERACK for the changelog since your last release.',
          proof: 'A changelog section with a version, a date and at least one group.',
          surfaces: ['a repository'],
          sources: [S.changelog, S.releaseNotes, S.semver]
        },
        {
          id: 'b4-l2-build-in-public',
          title: 'Post what you shipped today',
          why: 'A post on X holds 280 characters and every link counts as 23, whatever its length; a post built from the commits and numbers of the day stays true, and the web intent opens it in the composer for you to post.',
          steps: [
            'Read your repository with ZERACK at the end of the day.',
            'Ask what to post today: it drafts from the real commits and star count, or says there is nothing new.',
            'Cut the draft to your voice, keeping every number as it came.',
            'Open it in X and post it yourself.'
          ],
          doNow: 'Ask ZERACK what to post today.',
          proof: 'One post under 280 characters with numbers from today.',
          surfaces: ['a repository'],
          sources: [S.counting, S.intents]
        },
        {
          id: 'b4-l3-discovery',
          title: 'Make the repository findable',
          why: 'GitHub topics let people explore repositories in a subject area and discover new solutions; they are lowercase letters, numbers and hyphens, 50 characters or less, and a repository takes no more than 20.',
          steps: [
            'Read your repository with ZERACK and see which topics it has.',
            'Add the topics people search for your problem, up to 20.',
            'Put what it does and how to try it in the first lines of the README.'
          ],
          doNow: 'Add five topics that name the problem your product solves.',
          proof: 'The topics on the repository page.',
          surfaces: ['a repository'],
          sources: [S.topics]
        }
      ]
    }
  ];

  var SUBS = { customer: ['customer'], status: ['status'], product: ['product', 'plan'], amount: ['amount', 'price', 'mrr'], created: ['created', 'date', 'started'] };
  var PAYMENTS = { amount: ['amount'], status: ['status'], description: ['description'], customer: ['customer'], date: ['date', 'created'] };
  var STRIPE_TILES = {
    grossVolume: ['gross volume'], netVolume: ['net volume', 'net volume from sales'], mrr: ['mrr', 'monthly recurring revenue'], newCustomers: ['new customers'],
    activeSubscribers: ['active subscribers', 'subscribers'], churnRate: ['churn rate', 'subscriber churn rate'], failedPayments: ['failed payments'], arpu: ['average revenue per user', 'arpu']
  };
  var STRIPE_TYPES = { grossVolume: 'money', netVolume: 'money', mrr: 'money', arpu: 'money', churnRate: 'pct', newCustomers: 'int', activeSubscribers: 'int', failedPayments: 'int' };
  var PLAUSIBLE_TILES = { visitors: ['unique visitors'], visits: ['total visits'], pageviews: ['total pageviews', 'pageviews'], viewsPerVisit: ['views per visit'], bounceRate: ['bounce rate'], visitDuration: ['visit duration'] };
  var PLAUSIBLE_TYPES = { visitors: 'int', visits: 'int', pageviews: 'int', viewsPerVisit: 'int', bounceRate: 'pct', visitDuration: 'duration' };

  var RULES = {
    ph: {
      name: { rule: 'Only the product name, no description and no emoji unless it is part of the name', source: S.preparing },
      tagline: { max: 60, rule: 'Tagline of 60 characters at most, simple, no gimmicks', source: S.preparing },
      description: { max: 500, rule: 'Description of 500 characters at most: what the product is and does', source: S.preparing },
      gallery: { min: 2, size: '1270x760', rule: 'Gallery images at 1270x760, and 2 or more before the page is viewable', source: S.preparing },
      firstComment: { rule: '70% of products of the day, week or month had a first comment by the maker', source: S.preparing },
      timing: { rule: 'Launch at 12:01 am Pacific Time on the day you are most prepared; the homepage runs on a 24 hour cycle in Pacific Time', source: S.preparing, zone: 'America/Los_Angeles' },
      votes: { rule: 'You cannot ask people directly to upvote your product', source: S.launch }
    },
    hn: {
      prefix: { rule: 'The title begins with Show HN', source: S.showhn },
      tryable: { rule: 'Something people can try now, ideally without signups or emails; no landing pages, fundraisers or reading material', source: S.showhn },
      title: { rule: 'No uppercase or exclamation points to make a title stand out, and no saying how great it is', source: S.guidelines },
      handwrite: { rule: 'Write the text by hand: no language model may generate or edit text posted to Hacker News', source: S.showTips },
      backstory: { rule: 'Give the backstory, what is different, and a clear statement of what it is; drop marketing language', source: S.showTips },
      votes: { rule: 'Do not ask friends to upvote or comment', source: S.showhn },
      promotion: { rule: 'Do not use the site primarily for promotion; posting your own work part of the time is fine', source: S.guidelines },
      releases: { rule: 'A new version is a Show HN only when it is significantly different, and then with a link to the earlier one', source: S.showTips },
      submit: 'https://news.ycombinator.com/submitlink'
    },
    x: { max: 280, url: 23, rule: 'A post holds 280 characters and every link counts as 23', source: S.counting, intent: 'https://x.com/intent/tweet', intentSource: S.intents },
    changelog: { groups: ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'], rule: 'Group changes as Added, Changed, Deprecated, Removed, Fixed and Security; leave the noise of the commit log out', source: S.changelog },
    semver: { rule: 'MAJOR for incompatible changes, MINOR for new features, PATCH for fixes; start at 0.1.0', source: S.semver },
    releaseNotes: { rule: 'GitHub can generate release notes from merged pull requests and their labels', source: S.releaseNotes },
    topics: { max: 20, chars: 50, rule: 'Up to 20 topics, lowercase letters, numbers and hyphens, 50 characters or less', source: S.topics },
    listing: { summary: 132, screenshots: 5, size: '1280x800', rule: 'Summary of 132 characters or less, at least one and up to five screenshots at 1280x800', source: S.listing }
  };

  var PLAYBOOK = {
    id: 'builders',
    name: 'Builders',
    title: 'Build a product people use and pay for',
    business: 'the product the user is building: a SaaS, an app, an extension, an agent or an open source project',
    sourceOwner: 'platform and founder',
    updated: '2026-09-27',
    hosts: [
      { host: /^dashboard\.stripe\.com$/ },
      { host: /^github\.com$/ },
      { host: /(^|\.)producthunt\.com$/ },
      { host: /^(www\.)?indiehackers\.com$/ },
      { host: /^news\.ycombinator\.com$/ },
      { host: /^(www\.)?npmjs\.com$/, path: /^\/(package|settings)\// },
      { host: /^pypi\.org$/, path: /^\/(project|manage)\// },
      { host: /^vercel\.com$/ },
      { host: /^(us|eu|app)\.posthog\.com$/ },
      { host: /^plausible\.io$/ },
      { host: /^appstoreconnect\.apple\.com$/ },
      { host: /^play\.google\.com$/, path: /^\/console/ },
      { host: /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/ }
    ],
    named: /\b(?:saas|startups?|my app|mi app|mi aplicacion|side project|mrr|churn|product hunt|indie hackers?|paying users|usuarios de pago|product.?market fit|show hn|hacker news|build in public|changelog|release notes|github stars|my repo|mi repo|open source|npm package|chrome extension|my extension|mi extension)\b/,
    identity: 'You are ZERACK, the operator for builders: developers, indie hackers, founders and maintainers shipping a SaaS, an app, an extension, an agent or an open source project. You read their repository, their issues, their launch threads, their packages and their billing in front of them, and you prepare the work: the request that repeats, the rival that accelerates, the changelog, the launch kit and the post of the day. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for builders shipping a product in public, who thinks in users, revenue and weekly growth.',
    bottlenecks: 'nobody has the problem, a request users repeat and nobody builds, users who never reach the first useful moment, a weekly growth rate under 5%, revenue lost to failed payments, or a launch nobody hears about',
    assume: 'assume a small team with one product shipped in public from a GitHub repository and a few users, and that the page on screen is their own product, their launch or a rival',
    hints: [
      [/\b(?:interview\w*|entrevist\w*|talk to users|hablar con usuarios|customer development)\b/, 'b1-l1'],
      [/\b(?:feature requests?|requests?|peticiones|pedidos|issues?|feedback|roadmap|repite|repeats?)\b/, 'b1-l2'],
      [/\b(?:asking for|piden|people asking|who is asking|quien pide|reply|replies|responder|leads?)\b/, 'b1-l3'],
      [/\b(?:growth|crecimiento|weekly|semanal|metrics?|metricas?)\b/, 'b2-l1'],
      [/\b(?:product.?market fit|pmf|fit|survey|encuesta)\b/, 'b2-l2'],
      [/\b(?:first users|primeros usuarios|onboarding|recruit|captar)\b/, 'b2-l3'],
      [/\b(?:traffic|trafico|visitors|visitas|referrers?|clones?)\b/, 'b2-l4'],
      [/\b(?:rivals?|rivales|competitors?|competencia|accelerat\w*|acelera\w*|watch|vigila\w*)\b/, 'b2-l5'],
      [/\b(?:churn|failed payments?|pagos fallidos|past due|dunning|retries|mrr|revenue|ingresos)\b/, 'b3-l1'],
      [/\b(?:launch|lanzamiento|lanzar|product hunt|upvotes?|tagline|launch kit)\b/, 'b3-l2'],
      [/\b(?:show hn|hacker news)\b/, 'b3-l3'],
      [/\b(?:web store|chrome web store|store listing|ficha)\b/, 'b3-l4'],
      [/\b(?:changelog|release notes?|notas de la version|release|version|semver)\b/, 'b4-l1'],
      [/\b(?:post|tweet|publicar hoy|build in public|what to post|que publico)\b/, 'b4-l2'],
      [/\b(?:topics?|readme|discover\w*|findable)\b/, 'b4-l3']
    ],
    readers: [
      { id: 'github.issues', host: /^github\.com$/, path: /^\/[^\/]+\/[^\/]+\/issues\/?$/, label: 'a GitHub issues list: every issue with its title, comments, labels and date' },
      { id: 'github.traffic', host: /^github\.com$/, path: /^\/[^\/]+\/[^\/]+\/graphs\/traffic\/?$/, label: 'the traffic page of a repository, signed in: views, unique visitors, clones and referring sites' },
      { id: 'github.releases', host: /^github\.com$/, path: /^\/[^\/]+\/[^\/]+\/(releases|tags)(\/|$)/, label: 'the releases of a repository from its public feed, with the tags when there is no release' },
      { id: 'github.commits', host: /^github\.com$/, path: /^\/[^\/]+\/[^\/]+\/commits(\/|$)/, label: 'the latest commits of a repository from its public feed' },
      { id: 'github.repo', host: /^github\.com$/, path: /^\/[^\/]+\/[^\/]+(\/tree\/.*)?\/?$/, label: 'a repository: stars, forks, watchers, open issues and pull requests, commits, topics, README headings, plus its latest commits and releases' },
      { id: 'hn.item', host: /^news\.ycombinator\.com$/, path: /^\/item$/, label: 'a Hacker News thread: the story with its points and every comment' },
      { id: 'hn.list', host: /^news\.ycombinator\.com$/, label: 'a Hacker News list: each story with its points, comments and age' },
      { id: 'ph.product', host: /(^|\.)producthunt\.com$/, path: /^\/(products|posts)\//, label: 'a Product Hunt product or launch: upvotes, day rank, reviews, followers and the comments' },
      { id: 'npm.package', host: /^(www\.)?npmjs\.com$/, path: /^\/package\//, label: 'an npm package: weekly downloads, version, last publish, dependents' },
      { id: 'pypi.package', host: /^pypi\.org$/, path: /^\/project\//, label: 'a PyPI project: version, release date and release history' },
      { id: 'table', as: 'stripe.subscriptions', host: /^dashboard\.stripe\.com$/, path: /subscriptions/, label: 'the Stripe subscriptions list, read only: customer, status, product, amount and date', opts: { as: 'stripe.subscriptions', label: 'Stripe subscriptions', columns: SUBS, need: ['status'] } },
      { id: 'table', as: 'stripe.payments', host: /^dashboard\.stripe\.com$/, path: /payments/, label: 'the Stripe payments list, read only: amount, status, customer and date', opts: { as: 'stripe.payments', label: 'Stripe payments', columns: PAYMENTS, need: ['amount', 'status'], types: { amount: 'money' } } },
      { id: 'tiles', as: 'stripe.home', host: /^dashboard\.stripe\.com$/, path: /^\/(test\/)?(dashboard|billing|home)?\/?$|^\/(test\/)?billing\/overview/, label: 'the Stripe home or billing overview, read only: gross and net volume, MRR, new customers, subscribers, churn', opts: { as: 'stripe.home', label: 'Stripe overview', tiles: STRIPE_TILES, types: STRIPE_TYPES } },
      { id: 'tiles', as: 'plausible.stats', host: /^plausible\.io$/, path: /^\/[^\/]+\.[^\/]+\/?$/, label: 'a Plausible dashboard: unique visitors, visits, pageviews, bounce rate and visit duration', opts: { as: 'plausible.stats', label: 'Plausible', tiles: PLAUSIBLE_TILES, types: PLAUSIBLE_TYPES } }
    ],
    surfaces: {
      'a GitHub issues list': 'zerackExtract with reader github.issues reads the list; zerackBuilder requests groups what repeats across the issues and the threads you read',
      'a launch thread': 'zerackExtract with reader hn.item, reddit.thread or ph.product reads it; zerackBuilder requests and zerackBuilder askers work on what was read',
      'the Stripe dashboard': 'zerackExtract with reader stripe.subscriptions, stripe.payments or stripe.home reads the page on screen; ZERACK never changes anything on Stripe',
      'the repository traffic page': 'zerackExtract with reader github.traffic reads it when the user is signed in with push access',
      'a rival repository or package': 'zerackBuilder watch keeps a public repository, package or store listing and reads it once a day; zerackBuilder rivals says who accelerates',
      'a repository': 'zerackExtract with reader github.repo reads it with its latest commits; zerackBuilder post, changelog and launch work from that read'
    },
    gate: {
      press: [
        { kind: 'Publish', re: /^(merge( pull request)?|confirm merge|squash and merge|rebase and merge|close (the |this )?(issue|pull request)|close as (completed|not planned|duplicate)|close with comment|reopen( issue)?|deploy|redeploy|promote to production|roll ?back|launch( now)?|schedule (the )?launch|repost|retweet|tweet|publish release|create release|update release|create (a )?fork|fork|publish package|lock conversation|pin issue|transfer issue|(update|change|edit|save) (the )?(price|pricing|plan))\b/ },
        { kind: 'Send', re: /^(dm|direct message|send (a )?(dm|direct message)|message|invite( member| collaborator)?|add (a )?comment|post (a )?comment|create (the )?(issue|pull request|discussion)|open (a )?pull request|start (a )?discussion|submit)\b/ }
      ],
      never: [
        { why: 'it deletes or hands over a whole project', re: /^(delete (this |the )?(repository|project|app|organization|team|package|release)|transfer (this |the )?(repository|project|app|ownership)|unpublish|archive (this |the )?repository)\b/, link: true },
        { why: 'it changes who can reach the code or the deploys', re: /^(add (a )?collaborator|add people|manage access|change (the )?visibility|make (this repository )?(public|private))\b/ },
        { why: 'stars, follows, votes and sponsorships are yours to give by hand, so ZERACK never casts them', re: /^(follow|unfollow|following|sponsor|upvote|downvote|vote)\b|^(star|unstar|starred|watch|unwatch|watching)(\s+[0-9][0-9,.]*[km]?)?$|^subscribe to (this )?(repository|thread)\b|\b(star|unstar|follow|unfollow|sponsor|upvote|downvote|vote for|watch|unwatch) (a|an|this|the|that) (repository|repo|project|user|account|organization|story|post|comment|product|maker)\b/, link: true }
      ]
    },
    readOnly: [{ host: /^dashboard\.stripe\.com$/, why: 'Stripe holds the money, the prices and the refunds, so ZERACK only reads it' }],
    private: [
      { host: /^github\.com$/, path: /^\/settings(\/|$)|^\/[^\/]+\/[^\/]+\/settings(\/|$)|^\/organizations\/[^\/]+\/settings(\/|$)/, why: 'settings, tokens and keys stay with you' },
      { host: /^(www\.)?npmjs\.com$/, path: /^\/settings(\/|$)/, why: 'npm tokens and account settings stay with you' },
      { host: /^pypi\.org$/, path: /^\/manage\/(account|project\/[^\/]+\/settings)/, why: 'PyPI tokens and account settings stay with you' },
      { host: /^vercel\.com$/, path: /\/settings(\/|$)|^\/account(\/|$)/, why: 'environment variables, tokens and settings stay with you' },
      { host: /^dashboard\.stripe\.com$/, path: /^\/(test\/)?(apikeys|settings|webhooks|developers)(\/|$)/, why: 'API keys, webhooks and settings stay with you' },
      { host: /^plausible\.io$/, path: /\/settings(\/|$)/, why: 'settings and API keys stay with you' },
      { host: /(^|\.)producthunt\.com$/, path: /^\/my\/(settings|api|applications)/, why: 'settings and API applications stay with you' }
    ],
    fees: null,
    rules: RULES,
    chips: ['Which feature request repeats most?', 'What should I post today?', 'Write the changelog since my last release', 'Build my Product Hunt and Show HN kit'],
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
