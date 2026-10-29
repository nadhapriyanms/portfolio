import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import gsap from 'gsap'
import { Dialog } from './Dialog'
import { useStore } from '../../state/store'
import { Cycle, createCycleControls } from '../../world/props/Cycle'

type V = [number, number, number]

/** Only features visible in the supplied design renders are annotated. */
const callouts: { id: string; title: string; text: string; at: V; cam: V }[] = [
  { id: 'cargo', title: 'Detachable cargo module', text: 'The renders show the cycle with and without this two-wheel cargo unit: one frame for deliveries and for the daily commute.', at: [-1.55, 0.55, 0], cam: [-1.6, 1.6, 2.6] },
  { id: 'shocks', title: 'Sprung cargo wheels', text: 'Coil-over shocks on each cargo-module wheel, as drawn in the rear views.', at: [-2.06, 0.32, 0.33], cam: [-2.9, 0.7, 1.6] },
  { id: 'rack', title: 'Triangular rear carrier', text: 'A triangulated carrier frame over the rear wheel, which also takes the cargo hitch.', at: [-0.6, 0.93, 0], cam: [-0.9, 1.7, 1.8] },
  { id: 'body', title: 'CLUX body panel & long seat', text: 'Red body panel carrying the CLUX mark, ahead of a long, flat seat.', at: [0.18, 0.86, 0.11], cam: [0.6, 1.3, 1.7] },
  { id: 'brakes', title: 'Disc brakes', text: 'Disc rotors on the front and rear wheels.', at: [0.64, 0.36, 0.08], cam: [1.4, 0.6, 1.2] },
  { id: 'tyres', title: 'Fat-profile tyres', text: 'Wide tyres front and rear, with full fenders.', at: [0.64, 0.06, 0.05], cam: [1.6, 0.4, 1.4] },
  { id: 'drive', title: 'Pedal drivetrain', text: 'Chainring and pedal cranks, as on any cycle — the frame keeps a conventional pedal drivetrain.', at: [-0.02, 0.33, 0.11], cam: [0.3, 0.6, 1.4] },
  { id: 'cockpit', title: 'Cockpit', text: 'Wide handlebar over twin fork legs, with a front lamp housing.', at: [0.42, 1.22, 0], cam: [1.4, 1.7, 1.2] },
]

const OFFSET = new THREE.Vector3(0.4, 0, 0) // model is shifted so the whole rig sits centred
const HOME = { pos: new THREE.Vector3(3.3, 2.0, 5.2), target: new THREE.Vector3(-0.35, 0.55, 0) }

function Spinner({ controls }: { controls: ReturnType<typeof createCycleControls> }) {
  useFrame((_, dt) => {
    controls.spin += dt * 1.2
    controls.crank += dt * 1.2
  })
  return null
}

