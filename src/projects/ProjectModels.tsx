import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { flat, palette, toon } from '../utils/materials'
import type { ProjectModelKey } from './projectData'
import { Beam } from '../world/props/Beam'

/** Small illustrative models — visual metaphors for each project, not replicas of the hardware. */
export function ProjectModel({ kind, accent, animate = true }: { kind: ProjectModelKey; accent: string; animate?: boolean }) {
  const spin = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (spin.current && animate) spin.current.rotation.y = s.clock.elapsedTime * 0.35
  })
  const Model = models[kind]
  return (
    <group ref={spin}>
      <Model accent={accent} animate={animate} />
    </group>
  )
}

type MP = { accent: string; animate: boolean }

function Wheel({ r, w, position }: { r: number; w: number; position: [number, number, number] }) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh material={toon('#26242b')}>
        <cylinderGeometry args={[r, r, w, 18]} />
      </mesh>
      <mesh material={toon('#c9c2b6')} position={[0, w / 2 + 0.002, 0]}>
        <cylinderGeometry args={[r * 0.5, r * 0.5, 0.01, 14]} />
      </mesh>
    </group>
  )
}

const models: Record<ProjectModelKey, (p: MP) => React.JSX.Element> = {
  tractor: ({ accent }) => (
    <group position={[0, -0.35, 0]}>
      <mesh material={toon(accent)} position={[0.15, 0.55, 0]}>
        <boxGeometry args={[1.3, 0.38, 0.62]} />
      </mesh>
      <mesh material={toon('#3b4a33')} position={[0.62, 0.48, 0]}>
        <boxGeometry args={[0.32, 0.3, 0.56]} />
      </mesh>
      {/* sensor mast with GPS dome — no cab, it drives itself */}
      <Beam a={[-0.2, 0.74, 0]} b={[-0.2, 1.3, 0]} w={0.05} round material={toon('#2a2830')} />
      <mesh material={toon('#f1ece2')} position={[-0.2, 1.34, 0]}>
        <sphereGeometry args={[0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0.2, 0, -0.2].map((z) => (
        <mesh key={z} material={flat(palette.cyan)} position={[0.79, 0.5, z]}>
          <sphereGeometry args={[0.03, 8, 8]} />
        </mesh>
      ))}
      <Wheel r={0.38} w={0.24} position={[-0.38, 0.38, 0.42]} />
      <Wheel r={0.38} w={0.24} position={[-0.38, 0.38, -0.42]} />
      <Wheel r={0.22} w={0.16} position={[0.55, 0.22, 0.36]} />
      <Wheel r={0.22} w={0.16} position={[0.55, 0.22, -0.36]} />
    </group>
  ),
  crawler: ({ accent }) => (
    <group position={[0, -0.3, 0]}>
      <mesh material={toon('#d8d2c4')} position={[0, 0.5, 0]}>
        <boxGeometry args={[1.0, 0.22, 0.6]} />
      </mesh>
      {/* rocker-bogie style legs */}
      {[0.38, -0.38].map((z) =>
        [-0.45, 0, 0.45].map((x) => (
          <group key={`${x}${z}`}>
            <Beam a={[x * 0.6, 0.45, z * 0.75]} b={[x, 0.16, z]} w={0.04} material={toon('#5a5560')} />
            <Wheel r={0.14} w={0.1} position={[x, 0.14, z]} />
          </group>
        )),
      )}
      <Beam a={[0.3, 0.6, 0]} b={[0.3, 1.05, 0]} w={0.05} round material={toon('#5a5560')} />
      <mesh material={toon('#d8d2c4')} position={[0.3, 1.1, 0]}>
        <boxGeometry args={[0.18, 0.12, 0.26]} />
      </mesh>
      <mesh material={flat('#1d1a24')} position={[0.4, 1.1, 0.05]}>
        <sphereGeometry args={[0.035, 10, 10]} />
      </mesh>
      {/* extinguisher canister */}
      <mesh material={toon(accent)} position={[-0.25, 0.8, 0]}>
        <capsuleGeometry args={[0.1, 0.3, 4, 12]} />
      </mesh>
      <mesh material={toon('#2a2830')} position={[-0.25, 1.06, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
      </mesh>
    </group>
  ),
  probe: ({ accent, animate }) => <Probe accent={accent} animate={animate} />,
  eeg: ({ accent, animate }) => <Eeg accent={accent} animate={animate} />,
  doorbell: ({ accent }) => (
    <group>
      <mesh material={toon('#d9cfbd')} position={[0, 0, -0.08]}>
        <boxGeometry args={[1.4, 1.6, 0.1]} />
      </mesh>
      <mesh material={toon('#2a2830')} position={[0, 0, 0.02]}>
        <capsuleGeometry args={[0.24, 0.6, 6, 18]} />
      </mesh>
      <mesh material={toon('#111014')} position={[0, 0.3, 0.2]}>
        <sphereGeometry args={[0.1, 16, 12]} />
      </mesh>
      <mesh material={flat(accent)} position={[0, 0.3, 0.27]}>
        <sphereGeometry args={[0.035, 10, 8]} />
      </mesh>
      <mesh material={flat(accent)} position={[0, -0.25, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.11, 0.022, 8, 24]} />
      </mesh>
      <mesh material={toon('#f1ece2')} position={[0, 0.05, 0.22]}>
        <sphereGeometry args={[0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  ),
  assistant: ({ accent }) => (
    <group>
      <mesh material={toon('#26242b')}>
        <boxGeometry args={[0.8, 1.5, 0.08]} />
      </mesh>
      <mesh material={toon('#f3e9d7')} position={[0, 0, 0.045]}>
        <planeGeometry args={[0.7, 1.32]} />
      </mesh>
      {[
        [-0.08, 0.42, 0.48, '#d7cdb9'],
        [0.08, 0.18, 0.48, accent],
        [-0.08, -0.08, 0.4, '#d7cdb9'],
        [0.08, -0.32, 0.48, accent],
      ].map(([x, y, w, c], i) => (
        <mesh key={i} material={toon(c as string)} position={[x as number, y as number, 0.06]}>
          <boxGeometry args={[w as number, 0.16, 0.02]} />
        </mesh>
      ))}
      {/* scales of justice */}
      <group position={[0.75, 0.2, 0]}>
        <Beam a={[0, -0.5, 0]} b={[0, 0.3, 0]} w={0.04} round material={toon('#c9a54a')} />
        <Beam a={[-0.3, 0.25, 0]} b={[0.3, 0.25, 0]} w={0.03} round material={toon('#c9a54a')} />
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} material={toon('#c9a54a')} position={[x, 0.05, 0]}>
            <cylinderGeometry args={[0.12, 0.06, 0.05, 14]} />
          </mesh>
        ))}
      </group>
    </group>
  ),
  scanner: ({ accent, animate }) => <Scanner accent={accent} animate={animate} />,
  lora: ({ accent, animate }) => <Lora accent={accent} animate={animate} />,
  lock: ({ accent }) => (
    <group>
      <mesh material={toon('#2a2830')} position={[0, -0.15, 0]}>
        <boxGeometry args={[0.8, 0.7, 0.3]} />
      </mesh>
      <mesh material={toon('#b8b4ae')} position={[0, 0.3, 0]}>
        <torusGeometry args={[0.26, 0.06, 10, 24, Math.PI]} />
      </mesh>
      <mesh material={flat(accent)} position={[0, -0.12, 0.16]}>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 12]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={i < 3 ? flat(accent) : toon('#4a4752')} position={[-0.3 + i * 0.2, -0.75, 0]}>
          <boxGeometry args={[0.16, 0.08, 0.08]} />
        </mesh>
      ))}
    </group>
  ),
}

