(function (root) {
  var YT = 'YouTube Help';
  var PADDY = 'Paddy Galloway (@PaddyG96)';
  var ONEOFTEN = '1of10 (@1of10media)';
  var VIDIQ = 'vidIQ (@vidIQ)';

  function src(title, url, author) {
    return { title: title, url: url, author: author };
  }

  var SOURCES = {
    ypp: src('YouTube Partner Program overview and eligibility', 'https://support.google.com/youtube/answer/72851?hl=en', YT),
    monetizationPolicies: src('YouTube channel monetization policies', 'https://support.google.com/youtube/answer/1311392?hl=en', YT),
    disclosure: src('Disclosing use of GenAI content', 'https://support.google.com/youtube/answer/14328491?hl=en', YT),
    abTest: src('A/B test titles and thumbnails', 'https://support.google.com/youtube/answer/13861714?hl=en', YT),
    titleTips: src('Thumbnail and title tips', 'https://support.google.com/youtube/answer/12340300?hl=en', YT),
    discovery: src('Search and discovery tips', 'https://support.google.com/youtube/answer/11914225?hl=en', YT),
    ctrFaq: src('Impressions and click-through rate FAQs', 'https://support.google.com/youtube/answer/7628154?hl=en', YT),
    retention: src('Measure key moments for audience retention', 'https://support.google.com/youtube/answer/9314415?hl=en', YT),
    rpm: src('Understand ad revenue analytics', 'https://support.google.com/youtube/answer/9314357?hl=en', YT),
    midRoll: src('Manage mid-roll ad breaks in long videos', 'https://support.google.com/youtube/answer/6175006?hl=en', YT),
    advancedFeatures: src('Learn about feature access for YouTube creators', 'https://support.google.com/youtube/answer/9890437?hl=en', YT),
    strikes: src('Community Guidelines strike basics on YouTube', 'https://support.google.com/youtube/answer/2802032?hl=en', YT),
    shortsRevenue: src('YouTube Shorts monetization policies', 'https://support.google.com/youtube/answer/12504220?hl=en', YT),
    ceoLetter: src('The future of YouTube: the 2026 letter', 'https://blog.youtube/inside-youtube/the-future-of-youtube-2026/', 'Neal Mohan, CEO of YouTube'),
    slopPurge: src('YouTube\'s AI slop purge is punishing the human creators who never showed their faces', 'https://thenextweb.com/news/youtube-ai-slop-crackdown-faceless-creators-collateral-damage', 'Ana Maria Constantin, TNW'),

    subNiche: src('Pick a sub-niche, conquer that first, then expand outwards', 'https://x.com/PaddyG96/status/2075595778408517766', PADDY),
    twelveSteps: src('Twelve steps to grow a channel from scratch in twelve months', 'https://x.com/PaddyG96/status/1803096396083396633', PADDY),
    nicheVenn: src('Step 1: find the niche where passion, skill and demand overlap', 'https://x.com/PaddyG96/status/1803096397622693987', PADDY),
    laserFocus: src('Step 2: laser focus on one niche, even a sub-niche', 'https://x.com/PaddyG96/status/1803096398981648805', PADDY),
    twoPerWeek: src('Step 4: make 2 videos every week for 4 months', 'https://x.com/PaddyG96/status/1803096401892552909', PADDY),
    hundredIdeas: src('Step 5: at 32 videos, come up with 100 ideas a week around outliers', 'https://x.com/PaddyG96/status/1803096403549331645', PADDY),
    outlierThreeX: src('Outliers are ideas that did 3x or 4x the average for other channels', 'https://x.com/PaddyG96/status/1803096405503828421', PADDY),
    twoThumbnails: src('Step 6: make at least 2 thumbnails per video', 'https://x.com/PaddyG96/status/1803096406871167169', PADDY),
    retentionCurves: src('Step 7: learn how to read retention curves', 'https://x.com/PaddyG96/status/1803096408246927776', PADDY),
    oneAWeek: src('Step 8: switch to one video a week for 4 months and focus on quality', 'https://x.com/PaddyG96/status/1803096409568067682', PADDY),
    bangersFlops: src('Step 9: at 48 videos, compare your top 5 and bottom 5', 'https://x.com/PaddyG96/status/1803096411128336567', PADDY),
    bangersFlopsWhy: src('Write down why the top 5 worked, eliminate what sank the bottom 5, study YouTube 4 hours a week', 'https://x.com/PaddyG96/status/1803096412462129237', PADDY),
    feedbackLoop: src('Step 11: study performance and the retention curve 7 days after release', 'https://x.com/PaddyG96/status/1803096413850517732', PADDY),
    twelveMonths: src('After 12 months: 60+ videos and the foundations of the craft', 'https://x.com/PaddyG96/status/1803096416648044701', PADDY),
    twoYears: src('If starting from 0, give it 2 years; make 3 thumbnails and 10 titles per video', 'https://x.com/PaddyG96/status/1788967951376298465', PADDY),
    retentionAndOutliers: src('Focus on retention curves and views; brainstorm around videos at 3x a channel average', 'https://x.com/PaddyG96/status/1788967952588357676', PADDY),
    postIt: src('Post the video; place more mid-rolls, not all will be displayed', 'https://x.com/PaddyG96/status/1788967953834062094', PADDY),
    nonLinear: src('Do not expect linear growth or a predictable platform', 'https://x.com/PaddyG96/status/1788967955025236223', PADDY),
    ideaCeiling: src('The idea sets the ceiling; brainstorm 10 ideas a day; build buckets around your best formats', 'https://x.com/PaddyG96/status/1788967956254224390', PADDY),
    audienceNotSchedule: src('What you post matters more than when; improve one thing every video', 'https://x.com/PaddyG96/status/1788967957491593669', PADDY),
    thumbnailWords: src('Keep thumbnail text to 3 to 5 words and connect the thumbnail to the intro', 'https://x.com/PaddyG96/status/1788967958670192690', PADDY),
    packageFirst: src('Plan the title and thumbnail before recording, and do not waste the intro', 'https://x.com/PaddyG96/status/1788967959882346991', PADDY),
    stockBroll: src('Avoid generic b-roll from stock footage websites', 'https://x.com/PaddyG96/status/1811083487178289578', PADDY),
    dangerZones: src('Keep retention danger zones as short as possible, and turn down sound effects', 'https://x.com/PaddyG96/status/1811083488646299786', PADDY),
    matchScreen: src('Make what is said match what is on screen, and cut repetition', 'https://x.com/PaddyG96/status/1811083489921429898', PADDY),
    introRoadmap: src('Keep intros short with a clear roadmap, and foreshadow what is coming', 'https://x.com/PaddyG96/status/1811083491347468614', PADDY),
    payoffReminder: src('Remind the viewer of the payoff during the video', 'https://x.com/PaddyG96/status/1811083493931172229', PADDY),
    titleLength: src('Fewer than 5 words in thumbnails, titles under 60 characters, 3 or fewer focus areas', 'https://x.com/PaddyG96/status/1811083495562707204', PADDY),
    universalLanguage: src('Use universal language in titles', 'https://x.com/PaddyG96/status/1811083496892268795', PADDY),
    glanceTest: src('The glance test, and reading title and thumbnail as one', 'https://x.com/PaddyG96/status/1811083499044044951', PADDY),
    thumbnailSwap: src('A video at 100k views on day one passed 3m in a week after only a thumbnail change', 'https://x.com/PaddyG96/status/1450463450438713352', PADDY),
    threeElements: src('The 3 element rule for thumbnails', 'https://x.com/PaddyG96/status/1450463472907657220', PADDY),
    threeOptions: src('Make 3 thumbnail options per video, which only about 20 to 30 percent of channels do', 'https://x.com/PaddyG96/status/1742221359613190312', PADDY),
    shortsStudy: src('Shorts study across 33 channels and 5,400 Shorts', 'https://x.com/PaddyG96/status/1646898358089285639', PADDY),
    shortsAvd: src('Shorts with an average view duration above 50 seconds averaged 4.1 million views', 'https://x.com/PaddyG96/status/1646898363466481664', PADDY),
    shortsLengths: src('There were outliers at every Short length', 'https://x.com/PaddyG96/status/1646898365139910657', PADDY),
    shortsSwipe: src('Shorts under 60 percent viewed versus swiped away rarely performed well', 'https://x.com/PaddyG96/status/1646898368495382528', PADDY),
    shortsEngagement: src('No strong relationship between likes, shares or comments and Shorts performance', 'https://x.com/PaddyG96/status/1646898371741843457', PADDY),
    leaveItAlone: src('A video that started at 8 of 10 became 1 of 10 with no title or thumbnail change', 'https://x.com/PaddyG96/status/1679470163308019717', PADDY),
    oneHitChannel: src('A 930 subscriber channel hit 7.1 million views, then its next video got 3.5k', 'https://x.com/PaddyG96/status/1912937662928789549', PADDY),
    ccnAudience: src('Core, casual and new viewers: the viral video hit all three', 'https://x.com/PaddyG96/status/1912937707023856127', PADDY),
    adjacentNiche: src('The adjacent niche ideation method', 'https://x.com/PaddyG96/status/1912937724031488302', PADDY),
    viralNotEnough: src('A viral video will not save your channel', 'https://x.com/PaddyG96/status/1912937749545378048', PADDY),
    agencyPlaybook: src('Agency playbook: research outliers, try 5 of 100+ ideas, double down on 1 to 3 buckets', 'https://x.com/PaddyG96/status/1767590788345598264', PADDY),
    algorithmIsAudience: src('The algorithm is the audience, and data is a tool, not everything', 'https://x.com/PaddyG96/status/1711401542576660774', PADDY),
    metaMyth: src('The single YouTube meta is a myth', 'https://x.com/PaddyG96/status/1695065846727504207', PADDY),
    qualityMyth: src('Most creators read "make quality videos" as production value', 'https://x.com/PaddyG96/status/1687836829066600448', PADDY),
    inspirationLine: src('Where inspiration ends and copying begins', 'https://x.com/PaddyG96/status/1671136955373961219', PADDY),

    outlierDefinition: src('An outlier is a video that overperforms its channel average', 'https://x.com/1of10media/status/2078163022057791868', ONEOFTEN),
    outlierSettings: src('Outlier search settings: 2x+, 100K+ views, at most 25K subscribers, last 3 months', 'https://x.com/1of10media/status/2078163069319233673', ONEOFTEN),
    outlierValidation: src('Validate a concept on 3 or more videos that all became outliers recently', 'https://x.com/1of10media/status/2078163081281376439', ONEOFTEN),
    outlierScroll: src('Collect outliers while you scroll, validate them later', 'https://x.com/1of10media/status/2078163136524550543', ONEOFTEN),
    competitorStats: src('Competitor signals: views per hour, A/B tests, title and thumbnail changes', 'https://x.com/1of10media/status/2078163148436287813', ONEOFTEN),
    trendingFormats: src('Title formats that work can be transferred into your niche', 'https://x.com/1of10media/status/2078163010166903028', ONEOFTEN),

    oneSecondHook: src('Jenny Hoyos: you have one second to hook a Shorts viewer', 'https://x.com/vidIQ/status/1867932188991221911', VIDIQ),
    hookFormula: src('Jenny Hoyos\'s three part hook: first frame, clear setup, promised payoff', 'https://x.com/vidIQ/status/1867932212491890698', VIDIQ),
    hookFirst: src('"If the hook isn\'t good, I don\'t make the video"', 'https://x.com/vidIQ/status/1867932297669824700', VIDIQ),

    facelessStrategy: src('The strategy behind a faceless channel, and why none of it is automated', 'https://x.com/imscottsimson/status/1884631746894782790', 'Scott Simson (@imscottsimson)'),
    horsesChannel: src('Faceless channels carried by original AI visuals and strong scriptwriting', 'https://x.com/Chen/status/1864395943082078305', 'Lester Chen (@Chen)')
  };

  var S = SOURCES;

  var MODULES = [
    {
      id: 'm1-niche',
      title: 'Pick a niche with the scanner',
      goal: 'Leave this module with one sub-niche, a concept that broke out on three channels, and a baseline measured by your own scans.',
      lessons: [
        {
          id: 'm1-l1-finish-line',
          title: 'Write down the finish line first',
          why: 'Length, format and cadence all depend on which monetization route you aim at, so pick the route before anything else.',
          steps: [
            'Read the two ways into the YouTube Partner Program: 1,000 subscribers plus 4,000 qualified watch hours in the last 12 months, or 1,000 subscribers plus 10 million qualified Shorts views in the last 90 days.',
            'Note that watch hours from Shorts viewed in the Shorts Feed do not count toward the 4,000 hours.',
            'Note the change YouTube has published for Shorts: starting February 1, 2027, earning a share of Shorts ad revenue in a given month needs at least 10 million qualified Shorts views in the last 90 days.',
            'Check the rest of the gate: no active Community Guidelines strikes, 2-Step Verification on the Google account, advanced features access, one AdSense for YouTube account, and a country where the program is available.',
            'Choose long form or Shorts as your main route and write it at the top of your plan.'
          ],
          doNow: 'Write your route, its exact threshold, and the weekly number you would need to reach it in 12 months.',
          proof: 'One line with a route, a threshold and a weekly target.',
          surfaces: [],
          sources: [S.ypp, S.shortsRevenue]
        },
        {
          id: 'm1-l2-sub-niche',
          title: 'Pick a sub-niche, not a category',
          why: 'A beginner cannot win a whole category, but can own a sub-niche before anyone defends it.',
          steps: [
            'List what you care about, what you are good at, and what people already watch on YouTube, and look for the overlap.',
            'Write the broad category that overlap points to, then split it into at least ten sub-niches. Paddy Galloway counts more than 15 inside finance alone.',
            'For each sub-niche, write the one sentence a viewer would use to describe your channel.',
            'Cross out every sub-niche whose sentence could describe five channels you already know.',
            'Commit to one sub-niche and expand only after it works, instead of serving everything at once.'
          ],
          doNow: 'List ten sub-niches under your category and cross out every one you cannot describe in a single specific sentence.',
          proof: 'One sub-niche left standing, with nine crossed out.',
          surfaces: [],
          sources: [S.nicheVenn, S.subNiche, S.laserFocus]
        },
        {
          id: 'm1-l3-first-scan',
          title: 'Run your first SCAN and read views per hour',
          why: 'Lifetime views tell you how old a video is, views per hour tells you what is moving right now.',
          steps: [
            'Search YouTube for your sub-niche the way a viewer would phrase it.',
            'Press SCAN in the YouTube top bar. The scanner scrolls the results and opens a ranked panel of faceless candidates.',
            'On each video card, read the VPH chip, which is views per hour since publishing. A card marked AGE UNKNOWN had no readable date, so its views per hour could not be measured.',
            'Look for the multiplier chip, for example 5.2x. It compares the video with the average of that channel\'s videos the scanner has seen, and only appears at 2x or more.',
            'Read the dollar figures as estimates: they multiply views by an assumed rate picked from words in the title, and nobody\'s real earnings are in them.',
            'Press SAVE on the strongest results. SAVE stores the result in the assistant workspace and opens it.'
          ],
          doNow: 'Run one SCAN on your sub-niche and save the five results with the highest views per hour.',
          proof: 'Five saved results in the assistant workspace, each with its views per hour written down.',
          surfaces: ['the SCAN button on YouTube', 'the assistant workspace'],
          sources: [S.outlierDefinition, S.competitorStats]
        },
        {
          id: 'm1-l4-validate-outliers',
          title: 'Validate the concept on three channels, not one',
          why: 'One video beating its channel can be luck, while the same concept breaking out on three channels is demand you can build on.',
          steps: [
            'Define an outlier as a video that beats its own channel\'s average: a channel that averages 5,000 views and gets 10,000 has a 2x outlier.',
            'Start from the settings 1of10 publishes for its own search: 2x or more, at least 100,000 views, channels of at most 25,000 subscribers, uploaded in the last 3 months. Paddy Galloway sets the bar at 3x or 4x the average for other channels.',
            'Collect candidates while you scroll and validate them later in one pass, instead of stopping on each one.',
            'Keep a concept only when three or more channels had recent outliers on it.',
            'Look outside your niche too: find similar channels in neighboring niches, take their outliers, and adapt the idea to yours.'
          ],
          doNow: 'For each of your five saved results, find two more channels where the same concept broke out in the last 3 months.',
          proof: 'A shortlist where every surviving concept names three channels and their multipliers.',
          surfaces: ['the SCAN button on YouTube'],
          sources: [S.outlierDefinition, S.outlierSettings, S.outlierThreeX, S.outlierScroll, S.outlierValidation, S.adjacentNiche]
        },
        {
          id: 'm1-l5-policy-check',
          title: 'Check the niche against the monetization rules',
          why: 'In January 2026 YouTube terminated 16 channels with a combined 35 million subscribers under its inauthentic content policy, so a format that breaks the rules is not a shortcut.',
          steps: [
            'Read the inauthentic content rule: repetitive or mass-produced content cannot be monetized, and the substance of each video must be materially varied.',
            'Note the named examples: image slideshows, templated storylines, or scrolling text with minimal or no narrative, commentary or educational value, and AI-generated content made with generic or unoriginal templates.',
            'If your sub-niche is health, legal issues, finance or politics, do not use an AI persona presented as a human expert giving advice. YouTube does not monetize those channels.',
            'Read the unsatisfying content rule: videos that feel interchangeable, or are designed to shock only to get views, are excluded as well.',
            'Write down what will genuinely change between two consecutive videos in your format. If the honest answer is only the topic, change the format now.'
          ],
          doNow: 'Write one paragraph describing what changes between your video 1 and video 2 beyond the subject.',
          proof: 'A paragraph that names a real difference, or a format you have already discarded.',
          surfaces: [],
          sources: [S.monetizationPolicies, S.slopPurge, S.ceoLetter]
        },
        {
          id: 'm1-l6-baseline',
          title: 'Build your baseline in the Niche Index and the Command Center',
          why: 'YouTube says topic interest, competition and seasonality all change how many people see a video, so one day of numbers is not a baseline.',
          steps: [
            'Run SCAN on your sub-niche on three separate days. Every scan feeds the Niche Index on its own.',
            'Open the Niche Index from the extension popup and read Avg VPH, Max VPH and Best title seen for your niche.',
            'Read the Trend column once it fills in. It compares mean views per hour per scan, first half against second half, and needs 3 scans of the same niche.',
            'Open the channel page of each channel you validated and press SAVE on the extension panel there, which adds the channel to the Command Center.',
            'In the Command Center, press Measure growth today and again tomorrow. Growth only counts once a channel has two measurements.',
            'Block time for this every week. Paddy Galloway schedules 4 hours a week to study trends, outliers and competitors.'
          ],
          doNow: 'Save your three validated channels to the Command Center and press Measure growth once.',
          proof: 'Three channels in the Command Center with a first measurement, and your niche listed in the Niche Index.',
          surfaces: ['the Niche Index', 'the Command Center'],
          sources: [S.discovery, S.bangersFlopsWhy]
        }
      ]
    },
    {
      id: 'm2-packaging',
      title: 'Package before you produce',
      goal: 'Leave this module with three different title and thumbnail pairs for your first video, built before any production.',
      lessons: [
        {
          id: 'm2-l1-package-first',
          title: 'Write the title and thumbnail before the script',
          why: 'The idea sets the ceiling for a video, and the packaging and execution decide how much of it you reach.',
          steps: [
            'Before writing a script, write the title and describe the thumbnail. Paddy Galloway calls it advice everyone knows and few follow.',
            'If you cannot write a title you would click, the idea is not ready, and production will not rescue it.',
            'Put the quality into the idea first. Galloway argues most creators read quality as production value, when idea selection sets the bar.',
            'Brainstorm ideas every day so you choose from many instead of settling for the first. Galloway suggests 10 a day.',
            'Write the script to deliver the promise in the title, not the other way round.'
          ],
          doNow: 'Take your strongest validated concept and write its title and a one line thumbnail description, with no script yet.',
          proof: 'A title and a thumbnail description saved, and no script written.',
          surfaces: [],
          sources: [S.packageFirst, S.ideaCeiling, S.qualityMyth]
        },
        {
          id: 'm2-l2-study-winners',
          title: 'Study the packaging that already won in your niche',
          why: 'YouTube notes that thumbnail styles shift over time and advises keeping current on what works in your community.',
          steps: [
            'Open the Niche Index and read Best title seen for your niche, the title of the highest views per hour video your scans found.',
            'Run SCAN on your sub-niche and write down the titles of the results with the highest views per hour.',
            'For each one, note the format of the title rather than its words, because a format can transfer between topics.',
            'Look at the thumbnails of the same videos and count their elements and their words.',
            'Borrow the pattern, never the image or the script. Copying a script word for word or reusing someone\'s thumbnail without transformation is infringement, not inspiration.'
          ],
          doNow: 'Write the title formats of the five highest views per hour videos in your niche, with the subject replaced by a blank.',
          proof: 'Five title formats with blanks, each linked to the video it came from.',
          surfaces: ['the Niche Index', 'the SCAN button on YouTube'],
          sources: [S.titleTips, S.trendingFormats, S.inspirationLine]
        },
        {
          id: 'm2-l3-glance-test',
          title: 'Make a thumbnail that survives a glance',
          why: 'A viewer gives a thumbnail milliseconds while scrolling, so anything that needs a second look is already lost.',
          steps: [
            'Keep it to three or fewer major elements, for example text, a subject and one more.',
            'Keep any text to 3 to 5 words at most.',
            'Shrink it to phone size and check you can take in everything at a glance.',
            'Read title and thumbnail together, and cut anything in the thumbnail that the title already says.',
            'Export at the highest resolution you can. YouTube asks for the image to be as large as possible, and if any thumbnail in an A/B test is below 1280 x 720, all of them are shown at 854 x 480.'
          ],
          doNow: 'Shrink your thumbnail to phone size, count the major elements, and cut anything past the third.',
          proof: 'A thumbnail with three or fewer elements and 5 words or fewer, readable at phone size and saved at 1280 x 720 or larger.',
          surfaces: [],
          sources: [S.glanceTest, S.threeElements, S.thumbnailWords, S.titleLength, S.titleTips, S.abTest]
        },
        {
          id: 'm2-l4-titles',
          title: 'Write titles that are clear and honest',
          why: 'YouTube says clickbait videos tend to have low average view duration and are therefore less likely to be recommended.',
          steps: [
            'Make the title accurately represent the video, or viewers stop watching and discoverability suffers.',
            'Keep it short, with the important words near the beginning and episode numbers and branding at the end. Paddy Galloway keeps titles under 60 characters, with exceptions.',
            'Use plain words a wide audience understands. Galloway even suggests running titles through a readability checker.',
            'Choose on purpose between a searchable title that says what to expect and an intriguing title that sparks curiosity.',
            'Limit ALL CAPS and emoji to real emphasis, and never promise a shock the video does not deliver. YouTube does not monetize content designed to shock viewers only to get views.'
          ],
          doNow: 'Rewrite your title three ways so the most important words come first and each one stays under 60 characters.',
          proof: 'Three honest titles under 60 characters, each leading with the subject.',
          surfaces: [],
          sources: [S.titleTips, S.ctrFaq, S.titleLength, S.universalLanguage, S.monetizationPolicies]
        },
        {
          id: 'm2-l5-three-options',
          title: 'Make three real options, not one',
          why: 'Paddy Galloway estimates only about 20 to 30 percent of channels really make 3 thumbnail options per video, and YouTube will test up to 3 pairs for you.',
          steps: [
            'Write 10 title options and design 3 thumbnail options per video, as Galloway recommends.',
            'Make the three pairs differ in angle: a different promise, subject or emotion, not three tints of one idea.',
            'Remember the test needs a difference to measure. Pairs that are too similar make it run longer.',
            'For reference, open ThumbLab in the assistant workspace, which loads the most watched thumbnails for a topic. Its Extract the pattern and generate button sends them to Gemini with your key and draws three drafts, which counts against that key\'s quota.',
            'Write down which pair you expect to win before any test runs, so you learn when you are wrong.'
          ],
          doNow: 'Write 10 titles for your packaged idea and pick the 3 most different to pair with 3 thumbnails.',
          proof: 'Three distinct title and thumbnail pairs and a written prediction.',
          surfaces: ['ThumbLab, in the assistant workspace'],
          sources: [S.threeOptions, S.twoYears, S.twoThumbnails, S.abTest]
        }
      ]
    },
    {
      id: 'm3-production',
      title: 'Produce without a face and stay monetizable',
      goal: 'Leave this module with a script and a set of assets that are yours, hold attention, and fit the rules.',
      lessons: [
        {
          id: 'm3-l1-first-thirty-seconds',
          title: 'Earn the first thirty seconds',
          why: 'YouTube reports what share of viewers are still watching after 30 seconds, and a high share can mean the opening matched what the title and thumbnail promised.',
          steps: [
            'Get into the value as soon as possible. The best intro does not feel like an intro, it flows into the body.',
            'Keep the intro simple and short, and give the viewer a clear roadmap of what is coming.',
            'Show early the image the thumbnail promised, so the click feels confirmed.',
            'Cut greetings and channel branding from the opening, since they spend the viewer\'s time before any value arrives.',
            'Read the opening aloud with a timer and cut every sentence the viewer would not miss.'
          ],
          doNow: 'Write the first thirty seconds of your script, then delete every sentence that does not serve the title\'s promise.',
          proof: 'An opening under thirty seconds that restates the promise and starts paying it off.',
          surfaces: [],
          sources: [S.retention, S.packageFirst, S.introRoadmap, S.thumbnailWords]
        },
        {
          id: 'm3-l2-your-angle',
          title: 'Give every video an angle that is yours',
          why: 'YouTube monetizes work built on other material only when you add significant original commentary, substantive modifications, or educational or entertainment value.',
          steps: [
            'Read the reused content examples YouTube does not monetize, including clips edited together with little or no narrative, and videos that only read out text from websites or news feeds you did not write.',
            'Know that the reused content policy applies to the channel as a whole. If YouTube cannot tell that you made the content, monetization may be removed from the entire channel.',
            'Blend inspiration from several sources instead of rebuilding one creator\'s video. Paddy Galloway calls this idea synthesis.',
            'Model what already works in the niche, but give it your own twist.',
            'Write the one sentence of perspective only your channel supplies, and put it in the script. If you cannot write it, do not produce the video.'
          ],
          doNow: 'Write the single sentence of original perspective for this video and mark where it appears in the script.',
          proof: 'One sentence of perspective, placed in your script.',
          surfaces: [],
          sources: [S.monetizationPolicies, S.inspirationLine, S.facelessStrategy]
        },
        {
          id: 'm3-l3-assistant-drafts',
          title: 'Let the assistant draft, and keep the decisions yours',
          why: 'YouTube lists AI help with an outline, script, thumbnail, title or infographic as production assistance that needs no disclosure, but it will not monetize generic, templated output.',
          steps: [
            'Decide on purpose whether to use a model at all. ScriptPilot AI, in the assistant workspace, runs on your Groq key and falls back to your Gemini key, and does nothing until one of them is added.',
            'Know that the COACH button next to SCAN uses the model you choose in Settings under Assistant model, and that the Setup page walks through free ways to power it, including a model on your own machine.',
            'Leave Settings, Paid calls, switched off unless you want scans to send thumbnails to the vision model, since those calls count against your quota.',
            'Treat every draft as raw material. AI cannot do everything for you, and generic template output is exactly what YouTube excludes.',
            'Rewrite the draft in your own words and keep the angle, the promise and the structure as your own decisions.'
          ],
          doNow: 'Open Settings, decide whether the assistant stays off or which single key it uses, and write that decision down.',
          proof: 'A deliberate setting: one named key, or an empty field you chose.',
          surfaces: ['Settings, Assistant model', 'ScriptPilot AI, in the assistant workspace', 'the Setup page'],
          sources: [S.disclosure, S.monetizationPolicies, S.facelessStrategy]
        },
        {
          id: 'm3-l4-visuals',
          title: 'Make visuals for this script, not for any script',
          why: 'YouTube allows AI used to generate a unique background visual, and refuses to monetize unrelated AI clips stitched together to shock.',
          steps: [
            'Avoid generic b-roll from stock footage websites, which Paddy Galloway calls very 2019.',
            'Show what is being said at that moment, not random footage, and make sure captions and graphics match the voice.',
            'Study what original visuals can carry: Lester Chen describes Horses passing 1 million subscribers in 6 months with wholly original frames made in Midjourney, carried by strong scriptwriting and research.',
            'If you use MotionForge Studio, in the assistant workspace, it turns a script into one image or video prompt per scene on the same Groq or Gemini key. Edit each prompt so it belongs to this script only.',
            'Keep a list of where every asset came from, so you can answer for it later.'
          ],
          doNow: 'Audit the assets for your first video and replace anything that would fit any other video just as well.',
          proof: 'An asset list where every item is specific to this script, with its origin noted.',
          surfaces: ['MotionForge Studio, in the assistant workspace'],
          sources: [S.monetizationPolicies, S.stockBroll, S.matchScreen, S.facelessStrategy, S.horsesChannel]
        },
        {
          id: 'm3-l5-retention-edit',
          title: 'Edit for retention, one danger zone at a time',
          why: 'YouTube uses average view duration and average percentage viewed as ranking signals, so every slow stretch costs you reach.',
          steps: [
            'Find the retention danger zones in your script, such as transitions, the end of a storyline and heavy context scenes, and make each as short as you can.',
            'Cut repetition mercilessly, including recaps and similar sections in a row.',
            'Remind the viewer of the payoff during the video, not only at the end.',
            'Foreshadow what is coming so the viewer knows what they are waiting for.',
            'Keep sound effects below the voice. Paddy Galloway notes they usually arrive too loud from sound packs.'
          ],
          doNow: 'Mark every transition and context scene in your script and cut each one to its shortest form.',
          proof: 'A script with its danger zones marked and shortened, and no recap that repeats a section.',
          surfaces: [],
          sources: [S.discovery, S.dangerZones, S.matchScreen, S.payoffReminder, S.introRoadmap]
        },
        {
          id: 'm3-l6-shorts-hook',
          title: 'If you chose Shorts, the hook is one second long',
          why: 'In a practitioner study of 5,400 Shorts across 33 channels, Shorts with an average view duration above 50 seconds averaged 4.1 million views.',
          steps: [
            'Treat the first second as the whole hook, the rule behind Jenny Hoyos\'s 2.2 billion Shorts views.',
            'Build the opening from her three parts: a visual shock factor in the first frame, a clear setup of what the Short is, and a promise of a specific payoff by the end.',
            'Tie the shock to a real story. YouTube does not monetize content that relies solely on shock value.',
            'Aim for held attention, not length. In Paddy Galloway\'s study there were outliers at every length.',
            'Watch viewed versus swiped away in your Shorts analytics. In that study, Shorts under 60 percent rarely performed well and the best sat between 70 and 90 percent.',
            'If the hook is not good, do not make the Short, which is Hoyos\'s own rule.'
          ],
          doNow: 'Rewrite the first line of your Short so it works with no context, then watch the first second with the sound off.',
          proof: 'A first second that sets up the Short without sound, and a written target for viewed versus swiped away.',
          surfaces: [],
          sources: [S.oneSecondHook, S.hookFormula, S.hookFirst, S.shortsStudy, S.shortsAvd, S.shortsLengths, S.shortsSwipe, S.monetizationPolicies]
        }
      ]
    },
    {
      id: 'm4-publish',
      title: 'Publish so every upload can teach you something',
      goal: 'Leave this module with a channel that can run tests, a disclosure habit, and a cadence you can keep.',
      lessons: [
        {
          id: 'm4-l1-feature-access',
          title: 'Unlock the features you need before upload day',
          why: 'Custom thumbnails, videos over 15 minutes, A/B testing and the monetization application all sit behind verification, and finding that out on upload day costs you the video.',
          steps: [
            'Verify your phone number to unlock intermediate features, which include custom thumbnails and videos longer than 15 minutes.',
            'Unlock advanced features through channel history, or right away by verifying with a valid ID or a video.',
            'Check what advanced features give you: applying for monetization, clickable links, pinned comments, chapters, A/B testing and multi-language features.',
            'Turn on 2-Step Verification on the Google account, which the Partner Program requires.',
            'Follow the Community Guidelines to keep these features, since a strike can also cost you advanced features access.'
          ],
          doNow: 'Open YouTube Studio, check your feature access, and start phone or ID verification if anything is missing.',
          proof: 'Intermediate and advanced features showing as available, or a verification submitted.',
          surfaces: ['YouTube Studio'],
          sources: [S.advancedFeatures, S.ypp, S.strikes]
        },
        {
          id: 'm4-l2-disclosure',
          title: 'Disclose AI use correctly',
          why: 'YouTube states that disclosing AI content will not limit a video\'s audience or its eligibility to earn money, while consistently failing to disclose can mean removal or suspension from the Partner Program.',
          steps: [
            'Disclose realistic AI content, for example AI generated music, AI footage of a real place, a real person appearing to give advice they never gave, or a realistic event that did not happen.',
            'Do not disclose production help: AI for an outline, script, thumbnail, title or infographic, caption creation, idea generation, or cloning your own voice for voice overs.',
            'Set it during upload in YouTube Studio: in the Attributes section, under AI use, choose Yes or No.',
            'Expect the label in the video player for photorealistic content, and in the expanded description for content that is not photorealistic or is animated.',
            'Decide on every upload instead of once for the channel, because the answer changes with the assets.'
          ],
          doNow: 'Go through your planned video shot by shot and mark every asset that falls in the must-disclose list.',
          proof: 'A marked shot list, and a written Yes or No for AI use with the reason.',
          surfaces: ['YouTube Studio'],
          sources: [S.disclosure, S.ceoLetter]
        },
        {
          id: 'm4-l3-ab-test',
          title: 'Publish with an A/B test running',
          why: 'YouTube picks the winner by watch time rather than click-through rate, so the test tells you which promise the video actually keeps.',
          steps: [
            'Load up to 3 title and thumbnail pairs into A/B testing, which runs only in YouTube Studio on a computer.',
            'Check the video qualifies: Shorts, scheduled lives, premieres, private videos, and videos made for kids or for mature audiences cannot be tested.',
            'Keep the pairs genuinely different, because pairs that are too similar make the test run longer.',
            'Leave the title and thumbnail alone while it runs, since changing either stops the test. Expect a result within two weeks.',
            'Accept the result. If it is inconclusive, the first pair you uploaded stays as the default.'
          ],
          doNow: 'Publish your first long form video with three pairs loaded, and write down which one you expect to win.',
          proof: 'A published video with an active test and a written prediction.',
          surfaces: ['YouTube Studio'],
          sources: [S.abTest]
        },
        {
          id: 'm4-l4-mid-rolls',
          title: 'Place mid-rolls where viewers already pause',
          why: 'Mid-roll ads are only available on monetized videos of 8 minutes or longer, and slots at natural breaks are more likely to serve ads.',
          steps: [
            'Check the length: mid-roll ads need a monetized video of 8 minutes or more.',
            'Place slots at natural breakpoints, such as a pause in audio or a visual transition, where YouTube generally finds higher viewer retention.',
            'Avoid slots mid-sentence or mid-action, which are less likely to serve ads.',
            'Add automatic slots next to your manual ones if you want to give the ad system more choices, and move any manual slot shown in red.',
            'Remember that no slot is guaranteed an ad, which is why Paddy Galloway advises placing more of them.'
          ],
          doNow: 'Mark the natural breaks in your script now, so the edit leaves a real pause at each one.',
          proof: 'A list of timestamps at pauses or transitions, ready for the ad slot editor.',
          surfaces: ['YouTube Studio'],
          sources: [S.midRoll, S.postIt]
        },
        {
          id: 'm4-l5-cadence',
          title: 'Choose a cadence you can keep for months',
          why: 'Paddy Galloway\'s from-scratch plan starts with 2 videos a week for 4 months, because quantity comes before quality.',
          steps: [
            'Commit to a rhythm you can hold. Galloway\'s plan is 2 videos a week for 4 months, then one a week for 4 months with more attention on quality.',
            'Do not treat the schedule as a lever on the algorithm. YouTube\'s search and discovery page lists the signals it uses and upload frequency is not one of them, and Galloway says when you post matters less than what.',
            'Post the video when it is good enough. Perfectionism has a point where it stops helping.',
            'Improve one thing in every upload instead of everything at once.',
            'Put the next upload date in your calendar before you publish the current one.'
          ],
          doNow: 'Write your cadence for the next 4 months and put the next two upload dates in your calendar.',
          proof: 'A calendar with the next two uploads dated.',
          surfaces: [],
          sources: [S.twoPerWeek, S.oneAWeek, S.discovery, S.audienceNotSchedule, S.postIt]
        }
      ]
    },
    {
      id: 'm5-numbers',
      title: 'Read your own numbers',
      goal: 'Leave this module able to tell from your own analytics whether the packaging or the video is the problem.',
      lessons: [
        {
          id: 'm5-l1-seven-day-review',
          title: 'Review every video seven days after release',
          why: 'A fixed review day turns every upload into a lesson instead of a mood.',
          steps: [
            'Seven days after each release, study two things: how the video performed and why, and where the retention curve lost viewers.',
            'Look at retention curves and views first. Paddy Galloway treats everything else as secondary.',
            'Write one change for the next video from what you found.',
            'Keep every review in one running document so later reviews can compare against it.',
            'Save your own channel to the Command Center from its channel page, and press Measure growth on review day, so your subscriber and view totals are measured rather than remembered. The extension panel only appears on a channel that already has subscribers.'
          ],
          doNow: 'Put a review reminder 7 days after your next upload, and save your own channel to the Command Center once it has subscribers.',
          proof: 'A dated review reminder, and your channel listed in the Command Center, or a note that it has no subscribers yet.',
          surfaces: ['the Command Center', 'YouTube Studio'],
          sources: [S.feedbackLoop, S.retentionAndOutliers]
        },
        {
          id: 'm5-l2-reach',
          title: 'Read impressions and click-through rate in context',
          why: 'Half of all channels and videos have an impressions click-through rate between 2 and 10 percent, so the number only means something against its context.',
          steps: [
            'Open the Reach tab and read impressions and impressions click-through rate for your newest video.',
            'Expect noise early. YouTube says videos or channels less than a week old, and videos with fewer than 100 views, can show an even wider range.',
            'For a read on new viewers, check click-through rate on Home and Suggested in the first 24 hours, on videos with above-average impressions.',
            'Compare click-through rate between your own videos over the long term, and remember that many Home impressions naturally lower the rate.',
            'Watch for the clickbait signature: high click-through rate with low average view duration and fewer impressions than expected.',
            'Ignore the CTR chip on scanner cards for this. It is an estimate from the wording of the title, not a measurement.'
          ],
          doNow: 'Write down impressions, click-through rate, and click-through rate on Home and Suggested at 24 hours for your newest video.',
          proof: 'Three numbers from your own Reach tab, written with the date.',
          surfaces: ['YouTube Studio'],
          sources: [S.ctrFaq, S.titleTips]
        },
        {
          id: 'm5-l3-retention',
          title: 'Read the retention curve instead of the view count',
          why: 'The curve shows the exact moment viewers left, which is the only place a fix can go.',
          steps: [
            'Open the audience retention report and read the intro figure: the share of viewers still watching after the first 30 seconds.',
            'Read a low intro as a mismatch with the packaging, since a high one can mean the opening matched what the title and thumbnail promised.',
            'Find the dips, where viewers skipped or stopped, and the spikes, where they watched, rewatched or shared.',
            'Use typical retention to compare the video with your 10 latest videos of similar length, not with anyone else\'s.',
            'Match the steepest dip to its line in the script and write one change for the next video.'
          ],
          doNow: 'Find the steepest dip in your latest retention curve, locate the matching script line, and rewrite it.',
          proof: 'One timestamp, one script line and one rewritten sentence.',
          surfaces: ['YouTube Studio'],
          sources: [S.retention, S.retentionCurves]
        },
        {
          id: 'm5-l4-money',
          title: 'Read the money correctly',
          why: 'RPM is what you earn per 1,000 views after YouTube\'s revenue share and it counts views that were never monetized, so it is lower than the CPM advertisers pay.',
          steps: [
            'Read RPM, not CPM, in your revenue analytics. RPM counts ads, channel memberships, YouTube Premium, Super Chat and Super Stickers.',
            'Expect RPM to fall when unmonetized views rise, even when revenue stays the same.',
            'Treat the dollar figures on scanner cards and in the scan panel as estimates. They multiply views by an RPM assumed from words in the title and adjusted for language and length, not by anyone\'s real earnings.',
            'If you publish Shorts, know the mechanism: revenue from ads between Shorts goes into a Creator Pool, you are allocated by your share of engaged views, and you keep 45 percent of your allocation.',
            'Know what music costs on Shorts: with 1 track, half of that Short\'s revenue goes to the Creator Pool, and with 2 tracks, one third.'
          ],
          doNow: 'Open your revenue analytics and write down your RPM and CPM for the default date range, or a dated note that you are not monetized yet.',
          proof: 'Your own RPM and CPM with their date range, or a dated note that you are not monetized yet.',
          surfaces: ['YouTube Studio'],
          sources: [S.rpm, S.shortsRevenue]
        },
        {
          id: 'm5-l5-data-is-a-tool',
          title: 'Do not over-read a single number',
          why: 'Studio metrics move with traffic source, device, format and length, so one number read alone will mislead you.',
          steps: [
            'Look for the audience explanation of any result first. Paddy Galloway\'s rule is that the algorithm is the audience.',
            'Remember the three outside factors YouTube names: topic interest, competition from other channels, and seasonality.',
            'Do not expect growth in a straight line, and do not judge the channel on one week.',
            'Read engagement counts lightly. In Galloway\'s Shorts study, likes, shares and comments showed no strong relationship with performance.',
            'Distrust anyone selling a single way to win. Galloway calls the YouTube meta a myth.'
          ],
          doNow: 'Write three beliefs you hold about the algorithm, find a source for each, and delete the ones you cannot source.',
          proof: 'A shorter list of beliefs, each with a link.',
          surfaces: [],
          sources: [S.algorithmIsAudience, S.discovery, S.nonLinear, S.shortsEngagement, S.metaMyth]
        }
      ]
    },
    {
      id: 'm6-decide',
      title: 'Kill it or double down',
      goal: 'Leave this module with a written rule that decides, without argument, what you repeat and what you stop.',
      lessons: [
        {
          id: 'm6-l1-first-hour',
          title: 'Do not judge a video in its first hour',
          why: 'Paddy Galloway had a video start at 8 of 10 in his team\'s ranking, where 1 is best, then climb to 1 of 10 and head for their fastest million views with no title or thumbnail change.',
          steps: [
            'Consider the topic first. News-driven videos start fast and slow down, and evergreen ones can do the opposite.',
            'Consider audience fit. A video aimed beyond your regular viewers takes longer for YouTube to place.',
            'Consider the early metrics carefully. If views are low but click-through rate and average view duration look good for the impressions, give it time.',
            'Consider how strongly you rated the packaging before upload.',
            'Change the thumbnail only when those four point the same way. Galloway once took a video from 100,000 views on day one to over 3 million in a week by changing only the thumbnail.',
            'If an A/B test is running, remember that changing the title or thumbnail stops it.'
          ],
          doNow: 'For your latest video, write one line on each of the four considerations before touching its packaging.',
          proof: 'Four written lines and a decision: wait, or change the thumbnail.',
          surfaces: ['YouTube Studio'],
          sources: [S.leaveItAlone, S.thumbnailSwap, S.abTest]
        },
        {
          id: 'm6-l2-bangers-flops',
          title: 'Compare your bangers with your flops',
          why: 'Your own best and worst videos are the only data set that describes your own audience.',
          steps: [
            'Wait for a real sample. Paddy Galloway starts this at 48 videos.',
            'List your 5 most viewed and your 5 least viewed videos.',
            'Write down why you think each of the top 5 worked, and brainstorm more ideas around them.',
            'For the bottom 5, understand what went wrong and eliminate it.',
            'Brainstorm widely before you choose. From 32 videos on, Galloway\'s plan asks for 100 ideas a week built around outliers.'
          ],
          doNow: 'List your top 5 and bottom 5 videos by views and write one sentence on each.',
          proof: 'Ten videos, each with a one sentence reason.',
          surfaces: ['YouTube Studio'],
          sources: [S.bangersFlops, S.bangersFlopsWhy, S.hundredIdeas]
        },
        {
          id: 'm6-l3-buckets',
          title: 'Double down on one to three buckets',
          why: 'Paddy Galloway\'s agency playbook tries 5 ideas out of more than 100, then doubles down on the 1 to 3 buckets that work.',
          steps: [
            'Group your videos into buckets by format, and name the one to three that are working.',
            'Brainstorm more ideas inside those buckets before you start a new one.',
            'Build each bucket around ideas that did 3x or more a channel\'s average, yours or a competitor\'s.',
            'Keep every video in a bucket distinct in storyline, focus or concept, which is what YouTube requires for a series to stay monetizable.',
            'Track the bucket\'s channels in the Command Center and your niche in the Niche Index, so the decision rests on measured numbers.'
          ],
          doNow: 'Name your one to three buckets and plan the next three videos inside them, each changing exactly one thing.',
          proof: 'Three planned videos in named buckets, each with the one variable it changes.',
          surfaces: ['the Command Center', 'the Niche Index'],
          sources: [S.agencyPlaybook, S.ideaCeiling, S.retentionAndOutliers, S.monetizationPolicies]
        },
        {
          id: 'm6-l4-one-viral-video',
          title: 'One viral video is not a channel',
          why: 'A 930 subscriber channel got 7.1 million views and 11,500 new subscribers from one video, then its next video got 3,500 views.',
          steps: [
            'Expect a fall after a spike. The spike came from the idea, not from the channel.',
            'Ask whether the video reached your core, casual and new viewers. The viral video hit all three and the follow-ups did not.',
            'Look for the next idea in neighboring niches: find similar channels elsewhere, take their outliers, and adapt them to yours.',
            'Build a repeatable system for ideas instead of hoping for another hit.',
            'Treat your first outlier as a hypothesis, and test it with the next video.'
          ],
          doNow: 'Write what you believe made your best video work, as one sentence the next video can prove wrong.',
          proof: 'A written hypothesis and the video planned to test it.',
          surfaces: ['the SCAN button on YouTube'],
          sources: [S.oneHitChannel, S.ccnAudience, S.adjacentNiche, S.viralNotEnough]
        },
        {
          id: 'm6-l5-stop-rule',
          title: 'Write the rule that decides when to stop',
          why: 'A rule written after the numbers arrive is a rationalization, so write it while you have no stake in the answer.',
          steps: [
            'Set the horizon honestly. Paddy Galloway tells people starting from zero to give it 2 years of consistent posting and improvement.',
            'Set checkpoints from his twelve month plan: 32 videos after 4 months, 48 after 8, and more than 60 after 12.',
            'Stop a format, not the channel, when it keeps landing in your bottom 5 after you changed one variable at a time.',
            'Stop at once if your list of what changes between videos is empty, because YouTube does not monetize channels whose videos feel interchangeable.',
            'Write the rule in three lines with numbers from your own baseline, and read it before you open analytics.'
          ],
          doNow: 'Write your stop rule in three lines, with your checkpoints and the numbers from your own baseline.',
          proof: 'A dated three line rule, written before your next upload.',
          surfaces: [],
          sources: [S.twoYears, S.twoPerWeek, S.oneAWeek, S.bangersFlops, S.bangersFlopsWhy, S.twelveMonths, S.twelveSteps, S.monetizationPolicies]
        },
        {
          id: 'm6-l6-protect-the-channel',
          title: 'Protect the channel, because enforcement lands on all of it',
          why: 'In January 2026 YouTube terminated 16 channels with a combined 35 million subscribers and 4.7 billion lifetime views under the inauthentic content policy.',
          steps: [
            'Know how strikes work: the first violation is usually a warning, a strike lasts 90 days, and 3 strikes in the same 90 days can remove the channel.',
            'Know that a single case of severe abuse can end a channel without warning, and that deleting a video does not remove a strike.',
            'Remember that monetization rules apply to the channel as a whole, so a pattern of reused or mass-produced videos can remove monetization from all of it.',
            'Re-read the inauthentic content and AI persona rules whenever your format stops changing between uploads.',
            'Never present generated material as a record of something real. YouTube removes harmful synthetic media that breaks its Community Guidelines.'
          ],
          doNow: 'Put your last three scripts side by side and rewrite any passage that could be swapped between them without a viewer noticing.',
          proof: 'Three scripts with their shared passages marked and rewritten.',
          surfaces: [],
          sources: [S.slopPurge, S.strikes, S.monetizationPolicies, S.ceoLetter]
        }
      ]
    }
  ];

  var COURSE = {
    id: 'youtube-results',
    title: 'Get Real Results on YouTube',
    subtitle: 'From an empty channel to a format you can repeat, with the scanner you already have',
    updated: '2026-09-23',
    audience: 'Someone starting from zero with a faceless, AI assisted channel',
    modules: MODULES
  };

  var PRIMER_MAX_CHARS = 2300;
  var LOOKUP_MAX_LESSONS = 2;

  var SURFACE_TOOLS = {
    'the SCAN button on YouTube': 'nspRunNewScan, then nspGetScanData',
    'the Niche Index': 'zerackGetExtensionData with area nicheStats',
    'the Command Center': 'zerackGetExtensionData with area savedNiches, and nspAddToTracking to add a channel',
    'YouTube Studio': 'nspOpenNewTab https://studio.youtube.com/ opens it, and the Studio assistant reads it there; you cannot fill Studio fields from YouTube'
  };

  function shortId(id) {
    var m = /^(m\d+)-(l\d+)/.exec(String(id || ''));
    return m ? m[1] + '-' + m[2] : '';
  }

  function moduleTag(m) {
    return m.id.split('-')[0].toUpperCase();
  }

  function primer(maxChars) {
    var cap = Math.min(PRIMER_MAX_CHARS, Math.max(200, Number(maxChars) || PRIMER_MAX_CHARS));
    var full = 'COURSE, the playbook you apply (' + COURSE.title + ', updated ' + COURSE.updated + '). Every lesson cites its sources, and it outranks any other knowledge in this prompt when they disagree. '
      + 'Place the user on a stage and apply its lesson. Never send the user to study a course: you are the one who applies it.\n'
      + MODULES.map(function (m) {
        return moduleTag(m) + ' ' + m.title + ': ' + m.lessons.map(function (l) { return shortId(l.id) + ' ' + l.title; }).join('; ') + '\n';
      }).join('');
    if (full.length <= cap) return full;
    var out = 'COURSE you apply, sourced; it outranks other knowledge here. Place the user on a stage and apply its lesson yourself.\n';
    for (var i = 0; i < MODULES.length; i++) {
      var m = MODULES[i];
      var line = moduleTag(m) + ' ' + m.title + ' (' + shortId(m.lessons[0].id) + ' to ' + shortId(m.lessons[m.lessons.length - 1].id) + ')\n';
      if (out.length + line.length > cap) break;
      out += line;
    }
    return out;
  }

  function words(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9%]+/g, ' ').split(' ').filter(function (w) { return w.length > 2; });
  }

  function render(mod, l) {
    return {
      id: shortId(l.id),
      module: mod.title,
      title: l.title,
      why: l.why,
      steps: l.steps,
      doNow: l.doNow,
      proof: l.proof,
      youCanRun: l.surfaces.map(function (s) { return SURFACE_TOOLS[s] ? s + ': ' + SURFACE_TOOLS[s] : s + ': no tool reaches it, name it to the user'; }),
      sources: l.sources.map(function (s) { return s.author + ', ' + s.title + ', ' + s.url; })
    };
  }

  function lookup(args) {
    args = args && typeof args === 'object' ? args : {};
    var all = [];
    MODULES.forEach(function (m) { m.lessons.forEach(function (l) { all.push({ m: m, l: l }); }); });
    var asked = [].concat(args.lesson || []).join(',').toLowerCase().split(/[\s,]+/).filter(Boolean);
    var hits = [];
    asked.forEach(function (w) {
      all.forEach(function (e) {
        var sid = shortId(e.l.id);
        var match = e.l.id === w || sid === w || (/^m\d+$/.test(w) && sid.indexOf(w + '-') === 0);
        if (match && hits.indexOf(e) < 0) hits.push(e);
      });
    });
    var by = 'id';
    if (!hits.length && args.query) {
      by = 'query';
      var q = words(args.query);
      hits = all.map(function (e) {
        var title = words(e.l.title), body = words(e.l.why + ' ' + e.l.steps.join(' '));
        var score = 0;
        q.forEach(function (w) { score += title.indexOf(w) >= 0 ? 3 : (body.indexOf(w) >= 0 ? 1 : 0); });
        return { e: e, score: score };
      }).filter(function (x) { return x.score >= 2; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (x) { return x.e; });
    }
    if (!hits.length) {
      return { ok: false, error: 'no lesson matched ' + JSON.stringify(asked.length ? asked : String(args.query || '')) + '. Use an id from the COURSE list in your instructions, such as m5-l2, or a module such as m5.' };
    }
    return {
      ok: true,
      matchedBy: by,
      howToUse: 'The steps are written to the creator. Run the ones a tool in youCanRun can do yourself, and hand the user only the rest. Name a source by its author when you rely on it.',
      lessons: hits.slice(0, LOOKUP_MAX_LESSONS).map(function (e) { return render(e.m, e.l); }),
      alsoRelevant: hits.slice(LOOKUP_MAX_LESSONS, LOOKUP_MAX_LESSONS + 4).map(function (e) { return shortId(e.l.id) + ' ' + e.l.title; })
    };
  }

  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
    }
    return o;
  }

  Object.defineProperty(root, 'NSP_CURRICULUM', {
    value: freeze({
      course: COURSE,
      modules: MODULES,
      sources: SOURCES,
      storageKey: 'nsp_course_progress',
      shortId: shortId,
      primer: primer,
      lookup: lookup
    }),
    writable: false,
    configurable: false
  });
})(typeof self !== 'undefined' ? self : this);