export function CycleInspector() {
  const open = useStore((s) => s.inspectingCycle)
  const setOpen = useStore((s) => s.setInspectingCycle)
  const reduced = useStore((s) => s.reducedMotion)
  const webgl = useStore((s) => s.webgl)
  const [active, setActive] = useState<string | null>(null)
  const [cargo, setCargo] = useState(true)
  const [rolling, setRolling] = useState(false)
  const orbit = useRef<OrbitControlsImpl | null>(null)
  const controls = useMemo(createCycleControls, [])
  controls.cargo = cargo
  const current = callouts.find((c) => c.id === active)

  const fly = (pos: THREE.Vector3, target: THREE.Vector3) => {
    const o = orbit.current
    if (!o) return
    const cam = o.object
    const d = reduced ? 0 : 0.9
    gsap.to(cam.position, { x: pos.x, y: pos.y, z: pos.z, duration: d, ease: 'power3.inOut', onUpdate: () => o.update() })
    gsap.to(o.target, { x: target.x, y: target.y, z: target.z, duration: d, ease: 'power3.inOut', onUpdate: () => o.update() })
  }

  const focus = (id: string) => {
    const c = callouts.find((x) => x.id === id)
    if (!c) return
    setActive(id)
    if (id === 'cargo' || id === 'shocks') setCargo(true)
    const target = new THREE.Vector3(...c.at).add(OFFSET)
    const cam = new THREE.Vector3(...c.cam).add(OFFSET).sub(target).multiplyScalar(1.35).add(target)
    fly(cam, target)
  }

  const reset = () => {
    setActive(null)
    fly(HOME.pos, HOME.target)
  }

  return (
    <Dialog open={open} onClose={() => setOpen(false)} labelledBy="inspector-title" className="dialog--inspector">
      <div className="inspector">
        <div className="inspector__stage">
          {webgl === 'ok' ? (
            <Canvas flat shadows dpr={[1, 1.75]} camera={{ position: HOME.pos.toArray() as V, fov: 36 }} aria-label="Interactive 3D model of the cargo-cum-commute electric cycle">
              <color attach="background" args={['#ece0c8']} />
              <hemisphereLight args={['#fff4e2', '#6d6458', 1.3]} />
              <directionalLight position={[3, 5, 3]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
              <Suspense fallback={null}>
                <group position={OFFSET.toArray() as V}>
                  <Cycle controls={controls} />
                  {callouts.map((c, i) => (
                    <Html key={c.id} position={c.at} center zIndexRange={[20, 0]}>
                      <button
                        className={`hotspot ${active === c.id ? 'is-active' : ''}`}
                        onClick={() => focus(c.id)}
                        aria-label={c.title}
                        hidden={!cargo && (c.id === 'cargo' || c.id === 'shocks')}
                      >
                        {i + 1}
                      </button>
                    </Html>
                  ))}
                </group>
                <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={8} blur={2.4} far={2} />
              </Suspense>
              {rolling && !reduced && <Spinner controls={controls} />}
              <OrbitControls
                ref={orbit}
                target={HOME.target}
                enablePan={false}
                enableDamping
                minDistance={1.2}
                maxDistance={7}
                minPolarAngle={0.2}
                maxPolarAngle={Math.PI / 2 - 0.04}
              />
            </Canvas>
          ) : (
            <p className="inspector__fallback">3D is unavailable on this device — the component notes are listed alongside.</p>
          )}
          <div className="inspector__toolbar">
            <button className="btn btn--small" onClick={reset}>
              Reset view
            </button>
            <button className="btn btn--small" aria-pressed={!cargo} onClick={() => setCargo((v) => !v)}>
              {cargo ? 'Detach cargo module' : 'Attach cargo module'}
            </button>
            {!reduced && (
              <button className="btn btn--small" aria-pressed={rolling} onClick={() => setRolling((v) => !v)}>
                {rolling ? 'Stop wheels' : 'Spin wheels'}
              </button>
            )}
          </div>
        </div>
        <aside className="inspector__side">
          <p className="panel__eyebrow">Inspection mode</p>
          <h2 id="inspector-title">Cargo-cum-Commute Electric Cycle</h2>
          <p className="muted">Drag to orbit, scroll or pinch to zoom. Pick a component to fly to it.</p>
          <ol className="callouts">
            {callouts.map((c, i) => (
              <li key={c.id}>
                <button className={active === c.id ? 'is-active' : ''} onClick={() => focus(c.id)} aria-pressed={active === c.id}>
                  <span>{i + 1}</span>
                  {c.title}
                </button>
                {active === c.id && <p>{c.text}</p>}
              </li>
            ))}
          </ol>
          {current == null && <p className="fine">Winner, Bharath Cycle Design Challenge · Design and utility/prototype patent applications filed.</p>}
          <p className="fine">Illustrative interpretation of the CLUX design renders — proportions approximate, not production CAD.</p>
          <button className="btn btn--primary" onClick={() => setOpen(false)}>
            Close and return
          </button>
        </aside>
      </div>
    </Dialog>
  )
}
