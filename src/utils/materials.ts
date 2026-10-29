import * as THREE from 'three'

/**
 * Cel ramp: a hard two-tone terminator with a narrow soft band, like hand-painted anime
 * backgrounds. The shadow tone itself is coloured (see `celUniforms`), never plain grey.
 */
export const toonRamp = (() => {
  const v = [0, 0, 0, 0, 120, 255, 255, 255]
  const data = new Uint8Array(v.flatMap((x) => [x, x, x, 255]))
  const tex = new THREE.DataTexture(data, v.length, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
})()

/** Shared lighting mood for every cel material; scenes set these through <Atmosphere>. */
export const celUniforms = {
  uShadowTint: { value: new THREE.Color('#8f9cc4') },
  uRimColor: { value: new THREE.Color('#ffe6c8') },
  uRimStrength: { value: 0.18 },
}

/** Patches a toon material: tinted cel shadows + view-space rim light. */
export function makeCel<T extends THREE.MeshToonMaterial>(m: T): T {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, celUniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <gradientmap_pars_fragment>',
        `#include <gradientmap_pars_fragment>
         uniform vec3 uShadowTint;
         uniform vec3 uRimColor;
         uniform float uRimStrength;`,
      )
      .replace(
        'return vec3( texture2D( gradientMap, coord ).r );',
        'return mix( uShadowTint, vec3( 1.0 ), texture2D( gradientMap, coord ).r );',
      )
      .replace(
        '#include <opaque_fragment>',
        `vec3 rimN = length( normal ) > 1e-5 ? normalize( normal ) : vec3( 0.0, 0.0, 1.0 );
         vec3 rimV = length( vViewPosition ) > 1e-5 ? normalize( vViewPosition ) : vec3( 0.0, 0.0, 1.0 );
         float rimT = 1.0 - abs( dot( rimN, rimV ) );
         // no rim on floors and roofs: grazing ground would otherwise glow
         vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
         float facingUp = max( dot( rimN, upV ), 0.0 );
         outgoingLight += uRimColor * pow( rimT, 3.0 ) * uRimStrength * ( 1.0 - facingUp * facingUp );
         #include <opaque_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'cel-v3'
  return m
}

const cache = new Map<string, THREE.MeshToonMaterial>()

export interface ToonOptions {
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  side?: THREE.Side
  map?: THREE.Texture
  emissiveMap?: THREE.Texture
  vertexColors?: boolean
}

/** Cached cel material. Pass a unique `key` when the material will be mutated per frame. */
export function toon(color: string, opts: ToonOptions = {}, key?: string) {
  const k =
    key ??
    `${color}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? ''}|${opts.opacity ?? ''}|${opts.side ?? ''}|${opts.map?.uuid ?? ''}|${opts.emissiveMap?.uuid ?? ''}|${opts.vertexColors ? 'vc' : ''}`
  let m = cache.get(k)
  if (!m) {
    m = makeCel(
      new THREE.MeshToonMaterial({
        color,
        gradientMap: toonRamp,
        emissive: opts.emissive ?? '#000000',
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        transparent: opts.transparent ?? false,
        opacity: opts.opacity ?? 1,
        side: opts.side ?? THREE.FrontSide,
        map: opts.map ?? null,
        emissiveMap: opts.emissiveMap ?? null,
        vertexColors: opts.vertexColors ?? false,
      }),
    )
    cache.set(k, m)
  }
  return m
}

const basicCache = new Map<string, THREE.MeshBasicMaterial>()

/** Unlit material for emissive signage, screens and glows. */
export function flat(color: string, opacity = 1, key?: string, map?: THREE.Texture) {
  const k = key ?? `${color}|${opacity}|${map?.uuid ?? ''}`
  let m = basicCache.get(k)
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1 || !!map,
      opacity,
      map: map ?? null,
      toneMapped: false,
    })
    basicCache.set(k, m)
  }
  return m
}

export const palette = {
  ink: '#1d1a24',
  paper: '#f3e9d7',
  paperShade: '#e2d3b8',
  sunset: '#e8774a',
  peach: '#f2b48a',
  rose: '#d98e8e',
  teal: '#4f8a8b',
  sage: '#9bb59a',
  sky: '#8fb7c9',
  cream: '#efe2c6',
  brick: '#b5644f',
  wood: '#8a5a3c',
  concrete: '#a8a39b',
  asphalt: '#4a4752',
  cyan: '#2de2e6',
  magenta: '#ff3caa',
  navy: '#0b0e2a',
  clux: '#d8322a',
}
