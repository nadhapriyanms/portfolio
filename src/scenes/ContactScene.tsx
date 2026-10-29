import { useMemo } from 'react'
import { Atmosphere } from '../world/SceneContext'
import { Character, createActor } from '../character/Character'
import { Globe } from '../world/props/Globe'
import { Clouds, SkyDome } from '../world/props/environment'
import { TowerField, useTowerMaterials, type TowerPlacement } from '../world/kit/Towers'
import { TreeInstances } from '../world/kit/Trees'
import { Beam } from '../world/props/Beam'
import { rng } from '../utils/canvasTexture'
import { palette, toon } from '../utils/materials'

function townSpecs(): TowerPlacement[] {
  const r = rng(61)
  const colors = ['#f2d3b8', '#e9c9a0', '#d9b9c0', '#cfd8c4', '#f0e2c8']
  const out: TowerPlacement[] = []
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI * 0.9 + r() * Math.PI * 0.8
    const R = 30 + r() * 70
    const x = Math.cos(a) * R
    const z = Math.sin(a) * R
    const lowRise = [0, 2, 5, 7]
    out.push({ archetype: lowRise[Math.floor(r() * lowRise.length)], x, z, rot: Math.atan2(-x, 10 - z), wall: colors[Math.floor(r() * colors.length)], glow: '#ffe2b0' })
  }
  return out
}

/** Chapter 10 — dawn on an overlook; the opening globe returns to close the loop. */
export default function ContactScene() {
  const actor = useMemo(() => createActor({ pose: 'wave', x: -1.25, z: 3.3, rotY: Math.PI * 0.72 }), [])
  const towerMats = useTowerMaterials()
  const specs = useMemo(townSpecs, [])
  useMemo(() => towerMats.winLit.color.setScalar(0.45), [towerMats])

  return (
    <>
      <SkyDome colors={{ top: '#8fb7d6', horizon: '#f8c39a', bottom: '#d9a48c' }} clouds={0.5} cloudColor="#fff2e6" />
      <Atmosphere fog={['#f3cfae', 40, 160]} shadowTint="#a39ac4" rim="#ffd6b0" rimStrength={0.25} />
      <hemisphereLight args={['#fff0dc', '#9a7a6c', 1.2]} />
      <directionalLight position={[20, 8, -30]} intensity={2.2} color="#ffd2a0" />

      {/* stone overlook with railing */}
      <mesh material={toon('#c9b79a')} position={[0, -0.3, 0.5]} receiveShadow>
        <boxGeometry args={[8, 0.6, 6]} />
      </mesh>
      <mesh material={toon('#a8957a')} position={[0, -6, 0.5]}>
        <boxGeometry args={[7.6, 11, 5.6]} />
      </mesh>
      {[-3.8, -1.9, 0, 1.9, 3.8].map((x) => (
        <Beam key={x} a={[x, 0, -2.4]} b={[x, 1.05, -2.4]} w={0.08} round material={toon(palette.ink)} />
      ))}
      <Beam a={[-3.9, 1.05, -2.4]} b={[3.9, 1.05, -2.4]} w={0.08} round material={toon(palette.ink)} />
      {/* a bench */}
      <group position={[2.6, 0, 1.6]}>
        <mesh material={toon(palette.wood)} position={[0, 0.45, 0]}>
          <boxGeometry args={[1.6, 0.08, 0.5]} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} material={toon(palette.ink)} position={[x, 0.22, 0]}>
            <boxGeometry args={[0.06, 0.44, 0.45]} />
          </mesh>
        ))}
      </group>

      <group position={[0, -24, -10]}>
        <TowerField items={specs} mats={towerMats} />
        <TreeInstances kind="broad" seed={41} items={[{ x: -8, z: 4, scale: 2 }, { x: 6, z: 2, scale: 1.8 }, { x: -2, z: -6, scale: 2.2 }, { x: 14, z: -4, scale: 2 }]} />
      </group>
      <Clouds count={9} radius={70} height={12} seed={12} color="#fff4ea" scale={1.2} />

      <group position={[9, 8, -30]}>
        <Globe radius={5} />
      </group>

      <Character actor={actor} />
    </>
  )
}
