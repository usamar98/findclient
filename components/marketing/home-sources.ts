// Illustrative briefs for the interactive source preview, not live customer posts.
export const homeSources = [
  {
    id: 'reddit', name: 'Reddit', mark: 'reddit', skill: 'Web design',
    title: 'Can someone redesign our landing page?',
    detail: 'We launch in three weeks. Our pricing page is ready, but the landing page still needs a designer.',
    draft: 'Which action should visitors take first? I’d start with a wireframe of the first screen so we can test the message before polishing the layout.',
  },
  {
    id: 'x', name: 'X', mark: 'x', skill: 'Video editing',
    title: 'Looking for a freelance video editor',
    detail: 'We have four founder interviews to cut into short clips. Looking for an editor who can start next week.',
    draft: 'How long should each clip be? One sample cut would let us settle the pace, captions and framing before editing all four interviews.',
  },
  {
    id: 'hn', name: 'Hacker News', mark: 'ycombinator', skill: 'Development',
    title: 'Who can help speed up our API?',
    detail: 'Our reporting endpoint slows down as accounts grow. We’re seeking a consultant for a focused performance audit.',
    draft: 'Do you have a recent slow request trace? That would help separate database time from application time and narrow the scope of the audit.',
  },
  {
    id: 'bluesky', name: 'Bluesky', mark: 'bluesky', skill: 'Brand design',
    title: 'Our studio needs a new visual identity',
    detail: 'We’re opening a second studio and need a designer to adapt our identity for signage and the web.',
    draft: 'Do you have photos of the new space? I’d test the existing mark at sign size first, then see what needs adjusting for smaller screens.',
  },
  {
    id: 'indiehackers', name: 'Indie Hackers', mark: 'indiehackers', skill: 'Copywriting',
    title: 'Seeking a copywriter for our launch',
    detail: 'The product is ready. We need someone to rewrite our homepage before the launch email goes out.',
    draft: 'What did your last three customers say convinced them to sign up? I’d use their words to draft the headline and the first product example.',
  },
  {
    id: 'stackexchange', name: 'Stack Overflow', mark: 'stackoverflow', skill: 'Engineering',
    title: 'Why does this database query time out?',
    detail: 'A report joins several large tables and stops responding on production data. The author shares a query plan.',
    draft: 'Which step in the plan processes the most rows? Comparing estimated and actual row counts is a useful place to start.',
  },
  {
    id: 'shopify', name: 'Shopify Community', mark: 'shopify', skill: 'Ecommerce',
    title: 'Our product photos show the wrong variant',
    detail: 'The gallery keeps showing the first color when shoppers switch variants on mobile. We need a theme specialist.',
    draft: 'Does the selected variant ID change when you tap a swatch? That check will tell us whether to inspect the selector or the gallery update.',
  },
  {
    id: 'forums', name: 'Public forums', mark: '', skill: 'Webflow',
    title: 'Need a hand with a Webflow migration',
    detail: 'We have a blog and a directory to move into Webflow. We need help mapping the collections and planning redirects.',
    draft: 'How are the two collections linked today? A small test import with a few related items would surface any mapping issues before the full move.',
  },
] as const
export type HomeSource = typeof homeSources[number]
