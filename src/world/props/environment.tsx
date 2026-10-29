import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Tubes } from '../kit/Tubes'
import * as THREE from 'three'
import { flat, makeCel, palette, toon, toonRamp } from '../../utils/materials'
import { canvasTexture, fonts, rng } from '../../utils/canvasTexture'

type V3 = [number, number, number]

/* ------------------------------------------------------------------ sky */

export interface SkyColors {
  top: string
  horizon: string
  bottom: string
}

/** Gradient sky sphere. Returns uniforms through `onReady` so scenes can animate time of day. */
export function SkyDome({
  colors,
  uniformsRef,
  clouds = 0,
  cloudColor = '#f6f1e6',
}: {
  colors: SkyColors
  uniformsRef?: React.MutableRefObject<SkyUniforms | null>
  /** Painted cloud coverage 0–1. */
  clouds?: number
  cloudColor?: string
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color(colors.top) },
          uHorizon: { value: new THREE.Color(colors.horizon) },
          uBottom: { value: new THREE.Color(colors.bottom) },
          uSun: { value: new THREE.Vector3(0.3, 0.15, -1).normalize() },
          uSunColor: { value: new THREE.Color('#fff1d0') },
          uSunSize: { value: 0.0 },
          uClouds: { value: clouds },
          uCloudColor: { value: new THREE.Color(cloudColor) },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uHorizon, uBottom, uSunColor, uSun;
          uniform float uSunSize, uClouds, uTime;
          uniform vec3 uCloudColor;
          varying vec3 vDir;
          float h2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          float vnoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
            return v;
          }
          void main() {
            float y = vDir.y;
            vec3 col = y > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.6, y), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, 0.25, -y));
            float s = dot(normalize(vDir), normalize(uSun));
            col = mix(col, uSunColor, smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, s) * step(0.0001, uSunSize));
            col += uSunColor * 0.18 * pow(max(s, 0.0), 12.0) * step(0.0001, uSunSize);
            // painted clouds: hard-edged fbm shapes with a lighter lip and a shaded underside
            if (uClouds > 0.0 && vDir.y > 0.0) {
              vec2 p = vDir.xz / (vDir.y + 0.18) * 1.6 + vec2(uTime * 0.004, 0.0);
              float n = fbm(p);
              float edge = 1.0 - uClouds * 0.55;
              float body = smoothstep(edge, edge + 0.025, n);
              float lip = smoothstep(edge + 0.06, edge + 0.085, n);
              float under = smoothstep(edge + 0.02, edge + 0.12, fbm(p + vec2(0.0, 0.35)));
              vec3 cloud = mix(uCloudColor * vec3(0.78, 0.84, 0.95), uCloudColor, lip);
              cloud = mix(cloud, cloud * vec3(0.85, 0.88, 0.97), under * 0.5);
              col = mix(col, cloud, body * smoothstep(0.0, 0.12, vDir.y));
            }
            // tiny ordered dither keeps the long gradients free of 8-bit banding
            col += (h2(gl_FragCoord.xy) - 0.5) / 255.0;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    // colours are applied once; scenes animate via the uniforms
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useLayoutEffect(() => {
    if (uniformsRef) uniformsRef.current = mat.uniforms as unknown as SkyUniforms
  }, [mat, uniformsRef])
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
  })
  return (
    <mesh material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[350, 32, 16]} />
    </mesh>
  )
}

export interface SkyUniforms {
  uTop: { value: THREE.Color }
  uHorizon: { value: THREE.Color }
  uBottom: { value: THREE.Color }
  uSun: { value: THREE.Vector3 }
  uSunColor: { value: THREE.Color }
  uSunSize: { value: number }
  uClouds: { value: number }
  uCloudColor: { value: THREE.Color }
}

/* ------------------------------------------------------------- street kit */

