(function (root) {
  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    cost: src('How much does Substack cost?', 'https://support.substack.com/hc/en-us/articles/360037607131-How-much-does-Substack-cost', 'Substack Help'),
    recommend: src('How can I recommend other publications on Substack?', 'https://support.substack.com/hc/en-us/articles/5036794583828-How-can-I-recommend-other-publications-on-Substack', 'Substack Help'),
    abtest: src('Creating and using A/B tests in your beehiiv posts', 'https://www.beehiiv.com/support/article/9479415454615-creating-and-using-ab-tests-in-your-beehiiv-posts', 'beehiiv Help'),
    mpp: src('Use Mail Privacy Protection on iPhone', 'https://support.apple.com/guide/iphone/use-mail-privacy-protection-iphf084865c7/ios', 'Apple Support'),
    canSpam: src('CAN-SPAM Act: A Compliance Guide for Business', 'https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business', 'Federal Trade Commission')
  };

  var MODULES = [
    {
      id: 'n1-read',
      title: 'Write what readers open and share',
      goal: 'Leave with the topics that land, subject lines chosen by a real test, and open rates read with care.',
      lessons: [
        {
          id: 'n1-l1-topics',
          title: 'Find the topics that land',
          why: 'A Substack archive shows every post with its likes, comments and restacks, so the posts readers pushed stand apart from the rest, and the same reading on two rivals shows what their readers want.',
          steps: [
            'Open your archive and read it with ZERACK: likes, comments, restacks, length and whether each post was free or paid.',
            'Let it compare the titles of the posts with the most likes against the rest.',
            'Read the archive of two rivals the same way.',
            'Plan your next four posts on the topics that landed in more than one archive.'
          ],
          doNow: 'Read your archive and one rival, then write the three topics that landed.',
          proof: 'The three topics with the posts and likes behind each.',
          surfaces: ['a Substack archive'],
          sources: [S.recommend]
        },
        {
          id: 'n1-l2-subjects',
          title: 'Test subject lines, then trust the winner',
          why: 'beehiiv tests up to four subject lines on a share of the list, 10% by default, for 5 to 240 minutes, sends the statistically significant winner to the rest, falls back to the most opens, and keeps the original on a tie.',
          steps: [
            'Write two to four subject lines for the same post.',
            'On beehiiv, run the A/B test with at least the default 10% and 60 minutes.',
            'On Substack there is no split test: compare two sends by delivered and opened with ZERACK, and only on sends of a similar size.',
            'Keep the winner\'s pattern for the next posts, not just the words.'
          ],
          doNow: 'Write three subject lines for your next post and test them.',
          proof: 'The three lines, the winner and its open rate.',
          surfaces: ['the subject line test'],
          sources: [S.abtest]
        },
        {
          id: 'n1-l3-opens',
          title: 'Read open rates with Apple Mail in mind',
          why: 'Apple Mail Privacy Protection prevents senders from seeing whether a message was opened, so opens from readers who turn it on do not tell you what they did; clicks and replies do.',
          steps: [
            'Read your post stats with ZERACK: sent, open rate and click rate per post.',
            'Rank posts by clicks and replies before opens.',
            'Use opens to compare subject lines inside one send, not posts across months.',
            'Ask readers one question per post: replies are the signal no privacy feature hides.'
          ],
          doNow: 'Rank your last ten posts by click rate and compare with the ranking by opens.',
          proof: 'Both rankings and the posts that move the most between them.',
          surfaces: ['the post stats'],
          sources: [S.mpp]
        }
      ]
    },
    {
      id: 'n2-grow',
      title: 'Grow and get paid',
      goal: 'Leave knowing what a paid subscriber leaves, how recommendations bring readers, and a list kept legal.',
      lessons: [
        {
          id: 'n2-l1-paid',
          title: 'Know what a paid subscriber leaves',
          why: 'Substack takes 10% of each transaction on paid subscriptions, and Stripe adds 2.9% plus $0.30 per card payment and a 0.7% billing fee on recurring payments.',
          steps: [
            'Write your monthly and yearly price.',
            'Work out what each payment leaves with the break-even tool.',
            'Compare the monthly and the yearly plan by what they leave in a year.',
            'Set the price from that, not from what rivals charge.'
          ],
          doNow: 'Work out what one monthly and one yearly subscriber leave.',
          proof: 'Both amounts, per payment and per year.',
          surfaces: ['the break-even tool'],
          sources: [S.cost]
        },
        {
          id: 'n2-l2-recommend',
          title: 'Grow with recommendations',
          why: 'On Substack you recommend other publications with a short blurb, their writers are prompted to recommend you back, and recommended publications are shown to your new readers when they subscribe.',
          steps: [
            'Read the archives of five publications your readers would like.',
            'Recommend the three whose topics land closest to yours, each with a real blurb.',
            'Read your subscriber count again in 30 days.',
            'Keep the recommendations that brought readers.'
          ],
          doNow: 'Add three recommendations with a blurb each.',
          proof: 'The three publications and your subscriber count today.',
          surfaces: ['a Substack archive'],
          sources: [S.recommend]
        },
        {
          id: 'n2-l3-legal',
          title: 'Keep the list legal',
          why: 'The FTC says marketing email needs a clear way to opt out honored within 10 business days and a valid postal address, and addresses of people who opted out cannot be sold or transferred.',
          steps: [
            'Only add people who asked to subscribe.',
            'Keep the unsubscribe link and your postal address in every send.',
            'Never import a list someone else collected.',
            'ZERACK never imports or exports subscriber lists: that stays with you.'
          ],
          doNow: 'Check your footer carries the unsubscribe link and your address.',
          proof: 'A screenshot of the footer.',
          surfaces: [],
          sources: [S.canSpam]
        }
      ]
    }
  ];

  var STATS = { title: ['post', 'title', 'post title'], sent: ['sent', 'recipients', 'delivered', 'emails sent'], openRate: ['open rate', 'opens %', 'opened'], opens: ['opens', 'unique opens'], clickRate: ['click rate', 'ctr', 'click through rate', 'clicked'], clicks: ['clicks', 'unique clicks'], subscribers: ['new subscribers', 'subscriptions', 'signups'], date: ['date', 'sent on', 'published'] };
  var STATS_TYPES = { sent: 'int', openRate: 'pct', opens: 'int', clickRate: 'pct', clicks: 'int', subscribers: 'int' };

  var PLAYBOOK = {
    id: 'newsletter',
    name: 'Newsletter',
    title: 'Grow a newsletter on Substack or beehiiv',
    business: 'a newsletter on Substack or beehiiv',
    sourceOwner: 'Substack, beehiiv, Apple and the FTC',
    strictTopic: true,
    updated: '2026-09-27',
    hosts: [{ host: /(^|\.)substack\.com$/ }, { host: /(^|\.)beehiiv\.com$/ }],
    named: /\b(?:newsletters?|boletin\w*|substack|beehiiv|subject lines?|lineas? de asunto|open rate|tasa de apertura)\b/,
    identity: 'You are ZERACK, the operator for newsletter writers on Substack and beehiiv. You read the archive and the stats on screen, find the topics that land, test subject lines with real numbers and work out what a paid subscriber leaves. The user presses Send and Publish. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for newsletter writers who thinks in topics that land, clicks and paid subscribers.',
    bottlenecks: 'topics readers do not share, subject lines picked by taste, open rates misread, no growth loop, or a price that leaves too little',
    assume: 'assume a writer with a few thousand free subscribers on Substack or beehiiv, and that the page on screen is their archive, their stats or a rival',
    hints: [
      [/\b(?:topics?|temas?|what lands|que funciona|best posts|mejores posts|likes|restacks?)\b/, 'n1-l1'],
      [/\b(?:subject lines?|asuntos?|a\/?b|test)\b/, 'n1-l2'],
      [/\b(?:opens?|open rate|aperturas?|clicks?|apple mail|privacy)\b/, 'n1-l3'],
      [/\b(?:paid|pago|price|precio|subscription|suscripcion|fees?|comision)\b/, 'n2-l1'],
      [/\b(?:grow|crecer|recommend\w*|recomend\w*|subscribers?|suscriptores)\b/, 'n2-l2'],
      [/\b(?:legal|spam|unsubscribe|import|export|list|lista)\b/, 'n2-l3']
    ],
    readers: [
      { id: 'table', as: 'substack.stats', host: /(^|\.)substack\.com$/, path: /^\/publish\/(posts|stats)/, label: 'the Substack post stats: sent, open rate, clicks and new subscribers per post', opts: { as: 'substack.stats', label: 'Substack post stats', columns: STATS, need: ['title'], types: STATS_TYPES, linkField: 'title' } },
      { id: 'table', as: 'beehiiv.posts', host: /(^|\.)beehiiv\.com$/, path: /^\/(posts|analytics)/, label: 'the beehiiv posts table: recipients, open rate and click rate per post', opts: { as: 'beehiiv.posts', label: 'beehiiv posts', columns: STATS, need: ['title'], types: STATS_TYPES, linkField: 'title' } },
      { id: 'substack.archive', host: /(^|\.)substack\.com$/, label: 'a Substack publication, rivals on their own domain included: every post of the archive with its likes, comments, restacks, length and date' }
    ],
    surfaces: {
      'a Substack archive': 'zerackExtract with reader substack.archive reads the published posts with likes, comments and restacks, and says what the most liked titles share',
      'the subject line test': 'zerackDecide with kind ab compares subject lines by delivered and opened, and says when there is enough to trust',
      'the post stats': 'zerackExtract with reader substack.stats or beehiiv.posts reads sent, open rate and click rate per post',
      'the break-even tool': 'zerackBreakEven works out what a paid subscription leaves after Substack and Stripe'
    },
    gate: {
      press: [
        { kind: 'Publish', re: /^(publish( now)?|schedule( post| send)?|continue to publish)\b/ },
        { kind: 'Pay', re: /^(enable paid subscriptions|turn on paid subscriptions|start (a )?boost)\b/ }
      ],
      never: [
        { why: 'it moves the subscriber list, which is yours to do by hand', re: /^(import (subscribers|emails|contacts|a list|list)|export (subscribers|emails|list|csv|contacts)|add subscribers|upload (a )?(csv|list))\b/, link: true },
        { why: 'it deletes or hands over the publication', re: /^(delete (this |the )?(publication|newsletter)|transfer (this |the )?publication)\b/, link: true }
      ]
    },
    readOnly: [],
    private: [
      { host: /(^|\.)substack\.com$/, path: /^\/publish\/settings|^\/account(\/|$)/, why: 'settings, payments and your account stay with you' },
      { host: /(^|\.)beehiiv\.com$/, path: /^\/settings(\/|$)/, why: 'settings and API keys stay with you' }
    ],
    fees: {
      model: 'plans',
      currency: 'USD',
      checked: '2026-09-27',
      note: 'Card payments on a US Stripe account; local currencies and other payment methods cost more.',
      defaultPlan: 'substack',
      plans: {
        substack: { label: 'Substack paid subscription', monthly: 0, lines: [
          { label: 'Substack, 10% of each transaction', rate: 0.10, source: S.cost },
          { label: 'Stripe card fee, 2.9% plus $0.30', rate: 0.029, fixed: 0.30, source: S.cost },
          { label: 'Stripe Billing on recurring payments, 0.7%', rate: 0.007, source: S.cost }
        ] }
      }
    },
    chips: ['Which of my posts landed, and why?', 'Test these subject lines for me', 'What does an $8 subscriber leave me?', 'How often does this rival publish?'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_NEWSLETTER', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
