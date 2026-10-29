import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { flat, toon } from '../utils/materials'
import { canvasTexture } from '../utils/canvasTexture'
import { blendPose, joints, poses, type Joint, type Pose, type PoseName } from './poses'

/** Hand shape per pose: curl 0 = flat open hand, 1 = closed grip; spread fans the fingers. */
const handShapes: Record<PoseName, { curl: number; spread: number }> = {
  idle: { curl: 0.35, spread: 0.1 },
  stand: { curl: 0.35, spread: 0.1 },
  walk: { curl: 0.4, spread: 0.05 },
  stopLook: { curl: 0.35, spread: 0.1 },
  sit: { curl: 0.4, spread: 0.1 },
  type: { curl: 0.45, spread: 0.15 },
  sitWork: { curl: 0.6, spread: 0.05 },
  work: { curl: 0.6, spread: 0.05 },
  inspect: { curl: 0.15, spread: 0.2 },
  lookUp: { curl: 0.3, spread: 0.1 },
  ride: { curl: 0.9, spread: 0 },
  celebrate: { curl: 0.05, spread: 0.75 },
  proud: { curl: 0.45, spread: 0.05 },
  wave: { curl: 0.0, spread: 0.85 },
}

interface HandShape {
  curl: number
  spread: number
}
import { useStore } from '../state/store'

/** Scene-owned description of what the character is doing this frame. */
export interface Actor {
  pose: PoseName
  /** Pose being blended toward; `blend` 0 = pose, 1 = next. */
  next?: PoseName
  blend?: number
  phase: number
  x: number
  y: number
  z: number
  rotY: number
  visible?: boolean
}

export function createActor(init: Partial<Actor> = {}): Actor {
  return { pose: 'idle', phase: 0, x: 0, y: 0, z: 0, rotY: 0, blend: 0, visible: true, ...init }
}

const C = {
  skin: '#a26d4c',
  skinShade: '#8a5a3e',
  hair: '#17110f',
  hairHi: '#3b2c27',
  shirt: '#a9c9ea',
  shirtShade: '#7f9fc6',
  trousers: '#2b3348',
  trousersShade: '#20273a',
  shoe: '#f2eee6',
  sole: '#cfc8bb',
  accent: '#e8774a',
  bag: '#3f4a3c',
  bagStrap: '#2a3028',
  metal: '#c9c4bb',
}

/** Small-check print for the shirt (the résumé photo shows a patterned light-blue shirt). */
function shirtTexture() {
  const t = canvasTexture(
    'shirt-print',
    64,
    64,
    (ctx, w) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, w)
      ctx.fillStyle = '#d3e1f0'
      for (let y = 0; y < w; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) ctx.fillRect(x, y, 3, 3)
    },
    { repeat: true },
  )
  t.repeat.set(6, 6)
  return t
}

function useMats() {
  return useMemo(() => {
    const print = shirtTexture()
    return {
      skin: toon(C.skin),
      skinShade: toon(C.skinShade),
      hair: toon(C.hair),
      hairHi: toon(C.hairHi),
      shirt: toon(C.shirt, { map: print }),
      shirtPlain: toon(C.shirt),
      shirtShade: toon(C.shirtShade),
      trousers: toon(C.trousers),
      trousersShade: toon(C.trousersShade),
      shoe: toon(C.shoe),
      sole: toon(C.sole),
      accent: toon(C.accent),
      bag: toon(C.bag),
      strap: toon(C.bagStrap),
      metal: toon(C.metal),
      eyeWhite: flat('#f7f2ea'),
      iris: flat('#2a1b14'),
      shine: flat('#ffffff'),
      line: flat('#1a1210'),
      ink: toon('#1d1a24'),
    }
  }, [])
}
type Mats = ReturnType<typeof useMats>

/** Lathe profile for the shirt torso: broad chest, tapered waist, slight hem flare. */
function torsoGeometry() {
  const pts = [
    [0.0, -0.27],
    [0.155, -0.27],
    [0.16, -0.2],
    [0.145, -0.08],
    [0.152, 0.04],
    [0.17, 0.14],
    [0.175, 0.2],
    [0.14, 0.26],
    [0.06, 0.29],
    [0.0, 0.29],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(pts, 20)
  g.scale(1.12, 1, 0.72)
  return g
}

function limbGeometry(rTop: number, rBot: number, len: number) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 12, 1)
  g.translate(0, -len / 2, 0)
  return g
}

/**
 * Nadhapriyan's avatar: anime-proportioned, dark wavy hair with a highlight band, short beard,
 * patterned light-blue shirt with rolled sleeves, navy trousers, white sneakers, a watch and a
 * small engineer's backpack. Primitives on a 13-joint rig so every scene shares one identity.
 */
