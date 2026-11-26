import test from 'node:test'
import assert from 'node:assert/strict'
import { matchResearchPost, researchMatchPlan } from '../lib/research-matching'
import type { NormalizedPost } from '../lib/sources/shared'

const shopify = researchMatchPlan('Shopify Developer')
function candidate(source: NormalizedPost['source'], title: string, body = '', url = 'https://example.test/post') {
  return { source, title, body, url }
}

test('recognized roles have a bounded discovery plan, keeping other searches and qualifiers literal', () => {
  assert.deepEqual(shopify.queries, ['Shopify Developer', 'Shopify', 'Liquid'])
  assert.deepEqual(researchMatchPlan('Webflow developer').queries, ['Webflow developer', 'Webflow'])
  assert.deepEqual(researchMatchPlan('Shopify Developer London').queries, ['Shopify Developer London'])
  assert.deepEqual(researchMatchPlan('"Shopify Developer"').queries, ['"Shopify Developer"'])
  assert.deepEqual(researchMatchPlan('software developer').queries, ['software developer', 'web developer'])
})

test('merchant requests match by trusted forum context or distinctive terms and quote the original text', () => {
  for (const post of [
    candidate('shopify', 'Our cart drawer stopped working on mobile.'),
    candidate('shopify', 'Variant selector not updating', 'How can I fix the product page?'),
    candidate('shopify', 'Is there a way to change the checkout banner?'),
    candidate('shopify', 'Has anyone figured out how to add sections to a product page?'),
    candidate('shopify', 'How to remove the image from my theme?'),
    candidate('shopify', 'Can I change the checkout button?'),
    candidate('shopify', 'Our customers can’t check out since we changed the theme.'),
    candidate('shopify', 'I’d like to customize my cart drawer'),
    candidate('bluesky', 'Is anyone else using the Dawn theme?', 'Our storefront stopped working after yesterday’s update.'),
    candidate('hn', 'Our Shopify storefront', 'Can anyone help us fix the checkout?'),
    { ...candidate('stackexchange', 'How can I use a custom setting inside a Liquid template?'), tags: ['shopify'] },
    { ...candidate('stackexchange', 'Checkout integration', 'We keep getting an error when saving a variant.'), tags: ['shopify'] },
  ]) {
    const match = matchResearchPost(shopify, post)
    assert.equal(match?.kind, 'help', post.title)
    assert.ok(match.excerpt && (post.title.includes(match.excerpt) || post.body.includes(match.excerpt)))
  }
  assert.equal(matchResearchPost(shopify, candidate('hn', 'Hiring a Shopify developer', 'Please DM me for details.'))?.kind, 'hiring')
  assert.equal(matchResearchPost(shopify, candidate('bluesky', 'Our Shopify store needs someone', 'Looking to hire someone to redesign our Shopify theme.'))?.kind, 'hiring')
  assert.equal(matchResearchPost(shopify, candidate('hn', 'A history of the Shopify developer conference'))?.kind, 'topic')
})

test('broader network results exclude sellers, retail shoppers, off-topic questions and neutral mentions', () => {
  for (const post of [
    candidate('bluesky', 'I am a Shopify developer available for freelance projects.'),
    candidate('shopify', 'Where is my order?', 'I cannot find my order from your checkout.'),
    candidate('shopify', 'Any ideas where I can find a jewellery supplier?'),
    candidate('hn', 'Can anyone help with a checkout bug on my Prestashop site?'),
    candidate('bluesky', 'We are hiring a sales associate for our Shopify store.'),
    candidate('hn', 'Can anyone explain how liquid hydrogen is stored?'),
    candidate('bluesky', 'How do I find my way home?', 'Link in bio https://example.org/shopify/developer'),
    candidate('hn', 'Hiring a Shopify developer', 'The position is filled.'),
    candidate('hn', '10 tips for better Shopify themes'),
    candidate('bluesky', 'How to remove the image in a Shopify theme', 'Can you change the theme? In this guide, I explain how.'),
    candidate('shopify', 'Tutorial: How to customize your cart?', 'How can you fix the layout? Watch the video.'),
    candidate('shopify', 'Disable the cart button for unavailable variants', 'That way customers can’t accidentally add unavailable items.'),
    candidate('shopify', 'Is there a way to get a refund for my order?'),
  ]) assert.equal(matchResearchPost(shopify, post), null, post.title)
})

test('quoted and technology-specific custom keywords preserve the original request', () => {
  const csharp = researchMatchPlan('C# migration')
  assert.equal(matchResearchPost(csharp, candidate('hn', 'Need help with a C++ migration')), null)
  assert.equal(matchResearchPost(csharp, candidate('hn', 'Need help with our C# migration'))?.kind, 'help')
  assert.equal(matchResearchPost(researchMatchPlan('"carbon steel"'), candidate('hn', 'Looking to hire a steel worker in Carbon County')), null)
  assert.equal(matchResearchPost(researchMatchPlan('Shopify developer London'), candidate('hn', 'Hiring a Shopify developer in Paris')), null)
  assert.equal(matchResearchPost(researchMatchPlan('Python developer London'), candidate('hn', 'Hiring: Senior Python Developer | London'))?.kind, 'hiring')
  assert.equal(matchResearchPost(researchMatchPlan('WooCommerce developer'), candidate('forums', 'Can I change my WordPress theme?', '', 'https://wordpress.org/support/topic/abc')), null)
  assert.equal(matchResearchPost(researchMatchPlan('WooCommerce developer'), candidate('forums', 'Can I change my WooCommerce checkout template?', '', 'https://wordpress.org/support/topic/abc'))?.kind, 'help')
  assert.equal(matchResearchPost(researchMatchPlan('Webflow developer'), candidate('forums', 'Our CMS collections stopped working.', '', 'https://community.webflow.com/ask/post/abc'))?.kind, 'help')
  assert.equal(matchResearchPost(researchMatchPlan('Webflow developer'), candidate('forums', 'Our CMS collections stopped working.', '', 'https://wordwebflow.example/ask/post/abc')), null)
})
