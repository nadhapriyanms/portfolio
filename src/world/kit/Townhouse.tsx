import { useMemo } from 'react'
import * as THREE from 'three'
import { Kit } from './Kit'
import { flat, toon } from '../../utils/materials'
import { canvasTexture, fonts, rng } from '../../utils/canvasTexture'

export interface TownhouseSpec {
  w: number
  d: number
  floors: number
  wall: string
  roof: string
  accent: string
  roofType: 'gable' | 'flat'
  shop?: string
  seed: number
}

const FLOOR_H = 2.75
const BASE_H = 0.45

function shade(hex: string, k: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString()
}

/** Builds the merged geometry for one townhouse. Front faces +Z, ground at y = 0. */
export function buildTownhouse(spec: TownhouseSpec) {
  const r = rng(spec.seed)
  const k = new Kit()
  const { w, d, floors } = spec
  const H = BASE_H + floors * FLOOR_H
  const fz = d / 2

  // body, plinth, floor bands, horizontal siding on the upper floors
  k.box('base', w + 0.08, BASE_H, d + 0.08, 0, BASE_H / 2, 0)
  k.box('wall', w, H - BASE_H, d, 0, BASE_H + (H - BASE_H) / 2, 0)
  for (let f = 1; f < floors; f++) k.box('trim', w + 0.1, 0.14, d + 0.1, 0, BASE_H + f * FLOOR_H, 0)
  for (let f = 1; f < floors; f++)
    for (let y = 0.3; y < FLOOR_H - 0.2; y += 0.34) k.box('wallLine', w + 0.01, 0.025, 0.02, 0, BASE_H + f * FLOOR_H + y, fz + 0.005)
  // side siding
  for (let y = BASE_H + 0.3; y < H - 0.2; y += 0.34) {
    k.box('wallLine', 0.02, 0.025, d, w / 2 + 0.005, y, 0)
    k.box('wallLine', 0.02, 0.025, d, -w / 2 - 0.005, y, 0)
  }

  // windows on every upper floor (and the ground floor of a plain house)
  const cols = Math.max(1, Math.round(w / 2.1))
  const colW = w / cols
  const winW = Math.min(1.3, colW * 0.62)
  const winH = 1.25
  const doorCol = Math.floor(cols / 2)
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      if (f === 0 && (spec.shop || c === doorCol)) continue
      const x = -w / 2 + colW * (c + 0.5)
      const y = BASE_H + f * FLOOR_H + 1.45
      const z = fz + 0.04
      k.box('trim', winW + 0.16, 0.08, 0.1, x, y + winH / 2, z)
      k.box('trim', winW + 0.16, 0.08, 0.1, x, y - winH / 2, z)
      k.box('trim', 0.08, winH, 0.1, x - winW / 2, y, z)
      k.box('trim', 0.08, winH, 0.1, x + winW / 2, y, z)
      k.box('trim', 0.05, winH, 0.06, x, y, z)
      k.box('glass', winW, winH, 0.02, x, y, fz + 0.01)
      k.box('glassHi', 0.06, winH * 0.7, 0.01, x - winW * 0.18, y + 0.05, fz + 0.03, 0, 0, 0.5)
      // curtain half drawn
      k.box('curtain', winW * 0.45, winH * 0.9, 0.02, x + winW * (r() < 0.5 ? 0.25 : -0.25), y, fz - 0.03)
      k.box('trim', winW + 0.3, 0.06, 0.22, x, y - winH / 2 - 0.07, fz + 0.1)
      if (r() < 0.35) k.box('metal', winW + 0.2, 0.2, 0.16, x, y + winH / 2 + 0.14, fz + 0.08) // shutter box
      // wall-mounted AC condenser
      if (f > 0 && r() < 0.45) {
        const ax = x + (r() < 0.5 ? 0.55 : -0.55) * colW * 0.4
        const ay = y - winH / 2 - 0.55
        k.box('metal', 0.78, 0.55, 0.3, ax, ay, fz + 0.2)
        k.cyl('dark', 0.19, 0.19, 0.02, ax - 0.12, ay, fz + 0.36, Math.PI / 2, 0, 0, 16)
        k.box('dark', 0.04, 0.04, 0.34, ax - 0.3, ay - 0.3, fz + 0.18)
        k.box('dark', 0.04, 0.04, 0.34, ax + 0.3, ay - 0.3, fz + 0.18)
        k.beam('pipe', [ax + 0.3, ay, fz + 0.1], [ax + 0.3, ay + 0.6, fz + 0.03], 0.04, true)
      }
    }
  }

  // balcony with rail, potted plants and laundry
  if (floors >= 2 && r() < 0.75) {
    const by = BASE_H + FLOOR_H
    const bw = w * 0.82
    k.box('trim', bw, 0.14, 0.95, 0, by + 0.07, fz + 0.47)
    k.box('rail', bw, 0.05, 0.05, 0, by + 1.05, fz + 0.93)
    k.box('rail', 0.05, 0.05, 0.9, -bw / 2, by + 1.05, fz + 0.48)
    k.box('rail', 0.05, 0.05, 0.9, bw / 2, by + 1.05, fz + 0.48)
    for (let x = -bw / 2; x <= bw / 2 + 0.01; x += 0.16) k.box('rail', 0.025, 0.95, 0.025, x, by + 0.6, fz + 0.93)
    const pots = 2 + Math.floor(r() * 3)
    for (let i = 0; i < pots; i++) {
      const px = -bw / 2 + 0.3 + r() * (bw - 0.6)
      k.cyl('pot', 0.14, 0.1, 0.24, px, by + 0.26, fz + 0.65, 0, 0, 0, 10)
      k.sphere('plant', 0.22, px, by + 0.5, fz + 0.65, 1, 0.9, 1, 1)
      k.sphere('plant2', 0.15, px + 0.08, by + 0.62, fz + 0.62, 1, 1, 1, 1)
    }
    if (r() < 0.7) {
      k.beam('metal', [-bw / 2 + 0.1, by + 1.75, fz + 0.75], [bw / 2 - 0.1, by + 1.75, fz + 0.75], 0.03, true)
      for (let i = 0; i < 4; i++) {
        const lx = -bw / 3 + i * (bw / 5)
        k.box(i % 2 ? 'cloth' : 'cloth2', 0.42, 0.55 + r() * 0.2, 0.02, lx, by + 1.42, fz + 0.75)
      }
    }
  }

  // drainpipe and gutter
  const px = w / 2 - 0.14
  k.cyl('pipe', 0.055, 0.055, H - 0.1, px, H / 2, fz + 0.1, 0, 0, 0, 8)
  for (let y = 1; y < H; y += 1.6) k.box('pipe', 0.16, 0.05, 0.16, px, y, fz + 0.08)
  k.box('pipe', w + 0.5, 0.12, 0.16, 0, H + 0.02, fz + 0.32)

  // roof
  if (spec.roofType === 'gable') {
    const rise = Math.min(1.6, d * 0.32)
    const half = d / 2 + 0.45
    const slope = Math.atan2(rise, half)
    const len = Math.hypot(half, rise)
    const shape = new THREE.Shape()
    shape.moveTo(-d / 2, 0)
    shape.lineTo(d / 2, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    k.add('wall', new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }), -w / 2, H, 0, 0, Math.PI / 2, 0)
    const rows = Math.ceil(len / 0.32)
    for (const side of [1, -1]) {
      for (let i = 0; i < rows; i++) {
        const t = (i + 0.5) / rows
        const zz = side * (half * (1 - t))
        const yy = H + rise * t + 0.08
        k.box(i % 2 ? 'roof' : 'roofDark', w + 0.7, 0.07, 0.36, 0, yy, zz, 0, side * slope)
      }
      // fascia board along the eave
      k.box('trim', w + 0.75, 0.16, 0.06, 0, H - 0.02, side * (half + 0.02))
    }
    k.box('roofDark', w + 0.8, 0.16, 0.22, 0, H + rise + 0.1, 0)
    k.box('roofDark', 0.2, 0.3, 0.2, w / 2 + 0.3, H + rise + 0.15, 0)
    k.box('roofDark', 0.2, 0.3, 0.2, -w / 2 - 0.3, H + rise + 0.15, 0)
  } else {
    k.box('trim', w + 0.1, 0.5, 0.14, 0, H + 0.25, fz)
    k.box('trim', w + 0.1, 0.5, 0.14, 0, H + 0.25, -fz)
    k.box('trim', 0.14, 0.5, d, w / 2, H + 0.25, 0)
    k.box('trim', 0.14, 0.5, d, -w / 2, H + 0.25, 0)
    // rooftop clutter: water tank, AC units, antenna
    const tx = -w / 4
    k.cyl('metal', 0.6, 0.6, 1.1, tx, H + 1.2, -d / 5, 0, 0, 0, 14)
    k.cyl('dark', 0.62, 0.62, 0.08, tx, H + 1.78, -d / 5, 0, 0, 0, 14)
    for (const lx of [-0.4, 0.4]) k.box('dark', 0.08, 0.7, 0.08, tx + lx, H + 0.35, -d / 5)
    k.box('metal', 0.9, 0.6, 0.6, w / 4, H + 0.3, d / 6)
    k.cyl('dark', 0.22, 0.22, 0.02, w / 4, H + 0.61, d / 6, 0, 0, 0, 14)
    k.beam('rail', [w / 3, H, -d / 3], [w / 3, H + 2.6, -d / 3], 0.05, true)
    k.beam('rail', [w / 3 - 0.4, H + 2.2, -d / 3], [w / 3 + 0.4, H + 2.2, -d / 3], 0.03, true)
  }

  // ground floor: shop front or front door
  if (spec.shop) {
    const sw = w - 0.6
    k.box('dark', sw, 2.3, 0.4, 0, BASE_H + 1.15, fz - 0.15)
    // half-open roll shutter
    for (let y = 0; y < 0.8; y += 0.07) k.box('metal', sw, 0.05, 0.04, 0, BASE_H + 2.25 - y, fz + 0.06)
    k.box('trim', sw + 0.2, 0.12, 0.12, 0, BASE_H + 2.38, fz + 0.06)
    // striped awning
    const stripes = 8
    for (let i = 0; i < stripes; i++)
      k.box(i % 2 ? 'awning2' : 'awning', sw / stripes, 0.04, 1.1, -sw / 2 + (sw / stripes) * (i + 0.5), BASE_H + 2.55, fz + 0.55, 0, 0.32)
    k.box('awning', sw, 0.22, 0.03, 0, BASE_H + 2.32, fz + 1.08)
    // noren curtain strips
    for (let i = 0; i < 4; i++) k.box('noren', 0.24, 0.55, 0.02, -0.39 + i * 0.26, BASE_H + 1.95, fz + 0.08)
    // goods out front
    for (let i = 0; i < 3; i++) {
      const cx = -sw / 2 + 0.5 + i * 0.6
      k.box('wood', 0.5, 0.35, 0.4, cx, BASE_H + 0.18, fz + 0.45)
      for (let j = 0; j < 3; j++) k.sphere('produce' + (i % 2), 0.08, cx - 0.14 + j * 0.14, BASE_H + 0.42, fz + 0.45, 1, 1, 1, 0)
    }
  } else {
    const dx = -w / 2 + colW * (doorCol + 0.5)
    k.box('trim', 1.15, 2.3, 0.12, dx, BASE_H + 1.15, fz + 0.03)
    k.box('wood', 0.95, 2.15, 0.06, dx, BASE_H + 1.08, fz + 0.07)
    k.box('glass', 0.18, 1.4, 0.02, dx + 0.28, BASE_H + 1.25, fz + 0.11)
    k.cyl('metal', 0.03, 0.03, 0.2, dx - 0.32, BASE_H + 1.05, fz + 0.12, 0, 0, Math.PI / 2, 6)
    k.box('base', 1.5, 0.16, 0.5, dx, BASE_H - 0.08, fz + 0.3)
    k.box('trim', 1.4, 0.08, 0.6, dx, BASE_H + 2.5, fz + 0.3) // canopy
    k.box('accent', 0.32, 0.4, 0.14, dx + 0.95, BASE_H + 1.1, fz + 0.07) // mailbox
    k.box('metal', 0.35, 0.5, 0.15, dx - 1.0, BASE_H + 1.35, fz + 0.07) // meter box
    k.cyl('dark', 0.08, 0.08, 0.02, dx - 1.0, BASE_H + 1.42, fz + 0.15, Math.PI / 2, 0, 0, 12)
    k.sphere('lamp', 0.08, dx + 0.62, BASE_H + 2.2, fz + 0.12, 1, 1, 1, 1)
    k.cyl('pot', 0.18, 0.13, 0.32, dx - 0.75, 0.16, fz + 0.35, 0, 0, 0, 10)
    k.sphere('plant', 0.32, dx - 0.75, 0.55, fz + 0.35, 1, 1.2, 1, 1)
  }

  return k.build({ seed: spec.seed, grime: 1.6, grimeAmount: 0.3 })
}