export function House({
  position,
  rotation = 0,
  w = 5,
  d = 5,
  h = 4.4,
  color = palette.cream,
  roof = palette.teal,
  floors = 2,
  shopSign,
}: {
  position: V3
  rotation?: number
  w?: number
  d?: number
  h?: number
  color?: string
  roof?: string
  floors?: number
  shopSign?: { text: string; color: string }
}) {
  const roofGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.01, d * 0.62, w + 0.5, 4, 1)
    g.rotateZ(Math.PI / 2)
    g.rotateX(Math.PI / 4)
    g.scale(1, 0.42, 1)
    return g
  }, [w, d])
  const windows: V3[] = []
  const cols = Math.max(1, Math.floor(w / 1.8))
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5)
      if (f === 0 && c === Math.floor(cols / 2)) continue
      windows.push([x, (h / floors) * (f + 0.55), d / 2 + 0.02])
    }
  }
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={toon(color)} position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh geometry={roofGeo} material={toon(roof)} position={[0, h + d * 0.13, 0]} castShadow />
      {/* eave band */}
      <mesh material={toon(palette.ink)} position={[0, h, d / 2 + 0.06]}>
        <boxGeometry args={[w + 0.3, 0.12, 0.12]} />
      </mesh>
      {windows.map((p, i) => (
        <group key={i} position={p}>
          <mesh material={toon('#f6efe0')}>
            <boxGeometry args={[1.0, 1.05, 0.06]} />
          </mesh>
          <mesh material={toon('#5f7e8c')} position={[0, 0, 0.035]}>
            <planeGeometry args={[0.82, 0.86]} />
          </mesh>
          <mesh material={toon('#f6efe0')} position={[0, 0, 0.04]}>
            <boxGeometry args={[0.05, 0.86, 0.02]} />
          </mesh>
        </group>
      ))}
      {/* door */}
      <mesh material={toon(palette.wood)} position={[cols > 1 ? -w / 2 + (w / cols) * (Math.floor(cols / 2) + 0.5) : 0, 1.05, d / 2 + 0.03]}>
        <boxGeometry args={[1.0, 2.1, 0.06]} />
      </mesh>
      {shopSign && <VerticalSign text={shopSign.text} color={shopSign.color} position={[w / 2 - 0.3, h * 0.62, d / 2 + 0.45]} />}
    </group>
  )
}

/** Tall narrow shop sign, the street's signature silhouette. */
export function VerticalSign({ text, color, position }: { text: string; color: string; position: V3 }) {
  const tex = canvasTexture(`vsign-${text}-${color}`, 128, 512, (ctx, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#1d1a24'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = '#fbf3e4'
    ctx.font = `800 64px ${fonts.display}`
    ctx.textAlign = 'center'
    const letters = text.split('')
    const step = (h - 60) / letters.length
    letters.forEach((l, i) => ctx.fillText(l, w / 2, 70 + i * step))
  })
  return (
    <group position={position}>
      <mesh material={toon('#ffffff', { map: tex })}>
        <boxGeometry args={[0.5, 2, 0.08]} />
      </mesh>
      <mesh material={toon(palette.ink)} position={[-0.3, 0.6, 0]}>
        <boxGeometry args={[0.2, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}

export function Tree({ position, scale = 1, blossom = false, seed = 1 }: { position: V3; scale?: number; blossom?: boolean; seed?: number }) {
  const r = useMemo(() => rng(seed), [seed])
  const leaves = useMemo(
    () =>
      Array.from({ length: 4 }, () => [(r() - 0.5) * 1.2, 2.2 + r() * 1.0, (r() - 0.5) * 1.2, 0.8 + r() * 0.5] as [number, number, number, number]),
    [r],
  )
  const leaf = toon(blossom ? '#e9a8b4' : '#7d9f6a')
  return (
    <group position={position} scale={scale}>
      <mesh material={toon('#5b4031')} position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 2.2, 7]} />
      </mesh>
      {leaves.map(([x, y, z, s], i) => (
        <mesh key={i} material={leaf} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[s, 1]} />
        </mesh>
      ))}
    </group>
  )
}

/** Utility poles with sagging wires — a run along one side of a street. */
export function PoleLine({ start, end, count, x }: { start: number; end: number; count: number; x: number }) {
  const zs = Array.from({ length: count }, (_, i) => start + ((end - start) * i) / (count - 1))
  const wireSets = useMemo(() => {
    const sets: THREE.Vector3[][] = []
    for (let i = 0; i < zs.length - 1; i++) {
      for (const [dx, dy] of [[-0.5, 6.6], [0.5, 6.6], [0, 6.1]]) {
        const a = new THREE.Vector3(x + dx, dy, zs[i])
        const b = new THREE.Vector3(x + dx, dy, zs[i + 1])
        const mid = a.clone().lerp(b, 0.5)
        mid.y -= 0.55
        sets.push(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(10))
      }
    }
    return sets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, count, x])
  return (
    <group>
      {zs.map((z) => (
        <group key={z} position={[x, 0, z]}>
          <mesh material={toon('#6d6458')} position={[0, 3.5, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.14, 7, 8]} />
          </mesh>
          <mesh material={toon('#4c463f')} position={[0, 6.6, 0]}>
            <boxGeometry args={[1.4, 0.1, 0.1]} />
          </mesh>
          <mesh material={toon('#8a8f86')} position={[0.32, 5.6, 0.12]}>
            <cylinderGeometry args={[0.22, 0.22, 0.6, 10]} />
          </mesh>
        </group>
      ))}
      <Tubes paths={wireSets} radius={0.022} material={toon(palette.ink)} />
    </group>
  )
}

