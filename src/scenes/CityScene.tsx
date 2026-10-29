import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Character, createActor } from '../character/Character'
import { Cycle, createCycleControls, WHEEL_R } from '../world/props/Cycle'
import { Road, SkyDome, StreetLamp, type SkyUniforms } from '../world/props/environment'
import { TowerField, streetTowers, useTowerMaterials } from '../world/kit/Towers'
import { StreetProps, type PropItem } from '../world/kit/StreetProps'
import { TreeInstances } from '../world/kit/Trees'
import { Cables, ElevatedLine, HoloShield, HoverTraffic, kanjiSigns, LightCones, NeonSigns, Rain, Searchlights, Steam, WetRoad } from '../world/kit/CyberDistrict'
import { Atmosphere, useActiveRef } from '../world/SceneContext'
import { chapterIndexById, chapterStarts, chapters } from '../content/chapters'
import { story, useStore } from '../state/store'
import { canvasTexture, fonts, lerp, range, rng, smooth } from '../utils/canvasTexture'
import { celUniforms, palette, toon } from '../utils/materials'

const CH_RIDE = chapterIndexById('ride-transition')
const CH_CYBER = chapterIndexById('cyber-city')
const T0 = chapterStarts[CH_RIDE]
const T1 = chapterStarts[CH_CYBER]
const T2 = T1 + chapters[CH_CYBER].weight
const UNITS = 30 // world units travelled per timeline unit at cruising speed

/** Rider speed over story time: cruise, brake to a stop at the anomaly, wait, then race through the security layer. */
function speedAt(t: number) {
  if (t < T1) {
    const u = (t - T0) / (T1 - T0)
    if (u < 0.52) return 1
    if (u < 0.62) return 1 - smooth(range(u, 0.52, 0.62))
    if (u < 0.9) return 0
    return smooth(range(u, 0.9, 1)) * 1.2
  }
  return lerp(1.2, 1.7, smooth(range(t, T1, T1 + 0.5)))
}

const STEPS = 600
const distTable = (() => {
  const out = new Float32Array(STEPS + 1)
  const dt = (T2 - T0) / STEPS
  for (let i = 1; i <= STEPS; i++) out[i] = out[i - 1] + speedAt(T0 + (i - 0.5) * dt) * dt * UNITS
  return out
})()

/** Distance travelled (world units) at story time t. */
export function rideDistance(t: number) {
  const f = Math.min(STEPS, Math.max(0, ((t - T0) / (T2 - T0)) * STEPS))
  const i = Math.floor(f)
  return i >= STEPS ? distTable[STEPS] : lerp(distTable[i], distTable[i + 1], f - i)
}

const STOP_Z = -rideDistance(T0 + chapters[CH_RIDE].weight * 0.75)
const zAtCyber = (c: number) => -rideDistance(T1 + chapters[CH_CYBER].weight * c)

const neonWords = ['SCAN', 'PATCH', 'AUDIT', 'CVSS', 'NODE 07', 'AUTH', 'RISK', 'LOGS', 'PORT 443', 'SECURE']

