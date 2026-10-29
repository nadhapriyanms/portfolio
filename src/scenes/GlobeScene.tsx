import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Atmosphere, useActiveRef } from '../world/SceneContext'
import { Globe } from '../world/props/Globe'
import { SkyDome } from '../world/props/environment'
import { story, useStore } from '../state/store'
import { range, rng, smooth } from '../utils/canvasTexture'

/**
 * Chapter 01 — a floating illustrated planet. Scroll turns it and dives to the pole;
 * visitors can also grab it and spin it (with inertia) while the hero is on screen.
 */
export default function GlobeScene() {
  const spin = useRef(0)
  const tilt = useRef<THREE.Group>(null)
  const active = useActiveRef()
  const reduced = useStore((s) => s.reducedMotion)
  const drag = useRef({ down: false, x: 0, y: 0, yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 })

  const stars = useMemo(() => {
    const r = rng(4)
    const pts = new Float32Array(900 * 3)
    for (let i = 0; i < 900; i++) {
      const u = r() * 2 - 1
      const a = r() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      pts.set([Math.cos(a) * s * 160, Math.abs(u) * 140 - 20, Math.sin(a) * s * 160], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    return g
  }, [])

  // Pointer drag is tracked on the window so a fast flick keeps working off the sphere.
  useEffect(() => {
    const d = drag.current
    const move = (e: PointerEvent) => {
      if (!d.down) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.x = e.clientX
      d.y = e.clientY
      d.vYaw = dx * 0.006
      d.vPitch = dy * 0.004
      d.yaw += d.vYaw
      d.pitch = THREE.MathUtils.clamp(d.pitch + d.vPitch, -0.5, 0.5)
    }
    const up = () => {
      if (!d.down) return
      d.down = false
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (story.chapter !== 0 || story.local > 0.45) return
    e.stopPropagation()
    const d = drag.current
    d.down = true
    d.x = e.clientX
    d.y = e.clientY
    d.vYaw = d.vPitch = 0
    document.body.style.cursor = 'grabbing'
  }

  useFrame((state, dt) => {
    if (!active.current) return
    const d = drag.current
    if (!d.down) {
      // inertia, then a gentle return to upright
      const k = Math.exp(-dt * 2.2)
      d.vYaw *= k
      d.yaw += d.vYaw
      d.pitch *= Math.exp(-dt * 1.5)
    }
    // The dive to the pole needs the planet upright again.
    const settle = 1 - smooth(range(story.local, 0.3, 0.55))
    const idle = reduced ? 0 : state.clock.elapsedTime * 0.04
    spin.current = (story.chapter === 0 ? story.local * Math.PI * 1.1 : 0) + d.yaw * settle + idle * settle
    if (tilt.current) tilt.current.rotation.x = d.pitch * settle
  })

  return (
    <>
      <SkyDome colors={{ top: '#1c1f3a', horizon: '#c98a74', bottom: '#191827' }} clouds={0.18} cloudColor="#f2c9b0" />
      <Atmosphere fog={['#1c1f3a', 380, 1000]} shadowTint="#6d6aa8" rim="#ffc9a8" rimStrength={0.32} />
      <points geometry={stars}>
        <pointsMaterial color="#f6ead2" size={1.6} sizeAttenuation={false} transparent opacity={0.85} />
      </points>
      <hemisphereLight args={['#bcd3e6', '#3a2f45', 0.9]} />
      <directionalLight position={[6, 5, 4]} intensity={2.4} color="#ffd9b0" />
      <directionalLight position={[-6, -2, -3]} intensity={0.6} color="#7f8cc9" />
      <group ref={tilt}>
        <Globe radius={2} spinRef={spin} autoSpin={false} />
      </group>
      {/* invisible grab handle around the planet */}
      <mesh
        onPointerDown={onDown}
        onPointerOver={() => {
          if (story.chapter === 0 && story.local < 0.45 && !drag.current.down) document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          if (!drag.current.down) document.body.style.cursor = ''
        }}
      >
        <sphereGeometry args={[2.6, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </>
  )
}
