'use client'

import { useEffect, useRef, useState } from 'react'
import { homeSources, type HomeSource } from './home-sources'
import './hero-gallery.css'

type Kind = 'request' | 'reply'
type Brief = { title: string; detail: string; draft: string }

const newBriefs: Partial<Record<HomeSource['id'], Brief>> = {
  reddit: {
    title: 'Who can rebuild our booking page?',
    detail: 'Our pottery studio has classes on three different calendars. We need one booking page before the winter term.',
    draft: 'Can two classes run at the same time? I’d map one week of bookings before choosing how to combine the calendars.',
  },
  x: {
    title: 'Need an editor for six product demos',
    detail: 'We have screen recordings for six new features. We’re looking for an editor to turn them into short, captioned demos.',
    draft: 'Which feature gets the most questions? Let’s cut that demo first and use it to settle the pace for the other five.',
  },
  hn: {
    title: 'Help move our docs without breaking links',
    detail: 'We’re moving our developer docs to a new site and need someone to preserve existing links from integrations.',
    draft: 'Do you have a list of the old URLs? I’d match each one to its new page and test the redirects before launch.',
  },
  bluesky: {
    title: 'Looking for a designer for our book fair',
    detail: 'Our independent book fair needs a poster and a square social graphic. The printer needs final files next Friday.',
    draft: 'What are the printer’s trim and bleed sizes? We can settle the poster layout first and adapt it for the square graphic.',
  },
  indiehackers: {
    title: 'Our trial emails need a rewrite',
    detail: 'Customers sign up but rarely finish their first project. We’d like a writer to revise the first three trial emails.',
    draft: 'Where do new users usually stop? The first email could walk them through that one step with a worked example.',
  },
  shopify: {
    title: 'Can someone fix our size guide?',
    detail: 'Our size chart is readable on a laptop but gets cut off on phones. Can a theme developer fix it before our collection drops?',
    draft: 'Could you share the affected product page? I’d check the chart at phone width and see whether the table or the drawer is clipping it.',
  },
}

const examples = homeSources.map(source => ({
  source,
  brief: newBriefs[source.id] ?? source,
}))
type Example = (typeof examples)[number]

function Platform({ source }: { source: HomeSource }) {
  return (
    <span className="cf-gallery-platform" data-source={source.id}>
      {source.mark
        ? <i aria-hidden="true" style={{ maskImage: `url(/brands/${source.mark}.svg)` }} />
        : <i aria-hidden="true" className="cf-gallery-forum-mark" />}
      {source.name}
    </span>
  )
}

/** Move the native scroll position so wheel, touch and keyboard browsing still work. */
function useGalleryMotion(paused: boolean) {
  const viewport = useRef<HTMLDivElement>(null)
  const firstSet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const port = viewport.current
    const first = firstSet.current
    const stage = port?.closest('.cf-hero-stage')
    if (!port || !first || !stage || paused) return

    let inView = false
    let frame = 0
    let last = 0
    let fraction = 0
    let height = first.offsetHeight
    const resize = new ResizeObserver(() => { height = first.offsetHeight })
    resize.observe(first)

    function tick(now: number) {
      if (last && port && height) {
        fraction += Math.min(now - last, 60) * .023
        const distance = Math.floor(fraction)
        if (distance) {
          const next = port.scrollTop - distance
          port.scrollTop = next < 0 ? next + height : next
          fraction -= distance
        }
      }
      last = now
      frame = requestAnimationFrame(tick)
    }

    function update() {
      cancelAnimationFrame(frame)
      last = 0
      const interacting = stage?.querySelector('.cf-hero-gallery:hover, .cf-hero-gallery:focus-within, .cf-gallery-dialog[open]')
      if (inView && !document.hidden && !interacting)
        frame = requestAnimationFrame(tick)
    }
    const onFocusOut = () => queueMicrotask(update)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    })
    observer.observe(port)
    stage.addEventListener('pointerover', update)
    stage.addEventListener('pointerout', update)
    stage.addEventListener('focusin', update)
    stage.addEventListener('focusout', onFocusOut)
    document.addEventListener('visibilitychange', update)
    return () => {
      inView = false
      observer.disconnect()
      resize.disconnect()
      cancelAnimationFrame(frame)
      stage.removeEventListener('pointerover', update)
      stage.removeEventListener('pointerout', update)
      stage.removeEventListener('focusin', update)
      stage.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('visibilitychange', update)
    }
  }, [paused])
  return { viewport, firstSet }
}

export function HeroGallery({ kind, paused }: { kind: Kind; paused: boolean }) {
  const request = kind === 'request'
  const label = request ? 'Example requests' : 'Example replies'
  const { viewport, firstSet } = useGalleryMotion(paused)
  const modal = useRef<HTMLDialogElement>(null)
  const [opened, setOpened] = useState<Example>(examples[0])
  const show = (example: Example) => {
    setOpened(example)
    modal.current?.showModal()
  }

  return (
    <div className={`cf-hero-gallery cf-hero-gallery-${kind}`}>
      <p className="cf-gallery-caption">{label}<span aria-hidden="true">↴</span></p>
      <div className="cf-gallery-port" ref={viewport} role="region" aria-label={`Browse example ${request ? 'requests' : 'replies'}`} tabIndex={0}>
        {[false, true].map(copy => (
          <div className="cf-gallery-set" ref={copy ? undefined : firstSet} key={String(copy)} aria-hidden={copy || undefined}>
            {examples.map(example => (
              <button type="button" className="cf-gallery-card" key={example.source.id} tabIndex={copy ? -1 : undefined}
                aria-label={`Read ${example.source.name} ${kind} example. ${example.brief.title}`} onClick={() => show(example)}>
                <span className="cf-gallery-chrome">
                  <span className="cf-gallery-appmark" aria-hidden="true"><i /><i /><i /></span>
                  {request ? 'Lead inbox' : 'Reply draft'}
                </span>
                <Platform source={example.source} />
                <span className="cf-gallery-excerpt">{request ? example.brief.title : example.brief.draft}</span>
                <span className="cf-gallery-tag">{request ? example.source.skill : 'Suggested reply'}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <dialog className="cf-gallery-dialog" aria-label={`${opened.source.name} ${kind} example`} ref={modal}>
        <div className="cf-gallery-toolbar"><span>Example {kind}</span><form method="dialog"><button aria-label="Close preview">Close ×</button></form></div>
        <Platform source={opened.source} />
        <h2>{opened.brief.title}</h2>
        <p>{opened.brief.detail}</p>
        {!request && <div className="cf-gallery-full-reply"><strong>Suggested reply</strong><p>{opened.brief.draft}</p></div>}
      </dialog>
    </div>
  )
}
