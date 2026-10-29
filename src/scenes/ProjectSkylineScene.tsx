import { useEffect, useMemo } from 'react'
import { Atmosphere, useSceneActive } from '../world/SceneContext'
import * as THREE from 'three'
import { Character, createActor } from '../character/Character'
import { SkyDome } from '../world/props/environment'
import { TowerField, useTowerMaterials, type TowerPlacement } from '../world/kit/Towers'
import { NeonSigns, kanjiSigns } from '../world/kit/CyberDistrict'
import { Drones, glyphPositions } from '../world/props/Drones'
import { ProjectBillboard } from '../projects/ProjectBillboard'
import { projects } from '../projects/projectData'
import { useStore } from '../state/store'
import { focusCamera, releaseCamera } from '../world/cameraOverride'
import { rng } from '../utils/canvasTexture'
import { palette, toon } from '../utils/materials'
import { Beam } from '../world/props/Beam'

const CENTER = new THREE.Vector3(0, 0, 2)
const RADIUS = 20

/** Billboard placements on an arc in front of the rooftop. */
export const billboardPlacements = projects.map((p, i) => {
  const a = THREE.MathUtils.degToRad(-28 + (96 / (projects.length - 1)) * i) // arc sits right of the project index
  // two staggered rows so neighbouring boards never overlap
  const r = i % 2 ? RADIUS + 8 : RADIUS
  const pos = new THREE.Vector3(CENTER.x + Math.sin(a) * r, i % 2 ? 11.5 : 5.6 + (i % 4) * 0.4, CENTER.z - Math.cos(a) * r)
  return { project: p, index: i, pos, rotY: -a }
})

function skylineSpecs(): TowerPlacement[] {
  const r = rng(33)
  const colors = ['#5a5f99', '#4c5088', '#6a64a8', '#45497a']
  const glows = [palette.cyan, palette.magenta, '#ffd9a0', '#9fe8ff', '#ffb0e0']
  const out: TowerPlacement[] = []
  for (let ring = 0; ring < 4; ring++) {
    const R = 16 + ring * 14
    const n = 14 + ring * 6
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.2
      // keep the view toward the billboards open: nothing close in front, only low-rise beyond them
      const front = Math.cos(a) > 0.2
      if (front && R < 40) continue
      const x = Math.sin(a) * R
      const z = 2 - Math.cos(a) * R
      const lowRise = [0, 2, 5, 7]
      const archetype = front ? lowRise[Math.floor(r() * lowRise.length)] : Math.floor(r() * 8)
      out.push({ archetype, x, z, rot: Math.atan2(-x, 2 - z), wall: colors[Math.floor(r() * 4)], glow: glows[Math.floor(r() * glows.length)] })
    }
  }
  return out
}

/** Flies to the selected billboard and releases when the file closes (active scene only). */
function BillboardFocus() {
  const active = useSceneActive()
  const projectId = useStore((s) => s.projectId)
  useEffect(() => {
    if (!active) return
    const b = billboardPlacements.find((x) => x.project.id === projectId)
    if (!b) {
      releaseCamera()
      return
    }
    const normal = new THREE.Vector3(Math.sin(b.rotY), 0, Math.cos(b.rotY))
    focusCamera(b.pos.clone().addScaledVector(normal, 8.5).add(new THREE.Vector3(0, -0.4, 0)), b.pos, 40)
    // leaving the chapter (scene stays mounted) must hand the camera back to the scroll rig
    return () => releaseCamera()
  }, [projectId, active])
  return null
}