export function Character({ actor, scale = 1, backpack = true }: { actor: Actor; scale?: number; backpack?: boolean }) {
  const root = useRef<THREE.Group>(null)
  const refs = useRef<Partial<Record<Joint, THREE.Group>>>({})
  const reduced = useStore((s) => s.reducedMotion)
  const scratch = useMemo(() => ({ out: { hipsY: 0.95 } as Pose }), [])
  const hand = useMemo<HandShape>(() => ({ curl: 0.35, spread: 0.1 }), [])
  const m = useMats()
  const geo = useMemo(
    () => ({
      torso: torsoGeometry(),
      upperArm: limbGeometry(0.06, 0.05, 0.27),
      forearm: limbGeometry(0.052, 0.043, 0.24),
      thigh: limbGeometry(0.085, 0.068, 0.43),
      shin: limbGeometry(0.066, 0.055, 0.4),
    }),
    [],
  )

  const set = (name: Joint) => (g: THREE.Group | null) => {
    if (g) refs.current[name] = g
  }

  useFrame((state) => {
    const g = root.current
    if (!g) return
    g.visible = actor.visible !== false
    if (!g.visible) return
    const t = reduced ? 0 : state.clock.elapsedTime
    const a = poses[actor.pose](t, actor.phase)
    const b = actor.next ? poses[actor.next](t, actor.phase) : a
    const p = blendPose(a, b, actor.blend ?? 0, scratch.out)
    g.position.set(actor.x, actor.y, actor.z)
    g.rotation.y = actor.rotY
    const r = refs.current
    for (const j of joints) {
      const node = r[j]
      if (node) node.rotation.set(p[j][0], p[j][1], p[j][2])
    }
    if (r.hips) r.hips.position.y = p.hipsY
    const ha = handShapes[actor.pose]
    const hb = actor.next ? handShapes[actor.next] : ha
    const w = actor.blend ?? 0
    hand.curl = ha.curl + (hb.curl - ha.curl) * w
    hand.spread = ha.spread + (hb.spread - ha.spread) * w
  })

  return (
    <group ref={root} scale={scale}>
      <group ref={set('hips')} position={[0, 0.95, 0]}>
        {/* trousers seat and belt with buckle */}
        <mesh material={m.trousers} position={[0, -0.03, 0]} scale={[1.12, 0.8, 0.75]} castShadow>
          <sphereGeometry args={[0.165, 16, 12]} />
        </mesh>
        <mesh material={m.ink} position={[0, 0.07, 0]} scale={[1.12, 1, 0.76]}>
          <cylinderGeometry args={[0.165, 0.165, 0.04, 18]} />
        </mesh>
        <mesh material={m.metal} position={[0, 0.07, 0.128]}>
          <boxGeometry args={[0.045, 0.032, 0.012]} />
        </mesh>
        <group ref={set('spine')} position={[0, 0.09, 0]}>
          <group ref={set('chest')} position={[0, 0.22, 0]}>
            <mesh geometry={geo.torso} material={m.shirt} position={[0, -0.04, 0]} castShadow />
            {/* placket, buttons, chest pocket */}
            <mesh material={m.shirtShade} position={[0, -0.04, 0.122]}>
              <boxGeometry args={[0.028, 0.5, 0.012]} />
            </mesh>
            {[0.17, 0.07, -0.03, -0.13, -0.23].map((y) => (
              <mesh key={y} material={m.shine} position={[0, y, 0.13]}>
                <sphereGeometry args={[0.008, 6, 6]} />
              </mesh>
            ))}
            <mesh material={m.shirtShade} position={[0.075, 0.1, 0.122]} rotation={[-0.08, 0, 0]}>
              <boxGeometry args={[0.075, 0.085, 0.01]} />
            </mesh>
            <mesh material={m.shirtPlain} position={[0.075, 0.135, 0.128]} rotation={[-0.1, 0, 0]}>
              <boxGeometry args={[0.08, 0.025, 0.012]} />
            </mesh>
            {/* collar: band plus two pointed flaps */}
            <mesh material={m.shirtPlain} position={[0, 0.25, 0]} scale={[1, 1, 0.9]}>
              <cylinderGeometry args={[0.068, 0.078, 0.05, 16, 1, true]} />
            </mesh>
            {[1, -1].map((s) => (
              <mesh key={s} material={m.shirtPlain} position={[0.045 * s, 0.225, 0.07]} rotation={[0.55, 0, 0.45 * s]}>
                <boxGeometry args={[0.07, 0.06, 0.01]} />
              </mesh>
            ))}
            {/* backpack */}
            {backpack && (
              <group position={[0, 0.0, -0.13]}>
                <mesh material={m.bag} position={[0, -0.02, -0.07]} scale={[1, 1.1, 0.55]} castShadow>
                  <sphereGeometry args={[0.16, 14, 12]} />
                </mesh>
                <mesh material={m.strap} position={[0, -0.08, -0.15]} scale={[1, 0.8, 0.4]}>
                  <sphereGeometry args={[0.1, 10, 8]} />
                </mesh>
                <mesh material={m.accent} position={[0, 0.06, -0.155]}>
                  <boxGeometry args={[0.12, 0.012, 0.012]} />
                </mesh>
                {[0.09, -0.09].map((x) => (
                  <mesh key={x} material={m.strap} position={[x, 0.1, 0.12]} rotation={[0.25, 0, 0]}>
                    <boxGeometry args={[0.035, 0.36, 0.015]} />
                  </mesh>
                ))}
              </group>
            )}
            <group ref={set('neck')} position={[0, 0.25, 0]}>
              <mesh material={m.skin} position={[0, 0.04, 0]}>
                <cylinderGeometry args={[0.048, 0.054, 0.1, 12]} />
              </mesh>
              <group ref={set('head')} position={[0, 0.17, 0.01]}>
                <Head m={m} />
              </group>
            </group>
            <group ref={set('shoulderL')} position={[0.19, 0.17, 0]}>
              <Arm m={m} geo={geo} side={1} elbowRef={set('elbowL')} hand={hand} />
            </group>
            <group ref={set('shoulderR')} position={[-0.19, 0.17, 0]}>
              <Arm m={m} geo={geo} side={-1} elbowRef={set('elbowR')} hand={hand} />
            </group>
          </group>
        </group>
        <group ref={set('hipL')} position={[0.092, -0.06, 0]}>
          <Leg m={m} geo={geo} kneeRef={set('kneeL')} />
        </group>
        <group ref={set('hipR')} position={[-0.092, -0.06, 0]}>
          <Leg m={m} geo={geo} kneeRef={set('kneeR')} />
        </group>
      </group>
    </group>
  )
}