function neonTexture(word: string, color: string, width = 512) {
  return canvasTexture(`neon-${word}-${color}-${width}`, width, 160, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(8,10,30,0.88)'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = color
    ctx.lineWidth = 6
    ctx.strokeRect(8, 8, w - 16, h - 16)
    ctx.shadowColor = color
    ctx.shadowBlur = 24
    ctx.fillStyle = color
    let size = 96
    ctx.font = `800 ${size}px ${fonts.display}`
    while (ctx.measureText(word).width > w - 70 && size > 30) ctx.font = `800 ${(size -= 4)}px ${fonts.display}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(word, w / 2, h / 2 + 6)
  })
}

function streetSignTexture() {
  return canvasTexture('street-sign', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2f6b4f'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#f3e9d7'
    ctx.lineWidth = 10
    ctx.strokeRect(14, 14, w - 28, h - 28)
    ctx.fillStyle = '#f3e9d7'
    ctx.font = `800 84px ${fonts.display}`
    ctx.textAlign = 'center'
    ctx.fillText('CYCLE LANE', w / 2, 120)
    ctx.font = `500 34px ${fonts.mono}`
    ctx.fillText('→ CITY CENTRE', w / 2, 190)
  })
}

function vulnTexture() {
  return canvasTexture('vuln-billboard', 1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#070a24'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = palette.magenta
    ctx.lineWidth = 8
    ctx.strokeRect(10, 10, w - 20, h - 20)
    ctx.fillStyle = palette.cyan
    ctx.font = `500 30px ${fonts.mono}`
    ctx.fillText('> ASSESSMENT // INSTITUTIONAL WEB PORTALS', 44, 70)
    ctx.fillStyle = '#ffffff'
    ctx.font = `900 92px ${fonts.display}`
    ctx.fillText('VULNERABILITY', 44, 168)
    ctx.fillText('ASSESSMENT', 44, 254)
    ctx.font = `500 28px ${fonts.mono}`
    ctx.fillStyle = '#93a5d6'
    ctx.fillText('TOOL: NESSUS    PRIORITY: CVSS SCORE × RISK IMPACT', 44, 310)
    // illustrative severity bars (no real findings)
    const bars: [string, string][] = [
      ['CRITICAL', '#ff3caa'],
      ['HIGH', '#ff8a4c'],
      ['MEDIUM', '#ffd23f'],
      ['LOW', '#2de2e6'],
    ]
    bars.forEach(([label, c], i) => {
      const y = 350 + i * 36
      ctx.fillStyle = c
      ctx.font = `500 22px ${fonts.mono}`
      ctx.fillText(label, 44, y + 20)
      ctx.globalAlpha = 0.85
      ctx.fillRect(200, y + 4, 140 + i * 90, 20)
      ctx.globalAlpha = 1
    })
    ctx.fillStyle = '#6f7db0'
    ctx.font = `400 20px ${fonts.mono}`
    ctx.fillText('severity bands shown for illustration', 640, 488)
    void h
  })
}

function gridTexture() {
  return canvasTexture(
    'cyber-grid',
    256,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(45,226,230,0.9)'
      ctx.lineWidth = 3
      ctx.strokeRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(255,60,170,0.5)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(w / 2, 0)
      ctx.lineTo(w / 2, h)
      ctx.stroke()
    },
    { repeat: true },
  )
}

/** Chapters 06–07 — the ride through town and its transformation into the security layer. */
export default function CityScene() {
  const quality = useStore((s) => s.quality)
  const reduced = useStore((s) => s.reducedMotion)
  const rider = useRef<THREE.Group>(null)
  const actor = useMemo(() => createActor({ pose: 'ride' }), [])
  const cycle = useMemo(() => {
    const c = createCycleControls()
    c.cargo = false
    return c
  }, [])
  const active = useActiveRef()
  const towerMats = useTowerMaterials()
  const towers = useMemo(
    () =>
      streetTowers(21, 30, -270, 7.6, ['#e7d3b1', '#d9b9a0', '#cfd8c4', '#e9c9a0', '#c9b79a', '#d8c2c9', '#b9c3cf'], [
        '#ffd9a0',
        '#ffd9a0',
        palette.cyan,
        palette.magenta,
        '#ffb0e0',
        '#9fe8ff',
      ]),
    [],
  )
  const lowQ = quality === 'low'
  const sky = useRef<SkyUniforms | null>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const fog = useRef<THREE.Fog | null>(null)
  const tiles = useRef<THREE.Group>(null)
  const sparks = useRef<THREE.Points>(null)

  const mats = useMemo(() => {
    const neon = neonWords.map((w, i) => {
      const color = i % 2 ? palette.magenta : palette.cyan
      return new THREE.MeshBasicMaterial({ map: neonTexture(w, color), transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    })
    return {
      neon,
      lamp: new THREE.MeshBasicMaterial({ color: '#fff1c4', toneMapped: false }),
      grid: new THREE.MeshBasicMaterial({ map: (() => { const tx = gridTexture(); tx.repeat.set(4, 160); return tx })(), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
      vuln: new THREE.MeshBasicMaterial({ map: vulnTexture(), transparent: true, opacity: 0, toneMapped: false }),
      gantry: new THREE.MeshBasicMaterial({ map: neonTexture('ENTER THE SECURITY LAYER', palette.cyan, 1100), transparent: true, opacity: 0, toneMapped: false }),
      sign: toon('#ffffff', { map: streetSignTexture() }, 'city-sign'),
      shop: toon('#e8774a', {}, 'city-shopband'),
      sparks: new THREE.PointsMaterial({ color: palette.cyan, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    }
  }, [])

  // Signage on both kerbs: vertical Japanese signs that stick out over the pavement, English boards flat on the facades.
  const neonSigns = useMemo(() => {
    const r = rng(5)
    const colors = [palette.magenta, palette.cyan, '#ffd23f', '#7cf2c9', '#ff8a4c']
    return Array.from({ length: 44 }, (_, i) => {
      const side = i % 2 ? 1 : -1
      const vertical = i % 3 !== 2
      const text = vertical ? kanjiSigns[i % kanjiSigns.length] : neonWords[i % neonWords.length]
      return {
        text,
        color: colors[(i * 3) % colors.length],
        pos: [side * (vertical ? 6.6 : 7.45), vertical ? 5 + r() * 7 : 4 + r() * 9, 12 - i * 6.2 - r() * 2] as THREE.Vector3Tuple,
        rot: vertical ? 0 : side > 0 ? -Math.PI / 2 : Math.PI / 2,
        size: vertical ? 3 + r() * 1.6 : 3.4 + r() * 1.6,
      }
    })
  }, [])

  const lampZs = useMemo(() => Array.from({ length: 15 }, (_, i) => 18 - i * 20), [])
  const cones = useMemo(
    () =>
      lampZs.map((z, i) => ({
        pos: [(i % 2 ? 5.2 : -5.2) + (i % 2 ? -0.9 : 0.9), 5.0, z] as THREE.Vector3Tuple,
        color: i % 3 === 0 ? '#ff6ac8' : '#9fe8ff',
        h: 5,
        r: 1.6,
      })),
    [lampZs],
  )
  const props = useMemo<PropItem[]>(() => {
    const items: PropItem[] = []
    const r = rng(31)
    const kinds: PropItem['type'][] = ['vending', 'bin', 'cabinet', 'hydrant', 'planter', 'bollard', 'cone', 'bench']
    for (let z = 20; z > -260; z -= 9) {
      const side = r() < 0.5 ? -1 : 1
      const type = kinds[Math.floor(r() * kinds.length)]
      items.push({ type, x: side * (5.4 + r() * 0.8), z, rot: side < 0 ? Math.PI / 2 : -Math.PI / 2 })
      if (r() < 0.4) items.push({ type: 'manhole', x: (r() - 0.5) * 4, z: z - 3 })
    }
    items.push({ type: 'crosswalk', x: 0, z: -60, w: 8, rot: Math.PI / 2 })
    items.push({ type: 'crosswalk', x: 0, z: -150, w: 8, rot: Math.PI / 2 })
    return items
  }, [])
  const trees = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ x: i % 2 ? 6.4 : -6.4, z: 14 - i * 9.5, scale: 0.85 })), [])
  const vents = useMemo<THREE.Vector3Tuple[]>(() => [-70, -95, -120, -150, -180, -205].map((z, i) => [i % 2 ? 2 : -1.5, 0.05, z]), [])

  // Glitching street sign split into tiles that scatter when the anomaly hits.
  const signTiles = useMemo(() => {
    const out: { geo: THREE.PlaneGeometry; home: THREE.Vector3; dir: THREE.Vector3 }[] = []
    const r = rng(77)
    const cols = 8
    const rows = 4
    const W = 2.4
    const H = 1.2
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const g = new THREE.PlaneGeometry(W / cols, H / rows)
        const uv = g.attributes.uv as THREE.BufferAttribute
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / cols, (j + uv.getY(k)) / rows)
        out.push({
          geo: g,
          home: new THREE.Vector3(-W / 2 + (i + 0.5) * (W / cols), -H / 2 + (j + 0.5) * (H / rows), 0),
          dir: new THREE.Vector3((r() - 0.5) * 2, (r() - 0.3) * 1.6, r() * 1.5),
        })
      }
    return out
  }, [])

  const sparkGeo = useMemo(() => {
    const r = rng(9)
    const n = quality === 'low' ? 120 : 360
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) pos.set([(r() < 0.5 ? -1 : 1) * (7.6 + r() * 6), r() * 30, 20 - r() * 260], i * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [quality])

  const col = useMemo(
    () => ({
      white: new THREE.Color('#ffffff'),
      navy: new THREE.Color('#3b3f7e'),
      navyDark: new THREE.Color('#2a2c5c'),
      navyDeep: new THREE.Color('#161733'),
      band: new THREE.Color('#e8e2d6'),
      wallDark: new THREE.Color('#6a6470'),
      glassDay: new THREE.Color('#5d7486'),
      glassNight: new THREE.Color('#1a1f45'),
      shadowDay: new THREE.Color('#8f9cc4'),
      shadowNight: new THREE.Color('#3d2f80'),
      rimDay: new THREE.Color('#ffe6c8'),
      warmGlow: new THREE.Color('#ffcf8a'),
      cyan: new THREE.Color(palette.cyan),
      magenta: new THREE.Color(palette.magenta),
      skyTop: [new THREE.Color('#87a9c6'), new THREE.Color('#05061a')],
      skyHor: [new THREE.Color('#f4a46c'), new THREE.Color('#3a1a6a')],
      fog: [new THREE.Color('#e9b994'), new THREE.Color('#120b33')],
      sun: [new THREE.Color('#ffc58a'), new THREE.Color('#6a4cff')],
    }),
    [],
  )

  useFrame((state) => {
    if (!active.current) return
    const t = story.time
    const d = rideDistance(t)
    const z = -d
    story.anchor.x = 0.9
    story.anchor.y = 0
    story.anchor.z = z
    if (rider.current) rider.current.position.set(0.9, 0, z)
    cycle.spin = d / WHEEL_R
    cycle.crank = d / (WHEEL_R * 2.2)
    actor.phase = cycle.crank
    const stopped = speedAt(t) < 0.02
    actor.pose = 'ride'

    const u = range(t, T0, T1)
    const c = story.fx.cyber
    const g = story.fx.glitch

    // ── the anomaly: tiles of the street sign break apart
    if (tiles.current) {
      const burst = smooth(range(u, 0.66, 0.92)) + (t >= T1 ? 1 : 0)
      const jitter = reduced ? 0 : g
      tiles.current.children.forEach((m, i) => {
        const tl = signTiles[i]
        const k = Math.min(1, burst) * (0.6 + (i % 5) * 0.12)
        m.position.copy(tl.home).addScaledVector(tl.dir, k * 2.4)
        m.position.x += jitter > 0.1 && Math.sin(state.clock.elapsedTime * 40 + i) > 0.6 ? (Math.random() - 0.5) * 0.2 : 0
        m.visible = !(burst > 0.98 && i % 3 === 0)
        ;(m as THREE.Mesh).rotation.z = k * (i % 2 ? 0.8 : -0.6)
      })
    }

    // ── streetlights flicker while the anomaly builds, then go neon
    const flicker = u > 0.55 && u < 0.92 && !reduced ? (Math.sin(state.clock.elapsedTime * 31) > 0.2 ? 1 : 0.15) : 1
    mats.lamp.color.lerpColors(col.warmGlow, col.cyan, c).multiplyScalar(flicker)

    // ── materials shift from sunset to the security layer
    towerMats.wall.color.lerpColors(col.white, col.navy, c)
    towerMats.band.color.lerpColors(col.band, col.navyDark, c)
    towerMats.frame.color.lerpColors(col.band, col.navyDark, c)
    towerMats.wallDark.color.lerpColors(col.wallDark, col.navyDeep, c)
    towerMats.winDark.color.lerpColors(col.glassDay, col.glassNight, c)
    towerMats.winLit.color.setScalar(lerp(0.32, 1.7, c))
    towerMats.sign.color.setScalar(lerp(0.5, 1.8, c))
    celUniforms.uShadowTint.value.lerpColors(col.shadowDay, col.shadowNight, c)
    celUniforms.uRimColor.value.lerpColors(col.rimDay, col.cyan, c)
    celUniforms.uRimStrength.value = lerp(0.18, 0.6, c)
    mats.grid.opacity = c * 0.22
    mats.vuln.opacity = range(c, 0.5, 1)
    mats.gantry.opacity = range(c, 0.5, 1)
    mats.sparks.opacity = c * 0.9
    mats.grid.map!.offset.y = -d * 0.25
    if (sparks.current && !reduced) {
      const p = sparks.current.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + 0.08
        if (y > 30) y = 0
        p.setY(i, y)
      }
      p.needsUpdate = true
    }
    if (sky.current) {
      sky.current.uTop.value.lerpColors(col.skyTop[0], col.skyTop[1], c)
      sky.current.uHorizon.value.lerpColors(col.skyHor[0], col.skyHor[1], c)
      sky.current.uSunSize.value = 0.03 * (1 - c)
      sky.current.uSun.value.set(0.25, 0.08, -1).normalize()
    }
    if (fog.current) fog.current.color.lerpColors(col.fog[0], col.fog[1], c)
    if (hemi.current) hemi.current.intensity = lerp(1.05, 0.55, c)
    if (sun.current) {
      sun.current.intensity = lerp(2.3, 0.9, c)
      sun.current.color.lerpColors(col.sun[0], col.sun[1], c)
      sun.current.position.set(10, 14, z - 4)
      sun.current.target.position.set(0, 0, z - 12)
      sun.current.target.updateMatrixWorld()
    }
    void stopped
  })

  const cyberZ = useMemo(() => ({ gantry: zAtCyber(0.12) - 26, vuln: zAtCyber(0.58) - 17 }), [])

  return (
    <>
      <SkyDome colors={{ top: '#87a9c6', horizon: '#f4a46c', bottom: '#5a5048' }} uniformsRef={sky} clouds={0.45} cloudColor="#ffe8d0" />
      <Atmosphere fogRef={fog} fog={['#e9b994', 40, 140]} shadowTint="#8f9cc4" rim="#ffe6c8" rimStrength={0.18} />
      <hemisphereLight ref={hemi} args={['#ffe7cc', '#5c4f5a', 1.05]} />
      <directionalLight
        ref={sun}
        intensity={2.3}
        castShadow={quality !== 'low'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0006}
      />

      <Road zFrom={40} zTo={-280} width={8} walk={3} />
      <mesh material={mats.grid} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -120]}>
        <planeGeometry args={[8, 320]} />
      </mesh>
      <TowerField items={towers} mats={towerMats} />
      <WetRoad zFrom={40} zTo={-280} width={14} />
      <StreetProps items={props} />
      <TreeInstances kind="broad" seed={11} items={trees} />
      <Cables zFrom={-40} zTo={-270} half={8} />
      <ElevatedLine z={zAtCyber(0.35) - 30} />
      <HoloShield position={[0, 17, zAtCyber(0.75) - 30]} scale={2.2} />
      <Searchlights spots={[[-30, 30, zAtCyber(0.5) - 60], [26, 34, zAtCyber(0.8) - 70], [-18, 40, zAtCyber(1) - 50]]} />
      {!lowQ && <HoverTraffic zFrom={0} zTo={-270} />}
      {!lowQ && <Rain count={quality === 'high' ? 1800 : 900} />}
      <Steam vents={vents} />
      <LightCones cones={cones} />
      <NeonSigns signs={neonSigns} />

      {/* awnings on the ground floors keep the street human-scale */}
      {lampZs.map((z, i) => (
        <group key={z}>
          <StreetLamp position={[i % 2 ? 5.2 : -5.2, 0, z]} rotation={i % 2 ? Math.PI : 0} lampMat={mats.lamp} />
          <mesh material={mats.shop} position={[i % 2 ? -7.3 : 7.3, 3.1, z + 6]}>
            <boxGeometry args={[0.6, 0.18, 5]} />
          </mesh>
        </group>
      ))}


      {/* the sign where the anomaly starts */}
      <group position={[4.6, 0, STOP_Z - 6]} rotation={[0, -0.5, 0]}>
        <mesh material={toon('#3b3a44')} position={[0, 1.4, -0.05]}>
          <cylinderGeometry args={[0.06, 0.06, 2.8, 8]} />
        </mesh>
        <group ref={tiles} position={[0, 2.9, 0]}>
          {signTiles.map((tl, i) => (
            <mesh key={i} geometry={tl.geo} material={mats.sign} position={tl.home} />
          ))}
        </group>
      </group>

      {/* gantry across the street and the assessment billboard */}
      <group position={[0, 0, cyberZ.gantry]}>
        {[-6, 6].map((x) => (
          <mesh key={x} material={toon('#1b1d3a')} position={[x, 4, 0]}>
            <boxGeometry args={[0.4, 8, 0.4]} />
          </mesh>
        ))}
        <mesh material={mats.gantry} position={[0, 7.4, 0]}>
          <planeGeometry args={[11, 2.1]} />
        </mesh>
      </group>
      <group position={[7.3, 7, cyberZ.vuln]} rotation={[0, -Math.PI / 2 + 0.25, 0]}>
        <mesh material={mats.vuln}>
          <planeGeometry args={[9, 4.5]} />
        </mesh>
      </group>

      <points ref={sparks} geometry={sparkGeo} material={mats.sparks} />

      <group ref={rider} rotation={[0, Math.PI / 2, 0]}>
        <Cycle controls={cycle} />
        <group position={[-0.2, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Character actor={actor} />
        </group>
      </group>
    </>
  )
}
