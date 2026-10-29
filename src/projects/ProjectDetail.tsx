import { Suspense, useEffect, useState, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Dialog } from '../components/overlays/Dialog'
import { projectById, projects } from './projectData'
import { ProjectModel } from './ProjectModels'
import { useStore } from '../state/store'
import { chapters } from '../content/chapters'
import { ambient } from '../audio/ambient'

/** Project file: opens after the camera has flown to the billboard; closing restores the view. */
export function ProjectDetail() {
  const id = useStore((s) => s.projectId)
  const open = useStore((s) => s.openProject)
  const chapter = useStore((s) => s.chapter)
  const reduced = useStore((s) => s.reducedMotion)
  const webgl = useStore((s) => s.webgl)
  const [shown, setShown] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setShown(null)
      return
    }
    ambient.blip(740)
    const flying = chapters[chapter].id === 'project-skyline' && !reduced && webgl === 'ok'
    const t = window.setTimeout(() => setShown(id), flying ? 700 : 0)
    return () => window.clearTimeout(t)
  }, [id, chapter, reduced, webgl])

  const p = shown ? projectById(shown) : undefined
  const index = p ? projects.indexOf(p) : -1
  const step = (d: number) => {
    const next = projects[(index + d + projects.length) % projects.length]
    open(next.id)
    setShown(next.id)
  }

  return (
    <Dialog open={!!p} onClose={() => open(null)} labelledBy="project-title" className="dialog--project">
      {p && (
        <div className="project" style={{ '--accent': p.accent } as CSSProperties}>
          <div className="project__visual">
            {webgl === 'ok' ? (
              <Canvas flat dpr={[1, 1.5]} camera={{ position: [3.1, 1.8, 3.7], fov: 38 }} aria-hidden="true">
                <color attach="background" args={['#0f1230']} />
                <hemisphereLight args={['#cfe3ff', '#2a2440', 1.2]} />
                <directionalLight position={[3, 4, 2]} intensity={2.2} />
                <Suspense fallback={null}>
                  <ProjectModel kind={p.model} accent={p.accent} animate={!reduced} />
                </Suspense>
                <OrbitControls enablePan={false} minDistance={2.2} maxDistance={6} enableDamping />
              </Canvas>
            ) : (
              <div className="project__visual-fallback" aria-hidden="true">
                {p.short}
              </div>
            )}
            <p className="project__visual-note">Illustrative model · drag to rotate</p>
          </div>
          <div className="project__body">
            <p className="panel__eyebrow">
              File {String(index + 1).padStart(2, '0')} · {p.category}
            </p>
            <h2 id="project-title">{p.title}</h2>
            <p className="project__summary">{p.summary}</p>
            <dl className="project__facts">
              {p.problem && (
                <div>
                  <dt>Problem</dt>
                  <dd>{p.problem}</dd>
                </div>
              )}
              {p.approach && (
                <div>
                  <dt>Approach</dt>
                  <dd>
                    <ul>
                      {p.approach.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              <div>
                <dt>Technologies</dt>
                <dd className="chips">
                  {p.technologies.map((t) => (
                    <span className="chip" key={t}>
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
              {p.outcome && (
                <div>
                  <dt>Outcome</dt>
                  <dd>{p.outcome}</dd>
                </div>
              )}
              <div>
                <dt>Status</dt>
                <dd>{p.status}</dd>
              </div>
            </dl>
            <p className="fine">Source: {p.source}</p>
            <div className="project__nav">
              <button className="btn btn--small" onClick={() => step(-1)} aria-label="Previous project">
                ← Prev
              </button>
              <button className="btn btn--small" onClick={() => step(1)} aria-label="Next project">
                Next →
              </button>
              <button className="btn btn--small btn--primary" onClick={() => open(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
