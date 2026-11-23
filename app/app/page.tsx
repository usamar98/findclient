import Link from 'next/link'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/db/server'
import { sources, statuses } from '@/lib/niche'
const query = z.object({
  q: z.string().trim().max(100).catch(''),
  source: z
    .enum(
      Object.keys(sources) as [
        keyof typeof sources,
        ...(keyof typeof sources)[],
      ],
    )
    .optional()
    .catch(undefined),
  status: z.enum(statuses).optional().catch(undefined),
  score: z.coerce.number().int().min(0).max(100).catch(0),
  days: z.enum(['1', '3', '7', '30']).optional().catch(undefined),
  sort: z.enum(['newest', 'score']).catch('newest'),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
})
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { db, user } = await requireUser(),
    f = query.parse(await searchParams)
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('credits,onboarding_done')
    .eq('id', user.id)
    .single()
  if (profileError) throw new Error('Workspace unavailable')
  if (!profile.onboarding_done) redirect('/app/onboarding')
  let request = db
    .from('leads')
    .select('id,source,title,posted_at,intent_score,problem_summary,status', {
      count: 'exact',
    })
    .eq('user_id', user.id)
    .gte('intent_score', f.score)
  if (f.q)
    request = request.ilike('title', '%' + f.q.replace(/[\\%_]/g, '\\$&') + '%')
  if (f.status) request = request.eq('status', f.status)
  if (f.source) request = request.eq('source', f.source)
  if (f.days)
    request = request.gte(
      'posted_at',
      new Date(Date.now() - Number(f.days) * 86400000).toISOString(),
    )
  const ranges = ['all', 'replied', 'won'] as const
  const [result, ...stats] = await Promise.all([
    request
      .order(f.sort === 'score' ? 'intent_score' : 'posted_at', {
        ascending: false,
      })
      .order('id')
      .range((f.page - 1) * 20, f.page * 20 - 1),
    ...ranges.map((s) => {
      const q = db
        .from('leads')
        .select('id', { head: true, count: 'exact' })
        .eq('user_id', user.id)
      return s === 'all' ? q : q.eq('status', s)
    }),
  ])
  if (result.error || stats.some((s) => s.error))
    throw new Error('Inbox unavailable')
  function pageHref(page: number) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(f))
      if (v !== undefined) params.set(k, String(v))
    params.set('page', String(page))
    return '/app?' + params
  }
  return (
    <>
      <p className="meta">Workspace · {profile.credits} credits available</p>
      <h1>Lead inbox</h1>
      <div className="stats">
        {['Leads found', 'Replied', 'Won'].map((label, i) => (
          <div key={label}>
            <b>{stats[i].count}</b>
            {label}
          </div>
        ))}
      </div>
      <form className="filters panel">
        <label>
          Search title
          <input name="q" defaultValue={f.q} maxLength={100} />
        </label>
        <label>
          Source
          <select name="source" defaultValue={f.source}>
            <option value="">All sources</option>
            {Object.entries(sources).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={f.status}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Min. score
          <input
            type="number"
            name="score"
            min={0}
            max={100}
            defaultValue={f.score}
          />
        </label>
        <label>
          Posted
          <select name="days" defaultValue={f.days}>
            <option value="">Any date</option>
            {['1', '3', '7', '30'].map((d) => (
              <option key={d} value={d}>
                Past {d} days
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={f.sort}>
            <option value="newest">Newest</option>
            <option value="score">Highest score</option>
          </select>
        </label>
        <button>Apply filters</button>
      </form>
      {result.data?.length ? (
        result.data.map((l) => (
          <article key={l.id}>
            <p className="meta">
              {sources[l.source as keyof typeof sources]} · {l.intent_score}/100
              · {l.status} ·{' '}
              {new Date(l.posted_at).toLocaleDateString('en-US', {
                timeZone: 'UTC',
              })}
            </p>
            <h2>
              <Link href={'/app/leads/' + l.id}>{l.title}</Link>
            </h2>
            <p>{l.problem_summary}</p>
          </article>
        ))
      ) : (
        <section className="panel">
          <h2>No matching leads yet</h2>
          <p>
            The hourly scan adds recent requests that meet your score threshold.
            You can adjust the keywords and sources in settings.
          </p>
          <Link href="/app/settings">Manage your niches</Link>
        </section>
      )}
      <nav aria-label="Inbox pages">
        {f.page > 1 && <Link href={pageHref(f.page - 1)}>Previous page</Link>}
        {(result.count ?? 0) > f.page * 20 && (
          <Link href={pageHref(f.page + 1)}>Next page</Link>
        )}
      </nav>
    </>
  )
}
