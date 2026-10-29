import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Tubes } from './Tubes'
import * as THREE from 'three'
import { story, useStore } from '../../state/store'
import { canvasTexture, fonts, rng } from '../../utils/canvasTexture'
import { palette, toon } from '../../utils/materials'

/**
 * Set dressing for the security layer, styled after 90s cyberpunk anime: wet asphalt
 * that smears neon into long reflections, rain, lamp light you can see in the air,
 * cables overhead, an elevated line, traffic in the sky and slow searchlights.
 * Everything fades in with `story.fx.cyber`, so the warm city underneath is the same street.
 */

const cyber = () => story.fx.cyber

/* ───────────────────────────── wet road with neon reflections */

export function WetRoad({ zFrom, zTo, width }: { zFrom: number; zTo: number; width: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uCyber: { value: 0 }, uTime: { value: 0 }, uHalf: { value: width / 2 } },
        vertexShader: /* glsl */ `
          varying vec3 vW;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uCyber, uTime, uHalf;
          varying vec3 vW;
          float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float n2(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
          }
          void main() {
            float side = sign(vW.x);
            float ax = abs(vW.x);
            // puddles: glossy patches where reflections are sharp
            float puddle = smoothstep(0.45, 0.62, n2(vW.xz * 0.35) * 0.7 + n2(vW.xz * 1.3) * 0.3);
            // long vertical streaks below each sign along both kerbs
            float cell = floor(vW.z / 7.5 + (side > 0.0 ? 0.5 : 0.0));
            float within = fract(vW.z / 7.5 + (side > 0.0 ? 0.5 : 0.0));
            // squared by hand: pow() of a negative base is undefined in GLSL (NaN on ANGLE/D3D)
            float sd = (ax - (uHalf - 0.9)) / 0.9;
            float streak = exp(-sd * sd) * smoothstep(0.0, 0.25, within) * smoothstep(0.9, 0.55, within);
            vec3 c = mod(cell, 2.0) < 1.0 ? vec3(1.0, 0.24, 0.67) : vec3(0.18, 0.89, 0.9);
            if (mod(cell, 5.0) < 1.0) c = vec3(1.0, 0.82, 0.25);
            float shimmer = 0.75 + 0.25 * sin(vW.z * 3.0 + uTime * 2.0) * n2(vW.xz * 4.0 + uTime * 0.3);
            vec3 col = c * streak * (0.35 + 0.65 * puddle) * shimmer;
            // lane-line glints and a faint sky sheen in the puddles
            col += vec3(0.25, 0.3, 0.55) * puddle * 0.12;
            col += vec3(0.6, 0.95, 1.0) * smoothstep(0.12, 0.0, ax) * puddle * 0.25;
            gl_FragColor = vec4(col * uCyber, 1.0);
          }
        `,
      }),
    [width],
  )
  useFrame((s) => {
    mat.uniforms.uCyber.value = cyber()
    mat.uniforms.uTime.value = s.clock.elapsedTime
  })
  return (
    <mesh material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, (zFrom + zTo) / 2]} renderOrder={2}>
      <planeGeometry args={[width, zFrom - zTo]} />
    </mesh>
  )
}

/* ───────────────────────────── rain (GPU-animated streaks that follow the rider) */

export function Rain({ count = 1400 }: { count?: number }) {
  const { geo, mat } = useMemo(() => {
    const r = rng(91)
    const pos = new Float32Array(count * 2 * 3)
    const top = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * 26
      const y = r() * 22
      const z = 12 - r() * 50
      pos.set([x, y, z, x, y, z], i * 6)
      top[i * 2] = 0
      top[i * 2 + 1] = 1
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aTop', new THREE.BufferAttribute(top, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uZ: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aTop;
        uniform float uTime, uZ;
        varying float vTop;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uTime * 19.0, 22.0) + aTop * 0.55;
          p.x += aTop * 0.06;
          p.z += uZ;
          vTop = aTop;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vTop;
        void main() { gl_FragColor = vec4(vec3(0.62, 0.78, 1.0) * uOpacity * (0.35 + vTop * 0.65), 1.0); }
      `,
    })
    return { geo, mat }
  }, [count])
  const reduced = useStore((s) => s.reducedMotion)
  useFrame((s) => {
    mat.uniforms.uTime.value = reduced ? 0 : s.clock.elapsedTime
    mat.uniforms.uZ.value = story.anchor.z
    mat.uniforms.uOpacity.value = cyber() * 0.55
  })
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />
}

/* ───────────────────────────── volumetric light cones */

const coneMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color('#fff') }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying float vFacing;
      void main() {
        vH = uv.y;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vH;
      varying float vFacing;
      void main() {
        float a = pow(clamp(vFacing, 0.0, 1.0), 2.2) * pow(clamp(vH, 0.0, 1.0), 1.6) * uOpacity;
        gl_FragColor = vec4(uColor * a, 1.0);
      }
    `,
  })

