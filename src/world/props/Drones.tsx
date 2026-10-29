import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type P2 = [number, number]

/** Evenly samples n points along a set of 2D polylines (a drawing made of strokes). */
export function samplePolylines(lines: P2[][], n: number): P2[] {
  const segs: { a: P2; b: P2; len: number }[] = []
  for (const l of lines) for (let i = 0; i < l.length - 1; i++) segs.push({ a: l[i], b: l[i + 1], len: Math.hypot(l[i + 1][0] - l[i][0], l[i + 1][1] - l[i][1]) })
  const total = segs.reduce((s, x) => s + x.len, 0)
  const out: P2[] = []
  for (let k = 0; k < n; k++) {
    let d = (k / n) * total
    let s = segs[0]
    for (const seg of segs) {
      s = seg
      if (d <= seg.len) break
      d -= seg.len
    }
    const f = s.len ? Math.min(1, d / s.len) : 0
    out.push([s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f])
  }
  return out
}

export const circle = (cx: number, cy: number, r: number, n = 24): P2[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r])

/** Abstract engineering glyphs, roughly unit-sized and centred on the origin. */
export const glyphs: Record<string, P2[][]> = {
  cycle: [
    circle(-0.62, -0.25, 0.42),
    circle(0.62, -0.25, 0.42),
    [[-0.62, -0.25], [-0.1, 0.35], [0.45, 0.35], [0.62, -0.25]],
    [[-0.1, 0.35], [0.0, -0.25], [0.45, 0.35]],
    [[0.45, 0.35], [0.4, 0.6], [0.6, 0.6]],
  ],
  circuit: [
    [[-0.9, 0.5], [-0.3, 0.5], [-0.3, 0.1], [0.3, 0.1], [0.3, 0.5], [0.9, 0.5]],
    [[-0.9, -0.5], [-0.5, -0.5], [-0.5, -0.1], [0.5, -0.1], [0.5, -0.5], [0.9, -0.5]],
    [[-0.3, 0.1], [-0.3, -0.1]],
    [[0.3, 0.1], [0.3, -0.1]],
    circle(-0.9, 0.5, 0.08, 8),
    circle(0.9, -0.5, 0.08, 8),
  ],
  network: [
    [[-0.8, -0.4], [0, 0.6], [0.8, -0.4], [-0.8, -0.4]],
    [[0, 0.6], [0, -0.1], [-0.8, -0.4]],
    [[0, -0.1], [0.8, -0.4]],
    circle(0, 0.6, 0.12, 8),
    circle(-0.8, -0.4, 0.12, 8),
    circle(0.8, -0.4, 0.12, 8),
    circle(0, -0.1, 0.12, 8),
  ],
  bolt: [[[0.15, 0.8], [-0.35, 0.0], [0.05, 0.0], [-0.15, -0.8], [0.4, 0.15], [0.0, 0.15], [0.15, 0.8]]],
  document: [
    [[-0.55, 0.75], [0.3, 0.75], [0.55, 0.5], [0.55, -0.8], [-0.55, -0.8], [-0.55, 0.75]],
    [[0.3, 0.75], [0.3, 0.5], [0.55, 0.5]],
    [[-0.35, 0.3], [0.35, 0.3]],
    [[-0.35, 0.0], [0.35, 0.0]],
    [[-0.35, -0.3], [0.2, -0.3]],
  ],
  chip: [
    [[-0.45, 0.45], [0.45, 0.45], [0.45, -0.45], [-0.45, -0.45], [-0.45, 0.45]],
    [[-0.2, 0.45], [-0.2, 0.8]],
    [[0.2, 0.45], [0.2, 0.8]],
    [[-0.2, -0.45], [-0.2, -0.8]],
    [[0.2, -0.45], [0.2, -0.8]],
    [[-0.45, 0.15], [-0.8, 0.15]],
    [[0.45, -0.15], [0.8, -0.15]],
  ],
  probe: [
    [[0, 0.9], [0, 0.35]],
    [[-0.7, 0.2], [0.55, 0.2], [0.75, 0.0], [0.55, -0.2], [-0.7, -0.2], [-0.7, 0.2]],
    [[-0.7, 0.0], [-0.9, 0.18]],
    [[-0.7, 0.0], [-0.9, -0.18]],
  ],
  book: [
    [[0, 0.55], [-0.4, 0.7], [-0.85, 0.6], [-0.85, -0.6], [-0.4, -0.5], [0, -0.65]],
    [[0, 0.55], [0.4, 0.7], [0.85, 0.6], [0.85, -0.6], [0.4, -0.5], [0, -0.65]],
    [[0, 0.55], [0, -0.65]],
  ],
}

export function glyphPositions(name: keyof typeof glyphs, n: number, scale: number, center: THREE.Vector3) {
  const pts = samplePolylines(glyphs[name], n)
  const arr = new Float32Array(n * 3)
  pts.forEach(([x, y], i) => arr.set([center.x + x * scale, center.y + y * scale, center.z], i * 3))
  return arr
}

/**
 * Drone-show swarm: `count` lights that morph between formations.
 * `driver` returns which two formations to blend and how far (0–1).
 */
export function Drones({
  formations,
  driver,
  color = '#2de2e6',
  size = 4,
}: {
  formations: Float32Array[]
  driver: (elapsed: number) => { a: number; b: number; k: number }
  color?: string
  size?: number
}) {
  const n = formations[0].length / 3
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(formations[0].slice(), 3))
    return g
  }, [formations])
  const mat = useMemo(() => new THREE.PointsMaterial({ color, size, sizeAttenuation: false, toneMapped: false, transparent: true, depthWrite: false }), [color, size])
  const ref = useRef<THREE.Points>(null)
  useFrame((state) => {
    const { a, b, k } = driver(state.clock.elapsedTime)
    const fa = formations[a]
    const fb = formations[b]
    const p = geo.attributes.position as THREE.BufferAttribute
    const arr = p.array as Float32Array
    for (let i = 0; i < n; i++) {
      // stagger each drone so the swarm flows rather than snapping
      const d = Math.min(1, Math.max(0, k * 1.4 - (i / n) * 0.4))
      const e = d * d * (3 - 2 * d)
      for (let c = 0; c < 3; c++) arr[i * 3 + c] = fa[i * 3 + c] + (fb[i * 3 + c] - fa[i * 3 + c]) * e
    }
    p.needsUpdate = true
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}