function Probe({ accent, animate }: MP) {
  const ref = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (ref.current && animate) ref.current.position.y = -0.3 + Math.sin(s.clock.elapsedTime * 1.2) * 0.05
  })
  return (
    <group>
      {/* ship hull section and water line */}
      <mesh material={toon('#3d4658')} position={[0, 0.85, 0]}>
        <boxGeometry args={[1.8, 0.35, 0.8]} />
      </mesh>
      <mesh material={toon('#4f8a8b', { transparent: true, opacity: 0.55 })} position={[0, 0.45, 0]}>
        <boxGeometry args={[2.2, 0.02, 1.2]} />
      </mesh>
      <Beam a={[0, 0.68, 0]} b={[0, -0.05, 0]} w={0.015} material={toon('#1d1a24')} />
      <group ref={ref}>
        <mesh material={toon(accent)} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.16, 0.6, 6, 16]} />
        </mesh>
        <mesh material={toon('#26242b')} position={[0.46, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.12, 0.08, 12]} />
        </mesh>
        {[-0.15, 0.1].map((x) => (
          <mesh key={x} material={flat(palette.cyan)} position={[x, -0.16, 0.08]}>
            <sphereGeometry args={[0.03, 8, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Eeg({ accent, animate }: MP) {
  const wave = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!wave.current || !animate) return
    wave.current.children.forEach((c, i) => {
      c.scale.y = 0.4 + Math.abs(Math.sin(s.clock.elapsedTime * 3 + i * 0.7)) * 1.4
    })
  })
  return (
    <group>
      <mesh material={toon('#d9cfbd')} position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.5, 24, 18]} />
      </mesh>
      <mesh material={toon('#2a2830')} position={[0, 0.25, 0]} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[0.5, 0.035, 8, 32]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return (
          <mesh key={i} material={flat(accent)} position={[Math.cos(a) * 0.46, 0.38 + Math.sin(a) * 0.12, Math.sin(a) * 0.46 - 0.05]}>
            <sphereGeometry args={[0.045, 8, 8]} />
          </mesh>
        )
      })}
      <group ref={wave} position={[0, -0.75, 0.2]}>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} material={flat(accent)} position={[-0.6 + i * 0.12, 0, 0]}>
            <boxGeometry args={[0.05, 0.16, 0.05]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Scanner({ accent, animate }: MP) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (ring.current && animate) ring.current.position.y = -0.55 + ((s.clock.elapsedTime * 0.5) % 1) * 1.3
  })
  return (
    <group>
      {[-0.45, -0.05, 0.35].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh material={toon('#26242b')}>
            <boxGeometry args={[0.9, 0.34, 0.6]} />
          </mesh>
          {[-0.3, -0.18].map((x) => (
            <mesh key={x} material={flat(palette.cyan)} position={[x, 0, 0.31]}>
              <boxGeometry args={[0.06, 0.04, 0.01]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh ref={ring} material={flat(accent, 0.8)} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.015, 6, 48]} />
      </mesh>
    </group>
  )
}

function Lora({ accent, animate }: MP) {
  const pulses = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!pulses.current || !animate) return
    pulses.current.children.forEach((c, i) => {
      const t = (s.clock.elapsedTime * 0.6 + i / 3) % 1
      c.position.x = -0.8 + t * 1.6
      c.scale.setScalar(0.4 + t)
      ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - t
    })
  })
  const board = (x: number, label: 'tx' | 'rx') => (
    <group position={[x, -0.2, 0]}>
      <mesh material={toon('#c99a4e')}>
        <boxGeometry args={[0.7, 0.05, 0.8]} />
      </mesh>
      <mesh material={toon('#1d1a24')} position={[-0.1, 0.06, 0.15]}>
        <boxGeometry args={[0.28, 0.06, 0.42]} />
      </mesh>
      <mesh material={toon('#3a69a8')} position={[0.18, 0.06, -0.2]}>
        <boxGeometry args={[0.22, 0.05, 0.22]} />
      </mesh>
      {label === 'rx' && (
        <mesh material={flat(palette.cyan)} position={[0.18, 0.07, 0.2]}>
          <boxGeometry args={[0.22, 0.04, 0.14]} />
        </mesh>
      )}
      <Beam a={[0.25, 0.05, -0.3]} b={[0.25, 0.7, -0.3]} w={0.02} round material={toon('#1d1a24')} />
    </group>
  )
  return (
    <group>
      {board(-0.9, 'tx')}
      {board(0.9, 'rx')}
      <group ref={pulses} position={[0, 0.4, -0.3]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={new THREE.MeshBasicMaterial({ color: accent, transparent: true })} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.15, 0.012, 6, 24]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
