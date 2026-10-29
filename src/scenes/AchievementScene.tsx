import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { SkyDome } from '../world/props/environment'
import { Drones, glyphs, samplePolylines } from '../world/props/Drones'
import { Tubes } from '../world/kit/Tubes'
import { achievements } from '../content/achievements'
import { chapterIndexById } from '../content/chapters'
import { localTime, story, useStore } from '../state/store'
import { focusCamera, releaseCamera } from '../world/cameraOverride'
import { range, rng } from '../utils/canvasTexture'
import { palette } from '../utils/materials'
import { Atmosphere, useActiveRef, useSceneActive } from '../world/SceneContext'
import { ambient } from '../audio/ambient'

const CH = chapterIndexById('achievement-constellation')
const CENTER = new THREE.Vector3(0, 40, 0)
const RADIUS = 58
const SCALE = 9
/** Local time from which the visitor can look around the full sky. */
const LOOK_FROM = 0.3

export interface SkyNode {
  id: string
  badge: string
  title: string
  kind: string
  glyph: keyof typeof glyphs
  color: string
  az: number
  el: number
}

const kindColor: Record<string, string> = {
  win: '#ffd36b',
  finalist: palette.cyan,
  'runner-up': '#c58bff',
  'patent-filed': '#7cf2c9',
  leadership: '#ff9b6a',
  learning: '#9fc8ff',
}

const glyphFor: Record<string, keyof typeof glyphs> = {
  bcdc: 'cycle',
  sih: 'document',
  'design-patent': 'chip',
  'utility-patent': 'circuit',
  idex: 'probe',
  'clux-founder': 'network',
  learning: 'book',
}

/** Achievements plus a "learning" constellation for certifications, spread around the whole sky. */
export const skyNodes: SkyNode[] = [
  ...achievements.map((a) => ({ id: a.id, badge: a.badge, title: a.title, kind: a.kind, glyph: glyphFor[a.id], color: kindColor[a.kind] })),
  { id: 'learning', badge: 'Certifications', title: 'Always learning', kind: 'learning', glyph: 'book' as const, color: kindColor.learning },
].map((n, i, all) => ({ ...n, az: (i / all.length) * Math.PI * 2, el: i % 2 ? 0.36 : 0.18 }))

const dirOf = (az: number, el: number) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))

/** Plane basis for a constellation so it faces the viewer at the centre, upright. */
function frame(n: SkyNode) {
  const dir = dirOf(n.az, n.el)
  const pos = CENTER.clone().addScaledVector(dir, RADIUS)
  const normal = dir.clone().negate()
  const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize()
  const up = normal.clone().cross(right).normalize()
  const map = (x: number, y: number) => pos.clone().addScaledVector(right, x * SCALE).addScaledVector(up, y * SCALE)
  return { dir, pos, right, up, map }
}

function Constellation({ node }: { node: SkyNode }) {
  const selected = useStore((s) => s.achievementId === node.id)
  const select = useStore((s) => s.setAchievement)
  const f = useMemo(() => frame(node), [node])
  const paths = useMemo(() => glyphs[node.glyph].map((line) => line.map(([x, y]) => f.map(x, y))), [node, f])
  const stars = useMemo(() => {
    const pts: THREE.Vector3[] = []
    glyphs[node.glyph].forEach((line) => line.forEach(([x, y], i) => i % 2 === 0 && pts.push(f.map(x, y))))
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    return g
  }, [node, f])
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), [node.color])
  const starMat = useMemo(() => new THREE.PointsMaterial({ color: node.color, size: 7, sizeAttenuation: false, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), [node.color])
  const card = useRef<HTMLButtonElement>(null)
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const toNode = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    const show = range(localTime(CH), 0.22, 0.4)
    lineMat.opacity = show * (selected ? 1 : 0.55)
    starMat.opacity = show
    starMat.size = selected ? 10 : 7
    if (card.current) {
      // the DOM card must vanish outside this chapter (the scene stays mounted while hidden)
      // only cards in front of the viewer: an HTML overlay would otherwise be projected
      // "through" the camera for constellations behind you
      camera.getWorldDirection(camDir)
      const facing = toNode.copy(f.pos).sub(camera.position).normalize().dot(camDir)
      const inView = THREE.MathUtils.smoothstep(facing, 0.25, 0.5)
      const here = story.chapter === CH
      const o = here ? show * inView : 0
      card.current.style.opacity = String(o)
      card.current.style.visibility = o > 0.02 ? 'visible' : 'hidden'
    }
  })

  const choose = (e?: ThreeEvent<MouseEvent> | React.MouseEvent) => {
    e?.stopPropagation()
    ambient.blip(990)
    // always select (idempotent): a click can reach both the card and the 3D hit area
    select(node.id)
  }

  const cardPos = f.map(0, -1.35)
  return (
    <group>
      <Tubes paths={paths} radius={selected ? 0.16 : 0.1} material={lineMat} />
      <points geometry={stars} material={starMat} />
      {/* generous invisible hit area so the constellation itself is clickable */}
      <mesh position={f.pos} onClick={choose} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <sphereGeometry args={[SCALE * 1.1, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <Html position={cardPos} center zIndexRange={[30, 0]} style={{ pointerEvents: 'auto' }}>
        <button
          ref={card}
          className={`sky-card sky-card--${node.kind} ${selected ? 'is-active' : ''}`}
          style={{ '--accent': node.color } as React.CSSProperties}
          onClick={choose}
          tabIndex={-1}
        >
          <span className="sky-card__badge">{node.badge}</span>
          <span className="sky-card__title">{node.title}</span>
        </button>
      </Html>
    </group>
  )
}

/**
 * The visitor stands in the middle of the night sky: drag to look around 360°, select a
 * constellation (or its name card) to turn toward it and read the details.
 */
function SkyLook() {
  const active = useSceneActive()
  const activeRef = useActiveRef()
  const reduced = useStore((s) => s.reducedMotion)
  const gl = useThree((s) => s.gl)
  const look = useRef({ yaw: 0, pitch: 0.22, vYaw: 0, down: false, x: 0, y: 0, holding: false })
  const target = useMemo(() => ({ pos: CENTER.clone(), at: new THREE.Vector3() }), [])

  useEffect(() => {
    const L = look.current
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      if (!activeRef.current || localTime(CH) < LOOK_FROM) return
      L.down = true
      L.x = e.clientX
      L.y = e.clientY
      L.vYaw = 0
      document.body.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!L.down) return
      const dx = e.clientX - L.x
      const dy = e.clientY - L.y
      L.x = e.clientX
      L.y = e.clientY
      L.vYaw = -dx * 0.0045
      L.yaw += L.vYaw
      L.pitch = THREE.MathUtils.clamp(L.pitch + dy * 0.003, -0.15, 0.95)
    }
    const up = () => {
      if (!L.down) return
      L.down = false
      document.body.style.cursor = ''
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl, activeRef])

  // Leaving the chapter hands the camera back and clears the selection.
  useEffect(() => {
    if (active) return
    if (look.current.holding) releaseCamera()
    look.current.holding = false
    if (useStore.getState().achievementId) useStore.getState().setAchievement(null)
  }, [active])

  useFrame((_, dt) => {
    if (!activeRef.current) return
    const L = look.current
    const u = localTime(CH)
    if (u < LOOK_FROM) {
      if (L.holding) releaseCamera()
      L.holding = false
      L.yaw = 0
      L.pitch = 0.22
      return
    }
    const sel = skyNodes.find((n) => n.id === useStore.getState().achievementId)
    if (sel && !L.down) {
      // turn toward the chosen constellation along the shortest way round
      let d = sel.az - L.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      const k = 1 - Math.exp(-dt * (reduced ? 20 : 3))
      L.yaw += d * k
      L.pitch += (sel.el - L.pitch) * k
      L.vYaw = 0
    } else if (!L.down) {
      L.vYaw *= Math.exp(-dt * 2.5)
      // no idle drift: name cards must stay put so they are easy to click
      L.yaw += L.vYaw
    }
    target.at.copy(CENTER).addScaledVector(dirOf(L.yaw, L.pitch), 20)
    focusCamera(target.pos, target.at, 58)
    L.holding = true
  })
  return null
}

