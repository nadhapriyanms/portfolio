import { useMemo } from 'react'
import * as THREE from 'three'
import { Kit } from './Kit'
import { flat, toon } from '../../utils/materials'

export type PropType = 'vending' | 'mirror' | 'cone' | 'bin' | 'bollard' | 'cabinet' | 'bikerack' | 'manhole' | 'crosswalk' | 'planter' | 'bench' | 'hydrant'

export interface PropItem {
  type: PropType
  x: number
  z: number
  rot?: number
  /** crosswalk only: road width */
  w?: number
}

function place(k: Kit, it: PropItem) {
  const c = Math.cos(it.rot ?? 0)
  const s = Math.sin(it.rot ?? 0)
  // local → world helper for props built in their own frame (front faces +Z)
  const P = (lx: number, ly: number, lz: number): [number, number, number] => [it.x + lx * c + lz * s, ly, it.z - lx * s + lz * c]
  const ry = it.rot ?? 0
  const box = (slot: string, w: number, h: number, d: number, lx: number, ly: number, lz: number, rx = 0) => {
    const [x, y, z] = P(lx, ly, lz)
    k.box(slot, w, h, d, x, y, z, ry, rx)
  }
  const cyl = (slot: string, r1: number, r2: number, h: number, lx: number, ly: number, lz: number, rx = 0, seg = 10) => {
    const [x, y, z] = P(lx, ly, lz)
    k.cyl(slot, r1, r2, h, x, y, z, rx, ry, 0, seg)
  }
  switch (it.type) {
    case 'vending': {
      box('vendBody', 1.0, 1.85, 0.75, 0, 0.93, 0)
      box('vendGlow', 0.82, 1.0, 0.02, 0, 1.25, 0.38)
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 6; col++) box(`can${(row + col) % 3}`, 0.08, 0.2, 0.05, -0.3 + col * 0.12, 0.92 + row * 0.33, 0.37)
      box('dark', 0.5, 0.18, 0.05, 0, 0.35, 0.38)
      box('dark', 0.06, 0.25, 0.04, 0.38, 0.75, 0.39)
      break
    }
    case 'mirror': {
      cyl('pole', 0.045, 0.045, 3.1, 0, 1.55, 0)
      cyl('accent', 0.42, 0.42, 0.06, 0, 2.9, 0.1, Math.PI / 2, 20)
      const [x, y, z] = P(0, 2.9, 0.15)
      k.sphere('mirror', 0.36, x, y, z, 1, 1, 0.25, 2)
      break
    }
    case 'cone': {
      cyl('cone', 0.03, 0.19, 0.6, 0, 0.32, 0, 0, 12)
      cyl('coneBand', 0.11, 0.135, 0.1, 0, 0.36, 0, 0, 12)
      box('cone', 0.42, 0.04, 0.42, 0, 0.02, 0)
      break
    }
    case 'bin': {
      cyl('binBody', 0.26, 0.23, 0.75, 0, 0.38, 0, 0, 14)
      cyl('dark', 0.28, 0.28, 0.06, 0, 0.77, 0, 0, 14)
      cyl('accent', 0.255, 0.255, 0.08, 0, 0.55, 0, 0, 14)
      break
    }
    case 'bollard': {
      cyl('pole', 0.08, 0.09, 0.85, 0, 0.42, 0, 0, 10)
      cyl('coneBand', 0.085, 0.085, 0.08, 0, 0.72, 0, 0, 10)
      break
    }
    case 'cabinet': {
      box('cabinet', 0.75, 1.25, 0.42, 0, 0.62, 0)
      box('dark', 0.02, 1.0, 0.02, 0, 0.65, 0.22)
      for (let i = 0; i < 4; i++) box('dark', 0.5, 0.025, 0.02, 0, 0.3 + i * 0.08, 0.22)
      box('cabinet', 0.8, 0.06, 0.48, 0, 1.27, 0)
      break
    }
    case 'bikerack': {
      for (let i = 0; i < 4; i++) {
        const lx = -0.9 + i * 0.6
        const [x, y, z] = P(lx, 0.45, 0)
        k.add('pole', new THREE.TorusGeometry(0.32, 0.025, 6, 16, Math.PI), x, y - 0.32, z, 0, ry + Math.PI / 2, 0)
      }
      break
    }
    case 'manhole': {
      cyl('dark', 0.38, 0.38, 0.02, 0, 0.01, 0, 0, 20)
      cyl('pole', 0.3, 0.3, 0.025, 0, 0.012, 0, 0, 20)
      break
    }
    case 'crosswalk': {
      const w = it.w ?? 7
      for (let x = -w / 2 + 0.3; x < w / 2; x += 0.9) box('paint', 0.5, 0.012, 3, x, 0.008, 0)
      break
    }
    case 'planter': {
      box('planterBox', 1.6, 0.5, 0.55, 0, 0.25, 0)
      for (let i = 0; i < 4; i++) {
        const [x, , z] = P(-0.55 + i * 0.37, 0, 0)
        k.sphere(i % 2 ? 'plant' : 'plant2', 0.28, x, 0.62, z, 1, 0.8, 1, 1)
      }
      break
    }
    case 'bench': {
      for (let i = 0; i < 3; i++) box('wood', 1.7, 0.05, 0.12, 0, 0.45, -0.15 + i * 0.15)
      for (let i = 0; i < 2; i++) box('wood', 1.7, 0.1, 0.04, 0, 0.7 + i * 0.16, -0.25, -0.15)
      box('pole', 0.05, 0.45, 0.5, -0.75, 0.22, 0)
      box('pole', 0.05, 0.45, 0.5, 0.75, 0.22, 0)
      break
    }
    case 'hydrant': {
      cyl('hydrant', 0.13, 0.15, 0.6, 0, 0.3, 0, 0, 12)
      cyl('hydrant', 0.15, 0.15, 0.12, 0, 0.66, 0, 0, 12)
      const [x, , z] = P(0, 0, 0)
      k.cyl('hydrant', 0.05, 0.05, 0.45, x, 0.4, z, 0, ry, Math.PI / 2, 8)
      break
    }
  }
}

