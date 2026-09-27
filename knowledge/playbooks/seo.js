(function (root) {
  var CENTRAL = 'Google Search Central';
  var SC = 'Search Console Help';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    performance: src('Performance report (Search results): overview and basic setup', 'https://support.google.com/webmasters/answer/7576553?hl=en', SC),
    helpful: src('Creating helpful, reliable, people-first content', 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', CENTRAL),
    titleLink: src('Influencing title links in Google Search', 'https://developers.google.com/search/docs/appearance/title-link', CENTRAL),
    snippet: src('How to write meta descriptions', 'https://developers.google.com/search/docs/appearance/snippet', CENTRAL),
    starter: src('SEO Starter Guide: the basics', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', CENTRAL),
    inspection: src('URL Inspection tool', 'https://support.google.com/webmasters/answer/9012289?hl=en', SC),
    indexing: src('Page indexing report', 'https://support.google.com/webmasters/answer/7440203?hl=en', SC),
    sitemaps: src('Sitemaps report', 'https://support.google.com/webmasters/answer/7451001?hl=en', SC),
    genAi: src('Google Search\'s guidance on generative AI content on your website', 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content', CENTRAL),
    spam: src('Spam policies for Google web search', 'https://developers.google.com/search/docs/essentials/spam-policies', CENTRAL),
    removals: src('Removals and SafeSearch reports tool', 'https://support.google.com/webmasters/answer/9689846?hl=en', SC),
    disavow: src('Disavow links to your site', 'https://support.google.com/webmasters/answer/2648487?hl=en', SC)
  };

  var MODULES = [
    {
      id: 'g1-performance',
      title: 'Read what Google already sends you',
      goal: 'Leave with the queries and pages that already get seen, ranked by what a small change could win.',
      lessons: [
        {
          id: 'g1-l1-read-the-report',
          title: 'Read clicks, impressions, CTR and position',
          why: 'Search Console counts a click each time someone clicks your site from Google Search results and an impression each time your site appears in them; CTR is clicks divided by impressions and position is the average position of your topmost result, and the newest data can still change.',
          steps: [
            'Open Performance, then Search results, on the last three months, which is the default range.',
            'Turn on all four metrics: clicks, impressions, CTR and average position.',
            'Read the table by query first, then by page.',
            'Leave the last two days out of any comparison: the newest data is preliminary.',
            'Remember that someone else searching the same words may not see your site: results depend on place, device and history.'
          ],
          doNow: 'Read the queries table and write the five queries with the most impressions, with their CTR and position.',
          proof: 'Five queries, each with impressions, CTR and position.',
          surfaces: ['the Search Console Performance report'],
          sources: [S.performance]
        },
        {
          id: 'g1-l2-page-two',
          title: 'Improve the pages that already rank on page two',
          why: 'A query where a page averages position 8 to 20 with many impressions is one Google already finds the page relevant for; ZERACK works that band first, and Google says the way up is content that serves the person searching, not content made for rankings.',
          steps: [
            'Filter the queries to an average position between 8 and 20 and sort by impressions.',
            'Open the page that ranks for each one and read it as the person who typed the query.',
            'Add what that person came for and the page lacks: the answer, the numbers, the steps, first hand experience.',
            'Skip queries with fewer than 200 impressions: there is not enough evidence yet.',
            'Compare the same full weeks before and after, and only while the position stays within one place, before you call it a win.'
          ],
          doNow: 'Pick the query with the most impressions between positions 8 and 20 and list what its page is missing.',
          proof: 'One query, its page, and a list of what the page adds.',
          surfaces: ['the Search Console Performance report', 'the WordPress editor'],
          sources: [S.performance, S.helpful]
        },
        {
          id: 'g1-l3-titles',
          title: 'Fix titles that get seen and not clicked',
          why: 'Google builds the title link from the title element and other prominent text on the page, and asks for titles that are descriptive and concise, without boilerplate or keyword stuffing; a good meta description can become the snippet.',
          steps: [
            'Find pages whose CTR sits far below the site\'s own pages at a similar position.',
            'Rewrite the title so it names the page\'s main subject in plain words, once, near the start.',
            'Remove repeated boilerplate such as the same brand phrase on every page.',
            'Write a meta description that summarizes the page for that query in one or two sentences.',
            'Change one page at a time and wait for full weeks of data before judging it.'
          ],
          doNow: 'Rewrite the title and meta description of the page with the lowest CTR for its position.',
          proof: 'The old and the new title and description, with the date of the change.',
          surfaces: ['the Search Console Performance report', 'the WordPress editor'],
          sources: [S.titleLink, S.snippet, S.starter]
        }
      ]
    },
    {
      id: 'g2-indexing',
      title: 'Get the pages indexed',
      goal: 'Leave with every page that matters in the index, or a known reason why not.',
      lessons: [
        {
          id: 'g2-l1-inspect',
          title: 'Check a page with URL Inspection',
          why: 'URL Inspection shows whether Google has indexed a page and why not, and can ask Google to crawl it again after a fix.',
          steps: [
            'Paste the page address into the inspection bar at the top of Search Console.',
            'Read whether the page is on Google and, if not, the reason given.',
            'Fix the reason on the page first; a request without a fix changes nothing.',
            'Request indexing once for the fixed page; ZERACK waits for your press before it sends the request.'
          ],
          doNow: 'Inspect the page you most want to rank and write its index status and reason.',
          proof: 'The address, its status and the reason in one line.',
          surfaces: ['Search Console'],
          sources: [S.inspection]
        },
        {
          id: 'g2-l2-indexing-report',
          title: 'Read the Page indexing report',
          why: 'The Page indexing report groups every page Google knows by whether it is indexed and why not, and a submitted sitemap tells Google which pages you want in the index.',
          steps: [
            'Open Indexing, then Pages, and read the reasons pages are not indexed.',
            'Start with the reason that holds the most pages you care about.',
            'Fix it on the site, then validate the fix from the report; ZERACK waits for your press.',
            'Check the Sitemaps report: the sitemap should be read without errors.'
          ],
          doNow: 'Write the top reason pages are not indexed and how many pages it holds.',
          proof: 'One reason and its page count.',
          surfaces: ['Search Console'],
          sources: [S.indexing, S.sitemaps]
        }
      ]
    },
    {
      id: 'g3-safe',
      title: 'Stay on the right side of Google',
      goal: 'Leave with content made for readers and with the dangerous tools left to a person.',
      lessons: [
        {
          id: 'g3-l1-ai-content',
          title: 'Use AI to help readers, not to mass produce pages',
          why: 'Google says generative AI can help create useful content, but using automation to produce many pages mainly to manipulate rankings breaks its spam policy on scaled content abuse.',
          steps: [
            'Use drafts from ZERACK as a start and add what only you know: tests, photos, numbers, experience.',
            'Publish a page only when it answers its query better than what already ranks.',
            'Never publish pages in bulk that differ only by a swapped word such as a city or a product name.'
          ],
          doNow: 'Take your last generated page and add one thing only you could have written.',
          proof: 'The page with the added section marked.',
          surfaces: ['the WordPress editor'],
          sources: [S.genAi, S.spam]
        },
        {
          id: 'g3-l2-dangerous-tools',
          title: 'Leave removals and disavow to a person',
          why: 'The Removals tool hides pages from Google Search results, and Google warns that disavowing links can harm how the site performs if used wrongly, so ZERACK asks for a press before a removal and never disavows.',
          steps: [
            'Use a removal only for a page that must not show, such as leaked private data, and fix the page itself too.',
            'Do not disavow links unless there is a manual action or you are sure the links are harming the site.',
            'If you decide to disavow, do it yourself in Search Console.'
          ],
          doNow: 'Check that no removal request is active by mistake.',
          proof: 'The Removals page with no request you did not mean.',
          surfaces: ['Search Console'],
          sources: [S.removals, S.disavow]
        }
      ]
    }
  ];

  var GSC = { query: ['top queries', 'queries', 'query'], page: ['top pages', 'pages', 'page'], clicks: ['clicks'], impressions: ['impressions'], ctr: ['ctr'], position: ['position'] };
  var WP = { title: ['title'], author: ['author'], categories: ['categories'], date: ['date'] };

  var PLAYBOOK = {
    id: 'seo',
    name: 'Search Console',
    title: 'Grow search traffic with Google Search Console',
    business: 'a site that lives on search traffic',
    sourceOwner: 'Google',
    updated: '2026-09-26',
    hosts: [{ host: /^search\.google\.com$/, path: /^\/search-console/ }, { host: /./, path: /^\/wp-admin(\/|$)/ }],
    named: /\b(?:seo|search console|google search|organic traffic|trafico organico|posicionamiento|wordpress)\b/,
    identity: 'You are ZERACK, the operator for sites that live on Google search traffic. You read Search Console and the site admin in front of the user, and you rewrite titles and pages with them. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for sites that live on search, who thinks in clicks, impressions and pages.',
    bottlenecks: 'pages not indexed, queries stuck on page two, titles that are seen and not clicked, or content that does not serve the person searching',
    assume: 'assume a small site with one Search Console property, that the table on screen covers the last three months, and that the site owner writes in the language of the queries',
    hints: [
      [/\b(?:ctr|click.?through|titles?|titulos?|meta description|snippet)\b/, 'g1-l3'],
      [/\b(?:page two|pagina dos|segunda pagina|position|posicion|rank|refresh|actualizar)\b/, 'g1-l2'],
      [/\b(?:clicks?|impressions?|impresiones|performance|rendimiento)\b/, 'g1-l1'],
      [/\b(?:index\w*|indexa\w*|not indexed|crawl\w*|inspection|inspeccion)\b/, 'g2-l1'],
      [/\b(?:sitemaps?|coverage|cobertura)\b/, 'g2-l2'],
      [/\b(?:ai|ia|generated|generado|spam|scaled)\b/, 'g3-l1'],
      [/\b(?:remov\w*|disavow|eliminar url)\b/, 'g3-l2']
    ],
    readers: [
      { id: 'table', as: 'gsc.queries', host: /^search\.google\.com$/, label: 'the Search Console Performance table: each query or page with clicks, impressions, CTR and position', opts: { as: 'gsc.queries', label: 'Search Console performance', columns: GSC, need: ['clicks', 'impressions', 'position'], types: { clicks: 'int', impressions: 'int', ctr: 'pct', position: 'num' } } },
      { id: 'table', as: 'wp.posts', path: /^\/wp-admin\/edit\.php/, label: 'the WordPress posts list: title, author, categories and date of each post', opts: { as: 'wp.posts', label: 'WordPress posts', columns: WP, need: ['title'], strip: '.row-actions, .screen-reader-text, .toggle-row, .post-state', linkField: 'title' } }
    ],
    surfaces: {
      'the Search Console Performance report': 'zerackExtract with reader gsc.queries reads the table on screen and ranks what to fix: page two queries and titles seen and not clicked',
      'the WordPress editor': 'zerackPage fills the title, the content and the SEO fields; Update and Publish wait for the user press',
      'Search Console': 'zerackPage reads the page on screen; requests to Google wait for the user press, and disavow is refused'
    },
    gate: {
      press: [
        { kind: 'Send', re: /^(request indexing|validate fix|start validation|submit( sitemap| a sitemap)?|resubmit)\b/ },
        { kind: 'Delete', re: /^(new request|remove( url| this url| sitemap)?|temporarily remove( url)?|clear (cached )?url|move to trash|empty trash|delete permanently)\b/ }
      ],
      never: [
        { why: 'disavowing links can change how Google counts every link to the site', re: /^(disavow|upload disavow list|submit disavow)/ },
        { why: 'it changes who can reach the Search Console property', re: /^(add user|add owner|remove (user|owner|access)|manage property owners|change of address)\b/ }
      ]
    },
    readOnly: [],
    fees: null,
    chips: ['Which pages should I refresh first?', 'Which titles get seen and not clicked?', 'Why is my page not on Google?', 'Rewrite the title of this post'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_SEO', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
