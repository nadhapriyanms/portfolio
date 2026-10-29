import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { canvasTexture, rng } from '../../utils/canvasTexture'
import { palette, toon } from '../../utils/materials'
import { Character, createActor } from '../../character/Character'
import { useStore } from '../../state/store'
import { Townhouse, type TownhouseSpec } from '../kit/Townhouse'

const miniHouses: TownhouseSpec[] = [
  { w: 5, d: 5, floors: 2, wall: palette.cream, roof: palette.teal, accent: palette.sunset, roofType: 'gable', seed: 901 },
  { w: 5.5, d: 5, floors: 2, wall: palette.peach, roof: palette.brick, accent: palette.teal, roofType: 'gable', seed: 902 },
  { w: 4.5, d: 5, floors: 3, wall: '#cfd8c4', roof: '#5d6a8a', accent: palette.brick, roofType: 'flat', seed: 903 },
  { w: 5, d: 5, floors: 2, wall: palette.rose, roof: '#6f8b6a', accent: '#5d6a8a', roofType: 'gable', shop: 'TEA', seed: 904 },
]

/** Value-noise continents painted into an equirectangular canvas. */
function globeTexture() {
  return canvasTexture('globe-map-2k', 2048, 1024, (ctx, w, h) => {
    const r = rng(2026)
    const grid = 32
    const g: number[] = Array.from({ length: (grid + 1) * (grid + 1) }, () => r())
    const val = (x: number, y: number) => {
      const xi = Math.floor(x) % grid
      const yi = Math.min(grid - 1, Math.floor(y))
      const xf = x - Math.floor(x)
      const yf = y - Math.floor(y)
      const s = (t: number) => t * t * (3 - 2 * t)
      const a = g[yi * (grid + 1) + xi]
      const b = g[yi * (grid + 1) + ((xi + 1) % grid)]
      const c = g[(yi + 1) * (grid + 1) + xi]
      const d = g[(yi + 1) * (grid + 1) + ((xi + 1) % grid)]
      return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf)
    }
    const img = ctx.createImageData(w, h)
    const ocean = [93, 141, 147]
    const oceanDeep = [72, 116, 128]
    const sand = [222, 205, 165]
    const grass = [160, 182, 132]
    const hill = [124, 152, 112]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x / w) * grid
        const v = (y / h) * (grid - 1)
        // domain-warped value noise: organic coastlines instead of grid-aligned blobs
        const wx = (val(u * 0.5, v * 0.5) - 0.5) * 3.2
        const wy = (val(u * 0.5 + 7, v * 0.5 + 3) - 0.5) * 3.2
        const vv = Math.min(grid - 1.001, Math.max(0, v + wy * 0.6))
        const uu = (u + wx + grid * 4) % grid
        const n = val(uu, vv) * 0.55 + val((uu * 2) % grid, Math.min(grid - 1.001, vv * 2) % (grid - 1)) * 0.27 + val((u * 4) % grid, (v * 4) % (grid - 1)) * 0.12 + val((u * 8) % grid, (v * 8) % (grid - 1)) * 0.06
        const lat = Math.abs(y / h - 0.5) * 2
        // painted bands with soft (antialiased) borders instead of hard per-pixel steps
        const band = (e: number, k = 0.006) => Math.min(1, Math.max(0, (n - e) / k + 0.5))
        const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
        let col = mix(oceanDeep, ocean, band(0.47, 0.03))
        col = mix(col, sand, band(0.55))
        col = mix(col, grass, band(0.58))
        col = mix(col, hill, band(0.68))
        col = mix(col, [238, 232, 220], Math.min(1, Math.max(0, (lat - 0.88) / 0.01 + 0.5)))
        const i = (y * w + x) * 4
        img.data[i] = col[0]
        img.data[i + 1] = col[1]
        img.data[i + 2] = col[2]
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    // hand-drawn graticule
    ctx.strokeStyle = 'rgba(29,26,36,0.18)'
    ctx.lineWidth = 3
    for (let i = 1; i < 12; i++) {
      ctx.beginPath()
      ctx.moveTo((i / 12) * w, 0)
      ctx.lineTo((i / 12) * w, h)
      ctx.stroke()
    }
    for (let j = 1; j < 6; j++) {
      ctx.beginPath()
      ctx.moveTo(0, (j / 6) * h)
      ctx.lineTo(w, (j / 6) * h)
      ctx.stroke()
    }
  })
}

const UP = new THREE.Vector3(0, 1, 0)

/** Places an object on the sphere at (polar angle, azimuth), standing upright on the surface. */
function surface(R: number, theta: number, phi: number) {
  const n = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi))
  return { pos: n.clone().multiplyScalar(R), quat: new THREE.Quaternion().setFromUnitVectors(UP, n) }
}

/**
 * The stylised planet: painted continents, orbit rings, drifting clouds and a tiny street
 * on the north pole where the story begins.
 */