const propMaterials = (): Record<string, THREE.Material> => {
  const vc = { vertexColors: true }
  return {
    vendBody: toon('#d9dfe4', vc),
    vendGlow: flat('#f4fbff'),
    can0: toon('#d8322a', vc),
    can1: toon('#2f6fb3', vc),
    can2: toon('#e8b93a', vc),
    dark: toon('#2a2830', vc),
    pole: toon('#8d9297', vc),
    accent: toon('#e8774a', vc),
    mirror: toon('#cfe6ee', vc),
    cone: toon('#ef7a2a', vc),
    coneBand: toon('#f4f0e6', vc),
    binBody: toon('#4f7d6a', vc),
    cabinet: toon('#9aa59a', vc),
    paint: toon('#efe6d2', vc),
    planterBox: toon('#9c8a76', vc),
    plant: toon('#6f9a58', vc),
    plant2: toon('#4f7d45', vc),
    wood: toon('#8a5a3c', vc),
    hydrant: toon('#c9372c', vc),
  }
}

/** Every prop of a street merged into one mesh per material. */
export function StreetProps({ items }: { items: PropItem[] }) {
  const geos = useMemo(() => {
    const k = new Kit()
    items.forEach((it) => place(k, it))
    return k.build({ seed: 3, grime: 0.6, grimeAmount: 0.18 })
  }, [items])
  const mats = useMemo(propMaterials, [])
  return (
    <group>
      {Object.entries(geos).map(([slot, g]) => (
        <mesh key={slot} geometry={g} material={mats[slot] ?? mats.dark} castShadow={slot !== 'paint'} receiveShadow />
      ))}
    </group>
  )
}
