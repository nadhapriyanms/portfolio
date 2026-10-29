import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { story, useStore } from '../state/store'
import { cameraOverride } from './cameraOverride'
import { portraitFovBoost } from '../animation/cameraShots'

/**
 * Applies the GSAP-driven rig to the camera every frame. Adds the anchor offset
 * (moving subjects), blends in interactive focus shots, and layers a light
 * handheld drift and pointer parallax when motion is allowed.
 */
export function CameraDirector() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const reduced = useStore((s) => s.reducedMotion)
  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
      parallax: new THREE.Vector2(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  )

  useFrame((state, dt) => {
    if (import.meta.env.DEV) {
      const w = window as unknown as { __frames?: number; __scene?: unknown }
      w.__frames = (w.__frames ?? 0) + 1
      w.__scene = state.scene
    }
    const r = story.rig
    const a = story.anchor
    const { pos, target, parallax, right, up } = tmp

    pos.set(a.x + r.px, a.y + r.py, a.z + r.pz)
    target.set(a.x + r.tx, a.y + r.ty, a.z + r.tz)
    let fov = r.fov

    // Interactive focus shots ease in/out independently of scroll.
    const goal = cameraOverride.active ? 1 : 0
    const k = 1 - Math.exp(-dt * (reduced ? 30 : 3.2))
    cameraOverride.weight += (goal - cameraOverride.weight) * k
    const w = cameraOverride.weight
    const ws = w * w * (3 - 2 * w)
    if (ws > 0.0005) {
      pos.lerp(cameraOverride.pos, ws)
      target.lerp(cameraOverride.target, ws)
      fov += (cameraOverride.fov - fov) * ws
    }

    if (!reduced) {
      const t = state.clock.elapsedTime
      parallax.lerp(state.pointer, 1 - Math.exp(-dt * 2))
      right.subVectors(target, pos).cross(up).normalize()
      const amp = 0.12 * (1 - ws)
      pos.addScaledVector(right, parallax.x * amp + Math.sin(t * 0.31) * 0.02)
      pos.y += parallax.y * amp * 0.5 + Math.sin(t * 0.43) * 0.015
    }

    const aspect = state.size.width / state.size.height
    if (aspect < 0.8) fov += portraitFovBoost * Math.min(1, (0.8 - aspect) / 0.35)

    camera.position.copy(pos)
    camera.lookAt(target)
    if (r.roll) camera.rotateZ(r.roll)
    // Framing shift slides the image sideways (keeps perspective), so a subject can sit beside
    // the HTML text at any aspect ratio. Portrait screens stack text and subject instead.
    const shift = aspect < 0.9 ? 0 : r.sx * (1 - ws)
    const W = state.size.width
    const H = state.size.height
    const offsetChanged = Math.abs((camera.view?.offsetX ?? 0) + shift * W) > 0.5 || (shift === 0 && camera.view?.enabled)
    if (Math.abs(camera.fov - fov) > 0.01 || offsetChanged) {
      camera.fov = fov
      if (Math.abs(shift) > 0.0005) camera.setViewOffset(W, H, -shift * W, 0, W, H)
      else camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, -1)

  return null
}
