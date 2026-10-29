import { useEffect, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useStore } from '../state/store'
import { useStoryDriver } from '../animation/storyController'
import { WorldCanvas, hasWebGL } from '../world/WorldCanvas'
import { Hud } from '../components/hud/Hud'
import { StorySections } from '../components/overlays/StorySections'
import { ProjectDetail } from '../projects/ProjectDetail'
import { CycleInspector } from '../components/overlays/CycleInspector'
import { Loader } from '../components/loading/Loader'

function useRevealPanels(reduced: boolean) {
  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.beat:not(.beat--sticky) > *').forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 36,
          rotate: el.classList.contains('caption') ? -1.5 : 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'bottom 12%', toggleActions: 'play reverse play reverse' },
        })
      })
    })
    return () => ctx.revert()
  }, [reduced])
}

/** The hero copy drifts up and fades as the visitor starts scrolling, in step with the camera. */
function useHeroExit(reduced: boolean) {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.hero',
        { autoAlpha: 1, y: 0 },
        {
          autoAlpha: 0,
          y: reduced ? 0 : () => -window.innerHeight * 0.12,
          ease: 'none',
          scrollTrigger: { trigger: '#hero-globe', start: 'top top', end: () => `+=${window.innerHeight * 0.7}`, scrub: reduced ? true : 0.4, invalidateOnRefresh: true },
        },
      )
    })
    return () => ctx.revert()
  }, [reduced])
}

/** Mirrors the chapter onto <html> for the fallback art; isolated so chapter changes don't re-render the app. */
function ChapterAttribute() {
  const chapter = useStore((s) => s.chapter)
  useEffect(() => {
    document.documentElement.dataset.chapter = String(chapter)
  }, [chapter])
  return null
}

export function App() {
  const reduced = useStore((s) => s.reducedMotion)
  const webgl = useStore((s) => s.webgl)
  const setWebgl = useStore((s) => s.setWebgl)
  const setReady = useStore((s) => s.setReady)

  useStoryDriver()
  useRevealPanels(reduced)
  useHeroExit(reduced)

  useEffect(() => {
    if (!hasWebGL()) setWebgl('failed')
  }, [setWebgl])

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reduced)
  }, [reduced])

  useEffect(() => {
    document.documentElement.classList.toggle('no-webgl', webgl === 'failed')
  }, [webgl])


  useEffect(() => {
    // Wait for the display fonts (used inside 3D signage too), then reveal.
    let done = false
    const finish = () => {
      if (done) return
      done = true
      ScrollTrigger.refresh()
      setReady()
    }
    document.fonts.ready.then(() => window.setTimeout(finish, 350))
    const fallback = window.setTimeout(finish, 4000)
    return () => window.clearTimeout(fallback)
  }, [setReady])

  return (
    <>
      <Loader />
      <ChapterAttribute />
      {webgl !== 'failed' && <WorldCanvas />}
      <div className="fallback-art" aria-hidden="true" />
      <Hud />
      <StorySections />
      <ProjectDetail />
      <CycleInspector />
      <div id="curtain" aria-hidden="true" />
      {webgl === 'failed' && (
        <p className="webgl-note" role="note">
          3D view unavailable on this device — the full story, projects and contact details are all below.
        </p>
      )}
    </>
  )
}
