import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Kit } from './Kit'
import { makeCel, toonRamp } from '../../utils/materials'
import { rng } from '../../utils/canvasTexture'

export interface TowerSpec {
  w: number
  d: number
  floors: number
  style: 'apartment' | 'office' | 'mixed'
  seed: number
}

const FH = 3.1

/** Merged geometry for a tower. Front faces +Z, ground at y = 0. */
export function buildTower(spec: TowerSpec) {
  const r = rng(spec.seed)
  const k = new Kit()
  const { w, d, floors } = spec
  const setbackAt = floors > 8 && r() < 0.6 ? Math.floor(floors * 0.7) : floors
  const fz = d / 2

  // storefront level
  k.box('wallDark', w, 3.6, d, 0, 1.8, 0)
  k.box('winDark', w - 0.8, 2.4, 0.1, 0, 1.35, fz + 0.01)
  k.box('sign', w - 0.6, 0.6, 0.12, 0, 2.95, fz + 0.12)
  k.box('metal', w - 0.2, 0.08, 1.2, 0, 3.35, fz + 0.55, 0, 0.12)

  const body = (bw: number, bd: number, from: number, to: number) => {
    const y0 = 3.6 + from * FH
    const h = (to - from) * FH
    k.box('wall', bw, h, bd, 0, y0 + h / 2, 0)
    const bz = bd / 2
    const cols = Math.max(2, Math.round(bw / 1.8))
    const cw = bw / cols
    for (let f = from; f < to; f++) {
      const y = 3.6 + f * FH + 1.5
      k.box('band', bw + 0.06, 0.18, bd + 0.06, 0, 3.6 + f * FH + 0.09, 0)
      if (spec.style === 'office') {
        // ribbon glazing with mullions
        k.box(r() < 0.55 ? 'winLit' : 'winDark', bw - 0.3, 1.7, 0.06, 0, y, bz + 0.02)
        for (let c = 0; c <= cols; c++) k.box('metal', 0.08, 1.75, 0.1, -bw / 2 + 0.15 + c * ((bw - 0.3) / cols), y, bz + 0.05)
      } else {
        for (let c = 0; c < cols; c++) {
          const x = -bw / 2 + cw * (c + 0.5)
          const ww = cw * 0.55
          k.box(r() < 0.45 ? 'winLit' : 'winDark', ww, 1.35, 0.05, x, y, bz + 0.02)
          k.box('frame', ww + 0.14, 0.08, 0.12, x, y + 0.72, bz + 0.05)
          k.box('frame', ww + 0.2, 0.08, 0.18, x, y - 0.72, bz + 0.08)
          k.box('frame', 0.05, 1.35, 0.08, x, y, bz + 0.05)
          if (spec.style === 'apartment' && r() < 0.35) {
            // hanging AC unit
            k.box('metal', 0.7, 0.5, 0.28, x + cw * 0.3, y - 1.05, bz + 0.18)
            k.cyl('dark', 0.16, 0.16, 0.02, x + cw * 0.3 - 0.1, y - 1.05, bz + 0.33, Math.PI / 2, 0, 0, 12)
          }
        }
        if (spec.style === 'apartment' && f % 2 === 1) {
          k.box('band', bw * 0.9, 0.12, 0.8, 0, y - 1.35, bz + 0.4)
          k.box('rail', bw * 0.9, 0.05, 0.05, 0, y - 0.45, bz + 0.78)
          for (let x = -bw * 0.45; x <= bw * 0.45; x += 0.3) k.box('rail', 0.03, 0.9, 0.03, x, y - 0.9, bz + 0.78)
        }
      }
      // side windows
      for (const sx of [-1, 1]) {
        const sc = Math.max(1, Math.round(bd / 2.4))
        for (let c = 0; c < sc; c++) {
          const z = -bd / 2 + (bd / sc) * (c + 0.5)
          k.box(r() < 0.4 ? 'winLit' : 'winDark', 0.05, 1.3, (bd / sc) * 0.5, sx * (bw / 2 + 0.02), y, z)
        }
      }
    }
    // cornice
    k.box('band', bw + 0.3, 0.35, bd + 0.3, 0, y0 + h + 0.17, 0)
    // vertical duct on one side
    k.box('metal', 0.4, h, 0.4, bw / 2 + 0.22, y0 + h / 2, -bd / 4)
  }

  body(w, d, 0, setbackAt)
  let topW = w
  let topD = d
  if (setbackAt < floors) {
    topW = w * 0.68
    topD = d * 0.72
    body(topW, topD, setbackAt, floors)
  }
  const roofY = 3.6 + floors * FH + 0.35

  // fire escape zig-zag on the left flank
  if (r() < 0.6) {
    for (let f = 1; f < Math.min(setbackAt, 9); f++) {
      const y = 3.6 + f * FH
      k.box('rail', 0.9, 0.06, 2.4, -w / 2 - 0.5, y, 0)
      k.box('rail', 0.04, 0.9, 2.4, -w / 2 - 0.95, y + 0.45, 0)
      k.beam('rail', [-w / 2 - 0.5, y, f % 2 ? -1.1 : 1.1], [-w / 2 - 0.5, y + FH, f % 2 ? 1.1 : -1.1], 0.06)
    }
  }

  // rooftop clutter
  k.cyl('metal', 0.9, 0.9, 1.6, -topW / 4, roofY + 1.6, -topD / 5, 0, 0, 0, 12)
  k.cyl('dark', 0.95, 0.95, 0.1, -topW / 4, roofY + 2.45, -topD / 5, 0, 0, 0, 12)
  for (const lx of [-0.6, 0.6]) k.box('rail', 0.1, 0.8, 0.1, -topW / 4 + lx, roofY + 0.4, -topD / 5)
  for (let i = 0; i < 3; i++) k.box('metal', 0.9, 0.6, 0.7, topW / 5 + i * 1.0 - 1, roofY + 0.3, topD / 4)
  k.beam('rail', [topW / 3, roofY, -topD / 3], [topW / 3, roofY + 4 + r() * 3, -topD / 3], 0.08, true)
  if (r() < 0.5) {
    // empty billboard scaffold — signs are added per scene
    for (const x of [-topW / 3, topW / 3]) k.beam('rail', [x, roofY, topD / 2 - 0.3], [x, roofY + 3, topD / 2 - 0.3], 0.12)
    k.box('rail', topW * 0.8, 0.1, 0.1, 0, roofY + 1.6, topD / 2 - 0.3)
  }
  return k.build({ seed: spec.seed, grime: 4, grimeAmount: 0.25, jitter: 0.05 })
}