type Geo = { torso: THREE.BufferGeometry; upperArm: THREE.BufferGeometry; forearm: THREE.BufferGeometry; thigh: THREE.BufferGeometry; shin: THREE.BufferGeometry }

function Head({ m }: { m: Mats }) {
  return (
    <group>
      {/* skull and jaw */}
      <mesh material={m.skin} scale={[0.9, 1.0, 0.98]} castShadow>
        <sphereGeometry args={[0.125, 24, 18]} />
      </mesh>
      <mesh material={m.skin} position={[0, -0.06, 0.02]} scale={[0.82, 0.7, 0.85]}>
        <sphereGeometry args={[0.11, 18, 12]} />
      </mesh>
      {/* ears */}
      {[1, -1].map((s) => (
        <group key={s} position={[0.112 * s, -0.005, -0.005]}>
          <mesh material={m.skin} scale={[0.45, 1, 0.75]}>
            <sphereGeometry args={[0.032, 10, 8]} />
          </mesh>
          <mesh material={m.skinShade} position={[0.006 * s, 0, 0.004]} scale={[0.3, 0.6, 0.45]}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </group>
      ))}
      {/* hair: cap, forward-swept locks, sides, crown spikes, highlight band */}
      <mesh material={m.hair} position={[0, 0.03, -0.01]} scale={[0.97, 0.92, 1.03]}>
        <sphereGeometry args={[0.135, 20, 14, 0, Math.PI * 2, 0, 1.55]} />
      </mesh>
      {[
        [0.0, 0.1, 0.09, 0.4, 0.0],
        [0.055, 0.095, 0.085, 0.45, -0.35],
        [-0.055, 0.095, 0.085, 0.45, 0.35],
        [0.095, 0.06, 0.06, 0.25, -0.7],
        [-0.095, 0.06, 0.06, 0.25, 0.7],
      ].map(([x, y, z, rx, rz], i) => (
        <mesh key={`f${i}`} material={m.hair} position={[x, y, z]} rotation={[rx + 1.2, 0, rz]}>
          <coneGeometry args={[0.045, 0.12, 8]} />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => {
        const a = -1.2 + (i / 6) * 2.4
        return (
          <mesh key={`b${i}`} material={m.hair} position={[Math.sin(a) * 0.1, 0.07 - Math.abs(a) * 0.02, -0.08 + Math.cos(a) * -0.02]} rotation={[-0.9, a * 0.4, 0]}>
            <coneGeometry args={[0.048, 0.13, 8]} />
          </mesh>
        )
      })}
      <mesh material={m.hair} position={[0, 0.125, 0.02]} rotation={[-0.4, 0, 0]}>
        <coneGeometry args={[0.06, 0.1, 10]} />
      </mesh>
      <mesh material={m.hairHi} position={[0.0, 0.118, 0.03]} rotation={[0.35, 0, 0]} scale={[1, 0.25, 1]}>
        <torusGeometry args={[0.08, 0.012, 6, 16, Math.PI]} />
      </mesh>
      {/* short beard with sideburns, moustache */}
      <mesh material={m.hair} position={[0, -0.03, 0.006]} scale={[0.93, 1.02, 0.98]}>
        <sphereGeometry args={[0.128, 20, 12, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.55, Math.PI * 0.33]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} material={m.hair} position={[0.104 * s, -0.01, 0.02]} scale={[0.35, 1, 0.6]}>
          <sphereGeometry args={[0.035, 8, 8]} />
        </mesh>
      ))}
      <mesh material={m.hair} position={[0, -0.05, 0.112]} scale={[1.7, 0.42, 0.55]}>
        <sphereGeometry args={[0.026, 10, 6]} />
      </mesh>
      {/* eyes: sclera, iris, catch-light, upper lid line */}
      {[1, -1].map((s) => (
        <group key={s} position={[0.044 * s, 0.012, 0.108]}>
          <mesh material={m.eyeWhite} scale={[1.3, 0.9, 0.4]}>
            <sphereGeometry args={[0.018, 10, 8]} />
          </mesh>
          <mesh material={m.iris} position={[0, -0.002, 0.006]} scale={[0.85, 1.05, 0.4]}>
            <sphereGeometry args={[0.012, 10, 8]} />
          </mesh>
          <mesh material={m.shine} position={[0.004 * s, 0.004, 0.011]}>
            <sphereGeometry args={[0.0035, 6, 4]} />
          </mesh>
          <mesh material={m.line} position={[0, 0.015, 0.004]} rotation={[0, 0, -0.08 * s]}>
            <boxGeometry args={[0.05, 0.006, 0.008]} />
          </mesh>
          <mesh material={m.hair} position={[0.002 * s, 0.042, 0.002]} rotation={[0, 0, -0.14 * s]}>
            <boxGeometry args={[0.05, 0.011, 0.012]} />
          </mesh>
        </group>
      ))}
      {/* nose and mouth */}
      <mesh material={m.skin} position={[0, -0.01, 0.12]} rotation={[0.3, 0, 0]} scale={[0.7, 1.2, 0.9]}>
        <coneGeometry args={[0.018, 0.04, 8]} />
      </mesh>
      <mesh material={m.skinShade} position={[0, -0.03, 0.118]} scale={[1.4, 0.6, 0.6]}>
        <sphereGeometry args={[0.012, 8, 6]} />
      </mesh>
      <mesh material={m.line} position={[0, -0.073, 0.106]}>
        <boxGeometry args={[0.04, 0.006, 0.006]} />
      </mesh>
    </group>
  )
}

