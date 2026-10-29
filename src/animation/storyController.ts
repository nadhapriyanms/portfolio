import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { chapters, chapterStarts, chapterIndexById, storyLength } from '../content/chapters'
import { story, updateStoryClock, useStore } from '../state/store'
import { buildStoryTimeline } from './storyTimeline'

gsap.registerPlugin(ScrollTrigger)

let master: gsap.core.Timeline | null = null
let trigger: ScrollTrigger | null = null
let lenis: Lenis | null = null

/** Freezes page scroll while a dialog is open (works with and without smooth scrolling). */
export function setScrollLocked(locked: boolean) {
  document.documentElement.classList.toggle('is-locked', locked)
  if (lenis) {
    if (locked) lenis.stop()
    else lenis.start()
  }
}

function syncChapter() {
  updateStoryClock(master ? master.time() : 0)
  const s = useStore.getState()
  if (s.chapter !== story.chapter) s.setChapter(story.chapter)
}

/**
 * Wires page scroll to the narrative timeline. The story container is laid out so that
 * one viewport of scroll equals one timeline unit, so chapter i begins exactly when its
 * section reaches the top of the screen.
 */
export function useStoryDriver() {
  const reduced = useStore((s) => s.reducedMotion)
  useEffect(() => {
    const tl = buildStoryTimeline()
    tl.eventCallback('onUpdate', syncChapter)
    master = tl
    trigger = ScrollTrigger.create({
      trigger: '#story',
      start: 'top top',
      end: 'bottom bottom',
      animation: tl,
      scrub: reduced ? true : 0.35,
      invalidateOnRefresh: true,
    })
    tl.progress(trigger.progress)
    syncChapter()

    // Inertial smooth scrolling, driven by GSAP's ticker so scroll, timeline and render share one clock.
    let tick: ((time: number) => void) | null = null
    if (!reduced) {
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.4, syncTouch: false })
      lenis.on('scroll', ScrollTrigger.update)
      tick = (time: number) => lenis?.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
    }
    return () => {
      if (tick) gsap.ticker.remove(tick)
      lenis?.destroy()
      lenis = null
      trigger?.kill()
      tl.kill()
      master = null
      trigger = null
    }
  }, [reduced])
}

/** Scroll position (px) where a chapter's local time equals `local`. */
export function chapterScrollY(index: number, local = 0) {
  const el = document.getElementById(chapters[index].id)
  if (el) return el.offsetTop + chapters[index].weight * window.innerHeight * local
  return (chapterStarts[index] + chapters[index].weight * local) * window.innerHeight
}

/**
 * Jumps straight to a chapter behind an ink curtain, skipping everything in between,
 * then snaps the timeline so no scrub lag replays the skipped chapters.
 */
export function jumpToChapter(idOrIndex: string | number, local = 0.12) {
  const index = typeof idOrIndex === 'number' ? idOrIndex : chapterIndexById(idOrIndex)
  if (index < 0) return
  const curtain = document.getElementById('curtain')
  const go = () => {
    const top = chapterScrollY(index, local)
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true })
    else window.scrollTo({ top, behavior: 'instant' as ScrollBehavior })
    ScrollTrigger.update()
    if (master && trigger) {
      // skip any scrub catch-up so the skipped chapters are not replayed
      const tween = trigger.getTween() as gsap.core.Tween | false | undefined
      if (tween && typeof tween.progress === 'function') tween.progress(1)
      master.time(Math.min(storyLength, chapterStarts[index] + chapters[index].weight * local))
      syncChapter()
    }
    const target = document.getElementById(chapters[index].id)
    target?.focus({ preventScroll: true })
  }
  if (!curtain || useStore.getState().reducedMotion) {
    go()
    return
  }
  gsap.timeline()
    .to(curtain, { autoAlpha: 1, duration: 0.28, ease: 'power2.in' })
    .add(go)
    .to(curtain, { autoAlpha: 0, duration: 0.45, ease: 'power2.out', delay: 0.08 })
}

export function refreshStory() {
  ScrollTrigger.refresh()
}