export const towerHeight = (s: TowerSpec) => 3.6 + s.floors * FH + 0.35

/** Eight reusable tower archetypes; every street instances these. */
export const archetypes: TowerSpec[] = [
  { w: 7, d: 7, floors: 6, style: 'apartment', seed: 11 },
  { w: 6, d: 6, floors: 10, style: 'apartment', seed: 12 },
  { w: 9, d: 8, floors: 5, style: 'mixed', seed: 13 },
  { w: 6, d: 7, floors: 14, style: 'office', seed: 14 },
  { w: 8, d: 7, floors: 8, style: 'mixed', seed: 15 },
  { w: 5, d: 6, floors: 7, style: 'apartment', seed: 16 },
  { w: 7.5, d: 7, floors: 18, style: 'office', seed: 17 },
  { w: 6.5, d: 6, floors: 4, style: 'mixed', seed: 18 },
]

export interface TowerMaterials {
  wall: THREE.MeshToonMaterial
  wallDark: THREE.MeshToonMaterial
  band: THREE.MeshToonMaterial
  frame: THREE.MeshToonMaterial
  metal: THREE.MeshToonMaterial
  rail: THREE.MeshToonMaterial
  dark: THREE.MeshToonMaterial
  winDark: THREE.MeshToonMaterial
  winLit: THREE.MeshBasicMaterial
  sign: THREE.MeshBasicMaterial
}

