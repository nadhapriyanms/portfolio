import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { SceneManager } from './SceneManager'
import { CameraDirector } from './CameraDirector'
import { PostFX } from './PostFX'

export function hasWebGL() {
  // `?nowebgl` previews the designed fallback (QA switch).
  if (new URLSearchParams(location.search).has('nowebgl')) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

class WebGLBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('[world] 3D layer disabled:', err)
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

/** Fixed, decorative 3D layer behind the story. All content also exists as HTML. */
export function WorldCanvas() {
  const quality = useStore((s) => s.quality)
  const setWebgl = useStore((s) => s.setWebgl)
  const inspecting = useStore((s) => s.inspectingCycle)
  const visible = usePageVisible()
  // Adaptive resolution: drops the pixel ratio when frames slip, restores it when there is headroom.
  const [scale, setScale] = useState(1)
  const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const maxDpr = quality === 'high' ? Math.min(2, Math.max(1.5, native)) : quality === 'balanced' ? Math.min(1.5, Math.max(1, native)) : Math.min(1.5, native)
  const minDpr = quality === 'low' ? 0.8 : 1
  // stable identity: a fresh array every render would make R3F resize the renderer
  const dpr = useMemo<[number, number]>(() => [minDpr, Math.max(minDpr, maxDpr * scale)], [minDpr, maxDpr, scale])
  const gl = useMemo(() => ({ antialias: false, powerPreference: 'high-performance' as const, alpha: false, stencil: false }), [])
  const camera = useMemo(() => ({ fov: 40, near: 0.1, far: 400, position: [0, 0.6, 9] as [number, number, number] }), [])
  const shadows = useMemo(() => (quality === 'low' ? false : { type: THREE.PCFShadowMap }), [quality])

  return (
    <div className="world-canvas" aria-hidden="true">
      <WebGLBoundary onFail={() => setWebgl('failed')}>
        <Canvas
          dpr={dpr}
          flat
          shadows={shadows}
          frameloop={visible && !inspecting ? 'always' : 'never'}
          gl={gl}
          camera={camera}
          onCreated={({ gl }) => {
            gl.setClearColor('#1d1a24')
            const canvas = gl.domElement
            canvas.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              // Ignore the loss that accompanies an intentional unmount; give the GPU a moment to restore.
              const restored = { value: false }
              canvas.addEventListener('webglcontextrestored', () => (restored.value = true), { once: true })
              window.setTimeout(() => {
                if (canvas.isConnected && !restored.value) setWebgl('failed')
              }, 1500)
            })
            setWebgl('ok')
          }}
        >
          {/* Only sustained slowness lowers resolution (one-off hitches such as a scene build don't),
              and headroom restores it quickly so the image never stays soft. */}
          <PerformanceMonitor
            ms={500}
            iterations={8}
            threshold={0.8}
            bounds={(refresh) => [Math.min(50, refresh * 0.8), Math.min(refresh, 75)]}
            flipflops={6}
            onDecline={() => setScale((v) => Math.max(0.7, v - 0.1))}
            onIncline={() => setScale((v) => Math.min(1, v + 0.2))}
            onFallback={() => setScale(0.75)}
          />
          <SceneManager />
          <CameraDirector />
          {!(import.meta.env.DEV && location.search.includes('nofx')) && <PostFX />}
        </Canvas>
      </WebGLBoundary>
    </div>
  )
}
