import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { chapters, type SceneKey } from '../content/chapters'
import { story, useStore } from '../state/store'
import { createActiveHandle, SceneActiveContext, useActiveRef } from './SceneContext'

const loaders: Record<SceneKey, () => Promise<{ default: React.ComponentType }>> = {
  globe: () => import('../scenes/GlobeScene'),
  school: () => import('../scenes/SchoolScene'),
  college: () => import('../scenes/CollegeScene'),
  workshop: () => import('../scenes/WorkshopScene'),
  city: () => import('../scenes/CityScene'),
  skyline: () => import('../scenes/ProjectSkylineScene'),
  constellation: () => import('../scenes/AchievementScene'),
  contact: () => import('../scenes/ContactScene'),
}

// Each environment is its own chunk: the globe loads first, the rest on demand.
const scenes = Object.fromEntries(Object.entries(loaders).map(([k, l]) => [k, lazy(l)])) as Record<
  SceneKey,
  React.LazyExoticComponent<React.ComponentType>
>

const slots = new Map<SceneKey, THREE.Group>()

/** Keeps one broken environment from taking down the whole 3D layer; the HTML story carries on. */
class SlotBoundary extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn(`[world] scene "${this.props.id}" failed and was skipped:`, err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Once a hidden slot has loaded, render it once into a tiny offscreen target with culling
 * off and everything else hidden. That compiles its shaders (with its own lights), compiles
 * the shadow-map shaders and uploads every texture, so the switch behind the iris is instant.
 */
const warmTarget = new THREE.WebGLRenderTarget(32, 32)
// every scene renders with fog, so warm with fog too or the compiled shader variants would not match
const warmFog = new THREE.Fog('#000000', 380, 1000)

function Prewarm({ id }: { id: SceneKey }) {
  const { gl, scene, camera } = useThree()
  const done = useRef(false)
  const active = useActiveRef()
  useFrame(() => {
    if (done.current) return
    // a scene that mounts as the current one is warmed by being drawn; nothing to do
    if (active.current) {
      done.current = true
      return
    }
    const mine = slots.get(id)
    if (!mine) return
    done.current = true
    const vis = new Map<THREE.Group, boolean>()
    slots.forEach((g) => vis.set(g, g.visible))
    slots.forEach((g) => (g.visible = g === mine))
    const culled: THREE.Object3D[] = []
    mine.traverse((o) => {
      if (o.frustumCulled) {
        o.frustumCulled = false
        culled.push(o)
      }
    })
    const prevTarget = gl.getRenderTarget()
    const prevFog = scene.fog
    if (!scene.fog) scene.fog = warmFog
    try {
      gl.setRenderTarget(warmTarget)
      gl.render(scene, camera)
    } finally {
      gl.setRenderTarget(prevTarget)
      scene.fog = prevFog
      culled.forEach((o) => (o.frustumCulled = true))
      vis.forEach((v, g) => (g.visible = v))
    }
  })
  return null
}

function Slot({ id, active }: { id: SceneKey; active: boolean }) {
  const Scene = scenes[id]
  const handle = useMemo(() => createActiveHandle(active), []) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (handle.current === active) return
    handle.current = active
    handle.listeners.forEach((f) => f())
  }, [active, handle])
  // The scene subtree is memoised: toggling `active` only flips visibility and notifies subscribers.
  const content = useMemo(
    () => (
      <SceneActiveContext.Provider value={handle}>
        <SlotBoundary id={id}>
          <Suspense fallback={null}>
            <Scene />
            <Prewarm id={id} />
          </Suspense>
        </SlotBoundary>
      </SceneActiveContext.Provider>
    ),
    [id, Scene, handle],
  )
  return (
    <group
      ref={(g) => {
        if (g) slots.set(id, g)
        else slots.delete(id)
      }}
      visible={active}
    >
      {content}
    </group>
  )
}

/** Keeps the current environment and its neighbours mounted; anything further away is disposed. */
export function SceneManager() {
  const chapter = useStore((s) => s.chapter)
  const current = chapters[chapter].scene
  const next = chapters.slice(chapter + 1).find((c) => c.scene !== current)?.scene
  const prev = chapters.slice(0, chapter).reverse().find((c) => c.scene !== current)?.scene
  // A stable window of mounted scenes: the current one immediately, its neighbours once the
  // browser is idle (their one-time build never lands mid-scroll). Scenes leave only when they
  // fall outside the window, so scrolling back and forth never rebuilds anything.
  // On desktop qualities a scene stays once built (hidden scenes cost no draw calls);
  // low quality keeps only the window to save memory on phones.
  const keepAll = useStore((s) => s.quality !== 'low')
  const [mounted, setMounted] = useState<SceneKey[]>([current])
  useEffect(() => {
    const window3 = [prev, current, next].filter((k): k is SceneKey => !!k)
    setMounted((m) => {
      const kept = keepAll ? m : m.filter((k) => window3.includes(k))
      return kept.includes(current) ? kept : [...kept, current]
    })
    const add = () => setMounted((m) => [...m, ...window3.filter((k) => !m.includes(k))])
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(add, { timeout: 1500 })
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(add, 600)
    return () => window.clearTimeout(id)
  }, [prev, current, next, keepAll])
  const keys = mounted.includes(current) ? mounted : [...mounted, current]

  useEffect(() => {
    // Scenes that don't publish a moving subject keep the rig in world space.
    story.anchor.x = story.anchor.y = story.anchor.z = 0
  }, [current])

  return (
    <>
      {keys.map((k) => (
        <Slot key={k} id={k} active={k === current} />
      ))}
    </>
  )
}
