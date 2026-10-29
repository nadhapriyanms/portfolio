import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpS = new THREE.Vector3()
const tmpP = new THREE.Vector3()

export interface WeatherOptions {
  /** Height (m) over which ground grime fades out. */
  grime?: number
  /** Darkening at the base, 0–1. */
  grimeAmount?: number
  /** Random per-part tint jitter, 0–1. */
  jitter?: number
  seed?: number
}

/**
 * Collects many small primitives per material slot and merges them into one geometry per
 * slot. Detailed props (window frames, rails, AC units, roof tiles) then cost one draw call
 * per material instead of one per part. Vertex colours carry painted weathering.
 */
export class Kit {
  private parts = new Map<string, THREE.BufferGeometry[]>()

  add(slot: string, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo
    if (g !== geo) geo.dispose()
    tmpQ.setFromEuler(tmpE.set(rx, ry, rz))
    tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz))
    g.applyMatrix4(tmpM)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2))
    const list = this.parts.get(slot) ?? []
    list.push(g)
    this.parts.set(slot, list)
    return this
  }

  box(slot: string, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    return this.add(slot, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz)
  }

  cyl(slot: string, rTop: number, rBot: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, seg = 10) {
    return this.add(slot, new THREE.CylinderGeometry(rTop, rBot, h, seg), x, y, z, rx, ry, rz)
  }

  sphere(slot: string, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, detail = 1) {
    return this.add(slot, new THREE.IcosahedronGeometry(r, detail), x, y, z, 0, 0, 0, sx, sy, sz)
  }

  /** A beam between two points. */
  beam(slot: string, a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, w: number, round = false) {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    const geo = round ? new THREE.CylinderGeometry(w / 2, w / 2, len, 6) : new THREE.BoxGeometry(w, len, w)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    const e = new THREE.Euler().setFromQuaternion(q)
    const mid = va.add(vb).multiplyScalar(0.5)
    return this.add(slot, geo, mid.x, mid.y, mid.z, e.x, e.y, e.z)
  }

  has(slot: string) {
    return (this.parts.get(slot)?.length ?? 0) > 0
  }

  /** Merges every slot; adds a `color` attribute with grime near the ground and per-part jitter. */
  build(weather: WeatherOptions = {}) {
    const { grime = 1.4, grimeAmount = 0.28, jitter = 0.06, seed = 1 } = weather
    let s = seed >>> 0
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    const out: Record<string, THREE.BufferGeometry> = {}
    this.parts.forEach((list, slot) => {
      for (const g of list) {
        const pos = g.attributes.position
        const col = new Float32Array(pos.count * 3)
        const j = 1 - rand() * jitter
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i)
          const k = Math.min(1, Math.max(0, y / grime))
          const v = j * (1 - grimeAmount * (1 - k * k))
          col[i * 3] = v
          col[i * 3 + 1] = v
          col[i * 3 + 2] = v * 1.01
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name)
      }
      const merged = mergeGeometries(list, false)
      list.forEach((g) => g.dispose())
      if (merged) {
        merged.computeBoundingSphere()
        out[slot] = merged
      }
    })
    this.parts.clear()
    return out
  }
}
