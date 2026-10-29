import gsap from 'gsap'
import { chapters, chapterStarts, storyLength } from '../content/chapters'
import { story } from '../state/store'
import { cameraShots } from './cameraShots'

type FxKey = keyof typeof story.fx
type Keys = [number, number][]

/** Effect tracks keyed by chapter, in chapter-local time. */
const fxTracks: Record<string, Partial<Record<FxKey, Keys>>> = {
  'hero-globe': { fisheye: [[0, 0], [0.62, 0], [1, 0.75]] },
  'college-workspace': { dusk: [[0, 0], [1, 0.15]] },
  'night-flyer': { dusk: [[0, 0.15], [0.3, 1], [1, 1]], flash: [[0, 0], [0.9, 0], [1, 1]] },
  'cycle-workshop': { flash: [[0, 1], [0.07, 0], [1, 0]] },
  'ride-transition': {
    glitch: [[0, 0], [0.56, 0], [0.6, 0.18], [0.63, 0], [0.68, 0.25], [0.7, 0.05], [0.86, 0.85], [0.92, 0.3], [1, 0.12]],
    cyber: [[0, 0], [0.7, 0], [0.95, 1], [1, 1]],
    flash: [[0, 0], [0.85, 0], [0.87, 0.55], [0.91, 0], [1, 0]],
  },
  'cyber-city': { glitch: [[0, 0.12], [0.12, 0], [1, 0]], cyber: [[0, 1], [1, 1]] },
  'project-skyline': { cyber: [[0, 1], [1, 1]] },
  'achievement-constellation': { cyber: [[0, 0.6], [1, 0.25]] },
}

const IRIS = 0.2 // timeline units used to close/open the iris at a scene change

/** Scene changes that cut through a paper-white flash (the flyer becomes the sketch) instead of the ink iris. */
const flashCuts = new Set(['night-flyer'])

const fxDefaults: Record<FxKey, number> = { iris: 1, glitch: 0, fisheye: 0, cyber: 0, dusk: 0, dim: 0, flash: 0 }

/**
 * Builds the master narrative timeline. Every tween is a fromTo so scrubbing in either
 * direction, or jumping straight to a chapter, always lands on the same values.
 */
export function buildStoryTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none', immediateRender: false } })
  const rig = story.rig
  const fx = story.fx

  // Seed the rig with the opening keyframe so the first frame already matches the timeline
  // (otherwise the camera starts at defaults and pops into place on the first scroll event).
  const first = cameraShots[chapters[0].id][0]
  Object.assign(rig, { px: first.p[0], py: first.p[1], pz: first.p[2], tx: first.l[0], ty: first.l[1], tz: first.l[2], fov: first.fov, roll: first.roll ?? 0, sx: first.sx ?? 0 })
  Object.assign(fx, fxDefaults)

  chapters.forEach((ch, i) => {
    const start = chapterStarts[i]
    const w = ch.weight
    const shots = cameraShots[ch.id]
    for (let k = 0; k < shots.length - 1; k++) {
      const a = shots[k]
      const b = shots[k + 1]
      tl.fromTo(
        rig,
        { px: a.p[0], py: a.p[1], pz: a.p[2], tx: a.l[0], ty: a.l[1], tz: a.l[2], fov: a.fov, roll: a.roll ?? 0, sx: a.sx ?? 0 },
        {
          px: b.p[0], py: b.p[1], pz: b.p[2], tx: b.l[0], ty: b.l[1], tz: b.l[2], fov: b.fov, roll: b.roll ?? 0, sx: b.sx ?? 0,
          duration: (b.t - a.t) * w,
          ease: b.ease ?? 'power1.inOut',
        },
        start + a.t * w,
      )
    }

    // Every effect is defined for every chapter (defaults fill the gaps) so seeking never leaks.
    const tracks = fxTracks[ch.id] ?? {}
    ;(Object.keys(fxDefaults) as FxKey[]).forEach((key) => {
      if (key === 'iris') return
      const keys: Keys = tracks[key] ?? [[0, fxDefaults[key]], [1, fxDefaults[key]]]
      for (let k = 0; k < keys.length - 1; k++) {
        const [ta, va] = keys[k]
        const [tb, vb] = keys[k + 1]
        tl.fromTo(fx, { [key]: va }, { [key]: vb, duration: Math.max(0.0001, (tb - ta) * w) }, start + ta * w)
      }
    })

    // Iris: closes at the end of a chapter whose next chapter lives in a different scene.
    const prevScene = chapters[i - 1]?.scene
    const nextScene = chapters[i + 1]?.scene
    const opens = i > 0 && prevScene !== ch.scene && !flashCuts.has(chapters[i - 1].id)
    const closes = !!nextScene && nextScene !== ch.scene && !flashCuts.has(ch.id)
    const end = start + w
    tl.fromTo(fx, { iris: opens ? 0 : 1 }, { iris: 1, duration: opens ? IRIS : 0.0001, ease: 'power2.out' }, start)
    if (closes) tl.fromTo(fx, { iris: 1 }, { iris: 0, duration: IRIS, ease: 'power2.in' }, end - IRIS)
  })

  tl.set({}, {}, storyLength)
  return tl
}
