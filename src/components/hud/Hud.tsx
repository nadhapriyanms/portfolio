import { useEffect, useRef, useState } from 'react'
import { chapters } from '../../content/chapters'
import { useStore, type Quality } from '../../state/store'
import { jumpToChapter } from '../../animation/storyController'
import { ambient, moodForChapter } from '../../audio/ambient'

/** Where a chapter jump lands: interactive chapters open at their settled, explorable moment. */
const landingFor = (id: string) => (id === 'project-skyline' ? 0.5 : id === 'achievement-constellation' ? 0.45 : 0.14)

/** Fixed heads-up layer: identity, chapter progress, chapter menu, sound and comfort settings. */
export function Hud() {
  const chapter = useStore((s) => s.chapter)
  const sound = useStore((s) => s.sound)
  const setSound = useStore((s) => s.setSound)
  const reduced = useStore((s) => s.reducedMotion)
  const setReduced = useStore((s) => s.setReducedMotion)
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  const webgl = useStore((s) => s.webgl)
  const [menu, setMenu] = useState(false)
  const [settings, setSettings] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = chapters[chapter]
  const cyber = ['cyber-city', 'project-skyline', 'achievement-constellation'].includes(current.id)

  useEffect(() => {
    if (sound) ambient.setMood(moodForChapter(current.id))
  }, [current.id, sound])

  useEffect(() => {
    if (!menu && !settings) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false)
        setSettings(false)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(false)
        setSettings(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [menu, settings])

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    if (next) {
      ambient.start()
      ambient.setMood(moodForChapter(current.id))
    } else ambient.stop()
  }

  return (
    <header className={`hud ${cyber ? 'hud--cyber' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button className="hud__brand" onClick={() => jumpToChapter(0, 0)} aria-label="Back to the start">
        <span className="hud__mono">NMS</span>
        <span className="hud__name">Nadhapriyan M. S.</span>
      </button>

      <div className="hud__progress" aria-live="polite">
        <span className="hud__chapter-num">{current.number}</span>
        <span className="hud__chapter-title">{current.title}</span>
      </div>

      <div className="hud__actions" ref={menuRef}>
        <button
          className="hud__btn"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
          title={sound ? 'Sound on' : 'Sound off'}
        >
          <SoundIcon on={sound} />
        </button>
        <button
          className="hud__btn"
          onClick={() => {
            setSettings((v) => !v)
            setMenu(false)
          }}
          aria-expanded={settings}
          aria-controls="hud-settings"
          aria-label="Display settings"
        >
          <GearIcon />
        </button>
        <button
          className="hud__btn hud__btn--wide"
          onClick={() => {
            setMenu((v) => !v)
            setSettings(false)
          }}
          aria-expanded={menu}
          aria-controls="hud-chapters"
        >
          Chapters
        </button>

        {menu && (
          <nav id="hud-chapters" className="hud__panel hud__panel--chapters" aria-label="Story chapters">
            <ol>
              {chapters.map((c, i) => (
                <li key={c.id}>
                  <button
                    className={i === chapter ? 'is-current' : ''}
                    aria-current={i === chapter ? 'step' : undefined}
                    onClick={() => {
                      setMenu(false)
                      jumpToChapter(i, landingFor(c.id))
                    }}
                  >
                    <span>{c.number}</span>
                    {c.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {settings && (
          <div id="hud-settings" className="hud__panel hud__panel--settings" role="group" aria-label="Display settings">
            <label className="toggle">
              <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
              <span>Reduce motion</span>
            </label>
            {webgl !== 'failed' && (
              <fieldset>
                <legend>3D quality</legend>
                {(['high', 'balanced', 'low'] as Quality[]).map((q) => (
                  <label key={q} className="radio">
                    <input type="radio" name="quality" value={q} checked={quality === q} onChange={() => setQuality(q)} />
                    <span>{q === 'high' ? 'High' : q === 'balanced' ? 'Balanced' : 'Low power'}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        )}
      </div>

      <nav className="rail" aria-label="Chapter progress">
        {chapters.map((c, i) => (
          <button
            key={c.id}
            className={`rail__dot ${i === chapter ? 'is-current' : ''} ${i < chapter ? 'is-past' : ''}`}
            onClick={() => jumpToChapter(i, landingFor(c.id))}
            aria-label={`Chapter ${c.number}: ${c.title}`}
            aria-current={i === chapter ? 'step' : undefined}
          >
            <span className="rail__label">{c.nav}</span>
          </button>
        ))}
      </nav>
    </header>
  )
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {on ? (
        <path d="M16 8.5c1.2 1 1.8 2.2 1.8 3.5s-.6 2.5-1.8 3.5M18.6 6c2 1.6 3 3.6 3 6s-1 4.4-3 6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.1 4.6l1.7 1.3-1.8 3.1-2-.8a7.6 7.6 0 01-1.7 1l-.3 2.1h-3.6l-.3-2.1a7.6 7.6 0 01-1.7-1l-2 .8-1.8-3.1 1.7-1.3a7.6 7.6 0 010-2.2L2.6 9.6l1.8-3.1 2 .8a7.6 7.6 0 011.7-1l.3-2.1h3.6l.3 2.1a7.6 7.6 0 011.7 1l2-.8 1.8 3.1-1.7 1.3a7.6 7.6 0 010 2.2z"
        fill="currentColor"
      />
    </svg>
  )
}
