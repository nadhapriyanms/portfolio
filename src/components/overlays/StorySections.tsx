import type { CSSProperties, ReactNode } from 'react'
import { chapters } from '../../content/chapters'
import { certifications, degree, profile, schooling, toolkit, ventures } from '../../content/profile'
import { achievements } from '../../content/achievements'
import { projects, projectById } from '../../projects/projectData'
import { useStore } from '../../state/store'
import { jumpToChapter } from '../../animation/storyController'
import { ambient } from '../../audio/ambient'

function Chapter({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const ch = chapters.find((c) => c.id === id)!
  const last = id === chapters[chapters.length - 1].id
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className={`chapter chapter--${id} ${className}`}
      style={{ '--w': ch.weight + (last ? 1 : 0) } as CSSProperties}
    >
      {children}
    </section>
  )
}

function Beat({ at, align = 'left', children, sticky = false, span }: { at: number; align?: 'left' | 'right' | 'center'; children: ReactNode; sticky?: boolean; span?: number }) {
  return (
    <div className={`beat beat--${align} ${sticky ? 'beat--sticky' : ''}`} style={{ '--at': at, '--span': span ?? 0 } as CSSProperties}>
      {sticky ? <div className="beat__sticky">{children}</div> : children}
    </div>
  )
}

function Tag({ id }: { id: string }) {
  const ch = chapters.find((c) => c.id === id)!
  return (
    <p className="tag">
      <span>CH {ch.number}</span> {ch.title}
    </p>
  )
}

function ProjectButton({ id, label = 'Open project file' }: { id: string; label?: string }) {
  const open = useStore((s) => s.openProject)
  return (
    <button className="btn btn--small" onClick={() => open(id)}>
      {label}
    </button>
  )
}

const skyEntries = [
  ...achievements.map((a) => ({ id: a.id, badge: a.badge, title: a.title })),
  { id: 'learning', badge: 'Certifications', title: 'Always learning' },
]

