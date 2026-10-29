import { useMemo, useRef } from 'react'
import { Atmosphere } from '../world/SceneContext'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Character, createActor } from '../character/Character'
import { Road, SkyDome, StreetLamp, type SkyUniforms } from '../world/props/environment'
import { TowerField, useTowerMaterials, type TowerPlacement } from '../world/kit/Towers'
import { TreeInstances } from '../world/kit/Trees'
import { chapterIndexById } from '../content/chapters'
import { localTime, story, useStore } from '../state/store'
import { canvasTexture, fonts, lerp, range, rng, smooth } from '../utils/canvasTexture'
import { flat, palette, toon } from '../utils/materials'
import { Beam } from '../world/props/Beam'

const CH_WORK = chapterIndexById('college-workspace')
const CH_NIGHT = chapterIndexById('night-flyer')

/** Exit path from the desk, through the door, to the flyer wall: [x, z]. */
const exitPath: [number, number][] = [
  [0, -1.78],
  [-2.2, -1.6],
  [-3.5, -0.8],
  [-3.5, 0.7],
  [-5.0, 1.35],
  [-6.0, 1.25],
]

function pathPoint(u: number) {
  const segs = exitPath.length - 1
  const f = Math.min(segs - 0.0001, Math.max(0, u * segs))
  const i = Math.floor(f)
  const k = f - i
  const [ax, az] = exitPath[i]
  const [bx, bz] = exitPath[i + 1]
  return { x: lerp(ax, bx, k), z: lerp(az, bz, k), dir: Math.atan2(bx - ax, bz - az) }
}

function screenTexture() {
  return canvasTexture('laptop-code', 512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#121626'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1d2340'
    ctx.fillRect(0, 0, w, 26)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(16 + i * 18, 13, 5, 0, Math.PI * 2)
      ctx.fill()
    })
    const lines: [string, string][] = [
      ['#c58bff', 'import machine, time'],
      ['#8a93b8', '# read the sensor, log the value'],
      ['#2de2e6', 'def read_sensor(pin):'],
      ['#f3e9d7', '    adc = machine.ADC(pin)'],
      ['#f3e9d7', '    return adc.read()'],
      ['#8a93b8', ''],
      ['#2de2e6', 'while True:'],
      ['#f3e9d7', '    v = read_sensor(34)'],
      ['#ffb547', '    print("value:", v)'],
      ['#f3e9d7', '    time.sleep(0.5)'],
      ['#7cf2c9', '>>> value: 2048_'],
    ]
    ctx.font = `500 21px ${fonts.mono}`
    lines.forEach(([c, t], i) => {
      ctx.fillStyle = c
      ctx.fillText(t, 18, 54 + i * 24)
    })
    void h
  })
}

function flyerTexture() {
  return canvasTexture('bcdc-flyer', 600, 840, (ctx, w, h) => {
    ctx.fillStyle = '#fff6e2'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = palette.sunset
    ctx.fillRect(0, 0, w, 230)
    ctx.fillStyle = palette.ink
    ctx.textAlign = 'center'
    ctx.font = `900 92px ${fonts.display}`
    ctx.fillText('BHARATH', w / 2, 100)
    ctx.font = `900 64px ${fonts.display}`
    ctx.fillText('CYCLE DESIGN', w / 2, 168)
    ctx.fillText('CHALLENGE', w / 2, 222)
    // a cycle doodle
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    const wheel = (x: number) => {
      ctx.beginPath()
      ctx.arc(x, 520, 92, 0, Math.PI * 2)
      ctx.stroke()
    }
    wheel(170)
    wheel(430)
    ctx.beginPath()
    ctx.moveTo(170, 520)
    ctx.lineTo(270, 400)
    ctx.lineTo(390, 400)
    ctx.lineTo(430, 520)
    ctx.moveTo(270, 400)
    ctx.lineTo(300, 520)
    ctx.lineTo(390, 400)
    ctx.moveTo(390, 400)
    ctx.lineTo(375, 345)
    ctx.lineTo(420, 340)
    ctx.moveTo(250, 380)
    ctx.lineTo(300, 380)
    ctx.stroke()
    ctx.font = `600 54px ${fonts.hand}`
    ctx.fillStyle = palette.ink
    ctx.fillText('Design it. Build it. Ride it.', w / 2, 700)
    ctx.font = `500 30px ${fonts.mono}`
    ctx.fillStyle = '#6c6152'
    ctx.fillText('NATIONAL LEVEL · AICTE', w / 2, 780)
  })
}

