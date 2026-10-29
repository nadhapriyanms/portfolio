import { useMemo } from 'react'
import * as THREE from 'three'

type V = [number, number, number]

const up = new THREE.Vector3(0, 1, 0)

/** A box or tube stretched between two points — the building block for frames and rails. */
export function Beam({
  a,
  b,
  w = 0.04,
  d,
  round = false,
  material,
}: {
  a: V
  b: V
  w?: number
  d?: number
  round?: boolean
  material: THREE.Material
}) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize())
    const pos = va.add(vb).multiplyScalar(0.5)
    return { pos, quat, len }
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow>
      {round ? <cylinderGeometry args={[w / 2, w / 2, len, 10]} /> : <boxGeometry args={[w, len, d ?? w]} />}
    </mesh>
  )
}
