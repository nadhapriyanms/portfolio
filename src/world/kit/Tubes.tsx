import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Wires, cables and constellation strokes as real tube geometry, merged into one mesh.
 * Replaces screen-space fat lines (drei <Line>), whose shader can emit NaN pixels at
 * grazing angles — which the bloom pass then smears into black blocks.
 */
export function tubesGeometry(paths: THREE.Vector3[][], radius: number, radial = 5) {
  const parts = paths
    .filter((p) => p.length > 1)
    .map((p) => {
      const curve = new THREE.CatmullRomCurve3(p, false, 'centripetal')
      return new THREE.TubeGeometry(curve, Math.max(4, p.length * 2), radius, radial, false)
    })
  const merged = parts.length ? mergeGeometries(parts, false) : new THREE.BufferGeometry()
  parts.forEach((g) => g.dispose())
  return merged ?? new THREE.BufferGeometry()
}

export function Tubes({ paths, radius, material }: { paths: THREE.Vector3[][]; radius: number; material: THREE.Material }) {
  const geo = useMemo(() => tubesGeometry(paths, radius), [paths, radius])
  return <mesh geometry={geo} material={material} />
}
