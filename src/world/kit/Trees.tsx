import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Kit } from './Kit'
import { toon } from '../../utils/materials'
import { rng } from '../../utils/canvasTexture'

export type TreeKind = 'broad' | 'blossom' | 'shrub' | 'palm'

/** Lumpy foliage blob: an icosphere pushed around by layered sine noise. */
function foliageBlob(radius: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(radius, 2)
  const p = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n =
      Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed * 0.5) * 0.12 +
      Math.sin(v.z * 4.3 + v.y * 1.7 + seed * 2.1) * 0.08 +
      Math.sin(v.x * 9.0 + v.z * 7.0) * 0.035
    v.multiplyScalar(1 + n)
    v.y *= 0.82
    p.setXYZ(i, v.x, v.y, v.z)
  }
  // weld the icosphere so the blob shades smoothly instead of faceted
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const welded = mergeVertices(g)
  g.dispose()
  welded.computeVertexNormals()
  return welded
}

const cache = new Map<string, Record<string, THREE.BufferGeometry>>()

/** Builds (and caches) a tree: bent tapered trunk, branches, clustered two-tone foliage. */
export function treeGeometry(kind: TreeKind, seed: number) {
  const key = `${kind}-${seed}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(seed)
  const k = new Kit()
  if (kind === 'palm') {
    let x = 0
    let z = 0
    for (let i = 0; i < 8; i++) {
      const nx = x + 0.06 + r() * 0.04
      k.beam('trunk', [x, i * 0.7, z], [nx, (i + 1) * 0.7, z], 0.26 - i * 0.015, true)
      k.cyl('trunkDark', 0.15, 0.15, 0.05, nx, (i + 1) * 0.7, z, 0, 0, 0, 8)
      x = nx
      void (z = z)
    }
    const top = new THREE.Vector3(x, 5.6, z)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const g = new THREE.ConeGeometry(0.35, 2.6, 4, 1)
      g.rotateZ(Math.PI / 2)
      g.scale(1, 0.15, 1)
      k.add(i % 2 ? 'leaf' : 'leaf2', g, top.x + Math.cos(a) * 1.2, top.y - 0.35, top.z + Math.sin(a) * 1.2, 0, -a, -0.45)
    }
  } else {
    const h = kind === 'shrub' ? 0.5 : 2.2 + r() * 0.8
    const lean = (r() - 0.5) * 0.3
    const segs = 4
    let prev: THREE.Vector3Tuple = [0, 0, 0]
    for (let i = 1; i <= segs; i++) {
      const t = i / segs
      const p: THREE.Vector3Tuple = [lean * t * t + Math.sin(t * 3 + seed) * 0.08, h * t, Math.cos(t * 2 + seed) * 0.06]
      k.beam('trunk', prev, p, (kind === 'shrub' ? 0.12 : 0.3) * (1 - t * 0.45), true)
      prev = p
    }
    const crown = new THREE.Vector3(...prev)
    const branches = kind === 'shrub' ? 0 : 3 + Math.floor(r() * 3)
    const ends: THREE.Vector3[] = [crown.clone().add(new THREE.Vector3(0, 0.9, 0))]
    for (let i = 0; i < branches; i++) {
      const a = (i / branches) * Math.PI * 2 + r()
      const start = crown.clone().add(new THREE.Vector3(0, -0.4 - r() * 0.6, 0))
      const end = start.clone().add(new THREE.Vector3(Math.cos(a) * (1 + r() * 0.6), 0.8 + r() * 0.8, Math.sin(a) * (1 + r() * 0.6)))
      k.beam('trunk', start.toArray(), end.toArray(), 0.12, true)
      ends.push(end)
    }
    const blobR = kind === 'shrub' ? 0.7 : kind === 'blossom' ? 1.05 : 1.15
    ends.forEach((e, i) => {
      const s = 0.8 + r() * 0.5
      k.add(i === 0 ? 'leaf2' : 'leaf', foliageBlob(blobR * s, seed + i * 7.3), e.x, e.y, e.z)
      // a few lighter "sunlit" clumps on top of each cluster
      if (kind !== 'shrub') k.add('leafHi', foliageBlob(blobR * s * 0.55, seed + i * 3.1), e.x + 0.2, e.y + blobR * s * 0.55, e.z + 0.15)
    })
  }
  const built = k.build({ seed, grime: 0.8, grimeAmount: 0.15, jitter: 0.08 })
  cache.set(key, built)
  return built
}

const palettes: Record<TreeKind, Record<string, string>> = {
  broad: { trunk: '#5e4636', trunkDark: '#4a372b', leaf: '#5f8a4e', leaf2: '#4c7442', leafHi: '#86ad62' },
  blossom: { trunk: '#5e4636', trunkDark: '#4a372b', leaf: '#e3a1b0', leaf2: '#cf8698', leafHi: '#f4c6cf' },
  shrub: { trunk: '#5e4636', trunkDark: '#4a372b', leaf: '#577f47', leaf2: '#45693b', leafHi: '#7aa25a' },
  palm: { trunk: '#7b6450', trunkDark: '#5e4b3b', leaf: '#4f8a52', leaf2: '#3d6e45', leafHi: '#6ea866' },
}

export interface TreePlacement {
  x: number
  z: number
  y?: number
  rot?: number
  scale?: number
}

/** Many copies of one tree design as instanced meshes (one draw call per material). */
export function TreeInstances({ kind, seed, items }: { kind: TreeKind; seed: number; items: TreePlacement[] }) {
  const geos = useMemo(() => treeGeometry(kind, seed), [kind, seed])
  const pal = palettes[kind]
  return (
    <group>
      {Object.entries(geos).map(([slot, g]) => (
        <SlotInstances key={slot} geometry={g} material={toon(pal[slot] ?? pal.leaf, { vertexColors: true })} items={items} />
      ))}
    </group>
  )
}

function SlotInstances({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: TreePlacement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot ?? i * 1.7)
      const s = it.scale ?? 1
      mat.compose(new THREE.Vector3(it.x, it.y ?? 0, it.z), q, new THREE.Vector3(s, s, s))
      m.setMatrixAt(i, mat)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow />
}
