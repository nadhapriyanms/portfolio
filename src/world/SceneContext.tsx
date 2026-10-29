import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { celUniforms } from '../utils/materials'

/**
 * Each environment is mounted inside a slot; neighbouring chapters' slots are mounted early
 * (hidden) so they are built and compiled before the visitor arrives. Only the active slot
 * may touch global state (camera anchor, fog, focus shots).
 *
 * The flag is a stable mutable handle rather than a context value, so activating a scene
 * doesn't re-render its whole tree — only the few components that subscribe.
 */
export interface ActiveHandle {
  current: boolean
  listeners: Set<() => void>
}

export const SceneActiveContext = createContext<ActiveHandle>({ current: true, listeners: new Set() })

export function createActiveHandle(active: boolean): ActiveHandle {
  return { current: active, listeners: new Set() }
}

/** Ref-style access for useFrame: `if (!active.current) return`. */
export function useActiveRef() {
  return useContext(SceneActiveContext)
}

/** Re-renders the calling component when its scene becomes active or inactive. */
export function useSceneActive() {
  const handle = useContext(SceneActiveContext)
  const [active, setActive] = useState(handle.current)
  useEffect(() => {
    const update = () => setActive(handle.current)
    handle.listeners.add(update)
    update()
    return () => {
      handle.listeners.delete(update)
    }
  }, [handle])
  return active
}

export interface AtmosphereProps {
  background?: string
  fog?: [string, number, number]
  shadowTint?: string
  rim?: string
  rimStrength?: number
  fogRef?: React.MutableRefObject<THREE.Fog | null>
}

/** Per-scene fog, background and cel lighting mood — applied only while the scene is active. */
export function Atmosphere({ background, fog, shadowTint = '#8f9cc4', rim = '#ffe6c8', rimStrength = 0.18, fogRef }: AtmosphereProps) {
  const active = useSceneActive()
  const scene = useThree((s) => s.scene)
  const fogObj = useMemo(() => (fog ? new THREE.Fog(fog[0], fog[1], fog[2]) : null), [fog?.[0], fog?.[1], fog?.[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  if (fogRef) fogRef.current = fogObj

  useEffect(() => {
    if (!active) return
    scene.fog = fogObj
    scene.background = background ? new THREE.Color(background) : null
    celUniforms.uShadowTint.value.set(shadowTint)
    celUniforms.uRimColor.value.set(rim)
    celUniforms.uRimStrength.value = rimStrength
  }, [active, scene, fogObj, background, shadowTint, rim, rimStrength])

  return null
}