function skylineSpecs(): TowerPlacement[] {
  const r = rng(12)
  const colors = ['#e2d2b6', '#d5c2a6', '#ecdcbc', '#c8b8a2', '#dcc5a8', '#c9cfd6']
  const out: TowerPlacement[] = []
  for (const row of [22, 34, 50, 68]) {
    for (let x = -70; x < 70; x += 8 + r() * 4) {
      out.push({ archetype: Math.floor(r() * 8), x, z: row + r() * 4, rot: Math.PI + (r() - 0.5) * 0.2, wall: colors[Math.floor(r() * colors.length)], glow: r() < 0.7 ? '#ffd9a0' : '#ffe9c8' })
    }
  }
  return out
}

/** Chapters 03–04 — a glass-fronted studio at golden hour that fades into night. */
export default function CollegeScene() {
  const quality = useStore((s) => s.quality)
  const actor = useMemo(() => createActor({ pose: 'type', z: -1.78, rotY: 0 }), [])
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const sky = useRef<SkyUniforms | null>(null)
  const hinge = useRef<THREE.Group>(null)
  const flap = useRef<THREE.Group>(null)
  const towerMats = useTowerMaterials()
  const specs = useMemo(skylineSpecs, [])
  const screenMat = useMemo(() => flat('#ffffff', 1, 'laptop-screen', screenTexture()), [])
  const lampMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff2c4', toneMapped: false }), [])
  const glassMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#bfe3ea', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    [],
  )
  const flyerHalves = useMemo(() => {
    // Two halves of one sheet: the top is pinned, the bottom flutters.
    const half = (v0: number) => {
      const g = new THREE.PlaneGeometry(0.6, 0.42)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * 0.5)
      return g
    }
    return { top: half(0.5), bottom: half(0) }
  }, [])
  const flyerMat = useMemo(() => toon('#ffffff', { map: flyerTexture(), side: THREE.DoubleSide }), [])
  const colors = useMemo(
    () => ({
      skyTopDay: new THREE.Color('#7fa8c8'),
      skyTopNight: new THREE.Color('#141a3c'),
      horDay: new THREE.Color('#f7b77d'),
      horNight: new THREE.Color('#3b3560'),
      sunDay: new THREE.Color('#ffc58a'),
      sunNight: new THREE.Color('#7f8cc9'),
      tmp: new THREE.Color(),
    }),
    [],
  )

  useFrame((state) => {
    const night = story.chapter >= CH_NIGHT
    const u = localTime(CH_WORK)
    const v = night ? localTime(CH_NIGHT) : 0
    const dusk = story.fx.dusk

    // ── character choreography
    let x = 0
    let z = -1.78 // chair pulled in so the hands reach the keyboard (IK target in poses.ts)
    let rotY = 0
    actor.next = undefined
    actor.blend = 0
    if (!night) {
      const turn = smooth(range(u, 0.62, 0.74))
      actor.pose = 'type'
      actor.next = 'sitWork'
      actor.blend = turn
      rotY = turn * (Math.PI / 2)
      x = turn * 0.55
    } else if (v < 0.24) {
      const back = smooth(range(v, 0, 0.12))
      actor.pose = 'sitWork'
      actor.next = 'type'
      actor.blend = back
      rotY = (1 - back) * (Math.PI / 2)
      x = (1 - back) * 0.55
    } else if (v < 0.3) {
      actor.pose = 'sit'
      actor.next = 'idle'
      actor.blend = smooth(range(v, 0.24, 0.3))
    } else if (v < 0.58) {
      const p = pathPoint(range(v, 0.3, 0.56))
      x = p.x
      z = p.z
      rotY = v < 0.56 ? p.dir : Math.PI
      actor.pose = v < 0.56 ? 'walk' : 'idle'
      actor.phase = range(v, 0.3, 0.56) * 9 * Math.PI
    } else {
      x = -6
      z = 1.25
      rotY = lerp(-Math.PI * 0.6, -Math.PI, smooth(range(v, 0.56, 0.62)))
      actor.pose = 'idle'
      actor.next = 'inspect'
      actor.blend = smooth(range(v, 0.6, 0.68))
    }
    actor.x = x
    actor.z = z
    actor.rotY = rotY

    // laptop lid closes as night arrives
    if (hinge.current) hinge.current.rotation.x = lerp(1.85, 0.02, smooth(range(v, 0.15, 0.24)))
    if (flap.current) flap.current.rotation.x = Math.sin(state.clock.elapsedTime * 2.3) * 0.12 * (useStore.getState().reducedMotion ? 0 : 1) + 0.05

    // ── lighting: golden hour → night
    if (sun.current) {
      sun.current.intensity = lerp(2.4, 0.35, dusk)
      sun.current.color.lerpColors(colors.sunDay, colors.sunNight, dusk)
    }
    if (hemi.current) hemi.current.intensity = lerp(1.0, 0.45, dusk)
    if (lamp.current) lamp.current.intensity = lerp(1.5, 9, dusk)
    const glow = lerp(0.15, 1.6, dusk)
    towerMats.winLit.color.setScalar(glow)
    towerMats.sign.color.setScalar(lerp(0.4, 1.5, dusk))
    towerMats.wall.color.setScalar(lerp(1, 0.42, dusk))
    towerMats.band.color.setScalar(lerp(0.9, 0.4, dusk))
    lampMat.color.setScalar(lerp(0.6, 1, dusk))
    if (sky.current) {
      sky.current.uTop.value.lerpColors(colors.skyTopDay, colors.skyTopNight, dusk)
      sky.current.uHorizon.value.lerpColors(colors.horDay, colors.horNight, dusk)
      sky.current.uSunSize.value = 0.035 * (1 - dusk)
      sky.current.uSun.value.set(-0.6, lerp(0.06, -0.2, dusk), 1).normalize()
    }
    screenMat.color.setScalar(v > 0.22 ? 0 : 1)
  })

  const mullions = [-8, -6, -2.9, -1, 1, 3, 5, 8]

  return (
    <>
      <SkyDome colors={{ top: '#7fa8c8', horizon: '#f7b77d', bottom: '#5a5048' }} uniformsRef={sky} clouds={0.4} cloudColor="#ffe2c4" />
      <Atmosphere fog={['#c9a58a', 50, 150]} shadowTint="#8a86b8" rim="#ffd2a0" rimStrength={0.22} />
      <hemisphereLight ref={hemi} args={['#ffe7cc', '#6c5a4c', 1]} />
      <directionalLight
        ref={sun}
        position={[-14, 6, 20]}
        intensity={2.4}
        castShadow={quality !== 'low'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0006}
      />
      <pointLight ref={lamp} position={[-0.6, 1.5, -1.4]} color="#ffcf8a" intensity={1.5} distance={8} decay={1.6} />

      {/* ── studio interior */}
      <mesh material={toon('#b49a7c')} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, -3]} receiveShadow>
        <planeGeometry args={[16, 6]} />
      </mesh>
      <mesh material={toon('#e4d6bd')} position={[0, 1.9, -6]} receiveShadow>
        <boxGeometry args={[16, 3.8, 0.2]} />
      </mesh>
      <mesh material={toon('#d8c8ad')} position={[8, 1.9, -3]}>
        <boxGeometry args={[0.2, 3.8, 6]} />
      </mesh>
      <mesh material={toon('#f0e6d4')} position={[0, 3.85, -3]}>
        <boxGeometry args={[16.4, 0.2, 6.4]} />
      </mesh>
      {/* pinboard with circuit sketches on the back wall */}
      <group position={[2.6, 1.9, -5.88]}>
        <mesh material={toon('#a8875d')}>
          <boxGeometry args={[2.6, 1.4, 0.05]} />
        </mesh>
        {[
          [-0.8, 0.3, '#fff6e2'],
          [0.1, 0.25, '#e9f3f6'],
          [0.85, 0.35, '#fff6e2'],
          [-0.4, -0.35, '#f6e1d2'],
          [0.6, -0.3, '#fff6e2'],
        ].map(([x, y, c], i) => (
          <mesh key={i} material={toon(c as string)} position={[x as number, y as number, 0.04]} rotation={[0, 0, (i - 2) * 0.05]}>
            <planeGeometry args={[0.62, 0.5]} />
          </mesh>
        ))}
      </group>
      {/* bookshelf */}
      <group position={[-6.2, 0, -5.6]}>
        <mesh material={toon(palette.wood)} position={[0, 1.1, 0]}>
          <boxGeometry args={[1.8, 2.2, 0.5]} />
        </mesh>
        {[0.5, 1.15, 1.8].map((y) =>
          [-0.6, -0.3, 0, 0.35, 0.6].map((x, i) => (
            <mesh key={`${y}${x}`} material={toon([palette.teal, palette.sunset, palette.cream, '#5d6a8a', palette.rose][i])} position={[x, y, 0.15]}>
              <boxGeometry args={[0.18, 0.42, 0.3]} />
            </mesh>
          )),
        )}
      </group>

      {/* desk, laptop, notes */}
      <group position={[0, 0, -1.1]}>
        <mesh material={toon('#cfa77a')} position={[0, 0.74, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.06, 0.8]} />
        </mesh>
        {[-0.78, 0.78].map((x) => (
          <mesh key={x} material={toon('#3b3a44')} position={[x, 0.37, 0]}>
            <boxGeometry args={[0.06, 0.74, 0.7]} />
          </mesh>
        ))}
        <group position={[0, 0.78, -0.02]}>
          <mesh material={toon('#5d6270')}>
            <boxGeometry args={[0.5, 0.02, 0.34]} />
          </mesh>
          <group ref={hinge} position={[0, 0.01, 0.16]} rotation={[1.85, 0, 0]}>
            <mesh material={toon('#5d6270')} position={[0, 0, -0.17]}>
              <boxGeometry args={[0.5, 0.015, 0.34]} />
            </mesh>
            <mesh material={screenMat} position={[0, -0.009, -0.17]} rotation={[Math.PI / 2, 0, Math.PI]}>
              <planeGeometry args={[0.46, 0.3]} />
            </mesh>
          </group>
        </group>
        {/* notebook with sketches, mug */}
        <mesh material={toon('#fff6e2')} position={[-0.5, 0.775, -0.15]} rotation={[0, 0.25, 0]}>
          <boxGeometry args={[0.36, 0.015, 0.26]} />
        </mesh>
        <mesh material={toon(palette.sunset)} position={[0.6, 0.83, 0.1]}>
          <cylinderGeometry args={[0.05, 0.045, 0.11, 12]} />
        </mesh>
        {/* desk lamp */}
        <Beam a={[-0.65, 0.77, 0.25]} b={[-0.6, 1.25, 0.1]} w={0.025} round material={toon('#2a2830')} />
        <mesh material={lampMat} position={[-0.58, 1.27, 0.0]} rotation={[0.8, 0, 0]}>
          <coneGeometry args={[0.09, 0.12, 12, 1, true]} />
        </mesh>
      </group>
      {/* chair */}
      <group position={[0, 0, -1.78]}>
        <mesh material={toon('#2f3442')} position={[0, 0.46, 0]}>
          <boxGeometry args={[0.5, 0.07, 0.5]} />
        </mesh>
        <mesh material={toon('#2f3442')} position={[0, 0.85, -0.27]}>
          <boxGeometry args={[0.5, 0.6, 0.06]} />
        </mesh>
        <mesh material={toon('#5a5560')} position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
        </mesh>
      </group>

      {/* prototyping bench: breadboard, dev boards, multimeter, soldering iron */}
      <group position={[1.75, 0, -2.4]}>
        <mesh material={toon('#8a6a4c')} position={[0, 0.78, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.85, 0.06, 1.7]} />
        </mesh>
        {[-0.38, 0.38].map((x) =>
          [-0.78, 0.78].map((z) => (
            <mesh key={`${x}${z}`} material={toon('#3b3a44')} position={[x, 0.38, z]}>
              <boxGeometry args={[0.05, 0.76, 0.05]} />
            </mesh>
          )),
        )}
        <mesh material={toon('#f2efe8')} position={[-0.05, 0.825, 0.15]}>
          <boxGeometry args={[0.3, 0.025, 0.46]} />
        </mesh>
        <mesh material={toon('#1d1a24')} position={[-0.05, 0.85, 0.02]}>
          <boxGeometry args={[0.1, 0.02, 0.2]} />
        </mesh>
        {[0.1, 0.2, 0.3].map((z, i) => (
          <mesh key={z} material={flat([palette.cyan, palette.magenta, '#ffd23f'][i])} position={[0.05, 0.85, z]}>
            <boxGeometry args={[0.012, 0.03, 0.012]} />
          </mesh>
        ))}
        <mesh material={toon('#1c5c8a')} position={[0.2, 0.83, -0.4]}>
          <boxGeometry args={[0.22, 0.02, 0.3]} />
        </mesh>
        <mesh material={toon('#e3b448')} position={[-0.2, 0.86, -0.55]}>
          <boxGeometry args={[0.16, 0.08, 0.26]} />
        </mesh>
        <Beam a={[0.25, 0.84, 0.55]} b={[-0.1, 0.86, 0.7]} w={0.02} round material={toon(palette.sunset)} />
        {/* small CAD print propped up */}
        <mesh material={toon('#e9f3f6')} position={[0.36, 1.05, 0.2]} rotation={[0, -Math.PI / 2, -0.15]}>
          <planeGeometry args={[0.4, 0.3]} />
        </mesh>
      </group>

      {/* ── glass facade with door and the flyer wall */}
      {mullions.map((x) => (
        <mesh key={x} material={toon('#3b3a44')} position={[x, 1.9, 0]}>
          <boxGeometry args={[0.1, 3.8, 0.12]} />
        </mesh>
      ))}
      <mesh material={toon('#3b3a44')} position={[2.5, 3.75, 0]}>
        <boxGeometry args={[11, 0.12, 0.14]} />
      </mesh>
      <mesh material={glassMat} position={[2.55, 1.9, 0]}>
        <planeGeometry args={[10.9, 3.8]} />
      </mesh>
      {/* glass reflections */}
      {[-0.5, 2.2, 5.6].map((x, i) => (
        <mesh key={x} material={flat('#ffffff', 0.06, 'glass-streak')} position={[x, 2.2, 0.02]} rotation={[0, 0, 0.6]}>
          <planeGeometry args={[0.08 + i * 0.05, 2.2]} />
        </mesh>
      ))}
      <mesh material={toon('#d9b9a0')} position={[-6.05, 1.9, 0]} castShadow>
        <boxGeometry args={[3.9, 3.8, 0.3]} />
      </mesh>
      <mesh material={toon('#d9b9a0')} position={[0, 4.5, 0]}>
        <boxGeometry args={[16.4, 1.4, 0.4]} />
      </mesh>
      <mesh material={toon('#3b3a44')} position={[-3.5, 3.6, 0]}>
        <boxGeometry args={[1.3, 0.2, 0.16]} />
      </mesh>
      {/* the flyer, pinned at the top, bottom half fluttering */}
      <group position={[-6, 1.5, 0.17]}>
        <mesh material={flyerMat} geometry={flyerHalves.top} position={[0, 0.21, 0]} />
        <mesh material={toon('#d43c3c')} position={[0, 0.41, 0.01]}>
          <sphereGeometry args={[0.02, 8, 6]} />
        </mesh>
        <group ref={flap}>
          <mesh material={flyerMat} geometry={flyerHalves.bottom} position={[0, -0.21, 0]} />
        </group>
      </group>

      {/* ── outside: sidewalk, road, lamps, skyline */}
      <group position={[0, 0, 7]} rotation={[0, Math.PI / 2, 0]}>
        <Road zFrom={40} zTo={-40} width={7} walk={0.01} />
      </group>
      <mesh material={toon('#bdb3a2')} position={[0, 0.06, 1.7]} receiveShadow>
        <boxGeometry args={[80, 0.12, 3.4]} />
      </mesh>
      {[-9, 0, 9].map((x) => (
        <StreetLamp key={x} position={[x, 0, 3.1]} rotation={Math.PI / 2} lampMat={lampMat} />
      ))}
      <TreeInstances kind="broad" seed={2} items={[{ x: 4.5, z: 2.6, scale: 0.9 }, { x: -10, z: 2.6, scale: 1.1 }, { x: 12, z: 11, scale: 1.2 }, { x: -16, z: 12, scale: 1.3 }]} />
      <TowerField items={specs} mats={towerMats} />
      <Character actor={actor} />
    </>
  )
}

