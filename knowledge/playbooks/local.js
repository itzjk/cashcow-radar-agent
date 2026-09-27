(function (root) {
  var GBP = 'Google Business Profile Help';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    ranking: src('Tips to improve your local ranking on Google', 'https://support.google.com/business/answer/7091?hl=en', GBP),
    reviews: src('Manage customer reviews', 'https://support.google.com/business/answer/3474050?hl=en', GBP),
    moreReviews: src('Tips to get more reviews', 'https://support.google.com/business/answer/3474122?hl=en', GBP),
    content: src('Maps user-generated content policy', 'https://support.google.com/contributionpolicy/answer/7422880?hl=en', 'Maps User Generated Content Policy Help'),
    terms: src('Google Terms of Service', 'https://policies.google.com/terms?hl=en', 'Google'),
    canSpam: src('CAN-SPAM Act: A Compliance Guide for Business', 'https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business', 'Federal Trade Commission')
  };

  var MODULES = [
    {
      id: 'l1-rank',
      title: 'Win the local results',
      goal: 'Leave with your listing next to the places around you, your reviews answered, and more reviews coming in the allowed way.',
      lessons: [
        {
          id: 'l1-l1-ranking',
          title: 'Know what decides local ranking',
          why: 'Google says local results are mainly based on relevance, distance and prominence, that complete and accurate business info shows up more, that more reviews and positive ratings help, and that there is no way to request or pay for a better local ranking.',
          steps: [
            'Search your category and town on Google Maps and read the results with ZERACK.',
            'Compare your rating, number of reviews, website and hours with the places above you.',
            'Fill every gap in your profile first: category, hours, address, attributes and a website link.',
            'Then work on the reviews: that is the part of prominence you can move this month.'
          ],
          doNow: 'Read the results for your category and town and write where you lose to the three places above you.',
          proof: 'The three places, their rating and reviews, and your gaps.',
          surfaces: ['a Google Maps search'],
          sources: [S.ranking]
        },
        {
          id: 'l1-l2-replies',
          title: 'Answer reviews the way Google asks',
          why: 'Google reviews every reply before it goes public, usually within 10 minutes and sometimes up to 30 days, notifies the customer, and asks for replies that are short, specific, personal and not promotional, with an apology when it is due and no private details.',
          steps: [
            'Read your place with ZERACK: every review on screen, its stars and whether you answered it.',
            'Answer the negative reviews first, newest first, then the ones with a question.',
            'Use the reviewer\'s name and their point; explain what you can and cannot do.',
            'Never offer a deal in a reply. ZERACK drafts it and Reply waits for your press.'
          ],
          doNow: 'Read your reviews and answer the three unanswered ones that matter most.',
          proof: 'The three replies you posted.',
          surfaces: ['a Google Maps place'],
          sources: [S.reviews, S.moreReviews]
        },
        {
          id: 'l1-l3-more',
          title: 'Get more reviews without breaking the rules',
          why: 'Google lets you ask customers for reviews with a link or a QR code, and treats offering anything, such as free or discounted goods, in exchange for posting, changing or removing a review as fake and misleading content that is strictly prohibited.',
          steps: [
            'Create your review link or QR code from the profile.',
            'Ask every customer once, after the job is done, with no reward attached.',
            'Put the QR code where customers pay or pick up.',
            'Read your place again in 30 days to see the count move.'
          ],
          doNow: 'Create the review link and send it to the last five customers.',
          proof: 'The count of reviews today and in 30 days.',
          surfaces: ['a Google Maps place'],
          sources: [S.moreReviews, S.content]
        }
      ]
    },
    {
      id: 'l2-clients',
      title: 'Find clients for your agency',
      goal: 'Leave with the local businesses you can actually help, and one honest, legal message to each, inside a daily cap.',
      lessons: [
        {
          id: 'l2-l1-pick',
          title: 'Pick businesses you can help',
          why: 'Google says businesses with complete and accurate information are more likely to show in local results, and that prominence counts how many websites link to a business and how many reviews it has, so a listing with no website or few reviews has a problem you can name, and a complete one with strong reviews leaves you nothing to say.',
          steps: [
            'Search the category and town you serve on Google Maps and read the results with ZERACK.',
            'Tell ZERACK what you sell in one line: websites, reviews, local search or ads.',
            'Let the judge mark each place Pitch, Look at it or Skip, with the fact behind it.',
            'Skip the places where there is nothing true to say: that is a result, not a failure.'
          ],
          doNow: 'Read one search, set your offer and list the places marked Pitch.',
          proof: 'The places to pitch, each with the fact you will mention.',
          surfaces: ['a Google Maps search'],
          sources: [S.ranking]
        },
        {
          id: 'l2-l2-message',
          title: 'Write outreach that is legal and honest',
          why: 'The FTC says commercial email must not use false headers or deceptive subject lines, must identify itself as an ad, carry a valid postal address and a clear way to opt out honored within 10 business days, and each email in violation can cost up to $53,088.',
          steps: [
            'Draft with ZERACK: it names one true fact from their listing, says it is an offer of services, adds your name and address and a line to say no.',
            'It also says an AI assistant helped draft it: say it plainly.',
            'Send inside the daily cap: it starts at 5 and grows 5 a day, never twice to the same place, and stops for the day at 3 bounces.',
            'When someone says no, mark it: ZERACK never writes to them again.'
          ],
          doNow: 'Save your name, business and postal address once, then draft the message for the best place.',
          proof: 'The draft with its checks passed.',
          surfaces: ['the lead drafts'],
          sources: [S.canSpam]
        },
        {
          id: 'l2-l3-pace',
          title: 'Read only what you open',
          why: 'Google\'s terms forbid using automated means to access its services against the machine-readable instructions on its pages, so ZERACK reads the results you have open, when you ask, and never walks through Maps on its own.',
          steps: [
            'Run each search yourself and scroll the list you want read.',
            'Ask ZERACK to read it once; it keeps what it read and judged.',
            'Open a place yourself when you want its reviews read.',
            'Leave calls and visits to yourself; ZERACK gives you the script.'
          ],
          doNow: 'Read one search this way and keep the list.',
          proof: 'The saved list with its verdicts.',
          surfaces: ['a Google Maps search'],
          sources: [S.terms]
        }
      ]
    }
  ];

  var PLAYBOOK = {
    id: 'local',
    name: 'Local business',
    title: 'Grow a local business on Google, or find local clients',
    business: 'a local business on Google Maps, or an agency that sells to local businesses',
    sourceOwner: 'Google and the FTC',
    updated: '2026-09-27',
    hosts: [
      { host: /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/, path: /^\/maps(\/|$)/ },
      { host: /^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/ },
      { host: /^business\.google\.com$/ }
    ],
    named: /\b(?:google maps|business profile|google business|local business\w*|negocios? locales?|negocio local|clientes locales|local clients|my agency|mi agencia|reviews? on google|resenas en google)\b/,
    identity: 'You are ZERACK, the operator for local businesses on Google Maps and for the agencies that serve them. You read the results and places on screen, compare a business with the places around it, draft review replies, and find the local businesses an agency can honestly help, with one legal, honest message each. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for local businesses and agencies who thinks in reviews, prominence and honest outreach.',
    bottlenecks: 'an incomplete profile, too few reviews, unanswered negative reviews, no website on the listing, or outreach that is generic, repeated or breaks the law',
    assume: 'assume a small local business or a one-person agency in the United States, and that the Maps page on screen is their own search or place',
    hints: [
      [/\b(?:rank\w*|posicion\w*|local results|resultados|above me|encima|prominence|compare|comparar)\b/, 'l1-l1'],
      [/\b(?:repl\w*|respond\w*|answer\w*|contest\w*|responder|negative reviews?|malas resenas|unanswered|sin respuesta)\b/, 'l1-l2'],
      [/\b(?:more reviews|mas resenas|get reviews|conseguir resenas|qr)\b/, 'l1-l3'],
      [/\b(?:clients?|clientes|leads?|prospect\w*|pitch|who to (?:call|email|contact)|a quien)\b/, 'l2-l1'],
      [/\b(?:email|correo|message|mensaje|outreach|cold|spam|draft|borrador)\b/, 'l2-l2']
    ],
    readers: [
      { id: 'maps.place', host: /^(www\.|maps\.)?google\.[a-z.]+$/, path: /^\/maps\/place\//, label: 'a Google Maps place: rating, reviews, category, website, phone, hours, and every review on screen with whether the owner answered' },
      { id: 'maps.results', host: /^(www\.|maps\.)?google\.[a-z.]+$/, path: /^\/maps(\/|$)/, label: 'a Google Maps search: every place on screen with its rating, reviews, category, address, website and phone' }
    ],
    surfaces: {
      'a Google Maps search': 'zerackExtract with reader maps.results reads the places on screen; zerackLeads find judges each one Pitch, Look at it or Skip for the user\'s offer',
      'a Google Maps place': 'zerackExtract with reader maps.place reads the rating and every review on screen with whether it was answered',
      'the lead drafts': 'zerackLeads draft writes the message with one true fact, the offer line, the AI disclosure and the opt-out; sending waits for the user press inside the daily cap'
    },
    gate: {
      press: [
        { kind: 'Publish', re: /^(add update|post update|add offer|add event|add photos?)\b/ },
        { kind: 'Pay', re: /^(advertise|create (an )?ad|start (an )?ad|promote( your)?( business| profile)?)\b/ }
      ],
      never: [
        { why: 'it closes or hands over the business profile', re: /^(mark (as )?(permanently |temporarily )?closed|remove (this )?(business|profile|listing)|delete (this )?(business )?profile|transfer (primary )?ownership|remove (manager|owner|user)|add (a )?(manager|owner|user))\b/, link: true },
        { why: 'reviews must come from real customers, so ZERACK never writes one', re: /^(write a review|post (a )?review|rate and review)\b/, link: true }
      ]
    },
    readOnly: [],
    private: [
      { host: /^business\.google\.com$/, path: /\/settings(\/|$)|\/managers(\/|$)|\/users(\/|$)/, why: 'profile managers and settings stay with you' }
    ],
    terms: { pace: true, rule: 'Google\'s terms forbid automated access to its services against the machine-readable instructions on its pages, so ZERACK reads only the results you have open, when you ask', source: S.terms },
    leads: 'place',
    fees: null,
    chips: ['Which of these businesses should I pitch?', 'Draft the message for the best one', 'How do I compare with the places around me?', 'Which reviews should I answer first?'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_LOCAL', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