export function LightCones({ cones }: { cones: { pos: THREE.Vector3Tuple; color: string; h: number; r: number }[] }) {
  const mats = useMemo(
    () =>
      cones.map((c) => {
        const m = coneMat()
        m.uniforms.uColor.value.set(c.color)
        return m
      }),
    [cones],
  )
  useFrame(() => {
    const k = 0.15 + cyber() * 0.55
    mats.forEach((m) => (m.uniforms.uOpacity.value = k))
  })
  return (
    <group>
      {cones.map((c, i) => (
        <mesh key={i} material={mats[i]} position={[c.pos[0], c.pos[1] - c.h / 2, c.pos[2]]} renderOrder={3}>
          <cylinderGeometry args={[0.12, c.r, c.h, 20, 1, true]} />
        </mesh>
      ))}
    </group>
  )
}

/* ───────────────────────────── neon signage (Japanese + English) */

export const kanjiSigns = ['電脳', '警告', '安全', '接続', '診断', '暗号', 'ラーメン', '24H', '情報', '監視']

export function verticalNeon(text: string, color: string) {
  const vertical = /[^\x00-\x7F]/.test(text)
  return canvasTexture(`vneon-${text}-${color}`, vertical ? 160 : 512, vertical ? 512 : 160, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(6,8,26,0.92)'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.strokeRect(7, 7, w - 14, h - 14)
    ctx.shadowColor = color
    ctx.shadowBlur = 22
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (vertical) {
      const chars = Array.from(text)
      const step = (h - 40) / chars.length
      ctx.font = `900 ${Math.min(120, step * 0.9)}px "Noto Sans JP", "Yu Gothic", "Meiryo", "MS Gothic", sans-serif`
      chars.forEach((c, i) => ctx.fillText(c, w / 2, 20 + step * (i + 0.5)))
    } else {
      ctx.font = `800 96px ${fonts.display}`
      ctx.fillText(text, w / 2, h / 2 + 6)
    }
  })
}