/** Street lamp with an emissive head; `flickerRef` lets a scene drive brightness. */
export function StreetLamp({ position, rotation = 0, lampMat }: { position: V3; rotation?: number; lampMat: THREE.Material }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={toon('#3b3a44')} position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 5.2, 8]} />
      </mesh>
      <mesh material={toon('#3b3a44')} position={[0.45, 5.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.95, 6]} />
      </mesh>
      <mesh material={toon('#2c2b33')} position={[0.9, 5.05, 0]}>
        <boxGeometry args={[0.5, 0.14, 0.3]} />
      </mesh>
      <mesh material={lampMat} position={[0.9, 4.97, 0]}>
        <boxGeometry args={[0.4, 0.04, 0.22]} />
      </mesh>
    </group>
  )
}

/** Flat sign with crisp text, used for noticeboards, labels and street names. */
export function TextBoard({
  id,
  lines,
  width,
  height,
  bg = palette.paper,
  fg = palette.ink,
  accent = palette.sunset,
  frame = '#5b4031',
  position,
  rotation = [0, 0, 0],
  emissive = false,
}: {
  id: string
  lines: { text: string; size: number; font?: 'display' | 'body' | 'mono' | 'hand'; color?: 'fg' | 'accent' }[]
  width: number
  height: number
  bg?: string
  fg?: string
  accent?: string
  frame?: string | null
  position: V3
  rotation?: V3
  emissive?: boolean
}) {
  const ppu = 256
  const tex = canvasTexture(`board-${id}`, Math.round(width * ppu), Math.round(height * ppu), (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const total = lines.reduce((s, l) => s + l.size * 1.25, 0)
    let y = h / 2 - total / 2
    for (const l of lines) {
      y += (l.size * 1.25) / 2
      ctx.fillStyle = l.color === 'accent' ? accent : fg
      const weight = l.font === 'body' || l.font === 'mono' ? 500 : 800
      ctx.font = `${weight} ${l.size}px ${fonts[l.font ?? 'display']}`
      ctx.fillText(l.text, w / 2, y)
      y += (l.size * 1.25) / 2
    }
  })
  const mat = emissive ? flat('#ffffff', 1, `board-mat-${id}`, tex) : toon('#ffffff', { map: tex })
  return (
    <group position={position} rotation={rotation}>
      {frame && (
        <mesh material={toon(frame)} position={[0, 0, -0.04]}>
          <boxGeometry args={[width + 0.16, height + 0.16, 0.06]} />
        </mesh>
      )}
      <mesh material={mat}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  )
}

/* ---------------------------------------------------------- city blocks */

const buildingTypes: V3[] = [
  [6, 12, 6],
  [5, 21, 5],
  [8, 8, 7],
  [4, 30, 4.5],
  [7, 16, 6],
  [5.5, 25, 5],
]

function windowTextures() {
  const cells = 8
  const map = canvasTexture(
    'facade-map',
    512,
    512,
    (ctx, w) => {
      const c = w / cells
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, w)
      for (let i = 0; i < cells; i++)
        for (let j = 0; j < cells; j++) {
          ctx.fillStyle = '#d9d2c6'
          ctx.fillRect(i * c + c * 0.16, j * c + c * 0.14, c * 0.68, c * 0.62)
          ctx.fillStyle = '#7b8798'
          ctx.fillRect(i * c + c * 0.2, j * c + c * 0.18, c * 0.6, c * 0.54)
        }
    },
    { repeat: true },
  )
  const emissive = canvasTexture(
    'facade-emissive',
    512,
    512,
    (ctx, w) => {
      const c = w / cells
      const r = rng(77)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, w)
      for (let i = 0; i < cells; i++)
        for (let j = 0; j < cells; j++) {
          if (r() < 0.42) {
            ctx.fillStyle = r() < 0.5 ? '#ffffff' : '#bdbdbd'
            ctx.fillRect(i * c + c * 0.2, j * c + c * 0.18, c * 0.6, c * 0.54)
          }
        }
    },
    { repeat: true },
  )
  return { map, emissive }
}

function facadeGeometry([w, h, d]: V3) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(0, h / 2, 0)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const cell = 3.2
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const faceSize: [number, number][] = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = faceSize[f]
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      if (fu === 0) uv.setXY(i, 0.02, 0.02)
      else uv.setXY(i, (uv.getX(i) * fu) / (cell * 8), (uv.getY(i) * fv) / (cell * 8))
    }
  }
  uv.needsUpdate = true
  return g
}

export interface CityMaterials {
  warm: THREE.MeshToonMaterial
  cool: THREE.MeshToonMaterial
}

/** Creates the two facade materials a city scene animates for dusk and the cyber shift. */
export function useCityMaterials(key: string): CityMaterials {
  return useMemo(() => {
    const { map, emissive } = windowTextures()
    const mk = (k: string) =>
      makeCel(new THREE.MeshToonMaterial({
        color: '#ffffff',
        map,
        emissiveMap: emissive,
        emissive: new THREE.Color('#ffcf8a'),
        emissiveIntensity: 0,
        gradientMap: toonRamp,
        name: `${key}-${k}`,
      }))
    return { warm: mk('warm'), cool: mk('cool') }
  }, [key])
}