function slotMaterials(spec: TownhouseSpec): Record<string, THREE.Material> {
  const vc = { vertexColors: true }
  return {
    base: toon('#8b8279', vc),
    wall: toon(spec.wall, vc),
    wallLine: toon(shade(spec.wall, 0.82), vc),
    trim: toon('#efe7d6', vc),
    glass: toon('#4f6b7d', vc),
    glassHi: flat('#d9eef5', 0.6),
    curtain: toon('#e8dcc2', vc),
    metal: toon('#a3a8aa', vc),
    pipe: toon('#8e9293', vc),
    dark: toon('#2c2a31', vc),
    wood: toon('#7a5138', vc),
    roof: toon(spec.roof, vc),
    roofDark: toon(shade(spec.roof, 0.78), vc),
    rail: toon('#3d4146', vc),
    plant: toon('#6f9a58', vc),
    plant2: toon('#4f7d45', vc),
    pot: toon('#b4643f', vc),
    cloth: toon('#f1ece0', vc),
    cloth2: toon('#d98e8e', vc),
    awning: toon(spec.accent, vc),
    awning2: toon('#f3eadb', vc),
    noren: toon('#2f4a6a', vc),
    produce0: toon('#e8774a', vc),
    produce1: toon('#9bc25a', vc),
    accent: toon(spec.accent, vc),
    lamp: flat('#ffe6b0'),
  }
}