/** Chapter 09 — the city lights lift into a drone-drawn sky of milestones you can look around. */
export default function AchievementScene() {
  const quality = useStore((s) => s.quality)
  const progress = useRef(0)

  const cityLights = useMemo(() => {
    const r = rng(14)
    const n = quality === 'low' ? 900 : 2400
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const rad = Math.sqrt(r()) * 150
      const a = r() * Math.PI * 2
      pos.set([Math.cos(a) * rad, 0, Math.sin(a) * rad], i * 3)
      c.set(r() < 0.5 ? '#ffcf8a' : r() < 0.5 ? palette.cyan : palette.magenta)
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [quality])

  // background stars on a full sphere around the viewer
  const stars = useMemo(() => {
    const r = rng(8)
    const n = 1600
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = r() * 1.6 - 0.45
      const a = r() * Math.PI * 2
      const s = Math.sqrt(Math.max(0, 1 - u * u))
      pos.set([Math.cos(a) * s * 200, CENTER.y + u * 200, Math.sin(a) * s * 200], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  // Drones rise from the city (formation 0) and become the constellations' strokes (formation 1).
  const formations = useMemo(() => {
    const per = quality === 'low' ? 26 : 46
    const target = new Float32Array(per * skyNodes.length * 3)
    skyNodes.forEach((n, i) => {
      const f = frame(n)
      samplePolylines(glyphs[n.glyph], per).forEach(([x, y], j) => target.set(f.map(x, y).toArray(), (i * per + j) * 3))
    })
    const r = rng(3)
    const start = new Float32Array(target.length)
    for (let i = 0; i < start.length / 3; i++) start.set([(r() - 0.5) * 140, 0.5, (r() - 0.5) * 140], i * 3)
    return [start, target]
  }, [quality])

  useFrame(() => {
    progress.current = range(localTime(CH), 0.06, 0.32)
  })

  return (
    <>
      <SkyDome colors={{ top: '#04051a', horizon: '#26134d', bottom: '#0b0e2a' }} />
      <Atmosphere fog={['#04051a', 380, 1000]} shadowTint="#3a2f7a" rim="#2de2e6" rimStrength={0.4} />
      <SkyLook />
      <points geometry={stars}>
        <pointsMaterial color="#e9e4ff" size={1.6} sizeAttenuation={false} />
      </points>
      <points geometry={cityLights}>
        <pointsMaterial vertexColors size={2.2} sizeAttenuation={false} toneMapped={false} />
      </points>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <circleGeometry args={[170, 48]} />
        <meshBasicMaterial color="#080a20" />
      </mesh>
      <Drones formations={formations} driver={() => ({ a: 0, b: 1, k: progress.current })} color="#f3e9d7" size={quality === 'low' ? 2.5 : 3} />
      {skyNodes.map((n) => (
        <Constellation key={n.id} node={n} />
      ))}
    </>
  )
}