/** Details for the selected constellation (or the certifications when none / "learning"). */
function SkyDetail() {
  const id = useStore((s) => s.achievementId)
  const setAchievement = useStore((s) => s.setAchievement)
  const selected = achievements.find((a) => a.id === id)
  return (
    <div className="achievements__detail sky-detail panel panel--dark" aria-live="polite">
      {id && (
        <button className="sky-detail__close" onClick={() => setAchievement(null)} aria-label="Close details">
          ×
        </button>
      )}
      {selected ? (
        <>
          <p className="panel__eyebrow">{selected.badge}</p>
          <h3>{selected.title}</h3>
          <p>{selected.detail}</p>
          {selected.projectId && <ProjectButton id={selected.projectId} />}
        </>
      ) : (
        <>
          <p className="panel__eyebrow">Always learning</p>
          <h3>Certifications</h3>
          <ul className="certs">
            {certifications.map((c) => (
              <li key={c.name}>
                {c.name} <span>— {c.issuer}</span>
                {c.status === 'Ongoing' && <em> · ongoing</em>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function StorySections() {
  const openProject = useStore((s) => s.openProject)
  const setInspecting = useStore((s) => s.setInspectingCycle)
  const achievementId = useStore((s) => s.achievementId)
  const setAchievement = useStore((s) => s.setAchievement)
  const hover = useStore((s) => s.hoverProjectId)
  const setHover = useStore((s) => s.setHoverProject)
  const webgl = useStore((s) => s.webgl)

  return (
    <main id="story">
      <span id="main-content" tabIndex={-1} />

      {/* 01 ─ THE GLOBE */}
      <Chapter id="hero-globe">
        <div className="hero">
          <h1 id="hero-globe-title" className="hero__title">
            Nadhapriyan <span>M. S.</span>
          </h1>
          <p className="hero__tagline">{profile.tagline}</p>
          <div className="hero__actions">
            <button className="btn btn--primary" onClick={() => jumpToChapter('school-years', 0.02)}>
              Enter my world
            </button>
            <button className="btn" onClick={() => jumpToChapter('project-skyline', 0.5)}>
              Explore projects
            </button>
          </div>
          <button className="link-btn hero__skip" onClick={() => jumpToChapter('college-workspace', 0.06)}>
            Skip the intro →
          </button>
          <div className="scroll-cue" aria-hidden="true">
            <span>Scroll to begin</span>
            <i />
          </div>
        </div>
        <Beat at={0.62} align="right">
          <p className="caption">Every engineer starts somewhere small. Let’s zoom in.</p>
        </Beat>
      </Chapter>

      {/* 02 ─ SCHOOL YEARS */}
      <Chapter id="school-years">
        <Beat at={0.05}>
          <div className="panel">
            <Tag id="school-years" />
            <h2 id="school-years-title">The walk to school</h2>
            <p>Velammal Matriculation School, Paruthipattu — the same gate, every morning, for years.</p>
          </div>
        </Beat>
        {schooling.map((s, i) => (
          <Beat key={s.id} at={i === 0 ? 0.3 : 0.58} align="right">
            <article className="panel panel--note">
              <p className="panel__eyebrow">{s.date}</p>
              <h3>{s.label}</h3>
              <p className="stat">{s.score}</p>
              <p className="muted">{s.school}</p>
            </article>
          </Beat>
        ))}
        <Beat at={0.86} align="center">
          <p className="caption">Through the doors — and on to engineering.</p>
        </Beat>
      </Chapter>

      {/* 03 ─ COLLEGE & CODE */}
      <Chapter id="college-workspace">
        <Beat at={0.04}>
          <div className="panel">
            <Tag id="college-workspace" />
            <h2 id="college-workspace-title">{degree.title}</h2>
            <p className="panel__eyebrow">
              {degree.school} · {degree.years}
            </p>
            <p>
              <strong>{degree.score}</strong> <span className="muted">({degree.scoreNote})</span>
            </p>
          </div>
        </Beat>
        <Beat at={0.36} align="right">
          <div className="panel">
            <h3>The toolkit</h3>
            <dl className="toolkit">
              {toolkit.map((t) => (
                <div key={t.group}>
                  <dt>{t.group}</dt>
                  <dd>
                    {t.items.map((i) => (
                      <span className="chip" key={i}>
                        {i}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Beat>
        <Beat at={0.66}>
          <div className="panel">
            <h3>Code by day, prototypes by night</h3>
            <ul className="ventures">
              {ventures.map((v) => (
                <li key={v.id}>
                  <p className="ventures__name">
                    {v.name} <span>{v.kind}</span>
                  </p>
                  {v.points.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </Beat>
      </Chapter>

      {/* 04 ─ THE FLYER */}
      <Chapter id="night-flyer">
        <Beat at={0.12} align="right">
          <p className="caption" id="night-flyer-title">
            Night falls. Laptop closed. On the way out…
          </p>
        </Beat>
        <Beat at={0.62}>
          <div className="panel panel--flyer">
            <p className="panel__eyebrow">Pinned to the wall</p>
            <h3>Bharath Cycle Design Challenge</h3>
            <p>A national-level cycle design competition organised by AICTE. A team to lead, a cycle to design.</p>
          </div>
        </Beat>
      </Chapter>

      {/* 05 ─ THE CYCLE WORKSHOP */}
      <Chapter id="cycle-workshop">
        <Beat at={0.05}>
          <div className="panel">
            <Tag id="cycle-workshop" />
            <h2 id="cycle-workshop-title">Sketch. Model. Build.</h2>
            <p>
              The <strong>Cargo-cum-Commute Electric Cycle</strong>: one machine for last-mile delivery and everyday personal
              transport, designed for lightweight, energy-efficient urban mobility.
            </p>
          </div>
        </Beat>
        <Beat at={0.32} align="right">
          <div className="panel panel--note">
            <p className="panel__eyebrow">From lines to a frame</p>
            <p>
              A moped-style e-cycle with fat tyres, front and rear disc brakes and a triangular rear carrier — shown here as
              the 3D interpretation of the CLUX design renders.
            </p>
          </div>
        </Beat>
        <Beat at={0.58}>
          <div className="panel panel--note">
            <p className="panel__eyebrow">Modular utility</p>
            <p>
              A detachable cargo module with its own sprung wheels clips on behind for deliveries, and comes off for the
              daily commute. Sustainability and modular utility were the brief.
            </p>
          </div>
        </Beat>
        <Beat at={0.84}>
          <div className="panel panel--award">
            <p className="award__badge">Winner</p>
            <h3>Bharath Cycle Design Challenge</h3>
            <p>1st place in AICTE’s national-level cycle design competition.</p>
            <ul className="facts">
              <li>
                <strong>Design patent</strong> — application filed
              </li>
              <li>
                <strong>Utility / prototype patent</strong> — application filed
              </li>
            </ul>
            <button
              className="btn btn--primary"
              onClick={() => {
                ambient.blip(880)
                setInspecting(true)
              }}
            >
              Inspect the cycle in 3D
            </button>
            <p className="fine">Illustrative 3D model based on the design renders — not production CAD.</p>
          </div>
        </Beat>
      </Chapter>

      {/* 06 ─ THE RIDE */}
      <Chapter id="ride-transition">
        <Beat at={0.08}>
          <div className="panel">
            <Tag id="ride-transition" />
            <h2 id="ride-transition-title">Out of the workshop, into the city</h2>
            <p>The same streets, at a different speed.</p>
          </div>
        </Beat>
        <Beat at={0.55} align="right">
          <p className="caption">…wait. Did that sign just flicker?</p>
        </Beat>
        <Beat at={0.84} align="center">
          <p className="caption caption--glitch" data-text="There’s a layer under everything.">
            There’s a layer under everything.
          </p>
        </Beat>
      </Chapter>

      {/* 07 ─ THE SECURITY LAYER */}
      <Chapter id="cyber-city" className="chapter--dark">
        <Beat at={0.05}>
          <div className="headline-block">
            <Tag id="cyber-city" />
            <h2 id="cyber-city-title" className="headline">
              Enter the security layer
            </h2>
            <p>Exploring vulnerabilities, assessing risk, and understanding how digital systems can be made more resilient.</p>
          </div>
        </Beat>
        <Beat at={0.34} align="right">
          <article className="panel panel--dark">
            <p className="panel__eyebrow">Documented work</p>
            <h3>{projectById('vuln-assessment')!.title}</h3>
            <p>{projectById('vuln-assessment')!.summary}</p>
            <ProjectButton id="vuln-assessment" />
          </article>
        </Beat>
        <Beat at={0.6}>
          <article className="panel panel--dark">
            <p className="panel__eyebrow">Still learning</p>
            <h3>Cyber Security &amp; Ethical Hacking (Advanced)</h3>
            <p>GUVI certification — in progress. Plus an internship project on password strength analysis.</p>
            <ProjectButton id="password-analyzer" label="Open the password analyzer" />
          </article>
        </Beat>
        <Beat at={0.86} align="center">
          <p className="caption caption--dark">Up to the rooftops — the rest of the work is lit up there.</p>
        </Beat>
      </Chapter>

      {/* 08 ─ PROJECT SKYLINE */}
      <Chapter id="project-skyline" className="chapter--dark">
        <Beat at={0.04}>
          <div className="headline-block">
            <Tag id="project-skyline" />
            <h2 id="project-skyline-title" className="headline">
              Project skyline
            </h2>
            <p>Every billboard is a build. Pick one in the city, or from the list.</p>
          </div>
        </Beat>
        <Beat at={0.36} sticky span={0.64}>
          <nav className="project-index" aria-label="Projects">
            <p className="panel__eyebrow">{projects.length} project files</p>
            <ul>
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => openProject(p.id)}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover(null)}
                    className={hover === p.id ? 'is-hover' : ''}
                    style={{ '--accent': p.accent } as CSSProperties}
                  >
                    <span className="project-index__title">{p.short}</span>
                    <span className="project-index__cat">{p.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </Beat>
      </Chapter>

      {/* 09 ─ ACHIEVEMENT CONSTELLATION */}
      <Chapter id="achievement-constellation" className="chapter--dark">
        <Beat at={0.04}>
          <div className="headline-block">
            <Tag id="achievement-constellation" />
            <h2 id="achievement-constellation-title" className="headline">
              The constellation
            </h2>
            <p>Wins, finalist placements, recognitions and filings — each a point of light.</p>
          </div>
        </Beat>
        <Beat at={0.34} sticky span={0.66}>
          {webgl === 'failed' ? (
            <div className="achievements">
              <ul className="achievements__list" aria-label="Achievements">
                {achievements.map((a) => (
                  <li key={a.id}>
                    <button
                      className={`ach ach--${a.kind} ${a.id === achievementId ? 'is-active' : ''}`}
                      aria-pressed={a.id === achievementId}
                      onClick={() => setAchievement(a.id === achievementId ? null : a.id)}
                    >
                      <span className="ach__badge">{a.badge}</span>
                      <span className="ach__title">{a.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <SkyDetail />
            </div>
          ) : (
            <div className="sky-ui">
              <p className="sky-hint">
                <span aria-hidden="true">⟲</span> Drag to look around the sky · select a constellation
              </p>
              {/* keyboard / screen-reader route to the same constellations */}
              <ul className="sky-list" aria-label="Constellations">
                {skyEntries.map((e) => (
                  <li key={e.id}>
                    <button aria-pressed={e.id === achievementId} onClick={() => setAchievement(e.id === achievementId ? null : e.id)}>
                      {e.badge}: {e.title}
                    </button>
                  </li>
                ))}
              </ul>
              {achievementId && <SkyDetail />}
            </div>
          )}
        </Beat>
      </Chapter>

      {/* 10 ─ CONTACT */}
      <Chapter id="contact-ending">
        <Beat at={0.2} sticky span={0.8}>
          <div className="contact">
            <Tag id="contact-ending" />
            <h2 id="contact-ending-title" className="contact__title">
              Curious about what we can build next?
            </h2>
            <p>Open to engineering, software, product-development, and technology collaborations.</p>
            <div className="contact__actions">
              <a className="btn btn--primary" href={`mailto:${profile.email}`}>
                Email {profile.email}
              </a>
              <a className="btn" href={profile.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
              <a className="btn" href={profile.resume} download>
                Download résumé (PDF)
              </a>
            </div>
            <div className="contact__links">
              <button className="link-btn" onClick={() => jumpToChapter('project-skyline', 0.5)}>
                Explore projects
              </button>
              <button className="link-btn" onClick={() => jumpToChapter(0, 0)}>
                Return to the world ↺
              </button>
            </div>
          </div>
        </Beat>
      </Chapter>
    </main>
  )
}
