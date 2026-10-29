import { useMemo, useRef } from 'react'
import { Atmosphere } from '../world/SceneContext'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { Character, createActor } from '../character/Character'
import { Cycle, createCycleControls, cycleParts, type CyclePart } from '../world/props/Cycle'
import { Beam } from '../world/props/Beam'
import { TextBoard } from '../world/props/environment'
import { chapterIndexById } from '../content/chapters'
import { localTime, useStore } from '../state/store'
import { lerp, range, smooth } from '../utils/canvasTexture'
import { flat, palette, toon } from '../utils/materials'

const CH = chapterIndexById('cycle-workshop')
type V3 = [number, number, number]

/** Side-elevation sketch of the cycle as line segments (x along the frame, y up). */
function sketchSegments(): V3[] {
  const segs: V3[] = []
  const add = (a: [number, number], b: [number, number]) => segs.push([a[0], a[1], 0], [b[0], b[1], 0])
  const circle = (cx: number, cy: number, r: number, n = 22) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      add([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r])
    }
  }
  circle(0.64, 0.355, 0.355)
  circle(-0.54, 0.355, 0.355)
  circle(-2.1, 0.17, 0.17, 14)
  const poly = (pts: [number, number][]) => pts.slice(1).forEach((p, i) => add(pts[i], p))
  poly([[0.42, 0.96], [-0.02, 0.35], [-0.54, 0.355], [-0.4, 0.82], [0.42, 0.88]])
  poly([[0.4, 0.99], [0.05, 0.94], [-0.06, 0.78], [0.16, 0.6], [0.37, 0.72], [0.4, 0.99]])
  poly([[0.43, 1.2], [0.64, 0.355]])
  poly([[0.3, 1.27], [0.43, 1.2]])
  poly([[-0.55, 0.95], [0.05, 0.95]])
  poly([[-0.36, 0.86], [-0.86, 0.86], [-0.56, 0.47], [-0.36, 0.86]])
  poly([[-0.86, 0.8], [-1.08, 0.8], [-1.12, 0.24], [-1.98, 0.24], [-2.12, 0.46]])
  circle(-0.02, 0.33, 0.1, 12)
  return segs
}

