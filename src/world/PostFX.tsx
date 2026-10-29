import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createBloomMaterials, createComicMaterial } from '../shaders/comicPass'
import { story, useStore } from '../state/store'
import { cameraOverride } from './cameraOverride'

/**
 * Takes over rendering: scene → render target (colour + depth) → bloom chain → comic pass.
 * Effect uniforms come straight from the GSAP-driven `story.fx` values.
 */
export function PostFX() {
  const { gl, size, camera } = useThree()
  const quality = useStore((s) => s.quality)
  const reduced = useStore((s) => s.reducedMotion)
  const bloomOn = quality !== 'low'

  const targets = useMemo(() => {
    const type = quality === 'low' ? THREE.UnsignedByteType : THREE.HalfFloatType
    const main = new THREE.WebGLRenderTarget(1, 1, {
      type,
      // MSAA keeps silhouettes clean; three resolves the depth texture for the ink pass.
      samples: quality === 'high' ? 4 : quality === 'balanced' ? 2 : 0,
      depthBuffer: true,
    })
    main.depthTexture = new THREE.DepthTexture(1, 1)
    main.depthTexture.type = THREE.UnsignedIntType
    const opts = { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
    return { main, a: new THREE.WebGLRenderTarget(1, 1, opts), b: new THREE.WebGLRenderTarget(1, 1, opts) }
  }, [quality])

  const { quad, material, bloom, ortho } = useMemo(() => {
    const material = createComicMaterial()
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    return { quad, material, bloom: createBloomMaterials(), ortho }
  }, [])

  useEffect(() => {
    const dpr = gl.getPixelRatio()
    const w = Math.max(1, Math.floor(size.width * dpr))
    const h = Math.max(1, Math.floor(size.height * dpr))
    targets.main.setSize(w, h)
    // bloom works at quarter resolution: cheap, and softer is better for neon halos
    const bw = Math.max(1, Math.floor(w / 4))
    const bh = Math.max(1, Math.floor(h / 4))
    targets.a.setSize(bw, bh)
    targets.b.setSize(bw, bh)
    bloom.blur.uniforms.uTexel.value.set(1 / bw, 1 / bh)
    material.uniforms.uRes.value.set(w, h)
  }, [gl, size, targets, material, bloom])

  useEffect(
    () => () => {
      targets.main.dispose()
      targets.a.dispose()
      targets.b.dispose()
    },
    [targets],
  )
  useEffect(
    () => () => {
      material.dispose()
      bloom.bright.dispose()
      bloom.blur.dispose()
      quad.geometry.dispose()
    },
    [material, quad, bloom],
  )

  useFrame((state) => {
    const cam = camera as THREE.PerspectiveCamera
    const u = material.uniforms
    const fx = story.fx
    u.tColor.value = targets.main.texture
    u.tDepth.value = targets.main.depthTexture
    u.tBloom.value = targets.a.texture
    u.uNear.value = cam.near
    u.uFar.value = cam.far
    u.uTime.value = reduced ? 0 : state.clock.elapsedTime
    u.uIris.value = fx.iris
    // Reduced motion keeps the colour shift but drops tearing, distortion and flashes.
    u.uGlitch.value = reduced ? 0 : fx.glitch
    u.uFisheye.value = reduced ? 0 : fx.fisheye
    u.uFlash.value = reduced ? fx.flash * 0.5 : fx.flash
    u.uDim.value = Math.max(fx.dim, cameraOverride.weight * 0.85)
    u.uCyber.value = fx.cyber
    u.uHalftone.value = quality === 'low' ? 0 : 1
    u.uDpr.value = gl.getPixelRatio()
    u.uEdge.value = 1
    u.uBloom.value = bloomOn ? 0.35 + fx.cyber * 0.95 + fx.dusk * 0.25 : 0

    gl.setRenderTarget(targets.main)
    gl.clear()
    gl.render(state.scene, cam)

    if (bloomOn) {
      bloom.bright.uniforms.tColor.value = targets.main.texture
      bloom.bright.uniforms.uThreshold.value = 0.72 - fx.cyber * 0.12
      quad.material = bloom.bright
      gl.setRenderTarget(targets.a)
      gl.render(quad, ortho)
      quad.material = bloom.blur
      for (let i = 0; i < 2; i++) {
        bloom.blur.uniforms.tColor.value = targets.a.texture
        bloom.blur.uniforms.uDir.value.set(1 + i, 0)
        gl.setRenderTarget(targets.b)
        gl.render(quad, ortho)
        bloom.blur.uniforms.tColor.value = targets.b.texture
        bloom.blur.uniforms.uDir.value.set(0, 1 + i)
        gl.setRenderTarget(targets.a)
        gl.render(quad, ortho)
      }
    }

    quad.material = material
    gl.setRenderTarget(null)
    gl.render(quad, ortho)
  }, 1)

  return null
}