/** Chapter 08 — rooftop over the neon skyline; each billboard opens a project file. */
export default function ProjectSkylineScene() {
  const quality = useStore((s) => s.quality)
  const reduced = useStore((s) => s.reducedMotion)
  const actor = useMemo(() => createActor({ pose: 'lookUp', x: 0, z: 3, rotY: Math.PI }), [])
  const towerMats = useTowerMaterials()
  const specs = useMemo(skylineSpecs, [])
  const signs = useMemo(
    () =>
      specs.slice(0, 18).map((t, i) => ({
        text: kanjiSigns[i % kanjiSigns.length],
        color: [palette.magenta, palette.cyan, '#ffd23f'][i % 3],
        pos: [t.x * 0.93, -30 + 14 + (i % 4) * 3, 2 + (t.z - 2) * 0.93] as THREE.Vector3Tuple,
        rot: t.rot,
        size: 4.5,
      })),
    [specs],
  )

  useMemo(() => {
    towerMats.band.color.set('#3a3d72')
    towerMats.frame.color.set('#2c2f5e')
    towerMats.wallDark.color.set('#1a1b3a')
    towerMats.winDark.color.set('#1a1f45')
    towerMats.winLit.color.setScalar(1.6)
    towerMats.sign.color.setScalar(1.8)
  }, [towerMats])

  const formations = useMemo(() => {
    const n = quality === 'low' ? 90 : 180
    const c = new THREE.Vector3(0, 19, -34)
    return [glyphPositions('circuit', n, 7, c), glyphPositions('cycle', n, 7, c), glyphPositions('bolt', n, 7, c), glyphPositions('network', n, 7, c)]
  }, [quality])

  const driver = useMemo(
    () => (t: number) => {
      if (reduced) return { a: 1, b: 1, k: 0 }
      const period = 6
      const i = Math.floor(t / period)
      const k = Math.min(1, ((t % period) / period) * 2.2)
      return { a: i % formations.length, b: (i + 1) % formations.length, k }
    },
    [reduced, formations.length],
  )

  return (
    <>
      <SkyDome colors={{ top: '#05061a', horizon: '#4b1c6e', bottom: '#0b0e2a' }} />
      <BillboardFocus />
      <Atmosphere fog={['#140c35', 30, 110]} shadowTint="#4a3d8a" rim="#2de2e6" rimStrength={0.55} />
      <hemisphereLight args={['#7f8cff', '#2a1a40', 0.7]} />
      <directionalLight position={[-8, 12, 10]} intensity={1.0} color="#b9a6ff" />
      <pointLight position={[0, 3, 6]} intensity={6} distance={14} color={palette.cyan} />

      {/* rooftop */}
      <mesh material={toon('#2c2f4a')} position={[0, -0.25, 1]} receiveShadow>
        <boxGeometry args={[18, 0.5, 14]} />
      </mesh>
      <mesh material={toon('#22243a')} position={[0, -15.5, 1]}>
        <boxGeometry args={[17.6, 30, 13.6]} />
      </mesh>
      {[
        [0, 0.45, -6, 18, 0.9, 0.3],
        [-9, 0.45, 1, 0.3, 0.9, 14],
        [9, 0.45, 1, 0.3, 0.9, 14],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} material={toon('#3a3d5c')} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      ))}
      <Beam a={[-9, 1.2, -6]} b={[9, 1.2, -6]} w={0.06} round material={toon(palette.cyan)} />
      {/* AC units, water tank, antenna */}
      {[
        [-6, 0, 4],
        [-4.6, 0, 4],
        [6.5, 0, 5],
      ].map(([x, , z], i) => (
        <group key={i} position={[x, 0.45, z]}>
          <mesh material={toon('#5b5f80')}>
            <boxGeometry args={[1.2, 0.9, 0.9]} />
          </mesh>
          <mesh material={toon('#22243a')} position={[0, 0, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.02, 16]} />
          </mesh>
        </group>
      ))}
      <group position={[-6.2, 0, -3]}>
        <mesh material={toon('#4a4e70')} position={[0, 2.4, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 2, 16]} />
        </mesh>
        <mesh material={toon('#3a3d5c')} position={[0, 3.6, 0]}>
          <coneGeometry args={[1.2, 0.6, 16]} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <Beam key={x} a={[x, 0, 0]} b={[x, 1.4, 0]} w={0.1} material={toon('#22243a')} />
        ))}
      </group>
      <Beam a={[7, 0, -4]} b={[7, 6, -4]} w={0.08} round material={toon('#5b5f80')} />
      <mesh material={toon(palette.magenta, { emissive: palette.magenta })} position={[7, 6.1, -4]}>
        <sphereGeometry args={[0.12, 8, 8]} />
      </mesh>

      <group position={[0, -30, 0]}>
        <TowerField items={specs} mats={towerMats} />
      </group>

      {billboardPlacements.map((b) => (
        <ProjectBillboard key={b.project.id} project={b.project} index={b.index} position={b.pos} rotationY={b.rotY} />
      ))}

      <NeonSigns signs={signs} />
      <Drones formations={formations} driver={driver} color={palette.cyan} size={quality === 'low' ? 3 : 4} />
      <Character actor={actor} />
    </>
  )
}
