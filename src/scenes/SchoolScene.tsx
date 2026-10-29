import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Character, createActor } from '../character/Character'
import { PoleLine, Road, SkyDome, TextBoard, type SkyUniforms } from '../world/props/environment'
import { Townhouse, type TownhouseSpec } from '../world/kit/Townhouse'
import { TreeInstances } from '../world/kit/Trees'
import { StreetProps, type PropItem } from '../world/kit/StreetProps'
import { Atmosphere, useActiveRef } from '../world/SceneContext'
import { chapterIndexById } from '../content/chapters'
import { localTime, story, useStore } from '../state/store'
import { lerp, range, rng, smooth } from '../utils/canvasTexture'
import { palette, toon } from '../utils/materials'
import { schooling } from '../content/profile'

const CH = chapterIndexById('school-years')
const PATH_X = 1.2
const BOARD_X = 4.4

/** Walk choreography: [t, z] keys; stops at each noticeboard. */
const walk: [number, number][] = [
  [0, 4],
  [0.05, 4],
  [0.25, -7],
  [0.4, -7],
  [0.55, -17],
  [0.68, -17],
  [1, -40],
]

function zAt(t: number) {
  for (let i = 0; i < walk.length - 1; i++) {
    const [ta, za] = walk[i]
    const [tb, zb] = walk[i + 1]
    if (t <= tb) return lerp(za, zb, smooth(range(t, ta, tb)))
  }
  return walk[walk.length - 1][1]
}

