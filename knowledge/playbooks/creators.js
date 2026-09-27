(function (root) {
  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var S = {
    forYou: src('How TikTok recommends videos #ForYou (June 18, 2020)', 'https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you', 'TikTok Newsroom'),
    rewards: src('Introducing the New Creator Rewards Program (March 18, 2024)', 'https://newsroom.tiktok.com/introducing-the-new-creator-rewards-program?lang=en', 'TikTok Newsroom'),
    terms: src('Terms of Service', 'https://www.tiktok.com/legal/page/us/terms-of-service/en', 'TikTok'),
    ranking: src('Instagram Ranking Explained, by Adam Mosseri (May 31, 2023)', 'https://about.instagram.com/blog/announcements/instagram-ranking-explained', 'Instagram'),
    recommendations: src('Recommendations on Instagram', 'https://help.instagram.com/313829416281232', 'Instagram Help Center')
  };

  var MODULES = [
    {
      id: 'c1-find',
      title: 'Find the ideas that already broke out',
      goal: 'Leave with the ideas that broke out on your profile and on two rivals, measured against each profile.',
      lessons: [
        {
          id: 'c1-l1-outliers',
          title: 'Read a profile for its outliers',
          why: 'TikTok says neither follower count nor earlier high-performing videos are direct factors in what it recommends, so every video is judged on its own, and the videos that broke out on a profile show which idea the feed pushed, not which account.',
          steps: [
            'Open the profile, yours or a rival, and scroll until the grid shows the videos you want read.',
            'Read it with ZERACK: every view count on screen, the median of the profile, and each video at 3 times that median or more.',
            'Leave pinned videos aside when you judge: they stay on top because the creator chose them, not because they are new.',
            'Write what the outliers share: the topic, the first line, the format and the length.',
            'Do the same on two rivals of your size before you decide your next three videos.'
          ],
          doNow: 'Read your profile and one rival and write the idea behind each outlier.',
          proof: 'The outliers of both profiles with their views and the median they beat.',
          surfaces: ['a TikTok or Instagram profile'],
          sources: [S.forYou]
        },
        {
          id: 'c1-l2-original',
          title: 'Copy the idea, never the video',
          why: 'Instagram does not recommend unoriginal content that is largely repurposed from another source with only minor edits, and ranks watermarked or previously posted reels lower; TikTok pays its creator rewards on originality.',
          steps: [
            'Take the idea and the structure of the outlier, not its footage, its audio track or its words.',
            'Shoot or build it with your own material and your own point of view.',
            'Never upload a video that carries another app\'s watermark.',
            'Say in one line what your version adds that the outlier did not have.'
          ],
          doNow: 'Take one outlier from the last lesson and write what your own version adds.',
          proof: 'One line per video: the outlier it comes from and what is new in yours.',
          surfaces: [],
          sources: [S.recommendations, S.ranking, S.rewards]
        }
      ]
    },
    {
      id: 'c2-watch',
      title: 'Make videos the feed keeps showing',
      goal: 'Leave with hooks and endings built for the signals each platform says it weighs.',
      lessons: [
        {
          id: 'c2-l1-finish',
          title: 'Hold the viewer to the end',
          why: 'TikTok weighs a strong signal such as whether a viewer finishes a longer video from beginning to end more than weaker ones, and it names captions, sounds and hashtags as the video information it reads.',
          steps: [
            'Write three first lines for the same video: a question, a surprising number and a promise of the ending.',
            'Keep the payoff for the last seconds so finishing is worth it.',
            'Cut every second that does not move toward that payoff.',
            'Write a caption that says what the video is about in words people search for.',
            'Compare the three versions by views and completion with ZERACK once each has run.'
          ],
          doNow: 'Write three hooks for your next video and pick one.',
          proof: 'The three hooks, the one you used and why.',
          surfaces: ['the hook comparison'],
          sources: [S.forYou]
        },
        {
          id: 'c2-l2-signals',
          title: 'Know what each platform ranks',
          why: 'Instagram ranks reels by what the viewer liked, saved, reshared and commented on, their history with the creator, and the reel itself (audio, visuals and popularity); Explore weighs how many people like, comment, share and save a post, and how fast.',
          steps: [
            'Give people a reason to save or send the video: a list, a template, a result worth sharing.',
            'Ask a question in the caption that people want to answer.',
            'Use audio that fits the video; a sound is part of what the platform reads.',
            'Post when your followers are active, then read the first hour.'
          ],
          doNow: 'Add one reason to save and one reason to send to your next video.',
          proof: 'The two lines you added and the saves and shares after two days.',
          surfaces: ['a TikTok video'],
          sources: [S.ranking, S.forYou]
        }
      ]
    },
    {
      id: 'c3-paid',
      title: 'Get paid without shortcuts',
      goal: 'Leave knowing how far you are from the TikTok Creator Rewards Program, grown without bought reach.',
      lessons: [
        {
          id: 'c3-l1-rewards',
          title: 'Qualify for the Creator Rewards Program',
          why: 'TikTok requires creators to be at least 18, with at least 10K followers and 100K views in the last 30 days, and rewards original, high-quality videos over a minute long by originality, play duration, search value and audience engagement.',
          steps: [
            'Read your profile with ZERACK: followers, total likes and the views of the videos on screen.',
            'Count how many of your recent videos run over one minute.',
            'Add the views of the last 30 days from TikTok Studio; the grid alone does not date the videos.',
            'Plan the next videos over one minute, built on the outliers you found.'
          ],
          doNow: 'Write your followers, your views of the last 30 days and how many videos run over a minute.',
          proof: 'Three numbers and the gap to 10K followers and 100K views.',
          surfaces: ['a TikTok or Instagram profile'],
          sources: [S.rewards]
        },
        {
          id: 'c3-l2-no-shortcuts',
          title: 'Grow without buying reach',
          why: 'Instagram avoids recommending accounts that repeatedly used misleading practices to build a following, such as purchasing likes, and TikTok\'s terms forbid extracting data from the platform with automated software; ZERACK reads only the page you open and never follows, likes or reposts for you.',
          steps: [
            'Never buy followers, likes or views.',
            'Follow, like and comment by hand, as yourself.',
            'Let ZERACK read the page you are on when you ask; it does not walk through profiles on its own.',
            'Post and send messages yourself: ZERACK prepares and waits for your press.'
          ],
          doNow: 'Check that no tool you use follows, likes or posts for you on its own.',
          proof: 'The list of tools with access to your accounts, and the ones you removed.',
          surfaces: [],
          sources: [S.recommendations, S.terms]
        }
      ]
    }
  ];

  var PLAYBOOK = {
    id: 'creators',
    name: 'Creators',
    title: 'Grow on TikTok and Instagram',
    business: 'a creator account on TikTok or Instagram',
    sourceOwner: 'TikTok and Instagram',
    strictTopic: true,
    updated: '2026-09-27',
    hosts: [{ host: /^(www\.|m\.)?tiktok\.com$/ }, { host: /^(www\.)?instagram\.com$/ }],
    named: /\b(?:tiktok|tik tok|instagram|reels?|creator rewards|creator fund|for you page|fyp)\b/,
    identity: 'You are ZERACK, the operator for creators on TikTok and Instagram. You read the profile and the videos on screen, find the ideas that broke out against each profile\'s own median, and prepare the next videos, hooks and captions with the user. You are not an assistant: you are the partner who reads the numbers and does the work.',
    identityLean: 'You are ZERACK, a brutally honest operator for TikTok and Instagram creators who thinks in outliers, watch time and originality.',
    bottlenecks: 'ideas nobody wants, a first second that loses the viewer, copied videos the platforms do not recommend, videos too short for the rewards program, or reach bought instead of earned',
    assume: 'assume a faceless or small creator account posting short videos, and that the profile on screen is theirs or a rival of their size',
    hints: [
      [/\b(?:outliers?|viral\w*|what works|que funciona|best videos|mejores videos|broke out|reventaron)\b/, 'c1-l1'],
      [/\b(?:copy|copiar|copio|remake|repost\w*|reupload|original\w*|watermark)\b/, 'c1-l2'],
      [/\b(?:hooks?|ganchos?|retention|retencion|watch time|finish|primer segundo|first second)\b/, 'c2-l1'],
      [/\b(?:reels?|explore|algorithm|algoritmo|ranking|saves?|shares?|guardados)\b/, 'c2-l2'],
      [/\b(?:monetiz\w*|creator rewards|rewards program|get paid|cobrar|me pagan|dinero)\b/, 'c3-l1'],
      [/\b(?:buy (?:followers|likes|views)|comprar (?:seguidores|likes|vistas)|bots?|shortcuts?|atajos?)\b/, 'c3-l2']
    ],
    readers: [
      { id: 'tiktok.video', host: /^(www\.|m\.)?tiktok\.com$/, path: /^\/@[^\/]+\/(video|photo)\/[0-9]+/, label: 'a TikTok video: views, likes, comments, shares, saves, the sound and the hashtags' },
      { id: 'tiktok.profile', host: /^(www\.|m\.)?tiktok\.com$/, path: /^\/@[^\/]+\/?$/, label: 'a TikTok profile: followers, likes, and the views of every video on screen with the outliers at 3 times the median' },
      { id: 'instagram.profile', host: /^(www\.)?instagram\.com$/, path: /^\/[A-Za-z0-9._]+\/(reels\/)?$/, label: 'an Instagram profile: followers, posts, and the plays of every reel on screen with the outliers at 3 times the median' }
    ],
    surfaces: {
      'a TikTok or Instagram profile': 'zerackExtract with reader tiktok.profile or instagram.profile reads the views on screen and marks the outliers at 3 times the profile median',
      'a TikTok video': 'zerackExtract with reader tiktok.video reads its views, likes, comments, shares, saves, sound and hashtags',
      'the hook comparison': 'zerackDecide with kind ab compares versions by views and completions once the user gives them'
    },
    gate: {
      press: [
        { kind: 'Publish', re: /^(share|share now|post now|go live)$/ },
        { kind: 'Pay', re: /^(get coins|buy coins|recharge|send (a )?gift|promote( this)?( video| post| reel)?|boost( post| reel)?)\b/ }
      ],
      never: [
        { why: 'follows, likes, saves and reposts are yours to give by hand, and automating them breaks the platform terms', re: /^(follow|follow back|unfollow|following|like|unlike|liked|repost|reposted|stitch|duet|add to favorites|favorite|save)$|^(like|unlike|follow|unfollow|repost|save) (this |the )?(video|reel|post|account|user|comment|profile)\b/, link: true }
      ]
    },
    readOnly: [],
    private: [
      { host: /^(www\.)?tiktok\.com$/, path: /^\/setting(s)?(\/|$)|^\/tiktokstudio\/(settings|monetization|balance)/, why: 'settings and earnings stay with you' },
      { host: /^(www\.)?instagram\.com$/, path: /^\/accounts\/(edit|password|privacy_and_security|two_factor_authentication|login|emailsignup|access_tool|manage_access)/, why: 'account settings and sign-in stay with you' }
    ],
    terms: { pace: true, rule: 'TikTok forbids scraping or extracting data from the platform with automated software, so ZERACK reads only the page you have open, when you ask, and never walks through profiles on its own', source: S.terms },
    fees: null,
    chips: ['Which videos on this profile are outliers?', 'Give me 3 hooks for my next video', 'Am I close to the Creator Rewards Program?', 'What should I take from this rival, and what not?'],
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

  Object.defineProperty(root, 'NSP_PLAYBOOK_CREATORS', { value: freeze(PLAYBOOK), writable: false, configurable: false });
})(typeof self !== 'undefined' ? self : this);