export function Globe({
  radius = 2,
  spinRef,
  showTown = true,
  actorPose = 'wave' as const,
  autoSpin = true,
}: {
  radius?: number
  spinRef?: React.MutableRefObject<number>
  showTown?: boolean
  actorPose?: 'wave' | 'idle'
  autoSpin?: boolean
}) {
  const reduced = useStore((s) => s.reducedMotion)
  const body = useRef<THREE.Group>(null)
  const rings = useRef<THREE.Group>(null)
  const clouds = useRef<THREE.Group>(null)
  const tex = useMemo(globeTexture, [])
  const actor = useMemo(() => createActor({ pose: actorPose, y: 0 }), [actorPose])

  const town = useMemo(() => {
    const r = rng(9)
    const items: { pos: THREE.Vector3; quat: THREE.Quaternion; kind: 'house' | 'tree'; color: string; roof: string; s: number }[] = []
    const colors = [palette.cream, palette.peach, '#e7d3b1', palette.rose, '#cfd8c4']
    const roofs = [palette.teal, palette.brick, '#5d6a8a', '#6f8b6a']
    for (let i = 0; i < 26; i++) {
      const theta = 0.07 + r() * 0.3
      const phi = r() * Math.PI * 2
      // keep the lane in front of the character clear
      if (Math.abs(Math.sin(phi)) > 0.85 && theta < 0.16 && Math.sin(phi) > 0) continue
      const { pos, quat } = surface(radius, theta, phi)
      const kind = r() < 0.3 ? 'tree' : 'house'
      items.push({ pos, quat, kind, color: colors[Math.floor(r() * colors.length)], roof: roofs[Math.floor(r() * roofs.length)], s: 0.7 + r() * 0.6 })
    }
    return items
  }, [radius])

  const cloudPuffs = useMemo(() => {
    const r = rng(31)
    return Array.from({ length: 9 }, () => {
      const theta = 0.5 + r() * 1.8
      const phi = r() * Math.PI * 2
      const n = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi))
      return { pos: n.multiplyScalar(radius * 1.22), s: 0.14 + r() * 0.16 }
    })
  }, [radius])

  useFrame((state, dt) => {
    const t = reduced ? 0 : state.clock.elapsedTime
    if (body.current) body.current.rotation.y = (spinRef?.current ?? 0) + (autoSpin ? t * 0.03 : 0)
    if (rings.current) rings.current.rotation.y += reduced ? 0 : dt * 0.08
    if (clouds.current) clouds.current.rotation.y = -t * 0.02 + (spinRef?.current ?? 0) * 0.6
  })

  const R = radius
  return (
    <group>
      <group ref={body}>
        <mesh material={toon('#ffffff', { map: tex })}>
          <sphereGeometry args={[R, 64, 40]} />
        </mesh>
        {showTown && (
          <group>
            {/* ring road and crossing lanes around the pole */}
            <mesh material={toon(palette.asphalt)} position={[0, R * Math.cos(0.2) + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[R * Math.sin(0.2), 0.018, 4, 64]} />
            </mesh>
            {[0, Math.PI / 2].map((rot) => (
              <mesh key={rot} material={toon(palette.asphalt)} rotation={[0, rot, 0]}>
                <sphereGeometry args={[R + 0.003, 48, 6, -0.02, 0.04, 0, 0.42]} />
              </mesh>
            ))}
            {town.map((it, i) => (
              <group key={i} position={it.pos} quaternion={it.quat} scale={it.s * radius * 0.03}>
                {it.kind === 'house' ? (
                  <group scale={0.19} rotation={[0, i * 1.3, 0]}>
                    <Townhouse spec={miniHouses[i % miniHouses.length]} position={[0, 0, 0]} sign={false} />
                  </group>
                ) : (
                  <>
                    <mesh material={toon('#5b4031')} position={[0, 0.4, 0]}>
                      <cylinderGeometry args={[0.08, 0.1, 0.8, 5]} />
                    </mesh>
                    <mesh material={toon('#7d9f6a')} position={[0, 1.0, 0]}>
                      <icosahedronGeometry args={[0.45, 0]} />
                    </mesh>
                  </>
                )}
              </group>
            ))}
          </group>
        )}
      </group>
      {/* the tiny explorer standing on top of the world; stays facing the camera while the planet turns */}
      {showTown && (
        <group position={[0, R - 0.002, 0.04]} scale={radius * 0.05}>
          <Character actor={actor} />
        </group>
      )}

      <group ref={clouds}>
        {cloudPuffs.map((c, i) => (
          <group key={i} position={c.pos} scale={c.s * radius * 0.5}>
            <mesh material={toon('#fbf3e6')}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
            <mesh material={toon('#fbf3e6')} position={[0.9, -0.15, 0]} scale={0.7}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={rings}>
        <group rotation={[1.25, 0.2, 0.15]}>
          <mesh material={toon('#e8d9b8')}>
            <torusGeometry args={[R * 1.55, 0.008 * R, 4, 160]} />
          </mesh>
          <mesh material={toon(palette.sunset)} position={[R * 1.55, 0, 0]}>
            <octahedronGeometry args={[0.06 * R, 0]} />
          </mesh>
        </group>
        <group rotation={[1.7, -0.4, 0]}>
          <mesh material={toon('#c9b48e')}>
            <torusGeometry args={[R * 1.8, 0.005 * R, 4, 160]} />
          </mesh>
          <mesh material={toon(palette.cyan)} position={[0, R * 1.8, 0]}>
            <boxGeometry args={[0.07 * R, 0.04 * R, 0.07 * R]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
