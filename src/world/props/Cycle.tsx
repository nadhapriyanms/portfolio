import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam } from './Beam'
import { flat, palette, toon } from '../../utils/materials'
import { canvasTexture, fonts } from '../../utils/canvasTexture'

/**
 * Stylised interpretation of the CLUX Cargo-cum-Commute Electric Cycle, built from the
 * supplied design renders (Assets/2D model.pdf): moped-style frame with red body panel,
 * long flat seat, triangular rear carrier, fat tyres with disc brakes, and a detachable
 * two-wheel cargo module with coil-over shocks. Illustrative — not the exact CAD geometry.
 * The cycle faces +X; wheels sit on y = 0.
 */
export type CyclePart = 'frame' | 'wheels' | 'drivetrain' | 'cockpit' | 'body' | 'rack' | 'cargo'
export const cycleParts: CyclePart[] = ['frame', 'wheels', 'drivetrain', 'cockpit', 'body', 'rack', 'cargo']

export interface CycleControls {
  spin: number
  crank: number
  /** Per-part assembly 0 (exploded) → 1 (in place). */
  assemble: Partial<Record<CyclePart, number>>
  cargo: boolean
}

export const createCycleControls = (): CycleControls => ({ spin: 0, crank: 0, assemble: {}, cargo: true })

const explodeOffsets: Record<CyclePart, [number, number, number]> = {
  frame: [0, 1.6, 0],
  wheels: [0, 0, 1.6],
  drivetrain: [0, -0.2, 1.9],
  cockpit: [1.4, 1.2, 0],
  body: [0, 2.2, -0.6],
  rack: [-1.1, 1.4, 0],
  cargo: [-2.2, 0, 0],
}

export const WHEEL_R = 0.355
const FRONT: [number, number] = [0.64, WHEEL_R]
const REAR: [number, number] = [-0.54, WHEEL_R]
const BB: [number, number] = [-0.02, 0.33]