export function NeonSigns({ signs }: { signs: { text: string; color: string; pos: THREE.Vector3Tuple; rot: number; size: number }[] }) {
  const mats = useMemo(
    () => signs.map((s) => new THREE.MeshBasicMaterial({ map: verticalNeon(s.text, s.color), transparent: true, toneMapped: false })),
    [signs],
  )
  const flick = useRef(0)
  const reduced = useStore((s) => s.reducedMotion)
  useFrame((st) => {
    const c = cyber()
    flick.current = st.clock.elapsedTime
    mats.forEach((m, i) => {
      // unlit painted boards by day, buzzing neon at night (one or two tubes stutter)
      const stutter = !reduced && i % 7 === 3 && Math.sin(st.clock.elapsedTime * 23 + i) > 0.85 ? 0.35 : 1
      m.color.setScalar((0.5 + c * 1.6) * stutter)
    })
  })
  return (
    <group>
      {signs.map((s, i) => {
        const vertical = /[^\x00-\x7F]/.test(s.text)
        return (
          <group key={i} position={s.pos} rotation={[0, s.rot, 0]}>
            <mesh material={mats[i]}>
              <planeGeometry args={vertical ? [s.size * 0.31, s.size] : [s.size, s.size * 0.31]} />
            </mesh>
            <mesh position={[0, 0, -0.06]}>
              <boxGeometry args={vertical ? [s.size * 0.33, s.size * 1.02, 0.1] : [s.size * 1.02, s.size * 0.33, 0.1]} />
              <meshBasicMaterial color="#0b0d24" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/* ───────────────────────────── overhead cables with lanterns */

export function Cables({ zFrom, zTo, half }: { zFrom: number; zTo: number; half: number }) {
  const { lines, lanterns } = useMemo(() => {
    const r = rng(17)
    const lines: THREE.Vector3[][] = []
    const lanterns: THREE.Vector3Tuple[] = []
    for (let z = zFrom; z > zTo; z -= 6 + r() * 6) {
      const y = 6 + r() * 7
      const a = new THREE.Vector3(-half, y, z)
      const b = new THREE.Vector3(half, y + (r() - 0.5) * 2, z - (r() - 0.5) * 4)
      const mid = a.clone().lerp(b, 0.5)
      mid.y -= 1 + r()
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      lines.push(curve.getPoints(14))
      if (r() < 0.55) for (let i = 1; i < 6; i++) lanterns.push(curve.getPoint(i / 6).add(new THREE.Vector3(0, -0.35, 0)).toArray())
    }
    return { lines, lanterns }
  }, [zFrom, zTo, half])
  const lanternMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6a4a', toneMapped: false }), [])
  useFrame(() => lanternMat.color.set('#ff6a4a').multiplyScalar(0.4 + cyber() * 1.4))
  return (
    <group>
      <Tubes paths={lines} radius={0.03} material={toon('#141320')} />
      {lanterns.map((p, i) => (
        <mesh key={i} position={p} material={lanternMat} scale={[1, 1.3, 1]}>
          <sphereGeometry args={[0.2, 10, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/* ───────────────────────────── elevated line with a passing train */

export function ElevatedLine({ z, length = 140 }: { z: number; length?: number }) {
  const train = useRef<THREE.Group>(null)
  const windowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#bfefff', toneMapped: false }), [])
  const reduced = useStore((s) => s.reducedMotion)
  useFrame((s) => {
    if (train.current) train.current.position.x = reduced ? -20 : ((s.clock.elapsedTime * 14) % (length + 40)) - (length + 40) / 2
    windowMat.color.set('#bfefff').multiplyScalar(0.4 + cyber() * 1.3)
  })
  return (
    <group position={[0, 0, z]}>
      {/* deck and guideway */}
      <mesh position={[0, 11, 0]} castShadow>
        <boxGeometry args={[length, 0.9, 3.4]} />
        <primitive object={toon('#5a5868')} attach="material" />
      </mesh>
      <mesh position={[0, 11.55, 0]}>
        <boxGeometry args={[length, 0.25, 1.0]} />
        <primitive object={toon('#3a3846')} attach="material" />
      </mesh>
      {[-1.8, 1.8].map((dz) => (
        <mesh key={dz} position={[0, 11.9, dz]}>
          <boxGeometry args={[length, 0.6, 0.08]} />
          <primitive object={toon('#77748a')} attach="material" />
        </mesh>
      ))}
      {[-12, 12].map((x) => (
        <mesh key={x} position={[x, 5.3, 0]} castShadow>
          <boxGeometry args={[1.2, 10.6, 1.6]} />
          <primitive object={toon('#4c4a5a')} attach="material" />
        </mesh>
      ))}
      <group ref={train} position={[0, 12.6, 0]}>
        {[-8, 0, 8].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh>
              <boxGeometry args={[7.6, 1.8, 2.6]} />
              <primitive object={toon('#d9dde6')} attach="material" />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0, 0.25, s * 1.31]} material={windowMat}>
                <boxGeometry args={[6.6, 0.55, 0.02]} />
              </mesh>
            ))}
            <mesh position={[0, -0.55, 0]}>
              <boxGeometry args={[7.62, 0.18, 2.62]} />
              <meshBasicMaterial color={palette.magenta} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/* ───────────────────────────── traffic in the sky */

export function HoverTraffic({ count = 26, zFrom, zTo }: { count?: number; zFrom: number; zTo: number }) {
  const { geo, mat } = useMemo(() => {
    const r = rng(23)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos.set([(r() < 0.5 ? -1 : 1) * (2 + r() * 3), 15 + r() * 14, 0], i * 3)
      seed[i] = r()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uFrom: { value: zFrom }, uLen: { value: zFrom - zTo }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uFrom, uLen;
        varying float vSeed;
        void main() {
          vec3 p = position;
          float dir = p.x > 0.0 ? 1.0 : -1.0;
          p.z = uFrom - mod(aSeed * uLen + uTime * (10.0 + aSeed * 14.0) * dir, uLen);
          vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(260.0 / -mv.z, 2.0, 14.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vSeed;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c * vec2(1.0, 2.2));
          float a = smoothstep(0.5, 0.0, d);
          vec3 col = vSeed > 0.5 ? vec3(1.0, 0.35, 0.3) : vec3(0.85, 0.95, 1.0);
          gl_FragColor = vec4(col * a * uOpacity, 1.0);
        }
      `,
    })
    return { geo, mat }
  }, [count, zFrom, zTo])
  const reduced = useStore((s) => s.reducedMotion)
  useFrame((s) => {
    mat.uniforms.uTime.value = reduced ? 0 : s.clock.elapsedTime
    mat.uniforms.uOpacity.value = cyber()
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

/* ───────────────────────────── searchlights sweeping the clouds */

export function Searchlights({ spots }: { spots: THREE.Vector3Tuple[] }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const mat = useMemo(() => {
    const m = coneMat()
    m.uniforms.uColor.value.set('#9fc8ff')
    return m
  }, [])
  const reduced = useStore((s) => s.reducedMotion)
  useFrame((s) => {
    const t = reduced ? 0 : s.clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      g.rotation.z = Math.sin(t * 0.25 + i * 2.1) * 0.5
      g.rotation.x = -0.25 + Math.cos(t * 0.2 + i) * 0.15
    })
    mat.uniforms.uOpacity.value = cyber() * 0.35
  })
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={p} ref={(g) => (refs.current[i] = g)}>
          <mesh material={mat} position={[0, 30, 0]} rotation={[Math.PI, 0, 0]}>
            <cylinderGeometry args={[0.3, 5, 60, 16, 1, true]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ───────────────────────────── holographic shield over the street */

export function HoloShield({ position, scale = 1 }: { position: THREE.Vector3Tuple; scale?: number }) {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(palette.cyan) } },
        vertexShader: /* glsl */ `
          varying vec3 vP;
          varying float vF;
          void main() {
            vP = position;
            vec3 n = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vF = 1.0 - abs(dot(n, normalize(-mv.xyz)));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uOpacity;
          uniform vec3 uColor;
          varying vec3 vP;
          varying float vF;
          void main() {
            float scan = step(0.55, fract(vP.y * 6.0 - uTime * 0.8));
            float flick = 0.85 + 0.15 * sin(uTime * 37.0);
            float a = (0.25 + vF * 0.9) * (0.55 + 0.45 * scan) * flick * uOpacity;
            gl_FragColor = vec4(uColor * a, 1.0);
          }
        `,
      }),
    [],
  )
  const reduced = useStore((s) => s.reducedMotion)
  useFrame((s) => {
    const t = reduced ? 0 : s.clock.elapsedTime
    mat.uniforms.uTime.value = t
    mat.uniforms.uOpacity.value = cyber()
    if (g.current) g.current.rotation.y = t * 0.4
  })
  const shield = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 1.4)
    s.quadraticCurveTo(0.9, 1.25, 1.1, 1.1)
    s.quadraticCurveTo(1.1, -0.2, 0, -1.3)
    s.quadraticCurveTo(-1.1, -0.2, -1.1, 1.1)
    s.quadraticCurveTo(-0.9, 1.25, 0, 1.4)
    return new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false })
  }, [])
  return (
    <group position={position} scale={scale}>
      <group ref={g}>
        <mesh geometry={shield} material={mat} position={[0, 0, -0.075]} />
        <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.9, 0.03, 6, 64]} />
        </mesh>
        <mesh material={mat} rotation={[Math.PI / 2.4, 0.4, 0]}>
          <torusGeometry args={[2.3, 0.02, 6, 64]} />
        </mesh>
        <mesh material={mat}>
          <icosahedronGeometry args={[2.6, 1]} />
        </mesh>
      </group>
    </group>
  )
}

/* ───────────────────────────── steam from street vents */

export function Steam({ vents }: { vents: THREE.Vector3Tuple[] }) {
  const per = 24
  const { geo, mat } = useMemo(() => {
    const r = rng(8)
    const pos = new Float32Array(vents.length * per * 3)
    const seed = new Float32Array(vents.length * per)
    vents.forEach((v, i) => {
      for (let j = 0; j < per; j++) {
        pos.set(v, (i * per + j) * 3)
        seed[i * per + j] = r()
      }
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        varying float vLife;
        void main() {
          float life = fract(uTime * 0.18 + aSeed);
          vec3 p = position + vec3(sin(aSeed * 40.0 + life * 3.0) * 0.6 * life, life * 4.5, cos(aSeed * 17.0) * 0.4 * life);
          vLife = life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((40.0 + life * 220.0) / -mv.z, 2.0, 120.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * (1.0 - vLife) * vLife * 2.2 * uOpacity;
          gl_FragColor = vec4(vec3(0.75, 0.72, 0.95), a * 0.35);
        }
      `,
    })
    return { geo, mat }
  }, [vents])
  const reduced = useStore((s) => s.reducedMotion)
  useFrame((s) => {
    mat.uniforms.uTime.value = reduced ? 0 : s.clock.elapsedTime
    mat.uniforms.uOpacity.value = cyber()
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