function shopSign(text: string, accent: string) {
  return canvasTexture(`shop-${text}-${accent}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f6efe0'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = accent
    ctx.fillRect(0, h - 18, w, 18)
    ctx.fillStyle = '#1d1a24'
    ctx.font = `800 82px ${fonts.display}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 - 4)
  })
}

const houseCache = new Map<string, Record<string, THREE.BufferGeometry>>()

/** A detailed, weathered townhouse rendered as one mesh per material. */
export function Townhouse({ spec, position, rotation = 0, sign = true }: { spec: TownhouseSpec; position: THREE.Vector3Tuple; rotation?: number; sign?: boolean }) {
  const geos = useMemo(() => {
    // identical specs share one geometry set (e.g. the miniature town on the globe)
    const key = JSON.stringify(spec)
    let g = houseCache.get(key)
    if (!g) houseCache.set(key, (g = buildTownhouse(spec)))
    return g
  }, [spec])
  const mats = useMemo(() => slotMaterials(spec), [spec])
  const signMat = useMemo(() => (spec.shop ? toon('#ffffff', { map: shopSign(spec.shop, spec.accent) }) : null), [spec])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Object.entries(geos).map(([slot, g]) => (
        <mesh key={slot} geometry={g} material={mats[slot] ?? mats.wall} castShadow={slot === 'wall' || slot === 'roof'} receiveShadow={slot === 'wall' || slot === 'base'} />
      ))}
      {sign && signMat && (
        <mesh material={signMat} position={[0, BASE_H + 3.0, spec.d / 2 + 1.12]} rotation={[-0.05, 0, 0]}>
          <planeGeometry args={[Math.min(spec.w - 1, 3.6), 0.9]} />
        </mesh>
      )}
    </group>
  )
}

export const townhouseHeight = (spec: TownhouseSpec) => BASE_H + spec.floors * FLOOR_H
