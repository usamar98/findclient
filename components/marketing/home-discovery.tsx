'use client'

import { useEffect, useState } from 'react'
import { isPaidSource, paidSourceLabels, paidSources } from '@/lib/paid-sources'
import { homeSources } from './home-sources'
import { HeroGallery } from './hero-gallery'
import { LifetimeLink } from './lifetime-link'

const heroPlatforms = [
  ...homeSources,
  ...paidSources.map(id => ({ id, name: paidSourceLabels[id], mark: id === 'github' ? 'github' : '' })),
]

function SourceMark({ source }: { source: (typeof heroPlatforms)[number] }) {
  if (source.mark) {
    return <span aria-hidden="true" className="cf-source-mark" style={{ maskImage: `url(/brands/${source.mark}.svg)` }} />
  }
  return source.id === 'forums' ? <span aria-hidden="true" className="cf-forums-mark" /> : null
}

export function DiscoveryHero() {
  const [index, setIndex] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [visible, setVisible] = useState(true)
  const playing = autoPlay && visible
  const source = heroPlatforms[index]
  const liveResearch = isPaidSource(source.id)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyPreference = () => setAutoPlay(!motion.matches)
    const onVisibility = () => setVisible(!document.hidden)
    applyPreference()
    onVisibility()
    motion.addEventListener('change', applyPreference)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      motion.removeEventListener('change', applyPreference)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const clock = window.setInterval(() => setIndex(i => (i + 1) % heroPlatforms.length), 1000)
    return () => window.clearInterval(clock)
  }, [playing])

  return (
    <section className="cf-discovery" aria-labelledby="cf-discovery-title">
      <div className="cf-hero-stage" data-source={source.id} data-live-research={liveResearch || undefined}>
        <div className="cf-hero-copy">
          <p className="cf-audience"><span className="cf-radar" aria-hidden="true" /> For freelancers &amp; agencies</p>
          <h1 id="cf-discovery-title">
            Get Clients From{' '}
            <span className="cf-hero-platform-line">
              <span key={source.id} className={'cf-hero-name' + (source.name.length > 9 ? ' cf-hero-name-long' : '')}>{source.name}</span>
            </span>{' '}
            <span className="cf-hero-suffix"><span>{liveResearch ? 'with Live Research' : 'on Autopilot'}</span></span>
          </h1>
          <aside className="guide-answer cf-hero-answer" aria-label="Quick answer">
            <p>Find freelance leads in public conversations and paid job listings. See what the buyer wants to hire for, check any budget or deadline they mention, and draft a reply in your own voice. You choose what to send.</p>
          </aside>
          <div className="cf-hero-actions">
            <LifetimeLink className="cf-home-primary"><span aria-hidden="true">↗</span></LifetimeLink>
          </div>
        </div>
        <HeroGallery kind="request" paused={!playing} />
        <HeroGallery kind="reply" paused={!playing} />
      </div>
      <div className="cf-source-switcher">
        <div className="cf-motion-toolbar">
          <p>Explore by platform</p>
          <button type="button" className="cf-motion-toggle" aria-label={autoPlay ? 'Pause hero animation' : 'Play hero animation'}
            onClick={() => setAutoPlay(running => !running)}>
            <span aria-hidden="true">{autoPlay ? 'Ⅱ' : '▶'}</span>{autoPlay ? 'Pause' : 'Play'}
          </button>
        </div>
        <div role="group" aria-label="Choose the platform in the headline">
          {heroPlatforms.map((item, i) => (
            <button type="button" key={item.id} data-source={item.id} className="cf-source-switch" onClick={() => { setIndex(i); setAutoPlay(false) }} aria-pressed={source.id === item.id}>
              <SourceMark source={item} /><span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SourceExamples() {
  return (
    <div className="cf-source-cards">
      {homeSources.map((source) => (
        <details className="cf-source-card" key={source.id} data-source={source.id} name="source-example">
          <summary>
            <span className="cf-source-label"><SourceMark source={source} />{source.name}</span>
            <span className="cf-source-brief">{source.title}</span>
            <span className="cf-source-foot"><span>{source.skill}</span><span className="cf-expand" aria-hidden="true" /></span>
          </summary>
          <div className="cf-example-body">
            <p>{source.detail}</p>
            <strong>Suggested reply</strong>
            <p>{source.draft}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