/** Chapter 02 — a sunlit lane of tiled roofs, poles and shop signs leading to the school gate. */
export default function SchoolScene() {
  const quality = useStore((s) => s.quality)
  const actor = useMemo(() => createActor({ pose: 'walk', x: PATH_X, z: 4, rotY: Math.PI }), [])
  const sun = useRef<THREE.DirectionalLight>(null)
  const sky = useRef<SkyUniforms | null>(null)

  const active = useActiveRef()

  const houses = useMemo(() => {
    const walls = ['#ece0c6', '#f0c9a6', '#e3d2b0', '#dba8a0', '#cfd8c4', '#e9c9a0', '#d6dde0', '#efe4d0']
    const roofs = [palette.teal, palette.brick, '#5d6a8a', '#6f8b6a', '#8a5a4a', '#4d6f78']
    const accents = [palette.sunset, palette.teal, '#5d6a8a', palette.brick, '#c9a54a']
    const shops = ['TEA STALL', 'BOOKS', 'CYCLES', 'PRINTS', 'BAKERY', 'TAILOR']
    const r = rng(404)
    const out: { pos: THREE.Vector3Tuple; rot: number; spec: TownhouseSpec }[] = []
    let i = 0
    for (const side of [-1, 1]) {
      let z = 10
      while (z > -36) {
        const w = 5.2 + r() * 1.4
        z -= w / 2
        const floors = r() < 0.3 ? 3 : 2
        const shop = r() < 0.38 ? shops[i % shops.length] : undefined
        out.push({
          pos: [side * 9.2, 0, z],
          rot: side < 0 ? Math.PI / 2 : -Math.PI / 2,
          spec: {
            w,
            d: 6,
            floors,
            wall: walls[i % walls.length],
            roof: roofs[(i * 3) % roofs.length],
            accent: accents[i % accents.length],
            roofType: r() < 0.25 ? 'flat' : 'gable',
            shop,
            seed: 500 + i,
          },
        })
        z -= w / 2 + 0.35
        i++
      }
    }
    return out
  }, [])

  const props = useMemo<PropItem[]>(() => {
    const items: PropItem[] = []
    for (let z = 6; z > -30; z -= 9) items.push({ type: 'manhole', x: -1.2, z })
    items.push({ type: 'crosswalk', x: 0, z: -29.5, w: 7, rot: Math.PI / 2 })
    items.push({ type: 'mirror', x: -4.4, z: -28, rot: Math.PI * 0.7 })
    items.push({ type: 'mirror', x: 4.6, z: 2, rot: -Math.PI * 0.6 })
    ;[-3, -21].forEach((z) => items.push({ type: 'vending', x: -5.6, z, rot: Math.PI / 2 }))
    items.push({ type: 'vending', x: 5.7, z: -12.5, rot: -Math.PI / 2 })
    ;[1, -14, -25].forEach((z) => items.push({ type: 'bin', x: 5.5, z, rot: 0 }))
    ;[-9, -16].forEach((z) => items.push({ type: 'cabinet', x: -5.7, z, rot: Math.PI / 2 }))
    ;[-30.5, -31.5].forEach((z) => items.push({ type: 'cone', x: -2.4, z }))
    for (let z = -28; z < -21; z += 2) items.push({ type: 'bollard', x: 3.7, z })
    items.push({ type: 'bikerack', x: -5.4, z: 7, rot: Math.PI / 2 })
    items.push({ type: 'planter', x: 5.6, z: -6, rot: Math.PI / 2 })
    items.push({ type: 'planter', x: -5.6, z: -12, rot: Math.PI / 2 })
    items.push({ type: 'hydrant', x: 5.5, z: 5 })
    return items
  }, [])

  const trees = useMemo(
    () => ({
      blossom: [6, -11, -24].map((z, i) => ({ x: i % 2 ? -5.9 : 5.9, z, scale: 0.9 })),
      broad: [
        { x: -14, z: -2, scale: 1.4 },
        { x: 15, z: -18, scale: 1.5 },
        { x: -15, z: -26, scale: 1.3 },
        { x: -8, z: -40, scale: 1.6 },
        { x: 10, z: -42, scale: 1.4 },
        { x: 16, z: 4, scale: 1.2 },
      ],
      shrub: [-33.6, -33.6].map((z, i) => ({ x: i ? 4.4 : -2.0, z, scale: 0.9 })),
    }),
    [],
  )

  useFrame(() => {
    if (!active.current) return
    const t = localTime(CH)
    const z = zAt(t)
    const dz = Math.abs(zAt(Math.min(1, t + 0.004)) - z)
    const moving = dz > 0.002
    actor.z = z
    actor.phase = (-z / 1.35) * Math.PI
    actor.pose = moving ? 'walk' : 'idle'
    actor.next = 'stopLook'
    actor.blend = moving ? 0 : 1
    actor.rotY = Math.PI
    story.anchor.x = PATH_X
    story.anchor.y = 0
    story.anchor.z = z

    // Time-lapse: the sun slides lower and warmer as the years pass.
    const s = sun.current
    if (s) {
      const a = lerp(0.9, 0.38, t)
      s.position.set(PATH_X + Math.cos(a) * 18, Math.sin(a) * 22, z + 10)
      s.target.position.set(PATH_X, 0, z - 6)
      s.target.updateMatrixWorld()
      s.color.setHSL(lerp(0.1, 0.06, t), 0.8, lerp(0.82, 0.72, t))
    }
    if (sky.current) {
      sky.current.uHorizon.value.setHSL(lerp(0.09, 0.05, t), 0.75, lerp(0.8, 0.72, t))
    }
  })

  return (
    <>
      <SkyDome colors={{ top: '#7fb3c4', horizon: '#f6cfa4', bottom: '#b9a58c' }} uniformsRef={sky} clouds={0.55} />
      <Atmosphere fog={['#f0d2ae', 40, 130]} shadowTint="#8e9cc4" rim="#ffe6c8" rimStrength={0.16} />
      <hemisphereLight args={['#dfeaf2', '#8a7360', 1.1]} />
      <directionalLight
        ref={sun}
        intensity={2.6}
        castShadow={quality !== 'low'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-far={80}
        shadow-bias={-0.0006}
      />

      <Road zFrom={14} zTo={-60} width={7} walk={2.6} />
      {houses.map((h, i) => (
        <Townhouse key={i} position={h.pos} rotation={h.rot} spec={h.spec} />
      ))}
      <PoleLine start={10} end={-34} count={6} x={-4.6} />
      <TreeInstances kind="blossom" seed={7} items={trees.blossom} />
      <TreeInstances kind="broad" seed={3} items={trees.broad} />
      <TreeInstances kind="shrub" seed={5} items={trees.shrub} />
      <StreetProps items={props} />

      {/* Noticeboards with the verified milestones */}
      {schooling.map((s, i) => (
        <group key={s.id} position={[BOARD_X, 0, i === 0 ? -8 : -18]} rotation={[0, -Math.PI / 2, 0]}>
          {[-0.95, 0.95].map((x) => (
            <mesh key={x} material={toon('#5b4031')} position={[x, 0.9, -0.05]}>
              <boxGeometry args={[0.1, 1.8, 0.1]} />
            </mesh>
          ))}
          <TextBoard
            id={`school-${s.id}`}
            position={[0, 1.75, 0]}
            width={2.1}
            height={1.45}
            lines={[
              { text: s.label.toUpperCase(), size: 74 },
              { text: s.score, size: 120, color: 'accent' },
              { text: s.date.toUpperCase(), size: 44, font: 'mono' },
              { text: 'Velammal Matriculation School', size: 25, font: 'body' },
            ]}
          />
          <mesh material={toon(palette.brick)} position={[0, 2.62, 0.05]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[2.4, 0.08, 0.5]} />
          </mesh>
        </group>
      ))}

      {/* School gate and building */}
      <group position={[PATH_X, 0, -33]}>
        {[-3.2, 3.2].map((x) => (
          <mesh key={x} material={toon('#d9cdb6')} position={[x, 1.4, 0]} castShadow>
            <boxGeometry args={[0.7, 2.8, 0.7]} />
          </mesh>
        ))}
        <TextBoard
          id="school-gate"
          position={[0, 3.2, 0.1]}
          width={5.6}
          height={0.6}
          bg="#2f4a52"
          fg="#f3e9d7"
          frame={palette.ink}
          lines={[{ text: 'VELAMMAL MATRICULATION SCHOOL', size: 82 }]}
        />
      </group>
      <group position={[PATH_X, 0, -46]}>
        <mesh material={toon('#ead9b8')} position={[0, 5, 0]} castShadow receiveShadow>
          <boxGeometry args={[30, 10, 6]} />
        </mesh>
        <mesh material={toon(palette.teal)} position={[0, 10.2, 0]}>
          <boxGeometry args={[31, 0.4, 7]} />
        </mesh>
        {[0, 1, 2].map((f) =>
          [-12, -8, -4, 4, 8, 12].map((x) => (
            <mesh key={`${f}${x}`} material={toon('#5f7e8c')} position={[x, 1.8 + f * 3, 3.02]}>
              <planeGeometry args={[2.4, 1.5]} />
            </mesh>
          )),
        )}
        {/* clock */}
        <mesh material={toon('#f6efe0')} position={[0, 8.2, 3.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.9, 0.9, 0.1, 24]} />
        </mesh>
        <mesh material={toon(palette.ink)} position={[0.25, 8.35, 3.12]} rotation={[0, 0, -0.9]}>
          <boxGeometry args={[0.06, 0.6, 0.02]} />
        </mesh>
        {/* the doorway the camera walks into */}
        <mesh material={toon('#2a2430')} position={[0, 1.7, 3.0]}>
          <boxGeometry args={[2.6, 3.4, 0.2]} />
        </mesh>
        <mesh material={toon('#16131a')} position={[0, 1.6, 1.2]}>
          <boxGeometry args={[2.2, 3.2, 3.4]} />
        </mesh>
      </group>

      <Character actor={actor} />
    </>
  )
}