/** Owned (animatable) materials for one scene's towers. */
export function useTowerMaterials(): TowerMaterials {
  return useMemo(() => {
    const cel = (color: string) => makeCel(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, vertexColors: true }))
    return {
      wall: cel('#ffffff'),
      wallDark: cel('#6a6470'),
      band: cel('#d8d0c4'),
      frame: cel('#e8e2d6'),
      metal: cel('#9ba0a6'),
      rail: cel('#3c3f48'),
      dark: cel('#2a2830'),
      winDark: cel('#3e5466'),
      winLit: new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }),
      sign: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    }
  }, [])
}

export interface TowerPlacement {
  archetype: number
  x: number
  z: number
  rot: number
  wall: string
  glow?: string
}

/** Instanced detailed towers: one InstancedMesh per archetype × material slot. */
export function TowerField({ items, mats }: { items: TowerPlacement[]; mats: TowerMaterials }) {
  const groups = useMemo(() => archetypes.map((_, a) => items.filter((i) => i.archetype === a)), [items])
  return (
    <group>
      {groups.map((list, a) => (list.length ? <ArchetypeInstances key={a} spec={archetypes[a]} items={list} mats={mats} /> : null))}
    </group>
  )
}

const geoCache = new Map<number, Record<string, THREE.BufferGeometry>>()

function ArchetypeInstances({ spec, items, mats }: { spec: TowerSpec; items: TowerPlacement[]; mats: TowerMaterials }) {
  const geos = useMemo(() => {
    const hit = geoCache.get(spec.seed)
    if (hit) return hit
    const g = buildTower(spec)
    geoCache.set(spec.seed, g)
    return g
  }, [spec])
  return (
    <group>
      {Object.entries(geos).map(([slot, g]) => (
        <SlotInstances key={slot} slot={slot} geometry={g} material={(mats as unknown as Record<string, THREE.Material>)[slot] ?? mats.wall} items={items} />
      ))}
    </group>
  )
}

const signColors = ['#ff3caa', '#2de2e6', '#ffd23f', '#7cf2c9', '#ff8a4c']

function SlotInstances({ slot, geometry, material, items }: { slot: string; geometry: THREE.BufferGeometry; material: THREE.Material; items: TowerPlacement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const col = new THREE.Color()
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot)
      mat.compose(new THREE.Vector3(it.x, 0, it.z), q, new THREE.Vector3(1, 1, 1))
      m.setMatrixAt(i, mat)
      if (slot === 'wall') m.setColorAt(i, col.set(it.wall))
      else if (slot === 'winLit') m.setColorAt(i, col.set(it.glow ?? '#ffffff'))
      else if (slot === 'sign') m.setColorAt(i, col.set(signColors[i % signColors.length]))
      else m.setColorAt(i, col.set('#ffffff'))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, slot])
  const shadows = slot === 'wall' || slot === 'wallDark'
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow={shadows} frustumCulled={false} />
}

/** Lays detailed towers along both sides of a street that runs down -Z, fronts facing the road. */
export function streetTowers(seed: number, zFrom: number, zTo: number, setback: number, walls: string[], glows: string[]): TowerPlacement[] {
  const r = rng(seed)
  const out: TowerPlacement[] = []
  for (const side of [-1, 1]) {
    let z = zFrom
    while (z > zTo) {
      const a = Math.floor(r() * archetypes.length)
      const spec = archetypes[a]
      z -= spec.w / 2 + 0.4
      out.push({
        archetype: a,
        x: side * (setback + spec.d / 2 + r() * 0.8),
        z,
        rot: side < 0 ? Math.PI / 2 : -Math.PI / 2,
        wall: walls[Math.floor(r() * walls.length)],
        glow: glows[Math.floor(r() * glows.length)],
      })
      z -= spec.w / 2 + 0.4 + r() * 1.2
    }
  }
  return out
}
