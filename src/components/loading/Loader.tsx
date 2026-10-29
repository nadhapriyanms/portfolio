import { useEffect, useState } from 'react'
import { useStore } from '../../state/store'

/** Ink-and-paper title card shown while fonts and the opening scene load. */
export function Loader() {
  const ready = useStore((s) => s.ready)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => setGone(true), 900)
    return () => window.clearTimeout(t)
  }, [ready])
  if (gone) return null
  return (
    <div className={`loader ${ready ? 'is-done' : ''}`} role="status" aria-live="polite">
      <div className="loader__card">
        <p className="loader__mono">NMS</p>
        <div className="loader__line" aria-hidden="true">
          <i />
        </div>
        <p className="loader__text">{ready ? 'Ready' : 'Inking the world…'}</p>
      </div>
    </div>
  )
}