function useCycleMaterials(wire?: THREE.Material) {
  return useMemo(() => {
    if (wire) {
      return { frame: wire, tyre: wire, metal: wire, red: wire, seat: wire, panel: wire, white: wire, orange: wire, cargo: wire, light: wire, logo: wire }
    }
    const logoTex = canvasTexture('clux-logo', 512, 220, (ctx, w, h) => {
      ctx.fillStyle = '#141216'
      ctx.beginPath()
      ctx.roundRect(8, 8, w - 16, h - 16, 26)
      ctx.fill()
      ctx.fillStyle = '#f4efe6'
      ctx.font = `800 150px ${fonts.display}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('CLUX', w / 2, h / 2 + 8)
    })
    return {
      frame: toon('#1f1d24'),
      tyre: toon('#232127'),
      metal: toon('#b8b4ae'),
      red: toon(palette.clux),
      seat: toon('#18161b'),
      panel: toon('#2a2830'),
      white: toon('#efe9de'),
      orange: toon('#f08a2c'),
      cargo: toon('#4c5a70'),
      light: flat('#ff4a3a'),
      logo: toon('#ffffff', { map: logoTex }),
    }
  }, [wire])
}

type Mats = ReturnType<typeof useCycleMaterials>

function Wheel({ x, r = WHEEL_R, m, spinRef, z = 0, fat = 0.075 }: { x: number; r?: number; m: Mats; spinRef?: (g: THREE.Group | null) => void; z?: number; fat?: number }) {
  const spokes = 12
  return (
    <group position={[x, r, z]}>
      <group ref={spinRef}>
        <mesh material={m.tyre} castShadow>
          <torusGeometry args={[r - fat, fat, 10, 32]} />
        </mesh>
        <mesh material={m.metal}>
          <torusGeometry args={[r - fat * 2.1, 0.012, 6, 32]} />
        </mesh>
        {Array.from({ length: spokes }, (_, i) => (
          <mesh key={i} material={m.metal} rotation={[0, 0, (i / spokes) * Math.PI * 2]} position={[0, 0, 0]}>
            <boxGeometry args={[0.006, (r - fat * 2.1) * 2, 0.006]} />
          </mesh>
        ))}
        <mesh material={m.metal} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.14, 12]} />
        </mesh>
        {/* disc brake rotor */}
        <mesh material={m.metal} position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.3, r * 0.3, 0.006, 20]} />
        </mesh>
      </group>
    </group>
  )
}

function Part({ name, controls, children }: { name: CyclePart; controls: CycleControls; children: ReactNode }) {
  const ref = useRef<THREE.Group | null>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    if (name === 'cargo') g.visible = controls.cargo
    const a = controls.assemble[name] ?? 1
    const e = 1 - Math.pow(1 - a, 3)
    const o = explodeOffsets[name]
    g.position.set(o[0] * (1 - e), o[1] * (1 - e), o[2] * (1 - e))
    g.rotation.z = (1 - e) * 0.6
    if (name !== 'cargo') g.visible = a > 0.001
    else g.visible = controls.cargo && a > 0.001
  })
  return <group ref={ref}>{children}</group>
}

export function Cycle({ controls, wire }: { controls: CycleControls; wire?: THREE.Material }) {
  const m = useCycleMaterials(wire)
  const front = useRef<THREE.Group | null>(null)
  const rear = useRef<THREE.Group | null>(null)
  const crank = useRef<THREE.Group | null>(null)
  const trailerL = useRef<THREE.Group | null>(null)
  const trailerR = useRef<THREE.Group | null>(null)

  useFrame(() => {
    const s = -controls.spin
    if (front.current) front.current.rotation.z = s
    if (rear.current) rear.current.rotation.z = s
    if (trailerL.current) trailerL.current.rotation.z = s * 2
    if (trailerR.current) trailerR.current.rotation.z = s * 2
    if (crank.current) crank.current.rotation.z = -controls.crank
  })

  const tankShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0.4, 0.99)
    s.lineTo(0.05, 0.94)
    s.lineTo(-0.06, 0.78)
    s.lineTo(0.16, 0.6)
    s.lineTo(0.37, 0.72)
    s.closePath()
    return s
  }, [])

  const handlebar = useMemo(() => {
    const pts = [
      new THREE.Vector3(0.3, 1.27, -0.36),
      new THREE.Vector3(0.38, 1.22, -0.2),
      new THREE.Vector3(0.43, 1.2, 0),
      new THREE.Vector3(0.38, 1.22, 0.2),
      new THREE.Vector3(0.3, 1.27, 0.36),
    ]
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.014, 6, false)
  }, [])

  const fender = (x: number) => (
    <mesh material={m.frame} position={[x, WHEEL_R, 0]} rotation={[0, 0, 0.35]}>
      <torusGeometry args={[WHEEL_R + 0.03, 0.022, 4, 20, Math.PI * 0.75]} />
    </mesh>
  )

  return (
    <group>
      <Part name="wheels" controls={controls}>
        <Wheel x={FRONT[0]} m={m} spinRef={(g) => { front.current = g }} />
        <Wheel x={REAR[0]} m={m} spinRef={(g) => { rear.current = g }} />
      </Part>

      <Part name="frame" controls={controls}>
        <Beam a={[0.42, 0.96, 0]} b={[BB[0], BB[1] + 0.02, 0]} w={0.07} d={0.06} material={m.frame} />
        <Beam a={[0.42, 0.88, 0]} b={[-0.46, 0.82, 0]} w={0.05} d={0.06} material={m.frame} />
        <Beam a={[BB[0], BB[1], 0.05]} b={[REAR[0], REAR[1], 0.06]} w={0.035} material={m.frame} />
        <Beam a={[BB[0], BB[1], -0.05]} b={[REAR[0], REAR[1], -0.06]} w={0.035} material={m.frame} />
        <Beam a={[-0.4, 0.82, 0.05]} b={[REAR[0], REAR[1], 0.06]} w={0.03} material={m.frame} />
        <Beam a={[-0.4, 0.82, -0.05]} b={[REAR[0], REAR[1], -0.06]} w={0.03} material={m.frame} />
        {/* head tube */}
        <Beam a={[0.4, 1.12, 0]} b={[0.46, 0.86, 0]} w={0.07} round material={m.frame} />
        {fender(FRONT[0])}
        {fender(REAR[0])}
        {/* kickstand */}
        <Beam a={[-0.1, 0.32, -0.09]} b={[-0.28, 0.02, -0.16]} w={0.02} round material={m.metal} />
      </Part>

      <Part name="drivetrain" controls={controls}>
        <group position={[BB[0], BB[1], 0.09]}>
          <group ref={crank}>
            <mesh material={m.metal} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.012, 24]} />
            </mesh>
            <mesh material={m.frame} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.02, 12]} />
            </mesh>
            <mesh material={m.frame} position={[0, -0.08, 0.02]}>
              <boxGeometry args={[0.025, 0.17, 0.02]} />
            </mesh>
            <mesh material={m.frame} position={[0, -0.16, 0.07]}>
              <boxGeometry args={[0.09, 0.025, 0.1]} />
            </mesh>
            <mesh material={m.frame} position={[0, 0.08, -0.2]}>
              <boxGeometry args={[0.025, 0.17, 0.02]} />
            </mesh>
            <mesh material={m.frame} position={[0, 0.16, -0.25]}>
              <boxGeometry args={[0.09, 0.025, 0.1]} />
            </mesh>
          </group>
        </group>
        {/* chain runs */}
        <Beam a={[BB[0], BB[1] + 0.1, 0.09]} b={[REAR[0], REAR[1] + 0.05, 0.09]} w={0.01} material={m.metal} />
        <Beam a={[BB[0], BB[1] - 0.1, 0.09]} b={[REAR[0], REAR[1] - 0.05, 0.09]} w={0.01} material={m.metal} />
      </Part>

      <Part name="cockpit" controls={controls}>
        {/* twin fork legs */}
        <Beam a={[0.43, 1.06, 0.085]} b={[FRONT[0], FRONT[1], 0.085]} w={0.04} round material={m.frame} />
        <Beam a={[0.43, 1.06, -0.085]} b={[FRONT[0], FRONT[1], -0.085]} w={0.04} round material={m.frame} />
        <Beam a={[0.41, 1.1, 0]} b={[0.43, 1.21, 0]} w={0.035} round material={m.frame} />
        <mesh geometry={handlebar} material={m.frame} />
        {[0.36, -0.36].map((z) => (
          <mesh key={z} material={m.seat} position={[0.3, 1.27, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.1, 8]} />
          </mesh>
        ))}
        {/* front lamp / plate housing */}
        <mesh material={m.white} position={[0.5, 1.05, 0]}>
          <boxGeometry args={[0.06, 0.12, 0.2]} />
        </mesh>
      </Part>

      <Part name="body" controls={controls}>
        <mesh material={m.red} position={[0, 0, -0.09]} castShadow>
          <extrudeGeometry args={[tankShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 }]} />
        </mesh>
        {[0.105, -0.105].map((z) => (
          <mesh key={z} material={m.logo} position={[0.2, 0.82, z]} rotation={[0, z > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[0.2, 0.086]} />
          </mesh>
        ))}
        <mesh material={m.seat} position={[-0.24, 0.95, 0]} castShadow>
          <boxGeometry args={[0.62, 0.06, 0.2]} />
        </mesh>
        <mesh material={toon('#f0a28a')} position={[-0.56, 0.93, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.2]} />
        </mesh>
      </Part>

      <Part name="rack" controls={controls}>
        {[0.12, -0.12].map((z) => (
          <group key={z}>
            <Beam a={[-0.36, 0.86, z]} b={[-0.86, 0.86, z]} w={0.035} material={m.frame} />
            <Beam a={[-0.86, 0.86, z]} b={[-0.56, 0.47, z]} w={0.035} material={m.frame} />
            <Beam a={[-0.56, 0.47, z]} b={[-0.36, 0.86, z]} w={0.035} material={m.frame} />
          </group>
        ))}
        <mesh material={m.panel} position={[-0.6, 0.89, 0]}>
          <boxGeometry args={[0.52, 0.025, 0.28]} />
        </mesh>
      </Part>

      <Part name="cargo" controls={controls}>
        {/* hitch and L-frame chassis */}
        <Beam a={[-0.86, 0.8, 0]} b={[-1.08, 0.8, 0]} w={0.045} material={m.frame} />
        {[0.24, -0.24].map((z) => (
          <group key={z}>
            <Beam a={[-1.08, 0.82, z]} b={[-1.12, 0.24, z]} w={0.045} material={m.frame} />
            <Beam a={[-1.12, 0.24, z]} b={[-1.98, 0.24, z]} w={0.045} material={m.frame} />
            <Beam a={[-1.98, 0.24, z]} b={[-2.12, 0.46, z]} w={0.045} material={m.frame} />
          </group>
        ))}
        <mesh material={m.cargo} position={[-1.55, 0.27, 0]} castShadow>
          <boxGeometry args={[0.84, 0.03, 0.56]} />
        </mesh>
        <mesh material={m.panel} position={[-1.1, 0.53, 0]} castShadow>
          <boxGeometry args={[0.04, 0.54, 0.56]} />
        </mesh>
        <mesh material={m.frame} position={[-2.1, 0.47, 0]}>
          <boxGeometry args={[0.1, 0.05, 0.62]} />
        </mesh>
        <mesh material={m.light} position={[-2.16, 0.47, 0]}>
          <boxGeometry args={[0.02, 0.035, 0.22]} />
        </mesh>
        {/* trailer wheels with coil-over shocks */}
        {[0.33, -0.33].map((z, i) => (
          <group key={z}>
            <Wheel
              x={-2.1}
              z={z}
              r={0.17}
              fat={0.04}
              m={m}
              spinRef={(g) => { (i === 0 ? trailerL : trailerR).current = g }}
            />
            <Beam a={[-2.1, 0.17, z]} b={[-2.02, 0.45, z * 0.92]} w={0.034} round material={m.orange} />
          </group>
        ))}
      </Part>
    </group>
  )
}