export interface BuildingSpec {
  type: number
  x: number
  z: number
  rot: number
  color: string
  cool?: boolean
  scaleY?: number
}

/** Instanced buildings, one InstancedMesh per footprint type and material. */
export function CityBlocks({ specs, mats }: { specs: BuildingSpec[]; mats: CityMaterials }) {
  const groups = useMemo(() => {
    const out: { key: string; type: number; cool: boolean; items: BuildingSpec[] }[] = []
    buildingTypes.forEach((_, type) => {
      for (const cool of [false, true]) {
        const items = specs.filter((s) => s.type === type && !!s.cool === cool)
        if (items.length) out.push({ key: `${type}-${cool}`, type, cool, items })
      }
    })
    return out
  }, [specs])
  const geos = useMemo(() => buildingTypes.map(facadeGeometry), [])
  return (
    <group>
      {groups.map((g) => (
        <BlockInstances key={g.key} geometry={geos[g.type]} items={g.items} material={g.cool ? mats.cool : mats.warm} />
      ))}
    </group>
  )
}

function BlockInstances({ geometry, items, material }: { geometry: THREE.BufferGeometry; items: BuildingSpec[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const col = new THREE.Color()
    items.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot)
      m.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(1, s.scaleY ?? 1, 1))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, col.set(s.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow />
}

/** Lays out buildings along both sides of a street that runs down -Z. */
export function streetBuildings(seed: number, zFrom: number, zTo: number, setback: number, palette: string[]): BuildingSpec[] {
  const r = rng(seed)
  const specs: BuildingSpec[] = []
  for (const side of [-1, 1]) {
    let z = zFrom
    while (z > zTo) {
      const type = Math.floor(r() * buildingTypes.length)
      const [w, , d] = buildingTypes[type]
      const along = side < 0 ? d : d
      z -= along / 2 + 0.6
      specs.push({
        type,
        x: side * (setback + w / 2 + r() * 1.5),
        z,
        rot: 0,
        color: palette[Math.floor(r() * palette.length)],
        cool: r() < 0.5,
        scaleY: 0.7 + r() * 0.6,
      })
      z -= along / 2 + 0.6
    }
  }
  return specs
}

/** Asphalt road with dashed centre line and kerbs, running from zFrom to zTo. */
export function Road({ zFrom, zTo, width = 8, walk = 3, asphalt = palette.asphalt, kerb = '#bdb3a2' }: { zFrom: number; zTo: number; width?: number; walk?: number; asphalt?: string; kerb?: string }) {
  const len = zFrom - zTo
  const mid = (zFrom + zTo) / 2
  const dashes = Math.floor(len / 4)
  const dashRef = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = dashRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < dashes; i++) {
      m.makeTranslation(0, 0.012, zFrom - 2 - i * 4)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [dashes, zFrom])
  return (
    <group>
      <mesh material={toon(asphalt)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, mid]} receiveShadow>
        <planeGeometry args={[width, len]} />
      </mesh>
      <instancedMesh ref={dashRef} args={[undefined, undefined, dashes]} material={toon('#efe6d2')} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.16, 0.01, 1.8]} />
      </instancedMesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={toon(kerb)} position={[s * (width / 2 + walk / 2), 0.08, mid]} receiveShadow>
            <boxGeometry args={[walk, 0.16, len]} />
          </mesh>
        </group>
      ))}
      <mesh material={toon('#6e6a62')} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, mid]} receiveShadow>
        <planeGeometry args={[200, len + 100]} />
      </mesh>
    </group>
  )
}

/** Gentle cloud puffs that drift unless motion is reduced. */
export function Clouds({ count = 6, radius = 60, height = 30, seed = 5, color = '#fbf3e6', scale = 1 }: { count?: number; radius?: number; height?: number; seed?: number; color?: string; scale?: number }) {
  const ref = useRef<THREE.Group>(null)
  const puffs = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }, () => {
      const a = r() * Math.PI * 2
      return {
        pos: [Math.cos(a) * radius * (0.5 + r() * 0.5), height + r() * 10, Math.sin(a) * radius * (0.5 + r() * 0.5) - radius * 0.3] as V3,
        s: (2 + r() * 3) * scale,
      }
    })
  }, [count, radius, height, seed, scale])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004
  })
  const mat = toon(color)
  return (
    <group ref={ref}>
      {puffs.map((p, i) => (
        <group key={i} position={p.pos} scale={p.s}>
          <mesh material={mat}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          <mesh material={mat} position={[1.1, -0.2, 0]} scale={0.75}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          <mesh material={mat} position={[-1.0, -0.25, 0.1]} scale={0.65}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
