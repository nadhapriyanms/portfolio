import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Project } from './projectData'
import { canvasTexture, fonts, wrapText } from '../utils/canvasTexture'
import { toon } from '../utils/materials'
import { useStore } from '../state/store'
import { ambient } from '../audio/ambient'

function billboardTexture(p: Project, index: number) {
  return canvasTexture(`billboard-${p.id}`, 1024, 600, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#11163d')
    g.addColorStop(1, '#070921')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = p.accent
    ctx.fillRect(0, 0, 22, h)
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 6
    ctx.strokeRect(40, 30, w - 70, h - 60)
    // scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2)
    ctx.fillStyle = p.accent
    ctx.font = `500 34px ${fonts.mono}`
    ctx.fillText(`FILE ${String(index + 1).padStart(2, '0')}  //  ${p.category.toUpperCase()}`, 80, 100)
    ctx.fillStyle = '#ffffff'
    ctx.font = `900 108px ${fonts.display}`
    const lines = wrapText(ctx, p.short.toUpperCase(), w - 160).slice(0, 3)
    lines.forEach((l, i) => ctx.fillText(l, 80, 220 + i * 104))
    ctx.fillStyle = '#93a5d6'
    ctx.font = `500 30px ${fonts.mono}`
    ctx.fillText('▶ SELECT TO OPEN', 80, h - 70)
  })
}

/** A clickable neon billboard on the skyline. Works with pointer and touch; keyboard users use the HTML index. */
export function ProjectBillboard({ project, index, position, rotationY }: { project: Project; index: number; position: THREE.Vector3; rotationY: number }) {
  const open = useStore((s) => s.openProject)
  const setHover = useStore((s) => s.setHoverProject)
  const group = useRef<THREE.Group>(null)
  const screen = useMemo(() => {
    return new THREE.MeshBasicMaterial({ map: billboardTexture(project, index), toneMapped: false })
  }, [project, index])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: project.accent, toneMapped: false }), [project.accent])
  const base = useMemo(() => new THREE.Color(project.accent), [project.accent])

  useFrame((state, dt) => {
    const s = useStore.getState()
    const hot = s.hoverProjectId === project.id || s.projectId === project.id
    const g = group.current
    if (!g) return
    const target = hot ? 1.07 : 1
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 8, dt))
    const pulse = s.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 2 + index)
    glow.color.copy(base).multiplyScalar(hot ? 1.6 : pulse)
    screen.color.setScalar(hot ? 1.15 : 1)
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(project.id)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    if (useStore.getState().hoverProjectId === project.id) setHover(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    ambient.blip(660)
    document.body.style.cursor = ''
    open(project.id)
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* supports down to the building below */}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} material={toon('#1b1d3a')} position={[x, -6, -0.3]}>
          <boxGeometry args={[0.25, 12, 0.25]} />
        </mesh>
      ))}
      <group ref={group}>
        <mesh material={toon('#14163a')} position={[0, 0, -0.18]}>
          <boxGeometry args={[6.2, 3.7, 0.3]} />
        </mesh>
        <mesh material={screen} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <planeGeometry args={[5.9, 3.45]} />
        </mesh>
        <mesh material={glow} position={[0, -1.95, 0]}>
          <boxGeometry args={[6.2, 0.1, 0.12]} />
        </mesh>
        <mesh material={glow} position={[0, 1.95, 0]}>
          <boxGeometry args={[6.2, 0.06, 0.12]} />
        </mesh>
      </group>
    </group>
  )
}
