import { create } from 'zustand'
import { chapters, chapterStarts, storyLength } from '../content/chapters'

export type Quality = 'high' | 'balanced' | 'low'

/**
 * Mutable per-frame story state. GSAP writes it, Three.js reads it in useFrame.
 * Kept outside React so scrolling never triggers re-renders.
 */
export const story = {
  time: 0,
  chapter: 0,
  local: 0,
  /** Camera rig written by the GSAP timeline (position, look target, fov, roll). */
  rig: { px: 0, py: 0.6, pz: 9, tx: 0, ty: 0, tz: 0, fov: 40, roll: 0, sx: 0 },
  /** Scene-owned point the rig is relative to (e.g. the moving rider). */
  anchor: { x: 0, y: 0, z: 0 },
  /** Full-screen effect parameters written by the GSAP timeline. */
  fx: { iris: 1, glitch: 0, fisheye: 0, cyber: 0, dusk: 0, dim: 0, flash: 0 },
}

export function localTime(chapterIndex: number, time = story.time) {
  const start = chapterStarts[chapterIndex]
  const w = chapters[chapterIndex].weight
  return Math.min(1, Math.max(0, (time - start) / w))
}

export function updateStoryClock(time: number) {
  story.time = Math.min(storyLength, Math.max(0, time))
  let i = chapters.length - 1
  while (i > 0 && story.time < chapterStarts[i]) i--
  story.chapter = i
  story.local = localTime(i)
}

function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'balanced'
  const nav = navigator as Navigator & { deviceMemory?: number }
  // phones/tablets by input type, not window width: a narrow desktop window still gets desktop quality
  const mobile = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
  const cores = nav.hardwareConcurrency ?? 4
  const mem = nav.deviceMemory ?? 8
  if (mobile || cores <= 4 || mem <= 4) return mobile ? 'low' : 'balanced'
  return 'high'
}

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) ?? fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — preference lasts for this visit only */
  }
}

const prefersReduced =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface UIState {
  chapter: number
  quality: Quality
  reducedMotion: boolean
  sound: boolean
  ready: boolean
  webgl: 'unknown' | 'ok' | 'failed'
  projectId: string | null
  inspectingCycle: boolean
  achievementId: string | null
  hoverProjectId: string | null
  setChapter: (i: number) => void
  setQuality: (q: Quality) => void
  setReducedMotion: (v: boolean) => void
  setSound: (v: boolean) => void
  setReady: () => void
  setWebgl: (v: 'ok' | 'failed') => void
  openProject: (id: string | null) => void
  setInspectingCycle: (v: boolean) => void
  setAchievement: (id: string | null) => void
  setHoverProject: (id: string | null) => void
}

export const useStore = create<UIState>((set) => ({
  chapter: 0,
  quality: readPref<Quality>('np-quality', detectQuality()),
  reducedMotion: readPref('np-motion', prefersReduced ? 'reduced' : 'full') === 'reduced',
  sound: false,
  ready: false,
  webgl: 'unknown',
  projectId: null,
  inspectingCycle: false,
  achievementId: null,
  hoverProjectId: null,
  setChapter: (chapter) => set({ chapter }),
  setQuality: (quality) => {
    writePref('np-quality', quality)
    set({ quality })
  },
  setReducedMotion: (reducedMotion) => {
    writePref('np-motion', reducedMotion ? 'reduced' : 'full')
    set({ reducedMotion })
  },
  setSound: (sound) => set({ sound }),
  setReady: () => set({ ready: true }),
  setWebgl: (webgl) => set({ webgl }),
  openProject: (projectId) => set({ projectId }),
  setInspectingCycle: (inspectingCycle) => set({ inspectingCycle }),
  setAchievement: (achievementId) => set({ achievementId }),
  setHoverProject: (hoverProjectId) => set({ hoverProjectId }),
}))

if (import.meta.env.DEV) (window as unknown as { __story: typeof story }).__story = story