function Arm({ m, geo, side, elbowRef, hand }: { m: Mats; geo: Geo; side: number; elbowRef: (g: THREE.Group | null) => void; hand: HandShape }) {
  return (
    <group>
      <mesh material={m.shirt} scale={[1.05, 0.9, 1]}>
        <sphereGeometry args={[0.068, 12, 10]} />
      </mesh>
      <mesh geometry={geo.upperArm} material={m.shirt} position={[0.008 * side, 0, 0]} castShadow />
      <group ref={elbowRef} position={[0.008 * side, -0.27, 0]}>
        <mesh material={m.shirt}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
        <mesh material={m.shirt} position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.05, 0.048, 0.08, 12]} />
        </mesh>
        {/* rolled sleeve cuff */}
        <mesh material={m.shirtShade} position={[0, -0.085, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.048, 0.016, 6, 14]} />
        </mesh>
        <mesh geometry={geo.forearm} material={m.skin} position={[0, -0.08, 0]} castShadow />
        {/* watch on the left wrist */}
        {side > 0 && (
          <mesh material={m.ink} position={[0, -0.27, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.043, 0.043, 0.025, 12]} />
          </mesh>
        )}
        <Hand m={m} side={side} shape={hand} />
      </group>
    </group>
  )
}

/**
 * Stylised hand: wrist, a broad palm, four chunky two-segment fingers and a thumb.
 * Finger curl and spread follow the pose (open wave, relaxed, gripping the handlebar).
 */