/** Chapter 05 — a lamp-lit warehouse where the electric cycle goes from sketch to machine. */
export default function WorkshopScene() {
  const quality = useStore((s) => s.quality)
  const reduced = useStore((s) => s.reducedMotion)
  const actor = useMemo(() => createActor({ pose: 'work', x: -5.2, z: -2.7, rotY: Math.PI * 0.78 }), [])
  const controls = useMemo(createCycleControls, [])
  const wireCtl = useMemo(createCycleControls, [])
  const wireMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: palette.cyan, wireframe: true, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    [],
  )
  const wireGroup = useRef<THREE.Group>(null)
  const sketchRef = useRef<{ geometry: { instanceCount: number } } | null>(null)
  const segs = useMemo(sketchSegments, [])
  const spot = useRef<THREE.SpotLight>(null)

  useFrame((state, dt) => {
    const u = localTime(CH)

    // Sketch draws itself, then the CAD wireframe spins up and the parts fly in.
    const drawn = range(u, 0.02, 0.17)
    if (sketchRef.current) sketchRef.current.geometry.instanceCount = Math.floor((segs.length / 2) * drawn)

    const wireIn = range(u, 0.15, 0.24)
    const wireOut = range(u, 0.46, 0.58)
    wireMat.opacity = 0.85 * wireIn * (1 - wireOut)
    if (wireGroup.current) {
      wireGroup.current.visible = wireMat.opacity > 0.01
      wireGroup.current.position.y = lerp(1.0, 0, smooth(range(u, 0.3, 0.45)))
      wireGroup.current.rotation.y = lerp(Math.PI * 2, 0, smooth(range(u, 0.15, 0.45)))
    }
    cycleParts.forEach((p: CyclePart, i) => {
      const start = 0.4 + i * 0.04
      controls.assemble[p] = smooth(range(u, start, start + 0.09))
    })
    // wheels turn on the stand during the reveal
    if (!reduced && u > 0.62) {
      controls.spin += dt * 2.2
      controls.crank += dt * 2.2
    }

    // Character: drafting board → walk to the stand → build → step back, proud.
    if (u < 0.2) {
      actor.pose = 'work'
      actor.next = undefined
      actor.x = -5.2
      actor.z = -2.7
      actor.rotY = Math.PI * 0.78
    } else if (u < 0.36) {
      const k = smooth(range(u, 0.2, 0.36))
      actor.pose = 'walk'
      actor.phase = k * 8 * Math.PI
      actor.x = lerp(-5.2, 0.1, k)
      actor.z = lerp(-2.7, 1.05, k)
      actor.rotY = Math.atan2(5.3, 3.75)
    } else if (u < 0.8) {
      actor.pose = 'idle'
      actor.next = 'work'
      actor.blend = smooth(range(u, 0.36, 0.42))
      actor.x = 0.1
      actor.z = 1.05
      actor.rotY = lerp(Math.atan2(5.3, 3.75), Math.PI, smooth(range(u, 0.36, 0.42)))
    } else {
      const k = smooth(range(u, 0.8, 0.88))
      actor.pose = 'work'
      actor.next = 'proud'
      actor.blend = k
      actor.x = lerp(0.1, 1.25, k)
      actor.z = lerp(1.05, 1.0, k)
      actor.rotY = lerp(Math.PI, 0.35, k)
    }

    if (spot.current) spot.current.intensity = lerp(40, 90, smooth(range(u, 0.6, 0.75)))
    void state
  })

  const lamps: V3[] = [
    [-4, 6.4, -3],
    [0, 6.4, 0],
    [5, 6.4, -2],
    [-7, 6.4, 3],
  ]

  return (
    <>
      <Atmosphere background="#24212a" fog={['#2a262f', 14, 40]} shadowTint="#6f6680" rim="#ffd8a6" rimStrength={0.28} />
      <hemisphereLight args={['#ffe2bd', '#3a3240', 0.85]} />
      <directionalLight position={[-6, 9, 6]} intensity={0.9} color="#c9d6ff" />
      <spotLight
        ref={spot}
        position={[0, 6.2, 0.5]}
        angle={0.6}
        penumbra={0.6}
        intensity={40}
        decay={1.5}
        color="#ffd8a6"
        castShadow={quality !== 'low'}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <pointLight position={[-4, 3.2, -2.4]} intensity={14} distance={9} decay={1.6} color="#ffd8a6" />

      {/* shell: concrete floor with painted bay lines, walls, columns, trusses */}
      <mesh material={toon('#8e8780')} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 20]} />
      </mesh>
      {[
        [0, 0.004, 2.2, 6.4, 0.08],
        [0, 0.004, -2.2, 6.4, 0.08],
        [3.2, 0.004, 0, 0.08, 4.4],
        [-3.2, 0.004, 0, 0.08, 4.4],
      ].map(([x, y, z, w, d], i) => (
        <mesh key={i} material={toon('#e3b448')} position={[x, y, z]}>
          <boxGeometry args={[w, 0.005, d]} />
        </mesh>
      ))}
      <mesh material={toon('#5f5a58')} position={[0, 4, -8]} receiveShadow>
        <boxGeometry args={[26, 8, 0.3]} />
      </mesh>
      <mesh material={toon('#57525a')} position={[-12, 4, 0]}>
        <boxGeometry args={[0.3, 8, 20]} />
      </mesh>
      <mesh material={toon('#57525a')} position={[12, 4, 0]}>
        <boxGeometry args={[0.3, 8, 20]} />
      </mesh>
      {/* corrugation lines and high windows on the back wall */}
      {Array.from({ length: 26 }, (_, i) => (
        <mesh key={i} material={toon('#4c4850')} position={[-12.5 + i, 4, -7.83]}>
          <boxGeometry args={[0.05, 8, 0.04]} />
        </mesh>
      ))}
      {[-8, -3, 2, 7].map((x) => (
        <mesh key={x} material={flat('#9fb6d6', 1, 'ws-window')} position={[x, 6.4, -7.82]}>
          <planeGeometry args={[3.4, 1.2]} />
        </mesh>
      ))}
      {[-9, -3, 3, 9].map((x) => (
        <group key={x}>
          <mesh material={toon('#3b3a44')} position={[x, 4, -7.6]}>
            <boxGeometry args={[0.35, 8, 0.35]} />
          </mesh>
          <Beam a={[x, 7.6, -7.6]} b={[x, 7.6, 8]} w={0.22} material={toon('#3b3a44')} />
        </group>
      ))}

      {/* pendant lamps */}
      {lamps.map((p, i) => (
        <group key={i} position={p}>
          <Beam a={[0, 0, 0]} b={[0, 1.6, 0]} w={0.02} round material={toon('#1d1a24')} />
          <mesh material={toon('#3d5f5f')} position={[0, -0.1, 0]}>
            <coneGeometry args={[0.45, 0.35, 16, 1, true]} />
          </mesh>
          <mesh material={flat('#fff1c9')} position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.12, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* back-wall benches, pegboard, tube rack */}
      <group position={[4.5, 0, -7]}>
        <mesh material={toon(palette.wood)} position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[5, 0.12, 1.1]} />
        </mesh>
        <mesh material={toon('#3b3a44')} position={[0, 0.45, 0]}>
          <boxGeometry args={[4.8, 0.9, 1]} />
        </mesh>
        <mesh material={toon('#c9a87a')} position={[0, 2.4, -0.45]}>
          <boxGeometry args={[4.6, 2, 0.06]} />
        </mesh>
        {[-1.8, -1.2, -0.5, 0.3, 1.0, 1.7].map((x, i) => (
          <mesh key={x} material={toon(['#2a2830', palette.sunset, '#5a5560', palette.teal, '#2a2830', '#b8b4ae'][i])} position={[x, 2.4 + (i % 2) * 0.35, -0.4]} rotation={[0, 0, i * 0.4]}>
            <boxGeometry args={[0.08, 0.7, 0.04]} />
          </mesh>
        ))}
        <mesh material={toon('#d43c3c')} position={[-1.4, 1.1, 0.1]}>
          <boxGeometry args={[0.7, 0.3, 0.4]} />
        </mesh>
        <mesh material={toon('#e3b448')} position={[1.2, 1.05, 0.2]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.25, 0.18, 0.35]} />
        </mesh>
      </group>
      <group position={[-9.5, 0, -5]}>
        {[0.6, 1.2, 1.8].map((y) => (
          <Beam key={y} a={[-0.8, y, 0]} b={[0.8, y, 0]} w={0.06} material={toon('#3b3a44')} />
        ))}
        {[-0.3, -0.1, 0.1, 0.3].map((z) => (
          <Beam key={z} a={[-1, 1.25, z]} b={[3, 1.25, z]} w={0.05} round material={toon('#b8b4ae')} />
        ))}
      </group>
      <TextBoard
        id="ws-banner"
        position={[-2, 4.6, -7.8]}
        width={5}
        height={0.9}
        bg={palette.ink}
        fg={palette.paper}
        accent={palette.sunset}
        frame={null}
        lines={[{ text: 'CARGO-CUM-COMMUTE  ·  E-CYCLE LAB', size: 120 }]}
      />

      {/* drafting table with the self-drawing sketch */}
      <group position={[-4, 0, -3.2]}>
        <mesh material={toon(palette.wood)} position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[2.0, 0.06, 1.1]} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} material={toon('#3b3a44')} position={[x, 0.42, 0]}>
            <boxGeometry args={[0.06, 0.84, 1.0]} />
          </mesh>
        ))}
        <group position={[0, 1.25, 0.05]} rotation={[-0.62, 0, 0]}>
          <mesh material={toon('#fbf5e8')}>
            <boxGeometry args={[1.9, 1.2, 0.03]} />
          </mesh>
          <group position={[0.55, -0.42, 0.02]} scale={0.62}>
            <Line ref={sketchRef as never} points={segs} segments color={palette.ink} lineWidth={1.8} />
          </group>
        </group>
      </group>

      {/* assembly stand + the cycle */}
      <mesh material={toon('#3b3a44')} position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[1.8, 1.8, 0.04, 40]} />
      </mesh>
      <group position={[0.4, 0.04, 0]}>
        <Cycle controls={controls} />
        <group ref={wireGroup}>
          <Cycle controls={wireCtl} wire={wireMat} />
        </group>
      </group>

      <Character actor={actor} />
    </>
  )
}
