import { z } from 'zod'
import { closedRequest, type Availability } from '../lead-intelligence'
import { posterWebsite, publicSite } from '../site-audit/target'
import {
  apiURL,
  plain,
  postBody,
  remote,
  ProviderBackoff,
  respectStackQuota,
} from './shared'

type Target = { source: string; url: string; author: string | null }
export async function checkBuyerSource(
  target: Target,
  includeAccount = false,
): Promise<{
  availability: Availability
  accountCreated: string | null
  profileSite: string | null
}> {
  const result = (
    state: Availability['state'],
    accountCreated: string | null = null,
    profileSite: string | null = null,
  ) => ({
    availability: { state, checked_at: new Date().toISOString() },
    accountCreated,
    profileSite,
  })
  try {
    const url = new URL(target.url)
    if (
      target.source === 'hn' &&
      url.hostname === 'news.ycombinator.com' &&
      url.pathname === '/item'
    ) {
      const id = url.searchParams.get('id')
      if (!id || !/^\d+$/.test(id)) return result('unknown')
      const item = z
        .object({
          id: z.number(),
          by: z.string().optional(),
          dead: z.boolean().optional(),
          deleted: z.boolean().optional(),
          title: z.string().optional(),
          text: z.string().optional(),
        })
        .nullable()
        .parse(
          await (
            await remote(
              'https://hacker-news.firebaseio.com/v0/item/' + id + '.json',
              { next: { revalidate: 60 } },
            )
          ).json(),
        )
      if (!item || item.dead || item.deleted) return result('closed')
      if (String(item.id) !== id) return result('unknown')
      const state = closedRequest(
        plain((item.title ?? '') + ' ' + (item.text ?? '')),
      )
        ? 'closed'
        : 'visible'
      if (includeAccount && item.by && item.by === target.author) {
        try {
          const profile = z
            .object({ id: z.string(), created: z.number().int().positive(), about: z.string().optional() })
            .parse(
              await (
                await remote(
                  'https://hacker-news.firebaseio.com/v0/user/' +
                    encodeURIComponent(item.by) +
                    '.json',
                  { next: { revalidate: 86400 } },
                )
              ).json(),
            )
          if (profile.id === item.by)
            return result(state, new Date(profile.created * 1000).toISOString(), posterWebsite('', postBody(profile.about ?? ''), target.url))
        } catch (error) {
          if (error instanceof ProviderBackoff) throw error
          /* A missing profile does not invalidate a visible item. */
        }
      }
      return result(state)
    }
    if (
      target.source === 'stackexchange' &&
      url.hostname === 'stackoverflow.com'
    ) {
      const id = /^\/questions\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1]
      if (!id) return result('unknown')
      const params: Record<string, string> = {
        site: 'stackoverflow',
        filter: 'withbody',
      }
      if (process.env.STACK_EXCHANGE_KEY)
        params.key = process.env.STACK_EXCHANGE_KEY
      const data = z
        .object({
          items: z.array(
            z.object({
              question_id: z.number(),
              closed_date: z.number().optional(),
              locked_date: z.number().optional(),
              title: z.string(),
              body: z.string().optional(),
              owner: z
                .object({
                  user_id: z.number().int().positive().optional(),
                  display_name: z.string().optional(),
                })
                .optional(),
            }),
          ),
          backoff: z.number().optional(),
          quota_remaining: z.number().optional(),
        })
        .parse(
          await (
            await remote(
              apiURL(
                'https://api.stackexchange.com/2.3/questions/' + id,
                params,
              ),
              { next: { revalidate: 180 } },
            )
          ).json(),
        )
      respectStackQuota(data)
      const item = data.items.find((item) => String(item.question_id) === id)
      if (
        !item ||
        item.closed_date ||
        item.locked_date ||
        closedRequest(plain(item.title + ' ' + (item.body ?? '')))
      )
        return result('closed')
      if (
        includeAccount &&
        item.owner?.user_id &&
        target.author &&
        plain(item.owner.display_name ?? '') === target.author
      ) {
        const userId = item.owner.user_id
        const userParams: Record<string, string> = { site: 'stackoverflow' }
        if (process.env.STACK_EXCHANGE_KEY)
          userParams.key = process.env.STACK_EXCHANGE_KEY
        const profiles = z
          .object({
            items: z.array(
              z.object({
                user_id: z.number(),
                creation_date: z.number().int().positive(),
                website_url: z.string().nullish(),
              }),
            ),
            backoff: z.number().optional(),
            quota_remaining: z.number().optional(),
          })
          .parse(
            await (
              await remote(
                apiURL(
                  'https://api.stackexchange.com/2.3/users/' + userId,
                  userParams,
                ),
                { next: { revalidate: 86400 } },
              )
            ).json(),
          )
        respectStackQuota(profiles)
        const profile = profiles.items.find((user) => user.user_id === userId)
        if (profile)
          return result(
            'visible',
            new Date(profile.creation_date * 1000).toISOString(),
            publicSite(profile.website_url ?? '')?.href ?? null,
          )
      }
      return result('visible')
    }
    if (target.source === 'bluesky' && url.hostname === 'bsky.app') {
      const parts = /^\/profile\/([^/]+)\/post\/([A-Za-z0-9.~-]+)$/.exec(
        url.pathname,
      )
      if (!parts) return result('unknown')
      const did = decodeURIComponent(parts[1])
      if (!/^did:(plc|web):[a-zA-Z0-9.:%-]+$/.test(did))
        return result('unknown')
      const uri = 'at://' + did + '/app.bsky.feed.post/' + parts[2]
      const { posts } = z
        .object({
          posts: z.array(
            z.object({
              uri: z.string(),
              record: z.object({ text: z.string() }),
            }),
          ),
        })
        .parse(
          await (
            await remote(
              apiURL(
                'https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts',
                { uris: uri },
              ),
              { next: { revalidate: 60 } },
            )
          ).json(),
        )
      const post = posts.find((p) => p.uri === uri)
      return result(
        !post || closedRequest(post.record.text) ? 'closed' : 'visible',
      )
    }
  } catch (error) {
    if (error instanceof ProviderBackoff) throw error
    /* Outages, quotas and missing metadata leave availability unverified. */
  }
  return result('unknown')
}