function Hand({ m, side, shape }: { m: Mats; side: number; shape: HandShape }) {
  const bases = useRef<(THREE.Group | null)[]>([])
  const tips = useRef<(THREE.Group | null)[]>([])
  const thumb = useRef<THREE.Group>(null)
  const fingers = [-0.031, -0.0105, 0.0105, 0.031]
  useFrame(() => {
    const c = shape.curl
    const sp = shape.spread
    fingers.forEach((_, i) => {
      const b = bases.current[i]
      const t = tips.current[i]
      if (b) b.rotation.set(0.1 + c * 1.15, 0, (i - 1.5) * -0.16 * sp)
      if (t) t.rotation.x = 0.12 + c * 1.25
    })
    if (thumb.current) thumb.current.rotation.set(0.3 + c * 0.7, 0, side * (0.9 - c * 0.45 + sp * 0.25))
  })
  return (
    <group position={[0, -0.325, 0.004]}>
      {/* wrist */}
      <mesh material={m.skin}>
        <cylinderGeometry args={[0.037, 0.04, 0.045, 12]} />
      </mesh>
      {/* palm: broad, slightly cupped */}
      <mesh material={m.skin} position={[0, -0.055, 0]} scale={[1, 1, 0.55]}>
        <capsuleGeometry args={[0.044, 0.035, 4, 14]} />
      </mesh>
      <mesh material={m.skinShade} position={[0, -0.093, 0.004]} scale={[1, 0.5, 0.6]}>
        <capsuleGeometry args={[0.012, 0.06, 3, 8]} />
      </mesh>
      {fingers.map((x, i) => {
        const len = i === 0 ? 0.034 : i === 3 ? 0.03 : 0.04
        return (
          <group key={x} ref={(g) => (bases.current[i] = g)} position={[x, -0.1, 0.004]}>
            <mesh material={m.skin} position={[0, -len / 2, 0]}>
              <capsuleGeometry args={[0.0135, len, 4, 10]} />
            </mesh>
            <group ref={(g) => (tips.current[i] = g)} position={[0, -len, 0]}>
              <mesh material={m.skin} position={[0, -0.016, 0]}>
                <capsuleGeometry args={[0.0125, 0.026, 4, 10]} />
              </mesh>
            </group>
          </group>
        )
      })}
      {/* thumb, on the side facing the body */}
      <group ref={thumb} position={[-0.04 * side, -0.04, 0.012]}>
        <mesh material={m.skin} position={[0, -0.02, 0]}>
          <capsuleGeometry args={[0.015, 0.03, 4, 10]} />
        </mesh>
        <mesh material={m.skin} position={[0, -0.046, 0.004]}>
          <capsuleGeometry args={[0.0135, 0.02, 4, 10]} />
        </mesh>
      </group>
    </group>
  )
}

function Leg({ m, geo, kneeRef }: { m: Mats; geo: Geo; kneeRef: (g: THREE.Group | null) => void }) {
  return (
    <group>
      <mesh geometry={geo.thigh} material={m.trousers} castShadow />
      <group ref={kneeRef} position={[0, -0.43, 0]}>
        <mesh material={m.trousers} scale={[1, 0.8, 1.05]}>
          <sphereGeometry args={[0.068, 10, 8]} />
        </mesh>
        <mesh geometry={geo.shin} material={m.trousers} castShadow />
        {/* hem */}
        <mesh material={m.trousersShade} position={[0, -0.39, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.04, 12]} />
        </mesh>
        <Shoe m={m} />
      </group>
    </group>
  )
}

function Shoe({ m }: { m: Mats }) {
  return (
    <group position={[0, -0.44, 0.045]}>
      <mesh material={m.sole} position={[0, -0.035, 0]} scale={[1, 0.35, 1]}>
        <capsuleGeometry args={[0.056, 0.17, 4, 10]} />
      </mesh>
      <mesh material={m.shoe} position={[0, 0.0, -0.01]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.75]} castShadow>
        <capsuleGeometry args={[0.054, 0.15, 4, 10]} />
      </mesh>
      <mesh material={m.shoe} position={[0, 0.03, -0.06]}>
        <cylinderGeometry args={[0.055, 0.06, 0.07, 12]} />
      </mesh>
      {/* accent stripe and laces */}
      <mesh material={m.accent} position={[0.056, 0.0, -0.01]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.006, 0.03, 0.12]} />
      </mesh>
      {[0.02, 0.045, 0.07].map((z) => (
        <mesh key={z} material={m.sole} position={[0, 0.038 - z * 0.25, z]}>
          <boxGeometry args={[0.06, 0.008, 0.01]} />
        </mesh>
      ))}
    </group>
  )
}
